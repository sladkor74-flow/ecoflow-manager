import * as XLSX from 'xlsx';
import { formattaPesi } from '@/lib/formatoExcel';

// Export dell'elenco ordini da dichiarare in Excel.
// È la lista di lavoro da passare agli impianti.
export function exportDaDichiarareExcel(righe, totaleRighe, totaleKg) {
  const wb = XLSX.utils.book_new();

  const headers = [
    'Ordine', 'FIR', 'Fine trasporto', 'Punto di raccolta', 'Comune', 'Prov.',
    'Prodotto', 'CER', 'Peso da dichiarare (kg)', 'Destinazione', 'Trasferito a', 'Trasportatore'
  ];

  const rows = righe.map(r => [
    r.ordine_primaria || '',
    r.numero_fir || '',
    // La data che conta e' la fine del trasporto, gia' sul giorno italiano.
    r.fine_trasporto ? r.fine_trasporto.split('-').reverse().join('/') : '',
    r.punto_di_raccolta || '',
    r.comune || '',
    r.provincia || '',
    r.prodotto || '',
    r.cer || '',
    r.peso_non_dichiarato_kg || 0,
    r.destinazione || '',
    r.destinazione_secondaria || '',
    r.trasportatore || '',
  ]);

  rows.push(['TOTALE', '', '', '', '', '', '', '', totaleKg, '', '', '']);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 6 },
    { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 24 }, { wch: 24 }, { wch: 24 }
  ];

  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws), 'Ordini da dichiarare');
  XLSX.writeFile(wb, `ordini_da_dichiarare_${new Date().toISOString().slice(0, 10)}.xlsx`);
}