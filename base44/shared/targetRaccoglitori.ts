// Target dei raccoglitori: fonte unica, scritta solo in Target & Status.
//
// - Annuo per raccoglitore, e per regione quando lavora in piu' regioni (SMOCO):
//   TargetRaccoglitore, in tonnellate, definito a inizio anno o alla
//   contrattualizzazione.
// - Mensile: TargetMensile, in tonnellate, per raccoglitore e regione, con
//   l'indicazione "non raccoglie" e lo storico delle modifiche. E' quello che si
//   decide a inizio mese e puo' cambiare nel corso del mese.
//
// Tutti i moduli leggono da qui: una modifica vale subito ovunque.

import { fetchAll } from "./fetchAll.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";

export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export async function targetMensiliAnno(base44, anno) {
  return fetchAll(base44.asServiceRole.entities.TargetMensile, { anno: Number(anno) });
}

// Record dello stesso raccoglitore: prima quelli con lo stesso nome normalizzato;
// solo se non ce ne sono, quelli scritti con un'abbreviazione del nome, cioe' le
// cui parole stanno tutte nel nome del portale ("Pneuservice" per "PNEUSERVICE
// CONVERSANO SRL"). Mai il contrario: "Logistica Srl" non prende i target di
// "Logistica & Pneumatici".
export function recordDelRaccoglitore(records, nome) {
  const chiave = normalizzaRagioneSociale(nome || '');
  const esatti = records.filter(r => normalizzaRagioneSociale(r.raccoglitore || '') === chiave);
  if (esatti.length || !chiave) return esatti;
  const paroleNome = new Set(chiave.split(' ').filter(Boolean));
  return records.filter(r => {
    const parole = normalizzaRagioneSociale(r.raccoglitore || '').split(' ').filter(p => p.length > 2);
    return parole.length > 0 && parole.every(p => paroleNome.has(p));
  });
}

/**
 * Target di un raccoglitore in un mese, sommando le regioni.
 * null se per quel mese non e' stato scritto nulla.
 */
export function targetRaccoglitoreMese(records, nome, mese) {
  const righe = recordDelRaccoglitore(records.filter(r => r.mese === mese), nome);
  if (!righe.length) return null;
  const t = righe.reduce((s, r) => s + (Number(r.target) || 0), 0);
  return {
    target_kg: Math.round(t * 1000),
    non_raccoglie: righe.every(r => !!r.non_raccoglie),
    regioni: righe.map(r => ({ regione: r.regione || '', impianto: r.impianto || '', target_t: Number(r.target) || 0, non_raccoglie: !!r.non_raccoglie })),
  };
}

/**
 * Target mensili sommati per raccoglitore, regione e mese: un raccoglitore puo'
 * avere piu' righe, una per impianto di destinazione. Chi non raccoglie conta zero.
 * Il nome restituito e' quello scritto nel target, uguale a quello del portale.
 */
export function aggregaTargetMensili(records) {
  const mappa = new Map();
  for (const r of records) {
    const chiave = `${normalizzaRagioneSociale(r.raccoglitore || '')}|${String(r.regione || '').trim()}|${r.mese}|${r.anno}`;
    if (!mappa.has(chiave)) mappa.set(chiave, { raccoglitore: String(r.raccoglitore || '').trim(), regione: String(r.regione || '').trim(), mese: r.mese, anno: r.anno, target: 0 });
    if (!r.non_raccoglie) mappa.get(chiave).target += Number(r.target) || 0;
  }
  return [...mappa.values()];
}

/** Target annui sommati per raccoglitore e regione (piu' impianti diventano uno). */
export function aggregaTargetAnnui(records) {
  const mappa = new Map();
  for (const r of records) {
    const chiave = `${normalizzaRagioneSociale(r.raccoglitore || '')}|${String(r.regione || '').trim()}`;
    if (!mappa.has(chiave)) mappa.set(chiave, { raccoglitore: String(r.raccoglitore || '').trim(), regione: String(r.regione || '').trim(), target_tonnellate: 0 });
    mappa.get(chiave).target_tonnellate += Number(r.target_tonnellate) || 0;
  }
  return [...mappa.values()];
}
