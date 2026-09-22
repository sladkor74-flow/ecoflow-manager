import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { cruscotto } from "../../shared/cruscotto.ts";

// Il cruscotto della dashboard: l'elenco unico delle cose da gestire, l'arretrato
// per canale, la freschezza dei dati, gli alert aperti, lo stato dei mesi della
// fatturazione attiva. Legge solo archivi piccoli, quindi si puo' chiamare a ogni
// apertura della dashboard. Il calcolo sta in base44/shared/cruscotto.ts.
// Payload: { anno? }
const TIPI_FILE = ['primarie', 'secondarie', 'terziarie', 'ordini_non_dichiarati', 'dichiarazioni_trattamento', 'pdr'];

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const oggi = oggiRoma();
    const anno = Number(body.anno) || Number(oggi.slice(0, 4));

    const svc = base44.asServiceRole.entities;
    const [alertAperti, uploadLogs, assegnatiRete, assegnatiAci, documenti, prefatture, riepiloghi, giacenzeSito, impiantiTarget, richiesteEct] = await Promise.all([
      fetchAll(svc.Alert, { stato: 'aperto' }),
      svc.UploadLog.list('-created_date', 200),
      fetchAll(svc.Assegnato),
      fetchAll(svc.AssegnatoAci),
      svc.DocumentoFatturazione.filter({ tipo: 'ATTIVA', anno }),
      svc.PrefatturaEcotyre.filter({ anno }).catch(() => []),
      svc.RiepilogoQualifica.filter({ anno }, '-created_date', 1).catch(() => []),
      fetchAll(svc.GiacenzaSito),
      fetchAll(svc.ImpiantoTargetSecondaria),
      fetchAll(svc.RichiestaEct, { anno }).catch(() => []),
    ]);

    return Response.json(cruscotto({
      oggi, anno, adessoMs: Date.now(), tipiFile: TIPI_FILE,
      alertAperti, uploadLogs, assegnatiRete, assegnatiAci, documenti,
      // delle prefatture bastano mese e stato: le righe non servono qui
      prefatture: (prefatture || []).map(p => ({ anno: p.anno, mese: p.mese, superata: p.superata })),
      riepilogoQualifica: riepiloghi[0] || null, giacenzeSito, impiantiTarget, richiesteEct,
    }));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
