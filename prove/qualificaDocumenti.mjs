// LA VALIDITA' DI UN DOCUMENTO DELLA QUALIFICA (statoRequisito in
// base44/shared/qualificaFornitori.ts e la maschera «Correggi» di
// src/components/qualifica/SoggettoDettaglio.jsx), segnalazioni alte A65 e A64
// del 20/09, corrette il 12/10/2026.
//
// A65: la spunta «verificato a mano» non e' una scadenza. Un documento che scade,
// confermato senza scrivere la data, risultava «valido» per sempre e la maschera
// lo salvava: ora resta «da verificare», col motivo, e la maschera non lo salva.
// A64: la scadenza letta dal modello non vale a scatola chiusa. Emissione nel
// futuro, scadenza che non viene dopo l'emissione e durata oltre la misura
// scritta mettono il documento «da verificare», col motivo; la conferma o la
// data scritte a mano li chiudono. npm run prove
import { build } from 'esbuild';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as Q from '../base44/shared/qualificaFornitori.ts';

// Il modulo si prende intero: cosi' col codice di prima la prova arriva in fondo
// e dice quali regole mancano, invece di fermarsi all'import.
const { statoRequisito, valutaSoggetto, eventiDaSegnalare } = Q;
const assente = () => { throw new Error('non esiste'); };
const dateIncongruenti = Q.dateIncongruenti || assente;
const durataScritta = Q.durataScritta || assente;
const MARGINE_DURATA = Q.MARGINE_DURATA;
const prova = (f) => { try { return f(); } catch (e) { return e; } };

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const OGGI = '2026-10-12';
const polizza = { id: 't1', nome: 'Polizza di responsabilità civile', obbligatorio: true, tipo_scadenza: 'da_documento', preavviso_giorni: 30, si_applica_a: 'raccolta' };
const rentri = { id: 't2', nome: 'Iscrizione RENTRI', obbligatorio: true, tipo_scadenza: 'nessuna', si_applica_a: 'raccolta' };
const albo = { id: 't3', nome: 'Iscrizione Albo Nazionale Gestori Ambientali', obbligatorio: true, tipo_scadenza: 'da_documento', preavviso_giorni: 90, si_applica_a: 'raccolta' };
const whiteList = { id: 't4', nome: 'Iscrizione White List antimafia', obbligatorio: true, tipo_scadenza: 'da_documento', preavviso_giorni: 60, si_applica_a: 'raccolta' };
const whiteListCatalogo = { ...whiteList, id: 't5', validita_mesi: 12 };
const patenti = { id: 't6', nome: 'Patenti di guida degli autisti', obbligatorio: false, tipo_scadenza: 'da_documento', preavviso_giorni: 60, si_applica_a: 'raccolta' };
const durc = { id: 't7', nome: 'DURC', obbligatorio: true, tipo_scadenza: 'da_emissione', validita_giorni: 120, preavviso_giorni: 20, si_applica_a: 'raccolta' };
const doc = (campi) => ({ id: 'd1', soggetto_chiave: 'alfa', tipo_documento_id: 't1', stato: 'attivo', analisi_stato: 'completata', problemi_json: '[]', ...campi });
const messaggi = (s) => (s.problemi || []).map(p => p.messaggio).join(' | ');

console.log('A65 - LA SPUNTA SENZA DATA');
{
  const s = statoRequisito(polizza, doc({ verificato_manualmente: true, data_scadenza: null, data_scadenza_manuale: null }), OGGI);
  verifica('una polizza verificata a mano senza scadenza resta da verificare', s.stato === 'da_verificare', s.stato);
  verifica('e dice perche\', e che cosa fare', /verificato a mano, ma senza data di scadenza/.test(messaggi(s)) && /Correggi/.test(messaggi(s)), messaggi(s));
  const senzaSpunta = statoRequisito(polizza, doc({ verificato_manualmente: false }), OGGI);
  verifica('senza spunta e senza data: da verificare, come prima', senzaSpunta.stato === 'da_verificare' && !/verificato a mano/.test(messaggi(senzaSpunta)), senzaSpunta.stato);
  const conErrore = statoRequisito(polizza, doc({ verificato_manualmente: true, analisi_stato: 'errore', errore_analisi: 'file protetto' }), OGGI);
  verifica('anche con la lettura fallita la spunta senza data non basta', conErrore.stato === 'da_verificare', conErrore.stato);
  const conData = statoRequisito(polizza, doc({ verificato_manualmente: true, data_scadenza_manuale: '2027-06-30' }), OGGI);
  verifica('con la spunta e la data scritta a mano e\' valido', conData.stato === 'valido' && conData.scadenza === '2027-06-30', conData.stato);
  const nonScade = statoRequisito(rentri, doc({ tipo_documento_id: 't2', verificato_manualmente: true }), OGGI);
  verifica('un documento che non scade, verificato a mano, resta valido senza data', nonScade.stato === 'valido', nonScade.stato);
  const nonScadeLetto = statoRequisito(rentri, doc({ tipo_documento_id: 't2' }), OGGI);
  verifica('un documento che non scade e senza problemi e\' valido anche senza spunta', nonScadeLetto.stato === 'valido', nonScadeLetto.stato);

  const alfa = { chiave: 'alfa', nome: 'ALFA SRL', ruoli: ['raccolta'] };
  const v = valutaSoggetto(alfa, [polizza], [doc({ verificato_manualmente: true })], OGGI);
  verifica('il fornitore non risulta qualificato per una spunta senza data', v.stato === 'da_completare' && v.obbligatori_validi === 0, v.stato + ' ' + v.obbligatori_validi);
  const eventi = eventiDaSegnalare([v]);
  verifica('e il promemoria lo porta, col motivo', eventi.some(e => e.chiave === 'verifica|d1' && (e.problemi || []).some(p => /senza data di scadenza/.test(p.messaggio))), JSON.stringify(eventi));
}

console.log('A65 - LA MASCHERA «CORREGGI»');
{
  const CLIENT_FINTO = 'export const base44 = { functions: { invoke: async () => ({ data: {} }) }, entities: {}, integrations: { Core: {} } };';
  const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
  const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(existsSync) || base; };
  let motivo = null;
  // le librerie dell'interfaccia guardano window quando si caricano, come nelle altre prove delle pagine
  globalThis.window = globalThis.window || { self: 1, top: 1 };
  try {
    const pacchetto = await build({
      stdin: { contents: `export { motivoCorrezioneNonSalvabile } from ${JSON.stringify(qui('../src/components/qualifica/SoggettoDettaglio.jsx'))};`, resolveDir: qui('.'), loader: 'js' },
      bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
      loader: { '.jsx': 'jsx', '.js': 'jsx' },
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'finti', setup(b) {
        b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'client-finto' }));
        b.onLoad({ filter: /.*/, namespace: 'client-finto' }, () => ({ contents: CLIENT_FINTO, loader: 'js' }));
        b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) }));
      } }],
    });
    ({ motivoCorrezioneNonSalvabile: motivo } = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64')));
  } catch (e) { verifica('la scheda del fornitore si impacchetta e si carica', false, String(e && e.message).slice(0, 300)); }
  if (typeof motivo !== 'function') verifica('la scheda espone la regola della maschera (motivoCorrezioneNonSalvabile)', false);
  else {
    const scade = { tipo_scadenza: 'da_documento' };
    const m = motivo(scade, { scadenza: '', verificato: true });
    verifica('spunta senza data su un documento che scade: non si salva, e lo dice', typeof m === 'string' && /scrivi la data di scadenza/.test(m), String(m));
    verifica('spunta con la data: si salva', motivo(scade, { scadenza: '2027-01-31', verificato: true }) === null);
    verifica('senza spunta e senza data: si salva (si toglie una conferma)', motivo(scade, { scadenza: '', verificato: false }) === null);
    verifica('documento che non scade: la spunta basta', motivo({ tipo_scadenza: 'nessuna' }, { scadenza: '', verificato: true }) === null);
    verifica('documento da emissione senza data: non si salva', typeof motivo({ tipo_scadenza: 'da_emissione' }, { scadenza: null, verificato: true }) === 'string');
  }
  const src = readFileSync(qui('../src/components/qualifica/SoggettoDettaglio.jsx'), 'utf8').replace(/\r/g, '');
  verifica('il pulsante Salva si spegne e la maschera dice perche\'', /disabled=\{!!nonSalvabile\}/.test(src) && /\{nonSalvabile && <p[^>]*>\{nonSalvabile\}<\/p>\}/.test(src));
  const corpo = src.slice(src.indexOf('const salvaCorrezione'), src.indexOf('const obbligatori'));
  const rifiuto = corpo.indexOf('motivoCorrezioneNonSalvabile(');
  const scrittura = corpo.indexOf('DocumentoQualifica.update(');
  verifica('anche il salvataggio rifiuta la spunta senza data, prima di scrivere', rifiuto > 0 && scrittura > rifiuto && /if \(motivo\) \{[\s\S]*?return false;/.test(corpo));
  verifica('la maschera resta aperta se la correzione non e\' salvata', /if \(await onSalvaCorrezione\(doc, \{ scadenza, verificato, note \}, req\)\) setCorreggi\(false\)/.test(src));
}

console.log('A64 - LE DATE LETTE CHE NON STANNO IN PIEDI');
{
  // ECO.GEA, provvedimento di rinnovo del 30/04/2026, valido dal 31/07/2026 al
  // 31/07/2031: un rinnovo anticipato decorre dalla scadenza precedente.
  const vero = statoRequisito(albo, doc({ tipo_documento_id: 't3', data_emissione: '2026-04-30', data_scadenza: '2031-07-31' }), OGGI);
  verifica('l\'iscrizione all\'Albo vera (cinque anni e tre mesi dal provvedimento) e\' valida', vero.stato === 'valido' && vero.problemi.length === 0, vero.stato + ' ' + messaggi(vero));
  const annoSbagliato = statoRequisito(albo, doc({ tipo_documento_id: 't3', data_emissione: '2026-04-30', data_scadenza: '2036-07-31' }), OGGI);
  verifica('un anno letto male (dieci anni per un\'iscrizione di cinque) e\' da verificare', annoSbagliato.stato === 'da_verificare', annoSbagliato.stato);
  verifica('col motivo, la misura e le date all\'italiana', /troppo lontana/.test(messaggi(annoSbagliato)) && /cinque anni/.test(messaggi(annoSbagliato)) && /31\/07\/2036/.test(messaggi(annoSbagliato)) && /30\/04\/2026/.test(messaggi(annoSbagliato)), messaggi(annoSbagliato));

  const wl = statoRequisito(whiteList, doc({ tipo_documento_id: 't4', data_emissione: '2026-03-15', data_scadenza: '2027-03-15' }), OGGI);
  verifica('la White List di dodici mesi e\' valida', wl.stato === 'valido', wl.stato + ' ' + messaggi(wl));
  const wlLunga = statoRequisito(whiteList, doc({ tipo_documento_id: 't4', data_emissione: '2026-03-15', data_scadenza: '2028-03-15' }), OGGI);
  verifica('una White List di due anni e\' da verificare', wlLunga.stato === 'da_verificare' && /dodici mesi/.test(messaggi(wlLunga)), wlLunga.stato + ' ' + messaggi(wlLunga));
  const wlCatalogo = statoRequisito({ ...whiteListCatalogo, nome: 'Elenco prefettura' }, doc({ tipo_documento_id: 't5', data_emissione: '2026-03-15', data_scadenza: '2028-03-15' }), OGGI);
  verifica('la durata scritta nel catalogo vale anche se il nome non si riconosce', wlCatalogo.stato === 'da_verificare' && /il catalogo gli dà 12 mesi di validità/.test(messaggi(wlCatalogo)), wlCatalogo.stato + ' ' + messaggi(wlCatalogo));
  verifica('il margine e\' un quarto della durata', MARGINE_DURATA === 0.25 && prova(() => durataScritta(albo).mesi === 60 && durataScritta(whiteList).mesi === 12 && durataScritta(patenti) === null) === true);

  const patente = statoRequisito(patenti, doc({ tipo_documento_id: 't6', data_emissione: '2020-01-10', data_scadenza: '2035-01-10' }), OGGI);
  verifica('senza una misura scritta (patente) la durata non si giudica', patente.stato === 'valido', patente.stato + ' ' + messaggi(patente));

  const prima = statoRequisito(polizza, doc({ data_emissione: '2026-09-01', data_scadenza: '2026-08-31' }), OGGI);
  verifica('scadenza prima dell\'emissione, gia\' passata: resta scaduto, col motivo accanto', prima.stato === 'scaduto' && /non viene dopo la data di emissione/.test(messaggi(prima)), prima.stato + ' ' + messaggi(prima));
  const uguali = statoRequisito(polizza, doc({ data_emissione: '2026-05-10', data_scadenza: '2026-05-10' }), OGGI);
  verifica('la stessa data letta come emissione e scadenza si segnala', uguali.stato === 'scaduto' && /non viene dopo/.test(messaggi(uguali)), uguali.stato);
  const futuraValida = statoRequisito(polizza, doc({ data_emissione: '2027-11-01', data_scadenza: '2027-10-31' }), OGGI);
  verifica('scadenza prima dell\'emissione, tutte e due nel futuro: da verificare, non valido', futuraValida.stato === 'da_verificare' && /nel futuro/.test(messaggi(futuraValida)) && /non viene dopo/.test(messaggi(futuraValida)), futuraValida.stato + ' ' + messaggi(futuraValida));
  const emissioneFutura = statoRequisito(polizza, doc({ data_emissione: '2026-12-01', data_scadenza: '2027-12-01' }), OGGI);
  verifica('un\'emissione nel futuro e\' da verificare', emissioneFutura.stato === 'da_verificare' && /01\/12\/2026, è nel futuro/.test(messaggi(emissioneFutura)), emissioneFutura.stato + ' ' + messaggi(emissioneFutura));
  const inScadenza = statoRequisito(polizza, doc({ data_emissione: '2026-11-20', data_scadenza: '2026-10-30' }), OGGI);
  verifica('date incongruenti a due settimane dalla scadenza: da verificare, non «in scadenza»', inScadenza.stato === 'da_verificare', inScadenza.stato);
  const durcSano = statoRequisito(durc, doc({ tipo_documento_id: 't7', data_emissione: '2026-08-01', data_scadenza: '2026-11-29' }), OGGI);
  verifica('un DURC di 120 giorni non si tocca', durcSano.stato === 'valido' && durcSano.problemi.length === 0, durcSano.stato + ' ' + messaggi(durcSano));
  const senzaEmissione = statoRequisito(polizza, doc({ data_scadenza: '2027-05-01' }), OGGI);
  verifica('senza data di emissione non si inventa un dubbio', senzaEmissione.stato === 'valido' && senzaEmissione.problemi.length === 0, senzaEmissione.stato);

  const confermato = statoRequisito(albo, doc({ tipo_documento_id: 't3', verificato_manualmente: true, data_emissione: '2026-04-30', data_scadenza: '2036-07-31' }), OGGI);
  verifica('la conferma dell\'amministratore chiude il dubbio', confermato.stato === 'valido' && confermato.problemi.length === 0, confermato.stato + ' ' + messaggi(confermato));
  const corretto = statoRequisito(albo, doc({ tipo_documento_id: 't3', data_emissione: '2026-04-30', data_scadenza: '2036-07-31', data_scadenza_manuale: '2031-07-31' }), OGGI);
  verifica('anche la scadenza scritta a mano', corretto.stato === 'valido' && corretto.scadenza === '2031-07-31', corretto.stato + ' ' + messaggi(corretto));
  const giaScritto = prova(() => dateIncongruenti(albo, '2026-04-30', '2036-07-31', OGGI)[0]) || {};
  const doppio = statoRequisito(albo, doc({ tipo_documento_id: 't3', data_emissione: '2026-04-30', data_scadenza: '2036-07-31', problemi_json: JSON.stringify([giaScritto]) }), OGGI);
  verifica('il motivo non si sdoppia se e\' gia\' fra i problemi salvati', doppio.problemi.filter(p => /troppo lontana/.test(p.messaggio)).length === 1);

  const alfa = { chiave: 'alfa', nome: 'ALFA SRL', ruoli: ['raccolta'] };
  const v = valutaSoggetto(alfa, [albo], [doc({ tipo_documento_id: 't3', data_emissione: '2026-04-30', data_scadenza: '2036-07-31' })], OGGI);
  verifica('il fornitore con l\'Albo da verificare non e\' qualificato', v.stato === 'da_completare', v.stato);
  verifica('e il promemoria porta il motivo', eventiDaSegnalare([v]).some(e => e.stato === 'da_verificare' && (e.problemi || []).some(p => /troppo lontana/.test(p.messaggio))));
}

console.log('IL CONTRATTO FIRMATO PRIMA DELLA DECORRENZA (revisione del 13/10/2026)');
{
  // Il contratto 2027 generato dalla scheda Contratti porta come data della
  // firma la decorrenza (segnapostiContratto.ts, DATA_FIRMA = DATA_INIZIO) e si
  // controfirma a dicembre: la lettura prende quella data come emissione. Non e'
  // letta male, e il fornitore resta qualificato.
  const { valoriDelContratto } = await import('../base44/shared/segnapostiContratto.ts');
  const v = valoriDelContratto({ anno: 2027, tipo: 'raccolta', canale: 'RETE' }).valori;
  const iso = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? String(d) : String(d).split('/').reverse().join('-');
  const DICEMBRE = '2026-12-15';
  const contratto = { id: 'tc', nome: 'Contratto con SMOCO', categoria: 'contratto', obbligatorio: true, tipo_scadenza: 'da_documento', preavviso_giorni: 60, si_applica_a: 'raccolta' };
  const c2027 = (campi = {}) => doc({ id: 'c27', tipo_documento_id: 'tc', data_emissione: iso(v.DATA_FIRMA), data_scadenza: iso(v.DATA_FINE), ...campi });
  verifica('il contratto generato ha la firma nel futuro rispetto a dicembre', iso(v.DATA_FIRMA) > DICEMBRE, String(v.DATA_FIRMA));
  const s = statoRequisito(contratto, c2027(), DICEMBRE);
  verifica('il contratto dell\'anno dopo, firmato a dicembre, e\' valido', s.stato === 'valido', s.stato + ' ' + messaggi(s));
  verifica('nessun «letta male» sull\'emissione', !/nel futuro/.test(messaggi(s)), messaggi(s));
  // Da solo statoRequisito non sa se accanto c'e' un contratto in vigore: la
  // nota dice solo da quando vale (revisione del 13/10/2026); chi lo sa lo dice.
  verifica('una nota dice da quando vale, senza promettere un contratto in corso che non conosce', s.problemi.some(p => p.gravita === 'informativo' && /firmato prima della decorrenza/.test(p.messaggio) && /02\/01\/2027/.test(p.messaggio)) && !/contratto in corso/.test(messaggi(s)), messaggi(s));
  const sConCorso = statoRequisito(contratto, c2027(), DICEMBRE, { contrattoInCorso: true });
  verifica('con un contratto in vigore accanto la nota dice che fino ad allora vale quello', sConCorso.stato === 'valido' && /Fino ad allora resta in vigore il contratto in corso/.test(messaggi(sConCorso)), messaggi(sConCorso));
  verifica('il controllo delle date non trova niente sul contratto', prova(() => dateIncongruenti(contratto, '2027-01-02', '2027-12-31', DICEMBRE).length) === 0);

  // Il 2026 e' passato fra i sostituiti caricando il firmato: resta il 2027.
  const alfa = { chiave: 'alfa', nome: 'ALFA SRL', ruoli: ['raccolta'] };
  const c2026 = doc({ id: 'c26', tipo_documento_id: 'tc', stato: 'sostituito', data_emissione: '2026-01-02', data_scadenza: '2026-12-31' });
  const vs = valutaSoggetto(alfa, [contratto], [c2026, c2027()], DICEMBRE);
  verifica('il fornitore resta qualificato', vs.stato === 'qualificato' && vs.obbligatori_validi === 1, vs.stato);
  verifica('e non parte nessun promemoria «da verificare»', !eventiDaSegnalare([vs]).some(e => e.stato === 'da_verificare'), JSON.stringify(eventiDaSegnalare([vs])));

  // L'ACI di Gatim dal 2 marzo, firmato a febbraio: stesso anno, stessa regola.
  const aci = statoRequisito(contratto, doc({ tipo_documento_id: 'tc', data_emissione: '2026-03-02', data_scadenza: '2026-12-31' }), '2026-02-20');
  verifica('un contratto che decorre piu\' avanti nello stesso anno e\' valido', aci.stato === 'valido', aci.stato + ' ' + messaggi(aci));
  // La famiglia si riconosce anche dal solo nome, e dalla sola categoria.
  const daNome = statoRequisito({ ...contratto, categoria: 'altro', nome: 'Contratto con Ecotyre' }, c2027(), DICEMBRE);
  verifica('il contratto riconosciuto dal nome', daNome.stato === 'valido', daNome.stato);
  const daCategoria = statoRequisito({ ...contratto, nome: 'Incarico di raccolta PFU' }, c2027(), DICEMBRE);
  verifica('il contratto riconosciuto dalla categoria', daCategoria.stato === 'valido', daCategoria.stato);

  // Oltre l'anno dopo non e' un contratto firmato in anticipo: e' un anno letto male.
  const lontano = statoRequisito(contratto, c2027({ data_emissione: '2028-01-02', data_scadenza: '2028-12-31' }), DICEMBRE);
  verifica('un contratto che decorre fra due anni resta da verificare', lontano.stato === 'da_verificare' && /nel futuro/.test(messaggi(lontano)), lontano.stato + ' ' + messaggi(lontano));
  const rovescio = statoRequisito(contratto, c2027({ data_scadenza: '2026-12-31' }), DICEMBRE);
  verifica('scadenza prima della decorrenza: da verificare, come per ogni documento', rovescio.stato === 'da_verificare' && /non viene dopo/.test(messaggi(rovescio)), rovescio.stato + ' ' + messaggi(rovescio));
  const polizzaFutura = statoRequisito(polizza, doc({ data_emissione: '2027-01-02', data_scadenza: '2027-12-31' }), DICEMBRE);
  verifica('per gli altri documenti l\'emissione nel futuro resta da verificare', polizzaFutura.stato === 'da_verificare' && /nel futuro/.test(messaggi(polizzaFutura)), polizzaFutura.stato);
  const src = readFileSync(qui('../base44/shared/analisiDocumento.ts'), 'utf8').replace(/\r/g, '');
  verifica('chi valuta il file sa che un contratto si firma prima della decorrenza', /\.\.\.\(eContratto\(tipo\) \? \[FIRMA_ANTICIPATA\] : \[\]\)/.test(src) && /FIRMA_ANTICIPATA = '[^\n]*prima che decorra[^\n]*non e\\' un problema/.test(src));
}

console.log('LA NOTA DELLA DECORRENZA NON PRENDE IL POSTO DEL MOTIVO (revisione del 13/10/2026)');
{
  // Lo script del revisore (giro2/revisione/G4/nota_prima_del_motivo.mjs): la
  // nota stava in testa ai problemi di ogni stato, e la pagina e il promemoria,
  // che mostrano il primo problema, dicevano la nota invece del motivo vero.
  const contratto = { id: 'tc', nome: 'Contratto con SMOCO', categoria: 'contratto', obbligatorio: true, tipo_scadenza: 'da_documento', preavviso_giorni: 60 };
  const DICEMBRE = '2026-12-15';
  // la stessa scelta del motivo di dettaglioAlert (src/pages/QualificaFornitori.jsx) e di emailQualifica.motivo
  const motivoInPagina = (r) => { const p = r.problemi || []; const m = p.find(x => x.gravita === 'bloccante') || p[0]; return m ? m.messaggio : (r.stato === 'da_verificare' ? 'Scadenza non determinata: verifica il documento' : ''); };
  const c27 = (campi) => doc({ id: 'c27', tipo_documento_id: 'tc', data_emissione: '2027-01-02', data_scadenza: '2027-12-31', ...campi });
  const nota = (s) => (s.problemi || []).filter(p => /firmato prima della decorrenza/.test(p.messaggio));

  const errore = statoRequisito(contratto, c27({ analisi_stato: 'errore', errore_analisi: 'Limite di richieste raggiunto' }), DICEMBRE);
  verifica('rilettura in errore: da verificare, e il motivo in pagina e\' l\'errore della lettura', errore.stato === 'da_verificare' && /^La lettura automatica del file non ha funzionato: Limite di richieste raggiunto/.test(motivoInPagina(errore)), errore.stato + ' «' + motivoInPagina(errore) + '»');
  verifica('rilettura in errore: la nota non c\'e\'', nota(errore).length === 0, messaggi(errore));
  // E il promemoria via email: il motivo e' la lettura fallita, non la nota.
  const { motivo: motivoEmail } = await import('../base44/shared/emailQualifica.ts');
  const vErr = valutaSoggetto({ chiave: 'alfa', nome: 'ALFA SRL', ruoli: ['raccolta'] }, [{ ...contratto, si_applica_a: 'raccolta' }], [c27({ analisi_stato: 'errore', errore_analisi: 'Limite di richieste raggiunto' })], DICEMBRE);
  const eErr = eventiDaSegnalare([vErr]).find(e => e.stato === 'da_verificare') || {};
  verifica('nel promemoria il motivo e\' la lettura fallita', /^La lettura automatica del file non ha funzionato/.test(motivoEmail(eErr)) && !/firmato prima della decorrenza/.test(motivoEmail(eErr)), motivoEmail(eErr));
  const scadenzaNonLetta = statoRequisito(contratto, c27({ data_scadenza: null }), DICEMBRE);
  verifica('scadenza non letta: in pagina «Scadenza non determinata», non la nota', scadenzaNonLetta.stato === 'da_verificare' && motivoInPagina(scadenzaNonLetta) === 'Scadenza non determinata: verifica il documento', '«' + motivoInPagina(scadenzaNonLetta) + '»');
  const inLettura = statoRequisito(contratto, c27({ analisi_stato: 'in_corso', analisi_avviata_il: new Date().toISOString() }), DICEMBRE);
  verifica('in analisi: niente nota', inLettura.stato === 'in_analisi' && nota(inLettura).length === 0, messaggi(inLettura));
  const valido = statoRequisito(contratto, c27({ problemi_json: JSON.stringify([{ gravita: 'attenzione', messaggio: 'Manca la firma sulla seconda pagina.' }]) }), DICEMBRE);
  verifica('valido: la nota c\'e\', in fondo, dopo i problemi del documento', valido.stato === 'valido' && nota(valido).length === 1 && valido.problemi[valido.problemi.length - 1] === nota(valido)[0] && valido.problemi[0].messaggio === 'Manca la firma sulla seconda pagina.', messaggi(valido));
  const inScad = statoRequisito(contratto, doc({ tipo_documento_id: 'tc', data_emissione: '2026-11-20', data_scadenza: '2026-12-31', problemi_json: JSON.stringify([{ gravita: 'attenzione', messaggio: 'Timbro poco leggibile.' }]) }), '2026-11-10');
  verifica('in scadenza: la nota c\'e\', in fondo', inScad.stato === 'in_scadenza' && nota(inScad).length === 1 && inScad.problemi[0].messaggio === 'Timbro poco leggibile.' && /20\/11\/2026/.test(inScad.problemi[inScad.problemi.length - 1].messaggio), messaggi(inScad));

  // Il fornitore nuovo: il primo contratto decorre a meta' anno e un contratto in
  // corso non c'e'. La nota dice solo da quando vale.
  const nuovo = { chiave: 'nuovo', nome: 'NUOVO SRL', ruoli: ['raccolta'] };
  const conRuolo = { ...contratto, si_applica_a: 'raccolta' };
  const primo = doc({ id: 'p1', soggetto_chiave: 'nuovo', tipo_documento_id: 'tc', data_emissione: '2026-07-01', data_scadenza: '2026-12-31' });
  const vNuovo = valutaSoggetto(nuovo, [conRuolo], [primo], '2026-06-20');
  const rNuovo = vNuovo.requisiti[0];
  verifica('fornitore nuovo: la nota dice da quando vale e non nomina un contratto in corso', rNuovo.stato === 'valido' && nota(rNuovo).length === 1 && /01\/07\/2026/.test(nota(rNuovo)[0].messaggio) && !/contratto in corso/.test(messaggi(rNuovo)), messaggi(rNuovo));
}

console.log('IL CONTRATTO IN CORSO VALE FINO ALLA DECORRENZA DEL NUOVO (revisione del 13/10/2026)');
{
  // Lo script del revisore (giro2/revisione/G4/sostituito_in_vigore.mjs): il
  // 15/12/2026 il 2027 controfirmato mandava il 2026 fra i sostituiti e, finche'
  // il nuovo non era letto bene, il fornitore scendeva «da completare» o
  // «critico». Ora il 2026 resta attivo fino alla decorrenza
  // (salvaContrattoFornitore) e il requisito si regge sul migliore.
  const contratto = { id: 'tc', nome: 'Contratto con SMOCO', categoria: 'contratto', obbligatorio: true, tipo_scadenza: 'da_documento', preavviso_giorni: 60, si_applica_a: 'raccolta' };
  const DICEMBRE = '2026-12-15';
  const alfa = { chiave: 'alfa', nome: 'ALFA SRL', ruoli: ['raccolta'] };
  const vecchio = doc({ id: 'c26', tipo_documento_id: 'tc', file_nome: 'Contratto 2026.pdf', data_emissione: '2026-01-02', data_scadenza: '2026-12-31' });
  const nuovo = (campi) => doc({ id: 'c27', tipo_documento_id: 'tc', file_nome: 'Contratto 2027 firmato.pdf', data_emissione: '2026-12-15', ...campi });
  const casi = {
    'lettura appena lanciata': { analisi_stato: 'in_attesa', created_date: new Date().toISOString() },
    'lettura fallita (429)': { analisi_stato: 'errore', errore_analisi: 'Limite di richieste raggiunto' },
    'bloccante del modello': { data_emissione: '2027-01-02', data_scadenza: '2027-12-31', problemi_json: JSON.stringify([{ gravita: 'bloccante', messaggio: 'Il contratto non e\' ancora in vigore.' }]) },
  };
  const conDocumento = (r) => r.documento && r.documento.id;
  // col codice di prima i superati non esistevano: nessuno da chiudere
  const superatiDi = (r) => r.superati || [];
  for (const [nome, campi] of Object.entries(casi)) {
    const v = valutaSoggetto(alfa, [contratto], [vecchio, nuovo(campi)], DICEMBRE);
    const r = v.requisiti[0];
    verifica(`${nome}: il requisito si regge sul 2026 in vigore e il fornitore resta in scadenza, non da completare ne' critico`, r.stato === 'in_scadenza' && conDocumento(r) === 'c26' && v.stato === 'in_scadenza', `${r.stato} ${conDocumento(r)} ${v.stato}`);
    verifica(`${nome}: il contratto nuovo non sparisce, una nota dice com'e'`, r.problemi.some(p => /caricato dopo questo, «Contratto 2027 firmato\.pdf»/.test(p.messaggio)), messaggi(r));
    verifica(`${nome}: niente promemoria «da verificare» ne' «non conforme», e niente da chiudere`, !eventiDaSegnalare([v]).some(e => e.stato === 'da_verificare' || e.stato === 'non_conforme') && superatiDi(r).length === 0, JSON.stringify(eventiDaSegnalare([v])));
  }
  const bloccante = valutaSoggetto(alfa, [contratto], [vecchio, nuovo(casi['bloccante del modello'])], DICEMBRE).requisiti[0];
  verifica('il motivo del contratto nuovo non conforme si legge nella nota', bloccante.problemi.some(p => p.gravita === 'attenzione' && /è non conforme \(Il contratto non e' ancora in vigore\)/.test(p.messaggio)), messaggi(bloccante));

  // Letto bene, il 2027 e' il documento del requisito: valido, con la nota che
  // dice che fino al 02/01/2027 vale il contratto in corso.
  const letto = valutaSoggetto(alfa, [contratto], [vecchio, nuovo({ data_emissione: '2027-01-02', data_scadenza: '2027-12-31' })], DICEMBRE);
  const rl = letto.requisiti[0];
  verifica('letto bene: il requisito e\' sul 2027, valido, e il fornitore qualificato', rl.stato === 'valido' && conDocumento(rl) === 'c27' && letto.stato === 'qualificato', `${rl.stato} ${conDocumento(rl)} ${letto.stato}`);
  verifica('e la nota dice che fino alla decorrenza resta in vigore il contratto in corso', /02\/01\/2027.*Fino ad allora resta in vigore il contratto in corso/.test(messaggi(rl)), messaggi(rl));
  verifica('il 2026, ancora valido, non si chiude prima del tempo', superatiDi(rl).length === 0);

  // Il 1 gennaio il 2026 e' scaduto accanto al 2027 valido: nessun alert, nessun
  // promemoria, e va fra i superati (li chiude la qualifica, sotto sul banco).
  const capodanno = valutaSoggetto(alfa, [contratto], [vecchio, nuovo({ data_emissione: '2027-01-02', data_scadenza: '2027-12-31' })], '2027-01-01');
  const rc = capodanno.requisiti[0];
  verifica('il 2026 scaduto accanto al 2027 valido: requisito valido sul 2027, fornitore qualificato', rc.stato === 'valido' && conDocumento(rc) === 'c27' && capodanno.stato === 'qualificato', `${rc.stato} ${conDocumento(rc)} ${capodanno.stato}`);
  verifica('nessun promemoria per il 2026 scaduto', eventiDaSegnalare([capodanno]).length === 0, JSON.stringify(eventiDaSegnalare([capodanno])));
  verifica('il 2026 scaduto e\' fra i superati', superatiDi(rc).join() === 'c26', JSON.stringify(superatiDi(rc)));
  // Scaduto il vecchio e il nuovo ancora da leggere: niente da chiudere (non c'e'
  // un contratto in vigore), e il requisito e' quello di sempre, il piu' recente.
  const senzaValido = valutaSoggetto(alfa, [contratto], [vecchio, nuovo(casi['lettura appena lanciata'])], '2027-01-01').requisiti[0];
  verifica('vecchio scaduto e nuovo in analisi: requisito sul nuovo, niente da chiudere', senzaValido.stato === 'in_analisi' && conDocumento(senzaValido) === 'c27' && superatiDi(senzaValido).length === 0, `${senzaValido.stato} ${conDocumento(senzaValido)}`);
  // Un contratto nuovo letto male (scaduto prima di cominciare) accanto al
  // vecchio valido non si chiude: resta li', con la nota.
  const lettoMale = valutaSoggetto(alfa, [contratto], [vecchio, nuovo({ data_emissione: '2026-12-15', data_scadenza: '2026-12-01' })], DICEMBRE).requisiti[0];
  verifica('il nuovo letto male (gia\' scaduto) non e\' fra i superati: e\' piu\' recente del contratto scelto', conDocumento(lettoMale) === 'c26' && superatiDi(lettoMale).length === 0 && /è scaduto/.test(messaggi(lettoMale)), `${conDocumento(lettoMale)} ${JSON.stringify(superatiDi(lettoMale))} ${messaggi(lettoMale)}`);
  // Rete e ACI dello stesso anno, validi tutti e due: restano attivi tutti e due.
  const aci = doc({ id: 'c26aci', tipo_documento_id: 'tc', data_emissione: '2026-03-02', data_scadenza: '2026-12-31' });
  const dueVeri = valutaSoggetto(alfa, [contratto], [vecchio, aci], '2026-10-13').requisiti[0];
  verifica('rete e ACI dello stesso anno: il piu\' recente, valido, e nessuno da chiudere', dueVeri.stato === 'valido' && conDocumento(dueVeri) === 'c26aci' && superatiDi(dueVeri).length === 0, `${dueVeri.stato} ${conDocumento(dueVeri)}`);
  // Gli altri documenti restano col piu' recente, come sempre.
  const durcNuovo = doc({ id: 'durc2', tipo_documento_id: 't7', analisi_stato: 'in_attesa', created_date: new Date().toISOString(), data_emissione: '2026-10-12' });
  const durcVecchio = doc({ id: 'durc1', tipo_documento_id: 't7', data_emissione: '2026-08-01', data_scadenza: '2026-11-29' });
  const dv = valutaSoggetto(alfa, [durc], [durcVecchio, durcNuovo], '2026-10-13').requisiti[0];
  verifica('per un DURC vale il piu\' recente, come prima', conDocumento(dv) === 'durc2' && dv.stato === 'in_analisi' && superatiDi(dv).length === 0, `${conDocumento(dv)} ${dv.stato}`);
}

console.log('IL REN NON DURA COME L\'ALBO GESTORI (revisione del 13/10/2026)');
{
  const ren = { id: 't8', nome: "Iscrizione all'Albo autotrasportatori conto terzi (REN)", categoria: 'altro', obbligatorio: false, tipo_scadenza: 'nessuna', si_applica_a: 'raccolta' };
  verifica('il REN non ha la durata dei cinque anni dell\'Albo gestori', prova(() => durataScritta(ren)) === null && prova(() => durataScritta(albo).mesi) === 60, JSON.stringify(prova(() => durataScritta(ren))));
  const s = statoRequisito(ren, doc({ tipo_documento_id: 't8', data_emissione: '2019-05-10', data_scadenza: '2029-05-10' }), OGGI);
  verifica('un REN con date lontane non e\' «troppo lontano» per la misura dell\'Albo', s.stato === 'valido' && !/cinque anni/.test(messaggi(s)), s.stato + ' ' + messaggi(s));
}

console.log('LA FUNZIONE VERA (qualificaFornitori sul banco)');
{
  // Il conto che la pagina, il menu e la dashboard leggono: la spunta senza data
  // conta fra i «da verificare», e la classe non letta resta un avviso che non
  // sposta lo stato del documento dell'Albo.
  const { caricaFunzione, chiama } = await import('./dati/bancoFunzioni.mjs');
  const modulo = await caricaFunzione('qualificaFornitori');
  const anno = Number(OGGI.slice(0, 4));
  const db = {
    TipoDocumentoQualifica: [polizza, albo],
    DocumentoQualifica: [
      doc({ id: 'pol', tipo_documento_id: 't1', tipo_documento_nome: polizza.nome, verificato_manualmente: true, data_scadenza: null }),
      doc({ id: 'alb', tipo_documento_id: 't3', tipo_documento_nome: albo.nome, data_emissione: '2025-01-21', data_scadenza: '2030-01-21',
        analisi_json: JSON.stringify({ lettura: { leggibile: true, tipo_documento: 'Provvedimento di iscrizione Albo Nazionale Gestori Ambientali', categorie_albo: ['Categoria 4'] } }) }),
    ],
    TargetRaccoglitore: [{ id: 'tr', anno, raccoglitore: 'ALFA SRL', target_tonnellate: 2300 }],
    TargetMensile: [],
    RiepilogoQualifica: [],
  };
  const r = await chiama(modulo, { db, ruolo: 'admin', corpo: { anno, soggetti: [{ chiave: 'alfa', nome: 'ALFA SRL', ruoli: ['raccolta'] }], esclusi: [] } });
  const reqs = (r.j.soggetti && r.j.soggetti[0] && r.j.soggetti[0].requisiti) || [];
  const pol = reqs.find(x => x.tipo_id === 't1') || {};
  const alb = reqs.find(x => x.tipo_id === 't3') || {};
  verifica('la funzione risponde', r.stato === 200, JSON.stringify(r.j).slice(0, 300));
  verifica('la polizza confermata senza data e\' da verificare, col motivo', pol.stato === 'da_verificare' && (pol.problemi || []).some(p => /senza data di scadenza/.test(p.messaggio)), pol.stato);
  verifica('l\'Albo resta valido e porta «controllo classe/target non eseguito»', alb.stato === 'valido' && (alb.problemi || []).some(p => /^Controllo classe\/target non eseguito/.test(p.messaggio)), alb.stato + ' ' + JSON.stringify(alb.problemi));
  const salvato = (r.db.RiepilogoQualifica || [])[0] || {};
  verifica('il riepilogo salvato conta un da verificare e un alert', salvato.da_verificare === 1 && salvato.alert_aperti === 1 && r.j.riepilogo.qualificati === 0, JSON.stringify(salvato));

  // Il contratto dell'anno dopo, controfirmato in anticipo, col vecchio fra i
  // sostituiti: il conto salvato non sale e il fornitore e' qualificato
  // (revisione del 13/10/2026). La funzione usa la data vera di oggi.
  const dopo = Number(Q.oggiRoma().slice(0, 4)) + 1;
  const contratto = { id: 'tc', nome: 'Contratto con SMOCO', categoria: 'contratto', obbligatorio: true, tipo_scadenza: 'da_documento', preavviso_giorni: 60, si_applica_a: 'raccolta' };
  const dbC = {
    TipoDocumentoQualifica: [contratto],
    DocumentoQualifica: [
      doc({ id: 'c-vecchio', tipo_documento_id: 'tc', tipo_documento_nome: contratto.nome, stato: 'sostituito', data_emissione: `${dopo - 1}-01-02`, data_scadenza: `${dopo - 1}-12-31` }),
      doc({ id: 'c-nuovo', tipo_documento_id: 'tc', tipo_documento_nome: contratto.nome, data_emissione: `${dopo}-01-02`, data_scadenza: `${dopo}-12-31` }),
    ],
    TargetRaccoglitore: [], TargetMensile: [], RiepilogoQualifica: [],
  };
  const rc = await chiama(modulo, { db: dbC, ruolo: 'admin', corpo: { anno, soggetti: [{ chiave: 'alfa', nome: 'ALFA SRL', ruoli: ['raccolta'] }], esclusi: [] } });
  const sc = (rc.j.soggetti && rc.j.soggetti[0]) || {};
  const reqC = (sc.requisiti || [])[0] || {};
  verifica('sul banco il contratto nuovo e\' il documento del requisito, valido', reqC.documento && reqC.documento.id === 'c-nuovo' && reqC.stato === 'valido', JSON.stringify({ stato: reqC.stato, doc: reqC.documento && reqC.documento.id, problemi: reqC.problemi }));
  const salvatoC = (rc.db.RiepilogoQualifica || [])[0] || {};
  verifica('il fornitore e\' qualificato e il riepilogo non conta niente da verificare', sc.stato === 'qualificato' && salvatoC.da_verificare === 0 && salvatoC.alert_aperti === 0 && rc.j.riepilogo.qualificati === 1, JSON.stringify({ stato: sc.stato, salvatoC }));

  // IL PASSO DELLA DECORRENZA (revisione del 13/10/2026). Il contratto vecchio
  // resta attivo fino alla decorrenza del nuovo; quando scade accanto al nuovo
  // valido la qualifica lo chiude da sola: nessun alert intanto, e il presidio
  // non lo fa piu' rileggere (daAnalizzare guarda i documenti attivi).
  const { daAnalizzare } = await import('../base44/shared/analisiDocumento.ts');
  const oggiVero = Q.oggiRoma();
  const ieri = Q.aggiungiPeriodo(oggiVero, 0, -1);
  const domani = Q.aggiungiPeriodo(oggiVero, 0, 1);
  const lettoTempoFa = JSON.stringify({ lettura: { leggibile: true, tipo_documento: 'Contratto di raccolta' }, analizzato_il: `${dopo - 2}-01-10T09:00:00Z` });
  const vecchioScaduto = doc({ id: 'c-scaduto', tipo_documento_id: 'tc', tipo_documento_nome: contratto.nome, file_uri: 'privato://c-scaduto', analisi_json: lettoTempoFa, data_emissione: `${dopo - 2}-01-02`, data_scadenza: ieri });
  const nuovoValido = doc({ id: 'c-valido', tipo_documento_id: 'tc', tipo_documento_nome: contratto.nome, file_uri: 'privato://c-valido', data_emissione: domani, data_scadenza: `${dopo}-12-31` });
  const tipiC = [contratto];
  verifica('prima del calcolo il presidio rileggerebbe il contratto scaduto', daAnalizzare([vecchioScaduto], tipiC, { adessoMs: Date.now(), massimo: 0 }).some(x => x.id === 'c-scaduto'));
  const dbD = { TipoDocumentoQualifica: tipiC, DocumentoQualifica: [vecchioScaduto, nuovoValido], TargetRaccoglitore: [], TargetMensile: [], RiepilogoQualifica: [] };
  const rd = await chiama(modulo, { db: dbD, ruolo: 'admin', corpo: { anno, soggetti: [{ chiave: 'alfa', nome: 'ALFA SRL', ruoli: ['raccolta'] }], esclusi: [] } });
  const sd = (rd.j.soggetti && rd.j.soggetti[0]) || {};
  const salvatoD = (rd.db.RiepilogoQualifica || [])[0] || {};
  verifica('sul banco: il contratto scaduto accanto al nuovo valido non porta alert, il fornitore e\' qualificato', sd.stato === 'qualificato' && salvatoD.alert_aperti === 0 && salvatoD.da_verificare === 0 && salvatoD.scaduti === 0, JSON.stringify({ stato: sd.stato, salvatoD }));
  const dopoD = (id) => (rd.db.DocumentoQualifica || []).find(d => d.id === id) || {};
  verifica('il contratto scaduto passa fra i sostituiti, il nuovo resta attivo', dopoD('c-scaduto').stato === 'sostituito' && dopoD('c-valido').stato === 'attivo', JSON.stringify(rd.db.DocumentoQualifica.map(d => d.id + '/' + d.stato)));
  verifica('una scrittura sola, sul documento chiuso', rd.scritte.filter(s => s.entita === 'DocumentoQualifica').length === 1 && rd.scritte.some(s => s.entita === 'DocumentoQualifica' && s.op === 'update' && s.id === 'c-scaduto' && s.dati.stato === 'sostituito'), JSON.stringify(rd.scritte));
  verifica('e il presidio non lo fa piu\' rileggere', !daAnalizzare((rd.db.DocumentoQualifica || []).filter(d => d.stato === 'attivo'), tipiC, { adessoMs: Date.now(), massimo: 0 }).some(x => x.id === 'c-scaduto'));
  // Il contratto in corso, ancora valido, non si chiude.
  const inCorso = { ...vecchioScaduto, id: 'c-in-corso', data_scadenza: Q.aggiungiPeriodo(oggiVero, 0, 30) };
  const re = await chiama(modulo, { db: { ...dbD, DocumentoQualifica: [inCorso, nuovoValido], RiepilogoQualifica: [] }, ruolo: 'admin', corpo: { anno, soggetti: [{ chiave: 'alfa', nome: 'ALFA SRL', ruoli: ['raccolta'] }], esclusi: [] } });
  verifica('il contratto in corso, ancora valido, resta attivo', ((re.db.DocumentoQualifica || []).find(d => d.id === 'c-in-corso') || {}).stato === 'attivo' && !re.scritte.some(s => s.entita === 'DocumentoQualifica'), JSON.stringify(re.scritte));
}

console.log('A64 - LA LETTURA SALVA LA DATA COM\'E\'');
{
  const src = readFileSync(qui('../base44/shared/analisiDocumento.ts'), 'utf8').replace(/\r/g, '');
  verifica('l\'analisi rimanda ai controlli di statoRequisito', /controlli \(A64, 12\/10\/2026\) stanno in statoRequisito/.test(src));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
