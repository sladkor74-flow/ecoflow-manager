import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Migrazione one-shot: calcola nr_giorni, scadenza_ordine, raccolta_nei_tempi
// sui record PrimariaRete esistenti che non hanno questi campi popolati.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const records = await base44.asServiceRole.entities.PrimariaRete.list('-created_date', 10000);

    const toUpdate = [];
    for (const r of records) {
      if (!r.ordine_immesso_il) continue;
      const d1 = new Date(r.ordine_immesso_il);
      if (isNaN(d1.getTime())) continue;

      const updates = { id: r.id };

      if (!r.scadenza_ordine) {
        const scad = new Date(d1.getTime());
        scad.setDate(scad.getDate() + 30);
        updates.scadenza_ordine = scad.toISOString();
      }

      if (r.ordine_chiuso_il && (r.nr_giorni == null || !r.raccolta_nei_tempi)) {
        const d2 = new Date(r.ordine_chiuso_il);
        if (!isNaN(d2.getTime())) {
          if (r.nr_giorni == null) {
            updates.nr_giorni = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
          }
          if (!r.raccolta_nei_tempi) {
            const scad = new Date(d1.getTime());
            scad.setDate(scad.getDate() + 30);
            updates.raccolta_nei_tempi = d2.getTime() <= scad.getTime() ? 'OK' : 'DOPO SCADENZA';
          }
        }
      }

      if (Object.keys(updates).length > 1) toUpdate.push(updates);
    }

    let updated = 0;
    for (let i = 0; i < toUpdate.length; i += 100) {
      const chunk = toUpdate.slice(i, i + 100);
      try {
        await base44.asServiceRole.entities.PrimariaRete.bulkUpdate(chunk);
        updated += chunk.length;
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) { /* skip chunk on error */ }
    }

    return Response.json({
      total_records: records.length,
      to_update: toUpdate.length,
      updated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}