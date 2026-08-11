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
          if (entityField === 'stato') {
            obj[entityField] = String(val).trim().toLowerCase();
          } else {
            obj[entityField] = String(val).trim();
          }
        }
      }
      return obj;
    }).filter(r => r.id_ordine && (!config.statoFilter || (r.stato || '').toLowerCase().trim() === config.statoFilter));

    // 2b. Enrichment: calcola colonne derivate (mese, settimana, anno, classe, regione, nr_giorni, scadenza, esito tempi)
    const enriched = enrichRecords(mapped, config.entity);

    // 3. Split e importazione
    const CHUNK = 100;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // Campi per entità Assegnato/AssegnatoAci (sottoinsieme dei campi Primaria)
    const CAMPI_ASSEGNATO = [
      'id_ordine', 'stato', 'ordine_immesso_il', 'id_cliente', 'ragione_sociale',
      'id_pdr', 'punto_di_raccolta', 'indirizzo', 'cap', 'comune', 'provincia',
      'codice_regione', 'macroarea', 'codice_prodotto', 'prodotto', 'classe',
      'cer', 'tipo_contenitori', 'quantita_richiesta', 'quantita_ritirata',
      'peso_stimato', 'peso_effettivo', 'key_account', 'partner_operativo',
      'id_trasportatore', 'trasportatore', 'regioni', 'mese', 'anno', 'sigla', 'regione'
    ];

    const isAciClasse = (classe, prodotto) => {
      const c = (classe || '').trim().toLowerCase();
      const p = (prodotto || '').trim().toLowerCase();
      return c.includes('autodemolizione') || c.includes('aci')
          || p.includes('autodemolizione') || p.includes('aci');
    };
    const isAssegnatoStato = (stato) => (stato || '').toLowerCase().trim() === 'assegnato';

    let imported = 0, failed = 0, lastError = null;
    let assegnati_importati = 0, assegnati_falliti = 0;
    let assegnati_aci_importati = 0, assegnati_aci_falliti = 0;
    let primarie_rete_importati = 0, primarie_rete_falliti = 0;
    let primarie_aci_importati = 0, primarie_aci_falliti = 0;

    const importBucket = async (rows, entityName, campi = null) => {
      let toImport = rows;
      if (replace_existing === false) {
        const existing = await base44.asServiceRole.entities[entityName].list('-created_date', 10000);
        const existingIds = new Set(existing.map(r => r.id_ordine).filter(Boolean));
        toImport = rows.filter(r => !existingIds.has(r.id_ordine));
      } else {
        await base44.asServiceRole.entities[entityName].deleteMany({});
      }
      const records = campi
        ? toImport.map(r => { const o = {}; for (const f of campi) o[f] = r[f] ?? null; return o; }).filter(r => r.id_ordine)
        : toImport.filter(r => r.id_ordine);
      let imp = 0, fail = 0;
      for (let i = 0; i < records.length; i += CHUNK) {
        const chunk = records.slice(i, i + CHUNK);
        let success = false;
        for (let attempt = 0; attempt < 3 && !success; attempt++) {
          try {
            await base44.asServiceRole.entities[entityName].bulkCreate(chunk);
            imp += chunk.length;
            success = true;
          } catch (e) {
            lastError = e.message || String(e);
            if (attempt < 2) await sleep(3000 * (attempt + 1));
          }
        }
        if (!success) fail += chunk.length;
        await sleep(1000);
      }
      return { imp, fail };
    };

    if (config.splitByStatoClasse) {
      // File primarie unico: split in 4 entità basato su stato (col B) + classe (col P)
      const bucketRete = [], bucketAci = [], bucketAssRete = [], bucketAssAci = [];
      for (const r of enriched) {
        if (!r.id_ordine) continue;
        const aci = isAciClasse(r.classe, r.prodotto);
        const ass = isAssegnatoStato(r.stato);
        if (ass && !aci) bucketAssRete.push(r);
        else if (ass && aci) bucketAssAci.push(r);
        else if (!aci) bucketRete.push(r);
        else bucketAci.push(r);
      }

      const r1 = await importBucket(bucketRete, 'PrimariaRete');
      primarie_rete_importati = r1.imp; primarie_rete_falliti = r1.fail;
      const r2 = await importBucket(bucketAci, 'PrimariaAci');
      primarie_aci_importati = r2.imp; primarie_aci_falliti = r2.fail;
      const r3 = await importBucket(bucketAssRete, 'Assegnato', CAMPI_ASSEGNATO);
      assegnati_importati = r3.imp; assegnati_falliti = r3.fail;
      const r4 = await importBucket(bucketAssAci, 'AssegnatoAci', CAMPI_ASSEGNATO);
      assegnati_aci_importati = r4.imp; assegnati_aci_falliti = r4.fail;
      imported = primarie_rete_importati + primarie_aci_importati;
      failed = primarie_rete_falliti + primarie_aci_falliti;
    } else {
      // Logica standard (singola entità)
      let toImport = enriched;
      if (replace_existing === false) {
        const existing = await base44.asServiceRole.entities[config.entity].list('-created_date', 10000);
        const existingIds = new Set(existing.map(r => r.id_ordine).filter(Boolean));
        toImport = enriched.filter(r => !existingIds.has(r.id_ordine));
      } else {
        await base44.asServiceRole.entities[config.entity].deleteMany({});
      }
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
    }

    // 5. Log
    const esito = failed === 0 ? 'successo' : (imported > 0 ? 'parziale' : 'errore');
    const totaleDaImportare = config.splitByStatoClasse
      ? primarie_rete_importati + primarie_aci_importati + assegnati_importati + assegnati_aci_importati
      : enriched.length;
    const messaggio = config.splitByStatoClasse
      ? `Rete: ${primarie_rete_importati} | ACI: ${primarie_aci_importati} | Ass. Rete: ${assegnati_importati} | Ass. ACI: ${assegnati_aci_importati} (foglio: ${sheetName})`
      : `${imported} righe importate su ${enriched.length} da importare (foglio: ${sheetName})`;
    await base44.asServiceRole.entities.UploadLog.create({
      tipo_file, nome_file: nome_file || 'N/D', file_url,
      righe_importate: imported, righe_fallite: failed, esito,
      messaggio, periodo_riferimento: periodo_riferimento || ''
    });

    return Response.json({
      tipo_file, entity: config.entity, foglio: sheetName,
      righe_lette: rawRows.length, righe_mappate: mapped.length, righe_da_importare: totaleDaImportare,
      righe_importate: imported, righe_fallite: failed, esito, lastError,
      assegnati_importati, assegnati_falliti,
      assegnati_aci_importati, assegnati_aci_falliti,
      primarie_rete_importati, primarie_rete_falliti,
      primarie_aci_importati, primarie_aci_falliti
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}