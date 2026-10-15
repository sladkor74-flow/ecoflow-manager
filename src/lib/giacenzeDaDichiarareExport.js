import { formattaPesi } from '@/lib/formatoExcel';
import { oggiRoma } from '@/lib/giornoItaliano';
import { INTESTAZIONI_NEL_FILE, celleNelFile, noteSchedaDaDichiarare } from '@/lib/giacenzePdf';

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
//
// opzioni.dati (15/10/2026): la risposta intera di getOrdiniDaDichiarare.
// L'elenco e' il file del portale piu' i carichi arrivati dopo, meno il
// dichiarato a portale dopo il file: il foglio porta la colonna «Nel file del
// portale» col giorno del file, il giorno dell'arrivo all'impianto quando e' un
// altro, il dichiarato dopo tolto dalla riga (INTESTAZIONI_NEL_FILE e
// celleNelFile, le stesse per ogni foglio con l'elenco), e sotto il TOTALE le
// stesse note del PDF (noteSchedaDaDichiarare, src/lib/giacenzePdf.js). Le note stanno in
// fondo: in testa il foglio dell'anno in corso comincia dalle intestazioni,
// come sempre.
//
// opzioni.filtri (revisione del 15/10/2026): gli stessi filtri che la scheda da'
// al PDF (sito, ruolo, gli arrivi senza fine trasporto, l'attesa per noi
// chiusa). Senza, le note dell'Excel non erano quelle del PDF: dal pulsante di
// uno stoccaggio dicevano che l'elenco comprende i carichi arrivati dopo, e
// mancava la frase sugli arrivi senza fine trasporto.
//
// Il foglio e' ancora SheetJS, l'unico della casa (AGENTS.md, «I documenti che
// escono»): passarlo al corredo comune (fogliProfessionali.js, exceljs) vuol dire
// cambiare anche la prova che ne finge la libreria
// (prove/ordiniAnniPassatiEtichette.mjs, sezione 4), che non e' di questo giro.
export async function exportDaDichiarareExcel(righe, totaleRighe, totaleKg, opzioni = {}) {
  const c = opzioni && opzioni.carichi_del;
  const carichiDel = c === null || c === undefined || c === '' || !Number.isFinite(Number(c)) ? null : Number(c);
  const dati = (opzioni && opzioni.dati) || {};
  const filtri = (opzioni && opzioni.filtri) || {};
  const fotoDel = dati.foto_del || null;
  const parti = dati.parti || null;
  // xlsx pesa mezzo megabyte: si carica quando si esporta, non all'apertura.
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const headers = [
    'Ordine', 'FIR', 'Fine trasporto', 'Punto di raccolta', 'Comune', 'Prov.',
    'Prodotto', 'CER', 'Peso da dichiarare (kg)', 'Destinazione', 'Trasferito a', 'Trasportatore',
    'Formulario nel gestionale: date da sistemare', 'Collocato in un mese dal gestionale',
    ...INTESTAZIONI_NEL_FILE,
  ];

  const rows = righe.map(r => [
    r.ordine_primaria || r.ordine_secondaria || '',
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
    ...celleNelFile(r, fotoDel),
  ]);

  // Il dichiarato oltre i carichi (una giacenza sotto zero) in una riga sua,
  // perche' il TOTALE sia quello della scheda.
  if (parti && parti.oltre_kg > 0) rows.push(['Dichiarato a portale dopo il file, oltre i carichi dell\'elenco', '', '', '', '', '', '', '', -parti.oltre_kg, '', '', '', '', '', '', '', '']);
  rows.push(['TOTALE', '', '', '', '', '', '', '', totaleKg, '', '', '', '', '', '', '', '']);
  const note = noteSchedaDaDichiarare(dati, filtri);

  const testa = carichiDel !== null
    ? [[`Carichi del ${carichiDel} ancora da dichiarare oggi: il file degli ordini non dichiarati del portale è di oggi, e qui ci sono solo i carichi arrivati nel ${carichiDel}, per fine trasporto, che oggi sono ancora da dichiarare.`], []]
    : [];
  const ws = XLSX.utils.aoa_to_sheet([...testa, headers, ...rows, ...(note.length ? [[], ...note.map(n => [n])] : [])]);
  ws['!cols'] = [
    { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 6 },
    { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 24 }, { wch: 24 }, { wch: 24 },
    { wch: 48 }, { wch: 36 }, { wch: 30 }, { wch: 16 }, { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws), 'Ordini da dichiarare');
  // Il giorno nel nome del file e' quello italiano: fra mezzanotte e le due, d'estate, l'UTC era ancora ieri.
  XLSX.writeFile(wb, `ordini_da_dichiarare_${carichiDel !== null ? `carichi_del_${carichiDel}_` : ''}${oggiRoma()}.xlsx`);
}
