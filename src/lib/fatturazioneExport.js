import * as XLSX from 'xlsx';

// Esporta le righe di fatturazione attiva in Excel nel formato del modello corrispondente
export function exportFatturazioneAttiva(tipologia, righe, anno, mese) {
  let wsData = [];
  let sheetName = '';
  const periodo = `${mese} ${anno}`;

  if (tipologia === 'RETE') {
    sheetName = 'Fatturazione RETE';
    wsData = [['Periodo', 'Tipo', 'Ordine', 'Data Fine Trasporto', 'Numero FIR', 'Classe', 'Quantità (kg)', 'Prezzo Unitario', 'Prezzo Totale']];
    for (const r of righe) {
      if (r.sospesa) continue;
      wsData.push([
        periodo, 'Trasp.+Tratt.',
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
    wsData = [['Regione', 'Fatturante', 'Periodo', 'Tipo', 'Ticket n°', 'Ordine', 'Data Fine Trasporto', 'Numero FIR', 'Classe', 'Quantità (kg)', 'Prezzo Unitario', 'Prezzo Totale', 'Note']];
    for (const r of righe) {
      if (r.sospesa) continue;
      wsData.push([
        r.regione || '', r.fatturante || '', periodo, 'Trasp.+Tratt.',
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
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `Fatturazione_${tipologia}_${mese}_${anno}.xlsx`);
}