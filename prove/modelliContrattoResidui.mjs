// Prova: un contratto vero gia' compilato, caricato come format, non lascia
// dati del fornitore di partenza nel contratto generato per un altro fornitore,
// e non cambia i dati di SMOCO (revisione del 13/10/2026, rilievi sul lettore
// dei format src/lib/modelliContratto.js).
//
// Cosa succedeva prima, sui contratti veri del 2026:
// - la camera di commercio si cambiava solo nel paragrafo del fornitore: nelle
//   comunicazioni restava quella vecchia accanto alla partita IVA nuova;
// - la carica al femminile («Amministratrice») non era riconosciuta: il nome
//   diventava «Amministratrice Sig.ra Bonavita Tiziana» e restavano nome,
//   carica e cellulare sotto la firma e nelle comunicazioni;
// - «Sig.re Nunziostefano Nappi» si leggeva «re Nunziostefano Nappi»;
// - il nome «LOGISTICA», cercato senza distinguere le maiuscole, prendeva il
//   «Responsabile della Logistica» di SMOCO, e il telefono del suo referente
//   diventava quello del fornitore;
// - «mese di ________2026» restava nel contratto del 2027;
// - la proposta dava tutti i punti per completi;
// - la carica scritta dopo il nome («Guido Costanzo Amministratore Unico»,
//   «in qualità di Legale Rappresentante» nelle comunicazioni di T-Cycle)
//   restava, e un telefono di SMOCO scritto in una riga del fornitore
//   diventava del fornitore (seconda parte della revisione del 13/10/2026);
// - nei contratti di trasporto restava il domicilio del vettore di partenza
//   nelle comunicazioni («- quanto al Vettore ECOSERVICE S.r.l. presso Carrara
//   (MS) …», «… Logistica srl presso Via delle Industrie 78, …»), e con lui la
//   provincia, la classe e la data della sua iscrizione agli albi: la proposta
//   non segnava la sede da controllare e del resto segnava solo i numeri
//   (rilievo sulla revisione del 13/10/2026). Ora la prova guarda anche la sede
//   del fornitore di partenza (la via, «città (PR)», «CAP città») e i dati
//   d'iscrizione del vettore: non restano, o restano dove la proposta li segna
//   da controllare; e accesi, diventano i dati del fornitore nuovo.
//
// Due parti: due format finti costruiti qui (girano dappertutto), e tutti i
// contratti veri del 2026 usati dalla revisione piu' gli otto format, se su
// questo computer c'e' la cartella dei contratti (sola lettura; senza la
// cartella quella parte si salta con un avviso, come prove/datiVeri.mjs).
// node prove/modelliContrattoResidui.mjs
import { existsSync, readFileSync } from 'node:fs';
import { zipSync, strToU8 } from 'fflate';
import { leggiFormat, proponiPunti, costruisciModello, compilaContratto, testoDelDocumento, righeDi } from '../src/lib/modelliContratto.js';
import { leggiModello } from '../src/lib/docxModello.js';
import { puntoDi } from '../src/lib/segnapostiContratto.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const comeFile = (u8) => ({ name: 'format.docx', arrayBuffer: async () => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) });
const blobInFile = async (blob) => comeFile(new Uint8Array(await blob.arrayBuffer()));
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cifre = (s) => String(s).replace(/\D/g, '');

// Le righe di SMOCO, con una regola della prova (non quella del lettore): il suo
// codice fiscale, «quanto a SMOCO», «per il Committente».
const CF_SMOCO = '02971520735';
const rigaSmoco = (t) => t.includes(CF_SMOCO) || /^\W*quanto\s+a(?:l)?\s+(?:SMOCO|Committente)\b/i.test(t) || /^\W*per\s+(?:il|la)\s+Committente\b/i.test(t);
// Le righe del fornitore, da cui la prova prende telefoni ed email di partenza.
const rigaFornitore = (t) => !rigaSmoco(t) && (/quanto\s+al\s*(?:FORNITORE|Vettore)/i.test(t) || /^\W*per\s+il\s+Vettore\s*:/i.test(t)
  || /\(\s*di\s+seguito\s+(?:il\s+|indicata\s+come\s+)?["“]?\s*(?:FORNITORE|Vettore)/i.test(t));
const telefoniDi = (righe) => [...new Set(righe.filter(rigaFornitore).flatMap(t => [...t.matchAll(/(?:Tel|Cell|Telefono)\.?[^0-9+]{0,6}(\+?\d[\d\s/.-]{5,}\d)/gi)].map(m => cifre(m[1]))))];
const emailDi = (righe) => [...new Set(righe.filter(rigaFornitore).flatMap(t => (t.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) || []).filter(e => !/@(?:pec\.)?(?:smoco|ecotyre|pneumaticifuoriuso)\./i.test(e))))];
const numeriDi = (t) => (t.match(/\+?\d[\d\s/.-]{5,}\d/g) || []).map(cifre);

// La sede del fornitore di partenza, letta con una regola della prova dal suo
// paragrafo (anche spezzato su tre righe, come nel Nappi Sud stoccaggio): i
// pezzi che la riconoscono altrove sono la via (fino alla prima virgola),
// «città (PR)» e «CAP città». La citta' da sola no: Massafra e' anche di SMOCO.
function pezziDellaSede(righe) {
  for (let i = 0; i < righe.length; i++) {
    const t = righe.slice(i, i + 3).join(' ');
    if (rigaSmoco(righe[i]) || /^\W*quanto\s+al/i.test(righe[i]) || !/con\s+sede/i.test(righe[i]) || !/\(\s*di\s+seguito/i.test(t)) continue;
    const m = t.match(/con\s+sede(?:\s+legale)?(?:\s+in)?\s+(.{3,160}?\(\s*([A-Z]{2})\s*\)|.{3,160}?(?=,\s*(?:Codice|C\.F\.|Partita|P\.\s?IVA)))/i);
    if (!m || /_{3,}/.test(m[1])) return [];
    const sede = m[1];
    const c = sede.match(/(?:(\d{5})\s+)?([\p{L}'’][\p{L}'’ ]*?)\s*(?:\(\s*[A-Z]{2}\s*\))?$/u);
    const pezzi = [sede.split(',')[0].trim()];
    if (c && m[2]) pezzi.push(`${c[2].trim()} (${m[2]})`);
    if (c && c[1]) pezzi.push(`${c[1]} ${c[2].trim()}`);
    return pezzi.filter(p => p.length > 5).map(p => ({ testo: p, re: new RegExp(esc(p).replace(/\s+/g, '\\s+'), 'i') }));
  }
  return [];
}
// I dati d'iscrizione del vettore (righe «Il Vettore è … iscritt…»), con regole
// della prova: la provincia dell'albo, la classe, i numeri, e la data o gli
// estremi scritti dopo un numero.
function datiIscrizione(t) {
  if (!/^\W*Il\s+Vettore\b[^.]{0,80}?\biscritt[oa]\b/i.test(t)) return [];
  const out = [];
  const dato = (valore, re) => { if (/[\p{L}\d]/u.test(valore)) out.push({ valore, re }); };
  const pv = t.match(/Provincia\s+di\s+([^,;]+?)\s*,/);
  if (pv) dato(pv[1], new RegExp(`Provincia\\s+di\\s+${esc(pv[1])}`));
  const cl = t.match(/classe\s+[“"]?([A-Z])\b/);
  if (cl) dato(cl[1], new RegExp(`classe\\s+[“"]?${cl[1]}\\b`));
  for (const m of t.matchAll(/\bn\.\s*([A-Z0-9/]*\d[A-Z0-9/]*)(?:\s+del\s+(\d{2}\/\d{2}\/\d{4})|\s+\(([^)]+)\))?/g)) {
    for (const v of [m[1], m[2], m[3]].filter(Boolean)) dato(v, new RegExp(`(?<![\\w/])${esc(v)}(?![\\w/])`));
  }
  return out;
}

// Il posto di ogni riga del testo (parte, riga), nell'ordine di testoDelDocumento.
function postiDelleRighe(parti) {
  const out = [];
  for (const nome of Object.keys(parti).sort((a, b) => (a === 'word/document.xml' ? -1 : b === 'word/document.xml' ? 1 : a.localeCompare(b)))) {
    righeDi(parti[nome]).forEach((r, i) => out.push({ parte: nome, riga: i }));
  }
  return out;
}

// La riga dell'iscrizione di SMOCO agli albi, nei contratti di trasporto: non
// si tocca e non si segna.
const RIGA_ISCRIZIONE_SMOCO = /^\W*Il\s+Committente\b[^.]{0,80}?\biscritt[oa]\b/i;
// L'unico dato di SMOCO che cambia (decisione dell'utente del 13/10/2026): la
// data della sua iscrizione all'Albo in categoria 8 (BA-11513) e' sempre il
// 16/05/2025, fino al rinnovo del 2030. Regola della prova, non del lettore: il
// pezzo di riga che comincia col numero e non parla della categoria 4 prende
// quella data, con lo stesso separatore.
const alboGiusto = (t) => String(t).split(/(?=BA-?\s?11513)/).map(p => (/^BA-?\s?11513/.test(p) && !/categoria\s*4|cat\.?\s*4(?!\d)/i.test(p)
  ? p.replace(/^(BA-?\s?11513\s+del\s+)\d{1,2}([./])\d{1,2}\2\d{4}/, (_m, a, s) => `${a}16${s}05${s}2025`) : p)).join('');
// Le occorrenze di qualunque punto, accese o spente, che cadono nella riga i del
// testo (la sua parte e il suo indice nel documento).
const occorrenzeNellaRiga = (g, i) => {
  const { parte, riga } = g.posti[i];
  return g.proposta.punti.flatMap(p => p.occorrenze.filter(o => o.parte === parte && o.riga === riga)
    .map(o => `${p.segnaposto} «${o.testo}» ${o.attiva ? 'accesa' : 'spenta'}${o.dubbia ? ' dubbia' : ''}`));
};

// I valori di un altro fornitore, inventati e diversi da tutti quelli dei contratti veri.
const ALTRO = {
  FORNITORE_RAGIONE_SOCIALE: 'ALTRO FORNITORE S.R.L.', FORNITORE_SEDE_LEGALE: 'Via Dante 9, 73100 Lecce (LE)', FORNITORE_SEDE_OPERATIVA: 'Via Dante 11, 73100 Lecce (LE)',
  FORNITORE_PIVA: '11122233344', FORNITORE_CF: '11122233344', FORNITORE_CCIAA: 'di Lecce', FORNITORE_REA: 'CCIAA LE n.11111', FORNITORE_RAPPRESENTANTE: 'Mario Ferri',
  FORNITORE_QUALIFICA: 'Legale Rappresentante', FORNITORE_EMAIL: 'info@altro.example', FORNITORE_TEL: '0832 111111', DATA_INIZIO: '2027-01-02', DATA_FINE: '2027-12-31',
  DATA_FIRMA: '2027-01-02', ANNO: '2027', TARGET_TON: 1250, QUOTA_TON: 1250, PAGAMENTO: 'sessanta giorni data fattura', MODALITA_PAGAMENTO: 'bonifico bancario',
  POLIZZA_RC: '2.000.000,00 Euro (duemilioni Euro)',
};
// Ogni punto del modello ha un valore: quelli che ALTRO non ha si inventano col loro tipo.
function valoriPer(punti) {
  const v = { ...ALTRO };
  for (const p of punti) {
    if (v[p.segnaposto] !== undefined) continue;
    const t = p.tipo || puntoDi(p.segnaposto).tipo;
    v[p.segnaposto] = t === 'prezzo' ? 77.77 : t === 'quantita' ? 999 : t === 'data' ? '2027-01-02' : /TEL/.test(p.segnaposto) ? '0832 222222' : /EMAIL/.test(p.segnaposto) ? 'altro2@altro.example' : 'Nuovo Valore';
  }
  return v;
}

/**
 * Legge un format, propone, costruisce il modello e genera il contratto di ALTRO
 * (extra: valori diversi da quelli di ALTRO; accendi(punti): quello che fa
 * l'amministratore prima di salvare, sui punti proposti).
 */
async function giro(u8, tipo, extra = {}, accendi = null) {
  const letto = await leggiFormat(comeFile(u8));
  const proposta = proponiPunti(letto, { tipo });
  const punti = accendi ? accendi(proposta.punti.map(p => ({ ...p, occorrenze: p.occorrenze.map(o => ({ ...o })) }))) : proposta.punti;
  const modello = costruisciModello(letto, punti);
  const gen = compilaContratto(await leggiModello(await blobInFile(modello.blob)), { ...valoriPer(modello.punti), ...extra }, modello.punti);
  const generato = testoDelDocumento((await leggiModello(await blobInFile(gen.blob))).parti);
  return { letto, proposta, modello, gen, originale: testoDelDocumento(letto.parti), generato, posti: postiDelleRighe(letto.parti) };
}

// ─── i format finti ───

const R = (testo, stile = '') => `<w:r>${stile ? `<w:rPr>${stile}</w:rPr>` : ''}<w:t xml:space="preserve">${testo}</w:t></w:r>`;
const P = (...run) => `<w:p>${run.join('')}</w:p>`;
const docx = (paragrafi) => zipSync({ 'word/document.xml': strToU8(`<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${paragrafi.map(p => (p.startsWith('<w:p>') ? p : P(R(p)))).join('')}</w:body></w:document>`), '[Content_Types].xml': strToU8('<Types/>') });

console.log('IL FORMAT FINTO DI UN TRASPORTATORE: CARICA AL FEMMINILE, NOME DI UNA PAROLA, RECAPITI DI SMOCO');
const formatA = docx([
  'CONTRATTO SERVIZI DI TRASPORTO SU STRADA PER L\'ANNO 2026',
  `Smoco S.r.l., con sede in Massafra (TA), Strada Statale 7 Appia km 636+700 snc, C.F. e P. IVA n. ${CF_SMOCO}, rappresentata dall'Amministratore Delegato Avv. Stefano Montanaro (di seguito indicata come Committente);`,
  'E',
  'LOGISTICA SRL, con sede in Via Roma 5, 70100 Bari (BA), Codice Fiscale, Partita IVA e Iscrizione al Registro Imprese di Bari 01234567890, rappresentato dall\'Amministratrice Unica Sig.ra Anna Verdi (di seguito il "FORNITORE")',
  'Il presente contratto è valido dal 02/01/2026 e sino al 31/12/2026.',
  'per il Committente: sig. Paolo Neri in qualità di Responsabile della Logistica; Tel. 099 7777777; e-mail: p.neri@smoco.it;',
  'per il Vettore: sig. Luca Gialli, Tel.: 080 6666666, e-mail: ordini@logistica.example;',
  'quanto al FORNITORE, Via Roma 5, 70100 Bari (BA), Codice Fiscale, Partita IVA e Iscrizione al Registro Imprese di Bari 01234567890, Tel. 080 5555555, cell.333 4444444, e-mail info@logistica.example, all\'attenzione della Sig.ra Verdi Anna.',
  'Il Titolare del Trattamento per SMOCO è fisicamente rappresentato dal suo legale rappresentante Sig. Stefano Montanaro, per il FORNITORE è la Sig.ra Anna Verdi.',
  'Dettaglio quantità ricevute nel mese di ________2026',
  'Letto, approvato e sottoscritto tra le Parti il 02/01/2026.',
  'SMOCO S.r.l.',
  'Amministratore Delegato',
  'Stefano MONTANARO',
  'LOGISTICA SRL',
  'Amministratrice Unica',
  P(R('_'), R('Anna VERDI'), R('_')),
]);
const a = await giro(formatA, 'trasporto_secondaria');
const tuttoA = a.generato.join('\n');
const pA = (s) => a.proposta.punti.find(x => x.segnaposto === s);
verifica('la carica al femminile si riconosce e il nome resta solo il nome', pA('FORNITORE_RAPPRESENTANTE')?.originale === 'Anna Verdi' && pA('FORNITORE_QUALIFICA')?.originale === 'Amministratrice Unica',
  JSON.stringify([pA('FORNITORE_RAPPRESENTANTE')?.originale, pA('FORNITORE_QUALIFICA')?.originale]));
verifica('il nome del rappresentante esce da tutto il contratto: privacy, comunicazioni, firma fra le linee', !/Verdi|\bAnna\b/i.test(tuttoA), a.generato.filter(r => /Verdi|\bAnna\b/i.test(r)).join(' | '));
verifica('la carica sotto la firma del fornitore si cambia', !/Amministratrice/.test(tuttoA), a.generato.filter(r => /Amministratrice/.test(r)).join(' | '));
verifica('la camera di commercio si cambia anche nelle comunicazioni', !/Imprese di Bari/.test(tuttoA) && (tuttoA.match(/Imprese di Lecce/g) || []).length === 2, a.generato.filter(r => /Imprese di/.test(r)).join(' | '));
verifica('telefono e cellulare del fornitore si cambiano tutti e due, ognuno col suo segnaposto', !/5555555|4444444|6666666/.test(tuttoA) && !!pA('FORNITORE_TEL_2'),
  JSON.stringify(a.proposta.punti.filter(x => /TEL/.test(x.segnaposto)).map(x => [x.segnaposto, x.originale])));
verifica('il referente del fornitore («per il Vettore: sig. Luca Gialli») si cambia', !/Gialli/.test(tuttoA) && !!pA('FORNITORE_REFERENTE'), a.generato.filter(r => /Gialli/.test(r)).join(' | '));
verifica('l\'anno attaccato ai trattini bassi si cambia', !/(?<!\d)2026(?!\d)/.test(tuttoA) && tuttoA.includes('mese di ________2027'), a.generato.filter(r => /2026/.test(r)).join(' | '));
const smocoA = a.originale.map((r, i) => [r, a.generato[i]]).filter(([r]) => rigaSmoco(r));
verifica('le righe di SMOCO restano identiche (il suo «Responsabile della Logistica», il suo telefono, la sua email)', smocoA.length === 2 && smocoA.every(([x, y]) => x === y)
  && tuttoA.includes('Responsabile della Logistica; Tel. 099 7777777'), JSON.stringify(smocoA.filter(([x, y]) => x !== y)));
verifica('«LOGISTICA» da solo non prende la parola «Logistica» di SMOCO', !a.proposta.punti.some(p => p.occorrenze.some(o => o.attiva && /Responsabile della/.test(o.contesto))));
verifica('le persone e la firma di SMOCO restano: nome, carica, privacy', (tuttoA.match(/Montanaro/gi) || []).length === 3 && a.generato[12] === 'Amministratore Delegato' && a.generato[13] === 'Stefano MONTANARO'
  && tuttoA.includes('per SMOCO è fisicamente rappresentato dal suo legale rappresentante Sig. Stefano Montanaro'), a.generato.slice(11, 17).join(' | '));
verifica('nessun punto del format finto e\' da controllare (li ha presi tutti)', !(a.proposta.da_controllare || []).length, JSON.stringify(a.proposta.punti.filter(p => p.da_controllare).map(p => [p.segnaposto, p.da_controllare])));

console.log('IL FORMAT FINTO CON «Sig.re», FIRME IN TABELLA E UN COGNOME DA SOLO');
const formatB = docx([
  'CONTRATTO DI RACCOLTA PFU PER L\'ANNO 2026',
  `SMOCO S.R.L., con sede in S.S. Appia km 636+700, 74016 Massafra (TA), Iscrizione al Registro Imprese di Taranto ${CF_SMOCO}, rappresentato dall'Amministratore Delegato Sig. Angelo Raffaele Fornari (di seguito "SMOCO")`,
  'ROSSI AMBIENTE S.R.L., con sede in Via Napoli 3, 74100 Taranto (TA), Codice Fiscale, Partita IVA e Iscrizione al Registro Imprese di Taranto 09876543210, rappresentato dall\'Amministratore Unico Sig.re Pierpaolo Bianchi (di seguito il "FORNITORE")',
  'Il presente contratto è valido dal 02 Gennaio 2026 e sino al 31 dicembre 2026.',
  'Per le urgenze il FORNITORE indica il Sig. Bianchi.',
  'Massafra, 02 Gennaio 2026',
  'SMOCO S.R.L.',
  'ROSSI AMBIENTE S.R.L.',
  'Angelo Raffaele Fornari',
  'PierPaolo Bianchi',
  'Amministratore Delegato',
  'Amministratore Unico',
]);
const b = await giro(formatB, 'raccolta');
const tuttoB = b.generato.join('\n');
const pB = (s) => b.proposta.punti.find(x => x.segnaposto === s);
verifica('«Sig.re» e\' un titolo: il nome e\' «Pierpaolo Bianchi», non «re Pierpaolo Bianchi»', pB('FORNITORE_RAPPRESENTANTE')?.originale === 'Pierpaolo Bianchi', pB('FORNITORE_RAPPRESENTANTE')?.originale);
verifica('il nome sotto la firma, con le maiuscole diverse, si cambia', !/PierPaolo/i.test(tuttoB), b.generato.filter(r => /Pierpaolo/i.test(r)).join(' | '));
verifica('la camera di commercio del fornitore si cambia, quella di SMOCO uguale no', tuttoB.includes(`Registro Imprese di Taranto ${CF_SMOCO}`) && tuttoB.includes('Registro Imprese di Lecce 11122233344'), b.generato.slice(1, 3).join(' | '));
verifica('firme in una tabella letta cella per cella: la carica di SMOCO resta, quella del fornitore cambia', b.generato[10] === 'Amministratore Delegato' && b.generato[11] === 'Legale Rappresentante', b.generato.slice(6).join(' | '));
verifica('il cognome da solo resta, ma la proposta lo segna da controllare invece di dare il punto per completo', /Sig\. Bianchi/.test(tuttoB) && pB('FORNITORE_RAPPRESENTANTE')?.da_controllare?.length > 0
  && (b.proposta.da_controllare || []).includes('FORNITORE_RAPPRESENTANTE') && pB('FORNITORE_RAPPRESENTANTE')?.occorrenze?.some(o => o.dubbia && !o.attiva && o.testo === 'Bianchi'), JSON.stringify(pB('FORNITORE_RAPPRESENTANTE')?.da_controllare));
verifica('il nome di due parole si cambia ovunque senza distinguere le maiuscole', !/Rossi Ambiente/i.test(tuttoB));

// Seconda revisione del 13/10/2026: i recapiti di SMOCO scritti in una riga
// del fornitore (dopo il suo nome o in coda alle sue comunicazioni) e la carica
// scritta dopo il nome del rappresentante, anche «in qualità di».
console.log('IL FORMAT FINTO CON RECAPITI DI SMOCO NELLE RIGHE DEL FORNITORE E LA CARICA DOPO IL NOME');
const formatC = docx([
  'CONTRATTO DI TRATTAMENTO PFU PER L\'ANNO 2026',
  `SMOCO S.R.L., con sede in S.S. Appia km 636+700, 74016 Massafra (TA), Iscrizione al Registro Imprese di Taranto ${CF_SMOCO}, rappresentato dall'Amministratore Delegato Avv. Stefano Montanaro (di seguito "SMOCO")`,
  'BETA RECUPERI S.R.L., con sede in Via Verdi 2, 80100 Napoli (NA), Codice Fiscale, Partita IVA e Iscrizione al Registro Imprese di Napoli 05556667778, rappresentato da Carlo Neri in qualità di Amministratore Unico (di seguito il "FORNITORE")',
  'Il referente SMOCO per i ritiri presso BETA RECUPERI S.R.L. è il sig. Paolo Bruni, Tel. 099 8888888.',
  '• quanto al FORNITORE, Via Verdi 2, 80100 Napoli (NA), rappresentato da Carlo Neri in qualità di Amministratore Unico, Tel. 081 1234567, e-mail info@beta.example; in copia al referente SMOCO, Tel. 099 7654321, e-mail ritiri@gmail.example.',
  'Massafra, 02 Gennaio 2026',
  'SMOCO S.R.L.',
  'Amministratore Delegato',
  'Stefano MONTANARO',
  'BETA RECUPERI S.R.L.',
  'Carlo Neri Amministratore Unico',
]);
const cc = await giro(formatC, 'trattamento', { FORNITORE_QUALIFICA: 'Socio Accomandatario' });
const tuttoC = cc.generato.join('\n');
const pC = (s) => cc.proposta.punti.find(x => x.segnaposto === s);
verifica('il telefono del referente SMOCO in una riga col nome del fornitore resta', tuttoC.includes('Paolo Bruni, Tel. 099 8888888') && tuttoC.includes('presso ALTRO FORNITORE S.R.L.'), cc.generato[3]);
verifica('nelle comunicazioni del fornitore il telefono e l\'email scritti dopo SMOCO restano, i suoi si cambiano', tuttoC.includes('in copia al referente SMOCO, Tel. 099 7654321, e-mail ritiri@gmail.example')
  && !/081 1234567|info@beta\.example/.test(tuttoC) && pC('FORNITORE_TEL')?.originale === '081 1234567', cc.generato[4]);
verifica('nessun recapito di SMOCO diventa un punto acceso', !cc.proposta.punti.some(p => /TEL|EMAIL/.test(p.segnaposto) && p.occorrenze.some(o => o.attiva && /8888888|7654321|ritiri@/.test(o.testo))),
  JSON.stringify(cc.proposta.punti.filter(p => /TEL|EMAIL/.test(p.segnaposto)).map(p => [p.segnaposto, p.originale])));
verifica('i numeri delle righe che parlano anche di SMOCO si mostrano spenti, da controllare', (pC('FORNITORE_TEL')?.da_controllare || []).some(m => /SMOCO/.test(m))
  && ['099 8888888', '099 7654321'].every(n => pC('FORNITORE_TEL').occorrenze.some(o => o.testo === n && !o.attiva && o.dubbia)), JSON.stringify(pC('FORNITORE_TEL')));
verifica('la carica dopo il nome si cambia: «in qualità di» nelle comunicazioni e accanto alla firma', !/Amministratore Unico/.test(tuttoC)
  && (tuttoC.match(/Mario Ferri in qualità di Socio Accomandatario/g) || []).length === 2 && cc.generato[10] === 'Mario Ferri Socio Accomandatario', cc.generato.filter(r => /Ferri/.test(r)).join(' | '));
verifica('la carica e la persona di SMOCO restano', (tuttoC.match(/Amministratore Delegato/g) || []).length === 2 && cc.generato[7] === 'Amministratore Delegato' && cc.generato[8] === 'Stefano MONTANARO');

// Il rilievo sulla seconda revisione del 13/10/2026: nei contratti di trasporto
// il domicilio del vettore nelle comunicazioni comincia dopo il suo nome, o
// dopo «presso», e puo' non avere la provincia fra parentesi; i dati della sua
// iscrizione agli albi non sono solo i numeri.
// Accende le occorrenze spente e dubbie dei punti dati (quello che fa l'amministratore).
const accendiDubbie = (...segnaposti) => (punti) => punti.map(p => {
  if (!segnaposti.includes(p.segnaposto)) return p;
  const occorrenze = p.occorrenze.map(o => (o.dubbia && !o.attiva ? { ...o, attiva: true } : o));
  return { ...p, occorrenze, attivo: occorrenze.some(o => o.attiva) };
});
const ISCRIZIONE_ALTRO = { FORNITORE_ALBO_PROVINCIA: 'LECCE', FORNITORE_ALBO_CLASSE: 'D', FORNITORE_ISCRIZIONE: 'LE/1112223/X', FORNITORE_ISCRIZIONE_2: 'BA99999', FORNITORE_ISCRIZIONE_3: 'M0099999', FORNITORE_ISCRIZIONE_DATA: '01/02/2027' };
const TRASPORTO = (vettore, comunicazioni, gestori) => docx([
  'CONTRATTO SERVIZI DI TRASPORTO SU STRADA PER L\'ANNO 2026',
  `Smoco S.r.l., con sede in Massafra (TA), Strada Statale 7 Appia km 636+700 snc, C.F. e P. IVA n. ${CF_SMOCO}, nel presente contratto rappresentata dall'Amministratore Delegato Angelo Raffaele Fornari (di seguito indicata come Committente);`,
  'E',
  vettore,
  'Il Committente è iscritto all\'Albo Nazionale Gestori Ambientali con n. BA11513 del 16.05.2025 in categoria 8 classe “A”.',
  'Il Vettore è impresa iscritta all\'Albo Nazionale delle Persone Fisiche e Giuridiche che esercitano l\'attività di autotrasporto di cose per conto terzi della Provincia di Reggio nell\'Emilia, al n. RE/1234567/K;',
  gestori,
  'Il Vettore è, altresì, iscritto al REN (Registro Elettronico Nazionale delle Imprese), autorizzato all\'esercizio della professione di autotrasportatore di merci su strada al n. M0012345;',
  'Il presente contratto è valido dal 02/01/2026 e sino al 31/12/2026.',
  'Il Vettore e il Committente eleggono domicilio fisico e digitale come segue:',
  comunicazioni,
  'quanto al Committente Smoco S.r.l., con sede in Massafra (TA), Strada Statale 7 Appia km 636+700 snc; indirizzo pec info@pec.smoco.it',
]);
console.log('I FORMAT FINTI DEL TRASPORTO: IL DOMICILIO DEL VETTORE NELLE COMUNICAZIONI E I DATI DELLA SUA ISCRIZIONE');
const formatD = TRASPORTO(
  'GAMMA TRASPORTI S.R.L., con sede in Via Etnea 10, 95100 Catania (CT), Codice Fiscale, Partita IVA e Iscrizione al Registro Imprese di Catania 04445556667, rappresentato dall\'Amministratore Unico Sig. Piero Russo (di seguito indicata come Vettore);',
  '- quanto al Vettore GAMMA TRASPORTI S.r.l. presso Acireale (CT) indirizzo pec gamma@pec.example;',
  'Il Vettore è impresa iscritta all\'Albo Nazionale Gestori Ambientali che esercitano l\'attività di autotrasporto di cose per conto terzi nella categoria 4 classe B con n. CT00123 (decr. Prot. 1234/2023 del 02/03/2023, validità dal 05/03/2023 al 05/03/2028);',
);
const formatE = TRASPORTO(
  'DELTA SRL, con sede in Via Napoli 40, 70122 Bari (BA), Codice Fiscale, Partita IVA e Iscrizione al Registro Imprese di Bari 07778889990, rappresentato dall\'Amministratore Unico Sig. Gino Bruno (di seguito indicata come Vettore);',
  '- quanto al Vettore Delta srl presso Via Napoli 40, indirizzo pec delta@pec.example;',
  'Il Vettore è impresa iscritta all\'Albo Nazionale Gestori Ambientali che esercitano l\'attività di autotrasporto di cose per conto terzi nella categoria 4 classe C con n. BA00456 del 14/12/2022;',
);
const formatF = TRASPORTO(
  'ZETA TRASPORTI S.R.L., con sede in Via Po 3, 10100 Torino (TO), Codice Fiscale, Partita IVA e Iscrizione al Registro Imprese di Torino 08889990001, rappresentato dall\'Amministratore Unico Sig. Ugo Neri (di seguito indicata come Vettore);',
  '- quanto al Vettore: Spett.le ZETA TRASPORTI S.R.L., Via Po 3/A, Torino (TO), pec zeta@pec.example;',
  'Il Vettore è impresa iscritta all\'Albo Nazionale Gestori Ambientali che esercitano l\'attività di autotrasporto di cose per conto terzi nella categoria 4 classe E con n. TO00789 del 01/06/2021;',
);
for (const [nome, f, domicilio, vecchi] of [
  ['col nome e la provincia fra parentesi', formatD, 'Acireale (CT)', ['Reggio nell\'Emilia', 'RE/1234567/K', 'classe B', 'CT00123', 'Prot. 1234/2023', '05/03/2028', 'M0012345']],
  ['senza la provincia fra parentesi', formatE, 'Via Napoli 40', ['Reggio nell\'Emilia', 'RE/1234567/K', 'classe C', 'BA00456', '14/12/2022', 'M0012345']],
  ['con «Spett.le» davanti al nome e l\'indirizzo dopo la virgola', formatF, 'Via Po 3/A, Torino (TO)', ['Reggio nell\'Emilia', 'RE/1234567/K', 'classe E', 'TO00789', '01/06/2021', 'M0012345']],
]) {
  const g = await giro(f, 'trasporto_secondaria');
  const sede = g.proposta.punti.find(x => x.segnaposto === 'FORNITORE_SEDE_LEGALE');
  const riga = g.generato.find(r => /quanto al Vettore/.test(r));
  verifica(`trasporto ${nome}: il domicilio del vettore di partenza nelle comunicazioni e' un'occorrenza spenta della sede, e la sede e' da controllare`,
    (g.proposta.da_controllare || []).includes('FORNITORE_SEDE_LEGALE') && sede?.occorrenze.some(o => o.testo === domicilio && !o.attiva && o.dubbia), JSON.stringify(sede?.occorrenze.map(o => [o.testo, o.attiva, o.motivo])));
  const dati = ['FORNITORE_ALBO_PROVINCIA', 'FORNITORE_ALBO_CLASSE', 'FORNITORE_ISCRIZIONE_DATA', 'FORNITORE_ISCRIZIONE'];
  verifica(`trasporto ${nome}: provincia, classe e data dell'iscrizione del vettore sono da controllare insieme ai numeri`, dati.every(s => (g.proposta.da_controllare || []).includes(s)), JSON.stringify(g.proposta.da_controllare));
  // Per parte e indice della riga, non per il contesto: il contesto e' di 40
  // caratteri, e numero, data e classe di SMOCO stanno piu' in la' di
  // «Committente è iscritto» (ultimo giro della revisione del 13/10/2026: un
  // lettore che li segnava da controllare passava lo stesso).
  const kSmoco = g.originale.findIndex(r => RIGA_ISCRIZIONE_SMOCO.test(r));
  const suSmoco = kSmoco < 0 ? ['(la riga non c\'e\')'] : occorrenzeNellaRiga(g, kSmoco);
  verifica(`trasporto ${nome}: i dati d'iscrizione di SMOCO non sono toccati ne' segnati`, kSmoco >= 0 && !suSmoco.length
    && g.generato[kSmoco] === g.originale[kSmoco] && g.generato[kSmoco].includes('con n. BA11513 del 16.05.2025 in categoria 8 classe “A”'), suSmoco.join(' | '));
  // Acceso dall'amministratore, il domicilio diventa la sede del fornitore nuovo,
  // e i dati d'iscrizione i suoi.
  const acceso = await giro(f, 'trasporto_secondaria', ISCRIZIONE_ALTRO, accendiDubbie('FORNITORE_SEDE_LEGALE', 'FORNITORE_ISCRIZIONE', 'FORNITORE_ISCRIZIONE_2', 'FORNITORE_ISCRIZIONE_3', ...dati));
  const rigaAccesa = acceso.generato.find(r => /quanto al Vettore/.test(r));
  const tutto = acceso.generato.join('\n');
  // Il resto della riga resta quello del contratto generato senza accendere niente.
  verifica(`trasporto ${nome}: acceso, il domicilio diventa la sede del fornitore nuovo`, !!riga && riga.includes(domicilio) && /ALTRO FORNITORE S\.R\.L\./.test(riga)
    && rigaAccesa === riga.replace(domicilio, ALTRO.FORNITORE_SEDE_LEGALE) && !acceso.modello.saltate.length, `${riga} => ${rigaAccesa}`);
  const restano = vecchi.filter(v => tutto.includes(v));
  verifica(`trasporto ${nome}: accesi, nessun dato d'iscrizione del vettore di partenza resta`, !restano.length && tutto.includes('della Provincia di LECCE, al n. LE/1112223/X') && tutto.includes('classe D con n. BA99999'), restano.join(', '));
}

// Ultimo giro della revisione del 13/10/2026: il nome scritto come sigla col
// punto (i contratti di RPN e MGM) e una coda del nome che il lettore non
// prende, prima di «con sede in», «sede legale in» o «domiciliata in». La sede
// nelle comunicazioni comincia dall'indirizzo, e accesa la riga resta la stessa
// con la sede nuova; la coda del nome non resta senza avviso.
console.log('I FORMAT FINTI COL NOME IN SIGLA E CON UNA CODA DEL NOME PRIMA DELLA SEDE');
const RACCOLTA = (fornitore, comunicazioni, firma) => docx([
  'CONTRATTO DI RACCOLTA PFU PER L\'ANNO 2026',
  `SMOCO S.R.L., con sede in S.S. Appia km 636+700, 74016 Massafra (TA), Iscrizione al Registro Imprese di Taranto ${CF_SMOCO}, rappresentato dall'Amministratore Delegato Avv. Stefano Montanaro (di seguito "SMOCO")`,
  fornitore,
  'Il presente contratto è valido dal 02 Gennaio 2026 e sino al 31 dicembre 2026.',
  comunicazioni,
  'SMOCO S.R.L.',
  firma,
]);
{
  const g = await giro(RACCOLTA(
    'V.P.N. S.R.L., con sede in Località Pezze, Zona ASI, Eboli (SA), Codice Fiscale, Partita IVA e Iscrizione al Registro Imprese di Salerno 03334445556, rappresentato dall\'Amministratore Unico Sig. Rocco Verdi (di seguito il "FORNITORE")',
    '• quanto al FORNITORE, V.P.N. S.R.L. con sede in Località Pezze, Zona ASI, Eboli',
    'V.P.N. S.R.L.  _____________________',
  ), 'raccolta');
  const rs = g.proposta.punti.find(p => p.segnaposto === 'FORNITORE_RAGIONE_SOCIALE');
  verifica('sigla col punto: il nome si prende intero, «V.P.N. S.R.L.», in tutte e tre le righe', rs?.originale === 'V.P.N. S.R.L.' && rs.occorrenze.filter(o => o.attiva && o.testo === 'V.P.N. S.R.L.').length === 3,
    JSON.stringify(rs?.occorrenze.map(o => o.testo)));
  verifica('sigla col punto: nel contratto nuovo non resta «. S.R.L.» dopo il nome nuovo', !g.generato.some(r => /S\.R\.L\.\.|V\.P\.N/.test(r)), g.generato.filter(r => /S\.R\.L\.\.|V\.P\.N/.test(r)).join(' || '));
  const sede = g.proposta.punti.find(p => p.segnaposto === 'FORNITORE_SEDE_LEGALE');
  verifica('sigla col punto: la sede nelle comunicazioni e\' un\'occorrenza spenta che comincia dall\'indirizzo', sede.occorrenze.filter(o => o.dubbia).map(o => o.testo).join('|') === 'Località Pezze, Zona ASI, Eboli',
    JSON.stringify(sede.occorrenze.map(o => [o.testo, o.attiva])));
  const acceso = await giro(RACCOLTA(
    'V.P.N. S.R.L., con sede in Località Pezze, Zona ASI, Eboli (SA), Codice Fiscale, Partita IVA e Iscrizione al Registro Imprese di Salerno 03334445556, rappresentato dall\'Amministratore Unico Sig. Rocco Verdi (di seguito il "FORNITORE")',
    '• quanto al FORNITORE, V.P.N. S.R.L. con sede in Località Pezze, Zona ASI, Eboli',
    'V.P.N. S.R.L.  _____________________',
  ), 'raccolta', {}, accendiDubbie('FORNITORE_SEDE_LEGALE'));
  verifica('sigla col punto: accesa, «• quanto al FORNITORE, ALTRO FORNITORE S.R.L. con sede in Via Dante 9, 73100 Lecce (LE)»', acceso.generato[4] === `• quanto al FORNITORE, ALTRO FORNITORE S.R.L. con sede in ${ALTRO.FORNITORE_SEDE_LEGALE}`, acceso.generato[4]);
}
for (const introduce of ['con sede in', ', sede legale in', 'domiciliata in']) {
  const f = RACCOLTA(
    'OMEGA S.R.L., con sede in Via Roma 1, 80100 Napoli (NA), Codice Fiscale, Partita IVA e Iscrizione al Registro Imprese di Napoli 06667778889, rappresentato dall\'Amministratore Unico Sig. Rino Gallo (di seguito il "FORNITORE")',
    `• quanto al FORNITORE, OMEGA S.R.L. Unipersonale${introduce.startsWith(',') ? '' : ' '}${introduce} Via Toledo 5, Napoli`,
    'OMEGA S.R.L.',
  );
  const g = await giro(f, 'raccolta');
  const sede = g.proposta.punti.find(p => p.segnaposto === 'FORNITORE_SEDE_LEGALE');
  const rs = g.proposta.punti.find(p => p.segnaposto === 'FORNITORE_RAGIONE_SOCIALE');
  verifica(`coda del nome prima di «${introduce.replace(/^, /, '')}»: la sede nelle comunicazioni e' un'occorrenza spenta «Via Toledo 5, Napoli»`,
    sede.occorrenze.filter(o => o.dubbia && !o.attiva).map(o => o.testo).join('|') === 'Via Toledo 5, Napoli' && (g.proposta.da_controllare || []).includes('FORNITORE_SEDE_LEGALE'), JSON.stringify(sede.occorrenze.map(o => [o.testo, o.attiva])));
  verifica(`coda del nome prima di «${introduce.replace(/^, /, '')}»: il nome e' da controllare, e il motivo dice la coda «Unipersonale»`,
    (g.proposta.da_controllare || []).includes('FORNITORE_RAGIONE_SOCIALE') && (rs.da_controllare || []).some(m => m.includes('«Unipersonale»')), JSON.stringify(rs.da_controllare));
  const acceso = await giro(f, 'raccolta', {}, accendiDubbie('FORNITORE_SEDE_LEGALE'));
  const attesa = `• quanto al FORNITORE, ALTRO FORNITORE S.R.L. Unipersonale${introduce.startsWith(',') ? '' : ' '}${introduce} ${ALTRO.FORNITORE_SEDE_LEGALE}`;
  verifica(`coda del nome prima di «${introduce.replace(/^, /, '')}»: accesa, la riga tiene le sue parole e prende la sede nuova`, acceso.generato[4] === attesa && !acceso.modello.saltate.length, acceso.generato[4]);
}

// ─── la sezione: i punti da controllare si vedono e non si danno per buoni ───

console.log('LA SEZIONE «MODELLI DEI CONTRATTI»: I PUNTI DA CONTROLLARE');
const sezione = existsSync(new URL('../src/components/qualifica/ModelliContratti.jsx', import.meta.url))
  ? readFileSync(new URL('../src/components/qualifica/ModelliContratti.jsx', import.meta.url), 'utf8').replace(/\r/g, '') : '';
verifica('ogni punto da controllare ha il segno e i motivi', /p\.da_controllare\s*&&\s*!p\.controllato/.test(sezione) && /da controllare/.test(sezione) && /p\.da_controllare\.map\(/.test(sezione));
verifica('l\'amministratore lo segna come controllato', /controllato:\s*true/.test(sezione) && /ho controllato/i.test(sezione));
verifica('con punti ancora da controllare il modello si salva solo al secondo clic, e la nota lo dice', /if \(nonControllati\.length && !avvisoControllo\)/.test(sezione) && /Punti lasciati da controllare/.test(sezione), sezione.match(/const salva[\s\S]{0,600}/)?.[0]?.slice(0, 300));

// ─── i contratti veri ───

const CARTELLA = 'C:/Users/HOME/Desktop/ECOTYRE/ECOTYRE - repository/2026/CONTRATTI SUBFORNITORI/';
// Per ogni contratto: il nome del fornitore (espressioni, senza distinguere le
// maiuscole), le persone (rappresentante e referenti), la camera di commercio,
// l'anno; adAnche: il fornitore e' anche lui «Amministratore Delegato».
const CONTRATTI = [
  { tipo: 'trattamento', file: 'GATIM/2026/inviati/Contratto Rete 2026 Gatim_TRATTAMENTO RETE.docx', nomi: ['GATIM'], persone: ['Azzarito', 'Domenico'], cciaa: 'di Catanzaro' },
  { tipo: 'raccolta', file: 'GATIM/2026/inviati/Contratto ACI 2026 - GATIM - Raccolta.docx', nomi: ['GATIM'], persone: ['Azzarito', 'Domenico'], cciaa: 'di Catanzaro' },
  { tipo: 'trattamento', file: 'IRIGOM/2026/Contratto Rete 2026 Irigom_TRATTAMENTO RETE.docx', nomi: ['IRIGOM'], persone: ['Montanaro'], cciaa: 'di Taranto', adAnche: true },
  { tipo: 'trattamento', file: 'IRIGOM/2026/Contratto ACI SMOCO 2026 - Irigom - Impianto.docx', nomi: ['IRIGOM'], persone: ['Montanaro'], cciaa: 'di Taranto', adAnche: true, controllare: ['FORNITORE_SEDE_LEGALE'] },
  { tipo: 'raccolta', file: 'GREEN TYRE PROJECT/2026/inviati/Contratto Green Tyre Project_RACCOLTA 2026_RETE.docx', nomi: ['GREEN\\s+TYRE'], persone: ['Pisa', 'Valentina'], cciaa: 'di Palermo ed Enna' },
  { tipo: 'trattamento', file: 'GREEN TYRE PROJECT/2026/inviati/Contratto Green Tyre Project_2026_TRATTAMENTO RETE.docx', nomi: ['GREEN\\s+TYRE'], persone: ['Pisa', 'Valentina'], cciaa: 'di Palermo ed Enna' },
  { tipo: 'raccolta', file: 'GREEN TYRE PROJECT/2026/ACI/Contratto ACI 2026 - GREEN TYRE PROJECT - Raccolta e Trattamento_Rev_1.docx', nomi: ['GREEN\\s+TYRE'], persone: ['Pisa', 'Valentina'], cciaa: 'della Sicilia' },
  { tipo: 'raccolta', file: 'CL SERVICE/2026/inviati/C.L. SERVICE_ Rete Raccolta 2026.docx', nomi: ['C\\.L\\.\\s*SERVICE'], persone: ['Bonavita', 'Tiziana'], cciaa: 'di Salerno' },
  { tipo: 'raccolta', file: 'ECORECUPERI/2026/inviati/Ecorecuperi_ Rete 2026 Raccolta.docx', nomi: ['ECORECUPERI'], persone: ['Basile', 'Giuseppe'], cciaa: 'di Isernia' },
  { tipo: 'raccolta', file: 'LOG E PNE/2026/inviati/LOGISTICA & PNEUMATICI_ Rete 2026 Raccolta.docx', nomi: ['LOGISTICA\\s*&\\s*PNEUMATICI'], persone: ['Landi', 'Raffaele'], cciaa: 'della  Napoli' },
  { tipo: 'raccolta', file: 'NAPPI SUD/2026/inviati/Contratto NAPPI SUD Raccolta 2026_RETE.docx', nomi: ['NAPPI\\s+SUD'], persone: ['Bianco', 'Caterina'], cciaa: 'di Salerno' },
  { tipo: 'stoccaggio', file: 'NAPPI SUD/2026/inviati/Contratto 2026 NAPPI SUD_Stoccaggio pfu.docx', nomi: ['NAPPI\\s+SUD'], persone: ['Bianco', 'Caterina'], cciaa: 'di Salerno' },
  { tipo: 'raccolta', file: 'NAPPI SUD/2026/inviati/Contratto ACI 2026 - NAPPI SUD - Raccolta e stoccaggio.docx', nomi: ['NAPPI\\s+SUD'], persone: ['Bianco', 'Caterina'], cciaa: 'di Salerno', controllare: ['FORNITORE_SEDE_LEGALE', 'FORNITORE_PIVA', 'FORNITORE_CCIAA'] },
  { tipo: 'raccolta', file: 'PNEUSERVICE/2026/inviati/Pneuservice Conversano 2026 contratto Ricambio Rete.docx', nomi: ['PNEUSERVICE'], persone: ['Turco', 'Lorenzo'], cciaa: 'di Bari' },
  { tipo: 'trattamento', file: 'TRS/2026/inviati/Contratto Rete 2026 TRS_granulazione.docx', nomi: ['T\\.R\\.S\\.', 'Tyres\\s+Recycling'], persone: ['Farenga', 'Gerardo'], cciaa: 'della Basilicata' },
  { tipo: 'trattamento', file: 'TRS/2026/Contratto ACI (format) - TRS - Trattamento-Granulazione_Rev_1.docx', nomi: ['T\\.R\\.S\\.', 'Tyres\\s+Recycling'], persone: ['Farenga', 'Gerardo'], cciaa: 'della Basilicata' },
  { tipo: 'trasporto_secondaria', file: 'AUTOTRASPORTI IELAPI/Contratto Servizi Trasporto_IELAPI 2026.docx', nomi: ['Ielapi'], persone: ['Cunocchiella'], cciaa: 'di Catanzaro, Crotone e Vibo Valentia', controllare: ['FORNITORE_ISCRIZIONE', 'FORNITORE_ALBO_PROVINCIA'] },
  { tipo: 'trasporto_secondaria', file: 'LOGISTICA SRL/2026/Contratto Servizi Trasporto_Logistica srl - 2026.docx', nomi: ['LOGISTICA\\s*SRL'], persone: ['Nappi', 'Nunziostefano', 'Pingaro'], cciaa: 'di Salerno', controllare: ['FORNITORE_ISCRIZIONE', 'FORNITORE_ALBO_PROVINCIA', 'FORNITORE_SEDE_LEGALE'] },
  { tipo: 'trasporto_secondaria', file: 'ECOSERVICE SRL/Contratto Servizi Trasporto_ECOSERVICE 2026.docx', nomi: ['ECOSERVICE'], persone: ['Rinaldo', 'Albano', 'Alfredo'], cciaa: 'di Toscana Nord-Ovest', controllare: ['FORNITORE_ISCRIZIONE', 'FORNITORE_ALBO_PROVINCIA', 'FORNITORE_SEDE_LEGALE'] },
  { tipo: 'raccolta', file: 'MINERVINI/Contratto ACI 2026 - MG di Minervini Giuliano - Raccolta ok.docx', nomi: ['Minervini'], persone: ['Minervini', 'Giuliano'], cciaa: 'di Cosenza' },
  { tipo: 'trattamento', file: 'TECNOGUM/Contratto Rete 2026 Tecnogum_Impianto.docx', nomi: ['TECNOGUM'], persone: ['Ezio'], cciaa: null, adAnche: true },
  { tipo: 'raccolta', file: 'ECOLOGICAL SYSTEMS/2026/inviati/Contratto raccolta rete 2026_Ecological Systems.docx', nomi: ['ECOLOGICAL\\s+SYSTEMS'], persone: ['Farenga', 'Gerardo'], cciaa: 'della Basilicata' },
  // gli otto format della prova prove/modelliContratto.mjs
  { tipo: 'raccolta', file: 'Contratto Raccolta 2026_RETE MODIFICATO.docx', nomi: ['GATIM'], persone: ['Azzarito', 'Domenico'], cciaa: 'di Catanzaro' },
  { tipo: 'trattamento', file: '[RIFERIMENTO GRETA] - Contratto ACI 2026 - TECNOGUM - Impianto_Rev_1.docx', nomi: ['TECNOGUM'], persone: ['Ezio'], cciaa: null, adAnche: true },
  { tipo: 'raccolta', file: 'EMMESSE/2026/Contratto ACI 2026 - EMMESSE - Raccolta_Rev_3.docx', nomi: ['EMMESSE'], persone: ['Siciliano'], cciaa: null },
  { tipo: 'trattamento', file: 'GATIM/ACI 2026 - dal 01-03-2026/Contratto ACI 2026 - GATIM - Impianto_Rev_1.docx', nomi: ['GATIM'], persone: ['Azzarito', 'Domenico'], cciaa: 'di Catanzaro' },
  { tipo: 'raccolta', file: 'ECORECUPERI/2024/Ecorecuperi_ACI 2024 Raccolta&stoccaggio.docx', nomi: ['ECORECUPERI'], persone: ['Basile', 'Giuseppe'], cciaa: 'di Isernia', anno: 2024 },
  { tipo: 'stoccaggio', file: 'T-CYCLE/2026/Contratto 2026 T-CYCLE_Stoccaggio pfu.docx', nomi: ['T-Cycle'], persone: ['Costanzo', 'Guido'], cciaa: null },
  { tipo: 'trattamento', file: 'T-CYCLE/2026/Contratto 2026 T-CYCLE_TRATTAMENTO RETE.docx', nomi: ['T-Cycle'], persone: ['Costanzo', 'Guido'], cciaa: null },
  { tipo: 'trasporto_secondaria', file: 'Contratto Servizi Trasporto_ITA 2026.docx', nomi: [], persone: [], cciaa: null },
];
// Le persone di SMOCO che compaiono nei contratti: quante volte, prima e dopo.
const PERSONE_SMOCO = ['Montanaro', 'Fornari', 'Barbalinardo', 'Castellano'];

if (!existsSync(CARTELLA)) {
  console.log('I CONTRATTI VERI: la cartella dei contratti non c\'e\' su questo computer, salto questa parte');
} else {
  console.log(`I CONTRATTI VERI (${CONTRATTI.length}): IL CONTRATTO DI UN ALTRO FORNITORE DAL CONTRATTO COMPILATO`);
  let righeIscrizioneSmoco = 0;
  for (const c of CONTRATTI) {
    const nome = c.file.split('/').pop();
    if (!existsSync(CARTELLA + c.file)) { verifica(`${nome}: il file c'e'`, false); continue; }
    const g = await giro(new Uint8Array(readFileSync(CARTELLA + c.file)), c.tipo);
    const { proposta, modello, gen, originale, generato, posti } = g;
    const fuoriSmoco = generato.map((r, i) => (rigaSmoco(originale[i]) ? '' : r));
    const dove = (re) => generato.map((r, i) => [i, r]).filter(([i, r]) => !rigaSmoco(originale[i]) && re.test(r)).map(([i, r]) => `[${i}] ${r.trim().slice(0, 160)}`).slice(0, 3).join(' || ');
    verifica(`${nome}: stesse righe, nessuna occorrenza saltata, nessun segnaposto vuoto`, generato.length === originale.length && !modello.saltate.length && !gen.segnaposti_vuoti.length,
      JSON.stringify([generato.length, originale.length, modello.saltate, gen.segnaposti_vuoti]));
    for (const n of c.nomi) {
      const re = new RegExp(`(?<![\\p{L}\\d@.])${n}(?![\\p{L}\\d])`, 'iu');
      verifica(`${nome}: il nome «${n}» del fornitore di partenza non resta`, !fuoriSmoco.some(r => re.test(r)), dove(re));
    }
    for (const p of c.persone) {
      const re = new RegExp(`(?<![\\p{L}@.])${esc(p)}(?![\\p{L}])`, 'iu');
      verifica(`${nome}: la persona «${p}» del fornitore di partenza non resta`, !fuoriSmoco.some(r => re.test(r)), dove(re));
    }
    if (c.cciaa) {
      const re = new RegExp(`Imprese\\s+${esc(c.cciaa)}(?![\\p{L}])`, 'iu');
      verifica(`${nome}: la camera di commercio «${c.cciaa}» non resta`, !fuoriSmoco.some(r => re.test(r)), dove(re));
    }
    const telefoni = telefoniDi(originale);
    const restano = telefoni.filter(t => generato.some(r => numeriDi(r).includes(t)));
    verifica(`${nome}: nessun telefono del fornitore di partenza (${telefoni.length})`, !restano.length, restano.join(', '));
    const email = emailDi(originale);
    verifica(`${nome}: nessuna email del fornitore di partenza (${email.length})`, !email.some(e => generato.some(r => r.toLowerCase().includes(e.toLowerCase()))), email.filter(e => generato.some(r => r.includes(e))).join(', '));
    // Partita IVA e codice fiscale di undici cifre del paragrafo del fornitore
    // (Ecoservice ha un codice fiscale diverso dalla partita IVA).
    const fiscali = [...new Set(originale.filter(t => rigaFornitore(t) && /\(\s*di\s+seguito/i.test(t)).flatMap(t => t.match(/(?<!\d)\d{11}(?!\d)/g) || []))].filter(n => n !== CF_SMOCO);
    const fiscaliRestano = fiscali.filter(n => generato.some(r => new RegExp(`(?<!\\d)${n}(?!\\d)`).test(r)));
    verifica(`${nome}: nessuna partita IVA o codice fiscale del fornitore di partenza (${fiscali.length})`, !fiscaliRestano.length, fiscaliRestano.join(', '));
    // L'anno vecchio puo' restare solo dove la proposta l'ha spento con un motivo
    // certo (la data di un altro atto, una norma, un dato di SMOCO), o l'ha segnato da controllare.
    const anno = String(c.anno || 2026);
    const annoP = proposta.punti.find(x => x.segnaposto === 'ANNO');
    const nonSpiegati = [];
    generato.forEach((r, i) => {
      for (const m of r.matchAll(new RegExp(`(?<!\\d)${anno}(?!\\d)`, 'g'))) {
        const { parte, riga } = posti[i];
        const o = annoP && annoP.occorrenze.find(x => x.parte === parte && x.riga === riga && !x.attiva && originale[i].slice(x.da, x.a) === anno);
        const spiegato = o && (/altro atto|norma|SMOCO/.test(o.motivo) || (o.dubbia && annoP.da_controllare));
        if (!spiegato) nonSpiegati.push(`[${i}] …${r.slice(Math.max(0, m.index - 60), m.index + 10)}`);
      }
    });
    verifica(`${nome}: l'anno ${anno} resta solo dove la proposta lo spiega`, !nonSpiegati.length, nonSpiegati.slice(0, 3).join(' || '));
    // I dati di SMOCO non cambiano: le sue righe, le sue persone, la sua carica
    // sotto la firma. Tranne la data dell'Albo in categoria 8, che e' sempre il
    // 16/05/2025 (13/10/2026): la riga resta identica a meno di quella.
    const diverse = originale.map((r, i) => [i, r]).filter(([i, r]) => rigaSmoco(r) && generato[i] !== alboGiusto(r));
    verifica(`${nome}: le righe di SMOCO restano identiche, a meno della data dell'Albo`, !diverse.length, diverse.slice(0, 2).map(([i, r]) => `[${i}] ${r.slice(0, 120)} => ${generato[i].slice(0, 120)}`).join(' || '));
    const dateAlbo = originale.filter(r => alboGiusto(r) !== r).length;
    const corrette = (proposta.albo_smoco || []).filter(o => o.correggi).length;
    const avvisoAlbo = proposta.avvisi.some(a => /iscrizione di SMOCO all'Albo \(cat\. 8 BA-11513\) nel format è .*: quella in vigore è del 16\/05\/2025/.test(a));
    verifica(`${nome}: la data dell'Albo di SMOCO si corregge dove e' diversa dal 16/05/2025 (${dateAlbo} righe), e la proposta lo dice solo allora`,
      corrette >= dateAlbo && (dateAlbo ? avvisoAlbo : !avvisoAlbo) && generato.every(r => alboGiusto(r) === r), `${corrette} ${avvisoAlbo}`);
    // La riga dell'iscrizione di SMOCO agli albi (contratti di trasporto):
    // nessuna occorrenza nella riga, ne' accesa ne' spenta, e la riga identica.
    originale.forEach((t, i) => {
      if (!RIGA_ISCRIZIONE_SMOCO.test(t)) return;
      righeIscrizioneSmoco++;
      const su = occorrenzeNellaRiga(g, i);
      verifica(`${nome}: la riga dell'iscrizione di SMOCO non ha occorrenze ed esce identica`, !su.length && generato[i] === t, `[${i}] ${su.join(' | ')}`);
    });
    // Il nome nuovo senza la coda di quello vecchio: col nome preso piu' corto di
    // com'e' scritto («R.P.N» per «R.P.N. S.R.L.») il contratto diceva «ALTRO
    // FORNITORE S.R.L.. S.R.L.» (ultimo giro della revisione del 13/10/2026).
    const code = generato.filter(r => /ALTRO FORNITORE S\.R\.L\.[\s.,]*S\.?\s?R\.?\s?L/i.test(r));
    verifica(`${nome}: dopo il nome nuovo non resta la forma societaria di quello vecchio`, !code.length, code.slice(0, 2).map(r => r.trim().slice(0, 140)).join(' || '));
    const conta = (testo, re) => testo.reduce((n, r) => n + (r.match(re) || []).length, 0);
    const persone = PERSONE_SMOCO.filter(p => !c.persone.includes(p)).map(p => [p, new RegExp(`(?<![\\p{L}@.])${p}(?![\\p{L}])`, 'giu')]);
    const cambiate = persone.filter(([, re]) => conta(originale, re) !== conta(generato, re)).map(([p, re]) => `${p} ${conta(originale, re)}→${conta(generato, re)}`);
    verifica(`${nome}: le persone di SMOCO restano tutte`, !cambiate.length, cambiate.join(', '));
    if (!c.adAnche) {
      const re = /Amministratore\s+Delegato/gi;
      verifica(`${nome}: la carica di SMOCO («Amministratore Delegato») resta dove era`, conta(originale, re) === conta(generato, re), `${conta(originale, re)} → ${conta(generato, re)}`);
    }
    for (const s of c.controllare || []) {
      verifica(`${nome}: ${s} e' segnato da controllare`, proposta.punti.some(p => p.segnaposto.replace(/_\d+$/, '') === s && p.da_controllare), JSON.stringify(proposta.da_controllare));
    }
    // Gli altri contratti non hanno niente da controllare: un avviso in piu'
    // e' un punto che l'amministratore deve aprire per niente.
    if (!c.controllare) verifica(`${nome}: nessun punto da controllare`, !(proposta.da_controllare || []).length, JSON.stringify(proposta.punti.filter(p => p.da_controllare).map(p => [p.segnaposto, p.occorrenze.filter(o => o.dubbia).map(o => o.testo)])));
    // Un dato del fornitore di partenza che resta nel contratto generato dev'essere
    // un'occorrenza spenta e dubbia di un punto da controllare, nella stessa riga.
    const spiegatoDa = (i, prova) => {
      const { parte, riga } = posti[i];
      return proposta.punti.some(p => p.da_controllare && p.occorrenze.some(o => o.parte === parte && o.riga === riga && !o.attiva && o.dubbia && prova(o)));
    };
    // La sede del fornitore di partenza (rilievo sulla revisione del 13/10/2026):
    // il domicilio del vettore nelle comunicazioni restava senza avviso.
    const pezzi = pezziDellaSede(originale);
    const sediRestano = [];
    generato.forEach((r, i) => {
      if (rigaSmoco(originale[i])) return;
      for (const z of pezzi) if (z.re.test(r) && !spiegatoDa(i, o => o.testo === z.testo || z.re.test(o.testo))) sediRestano.push(`[${i}] «${z.testo}» ${r.trim().slice(0, 140)}`);
    });
    verifica(`${nome}: la sede del fornitore di partenza (${pezzi.map(z => z.testo).join(' | ')}) non resta, o la proposta la segna da controllare`, !sediRestano.length, sediRestano.slice(0, 3).join(' || '));
    // I dati d'iscrizione del vettore di partenza: provincia, classe, numeri, data.
    const iscrizioniRestano = [];
    originale.forEach((t, i) => {
      for (const d of datiIscrizione(t)) if (d.re.test(generato[i]) && !spiegatoDa(i, o => o.testo === d.valore)) iscrizioniRestano.push(`[${i}] «${d.valore}»`);
    });
    verifica(`${nome}: i dati d'iscrizione del vettore di partenza non restano, o la proposta li segna da controllare`, !iscrizioniRestano.length, iscrizioniRestano.slice(0, 4).join(' || '));
  }
  // Ielapi, Logistica srl ed Ecoservice hanno la riga dell'iscrizione di SMOCO:
  // la verifica della riga non deve passare a vuoto.
  verifica('la riga dell\'iscrizione di SMOCO c\'e\' in almeno tre contratti veri', righeIscrizioneSmoco >= 3, String(righeIscrizioneSmoco));

  // I casi dei rilievi, uno per uno.
  console.log('I CASI DEI RILIEVI');
  const caso = async (file, tipo, extra = {}, accendi = null) => giro(new Uint8Array(readFileSync(CARTELLA + file)), tipo, extra, accendi);
  const cl = await caso('CL SERVICE/2026/inviati/C.L. SERVICE_ Rete Raccolta 2026.docx', 'raccolta');
  const tcl = cl.generato.join('\n');
  verifica('C.L. Service: niente «Amministratrice Unica», «Bonavita», «cell.3938649605»; il cellulare ha il suo punto', !/Amministratrice|Bonavita|3938649605/i.test(tcl)
    && tcl.includes('cell.0832 222222') && cl.proposta.punti.some(p => p.segnaposto === 'FORNITORE_TEL_2' && p.originale === '3938649605'));
  const gt = await caso('GREEN TYRE PROJECT/2026/inviati/Contratto Green Tyre Project_RACCOLTA 2026_RETE.docx', 'raccolta');
  verifica('Green Tyre: niente «di Palermo ed Enna» nelle comunicazioni, ne\' «Di Pisa Valentina»', !/Palermo ed Enna|Di Pisa/i.test(gt.generato.join('\n')));
  const lo = await caso('LOGISTICA SRL/2026/Contratto Servizi Trasporto_Logistica srl - 2026.docx', 'trasporto_secondaria');
  const tlo = lo.generato.join('\n');
  verifica('Logistica srl: il Responsabile della Logistica di SMOCO e il suo telefono restano, «NunzioStefano Nappi» no', tlo.includes('Barbalinardo in qualità di Responsabile della Logistica; Tel. 348/7275982')
    && !/ALTRO FORNITORE S\.R\.L\.;/.test(tlo) && !/Nunzio/i.test(tlo) && lo.proposta.punti.find(p => p.segnaposto === 'FORNITORE_RAPPRESENTANTE')?.originale === 'Nunziostefano Nappi');
  const tc = await caso('T-CYCLE/2026/Contratto 2026 T-CYCLE_TRATTAMENTO RETE.docx', 'trattamento');
  verifica('T-Cycle trattamento: «mese di ________2026» diventa «________2027»', !tc.generato.join('\n').includes('________2026') && tc.generato.join('\n').includes('________2027'));
  // La carica del rappresentante scritta dopo il nome: con un rappresentante
  // nuovo di carica diversa non resta quella di Guido Costanzo (seconda revisione del 13/10/2026).
  const tcs = await caso('T-CYCLE/2026/Contratto 2026 T-CYCLE_Stoccaggio pfu.docx', 'stoccaggio', { FORNITORE_QUALIFICA: 'Socio Accomandatario' });
  verifica('T-Cycle stoccaggio: «Guido Costanzo Amministratore Unico» sotto la firma diventa nome e carica nuovi', !tcs.generato.some(r => /Ferri\s+Amministratore/.test(r))
    && tcs.generato.some(r => /^Mario Ferri Socio Accomandatario\s*$/.test(r)), tcs.generato.filter(r => /Ferri/.test(r)).join(' | '));
  const tct = await caso('T-CYCLE/2026/Contratto 2026 T-CYCLE_TRATTAMENTO RETE.docx', 'trattamento', { FORNITORE_QUALIFICA: 'Socio Accomandatario' });
  verifica('T-Cycle trattamento: «in qualità di Legale Rappresentante» cambia anche nelle comunicazioni', !tct.generato.some(r => /Ferri in qualità di Legale/.test(r))
    && tct.generato.filter(r => /Mario Ferri in qualità di Socio Accomandatario/.test(r)).length === 2, tct.generato.filter(r => /Ferri in qualit/.test(r)).map(r => r.slice(0, 260)).join(' | '));
  // Il rilievo sulla seconda revisione del 13/10/2026 (lo script del revisore
  // prova_indirizzo_vettore.mjs): il domicilio del vettore di partenza nelle
  // comunicazioni dei contratti di trasporto, e la provincia del suo albo.
  for (const [file, domicilio, provincia] of [
    ['ECOSERVICE SRL/Contratto Servizi Trasporto_ECOSERVICE 2026.docx', 'Carrara (MS)', 'MASSA CARRARA'],
    ['LOGISTICA SRL/2026/Contratto Servizi Trasporto_Logistica srl - 2026.docx', 'Via delle Industrie 78', 'SALERNO'],
  ]) {
    const breve = file.split('/').pop();
    const t = await caso(file, 'trasporto_secondaria');
    const dc = t.proposta.da_controllare || [];
    verifica(`${breve}: «presso ${domicilio}» e' un'occorrenza spenta della sede, e la sede e' da controllare`, dc.includes('FORNITORE_SEDE_LEGALE')
      && t.proposta.punti.find(p => p.segnaposto === 'FORNITORE_SEDE_LEGALE').occorrenze.some(o => o.testo === domicilio && !o.attiva && o.dubbia), JSON.stringify(dc));
    verifica(`${breve}: la provincia dell'albo «${provincia}» e' da controllare insieme al numero`, dc.includes('FORNITORE_ALBO_PROVINCIA') && dc.includes('FORNITORE_ISCRIZIONE')
      && t.proposta.punti.find(p => p.segnaposto === 'FORNITORE_ALBO_PROVINCIA').occorrenze.some(o => o.testo === provincia && !o.attiva), JSON.stringify(dc));
    const acceso = await caso(file, 'trasporto_secondaria', ISCRIZIONE_ALTRO, accendiDubbie('FORNITORE_SEDE_LEGALE', 'FORNITORE_ALBO_PROVINCIA'));
    const riga = acceso.generato.find(r => /quanto al Vettore/.test(r)) || '';
    verifica(`${breve}: acceso, il domicilio del vettore e' la sede del fornitore nuovo e la provincia la sua`, riga.includes(`presso ${ALTRO.FORNITORE_SEDE_LEGALE}`) && !riga.includes(domicilio)
      && acceso.generato.some(r => r.includes('della Provincia di LECCE, al n.')) && !acceso.modello.saltate.length, riga);
  }
  // Ultimo giro della revisione del 13/10/2026 (lo script del revisore
  // rpn_acceso.mjs): i contratti di RPN e di MGM, col nome scritto come sigla
  // col punto («R.P.N. S.R.L.», «M.G.M. S.r.l.»). Il nome preso era «R.P.N»:
  // la coda «. S.R.L.» restava nel contratto nuovo («ALTRO FORNITORE S.R.L..
  // S.R.L.»), e la sede nelle comunicazioni era un'occorrenza «. S.R.L. con sede
  // in Località …» che accesa dava «ALTRO FORNITORE S.R.L.Via Dante 9, …».
  for (const [file, tipo, nome, domicilio, intro] of [
    ['RPN/Contratto Stoccaggio Rete 2025 RPN.docx', 'stoccaggio', 'R.P.N. S.R.L.', 'Località Fosse Imperatore, Zona PIP, Nocera Inferiore', 'con sede in'],
    ['RPN/2024/Contratto Rete 2024 RPN.docx', 'raccolta', 'R.P.N. S.R.L.', 'Località Fosse Imperatore, Zona PIP, Nocera Inferiore', 'con sede in'],
    ['MGM/Contratto Servizi Trasporto_MGM 2026.docx', 'trasporto_secondaria', 'M.G.M. SRL', 'Albanella (SA)', 'presso'],
  ]) {
    const breve = file.split('/').pop();
    if (!existsSync(CARTELLA + file)) { verifica(`${breve}: il file c'e'`, false); continue; }
    const t = await caso(file, tipo);
    const rs = t.proposta.punti.find(p => p.segnaposto === 'FORNITORE_RAGIONE_SOCIALE');
    verifica(`${breve}: il nome si prende intero, con la forma societaria («${nome}»)`, rs?.originale === nome && rs.occorrenze.filter(o => o.attiva).every(o => /S\.?\s?R\.?\s?L\.?$/i.test(o.testo)),
      JSON.stringify(rs?.occorrenze.map(o => o.testo)));
    const tutto = t.generato.join('\n');
    verifica(`${breve}: nel contratto nuovo non resta la sigla ne' la coda del nome vecchio`, !/R\.P\.N|M\.G\.M/.test(tutto) && !/ALTRO FORNITORE S\.R\.L\.[\s.,]*S\.?\s?R\.?\s?L/i.test(tutto),
      t.generato.filter(r => /R\.P\.N|M\.G\.M|S\.R\.L\.\./i.test(r)).map(r => r.trim().slice(0, 120)).join(' || '));
    const sede = t.proposta.punti.find(p => p.segnaposto === 'FORNITORE_SEDE_LEGALE');
    const dubbie = sede.occorrenze.filter(o => o.dubbia && !o.attiva);
    verifica(`${breve}: la sede nelle comunicazioni e' un'occorrenza spenta che comincia dall'indirizzo («${domicilio}»), senza la coda del nome ne' «${intro}»`,
      dubbie.length === 1 && dubbie[0].testo === domicilio && (t.proposta.da_controllare || []).includes('FORNITORE_SEDE_LEGALE'), JSON.stringify(dubbie.map(o => o.testo)));
    const rigaSpenta = t.generato.find(r => /quanto al (?:FORNITORE|Vettore)/i.test(r)) || '';
    const acceso = await caso(file, tipo, {}, accendiDubbie('FORNITORE_SEDE_LEGALE'));
    const riga = acceso.generato.find(r => /quanto al (?:FORNITORE|Vettore)/i.test(r)) || '';
    verifica(`${breve}: accesa, la riga dice «ALTRO FORNITORE S.R.L. ${intro} ${ALTRO.FORNITORE_SEDE_LEGALE}» e il resto non cambia`,
      riga.includes(`ALTRO FORNITORE S.R.L. ${intro} ${ALTRO.FORNITORE_SEDE_LEGALE}`) && !riga.includes(domicilio) && riga === rigaSpenta.replace(domicilio, ALTRO.FORNITORE_SEDE_LEGALE)
      && !acceso.modello.saltate.length, `${rigaSpenta.trim()} => ${riga.trim()}`);
  }
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
