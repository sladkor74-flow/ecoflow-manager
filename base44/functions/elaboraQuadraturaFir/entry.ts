import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { normalizzaLettura } from "../../shared/quadraturaFir.ts";
import {
  caricaGestionale, confrontaSettimana, righeDaConservare, righeConservate, TIPI_CARICAMENTO,
} from "../../shared/quadraturaFirDati.ts";
import { statoCaricamenti, caricamentiDuranteLettura, descriviCaricamento } from "../../shared/reportSettimanali.ts";
import { valoreCampo, leggiJson } from "../../shared/testoLungo.ts";
import { eAmministratore, rispostaSolaLettura } from "../../shared/permessi.ts";
import { cancellaFile } from "../../shared/fileArchivio.ts";

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
// documenti della qualifica. Finita la lettura si prova a cancellare il file,
// ma oggi la piattaforma non lo consente (405) e quindi resta nell'archivio
// privato: nella quadratura restano comunque soltanto i numeri e l'esito.
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
  'Ogni tabella ha una sola colonna di etichette, con due livelli: la riga dell\'impianto di destinazione, in grassetto e non rientrata, e sotto di essa le righe dei suoi trasportatori, rientrate. La riga dell\'impianto porta gia\' il subtotale del gruppo, cioe\' la somma delle righe rientrate che la seguono. Poi ci sono due colonne di numeri: il conteggio dei formulari e la somma dei chilogrammi.',
  '',
  'Trascrivi ogni tabella. Per ogni tabella:',
  '- righe: una voce per ogni riga rientrata, cioe\' per ogni coppia impianto + trasportatore, con l\'impianto del gruppo a cui appartiene. Copia i nomi esattamente come sono stampati, anche se sono tagliati a meta\' dalla larghezza della colonna.',
  '- subtotali: una voce per ogni riga di impianto, quella in grassetto.',
  '- totale_conteggio e totale_kg: la riga "Totale complessivo".',
  '',
  'Regole:',
  '- I pesi sono chilogrammi e il punto separa le migliaia: "273.170" sono 273170 chilogrammi, "18.310" sono 18310. Scrivi i numeri senza separatori.',
  '- Una riga di impianto non va mai messa anche fra le righe: ci sono impianti con un solo trasportatore, dove le due righe portano gli stessi numeri, e vanno trascritte una come subtotale e una come riga.',
  '- Prima di rispondere controlla due conti, e se non tornano rileggi: le righe di ogni gruppo devono sommare il subtotale del suo impianto, e tutte le righe insieme devono fare il totale complessivo.',
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

// Legge la stampa dall'archivio privato con un link firmato che vale un quarto d'ora.
// Se la prima lettura non torna con i totali stampati si richiama la stessa
// funzione dicendo che cosa non tornava: e' quello che farebbe una persona,
// riguardare il foglio sapendo dove cercare l'errore.
async function leggiDocumento(base44, fileUri, problemi = null) {
  const core = base44.asServiceRole.integrations.Core;
  const { signed_url } = await core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 900 });
  const prompt = problemi && problemi.length
    ? [
      PROMPT, '',
      'ATTENZIONE: una prima lettura di questo stesso documento non torna con i numeri stampati sul file.',
      ...problemi.map(p => '- ' + p),
      '',
      'Rileggi il documento con calma partendo da capo. Controlla soprattutto a quale impianto appartiene ogni riga rientrata: un impianto con un solo trasportatore ha due righe con gli stessi numeri, una di gruppo e una di dettaglio, e vanno tenute distinte. Le righe di ogni gruppo devono sommare il subtotale del suo impianto, e tutte le righe insieme il totale complessivo.',
    ].join('\n')
    : PROMPT;
  const risposta = await core.InvokeLLM({ prompt, file_urls: [signed_url], response_json_schema: SCHEMA_LETTURA });
  return comeOggetto(risposta);
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
    let letture = 0;
    if (file_uri) {
      letto = await leggiDocumento(base44, file_uri);
      modo = 'agente';
      letture = 1;
    } else if (Array.isArray(tabelle)) {
      letto = { settimana: null, anno: null, tabelle, note: '' };
      modo = 'excel';
    } else if (solo_confronto) {
      letto = righeConservate(await leggiJson(base44, 'QuadraturaFir', q, 'righe_json', null));
      if (!letto) throw new Error('Non ci sono righe salvate: ricarica il file.');
    } else {
      return Response.json({ error: 'Serve un file caricato, delle tabelle o solo_confronto' }, { status: 400 });
    }

    let lettura = normalizzaLettura(letto);
    // Una scansione fitta si legge male: se i conti del file non tornano si
    // rilegge una volta sola, dicendo all'agente che cosa non tornava.
    if (file_uri && !lettura.verificata) {
      try {
        const secondo = await leggiDocumento(base44, file_uri, lettura.problemi);
        const altra = normalizzaLettura(secondo);
        letture = 2;
        if (altra.verificata) {
          lettura = altra;
          letto = secondo;
          lettura.problemi.push('La prima lettura non tornava con i totali stampati: il documento è stato riletto e la seconda lettura quadra.');
        } else {
          lettura.problemi.push('Il documento è stato letto due volte e nessuna delle due torna con i totali stampati: controlla la trascrizione sull\'originale.');
        }
      } catch (e) {
        lettura.problemi.push('La rilettura non è riuscita: ' + (e && e.message ? e.message : e));
      }
    }
    if (file_uri) cancellazione = (await cancellaFile(base44, file_uri)).come;
    // Ripetendo il confronto la lettura del file non cambia: restano i problemi
    // trovati quando e' stato letto (seconda lettura, righe riassegnate con i
    // subtotali), che le righe conservate da sole non raccontano piu', e la sua
    // descrizione salvata non si tocca. Lo stesso fa rifaiQuadratura.
    let letturaSalvata = null;
    if (modo === 'salvate') {
      try { letturaSalvata = await leggiJson(base44, 'QuadraturaFir', q, 'lettura_json', null); } catch { /* valgono i problemi di adesso */ }
      if (letturaSalvata && Array.isArray(letturaSalvata.problemi)) lettura.problemi = letturaSalvata.problemi;
      else letturaSalvata = null;
    }
    if (!lettura.tabelle.length) {
      throw new Error('Nel file non ho trovato nessuna tabella con il conteggio e la somma dei formulari.' + (lettura.note ? ' ' + lettura.note : ''));
    }

    // 2. i numeri del gestionale nella settimana. Lo stato dei caricamenti si
    // legge prima e dopo gli archivi: un caricamento partito o finito mentre li
    // si leggeva non si vedrebbe con una lettura sola.
    const periodo = { anno: q.anno, settimana: q.settimana, inizio: q.data_inizio, fine: q.data_fine };
    const primaDegliArchivi = await statoCaricamenti(base44, TIPI_CARICAMENTO);
    const gestionale = await caricaGestionale(base44, periodo, null, { caricamenti: primaDegliArchivi });
    const durante = caricamentiDuranteLettura(primaDegliArchivi, await statoCaricamenti(base44, TIPI_CARICAMENTO));

    // 3. il confronto, con la conformita' canale per canale dentro l'esito. La
    // stampa si salva lo stesso, perche' l'ha caricata l'amministratore; se un
    // archivio si stava riscrivendo lo si dice, e all'apertura della settimana, a
    // caricamento finito, il confronto si rifa' da solo.
    const esito = confrontaSettimana(lettura, gestionale, periodo);
    for (const a of durante) {
      esito.osservazioni.push(`Caricamento ${descriviCaricamento(a)}. I numeri del gestionale usati in questo confronto potevano essere incompleti: il confronto si rifà all'apertura della settimana, a caricamento finito.`);
    }

    const righeSalvate = modo === 'salvate' ? null : righeDaConservare(lettura);

    const aggiornamento = {
      stato: 'completata',
      settimana_indicata: lettura.settimana_indicata || undefined,
      tabelle: lettura.tabelle.length,
      righe_lette: lettura.tabelle.reduce((n, t) => n + t.righe.length, 0),
      lettura_verificata: !!lettura.verificata,
      // La conformita' si salva canale per canale: i conteggi e il verdetto
      // complessivi sommavano rete, ACI ed extra raccolta.
      per_canale: esito.per_canale,
      verificata_il: new Date().toISOString(),
      errore: '',
      esito_json: await valoreCampo(base44, 'QuadraturaFir', quadratura_id, 'esito_json', JSON.stringify(esito)),
    };
    if (!letturaSalvata) {
      aggiornamento.lettura_json = await valoreCampo(base44, 'QuadraturaFir', quadratura_id, 'lettura_json', JSON.stringify({
        modo, letture, note: lettura.note, problemi: lettura.problemi, cancellazione_file: cancellazione,
        tabelle: lettura.tabelle.map(t => ({
          titolo: t.titolo, fonte: t.fonte, flusso: t.flusso, unita: t.unita,
          righe: t.righe.length, somma: t.somma, stampato: t.stampato,
          quadra: t.quadra, quadra_totali: t.quadra_totali, ricostruita: t.ricostruita,
        })),
      }));
    }
    if (righeSalvate) {
      aggiornamento.righe_json = await valoreCampo(base44, 'QuadraturaFir', quadratura_id, 'righe_json', JSON.stringify(righeSalvate));
    }
    await svc.QuadraturaFir.update(quadratura_id, aggiornamento);

    return Response.json({ ok: true, per_canale: esito.per_canale, tabelle: lettura.tabelle.length, lettura_verificata: !!lettura.verificata });
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
