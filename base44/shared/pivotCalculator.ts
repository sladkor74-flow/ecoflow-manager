// Modulo condiviso per il calcolo delle pivot analitiche PFU.
// Le pivot attingono dai campi arricchiti memorizzati (mese, settimane, anno, classe, regione)
// calcolati al momento dell'importazione. Fallback on-the-fly per record non arricchiti.
import { PROV_TO_REGION, MESI } from "./raccoltoCalculator.ts";
import { getMeseFromDate, getSettimanaFromDate, getAnnoFromDate, getRegioneFromProvincia, getClasseFromProdotto } from "./dataEnrichment.ts";

function getMese(dateStr) {
  return getMeseFromDate(dateStr);
}

function getSettimana(dateStr) {
  return getSettimanaFromDate(dateStr);
}

function getAnno(dateStr) {
  return getAnnoFromDate(dateStr);
}

// Usa il campo arricchito memorizzato; fallback al calcolo on-the-fly dalla provincia.
function getRegione(r) {
  if (r.regione && String(r.regione).trim()) return String(r.regione).trim();
  return getRegioneFromProvincia(r.provincia) || 'Altro';
}

// Usa il campo arricchito memorizzato; fallback al calcolo on-the-fly dal prodotto.
function getClasse(r) {
  if (r.classe && String(r.classe).trim()) return String(r.classe).trim();
  return getClasseFromProdotto(r.prodotto) || 'N/D';
}

// Usa il campo arricchito memorizzato; fallback al calcolo on-the-fly dalla data.
function getRecordMese(r) {
  if (r.mese && String(r.mese).trim()) return r.mese;
  return getMeseFromDate(getDataChiusura(r));
}

function getRecordSettimana(r) {
  if (r.settimane != null) return r.settimane;
  return getSettimanaFromDate(getDataChiusura(r));
}

function getRecordAnno(r) {
  if (r.anno != null) return r.anno;
  return getAnnoFromDate(getDataChiusura(r));
}

function getRecordMeseImmissione(r) {
  if (r.mese_immissione && String(r.mese_immissione).trim()) return r.mese_immissione;
  return getMeseFromDate(getDataImmissione(r));
}

function getRecordAnnoImmissione(r) {
  if (r.anno != null) return r.anno;
  return getAnnoFromDate(getDataImmissione(r));
}

function getRecordSettimanaImmissione(r) {
  if (r.settimane != null) return r.settimane;
  return getSettimanaFromDate(getDataImmissione(r));
}

function getDataChiusura(r) {
  return r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
}

function getDataImmissione(r) {
  return r.ordine_immesso_il;
}

function applyFilters(rows, filters, useImmissione) {
  if (!filters || (!filters.mese && !filters.raccoglitore && !filters.anno && !filters.settimana)) return rows;
  return rows.filter((row) => {
    const mese = useImmissione ? getRecordMeseImmissione(row) : getRecordMese(row);
    const anno = useImmissione ? getRecordAnnoImmissione(row) : getRecordAnno(row);
    const sett = useImmissione ? getRecordSettimanaImmissione(row) : getRecordSettimana(row);
    if (filters.mese && mese !== filters.mese) return false;
    if (filters.anno && anno !== parseInt(filters.anno)) return false;
    if (filters.settimana && sett !== parseInt(filters.settimana)) return false;
    if (filters.raccoglitore) {
      const r = (row.trasportatore || '').trim();
      const p = (row.partner_operativo || '').trim();
      if (r !== filters.raccoglitore && p !== filters.raccoglitore) return false;
    }
    return true;
  });
}

function buildPivotTree(rows, rowKeyFns, colKeyFn, valueFns) {
  function buildNode(nodeRows, level) {
    const values = {};
    const totals = {};
    for (const name of Object.keys(valueFns)) totals[name] = 0;

    if (level >= rowKeyFns.length) {
      for (const row of nodeRows) {
        const col = colKeyFn(row);
        if (col === null) continue;
        if (!values[col]) { values[col] = {}; for (const n of Object.keys(valueFns)) values[col][n] = 0; }
        for (const [name, fn] of Object.entries(valueFns)) values[col][name] += fn(row);
      }
      for (const name of Object.keys(valueFns)) for (const c of Object.keys(values)) totals[name] += values[c][name];
      return { values, totals, children: null };
    }

    const groups = {};
    for (const row of nodeRows) {
      const key = rowKeyFns[level](row) || 'N/D';
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }

    const children = [];
    for (const [key, groupRows] of Object.entries(groups)) {
      const child = buildNode(groupRows, level + 1);
      child.label = key;
      for (const [col, colValues] of Object.entries(child.values)) {
        if (!values[col]) { values[col] = {}; for (const n of Object.keys(valueFns)) values[col][n] = 0; }
        for (const [name, val] of Object.entries(colValues)) values[col][name] += val;
      }
      children.push(child);
    }
    for (const name of Object.keys(valueFns)) for (const c of Object.keys(values)) totals[name] += values[c][name];
    children.sort((a, b) => a.label.localeCompare(b.label));
    return { values, totals, children };
  }

  const root = buildNode(rows, 0);
  const columns = Object.keys(root.values).sort((a, b) => MESI.indexOf(a) - MESI.indexOf(b));
  return { tree: root, columns };
}

function buildDetailTable(rows, rowKeyFns, collectors) {
  const groups = {};
  for (const row of rows) {
    const keyParts = rowKeyFns.map((fn) => fn(row) ?? 'N/D');
    const key = keyParts.join('|||');
    if (!groups[key]) {
      groups[key] = { keys: keyParts, values: {} };
      for (const name of Object.keys(collectors)) groups[key].values[name] = collectors[name].init();
    }
    for (const [name, collector] of Object.entries(collectors)) collector.add(groups[key].values[name], row);
  }
  return Object.values(groups).map((g) => {
    const values = {};
    for (const [name, collector] of Object.entries(collectors)) values[name] = collector.finalize(g.values[name]);
    return { keys: g.keys, values };
  }).sort((a, b) => a.keys.join('').localeCompare(b.keys.join('')));
}

const sumCol = (f) => ({ init: () => 0, add: (a, r) => a + (r[f] || 0), finalize: (a) => a });
const countCol = () => ({ init: () => 0, add: (a) => a + 1, finalize: (a) => a });
const uniqueCol = (f) => ({ init: () => new Set(), add: (a, r) => { if (r[f]) a.add(r[f]); }, finalize: (a) => a.size });

const PESO_FN = (r) => (r.peso_effettivo || 0) / 1000;
const PESO_STIM_FN = (r) => (r.peso_stimato || 0) / 1000;
const COUNT_FN = () => 1;

export async function computeAllPivots(base44, filters) {
  const [rete, aci, sec, assegnati] = await Promise.all([
    base44.asServiceRole.entities.PrimariaRete.list('-created_date', 10000),
    base44.asServiceRole.entities.PrimariaAci.list('-created_date', 10000),
    base44.asServiceRole.entities.Secondaria.list('-created_date', 10000),
    base44.asServiceRole.entities.Assegnato.list('-created_date', 10000),
  ]);

  const reteF = applyFilters(rete, filters, false);
  const aciF = applyFilters(aci, filters, false);
  const secF = applyFilters(sec, filters, false);
  const assF = applyFilters(assegnati, filters, true);

  const pivotA = buildPivotTree(reteF, [(r) => (r.trasportatore || 'N/D').trim(), (r) => getRegione(r), getClasse], (r) => getRecordMese(r), { peso: PESO_FN, count: COUNT_FN });
  pivotA.valueKeys = ['peso', 'count']; pivotA.valueLabels = ['Peso [t]', 'Conteggio']; pivotA.rowLabels = ['Raccoglitore', 'Regione', 'Classe'];

  const pivotB = buildPivotTree(reteF, [(r) => (r.destinazione || 'N/D').trim(), getClasse], (r) => getRecordMese(r), { peso: PESO_FN });
  pivotB.valueKeys = ['peso']; pivotB.valueLabels = ['Peso [t]']; pivotB.rowLabels = ['Impianto', 'Classe'];

  const pivotC = buildPivotTree(aciF, [(r) => (r.trasportatore || 'N/D').trim(), (r) => getRegione(r), getClasse], (r) => getRecordMese(r), { peso: PESO_FN, count: COUNT_FN });
  pivotC.valueKeys = ['peso', 'count']; pivotC.valueLabels = ['Peso [t]', 'Conteggio']; pivotC.rowLabels = ['Raccoglitore', 'Regione', 'Classe'];

  const pivotD = buildPivotTree(secF, [(r) => (r.destinazione || 'N/D').trim(), getClasse], (r) => getRecordMese(r), { peso: PESO_FN });
  pivotD.valueKeys = ['peso']; pivotD.valueLabels = ['Peso [t]']; pivotD.rowLabels = ['Impianto', 'Classe'];

  const detailRowKeys = [getClasse, (r) => getRecordMese(r) || 'N/D', (r) => { const s = getRecordSettimana(r); return s != null ? String(s) : 'N/D'; }];
  const detailCollectors = { peso: sumCol('peso_effettivo'), count: countCol(), firCount: uniqueCol('numero_fir') };

  const pivotE = buildDetailTable(reteF, detailRowKeys, detailCollectors);
  pivotE.forEach((r) => { r.values.peso = +(r.values.peso / 1000).toFixed(2); });
  pivotE.valueKeys = ['peso', 'count', 'firCount']; pivotE.valueLabels = ['Peso [t]', 'Conteggio', 'FIR Univoci']; pivotE.rowLabels = ['Classe', 'Mese', 'Settimana'];

  const pivotF = buildDetailTable(secF, detailRowKeys, detailCollectors);
  pivotF.forEach((r) => { r.values.peso = +(r.values.peso / 1000).toFixed(2); });
  pivotF.valueKeys = pivotE.valueKeys; pivotF.valueLabels = pivotE.valueLabels; pivotF.rowLabels = pivotE.rowLabels;

  const pivotG = buildDetailTable(aciF, detailRowKeys, detailCollectors);
  pivotG.forEach((r) => { r.values.peso = +(r.values.peso / 1000).toFixed(2); });
  pivotG.valueKeys = pivotE.valueKeys; pivotG.valueLabels = pivotE.valueLabels; pivotG.rowLabels = pivotE.rowLabels;

  const pivotH = buildPivotTree(assF, [(r) => { const a = getRecordAnnoImmissione(r); return a != null ? String(a) : 'N/D'; }, (r) => getRegione(r), (r) => (r.provincia || 'N/D').trim(), (r) => (r.ragione_sociale || 'N/D').trim()], (r) => getRecordMeseImmissione(r), { count: COUNT_FN, pesoStimato: PESO_STIM_FN });
  pivotH.valueKeys = ['count', 'pesoStimato']; pivotH.valueLabels = ['Richieste', 'Peso Stimato [t]']; pivotH.rowLabels = ['Anno', 'Regione', 'Provincia', 'Ragione Sociale'];

  // Filter options
  const allSourceRows = [...rete, ...aci, ...sec, ...assegnati];
  const raccoglitori = [...new Set(allSourceRows.map((r) => (r.trasportatore || '').trim()).filter(Boolean))].sort();
  const anni = [...new Set([...rete, ...aci, ...sec].map((r) => getRecordAnno(r)).filter(Boolean), ...assegnati.map((r) => getRecordAnnoImmissione(r)).filter(Boolean))].sort();
  const settimane = [...new Set([...rete, ...aci, ...sec].map((r) => getRecordSettimana(r)).filter(Boolean), ...assegnati.map((r) => getRecordSettimanaImmissione(r)).filter(Boolean))].sort((a, b) => a - b);

  return { pivotA, pivotB, pivotC, pivotD, pivotE, pivotF, pivotG, pivotH, filterOptions: { raccoglitori, anni, settimane } };
}

// Flattening per export Excel
export function flattenTree(node, columns, valueKeys, maxDepth, path = [], rows = []) {
  if (!node.children) return rows;
  for (const child of node.children) {
    const newPath = [...path, child.label];
    const row = [];
    for (let i = 0; i < maxDepth; i++) row.push(newPath[i] || '');
    for (const col of columns) for (const vk of valueKeys) row.push(child.values[col]?.[vk] != null ? +child.values[col][vk].toFixed(2) : 0);
    for (const vk of valueKeys) row.push(+child.totals[vk].toFixed(2));
    rows.push(row);
    if (child.children) flattenTree(child, columns, valueKeys, maxDepth, newPath, rows);
  }
  return rows;
}