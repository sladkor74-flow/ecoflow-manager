// Il PDF dell'esito di una verifica settimanale (src/lib/esitoVerificaPdf.js)
// scrive il «Simile a ...» sotto il formulario, nella tabella «Formulari del
// report non registrati» (revisione del 13/10/2026).
//
// Dal 12/10 (alta A57) un formulario del report che differisce di uno o due
// caratteri da uno registrato, senza una conferma dalla riga, e' «non presente
// nel gestionale», con l'osservazione «Simile a ...» e simile_a sull'esito. La
// scheda e l'Excel la mostravano, perche' li' si scorrono tutte le discrepanze;
// il PDF, che e' quello che si manda all'impianto, no: l'impianto leggeva
// «non registrato» senza sapere che un formulario quasi uguale c'e'.
//
// Il PDF si costruisce con un jsPDF finto che tiene i testi scritti, cosi' la
// prova vede che cosa finisce sulla pagina. npm run prove
import { caricaLibPagine } from './dati/libPagine.mjs';
import { caricaMovimenti, verificaReport, normalizzaRigheReport } from '../base44/shared/reportSettimanali.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Il jsPDF finto: ogni testo scritto finisce in __TESTI, con la sua posizione.
globalThis.__TESTI = [];
class PdfFinto {
  constructor() { this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } }; this.pagine = 1; }
  setFont() {} setFontSize() {} setTextColor() {} setFillColor() {} setDrawColor() {} setLineWidth() {}
  rect() {} roundedRect() {} line() {} circle() {}
  text(t, x, y) { globalThis.__TESTI.push({ t: Array.isArray(t) ? t.join(' ') : String(t), x, y }); }
  splitTextToSize(s) { return String(s).split('\n'); }
  addPage() { this.pagine++; }
  getNumberOfPages() { return this.pagine; }
  setPage() {}
  save(nome) { globalThis.__SALVATO = nome; }
}
globalThis.__PDF_FINTO = { jsPDF: PdfFinto };
// verifiche.js si carica a parte (i suoi import con l'alias li risolve solo
// caricaLibPagine) e si passa al PDF al posto del suo import.
globalThis.__VERIFICHE = await caricaLibPagine('lib/verifiche');
const { esportaEsitoVerificaPdf, notaSimile } = await caricaLibPagine('lib/esitoVerificaPdf', [
  ["const { jsPDF } = await import('jspdf');", 'const { jsPDF } = globalThis.__PDF_FINTO;'],
  [/import \{([^}]*)\} from '@\/lib\/verifiche';/, 'const {$1} = globalThis.__VERIFICHE;'],
]);

// Il caso della revisione: nel gestionale RGYTR027030CR (2.860 kg, classe P,
// 08/09); nel report RGYTR027012CR (3.400 kg, classe P, 11/09), a due caratteri,
// con la sola classe in comune, e RGYTR027777CR, che non somiglia a niente.
const archivio = (righe) => ({ list: async () => righe, filter: async () => righe });
const IRIGOM = 'IRIGOM SRL';
const mov = await caricaMovimenti({ asServiceRole: { entities: {
  PrimariaRete: archivio([{ id: 'ET30', id_ordine: 'ET30', numero_fir: 'RGYTR027030CR', stato: 'terminato', peso_effettivo: 2860, classe: 'P', destinazione: IRIGOM, trasportatore: 'NAPPI SUD SRL',
    ordine_immesso_il: '2026-09-01T08:00:00Z', trasporto_iniziato_il: '2026-09-08T00:00:00Z', trasporto_finito_il: '2026-09-08T00:00:00Z' }]),
  PrimariaAci: archivio([]), Secondaria: archivio([]), ExtraRaccolta: archivio([]), Fornitore: archivio([]),
} } });
const righe = normalizzaRigheReport([
  { n: 2, fir: 'RGYTR027012CR', peso: 3400, data_fine: '11/09/2026', classe: 'P' },
  { n: 3, fir: 'RGYTR099777ZZ', peso: 1000, data_fine: '10/09/2026', classe: 'P' },
], 'kg').righe;
const esito = verificaReport(righe, mov.movimenti, { chiave: 'irigom', nome: IRIGOM, inizio: '2026-09-07', fine: '2026-09-13', senzaFine: mov.senza_fine });
const v = {
  anno: 2026, settimana: 37, data_inizio: '2026-09-07', data_fine: '2026-09-13', soggetto_nome: IRIGOM, soggetto_chiave: 'irigom',
  file_nome: 'report.xlsx', verificata_il: '2026-09-15T08:00:00Z', esito_json: JSON.stringify(esito),
};

console.log('IL SIMILE NEL PDF, SOTTO IL FORMULARIO');
{
  const r2 = esito.esiti.find(e => e.n === 2);
  verifica('la verifica ha il caso: riga 2 non registrata, simile a 030CR', r2 && r2.esito === 'non_trovata' && r2.simile_a === 'RGYTR027030CR', JSON.stringify(r2));
  globalThis.__TESTI = [];
  await esportaEsitoVerificaPdf(v);
  const testi = globalThis.__TESTI;
  // dalla sezione dei non registrati in poi
  const sezione = testi.findIndex(x => x.t === 'FORMULARI DEL REPORT NON REGISTRATI');
  const dopo = (cond) => { const k = testi.findIndex((x, j) => j > sezione && cond(x)); return sezione >= 0 ? k : -1; };
  verifica('il PDF ha la tabella dei non registrati', sezione >= 0);
  const i012 = dopo(x => /RGYTR027012CR/.test(x.t) && !/Simile/.test(x.t));
  const simile = dopo(x => /^Simile a RGYTR027030CR/.test(x.t));
  verifica('il PDF scrive «Simile a RGYTR027030CR»', simile >= 0, JSON.stringify(testi.filter(x => /Simile|027012/.test(x.t))));
  verifica('sotto il formulario della riga, nella stessa colonna',
    i012 >= 0 && simile > i012 && testi[simile].x === testi[i012].x && testi[simile].y > testi[i012].y, JSON.stringify([testi[i012], testi[simile]]));
  verifica('con il perche\', in parole per l\'impianto (gli accenti, niente «gestionale»)',
    simile >= 0 && /servono lo stesso peso o la data entro un giorno/.test(testi[simile].t) && /non si considera lo stesso carico/.test(testi[simile].t) && !/gestionale/.test(testi[simile].t), testi[simile] && testi[simile].t);
  verifica('la riga senza simili non ha note', !testi.some(x => /Simile a/.test(x.t) && /099777/.test(x.t)));
}

console.log('UNA VERIFICA SALVATA COL SOLO simile_a');
{
  verifica('il PDF ha la regola della nota', typeof notaSimile === 'function');
  if (typeof notaSimile !== 'function') { console.log(`\n${ok} verifiche superate, ${ko + 3} fallite`); process.exit(1); }
  verifica('dice almeno il numero', notaSimile({ simile_a: 'RGYTR027030CR', discrepanze: [{ gravita: 'anomalia', messaggio: 'Formulario non presente nel gestionale' }] }) === 'Simile a RGYTR027030CR');
  verifica('senza simile, niente', notaSimile({ discrepanze: [] }) === '' && notaSimile({}) === '');
  verifica('l\'osservazione si scrive come all\'impianto', notaSimile({ simile_a: 'X', discrepanze: [{ gravita: 'osservazione', messaggio: "Simile a RGYTR027030CR (1 carattere diverso), che e' gia' abbinato a un'altra riga del report (riga 2): non si considera lo stesso carico" }] })
    === "Simile a RGYTR027030CR (1 carattere diverso), che è già abbinato a un'altra riga del report (riga 2): non si considera lo stesso carico");
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
