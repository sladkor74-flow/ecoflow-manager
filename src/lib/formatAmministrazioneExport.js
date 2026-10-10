import { scarica } from '@/lib/docxModello';
import { tabellaAmministrazione, nomeFileAmministrazione } from '@/lib/formatAmministrazione';
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
  sottotitolo(ws, `${t.righe.length} ${t.righe.length === 1 ? 'riga' : 'righe'}  ·  ${t.totale_kg.toLocaleString('it-IT')} kg  ·  commessa Ecotyre`, quante);

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
  const totali = new Array(quante).fill('');
  totali[0] = 'TOTALE';
  if (t.righe.length) {
    const ultima = prima + t.righe.length - 1;
    totali[t.iKg] = { formula: `SUM(${lettera(colKg)}${prima}:${lettera(colKg)}${ultima})`, result: t.totale_kg };
    totali[t.iTotale] = { formula: `SUM(${lettera(colTotale)}${prima}:${lettera(colTotale)}${ultima})`, result: t.totale_euro };
  } else {
    totali[t.iKg] = 0;
    totali[t.iTotale] = 0;
  }
  formatta(rigaTotale(ws, totali, quante), formati);

  bloccaRighe(ws, 3);
  perLaStampa(ws, { ripeti: 3 });
  scarica(new Blob([await bytesDi(wb)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    nomeFileAmministrazione(tipologia, anno, mese, 'xlsx'));
}

/** Lo stesso foglio in PDF: stesse colonne, stesse righe, stessi totali. */
export async function exportAmministrazioneAttivaPdf(tipologia, righe, anno, mese) {
  const t = tabellaAmministrazione(tipologia, righe, anno, mese);
  // esportaTabella si porta dietro jspdf e xlsx: pigro anche lui.
  const { esportaTabellaPdf } = await import('@/lib/esportaTabella');
  await esportaTabellaPdf({
    nomeFile: nomeFileAmministrazione(tipologia, anno, mese, 'pdf').replace(/\.pdf$/, ''),
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE  ·  FORMAT AMMINISTRAZIONE',
    titolo: `Fatturazione attiva ${tipologia === 'ACI' ? 'ACI' : 'Rete'} — ${mese} ${anno}`,
    sottotitolo: `${t.righe.length} ${t.righe.length === 1 ? 'riga' : 'righe'}  ·  ${t.totale_kg.toLocaleString('it-IT')} kg`,
    colonne: t.colonne.map((c, i) => ({ ...c, valore: (r) => r[i] })),
    righe: t.righe,
    totali: { etichetta: 'TOTALE', valori: { [t.iKg]: t.totale_kg, [t.iTotale]: t.totale_euro } },
  });
}
