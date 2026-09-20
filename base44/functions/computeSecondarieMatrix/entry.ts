import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { annoOrdine, giornoOrdine, eTerminato } from "../../shared/movimenti.ts";
import { MESI } from "../../shared/raccoltoCalculator.ts";
import { getRegioneFromProvincia } from "../../shared/dataEnrichment.ts";
import { matchesFilter, matchesFilterString, matchesFilterLower } from "../../shared/multiFilter.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { canaleDi } from "../../shared/canaleSecondaria.ts";

// Calcola le matrici di aggregazione dei trasporti secondari per tratta.
// Payload: { filters: { canale?, stoccaggio?, destinazione?, mese?, settimana?, classe?, trasportatore?, anno? } }
//
// Rete e ACI sono canali indipendenti e nello stesso archivio: il filtro canale
// serve a guardarli separati, e i totali per canale tornano sempre nella
// risposta, cosi' si vede subito quando una vista li comprende entrambi.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const filters = body.filters || {};

    const all = await fetchAll(base44.asServiceRole.entities.Secondaria);

    // Applica filtri (supporto multi-selezione via array)
    const filtrati = all.filter(r => {
      if (!matchesFilter(canaleDi(r) === 'ACI' ? 'ACI' : 'Rete', filters.canale)) return false;
      if (!matchesFilter((r.stoccaggio || '').trim(), filters.stoccaggio)) return false;
      if (!matchesFilter((r.destinazione || '').trim(), filters.destinazione)) return false;
      if (!matchesFilter(r.mese, filters.mese)) return false;
      if (!matchesFilterString(r.settimane, filters.settimana)) return false;
      if (!matchesFilter(r.classe, filters.classe)) return false;
      if (!matchesFilter((r.trasportatore || '').trim(), filters.trasportatore)) return false;
      if (!matchesFilter((r.provincia || '').trim(), filters.provincia)) return false;
      if (filters.regione != null && (!Array.isArray(filters.regione) ? filters.regione : filters.regione.length > 0)) {
        const reg = r.regione || getRegioneFromProvincia(r.provincia);
        if (!matchesFilter((reg || '').trim(), filters.regione)) return false;
      }
      if (!matchesFilterLower(r.stato, filters.stato)) return false;
      if (filters.data) {
        if (giornoOrdine(r) !== filters.data) return false;
      }
      if (filters.anno != null && (!Array.isArray(filters.anno) ? filters.anno : filters.anno.length > 0)) {
        const anno = annoOrdine(r);
        if (!matchesFilterString(anno, filters.anno)) return false;
      }
      return true;
    });

    // KPI
    // I conteggi e la matrice parlano di trasporti fatti: senza un filtro sullo stato
    // contano solo i terminati. Prima entravano anche i cancellati, e il numero dei
    // trasporti secondari non tornava con nessun altro modulo.
    const conStato = Array.isArray(filters.stato) ? filters.stato.length > 0 : !!filters.stato;
    const filtered = conStato ? filtrati : filtrati.filter(eTerminato);
    let total_orders = filtered.length;
    let total_peso_kg = 0;
    let total_quantita = 0;
    const byMese: Record<string, any> = {};
    const byClasse: Record<string, any> = {};
    const byTratta: Record<string, any> = {};

    for (const r of filtered) {
      const peso = r.peso_effettivo || 0;
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
      // La tratta e' per canale: una riga non somma mai rete e autodemolizione.
      const canale = canaleDi(r) === 'ACI' ? 'ACI' : 'Rete';
      const trattaKey = `${canale} | ${origine} -> ${dest}`;
      if (!byTratta[trattaKey]) {
        byTratta[trattaKey] = { canale, origine, destinazione: dest, ordini: 0, peso_kg: 0, quantita: 0, trasportatore: r.trasportatore || '', partner: r.partner_operativo || '' };
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
      const canale = canaleDi(r) === 'ACI' ? 'ACI' : 'Rete';
      const trattaKey = `${canale} | ${origine} -> ${dest}`;
      const mese = r.mese || 'N/D';
      const classe = r.classe || 'N/D';
      const settimana = r.settimane || 'N/D';

      if (!matrix[trattaKey]) matrix[trattaKey] = { canale, origine, destinazione: dest, mesi: {}, classi: {}, settimane: {} };
      const m = matrix[trattaKey];
      if (!m.mesi[mese]) m.mesi[mese] = { ordini: 0, peso_kg: 0, quantita: 0 };
      m.mesi[mese].ordini++;
      m.mesi[mese].peso_kg += (r.peso_effettivo || 0);
      m.mesi[mese].quantita += (r.quantita_ritirata || 0);

      if (!m.classi[classe]) m.classi[classe] = { ordini: 0, peso_kg: 0, quantita: 0 };
      m.classi[classe].ordini++;
      m.classi[classe].peso_kg += (r.peso_effettivo || 0);
      m.classi[classe].quantita += (r.quantita_ritirata || 0);

      const settKey = String(settimana);
      if (!m.settimane[settKey]) m.settimane[settKey] = { ordini: 0, peso_kg: 0, quantita: 0 };
      m.settimane[settKey].ordini++;
      m.settimane[settKey].peso_kg += (r.peso_effettivo || 0);
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
      province: [...new Set(all.map(r => (r.provincia || '').trim()).filter(Boolean))].sort(),
      regioni: [...new Set(all.map(r => (r.regione || getRegioneFromProvincia(r.provincia) || '').trim()).filter(Boolean))].sort(),
      stati: [...new Set(all.map(r => (r.stato || '').trim()).filter(Boolean))].sort(),
      canali: ['Rete', 'ACI'].filter(c => all.some(r => (canaleDi(r) === 'ACI' ? 'ACI' : 'Rete') === c)),
      anni: [...new Set(all.map(r => {
        return annoOrdine(r);
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
      canali: ['Rete', 'ACI'].map(c => {
        const righe = filtered.filter(r => (canaleDi(r) === 'ACI' ? 'ACI' : 'Rete') === c);
        return { canale: c, ordini: righe.length, peso_kg: righe.reduce((s, r) => s + (r.peso_effettivo || 0), 0) };
      }).filter(c => c.ordini > 0),
      filterOptions,
      filteredCount: filtered.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}