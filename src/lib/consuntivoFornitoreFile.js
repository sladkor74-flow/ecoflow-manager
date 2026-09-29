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
  info.push([], ['Nota', 'E\' un report del fornitore, non una fattura: non c\'e\' IVA e non c\'e\' imponibile. Dal conto della passiva restano fuori per costruzione le terziarie, gli oneri fissi dell\'extra raccolta e il trasporto delle secondarie di extra raccolta.']);

  const ws = XLSX.utils.aoa_to_sheet(info);
  ws['!cols'] = [{ wch: 38 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws), 'Riepilogo');

  const wsR = XLSX.utils.aoa_to_sheet([
    ['Formulario o ordine', 'Esito', 'kg nel consuntivo', 'kg nei nostri movimenti', 'Scarto kg', 'ID ordine'],
    ...confronto.voci.map(v => [
      String(v.chiave).replace(/^(FIR|ORD):/, ''),
      ESITI[v.esito] || v.esito,
      v.kg_consuntivo === null ? '' : v.kg_consuntivo,
      v.kg_gestionale === null ? '' : v.kg_gestionale,
      v.scarto_kg === null ? '' : v.scarto_kg,
      v.id_ordine || '',
    ]),
  ]);
  wsR['!cols'] = [{ wch: 24 }, { wch: 34 }, { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, wsR), 'Riga per riga');

  const nome = `Consuntivo ${consuntivo.fornitore} ${NOME_CANALE[consuntivo.canale]} ${MESI[consuntivo.mese - 1]} ${consuntivo.anno}`.replace(/[\\/:*?"<>|]/g, '-');
  XLSX.writeFile(wb, `${nome}.xlsx`);
}
