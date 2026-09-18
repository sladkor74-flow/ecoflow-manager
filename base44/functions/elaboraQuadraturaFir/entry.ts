import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { normalizzaLettura, confronta, sintesi } from "../../shared/quadraturaFir.ts";
import { caricaGestionale } from "../../shared/quadraturaFirDati.ts";
import { valoreCampo, leggiJson } from "../../shared/testoLungo.ts";
import { eAmministratore, rispostaSolaLettura } from "../../shared/permessi.ts";

// Legge la stampa settimanale del conteggio e della somma dei FIR e la confronta
// con il gestionale.
//
// Payload, uno dei tre:
//   { quadratura_id, file_uri, file_nome }  PDF o immagine caricata dal browser: la trascrive l'agente
//   { quadratura_id, tabelle: [...] }       tabelle gia' lette dal browser da un Excel
//   { quadratura_id, solo_confronto: true } ripete il confronto sulle righe gia' lette
//
// La stampa e' una scansione senza testo dentro, quindi la trascrive l'agente,
// che la legge dall'archivio privato con un link firmato - la stessa strada dei
// documenti della qualifica. Appena letta si prova a cancellare il file
// caricato: nella quadratura restano soltanto i numeri e l'esito del confronto.
//
// Alla trascrizione non si crede sulla parola: la stampa porta i propri totali,
// per gruppo e complessivi, e la somma delle righe lette deve farli. Se non li
// fa, la quadratura lo dice e non nasconde il dubbio.

const SCHEMA_RIGA = {
  type: 'object',
  properties: {
    impianto: { type: 'string' },
    trasportatore: { type: 'string' },
    conteggio: { type: 'integer' },
    kg: { type: 'number' },
  },
  required: ['impianto', 'trasportatore', 'conteggio', 'kg'],
};

const SCHEMA_SUBTOTALE = {
  type: 'object',
  properties: {
    impianto: { type: 'string' },
    conteggio: { type: 'integer' },
    kg: { type: 'number' },
  },
  required: ['impianto', 'conteggio', 'kg'],
};

const SCHEMA_LETTURA = {
  type: 'object',
  properties: {
    settimana: { type: 'integer' },
    anno: { type: 'integer' },
    tabelle: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titolo: { type: 'string' },
          fonte: { type: 'string', enum: ['winsinfo', 'ecotyre'] },
          righe: { type: 'array', items: SCHEMA_RIGA },
          subtotali: { type: 'array', items: SCHEMA_SUBTOTALE },
          totale_conteggio: { type: 'integer' },
          totale_kg: { type: 'number' },
        },
        required: ['titolo', 'fonte', 'righe', 'totale_conteggio', 'totale_kg'],
      },
    },
    note: { type: 'string' },
  },
  required: ['tabelle'],
};

const PROMPT = [
  'Il documento allegato e\' la stampa settimanale con cui una societa\' di raccolta di pneumatici fuori uso controlla i propri formulari di identificazione del rifiuto (FIR).',
  'Contiene una o piu\' sezioni, ognuna con un titolo come "RACCOLTA ECOTYRE SETT. 37", "SECONDARIE ECOTYRE SETT. 37", "ACI SETT. 37" oppure "EXTRA RACCOLTA".',
  'In ogni sezione ci sono due tabelle pivot con la stessa forma, una etichettata WINSINFO e una etichettata ECOTYRE: sono le due fonti da confrontare.',
  'Ogni tabella ha una colonna di etichette di riga su due livelli - prima l\'impianto di destinazione in grassetto, poi sotto, indentati, i trasportatori - e due colonne di numeri: il conteggio dei formulari e la somma dei chilogrammi.',
  '',
  'Trascrivi ogni tabella. Per ogni tabella:',
  '- righe: una voce per ogni riga di dettaglio, cioe\' per ogni coppia impianto + trasportatore. Copia i nomi esattamente come sono stampati, anche se sono tagliati a meta\' dalla larghezza della colonna.',
  '- subtotali: una voce per ogni riga di totale di impianto, quella in grassetto senza trasportatore.',
  '- totale_conteggio e totale_kg: la riga "Totale complessivo".',
  '',
  'Regole:',
  '- I pesi sono chilogrammi e il punto separa le migliaia: "273.170" sono 273170 chilogrammi, "18.310" sono 18310. Scrivi i numeri senza separatori.',
  '- Non sommare, non arrotondare e non correggere niente: copia i numeri come sono stampati, anche se non tornano.',
  '- Non inventare righe e non saltarne nessuna. Se una tabella e\' illeggibile, mettila con righe vuote e spiegalo in note.',
  '- fonte: "winsinfo" oppure "ecotyre", secondo l\'etichetta sopra la tabella.',
  '- titolo: il titolo della sezione a cui la tabella appartiene, copiato come e\' scritto.',
  '- settimana: il numero di settimana scritto nei titoli, se c\'e\'; altrimenti lascialo nullo.',
  '',
  'Rispondi solo con un oggetto JSON cosi\' fatto:',
  '{"settimana": 37, "anno": null, "tabelle": [{"titolo": "RACCOLTA ECOTYRE SETT. 37", "fonte": "winsinfo", "righe": [{"impianto": "", "trasportatore": "", "conteggio": 0, "kg": 0}], "subtotali": [{"impianto": "", "conteggio": 0, "kg": 0}], "totale_conteggio": 0, "totale_kg": 0}], "note": ""}',
].join('\n');

function comeOggetto(v) {
  if (v && typeof v === 'object') return v;
  const s = String(v || '');
  const inizio = s.indexOf('{');
  const fine = s.lastIndexOf('}');
  if (inizio < 0 || fine <= inizio) throw new Error('L\'agente non ha restituito un elenco leggibile.');
  return JSON.parse(s.slice(inizio, fine + 1));
}

// Legge la stampa dall'archivio privato con un link firmato che vale un quarto
// d'ora, poi prova a cancellare il file: quello che serve sono i numeri.
async function leggiDocumento(base44, fileUri) {
  const core = base44.asServiceRole.integrations.Core;
  const { signed_url } = await core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 900 });
  const risposta = await core.InvokeLLM({ prompt: PROMPT, file_urls: [signed_url], response_json_schema: SCHEMA_LETTURA });
  const letto = comeOggetto(risposta);

  let cancellato = 'non supportata';
  for (const nome of ['DeleteFile', 'DeletePrivateFile', 'RemoveFile']) {
    if (typeof core[nome] !== 'function') continue;
    try {
      await core[nome]({ file_uri: fileUri });
      cancellato = nome;
    } catch (e) {
      cancellato = `${nome} non riuscita: ${e && e.message ? e.message : e}`;
    }
    break;
  }
  return { letto, modo: 'agente', cancellazione_file: cancellato };
}

export default async function(req) {
  const base44 = createClientFromRequest(req);
  let quadraturaId = null;
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!eAmministratore(user)) return rispostaSolaLettura();

    const { quadratura_id, file_uri, tabelle, solo_confronto } = await req.json();
    if (!quadratura_id) return Response.json({ error: 'quadratura_id obbligatorio' }, { status: 400 });
    quadraturaId = quadratura_id;

    const svc = base44.asServiceRole.entities;
    const q = await svc.QuadraturaFir.get(quadratura_id);
    if (!q) return Response.json({ error: 'Quadratura non trovata' }, { status: 404 });

    // 1. le righe: rilette dal file, arrivate dal browser o quelle gia' salvate
    let letto;
    let modo = 'salvate';
    let cancellazione = null;
    if (file_uri) {
      const esito = await leggiDocumento(base44, file_uri);
      letto = esito.letto;
      modo = esito.modo;
      cancellazione = esito.cancellazione_file;
    } else if (Array.isArray(tabelle)) {
      letto = { settimana: null, anno: null, tabelle, note: '' };
      modo = 'excel';
    } else if (solo_confronto) {
      letto = await leggiJson(base44, 'QuadraturaFir', q, 'righe_json', null);
      if (!letto) throw new Error('Non ci sono righe salvate: ricarica il file.');
    } else {
      return Response.json({ error: 'Serve un file caricato, delle tabelle o solo_confronto' }, { status: 400 });
    }

    const lettura = normalizzaLettura(letto);
    if (!lettura.tabelle.length) {
      throw new Error('Nel file non ho trovato nessuna tabella con il conteggio e la somma dei formulari.' + (lettura.note ? ' ' + lettura.note : ''));
    }

    // 2. i numeri del gestionale nella settimana
    const periodo = { anno: q.anno, settimana: q.settimana, inizio: q.data_inizio, fine: q.data_fine };
    const gestionale = await caricaGestionale(base44, periodo);

    // 3. il confronto
    const esito = confronta(lettura, gestionale, periodo);
    const s = sintesi(esito);

    const righeSalvate = modo === 'salvate' ? null : {
      settimana: lettura.settimana_indicata, anno: lettura.anno_indicato, note: lettura.note,
      tabelle: lettura.tabelle.map(t => ({
        titolo: t.titolo, fonte: t.fonte, righe: t.righe, subtotali: t.subtotali,
        totale_conteggio: t.stampato.n, totale_kg: t.stampato.kg,
      })),
    };

    const aggiornamento = {
      stato: 'completata',
      settimana_indicata: lettura.settimana_indicata || undefined,
      tabelle: lettura.tabelle.length,
      righe_lette: lettura.tabelle.reduce((n, t) => n + t.righe.length, 0),
      lettura_verificata: !!lettura.verificata,
      congruenti: s.congruenti,
      incongruenti: s.incongruenti,
      osservazioni: s.osservazioni,
      non_confrontabili: s.non_confrontabili,
      conformita: s.conformita,
      verificata_il: new Date().toISOString(),
      errore: '',
      esito_json: await valoreCampo(base44, 'QuadraturaFir', quadratura_id, 'esito_json', JSON.stringify(esito)),
      lettura_json: await valoreCampo(base44, 'QuadraturaFir', quadratura_id, 'lettura_json', JSON.stringify({
        modo, note: lettura.note, problemi: lettura.problemi, cancellazione_file: cancellazione,
        tabelle: lettura.tabelle.map(t => ({
          titolo: t.titolo, fonte: t.fonte, flusso: t.flusso, unita: t.unita,
          righe: t.righe.length, somma: t.somma, stampato: t.stampato,
          quadra: t.quadra, quadra_totali: t.quadra_totali,
        })),
      })),
    };
    if (righeSalvate) {
      aggiornamento.righe_json = await valoreCampo(base44, 'QuadraturaFir', quadratura_id, 'righe_json', JSON.stringify(righeSalvate));
    }
    await svc.QuadraturaFir.update(quadratura_id, aggiornamento);

    return Response.json({ ok: true, sintesi: s, tabelle: lettura.tabelle.length, lettura_verificata: !!lettura.verificata });
  } catch (error) {
    const messaggio = error && error.message ? error.message : String(error);
    if (quadraturaId) {
      try {
        await base44.asServiceRole.entities.QuadraturaFir.update(quadraturaId, { stato: 'errore', errore: messaggio.slice(0, 900) });
      } catch { /* la quadratura potrebbe essere stata cancellata nel frattempo */ }
    }
    return Response.json({ error: messaggio }, { status: 500 });
  }
}
