import { formattaPesi } from '@/lib/formatoExcel';

// L'Excel del report dei conferimenti: le settimane in colonna, le tratte in riga,
// e - quando e' stata chiesta - la quadratura con la fatturazione passiva in un
// foglio suo.
//
// Un file per canale, mai due canali nello stesso foglio (regola 3): il report da
// cui nasce ne ha uno solo, e il nome del file lo dice.

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const NOME_CANALE = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
const gg = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');

export async function scaricaExcelConferimenti(report, quadratura, titolo) {
  // xlsx pesa mezzo megabyte: si carica quando si esporta, non all'apertura.
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const canale = NOME_CANALE[report.canale] || report.canale;
  const tipo = report.tipo === 'secondaria' ? 'Secondarie' : 'Primarie';
  const colonnaOrigine = report.tipo === 'secondaria' ? 'Stoccaggio di origine' : 'Provincia di ritiro';

  const intestazioni = [
    colonnaOrigine, 'Destinazione', 'Trasportatore',
    ...report.settimane.map(s => `S${s.numero} (${gg(s.dal)}-${gg(s.al)}) kg`),
    'Totale kg', 'Formulari',
  ];
  const righe = report.righe.map(r => [
    r.origine, r.destinazione, r.trasportatore,
    ...report.settimane.map(s => r.settimane[s.numero].kg || 0),
    r.kg, r.formulari,
  ]);
  righe.push([
    'TOTALE', '', '',
    ...report.settimane.map(s => report.totali_settimana[s.numero].kg),
    report.totale_kg, report.totale_formulari,
  ]);

  const nota = [
    [`Conferimenti ${tipo.toLowerCase()} ${canale} — ${MESI[report.mese - 1]} ${report.anno}`],
    ['Il periodo e\' la FINE del trasporto, mai la chiusura a portale. Una settimana a cavallo di due mesi conta qui solo per i giorni che cadono nel mese.'],
    ['Un canale solo: rete, ACI ed extra raccolta non si sommano mai.'],
  ];
  if (report.senza_fine > 0) {
    nota.push([`Restano fuori ${report.senza_fine} movimenti terminati senza la data di fine trasporto, per ${report.senza_fine_kg} kg: ${report.senza_fine_ordini.join(', ')}`]);
  }
  nota.push([]);

  const ws = XLSX.utils.aoa_to_sheet([...nota, intestazioni, ...righe]);
  ws['!cols'] = [{ wch: 28 }, { wch: 28 }, { wch: 24 }, ...report.settimane.map(() => ({ wch: 14 })), { wch: 14 }, { wch: 11 }];
  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws), 'Per settimana');

  const wsDest = XLSX.utils.aoa_to_sheet([
    ['Destinazione', 'Tratte', 'Formulari', 'Totale kg'],
    ...report.per_destinazione.map(d => [d.destinazione, d.tratte, d.formulari, d.kg]),
  ]);
  wsDest['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 11 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, wsDest), 'Per destinazione');

  if (quadratura && quadratura.disponibile) {
    const wsQ = XLSX.utils.aoa_to_sheet([
      [quadratura.quadra
        ? `Quadra con la fatturazione passiva: ${quadratura.totale_report_kg} kg su tutte le tratte.`
        : `${quadratura.n_difformi} tratte non quadrano con la fatturazione passiva.`],
      ['Si confrontano i chili, non gli euro. L\'importo della passiva e\' accanto solo per informazione: dipende anche dai viaggi e dalle tariffe.'],
      ['Lo scarto si dice e non si aggiusta.'],
      [],
      [colonnaOrigine, 'Destinazione', 'Trasportatore', 'kg nel report', 'kg nella passiva', 'Scarto kg', 'Importo passiva', 'Unita', 'Nota'],
      ...quadratura.voci.map(v => [
        v.origine, v.destinazione, v.trasportatore,
        v.kg_report, v.kg_passiva === null ? '' : v.kg_passiva,
        v.scarto_kg === null ? '' : v.scarto_kg,
        v.importo_passiva === null ? '' : v.importo_passiva,
        v.unita_misura || '',
        v.solo_report ? 'la passiva non la paga: di solito manca la tariffa' : v.solo_passiva ? 'sta solo nella passiva' : v.torna ? 'torna' : 'scarto da capire',
      ]),
    ]);
    wsQ['!cols'] = [{ wch: 28 }, { wch: 28 }, { wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 44 }];
    XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, wsQ), 'Quadratura passiva');
  }

  const nome = `${titolo || 'Conferimenti'} ${canale} ${MESI[report.mese - 1]} ${report.anno}`.replace(/[\\/:*?"<>|]/g, '-');
  XLSX.writeFile(wb, `${nome}.xlsx`);
}
