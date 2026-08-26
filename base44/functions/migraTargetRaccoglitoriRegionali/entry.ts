import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';

// Migrazione una-tantum dei target annuali raccoglitori:
// 1. Elimina i record TargetRaccoglitore il cui nome coincide con un impianto doppio ruolo
//    (T-CYCLE e' una quota impianto, non un raccoglitore).
// 2. Per i raccoglitori multi-regione noti (SMOCO), crea 3 record regionali
//    (Puglia/Calabria/Basilicata) se non esistono gia', e elimina il record singolo.
// Le quote regionali partono da 0 e sono editabili in Target Annuali.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const b = base44.asServiceRole;

    const ANNO = 2026;
    const REGIONI_SMOCO = ['Puglia', 'Calabria', 'Basilicata'];

    const [targets, fornitori] = await Promise.all([
      b.entities.TargetRaccoglitore.filter({ anno: ANNO }, '-created_date', 1000),
      b.entities.FornitoreSecondaria.list('-created_date', 1000),
    ]);

    // Nomi normalizzati degli impianti doppio ruolo (da escludere dai raccoglitori)
    const doubleRoleNorms = new Set(
      fornitori
        .filter(f => f.ruolo === 'doppio_ruolo')
        .map(f => normalizzaRagioneSociale(f.nome))
    );

    const dettaglio = { eliminati_quote_impianto: [], smoco_regionali_creati: [], smoco_singolo_eliminato: false };

    // 1. Elimina record raccoglitori che sono in realta' quote impianto (doppio ruolo)
    const toDelete = [];
    for (const t of targets) {
      const norm = normalizzaRagioneSociale(t.raccoglitore);
      if (doubleRoleNorms.has(norm)) {
        toDelete.push(t);
        dettaglio.eliminati_quote_impianto.push({ raccoglitore: t.raccoglitore, target: t.target_tonnellate });
      }
    }
    for (const t of toDelete) {
      await b.entities.TargetRaccoglitore.delete(t.id);
      await new Promise(r => setTimeout(r, 150));
    }

    // 2. Split regionale SMOCO
    const smocoNorm = normalizzaRagioneSociale('SMOCO S.r.l.');
    const smocoRecords = targets.filter(t => normalizzaRagioneSociale(t.raccoglitore) === smocoNorm);
    const smocoSingolo = smocoRecords.find(t => !t.regione);
    const existingRegional = smocoRecords.filter(t => t.regione);

    // Crea regionali mancanti (se non esiste gia' uno per quella regione)
    const existingRegioni = new Set(existingRegional.map(t => t.regione));
    const toCreate = [];
    for (const reg of REGIONI_SMOCO) {
      if (!existingRegioni.has(reg)) {
        toCreate.push({ raccoglitore: 'SMOCO S.r.l.', regione: reg, anno: ANNO, target_tonnellate: 0 });
      }
    }
    if (toCreate.length > 0) {
      const created = await b.entities.TargetRaccoglitore.bulkCreate(toCreate);
      dettaglio.smoco_regionali_creati = toCreate.map(c => c.regione);
    }

    // Elimina il record Smoco singolo se esistono gia' (o sono appena stati creati) gli split regionali
    if (smocoSingolo) {
      await b.entities.TargetRaccoglitore.delete(smocoSingolo.id);
      dettaglio.smoco_singolo_eliminato = true;
      dettaglio.smoco_singolo_valore = smocoSingolo.target_tonnellate;
    }

    return Response.json({
      anno: ANNO,
      eliminati_quote_impianto: toDelete.length,
      smoco_regionali_creati: toCreate.length,
      smoco_singolo_eliminato: dettaglio.smoco_singolo_eliminato,
      dettaglio,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}