// NON USATO. Nessuna funzione e nessuna pagina importa questo modulo da quando la
// funzione computePivotData e' stata tolta (commit a3b5475, "funzioni di sola
// lettura mai chiamate"): le pivot vive stanno in base44/shared/reportMensile.ts.
// Le correzioni fatte qui (periodo dalla fine trasporto, ACI per canale,
// conteggio dei terminati senza fine trasporto) non hanno effetto su nessun
// numero a video. Chi lo ricollega a una pagina lo riverifichi contro le regole
// di AGENTS.md; altrimenti va tolto.
//
// Modulo condiviso per il calcolo delle pivot analitiche PFU.
import { PROV_TO_REGION, MESI, riepilogoDateVista } from "./raccoltoCalculator.ts";
import { getMeseFromDate, getSettimanaFromDate, getAnnoFromDate, getRegioneFromProvincia, getClasseFromProdotto } from "./dataEnrichment.ts";
import { matchesFilter } from "./multiFilter.ts";
import { fetchAll } from "./fetchAll.ts";
import { eTerminato, giornoMovimento } from "./movimenti.ts";
import { eAci } from "./canaleSecondaria.ts";

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

// Periodo sempre dalla data di fine trasporto: i campi mese, settimane e anno
// memorizzati sul record possono venire da un'importazione vecchia, quando la
// data di riferimento era la chiusura dell'ordine, e direbbero un mese diverso.
function getRecordMese(r) {
  return getMeseFromDate(getDataFineTrasporto(r));
}

function getRecordSettimana(r) {
  return getSettimanaFromDate(getDataFineTrasporto(r));
}

function getRecordAnno(r) {
  return getAnnoFromDate(getDataFineTrasporto(r));
}

function getRecordMeseImmissione(r) {
  if (r.mese_immissione && String(r.mese_immissione).trim()) return r.mese_immissione;
  return getMeseFromDate(getDataImmissione(r));
}

// I campi anno e settimane memorizzati si riferiscono alla data di riferimento
// del record, non all'immissione: qui si calcolano dall'immissione e basta.
function getRecordAnnoImmissione(r) {
  return getAnnoFromDate(getDataImmissione(r));
}

function getRecordSettimanaImmissione(r) {
  return getSettimanaFromDate(getDataImmissione(r));
}

// Si chiamava getDataChiusura e ripiegava sull'immissione: un ordine cancellato
// o un terminato senza data finivano nel mese in cui erano stati immessi. Il
// periodo di un movimento e' solo la fine del trasporto; chi non l'ha resta fuori
// dalle pivot e si conta a parte (movimentiContati).
function getDataFineTrasporto(r) {
  return r.trasporto_finito_il || null;
}

// I movimenti che entrano nelle pivot: terminati con una fine trasporto
// leggibile. Gli altri si contano per dirli, non si collocano in un mese.
// Le date obbligatorie da sistemare (regola dell'utente, 22/09/2026) non si
// contano qui: si contano in computeAllPivots, dopo i filtri di periodo, ed e'
// per questo che restano accanto ai contati anche tutte le righe di partenza.
function movimentiContati(righe) {
  const contati = [];
  let senzaFine = 0;
  const esempi = [];
  for (const r of righe) {
    if (!eTerminato(r)) continue;
    if (!giornoMovimento(r)) {
      senzaFine++;
      if (esempi.length < 10) esempi.push(r.id_ordine || r.numero_fir || '');
      continue;
    }
    contati.push(r);
  }
  return { tutti: righe, contati, senza_fine_trasporto: senzaFine, esempi: esempi.filter(Boolean) };
}

function getDataImmissione(r) {
  return r.ordine_immesso_il;
}

function applyFilters(rows, filters, useImmissione) {
  const hasFilter = (v) => v != null && v !== '' && (!Array.isArray(v) || v.length > 0);
  if (!filters || (!hasFilter(filters.mese) && !hasFilter(filters.raccoglitore) && !hasFilter(filters.anno) && !hasFilter(filters.settimana))) return rows;
  return rows.filter((row) => {
    const mese = useImmissione ? getRecordMeseImmissione(row) : getRecordMese(row);
    const anno = useImmissione ? getRecordAnnoImmissione(row) : getRecordAnno(row);
    const sett = useImmissione ? getRecordSettimanaImmissione(row) : getRecordSettimana(row);
    if (hasFilter(filters.mese) && !matchesFilter(mese, filters.mese)) return false;
    if (hasFilter(filters.anno)) {
      const anni = Array.isArray(filters.anno) ? filters.anno.map(Number) : [parseInt(filters.anno)];
      if (!anni.includes(parseInt(anno))) return false;
    }
    if (hasFilter(filters.settimana)) {
      const setts = Array.isArray(filters.settimana) ? filters.settimana.map(Number) : [parseInt(filters.settimana)];
      if (!setts.includes(sett)) return false;
    }
    if (hasFilter(filters.raccoglitore)) {
      const r = (row.trasportatore || '').trim();
      const p = (row.partner_operativo || '').trim();
      const raccoglitori = Array.isArray(filters.raccoglitore) ? filters.raccoglitore : [filters.raccoglitore];
      if (!raccoglitori.includes(r) && !raccoglitori.includes(p)) return false;
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
  roundTree(root);
  const columns = Object.keys(root.values).sort((a, b) => MESI.indexOf(a) - MESI.indexOf(b));
  return { tree: root, columns };
}

function roundTree(node) {
  for (const col of Object.keys(node.values || {})) {
    for (const vk of Object.keys(node.values[col] || {})) {
      node.values[col][vk] = +node.values[col][vk].toFixed(2);
    }
  }
  for (const vk of Object.keys(node.totals || {})) {
    node.totals[vk] = +node.totals[vk].toFixed(2);
  }
  if (node.children) for (const child of node.children) roundTree(child);
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
    for (const [name, collector] of Object.entries(collectors)) groups[key].values[name] = collector.add(groups[key].values[name], row);
  }
  return Object.values(groups).map((g) => {
    const values = {};
    for (const [name, collector] of Object.entries(collectors)) values[name] = collector.finalize(g.values[name]);
    return { keys: g.keys, values };
  }).sort((a, b) => a.keys.join('').localeCompare(b.keys.join('')));
}

const sumCol = (f) => ({ init: () => 0, add: (a, r) => a + (r[f] || 0), finalize: (a) => a });
const countCol = () => ({ init: () => 0, add: (a) => a + 1, finalize: (a) => a });
const uniqueCol = (f) => ({ init: () => new Set(), add: (a, r) => { if (r[f]) a.add(r[f]); return a; }, finalize: (a) => a.size });

const PESO_FN = (r) => (r.peso_effettivo || 0) / 1000;
const PESO_STIM_FN = (r) => (r.peso_stimato || 0) / 1000;
const COUNT_FN = () => 1;

// Le pivot: A, B, E sulle primarie di rete; C, G sulle primarie ACI; D, F sulle
// secondarie di RETE; D_ACI, F_ACI sulle secondarie ACI; H sugli assegnati.
// Rete e ACI stanno nello stesso archivio delle secondarie, ma sono canali che
// non si sommano: nella D la classe "PFU Autodemolizione" finiva accanto a P, M,
// G1 e G2 e il subtotale dell'impianto e il totale generale li mescolavano.
export async function computeAllPivots(base44, filters, pivotKeys = null) {
  const shouldCompute = (key) => !pivotKeys || pivotKeys.includes(key);
  const keys = pivotKeys || ['A','B','C','D','D_ACI','E','F','F_ACI','G','H'];
  const needRete = keys.some(k => ['A','B','E'].includes(k));
  const needAci = keys.some(k => ['C','G'].includes(k));
  const needSec = keys.some(k => ['D','F','D_ACI','F_ACI'].includes(k));
  const needAss = keys.some(k => ['H'].includes(k));

  const [reteTutte, aciTutte, secTutte, assegnati] = await Promise.all([
    needRete ? fetchAll(base44.asServiceRole.entities.PrimariaRete) : Promise.resolve([]),
    needAci ? fetchAll(base44.asServiceRole.entities.PrimariaAci) : Promise.resolve([]),
    needSec ? fetchAll(base44.asServiceRole.entities.Secondaria) : Promise.resolve([]),
    needAss ? fetchAll(base44.asServiceRole.entities.Assegnato) : Promise.resolve([]),
  ]);

  // Contano solo i terminati con la fine del trasporto: cancellati e assegnati
  // non sono raccolto, e un terminato senza data si segnala invece di finire nel
  // mese di immissione. Solo la pivot H (assegnati) resta sull'immissione.
  const reteM = movimentiContati(reteTutte);
  const aciM = movimentiContati(aciTutte);
  const secReteM = movimentiContati(secTutte.filter(r => !eAci(r)));
  const secAciM = movimentiContati(secTutte.filter(r => eAci(r)));
  const rete = reteM.contati, aci = aciM.contati;
  const secRete = secReteM.contati, secAci = secAciM.contati;
  const sec = [...secRete, ...secAci];   // solo per le opzioni dei filtri

  const reteF = applyFilters(rete, filters, false);
  const aciF = applyFilters(aci, filters, false);
  const secReteF = applyFilters(secRete, filters, false);
  const secAciF = applyFilters(secAci, filters, false);
  const assF = applyFilters(assegnati, filters, true);

  const result = {};
  result.senzaFineTrasporto = {
    rete: { quanti: reteM.senza_fine_trasporto, esempi: reteM.esempi },
    aci: { quanti: aciM.senza_fine_trasporto, esempi: aciM.esempi },
    secondarie_rete: { quanti: secReteM.senza_fine_trasporto, esempi: secReteM.esempi },
    secondarie_aci: { quanti: secAciM.senza_fine_trasporto, esempi: secAciM.esempi },
  };
  // Un canale per volta, come i senza fine trasporto qui sopra, e sul periodo
  // che si sta guardando: riepilogoDateVista, lo stesso conto di dashboard,
  // report mensile e matrice. Si contavano su tutto l'archivio del canale, di
  // ogni anno, mentre le pivot accanto mostrano il periodo filtrato: due
  // riquadri della stessa pagina dicevano numeri diversi con la stessa frase.
  // I terminati senza fine trasporto restano di qualunque anno: nessun filtro di
  // periodo li prende, e vanno detti sempre.
  result.dateDaSistemare = {
    rete: riepilogoDateVista(reteM.tutti, reteF),
    aci: riepilogoDateVista(aciM.tutti, aciF),
    secondarie_rete: riepilogoDateVista(secReteM.tutti, secReteF),
    secondarie_aci: riepilogoDateVista(secAciM.tutti, secAciF),
  };

  if (shouldCompute('A')) {
    const pivotA = buildPivotTree(reteF, [(r) => (r.trasportatore || 'N/D').trim(), (r) => getRegione(r), getClasse], (r) => getRecordMese(r), { peso: PESO_FN, count: COUNT_FN });
    pivotA.valueKeys = ['peso', 'count']; pivotA.valueLabels = ['Peso [t]', 'Conteggio']; pivotA.rowLabels = ['Raccoglitore', 'Regione', 'Classe'];
    result.pivotA = pivotA;
  }
  if (shouldCompute('B')) {
    const pivotB = buildPivotTree(reteF, [(r) => (r.destinazione || 'N/D').trim(), getClasse], (r) => getRecordMese(r), { peso: PESO_FN });
    pivotB.valueKeys = ['peso']; pivotB.valueLabels = ['Peso [t]']; pivotB.rowLabels = ['Impianto', 'Classe'];
    result.pivotB = pivotB;
  }
  if (shouldCompute('C')) {
    const pivotC = buildPivotTree(aciF, [(r) => (r.trasportatore || 'N/D').trim(), (r) => getRegione(r), getClasse], (r) => getRecordMese(r), { peso: PESO_FN, count: COUNT_FN });
    pivotC.valueKeys = ['peso', 'count']; pivotC.valueLabels = ['Peso [t]', 'Conteggio']; pivotC.rowLabels = ['Raccoglitore', 'Regione', 'Classe'];
    result.pivotC = pivotC;
  }
  if (shouldCompute('D')) {
    const pivotD = buildPivotTree(secReteF, [(r) => (r.destinazione || 'N/D').trim(), getClasse], (r) => getRecordMese(r), { peso: PESO_FN });
    pivotD.valueKeys = ['peso']; pivotD.valueLabels = ['Peso [t]']; pivotD.rowLabels = ['Impianto', 'Classe']; pivotD.canale = 'RETE';
    result.pivotD = pivotD;
  }
  if (shouldCompute('D_ACI')) {
    const pivotDAci = buildPivotTree(secAciF, [(r) => (r.destinazione || 'N/D').trim(), getClasse], (r) => getRecordMese(r), { peso: PESO_FN });
    pivotDAci.valueKeys = ['peso']; pivotDAci.valueLabels = ['Peso [t]']; pivotDAci.rowLabels = ['Impianto', 'Classe']; pivotDAci.canale = 'ACI';
    result.pivotD_ACI = pivotDAci;
  }
  if (['E', 'F', 'F_ACI', 'G'].some(shouldCompute)) {
    const detailRowKeys = [getClasse, (r) => getRecordMese(r) || 'N/D', (r) => { const s = getRecordSettimana(r); return s != null ? String(s) : 'N/D'; }];
    const detailCollectors = { peso: sumCol('peso_effettivo'), count: countCol(), firCount: uniqueCol('numero_fir') };
    const detailMeta = { valueKeys: ['peso', 'count', 'firCount'], valueLabels: ['Peso [t]', 'Conteggio', 'FIR Univoci'], rowLabels: ['Classe', 'Mese', 'Settimana'] };
    if (shouldCompute('E')) {
      const rows = buildDetailTable(reteF, detailRowKeys, detailCollectors);
      rows.forEach((r) => { r.values.peso = +(r.values.peso / 1000).toFixed(3); });
      result.pivotE = { rows, ...detailMeta };
    }
    if (shouldCompute('F')) {
      const rows = buildDetailTable(secReteF, detailRowKeys, detailCollectors);
      rows.forEach((r) => { r.values.peso = +(r.values.peso / 1000).toFixed(3); });
      result.pivotF = { rows, ...detailMeta, canale: 'RETE' };
    }
    if (shouldCompute('F_ACI')) {
      const rows = buildDetailTable(secAciF, detailRowKeys, detailCollectors);
      rows.forEach((r) => { r.values.peso = +(r.values.peso / 1000).toFixed(3); });
      result.pivotF_ACI = { rows, ...detailMeta, canale: 'ACI' };
    }
    if (shouldCompute('G')) {
      const rows = buildDetailTable(aciF, detailRowKeys, detailCollectors);
      rows.forEach((r) => { r.values.peso = +(r.values.peso / 1000).toFixed(3); });
      result.pivotG = { rows, ...detailMeta };
    }
  }
  if (shouldCompute('H')) {
    const pivotH = buildPivotTree(assF, [(r) => { const a = getRecordAnnoImmissione(r); return a != null ? String(a) : 'N/D'; }, (r) => getRegione(r), (r) => (r.provincia || 'N/D').trim(), (r) => (r.ragione_sociale || 'N/D').trim()], (r) => getRecordMeseImmissione(r), { count: COUNT_FN, pesoStimato: PESO_STIM_FN });
    pivotH.valueKeys = ['count', 'pesoStimato']; pivotH.valueLabels = ['Richieste', 'Peso Stimato [t]']; pivotH.rowLabels = ['Anno', 'Regione', 'Provincia', 'Ragione Sociale'];
    result.pivotH = pivotH;
  }

  // Opzioni dei filtri dai movimenti contati (con fine trasporto) e dagli assegnati
  const allSourceRows = [...rete, ...aci, ...sec, ...assegnati];
  if (allSourceRows.length > 0) {
    const raccoglitori = [...new Set(allSourceRows.map((r) => (r.trasportatore || '').trim()).filter(Boolean))].sort();
    const anni = [...new Set([...rete, ...aci, ...sec].map((r) => getRecordAnno(r)).filter(Boolean), ...assegnati.map((r) => getRecordAnnoImmissione(r)).filter(Boolean))].sort();
    const settimane = [...new Set([...rete, ...aci, ...sec].map((r) => getRecordSettimana(r)).filter(Boolean), ...assegnati.map((r) => getRecordSettimanaImmissione(r)).filter(Boolean))].sort((a, b) => a - b);
    result.filterOptions = { raccoglitori, anni, settimane };
  }
  return result;
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