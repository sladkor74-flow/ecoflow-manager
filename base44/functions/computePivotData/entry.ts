import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { computeAllPivots } from "../../shared/pivotCalculator.ts";

// Calcola tutte le pivot analitiche PFU da Primarie Rete/ACI, Secondarie e Assegnati.
// Payload: { filters?: { mese?, raccoglitore?, anno?, settimana? } }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const filters = body.filters || {};
    const pivotKeys = body.pivotKey || body.pivotKeys || null;

    const data = await computeAllPivots(base44, filters, pivotKeys);
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}