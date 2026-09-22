import * as XLSX from 'xlsx';

// L'export della fatturazione passiva: un file per canale (rete, ACI, extra
// raccolta non si sommano mai), in Excel e in PDF, con i blocchi del modello
// dell'amministrazione ("[FORMAT] - Fatturazione passiva Ecotyre"): raccoglitori,
// impianti e stoccaggi, trasporto delle secondarie. Per ogni fornitore una riga col
// totale e, sotto, il dettaglio con l'ambito, le tonnellate, il prezzo e l'importo.
// I numeri sono quelli a video: l'export non ricalcola niente. La struttura si
// costruisce in un punto solo (sezioniPassiva): Excel e PDF dicono le stesse cose.
const NOMI = { RETE: 'RETE', ACI: 'ACI', EXTRA_RACCOLTA: 'EXTRA RACCOLTA' };
const NOMI_TITOLO = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
const EER = 160103;
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
const unita = (um) => String(um || '').replace('/', '\\');
// tonnellate scritte dentro un testo: virgola italiana, stessi decimali delle colonne
const tTesto = (v) => r3(v).toFixed(3).replace(/0$/, '').replace('.', ',');   // due decimali, tre se i chili non sono tondi

// Da dove viene il prezzo di una riga di raccolta: destinazione, provincia o classe
const ambitoRaccolta = (r) => [r.provincia !== '—' && r.provincia, r.destinazione !== '—' && `verso ${r.destinazione}`, r.classe !== '—' && `classe ${r.classe}`].filter(Boolean).join(' · ') || 'tutte';
// Il viaggio misto (rete e ACI sullo stesso camion) in poche parole: la nota
// completa della pagina nel PDF si taglierebbe alla terza riga. A viaggio
// l'importo e' la quota dei chili di questo canale (regola dell'utente del
// 22/09/2026), quindi "nr. di viaggi" per "COSTO" non fa il totale: la nota dice
// quanti viaggi si pagano davvero.
const numeroIt = (v) => r2(v).toFixed(2).replace('.', ',');
const euroIt = (v) => { const [i, d] = r2(v).toFixed(2).split('.'); return `${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`; };
// Se l'altro canale non ha una tariffa per la tratta, la sua quota dei misti non
// la paga nessuno (altro_canale_da_pagare): la nota breve lo dice, con l'importo
// calcolato a questa tariffa (revisione del 22/09/2026).
function notaSecondaria(r, tipologia) {
  const daPagare = r.altro_canale_da_pagare;
  if (!(r.viaggi_misti > 0) || !(r.nota_informativa || daPagare)) return r.note || null;
  const altro = tipologia === 'ACI' ? 'la rete' : "l'ACI";
  const misti = `${r.viaggi_misti} ${r.viaggi_misti === 1 ? 'misto' : 'misti'} con ${altro}`;
  const breve = r.unita_misura === '€/viaggio'
    ? `${r.viaggi_interi || 0} ${r.viaggi_interi === 1 ? 'intero' : 'interi'} + ${misti}, ${r.viaggi_misti === 1 ? 'diviso' : 'divisi'} per peso: ${numeroIt(r.viaggi_quota)} viaggi pagati`
    : `di cui ${misti}: ogni canale paga i suoi chili`;
  if (!daPagare) return breve;
  const quali = `${daPagare.viaggi_misti} ${daPagare.viaggi_misti === 1 ? 'misto' : 'misti'}`;
  return `${breve}; quota ${daPagare.canale} di ${quali} senza tariffa ${daPagare.canale} o TUTTE: ${euroIt(daPagare.importo)} € da pagare`;
}

const ambitoImpianto = (r) => [r.prestazione === 'CONFERIMENTO_STOCCAGGIO' ? 'Stoccaggio' : r.prestazione === 'TRATTAMENTO' ? 'Trattamento' : r.prestazione, r.classe !== '—' && `classe ${r.classe}`, r.provenienza && r.provenienza !== '—' && `da ${r.provenienza}`].filter(Boolean).join(' · ');

/**
 * Le tre sezioni del report: [{ tipo, titolo, colonne, righe: [{ celle, stile }] }].
 * stile: 'gruppo' per la riga del fornitore, 'totale' per il totale della sezione.
 */
export function sezioniPassiva(result) {
  const blocco = (titolo, colonnaPrezzo, fornitori, ambito, totale) => {
    const righe = [];
    for (const f of fornitori || []) {
      righe.push({ stile: 'gruppo', celle: [f.fornitore, r3(f.totale_tonnellate), null, null, EER, r2(f.totale_euro), f.interno ? 'interno, non fatturato' : null] });
      for (const r of f.righe || []) {
        const conferenti = (r.di_cui || []).map(d => `${d.fornitore} ${tTesto(d.tonnellate)} t`).join('; ');
        righe.push({ celle: [`   ${ambito(r)}`, r3(r.tonnellate), r.tariffa_valore || 0, unita(r.unita_misura), null, r2(r.importo), [r.note, conferenti && `di cui conferito da: ${conferenti}`].filter(Boolean).join(' — ') || null] });
      }
      for (const d of f.di_cui || []) righe.push({ celle: [`   di cui ${d.fornitore}`, r3(d.tonnellate), null, null, null, null, 'subraccoglitore, fatturato dal principale'] });
    }
    righe.push({ stile: 'totale', celle: ['Totale complessivo', r3((fornitori || []).reduce((s, f) => s + (f.totale_tonnellate || 0), 0)), null, null, null, r2(totale), null] });
    return {
      tipo: 'blocco', titolo,
      colonne: [
        { titolo, tipo: 'testo', peso: 3.2 }, { titolo: 'Totale [t]', tipo: 't', peso: 0.9 }, { titolo: colonnaPrezzo, tipo: 'euro', peso: 1 }, { titolo: 'Unità', tipo: 'testo', peso: 0.7 },
        { titolo: 'EER', tipo: 'testo', peso: 0.7 }, { titolo: 'TOTALE [€]', tipo: 'euro', peso: 1.1 }, { titolo: 'Note', tipo: 'testo', peso: 3.2 },
      ],
      righe,
    };
  };

  const secondarie = [];
  for (const f of result.trasporti_secondaria || []) {
    for (const r of f.righe || []) {
      secondarie.push({ celle: [r.stoccaggio, r.trasportatore || f.fornitore, r.destinazione, r3(r.tonnellate), unita(r.unita_misura), r.tariffa_valore || 0, r.viaggi || 0, r2(r.importo), f.fornitore, notaSecondaria(r, result.tipologia)] });
    }
  }
  secondarie.push({ stile: 'totale', celle: ['Totale complessivo', null, null, r3((result.trasporti_secondaria || []).reduce((s, f) => s + (f.totale_tonnellate || 0), 0)), null, null, null, r2(result.totali.trasporti_secondaria), null, null] });

  return [
    blocco('RACCOGLITORI', 'Costo di Raccolta', result.raccoglitori, ambitoRaccolta, result.totali.raccoglitori),
    blocco('IMPIANTI \\ STOCCAGGI', 'Costo', result.impianti_stoccaggi, ambitoImpianto, result.totali.impianti_stoccaggi),
    {
      tipo: 'secondarie', titolo: 'TRASPORTO DELLE SECONDARIE',
      colonne: [
        { titolo: 'PRODUTTORE', tipo: 'testo', peso: 1.6 }, { titolo: 'TRASPORTATORE', tipo: 'testo', peso: 1.7 }, { titolo: 'DESTINATARIO', tipo: 'testo', peso: 1.5 }, { titolo: 'PESO [t]', tipo: 't', peso: 0.8 },
        { titolo: "UNITA' DI MISURA", tipo: 'testo', peso: 0.8 }, { titolo: 'COSTO', tipo: 'euro', peso: 0.8 }, { titolo: 'nr. di viaggi', tipo: 'intero', peso: 0.7 }, { titolo: 'TOTALE [€]', tipo: 'euro', peso: 1 },
        { titolo: 'Fatturato da', tipo: 'testo', peso: 1.6 }, { titolo: 'Note', tipo: 'testo', peso: 2.2 },
      ],
      righe: secondarie,
    },
  ];
}

// Per ogni riga del foglio, in che blocco sta: decide quale colonna e' in tonnellate e quale in euro
const FORMATI = {
  testa: { 6: '#,##0.00' },
  blocco: { 1: '#,##0.00#', 2: '#,##0.00', 5: '#,##0.00' },
  secondarie: { 3: '#,##0.00#', 5: '#,##0.00', 6: '#,##0', 7: '#,##0.00' },
};

/** Le righe del foglio Excel, dalle stesse sezioni del PDF. tipi[i] dice il blocco della riga i. */
export function righePassiva(result, tipi = []) {
  const aoa = [];
  let tipo = 'testa';
  const riga = (r) => { tipi.push(tipo); aoa.push(r); };
  riga([NOMI[result.tipologia] || result.tipologia, `${result.mese} ${result.anno}`, null, null, null, 'TOTALE', r2(result.totali.totale_complessivo)]);
  riga([]);
  for (const s of sezioniPassiva(result)) {
    tipo = s.tipo;
    riga(s.colonne.map(c => c.titolo));
    for (const r of s.righe) riga(r.celle);
    riga([]);
  }
  tipo = 'testa';
  if ((result.anomalie || []).length) {
    riga(['ANOMALIE DA GUARDARE PRIMA DI PAGARE']);
    for (const a of result.anomalie) riga([a.descrizione, a.tonnellate ? r3(a.tonnellate) : null]);
  }
  return aoa;
}

const nomeFile = (result, estensione) => `Fatturazione_passiva_${result.tipologia}_${result.mese}_${result.anno}${estensione ? `.${estensione}` : ''}`;

export function exportFatturazionePassiva(result) {
  const tipi = [];
  const ws = XLSX.utils.aoa_to_sheet(righePassiva(result, tipi));
  tipi.forEach((t, R) => {
    for (const [C, z] of Object.entries(FORMATI[t] || {})) {
      const c = ws[XLSX.utils.encode_cell({ r: R, c: Number(C) })];
      if (c && c.t === 'n') c.z = z;
    }
  });
  ws['!cols'] = [{ wch: 46 }, { wch: 26 }, { wch: 24 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 60 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, NOMI[result.tipologia] || 'Passiva');
  XLSX.writeFile(wb, nomeFile(result, 'xlsx'));
  return nomeFile(result, 'xlsx');
}

// Lo stesso report in PDF: stesse sezioni, stesse righe, stessi totali
export async function exportFatturazionePassivaPdf(result) {
  const { esportaSezioniPdf } = await import('@/lib/esportaTabella');
  await esportaSezioniPdf({
    nomeFile: nomeFile(result),
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE  ·  FATTURAZIONE PASSIVA',
    titolo: `Fatturazione passiva ${NOMI_TITOLO[result.tipologia] || result.tipologia} — ${result.mese} ${result.anno}`,
    sottotitolo: 'Costi verso i fornitori, per prestazione',
    riepilogo: [
      { etichetta: 'Raccoglitori', valore: r2(result.totali.raccoglitori), tipo: 'euro' },
      { etichetta: 'Impianti e stoccaggi', valore: r2(result.totali.impianti_stoccaggi), tipo: 'euro' },
      { etichetta: 'Trasporto delle secondarie', valore: r2(result.totali.trasporti_secondaria), tipo: 'euro' },
      { etichetta: `Totale ${NOMI_TITOLO[result.tipologia] || ''}`, valore: r2(result.totali.totale_complessivo), tipo: 'euro' },
    ],
    sezioni: sezioniPassiva(result),
    note: (result.anomalie || []).map(a => a.descrizione),
  });
  return nomeFile(result, 'pdf');
}
