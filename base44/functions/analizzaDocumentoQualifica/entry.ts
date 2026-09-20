import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { aggiungiPeriodo, oggiRoma } from "../../shared/qualificaFornitori.ts";
import { testoConoscenza, vociApprovate, proponiNovita, AREE_NORMATIVE, FONTI_UFFICIALI, REGOLE_FONTI } from "../../shared/baseConoscenza.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { confrontaTipoDocumento, problemaTipoSbagliato, problemiLettura } from "../../shared/tipiDocumento.ts";

// Agente di analisi dei documenti di qualifica.
//
// Il controllo e' documentale: stabilisce se il documento e' quello richiesto,
// se e' intestato al soggetto, se e' formalmente valido e quando scade. Non
// valuta l'attivita' del fornitore.
//
// Lavora in due passaggi perche' la piattaforma non consente, nella stessa
// chiamata, di leggere un file e di cercare sul web:
//   1. lettura: il modello legge il documento e ne estrae i dati cosi' come sono
//      scritti, senza dedurre nulla;
//   2. valutazione: il modello riceve i soli dati estratti e la base di
//      conoscenza normativa della commessa, verifica online che le regole non
//      siano cambiate e ne ricava scadenza e problemi.
//
// Intestatario e partita IVA si controllano anche in modo deterministico, perche'
// un errore del modello su questo punto non deve poter passare.
//
// Payload: { documento_id, contesto: { nome, piva, codice_fiscale } }

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
    firmato: { type: 'string', enum: ['si', 'no', 'non_determinabile'] },
    codici_eer: { type: 'array', items: { type: 'string' } },
    operazioni: { type: 'array', items: { type: 'string' } },
    categorie_albo: { type: 'array', items: { type: 'string' } },
    veicoli: { type: 'array', items: { type: 'string' } },
    responsabile_tecnico: { type: 'string' },
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
    novita_normative: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          voce_id: { type: 'string' },
          titolo: { type: 'string' },
          descrizione: { type: 'string' },
          testo_proposto: { type: 'string' },
          fonte: { type: 'string' },
          url: { type: 'string' },
          data_norma: { type: 'string' },
        },
      },
    },
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

// Controlli formali che non dipendono dal giudizio del modello.
function controlliFormali(lettura, contesto) {
  const problemi = [];

  // Intestatario: deve corrispondere la ragione sociale oppure la partita IVA.
  const atteso = normalizzaRagioneSociale(contesto.nome || '');
  const letto = normalizzaRagioneSociale(lettura.intestatario || '');
  const pivaAttesa = cifre(contesto.piva).slice(-11);
  const pivaLetta = cifre(lettura.partita_iva).slice(-11);
  const pivaCoincide = pivaAttesa.length === 11 && pivaLetta.length === 11 && pivaAttesa === pivaLetta;
  const pivaDiversa = pivaAttesa.length === 11 && pivaLetta.length === 11 && pivaAttesa !== pivaLetta;
  const nomeCoincide = atteso && letto && (atteso === letto || (Math.min(atteso.length, letto.length) >= 4 && (atteso.includes(letto) || letto.includes(atteso))));
  if (pivaDiversa) {
    problemi.push({ gravita: 'bloccante', messaggio: `La partita IVA del documento, ${pivaLetta}, non corrisponde a quella del soggetto, ${pivaAttesa}.` });
  } else if (letto && atteso && !nomeCoincide && !pivaCoincide) {
    problemi.push({ gravita: 'bloccante', messaggio: `Il documento e' intestato a "${lettura.intestatario}", non a ${contesto.nome}.` });
  }

  if (lettura.firmato === 'no') {
    problemi.push({ gravita: 'attenzione', messaggio: 'Il documento non risulta firmato.' });
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
    if (user.role !== 'admin') return rispostaSolaLettura();
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
    const piva = contesto.piva || '';
    const core = base44.asServiceRole.integrations.Core;
    const approvate = await vociApprovate(base44);
    const { signed_url } = await core.CreateFileSignedUrl({ file_uri: doc.file_uri, expires_in: 900 });

    // === 1. Lettura del documento ===
    const lettura = comeOggetto(await core.InvokeLLM({
      prompt: [
        'Sei l\'addetto alla qualifica documentale dei fornitori di un\'azienda italiana.',
        'Leggi con attenzione il documento allegato ed estrai i dati richiesti esattamente come compaiono.',
        '',
        `Documento atteso: ${tipo.nome}${tipo.descrizione ? ' — ' + tipo.descrizione : ''}`,
        `Soggetto atteso: ${nome}${piva ? ', partita IVA ' + piva : ''}`,
        '',
        'Regole:',
        '- Riporta solo cio\' che e\' scritto nel documento. Non dedurre e non inventare nulla.',
        '- Tutte le date nel formato AAAA-MM-GG. Se una data manca o non e\' leggibile lascia il campo vuoto.',
        '- data_scadenza: solo una scadenza scritta in modo esplicito, come "valido fino al" o "data di scadenza". Mai una data calcolata.',
        '- data_emissione: data di rilascio, di estrazione, di protocollo o di sottoscrizione.',
        '- firmato: si se il documento reca firma o sottoscrizione, anche digitale; no se dovrebbe averla e manca.',
        '- Per iscrizioni all\'Albo gestori ambientali, autorizzazioni e comunicazioni di impianti: riporta i codici EER autorizzati (codici_eer, per esempio 16 01 03), le operazioni di recupero o smaltimento (operazioni, per esempio R13, R3), le categorie e classi dell\'Albo (categorie_albo), le targhe dei veicoli (veicoli) e il nome del responsabile tecnico (responsabile_tecnico). Per gli altri documenti lascia questi campi vuoti.',
        '- Se il file e\' illeggibile, tagliato o non e\' un documento, imposta leggibile a false e spiega in note_lettura.',
        '- tipo_documento: il nome proprio del documento come si presenta, per esempio DURC, Visura camerale, Iscrizione White List, Iscrizione Albo Nazionale Gestori Ambientali. Scrivi quello che il file E\', anche quando e\' diverso dal documento atteso: serve proprio ad accorgersi di un file caricato nella casella sbagliata.',
        '- sintesi: una o due frasi in italiano su che documento e\' e cosa attesta.',
      ].join('\n'),
      file_urls: [signed_url],
      response_json_schema: SCHEMA_LETTURA,
    }));

    // === 2. Valutazione della validita' ===
    const valutazione = comeOggetto(await core.InvokeLLM({
      prompt: [
        'Sei un esperto di adempimenti documentali e di qualifica dei fornitori secondo la normativa italiana.',
        'Valuta se un documento presentato da un fornitore o da un cliente e\' quello richiesto, se e\' valido e quando scade.',
        'Il controllo e\' solo documentale: non valutare l\'attivita\' del soggetto ne\' i contenuti tecnici del documento.',
        '',
        `Data di oggi: ${oggi}`,
        `Soggetto: ${nome}${piva ? ', partita IVA ' + piva : ''}`,
        `Documento richiesto: ${tipo.nome}`,
        `Regola del catalogo interno: ${regolaCatalogo(tipo)}`,
        `Riferimento normativo del catalogo: ${tipo.riferimento_normativo || 'non indicato'}`,
        '',
        `Base di conoscenza della commessa, verificata voce per voce alla data indicata. Il fornitore lavora nella filiera dei pneumatici fuori uso (EER 16 01 03, rifiuti speciali non pericolosi) per il sistema collettivo Ecotyre. Usala come riferimento, ma controlla online sulle fonti ufficiali (${FONTI_UFFICIALI.join('; ')}) che dopo la data della voce non sia cambiato nulla: se trovi una norma nuova e certa, applicala, segnalala con un problema informativo e riportala in novita_normative con voce_id, data_norma (AAAA-MM-GG), fonte e il testo COMPLETO della voce aggiornata, cosi' la base di conoscenza di tutto il gestionale si aggiorna dopo l'approvazione.`,
        REGOLE_FONTI,
        '',
        testoConoscenza(approvate, AREE_NORMATIVE),
        '',
        'Dati estratti dal documento:',
        JSON.stringify(lettura, null, 2),
        '',
        'Compiti:',
        '1. Stabilisci se il documento corrisponde al tipo richiesto. Per un\'iscrizione all\'Albo di chi trasporta PFU verifica categoria 4 (o 5) e codice EER 16 01 03 e che siano indicati la classe e un responsabile tecnico; per un\'autorizzazione d\'impianto o di stoccaggio verifica il codice EER 16 01 03 e le operazioni coerenti con il ruolo del soggetto. Se il codice manca e\' un problema bloccante.',
        '2. Determina la regola di validita\' di questo tipo di documento secondo la base di conoscenza e la normativa vigente, verificando online solo le novita\' successive alla data della voce. In regola_validita cita la voce o la norma usata.',
        '3. Calcola data_scadenza_effettiva, formato AAAA-MM-GG. Se i dati non bastano per calcolarla con certezza lasciala vuota: non stimare.',
        '4. Elenca ogni problema con la sua gravita\':',
        '   bloccante: il documento non si puo\' accettare. Tipo sbagliato, intestato ad altri, scaduto, incompleto o illeggibile.',
        '   attenzione: accettabile ma da sistemare. Prossimo alla scadenza, privo di firma, dati da confermare.',
        '   informativo: nota utile che non richiede azioni.',
        '5. Se c\'e\' almeno un problema bloccante o di attenzione, scrivi in richiesta_al_fornitore un testo breve e cortese, in italiano, per chiedere al soggetto il documento corretto o aggiornato.',
        '6. confidenza da 0 a 1: quanto sei sicuro della valutazione.',
        '',
        'Scrivi in italiano. Cita un riferimento normativo solo se ne sei certo.',
      ].join('\n'),
      add_context_from_internet: true,
      response_json_schema: SCHEMA_VALUTAZIONE,
    }));

    // === Problemi: controlli formali piu' valutazione del modello ===
    // Prima cio' che si vede dalla lettura, poi il giudizio dell'agente.
    const problemi = [...problemiLettura(lettura), ...controlliFormali(lettura, { nome, piva })];

    // Un DURC caricato dove va una visura e' un documento valido nel posto
    // sbagliato: l'errore piu' facile da fare. Il confronto fra la casella e il
    // tipo letto non passa dal modello, cosi' non dipende dal suo giudizio.
    const confronto = confrontaTipoDocumento(tipo.nome, lettura);
    const letto = String(lettura.tipo_documento || '').trim();
    if (confronto.esito === 'diverso') {
      problemi.unshift(problemaTipoSbagliato(tipo.nome, lettura));
    } else if (valutazione.corrisponde_al_tipo_atteso === false) {
      problemi.unshift({
        gravita: 'bloccante',
        messaggio: 'Il documento non sembra essere "' + tipo.nome + '": e\' stato riconosciuto come ' + (letto || 'un altro documento') + '.'
          + (confronto.esito === 'coincide' ? ' La lettura pero\' lo riconosce proprio come ' + confronto.attesa.nome + ': controllalo prima di richiederlo al fornitore.' : ''),
      });
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

    // Le novita' trovate controllando un documento aggiornano, dopo l'approvazione,
    // la conoscenza di tutto il gestionale (EcoTyna, corso RT, altri controlli).
    try {
      await proponiNovita(base44, valutazione.novita_normative, { oggi, origine: 'qualifica_documento', approvate, collegamenti: { documento_id: documentoId } });
    } catch (_e) { /* l'analisi del documento resta valida anche se la proposta non si salva */ }

    const confidenza = typeof valutazione.confidenza === 'number' ? Math.max(0, Math.min(1, valutazione.confidenza)) : null;
    if (confidenza !== null && confidenza < 0.6) {
      problemi.push({ gravita: 'attenzione', messaggio: 'L\'agente non e\' sicuro della propria valutazione: conviene una verifica a mano.' });
    }

    // Una nuova lettura non puo' cancellare una scadenza gia' accertata. Se
    // l'agente non riesce a ricavarla - succede con le scansioni difficili -
    // resta quella che c'era e lo si dice, invece di svuotare il campo e far
    // sparire dagli alert un documento che invece scade.
    let scadenzaFinale = scadenza;
    if (!scadenzaFinale && tipo.tipo_scadenza !== 'nessuna' && doc.data_scadenza) {
      scadenzaFinale = doc.data_scadenza;
      problemi.push({
        gravita: 'attenzione',
        messaggio: 'Da questa lettura non e\' emersa nessuna data di scadenza: resta quella gia\' registrata, '
          + formatoIt(doc.data_scadenza) + '. Controllala.',
      });
    }

    await svc.DocumentoQualifica.update(documentoId, {
      analisi_stato: 'completata',
      data_emissione: emissione || doc.data_emissione || null,
      data_scadenza: scadenzaFinale,
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

    return Response.json({ ok: true, data_scadenza: scadenzaFinale, problemi: problemi.length });
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
