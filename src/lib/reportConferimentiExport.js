import { documentoDa, nuovaCartella, foglioDaRighe, scaricaCartella, FORMATI } from '@/lib/fogliProfessionali';

// L'Excel del report dei conferimenti: le settimane in colonna, le tratte in riga,
// e - quando e' stata chiesta - la quadratura con la fatturazione passiva in un
// foglio suo.
//
// Un file per canale, mai due canali nello stesso foglio (regola 3): il report da
// cui nasce ne ha uno solo, e il nome del file lo dice.
//
// IL FILE SI MANDA AL FORNITORE, QUINDI SI VESTE (chiusura dell'audit,
// 11/10/2026). Usciva da SheetJS, senza fascia ne' piede, e non diceva fino a che
// giorno arrivavano i movimenti da cui nasce. Ora passa dal corredo comune
// (fogliProfessionali.js): le stesse righe e le stesse colonne di prima, sotto il
// blocco di testa del documento - canale, mese per fine trasporto, dati fino al,
// generato il ... da ... - e col piede delle pagine.

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const NOME_CANALE = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
const gg = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');

// L'archivio da cui nasce il report: le primarie del canale o le secondarie.
// L'extra raccolta tiene raccolta e trasferimenti nelle sue schede.
function archiviDel(report) {
  if (report.canale === 'EXTRA_RACCOLTA') return ['ExtraRaccolta'];
  if (report.tipo === 'secondaria') return ['Secondaria'];
  return [report.canale === 'ACI' ? 'PrimariaAci' : 'PrimariaRete'];
}

/** L'Excel del report. opzioni.stato: lo stato dei dati gia' letto (le prove). */
export async function scaricaExcelConferimenti(report, quadratura, titolo, opzioni = {}) {
  const canale = NOME_CANALE[report.canale] || report.canale;
  const tipo = report.tipo === 'secondaria' ? 'Secondarie' : 'Primarie';
  const colonnaOrigine = report.tipo === 'secondaria' ? 'Stoccaggio di origine' : 'Provincia di ritiro';
  const periodo = `${MESI[report.mese - 1]} ${report.anno}`;
  const doc = await documentoDa({
    titolo: `${titolo || 'Conferimenti'} — ${tipo.toLowerCase()} ${canale}, ${periodo}`,
    canale: report.canale, periodo, entita: archiviDel(report),
    ...(opzioni.stato !== undefined ? { stato: opzioni.stato } : {}),
  });

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

  const { wb } = await nuovaCartella();
  const settimana = [...nota, intestazioni, ...righe];
  const ultimaColonna = intestazioni.length - 1;
  foglioDaRighe(wb, 'Per settimana', {
    doc, righe: settimana, testate: [nota.length],
    stili: Object.fromEntries(nota.map((r, i) => [i, r.length ? (/^Restano fuori/.test(r[0]) ? 'avviso' : 'nota') : null]).filter(([, s]) => s)),
    // i formulari sono un conteggio, non chili
    formati: { [ultimaColonna]: FORMATI.intero },
    larghezze: [28, 28, 24, ...report.settimane.map(() => 14), 14, 11],
  });

  foglioDaRighe(wb, 'Per destinazione', {
    doc,
    righe: [
      ['Destinazione', 'Tratte', 'Formulari', 'Totale kg'],
      ...report.per_destinazione.map(d => [d.destinazione, d.tratte, d.formulari, d.kg]),
    ],
    formati: { 1: FORMATI.intero, 2: FORMATI.intero },
    larghezze: [30, 10, 11, 14],
  });

  if (quadratura && quadratura.disponibile) {
    const testa = [
      [quadratura.quadra
        ? `Quadra con la fatturazione passiva: ${quadratura.totale_report_kg} kg su tutte le tratte.`
        : `${quadratura.n_difformi} tratte non quadrano con la fatturazione passiva.`],
      ['Si confrontano i chili, non gli euro. L\'importo della passiva e\' accanto solo per informazione: dipende anche dai viaggi e dalle tariffe.'],
      ['Lo scarto si dice e non si aggiusta.'],
      [],
    ];
    foglioDaRighe(wb, 'Quadratura passiva', {
      doc,
      righe: [
        ...testa,
        [colonnaOrigine, 'Destinazione', 'Trasportatore', 'kg nel report', 'kg nella passiva', 'Scarto kg', 'Importo passiva', 'Unita', 'Nota'],
        ...quadratura.voci.map(v => [
          v.origine, v.destinazione, v.trasportatore,
          v.kg_report, v.kg_passiva === null ? '' : v.kg_passiva,
          v.scarto_kg === null ? '' : v.scarto_kg,
          v.importo_passiva === null ? '' : v.importo_passiva,
          v.unita_misura || '',
          v.solo_report ? 'la passiva non la paga: di solito manca la tariffa' : v.solo_passiva ? 'sta solo nella passiva' : v.torna ? 'torna' : 'scarto da capire',
        ]),
      ],
      testate: [testa.length],
      stili: { 0: quadratura.quadra ? 'nota' : 'avviso', 1: 'nota', 2: 'nota' },
      formati: { 6: FORMATI.euro },
      larghezze: [28, 28, 24, 14, 16, 12, 15, 10, 44],
    });
  }

  const nome = `${titolo || 'Conferimenti'} ${canale} ${MESI[report.mese - 1]} ${report.anno}`.replace(/[\\/:*?"<>|]/g, '-');
  return scaricaCartella(wb, `${nome}.xlsx`);
}
