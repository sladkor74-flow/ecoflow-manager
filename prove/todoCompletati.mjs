// LA TO-DO LIST: I COMPLETATI NELLA LORO SEZIONE (12/10/2026).
//
// Richiesta dell'utente, testuale: «gli ordini della 'to-do list' quando sono
// completati vanno spostati nella sezione completati e non solo evidenziati come
// tali». Fino a quel giorno un'attivita' completata restava nell'elenco barrata
// e sbiadita, e una richiesta ECT evasa stava nella tabella delle aperte con la
// targhetta verde. Qui si controlla:
//
// 1. la divisione (src/lib/todoSezioni.js): un'attivita' completata - a mano o
//    dal controllo degli ordini (base44/shared/todoOrdini.ts, la stessa regola
//    che la chiude) - esce dai da fare, va fra i completati coi piu' recenti in
//    alto, col giorno e il perche', e torna fra i da fare se si riapre. Lo
//    stesso per le richieste ECT, con la regola di statoRichiesta;
// 2. i conteggi dicono solo i da fare;
// 3. il giorno della spunta a mano si scrive solo cambiando lo stato (lo fa
//    l'amministratore), si toglie riaprendo, e nient'altro si tocca;
// 4. le pagine vere, disegnate con React lato server: l'elenco da fare non ha
//    completati, la sezione e' chiusa all'apertura e ha il numero, la nota della
//    chiusura non si ripete, chi non e' amministratore non ha i pulsanti;
// 5. nel sorgente: all'apertura nessuna scrittura in piu', i filtri senza le
//    completate, niente larghezze fisse ne' title= nei componenti nuovi (375 px).
// npm run prove
import { build } from 'esbuild';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { controlloAttivita, statoOrdini } from '../base44/shared/todoOrdini.ts';
import { statoRichiesta } from '../base44/shared/richiesteEct.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const sorgente = (p) => (existsSync(qui('../' + p)) ? readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '') : '');

// Il modulo della divisione: col codice di prima non c'e', e la prova lo dice.
let S = null;
try { S = await import('../src/lib/todoSezioni.js'); } catch (e) { verifica('il modulo della divisione (src/lib/todoSezioni.js) si carica', false, String(e && e.message).slice(0, 200)); }
const f = (nome) => (S && typeof S[nome] === 'function' ? S[nome] : () => { throw new Error(`manca ${nome}`); });
const prova = (nome, fn) => { try { fn(); } catch (e) { verifica(nome, false, String(e && e.message).slice(0, 200)); } };

// ---------------------------------------------------------------------------
console.log('1. LE ATTIVITA\': DA FARE E COMPLETATE');

const NOTA_C = "chiusa dal gestionale il 28/09/2026: l'ordine ET26000003 risulta terminato, trasporto finito il 20/09/2026";
const TODOS = [
  { id: 'a', titolo: 'Sollecito Alfa', stato: 'aperto', created_date: '2026-10-10T08:00:00Z' },
  { id: 'b', titolo: 'Pratica Beta', stato: 'in_corso', created_date: '2026-10-09T08:00:00Z' },
  { id: 'c', titolo: 'Ritiro Gamma', stato: 'completato', riferimento_ordine: 'ET26000003', ordini_totali: 1, ordini_terminati: 1, chiusa_dal_gestionale: true, chiusa_dal_gestionale_il: '2026-09-28', chiusura_nota: NOTA_C, created_date: '2026-09-20T08:00:00Z', updated_date: '2026-10-11T08:00:00Z' },
  { id: 'd', titolo: 'Fattura Delta', stato: 'completato', completata_il: '2026-10-05', created_date: '2026-09-01T08:00:00Z' },
  { id: 'e', titolo: 'Vecchia Epsilon', stato: 'completato', created_date: '2026-08-01T08:00:00Z' },
  { id: 'f', titolo: 'Riaperta Zeta', stato: 'aperto', chiusa_dal_gestionale: true, chiusa_dal_gestionale_il: '2026-09-25', chiusura_nota: 'chiusa dal gestionale il 25/09/2026: l\'ordine ET26000009 risulta terminato', created_date: '2026-09-10T08:00:00Z' },
  { id: 'g', titolo: 'Rispuntata Eta', stato: 'completato', chiusa_dal_gestionale: true, chiusa_dal_gestionale_il: '2026-09-28', chiusura_nota: 'chiusa dal gestionale il 28/09/2026: l\'ordine ET26000011 risulta terminato', completata_il: '2026-10-02', created_date: '2026-09-11T08:00:00Z' },
];
const ids = (xs) => xs.map(t => t.id).join('');

prova('la divisione delle attivita', () => {
  const { daFare, completati } = f('dividiAttivita')(TODOS);
  verifica('i da fare sono aperte e in corso, anche una riaperta a mano, nell\'ordine in cui arrivano', ids(daFare) === 'abf', ids(daFare));
  verifica('i completati, dai piu\' recenti: 05/10 a mano, 02/10 rispuntata, 28/09 dal gestionale, poi chi non ha il giorno', ids(completati) === 'dgce', ids(completati));
  verifica('niente si perde e niente sta in due posti', daFare.length + completati.length === TODOS.length && !daFare.some(t => completati.includes(t)));
});
prova('i conteggi', () => {
  verifica('i numeri della pagina dicono solo i da fare: 3 da fare, 2 aperti, 1 in corso (le completate a parte: 4)',
    J(f('conteggiAttivita')(TODOS)) === J({ da_fare: 3, aperto: 2, in_corso: 1, completati: 4 }), J(f('conteggiAttivita')(TODOS)));
  const { daFare } = f('dividiAttivita')(TODOS);
  verifica('i filtri dei da fare: tutti, aperti, in corso', ids(f('daFareDelFiltro')(daFare, 'tutti')) === 'abf'
    && ids(f('daFareDelFiltro')(daFare, 'aperto')) === 'af' && ids(f('daFareDelFiltro')(daFare, 'in_corso')) === 'b');
});
prova('il giorno e il perche', () => {
  const T = (id) => TODOS.find(t => t.id === id);
  const testo = (id) => f('testoCompletamento')(f('completamentoAttivita')(T(id)));
  verifica('chiusa dal gestionale: il suo giorno e il suo perche\', il giorno detto una volta',
    testo('c') === "Completata il 28/09/2026 dal gestionale: l'ordine ET26000003 risulta terminato, trasporto finito il 20/09/2026.", testo('c'));
  verifica('spuntata a mano col giorno della spunta', testo('d') === 'Completata il 05/10/2026, spuntata a mano.', testo('d'));
  verifica('una spunta di prima non ha il giorno, e lo dice invece di inventarlo', /^Completata, spuntata a mano: il giorno non è registrato/.test(testo('e')), testo('e'));
  verifica('chiusa dal gestionale, riaperta e rispuntata: vale la spunta, e la prima chiusura resta scritta',
    testo('g') === "Completata il 02/10/2026, spuntata a mano. Il gestionale l’aveva chiusa una prima volta (chiusa dal gestionale il 28/09/2026: l'ordine ET26000011 risulta terminato).", testo('g'));
  verifica('un\'attivita\' da fare non ha completamento', f('completamentoAttivita')(T('a')) === null && f('completamentoAttivita')(T('f')) === null);
  verifica('l\'ultima modifica non e\' il giorno della spunta (il controllo degli ordini riscrive anche le chiuse)',
    f('completamentoAttivita')({ stato: 'completato', updated_date: '2026-10-11T08:00:00Z' }).giorno === null);
});

console.log('2. LA SPUNTA A MANO SCRIVE IL SUO GIORNO, LA RIAPERTURA LO TOGLIE');
prova('i campi del cambio di stato', () => {
  const c = f('campiCambioStato');
  verifica('completare scrive lo stato e il giorno italiano', J(c({ stato: 'aperto' }, 'completato', '2026-10-12')) === J({ stato: 'completato', completata_il: '2026-10-12' }));
  verifica('anche dalla targhetta, da in corso', J(c({ stato: 'in_corso' }, 'completato', '2026-10-12')) === J({ stato: 'completato', completata_il: '2026-10-12' }));
  verifica('riaprire toglie il giorno (null, non vuoto)', J(c({ stato: 'completato', completata_il: '2026-10-05' }, 'aperto', '2026-10-12')) === J({ stato: 'aperto', completata_il: null }));
  verifica('fra aperta e in corso cambia solo lo stato', J(c({ stato: 'aperto' }, 'in_corso', '2026-10-12')) === J({ stato: 'in_corso' }));
  const g = TODOS.find(t => t.id === 'g');
  const campi = c(g, 'aperto', '2026-10-12');
  verifica('la nota e il segno di una chiusura del gestionale non si toccano', !('chiusura_nota' in campi) && !('chiusa_dal_gestionale' in campi) && !('chiusa_dal_gestionale_il' in campi), J(campi));
  // Chi riapre torna fra i da fare, chi spunta va fra i completati.
  const dopo = TODOS.map(t => (t.id === 'd' ? { ...t, ...c(t, 'aperto', '2026-10-12') } : t.id === 'a' ? { ...t, ...c(t, 'completato', '2026-10-12') } : t));
  const { daFare, completati } = f('dividiAttivita')(dopo);
  verifica('riaperta: torna fra i da fare', daFare.some(t => t.id === 'd') && !completati.some(t => t.id === 'd'));
  verifica('spuntata oggi: in cima ai completati', completati[0] && completati[0].id === 'a' && f('testoCompletamento')(f('completamentoAttivita')(completati[0])) === 'Completata il 12/10/2026, spuntata a mano.', ids(completati));
});

prova('chiusa da sola dal controllo degli ordini', () => {
  // La stessa regola che la chiude (todoOrdini.ts): il primo giro guarda, il
  // secondo vede il passaggio a terminato e chiude. La divisione non rifa'
  // niente: legge quello che il controllo ha scritto.
  const todo = { id: 'h', titolo: 'Ritiro Theta', stato: 'aperto', riferimento_ordine: 'ET26000020' };
  const prima = statoOrdini([], [{ id_ordine: 'ET26000020' }]);
  const giro1 = { ...todo, ...controlloAttivita(todo, prima, '2026-10-01').campi };
  const dopo = statoOrdini([{ id_ordine: 'ET26000020', stato: 'terminato', ordine_immesso_il: '2026-10-01T08:00:00Z', trasporto_iniziato_il: '2026-10-07T08:00:00Z', trasporto_finito_il: '2026-10-07T22:30:00Z', ordine_chiuso_il: '2026-10-10T08:00:00Z' }], []);
  const r2 = controlloAttivita(giro1, dopo, '2026-10-12');
  verifica('il controllo la chiude', r2.chiusa === true);
  const chiusa = { ...giro1, ...r2.campi };
  const { daFare, completati } = f('dividiAttivita')([chiusa, { id: 'a', titolo: 'x', stato: 'aperto' }]);
  verifica('e lei esce dai da fare ed entra fra i completati', ids(daFare) === 'a' && ids(completati) === 'h');
  verifica('col giorno della chiusura e il ritiro alla fine trasporto italiana (08/10, non la chiusura a portale del 10/10)',
    f('testoCompletamento')(f('completamentoAttivita')(chiusa)) === "Completata il 12/10/2026 dal gestionale: l'ordine ET26000020 risulta terminato, trasporto finito il 08/10/2026.",
    f('testoCompletamento')(f('completamentoAttivita')(chiusa)));
});

// ---------------------------------------------------------------------------
console.log('3. LE RICHIESTE ECT: DA RITIRARE E COMPLETATE');
const RICHIESTE = [
  { id: 'r1', pdr_nome: 'GOMME UNO', esito: 'aperta', mail_inviata_il: '2026-10-01', scadenza: '2026-10-20', id_ordine: 'ET26000101' },
  { id: 'r2', pdr_nome: 'GOMME DUE', esito: 'evasa', evasione_rilevata_il: '2026-10-01', ordini_totali: 1, id_ordine: 'ET26000102', mail_inviata_il: '2026-09-20' },
  { id: 'r3', pdr_nome: 'GOMME TRE', esito: 'evasa', evaso_il: '2026-10-05', evasione_confermata: true, evasione_confermata_il: '2026-10-06', id_ordine: 'ET26000103', mail_inviata_il: '2026-09-21' },
  { id: 'r4', pdr_nome: 'GOMME QUATTRO', esito: 'annullata', motivo_annullamento: 'il produttore ha gia\' conferito', mail_inviata_il: '2026-09-22' },
  { id: 'r5', pdr_nome: 'GOMME CINQUE', esito: 'da_confermare', evasione_rilevata_il: '2026-09-20', ordini_totali: 2, id_ordine_manuale: 'ET26000105, ET26000106', mail_inviata_il: '2026-09-10' },
  { id: 'r6', pdr_nome: 'GOMME SEI', esito: 'evasa', evasione_confermata: true, evasione_confermata_il: '2026-10-03', mail_inviata_il: '2026-09-25' },
  { id: 'r7', pdr_nome: 'GOMME SETTE', mail_inviata_il: '2026-10-02' },
];
let esitoDi = (r) => r.esito;
prova('l\'esito della pagina', () => {
  esitoDi = (r) => f('esitoDellaPagina')(r, statoRichiesta);
  verifica('vale quello salvato', esitoDi(RICHIESTE[0]) === 'aperta' && esitoDi(RICHIESTE[1]) === 'evasa' && esitoDi(RICHIESTE[3]) === 'annullata');
  verifica('il «da confermare» di prima del 29/09: col ritiro rilevato, per la regola di oggi e\' evasa', esitoDi(RICHIESTE[4]) === 'evasa');
  verifica('senza esito salvato vale statoRichiesta', esitoDi(RICHIESTE[6]) === 'aperta' && esitoDi({ motivo_annullamento: 'x' }) === 'annullata');
});
prova('la divisione delle richieste', () => {
  const { daFare, completate } = f('dividiRichieste')(RICHIESTE, esitoDi);
  verifica('da ritirare solo le aperte', ids(daFare) === 'r1r7', ids(daFare));
  verifica('completate dai ritiri piu\' recenti: 05/10, 03/10 (spunta, senza ritiro), 01/10, 20/09, l\'annullata in fondo', ids(completate) === 'r3r6r2r5r4', ids(completate));
  const C = (id) => { const r = RICHIESTE.find(x => x.id === id); return f('completamentoRichiesta')(r, esitoDi(r)); };
  const T = (id) => f('testoCompletamentoRichiesta')(C(id));
  verifica('chiusa da sola: il ritiro alla fine trasporto, il giorno una volta', T('r2') === 'Completata da sola: l’ordine risulta terminato, ritiro del 01/10/2026.', T('r2'));
  verifica('con piu\' ordini, al plurale', T('r5') === 'Completata da sola: gli ordini risultano terminati, ritiro del 20/09/2026.', T('r5'));
  verifica('dal foglio delle richieste', T('r3') === 'Completata: evasa secondo il foglio delle richieste, ritiro del 05/10/2026.', T('r3'));
  verifica('spuntata a mano senza ritiro: il giorno della spunta', T('r6') === 'Completata il 03/10/2026, spuntata a mano.', T('r6'));
  verifica('annullata: il motivo', T('r4') === "Annullata: il produttore ha gia' conferito.", T('r4'));
  verifica('da rispondere al consorzio: le evase senza spunta (r2, r5), come la voce della dashboard', C('r2').da_rispondere && C('r5').da_rispondere && !C('r3').da_rispondere && !C('r6').da_rispondere && !C('r4').da_rispondere);
  verifica('una da ritirare non ha completamento', C('r1') === null);
  // La spunta tolta: chi era chiusa solo dalla spunta torna da ritirare, chi ha
  // il ritiro rilevato resta completata (e torna «da rispondere»).
  const togli = (r) => { const campi = { evasione_confermata: false, evasione_confermata_il: '' }; return { ...r, ...campi, esito: statoRichiesta({ ...r, ...campi }) }; };
  const dopo = RICHIESTE.map(r => (r.id === 'r6' || r.id === 'r3' ? togli(r) : r));
  const d2 = f('dividiRichieste')(dopo, esitoDi);
  verifica('tolta la spunta, la spuntata a mano senza ritiro torna da ritirare', d2.daFare.some(r => r.id === 'r6') && !d2.completate.some(r => r.id === 'r6'));
  verifica('e quella col ritiro resta fra le completate, da rispondere', d2.completate.some(r => r.id === 'r3') && f('completamentoRichiesta')(dopo.find(r => r.id === 'r3'), 'evasa').da_rispondere === true);
  // L'ordine segue il giorno che la scheda mostra: con il ritiro rilevato dai
  // terminati (la fine trasporto) e il foglio che dice un altro giorno, conta il
  // ritiro (revisione, 13/10/2026). A: foglio 01/10, ritiro 08/10; B: ritiro 05/10.
  const rA = { id: 'oA', esito: 'evasa', evaso_il: '2026-10-01', evasione_rilevata_il: '2026-10-08', evasione_confermata: true, evasione_confermata_il: '2026-10-09', ordini_totali: 1 };
  const rB = { id: 'oB', esito: 'evasa', evasione_rilevata_il: '2026-10-05', evasione_confermata: true, evasione_confermata_il: '2026-10-06', ordini_totali: 1 };
  const ordinate = f('dividiRichieste')([rB, rA], (r) => r.esito).completate.map(r => r.id);
  verifica('i ritiri più recenti in alto, sul giorno che la scheda scrive', ordinate.join(',') === 'oA,oB', ordinate.join(','));
});

// ---------------------------------------------------------------------------
console.log('4. LE PAGINE VERE, DISEGNATE');
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(x => existsSync(x) && /\.\w+$/.test(x)) || base; };
const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import ElencoAttivita from ${JSON.stringify(qui('../src/components/todo/ElencoAttivita.jsx'))};
import RichiesteCompletate from ${JSON.stringify(qui('../src/components/todo/RichiesteCompletate.jsx'))};
const C = { ElencoAttivita, RichiesteCompletate };
export const disegna = (nome, props) => renderToStaticMarkup(React.createElement(C[nome], props));
`;
let L = null;
try {
  const pacchetto = await build({
    stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.jsx': 'jsx', '.js': 'jsx' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'alias', setup(b) { b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) })); } }],
  });
  L = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
} catch (e) { verifica('l\'elenco delle attivita\' e la sezione delle richieste completate si impacchettano', false, String(e && e.message).slice(0, 300)); }
const disegna = (nome, props) => { try { return L ? L.disegna(nome, props) : ''; } catch (e) { verifica(`${nome} si disegna`, false, String(e && e.message).slice(0, 300)); return ''; } };
const testo = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');
const niente = () => {};
const azioni = { onSpunta: niente, onCiclo: niente, onElimina: niente, onSalvaOrdine: niente };

const html = disegna('ElencoAttivita', { todos: TODOS, filtro: 'tutti', isAdmin: true, ...azioni });
const [sopra = '', sotto = ''] = html.split(/<details/);
verifica('la pagina delle attivita\' ha la sezione dei completati', html.includes('<details') && html.includes('data-sezione="completati"'), html.slice(0, 200));
verifica('chiusa all\'apertura: il <details> non ha open', /<details(?![^>]*\bopen\b)[^>]*data-sezione="completati"/.test(html), (html.match(/<details[^>]*>/) || [''])[0]);
verifica('col numero: «Completati (4)»', testo(sotto).includes('Completati (4)'), testo(sotto).slice(0, 120));
verifica('l\'elenco da fare ha le tre da fare e nessuna completata', ['Sollecito Alfa', 'Pratica Beta', 'Riaperta Zeta'].every(t => sopra.includes(t))
  && !['Ritiro Gamma', 'Fattura Delta', 'Vecchia Epsilon', 'Rispuntata Eta'].some(t => sopra.includes(t)), testo(sopra).slice(0, 300));
verifica('niente righe barrate o sbiadite fra i da fare', !/line-through|opacity-60/.test(sopra));
const pos = ['Fattura Delta', 'Rispuntata Eta', 'Ritiro Gamma', 'Vecchia Epsilon'].map(t => sotto.indexOf(t));
verifica('nella sezione, dai piu\' recenti', pos.every(p => p >= 0) && pos.every((p, i) => i === 0 || p > pos[i - 1]), J(pos));
verifica('col giorno e il perche\'', testo(sotto).includes("Completata il 28/09/2026 dal gestionale: l'ordine ET26000003 risulta terminato, trasporto finito il 20/09/2026.")
  && testo(sotto).includes('Completata il 05/10/2026, spuntata a mano.'), testo(sotto).slice(0, 600));
verifica('la nota della chiusura si legge una volta sola', testo(html).split('ET26000003 risulta terminato').length === 2, String(testo(html).split('ET26000003 risulta terminato').length - 1));
verifica('la riaperta a mano dice ancora che il gestionale l\'aveva chiusa', testo(sopra).includes('riaperta a mano: il gestionale l’aveva chiusa'));
verifica('l\'amministratore riapre dalla sezione', /Riapri/.test(testo(sotto)));
const soloAperti = disegna('ElencoAttivita', { todos: TODOS, filtro: 'aperto', isAdmin: true, ...azioni }).split(/<details/)[0];
verifica('il filtro «Aperti» non ha le in corso, ne\' le completate', soloAperti.includes('Sollecito Alfa') && !soloAperti.includes('Pratica Beta') && !soloAperti.includes('Fattura Delta'));
const lettore = disegna('ElencoAttivita', { todos: TODOS, filtro: 'tutti', isAdmin: false, ...azioni });
verifica('chi non e\' amministratore non ha Riapri ne\' Elimina, e la spunta e\' spenta', !/Riapri</.test(lettore) && !/aria-label="Elimina"/.test(lettore) && /disabled=""[^>]*aria-label="Riapri/.test(lettore), '');
const tutteFatte = testo(disegna('ElencoAttivita', { todos: TODOS.filter(t => t.stato === 'completato'), filtro: 'tutti', isAdmin: true, ...azioni }));
verifica('tutte completate: l\'elenco lo dice e rimanda alla sezione', tutteFatte.includes('Niente da fare: le attività sono tutte completate, le trovi qui sotto.'), tutteFatte.slice(0, 200));
const vuota = testo(disegna('ElencoAttivita', { todos: [], filtro: 'tutti', isAdmin: false, ...azioni }));
verifica('senza attivita\' la sezione c\'e\' lo stesso, col suo zero', vuota.includes('Completati (0)') && vuota.includes('Nessuna attività.'), vuota);

const { completate } = S ? f('dividiRichieste')(RICHIESTE, esitoDi) : { completate: [] };
const hr = disegna('RichiesteCompletate', { tutte: completate, righe: completate, esitoDi, isAdmin: true, occupato: null, onSpunta: niente });
const tr = testo(hr);
verifica('le richieste completate: chiusa all\'apertura, col numero', /<details(?![^>]*\bopen\b)/.test(hr) && tr.includes('Completate (5)'), tr.slice(0, 200));
verifica('sull\'intestazione quelle che aspettano la risposta al consorzio, visibili anche da chiusa', /<summary[\s\S]*2 aspettano la risposta al consorzio[\s\S]*<\/summary>/.test(hr), tr.slice(0, 200));
const posR = ['GOMME TRE', 'GOMME SEI', 'GOMME DUE', 'GOMME CINQUE', 'GOMME QUATTRO'].map(t => hr.indexOf(t));
verifica('dai ritiri piu\' recenti, le annullate in fondo', posR.every(p => p >= 0) && posR.every((p, i) => i === 0 || p > posR[i - 1]), J(posR));
verifica('col giorno e il perche\'', tr.includes('Completata da sola: l’ordine risulta terminato, ritiro del 01/10/2026.') && tr.includes("Annullata: il produttore ha gia' conferito."));
verifica('la spunta si mette da qui (amministratore), non sull\'annullata', (hr.match(/>spunta</g) || []).length === 2 && (hr.match(/>spuntata</g) || []).length === 2, `${(hr.match(/>spunta</g) || []).length} ${(hr.match(/>spuntata</g) || []).length}`);
const hrLettore = disegna('RichiesteCompletate', { tutte: completate, righe: completate, esitoDi, isAdmin: false });
verifica('chi non e\' amministratore non ha la spunta', !/>spunta</.test(hrLettore) && !/>spuntata</.test(hrLettore));
const cercata = testo(disegna('RichiesteCompletate', { tutte: completate, righe: completate.slice(0, 1), esitoDi, isAdmin: true }));
verifica('con la ricerca: «Completate (1 di 5)», e la nota conta tutte', cercata.includes('Completate (1 di 5)') && cercata.includes('2 aspettano'), cercata.slice(0, 160));

// ---------------------------------------------------------------------------
console.log('5. NEL SORGENTE');
const pagina = sorgente('src/pages/TodoPage.jsx');
const ect = sorgente('src/components/todo/RichiesteEct.jsx');
const senzaCommenti = (x) => x.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const p = senzaCommenti(pagina), e = senzaCommenti(ect);
verifica('la pagina conta con conteggiAttivita e disegna con ElencoAttivita', /conteggiAttivita\(todos\)/.test(p) && /<ElencoAttivita/.test(p));
verifica('nessun filtro «Completati» fra i da fare, e nessun «Tutti» che conti tutto', !/setFilterStato\('completato'\)|\['completato'|todos\.length\)/.test(p) && !/Tutti \(\{todos\.length\}\)/.test(p));
verifica('il cambio di stato passa da campiCambioStato, e solo per l\'amministratore', /Todo\.update\(todo\.id, campiCambioStato\(todo, next, oggiRoma\(\)\)\)/.test(p)
  && /const cambiaStato = async \(todo, next\) => \{\s*if \(!isAdmin\) return;/.test(p) && !/Todo\.update\(todo\.id, \{ stato: next \}\)/.test(p));
verifica('all\'apertura nessuna scrittura in piu\': due effetti, la lettura e il controllo degli ordini di sempre', (p.match(/useEffect\(/g) || []).length === 2
  && /useEffect\(\(\) => \{ load\(\); \}, \[load\]\);/.test(p) && /useEffect\(\(\) => \{ controllaOrdini\(\); \}, \[controllaOrdini\]\);/.test(p)
  && J([...p.matchAll(/functions\.invoke\('([^']+)'/g)].map(m => m[1])) === J(['controllaTodoOrdini']));
verifica('le richieste: la tabella e i numeri vengono dalle da fare', /dividiRichieste\(righe, esitoDi\)/.test(e) && /let v = daFare;/.test(e) && /da_fare: daFare\.length/.test(e) && /<RichiesteCompletate/.test(e));
verifica('fra i filtri delle richieste non ci sono piu\' le chiuse ne\' «Tutte»', !/\['chiuse'|\['tutte'|'Chiuse'|'Tutte'/.test(e));
verifica('e l\'apertura delle richieste fa le stesse chiamate di prima', (e.match(/useEffect\(/g) || []).length === 2
  && J([...e.matchAll(/functions\.invoke\('([^']+)'/g)].map(m => m[1])) === J(['importaBlocco', 'importaRichiesteEct']));
const NUOVI = ['src/components/todo/ElencoAttivita.jsx', 'src/components/todo/RichiesteCompletate.jsx', 'src/components/todo/SezioneCompletati.jsx'];
const nuovi = NUOVI.map(x => [x, sorgente(x)]);
verifica('i componenti nuovi ci sono', nuovi.every(([, s]) => s.length > 0), nuovi.filter(([, s]) => !s).map(([x]) => x).join());
verifica('a 375 px: nessuna larghezza fissa nei componenti nuovi', nuovi.every(([, s]) => !/\b(?:min-)?w-(?:\d{2,}|\[\d+px\])\b|min-w-\[/.test(s)), nuovi.filter(([, s]) => /\b(?:min-)?w-(?:\d{2,}|\[\d+px\])\b|min-w-\[/.test(s)).map(([x]) => x).join());
verifica('niente title= per spiegare (sul telefono non si vede)', nuovi.every(([, s]) => !/\stitle=/.test(s)));
// A video: i percorsi nei commenti non si vedono, i testi disegnati si'.
verifica('nessuna parola della piattaforma a video', [html, lettore, hr, hrLettore].every(s => s && !/base44/i.test(testo(s))));

// Il giorno di ricezione di un'attività nuova è il giorno italiano: toISOString
// è UTC e fra mezzanotte e l'una (le due d'estate) scriveva il giorno prima.
{
  const pagina = sorgente('src/pages/TodoPage.jsx');
  verifica('attività nuova: data_ricezione è il giorno italiano', /data_ricezione: oggiRoma\(\)/.test(pagina) && !/data_ricezione: new Date\(\)\.toISOString/.test(pagina));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
