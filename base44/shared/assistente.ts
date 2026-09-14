// Assistente del gestionale: riconoscimento del tipo di domanda e riepilogo dei
// dati della commessa da passare al modello.
//
// Il riepilogo e' testo compatto e contiene solo dati dell'anno in corso, con le
// stesse regole del resto del gestionale: raccolto dai formulari terminati per
// data di fine trasporto, target da Target & Status.

import { fetchAll } from "./fetchAll.ts";
import { computeRaccoltoData, MESI } from "./raccoltoCalculator.ts";
import { aggregaTargetMensili, aggregaTargetAnnui } from "./targetRaccoglitori.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";

const PAROLE_DATI = [
  'target', 'raccolt', 'raccoglitor', 'giacenz', 'plafond', 'tonnellat', 'campania', 'puglia', 'basilicata',
  'calabria', 'sicilia', 'provinc', 'lista', 'liste', 'assegnat', 'evas', 'evader', 'ritir', 'fornitor',
  'qualifica', 'fattur', 'alert', 'andamento', 'contratto', 'commessa', 'destinazion', 'impiant', 'stoccagg',
  'secondari', 'terziari', 'extra raccolta', 'quanto abbiamo', 'quanti', 'quante', 'come stiamo', 'come va',
  'situazione', 'questo mese', 'mese scorso', 'settimana', 'oggi', 'in ritardo', 'scadut', 'in scadenza',
  'smoco', 'pneuservice', 'nappi', 'ecorecuperi', 'emmesse', 'gatim', 'irigom', 'tecnogum', 't-cycle', 'trs',
];

const PAROLE_NORMA = [
  'norma', 'legge', 'decreto', 'd.lgs', 'dlgs', 'd.m.', ' dm ', 'articolo', 'art.', 'obblig', 'sanzion', 'multa',
  'fir', 'formulari', 'rentri', 'albo', 'iscrizion', 'autorizzazion', 'registro', 'responsabile tecnico', ' rt ',
  'quiz', 'esame', 'idoneit', 'eer', 'cer', 'adr', 'deposito temporaneo', 'microraccolta', 'vidimaz', 'cassazion',
  'circolare', 'ministero', 'mase', 'dm 182', '152', 'consorzi', 'dipendenti', 'visura', 'durc', 'antimafia',
  'categoria', 'classe', 'garanzi', 'posso', 'devo', 'e\' obbligatorio', 'è obbligatorio', 'serve', 'bisogna',
  'si puo', 'si può', 'e\' consentito', 'è consentito', 'digitale', 'trasporto', 'rifiut',
];

/** Che cosa serve per rispondere: dati del gestionale, ricerca sulle norme o entrambi. */
export function analizzaDomanda(testo) {
  const t = ' ' + String(testo || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
  const dati = PAROLE_DATI.some(p => t.includes(p));
  const norma = PAROLE_NORMA.some(p => t.includes(p));
  // Nel dubbio si cerca sulle fonti: e' la strada che evita risposte sbagliate.
  return { dati, norma: norma || !dati, ambito: dati && norma ? 'mista' : dati ? 'operativa' : 'normativa' };
}

const t1 = (v) => (Math.round((Number(v) || 0) * 10) / 10).toLocaleString('it-IT');
const leggiLista = (json) => { try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

// Stesso raccoglitore: nome normalizzato uguale, oppure nome del target abbreviato
// le cui parole stanno tutte nel nome del portale.
function stessoRaccoglitore(nomeTarget, nomePortale) {
  const a = normalizzaRagioneSociale(nomeTarget || '');
  const b = normalizzaRagioneSociale(nomePortale || '');
  if (!a || !b) return false;
  if (a === b) return true;
  const paroleB = new Set(b.split(' '));
  const paroleA = a.split(' ').filter(p => p.length > 2);
  return paroleA.length > 0 && paroleA.every(p => paroleB.has(p));
}

async function provaA(fn, ripiego) {
  try { return await fn(); } catch (_e) { return ripiego; }
}

/**
 * Riepilogo testuale della situazione della commessa nell'anno di "oggi"
 * (formato AAAA-MM-GG, ora italiana).
 */
export async function situazioneGestionale(base44, oggi) {
  const anno = Number(oggi.slice(0, 4));
  const meseIdx = Number(oggi.slice(5, 7)) - 1;
  const mese = MESI[meseIdx];
  const svc = base44.asServiceRole.entities;

  const [raccolto, mensili, annui, commesse, controlli, alert, riepilogoQualifica, giacenze] = await Promise.all([
    provaA(() => computeRaccoltoData(base44, { anno: [anno] }), null),
    provaA(() => fetchAll(svc.TargetMensile, { anno }), []),
    provaA(() => fetchAll(svc.TargetRaccoglitore, { anno }), []),
    provaA(() => svc.CommessaEcotyre.filter({ anno }), []),
    provaA(() => fetchAll(svc.ControlloEvasione, { anno, mese: meseIdx + 1 }), []),
    provaA(() => svc.Alert.filter({ stato: 'aperto' }, '-created_date', 200), []),
    provaA(() => svc.RiepilogoQualifica.filter({ anno }, '-created_date', 1), []),
    provaA(async () => (await base44.functions.invoke('calcolaGiacenze', { anno })).data, null),
  ]);

  const righe = [`DATI DEL GESTIONALE al ${oggi} (anno ${anno}, mese in corso ${mese}). Raccolto = formulari terminati, per data di fine trasporto, in tonnellate.`];

  // --- Contratto e regioni ---
  const commessa = commesse[0] || null;
  const perRegione = new Map((raccolto?.by_regione || []).map(r => [String(r.regione).toLowerCase(), r]));
  if (commessa) {
    const profilo = leggiLista(commessa.target_mensile_json).map(v => Number(v) || 0);
    const totProfilo = profilo.reduce((s, v) => s + v, 0);
    const pesi = totProfilo > 0 ? profilo.map(v => v / totProfilo) : MESI.map(() => 1 / 12);
    const giorniMese = new Date(Date.UTC(anno, meseIdx + 1, 0)).getUTCDate();
    const quota = pesi.slice(0, meseIdx).reduce((s, v) => s + v, 0) + (pesi[meseIdx] || 0) * (Number(oggi.slice(8, 10)) / giorniMese);
    righe.push(`Contratto Ecotyre ${anno}: target annuo ${t1(commessa.target_annuo_t)} t; quota attesa a oggi ${t1(quota * 100)}% secondo il profilo mensile del contratto.`);
    for (const r of leggiLista(commessa.regioni_json)) {
      const racc = perRegione.get(String(r.regione).toLowerCase());
      const contratto = Number(r.target_t) || 0;
      const fatto = racc ? racc.totale : 0;
      righe.push(`- ${r.regione}: contratto ${t1(contratto)} t, raccolto ${t1(fatto)} t (${contratto ? t1(fatto / contratto * 100) : '-'}%), atteso a oggi ${t1(contratto * quota)} t, mese in corso ${t1(racc?.mesi?.[mese])} t.`);
    }
  } else {
    righe.push('Contratto Ecotyre dell\'anno non inserito in Target & Status.');
  }
  if (raccolto) {
    righe.push(`Raccolto totale ${anno}: ${t1(raccolto.totale_raccolto)} t. Per mese: ${MESI.slice(0, meseIdx + 1).map(m => `${m} ${t1((raccolto.by_regione || []).reduce((s, r) => s + (r.mesi?.[m] || 0), 0))}`).join(', ')}.`);
  }

  // --- Raccoglitori: target contro raccolto ---
  const annuiAgg = aggregaTargetAnnui(annui);
  const mensiliAgg = aggregaTargetMensili(mensili);
  const nomi = new Map();
  for (const r of [...annuiAgg, ...mensiliAgg]) {
    const k = normalizzaRagioneSociale(r.raccoglitore);
    if (k && !nomi.has(k)) nomi.set(k, r.raccoglitore);
  }
  if (nomi.size) {
    righe.push(`Raccoglitori (target annuo | raccolto da inizio anno | target ${mese} | raccolto ${mese}):`);
    for (const [k, nome] of [...nomi.entries()].sort((a, b) => a[1].localeCompare(b[1], 'it'))) {
      const annuo = annuiAgg.filter(r => normalizzaRagioneSociale(r.raccoglitore) === k).reduce((s, r) => s + r.target_tonnellate, 0);
      const delMese = mensili.filter(r => normalizzaRagioneSociale(r.raccoglitore) === k && r.mese === mese);
      const targetMese = delMese.filter(r => !r.non_raccoglie).reduce((s, r) => s + (Number(r.target) || 0), 0);
      const nonRaccoglie = delMese.length > 0 && delMese.every(r => r.non_raccoglie);
      const suoi = (raccolto?.by_raccoglitore || []).filter(r => stessoRaccoglitore(nome, r.raccoglitore));
      const ytd = suoi.reduce((s, r) => s + r.totale, 0);
      const meseFatto = suoi.reduce((s, r) => s + (r.mesi?.[mese] || 0), 0);
      const regioni = [...new Set(annui.filter(r => normalizzaRagioneSociale(r.raccoglitore) === k).map(r => r.regione).filter(Boolean))];
      righe.push(`- ${nome}${regioni.length ? ' (' + regioni.join(', ') + ')' : ''}: ${t1(annuo)} | ${t1(ytd)} | ${nonRaccoglie ? 'non raccoglie' : t1(targetMese)} | ${t1(meseFatto)}`);
    }
  } else {
    righe.push('Target dei raccoglitori non inseriti in Target & Status per l\'anno.');
  }

  // --- Evasione degli assegnati del mese ---
  if (controlli.length) {
    const ultimi = new Map();
    for (const c of controlli) {
      const u = ultimi.get(c.raccoglitore_chiave);
      if (!u || String(c.eseguito_il) > String(u.eseguito_il)) ultimi.set(c.raccoglitore_chiave, c);
    }
    righe.push(`Evasione delle liste di ${mese} (richieste | evase | aperte | arretrate aperte | prioritarie aperte | trascurate | alert alti):`);
    for (const c of ultimi.values()) {
      righe.push(`- ${c.raccoglitore_nome}: ${c.richieste ?? '-'} | ${c.evase ?? '-'} | ${c.aperte ?? '-'} | ${c.arretrate_aperte ?? 0} | ${c.prioritarie_aperte ?? 0} | ${c.trascurate ?? 0} | ${c.alert_alti ?? 0} (dati al ${String(c.dati_al || c.eseguito_il || '').slice(0, 10)})`);
    }
  }

  // --- Giacenze ---
  if (giacenze && Array.isArray(giacenze.righe) && giacenze.righe.length) {
    righe.push('Impianti e stoccaggi (giacenza a portale | target totale | conferito nell\'anno | % del target | residuo):');
    for (const g of giacenze.righe.slice(0, 25)) {
      righe.push(`- ${g.sito} (${g.tipo_destinazione === 'stoc' ? 'stoccaggio' : 'impianto'}): ${t1(g.giacenza_portale_t)} | ${g.target_totale_t ? t1(g.target_totale_t) : '-'} | ${t1(g.conferito_t)} | ${g.percentuale_target !== null && g.percentuale_target !== undefined ? t1(g.percentuale_target) + '%' : '-'} | ${g.residuo_t !== null && g.residuo_t !== undefined ? t1(g.residuo_t) : '-'}`);
    }
    const sopra = (giacenze.anomalie || []).filter(a => a.tipo === 'giacenza_sopra_target');
    if (sopra.length) righe.push(`Siti con giacenza sopra il target: ${sopra.map(a => a.sito).join(', ')}.`);
  }

  // --- Alert e qualifica ---
  if (alert.length) {
    const critici = alert.filter(a => a.severita === 'critico');
    righe.push(`Alert aperti: ${alert.length}, di cui critici ${critici.length}. Principali: ${[...critici, ...alert.filter(a => a.severita !== 'critico')].slice(0, 8).map(a => a.titolo).join('; ')}.`);
  }
  const rq = riepilogoQualifica[0];
  if (rq) {
    righe.push(`Qualifica fornitori ${anno}: ${rq.alert_aperti ?? 0} alert su ${rq.soggetti_con_alert ?? 0} soggetti; documenti scaduti ${rq.scaduti ?? 0}, non conformi ${rq.non_conformi ?? 0}, mancanti ${rq.mancanti ?? 0}, in scadenza ${rq.in_scadenza ?? 0}, da verificare ${rq.da_verificare ?? 0}.`);
  }

  return righe.join('\n');
}
