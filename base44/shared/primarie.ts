import { eAci } from "./canaleSecondaria.ts";
import { giornoPortale, oraPortale, scrittaPortale } from "./giornoItaliano.ts";
// Il file unico delle primarie si divide in quattro archivi secondo stato e classe:
// ordini assegnati o no, classe ACI (PFU Autodemolizione) o rete. La regola e' una
// sola per l'importazione lato server e per quella a blocchi letta nel browser.

// === SOLO QUELLO CHE E' NOSTRO ===
//
// Regola dell'utente, 02/10/2026: «usa solo cio' che ha come partner operativo
// Smoco». Non e' un dettaglio di questa analisi: gli export del portale sono di
// Ecotyre, non nostri, e dentro ci sono anche gli ordini degli altri operatori.
// Nei due file esportati quel giorno: 2.925 righe di dichiarazioni e 151 ordini
// non dichiarati (604 tonnellate) di Baucina, Corgom, Chiarcosso, Trieco e
// Cumiana. Caricati senza filtro finivano nei NOSTRI archivi.
//
// Il 02/10/2026 non facevano danno ai conti del 2026 - le 1.206 tonnellate di
// Baucina su Irigom hanno tutte fine trasporto negli anni prima, e i non
// dichiarati altrui vanno su Corgom, che non e' un nostro impianto - ma e'
// questione di tempo: basta un totale che non filtri l'anno, o un impianto in
// comune, e quei chili diventano nostri.
//
// Si scarta solo chi ha un partner operativo scritto e DIVERSO dal nostro: una
// riga senza quel campo non si butta, perche' non tutti gli export ce l'hanno e
// buttarla vorrebbe dire perdere dati veri.
export const NOSTRO_PARTNER = /smoco/i;

/**
 * Le righe del nostro partner operativo: { righe, scartate }.
 * scartate sono quelle di un altro operatore, da dire a chi carica.
 */
export function soloNostroPartner(righe) {
  const altrui = (r) => {
    const p = String((r && r.partner_operativo) || '').trim();
    return !!p && !NOSTRO_PARTNER.test(p);
  };
  const nostre = (righe || []).filter(r => !altrui(r));
  return { righe: nostre, scartate: (righe || []).length - nostre.length };
}

export const ARCHIVI_PRIMARIE = ['PrimariaRete', 'PrimariaAci', 'Assegnato', 'AssegnatoAci'];

// Colonne del file che portano una data: immissione, inizio e fine trasporto
// sono obbligatorie (la fine trasporto e' quella su cui si ragiona), la chiusura
// a portale le accompagna.
export const DATE_PRIMARIE = new Set(['ordine_immesso_il', 'trasporto_iniziato_il', 'trasporto_finito_il', 'ordine_chiuso_il']);

// === LO SCRITTORE UNICO DELLE DATE DEI FILE DEL PORTALE (difetto 9, 16/10/2026) ===
//
// Il portale scrive l'ora ITALIANA, e il gestionale la salva com'e' scritta, con
// la Z per convenzione: «31/12/2026 23:30» diventa '2026-12-31T23:30:00.000Z',
// che sono le 23:30 italiane e non le 23:30 UTC. Non e' un istante e non si
// converte mai: ne' qui, ne' quando si legge (giornoPortale e le sue sorelle in
// giornoItaliano.ts). Primarie, secondarie, terziarie, il report delle
// dichiarazioni e gli ordini non dichiarati passano tutti da dataDelPortale, e
// la stessa cella da' la stessa stringa sul server, che gira in UTC, e nel
// browser, che gira in Italia.
//
// I campi con l'ora: si salva l'ora scritta, al secondo.
export const ORE_PORTALE = new Set(['ordine_immesso_il', 'ordine_chiuso_il', 'data_immissione', 'data_chiusura', 'data_dichiarazione', 'data_esecuzione']);
// I campi di solo giorno: inizio e fine del trasporto. Si salvano SEMPRE a
// mezzanotte Z del giorno scritto. Se un giorno il portale scrivesse anche
// l'ora della fine, si tiene il giorno - regola della direzione del 19/09/2026,
// «conta il giorno, non l'ora» - e lo si conta (giorni_con_ora nella risposta
// del caricamento): cosi' giornoRoma, che legge la fine in Giacenze, nelle
// Dichiarazioni, nelle tariffe e nelle chiusure, da' il giorno giusto per
// costruzione.
export const GIORNI_PORTALE = new Set(['trasporto_iniziato_il', 'trasporto_finito_il', 'inizio_trasporto', 'fine_trasporto']);

/**
 * La data di un ritiro, da qualunque forma esca l'export del portale, come
 * 'AAAA-MM-GGThh:mm:ss.000Z' con l'ora scritta nel file; null se non e' una data.
 *
 * Una colonna esportata come testo ("13/09/2026") o come numero generico
 * (seriale 46278,54) arrivava come stringa e finiva in archivio cosi' com'era:
 * bastava un export fatto in modo diverso perche' tutte e tre le date
 * obbligatorie risultassero mancanti su ogni riga del caricamento. Una data che
 * resta illeggibile torna null: e' un avviso visibile, non una data inventata.
 * Tutto si arrotonda al secondo: il portale registra al secondo, i millesimi
 * sono solo il resto del calcolo (dal 16/10/2026 non si scrivono piu' i .999
 * che lasciava il Date costruito dalla libreria dei fogli).
 */
export function dataPrimaria(val) {
  if (val === undefined || val === null || val === '') return null;
  // Un Date l'ha costruito la libreria dei fogli leggendo con cellDates, nel fuso
  // del processo: le sue cifre LOCALI sono l'ora scritta nella cella, in UTC
  // come in Italia. I due caricamenti leggono il foglio con cellDates false e
  // qui un Date non arriva piu'; il ramo resta per chi legge ancora un foglio
  // con cellDates (prove/ecotynaModuliGiusti.mjs), dove senza ramo la data
  // diventerebbe mancante in silenzio. Il suo limite: in un processo in Italia
  // un Date delle 02:00-02:59 dell'ultima domenica di marzo e' gia' spostato di
  // un'ora dalla libreria quando arriva qui, e i getter non possono
  // recuperarlo. Il portale quell'ora non la scrive, perche' in Italia non esiste.
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const t = Date.UTC(val.getFullYear(), val.getMonth(), val.getDate(), val.getHours(), val.getMinutes(), val.getSeconds(), val.getMilliseconds());
    return new Date(Math.round(t / 1000) * 1000).toISOString();
  }
  const s = String(val).trim();
  if (s === '') return null;
  // Seriale Excel, numero o testo: e' un orario da calendario, senza fuso.
  const n = typeof val === 'number' ? val : Number(s.replace(',', '.'));
  if (!isNaN(n) && n > 20000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86400) * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  // Testo italiano gg/mm/aaaa, con o senza orario: e' l'export "come si vede a
  // video". Mese e giorno fuori scala non si raddrizzano da soli (13/09 letto
  // all'americana farebbe gennaio dell'anno dopo): meglio nessuna data.
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, gg, mm, aaaa, ora = 0, min = 0, sec = 0] = m;
    if (Number(mm) < 1 || Number(mm) > 12 || Number(gg) < 1 || Number(gg) > 31) return null;
    const d = new Date(Date.UTC(Number(aaaa), Number(mm) - 1, Number(gg), Number(ora), Number(min), Number(sec)));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  // Testo ISO: con la Z, con +00:00 o senza fuso valgono le cifre scritte, con i
  // decimali dei secondi di qualunque lunghezza; con un altro fuso e' un istante
  // vero e si porta all'ora italiana. Prima passava da new Date(s), che leggeva
  // un testo senza fuso nell'ora del processo: sul server e nel browser la
  // stessa cella dava due stringhe diverse. Ogni altro testo: nessuna data.
  return scrittaPortale(s) || null;
}

/**
 * Il giorno scritto di una data di solo giorno (inizio e fine del trasporto):
 * 'AAAA-MM-GGT00:00:00.000Z', oppure null. Se la cella portava anche un'ora la
 * si lascia e, con conta, la si conta in conta.giorni_con_ora.
 */
export function giornoPrimaria(val, conta = null) {
  const d = dataPrimaria(val);
  if (!d) return null;
  if (conta && oraPortale(d)) conta.giorni_con_ora = (conta.giorni_con_ora || 0) + 1;
  return giornoPortale(d) + 'T00:00:00.000Z';
}

/**
 * La data di una cella del portale per il suo campo: i campi di solo giorno a
 * mezzanotte Z (giornoPrimaria), quelli con l'ora con l'ora scritta (dataPrimaria).
 * conta, facoltativo, raccoglie quante celle di solo giorno avevano un'ora.
 */
export function dataDelPortale(val, campo, conta = null) {
  return GIORNI_PORTALE.has(campo) ? giornoPrimaria(val, conta) : dataPrimaria(val);
}

// Campi conservati negli archivi degli assegnati.
export const CAMPI_ASSEGNATO = [
  'id_ordine', 'stato', 'ordine_immesso_il', 'id_cliente', 'ragione_sociale',
  'id_pdr', 'punto_di_raccolta', 'indirizzo', 'cap', 'comune', 'provincia',
  'codice_regione', 'macroarea', 'codice_prodotto', 'prodotto', 'classe',
  'cer', 'tipo_contenitori', 'quantita_richiesta', 'quantita_ritirata',
  // Il ticket serve mentre l'ordine e' ancora assegnato: sull'ACI e' li' che si
  // legge il peso stimato su cui misurare la soglia del 10% quando si chiude il
  // formulario.
  'numero_ordine_interno',
  'peso_stimato', 'peso_effettivo', 'key_account', 'partner_operativo',
  'id_partner_operativo', 'id_trasportatore', 'trasportatore', 'regioni', 'mese', 'anno', 'sigla', 'regione'
];

/** Archivio di destinazione di un record gia' mappato e arricchito (con la classe). */
export function archivioPrimaria(record) {
  // Il canale si decide con la regola di tutto il gestionale (canaleSecondaria.ts),
  // non con una copia: questa guardava solo classe e prodotto, cercava "aci" anche
  // dentro altre parole e ignorava il codice prodotto ".class9". Un ordine
  // smistato qui in un archivio e letto altrove nell'altro canale non quadra piu'
  // da nessuna parte. Verificato il 20/09/2026 su 11.249 record: stesso esito.
  const aci = eAci(record);
  const assegnato = String(record.stato || '').toLowerCase().trim() === 'assegnato';
  if (assegnato) return aci ? 'AssegnatoAci' : 'Assegnato';
  return aci ? 'PrimariaAci' : 'PrimariaRete';
}

/** Record ridotto ai campi degli assegnati. */
export function recordAssegnato(record) {
  const o = {};
  for (const f of CAMPI_ASSEGNATO) o[f] = record[f] ?? null;
  return o;
}
