// Dichiarazioni RENTRI dei produttori.
//
// Il foglio delle dichiarazioni dice, per ogni produttore, se e' iscritto al
// RENTRI e che formulario usa. Il portale dice la stessa cosa per ogni punto di
// raccolta (colonne Iscrizione al R.E.N.T.Ri., ID U/L RENTRi, Tipo di formulario
// dell'anagrafica PDR). Per metterle accanto serve sapere a quale PDR si
// riferisce ogni dichiarazione, e il foglio ha solo il nome.
//
// Il collegamento va dal piu' sicuro al meno sicuro, e dice sempre come e' stato
// trovato, cosi' chi guarda sa quanto fidarsi:
//   codice  - il codice RENTRI scritto nella nota e' quello dell'unita' locale del PDR;
//   nome    - il nome, tolte forma societaria e punteggiatura, e' identico a quello di
//             un solo produttore dell'anagrafica;
//   simile  - il nome somiglia a quello di un solo produttore: da confermare;
//   nessuno - nessun produttore, oppure piu' produttori diversi con lo stesso nome
//             (molti si chiamano allo stesso modo): si sceglie a mano fra i candidati.

import { chiaveProduttore, somiglianza, SOGLIA_ABBINAMENTO } from "./omologhe.ts";

export const CODICE_RENTRI = /OP[0-9A-Z]{13}-[A-Z]{2}\d{4}/;

/** Codice dell'unita' locale RENTRI dentro un testo libero, se c'e'. */
export function codiceRentriDa(testo) {
  const m = String(testo || '').toUpperCase().match(CODICE_RENTRI);
  return m ? m[0] : '';
}

const descriviPdr = (p) => ({
  id_pdr: String(p.id_pdr),
  id_cliente: String(p.id_cliente || ''),
  ragione_sociale: String(p.ragione_sociale || ''),
  descrizione: String(p.descrizione_pdr || ''),
  comune: String(p.comune_pdr || p.comune || ''),
  provincia: String(p.provincia_pdr || p.provincia || ''),
});

/**
 * Prepara l'anagrafica dei PDR per le ricerche: per codice RENTRI e per nome
 * ridotto (ragione sociale e descrizione del punto).
 */
export function indicePdr(pdr) {
  const perCodice = new Map();
  const perChiave = new Map();
  const tutti = [];
  for (const p of pdr) {
    if (p.id_pdr === undefined || p.id_pdr === null || p.id_pdr === '') continue;
    const chiavi = [...new Set([chiaveProduttore(p.ragione_sociale), chiaveProduttore(p.descrizione_pdr)].filter(Boolean))];
    const voce = { p, chiavi };
    tutti.push(voce);
    const codice = String(p.rentri_id_ul || '').trim().toUpperCase();
    if (codice) {
      if (!perCodice.has(codice)) perCodice.set(codice, []);
      perCodice.get(codice).push(p);
    }
    for (const k of chiavi) {
      if (!perChiave.has(k)) perChiave.set(k, []);
      perChiave.get(k).push(p);
    }
  }
  return { perCodice, perChiave, tutti };
}

const clientiDi = (lista) => new Set(lista.map(p => String(p.id_cliente || p.id_pdr)));

/**
 * Trova i PDR di una dichiarazione.
 * Restituisce { collegamento, pdr: [...], candidati: [...] }.
 */
export function collegaDichiarazione({ chiave, codice }, indice) {
  if (codice && indice.perCodice.has(codice)) {
    return { collegamento: 'codice', pdr: indice.perCodice.get(codice), candidati: [] };
  }
  const esatti = chiave ? (indice.perChiave.get(chiave) || []) : [];
  if (esatti.length) {
    // Piu' punti dello stesso cliente vanno bene; clienti diversi con lo stesso
    // nome no: e' proprio il caso in cui il nome non basta.
    if (clientiDi(esatti).size === 1) return { collegamento: 'nome', pdr: esatti, candidati: [] };
    return { collegamento: 'nessuno', pdr: [], candidati: esatti.slice(0, 8).map(descriviPdr) };
  }
  const simili = [];
  if (chiave) {
    for (const { p, chiavi } of indice.tutti) {
      const s = Math.max(...chiavi.map(k => somiglianza(chiave, k)), 0);
      if (s >= SOGLIA_ABBINAMENTO) simili.push({ p, s });
    }
  }
  simili.sort((a, b) => b.s - a.s);
  const lista = simili.map(x => x.p);
  if (lista.length && clientiDi(lista).size === 1) {
    return { collegamento: 'simile', pdr: lista, candidati: lista.slice(0, 8).map(descriviPdr) };
  }
  return { collegamento: 'nessuno', pdr: [], candidati: lista.slice(0, 8).map(descriviPdr) };
}
