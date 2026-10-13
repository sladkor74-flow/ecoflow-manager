// Un formulario scritto a mano su un intervento di extra raccolta che c'e' gia'
// su un altro (audit del 20/09, alta A40; corretta il 12/10/2026).
//
// La scheda controllava solo che il FIR ci fosse. «Duplica» lo svuota, ma lo
// stesso numero riscritto a mano su due interventi passava, e da li' in fattura,
// in passiva, nelle giacenze e nelle verifiche lo stesso carico contava due volte.
// Non si blocca: puo' servire salvarlo mentre si corregge l'altro intervento, e
// decide chi salva, sapendolo. Si chiede conferma dicendo dove il numero c'e'
// gia'.
//
// Il numero si confronta come lo confrontano le verifiche e i consuntivi
// (normalizzaFir di base44/shared/numeroFir.ts): solo lettere e cifre, maiuscole.
// «rgytr 027030-cr» e «RGYTR027030CR» sono lo stesso formulario.
import { giornoRoma } from '@/lib/giornoItaliano';

export const chiaveFir = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Gli altri interventi con lo stesso formulario; `id` e' quello che si sta salvando. */
export function interventiConStessoFir(interventi, fir, id = null) {
  const k = chiaveFir(fir);
  if (!k) return [];
  return (interventi || []).filter(r => r && (!id || r.id !== id) && chiaveFir(r.numero_fir) === k);
}

const dataIt = (v) => {
  const g = giornoRoma(v);
  return g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : '';
};

/** La domanda da fare prima di salvare, con gli interventi dove il numero c'e' gia'. */
export function domandaFirGiaPresente(fir, altri) {
  const elenco = altri.slice(0, 5).map(r => {
    const fine = dataIt(r.trasporto_finito_il);
    const parti = [
      r.id_ordine ? `ordine ${r.id_ordine}` : 'intervento senza ID ordine',
      r.produttore || r.stoccaggio || '',
      r.stato ? String(r.stato).toLowerCase() : 'senza stato',
      fine ? `fine trasporto ${fine}` : '',
    ].filter(Boolean);
    return `• ${parti.join(', ')}`;
  });
  const altro = altri.length > 5 ? `\n• e altri ${altri.length - 5}` : '';
  const quanti = altri.length === 1 ? 'su un altro intervento' : `su altri ${altri.length} interventi`;
  return `Il formulario ${String(fir).trim()} è già registrato ${quanti}:\n${elenco.join('\n')}${altro}\n\n`
    + 'Lo stesso formulario su due interventi conta due volte lo stesso carico, in fattura e nelle giacenze. Salvare comunque?';
}
