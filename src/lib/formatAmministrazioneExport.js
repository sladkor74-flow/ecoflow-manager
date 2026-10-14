import { scarica } from '@/lib/docxModello';
import { tabellaAmministrazione, nomeFileAmministrazione } from '@/lib/formatAmministrazione';
import { vestiRigaSurplusFoglio } from '@/lib/surplusVista';
import { euro, cifreItaliane } from '@/lib/formatoSoldi';
import {
  nuovaCartella, bytesDi, fascia, sottotitolo, intestazione, formatta,
  rigaDettaglio, rigaTotale, perLaStampa, bloccaRighe, COLORI, FORMATI,
} from '@/lib/fogliProfessionali';

// Scrive i fogli del «format amministrazione» dell'ATTIVA: Excel e PDF, le
// stesse righe. La tabella la costruisce src/lib/formatAmministrazione.js, in un
// punto solo, cosi' i due file dicono per forza le stesse cose.
//
// IL FOGLIO SI MANDA FUORI, QUINDI SI VESTE. Fino al 03/10/2026 l'Excel era una
// griglia di numeri nudi: la libreria con cui era scritto non sa fare grassetti
// ne' colori. Adesso passa dal corredo comune (src/lib/fogliProfessionali.js),
// che e' lo stesso dei fogli della passiva e usa i colori del report in PDF. Il
// contenuto non cambia di una virgola: cambia come si presenta.

/** La larghezza delle colonne, dal tipo che la tabella dichiara. */
const LARGHEZZE = { testo: 22, kg: 14, euro: 16, t: 14, data: 14 };

/** Il foglio Excel del mese, nel formato dell'amministrazione. */
export async function exportAmministrazioneAttiva(tipologia, righe, anno, mese) {
  const t = tabellaAmministrazione(tipologia, righe, anno, mese);
  const { wb } = await nuovaCartella();
  const ws = wb.addWorksheet(t.foglio.slice(0, 31));
  const quante = t.colonne.length;
  ws.columns = t.colonne.map(c => ({ width: Math.max(12, LARGHEZZE[c.tipo] || 18, String(c.titolo).length + 2) }));

  // La fascia: chi fattura, a chi, per quale mese. Nel foglio dell'ACI
  // l'amministrazione la scrive a mano sopra la tabella; qui c'e' sempre.
  fascia(ws, [
    `SMOCO S.r.l.  ·  Fatturazione attiva ${tipologia === 'ACI' ? 'ACI' : 'RETE'}`,
    ...new Array(Math.max(0, quante - 2)).fill(''),
    `${String(mese || '').toUpperCase()} ${anno}`,
  ], quante);
  sottotitolo(ws, `${quanteRighe(t)}  ·  ${chili(t)} kg  ·  commessa Ecotyre`, quante);

  // Le colonne dei numeri: allineate a destra e col loro formato.
  const numeriche = t.colonne.map((c, i) => (c.tipo === 'testo' ? 0 : i + 1)).filter(Boolean);
  intestazione(ws, t.colonne.map(c => c.titolo), numeriche);

  // Il prezzo al chilo vuole quattro decimali - 202 euro a tonnellata si
  // scrivono 0,2020 - mentre quello a tonnellata e gli importi ne vogliono due.
  const formati = {};
  t.colonne.forEach((c, i) => {
    if (c.tipo === 'kg') formati[i + 1] = FORMATI.kg;
    else if (c.tipo === 'euro') formati[i + 1] = /Euro\/Kg/i.test(c.titolo) ? FORMATI.prezzo : FORMATI.euro;
    else if (c.tipo === 't') formati[i + 1] = FORMATI.tonnellate;
  });
  // IL TOTALE DI RIGA E' UNA FORMULA, com'e' nel loro foglio (I2=G2*H2): se
  // l'amministrazione corregge un prezzo, l'importo si rifa' da solo. Il conto
  // cambia con l'unita' di misura: sulla rete il prezzo e' al chilo e si
  // moltiplica per i chili, sull'ACI e' a tonnellata e i chili si dividono per
  // mille. Sono le due unita' che i loro due fogli usano davvero.
  const lettera = (i) => ws.getColumn(i).letter;
  const colKg = t.iKg + 1;
  const colPrezzo = t.iTotale;
  const colTotale = t.iTotale + 1;
  const alChilo = /Euro\/Kg/i.test(t.colonne[t.iTotale - 1].titolo);
  const prima = 4;
  t.righe.forEach((r, i) => {
    const n = prima + i;
    const valori = r.slice();
    valori[t.iTotale] = {
      formula: alChilo
        ? `${lettera(colKg)}${n}*${lettera(colPrezzo)}${n}`
        : `${lettera(colKg)}${n}/1000*${lettera(colPrezzo)}${n}`,
      result: Number(r[t.iTotale]) || 0,
    };
    formatta(rigaDettaglio(ws, valori, { sfondo: i % 2 ? COLORI.zebra : null, quante }), formati);
  });

  // I totali: nel foglio vero non hanno etichetta, i due numeri stanno sotto le
  // loro colonne. Qui l'etichetta c'e', perche' una riga di numeri in fondo
  // senza nome, su un documento che si manda, si legge male.
  const ultima = prima + t.righe.length - 1;
  const somma = (col, risultato) => (t.righe.length ? { formula: `SUM(${lettera(col)}${prima}:${lettera(col)}${ultima})`, result: risultato } : 0);
  const totali = new Array(quante).fill('');
  totali[0] = 'TOTALE';
  totali[t.iKg] = somma(colKg, t.totale_kg);
  if (!t.surplus.length) {
    totali[t.iTotale] = somma(colTotale, t.totale_euro);
  } else {
    // IL SURPLUS (decisione dell'utente del 13/10/2026 sera: «una voce
    // disgiunta con un proprio rigo (per canale)»). Sotto i formulari il
    // «Totale formulari», coi chili e gli euro dei soli formulari (il TOTALE di
    // prima: chi incolla il foglio altrove ritrova quel numero); poi una riga
    // per surplus, nella forma della passiva, con la Quantita' vuota; poi il
    // TOTALE. Le somme non prendono due volte le tonnellate: i chili del
    // TOTALE sono la stessa somma dei formulari, e non toccano ne' la riga del
    // Totale formulari ne' quelle dei surplus; gli euro sommano il Totale
    // formulari e i surplus, non di nuovo i formulari. L'importo del surplus e'
    // una formula sul suo prezzo, come le righe dei formulari, coi chili su cui
    // vale scritti nella formula (la cella della Quantita' e' vuota apposta) e
    // arrotondata una volta al centesimo, come in fattura.
    const rSub = prima + t.righe.length;
    const sub = new Array(quante).fill('');
    sub[0] = 'Totale formulari';
    sub[t.iKg] = somma(colKg, t.totale_kg);
    sub[t.iTotale] = somma(colTotale, t.totale_euro_formulari);
    formatta(rigaDettaglio(ws, sub, { grassetto: true, colore: COLORI.scuro, quante }), formati);
    t.surplus.forEach((s, i) => {
      const n = rSub + 1 + i;
      const valori = s.celle.slice();
      if (s.euro_t !== null) {
        valori[t.iTotale] = {
          formula: alChilo
            ? `ROUND(${s.kg}*${lettera(colPrezzo)}${n},2)`
            : `ROUND(${s.kg}/1000*${lettera(colPrezzo)}${n},2)`,
          result: s.totale,
        };
      }
      vestiRigaSurplusFoglio(formatta(rigaDettaglio(ws, valori, { quante }), formati), quante);
    });
    totali[t.iTotale] = { formula: `SUM(${lettera(colTotale)}${rSub}:${lettera(colTotale)}${rSub + t.surplus.length})`, result: t.totale_euro };
  }
  formatta(rigaTotale(ws, totali, quante), formati);

  bloccaRighe(ws, 3);
  perLaStampa(ws, { ripeti: 3 });
  scarica(new Blob([await bytesDi(wb)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    nomeFileAmministrazione(tipologia, anno, mese, 'xlsx'));
}

/**
 * I chili del sottotitolo, all'italiana col punto delle migliaia anche sotto i
 * diecimila (13/10/2026): toLocaleString('it-IT') scriveva 7600, non 7.600.
 */
const chili = (t) => cifreItaliane(t.totale_kg, 0, 0);

/**
 * «380 righe», e con un surplus «380 righe e la riga del Fuel Surcharge»: le
 * righe dei formulari, e quelle dei surplus a parole.
 */
const quanteRighe = (t) => (t.surplus.length ? t.righe_a_parole : `${t.righe.length} ${t.righe.length === 1 ? 'riga' : 'righe'}`);

/**
 * Lo stesso foglio in PDF: stesse colonne, stesse righe, stessi totali.
 *
 * IL SURPLUS NEL PDF (13/10/2026 sera): le righe dei surplus sotto i
 * formulari, col colore 'surplus' di esportaTabella (indaco in corsivo con la
 * barra), e il TOTALE: i chili dei formulari, gli euro col surplus. Il
 * «Totale formulari» sta nel sottotitolo e non in una riga: il piede del PDF
 * conta le righe della tabella, e con una riga di totale in piu' le conterebbe
 * sbagliate.
 */
export async function exportAmministrazioneAttivaPdf(tipologia, righe, anno, mese) {
  const t = tabellaAmministrazione(tipologia, righe, anno, mese);
  // esportaTabella si porta dietro jspdf e xlsx: pigro anche lui.
  const { esportaTabellaPdf } = await import('@/lib/esportaTabella');
  const delSurplus = new Set(t.surplus.map(s => s.celle));
  await esportaTabellaPdf({
    nomeFile: nomeFileAmministrazione(tipologia, anno, mese, 'pdf').replace(/\.pdf$/, ''),
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE  ·  FORMAT AMMINISTRAZIONE',
    titolo: `Fatturazione attiva ${tipologia === 'ACI' ? 'ACI' : 'Rete'} — ${mese} ${anno}`,
    sottotitolo: `${quanteRighe(t)}  ·  ${chili(t)} kg${t.surplus.length ? `  ·  formulari ${euro(t.totale_euro_formulari)}` : ''}`,
    // Il prezzo unitario esce coi suoi decimali (tipoPdf della tabella,
    // 'prezzoLibero'): col tipo 'euro' 0,202 €/kg diventava «0,20 €» e 237,125
    // «237,13 €». L'Excel resta sul tipo e sul titolo (revisione del 13/10/2026).
    colonne: t.colonne.map((c, i) => ({ ...c, tipo: c.tipoPdf || c.tipo, valore: (r) => r[i] })),
    righe: [...t.righe, ...t.surplus.map(s => s.celle)],
    totali: { etichetta: 'TOTALE', valori: { [t.iKg]: t.totale_kg, [t.iTotale]: t.totale_euro } },
    ...(delSurplus.size ? { colore: (r) => (delSurplus.has(r) ? 'surplus' : null) } : {}),
  });
}
