import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';
import { SHEET_MAP, NUMERIC_FIELDS } from "../../shared/excelSchemas.ts";
import { enrichRecords } from "../../shared/dataEnrichment.ts";
import { FILE_SIGNATURES, checkSignature, detectType } from "../../shared/fileSignatures.ts";

// Importa un file Excel scaricato dal portale Ecotyre con validazione anti-perdita-dati.
// Flusso tassativo:
// 1. scarica e leggi il file
// 2. riconosci il foglio tramite firma intestazioni (no fallback al primo foglio)
// 3. mappa le righe ed esegui l'enrichment
// 4. controllo contenuto (primarie: almeno un terminato)
// 5. se zero righe valide -> 400
// 6. controllo anti-regressione (id mancanti -> 409, a meno di conferma_forzatura)
// 7. SOLO ORA: deleteMany + bulkCreate
// Payload: { file_url, tipo_file, nome_file, periodo_riferimento?, replace_existing?, conferma_forzatura? }

const CHUNK = 100;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export default async function(req) {
  let tipo_file = null, nome_file = 'N/D', file_url = null;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: richiesto ruolo admin' }, { status: 403 });

    const body = await req.json();
    tipo_file = body.tipo_file;
    nome_file = body.nome_file || 'N/D';
    file_url = body.file_url;
    const { periodo_riferimento, conferma_forzatura, replace_existing } = body;

    // Calcola modalita': sostituzione integrale o aggiunta additiva.
    // Per primarie/secondarie/terziarie la sostituzione e' sempre obbligatoria
    // (l'anti-regressione garantisce che il file sia completo).
    const sostituisci = ['primarie', 'secondarie', 'terziarie'].includes(tipo_file) ? true : replace_existing !== false;
    const modalita = sostituisci ? 'sostituzione' : 'aggiunta';

    if (!file_url || !tipo_file) {
      return Response.json({ error: 'file_url e tipo_file sono obbligatori' }, { status: 400 });
    }

    // === Punto 6: rifiuta "assegnati" ===
    if (tipo_file === 'assegnati') {
      return Response.json({
        error: "Lo slot Assegnati e' stato rimosso. Gli assegnati vengono popolati automaticamente dal caricamento del file Primarie."
      }, { status: 400 });
    }

    // === Rifiuta "extra_raccolta": inserimento solo dal modulo dedicato ===
    if (tipo_file === 'extra_raccolta') {
      return Response.json({
        error: "L'extra raccolta si inserisce dal modulo dedicato Extra Raccolta, non dal caricamento file."
      }, { status: 400 });
    }

    const config = SHEET_MAP[tipo_file];
    if (!config) {
      return Response.json({ error: 'tipo_file non valido. Valori ammessi: ' + Object.keys(SHEET_MAP).join(', ') }, { status: 400 });
    }

    // === 1. Scarica e parse il file Excel ===
    const fileRes = await fetch(file_url);
    if (!fileRes.ok) return Response.json({ error: 'Impossibile scaricare il file' }, { status: 502 });
    const ab = await fileRes.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array', cellDates: true });

    // === 2. Riconosci il foglio tramite firma intestazioni ===
    const sig = FILE_SIGNATURES[tipo_file];
    let sheetName = null;
    let avviso_colonne = [];

    if (sig) {
      // Tipi con firma: primarie, secondarie, terziarie
      for (const sn of wb.SheetNames) {
        const wsTmp = wb.Sheets[sn];
        const rowsTmp = XLSX.utils.sheet_to_json(wsTmp, { defval: null, raw: true, header: 1 });
        if (rowsTmp.length === 0) continue;
        const headers = rowsTmp[0].map(h => String(h || ''));
        const check = checkSignature(headers, sig);
        if (check.match) {
          sheetName = sn;
          avviso_colonne = check.attese_mancanti;
          break;
        }
      }
      if (!sheetName) {
        // Nessun foglio valido: controlla se corrisponde a un altro tipo
        let tipo_rilevato = null;
        for (const sn of wb.SheetNames) {
          const wsTmp = wb.Sheets[sn];
          const rowsTmp = XLSX.utils.sheet_to_json(wsTmp, { defval: null, raw: true, header: 1 });
          if (rowsTmp.length === 0) continue;
          const headers = rowsTmp[0].map(h => String(h || ''));
          const detected = detectType(headers);
          if (detected && detected !== tipo_file) { tipo_rilevato = detected; break; }
        }
        // Dettaglio dal primo foglio
        const firstWs = wb.Sheets[wb.SheetNames[0]];
        const firstRows = XLSX.utils.sheet_to_json(firstWs, { defval: null, raw: true, header: 1 });
        const firstHeaders = firstRows.length > 0 ? firstRows[0].map(h => String(h || '')) : [];
        const check = checkSignature(firstHeaders, sig);
        const dettaglioParts = [];
        if (check.chiave_mancanti.length > 0) dettaglioParts.push('Colonne chiave mancanti: ' + check.chiave_mancanti.join(', '));
        if (check.vietate_trovate.length > 0) dettaglioParts.push('Colonne vietate presenti: ' + check.vietate_trovate.join(', '));

        const errResp = {
          error: 'Formato file non valido',
          dettaglio: dettaglioParts.join('. ') || 'Le intestazioni non corrispondono al tipo file richiesto',
          fogli_trovati: wb.SheetNames,
        };
        if (tipo_rilevato) {
          errResp.tipo_rilevato = `Il file caricato sembra di tipo ${tipo_rilevato.toUpperCase()} ma e' stato caricato nello slot ${tipo_file.toUpperCase()}`;
        }
        await base44.asServiceRole.entities.UploadLog.create({
          tipo_file, nome_file, file_url, righe_importate: 0, righe_fallite: 0,
          esito: 'errore', messaggio: errResp.error + (tipo_rilevato ? ' - ' + errResp.tipo_rilevato : ''),
          periodo_riferimento: periodo_riferimento || ''
        });
        return Response.json(errResp, { status: 400 });
      }
    } else {
      // Tipi senza firma: match nome foglio (SENZA fallback al primo)
      sheetName = wb.SheetNames.find(n => n.trim().toLowerCase() === config.sheetName.trim().toLowerCase());
      if (!sheetName) {
        const errResp = {
          error: 'Formato file non valido',
          dettaglio: `Nessun foglio denominato "${config.sheetName}" trovato nel file`,
          fogli_trovati: wb.SheetNames
        };
        await base44.asServiceRole.entities.UploadLog.create({
          tipo_file, nome_file, file_url, righe_importate: 0, righe_fallite: 0,
          esito: 'errore', messaggio: errResp.dettaglio,
          periodo_riferimento: periodo_riferimento || ''
        });
        return Response.json(errResp, { status: 400 });
      }
    }

    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

    // === 3. Mappa colonne Excel -> campi entita' ===
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

    // 3b. Enrichment
    const enriched = enrichRecords(mapped, config.entity);

    // === 4. Controllo sul contenuto (primarie: almeno un terminato) ===
    if (tipo_file === 'primarie') {
      const hasTerminato = enriched.some(r => (r.stato || '').toLowerCase().trim() === 'terminato');
      if (!hasTerminato) {
        const errResp = { error: "Il file non contiene alcun ordine terminato: sembra una selezione filtrata (es. soli assegnati), non l'export completo delle primarie." };
        await base44.asServiceRole.entities.UploadLog.create({
          tipo_file, nome_file, file_url, righe_importate: 0, righe_fallite: 0,
          esito: 'errore', messaggio: errResp.error,
          periodo_riferimento: periodo_riferimento || '', foglio_usato: sheetName
        });
        return Response.json(errResp, { status: 400 });
      }
    }

    // === 5. Se zero righe valide, interrompi ===
    if (enriched.filter(r => r.id_ordine).length === 0) {
      const errResp = { error: 'Nessuna riga valida trovata nel file' };
      await base44.asServiceRole.entities.UploadLog.create({
        tipo_file, nome_file, file_url, righe_importate: 0, righe_fallite: 0,
        esito: 'errore', messaggio: errResp.error,
        periodo_riferimento: periodo_riferimento || '', foglio_usato: sheetName
      });
      return Response.json(errResp, { status: 400 });
    }

    // === 6. Controllo anti-regressione ===
    const loadAllIds = async (entityName) => {
      const ids = new Set();
      let skip = 0;
      let hasMore = true;
      while (hasMore) {
        const batch = await base44.asServiceRole.entities[entityName].list('-created_date', 1000, skip);
        for (const r of batch) { if (r.id_ordine) ids.add(r.id_ordine); }
        hasMore = batch.length === 1000;
        skip += 1000;
        if (hasMore) await sleep(100);
      }
      return ids;
    };

    let righe_archivio_prima = 0;
    let avviso_date = null;

    const antiRegressionTypes = ['primarie', 'secondarie', 'terziarie'];
    if (antiRegressionTypes.includes(tipo_file)) {
      let existingIds;
      if (tipo_file === 'primarie') {
        existingIds = new Set();
        for (const ent of ['PrimariaRete', 'PrimariaAci', 'Assegnato', 'AssegnatoAci']) {
          const ids = await loadAllIds(ent);
          for (const id of ids) existingIds.add(id);
        }
      } else {
        existingIds = await loadAllIds(config.entity);
      }
      righe_archivio_prima = existingIds.size;

      // Verifica di sicurezza: se existingIds e' vuoto ma le entita' contengono record,
      // il controllo anti-regressione non e' attendibile - annullare per sicurezza.
      if (existingIds.size === 0) {
        const entitiesToCheck = tipo_file === 'primarie'
          ? ['PrimariaRete', 'PrimariaAci', 'Assegnato', 'AssegnatoAci']
          : [config.entity];
        for (const ent of entitiesToCheck) {
          const probe = await base44.asServiceRole.entities[ent].list('-created_date', 1);
          if (probe.length > 0) {
            return Response.json({
              error: "Controllo anti-regressione non attendibile: impossibile leggere gli identificativi in archivio. Caricamento annullato per sicurezza."
            }, { status: 500 });
          }
        }
      }

      const fileIds = new Set(enriched.filter(r => r.id_ordine).map(r => r.id_ordine));
      const mancanti = [];
      for (const id of existingIds) { if (!fileIds.has(id)) mancanti.push(id); }

      if (mancanti.length > 0 && !conferma_forzatura) {
        const errResp = {
          error: "Il file contiene meno dati di quelli gia' presenti in archivio",
          righe_file: fileIds.size, righe_archivio: existingIds.size,
          mancanti: mancanti.length, esempi_mancanti: mancanti.slice(0, 10),
          richiede_conferma: true
        };
        await base44.asServiceRole.entities.UploadLog.create({
          tipo_file, nome_file, file_url, righe_importate: 0, righe_fallite: 0,
          esito: 'errore', messaggio: `${errResp.error} (${mancanti.length} ordini mancanti su ${existingIds.size} in archivio)`,
          periodo_riferimento: periodo_riferimento || '', foglio_usato: sheetName,
          righe_archivio_prima: existingIds.size, forzato: false
        });
        return Response.json(errResp, { status: 409 });
      }

      // e) Confronto date massime Trasporto_finito_il
      const maxDateFile = enriched
        .filter(r => r.trasporto_finito_il)
        .map(r => new Date(r.trasporto_finito_il).getTime())
        .reduce((max, t) => Math.max(max, t), 0);
      if (maxDateFile > 0) {
        let maxDateArchivio = 0;
        const dateEntities = tipo_file === 'primarie' ? ['PrimariaRete', 'PrimariaAci'] : [config.entity];
        for (const ent of dateEntities) {
          const recs = await base44.asServiceRole.entities[ent].list('-trasporto_finito_il', 1, 0);
          if (recs.length > 0 && recs[0].trasporto_finito_il) {
            const t = new Date(recs[0].trasporto_finito_il).getTime();
            if (t > maxDateArchivio) maxDateArchivio = t;
          }
        }
        if (maxDateArchivio > 0 && maxDateFile < maxDateArchivio) {
          avviso_date = { data_file: new Date(maxDateFile).toISOString(), data_archivio: new Date(maxDateArchivio).toISOString() };
        }
      }
    }

    // === 7. SOLO ORA: cancellazione e import ===
    const CAMPI_ASSEGNATO = [
      'id_ordine', 'stato', 'ordine_immesso_il', 'id_cliente', 'ragione_sociale',
      'id_pdr', 'punto_di_raccolta', 'indirizzo', 'cap', 'comune', 'provincia',
      'codice_regione', 'macroarea', 'codice_prodotto', 'prodotto', 'classe',
      'cer', 'tipo_contenitori', 'quantita_richiesta', 'quantita_ritirata',
      'peso_stimato', 'peso_effettivo', 'key_account', 'partner_operativo',
      'id_partner_operativo', 'id_trasportatore', 'trasportatore', 'regioni', 'mese', 'anno', 'sigla', 'regione'
    ];

    const isAciClasse = (classe, prodotto) => {
      const c = (classe || '').trim().toLowerCase();
      const p = (prodotto || '').trim().toLowerCase();
      return c.includes('autodemolizione') || c.includes('aci')
          || p.includes('pfu autodemolizione') || p.includes('autodemolizione') || p.includes('aci');
    };
    const isAssegnatoStato = (stato) => (stato || '').toLowerCase().trim() === 'assegnato';

    const importBucket = async (rows, entityName, campi = null, sostituisci = true) => {
      const records = campi
        ? rows.map(r => { const o = {}; for (const f of campi) o[f] = r[f] ?? null; return o; }).filter(r => r.id_ordine)
        : rows.filter(r => r.id_ordine);

      let toImport = records;
      if (sostituisci) {
        // Sostituzione integrale: cancella tutto e ricarica
        await base44.asServiceRole.entities[entityName].deleteMany({});
      } else {
        // Modalita' additiva: filtra i record il cui id_ordine e' gia' presente
        const existingIds = new Set();
        let skip = 0;
        let hasMore = true;
        while (hasMore) {
          const batch = await base44.asServiceRole.entities[entityName].list('-created_date', 1000, skip);
          for (const r of batch) { if (r.id_ordine) existingIds.add(r.id_ordine); }
          hasMore = batch.length === 1000;
          skip += 1000;
          if (hasMore) await sleep(100);
        }
        toImport = records.filter(r => r.id_ordine && !existingIds.has(r.id_ordine));
      }

      let imp = 0, fail = 0, lastError = null;
      for (let i = 0; i < toImport.length; i += CHUNK) {
        const chunk = toImport.slice(i, i + CHUNK);
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
      return { imp, fail, lastError };
    };

    let imported = 0, failed = 0, lastError = null;
    let assegnati_importati = 0, assegnati_falliti = 0;
    let assegnati_aci_importati = 0, assegnati_aci_falliti = 0;
    let primarie_rete_importati = 0, primarie_rete_falliti = 0;
    let primarie_aci_importati = 0, primarie_aci_falliti = 0;

    if (config.splitByStatoClasse) {
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
      const r1 = await importBucket(bucketRete, 'PrimariaRete', null, sostituisci);
      primarie_rete_importati = r1.imp; primarie_rete_falliti = r1.fail;
      const r2 = await importBucket(bucketAci, 'PrimariaAci', null, sostituisci);
      primarie_aci_importati = r2.imp; primarie_aci_falliti = r2.fail;
      const r3 = await importBucket(bucketAssRete, 'Assegnato', CAMPI_ASSEGNATO, sostituisci);
      assegnati_importati = r3.imp; assegnati_falliti = r3.fail;
      const r4 = await importBucket(bucketAssAci, 'AssegnatoAci', CAMPI_ASSEGNATO, sostituisci);
      assegnati_aci_importati = r4.imp; assegnati_aci_falliti = r4.fail;
      imported = primarie_rete_importati + primarie_aci_importati;
      failed = primarie_rete_falliti + primarie_aci_falliti;
      lastError = r1.lastError || r2.lastError || r3.lastError || r4.lastError;
    } else {
      const r = await importBucket(enriched, config.entity, null, sostituisci);
      imported = r.imp; failed = r.fail; lastError = r.lastError;
    }

    // === 8. Log ===
    const esito = failed === 0 ? 'successo' : (imported > 0 ? 'parziale' : 'errore');
    const totaleDaImportare = config.splitByStatoClasse
      ? primarie_rete_importati + primarie_aci_importati + assegnati_importati + assegnati_aci_importati
      : enriched.length;
    const messaggio = config.splitByStatoClasse
      ? `Rete: ${primarie_rete_importati} | ACI: ${primarie_aci_importati} | Ass. Rete: ${assegnati_importati} | Ass. ACI: ${assegnati_aci_importati} (foglio: ${sheetName})`
      : `${imported} righe importate su ${enriched.length} da importare (foglio: ${sheetName})`;
    await base44.asServiceRole.entities.UploadLog.create({
      tipo_file, nome_file, file_url,
      righe_importate: imported, righe_fallite: failed, esito,
      messaggio, periodo_riferimento: periodo_riferimento || '',
      foglio_usato: sheetName, righe_archivio_prima, forzato: !!conferma_forzatura,
      modalita
    });

    return Response.json({
      tipo_file, entity: config.entity, foglio: sheetName,
      righe_lette: rawRows.length, righe_mappate: mapped.length, righe_da_importare: totaleDaImportare,
      righe_importate: imported, righe_fallite: failed, esito, lastError,
      assegnati_importati, assegnati_falliti,
      assegnati_aci_importati, assegnati_aci_falliti,
      primarie_rete_importati, primarie_rete_falliti,
      primarie_aci_importati, primarie_aci_falliti,
      avviso_colonne: avviso_colonne.length > 0 ? avviso_colonne : undefined,
      avviso_date,
      forzato: !!conferma_forzatura,
      modalita
    });
  } catch (error) {
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.UploadLog.create({
        tipo_file, nome_file, file_url, righe_importate: 0, righe_fallite: 0,
        esito: 'errore', messaggio: error.message || 'Errore imprevisto',
        periodo_riferimento: ''
      });
    } catch (_) {}
    return Response.json({ error: error.message }, { status: 500 });
  }
}