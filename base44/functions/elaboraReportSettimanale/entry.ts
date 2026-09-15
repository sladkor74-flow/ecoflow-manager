import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  caricaMovimenti, verificaReport, normalizzaRigheReport, CAMPI_REPORT,
} from "../../shared/reportSettimanali.ts";
import { valoreCampo, leggiCampo } from "../../shared/testoLungo.ts";

// Legge il report settimanale di un impianto o di uno stoccaggio e lo confronta
// con il gestionale: gli ingressi con le primarie, le uscite con le secondarie.
//
// Payload, uno dei tre:
//   { verifica_id, tabelle: [{ nome, riga_iniziale, righe: [[...], ...] }] }  file Excel o CSV
//   { verifica_id, file: { nome, mime, base64 } }                              PDF o immagine
//   { verifica_id, solo_verifica: true }        ripete il confronto sulle righe gia' lette
//
// Il file non viene mai salvato. Un Excel arriva gia' aperto dal browser; un PDF
// o un'immagine passano direttamente all'agente e vengono scartati. Nella
// verifica restano solo i dati letti, che si cancellano con lei.
//
// Negli Excel l'agente individua soltanto quali colonne contengono formulario,
// peso, date e soggetti: i valori li legge il codice, cosi' un formulario non
// viene mai ritrascritto. In un PDF o in un'immagine invece la trascrizione e'
// dell'agente, e l'esito lo segnala perche' i formulari errati si confermino
// sull'originale.

const LIMITE_BASE64 = 7 * 1024 * 1024;

const SCHEMA_COLONNE = {
  type: 'object',
  properties: Object.fromEntries(CAMPI_REPORT.map(c => [c, { type: 'integer' }])),
  required: CAMPI_REPORT,
};

const SCHEMA_MAPPATURA = {
  type: 'object',
  properties: {
    riconosciuto: { type: 'boolean' },
    foglio: { type: 'string' },
    prima_riga_dati: { type: 'integer' },
    unita_peso: { type: 'string', enum: ['kg', 't', 'non_determinabile'] },
    colonne: SCHEMA_COLONNE,
    note: { type: 'string' },
  },
  required: ['riconosciuto', 'foglio', 'prima_riga_dati', 'unita_peso', 'colonne'],
};

const GUIDA_CAMPI = [
  'fir: numero del formulario di identificazione rifiuto, detto anche FIR, formulario, n. formulario, n. documento di trasporto.',
  'peso: peso netto o peso effettivo o quantita\' in chilogrammi o tonnellate.',
  'data_inizio: data di inizio trasporto, di partenza, di ritiro o di carico.',
  'data_fine: data di fine trasporto, di arrivo, di ingresso o di scarico.',
  'data: una sola data generica, solo se il file non distingue inizio e fine.',
  'produttore: produttore o detentore del rifiuto, punto di raccolta, gommista, cliente.',
  'codice_pdr: codice numerico del punto di raccolta o del produttore.',
  'destinatario: impianto o stoccaggio di destinazione.',
  'trasportatore: trasportatore o vettore.',
  'classe: classe o tipologia di PFU, come P, M, G1, G2, autodemolizione.',
  'targa: targa del mezzo.',
];

function testoCella(v) {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s.length > 40 ? s.slice(0, 40) + '…' : s;
}

function anteprima(tabelle) {
  return tabelle.slice(0, 6).map(t => {
    const righe = (t.righe || []).slice(0, 30).map((r, i) => {
      const celle = (r || []).slice(0, 30).map((c, j) => `[${j}] ${testoCella(c)}`).join(' | ');
      return `riga ${i}: ${celle}`;
    });
    return `FOGLIO "${t.nome}" (${(t.righe || []).length} righe)\n${righe.join('\n')}`;
  }).join('\n\n');
}

async function leggiTabelle(base44, tabelle, verifica) {
  const mappa = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: [
      `Ti mostro l'inizio di un file inviato da ${verifica.soggetto_nome}, impianto o stoccaggio di pneumatici fuori uso.`,
      'Il file e\' il report settimanale dei carichi ricevuti ed eventualmente di quelli spediti: una riga per ogni carico.',
      'Individua il foglio che contiene i carichi, la prima riga di dati, cioe\' la prima riga dopo le intestazioni, e il numero di colonna di ciascun campo.',
      'Se ingressi e uscite stanno in fogli diversi, scegli il foglio degli ingressi.',
      'I numeri di riga e di colonna sono quelli tra parentesi e partono da zero.',
      'Se un campo non c\'e\', indica -1. Non inventare colonne: se hai dubbi, -1.',
      '',
      'Campi:',
      ...GUIDA_CAMPI.map(g => '- ' + g),
      '',
      'unita_peso: kg o t, deducendola dall\'intestazione o dai valori; non_determinabile se non si capisce.',
      'riconosciuto: false se il file non contiene un elenco di carichi con almeno il formulario o il peso.',
      'note: una frase su come e\' fatto il file, in italiano.',
      '',
      anteprima(tabelle),
    ].join('\n'),
    response_json_schema: SCHEMA_MAPPATURA,
  });
  const m = typeof mappa === 'string' ? JSON.parse(mappa) : mappa;

  const tabella = tabelle.find(t => t.nome === m.foglio) || tabelle[0];
  const col = m.colonne || {};
  if (!m.riconosciuto || !tabella || ((col.fir ?? -1) < 0 && (col.peso ?? -1) < 0)) {
    throw new Error('Nel file non ho trovato un elenco di carichi con formulario o peso' + (m.note ? ': ' + m.note : '.'));
  }

  const grezze = [];
  const righe = tabella.righe || [];
  for (let i = Math.max(0, m.prima_riga_dati || 0); i < righe.length; i++) {
    const r = righe[i] || [];
    const g = { n: (tabella.riga_iniziale || 0) + i + 1 };
    for (const c of CAMPI_REPORT) g[c] = (col[c] ?? -1) >= 0 ? r[col[c]] : null;
    grezze.push(g);
  }
  const unita = m.unita_peso === 'kg' || m.unita_peso === 't' ? m.unita_peso : null;
  const { righe: normalizzate, unita: unitaUsata } = normalizzaRigheReport(grezze, unita);
  const intestazioni = righe[Math.max(0, (m.prima_riga_dati || 1) - 1)] || [];
  const colonneLette = Object.fromEntries(CAMPI_REPORT.filter(c => (col[c] ?? -1) >= 0).map(c => [c, testoCella(intestazioni[col[c]]) || `colonna ${col[c] + 1}`]));

  return {
    righe: normalizzate,
    lettura: { modo: 'excel', foglio: tabella.nome, prima_riga_dati: (tabella.riga_iniziale || 0) + (m.prima_riga_dati || 0) + 1, unita: unitaUsata, colonne: colonneLette, note: m.note || '' },
  };
}

function estraiJson(testo) {
  const s = String(testo || '');
  const inizio = s.indexOf('{');
  const fine = s.lastIndexOf('}');
  if (inizio < 0 || fine <= inizio) throw new Error('L\'agente non ha restituito un elenco leggibile.');
  return JSON.parse(s.slice(inizio, fine + 1));
}

async function leggiFile(base44, file, verifica) {
  if (!file || !file.base64) throw new Error('File mancante');
  if (file.base64.length > LIMITE_BASE64) throw new Error('Il file e\' troppo grande per essere letto: carica la versione Excel del report.');

  const gateway = base44.aiGateway && typeof base44.aiGateway.connection === 'function'
    ? await Promise.resolve(base44.aiGateway.connection())
    : null;
  if (!gateway || !gateway.baseURL) {
    throw new Error('La lettura di PDF e immagini non e\' disponibile su questa app: carica la versione Excel del report.');
  }

  const prompt = [
    `Il documento allegato e' il report settimanale di ${verifica.soggetto_nome}, impianto o stoccaggio di pneumatici fuori uso, con i carichi ricevuti ed eventualmente quelli spediti.`,
    'Trascrivi ogni carico, ricevuto o spedito, come una riga. Non riassumere, non accorpare, non saltare righe.',
    'Il numero di formulario va copiato carattere per carattere esattamente come e\' scritto, anche se ti sembra sbagliato: la verifica serve proprio a trovare gli errori.',
    'Date nel formato AAAA-MM-GG. Pesi come numeri esattamente come scritti, con il punto come separatore decimale.',
    'Lascia vuoto un campo che nel documento non c\'e\'.',
    '',
    'Campi di ogni riga:',
    '- riga: numero progressivo della riga nel documento',
    ...GUIDA_CAMPI.map(g => '- ' + g),
    '',
    'Rispondi solo con un oggetto JSON cosi\' fatto:',
    '{"unita_peso": "kg" oppure "t", "righe": [{"riga": 1, "fir": "", "peso": 0, "data_inizio": "", "data_fine": "", "data": "", "produttore": "", "codice_pdr": "", "destinatario": "", "trasportatore": "", "classe": "", "targa": ""}], "note": ""}',
  ].join('\n');

  const allegato = file.mime === 'application/pdf'
    ? { type: 'file', file: { filename: file.nome || 'report.pdf', file_data: `data:application/pdf;base64,${file.base64}` } }
    : { type: 'image_url', image_url: { url: `data:${file.mime};base64,${file.base64}` } };

  const risposta = await fetch(String(gateway.baseURL).replace(/\/+$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gateway.token}` },
    body: JSON.stringify({ model: 'automatic', messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, allegato] }] }),
  });
  if (!risposta.ok) {
    const dettaglio = (await risposta.text()).slice(0, 300);
    throw new Error(`L'agente non e' riuscito a leggere il file (${risposta.status}). Carica la versione Excel del report. ${dettaglio}`);
  }
  const dati = await risposta.json();
  const contenuto = dati && dati.choices && dati.choices[0] && dati.choices[0].message ? dati.choices[0].message.content : '';
  const testo = Array.isArray(contenuto) ? contenuto.map(p => p.text || '').join('') : contenuto;
  const letto = estraiJson(testo);

  const grezze = (letto.righe || []).map((r, i) => {
    const g = { n: Number(r.riga) || i + 1 };
    for (const c of CAMPI_REPORT) g[c] = r[c] ?? null;
    return g;
  });
  if (grezze.length === 0) throw new Error('Nel documento non ho trovato righe di carico' + (letto.note ? ': ' + letto.note : '.'));
  const { righe, unita } = normalizzaRigheReport(grezze, letto.unita_peso);
  return { righe, lettura: { modo: file.mime === 'application/pdf' ? 'pdf' : 'immagine', unita, note: letto.note || '', trascritto_da_agente: true } };
}

export default async function(req) {
  let base44 = null;
  let verificaId = null;
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: richiesto ruolo admin' }, { status: 403 });

    const body = await req.json();
    verificaId = body.verifica_id;
    if (!verificaId) return Response.json({ error: 'verifica_id obbligatorio' }, { status: 400 });

    const svc = base44.asServiceRole.entities;
    const verifica = await svc.VerificaReport.get(verificaId);
    if (!verifica) return Response.json({ error: 'Verifica non trovata' }, { status: 404 });

    let righe, lettura;
    if (body.solo_verifica) {
      if (!verifica.righe_report_json) return Response.json({ error: 'Il report non e\' ancora stato letto: caricalo di nuovo.' }, { status: 400 });
      righe = JSON.parse(await leggiCampo(base44, 'VerificaReport', verifica, 'righe_report_json'));
      const testoLettura = await leggiCampo(base44, 'VerificaReport', verifica, 'lettura_json');
      lettura = testoLettura ? JSON.parse(testoLettura) : {};
      await svc.VerificaReport.update(verificaId, { stato: 'in_verifica', avviata_il: new Date().toISOString(), errore: '' });
    } else {
      await svc.VerificaReport.update(verificaId, { stato: 'in_lettura', avviata_il: new Date().toISOString(), errore: '' });
      const esito = Array.isArray(body.tabelle) && body.tabelle.length > 0
        ? await leggiTabelle(base44, body.tabelle, verifica)
        : await leggiFile(base44, body.file, verifica);
      righe = esito.righe;
      lettura = esito.lettura;
      if (righe.length === 0) throw new Error('Il report non contiene righe con formulario o peso.');
      // Un report lungo supera la dimensione di un campo: si salva diviso in parti.
      await svc.VerificaReport.update(verificaId, {
        stato: 'in_verifica',
        righe_report_json: await valoreCampo(base44, 'VerificaReport', verificaId, 'righe_report_json', JSON.stringify(righe)),
        lettura_json: await valoreCampo(base44, 'VerificaReport', verificaId, 'lettura_json', JSON.stringify(lettura)),
      });
    }

    const { movimenti } = await caricaMovimenti(base44);
    const esito = verificaReport(righe, movimenti, {
      chiave: verifica.soggetto_chiave,
      nome: verifica.soggetto_nome,
      inizio: String(verifica.data_inizio).slice(0, 10),
      fine: String(verifica.data_fine).slice(0, 10),
    });

    await svc.VerificaReport.update(verificaId, {
      stato: 'completata',
      esito_json: await valoreCampo(base44, 'VerificaReport', verificaId, 'esito_json', JSON.stringify({ esiti: esito.esiti, assenti: esito.assenti })),
      ...esito.riepilogo,
      verificata_il: new Date().toISOString(),
      errore: '',
    });

    return Response.json({ ok: true, ...esito.riepilogo });
  } catch (error) {
    const messaggio = error && error.message ? error.message : String(error);
    if (base44 && verificaId) {
      try {
        await base44.asServiceRole.entities.VerificaReport.update(verificaId, { stato: 'errore', errore: messaggio });
      } catch (_e) { /* resta il messaggio principale */ }
    }
    return Response.json({ error: messaggio }, { status: 500 });
  }
}
