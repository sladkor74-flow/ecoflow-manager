// Il CSV della schermata «dichiarazione» del portale: la giacenza di un impianto
// ordine per ordine, con la fine del trasporto di ciascuno.
//
// A che serve. Finora la giacenza a portale di fine mese il gestionale la
// ricostruiva da sola, dal file degli ordini non dichiarati piu' i carichi che
// conosce. Questo file e' una terza fonte, piu' diretta: ogni riga e' un ordine
// ancora dichiarabile, col peso disponibile e la fine del trasporto, cioe'
// esattamente quello che serve per dire quanto c'era a portale all'ultimo giorno
// di un mese.
//
// MA RESTA UN RISCONTRO, NON LA FONTE DEL NUMERO. E' la regola scritta in
// AGENTS.md: «la giacenza di un piazzale e' una somma algebrica: l'ancora
// dell'anno piu' tutti i movimenti con fine trasporto successiva. La lettura del
// portale e' un riscontro, non la fonte del numero». Percio' questo modulo
// calcola e confronta, e non scrive niente da nessuna parte: nessun archivio,
// nessuna giacenza sostituita. Quando il riscontro si scosta, lo scarto si
// mostra e si spiega.
//
// Il file del 03/10/2026, ore 15:00 (143 ordini di Irigom): 543.220 kg
// disponibili in tutto, di cui 144.780 con fine trasporto in agosto - che sono
// esattamente AD93 + AE93 del registro, la regola del 22/09/2026 che torna al
// chilo - 375.140 in settembre e 23.300 in ottobre. Giacenza al 30/09: 519.920 kg.
//
// Due trappole del formato:
//   - «Peso dichiarato (kg)» NON e' peso dichiarato: e' quanto si sta mettendo
//     nella dichiarazione che si ha aperto in quel momento, e per aprire una
//     terziaria si mette 1 kg. La giacenza e' la somma di «Peso disponibile».
//   - la colonna «Prodotto» porta la classe (.class1 ... .class9): le classi 1-4
//     sono RETE, la 9 e' ACI, e non si sommano mai fra loro.

import { normalizzaRagioneSociale } from './normalizzaRagioneSocialeClient.js';

const intero = (n) => Math.round(Number(n) || 0);

/** Le classi di rete e quella dell'ACI: canali separati, non si sommano mai. */
export const CLASSI_RETE = [1, 2, 3, 4];
export const CLASSE_ACI = 9;
export const canaleDiClasse = (classe) => (classe === CLASSE_ACI ? 'ACI' : CLASSI_RETE.includes(classe) ? 'RETE' : '');

/**
 * Il nome del sito nel portale ha un prefisso: «Impianto di Irigom S.r.l.», ma
 * anche «Impianto Irigom» o «Stoccaggio Irigom» senza la preposizione. Se il
 * prefisso non si toglie, lo stesso impianto scritto in due modi diventa due
 * siti e meta' della giacenza sparisce senza che nessuno se ne accorga.
 */
export function nomeSitoPortale(storage) {
  const s = String(storage || '').replace(/^\s*(impianto|stoccaggio|deposito|piazzale)\s+((di|dello|della|del|dei|degli)\s+)?/i, '');
  return normalizzaRagioneSociale(s);
}

const GIORNI_MESE = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const bisestile = (a) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
const giorniDi = (anno, mese) => (mese === 2 && bisestile(anno) ? 29 : GIORNI_MESE[mese - 1]);
/** L'ultimo giorno di un mese, 'aaaa-mm-gg'. */
export const ultimoGiornoDelMese = (anno, mese) => `${anno}-${String(mese).padStart(2, '0')}-${giorniDi(Number(anno), Number(mese))}`;

/**
 * 'gg/mm/aaaa' -> 'aaaa-mm-gg'; '' se non e' una data VERA. Accetta anche l'ISO.
 *
 * Il mese e il giorno si controllano: una data impossibile o scritta all'americana
 * ('31/13/2026', '09/25/2026') prima diventava una chiave di giorno finta -
 * '2026-13-31' - che non finiva fra quelle senza data, non faceva nascere nessun
 * avviso e spostava i chili in un mese che non esiste. Agosto scendeva da 144.780
 * a 135.680 e smetteva di tornare con AD + AE.
 */
export function giornoDa(valore) {
  const t = String(valore || '').trim();
  const it = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(t);
  const iso = it ? null : /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  const [anno, mese, giorno] = it ? [+it[3], +it[2], +it[1]] : iso ? [+iso[1], +iso[2], +iso[3]] : [0, 0, 0];
  if (!anno || mese < 1 || mese > 12 || giorno < 1 || giorno > giorniDi(anno, mese)) return '';
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

/**
 * Un numero come lo scrive il portale. In italiano '12.340' e '12.340,50': il
 * punto separa le migliaia, la virgola i decimali. In un file salvato in inglese
 * e' il contrario, '12,340' e '12,340.50'.
 *
 * Quale dei due si capisce dal SEPARATORE DEI CAMPI, non dal numero: '3,340' da
 * solo e' ambiguo - 3,34 oppure 3.340 - e leggendolo sempre all'italiana un
 * export in inglese dava 5.378 kg invece di 519.920, cioe' mille volte meno, e
 * incolpava il gestionale dello scarto. Un file col punto e virgola e' italiano,
 * uno con la virgola e' inglese.
 *
 * Torna null quando non e' un numero, cosi' chi legge puo' dirlo invece di
 * mettere uno zero e tacere.
 */
export function numeroDa(valore, { inglese = false } = {}) {
  const t = String(valore ?? '').trim().replace(/\s| /g, '');
  if (!t) return null;
  const grezzo = inglese ? t.replace(/,/g, '') : (t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/^(-?\d{1,3})((\.\d{3})+)$/, (m, a, b) => a + b.replace(/\./g, '')));
  if (!/^-?\d+(\.\d+)?$/.test(grezzo)) return null;
  const n = Number(grezzo);
  return Number.isFinite(n) ? n : null;
}

/**
 * Spezza una riga di CSV. Le virgolette contano solo se APRONO il campo, come
 * vuole il formato: 'GOMME 15" SRL' - una misura in pollici, normale nel settore,
 * e il portale non mette le virgolette - prima apriva una stringa e si mangiava
 * il resto della riga, data e peso compresi.
 */
function campi(riga, separatore) {
  const fuori = [];
  let i = 0;
  while (i <= riga.length) {
    if (riga[i] === '"') {
      let corrente = '';
      i++;
      while (i < riga.length) {
        if (riga[i] === '"') {
          if (riga[i + 1] === '"') { corrente += '"'; i += 2; continue; }
          i++;
          break;
        }
        corrente += riga[i++];
      }
      // quello che resta fino al separatore (di solito niente)
      while (i < riga.length && riga[i] !== separatore) corrente += riga[i++];
      fuori.push(corrente.trim());
      i++;
      if (i > riga.length) break;
      if (i === riga.length) { fuori.push(''); break; }
      continue;
    }
    let corrente = '';
    while (i < riga.length && riga[i] !== separatore) corrente += riga[i++];
    fuori.push(corrente.trim());
    if (i >= riga.length) break;
    i++;
    if (i === riga.length) { fuori.push(''); break; }
  }
  return fuori;
}

const senzaSegni = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Legge il CSV della schermata «dichiarazione» del portale.
 *
 * @param {string} testo il file, cosi' come arriva (il BOM si toglie da solo)
 * @returns {object} { righe, siti, doppioni, avvisi, colonne }
 *   righe: [{ ordine, sito, sito_chiave, origine, fine_trasporto, classe, canale,
 *             disponibile_kg, in_dichiarazione_kg, selezionato }]
 *   siti:  [{ sito, sito_chiave, ordini, rete_kg, aci_kg, senza_canale_kg }]
 */
export function leggiCsvPortale(testo) {
  const pulito = String(testo || '').replace(/^﻿/, '');
  const linee = pulito.split(/\r?\n/).filter(r => r.trim());
  if (!linee.length) throw new Error('Il file e\' vuoto.');
  // Il portale usa il punto e virgola; si riconosce comunque dalla prima riga.
  const separatore = (linee[0].match(/;/g) || []).length >= (linee[0].match(/,/g) || []).length ? ';' : ',';
  const colonne = campi(linee[0], separatore);
  const indice = {};
  colonne.forEach((c, i) => { indice[senzaSegni(c)] = i; });
  const quale = (...nomi) => {
    for (const n of nomi) { const i = indice[senzaSegni(n)]; if (i !== undefined) return i; }
    return -1;
  };
  const iOrdine = quale('Ordine');
  const iSito = quale('storage', 'Impianto', 'Sito');
  const iFine = quale('Fine trasporto', 'Fine del trasporto');
  const iDisp = quale('Peso disponibile (kg)', 'Peso disponibile');
  if (iOrdine < 0 || iSito < 0 || iFine < 0 || iDisp < 0) {
    throw new Error('Non e\' il CSV delle dichiarazioni del portale: mancano le colonne Ordine, storage, Fine trasporto o Peso disponibile.');
  }
  const iOrigine = quale('Origine');
  const iProdotto = quale('Prodotto');
  const iInDich = quale('Peso dichiarato (kg)');
  const iScelto = quale('Selezionato');
  const iFiltro = quale('Escludi ordini inferiori a: (in Kg)', 'Escludi ordini inferiori a');
  const inglese = separatore === ',';

  const righe = [];
  const visti = new Map();
  const doppioni = [];
  const senzaData = [];
  const senzaClasse = [];
  const senzaPeso = [];
  const negativi = [];
  let filtro = null;
  for (let n = 1; n < linee.length; n++) {
    const c = campi(linee[n], separatore);
    const ordine = String(c[iOrdine] || '').trim().toUpperCase();
    if (!ordine) continue;
    if (iFiltro >= 0 && filtro === null) {
      const f = numeroDa(c[iFiltro], { inglese });
      if (f) filtro = f;
    }
    const sito = String(c[iSito] || '').trim();
    const fine = giornoDa(c[iFine]);
    const classe = iProdotto >= 0 ? intero(String(c[iProdotto] || '').replace(/[^\d]/g, '')) : 0;
    const canale = canaleDiClasse(classe);
    // Un peso che non si legge NON diventa zero in silenzio: si segnala. Prima una
    // cella '4.500,00 kg' o una riga piu' corta dell'intestazione toglievano
    // 4.500 kg dalla giacenza senza un avviso, e lo scarto sembrava del gestionale.
    const peso = numeroDa(c[iDisp], { inglese });
    if (peso === null) senzaPeso.push(ordine);
    else if (peso < 0) negativi.push(ordine);
    const riga = {
      riga: n + 1,
      ordine,
      sito,
      sito_chiave: nomeSitoPortale(sito),
      origine: iOrigine >= 0 ? String(c[iOrigine] || '').trim() : '',
      fine_trasporto: fine,
      classe,
      canale,
      disponibile_kg: peso === null ? 0 : intero(peso),
      peso_letto: peso !== null,
      in_dichiarazione_kg: iInDich >= 0 ? intero(numeroDa(c[iInDich], { inglese }) || 0) : 0,
      selezionato: iScelto >= 0 ? /^(si|sì|yes|true|1)$/i.test(String(c[iScelto] || '').trim()) : false,
    };
    // Un ordine ripetuto si conta UNA volta: il portale pagina le sue liste, e
    // due pagine che si sovrappongono farebbero la giacenza piu' grande del vero.
    const chiave = `${riga.sito_chiave}|${ordine}|${riga.classe}`;
    if (visti.has(chiave)) { doppioni.push(ordine); continue; }
    visti.set(chiave, true);
    if (!fine) senzaData.push(ordine);
    if (!canale) senzaClasse.push(ordine);
    righe.push(riga);
  }

  const siti = [];
  for (const r of righe) {
    let s = siti.find(x => x.sito_chiave === r.sito_chiave);
    if (!s) { s = { sito: r.sito, sito_chiave: r.sito_chiave, ordini: 0, rete_kg: 0, aci_kg: 0, senza_canale_kg: 0 }; siti.push(s); }
    s.ordini += 1;
    if (r.canale === 'RETE') s.rete_kg += r.disponibile_kg;
    else if (r.canale === 'ACI') s.aci_kg += r.disponibile_kg;
    else s.senza_canale_kg += r.disponibile_kg;
  }

  const elenca = (lista) => `${lista.slice(0, 5).join(', ')}${lista.length > 5 ? ', ...' : ''}`;
  const avvisi = [];
  if (doppioni.length) avvisi.push(`Nel file ${doppioni.length === 1 ? "c'e' un ordine ripetuto" : `ci sono ${doppioni.length} ordini ripetuti`} (${elenca([...new Set(doppioni)])}): contati una volta sola, altrimenti la giacenza verrebbe piu' grande del vero.`);
  if (senzaPeso.length) avvisi.push(`${senzaPeso.length} ordini hanno un peso disponibile che non si legge come numero (${elenca(senzaPeso)}): contano zero, quindi la giacenza che vedi e' piu' piccola del vero. Controlla quelle righe nel file.`);
  if (negativi.length) avvisi.push(`${negativi.length} ordini hanno un peso disponibile negativo (${elenca(negativi)}): si sottraggono dalla giacenza, e un peso negativo a portale non ha senso.`);
  if (senzaData.length) avvisi.push(`${senzaData.length} ordini non hanno una fine del trasporto valida (${elenca(senzaData)}): senza quella data non si collocano in nessun mese e restano fuori dalla giacenza di fine mese.`);
  if (senzaClasse.length) avvisi.push(`${senzaClasse.length} ordini non hanno una classe riconoscibile (${elenca(senzaClasse)}): non si sa di che canale sono e restano fuori dai conti.`);
  // Il filtro della schermata del portale viaggia dentro l'export: con quello
  // acceso il file e' solo una parte della giacenza, e il riscontro la
  // presenterebbe come il totale (a 5.000 kg darebbe 198.700 invece di 519.920).
  if (filtro) avvisi.push(`Il file e' stato esportato escludendo gli ordini sotto ${intero(filtro).toLocaleString('it-IT')} kg: non e' tutta la giacenza. Rifa' l'esportazione senza quel filtro.`);

  const conData = righe.map(r => r.fine_trasporto).filter(Boolean).sort();
  return {
    colonne,
    righe,
    siti,
    doppioni: [...new Set(doppioni)],
    senza_data: senzaData,
    senza_classe: senzaClasse,
    senza_peso: senzaPeso,
    negativi,
    filtro_kg: filtro ? intero(filtro) : 0,
    // fin dove arriva il file: l'export non ha una colonna con la sua data, ma
    // l'ultima fine trasporto dice fino a quando puo' sapere qualcosa
    primo_giorno: conData[0] || '',
    ultimo_giorno: conData[conData.length - 1] || '',
    avvisi,
  };
}

/**
 * La giacenza a portale di un sito a un certo giorno, da questa lettura: la somma
 * dei pesi disponibili degli ordini con fine trasporto fino a quel giorno
 * compreso. Un canale per volta: RETE e ACI non si sommano mai.
 *
 * @param {object} lettura quello che torna da leggiCsvPortale
 * @param {object} p
 * @param {string} p.sito    ragione sociale del sito (si normalizza da sola)
 * @param {string} p.giorno  'aaaa-mm-gg'; senza, si conta tutto il file
 * @param {string} p.canale  'RETE' (il predefinito) oppure 'ACI'
 */
export function giacenzaCsvAlGiorno(lettura, { sito, giorno = '', canale = 'RETE' } = {}) {
  const chiave = nomeSitoPortale(sito);
  const tutte = lettura && lettura.righe ? lettura.righe : [];
  const miei = tutte.filter(r => (!chiave || r.sito_chiave === chiave) && r.canale === canale);
  // Quello che si lascia fuori si conta, altrimenti un impianto scritto in due modi
  // dimezza la giacenza in silenzio e lo scarto sembra merce che manca.
  const altriSiti = chiave ? tutte.filter(r => r.sito_chiave !== chiave) : [];
  const altroCanale = tutte.filter(r => (!chiave || r.sito_chiave === chiave) && r.canale !== canale);
  const dentro = miei.filter(r => r.fine_trasporto && (!giorno || r.fine_trasporto <= giorno));
  const dopo = miei.filter(r => r.fine_trasporto && giorno && r.fine_trasporto > giorno);
  const somma = (lista) => lista.reduce((s, r) => s + r.disponibile_kg, 0);
  const perClasse = {};
  const perMese = {};
  for (const r of dentro) {
    perClasse[r.classe] = (perClasse[r.classe] || 0) + r.disponibile_kg;
    const m = r.fine_trasporto.slice(0, 7);
    perMese[m] = (perMese[m] || 0) + r.disponibile_kg;
  }
  return {
    canale,
    sito: miei.length ? miei[0].sito : String(sito || ''),
    giorno,
    kg: somma(dentro),
    ordini: dentro.length,
    per_classe: perClasse,
    per_mese: perMese,
    // quello che e' arrivato DOPO il giorno: in giacenza c'e', ma non riguarda il
    // mese che si sta dichiarando (precisazione dell'utente del 03/10/2026)
    dopo_kg: somma(dopo),
    dopo_ordini: dopo.length,
    senza_data_kg: somma(miei.filter(r => !r.fine_trasporto)),
    // lasciati fuori: altri impianti nel file, e l'altro canale di questo impianto
    altri_siti_kg: somma(altriSiti),
    altri_siti: [...new Set(altriSiti.map(r => r.sito))],
    altro_canale_kg: somma(altroCanale),
  };
}

/**
 * Il riscontro: quello che dice il portale contro quello che dice il gestionale.
 * Il numero del gestionale resta quello buono, lo scarto si dichiara.
 */
export function riscontroGiacenza(csvKg, gestionaleKg) {
  const a = intero(csvKg);
  const b = intero(gestionaleKg);
  return { portale_kg: a, gestionale_kg: b, scarto_kg: a - b, torna: a === b };
}
