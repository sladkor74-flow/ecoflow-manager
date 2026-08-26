import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const KG_PER_VIAGGIO = 14000;
const DATA_FINE_DEFAULT = '2026-12-18';
const ANNO_RIFERIMENTO = 2026;

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
function tipoNorm(s) { return String(s || '').toLowerCase().trim(); }

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

    // === FONTE UNICA TARGET: TargetRaccoglitore (anno di riferimento) ===
    const targetRaccogli = await b.entities.TargetRaccoglitore.filter({ anno: ANNO_RIFERIMENTO });
    const targetByNome = {};
    for (const t of targetRaccogli) {
      const key = normalizzaRagioneSociale(t.raccoglitore);
      if (key) targetByNome[key] = (t.target_tonnellate || 0) * 1000;
    }

    // === RUOLO-BASE: stoccaggi = ruolo stoccaggio o doppio_ruolo ===
    const stoccaggiFornitori = fornitori.filter(f => f.ruolo === 'stoccaggio' || f.ruolo === 'doppio_ruolo' || (!f.ruolo && tipoNorm(f.tipo) === 'stoccaggio'));
    const stoccaggioNames = new Set(stoccaggiFornitori.map(f => normalizzaRagioneSociale(f.nome)));

    // Map impianti normalizzati
    const impNormMap = {};
    for (const imp of impianti) impNormMap[normalizzaRagioneSociale(imp.nome_impianto)] = imp;

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

    // Helper: is primaria stoc (con fallback per record storici senza tipo_destinazione)
    const isStoc = (r) => {
      if (r.tipo_destinazione) return statoNorm(r.tipo_destinazione) === 'stoc';
      return stoccaggioNames.has(normalizzaRagioneSociale(r.destinazione));
    };
    const isImp = (r) => !isStoc(r);

    // === METRICHE STOCCAGGI GENERALIZZATE ===
    const stoccaggiMetriche = {}; // stocNorm -> metriche
    for (const s of stoccaggiFornitori) {
      const sNorm = normalizzaRagioneSociale(s.nome);
      if (!stoccaggiMetriche[sNorm]) {
        const plafond = s.plafond_stoccaggio_kg && s.plafond_stoccaggio_kg > 0 ? s.plafond_stoccaggio_kg : (targetByNome[sNorm] || 0);
        const kgEntrati = prim2026
          .filter(r => normalizzaRagioneSociale(r.destinazione) === sNorm && isStoc(r))
          .reduce((sum, r) => sum + (r.peso_effettivo || 0), 0);
        const kgPartiti = sec2026
          .filter(r => normalizzaRagioneSociale(r.stoccaggio) === sNorm && impNormMap[normalizzaRagioneSociale(r.destinazione)])
          .reduce((sum, r) => sum + (r.peso_effettivo || 0), 0);
        stoccaggiMetriche[sNorm] = {
          nome: s.nome, plafond, kg_entrati: kgEntrati, kg_partiti: kgPartiti,
          residuo_plafond: plafond - kgPartiti,
        };
      }
    }

    // === RILEVAMENTO DOPPIO RUOLO (basato su ruolo + match nome) ===
    // Un impianto e' doppio ruolo se il suo nome normalizzato coincide con un
    // FornitoreSecondaria con ruolo=doppio_ruolo (es. T-CYCLE impianto = T-CYCLE fornitore)
    const doubleRoleNames = new Set(
      fornitori.filter(f => f.ruolo === 'doppio_ruolo').map(f => normalizzaRagioneSociale(f.nome))
    );
    const doubleRoleImpianti = new Set();
    for (const imp of impianti) {
      const impNorm = normalizzaRagioneSociale(imp.nome_impianto);
      if (doubleRoleNames.has(impNorm) || stoccaggioNames.has(impNorm)) doubleRoleImpianti.add(imp.id);
    }

    const result = [];
    const creates = [];
    const updates = [];
    const stoccaggiResult = [];

    // Build stoccaggi result array
    for (const sNorm of Object.keys(stoccaggiMetriche)) {
      const m = stoccaggiMetriche[sNorm];
      stoccaggiResult.push({
        nome: m.nome, nome_normalizzato: sNorm,
        plafond: m.plafond, kg_entrati: m.kg_entrati, kg_partiti: m.kg_partiti,
        residuo_plafond: m.residuo_plafond,
        impianti_collegati: stoccaggiFornitori.filter(f => normalizzaRagioneSociale(f.nome) === sNorm).map(f => f.impianto_nome),
      });
    }

    for (const imp of impianti) {
      const impNorm = normalizzaRagioneSociale(imp.nome_impianto);
      const impFornitori = fornitori.filter(f => f.impianto_id === imp.id);
      const isDoubleRole = doubleRoleImpianti.has(imp.id);

      let impConsuntivo = 0, impConsuntivoPrim = 0, impConsuntivoSec = 0, impTotalePianificato = 0;
      const fornitoriResult = [];
      let conferitoriResult = [];

      // === DOPPIO RUOLO: scoperta conferitori dinamica ===
      if (isDoubleRole) {
        // Consuntivo impianto: primarie imp + secondarie ricevute (escluso self-stoccaggio)
        const primImp = prim2026.filter(r => normalizzaRagioneSociale(r.destinazione) === impNorm && isImp(r));
        const secRicevute = sec2026.filter(r => normalizzaRagioneSociale(r.destinazione) === impNorm && normalizzaRagioneSociale(r.stoccaggio) !== impNorm);
        impConsuntivoPrim = primImp.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
        impConsuntivoSec = secRicevute.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
        impConsuntivo = impConsuntivoPrim + impConsuntivoSec;

        // Scoperta conferitori non configurati
        const configuredNorms = new Set(impFornitori.map(f => normalizzaRagioneSociale(f.nome)));
        const conferitoriMap = {};
        for (const r of primImp) {
          const cNorm = normalizzaRagioneSociale(r.trasportatore);
          if (!cNorm || configuredNorms.has(cNorm)) continue;
          if (!conferitoriMap[cNorm]) conferitoriMap[cNorm] = { nome: r.trasportatore, consuntivo: 0, record: [] };
          conferitoriMap[cNorm].consuntivo += (r.peso_effettivo || 0);
          conferitoriMap[cNorm].record.push(r);
        }

        const nSett = settimane.length;
        for (const cNorm of Object.keys(conferitoriMap)) {
          const c = conferitoriMap[cNorm];
          const targetConf = targetByNome[cNorm] || 0;
          const residuoConf = targetConf - c.consuntivo;
          const PREV = residuoConf > 0 && nSett > 0 ? Math.round(residuoConf / nSett) : 0;
          const viaggiPerSett = Math.ceil(PREV / KG_PER_VIAGGIO);

          const execByWeek = {};
          for (const r of c.record) {
            const monday = getMonday(new Date(r.trasporto_finito_il));
            const key = dateStr(monday);
            execByWeek[key] = (execByWeek[key] || 0) + (r.peso_effettivo || 0);
          }

          const piano = [];
          for (const s of settimane) {
            const exec = execByWeek[s.data_inizio] || 0;
            const congelata = exec > 0;
            const prev = congelata ? exec : PREV;
            const delta = prev - exec;
            const viaggiPrev = Math.ceil(prev / KG_PER_VIAGGIO);
            const viaggiEff = exec > 0 ? Math.ceil(exec / KG_PER_VIAGGIO) : 0;
            piano.push({ ...s, prev, exec, delta, viaggi_prev: viaggiPrev, viaggi_eff: viaggiEff, congelata });
          }
          const totalePianificato = piano.reduce((s, w) => s + w.prev, 0);
          impTotalePianificato += totalePianificato;

          conferitoriResult.push({
            id: 'auto_' + cNorm, nome: c.nome, tipo: 'primaria_diretta',
            target_raccoglitore_kg: targetConf, consuntivo: c.consuntivo,
            residuo: residuoConf, kg_per_settimana: PREV, viaggi_per_settimana: viaggiPerSett,
            totale_pianificato: totalePianificato, piano_settimanale: piano,
            scoperto_automaticamente: true,
          });
        }
      }

      // === FORNITORI CONFIGURATI (logica generalizzata) ===
      for (const f of impFornitori) {
        const fNorm = normalizzaRagioneSociale(f.nome);
        const fRuolo = f.ruolo || (tipoNorm(f.tipo) === 'stoccaggio' ? 'stoccaggio' : 'raccoglitore');
        const isStoccaggio = fRuolo === 'stoccaggio' || fRuolo === 'doppio_ruolo';
        const targetRaccoglitoreKg = targetByNome[fNorm] || 0;

        let consuntivo = 0, consuntivoPrim = 0, consuntivoSec = 0;
        let residuo = 0, PREV = 0, viaggiPerSett = 0;
        const execByWeek = {};
        let quotaPlafondImpianto = 0;
        let baseCascata = 0;
        let plafondUsato = 0;

        if (isStoccaggio) {
          const m = stoccaggiMetriche[fNorm] || {};
          plafondUsato = m.plafond || (f.plafond_stoccaggio_kg && f.plafond_stoccaggio_kg > 0 ? f.plafond_stoccaggio_kg : targetRaccoglitoreKg);
          const fSec = sec2026.filter(r => normalizzaRagioneSociale(r.stoccaggio) === fNorm && normalizzaRagioneSociale(r.destinazione) === impNorm);
          consuntivoSec = fSec.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
          consuntivo = consuntivoSec;
          for (const r of fSec) {
            const monday = getMonday(new Date(r.trasporto_finito_il));
            const key = dateStr(monday);
            execByWeek[key] = (execByWeek[key] || 0) + (r.peso_effettivo || 0);
          }
          // Riparto plafond residuo proporzionale al residuo target di questo impianto
          const resTargetImp = (imp.target || 0) - consuntivoSec;
          const stocImpiantiIds = stoccaggiFornitori.filter(sf => normalizzaRagioneSociale(sf.nome) === fNorm).map(sf => sf.impianto_id);
          let sumResiduoTargetStoc = 0;
          for (const sImpId of stocImpiantiIds) {
            const sImp = impianti.find(i => i.id === sImpId);
            if (!sImp) continue;
            const sImpNorm = normalizzaRagioneSociale(sImp.nome_impianto);
            const sCons = sec2026.filter(r => normalizzaRagioneSociale(r.stoccaggio) === fNorm && normalizzaRagioneSociale(r.destinazione) === sImpNorm).reduce((s, r) => s + (r.peso_effettivo || 0), 0);
            const sRes = (sImp.target || 0) - sCons;
            if (sRes > 0) sumResiduoTargetStoc += sRes;
          }
          quotaPlafondImpianto = sumResiduoTargetStoc > 0 && resTargetImp > 0 ? (m.residuo_plafond || 0) * (resTargetImp / sumResiduoTargetStoc) : 0;
          residuo = resTargetImp;
          baseCascata = quotaPlafondImpianto;
        } else {
          const fPrim = prim2026.filter(r => normalizzaRagioneSociale(r.trasportatore) === fNorm && normalizzaRagioneSociale(r.destinazione) === impNorm && isImp(r));
          consuntivoPrim = fPrim.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
          consuntivo = consuntivoPrim;
          for (const r of fPrim) {
            const monday = getMonday(new Date(r.trasporto_finito_il));
            const key = dateStr(monday);
            execByWeek[key] = (execByWeek[key] || 0) + (r.peso_effettivo || 0);
          }
          const ipotesi = f.ipotesi_mese_corrente || 0;
          residuo = targetRaccoglitoreKg - consuntivo - ipotesi;
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
        if (!isDoubleRole) {
          impConsuntivo += consuntivo;
          impConsuntivoSec += consuntivoSec;
          impConsuntivoPrim += consuntivoPrim;
        }
        impTotalePianificato += totalePianificato;

        const fr = {
          id: f.id, nome: f.nome, ruolo: fRuolo, tipo: isStoccaggio ? 'stoccaggio' : 'primaria_diretta',
          target_raccoglitore_kg: targetRaccoglitoreKg,
          quota_target_deprecato: f.quota_target || 0,
          ipotesi_mese_corrente: f.ipotesi_mese_corrente || 0,
          consuntivo, consuntivo_primarie: consuntivoPrim, consuntivo_secondarie: consuntivoSec,
          residuo, kg_per_settimana: PREV, viaggi_per_settimana: viaggiPerSett,
          settimane_rimanenti: settimaneRimanenti, totale_pianificato: totalePianificato,
          piano_settimanale: piano,
        };
        if (isStoccaggio) {
          fr.plafond = plafondUsato;
          fr.kg_entrati_stoccaggio = stoccaggiMetriche[fNorm]?.kg_entrati || 0;
          fr.residuo_plafond = stoccaggiMetriche[fNorm]?.residuo_plafond || 0;
          fr.quota_plafond_impianto = Math.round(quotaPlafondImpianto);
        }
        fornitoriResult.push(fr);
      }

      result.push({
        impianto: {
          id: imp.id, nome: imp.nome_impianto, target: imp.target || 0,
          totale_capacity: imp.totale_capacity_kg || 0, data_fine: imp.data_fine || DATA_FINE_DEFAULT,
          is_double_role: isDoubleRole,
        },
        consuntivo: impConsuntivo,
        consuntivo_primarie: impConsuntivoPrim, consuntivo_secondarie: impConsuntivoSec,
        residuo: (imp.target || 0) - impConsuntivo,
        totale_pianificato: impTotalePianificato,
        fornitori: fornitoriResult,
        conferitori: conferitoriResult,
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
      stoccaggi: stoccaggiResult,
      settimane,
      data_inizio: settimane[0] ? settimane[0].data_inizio : null,
      data_fine: DATA_FINE_DEFAULT,
      num_settimane: settimane.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}