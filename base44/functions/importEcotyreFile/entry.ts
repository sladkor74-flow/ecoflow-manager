import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';
import { SHEET_MAP, NUMERIC_FIELDS } from "../../shared/excelSchemas.ts";
import { enrichRecords } from "../../shared/dataEnrichment.ts";

// Importa un file Excel scaricato dal portale Ecotyre: legge il foglio corretto,
// mappa le colonne sui campi entità e salva in bulk.
// Payload: { file_url, tipo_file, nome_file, periodo_riferimento?, replace_existing? }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: richiesto ruolo admin' }, { status: 403 });

    const body = await req.json();
    const { file_url, tipo_file, nome_file, periodo_riferimento, replace_existing } = body;

    if (!file_url || !tipo_file) {
      return Response.json({ error: 'file_url e tipo_file sono obbligatori' }, { status: 400 });
    }
    const config = SHEET_MAP[tipo_file];
    if (!config) {
      return Response.json({ error: 'tipo_file non valido. Valori ammessi: ' + Object.keys(SHEET_MAP).join(', ') }, { status: 400 });
    }

    // 1. Scarica e parse il file Excel
    const fileRes = await fetch(file_url);
    if (!fileRes.ok) return Response.json({ error: 'Impossibile scaricare il file' }, { status: 502 });
    const ab = await fileRes.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array', cellDates: true });

    // Trova il foglio (match case-insensitive e trim; fallback al primo foglio)
    const sheetName = wb.SheetNames.find(n => n.trim().toLowerCase() === config.sheetName.trim().toLowerCase())
      || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

    // 2. Mappa colonne Excel -> campi entità
    const colMap = config.columns;
    const mapped = rawRows.map(row => {
      const obj = {};
      for (const [excelCol, entityField] of Object.entries(colMap)) {
        let val = row[excelCol];
        if (val === undefined || val === null || val === '') { obj[entityField] = null; continue; }
        if (NUMERIC_FIELDS.has(entityField)) {
          const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
          obj[entityField] = isNaN(n) ? null : n;
        } else if (val instanceof Date) {
          obj[entityField] = val.toISOString();
        } else {
          obj[entityField] = String(val).trim();
        }
      }
      return obj;
    }).filter(r => r.id_ordine && (!config.statoFilter || (r.stato || '').toLowerCase().trim() === config.statoFilter));

    // 2b. Enrichment: calcola colonne derivate (mese, settimana, anno, classe, regione, nr_giorni, scadenza, esito tempi)
    const enriched = enrichRecords(mapped, config.entity);

    // 3. Sostituzione o incremento
    let toImport = enriched;
    if (replace_existing === false) {
      // Modalità incrementale: salta record con id_ordine già presente
      const existing = await base44.asServiceRole.entities[config.entity].list('-created_date', 10000);
      const existingIds = new Set(existing.map(r => r.id_ordine).filter(Boolean));
      toImport = enriched.filter(r => !existingIds.has(r.id_ordine));
    } else {
      await base44.asServiceRole.entities[config.entity].deleteMany({});
    }

    // 4. bulkCreate a chunk di 100 con pausa e retry per limiti di traffico
    const CHUNK = 100;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let imported = 0;
    let failed = 0;
    let lastError = null;
    for (let i = 0; i < toImport.length; i += CHUNK) {
      const chunk = toImport.slice(i, i + CHUNK);
      let success = false;
      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          await base44.asServiceRole.entities[config.entity].bulkCreate(chunk);
          imported += chunk.length;
          success = true;
        } catch (e) {
          lastError = e.message || String(e);
          if (attempt < 2) await sleep(3000 * (attempt + 1));
        }
      }
      if (!success) failed += chunk.length;
      await sleep(1000);
    }

    // 5. Log
    const esito = failed === 0 ? 'successo' : (imported > 0 ? 'parziale' : 'errore');
    await base44.asServiceRole.entities.UploadLog.create({
      tipo_file, nome_file: nome_file || 'N/D', file_url,
      righe_importate: imported, righe_fallite: failed, esito,
      messaggio: `${imported} righe importate su ${toImport.length} da importare (foglio: ${sheetName})`,
      periodo_riferimento: periodo_riferimento || ''
    });

    return Response.json({
      tipo_file, entity: config.entity, foglio: sheetName,
      righe_lette: rawRows.length, righe_mappate: mapped.length, righe_da_importare: toImport.length,
      righe_importate: imported, righe_fallite: failed, esito, lastError
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}