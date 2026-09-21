import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { annoOrdine, giornoOrdine, meseOrdine, settimanaIso, eTerminato } from "../../shared/movimenti.ts";
import { giornoRoma } from "../../shared/giornoItaliano.ts";
import { getRegioneFromProvincia } from "../../shared/dataEnrichment.ts";
import { formattaPesi } from "../../shared/formatoExcel.ts";
import * as XLSX from 'npm:xlsx@0.18.5';
import { matchesFilter, matchesFilterString, matchesFilterLower } from "../../shared/multiFilter.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { canaleDi } from "../../shared/canaleSecondaria.ts";

// Esporta i dati Secondarie (dettaglio o matrice per tratta) in Excel.
// Payload: { filters: {...}, mode: 'detail' | 'matrix' }
//
// Rete e ACI sono canali indipendenti: il filtro del modulo vale anche qui, e
// nessuna riga di sintesi somma mai i due canali - la tratta e la classe sono per
// canale e la colonna Canale c'e' sempre.
//
// La data che conta e' la fine del trasporto, sul giorno italiano: e' la prima
// colonna di date del dettaglio, e mese e settimana si leggono da li'
// (movimenti.ts), non dai campi salvati sul record. La chiusura a portale resta
// in fondo, solo come informazione.

// Il giorno italiano come 'GG/MM/AAAA'. toLocaleDateString sul server (UTC)
// scriveva il giorno prima per le date salvate a mezzanotte italiana.
const dataIt = (v) => { const g = giornoRoma(v); return g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : ''; };

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const filters = body.filters || {};
    const mode = body.mode || 'detail';

    const all = await fetchAll(base44.asServiceRole.entities.Secondaria);

    // Gli stessi filtri della pagina (Secondarie.jsx e computeSecondarieMatrix):
    // prima provincia, regione, stato e giorno si perdevano, e il file diceva
    // un'altra cosa rispetto allo schermo.
    const filtered = all.filter(r => {
      if (!matchesFilter(canaleDi(r) === 'ACI' ? 'ACI' : 'Rete', filters.canale)) return false;
      if (!matchesFilter((r.stoccaggio || '').trim(), filters.stoccaggio)) return false;
      if (!matchesFilter((r.destinazione || '').trim(), filters.destinazione)) return false;
      if (!matchesFilter(meseOrdine(r), filters.mese)) return false;
      if (!matchesFilterString(settimanaIso(giornoOrdine(r)), filters.settimana)) return false;
      if (!matchesFilter(r.classe, filters.classe)) return false;
      if (!matchesFilter((r.trasportatore || '').trim(), filters.trasportatore)) return false;
      if (!matchesFilter((r.provincia || '').trim(), filters.provincia)) return false;
      if (filters.regione != null && (!Array.isArray(filters.regione) ? filters.regione : filters.regione.length > 0)) {
        const reg = r.regione || getRegioneFromProvincia(r.provincia);
        if (!matchesFilter((reg || '').trim(), filters.regione)) return false;
      }
      if (!matchesFilterLower(r.stato, filters.stato)) return false;
      if (filters.data && giornoOrdine(r) !== filters.data) return false;
      if (filters.anno != null && (!Array.isArray(filters.anno) ? filters.anno : filters.anno.length > 0)) {
        const anno = annoOrdine(r);
        if (!matchesFilterString(anno, filters.anno)) return false;
      }
      return true;
    });

    const wb = XLSX.utils.book_new();

    if (mode === 'matrix') {
      // Le sintesi parlano di trasporti fatti: senza un filtro sullo stato contano
      // solo i terminati, come la matrice a video. Prima entravano anche i
      // cancellati.
      const conStato = Array.isArray(filters.stato) ? filters.stato.length > 0 : !!filters.stato;
      const fatti = conStato ? filtered : filtered.filter(eTerminato);

      // Foglio: sintesi per tratta
      const trattaMap: Record<string, any> = {};
      for (const r of fatti) {
        const origine = (r.stoccaggio || 'N/D').trim();
        const dest = (r.destinazione || 'N/D').trim();
        const canale = canaleDi(r) === 'ACI' ? 'ACI' : 'Rete';
        const key = `${canale}|${origine}|${dest}`;
        if (!trattaMap[key]) trattaMap[key] = { 'Canale': canale, 'Stoccaggio Origine': origine, 'Impianto Destinazione': dest, 'N. Ordini': 0, 'Peso (kg)': 0, 'Peso (t)': 0, 'Quantità': 0, 'Trasportatore': r.trasportatore || '', 'Partner Operativo': r.partner_operativo || '' };
        trattaMap[key]['N. Ordini']++;
        trattaMap[key]['Peso (kg)'] += (r.peso_effettivo || 0);
        trattaMap[key]['Peso (t)'] += (r.peso_effettivo || 0) / 1000;
        trattaMap[key]['Quantità'] += (r.quantita_ritirata || 0);
      }
      const wsTratte = XLSX.utils.json_to_sheet(Object.values(trattaMap));
      XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, wsTratte), 'Sintesi per Tratta');

      // Foglio: sintesi per classe, per canale. La chiave era la sola classe e il
      // canale quello del primo record: una classe presente su rete e ACI finiva
      // sommata in una riga sola.
      const classeMap: Record<string, any> = {};
      for (const r of fatti) {
        const c = r.classe || 'N/D';
        const canale = canaleDi(r) === 'ACI' ? 'ACI' : 'Rete';
        const key = `${canale}|${c}`;
        if (!classeMap[key]) classeMap[key] = { 'Canale': canale, 'Classe PFU': c, 'N. Ordini': 0, 'Peso (kg)': 0, 'Peso (t)': 0, 'Quantità': 0 };
        classeMap[key]['N. Ordini']++;
        classeMap[key]['Peso (kg)'] += (r.peso_effettivo || 0);
        classeMap[key]['Peso (t)'] += (r.peso_effettivo || 0) / 1000;
        classeMap[key]['Quantità'] += (r.quantita_ritirata || 0);
      }
      const wsClassi = XLSX.utils.json_to_sheet(Object.values(classeMap));
      XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, wsClassi), 'Sintesi per Classe');
    } else {
      const rows = filtered.map(r => ({
        'ID Ordine': r.id_ordine,
        'Stato': r.stato,
        'Trasporto Finito': dataIt(r.trasporto_finito_il),
        'Ordine Immesso': dataIt(r.ordine_immesso_il),
        'Stoccaggio Origine': r.stoccaggio,
        'Destinazione': r.destinazione,
        'Tipo Destinazione': r.tipo_destinazione,
        'Comune': r.comune,
        'Provincia': r.provincia,
        'Canale': canaleDi(r) === 'ACI' ? 'ACI' : 'Rete',
        'Classe PFU': r.classe,
        'CER': r.cer,
        'Quantità Ritirata': r.quantita_ritirata,
        'Peso Stimato (kg)': r.peso_stimato,
        'Peso Effettivo (kg)': r.peso_effettivo,
        'Peso (t)': (r.peso_effettivo || 0) / 1000,
        'Mese': meseOrdine(r) || '',
        'Settimana': settimanaIso(giornoOrdine(r)) ?? '',
        'Trasportatore': r.trasportatore,
        'Partner Operativo': r.partner_operativo,
        'Fatturato Trasporto': r.fatturato_trasporto,
        'Fatturato Riciclo': r.fatturato_riciclo,
        'Numero FIR': r.numero_fir,
        // solo informazione: non decide mese, settimana ne' filtri
        'Ordine Chiuso': dataIt(r.ordine_chiuso_il),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws), 'Dettaglio Secondarie');
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