import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { computeSlaMetrics } from "../../shared/primarieReteAnalytics.ts";

// Calcola le metriche SLA per trasportatore: Nr Giorni medio, % nei tempi, % dopo scadenza.
// Alert critico se Nr Giorni medio > 12 o % fuori tempo > 20%.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const records = await base44.asServiceRole.entities.PrimariaRete.list('-created_date', 10000);
    const result = computeSlaMetrics(records);

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}