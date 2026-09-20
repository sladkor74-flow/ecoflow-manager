// L'elenco dei documenti da gestire, da portare via: in Excel per lavorarci e
// filtrare, in PDF per stamparlo o allegarlo. Stesso ordine del promemoria via
// email: prima cio' che e' gia' un danno, poi cio' che lo diventera'.
import { dataIt, quandoScade, problemiDi } from '@/lib/qualifica';

const SEZIONI = [
  { stato: 'scaduto', titolo: 'DOCUMENTI SCADUTI' },
  { stato: 'non_conforme', titolo: 'DOCUMENTI NON CONFORMI' },
  { stato: 'in_scadenza', titolo: 'DOCUMENTI IN SCADENZA' },
  { stato: 'mancante', titolo: 'DOCUMENTI MAI RICEVUTI' },
  { stato: 'da_verificare', titolo: 'DOCUMENTI DA VERIFICARE' },
];
const NOME_STATO = {
  scaduto: 'Scaduto', non_conforme: 'Non conforme', in_scadenza: 'In scadenza',
  mancante: 'Mai ricevuto', da_verificare: 'Da verificare',
};

// Il motivo in breve: i problemi bloccanti se ci sono, altrimenti i primi due.
function motivo(req) {
  const p = problemiDi(req);
  const gravi = p.filter(x => x && x.gravita === 'bloccante');
  return (gravi.length ? gravi : p).slice(0, 2).map(x => String(x.messaggio || '').trim()).filter(Boolean).join(' ');
}

/** Tutte le righe da gestire, gia' ordinate: urgenza, poi giorni, poi fornitore. */
export function righeQualifica(soggetti) {
  const righe = [];
  for (const s of soggetti || []) {
    for (const r of s.requisiti || []) {
      const i = SEZIONI.findIndex(x => x.stato === r.stato);
      if (i < 0) continue;
      righe.push({
        ordine: i,
        stato: r.stato,
        fornitore: s.nome,
        ruoli: (s.ruoli || []).join(', '),
        documento: r.tipo_nome,
        obbligatorio: r.obbligatorio ? 'Si' : 'No',
        scadenza: r.scadenza || null,
        giorni: r.giorni,
        situazione: r.scadenza ? `${dataIt(r.scadenza)} (${quandoScade(r.giorni)})` : '',
        motivo: motivo(r),
      });
    }
  }
  return righe.sort((a, b) => a.ordine - b.ordine
    || ((a.giorni ?? 99999) - (b.giorni ?? 99999))
    || String(a.fornitore).localeCompare(String(b.fornitore), 'it'));
}

const COLONNE = [
  { titolo: 'Situazione', valore: r => NOME_STATO[r.stato] || r.stato, tipo: 'testo', peso: 1 },
  { titolo: 'Fornitore', valore: r => r.fornitore, tipo: 'testo', peso: 2.2 },
  { titolo: 'Ruoli', valore: r => r.ruoli, tipo: 'testo', peso: 1.4 },
  { titolo: 'Documento', valore: r => r.documento, tipo: 'testo', peso: 2 },
  { titolo: 'Obbligatorio', valore: r => r.obbligatorio, tipo: 'testo', peso: 0.8 },
  { titolo: 'Scadenza', valore: r => r.scadenza, tipo: 'data', peso: 0.9 },
  { titolo: 'Giorni', valore: r => r.giorni, tipo: 'intero', peso: 0.7 },
  { titolo: 'Motivo', valore: r => r.motivo, tipo: 'testo', peso: 3 },
];

const nomeFile = (anno) => `Qualifica_fornitori_${anno}`;

/** Excel: una tabella sola con la colonna Situazione, cosi' si filtra. */
export async function esportaQualificaExcel(soggetti, anno) {
  const { esportaTabellaExcel } = await import('@/lib/esportaTabella');
  const righe = righeQualifica(soggetti);
  await esportaTabellaExcel({
    nomeFile: nomeFile(anno), foglio: 'Da gestire',
    titolo: `Qualifica fornitori ${anno} — documenti da gestire`,
    sottotitolo: `${righe.length} righe, in ordine di urgenza`,
    colonne: COLONNE, righe,
  });
  return `${nomeFile(anno)}.xlsx`;
}

/** PDF: un blocco per urgenza, come il promemoria via email. */
export async function esportaQualificaPdf(soggetti, anno, anomalie) {
  const { esportaSezioniPdf } = await import('@/lib/esportaTabella');
  const righe = righeQualifica(soggetti);
  const colonne = COLONNE.filter(c => c.titolo !== 'Situazione').map(c => ({ titolo: c.titolo, tipo: c.tipo, peso: c.peso }));
  const sezioni = SEZIONI
    .map(s => ({ s, righe: righe.filter(r => r.stato === s.stato) }))
    .filter(x => x.righe.length > 0)
    .map(({ s, righe: dentro }) => ({
      tipo: 'blocco',
      titolo: `${s.titolo} (${dentro.length})`,
      colonne,
      righe: dentro.map(r => ({ celle: [r.fornitore, r.ruoli, r.documento, r.obbligatorio, r.scadenza, r.giorni, r.motivo] })),
    }));
  const conta = (stato) => righe.filter(r => r.stato === stato).length;
  await esportaSezioniPdf({
    nomeFile: nomeFile(anno),
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE  ·  QUALIFICA FORNITORI',
    titolo: `Qualifica fornitori ${anno} — documenti da gestire`,
    sottotitolo: `${righe.length} righe`,
    riepilogo: [
      { etichetta: 'Scaduti', valore: conta('scaduto'), tipo: 'intero' },
      { etichetta: 'Non conformi', valore: conta('non_conforme'), tipo: 'intero' },
      { etichetta: 'In scadenza', valore: conta('in_scadenza'), tipo: 'intero' },
      { etichetta: 'Mai ricevuti', valore: conta('mancante'), tipo: 'intero' },
      { etichetta: 'Da verificare', valore: conta('da_verificare'), tipo: 'intero' },
    ],
    sezioni,
    note: (anomalie || []).filter(a => a.gravita === 'errore').map(a => a.messaggio),
  });
  return `${nomeFile(anno)}.pdf`;
}
