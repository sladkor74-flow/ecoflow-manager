import { base44 } from '@/api/base44Client';

// Specchio di base44/shared/testoLungo.ts: i testi oltre la dimensione di un campo
// sono divisi in parti nell'entita' ContenutoEsteso e il campo contiene "@parti:N".

const SEGNAPOSTO = /^@parti:(\d+)$/;

/** Testo completo di un campo, ricomposto se diviso in parti. */
export async function leggiCampo(entita, record, campo) {
  const valore = record ? String(record[campo] ?? '') : '';
  const m = valore.match(SEGNAPOSTO);
  if (!m) return valore;
  const parti = await base44.entities.ContenutoEsteso.filter({ entita, record_id: String(record.id), campo }, 'parte', 1000);
  if (parti.length !== Number(m[1])) throw new Error(`Dettaglio incompleto: ${parti.length} parti su ${m[1]}. Ricarica il file.`);
  return parti.sort((a, b) => a.parte - b.parte).map(p => p.testo).join('');
}

/** Copia del record con i campi indicati ricomposti per intero. */
export async function conCampiCompleti(entita, record, campi) {
  if (!record) return record;
  const completi = await Promise.all(campi.map(c => leggiCampo(entita, record, c)));
  return { ...record, ...Object.fromEntries(campi.map((c, i) => [c, completi[i]])) };
}

/**
 * Cancella le parti di tutti i campi di un record, con una sola richiesta (una
 * delete per parte pesava sul limite di richieste al minuto della piattaforma).
 */
export async function eliminaParti(entita, id) {
  if (!entita || id === undefined || id === null || String(id) === '') throw new Error('eliminaParti: servono entita e record');
  await base44.entities.ContenutoEsteso.deleteMany({ entita, record_id: String(id) });
}
