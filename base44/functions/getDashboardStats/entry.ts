import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Restituisce conteggi rapidi per la Dashboard: numero record per entità + alert aperti.
// Nessun payload richiesto.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [assegnati, rete, aci, sec, terz, alerts] = await Promise.all([
      base44.asServiceRole.entities.Assegnato.list('-created_date', 10000),
      base44.asServiceRole.entities.PrimariaRete.list('-created_date', 10000),
      base44.asServiceRole.entities.PrimariaAci.list('-created_date', 10000),
      base44.asServiceRole.entities.Secondaria.list('-created_date', 10000),
      base44.asServiceRole.entities.Terziaria.list('-created_date', 10000),
      base44.asServiceRole.entities.Alert.filter({ stato: 'aperto' }, '-created_date', 10000),
    ]);

    return Response.json({
      counts: {
        assegnati: assegnati.length,
        primarie_rete: rete.length,
        primarie_aci: aci.length,
        secondarie: sec.length,
        terziarie: terz.length,
      },
      alert_count: alerts.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}