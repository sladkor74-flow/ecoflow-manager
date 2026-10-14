// Prova del CONTRATTO RIGENERATO E DEL CONTROFIRMATO (A67 = A90, giro K3 delle
// segnalazioni del 20/09, corretto il 12/10/2026).
//
// Due difetti veri sul codice dell'11/10/2026, tutti e due nella pagina
// (src/components/qualifica/ContrattiAnno.jsx):
// - rigenerare un contratto gia' inviato o controfirmato lo rimetteva «generato»
//   e sostituiva il file senza dire niente: la copia mandata al fornitore, o
//   quella firmata, e le loro date sparivano dal gestionale;
// - il controfirmato non si poteva caricare: c'era solo «segna controfirmato».
// Ora le due scritture passano dalla funzione salvaContrattoFornitore (solo lei
// vede i riferimenti ai file): senza conferma esplicita un contratto gia' fuori
// non si rigenera, e confermando la versione di prima resta in versioni_json; il
// firmato si carica, diventa il documento del contratto e, se il catalogo della
// qualifica ha una sola voce «contratto» per quel ruolo, anche il documento di
// qualifica del fornitore. Qui la funzione intera (prove/dati/bancoFunzioni.mjs)
// e, sul sorgente, che la pagina passi davvero di li'.
//
// Revisione del 13/10/2026, tre rilievi:
// - il firmato diventato documento di qualifica nasceva «in_attesa» e nessuno ne
//   chiamava la lettura: dopo dieci minuti la qualifica lo dava «da verificare»
//   per un'analisi interrotta mai partita. Ora la pagina la chiama subito, come
//   la scheda del fornitore;
// - la quantita' salvata sul contratto (quantitativo_previsto_t, la legge EcoTyna)
//   era la prima scritta fra TARGET_TON e QUOTA_TON, non quella del Word: ora e'
//   quella del punto che il modello ha (campoDellaQuantita);
// - i file delle versioni sostituite (versioni_json) non comparivano
//   nell'inventario dei file, e un giorno sarebbero sembrati orfani.
// node prove/contrattoFirmato.mjs
import { readFileSync } from 'node:fs';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';
import * as segnaposti from '../src/lib/segnapostiContratto.js';
import * as segnapostiFunzioni from '../base44/shared/segnapostiContratto.ts';
import { ARCHIVI_CON_FILE, voceFile, perFile, csvInventario, contaInventario, AZIONE_PRIVATO } from '../base44/shared/inventarioFile.ts';

// Per nome: senza campoDellaQuantita (il codice di prima) le verifiche falliscono, non la prova.
const { valoriDelContratto, valoriDiPartenza, valoriPerIlDocumento, leggiNumeroItaliano } = segnaposti;
const senzaRegola = () => undefined;
const campoDellaQuantita = segnaposti.campoDellaQuantita || senzaRegola;
const campoDellaQuantitaFunzioni = segnapostiFunzioni.campoDellaQuantita || senzaRegola;

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const oggi = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
const A = Number(oggi.slice(0, 4));

console.log('LA PAGINA PASSA DALLA FUNZIONE');
const pagina = readFileSync(new URL('../src/components/qualifica/ContrattiAnno.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
// L'unica scrittura diretta rimasta e' il passaggio di stato (inviato, controfirmato
// senza file): non tocca file ne' valori.
const passaggio = "ContrattoFornitore.update(riga.contratto_id, { stato: passo.stato, [passo.campo]: g.trim() })";
verifica('la pagina non scrive piu\' da sola un contratto «generato» sull\'archivio',
  pagina.includes(passaggio) && !/ContrattoFornitore\.(create|update)\(/.test(pagina.split(passaggio).join(''))
  && !/stato:\s*'generato'/.test(pagina) && /stato: 'inviato', campo: 'inviato_il'/.test(pagina) && /stato: 'controfirmato', campo: 'controfirmato_il'/.test(pagina));
verifica('la generazione passa da salvaContrattoFornitore, con la conferma per chi e\' gia\' fuori',
  /functions\.invoke\('salvaContrattoFornitore',\s*\{\s*azione: 'genera'/.test(pagina) && /conferma_rigenera/.test(pagina) && /serve_conferma/.test(pagina));
verifica('c\'e\' «carica il controfirmato», col file e la data', /carica il controfirmato/.test(pagina) && /azione: 'controfirmato'/.test(pagina) && /UploadPrivateFile/.test(pagina));
verifica('riaprendo si riparte dai valori del contratto (A68: prima i due rami erano uguali)', /valoriDiPartenza\(riga\)/.test(pagina) && !/\? proposta\.valori : proposta\.valori/.test(pagina));
verifica('il file si apre dalla funzione apriFile, non col riferimento', /linkFile\('ContrattoFornitore'/.test(pagina) && !/file_uri\s*\}\s*=\s*riga/.test(pagina) && !/riga\.contratto\.file_uri/.test(pagina));

console.log('IL FIRMATO DIVENTATO DOCUMENTO DI QUALIFICA SI LEGGE SUBITO');
{
  // Il pezzo della pagina che carica il controfirmato, fino alla fine del file.
  const carica = pagina.slice(pagina.indexOf('function CaricaControfirmato'));
  const dopoSalva = carica.slice(carica.indexOf("azione: 'controfirmato'"));
  // Dal 14/10/2026 i documenti possono essere due (il contratto ACI unico di
  // raccolta e stoccaggio, una voce per ruolo): la pagina li legge tutti.
  verifica('dopo «carica il controfirmato» la pagina chiama analizzaDocumentoQualifica coi documenti appena creati',
    carica.length > 0 && /for \(const documentoId of documenti\) \{\s*await base44\.functions\.invoke\('analizzaDocumentoQualifica',\s*\{\s*documento_id: documentoId/.test(carica)
    && /const daLeggere = documentiDelFirmato\(fatto\)\.map\(d => d\.id\);\s*if \(daLeggere\.length\) leggiDocumenti\(daLeggere\)/.test(dopoSalva));
  // Lo stesso contesto della scheda del fornitore: nome, partita IVA, codice fiscale.
  const dettaglio = readFileSync(new URL('../src/components/qualifica/SoggettoDettaglio.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('con lo stesso contesto della scheda del fornitore (nome, partita IVA, codice fiscale)',
    /invoke\('analizzaDocumentoQualifica', \{ documento_id: documentoId, contesto \}\)/.test(dettaglio)
    && /contesto: \{ nome: soggetto\.nome, piva: soggetto\.piva, codice_fiscale:/.test(carica));
  verifica('e dice se la lettura e\' in corso, fatta o non riuscita', /setLettura\('in_corso'\)/.test(carica) && /setLettura\('fatta'\)/.test(carica) && /lettura automatica non è riuscita/.test(carica));
}

console.log('LA QUANTITA\' SALVATA E\' QUELLA DEL WORD');
for (const [nome, f] of [['pagina', campoDellaQuantita], ['funzioni', campoDellaQuantitaFunzioni]]) {
  verifica(`${nome}: raccolta -> TARGET_TON, gli altri -> QUOTA_TON`, f('raccolta', ['TARGET_TON', 'QUOTA_TON']) === 'TARGET_TON' && f('trattamento', ['TARGET_TON', 'QUOTA_TON']) === 'QUOTA_TON'
    && f('stoccaggio', ['QUOTA_TON']) === 'QUOTA_TON');
  verifica(`${nome}: un modello con l'altro punto usa quello che ha`, f('trattamento', ['TARGET_TON']) === 'TARGET_TON' && f('raccolta', ['QUOTA_TON']) === 'QUOTA_TON');
  verifica(`${nome}: un modello senza quantita' non ne scrive (null)`, f('trasporto_secondaria', ['CORRISPETTIVO_TRASPORTO']) === null);
}
{
  // Il caso del revisore: trattamento T-Cycle, target 1.050 t; il modello chiede
  // solo QUOTA_TON e l'amministratore scrive 1.100. Nel Word c'e' 1.100, e 1.100
  // si salva (prima si salvava il 1.050 rimasto nascosto in TARGET_TON).
  const proposta = valoriDelContratto({ anno: A + 1, tipo: 'trattamento', canale: 'RETE', target: { t: 1050, anno: A }, tariffe: [] });
  const valori = { ...valoriDiPartenza({ proposta }).valori, QUOTA_TON: '1100' };
  const puntiModello = ['FORNITORE_RAGIONE_SOCIALE', 'QUOTA_TON', 'CORRISPETTIVO_PMG1'];
  const nelWord = valoriPerIlDocumento(valori, [{ segnaposto: 'QUOTA_TON', tipo: 'quantita' }]).QUOTA_TON;
  const campo = campoDellaQuantita('trattamento', puntiModello);
  const salvata = campo ? leggiNumeroItaliano(valori[campo]) : null;
  verifica('trattamento: nel Word 1.100 e sul contratto 1.100, non il 1.050 nascosto', nelWord === '1.100' && salvata === 1100, `${nelWord} ${salvata}`);
  verifica('la pagina salva la quantita\' dal punto del modello, non la prima scritta',
    /const campoQuantita = campoDellaQuantita\(riga\.tipo, segnaposti\)/.test(pagina) && /quantitativo_previsto_t: quantita === null \? undefined : quantita/.test(pagina)
    && !pagina.includes('[valori.TARGET_TON, valori.QUOTA_TON].find('));
}

const modulo = await caricaFunzione('salvaContrattoFornitore');
const contratto = (extra) => ({
  id: 'k1', anno: A, soggetto_chiave: 'gatim', soggetto_nome: 'GATIM S.R.L.', tipo_contratto: 'raccolta', canale: 'RETE',
  stato: 'inviato', file_uri: 'privato://generato-1', file_nome: 'Contratto Raccolta 2026 - GATIM.docx', generato_il: `${A}-01-02T09:00:00Z`, inviato_il: `${A}-01-03`,
  valori_json: JSON.stringify({ CORRISPETTIVO_RACCOLTA: 70 }), quantitativo_previsto_t: 300, ...extra,
});
const dati = { anno: A, soggetto_chiave: 'gatim', soggetto_nome: 'GATIM S.R.L.', tipo_contratto: 'raccolta', canale: 'RETE', valori_json: JSON.stringify({ CORRISPETTIVO_RACCOLTA: 72 }), data_inizio: `${A}-01-02`, data_fine: `${A}-12-31` };
const corpoGenera = (extra) => ({ azione: 'genera', contratto_id: 'k1', dati, file_uri: 'privato://generato-2', file_nome: 'nuovo.docx', ...extra });

console.log('SOLO L\'AMMINISTRATORE');
const utente = await chiama(modulo, { db: { ContrattoFornitore: [contratto()] }, ruolo: 'user', corpo: corpoGenera({}) });
verifica('chi non e\' amministratore non genera e non carica', utente.stato === 403 && utente.scritte.length === 0, JSON.stringify(utente.j));
const indirizzo = await chiama(modulo, { db: { ContrattoFornitore: [contratto()] }, corpo: { ...corpoGenera({}), file_uri: undefined, file_url: 'https://altrove.example/x.docx' } });
verifica('un indirizzo al posto del file_uri si rifiuta', indirizzo.stato === 400 && indirizzo.scritte.length === 0, JSON.stringify(indirizzo.j));

console.log('RIGENERARE UN CONTRATTO GIA\' FUORI');
for (const stato of ['inviato', 'controfirmato']) {
  const db = { ContrattoFornitore: [contratto({ stato, controfirmato_il: stato === 'controfirmato' ? `${A}-01-10` : undefined })] };
  const senza = await chiama(modulo, { db, corpo: corpoGenera({}) });
  verifica(`${stato}: senza conferma non si tocca niente (409, serve_conferma)`, senza.stato === 409 && senza.j.serve_conferma === true && senza.scritte.length === 0, JSON.stringify(senza.j));
  const con = await chiama(modulo, { db, corpo: corpoGenera({ conferma_rigenera: true }) });
  const dopo = con.db.ContrattoFornitore[0];
  const versioni = JSON.parse(dopo.versioni_json || '[]');
  verifica(`${stato}: confermando torna generato col file nuovo`, con.stato === 200 && dopo.stato === 'generato' && dopo.file_uri === 'privato://generato-2' && dopo.inviato_il === null, JSON.stringify(dopo));
  verifica(`${stato}: la versione di prima resta, col suo file, stato e date`, versioni.length === 1 && versioni[0].file_uri === 'privato://generato-1' && versioni[0].stato === stato
    && versioni[0].inviato_il === `${A}-01-03` && JSON.parse(versioni[0].valori_json).CORRISPETTIVO_RACCOLTA === 70, JSON.stringify(versioni));
  verifica(`${stato}: la risposta non rimanda il riferimento al file`, !JSON.stringify(con.j).includes('privato://'), JSON.stringify(con.j));
}
const generato = await chiama(modulo, { db: { ContrattoFornitore: [contratto({ stato: 'generato', inviato_il: undefined })] }, corpo: { ...corpoGenera({}), dati: { ...dati, data_inizio: undefined } } });
const g1 = generato.db.ContrattoFornitore[0];
verifica('un contratto solo generato si rigenera senza conferma, e la versione di prima resta lo stesso', generato.stato === 200 && JSON.parse(g1.versioni_json).length === 1, JSON.stringify(generato.j));
verifica('un campo che la pagina non manda si svuota (null), non resta quello di prima ne\' diventa zero', g1.quantitativo_previsto_t === null && g1.data_inizio === null, JSON.stringify(g1));
const doppio = await chiama(modulo, { db: { ContrattoFornitore: [contratto({ stato: 'controfirmato' })] }, corpo: { ...corpoGenera({}), contratto_id: undefined } });
verifica('senza id si ritrova lo stesso contratto (fornitore, tipo, canale, anno) e vale la stessa conferma', doppio.stato === 409 && doppio.scritte.length === 0, JSON.stringify(doppio.j));
const aci = await chiama(modulo, { db: { ContrattoFornitore: [contratto({ stato: 'controfirmato' })] }, corpo: { ...corpoGenera({}), contratto_id: undefined, dati: { ...dati, canale: 'ACI' } } });
verifica('la raccolta ACI e\' un contratto nuovo, non quello di rete', aci.stato === 200 && aci.db.ContrattoFornitore.length === 2 && aci.db.ContrattoFornitore[1].canale === 'ACI' && aci.db.ContrattoFornitore[0].stato === 'controfirmato',
  JSON.stringify(aci.db.ContrattoFornitore.map(c => c.canale + '/' + c.stato)));
const extra = await chiama(modulo, { db: { ContrattoFornitore: [] }, corpo: { ...corpoGenera({}), contratto_id: undefined, dati: { ...dati, canale: 'EXTRA_RACCOLTA' } } });
verifica('l\'extra raccolta non ha contratti annuali', extra.stato === 400 && extra.scritte.length === 0, JSON.stringify(extra.j));

console.log('IL CONTROFIRMATO');
const voce = (id, si_applica_a) => ({ id, nome: `Contratto di ${si_applica_a}`, categoria: 'contratto', si_applica_a, attivo: true, ordine: 1 });
const dbFirma = (catalogo) => ({
  ContrattoFornitore: [contratto(), { id: 'k-aci', anno: A, soggetto_chiave: 'gatim', tipo_contratto: 'raccolta', canale: 'ACI', stato: 'controfirmato', documento_qualifica_id: 'dq-aci' }],
  TipoDocumentoQualifica: catalogo,
  DocumentoQualifica: [
    { id: 'dq-vecchio', soggetto_chiave: 'gatim', tipo_documento_id: 'v-racc', stato: 'attivo', file_uri: 'privato://firmato-2025' },
    { id: 'dq-aci', soggetto_chiave: 'gatim', tipo_documento_id: 'v-racc', stato: 'attivo', file_uri: 'privato://firmato-aci' },
  ],
});
const corpoFirma = (extra) => ({ azione: 'controfirmato', contratto_id: 'k1', file_uri: 'privato://firmato-1', file_nome: 'Contratto firmato.pdf', giorno: oggi, ...extra });
const firma = await chiama(modulo, { db: dbFirma([voce('v-racc', 'raccolta'), voce('v-tratt', 'trattamento')]), corpo: corpoFirma({}) });
const kf = firma.db.ContrattoFornitore.find(c => c.id === 'k1');
const nuovoDoc = firma.db.DocumentoQualifica.find(d => d.file_uri === 'privato://firmato-1');
verifica('il firmato diventa il documento del contratto: controfirmato, con la data', firma.stato === 200 && kf.stato === 'controfirmato' && kf.controfirmato_il === oggi && kf.file_uri === 'privato://firmato-1' && kf.documento_firmato === true, JSON.stringify(kf));
verifica('il documento generato resta fra le versioni', JSON.parse(kf.versioni_json || '[]').some(v => v.file_uri === 'privato://generato-1' && v.stato === 'inviato'), kf.versioni_json);
verifica('con una sola voce «contratto» per la raccolta diventa anche il documento di qualifica', !!nuovoDoc && nuovoDoc.tipo_documento_id === 'v-racc' && nuovoDoc.stato === 'attivo' && kf.documento_qualifica_id === nuovoDoc.id, JSON.stringify(nuovoDoc));
verifica('il documento di prima di quella voce passa fra i sostituiti, non quello del contratto ACI dello stesso anno',
  firma.db.DocumentoQualifica.find(d => d.id === 'dq-vecchio').stato === 'sostituito' && firma.db.DocumentoQualifica.find(d => d.id === 'dq-aci').stato === 'attivo');
const dueVoci = await chiama(modulo, { db: dbFirma([voce('v-racc', 'raccolta'), voce('v-racc2', 'raccolta, trasporto_secondaria')]), corpo: corpoFirma({}) });
verifica('con due voci possibili non se ne sceglie una a caso: il firmato resta sul contratto e si dice', dueVoci.stato === 200 && !dueVoci.j.documento_qualifica_id && /2 voci/.test(dueVoci.j.motivo_senza_qualifica || '')
  && dueVoci.db.DocumentoQualifica.length === 2, JSON.stringify(dueVoci.j));
const nessuna = await chiama(modulo, { db: dbFirma([]), corpo: corpoFirma({}) });
verifica('senza voce nel catalogo il firmato resta sul contratto e si dice', nessuna.stato === 200 && /non c'è una voce/.test(nessuna.j.motivo_senza_qualifica || '') && nessuna.db.ContrattoFornitore.find(c => c.id === 'k1').stato === 'controfirmato');
const futuro = await chiama(modulo, { db: dbFirma([]), corpo: corpoFirma({ giorno: `${A + 1}-01-01` }) });
verifica('una data di firma futura si rifiuta', futuro.stato === 400 && futuro.scritte.length === 0, JSON.stringify(futuro.j));

console.log('IL CONTRATTO IN CORSO RESTA FINO ALLA DECORRENZA DEL NUOVO (revisione del 13/10/2026)');
{
  // Il contratto dell'anno dopo, controfirmato prima che decorra: il documento
  // del contratto in corso, che oggi vale ancora, non passa fra i sostituiti
  // (script del revisore giro2/revisione/G4/sostituito_in_vigore.mjs). Quelli
  // scaduti o senza scadenza, e il firmato di prima dello stesso contratto, si
  // sostituiscono come sempre.
  const { valutaSoggetto, aggiungiPeriodo } = await import('../base44/shared/qualificaFornitori.ts');
  const fraUnMese = aggiungiPeriodo(oggi, 0, 30);
  const ieri = aggiungiPeriodo(oggi, 0, -1);
  const dbAnnoDopo = (extraContratto = {}) => ({
    ContrattoFornitore: [contratto({ anno: A + 1, data_inizio: `${A + 1}-01-02`, data_fine: `${A + 1}-12-31`, ...extraContratto })],
    TipoDocumentoQualifica: [voce('v-racc', 'raccolta')],
    DocumentoQualifica: [
      { id: 'dq-in-corso', soggetto_chiave: 'gatim', tipo_documento_id: 'v-racc', stato: 'attivo', file_uri: 'privato://firmato-in-corso', analisi_stato: 'completata', problemi_json: '[]', data_emissione: `${A}-01-02`, data_scadenza: fraUnMese },
      { id: 'dq-scaduto', soggetto_chiave: 'gatim', tipo_documento_id: 'v-racc', stato: 'attivo', file_uri: 'privato://firmato-scaduto', data_emissione: `${A - 1}-01-02`, data_scadenza: ieri },
      { id: 'dq-senza-data', soggetto_chiave: 'gatim', tipo_documento_id: 'v-racc', stato: 'attivo', file_uri: 'privato://firmato-senza-data' },
      { id: 'dq-corretta-a-mano', soggetto_chiave: 'gatim', tipo_documento_id: 'v-racc', stato: 'attivo', file_uri: 'privato://firmato-corretto', data_scadenza: ieri, data_scadenza_manuale: fraUnMese },
    ],
  });
  const statoDi = (r, id) => (r.db.DocumentoQualifica.find(d => d.id === id) || {}).stato;
  const r = await chiama(modulo, { db: dbAnnoDopo(), corpo: corpoFirma({}) });
  verifica('anno dopo: il controfirmato si salva e diventa documento di qualifica', r.stato === 200 && !!r.j.documento_qualifica_id, JSON.stringify(r.j));
  verifica('il contratto in corso, valido ancora un mese, resta attivo', statoDi(r, 'dq-in-corso') === 'attivo', statoDi(r, 'dq-in-corso'));
  verifica('vale anche la scadenza corretta a mano', statoDi(r, 'dq-corretta-a-mano') === 'attivo', statoDi(r, 'dq-corretta-a-mano'));
  verifica('lo scaduto e quello senza scadenza passano fra i sostituiti, come prima', statoDi(r, 'dq-scaduto') === 'sostituito' && statoDi(r, 'dq-senza-data') === 'sostituito');

  // La catena intera: col nuovo ancora da leggere il fornitore non scende.
  const tipo = voce('v-racc', 'raccolta');
  const v = valutaSoggetto({ chiave: 'gatim', nome: 'GATIM S.R.L.', ruoli: ['raccolta'] }, [{ ...tipo, obbligatorio: true, tipo_scadenza: 'da_documento', preavviso_giorni: 60 }],
    r.db.DocumentoQualifica.map(d => (d.id === r.j.documento_qualifica_id ? { ...d, created_date: new Date().toISOString() } : d)), oggi);
  verifica('col firmato nuovo ancora da leggere il requisito si regge sul contratto in corso: il fornitore non e\' da completare', v.requisiti[0].stato === 'in_scadenza' && v.stato === 'in_scadenza'
    && ['dq-in-corso', 'dq-corretta-a-mano'].includes(v.requisiti[0].documento && v.requisiti[0].documento.id), `${v.requisiti[0].stato} ${v.stato} ${v.requisiti[0].documento && v.requisiti[0].documento.id}`);

  // Senza la data di inizio vale il 1 gennaio dell'anno del contratto.
  const senzaInizio = await chiama(modulo, { db: dbAnnoDopo({ data_inizio: undefined }), corpo: corpoFirma({}) });
  verifica('senza data di inizio decorre il 1 gennaio dell\'anno dopo: il contratto in corso resta', statoDi(senzaInizio, 'dq-in-corso') === 'attivo');
  // Il firmato ricaricato dello stesso contratto prende il posto di quello di prima.
  const ricaricato = await chiama(modulo, { db: dbAnnoDopo({ documento_qualifica_id: 'dq-in-corso' }), corpo: corpoFirma({}) });
  verifica('il firmato di prima dello stesso contratto si sostituisce anche se ancora valido', statoDi(ricaricato, 'dq-in-corso') === 'sostituito');
  // Il contratto dell'anno in corso (gia' decorso): tutto come prima.
  const stessoAnno = await chiama(modulo, { db: dbAnnoDopo({ anno: A, data_inizio: `${A}-01-02` }), corpo: corpoFirma({}) });
  verifica('un contratto gia\' decorso sostituisce anche il documento ancora valido, come prima', statoDi(stessoAnno, 'dq-in-corso') === 'sostituito' && statoDi(stessoAnno, 'dq-corretta-a-mano') === 'sostituito');
}

console.log('IL CONTRATTO ACI UNICO DI RACCOLTA E STOCCAGGIO DIVENTA IL DOCUMENTO DELLE DUE VOCI (14/10/2026)');
{
  // Decisione dell'utente del 13/10/2026: Nappi Sud ha un contratto ACI solo, coi
  // due prezzi. Si registra come raccolta ACI, ma copre anche lo stoccaggio ACI:
  // se il catalogo ha una voce «contratto» per la raccolta e una per lo
  // stoccaggio, il firmato e' il documento di tutte e due (prima solo della
  // raccolta: la voce dello stoccaggio restava scoperta). Lo dice il modello del
  // contratto (eContrattoRaccoltaEStoccaggio).
  const punti = (...s) => JSON.stringify(s.map(segnaposto => ({ segnaposto })));
  const MODELLI = [
    { id: 'mod-rs', tipo_contratto: 'raccolta', canale: 'ACI', stato: 'attivo', punti_json: punti('CORRISPETTIVO_RACCOLTA', 'CORRISPETTIVO_STOCCAGGIO') },
    { id: 'mod-r', tipo_contratto: 'raccolta', canale: 'ACI', stato: 'attivo', punti_json: punti('CORRISPETTIVO_RACCOLTA') },
  ];
  const nappi = (extra) => contratto({ soggetto_chiave: 'nappi sud', soggetto_nome: 'NAPPI SUD SRL', canale: 'ACI', modello_id: 'mod-rs', valori_json: JSON.stringify({ CORRISPETTIVO_RACCOLTA: 92, CORRISPETTIVO_STOCCAGGIO: 16 }), ...extra });
  const dbNappi = (catalogo, extraContratto = {}) => ({
    ContrattoFornitore: [nappi(extraContratto),
      // lo stoccaggio di rete e' un contratto suo, gia' firmato, col suo file
      { id: 'k-stoc', anno: A, soggetto_chiave: 'nappi sud', tipo_contratto: 'stoccaggio', canale: 'RETE', stato: 'controfirmato', documento_firmato: true, file_uri: 'privato://firmato-stoc-rete' }],
    ModelloContratto: MODELLI,
    TipoDocumentoQualifica: catalogo,
    DocumentoQualifica: [
      { id: 'dq-r-vecchio', soggetto_chiave: 'nappi sud', tipo_documento_id: 'v-racc', stato: 'attivo', file_uri: 'privato://raccolta-2025' },
      { id: 'dq-s-vecchio', soggetto_chiave: 'nappi sud', tipo_documento_id: 'v-stoc', stato: 'attivo', file_uri: 'privato://stoccaggio-2025' },
      { id: 'dq-s-rete', soggetto_chiave: 'nappi sud', tipo_documento_id: 'v-stoc', stato: 'attivo', file_uri: 'privato://firmato-stoc-rete' },
    ],
  });
  const statoDi = (r, id) => (r.db.DocumentoQualifica.find(d => d.id === id) || {}).stato;
  const r = await chiama(modulo, { db: dbNappi([voce('v-racc', 'raccolta'), voce('v-stoc', 'stoccaggio')]), corpo: corpoFirma({}) });
  const nuovi = r.db.DocumentoQualifica.filter(d => d.file_uri === 'privato://firmato-1');
  verifica('il firmato diventa il documento della voce della raccolta e di quella dello stoccaggio', r.stato === 200 && nuovi.length === 2
    && JSON.stringify(nuovi.map(d => d.tipo_documento_id).sort()) === JSON.stringify(['v-racc', 'v-stoc']) && nuovi.every(d => d.stato === 'attivo' && d.analisi_stato === 'in_attesa'), JSON.stringify(r.j));
  verifica('la risposta li dice tutti e due, e il contratto tiene il primo', (r.j.documenti_qualifica || []).length === 2 && r.j.documento_qualifica_id === r.j.documenti_qualifica[0].id
    && r.db.ContrattoFornitore.find(c => c.id === 'k1').documento_qualifica_id === r.j.documento_qualifica_id && !r.j.motivo_senza_qualifica, JSON.stringify(r.j));
  verifica('i documenti di prima delle due voci passano fra i sostituiti', statoDi(r, 'dq-r-vecchio') === 'sostituito' && statoDi(r, 'dq-s-vecchio') === 'sostituito');
  verifica('non quello del contratto di stoccaggio di rete dello stesso anno, riconosciuto dal suo file', statoDi(r, 'dq-s-rete') === 'attivo');
  verifica('la nota del documento dice raccolta e stoccaggio', nuovi.every(d => /^Contratto raccolta e stoccaggio ACI /.test(d.note)), JSON.stringify(nuovi.map(d => d.note)));
  const soloRaccolta = await chiama(modulo, { db: dbNappi([voce('v-racc', 'raccolta'), voce('v-stoc', 'stoccaggio')], { modello_id: 'mod-r' }), corpo: corpoFirma({}) });
  verifica('col modello di sola raccolta il firmato resta il documento della sola raccolta, come prima', soloRaccolta.stato === 200
    && soloRaccolta.db.DocumentoQualifica.filter(d => d.file_uri === 'privato://firmato-1').map(d => d.tipo_documento_id).join() === 'v-racc' && statoDi(soloRaccolta, 'dq-s-vecchio') === 'attivo');
  const unaVoce = await chiama(modulo, { db: dbNappi([voce('v-racc', 'raccolta')]), corpo: corpoFirma({}) });
  verifica('senza la voce dello stoccaggio: il documento della raccolta, e la frase per lo stoccaggio', unaVoce.stato === 200 && (unaVoce.j.documenti_qualifica || []).length === 1
    && /^Per lo stoccaggio: nel catalogo della qualifica non c'è una voce «contratto» per questo ruolo/.test(unaVoce.j.motivo_senza_qualifica || ''), JSON.stringify(unaVoce.j));
  const comune = await chiama(modulo, { db: dbNappi([voce('v-unica', 'raccolta, stoccaggio')]), corpo: corpoFirma({}) });
  verifica('una voce sola per i due ruoli: un documento solo', comune.stato === 200 && comune.db.DocumentoQualifica.filter(d => d.file_uri === 'privato://firmato-1').length === 1 && !comune.j.motivo_senza_qualifica, JSON.stringify(comune.j));
  const senzaModello = await chiama(modulo, { db: dbNappi([voce('v-racc', 'raccolta'), voce('v-stoc', 'stoccaggio')], { modello_id: undefined }), corpo: corpoFirma({}) });
  verifica('senza il modello decidono i valori salvati, coi due prezzi', (senzaModello.j.documenti_qualifica || []).length === 2, JSON.stringify(senzaModello.j));
  verifica('la risposta non rimanda nessun riferimento ai file', !JSON.stringify(r.j).includes('privato://'));
}

console.log('LE VERSIONI SOSTITUITE NELL\'INVENTARIO DEI FILE');
{
  // Il giro vero: un contratto generato, rigenerato, poi caricato firmato. Tre
  // file: il firmato (del contratto e della qualifica) e due versioni sostituite.
  const defContratto = ARCHIVI_CON_FILE.find(a => a.entita === 'ContrattoFornitore');
  const defQualifica = ARCHIVI_CON_FILE.find(a => a.entita === 'DocumentoQualifica');
  const rig = await chiama(modulo, { db: { ContrattoFornitore: [contratto({ stato: 'generato', inviato_il: undefined })] }, corpo: corpoGenera({}) });
  const fir = await chiama(modulo, { db: { ContrattoFornitore: rig.db.ContrattoFornitore, TipoDocumentoQualifica: [voce('v-racc', 'raccolta')], DocumentoQualifica: [] }, corpo: corpoFirma({}) });
  const k = fir.db.ContrattoFornitore.find(c => c.id === 'k1');
  const dq = fir.db.DocumentoQualifica.find(d => d.id === k.documento_qualifica_id);
  const voci = [voceFile(defContratto, k), voceFile(defQualifica, dq)];
  const file = perFile(voci);
  const di = (rif) => file.find(v => v.riferimento === rif);
  verifica('le due versioni sostituite sono file dell\'inventario', !!di('privato://generato-1') && !!di('privato://generato-2'), JSON.stringify(file.map(v => v.riferimento)));
  verifica('in uso, da NON rimuovere, private', ['privato://generato-1', 'privato://generato-2'].every(r => di(r) && di(r).in_uso === true && di(r).azione === AZIONE_PRIVATO && di(r).genere === 'privato'),
    JSON.stringify(file));
  verifica('dicono di chi sono e che cosa erano', /GATIM S\.R\.L\..*raccolta RETE.*versione sostituita/.test(di('privato://generato-1')?.descrizione || ''), di('privato://generato-1')?.descrizione);
  verifica('il firmato e\' un file solo, usato dal contratto e dalla qualifica', di('privato://firmato-1')?.record === 2, JSON.stringify(di('privato://firmato-1')));
  const csv = csvInventario(voci);
  verifica('nel CSV per l\'assistenza ogni versione ha la sua riga con «NON RIMUOVERE»',
    csv.split('\n').filter(r => /privato:\/\/generato-[12]/.test(r) && r.includes('NON RIMUOVERE')).length === 2, csv);
  const conta = contaInventario(voci);
  verifica('i conti: 3 file, 2 record, niente da far rimuovere', conta.file === 3 && conta.record === 2 && conta.orfani === 0 && conta.da_far_rimuovere === 0, JSON.stringify(conta));
  verifica('un contratto senza versioni resta una voce sola, come prima', !('altri_file' in voceFile(defContratto, contratto())), JSON.stringify(voceFile(defContratto, contratto())));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
