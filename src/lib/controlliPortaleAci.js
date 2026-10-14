// I controlli del portale sugli ordini ACI, per la pagina Terminati ACI (audit
// del 20/09, alte A12 e A13; corrette il 12/10/2026) e, per lo stimato sotto i
// 1.500 kg, per gli Assegnati ACI (13/10/2026): un ordine ancora da evadere
// stimato troppo basso si fa correggere al consorzio prima del ritiro.
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
// I chili di una frase all'italiana, col punto delle migliaia: «1.400 kg», non
// «1400 kg» (13/10/2026). Qui, senza dipendere dalle impostazioni del browser.
const kgIt = (v) => String(Math.round(kg(v))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Lo stimato sotto i 1.500 kg: la regola del portale per una richiesta ACI.
 * Un ordine senza stimato non e' sotto il minimo: un dato che manca non e' zero.
 * La usano i Terminati ACI e, dal 13/10/2026, gli Assegnati ACI: la regola e'
 * del portale, e il gestionale la segnala soltanto («nessun aci può avere uno
 * stimato inferiore a 1.500 kg, se negli assegnati del portale è indicato così
 * limitati a segnalarlo e provvederemo a farlo modificare al consorzio»,
 * l'utente, 13/10/2026).
 */
export const stimatoSottoMinimo = (r) => {
  const stimato = kg(r && r.peso_stimato);
  return stimato > 0 && stimato < MINIMO_ACI_KG;
};

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
    if (stimatoSottoMinimo(r)) sotto_minimo.push(r);
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
  if (stimatoSottoMinimo(r)) out.push(`stimato ${kgIt(stimato)} kg, sotto i 1.500 kg ammessi per una richiesta ACI`);
  if (stimato > 0 && effettivo > stimato * SOGLIA_ACI) out.push(`effettivo ${kgIt(effettivo)} kg oltre il 110% dello stimato del ticket (massimo ${kgIt(stimato * SOGLIA_ACI)} kg)`);
  const fir = String(r.numero_fir || '').trim().toUpperCase();
  if (fir && doppi.some(d => d.numero_fir === fir && d.righe.includes(r))) out.push(`formulario ${fir} ripetuto sullo stesso ordine: lo stesso ritiro caricato due volte`);
  return out;
}
