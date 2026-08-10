import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';
import { computeRaccoltoData, MESI } from "../../shared/raccoltoCalculator.ts";

// Esporta i dati di Status & Target in un file Excel (3 fogli: Raccoglitori, Regioni, Impianti).
// Payload: { anno? }
// Ritorna: { file_base64, filename }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const anno = body.anno || new Date().getFullYear();

    // 1. Calcola raccolto
    const raccolto = await computeRaccoltoData(base44);

    // 2. Leggi target
    const targets = await base44.asServiceRole.entities.TargetMensile.list('-created_date', 10000);
    const impiantoTargets = await base44.asServiceRole.entities.ImpiantoTarget.list('-created_date', 10000);

    // 3. Mappe target
    const targetMap = {};
    const targetAnnuoMap = {};
    for (const t of targets) {
      const key = `${t.raccoglitore}|||${t.regione}`;
      targetMap[`${key}|${t.mese}`] = t.target || 0;
      if (t.target_annuo != null) targetAnnuoMap[key] = t.target_annuo;
    }
    const impiantoTargetMap = {};
    for (const t of impiantoTargets) {
      impiantoTargetMap[`${t.impianto}|${t.mese}`] = t.target || 0;
    }

    // 4. Foglio Raccoglitori
    const raccoglitoriRows = [["Regione", "Raccoglitore", "Target Annuo [t]", "Raccolto Totale [t]", "Leftover [t]",
      ...MESI.flatMap(m => [`${m} T`, `${m} R`, `${m} Δ`])]];

    for (const r of raccolto.by_raccoglitore) {
      const key = `${r.raccoglitore}|||${r.regione}`;
      const targetAnnuo = targetAnnuoMap[key] || 0;
      const leftover = targetAnnuo - r.totale;
      const row = [r.regione, r.raccoglitore, targetAnnuo, +r.totale.toFixed(2), +leftover.toFixed(2)];
      for (const m of MESI) {
        const t = targetMap[`${key}|${m}`] || 0;
        const rac = r.mesi[m] || 0;
        row.push(t, +rac.toFixed(2), +(t - rac).toFixed(2));
      }
      raccoglitoriRows.push(row);
    }

    // 5. Foglio Regioni
    const regioniRows = [["Regione", "Raccolto Totale [t]", ...MESI.map(m => `${m} [t]`)]];
    for (const r of raccolto.by_regione) {
      const row = [r.regione, +r.totale.toFixed(2)];
      for (const m of MESI) row.push(+(r.mesi[m] || 0).toFixed(2));
      regioniRows.push(row);
    }

    // 6. Foglio Impianti
    const impiantiRows = [["Impianto", "Raccolto Totale [t]", ...MESI.flatMap(m => [`${m} Target`, `${m} Raccolto`, `${m} Δ`])]];
    for (const i of raccolto.by_impianto) {
      const row = [i.impianto, +i.totale.toFixed(2)];
      for (const m of MESI) {
        const t = impiantoTargetMap[`${i.impianto}|${m}`] || 0;
        const rac = i.mesi[m] || 0;
        row.push(t, +rac.toFixed(2), +(t - rac).toFixed(2));
      }
      impiantiRows.push(row);
    }

    // 7. Genera workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(raccoglitoriRows), "Raccoglitori");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(regioniRows), "Regioni");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(impiantiRows), "Impianti");

    const xlsxBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    return Response.json({
      file_base64: xlsxBase64,
      filename: `Status_Target_${new Date().toISOString().slice(0, 10)}.xlsx`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}