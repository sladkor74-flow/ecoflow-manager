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
import { formatoTonnellate } from "./formato.ts";
import { giornoRoma, annoRoma } from "./giornoItaliano.ts";
import { eTerminato, giornoMovimento } from "./movimenti.ts";
import { contaFormulari } from "./formulari.ts";

const PAROLE_DATI = [
  'target', 'raccolt', 'raccoglitor', 'giacenz', 'plafond', 'tonnellat', 'campania', 'puglia', 'basilicata',
  'calabria', 'sicilia', 'provinc', 'lista', 'liste', 'assegnat', 'evas', 'evader', 'ritir', 'fornitor',
  'qualifica', 'fattur', 'alert', 'andamento', 'contratto', 'commessa', 'destinazion', 'impiant', 'stoccagg',
  'secondari', 'terziari', 'extra raccolta', 'quanto abbiamo', 'quanti', 'quante', 'come stiamo', 'come va',
  'situazione', 'questo mese', 'mese scorso', 'settimana', 'oggi', 'in ritardo', 'scadut', 'in scadenza',
  'smoco', 'pneuservice', 'nappi', 'ecorecuperi', 'emmesse', 'gatim', 'irigom', 'tecnogum', 't-cycle', 'trs',
  'omologh', 'dichiaraz', 'scad', 'pdr', 'punto di raccolta', 'punti di raccolta', 'produttor', 'client',
  'tariff', 'viagg', 'caricat', 'caricament', 'ultimo file', 'quanto dobbiamo', 'paghiam', 'pagare', 'incassi',
  'green tyre', 'ielapi', 'silvano', 'torres', 'logistica', 'ecological', 'barone', 'minervini', 'rpn',
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

// Tonnellate con due decimali, tre se i kg non sono tondi; le percentuali a una cifra.
const t1 = (v) => formatoTonnellate(v);
const p1 = (v) => (Math.round((Number(v) || 0) * 10) / 10).toLocaleString('it-IT');
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

// Un nome del portale va a un solo raccoglitore dei target: prima per nome uguale.
function targetDelPortaleLocale(nomiTarget, nomePortale) {
  const b = normalizzaRagioneSociale(nomePortale || '');
  return nomiTarget.find(n => normalizzaRagioneSociale(n) === b) ?? nomiTarget.find(n => stessoRaccoglitore(n, nomePortale)) ?? null;
}

async function provaA(fn, ripiego) {
  try { return await fn(); } catch (_e) { return ripiego; }
}

/**
 * I terminati senza fine trasporto, di qualunque periodo: non stanno in nessun
 * mese e ogni conto li scarta, percio' si contano a parte per dirli. Prima si
 * contavano solo quelli immessi nell'anno chiesto, e sparivano proprio i casi
 * dubbi - un ordine immesso a fine dicembre e finito a gennaio, un ordine senza
 * nemmeno l'immissione - mentre Dashboard e Report Mensile li contano tutti.
 * Si dividono per anno di immissione, l'unica data che hanno (mai la chiusura a
 * portale); chi non ha nemmeno quella ha anno null. Lo usano il riepilogo qui
 * sotto e gli strumenti di EcoTyna, cosi' i due testi dicono lo stesso numero.
 * Restituisce { esclusi, per_anno: [{ anno, righe }] }, anni dal piu' recente e
 * in fondo chi non ha l'immissione.
 */
export function terminatiSenzaFine(righe) {
  const esclusi = (righe || []).filter(r => eTerminato(r) && !giornoMovimento(r));
  const perAnno = new Map();
  for (const r of esclusi) {
    const a = annoRoma(r.ordine_immesso_il);
    if (!perAnno.has(a)) perAnno.set(a, []);
    perAnno.get(a).push(r);
  }
  const per_anno = [...perAnno.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : b - a))
    .map(([anno, xs]) => ({ anno, righe: xs }));
  return { esclusi, per_anno };
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

  const [raccolto, raccoltoAci, extra, reteSenzaData, aciSenzaData, mensili, annui, commesse, controlli, alert, riepilogoQualifica, giacenze] = await Promise.all([
    provaA(() => computeRaccoltoData(base44, { anno: [anno], canale: 'rete' }), null),
    provaA(() => computeRaccoltoData(base44, { anno: [anno], canale: 'aci' }), null),
    provaA(() => fetchAll(svc.ExtraRaccolta, { stato: 'terminato' }), []),
    // Il raccolto scarta i terminati senza fine trasporto: si chiedono a parte,
    // con un filtro sul campo vuoto, per poterli dire. null se l'archivio non
    // accetta il filtro: allora il conteggio non c'e', che non vuol dire zero.
    provaA(() => fetchAll(svc.PrimariaRete, { trasporto_finito_il: null }), null),
    provaA(() => fetchAll(svc.PrimariaAci, { trasporto_finito_il: null }), null),
    provaA(() => fetchAll(svc.TargetMensile, { anno }), []),
    provaA(() => fetchAll(svc.TargetRaccoglitore, { anno }), []),
    provaA(() => svc.CommessaEcotyre.filter({ anno }), []),
    provaA(() => fetchAll(svc.ControlloEvasione, { anno, mese: meseIdx + 1 }), []),
    // Tutti gli alert aperti, non i primi duecento: il riepilogo diceva "200"
    // mentre lo strumento alert_aperti ne contava 54 o 340, e i due numeri non
    // coincidevano mai per il motivo sbagliato.
    provaA(() => fetchAll(svc.Alert, { stato: 'aperto' }), []),
    provaA(() => svc.RiepilogoQualifica.filter({ anno }, '-created_date', 1), []),
    provaA(async () => (await base44.functions.invoke('calcolaGiacenze', { anno })).data, null),
  ]);

  const righe = [
    `DATI DEL GESTIONALE al ${oggi} (anno ${anno}, mese in corso ${mese}). Raccolto = formulari terminati, per data di fine trasporto, in tonnellate.`,
    'RETE, ACI ed EXTRA RACCOLTA sono canali indipendenti: non vanno mai sommati e tutti i target (contratto, regioni, raccoglitori, impianti) riguardano solo la RETE. L\'ACI ha solo una previsione indicativa del suo contratto.',
  ];

  // --- Contratto e regioni ---
  const commessa = commesse[0] || null;
  const perRegione = new Map((raccolto?.by_regione || []).map(r => [String(r.regione).toLowerCase(), r]));
  if (commessa) {
    const profilo = leggiLista(commessa.target_mensile_json).map(v => Number(v) || 0);
    const totProfilo = profilo.reduce((s, v) => s + v, 0);
    const pesi = totProfilo > 0 ? profilo.map(v => v / totProfilo) : MESI.map(() => 1 / 12);
    const giorniMese = new Date(Date.UTC(anno, meseIdx + 1, 0)).getUTCDate();
    const quota = pesi.slice(0, meseIdx).reduce((s, v) => s + v, 0) + (pesi[meseIdx] || 0) * (Number(oggi.slice(8, 10)) / giorniMese);
    righe.push(`Contratto Ecotyre ${anno}, canale RETE: target annuo ${t1(commessa.target_annuo_t)} t; quota attesa a oggi ${p1(quota * 100)}% secondo il profilo mensile del contratto.`);
    for (const r of leggiLista(commessa.regioni_json)) {
      const racc = perRegione.get(String(r.regione).toLowerCase());
      const contratto = Number(r.target_t) || 0;
      const fatto = racc ? racc.totale : 0;
      righe.push(`- ${r.regione}: contratto ${t1(contratto)} t, raccolto ${t1(fatto)} t (${contratto ? p1(fatto / contratto * 100) : '-'}%), atteso a oggi ${t1(contratto * quota)} t, mese in corso ${t1(racc?.mesi?.[mese])} t.`);
    }
  } else {
    righe.push('Contratto Ecotyre dell\'anno non inserito in Target & Status.');
  }
  if (raccolto) {
    righe.push(`Raccolto RETE ${anno}: ${t1(raccolto.totale_raccolto)} t. Per mese: ${MESI.slice(0, meseIdx + 1).map(m => `${m} ${t1((raccolto.by_regione || []).reduce((s, r) => s + (r.mesi?.[m] || 0), 0))}`).join(', ')}.`);
  }
  if (raccoltoAci) {
    const previsione = commessa ? leggiLista(commessa.target_prezzo_regioni_json) : [];
    const perRegAci = new Map((raccoltoAci.by_regione || []).map(r => [String(r.regione).toLowerCase(), r]));
    const dettaglio = previsione.length
      ? previsione.map(p => `${p.regione} ${t1(perRegAci.get(String(p.regione).toLowerCase())?.totale)} su ${t1(p.target_t)} t a ${p1(p.prezzo)} euro/t`).join('; ')
      : (raccoltoAci.by_regione || []).map(r => `${r.regione} ${t1(r.totale)} t`).join('; ');
    righe.push(`Canale ACI ${anno} (indipendente, previsione indicativa del contratto ACI Ecotyre): raccolto ${t1(raccoltoAci.totale_raccolto)} t. Per regione, raccolto su previsione: ${dettaglio || 'nessun dato'}.`);
  }
  if (extra.length) {
    const delAnno = extra.map(r => ({ r, g: giornoRoma(r.trasporto_finito_il) })).filter(x => x.g && Number(x.g.slice(0, 4)) === anno);
    const peso = (xs) => xs.reduce((s, x) => s + (Number(x.r.peso_effettivo) || 0), 0) / 1000;
    // La raccolta dal produttore e i trasferimenti successivi stanno nello stesso
    // archivio: sommandoli, lo stesso materiale si conta due volte.
    const primarie = delAnno.filter(x => String(x.r.tipo_movimento || 'primaria').toLowerCase().trim() !== 'secondaria');
    const trasferimenti = delAnno.filter(x => String(x.r.tipo_movimento || '').toLowerCase().trim() === 'secondaria');
    righe.push(`Canale EXTRA RACCOLTA ${anno} (indipendente, senza target): terminati ${primarie.length} interventi di raccolta, ${t1(peso(primarie))} t; nel mese in corso ${t1(peso(primarie.filter(x => Number(x.g.slice(5, 7)) - 1 === meseIdx)))} t.`);
    if (trasferimenti.length) {
      righe.push(`  di cui gia' raccolti e poi trasferiti da uno stoccaggio a un impianto: ${trasferimenti.length} viaggi, ${t1(peso(trasferimenti))} t. Non si sommano alla raccolta: e' lo stesso materiale che si sposta.`);
    }
  }

  // I terminati senza fine trasporto non stanno in nessun mese: il raccolto qui
  // sopra li esclude, e va detto, altrimenti sembra completo. Si contano tutti,
  // di qualunque periodo, divisi per anno di immissione (terminatiSenzaFine).
  const esclusi = [
    ['RETE', reteSenzaData && terminatiSenzaFine(reteSenzaData)],
    ['ACI', aciSenzaData && terminatiSenzaFine(aciSenzaData)],
    ['EXTRA RACCOLTA', terminatiSenzaFine(extra.filter(r => String(r.tipo_movimento || 'primaria').toLowerCase().trim() !== 'secondaria'))],
  ].filter(([, x]) => x && x.esclusi.length);
  if (esclusi.length) {
    const nf = (xs) => { const n = contaFormulari(xs); return `${n} ${n === 1 ? 'formulario' : 'formulari'}`; };
    const perAnno = (x) => x.per_anno.map(g => `${g.anno === null ? 'senza data di immissione' : `immessi nel ${g.anno}`} ${contaFormulari(g.righe)}`).join(', ');
    righe.push(`Terminati senza data di fine trasporto, di qualunque periodo, esclusi dal raccolto qui sopra perche' non si sa in che mese cadono, un canale per volta: ${esclusi.map(([c, x]) => `${c} ${nf(x.esclusi)}, ${t1(x.esclusi.reduce((s, r) => s + (Number(r.peso_effettivo) || 0), 0) / 1000)} t (${perAnno(x)})`).join('; ')}. Vanno corretti nel file del portale e ricaricati.`);
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
    righe.push(`Raccoglitori, solo RETE (target annuo | raccolto da inizio anno | target ${mese} | raccolto ${mese}):`);
    for (const [k, nome] of [...nomi.entries()].sort((a, b) => a[1].localeCompare(b[1], 'it'))) {
      const annuo = annuiAgg.filter(r => normalizzaRagioneSociale(r.raccoglitore) === k).reduce((s, r) => s + r.target_tonnellate, 0);
      const delMese = mensili.filter(r => normalizzaRagioneSociale(r.raccoglitore) === k && r.mese === mese);
      const targetMese = delMese.filter(r => !r.non_raccoglie).reduce((s, r) => s + (Number(r.target) || 0), 0);
      const nonRaccoglie = delMese.length > 0 && delMese.every(r => r.non_raccoglie);
      const tuttiNomi = [...nomi.values()];
      const suoi = (raccolto?.by_raccoglitore || []).filter(r => stessoRaccoglitore(nome, r.raccoglitore) && targetDelPortaleLocale(tuttiNomi, r.raccoglitore) === nome);
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
  // Una colonna per canale, come le calcola il modulo Giacenze: la rete (impianti:
  // fotografia del portale aggiornata ai caricamenti; stoccaggi: rilevazione delle
  // classi 1-4 piu' i movimenti finiti dopo), l'ACI degli stoccaggi (classe 9) e
  // l'extra raccolta in piazzale, che a portale non c'e'. Con una colonna sola lo
  // stoccaggio di Irigom mostrava la classe 9 dentro la giacenza e poi di nuovo
  // "ACI a parte". Il trattino vuol dire non calcolata o non pertinente, non
  // zero, e va scritto nel testo: il modello non legge i commenti del codice, e
  // un "-" lo puo' prendere per zero. Un impianto senza il file degli ordini non
  // dichiarati ha una giacenza a zero che non e' un dato: anche li' il trattino.
  if (giacenze && Array.isArray(giacenze.righe) && giacenze.righe.length) {
    const tc = (v) => (v === null || v === undefined ? '-' : t1(v));
    const stoc = (g) => g.tipo_destinazione === 'stoc';
    const senzaFile = (g) => !stoc(g) && !(g.fotografia && g.fotografia.del);
    righe.push('Impianti e stoccaggi, un canale per colonna e mai sommati (giacenza RETE | giacenza ACI | extra raccolta in piazzale | target RETE | primarie RETE nell\'anno | % del target RETE | residuo RETE | conferito ACI nell\'anno | conferito extra raccolta nell\'anno). Il trattino vuol dire non calcolata o non pertinente, MAI zero: la giacenza di uno stoccaggio senza rilevazione del portale o di un impianto senza il file degli ordini non dichiarati (non calcolata); l\'ACI e l\'extra raccolta di un impianto, l\'extra raccolta di uno stoccaggio che nell\'anno non ne ha movimentata (non pertinente).');
    for (const g of giacenze.righe.slice(0, 25)) {
      righe.push(`- ${g.sito} (${stoc(g) ? 'stoccaggio' : 'impianto'}): ${senzaFile(g) ? '-' : tc(g.giacenza_rete_t)} | ${tc(g.giacenza_aci_t)} | ${tc(g.giacenza_extra_t)} | ${g.target_totale_t ? t1(g.target_totale_t) : '-'} | ${t1(g.conferito_primarie_t)} | ${g.percentuale_target !== null && g.percentuale_target !== undefined ? p1(g.percentuale_target) + '%' : '-'} | ${g.residuo_t !== null && g.residuo_t !== undefined ? t1(g.residuo_t) : '-'} | ${t1(g.conferito_aci_t)} | ${t1(g.conferito_extra_t)}`);
    }
    const tot = giacenze.totali || {};
    // Chi non ha il dato resta fuori dai totali: lo si dice, canale per canale,
    // altrimenti il totale sembra completo. Uno stoccaggio senza rilevazione
    // manca sia alla rete sia all'ACI.
    const senzaRilevazione = giacenze.righe.filter(g => stoc(g) && (g.giacenza_rete_t === null || g.giacenza_rete_t === undefined)).map(g => g.sito);
    const impiantiSenzaFile = giacenze.righe.filter(senzaFile).map(g => g.sito);
    const fuoriRete = [
      ...(impiantiSenzaFile.length ? [`impianti senza il file degli ordini non dichiarati: ${impiantiSenzaFile.join(', ')}`] : []),
      ...(senzaRilevazione.length ? [`stoccaggi senza rilevazione: ${senzaRilevazione.join(', ')}`] : []),
    ];
    const fuoriAci = senzaRilevazione.length ? ` (esclusi gli stoccaggi senza rilevazione: ${senzaRilevazione.join(', ')})` : '';
    righe.push(`Giacenze per canale, tre totali distinti: RETE ${t1(tot.giacenza_portale_t)} t${fuoriRete.length ? ` (esclusi ${fuoriRete.join('; ')})` : ''}; ACI negli stoccaggi ${t1(tot.giacenza_aci_t)} t${fuoriAci}; extra raccolta in piazzale ${t1(tot.giacenza_extra_t)} t.`);
    // Il confronto col target lo fa calcolaGiacenze sulla sola giacenza di rete.
    const sopra = (giacenze.anomalie || []).filter(a => a.tipo === 'giacenza_sopra_target');
    if (sopra.length) righe.push(`Siti con giacenza RETE sopra il target: ${sopra.map(a => a.sito).join(', ')}.`);
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
