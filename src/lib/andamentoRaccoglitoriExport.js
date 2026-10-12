import { documentoDa, nuovaCartella, foglioDaRighe, scaricaCartella, FORMATI } from '@/lib/fogliProfessionali';

// L'Excel dell'andamento: un foglio per raccoglitore (mesi in colonna) e uno per
// zona. Solo rete, come la vista da cui nasce.
//
// IL FILE SI VESTE E DICE LA DATA DEI DATI (chiusura dell'audit, 11/10/2026).
// Usciva da SheetJS, senza fascia ne' piede, e non diceva fino a che giorno
// arrivavano le primarie di rete da cui nasce. Ora passa dal corredo comune
// (fogliProfessionali.js): le stesse righe di prima sotto il blocco di testa -
// canale, anno per fine trasporto, dati fino al, generato il ... da ....

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/** L'Excel dell'andamento. opzioni.stato: lo stato dei dati gia' letto (le prove). */
export async function scaricaExcelAndamento(andamento, zone, opzioni = {}) {
  const doc = await documentoDa({
    titolo: `Andamento della raccolta RETE — ${andamento.anno}`,
    canale: 'RETE', periodo: `Anno ${andamento.anno}`, entita: ['PrimariaRete'],
    ...(opzioni.stato !== undefined ? { stato: opzioni.stato } : {}),
  });

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

  const { wb } = await nuovaCartella();
  foglioDaRighe(wb, 'Per raccoglitore', {
    doc,
    righe: [
      ...testa,
      ['Raccoglitore', ...MESI, 'Anno kg', 'Target kg', 'Scarto kg', 'Dove ha raccolto', 'Zona di competenza', 'Fuori zona'],
      ...righe,
    ],
    testate: [testa.length],
    stili: { 0: 'gruppo', 1: 'nota', 2: 'nota' },
    // i mesi sono chili anche se il titolo non lo dice
    formati: Object.fromEntries(MESI.map((_m, i) => [i + 1, FORMATI.kg])),
    larghezze: [30, ...MESI.map(() => 11), 13, 13, 13, 22, 22, 34],
  });

  if (zone && zone.length) {
    foglioDaRighe(wb, 'Per zona', {
      doc,
      righe: [
        ['Provincia', 'Regione', 'Raccolto kg', 'Ritiri', 'Di cui fuori zona kg', 'Chi ci ha raccolto'],
        ...zone.map(z => [
          z.provincia, z.regione, z.kg, z.ritiri, z.fuori_zona_kg || '',
          z.raccoglitori.map(r => `${r.nome}: ${r.kg} kg${r.di_sua_competenza === false ? ' (fuori zona)' : r.di_sua_competenza === null ? ' (zona non scritta)' : ''}`).join('; '),
        ]),
      ],
      formati: { 3: FORMATI.intero },
      larghezze: [11, 18, 13, 9, 18, 70],
    });
  }

  return scaricaCartella(wb, `Andamento raccolta rete ${andamento.anno}.xlsx`);
}
