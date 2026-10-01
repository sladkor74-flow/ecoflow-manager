// IL CONSUNTIVO DI CHIUSURA MESE DI UN FORNITORE, CONFRONTATO CON I NOSTRI DATI.
//
// Richiesta dell'utente (29/09/2026): si caricano i report definitivi a consuntivo
// con cui i fornitori chiudono il mese, se ne verifica l'esattezza - sulla raccolta
// se e' un raccoglitore, sui conferimenti ricevuti se e' un impianto o uno
// stoccaggio, sui trasporti effettuati se e' un trasportatore di secondarie - si
// stima il costo che sara' loro dovuto e lo si confronta con la fatturazione
// passiva, dichiarando la quadratura o le difformita'.
//
// E' UN REPORT LORO, NON UNA FATTURA (decisione dell'utente, 29/09/2026): si
// confrontano righe, formulari e chili, e accanto ci si mette l'importo previsto
// dalle tariffe. Non c'e' IVA, non c'e' imponibile, e non si pretende che il totale
// coincida con quello di una fattura: dal conto della passiva restano fuori per
// costruzione le terziarie, gli oneri fissi dell'extra raccolta e il trasporto
// delle secondarie di extra raccolta.
//
// TRE RUOLI, TRE BASI DIVERSE. Lo stesso soggetto puo' averne piu' di uno - chi
// raccoglie e ha anche il piazzale - e in quel caso i suoi consuntivi sono due,
// perche' due sono le prestazioni che ci fattura:
//   raccoglitore  -> le primarie che ha RACCOLTO (trasportatore del formulario);
//   impianto      -> tutto cio' che gli e' ARRIVATO, primarie e secondarie;
//   trasportatore -> le secondarie che ha PORTATO da un piazzale a un impianto.
//
// UN CANALE PER VOLTA (regola 3) e la FINE TRASPORTO come periodo (regola 1): un
// carico e' del mese in cui il camion ha finito, non di quello in cui il portale ha
// chiuso l'ordine giorni dopo.
import { eTerminato, giornoMovimento, canaleMovimento } from "./movimenti.ts";
import { contaFormulari, chiaveFormulario } from "./formulari.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { comeOrdine, comeNumero, comeGiorno } from "./prefattura.ts";
import { mappaFatturazione, fatturaA } from "./subfornitori.ts";

const kgTondi = (v) => Math.round(Number(v) || 0);
const pulisci = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const centesimi = (v) => Math.round((Number(v) || 0) * 100);

/** I ruoli con cui un fornitore ci fattura, e che cosa si guarda per ciascuno. */
export const RUOLI_CONSUNTIVO = [
  { chiave: 'raccoglitore', nome: 'Raccoglitore', base: 'le primarie che ha raccolto' },
  { chiave: 'impianto', nome: 'Impianto o stoccaggio', base: 'tutto quello che gli e\' arrivato, primarie e secondarie' },
  { chiave: 'trasportatore', nome: 'Trasportatore di secondarie', base: 'le secondarie che ha portato' },
];

/**
 * Il numero di formulario, confrontabile: "RG YTR-0226" e "RGYTR0226" sono lo
 * stesso. Una parola senza cifre non e' un formulario: "TOTALE" in fondo a una
 * colonna diventava una riga del consuntivo con quel nome, invece di essere
 * riconosciuta come la riga dei totali e contata fra quelle non abbinabili.
 */
export const chiaveFir = (v) => {
  const t = pulisci(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/[0-9]/.test(t)) return '';
  // E NON BASTA UNA CIFRA. Nel consuntivo di LOGISTICA & PNEUMATICI, in fondo al
  // foglio, c'e' una tabella coi costi per zona e le tariffe al chilo: 0,068 -
  // 0,071 - 0,072. Normalizzate diventavano "0068", "0071", "0072", e il
  // gestionale le presentava come tre formulari che il fornitore ci fatturava e
  // noi non avevamo. Un formulario ha delle LETTERE (RTXZV001718KR,
  // HTQKS000785VB); se e' tutto cifre, ne ha almeno otto.
  if (/[A-Z]/.test(t)) return t.length >= 4 ? t : '';
  return t.length >= 8 ? t : '';
};

/**
 * LE CHIAVI con cui una riga si puo' riconoscere: il formulario E l'ordine, non
 * uno solo.
 *
 * La prima stesura sceglieva il formulario e, in mancanza, l'ordine. Ma i nostri
 * movimenti il formulario ce l'hanno sempre, mentre il consuntivo di un fornitore
 * a volte porta solo il numero d'ordine: le due chiavi non si incontravano mai e
 * usciva il 100% di difformita', con gli stessi chili accusati due volte in versi
 * opposti. Tenendole tutte e due, si abbinano le righe che parlano dello stesso
 * carico comunque siano scritte.
 */
/**
 * UN NUMERO D'ORDINE DEVE SOMIGLIARE A UN NUMERO D'ORDINE.
 *
 * comeOrdine si limita a togliere spazi e punti e a fare il maiuscolo: qualunque
 * scritta, per lei, e' un numero d'ordine valido. In un consuntivo vero
 * (LOGISTICA & PNEUMATICI, agosto 2026) questo ha fatto diventare "carichi che il
 * fornitore ci fattura" l'intestazione di una colonna - "PR (PROVINCIA UNITA'
 * LOCALE PRODUTTORE)" - la sigla di una provincia, "AV", e un pezzo di ragione
 * sociale, "NAPPI". Venti difformita' inventate su un file che nessuno aveva
 * letto male: le aveva lette il gestionale.
 *
 * Un ordine ha almeno una CIFRA e almeno quattro caratteri. Non si pretende il
 * formato nostro (ET26125844), perche' il numero lo scrive il fornitore come
 * vuole: si pretende solo che non sia una parola.
 */
export const pareOrdine = (v) => {
  const t = comeOrdine(v);
  return t.length >= 4 && /[0-9]/.test(t) ? t : '';
};

export function chiaviRiga(r) {
  const out = [];
  const fir = chiaveFir(r && (r.numero_fir || r.fir));
  if (fir) out.push(`FIR:${fir}`);
  const ord = pareOrdine((r && (r.id_ordine || r.ordine)) || '');
  if (ord) out.push(`ORD:${ord}`);
  return out;
}

/** La chiave principale di una riga, per darle un nome a video. */
export const chiaveRiga = (r) => chiaviRiga(r)[0] || '';

// QUANTO UN'INTESTAZIONE SOMIGLIA A OGNI COLONNA CHE CI SERVE.
//
// Prima era un elenco di regex e vinceva LA PRIMA che corrispondeva. Su 75
// consuntivi veri dei fornitori (cartella FATTURAZIONE, 2026) quella regola
// sbagliava su nove file di GATIM e TRS: la loro colonna si chiama
//   "Data Doc. (Data Documento)"
// e la regex del formulario cercava anche "documento", quindi la DATA veniva
// presa come numero di formulario. Il formulario vero, nella colonna
// "Rif.Docum. (Riferimento Documento)", restava fuori. Risultato: ogni riga con
// una chiave inventata, nessun abbinamento, consuntivo tutto in difformita'.
//
// Adesso ogni intestazione prende un punteggio per ogni colonna e vince il
// punteggio piu' alto, non l'ordine della lista. Cosi' "Data Documento" e' una
// DATA (10) prima che un documento (4), e "Rif.Docum." e' un formulario (8)
// prima che niente. Non si pretende nessuna colonna: un report di un
// raccoglitore puo' avere solo il formulario e i chili, ed e' il caso normale.
const PUNTEGGI_INTESTAZIONE = {
  // "Num.Fiscale (Numerazione Fiscale)" e' come GATIM chiama il formulario nel suo
  // export: i valori sono formulari veri (HTQKS000785VB). Nessuno lo avrebbe
  // indovinato leggendo solo la parola.
  numero_fir: [[/formulario|\bfir\b|num\.?\s*fiscale|numerazione\s*fiscale/i, 10], [/rif\.?\s*docum/i, 8], [/\bddt\b/i, 6], [/documento/i, 4]],
  id_ordine: [[/\bordine\b|n\.?\s*ordine/i, 10], [/ticket/i, 8], [/\bordn?\b/i, 6]],
  kg: [[/p\.?\s*netto|peso\s*netto|netto\s*in\s*kg/i, 10], [/\bpeso\b|\bkg\b|tonnell/i, 8], [/quantit|q\.?t[aà]/i, 4]],
  giorno: [[/\bdata\b|\bdt\b|giorno/i, 10]],
  // "Totale" non c'e' apposta: una colonna che si chiama cosi' puo' essere un
  // totale di chili come di euro, e un importo sbagliato e' peggio di un importo
  // mancante (il verdetto dice "non si e' potuto controllare l'importo").
  importo: [[/importo|imponibile|corrispettivo/i, 10], [/\bvalore\b|\beuro\b|€/i, 6]],
};

const CAMPI_INTESTAZIONE = ['numero_fir', 'id_ordine', 'kg', 'giorno', 'importo'];

/** Quanto questa intestazione somiglia a quella colonna. 0 = per niente. */
export function punteggioIntestazione(campo, testo) {
  let max = 0;
  for (const [re, p] of (PUNTEGGI_INTESTAZIONE[campo] || [])) if (re.test(testo)) max = Math.max(max, p);
  return max;
}

/**
 * Le colonne riconosciute in una riga di intestazioni: ogni cella va alla colonna
 * a cui somiglia di piu', e di ogni colonna si tiene la cella che le somiglia di
 * piu'. A pari punteggio vince quella piu' a sinistra.
 */
export function colonneDaIntestazioni(celle) {
  const scelte = {};
  (celle || []).forEach((c, j) => {
    const testo = pulisci(c);
    if (!testo || comeNumero(testo) !== null) return;
    let campoMigliore = '', punti = 0;
    for (const campo of CAMPI_INTESTAZIONE) {
      const p = punteggioIntestazione(campo, testo);
      if (p > punti) { punti = p; campoMigliore = campo; }
    }
    if (!campoMigliore) return;
    const gia = scelte[campoMigliore];
    if (!gia || punti > gia.punti) scelte[campoMigliore] = { j, testo, punti };
  });
  return scelte;
}

// Un formulario: lettere e cifre, almeno otto, con almeno una cifra. Serve a
// riconoscere la colonna quando le intestazioni non aiutano.
const PARE_FIR = (v) => { const t = chiaveFir(v); return t.length >= 8 && /[0-9]/.test(t) && /[A-Z]/.test(t); };

/**
 * LE RIGHE DI UN CONSUNTIVO, lette da un foglio.
 *
 * Il consuntivo di un fornitore NON e' la prefattura del portale: puo' non avere
 * nessun numero d'ordine, e pretenderlo - come faceva la prima stesura, che riusava
 * il lettore della prefattura - voleva dire non riuscire a caricare il documento
 * tipico, quello con formulario e chili.
 *
 * Le colonne si riconoscono dall'intestazione e, quando l'intestazione non basta,
 * dalla forma dei valori. Quello che NON si e' riusciti a leggere si dice: una riga
 * saltata in silenzio sono chili che spariscono.
 */
export function leggiRigheConsuntivo(tabelle) {
  const righe = [];
  const note = [];
  const colonneLette = [];
  let scartate = 0;
  // L'imponibile che il fornitore si aspetta, dal riquadro dei costi in fondo.
  let importoTotale = null;

  for (const { nome, celle } of tabelle || []) {
    const t = celle || [];
    if (importoTotale === null) { const tot = importoTotaleDalFoglio(t); if (tot) importoTotale = tot; }
    let iTesta = -1;
    let col = {};
    for (let i = 0; i < Math.min(40, t.length); i++) {
      const trovate = colonneDaIntestazioni(t[i]);
      // Basta il formulario, o l'ordine, piu' qualcosa che somigli a un peso.
      if ((trovate.numero_fir || trovate.id_ordine) && trovate.kg) { iTesta = i; col = trovate; break; }
    }

    const corpo = iTesta >= 0 ? t.slice(iTesta + 1) : t;
    // Se le intestazioni non bastano, si guarda la forma dei valori: la colonna coi
    // piu' valori che paiono formulari, e quella coi piu' numeri che paiono chili.
    if (!col.numero_fir && !col.id_ordine) {
      const contaFir = new Map(), contaOrd = new Map();
      for (const r of corpo) (r || []).forEach((c, j) => {
        if (PARE_FIR(c)) contaFir.set(j, (contaFir.get(j) || 0) + 1);
        if (comeOrdine(c)) contaOrd.set(j, (contaOrd.get(j) || 0) + 1);
      });
      const meglio = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0];
      const f = meglio(contaFir), o = meglio(contaOrd);
      if (f) col.numero_fir = { j: f[0], testo: '(riconosciuta dai valori)' };
      if (o && (!f || o[0] !== f[0])) col.id_ordine = { j: o[0], testo: '(riconosciuta dai valori)' };
      if (!col.kg) {
        const contaNum = new Map();
        for (const r of corpo) (r || []).forEach((c, j) => {
          if (j === (col.numero_fir && col.numero_fir.j) || j === (col.id_ordine && col.id_ordine.j)) return;
          const n = comeNumero(c);
          if (n !== null && n > 0) contaNum.set(j, (contaNum.get(j) || 0) + 1);
        });
        const k = meglio(contaNum);
        if (k) col.kg = { j: k[0], testo: '(riconosciuta dai valori)' };
      }
    }

    if (!col.numero_fir && !col.id_ordine) {
      note.push(`Foglio "${nome}": non ho trovato nessuna colonna con i formulari o i numeri d'ordine, saltato.`);
      continue;
    }
    colonneLette.push({
      foglio: nome,
      colonne: Object.fromEntries(Object.entries(col).map(([k, v]) => [k, v.testo])),
    });

    // LE INTESTAZIONI PROPONGONO, I VALORI DECIDONO.
    //
    // Un'intestazione la scrive una persona e puo' chiamarsi come le pare: il
    // formulario di GATIM sta sotto "Num.Fiscale (Numerazione Fiscale)", quello di
    // TECNOGUM sotto "Rif.Docum.", quello di NAPPI sotto "NUM. DI FORMULARIO". Un
    // vocabolario non bastera' mai. I VALORI invece hanno una forma riconoscibile:
    // un formulario e' una sigla di lettere e cifre. Quindi, trovata la colonna
    // dall'intestazione, si guarda se dentro ci sono davvero dei formulari; se un'
    // altra colonna ne ha molti di piu', si cambia idea e si dice perche'.
    const colonnaPiuFormulari = () => {
      const conta = new Map();
      for (const r of corpo) (r || []).forEach((c, j) => { if (PARE_FIR(c)) conta.set(j, (conta.get(j) || 0) + 1); });
      const migliore = [...conta.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
      return migliore ? { j: migliore[0], quanti: migliore[1] } : null;
    };
    if (col.numero_fir) {
      const scelta = col.numero_fir.j;
      const quantiScelti = corpo.reduce((s, r) => s + (PARE_FIR((r || [])[scelta]) ? 1 : 0), 0);
      const meglio = colonnaPiuFormulari();
      // Si cambia solo se l'altra ne ha almeno il doppio e almeno tre: una
      // differenza piccola puo' essere una colonna con qualche cella vuota.
      if (meglio && meglio.j !== scelta && meglio.quanti >= 3 && meglio.quanti >= quantiScelti * 2) {
        note.push(`Foglio "${nome}": l'intestazione "${col.numero_fir.testo}" diceva di essere la colonna dei formulari, ma dentro ne ha ${quantiScelti}; la colonna accanto ne ha ${meglio.quanti}, e ho usato quella. Controlla che sia giusta.`);
        col.numero_fir = { j: meglio.j, testo: `(scelta dai valori, l'intestazione diceva "${col.numero_fir.testo}")`, punti: 0 };
      }
    }

    // SE L'INTESTAZIONE NON SI E' TROVATA, TUTTO IL RESTO E' UN INDOVINELLO.
    // Senza riga d'intestazione si legge il foglio dalla prima riga e si tirano a
    // indovinare le colonne dalla forma dei valori: e' cosi' che i titoli delle
    // colonne sono finiti fra i carichi. Va detto, perche' cambia quanto ci si
    // puo' fidare di tutto quello che viene dopo.
    if (iTesta < 0) {
      note.push(`Foglio "${nome}": non ho trovato la riga delle intestazioni, quindi ho riconosciuto le colonne dalla forma dei valori. Controlla qui sotto quali ho usato: se ho sbagliato colonna, l'esito non vale niente.`);
    }

    const prendi = (r, c) => (c && c.j >= 0 ? r[c.j] : null);
    for (const r of corpo) {
      const riga = r || [];
      const fir = pulisci(prendi(riga, col.numero_fir));
      const ord = pulisci(prendi(riga, col.id_ordine));
      if (!chiaveFir(fir) && !pareOrdine(ord)) { if (riga.some(c => pulisci(c))) scartate++; continue; }
      const kgLetti = comeNumero(prendi(riga, col.kg));
      // Un peso in tonnellate si riconosce dall'ordine di grandezza: un carico di
      // PFU pesa migliaia di chili, non tre.
      const kg = kgLetti === null ? 0 : (kgLetti > 0 && kgLetti < 200 ? kgLetti * 1000 : kgLetti);
      righe.push({
        numero_fir: fir,
        id_ordine: ord,
        kg: Math.round(kg),
        importo: col.importo ? comeNumero(prendi(riga, col.importo)) : null,
        giorno: col.giorno ? comeGiorno(prendi(riga, col.giorno)) : '',
      });
    }
  }

  if (scartate) note.push(`${scartate} righe non avevano ne' un formulario ne' un numero d'ordine leggibile: non si possono abbinare e non sono state lette.`);
  return { righe, note, colonne: colonneLette, scartate, importo_totale: importoTotale };
}

/**
 * L'IMPONIBILE CHE IL FORNITORE SI ASPETTA, DALLA TABELLA IN FONDO AL FOGLIO.
 *
 * Quasi tutti i consuntivi, dopo le righe, portano un riquadro con i costi: zona
 * di trasporto, chili, tariffa al chilo, imponibile. Quello di LOGISTICA &
 * PNEUMATICI di agosto 2026 finisce cosi':
 *
 *   ZONA DI TRASPORTO | KG TOTALI | TARIFFA AL KG | IMPONIBILE | TOTALE IVATO
 *   NAPOLI/SALERNO    |    30.860 |         0,068 |   2.098,48 |     2.560,15
 *   CASERTA           |    14.760 |         0,072 |   1.062,72 |     1.296,52
 *   TOTALI            |    45.620 |               |   3.161,20 |     3.856,66
 *
 * Quei 3.161,20 sono il numero da confrontare con l'importo che il gestionale
 * calcola dalle tariffe (e che per quel mese faceva 3.161,20 al centesimo). Senza
 * leggerlo, il verdetto diceva "non si e' potuto controllare l'importo" su un
 * documento che l'importo ce l'aveva scritto in fondo.
 *
 * Si cerca una riga che dica TOTALE/TOTALI e si prende il numero che sta sotto la
 * colonna dell'imponibile, non quello dell'IVA: l'IVA qui non c'entra, il
 * consuntivo non e' una fattura. Se non si trova niente, null.
 */
export function importoTotaleDalFoglio(celle) {
  const t = celle || [];
  for (let i = t.length - 1; i >= 0; i--) {
    const riga = t[i] || [];
    const haTotale = riga.some(c => /^totali?$/i.test(pulisci(c)));
    if (!haTotale) continue;
    // L'intestazione del riquadro sta nelle righe appena sopra.
    for (let k = i - 1; k >= Math.max(0, i - 8); k--) {
      const testa = t[k] || [];
      const j = testa.findIndex(c => /imponibile|^importo$/i.test(pulisci(c)));
      if (j < 0) continue;
      const n = comeNumero(riga[j]);
      if (n !== null && n > 0) return { importo: n, riga: i + 1, colonna: pulisci(testa[j]) };
    }
  }
  return null;
}

/**
 * LE RIGHE DI TOTALE NON SONO CARICHI.
 *
 * Quasi tutti i consuntivi finiscono con i totali (parole dell'utente,
 * 30/09/2026: "riga per riga ovvero formulario per formulario e poi i totali alla
 * fine come sono quasi tutti i report che mi inviano"). Se una riga di totale
 * porta anche un numero di formulario - capita, e' l'ultimo della lista - diventa
 * un carico da decine di tonnellate che noi non abbiamo. Nel consuntivo di
 * LOGISTICA & PNEUMATICI sono uscite due righe cosi', da 35.620 e 89.180 kg,
 * mentre i carichi veri di quel fornitore stanno fra 3.400 e 4.500 kg.
 *
 * Non si cancellano: si SEGNALANO. Cancellare una riga perche' e' grossa vorrebbe
 * dire poter perdere un carico vero e grosso, e su un documento che autorizza una
 * fattura non si butta via niente in silenzio.
 *
 * Il metro e' il carico piu' pesante che abbiamo NOI in quel mese: un totale sta
 * sopra la somma di piu' carichi, un carico singolo no. Senza nostri movimenti
 * non si giudica: non si avrebbe nessun metro.
 */
export function righeCheParonoTotali(righe, movimenti, { volte = 3 } = {}) {
  const nostri = (movimenti || []).map(m => Math.abs(Number(m.peso_effettivo) || 0)).filter(k => k > 0);
  if (!nostri.length) return [];
  const massimo = Math.max(...nostri);
  const soglia = massimo * volte;
  return (righe || [])
    .filter(r => r && Number(r.kg) > soglia)
    .map(r => ({ chiave: chiaveRiga(r) || pulisci(r.id_ordine), kg: Math.round(Number(r.kg)), massimo_nostro: Math.round(massimo) }));
}

const MESI_NOME = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/**
 * IL FILE PARLA DI UN ALTRO MESE?
 *
 * Successo davvero il 30/09/2026: "LOG&PNEUM - settembre2026.xlsx" caricato nel
 * consuntivo di AGOSTO. I nostri movimenti erano agosto, il file era settembre, e
 * naturalmente non si abbinava niente. Il gestionale aveva il nome del file sotto
 * gli occhi e ha risposto elencando venti difformita', invece di dire la cosa
 * semplice: stai confrontando due mesi diversi.
 *
 * Si guardano due indizi, e nessuno dei due blocca: dicono soltanto di guardare.
 *   - il NOME del file, se contiene un nome di mese diverso da quello scelto;
 *   - le DATE delle righe, se la maggior parte cade fuori dal mese.
 *
 * Non si blocca perche' un consuntivo puo' legittimamente chiamarsi come il mese
 * in cui e' stato emesso e riferirsi a quello prima. Ma dirlo cambia tutto: e' la
 * differenza fra venti righe da controllare a mano e una riga da leggere.
 */
export function periodoSospetto({ nomeFile = '', righe = [], anno, mese }) {
  const meseNum = Number(mese);
  const annoNum = Number(anno);
  if (!(meseNum >= 1 && meseNum <= 12)) return null;
  const atteso = MESI_NOME[meseNum - 1];
  const avvisi = [];

  const nome = String(nomeFile || '').toLowerCase();
  const nelNome = MESI_NOME.findIndex(m => nome.includes(m));
  if (nelNome >= 0 && nelNome !== meseNum - 1) {
    avvisi.push(`Il file si chiama "${nomeFile}" e nel nome c'è ${MESI_NOME[nelNome]}, ma stai verificando ${atteso} ${annoNum}. Se è il file sbagliato, qualunque difformità qui sotto non vuol dire niente.`);
  }

  // Le date delle righe, quando il consuntivo ne porta.
  const giorni = (righe || []).map(r => String((r && r.giorno) || '')).filter(g => /^\d{4}-\d{2}-\d{2}$/.test(g));
  if (giorni.length >= 3) {
    const dentro = giorni.filter(g => Number(g.slice(0, 4)) === annoNum && Number(g.slice(5, 7)) === meseNum).length;
    if (dentro === 0) {
      const primo = giorni.slice().sort()[0];
      avvisi.push(`Nessuna delle ${giorni.length} righe datate del consuntivo cade in ${atteso} ${annoNum}: la più vecchia è del ${primo.slice(8, 10)}/${primo.slice(5, 7)}/${primo.slice(0, 4)}. Con ogni probabilità è il file di un altro mese.`);
    } else if (dentro < giorni.length / 2) {
      avvisi.push(`Solo ${dentro} righe su ${giorni.length} cadono in ${atteso} ${annoNum}: controlla che sia il file giusto.`);
    }
  }

  return avvisi.length ? avvisi : null;
}

/** Lo stesso soggetto, scritto come viene. */
const stesso = (a, b) => {
  const x = normalizzaRagioneSociale(a || '');
  const y = normalizzaRagioneSociale(b || '');
  return !!x && !!y && x === y;
};

/**
 * I NOSTRI MOVIMENTI che riguardano quel fornitore, in quel ruolo, in quel mese e
 * in quel canale. E' la base su cui il suo consuntivo va verificato.
 *
 * @param archivi { primarieRete, primarieAci, secondarie, extraRaccolta }
 */
export function movimentiDelFornitore(archivi, { fornitore, ruolo, anno, mese, canale, fornitori = [] }) {
  const annoNum = Number(anno);
  const meseNum = Number(mese);
  // CHI FATTURA, NON CHI HA MATERIALMENTE LAVORATO. La fatturazione passiva
  // accorpa le tonnellate di un subfornitore al principale (mappaFatturazione):
  // Torres Giovanni raccoglie col proprio nome e fattura tramite Green Tyre. Senza
  // passare di qui, al principale si metteva accanto ai suoi soli chili l'importo
  // di tutto il gruppo, e al subfornitore non si trovava nessun costo e il suo
  // consuntivo usciva dichiarato a posto. I due moduli devono parlare dello stesso
  // soggetto, o i numeri non sono confrontabili.
  const mappa = mappaFatturazione(fornitori);
  const chiFattura = (nome) => fatturaA(mappa, nome).chiave;
  const cercato = chiFattura(fornitore) || normalizzaRagioneSociale(fornitore || '');
  const suo = (nome) => {
    const k = chiFattura(nome) || normalizzaRagioneSociale(nome || '');
    return !!k && !!cercato && k === cercato;
  };
  const delPeriodo = (r, archivio) => {
    if (!eTerminato(r)) return false;
    if (canaleMovimento(r, archivio) !== canale) return false;
    const g = giornoMovimento(r);
    return !!g && Number(g.slice(0, 4)) === annoNum && Number(g.slice(5, 7)) === meseNum;
  };
  const out = [];
  const prendi = (righe, archivio, riguarda) => {
    for (const r of righe || []) {
      if (!delPeriodo(r, archivio)) continue;
      if (!riguarda(r)) continue;
      out.push({ ...r, __archivio: archivio });
    }
  };

  const primarie = [
    [archivi.primarieRete || [], 'PrimariaRete'],
    [archivi.primarieAci || [], 'PrimariaAci'],
  ];
  const extra = archivi.extraRaccolta || [];

  if (ruolo === 'raccoglitore') {
    // Chi ha raccolto: il trasportatore del formulario di primaria.
    for (const [righe, arch] of primarie) prendi(righe, arch, r => suo(r.trasportatore));
    // NELL'EXTRA RACCOLTA ANCHE LE SECONDARIE sono pagate come RACCOLTA a chi le
    // trasporta (passivaCalcolo: raccoglitoriSource = tutti gli interventi).
    // Escluderle qui, come faceva la prima stesura, metteva accanto a sei
    // tonnellate l'importo di quindici, con una spiegazione inventata.
    prendi(extra, 'ExtraRaccolta', r => suo(r.trasportatore));
  } else if (ruolo === 'impianto') {
    // Tutto quello che gli e' arrivato: primarie scaricate da lui e secondarie in
    // ingresso. E' la stessa base su cui la passiva paga stoccaggio e trattamento.
    for (const [righe, arch] of primarie) prendi(righe, arch, r => suo(r.destinazione));
    prendi(archivi.secondarie || [], 'Secondaria', r => suo(r.destinazione));
    prendi(extra, 'ExtraRaccolta', r => suo(r.destinazione));
  } else if (ruolo === 'trasportatore') {
    // Le secondarie che ha portato: partono da un piazzale e arrivano a un impianto.
    // Quelle di extra raccolta non stanno qui: la passiva le paga come raccolta, non
    // come trasporto, e infatti il suo blocco dei trasporti per l'extra e' vuoto.
    prendi(archivi.secondarie || [], 'Secondaria', r => suo(r.trasportatore));
  }
  return out;
}

/**
 * IL CONFRONTO RIGA PER RIGA fra il consuntivo del fornitore e i nostri movimenti.
 *
 * Le quote dello stesso formulario si sommano prima del confronto, da una parte e
 * dall'altra: un formulario ripartito su due ordini e' un documento solo, e in
 * fattura conta la somma dei pesi (vedi formulari.ts).
 *
 * Tre esiti possibili per ogni formulario:
 *   - sta in tutti e due: si confrontano i chili;
 *   - solo nel consuntivo: ce lo fattura e noi non l'abbiamo. E' il caso piu'
 *     grave, perche' e' materiale che pagheremmo senza averlo registrato;
 *   - solo da noi: l'abbiamo e lui non l'ha messo. Di solito e' un ritardo suo,
 *     ma va detto, perche' se poi lo fattura a parte si paga due volte.
 *
 * Una tolleranza sui chili si passa da fuori: qui non si decide quanto e' "uguale".
 */
export function confrontaConsuntivo(righeConsuntivo, movimenti, { tolleranza_kg = 0 } = {}) {
  // Ogni gruppo tiene TUTTE le sue chiavi - formulario e ordine - cosi' una riga
  // del consuntivo che porta solo l'ordine trova lo stesso il nostro movimento, che
  // il formulario ce l'ha sempre.
  const raggruppa = (righe, peso, chiaviDi) => {
    const gruppi = [];
    const indice = new Map(); // chiave -> gruppo
    let senza = null;
    for (const r of righe || []) {
      const chiavi = chiaviDi(r);
      if (!chiavi.length) {
        if (!senza) senza = { chiavi: [], righe: [], kg: 0, senza_chiave: true };
        senza.righe.push(r);
        senza.kg += Number(peso(r)) || 0;
        continue;
      }
      let g = null;
      for (const k of chiavi) if (indice.has(k)) { g = indice.get(k); break; }
      if (!g) { g = { chiavi: [], righe: [], kg: 0 }; gruppi.push(g); }
      for (const k of chiavi) if (!g.chiavi.includes(k)) { g.chiavi.push(k); indice.set(k, g); }
      g.righe.push(r);
      g.kg += Number(peso(r)) || 0;
    }
    for (const g of gruppi) g.kg = kgTondi(g.kg);
    if (senza) senza.kg = kgTondi(senza.kg);
    return { gruppi, indice, senza };
  };

  const loro = raggruppa(righeConsuntivo, r => r.kg, chiaviRiga);
  const nostri = raggruppa(movimenti, r => r.peso_effettivo,
    r => chiaviRiga({ numero_fir: chiaveFormulario(r), id_ordine: r.id_ordine }));
  const senzaChiave = loro.senza;

  // L'UNITA' DEL CONFRONTO E' IL CARICO COME LO CONOSCIAMO NOI. Un formulario
  // ripartito su due ordini e' un carico solo: se il fornitore lo scrive su due
  // righe, una per ordine, quelle due righe vanno FUSE prima di confrontarle, o il
  // confronto direbbe due volte "peso diverso" su un documento che invece torna.
  const nome = (g) => (g.chiavi[0] || '');
  const loroPerNostro = new Map();
  const loroAbbinati = new Set();
  for (const l of loro.gruppi) {
    for (const k of l.chiavi) {
      const n = nostri.indice.get(k);
      if (!n) continue;
      if (!loroPerNostro.has(n)) loroPerNostro.set(n, []);
      if (!loroPerNostro.get(n).includes(l)) loroPerNostro.get(n).push(l);
      loroAbbinati.add(l);
      break;
    }
  }

  const voci = [];
  for (const n of nostri.gruppi) {
    const suoi = loroPerNostro.get(n) || [];
    if (!suoi.length) {
      voci.push({
        chiave: nome(n), esito: 'solo_gestionale', kg_consuntivo: null, kg_gestionale: n.kg, scarto_kg: null,
        righe_gestionale: n.righe.length, id_ordine: pulisci(n.righe[0] && n.righe[0].id_ordine),
      });
      continue;
    }
    const kgLoro = kgTondi(suoi.reduce((s, l) => s + l.kg, 0));
    const scarto = kgLoro - n.kg;
    voci.push({
      chiave: nome(n),
      esito: Math.abs(scarto) <= tolleranza_kg ? 'uguale' : 'peso_diverso',
      kg_consuntivo: kgLoro, kg_gestionale: n.kg, scarto_kg: scarto,
      righe_consuntivo: suoi.reduce((s, l) => s + l.righe.length, 0), righe_gestionale: n.righe.length,
      id_ordine: pulisci(n.righe[0] && n.righe[0].id_ordine),
    });
  }
  for (const l of loro.gruppi) {
    if (loroAbbinati.has(l)) continue;
    voci.push({ chiave: nome(l), esito: 'solo_consuntivo', kg_consuntivo: l.kg, kg_gestionale: null, scarto_kg: null, righe_consuntivo: l.righe.length });
  }

  const conta = (e) => voci.filter(v => v.esito === e).length;
  const kgDi = (e, campo) => voci.filter(v => v.esito === e).reduce((s, v) => s + (v[campo] || 0), 0);
  const totaleLoro = loro.gruppi.reduce((s, e) => s + e.kg, 0) + (senzaChiave ? senzaChiave.kg : 0);
  const totaleNostro = nostri.gruppi.reduce((s, e) => s + e.kg, 0);

  return {
    voci: voci.sort((a, b) => (Math.abs(b.scarto_kg || 0) - Math.abs(a.scarto_kg || 0)) || String(a.chiave).localeCompare(String(b.chiave))),
    uguali: conta('uguale'),
    peso_diverso: conta('peso_diverso'),
    solo_consuntivo: conta('solo_consuntivo'),
    solo_gestionale: conta('solo_gestionale'),
    kg_solo_consuntivo: kgDi('solo_consuntivo', 'kg_consuntivo'),
    kg_solo_gestionale: kgDi('solo_gestionale', 'kg_gestionale'),
    // Le righe del consuntivo senza formulario e senza ordine: non si possono
    // abbinare a niente, e tacerle le farebbe sparire dal conto.
    senza_chiave: senzaChiave ? senzaChiave.righe.length : 0,
    senza_chiave_kg: senzaChiave ? senzaChiave.kg : 0,
    totale_consuntivo_kg: totaleLoro,
    totale_gestionale_kg: totaleNostro,
    scarto_totale_kg: totaleLoro - totaleNostro,
    formulari_gestionale: contaFormulari(movimenti),
    // Quadra quando ogni formulario torna e non ne avanza da nessuna delle due parti.
    quadra: conta('peso_diverso') === 0 && conta('solo_consuntivo') === 0 && conta('solo_gestionale') === 0 && !senzaChiave,
  };
}

/**
 * IL COSTO PREVISTO per quel fornitore, preso dalla fatturazione passiva del mese.
 *
 * Non si ricalcola qui: si legge quello che la passiva ha gia' calcolato, che e'
 * l'unico numero che il gestionale considera dovuto. Calcolarne un secondo, con le
 * stesse tariffe ma un'altra aritmetica, vorrebbe dire avere due prezzi per lo
 * stesso carico e non sapere quale portare in fattura.
 *
 * Restituisce anche da QUALE blocco viene, perche' un soggetto che raccoglie e ha
 * il piazzale compare in due blocchi con due importi diversi, e confonderli
 * sarebbe pagarlo due volte o una volta sola.
 */
export function costoAttesoDallaPassiva(passiva, fornitore, ruolo) {
  if (!passiva) return null;
  const blocco = ruolo === 'raccoglitore' ? 'raccoglitori'
    : ruolo === 'impianto' ? 'impianti_stoccaggi'
      : 'trasporti_secondaria';
  const righe = (passiva[blocco] || []).filter(f => stesso(f.fornitore, fornitore));
  if (!righe.length) {
    return {
      trovato: false, blocco,
      motivo: `Nella fatturazione passiva di questo mese, nel blocco ${blocco.replace(/_/g, ' ')}, non c'e' nessuna riga per questo fornitore: o non gli spetta niente in questo canale, o manca la tariffa.`,
    };
  }
  return {
    trovato: true,
    blocco,
    tonnellate: righe.reduce((s, f) => s + (Number(f.totale_tonnellate) || 0), 0),
    importo: Math.round(righe.reduce((s, f) => s + centesimi(f.totale_euro), 0)) / 100,
    interno: righe.every(f => f.interno === true),
    righe: righe.flatMap(f => f.righe || []),
  };
}

/**
 * IL VERDETTO: il consuntivo del fornitore contro i nostri movimenti e contro il
 * costo che la passiva gli riconosce.
 *
 * Il confronto sul costo si fa in CENTESIMI interi: sommando in virgola mobile,
 * luglio 2026 usciva 226.692,48 da una parte e 226.692,49 dall'altra con le righe
 * identiche (e' la lezione di prefattura.ts).
 */
export function esitoConsuntivo({ confronto, costo, importo_consuntivo = null, tolleranza_euro = 0.015 }) {
  const kgPassiva = costo && costo.trovato ? Math.round(costo.tonnellate * 1000) : null;
  const scartoPassiva = kgPassiva === null ? null : confronto.totale_gestionale_kg - kgPassiva;
  const scartoImporto = importo_consuntivo === null || !costo || !costo.trovato
    ? null
    : (centesimi(importo_consuntivo) - centesimi(costo.importo)) / 100;
  const quadraPassiva = scartoPassiva === null ? null : scartoPassiva === 0;
  const quadraImporto = scartoImporto === null ? null : Math.abs(scartoImporto) <= tolleranza_euro;
  return {
    quadra_quantita: confronto.quadra,
    // I chili che paghiamo devono essere quelli che abbiamo: se la passiva ne conta
    // altri, prima di guardare gli euro va capito perche'.
    quadra_con_passiva: quadraPassiva,
    scarto_passiva_kg: scartoPassiva,
    importo_previsto: costo && costo.trovato ? costo.importo : null,
    importo_consuntivo,
    scarto_importo: scartoImporto,
    quadra_importo: quadraImporto,
    // Un fornitore interno non manda fattura: la passiva lo riporta a zero e non e'
    // una difformita'.
    interno: !!(costo && costo.interno),
    // IL VERDETTO COMPLESSIVO. Verde solo se torna TUTTO quello che si e' potuto
    // controllare. Prima l'importo non ci entrava - un consuntivo con 500 euro di
    // differenza usciva verde, con la differenza scritta dentro il riquadro verde -
    // e un costo che non si trova affatto (quadra_con_passiva null) passava per
    // buono, perche' null non e' false: era il caso del subfornitore e del
    // trasportatore di extra raccolta, dichiarati a posto senza che il gestionale
    // avesse un solo euro da opporre.
    quadra_tutto: confronto.quadra
      && quadraPassiva === true
      && (quadraImporto === null || quadraImporto === true),
    // Che cosa NON si e' potuto controllare: dirlo e' diverso dal dire che va bene.
    non_controllato: [
      !costo || !costo.trovato ? 'il costo previsto (la fatturazione passiva non ha una riga per questo fornitore in questo ruolo)' : '',
      importo_consuntivo === null ? "l'importo (il consuntivo non ne porta uno)" : '',
    ].filter(Boolean),
  };
}

/** Il testo del verdetto, in parole. Vuoto quando non c'e' niente da dire. */
export function testoEsitoConsuntivo(confronto, esito) {
  const parti = [];
  if (confronto.quadra) parti.push(`Il consuntivo corrisponde ai nostri movimenti: ${confronto.uguali} formulari, ${confronto.totale_consuntivo_kg} kg.`);
  else {
    const q = [];
    if (confronto.peso_diverso) q.push(`${confronto.peso_diverso} con un peso diverso`);
    if (confronto.solo_consuntivo) q.push(`${confronto.solo_consuntivo} che noi non abbiamo (${confronto.kg_solo_consuntivo} kg)`);
    if (confronto.solo_gestionale) q.push(`${confronto.solo_gestionale} che abbiamo noi e il consuntivo non riporta (${confronto.kg_solo_gestionale} kg)`);
    if (confronto.senza_chiave) q.push(`${confronto.senza_chiave} righe senza formulario ne' ordine, che non si possono abbinare`);
    parti.push(`Il consuntivo non corrisponde: ${q.join(', ')}.`);
  }
  if (esito.quadra_con_passiva === false) {
    parti.push(`I chili che la fatturazione passiva conta per questo fornitore sono ${Math.abs(esito.scarto_passiva_kg)} kg ${esito.scarto_passiva_kg > 0 ? 'in meno' : 'in piu'}' dei nostri movimenti del mese: di solito vuol dire che una tratta non ha una tariffa, o che una riga sta in un altro blocco.`);
  }
  if (esito.importo_consuntivo !== null && esito.quadra_importo === false) {
    parti.push(`L'importo del consuntivo si scosta di ${esito.scarto_importo > 0 ? '+' : ''}${esito.scarto_importo.toFixed(2)} euro da quello previsto.`);
  }
  if (esito.interno) parti.push('E\' un fornitore interno: la passiva lo riporta a zero perche\' non fattura, e la differenza sull\'importo non e\' una difformita\'.');
  // Quello che non si e' potuto controllare va detto: un verdetto che tace su un
  // controllo mancato si legge come un controllo passato.
  if ((esito.non_controllato || []).length) {
    parti.push(`Non si e' potuto controllare: ${esito.non_controllato.join('; ')}.`);
  }
  return parti.join(' ');
}
