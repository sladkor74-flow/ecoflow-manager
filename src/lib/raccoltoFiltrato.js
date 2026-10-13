// I FILTRI DELL'ANDAMENTO DI TARGET & STATUS, IN MEMORIA (segnalazione alta del
// 20/09, corretta il 12/10/2026).
//
// La pagina chiamava computeRaccolto con i filtri della scheda (mese, regione,
// raccoglitore, impianto), e lo stesso raccolto filtrato finiva anche nei numeri
// che parlano dell'anno: con il filtro Mese = Settembre la card «Raccolto RETE
// nell'anno» diceva il solo settembre, il «Residuo dell'anno» diventava il
// contratto meno settembre, e la tabella per regione e contratto e il Report
// generale confrontavano col contratto annuo un mese solo. Ora la pagina legge
// il raccolto una volta, per anno e canale e senza filtri, e da' quello alle card
// dell'anno, alla tabella per contratto e al Report generale; i filtri si
// applicano qui, in memoria, solo alle tabelle che li prevedono. Cambiare un
// filtro non fa piu' una chiamata.
//
// Il raccolto dell'anno porta gia' tutto quello che serve: by_raccoglitore_impianto
// ha raccoglitore, regione, impianto e i dodici mesi, e gli altri raggruppamenti
// ne sono le somme. Le chiavi sono quelle di computeRaccoltoData
// (base44/shared/raccoltoCalculator.ts): regione dalla provincia, «Altro» se non
// si legge, raccoglitore e impianto come sono scritti, «N/D» se mancano. Con il
// filtro sui mesi, gli altri mesi valgono zero e un gruppo senza raccolto nei
// mesi scelti non c'e', come nella risposta filtrata della funzione.

const lista = (v) => (Array.isArray(v) ? v : v != null && v !== '' ? [v] : []);

/** true se almeno un filtro della scheda e' attivo. */
export const filtriAttivi = (filtri = {}) => ['mese', 'regione', 'raccoglitore', 'impianto'].some(k => lista(filtri[k]).length > 0);

/**
 * Il raccolto con i filtri della scheda, dal raccolto dell'anno senza filtri.
 * Senza filtri restituisce lo stesso oggetto. Le date da sistemare e le voci dei
 * filtri restano quelle dell'anno: dicono l'archivio, non la vista.
 */
export function filtraRaccolto(raccolto, filtri = {}) {
  if (!raccolto || !filtriAttivi(filtri)) return raccolto;
  const fMese = lista(filtri.mese);
  const fRegione = lista(filtri.regione);
  const fRaccoglitore = lista(filtri.raccoglitore);
  const fImpianto = lista(filtri.impianto);

  const gruppi = (raccolto.by_raccoglitore_impianto || []).filter(e =>
    (!fRegione.length || fRegione.includes(e.regione))
    && (!fRaccoglitore.length || fRaccoglitore.includes(e.raccoglitore))
    && (!fImpianto.length || fImpianto.includes(e.impianto)));

  const perRaccoglitore = new Map();
  const perRegione = new Map();
  const perImpianto = new Map();
  const perGruppo = [];
  let totale = 0;
  const somma = (mappa, chiave, base, mesi, t) => {
    if (!mappa.has(chiave)) mappa.set(chiave, { ...base, totale: 0, mesi: Object.fromEntries(Object.keys(mesi).map(m => [m, 0])) });
    const x = mappa.get(chiave);
    x.totale += t;
    for (const [m, v] of Object.entries(mesi)) x.mesi[m] = (x.mesi[m] || 0) + v;
  };
  for (const e of gruppi) {
    const mesi = Object.fromEntries(Object.entries(e.mesi || {}).map(([m, v]) => [m, !fMese.length || fMese.includes(m) ? Number(v) || 0 : 0]));
    const t = fMese.length ? Object.values(mesi).reduce((s, v) => s + v, 0) : Number(e.totale) || 0;
    if (fMese.length && !(t > 0)) continue;
    perGruppo.push({ ...e, totale: t, mesi });
    somma(perRaccoglitore, `${e.raccoglitore}|||${e.regione}`, { raccoglitore: e.raccoglitore, regione: e.regione }, mesi, t);
    somma(perRegione, e.regione, { regione: e.regione }, mesi, t);
    somma(perImpianto, e.impianto, { impianto: e.impianto }, mesi, t);
    totale += t;
  }
  return {
    ...raccolto,
    totale_raccolto: totale,
    by_raccoglitore: [...perRaccoglitore.values()],
    by_raccoglitore_impianto: perGruppo,
    by_regione: [...perRegione.values()],
    by_impianto: [...perImpianto.values()],
  };
}
