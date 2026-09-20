import * as XLSX from 'xlsx';

// L'export della fatturazione passiva: un file per canale (rete, ACI, extra
// raccolta non si sommano mai), con i blocchi del modello dell'amministrazione
// ("[FORMAT] - Fatturazione passiva Ecotyre"): raccoglitori, impianti e stoccaggi,
// trasporto delle secondarie. Per ogni fornitore una riga col totale e, sotto, il
// dettaglio con l'ambito, le tonnellate, il prezzo e l'importo. I numeri sono
// quelli a video: l'export non ricalcola niente.
const NOMI = { RETE: 'RETE', ACI: 'ACI', EXTRA_RACCOLTA: 'EXTRA RACCOLTA' };
const EER = 160103;
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
const unita = (um) => String(um || '').replace('/', '\\');

// Da dove viene il prezzo di una riga di raccolta: destinazione, provincia o classe
const ambitoRaccolta = (r) => [r.provincia !== '—' && r.provincia, r.destinazione !== '—' && `verso ${r.destinazione}`, r.classe !== '—' && `classe ${r.classe}`].filter(Boolean).join(' · ') || 'tutte';
const ambitoImpianto = (r) => [r.prestazione === 'CONFERIMENTO_STOCCAGGIO' ? 'Stoccaggio' : r.prestazione === 'TRATTAMENTO' ? 'Trattamento' : r.prestazione, r.classe !== '—' && `classe ${r.classe}`, r.provenienza && r.provenienza !== '—' && `da ${r.provenienza}`].filter(Boolean).join(' · ');

// Per ogni riga, in che blocco sta: decide quale colonna e' in tonnellate e quale in euro
const FORMATI = {
  testa: { 6: '#,##0.00' },
  blocco: { 1: '#,##0.00#', 2: '#,##0.00', 5: '#,##0.00' },
  secondarie: { 3: '#,##0.00#', 5: '#,##0.00', 6: '#,##0', 7: '#,##0.00' },
};

export function righePassiva(result, tipi = []) {
  const canale = NOMI[result.tipologia] || result.tipologia;
  const aoa = [];
  // ogni riga registra in che blocco sta, per i formati
  let tipo = 'testa';
  const riga = (r) => { tipi.push(tipo); aoa.push(r); };
  riga([canale, `${result.mese} ${result.anno}`, null, null, null, 'TOTALE', r2(result.totali.totale_complessivo)]);
  riga([]);

  const blocco = (titolo, colonnaPrezzo, fornitori, ambito, totale) => {
    tipo = 'blocco';
    riga([titolo, 'Totale [t]', colonnaPrezzo, 'Unità', 'EER', 'TOTALE [€]', 'Note']);
    for (const f of fornitori || []) {
      riga([f.fornitore, r3(f.totale_tonnellate), null, null, EER, r2(f.totale_euro), f.interno ? 'interno, non fatturato' : null]);
      for (const r of f.righe || []) {
        const conferenti = (r.di_cui || []).map(d => `${d.fornitore} ${r3(d.tonnellate)} t`).join('; ');
        riga([`   ${ambito(r)}`, r3(r.tonnellate), r.tariffa_valore || 0, unita(r.unita_misura), null, r2(r.importo), [r.note, conferenti && `di cui conferito da: ${conferenti}`].filter(Boolean).join(' — ') || null]);
      }
      for (const d of f.di_cui || []) riga([`   di cui ${d.fornitore}`, r3(d.tonnellate), null, null, null, null, 'subraccoglitore, fatturato dal principale']);
    }
    riga(['Totale complessivo', r3((fornitori || []).reduce((s, f) => s + (f.totale_tonnellate || 0), 0)), null, null, null, r2(totale), null]);
    riga([]);
  };
  blocco('RACCOGLITORI', 'Costo di Raccolta', result.raccoglitori, ambitoRaccolta, result.totali.raccoglitori);
  blocco('IMPIANTI \\ STOCCAGGI', 'Costo', result.impianti_stoccaggi, ambitoImpianto, result.totali.impianti_stoccaggi);

  tipo = 'secondarie';
  riga(['PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO', 'PESO [t]', "UNITA' DI MISURA", 'COSTO', 'nr. di viaggi', 'TOTALE [€]', 'Fatturato da', 'Note']);
  for (const f of result.trasporti_secondaria || []) {
    for (const r of f.righe || []) {
      riga([r.stoccaggio, r.trasportatore || f.fornitore, r.destinazione, r3(r.tonnellate), unita(r.unita_misura), r.tariffa_valore || 0, r.viaggi || 0, r2(r.importo), f.fornitore, r.note || null]);
    }
  }
  riga(['Totale complessivo', null, null, r3((result.trasporti_secondaria || []).reduce((s, f) => s + (f.totale_tonnellate || 0), 0)), null, null, null, r2(result.totali.trasporti_secondaria)]);

  tipo = 'testa';
  if ((result.anomalie || []).length) {
    riga([]);
    riga(['ANOMALIE DA GUARDARE PRIMA DI PAGARE']);
    for (const a of result.anomalie) riga([a.descrizione, a.tonnellate ? r3(a.tonnellate) : null]);
  }
  return aoa;
}

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
  const nome = `Fatturazione_passiva_${result.tipologia}_${result.mese}_${result.anno}.xlsx`;
  XLSX.writeFile(wb, nome);
  return nome;
}
