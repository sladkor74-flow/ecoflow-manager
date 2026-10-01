// Specchio di base44/shared/termineRegistrazione.ts: il termine per registrare
// un formulario, dieci giorni dalla partenza con le domeniche fuori dal conto.
// Le pagine non possono importare da base44/shared e questa regola serve anche
// a loro: la scheda e il PDF di una verifica dicono quanto resta o da quanto e'
// scaduto. Le due copie restano uguali perche' prove/specchi.mjs lo controlla.

export const GIORNI_TERMINE_REGISTRAZIONE = 10;

// Quanti giorni utili prima della scadenza si comincia ad avvisare.
export const GIORNI_PREAVVISO = 3;

const PASSI_MASSIMI = 4000;

const eGiorno = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const utc = (g) => new Date(Date.UTC(+g.slice(0, 4), +g.slice(5, 7) - 1, +g.slice(8, 10)));
const giorno = (d) => d.toISOString().slice(0, 10);

// Le domeniche non si contano. I sabati si', perche' cosi' li conta l'ufficio.
export const eDaNonContare = (g) => eGiorno(g) && utc(g).getUTCDay() === 0;

/**
 * Il giorno entro cui va registrato un formulario partito il giorno `partenza`:
 * dieci giorni utili dopo, domeniche escluse. '' se la data non c'e'.
 */
export function scadenzaRegistrazione(partenza, giorni = GIORNI_TERMINE_REGISTRAZIONE) {
  if (!eGiorno(partenza)) return '';
  const d = utc(partenza);
  let restanti = giorni;
  for (let passi = 0; restanti > 0 && passi < PASSI_MASSIMI; passi++) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0) restanti--;
  }
  return giorno(d);
}

/**
 * I giorni utili da `da` (escluso) ad `a` (incluso), domeniche fuori dal conto.
 * Negativo se `a` viene prima di `da`, cosi' lo stesso conto dice sia quanto
 * resta sia da quanto e' passato. null se una delle due date non c'e'.
 */
export function giorniUtili(da, a) {
  if (!eGiorno(da) || !eGiorno(a)) return null;
  if (da === a) return 0;
  const avanti = a > da;
  const dal = utc(avanti ? da : a);
  const al = avanti ? a : da;
  let n = 0;
  for (let passi = 0; passi < PASSI_MASSIMI; passi++) {
    dal.setUTCDate(dal.getUTCDate() + 1);
    if (dal.getUTCDay() !== 0) n++;
    if (giorno(dal) >= al) break;
  }
  return avanti ? n : -n;
}

/**
 * Come sta un termine rispetto a oggi:
 * { stato: 'scaduto' | 'in_scadenza' | 'nei_termini', giorni }
 * dove giorni sono i giorni utili oltre il termine (scaduto) o quelli che
 * restano. null se il termine non c'e'.
 *
 * Il conto si fa qui e non si salva nell'esito: dipende da che giorno e' oggi, e
 * salvato farebbe risultare "cambiato" ogni esito ogni giorno, riscrivendo le
 * verifiche per niente. Nell'esito sta la scadenza, che non cambia piu'.
 */
export function statoTermine(scadenza, oggi) {
  if (!eGiorno(scadenza) || !eGiorno(oggi)) return null;
  const restanti = giorniUtili(oggi, scadenza);
  if (scadenza < oggi) return { stato: 'scaduto', giorni: -restanti };
  if (restanti <= GIORNI_PREAVVISO) return { stato: 'in_scadenza', giorni: restanti };
  return { stato: 'nei_termini', giorni: restanti };
}

const it = (g) => (eGiorno(g) ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : '');
const quanti = (n) => `${n} ${n === 1 ? 'giorno' : 'giorni'}`;

/**
 * Il termine in parole, per la pagina, il PDF e gli alert:
 * "termine scaduto il 25/09/2026, da 4 giorni utili".
 * '' se il termine non c'e'.
 */
export function testoTermine(scadenza, oggi) {
  const t = statoTermine(scadenza, oggi);
  if (!t) return '';
  if (t.stato === 'scaduto') return `termine per la registrazione scaduto il ${it(scadenza)}, da ${quanti(t.giorni)} utili`;
  if (t.stato === 'in_scadenza') return t.giorni === 0
    ? `ultimo giorno utile per registrarlo: oggi, ${it(scadenza)}`
    : `da registrare entro il ${it(scadenza)}: ${quanti(t.giorni)} utili`;
  return `da registrare entro il ${it(scadenza)}`;
}

/**
 * "termine di registrazione: 25/09/2026", senza niente che dipenda da oggi.
 * Per i testi che restano scritti - gli alert - dove "scaduto da 4 giorni"
 * invecchierebbe sul posto e finirebbe per dire meno di quanto e' vero.
 */
export const testoScadenza = (scadenza) => (eGiorno(scadenza) ? `termine di registrazione: ${it(scadenza)}` : '');

/**
 * Il termine come si scrive nell'esito salvato, senza niente che dipenda da
 * oggi: { partenza, partenza_da, scadenza, giorni }.
 *
 * partenza_da dice da quale data si conta, e serve a leggerlo con la cautela
 * giusta: 'gestionale' e' l'inizio trasporto registrato; 'report' l'inizio
 * trasporto scritto nel file; 'report_arrivo' la data del carico quando il file
 * ne porta una sola, che e' l'arrivo e non la partenza - il termine vero scade
 * prima, perche' la partenza e' quel giorno o prima.
 */
export function termineDi(partenza, partenza_da) {
  if (!eGiorno(partenza)) return null;
  const scadenza = scadenzaRegistrazione(partenza);
  return { partenza, partenza_da, scadenza, giorni: GIORNI_TERMINE_REGISTRAZIONE };
}

/** "10 giorni dalla partenza del 14/09/2026, domeniche escluse" */
export function testoConteggio(termine) {
  if (!termine) return '';
  const dove = termine.partenza_da === 'report_arrivo' ? " (data dell'arrivo: la partenza e' quel giorno o prima)" : '';
  return `${quanti(termine.giorni || GIORNI_TERMINE_REGISTRAZIONE)} dalla partenza del ${it(termine.partenza)}${dove}, domeniche escluse`;
}
