// Le letture d'archivio di UNA domanda, fatte una volta sola.
//
// Richiesta dell'utente (30/09/2026): EcoTyna deve essere piu' performante sulle
// domande della commessa. Il pianificatore puo' scegliere fino a dodici strumenti
// e li si esegue insieme: se tre di loro leggono le primarie di rete, oggi
// l'archivio si legge tre volte, e le primarie sono decine di migliaia di righe a
// pagine da cinquemila con una pausa fra una pagina e l'altra.
//
// Si memorizza la PROMESSA, non il risultato: gli strumenti partono tutti insieme,
// e con il risultato la seconda lettura partirebbe lo stesso perche' la prima non
// ha ancora finito. Con la promessa, chi arriva dopo si mette in coda su quella
// gia' in corso.
//
// La cache vive quanto la domanda e poi se ne va: non e' una cache dei dati del
// gestionale, e non puo' restituire numeri vecchi a una domanda successiva. Questa
// e' la ragione per cui non sta dentro fetchAll, che e' la lettura piu' usata di
// tutto il gestionale (centinaia di chiamate in decine di file) e dove una cache
// sbagliata farebbe danni ovunque.

/** Una cache nuova, da usare per una domanda sola. */
export function nuovaCache() {
  const inCorso = new Map();
  let risparmiate = 0;
  // Si contano le letture PARTITE, non le chiavi rimaste nella mappa: una lettura
  // che fallisce esce dalla mappa e al secondo giro riparte, e contando le chiavi
  // il registro avrebbe detto "una lettura" dove ne erano state fatte due.
  let partite = 0;
  return {
    /** Il risultato di fn per questa chiave, calcolato una volta sola. */
    leggi(chiave, fn) {
      const k = String(chiave);
      if (inCorso.has(k)) { risparmiate++; return inCorso.get(k); }
      // Se la lettura fallisce, la promessa rotta non resta in cache: la volta
      // dopo si riprova, invece di ereditare per sempre l'errore di adesso.
      partite++;
      const p = Promise.resolve().then(fn).catch((e) => { inCorso.delete(k); throw e; });
      inCorso.set(k, p);
      return p;
    },
    /** Quante letture sono state fatte e quante risparmiate: si dice nel registro. */
    conti: () => ({ letture: partite, risparmiate }),
  };
}

/**
 * La chiave di una lettura: entita' piu' filtro. Due filtri uguali scritti con le
 * chiavi in ordine diverso sono lo stesso filtro, altrimenti la cache non
 * riconoscerebbe la lettura che ha gia' fatto.
 */
export function chiaveLettura(entita, filtro) {
  if (!filtro) return `${entita}|`;
  const ordinate = Object.keys(filtro).sort().map(k => `${k}=${JSON.stringify(filtro[k])}`);
  return `${entita}|${ordinate.join('&')}`;
}
