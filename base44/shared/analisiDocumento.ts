// L'analisi di un documento di qualifica: lettura del file, valutazione della
// validita', problemi e scadenza. Sta qui e non dentro la funzione perche' la
// usano in due: il pulsante del modulo, che analizza un documento appena
// caricato, e il presidio automatico, che ogni giorno recupera quelli rimasti
// indietro. Un documento si controlla allo stesso modo comunque lo si guardi.
//
// Lavora in due passaggi perche' la piattaforma non consente, nella stessa
// chiamata, di leggere un file e di cercare sul web:
//   1. lettura: il modello legge il documento ed estrae i dati come sono scritti;
//   2. valutazione: riceve i soli dati estratti e la base di conoscenza, verifica
//      online che le regole non siano cambiate e ne ricava scadenza e problemi.
//
// Intestatario, partita IVA e tipo di documento si controllano anche in modo
// deterministico: un errore del modello su questo non deve poter passare.

import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { aggiungiPeriodo, oggiRoma } from "./qualificaFornitori.ts";
import { testoConoscenza, vociApprovate, proponiNovita, AREE_NORMATIVE, FONTI_UFFICIALI, REGOLE_FONTI } from "./baseConoscenza.ts";
import { confrontaTipoDocumento, problemaTipoSbagliato, problemiLettura } from "./tipiDocumento.ts";

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
export function controlliFormali(lettura, contesto, opzioni) {
  // Un contratto ha due parti: chi legge puo' trovare per prima la nostra
  // ragione sociale invece di quella del fornitore, e non e' un errore.
  const bilaterale = !!(opzioni && opzioni.bilaterale);
  const problemi = [];

  // Intestatario: deve corrispondere la ragione sociale oppure la partita IVA.
  const atteso = normalizzaRagioneSociale(contesto.nome || '');
  const letto = normalizzaRagioneSociale(lettura.intestatario || '');
  // In molte societa' la partita IVA e il codice fiscale sono due numeri
  // diversi, e un documento puo' riportare l'uno o l'altro: valgono entrambi.
  // Si confrontano come insiemi, e basta che uno coincida.
  const undici = (v) => { const c = cifre(v); return c.length >= 11 ? c.slice(-11) : ''; };
  const attesi = [undici(contesto.piva), undici(contesto.codice_fiscale)].filter(Boolean);
  const letti = [undici(lettura.partita_iva), undici(lettura.codice_fiscale)].filter(Boolean);
  const pivaAttesa = attesi[0] || '';
  const pivaLetta = letti[0] || '';
  const pivaCoincide = letti.some(x => attesi.includes(x));
  const pivaDiversa = attesi.length > 0 && letti.length > 0 && !pivaCoincide;
  // Le ditte individuali non hanno una partita IVA sui documenti: l'Albo e il
  // DURC le identificano col codice fiscale della persona. Senza questo
  // confronto, su di loro non si verificherebbe nessun intestatario.
  const soloLettere = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cfAtteso = soloLettere(contesto.codice_fiscale);
  const cfLetto = soloLettere(lettura.codice_fiscale);
  const cfConfrontabile = cfAtteso.length === 16 && cfLetto.length === 16;
  const cfCoincide = cfConfrontabile && cfAtteso === cfLetto;
  const cfDiverso = cfConfrontabile && cfAtteso !== cfLetto;

  // Le ditte individuali si firmano indifferentemente "TORRES GIOVANNI" o
  // "GIOVANNI TORRES": le stesse parole in altro ordine sono la stessa persona.
  const parole = (v) => String(v || '').split(/\s+/).filter(x => x.length > 2).sort().join(' ');
  const nomeCoincide = atteso && letto && (atteso === letto
    || (Math.min(atteso.length, letto.length) >= 4 && (atteso.includes(letto) || letto.includes(atteso)))
    || (parole(atteso).length >= 6 && parole(atteso) === parole(letto)));
  const graveSeUnilaterale = bilaterale ? 'attenzione' : 'bloccante';
  const perche = bilaterale ? ' In un contratto ci sono due parti: controlla che non sia la nostra.' : '';
  if (cfDiverso) {
    problemi.push({ gravita: graveSeUnilaterale, messaggio: `Il codice fiscale del documento, ${cfLetto}, non corrisponde a quello del soggetto, ${cfAtteso}.` + perche });
  } else if (pivaDiversa) {
    problemi.push({
      gravita: graveSeUnilaterale,
      messaggio: `Il numero fiscale del documento, ${pivaLetta}, non corrisponde a quelli del soggetto (${attesi.join(' o ')}).`
        + (bilaterale ? perche : ' Ricorda che partita IVA e codice fiscale possono essere numeri diversi: controlla quale dei due riporta il documento.'),
    });
  } else if (letto && atteso && !nomeCoincide && !pivaCoincide && !cfCoincide) {
    problemi.push({ gravita: graveSeUnilaterale, messaggio: `Il documento e' intestato a "${lettura.intestatario}", non a ${contesto.nome}.` + perche });
  }

  if (lettura.firmato === 'no') {
    problemi.push({ gravita: 'attenzione', messaggio: 'Il documento non risulta firmato.' });
  }

  return problemi;
}

/**
 * Analizza un documento e ne aggiorna il record. Chi chiama ha gia' verificato i
 * permessi e caricato documento e tipo.
 * Restituisce { data_scadenza, problemi, bloccanti, conferma_tolta }.
 */
export async function analizzaDocumento(base44, { doc, tipo, contesto, conoscenza }) {
    const svc = base44.asServiceRole.entities;
    const documentoId = doc.id;
    const ctx = contesto || {};
    const oggi = oggiRoma();
    const nome = ctx.nome || doc.soggetto_nome || '';
    const piva = ctx.piva || '';
    const core = base44.asServiceRole.integrations.Core;
    // le voci approvate si passano da fuori quando si analizzano piu documenti di fila
    const approvate = conoscenza || await vociApprovate(base44);
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
    const famiglia = confrontaTipoDocumento(tipo.nome, lettura);
    const problemi = [
      ...problemiLettura(lettura),
      ...controlliFormali(lettura, { nome, piva, codice_fiscale: ctx.codice_fiscale }, { bilaterale: famiglia.attesa && famiglia.attesa.chiave === 'contratto' }),
    ];

    // Un DURC caricato dove va una visura e' un documento valido nel posto
    // sbagliato: l'errore piu' facile da fare. Il confronto fra la casella e il
    // tipo letto non passa dal modello, cosi' non dipende dal suo giudizio.
    const confronto = famiglia;
    const letto = String(lettura.tipo_documento || '').trim();
    if (confronto.esito === 'diverso') {
      problemi.unshift(problemaTipoSbagliato(tipo.nome, lettura));
    } else if (valutazione.corrisponde_al_tipo_atteso === false) {
      // Se il riconoscimento deterministico dice che la famiglia e' quella giusta,
      // il dubbio dell'agente non basta a rifiutare il documento: quasi sempre e'
      // solo il titolo che non combacia con il nome della casella. E' successo su
      // undici contratti veri, intitolati "Contratto Servizi Trasporto" o
      // "Contratto di stoccaggio PFU" invece che "Contratto con SMOCO".
      const solaSfumatura = confronto.esito === 'coincide';
      problemi.unshift({
        gravita: solaSfumatura ? 'attenzione' : 'bloccante',
        messaggio: solaSfumatura
          ? 'Il titolo del documento, ' + (letto || 'non leggibile') + ', non coincide con il nome della casella "' + tipo.nome + '", ma si tratta dello stesso tipo di documento. Guardalo, se e\' quello giusto va bene cosi\'.'
          : 'Il documento non sembra essere "' + tipo.nome + '": e\' stato riconosciuto come ' + (letto || 'un altro documento') + '.',
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

    // La conferma data a mano vale su cio' che si sapeva quando e' stata data.
    // Se una lettura nuova trova un problema bloccante - documento sbagliato,
    // intestato ad altri, illeggibile - la conferma non copre piu' niente: si
    // toglie, si scrive perche', e la rimette chi controlla il documento.
    const bloccantiTrovati = problemi.filter(p => p.gravita === 'bloccante');
    const revocaConferma = !!doc.verificato_manualmente && bloccantiTrovati.length > 0;
    if (revocaConferma) {
      problemi.push({
        gravita: 'attenzione',
        messaggio: 'Questo documento era segnato come verificato a mano: la conferma e\' stata tolta perche\' questa lettura ha trovato '
          + (bloccantiTrovati.length === 1 ? 'un problema bloccante' : bloccantiTrovati.length + ' problemi bloccanti')
          + '. Controlla il documento e, se va bene, rimetti la conferma.',
      });
    }
    const traccia = revocaConferma
      ? [String(doc.note || '').trim(), 'Conferma manuale tolta il ' + oggi + ': ' + bloccantiTrovati[0].messaggio].filter(Boolean).join('\n')
      : null;

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
      ...(revocaConferma ? { verificato_manualmente: false, note: traccia } : {}),
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

    return { data_scadenza: scadenzaFinale, problemi: problemi.length, bloccanti: bloccantiTrovati.length, conferma_tolta: revocaConferma };
}

export { vociApprovate };

// Quanti giorni dopo si rilegge un documento gia' analizzato: le regole di
// validita' cambiano, e una lettura di sei mesi fa puo' essere basata su una
// norma superata.
export const RILEGGI_DOPO_GIORNI = 180;

// Un'analisi avviata e mai finita si considera interrotta dopo un quarto d'ora.
const INTERROTTA_MS = 15 * 60 * 1000;

const MOTIVI = {
  mai_letto: 'non e\u2019 mai stato letto dall\u2019agente',
  analisi_fallita: 'l\u2019ultima lettura non e\u2019 riuscita',
  interrotta: 'la lettura si e\u2019 interrotta a meta\u2019',
  senza_scadenza: 'e\u2019 stato letto ma non se ne e\u2019 ricavata la scadenza',
  vecchia: 'l\u2019ultima lettura e\u2019 di piu\u2019 di sei mesi fa',
};

function letturaSalvata(doc) {
  if (!doc || !doc.analisi_json) return null;
  try { const j = JSON.parse(doc.analisi_json); return j && j.lettura ? j : null; } catch (_e) { return null; }
}

function giorniDa(iso, adessoMs) {
  const t = iso ? new Date(iso).getTime() : 0;
  return t > 0 ? Math.floor((adessoMs - t) / 86400000) : null;
}

/**
 * I documenti che vale la pena far leggere all\u2019agente, dal piu\u2019 urgente.
 * Funzione pura: le prove la possono chiamare senza toccare la piattaforma.
 * Restituisce [{ id, soggetto_chiave, motivo, spiegazione }], al massimo "massimo".
 */
export function daAnalizzare(documenti, tipi, opzioni) {
  const o = opzioni || {};
  const adessoMs = o.adessoMs || 0;
  const massimo = o.massimo == null ? 5 : Number(o.massimo);
  const rileggiDopo = o.rileggiDopoGiorni == null ? RILEGGI_DOPO_GIORNI : Number(o.rileggiDopoGiorni);
  const perTipo = new Map((tipi || []).map(t => [t.id, t]));
  const PESO = { mai_letto: 0, analisi_fallita: 1, interrotta: 2, senza_scadenza: 3, vecchia: 4 };

  const scelti = [];
  for (const d of documenti || []) {
    if (!d || d.stato === 'sostituito' || !d.file_uri) continue;
    const tipo = perTipo.get(d.tipo_documento_id);
    if (!tipo || tipo.attivo === false) continue;

    const salvata = letturaSalvata(d);
    let motivo = null;
    if (d.analisi_stato === 'in_corso' && (adessoMs - new Date(d.analisi_avviata_il || 0).getTime()) > INTERROTTA_MS) motivo = 'interrotta';
    else if (d.analisi_stato === 'errore') motivo = 'analisi_fallita';
    else if (!salvata) motivo = 'mai_letto';
    else if (!d.data_scadenza && !d.data_scadenza_manuale && tipo.tipo_scadenza !== 'nessuna') motivo = 'senza_scadenza';
    else {
      const eta = giorniDa(salvata.analizzato_il, adessoMs);
      if (eta !== null && eta >= rileggiDopo) motivo = 'vecchia';
    }
    if (!motivo) continue;
    scelti.push({
      id: d.id, soggetto_chiave: d.soggetto_chiave, soggetto_nome: d.soggetto_nome,
      tipo_documento_nome: d.tipo_documento_nome, motivo, spiegazione: MOTIVI[motivo], peso: PESO[motivo],
    });
  }

  scelti.sort((a, b) => a.peso - b.peso || String(a.soggetto_nome || '').localeCompare(String(b.soggetto_nome || ''), 'it'));
  return massimo > 0 ? scelti.slice(0, massimo) : scelti;
}
