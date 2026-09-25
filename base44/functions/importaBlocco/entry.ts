import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { SHEET_MAP, NUMERIC_FIELDS } from "../../shared/excelSchemas.ts";
import { FILE_SIGNATURES, checkSignature, detectType, mappaColonne } from "../../shared/fileSignatures.ts";
import { enrichRecords } from "../../shared/dataEnrichment.ts";
import { ARCHIVI_PRIMARIE, DATE_PRIMARIE, archivioPrimaria, dataPrimaria, recordAssegnato } from "../../shared/primarie.ts";
import { livelloDi, puoCaricare, rispostaCaricamentoNegato } from "../../shared/livelli.ts";
import { fetchAll, RIGHE_PER_PAGINA, ultimaPagina } from "../../shared/fetchAll.ts";
import { allineaDalPortale } from "../../shared/agganciaDichiarazioni.ts";
import { evasioneOrdini, listaOrdini, statoRichiesta, riconosciOrdine, ritiriTerminati, idOrdineDaSalvare, ordiniConDateDaSistemare } from "../../shared/richiesteEct.ts";
import { annoRoma, oggiRoma } from "../../shared/giornoItaliano.ts";
import { statoCaricamenti } from "../../shared/reportSettimanali.ts";
import { annoDelloStorico, ordiniDaConservare, cancellatiDaLasciare, svuotaTranne } from "../../shared/storicoConservato.ts";

// Le dichiarazioni riconosciute, un canale per volta: nel registro non si sommano.
const perCanale = (righe) => [['RETE', 'rete'], ['ACI', 'ACI'], ['EXTRA_RACCOLTA', 'extra raccolta']]
  .map(([c, nome]) => [nome, righe.filter(x => (x.canale || 'RETE') === c).length]).filter(([, n]) => n)
  .map(([nome, n]) => `${nome} ${n}`).join(', ') || '0';

// Importazione a blocchi per i report di grandi dimensioni del portale Ecotyre.
//
// Perche' esiste: il report delle dichiarazioni di trattamento pesa oltre 4 MB e
// contiene piu' di un milione di celle. Leggerlo dentro una function esaurisce la
// memoria disponibile e il processo viene terminato dalla piattaforma. La lettura
// avviene quindi nel browser e qui arrivano blocchi di poche centinaia di righe.
//
// Ogni invocazione fa una cosa sola e deve restare ampiamente sotto il timeout di
// venti secondi della connessione al database. Le azioni sono:
//   prepara  - verifica la firma del file, il controllo anti-regressione e svuota
//              l'archivio precedente
//   scrivi   - scrive un blocco con una sola chiamata a bulkCreate
//   conta    - restituisce quanti record contiene l'archivio
//   registra - scrive il registro dei caricamenti a fine importazione
//
// Le primarie arrivano da un solo file ma vanno in quattro archivi (rete, ACI,
// assegnati rete, assegnati ACI): il browser indica l'archivio di ogni blocco e
// ogni archivio si svuota subito prima di essere riscritto, con l'azione
//   svuota   - svuota l'archivio indicato
// La preparazione delle primarie non cancella nulla: confronta gli ordini del
// file con quelli in archivio e blocca il caricamento se ne mancano.
//
// Dopo la registrazione, due azioni rifanno cio' che dipende dal file appena
// caricato (ogni caricamento aggiorna tutto, regola dell'utente del 21/09/2026).
// Stanno fuori da "registra" apposta: leggono archivi interi, e se non riescono
// il caricamento resta buono e il registro chiuso.
//   allinea    - report delle dichiarazioni: riconosce le nostre dichiarazioni
//                mensili caricate a portale (caricata_inviata, data, materiali)
//   ritiri_ect - primarie: riconosce fra assegnati e primarie l'ordine delle
//                richieste del consorzio, e fra i terminati il loro ritiro; con
//                un caricamento delle primarie aperto rinvia (409)
//
// Un blocco corrisponde a una sola scrittura: o la riga vanno tutte a buon fine o
// non ne va nessuna. Il browser puo' quindi ritentare un blocco fallito senza
// rischiare duplicati, e verificare con l'azione conta se la scrittura era invece
// arrivata a destinazione nonostante l'errore di rete.

const LIMITE_INVOCAZIONE_MS = 12000;

// Un caricamento svuota l'archivio e poi lo riscrive a blocchi dal browser. Se la
// scheda si chiude a meta', l'archivio resta vuoto o parziale: prima non restava
// scritto da nessuna parte. Ora la preparazione apre una riga "in_corso" nel
// registro, con chi l'ha avviata, e la registrazione finale la chiude. Una riga
// rimasta "in_corso" E' la traccia dell'interruzione. Serve anche da blocco:
// due persone non caricano lo stesso archivio nello stesso momento.
//
// Un caricamento che finisce senza nessuna riga scritta ha gia' svuotato
// l'archivio: la sua riga NON si chiude in "errore", resta "in_corso" e cambia
// solo il messaggio, che comincia con NON_RIUSCITO. Chiusa, nessuno vedeva piu'
// l'archivio vuoto: statoCaricamenti, il cruscotto e i ricalcoli dopo i
// caricamenti guardano le righe "in_corso", e rifacevano e salvavano esiti
// sull'archivio vuoto (regola 2). Cosi' la vedono aperta, e interrotta dopo
// dieci minuti. Si chiude in "errore" solo cio' che fallisce prima dello
// svuotamento, a dati intatti. Una riga NON_RIUSCITO non blocca un altro utente:
// nessuno sta piu' scrivendo.
const FINESTRA_IN_CORSO_MS = 10 * 60 * 1000;
const NON_RIUSCITO = 'Caricamento non riuscito';
const chi = (user) => (user && (user.full_name || user.email)) || '';

async function apriCaricamento(base44, user, tipo_file, nome_file, prima) {
  const Log = base44.asServiceRole.entities.UploadLog;
  const aperti = await Log.filter({ tipo_file, esito: 'in_corso' }, '-created_date', 20);
  const adesso = Date.now();
  for (const l of aperti) {
    const eta = adesso - new Date(String(l.created_date).replace(/(Z|[+-]\d{2}:?\d{2})?$/, 'Z')).getTime();
    const fallito = String(l.messaggio || '').startsWith(NON_RIUSCITO);
    if (!fallito && eta < FINESTRA_IN_CORSO_MS && l.utente && l.utente !== chi(user)) {
      return { bloccato: `${l.utente} sta caricando lo stesso archivio da ${Math.max(1, Math.round(eta / 60000))} minuti: aspetta che finisca, altrimenti i due caricamenti si sovrascrivono.` };
    }
    // un caricamento precedente rimasto a meta': lo si dice, e se ne apre uno nuovo
    await Log.update(l.id, { esito: 'errore', messaggio: fallito ? `${l.messaggio} E' stato ricaricato dopo.` : `Caricamento interrotto: avviato da ${l.utente || 'sconosciuto'} e mai concluso. L'archivio poteva essere incompleto; e' stato ricaricato dopo.` });
  }
  const riga = await Log.create({
    tipo_file, nome_file: nome_file || 'N/D', esito: 'in_corso', utente: chi(user),
    righe_importate: 0, righe_fallite: 0, modalita: 'sostituzione',
    righe_archivio_prima: typeof prima === 'number' ? prima : undefined,
    messaggio: 'Caricamento in corso: archivio in riscrittura.',
  });
  return { id: riga.id };
}

// La registrazione finale chiude la riga aperta dalla preparazione; se non la trova ne scrive una nuova.
// Arriva sempre dopo lo svuotamento: con esito "errore" non e' entrata nessuna
// riga e l'archivio e' vuoto, quindi la riga resta "in_corso" col solo messaggio
// cambiato. Se la riga non c'e' piu', l'ha chiusa un caricamento partito dopo,
// che decide lui dell'archivio: questa resta nello storico.
async function chiudiCaricamento(base44, user, tipo_file, campi) {
  const Log = base44.asServiceRole.entities.UploadLog;
  const aperti = await Log.filter({ tipo_file, esito: 'in_corso' }, '-created_date', 5);
  const mio = aperti.find(l => !l.utente || l.utente === chi(user)) || null;
  if (mio && campi.esito === 'errore') {
    await Log.update(mio.id, { messaggio: `${NON_RIUSCITO}: nessuna riga scritta dopo lo svuotamento dell'archivio (${campi.messaggio}). L'archivio e' vuoto: ricarica il file.` });
  } else if (mio) await Log.update(mio.id, { ...campi, utente: chi(user) });
  else await Log.create({ ...campi, utente: chi(user) });
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Campi che rappresentano una data: accettano seriale Excel o testo AAAA-MM-GG.
const DATE_FIELDS = new Set([
  'data_chiusura', 'data_immissione', 'inizio_trasporto', 'fine_trasporto',
  'data_esecuzione', 'data_dichiarazione',
]);

function serialeExcelInData(seriale) {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(seriale * 86400000));
}

function convertiData(val) {
  if (val === undefined || val === null || val === '') return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val.toISOString();
  const n = typeof val === 'number' ? val : Number(String(val).trim());
  if (!isNaN(n) && n > 20000) {
    const d = serialeExcelInData(n);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(String(val).trim());
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Trasforma una riga grezza del foglio nell'oggetto dell'entita'.
// Le date si riconoscono dal campo, non dal tipo di file: la conversione delle
// tre date obbligatorie era accesa solo per le primarie, e un nuovo slot che
// porta le stesse colonne sarebbe entrato con le date illeggibili.
function mappaRiga(row, colMap, primarie = false) {
  const obj = {};
  for (const [colonnaExcel, campo] of Object.entries(colMap)) {
    const val = row[colonnaExcel];
    if (DATE_FIELDS.has(campo)) { obj[campo] = convertiData(val); continue; }
    if (DATE_PRIMARIE.has(campo)) { obj[campo] = dataPrimaria(val); continue; }
    if (val === undefined || val === null || val === '') { obj[campo] = null; continue; }
    if (NUMERIC_FIELDS.has(campo)) {
      const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
      obj[campo] = isNaN(n) ? null : n;
    } else if (primarie && campo === 'stato') {
      obj[campo] = String(val).trim().toLowerCase();
    } else {
      obj[campo] = String(val).trim();
    }
  }
  return obj;
}

// Identificativi degli ordini di un archivio, letti a pagine ordinate per ordine:
// l'ordinamento per data di creazione non e' stabile fra pagine, perche' i record
// scritti insieme hanno la stessa data.
async function idArchivio(base44, entita) {
  const ids = new Set();
  for (let skip = 0; ; ) {
    const pagina = await base44.asServiceRole.entities[entita].list('id_ordine', RIGHE_PER_PAGINA, skip, ['id_ordine']);
    for (const r of pagina) if (r.id_ordine) ids.add(String(r.id_ordine));
    if (ultimaPagina(pagina.length, RIGHE_PER_PAGINA)) break;
    skip += pagina.length;
    await sleep(100);
  }
  return ids;
}

// I record di un archivio con i soli campi che servono a decidere che cosa
// conservare dello storico (shared/storicoConservato.ts).
async function recordArchivio(base44, entita) {
  const righe = [];
  for (let skip = 0; ; ) {
    const pagina = await base44.asServiceRole.entities[entita].list('id_ordine', RIGHE_PER_PAGINA, skip, ['id_ordine', 'stato', 'trasporto_finito_il', 'ordine_immesso_il']);
    righe.push(...pagina);
    if (ultimaPagina(pagina.length, RIGHE_PER_PAGINA)) break;
    skip += pagina.length;
    await sleep(100);
  }
  return righe;
}

// Solo i terminati si conservano: gli archivi degli assegnati si riscrivono sempre.
const ARCHIVI_CON_STORICO = ['PrimariaRete', 'PrimariaAci'];

// Da quale anno si carica: l'anno scorso, come per gli avvisi sulle date
// (annoDelloStorico in shared/storicoConservato.ts).
const annoInizioPrimarie = () => annoDelloStorico();

// Riconosce gli errori di rete o di attesa: non vanno ritentati qui dentro perche'
// ogni tentativo puo' bruciare venti secondi e far superare all'invocazione il
// tempo massimo concesso dalla piattaforma. Il ritentativo spetta al browser.
function eInterruzione(e) {
  const m = String(e && e.message ? e.message : e).toLowerCase();
  return m.indexOf('timed out') >= 0 || m.indexOf('timeout') >= 0
    || m.indexOf('econnreset') >= 0 || m.indexOf('socket hang up') >= 0
    || m.indexOf('connection') >= 0 || m.indexOf('network') >= 0;
}

// Conta i record dell'archivio. Il client non espone un conteggio e rileggere
// l'intero archivio costerebbe quanto l'importazione stessa: si interroga quindi
// la sola presenza di un record a una data posizione.
//
// Il browser conosce i due soli esiti possibili di un blocco: o e' entrato tutto
// o non e' entrato niente. Verificare le due ipotesi costa due interrogazioni
// ciascuna; solo se nessuna regge si procede per raddoppi e bisezione.
async function contaRecord(base44, entita, ipotesi) {
  const ent = base44.asServiceRole.entities[entita];
  const esiste = async (i) => (await ent.list('created_date', 1, i)).length > 0;

  for (const n of ipotesi) {
    if (typeof n !== 'number' || n <= 0) continue;
    if ((await esiste(n - 1)) && !(await esiste(n))) return n;
  }

  if (!(await esiste(0))) return 0;
  let basso = 0, alto = 1;
  while (await esiste(alto)) {
    basso = alto;
    alto *= 2;
    if (alto > 2000000) return alto;
  }
  while (alto - basso > 1) {
    const medio = Math.floor((basso + alto) / 2);
    if (await esiste(medio)) basso = medio; else alto = medio;
  }
  return basso + 1;
}

// La data del ritiro da salvare. Si riscrive a ogni ricalcolo: prima si scriveva
// solo quando c'era, e non si toglieva mai, cosi' una richiesta a cui si
// aggiungeva a mano un secondo ordine non ancora ritirato restava "da
// confermare" sulla data vecchia, con ordini_evasi minore di ordini_totali. Si
// toglie pero' solo quando l'archivio dice che un suo ordine non e' ritirato
// (c'e', ma non terminato con la fine trasporto); un ordine che nell'archivio
// non c'e' affatto - un caricamento parziale, un blocco non scritto - non basta
// a cancellare un ritiro gia' rilevato: si tiene la data salvata.
function dataRitiro(salvata, ids, ev, terminati, presenti) {
  if (ev.ultima) return ev.ultima;
  if (!salvata) return null;
  const mancanti = ids.filter(id => !terminati.has(id));
  return mancanti.every(id => presenti.has(id)) ? null : salvata;
}

// Le richieste del consorzio dicono "ritirato il" quando il loro ordine compare
// fra i terminati. Prima lo si calcolava solo ricaricando il file delle richieste
// (importaRichiesteEct): un ritiro arrivato con le primarie restava "in attesa" e
// in ritardo, e si rischiava di sollecitare un ritiro gia' fatto. Il giorno e'
// quello italiano della fine trasporto, mai la chiusura a portale.
//
// Anche l'ID ordine si ricerca: il file delle primarie riscrive gli assegnati, e
// una richiesta rimasta "non trovata" o "ambigua" perche' il suo ordine non era
// ancora fra gli assegnati quando si e' caricato il foglio ECT restava senza ID,
// quindi "in attesa", finche' qualcuno non ricaricava quel foglio. Vale per le
// richieste senza ID scritti a mano, che vincono sempre; un ID gia' riconosciuto
// si sostituisce solo con un altro ID, mai con "non trovato" o "ambiguo" (un
// secondo ordine dello stesso produttore e dello stesso giorno avrebbe tolto
// l'ordine, e con lui il ritiro, a una richiesta gia' evasa): la regola sta in
// idOrdineDaSalvare, la stessa del caricamento del foglio ECT. Spunte, ID
// scritti a mano e note non si toccano.
//
// Una richiesta ancora aperta che aspetta un ordine terminato senza fine
// trasporto si segnala (terminati_senza_fine): il ritiro non si conta senza la
// data (regola 1), ma c'e', e sollecitarlo sarebbe sbagliato. Una evasa (anche
// gia' spuntata), o in parte evasa, da un ordine con la fine trasporto ma con un'altra data
// obbligatoria che manca o non torna si dice anche lei
// (ordini_con_date_da_sistemare, regola dell'utente del 22/09/2026).
async function riconosciRitiriEct(base44) {
  const svc = base44.asServiceRole.entities;
  const anno = Number(oggiRoma().slice(0, 4));
  const tutte = await fetchAll(svc.RichiestaEct, { anno });
  const richieste = tutte.filter(r => r.esito !== 'evasa' && r.esito !== 'annullata');
  // Le evase gia' spuntate non si toccano: si guardano solo per le date.
  const evase = tutte.filter(r => r.esito === 'evasa');
  if (!richieste.length && !evase.length) return { controllate: 0, aggiornate: 0, da_confermare: [], terminati_senza_fine: [], ordini_con_date_da_sistemare: [] };

  // Gli stessi archivi del caricamento delle richieste: gli assegnati e tutte le
  // primarie, perche' l'ordine della richiesta puo' essere gia' terminato.
  const [assRete, assAci, rete, aci] = await Promise.all([
    fetchAll(svc.Assegnato),
    fetchAll(svc.AssegnatoAci),
    fetchAll(svc.PrimariaRete),
    fetchAll(svc.PrimariaAci),
  ]);
  const ordini = [...assRete, ...assAci, ...rete, ...aci];
  const { terminati, senzaFine, daSistemare } = ritiriTerminati([...rete, ...aci]);
  const presenti = new Set(ordini.map(o => String(o.id_ordine || '').trim()).filter(Boolean));

  let aggiornate = 0;
  const daConfermare = [];
  const terminatiSenzaFine = [];
  const conDate = [];
  for (const r of richieste) {
    const campi: any = {};
    if (!String(r.id_ordine_manuale || '').trim()) Object.assign(campi, idOrdineDaSalvare(r, riconosciOrdine(r, ordini)));
    const ids = listaOrdini({ ...r, ...campi });
    const ev = evasioneOrdini(ids, terminati);
    campi.ordini_totali = ev.totali;
    campi.ordini_evasi = ev.evasi;
    campi.evasione_rilevata_il = dataRitiro(r.evasione_rilevata_il, ids, ev, terminati, presenti);
    campi.esito = statoRichiesta({ ...r, ...campi });
    const senzaData = ids.filter(id => senzaFine.has(id));
    if (campi.esito === 'aperta' && senzaData.length) terminatiSenzaFine.push({ pdr: r.pdr_nome, id_ordine: senzaData.join(', ') });
    conDate.push(...ordiniConDateDaSistemare(r.pdr_nome, ids, terminati, daSistemare));
    if (!Object.keys(campi).some(k => String(r[k] ?? '') !== String(campi[k] ?? ''))) continue;
    // chi diventa "ritirata, da spuntare" adesso va detto: e' la riga su cui rispondere al consorzio
    if (campi.esito === 'da_confermare' && r.esito !== 'da_confermare') daConfermare.push({ pdr: r.pdr_nome, id_ordine: ids.join(', '), evasa_il: campi.evasione_rilevata_il });
    await svc.RichiestaEct.update(r.id, campi);
    aggiornate++;
  }
  for (const r of evase) conDate.push(...ordiniConDateDaSistemare(r.pdr_nome, listaOrdini(r), terminati, daSistemare));
  return { controllate: richieste.length, aggiornate, da_confermare: daConfermare, terminati_senza_fine: terminatiSenzaFine, ordini_con_date_da_sistemare: conDate };
}

// Gli ordini delle richieste si cercano fra primarie e assegnati: se il loro
// archivio si sta riscrivendo, o un caricamento l'ha lasciato a meta', ID e ritiri
// letti adesso sarebbero sbagliati e verrebbero salvati. Si rinvia (409) dicendo
// quale caricamento lo impedisce; si rifa' a caricamento concluso.
async function rinvioPerCaricamento(base44) {
  const { in_corso } = await statoCaricamenti(base44, ['primarie']);
  if (!in_corso.length) return null;
  const c = in_corso[0];
  const chi = c.utente ? ` di ${c.utente}` : '';
  const file = c.nome_file ? ` (${c.nome_file})` : '';
  return c.interrotto
    ? `Rinviato: il caricamento delle primarie${chi}${file} del ${c.data} e' rimasto interrotto e l'archivio puo' essere incompleto. Ricarica il file delle primarie.`
    : `Rinviato: caricamento delle primarie${chi}${file} in corso. I ritiri si riconoscono quando finisce.`;
}

export default async function(req) {
  const t0 = Date.now();
  let fase = 'avvio';
  let archivioSvuotato = false;

  try {
    fase = 'autenticazione';
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized', dati_intatti: true }, { status: 401 });

    fase = 'lettura della richiesta';
    const body = await req.json();
    const {
      azione, tipo_file, nome_file, intestazioni, righe, blocco,
      totale_righe, conferma_forzatura, atteso, minimo,
    } = body;

    // Il permesso dipende dal file: l'operatore base carica primarie, secondarie
    // e terziarie, l'amministratore tutto.
    const livello = await livelloDi(base44, user);
    if (!puoCaricare(livello, tipo_file)) return rispostaCaricamentoNegato(livello, tipo_file);

    const config = SHEET_MAP[tipo_file];
    if (!config) {
      return Response.json({ error: 'tipo_file non valido: ' + tipo_file, dati_intatti: true }, { status: 400 });
    }
    const primarie = tipo_file === 'primarie';

    // === ALLINEAMENTO delle dichiarazioni mensili al report appena caricato ===
    // Succedeva solo nell'importazione lato server (importEcotyreFile), che per
    // questo report non si usa piu' da quando si legge nel browser: le nostre
    // dichiarazioni restavano "non caricate" e la giacenza calcolata della
    // quadratura restava alta proprio del mese gia' dichiarato. Si allinea ogni
    // anno presente nel report, come fa il pulsante di Dichiarazioni Impianti.
    if (azione === 'allinea') {
      if (tipo_file !== 'dichiarazioni_trattamento') return Response.json({ error: 'Azione non prevista per ' + tipo_file, dati_intatti: true }, { status: 400 });
      fase = 'allineamento delle dichiarazioni mensili';
      const svc = base44.asServiceRole.entities;
      const righePortale = await fetchAll(svc.DichiarazioneTrattamento, null, 'id');
      // L'anno del giorno italiano, come lo legge allineaDalPortale: tagliando la
      // stringa UTC un caricamento del 1 gennaio a mezzanotte italiana cadeva
      // nell'anno prima, e il suo anno restava fuori.
      const anni = [...new Set(righePortale.map(r => annoRoma(r.data_dichiarazione)).filter(Boolean))].sort((x, y) => x - y);
      const aggiornate = [];
      const nonTrovate = [];
      for (const a of anni) {
        const esito = await allineaDalPortale(svc, a, righePortale);
        aggiornate.push(...esito.aggiornate.map(x => ({ ...x, anno: a })));
        // Con l'anno, chi le mostra distingue i mesi dell'ultimo anno, che possono
        // ancora comparire, da quelli degli anni chiusi.
        nonTrovate.push(...esito.non_trovate.map(x => ({ ...x, anno: a })));
      }
      // Nel registro, accanto al caricamento, come faceva l'importazione lato server.
      fase = 'nota nel registro caricamenti';
      const [ultimo] = await svc.UploadLog.filter({ tipo_file }, '-created_date', 1);
      if (ultimo && (ultimo.esito === 'successo' || ultimo.esito === 'parziale') && !String(ultimo.messaggio || '').includes('dichiarazioni riconosciute a portale')) {
        await svc.UploadLog.update(ultimo.id, { messaggio: `${ultimo.messaggio || ''} | dichiarazioni riconosciute a portale: ${perCanale(aggiornate)}` });
      }
      return Response.json({ allineamento: { anni: anni.map(Number), aggiornate, non_trovate: nonTrovate }, dati_intatti: true });
    }

    // === RITIRI delle richieste del consorzio, fra i terminati appena caricati ===
    if (azione === 'ritiri_ect') {
      if (!primarie) return Response.json({ error: 'Azione non prevista per ' + tipo_file, dati_intatti: true }, { status: 400 });
      fase = 'controllo dei caricamenti in corso';
      const rinvio = await rinvioPerCaricamento(base44);
      if (rinvio) return Response.json({ error: rinvio, rinviato: true, dati_intatti: true }, { status: 409 });
      fase = 'riconoscimento dei ritiri delle richieste ECT';
      return Response.json({ ...(await riconosciRitiriEct(base44)), dati_intatti: true });
    }

    if (primarie && azione !== 'prepara' && azione !== 'registra' && !ARCHIVI_PRIMARIE.includes(body.entita)) {
      return Response.json({ error: 'Archivio delle primarie non valido: ' + body.entita, dati_intatti: true }, { status: 400 });
    }
    const entita = primarie ? body.entita : config.entity;

    // === CONTEGGIO: quante righe contiene ora l'archivio ===
    if (azione === 'conta') {
      fase = 'conteggio archivio';
      const conteggio = await contaRecord(base44, entita, [atteso, minimo]);
      return Response.json({ conteggio, dati_intatti: true });
    }

    // === SVUOTAMENTO di un archivio delle primarie, subito prima di riscriverlo ===
    if (azione === 'svuota') {
      if (!primarie) return Response.json({ error: 'Azione non prevista per ' + tipo_file, dati_intatti: true }, { status: 400 });
      fase = "svuotamento dell'archivio " + entita;
      // Un file che comincia da un anno conserva i terminati degli anni prima
      // (storicoConservato.ts): gli altri ordini si cancellano, quelli restano.
      const annoInizio = annoInizioPrimarie();
      let conservati = { ordini: new Set(), righe: 0 };
      let archivio = [];
      // Senza gli ID del file non si sa che cosa manca: si conserva solo se il
      // browser li manda, cioe' quando la preparazione ha trovato qualcosa.
      if (annoInizio && ARCHIVI_CON_STORICO.includes(entita) && Array.isArray(body.ids) && body.ids.length) {
        archivio = await recordArchivio(base44, entita);
        conservati = ordiniDaConservare(archivio, new Set(body.ids.map(String)));
      }
      archivioSvuotato = true;
      await svuotaTranne(base44.asServiceRole.entities[entita], archivio, conservati.ordini, sleep);
      return Response.json({ svuotato: true, entita, conservati: conservati.righe });
    }

    // === REGISTRAZIONE delle primarie: un riepilogo per archivio ===
    if (azione === 'registra' && primarie) {
      fase = 'scrittura registro caricamenti';
      const archivi = body.archivi || {};
      const n = (a, k) => Number(archivi[a] && archivi[a][k]) || 0;
      const fallite = ARCHIVI_PRIMARIE.reduce((s, a) => s + n(a, 'fallite'), 0);
      const disallineati = ARCHIVI_PRIMARIE.filter(a => archivi[a] && typeof archivi[a].archivio === 'number' && archivi[a].archivio !== n(a, 'attese'));
      const scritte = n('PrimariaRete', 'scritte') + n('PrimariaAci', 'scritte');
      const esito = fallite === 0 && disallineati.length === 0 && scritte > 0 ? 'successo' : (scritte > 0 ? 'parziale' : 'errore');
      let messaggio = `Rete: ${n('PrimariaRete', 'scritte')} | ACI: ${n('PrimariaAci', 'scritte')} | Ass. Rete: ${n('Assegnato', 'scritte')} | Ass. ACI: ${n('AssegnatoAci', 'scritte')} (lettura nel browser)`;
      if (fallite > 0) messaggio += ` — ${fallite} righe non scritte`;
      if (disallineati.length) messaggio += ' — archivio non allineato: ' + disallineati.map(a => `${a} ${n(a, 'archivio')} su ${n(a, 'attese')}`).join(', ');
      if (body.ultimo_errore) messaggio += ' — ultimo errore: ' + body.ultimo_errore;
      if (body.durata_secondi) messaggio += ` [durata: ${body.durata_secondi}s]`;
      await chiudiCaricamento(base44, user, tipo_file, {
        tipo_file, nome_file: nome_file || 'N/D',
        righe_importate: scritte, righe_fallite: fallite, esito, messaggio,
        righe_archivio_prima: typeof body.righe_archivio_prima === 'number' ? body.righe_archivio_prima : undefined,
        forzato: conferma_forzatura === true ? true : undefined,
        modalita: 'sostituzione',
      });
      return Response.json({ registrato: true, esito });
    }

    // === REGISTRAZIONE: registro dei caricamenti a fine importazione ===
    if (azione === 'registra') {
      fase = 'scrittura registro caricamenti';
      const scritte = Number(body.righe_importate) || 0;
      const fallite = Number(body.righe_fallite) || 0;
      const esito = fallite === 0 && scritte > 0 ? 'successo' : (scritte > 0 ? 'parziale' : 'errore');
      const parti = [scritte + ' righe importate (lettura nel browser)'];
      if (fallite > 0) parti.push(fallite + ' righe non scritte');
      if (body.ultimo_errore) parti.push('ultimo errore: ' + body.ultimo_errore);
      if (typeof body.conteggio_finale === 'number') parti.push('archivio verificato: ' + body.conteggio_finale + ' record');
      await chiudiCaricamento(base44, user, tipo_file, {
        tipo_file, nome_file: nome_file || 'N/D',
        righe_importate: scritte, righe_fallite: fallite, esito,
        messaggio: parti.join(' — '),
        righe_archivio_prima: typeof body.righe_archivio_prima === 'number' ? body.righe_archivio_prima : undefined,
        forzato: conferma_forzatura === true ? true : undefined,
        modalita: 'sostituzione',
      });
      return Response.json({ registrato: true, esito });
    }

    // === PREPARAZIONE: validazione, anti-regressione, svuotamento ===
    if (azione === 'prepara') {
      fase = 'verifica della firma delle intestazioni';
      const sig = FILE_SIGNATURES[tipo_file];
      if (sig) {
        const headers = Array.isArray(intestazioni) ? intestazioni.map(h => String(h || '')) : [];
        const check = checkSignature(headers, sig);
        if (!check.match) {
          const rilevato = detectType(headers);
          const parti = [];
          if (check.chiave_mancanti.length > 0) parti.push('Colonne chiave mancanti: ' + check.chiave_mancanti.slice(0, 10).join(', '));
          if (check.vietate_trovate.length > 0) parti.push('Colonne vietate presenti: ' + check.vietate_trovate.join(', '));
          const risposta: any = {
            error: 'Formato file non valido',
            dettaglio: parti.join('. ') || 'Le intestazioni non corrispondono al tipo file richiesto',
            dati_intatti: true,
          };
          if (rilevato && rilevato !== tipo_file) {
            risposta.tipo_rilevato = `Il file caricato sembra di tipo ${rilevato.toUpperCase()} ma e' stato caricato nello slot ${tipo_file.toUpperCase()}`;
          }
          await base44.asServiceRole.entities.UploadLog.create({
            tipo_file, nome_file: nome_file || 'N/D', righe_importate: 0, righe_fallite: 0,
            esito: 'errore', messaggio: risposta.error + (risposta.tipo_rilevato ? ' - ' + risposta.tipo_rilevato : ''),
          });
          return Response.json(risposta, { status: 400 });
        }
      }

      if (!totale_righe || totale_righe === 0) {
        return Response.json({ error: 'Nessuna riga valida trovata nel file', dati_intatti: true }, { status: 400 });
      }

      if (primarie) {
        const erroreRegistrato = async (risposta, stato, messaggio, prima) => {
          await base44.asServiceRole.entities.UploadLog.create({
            tipo_file, nome_file: nome_file || 'N/D', righe_importate: 0, righe_fallite: 0,
            esito: 'errore', messaggio, righe_archivio_prima: prima, forzato: false,
          });
          return Response.json({ ...risposta, dati_intatti: true }, { status: stato });
        };

        if (!(Number(body.terminati) > 0)) {
          const error = "Il file non contiene alcun ordine terminato: sembra una selezione filtrata (es. soli assegnati), non l'export completo delle primarie.";
          return await erroreRegistrato({ error }, 400, error, undefined);
        }

        // Ogni ordine in archivio deve essere anche nel file: un export filtrato per
        // data o per stato cancellerebbe gli ordini che non contiene.
        fase = 'controllo anti-regressione';
        const idFile = new Set((Array.isArray(body.ids) ? body.ids : []).map(String));
        const inArchivio = new Set();
        // I terminati con la fine trasporto prima dell'anno da cui comincia il
        // file non sono mancanti: si conservano (storicoConservato.ts).
        const annoInizio = annoInizioPrimarie();
        const conservati = {};
        const daConservare = new Set();
        const daLasciare = new Set();
        for (const a of ARCHIVI_PRIMARIE) {
          if (annoInizio && ARCHIVI_CON_STORICO.includes(a)) {
            const archivio = await recordArchivio(base44, a);
            for (const r of archivio) if (r.id_ordine) inArchivio.add(String(r.id_ordine));
            const c = ordiniDaConservare(archivio, idFile);
            conservati[a] = { ordini: c.ordini.size, righe: c.righe };
            for (const id of c.ordini) daConservare.add(id);
            // I cancellati degli anni prima non servono piu': non sono mancanti.
            for (const id of cancellatiDaLasciare(archivio, annoInizio, idFile)) daLasciare.add(id);
          } else {
            for (const id of await idArchivio(base44, a)) inArchivio.add(id);
          }
        }
        const mancanti = [...inArchivio].filter(id => !idFile.has(id) && !daConservare.has(id) && !daLasciare.has(id));
        if (mancanti.length > 0 && !conferma_forzatura) {
          const error = "Il file contiene meno dati di quelli gia' presenti in archivio";
          return await erroreRegistrato({
            error, righe_file: idFile.size, righe_archivio: inArchivio.size,
            mancanti: mancanti.length, esempi_mancanti: mancanti.slice(0, 10), richiede_conferma: true,
          }, 409, `${error} (${mancanti.length} ordini mancanti su ${inArchivio.size} in archivio)`, inArchivio.size);
        }

        // Ultima fine trasporto del file precedente a quella in archivio: file vecchio?
        fase = 'confronto delle date';
        let avviso_date = null;
        const fineFile = body.ultima_fine_trasporto != null ? dataPrimaria(body.ultima_fine_trasporto) : null;
        if (fineFile) {
          let fineArchivio = null;
          for (const a of ['PrimariaRete', 'PrimariaAci']) {
            const [ultimo] = await base44.asServiceRole.entities[a].list('-trasporto_finito_il', 1, 0, ['trasporto_finito_il']);
            if (ultimo && ultimo.trasporto_finito_il && (!fineArchivio || ultimo.trasporto_finito_il > fineArchivio)) fineArchivio = ultimo.trasporto_finito_il;
          }
          if (fineArchivio && new Date(fineFile).getTime() < new Date(fineArchivio).getTime()) {
            avviso_date = { data_file: fineFile, data_archivio: new Date(fineArchivio).toISOString() };
          }
        }

        fase = 'apertura del registro';
        const aperto = await apriCaricamento(base44, user, tipo_file, nome_file, inArchivio.size);
        if (aperto.bloccato) return Response.json({ error: aperto.bloccato, dati_intatti: true }, { status: 409 });
        return Response.json({ preparato: true, righe_archivio_prima: inArchivio.size, avviso_date, anno_inizio: annoInizio, conservati, dati_intatti: true });
      }

      // Controllo anti-regressione basato sul conteggio delle righe.
      // Per questi report non si confrontano gli identificativi uno a uno: sarebbe
      // necessario rileggere l'intero archivio, cioe' proprio il costo che questo
      // percorso vuole evitare. Il conteggio intercetta comunque il caso concreto
      // da cui proteggersi, ossia un export troncato o parziale.
      fase = 'controllo anti-regressione';
      const logs = await base44.asServiceRole.entities.UploadLog.filter(
        { tipo_file, esito: 'successo' }, '-created_date', 1
      );
      const precedenti = logs.length > 0 ? (logs[0].righe_importate || 0) : 0;

      if (tipo_file === 'dichiarazioni_trattamento' && precedenti > 0 && totale_righe < precedenti && !conferma_forzatura) {
        return Response.json({
          error: "Il file contiene meno dichiarazioni di quelle gia' presenti in archivio",
          righe_file: totale_righe, righe_archivio: precedenti,
          mancanti: precedenti - totale_righe,
          richiede_conferma: true,
          dati_intatti: true,
        }, { status: 409 });
      }

      let avviso_calo = null;
      if (tipo_file === 'ordini_non_dichiarati' && precedenti > 0 && totale_righe < precedenti / 2) {
        avviso_calo = { righe_precedenti: precedenti, righe_attuali: totale_righe };
      }

      fase = 'apertura del registro';
      const aperto = await apriCaricamento(base44, user, tipo_file, nome_file, precedenti);
      if (aperto.bloccato) return Response.json({ error: aperto.bloccato, dati_intatti: true }, { status: 409 });
      fase = "svuotamento dell'archivio precedente";
      await base44.asServiceRole.entities[entita].deleteMany({});
      archivioSvuotato = true;

      return Response.json({ preparato: true, avviso_calo, righe_archivio_prima: precedenti });
    }

    // === SCRITTURA DI UN BLOCCO ===
    if (!Array.isArray(righe) || righe.length === 0) {
      return Response.json({ error: 'Nessuna riga da scrivere in questo blocco', dati_intatti: true }, { status: 400 });
    }

    fase = 'scrittura del blocco ' + ((blocco || 0) + 1);
    // Le colonne del blocco sono le chiavi vere delle righe lette nel browser:
    // la firma del file le accetta normalizzate, cercarle col nome esatto di
    // SHEET_MAP lasciava fuori un'intestazione con uno spazio in coda
    // (fileSignatures.mappaColonne). Una riga puo' non portare le celle vuote,
    // quindi si guardano le intestazioni di tutto il blocco.
    const colonne = mappaColonne(config.columns, [...new Set(righe.flatMap(r => Object.keys(r || {})))]);
    let records = righe.map(r => mappaRiga(r, colonne, primarie));
    if (primarie) {
      // Stesso arricchimento e stessa suddivisione dell'importazione lato server.
      records = enrichRecords(records.filter(r => r.id_ordine), 'PrimariaRete');
      const fuori = records.filter(r => archivioPrimaria(r) !== entita);
      if (fuori.length > 0 || records.length !== righe.length) {
        return Response.json({
          error: `Blocco non coerente con l'archivio ${entita}: ${fuori.length} ordini appartengono a un altro archivio (es. ${fuori.slice(0, 3).map(r => r.id_ordine).join(', ')})`,
          dati_intatti: false,
        }, { status: 400 });
      }
      if (entita === 'Assegnato' || entita === 'AssegnatoAci') records = records.map(recordAssegnato);
    }
    let ultimoErrore = null;

    for (let tentativo = 0; tentativo < 2; tentativo++) {
      try {
        await base44.asServiceRole.entities[entita].bulkCreate(records);
        return Response.json({ blocco, scritte: records.length, fallite: 0 });
      } catch (e) {
        ultimoErrore = e && e.message ? e.message : String(e);
        // Un errore di rete o di attesa non si ritenta qui: ritentarlo costerebbe
        // altri venti secondi e farebbe terminare l'invocazione dalla piattaforma
        // prima che possa rispondere. Se ne occupa il browser, che non ha limiti.
        if (eInterruzione(e)) break;
        if (Date.now() - t0 > LIMITE_INVOCAZIONE_MS) break;
        await sleep(1000);
      }
    }

    // Il blocco non e' passato, ma la risposta resta un successo HTTP: il browser
    // deve poter decidere se ritentare, non ricevere un'eccezione che interrompe
    // l'intera importazione.
    return Response.json({
      blocco, scritte: 0, fallite: records.length,
      ritentabile: true, ultimo_errore: ultimoErrore,
    });

  } catch (error) {
    return Response.json({
      error: error && error.message ? error.message : String(error),
      fase,
      dati_intatti: !archivioSvuotato,
      ritentabile: eInterruzione(error),
    }, { status: 500 });
  }
}
