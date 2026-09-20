// Prova della manutenzione dell'archivio (base44/shared/fileArchivio.ts): quali
// documenti sostituiti possono perdere il file. npm run prove
import { daAlleggerire, giorniDa } from '../base44/shared/fileArchivio.ts';

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

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
