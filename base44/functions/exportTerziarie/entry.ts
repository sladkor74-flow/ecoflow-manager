import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';

// Esporta i dati terziarie filtrati in Excel.
// Payload: { filters: { impianto?, destinazione?, mese?, trasportatore?, materiale?, anno? } }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const filters = body.filters || {};

    const records = await base44.asServiceRole.entities.Terziaria.list('-created_date', 10000);

    const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
    function getMese(r) {
      if (r.mese) return r.mese;
      const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
      if (!d) return null;
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? null : MESI[dt.getMonth()];
    }
    function getMateriale(r) {
      if (r.peso_ciab_cipp) return 'CIAB/CIPP';
      if (r.ferro) return 'FERRO';
      return 'PFU SFUSO';
    }

    const filtered = records.filter((r) => {
      if (filters.impianto && (r.unita_locale_origine || '').trim() !== filters.impianto) return false;
      if (filters.destinazione && (r.destinazione || '').trim() !== filters.destinazione) return false;
      if (filters.mese && getMese(r) !== filters.mese) return false;
      if (filters.trasportatore && (r.trasportatore || '').trim() !== filters.trasportatore) return false;
      if (filters.materiale && getMateriale(r) !== filters.materiale) return false;
      return true;
    });

    const rows = filtered.map((r) => ({
      'ID Ordine': r.id_ordine,
      'Stato': r.stato,
      'Ordine immesso il': r.ordine_immesso_il,
      'Impianto Origine': r.unita_locale_origine,
      'Ragione Sociale': r.ragione_sociale,
      'Destinazione': r.destinazione,
      'Tipo Destinazione': r.tipo_destinazione,
      'Comune': r.comune,
      'Provincia': r.provincia,
      'CER': r.cer,
      'Quantita ritirata': r.quantita_ritirata,
      'Peso stimato (kg)': r.peso_stimato,
      'Peso effettivo (kg)': r.peso_effettivo,
      'Peso (t)': +((r.peso_effettivo || 0) / 1000).toFixed(2),
      'Materiale': getMateriale(r),
      'Mese': getMese(r),
      'Trasportatore': r.trasportatore,
      'Partner Operativo': r.partner_operativo,
      'Numero FIR': r.numero_fir,
      'Trasporto iniziato il': r.trasporto_iniziato_il,
      'Trasporto finito il': r.trasporto_finito_il,
      'Ordine chiuso il': r.ordine_chiuso_il,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Terziarie');

    const buf = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    return Response.json({ file_base64: buf, filename: 'terziarie_export.xlsx', righe: rows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}