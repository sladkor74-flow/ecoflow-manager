import * as XLSX from 'xlsx';
import { formattaPesi } from '@/lib/formatoExcel';

// Il tipo di servizio come lo scrive la prefattura del portale: dipende
// dall'impianto di destinazione (Trasp. quando il trattamento lo fattura Ecotyre).
// Prima l'export scriveva "Trasp.+Tratt." su tutte le righe.
const tipoServizio = (r) => (r.servizio_ecotyre === 'TRASP' ? 'Trasp.' : 'Trasp.+Tratt.');

// Il prezzo si scrive in euro a TONNELLATA, in tutti i report: nel 2026 a Ecotyre
// si fattura a 202 euro la tonnellata, ed e' quello il numero che l'amministrazione
// deve leggere (la prefattura del portale lo esprime al chilo, 0,202: e' lo stesso
// prezzo, e il confronto con la prefattura lo sa).

// Esporta le righe di fatturazione attiva in Excel nel formato del modello corrispondente
export function exportFatturazioneAttiva(tipologia, righe, anno, mese) {
  let wsData = [];
  let sheetName = '';
  const periodo = `${mese} ${anno}`;

  if (tipologia === 'RETE') {
    sheetName = 'Fatturazione RETE';
    wsData = [['Periodo', 'Tipo', 'Ordine', 'Data Fine Trasporto', 'Numero FIR', 'Classe', 'Quantità (kg)', 'Prezzo Unitario (Euro/TON)', 'Prezzo Totale']];
    for (const r of righe) {
      if (r.sospesa) continue;
      wsData.push([
        periodo, tipoServizio(r),
        r.ordine || '',
        r.data_fine_trasporto ? new Date(r.data_fine_trasporto).toLocaleDateString('it-IT') : '',
        r.numero_fir || '',
        r.classe || '',
        r.quantita || 0,
        r.tariffa_valore || 0,
        r.totale || 0,
      ]);
    }
    const tot = righe.filter(r => !r.sospesa).reduce((s, r) => s + (r.totale || 0), 0);
    wsData.push([]);
    wsData.push(['', '', '', '', '', '', '', 'TOTALE', Math.round(tot * 100) / 100]);
  } else if (tipologia === 'ACI') {
    sheetName = 'Fatturazione ACI';
    wsData = [['Regione', 'Fatturante', 'Periodo', 'Tipo', 'Ticket n°', 'Ordine', 'Data Fine Trasporto', 'Numero FIR', 'Classe', 'Quantità (kg)', 'Prezzo Unitario (Euro/TON)', 'Prezzo Totale', 'Note']];
    for (const r of righe) {
      if (r.sospesa) continue;
      wsData.push([
        r.regione || '', r.fatturante || '', periodo, tipoServizio(r),
        r.ticket_n || '', r.ordine || '',
        r.data_fine_trasporto ? new Date(r.data_fine_trasporto).toLocaleDateString('it-IT') : '',
        r.numero_fir || '', r.classe || '',
        r.quantita || 0, r.tariffa_valore || 0, r.totale || 0, r.note || '',
      ]);
    }
    const tot = righe.filter(r => !r.sospesa).reduce((s, r) => s + (r.totale || 0), 0);
    wsData.push([]);
    wsData.push(['', '', '', '', '', '', '', '', '', '', '', 'TOTALE', Math.round(tot * 100) / 100]);
  } else if (tipologia === 'EXTRA_RACCOLTA') {
    sheetName = 'Extra Raccolta';
    wsData = [['Periodo', 'Ordine', 'Data Fine Trasporto', 'Numero FIR', 'Quantità (kg)', 'Prezzo Unitario', 'Prezzo Totale', 'Note']];
    for (const r of righe) {
      if (r.sospesa) continue;
      wsData.push([
        periodo, r.ordine || '',
        r.data_fine_trasporto ? new Date(r.data_fine_trasporto).toLocaleDateString('it-IT') : '',
        r.numero_fir || '',
        r.quantita || 0, r.tariffa_valore || 0, r.totale || 0, r.note || '',
      ]);
    }
    const tot = righe.filter(r => !r.sospesa).reduce((s, r) => s + (r.totale || 0), 0);
    wsData.push([]);
    wsData.push(['', '', '', '', '', 'TOTALE', Math.round(tot * 100) / 100]);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws), sheetName);
  XLSX.writeFile(wb, `Fatturazione_${tipologia}_${mese}_${anno}.xlsx`);
}