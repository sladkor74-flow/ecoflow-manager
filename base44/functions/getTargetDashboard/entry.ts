import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Aggrega raccolte RETE e ACI per regione + target mensili.
// Payload: { mese, anno } — default mese corrente.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mese = body.mese || '';
    const anno = body.anno || new Date().getFullYear();

    const filter = {};
    if (mese) filter.mese = mese;

    const [rete, aci, targets] = await Promise.all([
      base44.asServiceRole.entities.PrimariaRete.filter(filter, '-created_date', 10000),
      base44.asServiceRole.entities.PrimariaAci.filter(filter, '-created_date', 10000),
      base44.asServiceRole.entities.TargetMensile.filter(mese ? { mese } : {}, '-created_date', 10000),
    ]);

    // Aggrega per regione
    const regioniMap = {};

    const addRegion = (nome) => {
      if (!nome) return null;
      if (!regioniMap[nome]) regioniMap[nome] = { regione: nome, rete_kg: 0, aci_kg: 0, target: 0, raccolto_target: 0 };
      return regioniMap[nome];
    };

    for (const r of rete) {
      const reg = addRegion(r.regione);
      if (reg) reg.rete_kg += Number(r.peso_effettivo || 0);
    }
    for (const a of aci) {
      const reg = addRegion(a.regione);
      if (reg) reg.aci_kg += Number(a.peso_effettivo || 0);
    }
    for (const t of targets) {
      const reg = addRegion(t.regione);
      if (reg) {
        reg.target += Number(t.target || 0);
        reg.raccolto_target += Number(t.raccolto || 0);
      }
    }

    const regioni = Object.values(regioniMap).map((r) => ({
      ...r,
      totale_kg: r.rete_kg + r.aci_kg,
      target_t: r.target,
      raccolto_t: r.raccolto_target,
      raggiungimento: r.target > 0 ? ((r.rete_kg + r.aci_kg) / 1000 / r.target * 100) : 0,
    })).sort((a, b) => b.totale_kg - a.totale_kg);

    const totals = {
      rete_kg: regioni.reduce((s, r) => s + r.rete_kg, 0),
      aci_kg: regioni.reduce((s, r) => s + r.aci_kg, 0),
      target_t: regioni.reduce((s, r) => s + r.target_t, 0),
      raccolto_t: regioni.reduce((s, r) => s + r.raccolto_t, 0),
    };
    totals.totale_kg = totals.rete_kg + totals.aci_kg;
    totals.raggiungimento = totals.target_t > 0 ? (totals.totale_kg / 1000 / totals.target_t * 100) : 0;

    return Response.json({ regioni, totals, mese, anno });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}