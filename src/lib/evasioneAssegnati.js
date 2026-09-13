// Lettura nel browser delle liste di assegnati inviate ai raccoglitori.
// Il file non viene caricato da nessuna parte: al backend arrivano le celle e,
// per ogni riga, l'indicazione se e' evidenziata.

export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export const STATI_RICHIESTA = {
  evasa: { etichetta: 'Evasa', classe: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  evasa_da_altri: { etichetta: 'Evasa da altri', classe: 'bg-sky-100 text-sky-800 border-sky-200' },
  aperta: { etichetta: 'Aperta', classe: 'bg-muted text-foreground border-border' },
  riassegnata: { etichetta: 'Riassegnata', classe: 'bg-violet-100 text-violet-800 border-violet-200' },
  non_piu_presente: { etichetta: 'Non più presente', classe: 'bg-orange-100 text-orange-800 border-orange-200' },
  evasa_prima: { etichetta: 'Evasa prima del mese', classe: 'bg-muted text-muted-foreground border-border' },
};

export const GRAVITA = {
  alta: { etichetta: 'Alta', classe: 'bg-red-100 text-red-800 border-red-200', punto: 'bg-red-500' },
  media: { etichetta: 'Media', classe: 'bg-amber-100 text-amber-800 border-amber-200', punto: 'bg-amber-500' },
  info: { etichetta: 'Info', classe: 'bg-sky-100 text-sky-800 border-sky-200', punto: 'bg-sky-500' },
};

export function tonnellate(kg) {
  if (kg === null || kg === undefined) return '—';
  return ((Number(kg) || 0) / 1000).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function dataIt(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
}

export function dataOraIt(d) {
  return d ? new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
}

// Giallo o arancio, anche chiari; esclusi grigi, azzurri e bianco.
function eGiallo(argb) {
  if (!argb || String(argb).length < 8) return false;
  const s = String(argb);
  const r = parseInt(s.slice(2, 4), 16), g = parseInt(s.slice(4, 6), 16), b = parseInt(s.slice(6, 8), 16);
  return r >= 230 && g >= 150 && b <= 210 && r - b >= 45;
}

function valoreCella(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map(t => t.text).join('');
    if (v.result !== undefined) return v.result instanceof Date ? v.result.toISOString().slice(0, 10) : v.result;
    if (v.text !== undefined) return v.text;
    return null;
  }
  return v;
}

async function fogliDaXlsx(file) {
  const modulo = await import('exceljs');
  const ExcelJS = modulo.default || modulo;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  return wb.worksheets.map(ws => {
    const righe = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      const c = [];
      let giallo = false;
      const colonne = Math.min(ws.columnCount, 60);
      for (let j = 1; j <= colonne; j++) {
        const cella = row.getCell(j);
        c.push(valoreCella(cella.value));
        const f = cella.fill;
        if (f && f.type === 'pattern' && f.pattern !== 'none' && f.fgColor && eGiallo(f.fgColor.argb)) giallo = true;
      }
      righe.push({ r: n, c, giallo });
    });
    return { file: file.name, nome: ws.name, righe: righe.slice(0, 3000) };
  });
}

// I formati diversi da xlsx si leggono senza colori: la priorita' vale solo se
// scritta nella riga.
async function fogliSenzaColori(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  return wb.SheetNames.map(nome => {
    const ws = wb.Sheets[nome];
    const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { s: { r: 0 } };
    const righe = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false, defval: null })
      .map((c, i) => ({ r: range.s.r + i + 1, c: c.map(valoreCella), giallo: false }));
    return { file: file.name, nome, righe: righe.slice(0, 3000) };
  });
}

export async function leggiFogliLista(files) {
  const fogli = [];
  let senzaColori = false;
  for (const file of files) {
    if (/\.xlsx$|\.xlsm$/i.test(file.name)) {
      fogli.push(...await fogliDaXlsx(file));
    } else {
      senzaColori = true;
      fogli.push(...await fogliSenzaColori(file));
    }
  }
  return { fogli, senzaColori };
}
