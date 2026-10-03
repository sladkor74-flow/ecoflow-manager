// LE DICHIARAZIONI ACI DEGLI IMPIANTI, LETTE DAL DOCUMENTO E PROPOSTE.
//
// Ogni mese gli impianti che fanno recupero di materia (R3) mandano via email la
// dichiarazione ACI di ogni conferimento ricevuto, e l'utente la gira al
// consorzio: le dichiarazioni ACI a portale non si gestiscono. Finora quei
// quattro numeri - quantita' di PFU lavorati, polverino/granulo, fibre tessili,
// metalli ferrosi - li trascriveva a mano, mese per mese e impianto per impianto,
// nella scheda del mese di Dichiarazioni Impianti.
//
// QUI SI PROPONE, NON SI SALVA. Un numero sbagliato ma sicuro di se' e' peggio di
// un refuso, perche' il refuso si vede. Percio' in questo file non c'e' nessuna
// scrittura e nessuna rete: ci sono lo schema con cui si chiede la lettura, i
// controlli che dicono se la lettura si puo' guardare, la somma dei documenti di
// un mese e il riscontro col conferito. Il salvataggio resta un gesto dell'utente.
//
// I DUE CONTROLLI CHE RENDONO SICURA LA LETTURA AUTOMATICA li danno i documenti,
// non il modello:
//
//   1. I TRE MATERIALI FANNO SEMPRE LA QUANTITA', al chilo. Verificato sui
//      ventitre documenti del 2026, su tutti e quattro gli impianti: Gatim
//      1.970 + 590 + 1.370 = 3.930; T.R.S. 9.548 + 1.364 + 2.728 = 13.640; Green
//      Tyre Project 2.140 + 200 + 300 = 2.640; Tecnogum 1.260 + 70 + 70 = 1.400.
//      LA TOLLERANZA E' ZERO: una somma che non torna e' una cifra letta male,
//      non un arrotondamento dell'impianto. E' il controllo che permette di
//      fidarsi di una lettura automatica, perche' tre numeri su quattro sbagliati
//      insieme e nello stesso verso non succede.
//
//   2. IL MESE DI UN IMPIANTO E' LA SOMMA DI PIU' DOCUMENTI, e il totale deve
//      tornare col conferito che il gestionale gia' conosce (Gatim giugno: tre
//      documenti, 11.340 kg; Tecnogum giugno: tre documenti, 7.480 kg). Luglio
//      2026 lo conferma al chilo: Green Tyre 2.640 e T.R.S. 13.640 sono quello
//      che c'e' scritto nel gestionale.
//
// IL MESE VIENE DALLA DATA DI CONFERIMENTO, cioe' dal giorno in cui i PFU sono
// arrivati all'impianto: e' la fine del trasporto, la regola di tutto il
// gestionale. Non la data della lettera (Tecnogum firma il 18/07 un conferimento
// del 04/06), non la data di avvenuto recupero, non il nome della cartella.
// Dove l'impianto scrive il mese a parole (Green Tyre: «dettaglio quantita'
// ricevute nel mese di LUGLIO 2026») si legge anche quello, ma vale da riscontro:
// se contraddice la data, una delle due letture e' sbagliata e si dice.
//
// UN DOCUMENTO E' UN CONFERIMENTO, NON UN TICKET. Lo stesso documento puo' portare
// quattro ticket ACI su un solo formulario (Gatim, gennaio 2026: 158765-73,
// 159165-85, 159325-51 e 159349-75 su CNDJM000218LZ, 12.280 kg) oppure due ticket
// perche' il carico ha sforato il 10% del primo (Tecnogum, SEC26104994:
// 162684-15 e 163142-85, 3.460 kg). I pesi si sommano, i ticket si elencano senza
// doppioni: e' la regola del portale che vale in tutto il gestionale.
import { MESI } from "./dichiarazioniImpianti.ts";
import { formatoKg } from "./formato.ts";

/**
 * Lo schema con cui si chiede la lettura di UN documento (il response_json_schema
 * di InvokeLLM). Il prompt sta nella funzione che legge,
 * base44/functions/leggiDichiarazioneAci/entry.ts: chi cambia uno guardi l'altro.
 *
 * I pesi sono chilogrammi interi, le date in AAAA-MM-GG. Un campo che sul
 * documento non c'e' torna vuoto o a zero: non si inventa.
 */
export const SCHEMA_LETTURA = {
  type: 'object',
  properties: {
    impianto: { type: 'string', description: "Ragione sociale dell'impianto che dichiara, copiata come e' scritta" },
    // Il mese si scrive SOLO se il documento lo dice a parole. Altrimenti resta
    // vuoto e lo ricava il gestionale dalla data di conferimento: se lo deducesse
    // il modello, il riscontro fra mese scritto e data non direbbe piu' niente.
    mese: { type: 'string', description: 'Nome italiano del mese, solo se il documento lo scrive a parole; altrimenti stringa vuota' },
    anno: { type: 'integer', description: "L'anno scritto accanto al mese, se c'e'" },
    quantita_kg: { type: 'number', description: 'Quantita di PFU lavorati o riciclati, in kg' },
    polverino_granulo_kg: { type: 'number', description: 'Peso del polverino e del granulo di gomma in kg, sommati quando il documento li scrive su due righe' },
    fibre_kg: { type: 'number', description: 'Peso delle fibre tessili (prodotti tessili) in kg' },
    metalli_kg: { type: 'number', description: 'Peso dei metalli ferrosi in kg' },
    scarto_kg: { type: 'number', description: 'Peso dello scarto in kg, zero se il documento non lo indica' },
    peso_fir_kg: { type: 'number', description: 'Peso scritto sul formulario (Peso FIR), in kg' },
    ordine: { type: 'string', description: "Numero d'ordine del conferimento, per esempio SEC26093023 oppure ET26116796" },
    formulario: { type: 'string', description: 'Numero del formulario di identificazione del rifiuto (FIR)' },
    ticket_aci: { type: 'array', items: { type: 'string' }, description: 'I ticket del Comitato ACI, uno per voce, nella forma 162529-54' },
    produttore: { type: 'string', description: 'Ragione sociale del produttore del rifiuto scritta sul documento' },
    cer: { type: 'string', description: 'Codice CER o EER, di norma 160103' },
    data_servizio: { type: 'string', description: 'Data del servizio, in AAAA-MM-GG' },
    data_conferimento: { type: 'string', description: "Data in cui i PFU sono stati conferiti all'impianto, in AAAA-MM-GG" },
    data_trattamento: { type: 'string', description: 'Data del trattamento o di avvenuto recupero, in AAAA-MM-GG' },
    granulometria: { type: 'string', description: 'Dimensioni del granulo prodotto, come sono scritte' },
    note: { type: 'string', description: 'Quello che non torna o non si legge sul documento' },
  },
  required: ['impianto', 'quantita_kg', 'polverino_granulo_kg', 'fibre_kg', 'metalli_kg', 'formulario', 'data_conferimento'],
};

const testo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

// I pesi di queste dichiarazioni sono chilogrammi interi, e il separatore delle
// migliaia puo' arrivare come punto o come VIRGOLA: il documento scrive "13.640",
// ma il modello puo' ricopiarlo all'inglese, "13,640".
//
// Leggendo sempre la virgola come decimale, "13,640" diventava 14 kg - mille volte
// meno - e il guaio e' che tutti e quattro i numeri si rimpicciolivano insieme,
// quindi l'unica rete di sicurezza (i tre materiali devono fare la quantita')
// restava soddisfatta: la lettura passava i controlli, prendeva la spunta verde e
// finiva nelle caselle. Su T.R.S. di luglio 13.640 kg diventavano 14.
//
// La regola: un punto o una virgola seguiti da ESATTAMENTE tre cifre separano le
// migliaia. Su una dichiarazione in chili "qualcosa,640" non e' mai un decimale, e
// i decimali veri (",5") restano decimali.
export function numeroKg(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : 0;
  const s = String(v ?? '').replace(/[^0-9,.-]/g, '')
    .replace(/[.,](?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

// Una data scritta su un documento e' un giorno di calendario, non un istante: non
// c'e' nessun fuso da convertire, e giornoRoma qui non serve. Si accettano le
// forme che gli impianti usano davvero - 2026-06-01, 01/06/2026, 01 - 06 - 2026,
// 13/07/26 - perche' il modello a volte ricopia quella del documento invece di
// quella chiesta.
function giorno(v) {
  const s = testo(v);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const mese = Number(m[2]);
    return mese >= 1 && mese <= 12 ? { anno: Number(m[1]), mese, giorno: Number(m[3]) } : null;
  }
  m = s.match(/^(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{2,4})/);
  if (!m) return null;
  const mese = Number(m[2]);
  if (mese < 1 || mese > 12) return null;
  const anno = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
  return { anno, mese, giorno: Number(m[1]) };
}

/** Il giorno di una data letta, in AAAA-MM-GG. Stringa vuota se non e' una data. */
export function giornoLetto(v) {
  const g = giorno(v);
  return g ? `${g.anno}-${String(g.mese).padStart(2, '0')}-${String(g.giorno).padStart(2, '0')}` : '';
}

function indiceMese(v) {
  const s = testo(v).toLowerCase();
  if (!s) return -1;
  const n = Number(s);
  if (Number.isFinite(n) && n >= 1 && n <= 12) return Math.round(n) - 1;
  const esatto = MESI.findIndex(m => m.toLowerCase() === s);
  if (esatto >= 0) return esatto;
  return s.length >= 3 ? MESI.findIndex(m => m.toLowerCase().startsWith(s.slice(0, 3))) : -1;
}

function meseScritto(l) {
  const i = indiceMese(l && l.mese);
  if (i < 0) return null;
  const a = Number(l && l.anno);
  return { mese: MESI[i], anno: Number.isFinite(a) && a > 2000 ? Math.round(a) : null };
}

/**
 * Di che mese e' un documento. Comanda la data di conferimento, che e' la fine del
 * trasporto; se non si legge si ripiega sulla data di servizio, che su tutti i
 * documenti del 2026 coincide con quella di conferimento; per ultimo vale il mese
 * scritto a parole, che e' l'unica cosa che resta quando le date non si leggono.
 *
 * `contrasto` e' vero quando il mese scritto sul documento non e' quello della
 * data: li' una delle due letture e' sbagliata, e si rilegge invece di scegliere.
 */
export function periodoLettura(l) {
  const daConferimento = giorno(l && l.data_conferimento);
  const daServizio = daConferimento ? null : giorno(l && l.data_servizio);
  const data = daConferimento || daServizio;
  const scritto = meseScritto(l);
  let base = { anno: null, mese: '', da: '' };
  if (data) base = { anno: data.anno, mese: MESI[data.mese - 1] || '', da: daConferimento ? 'conferimento' : 'servizio' };
  else if (scritto) base = { anno: scritto.anno, mese: scritto.mese, da: 'scritto' };
  const contrasto = !!(data && scritto && (scritto.mese !== base.mese || (scritto.anno && base.anno && scritto.anno !== base.anno)));
  return { ...base, scritto, contrasto, giorno_conferimento: giornoLetto(l && l.data_conferimento) };
}

// Un ticket ACI e' sei cifre, un trattino e due o tre cifre. Si legge con una
// regola invece di fidarsi di come il modello ha spezzato l'elenco: sui documenti
// veri i separatori sono tutti diversi - "162529 - 54", "162684-15 , 163142-85",
// "158765 - 73;159165 - 85; 159325 - 51;159349 - 75;" - e T.R.S. li scrive di fila
// con lo stesso trattino che separa le cifre ("162611 - 39 - 163144 - 87"). Il
// guardiano sulle cifre ai lati evita di prendere per ticket il CER (160103) o una
// partita IVA.
const FORMATO_TICKET = /(?<![\d-])(\d{6})\s*[-–]\s*(\d{1,3})(?!\d)/g;

/** I ticket ACI letti da una voce o da un elenco, normalizzati e senza doppioni. */
export function ticketAci(valori) {
  const trovati = [];
  for (const v of Array.isArray(valori) ? valori : [valori]) {
    for (const m of String(v ?? '').matchAll(FORMATO_TICKET)) {
      const t = m[1] + '-' + m[2];
      if (!trovati.includes(t)) trovati.push(t);
    }
  }
  return trovati;
}

// Il numero di un formulario si confronta senza spazi e in maiuscolo:
// "CNDJM000335YS" e "cndjm 000335 ys" sono lo stesso documento. Serve solo a
// riconoscere due letture dello stesso conferimento; chi deve spiegare la
// differenza fra due numeri quasi uguali usa descriviDifferenzaFir di
// shared/numeroFir.ts.
const chiaveFir = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// LA STESSA DITTA SI SCRIVE IN DIECI MODI, e un nome diverso non e' di per se' una
// difformita' (regola dell'utente, 01/10/2026): "T .R.S. Tyres Recycling Sud srl"
// e "TRS SRL" sono lo stesso impianto. Qui il nome serve solo a capire se due
// documenti parlano dello stesso impianto, quindi il confronto e' tollerante: via
// la sigla della societa', poi uguaglianza, contenimento o un prefisso comune
// lungo. Se restano diversi non si accusa nessuno: si chiede di controllare.
function chiaveImpianto(v) {
  return String(v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(s\s?r\s?l\s?s?|s\s?p\s?a|s\s?n\s?c|s\s?a\s?s|scrl|societa|cooperativa)\b/g, ' ')
    .replace(/\s+/g, '')
    .trim();
}

/** Vero quando due nomi, scritti come capita, sono lo stesso impianto. */
export function stessoImpianto(a, b) {
  const x = chiaveImpianto(a);
  const y = chiaveImpianto(b);
  if (!x || !y) return x === y;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  return x.length >= 5 && y.length >= 5 && x.slice(0, 5) === y.slice(0, 5);
}

function documentoDi(l, posizione) {
  const periodo = periodoLettura(l);
  const quantita = numeroKg(l.quantita_kg);
  const polverino = numeroKg(l.polverino_granulo_kg);
  const fibre = numeroKg(l.fibre_kg);
  const metalli = numeroKg(l.metalli_kg);
  const scarto = numeroKg(l.scarto_kg);
  const materiali = polverino + fibre + metalli + scarto;
  return {
    file: testo(l.file) || `documento ${posizione + 1}`,
    impianto: testo(l.impianto),
    anno: periodo.anno,
    mese: periodo.mese,
    mese_da: periodo.da,
    ordine: testo(l.ordine).toUpperCase(),
    formulario: testo(l.formulario).toUpperCase(),
    ticket_aci: ticketAci(l.ticket_aci),
    produttore: testo(l.produttore),
    cer: testo(l.cer),
    data_conferimento: giornoLetto(l.data_conferimento),
    data_servizio: giornoLetto(l.data_servizio),
    data_trattamento: giornoLetto(l.data_trattamento),
    quantita_kg: quantita,
    polverino_granulo_kg: polverino,
    fibre_kg: fibre,
    metalli_kg: metalli,
    scarto_kg: scarto,
    peso_fir_kg: numeroKg(l.peso_fir_kg),
    somma_materiali_kg: materiali,
    quadra: quantita > 0 && materiali === quantita,
    doppione: false,
  };
}

/**
 * Tutti i controlli che si possono fare su UNA lettura senza guardare altro che il
 * documento. `problemi` sono frasi in italiano pronte da rimandare al modello per
 * la rilettura: dicono che cosa non torna e dove guardare, perche' e' quello che
 * farebbe una persona a riprendere in mano il foglio sapendo dov'e' l'errore.
 */
export function controllaLettura(l) {
  if (!l || typeof l !== 'object') {
    return { ok: false, problemi: ['Del documento non è arrivata nessuna lettura.'] };
  }
  const problemi = [];
  if (!testo(l.impianto)) {
    problemi.push("Non si legge quale impianto dichiara: il nome della società che firma sta nell'intestazione e dentro la frase «in qualità di legale rappresentante della società».");
  }
  // SENZA IL FORMULARIO LA LETTURA NON E' GUARDABILE: e' il numero su cui si
  // riconosce un documento allegato due volte, ed e' stampato su tutti e quattro i
  // modelli. Senza, la lettura passava e il doppione non si vedeva piu'.
  if (!testo(l.formulario)) {
    problemi.push('Non si legge il numero del formulario (FIR). Sta nella tabella in alto, colonna «Nr.Formulario», e nei modelli di Tecnogum e Green Tyre nella frase del conferimento: senza quel numero non si riconosce lo stesso documento allegato due volte.');
  }
  // E SENZA LA DATA DI CONFERIMENTO NON SI SA DI CHE MESE E'. Il periodo di un
  // movimento e' la fine del trasporto, mai altro: ripiegare sulla data di servizio
  // - che nel modello GATIM/T.R.S. e' una colonna diversa - metterebbe un
  // conferimento del 1 giugno sul mese di maggio, in silenzio.
  if (!testo(l.data_conferimento)) {
    problemi.push('Non si legge la data di conferimento, cioè il giorno in cui i PFU sono arrivati all\'impianto («Data Conf.», «accettato in ingresso il», «DATA CONFERIMENTO»). È da quella che si ricava il mese della dichiarazione, e non si sostituisce con la data di servizio né con quella del trattamento.');
  }

  const q = numeroKg(l.quantita_kg);
  const polverino = numeroKg(l.polverino_granulo_kg);
  const fibre = numeroKg(l.fibre_kg);
  const metalli = numeroKg(l.metalli_kg);
  const scarto = numeroKg(l.scarto_kg);
  const negativi = [
    [q, 'la quantità di PFU lavorati'], [polverino, 'il polverino/granulo di gomma'],
    [fibre, 'le fibre tessili'], [metalli, 'i metalli ferrosi'], [scarto, 'lo scarto'],
  ].filter(([v]) => v < 0);
  for (const [v, nome] of negativi) {
    problemi.push(`Un peso risulta negativo: ${nome}, ${formatoKg(v)} kg. Su una dichiarazione non ci sono pesi negativi: è un segno meno letto dove non c'era.`);
  }
  if (q <= 0) {
    problemi.push('La quantità di PFU lavorati risulta zero. Una dichiarazione la dice sempre, e la dice due volte: nella tabella in alto (Peso FIR, Q.tà Tratt.) e fra i dati del processo di riciclo in basso.');
  }
  const materiali = polverino + fibre + metalli + scarto;
  if (q > 0 && materiali !== q) {
    const pezzi = [
      `polverino/granulo ${formatoKg(polverino)}`,
      `fibre tessili ${formatoKg(fibre)}`,
      `metalli ferrosi ${formatoKg(metalli)}`,
    ];
    if (scarto !== 0) pezzi.push(`scarto ${formatoKg(scarto)}`);
    problemi.push(`I materiali non fanno la quantità lavorata: ${pezzi.join(' + ')} = ${formatoKg(materiali)} kg, mentre la quantità di PFU lavorati letta è ${formatoKg(q)} kg, cioè ${formatoKg(Math.abs(materiali - q))} kg di differenza. Su queste dichiarazioni la somma torna sempre esatta, al chilo: uno di questi numeri è stato letto male, rileggili tutti sul documento.`);
  }

  const periodo = periodoLettura(l);
  if (!periodo.mese) {
    problemi.push("Non si capisce di che mese è il documento: manca la data di conferimento, cioè il giorno in cui i PFU sono arrivati all'impianto (Data Conf., «accettato in ingresso il», DATA CONFERIMENTO).");
  } else if (periodo.contrasto) {
    const scritto = `${periodo.scritto.mese}${periodo.scritto.anno ? ' ' + periodo.scritto.anno : ''}`;
    problemi.push(`Il mese scritto sul documento (${scritto}) non è quello della data di conferimento (${periodo.mese}${periodo.anno ? ' ' + periodo.anno : ''}): una delle due letture è sbagliata. Ricontrolla sia il mese scritto sia la data in cui i PFU sono arrivati all'impianto.`);
  }
  return { ok: problemi.length === 0, problemi };
}

const sommaDi = (documenti, campo) => documenti.reduce((s, d) => s + (Number(d[campo]) || 0), 0);
const descriviGruppo = (g) => `${g.impianto || 'impianto non letto'} ${g.mese || 'mese non letto'}${g.anno ? ' ' + g.anno : ''} (${g.documenti.map(d => d.file).join(', ')})`;

/**
 * Somma i documenti di un mese: piu' dichiarazioni dello STESSO impianto e dello
 * STESSO mese fanno il quantitativo mensile (Gatim giugno 2026: tre documenti,
 * 11.340 kg).
 *
 * SE I DOCUMENTI NON SONO DI UN SOLO IMPIANTO E DI UN SOLO MESE NON SI SOMMANO. Un
 * totale fatto mescolando due mesi o due impianti sarebbe plausibile e falso, e
 * finirebbe nella scheda di uno dei due: meglio zero e una frase che dice come
 * sono divisi. I canali, poi, non si sommano mai - ma il canale non sta scritto sul
 * documento: lo sa la scheda da cui si parte, e chi chiama lo confronta.
 */
export function unisciLetture(letture) {
  const elenco = (Array.isArray(letture) ? letture : []).filter(l => l && typeof l === 'object');
  const documenti = elenco.map(documentoDi);
  const problemi = [];
  const ticketTutti = ticketAci(documenti.flatMap(d => d.ticket_aci));
  const vuoto = {
    impianto: '', anno: null, mese: '',
    quantita_kg: 0, polverino_granulo_kg: 0, fibre_kg: 0, metalli_kg: 0, scarto_kg: 0, somma_materiali_kg: 0,
  };

  if (!documenti.length) {
    return { ...vuoto, sommato: false, documenti, ticket_aci: [], gruppi: [], problemi: ['Non è arrivato nessun documento da unire.'] };
  }

  // I gruppi si calcolano sempre, anche quando ce n'e' uno solo: sono la frase con
  // cui si spiega all'utente come dividere il lavoro.
  const gruppi = [];
  for (const d of documenti) {
    const g = gruppi.find(x => x.anno === d.anno && x.mese === d.mese && stessoImpianto(x.impianto, d.impianto));
    if (g) g.documenti.push(d);
    else gruppi.push({ impianto: d.impianto, anno: d.anno, mese: d.mese, documenti: [d] });
  }
  if (gruppi.length > 1) {
    problemi.push(`I documenti non sono tutti dello stesso impianto e dello stesso mese, quindi non sono stati sommati: ${gruppi.map(descriviGruppo).join('; ')}. Una dichiarazione mensile riguarda un impianto e un mese: leggi un gruppo per volta.`);
    return { ...vuoto, sommato: false, documenti, ticket_aci: ticketTutti, gruppi, problemi };
  }

  // LO STESSO FORMULARIO SULLO STESSO ORDINE E' UN DOCUMENTO CONTATO DUE VOLTE, e
  // nel totale si conta una volta sola: duplicare un peso e' silenzioso e si porta
  // dietro ogni conto a valle, perderlo e' rumoroso e si rimedia riallegando il
  // file. Lo stesso formulario su DUE ORDINI diversi, invece, e' normale e non si
  // tocca: e' il carico che ha sforato il 10% del primo ticket e che il portale ha
  // ripartito su un secondo ordine (Tecnogum SEC26104994, ticket 162684-15 e
  // 163142-85). Li' i pesi si sommano per davvero.
  // IL TICKET ACI E' LA CHIAVE, NON IL FORMULARIO.
  //
  // Un ticket ACI identifica un conferimento e non si ripete: due documenti che
  // portano gli stessi ticket sono lo stesso documento, anche se il modello ha
  // letto l'ordine o il formulario in due modi (basta un carattere: 'SEC26019148'
  // contro '003 SEC26019148', o un 5 al posto di una S). Senza i ticket nella
  // chiave, lo stesso PDF allegato due volte raddoppiava il mese - 24.560 kg al
  // posto di 12.280 - e nessun problema lo diceva.
  //
  // E vale al contrario: i documenti GATIM non stampano l'ordine, quindi due quote
  // dello STESSO formulario su due ordini diversi - il carico che ha sforato il 10%
  // del primo ticket - avevano la stessa chiave e la seconda spariva dal totale.
  // Coi ticket si distinguono, perche' i loro ticket sono diversi.
  const visti = new Map();
  for (const d of documenti) {
    if (!d.formulario && !(d.ticket_aci || []).length) continue;
    const chiave = (d.ticket_aci || []).length
      ? 'T:' + [...d.ticket_aci].sort().join(';')
      : 'F:' + chiaveFir(d.formulario) + '|' + d.ordine;
    if (visti.has(chiave)) {
      d.doppione = true;
      problemi.push(chiave.startsWith('T:')
        ? `I ticket ACI ${(d.ticket_aci || []).join(', ')} compaiono su due documenti («${visti.get(chiave)}» e «${d.file}»): un ticket è un conferimento solo, quindi è lo stesso documento e nel totale è contato una volta sola. Se non lo è, su uno dei due i ticket sono stati letti male.`
        : `Il formulario ${d.formulario}${d.ordine ? `, ordine ${d.ordine}` : ''} compare su due documenti («${visti.get(chiave)}» e «${d.file}») e su nessuno dei due si leggono i ticket ACI: lo conto una volta sola. Controlla i due documenti, perché senza i ticket non si distingue lo stesso conferimento da due quote dello stesso formulario.`);
      continue;
    }
    visti.set(chiave, d.file);
  }
  // Due documenti che CONDIVIDONO qualche ticket ma non tutti non si sommano e non
  // si scartano: non si sa che cosa siano, e lo si dice. Un ticket ripetuto fra
  // documenti diversi e' sempre qualcosa da guardare prima di salvare.
  const diChi = new Map();
  for (const d of documenti) {
    for (const t of d.ticket_aci || []) {
      if (diChi.has(t) && diChi.get(t) !== d.file && !d.doppione) {
        problemi.push(`Il ticket ACI ${t} compare sia su «${diChi.get(t)}» sia su «${d.file}», ma i due documenti non portano gli stessi ticket: uno dei due è stato letto male, oppure uno dei due non è di questo mese. Guardali prima di salvare.`);
      }
      if (!diChi.has(t)) diChi.set(t, d.file);
    }
  }

  const buoni = documenti.filter(d => !d.doppione);
  const totale = {
    impianto: gruppi[0].impianto,
    anno: gruppi[0].anno,
    mese: gruppi[0].mese,
    quantita_kg: sommaDi(buoni, 'quantita_kg'),
    polverino_granulo_kg: sommaDi(buoni, 'polverino_granulo_kg'),
    fibre_kg: sommaDi(buoni, 'fibre_kg'),
    metalli_kg: sommaDi(buoni, 'metalli_kg'),
    scarto_kg: sommaDi(buoni, 'scarto_kg'),
  };
  totale.somma_materiali_kg = totale.polverino_granulo_kg + totale.fibre_kg + totale.metalli_kg + totale.scarto_kg;
  if (totale.somma_materiali_kg !== totale.quantita_kg) {
    problemi.push(`Nel totale del mese i materiali non fanno la quantità: ${formatoKg(totale.somma_materiali_kg)} kg contro ${formatoKg(totale.quantita_kg)} kg. Viene da un documento la cui somma non torna: guarda quale non quadra prima di salvare.`);
  }
  if (!totale.mese) {
    problemi.push('Da questi documenti non si ricava il mese: lo deve scegliere chi salva.');
  }
  // `sommato` dice se il totale vale qualcosa: con documenti di mesi o impianti
  // diversi non si somma niente, e un riscontro calcolato su quello zero direbbe
  // «mancano 3.930 kg» mentre il documento di giugno e' allegato e quadra.
  return { ...totale, sommato: gruppi.length === 1, documenti, ticket_aci: ticketTutti, gruppi, problemi };
}

/**
 * Il riscontro col gestionale: quello che gli impianti dichiarano per un mese deve
 * fare il conferito di quel mese. Sull'ACI il dichiarato e' uguale al conferito AL
 * CHILO - in tutte le dichiarazioni del 2026, su tutti e quattro gli impianti -
 * perche' si dichiara quello che e' arrivato, non quello che si e' lavorato della
 * giacenza come sulla rete. Percio' la tolleranza e' zero: uno scarto e' sempre
 * qualcosa da guardare, e quasi sempre e' un documento che manca.
 *
 * Il conferito lo passa chi chiama, perche' il gestionale lo sa gia' e questa
 * funzione non legge nessun archivio.
 */
export function riscontroConferito(totale_kg, conferito_kg) {
  const totale = numeroKg(totale_kg);
  if (conferito_kg === null || conferito_kg === undefined || conferito_kg === '') {
    return { torna: null, scarto_kg: null, testo: `Sui documenti ci sono ${formatoKg(totale)} kg. Il conferito del mese non è stato passato, quindi il riscontro con il gestionale non è stato fatto.` };
  }
  const conferito = numeroKg(conferito_kg);
  const scarto = totale - conferito;
  if (scarto === 0) {
    return { torna: true, scarto_kg: 0, testo: `I ${formatoKg(totale)} kg dei documenti coincidono al chilo con i ${formatoKg(conferito)} kg conferiti nel mese.` };
  }
  if (scarto < 0) {
    return {
      torna: false,
      scarto_kg: scarto,
      testo: `Sui documenti ci sono ${formatoKg(totale)} kg, ma nel mese sono stati conferiti ${formatoKg(conferito)} kg: mancano ${formatoKg(-scarto)} kg. Di solito è una dichiarazione che l'impianto non ha ancora mandato, o un documento che non è stato allegato.`,
    };
  }
  return {
    torna: false,
    scarto_kg: scarto,
    testo: `Sui documenti ci sono ${formatoKg(totale)} kg contro i ${formatoKg(conferito)} kg conferiti nel mese: ${formatoKg(scarto)} kg in più. Controlla che nessun documento sia allegato due volte e che nessuno appartenga a un altro mese o a un altro canale.`,
  };
}
