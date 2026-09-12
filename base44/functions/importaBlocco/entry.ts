import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { SHEET_MAP, NUMERIC_FIELDS } from "../../shared/excelSchemas.ts";
import { FILE_SIGNATURES, checkSignature, detectType } from "../../shared/fileSignatures.ts";

// Importazione a blocchi per i report di grandi dimensioni del portale Ecotyre.
//
// Perche' esiste: il report delle dichiarazioni di trattamento pesa oltre 4 MB e
// contiene piu' di un milione di celle. Leggerlo dentro una function esaurisce la
// memoria disponibile e il processo viene terminato dalla piattaforma prima ancora
// che un blocco catch possa segnalare l'errore. La lettura del file avviene quindi
// nel browser, che di memoria ne ha in abbondanza, e qui arrivano solo blocchi di
// poche centinaia di righe gia' estratte.
//
// Payload: { tipo_file, nome_file, intestazioni, righe, blocco, totale_blocchi,
//            totale_righe, conferma_forzatura? }
// Il primo blocco porta le intestazioni e attiva validazione, controlli e
// cancellazione; l'ultimo scrive il registro dei caricamenti.

const SOTTO_BLOCCO = 100;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Campi che rappresentano una data: accettano seriale Excel o testo AAAA-MM-GG.
const DATE_FIELDS = new Set([
  'data_chiusura', 'data_immissione', 'inizio_trasporto', 'fine_trasporto',
  'data_esecuzione', 'data_dichiarazione',
]);

function serialeExcelInData(seriale) {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(seriale * 86400000));
}

function convertiData(val) {
  if (val === undefined || val === null || val === '') return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val.toISOString();
  const n = typeof val === 'number' ? val : Number(String(val).trim());
  if (!isNaN(n) && n > 20000) {
    const d = serialeExcelInData(n);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(String(val).trim());
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Trasforma una riga grezza del foglio nell'oggetto dell'entita'.
function mappaRiga(row, colMap) {
  const obj = {};
  for (const [colonnaExcel, campo] of Object.entries(colMap)) {
    const val = row[colonnaExcel];
    if (DATE_FIELDS.has(campo)) { obj[campo] = convertiData(val); continue; }
    if (val === undefined || val === null || val === '') { obj[campo] = null; continue; }
    if (NUMERIC_FIELDS.has(campo)) {
      const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
      obj[campo] = isNaN(n) ? null : n;
    } else {
      obj[campo] = String(val).trim();
    }
  }
  return obj;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: richiesto ruolo admin' }, { status: 403 });

    const body = await req.json();
    const {
      tipo_file, nome_file, intestazioni, righe, blocco,
      totale_blocchi, totale_righe, conferma_forzatura,
    } = body;

    if (!tipo_file || !Array.isArray(righe)) {
      return Response.json({ error: 'tipo_file e righe sono obbligatori' }, { status: 400 });
    }

    const config = SHEET_MAP[tipo_file];
    if (!config) {
      return Response.json({ error: 'tipo_file non valido: ' + tipo_file }, { status: 400 });
    }

    const entita = config.entity;

    // === PRIMO BLOCCO: validazione, controlli, cancellazione ===
    if (blocco === 0) {
      const sig = FILE_SIGNATURES[tipo_file];
      if (sig) {
        const headers = Array.isArray(intestazioni) ? intestazioni.map(h => String(h || '')) : [];
        const check = checkSignature(headers, sig);
        if (!check.match) {
          const rilevato = detectType(headers);
          const parti = [];
          if (check.chiave_mancanti.length > 0) parti.push('Colonne chiave mancanti: ' + check.chiave_mancanti.slice(0, 10).join(', '));
          if (check.vietate_trovate.length > 0) parti.push('Colonne vietate presenti: ' + check.vietate_trovate.join(', '));
          const risposta: any = {
            error: 'Formato file non valido',
            dettaglio: parti.join('. ') || 'Le intestazioni non corrispondono al tipo file richiesto',
          };
          if (rilevato && rilevato !== tipo_file) {
            risposta.tipo_rilevato = `Il file caricato sembra di tipo ${rilevato.toUpperCase()} ma e' stato caricato nello slot ${tipo_file.toUpperCase()}`;
          }
          await base44.asServiceRole.entities.UploadLog.create({
            tipo_file, nome_file: nome_file || 'N/D', righe_importate: 0, righe_fallite: 0,
            esito: 'errore', messaggio: risposta.error + (risposta.tipo_rilevato ? ' - ' + risposta.tipo_rilevato : ''),
          });
          return Response.json(risposta, { status: 400 });
        }
      }

      if (!totale_righe || totale_righe === 0) {
        return Response.json({ error: 'Nessuna riga valida trovata nel file' }, { status: 400 });
      }

      // Controllo anti-regressione basato sul conteggio delle righe.
      // Per questi report non si confrontano gli identificativi uno a uno: sarebbe
      // necessario rileggere l'intero archivio, cioe' proprio il costo che questo
      // percorso vuole evitare. Il conteggio intercetta comunque il caso concreto
      // da cui proteggersi, ossia un export troncato o parziale.
      const logs = await base44.asServiceRole.entities.UploadLog.filter(
        { tipo_file, esito: 'successo' }, '-created_date', 1
      );
      const precedenti = logs.length > 0 ? (logs[0].righe_importate || 0) : 0;

      if (tipo_file === 'dichiarazioni_trattamento' && precedenti > 0 && totale_righe < precedenti && !conferma_forzatura) {
        return Response.json({
          error: "Il file contiene meno dichiarazioni di quelle gia' presenti in archivio",
          righe_file: totale_righe, righe_archivio: precedenti,
          mancanti: precedenti - totale_righe,
          richiede_conferma: true,
        }, { status: 409 });
      }

      let avviso_calo = null;
      if (tipo_file === 'ordini_non_dichiarati' && precedenti > 0 && totale_righe < precedenti / 2) {
        avviso_calo = { precedente: precedenti, attuale: totale_righe };
      }

      await base44.asServiceRole.entities[entita].deleteMany({});

      const scritte = await scriviRighe(base44, entita, righe, config.columns);
      return Response.json({ blocco, scritte: scritte.ok, fallite: scritte.ko, avviso_calo, iniziato: true, ultimo_errore: scritte.ultimo_errore });
    }

    // === BLOCCHI SUCCESSIVI: sola scrittura ===
    const scritte = await scriviRighe(base44, entita, righe, config.columns);

    // === ULTIMO BLOCCO: registro dei caricamenti ===
    if (typeof totale_blocchi === 'number' && blocco === totale_blocchi - 1) {
      const totScritte = typeof body.totale_scritte === 'number' ? body.totale_scritte + scritte.ok : scritte.ok;
      const totFallite = typeof body.totale_fallite === 'number' ? body.totale_fallite + scritte.ko : scritte.ko;
      const esito = totFallite === 0 ? 'successo' : (totScritte > 0 ? 'parziale' : 'errore');
      await base44.asServiceRole.entities.UploadLog.create({
        tipo_file, nome_file: nome_file || 'N/D',
        righe_importate: totScritte, righe_fallite: totFallite, esito,
        messaggio: `${totScritte} righe importate in ${totale_blocchi} blocchi (lettura nel browser)` + (totFallite > 0 && scritte.ultimo_errore ? ` — ${totFallite} fallite, ultimo errore: ${scritte.ultimo_errore}` : ''),
      });
      return Response.json({ blocco, scritte: scritte.ok, fallite: scritte.ko, completato: true, totale_scritte: totScritte, esito, ultimo_errore: scritte.ultimo_errore });
    }

    return Response.json({ blocco, scritte: scritte.ok, fallite: scritte.ko, ultimo_errore: scritte.ultimo_errore });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Scrive un gruppo di record, con tentativi ripetuti e attesa crescente.
// Restituisce true se riuscito, altrimenti false registrando l'ultimo errore.
async function provaScrittura(base44, entita, gruppo, stato) {
  for (let tentativo = 0; tentativo < 3; tentativo++) {
    try {
      await base44.asServiceRole.entities[entita].bulkCreate(gruppo);
      return true;
    } catch (e) {
      stato.ultimo_errore = e && e.message ? e.message : String(e);
      if (tentativo < 2) await sleep(1000 * (tentativo + 1));
    }
  }
  return false;
}

// Mappa e scrive un blocco di righe, suddividendolo in sotto-blocchi.
//
// Quando un sotto-blocco non riesce nemmeno dopo tre tentativi, si riprova in
// gruppi di dieci righe invece di scartarne cento: in questo modo un singolo
// record problematico non trascina con se' i novantanove che lo accompagnano.
async function scriviRighe(base44, entita, righe, colMap) {
  const records = righe.map(r => mappaRiga(r, colMap));
  const stato = { ultimo_errore: null };
  let ok = 0, ko = 0;

  for (let i = 0; i < records.length; i += SOTTO_BLOCCO) {
    const chunk = records.slice(i, i + SOTTO_BLOCCO);

    if (await provaScrittura(base44, entita, chunk, stato)) {
      ok += chunk.length;
    } else {
      // Ripiego: gruppi piu' piccoli per isolare le righe che non passano.
      for (let j = 0; j < chunk.length; j += 10) {
        const piccolo = chunk.slice(j, j + 10);
        if (await provaScrittura(base44, entita, piccolo, stato)) ok += piccolo.length;
        else ko += piccolo.length;
        await sleep(150);
      }
    }
    // Pausa fra sotto-blocchi: un ritmo troppo serrato provoca rifiuti.
    await sleep(150);
  }

  return { ok, ko, ultimo_errore: stato.ultimo_errore };
}
