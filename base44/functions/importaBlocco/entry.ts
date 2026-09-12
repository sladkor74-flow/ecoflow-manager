import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { SHEET_MAP, NUMERIC_FIELDS } from "../../shared/excelSchemas.ts";
import { FILE_SIGNATURES, checkSignature, detectType } from "../../shared/fileSignatures.ts";

// Importazione a blocchi per i report di grandi dimensioni del portale Ecotyre.
//
// Perche' esiste: il report delle dichiarazioni di trattamento pesa oltre 4 MB e
// contiene piu' di un milione di celle. Leggerlo dentro una function esaurisce la
// memoria disponibile e il processo viene terminato dalla piattaforma. La lettura
// avviene quindi nel browser e qui arrivano blocchi di poche centinaia di righe.
//
// Ogni invocazione fa una cosa sola e deve restare ampiamente sotto il timeout di
// venti secondi della connessione al database. Le azioni sono:
//   prepara  - verifica la firma del file, il controllo anti-regressione e svuota
//              l'archivio precedente
//   scrivi   - scrive un blocco con una sola chiamata a bulkCreate
//   conta    - restituisce quanti record contiene l'archivio
//   registra - scrive il registro dei caricamenti a fine importazione
//
// Un blocco corrisponde a una sola scrittura: o la riga vanno tutte a buon fine o
// non ne va nessuna. Il browser puo' quindi ritentare un blocco fallito senza
// rischiare duplicati, e verificare con l'azione conta se la scrittura era invece
// arrivata a destinazione nonostante l'errore di rete.

const LIMITE_INVOCAZIONE_MS = 12000;
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

// Riconosce gli errori di rete o di attesa: non vanno ritentati qui dentro perche'
// ogni tentativo puo' bruciare venti secondi e far superare all'invocazione il
// tempo massimo concesso dalla piattaforma. Il ritentativo spetta al browser.
function eInterruzione(e) {
  const m = String(e && e.message ? e.message : e).toLowerCase();
  return m.indexOf('timed out') >= 0 || m.indexOf('timeout') >= 0
    || m.indexOf('econnreset') >= 0 || m.indexOf('socket hang up') >= 0
    || m.indexOf('connection') >= 0 || m.indexOf('network') >= 0;
}

// Conta i record dell'archivio. Il client non espone un conteggio e rileggere
// l'intero archivio costerebbe quanto l'importazione stessa: si interroga quindi
// la sola presenza di un record a una data posizione.
//
// Il browser conosce i due soli esiti possibili di un blocco: o e' entrato tutto
// o non e' entrato niente. Verificare le due ipotesi costa due interrogazioni
// ciascuna; solo se nessuna regge si procede per raddoppi e bisezione.
async function contaRecord(base44, entita, ipotesi) {
  const ent = base44.asServiceRole.entities[entita];
  const esiste = async (i) => (await ent.list('created_date', 1, i)).length > 0;

  for (const n of ipotesi) {
    if (typeof n !== 'number' || n <= 0) continue;
    if ((await esiste(n - 1)) && !(await esiste(n))) return n;
  }

  if (!(await esiste(0))) return 0;
  let basso = 0, alto = 1;
  while (await esiste(alto)) {
    basso = alto;
    alto *= 2;
    if (alto > 2000000) return alto;
  }
  while (alto - basso > 1) {
    const medio = Math.floor((basso + alto) / 2);
    if (await esiste(medio)) basso = medio; else alto = medio;
  }
  return basso + 1;
}

export default async function(req) {
  const t0 = Date.now();
  let fase = 'avvio';
  let archivioSvuotato = false;

  try {
    fase = 'autenticazione';
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized', dati_intatti: true }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: richiesto ruolo admin', dati_intatti: true }, { status: 403 });

    fase = 'lettura della richiesta';
    const body = await req.json();
    const {
      azione, tipo_file, nome_file, intestazioni, righe, blocco,
      totale_righe, conferma_forzatura, atteso, minimo,
    } = body;

    const config = SHEET_MAP[tipo_file];
    if (!config) {
      return Response.json({ error: 'tipo_file non valido: ' + tipo_file, dati_intatti: true }, { status: 400 });
    }
    const entita = config.entity;

    // === CONTEGGIO: quante righe contiene ora l'archivio ===
    if (azione === 'conta') {
      fase = 'conteggio archivio';
      const conteggio = await contaRecord(base44, entita, [atteso, minimo]);
      return Response.json({ conteggio, dati_intatti: true });
    }

    // === REGISTRAZIONE: registro dei caricamenti a fine importazione ===
    if (azione === 'registra') {
      fase = 'scrittura registro caricamenti';
      const scritte = Number(body.righe_importate) || 0;
      const fallite = Number(body.righe_fallite) || 0;
      const esito = fallite === 0 && scritte > 0 ? 'successo' : (scritte > 0 ? 'parziale' : 'errore');
      const parti = [scritte + ' righe importate (lettura nel browser)'];
      if (fallite > 0) parti.push(fallite + ' righe non scritte');
      if (body.ultimo_errore) parti.push('ultimo errore: ' + body.ultimo_errore);
      if (typeof body.conteggio_finale === 'number') parti.push('archivio verificato: ' + body.conteggio_finale + ' record');
      await base44.asServiceRole.entities.UploadLog.create({
        tipo_file, nome_file: nome_file || 'N/D',
        righe_importate: scritte, righe_fallite: fallite, esito,
        messaggio: parti.join(' — '),
        righe_archivio_prima: typeof body.righe_archivio_prima === 'number' ? body.righe_archivio_prima : undefined,
        forzato: conferma_forzatura === true ? true : undefined,
        modalita: 'sostituzione',
      });
      return Response.json({ registrato: true, esito });
    }

    // === PREPARAZIONE: validazione, anti-regressione, svuotamento ===
    if (azione === 'prepara') {
      fase = 'verifica della firma delle intestazioni';
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
            dati_intatti: true,
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
        return Response.json({ error: 'Nessuna riga valida trovata nel file', dati_intatti: true }, { status: 400 });
      }

      // Controllo anti-regressione basato sul conteggio delle righe.
      // Per questi report non si confrontano gli identificativi uno a uno: sarebbe
      // necessario rileggere l'intero archivio, cioe' proprio il costo che questo
      // percorso vuole evitare. Il conteggio intercetta comunque il caso concreto
      // da cui proteggersi, ossia un export troncato o parziale.
      fase = 'controllo anti-regressione';
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
          dati_intatti: true,
        }, { status: 409 });
      }

      let avviso_calo = null;
      if (tipo_file === 'ordini_non_dichiarati' && precedenti > 0 && totale_righe < precedenti / 2) {
        avviso_calo = { righe_precedenti: precedenti, righe_attuali: totale_righe };
      }

      fase = "svuotamento dell'archivio precedente";
      await base44.asServiceRole.entities[entita].deleteMany({});
      archivioSvuotato = true;

      return Response.json({ preparato: true, avviso_calo, righe_archivio_prima: precedenti });
    }

    // === SCRITTURA DI UN BLOCCO ===
    if (!Array.isArray(righe) || righe.length === 0) {
      return Response.json({ error: 'Nessuna riga da scrivere in questo blocco', dati_intatti: true }, { status: 400 });
    }

    fase = 'scrittura del blocco ' + ((blocco || 0) + 1);
    const records = righe.map(r => mappaRiga(r, config.columns));
    let ultimoErrore = null;

    for (let tentativo = 0; tentativo < 2; tentativo++) {
      try {
        await base44.asServiceRole.entities[entita].bulkCreate(records);
        return Response.json({ blocco, scritte: records.length, fallite: 0 });
      } catch (e) {
        ultimoErrore = e && e.message ? e.message : String(e);
        // Un errore di rete o di attesa non si ritenta qui: ritentarlo costerebbe
        // altri venti secondi e farebbe terminare l'invocazione dalla piattaforma
        // prima che possa rispondere. Se ne occupa il browser, che non ha limiti.
        if (eInterruzione(e)) break;
        if (Date.now() - t0 > LIMITE_INVOCAZIONE_MS) break;
        await sleep(1000);
      }
    }

    // Il blocco non e' passato, ma la risposta resta un successo HTTP: il browser
    // deve poter decidere se ritentare, non ricevere un'eccezione che interrompe
    // l'intera importazione.
    return Response.json({
      blocco, scritte: 0, fallite: records.length,
      ritentabile: true, ultimo_errore: ultimoErrore,
    });

  } catch (error) {
    return Response.json({
      error: error && error.message ? error.message : String(error),
      fase,
      dati_intatti: !archivioSvuotato,
      ritentabile: eInterruzione(error),
    }, { status: 500 });
  }
}
