// Helper di paginazione backend: carica tutti i record di un'entita' paginando a blocchi di 1000.
// Uso: fetchAll(base44.entities.PrimariaRete, { mese: 'Luglio' }, '-created_date')
// Se filtro e' null usa list(), altrimenti filter(). Continua finche' il blocco e' pieno (1000).
// Protezione anti-ciclo infinito: massimo 100 pagine (100.000 record).
export async function fetchAll(entity, filtro = null, ordinamento = '-created_date') {
  const PAGE = 1000;
  const MAX_PAGES = 100;
  let skip = 0;
  let all = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = filtro
      ? await entity.filter(filtro, ordinamento, PAGE, skip)
      : await entity.list(ordinamento, PAGE, skip);
    all = all.concat(batch);
    if (batch.length < PAGE) break;
    skip += PAGE;
    await new Promise(r => setTimeout(r, 100));
  }
  return all;
}