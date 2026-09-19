// Quanto materiale ha davvero uno stoccaggio, adesso.
//
// La rilevazione fotografa il saldo del portale in un istante; da allora il
// portale lo aggiorna a ogni ordine chiuso. Per avere la giacenza di oggi si
// parte dalla fotografia e si contano i movimenti arrivati dopo.
//
// Due accortezze, e sono proprio quelle che facevano divergere i moduli:
//
// - il momento della fotografia non e' il giorno della rilevazione ma il primo
//   fra quello e l'istante in cui e' stata registrata, perche' chi la scrive la
//   sera sta gia' guardando un portale aggiornato;
// - un movimento conta dalla CHIUSURA dell'ordine, non dalla fine del trasporto,
//   perche' e' alla chiusura che il portale aggiorna il saldo. E' l'unica
//   eccezione alla regola generale del gestionale, dove il periodo lo da' sempre
//   la fine del trasporto, ed e' verificata al chilogrammo su Nappi Sud il
//   16/09/2026: rilevazione del 13/09 piu' dieci ingressi meno due uscite
//   coincide con il portale, classe per classe.
//
// La predittivita' delle secondarie usava invece la data di fine trasporto
// confrontata con il giorno della rilevazione, e uno stesso carico risultava
// dentro per le Giacenze e fuori per la Predittivita': la pagina scriveva "ne
// mancano due viaggi" su un mese in cui il materiale c'era.

/** Un valore di data in millisecondi, trattando come UTC cio' che non porta fuso. */
export function istante(v) {
  if (!v) return null;
  const s = String(v);
  const d = new Date(/Z$|[+-]\d\d:\d\d$/.test(s) || s.length <= 10 ? s : s + 'Z');
  return isNaN(d.getTime()) ? null : d.getTime();
}

/** Il momento a cui si riferisce una rilevazione di giacenza. */
export function momentoRilevazione(rec) {
  if (!rec) return 0;
  const creato = istante(rec.created_date);
  const giorno = rec.data_rilevazione ? istante(String(rec.data_rilevazione).slice(0, 10) + 'T23:00:00Z') : null;
  if (creato && giorno) return Math.min(creato, giorno);
  return creato || giorno || 0;
}

/** Vero se il movimento e' stato chiuso dopo la fotografia del portale. */
export function dopoLaRilevazione(movimento, momento) {
  const t = istante(movimento.ordine_chiuso_il || movimento.trasporto_finito_il);
  return !!t && !!momento && t > momento;
}

/** L'ultima rilevazione per ciascuno stoccaggio, per chiave normalizzata. */
export function ultimeRilevazioni(rilevazioni, chiaveDi) {
  const per = new Map();
  for (const r of rilevazioni || []) {
    const k = chiaveDi(r.sito);
    if (!k) continue;
    const quando = momentoRilevazione(r);
    const prima = per.get(k);
    if (!prima || quando > prima.quando) per.set(k, { record: r, quando, data: String(r.data_rilevazione || '').slice(0, 10) });
  }
  return per;
}

/** I kg delle sole classi di rete di una rilevazione: la classe 9 e' ACI. */
export const kgReteDiRilevazione = (rec) =>
  ['class1_kg', 'class2_kg', 'class3_kg', 'class4_kg'].reduce((s, c) => s + (Number(rec && rec[c]) || 0), 0);
