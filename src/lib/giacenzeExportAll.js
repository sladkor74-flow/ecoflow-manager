import * as XLSX from 'xlsx';

function fmt(n) {
  if (n == null || n === '' || isNaN(n)) return '';
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('it-IT');
}

// Export complessivo: un foglio per ciascuna delle quattro schede.
export async function exportGiacenzeAllExcel(data, ordiniData, anno) {
  const wb = XLSX.utils.book_new();

  // --- Foglio 1: Situazione ---
  const sitHeaders = ['Sito', 'Ruolo', 'Giacenza a portale (t)', 'Giacenza fisica (t)', 'Divergenza (t)', 'Ordini da dichiarare', 'Dichiarato (t)', 'Tipologia trattamento'];
  const sitRows = data.righe.map(r => [
    r.sito,
    r.tipo_destinazione === 'imp' ? 'Impianto' : 'Stoccaggio',
    r.giacenza_portale_t,
    r.giacenza_fisica_t,
    r.divergenza_t,
    r.ordini_da_dichiarare || 0,
    r.dichiarato_t,
    r.tipologia_trattamento || '',
  ]);
  sitRows.push(['TOTALE', '', data.totali.giacenza_portale_t, data.totali.giacenza_fisica_t, data.totali.divergenza_t, data.totali.ordini_da_dichiarare, data.totali.dichiarato_t, '']);
  const ws1 = XLSX.utils.aoa_to_sheet([sitHeaders, ...sitRows]);
  ws1['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Situazione');

  // --- Foglio 2: Da dichiarare ---
  const ddHeaders = ['Ordine', 'FIR', 'Data chiusura', 'Punto di raccolta', 'Comune', 'Prov.', 'Prodotto', 'CER', 'Peso da dichiarare (kg)', 'Destinazione', 'Trasferito a', 'Trasportatore'];
  const ddRows = (ordiniData.righe || []).map(r => [
    r.ordine_primaria || '', r.numero_fir || '', fmtData(r.data_chiusura),
    r.punto_di_raccolta || '', r.comune || '', r.provincia || '',
    r.prodotto || '', r.cer || '', r.peso_non_dichiarato_kg || 0,
    r.destinazione || '', r.destinazione_secondaria || '', r.trasportatore || '',
  ]);
  ddRows.push(['TOTALE', '', '', '', '', '', '', '', ordiniData.totale_kg, '', '', '']);
  const ws2 = XLSX.utils.aoa_to_sheet([ddHeaders, ...ddRows]);
  ws2['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 6 }, { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 24 }, { wch: 24 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Da dichiarare');

  // --- Foglio 3: Derivati ---
  const derHeaders = ['Sito', 'Dichiarato (t)', 'Granulo (t)', 'Fibre (t)', 'Metallo (t)', 'Cippato (t)', 'Ciabattato (t)'];
  const derRows = data.righe.filter(r => r.dichiarato_t > 0).map(r => [
    r.sito, r.dichiarato_t, r.granulo_t, r.fibre_t, r.metallo_t, r.cippato_t, r.ciabattato_t,
  ]);
  derRows.push(['TOTALE', data.totali.dichiarato_t, data.totali.granulo_t, data.totali.fibre_t, data.totali.metallo_t, data.totali.cippato_t, data.totali.ciabattato_t]);
  const ws3 = XLSX.utils.aoa_to_sheet([derHeaders, ...derRows]);
  ws3['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Derivati');

  // --- Foglio 4: Target ---
  const tarHeaders = ['Sito', 'Ruolo', 'Target primarie (t)', 'Target totale (t)', 'Conferito primarie (t)', 'Secondarie netto (t)', 'Secondarie in (t)', 'Secondarie out (t)', 'Terziarie (t)', 'Conferito (t)', 'Residuo (t)', 'Copertura (%)'];
  const tarRows = data.righe.map(r => [
    r.sito,
    r.tipo_destinazione === 'imp' ? 'Impianto' : 'Stoccaggio',
    r.target_primarie_t,
    r.target_totale_t || '',
    r.conferito_primarie_t,
    r.secondarie_nette_t,
    r.secondarie_in_t,
    r.secondarie_out_t,
    r.terziarie_t,
    r.conferito_t,
    r.residuo_t != null ? r.residuo_t : '',
    r.percentuale_target != null ? r.percentuale_target : '',
  ]);
  const residuoTot = data.totali.target_totale_t > 0 ? data.totali.target_totale_t - data.totali.conferito_t : '';
  const copTot = data.totali.target_totale_t > 0 ? (data.totali.conferito_t / data.totali.target_totale_t * 100) : '';
  tarRows.push(['TOTALE', '', data.totali.target_primarie_t, data.totali.target_totale_t || '', data.totali.conferito_primarie_t, data.totali.secondarie_nette_t, data.totali.secondarie_in_t, data.totali.secondarie_out_t, data.totali.terziarie_t, data.totali.conferito_t, residuoTot, copTot]);
  const ws4 = XLSX.utils.aoa_to_sheet([tarHeaders, ...tarRows]);
  ws4['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Target');

  XLSX.writeFile(wb, `giacenze_${anno}.xlsx`);
}