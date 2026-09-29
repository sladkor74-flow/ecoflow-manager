import * as XLSX from 'xlsx';
import { formattaPesi } from '@/lib/formatoExcel';

// L'Excel dell'andamento: un foglio per raccoglitore (mesi in colonna) e uno per
// zona. Solo rete, come la vista da cui nasce.

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export function scaricaExcelAndamento(andamento, zone) {
  const wb = XLSX.utils.book_new();

  const testa = [
    [`Andamento della raccolta RETE — ${andamento.anno}`],
    ['I chili di ogni mese sono per FINE TRASPORTO. ACI ed extra raccolta hanno i loro conti e non sono qui.'],
    ['Il target viene da Target & Status: dove non c\'e\', lo scarto resta vuoto, perche\' uno scarto senza target sarebbe un giudizio inventato.'],
    [],
  ];
  const righe = andamento.righe.map(r => [
    r.nome,
    ...r.mesi.map(m => m.kg),
    r.kg,
    r.target_anno_kg === null ? '' : r.target_anno_kg,
    r.scarto_anno_kg === null ? '' : r.scarto_anno_kg,
    r.province.map(p => p.provincia).join(' '),
    r.zona_dichiarata ? r.zona_province.join(' ') : 'non scritta',
    r.fuori_zona.length ? r.fuori_zona.map(p => `${p.provincia} (${p.kg} kg)`).join('; ') : '',
  ]);
  righe.push(['TOTALE', ...andamento.totali_mese, andamento.totale_kg, '', '', '', '', '']);

  const ws = XLSX.utils.aoa_to_sheet([
    ...testa,
    ['Raccoglitore', ...MESI, 'Anno kg', 'Target kg', 'Scarto kg', 'Dove ha raccolto', 'Zona di competenza', 'Fuori zona'],
    ...righe,
  ]);
  ws['!cols'] = [{ wch: 30 }, ...MESI.map(() => ({ wch: 11 })), { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 22 }, { wch: 22 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws), 'Per raccoglitore');

  if (zone && zone.length) {
    const wsZ = XLSX.utils.aoa_to_sheet([
      ['Provincia', 'Regione', 'Raccolto kg', 'Ritiri', 'Di cui fuori zona kg', 'Chi ci ha raccolto'],
      ...zone.map(z => [
        z.provincia, z.regione, z.kg, z.ritiri, z.fuori_zona_kg || '',
        z.raccoglitori.map(r => `${r.nome}: ${r.kg} kg${r.di_sua_competenza === false ? ' (fuori zona)' : r.di_sua_competenza === null ? ' (zona non scritta)' : ''}`).join('; '),
      ]),
    ]);
    wsZ['!cols'] = [{ wch: 11 }, { wch: 18 }, { wch: 13 }, { wch: 9 }, { wch: 18 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, wsZ), 'Per zona');
  }

  XLSX.writeFile(wb, `Andamento raccolta rete ${andamento.anno}.xlsx`);
}
