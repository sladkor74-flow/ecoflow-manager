import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';

// Migrazione one-shot: crea il record T-CYCLE in ImpiantoTargetSecondaria
// (quota impianto 1.050.000 kg, totale capacita' 1.300.000 kg) se non esiste gia'.
// Il plafond stoccaggio (250.000 kg) resta sul FornitoreSecondaria T-CYCLE (doppio_ruolo).
// Idempotente: se il record esiste gia', aggiorna solo i valori mancanti.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const b = base44.asServiceRole;

    const impianti = await b.entities.ImpiantoTargetSecondaria.list('-created_date', 500);
    const esistente = impianti.find(i => normalizzaRagioneSociale(i.nome_impianto) === 't-cycle');

    if (esistente) {
      const patch = {};
      if (!esistente.target || esistente.target === 0) patch.target = 1050000;
      if (!esistente.totale_capacity_kg || esistente.totale_capacity_kg === 0) patch.totale_capacity_kg = 1300000;
      if (Object.keys(patch).length > 0) {
        await b.entities.ImpiantoTargetSecondaria.update(esistente.id, patch);
      }
      return Response.json({ esiste: true, id: esistente.id, patch_aggiornata: patch });
    }

    const created = await b.entities.ImpiantoTargetSecondaria.create({
      nome_impianto: 'T-CYCLE INDUSTRIES SRL',
      target: 1050000,
      totale_capacity_kg: 1300000,
      data_fine: '2026-12-18',
      stato: 'attivo',
    });

    return Response.json({ esiste: false, creato: true, id: created.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}