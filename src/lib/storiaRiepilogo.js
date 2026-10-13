// LE PAROLE DELLA STORIA DI UNA RIGA DEL RIEPILOGO (12/10/2026).
//
// L'utente, sul caso T-Cycle: a marzo si sono dichiarati 146.860 kg, cioe'
// gennaio e febbraio, «ma risulta nulla in giacenza», e «a marzo risultano
// 20.620 kg che mancano dai conteggi». Il report del portale lo spiega ordine
// per ordine: la dichiarazione caricata il 03/04 ha coperto gennaio 87,74 +
// febbraio 36,42 + 22,70 t di marzo; le 20,62 t rimaste di marzo le ha coperte
// quella del 26/06. Qui ci sono le frasi che lo dicono al tocco sulla casella
// e nel foglio Excel, dagli agganci che riepilogoDichiarazioni porta gia' fatti
// (dichiarazione_copre e coperto_da di ogni mese, giacenza_fine_kg): nessun
// numero si ricalcola qui, e nessuno di questi entra nei conti.
//
// Pure, senza React: le usano la pagina (StoriaRiga.jsx, Riepilogo.jsx) e il
// foglio (dichiarazioniExport.js), e le prove le caricano in node: per questo
// gli import sono relativi, che node risolve anche quando questo file lo carica
// un altro modulo (l'alias @/ lo sa risolvere solo Vite, o il caricatore delle
// prove per il primo file).
import { MESI, MESI_BREVI } from './dichiarazioniImpianti.js';
import { formatTonnellate } from './utils.js';

const t = (kg) => `${formatTonnellate((Number(kg) || 0) / 1000)} t`;
const numero = (kg) => formatTonnellate((Number(kg) || 0) / 1000);
const gg = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '');
const breve = (nome) => {
  const i = MESI.indexOf(nome);
  return i >= 0 ? MESI_BREVI[i].toLowerCase() : String(nome || '').toLowerCase();
};
const minuscolo = (s) => String(s || '').toLowerCase();
const volte = (n) => (n === 2 ? 'due' : n === 3 ? 'tre' : String(n));
// «fino ad aprile», «fino a settembre».
const finoA = (mese) => `fino ${/^a/.test(mese) ? 'ad' : 'a'} ${mese}`;

/** «146,86 t = gen 87,74 + feb 36,42 + mar 22,70»: gli agganci di una dichiarazione. */
export function sommaCopertura(c) {
  if (!c) return '';
  const pezzi = [
    ...(c.prima_kg > 0 ? [`anni prima ${numero(c.prima_kg)}`] : []),
    ...(c.mesi || []).map(x => `${breve(x.mese)} ${numero(x.kg)}`),
  ];
  return `${t(c.kg)} = ${pezzi.join(' + ')}`;
}

/** Quando e come e' stata caricata: «il 03/04/2026», «in due volte, 11/03/2026 e 12/03/2026». */
const caricataIl = (giorni) => ((giorni || []).length > 1
  ? `in ${volte(giorni.length)} volte, ${giorni.map(gg).join(' e ')}`
  : `il ${gg((giorni || [])[0])}`);

/** Chi ha coperto gli arrivi di un mese: «20,62 t di marzo coperte dalla dichiarazione di giugno (26/06/2026)». */
export function copertoDaDetto(m) {
  const mese = minuscolo(m && m.mese);
  return ((m && m.coperto_da) || []).map(v => `${t(v.kg)} di ${mese} coperte ${v.mese
    ? `dalla dichiarazione di ${minuscolo(v.mese)} (${(v.giorni || []).map(gg).join(' e ')})`
    : `da un caricamento del portale del ${(v.giorni || []).map(gg).join(' e ')} che qui non è fra le dichiarazioni`}`);
}

/**
 * C'E' QUALCOSA DA DIRE OLTRE IL COLORE? Una dichiarazione che ha coperto
 * altri mesi (o anni prima, o non tutto il suo), un mese coperto da una
 * dichiarazione di un altro mese o in piu' volte. Gatim, che dichiara mese per
 * mese, non ha niente da aggiungere, e la casella resta pulita.
 */
export function casellaDaSpiegare(m) {
  if (!m) return false;
  const c = m.dichiarazione_copre;
  const copreAltro = !!c && (c.prima_kg > 0 || c.parziale || !!c.insieme
    || (c.mesi || []).some(x => x.mese !== m.mese)
    || ((c.mesi || [])[0] && c.mesi[0].kg !== m.conferito_kg));
  const da = m.coperto_da || [];
  const copertoDaAltri = da.length > 1 || (da.length === 1 && da[0].mese !== m.mese);
  return copreAltro || copertoDaAltri;
}

/** Il perche' di una casella, frase per frase. */
export function percheCasella(m) {
  if (!m) return [];
  const frasi = [];
  const c = m.dichiarazione_copre;
  const mese = minuscolo(m.mese);
  if (c) {
    frasi.push(c.insieme
      ? `Dichiarazioni di ${c.insieme.map(minuscolo).join(' e ')}, caricate insieme a portale ${copreInUnaCella(m)}.`
      : `Dichiarazione di ${mese}, ${coperturaCaricata(m)}.`);
    if (c.parziale) frasi.push(`Il report del portale ne aggancia ${t(c.kg)} su ${t(m.caricato_kg)} caricate.`);
    if ((c.mesi || []).some(x => MESI.indexOf(x.mese) < MESI.indexOf(m.mese)) || c.prima_kg > 0) {
      frasi.push('Il portale copre sempre prima i carichi più vecchi ancora aperti: per questo la dichiarazione non svuota il suo mese ma quelli di prima.');
    }
  }
  const da = m.coperto_da || [];
  if (da.length > 1 || (da.length === 1 && da[0].mese !== m.mese)) {
    if (da.length > 1) frasi.push(`${MESI[MESI.indexOf(m.mese)] || m.mese} è stato coperto in ${volte(da.length)} volte:`);
    for (const x of copertoDaDetto(m)) frasi.push(`${x}.`);
  }
  if (m.giacenza_fine_kg !== null && m.giacenza_fine_kg !== undefined && (c || m.caricato_kg > 0)) {
    frasi.push(m.giacenza_fine_kg > 0 ? `A fine ${mese} restavano in giacenza ${t(m.giacenza_fine_kg)}.` : `A fine ${mese} in giacenza non restava niente.`);
  }
  return frasi;
}

/**
 * IL NUMERO DELLA GIACENZA A FINE MESE SI APRE AL TOCCO dove c'e' qualcosa da
 * dire: una dichiarazione caricata, una parte della giacenza che la chiusura sul
 * canale sposta fra le righe dell'ACI, o lo spostamento che cambia rispetto al
 * mese prima (seconda revisione del 13/10/2026). Gatim ACI, con la
 * dichiarazione d'aprile scritta 1.800 kg sulla provenienza sbagliata: a
 * settembre lo spostamento finisce, la secondaria passa da 0 a 14,62 t con
 * 12,82 t arrivate e la primaria da 0 a 10,55 con 12,35, e al tocco non si
 * apriva niente. `precedente` e' il mese prima (null per gennaio).
 */
export function fineMeseDaSpiegare(m, precedente) {
  if (!m || m.giacenza_fine_kg === null || m.giacenza_fine_kg === undefined) return false;
  const spostato = Number(m.spostato_dal_canale_kg) || 0;
  const spostatoPrima = Number(precedente && precedente.spostato_dal_canale_kg) || 0;
  return m.caricato_kg > 0 || spostato !== 0 || spostato !== spostatoPrima;
}

/**
 * COME FINISCE UNO SPOSTAMENTO FRA LE RIGHE DI UN CANALE (revisione finale del
 * 13/10/2026): la stessa regola, scritta uguale, di comeFinisceLoSpostamento in
 * base44/shared/storiaDichiarazioni.ts, che la usa per il racconto della riga;
 * la prova spostamentoCheRientra.mjs le confronta caso per caso. Il perche' lo
 * decide la riga che era in eccesso, lo stesso su tutte e due le righe: se a
 * fine mese e' ancora sotto zero le altre non hanno piu' carichi da cui
 * toglierlo ('senza_carichi'), se no l'hanno riassorbito i suoi arrivi
 * ('riassorbito'). Sulla riga che cedeva serve la giacenza del canale
 * (`giacenza_canale_fine_kg`, sul mese): la sua giacenza a 0 non dice se
 * l'altra e' ancora in eccesso o se ha dichiarato lei le tonnellate che le
 * tornano. `dichiarato_kg`: quante di quelle tonnellate la riga che cedeva ha
 * dichiarato nello stesso mese; `oltre_kg`: di quanto le sue dichiarazioni del
 * mese superano i suoi arrivi del mese.
 */
export function comeFinisceLoSpostamento(m, precedente) {
  const kgInt = (v) => Math.round(Number(v) || 0);
  const eNumero = (v) => typeof v === 'number' && Number.isFinite(v);
  const prima = kgInt(precedente && precedente.spostato_dal_canale_kg);
  if (!m || !prima || kgInt(m.spostato_dal_canale_kg)) return null;
  if (!eNumero(m.giacenza_fine_kg) || !eNumero(precedente.giacenza_fine_kg)) return null;
  const kg = Math.abs(prima);
  const cedeva = prima < 0;
  const g = kgInt(m.giacenza_fine_kg);
  const gPrima = kgInt(precedente.giacenza_fine_kg);
  const conCanale = eNumero(m.giacenza_canale_fine_kg) && eNumero(precedente.giacenza_canale_fine_kg);
  const altre = conCanale ? kgInt(m.giacenza_canale_fine_kg) - g : null;
  const altrePrima = conCanale ? kgInt(precedente.giacenza_canale_fine_kg) - gPrima : null;
  const oltre = cedeva ? gPrima + kg - g : conCanale ? altrePrima + kg - altre : null;
  const perche = !cedeva ? (g >= 0 ? 'riassorbito' : 'senza_carichi')
    : conCanale ? (altre < 0 ? 'senza_carichi' : 'riassorbito')
      : g > 0 ? 'riassorbito' : null;
  return { kg, cedeva, perche, oltre_kg: oltre, dichiarato_kg: oltre === null ? null : Math.min(kg, Math.max(0, oltre)) };
}

/** Il perche' della giacenza a fine mese: che cosa e' entrato e che cosa e' uscito fin li'. */
export function percheFineMese(m, prima, precedente = null) {
  if (!m || m.giacenza_fine_kg === null || m.giacenza_fine_kg === undefined) return [];
  const mese = minuscolo(m.mese);
  const fine = Number(m.giacenza_fine_kg) || 0;
  // LA CHIUSURA SUL CANALE (revisione del 13/10/2026): sull'ACI, che ha due
  // righe, quello che la dichiarazione di una riga copre oltre il suo arrivato
  // si toglie dal carico piu' vecchio dell'altra, come nella colonna «Da
  // dichiarare». Il numero della riga allora non e' entrato meno caricato, e si
  // dice perche'. Quando lo spostamento finisce, il mese dice come (seconda
  // revisione del 13/10/2026): mai «sono uscite», perche' finche' la riga in
  // eccesso non riceve arrivi suoi lo spostamento puo' tornare indietro.
  const spostato = Number(m.spostato_dal_canale_kg) || 0;
  const spostatoPrima = Number(precedente && precedente.spostato_dal_canale_kg) || 0;
  const mesePrima = minuscolo(precedente && precedente.mese);
  const dallAnnoPrima = prima ? ", dall'anno prima compreso," : '';
  const frasi = [];
  if (!spostato) {
    frasi.push(`A fine ${mese}: ${t(fine)} in giacenza. È quello che è entrato ${finoA(mese)}${dallAnnoPrima} meno le dichiarazioni caricate ${finoA(mese)}, nella colonna in cui stanno.`);
  } else {
    const grezzo = fine - spostato;
    frasi.push(`A fine ${mese}: ${t(fine)} in giacenza. ${grezzo >= 0
      ? `Quello che è entrato ${finoA(mese)}${dallAnnoPrima} meno le dichiarazioni caricate ${finoA(mese)}, nella colonna in cui stanno, fa ${t(grezzo)}`
      : `Le dichiarazioni caricate su questa riga ${finoA(mese)} superano di ${t(-grezzo)} quello che vi è entrato${prima ? ", dall'anno prima compreso" : ''}`}: la differenza la fa la chiusura sul canale.`);
  }
  if (m.dichiarazione_copre) frasi.push(`In ${mese} la dichiarazione caricata ha coperto ${sommaCopertura(m.dichiarazione_copre)}.`);
  else if (m.caricato_kg > 0) frasi.push(`In ${mese} si sono caricate ${t(m.caricato_kg)}.`);
  const primaDetto = spostatoPrima && Math.sign(spostatoPrima) === Math.sign(spostato) && spostatoPrima !== spostato ? ` (a fine ${mesePrima} erano ${t(Math.abs(spostatoPrima))})` : '';
  if (spostato > 0) frasi.push(`Le righe di un canale si chiudono insieme, come la colonna «Da dichiarare»: le ${t(spostato)} dichiarate su questa riga oltre quello che vi era arrivato si tolgono dai carichi più vecchi di un'altra riga dello stesso canale${primaDetto}.`);
  else if (spostato < 0) frasi.push(`Le righe di un canale si chiudono insieme, come la colonna «Da dichiarare»: un'altra riga dello stesso canale ha dichiarato più di quello che vi era arrivato, e ${t(-spostato)} si tolgono dai carichi più vecchi di questa${primaDetto}.`);
  else if (spostatoPrima) {
    // Come finisce, col perche' della riga che era in eccesso, lo stesso del
    // racconto su tutte e due le righe (revisione finale del 13/10/2026).
    const fn = comeFinisceLoSpostamento(m, precedente);
    const kg = Math.abs(spostatoPrima);
    const d = fn ? fn.dichiarato_kg : null;
    const superaDi = fn && fn.oltre_kg !== null ? `supera di ${t(fn.oltre_kg)} quello che vi è arrivato nel mese` : '';
    if (spostatoPrima > 0) {
      if (fn ? fn.perche === 'riassorbito' : fine >= 0) {
        frasi.push(`Fino a fine ${mesePrima} le ${t(kg)} dichiarate su questa riga oltre quello che vi era arrivato si toglievano dai carichi di un'altra riga dello stesso canale: da ${mese} le coprono gli arrivi di questa riga, come nella colonna «Da dichiarare».`);
        if (d === kg) frasi.push(`Le ${t(kg)} tornano all'altra riga, che a ${mese} le ha dichiarate.`);
        else if (d > 0) frasi.push(`Le ${t(kg)} tornano all'altra riga: ${t(d)} le ha dichiarate a ${mese}, ${t(kg - d)} tornano nella sua giacenza.`);
        else if (d === 0) frasi.push(`Le ${t(kg)} tornano nella giacenza dell'altra riga.`);
      } else {
        frasi.push(`Fino a fine ${mesePrima} le ${t(kg)} dichiarate su questa riga oltre quello che vi era arrivato si toglievano dai carichi di un'altra riga dello stesso canale: a fine ${mese} ${d === kg
          ? `quella riga non ha più carichi da cui toglierle, perché a ${mese} ha dichiarato le sue ${t(kg)}`
          : 'le altre righe non hanno più carichi da cui toglierle'}, e la giacenza va sotto zero. È un errore da correggere.`);
      }
    } else {
      const fino = `Fino a fine ${mesePrima} ${t(kg)} di questa riga si toglievano per le dichiarazioni di un'altra riga dello stesso canale`;
      // Quante di quelle tonnellate questa riga ha dichiarato nello stesso mese.
      const dichiarate = d === kg ? `A ${mese} questa riga le ha dichiarate: la sua dichiarazione ${superaDi}.`
        : d > 0 ? `A ${mese} questa riga ne ha dichiarate ${t(d)}, perché la sua dichiarazione ${superaDi}; ${t(kg - d)} tornano nella sua giacenza.` : '';
      if (fn && fn.perche === 'riassorbito') {
        frasi.push(dichiarate
          ? `${fino}, che avevano coperto più di quello che vi era arrivato: da ${mese} le coprono gli arrivi di quella riga, e le ${t(kg)} tornano a questa.`
          : `${fino}, che avevano coperto più di quello che vi era arrivato: da ${mese} le coprono gli arrivi di quella riga, e tornano nella giacenza di questa.`);
        if (dichiarate) frasi.push(dichiarate);
      } else if (fn && fn.perche === 'senza_carichi') {
        frasi.push(`${fino}: a fine ${mese} qui non resta niente da togliere${d === kg ? `, perché a ${mese} questa riga ha dichiarato le sue ${t(kg)}` : ''}, e la giacenza dell'altra riga va sotto zero. È un errore da correggere.`);
      } else {
        // Senza la giacenza del canale non si sa chi l'ha chiuso: si dice il fatto.
        frasi.push(dichiarate ? `${fino}: da ${mese} la chiusura non le toglie più, e tornano a questa riga.` : `${fino}: da ${mese} la chiusura sul canale non le toglie più.`);
        if (dichiarate) frasi.push(dichiarate);
      }
    }
  }
  return frasi;
}

/** «Coperto da» per il foglio: le frasi di copertoDaDetto, in una cella. */
export const copertoDaInUnaCella = (m) => copertoDaDetto(m).join('; ');

/** Gli agganci della dichiarazione di quel mese, in una cella: «146,86 t = gen 87,74 + ...». */
export const copreInUnaCella = (m) => (m && m.dichiarazione_copre ? `${caricataIl(m.dichiarazione_copre.giorni)}: ${sommaCopertura(m.dichiarazione_copre)}` : '');

/**
 * UNA COPERTURA SOLA PER CASELLA (revisione del 13/10/2026). «caricata a portale
 * il 03/04/2026: 146,86 t = gen 87,74 + feb 36,42 + mar 22,70», o «in due volte,
 * 11/03/2026 e 12/03/2026: 721,66 t = ...»: la stessa frase nella «i», nella
 * tendina della casella (CellaMese), nel dialogo del mese (DialogoMese) e nella
 * scheda Impianti (SezioneImpianto), dallo stesso aggancio (dichiarazione_copre).
 * Prima i tre leggevano `copre`, un giorno solo: su Irigom febbraio dicevano
 * 174.400 kg, la «i» 721.660. Due dichiarazioni caricate lo stesso giorno
 * hanno un caricamento solo, e il peso e' di tutte e due: si dice con chi.
 */
export const coperturaCaricata = (m) => {
  if (!m || !m.dichiarazione_copre) return '';
  const altre = (m.dichiarazione_copre.insieme || []).filter(x => x !== m.mese).map(minuscolo);
  return `caricata a portale${altre.length ? `, insieme a quella di ${altre.join(' e ')},` : ''} ${copreInUnaCella(m)}`;
};
