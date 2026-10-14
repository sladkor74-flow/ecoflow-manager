import { prezzoATonnellata } from './ecotyreTariffe.js';
import { soloFormulari, soloSurplus, pezziSurplusReport, righeAParole, vestiRigaSurplusFoglio } from './surplusVista.js';
import { euro } from './formatoSoldi.js';
import { documentoDa, nuovaCartella, intestazione, rigaDettaglio, rigaTotale, formatta, bloccaRighe, perLaStampa, foglioNote, scaricaCartella, FORMATI, COLORI } from '@/lib/fogliProfessionali';

// I report della fatturazione attiva per l'amministrazione: tre, separati (rete,
// ACI, extra raccolta), in Excel e in PDF. Le colonne sono quelle chieste
// dall'amministrazione e non si toccano senza il suo assenso. La tabella si
// costruisce in un punto solo (tabellaAttiva): Excel e PDF dicono le stesse cose.

// Il tipo di servizio come lo scrive la prefattura del portale: dipende
// dall'impianto di destinazione (Trasp. quando il trattamento lo fattura Ecotyre).
const tipoServizio = (r) => (r.servizio_ecotyre === 'TRASP' ? 'Trasp.' : 'Trasp.+Tratt.');

// Il prezzo si scrive in euro a TONNELLATA, in tutti i report: nel 2026 a Ecotyre
// si fattura a 202 euro la tonnellata su rete ed extra raccolta, e l'ACI ha le sue
// tariffe per regione (la prefattura del portale lo esprime al chilo, 0,202: e' lo
// stesso prezzo, e il confronto con la prefattura lo sa).
//
// A TONNELLATA DAVVERO (chiusura dell'audit, 11/10/2026): qui si stampava il
// valore della tariffa com'era, e una tariffa scritta in €/kg (0,202) usciva
// 0,202 sotto «Euro/TON». Ora il prezzo passa da prezzoATonnellata di
// ecotyreTariffe.js con l'unita' della riga; una riga che non si paga a peso
// resta senza prezzo a tonnellata, non a zero.
const prezzoTon = (r) => prezzoATonnellata(r.tariffa_valore, r.unita_prezzo || r.unita_misura);

const giorno = (v) => (v ? new Date(v).toLocaleDateString('it-IT') : '');
const NOMI = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };

// IL FATTURANTE E' SMOCO, SEMPRE (chiusura dell'audit, 11/10/2026). La colonna
// stampava il campo della riga, e il calcolo dell'attiva ci scriveva 'ECOTYRE':
// il cliente al posto di chi emette la fattura. I fornitori fatturano a SMOCO, e
// SMOCO fa a Ecotyre una fattura per canale; il foglio ACI dell'amministrazione
// ha «SMOCO Srl» su ogni riga. E' FATTURANTE_ATTIVA di ecotyreTariffe.js, scritto
// qui come costante: prove/fatturanteAttiva.mjs controlla che siano uguali. Le
// righe gia' salvate non si riscrivono: si stampa il soggetto.
const FATTURANTE = 'SMOCO Srl';

// IL SURPLUS E' UNA VOCE A SE', CON LA SUA RIGA (decisione dell'utente del
// 13/10/2026 sera: il Fuel Surcharge «deve essere una voce disgiunta con un
// proprio rigo (per canale)»). Ogni report e' di un canale; in fondo, sotto i
// formulari, il «Totale formulari», poi una riga per surplus e il TOTALE, che
// la comprende. La riga del surplus riempie le colonne del modello coi suoi
// pezzi (pezziSurplusReport di surplusVista.js): il nome sotto il Tipo
// (nell'extra raccolta, che il Tipo non ce l'ha, sotto l'Ordine), l'origine
// sotto l'Ordine (nell'extra raccolta nelle Note), la validita' sotto la Data,
// «+5,00 €/t sulle 1.120,24 t del mese» sotto il FIR; la Quantita' resta vuota,
// perche' le tonnellate sono quelle dei formulari e chi somma la colonna le
// conterebbe due volte. Prima la pagina passava ai report le sole righe dei
// formulari e diceva che il surplus si fatturava a parte (domanda D3 del
// progetto del surplus, ora decisa). Senza surplus il report e' quello di
// prima, cella per cella. I conti sono in centesimi: il TOTALE e' il Totale
// formulari piu' i surplus, al centesimo, come in fattura.
const centesimi = (v) => Math.round((Number(v) || 0) * 100);

/** Le celle della riga di un surplus, nelle colonne del report del canale. */
function celleSurplus(tipologia, p, periodo) {
  if (tipologia === 'RETE') return [periodo, p.nome, p.origine, p.validita, p.base, '', null, p.euro_t, p.totale];
  if (tipologia === 'ACI') return ['', FATTURANTE, periodo, p.nome, '', p.origine, p.validita, p.base, '', null, p.euro_t, p.totale, ''];
  return [periodo, p.nome, p.validita, p.base, null, p.euro_t, p.totale, p.origine];
}

/**
 * La tabella di un canale: { foglio, colonne: [{ titolo, tipo, peso }], righe: [[...]],
 * surplus: [{ celle, nome, origine, validita, base, euro_t, kg, ordini, totale }],
 * totale_formulari, totale, iTotale (la colonna del Prezzo Totale), righe_a_parole }.
 * righe sono i soli formulari (e i sovracosti a corpo dell'extra raccolta);
 * totale comprende i surplus. Le righe sospese restano fuori.
 */
export function tabellaAttiva(tipologia, righe, anno, mese) {
  const periodo = `${mese} ${anno}`;
  const valide = (righe || []).filter(r => !r.sospesa);
  const formulari = soloFormulari(valide);
  const totaleFormulari = Math.round(formulari.reduce((s, r) => s + (r.totale || 0), 0) * 100) / 100;
  const surplus = soloSurplus(valide).map(r => { const p = pezziSurplusReport(r); return { ...p, celle: celleSurplus(tipologia, p, periodo) }; });
  const totale = (centesimi(totaleFormulari) + surplus.reduce((s, x) => s + centesimi(x.totale), 0)) / 100;
  const conti = { surplus, totale_formulari: totaleFormulari, righe_a_parole: righeAParole(valide) };
  if (tipologia === 'RETE') {
    return {
      foglio: 'Fatturazione RETE', totale, iTotale: 8, ...conti,
      colonne: [
        { titolo: 'Periodo', tipo: 'testo', peso: 1 }, { titolo: 'Tipo', tipo: 'testo', peso: 0.9 }, { titolo: 'Ordine', tipo: 'testo', peso: 1.1 },
        { titolo: 'Data Fine Trasporto', tipo: 'testo', peso: 1.1 }, { titolo: 'Numero FIR', tipo: 'testo', peso: 1.3 }, { titolo: 'Classe', tipo: 'testo', peso: 0.7 },
        { titolo: 'Quantità (kg)', tipo: 'kg', peso: 0.9 }, { titolo: 'Prezzo Unitario (Euro/TON)', tipo: 'euro', peso: 1.2 }, { titolo: 'Prezzo Totale', tipo: 'euro', peso: 1 },
      ],
      righe: formulari.map(r => [periodo, tipoServizio(r), r.ordine || '', giorno(r.data_fine_trasporto), r.numero_fir || '', r.classe || '', r.quantita || 0, prezzoTon(r), r.totale || 0]),
    };
  }
  if (tipologia === 'ACI') {
    return {
      foglio: 'Fatturazione ACI', totale, iTotale: 11, ...conti,
      colonne: [
        { titolo: 'Regione', tipo: 'testo', peso: 0.9 }, { titolo: 'Fatturante', tipo: 'testo', peso: 0.9 }, { titolo: 'Periodo', tipo: 'testo', peso: 0.9 }, { titolo: 'Tipo', tipo: 'testo', peso: 0.9 },
        { titolo: 'Ticket n°', tipo: 'testo', peso: 0.9 }, { titolo: 'Ordine', tipo: 'testo', peso: 1 }, { titolo: 'Data Fine Trasporto', tipo: 'testo', peso: 1 }, { titolo: 'Numero FIR', tipo: 'testo', peso: 1.2 },
        { titolo: 'Classe', tipo: 'testo', peso: 1.1 }, { titolo: 'Quantità (kg)', tipo: 'kg', peso: 0.8 }, { titolo: 'Prezzo Unitario (Euro/TON)', tipo: 'euro', peso: 1.1 }, { titolo: 'Prezzo Totale', tipo: 'euro', peso: 0.9 },
        { titolo: 'Note', tipo: 'testo', peso: 1.4 },
      ],
      righe: formulari.map(r => [r.regione || '', FATTURANTE, periodo, tipoServizio(r), r.ticket_n || '', r.ordine || '', giorno(r.data_fine_trasporto), r.numero_fir || '', r.classe || '', r.quantita || 0, prezzoTon(r), r.totale || 0, r.note || '']),
    };
  }
  return {
    foglio: 'Extra Raccolta', totale, iTotale: 6, ...conti,
    colonne: [
      { titolo: 'Periodo', tipo: 'testo', peso: 0.9 }, { titolo: 'Ordine', tipo: 'testo', peso: 1.1 }, { titolo: 'Data Fine Trasporto', tipo: 'testo', peso: 1 }, { titolo: 'Numero FIR', tipo: 'testo', peso: 1.2 },
      { titolo: 'Quantità (kg)', tipo: 'kg', peso: 0.8 }, { titolo: 'Prezzo Unitario', tipo: 'euro', peso: 1 }, { titolo: 'Prezzo Totale', tipo: 'euro', peso: 1 }, { titolo: 'Note', tipo: 'testo', peso: 2.2 },
    ],
    righe: formulari.map(r => [periodo, r.ordine || '', giorno(r.data_fine_trasporto), r.numero_fir || '', r.quantita || 0, r.tariffa_valore || 0, r.totale || 0, r.note || '']),
  };
}

/**
 * Il sottotitolo del report: «380 righe  ·  cliente Ecotyre», e con un surplus
 * «380 righe e la riga del Fuel Surcharge  ·  formulari € 226.288,48  ·
 * cliente Ecotyre». Dal 14/10/2026 il Totale formulari ha anche la sua riga
 * nel PDF (vedi exportFatturazioneAttivaPdf); qui resta, uguale nel foglio
 * «Note» dell'Excel e nella testa del PDF.
 */
const sottotitoloAttiva = (t) => (t.surplus.length
  ? `${t.righe_a_parole}  ·  formulari ${euro(t.totale_formulari)}  ·  cliente Ecotyre`
  : `${t.righe.length} ${t.righe.length === 1 ? 'riga' : 'righe'}  ·  cliente Ecotyre`);

export const nomeFileAttiva = (tipologia, anno, mese, estensione) => `Fatturazione_${tipologia}_${mese}_${anno}.${estensione}`;

// Gli archivi che legge il report di un canale: per il «dati fino al» del file.
// La fatturazione attiva conta le primarie del canale; l'extra raccolta le sue schede.
const ARCHIVI_ATTIVA = { RETE: ['PrimariaRete'], ACI: ['PrimariaAci'], EXTRA_RACCOLTA: ['ExtraRaccolta'] };

/** Il blocco di testa del report di un canale: lo stesso per Excel e PDF. */
export function documentoAttiva(tipologia, righe, anno, mese, stato) {
  const t = tabellaAttiva(tipologia, righe, anno, mese);
  return documentoDa({
    titolo: `Fatturazione attiva ${NOMI[tipologia] || tipologia} — ${mese} ${anno}`,
    sottotitolo: sottotitoloAttiva(t),
    canale: tipologia, periodo: `${mese} ${anno}`, entita: ARCHIVI_ATTIVA[tipologia] || [],
    ...(stato !== undefined ? { stato } : {}),
  });
}

// I formati delle colonne, dal loro tipo: i chili interi, gli importi con due
// decimali e i prezzi da due a quattro (un prezzo al chilo e' 0,202).
const formatoColonna = (c) => (c.tipo === 'kg' ? FORMATI.kg : c.tipo === 'euro' ? (/^Prezzo Unitario/.test(c.titolo) ? FORMATI.prezzoLibero : FORMATI.importo) : null);

/**
 * Excel nel formato del modello dell'amministrazione. Il totale sta sotto la
 * colonna del Prezzo Totale (nell'ACI finiva una colonna piu' in la', sotto le
 * Note).
 *
 * LE COLONNE NON SI TOCCANO, LA TESTA VA NELLE NOTE (chiusura dell'audit,
 * 11/10/2026). Il foglio usciva da SheetJS, senza nessuna veste e senza dire
 * fino a che giorno arrivavano i dati. AGENTS.md vuole che le colonne di questi
 * tre report non cambino senza l'assenso dell'amministrazione, che li incolla
 * altrove: il primo foglio resta cella per cella quello di prima (intestazioni
 * in riga 1, le righe, una riga vuota e il TOTALE sotto il Prezzo Totale), con
 * la sola veste delle intestazioni e dei formati; il blocco di testa del
 * documento (canale, periodo per fine trasporto, dati fino al, generato il ...
 * da ...) sta in un secondo foglio, «Note». opzioni.stato, se c'e', e' lo stato
 * dei dati gia' letto (le prove); senza, si chiede al server.
 *
 * IL SURPLUS (13/10/2026 sera): sotto la riga vuota, il «Totale formulari»
 * (il TOTALE di prima), le righe dei surplus nella forma della passiva e il
 * TOTALE che le comprende, tutti sotto il Prezzo Totale. Il foglio «Note» dice
 * la riga del surplus a parole. Senza surplus il foglio e' quello di prima.
 */
export async function exportFatturazioneAttiva(tipologia, righe, anno, mese, opzioni = {}) {
  const t = tabellaAttiva(tipologia, righe, anno, mese);
  const doc = await documentoAttiva(tipologia, righe, anno, mese, opzioni.stato);
  const { wb } = await nuovaCartella();
  const ws = wb.addWorksheet(t.foglio);
  const quante = t.colonne.length;
  const formati = Object.fromEntries(t.colonne.map((c, i) => [i + 1, formatoColonna(c)]).filter(([, f]) => f));
  // le larghezze prima delle righe: la riga del surplus va a capo nelle sue celle
  t.colonne.forEach((c, i) => { ws.getColumn(i + 1).width = Math.max(10, Math.round((c.peso || 1) * 14)); });
  intestazione(ws, t.colonne.map(c => c.titolo), Object.keys(formati).map(Number));
  t.righe.forEach(r => formatta(rigaDettaglio(ws, r, { quante }), formati));
  ws.addRow([]);
  const sotto = (etichetta, valore) => {
    const v = new Array(quante).fill('');
    v[t.iTotale - 1] = etichetta;
    v[t.iTotale] = valore;
    return v;
  };
  if (t.surplus.length) {
    formatta(rigaDettaglio(ws, sotto('Totale formulari', t.totale_formulari), { grassetto: true, colore: COLORI.scuro, quante }), formati);
    for (const s of t.surplus) vestiRigaSurplusFoglio(formatta(rigaDettaglio(ws, s.celle, { quante }), formati), quante);
  }
  formatta(rigaTotale(ws, sotto('TOTALE', t.totale), quante), formati);
  bloccaRighe(ws, 1);
  perLaStampa(ws, { ripeti: 1, doc });
  const quanteRighe = `${t.righe.length} ${t.righe.length === 1 ? 'riga' : 'righe'}`;
  foglioNote(wb, doc, [
    t.surplus.length
      ? `Il foglio «${t.foglio}» ha le colonne del modello dell'amministrazione, nello stesso ordine: ${quanteRighe} dei formulari, il loro totale, ${t.surplus.length === 1 ? 'la riga' : 'le righe'} del surplus e il TOTALE, sotto il Prezzo Totale.`
      : `Il foglio «${t.foglio}» ha le colonne del modello dell'amministrazione, nello stesso ordine: ${quanteRighe} e il totale sotto il Prezzo Totale.`,
    ...t.surplus.map(notaSurplus),
    'Il periodo di ogni riga è il giorno italiano della fine del trasporto, mai la chiusura a portale. Le righe sospese non ci sono.',
    'Un canale per file: rete, ACI ed extra raccolta non si sommano mai. Il fatturante è SMOCO Srl, il cliente Ecotyre.',
  ]);
  return scaricaCartella(wb, nomeFileAttiva(tipologia, anno, mese, 'xlsx'));
}

/** La riga di un surplus a parole, per il foglio «Note». */
const notaSurplus = (s) => `${s.nome}${s.origine ? ` (${s.origine})` : ''}${s.validita ? `, ${s.validita}` : ''}: una voce a sé, con la sua riga sotto il «Totale formulari»; ${s.base}${s.ordini ? `, su ${s.ordini} ${s.ordini === 1 ? 'ordine' : 'ordini'}` : ''}, ${euro(s.totale)}. Sono le stesse tonnellate dei formulari, per questo la Quantità della riga è vuota; il TOTALE la comprende.`;

// Lo stesso report in PDF: stesse colonne, stesse righe, stesso totale.
//
// IL SURPLUS NEL PDF (13/10/2026 sera): le righe dei surplus sotto i
// formulari, col colore 'surplus' di esportaTabella (indaco in corsivo con la
// barra, come nei fogli della passiva), e il TOTALE che le comprende.
//
// IL «TOTALE FORMULARI» HA LA SUA RIGA ANCHE NEL PDF (14/10/2026). Stava solo
// nel sottotitolo, perche' il piede del PDF conta le righe della tabella e con
// una riga di totale in piu' avrebbe detto 382 righe per 380 formulari e un
// surplus. Ora esportaTabellaPdf ha i subtotali, che il piede non conta: sotto i
// formulari il «Totale formulari», poi i surplus, poi il TOTALE, come nell'Excel.
// Il piede dice ancora formulari e surplus («381 righe»), il sottotitolo resta
// quello del foglio «Note». Senza surplus il PDF e' quello di prima.
export async function exportFatturazioneAttivaPdf(tipologia, righe, anno, mese, opzioni = {}) {
  const t = tabellaAttiva(tipologia, righe, anno, mese);
  // esportaTabella si porta dietro jspdf: pigro anche lui.
  const { esportaTabellaPdf } = await import('@/lib/esportaTabella');
  const delSurplus = new Set(t.surplus.map(s => s.celle));
  await esportaTabellaPdf({
    nomeFile: nomeFileAttiva(tipologia, anno, mese, 'pdf').replace(/\.pdf$/, ''),
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE  ·  FATTURAZIONE ATTIVA',
    titolo: `Fatturazione attiva ${NOMI[tipologia] || tipologia} — ${mese} ${anno}`,
    sottotitolo: sottotitoloAttiva(t),
    colonne: t.colonne.map((c, i) => ({ ...c, valore: (r) => r[i] })),
    righe: [...t.righe, ...t.surplus.map(s => s.celle)],
    ...(t.surplus.length ? { subtotali: [{ dopo: t.righe.length, etichetta: 'Totale formulari', valori: { [t.iTotale]: t.totale_formulari } }] } : {}),
    totali: { etichetta: 'TOTALE', valori: { [t.iTotale]: t.totale } },
    ...(delSurplus.size ? { colore: (r) => (delSurplus.has(r) ? 'surplus' : null) } : {}),
    documento: { canale: tipologia, periodo: `${mese} ${anno}`, entita: ARCHIVI_ATTIVA[tipologia] || [], ...(opzioni.stato !== undefined ? { stato: opzioni.stato } : {}) },
  });
}
