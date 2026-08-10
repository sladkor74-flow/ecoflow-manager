import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { PROV_TO_REGION, MESI } from "../../shared/raccoltoCalculator.ts";

// Restituisce i record di dettaglio (drill-down) per una cella di pivot.
// Payload: { source, filters: { raccoglitore?, regione?, classe?, mese?, settimana?, anno?, impianto?, provincia?, ragione_sociale? }, limit?, skip? }
const SOURCE_MAP = { primaria_rete: 'PrimariaRete', primaria_aci: 'PrimariaAci', secondaria: 'Secondaria', assegnato: 'Assegnato' };

const REGION_TO_PROVS = {};
for (const [prov, region] of Object.entries(PROV_TO_REGION)) {
  if (!REGION_TO_PROVS[region]) REGION_TO_PROVS[region] = [];
  REGION_TO_PROVS[region].push(prov);
}

function getSettimana(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { source, filters = {} } = body;
    const entityName = SOURCE_MAP[source];
    if (!entityName) return Response.json({ error: 'source non valido' }, { status: 400 });

    const query = {};
    if (filters.raccoglitore) query.trasportatore = filters.raccoglitore;
    if (filters.impianto) query.destinazione = filters.impianto;
    if (filters.provincia) query.provincia = filters.provincia;
    if (filters.ragione_sociale) query.ragione_sociale = filters.ragione_sociale;
    if (filters.regione) {
      const provs = REGION_TO_PROVS[filters.regione];
      if (provs) query.provincia = { $in: provs };
    }

    const records = await base44.asServiceRole.entities[entityName].filter(query, '-created_date', 400);

    const filtered = records.filter((row) => {
      const data = source === 'assegnato' ? row.ordine_immesso_il : (row.ordine_chiuso_il || row.trasporto_finito_il || row.ordine_immesso_il);
      if (filters.classe) {
        let cls = (row.classe || '').trim();
        if (!cls && row.prodotto) { const m = String(row.prodotto).match(/^([A-Z0-9]{1,3})\s*-/); if (m) cls = m[1]; }
        if ((cls || 'N/D') !== filters.classe) return false;
      }
      if (filters.regione) {
        const r = PROV_TO_REGION[(row.provincia || '').toUpperCase().trim()] || 'Altro';
        if (r !== filters.regione) return false;
      }
      if (filters.mese) {
        const d = data ? new Date(data) : null;
        const m = d && !isNaN(d.getTime()) ? MESI[d.getMonth()] : null;
        if (m !== filters.mese) return false;
      }
      if (filters.anno) {
        const d = data ? new Date(data) : null;
        const a = d && !isNaN(d.getTime()) ? d.getFullYear() : null;
        if (a !== parseInt(filters.anno)) return false;
      }
      if (filters.settimana) {
        const w = getSettimana(data);
        if (w !== parseInt(filters.settimana)) return false;
      }
      return true;
    });

    const total = filtered.length;
    const skip = body.skip || 0;
    const limit = body.limit || 100;
    const paged = filtered.slice(skip, skip + limit);

    return Response.json({ records: paged, total, skip, limit });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}