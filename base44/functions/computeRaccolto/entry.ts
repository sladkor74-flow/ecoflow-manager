import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { computeRaccoltoData } from "../../shared/raccoltoCalculator.ts";

// Aggrega il peso effettivo delle primarie (Rete + ACI) per raccoglitore, regione, mese e impianto.
// Payload: nessuno
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await computeRaccoltoData(base44);
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}