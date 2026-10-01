import { leggiFogliLista } from '@/lib/evasioneAssegnati';
import * as XLSX from 'xlsx';
import { formattaPesi } from '@/lib/formatoExcel';

// Il consuntivo di un fornitore si legge NEL BROWSER e il file non si conserva:
// al server arrivano solo le celle, come per le liste degli assegnati. Cosi' non
// resta in giro un documento di un fornitore che nessuno ha chiesto di archiviare.

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const NOME_CANALE = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
const NOME_RUOLO = { raccoglitore: 'Raccoglitore', impianto: 'Impianto o stoccaggio', trasportatore: 'Trasportatore di secondarie' };

/** Le tabelle di un file, nella forma che il lettore condiviso si aspetta. */
export async function tabelleDalFile(file) {
  const { fogli } = await leggiFogliLista([file]);
  return fogli.map(f => ({ nome: f.nome, celle: f.righe.map(r => r.c) }));
}

const ESITI = {
  uguale: 'torna',
  peso_diverso: 'peso diverso',
  solo_consuntivo: 'ce lo fattura e noi non l\'abbiamo',
  solo_gestionale: 'l\'abbiamo noi e il consuntivo non lo riporta',
};

/** L'Excel del confronto, come per le verifiche settimanali. */
export function scaricaExcelConsuntivo(consuntivo, esito) {
  const { confronto, costo, esito: verdetto, congelato, testo } = esito;
  const wb = XLSX.utils.book_new();

  const info = [
    ['Verifica del consuntivo di chiusura mese'],
    ['Fornitore', consuntivo.fornitore],
    ['Ruolo', NOME_RUOLO[consuntivo.ruolo] || consuntivo.ruolo],
    ['Mese di competenza', `${MESI[consuntivo.mese - 1]} ${consuntivo.anno}, per fine trasporto`],
    ['Canale', NOME_CANALE[consuntivo.canale] || consuntivo.canale],
    ['File', consuntivo.file_nome || ''],
    ['Esito', testo],
    [],
    ['Formulari che tornano', confronto.uguali],
    ['Con peso diverso', confronto.peso_diverso],
    ['Che ci fattura e noi non abbiamo', `${confronto.solo_consuntivo} (${confronto.kg_solo_consuntivo} kg)`],
    ['Che abbiamo noi e non riporta', `${confronto.solo_gestionale} (${confronto.kg_solo_gestionale} kg)`],
    ['Righe non abbinabili', `${confronto.senza_chiave} (${confronto.senza_chiave_kg} kg)`],
    [],
    ['Chili del consuntivo', confronto.totale_consuntivo_kg],
    ['Chili dei nostri movimenti', confronto.totale_gestionale_kg],
    ['Scarto', confronto.scarto_totale_kg],
    [],
    ['Importo previsto dalle tariffe', costo && costo.trovato ? costo.importo : (costo ? costo.motivo : '')],
    ['Importo scritto sul consuntivo', verdetto.importo_consuntivo === null ? 'non indicato' : verdetto.importo_consuntivo],
    ['Scarto sull\'importo', verdetto.scarto_importo === null ? '' : verdetto.scarto_importo],
    ['Chili che la passiva conta', verdetto.scarto_passiva_kg === null ? '' : confronto.totale_gestionale_kg - verdetto.scarto_passiva_kg],
  ];
  if (congelato) {
    info.push([], ['Conto della passiva congelato il', congelato.congelato_il ? String(congelato.congelato_il).slice(0, 10) : ''],
      ['Importo di allora', congelato.importo_allora === null ? '' : congelato.importo_allora],
      ['Importo ricalcolato oggi', congelato.importo_oggi === null ? '' : congelato.importo_oggi],
      ['Si e\' mosso', congelato.cambiato ? 'si, e va capito perche' : 'no']);
  }
  // Gli errori sulle date, in testa alle note. Una data di un mese che non
  // c'entra e' un errore del file del fornitore (01/10/2026).
  const gg = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}/${String(d).slice(0, 4)}` : '');
  const sbagliate = (confronto.date_sbagliate || []).filter(Boolean);
  if (sbagliate.length) {
    info.push([], ['DATA SBAGLIATA: carichi di questo mese con la data di un altro', `${sbagliate.length}. Restano nel confronto perche' i chili sono di questo mese, ma la data sul consuntivo va corretta.`]);
    for (const a of sbagliate) {
      info.push([a.numero_fir || a.id_ordine || 'senza numero', `${a.kg} kg: sul consuntivo ${gg(a.giorno)}, da noi il trasporto si conclude il ${gg(a.nostro_giorno)}`]);
    }
  }
  const altriMesi = (confronto.altri_mesi || []).filter(Boolean);
  if (altriMesi.length && !confronto.registro_di_piu_mesi) {
    info.push([], ['Righe di un altro mese', `${altriMesi.length}: anche da noi quei carichi si concludono in un altro mese, quindi vanno nel consuntivo del loro mese. Se quel mese e' stato fatturato, attenzione a non pagarle due volte.`]);
    for (const a of altriMesi) info.push([a.numero_fir || a.id_ordine || 'senza numero', `${a.kg} kg del ${gg(a.giorno)}`]);
  }
  // I carichi di altri mesi che nel gestionale non risultano: non sono chili di
  // questo mese, ma hanno una scadenza (01/10/2026).
  const arretrati = (confronto.arretrati || []).filter(Boolean);
  if (arretrati.length) {
    info.push([], ['DA REGISTRARE: carichi di altri mesi che non risultano', `${arretrati.length} (${confronto.kg_arretrati || 0} kg). Non entrano nei conti di questo mese. Il termine per la registrazione e\' di dieci giorni dalla data di partenza, domeniche escluse.`]);
    for (const a of arretrati) {
      info.push([a.numero_fir || a.id_ordine || 'senza numero',
        `${a.kg} kg del ${a.giorno ? String(a.giorno).slice(8, 10) + '/' + String(a.giorno).slice(5, 7) + '/' + String(a.giorno).slice(0, 4) : 'data non leggibile'}${a.termine && a.termine.scadenza ? `, da registrare entro il ${String(a.termine.scadenza).slice(8, 10)}/${String(a.termine.scadenza).slice(5, 7)}/${String(a.termine.scadenza).slice(0, 4)}` : ''}`]);
    }
  }
  // Come e' stato letto il file: quali colonne, quali fogli saltati e perche'.
  // Senza queste righe un numero sbagliato non si spiega piu'.
  const note = (esito.note_lettura || []).filter(Boolean);
  if (note.length) {
    info.push([], ['Come e\' stato letto il file', note[0]]);
    for (const n of note.slice(1)) info.push(['', n]);
  }
  info.push([], ['Nota', 'E\' un report del fornitore, non una fattura: non c\'e\' IVA e non c\'e\' imponibile. Dal conto della passiva restano fuori per costruzione le terziarie, gli oneri fissi dell\'extra raccolta e il trasporto delle secondarie di extra raccolta.']);

  const ws = XLSX.utils.aoa_to_sheet(info);
  ws['!cols'] = [{ wch: 38 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws), 'Riepilogo');

  const wsR = XLSX.utils.aoa_to_sheet([
    // Le ultime due colonne dicono i numeri scritti male e come si e' capito di
    // che carico si trattava (01/10/2026).
    ['Formulario o ordine', 'Esito', 'kg nel consuntivo', 'kg nei nostri movimenti', 'Scarto kg', 'ID ordine', 'Errori nei dati del consuntivo', 'Riconosciuto da'],
    ...confronto.voci.map(v => [
      String(v.chiave).replace(/^(FIR|ORD):/, ''),
      ESITI[v.esito] || v.esito,
      v.kg_consuntivo === null ? '' : v.kg_consuntivo,
      v.kg_gestionale === null ? '' : v.kg_gestionale,
      v.scarto_kg === null ? '' : v.scarto_kg,
      v.id_ordine || '',
      (v.differenze || []).map(d => d.testo).join('\n'),
      (v.riconosciuto_da || []).join(', '),
    ]),
  ]);
  wsR['!cols'] = [{ wch: 24 }, { wch: 34 }, { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 70 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, wsR), 'Riga per riga');

  const nome = `Consuntivo ${consuntivo.fornitore} ${NOME_CANALE[consuntivo.canale]} ${MESI[consuntivo.mese - 1]} ${consuntivo.anno}`.replace(/[\\/:*?"<>|]/g, '-');
  XLSX.writeFile(wb, `${nome}.xlsx`);
}
