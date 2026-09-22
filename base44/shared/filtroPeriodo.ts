import { giornoRoma } from "./giornoItaliano.ts";
import { eTerminato, giornoMovimento, dateDaSistemare, testoDate, GIORNI_SCADENZA_ORDINE } from "./movimenti.ts";

// Filtro periodo condiviso per fatturazione attiva, passiva e anteprima Ecotyre.
// Regola: stato="terminato" + trasporto_finito_il cade in anno/mese.
// Non usa mai i campi mese, anno o ordine_chiuso_il dei record per stabilire il periodo.
// Stessa regola di calcolaPassiva. Un terminato senza fine trasporto resta fuori,
// ma si segnala: anomalieDateFormulari, in fondo al file.

const MESI_MAP = {
  'gennaio': 0, 'febbraio': 1, 'marzo': 2, 'aprile': 3, 'maggio': 4, 'giugno': 5,
  'luglio': 6, 'agosto': 7, 'settembre': 8, 'ottobre': 9, 'novembre': 10, 'dicembre': 11
};

// Converte il nome italiano del mese nell'indice 0-11.
// Gestisce anche un numero da 1 a 12 (1 = Gennaio). Restituisce -1 se non riconosciuto.
export function meseToIndice(mese) {
  if (typeof mese === 'number') {
    if (mese >= 1 && mese <= 12) return mese - 1;
    return -1;
  }
  const m = String(mese || '').toLowerCase().trim();
  if (MESI_MAP[m] !== undefined) return MESI_MAP[m];
  const n = Number(m);
  if (!isNaN(n) && n >= 1 && n <= 12) return n - 1;
  return -1;
}

// Restituisce i soli record che soddisfano entrambe le condizioni:
// - stato (minuscolo, trim) === "terminato"
// - trasporto_finito_il valorizzato, interpretabile come data, cade in anno/mese
// Scarta i record senza trasporto_finito_il.
export function filtraPeriodo(records, anno, mese) {
  const annoNum = Number(anno);
  const meseNum = meseToIndice(mese);
  if (meseNum < 0 || isNaN(annoNum)) return [];
  return (records || []).filter(r => {
    const stato = String(r.stato || '').toLowerCase().trim();
    if (stato !== 'terminato') return false;
    // Il giorno e' quello italiano: una data salvata alle 22:00Z appartiene al
    // giorno dopo, e a cavallo di fine mese cambierebbe mese.
    const g = giornoRoma(r.trasporto_finito_il);
    if (!g) return false;
    if (Number(g.slice(0, 4)) !== annoNum) return false;
    if (Number(g.slice(5, 7)) - 1 !== meseNum) return false;
    return true;
  });
}

// ─── Le date obbligatorie dei formulari, in fatturazione ───
// Regola dell'utente del 22/09/2026: «le date immissione, inizio e fine trasporto
// sono obbligatorie nei formulari, se non ci sono vanno segnalate e questo vale
// sempre dove ci sono ordini terminati». La regola sta in movimenti.ts
// (dateMancanti, dateIncoerenti, testoDate); qui si decide soltanto quali
// terminati riguardano la fatturazione di un mese e come si dice.
//
// - Un terminato SENZA FINE TRASPORTO resta fuori dal mese (filtraPeriodo non lo
//   prende) e da ogni altro, ma si segnala in ogni mese in cui potrebbe cadere
//   (senzaFineNelMese): quelli dello stesso anno a partire dal mese di
//   immissione, perche' un trasporto non finisce prima che l'ordine sia immesso;
//   e, per chi e' immesso l'anno prima, i primi mesi dell'anno, fino a quello in
//   cui cadono i GIORNI_OLTRE_ANNO dopo l'immissione (o dopo l'inizio trasporto,
//   se e' piu' tardi). Chi non ha nemmeno l'immissione si segnala sempre: non si
//   sa dove metterlo.
// - Un terminato DEL MESE a cui manca l'immissione o l'inizio trasporto, o che ha
//   le date nell'ordine sbagliato, resta nel mese (la fine trasporto c'e') e si
//   segnala.
const MESI_TESTO = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const NOME_CANALE_DATE = { RETE: 'rete', ACI: 'ACI', EXTRA_RACCOLTA: 'extra raccolta' };
const QUANTI_IN_TESTO = 15;
// l'elenco che viaggia con l'anomalia: il numero vero e' in quanti, e le risposte
// delle funzioni (e dell'assistente) non devono portarsi dietro mille righe
const QUANTI_IN_ELENCO = 100;
const ggmmaaaa = (g) => (g ? g.split('-').reverse().join('/') : '');

// Un ordine immesso il 20 dicembre e iniziato il 28, senza fine trasporto, e'
// finito quasi certamente a gennaio: prima si segnalava solo a dicembre, e nella
// fatturazione dell'anno dopo, dove piu' probabilmente cade, non compariva mai
// (revisione del 22/09/2026 sulla regola delle date obbligatorie, che l'utente
// vuole segnalate «sempre»). Nell'anno dopo si segnala per i 30 giorni della
// scadenza dell'ordine (GIORNI_SCADENZA_ORDINE) piu' altrettanti di margine per
// un ritiro in ritardo; non oltre, perche' un ordine vecchio ripetuto in ogni
// mese a tempo indeterminato nasconderebbe quelli nuovi.
const GIORNI_OLTRE_ANNO = GIORNI_SCADENZA_ORDINE * 2;
const piuGiorni = (g, n) => new Date(Date.UTC(+g.slice(0, 4), +g.slice(5, 7) - 1, +g.slice(8, 10)) + n * 86400000).toISOString().slice(0, 10);

/** Se un terminato senza fine trasporto va segnalato nella fatturazione del mese meseIdx (0-11) di annoNum. */
function senzaFineNelMese(r, annoNum, meseIdx) {
  const immesso = giornoRoma(r.ordine_immesso_il);
  if (!immesso) return true;
  const annoImm = Number(immesso.slice(0, 4));
  if (annoImm === annoNum) return meseIdx >= Number(immesso.slice(5, 7)) - 1;
  if (annoImm !== annoNum - 1) return false;
  const inizio = giornoRoma(r.trasporto_iniziato_il);
  const ultimo = piuGiorni(inizio && inizio > immesso ? inizio : immesso, GIORNI_OLTRE_ANNO);
  return `${annoNum}-${String(meseIdx + 1).padStart(2, '0')}-01` <= ultimo;
}

const voceDate = (r) => ({
  id: r.id || '',
  ordine: String(r.id_ordine || '').trim(),
  numero_fir: String(r.numero_fir || '').trim(),
  kg: Math.round(Number(r.peso_effettivo || 0)),
  immesso_il: giornoRoma(r.ordine_immesso_il),
  problema: testoDate(r),
});

/**
 * I terminati di UN canale con le date da segnalare nella fatturazione di un
 * mese: { senza_fine: [...], da_sistemare: [...] }. Ogni voce e'
 * { id, ordine, numero_fir, kg, immesso_il ('AAAA-MM-GG' o ''), problema }.
 * meseIdx e' l'indice 0-11.
 */
export function dateDaSegnalare(records, anno, meseIdx) {
  const annoNum = Number(anno);
  const esito = { senza_fine: [], da_sistemare: [] };
  if (!(meseIdx >= 0 && meseIdx <= 11) || isNaN(annoNum)) return esito;
  for (const r of records || []) {
    if (!eTerminato(r)) continue;
    const fine = giornoMovimento(r);
    if (!fine) {
      if (senzaFineNelMese(r, annoNum, meseIdx)) esito.senza_fine.push(voceDate(r));
      continue;
    }
    if (Number(fine.slice(0, 4)) !== annoNum || Number(fine.slice(5, 7)) - 1 !== meseIdx) continue;
    if (dateDaSistemare(r)) esito.da_sistemare.push(voceDate(r));
  }
  return esito;
}

// "ET26084363 (FIR RGYTR022620TW), immesso il 03/08/2026: manca la data di fine trasporto"
const testoVoce = (v, conImmissione) => {
  const nome = v.ordine || v.numero_fir || v.id || '—';
  const fir = v.ordine && v.numero_fir ? ` (FIR ${v.numero_fir})` : '';
  const immesso = conImmissione ? (v.immesso_il ? `, immesso il ${ggmmaaaa(v.immesso_il)}` : '') : '';
  return `${nome}${fir}${immesso}: ${v.problema}`;
};
const elencoVoci = (voci, conImmissione) => {
  const primi = voci.slice(0, QUANTI_IN_TESTO).map(v => testoVoce(v, conImmissione)).join('; ');
  return voci.length > QUANTI_IN_TESTO ? `${primi}; e altri ${voci.length - QUANTI_IN_TESTO}` : primi;
};

/**
 * Le anomalie delle date per UN canale nella fatturazione di un mese: al piu' due
 * voci, una per i terminati senza fine trasporto (tipo 'date_senza_fine') e una
 * per quelli del mese con altre date mancanti o incoerenti (tipo
 * 'date_da_sistemare'). Ciascuna: { tipo, canale, quanti, kg, ordini, descrizione }.
 * Quanti e quali, per canale: i canali non si sommano nemmeno qui.
 */
export function anomalieDateFormulari(records, anno, meseIdx, canale) {
  const { senza_fine, da_sistemare } = dateDaSegnalare(records, anno, meseIdx);
  const nome = NOME_CANALE_DATE[canale] || String(canale || '').toLowerCase();
  const periodo = `${MESI_TESTO[meseIdx]} ${anno}`;
  const kg = (voci) => voci.reduce((s, v) => s + v.kg, 0);
  const anomalie = [];
  if (senza_fine.length) {
    const n = senza_fine.length;
    anomalie.push({
      tipo: 'date_senza_fine', canale, quanti: n, kg: kg(senza_fine), ordini: senza_fine.slice(0, QUANTI_IN_ELENCO),
      descrizione: `${n === 1 ? 'Un terminato' : `${n} terminati`} di ${nome} senza la data di fine trasporto ${n === 1 ? 'potrebbe' : 'potrebbero'} essere di ${periodo}: ${n === 1 ? 'resta' : 'restano'} fuori da questo mese e da ogni altro finche' la data non si scrive. Le date di immissione, inizio e fine trasporto sono obbligatorie. ${elencoVoci(senza_fine, true)}.`,
    });
  }
  if (da_sistemare.length) {
    const n = da_sistemare.length;
    anomalie.push({
      tipo: 'date_da_sistemare', canale, quanti: n, kg: kg(da_sistemare), ordini: da_sistemare.slice(0, QUANTI_IN_ELENCO),
      descrizione: `${n === 1 ? 'Un terminato' : `${n} terminati`} di ${nome} di ${periodo} con le date da sistemare (immissione, inizio e fine trasporto sono obbligatorie, in quest'ordine): ${n === 1 ? 'resta' : 'restano'} nel mese per la fine trasporto, ma il formulario va corretto. ${elencoVoci(da_sistemare, false)}.`,
    });
  }
  return anomalie;
}

/**
 * I terminati senza fine trasporto di UN canale che la fatturazione segnala in
 * almeno un mese dell'anno, da gennaio a finoAlMese compreso, ciascuno una volta:
 * { tipo: 'date_senza_fine', canale, quanti, kg, ordini, descrizione } oppure
 * null. Serve a chi dice i senza fine una volta per l'anno (il margine): l'ultimo
 * mese calcolato non basta, perche' chi e' immesso l'anno prima si segnala solo
 * nei primi mesi.
 */
export function anomaliaSenzaFineAnno(records, anno, finoAlMese, canale) {
  const annoNum = Number(anno);
  const ultimo = Math.min(11, Number(finoAlMese));
  if (!(ultimo >= 0) || isNaN(annoNum)) return null;
  const voci = [];
  for (const r of records || []) {
    if (!eTerminato(r) || giornoMovimento(r)) continue;
    for (let m = 0; m <= ultimo; m++) {
      if (senzaFineNelMese(r, annoNum, m)) { voci.push(voceDate(r)); break; }
    }
  }
  if (!voci.length) return null;
  const n = voci.length;
  const nome = NOME_CANALE_DATE[canale] || String(canale || '').toLowerCase();
  return {
    tipo: 'date_senza_fine', canale, quanti: n, kg: voci.reduce((s, v) => s + v.kg, 0), ordini: voci.slice(0, QUANTI_IN_ELENCO),
    descrizione: `${n === 1 ? 'Un terminato' : `${n} terminati`} di ${nome} senza la data di fine trasporto ${n === 1 ? 'potrebbe' : 'potrebbero'} essere di un mese del ${annoNum} fino a ${MESI_TESTO[ultimo]}: ${n === 1 ? 'resta' : 'restano'} fuori da ogni mese, e quindi dal margine, finche' la data non si scrive. Le date di immissione, inizio e fine trasporto sono obbligatorie. ${elencoVoci(voci, true)}.`,
  };
}
