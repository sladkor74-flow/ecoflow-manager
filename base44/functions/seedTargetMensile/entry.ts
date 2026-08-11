import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';

// Estrae i target mensili dal foglio STATUS di un file Excel Ecotyre
// e li carica nell'entità TargetMensile.
// Payload: { file_url }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: richiesto ruolo admin' }, { status: 403 });

    const body = await req.json();
    const { file_url } = body;
    if (!file_url) return Response.json({ error: 'file_url obbligatorio' }, { status: 400 });

    // 1. Scarica e parse il file Excel
    const fileRes = await fetch(file_url);
    if (!fileRes.ok) return Response.json({ error: 'Impossibile scaricare il file' }, { status: 502 });
    const ab = await fileRes.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array', cellDates: true });

    // Trova il foglio STATUS
    const sheetName = wb.SheetNames.find(n => n.trim().toUpperCase() === 'STATUS');
    if (!sheetName) return Response.json({ error: 'Foglio STATUS non trovato nel file' }, { status: 400 });
    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

    // 2. Mappa colonne mensili
    const MESE_COL = {
      'GEN (T)': 'Gennaio', 'FEB (T)': 'Febbraio', 'MAR (T)': 'Marzo',
      'APR (T)': 'Aprile', 'MAG (T)': 'Maggio', 'GIU (T)': 'Giugno',
      'LUG (T)': 'Luglio', 'AGO (T)': 'Agosto', 'SET (T)': 'Settembre',
      'OTT (T)': 'Ottobre', 'NOV (T)': 'Novembre', 'DIC (T)': 'Dicembre',
    };
    const ANNO = new Date().getFullYear();

    // 3. Estrai record TargetMensile
    const records = [];
    const seen = new Set();
    for (const row of rawRows) {
      let regione = row['REGIONI'] ? String(row['REGIONI']).trim() : null;
      let raccoglitore = row['RACCOGLITORI'] ? String(row['RACCOGLITORI']).trim() : null;
      if (!regione || !raccoglitore) continue;

      // Salta righe di totali/riepilogo (raccoglitore o regione puramente numerici)
      if (/^[\d.,\s]+$/.test(raccoglitore) || /^[\d.,\s]+$/.test(regione)) continue;

      // Pulisci nome raccoglitore: rimuovi "(REGIONE)" o parentesi finali
      raccoglitore = raccoglitore.replace(/\s*\([^)]*\)\s*$/, '').trim();

      // Normalizza regione: "PUGLIA" -> "Puglia"
      regione = regione.charAt(0).toUpperCase() + regione.slice(1).toLowerCase();

      const key = `${raccoglitore}|||${regione}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const targetAnnuo = typeof row['TGT UPD'] === 'number' ? row['TGT UPD'] : null;

      for (const [col, mese] of Object.entries(MESE_COL)) {
        const target = row[col];
        // Crea record solo se c'è un target per questo mese (anche 0 è valido)
        if (target != null && typeof target === 'number') {
          records.push({
            raccoglitore,
            regione,
            mese,
            anno: ANNO,
            target,
            target_annuo: targetAnnuo || 0,
          });
        }
      }
    }

    if (records.length === 0) {
      return Response.json({ error: 'Nessun record target trovato nel foglio STATUS' }, { status: 400 });
    }

    // 4. Elimina target esistenti (replace) e crea nuovi
    await base44.asServiceRole.entities.TargetMensile.deleteMany({ anno: ANNO });

    // Bulk create in chunk da 100
    let created = 0;
    for (let i = 0; i < records.length; i += 100) {
      const chunk = records.slice(i, i + 100);
      await base44.asServiceRole.entities.TargetMensile.bulkCreate(chunk);
      created += chunk.length;
    }

    // 5. Log
    const nome_file = body.nome_file || 'GESTIONE_ECOTYRE.xlsx';
    await base44.asServiceRole.entities.UploadLog.create({
      tipo_file: 'status',
      nome_file,
      file_url,
      righe_importate: created,
      righe_fallite: 0,
      esito: 'successo',
      messaggio: `${seen.size} raccoglitori, ${created} target mensili caricati dal foglio STATUS`,
      periodo_riferimento: String(ANNO),
    });

    return Response.json({
      success: true,
      raccoglitori: seen.size,
      records_creati: created,
      righe_importate: created,
      righe_fallite: 0,
      message: `${seen.size} raccoglitori, ${created} target mensili caricati`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}