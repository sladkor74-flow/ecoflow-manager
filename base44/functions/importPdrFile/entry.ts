import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { sostituisciFilePrecedenti } from "../../shared/fileArchivio.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { urlScaricabile, riferimentoDaSalvare, riferimentoDalCorpo } from "../../shared/fileScaricabile.ts";
import * as XLSX from 'npm:xlsx@0.18.5';
import { rispostaSolaLettura } from "../../shared/permessi.ts";

// Importa il file Excel PDR (elenco clienti Ecotyre: gommisti e autodemolitori).
// Il file ha colonne con nomi duplicati (CAP, Comune, Prov., ecc. compaiono due volte),
// quindi si usa sheet_to_json con header:1 (array di array) e mappatura per indice colonna.
// Flusso: scarica -> valida intestazioni -> mappa -> controllo zero righe -> lettura
// dell'anagrafica di prima -> anti-regressione -> delete+import -> ripristino
// dell'anagrafica di prima se la riscrittura non arriva in fondo (12/10/2026).
// Payload: { file_uri (privato, da UploadPrivateFile) oppure file_url (pubblico,
// storico), nome_file, replace_existing?, conferma_forzatura? }

// I campi che la piattaforma assegna da se' a ogni record: nel ripristino non si
// riscrivono, li riassegna lei.
const CAMPI_DI_SISTEMA = ['id', 'created_date', 'updated_date', 'created_by_id', 'created_by', 'is_sample'];
const senzaCampiDiSistema = (r) => { const o = { ...r }; for (const k of CAMPI_DI_SISTEMA) delete o[k]; return o; };
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Rimette l'anagrafica dei PDR com'era prima di una sostituzione non riuscita
 * (A16, 12/10/2026): via quello che e' entrato del file nuovo, poi le righe
 * lette prima, a blocchi di cento, tre tentativi per blocco come la scrittura.
 * Restituisce { ok, rimessi, errore? }: chi chiama dice nel registro se
 * l'anagrafica e' tornata intera o no.
 */
async function ripristinaAnagrafica(base44, prima) {
  let rimessi = 0;
  try {
    await base44.asServiceRole.entities.Pdr.deleteMany({});
    for (let i = 0; i < prima.length; i += 100) {
      const righe = prima.slice(i, i + 100).map(senzaCampiDiSistema);
      let fatto = false, ultimo = null;
      for (let t = 0; t < 3 && !fatto; t++) {
        try { await base44.asServiceRole.entities.Pdr.bulkCreate(righe); fatto = true; } catch (e) { ultimo = e; if (t < 2) await pausa(3000 * (t + 1)); }
      }
      if (!fatto) return { ok: false, rimessi, errore: ultimo && ultimo.message ? ultimo.message : String(ultimo) };
      rimessi += righe.length;
      await pausa(800);
    }
    return { ok: true, rimessi };
  } catch (e) {
    return { ok: false, rimessi, errore: e && e.message ? e.message : String(e) };
  }
}

export default async function(req) {
  let nome_file = 'N/D', file_url = null, file_uri = null;
  // Se l'anagrafica e' gia' stata toccata: da li' in poi un errore non e' piu'
  // un rifiuto a dati intatti (vedi la riga del registro, piu' sotto).
  let svuotato = false;
  // L'anagrafica letta prima di toccarla: quella che si rimette se la
  // sostituzione non arriva in fondo (A16, 12/10/2026).
  let prima = null;
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
    const body = await req.json();
    const { nome_file: nf, replace_existing, conferma_forzatura } = body;
    // Il file si prende solo come file_uri: un indirizzo non si accetta da chi
    // chiama (02/10/2026, come in importEcotyreFile).
    const dalCorpo = riferimentoDalCorpo(body);
    if (dalCorpo.errore) return Response.json({ error: dalCorpo.errore }, { status: 400 });
    file_uri = dalCorpo.rif ? dalCorpo.rif.file_uri : null;
    file_url = null;
    nome_file = nf || 'N/D';
    if (!file_uri) return Response.json({ error: 'file_uri obbligatorio' }, { status: 400 });
    // L'elenco dei punti di raccolta e' un documento aziendale: ragioni sociali,
    // indirizzi, partite IVA. Adesso sale privato e si apre solo con un link
    // firmato che scade; i caricamenti vecchi hanno ancora un file_url pubblico.
    const daScaricare = await urlScaricabile(base44, { file_uri, file_url });

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

    const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

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
    const fileRes = await fetch(daScaricare).catch(() => ({ ok: false, status: 0 }));
    if (!fileRes.ok) return Response.json({ error: `Impossibile scaricare il file appena caricato${fileRes.status ? ` (${fileRes.status})` : ''}. Riprova il caricamento.`, dati_intatti: true }, { status: 502 });
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
        tipo_file: 'pdr', nome_file, ...riferimentoDaSalvare({ file_uri, file_url }), righe_importate: 0, righe_fallite: 0,
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
        tipo_file: 'pdr', nome_file, ...riferimentoDaSalvare({ file_uri, file_url }), righe_importate: 0, righe_fallite: 0,
        esito: 'errore', messaggio: errResp.error, foglio_usato: sheetName
      });
      return Response.json(errResp, { status: 400 });
    }

    // === 5. L'anagrafica di prima, per il controllo e per il ripristino ===
    //
    // LA SOSTITUZIONE NON LASCIA L'ANAGRAFICA A META' (audit del 20/09, alta
    // A16; corretta il 12/10/2026). Si svuota e si riscrive a blocchi di cento:
    // se un blocco non entrava, i PDR mancanti restavano mancanti fino al file
    // successivo, e dall'anagrafica leggono le dichiarazioni RENTRI, la verifica
    // delle sedi operative e la mappa. Adesso l'anagrafica di prima si legge
    // per intero PRIMA di toccare niente - serve comunque al controllo qui
    // sotto - e se la riscrittura non arriva in fondo si rimette com'era.
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    prima = [];
    if (replace_existing !== false) {
      // a pagine da 1000 ordinate per id, togliendo i doppioni fra una pagina e
      // l'altra (memoria «Leggere gli archivi grandi»)
      const visti = new Set();
      let skip = 0;
      let hasMore = true;
      while (hasMore) {
        const batch = await base44.asServiceRole.entities.Pdr.list('id', 1000, skip);
        for (const r of batch) { if (r && !visti.has(r.id)) { visti.add(r.id); prima.push(r); } }
        hasMore = batch.length === 1000;
        skip += 1000;
        if (hasMore) await sleep(100);
      }
    }

    // === 5b. Controllo anti-regressione ===
    if (replace_existing !== false && !conferma_forzatura) {
      const existingIds = new Set();
      for (const r of prima) { if (r.id_pdr != null) existingIds.add(r.id_pdr); }

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
          tipo_file: 'pdr', nome_file, ...riferimentoDaSalvare({ file_uri, file_url }), righe_importate: 0, righe_fallite: 0,
          esito: 'errore', messaggio: `${errResp.error} (${mancanti.length} PDR mancanti su ${existingIds.size} in archivio)`,
          foglio_usato: sheetName, righe_archivio_prima: existingIds.size, forzato: false
        });
        return Response.json(errResp, { status: 409 });
      }
    }

    // === 6. SOLO ORA: deleteMany + import ===
    const CHUNK = 100;
    let imported = 0, failed = 0, lastError = null;

    // Un blocco si prova tre volte prima di dirlo non entrato.
    const scriviBlocco = async (blocco) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await base44.asServiceRole.entities.Pdr.bulkCreate(blocco);
          return true;
        } catch (e) {
          lastError = e.message || String(e);
          if (attempt < 2) await sleep(3000 * (attempt + 1));
        }
      }
      return false;
    };

    if (replace_existing !== false) {
      // Prima della cancellazione: una cancellazione che si ferma a meta' lascia
      // l'anagrafica gia' incompleta.
      svuotato = true;
      await base44.asServiceRole.entities.Pdr.deleteMany({});
    }

    for (let i = 0; i < records.length; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK);
      // In una sostituzione, al primo blocco che non entra ci si ferma: il resto
      // del file non servirebbe, l'anagrafica si rimette com'era.
      if (replace_existing !== false && failed > 0) { failed += chunk.length; continue; }
      if (await scriviBlocco(chunk)) imported += chunk.length;
      else failed += chunk.length;
      await sleep(800);
    }

    // La sostituzione non e' arrivata in fondo: via quello che e' entrato del
    // file nuovo, e dentro l'anagrafica di prima, coi suoi campi e senza quelli
    // che la piattaforma assegna da se'.
    if (svuotato && failed > 0) {
      const rip = await ripristinaAnagrafica(base44, prima);
      const motivo = `${failed} PDR su ${records.length} del file non sono entrati${lastError ? ` (${lastError})` : ''}`;
      const comeEra = prima.length ? `Ripristinata l'anagrafica di prima (${rip.rimessi} PDR)` : "L'anagrafica era vuota e resta vuota";
      if (rip.ok) {
        // Anagrafica com'era: per il registro e' un file non caricato a dati
        // intatti, non una riscrittura a meta'. Niente modalita', come i rifiuti.
        await base44.asServiceRole.entities.UploadLog.create({
          tipo_file: 'pdr', nome_file, ...riferimentoDaSalvare({ file_uri, file_url }),
          righe_importate: 0, righe_fallite: records.length, esito: 'errore',
          messaggio: `Sostituzione non riuscita: ${motivo}. ${comeEra}: ricarica il file.`,
          foglio_usato: sheetName, forzato: !!conferma_forzatura, righe_archivio_prima: prima.length,
        });
        return Response.json({
          error: 'Il file dei PDR non è entrato per intero: l\'anagrafica di prima è stata ripristinata',
          dettaglio: `${motivo}. ${comeEra}: ricarica il file.`,
          ripristinata: true, dati_intatti: true, righe_mappate: records.length, righe_ripristinate: rip.rimessi, lastError,
        }, { status: 502 });
      }
      // Nemmeno il ripristino e' arrivato in fondo: l'anagrafica e' incompleta e
      // va detto per nome, con la modalita' che fa gridare il registro.
      await base44.asServiceRole.entities.UploadLog.create({
        tipo_file: 'pdr', nome_file, ...riferimentoDaSalvare({ file_uri, file_url }), modalita: 'sostituzione',
        righe_importate: 0, righe_fallite: records.length, esito: 'errore',
        messaggio: `Sostituzione non riuscita: ${motivo}; anche il ripristino dell'anagrafica di prima si e' fermato a ${rip.rimessi} PDR su ${prima.length}${rip.errore ? ` (${rip.errore})` : ''}. L'anagrafica e' incompleta: ricarica il file.`,
        foglio_usato: sheetName, forzato: !!conferma_forzatura, righe_archivio_prima: prima.length,
      });
      return Response.json({
        error: 'Il file dei PDR non è entrato e l\'anagrafica di prima non si è potuta ripristinare per intero',
        dettaglio: `${motivo}. Ripristinati ${rip.rimessi} PDR su ${prima.length}: l'anagrafica è incompleta, ricarica il file.`,
        ripristinata: false, dati_intatti: false, righe_ripristinate: rip.rimessi, lastError,
      }, { status: 500 });
    }

    const esito = failed === 0 ? 'successo' : (imported > 0 ? 'parziale' : 'errore');
    // LA RIGA DICE SE HA RISCRITTO L'ANAGRAFICA (chiusura dell'audit,
    // 11/10/2026). Era l'unico caricamento che non scriveva la modalita': dopo
    // lo svuotamento, un blocco che non entrava dava «parziale» senza
    // «sostituzione», e per la regola del registro (registroCaricamenti.ts)
    // quello e' un caricamento riuscito. L'anagrafica con cento PDR in meno
    // risultava «caricata oggi», e la dashboard non diceva piu' niente. Con la
    // modalita' una riscrittura finita parziale o in errore si dice «non
    // riuscita: ricarica il file»; un'aggiunta parziale resta un caricamento
    // riuscito, perche' l'anagrafica di prima e' intatta.
    const riga = await base44.asServiceRole.entities.UploadLog.create({
      tipo_file: 'pdr', nome_file, ...riferimentoDaSalvare({ file_uri, file_url }),
      modalita: replace_existing !== false ? 'sostituzione' : 'aggiunta',
      righe_importate: imported, righe_fallite: failed, esito,
      messaggio: `${imported} PDR importati su ${records.length} totali (foglio: ${sheetName})`,
      foglio_usato: sheetName, forzato: !!conferma_forzatura
    });

    // L'anagrafica dei PDR che arriva adesso sostituisce quella di prima: il file
    // vecchio dice le stesse cose piu' poche righe (regola dell'utente,
    // 29/09/2026). Solo se e' entrata ogni riga; il record del registro resta.
    let fileSostituiti = null;
    if (esito === 'successo') {
      try {
        fileSostituiti = await sostituisciFilePrecedenti(base44, { tipoFile: 'pdr', idCorrente: riga.id, oggi: oggiRoma(), massimo: 10 });
      } catch (e) {
        fileSostituiti = { errore: e && e.message ? e.message : String(e) };
      }
    }

    return Response.json({
      tipo_file: 'pdr', foglio: sheetName,
      righe_lette: rows.length - 1, righe_mappate: records.length,
      righe_importate: imported, righe_fallite: failed, esito, lastError,
      forzato: !!conferma_forzatura,
      file_sostituiti: fileSostituiti
    });
  } catch (error) {
    // Un errore dopo lo svuotamento (la cancellazione caduta a meta', per
    // esempio) ha lasciato l'anagrafica vuota o a meta': si prova a rimetterla
    // com'era (A16, 12/10/2026). Se torna intera, e' un file non caricato a dati
    // intatti; altrimenti e' una riscrittura non riuscita, e il registro lo dice.
    let rip = null;
    try {
      const base44 = conLimiteRichieste(createClientFromRequest(req));
      if (svuotato && prima) rip = await ripristinaAnagrafica(base44, prima);
      const intatta = !svuotato || !!(rip && rip.ok);
      await base44.asServiceRole.entities.UploadLog.create({
        tipo_file: 'pdr', nome_file, ...riferimentoDaSalvare({ file_uri, file_url }), righe_importate: 0, righe_fallite: 0,
        ...(intatta ? {} : { modalita: 'sostituzione' }),
        esito: 'errore',
        messaggio: (error.message || 'Errore imprevisto')
          + (rip ? (rip.ok ? `. Ripristinata l'anagrafica di prima (${rip.rimessi} PDR): ricarica il file.` : `. Il ripristino dell'anagrafica di prima si e' fermato a ${rip.rimessi} PDR su ${prima.length}: l'anagrafica e' incompleta, ricarica il file.`) : ''),
      });
    } catch (_) {}
    return Response.json({
      error: error.message,
      ...(rip ? { ripristinata: rip.ok, righe_ripristinate: rip.rimessi } : {}),
      ...(svuotato ? { dati_intatti: !!(rip && rip.ok) } : {}),
    }, { status: 500 });
  }
}