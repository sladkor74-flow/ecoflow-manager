// Specchio per le pagine di base44/shared/configurazioneRegolaAlert.ts: le pagine
// non possono importare da base44/shared. Deve restare IDENTICO all'originale, a
// meno di questa intestazione e degli import (prove/alertRegolaConfigurata.mjs, e
// prove/specchi.mjs quando la coppia c'e').
// E' nato il 13/10/2026 (decisioni dell'utente): la pagina Alert Engine scrive il
// giorno della configurazione di una regola quando la crea, e il pulsante
// Attiva/Disattiva non lo cambia; il motore lo legge con la stessa regola. Chi
// cambia una regola la cambia nell'originale e la ricopia qui.
// Import relativi con l'estensione: cosi' lo leggono anche le prove in node.
import { giornoRoma, oggiRoma } from './giornoItaliano.js';

/**
 * Il giorno italiano ('AAAA-MM-GG') di una data di sistema (created_date,
 * updated_date): arriva in UTC ma senza il fuso, e il browser la leggerebbe come
 * ora locale. Stringa vuota se non e' una data.
 */
export function giornoDellIstante(v) {
  if (!v) return '';
  const s = String(v);
  return giornoRoma(s.includes('T') && !/(Z|[+-]\d{2}:?\d{2})$/i.test(s) ? s + 'Z' : s);
}

// Le chiavi degli oggetti in ordine, a ogni livello; gli elenchi restano come
// sono (l'ordine delle destinazioni e' quello scritto).
function inOrdine(v) {
  if (Array.isArray(v)) return v.map(inOrdine);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, inOrdine(v[k])]));
  return v;
}

/**
 * L'impronta della configurazione di una regola: modulo, tipo e config, con le
 * chiavi in ordine. Nome, descrizione, severita', messaggio e attiva non ne fanno
 * parte: non cambiano che cosa la regola controlla.
 */
export function improntaConfigurazione(regola) {
  const r = regola || {};
  return JSON.stringify(inOrdine({ modulo: r.modulo || '', tipo_regola: r.tipo_regola || '', config: r.config || {} }));
}

/**
 * Il giorno della configurazione di cui il motore si fida ('AAAA-MM-GG'), o null:
 * configurata_il, se l'impronta salvata e' quella della configurazione di oggi.
 */
export function giornoDellaConfigurazione(regola) {
  const il = String((regola && regola.configurata_il) || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(il)) return null;
  return regola.impronta_configurazione === improntaConfigurazione(regola) ? il : null;
}

/** I campi da salvare con una regola nuova: configurata oggi, giorno italiano. */
export function configurataOggi(regola) {
  return { configurata_il: oggiRoma(), impronta_configurazione: improntaConfigurazione(regola) };
}

/**
 * Che cosa scrive il pulsante Attiva/Disattiva: solo attiva. Una regola senza un
 * giorno di cui fidarsi (salvata prima del 13/10/2026, o cambiata fuori dalla
 * pagina) prende in piu' il giorno della sua ultima scrittura prima di questa
 * (updated_date): la configurazione e' quella almeno da allora. Mai oggi:
 * attivare non e' configurare.
 */
export function cambioAttivazione(regola) {
  const cambio = { attiva: !regola.attiva };
  if (giornoDellaConfigurazione(regola)) return cambio;
  const giorno = giornoDellIstante(regola.updated_date || regola.created_date);
  return giorno ? { ...cambio, configurata_il: giorno, impronta_configurazione: improntaConfigurazione(regola) } : cambio;
}
