import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { MESI } from "../../shared/raccoltoCalculator.ts";

// Calcola le matrici di aggregazione dei trasporti secondari per tratta.
// Payload: { filters: { stoccaggio?, destinazione?, mese?, settimana?, classe?, trasportatore?, anno? } }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const filters = body.filters || {};

    const all = await base44.asServiceRole.entities.Secondaria.list('-created_date', 10000);

    // Applica filtri
    const filtered = all.filter(r => {
      if (filters.stoccaggio && (r.stoccaggio || '').trim() !== filters.stoccaggio) return false;
      if (filters.destinazione && (r.destinazione || '').trim() !== filters.destinazione) return false;
      if (filters.mese && r.mese !== filters.mese) return false;
      if (filters.settimana && String(r.settimane) !== String(filters.settimana)) return false;
      if (filters.classe && r.classe !== filters.classe) return false;
      if (filters.trasportatore && (r.trasportatore || '').trim() !== filters.trasportatore) return false;
      if (filters.anno) {
        const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
        const dt = d ? new Date(d) : null;
        const anno = dt && !isNaN(dt.getTime()) ? dt.getFullYear() : null;
        if (String(anno) !== String(filters.anno)) return false;
      }
      return true;
    });

    // KPI
    let total_orders = filtered.length;
    let total_peso_kg = 0;
    let total_quantita = 0;
    const byMese: Record<string, any> = {};
    const byClasse: Record<string, any> = {};
    const byTratta: Record<string, any> = {};

    for (const r of filtered) {
      const peso = r.peso_effettivo || r.peso_stimato || 0;
      const quant = r.quantita_ritirata || 0;
      total_peso_kg += peso;
      total_quantita += quant;

      const mese = r.mese || 'N/D';
      if (!byMese[mese]) byMese[mese] = { mese, ordini: 0, peso_kg: 0, quantita: 0 };
      byMese[mese].ordini++;
      byMese[mese].peso_kg += peso;
      byMese[mese].quantita += quant;

      const classe = r.classe || 'N/D';
      if (!byClasse[classe]) byClasse[classe] = { classe, ordini: 0, peso_kg: 0, quantita: 0 };
      byClasse[classe].ordini++;
      byClasse[classe].peso_kg += peso;
      byClasse[classe].quantita += quant;

      const origine = (r.stoccaggio || 'N/D').trim();
      const dest = (r.destinazione || 'N/D').trim();
      const trattaKey = `${origine} -> ${dest}`;
      if (!byTratta[trattaKey]) {
        byTratta[trattaKey] = { origine, destinazione: dest, ordini: 0, peso_kg: 0, quantita: 0, trasportatore: r.trasportatore || '', partner: r.partner_operativo || '' };
      }
      byTratta[trattaKey].ordini++;
      byTratta[trattaKey].peso_kg += peso;
      byTratta[trattaKey].quantita += quant;
    }

    // Matrice dettagliata per tratta -> mese -> classe
    const matrix: Record<string, any> = {};
    for (const r of filtered) {
      const origine = (r.stoccaggio || 'N/D').trim();
      const dest = (r.destinazione || 'N/D').trim();
      const trattaKey = `${origine} -> ${dest}`;
      const mese = r.mese || 'N/D';
      const classe = r.classe || 'N/D';
      const settimana = r.settimane || 'N/D';

      if (!matrix[trattaKey]) matrix[trattaKey] = { origine, destinazione: dest, mesi: {}, classi: {}, settimane: {} };
      const m = matrix[trattaKey];
      if (!m.mesi[mese]) m.mesi[mese] = { ordini: 0, peso_kg: 0, quantita: 0 };
      m.mesi[mese].ordini++;
      m.mesi[mese].peso_kg += (r.peso_effettivo || r.peso_stimato || 0);
      m.mesi[mese].quantita += (r.quantita_ritirata || 0);

      if (!m.classi[classe]) m.classi[classe] = { ordini: 0, peso_kg: 0, quantita: 0 };
      m.classi[classe].ordini++;
      m.classi[classe].peso_kg += (r.peso_effettivo || r.peso_stimato || 0);
      m.classi[classe].quantita += (r.quantita_ritirata || 0);

      const settKey = String(settimana);
      if (!m.settimane[settKey]) m.settimane[settKey] = { ordini: 0, peso_kg: 0, quantita: 0 };
      m.settimane[settKey].ordini++;
      m.settimane[settKey].peso_kg += (r.peso_effettivo || r.peso_stimato || 0);
      m.settimane[settKey].quantita += (r.quantita_ritirata || 0);
    }

    // Opzioni filtri
    const filterOptions = {
      stoccaggi: [...new Set(all.map(r => (r.stoccaggio || '').trim()).filter(Boolean))].sort(),
      destinazioni: [...new Set(all.map(r => (r.destinazione || '').trim()).filter(Boolean))].sort(),
      mesi: MESI.filter(m => all.some(r => r.mese === m)),
      settimane: [...new Set(all.map(r => r.settimane).filter(Boolean))].sort((a: any, b: any) => a - b),
      classi: [...new Set(all.map(r => r.classe).filter(Boolean))].sort(),
      trasportatori: [...new Set(all.map(r => (r.trasportatore || '').trim()).filter(Boolean))].sort(),
      anni: [...new Set(all.map(r => {
        const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
        if (!d) return null;
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? null : dt.getFullYear();
      }).filter(Boolean))].sort((a: any, b: any) => b - a),
    };

    return Response.json({
      kpi: {
        total_orders,
        total_ton: total_peso_kg / 1000,
        total_quantita: total_quantita,
      },
      byMese: Object.values(byMese),
      byClasse: Object.values(byClasse),
      byTratta: Object.values(byTratta).sort((a: any, b: any) => b.peso_kg - a.peso_kg),
      matrix: Object.values(matrix),
      filterOptions,
      filteredCount: filtered.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}