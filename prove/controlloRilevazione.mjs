// Prova di come la pagina Giacenze MOSTRA i due controlli della rilevazione
// (23/09/2026). I conti stanno in base44/shared/giacenzaStoccaggi.ts e hanno la
// loro prova (prove/giacenzaStoccaggi.mjs): qui si verifica che le parole a
// video dicano la cosa giusta, perche' e' li' che l'errore del 16/09 si sarebbe
// visto.
//
// Due pezzi:
//   - src/components/giacenze/ControlloRilevazione.jsx, il confronto che compare
//     appena si salva una rilevazione: per ogni classe che si scosta attesa,
//     letta, scarto e gli ordini candidati a spiegarlo;
//   - src/components/giacenze/SituazioneTable.jsx, la somma dei soli movimenti in
//     archivio accanto alla giacenza del piazzale, che NON e' una giacenza e
//     quando esce sotto zero deve dirlo.
//
// I componenti sono JSX: si impacchettano con esbuild (quello di vite, gia' fra
// i pacchetti) e si chiamano solo le funzioni, non il JSX.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { movimentoStoccaggio, verificaRilevazione, saldoMovimentiInArchivio } from '../base44/shared/giacenzaStoccaggi.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// --- l'impacchettamento: react, le icone e i componenti grafici non servono
// (le prove chiamano i conti, non il JSX); @/lib/utils invece e' quello vero,
// perche' i formati - kg interi, tonnellate a due decimali - fanno parte di
// quello che si sta provando.
const vuoto = {
  name: 'senza-grafica',
  setup(b) {
    b.onResolve({ filter: /^react(\/|$)|^lucide-react$|^@\/components\/ui\/|DateDaSistemare$|^clsx$|^tailwind-merge$/ }, () => ({ path: 'vuoto', namespace: 'stub' }));
    b.onResolve({ filter: /^@\/lib\// }, (a) => ({ path: qui('../src/lib/' + a.path.replace('@/lib/', '') + '.js') }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'module.exports = {};', loader: 'js' }));
  },
};
const impacchetta = async (file) => {
  const r = await build({
    entryPoints: [qui(file)], bundle: true, write: false, format: 'esm', platform: 'neutral',
    loader: { '.jsx': 'jsx' }, jsx: 'transform', logLevel: 'silent', plugins: [vuoto],
  });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
};
// utils legge window a caricamento (isIframe): qui basta che esista.
globalThis.window = globalThis.window || { self: 1, top: 1 };

const controllo = await impacchetta('../src/components/giacenze/ControlloRilevazione.jsx');
const situazione = await impacchetta('../src/components/giacenze/SituazioneTable.jsx');
const { riassuntoVerifica, rigaClasse, dettaglioClasse, rigaCandidato, esitoBreve } = controllo;
const { riassuntoArchivio } = situazione;

// --- il caso vero di NAPPI SUD: la rilevazione del 16/09 con 6.160 kg nella
// classe sbagliata. Erano del formulario ET26138377, classe M, arrivato il 15/09
// e chiuso a portale il 18: il portale li mostrava ancora in P.
const m = (id, kg, finito, chiuso, { canale = 'RETE', verso = 'ingresso', classe = 'P', controparte = 'C.L. Service' } = {}) =>
  movimentoStoccaggio({ id_ordine: id, peso_effettivo: kg, trasporto_finito_il: finito, ordine_chiuso_il: chiuso }, { canale, verso, classe, controparte });

const rilev13 = { data_rilevazione: '2026-09-13', class1_kg: 19739, class2_kg: 19449, class3_kg: 350, class4_kg: 0, class9_kg: 0 };
const rilev16 = { data_rilevazione: '2026-09-16', class1_kg: 21400, class2_kg: 22310, class3_kg: 350, class4_kg: 0, class9_kg: 0 };
const movimenti = [
  m('SEC00412', 4499, '2026-09-14T09:00:00Z', '2026-09-14T18:00:00Z', { verso: 'uscita', controparte: 'Irigom' }),
  m('ET26137000', 2861, '2026-09-14T07:00:00Z', '2026-09-15T10:00:00Z', { classe: 'M' }),
  m('ET26138377', 6160, '2026-09-15T10:00:00Z', '2026-09-18T09:00:00Z', { classe: 'M', controparte: 'Nappi Sud' }),
];
const storta = verificaRilevazione(rilev16, rilev13, movimenti);

console.log('IL CONFRONTO APPENA SI SALVA: CHE COSA SI LEGGE');
const r = riassuntoVerifica(storta);
verifica('dice che si scostano, e quali classi', r.stato === 'scosta' && r.titolo === 'Si scostano le classi P, M', r.titolo);
verifica('dice da che cosa si parte e con che cosa si confronta', r.sintesi.startsWith('Rilevazione del 16/09/2026, confrontata con quella del 13/09/2026 piu\' i movimenti del periodo'), r.sintesi);
verifica('dice la cosa che indirizza la ricerca: il totale torna, la ripartizione no', r.sintesi.includes("Il totale della rete torna: a sbagliare e' la ripartizione fra le classi."), r.sintesi);

const emme = r.scostano.find(c => c.classe === 'M');
const pi = r.scostano.find(c => c.classe === 'P');
verifica('la classe M: attesa 28.470, letta 22.310, 6.160 kg di scarto', rigaClasse(emme) === 'Classe M: attesa 28.470 kg, letta 22.310 kg, scarto -6.160 kg.', rigaClasse(emme));
verifica('e la P lo stesso scarto dall\'altra parte, col segno', rigaClasse(pi) === 'Classe P: attesa 15.240 kg, letta 21.400 kg, scarto +6.160 kg.', rigaClasse(pi));
verifica('da dove viene l\'attesa: la rilevazione prima, piu\' gli ingressi meno le uscite',
  dettaglioClasse(emme, storta.precedente_del) === "Il 13/09/2026 erano 19.449 kg; nel periodo 2 ingressi per 9.021 kg e 0 uscite per 0 kg.", dettaglioClasse(emme, storta.precedente_del));
verifica('lo scarto della P viene da una sola uscita', dettaglioClasse(pi, storta.precedente_del).includes('1 uscita per 4.499 kg'), dettaglioClasse(pi, storta.precedente_del));

const candidato = emme.candidati.find(c => c.id_ordine === 'ET26138377');
const riga = rigaCandidato(candidato);
verifica('l\'ordine candidato c\'e\', ed e\' quello vero', !!candidato && candidato.peso_esatto === true);
verifica('la sua riga dice ordine, da chi, classe, kg, fine trasporto e chiusura a portale',
  riga.startsWith('ET26138377 · da Nappi Sud · classe M · 6.160 kg · finito il 15/09/2026 · chiuso a portale il 18/09/2026 — '), riga);
verifica('e dice perche\' e\' candidato', riga.includes("il suo peso, da solo, fa lo scarto"), riga);

console.log('L\'ESITO IN DUE PAROLE, PER LA RIGA DELL\'ELENCO');
verifica('quando si scosta porta classe e scarto', esitoBreve(storta).testo === 'P +6.160 kg · M -6.160 kg', esitoBreve(storta).testo);

const giusta = verificaRilevazione({ ...rilev16, class1_kg: 15240, class2_kg: 28470 }, rilev13, movimenti);
const rOk = riassuntoVerifica(giusta);
verifica('una rilevazione che torna lo dice, senza allarmare', rOk.stato === 'quadra' && rOk.scostano.length === 0 && rOk.sintesi.endsWith('ogni classe legge quello che i movimenti dicono.'), rOk.sintesi);
verifica('e in due parole e\' "quadra"', esitoBreve(giusta).testo === 'quadra');

const prima = riassuntoVerifica(verificaRilevazione(rilev16, null, movimenti));
verifica('senza una rilevazione prima non si dice che quadra: non si inventa nulla', prima.stato === 'senza_precedente' && !prima.sintesi.includes('quadra'), prima.sintesi);
verifica('e si spiega perche\' non c\'e\' confronto', prima.sintesi.includes("non c'e' una rilevazione precedente da cui partire"), prima.sintesi);
verifica('senza verifica non si mostra niente', riassuntoVerifica(null) === null && esitoBreve(null) === null);

console.log('LA SOMMA DEI SOLI MOVIMENTI IN ARCHIVIO: NON E\' UNA GIACENZA');
// Come su Nappi Sud: l'archivio comincia nel 2024 e non arriva a quando il
// piazzale era vuoto, percio' la somma esce sotto zero.
const storia = saldoMovimentiInArchivio([
  m('ET24000001', 1000, '2024-01-12T08:00:00Z', ''),
  m('SEC00999', 62420, '2026-09-20T08:00:00Z', '', { verso: 'uscita', controparte: 'Irigom' }),
  m('EA26000001', 2500, '2026-05-04T08:00:00Z', '', { canale: 'ACI', classe: 'ACI' }),
  m('ET26000099', 800, null, '2026-09-21T08:00:00Z'),
]);
const rete = riassuntoArchivio(storia, 'RETE');
verifica('si legge da quando conta e quanto fa', rete.riga === 'dai soli movimenti in archivio dal 12/01/2024: -61,42 t', rete.riga);
verifica('quanti movimenti sono e fino a quando', rete.dettaglio === '2 movimenti fino al 20/09/2026: 1 ingressi per 1.000 kg, 1 uscite per 62.420 kg.', rete.dettaglio);
verifica('sotto zero si dice perche\', e che non e\' una giacenza',
  rete.negativo === true && rete.avvertenza.includes("l'archivio non arriva a quando il piazzale era vuoto") && rete.avvertenza.includes("non e' una giacenza"), rete.avvertenza);
verifica('i movimenti senza fine trasporto restano fuori e si contano a parte', rete.senza_fine === 1 && rete.movimenti === 2);
verifica('l\'ACI ha la sua somma e non si somma alla rete', riassuntoArchivio(storia, 'ACI').kg === 2500 && rete.kg === -61420);
verifica('un canale senza movimenti non si mostra affatto', riassuntoArchivio(storia, 'EXTRA_RACCOLTA') === null && riassuntoArchivio(null) === null);

const positiva = riassuntoArchivio(saldoMovimentiInArchivio([m('ET26000500', 7500, '2026-03-02T08:00:00Z', '')]), 'RETE');
verifica('anche sopra zero si dice che non e\' una giacenza e da quando vale',
  positiva.negativo === false && positiva.avvertenza.includes('Vale dal 02/03/2026') && positiva.avvertenza.includes("Non e' una giacenza"), positiva.avvertenza);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
