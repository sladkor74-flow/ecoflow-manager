// Verifica dei report settimanali inviati da impianti e stoccaggi.
//
// Ogni settimana un impianto o uno stoccaggio invia l'elenco dei carichi ricevuti
// e spediti. Qui l'elenco viene confrontato riga per riga con il gestionale:
// gli ingressi con le primarie, rete, ACI ed extra raccolta, e con le secondarie
// che arrivano al sito; le uscite con le secondarie, dal portale o inserite in
// Extra Raccolta, che ne partono.
//
// Il confronto e' deterministico. L'agente interviene solo per capire come e'
// fatto il file che arriva, cioe' quale colonna contiene il formulario, il peso,
// le date. I valori vengono poi letti e confrontati dal codice: se fosse il
// modello a trascrivere i formulari potrebbe introdurre proprio gli errori di una
// lettera che la verifica deve scovare.
//
// La data di verifica di un formulario e' sempre quella di fine trasporto, e il
// perimetro di una settimana si stabilisce su quella, lunedi'-
// domenica secondo la numerazione ISO, la stessa del gestionale e del foglio
// Excel di SMOCO. La prima e l'ultima settimana si fermano ai confini dell'anno:
// nel 2026 la settimana 1 va dall'1 al 4 gennaio. Per abbinare le
// righe si guarda pero' una finestra piu' ampia, cosi' un ingresso registrato con
// una data sbagliata viene trovato e segnalato invece di risultare inesistente.

import { fetchAll } from "./fetchAll.ts";
import { formatoKg } from "./formato.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { eAci } from "./canaleSecondaria.ts";
import { unisciQuote, ticketDi } from "./formulari.ts";
import { giornoRoma } from "./giornoItaliano.ts";
import { giornoMovimento, eTerminato, dateMancanti, dateIncoerenti, dateDaSistemare, testoDate, ordiniDaSistemare, mancantiOrdine, incoerentiOrdine, testoOrdine } from "./movimenti.ts";

export const GIORNI_CONSERVAZIONE = 40;

// === date obbligatorie ===
//
// Immissione, inizio e fine trasporto sono obbligatorie nei formulari (regola
// dell'utente del 22/09/2026, "questo vale sempre dove ci sono ordini
// terminati"): la regola sta in movimenti.ts (dateMancanti, dateIncoerenti,
// testoDate). Qui c'e' solo come si elencano, uguale per le verifiche, la
// quadratura FIR, gli alert, le rotte ed EcoTyna, che leggono tutti questo file.

/**
 * Un ordine terminato con le date da sistemare, pronto da mostrare:
 * { id_ordine, numero_fir, mancanti, incoerenti, date, senza_fine, giorno }.
 * null se le date ci sono tutte e tornano. Un terminato senza fine trasporto non
 * ha giorno: resta fuori dai periodi (giornoElenco), ma si dice lo stesso.
 */
export function voceDate(r) {
  if (!eTerminato(r) || !dateDaSistemare(r)) return null;
  const mancanti = dateMancanti(r);
  return {
    id_ordine: String(r.id_ordine || '').trim(),
    numero_fir: String(r.numero_fir || '').trim(),
    mancanti,
    incoerenti: dateIncoerenti(r),
    date: testoDate(r),
    senza_fine: mancanti.includes('fine trasporto'),
    giorno: giornoMovimento(r) || '',
  };
}

/**
 * Un ORDINE terminato con le date da sistemare, dalle sue righe
 * (ordiniDaSistemare di movimenti.ts): come voceDate, ma su tutte le righe
 * dell'ordine - le date che mancano a una qualunque di esse - piu' quante righe
 * sono.
 */
function voceOrdineDate(o) {
  const r = o.righe[0];
  const mancanti = mancantiOrdine(o);
  const senzaFine = mancanti.includes('fine trasporto');
  return {
    id_ordine: String(r.id_ordine || '').trim(),
    numero_fir: String(r.numero_fir || '').trim(),
    mancanti,
    incoerenti: incoerentiOrdine(o),
    date: testoOrdine(o),
    senza_fine: senzaFine,
    giorno: senzaFine ? '' : giornoMovimento(r),
    righe: o.righe.length,
  };
}

/**
 * Gli ordini terminati di un elenco con le date da sistemare, di qualunque
 * anno: quanti ORDINI distinti (mai righe: lo stesso ordine sta in archivio con
 * piu' righe), quanti senza fine trasporto (quelli che nessun periodo conta) e i
 * primi, con ID ordine, formulario e date che mancano. Chi chiama passa le righe
 * di un modulo e di un canale solo: rete, ACI ed extra raccolta non si contano
 * insieme nemmeno qui. null se non ce ne sono.
 *
 * Si chiamava riepilogoDate come quella di raccoltoCalculator.ts, che pero'
 * restituisce un'altra forma ({ totale, senza_fine_trasporto, testo, esempi }):
 * chi le mostra ne legge una sola, e con l'altra spariva in silenzio.
 */
export function riepilogoVociDate(righe, quanti = 10) {
  const voci = ordiniDaSistemare(righe).map(voceOrdineDate)
    .sort((a, b) => Number(b.senza_fine) - Number(a.senza_fine) || a.id_ordine.localeCompare(b.id_ordine) || a.numero_fir.localeCompare(b.numero_fir));
  if (!voci.length) return null;
  return {
    ordini: voci.length,
    senza_fine: voci.filter(v => v.senza_fine).length,
    esempi: voci.slice(0, quanti),
  };
}

/** "ET26091175 (FIR RGYTR022620TW): manca la data di fine trasporto" */
export const descriviVoceDate = (v) => `${v.id_ordine || 'ordine senza ID'}${v.numero_fir ? ` (FIR ${v.numero_fir})` : ' (senza formulario)'}: ${v.date}`;
const FINESTRA_ABBINAMENTO_GIORNI = 21;

// === date ===

export function oggiRoma() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}

function utc(ymd) {
  return new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)));
}

export function aggiungiGiorni(ymd, giorni) {
  const d = utc(ymd);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

export function giorniTra(da, a) {
  return Math.round((utc(a).getTime() - utc(da).getTime()) / 86400000);
}

export function settimanaIso(ymd) {
  const d = utc(ymd);
  const giorno = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - giorno);
  const anno = d.getUTCFullYear();
  const settimana = Math.ceil(((d.getTime() - Date.UTC(anno, 0, 1)) / 86400000 + 1) / 7);
  return { anno, settimana };
}

export function lunediSettimana(anno, settimana) {
  const gen4 = new Date(Date.UTC(anno, 0, 4));
  const giorno = gen4.getUTCDay() || 7;
  gen4.setUTCDate(gen4.getUTCDate() - giorno + 1 + (settimana - 1) * 7);
  return gen4.toISOString().slice(0, 10);
}

// Intervallo di una settimana, limitato all'anno solare.
export function intervalloSettimana(anno, settimana) {
  const lunedi = lunediSettimana(anno, settimana);
  const domenica = aggiungiGiorni(lunedi, 6);
  const primo = anno + '-01-01';
  const ultimo = anno + '-12-31';
  return { inizio: lunedi < primo ? primo : lunedi, fine: domenica > ultimo ? ultimo : domenica };
}

// Il giorno di un movimento del gestionale e' quello italiano (giornoItaliano.ts),
// come in Dichiarazioni, Giacenze e Report Mensile: tagliare la stringa UTC
// mette nel giorno prima un trasporto finito a mezzanotte italiana (22:00Z), e
// la verifica segnalava all'impianto una data di fine trasporto sbagliata che
// sbagliata non era.

// === caricamenti ===

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
const FINESTRA_IN_CORSO_MS = 10 * 60 * 1000;

// Quante righe del registro si guardano per tipo: bastano a scavalcare qualche
// rifiuto a dati intatti arrivato dopo un caricamento fallito.
const RIGHE_REGISTRO = 10;

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
const eraRiscrittura = (r) => r.modalita === 'sostituzione' || FASE_DOPO_SVUOTAMENTO.test(String(r.messaggio || ''));

// Una riga che lascia l'archivio inaffidabile: aperta, oppure una riscrittura
// finita in errore (archivio vuoto o a meta') o parziale (righe non scritte,
// archivio "non allineato").
const bloccante = (r) => r.esito === 'in_corso' || ((r.esito === 'errore' || r.esito === 'parziale') && eraRiscrittura(r));
const riuscito = (r) => !bloccante(r) && r.esito !== 'errore';

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
 */
export async function statoCaricamenti(base44, tipi = TIPI_CARICAMENTO_MOVIMENTI) {
  const Log = base44.asServiceRole.entities.UploadLog;
  // Si leggono anche i tipi che riscrivono gli stessi archivi di quelli chiesti:
  // servono a capire se un caricamento rimasto aperto e' stato superato.
  const archivi = new Set(tipi.flatMap(archiviDelTipo));
  const daLeggere = [...new Set([...tipi, ...Object.keys(ARCHIVI_DEL_TIPO).filter(t => archiviDelTipo(t).some(a => archivi.has(a)))])];
  // Tutti i tipi con una lettura sola: una per tipo, due volte per funzione, dopo
  // un caricamento facevano una cinquantina di richieste solo per il registro
  // (limite di richieste al minuto, 22/09/2026). Se la lettura unica e' piena e a
  // un tipo non ha dato le sue RIGHE_REGISTRO righe, per quel tipo si rilegge come
  // prima: il risultato e' lo stesso.
  const MASSIMO_INSIEME = 200;
  const insieme = (await Log.filter({ tipo_file: { $in: daLeggere } }, '-created_date', MASSIMO_INSIEME)) || [];
  const perTipo = new Map(daLeggere.map(t => [t, []]));
  for (const r of insieme) {
    const l = perTipo.get(r.tipo_file);
    if (l && l.length < RIGHE_REGISTRO) l.push(r);
  }
  const letti = await Promise.all(daLeggere.map(async (tipo) => {
    const righe = insieme.length >= MASSIMO_INSIEME && perTipo.get(tipo).length < RIGHE_REGISTRO
      ? ((await Log.filter({ tipo_file: tipo }, '-created_date', RIGHE_REGISTRO)) || [])
      : perTipo.get(tipo);
    // Dalla piu' recente: il primo riuscito chiude la ricerca, il primo bloccante
    // prima di lui e' il caricamento che ha lasciato l'archivio inaffidabile.
    let aperto = null;
    for (const r of righe) {
      if (riuscito(r)) break;
      if (bloccante(r)) { aperto = r; break; }
    }
    return { tipo, buono: righe.find(riuscito) || null, aperto };
  }));
  const riscritto = (archivio, dopo) => letti.some(({ tipo, buono }) => buono
    && istanteCaricamento(buono.created_date) > dopo && archiviDelTipo(tipo).includes(archivio));
  const adesso = Date.now();
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

/**
 * I caricamenti che rendono inaffidabile una lettura degli archivi fatta fra due
 * letture dello stato: quelli aperti in una delle due, e quelli conclusi nel
 * frattempo (l'ultimo riuscito di un tipo e' cambiato). Lo stato letto prima e
 * gli archivi letti dopo non bastano: un caricamento che parte mentre si leggono
 * gli archivi non si vedrebbe, e gli esiti si riscriverebbero su un archivio a
 * meta'. Vuoto se la lettura e' buona.
 */
export function caricamentiDuranteLettura(prima, dopo) {
  const out = new Map();
  // Prima la lettura di dopo: un caricamento aperto e poi fallito si descrive com'e' finito.
  for (const a of [...(dopo.in_corso || []), ...(prima.in_corso || [])]) if (!out.has(a.tipo_file)) out.set(a.tipo_file, a);
  for (const [tipo, u] of Object.entries(dopo.ultimi || {})) {
    const p = (prima.ultimi || {})[tipo];
    if ((!p || p.id !== u.id) && !out.has(tipo)) out.set(tipo, { ...u, concluso_durante_la_lettura: true });
  }
  return [...out.values()].sort((a, b) => a.tipo_file.localeCompare(b.tipo_file));
}

/** "primarie del 21/09/2026 (Mario Rossi, file.xlsx): risulta interrotto, ..." per i messaggi a video. */
export function descriviCaricamento(a) {
  const chi = [a.utente, a.nome_file].filter(Boolean).join(', ');
  const cosa = `${String(a.tipo_file || '').replace(/_/g, ' ')}${a.data ? ` del ${it(a.data)}` : ''}${chi ? ` (${chi})` : ''}`;
  if (a.concluso_durante_la_lettura) return `${cosa}: si è concluso mentre si leggevano gli archivi`;
  if (a.esito === 'errore') return `${cosa}: non riuscito, l'archivio può essere incompleto e il caricamento va ripetuto`;
  if (a.interrotto) return `${cosa}: risulta interrotto, l'archivio può essere incompleto e il caricamento va ripetuto`;
  return `${cosa}: non ancora concluso`;
}

// Data scritta in un report: seriale Excel, gg/mm/aaaa con o senza ora,
// gg-mm-aa, aaaa-mm-gg.
export function dataDaValore(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) return null;
    return aggiungiGiorni('1899-12-30', Math.floor(v));
  }
  const s = String(v).trim();
  let m = s.match(/^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^([0-9]{1,2})[/.-]([0-9]{1,2})[/.-]([0-9]{2,4})/);
  if (m) {
    const anno = m[3].length === 2 ? '20' + m[3] : m[3];
    const mese = +m[2], giorno = +m[1];
    if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
    return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
  }
  if (/^[0-9]+(\.[0-9]+)?$/.test(s)) return dataDaValore(Number(s));
  return null;
}

// Numero scritto in un report, nei formati italiano e internazionale.
export function numeroDaValore(v, unita) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[^0-9,.-]/g, '');
  if (!s || s === '-' ) return null;
  const virgola = s.includes(','), punto = s.includes('.');
  if (virgola && punto) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (virgola) {
    const parti = s.split(',');
    s = parti.length === 2 && parti[1].length !== 3 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (punto) {
    const parti = s.split('.');
    // "2.860" in un report in chilogrammi e' un separatore delle migliaia.
    if (parti.length > 2 || (parti.length === 2 && parti[1].length === 3 && unita !== 't')) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return isFinite(n) ? n : null;
}

// === formulari ===

export function normalizzaFir(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Distanza di Damerau-Levenshtein ristretta, con uscita anticipata oltre il limite.
function distanza(a, b, limite) {
  if (Math.abs(a.length - b.length) > limite) return limite + 1;
  const d = [];
  for (let i = 0; i <= a.length; i++) { d.push(new Array(b.length + 1).fill(0)); d[i][0] = i; }
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let minimoRiga = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      minimoRiga = Math.min(minimoRiga, d[i][j]);
    }
    if (minimoRiga > limite) return limite + 1;
  }
  return d[a.length][b.length];
}

// Numero dei formulari vidimati: 5 lettere, 6 cifre, 2 lettere (es. RGYTR027030CR).
const FORMATO_FIR = /^[A-Z]{5}\d{6}[A-Z]{2}$/;

const SOMIGLIANTI = { O: '0', '0': 'O', I: '1', '1': 'I', S: '5', '5': 'S', B: '8', '8': 'B', Z: '2', '2': 'Z' };

// Spiega in italiano in cosa differisce il formulario del report da quello del
// gestionale: e' il dettaglio da comunicare al fornitore.
export function descriviDifferenzaFir(report, gestionale) {
  const a = normalizzaFir(report), b = normalizzaFir(gestionale);
  const pos = (i) => `in posizione ${i + 1}`;
  if (a.length === b.length + 1) {
    let i = 0;
    while (i < b.length && a[i] === b[i]) i++;
    if (a.slice(i + 1) === b.slice(i)) return `carattere in piu' "${a[i]}" ${pos(i)}`;
  }
  if (a.length + 1 === b.length) {
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    if (a.slice(i) === b.slice(i + 1)) return `manca il carattere "${b[i]}" ${pos(i)}`;
  }
  if (a.length === b.length) {
    const diversi = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diversi.push(i);
    if (diversi.length === 1) {
      const i = diversi[0];
      const nota = SOMIGLIANTI[a[i]] === b[i] ? ', probabile scambio fra caratteri simili' : '';
      return `"${a[i]}" al posto di "${b[i]}" ${pos(i)}${nota}`;
    }
    if (diversi.length === 2 && diversi[1] === diversi[0] + 1 && a[diversi[0]] === b[diversi[1]] && a[diversi[1]] === b[diversi[0]]) {
      return `caratteri "${a[diversi[0]]}${a[diversi[1]]}" invertiti ${pos(diversi[0])}`;
    }
  }
  const n = distanza(a, b, 5);
  return n <= 5 ? `${n} caratteri diversi` : 'numero diverso';
}

// === confronto dei campi ===

export function classeNormalizzata(v) {
  const s = String(v || '').trim().toUpperCase();
  if (!s) return null;
  if (s.includes('AUTODEMOLIZIONE') || s === 'ACI' || s.includes('CLASS9')) return 'ACI';
  const m = s.match(/CLASS([1-4])/);
  if (m) return { 1: 'P', 2: 'M', 3: 'G1', 4: 'G2' }[m[1]];
  const primo = s.split('-')[0].trim().split(' ')[0];
  return ['P', 'M', 'G1', 'G2'].includes(primo) ? primo : null;
}

// true se i due nomi indicano lo stesso soggetto, false se diversi, null se non
// confrontabili perche' uno dei due manca.
export function nomiCoincidono(a, b) {
  const x = normalizzaRagioneSociale(a || ''), y = normalizzaRagioneSociale(b || '');
  if (!x || !y) return null;
  if (x === y) return true;
  if (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x))) return true;
  const tx = new Set(x.split(' ').filter(t => t.length > 2));
  const ty = new Set(y.split(' ').filter(t => t.length > 2));
  if (tx.size === 0 || ty.size === 0) return false;
  let comuni = 0;
  for (const t of tx) if (ty.has(t)) comuni++;
  return comuni / Math.min(tx.size, ty.size) >= 0.6;
}

const cifre = (v) => String(v ?? '').replace(/[^0-9]/g, '');
const it = (d) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '');
const kgIt = (n) => formatoKg(n) + ' kg';

// === movimenti del gestionale ===

const FONTI = {
  PrimariaRete: 'Primaria rete',
  PrimariaAci: 'Primaria ACI',
  Secondaria: 'Secondaria',
};

// Le schede di Extra Raccolta sono compilate a mano e possono essere primarie o
// secondarie; quelle inserite prima che esistesse la distinzione sono primarie.
export function eSecondariaExtra(r) {
  return String(r.tipo_movimento || '').toLowerCase().trim() === 'secondaria';
}

// Canale di un movimento: rete, ACI (anche le secondarie di PFU da autodemolizione)
// o extra raccolta. I canali restano distinti anche nella verifica dei report.
function canale(r, entita) {
  if (entita === 'ExtraRaccolta') return 'extra';
  if (entita === 'PrimariaAci') return 'aci';
  // Stessa regola di tutto il gestionale: eAci guarda anche il codice prodotto,
  // dove l'ACI arriva nella forma ".class9". Con la regola locale una secondaria
  // ACI con la classe vuota finiva fra quelle di rete, e la settimana non
  // quadrava ne' di qua ne' di la'.
  if (entita === 'Secondaria' && eAci(r)) return 'aci';
  return 'rete';
}

// Le movimentazioni che un report settimanale deve contenere, ciascuna con la sua quadratura.
export const CATEGORIE_MOVIMENTO = [
  { chiave: 'primaria-ingresso-rete', tipo: 'ingresso', nome: 'Ingressi primaria · rete' },
  { chiave: 'primaria-ingresso-aci', tipo: 'ingresso', nome: 'Ingressi primaria · ACI' },
  { chiave: 'primaria-ingresso-extra', tipo: 'ingresso', nome: 'Ingressi primaria · extra raccolta' },
  { chiave: 'secondaria-ingresso-rete', tipo: 'ingresso', nome: 'Ingressi secondaria · rete' },
  { chiave: 'secondaria-ingresso-aci', tipo: 'ingresso', nome: 'Ingressi secondaria · ACI' },
  { chiave: 'secondaria-ingresso-extra', tipo: 'ingresso', nome: 'Ingressi secondaria · extra raccolta' },
  { chiave: 'secondaria-uscita-rete', tipo: 'uscita', nome: 'Uscite secondaria · rete' },
  { chiave: 'secondaria-uscita-aci', tipo: 'uscita', nome: 'Uscite secondaria · ACI' },
  { chiave: 'secondaria-uscita-extra', tipo: 'uscita', nome: 'Uscite secondaria · extra raccolta' },
];

// Il verdetto di una verifica, un canale per volta (regola 3): una riga ACI
// sbagliata non rende "parziale" la rete dell'impianto. Per ogni canale con
// almeno un formulario, nel report o registrato: piena se le sue movimentazioni
// quadrano e non ha anomalie ne' formulari mancanti. I formulari del report che
// il gestionale non conosce non hanno canale e si contano a parte.
// Una riga col formulario registrato senza fine trasporto e' un'anomalia del suo
// canale (22/09/2026): la data e' obbligatoria. Le verifiche salvate prima la
// scrivevano senza "anomalia", come rettifica: si conta lo stesso, finche' il
// riconfronto non le riscrive.
export const CANALI_DEL_VERDETTO = [['rete', 'Rete'], ['aci', 'ACI'], ['extra', 'Extra raccolta']];
// Il canale di una riga per il verdetto: quello della movimentazione a cui e'
// abbinata. Una riga col formulario registrato senza una data obbligatoria, o
// con date incoerenti, che nel gestionale non riguarda l'impianto (per esempio
// chiuso su un'altra destinazione) non ha movimentazione, ma il formulario un
// canale ce l'ha: l'anomalia della data pesa li' (22/09/2026). Senza, il canale
// restava "pieno" accanto a un'anomalia, e il PDF diceva all'impianto che non
// c'era niente da fare. '' per le righe senza canale.
export function canaleDelVerdetto(e) {
  const k = String((e && e.categoria) || '').split('-')[2] || '';
  if (k) return k;
  const conDate = !!e && (!!e.senza_fine_trasporto || (e.discrepanze || []).some(d => d.campo === 'date'));
  return conDate && e.gestionale ? String(e.gestionale.canale || '') : '';
}
export function conformitaPerCanale(esito) {
  const canaleDi = (k) => String(k || '').split('-')[2] || '';
  return CANALI_DEL_VERDETTO.map(([canale, nome]) => {
    const quadratura = (esito.quadratura || []).filter(q => canaleDi(q.chiave) === canale);
    const righe = (esito.esiti || []).filter(e => canaleDelVerdetto(e) === canale);
    const assenti = (esito.assenti || []).filter(a => canaleDi(a.categoria) === canale);
    if (!quadratura.some(q => q.formulari_report || q.formulari_gestionale) && !righe.length && !assenti.length) return null;
    const anomalie = righe.filter(e => e.anomalia || e.senza_fine_trasporto).length + assenti.length;
    const quadra = quadratura.every(q => q.formulari_report === q.formulari_gestionale && q.kg_report === q.kg_gestionale);
    return { canale, nome, conformita: anomalie === 0 && quadra ? 'piena' : 'parziale', anomalie, assenti: assenti.length };
  }).filter(Boolean);
}

// Le date obbligatorie che mancano o non tornano a un movimento, ordine per
// ordine: [{ ordine, mancanti, incoerenti }], null se sono a posto. Un formulario
// ripartito su piu' ordini le porta di tutte le sue quote, perche' la data si
// corregge sull'ordine che non l'ha.
function dateDelMovimento(r) {
  if (!dateDaSistemare(r)) return null;
  return [{ ordine: String(r.id_ordine || ''), mancanti: dateMancanti(r), incoerenti: dateIncoerenti(r) }];
}

function movimento(r, entita) {
  const secondaria = entita === 'Secondaria' || (entita === 'ExtraRaccolta' && eSecondariaExtra(r));
  const fonte = entita === 'ExtraRaccolta' ? (secondaria ? 'Extra raccolta secondaria' : 'Extra raccolta primaria') : FONTI[entita];
  const date = dateDelMovimento(r);
  return {
    // solo quando c'e' da sistemare: sui movimenti a posto il campo non c'e',
    // e l'esito salvato delle verifiche non cambia per niente
    ...(date ? { date } : {}),
    id: entita + ':' + r.id,
    fonte,
    canale: canale(r, entita),
    ordine: String(r.id_ordine || ''),
    ticket: ticketDi(r),
    fir: String(r.numero_fir || ''),
    firN: normalizzaFir(r.numero_fir),
    kg: Math.round(Number(r.peso_effettivo) || 0),
    inizio: giornoRoma(r.trasporto_iniziato_il) || null,
    fine: giornoMovimento(r) || null,
    produttore: String((secondaria ? (r.stoccaggio || r.ragione_sociale) : (r.produttore || r.ragione_sociale)) || ''),
    punto_raccolta: secondaria ? '' : String(r.punto_di_raccolta || ''),
    codice_pdr: String((entita === 'Secondaria' ? r.id_stoccaggio : (secondaria ? '' : r.id_pdr)) ?? ''),
    destinatario: String(r.destinazione || ''),
    tipo_destinazione: String(r.tipo_destinazione || '').toLowerCase().trim(),
    trasportatore: String(r.trasportatore || ''),
    classe: classeNormalizzata(r.classe) || classeNormalizzata(r.prodotto),
    chiaveDest: normalizzaRagioneSociale(r.destinazione || ''),
    chiaveOrig: secondaria ? normalizzaRagioneSociale(r.stoccaggio || '') : '',
    secondaria,
  };
}

export async function caricaMovimenti(base44) {
  const svc = base44.asServiceRole.entities;
  const nomi = ['PrimariaRete', 'PrimariaAci', 'Secondaria', 'ExtraRaccolta'];
  const [elenchi, fornitori] = await Promise.all([
    Promise.all(nomi.map(n => fetchAll(svc[n]))),
    fetchAll(svc.Fornitore),
  ]);
  const grezzi = [];
  // Un terminato senza fine trasporto non sta in nessuna settimana e non si
  // colloca con la chiusura ne' con l'immissione: si esclude, ma si tiene
  // l'elenco per dirlo. Scartato in silenzio, un suo formulario nel report di un
  // impianto risultava "non presente nel gestionale" senza spiegazione. Si tiene
  // il movimento intero (con fine a null): verificaReport lo riconosce per
  // formulario e lo segnala come anomalia, perche' la data e' obbligatoria.
  const senzaFine = [];
  // Tutti i terminati con una data obbligatoria che manca o non torna, di
  // qualunque anno, con canale e archivio: la pagina li dice (datePerCanale).
  const conDate = [];
  elenchi.forEach((righe, i) => {
    for (const r of righe) {
      if (!eTerminato(r)) continue;
      const m = movimento(r, nomi[i]);
      if (m.fine) grezzi.push(m);
      else senzaFine.push(m);
      const v = voceDate(r);
      if (v) conDate.push({ ...v, canale: m.canale, fonte: m.fonte });
    }
  });
  senzaFine.sort((a, b) => a.canale.localeCompare(b.canale) || a.fonte.localeCompare(b.fonte) || a.fir.localeCompare(b.fir) || a.ordine.localeCompare(b.ordine));
  // Un formulario chiuso su piu' ordini e' un movimento solo: nell'elenco di un
  // impianto compare una volta, col peso intero. Le quote si fondono qui, una
  // volta per tutte - stesso numero, stesso giorno, stessa destinazione, stesso
  // archivio - sommando i chili e tenendo i ticket in chiaro. Se si fondessero
  // piu' a valle, chi conta gli ingressi della settimana ne conterebbe due.
  const movimenti = unisciQuote(grezzi, {
    numero: (m) => m.firN,
    peso: (m) => m.kg,
    stessoGruppo: (x, y) => x.fine === y.fine && x.fonte === y.fonte && x.canale === y.canale
      && x.chiaveDest === y.chiaveDest && x.chiaveOrig === y.chiaveOrig,
    fondi: (base, quote, kg) => {
      // le date da sistemare di tutte le quote, non solo della prima
      const { date: _date, ...resto } = base;
      const date = quote.flatMap(q => q.date || []);
      return {
        ...resto,
        ...(date.length ? { date } : {}),
        kg,
        ordine: quote.map(q => q.ordine).filter(Boolean).join(' + '),
        quote: quote.map(q => ({ ordine: q.ordine, ticket: q.ticket, kg: q.kg })),
      };
    },
  });
  const interni = new Set(['smoco']);
  const anagrafica = new Map();
  for (const f of fornitori) {
    const k = normalizzaRagioneSociale(f.ragione_sociale);
    if (!k) continue;
    anagrafica.set(k, f);
    if (f.interno) interni.add(k);
  }
  // Gli archivi cosi' come sono, annullati compresi: chi dopo un caricamento
  // rifa' anche le quadrature FIR li riusa invece di rileggerli.
  const archivi = Object.fromEntries(nomi.map((n, i) => [n, elenchi[i]]));
  SENZA_FINE_DEI_MOVIMENTI.set(movimenti, senzaFine);
  return { movimenti, interni, anagrafica, archivi, senza_fine: senzaFine, date_da_sistemare: conDate };
}

// I terminati senza fine trasporto letti insieme a un elenco di movimenti. Chi
// riconfronta le verifiche (verificheReport, ricontrollaDichiarazioni) passa a
// ricontrollaVerifiche i soli movimenti: senza questo legame il riconfronto
// avrebbe rifatto "non presente nel gestionale" la riga di un formulario
// registrato ma senza fine trasporto, e riscritto l'esito.
const SENZA_FINE_DEI_MOVIMENTI = new WeakMap();
export const senzaFineDei = (movimenti) => (movimenti && SENZA_FINE_DEI_MOVIMENTI.get(movimenti)) || [];

/**
 * I terminati con le date obbligatorie da sistemare (date_da_sistemare di
 * caricaMovimenti) per canale e archivio, da mostrare: quanti ordini, quanti
 * senza fine trasporto e i primi, con ID ordine, formulario e date che mancano.
 * Un gruppo per canale e archivio, mai un conteggio per tutti: sono tre
 * commesse diverse anche quando il dato manca. Prende il posto dell'elenco dei
 * soli senza fine trasporto (senzaFinePerCanale), che non diceva le altre date.
 */
export function datePerCanale(voci, quanti = 5) {
  const gruppi = new Map();
  for (const v of voci || []) {
    const k = v.canale + '|' + v.fonte;
    if (!gruppi.has(k)) gruppi.set(k, { canale: v.canale, fonte: v.fonte, n: 0, senza_fine: 0, esempi: [] });
    gruppi.get(k).n++;
    if (v.senza_fine) gruppi.get(k).senza_fine++;
  }
  // prima i senza fine trasporto, che nessun periodo conta
  const ordinate = [...(voci || [])].sort((a, b) => Number(b.senza_fine) - Number(a.senza_fine) || a.id_ordine.localeCompare(b.id_ordine));
  for (const v of ordinate) {
    const g = gruppi.get(v.canale + '|' + v.fonte);
    if (g.esempi.length < quanti) g.esempi.push({ fir: v.numero_fir, ordine: v.id_ordine, date: v.date });
  }
  const ordine = (c) => CANALI_VERIFICA.indexOf(c);
  return [...gruppi.values()].sort((a, b) => ordine(a.canale) - ordine(b.canale) || a.fonte.localeCompare(b.fonte));
}

// Che cosa rappresenta un movimento per il sito verificato: un ingresso e' una
// primaria o una secondaria che vi arriva (un impianto riceve anche i carichi
// degli stoccaggi), un'uscita una secondaria che ne parte.
export function relazioneConSito(m, chiave) {
  if (m.chiaveDest === chiave) return 'ingresso';
  if (m.secondaria && m.chiaveOrig === chiave) return 'uscita';
  return null;
}

export const CANALI_VERIFICA = ['rete', 'aci', 'extra'];

/**
 * Impianti e stoccaggi attivi nell'anno, con ingressi e uscite della settimana
 * canale per canale: { canale, ingressi, kg_ingressi, uscite, kg_uscite }, solo
 * i canali che hanno movimenti. Un numero unico sommava primarie di rete, ACI ed
 * extra raccolta, e non si poteva confrontare ne' col target di rete ne' col
 * report ACI dell'impianto.
 */
export function soggettiDellaSettimana({ movimenti, interni, anagrafica }, anno, settimana) {
  const { inizio, fine } = intervalloSettimana(anno, settimana);
  const soggetti = new Map();
  const tocca = (nome, chiave, ruolo) => {
    if (!chiave || interni.has(chiave)) return;
    if (!soggetti.has(chiave)) soggetti.set(chiave, { chiave, nomi: new Map(), ruoli: new Set() });
    const s = soggetti.get(chiave);
    s.ruoli.add(ruolo);
    if (nome) s.nomi.set(nome, (s.nomi.get(nome) || 0) + 1);
  };

  for (const m of movimenti) {
    if (m.fine.slice(0, 4) !== String(anno)) continue;
    if (m.secondaria) {
      tocca(m.produttore.trim(), m.chiaveOrig, 'stoccaggio');
      tocca(m.destinatario.trim(), m.chiaveDest, 'trattamento');
    } else tocca(m.destinatario.trim(), m.chiaveDest, m.tipo_destinazione === 'stoc' ? 'stoccaggio' : 'trattamento');
  }

  const settimanali = movimenti.filter(m => m.fine >= inizio && m.fine <= fine);
  const righe = [];
  for (const s of soggetti.values()) {
    const f = anagrafica.get(s.chiave);
    let nome = f && f.ragione_sociale ? f.ragione_sociale : '';
    if (!nome) for (const n of s.nomi.keys()) if (n.length > nome.length) nome = n;
    const canali = [];
    for (const canale of CANALI_VERIFICA) {
      const delCanale = settimanali.filter(m => m.canale === canale);
      const ingressi = delCanale.filter(m => relazioneConSito(m, s.chiave) === 'ingresso');
      const uscite = delCanale.filter(m => relazioneConSito(m, s.chiave) === 'uscita');
      if (!ingressi.length && !uscite.length) continue;
      canali.push({
        canale,
        ingressi: ingressi.length,
        kg_ingressi: ingressi.reduce((t, m) => t + m.kg, 0),
        uscite: uscite.length,
        kg_uscite: uscite.reduce((t, m) => t + m.kg, 0),
      });
    }
    righe.push({
      chiave: s.chiave,
      nome,
      ruoli: ['trattamento', 'stoccaggio'].filter(r => s.ruoli.has(r)),
      canali,
      movimentato: canali.length > 0,
    });
  }
  righe.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  return { inizio, fine, righe };
}

// === righe del report ===

export const CAMPI_REPORT = ['fir', 'ordine', 'peso', 'data_inizio', 'data_fine', 'data', 'produttore', 'codice_pdr', 'destinatario', 'trasportatore', 'intermediario', 'classe', 'targa'];

/**
 * Numero d'ordine confrontabile. "SEC 26141285" e "SEC26141285" sono lo stesso ordine,
 * e alcuni impianti scrivono nella stessa casella anche la classe ("ET26074218 P"):
 * si tiene il codice, cioe' il prefisso con il numero lungo.
 */
export const normalizzaOrdine = (v) => {
  const t = String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = t.match(/(?:ET|SEC|TER|EXT)?[0-9]{5,}/);
  return m ? m[0] : t;
};

/**
 * Classe scritta insieme al numero d'ordine ("ET26074218 P", "SEC26149241 M").
 * Si toglie il codice dell'ordine e si legge quel che resta: se e' una classe
 * va confrontata con quella registrata, esattamente come la colonna classe.
 */
export const classeDaOrdine = (v) => {
  const t = String(v ?? '').toUpperCase();
  if (!t.trim()) return null;
  const resto = t.replace(/(?:ET|SEC|TER|EXT)?\s*[0-9]{5,}/g, ' ').replace(/[^A-Z0-9]+/g, ' ').trim();
  if (!resto) return null;
  return classeNormalizzata(resto) || classeNormalizzata(resto.replace(/\s+/g, ''));
};

/**
 * Porta le righe lette dal file in una forma confrontabile.
 * Il peso viene sempre espresso in chilogrammi interi, come nei formulari e nel
 * portale Ecotyre. Se l'unita' non e' nota si deduce dall'ordine di grandezza:
 * un carico di PFU pesa tonnellate, mai decine di migliaia di tonnellate.
 */
export function normalizzaRigheReport(grezze, unitaIndicata) {
  let unita = unitaIndicata === 'kg' || unitaIndicata === 't' ? unitaIndicata : null;
  if (!unita) {
    const valori = grezze.map(g => numeroDaValore(g.peso)).filter(n => n !== null && n > 0).sort((a, b) => a - b);
    const mediana = valori.length ? valori[Math.floor(valori.length / 2)] : 0;
    unita = mediana > 0 && mediana < 100 ? 't' : 'kg';
  }
  const righe = [];
  for (const g of grezze) {
    const fir = String(g.fir ?? '').trim();
    const firN = normalizzaFir(fir);
    const peso = numeroDaValore(g.peso, unita);
    if (!firN && peso === null) continue;
    // Righe dei totali o dei subtotali: "TOT.", "TOTALE", "TOT. 32.780".
    if (!firN && /(^|[^A-Z])TOT(ALE|ALI)?([^A-Z]|$)/i.test(CAMPI_REPORT.map(c => g[c] ?? '').join(' '))) continue;
    // Intestazione ripetuta a meta' foglio (per esempio prima delle uscite): il formulario non ha cifre.
    if (peso === null && !/\d/.test(fir)) continue;
    // Una riga con il solo peso, senza formulario, date e soggetti, e' la riga dei totali.
    const testo = (v) => String(v ?? '').trim();
    if (!firN && !testo(g.data_inizio) && !testo(g.data_fine) && !testo(g.data) && !testo(g.produttore) && !testo(g.trasportatore) && !testo(g.destinatario)) continue;
    righe.push({
      n: g.n,
      ...(g.foglio ? { foglio: String(g.foglio) } : {}),
      fir,
      firN,
      ordine: String(g.ordine ?? '').trim(),
      kg: peso === null ? null : Math.round(unita === 't' ? peso * 1000 : peso),
      inizio: dataDaValore(g.data_inizio),
      fine: dataDaValore(g.data_fine),
      data: dataDaValore(g.data),
      produttore: String(g.produttore ?? '').trim(),
      codice_pdr: String(g.codice_pdr ?? '').trim(),
      destinatario: String(g.destinatario ?? '').trim(),
      trasportatore: String(g.trasportatore ?? '').trim(),
      intermediario: String(g.intermediario ?? '').trim(),
      classe_testo: String(g.classe ?? '').trim(),
      // La classe puo' stare nella sua colonna oppure accanto al numero d'ordine:
      // in entrambi i casi va verificata.
      classe: classeNormalizzata(g.classe) || classeDaOrdine(g.classe) || classeDaOrdine(g.ordine),
      classe_ordine: classeDaOrdine(g.ordine),
      classe_da_ordine: !(classeNormalizzata(g.classe) || classeDaOrdine(g.classe)) && !!classeDaOrdine(g.ordine),
      targa: String(g.targa ?? '').trim(),
    });
  }
  return { righe, unita };
}

// === verifica ===

// "fine trasporto", "immissione e inizio trasporto"
const elencoNomi = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);

/**
 * Le anomalie di un formulario registrato a cui manca una data obbligatoria, o
 * che ha date incoerenti: una frase per ordine (date di caricaMovimenti, una
 * voce per ordine). Con un ordine solo non si ripete il numero; con un
 * formulario ripartito si dice su quale ordine va corretta. Le parole sono
 * quelle che l'utente ha chiesto nel report e nel PDF per l'impianto
 * (22/09/2026): "Formulario registrato senza data di fine trasporto: la data e'
 * obbligatoria e va inserita". Se il report la data mancante la scrive
 * (dalReport, per nome della data), si dice accanto: e' quella da inserire, se
 * e' giusta.
 */
export function messaggiDate(voci, dalReport = {}) {
  const lista = voci || [];
  return lista.map(v => {
    const parti = [];
    const mancanti = v.mancanti || [];
    const nelReport = mancanti.length === 1 && dalReport[mancanti[0]] ? ` (nel report: ${it(dalReport[mancanti[0]])})` : '';
    if (mancanti.length === 1) parti.push(`Formulario registrato senza data di ${mancanti[0]}: la data e' obbligatoria e va inserita${nelReport}`);
    else if (mancanti.length > 1) parti.push(`Formulario registrato senza le date di ${elencoNomi(mancanti)}: le date sono obbligatorie e vanno inserite`);
    if ((v.incoerenti || []).length) parti.push(`Date del formulario registrato incoerenti (${v.incoerenti.join('; ')}): vanno corrette`);
    const testo = parti.join('. ');
    return lista.length > 1 && v.ordine ? `Ordine ${v.ordine}: ${testo}` : testo;
  }).filter(Boolean);
}

// Un carico che il report attribuisce a un altro consorzio (SMOCO lavora anche per
// Ecopneus) non e' nel gestionale per scelta, non per errore.
const altroCircuito = (intermediario) => !!intermediario && !/ecotyre/i.test(intermediario) && /ecopneus|cobat|green ?tire/i.test(intermediario);

/**
 * Confronta le righe del report con i movimenti del gestionale.
 *
 * Il report di un sito puo' contenere ingressi, cioe' primarie che arrivano, e
 * uscite, cioe' secondarie che partono. Il tipo di ogni riga si ricava dal
 * movimento a cui viene abbinata.
 *
 * Abbinamento di ogni riga, in ordine di affidabilita':
 *   1. stesso formulario;
 *   2. formulario che differisce di uno o due caratteri, segnalato come errato;
 *   3. formulario assente o irriconoscibile: stesso peso al chilogrammo e stessa
 *      data di fine trasporto, con un giorno di margine per ritrovare la riga.
 * Una volta abbinata una riga, ogni campo presente nel report viene confrontato:
 * il peso al chilogrammo, la data di verifica e' quella di fine trasporto.
 *
 * Alla fine, gli ingressi e le uscite della settimana che nessuna riga ha
 * reclamato sono assenti nel report: il report deve contenere tutte le
 * movimentazioni, e uno con i soli ingressi ha le secondarie partite fra gli
 * assenti (uscite_verificate lo dice).
 *
 * Non si considerano, e si elencano a parte, le righe con una data di un'altra
 * settimana (molti report sono cumulativi del mese) quando anche il gestionale
 * le colloca fuori dalla settimana o non le conosce, e le righe non trovate che
 * il report attribuisce a un altro consorzio.
 *
 * Ogni discrepanza ha una gravita':
 *   - anomalia: errore, svista o mancanza dell'impianto (formulario, peso, date,
 *     classe, righe mancanti, in piu' o duplicate), e il formulario registrato
 *     senza una data obbligatoria;
 *   - osservazione: nome scritto in modo diverso, a parita' di formulario e peso;
 *   - rettifica: l'errore e' nei dati del portale, non nel report.
 * La conformita' e' piena solo senza anomalie e con formulari e pesi che
 * quadrano, per gli ingressi e per le uscite.
 *
 * Immissione, inizio e fine trasporto sono obbligatorie nei formulari (regola
 * dell'utente del 22/09/2026). Una riga abbinata a un movimento a cui ne manca
 * una, o con le date incoerenti, porta l'anomalia "date" e conta nel verdetto
 * del suo canale. Una riga col formulario di un terminato senza fine trasporto
 * (senzaFine, di norma quelli letti con i movimenti da caricaMovimenti) non si
 * abbina, perche' il formulario non ha una settimana: e' un'anomalia anche lei -
 * "Formulario registrato senza data di fine trasporto: la data e' obbligatoria
 * e va inserita" - e conta nel verdetto del suo canale, ma resta fuori dalla
 * quadratura, dove il gestionale non la colloca (regola 1: chi non ha la fine
 * trasporto non si conta in nessun periodo, ma si segnala). Il 22/09/2026 la
 * stessa riga era diventata una rettifica a nostra cura, senza peso sul
 * verdetto: l'utente l'ha corretto lo stesso giorno.
 */
export function verificaReport(righeReport, movimenti, { chiave, nome, inizio, fine, senzaFine = senzaFineDei(movimenti) }) {
  const relazione = (m) => relazioneConSito(m, chiave);
  const categoria = (m) => `${m.secondaria ? 'secondaria' : 'primaria'}-${relazione(m)}-${m.canale}`;
  // Una riga che il gestionale non collega al sito e' un'uscita se parte dal sito stesso.
  const tipoPresunto = (r) => (nomiCoincidono(r.produttore, nome) === true || (r.produttore && normalizzaRagioneSociale(r.produttore) === chiave) ? 'uscita' : 'ingresso');
  const da = aggiungiGiorni(inizio, -FINESTRA_ABBINAMENTO_GIORNI);
  const a = aggiungiGiorni(fine, FINESTRA_ABBINAMENTO_GIORNI);
  // Le quote dei formulari ripartiti sono gia' fuse da caricaMovimenti: qui
  // resta solo la fascia di giorni intorno alla settimana.
  const bacino = movimenti.filter(m => m.fine >= da && m.fine <= a);
  const perFir = new Map();
  for (const m of bacino) {
    if (!m.firN) continue;
    if (!perFir.has(m.firN)) perFir.set(m.firN, []);
    perFir.get(m.firN).push(m);
  }
  // I terminati senza fine trasporto, per formulario.
  const senzaFinePerFir = new Map();
  for (const m of senzaFine || []) {
    const k = m.firN || normalizzaFir(m.fir);
    if (!k) continue;
    if (!senzaFinePerFir.has(k)) senzaFinePerFir.set(k, []);
    senzaFinePerFir.get(k).push(m);
  }
  const nellaSettimana = (m) => m.fine >= inizio && m.fine <= fine;
  const ingressi = bacino.filter(m => nellaSettimana(m) && relazione(m) === 'ingresso');
  const uscite = bacino.filter(m => nellaSettimana(m) && relazione(m) === 'uscita');
  const usati = new Map();

  const dataRiga = (r) => r.fine || r.data;
  const punteggio = (r, m) => {
    let p = 0;
    if (r.kg !== null) p += Math.min(Math.abs(r.kg - m.kg), 5000) / 10;
    const d = dataRiga(r);
    if (d) p += Math.min(Math.abs(giorniTra(d, m.fine)), 30) * 5;
    if (!relazione(m)) p += 200;
    if (usati.has(m.id)) p += 1000;
    return p;
  };
  const migliore = (r, lista) => lista.reduce((best, m) => (best === null || punteggio(r, m) < punteggio(r, best) ? m : best), null);

  const esiti = [];
  // Righe che non riguardano la verifica: carichi di altre settimane nei report
  // cumulativi del mese e carichi di altri circuiti (per esempio Ecopneus).
  const escluse = [];
  const rif = (r) => (r.foglio ? `${String(r.foglio).trim()}, riga ${r.n}` : `riga ${r.n}`);
  const escludi = (r, motivo) => escluse.push({ n: r.n, foglio: r.foglio || '', fir: r.fir, ordine: r.ordine, kg: r.kg, data: dataRiga(r), produttore: r.produttore, destinatario: r.destinatario, motivo });
  for (const r of righeReport) {
    let m = null;
    let modo = null;

    if (r.firN && perFir.has(r.firN)) {
      m = migliore(r, perFir.get(r.firN));
      modo = 'fir';
    }

    // Lo stesso formulario fra i terminati senza fine trasporto: e' registrato,
    // quindi non si cerca un formulario simile ne' un carico dello stesso peso,
    // che lo abbinerebbero a un altro movimento.
    const senzaData = !m && r.firN ? senzaFinePerFir.get(r.firN) || null : null;

    if (!m && !senzaData && r.firN.length >= 5) {
      let scelto = null, sceltoDist = 3, sceltoPunti = Infinity;
      for (const c of bacino) {
        if (!c.firN) continue;
        const dist = distanza(r.firN, c.firN, 2);
        if (dist > 2) continue;
        const punti = punteggio(r, c);
        if (dist < sceltoDist || (dist === sceltoDist && punti < sceltoPunti)) { scelto = c; sceltoDist = dist; sceltoPunti = punti; }
      }
      if (scelto && (sceltoDist === 1 || (r.kg === scelto.kg && relazione(scelto)))) {
        m = scelto;
        modo = 'fir_simile';
      }
    }

    if (!m && !senzaData && r.kg !== null) {
      const d = dataRiga(r);
      const candidati = bacino.filter(c => relazione(c) && !usati.has(c.id) && c.kg === r.kg
        && (!d || Math.abs(giorniTra(d, c.fine)) <= 1));
      // Senza data, un peso da solo non basta a riconoscere un carico se ce n'e'
      // piu' d'uno uguale.
      if (candidati.length > 0 && (d || candidati.length === 1)) {
        m = migliore(r, candidati);
        modo = 'attributi';
      }
    }

    const report = {
      fir: r.fir, ordine: r.ordine, kg: r.kg, inizio: r.inizio, fine: r.fine, data: r.data, produttore: r.produttore,
      codice_pdr: r.codice_pdr, destinatario: r.destinatario, trasportatore: r.trasportatore, classe: r.classe || r.classe_testo,
    };

    const dataReport = dataRiga(r);
    const fuoriSettimana = !!dataReport && (dataReport < inizio || dataReport > fine);
    const foglio = r.foglio ? { foglio: String(r.foglio).trim() } : {};

    if (!m) {
      if (altroCircuito(r.intermediario)) { escludi(r, `Carico di un altro circuito: intermediario ${r.intermediario}`); continue; }
      if (fuoriSettimana) { escludi(r, `Data ${it(dataReport)}, fuori dalla settimana verificata`); continue; }
      if (senzaData) {
        // Formulario registrato ma senza fine trasporto, che e' una data
        // obbligatoria: e' un'anomalia e conta nel verdetto del suo canale
        // (22/09/2026). senza_fine_trasporto la tiene fuori dalla quadratura,
        // dove il gestionale non la colloca in nessuna settimana.
        const s = senzaData.find(x => relazione(x)) || senzaData[0];
        const quote = senzaData.filter(x => x.fonte === s.fonte && x.canale === s.canale && x.chiaveDest === s.chiaveDest && x.chiaveOrig === s.chiaveOrig);
        const tipoS = relazione(s);
        // Le date di tutte le quote; un movimento letto altrove senza il
        // dettaglio porta almeno la fine trasporto che manca.
        const date = quote.flatMap(q => q.date || []);
        const voci = date.length ? date : [{ ordine: s.ordine, mancanti: ['fine trasporto'], incoerenti: [] }];
        // Un formulario che nel gestionale va altrove lo si dice come per le
        // righe abbinate: e' un'altra anomalia, oltre alla data che manca.
        const altrove = tipoS ? [] : [{ campo: 'destinatario', gravita: 'anomalia', messaggio: `Nel gestionale questo formulario non riguarda ${nome}: va da ${s.produttore || 'produttore non indicato'} a ${s.destinatario}` }];
        esiti.push({
          n: r.n, ...foglio, tipo: tipoS,
          ...(tipoS ? { categoria: categoria(s) } : { tipo_presunto: tipoPresunto(r), categoria: 'non_registrati' }),
          esito: 'discrepanze', anomalia: true, senza_fine_trasporto: true, report,
          gestionale: {
            fonte: s.fonte, canale: s.canale, ordine: quote.map(q => q.ordine).filter(Boolean).join(' + '), ticket: s.ticket, fir: s.fir,
            kg: quote.reduce((t, q) => t + q.kg, 0), inizio: s.inizio, fine: null, produttore: s.produttore, punto_raccolta: s.punto_raccolta,
            codice_pdr: s.codice_pdr, destinatario: s.destinatario, trasportatore: s.trasportatore, classe: s.classe,
            quote: quote.length > 1 ? quote.map(q => ({ ordine: q.ordine, ticket: q.ticket, kg: q.kg })) : null,
            date: voci,
          },
          discrepanze: [
            ...messaggiDate(voci, { 'inizio trasporto': r.inizio, 'fine trasporto': r.fine || r.data }).map(messaggio => ({ campo: 'date', gravita: 'anomalia', messaggio })),
            ...altrove,
          ],
        });
        continue;
      }
      // Senza formulario nel gestionale resta il numero d'ordine del report, l'unico riferimento.
      esiti.push({ n: r.n, ...foglio, tipo: null, tipo_presunto: tipoPresunto(r), categoria: 'non_registrati', esito: 'non_trovata', anomalia: true, report, gestionale: null, discrepanze: [{ campo: 'fir', gravita: 'anomalia', messaggio: r.firN ? 'Formulario non presente nel gestionale' : 'Riga senza formulario, non abbinabile a nessun movimento' }] });
      continue;
    }
    // Report e gestionale concordano su un'altra settimana: la riga sara' verificata con quella.
    if (fuoriSettimana && !nellaSettimana(m)) {
      escludi(r, `Carico della settimana ${settimanaIso(m.fine).settimana}: nel gestionale il trasporto si conclude il ${it(m.fine)}`);
      continue;
    }

    const tipo = relazione(m);
    const discrepanze = [];
    const aggiungi = (campo, messaggio, gravita = 'anomalia') => discrepanze.push({ campo, gravita, messaggio });

    if (modo === 'fir_simile') {
      // Se solo il numero del report ha il formato dei formulari, l'errore e' nel gestionale.
      if (FORMATO_FIR.test(r.firN) && !FORMATO_FIR.test(m.firN)) aggiungi('fir', `Formulario errato nel gestionale: ${descriviDifferenzaFir(m.fir, r.fir)}. Nel report e' ${r.fir}, con il formato regolare di 5 lettere, 6 cifre e 2 lettere: da correggere sul portale`, 'rettifica');
      else aggiungi('fir', `Formulario errato: ${descriviDifferenzaFir(r.fir, m.fir)}. Nel gestionale e' ${m.fir}`);
    }
    if (modo === 'attributi') aggiungi('fir', r.firN ? `Formulario non corrispondente: nel gestionale e' ${m.fir}` : `Formulario assente nel report: nel gestionale e' ${m.fir}`);

    if (r.kg === null) aggiungi('kg', 'Peso assente nel report');
    else if (r.kg !== m.kg) aggiungi('kg', `Peso diverso: report ${kgIt(r.kg)}, gestionale ${kgIt(m.kg)}, differenza ${kgIt(r.kg - m.kg)}`);

    if (r.fine && r.fine !== m.fine) aggiungi('fine', `Data fine trasporto diversa: report ${it(r.fine)}, gestionale ${it(m.fine)}`);
    else if (!r.fine && r.data && r.data !== m.fine) aggiungi('fine', `Data diversa dalla fine trasporto: report ${it(r.data)}, gestionale ${it(m.fine)}`);
    else if (!r.fine && !r.data) aggiungi('fine', 'Data di fine trasporto assente nel report');
    if (r.inizio && m.inizio && r.inizio !== m.inizio) aggiungi('inizio', `Data inizio trasporto diversa: report ${it(r.inizio)}, gestionale ${it(m.inizio)}`);
    // Le date obbligatorie del formulario registrato: immissione e inizio del
    // trasporto (la fine c'e', altrimenti il movimento non si abbinava), e date
    // nell'ordine giusto. Mancano o non tornano: anomalia del canale.
    for (const messaggio of messaggiDate(m.date, { 'inizio trasporto': r.inizio })) aggiungi('date', messaggio);
    if (tipo && !nellaSettimana(m)) {
      aggiungi('fine', `Nel gestionale il trasporto si conclude il ${it(m.fine)}, nella settimana ${settimanaIso(m.fine).settimana} e non in quella verificata`);
    }

    if (r.codice_pdr && cifre(r.codice_pdr) && m.codice_pdr && cifre(r.codice_pdr) !== cifre(m.codice_pdr)) {
      aggiungi('produttore', `Codice produttore diverso: report ${r.codice_pdr}, gestionale ${m.codice_pdr}`);
    } else if (r.produttore) {
      const esito = nomiCoincidono(r.produttore, m.produttore);
      const esitoPunto = nomiCoincidono(r.produttore, m.punto_raccolta);
      if (esito === false && esitoPunto !== true) aggiungi('produttore', `Produttore diverso: report "${r.produttore}", gestionale "${m.produttore}"`, 'osservazione');
    }

    if (r.destinatario && nomiCoincidono(r.destinatario, m.destinatario) === false) {
      aggiungi('destinatario', `Destinatario diverso: report "${r.destinatario}", gestionale "${m.destinatario}"`, 'osservazione');
    }
    if (!tipo) {
      aggiungi('destinatario', `Nel gestionale questo formulario non riguarda ${nome}: va da ${m.produttore || 'produttore non indicato'} a ${m.destinatario}`);
    }

    if (r.trasportatore && nomiCoincidono(r.trasportatore, m.trasportatore) === false) {
      aggiungi('trasportatore', `Trasportatore diverso: report "${r.trasportatore}", gestionale "${m.trasportatore}"`, 'osservazione');
    }

    if (r.classe && m.classe && r.classe !== m.classe) {
      const dove = r.classe_da_ordine ? " (indicata accanto al numero d'ordine)" : '';
      aggiungi('classe', `Classe diversa: report ${r.classe}${dove}, gestionale ${m.classe}`);
    } else if (r.classe_ordine && !r.classe_da_ordine && r.classe && r.classe_ordine !== r.classe) {
      // Nel report la classe compare due volte e le due indicazioni si contraddicono.
      aggiungi('classe', `Nel report la classe accanto al numero d'ordine (${r.classe_ordine}) non coincide con la colonna classe (${r.classe})`, 'osservazione');
    }

    // Se il formulario e' chiuso su piu' ordini, il report puo' citarne uno
    // qualsiasi: va bene tutti quelli su cui il peso e' stato ripartito.
    const ordiniDelMovimento = (m.quote || []).map(q => q.ordine).filter(Boolean);
    const ordiniAmmessi = (ordiniDelMovimento.length ? ordiniDelMovimento : [m.ordine])
      .filter(Boolean).map(normalizzaOrdine);
    if (r.ordine && ordiniAmmessi.length && !ordiniAmmessi.includes(normalizzaOrdine(r.ordine))) {
      aggiungi('ordine', `Ordine diverso: report ${r.ordine}, gestionale ${m.ordine}`);
    }

    const gestionale = {
      fonte: m.fonte, canale: m.canale, ordine: m.ordine, ticket: m.ticket, fir: m.fir, kg: m.kg, inizio: m.inizio, fine: m.fine, produttore: m.produttore,
      punto_raccolta: m.punto_raccolta, codice_pdr: m.codice_pdr, destinatario: m.destinatario, trasportatore: m.trasportatore, classe: m.classe,
      // Se il peso del formulario e' ripartito su piu' ordini, le quote restano
      // in chiaro col loro ticket: e' la differenza fra un conto che torna e un
      // conto che sembra sbagliato.
      quote: m.quote || null,
      ...(m.date ? { date: m.date } : {}),
    };

    const presunto = tipo ? { categoria: categoria(m) } : { tipo_presunto: tipoPresunto(r), categoria: 'non_registrati' };
    if (usati.has(m.id)) {
      esiti.push({ n: r.n, ...foglio, tipo, ...presunto, esito: 'duplicata', anomalia: true, report, gestionale, discrepanze: [{ campo: 'fir', gravita: 'anomalia', messaggio: `Riga duplicata: lo stesso movimento e' gia' riportato (${usati.get(m.id)})` }, ...discrepanze] });
      continue;
    }
    usati.set(m.id, rif(r));
    esiti.push({ n: r.n, ...foglio, tipo, ...presunto, esito: discrepanze.length ? 'discrepanze' : 'conforme', anomalia: discrepanze.some(d => d.gravita === 'anomalia'), report, gestionale, discrepanze });
  }

  // Il report deve contenere tutte le movimentazioni: ingressi e uscite, di ogni canale.
  // Quelle registrate e non abbinate a nessuna riga mancano nel report.
  const usciteVerificate = esiti.some(e => e.tipo === 'uscita');
  // Un assente a cui manca anche una data obbligatoria lo dice: la data va
  // inserita insieme alla riga che manca nel report.
  const assente = (tipo) => (m) => ({
    tipo, categoria: categoria(m), fonte: m.fonte, canale: m.canale, ordine: m.ordine, fir: m.fir, kg: m.kg, inizio: m.inizio, fine: m.fine,
    produttore: m.produttore, destinatario: m.destinatario, trasportatore: m.trasportatore, classe: m.classe,
    ...(m.date ? { date: m.date, date_testo: messaggiDate(m.date).join('. ') } : {}),
  });
  const assenti = [
    ...ingressi.filter(m => !usati.has(m.id)).map(assente('ingresso')),
    ...uscite.filter(m => !usati.has(m.id)).map(assente('uscita')),
  ].sort((x, y) => x.tipo.localeCompare(y.tipo) || String(x.fine).localeCompare(String(y.fine)) || x.fir.localeCompare(y.fir));

  // Quadratura per movimentazione e canale: formulari e pesi del report contro quelli registrati.
  // Le righe dei terminati senza fine trasporto non ci sono: il gestionale non
  // le colloca nella settimana, e contate solo dal lato del report farebbero un
  // secondo "non quadra" per la stessa mancanza. La mancanza pesa gia' sul
  // verdetto del canale come anomalia della riga.
  const somma = (lista, kg) => lista.reduce((t, x) => t + (kg(x) || 0), 0);
  const registrati = [...ingressi, ...uscite];
  const quadratura = [
    ...CATEGORIE_MOVIMENTO.map(c => {
      const righe = esiti.filter(e => e.categoria === c.chiave && !e.senza_fine_trasporto);
      const mov = registrati.filter(m => categoria(m) === c.chiave);
      return { ...c, formulari_report: righe.length, kg_report: somma(righe, e => e.report.kg), formulari_gestionale: mov.length, kg_gestionale: somma(mov, m => m.kg) };
    }),
    (() => {
      const righe = esiti.filter(e => e.categoria === 'non_registrati' && !e.senza_fine_trasporto);
      return { chiave: 'non_registrati', tipo: null, nome: 'Formulari del report non registrati per l\'impianto', formulari_report: righe.length, kg_report: somma(righe, e => e.report.kg), formulari_gestionale: 0, kg_gestionale: 0 };
    })(),
  ];
  const quadra = quadratura.every(q => q.formulari_report === q.formulari_gestionale && q.kg_report === q.kg_gestionale);
  const anomalie = esiti.filter(e => e.anomalia).length + assenti.length;

  const conta = (e) => esiti.filter(x => x.esito === e).length;
  // Nel riepilogo non ci sono piu' ingressi, uscite e pesi complessivi: sommavano
  // primarie e secondarie di rete, ACI ed extra raccolta in un numero solo. Quanti
  // formulari e quanti chili ci sono, per movimentazione e canale, lo dice la
  // quadratura qui sopra.
  return {
    esiti,
    assenti,
    escluse,
    quadratura,
    riepilogo: {
      // Il verdetto unico resta solo per l'alert della dichiarazione di nessuna
      // movimentazione (smentita se lo e' in un canale qualsiasi): a video, nel
      // PDF e nell'Excel vale per_canale.
      conformita: anomalie === 0 && quadra ? 'piena' : 'parziale',
      per_canale: conformitaPerCanale({ quadratura, esiti, assenti }),
      anomalie,
      osservazioni: esiti.filter(e => (e.discrepanze || []).some(d => d.gravita === 'osservazione')).length,
      rettifiche: esiti.filter(e => (e.discrepanze || []).some(d => d.gravita === 'rettifica')).length,
      // formulari registrati senza una data obbligatoria o con date incoerenti:
      // righe del report e movimenti assenti nel report
      date_da_sistemare: esiti.filter(e => (e.discrepanze || []).some(d => d.campo === 'date')).length + assenti.filter(a => a.date).length,
      righe_report: esiti.length,
      conformi: conta('conforme'),
      con_discrepanze: conta('discrepanze'),
      non_trovate: conta('non_trovata'),
      duplicate: conta('duplicata'),
      assenti_nel_report: assenti.length,
      uscite_verificate: usciteVerificate,
      righe_escluse: escluse.length,
      peso_escluse_kg: escluse.reduce((t, e) => t + (e.kg || 0), 0),
    },
  };
}
