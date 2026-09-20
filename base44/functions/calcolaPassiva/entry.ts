import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from '../../shared/fetchAll.ts';
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { calcolaPassivaMese, indiceMesePassiva } from "../../shared/passivaCalcolo.ts";

// Fatturazione passiva di un mese e di un canale. Il calcolo sta in
// base44/shared/passivaCalcolo.ts, condiviso col margine: qui si leggono gli
// archivi e si risponde.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
    const { anno, mese, tipologia } = await req.json();
    if (!anno || !mese || !tipologia) return Response.json({ error: 'Anno, mese e tipologia obbligatori' }, { status: 400 });
    if (!['RETE', 'ACI', 'EXTRA_RACCOLTA'].includes(tipologia)) return Response.json({ error: 'Tipologia non valida (RETE, ACI, EXTRA_RACCOLTA)' }, { status: 400 });

    const annoNum = Number(anno);
    const meseNum = indiceMesePassiva(mese);
    if (meseNum < 0) return Response.json({ error: 'Mese non riconosciuto' }, { status: 400 });

    const [primarieRete, primarieAci, secondarieAll, extraRaccoltaAll, tariffeAll, fornitoriAll] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.PrimariaRete),
      fetchAll(base44.asServiceRole.entities.PrimariaAci),
      fetchAll(base44.asServiceRole.entities.Secondaria),
      fetchAll(base44.asServiceRole.entities.ExtraRaccolta),
      fetchAll(base44.asServiceRole.entities.Tariffa, { direzione: 'PASSIVA' }),
      fetchAll(base44.asServiceRole.entities.Fornitore, { stato: 'attivo' }),
    ]);

    return Response.json(calcolaPassivaMese({ primarieRete, primarieAci, secondarieAll, extraRaccoltaAll, tariffeAll, fornitoriAll }, annoNum, meseNum, mese, tipologia));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
