import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const KG_PER_VIAGGIO = 14000;
const DATA_FINE_DEFAULT = '2026-12-18';
const PLAFOND_DEFAULT = 2227500;
const ANNO_RIFERIMENTO = 2026;

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

function yearOf(dt) {
  if (!dt) return null;
  const d = new Date(dt);
  return d.getFullYear();
}

function statoNorm(s) { return String(s || '').toLowerCase().trim(); }

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const b = base44.asServiceRole;

    const impianti = await b.entities.ImpiantoTargetSecondaria.filter({ stato: 'attivo' });
    const fornitori = await b.entities.FornitoreSecondaria.filter({ stato: 'attivo' });
    const primarie = await b.entities.PrimariaRete.list('-created_date', 20000);
    const secondarie = await b.entities.Secondaria.list('-created_date', 20000);
    const existingPlans = await b.entities.PianificazioneSettimanale.list('-created_date', 5000);

    // Plafond Nappi Sud (config record)
    const plafondRec = existingPlans.find(p => p.impianto_id === '__PLAFOND_NAPPI__');
    const plafond = plafondRec && plafondRec.kg_previsti != null ? plafondRec.kg_previsti : PLAFOND_DEFAULT;

    // Genera settimane dal primo lunedì del mese successivo al 18 dicembre
    const oggi = new Date();
    const dataFine = new Date(DATA_FINE_DEFAULT + 'T00:00:00');
    const nextMonth = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 1);
    let firstMonday = getMonday(nextMonth);
    if (firstMonday.getTime() < nextMonth.getTime()) {
      firstMonday = new Date(firstMonday);
      firstMonday.setDate(firstMonday.getDate() + 7);
    }
    const settimane = [];
    let cur = new Date(firstMonday);
    let wn = 1;
    while (cur <= dataFine) {
      const ws = new Date(cur);
      const we = new Date(cur); we.setDate(we.getDate() + 6);
      if (we > dataFine) we.setTime(dataFine.getTime());
      settimane.push({ numero: wn, data_inizio: dateStr(ws), data_fine: dateStr(we), mese: MESI[ws.getMonth()] });
      cur = new Date(cur); cur.setDate(cur.getDate() + 7);
      wn++;
    }
    const firstPlanDate = settimane.length > 0 ? new Date(settimane[0].data_inizio + 'T00:00:00') : new Date(0);

    // Mappa impianti normalizzati
    const impNormMap = {};
    for (const imp of impianti) impNormMap[normalizzaRagioneSociale(imp.nome_impianto)] = imp;

    // Primarie terminati 2026 con destinazione = uno degli impianti
    // "Terminati" PrimariaRete: stato='terminato' (col B) E data fine trasporto presente (col AI), anno 2026
    const primTerminati = primarie.filter(r => {
      if (statoNorm(r.stato) !== 'terminato') return false;
      if (!r.trasporto_finito_il) return false;
      if (yearOf(r.trasporto_finito_il) !== ANNO_RIFERIMENTO) return false;
      return !!impNormMap[normalizzaRagioneSociale(r.destinazione)];
    });

    // Secondarie terminate 2026 con destinazione = uno degli impianti
    // "Terminati" Secondaria: stato='terminato' (col B) E data fine trasporto presente (col AF), anno 2026
    const secTerminati = secondarie.filter(r => {
      if (statoNorm(r.stato) !== 'terminato') return false;
      if (!r.trasporto_finito_il) return false;
      if (yearOf(r.trasporto_finito_il) !== ANNO_RIFERIMENTO) return false;
      return !!impNormMap[normalizzaRagioneSociale(r.destinazione)];
    });

    // Plafond Nappi Sud: kg partiti da stoccaggio Nappi Sud (secondarie 2026)
    const kgPartitiNappi = secTerminati.filter(r => normalizzaRagioneSociale(r.stoccaggio) === 'nappi sud')
      .reduce((s, r) => s + (r.peso_effettivo || 0), 0);
    const residuoPlafond = plafond - kgPartitiNappi;

    const result = [];
    const creates = [];
    const updates = [];

    for (const imp of impianti) {
      const impNorm = normalizzaRagioneSociale(imp.nome_impianto);
      const impFornitori = fornitori.filter(f => f.impianto_id === imp.id);

      const impPrim = primTerminati.filter(r => normalizzaRagioneSociale(r.destinazione) === impNorm);
    const impSec = secTerminati.filter(r => normalizzaRagioneSociale(r.destinazione) === impNorm);

      let impConsuntivo = 0, impConsuntivoPrim = 0, impConsuntivoSec = 0, impTotalePianificato = 0;
      const fornitoriResult = [];

      for (const f of impFornitori) {
        const fNorm = normalizzaRagioneSociale(f.nome);

        // Consuntivo primarie: trasportatore = fornitore, destinazione = impianto
        const fPrim = impPrim.filter(r => normalizzaRagioneSociale(r.trasportatore) === fNorm);
        const consuntivoPrim = fPrim.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
        // Consuntivo secondarie: stoccaggio = fornitore, destinazione = impianto
        const fSec = impSec.filter(r => normalizzaRagioneSociale(r.stoccaggio) === fNorm);
        const consuntivoSec = fSec.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
        const consuntivo = consuntivoPrim + consuntivoSec;

        // EXEC aggregato per settimana (lunedì) da entrambe le sorgenti (2026)
        const allF = [...fPrim, ...fSec];
        const execByWeek = {};
        for (const r of allF) {
          const monday = getMonday(new Date(r.trasporto_finito_il));
          const key = dateStr(monday);
          execByWeek[key] = (execByWeek[key] || 0) + (r.peso_effettivo || 0);
        }

        const quota = f.quota_target || 0;
        const ipotesi = f.ipotesi_mese_corrente || 0;
        const residuo = quota - consuntivo;
        const residuoDaPianificare = residuo - ipotesi;
        const nSett = settimane.length;
        const settimaneRimanenti = settimane.filter(s => !(execByWeek[s.data_inizio] > 0)).length;
        const PREV = residuoDaPianificare > 0 && nSett > 0 ? Math.round(residuoDaPianificare / nSett) : 0;
        const viaggiPerSett = Math.ceil(PREV / KG_PER_VIAGGIO);

        const piano = [];
        let cumulative = 0;
        for (const s of settimane) {
          const exec = execByWeek[s.data_inizio] || 0;
          const congelata = exec > 0;
          const override = existingPlans.find(p => p.fornitore_id === f.id && p.data_inizio === s.data_inizio && p.modificato_manuale);
          let prev;
          if (override && override.kg_previsti != null) prev = override.kg_previsti;
          else if (congelata) prev = exec;
          else prev = PREV;
          const delta = prev - exec;
          const viaggiPrev = Math.ceil(prev / KG_PER_VIAGGIO);
          const viaggiEff = exec > 0 ? Math.ceil(exec / KG_PER_VIAGGIO) : 0;
          cumulative += congelata ? exec : prev;
          const residuoCascata = residuoDaPianificare - cumulative;

          const existing = existingPlans.find(p => p.fornitore_id === f.id && p.data_inizio === s.data_inizio);
          let recordId = null;
          if (!existing) {
            creates.push({
              impianto_id: imp.id, impianto_nome: imp.nome_impianto,
              fornitore_id: f.id, fornitore_nome: f.nome,
              settimana_numero: s.numero, data_inizio: s.data_inizio, data_fine: s.data_fine,
              kg_previsti: prev, kg_effettivi: exec, viaggi_previsti: viaggiPrev, viaggi_effettivi: viaggiEff,
              stato: congelata ? 'completato' : 'da_programmare', anno: ANNO_RIFERIMENTO, modificato_manuale: false,
            });
          } else {
            recordId = existing.id;
            if (!existing.modificato_manuale) {
              if (existing.kg_previsti !== prev || existing.kg_effettivi !== exec || existing.viaggi_previsti !== viaggiPrev) {
                updates.push({ id: existing.id, kg_previsti: prev, kg_effettivi: exec, viaggi_previsti: viaggiPrev, viaggi_effettivi: viaggiEff, stato: congelata ? 'completato' : 'da_programmare' });
              }
            } else if (existing.kg_effettivi !== exec) {
              updates.push({ id: existing.id, kg_effettivi: exec, viaggi_effettivi: viaggiEff });
            }
          }

          piano.push({ ...s, prev, exec, delta, viaggi_prev: viaggiPrev, viaggi_eff: viaggiEff, congelata, override: !!override, record_id: recordId, residuo_cascata: residuoCascata });
        }

        const totalePianificato = piano.reduce((s, w) => s + w.prev, 0);
        impConsuntivo += consuntivo;
        impConsuntivoPrim += consuntivoPrim;
        impConsuntivoSec += consuntivoSec;
        impTotalePianificato += totalePianificato;

        fornitoriResult.push({
          id: f.id, nome: f.nome, quota_target: quota, ipotesi_mese_corrente: ipotesi,
          consuntivo, consuntivo_primarie: consuntivoPrim, consuntivo_secondarie: consuntivoSec,
          residuo, kg_per_settimana: PREV, viaggi_per_settimana: viaggiPerSett,
          settimane_rimanenti: settimaneRimanenti, totale_pianificato: totalePianificato,
          piano_settimanale: piano,
        });
      }

      result.push({
        impianto: { id: imp.id, nome: imp.nome_impianto, target: imp.target || 0, data_fine: imp.data_fine || DATA_FINE_DEFAULT },
        consuntivo: impConsuntivo, consuntivo_primarie: impConsuntivoPrim, consuntivo_secondarie: impConsuntivoSec,
        residuo: (imp.target || 0) - impConsuntivo,
        totale_pianificato: impTotalePianificato,
        fornitori: fornitoriResult,
      });
    }

    // Persistenza chunked
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