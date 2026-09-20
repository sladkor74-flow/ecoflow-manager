import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { fineProgrammazione } from "../../shared/fineProgrammazione.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';
import { fetchAll } from "../../shared/fetchAll.ts";
import { quoteDaStoccaggio } from "../../shared/rotteConferimenti.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { eAmministratore } from "../../shared/permessi.ts";

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
// Media reale di un viaggio di secondaria: 13,5 tonnellate.
const KG_PER_VIAGGIO = 13500;
// L'anno di lavoro e' quello in corso (giorno italiano); la fine della
// programmazione, se l'impianto non ne ha una sua, viene da
// base44/shared/fineProgrammazione.ts (il 18 dicembre vale solo per il 2026). Prima c'erano scritti "2026" e "2026-12-18": dal 19 dicembre 2026
// il modulo si sarebbe spento senza dirlo, e nel 2027 avrebbe continuato a
// leggere il 2026.
const annoRiferimento = () => Number(oggiRoma().slice(0, 4));
const dataFineDefault = () => fineProgrammazione(annoRiferimento()).data;

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
    // La pianificazione si ricalcola a ogni apertura della pagina: tutti la
    // vedono, ma solo l'amministratore la salva.
    const puoScrivere = eAmministratore(user);
    const b = base44.asServiceRole;

    const impianti = await b.entities.ImpiantoTargetSecondaria.filter({ stato: 'attivo' });
    const fornitori = await b.entities.FornitoreSecondaria.filter({ stato: 'attivo' });
    const primarie = await fetchAll(b.entities.PrimariaRete, { stato: 'terminato' });
    // Solo rete: i target degli impianti e dei raccoglitori sono della rete, e
    // l'autodemolizione non li consuma. Le secondarie ACI stanno nello stesso
    // archivio e si riconoscono dalla classe.
    const secondarie = (await fetchAll(b.entities.Secondaria, { stato: 'terminato' })).filter(r => !eAci(r));
    const existingPlans = await b.entities.PianificazioneSettimanale.list('-created_date', 5000);

    // === FONTE UNICA TARGET: TargetRaccoglitore (anno di riferimento) ===
    // Aggrega (somma) i record con stesso raccoglitore normalizzato indipendentemente
    // dalla regione, cosi' uno split regionale (es. Smoco Puglia/Calabria/Basilicata)
    // contribuisce con un unico totale al target del fornitore.
    const targetRaccogli = await b.entities.TargetRaccoglitore.filter({ anno: annoRiferimento() });
    const targetByNome = {};
    for (const t of targetRaccogli) {
      const key = normalizzaRagioneSociale(t.raccoglitore);
      if (key) targetByNome[key] = (targetByNome[key] || 0) + (t.target_tonnellate || 0) * 1000;
    }

    // === RUOLO-BASE: stoccaggi = ruolo stoccaggio o doppio_ruolo ===
    // Chi spedisce secondarie a un impianto, per quell'impianto e' uno stoccaggio,
    // qualunque cosa dica l'anagrafica. La correzione va fatta PRIMA di costruire
    // plafond e metriche, altrimenti un fornitore corretto piu' avanti si ritrova
    // senza metriche e con il piano a zero.
    const spedisceSecondarie = new Set();
    for (const r of secondarie) {
      if (statoNorm(r.stato) !== 'terminato') continue;
      if (yearOf(r.trasporto_finito_il) !== annoRiferimento()) continue;
      const o = normalizzaRagioneSociale(r.stoccaggio);
      if (o) spedisceSecondarie.add(o);
    }
    const eStoccaggio = (f) => f.ruolo === 'stoccaggio' || f.ruolo === 'doppio_ruolo'
      || (!f.ruolo && tipoNorm(f.tipo) === 'stoccaggio')
      || spedisceSecondarie.has(normalizzaRagioneSociale(f.nome));
    const stoccaggiFornitori = fornitori.filter(eStoccaggio);
    const stoccaggioNames = new Set(stoccaggiFornitori.map(f => normalizzaRagioneSociale(f.nome)));

    // Map impianti normalizzati
    const impNormMap = {};
    for (const imp of impianti) impNormMap[normalizzaRagioneSociale(imp.nome_impianto)] = imp;

    // Settimane: dal lunedì della settimana corrente fino al 18/12
    const oggi = new Date();
    const dataFine = new Date(dataFineDefault() + 'T00:00:00');
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
      if (yearOf(r.trasporto_finito_il) !== annoRiferimento()) return false;
      return true;
    });
    const sec2026 = secondarie.filter(r => {
      if (statoNorm(r.stato) !== 'terminato') return false;
      if (!r.trasporto_finito_il) return false;
      if (yearOf(r.trasporto_finito_il) !== annoRiferimento()) return false;
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
    const anomalie = [];

    // Uno stoccaggio che spedisce a piu' impianti ha un target di raccolta solo,
    // e quel target non puo' comparire per intero sotto ciascuno: Nappi Sud, con
    // 2.100 t di target, risultava avere 2.100 t di residuo sotto Irigom e altre
    // 2.100 sotto Tecnogum, cioe' il doppio di quello che deve raccogliere. Si
    // divide fra gli impianti in proporzione alle secondarie che ciascuno riceve
    // da lui, che e' il criterio deciso dalla direzione il 19/09/2026.
    const quotaTargetPerImpianto = new Map(); // "stoccaggio|impianto" -> quota
    const nomiStoccaggio = [...new Set(sec2026.map(r => String(r.stoccaggio || '').trim()).filter(Boolean))];
    for (const nome of nomiStoccaggio) {
      const q = quoteDaStoccaggio(sec2026, nome);
      if (q.impianti.length < 2) continue;
      for (const imp of q.impianti) {
        quotaTargetPerImpianto.set(normalizzaRagioneSociale(nome) + '|' + normalizzaRagioneSociale(imp.impianto), imp.quota);
      }
    }
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
        const fRuoloScritto = f.ruolo || (tipoNorm(f.tipo) === 'stoccaggio' ? 'stoccaggio' : 'raccoglitore');

        // Il ruolo scritto in anagrafica puo' non corrispondere a quello che il
        // fornitore fa davvero, e allora il consuntivo esce a zero: un raccoglitore
        // si conta sulle primarie che porta all'impianto, uno stoccaggio sulle
        // secondarie che gli spedisce. Nappi Sud e' l'una e l'altra cosa: raccoglie
        // dai punti di raccolta con un target suo e spedisce secondarie a Irigom e a
        // Tecnogum. Segnata come solo raccoglitore risultava a zero su tutti e due,
        // perche' le sue primarie le porta al proprio piazzale, non agli impianti.
        // Qui vincono i fatti, e la discordanza si segnala.
        const primDiQuesto = prim2026.filter(r => normalizzaRagioneSociale(r.trasportatore) === fNorm && normalizzaRagioneSociale(r.destinazione) === impNorm && isImp(r)).length;
        const secDiQuesto = sec2026.filter(r => normalizzaRagioneSociale(r.stoccaggio) === fNorm && normalizzaRagioneSociale(r.destinazione) === impNorm).length;
        const fRuolo = (fRuoloScritto === 'raccoglitore' && !primDiQuesto && secDiQuesto) ? 'doppio_ruolo' : fRuoloScritto;
        // (stessa regola di eStoccaggio, calcolata sopra prima delle metriche)
        if (fRuolo !== fRuoloScritto) {
          anomalie.push({
            tipo: 'ruolo_discorde',
            fornitore: f.nome,
            impianto: imp.nome_impianto,
            testo: f.nome + " e' registrato come solo raccoglitore per " + imp.nome_impianto + ", ma verso questo impianto non e' un raccoglitore: e' il produttore delle " + secDiQuesto + " secondarie che partono dal suo piazzale. Raccoglie in primaria per conto proprio, con un target suo, e conferisce al proprio sito; agli altri impianti ci arriva in secondaria. E' un doppio ruolo e come tale lo conto, altrimenti il suo consuntivo resterebbe a zero. Correggilo nella configurazione.",
          });
        }
        const isStoccaggio = fRuolo === 'stoccaggio' || fRuolo === 'doppio_ruolo';
        // Il target di un fornitore che alimenta piu' impianti si divide fra
        // loro: quello che gli appartiene una volta sola non si conta due volte.
        const targetPieno = targetByNome[fNorm] || 0;
        const quotaTarget = quotaTargetPerImpianto.get(fNorm + '|' + impNorm);
        const targetRaccoglitoreKg = quotaTarget != null ? Math.round(targetPieno * quotaTarget) : targetPieno;

        let consuntivo = 0, consuntivoPrim = 0, consuntivoSec = 0;
        let residuo = 0, residuoImpianto = null, PREV = 0, viaggiPerSett = 0;
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
          // Gli impianti da cui parte il riparto sono quelli a cui questo
          // piazzale spedisce davvero, piu' quello in corso: prendendoli dal solo
          // ruolo scritto, un fornitore corretto sui fatti restava con un
          // denominatore parziale e la quota poteva superare il 100%.
          const stocImpiantiIds = [...new Set([
            ...stoccaggiFornitori.filter(sf => normalizzaRagioneSociale(sf.nome) === fNorm).map(sf => sf.impianto_id),
            ...impianti.filter(i => sec2026.some(r => normalizzaRagioneSociale(r.stoccaggio) === fNorm && normalizzaRagioneSociale(r.destinazione) === normalizzaRagioneSociale(i.nome_impianto))).map(i => i.id),
            imp.id,
          ].filter(Boolean))];
          let sumResiduoTargetStoc = 0;
          for (const sImpId of stocImpiantiIds) {
            const sImp = impianti.find(i => i.id === sImpId);
            if (!sImp) continue;
            const sImpNorm = normalizzaRagioneSociale(sImp.nome_impianto);
            const sCons = sec2026.filter(r => normalizzaRagioneSociale(r.stoccaggio) === fNorm && normalizzaRagioneSociale(r.destinazione) === sImpNorm).reduce((s, r) => s + (r.peso_effettivo || 0), 0);
            const sRes = (sImp.target || 0) - sCons;
            if (sRes > 0) sumResiduoTargetStoc += sRes;
          }
          quotaPlafondImpianto = sumResiduoTargetStoc > 0 && resTargetImp > 0
            ? Math.min(m.residuo_plafond || 0, (m.residuo_plafond || 0) * (resTargetImp / sumResiduoTargetStoc))
            : 0;
          // Per uno stoccaggio il residuo mostrato e' sempre stato quello
          // dell'impianto: quanto manca a lui, che questo piazzale dovrebbe
          // coprire. Da quando il target di un fornitore condiviso si divide
          // fra gli impianti, quel numero accanto al target diviso non si
          // legge piu': Nappi Sud mostrava "target 1.125.993, residuo
          // 1.470.100", un residuo piu' grande del target. Quando la quota
          // c'e', il residuo e' il suo: quanto le manca da portare a questo
          // impianto. Quello dell'impianto resta, in un campo che lo dice.
          residuoImpianto = resTargetImp;
          residuo = quotaTarget != null ? Math.max(0, targetRaccoglitoreKg - consuntivoSec) : resTargetImp;
          // Il piano settimanale nasce dal residuo di questo fornitore, non da un
          // secondo riparto: con due criteri diversi il residuo mostrato e i kg a
          // settimana raccontavano due storie. Il plafond resta un tetto, non la
          // base del conto.
          baseCascata = quotaTarget != null
            ? Math.min(residuo, quotaPlafondImpianto > 0 ? quotaPlafondImpianto : residuo)
            : quotaPlafondImpianto;
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
              stato: congelata ? 'completato' : 'da_programmare', anno: annoRiferimento(), modificato_manuale: false,
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
          ...(residuoImpianto != null ? { residuo_impianto_kg: Math.round(residuoImpianto) } : {}),
          ...(quotaTarget != null ? {
            target_raccoglitore_intero_kg: targetPieno,
            quota_target: Math.round(quotaTarget * 1000) / 1000,
            nota_quota: `${f.nome} alimenta piu' di un impianto: del suo target di raccolta, ${Math.round(targetPieno / 1000)} t, a questo impianto ne compete il ${Math.round(quotaTarget * 100)}%, in proporzione alle secondarie che riceve.`,
          } : {}),
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
          totale_capacity: imp.totale_capacity_kg || 0, data_fine: imp.data_fine || dataFineDefault(),
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

    // Persistenza chunked, riservata all'amministratore
    if (puoScrivere) {
      for (let i = 0; i < creates.length; i += 100) {
        await b.entities.PianificazioneSettimanale.bulkCreate(creates.slice(i, i + 100));
        await new Promise(r => setTimeout(r, 200));
      }
      for (let i = 0; i < updates.length; i += 100) {
        await b.entities.PianificazioneSettimanale.bulkUpdate(updates.slice(i, i + 100));
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return Response.json({
      anomalie,
      impianti: result,
      stoccaggi: stoccaggiResult,
      settimane,
      data_inizio: settimane[0] ? settimane[0].data_inizio : null,
      data_fine: dataFineDefault(),
      num_settimane: settimane.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}