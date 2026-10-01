import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { formattaPesi } from "../../shared/formatoExcel.ts";
import * as XLSX from 'npm:xlsx@0.18.5';
import { MESI } from "../../shared/raccoltoCalculator.ts";
import { matchesFilter, matchesFilterString } from "../../shared/multiFilter.ts";
import { fetchAll } from "../../shared/fetchAll.ts";

// Esporta i dati Assegnati (dettaglio o matrice aggregata) in Excel.
// Payload: { filters: {...}, mode: 'detail' | 'matrix' }
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const filters = body.filters || {};
    // L'ARCHIVIO E LA MODALITA' SI SCELGONO DA UNA LISTA CHIUSA (02/10/2026).
    //
    // Era lo stesso difetto di computeAssegnatiMatrix, con l'aggravante che qui
    // il risultato torna come file Excel: chiunque fosse collegato poteva
    // nominare ChiusuraPassivaMese o ConsuntivoFornitore e scaricarsi i costi
    // dei fornitori, riservati all'amministratore.
    //
    // NON si aggiunge il controllo dell'amministratore: consultare ed esportare
    // e' quello che tutti possono fare (base44/shared/permessi.ts), e un 403 qui
    // chiuderebbe le pagine Assegnati rete e ACI a chi le usa ogni giorno. Il
    // difetto non era chi chiamava: era che decideva lui quale archivio leggere.
    const ENTITA_AMMESSE = ['Assegnato', 'AssegnatoAci'];
    const MODI_AMMESSI = ['detail', 'matrix'];
    const mode = body.mode || 'detail';
    const entityName = body.entity || 'Assegnato';
    if (!ENTITA_AMMESSE.includes(entityName)) {
      return Response.json({ error: `Archivio non ammesso. Valori validi: ${ENTITA_AMMESSE.join(', ')}` }, { status: 400 });
    }
    if (!MODI_AMMESSI.includes(mode)) {
      return Response.json({ error: `Modalita' non ammessa. Valori validi: ${MODI_AMMESSI.join(', ')}` }, { status: 400 });
    }

    const all = await fetchAll(base44.asServiceRole.entities[entityName]);

    const filtered = all.filter(r => {
      if (!matchesFilterString(r.anno, filters.anno)) return false;
      if (!matchesFilter(r.mese, filters.mese)) return false;
      if (!matchesFilter(r.regione, filters.regione)) return false;
      if (!matchesFilter((r.provincia || '').toUpperCase().trim(), filters.provincia)) return false;
      if (!matchesFilter((r.partner_operativo || '').trim(), filters.partner_operativo)) return false;
      if (!matchesFilter(r.classe, filters.classe)) return false;
      return true;
    });

    const wb = XLSX.utils.book_new();

    if (mode === 'matrix') {
      const matrix: Record<string, any> = {};
      for (const r of filtered) {
        const anno = String(r.anno || 'N/D');
        const meseIdx = r.mese ? MESI.indexOf(r.mese) : -1;
        const semestre = meseIdx < 0 ? 'N/D' : (meseIdx < 6 ? '1° Semestre' : '2° Semestre');
        const regione = r.regione || 'N/D';
        const provincia = (r.provincia || 'N/D').toUpperCase().trim();
        const key = `${anno}|${semestre}|${regione}|${provincia}`;
        if (!matrix[key]) matrix[key] = { Anno: anno, Semestre: semestre, Regione: regione, Provincia: provincia, 'N. Ordini': 0, 'Peso Stimato (kg)': 0, 'Peso Stimato (t)': 0, 'Quantità Richiesta': 0 };
        matrix[key]['N. Ordini']++;
        matrix[key]['Peso Stimato (kg)'] += (r.peso_stimato || 0);
        matrix[key]['Peso Stimato (t)'] += (r.peso_stimato || 0) / 1000;
        matrix[key]['Quantità Richiesta'] += (r.quantita_richiesta || 0);
      }
      const ws = XLSX.utils.json_to_sheet(Object.values(matrix));
      XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws), 'Matrice Aggregata');
    } else {
      const rows = filtered.map(r => ({
        'ID Ordine': r.id_ordine,
        'Stato': r.stato,
        'Ordine Immesso': r.ordine_immesso_il ? new Date(r.ordine_immesso_il).toLocaleDateString('it-IT') : '',
        'Ragione Sociale': r.ragione_sociale,
        'Comune': r.comune,
        'Provincia': r.provincia,
        'Regione': r.regione,
        'Classe PFU': r.classe,
        'Prodotto': r.prodotto,
        'Quantità Richiesta': r.quantita_richiesta,
        'Peso Stimato (kg)': r.peso_stimato,
        'Peso Stimato (t)': (r.peso_stimato || 0) / 1000,
        'Mese Immissione': r.mese,
        'Anno Immissione': r.anno,
        'Partner Operativo': r.partner_operativo,
        'Trasportatore': r.trasportatore,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws), 'Dettaglio Assegnati');
    }

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    return Response.json({
      file_base64: buf,
      filename: `${entityName.toLowerCase()}_${mode}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      count: filtered.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}