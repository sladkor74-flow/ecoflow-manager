import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';

// Importa il file Excel PDR (elenco clienti Ecotyre: gommisti e autodemolitori).
// Il file ha colonne con nomi duplicati (CAP, Comune, Prov., ecc. compaiono due volte),
// quindi si usa sheet_to_json con header:1 (array di array) e mappatura per indice colonna.
// Flusso: scarica -> valida intestazioni -> mappa -> controllo zero righe -> anti-regressione -> delete+import.
// Payload: { file_url, nome_file, replace_existing?, conferma_forzatura? }
export default async function(req) {
  let nome_file = 'N/D', file_url = null;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: richiesto ruolo admin' }, { status: 403 });

    const body = await req.json();
    const { file_url: fu, nome_file: nf, replace_existing, conferma_forzatura } = body;
    file_url = fu;
    nome_file = nf || 'N/D';
    if (!file_url) return Response.json({ error: 'file_url obbligatorio' }, { status: 400 });

    // Mappatura indice colonna (0-based) -> campo entità
    const COL_MAP = {
      1: 'id_cliente', 2: 'codice_esterno', 3: 'ragione_sociale', 4: 'sede_legale',
      5: 'cap', 6: 'comune', 7: 'provincia', 8: 'nazione', 9: 'riferimento',
      10: 'tel', 11: 'fax', 12: 'email', 13: 'codice_fiscale', 14: 'partita_iva',
      15: 'codice_import', 16: 'id_pdr', 17: 'codice_esterno_pdr', 18: 'descrizione_pdr',
      19: 'indirizzo_pdr', 20: 'cap_pdr', 21: 'comune_pdr', 22: 'provincia_pdr',
      24: 'riferimento_pdr', 25: 'tel_pdr', 26: 'fax_pdr', 27: 'email_pdr',
      28: 'rentri_iscrizione', 29: 'rentri_id_ul', 30: 'tipo_formulario',
      31: 'sospeso', 32: 'key_account', 33: 'partner_operativo', 34: 'trasportatore_principale',
      35: 'latitudine', 36: 'longitudine', 37: 'geo_approssimazione', 38: 'place_id'
    };
    const NUMERIC = new Set(['id_cliente', 'id_pdr', 'latitudine', 'longitudine']);

    // Mappa di controllo: indice colonna (0-based) -> testo atteso dell'intestazione
    const HEADER_MAP = {
      0: "Soft deleted", 1: "ID Cliente", 2: "Codice Esterno", 3: "Ragione Sociale",
      4: "Sede Legale", 5: "CAP", 6: "Comune", 7: "Prov.", 8: "Nazione",
      9: "Riferimento", 10: "Tel", 11: "Fax", 12: "Email", 13: "Cod. Fiscale",
      14: "Partita IVA", 15: "Codice Import", 16: "ID PDR", 17: "Cod. Esterno PDR",
      18: "Descrizione", 19: "Indirizzo", 20: "CAP", 21: "Comune", 22: "Prov.",
      23: "Nazione", 24: "Riferimento", 25: "Tel", 26: "Fax", 27: "Email",
      28: "Iscrizione al R.E.N.T.Ri.", 29: "ID U/L RENTRi", 30: "Tipo di formulario",
      31: "Sospeso", 32: "KeyAccount", 33: "Partner Operativo", 34: "Trasportatore Principale",
      35: "Latitudine", 36: "Longitudine", 37: "Approsimazione", 38: "PlaceID"
    };

    const norm = (s) => String(s || '').trim().toLowerCase();

    // Verifica la riga 1 di un foglio contro la mappa di controllo
    const checkHeaders = (headerRow) => {
      const mismatches = [];
      for (const [idx, expected] of Object.entries(HEADER_MAP)) {
        const actual = headerRow[parseInt(idx)];
        if (norm(actual) !== norm(expected)) {
          mismatches.push({
            colonna: parseInt(idx),
            attesa: expected,
            trovata: actual != null ? String(actual) : '(vuoto)'
          });
        }
      }
      return { match: mismatches.length === 0, mismatches };
    };

    // === 1. Scarica e parse il file ===
    const fileRes = await fetch(file_url);
    if (!fileRes.ok) return Response.json({ error: 'Impossibile scaricare il file' }, { status: 502 });
    const ab = await fileRes.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array', cellDates: true });

    // === 2. Individua il foglio valido tramite la mappa di intestazioni ===
    let ws = null;
    let sheetName = null;
    let lastMismatches = [];
    for (const sn of wb.SheetNames) {
      const wsTmp = wb.Sheets[sn];
      const rowsTmp = XLSX.utils.sheet_to_json(wsTmp, { header: 1, defval: null, raw: true });
      if (rowsTmp.length === 0) continue;
      const { match, mismatches } = checkHeaders(rowsTmp[0]);
      if (match) { ws = wsTmp; sheetName = sn; break; }
      lastMismatches = mismatches;
    }

    if (!ws) {
      const dettaglio = lastMismatches.map(m => `colonna ${m.colonna}: attesa '${m.attesa}', trovata '${m.trovata}'`).join('; ');
      const errResp = {
        error: 'Formato file PDR non valido',
        dettaglio: dettaglio || 'Le intestazioni non corrispondono al formato atteso',
        fogli_trovati: wb.SheetNames
      };
      await base44.asServiceRole.entities.UploadLog.create({
        tipo_file: 'pdr', nome_file, file_url, righe_importate: 0, righe_fallite: 0,
        esito: 'errore', messaggio: errResp.error + ' - ' + errResp.dettaglio
      });
      return Response.json(errResp, { status: 400 });
    }

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

    // === 3. Mappa le righe (la prima riga è l'header; i dati iniziano dalla riga 1) ===
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

    // === 4. Se zero righe valide, interrompi senza toccare il database ===
    if (records.length === 0) {
      const errResp = { error: 'Nessuna riga valida trovata nel file' };
      await base44.asServiceRole.entities.UploadLog.create({
        tipo_file: 'pdr', nome_file, file_url, righe_importate: 0, righe_fallite: 0,
        esito: 'errore', messaggio: errResp.error, foglio_usato: sheetName
      });
      return Response.json(errResp, { status: 400 });
    }

    // === 5. Controllo anti-regressione ===
    if (replace_existing !== false && !conferma_forzatura) {
      // Carica tutti gli id_pdr presenti in archivio paginando a blocchi di 1000
      const existingIds = new Set();
      let skip = 0;
      let hasMore = true;
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      while (hasMore) {
        const batch = await base44.asServiceRole.entities.Pdr.list('-created_date', 1000, skip);
        for (const r of batch) { if (r.id_pdr != null) existingIds.add(r.id_pdr); }
        hasMore = batch.length === 1000;
        skip += 1000;
        if (hasMore) await sleep(100);
      }

      const fileIds = new Set(records.filter(r => r.id_pdr != null).map(r => r.id_pdr));
      const mancanti = [];
      for (const id of existingIds) { if (!fileIds.has(id)) mancanti.push(id); }

      if (mancanti.length > 0) {
        const errResp = {
          error: 'Il file contiene meno punti di raccolta di quelli gia\' in archivio',
          righe_file: fileIds.size, righe_archivio: existingIds.size,
          mancanti: mancanti.length, esempi_mancanti: mancanti.slice(0, 10),
          richiede_conferma: true
        };
        await base44.asServiceRole.entities.UploadLog.create({
          tipo_file: 'pdr', nome_file, file_url, righe_importate: 0, righe_fallite: 0,
          esito: 'errore', messaggio: `${errResp.error} (${mancanti.length} PDR mancanti su ${existingIds.size} in archivio)`,
          foglio_usato: sheetName, righe_archivio_prima: existingIds.size, forzato: false
        });
        return Response.json(errResp, { status: 409 });
      }
    }

    // === 6. SOLO ORA: deleteMany + import ===
    const CHUNK = 100;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let imported = 0, failed = 0, lastError = null;

    if (replace_existing !== false) {
      await base44.asServiceRole.entities.Pdr.deleteMany({});
    }

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
      tipo_file: 'pdr', nome_file, file_url,
      righe_importate: imported, righe_fallite: failed, esito,
      messaggio: `${imported} PDR importati su ${records.length} totali (foglio: ${sheetName})`,
      foglio_usato: sheetName, forzato: !!conferma_forzatura
    });

    return Response.json({
      tipo_file: 'pdr', foglio: sheetName,
      righe_lette: rows.length - 1, righe_mappate: records.length,
      righe_importate: imported, righe_fallite: failed, esito, lastError,
      forzato: !!conferma_forzatura
    });
  } catch (error) {
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.UploadLog.create({
        tipo_file: 'pdr', nome_file, file_url, righe_importate: 0, righe_fallite: 0,
        esito: 'errore', messaggio: error.message || 'Errore imprevisto'
      });
    } catch (_) {}
    return Response.json({ error: error.message }, { status: 500 });
  }
}