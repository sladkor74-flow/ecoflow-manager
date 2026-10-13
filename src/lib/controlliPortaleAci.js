// I controlli del portale sugli ordini ACI, per la pagina Terminati ACI (audit
// del 20/09, alte A12 e A13; corrette il 12/10/2026).
//
// Le due regole del portale (AGENTS.md, «Le due regole del portale sull'ACI»):
// una richiesta ACI non si stima sotto i 1.500 kg, e un formulario non si chiude
// a piu' del 10% del peso stimato del suo ticket. E lo stesso formulario due
// volte sullo STESSO ordine e' un ritiro caricato due volte. Fino a oggi le
// controllava solo la fatturazione passiva, e in dashboard ne arrivava il
// numero, all'amministratore: chi guardava i terminati ACI non vedeva ne' il
// ticket ne' lo stimato, e un ordine fuori regola si scopriva in fattura.
//
// Le soglie sono quelle della passiva e la regola del formulario doppio e' la
// sua (formulariDoppi): la pagina e la fattura devono dire la stessa cosa dello
// stesso ordine. Dalla revisione del 13/10/2026 le soglie non sono piu' una
// copia: stanno in formulari (base44/shared/formulari.ts e lo specchio
// src/lib/formulari.js) e si importano da li'. Si riesportano per chi le
// leggeva da qui. prove/terminatiAci.mjs controlla che la passiva dica le stesse.
import { formulariDoppi, MINIMO_ACI_KG, SOGLIA_ACI } from '@/lib/formulari';

export { MINIMO_ACI_KG, SOGLIA_ACI };

const kg = (v) => Number(v || 0);

/**
 * Gli ordini che il portale non ammetterebbe, fra le righe date (i terminati
 * contati dalla pagina):
 * - sotto_minimo: stimato sotto i 1.500 kg;
 * - oltre_soglia: effettivo oltre il 110% dello stimato del ticket, con il
 *   massimo ammesso e l'eccesso in percentuale;
 * - doppi: lo stesso formulario piu' volte sullo stesso ordine (formulariDoppi).
 * Un formulario ripartito su due ordini, ciascuno col suo ticket, non e' un
 * doppio: e' la regola del portale applicata.
 */
export function controlliPortaleAci(righe) {
  const sotto_minimo = [];
  const oltre_soglia = [];
  for (const r of righe || []) {
    const stimato = kg(r.peso_stimato), effettivo = kg(r.peso_effettivo);
    if (stimato > 0 && stimato < MINIMO_ACI_KG) sotto_minimo.push(r);
    if (stimato > 0 && effettivo > stimato * SOGLIA_ACI) {
      oltre_soglia.push({
        riga: r,
        massimo_kg: Math.round(stimato * SOGLIA_ACI),
        eccesso_perc: Math.round((effettivo / stimato - 1) * 1000) / 10,
      });
    }
  }
  return { sotto_minimo, oltre_soglia, doppi: formulariDoppi(righe || []) };
}

/**
 * Che cosa non torna di una riga, in parole: per il segno nel dettaglio.
 * `doppi` e' il risultato di controlliPortaleAci sulle righe contate.
 */
export function problemiDellaRiga(r, doppi = []) {
  const out = [];
  const stimato = kg(r.peso_stimato), effettivo = kg(r.peso_effettivo);
  if (stimato > 0 && stimato < MINIMO_ACI_KG) out.push(`stimato ${Math.round(stimato)} kg, sotto i 1.500 kg ammessi per una richiesta ACI`);
  if (stimato > 0 && effettivo > stimato * SOGLIA_ACI) out.push(`effettivo ${Math.round(effettivo)} kg oltre il 110% dello stimato del ticket (massimo ${Math.round(stimato * SOGLIA_ACI)} kg)`);
  const fir = String(r.numero_fir || '').trim().toUpperCase();
  if (fir && doppi.some(d => d.numero_fir === fir && d.righe.includes(r))) out.push(`formulario ${fir} ripetuto sullo stesso ordine: lo stesso ritiro caricato due volte`);
  return out;
}
