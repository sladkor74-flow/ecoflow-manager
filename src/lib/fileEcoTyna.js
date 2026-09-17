// File di EcoTyna: lettura degli allegati e creazione dei file richiesti.
//
// Excel, CSV, Word (.docx) e testo si leggono sul computer di chi li allega e non
// occupano spazio sul dominio. PDF e immagini vanno caricati in un'area privata,
// perche' solo il modello li sa leggere. I file preparati da EcoTyna si generano nel
// browser quando si preme "Scarica": nel gestionale ne resta solo la descrizione.

import { jsPDF } from 'jspdf';

const MB = 1024 * 1024;
export const MAX_ALLEGATI = 3;
export const LIMITE_LETTURA = 15 * MB;
export const LIMITE_CARICAMENTO = 10 * MB;
const MAX_TESTO = 40000;

const TABELLE = ['xlsx', 'xlsm', 'xls', 'ods', 'csv'];
const TESTI = ['txt', 'md', 'json', 'xml', 'html', 'htm', 'eml'];
const DA_CARICARE = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
export const ACCETTATI = [...TABELLE, 'docx', ...TESTI, ...DA_CARICARE].map(e => `.${e}`).join(',');

const estensione = (nome) => String(nome || '').toLowerCase().split('.').pop();
const xlsx = () => import('xlsx');

// === Lettura ===

const taglia = (s, max) => (s.length > max ? { testo: s.slice(0, max), tagliato: true } : { testo: s, tagliato: false });

function testoCella(XLSX, c) {
  if (!c || c.v === undefined || c.v === null) return '';
  if (c.w !== undefined) return String(c.w);
  if (c.t === 'n' && c.z && XLSX.SSF.is_date(c.z)) return XLSX.SSF.format('dd/mm/yyyy', c.v);
  return String(c.v);
}

/** Celle di un foglio come righe di oggetti { v, t, z, w }, senza formule. */
function righeDelFoglio(XLSX, ws) {
  if (!ws || !ws['!ref']) return [];
  const r = XLSX.utils.decode_range(ws['!ref']);
  const righe = [];
  for (let R = r.s.r; R <= r.e.r; R++) {
    const riga = [];
    let piena = false;
    for (let C = r.s.c; C <= r.e.c; C++) {
      const c = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (c && c.v !== undefined && c.v !== '') piena = true;
      riga.push(c ? { v: c.v, t: c.t, z: c.z, w: c.w } : null);
    }
    if (piena) righe.push(riga);
  }
  return righe;
}

/** Totali, minimi e massimi delle colonne numeriche: servono a rispondere anche sui file troppo lunghi da mandare interi. */
function riepilogoColonne(XLSX, righe) {
  if (righe.length < 2) return '';
  const intest = righe[0].map(c => testoCella(XLSX, c));
  const parti = [];
  intest.forEach((nome, i) => {
    const valori = righe.slice(1).map(r => r[i]).filter(c => c && c.t === 'n' && !(c.z && XLSX.SSF.is_date(c.z))).map(c => Number(c.v));
    if (!nome || valori.length < Math.max(1, (righe.length - 1) / 2)) return;
    const somma = valori.reduce((a, b) => a + b, 0);
    parti.push(`${nome}: somma ${Math.round(somma * 1000) / 1000}, min ${Math.min(...valori)}, max ${Math.max(...valori)} (${valori.length} valori)`);
  });
  return parti.length ? `Riepilogo delle colonne numeriche su tutte le righe: ${parti.join('; ')}` : '';
}

async function leggiDocx(file) {
  const XLSX = await xlsx();
  const zip = XLSX.CFB.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
  const i = zip.FullPaths.findIndex(p => /(^|\/)word\/document\.xml$/i.test(p));
  if (i < 0) throw new Error(`${file.name}: non riesco a leggere il documento Word`);
  const xml = new TextDecoder('utf-8').decode(zip.FileIndex[i].content);
  return xml
    .replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Legge un file allegato. Restituisce { nome, dimensione, tipo, testo, tagliato,
 * fogli? , daCaricare? }: i fogli restano nel browser per le modifiche, il testo va a EcoTyna.
 */
export async function leggiAllegato(file) {
  const ext = estensione(file.name);
  const base = { nome: file.name, dimensione: file.size };
  if (DA_CARICARE.includes(ext)) {
    if (file.size > LIMITE_CARICAMENTO) throw new Error(`${file.name}: PDF e immagini possono pesare al massimo 10 MB`);
    return { ...base, tipo: ext === 'pdf' ? 'pdf' : 'immagine', testo: '', tagliato: false, daCaricare: true };
  }
  if (file.size > LIMITE_LETTURA) throw new Error(`${file.name}: il file pesa più di 15 MB`);
  if (TABELLE.includes(ext)) {
    const XLSX = await xlsx();
    const dati = ext === 'csv' ? await file.text() : await file.arrayBuffer();
    const wb = XLSX.read(dati, { type: ext === 'csv' ? 'string' : 'array', cellFormula: false, cellHTML: false, cellNF: true });
    const fogli = wb.SheetNames.map(nome => ({ nome, righe: righeDelFoglio(XLSX, wb.Sheets[nome]) })).filter(f => f.righe.length);
    const perFoglio = Math.floor(MAX_TESTO / Math.max(1, fogli.length));
    let tagliato = false;
    const testo = fogli.map(f => {
      const csv = f.righe.map(r => r.map(c => testoCella(XLSX, c).replace(/[\r\n;]+/g, ' ')).join(';')).join('\n');
      const t = taglia(csv, perFoglio);
      if (t.tagliato) tagliato = true;
      const mostrate = t.testo.split('\n').length;
      return [
        `### Foglio "${f.nome}": ${f.righe.length} righe, ${f.righe[0].length} colonne (la prima riga e' l'intestazione)`,
        t.testo,
        t.tagliato ? `[... mostrate ${mostrate} righe su ${f.righe.length}: per calcoli su tutto il foglio usa il riepilogo o le operazioni]` : '',
        riepilogoColonne(XLSX, f.righe),
      ].filter(Boolean).join('\n');
    }).join('\n\n');
    return { ...base, tipo: 'tabella', testo, tagliato, fogli };
  }
  if (ext === 'docx') {
    const t = taglia(await leggiDocx(file), MAX_TESTO);
    return { ...base, tipo: 'documento', ...t };
  }
  if (TESTI.includes(ext)) {
    const t = taglia(await file.text(), MAX_TESTO);
    return { ...base, tipo: 'testo', ...t };
  }
  throw new Error(`${file.name}: formato non supportato. Si possono allegare Excel, CSV, Word (.docx), PDF, immagini e file di testo.`);
}

// === Operazioni sulle tabelle allegate ===

const norm = (s) => String(s ?? '').trim().toLowerCase();

function indiceColonna(intestazioni, nome) {
  const n = norm(nome);
  let i = intestazioni.findIndex(h => norm(h) === n);
  if (i < 0) i = intestazioni.findIndex(h => norm(h).includes(n) && n.length >= 3);
  if (i < 0 && /^[a-z]{1,2}$/i.test(String(nome || '').trim())) {
    const lettere = String(nome).trim().toUpperCase();
    i = [...lettere].reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
    if (i >= intestazioni.length) i = -1;
  }
  if (i < 0) throw new Error(`Colonna "${nome}" non trovata. Colonne del foglio: ${intestazioni.filter(Boolean).join(', ')}`);
  return i;
}

const numero = (v) => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim();
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s) || /^-?\d+,\d+$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
  return NaN;
};

/** Applica le operazioni chieste a EcoTyna a una tabella { intestazioni, righe } di celle. */
export function applicaOperazioni(XLSX, tabella, operazioni) {
  let intest = [...tabella.intestazioni];
  let righe = tabella.righe.map(r => [...r]);
  const valore = (c) => (c ? c.v : '');
  const cellaData = (c) => c && c.t === 'n' && c.z && XLSX.SSF.is_date(c.z);
  const ymd = (c) => { const d = XLSX.SSF.parse_date_code(c.v); return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`; };
  const confronta = (c, op, atteso) => {
    const v = cellaData(c) ? ymd(c) : valore(c);
    const nv = numero(v);
    const na = numero(atteso);
    const numeri = !Number.isNaN(nv) && !Number.isNaN(na);
    const a = numeri ? nv : norm(v);
    const b = numeri ? na : norm(atteso);
    switch (op) {
      case 'uguale': return a === b;
      case 'diverso': return a !== b;
      case 'contiene': return norm(v).includes(norm(atteso));
      case 'non_contiene': return !norm(v).includes(norm(atteso));
      case 'maggiore': return a > b;
      case 'minore': return a < b;
      case 'maggiore_uguale': return a >= b;
      case 'minore_uguale': return a <= b;
      case 'vuoto': return String(v ?? '').trim() === '';
      case 'non_vuoto': return String(v ?? '').trim() !== '';
      default: throw new Error(`Operatore "${op}" non previsto`);
    }
  };
  const cellaNumero = (n, z) => ({ v: n, t: 'n', z });

  for (const op of operazioni || []) {
    switch (op.tipo) {
      case 'filtra': {
        const i = indiceColonna(intest, op.colonna);
        righe = righe.filter(r => confronta(r[i], op.operatore || 'uguale', op.valore));
        break;
      }
      case 'ordina': {
        const i = indiceColonna(intest, op.colonna);
        const segno = op.direzione === 'decrescente' ? -1 : 1;
        righe.sort((x, y) => {
          const a = valore(x[i]); const b = valore(y[i]);
          const na = numero(a); const nb = numero(b);
          if (!Number.isNaN(na) && !Number.isNaN(nb)) return (na - nb) * segno;
          return String(a ?? '').localeCompare(String(b ?? ''), 'it') * segno;
        });
        break;
      }
      case 'rinomina_colonna':
        intest[indiceColonna(intest, op.colonna)] = op.nuovo_nome || op.colonna;
        break;
      case 'elimina_colonne':
      case 'tieni_colonne': {
        const scelte = (op.colonne || []).map(n => indiceColonna(intest, n));
        const tenute = op.tipo === 'tieni_colonne' ? scelte : intest.map((_, i) => i).filter(i => !scelte.includes(i));
        intest = tenute.map(i => intest[i]);
        righe = righe.map(r => tenute.map(i => r[i]));
        break;
      }
      case 'sostituisci': {
        const colonne = op.colonna ? [indiceColonna(intest, op.colonna)] : intest.map((_, i) => i);
        righe = righe.map(r => r.map((c, i) => {
          if (!colonne.includes(i) || !c || typeof c.v !== 'string') return c;
          return norm(c.v) === norm(op.da) ? { v: op.a ?? '', t: 's' } : c.v.includes(op.da) ? { v: c.v.split(op.da).join(op.a ?? ''), t: 's' } : c;
        }));
        break;
      }
      case 'imposta_valore': {
        const i = indiceColonna(intest, op.colonna);
        const n = numero(op.valore);
        righe = righe.map(r => { const x = [...r]; x[i] = Number.isNaN(n) ? { v: op.valore ?? '', t: 's' } : cellaNumero(n); return x; });
        break;
      }
      case 'aggiungi_colonna': {
        const i = op.colonna ? indiceColonna(intest, op.colonna) : -1;
        const j = op.colonna2 ? indiceColonna(intest, op.colonna2) : -1;
        const k = numero(op.valore);
        intest.push(op.nuovo_nome || 'Nuova colonna');
        righe = righe.map(r => {
          const a = i >= 0 ? numero(valore(r[i])) : NaN;
          const b = j >= 0 ? numero(valore(r[j])) : k;
          let v;
          switch (op.operazione) {
            case 'somma': v = a + b; break;
            case 'differenza': v = a - b; break;
            case 'prodotto': v = a * b; break;
            case 'rapporto': v = b ? a / b : NaN; break;
            case 'kg_in_t': v = a / 1000; break;
            case 't_in_kg': v = Math.round(a * 1000); break;
            case 'copia': return [...r, r[i] || null];
            default: return [...r, { v: op.valore ?? '', t: 's' }];
          }
          return [...r, Number.isNaN(v) ? null : cellaNumero(Math.round(v * 1000000) / 1000000)];
        });
        break;
      }
      case 'raggruppa': {
        const per = (op.per || []).map(n => indiceColonna(intest, n));
        const somme = (op.somma || []).map(n => indiceColonna(intest, n));
        const gruppi = new Map();
        for (const r of righe) {
          const chiave = JSON.stringify(per.map(i => (r[i] ? r[i].v : '')));
          if (!gruppi.has(chiave)) gruppi.set(chiave, { celle: per.map(i => r[i]), n: 0, somme: somme.map(() => 0) });
          const g = gruppi.get(chiave);
          g.n++;
          somme.forEach((i, x) => { const v = numero(valore(r[i])); if (!Number.isNaN(v)) g.somme[x] += v; });
        }
        const nomiSomme = somme.map(i => intest[i]);
        intest = [...per.map(i => intest[i]), 'Numero righe', ...nomiSomme];
        righe = [...gruppi.values()].map(g => [...g.celle, cellaNumero(g.n), ...g.somme.map(s => cellaNumero(Math.round(s * 1000) / 1000))]);
        break;
      }
      case 'totale': {
        const colonne = (op.colonne || []).map(n => indiceColonna(intest, n));
        const riga = intest.map((_, i) => (i === 0 ? { v: 'Totale', t: 's' } : null));
        colonne.forEach(i => {
          const s = righe.reduce((acc, r) => { const v = numero(valore(r[i])); return Number.isNaN(v) ? acc : acc + v; }, 0);
          riga[i] = cellaNumero(Math.round(s * 1000) / 1000);
        });
        righe = [...righe, riga];
        break;
      }
      default:
        throw new Error(`Operazione "${op.tipo}" non prevista`);
    }
  }
  return { intestazioni: intest, righe };
}

// === Creazione dei file ===

const FORMATI = { xlsx: 'xlsx', csv: 'csv', docx: 'doc', pdf: 'pdf', txt: 'txt' };

export function nomeFile(spec) {
  const formato = FORMATI[spec.formato] ? spec.formato : 'txt';
  const base = String(spec.nome || 'EcoTyna').replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 100) || 'EcoTyna';
  return `${base}.${FORMATI[formato]}`;
}

// Numeri scritti come testo: "1234.5" o "1.234,5". Codici con zeri davanti, partite IVA
// e numeri lunghi restano testo.
function cellaDaTesto(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return { v, t: 'n' };
  const s = String(v);
  if (/^0\d/.test(s.trim()) || /^\d{11,}$/.test(s.trim())) return { v: s, t: 's' };
  const n = numero(s);
  return Number.isNaN(n) || s.trim() === '' ? { v: s, t: 's' } : { v: n, t: 'n' };
}

// Pesi: tonnellate con due decimali (tre se i kg non sono tondi), kg interi.
function formatoPeso(intestazione, valore) {
  const h = norm(intestazione);
  if (/\bkg\b|chilogramm/.test(h)) return '#,##0';
  if (/\(t\)|\btonn|\bton\b|\bt\b/.test(h)) return Math.round(valore * 1000) % 10 !== 0 ? '#,##0.000' : '#,##0.00';
  return undefined;
}

function foglioDaTabella(XLSX, intestazioni, righe) {
  const ws = {};
  const tutte = [intestazioni.map(h => ({ v: String(h ?? ''), t: 's' })), ...righe];
  let maxC = 0;
  tutte.forEach((riga, R) => {
    riga.forEach((c, C) => {
      if (!c || c.v === undefined || c.v === null || c.v === '') return;
      const cella = { v: c.v, t: c.t || (typeof c.v === 'number' ? 'n' : 's') };
      if (c.z && c.z !== 'General') cella.z = c.z;
      // Pesi: si applica il formato del gestionale se la cella non ne ha uno suo (date comprese).
      if (R > 0 && cella.t === 'n' && !(cella.z && XLSX.SSF.is_date(cella.z))) { const z = formatoPeso(intestazioni[C], cella.v); if (z) cella.z = z; }
      ws[XLSX.utils.encode_cell({ r: R, c: C })] = cella;
      maxC = Math.max(maxC, C);
    });
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, tutte.length - 1), c: maxC } });
  ws['!cols'] = intestazioni.map(h => ({ wch: Math.min(40, Math.max(10, String(h ?? '').length + 2)) }));
  return ws;
}

/** Fogli del file da creare: scritti da EcoTyna oppure ricavati da un allegato con le operazioni. */
function fogliDelFile(XLSX, spec, allegati) {
  if (spec.da_allegato) {
    const allegato = allegati[spec.da_allegato];
    if (!allegato || !allegato.fogli) throw new Error(`Per preparare questo file allega di nuovo «${spec.da_allegato}»: i dati del file restano solo sul computer finché la pagina è aperta.`);
    return allegato.fogli.map(f => {
      const scelto = spec.foglio ? norm(f.nome) === norm(spec.foglio) : f === allegato.fogli[0];
      const riga0 = Math.max(0, (Number(spec.riga_intestazione) || 1) - 1);
      const intestazioni = (f.righe[riga0] || []).map(c => (c ? String(c.w ?? c.v) : ''));
      const tabella = { intestazioni, righe: f.righe.slice(riga0 + 1) };
      return { nome: f.nome, ...(scelto ? applicaOperazioni(XLSX, tabella, spec.operazioni) : tabella), scelto };
    }).filter(f => f.scelto || spec.mantieni_altri_fogli);
  }
  return (spec.fogli || []).map((f, i) => ({
    nome: f.nome || `Foglio${i + 1}`,
    intestazioni: f.intestazioni || [],
    righe: (f.righe || []).map(r => (Array.isArray(r) ? r : [r]).map(cellaDaTesto)),
  }));
}

function scarica(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Markdown semplice: titoli, elenchi, grassetto, tabelle con |.
const senzaMarcatori = (s) => String(s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/(^|\s)\*(\S.*?)\*/g, '$1$2');
const html = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inlineHtml = (s) => html(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\s)\*(\S.*?)\*/g, '$1<i>$2</i>');
const rigaTabella = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
const separatore = (l) => /^\s*\|?\s*:?-{3,}/.test(l);

function blocchiMarkdown(testo) {
  const righe = String(testo || '').replace(/\r/g, '').split('\n');
  const blocchi = [];
  for (let i = 0; i < righe.length; i++) {
    const l = righe[i];
    if (/^\s*\|.*\|\s*$/.test(l)) {
      const tabella = [];
      while (i < righe.length && /^\s*\|.*\|\s*$/.test(righe[i])) { if (!separatore(righe[i])) tabella.push(rigaTabella(righe[i])); i++; }
      i--;
      blocchi.push({ tipo: 'tabella', righe: tabella });
    } else if (/^#{1,3}\s/.test(l)) {
      blocchi.push({ tipo: 'titolo', livello: l.match(/^#+/)[0].length, testo: l.replace(/^#+\s*/, '') });
    } else if (/^\s*[-*•]\s+/.test(l)) {
      blocchi.push({ tipo: 'punto', testo: l.replace(/^\s*[-*•]\s+/, '') });
    } else if (/^\s*\d+[.)]\s+/.test(l)) {
      blocchi.push({ tipo: 'numerato', testo: l.trim() });
    } else {
      blocchi.push({ tipo: l.trim() ? 'testo' : 'vuoto', testo: l });
    }
  }
  return blocchi;
}

function documentoWord(titolo, testo) {
  const corpo = blocchiMarkdown(testo).map(b => {
    switch (b.tipo) {
      case 'titolo': return `<h${b.livello}>${inlineHtml(b.testo)}</h${b.livello}>`;
      case 'punto': return `<ul><li>${inlineHtml(b.testo)}</li></ul>`;
      case 'numerato': return `<p style="margin-left:18pt">${inlineHtml(b.testo)}</p>`;
      case 'tabella': return `<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse">${b.righe.map((r, i) => `<tr>${r.map(c => (i === 0 ? `<th>${inlineHtml(c)}</th>` : `<td>${inlineHtml(c)}</td>`)).join('')}</tr>`).join('')}</table>`;
      case 'vuoto': return '';
      default: return `<p>${inlineHtml(b.testo)}</p>`;
    }
  }).join('\n');
  return `﻿<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${html(titolo)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt} h1{font-size:16pt} h2{font-size:13pt} h3{font-size:12pt} th{background:#eee}</style></head><body>${corpo}</body></html>`;
}

function documentoPdf(testo) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margine = 15;
  const larghezza = 210 - margine * 2;
  let y = margine;
  const spazio = (h) => { if (y + h > 297 - margine) { doc.addPage(); y = margine; } };
  const scrivi = (t, { dimensione = 10, grassetto = false, rientro = 0 } = {}) => {
    doc.setFont('helvetica', grassetto ? 'bold' : 'normal');
    doc.setFontSize(dimensione);
    const righe = doc.splitTextToSize(senzaMarcatori(t), larghezza - rientro);
    const h = dimensione * 0.42;
    for (const r of righe) { spazio(h); doc.text(r, margine + rientro, y); y += h; }
  };
  for (const b of blocchiMarkdown(testo)) {
    if (b.tipo === 'titolo') { y += 2; scrivi(b.testo, { dimensione: b.livello === 1 ? 15 : b.livello === 2 ? 12.5 : 11, grassetto: true }); y += 1; }
    else if (b.tipo === 'punto') scrivi(`• ${b.testo}`, { rientro: 3 });
    else if (b.tipo === 'numerato') scrivi(b.testo, { rientro: 3 });
    else if (b.tipo === 'vuoto') y += 2.5;
    else if (b.tipo === 'tabella') {
      const colonne = Math.max(...b.righe.map(r => r.length));
      const w = larghezza / colonne;
      doc.setFontSize(8.5);
      b.righe.forEach((r, i) => {
        doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
        const celle = r.map(c => doc.splitTextToSize(senzaMarcatori(c), w - 2));
        const h = Math.max(...celle.map(c => c.length)) * 3.6 + 1.5;
        spazio(h);
        celle.forEach((c, j) => { doc.rect(margine + j * w, y - 3.2, w, h); doc.text(c, margine + j * w + 1, y); });
        y += h;
      });
      y += 2;
    } else scrivi(b.testo);
  }
  return doc;
}

/** Prepara e scarica il file descritto da EcoTyna. `allegati` = { nomeFile: allegato letto }. */
export async function scaricaFileEcoTyna(spec, allegati = {}) {
  const nome = nomeFile(spec);
  const formato = FORMATI[spec.formato] ? spec.formato : 'txt';
  if (formato === 'xlsx' || formato === 'csv') {
    const XLSX = await xlsx();
    const fogli = fogliDelFile(XLSX, spec, allegati);
    if (!fogli.length) throw new Error('Il file non contiene dati');
    if (formato === 'csv') {
      // CSV per Excel in italiano: separatore ";", virgola per i decimali, niente
      // separatore delle migliaia (altrimenti 8,130 kg diventerebbe 8,13).
      const f = fogli.find(x => x.scelto) || fogli[0];
      const campo = (c) => {
        if (!c || c.v === undefined || c.v === null) return '';
        let s;
        if (c.t === 'n' && c.z && XLSX.SSF.is_date(c.z)) s = XLSX.SSF.format('dd/mm/yyyy', c.v);
        else if (typeof c.v === 'number') s = String(c.v).replace('.', ',');
        else s = String(c.v);
        return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const righe = [f.intestazioni.map(h => campo({ v: h })), ...f.righe.map(r => r.map(campo))];
      scarica(new Blob(['﻿' + righe.map(r => r.join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), nome);
      return;
    }
    const wb = XLSX.utils.book_new();
    const usati = new Set();
    fogli.forEach((f, i) => {
      let n = String(f.nome || `Foglio${i + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Foglio${i + 1}`;
      while (usati.has(n)) n = `${n.slice(0, 28)} ${i + 1}`;
      usati.add(n);
      XLSX.utils.book_append_sheet(wb, foglioDaTabella(XLSX, f.intestazioni, f.righe), n);
    });
    const dati = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    scarica(new Blob([dati], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nome);
    return;
  }
  const testo = spec.testo || '';
  if (formato === 'docx') { scarica(new Blob([documentoWord(nome, testo)], { type: 'application/msword' }), nome); return; }
  if (formato === 'pdf') { documentoPdf(testo).save(nome); return; }
  scarica(new Blob(['﻿' + testo], { type: 'text/plain;charset=utf-8' }), nome);
}

export const ETICHETTE_FORMATO = { xlsx: 'Excel', csv: 'CSV', docx: 'Word', pdf: 'PDF', txt: 'Testo' };
