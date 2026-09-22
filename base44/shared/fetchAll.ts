// Helper di paginazione backend: carica tutti i record di un'entita' paginando.
// Uso: fetchAll(base44.entities.PrimariaRete, { mese: 'Luglio' }, '-created_date')
// Se filtro e' null usa list(), altrimenti filter().
//
// Le pagine sono da 5000 righe, il massimo che la piattaforma restituisce
// (misurato il 22/09/2026: con limite 12000 ne arrivano 5000). Con pagine da
// 1000 le primarie di rete costavano 11 richieste a ogni lettura, e dopo un
// caricamento le leggono una decina di ricalcoli insieme: le richieste
// riempivano il limite al minuto della piattaforma e i ricalcoli fallivano con
// "rate limit exceeded" (vedi limiteRichieste.ts). Se un giorno la piattaforma
// restituisse meno righe per pagina, una pagina corta ma tonda (un multiplo di
// 1000) non chiude la lettura: si chiede la successiva, e solo una pagina vuota o
// corta e non tonda dice che l'archivio e' finito. Protezione anti-ciclo: 100 pagine.
//
// Le pagine si leggono sempre in ordine di id, l'unico ordinamento stabile: con
// created_date i record creati nello stesso istante (importazioni a blocchi) si
// scambiano di posto fra una pagina e l'altra, e alcuni vengono letti due volte e
// altri mai (15/09/2026: 44 doppioni e 44 mancanti su 10.543 primarie).
// L'ordinamento richiesto si applica alla fine, in memoria.
export const RIGHE_PER_PAGINA = 5000;

// La pagina appena letta e' l'ultima? Vedi sopra.
export const ultimaPagina = (letti, chiesti) => letti === 0 || (letti < chiesti && letti % 1000 !== 0);

export async function fetchAll(entity, filtro = null, ordinamento = '-created_date') {
  const PAGE = RIGHE_PER_PAGINA;
  const MAX_PAGES = 100;
  let skip = 0;
  let all = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = filtro
      ? await entity.filter(filtro, 'id', PAGE, skip)
      : await entity.list('id', PAGE, skip);
    all = all.concat(batch);
    if (ultimaPagina(batch.length, PAGE)) break;
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

// Come fetchAll, ma senza tenere in memoria i record: li passa pagina per pagina
// a chi li deve solo sommare. Le entita' grandi (le primarie, le dichiarazioni di
// trattamento del portale) sono decine di migliaia di righe, e caricarle tutte
// insieme e' quello che fa arrancare una funzione che deve solo fare dei totali.
export async function perPagina(entity, filtro, fn) {
  const PAGE = RIGHE_PER_PAGINA;
  const MAX_PAGES = 100;
  let skip = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = filtro
      ? await entity.filter(filtro, 'id', PAGE, skip)
      : await entity.list('id', PAGE, skip);
    for (const r of batch) fn(r);
    if (ultimaPagina(batch.length, PAGE)) break;
    skip += batch.length;
  }
}
