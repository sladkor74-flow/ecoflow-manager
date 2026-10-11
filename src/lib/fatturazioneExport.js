import { formattaPesi } from '@/lib/formatoExcel';
import { prezzoATonnellata } from './ecotyreTariffe.js';

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

/**
 * La tabella di un canale: { foglio, colonne: [{ titolo, tipo, peso }], righe: [[...]],
 * totale, iTotale (la colonna del Prezzo Totale) }. Le righe sospese restano fuori.
 */
export function tabellaAttiva(tipologia, righe, anno, mese) {
  const periodo = `${mese} ${anno}`;
  const valide = (righe || []).filter(r => !r.sospesa);
  const totale = Math.round(valide.reduce((s, r) => s + (r.totale || 0), 0) * 100) / 100;
  if (tipologia === 'RETE') {
    return {
      foglio: 'Fatturazione RETE', totale, iTotale: 8,
      colonne: [
        { titolo: 'Periodo', tipo: 'testo', peso: 1 }, { titolo: 'Tipo', tipo: 'testo', peso: 0.9 }, { titolo: 'Ordine', tipo: 'testo', peso: 1.1 },
        { titolo: 'Data Fine Trasporto', tipo: 'testo', peso: 1.1 }, { titolo: 'Numero FIR', tipo: 'testo', peso: 1.3 }, { titolo: 'Classe', tipo: 'testo', peso: 0.7 },
        { titolo: 'Quantità (kg)', tipo: 'kg', peso: 0.9 }, { titolo: 'Prezzo Unitario (Euro/TON)', tipo: 'euro', peso: 1.2 }, { titolo: 'Prezzo Totale', tipo: 'euro', peso: 1 },
      ],
      righe: valide.map(r => [periodo, tipoServizio(r), r.ordine || '', giorno(r.data_fine_trasporto), r.numero_fir || '', r.classe || '', r.quantita || 0, prezzoTon(r), r.totale || 0]),
    };
  }
  if (tipologia === 'ACI') {
    return {
      foglio: 'Fatturazione ACI', totale, iTotale: 11,
      colonne: [
        { titolo: 'Regione', tipo: 'testo', peso: 0.9 }, { titolo: 'Fatturante', tipo: 'testo', peso: 0.9 }, { titolo: 'Periodo', tipo: 'testo', peso: 0.9 }, { titolo: 'Tipo', tipo: 'testo', peso: 0.9 },
        { titolo: 'Ticket n°', tipo: 'testo', peso: 0.9 }, { titolo: 'Ordine', tipo: 'testo', peso: 1 }, { titolo: 'Data Fine Trasporto', tipo: 'testo', peso: 1 }, { titolo: 'Numero FIR', tipo: 'testo', peso: 1.2 },
        { titolo: 'Classe', tipo: 'testo', peso: 1.1 }, { titolo: 'Quantità (kg)', tipo: 'kg', peso: 0.8 }, { titolo: 'Prezzo Unitario (Euro/TON)', tipo: 'euro', peso: 1.1 }, { titolo: 'Prezzo Totale', tipo: 'euro', peso: 0.9 },
        { titolo: 'Note', tipo: 'testo', peso: 1.4 },
      ],
      righe: valide.map(r => [r.regione || '', FATTURANTE, periodo, tipoServizio(r), r.ticket_n || '', r.ordine || '', giorno(r.data_fine_trasporto), r.numero_fir || '', r.classe || '', r.quantita || 0, prezzoTon(r), r.totale || 0, r.note || '']),
    };
  }
  return {
    foglio: 'Extra Raccolta', totale, iTotale: 6,
    colonne: [
      { titolo: 'Periodo', tipo: 'testo', peso: 0.9 }, { titolo: 'Ordine', tipo: 'testo', peso: 1.1 }, { titolo: 'Data Fine Trasporto', tipo: 'testo', peso: 1 }, { titolo: 'Numero FIR', tipo: 'testo', peso: 1.2 },
      { titolo: 'Quantità (kg)', tipo: 'kg', peso: 0.8 }, { titolo: 'Prezzo Unitario', tipo: 'euro', peso: 1 }, { titolo: 'Prezzo Totale', tipo: 'euro', peso: 1 }, { titolo: 'Note', tipo: 'testo', peso: 2.2 },
    ],
    righe: valide.map(r => [periodo, r.ordine || '', giorno(r.data_fine_trasporto), r.numero_fir || '', r.quantita || 0, r.tariffa_valore || 0, r.totale || 0, r.note || '']),
  };
}

export const nomeFileAttiva = (tipologia, anno, mese, estensione) => `Fatturazione_${tipologia}_${mese}_${anno}.${estensione}`;

// Excel nel formato del modello dell'amministrazione. Il totale sta sotto la colonna
// del Prezzo Totale (nell'ACI finiva una colonna piu' in la', sotto le Note).
export async function exportFatturazioneAttiva(tipologia, righe, anno, mese) {
  // xlsx pesa mezzo megabyte: si carica quando si esporta, non all'apertura.
  const XLSX = await import('xlsx');
  const t = tabellaAttiva(tipologia, righe, anno, mese);
  const ultima = new Array(t.colonne.length).fill('');
  ultima[t.iTotale - 1] = 'TOTALE';
  ultima[t.iTotale] = t.totale;
  const ws = XLSX.utils.aoa_to_sheet([t.colonne.map(c => c.titolo), ...t.righe, [], ultima]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws), t.foglio);
  XLSX.writeFile(wb, nomeFileAttiva(tipologia, anno, mese, 'xlsx'));
}

// Lo stesso report in PDF: stesse colonne, stesse righe, stesso totale
export async function exportFatturazioneAttivaPdf(tipologia, righe, anno, mese) {
  const t = tabellaAttiva(tipologia, righe, anno, mese);
  // esportaTabella si porta dietro jspdf e xlsx: pigro anche lui.
  const { esportaTabellaPdf } = await import('@/lib/esportaTabella');
  await esportaTabellaPdf({
    nomeFile: nomeFileAttiva(tipologia, anno, mese, 'pdf').replace(/\.pdf$/, ''),
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE  ·  FATTURAZIONE ATTIVA',
    titolo: `Fatturazione attiva ${NOMI[tipologia] || tipologia} — ${mese} ${anno}`,
    sottotitolo: `${t.righe.length} ${t.righe.length === 1 ? 'riga' : 'righe'}  ·  cliente Ecotyre`,
    colonne: t.colonne.map((c, i) => ({ ...c, valore: (r) => r[i] })),
    righe: t.righe,
    totali: { etichetta: 'TOTALE', valori: { [t.iTotale]: t.totale } },
  });
}
