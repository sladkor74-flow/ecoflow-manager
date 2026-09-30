// L'inventario dei file che la piattaforma tiene per noi
// (base44/shared/inventarioFile.ts).
//
// E' la lista che si manda a chi deve rimuoverli a mano, perche' la piattaforma
// non sa cancellare un file. Un elenco sbagliato qui vuol dire chiedere la
// rimozione di file che non esistono, o dimenticarne di veri: per questo si
// prova.
//
// npm run prove
import { voceFile, perFile, csvInventario, contaInventario, ARCHIVI_CON_FILE } from '../base44/shared/inventarioFile.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const def = ARCHIVI_CON_FILE.find(a => a.entita === 'UploadLog');
const defQualifica = ARCHIVI_CON_FILE.find(a => a.entita === 'DocumentoQualifica');

console.log('UNA RIGA SOLO SE QUEL RECORD TIENE DAVVERO UN FILE');
verifica('senza niente, nessuna voce', voceFile(def, { id: 'a' }) === null);
verifica('con i campi vuoti, nessuna voce', voceFile(def, { id: 'a', file_url: '', file_uri: '  ' }) === null);
verifica('un file pubblico si riconosce', voceFile(def, { id: 'a', file_url: 'https://x/y.xlsx' }).genere === 'pubblico');
verifica('un file privato si riconosce', voceFile(def, { id: 'a', file_uri: 'uri-123' }).genere === 'privato');
{
  // Un record convertito porta il file_uri e il file_url vuoto; se per qualche
  // motivo li avesse tutti e due, vince il pubblico: e' quello che va rimosso.
  const v = voceFile(def, { id: 'a', file_url: 'https://x/y.xlsx', file_uri: 'uri-123' });
  verifica('con tutti e due vince il pubblico', v.genere === 'pubblico' && v.riferimento === 'https://x/y.xlsx', JSON.stringify(v));
}
{
  const v = voceFile(def, { id: 'r1', file_uri: 'u1', tipo_file: 'secondarie', nome_file: 'SECONDARIE.xlsx', created_date: '2026-09-12T10:00:00Z' });
  verifica('la descrizione dice che file era', v.descrizione === 'secondarie · SECONDARIE.xlsx', v.descrizione);
  verifica('e quando e stato caricato', v.caricato_il === '2026-09-12', v.caricato_il);
}
{
  const v = voceFile(defQualifica, { id: 'q1', file_uri: 'u9', soggetto_nome: 'GATIM SRL', tipo_documento_nome: 'Visura' });
  verifica('la qualifica dice il soggetto e il documento', v.descrizione === 'GATIM SRL · Visura', v.descrizione);
}

console.log('UN FILE PER RIGA, NON UN RECORD PER RIGA');
{
  // Il caso vero: un caricamento forzato riusa il file del tentativo fallito, e
  // nel registro restano piu' righe con lo stesso indirizzo. Sul file
  // dell'utente, 72 record per 53 file.
  const voci = [
    voceFile(def, { id: 'r1', file_url: 'https://x/uguale.xlsx', tipo_file: 'terziarie', nome_file: 'A.xlsx', created_date: '2026-08-10T08:00:00Z' }),
    voceFile(def, { id: 'r2', file_url: 'https://x/uguale.xlsx', tipo_file: 'terziarie', nome_file: 'A.xlsx', created_date: '2026-08-10T09:00:00Z' }),
    voceFile(def, { id: 'r3', file_url: 'https://x/uguale.xlsx', tipo_file: 'terziarie', nome_file: 'A.xlsx', created_date: '2026-08-10T10:00:00Z' }),
    voceFile(def, { id: 'r4', file_uri: 'privato-1', tipo_file: 'pdr', nome_file: 'PDR.xlsx', created_date: '2026-09-01T08:00:00Z' }),
  ];
  const file = perFile(voci);
  verifica('tre record, un file solo', file.length === 2, JSON.stringify(file.map(f => f.riferimento)));
  const doppio = file.find(f => f.riferimento === 'https://x/uguale.xlsx');
  verifica('e si dice quanti record lo usavano', doppio.record === 3, String(doppio.record));
  verifica('con tutti i loro id', doppio.id.join(',') === 'r1,r2,r3', doppio.id.join(','));

  const conta = contaInventario(voci);
  verifica('il conto dei FILE e due', conta.file === 2, JSON.stringify(conta));
  verifica('il conto dei RECORD e quattro', conta.record === 4, JSON.stringify(conta));
  verifica('un pubblico e un privato', conta.pubblici === 1 && conta.privati === 1, JSON.stringify(conta));
}

console.log('I PUBBLICI ESCONO PER PRIMI: SONO QUELLI CHE SCOTTANO');
{
  const voci = [
    voceFile(def, { id: 'p1', file_uri: 'privato-a', tipo_file: 'pdr', nome_file: 'P.xlsx', created_date: '2026-01-01T08:00:00Z' }),
    voceFile(def, { id: 'p2', file_url: 'https://x/pubblico.xlsx', tipo_file: 'primarie', nome_file: 'PRIMARIE.xlsx', created_date: '2026-09-01T08:00:00Z' }),
  ];
  const righe = csvInventario(voci).split('\n');
  verifica('intestazione giusta', righe[0] === 'genere,riferimento,archivio,cosa,descrizione,caricato_il,record_che_lo_usano', righe[0]);
  verifica('il pubblico e la prima riga, anche se caricato dopo', righe[1].startsWith('pubblico,https://x/pubblico.xlsx'), righe[1]);
  verifica('il privato viene dopo', righe[2].startsWith('privato,'), righe[2]);
}

console.log('IL CSV NON SI ROMPE CON LE VIRGOLE E LE VIRGOLETTE');
{
  const voci = [voceFile(def, { id: 'x', file_url: 'https://x/a.xlsx', tipo_file: 'primarie', nome_file: 'REPORT, "settembre".xlsx' })];
  const riga = csvInventario(voci).split('\n')[1];
  verifica('il campo con la virgola sta fra virgolette', /"primarie · REPORT, ""settembre"".xlsx"/.test(riga), riga);
  verifica('e le colonne restano sette', riga.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).length === 7, riga);
}

console.log('SI GUARDANO TUTTI GLI ARCHIVI CHE TENGONO UN FILE');
{
  // Se qualcuno aggiunge un campo file a un'entita' e si dimentica di questa
  // tabella, quel file resta fuori dall'inventario e nessuno lo fara' rimuovere.
  const attesi = ['UploadLog', 'DocumentoQualifica', 'ContrattoFornitore', 'ModelloContratto', 'ModelloDocumento', 'QuadraturaFir', 'VerificaReport', 'EsportazioneFatturazione'];
  for (const e of attesi) verifica(`${e} e nell'inventario`, ARCHIVI_CON_FILE.some(a => a.entita === e));
  verifica('ogni voce dice almeno un campo', ARCHIVI_CON_FILE.every(a => a.campoUrl || a.campoUri));
  verifica('e ogni voce sa descriversi', ARCHIVI_CON_FILE.every(a => typeof a.etichetta === 'function' && typeof a.cosa === 'string' && a.cosa));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
