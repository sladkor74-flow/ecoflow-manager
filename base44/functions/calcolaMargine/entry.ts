import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { calcolaMargineAnno } from "../../shared/margine.ts";

// Il margine dell'anno, mese per mese e canale per canale, con una sola lettura
// degli archivi. Il calcolo sta in base44/shared/margine.ts. Costi e margini sono
// riservati all'amministratore, come la fatturazione passiva.
// Payload: { anno }
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
    const { anno } = await req.json().catch(() => ({}));
    const oggi = oggiRoma();
    const annoNum = Number(anno) || Number(oggi.slice(0, 4));
    // dell'anno in corso si calcolano i mesi fino a oggi; degli anni passati tutti
    const finoAlMese = annoNum === Number(oggi.slice(0, 4)) ? Number(oggi.slice(5, 7)) - 1 : 11;

    const svc = base44.asServiceRole.entities;
    const [reteAll, aciAll, extraAll, secondarieAll, fornitori, tariffe] = await Promise.all([
      fetchAll(svc.PrimariaRete), fetchAll(svc.PrimariaAci), fetchAll(svc.ExtraRaccolta),
      fetchAll(svc.Secondaria), fetchAll(svc.Fornitore), fetchAll(svc.Tariffa),
    ]);
    return Response.json({
      ...calcolaMargineAnno({ reteAll, aciAll, extraAll, secondarieAll, fornitori, tariffe }, annoNum, finoAlMese),
      calcolato_il: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
