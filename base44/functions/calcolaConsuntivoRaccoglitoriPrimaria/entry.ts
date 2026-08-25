import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const SOGLIA_CONFORME = 0.05; // 5% di tolleranza

// Calcola il consuntivo reale dei raccoglitori della fase primaria aggregando
// PrimariaRete + PrimariaAci per raccoglitore (trasportatore normalizzato) e mese,
// confrontandolo con i target mensili inseriti in TargetRaccoglitorePrimaria.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const b = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const anno = Number(body.anno) || new Date().getFullYear();

    const [targets, primarieRete, primarieAci] = await Promise.all([
      b.entities.TargetRaccoglitorePrimaria.filter({ anno }, '-created_date', 5000),
      b.entities.PrimariaRete.list('-created_date', 10000),
      b.entities.PrimariaAci.list('-created_date', 10000),
    ]);

    // Aggrega raccolto per raccoglitore normalizzato + mese
    const raccoltoMap = {}; // normRacc -> { mese -> kg }

    const aggregate = (records) => {
      for (const r of records) {
        const stato = String(r.stato || '').toLowerCase().trim();
        if (stato !== 'terminato') continue;
        if (!r.trasporto_finito_il) continue;
        const racc = normalizzaRagioneSociale(r.trasportatore);
        if (!racc) continue;
        const d = new Date(r.trasporto_finito_il);
        const mese = MESI[d.getMonth()];
        if (!raccoltoMap[racc]) raccoltoMap[racc] = {};
        raccoltoMap[racc][mese] = (raccoltoMap[racc][mese] || 0) + (r.peso_effettivo || 0);
      }
    };
    aggregate(primarieRete);
    aggregate(primarieAci);

    // Mappa target per raccoglitore normalizzato + mese
    const result = [];
    const targetByNorm = {}; // normRacc -> { mese -> target record }
    for (const t of targets) {
      const norm = normalizzaRagioneSociale(t.raccoglitore);
      if (!targetByNorm[norm]) targetByNorm[norm] = {};
      targetByNorm[norm][t.mese] = t;
    }

    // Costruisci risultato: un riga per target
    for (const t of targets) {
      const norm = normalizzaRagioneSociale(t.raccoglitore);
      const raccolto = (raccoltoMap[norm] && raccoltoMap[norm][t.mese]) || 0;
      const delta = raccolto - (t.target_kg || 0);
      let stato = 'senza_dati';
      if (raccolto > 0) {
        if (Math.abs(delta) <= (t.target_kg || 0) * SOGLIA_CONFORME) stato = 'conforme';
        else if (delta > 0) stato = 'in_anticipo';
        else stato = 'in_ritardo';
      }
      result.push({
        id: t.id,
        raccoglitore: t.raccoglitore,
        raccoglitore_normalizzato: norm,
        mese: t.mese,
        anno: t.anno,
        target_kg: t.target_kg || 0,
        raccolto_kg: raccolto,
        delta_kg: delta,
        stato,
        consuntivato: !!t.consuntivato,
      });
    }

    // Raccoglitori presenti nei target ma senza alcun record consuntivato
    const raccTargetNorms = new Set(targets.map(t => normalizzaRagioneSociale(t.raccoglitore)));
    const senzaDati = Array.from(raccTargetNorms).filter(n => !raccoltoMap[n]);

    return Response.json({
      anno,
      righe: result,
      senza_dati: senzaDati,
      totale_target: targets.reduce((s, t) => s + (t.target_kg || 0), 0),
      totale_raccolto: result.reduce((s, r) => s + r.raccolto_kg, 0),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}