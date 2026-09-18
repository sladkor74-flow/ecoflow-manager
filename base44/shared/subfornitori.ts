// Chi fattura per chi.
//
// Un subraccoglitore lavora sotto un altro fornitore: raccoglie con il proprio
// nome sui formulari, ma le sue tonnellate le paghiamo al fornitore principale,
// che e' quello che ce le fattura. Torres Giovanni, per esempio, e'
// subraccoglitore di Green Tyre Project: sui formulari compare Torres, la
// fattura arriva da Green Tyre Project.
//
// Nella fatturazione quindi le sue prestazioni si accorpano al principale e la
// tariffa e' quella del principale. Nella reportistica il subfornitore resta
// visibile come "di cui", perche' sapere quanto ha raccolto serve: quello che
// non deve succedere e' fatturare a lui, o segnalare come errore una tariffa che
// non avra' mai.
//
// Il legame si dichiara sul fornitore, nel campo fattura_tramite_nome, e vale
// per qualunque coppia: non e' scritto da nessuna parte il nome di Torres.
//
// Specchio nel frontend: src/lib/subfornitori.js.

import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";

const MAX_CATENA = 5;

/**
 * La mappa "chi fattura per chi" ricavata dall'anagrafica dei fornitori.
 *
 * Restituisce { chiave normalizzata del subfornitore -> { nome, chiave } del
 * soggetto che fattura }. Le catene si seguono fino in fondo (A sotto B sotto C
 * fattura a C) e un anello si ferma da solo senza mandare in loop il calcolo.
 */
export function mappaFatturazione(fornitori) {
  const diretta = new Map(); // chiave -> { nome, chiave }
  const nomi = new Map();    // chiave -> ragione sociale
  for (const f of (fornitori || [])) {
    const chiave = normalizzaRagioneSociale(f && f.ragione_sociale);
    if (chiave) nomi.set(chiave, String(f.ragione_sociale).trim());
  }
  for (const f of (fornitori || [])) {
    const chiave = normalizzaRagioneSociale(f && f.ragione_sociale);
    const tramite = normalizzaRagioneSociale(f && f.fattura_tramite_nome);
    if (!chiave || !tramite || tramite === chiave) continue;
    diretta.set(chiave, { chiave: tramite, nome: nomi.get(tramite) || String(f.fattura_tramite_nome).trim() });
  }

  const finale = new Map();
  for (const [chiave] of diretta) {
    const visti = new Set([chiave]);
    let corrente = chiave;
    let passi = 0;
    while (diretta.has(corrente) && passi++ < MAX_CATENA) {
      const prossimo = diretta.get(corrente);
      if (visti.has(prossimo.chiave)) break;
      visti.add(prossimo.chiave);
      corrente = prossimo.chiave;
    }
    if (corrente !== chiave) finale.set(chiave, { chiave: corrente, nome: nomi.get(corrente) || corrente });
  }
  return finale;
}

/**
 * Il soggetto a cui si fattura una prestazione svolta da questo nome.
 * Restituisce sempre { nome, chiave, subfornitore } : subfornitore e' il nome
 * di chi ha lavorato, valorizzato solo quando e' diverso da chi fattura.
 */
export function fatturaA(mappa, nome) {
  const originale = String(nome || '').trim();
  const chiave = normalizzaRagioneSociale(originale);
  const tramite = mappa && mappa.get ? mappa.get(chiave) : null;
  if (!tramite) return { nome: originale, chiave, subfornitore: '' };
  return { nome: tramite.nome, chiave: tramite.chiave, subfornitore: originale };
}
