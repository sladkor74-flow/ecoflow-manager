// I CANCELLATI DAL PORTALE: GLI AGGANCI FUORI DALLA REGOLA (chiusura del giro
// del 14/10/2026).
//
// La regola sta in todoOrdini.ts e richiesteEct.ts e la prova in
// prove/todoCancellatiDalPortale.mjs. Qui si provano i punti che la usano e che
// la revisione del 14/10/2026 aveva trovato indietro:
//
// 1. gli schemi degli archivi: lo stato `cancellato` di un'attivita' e' fra i
//    valori ammessi di Todo.stato (senza, l'aggiornamento di controllaTodoOrdini
//    puo' essere rifiutato), e le descrizioni dicono quello che il codice scrive
//    (niente piu' «decide l utente», il `visto_il` dei cancellati di una
//    richiesta, l'esito annullata o evasa in parte da sola);
// 2. il ricalcolo delle richieste ECT dopo le primarie (importaBlocco, azione
//    ritiri_ect, sul banco): scrive PRIMA lo stato dei suoi ordini e POI l'esito
//    che lo legge (al contrario restava indietro di un caricamento, e pagina,
//    dashboard ed EcoTyna dicevano tre cose diverse), riprende le richieste
//    chiuse dal portale (il portale le riapre riassegnando l'ordine) e porta
//    avanti il giorno in cui un ordine si e' visto cancellato;
// 3. la dashboard: una richiesta evasa IN PARTE non e' «con gli ordini tutti
//    ritirati»;
// 4. l'elenco della to-do list con le sole cancellate non dice «Nessuna
//    attivita'».
// L'orologio e' fermo al 15/10/2026. node prove/cancellatiDalPortaleAgganci.mjs
import { build } from 'esbuild';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const ADESSO = Date.parse('2026-10-15T08:00:00Z');
const OGGI = '2026-10-15';
const DataVera = Date;
globalThis.Date = class extends DataVera {
  constructor(...a) { super(...(a.length ? a : [ADESSO])); }
  static now() { return ADESSO; }
};

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + (extra ? ' -> ' + extra : '')); } };
const J = (x) => JSON.stringify(x);
// Col codice di prima un pezzo puo' non impacchettarsi: la prova lo dice e va avanti.
const prova = async (nome, fn) => { try { await fn(); } catch (e) { verifica(nome, false, String(e && e.message).slice(0, 300)); } };
const schema = (nome) => JSON.parse(readFileSync(qui(`../base44/entities/${nome}.jsonc`), 'utf8'));

const T = await import('../base44/shared/todoOrdini.ts');
const R = await import('../base44/shared/richiesteEct.ts');
const S = await import('../src/lib/todoSezioni.js');
const C = await import('../base44/shared/cruscotto.ts');

// ---------------------------------------------------------------------------
console.log('1. GLI SCHEMI DICONO QUELLO CHE IL CODICE SCRIVE');

await prova('Todo', () => {
  const s = schema('Todo').properties;
  const ammessi = s.stato.enum || [];
  // Gli stati che il controllo degli ordini scrive davvero: un'attivita' coi suoi
  // ordini tutti cancellati, e una con uno terminato e uno cancellato.
  const prima = T.statoOrdini([], [{ id_ordine: 'ET26000101', stato: 'assegnato' }, { id_ordine: 'ET26000103', stato: 'assegnato' }]);
  const dopo = T.statoOrdini([
    { id_ordine: 'ET26000101', stato: 'cancellato', motivo_cancellazione: 'altro: pdr doppio' },
    { id_ordine: 'ET26000103', stato: 'terminato', trasporto_iniziato_il: '2026-10-08T07:00:00Z', trasporto_finito_il: '2026-10-09T08:00:00Z' },
  ], []);
  const due = (todo) => { const a = T.controlloAttivita(todo, prima, OGGI); return T.controlloAttivita({ ...todo, ...a.campi }, dopo, OGGI); };
  const scritti = [
    due({ titolo: 'Ritiro Rossi', riferimento_ordine: 'ET26000101', stato: 'aperto' }),
    due({ titolo: 'Ritiro Verdi', riferimento_ordine: 'ET26000101, ET26000103', stato: 'aperto' }),
  ].map(g => g.campi.stato);
  verifica('il controllo scrive cancellato e completato', J(scritti) === J(['cancellato', 'completato']), J(scritti));
  verifica('ogni stato che il controllo scrive e\' fra i valori ammessi di Todo.stato', scritti.every(x => ammessi.includes(x)), `ammessi ${J(ammessi)}`);
  verifica('il riferimento agli ordini non dice piu\' che sul cancellato decide l\'utente', !/decide l utente/.test(s.riferimento_ordine.description || '') && /cancellat/.test(s.riferimento_ordine.description || ''), s.riferimento_ordine.description);
  verifica('il giorno della chiusura dice che cosa vuol dire per una cancellata', /cancellat/.test(s.chiusa_dal_gestionale_il.description || ''), s.chiusa_dal_gestionale_il.description);
  verifica('nessun campo cancellata_il: il portale il giorno della cancellazione non lo scrive', !('cancellata_il' in s));
});

await prova('RichiestaEct', () => {
  const s = schema('RichiestaEct').properties;
  const stato = T.statoOrdini([{ id_ordine: 'ET26000101', stato: 'cancellato', motivo_cancellazione: 'altro: pdr doppio' }], []);
  const [voce] = R.statoOrdiniRichiesta(['ET26000101'], stato, null, OGGI);
  const d = s.ordini_stato_json.description || '';
  verifica('lo stato di un ordine cancellato porta il giorno in cui si e\' visto', voce.stato === 'cancellato' && voce.visto_il === OGGI, J(voce));
  verifica('la descrizione degli ordini nomina ogni campo di un cancellato', Object.keys(voce).every(k => d.includes(k)), `${J(Object.keys(voce))} in «${d}»`);
  const e = s.esito.description || '';
  verifica('l\'esito dice che annullata ed evasa (anche in parte) vengono anche dal portale', /annullata anche da sola/.test(e) && /evasa anche in parte/.test(e), e);
});

// ---------------------------------------------------------------------------
console.log('2. IL RICALCOLO DELLE RICHIESTE ECT DOPO LE PRIMARIE (importaBlocco, sul banco)');

let F = null;
await prova('importaBlocco si impacchetta', async () => { F = await caricaFunzione('importaBlocco'); });
const corpo = { azione: 'ritiri_ect', tipo_file: 'primarie' };
const vuoti = { PrimariaAci: [], AssegnatoAci: [], UploadLog: [] };

await prova('cancellato e poi riassegnato', async () => {
  if (!F) throw new Error('non impacchettata');
  let r = { id: 'r1', anno: 2026, pdr_nome: 'ROSSI GOMME', id_ordine_manuale: 'ET26000106', ordine_immesso_il: '2026-09-01', scadenza: '2026-11-30', esito: 'aperta' };
  const cancellato = { PrimariaRete: [{ id: 'p', id_ordine: 'ET26000106', stato: 'cancellato', motivo_cancellazione: 'altro: per errore', ordine_immesso_il: '2026-09-01T07:00:00Z' }], Assegnato: [] };
  const riassegnato = { PrimariaRete: [], Assegnato: [{ id: 'a', id_ordine: 'ET26000106', stato: 'assegnato', ordine_immesso_il: '2026-09-01T07:00:00Z' }] };
  const esiti = [];
  for (const [n, archivi] of [[1, cancellato], [2, riassegnato], [3, riassegnato]]) {
    const g = await chiama(F, { db: { ...vuoti, ...archivi, RichiestaEct: [r] }, corpo });
    r = g.db.RichiestaEct[0];
    esiti.push(`${n}:${r.esito}/${S.esitoDellaPagina(r, R.statoRichiesta)}`);
  }
  verifica('annullata dal caricamento che vede la cancellazione, di nuovo aperta da quello che vede l\'ordine riassegnato: salvata e a video uguali',
    esiti.join(' ') === '1:annullata/annullata 2:aperta/aperta 3:aperta/aperta', esiti.join(' '));
});

await prova('l\'esito salvato e\' gia\' quello giusto al primo caricamento', async () => {
  if (!F) throw new Error('non impacchettata');
  const richiesta = (extra = {}) => ({ id: 'r1', anno: 2026, pdr_nome: 'ROSSI GOMME', id_ordine: 'ET26000101', id_ordine_stato: 'trovato', ordine_immesso_il: '2026-09-01', scadenza: '2026-10-01', esito: 'aperta', ...extra });
  const db = (r) => ({
    ...vuoti,
    RichiestaEct: [r],
    PrimariaRete: [{ id: 'p1', id_ordine: 'ET26000101', stato: 'cancellato', motivo_cancellazione: 'altro: pdr doppio', ordine_immesso_il: '2026-09-01T07:00:00Z', punto_di_raccolta: 'ROSSI GOMME' }],
    Assegnato: [],
  });
  const r1 = (await chiama(F, { db: db(richiesta()), corpo })).db.RichiestaEct[0];
  const pagina = S.esitoDellaPagina(r1, R.statoRichiesta);
  verifica('salvata annullata come la dice la pagina', r1.esito === 'annullata' && pagina === 'annullata', `salvato ${r1.esito}, pagina ${pagina}`);
  const testo = S.testoCompletamentoRichiesta(S.completamentoRichiesta(r1, pagina));
  verifica('a video col giorno in cui il gestionale l\'ha vista cancellata', testo.startsWith('Annullata da sola il 15/10/2026:'), testo);
  const voci = J(C.cruscotto({ oggi: OGGI, anno: 2026, adessoMs: ADESSO, tipiFile: [], uploadLogs: [], alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], richiesteEct: [r1] }));
  verifica('la dashboard non la dice oltre il termine (scadenza 01/10/2026)', !/oltre il termine/.test(voci), (voci.match(/[^"]*oltre il termine[^"]*/g) || []).join(' | '));
  const vista = (await chiama(F, { db: db(richiesta({ ordini_stato_json: J([{ id_ordine: 'ET26000101', stato: 'cancellato', motivo: 'Pdr doppio', visto_il: '2026-10-12' }]) })), corpo })).db.RichiestaEct[0];
  verifica('il giorno in cui si era vista cancellata (12/10) resta dopo un caricamento delle primarie', /"visto_il":"2026-10-12"/.test(vista.ordini_stato_json || ''), vista.ordini_stato_json);
});

await prova('le altre richieste come prima', async () => {
  if (!F) throw new Error('non impacchettata');
  const db = {
    ...vuoti,
    RichiestaEct: [
      { id: 'f', anno: 2026, pdr_nome: 'GIALLI', id_ordine_manuale: 'ET26000101', motivo_annullamento: 'gia conferito', esito: 'annullata' },
      { id: 'e', anno: 2026, pdr_nome: 'VERDI', id_ordine_manuale: 'ET26000103', esito: 'evasa', evasione_rilevata_il: '2026-10-09', ordini_totali: 1, ordini_evasi: 1 },
      { id: 'a', anno: 2026, pdr_nome: 'BIANCHI', id_ordine_manuale: 'ET26000104', esito: 'aperta' },
    ],
    PrimariaRete: [
      { id: 'p1', id_ordine: 'ET26000101', stato: 'cancellato', motivo_cancellazione: 'pdr doppio' },
      { id: 'p3', id_ordine: 'ET26000103', stato: 'terminato', trasporto_iniziato_il: '2026-10-08T07:00:00Z', trasporto_finito_il: '2026-10-09T08:00:00Z' },
    ],
    Assegnato: [{ id: 'a4', id_ordine: 'ET26000104', stato: 'assegnato' }],
  };
  const g = await chiama(F, { db, corpo });
  const di = (id) => g.db.RichiestaEct.find(x => x.id === id);
  const toccate = (g.scritte || []).filter(s => s.entita === 'RichiestaEct').map(s => s.id);
  verifica('l\'annullata dal foglio e l\'evasa ritirata non si toccano, l\'aperta resta aperta',
    di('f').esito === 'annullata' && di('e').esito === 'evasa' && di('a').esito === 'aperta' && !toccate.includes('f') && !toccate.includes('e'), J(toccate));
  verifica('si ricalcola solo l\'aperta', g.j.controllate === 1, J(g.j));
});

// ---------------------------------------------------------------------------
console.log('3. LA DASHBOARD E LE RICHIESTE EVASE IN PARTE');

await prova('la voce delle richieste da rispondere', () => {
  const dati = (richieste) => ({ oggi: OGGI, anno: 2026, adessoMs: ADESSO, tipiFile: [], uploadLogs: [], alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], richiesteEct: richieste });
  const parte = { id: 'r3', pdr_nome: 'VERDI AUTO', id_ordine_manuale: 'ET26000103, ET26000101', ordini_totali: 2, ordini_evasi: 1,
    ordini_stato_json: J([{ id_ordine: 'ET26000103', stato: 'terminato', giorno: '2026-10-09' }, { id_ordine: 'ET26000101', stato: 'cancellato', motivo: 'Pdr doppio', visto_il: OGGI }]) };
  parte.esito = R.statoRichiesta(parte);
  const tutta = { id: 'r4', pdr_nome: 'BIANCHI', id_ordine_manuale: 'ET26000104', esito: 'evasa', evasione_rilevata_il: '2026-10-09', ordini_stato_json: J([{ id_ordine: 'ET26000104', stato: 'terminato', giorno: '2026-10-09' }]) };
  const dettaglio = (rr) => { const v = C.cruscotto(dati(rr)).da_gestire.find(x => x.chiave === 'ect:da-rispondere'); return v ? v.dettaglio : '(nessuna voce)'; };
  verifica('l\'evasa in parte e\' evasa e si chiude da sola', parte.esito === 'evasa' && R.evasaInParte(parte), parte.esito);
  const sola = dettaglio([parte]);
  verifica('sola: «e\' evasa in parte, un ordine risulta cancellato a portale»',
    sola === "Nessun suo ordine e' piu' da ritirare: e' evasa in parte, un ordine risulta cancellato a portale. Resta da rispondere alla mail e spuntarla.", sola);
  const insieme = dettaglio([parte, tutta]);
  verifica('con una ritirata: «una e\' evasa in parte ... le altre hanno gli ordini tutti ritirati»', /una e' evasa in parte \(qualche ordine risulta cancellato a portale\), le altre hanno gli ordini tutti ritirati/.test(insieme) && !/^Gli ordini risultano tutti ritirati/.test(insieme), insieme);
  verifica('le ritirate e basta come prima', /^Gli ordini risultano tutti ritirati: la richiesta e' evasa/.test(dettaglio([tutta])), dettaglio([tutta]));
});

// ---------------------------------------------------------------------------
console.log('4. L\'ELENCO DELLA TO-DO LIST CON LE SOLE CANCELLATE');

// Il componente vero, disegnato con React lato server come in prove/todoCompletati.mjs.
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (pp) => { const base = qui('../src/' + pp.slice(2)); return ESTENSIONI.map(e => base + e).find(x => existsSync(x) && /\.\w+$/.test(x)) || base; };
let L = null;
await prova('l\'elenco si impacchetta', async () => {
  const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import ElencoAttivita from ${J(qui('../src/components/todo/ElencoAttivita.jsx'))};
export const disegna = (props) => renderToStaticMarkup(React.createElement(ElencoAttivita, props));
`;
  const pacchetto = await build({
    stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.jsx': 'jsx', '.js': 'jsx' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'alias', setup(b) { b.onResolve({ filter: /^@\// }, (a) => ({ path: daAlias(a.path) })); } }],
  });
  L = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
});
const leggi = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
await prova('l\'elenco disegnato', () => {
  if (!L) throw new Error('non impacchettato');
  const canc = (id) => ({ id, titolo: 'Ritiro ' + id, stato: 'cancellato', chiusa_dal_gestionale: true, chiusa_dal_gestionale_il: OGGI, riferimento_ordine: 'ET26000101' });
  const sole = leggi(L.disegna({ todos: [canc('d'), canc('e')], filtro: 'tutti', isAdmin: true }));
  verifica('con sole cancellate non dice «Nessuna attività», dice dove sono', !/Nessuna attività\./.test(sole) && sole.includes('Niente da fare: le attività sono tutte fra le cancellate, le trovi qui sotto.'), sole.slice(0, 200));
  const miste = leggi(L.disegna({ todos: [canc('d'), { id: 'c', titolo: 'Fattura', stato: 'completato', completata_il: '2026-10-05' }], filtro: 'tutti', isAdmin: true }));
  verifica('con una completata e una cancellata: «tutte completate o cancellate»', miste.includes('Niente da fare: le attività sono tutte completate o cancellate, le trovi qui sotto.'), miste.slice(0, 200));
  const vuoto = leggi(L.disegna({ todos: [], filtro: 'tutti', isAdmin: true }));
  verifica('senza attivita\' come prima', vuoto.includes('Nessuna attività. Crea la prima col pulsante «Nuovo To-Do».'), vuoto.slice(0, 200));
  const inCorso = leggi(L.disegna({ todos: [{ id: 'a', titolo: 'A', stato: 'aperto' }], filtro: 'in_corso', isAdmin: true }));
  verifica('il filtro «in corso» come prima', inCorso.includes('Nessuna attività in corso.'), inCorso.slice(0, 200));
});

globalThis.Date = DataVera;
console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
