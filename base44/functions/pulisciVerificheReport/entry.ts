import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { oggiRoma } from "../../shared/reportSettimanali.ts";

// Cancella le verifiche dei report settimanali arrivate al quarantesimo giorno
// dal caricamento. Dopo la fatturazione quel lavoro non serve piu' e non va
// conservato. I file caricati non vengono mai salvati, quindi con la verifica
// sparisce tutto.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const oggi = oggiRoma();
    const svc = base44.asServiceRole.entities;
    const tutte = await fetchAll(svc.VerificaReport);
    let cancellate = 0;
    for (const v of tutte) {
      if (v.scade_il && String(v.scade_il).slice(0, 10) <= oggi) {
        await svc.VerificaReport.delete(v.id);
        cancellate++;
      }
    }
    return Response.json({ oggi, cancellate, rimaste: tutte.length - cancellate });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
