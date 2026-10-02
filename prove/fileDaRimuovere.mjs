// Il registro dei file che nessun record usa piu'
// (base44/shared/fileDaRimuovere.ts).
//
// Perche' si prova. La piattaforma non cancella i file e non li elenca: quando
// un record che tiene un file viene cancellato, quel file resta caricato per
// sempre e l'unica traccia del suo nome e' questo registro. Se un punto di
// cancellazione smette di scriverlo, il file diventa impossibile da far
// rimuovere e nessuno si accorge di niente: non c'e' nessun errore a video, solo
// un documento aziendale che resta sulla piattaforma per sempre. Per questo le
// prove guardano anche il codice dei punti di cancellazione, non solo le regole.
//
// npm run prove
import {
  voceDaRimuovere, vociNuove, annotaFileDaRimuovere, voceDaRimuovereDi,
  annotaPrimaDiCancellare, DESCRIVE, STATI_DA_RIMUOVERE,
  MOTIVO_RECORD_CANCELLATO, MOTIVO_FILE_SOSTITUITO,
} from '../base44/shared/fileDaRimuovere.ts';
import { ARCHIVI_CON_FILE } from '../base44/shared/inventarioFile.ts';
import { readFileSync } from 'node:fs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const OGGI = '2026-10-02';
const verificaPdf = {
  id: 'v1', soggetto_nome: 'NAPPI SUD SRL', anno: 2026, settimana: 38,
  file_nome: 'report.pdf', file_uri: 'uri-nappi-38',
};
const verificaExcel = { id: 'v2', soggetto_nome: 'GATIM SRL', anno: 2026, settimana: 39 };

console.log('UNA VOCE SOLO SE QUEL RECORD TIENE DAVVERO UN FILE');
verifica('un report letto da Excel non lascia niente, perche non e mai salito',
  voceDaRimuovere({ entita: 'VerificaReport', record: verificaExcel, oggi: OGGI }) === null);
verifica('i campi vuoti non fanno una voce',
  voceDaRimuovere({ entita: 'VerificaReport', record: { id: 'x', file_uri: '  ', file_url: '' }, oggi: OGGI }) === null);
verifica('senza record non si scrive niente',
  voceDaRimuovere({ entita: 'VerificaReport', record: null, oggi: OGGI }) === null);
{
  const v = voceDaRimuovere({ entita: 'VerificaReport', record: verificaPdf, cosa: 'report', descrizione: 'NAPPI', oggi: OGGI });
  verifica('il file privato si riconosce', v.genere === 'privato' && v.riferimento === 'uri-nappi-38', JSON.stringify(v));
  verifica('e si ricorda da dove veniva', v.entita === 'VerificaReport' && v.record_id === 'v1');
  verifica('il motivo, se non detto, e la cancellazione del record', v.motivo === MOTIVO_RECORD_CANCELLATO, v.motivo);
  verifica('la pratica nasce da chiedere', v.stato === 'da_chiedere' && STATI_DA_RIMUOVERE.includes(v.stato));
  verifica('e si annota il giorno', v.annotato_il === OGGI, v.annotato_il);
}
{
  // Come nell'inventario: se ci sono tutti e due vince il pubblico, perche' e'
  // l'indirizzo che funziona per chiunque ce l'abbia.
  const v = voceDaRimuovere({ entita: 'UploadLog', record: { id: 'u1', file_url: 'https://media.base44.com/files/public/app/x_y.xlsx', file_uri: 'uri-y' }, oggi: OGGI });
  verifica('con tutti e due vince il pubblico', v.genere === 'pubblico' && v.riferimento.startsWith('https://'), JSON.stringify(v));
}
{
  const v = voceDaRimuovere({ entita: 'UploadLog', record: { id: 'u2', file_uri: 'uri-z' }, motivo: MOTIVO_FILE_SOSTITUITO, oggi: '2026-10-02T11:22:33Z' });
  verifica('il motivo detto si tiene', v.motivo === MOTIVO_FILE_SOSTITUITO);
  verifica('della data si tiene solo il giorno', v.annotato_il === '2026-10-02', v.annotato_il);
}

console.log('LO STESSO FILE NON SI CHIEDE DUE VOLTE');
{
  // Una verifica rifatta tre volte sullo stesso PDF, o un caricamento forzato che
  // riusa il file del tentativo fallito: chiedere tre volte la rimozione dello
  // stesso file e' il modo per farsi dire che il conto non torna.
  const a = { riferimento: 'uri-1' }, b = { riferimento: 'uri-2' };
  verifica('due voci diverse passano entrambe', vociNuove([a, b], []).length === 2);
  verifica('il doppione dentro lo stesso gruppo si scarta', vociNuove([a, { ...a }, b], []).length === 2);
  verifica('quello che c e gia non si riscrive', vociNuove([a, b], [{ riferimento: 'uri-1' }]).length === 1);
  verifica('e resta quello nuovo', vociNuove([a, b], [{ riferimento: 'uri-1' }])[0].riferimento === 'uri-2');
  verifica('una voce senza riferimento non entra', vociNuove([{ riferimento: '' }, a], []).length === 1);
}

console.log('LE PAROLE SONO QUELLE DELL INVENTARIO');
{
  // Una voce del registro e una dell'inventario finiscono nello stesso elenco e
  // parlano della stessa cosa: due nomi diversi per lo stesso genere di file
  // farebbero sembrare due pratiche quella che e' una. E il confronto scopre
  // anche i campi sbagliati: l'inventario diceva r.sito_nome, che VerificaReport
  // non ha, e l'etichetta usciva senza il nome del fornitore - la sola cosa che
  // serve a chi legge l'elenco mesi dopo (trovato il 02/10/2026).
  for (const entita of Object.keys(DESCRIVE)) {
    const inv = ARCHIVI_CON_FILE.find(a => a.entita === entita);
    verifica(`${entita} sta anche nell inventario`, !!inv);
    if (!inv) continue;
    verifica(`${entita}: le stesse parole per il "cosa"`, inv.cosa === DESCRIVE[entita].cosa, `${inv.cosa} / ${DESCRIVE[entita].cosa}`);
    const r = { soggetto_nome: 'NAPPI SUD SRL', settimana: 38, anno: 2026, file_nome: 'stampa.pdf' };
    verifica(`${entita}: la stessa etichetta sullo stesso record`,
      inv.etichetta(r) === DESCRIVE[entita].etichetta(r), `${inv.etichetta(r)} / ${DESCRIVE[entita].etichetta(r)}`);
    verifica(`${entita}: l etichetta non e vuota`, DESCRIVE[entita].etichetta(r).replace(/[\s·/]/g, '') !== '', DESCRIVE[entita].etichetta(r));
  }
}
{
  const v = voceDaRimuovereDi('VerificaReport', verificaPdf, MOTIVO_RECORD_CANCELLATO, OGGI);
  verifica('la verifica dice il fornitore e la settimana',
    v.descrizione === 'NAPPI SUD SRL · settimana 38/2026', v.descrizione);
  verifica('e che genere di file era', v.cosa === 'report settimanale di un fornitore', v.cosa);
}
{
  const q = { id: 'q1', settimana: 38, anno: 2026, file_nome: 'quadratura.pdf', file_uri: 'uri-q' };
  const v = voceDaRimuovereDi('QuadraturaFir', q, MOTIVO_RECORD_CANCELLATO, OGGI);
  verifica('la quadratura dice la settimana e il file', v.descrizione === 'settimana 38/2026 · quadratura.pdf', v.descrizione);
}
{
  // Un archivio che non sta nella tabella non fa perdere il file: si scrive
  // comunque, senza le parole. Il riferimento e' la cosa che serve.
  const v = voceDaRimuovereDi('ArchivioIgnoto', { id: 'z', file_uri: 'uri-ignoto' }, MOTIVO_RECORD_CANCELLATO, OGGI);
  verifica('un archivio sconosciuto si annota comunque', v && v.riferimento === 'uri-ignoto' && v.cosa === '', JSON.stringify(v));
}

console.log('SCRITTURA NEL REGISTRO');
const finto = (esistenti = [], guasto = null) => {
  const creati = [];
  return {
    creati,
    Entita: {
      filter: async (dove) => {
        if (guasto === 'filter') throw new Error('archivio non raggiungibile');
        return esistenti.filter(e => e.riferimento === dove.riferimento);
      },
      create: async (v) => {
        if (guasto === 'create') throw new Error('scrittura rifiutata');
        creati.push(v);
        return v;
      },
    },
  };
};
{
  const f = finto();
  const esito = await annotaFileDaRimuovere(f.Entita, [
    voceDaRimuovereDi('VerificaReport', verificaPdf, MOTIVO_RECORD_CANCELLATO, OGGI),
  ]);
  verifica('la voce si scrive', esito.annotati === 1 && f.creati.length === 1, JSON.stringify(esito));
  verifica('con dentro il riferimento del file', f.creati[0].riferimento === 'uri-nappi-38');
}
{
  const f = finto([{ id: 'r1', riferimento: 'uri-nappi-38' }]);
  const esito = await annotaFileDaRimuovere(f.Entita, [
    voceDaRimuovereDi('VerificaReport', verificaPdf, MOTIVO_RECORD_CANCELLATO, OGGI),
  ]);
  verifica('un file gia nel registro non si riscrive', esito.annotati === 0 && esito.gia === 1 && f.creati.length === 0, JSON.stringify(esito));
}
{
  const f = finto();
  const esito = await annotaFileDaRimuovere(f.Entita, [null, voceDaRimuovere({ entita: 'X', record: { id: 'a' }, oggi: OGGI })]);
  verifica('senza niente da scrivere non si tocca la piattaforma', esito.annotati === 0 && f.creati.length === 0);
}
{
  // NON SOLLEVA MAI: chi chiama sta cancellando un record, e un'annotazione che
  // non riesce non deve far fallire la cancellazione. L'errore si dice.
  for (const guasto of ['filter', 'create']) {
    const f = finto([], guasto);
    const esito = await annotaFileDaRimuovere(f.Entita, [voceDaRimuovereDi('VerificaReport', verificaPdf, MOTIVO_RECORD_CANCELLATO, OGGI)]);
    verifica(`un guasto in ${guasto} non solleva`, esito && esito.errore && esito.annotati === 0, JSON.stringify(esito));
  }
}
{
  const f = finto();
  const esito = await annotaPrimaDiCancellare(f.Entita, 'VerificaReport', verificaPdf, OGGI);
  verifica('la scorciatoia scrive la voce completa',
    esito.annotati === 1 && f.creati[0].cosa === 'report settimanale di un fornitore'
    && f.creati[0].descrizione === 'NAPPI SUD SRL · settimana 38/2026'
    && f.creati[0].motivo === MOTIVO_RECORD_CANCELLATO, JSON.stringify(f.creati));
}
{
  const f = finto();
  const esito = await annotaPrimaDiCancellare(f.Entita, 'VerificaReport', verificaExcel, OGGI);
  verifica('e su un record senza file non scrive niente', esito.annotati === 0 && f.creati.length === 0);
}

console.log('OGNI PUNTO DI CANCELLAZIONE LO SCRIVE PRIMA');
{
  // Se uno di questi punti smette di annotare, il file si perde in silenzio.
  // Per ciascuno si controlla che l'annotazione ci sia E che venga PRIMA della
  // cancellazione: dopo, il file_uri non si recupera piu' da nessuna parte.
  const punti = [
    ['src/components/verifiche/ReportSettimanali.jsx', 'VerificaReport', 2],
    ['src/components/verifiche/DettaglioVerifica.jsx', 'VerificaReport', 1],
    ['src/components/verifiche/QuadraturaFir.jsx', 'QuadraturaFir', 1],
    ['base44/functions/verificheReport/entry.ts', 'VerificaReport', 1],
  ];
  for (const [percorso, entita, quanti] of punti) {
    const sorgente = readFileSync(new URL('../' + percorso, import.meta.url), 'utf8');
    const annotazioni = sorgente.split('annotaPrimaDiCancellare(').length - 1;
    verifica(`${percorso}: annota prima di cancellare`, annotazioni === quanti, `annotazioni ${annotazioni}, attese ${quanti}`);
    verifica(`${percorso}: importa la funzione`, /import \{[^}]*annotaPrimaDiCancellare[^}]*\} from/.test(sorgente));
    // Ogni cancellazione di quell'archivio e' preceduta da un'annotazione: si
    // guarda che fra una annotaPrimaDiCancellare e la .delete non ce ne sia una
    // scoperta.
    const righe = sorgente.split('\n');
    let annotato = false, scoperte = 0;
    for (const r of righe) {
      if (r.includes('annotaPrimaDiCancellare(') && !r.trim().startsWith('import')) annotato = true;
      if (new RegExp(entita + '\\.delete\\(').test(r)) {
        if (!annotato) scoperte++;
        annotato = false;
      }
    }
    verifica(`${percorso}: nessuna cancellazione scoperta`, scoperte === 0, `${scoperte} cancellazioni senza annotazione`);
  }
}
{
  // L'elenco che si manda all'assistenza deve PESCARE dal registro: senza questo
  // il registro si riempie e nessuno lo legge mai.
  const sorgente = readFileSync(new URL('../base44/functions/inventarioFile/entry.ts', import.meta.url), 'utf8');
  verifica('l inventario legge il registro', /FileDaRimuovere/.test(sorgente) && /voceOrfana/.test(sorgente));
  verifica('e salta quelli gia rimossi', /=== 'rimosso'\) continue/.test(sorgente));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
