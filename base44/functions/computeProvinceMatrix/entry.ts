import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { computeProvinceMatrixData } from "../../shared/primarieReteAnalytics.ts";
import { fetchAll } from "../../shared/fetchAll.ts";

// Calcola la matrice mensile dei FIR raccolti per Regione/Provincia.
// Evidenzia province con 2 mesi consecutivi a zero (alert warning).
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const records = await fetchAll(base44.asServiceRole.entities.PrimariaRete);
    const result = computeProvinceMatrixData(records);

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}