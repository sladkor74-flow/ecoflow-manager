// Testi lunghi (liste, esiti dei controlli) oltre la dimensione massima di un campo.
//
// Un campo di un record accetta circa 20 KB: un testo piu' lungo si divide in parti
// salvate nell'entita' ContenutoEsteso e nel campo resta un segnaposto "@parti:N".
// Chi legge usa leggiCampo, che ricompone il testo; i testi brevi restano nel campo.
// Specchio nel frontend: src/lib/testoLungo.js.
//
// Richieste (22/09/2026, limite al minuto della piattaforma): le parti di un campo
// si cancellano con una sola deleteMany, non una delete per parte; chi rilegge
// molti record insieme (i riconfronti dopo un caricamento) precarica le parti in
// blocco con precaricaParti, invece di una lettura per record e per campo. Il
// precaricato vale per la sola chiamata (e' legato al client) ed e' solo una
// scorciatoia: se non torna col numero di parti atteso, si rilegge come prima.

export const LUNGHEZZA_PARTE = 8000;
const SEGNAPOSTO = /^@parti:(\d+)$/;

// Parti lette in blocco, per client: entita|record|campo -> parti.
const letteInBlocco = new WeakMap();
const chiave = (entita, id, campo) => `${entita}|${id}|${campo}`;

function dimentica(base44, entita, id, campo) {
  const cache = letteInBlocco.get(base44);
  if (!cache) return;
  if (campo) { cache.delete(chiave(entita, id, campo)); return; }
  const prefisso = `${entita}|${id}|`;
  for (const k of [...cache.keys()]) if (k.startsWith(prefisso)) cache.delete(k);
}

/**
 * Legge in blocco le parti dei campi indicati di molti record, a gruppi di 20
 * record: poi leggiCampo e leggiJson le prendono da qui senza altre richieste.
 */
export async function precaricaParti(base44, entita, record, campi) {
  const daLeggere = (record || []).filter(r => r && r.id && campi.some(c => SEGNAPOSTO.test(String(r[c] ?? ''))));
  if (!daLeggere.length) return;
  let cache = letteInBlocco.get(base44);
  if (!cache) { cache = new Map(); letteInBlocco.set(base44, cache); }
  for (let i = 0; i < daLeggere.length; i += 20) {
    const gruppo = daLeggere.slice(i, i + 20);
    const filtro = { entita, record_id: { $in: gruppo.map(r => String(r.id)) }, campo: { $in: campi } };
    const trovate = [];
    for (let skip = 0, giri = 0; giri < 100; giri++) {
      const pagina = await base44.asServiceRole.entities.ContenutoEsteso.filter(filtro, 'id', 5000, skip);
      trovate.push(...pagina);
      if (pagina.length === 0 || (pagina.length < 5000 && pagina.length % 1000 !== 0)) break;
      skip += pagina.length;
    }
    const perChiave = new Map();
    for (const p of trovate) {
      const k = chiave(entita, p.record_id, p.campo);
      if (!perChiave.has(k)) perChiave.set(k, []);
      perChiave.get(k).push(p);
    }
    for (const r of gruppo) for (const c of campi) cache.set(chiave(entita, String(r.id), c), perChiave.get(chiave(entita, String(r.id), c)) || []);
  }
}

async function parti(base44, entita, id, campo) {
  const out = [];
  for (let skip = 0; skip < 20000; skip += 1000) {
    const pagina = await base44.asServiceRole.entities.ContenutoEsteso.filter({ entita, record_id: String(id), campo }, 'parte', 1000, skip);
    out.push(...pagina);
    if (pagina.length < 1000) break;
  }
  return out;
}

/**
 * Valore da scrivere nel campo: il testo stesso se entra, altrimenti il segnaposto
 * dopo aver salvato le parti (quelle di prima per lo stesso campo si cancellano).
 */
export async function valoreCampo(base44, entita, id, campo, testo) {
  const t = String(testo ?? '');
  await eliminaCampo(base44, entita, id, campo);
  dimentica(base44, entita, String(id), campo);
  if (t.length <= LUNGHEZZA_PARTE) return t;
  const pezzi = [];
  for (let i = 0; i < t.length; i += LUNGHEZZA_PARTE) pezzi.push(t.slice(i, i + LUNGHEZZA_PARTE));
  const record = pezzi.map((p, i) => ({ entita, record_id: String(id), campo, parte: i + 1, totale: pezzi.length, testo: p }));
  for (let i = 0; i < record.length; i += 50) await base44.asServiceRole.entities.ContenutoEsteso.bulkCreate(record.slice(i, i + 50));
  return `@parti:${pezzi.length}`;
}

/** Testo completo di un campo, ricomposto se diviso in parti. */
export async function leggiCampo(base44, entita, record, campo) {
  const valore = record ? String(record[campo] ?? '') : '';
  const m = valore.match(SEGNAPOSTO);
  if (!m) return valore;
  const cache = letteInBlocco.get(base44);
  const precaricate = cache && cache.get(chiave(entita, String(record.id), campo));
  const elenco = (precaricate && precaricate.length === Number(m[1]) ? [...precaricate] : await parti(base44, entita, record.id, campo)).sort((a, b) => a.parte - b.parte);
  if (elenco.length !== Number(m[1])) throw new Error(`Testo di ${entita}.${campo} incompleto: ${elenco.length} parti su ${m[1]}`);
  return elenco.map(p => p.testo).join('');
}

/** JSON di un campo, ricomposto se diviso in parti. */
export async function leggiJson(base44, entita, record, campo, vuoto = []) {
  const testo = await leggiCampo(base44, entita, record, campo);
  return testo ? JSON.parse(testo) : vuoto;
}

/**
 * Cancella le parti di un campo, o di tutti i campi del record se campo e'
 * omesso, con una sola richiesta. Senza entita' o record non cancella niente:
 * il filtro diventerebbe troppo largo.
 */
export async function eliminaCampo(base44, entita, id, campo = null) {
  if (!entita || id === undefined || id === null || String(id) === '') throw new Error('eliminaCampo: servono entita e record');
  const filtro = campo ? { entita, record_id: String(id), campo } : { entita, record_id: String(id) };
  await base44.asServiceRole.entities.ContenutoEsteso.deleteMany(filtro);
  dimentica(base44, entita, String(id), campo);
}
