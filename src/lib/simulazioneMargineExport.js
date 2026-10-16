// IL PDF E L'EXCEL DELLA SIMULAZIONE DEL MARGINE, PER IL CEO DI SMOCO (16/10/2026).
//
// L'utente, 16/10/2026: la simulazione del margine col costo €/t di SMOCO come
// raccoglitore, scritto a mano, «anche per darne evidenza al CEO della Smoco».
// Qui i due file che si mostrano, nella veste dei documenti che escono (il
// report settimanale, il riepilogo della settimana): il PDF passa da
// esportaSezioniPdf (src/lib/esportaTabella.js, che EsportaPdf carica al clic)
// e l'Excel dal corredo exceljs di src/lib/fogliProfessionali.js, mai SheetJS.
//
// LE REGOLE DEI DUE FILE:
// - «SIMULAZIONE» si vede subito e su ogni pagina: nel titolo, nella riga in
//   alto della fascia (che il PDF ridisegna a ogni pagina) insieme al giorno e
//   a «NON ENTRA NELLA FATTURAZIONE», e nel sottotitolo i parametri usati.
//   Nell'Excel il titolo entra anche nel piede di stampa, e la prima riga dopo
//   il blocco di testa e' la frase della simulazione, in evidenza.
// - Nessun conto qui: i numeri e le frasi sono quelli della regola
//   (src/lib/simulazioneMargine.js), gli stessi della sezione a video. Il
//   margine a costi diversi arriva gia' fatto dalla sezione (costi_diversi di
//   ogni canale, margineACostiDiversi sul canale del margine).
// - Rete, ACI ed Extra raccolta hanno ciascuno le sue tabelle e il suo
//   riquadro: nessuna riga e nessun riquadro li somma. La riga «Anno» e'
//   l'anno di un canale.
// - Un valore che manca e' «—» nel PDF e una cella vuota nell'Excel, mai 0.
// - Nel PDF ogni testo sta nei caratteri dei font standard (perIlPdf: il meno
//   e' «-»), e nessuna cella perde la coda oltre le tre righe (pezziDellaCella):
//   titolo, intestazione, sottotitolo e titoli delle sezioni non passano dalla
//   pulizia del corredo, quindi si puliscono qui.
// - perIlPdf e pezziDellaCella stanno nella libreria del riepilogo della
//   settimana, che nessun file importa in testa: la si prende al clic, dentro
//   argomentiSimulazionePdf, che per questo e' asincrona (chiusura del giro del
//   16/10/2026: l'import in testa faceva fallire prove/riepilogoSettimanale.mjs,
//   sezione 5). Chi la chiama la aspetta: EsportaPdf fa l'await di `sezioni`.
// - L'unica lettura e' quella del «dati fino al» (datiFinoAl), al clic, una
//   per file, come per ogni documento che esce; con lo stato gia' letto
//   (opzioni.stato) non si legge niente.
import { nuovaCartella, foglioDaRighe, foglioNote, documentoDa, leggiStatoDati, scaricaCartella, testoGiorno, FORMATI, ENTE } from '@/lib/fogliProfessionali';
import { oggiRoma } from '@/lib/giornoItaliano';
import { formatTonnellate, formatPercentuale } from '@/lib/utils';
import { FRASE_SIMULAZIONE, testoParametri, testoPeriodo, scriviEuro, scriviEuroT, CANALI_SIMULAZIONE, NOMI_SIMULAZIONE } from '@/lib/simulazioneMargine';

/** Gli archivi che il margine legge: il «dati fino al» dei due file. */
export const ENTITA_SIMULAZIONE = ['PrimariaRete', 'PrimariaAci', 'Secondaria', 'ExtraRaccolta'];

const vuoto = (v) => v === null || v === undefined;
const tTesto = (v) => (vuoto(v) ? '—' : `${formatTonnellate(v)} t`);
const euroTesto = (v) => (vuoto(v) ? '—' : `${scriviEuro(v)} €`);
const pctTesto = (v) => (vuoto(v) ? '—' : `${formatPercentuale(v)}%`);
const costoTesto = (v) => (vuoto(v) ? 'non scritto' : scriviEuroT(v));
const giornoDi = (oggi) => testoGiorno(oggi || oggiRoma());
// «il 16/10/2026», ma «l'08/10/2026» e «l'11/10/2026»: si legge «otto», «undici».
const ilGiorno = (g) => (/^(08|11)\//.test(g) ? `l'${g}` : `il ${g}`);

/** La riga in alto della fascia, su ogni pagina del PDF e sotto il titolo dell'Excel. */
export function intestazioneSimulazione(oggi) {
  return `SIMULAZIONE DEL ${giornoDi(oggi)}  ·  NON ENTRA NELLA FATTURAZIONE  ·  ${ENTE}`;
}

const titoloDelPdf = (sim) => `SIMULAZIONE — Margine ${sim.anno}, costo SMOCO raccoglitore`;
const titoloDelFoglio = (sim, c) => `SIMULAZIONE — Margine ${c.nome} ${sim.anno}, costo SMOCO ${costoTesto(c.euro_t)}`;

// Il nome del file: «SIMULAZIONE» in testa, i costi usati, il giorno. Senza i
// segni che il sistema dei file rifiuta (la barra di «€/t»).
function nomeDelFile(sim, oggi) {
  const p = sim.parametri || {};
  const valori = CANALI_SIMULAZIONE.map(k => p[k]);
  const uguali = !vuoto(valori[0]) && valori.every(v => v === valori[0]);
  const costo = uguali
    ? `${scriviEuro(valori[0])} euro a t`
    : `${CANALI_SIMULAZIONE.map(k => `${NOMI_SIMULAZIONE[k]} ${vuoto(p[k]) ? 'non scritto' : scriviEuro(p[k])}`).join(', ')} (euro a t)`;
  return `SIMULAZIONE margine ${sim.anno} - costo SMOCO ${costo} - ${giornoDi(oggi).replace(/\//g, '-')}`
    .replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
}

// ─── LE TABELLE DI UN CANALE, LE STESSE PER IL PDF E PER L'EXCEL ───
// tipo: 't' (tonnellate), 'euro', 'euroT' (euro per tonnellata), 'percentuale',
// o nessuno (testo). Il PDF scrive gli €/t con la loro unita' («46,83 €/t»),
// l'Excel scrive il numero col formato del titolo.

const COLONNE_MESI = [
  { titolo: 'Mese', peso: 1.2, valore: p => p.mese },
  { titolo: 'Raccolte da SMOCO (t)', tipo: 't', valore: p => p.tonnellate_smoco },
  { titolo: 'Costo simulato (€)', tipo: 'euro', valore: p => p.costo_simulato },
  { titolo: 'Margine vero (€)', tipo: 'euro', valore: p => p.margine_vero },
  { titolo: 'Margine simulato (€)', tipo: 'euro', valore: p => p.margine_simulato },
  { titolo: 'Margine simulato (%)', tipo: 'percentuale', peso: 0.9, valore: p => p.margine_simulato_pct },
  { titolo: 'Margine simulato (€/t)', tipo: 'euroT', valore: p => p.margine_simulato_t },
  { titolo: 'Raccoglitori esterni (€/t)', tipo: 'euroT', valore: p => p.euro_t_esterni },
  { titolo: 'Nota', peso: 2.6, valore: p => p.perche || '' },
];

const COLONNE_COSTI = [
  { titolo: 'Costo di SMOCO (€/t)', tipo: 'euroT', peso: 1.2, valore: r => r.euro_t },
  { titolo: 'Che cosa è', peso: 2.4, valore: r => r.etichetta || '' },
  { titolo: 'Costo simulato (€)', tipo: 'euro', valore: r => r.costo_simulato },
  { titolo: 'Margine simulato (€)', tipo: 'euro', valore: r => r.margine_simulato },
  { titolo: 'Margine simulato (%)', tipo: 'percentuale', valore: r => r.margine_simulato_pct },
];

const COLONNE_ESTERNI = [
  { titolo: 'Raccoglitore', peso: 3, valore: e => e.fornitore },
  { titolo: 'Tonnellate (t)', tipo: 't', valore: e => e.tonnellate },
  { titolo: 'Importo (€)', tipo: 'euro', valore: e => e.euro },
  { titolo: 'Media (€/t)', tipo: 'euroT', valore: e => e.euro_t },
];

/**
 * Pareggio e confronto di un canale, voce per voce: il valore (numero o null)
 * con la sua unita' e la nota. Le note sono le frasi della regola.
 */
function vociDelCanale(c) {
  const a = c.anno || {};
  const p = c.pareggio || {};
  const k = c.confronto || {};
  const senzaCosto = vuoto(c.euro_t);
  return [
    { voce: 'Costo di SMOCO, scritto a mano', valore: c.euro_t, unita: '€/t', nota: senzaCosto ? 'non scritto: costo e margine simulati sono «—»' : 'il parametro della simulazione' },
    { voce: 'Tonnellate raccolte da SMOCO', valore: a.tonnellate_smoco, unita: 't', nota: `su ${tTesto(a.tonnellate)} del canale` },
    { voce: 'Costo simulato', valore: a.costo_simulato, unita: '€', nota: senzaCosto ? '' : `tonnellate di SMOCO per ${scriviEuroT(c.euro_t)}, mese per mese` },
    { voce: 'Margine vero', valore: a.margine_vero, unita: '€', nota: vuoto(a.margine_vero) ? (a.perche || '') : `${pctTesto(a.margine_vero_pct)} del ricavo, con la raccolta di SMOCO a costo zero` },
    { voce: 'Margine simulato', valore: a.margine_simulato, unita: '€', nota: vuoto(a.margine_simulato) ? (a.perche || 'serve il costo €/t di SMOCO') : `${pctTesto(a.margine_simulato_pct)} del ricavo, ${scriviEuroT(a.margine_simulato_t)}` },
    { voce: 'Costo di pareggio', valore: p.euro_t, unita: '€/t', nota: p.testo || '' },
    { voce: 'Media dei raccoglitori esterni', valore: k.euro_t_esterni, unita: '€/t', nota: vuoto(k.euro_t_esterni) ? (k.testo || '') : `su ${tTesto(k.tonnellate_esterni)}, alle tariffe di contratto` },
    { voce: 'SMOCO rispetto alla media', valore: k.scarto_euro_t, unita: '€/t', nota: vuoto(k.euro_t_esterni) ? '' : (k.testo || '') },
    { voce: 'Risparmio raccogliendo da sé', valore: k.differenza_affidando, unita: '€', nota: vuoto(k.differenza_affidando) ? '' : 'sulle tonnellate di SMOCO, rispetto alla media degli esterni: negativo vuol dire che affidare costerebbe meno' },
    { voce: 'Margine se SMOCO costasse la media', valore: k.margine_alla_media, unita: '€', nota: '' },
  ];
}

const testoDellaVoce = (x) => {
  if (vuoto(x.valore)) return '—';
  if (x.unita === 't') return tTesto(x.valore);
  if (x.unita === '€/t') return scriviEuroT(x.valore);
  return euroTesto(x.valore);
};

const titoliSezioni = (sim, c) => ({
  mesi: `${c.nome} — mese per mese, con SMOCO a ${costoTesto(c.euro_t)}`,
  voci: `${c.nome} — pareggio e confronto con i raccoglitori esterni`,
  costi: `${c.nome} — il margine dell'anno a costi diversi di SMOCO`,
  esterni: `${c.nome} — i raccoglitori esterni di ${testoPeriodo(sim)}, alle tariffe di contratto`,
});

/** Le note dei due file: la frase, i parametri, il giorno del margine, come si leggono, le note dei canali. */
function noteDellaSimulazione(sim, oggi) {
  const calcolato = sim.calcolato_il ? testoGiorno(sim.calcolato_il) : '';
  return [
    FRASE_SIMULAZIONE,
    `Parametri della simulazione: ${testoParametri(sim.parametri)}, scritti a mano ${ilGiorno(giornoDi(oggi))}. È il costo di SMOCO come raccoglitore, coi costi diretti e indiretti che valuta un altro ufficio: il gestionale non lo ha.`,
    `Il margine vero è quello della scheda Margine${calcolato ? `, calcolato ${ilGiorno(calcolato)}` : ''}: ricavo della fatturazione attiva verso Ecotyre meno costo della passiva dei fornitori, per fine trasporto. Lì la raccolta che SMOCO fa coi suoi mezzi costa zero, perché a se stessi non si fattura.`,
    'Costo simulato: le tonnellate raccolte da SMOCO nel mese per il costo €/t scritto, arrotondato al centesimo mese per mese; quello dell\'anno è la somma dei mesi. Margine simulato: il margine vero meno il costo simulato; la percentuale è sul ricavo, gli €/t sulle tonnellate del canale.',
    'Costo di pareggio: il costo €/t di SMOCO più alto, al centesimo, a cui il margine simulato dell\'anno non va sotto zero. Non dipende dal costo scritto.',
    'Confronto con i raccoglitori esterni: quanto si paga in media per tonnellata ai raccoglitori esterni dello stesso canale e dello stesso periodo, alle tariffe di contratto. Se SMOCO costa meno della media, raccogliere da sé conviene; se costa di più, conviene affidare.',
    'Rete, ACI ed Extra raccolta sono tre commesse: tre simulazioni, e nessuna tabella o riquadro le somma.',
    'Un valore che manca è scritto «—», mai zero: un mese col margine vero «—» (prezzi mancanti) resta «—» anche simulato, col perché nella nota del mese.',
    ...sim.canali.flatMap(c => (c.note || []).map(n => `${c.nome}: ${n}`)),
  ];
}

// ─── IL PDF ───

// Le larghezze delle colonne come le divide esportaSezioniPdf (A4 orizzontale,
// 10 mm di margine per lato), meno i 3 mm della cella.
const larghezzeColonne = (colonne) => {
  const totale = colonne.reduce((s, c) => s + (c.peso || 1), 0);
  return colonne.map(c => ((297 - 20) * (c.peso || 1)) / totale - 3);
};

// T, in queste funzioni, e' la libreria del riepilogo presa al clic (perIlPdf,
// pezziDellaCella): vedi argomentiSimulazionePdf.
// La colonna per esportaSezioniPdf: gli €/t sono testi gia' scritti, allineati
// a destra come gli euro.
const colonnaPdf = (T, c) => ({ titolo: T.perIlPdf(c.titolo), peso: c.peso, ...(c.tipo ? { tipo: c.tipo === 'euroT' ? 'euro' : c.tipo } : {}) });
const cellaPdf = (T, c, v) => {
  if (vuoto(v) || (c.tipo && v === '')) return c.tipo ? '—' : '';
  if (c.tipo === 'euroT') return scriviEuroT(v);
  return typeof v === 'string' ? T.perIlPdf(v) : v;
};

/** Una sezione del PDF: testi scrivibili, e una cella oltre le tre righe continua nelle righe sotto. */
function sezionePdf(T, titolo, colonne, righe) {
  const cols = colonne.map(c => colonnaPdf(T, c));
  const larghezze = larghezzeColonne(cols);
  return {
    titolo: T.perIlPdf(titolo),
    colonne: cols,
    righe: righe.flatMap(r => {
      const pezzi = r.celle.map((v, i) => (typeof v === 'string' && v && !cols[i].tipo ? T.pezziDellaCella(v, larghezze[i]) : [v]));
      const quante = Math.max(1, ...pezzi.map(p => p.length));
      return Array.from({ length: quante }, (_, k) => ({ ...r, celle: pezzi.map(p => (k < p.length ? p[k] : '')) }));
    }),
  };
}

const righeDi = (T, colonne, elementi, stile) => elementi.map(x => ({ ...(stile ? { stile } : {}), celle: colonne.map(c => cellaPdf(T, c, c.valore(x))) }));

/**
 * Gli argomenti di esportaSezioniPdf per la simulazione. sim: quella di
 * simulaMargine, con costi_diversi in ogni canale (la sezione li aggiunge);
 * oggi: il giorno italiano 'AAAA-MM-GG'; stato: lo stato dei dati gia' letto
 * (senza, esportaSezioniPdf lo chiede per ENTITA_SIMULAZIONE).
 * Asincrona: prende al clic la libreria del riepilogo (vedi la testa del file).
 */
export async function argomentiSimulazionePdf(sim, { oggi, stato } = {}) {
  if (!sim || !Array.isArray(sim.canali)) return null;
  const T = await import('@/lib/riepilogoSettimanale');
  const { perIlPdf } = T;
  const sezioni = [];
  for (const c of sim.canali) {
    const t = titoliSezioni(sim, c);
    sezioni.push(sezionePdf(T, t.mesi, COLONNE_MESI, [...righeDi(T, COLONNE_MESI, c.mesi || []), ...righeDi(T, COLONNE_MESI, [c.anno], 'totale')]));
    sezioni.push(sezionePdf(T, t.voci, [{ titolo: 'Voce', peso: 2.2 }, { titolo: 'Valore', peso: 1.4 }, { titolo: 'Nota', peso: 5 }],
      vociDelCanale(c).map(x => ({ celle: [perIlPdf(x.voce), perIlPdf(testoDellaVoce(x)), perIlPdf(x.nota)] }))));
    const costi = c.costi_diversi || [];
    sezioni.push(sezionePdf(T, t.costi, COLONNE_COSTI, costi.length ? righeDi(T, COLONNE_COSTI, costi)
      : [{ celle: ['—', 'non calcolabile per questo canale: le note dicono perché', '—', '—', '—'] }]));
    const esterni = c.esterni || [];
    sezioni.push(sezionePdf(T, t.esterni, COLONNE_ESTERNI, esterni.length
      ? [...righeDi(T, COLONNE_ESTERNI, esterni), { stile: 'totale', celle: ['Media degli esterni del canale', cellaPdf(T, COLONNE_ESTERNI[1], c.confronto && c.confronto.tonnellate_esterni), '', cellaPdf(T, COLONNE_ESTERNI[3], c.confronto && c.confronto.euro_t_esterni)] }]
      : [{ celle: ['Nessun raccoglitore esterno con una tariffa paragonabile nel periodo', '—', '—', '—'] }]));
  }
  const periodo = testoPeriodo(sim);
  return {
    nomeFile: nomeDelFile(sim, oggi),
    intestazione: perIlPdf(intestazioneSimulazione(oggi)),
    titolo: perIlPdf(titoloDelPdf(sim)),
    sottotitolo: perIlPdf(testoParametri(sim.parametri)),
    // Un riquadro per canale, mai un totale.
    riepilogo: sim.canali.map(c => ({
      etichetta: perIlPdf(`${c.nome}: margine simulato${vuoto(c.euro_t) ? ' (costo non scritto)' : ` con SMOCO a ${scriviEuroT(c.euro_t)}`}`),
      valore: perIlPdf(vuoto(c.anno && c.anno.margine_simulato) ? '—' : `${euroTesto(c.anno.margine_simulato)}  ·  ${pctTesto(c.anno.margine_simulato_pct)}`),
    })),
    sezioni,
    note: noteDellaSimulazione(sim, oggi).map(perIlPdf),
    titoloNote: 'Come si legge questa simulazione',
    documento: stato !== undefined ? { periodo: perIlPdf(periodo), stato } : { periodo: perIlPdf(periodo), entita: ENTITA_SIMULAZIONE },
  };
}

// ─── L'EXCEL ───

// Il formato di una colonna dal suo titolo: euro ed €/t col numero e due
// decimali (l'unita' e' nel titolo), tonnellate con due decimali e il terzo se
// i chili non sono tondi, percentuali con uno. Nella tabella del pareggio
// l'unita' sta nella colonna accanto al valore.
const formatoDelTitolo = (titolo) => {
  const t = String(titolo || '');
  if (/\(€(\/t)?\)/.test(t)) return FORMATI.importo;
  if (/\(t\)/.test(t)) return FORMATI.tonnellateFini;
  if (/\(%\)/.test(t)) return FORMATI.percentuale;
  return undefined;
};
const formatoDellaCella = (c, riga, _i, titoli) => {
  if (titoli[c] === 'Valore') return riga[c + 1] === 't' ? FORMATI.tonnellateFini : FORMATI.importo;
  return formatoDelTitolo(titoli[c]);
};
const cellaExcel = (_c, v) => (vuoto(v) || v === '' ? null : v);

/**
 * La cartella della simulazione: un foglio per canale e il foglio «Note».
 * Lo stato dei dati si legge una volta sola (se non e' passato) e vale per
 * tutti i fogli. -> { wb, nomeFile }
 */
export async function cartellaSimulazione(sim, { oggi, stato } = {}) {
  if (!sim || !Array.isArray(sim.canali)) throw new Error('Niente da esportare: la simulazione non c\'è.');
  const letto = stato !== undefined ? stato : await leggiStatoDati(ENTITA_SIMULAZIONE);
  const ente = intestazioneSimulazione(oggi);
  const sottotitolo = testoParametri(sim.parametri);
  const periodo = testoPeriodo(sim);
  const { wb } = await nuovaCartella();

  for (const c of sim.canali) {
    const doc = await documentoDa({ titolo: titoloDelFoglio(sim, c), sottotitolo, canale: c.canale, periodo, stato: letto, ente });
    const t = titoliSezioni(sim, c);
    const righe = [], stili = {}, testate = [];
    const metti = (riga, stile) => { if (stile === 'testata') testate.push(righe.length); else if (stile) stili[righe.length] = stile; righe.push(riga); };
    const tabella = (titolo, colonne, elementi, rigaFinale) => {
      metti([titolo], 'gruppo');
      metti(colonne.map(x => x.titolo), 'testata');
      for (const x of elementi) metti(colonne.map(col => cellaExcel(col, col.valore(x))));
      if (rigaFinale) metti(rigaFinale, 'totale');
      metti([]);
    };

    metti([FRASE_SIMULAZIONE], 'avviso');
    metti([`Costo di SMOCO sul canale ${c.nome}: ${costoTesto(c.euro_t)}, scritto a mano (${sottotitolo}). Nessun totale somma i tre canali.`], 'nota');
    metti([]);
    tabella(t.mesi, COLONNE_MESI, c.mesi || [], COLONNE_MESI.map(col => cellaExcel(col, col.valore(c.anno || {}))));
    metti([t.voci], 'gruppo');
    metti(['Voce', 'Valore', 'Unità', 'Nota'], 'testata');
    for (const x of vociDelCanale(c)) metti([x.voce, vuoto(x.valore) ? null : x.valore, x.unita, x.nota]);
    metti([]);
    const costi = c.costi_diversi || [];
    if (costi.length) tabella(t.costi, COLONNE_COSTI, costi);
    else { metti([t.costi], 'gruppo'); metti(['Non calcolabile per questo canale: le note dicono perché.'], 'nota'); metti([]); }
    const esterni = c.esterni || [];
    if (esterni.length) {
      tabella(t.esterni, COLONNE_ESTERNI, esterni, ['Media degli esterni del canale', cellaExcel(COLONNE_ESTERNI[1], c.confronto && c.confronto.tonnellate_esterni), null, cellaExcel(COLONNE_ESTERNI[3], c.confronto && c.confronto.euro_t_esterni)]);
    } else { metti([t.esterni], 'gruppo'); metti(['Nessun raccoglitore esterno con una tariffa paragonabile nel periodo.'], 'nota'); metti([]); }
    if ((c.note || []).length) {
      metti([`${c.nome} — note`], 'gruppo');
      for (const n of c.note) metti([n], 'nota');
    }
    foglioDaRighe(wb, c.nome, {
      doc, righe, testate, stili, formati: formatoDellaCella,
      larghezze: [36, 16, 16, 16, 16, 14, 16, 16, 48],
    });
  }

  const docNote = await documentoDa({ titolo: titoloDelPdf(sim), sottotitolo, periodo, stato: letto, ente });
  foglioNote(wb, docNote, noteDellaSimulazione(sim, oggi));
  return { wb, nomeFile: `${nomeDelFile(sim, oggi)}.xlsx` };
}

/** L'Excel della simulazione, scaricato: restituisce il nome del file. */
export async function esportaSimulazioneExcel(sim, opzioni = {}) {
  const { wb, nomeFile } = await cartellaSimulazione(sim, opzioni);
  return scaricaCartella(wb, nomeFile);
}
