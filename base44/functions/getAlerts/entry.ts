import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Restituisce conteggi alert per dashboard e moduli.
// Payload: { modulo?, solo_aperti?: boolean }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const modulo = body.modulo;
    const soloAperti = body.solo_aperti !== false;

    const query = soloAperti ? { stato: 'aperto' } : {};
    if (modulo) query.modulo = modulo;

    const alerts = await base44.asServiceRole.entities.Alert.filter(query, '-created_date', 5000);

    // Conteggi per modulo
    const byModulo = {};
    const bySeverita = {};
    for (const a of alerts) {
      byModulo[a.modulo] = (byModulo[a.modulo] || 0) + 1;
      bySeverita[a.severita] = (bySeverita[a.severita] || 0) + 1;
    }

    return Response.json({
      total: alerts.length,
      by_modulo: byModulo,
      by_severita: bySeverita,
      alerts: alerts.slice(0, 200), // ultimi 200 per display
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}