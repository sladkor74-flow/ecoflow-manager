// Qualifica fornitori: presenza e validita' dei documenti richiesti ai fornitori
// e al cliente contrattualizzati nell'anno.
//
// Il modulo e' puramente documentale. Non valuta cosa fanno i fornitori: controlla
// soltanto che i documenti richiesti ci siano, siano quelli giusti e siano validi.
//
// I soggetti di un anno si ricavano dalle movimentazioni di PFU di quello stesso
// anno, ordini terminati con trasporto concluso nell'anno. Chi nell'anno compare
// solo in terminati senza fine trasporto resta fuori (o resta fuori quel suo
// ruolo), ma si dice a parte (soggetti_da_date, 22/09/2026): la data e'
// obbligatoria e va scritta. L'anno su cui si segnala e' quello dell'immissione,
// un ripiego che vale solo per quell'elenco (vedi senzaFineNelAnno). Dalle
// movimentazioni viene anche il ruolo, che serve solo a stabilire quali
// documenti chiedere:
//   raccolta              trasportatore delle primarie rete, ACI ed extra raccolta
//   trattamento           destinazione "Imp" delle primarie, destinazione delle
//                         secondarie
//   stoccaggio            destinazione "Stoc" delle primarie, stoccaggio di
//                         partenza delle secondarie
//   trasporto_secondaria  trasportatore delle secondarie
//   cliente               key account delle primarie, cioe' Ecotyre
//
// Le terziarie restano fuori: sono spedizioni dell'impianto verso le cementerie,
// e un impianto uscito dal contratto continua per mesi a spedire cio' che aveva
// in piazzale. Contarle faceva comparire INNOREC nel 2026. Restano fuori anche le
// societa' del gruppo, segnate come interne in anagrafica.
//
// Le inclusioni manuali coprono i due casi che le movimentazioni non vedono: un
// contratto firmato prima del primo viaggio e un soggetto da non qualificare pur
// comparendo nei dati.

import { fetchAll } from "./fetchAll.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { problemaTipoSbagliato, riconosciTipoDocumento } from "./tipiDocumento.ts";
import { annoRoma } from "./giornoItaliano.ts";
import { eTerminato, giornoMovimento, annoOrdine, testoDate, canaleMovimento } from "./movimenti.ts";

export const RUOLI = ['raccolta', 'trasporto_secondaria', 'trattamento', 'stoccaggio', 'cliente'];

// Soglie dei promemoria di scadenza, in giorni. Ciascuna viene segnalata una volta.
export const SOGLIE_AVVISO = [90, 60, 30, 15, 7, 0];

// Ogni quanti giorni si ripete il promemoria di un problema non risolto.
export const RIPETIZIONE_GIORNI = 7;

// Gravita' dello stato di un requisito, dalla peggiore alla migliore.
const PESO_STATO = {
  scaduto: 6, non_conforme: 6, mancante: 5, in_scadenza: 4,
  da_verificare: 3, in_analisi: 2, facoltativo_mancante: 1, valido: 0,
};

// === date ===

export function oggiRoma() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}

function soloData(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s) ? s : null;
}

export function giorniTra(daData, aData) {
  const a = Date.UTC(+daData.slice(0, 4), +daData.slice(5, 7) - 1, +daData.slice(8, 10));
  const b = Date.UTC(+aData.slice(0, 4), +aData.slice(5, 7) - 1, +aData.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

export function aggiungiPeriodo(data, mesi, giorni) {
  const d = new Date(Date.UTC(+data.slice(0, 4), +data.slice(5, 7) - 1, +data.slice(8, 10)));
  if (mesi) d.setUTCMonth(d.getUTCMonth() + Number(mesi));
  if (giorni) d.setUTCDate(d.getUTCDate() + Number(giorni));
  return d.toISOString().slice(0, 10);
}

const dataIt = (d) => d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4);

// === plausibilita' delle date lette ===
//
// LA DATA LETTA NON VALE A SCATOLA CHIUSA (segnalazione alta A64 del 20/09,
// corretta il 12/10/2026). Per i tipi «da documento» la scadenza e' quella che
// il modello legge sul file, e fino ad allora valeva com'era: un anno letto
// male, o la data di emissione scritta anche come scadenza, rendeva un
// documento «valido» o «scaduto» senza che nessuno se ne accorgesse. Ora tre
// controlli che non chiedono decisioni mettono il documento «da verificare»,
// col motivo: emissione nel futuro, scadenza che non viene dopo l'emissione,
// durata oltre la misura scritta per quel documento. Valgono solo sulle date
// della lettura: una scadenza corretta a mano o una conferma dell'amministratore
// li chiudono. Se ogni scadenza letta debba aspettare comunque un clic
// dell'amministratore e' una decisione dell'utente, non presa qui.

// Le durate scritte nel gestionale, per famiglia di documento (riconosciuta dal
// nome della casella come in tipiDocumento.ts): la voce «Regole di validita'
// dei documenti ricorrenti» della base di conoscenza (visura, DURC, Albo, White
// List) e la descrizione della CQC nel catalogo proposto. L'autorizzazione
// d'impianto non c'e': per l'AIA la durata e' «secondo il provvedimento».
export const DURATE_SCRITTE = {
  visura: { mesi: 6, fonte: 'la visura vale sei mesi dal rilascio' },
  durc: { giorni: 120, fonte: 'il DURC vale 120 giorni' },
  albo_gestori: { mesi: 60, fonte: "l'iscrizione all'Albo dura cinque anni" },
  white_list: { mesi: 12, fonte: "l'iscrizione alla White List vale dodici mesi" },
  cqc: { mesi: 60, fonte: 'la CQC si rinnova ogni cinque anni' },
};

// Margine sulla durata. Un rinnovo ottenuto prima della scadenza decorre dalla
// scadenza precedente: sui provvedimenti dell'Albo dei fornitori (2022-2026) fra
// la data del provvedimento e l'inizio della validita' passano fino a tre mesi
// («del 30/04/2026 ... dal 31/07/2026 al 31/07/2031»). Un quarto della durata li
// copre largamente e resta lontano dagli errori da prendere: un anno sbagliato,
// una data che non e' la scadenza.
export const MARGINE_DURATA = 0.25;

// L'ALBO GESTORI SI RICONOSCE DAI GESTORI (revisione del 13/10/2026). In
// tipiDocumento.ts la famiglia albo_gestori scatta anche con le sole parole
// «iscrizione all'Albo», che stanno pure nel nome dell'Albo degli
// autotrasportatori conto terzi («Iscrizione all'Albo autotrasportatori conto
// terzi (REN)», nel catalogo dal 21/09). Il REN e' un'altra iscrizione: non ha
// categorie ne' classi e non dura cinque anni, eppure riceveva l'avviso
// «controllo classe/target non eseguito» (classeAlbo.ts) e la durata dell'Albo.
// Qui l'Albo gestori e' tale solo se il testo nomina i gestori («Albo Nazionale
// Gestori Ambientali»); l'iscrizione a un albo senza quella parola non si
// attribuisce a nessuna famiglia.
/** La famiglia di un nome di documento (tipiDocumento.ts), con l'Albo gestori solo se nomina i gestori; o null. */
export function famigliaDocumento(testo) {
  const famiglia = riconosciTipoDocumento(testo || '');
  if (famiglia && famiglia.chiave === 'albo_gestori' && !/\bgestori\b/i.test(String(testo || ''))) return null;
  return famiglia;
}

/** La durata di un tipo di documento: quella del catalogo, altrimenti quella scritta per la sua famiglia, o null. */
export function durataScritta(tipo) {
  const mesi = Number(tipo && tipo.validita_mesi) || 0;
  const giorni = Number(tipo && tipo.validita_giorni) || 0;
  if (mesi > 0 || giorni > 0) {
    const parti = [mesi > 0 ? mesi + ' mesi' : '', giorni > 0 ? giorni + ' giorni' : ''].filter(Boolean).join(' e ');
    return { mesi, giorni, fonte: `il catalogo gli dà ${parti} di validità` };
  }
  const famiglia = famigliaDocumento((tipo && tipo.nome) || '');
  const scritta = famiglia && DURATE_SCRITTE[famiglia.chiave];
  return scritta ? { mesi: scritta.mesi || 0, giorni: scritta.giorni || 0, fonte: scritta.fonte } : null;
}

// IL CONTRATTO SI FIRMA PRIMA DI DECORRERE (revisione del 13/10/2026). I
// contratti dell'anno dopo si generano dalla scheda Contratti con la data della
// firma uguale alla decorrenza (segnapostiContratto.ts, DATA_FIRMA =
// DATA_INIZIO: in fondo c'e' «Massafra, 02 Gennaio 2027») e si controfirmano a
// dicembre. La lettura prende quella data come emissione, e il controllo
// dell'emissione nel futuro la dava per «letta male»: il contratto nuovo andava
// «da verificare» e il fornitore «da completare» proprio dopo il rinnovo, con un
// promemoria ogni settimana. Per un contratto un'emissione nel futuro e' la
// decorrenza e si accetta fino all'anno dopo quello di oggi, cioe' fin dove
// arrivano i contratti firmati in anticipo; oltre, e' ancora un anno letto male.
// Fino alla decorrenza vale il contratto in corso: lo dice una nota, e lo stato
// non cambia. Il contratto in corso resta attivo fino ad allora
// (salvaContrattoFornitore) e il requisito si regge sul migliore dei due
// (documentoDelRequisito, revisione del 13/10/2026).

/** Vero per le voci del catalogo della famiglia «contratto»: la categoria, oppure il nome. */
export function eContratto(tipo) {
  if (tipo && tipo.categoria === 'contratto') return true;
  const famiglia = famigliaDocumento((tipo && tipo.nome) || '');
  return !!famiglia && famiglia.chiave === 'contratto';
}

/** Vero se l'emissione letta nel futuro e' quella di un contratto firmato prima della decorrenza. */
export function firmatoPrimaDellaDecorrenza(tipo, emissione, oggi) {
  if (!emissione || !oggi || emissione <= oggi || !eContratto(tipo)) return false;
  return Number(emissione.slice(0, 4)) <= Number(oggi.slice(0, 4)) + 1;
}

/**
 * Le incongruenze fra le date lette di un documento, come problemi di
 * attenzione; [] se le date stanno in piedi o mancano. Date AAAA-MM-GG.
 */
export function dateIncongruenti(tipo, emissione, scadenza, oggi) {
  const problemi = [];
  if (emissione && oggi && emissione > oggi && !firmatoPrimaDellaDecorrenza(tipo, emissione, oggi)) {
    problemi.push({ gravita: 'attenzione', messaggio: `La data di emissione letta, ${dataIt(emissione)}, è nel futuro: con ogni probabilità è letta male. Controlla il documento.` });
  }
  if (emissione && scadenza && scadenza <= emissione) {
    problemi.push({ gravita: 'attenzione', messaggio: `La scadenza letta, ${dataIt(scadenza)}, non viene dopo la data di emissione, ${dataIt(emissione)}: una delle due è letta male, oppure l'emissione è la data di stampa o di estrazione. Controlla il documento e, se serve, correggi la scadenza.` });
  } else if (emissione && scadenza) {
    const durata = durataScritta(tipo);
    if (durata) {
      const limite = aggiungiPeriodo(emissione, Math.ceil(durata.mesi * (1 + MARGINE_DURATA)), Math.ceil(durata.giorni * (1 + MARGINE_DURATA)));
      if (scadenza > limite) {
        problemi.push({ gravita: 'attenzione', messaggio: `La scadenza letta, ${dataIt(scadenza)}, è troppo lontana dalla data di emissione, ${dataIt(emissione)}: ${durata.fonte}. Controlla che sia la data giusta e, se serve, correggila.` });
      }
    }
  }
  return problemi;
}

export function ruoliDaTesto(s) {
  return String(s || '').split(',').map(x => x.trim()).filter(Boolean);
}

/**
 * I fornitori nominati uno per uno su una voce del catalogo.
 * Si accetta sia la forma { chiave, nome } sia la sola chiave scritta come testo.
 */
export function soggettiDelTipo(tipo) {
  const elenco = Array.isArray(tipo && tipo.solo_per_soggetti) ? tipo.solo_per_soggetti : [];
  return elenco
    .map(v => (typeof v === 'string'
      ? { chiave: normalizzaRagioneSociale(v), nome: v }
      : { chiave: v && (v.chiave || normalizzaRagioneSociale(v.nome)), nome: (v && v.nome) || '' }))
    .filter(v => v.chiave);
}

/**
 * Un documento e' richiesto a un soggetto quando la voce e' attiva e:
 * - ha dei fornitori nominati e il soggetto e' fra quelli (i ruoli non contano:
 *   le patenti degli autisti o la CQC si chiedono a quel trasportatore, non a
 *   tutti i trasportatori);
 * - oppure non ne ha e uno dei suoi ruoli coincide con quelli del soggetto.
 */
export function richiestoA(tipo, soggetto) {
  if (!tipo || tipo.attivo === false) return false;
  const nominati = soggettiDelTipo(tipo);
  if (nominati.length > 0) return nominati.some(n => n.chiave === soggetto.chiave);
  return ruoliDaTesto(tipo.si_applica_a).some(r => soggetto.ruoli.includes(r));
}

/**
 * I dati letti dal file, salvati dall'agente dentro analisi_json.
 */
export function letturaDi(doc) {
  if (!doc || !doc.analisi_json) return null;
  try {
    const j = JSON.parse(doc.analisi_json);
    return j && j.lettura ? j.lettura : null;
  } catch (_e) {
    return null;
  }
}

export function leggiProblemi(doc) {
  if (!doc || !doc.problemi_json) return [];
  try {
    const p = JSON.parse(doc.problemi_json);
    return Array.isArray(p) ? p : [];
  } catch (_e) {
    return [];
  }
}

// === soggetti dell'anno ===

function pulisci(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}

// L'anno e' quello del giorno italiano della fine trasporto: getFullYear leggeva
// il fuso del server, e un ritiro del 1 gennaio salvato a mezzanotte italiana
// (31/12 23:00Z) faceva entrare il trasportatore fra i soggetti dell'anno prima.
function nelAnno(r, anno) {
  if (String(r.stato || '').toLowerCase().trim() !== 'terminato') return false;
  return annoRoma(r.trasporto_finito_il) === anno;
}

// Un terminato senza fine trasporto non ha un anno (regola 1) e non fa entrare
// nessuno fra i soggetti. Ma le date del formulario sono obbligatorie (regola
// dell'utente del 22/09/2026) e chi compare solo in ordini cosi' non deve
// sparire in silenzio: per sapere su quale anno segnalarlo si guarda l'anno
// dell'immissione, o dell'inizio trasporto se manca anche quella.
//
// E' un RIPIEGO e vale solo per questa segnalazione. Negli elenchi e nei conti
// lo stesso ordine non ha anno (annoElenco) e nessun filtro di periodo lo
// prende: sta quindi in un anno qui e in nessuno altrove. E' voluto - senza un
// anno la segnalazione non si saprebbe dove metterla, e il fornitore sparirebbe
// - e non colloca il movimento in nessun periodo, perche' la qualifica non conta
// tonnellate: guarda solo chi c'e'. Il ripiego e' scritto anche sulla pagina che
// mostra l'elenco (SoggettiDaDate in src/pages/QualificaFornitori.jsx), cosi'
// chi legge un nome in un anno sa da dove viene quell'anno.
function senzaFineNelAnno(r, anno) {
  if (!eTerminato(r) || giornoMovimento(r)) return false;
  return (annoOrdine(r) ?? annoRoma(r.trasporto_iniziato_il)) === anno;
}

// Quanti ordini si scrivono per ogni soggetto da verificare: gli altri si contano.
const ORDINI_DA_DATE = 20;

/**
 * Individua i soggetti da qualificare per l'anno.
 * Restituisce { soggetti, esclusi, soggetti_da_date }: gli esclusi manualmente
 * restano visibili cosi' da poterli reincludere. soggetti_da_date sono quelli
 * che nell'anno compaiono solo in ordini terminati senza fine trasporto, o che
 * solo da quelli hanno un ruolo - e "nell'anno" vuol dire nell'anno
 * dell'immissione, il ripiego di senzaFineNelAnno: { chiave, nome, ruolo, movimento, canale,
 * gia_fra_i_soggetti, quanti, ordini: ['ID (FIR ...): date che mancano'] }, uno
 * per ruolo, movimento e canale, mai sommati.
 */
export async function individuaSoggetti(base44, anno) {
  const annoNum = Number(anno);
  const svc = base44.asServiceRole.entities;
  const [rete, aci, extra, sec, fornitori, inclusioni] = await Promise.all([
    fetchAll(svc.PrimariaRete),
    fetchAll(svc.PrimariaAci),
    fetchAll(svc.ExtraRaccolta),
    fetchAll(svc.Secondaria),
    fetchAll(svc.Fornitore),
    fetchAll(svc.QualificaInclusione, { anno: annoNum }),
  ]);

  const anagrafica = new Map();
  const interni = new Set(['smoco']);
  for (const f of fornitori) {
    const k = normalizzaRagioneSociale(f.ragione_sociale);
    if (!k) continue;
    anagrafica.set(k, f);
    if (f.interno) interni.add(k);
  }

  const mappa = new Map();
  const aggiungi = (nome, ruolo) => {
    const n = pulisci(nome);
    if (!n) return;
    const k = normalizzaRagioneSociale(n);
    if (!k || interni.has(k)) return;
    if (!mappa.has(k)) mappa.set(k, { chiave: k, nomi: new Map(), ruoli: new Set(), origine: 'movimenti' });
    const s = mappa.get(k);
    s.ruoli.add(ruolo);
    s.nomi.set(n, (s.nomi.get(n) || 0) + 1);
  };

  for (const r of [...rete, ...aci, ...extra]) {
    if (!nelAnno(r, annoNum)) continue;
    const td = String(r.tipo_destinazione || '').toLowerCase().trim();
    aggiungi(r.trasportatore, 'raccolta');
    aggiungi(r.destinazione, td === 'stoc' ? 'stoccaggio' : 'trattamento');
    aggiungi(r.key_account, 'cliente');
  }
  for (const r of sec) {
    if (!nelAnno(r, annoNum)) continue;
    aggiungi(r.stoccaggio, 'stoccaggio');
    aggiungi(r.trasportatore, 'trasporto_secondaria');
    aggiungi(r.destinazione, 'trattamento');
  }

  // Inclusioni ed esclusioni manuali.
  const esclusi = [];
  for (const inc of inclusioni) {
    const k = inc.soggetto_chiave || normalizzaRagioneSociale(inc.soggetto_nome);
    if (!k) continue;
    if (inc.azione === 'escludi') {
      const s = mappa.get(k);
      esclusi.push({
        chiave: k,
        nome: s ? nomePreferito(s, anagrafica.get(k)) : pulisci(inc.soggetto_nome),
        motivo: inc.motivo || '',
        inclusione_id: inc.id,
      });
      mappa.delete(k);
    } else if (inc.azione === 'includi') {
      if (!mappa.has(k)) mappa.set(k, { chiave: k, nomi: new Map(), ruoli: new Set(), origine: 'manuale' });
      const s = mappa.get(k);
      const n = pulisci(inc.soggetto_nome);
      if (n) s.nomi.set(n, (s.nomi.get(n) || 0) + 1);
      for (const ruolo of ruoliDaTesto(inc.ruoli)) s.ruoli.add(ruolo);
      s.inclusione_id = inc.id;
      s.motivo_inclusione = inc.motivo || '';
    }
  }

  // Chi resta fuori perche' ha solo terminati senza fine trasporto: con gli
  // stessi ruoli dei movimenti dell'anno, ma a parte. Anche un soggetto gia'
  // presente, se quel ruolo - e quindi i suoi documenti - gli viene solo da
  // ordini cosi'. Un ruolo che ha gia', o chi e' stato escluso a mano, non si
  // ripete.
  const escluse = new Set(esclusi.map(e => e.chiave));
  const daDate = new Map();
  const annota = (nome, ruolo, movimento, canale, r) => {
    const n = pulisci(nome);
    if (!n) return;
    const k = normalizzaRagioneSociale(n);
    if (!k || interni.has(k) || escluse.has(k) || (mappa.has(k) && mappa.get(k).ruoli.has(ruolo))) return;
    const gruppo = `${k}|${ruolo}|${movimento}|${canale}`;
    if (!daDate.has(gruppo)) daDate.set(gruppo, { chiave: k, nomi: new Map(), ruolo, movimento, canale, voci: new Set() });
    const g = daDate.get(gruppo);
    g.nomi.set(n, (g.nomi.get(n) || 0) + 1);
    const id = pulisci(r.id_ordine) || 'senza ID';
    g.voci.add(`${id}${r.numero_fir ? ` (FIR ${pulisci(r.numero_fir)})` : ''}: ${testoDate(r)}`);
  };
  for (const [archivio, righe] of [['PrimariaRete', rete], ['PrimariaAci', aci], ['ExtraRaccolta', extra]]) {
    for (const r of righe) {
      if (!senzaFineNelAnno(r, annoNum)) continue;
      const td = String(r.tipo_destinazione || '').toLowerCase().trim();
      const canale = canaleMovimento(r, archivio);
      annota(r.trasportatore, 'raccolta', 'primarie', canale, r);
      annota(r.destinazione, td === 'stoc' ? 'stoccaggio' : 'trattamento', 'primarie', canale, r);
      annota(r.key_account, 'cliente', 'primarie', canale, r);
    }
  }
  for (const r of sec) {
    if (!senzaFineNelAnno(r, annoNum)) continue;
    const canale = canaleMovimento(r, 'Secondaria');
    annota(r.stoccaggio, 'stoccaggio', 'secondarie', canale, r);
    annota(r.trasportatore, 'trasporto_secondaria', 'secondarie', canale, r);
    annota(r.destinazione, 'trattamento', 'secondarie', canale, r);
  }
  const soggetti_da_date = [...daDate.values()].map(g => {
    const voci = [...g.voci].sort();
    return {
      chiave: g.chiave, nome: nomePreferito(mappa.get(g.chiave) || g, anagrafica.get(g.chiave)), ruolo: g.ruolo, movimento: g.movimento, canale: g.canale,
      gia_fra_i_soggetti: mappa.has(g.chiave), quanti: voci.length, ordini: voci.slice(0, ORDINI_DA_DATE),
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'it') || RUOLI.indexOf(a.ruolo) - RUOLI.indexOf(b.ruolo) || a.movimento.localeCompare(b.movimento) || a.canale.localeCompare(b.canale));

  const soggetti = [...mappa.values()].map(s => {
    const f = anagrafica.get(s.chiave);
    return {
      chiave: s.chiave,
      nome: nomePreferito(s, f),
      ruoli: RUOLI.filter(r => s.ruoli.has(r)),
      origine: s.origine,
      inclusione_id: s.inclusione_id || null,
      motivo_inclusione: s.motivo_inclusione || '',
      fornitore_id: f ? f.id : null,
      piva: f ? (f.piva || '') : '',
      codice_fiscale: f ? (f.codice_fiscale || '') : '',
      email: f ? (f.email || '') : '',
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));

  return { soggetti, esclusi, soggetti_da_date };
}

// In anagrafica il nome e' curato a mano e ha la precedenza; altrimenti si usa
// la forma piu' completa comparsa nelle movimentazioni.
function nomePreferito(s, fornitore) {
  if (fornitore && fornitore.ragione_sociale) return pulisci(fornitore.ragione_sociale);
  let migliore = '';
  for (const n of s.nomi.keys()) if (n.length > migliore.length) migliore = n;
  return migliore || s.chiave;
}

// === stato dei requisiti ===

// LA NOTA DEL CONTRATTO FIRMATO IN ANTICIPO NON E' IL MOTIVO (revisione del
// 13/10/2026). Stava in testa ai problemi di ogni stato: con una rilettura
// fallita, o con la scadenza non letta, la pagina e il promemoria (che mostrano
// il primo problema) dicevano «Contratto firmato prima della decorrenza ...» al
// posto di «La lettura automatica del file non ha funzionato» o di «Scadenza non
// determinata». Ora la nota si aggiunge solo a un requisito valido o in scadenza,
// dopo i suoi problemi. E non promette un contratto in corso se non c'e': a un
// fornitore nuovo dice solo da quando vale. Chi la chiama sapendo che accanto
// c'e' un contratto in vigore (valutaSoggetto) lo dice con contrattoInCorso.
function notaDecorrenza(decorrenza, contrattoInCorso) {
  return {
    gravita: 'informativo',
    messaggio: `Contratto firmato prima della decorrenza: la data letta, ${dataIt(decorrenza)}, è quella da cui vale.`
      + (contrattoInCorso ? ' Fino ad allora resta in vigore il contratto in corso.' : ''),
  };
}

/**
 * Stato di un requisito: il documento di quel tipo per il soggetto (il piu'
 * recente; per i contratti vedi documentoDelRequisito), confrontato con
 * la data di oggi e con le regole del catalogo. contesto.contrattoInCorso: vero
 * se accanto c'e' un contratto gia' in vigore (cambia solo la nota).
 */
export function statoRequisito(tipo, doc, oggi, contesto = {}) {
  const base = { scadenza: null, giorni: null, problemi: [] };
  if (!doc) {
    return { ...base, stato: tipo.obbligatorio === false ? 'facoltativo_mancante' : 'mancante' };
  }

  // Il controllo sul tipo si rifa' qui e non solo quando l'agente legge il file:
  // cosi' vale anche per i documenti analizzati prima che esistesse, senza
  // doverli rileggere tutti da capo.
  const salvati = leggiProblemi(doc);
  const sbagliato = problemaTipoSbagliato(tipo.nome, letturaDi(doc));
  const conTipo = sbagliato && !salvati.some(p => p.messaggio === sbagliato.messaggio) ? [sbagliato, ...salvati] : salvati;
  const scadenza = soloData(doc.data_scadenza_manuale) || soloData(doc.data_scadenza);
  const giorni = scadenza ? giorniTra(oggi, scadenza) : null;
  // Le date della lettura si controllano finche' nessuno le ha guardate: una
  // scadenza scritta a mano o la conferma dell'amministratore valgono su di loro.
  const dateDaLettura = !doc.verificato_manualmente && !soloData(doc.data_scadenza_manuale);
  const incongruenze = dateDaLettura ? dateIncongruenti(tipo, soloData(doc.data_emissione), scadenza, oggi) : [];
  const problemi = [...conTipo, ...incongruenze.filter(p => !conTipo.some(q => q.messaggio === p.messaggio))];
  const esito = { scadenza, giorni, problemi };
  // Un contratto firmato prima della decorrenza vale gia' come requisito, ma
  // non e' ancora quello in vigore: la nota lo dice, solo sui ritorni «valido» e
  // «in scadenza» e in fondo (13/10/2026, vedi notaDecorrenza).
  const decorrenza = firmatoPrimaDellaDecorrenza(tipo, soloData(doc.data_emissione), oggi) ? soloData(doc.data_emissione) : null;
  const conNota = (stato) => ({
    ...esito, stato,
    problemi: decorrenza ? [...problemi, notaDecorrenza(decorrenza, !!(contesto && contesto.contrattoInCorso))] : problemi,
  });

  // Un'analisi ferma da piu' di dieci minuti, avviata o mai partita, e' stata
  // interrotta: il documento passa da verificare invece di restare in attesa.
  if (doc.analisi_stato === 'in_attesa' || doc.analisi_stato === 'in_corso') {
    const riferimento = doc.analisi_avviata_il || doc.created_date;
    const avvio = riferimento ? new Date(riferimento).getTime() : 0;
    const bloccata = avvio > 0 && Date.now() - avvio > 10 * 60 * 1000;
    if (!bloccata) return { ...esito, stato: 'in_analisi' };
    return { ...esito, stato: 'da_verificare', problemi: [...problemi, { gravita: 'attenzione', messaggio: "L'analisi automatica si e' interrotta: rilanciala o verifica il documento a mano." }] };
  }

  if (giorni !== null && giorni < 0) return { ...esito, stato: 'scaduto' };

  const bloccanti = problemi.filter(p => p.gravita === 'bloccante');
  if (bloccanti.length > 0 && !doc.verificato_manualmente) return { ...esito, stato: 'non_conforme' };

  // Date che non stanno in piedi: ne' valido ne' in scadenza, finche' qualcuno
  // non guarda il documento (A64, 12/10/2026). Uno scaduto resta scaduto, sopra,
  // col motivo accanto.
  if (incongruenze.length > 0) return { ...esito, stato: 'da_verificare' };

  const preavviso = typeof tipo.preavviso_giorni === 'number' ? tipo.preavviso_giorni : 60;
  if (giorni !== null && giorni <= preavviso) return conNota('in_scadenza');

  // Il motivo del fallimento viaggia insieme allo stato: cosi arriva anche
  // nel promemoria via email, non solo sulla scheda del fornitore.
  if (!doc.verificato_manualmente && doc.analisi_stato === 'errore') return { ...esito, stato: 'da_verificare', problemi: [...problemi, { gravita: 'attenzione', messaggio: 'La lettura automatica del file non ha funzionato' + (doc.errore_analisi ? ': ' + doc.errore_analisi : '.') + ' Controlla il file a mano.' }] };

  // LA SPUNTA NON E' UNA SCADENZA (segnalazione alta A65 del 20/09, corretta il
  // 12/10/2026). Questo controllo stava dentro «se non e' verificato a mano»:
  // un documento che scade, confermato a mano senza scrivere la data, risultava
  // «valido» per sempre, e la maschera lo permetteva. Per i tipi con scadenza
  // senza data si resta «da verificare» anche con la spunta, e si dice perche'.
  if (giorni === null && tipo.tipo_scadenza !== 'nessuna') {
    if (!doc.verificato_manualmente) return { ...esito, stato: 'da_verificare' };
    return { ...esito, stato: 'da_verificare', problemi: [...problemi, { gravita: 'attenzione', messaggio: 'Il documento è segnato come verificato a mano, ma senza data di scadenza: per questo documento la scadenza serve, altrimenti resterebbe valido per sempre. Scrivila con «Correggi».' }] };
  }

  return conNota('valido');
}

// IL CONTRATTO IN CORSO VALE FINO ALLA DECORRENZA DEL NUOVO (revisione del
// 13/10/2026). Il requisito prendeva sempre il documento attivo piu' recente.
// Ma il contratto dell'anno dopo, controfirmato a dicembre dalla scheda
// Contratti, nasce «in analisi» e la sua lettura puo' fallire (un limite di
// richieste) o trovare un problema: il requisito scendeva «in analisi», «da
// verificare» o «non conforme» e il fornitore «da completare» o «critico» - e la
// fatturazione passiva, che legge i critici, avvisava prima di pagare dicembre,
// coperto dal contratto in corso, valido fino al 31/12. Ora il contratto in corso
// resta attivo fino alla decorrenza del nuovo (salvaContrattoFornitore) e, per la
// famiglia contratto, il requisito si regge sul migliore dei documenti attivi:
// valido, poi in scadenza, poi gli altri; a parita' il piu' recente. Il piu'
// recente lasciato indietro non sparisce: una nota dice com'e'. (Il migliore
// vale ora per la sola successione, e il lasciato indietro ha i suoi pulsanti:
// vedi «Il migliore solo per la successione», qui sotto.)
//
// Un contratto scaduto accanto a uno valido o in scadenza e' finito: non porta
// alert ne' promemoria, perche' il requisito non lo guarda, e va fra i
// sostituiti (superati, scritti da chiudiContrattiSuperati). E' il passo della
// decorrenza: senza, il contratto vecchio restava attivo per sempre, e il presidio
// lo avrebbe fatto rileggere ogni sei mesi. Si chiude solo un documento scaduto
// accanto a uno piu' recente, e solo se un contratto in vigore c'e': due
// contratti veri dello stesso anno (rete e ACI) restano attivi tutti e due
// finche' valgono, e un contratto nuovo letto male (scaduto prima di
// cominciare) resta li', invece di sparire.
//
// IL MIGLIORE SOLO PER LA SUCCESSIONE, E IL CONTRATTO NUOVO RAGGIUNGIBILE
// (revisione del 13/10/2026). La scelta del migliore valeva per tutti i contratti
// attivi della voce: rete e ACI dello stesso anno, uno valido e l'altro non
// conforme, davano un fornitore «qualificato» con una nota, e la fatturazione
// passiva non avvisava piu' prima di pagare. E il contratto nuovo lasciato
// indietro viaggiava solo come testo: la scheda metteva Apri, Rianalizza e
// Correggi sul contratto vecchio, e con «Correggi» la scadenza del 2027 finiva
// scritta sul 2026. Ora:
// - si mette da parte solo il SUCCESSIVO di un contratto in vigore: quello, non
//   piu' vecchio del contratto in corso, che decorre dopo oggi (emissione letta
//   nel futuro), oppure di cui la decorrenza non si conosce ancora (file non
//   ancora letto, o date lette che non stanno in piedi) e che non vale gia' da
//   solo. Finche' non e' valido il requisito si regge sul contratto in corso;
//   letto bene ne prende il posto. Un documento piu' vecchio del contratto in
//   corso (emissione, o caricamento, prima della sua) non e' «caricato dopo»: si
//   guarda insieme agli altri e, scaduto, si chiude come gli altri finiti;
// - i contratti che valgono insieme si guardano tutti: regge il requisito il
//   peggiore (scaduto o non conforme, poi da verificare, in analisi, in
//   scadenza, valido; a parita' il piu' recente), cosi' uno non conforme fa il
//   fornitore critico come prima;
// - gli altri contratti attivi della voce si espongono uno per uno
//   (altri_documenti: id, file, stato, problemi, lettura, mai il file_uri), cosi'
//   la scheda da' a ciascuno i suoi pulsanti Apri, Rianalizza e Correggi, e la
//   pagina si aggiorna da sola mentre il nuovo e' in lettura; la nota sul
//   successivo porta documento_id, e la scheda la mostra accanto ai suoi pulsanti;
// - contratti_in_corso dice quali documenti valgono oggi: un contratto caricato a
//   mano dalla scheda del fornitore non li manda fra i sostituiti
//   (documentiDaSostituire in src/components/qualifica/SoggettoDettaglio.jsx).
// Un contratto con la lettura fallita accanto a uno in vigore resta da parte,
// con la nota: se e' il 2027 non fa scendere il fornitore, se fosse un ACI
// dello stesso anno lo rilegge il presidio (analisi_fallita) e, letto, si guarda
// insieme all'altro.

const ETICHETTA_STATO = {
  valido: 'valido', in_scadenza: 'in scadenza', scaduto: 'scaduto', non_conforme: 'non conforme',
  da_verificare: 'da verificare', in_analisi: 'in analisi',
};
const dataPerRecenza = (d) => String(d.data_emissione || d.created_date || '');
const recenteDavanti = (a, b) => dataPerRecenza(b).localeCompare(dataPerRecenza(a));
const inVigore = (s) => s.stato === 'valido' || s.stato === 'in_scadenza';
// Fra contratti che valgono insieme regge il requisito il peggiore.
const GRAVITA_SCELTA = { scaduto: 0, non_conforme: 0, da_verificare: 1, in_analisi: 2, in_scadenza: 3, valido: 4 };
const gravitaScelta = (s) => GRAVITA_SCELTA[s.stato] ?? 2;
// Le date di un documento vengono dalla lettura del file: finche' non e' letto
// l'emissione e' quella scritta al caricamento (la data della firma), non la
// decorrenza.
const lettoDalFile = (d) => d.analisi_stato === 'completata' || !!letturaDi(d);
function dateNonAffidabili(tipo, d, oggi) {
  if (d.verificato_manualmente || soloData(d.data_scadenza_manuale)) return false;
  return dateIncongruenti(tipo, soloData(d.data_emissione), soloData(d.data_scadenza), oggi).length > 0;
}

/**
 * Il documento su cui si regge il requisito, il suo stato e gli altri documenti.
 * documenti: quelli attivi del soggetto per quel tipo. Restituisce
 * { doc, esito, superati: [id], altri: [{ doc, esito, relazione }],
 * contrattiInCorso: [id] }. relazione: 'successivo' (non piu' vecchio di un
 * contratto in vigore, e decorre dopo o non e' ancora letto bene), 'in_corso' (in
 * vigore fino alla decorrenza del successivo che regge il requisito), 'insieme'
 * (vale insieme a quello scelto). altri non comprende i contratti finiti
 * (scaduti accanto a uno piu' recente), che vanno fra i superati quando accanto
 * c'e' un contratto in vigore.
 * Per i tipi che non sono contratti e' il documento piu' recente, come sempre,
 * e il resto e' vuoto.
 */
export function documentoDelRequisito(tipo, documenti, oggi) {
  const ordinati = [...(documenti || [])].sort(recenteDavanti);
  if (!eContratto(tipo) || ordinati.length === 0) {
    return { doc: ordinati[0] || null, esito: statoRequisito(tipo, ordinati[0] || null, oggi), superati: [], altri: [], contrattiInCorso: [] };
  }
  const stati = ordinati.map(d => ({ d, s: statoRequisito(tipo, d, oggi) }));
  const decorreDopo = (x) => firmatoPrimaDellaDecorrenza(tipo, soloData(x.d.data_emissione), oggi);
  const decorrenzaIgnota = (x) => !inVigore(x.s) && (!lettoDalFile(x.d) || dateNonAffidabili(tipo, x.d, oggi));
  const candidato = (x) => decorreDopo(x) || decorrenzaIgnota(x);
  // I contratti in corso: gia' decorsi e in vigore oggi.
  const inCorso = stati.filter(x => !candidato(x) && inVigore(x.s));
  // La successione c'e' solo accanto a un contratto in corso, e il successivo non
  // e' piu' vecchio di lui: un documento senza data ne' caricamento noti si
  // tiene per nuovo (stati va dal piu' recente, inCorso[0] e' il piu' recente).
  const riferimento = inCorso.length ? dataPerRecenza(inCorso[0].d) : '';
  const piuVecchio = (x) => !!riferimento && !!dataPerRecenza(x.d) && dataPerRecenza(x.d) < riferimento;
  const successivi = inCorso.length ? stati.filter(x => candidato(x) && !piuVecchio(x)) : [];
  const correnti = stati.filter(x => !successivi.includes(x));
  // Finiti: scaduti, con un documento piu' recente accanto.
  const finiti = correnti.filter(x => x.s.stato === 'scaduto' && stati.indexOf(x) > 0);
  const pronti = successivi.filter(x => inVigore(x.s));
  let guardati = correnti.filter(x => !finiti.includes(x));
  // Il successivo letto bene prende il posto del contratto in corso (non di
  // quelli che, accanto, non valgono: quelli restano da guardare).
  if (pronti.length) guardati = [...guardati.filter(x => !inCorso.includes(x)), ...pronti];
  guardati.sort((a, b) => stati.indexOf(a) - stati.indexOf(b));
  let scelto = guardati[0];
  for (const x of guardati) if (gravitaScelta(x.s) < gravitaScelta(scelto.s)) scelto = x;

  // «Il contratto in corso» della nota sul contratto firmato in anticipo.
  const esito = statoRequisito(tipo, scelto.d, oggi, { contrattoInCorso: inCorso.some(x => x !== scelto) });
  // Il successivo non ancora valido: una nota sul requisito, quando il
  // requisito si regge davvero su un contratto in vigore.
  const lasciati = successivi.filter(x => !guardati.includes(x));
  const note = !inVigore(esito) ? [] : lasciati.map(({ d, s }) => {
    const motivo = (s.problemi || []).find(p => p.gravita === 'bloccante') || (s.problemi || []).find(p => p.gravita === 'attenzione');
    const nome = String(d.file_nome || '').trim();
    return {
      gravita: s.stato === 'in_analisi' ? 'informativo' : 'attenzione',
      documento_id: d.id,
      messaggio: `Il contratto caricato dopo questo${nome ? `, «${nome}»,` : ''} è ${ETICHETTA_STATO[s.stato] || s.stato}${motivo ? ` (${String(motivo.messaggio || '').replace(/\.\s*$/, '')})` : ''}: finché non risulta valido il requisito si regge su questo.`,
    };
  });
  const relazione = (x) => (successivi.includes(x) ? 'successivo' : !guardati.includes(x) ? 'in_corso' : 'insieme');
  const altri = stati.filter(x => x !== scelto && !finiti.includes(x)).map(x => ({ doc: x.d, esito: x.s, relazione: relazione(x) }));
  const superati = stati.some(x => !finiti.includes(x) && inVigore(x.s)) ? finiti.map(x => x.d.id) : [];
  // Quelli che valgono oggi, con una scadenza non passata: un caricamento a mano
  // non li sostituisce (SoggettoDettaglio.jsx, documentiDaSostituire).
  const contrattiInCorso = inCorso.filter(x => x.s.giorni !== null && x.s.giorni >= 0).map(x => x.d.id);
  return { doc: scelto.d, esito: note.length ? { ...esito, problemi: [...esito.problemi, ...note] } : esito, superati, altri, contrattiInCorso };
}

// Quello che la pagina vede di un documento: mai il file_uri (vedi sotto).
function vistaDocumento(doc) {
  return {
    id: doc.id,
    file_nome: doc.file_nome,
    // IL file_uri NON ESCE DAL SERVER (05/10/2026).
    //
    // Questo riepilogo lo chiede la pagina a ogni apertura e la funzione
    // risponde a QUALUNQUE utente collegato: finche' qui c'era il file_uri,
    // chiunque poteva farselo firmare e aprire il DURC, la polizza, la visura
    // o le patenti degli autisti di un fornitore - documenti di terzi, con
    // dati personali - mentre il pulsante «Apri» nella pagina si disegnava
    // solo per l'amministratore. La firma non e' controllata contro l'utente
    // ne' contro le regole RLS del record: lo ha scritto l'assistenza della
    // piattaforma (vedi shared/fileRiservato.ts). Alla pagina basta sapere se
    // il file c'e'; per aprirlo si passa dalla funzione apriFile.
    ha_file: !!doc.file_uri,
    data_emissione: doc.data_emissione,
    data_scadenza: doc.data_scadenza,
    data_scadenza_manuale: doc.data_scadenza_manuale,
    verificato_manualmente: !!doc.verificato_manualmente,
    analisi_stato: doc.analisi_stato,
    sintesi: doc.sintesi,
    richiesta_al_fornitore: doc.richiesta_al_fornitore,
    confidenza: doc.confidenza,
    errore_analisi: doc.errore_analisi,
    created_date: doc.created_date,
  };
}

/**
 * Valuta tutti i requisiti di un soggetto e ne ricava lo stato complessivo.
 */
export function valutaSoggetto(soggetto, catalogo, documenti, oggi) {
  const applicabili = catalogo
    .filter(t => richiestoA(t, soggetto))
    .sort((a, b) => (a.ordine ?? 100) - (b.ordine ?? 100) || String(a.nome).localeCompare(String(b.nome), 'it'));

  const propri = documenti.filter(d => d.soggetto_chiave === soggetto.chiave && d.stato !== 'sostituito');

  const requisiti = applicabili.map(t => {
    const { doc, esito, superati, altri, contrattiInCorso } = documentoDelRequisito(t, propri.filter(d => d.tipo_documento_id === t.id), oggi);
    const nominati = soggettiDelTipo(t);
    return {
      tipo_id: t.id,
      tipo_nome: t.nome,
      categoria: t.categoria,
      // vero quando il documento e' stato chiesto a questo fornitore per nome
      nominale: nominati.length > 0,
      obbligatorio: t.obbligatorio !== false,
      tipo_scadenza: t.tipo_scadenza,
      preavviso_giorni: t.preavviso_giorni,
      documento: doc ? vistaDocumento(doc) : null,
      ...esito,
      // contratti scaduti accanto a uno in vigore: li chiude chiudiContrattiSuperati
      superati,
      // Gli altri contratti attivi della voce, ciascuno col suo stato: la scheda
      // da' a ognuno i suoi pulsanti (13/10/2026). Mai il file_uri.
      altri_documenti: altri.map(a => ({
        ...vistaDocumento(a.doc),
        relazione: a.relazione,
        stato: a.esito.stato,
        scadenza: a.esito.scadenza,
        giorni: a.esito.giorni,
        problemi: a.esito.problemi,
      })),
      // i contratti che valgono oggi: il caricamento a mano non li sostituisce
      contratti_in_corso: contrattiInCorso,
    };
  });

  const obbligatori = requisiti.filter(r => r.obbligatorio);
  const validi = obbligatori.filter(r => r.stato === 'valido' || r.stato === 'in_scadenza').length;
  const peggiore = requisiti.reduce((m, r) => Math.max(m, PESO_STATO[r.stato] ?? 0), 0);

  let stato = 'qualificato';
  if (requisiti.some(r => r.stato === 'scaduto' || r.stato === 'non_conforme')) stato = 'critico';
  else if (obbligatori.some(r => r.stato === 'mancante' || r.stato === 'da_verificare' || r.stato === 'in_analisi')) stato = 'da_completare';
  else if (requisiti.some(r => r.stato === 'in_scadenza')) stato = 'in_scadenza';

  const scadenze = requisiti.map(r => r.scadenza).filter(Boolean).sort();

  return {
    ...soggetto,
    requisiti,
    stato,
    gravita: peggiore,
    obbligatori_totali: obbligatori.length,
    obbligatori_validi: validi,
    prossima_scadenza: scadenze[0] || null,
  };
}

/**
 * Errori di impostazione del catalogo: voci che non chiederanno mai niente a
 * nessuno. Senza questo controllo un documento intestato a un fornitore scritto
 * male, o a uno che quest'anno non ha lavorato, resterebbe muto per sempre e
 * sembrerebbe tutto a posto.
 */
export function anomalieCatalogo(catalogo, soggetti, anno) {
  const presenti = new Map((soggetti || []).map(s => [s.chiave, s.nome]));
  const fuori = [];
  for (const t of catalogo || []) {
    if (t.attivo === false) continue;
    const nominati = soggettiDelTipo(t);
    const ruoli = ruoliDaTesto(t.si_applica_a);

    if (nominati.length === 0) {
      if (ruoli.length === 0) {
        fuori.push({
          tipo_id: t.id, tipo_nome: t.nome, gravita: 'errore',
          messaggio: `"${t.nome}" non e' richiesto a nessuno: non ha ne' ruoli ne' fornitori indicati.`,
        });
      }
      continue;
    }

    const assenti = nominati.filter(n => !presenti.has(n.chiave));
    if (assenti.length > 0) {
      const nomi = assenti.map(n => n.nome || n.chiave).join(', ');
      fuori.push({
        tipo_id: t.id, tipo_nome: t.nome, gravita: 'errore',
        soggetti: assenti.map(n => n.chiave),
        messaggio: `"${t.nome}" e' richiesto a ${nomi}, che nel ${anno} non risulta fra i soggetti da qualificare: il documento non verra' mai chiesto. Controlla la ragione sociale oppure includi il soggetto nell'anno.`,
      });
    }
    if (ruoli.length > 0) {
      fuori.push({
        tipo_id: t.id, tipo_nome: t.nome, gravita: 'attenzione',
        messaggio: `"${t.nome}" e' intestato a fornitori precisi: i ruoli indicati non contano e il documento non viene chiesto agli altri soggetti di quei ruoli.`,
      });
    }
  }
  return fuori;
}

// Stati che richiedono un intervento e che quindi contano come alert.
export const STATI_ALERT = ['scaduto', 'non_conforme', 'mancante', 'in_scadenza', 'da_verificare'];

/**
 * Conta gli alert aperti e li salva nel riepilogo dell'anno.
 *
 * Il numero accanto alla voce del menu legge solo questo record: ricalcolarlo a
 * ogni pagina vorrebbe dire rileggere tutte le movimentazioni. Il riepilogo si
 * aggiorna ogni volta che il modulo calcola la situazione e a ogni controllo
 * giornaliero, che coglie anche i documenti scaduti durante la notte.
 */
export async function salvaRiepilogo(base44, anno, valutati, anomalie) {
  const requisiti = valutati.flatMap(s => s.requisiti);
  const conta = (stato) => requisiti.filter(r => r.stato === stato).length;
  const dati = {
    anno: Number(anno),
    alert_aperti: requisiti.filter(r => STATI_ALERT.includes(r.stato)).length,
    soggetti_con_alert: valutati.filter(s => s.requisiti.some(r => STATI_ALERT.includes(r.stato))).length,
    scaduti: conta('scaduto'),
    non_conformi: conta('non_conforme'),
    mancanti: conta('mancante'),
    in_scadenza: conta('in_scadenza'),
    da_verificare: conta('da_verificare'),
    // Errori di impostazione del catalogo: la dashboard li legge da qui senza
    // rifare tutta la valutazione.
    anomalie_catalogo: (anomalie || []).filter(a => a.gravita === 'errore').length,
    anomalie_catalogo_testo: [...new Set((anomalie || []).filter(a => a.gravita === 'errore').map(a => a.tipo_nome))].join(', ').slice(0, 300),
    // Chi ha documenti scaduti o non conformi, per nome: la fatturazione passiva
    // lo legge da qui e avvisa prima di pagare, senza rifare tutta la valutazione.
    soggetti_critici: valutati
      .map(s => ({
        nome: s.nome || '', chiave: s.chiave || '',
        scaduti: s.requisiti.filter(r => r.stato === 'scaduto').map(r => r.tipo_nome),
        non_conformi: s.requisiti.filter(r => r.stato === 'non_conforme').map(r => r.tipo_nome),
      }))
      .filter(s => s.scaduti.length + s.non_conformi.length > 0),
    aggiornato_il: new Date().toISOString(),
  };
  const ent = base44.asServiceRole.entities.RiepilogoQualifica;
  const esistenti = await ent.filter({ anno: Number(anno) }, '-created_date', 5);
  if (esistenti.length > 0) {
    await ent.update(esistenti[0].id, dati);
    // Eventuali doppioni, nati da due calcoli contemporanei, si eliminano.
    for (const extra of esistenti.slice(1)) await ent.delete(extra.id);
  } else {
    await ent.create(dati);
  }
  // Il riepilogo si salva solo su archivi interi (mai durante un caricamento):
  // e' anche il momento di chiudere i contratti finiti (13/10/2026).
  await chiudiContrattiSuperati(base44, valutati);
  return dati;
}

/**
 * IL PASSO DELLA DECORRENZA (revisione del 13/10/2026). I contratti scaduti
 * accanto a uno in vigore (superati, vedi documentoDelRequisito) passano fra i
 * sostituiti, come in un caricamento a mano: una scrittura per documento, una
 * volta sola, perche' dopo non e' piu' attivo; nessuna lettura in piu', i
 * documenti sono quelli gia' letti per la valutazione. Una scrittura che non
 * riesce si rifa' al calcolo dopo: il documento intanto non porta alert, perche'
 * il requisito non lo guarda. Restituisce quanti ne ha chiusi.
 */
export async function chiudiContrattiSuperati(base44, valutati) {
  const ids = [...new Set((valutati || []).flatMap(s => (s.requisiti || []).flatMap(r => r.superati || [])))];
  let chiusi = 0;
  for (const id of ids) {
    try {
      await base44.asServiceRole.entities.DocumentoQualifica.update(id, { stato: 'sostituito' });
      chiusi++;
    } catch (_e) { /* si rifa' al prossimo calcolo */ }
  }
  return chiusi;
}

/**
 * Trasforma lo stato dei requisiti in eventi da segnalare via email.
 * Ogni evento ha una chiave stabile: serve a non ripetere lo stesso promemoria
 * ogni giorno. Una soglia di scadenza si segnala una sola volta; un problema
 * aperto torna ogni RIPETIZIONE_GIORNI giorni finche' non viene risolto.
 */
export function eventiDaSegnalare(valutati) {
  const eventi = [];
  for (const s of valutati) {
    for (const r of s.requisiti) {
      const doc = r.documento;
      const base = { soggetto: s.nome, soggetto_chiave: s.chiave, tipo: r.tipo_nome, scadenza: r.scadenza, giorni: r.giorni };
      if (r.stato === 'mancante') {
        eventi.push({ ...base, stato: r.stato, chiave: `mancante|${s.chiave}|${r.tipo_id}`, ripetibile: true });
      } else if (r.stato === 'scaduto' && doc) {
        eventi.push({ ...base, stato: r.stato, chiave: `scaduto|${doc.id}`, ripetibile: true });
      } else if (r.stato === 'non_conforme' && doc) {
        eventi.push({ ...base, stato: r.stato, chiave: `nonconforme|${doc.id}`, ripetibile: true, problemi: r.problemi.filter(p => p.gravita === 'bloccante'), richiesta: doc.richiesta_al_fornitore });
      } else if (r.stato === 'da_verificare' && doc) {
        eventi.push({ ...base, stato: r.stato, chiave: `verifica|${doc.id}`, ripetibile: true, problemi: r.problemi });
      } else if (r.stato === 'in_scadenza' && doc && r.giorni !== null) {
        // La soglia e' la piu' stretta gia' raggiunta: i giorni residui possono solo
        // calare, quindi le soglie piu' larghe non torneranno a scattare.
        const soglia = [...SOGLIE_AVVISO].sort((a, b) => a - b).find(v => r.giorni <= v);
        if (soglia !== undefined) {
          eventi.push({ ...base, stato: r.stato, chiave: `scadenza|${doc.id}|${soglia}`, ripetibile: false, soglia });
        }
      }
    }
  }
  return eventi;
}
