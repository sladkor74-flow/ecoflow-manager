// Richieste del consorzio arrivate via email, fuori dal portale.
//
// Ecotyre ci scrive per chiedere di anticipare certi ritiri: la richiesta vive in
// una mail e nel foglio "Richieste ECT" del file di gestione, dove pero' l'ID
// ordine non c'e'. Senza quello non si puo' sapere se il ritiro e' stato fatto,
// percio' lo si riconosce fra gli assegnati dal nome del produttore e dalla data
// di immissione dell'ordine - le due cose che la richiesta porta con se'.
//
// Quando quell'ordine compare fra i terminati, l'evasione si propone da sola: la
// spunta la mette l'utente, perche' e' lui a rispondere alla mail del consorzio.
import { eTerminato, giornoMovimento, dateDaSistemare, testoDate } from '@/lib/movimenti';

export const MESI_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** Le sigle di classe che il consorzio mette in coda al nome del produttore. */
const CLASSI = ['G1', 'G2', 'P+M', 'P', 'M'];

const pulisci = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
export const chiaveNome = (v) => pulisci(v).toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Separa dal nome la sigla della classe, quando c'e'. */
export function nomeEClasse(testo) {
  const t = pulisci(testo);
  for (const c of CLASSI) {
    const re = new RegExp('\\s' + c.replace('+', '\\+') + '$', 'i');
    if (re.test(t)) return { nome: t.replace(re, '').trim(), classe: c.toUpperCase() };
  }
  return { nome: t, classe: '' };
}

export function soloData(v) {
  if (!v) return null;
  // Una data letta dal foglio arriva come mezzanotte dell'ora locale: passarla
  // per toISOString la sposterebbe al giorno prima, perche' in Italia siamo
  // avanti rispetto a UTC. Si prendono percio' le cifre del calendario locale.
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (m) {
    const a = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${a}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
  }
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400000)).toISOString().slice(0, 10);
  }
  return null;
}

const ultimoDelMese = (anno, mese) => new Date(Date.UTC(anno, mese + 1, 0)).toISOString().slice(0, 10);

/**
 * Entro quando il consorzio chiede il ritiro, leggendo la nota della richiesta:
 * "DA FARE ENTRO L'11/09" da' il giorno, "entro settembre" la fine del mese,
 * "entro meta' ottobre" il quindici. Se la nota non dice niente, niente scadenza.
 */
export function scadenzaDaNota(nota, anno) {
  const t = pulisci(nota).toLowerCase();
  if (!t) return null;
  const g = t.match(/(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?/);
  if (g) {
    const a = g[3] ? (Number(g[3]) < 100 ? 2000 + Number(g[3]) : Number(g[3])) : anno;
    return `${a}-${String(Number(g[2])).padStart(2, '0')}-${String(Number(g[1])).padStart(2, '0')}`;
  }
  // con piu' mesi citati - "settembre/ottobre" - vale il piu' lontano, che e' il
  // termine ultimo di cui si e' parlato
  const trovati = MESI_IT.map((m, i) => ({ i, pos: t.lastIndexOf(m) })).filter(x => x.pos >= 0);
  if (!trovati.length) return null;
  const scelto = trovati.sort((a, b) => b.i - a.i)[0];
  const meta = /met[aà]/.test(t);
  return meta ? `${anno}-${String(scelto.i + 1).padStart(2, '0')}-15` : ultimoDelMese(anno, scelto.i);
}

/** Il testo della colonna "ordine evaso" quando non e' una data spiega perche' non si evade. */
export function leggiEvaso(v) {
  const d = soloData(v);
  if (d) return { evaso_il: d, motivo: '' };
  const t = pulisci(v);
  return { evaso_il: null, motivo: t };
}

/**
 * Le righe del foglio "Richieste ECT". L'intestazione sta sulle prime due righe
 * (la seconda distingue "ordine immesso" da "ordine evaso"), i dati dalla quarta.
 *
 * `primaRiga` e' il numero di riga del foglio a cui corrisponde il primo
 * elemento dell'elenco: il foglio non comincia dalla riga 1 e sbagliarlo
 * perderebbe la prima richiesta e sfaserebbe tutti i riferimenti.
 */
export function leggiFoglio(righe, primaRiga = 1) {
  const esito = [];
  for (let i = 0; i < righe.length; i++) {
    const r = righe[i] || [];
    const rigaExcel = primaRiga + i;
    const nomeGrezzo = pulisci(r[0]);
    if (!nomeGrezzo) continue;
    if (/^richiesta\s+ect$/i.test(nomeGrezzo)) continue;
    // Le intestazioni non portano una data di immissione: e' cosi' che si
    // distinguono dalle richieste, senza contare le righe.
    if (!soloData(r[2])) continue;
    const { nome, classe } = nomeEClasse(nomeGrezzo);
    const immesso = soloData(r[2]);
    const { evaso_il, motivo } = leggiEvaso(r[3]);
    esito.push({
      riga_excel: rigaExcel,
      pdr_nome: nome,
      classe,
      provincia: pulisci(r[1]).toUpperCase(),
      ordine_immesso_il: immesso,
      trasportatore: pulisci(r[4]),
      mail_inviata_il: soloData(r[5]),
      nota: pulisci(r[6]),
      evaso_il,
      motivo_annullamento: motivo,
    });
  }
  return esito;
}

/** La classe di un ordine ridotta alla sigla: "P - fino a 35 kg (auto/moto)" -> "P". */
export const siglaClasse = (v) => pulisci(v).toUpperCase().split(/[\s-]/)[0];

/**
 * Riconosce l'ID ordine fra gli assegnati e i terminati: stesso produttore,
 * stessa data di immissione. La classe, quando la richiesta la indica, restringe.
 */
/** Quanti giorni separano due date. */
const distanza = (a, b) => (a && b ? Math.abs((Date.parse(a) - Date.parse(b)) / 86400000) : 999);

/**
 * La data della richiesta e quella dell'ordine a volte ballano di un giorno o
 * due - la mail arriva quando l'ordine e' appena stato immesso - percio' dopo il
 * confronto esatto si allarga di qualche giorno, e quel riconoscimento resta
 * marcato come approssimato.
 */
export const GIORNI_TOLLERANZA = 3;

const eCancellato = (o) => /cancell|annull/i.test(String(o.stato || ''));

export function riconosciOrdine(richiesta, ordini) {
  const vuoto = { id_ordine_stato: 'non_trovato', id_ordine: '', id_ordine_candidati: '' };
  if (!richiesta.ordine_immesso_il) return vuoto;
  const k = chiaveNome(richiesta.pdr_nome);
  if (!k) return vuoto;

  const suoi = ordini.filter(o => {
    const ko = chiaveNome(o.punto_di_raccolta);
    return ko && (ko === k || ko.includes(k) || k.includes(ko));
  });
  if (!suoi.length) return vuoto;

  const perClasse = (lista) => {
    if (!richiesta.classe || lista.length <= 1) return lista;
    const filtrati = lista.filter(o => {
      const s = siglaClasse(o.classe);
      return richiesta.classe === 'P+M' ? (s === 'P' || s === 'M') : s === richiesta.classe;
    });
    return filtrati.length ? filtrati : lista;
  };
  // Un ordine cancellato non e' quello che il consorzio ci chiede di ritirare:
  // si guarda solo se non ce ne sono altri.
  const senzaCancellati = (lista) => {
    const vivi = lista.filter(o => !eCancellato(o));
    return vivi.length ? vivi : lista;
  };
  const idDi = (lista) => [...new Set(lista.map(o => pulisci(o.id_ordine)).filter(Boolean))];

  for (const giorni of [0, GIORNI_TOLLERANZA]) {
    const vicini = suoi.filter(o => distanza(soloData(o.ordine_immesso_il), richiesta.ordine_immesso_il) <= giorni);
    if (!vicini.length) continue;
    const ids = idDi(senzaCancellati(perClasse(vicini)));
    if (ids.length === 1) return { id_ordine_stato: giorni === 0 ? 'trovato' : 'approssimato', id_ordine: ids[0], id_ordine_candidati: '' };
    if (ids.length > 1) return { id_ordine_stato: 'ambiguo', id_ordine: '', id_ordine_candidati: ids.join(', ') };
  }
  return vuoto;
}

/**
 * Stato della richiesta. L'evasione trovata fra i terminati non chiude la
 * richiesta: la propone, perche' la spunta la mette l'utente, che poi risponde
 * alla mail del consorzio.
 */
export function statoRichiesta(r) {
  if (r.motivo_annullamento) return 'annullata';
  if (r.evasione_confermata) return 'evasa';
  if (r.evaso_il || r.evasione_rilevata_il) return 'da_confermare';
  return 'aperta';
}

/**
 * Gli ID ordine di una richiesta. Un produttore con piu' richieste aperte puo'
 * averne piu' di uno sulla stessa riga - le classi P e M dello stesso giorno, per
 * esempio - e quelli scritti a mano vincono sempre sul riconoscimento automatico.
 */
export function listaOrdini(r) {
  const scritti = String((r && r.id_ordine_manuale) || '').split(/[,;\s]+/).map(x => x.trim()).filter(Boolean);
  if (scritti.length) return [...new Set(scritti)];
  const auto = String((r && r.id_ordine) || '').trim();
  return auto ? [auto] : [];
}

/**
 * Quanti degli ordini di una richiesta risultano ritirati e quando si e' chiuso
 * l'ultimo. La richiesta e' evasa solo quando lo sono tutti: se ne resta uno
 * aperto il ritiro non e' finito, e dirlo evaso sarebbe sbagliato.
 */
export function evasioneOrdini(ids, terminati) {
  const date = ids.map(id => terminati.get(id) || null);
  const fatti = date.filter(Boolean);
  return {
    totali: ids.length,
    evasi: fatti.length,
    ultima: ids.length > 0 && fatti.length === ids.length ? fatti.sort().reverse()[0] : null,
  };
}

/**
 * I ritiri fra i movimenti di primaria: id ordine -> primo giorno italiano di
 * fine trasporto, dei soli terminati che ce l'hanno. Lo usano il caricamento del
 * foglio ECT (importaRichiesteEct) e il ricalcolo dopo le primarie (importaBlocco,
 * ritiri_ect), che cosi' non possono dire due cose diverse.
 *
 * Un terminato senza fine trasporto non conta come ritirato, e non si ripiega
 * sulla chiusura a portale (regola 1). Si esclude ma non si perde: resta in
 * `senzaFine`, perche' la richiesta che lo aspetta resterebbe aperta e in
 * ritardo senza che nessuno lo dica, e si rischierebbe di sollecitare un ritiro
 * che c'e' ma non ha ancora la data.
 *
 * Un ritiro con la fine trasporto ma senza immissione o inizio, o con le date
 * incoerenti, conta come ritirato, ma le tre date sono obbligatorie (regola
 * dell'utente del 22/09/2026): resta in `daSistemare`, id -> testoDate(), perche'
 * la richiesta che evade si dica evasa con le date da correggere.
 */
export function ritiriTerminati(movimenti) {
  const terminati = new Map();
  const senzaFine = new Set();
  const daSistemare = new Map();
  for (const o of movimenti || []) {
    const id = String((o && o.id_ordine) || '').trim();
    if (!id || !eTerminato(o)) continue;
    const giorno = giornoMovimento(o);
    if (!giorno) { senzaFine.add(id); continue; }
    if (!terminati.has(id) || giorno < terminati.get(id)) terminati.set(id, giorno);
    if (dateDaSistemare(o) && !daSistemare.has(id)) daSistemare.set(id, testoDate(o));
  }
  // basta una riga con la data perche' l'ordine risulti ritirato
  for (const id of terminati.keys()) senzaFine.delete(id);
  return { terminati, senzaFine, daSistemare };
}

/**
 * Gli ordini di una richiesta ritirati ma con le date obbligatorie da sistemare:
 * [{ pdr, id_ordine, date }], uno per ordine. Lo usano il caricamento del foglio
 * ECT e il ricalcolo dopo le primarie.
 */
export function ordiniConDateDaSistemare(pdr, ids, terminati, daSistemare) {
  return (ids || []).filter(id => terminati.has(id) && daSistemare.has(id)).map(id => ({ pdr, id_ordine: id, date: daSistemare.get(id) }));
}

/**
 * La riga da mostrare per le richieste evase, o in parte evase, da ordini con le
 * date obbligatorie da sistemare. Vuota se non ce ne sono.
 */
export function testoOrdiniDateDaSistemare(lista) {
  const n = (lista || []).length;
  if (!n) return '';
  const quali = lista.slice(0, 5).map(x => `${x.pdr} (${x.id_ordine}: ${x.date})`).join(', ') + (n > 5 ? ` e altri ${n - 5}` : '');
  return n === 1
    ? `Un ordine che evade una richiesta del consorzio ha le date obbligatorie da sistemare (immissione, inizio e fine trasporto): il ritiro conta, ma il formulario va corretto nel file del portale (${quali}).`
    : `${n} ordini che evadono richieste del consorzio hanno le date obbligatorie da sistemare (immissione, inizio e fine trasporto): i ritiri contano, ma i formulari vanno corretti nel file del portale (${quali}).`;
}

/**
 * L'ID riconosciuto da salvare su una richiesta, dato quello che c'e' gia' (o
 * null) e l'esito di `riconosciOrdine`. Un ID gia' riconosciuto si sostituisce
 * solo con un altro ID, mai con "non trovato" o "ambiguo": un secondo ordine
 * dello stesso produttore nato lo stesso giorno rende ambiguo il riconoscimento,
 * e riscrivendolo la richiesta perdeva l'ordine e con lui il ritiro - tornava
 * aperta, col rischio di sollecitare un ritiro gia' fatto. La regola e' la
 * stessa per il caricamento del foglio ECT e per il ricalcolo dopo le primarie:
 * prima l'esito dipendeva da quale dei due aveva girato per ultimo. Gli ID
 * scritti a mano non passano di qui: vincono sempre (listaOrdini).
 */
export function idOrdineDaSalvare(gia, ric) {
  const da = !ric.id_ordine && gia && String(gia.id_ordine || '').trim() ? gia : ric;
  return { id_ordine: da.id_ordine, id_ordine_stato: da.id_ordine_stato, id_ordine_candidati: da.id_ordine_candidati };
}

/**
 * La riga da mostrare per le richieste aperte che aspettano un ordine terminato a
 * portale ma senza fine trasporto: [{ pdr, id_ordine }]. Vuota se non ce ne sono.
 */
export function testoTerminatiSenzaFine(lista) {
  const n = (lista || []).length;
  if (!n) return '';
  const quali = lista.slice(0, 5).map(x => (x.id_ordine ? `${x.pdr} (${x.id_ordine})` : x.pdr)).join(', ') + (n > 5 ? ` e altre ${n - 5}` : '');
  return n === 1
    ? `Una richiesta del consorzio ha l'ordine terminato ma senza data di fine trasporto: resta aperta finché la data non arriva (${quali}).`
    : `${n} richieste del consorzio hanno l'ordine terminato ma senza data di fine trasporto: restano aperte finché la data non arriva (${quali}).`;
}

export function giorniAllaScadenza(scadenza, oggi) {
  if (!scadenza) return null;
  const a = Date.UTC(+oggi.slice(0, 4), +oggi.slice(5, 7) - 1, +oggi.slice(8, 10));
  const b = Date.UTC(+scadenza.slice(0, 4), +scadenza.slice(5, 7) - 1, +scadenza.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

/**
 * L'identita' di una richiesta: produttore, classe e data di immissione
 * dell'ordine, piu' il giorno della mail (il consorzio puo' sollecitare due
 * volte lo stesso ordine). Mai il numero di riga del foglio: basta ordinare il
 * foglio o inserirci una riga perche' tutte le successive cambino numero, e le
 * spunte e gli ID scritti a mano finirebbero su altre richieste, senza errore.
 */
export const chiaveRichiesta = (r, conMail = true) =>
  [chiaveNome(r && r.pdr_nome), pulisci(r && r.classe).toUpperCase(), soloData(r && r.ordine_immesso_il) || '', conMail ? (soloData(r && r.mail_inviata_il) || '') : ''].join('|');

/**
 * Abbina le righe lette dal foglio alle richieste gia' in elenco. Ogni richiesta
 * esistente si abbina una volta sola. Nell'ordine: stessa identita' completa;
 * stessa identita' senza il giorno della mail (nel foglio e' stata corretta o
 * aggiunta); stesso produttore sulla stessa riga (e' stata corretta la data di
 * immissione). Fra piu' candidate uguali - due ordini dello stesso produttore
 * lo stesso giorno - vince quella che somiglia di piu' per nota, trasportatore e
 * posizione nel foglio. Restituisce, per ogni riga, la richiesta o null.
 */
export function abbinaRichieste(righe, esistenti) {
  const libere = new Set(esistenti || []);
  const somiglianza = (r, e) =>
    (pulisci(r.nota) === pulisci(e.nota) ? 4 : 0) +
    (pulisci(r.trasportatore).toUpperCase() === pulisci(e.trasportatore).toUpperCase() ? 2 : 0) +
    (pulisci(r.provincia).toUpperCase() === pulisci(e.provincia).toUpperCase() ? 1 : 0) +
    (r.riga_excel && r.riga_excel === e.riga_excel ? 1 : 0);
  const esito = new Array((righe || []).length).fill(null);
  const passata = (criterio) => {
    (righe || []).forEach((r, i) => {
      if (esito[i]) return;
      let scelta = null, punti = -1;
      for (const e of libere) {
        if (!criterio(r, e)) continue;
        const p = somiglianza(r, e);
        if (p > punti) { scelta = e; punti = p; }
      }
      if (scelta) { esito[i] = scelta; libere.delete(scelta); }
    });
  };
  passata((r, e) => chiaveRichiesta(r) === chiaveRichiesta(e));
  passata((r, e) => chiaveRichiesta(r, false) === chiaveRichiesta(e, false));
  passata((r, e) => !!r.riga_excel && r.riga_excel === e.riga_excel && chiaveNome(r.pdr_nome) === chiaveNome(e.pdr_nome));
  return esito;
}
