// Modulo condiviso per il calcolo delle pivot analitiche PFU.
import { PROV_TO_REGION, MESI } from "./raccoltoCalculator.ts";

function getMese(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return MESI[d.getMonth()];
}

function getSettimana(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

function getAnno(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.getFullYear();
}

function getRegione(provincia) {
  return PROV_TO_REGION[(provincia || '').toUpperCase().trim()] || 'Altro';
}

function getClasse(r) {
  if (r.classe && String(r.classe).trim()) return String(r.classe).trim();
  if (r.prodotto) {
    const m = String(r.prodotto).match(/^([A-Z0-9]{1,3})\s*-/);
    if (m) return m[1];
  }
  return 'N/D';
}

function getDataChiusura(r) {
  return r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
}

function getDataImmissione(r) {
  return r.ordine_immesso_il;
}

function applyFilters(rows, filters, getDateFn) {
  if (!filters || (!filters.mese && !filters.raccoglitore && !filters.anno && !filters.settimana)) return rows;
  return rows.filter((row) => {
    const data = getDateFn(row);
    if (filters.mese && getMese(data) !== filters.mese) return false;
    if (filters.anno && getAnno(data) !== parseInt(filters.anno)) return false;
    if (filters.settimana && getSettimana(data) !== parseInt(filters.settimana)) return false;
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

  const reteF = applyFilters(rete, filters, getDataChiusura);
  const aciF = applyFilters(aci, filters, getDataChiusura);
  const secF = applyFilters(sec, filters, getDataChiusura);
  const assF = applyFilters(assegnati, filters, getDataImmissione);

  const pivotA = buildPivotTree(reteF, [(r) => (r.trasportatore || 'N/D').trim(), (r) => getRegione(r.provincia), getClasse], (r) => getMese(getDataChiusura(r)), { peso: PESO_FN, count: COUNT_FN });
  pivotA.valueKeys = ['peso', 'count']; pivotA.valueLabels = ['Peso [t]', 'Conteggio']; pivotA.rowLabels = ['Raccoglitore', 'Regione', 'Classe'];

  const pivotB = buildPivotTree(reteF, [(r) => (r.destinazione || 'N/D').trim(), getClasse], (r) => getMese(getDataChiusura(r)), { peso: PESO_FN });
  pivotB.valueKeys = ['peso']; pivotB.valueLabels = ['Peso [t]']; pivotB.rowLabels = ['Impianto', 'Classe'];

  const pivotC = buildPivotTree(aciF, [(r) => (r.trasportatore || 'N/D').trim(), (r) => getRegione(r.provincia), getClasse], (r) => getMese(getDataChiusura(r)), { peso: PESO_FN, count: COUNT_FN });
  pivotC.valueKeys = ['peso', 'count']; pivotC.valueLabels = ['Peso [t]', 'Conteggio']; pivotC.rowLabels = ['Raccoglitore', 'Regione', 'Classe'];

  const pivotD = buildPivotTree(secF, [(r) => (r.destinazione || 'N/D').trim(), getClasse], (r) => getMese(getDataChiusura(r)), { peso: PESO_FN });
  pivotD.valueKeys = ['peso']; pivotD.valueLabels = ['Peso [t]']; pivotD.rowLabels = ['Impianto', 'Classe'];

  const detailRowKeys = [getClasse, (r) => getMese(getDataChiusura(r)) || 'N/D', (r) => { const s = getSettimana(getDataChiusura(r)); return s != null ? String(s) : 'N/D'; }];
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

  const pivotH = buildPivotTree(assF, [(r) => { const a = getAnno(getDataImmissione(r)); return a != null ? String(a) : 'N/D'; }, (r) => getRegione(r.provincia), (r) => (r.provincia || 'N/D').trim(), (r) => (r.ragione_sociale || 'N/D').trim()], (r) => getMese(getDataImmissione(r)), { count: COUNT_FN, pesoStimato: PESO_STIM_FN });
  pivotH.valueKeys = ['count', 'pesoStimato']; pivotH.valueLabels = ['Richieste', 'Peso Stimato [t]']; pivotH.rowLabels = ['Anno', 'Regione', 'Provincia', 'Ragione Sociale'];

  // Filter options
  const allSourceRows = [...rete, ...aci, ...sec, ...assegnati];
  const raccoglitori = [...new Set(allSourceRows.map((r) => (r.trasportatore || '').trim()).filter(Boolean))].sort();
  const anni = [...new Set([...rete, ...aci, ...sec].map((r) => getAnno(getDataChiusura(r))).filter(Boolean), ...assegnati.map((r) => getAnno(getDataImmissione(r))).filter(Boolean))].sort();
  const settimane = [...new Set([...rete, ...aci, ...sec].map((r) => getSettimana(getDataChiusura(r))).filter(Boolean), ...assegnati.map((r) => getSettimana(getDataImmissione(r))).filter(Boolean))].sort((a, b) => a - b);

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