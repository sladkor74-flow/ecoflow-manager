// Prova del riconoscimento dei documenti di qualifica
// (base44/shared/tipiDocumento.ts): un DURC non e' una visura e non e' una White
// List. Si controlla anche che non si gridi al lupo quando non si capisce.
// npm run prove
import { riconosciTipoDocumento, confrontaTipoDocumento, problemiLettura } from '../base44/shared/tipiDocumento.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const fam = (t) => { const r = riconosciTipoDocumento(t); return r ? r.chiave : null; };

console.log('I TREDICI DOCUMENTI DEL CATALOGO');
const catalogo = [
  ['Contratto con Ecotyre', 'contratto'],
  ['Certificazione ISO 14001', 'iso'],
  ['Polizza di responsabilita civile', 'polizza_rc'],
  ['Conformita End of Waste della gomma vulcanizzata', 'end_of_waste'],
  ['Iscrizione RENTRI', 'rentri'],
  ["Garanzie finanziarie dell'impianto", 'garanzia_finanziaria'],
  ["Autorizzazione dell'impianto", 'autorizzazione_impianto'],
  ["Garanzia finanziaria per l'Albo", 'garanzia_finanziaria'],
  ['Iscrizione Albo Nazionale Gestori Ambientali', 'albo_gestori'],
  ['Contratto con SMOCO', 'contratto'],
  ['Iscrizione White List antimafia', 'white_list'],
  ['DURC', 'durc'],
  ['Visura camerale', 'visura'],
];
for (const [nome, atteso] of catalogo) {
  verifica('riconosce ' + nome, fam(nome) === atteso, 'trovato ' + fam(nome));
}

console.log('COME SI PRESENTANO I FILE VERI');
verifica('il DURC scritto per esteso', fam('Documento Unico di Regolarita Contributiva (DURC On Line)') === 'durc');
verifica('la visura con la Camera di Commercio', fam('Visura ordinaria estratta dal Registro delle Imprese') === 'visura');
verifica('la White List del prefetto', fam('Iscrizione negli elenchi prefettizi dei fornitori non soggetti a tentativi di infiltrazione mafiosa') === 'white_list');
verifica('la comunicazione antimafia non e la White List', fam('Comunicazione antimafia liberatoria') === 'antimafia');
verifica('la fideiussione non e la polizza RC', fam('Polizza fideiussoria a garanzia degli obblighi') === 'garanzia_finanziaria');
verifica('la CQC e la patente sono due cose', fam('Carta di qualificazione del conducente') === 'cqc' && fam('Patente di guida categoria C') === 'patente');

console.log('CASELLA CONTRO FILE');
const letto = (tipo, resto) => Object.assign({ tipo_documento: tipo, leggibile: true, sintesi: 'documento', intestatario: 'ALFA SRL' }, resto || {});
verifica('DURC nella casella della visura: sbagliato', confrontaTipoDocumento('Visura camerale', letto('DURC')).esito === 'diverso');
verifica('visura nella casella del DURC: sbagliato', confrontaTipoDocumento('DURC', letto('Visura camerale storica')).esito === 'diverso');
verifica('White List nella casella antimafia: sbagliato', confrontaTipoDocumento('Comunicazione antimafia', letto('Iscrizione White List')).esito === 'diverso');
verifica('DURC nella sua casella: coincide', confrontaTipoDocumento('DURC', letto('DURC On Line')).esito === 'coincide');
verifica("l'Albo nella sua casella: coincide", confrontaTipoDocumento('Iscrizione Albo Nazionale Gestori Ambientali', letto('Provvedimento di iscrizione all Albo Nazionale Gestori Ambientali')).esito === 'coincide');
verifica('tipo non riconosciuto: non si grida al lupo', confrontaTipoDocumento('DURC', letto('Attestazione SOA')).esito === 'incerto');
verifica('casella non riconosciuta: non si grida al lupo', confrontaTipoDocumento('Modulo interno 47', letto('DURC')).esito === 'incerto');
verifica('lettura senza tipo: si guarda la sintesi', confrontaTipoDocumento('Visura camerale', { tipo_documento: '', sintesi: 'Il documento e un DURC che attesta la regolarita' }).esito === 'diverso');

console.log('QUANDO IL FILE NON SI LEGGE');
const p1 = problemiLettura({ leggibile: false, note_lettura: 'pagine tagliate' });
verifica('illeggibile: bloccante e dice cosa fare', p1.length === 1 && p1[0].gravita === 'bloccante' && p1[0].messaggio.includes('pagine tagliate') && /PDF|scansione/.test(p1[0].messaggio));
const p2 = problemiLettura({ leggibile: true, tipo_documento: 'DURC', sintesi: 'x', intestatario: '', data_emissione: '' });
verifica('letto ma vuoto: bloccante, parla di scansione senza testo o file protetto', p2.length === 1 && p2[0].gravita === 'bloccante' && /protetto|senza testo/.test(p2[0].messaggio));
const p3 = problemiLettura({ leggibile: true, tipo_documento: '', intestatario: 'ALFA SRL', data_emissione: '2026-01-10', sintesi: 'Documento rilasciato dall ente competente in data odierna' });
verifica('tipo non dichiarato: solo attenzione', p3.length === 1 && p3[0].gravita === 'attenzione');
const p4 = problemiLettura({ leggibile: true, tipo_documento: 'DURC', intestatario: 'ALFA SRL', data_emissione: '2026-01-10', data_scadenza: '2026-05-10', sintesi: 'DURC regolare rilasciato da INPS' });
verifica('documento normale: nessun problema di lettura', p4.length === 0);

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
