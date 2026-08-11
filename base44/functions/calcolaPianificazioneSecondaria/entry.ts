import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

// Calcola la pianificazione predittiva per le secondarie:
// 1. Carica impianti target e fornitori
// 2. Recupera consuntivo dai record Secondaria (destinazione = impianto)
// 3. Calcola residuo = target - consuntivo
// 4. Genera settimane da oggi al 18 dicembre
// 5. Analizza capacità storica (kg/viaggio, viaggi/settimana per fornitore)
// 6. Distribuisce residuo across settimane e fornitori
// 7. Calcola delta, viaggi necessari, scenari, target raggiungibile
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const impianti = await base44.asServiceRole.entities.ImpiantoTargetSecondaria.filter({ stato: 'attivo' });
    const fornitori = await base44.asServiceRole.entities.FornitoreSecondaria.filter({ stato: 'attivo' });
    const secondarie = await base44.asServiceRole.entities.Secondaria.list('-created_date', 10000);

    // Generate weeks from next Monday to Dec 18
    const oggi = new Date();
    const anno = oggi.getFullYear();
    const dataFineDefault = new Date(anno, 11, 18);
    const giornoSett = oggi.getDay();
    const giorniAlLun = giornoSett === 0 ? 1 : giornoSett === 1 ? 0 : 8 - giornoSett;
    const dataInizio = new Date(oggi);
    dataInizio.setDate(oggi.getDate() + giorniAlLun);

    const settimane = [];
    let currentDate = new Date(dataInizio);
    let weekNum = 1;
    while (currentDate <= dataFineDefault) {
      const ws = new Date(currentDate);
      const we = new Date(currentDate);
      we.setDate(we.getDate() + 4);
      if (we > dataFineDefault) we.setTime(dataFineDefault.getTime());
      settimane.push({
        numero: weekNum,
        data_inizio: ws.toISOString().split('T')[0],
        data_fine: we.toISOString().split('T')[0],
        mese: MESI[ws.getMonth()],
      });
      currentDate.setDate(currentDate.getDate() + 7);
      weekNum++;
    }
    const numSettimane = settimane.length;

    const result = [];
    for (const imp of impianti) {
      const impName = imp.nome_impianto.trim().toUpperCase();
      const dataFine = imp.data_fine ? new Date(imp.data_fine) : dataFineDefault;

      // Consuntivo: sum peso_effettivo from Secondaria where destinazione matches
      const matchingRecords = secondarie.filter(r =>
        (r.destinazione || '').toUpperCase().includes(impName)
      );
      const consuntivo = matchingRecords.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
      const residuo = imp.target - consuntivo;

      // Fornitori for this impianto
      const impFornitori = fornitori.filter(f => f.impianto_id === imp.id);
      const fornitoreStats = [];

      for (const f of impFornitori) {
        const fName = f.nome.trim().toUpperCase();
        const fRecords = matchingRecords.filter(r =>
          (r.ragione_sociale || '').toUpperCase().includes(fName) ||
          (r.stoccaggio || '').toUpperCase().includes(fName) ||
          (r.trasportatore || '').toUpperCase().includes(fName)
        );
        const fConsuntivo = fRecords.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
        const fViaggi = fRecords.length;
        const avgKgPerViaggio = fViaggi > 0 ? fConsuntivo / fViaggi : 28000;

        // Recent records (last 3 months) for capacity
        const treMesiFa = new Date();
        treMesiFa.setMonth(treMesiFa.getMonth() - 3);
        const recentRecords = fRecords.filter(r =>
          r.trasporto_finito_il && new Date(r.trasporto_finito_il) >= treMesiFa
        );
        const viaggiPerSett = recentRecords.length / 13;
        const capacitaSett = Math.round(avgKgPerViaggio * viaggiPerSett);

        fornitoreStats.push({
          id: f.id, nome: f.nome,
          quota_target: f.quota_target || 0,
          consuntivo: fConsuntivo,
          residuo: (f.quota_target || 0) - fConsuntivo,
          viaggi_totali: fViaggi,
          avg_kg_per_viaggio: Math.round(avgKgPerViaggio),
          viaggi_per_settimana: Math.round(viaggiPerSett * 10) / 10,
          capacita_settimanale: capacitaSett,
        });
      }

      const totalCapacita = fornitoreStats.reduce((s, f) => s + f.capacita_settimanale, 0);
      const totalAvgKg = fornitoreStats.reduce((s, f) => s + f.avg_kg_per_viaggio, 0);
      const viaggiNecessari = totalAvgKg > 0 ? Math.ceil(residuo / totalAvgKg) : 0;

      // Weekly plan: distribute residuo uniformly across weeks and fornitori
      const numFornitori = fornitoreStats.length || 1;
      const kgPerFornitorePerSett = numSettimane > 0 ? Math.round(residuo / numSettimane / numFornitori) : 0;

      const pianoSettimanale = settimane.map(sett => {
        const fPiano = fornitoreStats.map(f => {
          const kg = kgPerFornitorePerSett;
          const viaggi = f.avg_kg_per_viaggio > 0 ? Math.ceil(kg / f.avg_kg_per_viaggio) : 0;
          return { fornitore_id: f.id, fornitore_nome: f.nome, kg_previsti: kg, viaggi_previsti: viaggi, capacita_settimanale: f.capacita_settimanale };
        });
        return {
          ...sett,
          fornitori: fPiano,
          totale_kg: fPiano.reduce((s, f) => s + f.kg_previsti, 0),
          totale_viaggi: fPiano.reduce((s, f) => s + f.viaggi_previsti, 0),
        };
      });

      const totalePianificato = pianoSettimanale.reduce((s, sett) => s + sett.totale_kg, 0);
      const delta = residuo - totalePianificato;

      // Scenarios
      const capacitaPrevista = totalCapacita * numSettimane;
      const capacitaConserv = capacitaPrevista * 0.8;
      const capacitaOttim = capacitaPrevista * 1.2;
      const targetRaggiungibile = capacitaPrevista >= residuo;
      const gap = Math.max(0, residuo - capacitaPrevista);

      // Data prevista raggiungimento
      let dataPrevista = null;
      if (residuo <= 0) {
        dataPrevista = 'TARGET RAGGIUNTO';
      } else if (totalCapacita > 0) {
        const settNecessarie = Math.ceil(residuo / totalCapacita);
        const dataRagg = new Date(dataInizio);
        dataRagg.setDate(dataRagg.getDate() + (settNecessarie - 1) * 7);
        dataPrevista = dataRagg <= dataFine ? dataRagg.toISOString().split('T')[0] : 'NON RAGGIUNGIBILE';
      }

      // Stato
      let stato = 'verde';
      if (residuo <= 0) stato = 'blu';
      else if (!targetRaggiungibile) stato = 'rosso';
      else if (gap < totalCapacita * 0.1) stato = 'arancio';

      result.push({
        impianto: { id: imp.id, nome: imp.nome_impianto, target: imp.target, data_fine: dataFine.toISOString().split('T')[0] },
        consuntivo, residuo, totale_pianificato: totalePianificato, delta,
        viaggi_necessari: viaggiNecessari, viaggi_programmati: 0,
        kg_per_settimana: numSettimane > 0 ? Math.round(residuo / numSettimane) : 0,
        capacita_prevista: Math.round(capacitaPrevista),
        capacita_conservativa: Math.round(capacitaConserv),
        capacita_ottimistica: Math.round(capacitaOttim),
        target_raggiungibile: targetRaggiungibile, gap,
        data_prevista_raggiungimento: dataPrevista, stato,
        fornitori: fornitoreStats, piano_settimanale: pianoSettimanale,
      });
    }

    return Response.json({
      impianti: result, settimane,
      data_inizio: dataInizio.toISOString().split('T')[0],
      data_fine: dataFineDefault.toISOString().split('T')[0],
      num_settimane: numSettimane,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}