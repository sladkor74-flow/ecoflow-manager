import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { normalizzaLettura, confronta, sintesi } from "../../shared/quadraturaFir.ts";
import { caricaGestionale } from "../../shared/quadraturaFirDati.ts";
import { valoreCampo, leggiJson } from "../../shared/testoLungo.ts";
import { eAmministratore, rispostaSolaLettura } from "../../shared/permessi.ts";

// Legge la stampa settimanale del conteggio e della somma dei FIR e la confronta
// con il gestionale.
//
// Payload, uno dei tre:
//   { quadratura_id, file: { nome, mime, base64 } }  PDF o immagine: lo trascrive l'agente
//   { quadratura_id, tabelle: [...] }                tabelle gia' lette dal browser da un Excel
//   { quadratura_id, solo_confronto: true }          ripete il confronto sulle righe gia' lette
//
// Il file non viene mai conservato: arriva, si legge e si scarta. Nella
// quadratura restano solo i numeri letti e l'esito del confronto.
//
// La trascrizione di un PDF e' dell'agente, ma non le si crede sulla parola: la
// stampa porta i propri totali, per gruppo e complessivi, e la somma delle righe
// lette deve farli. Se non li fa, la quadratura lo dice e non nasconde il dubbio.

const LIMITE_BASE64 = 7 * 1024 * 1024;

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

function estraiJson(testo) {
  const s = String(testo || '');
  const inizio = s.indexOf('{');
  const fine = s.lastIndexOf('}');
  if (inizio < 0 || fine <= inizio) throw new Error('L\'agente non ha restituito un elenco leggibile.');
  return JSON.parse(s.slice(inizio, fine + 1));
}

// La stampa e' quasi sempre una scansione, senza testo dentro: la si fa leggere
// all'agente come immagine. Il file passa in memoria e non viene salvato.
async function leggiFile(base44, file) {
  if (!file || !file.base64) throw new Error('File mancante');
  if (file.base64.length > LIMITE_BASE64) throw new Error('Il file e\' troppo grande per essere letto: dividilo o caricane la versione Excel.');

  const gateway = base44.aiGateway && typeof base44.aiGateway.connection === 'function'
    ? await Promise.resolve(base44.aiGateway.connection())
    : null;
  if (!gateway || !gateway.baseURL) {
    throw new Error('La lettura di PDF e immagini non e\' disponibile su questa app: carica il file Excel da cui hai stampato le pivot.');
  }

  const allegato = file.mime === 'application/pdf'
    ? { type: 'file', file: { filename: file.nome || 'quadratura.pdf', file_data: `data:application/pdf;base64,${file.base64}` } }
    : { type: 'image_url', image_url: { url: `data:${file.mime};base64,${file.base64}` } };

  const risposta = await fetch(String(gateway.baseURL).replace(/\/+$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gateway.token}` },
    body: JSON.stringify({ model: 'automatic', messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, allegato] }] }),
  });
  if (!risposta.ok) {
    const dettaglio = (await risposta.text()).slice(0, 300);
    throw new Error(`L'agente non e' riuscito a leggere il file (${risposta.status}). ${dettaglio}`);
  }
  const dati = await risposta.json();
  const contenuto = dati && dati.choices && dati.choices[0] && dati.choices[0].message ? dati.choices[0].message.content : '';
  const testo = Array.isArray(contenuto) ? contenuto.map(p => p.text || '').join('') : contenuto;
  return { letto: estraiJson(testo), modo: 'agente' };
}

export default async function(req) {
  const base44 = createClientFromRequest(req);
  let quadraturaId = null;
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!eAmministratore(user)) return rispostaSolaLettura();

    const { quadratura_id, file, tabelle, solo_confronto } = await req.json();
    if (!quadratura_id) return Response.json({ error: 'quadratura_id obbligatorio' }, { status: 400 });
    quadraturaId = quadratura_id;

    const svc = base44.asServiceRole.entities;
    const q = await svc.QuadraturaFir.get(quadratura_id);
    if (!q) return Response.json({ error: 'Quadratura non trovata' }, { status: 404 });

    // 1. le righe: rilette dal file, arrivate dal browser o quelle gia' salvate
    let letto;
    let modo = 'salvate';
    if (file) {
      const esito = await leggiFile(base44, file);
      letto = esito.letto;
      modo = esito.modo;
    } else if (Array.isArray(tabelle)) {
      letto = { settimana: null, anno: null, tabelle, note: '' };
      modo = 'excel';
    } else if (solo_confronto) {
      letto = await leggiJson(base44, 'QuadraturaFir', q, 'righe_json', null);
      if (!letto) throw new Error('Non ci sono righe salvate: ricarica il file.');
    } else {
      return Response.json({ error: 'Serve un file, delle tabelle o solo_confronto' }, { status: 400 });
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
        modo, note: lettura.note, problemi: lettura.problemi,
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
