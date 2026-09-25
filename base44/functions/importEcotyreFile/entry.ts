import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { allineaDalPortale } from "../../shared/agganciaDichiarazioni.ts";
import * as XLSX from 'npm:xlsx@0.18.5';
import { SHEET_MAP, NUMERIC_FIELDS } from "../../shared/excelSchemas.ts";
import { enrichRecords } from "../../shared/dataEnrichment.ts";
import { FILE_SIGNATURES, checkSignature, detectType, mappaColonne } from "../../shared/fileSignatures.ts";
import { CAMPI_ASSEGNATO, DATE_PRIMARIE, archivioPrimaria, dataPrimaria } from "../../shared/primarie.ts";
import { livelloDi, puoCaricare, rispostaCaricamentoNegato } from "../../shared/livelli.ts";
import { annoRoma } from "../../shared/giornoItaliano.ts";
import { annoInizioFile, ordiniDaConservare, cancellatiDaLasciare, svuotaTranne } from "../../shared/storicoConservato.ts";

// Le dichiarazioni riconosciute, un canale per volta: nel registro non si sommano.
const perCanale = (righe) => [['RETE', 'rete'], ['ACI', 'ACI'], ['EXTRA_RACCOLTA', 'extra raccolta']]
  .map(([c, nome]) => [nome, righe.filter(x => (x.canale || 'RETE') === c).length]).filter(([, n]) => n)
  .map(([nome, n]) => `${nome} ${n}`).join(', ') || '0';

// Importa un file Excel scaricato dal portale Ecotyre con validazione anti-perdita-dati.
// Flusso tassativo:
// 1. scarica e leggi il file
// 2. riconosci il foglio tramite firma intestazioni (no fallback al primo foglio)
// 3. mappa le righe ed esegui l'enrichment
// 4. controllo contenuto (primarie: almeno un terminato)
// 5. se zero righe valide -> 400
// 6. controllo anti-regressione (id mancanti -> 409, a meno di conferma_forzatura)
// 7. SOLO ORA: riga "in_corso" nel registro, poi deleteMany + bulkCreate
// 8. la riga del registro prende l'esito; se dopo lo svuotamento non e' entrato
//    niente, o arriva un errore, resta "in_corso" col solo messaggio cambiato
// Payload: { file_url, tipo_file, nome_file, periodo_riferimento?, replace_existing?, conferma_forzatura? }

const CHUNK = 250;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Mentre l'archivio si svuota e si riscrive, nel registro deve esserci una riga
// "in_corso": e' da li' che verifiche dei report, quadrature FIR, riconfronti
// dopo i caricamenti e alert capiscono che l'archivio e' a meta' e aspettano
// (statoCaricamenti). Qui il registro si scriveva solo alla fine: durante un
// caricamento delle secondarie quei moduli rifacevano e SALVAVANO esiti e alert
// su un archivio vuoto o parziale - l'alert di una dichiarazione si chiudeva
// come "confermata" e poi si ricreava. E' la stessa regola di importaBlocco
// (apriCaricamento / chiudiCaricamento): la riga si apre subito prima di
// svuotare, si chiude con l'esito alla fine o con l'errore, e una rimasta
// aperta e' la traccia di un caricamento interrotto. Blocca per dieci minuti lo
// stesso archivio a un altro utente, che altrimenti lo sovrascriverebbe.
//
// Un errore DOPO lo svuotamento - un'eccezione in scrittura, o nessuna riga
// entrata - non chiude la riga in "errore": resta "in_corso" e cambia solo il
// messaggio, che comincia con NON_RIUSCITO. Chiusa, nessuno vedeva piu'
// l'archivio vuoto o a meta' (statoCaricamenti, il cruscotto e i ricalcoli dopo
// i caricamenti guardano le righe "in_corso") e i ricalcoli salvavano esiti su
// quello: il caso opposto a quello che la riga doveva coprire. Cosi' la vedono
// aperta, e interrotta dopo dieci minuti. In "errore" si chiude solo cio' che
// fallisce prima dello svuotamento, a dati intatti. Una riga NON_RIUSCITO non
// blocca un altro utente: nessuno sta piu' scrivendo.
const FINESTRA_IN_CORSO_MS = 10 * 60 * 1000;
const NON_RIUSCITO = 'Caricamento non riuscito';
const chi = (user) => (user && (user.full_name || user.email)) || '';

async function apriCaricamento(base44, user, tipo_file, nome_file, file_url, prima) {
  const Log = base44.asServiceRole.entities.UploadLog;
  const aperti = await Log.filter({ tipo_file, esito: 'in_corso' }, '-created_date', 20);
  const adesso = Date.now();
  for (const l of aperti) {
    // created_date arriva in UTC senza la Z finale
    const eta = adesso - new Date(String(l.created_date).replace(/(Z|[+-]\d{2}:?\d{2})?$/, 'Z')).getTime();
    const fallito = String(l.messaggio || '').startsWith(NON_RIUSCITO);
    if (!fallito && eta < FINESTRA_IN_CORSO_MS && l.utente && l.utente !== chi(user)) {
      return { bloccato: `${l.utente} sta caricando lo stesso archivio da ${Math.max(1, Math.round(eta / 60000))} minuti: aspetta che finisca, altrimenti i due caricamenti si sovrascrivono.` };
    }
    await Log.update(l.id, { esito: 'errore', messaggio: fallito ? `${l.messaggio} E' stato ricaricato dopo.` : `Caricamento interrotto: avviato da ${l.utente || 'sconosciuto'} e mai concluso. L'archivio poteva essere incompleto; e' stato ricaricato dopo.` });
  }
  const riga = await Log.create({
    tipo_file, nome_file: nome_file || 'N/D', file_url, esito: 'in_corso', utente: chi(user),
    righe_importate: 0, righe_fallite: 0,
    righe_archivio_prima: typeof prima === 'number' ? prima : undefined,
    messaggio: 'Caricamento in corso: archivio in riscrittura.',
  });
  return { id: riga.id };
}

// Campi data per le nuove entita' (dichiarazioni/ordini): accettano sia seriale Excel che testo AAAA-MM-GG
const DATE_FIELDS = new Set([
  'data_chiusura', 'data_immissione', 'inizio_trasporto', 'fine_trasporto',
  'data_esecuzione', 'data_dichiarazione'
]);

function excelSerialToDate(serial) {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000));
  return isNaN(d.getTime()) ? null : d;
}

function toDateISO(val) {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'number') { const d = excelSerialToDate(val); return d ? d.toISOString() : null; }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const d = new Date(s); return isNaN(d.getTime()) ? null : d.toISOString(); }
  return null;
}

// Legge SOLO la prima riga di un foglio, senza materializzare tutte le righe.
// sheet_to_json con header:1 caricherebbe l'intero foglio in memoria solo per
// leggere le intestazioni: su file di grandi dimensioni, come il report delle
// dichiarazioni di trattamento con oltre 18.000 righe per 58 colonne, questo
// esaurisce le risorse della function prima ancora della validazione.
function leggiIntestazioni(ws) {
  if (!ws || !ws['!ref']) return [];
  const range = XLSX.utils.decode_range(ws['!ref']);
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
    headers.push(cell && cell.v != null ? String(cell.v) : '');
  }
  return headers;
}

// Il file appena caricato non e' sempre pronto quando la function lo chiede, e
// la rete ogni tanto fa i capricci: si riprova, con una pausa breve. Qui non si
// e' ancora toccato niente, quindi il fallimento non lascia l'archivio a meta'.
async function scaricaFile(url, tentativi = 3) {
  let ultima = { ok: false, status: 0, statusText: 'nessuna risposta' };
  for (let i = 0; i < tentativi; i++) {
    if (i) await new Promise(r => setTimeout(r, 1500 * i));
    try {
      ultima = await fetch(url);
      if (ultima.ok) return ultima;
    } catch (e) {
      ultima = { ok: false, status: 0, statusText: e && e.message ? e.message : String(e) };
    }
  }
  return ultima;
}

export default async function(req) {
  let tipo_file = null, nome_file = 'N/D', file_url = null;
  let fase = 'avvio';
  let user = null;
  // la riga "in_corso" del registro, da chiudere con l'esito o con l'errore
  let rigaRegistro = null;
  // vero da quando l'archivio puo' essere cambiato (svuotamento o prima scrittura)
  let archivioToccato = false;
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized', dati_intatti: true }, { status: 401 });
    const startTime = Date.now();
    const body = await req.json();
    tipo_file = body.tipo_file;
    // Il permesso dipende dal file: l'operatore base carica primarie, secondarie
    // e terziarie, l'amministratore tutto.
    const livello = await livelloDi(base44, user);
    if (!puoCaricare(livello, tipo_file)) return rispostaCaricamentoNegato(livello, tipo_file);
    nome_file = body.nome_file || 'N/D';
    file_url = body.file_url;
    const { periodo_riferimento, conferma_forzatura, replace_existing } = body;

    // Calcola modalita': sostituzione integrale o aggiunta additiva.
    // Per primarie/secondarie/terziarie la sostituzione e' sempre obbligatoria
    // (l'anti-regressione garantisce che il file sia completo).
    const sostituisci = ['primarie', 'secondarie', 'terziarie', 'dichiarazioni_trattamento', 'ordini_non_dichiarati'].includes(tipo_file) ? true : replace_existing !== false;
    const modalita = sostituisci ? 'sostituzione' : 'aggiunta';

    if (!file_url || !tipo_file) {
      return Response.json({ error: 'file_url e tipo_file sono obbligatori', dati_intatti: true }, { status: 400 });
    }

    // === Punto 6: rifiuta "assegnati" ===
    if (tipo_file === 'assegnati') {
      return Response.json({
        error: "Lo slot Assegnati e' stato rimosso. Gli assegnati vengono popolati automaticamente dal caricamento del file Primarie.",
        dati_intatti: true,
      }, { status: 400 });
    }

    // === Rifiuta "extra_raccolta": inserimento solo dal modulo dedicato ===
    if (tipo_file === 'extra_raccolta') {
      return Response.json({
        error: "L'extra raccolta si inserisce dal modulo dedicato Extra Raccolta, non dal caricamento file.",
        dati_intatti: true,
      }, { status: 400 });
    }

    const config = SHEET_MAP[tipo_file];
    if (!config) {
      return Response.json({ error: 'tipo_file non valido. Valori ammessi: ' + Object.keys(SHEET_MAP).join(', '), dati_intatti: true }, { status: 400 });
    }

    // === 1. Scarica e parse il file Excel ===
    fase = 'download del file';
    const fileRes = await scaricaFile(file_url);
    if (!fileRes.ok) {
      const quale = [fileRes.status || null, fileRes.statusText || null].filter(Boolean).join(' ');
      return Response.json({
        error: `Impossibile scaricare il file appena caricato${quale ? ` (${quale})` : ''}, dopo tre tentativi. Riprova il caricamento.`,
        fase, dati_intatti: true,
      }, { status: 502 });
    }
    const ab = await fileRes.arrayBuffer();
    // I due report del portale portano le date come seriali Excel e vengono convertite
    // da DATE_FIELDS: disattivare cellDates evita di creare un oggetto Date per ogni
    // cella data, su oltre un milione di celle.
    const usaCellDates = !(tipo_file === 'dichiarazioni_trattamento' || tipo_file === 'ordini_non_dichiarati');
    fase = 'lettura del foglio';
    const wb = XLSX.read(ab, { type: 'array', cellDates: usaCellDates });

    // === 2. Riconosci il foglio tramite firma intestazioni ===
    fase = 'validazione intestazioni';
    const sig = FILE_SIGNATURES[tipo_file];
    let sheetName = null;
    let avviso_colonne = [];

    if (sig) {
      // Tipi con firma: primarie, secondarie, terziarie
      for (const sn of wb.SheetNames) {
        const headers = leggiIntestazioni(wb.Sheets[sn]);
        if (headers.length === 0) continue;
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
          const headers = leggiIntestazioni(wb.Sheets[sn]);
          if (headers.length === 0) continue;
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
          utente: (user && (user.full_name || user.email)) || '',
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
          utente: (user && (user.full_name || user.email)) || '',
          tipo_file, nome_file, file_url, righe_importate: 0, righe_fallite: 0,
          esito: 'errore', messaggio: errResp.dettaglio,
          periodo_riferimento: periodo_riferimento || ''
        });
        return Response.json(errResp, { status: 400 });
      }
    }

    const ws = wb.Sheets[sheetName];
    // Senza defval ogni riga produce solo le celle effettivamente presenti anziche'
    // tutte le colonne: la mappatura gestisce gia' i valori assenti.
    fase = 'mappatura righe';
    const rawRows = XLSX.utils.sheet_to_json(ws, { raw: true });

    // === 3. Mappa colonne Excel -> campi entita' ===
    // Le colonne si cercano con le intestazioni vere del foglio: la firma le
    // accetta normalizzate, e cercarle qui col nome esatto lasciava fuori
    // un'intestazione con uno spazio in coda (fileSignatures.mappaColonne).
    const colMap = mappaColonne(config.columns, leggiIntestazioni(ws));
    const keyField = config.keyField || 'id_ordine';
    const mapped = rawRows.map(row => {
      const obj = {};
      for (const [excelCol, entityField] of Object.entries(colMap)) {
        let val = row[excelCol];
        if (val === undefined || val === null || val === '') { obj[entityField] = null; continue; }
        if (NUMERIC_FIELDS.has(entityField)) {
          const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
          obj[entityField] = isNaN(n) ? null : n;
        } else if (DATE_FIELDS.has(entityField)) {
          obj[entityField] = toDateISO(val);
        } else if (DATE_PRIMARIE.has(entityField)) {
          // Immissione, inizio e fine trasporto (e la chiusura): si convertono
          // per il campo, non perche' la cella sia arrivata come Date. Una
          // colonna esportata come testo o come numero generico finiva in
          // archivio come stringa e le tre date obbligatorie risultavano
          // mancanti su tutte le righe del caricamento.
          obj[entityField] = dataPrimaria(val);
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
    }).filter(r => r[keyField] && (!config.statoFilter || (r.stato || '').toLowerCase().trim() === config.statoFilter));

    // 3b. Enrichment
    // I due report del portale non necessitano di enrichment: i campi calcolati (mese,
    // classe, regione, settimana) derivano da date e prodotti che queste entita' non hanno,
    // e su oltre 18.000 righe la passata sarebbe solo un costo.
    const senzaEnrichment = tipo_file === 'dichiarazioni_trattamento' || tipo_file === 'ordini_non_dichiarati';
    const enriched = senzaEnrichment ? mapped : enrichRecords(mapped, config.entity);

    // === 4. Controllo sul contenuto (primarie: almeno un terminato) ===
    if (tipo_file === 'primarie') {
      const hasTerminato = enriched.some(r => (r.stato || '').toLowerCase().trim() === 'terminato');
      if (!hasTerminato) {
        const errResp = { error: "Il file non contiene alcun ordine terminato: sembra una selezione filtrata (es. soli assegnati), non l'export completo delle primarie." };
        await base44.asServiceRole.entities.UploadLog.create({
          utente: (user && (user.full_name || user.email)) || '',
          tipo_file, nome_file, file_url, righe_importate: 0, righe_fallite: 0,
          esito: 'errore', messaggio: errResp.error,
          periodo_riferimento: periodo_riferimento || '', foglio_usato: sheetName
        });
        return Response.json(errResp, { status: 400 });
      }
    }

    // === 5. Se zero righe valide, interrompi ===
    if (enriched.filter(r => r[keyField]).length === 0) {
      const errResp = { error: 'Nessuna riga valida trovata nel file' };
      await base44.asServiceRole.entities.UploadLog.create({
          utente: (user && (user.full_name || user.email)) || '',
        tipo_file, nome_file, file_url, righe_importate: 0, righe_fallite: 0,
        esito: 'errore', messaggio: errResp.error,
        periodo_riferimento: periodo_riferimento || '', foglio_usato: sheetName
      });
      return Response.json(errResp, { status: 400 });
    }

    // === 5b. Avviso calo per ordini_non_dichiarati ===
    let avviso_calo = null;
    if (tipo_file === 'ordini_non_dichiarati') {
      const recentLogs = await base44.asServiceRole.entities.UploadLog.filter({ tipo_file: 'ordini_non_dichiarati' }, '-created_date', 5);
      const lastSuccess = recentLogs.find(l => l.esito === 'successo' || l.esito === 'parziale');
      if (lastSuccess && lastSuccess.righe_importate > 0) {
        const newCount = enriched.filter(r => r[keyField]).length;
        if (newCount < lastSuccess.righe_importate / 2) {
          avviso_calo = { righe_precedenti: lastSuccess.righe_importate, righe_attuali: newCount };
        }
      }
    }

    // === 6. Controllo anti-regressione ===
    const loadAllIds = async (entityName) => {
      const ids = new Set();
      let skip = 0;
      let hasMore = true;
      while (hasMore) {
        const batch = await base44.asServiceRole.entities[entityName].list('id', 1000, skip);
        for (const r of batch) { if (r.id_ordine) ids.add(r.id_ordine); }
        hasMore = batch.length === 1000;
        skip += 1000;
        if (hasMore) await sleep(100);
      }
      return ids;
    };

    let righe_archivio_prima = 0;
    let avviso_date = null;
    // Lo storico conservato (storicoConservato.ts): per secondarie e terziarie,
    // i terminati con la fine trasporto prima dell'anno da cui comincia il file.
    let storico = null; // { anno_inizio, archivio, ordini, righe }

    const antiRegressionTypes = ['primarie', 'secondarie', 'terziarie'];
    fase = 'controllo anti-regressione';
    if (antiRegressionTypes.includes(tipo_file)) {
      let existingIds;
      if (tipo_file === 'primarie') {
        existingIds = new Set();
        for (const ent of ['PrimariaRete', 'PrimariaAci', 'Assegnato', 'AssegnatoAci']) {
          const ids = await loadAllIds(ent);
          for (const id of ids) existingIds.add(id);
        }
      } else {
        const annoInizio = annoInizioFile(enriched);
        if (annoInizio) {
          // Servono anche stato e fine trasporto, non solo gli ID.
          const archivio = [];
          for (let skip = 0; ; skip += 1000) {
            const batch = await base44.asServiceRole.entities[config.entity].list('id', 1000, skip, ['id_ordine', 'stato', 'trasporto_finito_il', 'ordine_immesso_il']);
            archivio.push(...batch);
            if (batch.length < 1000) break;
            await sleep(100);
          }
          existingIds = new Set(archivio.filter(r => r.id_ordine).map(r => String(r.id_ordine)));
          const idNelFile = new Set(enriched.filter(r => r[keyField]).map(r => String(r[keyField])));
          const c = ordiniDaConservare(archivio, annoInizio, idNelFile);
          const lasciati = cancellatiDaLasciare(archivio, annoInizio, idNelFile);
          if (c.ordini.size || lasciati.size) storico = { anno_inizio: annoInizio, archivio, ordini: c.ordini, righe: c.righe, lasciati };
        } else {
          existingIds = await loadAllIds(config.entity);
        }
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
              error: "Controllo anti-regressione non attendibile: impossibile leggere gli identificativi in archivio. Caricamento annullato per sicurezza.",
              fase, dati_intatti: true,
            }, { status: 500 });
          }
        }
      }

      const fileIds = new Set(enriched.filter(r => r[keyField]).map(r => r[keyField]));
      const mancanti = [];
      for (const id of existingIds) { if (!fileIds.has(id) && !(storico && (storico.ordini.has(String(id)) || storico.lasciati.has(String(id))))) mancanti.push(id); }

      if (mancanti.length > 0 && !conferma_forzatura) {
        const errResp = {
          error: "Il file contiene meno dati di quelli gia' presenti in archivio",
          righe_file: fileIds.size, righe_archivio: existingIds.size,
          mancanti: mancanti.length, esempi_mancanti: mancanti.slice(0, 10),
          richiede_conferma: true
        };
        await base44.asServiceRole.entities.UploadLog.create({
          utente: (user && (user.full_name || user.email)) || '',
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
    } else if (tipo_file === 'dichiarazioni_trattamento') {
      // Anti-regressione con chiave composta: ordine_primaria + id_dichiarazione
      const existingKeys = new Set();
      let skipD = 0, hasMoreD = true;
      while (hasMoreD) {
        const batch = await base44.asServiceRole.entities.DichiarazioneTrattamento.list('id', 1000, skipD);
        for (const r of batch) {
          if (r.ordine_primaria) existingKeys.add(`${r.ordine_primaria}|${r.id_dichiarazione || ''}`);
        }
        hasMoreD = batch.length === 1000;
        skipD += 1000;
        if (hasMoreD) await sleep(100);
      }
      righe_archivio_prima = existingKeys.size;

      const fileKeys = new Set(enriched.filter(r => r.ordine_primaria).map(r => `${r.ordine_primaria}|${r.id_dichiarazione || ''}`));
      const mancanti = [];
      for (const k of existingKeys) { if (!fileKeys.has(k)) mancanti.push(k); }

      if (mancanti.length > 0 && !conferma_forzatura) {
        const errResp = {
          error: "Il file contiene meno dichiarazioni di quelle gia' presenti in archivio",
          righe_file: fileKeys.size, righe_archivio: existingKeys.size,
          mancanti: mancanti.length, esempi_mancanti: mancanti.slice(0, 10),
          richiede_conferma: true
        };
        await base44.asServiceRole.entities.UploadLog.create({
          utente: (user && (user.full_name || user.email)) || '',
          tipo_file, nome_file, file_url, righe_importate: 0, righe_fallite: 0,
          esito: 'errore', messaggio: `${errResp.error} (${mancanti.length} dichiarazioni mancanti su ${existingKeys.size} in archivio)`,
          periodo_riferimento: periodo_riferimento || '', foglio_usato: sheetName,
          righe_archivio_prima: existingKeys.size, forzato: false
        });
        return Response.json(errResp, { status: 409 });
      }
    }

    // === 7. SOLO ORA: riga "in_corso" nel registro, cancellazione e import ===
    fase = 'apertura del registro';
    const aperto = await apriCaricamento(base44, user, tipo_file, nome_file, file_url, righe_archivio_prima);
    if (aperto.bloccato) return Response.json({ error: aperto.bloccato, dati_intatti: true }, { status: 409 });
    rigaRegistro = aperto.id;

    fase = 'scrittura dei record';
    const importBucket = async (rows, entityName, campi = null, sostituisci = true, kf = 'id_ordine') => {
      const records = campi
        ? rows.map(r => { const o = {}; for (const f of campi) o[f] = r[f] ?? null; return o; }).filter(r => r[kf])
        : rows.filter(r => r[kf]);

      let toImport = records;
      if (sostituisci) {
        // Sostituzione: cancella tutto e ricarica, tranne lo storico conservato
        // degli anni prima del file, quando c'e'.
        archivioToccato = true;
        const conserva = storico && entityName === config.entity ? storico : null;
        await svuotaTranne(base44.asServiceRole.entities[entityName], conserva ? conserva.archivio : [], conserva ? conserva.ordini : null, sleep);
      } else {
        // Modalita' additiva: filtra i record il cui id_ordine e' gia' presente
        const existingIds = new Set();
        let skip = 0;
        let hasMore = true;
        while (hasMore) {
          const batch = await base44.asServiceRole.entities[entityName].list('id', 1000, skip);
          for (const r of batch) { if (r.id_ordine) existingIds.add(r.id_ordine); }
          hasMore = batch.length === 1000;
          skip += 1000;
          if (hasMore) await sleep(100);
        }
        toImport = records.filter(r => r.id_ordine && !existingIds.has(r.id_ordine));
      }
      if (toImport.length) archivioToccato = true;

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
            if (attempt < 2) await sleep(1000 * (attempt + 1));
          }
        }
        if (!success) fail += chunk.length;
        await sleep(200);
      }
      return { imp, fail, lastError };
    };

    let imported = 0, failed = 0, lastError = null;
    let assegnati_importati = 0, assegnati_falliti = 0;
    let assegnati_aci_importati = 0, assegnati_aci_falliti = 0;
    let primarie_rete_importati = 0, primarie_rete_falliti = 0;
    let primarie_aci_importati = 0, primarie_aci_falliti = 0;

    if (config.splitByStatoClasse) {
      const bucket = { PrimariaRete: [], PrimariaAci: [], Assegnato: [], AssegnatoAci: [] };
      for (const r of enriched) {
        if (r.id_ordine) bucket[archivioPrimaria(r)].push(r);
      }
      const bucketRete = bucket.PrimariaRete, bucketAci = bucket.PrimariaAci;
      const bucketAssRete = bucket.Assegnato, bucketAssAci = bucket.AssegnatoAci;
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
      const r = await importBucket(enriched, config.entity, null, sostituisci, keyField);
      imported = r.imp; failed = r.fail; lastError = r.lastError;
    }

    // === 7b. Le dichiarazioni caricate a portale si riconoscono da sole ===
    // Il report dice, per ogni caricamento, il giorno e i materiali usciti; i pesi
    // coincidono al chilo con le nostre righe mensili. Cosi' non c'e' piu' bisogno
    // di segnare a mano, impianto per impianto, che cosa e' stato dichiarato.
    // Ogni anno presente nel report, come l'azione "allinea" di importaBlocco
    // (la strada usata oggi per questo report) e il pulsante di Dichiarazioni
    // Impianti; l'anno e' quello del giorno italiano, come lo legge
    // allineaDalPortale: tagliando la stringa UTC un caricamento del 1 gennaio a
    // mezzanotte italiana finiva nell'anno prima.
    let allineamento = null;
    if (tipo_file === 'dichiarazioni_trattamento' && imported > 0) {
      fase = 'allineamento delle dichiarazioni mensili';
      try {
        const anni = [...new Set(enriched.map(r => annoRoma(r.data_dichiarazione)).filter(Boolean))].sort((x, y) => x - y);
        const aggiornate = [];
        const nonTrovate = [];
        for (const a of anni) {
          const esito = await allineaDalPortale(base44.asServiceRole.entities, a, enriched);
          aggiornate.push(...esito.aggiornate.map(x => ({ ...x, anno: a })));
          nonTrovate.push(...esito.non_trovate.map(x => ({ ...x, anno: a })));
        }
        if (anni.length) allineamento = { anni, aggiornate, non_trovate: nonTrovate };
      } catch (e) {
        allineamento = { errore: e && e.message ? e.message : String(e) };
      }
    }

    // === 8. Log ===
    const esito = failed === 0 ? 'successo' : (imported > 0 ? 'parziale' : 'errore');
    const totaleDaImportare = config.splitByStatoClasse
      ? primarie_rete_importati + primarie_aci_importati + assegnati_importati + assegnati_aci_importati
      : enriched.length;
    const durata_secondi = Math.round((Date.now() - startTime) / 1000);
    const suffissoDurata = ` [durata: ${durata_secondi}s]`;
    const messaggio = config.splitByStatoClasse
      ? `Rete: ${primarie_rete_importati} | ACI: ${primarie_aci_importati} | Ass. Rete: ${assegnati_importati} | Ass. ACI: ${assegnati_aci_importati} (foglio: ${sheetName})${suffissoDurata}`
      : `${imported} righe importate su ${enriched.length} da importare (foglio: ${sheetName})${suffissoDurata}`;
    const notaAllineamento = allineamento && allineamento.aggiornate
      ? ` | dichiarazioni riconosciute a portale: ${perCanale(allineamento.aggiornate)}`
      : (allineamento && allineamento.errore ? ` | allineamento non riuscito: ${allineamento.errore}` : '');
    // La riga aperta prima di svuotare prende l'esito: e' questo aggiornamento a
    // far partire gli alert (workflow AlertEngineAutoRun, su create e update).
    // Se dopo lo svuotamento non e' entrata nessuna riga l'archivio e' vuoto: la
    // riga resta "in_corso" e cambia solo il messaggio (vedi NON_RIUSCITO).
    const registro = {
      utente: chi(user),
      tipo_file, nome_file, file_url,
      righe_importate: imported, righe_fallite: failed, esito,
      messaggio: messaggio + notaAllineamento, periodo_riferimento: periodo_riferimento || '',
      foglio_usato: sheetName, righe_archivio_prima, forzato: !!conferma_forzatura,
      modalita
    };
    if (rigaRegistro && esito === 'errore' && sostituisci) {
      await base44.asServiceRole.entities.UploadLog.update(rigaRegistro, {
        messaggio: `${NON_RIUSCITO}: nessuna riga scritta dopo lo svuotamento dell'archivio (${messaggio}${lastError ? ` - ultimo errore: ${lastError}` : ''}). L'archivio e' vuoto: ricarica il file.`,
      });
    } else if (rigaRegistro) await base44.asServiceRole.entities.UploadLog.update(rigaRegistro, registro);
    else await base44.asServiceRole.entities.UploadLog.create(registro);
    rigaRegistro = null;

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
      avviso_calo,
      allineamento,
      // I terminati degli anni prima del file, rimasti in archivio.
      storico_conservato: storico && storico.righe ? { dal_anno: storico.anno_inizio, righe: storico.righe } : null,
      forzato: !!conferma_forzatura,
      modalita,
      durata_secondi
    });
  } catch (error) {
    try {
      const base44 = conLimiteRichieste(createClientFromRequest(req));
      const motivo = `${error.message || 'Errore imprevisto'} (fase: ${fase})`;
      if (rigaRegistro && archivioToccato) {
        // L'archivio puo' essere vuoto o a meta': la riga resta "in_corso" e
        // cambia solo il messaggio, con la fase in cui ci si e' fermati.
        await base44.asServiceRole.entities.UploadLog.update(rigaRegistro, {
          messaggio: `${NON_RIUSCITO} dopo lo svuotamento dell'archivio: ${motivo}. L'archivio puo' essere vuoto o incompleto: ricarica il file.`,
        });
      } else {
        // Prima dello svuotamento: dati intatti, la riga si chiude in errore.
        const campi = {
          utente: chi(user),
          tipo_file, nome_file, file_url, righe_importate: 0, righe_fallite: 0,
          esito: 'errore', messaggio: motivo,
          periodo_riferimento: ''
        };
        if (rigaRegistro) await base44.asServiceRole.entities.UploadLog.update(rigaRegistro, campi);
        else await base44.asServiceRole.entities.UploadLog.create(campi);
      }
    } catch (_) {}
    return Response.json({ error: error.message, fase, dettaglio: 'Interruzione durante: ' + fase, dati_intatti: !archivioToccato }, { status: 500 });
  }
}