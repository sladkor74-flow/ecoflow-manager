// LA COPIA DI SICUREZZA DI TUTTI GLI ARCHIVI (14/10/2026).
//
// Migliorie approvate dall'utente il 14/10/2026 («per me ok ... su quanto da
// creare, procedi pure»): una copia di tutti gli archivi, scaricata
// dall'amministratore da Caricamento Dati, con un registro delle copie fatte e il
// promemoria in «Da gestire» dopo sette giorni. Qui, tutto su archivi costruiti
// (la parte sui dati veri sta in prove/copiaSicurezzaDatiVeri.mjs, che gira solo
// sul PC):
//  1. l'elenco degli archivi della copia e' quello di base44/entities, nessuno escluso;
//  2. il registro CopiaSicurezza: chi lo legge e scrive, i campi, niente dati;
//  3. la lettura di un archivio grande: pagine da 5000 in ordine di id, doppioni
//     tolti, una pagina corta ma tonda che non chiude la lettura;
//  4. il ritmo: mai piu' di 40 richieste in un minuto, e «Annulla» anche mentre aspetta;
//  5. la copia intera su un SDK finto: il file compresso, riaperto e letto come
//     si legge la copia dei dati veri, con gli stessi archivi, il meta, gli
//     attesi, il registro, e nessun dato che va su un server;
//  6. quello che ferma la copia (non amministratore, caricamento in corso o
//     entrato durante la lettura, annullata) e quello che non la ferma ma lo dice
//     (un archivio non letto, il registro non scritto, gli attesi mancanti):
//     a video per nome e nel registro (revisione del 15/10/2026);
//  7. il promemoria a 0, 6, 7, 8 e 14 giorni, mai fatta, non letta, non amministratore;
//  8. la pagina vera: il pulsante all'amministratore e a nessun altro, la
//     sezione che dice a che cosa serve, il giro del pulsante e il doppio clic,
//     e una copia a cui manca qualcosa che a video non esce come buona.
// La cartella temporanea delle pagine si toglie alla fine (revisione del
// 15/10/2026: ne restava una a ogni giro).
// node prove/copiaSicurezza.mjs
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolveObjectURL } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { caricaPagina, clienteFinto, aspetta, trova, testo, elementi } from './dati/paginaFinta.mjs';
import { vociPromemoriaCopia, giornoDellaCopia, GIORNI_COPIA, LINK_COPIA, AREA_COPIA } from '../base44/shared/promemoriaCopia.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
// Una sezione che si ferma a meta' e' una prova fallita, non un crollo che
// nasconde le altre.
const sezione = async (titolo, fn) => {
  console.log(titolo);
  try { await fn(); } catch (e) { ko++; console.log('  FALLITA: la sezione si e\' fermata: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e)); }
};
const J = (x) => JSON.stringify(x);
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
// I file si leggono senza i ritorni a capo di Windows.
const sorgente = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');
const jsonc = (t) => JSON.parse(t.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n'));

const L = (await caricaPagina('lib/copiaSicurezza')).modulo;

// ─── un archivio finto che ordina come la piattaforma ───
const ordina = (righe, sort) => {
  const campo = String(sort || 'id').replace(/^[-+]/, '');
  const giu = String(sort || '').startsWith('-');
  return [...righe].sort((a, b) => {
    const x = a[campo], y = b[campo];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return giu ? -c : c;
  });
};
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v));
/**
 * Il client finto della copia: legge da db, ordina e pagina come la
 * piattaforma (al massimo `tetto` righe per pagina), registra ogni richiesta
 * con l'ora dell'orologio finto. guasti: { Archivio: errore } per gli archivi
 * che non rispondono; dopoLetture: (n, db) => {} per cambiare il registro
 * subito dopo aver servito l'n-esima lettura (list o filter, contate insieme).
 */
function clienteCopia({ db, orologio, ruolo = 'admin', funzioni = {}, guasti = {}, tetto = 5000, dopoLetture = null, creaRotto = false }) {
  const richieste = [];
  let letture = 0;
  const servita = (righe) => { letture++; if (dopoLetture) dopoLetture(letture, db); return righe; };
  const entita = (nome) => ({
    list: async (sort, quanti = 5000, salta = 0) => {
      richieste.push({ tipo: 'lettura', nome, metodo: 'list', sort, quanti, salta, il: orologio.adesso() });
      if (guasti[nome]) { servita(null); throw guasti[nome]; }
      return servita(ordina(db[nome] || [], sort).slice(salta, salta + Math.min(quanti, tetto)).map(r => ({ ...r })));
    },
    filter: async (f, sort, quanti = 5000, salta = 0) => {
      richieste.push({ tipo: 'lettura', nome, metodo: 'filter', filtro: f, sort, quanti, salta, il: orologio.adesso() });
      return servita(ordina((db[nome] || []).filter(r => soddisfa(r, f)), sort).slice(salta, salta + Math.min(quanti, tetto)).map(r => ({ ...r })));
    },
    create: async (r) => {
      richieste.push({ tipo: 'scrittura', nome, metodo: 'create', dati: r, il: orologio.adesso() });
      if (creaRotto) { const e = new Error('Request failed with status code 500'); e.response = { status: 500, data: { error: 'archivio non raggiungibile' } }; throw e; }
      return { id: 'copia-nuova', created_date: '2026-10-14T08:05:00.000000', ...r };
    },
    update: async () => { richieste.push({ tipo: 'scrittura', nome, metodo: 'update' }); return {}; },
    delete: async () => { richieste.push({ tipo: 'scrittura', nome, metodo: 'delete' }); return {}; },
  });
  const client = {
    entities: new Proxy({}, { get: (_t, n) => (typeof n === 'string' ? entita(n) : undefined) }),
    functions: {
      invoke: async (nome, corpo) => {
        richieste.push({ tipo: 'funzione', nome, corpo: J(corpo), il: orologio.adesso() });
        const f = funzioni[nome];
        if (!f) return { data: {} };
        try { return { data: await f(corpo) }; } catch (e) { const err = new Error('Request failed with status code 500'); err.response = { status: 500, data: { error: e.message } }; throw err; }
      },
    },
    auth: { me: async () => ({ role: ruolo, full_name: 'Mario Rossi', email: 'mario@smoco.it' }) },
  };
  return { client, richieste };
}
/** Un orologio finto: il tempo passa solo con le pause della copia. */
const orologioFinto = (iso) => {
  let ms = Date.parse(iso);
  return { adesso: () => ms, pausa: async (x) => { ms += x; }, avanza: (x) => { ms += x; } };
};
/** Il massimo di richieste in un minuto qualunque, con il loro peso. */
const massimoAlMinuto = (stampi) => {
  const t = [...stampi].sort((a, b) => a - b);
  let mx = 0;
  for (let i = 0, j = 0; i < t.length; i++) { while (t[i] - t[j] >= 60000) j++; mx = Math.max(mx, i - j + 1); }
  return mx;
};
/** Il file riaperto come si apre la copia dei dati veri delle prove: gunzip e JSON. */
const riapri = async (blob) => JSON.parse(gunzipSync(Buffer.from(await blob.arrayBuffer())).toString('utf8'));

// ─── gli archivi costruiti ───
const NOMI_ENTITA = readdirSync(qui('../base44/entities/')).filter(n => n.endsWith('.jsonc')).map(n => jsonc(sorgente(`base44/entities/${n}`)).name);
const riga = (nome, i, altro = {}) => ({ id: `${nome}-${String(i).padStart(6, '0')}`, created_date: '2026-10-01T08:00:00.000000', updated_date: '2026-10-01T08:00:00.000000', ...altro });
// Il registro dei caricamenti: dal piu' recente. Riuscito ieri.
const REGISTRO = [
  riga('UploadLog', 2, { tipo_file: 'primarie', esito: 'successo', modalita: 'sostituzione', nome_file: 'primarie.xlsx', utente: 'Mario Rossi', created_date: '2026-10-13T07:00:00.000000', updated_date: '2026-10-13T07:05:00.000000', messaggio: 'moduli collegati aggiornati' }),
  riga('UploadLog', 1, { tipo_file: 'secondarie', esito: 'successo', modalita: 'sostituzione', nome_file: 'secondarie.xlsx', created_date: '2026-10-12T07:00:00.000000', updated_date: '2026-10-12T07:01:00.000000' }),
];
const costruisci = () => {
  const db = {};
  NOMI_ENTITA.forEach((nome, k) => { db[nome] = Array.from({ length: (k % 4) + 1 }, (_, i) => riga(nome, i, { campo: `${nome} ${i}`, file_uri: nome === 'DocumentoQualifica' ? `privato/${i}.pdf` : undefined })); });
  // Un archivio grande: 12.345 righe, e la piattaforma che ne ripete 30.
  const grandi = Array.from({ length: 12345 }, (_, i) => riga('PrimariaRete', i, { id_ordine: `ORD${i % 9000}`, peso_effettivo: i }));
  db.PrimariaRete = [...grandi, ...grandi.slice(4990, 5020).map(r => ({ ...r }))];
  // Una pagina piena e basta: la lettura chiede la seguente, vuota.
  db.DichiarazioneTrattamento = Array.from({ length: 5000 }, (_, i) => riga('DichiarazioneTrattamento', i));
  db.UploadLog = REGISTRO.map(r => ({ ...r }));
  db.CopiaSicurezza = [riga('CopiaSicurezza', 1, { giorno: '2026-10-06', il: '2026-10-06T07:00:00.000Z', utente: 'Mario Rossi', archivi: 70, righe: 100, kb: 10 })];
  return db;
};
const senzaDoppioni = (righe) => { const v = new Set(); return righe.filter(r => (v.has(r.id) ? false : (v.add(r.id), true))); };
const perId = (righe) => J(ordina(righe, 'id'));
const RISPOSTE = {
  riepilogoDichiarazioni: async (c) => ({ anno: c.anno, totali: { conferito_t: 1234.5 }, siti: [] }),
  calcolaGiacenze: async (c) => ({ anno: c.anno, righe: [{ sito: 'IRIGOM S.R.L.', giacenza_portale_t: 12.34 }] }),
};

await sezione('1. L\'ELENCO DEGLI ARCHIVI E\' QUELLO DI base44/entities, NESSUNO ESCLUSO', async () => {
  const elenco = L.ARCHIVI_DELLA_COPIA;
  const mancano = NOMI_ENTITA.filter(n => !elenco.includes(n));
  const inPiu = elenco.filter(n => !NOMI_ENTITA.includes(n));
  verifica('ogni archivio di base44/entities e\' nella copia', mancano.length === 0, 'mancano in ARCHIVI_DELLA_COPIA (src/lib/copiaSicurezza.js): ' + mancano.join(', '));
  verifica('e nella copia non c\'e\' un archivio che non esiste', inPiu.length === 0, inPiu.join(', '));
  verifica('una volta sola ciascuno', new Set(elenco).size === elenco.length);
  verifica('ci sono gli archivi riservati all\'amministratore e il registro delle copie', ['Tariffa', 'SurplusTariffa', 'ContrattoFornitore', 'DocumentoQualifica', 'ModificaDato', 'User', 'CopiaSicurezza'].every(n => elenco.includes(n)));
});

await sezione('2. IL REGISTRO CopiaSicurezza: SOLO L\'AMMINISTRATORE, I CONTEGGI E MAI I DATI', async () => {
  const testoE = sorgente('base44/entities/CopiaSicurezza.jsonc');
  const E = jsonc(testoE);
  const r = E.rls || {};
  const solo = (x, ruolo) => !!x && !!x.user_condition && x.user_condition.role === ruolo && Object.keys(x).length === 1;
  verifica('crea e legge solo l\'amministratore', solo(r.create, 'admin') && solo(r.read, 'admin'), J(r));
  verifica('modificarla e cancellarla non e\' di nessuno', ['update', 'delete'].every(k => r[k] && r[k].user_condition && !['admin', 'user'].includes(r[k].user_condition.role)), J(r));
  verifica('il file dice perche\', con la data e la prova', /14\/10\/2026/.test(testoE) && /prove\/copiaSicurezza\.mjs/.test(testoE));
  const meta = { giorno: '2026-10-14', letto_dal: '2026-10-14T08:00:00.000Z', letto_fino_al: '2026-10-14T08:02:00.000Z', chi: 'Mario Rossi', archivi_letti: 71, righe_totali: 32145, non_letti: [], righe: { PrimariaRete: 10487 } };
  const rr = L.rigaDelRegistro(meta, { nomeFile: L.nomeFileCopia('2026-10-14'), kb: 3734 });
  const tipi = { string: 'string', number: 'number' };
  const nonDichiarati = Object.keys(rr).filter(k => !E.properties[k] || E.properties[k].type !== tipi[typeof rr[k]]);
  verifica('ogni campo che la copia scrive e\' dichiarato, col suo tipo', nonDichiarati.length === 0, nonDichiarati.join(', '));
  verifica('i campi obbligatori ci sono', (E.required || []).every(k => rr[k]), J(E.required));
  verifica('nessun elenco e nessun dato: solo conteggi', Object.values(rr).every(v => typeof v !== 'object') && J(rr).length < 1000, J(rr));
  verifica('le righe per archivio come JSON di conteggi', J(JSON.parse(rr.righe_json)) === J(meta.righe));
  // Che cosa manca, per nome: prima una copia senza Giacenze aveva la riga di
  // una copia completa (revisione del 15/10/2026).
  verifica('una copia completa: niente archivi non letti e niente attesi mancanti', rr.archivi_non_letti === '' && rr.attesi_mancanti === '', J(rr));
  const monca = L.rigaDelRegistro({ ...meta, non_letti: [{ archivio: 'Omologa', motivo: 'x', stato: 500 }, { archivio: 'Tariffa', motivo: 'y', stato: 500 }], attesi_mancanti: ['calcolaGiacenze_2026'] }, { nomeFile: 'x', kb: 1 });
  verifica('una copia monca: quali archivi e quali attesi, per nome', monca.non_letti === 2 && monca.archivi_non_letti === 'Omologa, Tariffa' && monca.attesi_mancanti === 'calcolaGiacenze_2026', J(monca));
  verifica('i due campi sono dichiarati, stringhe vuote di partenza', ['archivi_non_letti', 'attesi_mancanti'].every(k => E.properties[k] && E.properties[k].type === 'string' && E.properties[k].default === ''));
});

await sezione('3. UN ARCHIVIO GRANDE: PAGINE DA 5000 IN ORDINE DI ID, DOPPIONI TOLTI', async () => {
  const db = costruisci();
  const o = orologioFinto('2026-10-14T08:00:00Z');
  const { client, richieste } = clienteCopia({ db, orologio: o });
  const r = await L.leggiArchivio(client.entities.PrimariaRete);
  const unici = senzaDoppioni(db.PrimariaRete);
  verifica('tutte le 12.345 righe, una volta sola', r.righe.length === 12345 && new Set(r.righe.map(x => x.id)).size === 12345, String(r.righe.length));
  verifica('i 30 doppioni tolti e contati', r.doppioni === 30, String(r.doppioni));
  verifica('le righe sono quelle dell\'archivio', perId(r.righe) === perId(unici));
  const pagine = richieste.filter(x => x.nome === 'PrimariaRete');
  verifica('pagine da 5000, in ordine di id, una dopo l\'altra', pagine.length === 3 && pagine.every(x => x.sort === 'id' && x.quanti === 5000) && J(pagine.map(x => x.salta)) === J([0, 5000, 10000]), J(pagine.map(x => [x.sort, x.quanti, x.salta])));
  const piena = await L.leggiArchivio(client.entities.DichiarazioneTrattamento);
  verifica('una pagina piena chiede la seguente', piena.righe.length === 5000 && piena.pagine === 2, String(piena.pagine));
  // La piattaforma che restituisce mille righe per pagina: una pagina corta ma
  // tonda non chiude la lettura.
  const mille = clienteCopia({ db: { X: Array.from({ length: 2500 }, (_, i) => riga('X', i)) }, orologio: o, tetto: 1000 });
  const m = await L.leggiArchivio(mille.client.entities.X);
  verifica('con pagine da mille si legge tutto (1000, 1000, 500)', m.righe.length === 2500 && m.pagine === 3, `${m.righe.length} in ${m.pagine}`);
  // Un archivio che non finisce mai non si copia a meta' senza dirlo.
  const infinito = { list: async (_s, q) => Array.from({ length: q }, (_, i) => ({ id: `z${Math.random()}${i}` })) };
  let fermo = null;
  try { await L.leggiArchivio(infinito); } catch (e) { fermo = e; }
  verifica('oltre cento pagine si ferma e lo dice', fermo && fermo.codice === 'troppo_grande', String(fermo && fermo.message));
});

await sezione('4. IL RITMO: MAI PIU\' DI 40 RICHIESTE IN UN MINUTO', async () => {
  const o = orologioFinto('2026-10-14T08:00:00Z');
  const ritmo = L.creaRitmo({ adesso: o.adesso, pausa: o.pausa });
  const stampi = [];
  for (let i = 0; i < 100; i++) { await ritmo.attendi(1); stampi.push(o.adesso()); }
  await ritmo.attendi(15); for (let i = 0; i < 15; i++) stampi.push(o.adesso());
  await ritmo.attendi(18); for (let i = 0; i < 18; i++) stampi.push(o.adesso());
  verifica('in nessun minuto piu\' di 40', massimoAlMinuto(stampi) <= 40, String(massimoAlMinuto(stampi)));
  verifica('e non aspetta piu\' del necessario (133 richieste in poco piu\' di tre minuti)', o.adesso() - Date.parse('2026-10-14T08:00:00Z') <= 4 * 60000, String(o.adesso() - Date.parse('2026-10-14T08:00:00Z')));
  verifica('le prime quaranta partono subito', stampi.slice(0, 40).every(t => t === stampi[0]));
  const segnale = { annullata: false };
  const o2 = orologioFinto('2026-10-14T08:00:00Z');
  const r2 = L.creaRitmo({ adesso: o2.adesso, pausa: async (ms) => { o2.avanza(ms); if (o2.adesso() - Date.parse('2026-10-14T08:00:00Z') > 5000) segnale.annullata = true; }, segnale });
  for (let i = 0; i < 40; i++) await r2.attendi(1);
  let e = null;
  try { await r2.attendi(1); } catch (x) { e = x; }
  verifica('«Annulla» ferma anche un\'attesa lunga, entro pochi secondi', e && e.codice === 'annullata' && o2.adesso() - Date.parse('2026-10-14T08:00:00Z') < 7000, String(e && e.codice));
});

// La copia intera, con l'orologio finto e il file preso al posto del download.
const copia = async (opzioni = {}) => {
  const db = opzioni.db || costruisci();
  const o = orologioFinto(opzioni.inizio || '2026-10-14T08:00:00Z');
  const cc = clienteCopia({ db, orologio: o, funzioni: RISPOSTE, ...opzioni.cliente });
  const scaricati = [];
  const fasi = [];
  let esito = null, errore = null;
  try {
    esito = await L.scaricaCopiaSicurezza({
      client: cc.client, adesso: o.adesso, pausa: o.pausa, segnale: opzioni.segnale || null,
      avanzamento: (a) => { fasi.push(a); if (opzioni.avanzamento) opzioni.avanzamento(a); },
      scaricaFile: (blob, nome) => scaricati.push({ blob, nome }),
    });
  } catch (e) { errore = e; }
  return { db, o, ...cc, scaricati, fasi, esito, errore };
};

await sezione('5. LA COPIA INTERA: UN FILE, LO STESSO FORMATO DELLA COPIA DEI DATI VERI, E NIENTE SUL SERVER', async () => {
  const c = await copia();
  verifica('la copia riesce', !c.errore && c.esito, String(c.errore && c.errore.stack));
  verifica('un file solo, col nome del giorno italiano', c.scaricati.length === 1 && c.scaricati[0].nome === 'treadrider-copia-2026-10-14.json.gz', J(c.scaricati.map(s => s.nome)));
  const D = await riapri(c.scaricati[0].blob);
  verifica('il file si riapre: meta, archivi, attesi, in quest\'ordine', J(Object.keys(D)) === J(['meta', 'archivi', 'attesi']), J(Object.keys(D)));
  verifica('ci sono tutti gli archivi', J(Object.keys(D.archivi).sort()) === J([...L.ARCHIVI_DELLA_COPIA].sort()));
  const diversi = L.ARCHIVI_DELLA_COPIA.filter(n => perId(D.archivi[n]) !== perId(senzaDoppioni(c.db[n] || [])));
  verifica('ogni archivio e\' quello di partenza, senza doppioni', diversi.length === 0, diversi.join(', '));
  verifica('le 12.345 primarie e le 5.000 dichiarazioni, intere', D.archivi.PrimariaRete.length === 12345 && D.archivi.DichiarazioneTrattamento.length === 5000);
  const m = D.meta;
  verifica('il meta dice chi, quando e il giorno', m.gestionale === 'TreadRider' && m.chi === 'Mario Rossi' && m.email === 'mario@smoco.it' && m.giorno === '2026-10-14'
    && !isNaN(Date.parse(m.letto_dal)) && Date.parse(m.letto_fino_al) >= Date.parse(m.letto_dal), J({ chi: m.chi, giorno: m.giorno, dal: m.letto_dal, al: m.letto_fino_al }));
  verifica('quanti record per archivio, e in tutto', L.ARCHIVI_DELLA_COPIA.every(n => m.righe[n] === D.archivi[n].length) && m.righe_totali === Object.values(D.archivi).reduce((s, a) => s + a.length, 0) && m.archivi_letti === L.ARCHIVI_DELLA_COPIA.length);
  verifica('i doppioni tolti si dicono', m.doppioni_tolti.PrimariaRete === 30, J(m.doppioni_tolti));
  verifica('l\'ultimo caricamento del registro, per sapere che nessuno e\' entrato a meta\'', m.ultimo_caricamento && m.ultimo_caricamento.tipo === 'primarie' && m.ultimo_caricamento.esito === 'successo', J(m.ultimo_caricamento));
  verifica('la versione del codice: il commit non si sa dal browser, e lo dice', m.commit_pubblicato === null && 'versione_sito' in m);
  verifica('i file allegati non ci sono, la copia tiene i riferimenti e lo dice', /file_uri/.test(m.file_allegati) && /riservato/.test(m.file_allegati) && D.archivi.DocumentoQualifica.every(r => /^privato\//.test(r.file_uri)));
  verifica('nessun archivio non letto, nessun attesi mancante', m.non_letti.length === 0 && m.attesi_mancanti.length === 0);
  // Gli attesi: le risposte di Giacenze e Dichiarazioni, come nella copia dei dati veri.
  verifica('gli attesi delle due funzioni, con { stato, risposta }', D.attesi.riepilogoDichiarazioni_2026 && D.attesi.riepilogoDichiarazioni_2026.stato === 200 && D.attesi.riepilogoDichiarazioni_2026.risposta.totali.conferito_t === 1234.5
    && D.attesi.calcolaGiacenze_2026 && D.attesi.calcolaGiacenze_2026.risposta.righe[0].giacenza_portale_t === 12.34, J(D.attesi));
  const funzioni = c.richieste.filter(x => x.tipo === 'funzione');
  verifica('le due funzioni chiamate con il solo anno: senza registra non scrivono', J(funzioni.map(f => [f.nome, f.corpo])) === J([['riepilogoDichiarazioni', '{"anno":2026}'], ['calcolaGiacenze', '{"anno":2026}']]), J(funzioni));
  // Il lettore della copia dei dati veri: il meta col momento della lettura e
  // gli archivi come elenchi, che il suo SDK finto filtra.
  verifica('il lettore delle prove la legge: letto_fino_al, archivi come elenchi', typeof m.letto_fino_al === 'string' && Number(String(m.letto_fino_al).slice(0, 4)) === 2026
    && Object.values(D.archivi).every(Array.isArray) && D.archivi.PrimariaRete.filter(r => r.id_ordine === 'ORD1').length === 2);
  // Nessun dato su un server: le uniche scritture sono la riga del registro.
  const scritture = c.richieste.filter(x => x.tipo === 'scrittura');
  verifica('una scrittura sola: la riga del registro delle copie', scritture.length === 1 && scritture[0].nome === 'CopiaSicurezza' && scritture[0].metodo === 'create', J(scritture.map(s => [s.nome, s.metodo])));
  const r = scritture[0] ? scritture[0].dati : {};
  verifica('la riga dice giorno, chi, archivi, righe e kB, senza i dati', r.giorno === '2026-10-14' && r.utente === 'Mario Rossi' && r.archivi === L.ARCHIVI_DELLA_COPIA.length && r.righe === m.righe_totali
    && r.kb === Math.max(1, Math.round(c.scaricati[0].blob.size / 1024)) && r.non_letti === 0 && r.nome_file === 'treadrider-copia-2026-10-14.json.gz' && J(r).length < 4000 && !/ORD1|privato\//.test(J(r)), J(r).slice(0, 300));
  verifica('l\'esito per la pagina', c.esito && c.esito.registrata === true && c.esito.nomeFile === r.nome_file && c.esito.righe === m.righe_totali && c.esito.riga.id === 'copia-nuova', J(c.esito && { ...c.esito, riga: undefined }));
  const lib = sorgente('src/lib/copiaSicurezza.js');
  verifica('la libreria non carica file da nessuna parte', !/UploadFile|UploadPrivateFile|integrations/.test(lib.split('\n').filter(x => !/^\s*\/\//.test(x)).join('\n')));
  // Il ritmo, sul giro intero, con il peso delle due funzioni.
  const stampi = c.richieste.flatMap(x => (x.tipo === 'funzione' ? Array(x.nome === 'calcolaGiacenze' ? 18 : 15).fill(x.il) : [x.il]));
  verifica('in nessun minuto piu\' di 40 richieste, contando le letture delle funzioni', massimoAlMinuto(stampi) <= 40, String(massimoAlMinuto(stampi)));
  verifica('prima di leggere guarda il registro, e alla fine lo riguarda', c.richieste[0].nome === 'UploadLog' && c.richieste.filter(x => x.nome === 'UploadLog' && x.sort === '-updated_date').length === 2, J(c.richieste.slice(0, 3).map(x => [x.nome, x.metodo, x.sort])));
  verifica('l\'avanzamento passa da tutte le fasi', ['controllo', 'lettura', 'attesi', 'verifica', 'compressione', 'registro'].every(f => c.fasi.some(a => a.fase === f)), J([...new Set(c.fasi.map(a => a.fase))]));
  // Il giorno del nome e' quello italiano: alle 23:30 UTC del 13 in Italia e' gia' il 14.
  const notte = await copia({ inizio: '2026-10-13T22:30:00Z' });
  verifica('alle 00:30 italiane il file e\' del giorno italiano', notte.scaricati[0] && notte.scaricati[0].nome === 'treadrider-copia-2026-10-14.json.gz', J(notte.scaricati.map(s => s.nome)));
});

await sezione('6. CHE COSA FERMA LA COPIA, E CHE COSA NON LA FERMA MA LO DICE', async () => {
  const letteArchivi = (c) => c.richieste.filter(x => x.tipo === 'lettura' && x.nome !== 'UploadLog').length;
  // Chi non e' amministratore: nemmeno una lettura.
  const u = await copia({ cliente: { ruolo: 'user' } });
  verifica('chi non e\' amministratore: niente letture, niente file, niente registro', u.errore && u.errore.codice === 'non_amministratore' && u.richieste.length === 0 && u.scaricati.length === 0, String(u.errore && u.errore.codice));
  // Un caricamento in corso: si legge il registro e basta.
  const dbIn = costruisci();
  dbIn.UploadLog.unshift(riga('UploadLog', 9, { tipo_file: 'primarie', esito: 'in_corso', modalita: 'sostituzione', utente: 'Luca Bianchi', created_date: '2026-10-14T07:58:00.000000', updated_date: '2026-10-14T07:59:00.000000' }));
  const inCorso = await copia({ db: dbIn });
  verifica('un caricamento in corso ferma la copia prima di leggere gli archivi', inCorso.errore && inCorso.errore.codice === 'caricamento_in_corso' && letteArchivi(inCorso) === 0 && inCorso.scaricati.length === 0, String(inCorso.errore && inCorso.errore.codice));
  const t1 = L.testoErroreCopia(inCorso.errore);
  verifica('e la pagina dice quale, e di aspettare', /Primarie e assegnati, da Luca Bianchi/.test(t1.testo) && /Riprova fra qualche minuto/.test(t1.testo), t1.testo);
  // Uno rimasto aperto da ore e' interrotto: non sta scrivendo nessuno, la
  // copia si fa e lo scrive nel meta.
  const dbVecchio = costruisci();
  dbVecchio.UploadLog.unshift(riga('UploadLog', 8, { tipo_file: 'secondarie', esito: 'in_corso', modalita: 'sostituzione', created_date: '2026-10-14T05:00:00.000000', updated_date: '2026-10-14T05:00:00.000000' }));
  const vecchio = await copia({ db: dbVecchio });
  const Dv = vecchio.scaricati[0] ? await riapri(vecchio.scaricati[0].blob) : { meta: {} };
  verifica('un caricamento interrotto non ferma la copia, e il meta lo dice', !vecchio.errore && J(Dv.meta.caricamenti_aperti) === J([{ tipo: 'secondarie', il: '2026-10-14T05:00:00.000Z', stato: 'interrotto' }]), `${vecchio.errore && vecchio.errore.codice} ${J(Dv.meta.caricamenti_aperti)}`);
  // Un caricamento che entra durante la lettura: la copia non e' coerente.
  const durante = await copia({ cliente: { dopoLetture: (n, db) => { if (n === 30) db.UploadLog.unshift(riga('UploadLog', 7, { tipo_file: 'secondarie', esito: 'in_corso', created_date: '2026-10-14T08:00:30.000000', updated_date: '2026-10-14T08:00:30.000000' })); } } });
  verifica('un caricamento entrato durante la lettura: niente file, niente registro', durante.errore && durante.errore.codice === 'caricamento_durante' && durante.scaricati.length === 0 && !durante.richieste.some(x => x.tipo === 'scrittura'), String(durante.errore && durante.errore.codice));
  verifica('e la pagina dice quale', /Secondarie, in corso/.test(L.testoErroreCopia(durante.errore).testo), L.testoErroreCopia(durante.errore).testo);
  // Uno che parte subito dopo il primo sguardo al registro e resta aperto fino
  // alla fine: l'impronta si prende per prima, quindi o lo vede lo stato (in
  // corso) o lo vede l'impronta di dopo (riga nuova). Prima lo stato e poi
  // l'impronta, sarebbe passato fra i due senza che nessuno lo vedesse.
  const subito = await copia({ cliente: { dopoLetture: (n, db) => { if (n === 1) db.UploadLog.unshift(riga('UploadLog', 6, { tipo_file: 'terziarie', esito: 'in_corso', created_date: '2026-10-14T08:00:01.000000', updated_date: '2026-10-14T08:00:01.000000' })); } } });
  verifica('un caricamento partito subito dopo il primo sguardo al registro, ancora aperto alla fine, ferma la copia', subito.errore && ['caricamento_in_corso', 'caricamento_durante'].includes(subito.errore.codice) && subito.scaricati.length === 0, String(subito.errore && subito.errore.codice));
  // La nota «moduli collegati aggiornati» e' un update della riga: conta anche lei.
  const nota = await copia({ cliente: { dopoLetture: (n, db) => { if (n === 50) db.UploadLog[0] = { ...db.UploadLog[0], updated_date: '2026-10-14T08:01:00.000000', messaggio: 'ricalcoli: moduli collegati aggiornati' }; } } });
  verifica('anche la nota dei ricalcoli scritta durante la lettura la ferma', nota.errore && nota.errore.codice === 'caricamento_durante', String(nota.errore && nota.errore.codice));
  // Annullata: niente file e niente registro.
  const segnale = { annullata: false };
  const annullata = await copia({ segnale, avanzamento: (a) => { if (a.fase === 'lettura' && a.indice === 10) segnale.annullata = true; } });
  verifica('annullata: niente file, niente registro, e lo dice', annullata.errore && annullata.errore.codice === 'annullata' && annullata.scaricati.length === 0 && !annullata.richieste.some(x => x.tipo === 'scrittura') && /non è stato scaricato niente/.test(L.testoErroreCopia(annullata.errore).testo), String(annullata.errore && annullata.errore.codice));
  // Un archivio che non risponde non ferma la copia: manca, e si dice.
  const guasto = new Error('Request failed with status code 500'); guasto.response = { status: 500, data: { error: 'servizio non disponibile' } };
  const g = await copia({ cliente: { guasti: { Omologa: guasto } } });
  const Dg = g.scaricati[0] ? await riapri(g.scaricati[0].blob) : { meta: {}, archivi: {} };
  verifica('un archivio che non si legge: la copia si scarica senza di lui e lo dice', !g.errore && !('Omologa' in Dg.archivi) && J(Dg.meta.non_letti) === J([{ archivio: 'Omologa', motivo: 'servizio non disponibile', stato: 500 }]), J(Dg.meta.non_letti));
  verifica('mancante, non vuoto: non ha un conteggio di righe', !('Omologa' in Dg.meta.righe), J(Dg.meta.righe.Omologa));
  const rg = g.richieste.find(x => x.tipo === 'scrittura');
  verifica('e il registro lo segna incompleta', rg && rg.dati.non_letti === 1 && g.esito.nonLetti.length === 1);
  // Per nome, nel registro e a video (revisione del 15/10/2026).
  verifica('il registro dice quale archivio manca', rg && rg.dati.archivi_non_letti === 'Omologa' && rg.dati.attesi_mancanti === '', J(rg && rg.dati));
  const tn = L.testoNonLetti(g.esito.nonLetti) || '';
  verifica('il testo a video dice quale archivio e perche\'', /^Non si è letto l'archivio Omologa \(servizio non disponibile\): non è nel file, e la copia è incompleta/.test(tn), tn);
  verifica('anche con piu\' archivi, tutti per nome', /^Non si sono letti 2 archivi: Omologa \(a\); Tariffa \(b\)\. Non sono nel file/.test(L.testoNonLetti([{ archivio: 'Omologa', motivo: 'a' }, { archivio: 'Tariffa', motivo: 'b' }]) || ''));
  verifica('nessun archivio mancante, nessun testo', L.testoNonLetti([]) === null && L.testoNonLetti(undefined) === null);
  verifica('l\'ultima copia della sezione dice quale manca', /incompleta: 1 archivio non letto \(Omologa\)$/.test(L.testoUltimaCopia(g.esito.riga)), L.testoUltimaCopia(g.esito.riga));
  // Il registro che non si scrive: il file c'e' lo stesso.
  const nr = await copia({ cliente: { creaRotto: true } });
  verifica('il registro non si scrive: il file c\'e\' e l\'esito lo dice', !nr.errore && nr.scaricati.length === 1 && nr.esito.registrata === false && nr.esito.motivoRegistro === 'archivio non raggiungibile', J(nr.esito && { registrata: nr.esito.registrata, motivo: nr.esito.motivoRegistro }));
  // Una funzione degli attesi che cade: la copia resta una copia di sicurezza.
  const fa = await copia({ cliente: { funzioni: { ...RISPOSTE, calcolaGiacenze: async () => { throw new Error('tempo scaduto'); } } } });
  const Df = fa.scaricati[0] ? await riapri(fa.scaricati[0].blob) : { meta: {}, attesi: {} };
  verifica('gli attesi che mancano si scrivono, col motivo, e la copia si scarica', !fa.errore && J(Df.attesi.calcolaGiacenze_2026) === J({ stato: 500, errore: 'tempo scaduto' }) && J(Df.meta.attesi_mancanti) === J(['calcolaGiacenze_2026']), J(Df.attesi && Df.attesi.calcolaGiacenze_2026));
  // Prima usciva come buona: a video niente e nel registro la riga di una copia
  // completa. Messa in ../dati-veri faceva passare il controllo con 99
  // verifiche su 158 (revisione del 15/10/2026).
  const rf = fa.richieste.find(x => x.tipo === 'scrittura');
  verifica('il registro sa che mancano i numeri di Giacenze', rf && rf.dati.attesi_mancanti === 'calcolaGiacenze_2026' && rf.dati.non_letti === 0, J(rf && rf.dati));
  verifica('l\'esito dice alla pagina quale funzione e perche\'', J(fa.esito && fa.esito.attesiNonRisposti) === J([{ chiave: 'calcolaGiacenze_2026', nome: 'Giacenze', stato: 500, motivo: 'tempo scaduto' }]), J(fa.esito && fa.esito.attesiNonRisposti));
  const ta = L.testoAttesiMancanti(fa.esito && fa.esito.attesiNonRisposti) || '';
  verifica('il testo: va bene come copia di sicurezza, non come copia dei dati veri', ta === 'Giacenze non ha risposto durante la copia (tempo scaduto): il file va bene come copia di sicurezza degli archivi, ma non come copia dei dati veri per il controllo di Giacenze e Dichiarazioni, perché mancano i numeri che Giacenze diceva in questo momento. Se ti serve per quello, rifalla fra qualche minuto.', ta);
  const ta2 = L.testoAttesiMancanti([{ chiave: 'riepilogoDichiarazioni_2026', motivo: 'a' }, { nome: 'Giacenze', motivo: null }]) || '';
  verifica('con tutte e due: i nomi e i motivi', /^Dichiarazioni e Giacenze non hanno risposto durante la copia \(Dichiarazioni: a; Giacenze: nessuna risposta\)/.test(ta2) && /i numeri che dicevano in questo momento/.test(ta2), ta2);
  verifica('nessun atteso mancante, nessun testo', L.testoAttesiMancanti([]) === null && L.testoAttesiMancanti(undefined) === null);
  verifica('l\'ultima copia della sezione lo dice', /senza i numeri di Giacenze: non vale come copia dei dati veri per i controlli$/.test(L.testoUltimaCopia(fa.esito.riga)), L.testoUltimaCopia(fa.esito.riga));
  verifica('il promemoria non la chiama incompleta: come copia di sicurezza e\' buona', vociPromemoriaCopia({ righe: [fa.esito.riga], oggi: '2026-10-14', amministratore: true }).length === 0);
});

await sezione('7. IL PROMEMORIA IN «DA GESTIRE»: DOPO SETTE GIORNI, SOLO ALL\'AMMINISTRATORE', async () => {
  const oggi = '2026-10-14';
  const conGiorno = (g, altro = {}) => vociPromemoriaCopia({ righe: [{ giorno: g, il: `${g}T07:00:00.000Z`, ...altro }], oggi, amministratore: true });
  verifica('fatta oggi (0 giorni): niente', conGiorno('2026-10-14').length === 0);
  verifica('6 giorni: niente', conGiorno('2026-10-08').length === 0);
  const sette = conGiorno('2026-10-07');
  verifica('7 giorni: la voce, con la data all\'italiana', sette.length === 1 && sette[0].titolo === 'L\'ultima copia di sicurezza è del 07/10/2026: scaricane una' && sette[0].gravita === 'info', J(sette));
  const otto = conGiorno('2026-10-06');
  verifica('8 giorni: la voce', otto.length === 1 && otto[0].titolo === 'L\'ultima copia di sicurezza è del 06/10/2026: scaricane una' && /Sono passati 8 giorni/.test(otto[0].dettaglio), J(otto));
  verifica('14 giorni: diventa attenzione', conGiorno('2026-09-30')[0].gravita === 'attenzione');
  const mai = vociPromemoriaCopia({ righe: [], oggi, amministratore: true });
  verifica('mai fatta: lo dice', mai.length === 1 && mai[0].titolo === 'Non è mai stata scaricata una copia di sicurezza: scaricane una' && mai[0].gravita === 'attenzione', J(mai));
  verifica('registro non letto: nessuna voce (un valore mancante non e\' «mai»)', vociPromemoriaCopia({ righe: null, oggi, amministratore: true }).length === 0 && vociPromemoriaCopia({ oggi, amministratore: true }).length === 0);
  verifica('chi non e\' amministratore: nessuna voce, nemmeno mai fatta', vociPromemoriaCopia({ righe: [], oggi, amministratore: false }).length === 0 && vociPromemoriaCopia({ righe: [{ giorno: '2026-09-01' }], oggi }).length === 0);
  const v = sette[0];
  verifica('la voce porta alla sezione, nella sezione «dati» della dashboard', v.area === AREA_COPIA && v.link === LINK_COPIA && v.link === '/caricamento-dati#copia-sicurezza' && v.sezione === 'dati' && v.chiave === 'copia-sicurezza');
  verifica('nascosta, torna con una copia nuova e non perche\' i giorni crescono', v.firma === '2026-10-07' && J(v.misure) === '[]' && conGiorno('2026-10-06')[0].firma !== v.firma);
  verifica('l\'ultima copia incompleta lo dice subito', /è senza un archivio: scaricane una completa/.test((conGiorno('2026-10-13', { non_letti: 1 })[0] || {}).titolo || ''));
  // E dice quale, quando il registro lo sa (revisione del 15/10/2026).
  const monca = conGiorno('2026-10-13', { non_letti: 1, archivi_non_letti: 'Omologa' })[0] || {};
  verifica('il dettaglio dice quale archivio manca', /^Quando è stata fatta un archivio non si è letto \(Omologa\), e il file non lo contiene\./.test(monca.dettaglio || ''), monca.dettaglio);
  const monche = conGiorno('2026-10-13', { non_letti: 2, archivi_non_letti: 'Omologa, Tariffa' })[0] || {};
  verifica('e quali, se sono di piu\'', /^Quando è stata fatta 2 archivi non si sono letti \(Omologa, Tariffa\), e il file non li contiene\./.test(monche.dettaglio || ''), monche.dettaglio);
  // Il giorno italiano: una copia del 13 alle 23:30 italiane (21:30 UTC) e' del 13.
  verifica('il giorno della copia e\' quello italiano', giornoDellaCopia({ il: '2026-10-13T22:30:00.000Z' }) === '2026-10-14' && giornoDellaCopia({ created_date: '2026-10-13T21:30:00.000000' }) === '2026-10-13');
  verifica('fra piu\' righe vale la piu\' recente', vociPromemoriaCopia({ righe: [{ giorno: '2026-09-01' }, { giorno: '2026-10-12' }], oggi, amministratore: true }).length === 0);
  verifica(`la soglia e' ${GIORNI_COPIA} giorni`, GIORNI_COPIA === 7);
  // La riga che scrive la copia e la regola si capiscono: sette giorni dopo la voce c'e'.
  const r = L.rigaDelRegistro({ giorno: '2026-10-07', letto_dal: '2026-10-07T06:58:00.000Z', letto_fino_al: '2026-10-07T07:00:00.000Z', chi: 'Mario Rossi', archivi_letti: 71, righe_totali: 10, non_letti: [], righe: {} }, { nomeFile: 'x', kb: 1 });
  verifica('sulla riga scritta dalla copia la regola conta i giorni giusti', vociPromemoriaCopia({ righe: [r], oggi, amministratore: true }).length === 1 && vociPromemoriaCopia({ righe: [r], oggi: '2026-10-13', amministratore: true }).length === 0);
  verifica('la pagina ha la sezione a cui porta il collegamento', /<section id="copia-sicurezza"/.test(sorgente('src/components/caricamento/CopiaSicurezza.jsx')) && /path="\/caricamento-dati"/.test(sorgente('src/App.jsx')));
  verifica('i testi del promemoria non nominano la piattaforma', !/base44/i.test(J([sette, mai])));
});

await sezione('8. LA PAGINA VERA: IL PULSANTE ALL\'AMMINISTRATORE, A NESSUN ALTRO', async () => {
  // Caricamento Dati, con i soli permessi sostituiti (la pagina finta non ha il
  // contesto dell'autenticazione).
  const IMPORT_PERMESSI = "import { usePermessi } from '@/lib/permessi';";
  const sp = sorgente('src/pages/CaricamentoDati.jsx');
  verifica('la pagina prende i permessi da usePermessi, come la copia si aspetta', sp.includes(IMPORT_PERMESSI));
  // Le due pagine si scrivono in una cartella temporanea, che si toglie anche
  // se la prova cade (revisione del 15/10/2026: ne restava una a ogni giro).
  const cartella = mkdtempSync(join(tmpdir(), 'copia-sicurezza-'));
  const pagina = async (admin) => {
    const f = join(cartella, `CaricamentoDati${admin ? 'Admin' : 'Altri'}.jsx`);
    writeFileSync(f, sp.replace(IMPORT_PERMESSI, `const usePermessi = () => ({ isAdmin: ${admin}, puoCaricare: () => ${admin}, livello: '${admin ? 'admin' : 'consultazione'}' });`));
    const P = await caricaPagina('pages/CaricamentoDati', { file: f });
    const c = clienteFinto({ archivi: { UploadLog: [] } });
    globalThis.__CLIENTE_FINTO = c.cliente;
    const m = P.monta(P.Componente, {});
    await aspetta(40);
    const sezioni = trova(m.albero, 'CopiaSicurezza');
    m.smonta();
    return { sezioni, letture: c.letture('CopiaSicurezza').length };
  };
  let a, n;
  try {
    a = await pagina(true);
    n = await pagina(false);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
  verifica('la cartella temporanea delle pagine non resta', !existsSync(cartella), cartella);
  verifica('l\'amministratore ha la sezione della copia', a.sezioni.length === 1, String(a.sezioni.length));
  verifica('a pagina ferma la copia si puo\' fare (nessun caricamento, nessun ricalcolo)', a.sezioni[0] && a.sezioni[0].props.fermo === false, J(a.sezioni[0] && a.sezioni[0].props));
  verifica('chi non e\' amministratore non ce l\'ha, e la pagina non legge il registro delle copie', n.sezioni.length === 0 && n.letture === 0, `${n.sezioni.length} ${n.letture}`);
  const chi = readdirSync(qui('../src'), { recursive: true }).map(p => String(p).replace(/\\/g, '/')).filter(p => /\.(jsx?|tsx?)$/.test(p) && /import\s+CopiaSicurezza\s+from/.test(sorgente('src/' + p)));
  verifica('la sezione la usa solo Caricamento Dati', J(chi) === J(['pages/CaricamentoDati.jsx']), J(chi));
  verifica('e la disegna sotto isAdmin', /\{isAdmin && <CopiaSicurezza\b[^\n]*\/>\}/.test(sp) && (sp.match(/<CopiaSicurezza\b/g) || []).length === 1);
  verifica('ferma mentre la pagina carica un file o rifa\' i ricalcoli', /<CopiaSicurezza fermo=\{!!uploading \|\| Object\.values\(ricalcoli\)\.some\(r => r && r\.in_corso\)\} \/>/.test(sp));

  // La sezione stessa, col client finto: l'ultima copia, il testo, il pulsante.
  const S = await caricaPagina('components/caricamento/CopiaSicurezza');
  const archivi = costruisci();
  const c = clienteFinto({ archivi: { ...archivi, UploadLog: REGISTRO.map(r => ({ ...r })) }, funzioni: RISPOSTE });
  c.cliente.auth.me = async () => ({ role: 'admin', full_name: 'Mario Rossi', email: 'mario@smoco.it' });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const m = S.monta(S.Componente, {});
  await aspetta(40);
  const parole = testo(m.albero);
  verifica('dice l\'ultima copia del registro, con una lettura sola di una riga', /Ultima copia: 06\/10\/2026 alle 09:00, da Mario Rossi · 70 archivi · 100 righe · 10 kB/.test(parole.replace(/\s+/g, ' ')) && c.letture('CopiaSicurezza').length === 1, parole.slice(0, 200));
  for (const [cosa, re] of [
    ['a che cosa serve', /non perdere niente/], ['dove finisce il file', /cartella Download/], ['il nome del file', /treadrider-copia-aaaa-mm-gg\.json\.gz/],
    ['come si conserva', /disco esterno/], ['che i dati non lasciano il PC', /I dati non lasciano il PC/], ['che e\' riservata', /documento riservato/],
    ['che i documenti allegati non ci sono', /documenti allegati/], ['ogni quanto', /una volta alla settimana/],
  ]) verifica(`la sezione dice ${cosa}`, re.test(parole), cosa);
  verifica('nessun riferimento visibile alla piattaforma', !/base44/i.test(parole));
  const pulsante = () => trova(m.albero, el => el.type && el.type.__finto === 'Button' && /Scarica la copia di sicurezza/.test(testo(el)))[0];
  verifica('il pulsante «Scarica la copia di sicurezza»', !!pulsante());
  // Il giro del pulsante col tempo finto: le pause della copia passano subito.
  const scaricati = [];
  globalThis.document = { body: { appendChild() {} }, querySelector: () => ({ getAttribute: () => '/assets/index-prova.js' }), createElement: () => ({ click() { scaricati.push({ nome: this.download, blob: resolveObjectURL(this.href) }); }, remove() {} }) };
  const veri = { now: Date.now, setTimeout: globalThis.setTimeout };
  let finto = Date.parse('2026-10-14T08:00:00Z');
  Date.now = () => finto;
  globalThis.setTimeout = (fn, ms = 0) => { finto += Number(ms) || 0; setImmediate(fn); return 0; };
  try {
    const p = pulsante();
    p.props.onClick();
    p.props.onClick();
    await aspetta(5);
    verifica('durante la copia il pulsante e\' spento e c\'e\' «Annulla»', pulsante().props.disabled === true && trova(m.albero, el => el.type && el.type.__finto === 'Button' && /Annulla/.test(testo(el))).length === 1);
    for (let i = 0; i < 400 && !trova(m.albero, el => el.type === 'p' && /Copia scaricata|non è riuscita/.test(testo(el))).length; i++) await aspetta(20);
  } finally {
    Date.now = veri.now;
    globalThis.setTimeout = veri.setTimeout;
  }
  const finito = testo(m.albero).replace(/\s+/g, ' ');
  verifica('la copia scaricata, col nome del giorno', scaricati.length === 1 && scaricati[0].nome === 'treadrider-copia-2026-10-14.json.gz', J(scaricati.map(s => s.nome)));
  const D = scaricati[0] ? await riapri(scaricati[0].blob) : { meta: {} };
  verifica('il file e\' la copia, con la versione del sito', D.meta.righe_totali > 12345 && D.meta.versione_sito === '/assets/index-prova.js', J({ righe: D.meta.righe_totali, v: D.meta.versione_sito }));
  const create = c.chiamate.filter(x => x.tipo === 'scrittura');
  verifica('un doppio clic fa una copia sola e una riga sola', create.length === 1 && create[0].nome === 'CopiaSicurezza', J(create));
  verifica('a video: copia scaricata, dove trovarla, e l\'ultima copia aggiornata', /Copia scaricata: treadrider-copia-2026-10-14\.json\.gz/.test(finito) && /cartella Download/.test(finito) && /Ultima copia: 14\/10\/2026 alle 10:0\d, da Mario Rossi · \d+ archivi/.test(finito) && finito.includes(` · ${L.ARCHIVI_DELLA_COPIA.length} archivi · `), finito.slice(-400));
  verifica('il pulsante si riaccende', pulsante() && pulsante().props.disabled === false);
  verifica('nessun errore nella pagina', m.errori.length === 0, m.errori.map(String).join(' | '));
  m.smonta();

  // Con la pagina che carica o ricalcola: il pulsante e' spento, lo dice, e un
  // clic non legge niente.
  const c2 = clienteFinto({ archivi: { CopiaSicurezza: [] } });
  globalThis.__CLIENTE_FINTO = c2.cliente;
  const m2 = S.monta(S.Componente, { fermo: true });
  await aspetta(40);
  const p2 = trova(m2.albero, el => el.type && el.type.__finto === 'Button' && /Scarica la copia di sicurezza/.test(testo(el)))[0];
  verifica('ferma: pulsante spento e il perche\'', p2 && p2.props.disabled === true && /Aspetta che finiscano il caricamento e i ricalcoli/.test(testo(m2.albero)));
  if (p2) { await p2.props.onClick(); await aspetta(10); }
  verifica('ferma: un clic non fa partire niente', c2.chiamate.filter(x => x.tipo !== 'lettura' || x.nome !== 'CopiaSicurezza').length === 0, J(c2.chiamate));
  verifica('senza copie nel registro lo dice', /Ultima copia: nessuna copia scaricata finora/.test(testo(m2.albero).replace(/\s+/g, ' ')));
  m2.smonta();

  // Una copia a cui manca qualcosa, sulla sezione vera: Omologa non risponde e
  // Giacenze va in 504. Prima a video c'era solo «Copia scaricata», il nome
  // dell'archivio stava nel title (al tocco non si vede) e di Giacenze non si
  // diceva niente (revisione del 15/10/2026).
  const c3 = clienteFinto({ archivi: { ...costruisci(), UploadLog: REGISTRO.map(r => ({ ...r })), CopiaSicurezza: [] }, funzioni: { ...RISPOSTE, calcolaGiacenze: async () => { throw Object.assign(new Error('tempo scaduto'), { status: 504 }); } } });
  c3.cliente.auth.me = async () => ({ role: 'admin', full_name: 'Mario Rossi', email: 'mario@smoco.it' });
  const entitaVere = c3.cliente.entities;
  c3.cliente.entities = new Proxy({}, { get: (_t, nome) => (nome === 'Omologa' ? { list: async () => { const e = new Error('Request failed with status code 500'); e.response = { status: 500, data: { error: 'servizio non disponibile' } }; throw e; } } : entitaVere[nome]) });
  globalThis.__CLIENTE_FINTO = c3.cliente;
  const m3 = S.monta(S.Componente, {});
  await aspetta(40);
  const scaricati3 = [];
  globalThis.document = { body: { appendChild() {} }, querySelector: () => null, createElement: () => ({ click() { scaricati3.push({ nome: this.download, blob: resolveObjectURL(this.href) }); }, remove() {} }) };
  const veri3 = { now: Date.now, setTimeout: globalThis.setTimeout };
  let finto3 = Date.parse('2026-10-14T08:00:00Z');
  Date.now = () => finto3;
  globalThis.setTimeout = (fn, ms = 0) => { finto3 += Number(ms) || 0; setImmediate(fn); return 0; };
  try {
    const p3 = trova(m3.albero, el => el.type && el.type.__finto === 'Button' && /Scarica la copia di sicurezza/.test(testo(el)))[0];
    p3.props.onClick();
    for (let i = 0; i < 400 && !trova(m3.albero, el => el.type === 'p' && /Copia scaricata|non è riuscita/.test(testo(el))).length; i++) await aspetta(20);
  } finally {
    Date.now = veri3.now;
    globalThis.setTimeout = veri3.setTimeout;
  }
  const video3 = testo(m3.albero).replace(/\s+/g, ' ');
  const dopo3 = video3.slice(video3.indexOf('Copia scaricata'));
  verifica('monca: il file si scarica lo stesso', scaricati3.length === 1 && /Copia scaricata/.test(video3), video3.slice(-300));
  verifica('monca: a video l\'archivio che manca, per nome e col motivo', /Non si è letto l'archivio Omologa \(servizio non disponibile\): non è nel file, e la copia è incompleta/.test(dopo3), dopo3);
  verifica('monca: a video che Giacenze non ha risposto e che non vale come copia dei dati veri', /Giacenze non ha risposto durante la copia \(tempo scaduto\): il file va bene come copia di sicurezza degli archivi, ma non come copia dei dati veri/.test(dopo3), dopo3);
  verifica('monca: l\'ultima copia della sezione dice che cosa manca', /Ultima copia: 14\/10\/2026 alle 10:0\d, da Mario Rossi · \d+ archivi · [\d.]+ righe · [^·]+ · incompleta: 1 archivio non letto \(Omologa\) · senza i numeri di Giacenze: non vale come copia dei dati veri per i controlli/.test(video3), video3.slice(video3.indexOf('Ultima copia'), video3.indexOf('Ultima copia') + 300));
  const scritta3 = c3.chiamate.filter(x => x.tipo === 'scrittura');
  verifica('monca: una riga sola nel registro', scritta3.length === 1 && scritta3[0].nome === 'CopiaSicurezza', J(scritta3));
  verifica('monca: nessun errore nella pagina', m3.errori.length === 0, m3.errori.map(String).join(' | '));
  m3.smonta();
});

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
