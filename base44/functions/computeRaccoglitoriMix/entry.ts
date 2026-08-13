import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { computeRaccoglitoriMixData } from "../../shared/primarieReteAnalytics.ts";

// Calcola il mix classi PFU per Raccoglitore e confronta con i target consorziali.
// Vista A (% SUL RACCOLTO): peso_classe / totale_raccoglitore
// Vista B (% SUL TARGET): peso_classe / target_annuo_raccoglitore (da entità TargetRaccoglitore)
// Target consorziali: P=75%, M=20%, G1=4%, G2=1%. Deviazione significativa > ±5%.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const filters = body.filters || {};

    // Determina l'anno effettivo: primo anno filtrato o anno in corso
    const toArray = (v: any) => Array.isArray(v) ? v : (v != null ? [v] : []);
    const fAnno = toArray(filters.anno).map(Number);
    const effectiveYear = fAnno.length > 0 ? fAnno[0] : new Date().getFullYear();

    // Recupera i target per raccoglitore per l'anno effettivo
    const targetRecords = await base44.asServiceRole.entities.TargetRaccoglitore.filter(
      { anno: effectiveYear }, '-created_date', 1000
    );
    const targetsMap: Record<string, number> = {};
    for (const t of targetRecords) {
      targetsMap[t.raccoglitore] = t.target_tonnellate || 0;
    }

    const records = await base44.asServiceRole.entities.PrimariaRete.list('-created_date', 10000);
    const result = computeRaccoglitoriMixData(records, targetsMap, filters);

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}