import * as XLSX from 'xlsx';
import { formattaPesi } from '@/lib/formatoExcel';
import { formatTonnellate } from '@/lib/utils';

function fmt(n) {
  if (n == null || n === '' || isNaN(n)) return '';
  return formatTonnellate(Number(n));
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
  // Giacenza per classe in kg, come nel portale Ecotyre. Una colonna per canale:
  // con una sola, uno stoccaggio usciva con rete e ACI in un numero e il TOTALE
  // sommava la classe 9 degli stoccaggi alla rete degli impianti. La cella vuota
  // vuol dire non calcolata (l'ACI di un impianto, uno stoccaggio senza
  // rilevazione), non zero.
  const CLASSI = ['P', 'M', 'G1', 'G2', 'ACI'];
  const sitHeaders = ['Sito', 'Ruolo', 'Giacenza rete a portale (t)', 'Giacenza ACI (t)', 'Extra raccolta in piazzale, fuori portale (t)', ...CLASSI.map(c => `${c} (kg)`), 'Rilevazione stoccaggio', 'Dati aggiornati al', 'In attesa di dichiarazione (t)', 'Ordini da dichiarare', 'Dichiarato (t)', 'Tipologia trattamento'];
  const classi = (r) => CLASSI.map(c => (r.giacenza_classi_kg ? r.giacenza_classi_kg[c] || 0 : null));
  const vuotaSeManca = (v) => (v === null || v === undefined ? '' : v);
  const sitRows = data.righe.map(r => [
    r.sito,
    r.tipo_destinazione === 'imp' ? 'Impianto' : 'Stoccaggio',
    vuotaSeManca(r.giacenza_rete_t),
    vuotaSeManca(r.giacenza_aci_t),
    vuotaSeManca(r.giacenza_extra_t),
    ...classi(r),
    r.tipo_destinazione === 'stoc' ? fmtData(r.data_rilevazione) : '',
    fmtData(r.aggiornata_al),
    r.in_attesa_dichiarazione_t,
    r.ordini_da_dichiarare || 0,
    r.dichiarato_t,
    r.tipologia_trattamento || '',
  ]);
  // Il totale e' per canale, come le colonne: tre numeri, mai uno che li somma.
  sitRows.push(['TOTALE', '', data.totali.giacenza_portale_t, data.totali.giacenza_aci_t || 0, data.totali.giacenza_extra_t || 0, ...classi(data.totali), '', '', data.totali.in_attesa_dichiarazione_t, data.totali.ordini_da_dichiarare, data.totali.dichiarato_t, '']);
  const ws1 = XLSX.utils.aoa_to_sheet([sitHeaders, ...sitRows]);
  ws1['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 24 }, ...CLASSI.map(() => ({ wch: 11 })), { wch: 20 }, { wch: 18 }, { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws1), 'Situazione');

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
  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws2), 'Da dichiarare');

  // --- Foglio 3: Derivati ---
  const derHeaders = ['Sito', 'Dichiarato (t)', 'Granulo (t)', 'Fibre (t)', 'Metallo (t)', 'Cippato (t)', 'Ciabattato (t)'];
  const derRows = data.righe.filter(r => r.dichiarato_t > 0).map(r => [
    r.sito, r.dichiarato_t, r.granulo_t, r.fibre_t, r.metallo_t, r.cippato_t, r.ciabattato_t,
  ]);
  derRows.push(['TOTALE', data.totali.dichiarato_t, data.totali.granulo_t, data.totali.fibre_t, data.totali.metallo_t, data.totali.cippato_t, data.totali.ciabattato_t]);
  const ws3 = XLSX.utils.aoa_to_sheet([derHeaders, ...derRows]);
  ws3['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws3), 'Derivati');

  // --- Foglio 4: Target ---
  // Target, residuo e copertura solo sul canale RETE; ACI ed Extra a parte.
  const tarHeaders = ['Sito', 'Ruolo', 'Target primarie (t)', 'Target totale (t)', 'Primarie RETE (t)', 'Secondarie netto (t)', 'Secondarie in (t)', 'Secondarie out (t)', 'Terziarie (t)', 'Conferito RETE (t)', 'Residuo (t)', 'Copertura RETE (%)', 'ACI, fuori target (t)', 'Extra Raccolta, fuori target (t)'];
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
    r.conferito_aci_t || 0,
    r.conferito_extra_t || 0,
  ]);
  const residuoTot = data.totali.target_totale_t > 0 ? data.totali.target_totale_t - data.totali.conferito_primarie_t : '';
  const copTot = data.totali.target_totale_t > 0 ? (data.totali.conferito_primarie_t / data.totali.target_totale_t * 100) : '';
  tarRows.push(['TOTALE', '', data.totali.target_primarie_t, data.totali.target_totale_t || '', data.totali.conferito_primarie_t, data.totali.secondarie_nette_t, data.totali.secondarie_in_t, data.totali.secondarie_out_t, data.totali.terziarie_t, data.totali.conferito_t, residuoTot, copTot, data.totali.conferito_aci_t || 0, data.totali.conferito_extra_t || 0]);
  const ws4 = XLSX.utils.aoa_to_sheet([tarHeaders, ...tarRows]);
  ws4['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws4), 'Target');

  XLSX.writeFile(wb, `giacenze_${anno}.xlsx`);
}