// Calcoli condivisi per Extra Raccolta — usato sia dalla pagina sia dall'esportazione.
// Nessun valore viene memorizzato nell'entità: tutto è ricalcolato dai campi di input.
// Import relativo con l'estensione: cosi' lo legge anche la prova in node.
import { giornoRoma } from './giornoItaliano.js';

// La tariffa base dell'extra raccolta verso Ecotyre, un valore per anno. Regola
// dell'utente del 22/09/2026: «la tariffa dell'extra raccolta di base per la
// fatturazione attiva e' sempre 202 €/t nel 2026». Vale quando sull'intervento
// il prezzo attivo e' zero o vuoto. E' la copia per il browser di
// TARIFFA_BASE_EXTRA_RACCOLTA in base44/shared/ecotyreTariffe.ts, che la
// fatturazione attiva usa dopo la tabella delle tariffe: le pagine non possono
// importare da base44/shared, e prove/attivaCalcolo.mjs controlla che i due
// numeri siano uguali. Un anno che qui non c'e' non ha una base.
export const TARIFFA_BASE_EXTRA_RACCOLTA = { 2026: 202 };

/** La tariffa base (€/t) di un anno, oppure null. */
export const tariffaBaseExtraRaccolta = (anno) => TARIFFA_BASE_EXTRA_RACCOLTA[Number(anno)] || null;

/** L'anno di un intervento: la fine del trasporto; per uno ancora assegnato, la data della richiesta. */
export function annoIntervento(r) {
  const g = giornoRoma(r && r.trasporto_finito_il) || giornoRoma(r && r.ordine_immesso_il);
  return g ? Number(g.slice(0, 4)) : null;
}

const eSecondaria = (r) => String((r && r.tipo_movimento) || '').toLowerCase().trim() === 'secondaria';

/**
 * Il prezzo attivo di un intervento, lo stesso della fatturazione attiva:
 * { valore, base, anno }. Il prezzo scritto se e' maggiore di zero, altrimenti la
 * tariffa base dell'anno (base: true). Le secondarie non si fatturano a Ecotyre
 * (il ricavo sta sulla raccolta), quindi a loro la base non si applica.
 */
export function prezzoAttivoExtra(r) {
  const anno = annoIntervento(r);
  const scritto = Number((r && r.prezzo_attivo_t) || 0);
  if (scritto > 0) return { valore: scritto, base: false, anno };
  const base = eSecondaria(r) ? null : tariffaBaseExtraRaccolta(anno);
  return base ? { valore: base, base: true, anno } : { valore: 0, base: false, anno };
}

export function calcExtraRaccolta(r) {
  const quantita_kg = Number(r.peso_effettivo || r.quantita_ritirata || 0);
  const tonnellate = Math.round((quantita_kg / 1000) * 1000) / 1000;

  // Il prezzo scritto o, se manca, la tariffa base: la pagina e la fattura
  // devono dire lo stesso ricavo.
  const prezzoAttivo = prezzoAttivoExtra(r).valore;
  const sovraRaccolta = Number(r.sovracosto_raccolta || 0);
  const sovraTrasporto = Number(r.sovracosto_trasporto || 0);
  const sovraTrattamento = Number(r.sovracosto_trattamento || 0);

  const ricavo = Math.round(
    (tonnellate * prezzoAttivo + sovraRaccolta + sovraTrasporto + sovraTrattamento) * 100
  ) / 100;

  const costoRaccolta = Number(r.costo_raccolta_t || 0);
  const costoStoccaggio = Number(r.costo_stoccaggio_t || 0);
  const costoTrattamento = Number(r.costo_trattamento_t || 0);
  const costoPulizia = Number(r.costo_pulizia || 0);
  const costiAggiuntivi = Number(r.costi_aggiuntivi || 0);

  const costo_totale = Math.round(
    (tonnellate * (costoRaccolta + costoStoccaggio + costoTrattamento) + costoPulizia + costiAggiuntivi) * 100
  ) / 100;

  const margine = Math.round((ricavo - costo_totale) * 100) / 100;
  const margine_perc = ricavo !== 0 ? Math.round((margine / ricavo * 100) * 100) / 100 : 0;

  return { tonnellate, prezzo_attivo: prezzoAttivo, ricavo, costo_totale, margine, margine_perc };
}

// Totale riga per export: tonnellate × prezzo (scritto o base), senza sovracosti
export function totaleRiga(r) {
  const t = calcExtraRaccolta(r).tonnellate;
  return Math.round(t * prezzoAttivoExtra(r).valore * 100) / 100;
}

// Aggregazione per produttore per analisi margine
export function aggregaPerProduttore(records) {
  const map = {};
  for (const r of records) {
    const p = r.produttore || '(senza produttore)';
    if (!map[p]) map[p] = { costi_aggiuntivi: 0, raccolta: 0, stoccaggio: 0, trattamento: 0, pulizia: 0, costo_totale: 0, ricavi: 0, margine: 0 };
    const c = calcExtraRaccolta(r);
    map[p].costi_aggiuntivi += Number(r.costi_aggiuntivi || 0);
    map[p].raccolta += c.tonnellate * Number(r.costo_raccolta_t || 0);
    map[p].stoccaggio += c.tonnellate * Number(r.costo_stoccaggio_t || 0);
    map[p].trattamento += c.tonnellate * Number(r.costo_trattamento_t || 0);
    map[p].pulizia += Number(r.costo_pulizia || 0);
    map[p].costo_totale += c.costo_totale;
    map[p].ricavi += c.ricavo;
    map[p].margine += c.margine;
  }
  return map;
}
