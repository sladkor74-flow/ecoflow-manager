// Formato dei pesi nei fogli Excel esportati (SheetJS): le colonne in tonnellate
// mostrano due decimali, tre se i kg non sono tondi; quelle in kg sono intere.
// Le colonne si riconoscono dall'intestazione, cercata nelle prime righe.

const TONNELLATE = /\(t\)|\(ton\)|tonnellat|\bton\b|_t$/;
const CHILOGRAMMI = /\(kg\)|\bkg\b|peso_effettivo|peso_stimato|peso effettivo|peso stimato/;

export function formattaPesi(XLSX, ws) {
  if (!ws || !ws['!ref']) return ws;
  const r = XLSX.utils.decode_range(ws['!ref']);
  const formati = new Map();
  for (let R = r.s.r; R <= Math.min(r.e.r, r.s.r + 4) && !formati.size; R++) {
    for (let C = r.s.c; C <= r.e.c; C++) {
      const c = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (!c || typeof c.v !== 'string') continue;
      const h = c.v.toLowerCase().trim();
      if (h === 't' || TONNELLATE.test(h)) formati.set(C, { z: '#,##0.00#', da: R + 1 });
      else if (CHILOGRAMMI.test(h)) formati.set(C, { z: '#,##0', da: R + 1 });
    }
  }
  for (const [C, { z, da }] of formati) {
    for (let R = da; R <= r.e.r; R++) {
      const c = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (c && c.t === 'n') c.z = z;
    }
  }
  return ws;
}
