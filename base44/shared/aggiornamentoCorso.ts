// Aggiornamento normativo delle schede del corso RT.
//
// Il materiale del corso ha qualche anno e le norme cambiano: decreti, delibere
// dell'Albo, RENTRI. Il controllo mensile trova le novita' e, dopo l'approvazione,
// le mette nella base di conoscenza. Qui si fa il passo successivo: ogni scheda si
// confronta con la base di conoscenza verificata e, dove un punto e' superato, si
// annota che cosa vale oggi e con quale fonte. La scheda originale non si riscrive:
// si aggiunge l'aggiornamento, datato, cosi' si vede sempre da dove si parte.
//
// Quando la base di conoscenza cambia in un'area, le schede di quell'area tornano
// da ricontrollare, poche per volta.

import { BASE_CONOSCENZA, VERIFICATO_IL, testoConoscenza } from "./baseConoscenza.ts";

// Aree della base di conoscenza toccate da una scheda, dal testo e dalle norme citate.
const REGOLE_AREE: [string, RegExp][] = [
  ['rentri', /rentri|sistri|formular|\bfir\b|registr[oi] (cronologic|di carico)|carico e scarico|\bmud\b|vidimazion|tracciabilit/i],
  ['albo', /albo|responsabile tecnic|categori[ae] \d|iscrizion|delibera|garanzi[ae] finanziari|idoneit|capacita' finanziaria|capacità finanziaria/i],
  ['pfu', /\bpfu\b|pneumatic|182\/2019|dm 182|ecotyre|ecopneus/i],
  ['tua', /152\/2006|152 del 2006|testo unico ambientale|sanzion|deposito temporaneo|end of waste|sottoprodott|classificazion|\beer\b|\bcer\b|autorizzazion|\b20[89]\b|\b21[46]\b|responsabilit[aà] estesa|produttore del rifiuto/i],
];

export const AREE_CORSO = REGOLE_AREE.map(([a]) => a);

/** Aree di un testo libero (il testo della parte o i campi della scheda). */
export function areeDelTesto(testo) {
  const t = String(testo || '');
  return REGOLE_AREE.filter(([, re]) => re.test(t)).map(([a]) => a);
}

/** Testo di una scheda gia' elaborata, per riconoscerne le aree. */
export function testoDellaScheda(s) {
  return [s.modulo, s.sintesi, s.concetti_json, s.riferimenti_json, s.da_verificare_json, s.parole_chiave].filter(Boolean).join(' ');
}

/**
 * Ultimo cambiamento della base di conoscenza per ogni area: la data di verifica
 * delle voci scritte nel codice e quella delle voci approvate nel gestionale.
 */
export function ultimeModifichePerArea(approvate) {
  const ultime: Record<string, string> = {};
  const segna = (area, data) => {
    const d = String(data || '').slice(0, 10);
    if (!area || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    if (!ultime[area] || d > ultime[area]) ultime[area] = d;
  };
  for (const v of BASE_CONOSCENZA) segna(v.area, v.verificato_il || VERIFICATO_IL);
  for (const v of approvate || []) segna(v.area, v.deciso_il || v.verificato_il || v.created_date);
  return ultime;
}

/** true se la scheda va ricontrollata: mai controllata, o controllata prima dell'ultimo cambiamento di una sua area. */
export function daRicontrollare(scheda, aree, ultime) {
  if (!aree.length) return false;
  const controllata = String(scheda.aggiornata_il || '').slice(0, 10);
  if (!controllata) return true;
  return aree.some(a => ultime[a] && ultime[a] > controllata);
}

export const SCHEMA_AGGIORNAMENTI = {
  type: 'object',
  properties: {
    aggiornamenti: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          punto: { type: 'string' },
          oggi: { type: 'string' },
          fonte: { type: 'string' },
        },
      },
    },
  },
};

/** Istruzioni per confrontare una scheda con la base di conoscenza verificata. */
export function istruzioniAggiornamento(oggi, conoscenza) {
  return [
    `Oggi e' il ${oggi}. Qui sotto c'e' la BASE DI CONOSCENZA VERIFICATA sulle norme vigenti: e' l'unico riferimento valido per dire che cosa vale oggi.`,
    'Confronta con essa il materiale del corso e compila "aggiornamenti": un elemento per ogni punto del materiale che la base di conoscenza dimostra superato, abrogato o cambiato.',
    '- punto: che cosa dice il materiale, in breve;',
    "- oggi: che cosa vale oggi secondo la base di conoscenza, in una o due frasi;",
    '- fonte: la norma o la voce della base di conoscenza da cui lo ricavi.',
    'Non segnalare punti che la base di conoscenza non tratta: in quel caso non puoi sapere se sono cambiati, lasciali stare. Non inventare norme. Lista vuota se non c\'e\' nulla di superato.',
    '',
    'BASE DI CONOSCENZA VERIFICATA',
    conoscenza,
  ].join('\n');
}

/** Pulisce gli aggiornamenti restituiti dal modello. */
export function aggiornamentiPuliti(esito, oggi) {
  const lista = esito && Array.isArray(esito.aggiornamenti) ? esito.aggiornamenti : [];
  return lista
    .filter(a => a && a.punto && a.oggi)
    .slice(0, 8)
    .map(a => ({
      punto: String(a.punto).slice(0, 400),
      oggi: String(a.oggi).slice(0, 600),
      fonte: String(a.fonte || '').slice(0, 200),
      al: oggi,
    }));
}

/** Testo della base di conoscenza per le aree di una scheda. */
export function conoscenzaPerAree(approvate, aree) {
  return testoConoscenza(approvate, aree && aree.length ? aree : undefined);
}
