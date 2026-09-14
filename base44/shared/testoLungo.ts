// Testi lunghi (liste, esiti dei controlli) oltre la dimensione massima di un campo.
//
// Un campo di un record accetta circa 20 KB: un testo piu' lungo si divide in parti
// salvate nell'entita' ContenutoEsteso e nel campo resta un segnaposto "@parti:N".
// Chi legge usa leggiCampo, che ricompone il testo; i testi brevi restano nel campo.
// Specchio nel frontend: src/lib/testoLungo.js.

export const LUNGHEZZA_PARTE = 8000;
const SEGNAPOSTO = /^@parti:(\d+)$/;

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
  const elenco = (await parti(base44, entita, record.id, campo)).sort((a, b) => a.parte - b.parte);
  if (elenco.length !== Number(m[1])) throw new Error(`Testo di ${entita}.${campo} incompleto: ${elenco.length} parti su ${m[1]}`);
  return elenco.map(p => p.testo).join('');
}

/** JSON di un campo, ricomposto se diviso in parti. */
export async function leggiJson(base44, entita, record, campo, vuoto = []) {
  const testo = await leggiCampo(base44, entita, record, campo);
  return testo ? JSON.parse(testo) : vuoto;
}

/** Cancella le parti di un campo, o di tutti i campi del record se campo e' omesso. */
export async function eliminaCampo(base44, entita, id, campo = null) {
  const filtro = campo ? { entita, record_id: String(id), campo } : { entita, record_id: String(id) };
  const vecchie = await base44.asServiceRole.entities.ContenutoEsteso.filter(filtro, 'parte', 1000);
  for (const p of vecchie) await base44.asServiceRole.entities.ContenutoEsteso.delete(p.id);
}
