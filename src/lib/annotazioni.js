// LE ANNOTAZIONI DELLA TO-DO LIST (15/10/2026).
//
// Richiesta dell'utente, testuale: «nella to-do list permetti la modifica delle
// richieste aperte per successive integrazioni e\o annotazioni». Fino a quel
// giorno un'attivita' si scriveva una volta e poi si poteva solo spuntare, e una
// richiesta ECT aveva solo l'ID ordine da correggere: un sollecito fatto, una
// risposta ricevuta, un'integrazione non avevano un posto dove stare.
//
// Un'annotazione e' una riga che si ACCODA: { id, testo, scritta_il, scritta_da }
// - scritta_il e' l'istante (a video giorno e ora italiani), scritta_da l'email
// di chi era collegato. Stanno nell'archivio stesso, nel campo `annotazioni`
// di Todo e di RichiestaEct (un elenco, con lo schema nel .jsonc), nell'ordine
// in cui sono state scritte. Le regole:
// - si aggiungono e NON si cancellano: nessuna scrittura toglie una riga, e chi
//   scrive rilegge il record appena prima (scriviAnnotazioni), cosi' una riga
//   scritta da un'altra scheda aperta non si perde;
// - una riga scritta si puo' correggere (solo l'amministratore, come tutte le
//   scritture) e la correzione lo dice: corretta_il e corretta_da, e il testo
//   scritto la prima volta resta in testo_originale («vale il piu' recente, il
//   superato resta scritto», regola di tutto il gestionale);
// - le scrive SOLO la pagina To-Do List: il controllo degli ordini che chiude le
//   attivita' da solo (controllaTodoOrdini), il caricamento del foglio Richieste
//   ECT (importaRichiesteEct) e il ricalcolo dei ritiri dopo le primarie
//   (importaBlocco, ritiri_ect) scrivono solo i campi che calcolano, e questo
//   campo non c'e' fra quelli (prove/todoModificaAnnotazioni.mjs, sul banco).
//
// Questo file non importa niente apposta: si prova con node cosi' com'e'.

/** Quanto puo' essere lunga un'annotazione: e' una nota, non un documento. */
export const MAX_TESTO = 2000;

// I formatter si creano una volta: il giorno all'italiana e l'ora sulle 24 ore,
// tutti e due nel fuso italiano (l'istante salvato e' UTC).
const GIORNO = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' });
const ORA = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Giorno e ora italiani di un istante: '15/10/2026 alle 14:32'. '' se non e' un istante. */
export function quandoItaliano(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return `${GIORNO.format(d)} alle ${ORA.format(d)}`;
}

/** Le annotazioni salvate su un record, cosi' come sono e nell'ordine in cui sono salvate. */
export function annotazioniSalvate(record) {
  const a = record && record.annotazioni;
  return Array.isArray(a) ? a.filter(x => x && typeof x === 'object') : [];
}

/** In ordine di tempo, la piu' vecchia prima; a parita' (o senza istante) vale l'ordine salvato. */
export function inOrdineDiTempo(elenco) {
  return (elenco || [])
    .map((a, i) => ({ a, i, t: Date.parse(a && a.scritta_il) }))
    .sort((x, y) => (Number.isFinite(x.t) && Number.isFinite(y.t) && x.t !== y.t ? x.t - y.t : x.i - y.i))
    .map(x => x.a);
}

/**
 * Le ultime `n` in ordine di tempo, e quante ne restano fuori: la riga ne mostra
 * due e «tutte (N)» apre le altre.
 */
export function ultime(elenco, n = 2) {
  const t = inOrdineDiTempo(elenco);
  return { visibili: n > 0 ? t.slice(-n) : t, nascoste: Math.max(0, t.length - n), tutte: t.length };
}

const pulito = (t) => String(t ?? '').replace(/\r\n?/g, '\n').trim().slice(0, MAX_TESTO);

// Un identificativo per ritrovare la riga da correggere: l'istante e un pezzo a
// caso bastano, le annotazioni di un record sono una manciata.
const nuovoId = (adesso) => `${adesso.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Una riga nuova, o null se il testo e' vuoto. */
export function nuovaAnnotazione(testo, chi, adesso = new Date()) {
  const t = pulito(testo);
  if (!t) return null;
  return { id: nuovoId(adesso), testo: t, scritta_il: adesso.toISOString(), scritta_da: String(chi || '') };
}

/** L'elenco con una riga in piu' in fondo, le altre come sono. null se il testo e' vuoto. */
export function accodaAnnotazione(elenco, testo, chi, adesso = new Date()) {
  const nuova = nuovaAnnotazione(testo, chi, adesso);
  return nuova ? [...(elenco || []), nuova] : null;
}

/**
 * L'elenco con la riga `id` corretta e le altre come sono. null se la riga non
 * c'e', se il testo nuovo e' vuoto (una correzione non cancella) o e' uguale.
 * Il testo scritto la prima volta resta in testo_originale, anche dopo piu'
 * correzioni.
 */
export function correggiAnnotazione(elenco, id, testo, chi, adesso = new Date()) {
  const lista = elenco || [];
  const i = id ? lista.findIndex(a => a && a.id === id) : -1;
  const t = pulito(testo);
  if (i < 0 || !t || t === String(lista[i].testo ?? '')) return null;
  const prima = lista[i];
  const corretta = {
    ...prima,
    testo: t,
    corretta_il: adesso.toISOString(),
    corretta_da: String(chi || ''),
    testo_originale: prima.testo_originale ?? String(prima.testo ?? ''),
  };
  return lista.map((a, k) => (k === i ? corretta : a));
}

/** Che cosa si legge di una riga: { quando, chi, testo, correzione, prima }. */
export function vediAnnotazione(a) {
  const x = a || {};
  const corretta = quandoItaliano(x.corretta_il);
  return {
    quando: quandoItaliano(x.scritta_il) || 'giorno non registrato',
    chi: String(x.scritta_da || ''),
    testo: String(x.testo ?? ''),
    // Chi ha corretto si dice solo se non e' chi l'aveva scritta.
    correzione: corretta ? `corretta il ${corretta}${x.corretta_da && x.corretta_da !== x.scritta_da ? ` da ${x.corretta_da}` : ''}` : '',
    prima: corretta && x.testo_originale && x.testo_originale !== x.testo ? String(x.testo_originale) : '',
  };
}

/** Una riga in una frase sola, per un riepilogo o un foglio: 'il 15/10/2026 alle 14:32, chi: testo (corretta il ...)'. */
export function testoAnnotazione(a) {
  const v = vediAnnotazione(a);
  return `${v.quando}${v.chi ? `, ${v.chi}` : ''}: ${v.testo}${v.correzione ? ` (${v.correzione})` : ''}`;
}

/**
 * Scrive un cambio delle annotazioni di un record. `archivio` e' quello del
 * record (Todo o RichiestaEct, con get e update), `cambia(elencoSalvato)` dice
 * l'elenco nuovo (accodaAnnotazione, correggiAnnotazione) o null se non c'e'
 * niente da scrivere.
 *
 * Il record si RILEGGE appena prima di scrivere: l'elenco si salva intero, e
 * partendo da quello della pagina - letto magari un'ora prima - una riga scritta
 * nel frattempo da un'altra scheda si perderebbe. Una lettura per scrittura,
 * nessuna all'apertura. E se l'elenco nuovo perdesse una riga di quello salvato
 * non si scrive niente: le annotazioni non si cancellano.
 *
 * `altri`: altri campi del record da scrivere con la STESSA scrittura (gli
 * ordini nuovi di un'attivita' che il gestionale aveva chiuso, con la riga che
 * ricorda quella chiusura: TodoPage.jsx, revisione del 15/10/2026). Una
 * scrittura sola: il cambio e la riga che lo spiega arrivano insieme, o non
 * arriva nessuno dei due. Se `cambia` non ha niente da accodare, gli altri
 * campi si scrivono da soli.
 * Restituisce { scritto, elenco }.
 */
export async function scriviAnnotazioni(archivio, id, cambia, altri = null) {
  const campi = altri && typeof altri === 'object' ? altri : {};
  const fresco = await archivio.get(id);
  const prima = annotazioniSalvate(fresco);
  const dopo = cambia(prima);
  if (!dopo) {
    if (Object.keys(campi).length) await archivio.update(id, campi);
    return { scritto: false, elenco: prima };
  }
  const restano = Array.isArray(dopo) && dopo.length >= prima.length
    && prima.every((a, i) => (a.id ? dopo.some(b => b && b.id === a.id) : dopo[i] === a));
  if (!restano) throw new Error('un’annotazione già scritta andrebbe persa, e non si salva niente');
  await archivio.update(id, { ...campi, annotazioni: dopo });
  return { scritto: true, elenco: dopo };
}
