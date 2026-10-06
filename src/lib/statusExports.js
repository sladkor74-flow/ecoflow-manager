// Utility per esportazione Excel, PDF e PPT del modulo Status & Target.
import pptxgen from 'pptxgenjs';
import { base44 } from '@/api/base44Client';
import { MESI } from './pfuConstants';
import { formatTonnellate } from '@/lib/utils';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function base64ToBlob(base64, mime) {
  const res = await fetch(`data:${mime};base64,${base64}`);
  return res.blob();
}

// L'anno e' quello scelto nella pagina: senza, il file sarebbe dell'anno in corso.
export async function exportExcel(anno) {
  const res = await base44.functions.invoke('exportStatusExcel', anno ? { anno: Number(anno) } : {});
  const blob = await base64ToBlob(res.data.file_base64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  downloadBlob(blob, res.data.filename);
}

// IL PDF DI TARGET & STATUS, CON LA MACCHINA COMUNE (06/10/2026).
//
// Era scritto a coordinate fisse: il blocco degli impianti partiva a y=71 e si
// fermava a `if (y > 200) break`, cioe' SCARTAVA IN SILENZIO gli impianti oltre
// il ventiseiesimo; e la tabella delle regioni, senza nessun controllo di fine
// pagina, finiva sopra il titolo degli impianti. Ora lo fa esportaSezioniPdf,
// che cambia pagina da sola, ripete le intestazioni a ogni pagina e numera i
// fogli, come gli altri PDF del gestionale.
//
// E le colonne dicono di quale canale sono: questi numeri sono di RETE (il
// raccolto arriva da computeRaccolto con canale rete), non del totale conferito.
export async function exportPDF(kpis, mergedData, regioneData, impiantiData, anno) {
  const { esportaSezioniPdf } = await import('@/lib/esportaTabella');
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  await esportaSezioniPdf({
    nomeFile: `target-status-${anno || new Date().getFullYear()}`,
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE',
    titolo: 'Target & Status · Andamento',
    sottotitolo: anno ? `Anno ${anno}` : '',
    riepilogo: (kpis || []).map(k => ({
      etichetta: k.etichetta || k.label || '',
      valore: num(k.valore ?? k.value),
      tipo: k.tipo || 't',
    })),
    sezioni: [
      {
        titolo: 'Target e raccolto per raccoglitore (RETE)',
        colonne: [
          { titolo: 'Regione', tipo: 'testo', peso: 1.2 },
          { titolo: 'Raccoglitore', tipo: 'testo', peso: 2 },
          { titolo: 'Target annuo', tipo: 't', peso: 1 },
          { titolo: 'Raccolto RETE', tipo: 't', peso: 1 },
          { titolo: 'Leftover', tipo: 't', peso: 1 },
        ],
        righe: (mergedData || []).map(r => ({
          celle: [r.regione, r.raccoglitore, num(r.targetAnnuo), num(r.raccoltoTotale), num(r.leftover)],
        })),
      },
      {
        titolo: 'Raccolto RETE per regione',
        colonne: [
          { titolo: 'Regione', tipo: 'testo', peso: 2 },
          { titolo: 'Raccolto RETE', tipo: 't', peso: 1 },
        ],
        righe: (regioneData || []).map(r => ({ celle: [r.regione, num(r.totale)] })),
      },
      {
        titolo: 'Progressivo e avanzamento impianti (RETE)',
        colonne: [
          { titolo: 'Impianto', tipo: 'testo', peso: 2 },
          { titolo: 'Conferito RETE', tipo: 't', peso: 1 },
        ],
        righe: (impiantiData || []).map(i => ({ celle: [i.impianto, num(i.totale)] })),
      },
    ],
    note: ['Tutti i numeri sono del canale RETE: ACI ed extra raccolta sono canali a se, e non si sommano mai.'],
  });
}

export async function exportPPT(kpis, mergedData, regioneData, impiantiData) {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'Wide', width: 13.33, height: 7.5 });
  pptx.layout = 'Wide';
  const dateStr = new Date().toLocaleDateString('it-IT');

  // Slide 1: Titolo + KPI
  const s1 = pptx.addSlide();
  s1.addText('Status & Target Management - PFU Ecotyre', { x: 0.5, y: 0.3, fontSize: 28, bold: true, color: '1A1A2E' });
  s1.addText(`Data: ${dateStr}`, { x: 0.5, y: 1, fontSize: 14, color: '666666' });
  const kpiRows = [
    [{ text: 'KPI', options: { bold: true, fill: '36C5F0', color: 'FFFFFF' } }, { text: 'Valore [t]', options: { bold: true, fill: '36C5F0', color: 'FFFFFF' } }],
    ['Target Annuo Complessivo', formatTonnellate(kpis.targetAnnuoTotale)],
    ['Totale Progressivo Raccolto', formatTonnellate(kpis.raccoltoTotale)],
    ['Leftover Complessivo Annuo', formatTonnellate(kpis.leftoverTotale)],
    ['Delta Mese In Corso', formatTonnellate(kpis.deltaMeseCorrente)],
  ];
  s1.addTable(kpiRows, { x: 0.5, y: 1.8, w: 6, fontSize: 12, border: { type: 'solid', pt: 1 } });

  // Slide 2: Raccoglitori
  const s2 = pptx.addSlide();
  s2.addText('Target & Performance Raccoglitori', { x: 0.5, y: 0.3, fontSize: 24, bold: true, color: '1A1A2E' });
  const raccRows = [['Regione', 'Raccoglitore', 'T.Annuo', 'Raccolto', 'Leftover']];
  for (const r of mergedData) {
    raccRows.push([String(r.regione).substring(0, 15), String(r.raccoglitore).substring(0, 20), formatTonnellate(r.targetAnnuo), formatTonnellate(r.raccoltoTotale), formatTonnellate(r.leftover)]);
  }
  s2.addTable(raccRows, { x: 0.5, y: 1, w: 12, fontSize: 9, border: { type: 'solid', pt: 1 }, colW: [2, 4, 2, 2, 2] });

  // Slide 3: Regioni
  const s3 = pptx.addSlide();
  s3.addText('Target e Scostamento per Regione', { x: 0.5, y: 0.3, fontSize: 24, bold: true, color: '1A1A2E' });
  const regRows = [['Regione', 'Raccolto Totale [t]']];
  for (const r of regioneData) regRows.push([r.regione, formatTonnellate(r.totale)]);
  s3.addTable(regRows, { x: 0.5, y: 1, w: 6, fontSize: 11, border: { type: 'solid', pt: 1 } });

  // Slide 4: Impianti
  const s4 = pptx.addSlide();
  s4.addText('Progressivo e Avanzamento Impianti', { x: 0.5, y: 0.3, fontSize: 24, bold: true, color: '1A1A2E' });
  const impRows = [['Impianto', 'Totale Conferito [t]']];
  for (const i of impiantiData) impRows.push([String(i.impianto).substring(0, 30), formatTonnellate(i.totale)]);
  s4.addTable(impRows, { x: 0.5, y: 1, w: 8, fontSize: 11, border: { type: 'solid', pt: 1 } });

  await pptx.writeFile({ fileName: `Status_Target_${new Date().toISOString().slice(0, 10)}.pptx` });
}