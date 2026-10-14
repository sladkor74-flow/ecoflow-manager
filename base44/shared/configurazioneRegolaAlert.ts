// IL GIORNO DELLA CONFIGURAZIONE DI UNA REGOLA ALERT (decisioni dell'utente del
// 13/10/2026).
//
// Le regole di tratta (tratta_autorizzata, tratta_combinazione,
// tratte_autorizzate_classe) non hanno un anno: valgono dal giorno in cui sono
// scritte, e sull'anno prima il motore (runAlertEngine) applica solo quella
// scritta prima del 01/01 di quest'anno. Fino al 13/10/2026 «scritta» voleva dire
// creata e cambiata l'ultima volta (created_date, updated_date): ma la pagina
// Alert Engine, per attivare o disattivare una regola, la aggiorna, e una regola
// del 2026 disattivata e riattivata a gennaio 2027 diventava una regola del 2027,
// che il 2026 non lo misura piu': il viaggio del 30/12 registrato il 04/01 restava
// senza il suo alert. Attivare e disattivare non cambia che cosa la regola
// controlla.
//
// Ora la regola porta il giorno italiano dell'ultima modifica della
// configurazione (configurata_il: modulo, tipo, destinazioni, combinazioni,
// classi, soglie) e l'impronta di quella configurazione
// (impronta_configurazione). Li scrive la pagina quando crea la regola; il
// pulsante Attiva/Disattiva non li tocca. Il motore si fida del giorno solo se
// l'impronta torna con la configurazione di oggi: una configurazione cambiata
// senza passare dalla pagina (per esempio nell'archivio a mano) non torna, e il
// motore ripiega sulle date di sistema, come per le regole che il giorno non
// l'hanno.
//
// Funzioni pure, senza tipi: lo specchio src/lib/configurazioneRegolaAlert.js
// deve restare identico salvo questa intestazione e gli import
// (prove/alertRegolaConfigurata.mjs, e prove/specchi.mjs quando la coppia c'e').
import { giornoRoma, oggiRoma } from "./giornoItaliano.ts";

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
