import { formattaPesi } from '@/lib/formatoExcel';
import { oggiRoma } from '@/lib/giornoItaliano';

// Il formulario nel gestionale di una riga del file (regola dell'utente,
// 22/09/2026): le date obbligatorie che mancano o non tornano, formulario per
// formulario. La usa anche l'export complessivo delle Giacenze.
// Se alla primaria manca la fine trasporto e il file del portale la scrive, si
// dice quale: e' la data da riportare.
export const testoFormulario = (r) => (r.date_da_sistemare || []).map(d => `${d.tipo} ${d.id_ordine}: ${d.testo}`
  + (d.tipo === 'primaria' && d.senza_fine && r.fine_a_portale ? ` (a portale ${String(r.fine_a_portale).split('-').reverse().join('/')}: va riportata)` : '')).join('; ');
// Se il gestionale colloca il carico: senza la fine trasporto dell'arrivo
// all'impianto il portale lo conta nella giacenza, il gestionale in nessun mese.
// Se il file non scrive la fine trasporto, la data della riga e' quella del gestionale.
export const testoCollocato = (r) => (r.fuori_dai_mesi ? "no: manca la fine trasporto dell'arrivo, il portale lo conta e il gestionale no"
  : r.fine_dal_gestionale ? "si', con la fine trasporto del formulario nel gestionale: il file del portale non la scrive" : '');

// Export dell'elenco ordini da dichiarare in Excel.
// È la lista di lavoro da passare agli impianti.
// opzioni.carichi_del: su un anno passato l'elenco ha solo i carichi arrivati
// in quell'anno che oggi sono ancora da dichiarare (getOrdiniDaDichiarare, giro
// del 14/10/2026), e il foglio lo dice in testa e nel nome del file, come il
// PDF (pdfDeiCarichiDel in DaDichiarareTable): il file del portale e' di oggi.
export async function exportDaDichiarareExcel(righe, totaleRighe, totaleKg, opzioni = {}) {
  const c = opzioni && opzioni.carichi_del;
  const carichiDel = c === null || c === undefined || c === '' || !Number.isFinite(Number(c)) ? null : Number(c);
  // xlsx pesa mezzo megabyte: si carica quando si esporta, non all'apertura.
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const headers = [
    'Ordine', 'FIR', 'Fine trasporto', 'Punto di raccolta', 'Comune', 'Prov.',
    'Prodotto', 'CER', 'Peso da dichiarare (kg)', 'Destinazione', 'Trasferito a', 'Trasportatore',
    'Formulario nel gestionale: date da sistemare', 'Collocato in un mese dal gestionale',
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
    testoFormulario(r),
    testoCollocato(r),
  ]);

  rows.push(['TOTALE', '', '', '', '', '', '', '', totaleKg, '', '', '', '', '']);

  const testa = carichiDel !== null
    ? [[`Carichi del ${carichiDel} ancora da dichiarare oggi: il file degli ordini non dichiarati del portale è di oggi, e qui ci sono solo i carichi arrivati nel ${carichiDel}, per fine trasporto, che oggi sono ancora da dichiarare.`], []]
    : [];
  const ws = XLSX.utils.aoa_to_sheet([...testa, headers, ...rows]);
  ws['!cols'] = [
    { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 6 },
    { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 24 }, { wch: 24 }, { wch: 24 },
    { wch: 48 }, { wch: 36 },
  ];

  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws), 'Ordini da dichiarare');
  // Il giorno nel nome del file e' quello italiano: fra mezzanotte e le due, d'estate, l'UTC era ancora ieri.
  XLSX.writeFile(wb, `ordini_da_dichiarare_${carichiDel !== null ? `carichi_del_${carichiDel}_` : ''}${oggiRoma()}.xlsx`);
}
