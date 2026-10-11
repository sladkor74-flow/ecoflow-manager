// Il registro dei caricamenti: una regola sola per dire com'e' un archivio.
//
// Specchio: src/lib/registroCaricamenti.js (le pagine non importano da
// base44/shared), controllato da prove/specchi.mjs e da prove/statoArchivi.mjs.
//
// UNA REGOLA, NON DUE (chiusura dell'audit, 11/10/2026). C'erano due funzioni
// esportate che si chiamavano statoCaricamenti, con regole diverse. Quella dei
// motori (reportSettimanali.ts: alert, verifiche, quadrature, predittivita',
// qualifica) considera inaffidabile anche una riscrittura finita «parziale» o in
// «errore»; quella della dashboard (cruscotto.ts) conosceva solo «successo» e
// «in_corso». Dopo una riscrittura parziale delle primarie i motori rinviavano
// con «il caricamento va ripetuto», anche il programma del mercoledi', mentre la
// dashboard taceva e dava i dati per freschi. Ora la regola sta qui, e la usano
// i motori (statoCaricamenti, in reportSettimanali.ts), la dashboard
// (cruscotto.ts), i conti che si salvano (il rinvio di statoArchivi.ts) e
// l'avviso delle pagine (src/components/shared/AvvisoCaricamenti.jsx).
import { giornoRoma } from "./giornoItaliano.ts";

// I tipi di file che riscrivono gli archivi letti dalle verifiche.
export const TIPI_CARICAMENTO_MOVIMENTI = ['primarie', 'primarie_rete', 'primarie_aci', 'secondarie', 'extra_raccolta'];

// Gli archivi che ciascun tipo di caricamento riscrive. "primarie" riscrive
// insieme le primarie di rete e quelle ACI, che un tempo si caricavano ciascuna
// col suo tipo: un "primarie_rete" rimasto aperto a marzo non dice piu' niente
// se dopo le primarie sono state ricaricate per intero. Senza questa tabella quel
// caricamento storico, che nessuna scheda di Caricamento Dati puo' piu' chiudere,
// bloccava per sempre ogni riconfronto.
const ARCHIVI_DEL_TIPO = {
  primarie: ['PrimariaRete', 'PrimariaAci'],
  primarie_rete: ['PrimariaRete'],
  primarie_aci: ['PrimariaAci'],
  secondarie: ['Secondaria'],
  extra_raccolta: ['ExtraRaccolta'],
};
const archiviDelTipo = (tipo) => ARCHIVI_DEL_TIPO[tipo] || [tipo];

// Oltre questo tempo un caricamento ancora aperto si e' interrotto: la stessa
// soglia di importaBlocco e di Caricamento Dati.
export const FINESTRA_IN_CORSO_MS = 10 * 60 * 1000;

// Quante righe del registro si guardano per tipo: bastano a scavalcare qualche
// rifiuto a dati intatti arrivato dopo un caricamento fallito.
export const RIGHE_REGISTRO = 10;

// Tutti i tipi con una lettura sola: una per tipo, due volte per funzione, dopo
// un caricamento facevano una cinquantina di richieste solo per il registro
// (limite di richieste al minuto, 22/09/2026).
const MASSIMO_INSIEME = 200;

// created_date arriva in UTC senza la Z finale: si rimette, poi si prende il giorno italiano.
const conZ = (v) => String(v).replace(/(Z|[+-]\d{2}:?\d{2})?$/, 'Z');
const giornoCaricamento = (v) => (v ? giornoRoma(conZ(v)) : '');
const istanteCaricamento = (v) => { const t = v ? new Date(conZ(v)).getTime() : NaN; return isNaN(t) ? 0 : t; };
const istanteIso = (v) => (istanteCaricamento(v) ? new Date(istanteCaricamento(v)).toISOString() : '');

// Una riga del registro che ha riscritto l'archivio: nata "in_corso" subito prima
// di svuotarlo. La riconosce la modalita' "sostituzione" (importaBlocco la scrive
// sempre, importEcotyreFile alla fine) oppure la fase, successiva allo
// svuotamento, in cui importEcotyreFile si e' fermato; "Caricamento interrotto"
// e' una riga rimasta aperta e chiusa dal caricamento dopo. I rifiuti di
// "prepara" e dei controlli anti-regressione non hanno ne' l'una ne' l'altra:
// l'archivio e' intatto e non bloccano niente.
const FASE_DOPO_SVUOTAMENTO = /\(fase: (?:scrittura dei record|allineamento delle dichiarazioni mensili)\)|^Caricamento interrotto:/;
//
// L'anagrafica dei PDR fa eccezione per le righe vecchie (revisione della
// chiusura, 11/10/2026). Fino a quel giorno importPdrFile non scriveva la
// modalita', e un suo «parziale» nasce solo dopo lo svuotamento (la pagina
// chiede sempre la sostituzione): era una riscrittura a meta', e la regola la
// prendeva per un caricamento riuscito. L'anagrafica con cento PDR in meno
// risultava «caricata oggi» e la dashboard taceva. Da quel giorno la modalita'
// c'e'; le righe gia' scritte si riconoscono cosi'.
const pdrParzialeDiPrima = (r) => r.tipo_file === 'pdr' && r.esito === 'parziale' && !r.modalita;
const eraRiscrittura = (r) => r.modalita === 'sostituzione' || pdrParzialeDiPrima(r) || FASE_DOPO_SVUOTAMENTO.test(String(r.messaggio || ''));

// Una riga che lascia l'archivio inaffidabile: aperta, oppure una riscrittura
// finita in errore (archivio vuoto o a meta') o parziale (righe non scritte,
// archivio "non allineato").
const bloccante = (r) => r.esito === 'in_corso' || ((r.esito === 'errore' || r.esito === 'parziale') && eraRiscrittura(r));
const riuscito = (r) => !bloccante(r) && r.esito !== 'errore';

// Si leggono anche i tipi che riscrivono gli stessi archivi di quelli chiesti:
// servono a capire se un caricamento rimasto aperto e' stato superato.
function tipiDaLeggere(tipi) {
  const archivi = new Set(tipi.flatMap(archiviDelTipo));
  return [...new Set([...tipi, ...Object.keys(ARCHIVI_DEL_TIPO).filter(t => archiviDelTipo(t).some(a => archivi.has(a)))])];
}

/**
 * Le righe del registro che servono a statoDelRegistro, per tipo e dalla piu'
 * recente. Log e' l'archivio UploadLog: quello del servizio nelle funzioni,
 * quello dell'utente nelle pagine (il registro lo legge chiunque).
 *
 * Tutti i tipi con una lettura sola. Se la lettura unica e' piena e a un tipo
 * non ha dato le sue RIGHE_REGISTRO righe, per quel tipo si rilegge: il
 * risultato e' lo stesso di una lettura per tipo.
 */
export async function leggiRegistro(Log, tipi = TIPI_CARICAMENTO_MOVIMENTI) {
  const daLeggere = tipiDaLeggere(tipi);
  const insieme = (await Log.filter({ tipo_file: { $in: daLeggere } }, '-created_date', MASSIMO_INSIEME)) || [];
  const perTipo = new Map(daLeggere.map(t => [t, []]));
  for (const r of insieme) {
    const l = perTipo.get(r.tipo_file);
    if (l && l.length < RIGHE_REGISTRO) l.push(r);
  }
  await Promise.all(daLeggere.map(async (tipo) => {
    if (insieme.length >= MASSIMO_INSIEME && perTipo.get(tipo).length < RIGHE_REGISTRO) {
      perTipo.set(tipo, (await Log.filter({ tipo_file: tipo }, '-created_date', RIGHE_REGISTRO)) || []);
    }
  }));
  return perTipo;
}

// Righe sparse del registro (anche di altri tipi, in qualunque ordine) divise per
// tipo come le legge leggiRegistro: dalla piu' recente, RIGHE_REGISTRO per tipo.
function perTipoDa(righe, daLeggere) {
  const perTipo = new Map(daLeggere.map(t => [t, []]));
  const ordinate = (righe || []).map((r, i) => ({ r, i, t: istanteCaricamento(r && r.created_date) }))
    .sort((a, b) => b.t - a.t || a.i - b.i);
  for (const { r } of ordinate) {
    const l = r && perTipo.get(r.tipo_file);
    if (l && l.length < RIGHE_REGISTRO) l.push(r);
  }
  return perTipo;
}

/**
 * Lo stato dei caricamenti di ogni tipo: l'ultimo riuscito, che spiega un
 * gestionale non ancora aggiornato, e quello che ha lasciato l'archivio
 * inaffidabile, se dopo di lui non ne e' riuscito un altro: ancora "in_corso",
 * oppure una riscrittura finita in errore o parziale. Un archivio che si sta
 * riscrivendo, o che un caricamento interrotto o fallito ha lasciato vuoto o a
 * meta', non e' una base su cui rifare un confronto: l'esito verrebbe calcolato
 * su un archivio a meta' (regola 2).
 *
 * Fra le righe del registro si scavalcano i rifiuti a dati intatti: un file
 * sbagliato caricato dopo un caricamento fallito non rende buono l'archivio.
 *
 * Un caricamento aperto o fallito non conta piu' quando dopo di lui un
 * caricamento riuscito ha riscritto tutti i suoi archivi: un registro vecchio e
 * superato non ferma niente. Uno aperto da oltre dieci minuti e' interrotto, uno
 * fallito e' "errore": bloccano lo stesso, perche' l'archivio puo' essere a
 * meta', e chi li mostra dice che il caricamento va ripetuto.
 *
 * Di ogni caricamento si tiene l'id: confrontando due letture si capisce se
 * nel frattempo ne e' finito un altro (caricamentiDuranteLettura).
 *
 * righe: quello che restituisce leggiRegistro, oppure righe sparse del
 * registro (la dashboard le passa cosi'). adesso: l'istante in millisecondi.
 * Risponde { ultimi: { tipo: scheda }, in_corso: [scheda] }.
 */
export function statoDelRegistro(righe, tipi = TIPI_CARICAMENTO_MOVIMENTI, adesso = Date.now()) {
  const daLeggere = tipiDaLeggere(tipi);
  const perTipo = righe instanceof Map ? righe : perTipoDa(righe, daLeggere);
  // Dalla piu' recente: il primo riuscito chiude la ricerca, il primo bloccante
  // prima di lui e' il caricamento che ha lasciato l'archivio inaffidabile.
  const letti = daLeggere.map((tipo) => {
    const del_tipo = perTipo.get(tipo) || [];
    let aperto = null;
    for (const r of del_tipo) {
      if (riuscito(r)) break;
      if (bloccante(r)) { aperto = r; break; }
    }
    return { tipo, buono: del_tipo.find(riuscito) || null, aperto };
  });
  const riscritto = (archivio, dopo) => letti.some(({ tipo, buono }) => buono
    && istanteCaricamento(buono.created_date) > dopo && archiviDelTipo(tipo).includes(archivio));
  // creato_il e' l'istante, con la Z. concluso_il e' l'ultima scrittura della
  // riga, cioe' la fine del caricamento: un esito salvato vale per l'archivio
  // riscritto solo se e' successivo a questa, perche' uno calcolato mentre il
  // caricamento scriveva e' successivo al suo inizio ma non alla sua fine.
  const scheda = (r, tipo) => ({
    id: r.id || null,
    tipo_file: tipo,
    data: giornoCaricamento(r.created_date),
    creato_il: istanteIso(r.created_date),
    concluso_il: istanteIso(r.updated_date) || istanteIso(r.created_date),
    nome_file: String(r.nome_file || '').trim(),
    utente: r.utente || '',
    // Quanto c'era in archivio quando quel caricamento e' partito: per le
    // primarie sono ORDINI distinti, per gli altri tipi sono le RIGHE
    // dell'ultimo caricamento riuscito (il nome del campo dice "righe" per tutti
    // e due, ed e' la ragione per cui questo commento esiste). Chi ne avvia un
    // altro lo confronta con quello che trova adesso: se e' di meno, il
    // caricamento di prima ha gia' svuotato qualche archivio e il controllo
    // anti-regressione non ha piu' con che cosa accorgersi di un file monco.
    righe_archivio_prima: typeof r.righe_archivio_prima === 'number' ? r.righe_archivio_prima : null,
    // Una riga ancora "in_corso" che pero' dichiara di non essere riuscita: il
    // caricamento e' finito senza scrivere niente e nessuno sta piu' scrivendo.
    // Serve a distinguerla da un collega al lavoro in questo momento.
    non_riuscito: String(r.messaggio || '').startsWith('Caricamento non riuscito'),
  });

  const ultimi = {};
  const inCorso = [];
  for (const { tipo, buono, aperto } of letti) {
    if (!tipi.includes(tipo)) continue;
    if (buono) ultimi[tipo] = scheda(buono, tipo);
    if (!aperto) continue;
    const inizio = istanteCaricamento(aperto.created_date);
    if (archiviDelTipo(tipo).every(a => riscritto(a, inizio))) continue;
    // Una riscrittura finita in errore o parziale e' un caricamento non
    // riuscito: per chi la mostra vale come interrotta, e va ripetuta.
    const fallito = aperto.esito !== 'in_corso';
    inCorso.push({
      ...scheda(aperto, tipo),
      interrotto: fallito || adesso - inizio > FINESTRA_IN_CORSO_MS,
      ...(fallito ? { esito: 'errore' } : {}),
    });
  }
  inCorso.sort((a, b) => a.tipo_file.localeCompare(b.tipo_file));
  return { ultimi, in_corso: inCorso };
}

// I nomi degli archivi come si leggono a video: «Mai caricato:
// ordini_non_dichiarati» non lo scrive chi lavora.
export const NOMI_ARCHIVI = {
  primarie: 'Primarie e assegnati',
  primarie_rete: 'Primarie di rete',
  primarie_aci: 'Primarie ACI',
  secondarie: 'Secondarie',
  terziarie: 'Terziarie',
  extra_raccolta: 'Extra raccolta',
  ordini_non_dichiarati: 'Ordini non dichiarati',
  dichiarazioni_trattamento: 'Dichiarazioni di trattamento',
  pdr: 'Punti di raccolta',
  assegnati: 'Assegnati',
  gommisti: 'Gommisti',
};
export const nomeArchivio = (tipo) => NOMI_ARCHIVI[tipo] || String(tipo || '').replace(/_/g, ' ');

// Gli archivi che leggono le giacenze e le dichiarazioni degli impianti: i
// movimenti, la fotografia del portale e il report delle dichiarazioni.
export const TIPI_GIACENZE = ['primarie', 'primarie_rete', 'primarie_aci', 'secondarie', 'terziarie', 'ordini_non_dichiarati', 'dichiarazioni_trattamento'];

// GLI ARCHIVI CHE LEGGE OGNI CONTO (chiusura dell'audit, 11/10/2026). Il rinvio
// dei conti che si salvano usava gli stessi tipi per tutti: la fatturazione
// attiva si fermava su un caricamento delle secondarie o delle terziarie, che
// non legge, e il congelamento della passiva sulle terziarie. Un caricamento
// interrotto di un file che non c'entra bloccava la fatturazione del mese
// finche' non lo si ricaricava, su numeri che sarebbero stati identici. Ora ogni
// conto guarda solo i suoi archivi, come i motori (CARICAMENTI_DEL_MODULO in
// runAlertEngine), e l'avviso sopra i totali di una pagina dice lo stesso.
//
// Le primarie sono tre tipi: «primarie» riscrive rete e ACI insieme,
// «primarie_rete» e «primarie_aci» sono i caricamenti di una volta, sugli stessi
// archivi. L'extra raccolta non c'e': le schede si scrivono una per una dal suo
// modulo e la riga del registro nasce gia' riuscita, quindi non lascia mai un
// archivio a meta'.
export const TIPI_PRIMARIE = ['primarie', 'primarie_rete', 'primarie_aci'];
// La fatturazione attiva legge le primarie (e l'extra raccolta, le tariffe, i fornitori).
export const TIPI_ATTIVA = TIPI_PRIMARIE;
// La passiva, il suo congelamento e il margine leggono anche le secondarie.
export const TIPI_PASSIVA = [...TIPI_PRIMARIE, 'secondarie'];
// La prefattura confronta le primarie e cerca nelle terziarie un ordine che il mese non ha.
export const TIPI_PREFATTURA = [...TIPI_PRIMARIE, 'terziarie'];
// La chiusura dell'anno legge tutti i movimenti: piazzali e impianti al 31/12.
export const TIPI_CHIUSURA = [...TIPI_PRIMARIE, 'secondarie', 'terziarie'];

// IL SOLO CANALE DELL'EXTRA RACCOLTA NON LEGGE I CARICAMENTI DA FILE (revisione
// finale, 11/10/2026). Il suo conto, in passiva e in attiva, usa solo le schede
// del suo modulo: congelare o elaborare l'extra raccolta non si rinvia per
// primarie o secondarie a meta', e l'avviso della sua passiva non lo dice.
// Con piu' canali, o senza canale (tutti), i tipi restano quelli del conto.
export function tipiDeiCanali(tipi, canali) {
  const scelti = (canali || []).map(c => String(c || '').trim().toUpperCase()).filter(Boolean);
  return scelti.length && scelti.every(c => c === 'EXTRA_RACCOLTA') ? [] : tipi;
}

const ORA_ROMA = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
const ilGiorno = (g) => String(g || '').split('-').reverse().join('/');

/**
 * Come si dice a video un caricamento che rende l'archivio inaffidabile (una
 * voce di in_corso di statoDelRegistro). Lo stesso testo nella dashboard e
 * sopra i totali delle pagine: { stato, gravita, titolo, dettaglio }.
 * - non_riuscito: una riscrittura finita parziale o in errore, oppure una riga
 *   che dichiara di non essere riuscita. L'archivio e' a meta' finche' non si
 *   ricarica il file.
 * - interrotto: aperto da oltre dieci minuti e mai concluso.
 * - in_corso: qualcuno sta caricando adesso.
 */
export function avvisoCaricamento(a) {
  const nome = nomeArchivio(a.tipo_file);
  const chi = [a.utente ? `da ${a.utente}` : '', a.nome_file ? `(${a.nome_file})` : ''].filter(Boolean).join(' ');
  const quando = a.data ? ` il ${ilGiorno(a.data)}` : '';
  if (a.esito === 'errore' || a.non_riuscito) {
    return {
      stato: 'non_riuscito', gravita: 'critico',
      titolo: `Caricamento non riuscito: ricarica il file (${nome})`,
      dettaglio: `Il caricamento${a.data ? ` del ${ilGiorno(a.data)}` : ''}${chi ? ` ${chi}` : ''} ha riscritto l'archivio e non è finito bene: l'archivio può essere vuoto o a metà. `
        + 'Finché non si ricarica il file i numeri che lo leggono non sono affidabili, e verifiche, alert e conti da salvare si rinviano.',
    };
  }
  if (a.interrotto) {
    return {
      stato: 'interrotto', gravita: 'critico',
      titolo: `Caricamento interrotto: ${nome}`,
      dettaglio: `Avviato${quando}${chi ? ` ${chi}` : ''} e mai concluso: l'archivio può essere vuoto o incompleto. Ricarica il file.`,
    };
  }
  const ora = a.creato_il ? ` alle ${ORA_ROMA.format(new Date(a.creato_il))}` : '';
  return {
    stato: 'in_corso', gravita: 'info',
    titolo: `Archivio in caricamento: ${nome}`,
    dettaglio: `Avviato${quando}${ora}${chi ? ` ${chi}` : ''}: finché non finisce, i numeri che leggono questo archivio possono essere a metà. Si ricalcola a caricamento concluso.`,
  };
}
