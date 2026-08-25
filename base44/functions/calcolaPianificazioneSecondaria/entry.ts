import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const KG_PER_VIAGGIO = 14000;
const DATA_FINE_DEFAULT = '2026-12-18';
const PLAFOND_DEFAULT = 2227500;
const ESCLUSI_FORNITORI = ['emmesse'];

// Restituisce il lunedì della settimana ISO di una data
function getMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=dom
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function dateStr(d) { return d.toISOString().split('T')[0]; }

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const b = base44.asServiceRole;

    const impianti = await b.entities.ImpiantoTargetSecondaria.filter({ stato: 'attivo' });
    const fornitori = await b.entities.FornitoreSecondaria.filter({ stato: 'attivo' });
    const secondarie = await b.entities.Secondaria.list('-created_date', 10000);
    const existingPlans = await b.entities.PianificazioneSettimanale.list('-created_date', 5000);

    // Plafond Nappi Sud (config record)
    const plafondRec = existingPlans.find(p => p.impianto_id === '__PLAFOND_NAPPI__');
    const plafond = plafondRec && plafondRec.kg_previsti != null ? plafondRec.kg_previsti : PLAFOND_DEFAULT;

    // Genera settimane dal prossimo lunedì al 18 dicembre
    const oggi = new Date();
    const dataFine = new Date(DATA_FINE_DEFAULT + 'T00:00:00');
    let nextMonday = getMonday(oggi);
    if (nextMonday <= oggi) { nextMonday = new Date(nextMonday); nextMonday.setDate(nextMonday.getDate() + 7); }
    const settimane = [];
    let cur = new Date(nextMonday);
    let wn = 1;
    while (cur <= dataFine) {
      const ws = new Date(cur);
      const we = new Date(cur); we.setDate(we.getDate() + 6);
      if (we > dataFine) we.setTime(dataFine.getTime());
      settimane.push({ numero: wn, data_inizio: dateStr(ws), data_fine: dateStr(we), mese: MESI[ws.getMonth()] });
      cur = new Date(cur); cur.setDate(cur.getDate() + 7);
      wn++;
    }

    // Aggrega secondarie "terminato" con destinazione Tecnogum/Irigom
    const impNormMap = {};
    for (const imp of impianti) impNormMap[normalizzaRagioneSociale(imp.nome_impianto)] = imp;

    const terminati = secondarie.filter(r => {
      const stato = String(r.stato || '').toLowerCase().trim();
      if (stato !== 'terminato') return false;
      if (!r.trasporto_finito_il) return false;
      const dest = normalizzaRagioneSociale(r.destinazione);
      return !!impNormMap[dest];
    });

    // Plafond: kg partiti da stoccaggio Nappi Sud verso entrambi gli impianti
    const kgPartitiNappi = secondarie.filter(r => {
      const stato = String(r.stato || '').toLowerCase().trim();
      if (stato !== 'terminato') return false;
      const stocc = normalizzaRagioneSociale(r.stoccaggio || r.ragione_sociale);
      return stocc === 'nappi sud';
    }).reduce((s, r) => s + (r.peso_effettivo || 0), 0);
    const residuoPlafond = plafond - kgPartitiNappi;

    const result = [];
    const creates = [];
    const updates = [];

    for (const imp of impianti) {
      const impNorm = normalizzaRagioneSociale(imp.nome_impianto);
      const impRecords = terminati.filter(r => normalizzaRagioneSociale(r.destinazione) === impNorm);

      // EXEC aggregato per settimana (lunedì)
      const execByWeek = {};
      for (const r of impRecords) {
        const monday = getMonday(new Date(r.trasporto_finito_il));
        const key = dateStr(monday);
        execByWeek[key] = (execByWeek[key] || 0) + (r.peso_effettivo || 0);
      }
      const consuntivoStorico = impRecords.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
      const target = imp.target || 0;
      const residuoAggiornato = Math.max(0, target - consuntivoStorico);

      // Settimane future senza EXEC -> distribuzione costante
      const futureWeeks = settimane.filter(s => !execByWeek[s.data_inizio]);
      const kgPerSett = futureWeeks.length > 0 ? Math.round(residuoAggiornato / futureWeeks.length) : 0;
      const viaggiPerSett = Math.ceil(kgPerSett / KG_PER_VIAGGIO);

      const piano = settimane.map(s => {
        const aggregatedExec = execByWeek[s.data_inizio] || 0;
        const override = existingPlans.find(p => p.impianto_id === imp.id && p.data_inizio === s.data_inizio && p.modificato_manuale);
        const exec = override && override.kg_effettivi != null ? override.kg_effettivi : aggregatedExec;
        const congelata = exec > 0;
        let prev;
        if (override && override.kg_previsti != null) {
          prev = override.kg_previsti;
        } else if (congelata) {
          prev = exec;
        } else {
          prev = kgPerSett;
        }
        const delta = prev - exec;
        const viaggiPrev = Math.ceil(prev / KG_PER_VIAGGIO);
        const viaggiEff = exec > 0 ? Math.ceil(exec / KG_PER_VIAGGIO) : 0;

        // Upsert persist
        const existing = existingPlans.find(p => p.impianto_id === imp.id && p.data_inizio === s.data_inizio);
        if (!existing) {
          creates.push({
            impianto_id: imp.id, impianto_nome: imp.nome_impianto,
            settimana_numero: s.numero, data_inizio: s.data_inizio, data_fine: s.data_fine,
            kg_previsti: prev, kg_effettivi: exec, viaggi_previsti: viaggiPrev, viaggi_effettivi: viaggiEff,
            stato: congelata ? 'completato' : 'da_programmare', anno: 2026, modificato_manuale: false,
          });
        } else if (!existing.modificato_manuale) {
          if (existing.kg_previsti !== prev || existing.kg_effettivi !== exec || existing.viaggi_previsti !== viaggiPrev) {
            updates.push({ id: existing.id, kg_previsti: prev, kg_effettivi: exec, viaggi_previsti: viaggiPrev, viaggi_effettivi: viaggiEff, stato: congelata ? 'completato' : 'da_programmare' });
          }
        } else if (existing.kg_effettivi !== exec && override == null) {
          // override su PREV ma EXEC aggregato cambiato: aggiorna solo EXEC
          updates.push({ id: existing.id, kg_effettivi: exec, viaggi_effettivi: viaggiEff });
        }

        return { ...s, prev, exec, delta, viaggi_prev: viaggiPrev, viaggi_eff: viaggiEff, congelata, override: !!override, record_id: existing ? existing.id : null };
      });

      // Fornitori attivi per questo impianto (esclusi T-Cycle/Emmesse)
      const impFornitori = fornitori.filter(f => f.impianto_id === imp.id && !ESCLUSI_FORNITORI.includes(normalizzaRagioneSociale(f.nome)));

      result.push({
        impianto: { id: imp.id, nome: imp.nome_impianto, target, data_fine: imp.data_fine || DATA_FINE_DEFAULT },
        consuntivo: consuntivoStorico,
        residuo: residuoAggiornato,
        kg_per_settimana: kgPerSett,
        viaggi_per_settimana: viaggiPerSett,
        settimane_rimanenti: futureWeeks.length,
        totale_pianificato: piano.reduce((s, w) => s + w.prev, 0),
        piano_settimanale: piano,
        fornitori: impFornitori.map(f => ({ id: f.id, nome: f.nome, quota_target: f.quota_target || 0 })),
      });
    }

    // Persistenza a chunk
    for (let i = 0; i < creates.length; i += 100) {
      await b.entities.PianificazioneSettimanale.bulkCreate(creates.slice(i, i + 100));
      await new Promise(r => setTimeout(r, 200));
    }
    if (updates.length > 0) {
      for (let i = 0; i < updates.length; i += 100) {
        await b.entities.PianificazioneSettimanale.bulkUpdate(updates.slice(i, i + 100));
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return Response.json({
      impianti: result,
      settimane,
      data_inizio: settimane[0] ? settimane[0].data_inizio : null,
      data_fine: DATA_FINE_DEFAULT,
      num_settimane: settimane.length,
      plafond_nappi_sud: plafond,
      kg_partiti_nappi: kgPartitiNappi,
      residuo_plafond: residuoPlafond,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}