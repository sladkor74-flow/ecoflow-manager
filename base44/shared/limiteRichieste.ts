// Il limite di richieste della piattaforma (22/09/2026).
//
// La piattaforma conta le richieste al database di tutta l'app insieme, non di
// chi le fa, su una finestra di un minuto; oltre il limite risponde 429 "Rate
// limit exceeded". Dopo un caricamento delle primarie partono insieme i
// ricalcoli del browser e il workflow degli alert, e ognuno rilegge archivi
// interi: la finestra si riempiva e il primo che trovava la porta chiusa
// falliva, e l'utente leggeva "rate limit exceeded" (anche nelle verifiche dei
// report settimanali). Una richiesta respinta per il limite non e' stata
// eseguita: si ripete senza rischio di doppioni. Qui si ripete dopo una pausa
// crescente, per poco piu' di un minuto, cioe' oltre la finestra.
//
// Vale per ogni lettura e scrittura degli archivi, con o senza asServiceRole, e
// per le chiamate alle funzioni: queste si ripetono solo se la piattaforma le ha
// respinte (stato 429), mai se la funzione chiamata ha risposto con un errore,
// perche' potrebbe aver gia' scritto qualcosa.

const ATTESE_LIMITE = [2000, 5000, 10000, 20000, 30000];

const pausa = (ms) => new Promise(r => setTimeout(r, ms));

const statoDi = (e) => (e && (e.status || (e.response && e.response.status))) || undefined;

/** La richiesta e' stata respinta per il limite di richieste? */
export function eLimiteRichieste(e) {
  if (statoDi(e) === 429) return true;
  const messaggio = String(e && e.message ? e.message : e);
  return /rate limit|too many requests/i.test(messaggio);
}

/**
 * Esegue fn e la ripete se viene respinta per il limite di richieste.
 * soloStato: ripete solo su stato 429, non sul testo dell'errore (chiamate alle
 * funzioni, il cui messaggio puo' venire da dentro la funzione).
 */
export async function conPazienza(fn, { attese = ATTESE_LIMITE, soloStato = false } = {}) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const respinta = soloStato ? statoDi(e) === 429 : eLimiteRichieste(e);
      if (!respinta || i >= attese.length) throw e;
      // un po' di scarto, cosi' chi e' stato respinto insieme non riparte insieme
      await pausa(attese[i] + Math.floor(Math.random() * 1000));
    }
  }
}

const NON_AVVOLTI = new Set(['subscribe', 'then']);

// Il segno di un archivio gia' avvolto. Nel sito proteggiScritture (permessi.js)
// rimette sul client un suo insieme di archivi, costruito su quelli gia' avvolti:
// senza il segno si avvolgevano due volte, e una richiesta sempre respinta
// partiva 36 volte invece di 6, con otto minuti di attesa invece di uno.
const AVVOLTO = Symbol.for('ecoflow.limiteRichieste');

// I metodi di un archivio: ogni chiamata si ripete se respinta per il limite.
function avvolgiArchivio(archivio, attese) {
  if (!archivio || typeof archivio !== 'object' || archivio[AVVOLTO]) return archivio;
  return new Proxy(archivio, {
    get(t, nome) {
      if (nome === AVVOLTO) return true;
      const v = t[nome];
      if (typeof v !== 'function' || typeof nome !== 'string' || NON_AVVOLTI.has(nome)) return v;
      return (...argomenti) => conPazienza(() => v.apply(t, argomenti), { attese });
    },
  });
}

// L'insieme degli archivi: il client crea l'archivio a ogni accesso per nome.
function avvolgiArchivi(archivi, attese) {
  if (!archivi || typeof archivi !== 'object') return archivi;
  return new Proxy(archivi, {
    get(t, nome) {
      const v = t[nome];
      return typeof nome === 'string' && v && typeof v === 'object' ? avvolgiArchivio(v, attese) : v;
    },
  });
}

function avvolgiFunzioni(funzioni, attese) {
  if (!funzioni || typeof funzioni !== 'object' || funzioni[AVVOLTO]) return funzioni;
  return new Proxy(funzioni, {
    get(t, nome) {
      if (nome === AVVOLTO) return true;
      const v = t[nome];
      if (nome !== 'invoke' || typeof v !== 'function') return v;
      return (...argomenti) => conPazienza(() => v.apply(t, argomenti), { attese, soloStato: true });
    },
  });
}

function avvolgiModuli(moduli, attese) {
  if (!moduli || typeof moduli !== 'object') return moduli;
  return new Proxy(moduli, {
    get(t, nome) {
      if (nome === 'entities') return avvolgiArchivi(t.entities, attese);
      if (nome === 'functions') return avvolgiFunzioni(t.functions, attese);
      if (nome === 'asServiceRole') return avvolgiModuli(t.asServiceRole, attese);
      return t[nome];
    },
  });
}

/**
 * Il client con il ritentativo sul limite di richieste: archivi (anche con
 * asServiceRole) e chiamate alle funzioni. Il resto passa com'e'. Le attese
 * si cambiano solo nelle prove.
 */
export function conLimiteRichieste(client, { attese = ATTESE_LIMITE } = {}) {
  return avvolgiModuli(client, attese);
}
