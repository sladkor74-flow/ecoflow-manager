import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';
import { computeAllPivots, flattenTree } from "../../shared/pivotCalculator.ts";

// Esporta tutte le pivot in un file Excel multi-foglio.
// Payload: { filters? }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const filters = body.filters || {};
    const data = await computeAllPivots(base44, filters);

    const wb = XLSX.utils.book_new();

    // Tree pivots
    const treePivots = [
      { key: 'A', name: 'Raccolta Rete', p: data.pivotA, maxDepth: 3 },
      { key: 'B', name: 'Impianti Rete', p: data.pivotB, maxDepth: 2 },
      { key: 'C', name: 'ACI', p: data.pivotC, maxDepth: 3 },
      { key: 'D', name: 'Secondarie', p: data.pivotD, maxDepth: 2 },
      { key: 'H', name: 'Richieste Aperte', p: data.pivotH, maxDepth: 4 },
    ];

    for (const tp of treePivots) {
      const header = [...tp.p.rowLabels];
      for (const col of tp.p.columns) for (const vl of tp.p.valueLabels) header.push(`${col} ${vl}`);
      for (const vl of tp.p.valueLabels) header.push(`Totale ${vl}`);
      const rows = flattenTree(tp.p.tree, tp.p.columns, tp.p.valueKeys, tp.maxDepth);
      const sheetData = [header, ...rows];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), tp.name.substring(0, 31));
    }

    // Detail pivots
    const detailPivots = [
      { name: 'Dettaglio Rete', p: data.pivotE },
      { name: 'Dettaglio Secondarie', p: data.pivotF },
      { name: 'Dettaglio ACI', p: data.pivotG },
    ];

    for (const dp of detailPivots) {
      const header = [...dp.p.rowLabels, ...dp.p.valueLabels];
      const rows = dp.p.rows.map((r) => [...r.keys, ...dp.p.valueKeys.map((vk) => r.values[vk])]);
      const sheetData = [header, ...rows];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), dp.name.substring(0, 31));
    }

    const xlsxBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    return Response.json({ file_base64: xlsxBase64, filename: `Report_Pivot_${new Date().toISOString().slice(0, 10)}.xlsx` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}