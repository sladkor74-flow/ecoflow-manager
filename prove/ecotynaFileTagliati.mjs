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
// Decisioni del 13/10/2026: 6. il CSV esce senza la riga dell'avviso (si carica in
// altri programmi); 8. gli esempi tagliati della settimana dei formulari e della
// riserva degli eseguiti portano il segno, e il file fatto da quelli e' parziale.
// npm run prove
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { caricaEcoTyna, chiedi } from './dati/bancoEcoTyna.mjs';
import * as fileEcoTyna from '../base44/shared/fileEcoTyna.ts';
import { testoDati } from '../base44/shared/pianoAssistente.ts';
import { eseguiStrumento } from '../base44/shared/strumentiAssistente.ts';
import { calcolaRigheAttiva } from '../base44/shared/attivaCalcolo.ts';
import { intervalloSettimana } from '../base44/shared/reportSettimanali.ts';

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
  // Il CSV no (decisione del 13/10/2026): si carica in altri programmi, e la riga
  // d'avviso diventava la riga delle intestazioni. L'avviso resta accanto a
  // «Scarica» (sezione 4) e negli altri formati.
  await pagina.scaricaFileEcoTyna({ ...foglio, formato: 'csv', parziale: PARZIALE });
  const csv = (await presi.at(-1).text()).replace(/^﻿/, '').split('\r\n');
  verifica('CSV: niente avviso dentro, la prima riga sono le intestazioni', csv[0] === 'Ragione sociale;Tonnellate' && csv[1] === 'GOMMISTA 1 SRL;1,5' && csv.length === 3 && !csv.some(r => /ATTENZIONE|PARZIALE|elenco tagliato/i.test(r)), J(csv.slice(0, 3)));
  await pagina.scaricaFileEcoTyna({ ...foglio, formato: 'csv' });
  const csvIntero = (await presi.at(-1).text()).replace(/^﻿/, '').split('\r\n');
  verifica('...lo stesso CSV che da un elenco intero', JSON.stringify(csvIntero) === JSON.stringify(csv), J([csvIntero, csv]));
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
  verifica('e la regola del prompt dice il vero: accanto a Scarica e in testa al file, tranne il CSV', /Il gestionale riconosce il file fatto da un elenco tagliato dalle sue righe e scrive che e' parziale accanto al pulsante per scaricarlo e in testa al file, tranne il CSV, che si carica in altri programmi e resta senza avviso dentro: per questo nel file copia nomi, codici e numeri come li vedi nei dati, senza riscriverli/.test(REGOLE_FILE)
    && !/Il file portera' scritto che e' parziale/.test(REGOLE_FILE) && !/gli scrive in testa che e' parziale, con lo stesso avviso/.test(REGOLE_FILE));
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

// Decisione del 13/10/2026: la settimana dei formulari tagliava gli esempi dei
// senza fine trasporto (5) e delle date da sistemare (10), e la riserva degli
// ordini «eseguito» i suoi esempi (10), senza nessun segno. Il modello poteva
// contarli, e un file fatto da quegli esempi usciva intero. Ora portano l'avviso
// ELENCO TAGLIATO degli altri elenchi; gli esempi della riserva col nome
// dell'elenco (avviso_esempi), perche' accanto c'e' per_raccoglitore, che puo'
// essere intero.
console.log('8. GLI ESEMPI TAGLIATI DELLA SETTIMANA DEI FORMULARI E DELLA RISERVA');
{
  const { inizio } = intervalloSettimana(2026, 40);
  const base = { stato: 'terminato', trasportatore: 'EMMESSE SRL', destinazione: 'GATIM', provincia: 'NA', classe: 'P' };
  const senzaFine = (n) => Array.from({ length: n }, (_, i) => ({ ...base, id: `sf${i}`, id_ordine: `ET7700${String(i).padStart(3, '0')}`, numero_fir: `SFIR${500000 + i}/26`, peso_effettivo: 1000 + i, ordine_immesso_il: '2026-09-20T08:00:00Z', trasporto_iniziato_il: '2026-09-21T08:00:00Z' }));
  const senzaImmissione = (n) => Array.from({ length: n }, (_, i) => ({ ...base, id: `si${i}`, id_ordine: `ET8800${String(i).padStart(3, '0')}`, numero_fir: `SIFIR${600000 + i}/26`, peso_effettivo: 2000 + i, trasporto_iniziato_il: `${inizio}T08:00:00Z`, trasporto_finito_il: `${inizio}T10:00:00Z` }));
  const buoni = Array.from({ length: 3 }, (_, i) => ({ ...base, id: `ok${i}`, id_ordine: `ET9900${i}`, numero_fir: `OKFIR${700000 + i}/26`, peso_effettivo: 3000, ordine_immesso_il: `${inizio}T07:00:00Z`, trasporto_iniziato_il: `${inizio}T08:00:00Z`, trasporto_finito_il: `${inizio}T10:00:00Z` }));
  const sdk = (archivi) => ({ asServiceRole: { entities: new Proxy({}, { get: (_t, e) => ({
    filter: async (f, _s, n = 5000, salta = 0) => (archivi[String(e)] || []).filter(r => !f || !f.stato || r.stato === f.stato).slice(salta, salta + n).map(r => ({ ...r })),
    list: async (_s, n = 5000, salta = 0) => (archivi[String(e)] || []).slice(salta, salta + n).map(r => ({ ...r })),
  }) }) } });
  const P = { anno: 2026, settimana: 40 };
  const out = await eseguiStrumento(sdk({ PrimariaRete: [...senzaFine(12), ...senzaImmissione(14), ...buoni] }), 'settimana_formulari', P);
  const rete = ((out.dati && out.dati.date_obbligatorie_da_sistemare && out.dati.date_obbligatorie_da_sistemare.flussi) || []).find(f => f.flusso === 'rete_primarie') || {};
  const sf = rete.senza_fine_trasporto || {};
  const ns = rete.nella_settimana || {};
  verifica('i senza fine trasporto: 5 esempi dei 12, col segno', sf.formulari === 12 && (sf.esempi || []).length === 5 && sf.avviso === 'ELENCO TAGLIATO: qui ci sono 5 formulari dei 12. Il numero giusto e\' "formulari".', J(sf));
  verifica('le date da sistemare della settimana: 10 esempi dei 14, col segno', ns.formulari === 14 && (ns.esempi || []).length === 10 && ns.avviso === 'ELENCO TAGLIATO: qui ci sono 10 formulari dei 14. Il numero giusto e\' "formulari".', J(ns));
  const tagli = elenchiTagliati(testoDati([{ ...out, strumento: 'settimana_formulari', parametri: P }]));
  verifica('i due tagli si leggono nel blocco del prompt', JSON.stringify(tagli.map(t => `${t.mostrate}/${t.quanti}`).sort()) === JSON.stringify(['10/14', '5/12']), J(tagli));
  const daEsempi = (nome, formato, esempi) => ({ nome, formato, fogli: [{ nome: 'Formulari', intestazioni: ['FIR', 'Ordine', 'Date'], righe: esempi.map(x => [x.fir, x.ordine, x.date]) }] });
  const [fsf, fns, fpdf] = fileDaElenchiTagliati([
    daEsempi('Formulari senza fine trasporto', 'xlsx', sf.esempi || []),
    daEsempi('Formulari della settimana da sistemare', 'csv', ns.esempi || []),
    { nome: 'Formulari da sistemare', formato: 'pdf', testo: '# Formulari da sistemare\n\n' + (ns.esempi || []).map(x => `- ${x.fir} (${x.ordine}): ${x.date}`).join('\n') },
  ], tagli);
  verifica('l\'Excel dei senza fine trasporto porta il segno: «5 righe su 12»', /^Questo file e' fatto da un elenco tagliato \(5 righe su 12\)/.test(fsf.parziale || ''), J(fsf.parziale));
  verifica('il CSV delle date da sistemare: «10 righe su 14»', /un elenco tagliato \(10 righe su 14\)/.test(fns.parziale || ''), J(fns.parziale));
  verifica('...e l\'elenco in PDF', /un elenco tagliato \(10 righe su 14\)/.test(fpdf.parziale || ''), J(fpdf.parziale));
  // Esempi interi: nessun segno, nessun file parziale.
  const pochi = await eseguiStrumento(sdk({ PrimariaRete: [...senzaFine(3), ...senzaImmissione(4), ...buoni] }), 'settimana_formulari', P);
  const r2 = ((pochi.dati && pochi.dati.date_obbligatorie_da_sistemare && pochi.dati.date_obbligatorie_da_sistemare.flussi) || []).find(f => f.flusso === 'rete_primarie') || {};
  verifica('con 3 senza fine e 4 da sistemare gli esempi sono tutti, senza segno', r2.senza_fine_trasporto && r2.senza_fine_trasporto.esempi.length === 3 && !('avviso' in r2.senza_fine_trasporto) && r2.nella_settimana && r2.nella_settimana.esempi.length === 4 && !('avviso' in r2.nella_settimana), J(r2));
  const t2 = elenchiTagliati(testoDati([{ ...pochi, strumento: 'settimana_formulari', parametri: P }]));
  const [interi] = fileDaElenchiTagliati([daEsempi('Formulari senza fine trasporto', 'xlsx', r2.senza_fine_trasporto ? r2.senza_fine_trasporto.esempi : [])], t2);
  verifica('...e il file fatto da quelli non e\' parziale', t2.length === 0 && interi && !('parziale' in interi), J([t2, interi && interi.parziale]));
  // Un blocco troncato a meta': i formulari si leggono come le righe e gli ordini.
  const tronco = elenchiTagliati('--- strumento: settimana_formulari\n{"flussi":[{"senza_fine_trasporto":{"formulari":12,"avviso":"ELENCO TAGLIATO: qui ci sono 5 formulari dei 12. Il numero giusto e\' \\"formulari\\"."} …(troncato)');
  verifica('un blocco troncato: «5 formulari dei 12» si legge coi numeri', tronco.length === 1 && tronco[0].mostrate === 5 && tronco[0].quanti === 12, J(tronco));

  // LA RISERVA DEGLI ESEGUITI: 37 ordini nel limbo di tre raccoglitori. Gli
  // esempi sono 10 e lo dicono; i tre raccoglitori sono tutti.
  let k = 0;
  const eseguito = (racc, kg) => ({ ...base, id: `es${++k}`, stato: 'eseguito', trasportatore: racc, id_ordine: `ET6600${String(k).padStart(3, '0')}`, numero_fir: `ESFIR${800000 + k}/26`, peso_effettivo: kg, ordine_immesso_il: '2026-09-01T07:00:00Z', trasporto_iniziato_il: '2026-09-01T08:00:00Z', trasporto_finito_il: '2026-09-01T10:00:00Z' });
  const limbo = [...Array.from({ length: 20 }, () => eseguito('EMMESSE SRL', 1500)), ...Array.from({ length: 12 }, () => eseguito('NAPPI SUD SRL', 1200)), ...Array.from({ length: 5 }, () => eseguito('ECORECUPERI SRL', 900))];
  const pr = { canale: 'RETE', anno: 2026 };
  const racc = await eseguiStrumento(sdk({ PrimariaRete: [...buoni, ...limbo] }), 'raccolto', pr);
  const ris = (racc.dati && racc.dati.riserva_eseguiti) || {};
  verifica('la riserva: 10 esempi dei 37, col segno col nome dell\'elenco', ris.ordini === 37 && (ris.esempi || []).length === 10 && ris.avviso_esempi === 'ELENCO TAGLIATO: qui ci sono 10 ordini dei 37. Il numero giusto e\' "ordini".' && !('avviso' in ris), J({ ...ris, esempi: undefined, nota: undefined }));
  verifica('...i raccoglitori sono tutti e tre, senza segno', (ris.per_raccoglitore || []).length === 3 && !('elenco_tagliato' in ris), J(ris.per_raccoglitore));
  const tr = elenchiTagliati(testoDati([{ ...racc, strumento: 'raccolto', parametri: pr }]));
  verifica('nel blocco del prompt il taglio degli esempi, solo quello', JSON.stringify(tr.map(t => `${t.mostrate}/${t.quanti}`)) === JSON.stringify(['10/37']), J(tr));
  const [fes, frac] = fileDaElenchiTagliati([
    { nome: 'Ordini nel limbo', formato: 'xlsx', fogli: [{ nome: 'Ordini', intestazioni: ['Ordine', 'FIR', 'Tonnellate'], righe: (ris.esempi || []).map(o => [o.id_ordine, o.numero_fir, String(o.tonnellate)]) }] },
    { nome: 'Limbo per raccoglitore', formato: 'xlsx', fogli: [{ nome: 'Raccoglitori', intestazioni: ['Raccoglitore', 'Ordini', 'Tonnellate'], righe: (ris.per_raccoglitore || []).map(r => [r.raccoglitore, String(r.ordini), String(r.tonnellate)]) }] },
  ], tr);
  verifica('il file degli ordini nel limbo porta il segno: «10 righe su 37»', /^Questo file e' fatto da un elenco tagliato \(10 righe su 37\)/.test(fes.parziale || ''), J(fes.parziale));
  verifica('il file dei raccoglitori, intero, no', frac && !('parziale' in frac), J(frac && frac.parziale));
  // 25 raccoglitori nel limbo: anche i raccoglitori sono tagliati (20 su 25), e
  // ogni file prende il suo taglio, non quello dell'altro elenco.
  const molti = Array.from({ length: 25 }, (_, i) => eseguito(`RACCOGLITORE ${i} SRL`, 1000 + i * 10));
  const racc2 = await eseguiStrumento(sdk({ PrimariaRete: [...buoni, ...molti] }), 'raccolto', pr);
  const ris2 = (racc2.dati && racc2.dati.riserva_eseguiti) || {};
  const tr2 = elenchiTagliati(testoDati([{ ...racc2, strumento: 'raccolto', parametri: pr }]));
  verifica('25 raccoglitori: due tagli, gli esempi (10 su 25) e i raccoglitori (20 su 25)', JSON.stringify(tr2.map(t => `${t.mostrate}/${t.quanti}`).sort()) === JSON.stringify(['10/25', '20/25']) && /20 raccoglitori/.test(ris2.elenco_tagliato || ''), J(tr2));
  const [ges, grac] = fileDaElenchiTagliati([
    { nome: 'Ordini nel limbo', formato: 'xlsx', fogli: [{ nome: 'Ordini', intestazioni: ['Ordine', 'FIR'], righe: (ris2.esempi || []).map(o => [o.id_ordine, o.numero_fir]) }] },
    { nome: 'Limbo per raccoglitore', formato: 'xlsx', fogli: [{ nome: 'Raccoglitori', intestazioni: ['Raccoglitore', 'Ordini', 'Tonnellate'], righe: (ris2.per_raccoglitore || []).map(r => [r.raccoglitore, String(r.ordini), String(r.tonnellate)]) }] },
  ], tr2);
  verifica('...il file degli ordini col suo taglio, «10 righe su 25»', /^Questo file e' fatto da un elenco tagliato \(10 righe su 25\)/.test(ges.parziale || ''), J(ges.parziale));
  verifica('...quello dei raccoglitori col suo, «20 righe su 25»', /^Questo file e' fatto da un elenco tagliato \(20 righe su 25\)/.test(grac.parziale || ''), J(grac.parziale));

  // Sulla funzione intera: il file dei senza fine trasporto arriva alla pagina
  // col segno, e l'elenco tagliato al modello.
  const modulo = await caricaEcoTyna();
  const e = await chiedi(modulo, {
    domanda: 'Fammi un Excel coi formulari senza fine trasporto della settimana 40',
    piano: { strumenti: [{ nome: 'settimana_formulari', parametri: P }], serve_normativa: false },
    risposta: { risposta: 'Ecco il file.', certezza: 'alta', file_da_creare: [daEsempi('Formulari senza fine trasporto', 'xlsx', sf.esempi || [])] },
    db: { PrimariaRete: [...senzaFine(12), ...senzaImmissione(14), ...buoni] },
    riepilogo: 'DATI DEL GESTIONALE: riepilogo non usato in questa prova.',
  });
  const fe = (e.j.file_generati || [])[0];
  verifica('funzione intera: al modello arriva il segno sugli esempi', /ELENCO TAGLIATO: qui ci sono 5 formulari dei 12/.test(e.prompt) && /ELENCO TAGLIATO: qui ci sono 10 formulari dei 14/.test(e.prompt));
  verifica('...e il file arriva alla pagina parziale, e si salva cosi\'', fe && /un elenco tagliato \(5 righe su 12\)/.test(fe.parziale || '') && JSON.parse(e.salvata.file_generati_json)[0].parziale === fe.parziale, J(fe && fe.parziale));

  // LA COPIA DEI DATI VERI DELL'11/10/2026, se c'e': oggi nessun senza fine e
  // nessun eseguito, quindi si aggiungono a una copia degli archivi veri, come
  // nella sezione 7, con le righe vere intorno.
  const COPIA = new URL('../../dati-veri/treadrider-dati-veri-2026-10-11.json.gz', import.meta.url);
  if (!existsSync(COPIA)) {
    console.log('  dati veri: la copia dell\'11/10/2026 non c\'e\', salto');
  } else {
    const V = JSON.parse(gunzipSync(readFileSync(COPIA)).toString('utf8')).archivi;
    // Un formulario vero di settembre 2026: gli eseguiti devono cadere nell'anno chiesto.
    const modello = V.PrimariaRete.find(r => r.stato === 'terminato' && String(r.trasporto_finito_il || '').startsWith('2026-09'));
    const nuoviSenzaFine = Array.from({ length: 12 }, (_, i) => ({ ...modello, id: 'vsf' + i, id_ordine: 'ET7700' + String(i).padStart(3, '0'), numero_fir: 'VSF' + (500000 + i) + '/26', trasporto_finito_il: null }));
    const nuoviEseguiti = Array.from({ length: 37 }, (_, i) => ({ ...modello, id: 'ves' + i, stato: 'eseguito', id_ordine: 'ET6600' + String(i).padStart(3, '0'), numero_fir: 'VES' + (800000 + i) + '/26' }));
    const archivi = { ...V, PrimariaRete: [...V.PrimariaRete, ...nuoviSenzaFine, ...nuoviEseguiti] };
    const vs = await eseguiStrumento(sdk(archivi), 'settimana_formulari', P);
    const vrete = ((vs.dati && vs.dati.date_obbligatorie_da_sistemare && vs.dati.date_obbligatorie_da_sistemare.flussi) || []).find(f => f.flusso === 'rete_primarie') || {};
    const vsf = vrete.senza_fine_trasporto || {};
    const [vf] = fileDaElenchiTagliati(fileEcoTyna.fileDaCreare([daEsempi('Formulari senza fine trasporto', 'xlsx', vsf.esempi || [])]), elenchiTagliati(testoDati([{ ...vs, strumento: 'settimana_formulari', parametri: P }])));
    verifica('dati veri: 5 esempi dei 12 senza fine trasporto, e il file porta il segno', vsf.formulari === 12 && /qui ci sono 5 formulari dei 12/.test(vsf.avviso || '') && /un elenco tagliato \(5 righe su 12\)/.test((vf && vf.parziale) || ''), J([vsf.formulari, vsf.avviso, vf && vf.parziale]));
    const vr = await eseguiStrumento(sdk(archivi), 'raccolto', pr);
    const vris = (vr.dati && vr.dati.riserva_eseguiti) || {};
    const [ve] = fileDaElenchiTagliati(fileEcoTyna.fileDaCreare([{ nome: 'Ordini nel limbo', formato: 'xlsx', fogli: [{ nome: 'Ordini', intestazioni: ['Ordine', 'FIR'], righe: (vris.esempi || []).map(o => [o.id_ordine, o.numero_fir]) }] }]), elenchiTagliati(testoDati([{ ...vr, strumento: 'raccolto', parametri: pr }])));
    verifica('dati veri: la riserva con 10 esempi dei 37, e il file porta il segno', vris.ordini === 37 && /qui ci sono 10 ordini dei 37/.test(vris.avviso_esempi || '') && /un elenco tagliato \(10 righe su 37\)/.test((ve && ve.parziale) || ''), J([vris.ordini, vris.avviso_esempi, ve && ve.parziale]));
  }
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
