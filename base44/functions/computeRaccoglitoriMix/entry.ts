import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { computeRaccoglitoriMixData, TARGET_ANNUO_TON } from "../../shared/primarieReteAnalytics.ts";

// Calcola il mix classi PFU per Raccoglitore e confronta con i target consorziali.
// Target: P=75%, M=20%, G1=4%, G2=1%. Deviazione significativa > ±5%.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const filters = body.filters || {};
    const records = await base44.asServiceRole.entities.PrimariaRete.list('-created_date', 10000);
    const result = computeRaccoglitoriMixData(records, TARGET_ANNUO_TON, filters);

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}