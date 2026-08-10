import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { MESI } from "../../shared/raccoltoCalculator.ts";

// Calcola la matrice analitica aggregata del backlog degli ordini Assegnati.
// Payload: { filters: { anno?, mese?, regione?, provincia?, partner_operativo?, classe? } }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const filters = body.filters || {};

    const all = await base44.asServiceRole.entities.Assegnato.list('-created_date', 10000);

    // Applica filtri
    const filtered = all.filter(r => {
      if (filters.anno && String(r.anno) !== String(filters.anno)) return false;
      if (filters.mese && r.mese !== filters.mese) return false;
      if (filters.regione && r.regione !== filters.regione) return false;
      if (filters.provincia && (r.provincia || '').toUpperCase().trim() !== filters.provincia) return false;
      if (filters.partner_operativo && (r.partner_operativo || '').trim() !== filters.partner_operativo) return false;
      if (filters.classe && r.classe !== filters.classe) return false;
      return true;
    });

    // KPI
    let total_orders = filtered.length;
    let total_peso_kg = 0;
    let total_quantita = 0;
    let sem1_ton = 0, sem2_ton = 0;
    const byProvince: Record<string, any> = {};

    for (const r of filtered) {
      const peso = r.peso_stimato || 0;
      const quant = r.quantita_richiesta || 0;
      total_peso_kg += peso;
      total_quantita += quant;

      const meseIdx = r.mese ? MESI.indexOf(r.mese) : -1;
      if (meseIdx >= 0 && meseIdx < 6) sem1_ton += peso / 1000;
      else if (meseIdx >= 6) sem2_ton += peso / 1000;

      const prov = (r.provincia || 'N/D').toUpperCase().trim();
      if (!byProvince[prov]) byProvince[prov] = { provincia: prov, regione: r.regione || '', ordini: 0, peso_kg: 0, quantita: 0 };
      byProvince[prov].ordini++;
      byProvince[prov].peso_kg += peso;
      byProvince[prov].quantita += quant;
    }

    // Matrice: Anno -> Semestre -> Regione -> Provincia
    const matrix: Record<string, any> = {};
    for (const r of filtered) {
      const anno = String(r.anno || 'N/D');
      const meseIdx = r.mese ? MESI.indexOf(r.mese) : -1;
      const semestre = meseIdx < 0 ? 'N/D' : (meseIdx < 6 ? '1° Semestre' : '2° Semestre');
      const regione = r.regione || 'N/D';
      const provincia = (r.provincia || 'N/D').toUpperCase().trim();

      if (!matrix[anno]) matrix[anno] = {};
      if (!matrix[anno][semestre]) matrix[anno][semestre] = {};
      if (!matrix[anno][semestre][regione]) matrix[anno][semestre][regione] = {};
      if (!matrix[anno][semestre][regione][provincia]) {
        matrix[anno][semestre][regione][provincia] = { ordini: 0, peso_kg: 0, quantita: 0 };
      }
      matrix[anno][semestre][regione][provincia].ordini++;
      matrix[anno][semestre][regione][provincia].peso_kg += (r.peso_stimato || 0);
      matrix[anno][semestre][regione][provincia].quantita += (r.quantita_richiesta || 0);
    }

    // Flatten per frontend
    const flatMatrix: any[] = [];
    for (const [anno, semestri] of Object.entries(matrix)) {
      for (const [semestre, regioni] of Object.entries(semestri)) {
        for (const [regione, province] of Object.entries(regioni)) {
          for (const [provincia, metrics] of Object.entries(province)) {
            flatMatrix.push({ anno, semestre, regione, provincia, ...metrics });
          }
        }
      }
    }

    // Ranking province
    const provinceRanking = Object.values(byProvince)
      .map((p: any) => ({ ...p, peso_t: p.peso_kg / 1000 }))
      .sort((a: any, b: any) => b.ordini - a.ordini);

    // Opzioni filtri
    const filterOptions = {
      anni: [...new Set(all.map(r => r.anno).filter(Boolean))].sort((a: any, b: any) => b - a),
      mesi: MESI.filter(m => all.some(r => r.mese === m)),
      regioni: [...new Set(all.map(r => r.regione).filter(Boolean))].sort(),
      province: [...new Set(all.map(r => (r.provincia || '').toUpperCase().trim()).filter(Boolean))].sort(),
      partner: [...new Set(all.map(r => (r.partner_operativo || '').trim()).filter(Boolean))].sort(),
      classi: [...new Set(all.map(r => r.classe).filter(Boolean))].sort(),
    };

    return Response.json({
      kpi: {
        total_orders,
        total_ton: total_peso_kg / 1000,
        total_quantita: total_quantita,
        sem1_ton,
        sem2_ton,
      },
      matrix: flatMatrix,
      provinceRanking,
      filterOptions,
      filteredCount: filtered.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}