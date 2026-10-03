import * as XLSX from 'xlsx';
import { formattaPesi } from '@/lib/formatoExcel';
import { esportaTabellaPdf } from '@/lib/esportaTabella';
import { tabellaAmministrazione, nomeFileAmministrazione } from '@/lib/formatAmministrazione';

// Scrive i fogli del «format amministrazione»: Excel e PDF, le stesse righe.
// La tabella la costruisce src/lib/formatAmministrazione.js, in un punto solo,
// cosi' i due file dicono per forza le stesse cose.

/**
 * La riga dei totali in fondo, com'e' nei fogli veri: niente etichetta, i due
 * numeri sotto le loro colonne (chili e totale), separata da una riga vuota.
 */
function rigaTotali(t) {
  const r = new Array(t.colonne.length).fill('');
  r[t.iKg] = t.totale_kg;
  r[t.iTotale] = t.totale_euro;
  return r;
}

/** Il foglio Excel del mese, nel formato dell'amministrazione. */
export function exportAmministrazioneAttiva(tipologia, righe, anno, mese) {
  const t = tabellaAmministrazione(tipologia, righe, anno, mese);
  const aoa = [];
  if (t.intestazione) { aoa.push(t.intestazione); aoa.push([]); }
  aoa.push(t.colonne.map(c => c.titolo));
  aoa.push(...t.righe);
  aoa.push([]);
  aoa.push(rigaTotali(t));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws), t.foglio.slice(0, 31));
  XLSX.writeFile(wb, nomeFileAmministrazione(tipologia, anno, mese, 'xlsx'));
}

/** Lo stesso foglio in PDF: stesse colonne, stesse righe, stessi totali. */
export async function exportAmministrazioneAttivaPdf(tipologia, righe, anno, mese) {
  const t = tabellaAmministrazione(tipologia, righe, anno, mese);
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
