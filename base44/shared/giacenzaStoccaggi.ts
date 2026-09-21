// Quanto materiale ha davvero uno stoccaggio, adesso, un canale per volta.
//
// La rilevazione fotografa il saldo del portale per classe: P, M, G1 e G2 sono
// la rete, la classe 9 e' l'ACI. Per avere la giacenza di oggi si parte dalla
// fotografia e si contano i movimenti di quel canale finiti dopo.
//
// Tre regole dell'utente, senza eccezioni (21/09/2026):
// - un movimento conta dalla FINE DEL TRASPORTO, sul giorno italiano; la data di
//   chiusura dell'ordine a portale non decide nulla, nemmeno come ripiego: un
//   movimento senza fine trasporto non si conta;
// - la giacenza segue ogni caricamento: entrate e uscite dopo la rilevazione;
// - rete, ACI ed extra raccolta non si sommano mai. L'extra raccolta a portale
//   non c'e': la sua giacenza si tiene a parte.
//
// Il taglio e' il GIORNO della rilevazione: i movimenti di quel giorno si
// considerano dentro, perche' chi la scrive la sera sta gia' guardando un portale
// aggiornato; contano quelli finiti dal giorno dopo. E' la stessa regola di
// Dichiarazioni Impianti, Giacenze e Predittivita': un carico non puo' risultare
// dentro per un modulo e fuori per un altro.
import { giornoRoma } from "./giornoItaliano.ts";

/** Un valore di data in millisecondi, trattando come UTC cio' che non porta fuso. */
export function istante(v) {
  if (!v) return null;
  const s = String(v);
  const d = new Date(/Z$|[+-]\d\d:\d\d$/.test(s) || s.length <= 10 ? s : s + 'Z');
  return isNaN(d.getTime()) ? null : d.getTime();
}

/** Il giorno a cui si riferisce una rilevazione di giacenza, 'AAAA-MM-GG'. */
export function momentoRilevazione(rec) {
  if (!rec) return '';
  return rec.data_rilevazione ? String(rec.data_rilevazione).slice(0, 10) : giornoRoma(rec.created_date);
}

/** Vero se il trasporto del movimento e' finito dopo il giorno della rilevazione. */
export function dopoLaRilevazione(movimento, giorno) {
  const g = giornoRoma(movimento && movimento.trasporto_finito_il);
  return !!g && !!giorno && g > giorno;
}

/** L'ultima rilevazione per ciascuno stoccaggio, per chiave normalizzata. */
export function ultimeRilevazioni(rilevazioni, chiaveDi) {
  const per = new Map();
  for (const r of rilevazioni || []) {
    const k = chiaveDi(r.sito);
    if (!k) continue;
    const quando = momentoRilevazione(r);
    const prima = per.get(k);
    // A parita' di giorno vale quella registrata per ultima.
    const piuRecente = !prima || quando > prima.quando
      || (quando === prima.quando && String(r.created_date || '') > String(prima.record.created_date || ''));
    if (piuRecente) per.set(k, { record: r, quando, data: quando });
  }
  return per;
}

/** I kg delle sole classi di rete di una rilevazione: la classe 9 e' ACI. */
export const kgReteDiRilevazione = (rec) =>
  ['class1_kg', 'class2_kg', 'class3_kg', 'class4_kg'].reduce((s, c) => s + (Number(rec && rec[c]) || 0), 0);

/** I kg ACI di una rilevazione: la classe 9, e basta. */
export const kgAciDiRilevazione = (rec) => Number(rec && rec.class9_kg) || 0;
