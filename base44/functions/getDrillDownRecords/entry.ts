import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { PROV_TO_REGION, MESI } from "../../shared/raccoltoCalculator.ts";
import { getMeseFromDate, getSettimanaFromDate, getAnnoFromDate, getRegioneFromProvincia, getClasseFromProdotto } from "../../shared/dataEnrichment.ts";
import { matchesFilter } from "../../shared/multiFilter.ts";

// Restituisce i record di dettaglio (drill-down) per una cella di pivot.
// Payload: { source, filters: { raccoglitore?, regione?, classe?, mese?, settimana?, anno?, impianto?, provincia?, ragione_sociale? }, limit?, skip? }
const SOURCE_MAP = { primaria_rete: 'PrimariaRete', primaria_aci: 'PrimariaAci', secondaria: 'Secondaria', assegnato: 'Assegnato' };

const REGION_TO_PROVS = {};
for (const [prov, region] of Object.entries(PROV_TO_REGION)) {
  if (!REGION_TO_PROVS[region]) REGION_TO_PROVS[region] = [];
  REGION_TO_PROVS[region].push(prov);
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
    const toArray = (v) => Array.isArray(v) ? v : (v != null ? [v] : []);
    if (filters.raccoglitore) {
      const arr = toArray(filters.raccoglitore);
      if (arr.length > 0) query.trasportatore = arr.length === 1 ? arr[0] : { $in: arr };
    }
    if (filters.impianto) {
      const arr = toArray(filters.impianto);
      if (arr.length > 0) query.destinazione = arr.length === 1 ? arr[0] : { $in: arr };
    }
    if (filters.provincia) {
      const arr = toArray(filters.provincia);
      if (arr.length > 0) query.provincia = arr.length === 1 ? arr[0] : { $in: arr };
    }
    if (filters.ragione_sociale) query.ragione_sociale = filters.ragione_sociale;
    if (filters.regione) {
      const regioni = toArray(filters.regione);
      const allProvs = regioni.flatMap(r => REGION_TO_PROVS[r] || []);
      if (allProvs.length > 0) query.provincia = allProvs.length === 1 ? allProvs[0] : { $in: allProvs };
    }

    const records = await base44.asServiceRole.entities[entityName].filter(query, '-created_date', 400);

    const filtered = records.filter((row) => {
      const data = source === 'assegnato' ? row.ordine_immesso_il : (row.ordine_chiuso_il || row.trasporto_finito_il || row.ordine_immesso_il);
      if (filters.classe) {
        const cls = (row.classe || '').trim() || getClasseFromProdotto(row.prodotto) || 'N/D';
        if (!matchesFilter(cls, filters.classe)) return false;
      }
      if (filters.regione) {
        const r = (row.regione || '').trim() || getRegioneFromProvincia(row.provincia) || 'Altro';
        if (!matchesFilter(r, filters.regione)) return false;
      }
      if (filters.mese) {
        const m = (row.mese || '').trim() || getMeseFromDate(data);
        if (!matchesFilter(m, filters.mese)) return false;
      }
      if (filters.anno) {
        const a = row.anno != null ? row.anno : getAnnoFromDate(data);
        const anni = toArray(filters.anno).map(Number);
        if (anni.length > 0 && !anni.includes(a)) return false;
      }
      if (filters.settimana) {
        const w = row.settimane != null ? row.settimane : getSettimanaFromDate(data);
        const setts = toArray(filters.settimana).map(Number);
        if (setts.length > 0 && !setts.includes(w)) return false;
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