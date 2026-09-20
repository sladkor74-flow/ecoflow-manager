// Prova della scelta dei documenti da far rileggere all'agente
// (daAnalizzare in base44/shared/analisiDocumento.ts). npm run prove
import { daAnalizzare, RILEGGI_DOPO_GIORNI, controlliFormali } from '../base44/shared/analisiDocumento.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const ADESSO = Date.parse('2026-09-21T10:00:00Z');
const giorniFa = (n) => new Date(ADESSO - n * 86400000).toISOString();
const minutiFa = (n) => new Date(ADESSO - n * 60000).toISOString();
const lettura = (quando) => JSON.stringify({ lettura: { tipo_documento: 'DURC' }, analizzato_il: quando });

const tipi = [
  { id: 't1', nome: 'DURC', tipo_scadenza: 'da_documento', attivo: true },
  { id: 't2', nome: 'Contratto', tipo_scadenza: 'nessuna', attivo: true },
  { id: 't3', nome: 'Voce spenta', tipo_scadenza: 'da_documento', attivo: false },
];
const base = { stato: 'attivo', file_uri: 'f', tipo_documento_id: 't1', analisi_stato: 'completata', soggetto_nome: 'ALFA' };

const documenti = [
  { ...base, id: 'mai', analisi_json: '', soggetto_nome: 'MAI LETTO' },
  { ...base, id: 'fallita', analisi_stato: 'errore', analisi_json: lettura(giorniFa(1)), data_scadenza: '2027-01-01', soggetto_nome: 'FALLITA' },
  { ...base, id: 'interrotta', analisi_stato: 'in_corso', analisi_avviata_il: minutiFa(40), analisi_json: '', soggetto_nome: 'INTERROTTA' },
  { ...base, id: 'in_corso_ora', analisi_stato: 'in_corso', analisi_avviata_il: minutiFa(3), analisi_json: lettura(giorniFa(1)), data_scadenza: '2027-01-01' },
  { ...base, id: 'senza_scad', analisi_json: lettura(giorniFa(2)), soggetto_nome: 'SENZA SCADENZA' },
  { ...base, id: 'scad_manuale', analisi_json: lettura(giorniFa(2)), data_scadenza_manuale: '2027-03-01' },
  { ...base, id: 'vecchia', analisi_json: lettura(giorniFa(200)), data_scadenza: '2027-01-01', soggetto_nome: 'VECCHIA' },
  { ...base, id: 'recente', analisi_json: lettura(giorniFa(10)), data_scadenza: '2027-01-01' },
  { ...base, id: 'senza_scad_ma_non_scade', tipo_documento_id: 't2', analisi_json: lettura(giorniFa(2)) },
  { ...base, id: 'sostituito', stato: 'sostituito', analisi_json: '' },
  { ...base, id: 'senza_file', file_uri: '', analisi_json: '' },
  { ...base, id: 'tipo_spento', tipo_documento_id: 't3', analisi_json: '' },
  { ...base, id: 'tipo_ignoto', tipo_documento_id: 'boh', analisi_json: '' },
];

const tutti = daAnalizzare(documenti, tipi, { adessoMs: ADESSO, massimo: 0 });
const ids = tutti.map(x => x.id);

console.log('CHI VA RILETTO');
verifica('il mai letto', ids.includes('mai'));
verifica('quello con la lettura fallita', ids.includes('fallita'));
verifica('quello interrotto da quaranta minuti', ids.includes('interrotta'));
verifica('quello letto ma senza scadenza', ids.includes('senza_scad'));
verifica('quello letto piu di sei mesi fa', ids.includes('vecchia') && RILEGGI_DOPO_GIORNI === 180);

console.log('CHI NON SI TOCCA');
verifica('uno in corso da tre minuti sta lavorando, non si disturba', !ids.includes('in_corso_ora'));
verifica('la scadenza messa a mano basta', !ids.includes('scad_manuale'));
verifica('una lettura di dieci giorni fa va bene', !ids.includes('recente'));
verifica('se il documento non scade, non serve la scadenza', !ids.includes('senza_scad_ma_non_scade'));
verifica('i sostituiti restano nello storico', !ids.includes('sostituito'));
verifica('senza file non ce niente da leggere', !ids.includes('senza_file'));
verifica('voce del catalogo disattivata: si lascia stare', !ids.includes('tipo_spento'));
verifica('tipo che nel catalogo non ce piu: si lascia stare', !ids.includes('tipo_ignoto'));
verifica('in tutto cinque, non uno di piu', tutti.length === 5, ids.join(','));

console.log('ORDINE E LIMITE');
verifica('prima i mai letti, poi le letture fallite, poi le interrotte', ids[0] === 'mai' && ids[1] === 'fallita' && ids[2] === 'interrotta', ids.join(','));
verifica('le vecchie per ultime', ids[ids.length - 1] === 'vecchia');
const tre = daAnalizzare(documenti, tipi, { adessoMs: ADESSO, massimo: 3 });
verifica('il limite si rispetta', tre.length === 3 && tre[0].id === 'mai');
verifica('senza limite indicato ne prende cinque', daAnalizzare(documenti, tipi, { adessoMs: ADESSO }).length === 5);
verifica('ogni scelta dice perche, in italiano', tutti.every(x => x.spiegazione && x.spiegazione.length > 10));


console.log('CHI E INTESTATARIO');
const g = (l, c) => controlliFormali(l, c).map(p => p.gravita + ':' + p.messaggio.slice(0, 40));
verifica('stessa ragione sociale: nessun problema', g({ intestatario: 'ALFA RACCOLTA SRL' }, { nome: 'Alfa Raccolta S.r.l.' }).length === 0);
verifica('nome e cognome al contrario sono la stessa persona', g({ intestatario: 'GIOVANNI TORRES' }, { nome: 'TORRES GIOVANNI' }).length === 0);
verifica('un altro intestatario e bloccante', g({ intestatario: 'BETA SRL' }, { nome: 'ALFA RACCOLTA SRL' }).some(x => x.startsWith('bloccante')));
verifica('partita IVA diversa: bloccante', g({ intestatario: 'ALFA', partita_iva: '11111111111' }, { nome: 'ALFA', piva: '22222222222' }).some(x => x.startsWith('bloccante')));
verifica('codice fiscale diverso: bloccante', g({ intestatario: 'TORRES GIOVANNI', codice_fiscale: 'TRRGNN82H28G273G' }, { nome: 'TORRES GIOVANNI', codice_fiscale: 'RSSMRA80A01H501U' }).some(x => x.startsWith('bloccante')));
verifica('codice fiscale uguale: va bene anche se il nome e scritto diverso', g({ intestatario: 'TORRES GIOVANNI DITTA', codice_fiscale: 'TRRGNN82H28G273G' }, { nome: 'GIOVANNI TORRES', codice_fiscale: 'TRRGNN82H28G273G' }).length === 0);
verifica('partita IVA e codice fiscale diversi sono lo stesso soggetto', g({ intestatario: 'ALFA', codice_fiscale: '11111111111' }, { nome: 'ALFA', piva: '22222222222', codice_fiscale: '11111111111' }).length === 0);
verifica('il documento riporta il CF, in anagrafica ce la piva: nessun falso allarme', g({ intestatario: 'ALFA', partita_iva: '11111111111' }, { nome: 'ALFA', piva: '22222222222', codice_fiscale: '11111111111' }).length === 0);
verifica('nessuno dei numeri coincide: bloccante', g({ intestatario: 'ALFA', partita_iva: '33333333333' }, { nome: 'ALFA', piva: '22222222222', codice_fiscale: '11111111111' }).some(x => x.startsWith('bloccante')));
verifica('su un contratto il numero diverso avvisa, non blocca', controlliFormali({ intestatario: 'ALFA', partita_iva: '33333333333' }, { nome: 'ALFA', piva: '22222222222' }, { bilaterale: true }).every(p => p.gravita === 'attenzione'));
verifica('e spiega che le parti sono due', controlliFormali({ intestatario: 'SMOCO SRL' }, { nome: 'ECOTYRE SCRL' }, { bilaterale: true })[0].messaggio.includes('due parti'));
verifica('documento non firmato: solo attenzione', g({ intestatario: 'ALFA', firmato: 'no' }, { nome: 'ALFA' }).every(x => x.startsWith('attenzione')));

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
