// Esercitazione per l'esame di responsabile tecnico gestione rifiuti.
//
// Le banche dati sono i quiz ufficiali dell'Albo Nazionale Gestori Ambientali
// (Delibera n. 6 del 26/11/2025, quiz pubblicati il 19/12/2025), estratti dai
// PDF e salvati in src/data/quiz-rt: la risposta esatta e' sempre la prima.
//
// Regole d'esame della Delibera 6/2025:
// - verifica iniziale: modulo generale piu' un modulo specialistico, 40 quiz
//   ciascuno in 60 minuti, soglia 32 punti nel generale e 34 nello specialistico;
// - verifica di aggiornamento: solo il modulo specialistico, che contiene anche
//   quiz generali, 40 quiz in 60 minuti, soglia 28 punti;
// - +1 per risposta esatta, -0,5 per errata, 0 per non data.

export const VERSIONE_BANCA = '2025-12-19';

export const REGOLE = { quiz: 40, minuti: 60, esatta: 1, errata: -0.5, omessa: 0 };

export const SOGLIE = { generale: 32, specialistico: 34, aggiornamento: 28 };

export const MODULI = [
  { modulo: 'cat145', titolo: 'Categorie 1, 4 e 5', sottotitolo: 'Raccolta e trasporto: il modulo di SMOCO e dei raccoglitori' },
  { modulo: 'cat8', titolo: 'Categoria 8', sottotitolo: 'Intermediazione e commercio senza detenzione' },
  { modulo: 'cat9', titolo: 'Categoria 9', sottotitolo: 'Bonifica dei siti' },
  { modulo: 'cat10', titolo: 'Categoria 10', sottotitolo: 'Bonifica dei beni contenenti amianto' },
];

const CARICATORI = {
  'iniziale-generale': () => import('@/data/quiz-rt/iniziale-generale.json'),
  'iniziale-cat145': () => import('@/data/quiz-rt/iniziale-cat145.json'),
  'iniziale-cat8': () => import('@/data/quiz-rt/iniziale-cat8.json'),
  'iniziale-cat9': () => import('@/data/quiz-rt/iniziale-cat9.json'),
  'iniziale-cat10': () => import('@/data/quiz-rt/iniziale-cat10.json'),
  'aggiornamento-cat145': () => import('@/data/quiz-rt/aggiornamento-cat145.json'),
  'aggiornamento-cat8': () => import('@/data/quiz-rt/aggiornamento-cat8.json'),
  'aggiornamento-cat9': () => import('@/data/quiz-rt/aggiornamento-cat9.json'),
  'aggiornamento-cat10': () => import('@/data/quiz-rt/aggiornamento-cat10.json'),
};

/** Banca dati di una parte della verifica. */
export function bancaDi(verifica, modulo, parte) {
  if (verifica === 'aggiornamento') return `aggiornamento-${modulo}`;
  return parte === 'generale' ? 'iniziale-generale' : `iniziale-${modulo}`;
}

/** Parti di una simulazione d'esame, nell'ordine in cui si svolgono. */
export function partiVerifica(verifica, modulo) {
  if (verifica === 'aggiornamento') {
    return [{ parte: 'aggiornamento', modulo, banca: bancaDi(verifica, modulo), titolo: 'Modulo specialistico di aggiornamento', soglia: SOGLIE.aggiornamento }];
  }
  return [
    { parte: 'generale', modulo: 'generale', banca: bancaDi(verifica, modulo, 'generale'), titolo: 'Modulo generale', soglia: SOGLIE.generale },
    { parte: 'specialistico', modulo, banca: bancaDi(verifica, modulo, 'specialistico'), titolo: 'Modulo specialistico', soglia: SOGLIE.specialistico },
  ];
}

const cache = new Map();

/** Carica una banca: quiz con id stabile, materia e risposte (la prima e' l'esatta). */
export async function caricaBanca(banca) {
  if (cache.has(banca)) return cache.get(banca);
  if (!CARICATORI[banca]) throw new Error(`Banca dati sconosciuta: ${banca}`);
  const mod = await CARICATORI[banca]();
  const dati = mod.default || mod;
  const risultato = {
    ...dati,
    quiz: dati.quiz.map((q, i) => ({ id: `${banca}-${i + 1}`, banca, materia: dati.materie[q[0]] || '', domanda: q[1], esatta: q[2], risposte: q.slice(2) })),
  };
  cache.set(banca, risultato);
  return risultato;
}

export function mescola(lista, rnd = Math.random) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Estrae n quiz rispettando il peso di ciascuna materia nella banca (metodo dei
 * resti maggiori), in ordine casuale e con le risposte mescolate.
 */
export function estraiQuiz(quiz, n, rnd = Math.random) {
  if (quiz.length <= n) return mescola(quiz, rnd).map(q => preparaQuiz(q, rnd));
  const perMateria = new Map();
  for (const q of quiz) {
    if (!perMateria.has(q.materia)) perMateria.set(q.materia, []);
    perMateria.get(q.materia).push(q);
  }
  const quote = [...perMateria.entries()].map(([materia, lista]) => {
    const esatta = (lista.length / quiz.length) * n;
    return { materia, lista, base: Math.floor(esatta), resto: esatta - Math.floor(esatta) };
  });
  let mancano = n - quote.reduce((s, q) => s + q.base, 0);
  for (const q of [...quote].sort((a, b) => b.resto - a.resto)) {
    if (mancano <= 0) break;
    q.base++;
    mancano--;
  }
  const scelti = quote.flatMap(q => mescola(q.lista, rnd).slice(0, q.base));
  return mescola(scelti, rnd).map(q => preparaQuiz(q, rnd));
}

export function preparaQuiz(q, rnd = Math.random) {
  return { ...q, opzioni: mescola(q.risposte, rnd) };
}

/** Punteggio secondo le regole d'esame. risposte: [{ scelta, esatta }], scelta vuota se omessa. */
export function calcolaPunteggio(risposte) {
  let esatte = 0, errate = 0, omesse = 0;
  for (const r of risposte) {
    if (!r.scelta) omesse++;
    else if (r.scelta === r.esatta) esatte++;
    else errate++;
  }
  const punteggio = esatte * REGOLE.esatta + errate * REGOLE.errata + omesse * REGOLE.omessa;
  return { esatte, errate, omesse, punteggio };
}

/**
 * Quiz da ripassare: sbagliati o saltati nelle esercitazioni e non ancora
 * indovinati in seguito. esercitazioni in ordine qualunque.
 */
export function quizDaRipassare(esercitazioni) {
  const ordinate = [...esercitazioni].sort((a, b) => String(a.terminata_il || a.created_date).localeCompare(String(b.terminata_il || b.created_date)));
  const stato = new Map();
  for (const e of ordinate) {
    if (e.versione_banca && e.versione_banca !== VERSIONE_BANCA) continue;
    let risposte = [];
    try { risposte = JSON.parse(e.risposte_json || '[]'); } catch { risposte = []; }
    for (const r of risposte) {
      if (!r || !r.id) continue;
      stato.set(r.id, r.ok ? 'giusto' : 'da_ripassare');
    }
  }
  return [...stato.entries()].filter(([, s]) => s === 'da_ripassare').map(([id]) => id);
}

export const bancaDaId = (id) => String(id).replace(/-\d+$/, '');

export function durata(secondi) {
  const s = Math.max(0, Math.round(secondi || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
