import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';

// Importa il file Excel PDR (elenco clienti Ecotyre: gommisti e autodemolitori).
// Il file ha colonne con nomi duplicati (CAP, Comune, Prov., ecc. compaiono due volte),
// quindi si usa sheet_to_json con header:1 (array di array) e mappatura per indice colonna.
// Payload: { file_url, nome_file, replace_existing? }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: richiesto ruolo admin' }, { status: 403 });

    const body = await req.json();
    const { file_url, nome_file, replace_existing } = body;
    if (!file_url) return Response.json({ error: 'file_url obbligatorio' }, { status: 400 });

    // Mappatura indice colonna (0-based) -> campo entità
    const COL_MAP = {
      1: 'id_cliente', 2: 'codice_esterno', 3: 'ragione_sociale', 4: 'sede_legale',
      5: 'cap', 6: 'comune', 7: 'provincia', 8: 'nazione', 9: 'riferimento',
      10: 'tel', 11: 'fax', 12: 'email', 13: 'codice_fiscale', 14: 'partita_iva',
      15: 'codice_import', 16: 'id_pdr', 17: 'codice_esterno_pdr', 18: 'descrizione_pdr',
      19: 'indirizzo_pdr', 20: 'cap_pdr', 21: 'comune_pdr', 22: 'provincia_pdr',
      31: 'sospeso', 32: 'key_account', 33: 'partner_operativo', 34: 'trasportatore_principale'
    };
    const NUMERIC = new Set(['id_cliente', 'id_pdr']);

    // Scarica e parse il file
    const fileRes = await fetch(file_url);
    if (!fileRes.ok) return Response.json({ error: 'Impossibile scaricare il file' }, { status: 502 });
    const ab = await fileRes.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

    // La prima riga è l'header; i dati iniziano dalla riga 1
    const records = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      // Salta righe soft-deleted (col 0)
      const softDeleted = row[0];
      if (softDeleted === true || String(softDeleted).toLowerCase() === 'true' || String(softDeleted) === '1') continue;

      const obj = {};
      for (const [idx, field] of Object.entries(COL_MAP)) {
        let val = row[parseInt(idx)];
        if (val === undefined || val === null || val === '') { obj[field] = null; continue; }
        if (NUMERIC.has(field)) {
          const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
          obj[field] = isNaN(n) ? null : n;
        } else {
          obj[field] = String(val).trim();
        }
      }
      // Salta righe senza id_cliente
      if (obj.id_cliente == null) continue;
      records.push(obj);
    }

    // Sostituzione completa o incrementale
    if (replace_existing !== false) {
      await base44.asServiceRole.entities.Pdr.deleteMany({});
    }

    const CHUNK = 100;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let imported = 0, failed = 0, lastError = null;

    for (let i = 0; i < records.length; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK);
      let success = false;
      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          await base44.asServiceRole.entities.Pdr.bulkCreate(chunk);
          imported += chunk.length;
          success = true;
        } catch (e) {
          lastError = e.message || String(e);
          if (attempt < 2) await sleep(3000 * (attempt + 1));
        }
      }
      if (!success) failed += chunk.length;
      await sleep(800);
    }

    const esito = failed === 0 ? 'successo' : (imported > 0 ? 'parziale' : 'errore');
    await base44.asServiceRole.entities.UploadLog.create({
      tipo_file: 'pdr', nome_file: nome_file || 'N/D', file_url,
      righe_importate: imported, righe_fallite: failed, esito,
      messaggio: `${imported} PDR importati su ${records.length} totali`
    });

    return Response.json({
      tipo_file: 'pdr', righe_lette: rows.length - 1, righe_mappate: records.length,
      righe_importate: imported, righe_fallite: failed, esito, lastError
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}