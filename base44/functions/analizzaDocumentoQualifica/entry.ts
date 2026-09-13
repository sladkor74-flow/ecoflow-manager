import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { aggiungiPeriodo, oggiRoma } from "../../shared/qualificaFornitori.ts";

// Agente di analisi dei documenti di qualifica.
//
// Lavora in due passaggi perche' la piattaforma non consente, nella stessa
// chiamata, di leggere un file e di cercare sul web:
//   1. lettura: il modello legge il documento e ne estrae i dati cosi' come sono
//      scritti, senza dedurre nulla;
//   2. valutazione: il modello riceve i soli dati estratti, consulta il web per
//      la normativa applicabile e stabilisce validita', scadenza e problemi.
//
// Ai due passaggi si affiancano controlli deterministici, che non dipendono dal
// giudizio del modello: intestatario, codice EER 16 01 03, targhe dei mezzi usati
// nell'anno. Su questi punti un errore del modello non deve poter passare.
//
// Payload: { documento_id, contesto: { nome, piva, codice_fiscale, ruoli, targhe } }

const DESCRIZIONE_RUOLI = {
  raccolta: 'raccoglie e trasporta PFU dai punti di raccolta',
  trasporto_secondaria: 'trasporta PFU dagli stoccaggi agli impianti',
  trattamento: 'impianto che riceve e tratta PFU',
  stoccaggio: 'stoccaggio che riceve PFU in messa in riserva',
  cliente: 'cliente: sistema di gestione PFU per conto del quale SMOCO opera',
};

const SCHEMA_LETTURA = {
  type: 'object',
  properties: {
    leggibile: { type: 'boolean' },
    tipo_documento: { type: 'string' },
    intestatario: { type: 'string' },
    partita_iva: { type: 'string' },
    codice_fiscale: { type: 'string' },
    ente_emittente: { type: 'string' },
    numero_documento: { type: 'string' },
    data_emissione: { type: 'string' },
    data_scadenza: { type: 'string' },
    codici_eer: { type: 'array', items: { type: 'string' } },
    operazioni: { type: 'array', items: { type: 'string' } },
    categorie_albo: { type: 'array', items: { type: 'string' } },
    targhe: { type: 'array', items: { type: 'string' } },
    firmato: { type: 'string', enum: ['si', 'no', 'non_determinabile'] },
    sintesi: { type: 'string' },
    note_lettura: { type: 'string' },
  },
  required: ['leggibile', 'tipo_documento', 'sintesi'],
};

const SCHEMA_VALUTAZIONE = {
  type: 'object',
  properties: {
    corrisponde_al_tipo_atteso: { type: 'boolean' },
    regola_validita: { type: 'string' },
    riferimenti_normativi: { type: 'array', items: { type: 'string' } },
    data_scadenza_effettiva: { type: 'string' },
    motivazione_scadenza: { type: 'string' },
    problemi: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          gravita: { type: 'string', enum: ['bloccante', 'attenzione', 'informativo'] },
          messaggio: { type: 'string' },
        },
        required: ['gravita', 'messaggio'],
      },
    },
    richiesta_al_fornitore: { type: 'string' },
    confidenza: { type: 'number' },
  },
  required: ['corrisponde_al_tipo_atteso', 'problemi', 'confidenza'],
};

function comeOggetto(v) {
  if (v && typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch (_e) { return {}; }
}

function data(v) {
  const s = String(v || '').trim().slice(0, 10);
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : s;
}

const cifre = (v) => String(v || '').replace(/[^0-9]/g, '');
const targa = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function formatoIt(d) {
  return d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '';
}

function regolaCatalogo(tipo) {
  if (tipo.tipo_scadenza === 'nessuna') return 'il documento non ha scadenza';
  if (tipo.tipo_scadenza === 'da_emissione') {
    const parti = [];
    if (tipo.validita_mesi) parti.push(tipo.validita_mesi + ' mesi');
    if (tipo.validita_giorni) parti.push(tipo.validita_giorni + ' giorni');
    return parti.length ? 'vale ' + parti.join(' e ') + ' dalla data di emissione' : 'vale un periodo fisso dalla data di emissione, da determinare';
  }
  return 'la scadenza e\' scritta sul documento';
}

// Controlli che non dipendono dal giudizio del modello.
function controlliDeterministici(tipo, lettura, contesto) {
  const problemi = [];

  if (lettura.leggibile === false) {
    problemi.push({ gravita: 'bloccante', messaggio: 'Il documento non e\' leggibile o e\' incompleto' + (lettura.note_lettura ? ': ' + lettura.note_lettura : '.') });
  }

  // Intestatario: la ragione sociale deve corrispondere, oppure la partita IVA.
  const atteso = normalizzaRagioneSociale(contesto.nome || '');
  const letto = normalizzaRagioneSociale(lettura.intestatario || '');
  const pivaAttesa = cifre(contesto.piva).slice(-11);
  const pivaLetta = cifre(lettura.partita_iva).slice(-11);
  const pivaCoincide = pivaAttesa.length === 11 && pivaLetta.length === 11 && pivaAttesa === pivaLetta;
  const pivaDiversa = pivaAttesa.length === 11 && pivaLetta.length === 11 && pivaAttesa !== pivaLetta;
  const nomeCoincide = atteso && letto && (atteso === letto || (Math.min(atteso.length, letto.length) >= 4 && (atteso.includes(letto) || letto.includes(atteso))));
  if (pivaDiversa) {
    problemi.push({ gravita: 'bloccante', messaggio: `La partita IVA del documento, ${pivaLetta}, non corrisponde a quella del fornitore, ${pivaAttesa}.` });
  } else if (letto && atteso && !nomeCoincide && !pivaCoincide) {
    problemi.push({ gravita: 'bloccante', messaggio: `Il documento e' intestato a "${lettura.intestatario}", non a ${contesto.nome}.` });
  }

  const eer = (lettura.codici_eer || []).map(cifre).filter(Boolean);
  if ((tipo.categoria === 'albo_gestori' || tipo.categoria === 'autorizzazione_impianto') && eer.length > 0 && !eer.includes('160103')) {
    problemi.push({ gravita: 'bloccante', messaggio: 'Il codice EER 16 01 03, pneumatici fuori uso, non compare fra i codici autorizzati.' });
  }

  if (tipo.categoria === 'albo_gestori' && Array.isArray(contesto.targhe) && contesto.targhe.length > 0) {
    const iscritte = new Set((lettura.targhe || []).map(targa).filter(Boolean));
    if (iscritte.size === 0) {
      problemi.push({ gravita: 'attenzione', messaggio: `Il documento non riporta l'elenco dei mezzi: verifica che siano iscritte le targhe usate quest'anno, ${contesto.targhe.join(', ')}.` });
    } else {
      const mancanti = contesto.targhe.map(targa).filter(t => t && !iscritte.has(t));
      if (mancanti.length > 0) {
        problemi.push({ gravita: 'attenzione', messaggio: `Targhe usate quest'anno che non compaiono nell'iscrizione: ${mancanti.slice(0, 15).join(', ')}${mancanti.length > 15 ? ' e altre ' + (mancanti.length - 15) : ''}.` });
      }
    }
  }

  const operazioni = (lettura.operazioni || []).map(o => String(o).toUpperCase().replace(/\s+/g, ''));
  if (tipo.categoria === 'autorizzazione_impianto' && operazioni.length > 0) {
    const ruoli = contesto.ruoli || [];
    if (ruoli.includes('stoccaggio') && !operazioni.includes('R13')) {
      problemi.push({ gravita: 'attenzione', messaggio: 'Il soggetto opera come stoccaggio ma l\'autorizzazione non riporta l\'operazione R13.' });
    }
    if (ruoli.includes('trattamento') && !operazioni.some(o => ['R1', 'R3', 'R12', 'R13'].includes(o))) {
      problemi.push({ gravita: 'attenzione', messaggio: 'Il soggetto opera come impianto ma l\'autorizzazione non riporta operazioni di recupero R1, R3, R12 o R13.' });
    }
  }

  return problemi;
}

export default async function(req) {
  let base44 = null;
  let documentoId = null;
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: richiesto ruolo admin' }, { status: 403 });

    const body = await req.json();
    documentoId = body.documento_id;
    const contesto = body.contesto || {};
    if (!documentoId) return Response.json({ error: 'documento_id obbligatorio' }, { status: 400 });

    const svc = base44.asServiceRole.entities;
    const doc = await svc.DocumentoQualifica.get(documentoId);
    if (!doc) return Response.json({ error: 'Documento non trovato' }, { status: 404 });
    const tipo = await svc.TipoDocumentoQualifica.get(doc.tipo_documento_id);
    if (!tipo) return Response.json({ error: 'Tipo di documento non trovato nel catalogo' }, { status: 404 });
    if (!doc.file_uri) return Response.json({ error: 'Il documento non ha un file allegato' }, { status: 400 });

    await svc.DocumentoQualifica.update(documentoId, {
      analisi_stato: 'in_corso', analisi_avviata_il: new Date().toISOString(), errore_analisi: '',
    });

    const oggi = oggiRoma();
    const nome = contesto.nome || doc.soggetto_nome || '';
    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: doc.file_uri, expires_in: 900 });

    // === 1. Lettura del documento ===
    const lettura = comeOggetto(await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: [
        'Sei l\'addetto alla qualifica fornitori di SMOCO Srl, operatore della raccolta di pneumatici fuori uso (PFU, codice EER 16 01 03) per il sistema Ecotyre.',
        'Leggi con attenzione il documento allegato ed estrai i dati richiesti esattamente come compaiono.',
        '',
        `Documento atteso: ${tipo.nome}${tipo.descrizione ? ' — ' + tipo.descrizione : ''}`,
        `Soggetto atteso: ${nome}${contesto.piva ? ', partita IVA ' + contesto.piva : ''}`,
        '',
        'Regole:',
        '- Riporta solo cio\' che e\' scritto nel documento. Non dedurre e non inventare nulla.',
        '- Tutte le date nel formato AAAA-MM-GG. Se una data manca o non e\' leggibile lascia il campo vuoto.',
        '- data_scadenza: solo una scadenza scritta in modo esplicito, come "valido fino al" o "data di scadenza". Mai una data calcolata.',
        '- data_emissione: data di rilascio, di estrazione, di protocollo o di sottoscrizione.',
        '- codici_eer: tutti i codici EER o CER elencati, a sei cifre.',
        '- operazioni: le operazioni di recupero o smaltimento autorizzate, come R1, R3, R12, R13, D15.',
        '- categorie_albo: categorie e classi di iscrizione all\'Albo Nazionale Gestori Ambientali, se presenti.',
        '- targhe: tutte le targhe dei veicoli elencate, compresi gli allegati.',
        '- Se il file e\' illeggibile, tagliato o non e\' un documento, imposta leggibile a false e spiega in note_lettura.',
        '- sintesi: due o tre frasi in italiano su cosa e\' il documento e cosa attesta.',
      ].join('\n'),
      file_urls: [signed_url],
      response_json_schema: SCHEMA_LETTURA,
    }));

    // === 2. Valutazione con la normativa ===
    const ruoli = Array.isArray(contesto.ruoli) ? contesto.ruoli : [];
    const valutazione = comeOggetto(await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: [
        'Sei un esperto di normativa ambientale italiana e di qualifica dei fornitori nella gestione dei rifiuti, in particolare dei pneumatici fuori uso (PFU, EER 16 01 03).',
        'Valuta la validita\' di un documento presentato da un fornitore o da un cliente di SMOCO Srl.',
        '',
        `Data di oggi: ${oggi}`,
        `Soggetto: ${nome}${contesto.piva ? ', partita IVA ' + contesto.piva : ''}`,
        `Ruoli del soggetto: ${ruoli.map(r => DESCRIZIONE_RUOLI[r] || r).join('; ') || 'non indicati'}`,
        `Targhe dei mezzi usati quest'anno: ${(contesto.targhe || []).join(', ') || 'nessuna'}`,
        `Documento atteso: ${tipo.nome}`,
        `Regola del catalogo interno: ${regolaCatalogo(tipo)}`,
        `Riferimento normativo del catalogo: ${tipo.riferimento_normativo || 'non indicato'}`,
        '',
        'Dati estratti dal documento:',
        JSON.stringify(lettura, null, 2),
        '',
        'Compiti:',
        '1. Stabilisci se il documento corrisponde davvero al tipo atteso.',
        '2. Determina la regola di validita\' secondo la normativa vigente e la prassi consolidata, verificandola online. Per esempio una visura camerale vale sei mesi dal rilascio, il DURC 120 giorni, l\'iscrizione all\'Albo Gestori Ambientali cinque anni, l\'autorizzazione unica dell\'art. 208 del D.Lgs 152/2006 dieci anni con rinnovo da chiedere 180 giorni prima.',
        '3. Calcola data_scadenza_effettiva, formato AAAA-MM-GG, dai dati estratti. Se i dati non bastano per calcolarla con certezza lasciala vuota: non stimare.',
        '4. Elenca ogni problema con la sua gravita\':',
        '   bloccante: il documento non si puo\' accettare. Tipo sbagliato, intestato ad altri, scaduto, codice 16 01 03 non autorizzato, operazioni incoerenti con il ruolo, documento incompleto.',
        '   attenzione: accettabile ma da sistemare. Mezzi non iscritti, garanzie in scadenza, dati da confermare.',
        '   informativo: nota utile che non richiede azioni.',
        '   Verifica la coerenza con i ruoli: chi raccoglie o trasporta PFU deve essere iscritto all\'Albo per il codice 16 01 03 con i mezzi che usa; chi tratta o stocca deve essere autorizzato per il codice 16 01 03 con operazioni coerenti, R13 per la messa in riserva, R3 o R12 per il trattamento.',
        '5. Se c\'e\' almeno un problema bloccante o di attenzione, scrivi in richiesta_al_fornitore un testo breve e cortese, in italiano, per chiedere al soggetto il documento corretto o aggiornato.',
        '6. confidenza da 0 a 1: quanto sei sicuro della valutazione.',
        '',
        'Scrivi in italiano. Cita un riferimento normativo solo se ne sei certo.',
      ].join('\n'),
      add_context_from_internet: true,
      response_json_schema: SCHEMA_VALUTAZIONE,
    }));

    // === Problemi: controlli deterministici piu' valutazione del modello ===
    const problemi = controlliDeterministici(tipo, lettura, { ...contesto, nome });
    if (valutazione.corrisponde_al_tipo_atteso === false) {
      problemi.unshift({ gravita: 'bloccante', messaggio: `Il documento non sembra essere "${tipo.nome}": e' stato riconosciuto come ${lettura.tipo_documento || 'un altro documento'}.` });
    }
    for (const p of (valutazione.problemi || [])) {
      if (!p || !p.messaggio) continue;
      const gravita = ['bloccante', 'attenzione', 'informativo'].includes(p.gravita) ? p.gravita : 'attenzione';
      if (!problemi.some(q => q.messaggio === p.messaggio)) problemi.push({ gravita, messaggio: String(p.messaggio) });
    }

    // === Scadenza ===
    // Fra la data scritta sul documento e quella della regola del catalogo vale la
    // piu' vicina. La data ricavata dal modello si usa solo quando mancano le
    // altre due: altrimenti un suo errore potrebbe dichiarare scaduto un documento
    // valido. Se e' piu' vicina, viene comunque segnalata perche' la si verifichi.
    const emissione = data(lettura.data_emissione);
    const candidati = [];
    const daDocumento = data(lettura.data_scadenza);
    if (daDocumento) candidati.push(daDocumento);
    if (tipo.tipo_scadenza === 'da_emissione' && emissione && (tipo.validita_mesi || tipo.validita_giorni)) {
      candidati.push(aggiungiPeriodo(emissione, tipo.validita_mesi, tipo.validita_giorni));
    }
    const daNormativa = data(valutazione.data_scadenza_effettiva);
    let scadenza = candidati.length ? candidati.sort()[0] : null;
    if (!scadenza && tipo.tipo_scadenza !== 'nessuna' && daNormativa) scadenza = daNormativa;
    if (scadenza && daNormativa && daNormativa < scadenza) {
      problemi.push({ gravita: 'attenzione', messaggio: `Secondo la normativa il documento potrebbe scadere prima, il ${formatoIt(daNormativa)}${valutazione.motivazione_scadenza ? ': ' + valutazione.motivazione_scadenza : '.'}` });
    }

    const confidenza = typeof valutazione.confidenza === 'number' ? Math.max(0, Math.min(1, valutazione.confidenza)) : null;
    if (confidenza !== null && confidenza < 0.6) {
      problemi.push({ gravita: 'attenzione', messaggio: 'L\'agente non e\' sicuro della propria valutazione: conviene una verifica a mano.' });
    }

    await svc.DocumentoQualifica.update(documentoId, {
      analisi_stato: 'completata',
      data_emissione: emissione || doc.data_emissione || null,
      data_scadenza: scadenza,
      sintesi: lettura.sintesi || '',
      richiesta_al_fornitore: valutazione.richiesta_al_fornitore || '',
      confidenza,
      problemi_json: JSON.stringify(problemi),
      analisi_json: JSON.stringify({
        lettura,
        regola_validita: valutazione.regola_validita || '',
        riferimenti_normativi: valutazione.riferimenti_normativi || [],
        scadenza_da_documento: daDocumento,
        scadenza_da_normativa: daNormativa,
        motivazione_scadenza: valutazione.motivazione_scadenza || '',
        analizzato_il: new Date().toISOString(),
      }),
      errore_analisi: '',
    });

    return Response.json({ ok: true, data_scadenza: scadenza, problemi: problemi.length });
  } catch (error) {
    const messaggio = error && error.message ? error.message : String(error);
    if (base44 && documentoId) {
      try {
        await base44.asServiceRole.entities.DocumentoQualifica.update(documentoId, { analisi_stato: 'errore', errore_analisi: messaggio });
      } catch (_e) { /* il messaggio d'errore principale resta quello da restituire */ }
    }
    return Response.json({ error: messaggio }, { status: 500 });
  }
}
