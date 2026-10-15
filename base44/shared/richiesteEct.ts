// Richieste del consorzio arrivate via email, fuori dal portale.
//
// Ecotyre ci scrive per chiedere di anticipare certi ritiri: la richiesta vive in
// una mail e nel foglio "Richieste ECT" del file di gestione. Senza l'ID ordine
// non si puo' sapere se il ritiro e' stato fatto: dal 09/10/2026 il foglio ha la
// colonna «numero d'ordine», e quando e' scritto vale come un ID scritto a mano;
// altrimenti lo si riconosce fra gli assegnati dal nome del produttore e dalla
// data di immissione dell'ordine - le due cose che la richiesta porta con se'.
//
// Quando quell'ordine compare fra i terminati, l'evasione si propone da sola: la
// spunta la mette l'utente, perche' e' lui a rispondere alla mail del consorzio.
import { eTerminato, giornoMovimento, dateDaSistemare, testoDate } from "./movimenti.ts";

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
const due = (n) => String(Number(n)).padStart(2, '0');

/**
 * Entro quando il consorzio chiede il ritiro, leggendo la nota della richiesta:
 * "DA FARE ENTRO L'11/09" da' il giorno, "entro settembre" la fine del mese,
 * "entro meta' ottobre" il quindici. Se la nota non dice niente, niente scadenza.
 *
 * IL TERMINE SENZA ANNO SI LEGGE DALLA MAIL (prova del cambio d'anno, 15/10/2026,
 * difetto 3). `riferimento` e' il giorno della mail della richiesta (AAAA-MM-GG):
 * un giorno o un mese scritti senza anno sono il primo che non viene prima della
 * mail. Mail del 18/12/2026 «DA FARE ENTRO IL 10/01» = 10/01/2027, «entro
 * gennaio» = 31/01/2027; mail del 10/12/2026 «entro il 20/12» = 20/12/2026. Prima
 * il caricamento passava un anno solo per tutto il foglio, il piu' alto fra le
 * mail: a dicembre «entro il 10/01» diventava il 10/01 dello stesso anno, gia'
 * passato, e la richiesta appena caricata era «in ritardo» di 345 giorni; a
 * gennaio, col foglio che aveva anche le mail del nuovo anno, «entro il 20/12»
 * diventava il 20/12 dell'anno dopo. Un anno scritto nella nota vale com'e'.
 * Con un numero (un anno) al posto del giorno resta la regola di prima: l'anno
 * dato, per chi non ha la mail.
 *
 * L'anno dopo vale solo entro sei mesi dalla mail (GIORNI_TERMINE_AVANTI): e' il
 * passaggio di dicembre, una mail di fine anno per un ritiro di gennaio. Un
 * termine gia' passato quando la mail e' partita - «entro l'11/09» in una mail
 * del 12/09, scritta in ritardo o registrata col giorno sbagliato - resta
 * nell'anno della mail, come prima: spostato all'anno dopo la richiesta
 * sembrerebbe nei tempi per un anno intero, mentre cosi' la dashboard la dice
 * oltre il termine e qualcuno la guarda.
 */
const GIORNI_TERMINE_AVANTI = 183;
export function scadenzaDaNota(nota, riferimento) {
  const t = pulisci(nota).toLowerCase();
  if (!t) return null;
  const mail = typeof riferimento === 'number' ? null : soloData(riferimento);
  const anno = mail ? Number(mail.slice(0, 4)) : Number(riferimento);
  if (!anno) return null;
  // il giorno nell'anno della mail, o in quello dopo se cadrebbe prima della
  // mail e l'anno dopo non lo porta oltre sei mesi
  const nonPrima = (scrivi) => {
    const stesso = scrivi(anno);
    if (!mail || stesso >= mail) return stesso;
    const dopo = scrivi(anno + 1);
    return (Date.parse(dopo) - Date.parse(mail)) / 86400000 <= GIORNI_TERMINE_AVANTI ? dopo : stesso;
  };
  const g = t.match(/(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?/);
  if (g) {
    if (g[3]) return `${Number(g[3]) < 100 ? 2000 + Number(g[3]) : Number(g[3])}-${due(g[2])}-${due(g[1])}`;
    return nonPrima((a) => `${a}-${due(g[2])}-${due(g[1])}`);
  }
  // con piu' mesi citati - "settembre/ottobre" - vale il piu' lontano, che e' il
  // termine ultimo di cui si e' parlato: il giorno piu' avanti, cosi' anche
  // «dicembre/gennaio» in una mail di dicembre finisce a gennaio dell'anno dopo
  const trovati = MESI_IT.map((m, i) => ({ i, pos: t.lastIndexOf(m) })).filter(x => x.pos >= 0);
  if (!trovati.length) return null;
  const meta = /met[aà]/.test(t);
  return trovati
    .map(x => nonPrima((a) => (meta ? `${a}-${due(x.i + 1)}-15` : ultimoDelMese(a, x.i))))
    .sort()
    .reverse()[0];
}

/**
 * L'anno di una richiesta: quello della sua mail, o dell'immissione dell'ordine
 * se la mail manca (prova del cambio d'anno, 15/10/2026, difetto 3). Prima il
 * caricamento dava a tutto il foglio un anno solo, il piu' alto fra le mail: a
 * gennaio le richieste di dicembre rinascevano come richieste dell'anno nuovo,
 * doppioni senza le spunte. null se la richiesta non ha nessuna delle due date.
 */
export function annoRichiesta(r) {
  const d = soloData(r && r.mail_inviata_il) || soloData(r && r.ordine_immesso_il);
  return d ? Number(d.slice(0, 4)) : null;
}

/** Il testo della colonna "ordine evaso" quando non e' una data spiega perche' non si evade. */
export function leggiEvaso(v) {
  const d = soloData(v);
  if (d) return { evaso_il: d, motivo: '' };
  const t = pulisci(v);
  return { evaso_il: null, motivo: t };
}

/**
 * Le colonne del foglio com'era fino al 09/10/2026: produttore, provincia, ordine
 * immesso, ordine evaso, trasportatore, mail, nota. Valgono quando l'intestazione
 * non si riconosce.
 */
const COLONNE_DI_PRIMA = { nome: 0, provincia: 1, numero: -1, immesso: 2, evaso: 3, trasportatore: 4, mail: 5, nota: 6 };
/** Fra quante righe in cima si cerca l'intestazione. */
const RIGHE_INTESTAZIONE = 6;

/**
 * Dove sta ogni dato nel foglio, letto dall'intestazione (prova del cambio
 * d'anno, 15/10/2026, difetto 10). Il foglio del 09/10/2026 ha una colonna in
 * piu', «numero d'ordine», dopo la provincia: le colonne si leggevano per
 * posizione, l'immissione cadeva sul numero d'ordine e ogni riga, senza una data
 * di immissione, passava per intestazione. Il caricamento diceva «Il foglio
 * Richieste ECT non contiene richieste» e non ne salvava nessuna; anche
 * trasportatore, mail e nota si leggevano una colonna prima.
 *
 * L'intestazione sta sulle prime righe, fino a quella con «ordine immesso» (sopra
 * c'e' «DATE», unita sulle due colonne delle date): per ogni colonna si mettono
 * insieme le scritte delle righe d'intestazione e si cercano provincia, numero
 * d'ordine, ordine immesso, ordine evaso, trasportatore e mail. La nota non ha
 * titolo: e' la prima colonna senza titolo dopo le altre (o quella che si chiama
 * nota). Senza «ordine immesso» in cima vale l'ordine di prima (COLONNE_DI_PRIMA).
 * Restituisce { colonne, dati } con `dati` l'indice della prima riga dopo
 * l'intestazione (0 quando l'intestazione non si riconosce).
 */
export function colonneFoglio(righe) {
  const testo = (v) => pulisci(v).toLowerCase();
  const lista = righe || [];
  let fine = -1;
  for (let i = 0; i < Math.min(lista.length, RIGHE_INTESTAZIONE); i++) {
    if ((lista[i] || []).some(c => /immess/.test(testo(c)))) { fine = i; break; }
  }
  if (fine < 0) return { colonne: { ...COLONNE_DI_PRIMA }, dati: 0, dall_intestazione: false };
  const testa = lista.slice(0, fine + 1);
  const larghezza = Math.max(0, ...testa.map(r => (r || []).length));
  const etichette = Array.from({ length: larghezza }, (_, c) => testa.map(r => testo((r || [])[c])).filter(Boolean).join(' '));
  const cerca = (re, tranne = null) => etichette.findIndex(e => re.test(e) && !(tranne && tranne.test(e)));
  const colonne = {
    immesso: cerca(/immess/),
    evaso: cerca(/evas/),
    numero: cerca(/numero|id\s*ordine|n[°º.]\s*ordine/, /immess|evas/),
    provincia: cerca(/\bprov/),
    trasportatore: cerca(/trasport/),
    mail: cerca(/mail/),
    nome: cerca(/richiesta|produttore|punto di raccolta/),
    nota: cerca(/\bnot[ae]\b/),
  };
  if (colonne.nome < 0) colonne.nome = 0;
  if (colonne.nota < 0) {
    let c = Math.max(...Object.values(colonne)) + 1;
    while (c < larghezza && etichette[c]) c++;
    colonne.nota = c;
  }
  return { colonne, dati: fine + 1, dall_intestazione: true };
}

/**
 * Un ID ordine del portale: due-quattro lettere e almeno sei cifre (ET26084363,
 * SEC26154852), la stessa forma che riconoscono la to-do list (todoOrdini.ts) e
 * la prefattura (revisione del 15/10/2026).
 */
const FORMA_ORDINE = /^[A-Z]{2,4}\d{6,}$/;

/**
 * Gli ID ordine scritti in una cella del foglio, in maiuscolo e separati da
 * virgola come quelli scritti a mano nella pagina. Una scritta che non ha la
 * forma di un ID ordine («da chiedere», «ET2609») non vale.
 */
export function idOrdiniDelFoglio(v) {
  const pezzi = String(v ?? '').toUpperCase().split(/[,;\s/]+/).map(x => x.trim()).filter(x => FORMA_ORDINE.test(x));
  return [...new Set(pezzi)].join(', ');
}

/**
 * Le righe del foglio "Richieste ECT". L'intestazione sta sulle prime due righe
 * (la seconda distingue "ordine immesso" da "ordine evaso"), i dati dalla quarta.
 * Le colonne si trovano dall'intestazione (colonneFoglio, 15/10/2026).
 *
 * `primaRiga` e' il numero di riga del foglio a cui corrisponde il primo
 * elemento dell'elenco: il foglio non comincia dalla riga 1 e sbagliarlo
 * perderebbe la prima richiesta e sfaserebbe tutti i riferimenti.
 *
 * L'ID ORDINE SCRITTO NEL FOGLIO (colonna «numero d'ordine», dal 09/10/2026) vale
 * come un ID scritto a mano: torna in `id_ordine_foglio`, e il caricamento lo
 * mette in id_ordine_manuale, che vince sempre sul riconoscimento automatico
 * (listaOrdini), come nella to-do list - ma solo se i suoi ordini ci sono fra
 * quelli caricati (importaRichiesteEct, revisione del 15/10/2026). Una riga con
 * l'ID ma senza la data di immissione e' una richiesta lo stesso.
 */
export function leggiFoglio(righe, primaRiga = 1) {
  const esito = [];
  const { colonne: k, dati } = colonneFoglio(righe);
  const cella = (r, i) => (i >= 0 ? r[i] : null);
  for (let i = dati; i < righe.length; i++) {
    const r = righe[i] || [];
    const rigaExcel = primaRiga + i;
    const nomeGrezzo = pulisci(cella(r, k.nome));
    if (!nomeGrezzo) continue;
    if (/^richiesta\s+ect$/i.test(nomeGrezzo)) continue;
    const immesso = soloData(cella(r, k.immesso));
    const idFoglio = idOrdiniDelFoglio(cella(r, k.numero));
    // Le intestazioni non portano una data di immissione ne' un ID: e' cosi' che
    // si distinguono dalle richieste, anche quando l'intestazione non si
    // riconosce e le righe non si contano.
    if (!immesso && !idFoglio) continue;
    const { nome, classe } = nomeEClasse(nomeGrezzo);
    const { evaso_il, motivo } = leggiEvaso(cella(r, k.evaso));
    esito.push({
      riga_excel: rigaExcel,
      pdr_nome: nome,
      classe,
      provincia: pulisci(cella(r, k.provincia)).toUpperCase(),
      ordine_immesso_il: immesso,
      id_ordine_foglio: idFoglio,
      trasportatore: pulisci(cella(r, k.trasportatore)),
      mail_inviata_il: soloData(cella(r, k.mail)),
      nota: pulisci(cella(r, k.nota)),
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
 * Stato della richiesta.
 *
 * L'EVASIONE SI CHIUDE DA SOLA quando tutti gli ordini della richiesta risultano
 * terminati (richiesta dell'utente, 29/09/2026: «rendi anche la sezione richieste
 * ECT automatica in base all'evasione degli ordini indicati, cosi' come fatto nella
 * sezione attivita'»). Prima si fermava a "da spuntare" e aspettava una conferma a
 * mano: una richiesta ritirata restava aperta finche' qualcuno non se ne accorgeva.
 *
 * Come per le attivita' della to-do list, resta scritto CHE COSA l'ha chiusa: una
 * richiesta chiusa dal gestionale si distingue sempre da una spuntata a mano
 * (evasione_confermata), e chi la riapre a mano - togliendo la data rilevata o
 * annullandola - non se la vede richiudere.
 *
 * Una richiesta ANNULLATA resta annullata: quel ritiro non si fara', e un ordine
 * terminato per caso su un altro conto non la riapre.
 *
 * QUELLO CHE IL PORTALE DICE IN MODO CERTO NON SI DECIDE A MANO (richiesta
 * dell'utente del 14/10/2026: «a me non serve decidere sul gestionale cio' che e'
 * gia' chiaro ed evidente sul portale»). Si legge lo stato dei suoi ordini salvato
 * con la richiesta (ordini_stato_json, statoOrdiniRichiesta): se il portale li da'
 * tutti CANCELLATI la richiesta e' annullata da sola, come quelle che il foglio
 * del consorzio dice annullate; se nessuno e' piu' aperto e alcuni sono terminati
 * e altri cancellati e' EVASA IN PARTE, e va fra le completate: al consorzio si
 * risponde con i ritiri fatti e quelli cancellati. Fino a quel giorno una
 * richiesta col suo ordine cancellato restava «in attesa del ritiro» per sempre,
 * e a scadenza passata finiva fra quelle da sollecitare. Lo stato salvato vale
 * solo se copre TUTTI gli ordini di adesso: con un ID scritto a mano dopo, quello
 * stato e' di un altro elenco e non decide niente.
 *
 * Quello che ha chiuso il portale lo puo' riaprire il portale (revisione del
 * 14/10/2026): un ordine cancellato per errore torna assegnato con lo stesso ID,
 * e la richiesta torna aperta. Per questo una richiesta chiusa cosi' si ricalcola
 * a ogni caricamento (daRicalcolare), e lo stato dei suoi ordini si scrive PRIMA
 * dell'esito che lo legge (ordiniEdEsitoRichiesta). Le annullate dal foglio e le
 * evase coi ritiri tutti fatti restano come sono.
 */
export function statoRichiesta(r) {
  if (r.motivo_annullamento) return 'annullata';
  if (r.evasione_confermata) return 'evasa';
  // La data di evasione viene dal foglio del consorzio o dai nostri terminati: in
  // tutti e due i casi il ritiro c'e' stato, e la richiesta e' evasa.
  if (r.evaso_il || r.evasione_rilevata_il) return 'evasa';
  const o = ordiniSalvatiRichiesta(r);
  if (o && o.cancellati.length === o.voci.length) return 'annullata';
  if (o && o.cancellati.length > 0 && o.cancellati.length + o.terminati.length === o.voci.length) return 'evasa';
  return 'aperta';
}

/**
 * Lo stato degli ordini di una richiesta com'e' stato salvato (ordini_stato_json),
 * uno per ogni ordine di adesso (listaOrdini): { voci, terminati, cancellati },
 * con le voci di statoOrdiniRichiesta. null se la richiesta non ha ordini, se lo
 * stato non c'e' o non si legge, o se manca anche un solo ordine: uno stato
 * incompleto non decide niente.
 */
export function ordiniSalvatiRichiesta(r) {
  const ids = listaOrdini(r);
  if (!ids.length || !r || !r.ordini_stato_json) return null;
  let salvati = [];
  try { salvati = JSON.parse(r.ordini_stato_json); } catch { return null; }
  if (!Array.isArray(salvati)) return null;
  const perId = new Map(salvati.filter(s => s && s.id_ordine).map(s => [String(s.id_ordine).trim(), s]));
  const voci = ids.map(id => perId.get(id) || null);
  if (voci.some(v => !v)) return null;
  return { voci, terminati: voci.filter(v => v.stato === 'terminato'), cancellati: voci.filter(v => v.stato === 'cancellato') };
}

/**
 * Chiusa SOLO dallo stato dei suoi ordini a portale: annullata senza il motivo
 * del foglio, o evasa senza la spunta, senza la data del foglio e senza il
 * ritiro rilevato (cioe' evasa in parte, con un ordine cancellato). E' l'unica
 * chiusura che il portale puo' disfare: le altre le ha decise il foglio del
 * consorzio, un ritiro fatto o chi lavora.
 */
export function chiusaDalPortale(r) {
  if (!r) return false;
  if (r.esito === 'annullata') return !r.motivo_annullamento;
  if (r.esito === 'evasa') return !r.evasione_confermata && !r.evaso_il && !r.evasione_rilevata_il;
  return false;
}

/**
 * Le richieste che ogni caricamento delle primarie ricalcola (importaBlocco,
 * azione ritiri_ect): le aperte (e le «da_confermare» di prima del 29/09/2026), e
 * quelle chiuse dal portale, che il portale puo' riaprire. Senza queste ultime
 * una richiesta annullata perche' il suo ordine risultava cancellato restava
 * «Annullata.» per sempre, anche col suo ordine riassegnato (revisione del
 * 14/10/2026).
 */
export function daRicalcolare(r) {
  if (!r) return false;
  if (r.esito === 'evasa' || r.esito === 'annullata') return chiusaDalPortale(r);
  return true;
}

/**
 * Una richiesta non ancora chiusa per chi lavora: ancora da ritirare (aperta, o
 * la «da_confermare» di prima del 29/09/2026), oppure evasa ma senza la spunta,
 * cioe' ancora da rispondere al consorzio. L'esito e' quello salvato, come lo
 * legge la dashboard; senza, statoRichiesta.
 */
export function ancoraDaSeguire(r) {
  if (!r) return false;
  const esito = r.esito || statoRichiesta(r);
  return esito === 'aperta' || esito === 'da_confermare' || (esito === 'evasa' && !r.evasione_confermata);
}

/**
 * LE RICHIESTE DA SEGUIRE NELL'ANNO `anno` (prova del cambio d'anno, 15/10/2026,
 * difetto 2): quelle dell'anno, tutte, piu' quelle degli anni prima non ancora
 * chiuse (ancoraDaSeguire). Dashboard, To-Do List e ricalcolo dopo le primarie
 * leggevano solo le richieste dell'anno di oggi: il 1° gennaio una richiesta di
 * dicembre ancora aperta, o evasa e non ancora risposta, spariva da tutti e tre,
 * e il suo ritiro di gennaio non si riconosceva piu' (restava «aperta» per
 * sempre). Nel foglio vero le richieste restano aperte da uno a tre mesi. Le
 * chiuse restano nel loro anno. L'archivio e' piccolo (48-64 richieste l'anno):
 * chi chiama lo legge con una lettura sola, senza filtro sull'anno, e filtra qui.
 * L'anno di una richiesta e' quello salvato; senza, quello della sua mail
 * (annoRichiesta); una richiesta senza anno si tiene.
 */
export function richiesteDaSeguire(richieste, anno) {
  const a = Number(anno);
  return (richieste || []).filter(r => {
    if (!r) return false;
    const suo = Number(r.anno) || annoRichiesta(r);
    if (!suo || !a || suo === a) return true;
    return suo < a && ancoraDaSeguire(r);
  });
}

/**
 * RIAPERTA DAL PORTALE: una richiesta che il portale aveva chiuso cancellandone
 * gli ordini (chiusaDalPortale) e che ha di nuovo, nell'archivio di adesso, uno
 * di quegli ordini cancellati riassegnato o gia' ritirato. `stato` e' quello di
 * statoOrdini (todoOrdini.ts): `presenti` gli ID nell'archivio, `cancellati`
 * quelli che il portale da' ancora cancellati.
 *
 * Serve al ricalcolo dopo le primarie per le richieste degli ANNI PRIMA
 * (revisione del 15/10/2026): richiesteDaSeguire le lascia nel loro anno, e una
 * richiesta di dicembre annullata perche' il suo ordine risultava cancellato, con
 * l'ordine riassegnato e ritirato a gennaio, restava «annullata» per sempre;
 * dentro l'anno la stessa richiesta si riapriva (daRicalcolare). Per gli anni
 * prima conta solo questa prova in positivo, non il ricalcolo intero: il file
 * del portale porta gli ordini cancellati solo per un po' (lo storico che il
 * caricamento conserva e' quello dei terminati), e un ordine cancellato uscito
 * dall'archivio sarebbe «sconosciuto», che statoRichiesta legge come aperta. Una
 * richiesta di due anni prima tornerebbe da sola fra quelle da ritirare.
 */
export function riapertaDalPortale(r, stato) {
  if (!chiusaDalPortale(r) || !stato) return false;
  const o = ordiniSalvatiRichiesta(r);
  if (!o) return false;
  const presenti = stato.presenti || new Set();
  const cancellati = stato.cancellati || new Map();
  return o.cancellati.some(v => presenti.has(v.id_ordine) && !cancellati.has(v.id_ordine));
}

/**
 * Chiusa nell'anno `anno`: spuntata quell'anno (evasione_confermata_il), o chiusa
 * dal portale con un ordine visto cancellato quell'anno (visto_il). Per le altre
 * chiusure non c'e' un giorno.
 */
export function chiusaNellAnno(r, anno) {
  if (!r || ancoraDaSeguire(r)) return false;
  const a = String(anno);
  if (r.evasione_confermata && String(r.evasione_confermata_il || '').slice(0, 4) === a) return true;
  const o = chiusaDalPortale(r) ? ordiniSalvatiRichiesta(r) : null;
  return !!o && o.cancellati.some(v => String(v.visto_il || '').slice(0, 4) === a);
}

/**
 * LE RICHIESTE DELLA TO-DO LIST nell'anno `anno` (revisione del 15/10/2026): quelle
 * da seguire (richiesteDaSeguire), piu' quelle degli anni prima che si sono
 * chiuse quest'anno (chiusaNellAnno). Con la sola richiesteDaSeguire una
 * richiesta di dicembre spuntata a gennaio spariva dalla pagina appena spuntata:
 * fra le completate non c'era piu', e la spunta - messa magari per sbaglio - non
 * si poteva piu' togliere da nessuna parte, perche' la pagina non ha un selettore
 * d'anno. Adesso resta fra le completate per tutto l'anno in cui si e' chiusa,
 * come quelle dell'anno. La dashboard e il ricalcolo dopo le primarie non ne
 * hanno bisogno: una chiusa non e' da fare.
 */
export function richiesteDellaTodo(richieste, anno) {
  const daSeguire = new Set(richiesteDaSeguire(richieste, anno));
  return (richieste || []).filter(r => daSeguire.has(r) || chiusaNellAnno(r, anno));
}

/**
 * Lo stato dei suoi ordini e l'esito di una richiesta, ricalcolati insieme e
 * nell'ordine giusto: PRIMA lo stato degli ordini di adesso, POI l'esito, che lo
 * legge. Calcolati al contrario, l'esito leggeva lo stato salvato al caricamento
 * prima ed era indietro di un giro: la pagina la diceva cancellata, la dashboard
 * e l'assistente aperta e scaduta (revisione del 14/10/2026). Il giorno in cui un
 * ordine si e' visto cancellato si porta avanti dal salvato (`r.ordini_stato_json`),
 * e la prima volta e' `oggi`.
 *
 * `campi` sono quelli gia' ricalcolati da chi chiama (ID riconosciuti, ritiro
 * rilevato): l'esito si calcola sulla richiesta con quelli sopra.
 * Torna { ordini_stato_json, esito }.
 */
export function ordiniEdEsitoRichiesta(r, campi, ids, stato, oggi) {
  const ordini_stato_json = JSON.stringify(statoOrdiniRichiesta(ids, stato, r && r.ordini_stato_json, oggi));
  return { ordini_stato_json, esito: statoRichiesta({ ...(r || {}), ...(campi || {}), ordini_stato_json }) };
}

/**
 * Evasa IN PARTE: nessun ordine e' piu' da ritirare, alcuni risultano terminati e
 * gli altri cancellati a portale. «Gli ordini risultano tutti ritirati» non vale
 * per lei: chi la racconta deve dirlo (la dashboard, cruscotto.ts).
 */
export function evasaInParte(r) {
  const o = ordiniSalvatiRichiesta(r);
  return !!o && o.cancellati.length > 0 && o.terminati.length > 0 && o.cancellati.length + o.terminati.length === o.voci.length;
}

/**
 * A CHE PUNTO SONO GLI ORDINI di una richiesta, uno per uno: quali sono ancora
 * assegnati e quali terminati (richiesta dell'utente, 29/09/2026). Con piu' ordini
 * sulla stessa richiesta e' l'unico modo di sapere che cosa manca: "2 su 3" dice
 * quanti, non quali.
 *
 * Gli stati sono quelli del portale, piu' il limbo "eseguito" (dati inseriti ma
 * Chiudi non premuto) che va sempre segnalato, e "senza data" per un terminato a
 * cui manca la fine trasporto - che non conta come ritirato (regola 1) ma c'e'.
 *
 * IL GIORNO DI UN CANCELLATO (14/10/2026). `giorno` resta quello del ritiro, e un
 * cancellato non ce l'ha. Il giorno della cancellazione il file del portale non
 * lo porta (Ordine_chiuso_il e' il clic su Chiudi di un trasporto gia' fatto, non
 * la cancellazione: vedi todoOrdini.ts). Si scrive in `visto_il` il giorno in cui
 * il gestionale l'ha visto cancellato la prima volta, se chi chiama passa lo
 * stato salvato prima (`precedenti`, il testo di ordini_stato_json) e `oggi`: si
 * porta avanti dal salvato, cosi' non cambia a ogni ricalcolo. Senza, resta vuoto:
 * un giorno che non si sa non si inventa.
 */
export function statoOrdiniRichiesta(ids, stato, precedenti = null, oggi = null) {
  const { terminati, senzaFine, cancellati, eseguiti, presenti } = stato || {};
  let prima = [];
  try { prima = precedenti ? JSON.parse(precedenti) : []; } catch { prima = []; }
  const vistoPrima = new Map((Array.isArray(prima) ? prima : []).filter(s => s && s.stato === 'cancellato' && s.visto_il).map(s => [s.id_ordine, s.visto_il]));
  return (ids || []).map(id => {
    if (terminati && terminati.has(id)) return { id_ordine: id, stato: 'terminato', giorno: terminati.get(id) };
    if (cancellati && cancellati.has(id)) {
      return {
        id_ordine: id,
        stato: 'cancellato',
        motivo: cancellati.get(id) || '',
        visto_il: vistoPrima.get(id) || (oggi ? String(oggi).slice(0, 10) : ''),
      };
    }
    if (eseguiti && eseguiti.has(id)) return { id_ordine: id, stato: 'eseguito', giorno: '' };
    if (senzaFine && senzaFine.has(id)) return { id_ordine: id, stato: 'senza_data', giorno: '' };
    if (presenti && presenti.has(id)) return { id_ordine: id, stato: 'assegnato', giorno: '' };
    return { id_ordine: id, stato: 'sconosciuto', giorno: '' };
  });
}

/** "2 ordini su 3 ritirati": a che punto e' una richiesta con piu' ordini. */
export function testoAvanzamentoRichiesta(evasi, totali) {
  if (!totali || totali < 2) return '';
  return `${evasi} ${evasi === 1 ? 'ordine' : 'ordini'} su ${totali} ${evasi === 1 ? 'ritirato' : 'ritirati'}`;
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
 *
 * Dal 15/10/2026 (prova del cambio d'anno) il foglio porta anche l'ID ordine
 * (`id_ordine_foglio`): fra due gemelle vince quella con lo stesso ordine. E il
 * terzo passaggio, quello per riga e produttore, vale solo fra richieste dello
 * stesso anno (annoRichiesta): il foglio dell'anno nuovo ricomincia dalle prime
 * righe, e un produttore che torna alla stessa riga non e' la richiesta
 * dell'anno prima con la data corretta.
 */
export function abbinaRichieste(righe, esistenti) {
  const libere = new Set(esistenti || []);
  const stessoOrdine = (r, e) => {
    const suoi = String((r && r.id_ordine_foglio) || '').split(/[,;\s]+/).filter(Boolean);
    const loro = new Set(listaOrdini(e));
    return suoi.length > 0 && suoi.every(id => loro.has(id));
  };
  const somiglianza = (r, e) =>
    (stessoOrdine(r, e) ? 8 : 0) +
    (pulisci(r.nota) === pulisci(e.nota) ? 4 : 0) +
    (pulisci(r.trasportatore).toUpperCase() === pulisci(e.trasportatore).toUpperCase() ? 2 : 0) +
    (pulisci(r.provincia).toUpperCase() === pulisci(e.provincia).toUpperCase() ? 1 : 0) +
    (r.riga_excel && r.riga_excel === e.riga_excel ? 1 : 0);
  const stessoAnno = (r, e) => {
    const a = annoRichiesta(r), b = annoRichiesta(e);
    return !a || !b || a === b;
  };
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
  passata((r, e) => !!r.riga_excel && r.riga_excel === e.riga_excel && chiaveNome(r.pdr_nome) === chiaveNome(e.pdr_nome) && stessoAnno(r, e));
  return esito;
}
