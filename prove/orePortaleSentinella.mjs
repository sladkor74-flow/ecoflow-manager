// LA SENTINELLA DELLE ORE DEL PORTALE (difetto 9, 16/10/2026).
//
// Il portale scrive l'ora italiana e il gestionale la salva com'e' scritta, con
// la Z per convenzione: '2026-12-31T23:30:00.000Z' e' il 31/12/2026 alle 23:30
// italiane. I sei campi con l'ora (ORE_PORTALE in base44/shared/primarie.ts) si
// leggono SOLO con giornoPortale, annoPortale, mesePortale, oraPortale e
// dataPortaleIt (giornoItaliano). Letti con giornoRoma, con toLocaleDateString,
// coi getter di un Date o tagliando la stringa, un ordine immesso dopo le 22
// d'estate o dopo le 23 d'inverno finisce al giorno dopo: sulla copia dell'11/10
// erano 19 immissioni di rete, 14 immissioni e 23 chiusure del report delle
// dichiarazioni, e un ordine cambiava mese.
//
// Il rischio vero di questa regola e' un lettore NUOVO scritto come prima. Lo
// fermano tre reti insieme, perche' nessuna e' completa da sola:
//
// 1. L'ELENCO CHIUSO DEI FILE. Ogni file di base44/ e src/ che nomina uno dei sei
//    campi sta qui sotto, con la sua categoria e il perche'. Un file nuovo, o uno
//    che non li nomina piu', fa fallire la prova finche' non lo si mette (o
//    toglie) nell'elenco col motivo - e, se legge l'ora, con la sua prova.
// 2. LA REGOLA SUL TESTO. Sulla riga che nomina il campo e sulle due dopo non ci
//    deve essere una lettura vietata (giornoRoma, annoRoma, meseRoma, i
//    toLocale..., i getter del Date, toISOString, new Date, il taglio della
//    stringa), ne' un aiutante definito nello stesso file che nelle sue prime
//    quattro righe ne usa una (un «alias»: ymd, fmtData, dataIt, soloData...).
//    Le eccezioni sono scritte una per una, col motivo.
// 3. LE PROVE SUL COMPORTAMENTO. Ogni file corretto nel giro ha la sua prova,
//    che gli passa un valore delle 23:30 del 31/12 e pretende il 31/12: qui si
//    controlla che quella prova esista e che nomini il file.
//
// CHE COSA LA REGOLA SUL TESTO NON VEDE, e quindi resta alla terza rete: una
// lettura attraverso una variabile o un aiutante di un altro file (il campo
// passato a una funzione per nome di colonna, un `format: 'date'`, un valore
// messo in una variabile qualche riga prima), il valore copiato grezzo in un
// file o in una risposta, e i campi salvati `mese` e `anno` degli assegnati, che
// non sono una lettura di un campo con l'ora. Un lettore nuovo si prova SEMPRE
// col valore delle 23:30 del 31/12.
//
// npm run prove
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const qui = dirname(fileURLToPath(import.meta.url));
const radice = join(qui, '..');

// I campi vengono dallo scrittore unico. Sul codice di prima (la controprova)
// ORE_PORTALE non c'era: si usano gli stessi sei nomi scritti qui, cosi' la prova
// cade sulle verifiche e non sull'import.
const primarie = await import('../base44/shared/primarie.ts');
const SEI = ['ordine_immesso_il', 'ordine_chiuso_il', 'data_immissione', 'data_chiusura', 'data_dichiarazione', 'data_esecuzione'];
const CAMPI = primarie.ORE_PORTALE ? [...primarie.ORE_PORTALE] : SEI;

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + (extra ? '\n    ' + extra : '')); } };

verifica('i campi con l\'ora sono i sei dello scrittore', JSON.stringify(CAMPI) === JSON.stringify(SEI), JSON.stringify(CAMPI));

// ---------------------------------------------------------------------------
// 1. L'ELENCO CHIUSO
// ---------------------------------------------------------------------------
const CORRETTO = 'corretto nel giro';
const GIORNO_GIA_CALCOLATO = 'legge un giorno gia\' calcolato o copia il valore senza leggerne il giorno';
const ALTRO_CAMPO = 'un altro campo con lo stesso nome';

const ELENCO = {
  // --- corretti nel giro, con la prova che li copre ---
  // gruppo 1: chi scrive le date dai file
  'base44/functions/importaBlocco/entry.ts': { tipo: CORRETTO, prova: 'orePortale.mjs', perche: 'scrive le date con dataDelPortale; l\'anno delle dichiarazioni da allineare con annoPortale' },
  'base44/functions/importEcotyreFile/entry.ts': { tipo: CORRETTO, prova: 'orePortale.mjs', perche: 'scrive le date con dataDelPortale, foglio senza cellDates; anno delle dichiarazioni con annoPortale' },
  'base44/shared/primarie.ts': { tipo: CORRETTO, prova: 'orePortale.mjs', perche: 'lo scrittore unico: ORE_PORTALE, GIORNI_PORTALE, dataDelPortale' },
  // gruppo 2: movimenti, arricchimento, evasione, giacenze e dichiarazioni
  'base44/shared/agganciaDichiarazioni.ts': { tipo: CORRETTO, prova: 'orePortaleCalcoli.mjs', perche: 'il giorno della dichiarazione a portale' },
  'base44/shared/cruscotto.ts': { tipo: CORRETTO, prova: 'orePortaleCalcoli.mjs', perche: 'eta\' dell\'arretrato dall\'immissione' },
  'base44/shared/dataEnrichment.ts': { tipo: CORRETTO, prova: 'orePortaleCalcoli.mjs', perche: 'mese, settimana e anno dall\'immissione o dalla fine' },
  'base44/shared/evasioneAssegnati.ts': { tipo: CORRETTO, prova: 'orePortaleCalcoli.mjs', perche: 'immissione degli ordini vivi; le righe delle liste prendono il giorno dall\'ordine vivo' },
  'base44/shared/filtroPeriodo.ts': { tipo: CORRETTO, prova: 'orePortaleCalcoli.mjs', perche: 'filtro per immissione' },
  'base44/shared/giacenzaPortale.ts': { tipo: CORRETTO, prova: 'orePortaleCalcoli.mjs', perche: 'immesso_il dei movimenti della quadratura' },
  'base44/shared/giacenzaStoccaggi.ts': { tipo: CORRETTO, prova: 'orePortaleCalcoli.mjs', perche: 'la chiusura decide che cosa arriva dopo la fotografia' },
  'base44/shared/movimenti.ts': { tipo: CORRETTO, prova: 'orePortaleCalcoli.mjs', perche: 'giornoOrdine, giornoElenco, annoElenco, meseElenco, tempiRaccolta' },
  'src/lib/movimenti.js': { tipo: CORRETTO, prova: 'orePortaleCalcoli.mjs', perche: 'specchio di movimenti.ts' },
  'base44/shared/ordiniEseguiti.ts': { tipo: CORRETTO, prova: 'orePortaleCalcoli.mjs', perche: 'immissione degli ordini in «eseguito»' },
  'src/lib/ordiniEseguiti.js': { tipo: CORRETTO, prova: 'orePortaleCalcoli.mjs', perche: 'specchio di ordiniEseguiti.ts' },
  'base44/shared/pivotCalculator.ts': { tipo: CORRETTO, prova: 'orePortaleCalcoli.mjs', perche: 'pivot per immissione' },
  'base44/shared/primarieReteAnalytics.ts': { tipo: CORRETTO, prova: 'orePortaleCalcoli.mjs', perche: 'anno dei terminati senza fine' },
  'base44/shared/statoArchivi.ts': { tipo: CORRETTO, prova: 'orePortaleCalcoli.mjs', perche: 'ultimo giorno degli archivi, per campo' },
  'base44/shared/storicoConservato.ts': { tipo: CORRETTO, prova: 'orePortaleCalcoli.mjs', perche: 'anno dei cancellati da conservare' },
  'base44/shared/usciteDichiarate.ts': { tipo: CORRETTO, prova: 'orePortaleCalcoli.mjs', perche: 'il giorno del caricamento a portale' },
  // gruppo 3: EcoTyna
  'base44/shared/assistente.ts': { tipo: CORRETTO, prova: 'orePortaleEcoTyna.mjs', perche: 'anno dei terminati senza fine' },
  'base44/shared/strumentiAssistente.ts': { tipo: CORRETTO, prova: 'orePortaleEcoTyna.mjs', perche: 'giorni di attesa, immesso_il, coda, date dell\'ordine' },
  // gruppo 4: pagine, esportazioni e funzioni degli assegnati
  'base44/functions/computeAssegnatiMatrix/entry.ts': { tipo: CORRETTO, prova: 'orePortalePagine.mjs', perche: 'mese, anno e giorno dall\'immissione' },
  'base44/functions/exportAssegnati/entry.ts': { tipo: CORRETTO, prova: 'orePortalePagine.mjs', perche: 'data con dataPortaleIt, mese e anno dall\'immissione' },
  'base44/functions/exportSecondarie/entry.ts': { tipo: CORRETTO, prova: 'orePortalePagine.mjs', perche: 'date con dataPortaleIt' },
  'base44/functions/exportTerziarie/entry.ts': { tipo: CORRETTO, prova: 'orePortalePagine.mjs', perche: 'date con dataPortaleIt al posto della stringa grezza' },
  'src/components/assegnati/AssegnatiTable.jsx': { tipo: CORRETTO, prova: 'orePortalePagine.mjs', perche: 'colonne mese e anno, data con dataPortaleIt' },
  'src/components/giacenze/DaDichiarareTable.jsx': { tipo: CORRETTO, prova: 'orePortalePagine.mjs', perche: 'chiusura dei non dichiarati con dataPortaleIt' },
  'src/components/primarie-rete/PrimarieReteTable.jsx': { tipo: CORRETTO, prova: 'orePortalePagine.mjs', perche: 'colonne data con giornoPortale' },
  'src/components/report-pivot/DrillDownModal.jsx': { tipo: CORRETTO, prova: 'orePortalePagine.mjs', perche: 'colonne data con giornoPortale' },
  'src/components/secondarie/SecondarieTable.jsx': { tipo: CORRETTO, prova: 'orePortalePagine.mjs', perche: 'colonne data con giornoPortale' },
  'src/pages/Assegnati.jsx': { tipo: CORRETTO, prova: 'orePortalePagine.mjs', perche: 'filtri per anno, mese e giorno dall\'immissione' },
  'src/pages/PrimarieAci.jsx': { tipo: CORRETTO, prova: 'orePortalePagine.mjs', perche: 'colonne data con giornoPortale' },

  // --- leggono un giorno gia' calcolato, o copiano il valore senza leggerne il giorno ---
  'src/components/verifiche/DettaglioEvasione.jsx': { tipo: GIORNO_GIA_CALCOLATO, perche: 'legge l\'esito di controllaLista, dove l\'immissione e\' gia\' AAAA-MM-GG' },
  'base44/functions/getOrdiniDaDichiarare/entry.ts': { tipo: GIORNO_GIA_CALCOLATO, perche: 'confronta il testo con $gte e un giorno di margine, e copia i valori' },
  'base44/functions/riepilogoDichiarazioni/entry.ts': { tipo: GIORNO_GIA_CALCOLATO, perche: 'copia il valore cosi\' com\'e\'' },
  'base44/shared/excelSchemas.ts': { tipo: GIORNO_GIA_CALCOLATO, perche: 'solo i nomi delle colonne' },
  'base44/shared/surplus.ts': { tipo: GIORNO_GIA_CALCOLATO, perche: 'solo un commento' },
  'src/lib/surplus.js': { tipo: GIORNO_GIA_CALCOLATO, perche: 'specchio di surplus.ts, solo un commento' },

  // --- un altro campo con lo stesso nome ---
  'base44/functions/cambiaStatoFatturazione/entry.ts': { tipo: ALTRO_CAMPO, perche: 'DocumentoFatturazione.data_chiusura, un istante scritto dal gestionale' },
  'base44/shared/chiusuraMese.ts': { tipo: ALTRO_CAMPO, perche: 'DocumentoFatturazione.data_chiusura, un istante' },
  'base44/functions/segnaMesiChiusiFuori/entry.ts': { tipo: ALTRO_CAMPO, perche: 'DocumentoFatturazione.data_chiusura, un istante' },
  'src/components/fatturazione/AttivaDashboard.jsx': { tipo: ALTRO_CAMPO, perche: 'DocumentoFatturazione.data_chiusura, un istante' },
  'src/components/fatturazione/StoricoFatturazione.jsx': { tipo: ALTRO_CAMPO, perche: 'DocumentoFatturazione.data_chiusura, un istante' },
  'base44/shared/richiesteEct.ts': { tipo: ALTRO_CAMPO, perche: 'RichiestaEct: il giorno del foglio ECT, letto sul testo' },
  'src/lib/richiesteEct.js': { tipo: ALTRO_CAMPO, perche: 'specchio di richiesteEct.ts' },
  'base44/functions/importaRichiesteEct/entry.ts': { tipo: ALTRO_CAMPO, perche: 'RichiestaEct: il giorno del foglio ECT' },
  'src/components/todo/RichiesteEct.jsx': { tipo: ALTRO_CAMPO, perche: 'RichiestaEct: il giorno del foglio ECT' },
  'base44/functions/importaDichiarazioniRentri/entry.ts': { tipo: ALTRO_CAMPO, perche: 'RENTRI: un giorno' },
  'src/pages/DichiarazioniRentri.jsx': { tipo: ALTRO_CAMPO, perche: 'RENTRI: un giorno' },
  'src/components/fatturazione/ExtraRaccoltaForm.jsx': { tipo: ALTRO_CAMPO, perche: 'extra raccolta: i giorni scritti dalla scheda (dataDaGiorno)' },
  'src/pages/ExtraRaccolta.jsx': { tipo: ALTRO_CAMPO, perche: 'extra raccolta: i giorni della scheda' },
  'src/lib/extraRaccoltaCalc.js': { tipo: ALTRO_CAMPO, perche: 'extra raccolta: i giorni della scheda' },
  'src/lib/extraRaccoltaStato.js': { tipo: ALTRO_CAMPO, perche: 'extra raccolta: dateDaCorreggere resta su giornoRoma apposta' },
};

// ---------------------------------------------------------------------------
// 2. LA REGOLA SUL TESTO: le eccezioni, una per una
// ---------------------------------------------------------------------------
const tutti = '*';
const ECCEZIONI = [
  { file: /cambiaStatoFatturazione|chiusuraMese\.ts|segnaMesiChiusiFuori|AttivaDashboard|StoricoFatturazione/, campo: 'data_chiusura', perche: 'DocumentoFatturazione: un istante del gestionale, giornoRoma e\' giusto' },
  { file: /richiesteEct\.(ts|js)$|importaRichiesteEct|RichiesteEct\.jsx/, campo: 'ordine_immesso_il', perche: 'RichiestaEct: il giorno del foglio ECT' },
  { file: /DichiarazioniRentri\.jsx|importaDichiarazioniRentri/, campo: 'data_dichiarazione', perche: 'RENTRI: un giorno' },
  { file: /ExtraRaccoltaForm|ExtraRaccolta\.jsx|extraRaccoltaCalc|extraRaccoltaStato/, campo: 'ordine_immesso_il', perche: 'extra raccolta: i giorni della scheda' },
  { file: /base44\/shared\/primarie\.ts$/, campo: tutti, perche: 'lo scrittore unico' },
  { file: /excelSchemas\.ts$/, campo: tutti, perche: 'solo i nomi delle colonne' },
  { file: /strumentiAssistente\.ts$/, campo: 'ordine_immesso_il', pezzo: 'annoDellaRichiesta', perche: 'RichiestaEct: l\'anno della richiesta, letto come la pagina delle richieste' },
  { file: /strumentiAssistente\.ts$/, campo: 'ordine_immesso_il', pezzo: 'soloData(r.ordine_immesso_il), evaso_il', perche: 'RichiestaEct: il giorno del foglio ECT' },
  { file: /strumentiAssistente\.ts$/, campo: 'data_dichiarazione', pezzo: 'soloData(d.data_dichiarazione)', perche: 'RENTRI: un giorno' },
  { file: /base44\/shared\/evasioneAssegnati\.ts$|DettaglioEvasione\.jsx/, campo: 'data_immissione', perche: 'righe delle liste: gia\' un giorno AAAA-MM-GG' },
];

const LETTURE = ['giornoRoma\\(', 'annoRoma\\(', 'meseRoma\\(', 'toLocaleDateString', 'toLocaleString', 'toLocaleTimeString', 'getHours\\(', 'getDate\\(', 'getMonth\\(', 'getFullYear\\(', 'getUTC\\w+\\(', 'toISOString\\(', '\\.slice\\(\\s*(?:0|5|8|11)\\s*,', 'new Date\\('];
const reLettura = new RegExp(LETTURE.join('|'));

const file = [];
const giro = (d) => {
  for (const n of readdirSync(d)) {
    if (n === 'node_modules') continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) giro(p);
    else if (/\.(ts|js|jsx|mjs)$/.test(n)) file.push(p);
  }
};
giro(join(radice, 'base44'));
giro(join(radice, 'src'));

const nominano = new Set();
const trovate = [];
for (const p of file) {
  const rel = relative(radice, p).split(sep).join('/');
  // I file modificati passano a CRLF: le righe si spezzano su tutti e due.
  const righe = readFileSync(p, 'utf8').split(/\r?\n/);
  // Gli alias: un aiutante definito nel file che nelle sue prime 4 righe legge
  // una data in un modo vietato diventa a sua volta una lettura vietata.
  const alias = new Set();
  righe.forEach((r, i) => {
    const m = r.match(/(?:const|let)\s+(\w+)\s*=\s*(?:\([^)]*\)|\w+)\s*=>/) || r.match(/function\s+(\w+)\s*\(/);
    if (m && reLettura.test(righe.slice(i, i + 4).join('\n'))) alias.add(m[1]);
  });
  const reAlias = alias.size ? new RegExp(`\\b(?:${[...alias].join('|')})\\(`) : null;
  righe.forEach((r, i) => {
    for (const c of CAMPI) {
      if (!r.includes(c)) continue;
      nominano.add(rel);
      if (ECCEZIONI.some(e => e.file.test(rel) && (e.campo === tutti || e.campo === c) && (!e.pezzo || r.includes(e.pezzo)))) continue;
      const finestra = righe.slice(i, i + 3).join('\n');
      if (reLettura.test(finestra) || (reAlias && reAlias.test(finestra))) trovate.push(`${rel}:${i + 1} ${c}: ${r.trim().slice(0, 140)}`);
    }
  });
}

console.log('1. L\'ELENCO CHIUSO DEI FILE CHE NOMINANO UN CAMPO CON L\'ORA');
const nuovi = [...nominano].filter(f => !ELENCO[f]).sort();
const spariti = Object.keys(ELENCO).filter(f => !nominano.has(f)).sort();
verifica(`ogni file che nomina un campo con l'ora e' nell'elenco (${nominano.size} file)`, nuovi.length === 0,
  'file nuovi, da mettere nell\'elenco con la categoria, il motivo e, se leggono l\'ora, la prova:\n    ' + nuovi.join('\n    '));
verifica('ogni file dell\'elenco nomina ancora un campo con l\'ora', spariti.length === 0,
  'non nominano piu\' i campi, da togliere dall\'elenco:\n    ' + spariti.join('\n    '));
const perTipo = (t) => Object.values(ELENCO).filter(x => x.tipo === t).length;
verifica('l\'elenco ha le tre categorie, 32 + 6 + 15', perTipo(CORRETTO) === 32 && perTipo(GIORNO_GIA_CALCOLATO) === 6 && perTipo(ALTRO_CAMPO) === 15 && Object.keys(ELENCO).length === 53,
  `${perTipo(CORRETTO)} + ${perTipo(GIORNO_GIA_CALCOLATO)} + ${perTipo(ALTRO_CAMPO)}`);
verifica('ogni voce ha il suo motivo', Object.values(ELENCO).every(x => x.perche && x.perche.length > 5));

console.log('\n2. LA REGOLA SUL TESTO');
verifica('nessuna lettura vietata sulla riga di un campo con l\'ora o nelle due dopo', trovate.length === 0,
  `${trovate.length} righe:\n    ` + trovate.join('\n    '));
verifica('ogni eccezione ha il suo motivo', ECCEZIONI.every(e => e.perche && e.perche.length > 5));

console.log('\n3. LE PROVE SUL COMPORTAMENTO');
// Il nome con cui una prova nomina il file: la cartella per una funzione, il
// nome del file senza estensione per il resto.
const nomeModulo = (f) => (/\/entry\.ts$/.test(f) ? f.split('/').slice(-2, -1)[0] : f.split('/').pop().replace(/\.(ts|js|jsx)$/, ''));
const senzaProva = [];
const nonNominato = [];
for (const [f, x] of Object.entries(ELENCO)) {
  if (x.tipo !== CORRETTO) continue;
  const percorso = join(qui, x.prova || '');
  if (!x.prova || !existsSync(percorso)) { senzaProva.push(`${f} -> ${x.prova || '(nessuna)'}`); continue; }
  if (!readFileSync(percorso, 'utf8').includes(nomeModulo(f))) nonNominato.push(`${f} -> ${x.prova} non nomina ${nomeModulo(f)}`);
}
verifica('ogni file corretto ha la sua prova sul comportamento', senzaProva.length === 0, senzaProva.join('\n    '));
verifica('e la prova nomina il file che copre', nonNominato.length === 0, nonNominato.join('\n    '));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
