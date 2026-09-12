// Calcoli condivisi per Extra Raccolta — usato sia dalla pagina sia dall'esportazione.
// Nessun valore viene memorizzato nell'entità: tutto è ricalcolato dai campi di input.

export function calcExtraRaccolta(r) {
  const quantita_kg = Number(r.peso_effettivo || r.quantita_ritirata || 0);
  const tonnellate = Math.round((quantita_kg / 1000) * 1000) / 1000;

  const prezzoAttivo = Number(r.prezzo_attivo_t || 0);
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

  return { tonnellate, ricavo, costo_totale, margine, margine_perc };
}

// Totale riga per export: tonnellate × prezzo, senza sovracosti
export function totaleRiga(r) {
  const t = calcExtraRaccolta(r).tonnellate;
  return Math.round(t * Number(r.prezzo_attivo_t || 0) * 100) / 100;
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