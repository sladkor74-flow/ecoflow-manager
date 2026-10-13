// I FILE DI ECOTYNA NATI DA UN ELENCO TAGLIATO (segnalazione alta A73 del
// 20/09/2026, corretta il 12/10/2026).
//
// Gli elenchi degli strumenti arrivano al modello tagliati (60 dei 268 punti di
// raccolta di Bari) o accorciati per stare nel prompt, e il file Excel o PDF il
// modello lo scrive con le righe che vede. La chat lo offriva lo stesso «quando la
// risposta e' un elenco lungo», e il file sembrava intero. Si controlla:
//   1. che gli elenchi tagliati si riconoscano nel blocco dei dati come entra nel
//      prompt: il taglio dello strumento, quello del prompt, elenco_tagliato;
//   2. che un file scritto mentre un elenco era tagliato porti scritto che puo'
//      essere parziale, e uno che modifica un allegato no;
//   3. sulla funzione intera, che il file arrivi alla pagina e si salvi cosi';
//   4. che le istruzioni non offrano il file su un elenco tagliato e che la chat
//      mostri l'avviso accanto al pulsante Scarica.
// Revisione del 13/10/2026: 5. il segno va solo al file che viene dall'elenco
// tagliato; 6. il file scaricato lo porta scritto; 7. anche quando l'elenco
// tagliato sta dentro un elemento di un array (la fatturazione attiva), sui dati
// costruiti e sulla copia dei dati veri dell'11/10/2026, se c'e'.
// npm run prove
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { caricaEcoTyna, chiedi } from './dati/bancoEcoTyna.mjs';
import * as fileEcoTyna from '../base44/shared/fileEcoTyna.ts';
import { testoDati } from '../base44/shared/pianoAssistente.ts';
import { eseguiStrumento } from '../base44/shared/strumentiAssistente.ts';
import { calcolaRigheAttiva } from '../base44/shared/attivaCalcolo.ts';

// Dallo spazio dei nomi: col codice di prima (la controprova) le due funzioni
// non ci sono, e la prova deve dire quali verifiche cadono.
const { REGOLE_FILE } = fileEcoTyna;
const elenchiTagliati = fileEcoTyna.elenchiTagliati || (() => []);
const fileDaElenchiTagliati = fileEcoTyna.fileDaElenchiTagliati || ((f) => f);

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');
const J = (v) => String(JSON.stringify(v)).slice(0, 400);

// 268 punti di raccolta in provincia di Bari, piu' 12 a Napoli.
const PDR = [
  ...Array.from({ length: 268 }, (_, i) => ({ id: `ba${i}`, ragione_sociale: `GOMMISTA ${i} SRL`, comune_pdr: 'BARI', provincia_pdr: 'BA' })),
  ...Array.from({ length: 12 }, (_, i) => ({ id: `na${i}`, ragione_sociale: `RICAMBI ${i} SRL`, comune_pdr: 'NAPOLI', provincia_pdr: 'NA' })),
];
const archivio = (righe) => ({ asServiceRole: { entities: { Pdr: { list: async (_o, n = 5000, s = 0) => righe.slice(s, s + n), filter: async () => [] } } } });

console.log('1. GLI ELENCHI TAGLIATI SI RICONOSCONO NEI DATI DEL PROMPT');
{
  const bari = await eseguiStrumento(archivio(PDR), 'punti_di_raccolta', { provincia: 'BA' });
  verifica('lo strumento taglia l\'elenco e lo dice', bari.dati && bari.dati.pdr.quanti === 268 && bari.dati.pdr.mostrate === 60 && /ELENCO TAGLIATO/.test(bari.dati.pdr.avviso || ''), J(bari.dati && bari.dati.pdr && { ...bari.dati.pdr, righe: undefined }));
  const t = elenchiTagliati(testoDati([bari]));
  verifica('il taglio dello strumento: 60 righe su 268', t.length === 1 && t[0].strumento === 'punti_di_raccolta' && t[0].mostrate === 60 && t[0].quanti === 268, J(t));
  const napoli = await eseguiStrumento(archivio(PDR), 'punti_di_raccolta', { provincia: 'NA' });
  verifica('un elenco intero non e\' tagliato', elenchiTagliati(testoDati([napoli])).length === 0, J(elenchiTagliati(testoDati([napoli]))));
  // Un elenco intero ma troppo grande per il prompt: lo accorcia serializza.
  const grosso = { strumento: 'raccolto', parametri: { canale: 'RETE' }, fonte: 'x', periodo: 'anno 2026', dati_al: '2026-10-12', dati: { dettaglio: { quanti: 400, mostrate: 400, righe: Array.from({ length: 400 }, (_, i) => ({ chiave: `RACCOGLITORE NUMERO ${i} CON UN NOME LUNGO`, tonnellate: 12.345, formulari: 7 })) } } };
  const tp = elenchiTagliati(testoDati([grosso]));
  verifica('il taglio del prompt: anche quello conta', tp.length === 1 && tp[0].strumento === 'raccolto' && tp[0].quanti === 400 && tp[0].mostrate < 400, J(tp));
  const riserva = { strumento: 'raccolto', parametri: {}, fonte: 'x', periodo: 'x', dati_al: 'x', dati: { riserva_eseguiti: { ordini: 30, elenco_tagliato: 'Qui ci sono i 20 raccoglitori piu\' grossi dei 25 che hanno ordini nel limbo: le righe non fanno il totale.' } } };
  const tr = elenchiTagliati(testoDati([riserva]));
  verifica('elenco_tagliato della riserva: 20 su 25', tr.length === 1 && tr[0].mostrate === 20 && tr[0].quanti === 25, J(tr));
  verifica('un blocco troncato senza numeri conta lo stesso', elenchiTagliati('--- strumento: giacenze\n{"a":1 …(troncato)').length === 1);
  verifica('niente dati, niente tagli', elenchiTagliati('').length === 0 && elenchiTagliati(undefined).length === 0);
}

console.log('2. IL FILE PORTA SCRITTO CHE PUO\' ESSERE PARZIALE');
{
  const file = [
    { nome: 'Punti di raccolta Bari', formato: 'xlsx', fogli: [{ nome: 'PDR', intestazioni: ['Ragione sociale'], righe: [['GOMMISTA 1 SRL']] }] },
    { nome: 'Elenco', formato: 'pdf', testo: '# Punti di raccolta' },
    { nome: 'Allegato filtrato', formato: 'xlsx', da_allegato: 'clienti.xlsx', operazioni: [] },
  ];
  const segnati = fileDaElenchiTagliati(file, [{ strumento: 'punti_di_raccolta', mostrate: 60, quanti: 2680 }]);
  verifica('l\'Excel e il PDF portano l\'avviso, coi numeri all\'italiana', /un elenco tagliato \(60 righe su 2\.680\): se il file viene da li', ne contiene solo una parte/.test(segnati[0].parziale || '') && segnati[1].parziale === segnati[0].parziale, J(segnati[0]));
  verifica('il file da un allegato no: si fa nel browser sulle righe vere', !('parziale' in segnati[2]));
  verifica('senza elenchi tagliati i file restano come sono', fileDaElenchiTagliati(file, []) === file || JSON.stringify(fileDaElenchiTagliati(file, [])) === JSON.stringify(file));
  const due = fileDaElenchiTagliati([file[0]], [{ strumento: 'a', mostrate: 60, quanti: 268 }, { strumento: 'b', mostrate: null, quanti: null }]);
  verifica('due elenchi: si dicono tutti e due', /elenchi tagliati \(60 righe su 268; una parte delle righe\)/.test(due[0].parziale || ''), J(due[0].parziale));
}

console.log('3. LA FUNZIONE INTERA');
{
  const modulo = await caricaEcoTyna();
  const FILE = [{ nome: 'Punti di raccolta di Bari', formato: 'xlsx', descrizione: 'Elenco dei punti di raccolta', fogli: [{ nome: 'PDR', intestazioni: ['Ragione sociale', 'Comune'], righe: Array.from({ length: 60 }, (_, i) => [`GOMMISTA ${i} SRL`, 'BARI']) }] }];
  const e = await chiedi(modulo, {
    domanda: 'Fammi un Excel con i punti di raccolta della provincia di Bari',
    piano: { strumenti: [{ nome: 'punti_di_raccolta', parametri: { provincia: 'BA' } }], serve_normativa: false },
    risposta: { risposta: 'Ecco il file con i punti di raccolta di Bari.', certezza: 'alta', file_da_creare: FILE },
    db: { Pdr: PDR },
  });
  verifica('la funzione risponde', e.stato === 200 && !!e.salvata, J(e.j));
  verifica('al modello e\' arrivato l\'elenco tagliato', /ELENCO TAGLIATO: qui ci sono 60 righe delle 268 totali/.test(e.prompt));
  const f = (e.j.file_generati || [])[0] || {};
  verifica('il file arriva alla pagina con l\'avviso', /60 righe su 268/.test(f.parziale || ''), J(f.parziale));
  const salvati = JSON.parse((e.salvata && e.salvata.file_generati_json) || '[]');
  verifica('...e si salva con la domanda, per quando la si riapre', salvati[0] && salvati[0].parziale === f.parziale);
  const intero = await chiedi(modulo, {
    domanda: 'Fammi un Excel con i punti di raccolta della provincia di Napoli',
    piano: { strumenti: [{ nome: 'punti_di_raccolta', parametri: { provincia: 'NA' } }], serve_normativa: false },
    risposta: { risposta: 'Ecco il file.', certezza: 'alta', file_da_creare: FILE },
    db: { Pdr: PDR },
  });
  verifica('da un elenco intero il file non porta l\'avviso', intero.stato === 200 && (intero.j.file_generati || [])[0] && !('parziale' in intero.j.file_generati[0]), J(intero.j.file_generati));
  verifica('la regola 3-quater: il file si offre solo su un elenco intero', /Quando la risposta e' un elenco lungo e INTERO, chiudi offrendo di prepararlo in Excel o in PDF/.test(e.prompt)
    && /Se l'elenco porta l'avviso ELENCO TAGLIATO \(o elenco_tagliato\) non offrire il file: conterrebbe solo le righe che vedi/.test(e.prompt)
    && !/Quando la risposta e' un elenco lungo, chiudi offrendo/.test(e.prompt));
  verifica('e la regola dei file lo ripete', /Un elenco dei dati del gestionale con l'avviso ELENCO TAGLIATO \(o elenco_tagliato\) ha solo una parte delle righe/.test(REGOLE_FILE) && e.prompt.includes(REGOLE_FILE));
}

console.log('4. LA CHAT MOSTRA L\'AVVISO');
{
  const chat = sorgente('src/components/assistente/ChatAssistente.jsx');
  verifica('accanto al file c\'e\' l\'avviso del file parziale', /\{f\.parziale && <p className="text-xs text-amber-700[^"]*"><AlertTriangle[^>]*\/> \{f\.parziale\}<\/p>\}/.test(chat));
}

// Revisione del 13/10/2026: il segno andava a ogni file della risposta appena un
// elenco del blocco era tagliato. Il raccolto per raccoglitore, intero, usciva
// «parziale» perche' accanto c'erano 10 degli 11 ordini con le date da sistemare.
console.log('5. IL SEGNO VA SOLO AL FILE CHE VIENE DALL\'ELENCO TAGLIATO');
{
  let n = 0;
  const riga = (trasp, kg, fine) => ({ id: 'r' + (++n), id_ordine: 'ET' + n, numero_fir: 'FIR' + n, stato: 'terminato', trasportatore: trasp, destinazione: 'GATIM', provincia: 'NA', classe: 'P', peso_effettivo: kg,
    ordine_immesso_il: '2026-08-01T08:00:00Z', trasporto_iniziato_il: '2026-08-02T08:00:00Z', ...(fine ? { trasporto_finito_il: fine } : {}) });
  const RETE = [riga('EMMESSE SRL', 4000, '2026-08-05T10:00:00Z'), riga('NAPPI SUD SRL', 3000, '2026-08-06T10:00:00Z')];
  for (let i = 0; i < 11; i++) RETE.push(riga('EMMESSE SRL', 1000, null));
  const finto = { asServiceRole: { entities: new Proxy({}, { get: (_t, e) => ({
    filter: async (f) => (String(e) === 'PrimariaRete' ? RETE : []).filter(r => !f || !f.stato || r.stato === f.stato),
    list: async () => (String(e) === 'PrimariaRete' ? RETE : []),
  }) }) } };
  const p = { canale: 'RETE', anno: 2026, raggruppa: 'raccoglitore' };
  const out = await eseguiStrumento(finto, 'raccolto', p);
  const tagli = elenchiTagliati(testoDati([{ ...out, strumento: 'raccolto', parametri: p }]));
  verifica('il blocco ha un elenco tagliato, le date da sistemare (10 su 11), e il dettaglio intero', tagli.length === 1 && tagli[0].mostrate === 10 && tagli[0].quanti === 11 && out.dati.dettaglio.quanti === 2 && !out.dati.dettaglio.avviso, J(tagli));
  const raccolto = { nome: 'Raccolto rete 2026 per raccoglitore', formato: 'xlsx', fogli: [{ nome: 'Raccolto', intestazioni: ['Raccoglitore', 'Formulari', 'Tonnellate'], righe: [['EMMESSE SRL', '1', '4'], ['NAPPI SUD SRL', '1', '3']] }] };
  const ordini = { nome: 'Ordini con le date da sistemare', formato: 'xlsx', fogli: [{ nome: 'Ordini', intestazioni: ['ID ordine', 'FIR', 'Date'], righe: out.dati.date_obbligatorie_da_sistemare.esempi.map(e => [e.id_ordine, e.numero_fir, e.date]) }] };
  const lettera = { nome: 'Lettera a Emmesse', formato: 'docx', testo: '# Richiesta\n\nGentile EMMESSE SRL,\nvi chiediamo di confermare le tonnellate del 2026.\n\nCordiali saluti' };
  const tabellaWord = { nome: 'Ordini in Word', formato: 'docx', testo: '# Ordini\n\n| ID ordine | FIR |\n|---|---|\n' + out.dati.date_obbligatorie_da_sistemare.esempi.map(e => `| ${e.id_ordine} | ${e.numero_fir} |`).join('\n') };
  const elencoPdf = { nome: 'Ordini in PDF', formato: 'pdf', testo: '# Ordini da sistemare\n\n' + out.dati.date_obbligatorie_da_sistemare.esempi.map(e => `- ${e.id_ordine} (${e.numero_fir}): ${e.date}`).join('\n') };
  const [fr, fo, fl, fw, fp] = fileDaElenchiTagliati([raccolto, ordini, lettera, tabellaWord, elencoPdf], tagli);
  verifica('l\'Excel del raccolto per raccoglitore, intero, non e\' parziale', !('parziale' in fr), J(fr.parziale));
  verifica('l\'Excel degli ordini con le date da sistemare si', /^Questo file e' fatto da un elenco tagliato \(10 righe su 11\): ne contiene solo una parte\. L'elenco intero si esporta dal modulo del gestionale\.$/.test(fo.parziale || ''), J(fo.parziale));
  verifica('una lettera scritta nella stessa risposta non e\' parziale', !('parziale' in fl), J(fl.parziale));
  verifica('una tabella in Word fatta con quegli ordini si', /un elenco tagliato \(10 righe su 11\)/.test(fw.parziale || ''), J(fw.parziale));
  verifica('e un elenco puntato in PDF anche', /un elenco tagliato \(10 righe su 11\)/.test(fp.parziale || ''), J(fp.parziale));

  // Gli stessi nomi in un elenco intero e in uno tagliato: decide il resto della
  // riga. Il dettaglio per raccoglitore e' intero (25 su 25), la riserva degli
  // eseguiti per raccoglitore e' tagliata (20 su 25).
  const dati = {
    dettaglio: { quanti: 25, mostrate: 25, righe: Array.from({ length: 25 }, (_, i) => ({ nome: `RACCOGLITORE ${i} SRL`, formulari: 100 + i, tonnellate: 200 + i })) },
    riserva_eseguiti: { ordini: 60, per_raccoglitore: Array.from({ length: 20 }, (_, i) => ({ raccoglitore: `RACCOGLITORE ${i} SRL`, ordini: 3, tonnellate: 1.5 + i })), elenco_tagliato: 'Qui ci sono i 20 raccoglitori piu\' grossi dei 25 che hanno ordini nel limbo: le righe non fanno il totale.' },
  };
  const t2 = elenchiTagliati(testoDati([{ strumento: 'raccolto', parametri: {}, fonte: 'x', periodo: 'anno 2026', dati_al: '2026-10-13', dati }]));
  const dalDettaglio = { nome: 'Raccolto', formato: 'xlsx', fogli: [{ nome: 'R', intestazioni: ['Raccoglitore', 'Formulari', 'Tonnellate'], righe: dati.dettaglio.righe.map(r => [r.nome, String(r.formulari), String(r.tonnellate)]) }] };
  const dallaRiserva = { nome: 'Eseguiti', formato: 'xlsx', fogli: [{ nome: 'E', intestazioni: ['Raccoglitore', 'Ordini', 'Tonnellate'], righe: dati.riserva_eseguiti.per_raccoglitore.map(r => [r.raccoglitore, String(r.ordini), String(r.tonnellate)]) }] };
  const [d1, d2] = fileDaElenchiTagliati([dalDettaglio, dallaRiserva], t2);
  verifica('stessi nomi: il file del dettaglio intero non e\' parziale', !('parziale' in d1), J(d1.parziale));
  verifica('...quello della riserva tagliata si (20 righe su 25)', /un elenco tagliato \(20 righe su 25\)/.test(d2.parziale || ''), J(d2.parziale));

  // Sulla funzione intera, come il revisore: il file del raccolto per
  // raccoglitore arriva alla pagina senza avviso.
  const modulo = await caricaEcoTyna();
  const e = await chiedi(modulo, {
    domanda: 'Fammi un Excel col raccolto della rete 2026 per raccoglitore',
    piano: { strumenti: [{ nome: 'raccolto', parametri: p }], serve_normativa: false },
    risposta: { risposta: 'Ecco il file.', certezza: 'alta', file_da_creare: [raccolto, ordini] },
    db: { PrimariaRete: RETE },
  });
  const [gr, go] = e.j.file_generati || [];
  verifica('funzione intera: al modello sono arrivati gli ordini tagliati', /ELENCO TAGLIATO: qui ci sono 10 ordini dei 11/.test(e.prompt));
  verifica('...il raccolto per raccoglitore arriva senza avviso', gr && !('parziale' in gr), J(gr && gr.parziale));
  verifica('...gli ordini con l\'avviso, e si salvano cosi\'', go && /10 righe su 11/.test(go.parziale || '') && JSON.parse(e.salvata.file_generati_json)[1].parziale === go.parziale, J(go && go.parziale));
}

console.log('6. IL FILE SCARICATO PORTA SCRITTO CHE E\' PARZIALE');
{
  // La pagina scarica con un collegamento a un Blob: qui si prende il Blob.
  const presi = [];
  globalThis.document = { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } };
  URL.createObjectURL = (b) => { presi.push(b); return 'blob:prova'; };
  URL.revokeObjectURL = () => {};
  const pagina = await import('../src/lib/fileEcoTyna.js');
  const XLSX = await import('xlsx');
  const PARZIALE = 'Questo file e\' fatto da un elenco tagliato (60 righe su 268): ne contiene solo una parte. L\'elenco intero si esporta dal modulo del gestionale.';
  const foglio = { nome: 'Punti di raccolta di Bari', formato: 'xlsx', fogli: [{ nome: 'PDR', intestazioni: ['Ragione sociale', 'Tonnellate'], righe: [['GOMMISTA 1 SRL', '1.5'], ['GOMMISTA 2 SRL', '2']] }] };
  await pagina.scaricaFileEcoTyna({ ...foglio, parziale: PARZIALE });
  const wb = XLSX.read(new Uint8Array(await presi.at(-1).arrayBuffer()), { type: 'array', cellNF: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  verifica('Excel: l\'avviso in A1', ws.A1 && ws.A1.v === `ATTENZIONE, FILE PARZIALE: ${PARZIALE}`, J(ws.A1));
  verifica('...e le intestazioni e le righe sotto, intere', ws.A3 && ws.A3.v === 'Ragione sociale' && ws.A4 && ws.A4.v === 'GOMMISTA 1 SRL' && ws.B4 && ws.B4.v === 1.5 && ws.B4.z === '#,##0.00', J([ws.A3, ws.A4, ws.B4]));
  await pagina.scaricaFileEcoTyna(foglio);
  const intero = XLSX.read(new Uint8Array(await presi.at(-1).arrayBuffer()), { type: 'array' });
  const wi = intero.Sheets[intero.SheetNames[0]];
  verifica('un file intero resta com\'era: intestazioni in A1', wi.A1 && wi.A1.v === 'Ragione sociale' && wi.A2.v === 'GOMMISTA 1 SRL', J([wi.A1, wi.A2]));
  await pagina.scaricaFileEcoTyna({ ...foglio, formato: 'csv', parziale: PARZIALE });
  const csv = (await presi.at(-1).text()).replace(/^﻿/, '').split('\r\n');
  verifica('CSV: l\'avviso e\' la prima riga', csv[0] === `ATTENZIONE, FILE PARZIALE: ${PARZIALE}` && csv[1] === 'Ragione sociale;Tonnellate', J(csv.slice(0, 3)));
  await pagina.scaricaFileEcoTyna({ nome: 'Elenco', formato: 'docx', testo: '# Punti di raccolta\n\n- GOMMISTA 1 SRL', parziale: PARZIALE });
  const word = await presi.at(-1).text();
  verifica('Word: l\'avviso e\' il primo paragrafo, prima del titolo', word.indexOf('ATTENZIONE, FILE PARZIALE') > 0 && word.indexOf('ATTENZIONE, FILE PARZIALE') < word.indexOf('Punti di raccolta</h1>'), word.slice(0, 600));
  await pagina.scaricaFileEcoTyna({ nome: 'Elenco', formato: 'txt', testo: 'GOMMISTA 1 SRL', parziale: PARZIALE });
  verifica('testo: in testa', (await presi.at(-1).text()).replace(/^﻿/, '').startsWith(`### ATTENZIONE, FILE PARZIALE: ${PARZIALE}`));
  // Dallo spazio dei nomi: col codice di prima la funzione non c'e'.
  const testoDelDocumento = pagina.testoDelDocumento || (() => '');
  verifica('PDF: il documento parte dall\'avviso (lo stesso testo di Word e del testo)', testoDelDocumento({ formato: 'pdf', testo: '# Elenco', parziale: PARZIALE }) === `### ATTENZIONE, FILE PARZIALE: ${PARZIALE}\n\n# Elenco`
    && /const testo = testoDelDocumento\(spec\);\n  if \(formato === 'docx'\)[^\n]*\n  if \(formato === 'pdf'\) \{ \(await documentoPdf\(testo\)\)/.test(sorgente('src/lib/fileEcoTyna.js')));
  // La regola dice cio' che accade: il file si riconosce dalle righe, quindi al
  // modello si chiede di copiare i valori come li vede.
  verifica('e la regola del prompt dice il vero: in testa al file e accanto a Scarica', /Il gestionale riconosce il file fatto da un elenco tagliato dalle sue righe e gli scrive in testa che e' parziale, con lo stesso avviso accanto al pulsante per scaricarlo: per questo nel file copia nomi, codici e numeri come li vedi nei dati, senza riscriverli/.test(REGOLE_FILE)
    && !/Il file portera' scritto che e' parziale/.test(REGOLE_FILE));
}

// Revisione del 13/10/2026, rilievo sulla A73 (regressione): la riga di un
// elemento di un array prendeva tutti i valori annidati. L'elemento del canale
// della fatturazione attiva contiene i mesi, il documento e i 20 ordini su 30
// arrivati dopo: ogni riga del file fatto da quegli ordini pareggiava con
// l'elemento del canale, e il file usciva senza nessun avviso.
console.log('7. UN ELENCO TAGLIATO DENTRO UN ELEMENTO DI UN ARRAY');
{
  const taglio = (righe, quanti) => ({ quanti, mostrate: righe.length, righe, ...(quanti > righe.length ? { avviso: `ELENCO TAGLIATO: qui ci sono ${righe.length} righe delle ${quanti} totali. Il numero giusto e' "quanti": non contare le righe di questo elenco.` } : {}) });
  const ordine = (pre, i) => ({ ordine: `${pre}${25200000 + i}`, numero_fir: `${pre}FIR${400000 + i}/26`, descrizione: '', data_fine_trasporto: `2026-09-${String(1 + (i % 28)).padStart(2, '0')}`, kg: 500 + i * 10, totale: 101 + i });
  const arrivati = Array.from({ length: 20 }, (_, i) => ordine('ET', i));
  const cambiati = Array.from({ length: 20 }, (_, i) => ordine('EC', i));
  const spariti = Array.from({ length: 20 }, (_, i) => ordine('ES', i));
  const esempi = Array.from({ length: 10 }, (_, i) => ({ id_ordine: `ET9900${String(i).padStart(3, '0')}`, numero_fir: `XRAB${700000 + i}/26`, date: 'manca la fine del trasporto', escluso_dal_conto: true }));
  const dati = {
    canali: [{ canale: 'RETE', tonnellate: 1120.24, ordini: 380, euro: 226288.48, mesi: [{ mese: 'Settembre', tonnellate: 1120.24, ordini: 380, euro: 226288.48,
      documento: { stato: 'elaborata', elaborato_il: '2026-10-05', totale_documento_euro: 206347.04, differenza_euro: 19941.44, allineato: false,
        arrivati_dopo: taglio(arrivati, 30), cambiati: taglio(cambiati, 25), non_piu_nel_mese: taglio(spariti, 22), differenza_kg: 98720 } }] }],
    anomalie: taglio([{ mese: 'Settembre', tipologia: 'RETE', ordine: 'ET1', problema: 'senza tariffa' }, { mese: 'Settembre', tipologia: 'RETE', ordine: 'ET2', problema: 'senza tariffa' }], 2),
    date_obbligatorie_da_sistemare: [{ canale: 'RETE', modulo: 'primarie di rete', ordini: 11, esempi, avviso: 'ELENCO TAGLIATO: qui ci sono 10 ordini dei 11. Il numero giusto e\' "ordini".' }],
  };
  const tagli = elenchiTagliati(testoDati([{ strumento: 'fatturazione', parametri: { tipo: 'ATTIVA', tipologia: 'RETE', anno: 2026, mese: 'settembre' }, fonte: 'x', periodo: 'Settembre 2026', dati_al: '2026-10-13', dati }]));
  verifica('i quattro elenchi tagliati annidati si leggono', tagli.length === 4 && JSON.stringify(tagli.map(t => `${t.mostrate}/${t.quanti}`).sort()) === JSON.stringify(['10/11', '20/22', '20/25', '20/30']), J(tagli));
  const foglio = (nome, intest, righe, formato = 'xlsx') => ({ nome, formato, fogli: [{ nome: 'Foglio', intestazioni: intest, righe: righe.map(r => intest.map(k => String(r[k] ?? ''))) }] });
  const CAMPI = ['ordine', 'numero_fir', 'data_fine_trasporto', 'kg', 'totale'];
  const [fa, fc, fs, fd, fn, fr] = fileDaElenchiTagliati([
    foglio('Ordini arrivati dopo il documento di settembre', CAMPI, arrivati),
    foglio('Ordini cambiati', CAMPI, cambiati, 'csv'),
    { nome: 'Ordini non piu nel mese', formato: 'docx', testo: '# Ordini non piu\' nel mese\n\n| Ordine | FIR | Kg |\n|---|---|---|\n' + spariti.map(r => `| ${r.ordine} | ${r.numero_fir} | ${r.kg} |`).join('\n') },
    { nome: 'Ordini con le date da sistemare', formato: 'pdf', testo: '# Ordini da sistemare\n\n' + esempi.map(e => `- ${e.id_ordine} (${e.numero_fir}): ${e.date}`).join('\n') },
    foglio('Anomalie di settembre', ['mese', 'tipologia', 'ordine', 'problema'], dati.anomalie.righe),
    foglio('Attiva di settembre per canale', ['canale', 'mese', 'tonnellate', 'ordini', 'euro'], [{ canale: 'RETE', mese: 'Settembre', tonnellate: 1120.24, ordini: 380, euro: 226288.48 }, { canale: 'RETE', mese: 'Settembre (documento)', tonnellate: '', ordini: '', euro: 206347.04 }]),
  ], tagli);
  verifica('l\'Excel degli arrivati dopo, dentro canali[].mesi[].documento: «20 righe su 30»', /^Questo file e' fatto da un elenco tagliato \(20 righe su 30\): ne contiene solo una parte\./.test(fa.parziale || ''), J(fa.parziale));
  verifica('il CSV dei cambiati: «20 righe su 25»', /un elenco tagliato \(20 righe su 25\)/.test(fc.parziale || ''), J(fc.parziale));
  verifica('la tabella in Word dei non piu\' nel mese: «20 righe su 22»', /un elenco tagliato \(20 righe su 22\)/.test(fs.parziale || ''), J(fs.parziale));
  verifica('l\'elenco in PDF delle date da sistemare, un array di elenchi: «10 righe su 11»', /un elenco tagliato \(10 righe su 11\)/.test(fd.parziale || ''), J(fd.parziale));
  verifica('le anomalie, intere, non sono parziali', !('parziale' in fn), J(fn.parziale));
  verifica('il riepilogo del canale e del mese, coi valori dell\'elemento, non e\' parziale', !('parziale' in fr), J(fr.parziale));

  // Un elenco INTERO dentro un elemento di un array resta intero, anche se
  // accanto c'e' un elenco tagliato con gli stessi nomi.
  const nomi = Array.from({ length: 6 }, (_, i) => ({ raccoglitore: `RACCOGLITORE ${i} SRL`, formulari: 10 + i, tonnellate: 20 + i }));
  const dati2 = {
    canali: [{ canale: 'RETE', dettaglio: taglio(nomi, 6), mesi: [{ mese: 'Settembre', per_raccoglitore: nomi.map(r => ({ ...r, tonnellate: r.tonnellate / 2 })) }] }],
    limbo: { per_raccoglitore: nomi.slice(0, 4).map(r => ({ raccoglitore: r.raccoglitore, ordini: 3 })), elenco_tagliato: 'Qui ci sono i 4 raccoglitori piu\' grossi dei 6 che hanno ordini nel limbo: le righe non fanno il totale.' },
  };
  const t2 = elenchiTagliati(testoDati([{ strumento: 'raccolto', parametri: {}, fonte: 'x', periodo: 'anno 2026', dati_al: '2026-10-13', dati: dati2 }]));
  const [g1, g2, g3] = fileDaElenchiTagliati([
    foglio('Raccolto per raccoglitore', ['raccoglitore', 'formulari', 'tonnellate'], nomi),
    foglio('Settembre per raccoglitore', ['raccoglitore', 'formulari', 'tonnellate'], dati2.canali[0].mesi[0].per_raccoglitore),
    foglio('Ordini nel limbo', ['raccoglitore', 'ordini'], dati2.limbo.per_raccoglitore),
  ], t2);
  verifica('un elenco intero annidato non e\' parziale', !('parziale' in g1), J(g1.parziale));
  verifica('...nemmeno un array di righe dentro un mese', !('parziale' in g2), J(g2.parziale));
  verifica('...e il limbo tagliato accanto si («4 righe su 6»)', /un elenco tagliato \(4 righe su 6\)/.test(g3.parziale || ''), J(g3.parziale));

  // LA COPIA DEI DATI VERI DELL'11/10/2026 (fuori dal repository: senza, si
  // salta), come lo script del revisore: settembre RETE, documento elaborato, 30
  // ordini arrivati dopo (le voci del documento sono le righe di oggi meno 30).
  const COPIA = new URL('../../dati-veri/treadrider-dati-veri-2026-10-11.json.gz', import.meta.url);
  if (!existsSync(COPIA)) {
    console.log('  dati veri: la copia dell\'11/10/2026 non c\'e\', salto');
  } else {
    const V = JSON.parse(gunzipSync(readFileSync(COPIA)).toString('utf8')).archivi;
    const sdk = (sost = {}) => {
      const dati3 = (e) => (e in sost ? sost[e] : V[e] || []);
      const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => (v === null ? r[k] == null || r[k] === '' : r[k] === v));
      const entities = new Proxy({}, { get: (_t, e) => ({
        filter: async (f, _s, n = 5000, salta = 0) => dati3(String(e)).filter(r => uguale(r, f)).slice(salta, salta + n).map(r => ({ ...r })),
        list: async (_s, n = 5000, salta = 0) => dati3(String(e)).slice(salta, salta + n).map(r => ({ ...r })),
      }) });
      return { asServiceRole: { entities }, entities };
    };
    const { righe } = calcolaRigheAttiva({ reteAll: V.PrimariaRete, aciAll: V.PrimariaAci, extraAll: V.ExtraRaccolta, fornitori: V.Fornitore, tariffe: V.Tariffa.filter(t => t.direzione === 'ATTIVA'), anno: 2026, mese: 'Settembre' });
    const doc = V.DocumentoFatturazione.find(d => d.tipo === 'ATTIVA' && d.mese === 'Settembre' && d.tipologia === 'RETE');
    const voci = righe.RETE.slice(30).map(r => ({ ...r, documento_id: doc.id }));
    const p = { tipo: 'ATTIVA', tipologia: 'RETE', anno: 2026, mese: 'settembre' };
    const out = await eseguiStrumento(sdk({ VoceFatturazione: voci }), 'fatturazione', p, { ruolo: 'admin' });
    const ad = out.dati && out.dati.canali[0].mesi[0].documento.arrivati_dopo;
    verifica('dati veri: arrivati dopo il documento di settembre, 20 su 30, tagliato', ad && ad.mostrate === 20 && ad.quanti === 30 && /ELENCO TAGLIATO/.test(ad.avviso || ''), J(ad && { ...ad, righe: undefined }));
    const tv = elenchiTagliati(testoDati([out]));
    // Il file come lo scrive il modello: le 20 righe copiate tali e quali,
    // ripulite da fileDaCreare come nella funzione (le celle diventano testo).
    const intest = Object.keys(ad.righe[0]);
    const [va, vr] = fileDaElenchiTagliati(fileEcoTyna.fileDaCreare([
      { nome: 'Ordini arrivati dopo il documento di settembre', formato: 'xlsx', fogli: [{ nome: 'Arrivati dopo', intestazioni: intest, righe: ad.righe.map(r => intest.map(k => r[k])) }] },
      foglio('Attiva RETE di settembre', ['canale', 'mese', 'tonnellate', 'ordini', 'euro'], [out.dati.canali[0], { ...out.dati.canali[0].mesi[0], canale: 'RETE' }]),
    ]), tv);
    verifica('dati veri: l\'Excel dei 20 ordini su 30 porta il segno parziale', /^Questo file e' fatto da un elenco tagliato \(20 righe su 30\)/.test((va && va.parziale) || ''), J(va && va.parziale));
    verifica('dati veri: il riepilogo del canale e del mese no', vr && !('parziale' in vr), J(vr && vr.parziale));

    // Le date da sistemare dell'attiva sono un array [{ canale, esempi, avviso }]:
    // con 11 terminati senza fine trasporto, il file dei 10 ordini su 11.
    const modello = V.PrimariaRete.find(r => r.stato === 'terminato' && r.trasporto_finito_il);
    const nuovi = Array.from({ length: 11 }, (_, i) => ({ ...modello, id: 'x' + i, id_ordine: 'ET9900' + String(i).padStart(3, '0'), numero_fir: 'XRAB' + (700000 + i) + '/26', trasporto_finito_il: null }));
    const outD = await eseguiStrumento(sdk({ PrimariaRete: [...V.PrimariaRete, ...nuovi], VoceFatturazione: voci }), 'fatturazione', p, { ruolo: 'admin' });
    const d0 = (outD.dati && outD.dati.date_obbligatorie_da_sistemare || [])[0];
    verifica('dati veri: le date da sistemare sono un array, 10 ordini degli 11', Array.isArray(outD.dati.date_obbligatorie_da_sistemare) && d0 && d0.esempi.length === 10 && /10 ordini dei 11/.test(d0.avviso || ''), J(d0 && { ...d0, esempi: undefined }));
    const [vd] = fileDaElenchiTagliati(fileEcoTyna.fileDaCreare([{ nome: 'Ordini con le date da sistemare', formato: 'xlsx', fogli: [{ nome: 'Ordini', intestazioni: ['Ordine', 'FIR'], righe: d0.esempi.map(e => [e.id_ordine, e.numero_fir]) }] }]), elenchiTagliati(testoDati([outD])));
    verifica('dati veri: il file dei 10 ordini su 11 porta il segno parziale', /un elenco tagliato \(10 righe su 11\)/.test((vd && vd.parziale) || ''), J(vd && vd.parziale));

    // Sulla funzione intera: il file arriva alla pagina con l'avviso e si salva cosi'.
    const modulo = await caricaEcoTyna();
    const e = await chiedi(modulo, {
      domanda: 'Fammi un Excel con gli ordini arrivati dopo il documento di settembre della rete',
      piano: { strumenti: [{ nome: 'fatturazione', parametri: p }], serve_normativa: false },
      risposta: { risposta: 'Ecco il file con gli ordini arrivati dopo il documento.', certezza: 'alta', file_da_creare: [{ nome: 'Ordini arrivati dopo il documento di settembre', formato: 'xlsx', fogli: [{ nome: 'Arrivati dopo', intestazioni: intest, righe: ad.righe.map(r => intest.map(k => String(r[k]))) }] }] },
      db: { PrimariaRete: V.PrimariaRete, PrimariaAci: V.PrimariaAci, ExtraRaccolta: V.ExtraRaccolta, Fornitore: V.Fornitore, Tariffa: V.Tariffa, DocumentoFatturazione: V.DocumentoFatturazione, VoceFatturazione: voci },
      riepilogo: 'DATI DEL GESTIONALE: riepilogo non usato in questa prova.',
    });
    const fe = (e.j.file_generati || [])[0];
    verifica('dati veri, funzione intera: al modello sono arrivati gli ordini tagliati', /ELENCO TAGLIATO: qui ci sono 20 righe delle 30 totali/.test(e.prompt));
    verifica('...il file arriva alla pagina con l\'avviso e si salva cosi\'', fe && /20 righe su 30/.test(fe.parziale || '') && JSON.parse(e.salvata.file_generati_json)[0].parziale === fe.parziale, J(fe && fe.parziale));
  }
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
