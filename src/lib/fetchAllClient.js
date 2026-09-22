// Helper di paginazione frontend: carica tutti i record di un'entita' paginando.
// Uso: fetchAllClient(base44.entities.PrimariaRete, { mese: 'Luglio' }, '-created_date')
// Se filtro e' null usa list(), altrimenti filter(). Pagine da 5000 righe, il
// massimo della piattaforma, e stessa regola di fine lettura di fetchAll: le
// richieste delle pagine contano nel limite al minuto di tutta l'app.
// Protezione anti-ciclo infinito: massimo 100 pagine.
//
// Specchio di base44/shared/fetchAll.ts: le pagine si leggono in ordine di id,
// l'unico stabile (con created_date i record importati nello stesso istante si
// leggono due volte o mai), e l'ordinamento richiesto si applica in memoria.
export async function fetchAllClient(entity, filtro = null, ordinamento = '-created_date') {
  const PAGE = 5000;
  const MAX_PAGES = 100;
  let skip = 0;
  let all = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = filtro
      ? await entity.filter(filtro, 'id', PAGE, skip)
      : await entity.list('id', PAGE, skip);
    all = all.concat(batch);
    if (batch.length === 0 || (batch.length < PAGE && batch.length % 1000 !== 0)) break;
    skip += batch.length;
    await new Promise(r => setTimeout(r, 100));
  }
  const visti = new Set();
  all = all.filter(r => (r && r.id ? (visti.has(r.id) ? false : (visti.add(r.id), true)) : true));
  return ordina(all, ordinamento);
}

function ordina(righe, ordinamento) {
  const campo = String(ordinamento || '').replace(/^[-+]/, '');
  if (!campo || campo === 'id') return righe;
  const verso = String(ordinamento).startsWith('-') ? -1 : 1;
  const valore = (r) => (r ? r[campo] : undefined);
  return righe
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const x = valore(a.r), y = valore(b.r);
      if (x === y || (x == null && y == null)) return a.i - b.i;
      if (x == null) return 1;
      if (y == null) return -1;
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return c === 0 ? a.i - b.i : c * verso;
    })
    .map(e => e.r);
}
