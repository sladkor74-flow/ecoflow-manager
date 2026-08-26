import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const KG_PER_VIAGGIO = 14000;
const DATA_FINE_DEFAULT = '2026-12-18';
const PLAFOND_DEFAULT = 2227500;
const ANNO_RIFERIMENTO = 2026;
const NAPPI_SUD_KEY = 'nappi sud';

function getMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function dateStr(d) { return d.toISOString().split('T')[0]; }
function yearOf(dt) { if (!dt) return null; const d = new Date(dt); return d.getFullYear(); }
function statoNorm(s) { return String(s || '').toLowerCase().trim(); }

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const b = base44.asServiceRole;

    const impianti = await b.entities.ImpiantoTargetSecondaria.filter({ stato: 'attivo' });
    const fornitori = await b.entities.FornitoreSecondaria.filter({ stato: 'attivo' });
    const primarie = await b.entities.PrimariaRete.filter({ stato: 'terminato' }, '-created_date', 5000);
    const secondarie = await b.entities.Secondaria.filter({ stato: 'terminato' }, '-created_date', 5000);
    const existingPlans = await b.entities.PianificazioneSettimanale.list('-created_date', 5000);

    // Plafond Nappi Sud (record speciale)
    const plafondRec = existingPlans.find(p => p.impianto_id === '__PLAFOND_NAPPI__');
    const plafond = plafondRec && plafondRec.kg_previsti != null ? plafondRec.kg_previsti : PLAFOND_DEFAULT;

    // Settimane: dal lunedì della settimana corrente fino al 18/12
    const oggi = new Date();
    const dataFine = new Date(DATA_FINE_DEFAULT + 'T00:00:00');
    let cur = getMonday(oggi);
    const settimane = [];
    let wn = 1;
    while (cur <= dataFine) {
      const ws = new Date(cur);
      const we = new Date(cur); we.setDate(we.getDate() + 6);
      if (we > dataFine) we.setTime(dataFine.getTime());
      settimane.push({ numero: wn, data_inizio: dateStr(ws), data_fine: dateStr(we), mese: MESI[ws.getMonth()] });
      cur = new Date(cur); cur.setDate(cur.getDate() + 7);
      wn++;
    }

    // Mappa impianti normalizzati
    const impNormMap = {};
    for (const imp of impianti) impNormMap[normalizzaRagioneSociale(imp.nome_impianto)] = imp;

    // Filtra record 2026 terminati con trasporto_finito_il presente
    const prim2026 = primarie.filter(r => {
      if (statoNorm(r.stato) !== 'terminato') return false;
      if (!r.trasporto_finito_il) return false;
      if (yearOf(r.trasporto_finito_il) !== ANNO_RIFERIMENTO) return false;
      return true;
    });
    const sec2026 = secondarie.filter(r => {
      if (statoNorm(r.stato) !== 'terminato') return false;
      if (!r.trasporto_finito_il) return false;
      if (yearOf(r.trasporto_finito_il) !== ANNO_RIFERIMENTO) return false;
      return true;
    });

    // === NAPPI SUD (stoccaggio) - dati globali condivisi tra impianti ===
    const isNappi = (f) => statoNorm(f.tipo) === 'stoccaggio' || normalizzaRagioneSociale(f.nome) === NAPPI_SUD_KEY;
    const nappiFornitori = fornitori.filter(isNappi);
    const nappiImpiantiIds = new Set(nappiFornitori.map(f => f.impianto_id));

    // Kg entrati in stoccaggio Nappi Sud (primarie: trasportatore=Nappi Sud, destinazione=Nappi Sud stoccaggio)
    const kgEntratiStoccaggio = prim2026
      .filter(r => normalizzaRagioneSociale(r.trasportatore) === NAPPI_SUD_KEY && normalizzaRagioneSociale(r.destinazione) === NAPPI_SUD_KEY)
      .reduce((s, r) => s + (r.peso_effettivo || 0), 0);

    // Kg partiti dallo stoccaggio Nappi Sud verso impianti (secondarie)
    const kgPartitiNappi = sec2026
      .filter(r => normalizzaRagioneSociale(r.stoccaggio) === NAPPI_SUD_KEY && impNormMap[normalizzaRagioneSociale(r.destinazione)])
      .reduce((s, r) => s + (r.peso_effettivo || 0), 0);

    const residuoPlafond = plafond - kgPartitiNappi;

    // Consuntivo secondarie uscite verso ciascun impianto Nappi Sud + residuo target
    const nappiConsuntivoPerImpianto = {};
    const nappiResiduoTargetPerImpianto = {};
    let sumResiduoTargetNappi = 0;
    for (const imp of impianti) {
      if (!nappiImpiantiIds.has(imp.id)) continue;
      const impNorm = normalizzaRagioneSociale(imp.nome_impianto);
      const cons = sec2026
        .filter(r => normalizzaRagioneSociale(r.stoccaggio) === NAPPI_SUD_KEY && normalizzaRagioneSociale(r.destinazione) === impNorm)
        .reduce((s, r) => s + (r.peso_effettivo || 0), 0);
      nappiConsuntivoPerImpianto[imp.id] = cons;
      const res = (imp.target || 0) - cons;
      nappiResiduoTargetPerImpianto[imp.id] = res;
      if (res > 0) sumResiduoTargetNappi += res;
    }

    const result = [];
    const creates = [];
    const updates = [];

    for (const imp of impianti) {
      const impNorm = normalizzaRagioneSociale(imp.nome_impianto);
      const impFornitori = fornitori.filter(f => f.impianto_id === imp.id);

      let impConsuntivo = 0, impConsuntivoPrim = 0, impConsuntivoSec = 0, impTotalePianificato = 0;
      const fornitoriResult = [];

      for (const f of impFornitori) {
        const fNorm = normalizzaRagioneSociale(f.nome);
        const isStoccaggio = isNappi(f);

        let consuntivo = 0, consuntivoPrim = 0, consuntivoSec = 0;
        let residuo = 0, PREV = 0, viaggiPerSett = 0;
        const execByWeek = {};
        let quotaPlafondImpianto = 0;
        let baseCascata = 0;

        if (isStoccaggio) {
          // Primarie non rilevanti per-impianto (globali allo stoccaggio); secondarie = uscita verso questo impianto
          consuntivoPrim = 0;
          const fSec = sec2026.filter(r => normalizzaRagioneSociale(r.stoccaggio) === NAPPI_SUD_KEY && normalizzaRagioneSociale(r.destinazione) === impNorm);
          consuntivoSec = fSec.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
          consuntivo = consuntivoSec;
          for (const r of fSec) {
            const monday = getMonday(new Date(r.trasporto_finito_il));
            const key = dateStr(monday);
            execByWeek[key] = (execByWeek[key] || 0) + (r.peso_effettivo || 0);
          }
          // Riparto plafond residuo proporzionale al residuo target di questo impianto
          const resTargetImp = nappiResiduoTargetPerImpianto[imp.id] || 0;
          quotaPlafondImpianto = sumResiduoTargetNappi > 0 && resTargetImp > 0
            ? residuoPlafond * (resTargetImp / sumResiduoTargetNappi)
            : 0;
          residuo = resTargetImp;
          baseCascata = quotaPlafondImpianto;
        } else {
          // Primaria diretta: trasportatore=fornitore, destinazione=impianto
          const fPrim = prim2026.filter(r => normalizzaRagioneSociale(r.trasportatore) === fNorm && normalizzaRagioneSociale(r.destinazione) === impNorm);
          consuntivoPrim = fPrim.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
          consuntivo = consuntivoPrim;
          for (const r of fPrim) {
            const monday = getMonday(new Date(r.trasporto_finito_il));
            const key = dateStr(monday);
            execByWeek[key] = (execByWeek[key] || 0) + (r.peso_effettivo || 0);
          }
          const ipotesi = f.ipotesi_mese_corrente || 0;
          residuo = (f.quota_target || 0) - consuntivo - ipotesi;
          baseCascata = residuo;
        }

        const nSett = settimane.length;
        const settimaneRimanenti = settimane.filter(s => !(execByWeek[s.data_inizio] > 0)).length;
        if (isStoccaggio) {
          PREV = quotaPlafondImpianto > 0 && settimaneRimanenti > 0 ? Math.round(quotaPlafondImpianto / settimaneRimanenti) : 0;
        } else {
          PREV = residuo > 0 && nSett > 0 ? Math.round(residuo / nSett) : 0;
        }
        viaggiPerSett = Math.ceil(PREV / KG_PER_VIAGGIO);

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
          const residuoCascata = baseCascata - cumulative;

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
        impConsuntivoSec += consuntivoSec;
        impConsuntivoPrim += consuntivoPrim;
        impTotalePianificato += totalePianificato;

        const fr = {
          id: f.id, nome: f.nome, tipo: isStoccaggio ? 'stoccaggio' : 'primaria_diretta',
          quota_target: f.quota_target || 0, ipotesi_mese_corrente: f.ipotesi_mese_corrente || 0,
          consuntivo, consuntivo_primarie: consuntivoPrim, consuntivo_secondarie: consuntivoSec,
          residuo, kg_per_settimana: PREV, viaggi_per_settimana: viaggiPerSett,
          settimane_rimanenti: settimaneRimanenti, totale_pianificato: totalePianificato,
          piano_settimanale: piano,
        };
        if (isStoccaggio) {
          fr.plafond = plafond;
          fr.kg_entrati_stoccaggio = kgEntratiStoccaggio;
          fr.residuo_plafond = residuoPlafond;
          fr.quota_plafond_impianto = Math.round(quotaPlafondImpianto);
        }
        fornitoriResult.push(fr);
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
      kg_entrati_stoccaggio: kgEntratiStoccaggio,
      residuo_plafond: residuoPlafond,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}