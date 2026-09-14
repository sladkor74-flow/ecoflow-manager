// Lettura del foglio del contratto Ecotyre ("Target Piarulli" nel file di gestione):
// target per regione, ripartizione per classe, target mensile iniziale e rivisto,
// quantita' per destinazione, target con prezzo per regione e budget mensile rete
// e ACI. Le tabelle si trovano dalle loro intestazioni, non dalla posizione.

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const semplice = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%]/g, '');
const numero = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
};
const titolo = (s) => String(s || '').trim().toLowerCase().replace(/(^|[\s,/'-])\S/g, c => c.toUpperCase());

export function leggiTargetContratto(righe) {
  const cella = (r, c) => ((righe[r] || [])[c]);
  const vuota = (r, c) => { const v = cella(r, c); return v === null || v === undefined || String(v).trim() === ''; };
  const trova = (test) => {
    for (let r = 0; r < righe.length; r++) for (let c = 0; c < (righe[r] || []).length; c++) if (test(semplice(cella(r, c)))) return { r, c };
    return null;
  };
  const risultato = { regioni: [], classi: [], target_mensile_iniziale: [], target_mensile: [], destinazioni: [], target_prezzo_regioni: [], budget_rete: [], budget_aci: [], target_annuo_t: null, avvisi: [] };

  // Target per regione
  const hReg = trova(s => s.includes('targetannuo') && s.includes('qta'));
  if (hReg) {
    let r = hReg.r + 1;
    for (; r < righe.length && !vuota(r, hReg.c - 2); r++) {
      risultato.regioni.push({ regione: titolo(cella(r, hReg.c - 2)), province: String(cella(r, hReg.c - 1) ?? '').trim(), target_t: numero(cella(r, hReg.c)) });
    }
    risultato.target_annuo_t = numero(cella(r, hReg.c)) ?? risultato.regioni.reduce((s, x) => s + (x.target_t || 0), 0);
  } else risultato.avvisi.push('Tabella del target per regione non trovata.');

  // Ripartizione per classe
  const hCl = trova(s => s === '%raccolta');
  if (hCl) {
    for (let r = hCl.r + 1; r < righe.length && !vuota(r, hCl.c - 3); r++) {
      risultato.classi.push({ classe: String(cella(r, hCl.c - 3)).trim(), descrizione: String(cella(r, hCl.c - 2) ?? '').trim(), peso: String(cella(r, hCl.c - 1) ?? '').trim(), percentuale: numero(cella(r, hCl.c)) });
    }
  }

  // Target mensile iniziale e rivisto
  const hMese = trova(s => s === 'mese');
  if (hMese) {
    const intest = (righe[hMese.r] || []).map(semplice);
    const cOld = intest.findIndex(s => s === 'targetold');
    const cNew = intest.findIndex(s => s === 'targetnew');
    for (const m of MESI) {
      const r = righe.findIndex((riga, i) => i > hMese.r && semplice((riga || [])[hMese.c]) === semplice(m));
      risultato.target_mensile_iniziale.push(r >= 0 && cOld >= 0 ? numero(cella(r, cOld)) : null);
      risultato.target_mensile.push(r >= 0 && cNew >= 0 ? numero(cella(r, cNew)) : null);
    }
  }

  // Destinazioni del contratto
  const hDest = trova(s => s === 'destinazione');
  if (hDest) {
    for (let r = hDest.r + 1; r < righe.length && !vuota(r, hDest.c); r++) {
      risultato.destinazioni.push({ destinazione: String(cella(r, hDest.c)).trim(), target_t: numero(cella(r, hDest.c + 1)), trattamento: String(cella(r, hDest.c + 2) ?? '').trim() });
    }
  }

  // Target con prezzo per regione
  const hPrezzo = trova(s => s.startsWith('targetecotyre'));
  if (hPrezzo) {
    for (let r = hPrezzo.r + 1; r < righe.length && !vuota(r, hPrezzo.c - 1); r++) {
      risultato.target_prezzo_regioni.push({ regione: titolo(cella(r, hPrezzo.c - 1)), target_t: numero(cella(r, hPrezzo.c)), prezzo: numero(cella(r, hPrezzo.c + 1)) });
    }
  }

  // Budget mensile della commessa, rete e ACI
  for (let r = 0; r < righe.length; r++) {
    if (!/commessaecotyre/.test(semplice(cella(r, 0)))) continue;
    const colMese = MESI.map(m => (righe[r] || []).findIndex(v => semplice(v) === semplice(m)));
    const canale = semplice(cella(r + 1, 0));
    const rBudget = [r + 1, r + 2, r + 3].find(k => semplice(cella(k, 0)) === 'budget');
    if (rBudget === undefined) continue;
    const valori = colMese.map(c => (c >= 0 ? numero(cella(rBudget, c)) : null));
    if (canale === 'rete') risultato.budget_rete = valori;
    else if (canale === 'aci') risultato.budget_aci = valori;
  }

  if (!risultato.regioni.length && !risultato.target_mensile.length) throw new Error('Nel foglio non trovo le tabelle del contratto (target per regione e target mensile).');
  return risultato;
}

export async function leggiFileTargetContratto(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const nome = wb.SheetNames.find(n => /target\s*piarulli/i.test(n)) || wb.SheetNames.find(n => /contratt/i.test(n));
  if (!nome) throw new Error('Nel file non c\'è il foglio "Target Piarulli" con i dati del contratto.');
  const righe = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null, blankrows: true });
  return leggiTargetContratto(righe);
}
