// Prova della manutenzione dell'archivio (base44/shared/fileArchivio.ts): quali
// documenti sostituiti possono perdere il file. npm run prove
import { daAlleggerire, giorniDa, fileDaSostituire, arretratiDaSostituire } from '../base44/shared/fileArchivio.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const ADESSO = Date.parse('2026-09-21T10:00:00Z');
const anniFa = (n) => new Date(ADESSO - n * 365 * 86400000).toISOString();

const documenti = [
  { id: 'vecchio', stato: 'sostituito', file_uri: 'f1', soggetto_nome: 'ALFA', tipo_documento_nome: 'DURC', updated_date: anniFa(4) },
  { id: 'vecchissimo', stato: 'sostituito', file_uri: 'f2', soggetto_nome: 'BETA', tipo_documento_nome: 'Visura camerale', updated_date: anniFa(7) },
  { id: 'appena', stato: 'sostituito', file_uri: 'f3', soggetto_nome: 'GAMMA', tipo_documento_nome: 'DURC', updated_date: anniFa(1) },
  { id: 'senza_file', stato: 'sostituito', file_uri: '', updated_date: anniFa(6) },
  { id: 'attivo', stato: 'attivo', file_uri: 'f5', updated_date: anniFa(6) },
  { id: 'nato_vecchio_messo_da_parte_ieri', stato: 'sostituito', file_uri: 'f6', created_date: anniFa(8), updated_date: anniFa(0.2) },
];

const scelti = daAlleggerire(documenti, { adessoMs: ADESSO });
const ids = scelti.map(x => x.id);

console.log('CHI PUO PERDERE IL FILE');
verifica('sostituito da quattro anni', ids.includes('vecchio'));
verifica('sostituito da sette anni', ids.includes('vecchissimo'));
verifica('in tutto due, non uno di piu', scelti.length === 2, ids.join(','));

console.log('CHI NON SI TOCCA');
verifica('sostituito da un anno: e ancora recente', !ids.includes('appena'));
verifica('un documento attivo non si tocca mai', !ids.includes('attivo'));
verifica('senza file non ce niente da togliere', !ids.includes('senza_file'));
verifica('conta da quando e stato messo da parte, non da quando e nato', !ids.includes('nato_vecchio_messo_da_parte_ieri'));

console.log('COME SI PRESENTA');
verifica('prima i piu vecchi', scelti[0].id === 'vecchissimo' && scelti[0].anni === 7);
verifica('ogni riga dice chi e cosa', scelti[1].soggetto_nome === 'ALFA' && scelti[1].tipo_documento_nome === 'DURC');
verifica('la soglia si puo cambiare', daAlleggerire(documenti, { adessoMs: ADESSO, anni: 6 }).length === 1);
verifica('con soglia bassa entra anche quello di un anno', daAlleggerire(documenti, { adessoMs: ADESSO, anni: 1 }).length === 3);
verifica('giorniDa senza data non inventa numeri', giorniDa(null, ADESSO) === null);



// === I FILE DEL CARICAMENTO DATI (29/09/2026) ===
// "si devono sostituire ogni volta che carico il successivo, sempre che sia stato
// caricato al 100%": il record del registro resta, se ne va solo il file.
const registro = [
  { id: 'sec1', tipo_file: 'secondarie', file_url: 'u1', nome_file: 'sec settembre.xlsx', esito: 'successo', created_date: '2026-09-01T08:00:00Z' },
  { id: 'sec2', tipo_file: 'secondarie', file_url: 'u2', nome_file: 'sec ottobre.xlsx', esito: 'successo', created_date: '2026-10-01T08:00:00Z' },
  { id: 'sec3', tipo_file: 'secondarie', file_url: '', nome_file: 'sec agosto.xlsx', esito: 'successo', created_date: '2026-08-01T08:00:00Z' },
  { id: 'ter1', tipo_file: 'terziarie', file_url: 'u4', nome_file: 'ter settembre.xlsx', esito: 'successo', created_date: '2026-09-02T08:00:00Z' },
  { id: 'ter2', tipo_file: 'terziarie', file_url: 'u5', nome_file: 'ter ottobre a meta.xlsx', esito: 'parziale', created_date: '2026-10-02T08:00:00Z' },
  { id: 'pdr1', tipo_file: 'pdr', file_url: 'u6', nome_file: 'pdr.xlsx', esito: 'successo', created_date: '2026-03-01T08:00:00Z' },
  { id: 'gom1', tipo_file: 'gommisti', file_url: 'u7', nome_file: 'gom rotto.xlsx', esito: 'errore', created_date: '2026-05-01T08:00:00Z' },
  { id: 'gom2', tipo_file: 'gommisti', file_url: 'u8', nome_file: 'gom rotto 2.xlsx', esito: 'errore', created_date: '2026-06-01T08:00:00Z' },
];

console.log('QUANDO ARRIVA UN CARICAMENTO NUOVO');
const prec = fileDaSostituire(registro, { tipoFile: 'secondarie', idCorrente: 'sec2' });
verifica('il precedente dello stesso tipo perde il file', prec.map(x => x.id).join() === 'sec1', prec.map(x => x.id).join());
verifica('quello appena caricato non si tocca', !prec.some(x => x.id === 'sec2'));
verifica('chi non ha piu il file non si riconta', !prec.some(x => x.id === 'sec3'));
verifica('gli altri tipi non si toccano', !prec.some(x => x.tipo_file === 'terziarie'));
verifica('porta il nome del file, per poterlo dire', prec[0].nome_file === 'sec settembre.xlsx');

console.log("L'ARRETRATO, TIPO PER TIPO");
const arretrati = arretratiDaSostituire(registro);
const perTipo = Object.fromEntries(arretrati.map(g => [g.tipo_file, g]));
verifica('delle secondarie si tiene il piu recente', perTipo.secondarie.tenuto.id === 'sec2' && perTipo.secondarie.da_togliere[0].id === 'sec1');
verifica('un tipo con un file solo non compare', !perTipo.pdr);
verifica('si tiene il RIUSCITO piu recente, non il parziale',
  perTipo.terziarie.tenuto.id === 'ter1' && perTipo.terziarie.da_togliere[0].id === 'ter2');
verifica('se nessuno e riuscito si tiene il piu recente e basta',
  perTipo.gommisti.tenuto.id === 'gom2' && perTipo.gommisti.da_togliere.map(x => x.id).join() === 'gom1');
verifica('un registro vuoto non da niente da fare', arretratiDaSostituire([]).length === 0);
verifica('senza file non si tocca niente', arretratiDaSostituire([{ id: 'x', tipo_file: 'secondarie', file_url: '' }]).length === 0);

console.log("LA FORZATURA RIUSA LO STESSO FILE");
// Il tentativo fallito e la forzatura riuscita puntano allo stesso indirizzo:
// cancellarlo perche' "e' del caricamento di prima" cancellerebbe il file buono.
const conForzatura = [
  { id: 'f1', tipo_file: 'status', file_url: 'uguale', nome_file: 'status.xlsx', esito: 'errore', created_date: '2026-10-05T08:00:00Z' },
  { id: 'f2', tipo_file: 'status', file_url: 'uguale', nome_file: 'status.xlsx', esito: 'successo', created_date: '2026-10-05T08:10:00Z' },
  { id: 'f0', tipo_file: 'status', file_url: 'vecchio', nome_file: 'status settembre.xlsx', esito: 'successo', created_date: '2026-09-05T08:00:00Z' },
];
const dopoForzatura = fileDaSostituire(conForzatura, { tipoFile: 'status', idCorrente: 'f2', fileCorrente: 'uguale' });
verifica('il file del tentativo fallito non si cancella: e lo stesso del buono', !dopoForzatura.some(x => x.file_url === 'uguale'), dopoForzatura.map(x => x.file_url).join());
verifica('quello davvero vecchio si cancella', dopoForzatura.map(x => x.id).join() === 'f0');
const arrForzatura = arretratiDaSostituire(conForzatura);
verifica("nell'arretrato l'indirizzo tenuto non si tocca mai", !arrForzatura[0].da_togliere.some(x => x.file_url === 'uguale'), JSON.stringify(arrForzatura[0].da_togliere.map(x => x.id)));
verifica('e il piu vecchio se ne va', arrForzatura[0].da_togliere.map(x => x.id).join() === 'f0');

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
