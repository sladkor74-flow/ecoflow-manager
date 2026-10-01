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
import { eAci } from "./canaleSecondaria.ts";
import { termineDi, testoScadenza, GIORNI_TERMINE_REGISTRAZIONE } from "./termineRegistrazione.ts";
import { formatoKg } from "./formato.ts";
import { distanzaFir, descriviDifferenzaFir } from "./numeroFir.ts";

const kgTondi = (v) => Math.round(Number(v) || 0);
const pulisci = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
/** 'AAAA-MM-GG' come lo legge una persona: 13/07/2026. */
const giornoIt = (g) => (/^\d{4}-\d{2}-\d{2}$/.test(String(g)) ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : 'data non leggibile');
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
  // "Blocco/Serie" e' come ECOLOGICAL SYSTEMS chiama il formulario nel suo
  // riepilogo: il blocco e la serie SONO la numerazione del formulario, e nella
  // colonna ci sono formulari veri (SNTXP015456TF). Vale meno di "formulario"
  // scritto per nome, e se i valori dicono un'altra cosa si cambia idea.
  numero_fir: [[/formulario|\bfir\b|num\.?\s*fiscale|numerazione\s*fiscale/i, 10], [/rif\.?\s*docum/i, 8], [/\bddt\b|blocco|\bserie\b/i, 6], [/documento/i, 4]],
  id_ordine: [[/\bordine\b|n\.?\s*ordine/i, 10], [/ticket/i, 8], [/\bordn?\b/i, 6]],
  kg: [[/p\.?\s*netto|peso\s*netto|netto\s*in\s*kg/i, 10], [/\bpeso\b|\bkg\b|tonnell/i, 8], [/quantit|q\.?t[aà]/i, 4]],
  giorno: [[/\bdata\b|\bdt\b|giorno/i, 10]],
  classe: [[/^classe|classe\s*pfu|codice.?prodotto/i, 10], [/\bprodotto\b|\bcl\.|tipo\s*pfu/i, 6]],
  // "Totale" non c'e' apposta: una colonna che si chiama cosi' puo' essere un
  // totale di chili come di euro, e un importo sbagliato e' peggio di un importo
  // mancante (il verdetto dice "non si e' potuto controllare l'importo").
  importo: [[/importo|imponibile|corrispettivo/i, 10], [/\bvalore\b|\beuro\b|€/i, 6]],
  // I NOMI DELLA RIGA: non decidono mai un abbinamento da soli, ma confermano
  // quello che il formulario e il peso suggeriscono, e soprattutto permettono di
  // DIRE in che cosa consiste l'errore (richiesta dell'utente, 01/10/2026:
  // «fai i paragoni con piu' informazioni della stessa riga»). Letti male
  // possono solo far mancare una conferma, non inventare un abbinamento.
  produttore: [[/produttore|punto\s*di\s*raccolta|\bpdr\b/i, 10], [/cliente|detentore/i, 6]],
  destinatario: [[/destinatario|destinazione|impianto\s*di/i, 10], [/\bimpianto\b|smaltitore|recuperatore/i, 6]],
  trasportatore: [[/trasportatore|vettore/i, 10]],
};

const CAMPI_INTESTAZIONE = ['numero_fir', 'id_ordine', 'kg', 'giorno', 'classe', 'importo', 'produttore', 'destinatario', 'trasportatore'];

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
// Un formulario e' un CODICE: lettere e cifre attaccate, almeno otto. Il limite
// sugli spazi serve a non prendere per formulario una frase che ne ha la forma:
// "GIAC 31 LUGLIO 2026", nel foglio delle giacenze di NAPPI, normalizzata fa
// "GIAC31LUGLIO2026" - sedici caratteri, lettere e cifre - e passava. Un codice
// al massimo e' spezzato in due ("RG YTR-0226"), non in quattro.
const PARE_FIR = (v) => {
  const grezzo = pulisci(v);
  if ((grezzo.match(/\s/g) || []).length > 1) return false;
  const t = chiaveFir(grezzo);
  return t.length >= 8 && /[0-9]/.test(t) && /[A-Z]/.test(t);
};

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
// === UNA STAMPA INCOLLATA IN EXCEL ===
//
// ECORECUPERI non manda un foglio di calcolo: manda la sua stampa «Elenco
// Movimenti», dove ogni riga e' una stringa sola con le colonne allineate a
// spazi. Il formulario e la data stanno dentro la stessa stringa del produttore,
// e il peso sta su un'altra riga dello stesso blocco:
//
//   002453            000156   TECNOGUM S.R.L.                        10.120
//   900000            ECORECUPERI SRL
//   MELENCHI S.R.L.                     LQQDP001425TP   01-09-2026   160103
//
// Qui non si indovina niente - e' la regola che ha retto il resto del lettore.
// Si riconoscono due forme precise e si pretende che stiano insieme: la riga del
// carico deve portare un formulario nel formato regolare (cinque lettere, sei
// cifre, due lettere) e una data; la riga del peso deve cominciare con un codice
// di sei cifre e finire con un numero. Fra le due non ci puo' essere un altro
// carico, e lo stesso peso non si usa due volte. Se una di queste cose non
// torna, quel carico si dice illeggibile invece di prendergli un numero da
// un'altra riga.
const STAMPA_FIR = /([A-Z]{5}\d{6}[A-Z]{2})/;
const STAMPA_DATA = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/;
const STAMPA_CODICE = /^\d{6}\b/;
// Quante righe si guarda indietro per trovare il peso: nel blocco ce ne stanno
// due (il codice dell'intermediario e, sulla prima pagina, l'intestazione).
const STAMPA_INDIETRO = 5;
// Sotto i tre carichi non e' una stampa di movimenti: e' un foglio qualunque in
// cui per caso compare un codice, e leggerlo sarebbe esattamente l'indovinello
// che si e' tolto.
const STAMPA_MINIMO = 3;

/**
 * I carichi di una stampa incollata in Excel: { righe, note }, oppure null se il
 * foglio non ha quella forma. Non legge mai per approssimazione: quello che non
 * riconosce lo dice.
 */
export function righeDaStampa(celle, nome = '') {
  const testo = (celle || []).map(r => (r || []).map(c => pulisci(c)).filter(Boolean).join('  ').trim());
  const eCarico = (s) => STAMPA_FIR.test(s) && STAMPA_DATA.test(s);
  const pesoDi = (s) => {
    if (!STAMPA_CODICE.test(s) || eCarico(s)) return null;
    const n = comeNumero(String(s).split(/\s+/).pop());
    return n !== null && n > 0 ? Math.round(n) : null;
  };
  const carichi = testo.map((s, i) => (eCarico(s) ? i : -1)).filter(i => i >= 0);
  if (carichi.length < STAMPA_MINIMO) return null;

  const righe = [];
  const senzaPeso = [];
  const usati = new Set();
  for (const i of carichi) {
    const s = testo[i];
    const fir = s.match(STAMPA_FIR)[1];
    const giorno = comeGiorno(s.match(STAMPA_DATA)[0]);
    const produttore = pulisci(s.slice(0, s.indexOf(fir)));
    let kg = null;
    for (let k = i - 1; k >= 0 && k >= i - STAMPA_INDIETRO; k--) {
      // Arrivati al carico precedente si smette: il suo peso e' suo.
      if (eCarico(testo[k])) break;
      const p = pesoDi(testo[k]);
      if (p === null) continue;
      // Un peso gia' assegnato non si riusa: vorrebbe dire che il blocco non e'
      // come credevamo, e allora e' meglio dirlo.
      if (usati.has(k)) break;
      kg = p;
      usati.add(k);
      break;
    }
    if (kg === null) { senzaPeso.push(fir); continue; }
    righe.push({ numero_fir: fir, id_ordine: '', kg, importo: null, giorno, classe: '', produttore });
  }
  if (!righe.length) return null;

  const note = [`Foglio "${nome}": non e' un foglio di calcolo, e' una stampa incollata in Excel. Ho letto ${righe.length} ${righe.length === 1 ? 'carico' : 'carichi'} prendendo formulario e data dalla riga del carico e il peso dalla riga del codice sopra di lui.`];
  if (senzaPeso.length) {
    const quali = `${senzaPeso.slice(0, 5).join(', ')}${senzaPeso.length > 5 ? ', e altri' : ''}`;
    note.push(senzaPeso.length === 1
      ? `Foglio "${nome}": un carico non ha un peso riconoscibile nel suo blocco e non l'ho letto (${quali}): meglio dirlo che prendergli un numero da un'altra riga.`
      : `Foglio "${nome}": ${senzaPeso.length} carichi non hanno un peso riconoscibile nel loro blocco e non li ho letti (${quali}): meglio dirlo che prendergli un numero da un'altra riga.`);
  }
  return { righe, note };
}

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

    // SENZA LA RIGA DELLE INTESTAZIONI NON SI LEGGE. PUNTO.
    //
    // Il formulario, dalla forma, si riconosce: e' una sigla di lettere e cifre.
    // IL PESO NO: qualunque colonna di numeri somiglia a un peso, e sbagliarla
    // non da' un errore, da' un numero. Misurato sui consuntivi veri, indovinando
    // uscivano 323.051.160 kg da un registro di carico e scarico di IRIGOM,
    // 3.744.000 da ECORECUPERI e 1.834.000 da TRS: tonnellate che non esistono,
    // presentate con la stessa faccia di quelle giuste. Su un documento che
    // autorizza una fattura, un numero sbagliato che sembra buono e' il danno
    // peggiore possibile.
    //
    // Quindi si dice che non si sa leggere, e si dice che cosa fare. Una frase
    // che ammette di non capire e' piu' utile di una tabella inventata.
    if (iTesta < 0) {
      // Prima di arrendersi: puo' essere una stampa incollata in Excel, dove le
      // colonne non esistono e le intestazioni non ci sono per definizione
      // (ECORECUPERI). Si riconosce dalla forma delle righe, non si indovina.
      const stampa = righeDaStampa(t, nome);
      if (stampa) {
        righe.push(...stampa.righe);
        note.push(...stampa.note);
        colonneLette.push({ foglio: nome, colonne: { numero_fir: '(stampa: formulario nella riga del carico)', giorno: '(stampa: data nella riga del carico)', kg: '(stampa: peso nella riga del codice sopra)' } });
        continue;
      }
      const haFormulari = corpo.some(r => (r || []).some(c => PARE_FIR(c)));
      note.push(haFormulari
        ? `Foglio "${nome}": ci sono dei formulari ma non riconosco la riga delle intestazioni, quindi non so quale colonna sia il peso. Non l'ho letto: indovinare la colonna dei chili vorrebbe dire scrivere numeri sbagliati con l'aria di essere giusti. Serve un foglio con le intestazioni (per esempio "N. FORMULARIO" e "KG"), oppure dimmi tu quali colonne sono.`
        : `Foglio "${nome}": non ci sono formulari, quindi non e' un elenco di carichi (sara' un riepilogo, le giacenze o i totali). Saltato.`);
      continue;
    }

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

    // Quali colonne si sono usate si DICE sempre: e' il controllo che permette
    // all'utente di accorgersi in un secondo se il gestionale ha preso la colonna
    // sbagliata, invece di scoprirlo dai numeri.
    colonneLette.push({
      foglio: nome,
      colonne: Object.fromEntries(Object.entries(col).map(([k, v]) => [k, v.testo])),
    });

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
        classe: col.classe ? pulisci(prendi(riga, col.classe)) : '',
        // Gli altri dati della riga: servono a confermare un abbinamento
        // incerto e a dire in che cosa consiste l'errore (01/10/2026).
        produttore: col.produttore ? pulisci(prendi(riga, col.produttore)) : '',
        destinatario: col.destinatario ? pulisci(prendi(riga, col.destinatario)) : '',
        trasportatore: col.trasportatore ? pulisci(prendi(riga, col.trasportatore)) : '',
      });
    }
  }

  if (scartate) note.push(`${scartate} righe non avevano ne' un formulario ne' un numero d'ordine leggibile: non si possono abbinare e non sono state lette.`);
  return { righe, note, colonne: colonneLette, scartate, importo_totale: importoTotale };
}

/**
 * IL CANALE DI UNA RIGA, DALLA CLASSE CHE IL FORNITORE SCRIVE ACCANTO.
 *
 * Regola dell'utente (01/10/2026): "se la classe e' '9 - pfu autodemolizione'
 * allora trattasi di aci, le altre classi sono rete... non sussiste mai
 * l'equivoco se analizzi i dati corrispondenti". Verificato su tutti gli
 * archivi: TERMINATI RETE ha solo .class1 (P), .class2 (M), .class3 (G1),
 * .class4 (G2) e MAI la 9; TERMINATI ACI ha solo .class9. Lo stesso per le
 * secondarie.
 *
 * Esiste gia' eAci in canaleSecondaria.ts e fa questo lavoro sui NOSTRI record,
 * dove la classe e' scritta ".class9" o "PFU Autodemolizione". Nei fogli dei
 * fornitori, invece, la classe e' spesso un "9" secco - misurato su 42 dei 75
 * consuntivi veri - e quella regex, che cerca "class 9", non lo riconoscerebbe.
 * Questa funzione e' il ponte fra le due scritture, e si appoggia a eAci per
 * tutte le forme che eAci gia' conosce.
 *
 * Stringa vuota quando la classe non dice niente: "PLASMIX FINE" e' un prodotto
 * di trattamento, non una classe di PFU, e uno "0" non vuol dire nulla.
 * Vuoto NON significa rete: significa che non si sa, ed e' diverso.
 */
export function canaleDaClasse(valore) {
  const t = pulisci(valore).toUpperCase();
  if (!t) return '';
  if (eAci({ classe: t })) return 'ACI';
  // Il "9" secco, o "9 - PFU Autodemolizione", o ".class9".
  if (/^0*9$|^0*9\s*[-–]|^\.?CLASS\s*0*9$/.test(t)) return 'ACI';
  if (/^(P|M|G1|G2)$/.test(t) || /^0*[1-4]$/.test(t) || /^\.?CLASS\s*0*[1-4]$/.test(t)) return 'RETE';
  return '';
}

/**
 * IL CANALE DI UNA RIGA DEL CONSUNTIVO, e da che cosa lo si e' capito.
 *
 * In ordine di affidabilita':
 *   1. il MOVIMENTO abbinato. Il formulario e l'ID ordine sono unici fra i
 *      canali - verificato: zero numeri in comune fra i 2.971 movimenti di rete
 *      e i 45 ACI - quindi se la riga si abbina, il canale e' certo.
 *   2. la CLASSE scritta sulla riga, quando il foglio ha quella colonna.
 *   3. il NOME DEL FILE, quando dice ACI: GATIM manda due file separati,
 *      "circuito ACI" e "circuito gommisti", e per lui e' l'unico indizio.
 *      E' un indizio debole e va detto che viene da li'.
 *
 * Niente di tutto questo: canale vuoto. Di solito e' extra raccolta, che il
 * portale non alimenta e che l'utente inserisce a mano nel suo modulo.
 */
export function canaleDellaRiga(riga, movimento, nomeFile = '') {
  if (movimento) return { canale: canaleMovimento(movimento, movimento.__archivio || ''), come: 'movimento' };
  const daClasse = canaleDaClasse(riga && riga.classe);
  if (daClasse) return { canale: daClasse, come: 'classe' };
  if (/autodemoliz|\baci\b/i.test(String(nomeFile || ''))) return { canale: 'ACI', come: 'nome_file' };
  return { canale: '', come: '' };
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
/**
 * TUTTE LE CHIAVI CHE IL GESTIONALE CONOSCE, con le date dei nostri movimenti:
 * una Map `chiave -> { giorni: [...] }` su formulari e numeri d'ordine di
 * qualunque mese, canale e stato.
 *
 * Serve a distinguere tre cose che sembrano la stessa:
 * - un carico che da noi NON c'e' per niente: mai registrato, e il termine per
 *   registrarlo (dieci giorni dalla partenza, domeniche escluse) corre;
 * - un carico che da noi c'e' e si conclude in un altro mese: la riga e'
 *   davvero di un altro mese;
 * - un carico che da noi si conclude NEL mese verificato: allora la data
 *   scritta sul consuntivo e' sbagliata, ed e' un errore del file.
 *
 * Qualunque stato, anche "eseguito" o "in corso": la domanda non e' se il carico
 * sia chiuso, e' se il formulario esista da qualche parte da noi. Non costa
 * richieste alla piattaforma: gli archivi sono gia' in memoria.
 */
export function chiaviDelGestionale(archivi) {
  const noti = new Map();
  const a = archivi || {};
  for (const righe of [a.primarieRete, a.primarieAci, a.secondarie, a.extraRaccolta]) {
    for (const r of righe || []) {
      const giorno = giornoMovimento(r) || '';
      for (const k of chiaviRiga({ numero_fir: chiaveFormulario(r), id_ordine: r.id_ordine })) {
        if (!noti.has(k)) noti.set(k, { giorni: [] });
        if (giorno && !noti.get(k).giorni.includes(giorno)) noti.get(k).giorni.push(giorno);
      }
    }
  }
  return noti;
}

// Da quanti mesi diversi un file e' un REGISTRO e non il consuntivo di un mese.
// IRIGOM manda il registro di carico e scarico dell'anno: dodici mesi, e le righe
// degli altri mesi sono la natura del documento, non un errore. Un consuntivo di
// settembre porta settembre e qualche sbavatura a cavallo del mese: tre mesi al
// massimo. Da quattro in su si smette di chiamarli errori.
const MESI_DA_REGISTRO = 4;

export function confrontaConsuntivo(righeConsuntivo, movimenti, { tolleranza_kg = 0, canale = '', nome_file = '', anno = null, mese = null, formulari_noti = null } = {}) {
  // LE RIGHE DI UN ALTRO MESE NON SI CONFRONTANO.
  //
  // IRIGOM manda il registro di carico e scarico dell'ANNO: 3.026 righe per
  // 15.298 tonnellate. Letto per intero contro i movimenti di un mese solo,
  // darebbe migliaia di "carichi che ci fattura e noi non abbiamo" - e sono
  // semplicemente gli altri undici mesi. Si tengono da parte e si dicono.
  //
  // Solo le righe con una data LEGGIBILE: una riga senza data non si sa di che
  // mese sia, e buttarla fuori sarebbe peggio che confrontarla.
  const annoNum = Number(anno), meseNum = Number(mese);
  const filtraPeriodo = annoNum > 0 && meseNum >= 1 && meseNum <= 12;
  const noti = formulari_noti && typeof formulari_noti.get === 'function' ? formulari_noti : null;
  const fuoriPeriodo = [];
  // UNA DATA DI UN ALTRO MESE SU UN CARICO DI QUESTO MESE E' UN ERRORE DEL FILE.
  //
  // Parole dell'utente (01/10/2026): «non e' concepibile scrivere una data di
  // registrazione formulario di verifica del mese, indipendentemente dalla
  // settimana, con un mese che non c'entra niente: deve essere evidenziato come
  // errore». Nel consuntivo di settembre di NAPPI SUD un carico porta il 13
  // luglio: il formulario e' di settembre, la data e' sbagliata. Messo da parte
  // come "riga di un altro mese", quel carico sparirebbe dal confronto e i suoi
  // chili mancherebbero dalla parte del fornitore, inventando una difformita'
  // altrove.
  const dateSbagliate = [];   // il nostro movimento e' DI questo mese: la data e' sbagliata
  const altriMesi = [];       // il nostro movimento e' davvero di un altro mese
  const arretrati = [];       // da noi non risulta per niente
  // Quanti mesi diversi porta il file: da quattro in su e' un registro, e le
  // righe degli altri mesi non sono errori.
  const mesiNelFile = new Set();
  for (const r of righeConsuntivo || []) {
    const g = String((r && r.giorno) || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(g)) mesiNelFile.add(g.slice(0, 7));
  }
  const registroDiPiuMesi = mesiNelFile.size >= MESI_DA_REGISTRO;

  if (filtraPeriodo) {
    const delMese = (g) => Number(g.slice(0, 4)) === annoNum && Number(g.slice(5, 7)) === meseNum;
    const nostriGiorni = (chiavi) => {
      const out = [];
      for (const k of chiavi) for (const g of ((noti && noti.get(k)) || { giorni: [] }).giorni) if (!out.includes(g)) out.push(g);
      return out;
    };
    const voce = (r, g, nostro) => ({
      numero_fir: pulisci(r && r.numero_fir),
      id_ordine: pulisci(r && r.id_ordine),
      kg: Math.round(Number(r && r.kg) || 0),
      giorno: g,
      mese: g.slice(0, 7),
      ...(nostro ? { nostro_giorno: nostro } : {}),
    });
    const dentro = [];
    for (const r of righeConsuntivo || []) {
      const g = String((r && r.giorno) || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(g) || delMese(g)) { dentro.push(r); continue; }
      const chiavi = chiaviRiga(r);
      const nostre = noti && chiavi.length ? nostriGiorni(chiavi) : [];
      const nostroNelMese = nostre.find(delMese);
      if (nostroNelMese) {
        // Il carico e' di questo mese: la riga rientra nel confronto, e la data
        // sbagliata si segnala. Toglierla farebbe mancare i suoi chili.
        dateSbagliate.push(voce(r, g, nostroNelMese));
        dentro.push(r);
        continue;
      }
      fuoriPeriodo.push(r);
      if (!noti || !chiavi.length) continue;
      if (!chiavi.some(k => noti.has(k))) arretrati.push({ ...voce(r, g), termine: termineDi(g, 'report_arrivo') });
      else altriMesi.push(voce(r, g, nostre[0] || ''));
    }
    righeConsuntivo = dentro;
  }

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

  // === IL SECONDO GIRO: CHI SCRIVE IL NUMERO CON UNA LETTERA SBAGLIATA ===
  //
  // Richiesta dell'utente (01/10/2026): «le cose importanti su cui decidere sono
  // il numero del formulario, l'id ordine, ma chi ci invia il report puo' anche
  // sbagliare, ad esempio scambiando una lettera o una cifra, pertanto tu fai i
  // paragoni con piu' informazioni della stessa riga e confrontale con il
  // gestionale e ti risulta piu' semplice capire di cosa si tratta e in cosa
  // consiste l'eventuale errore».
  //
  // Un carattere sbagliato, da solo, produceva DUE difformita' false: «questo lo
  // fattura e noi non l'abbiamo» e «questo l'abbiamo noi e lui non lo riporta».
  // Due accuse al posto di una frase.
  //
  // La regola: un numero quasi uguale non basta, e un peso uguale non basta. Si
  // abbina quando il numero e' quasi uguale E almeno un'altra informazione della
  // riga lo conferma - il peso, la data, la classe, i nomi. Se le conferme non
  // ci sono, la riga resta una difformita': meglio una difformita' da guardare
  // che un abbinamento inventato.
  const DISTANZA_FIR = 2;
  const DISTANZA_ORDINE = 1;
  const tolleranza = Math.max(Number(tolleranza_kg) || 0, 1);
  const nome1 = (v) => normalizzaRagioneSociale(v || '');
  const datiLoro = (g) => {
    const r = g.righe[0] || {};
    return {
      fir: chiaveFir(r.numero_fir), scritto: pulisci(r.numero_fir), ordine: pareOrdine(r.id_ordine), ordineScritto: pulisci(r.id_ordine),
      giorno: String(r.giorno || ''), kg: g.kg, classe: pulisci(r.classe),
      produttore: pulisci(r.produttore), destinatario: pulisci(r.destinatario), trasportatore: pulisci(r.trasportatore),
    };
  };
  const datiNostri = (g) => {
    const r = g.righe[0] || {};
    return {
      fir: chiaveFir(r.numero_fir), scritto: pulisci(r.numero_fir), ordine: pareOrdine(r.id_ordine), ordineScritto: pulisci(r.id_ordine),
      giorno: giornoMovimento(r) || '', kg: g.kg, classe: pulisci(r.classe || r.prodotto),
      produttore: pulisci(r.produttore || r.ragione_sociale || r.stoccaggio), destinatario: pulisci(r.destinazione), trasportatore: pulisci(r.trasportatore),
    };
  };
  const giorniTra = (a, b) => (a && b ? Math.abs(Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000)) : null);
  // Che cosa, della riga, dice che sono lo stesso carico.
  const confronta = (a, b) => {
    const distFir = a.fir && b.fir ? distanzaFir(a.fir, b.fir, DISTANZA_FIR) : DISTANZA_FIR + 1;
    const distOrdine = a.ordine && b.ordine ? distanzaFir(a.ordine, b.ordine, DISTANZA_ORDINE) : DISTANZA_ORDINE + 1;
    const giorni = giorniTra(a.giorno, b.giorno);
    const nomi = ['produttore', 'destinatario', 'trasportatore']
      .filter(c => a[c] && b[c] && nome1(a[c]) === nome1(b[c]));
    const prove = [];
    if (Math.abs(a.kg - b.kg) <= tolleranza) prove.push('stesso peso');
    if (giorni === 0) prove.push('stessa data');
    else if (giorni === 1) prove.push('data a un giorno di distanza');
    if (a.classe && b.classe && canaleDaClasse(a.classe) && canaleDaClasse(a.classe) === canaleDaClasse(b.classe)) prove.push('stessa classe');
    for (const c of nomi) prove.push(`stesso ${c}`);
    return { distFir, distOrdine, giorni, prove, nomi };
  };
  /**
   * In che cosa i dati della riga non coincidono coi nostri, per un carico che
   * e' lo stesso. Vale sia per le righe abbinate dal numero esatto - dove
   * l'ordine o la data possono essere sbagliati comunque - sia per quelle
   * riconosciute dalle altre informazioni.
   *
   * I NOMI NON ENTRANO QUI. La stessa ditta si scrive in dieci modi, e un
   * elenco di «produttore diverso: "Melenchi S.r.l." invece di "MELENCHI SRL"»
   * seppellirebbe le differenze vere. I nomi servono a riconoscere il carico
   * (le conferme) e a spiegare, non a fare difformita'.
   */
  const differenzeFra = (a, b) => {
    const out = [];
    if (a.fir && b.fir && a.fir !== b.fir) {
      out.push({ campo: 'numero_fir', consuntivo: a.scritto, gestionale: b.scritto, testo: `Formulario errato: ${descriviDifferenzaFir(a.fir, b.fir)}. Nel consuntivo e' ${a.scritto}, nel gestionale ${b.scritto}` });
    } else if (!a.fir && b.fir) {
      out.push({ campo: 'numero_fir', consuntivo: '', gestionale: b.scritto, testo: `Formulario assente nel consuntivo: nel gestionale e' ${b.scritto}` });
    }
    if (a.ordine && b.ordine && a.ordine !== b.ordine) {
      out.push({ campo: 'id_ordine', consuntivo: a.ordineScritto, gestionale: b.ordineScritto, testo: `ID ordine errato: ${descriviDifferenzaFir(a.ordine, b.ordine)}. Nel consuntivo e' ${a.ordineScritto}, nel gestionale ${b.ordineScritto}` });
    }
    if (a.giorno && b.giorno && a.giorno !== b.giorno) {
      out.push({ campo: 'giorno', consuntivo: a.giorno, gestionale: b.giorno, testo: `Data diversa: nel consuntivo ${giornoIt(a.giorno)}, da noi il trasporto si conclude il ${giornoIt(b.giorno)}` });
    }
    // La classe si segnala solo quando cambia il canale: e' quello che cambia il
    // prezzo. Una classe scritta "1" invece di "P" e' la stessa cosa.
    const canaleA = canaleDaClasse(a.classe), canaleB = canaleDaClasse(b.classe);
    if (canaleA && canaleB && canaleA !== canaleB) {
      out.push({ campo: 'classe', consuntivo: a.classe, gestionale: b.classe, testo: `Classe di un altro canale: nel consuntivo ${a.classe} (${canaleA}), nel gestionale ${b.classe} (${canaleB})` });
    }
    return out;
  };

  const nostriPresi = new Set(loroPerNostro.keys());
  const avanzoNostri = nostri.gruppi.filter(n => !nostriPresi.has(n));
  const riconoscimentoPerNostro = new Map();
  if (avanzoNostri.length) {
    for (const l of loro.gruppi) {
      if (loroAbbinati.has(l)) continue;
      const a = datiLoro(l);
      if (!a.fir && !a.ordine) continue;
      let scelto = null, migliore = Infinity, come = null;
      for (const n of avanzoNostri) {
        if (nostriPresi.has(n)) continue;
        const b = datiNostri(n);
        const c = confronta(a, b);
        const numeroQuasi = c.distFir <= DISTANZA_FIR || c.distOrdine <= DISTANZA_ORDINE;
        if (!numeroQuasi || c.prove.length < 1) continue;
        // Il numero quasi uguale piu' almeno una conferma: due indizi, non uno.
        const punti = c.distFir * 10 + Math.min(c.distOrdine, DISTANZA_ORDINE + 1) * 8
          + Math.min(Math.abs(a.kg - b.kg), 5000) / 500 + (c.giorni === null ? 3 : Math.min(c.giorni, 10)) - c.prove.length;
        if (punti < migliore) { migliore = punti; scelto = n; come = { ...c, nostri: b }; }
      }
      if (!scelto) continue;
      nostriPresi.add(scelto);
      loroAbbinati.add(l);
      if (!loroPerNostro.has(scelto)) loroPerNostro.set(scelto, []);
      loroPerNostro.get(scelto).push(l);
      // Da che cosa lo si e' riconosciuto: va detto, perche' un abbinamento
      // fatto su una somiglianza va potuto controllare.
      riconoscimentoPerNostro.set(scelto, { prove: come.prove, scritto: a.scritto || a.ordineScritto });
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
    // OGNI RIGA ABBINATA SI CONTROLLA IN TUTTI I SUOI DATI, non solo nei chili
    // (richiesta dell'utente, 01/10/2026): anche una riga col formulario esatto
    // puo' portare un ID ordine o una data sbagliati, e prima nessuno lo diceva.
    const differenze = differenzeFra(datiLoro(suoi[0]), datiNostri(n));
    const ric = riconoscimentoPerNostro.get(n);
    voci.push({
      chiave: nome(n),
      esito: Math.abs(scarto) <= tolleranza_kg ? 'uguale' : 'peso_diverso',
      kg_consuntivo: kgLoro, kg_gestionale: n.kg, scarto_kg: scarto,
      righe_consuntivo: suoi.reduce((s, l) => s + l.righe.length, 0), righe_gestionale: n.righe.length,
      id_ordine: pulisci(n.righe[0] && n.righe[0].id_ordine),
      ...(differenze.length ? { differenze } : {}),
      ...(ric ? { riconosciuto_da: ric.prove, scritto_nel_consuntivo: ric.scritto } : {}),
    });
  }
  // UNA RIGA DI UN ALTRO CANALE NON E' UNA DIFFORMITA'.
  //
  // Un consuntivo puo' portare tutti e tre i canali (utente, 01/10/2026), ma
  // questo confronto ne guarda uno. Una riga di ACI dentro un consuntivo di rete
  // non si abbina a nessun nostro movimento di rete - giustamente - e finiva fra
  // i "carichi che il fornitore ci fattura e noi non abbiamo": un'accusa a un
  // documento corretto. Il canale della riga si legge dalla classe che il
  // fornitore scrive accanto: 9 e' autodemolizione, le altre sono rete.
  //
  // Non si tacciono: si mettono da parte e si DICE di aprire anche l'altro
  // canale, altrimenti quelle righe non le controllerebbe nessuno.
  for (const l of loro.gruppi) {
    if (loroAbbinati.has(l)) continue;
    const suo = canaleDellaRiga(l.righe[0], null, nome_file);
    const altroCanale = !!(canale && suo.canale && suo.canale !== String(canale).toUpperCase());
    voci.push({
      chiave: nome(l),
      esito: altroCanale ? 'altro_canale' : 'solo_consuntivo',
      kg_consuntivo: l.kg, kg_gestionale: null, scarto_kg: null, righe_consuntivo: l.righe.length,
      ...(suo.canale ? { canale_riga: suo.canale, canale_da: suo.come } : {}),
    });
  }

  const conta = (e) => voci.filter(v => v.esito === e).length;
  const kgDi = (e, campo) => voci.filter(v => v.esito === e).reduce((s, v) => s + (v[campo] || 0), 0);
  const totaleLoro = loro.gruppi.reduce((s, e) => s + e.kg, 0) + (senzaChiave ? senzaChiave.kg : 0);
  const totaleNostro = nostri.gruppi.reduce((s, e) => s + e.kg, 0);

  return {
    voci: voci.sort((a, b) => (Math.abs(b.scarto_kg || 0) - Math.abs(a.scarto_kg || 0)) || String(a.chiave).localeCompare(String(b.chiave))),
    uguali: conta('uguale'),
    peso_diverso: conta('peso_diverso'),
    // I carichi riconosciuti nonostante un numero scritto male: i chili tornano,
    // ma nel file del fornitore c'e' un errore da correggere (01/10/2026).
    con_differenze: voci.filter(v => (v.differenze || []).length).length,
    differenze: voci.filter(v => (v.differenze || []).length)
      .map(v => ({ chiave: v.chiave, scritto_nel_consuntivo: v.scritto_nel_consuntivo, riconosciuto_da: v.riconosciuto_da, differenze: v.differenze })),
    solo_consuntivo: conta('solo_consuntivo'),
    solo_gestionale: conta('solo_gestionale'),
    kg_solo_consuntivo: kgDi('solo_consuntivo', 'kg_consuntivo'),
    kg_solo_gestionale: kgDi('solo_gestionale', 'kg_gestionale'),
    // Le righe di un altro canale: contate a parte, mai fra le difformita'.
    altro_canale: conta('altro_canale'),
    kg_altro_canale: kgDi('altro_canale', 'kg_consuntivo'),
    // Le righe di un altro mese: fuori dal confronto, mai fra le difformita'.
    fuori_periodo: fuoriPeriodo.length,
    kg_fuori_periodo: kgTondi(fuoriPeriodo.reduce((s, r) => s + (Number(r.kg) || 0), 0)),
    // Quelle di un altro mese che nel gestionale non risultano per niente: da
    // registrare, con il termine. Non toccano il verdetto del mese - non sono
    // chili di questo mese - ma non si tacciono.
    arretrati,
    arretrati_da_registrare: arretrati.length,
    kg_arretrati: kgTondi(arretrati.reduce((s, r) => s + (Number(r.kg) || 0), 0)),
    // LA DATA SBAGLIATA: il carico e' di questo mese e il consuntivo scrive un
    // altro mese. La riga resta nel confronto, l'errore si dice.
    date_sbagliate: dateSbagliate,
    date_sbagliate_quante: dateSbagliate.length,
    // Le righe che sono davvero di un altro mese: un errore di composizione del
    // file, a meno che il file sia il registro di piu' mesi.
    altri_mesi: altriMesi,
    altri_mesi_quante: altriMesi.length,
    registro_di_piu_mesi: registroDiPiuMesi,
    mesi_nel_file: [...mesiNelFile].sort(),
    canali_altrui: [...new Set(voci.filter(v => v.esito === 'altro_canale').map(v => v.canale_riga))],
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
 * L'avviso dei carichi di altri mesi che nel gestionale non risultano, in
 * parole, pronto da mettere in testa alle note del confronto. '' se non ce ne
 * sono. Nel testo non c'e' niente che dipenda da oggi: solo la scadenza.
 */
export function avvisoArretrati(confronto) {
  const righe = (confronto && confronto.arretrati) || [];
  if (!righe.length) return '';
  const elenco = righe.slice(0, 10).map(a =>
    `${a.numero_fir || a.id_ordine || 'senza numero'} del ${giornoIt(a.giorno)}, ${formatoKg(a.kg)} kg${a.termine ? ` (${testoScadenza(a.termine.scadenza)})` : ''}`);
  if (righe.length > elenco.length) elenco.push(`e altri ${righe.length - elenco.length}`);
  return `${righe.length === 1 ? 'Un carico di un altro mese compare in questo consuntivo e nel gestionale non risulta' : `${righe.length} carichi di altri mesi compaiono in questo consuntivo e nel gestionale non risultano`}: ${elenco.join('; ')}. `
    + `Non entrano nei conti di questo mese, ma vanno caricati a portale e segnalati all'ufficio registrazioni: il termine e' di ${GIORNI_TERMINE_REGISTRAZIONE} giorni dalla data di partenza, domeniche escluse.`;
}

/**
 * GLI AVVISI SULLE DATE, in ordine di gravita', pronti da mettere in testa alle
 * note del confronto:
 *
 * 1. la data sbagliata - il carico e' di questo mese e il consuntivo ne scrive
 *    un altro: e' un errore del file, e va corretto la' (utente, 01/10/2026);
 * 2. i carichi che da noi non risultano, col termine di registrazione;
 * 3. le righe che sono davvero di un altro mese: o la data e' sbagliata, o
 *    quelle righe vanno nel consuntivo del loro mese - e se quel mese e' stato
 *    fatturato, c'e' il rischio di pagarle due volte. A meno che il file sia il
 *    registro di piu' mesi, e allora e' la sua natura e si dice cosi'.
 */
export function avvisiDate(confronto) {
  const c = confronto || {};
  const avvisi = [];

  const sbagliate = c.date_sbagliate || [];
  if (sbagliate.length) {
    const elenco = sbagliate.slice(0, 10).map(a =>
      `${a.numero_fir || a.id_ordine || 'senza numero'}, ${formatoKg(a.kg)} kg: il consuntivo scrive ${giornoIt(a.giorno)}, da noi il trasporto si conclude il ${giornoIt(a.nostro_giorno)}`);
    if (sbagliate.length > elenco.length) elenco.push(`e altri ${sbagliate.length - elenco.length}`);
    avvisi.push(`DATA SBAGLIATA su ${sbagliate.length === 1 ? 'un carico' : `${sbagliate.length} carichi`}: ${elenco.join('; ')}. `
      + `${sbagliate.length === 1 ? 'Il carico e\' di questo mese e resta' : 'I carichi sono di questo mese e restano'} nel confronto, ma sul consuntivo ${sbagliate.length === 1 ? 'porta' : 'portano'} la data di un mese che non c'entra: va corretta nel file del fornitore.`);
  }

  const arretrati = avvisoArretrati(c);
  if (arretrati) avvisi.push(arretrati);

  const altri = c.altri_mesi || [];
  if (altri.length) {
    if (c.registro_di_piu_mesi) {
      avvisi.push(`Il file copre ${(c.mesi_nel_file || []).length} mesi diversi: e' un registro, non il consuntivo di un mese solo. Le ${altri.length} righe degli altri mesi restano fuori dal confronto, e non sono una difformita'.`);
    } else {
      const elenco = altri.slice(0, 10).map(a => `${a.numero_fir || a.id_ordine || 'senza numero'} del ${giornoIt(a.giorno)}, ${formatoKg(a.kg)} kg`);
      if (altri.length > elenco.length) elenco.push(`e altre ${altri.length - elenco.length}`);
      avvisi.push(`${altri.length === 1 ? 'Una riga appartiene' : `${altri.length} righe appartengono`} a un altro mese, e anche da noi ${altri.length === 1 ? 'quel carico si conclude' : 'quei carichi si concludono'} in un altro mese: ${elenco.join('; ')}. `
        + `Un consuntivo del mese deve portare i carichi del mese: ${altri.length === 1 ? 'quella riga va' : 'quelle righe vanno'} nel consuntivo del ${altri.length === 1 ? 'suo' : 'loro'} mese. Se quel mese e' stato fatturato, attenzione a non pagarle due volte.`);
    }
  }
  return avvisi;
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
    // Una data di un mese che non c'entra e' un errore del documento, non una
    // nota a margine: il riquadro non puo' restare verde con scritto dentro che
    // c'e' un errore (utente, 01/10/2026). Vale anche per le righe che sono
    // davvero di un altro mese, perche' in un consuntivo del mese non ci vanno e
    // se il loro mese e' stato fatturato si rischia di pagarle due volte. Un
    // registro di piu' mesi e' un'altra cosa: quelle righe sono la sua natura.
    quadra_tutto: confronto.quadra
      && quadraPassiva === true
      && (quadraImporto === null || quadraImporto === true)
      && !confronto.date_sbagliate_quante
      && !(confronto.fuori_periodo && !confronto.registro_di_piu_mesi)
      // Un formulario o un ID ordine scritto male e' un errore del documento,
      // anche se i chili tornano: il riquadro non puo' dirsi verde mentre sotto
      // c'e' scritto che due numeri sono sbagliati (01/10/2026).
      && !confronto.con_differenze,
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
  // I CARICHI RICONOSCIUTI NONOSTANTE UN NUMERO SCRITTO MALE: i chili tornano, e
  // la riga non e' una difformita' - ma il numero sul documento del fornitore e'
  // sbagliato, e si dice quale e in che cosa (01/10/2026).
  if (confronto.con_differenze) {
    const n = confronto.con_differenze;
    parti.push(`${n === 1 ? 'Un carico è stato riconosciuto' : `${n} carichi sono stati riconosciuti`} nonostante un numero scritto in modo diverso, confrontando le altre informazioni della riga: ${(confronto.differenze || []).slice(0, 5).map(d => `${(d.differenze[0] || {}).testo || d.chiave}${d.riconosciuto_da && d.riconosciuto_da.length ? ` (riconosciuto da: ${d.riconosciuto_da.join(', ')})` : ''}`).join('; ')}. I chili tornano, ma il numero sul consuntivo va corretto.`);
  }
  // LA DATA DI UN MESE CHE NON C'ENTRA E' UN ERRORE, e si dice subito dopo la
  // quadratura (utente, 01/10/2026). Prima quelle righe finivano nel mucchio
  // delle "righe di un altro mese: non sono una difformità", che per un carico
  // di questo mese con la data scritta male e' falso.
  if (confronto.date_sbagliate_quante) {
    const n = confronto.date_sbagliate_quante;
    parti.push(`${n === 1 ? 'Un carico porta la data di un altro mese' : `${n} carichi portano la data di un altro mese`}, ma ${n === 1 ? 'si conclude' : 'si concludono'} in questo: ${(confronto.date_sbagliate || []).slice(0, 5).map(a => `${a.numero_fir || a.id_ordine} scritto ${giornoIt(a.giorno)} invece di ${giornoIt(a.nostro_giorno)}`).join('; ')}. È un errore del file del fornitore e va corretto.`);
  }
  if (confronto.fuori_periodo) {
    parti.push(confronto.registro_di_piu_mesi
      ? `${confronto.fuori_periodo === 1 ? 'Una riga del consuntivo è' : `${confronto.fuori_periodo} righe del consuntivo sono`} di un altro mese (${confronto.kg_fuori_periodo} kg): il file copre ${(confronto.mesi_nel_file || []).length} mesi, è un registro, e quelle righe restano fuori dal confronto senza essere una difformità.`
      : `${confronto.fuori_periodo === 1 ? 'Una riga del consuntivo è' : `${confronto.fuori_periodo} righe del consuntivo sono`} di un altro mese (${confronto.kg_fuori_periodo} kg) e restano fuori dal confronto: un consuntivo del mese deve portare i carichi del mese, quindi vanno chiarite col fornitore prima di pagarle — anche per non pagarle due volte se il loro mese è già stato fatturato.`);
  }
  // Le righe di un altro canale si dicono SEMPRE, anche quando tutto il resto
  // quadra: se nessuno apre l'altro canale, quelle righe non le controlla nessuno.
  if (confronto.altro_canale) {
    const quali = (confronto.canali_altrui || []).join(' e ') || 'un altro canale';
    parti.push(`${confronto.altro_canale === 1 ? 'Una riga del consuntivo è' : `${confronto.altro_canale} righe del consuntivo sono`} di ${quali} (${confronto.kg_altro_canale} kg): qui non si contano, e non sono una difformità. Apri anche il consuntivo di ${quali} per questo fornitore, altrimenti quelle righe non le verifica nessuno.`);
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
