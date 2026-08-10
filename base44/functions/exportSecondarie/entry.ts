import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';

// Esporta i dati Secondarie (dettaglio o matrice per tratta) in Excel.
// Payload: { filters: {...}, mode: 'detail' | 'matrix' }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const filters = body.filters || {};
    const mode = body.mode || 'detail';

    const all = await base44.asServiceRole.entities.Secondaria.list('-created_date', 10000);

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

    const wb = XLSX.utils.book_new();

    if (mode === 'matrix') {
      // Foglio: sintesi per tratta
      const trattaMap: Record<string, any> = {};
      for (const r of filtered) {
        const origine = (r.stoccaggio || 'N/D').trim();
        const dest = (r.destinazione || 'N/D').trim();
        const key = `${origine}|${dest}`;
        if (!trattaMap[key]) trattaMap[key] = { 'Stoccaggio Origine': origine, 'Impianto Destinazione': dest, 'N. Ordini': 0, 'Peso (kg)': 0, 'Peso (t)': 0, 'Quantità': 0, 'Trasportatore': r.trasportatore || '', 'Partner Operativo': r.partner_operativo || '' };
        trattaMap[key]['N. Ordini']++;
        trattaMap[key]['Peso (kg)'] += (r.peso_effettivo || r.peso_stimato || 0);
        trattaMap[key]['Peso (t)'] += (r.peso_effettivo || r.peso_stimato || 0) / 1000;
        trattaMap[key]['Quantità'] += (r.quantita_ritirata || 0);
      }
      const wsTratte = XLSX.utils.json_to_sheet(Object.values(trattaMap));
      XLSX.utils.book_append_sheet(wb, wsTratte, 'Sintesi per Tratta');

      // Foglio: sintesi per classe
      const classeMap: Record<string, any> = {};
      for (const r of filtered) {
        const c = r.classe || 'N/D';
        if (!classeMap[c]) classeMap[c] = { 'Classe PFU': c, 'N. Ordini': 0, 'Peso (kg)': 0, 'Peso (t)': 0, 'Quantità': 0 };
        classeMap[c]['N. Ordini']++;
        classeMap[c]['Peso (kg)'] += (r.peso_effettivo || r.peso_stimato || 0);
        classeMap[c]['Peso (t)'] += (r.peso_effettivo || r.peso_stimato || 0) / 1000;
        classeMap[c]['Quantità'] += (r.quantita_ritirata || 0);
      }
      const wsClassi = XLSX.utils.json_to_sheet(Object.values(classeMap));
      XLSX.utils.book_append_sheet(wb, wsClassi, 'Sintesi per Classe');
    } else {
      const rows = filtered.map(r => ({
        'ID Ordine': r.id_ordine,
        'Stato': r.stato,
        'Ordine Immesso': r.ordine_immesso_il ? new Date(r.ordine_immesso_il).toLocaleDateString('it-IT') : '',
        'Stoccaggio Origine': r.stoccaggio,
        'Destinazione': r.destinazione,
        'Tipo Destinazione': r.tipo_destinazione,
        'Comune': r.comune,
        'Provincia': r.provincia,
        'Classe PFU': r.classe,
        'CER': r.cer,
        'Quantità Ritirata': r.quantita_ritirata,
        'Peso Stimato (kg)': r.peso_stimato,
        'Peso Effettivo (kg)': r.peso_effettivo,
        'Peso (t)': (r.peso_effettivo || r.peso_stimato || 0) / 1000,
        'Mese': r.mese,
        'Settimana': r.settimane,
        'Trasportatore': r.trasportatore,
        'Partner Operativo': r.partner_operativo,
        'Fatturato Trasporto': r.fatturato_trasporto,
        'Fatturato Riciclo': r.fatturato_riciclo,
        'Numero FIR': r.numero_fir,
        'Ordine Chiuso': r.ordine_chiuso_il ? new Date(r.ordine_chiuso_il).toLocaleDateString('it-IT') : '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Dettaglio Secondarie');
    }

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    return Response.json({
      file_base64: buf,
      filename: `secondarie_${mode}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      count: filtered.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}