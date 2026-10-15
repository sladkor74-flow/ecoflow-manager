// Utility per esportazione Excel, PDF e PPT del modulo Status & Target.
//
// LE STESSE PAROLE DELLA PAGINA (chiusura dell'audit, 11/10/2026). PDF e
// presentazione dicevano ancora «Leftover», «Leftover Complessivo Annuo», «Delta
// Mese In Corso», «Conferito RETE» e «Totale Conferito» mentre la pagina e
// l'Excel dicono «Residuo», «Scarto del mese sull'atteso» e «Primarie RETE
// ricevute»: la tabella degli impianti conta le sole primarie, e chiamarla
// «Conferito RETE» la confondeva con la colonna delle Giacenze che comprende
// anche le secondarie in arrivo. Lo scarto del mese e' quello delle card
// (raccolto meno atteso ai giorni coperti dai dati), non il vecchio delta di
// segno opposto. E un valore che manca - il target di un anno senza contratto,
// lo scarto senza dati - esce «—», mai 0,00 (tonnellate di src/lib/target.js,
// la stessa delle card). La data e l'anno sono quelli italiani, non del
// dispositivo.
import { base44 } from '@/api/base44Client';
import { tonnellate } from '@/lib/target';
import { oggiRoma } from '@/lib/giornoItaliano';
import { targetCopiatiDelleRighe, fraseTargetCopiati, segnoTargetCopiati } from '@/lib/andamentoTarget';

const ilGiorno = (g) => (g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : '');
// I TARGET COPIATI E NON CONFERMATI (prova generale del cambio d'anno, revisione
// del 15/10/2026). La pagina dice «copiato, da confermare» sulla riga e quanti
// sono sopra la tabella (TargetTable, ReportGenerale); PDF e presentazione
// dell'Andamento mostravano target annuo e residuo dei target copiati come
// decisi. Ora lo dicono con le stesse parole (fraseTargetCopiati e
// segnoTargetCopiati di andamentoTarget): copiati e' il conto dell'anno che la
// pagina passa (targetCopiatiDellAnno, lo stesso della frase della pagina);
// senza, si contano le righe.
const conSegnoCopiato = (r) => { const s = segnoTargetCopiati(r); return s ? `${r.raccoglitore} (${s})` : r.raccoglitore; };
const notaCopiati = (righe, copiati, anno) => fraseTargetCopiati(copiati && copiati.copiati !== undefined ? copiati : targetCopiatiDelleRighe(righe), anno);
const NOTA_IMPIANTI = "Primarie RETE ricevute dagli impianti: solo le primarie, per impianto di destinazione e mese di fine trasporto. Non è il «Conferito RETE» delle Giacenze, che conta anche le secondarie in arrivo.";

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
export async function exportPDF(kpis, mergedData, regioneData, impiantiData, anno, copiati = null) {
  const { esportaSezioniPdf } = await import('@/lib/esportaTabella');
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  await esportaSezioniPdf({
    nomeFile: `target-status-${anno || oggiRoma().slice(0, 4)}`,
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE',
    titolo: 'Target & Status · Andamento',
    sottotitolo: anno ? `Anno ${anno}` : '',
    // Una voce senza valore esce «—»: il PDF, che scrive i soli numeri, la
    // lasciava vuota (il target di un anno senza contratto).
    riepilogo: (kpis || []).map(k => {
      const valore = num(k.valore ?? k.value);
      return { etichetta: k.etichetta || k.label || '', valore: valore === null ? '—' : valore, tipo: k.tipo || 't' };
    }),
    sezioni: [
      {
        titolo: 'Target e raccolto per raccoglitore (RETE)',
        colonne: [
          { titolo: 'Regione', tipo: 'testo', peso: 1.2 },
          { titolo: 'Raccoglitore', tipo: 'testo', peso: 2 },
          { titolo: 'Target annuo', tipo: 't', peso: 1 },
          { titolo: 'Raccolto RETE', tipo: 't', peso: 1 },
          { titolo: 'Residuo', tipo: 't', peso: 1 },
        ],
        righe: (mergedData || []).map(r => ({
          celle: [r.regione, conSegnoCopiato(r), num(r.targetAnnuo), num(r.raccoltoTotale), num(r.leftover)],
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
        titolo: 'Primarie RETE ricevute dagli impianti',
        colonne: [
          { titolo: 'Impianto', tipo: 'testo', peso: 2 },
          { titolo: 'Primarie RETE ricevute', tipo: 't', peso: 1 },
        ],
        righe: (impiantiData || []).map(i => ({ celle: [i.impianto, num(i.totale)] })),
      },
    ],
    note: [
      notaCopiati(mergedData, copiati, anno),
      'Tutti i numeri sono del canale RETE: ACI ed extra raccolta sono canali a se, e non si sommano mai.',
      'Residuo: target annuo meno raccolto, quanto manca (negativo: target superato).',
      NOTA_IMPIANTI,
    ].filter(Boolean),
  });
}

// La presentazione dell'Andamento: le card della pagina e le tre tabelle, con le
// parole della pagina. kpis sono quelli delle card di TargetStatus.jsx
// (residuoAnno, scartoMese, giornoDati, fonteTarget, targetDaConfermare); per
// una pagina che passasse ancora i nomi di prima, il residuo si legge anche da
// leftoverTotale, che ha lo stesso segno. Lo scarto no: deltaMeseCorrente era
// target meno raccolto, di segno opposto, e si scrive «—» piuttosto che un
// numero col segno sbagliato. anno e' quello scelto nella pagina.
//
// LA LIBRERIA DELLE PRESENTAZIONI SI SCARICA QUANDO SI PREME «PPT» (14/10/2026).
// pptxgenjs, col suo jszip, pesa 385 kB, e importata in testa a questo file
// finiva nel pacchetto di Target & Status: chi apriva la pagina scaricava un
// pezzo di 595 kB, 385 per un pulsante che si preme di rado. Come
// xlsx, jspdf ed exceljs (AGENTS.md, «Le librerie pesanti si caricano quando
// servono»), si prende qui dentro; la funzione era gia' asincrona e il pulsante
// (ExportButtons) la aspetta. prove/pacchettiLeggeri.mjs lo controlla.
export async function exportPPT(kpis, mergedData, regioneData, impiantiData, anno, copiati = null) {
  const k = kpis || {};
  const { default: pptxgen } = await import('pptxgenjs');
  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'Wide', width: 13.33, height: 7.5 });
  pptx.layout = 'Wide';
  const oggi = oggiRoma();
  const residuo = k.residuoAnno !== undefined ? k.residuoAnno : k.leftoverTotale;
  const scarto = k.scartoMese === null || k.scartoMese === undefined ? null : k.scartoMese;
  const conSegno = (v) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${tonnellate(v)}`);
  // Lo scarto e' quello dei mesi scelti nel filtro: l'etichetta e' quella della
  // card (KpiCards), «Scarto di agosto sull'atteso» (revisione finale, 11/10/2026).
  const mesiScarto = (k.mesiScarto || []).join(', ').toLowerCase();
  const nomeScarto = `Scarto ${mesiScarto ? `di ${mesiScarto}` : 'del mese'}`;

  // Slide 1: titolo e indicatori, come le card della pagina
  const s1 = pptx.addSlide();
  s1.addText(`Target & Status · Andamento${anno ? ` ${anno}` : ''}`, { x: 0.5, y: 0.3, fontSize: 28, bold: true, color: '1A1A2E' });
  s1.addText(`Data: ${ilGiorno(oggi)}${k.giornoDati ? `  ·  dati fino al ${ilGiorno(k.giornoDati)}` : ''}`, { x: 0.5, y: 1, fontSize: 14, color: '666666' });
  const kpiRows = [
    [{ text: 'Indicatore (canale RETE)', options: { bold: true, fill: '36C5F0', color: 'FFFFFF' } }, { text: 'Valore [t]', options: { bold: true, fill: '36C5F0', color: 'FFFFFF' } }],
    ['Target annuo del contratto', tonnellate(k.targetAnnuoTotale)],
    ["Raccolto RETE nell'anno", tonnellate(k.raccoltoTotale)],
    ["Residuo dell'anno", tonnellate(residuo)],
    [`${nomeScarto} sull'atteso`, conSegno(scarto)],
  ];
  s1.addTable(kpiRows, { x: 0.5, y: 1.8, w: 6, fontSize: 12, border: { type: 'solid', pt: 1 } });
  const note = [
    k.targetAnnuoTotale === null || k.targetAnnuoTotale === undefined
      ? "Il contratto dell'anno non è inserito: il target non c'è."
      : k.targetDaConfermare ? "Il contratto è copiato dall'anno prima ed è da confermare."
        : k.fonteTarget === 'ripiego' ? 'Il contratto non ha il target annuo: è quello scritto nel gestionale come ripiego.' : '',
    'Residuo: target meno raccolto, quanto manca (negativo: target superato).',
    scarto === null
      ? `${nomeScarto}: l'atteso non si calcola, non c'è ancora nessun ritiro terminato con la fine trasporto.`
      : `${nomeScarto}: raccolto meno atteso, il target dei raccoglitori per i giorni coperti dai dati (positivo: avanti; negativo: indietro).`,
    'ACI ed extra raccolta sono canali a sé e non si sommano mai.',
  ].filter(Boolean);
  s1.addText(note.join('\n'), { x: 0.5, y: 4.4, w: 12, fontSize: 11, color: '666666' });

  // Slide 2: raccoglitori
  const s2 = pptx.addSlide();
  s2.addText('Target e raccolto per raccoglitore (RETE)', { x: 0.5, y: 0.3, fontSize: 24, bold: true, color: '1A1A2E' });
  const raccRows = [['Regione', 'Raccoglitore', 'Target annuo [t]', 'Raccolto RETE [t]', 'Residuo [t]']];
  for (const r of mergedData || []) {
    const segno = segnoTargetCopiati(r);
    raccRows.push([String(r.regione).substring(0, 15), String(r.raccoglitore).substring(0, 20) + (segno ? ` (${segno})` : ''), tonnellate(r.targetAnnuo), tonnellate(r.raccoltoTotale), tonnellate(r.leftover)]);
  }
  const fraseCopiati = notaCopiati(mergedData, copiati, anno);
  if (fraseCopiati) s2.addText(fraseCopiati, { x: 0.5, y: 0.8, w: 12, fontSize: 10, color: 'B45309' });
  s2.addTable(raccRows, { x: 0.5, y: fraseCopiati ? 1.2 : 1, w: 12, fontSize: 9, border: { type: 'solid', pt: 1 }, colW: [2, 4, 2, 2, 2] });

  // Slide 3: regioni
  const s3 = pptx.addSlide();
  s3.addText('Raccolto RETE per regione', { x: 0.5, y: 0.3, fontSize: 24, bold: true, color: '1A1A2E' });
  const regRows = [['Regione', 'Raccolto RETE [t]']];
  for (const r of regioneData || []) regRows.push([r.regione, tonnellate(r.totale)]);
  s3.addTable(regRows, { x: 0.5, y: 1, w: 6, fontSize: 11, border: { type: 'solid', pt: 1 } });

  // Slide 4: le primarie ricevute dagli impianti
  const s4 = pptx.addSlide();
  s4.addText('Primarie RETE ricevute dagli impianti', { x: 0.5, y: 0.3, fontSize: 24, bold: true, color: '1A1A2E' });
  s4.addText(NOTA_IMPIANTI, { x: 0.5, y: 0.9, w: 12, fontSize: 10, color: '666666' });
  const impRows = [['Impianto', 'Primarie RETE ricevute [t]']];
  for (const i of impiantiData || []) impRows.push([String(i.impianto).substring(0, 30), tonnellate(i.totale)]);
  s4.addTable(impRows, { x: 0.5, y: 1.5, w: 8, fontSize: 11, border: { type: 'solid', pt: 1 } });

  await pptx.writeFile({ fileName: `Target_Status_${anno ? `${anno}_` : ''}${oggi}.pptx` });
}
