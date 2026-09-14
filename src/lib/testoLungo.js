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
  if (parti.length !== Number(m[1])) throw new Error(`Dettaglio incompleto: ${parti.length} parti su ${m[1]}. Ricarica la lista.`);
  return parti.sort((a, b) => a.parte - b.parte).map(p => p.testo).join('');
}

/** Cancella le parti di tutti i campi di un record. */
export async function eliminaParti(entita, id) {
  const parti = await base44.entities.ContenutoEsteso.filter({ entita, record_id: String(id) }, 'parte', 1000);
  for (const p of parti) await base44.entities.ContenutoEsteso.delete(p.id);
}
