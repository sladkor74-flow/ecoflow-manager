import { leggiStatoDati, intestazioneDocumento, nuovaCartella, foglioDaRighe, scaricaCartella, FORMATI } from '@/lib/fogliProfessionali';

// IL FOGLIO DEGLI ORDINI RIMASTI «ESEGUITO» (richiesta dell'utente del
// 14/10/2026: segnalati con l'ID «affinche' vi si possa porre subito rimedio»).
//
// Un foglio pulito da tenere aperto accanto al portale mentre si chiudono: un
// foglio per gruppo - primarie rete, primarie ACI, secondarie, terziarie, ogni
// canale a parte, mai sommati (regola 3) - con la veste dei documenti del
// gestionale (fogliProfessionali.js): fascia, canale, dati fino al, generato il
// ... da .... Le righe sono quelle della regola unica (src/lib/ordiniEseguiti.js),
// le stesse che si leggono sotto la scheda del caricamento e nella dashboard.

const COLONNE = (g) => ['ID ordine', 'Numero FIR', g.chi || 'Trasportatore', g.dove || 'Origine', 'Provincia', 'Destinazione', 'Immesso il', 'Fine trasporto', 'Giorni dalla fine trasporto', 'Peso effettivo (kg)', 'Cosa manca'];

// Un giorno 'AAAA-MM-GG' come data di Excel, a mezzanotte UTC: il foglio mostra
// quel giorno qualunque sia il fuso di chi lo apre. Senza giorno, la cella resta
// vuota: un valore che manca non e' una data.
const data = (g) => (g ? new Date(Date.UTC(+g.slice(0, 4), +g.slice(5, 7) - 1, +g.slice(8, 10))) : null);

/** Le righe di un gruppo, come le scrive il foglio (le prove le leggono da qui). */
export function righeDelGruppo(g) {
  return (g.elenco || []).map(o => [
    o.id_ordine || '', o.numero_fir || '', o.soggetto || '', o.luogo || '', o.provincia || '', o.destinazione || '',
    data(o.immesso_il), data(o.fine_trasporto),
    o.giorni === null || o.giorni === undefined ? null : o.giorni,
    o.kg === null || o.kg === undefined ? null : o.kg,
    o.manca || '',
  ]);
}

/**
 * Scarica il foglio. gruppi: quelli di ordiniEseguiti. opzioni.stato: lo stato
 * dei dati gia' letto (le prove); altrimenti si chiede una volta sola al server
 * per tutti gli archivi dei gruppi.
 */
export async function scaricaExcelEseguiti(gruppi, opzioni = {}) {
  const conOrdini = (gruppi || []).filter(g => (g.elenco || []).length);
  if (!conOrdini.length) return null;
  const entita = [...new Set(conOrdini.map(g => g.entita).filter(Boolean))];
  const stato = opzioni.stato !== undefined ? opzioni.stato : await leggiStatoDati(entita);
  const adesso = opzioni.adesso || new Date();
  const { wb } = await nuovaCartella();
  for (const g of conOrdini) {
    const doc = intestazioneDocumento({
      titolo: `Ordini in «eseguito» a portale — ${g.nome}`,
      sottotitolo: 'da chiudere a portale',
      canale: g.canale,
      stato,
      generatoIl: adesso,
    });
    const nota = g.ordini > g.elenco.length ? [[`Nel foglio i primi ${g.elenco.length} ordini su ${g.ordini}: gli altri si vedono nella pagina del modulo.`]] : [];
    foglioDaRighe(wb, g.nome, {
      doc,
      righe: [...nota, COLONNE(g), ...righeDelGruppo(g)],
      testate: [nota.length],
      stili: nota.length ? { 0: 'nota' } : {},
      formati: { 8: FORMATI.intero, 9: FORMATI.kg },
      larghezze: [16, 18, 30, 34, 10, 26, 12, 14, 12, 14, 70],
    });
  }
  // Il giorno italiano nel nome del file, gg-mm-aaaa.
  const oggi = adesso.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }).split('-').reverse().join('-');
  return scaricaCartella(wb, `Ordini in eseguito ${oggi}.xlsx`);
}
