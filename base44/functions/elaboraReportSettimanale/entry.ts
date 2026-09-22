import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import {
  caricaMovimenti, normalizzaRigheReport, CAMPI_REPORT, statoCaricamenti, caricamentiDuranteLettura, descriviCaricamento,
} from "../../shared/reportSettimanali.ts";
import { valoreCampo, leggiCampo } from "../../shared/testoLungo.ts";
import { calcolaEsito, salvaEsito } from "../../shared/esitoVerifica.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";

// Legge il report settimanale di un impianto o di uno stoccaggio e lo confronta
// con il gestionale: gli ingressi con le primarie, le uscite con le secondarie.
//
// Payload, uno dei tre:
//   { verifica_id, tabelle: [{ nome, riga_iniziale, righe: [[...], ...] }] }  file Excel o CSV
//   { verifica_id, file: { file_uri, mime } }                                   PDF o immagine caricata dal browser
//   { verifica_id, solo_verifica: true }        ripete il confronto sulle righe gia' lette
//   { verifica_id, nessuna_movimentazione: true } l'impianto dichiara che non ci sono state movimentazioni
//
// Se un archivio dei movimenti si sta riscrivendo, o un caricamento l'ha lasciato
// a meta', risponde 409 (rinviato): le righe lette restano salvate, esito e
// alert non si scrivono, e il riconfronto a caricamento finito completa la verifica.
//
// Un Excel arriva gia' aperto dal browser e non viene mai salvato. Un PDF o
// un'immagine, che il codice non sa leggere, si caricano nell'archivio privato
// perche' l'agente li legga da un link firmato; poi si prova a cancellarli, ma
// oggi la piattaforma non lo consente e restano li'. Nella verifica restano solo
// i dati letti, che si cancellano con lei.
//
// Negli Excel l'agente individua soltanto quali colonne contengono formulario,
// peso, date e soggetti: i valori li legge il codice, cosi' un formulario non
// viene mai ritrascritto. In un PDF o in un'immagine invece la trascrizione e'
// dell'agente, e l'esito lo segnala perche' i formulari errati si confermino
// sull'originale.


// Con piu' report caricati uno dopo l'altro la piattaforma puo' rifiutare le
// richieste troppo ravvicinate ("Rate limit exceeded"): si riprova dopo una pausa
// crescente invece di chiudere la verifica in errore.
const ATTESE_RITENTATIVO = [5000, 12000, 25000];
async function conRitentativi(fn) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const messaggio = String(e && e.message ? e.message : e);
      if (!/rate limit|too many requests|429/i.test(messaggio) || i >= ATTESE_RITENTATIVO.length) throw e;
      await new Promise(r => setTimeout(r, ATTESE_RITENTATIVO[i]));
    }
  }
}

// Schema della trascrizione di un PDF o di un'immagine: la risposta dell'agente
// arriva strutturata invece di essere ritagliata da un testo.
const SCHEMA_TRASCRIZIONE = {
  type: 'object',
  properties: {
    unita_peso: { type: 'string', enum: ['kg', 't'] },
    righe: {
      type: 'array',
      items: {
        type: 'object',
        properties: Object.fromEntries([
          ['riga', { type: 'integer' }],
          ...CAMPI_REPORT.map(c => [c, { type: 'string' }]),
        ]),
      },
    },
    note: { type: 'string' },
  },
  required: ['righe'],
};

const SCHEMA_COLONNE = {
  type: 'object',
  properties: Object.fromEntries(CAMPI_REPORT.map(c => [c, { type: 'integer' }])),
  required: CAMPI_REPORT,
};

const SCHEMA_FOGLIO = {
  type: 'object',
  properties: {
    foglio: { type: 'string' },
    contenuto: { type: 'string', enum: ['ingressi', 'uscite', 'ingressi_e_uscite'] },
    prima_riga_dati: { type: 'integer' },
    unita_peso: { type: 'string', enum: ['kg', 't', 'non_determinabile'] },
    colonne: SCHEMA_COLONNE,
  },
  required: ['foglio', 'contenuto', 'prima_riga_dati', 'unita_peso', 'colonne'],
};

const SCHEMA_MAPPATURA = {
  type: 'object',
  properties: {
    riconosciuto: { type: 'boolean' },
    fogli: { type: 'array', items: SCHEMA_FOGLIO },
    note: { type: 'string' },
  },
  required: ['riconosciuto', 'fogli'],
};

const GUIDA_CAMPI = [
  'fir: numero del formulario di identificazione rifiuto, detto anche FIR, formulario, n. formulario, numerazione fiscale, n. documento di trasporto.',
  'ordine: numero dell\'ordine o della richiesta di ritiro, come ET26149928 o SEC 26141285, detto anche n. ordine, ordine ET, ticket, n. bolla.',
  'peso: peso netto o peso effettivo o quantita\' in chilogrammi o tonnellate.',
  'data_inizio: data di inizio trasporto, di partenza, di ritiro o di carico. Non la data del documento o di emissione del formulario.',
  'data_fine: data di fine trasporto, di arrivo, di ingresso, di scarico o di registrazione del carico nel registro.',
  'data: una sola data generica, solo se il file non distingue inizio e fine.',
  'produttore: ragione sociale del produttore o detentore del rifiuto, punto di raccolta, gommista, cliente.',
  'codice_pdr: codice numerico del punto di raccolta o del produttore.',
  'destinatario: ragione sociale dell\'impianto o stoccaggio di destinazione, detto anche smaltitore o recuperatore.',
  'trasportatore: ragione sociale del trasportatore o vettore.',
  'intermediario: ragione sociale dell\'intermediario o del consorzio, come Ecotyre, Ecopneus, SMOCO.',
  'classe: classe o tipologia di PFU, come P, M, G1, G2, autodemolizione.',
  'targa: targa del mezzo.',
];

// Colonne che l'agente potrebbe scambiare per un nome: provincia, indirizzo, autista...
const NON_NOMI = /provinc|^pr\b|indirizz|^via\b|citt|comune|\bcap\b|partita|p\.? ?iva|codice fiscale|autista|nominativo|targa|telefono/i;
const CAMPI_NOME = ['produttore', 'destinatario', 'trasportatore', 'intermediario'];

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
      'Elenca in fogli ogni foglio che contiene un elenco di carichi, ricevuti (ingressi) o spediti (uscite): se ingressi e uscite stanno in fogli diversi, indicali tutti.',
      'Ignora i fogli di riepilogo, giacenza, target o vuoti.',
      'Per ogni foglio indica la prima riga di dati, cioe\' la prima riga dopo le intestazioni, e il numero di colonna di ciascun campo.',
      'Un foglio con piu\' tabelle, per esempio ingressi e poi uscite, ti arriva gia\' diviso in fogli distinti ("tabella 2" e cosi\' via): le colonne possono cambiare da una tabella all\'altra.',
      'I numeri di riga e di colonna sono quelli tra parentesi e partono da zero.',
      'Se un campo non c\'e\', indica -1. Non inventare colonne: se hai dubbi, -1. Produttore, destinatario, trasportatore e intermediario sono ragioni sociali: mai una provincia, un comune, un indirizzo o un autista.',
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

  // Ogni foglio indicato dall'agente si legge con le sue colonne, ciascuno una volta sola.
  const scelti = [];
  for (const f of (Array.isArray(m.fogli) ? m.fogli : [])) {
    const nome = String(f.foglio || '').trim();
    const tabella = tabelle.find(t => t.nome === f.foglio) || tabelle.find(t => String(t.nome).trim() === nome);
    const col = { ...(f.colonne || {}) };
    if (!tabella || scelti.some(s => s.tabella === tabella) || ((col.fir ?? -1) < 0 && (col.peso ?? -1) < 0)) continue;
    const intestazioni = (tabella.righe || [])[Math.max(0, (f.prima_riga_dati || 1) - 1)] || [];
    for (const c of CAMPI_NOME) if ((col[c] ?? -1) >= 0 && NON_NOMI.test(testoCella(intestazioni[col[c]]))) col[c] = -1;
    // Una sola colonna di data indicata come inizio e fine: e' una data generica.
    if ((col.data_inizio ?? -1) >= 0 && col.data_inizio === col.data_fine) {
      col.data = col.data_inizio;
      col.data_inizio = -1;
      col.data_fine = -1;
    }
    scelti.push({ tabella, f, col, intestazioni });
  }
  if (!m.riconosciuto || scelti.length === 0) {
    throw new Error('Nel file non ho trovato un elenco di carichi con formulario o peso' + (m.note ? ': ' + m.note : '.'));
  }

  const normalizzate = [];
  const fogli = [];
  for (const { tabella, f, col, intestazioni } of scelti) {
    const grezze = [];
    const righe = tabella.righe || [];
    for (let i = Math.max(0, f.prima_riga_dati || 0); i < righe.length; i++) {
      const r = righe[i] || [];
      const g = { n: (tabella.riga_iniziale || 0) + i + 1, ...(scelti.length > 1 ? { foglio: tabella.nome } : {}) };
      for (const c of CAMPI_REPORT) g[c] = (col[c] ?? -1) >= 0 ? r[col[c]] : null;
      grezze.push(g);
    }
    const unita = f.unita_peso === 'kg' || f.unita_peso === 't' ? f.unita_peso : null;
    const { righe: lette, unita: unitaUsata } = normalizzaRigheReport(grezze, unita);
    normalizzate.push(...lette);
    fogli.push({
      foglio: tabella.nome,
      contenuto: f.contenuto || '',
      prima_riga_dati: (tabella.riga_iniziale || 0) + (f.prima_riga_dati || 0) + 1,
      unita: unitaUsata,
      righe: lette.length,
      colonne: Object.fromEntries(CAMPI_REPORT.filter(c => (col[c] ?? -1) >= 0).map(c => [c, testoCella(intestazioni[col[c]]) || `colonna ${col[c] + 1}`])),
    });
  }

  // foglio, prima_riga_dati, unita e colonne del primo foglio restano per le verifiche gia' salvate.
  const primo = fogli[0];
  return {
    righe: normalizzate,
    lettura: { modo: 'excel', foglio: primo.foglio, prima_riga_dati: primo.prima_riga_dati, unita: primo.unita, colonne: primo.colonne, fogli, note: m.note || '' },
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
  if (!file || !file.file_uri) throw new Error('File mancante');

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
    'unita_peso: kg oppure t.',
    'note: una frase su com\'e\' fatto il documento, in italiano.',
  ].join('\n');

  // L'agente legge il documento da un link firmato che vale un quarto d'ora.
  const core = base44.asServiceRole.integrations.Core;
  const { signed_url } = await core.CreateFileSignedUrl({ file_uri: file.file_uri, expires_in: 900 });
  const risposta = await core.InvokeLLM({ prompt, file_urls: [signed_url], response_json_schema: SCHEMA_TRASCRIZIONE });
  const letto = typeof risposta === 'object' && risposta ? risposta : estraiJson(risposta);

  // Il file era lì solo per essere letto: se la piattaforma lo consente, via.
  for (const nome of ['DeleteFile', 'DeletePrivateFile', 'RemoveFile']) {
    if (typeof core[nome] !== 'function') continue;
    try { await core[nome]({ file_uri: file.file_uri }); } catch (_e) { /* resta in archivio */ }
    break;
  }

  const grezze = (letto.righe || []).map((r, i) => {
    const g = { n: Number(r.riga) || i + 1 };
    for (const c of CAMPI_REPORT) g[c] = r[c] ?? null;
    return g;
  });
  if (grezze.length === 0) throw new Error('Nel documento non ho trovato righe di carico' + (letto.note ? ': ' + letto.note : '.'));
  const { righe, unita } = normalizzaRigheReport(grezze, letto.unita_peso);
  return { righe, lettura: { modo: file.mime === 'immagine' ? 'immagine' : 'pdf', unita, note: letto.note || '', trascritto_da_agente: true } };
}

export default async function(req) {
  let base44 = null;
  let verificaId = null;
  try {
    base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
    const body = await req.json();
    verificaId = body.verifica_id;
    if (!verificaId) return Response.json({ error: 'verifica_id obbligatorio' }, { status: 400 });

    // Anche letture e scritture dell'entita' possono incontrare il limite di richieste.
    const ent = base44.asServiceRole.entities.VerificaReport;
    const svc = { VerificaReport: { get: (id) => conRitentativi(() => ent.get(id)), update: (id, dati) => conRitentativi(() => ent.update(id, dati)) } };
    const verifica = await svc.VerificaReport.get(verificaId);
    if (!verifica) return Response.json({ error: 'Verifica non trovata' }, { status: 404 });

    let righe, lettura;
    if (body.nessuna_movimentazione) {
      // Nessun file: la dichiarazione si verifica come un report senza righe.
      righe = [];
      lettura = { modo: 'dichiarazione', nota: verifica.nota || '' };
      await svc.VerificaReport.update(verificaId, {
        stato: 'in_verifica', avviata_il: new Date().toISOString(), errore: '',
        righe_report_json: '[]', lettura_json: JSON.stringify(lettura),
      });
    } else if (body.solo_verifica) {
      if (!verifica.righe_report_json) return Response.json({ error: 'Il report non e\' ancora stato letto: caricalo di nuovo.' }, { status: 400 });
      righe = JSON.parse(await leggiCampo(base44, 'VerificaReport', verifica, 'righe_report_json'));
      const testoLettura = await leggiCampo(base44, 'VerificaReport', verifica, 'lettura_json');
      lettura = testoLettura ? JSON.parse(testoLettura) : {};
      await svc.VerificaReport.update(verificaId, { stato: 'in_verifica', avviata_il: new Date().toISOString(), errore: '' });
    } else {
      await svc.VerificaReport.update(verificaId, { stato: 'in_lettura', avviata_il: new Date().toISOString(), errore: '' });
      const esito = await conRitentativi(() => (Array.isArray(body.tabelle) && body.tabelle.length > 0
        ? leggiTabelle(base44, body.tabelle, verifica)
        : leggiFile(base44, body.file, verifica)));
      righe = esito.righe;
      lettura = esito.lettura;
      if (righe.length === 0) throw new Error('Il report non contiene righe con formulario o peso.');
      // Un report lungo supera la dimensione di un campo: si salva diviso in parti.
      await svc.VerificaReport.update(verificaId, {
        stato: 'in_verifica',
        righe_report_json: await conRitentativi(() => valoreCampo(base44, 'VerificaReport', verificaId, 'righe_report_json', JSON.stringify(righe))),
        lettura_json: await conRitentativi(() => valoreCampo(base44, 'VerificaReport', verificaId, 'lettura_json', JSON.stringify(lettura))),
      });
    }

    // Regola 2: mentre un archivio dei movimenti si riscrive, o dopo un
    // caricamento interrotto o fallito, il confronto darebbe formulari "non
    // presenti nel gestionale" che ci sono, e confermerebbe una dichiarazione di
    // nessuna movimentazione chiudendone l'alert. Lo stato si legge prima e dopo
    // gli archivi, come in verificheReport e ricontrollaDichiarazioni: un
    // caricamento partito mentre li si leggeva non si vedrebbe con una lettura sola.
    const primaDegliArchivi = await statoCaricamenti(base44);
    let durante = primaDegliArchivi.in_corso;
    let letti = null;
    if (!durante.length) {
      letti = await conRitentativi(() => caricaMovimenti(base44));
      durante = caricamentiDuranteLettura(primaDegliArchivi, await statoCaricamenti(base44));
    }
    if (durante.length) {
      // Le righe lette restano salvate; esito e alert non si toccano. Un
      // confronto ripetuto su una verifica completata la lascia com'era; le
      // altre restano senza esito, e le completa il riconfronto a caricamento
      // finito (ricontrollaVerifiche, daRiconfrontare).
      const motivo = `Caricamento ${durante.map(descriviCaricamento).join('; ')}.`;
      const ripetuta = body.solo_verifica && verifica.stato === 'completata';
      const cosaResta = body.nessuna_movimentazione ? 'La comunicazione è registrata' : 'Le righe del report sono salvate';
      const messaggio = ripetuta
        ? `Verifica non ripetuta. ${motivo} Resta l'esito dell'ultimo confronto, che si rifà da solo a caricamento finito.`
        : `Confronto rinviato. ${motivo} ${cosaResta}: il confronto si fa da solo a caricamento finito, oppure con «Ripeti la verifica».`;
      await svc.VerificaReport.update(verificaId, ripetuta ? { stato: 'completata', errore: '' } : { stato: 'errore', errore: messaggio });
      return Response.json({ error: messaggio, rinviato: true, caricamenti: durante }, { status: 409 });
    }

    const esito = calcolaEsito(verifica, righe, letti.movimenti, letti.senza_fine);
    await salvaEsito(base44, verifica, esito, conRitentativi);

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
