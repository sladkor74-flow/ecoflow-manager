import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { cancellaFile } from "../../shared/fileArchivio.ts";
import {
  BASE_CONOSCENZA, FONTI_UFFICIALI, VERIFICATO_IL, REGOLE_FONTI, testoConoscenza, vociApprovate,
  proponiNovita, proponiPrecisazioni, scartaSuperate,
} from "../../shared/baseConoscenza.ts";
import { analizzaDomanda, situazioneGestionale } from "../../shared/assistente.ts";
import { catalogoStrumenti, eseguiStrumento } from "../../shared/strumentiAssistente.ts";
import { nuovaCache } from "../../shared/cacheLetture.ts";
import { SCHEMA_PIANO, istruzioniPiano, strumentiDalPiano, testoDati } from "../../shared/pianoAssistente.ts";
import { materialePertinente } from "../../shared/materialeCorso.ts";
import { oggiRoma } from "../../shared/qualificaFornitori.ts";
import { eAmministratore } from "../../shared/permessi.ts";
import {
  SCHEMA_FILE_DA_CREARE, SCHEMA_LETTURA_FILE, REGOLE_FILE, allegatiRicevuti, istruzioniLettura, allegatiPerPrompt, fileDaCreare,
} from "../../shared/fileEcoTyna.ts";

// Assistente del gestionale: risponde a dubbi normativi, a domande sui dati della
// commessa e spiega i quiz dell'esame da responsabile tecnico.
//
// Ogni risposta si appoggia alla base di conoscenza verificata (voci del codice
// piu' quelle approvate nel gestionale), cita le fonti e, per le domande sulle
// norme, controlla online che non ci siano novita'. Le novita' trovate diventano
// proposte da approvare, mai modifiche automatiche.
//
// Payload: { domanda, conversazione_id?, contesto?: { tipo: 'quiz', banca, domanda, risposte, esatta, scelta } }

const SCHEMA_RISPOSTA = {
  type: 'object',
  properties: {
    risposta: { type: 'string' },
    fonti: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titolo: { type: 'string' },
          riferimento: { type: 'string' },
          url: { type: 'string' },
          verificato_il: { type: 'string' },
          tipo: { type: 'string', enum: ['norma', 'gestionale'] },
          strumento: { type: 'string' },
          periodo: { type: 'string' },
        },
      },
    },
    dati_mancanti: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          cosa: { type: 'string' },
          dove_trovarlo: { type: 'string' },
        },
      },
    },
    certezza: { type: 'string', enum: ['alta', 'media', 'bassa'] },
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
    precisazioni_utente: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['faq', 'regola_interna'] },
          area: { type: 'string', enum: ['pfu', 'tua', 'albo', 'rentri', 'documenti', 'gestionale'] },
          titolo: { type: 'string' },
          testo: { type: 'string' },
        },
      },
    },
    file_da_creare: SCHEMA_FILE_DA_CREARE,
  },
  required: ['risposta'],
};

// LO SCHEMA DI UNA DOMANDA SUI DATI. Senza i campi fonti e novita_normative: e'
// l'unico modo di spegnere i link alla radice, perche' un campo che c'e' il
// modello lo riempie, e riempirlo lo porta nel registro del consulente che cita
// invece che del responsabile tecnico che risponde (richiesta dell'utente,
// 29/09/2026: "non mi risponde in maniera puntuale ... e mi invia link presi
// online"). I moduli del gestionale interrogati restano registrati sotto la
// risposta dalla chat, come sempre.
const SCHEMA_RISPOSTA_DATI = {
  type: 'object',
  properties: {
    risposta: SCHEMA_RISPOSTA.properties.risposta,
    dati_mancanti: SCHEMA_RISPOSTA.properties.dati_mancanti,
    certezza: SCHEMA_RISPOSTA.properties.certezza,
    precisazioni_utente: SCHEMA_RISPOSTA.properties.precisazioni_utente,
    file_da_creare: SCHEMA_RISPOSTA.properties.file_da_creare,
  },
  required: ['risposta'],
};

const comeOggetto = (v) => {
  if (v && typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch { return { risposta: String(v || '') }; }
};
const taglia = (s, n) => { const t = String(s || ''); return t.length > n ? t.slice(0, n) + '…' : t; };

export default async function(req) {
  let base44 = null;
  let recordId = null;
  try {
    base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const domanda = String(body.domanda || '').trim();
    if (!domanda) return Response.json({ error: 'Scrivi una domanda' }, { status: 400 });
    if (domanda.length > 4000) return Response.json({ error: 'La domanda e\' troppo lunga: massimo 4.000 caratteri' }, { status: 400 });
    const contesto = body.contesto && typeof body.contesto === 'object' ? body.contesto : null;
    const quiz = contesto && contesto.tipo === 'quiz' ? contesto : null;
    // Allegare file e' un caricamento: lo fa solo l'amministratore. Tutti possono
    // invece scaricare i file che EcoTyna prepara.
    const allegati = allegatiRicevuti(body.allegati);
    if (allegati.length && user.role !== 'admin') {
      return Response.json({ error: 'Solo l\'amministratore puo\' allegare file a EcoTyna. Puoi fare la domanda senza allegati, oppure aprire una richiesta.' }, { status: 403 });
    }

    const svc = base44.asServiceRole.entities;
    // LA CONVERSAZIONE E' DI CHI L'HA APERTA (02/10/2026).
    //
    // conversazione_id arrivava dal corpo e si usava com'era: bastava conoscerne
    // uno per infilarsi nel filo di un altro. Due danni. Il primo: le domande e
    // le risposte precedenti di quel filo entrano nel prompt, quindi si leggono
    // di rimbalzo nella risposta. Il secondo, peggiore: la domanda nuova resta
    // attaccata a quel filo, e quando l'amministratore lo riprende si porta
    // dentro il testo scritto da un altro.
    //
    // Un filo si riprende solo se e' il proprio. Se non lo e', non si risponde
    // con un errore: se ne apre uno nuovo, perche' la domanda resta legittima.
    const filoChiesto = String(body.conversazione_id || '');
    let precedenti = filoChiesto
      ? await svc.DomandaAssistente.filter({ conversazione_id: filoChiesto }, 'created_date', 50).catch(() => [])
      : [];
    const mioFilo = !precedenti.length || eAmministratore(user)
      || precedenti.every(p => !p.created_by_id || p.created_by_id === user.id);
    if (!mioFilo) precedenti = [];
    const conversazioneId = (mioFilo && filoChiesto) || crypto.randomUUID();

    const analisi = quiz ? { dati: false, norma: true, ambito: 'esercitazione' } : analizzaDomanda(domanda);
    const record = await svc.DomandaAssistente.create({
      conversazione_id: conversazioneId,
      titolo_conversazione: precedenti[0]?.titolo_conversazione || taglia(quiz ? 'Quiz: ' + quiz.domanda : domanda, 90),
      domanda,
      ambito: analisi.ambito,
      dati_gestionale: analisi.dati,
      ricerca_online: analisi.norma,
      contesto_json: contesto ? JSON.stringify(contesto) : '',
      allegati_json: allegati.length ? JSON.stringify(allegati.map(a => ({ nome: a.nome, tipo: a.tipo, dimensione: a.dimensione, caricato: !!a.file_uri }))) : '',
      stato: 'in_corso',
      valutazione: 'nessuna',
    });
    recordId = record.id;

    // PDF e immagini li legge il modello, in una chiamata a parte: nella stessa
    // chiamata non si possono leggere file e cercare sul web.
    const core = base44.asServiceRole.integrations.Core;
    const caricati = allegati.filter(a => a.file_uri);
    let letture = [];
    if (caricati.length) {
      const urls = await Promise.all(caricati.map(a => core.CreateFileSignedUrl({ file_uri: a.file_uri, expires_in: 900 }).then(r => r.signed_url)));
      try {
        const lettura = comeOggetto(await core.InvokeLLM({ prompt: istruzioniLettura(domanda, caricati), file_urls: urls, response_json_schema: SCHEMA_LETTURA_FILE }));
        letture = Array.isArray(lettura.file) ? lettura.file : [];
      } finally {
        // Il file era li' solo per essere letto, e l'entita' lo dichiara: "i file
        // non si conservano". Fino al 29/09/2026 non veniva mai cancellato e
        // nemmeno tentato, quindi ogni PDF allegato a una domanda restava in
        // archivio per sempre, senza che nessun record ne sapesse l'identificativo.
        // Si toglie anche quando la lettura non riesce: a maggior ragione.
        //
        // E se non si riesce a toglierlo lo si SCRIVE sull'allegato salvato:
        // credere di aver liberato spazio senza averlo fatto e' peggio che saperlo.
        for (const a of caricati) {
          const tolto = await cancellaFile(base44, a.file_uri);
          if (!tolto.riuscita) { a.file_rimasto = a.file_uri; a.motivo_file_rimasto = tolto.come; }
        }
      }
    }
    const { sezione: sezioneAllegati, daSalvare: allegatiSalvati } = allegatiPerPrompt(allegati, letture);
    // Nelle domande successive della stessa conversazione EcoTyna ritrova l'estratto dell'ultimo file allegato.
    const ultimiAllegati = [...precedenti].reverse().map(p => { try { return JSON.parse(p.allegati_json || '[]'); } catch { return []; } }).find(l => l.some(a => a.estratto));

    const oggi = oggiRoma();

    // Prima di rispondere si decide dove guardare: una chiamata che sceglie gli
    // strumenti, poi gli strumenti si eseguono davvero.
    //
    // Questo passaggio si fa per ogni domanda, non solo per quelle che sembrano
    // "sui dati". Prima decideva un elenco di parole, e bastava una domanda
    // scritta con parole diverse - le omologhe che scadono, chi non e' iscritto
    // al RENTRI, quanto dobbiamo pagare a un fornitore - perche' EcoTyna
    // rispondesse senza aver guardato niente. Ora e' il pianificatore a dire se
    // servono dati: se la domanda e' solo di norma lascia l'elenco vuoto e non
    // si interroga nulla.
    let piano = null;
    let pianoRiuscito = false;
    let risultati = [];
    let contiLetture = null;
    if (!quiz) {
      // QUI C'ERA UNA SCORCIATOIA, ed e' stata tolta il 30/09/2026, poche ore
      // dopo averla scritta. Riconosceva la domanda canonica sul raccolto e
      // saltava questa chiamata al modello: una chiamata risparmiata su due.
      // Una revisione avversariale le ha trovato nove difetti gravi, tutti dello
      // stesso tipo - un pezzo della domanda che si perde per strada e un numero
      // che esce piu' grande o piu' piccolo del vero senza che nessuno lo dica -
      // piu' un ciclo infinito su "quanto abbiamo raccolto da marzo a maggio?".
      //
      // Il pianificatore costa una chiamata e capisce l'italiano; una regex che
      // prova a capirlo indovina, e su un numero indovinare non si puo'. Se un
      // giorno la scorciatoia torna, dovra' avere una grammatica stretta e le sue
      // prove per ogni forma che accetta, non solo per quelle che rifiuta.
      try {
        const p = comeOggetto(await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: istruzioniPiano(catalogoStrumenti(), domanda, oggi, precedenti.slice(-3)),
          response_json_schema: SCHEMA_PIANO,
        }));
        if (p && Array.isArray(p.strumenti)) { piano = p; pianoRiuscito = true; }
      } catch (e) {
        piano = null;
      }
      const scelti = strumentiDalPiano(piano, catalogoStrumenti(), oggi, domanda);
      // Se la scelta non riesce del tutto si torna al riepilogo generale, che e'
      // meglio di niente; se invece il piano dice "nessuno strumento" lo si
      // rispetta, perche' e' una domanda di norma.
      const daFare = scelti.length ? scelti
        : (!pianoRiuscito && analisi.dati ? [{ nome: 'panoramica_commessa', parametri: {} }] : []);
      if (daFare.length) {
        // Una cache per QUESTA domanda: gli strumenti partono insieme e spesso
        // leggono gli stessi archivi. Senza, le primarie di rete si rileggono una
        // volta per strumento, e sono decine di migliaia di righe.
        const cache = nuovaCache();
        risultati = await Promise.all(daFare.map(async (x) => {
          const esito = await eseguiStrumento(base44, x.nome, x.parametri || {}, cache);
          return x.ignorati && x.ignorati.length ? { ...esito, parametri_ignorati: x.ignorati } : esito;
        }));
        contiLetture = cache.conti();
      }
    }

    // Uno strumento che va in errore non consegna dati: se sono andati storti
    // tutti, la domanda resterebbe senza numeri anche potendo avere il riepilogo.
    const conDati = risultati.filter(r => !r.errore).length;
    // SOLO DATI: la domanda ha avuto i suoi numeri dagli strumenti e il
    // pianificatore ha detto che la norma non c'entra. Allora niente ricerca
    // online, niente schede del corso, niente apparato delle fonti: la risposta
    // e' il numero.
    //
    // Il campo serve_normativa non e' obbligatorio nello schema del piano: se
    // manca, vale come "serve". Si sbaglia sempre dal lato delle fonti, perche'
    // una risposta normativa senza fonti e' molto peggio di una risposta sui dati
    // con un link di troppo.
    const soloDati = conDati > 0 && !!piano && piano.serve_normativa === false;
    const [approvate, dati, corso] = await Promise.all([
      vociApprovate(base44),
      analisi.dati && !conDati ? situazioneGestionale(base44, oggi).catch(e => `Dati del gestionale non disponibili: ${e.message || e}`) : Promise.resolve(''),
      // Schede del corso RT pertinenti: solo per le domande sulle norme e per i quiz.
      analisi.norma && !soloDati ? materialePertinente(base44, quiz ? `${quiz.domanda} ${(quiz.risposte || []).join(' ')}` : domanda).catch(() => ({ testo: '', fonti: [] })) : Promise.resolve({ testo: '', fonti: [] }),
    ]);

    const storia = precedenti
      .filter(p => p.stato === 'completata')
      .slice(-6)
      .map(p => `Domanda: ${taglia(p.domanda, 800)}\nRisposta: ${taglia(p.risposta, 1500)}`)
      .join('\n\n');

    const prompt = [
      'Sei EcoTyna, l\'assistente del gestionale di SMOCO Srl, azienda che raccoglie e trasporta pneumatici fuori uso (PFU, codice EER 16 01 03, rifiuti speciali non pericolosi) per il sistema collettivo Ecotyre nel Sud Italia.',
      'Conosci il lavoro di SMOCO: ritiri dai punti di raccolta della rete (soprattutto gommisti, spesso con meno di dieci dipendenti), ritiri dai demolitori del circuito ACI, conferimenti a stoccaggi e impianti incaricati, formulari cartacei e digitali, omologhe annuali e dichiarazioni RENTRI dei produttori, qualifica documentale dei fornitori, target e fatturazione verso Ecotyre.',
      'Aiuti la direzione con i dubbi sulle norme (D.Lgs. 152/2006, DM 182/2019 sui PFU, RENTRI e DM 59/2023, Albo nazionale gestori ambientali e responsabile tecnico), con le domande sui dati della commessa e con la preparazione all\'esame di responsabile tecnico gestione rifiuti. Rispondi come una consulente esperta del settore: applica la regola al caso concreto di SMOCO e distingui i soggetti (produttore, trasportatore, stoccaggio, impianto, intermediario) quando la risposta cambia.',
      '',
      `Data di oggi: ${oggi}. Utente: ${user.full_name || user.email || ''}.`,
      '',
      ...(soloDati ? [] : [REGOLE_FONTI]),
      '',
      'REGOLE',
      ...(soloDati ? [
        // COME SI RISPONDE A UNA DOMANDA SUI NUMERI (richiesta dell'utente,
        // 29/09/2026: la voleva "abbastanza secca e specifica", da responsabile
        // tecnico e non da consulente). Queste righe sostituiscono l'apparato
        // delle fonti, che su una domanda sui dati non serve e allunga la
        // risposta senza aggiungerci niente.
        'Questa e\' una domanda sui DATI della commessa, non sulle norme: rispondi come un responsabile tecnico che ha i numeri davanti.',
        'D. Il numero va nella PRIMA RIGA, con la sua etichetta: soggetto, canale e periodo. Esempio: "EMMESSE, rete, agosto 2026: 412,30 t in 58 formulari." Poi, solo se aggiungono qualcosa, due o tre righe di dettaglio. Niente premesse, niente "in base ai dati del gestionale", niente ripetizione della domanda.',
        'D-bis. Non citare norme, non linkare siti e non consigliare di verificare su Normattiva: qui non c\'entrano. Se per rispondere servisse una norma, dillo in una riga e fermati.',
        'D-ter. Se un dato porta avviso_soggetto o numero_non_calcolabile, NON scrivere nessun numero per quel soggetto: riporta l\'avviso come prima riga e chiedi il nome per esteso. Zero non e\' la risposta: la risposta e\' che non si sa di chi si parla.',
        'D-quater. Non aggiungere consigli, piani d\'azione o raccomandazioni che non sono stati chiesti. Se l\'utente vuole sapere quanto ha raccolto un fornitore, vuole sapere quanto ha raccolto quel fornitore.',
        'D-quinquies. Se un dato porta riserva_eseguiti, aggiungi UNA riga dopo il numero: quanti ordini e quante tonnellate aspettano il pulsante Chiudi a portale, e di chi sono se c\'e\' per_raccoglitore. Non sommarla al totale e non riscrivere il totale: il raccolto sono i terminati. Se porta lettura_non_riuscita, di\' che la riserva non si e\' potuta leggere e che il totale puo\' essere piu\' basso del vero.',
      ] : []),
      ...(soloDati ? [] : [`1. Parti dalla base di conoscenza qui sotto, verificata alla data indicata voce per voce. Per le domande sulle norme controlla online sulle fonti ufficiali (${FONTI_UFFICIALI.join('; ')}) se ci sono novita' successive alla data della voce: se ne trovi una certa, applicala, dillo chiaramente nella risposta e riportala in novita_normative con voce_id della voce da aggiornare (vuoto se serve una voce nuova), data_norma (AAAA-MM-GG), fonte e testo_proposto, che deve essere il testo COMPLETO della voce aggiornata, conservando tutto cio' che resta valido. In novita_normative vanno solo norme nuove: mai riassunti, consigli, lettere o norme gia' citate nella voce.`]),
      ...(soloDati ? [] : ['2. Ogni affermazione normativa deve avere una fonte precisa in fonti (norma e articolo, delibera, FAQ o sentenza) con la data di verifica. Non inventare numeri di articolo, date, importi o scadenze: se non sei sicuro dillo e spiega come verificarlo.']),
      '3. Per le domande sui dati usa solo i DATI DEL GESTIONALE forniti. Ogni numero che scrivi deve venire da li\', e accanto va detto da dove: lo strumento, il periodo e la data del dato. Se un dato manca dillo apertamente, mettilo in dati_mancanti con la sezione del gestionale dove si trova (Target & Status, Assegnati, Verifiche, Giacenze, Omologhe, Dichiarazioni RENTRI, Qualifica Fornitori, Fatturazione, Predittivita Secondarie (solo rete), To-Do List) e non stimarlo: una risposta che dice "questo non ce l\'ho" e\' utile, una che tira a indovinare no.',
      '3-ter. Rete, ACI ed extra raccolta sono commesse indipendenti: non sommarle mai in un unico numero e di\' sempre di quale canale stai parlando. I target sono solo della rete.',
      // Regola dell'utente del 22/09/2026: la predittivita' e' della rete e basta.
      // Senza questa riga EcoTyna poteva "completare" la proiezione con numeri
      // ACI o di extra raccolta presi da altri strumenti.
      '3-decies. La predittivita\' delle secondarie (modulo Predittivita Secondarie: proiezioni, programma della settimana dopo fissato il mercoledi\', programmato e fatto, giacenze degli stoccaggi che alimentano gli impianti) e\' solo del canale RETE: ACI ed extra raccolta non ci entrano, ne\' nei target, ne\' nei consuntivi, ne\' nelle giacenze (che contano le sole classi 1-4 della rilevazione e i movimenti di rete). Quando ne parli dillo. Se ti chiedono viaggi, residui o previsioni della predittivita\' per l\'ACI o per l\'extra raccolta, rispondi che la predittivita\' non li considera, e non ricavarli ne\' aggiungerli con numeri presi da altri strumenti. Del programma della settimana dopo riporta lo stato che dice lo strumento (fissato, quando si fissa, o che il mercoledi\' e\' passato e lo deve fissare a mano l\'amministratore): non promettere mai un mercoledi\' gia\' passato. Gli impianti di uno stoccaggio con la stessa priorita\' sono serviti insieme, senza un primo.',
      // Regola dell'utente del 22/09/2026: le date dei formulari sono
      // obbligatorie e vanno segnalate ovunque ci siano ordini terminati. Gli
      // strumenti le portano in "date_obbligatorie_da_sistemare": senza questa
      // riga EcoTyna poteva dare il conto e tacere che era incompleto.
      '3-undecies. Immissione, inizio e fine trasporto sono date obbligatorie nei formulari. Quando un dato porta "date_obbligatorie_da_sistemare" (o gli alert delle date obbligatorie) dillo sempre nella risposta, modulo per modulo e canale per canale: quanti ordini, quanti senza fine trasporto e quindi esclusi dal conto, e quali date mancano o non tornano, con qualche ID ordine. Non tacerlo, non sommarlo fra canali, e di\' che le date vanno inserite o corrette: nel file del portale da ricaricare, oppure nella scheda per l\'extra raccolta.',
      '3-quinquies. Il periodo del dato e\' quello scritto nel blocco, non quello della domanda: se ti hanno chiesto un mese e il dato e\' dell\'anno, di\' che hai il dato dell\'anno e non scrivere mai quel numero accanto al nome del mese. Rietichettare un totale annuo come mensile e\' l\'errore peggiore che puoi fare. Lo stesso vale per il canale, per l\'impianto e per il raccoglitore: il numero resta attaccato all\'etichetta con cui e\' arrivato. E un sito e\' un impianto o uno stoccaggio secondo quello che dice il dato, che non e\' la stessa cosa. Non dire mai che un periodo, un soggetto o un luogo "non ha dati" se non e\' quello che hai guardato: di\' che cosa hai guardato e che per l\'altro serve rifare la domanda.',
      '3-septies. Non contare mai le righe di un elenco per dire quanti sono. Gli elenchi arrivano tagliati e lo dichiarano: hanno "quanti" (il totale vero), "mostrate" (quante se ne vedono) e, se sono tagliati, un avviso. Il numero da scrivere e\' sempre "quanti". Se ti serve un conto che il dato non fornisce - quanti di un certo tipo, quanti in una certa provincia - e l\'elenco e\' tagliato, dillo invece di contare a occhio.',
      '3-nonies. Di ogni numero che riguarda un canale scrivi qual e\'. Il totale della fatturazione, il raccolto, i viaggi: davanti ci va sempre il canale. Se il dato copre un canale solo perche\' cosi\' e\' stato chiesto, dillo, e aggiungi che degli altri due non stai parlando. Vale anche per il periodo e per il soggetto: il numero e la sua etichetta viaggiano insieme.',
      '3-sexies. Non sommare mai rete, ACI ed extra raccolta, nemmeno se te lo chiedono in modo esplicito ("in tutto", "complessivamente", "tutti e tre"). In quel caso dai i tre numeri uno sotto l\'altro, ciascuno con il suo nome, e spiega in una riga che sono commesse indipendenti e che un totale unico non vuol dire niente. Un unico numero che le mette insieme non deve comparire nella risposta: ne\' in tonnellate, ne\' come numero di formulari, ne\' come totale di controllo, ne\' nella frase di apertura. Vale anche fra primarie, secondarie e terziarie di canali diversi.',
      '3-octies. Il totale lo dice il dato, non la tua somma. Quando un blocco porta "tonnellate", "formulari" o "quanti", quello e\' il numero da scrivere: il dettaglio serve a spiegarlo, non a ricalcolarlo. Non prendere mai il valore di una riga del dettaglio al posto del totale, e non sommare le righe per rifare un totale che e\' gia\' li\'.',
      '3-quater. In fonti metti le norme e i documenti: i moduli del gestionale che hai interrogato sono gia\' registrati sotto la risposta, non ripeterli. Quando la risposta e\' un elenco lungo, chiudi offrendo di prepararlo in Excel o in PDF: il file si crea solo se l\'utente lo chiede.',
      '3-bis. Se nella domanda o nella conversazione l\'utente corregge una tua risposta o afferma una regola ("non e\' cosi\'", "da noi si fa cosi\'", "il decreto dice che..."), tienine conto subito nella risposta e riportala in precisazioni_utente: tipo regola_interna se e\' una regola dell\'azienda, faq se chiarisce come si applica una norma; testo chiaro e autosufficiente. Diventera\' una proposta da approvare. Mai per una semplice domanda e mai per cio\' che la base di conoscenza dice gia\': in quei casi precisazioni_utente resta vuoto. Se contrasta con una norma verificata, spiegalo con garbo citando la fonte.',
      '4. Le voci dell\'area gestionale sono regole della direzione SMOCO: applicale. Distingui sempre gli obblighi di legge dalle regole interne e dalla prassi.',
      ...(soloDati ? [] : ['5. Scrivi in italiano semplice e pratico, in markdown. Prima la risposta in una o due frasi, poi i dettagli utili; elenchi solo se aiutano; niente formule di cortesia ne\' ripetizioni della domanda.']),
      '6. certezza: alta se la risposta poggia su norme verificate o su dati presenti; media se richiede interpretazione; bassa se mancano elementi, e in quel caso consiglia di confermare con il consulente ambientale o con l\'ente competente.',
      ...(soloDati ? [] : ['7. Per decisioni con conseguenze legali importanti ricorda di verificare il testo vigente su Normattiva.']),
      ...(soloDati ? [] : ['8. Le schede del CORSO RT sono materiale didattico di qualche anno fa: usale per spiegare concetti e contesto, ma prevalgono sempre la base di conoscenza verificata e le norme vigenti. Se una scheda contrasta con la norma attuale segui la norma attuale e fai notare la differenza; se la usi citala in fonti come "Corso RT" con modulo e anno del materiale.']),
      ...(quiz ? [
        '',
        'ESERCITAZIONE',
        'L\'utente si sta preparando all\'esame di responsabile tecnico e chiede la spiegazione di un quiz della banca dati ufficiale dell\'Albo (pubblicata il 19/12/2025).',
        `Quiz: ${quiz.domanda}`,
        `Risposte proposte: ${(Array.isArray(quiz.risposte) ? quiz.risposte : []).map((r, i) => `${String.fromCharCode(65 + i)}) ${r}`).join(' ')}`,
        `Risposta esatta secondo la banca dati ufficiale: ${quiz.esatta}`,
        quiz.scelta ? `L'utente aveva scelto: ${quiz.scelta}` : 'L\'utente non ha risposto.',
        'Spiega perche\' la risposta esatta e\' corretta e perche\' le altre sono sbagliate, con i riferimenti normativi, e dai un modo semplice per ricordarla. Se la norma e\' cambiata dopo la pubblicazione dei quiz, segnalalo, ricordando che all\'esame vale la risposta della banca dati.',
      ] : []),
      '',
      REGOLE_FILE,
      '',
      'BASE DI CONOSCENZA',
      `Voci del codice (id: titolo): ${BASE_CONOSCENZA.map(v => `${v.id}: ${v.titolo}`).join('; ')}.`,
      testoConoscenza(approvate),
      ...(corso.testo ? ['', 'CORSO RT (schede di studio dal materiale del corso per responsabile tecnico)', corso.testo] : []),
      ...(storia ? ['', 'CONVERSAZIONE PRECEDENTE', storia] : []),
      ...(!allegati.length && ultimiAllegati ? ['', 'FILE ALLEGATI IN PRECEDENZA IN QUESTA CONVERSAZIONE (estratto)', ultimiAllegati.map(a => `[${a.rif || ''}] ${a.nome}\n${a.estratto || ''}`).join('\n\n')] : []),
      ...(allegati.length ? ['', 'ALLEGATI (file inviati con questa domanda)', sezioneAllegati] : []),
      // Quando la scelta degli strumenti non riesce, i dati qui sotto sono il
      // riepilogo generale e non la ricerca puntuale che la domanda chiedeva:
      // senza dirlo, la risposta esce sicura di se' e generica.
      ...(!quiz && !pianoRiuscito ? ["AVVISO: la scelta degli strumenti non e' riuscita, quindi qui sotto trovi il riepilogo generale della commessa e non la ricerca puntuale che la domanda chiedeva. Se il numero preciso che serviva non c'e' nel riepilogo, dillo e invita a ripetere la domanda: non rispondere con il numero piu' simile che trovi."] : []),
      ...(risultati.length ? ['', testoDati(risultati)] : []),
      ...(dati ? ['', dati] : []),
      '',
      'DOMANDA',
      domanda,
    ].join('\n');

    const esito = comeOggetto(await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      // La ricerca online era accesa da un elenco di parole che contiene il
      // vocabolario del mestiere: "formulari", "classe", "trasporto", "serve".
      // Una domanda sui numeri non ha bisogno di internet, e con internet
      // acceso la risposta usciva generica e piena di link.
      add_context_from_internet: analisi.norma && !soloDati,
      response_json_schema: soloDati ? SCHEMA_RISPOSTA_DATI : SCHEMA_RISPOSTA,
    }));

    const fonti = (Array.isArray(esito.fonti) ? esito.fonti : [])
      .filter(f => f && (f.titolo || f.riferimento || f.url))
      .slice(0, 12)
      .map(f => ({ titolo: taglia(f.titolo, 200), riferimento: taglia(f.riferimento, 300), url: /^https?:\/\//.test(String(f.url || '')) ? String(f.url) : '', verificato_il: taglia(f.verificato_il || VERIFICATO_IL, 20) }));
    const certezza = ['alta', 'media', 'bassa'].includes(esito.certezza) ? esito.certezza : 'media';

    // File da preparare: se ne salva la descrizione (il file si genera nel browser).
    // Una descrizione troppo grande si restituisce ma non si conserva.
    const fileGenerati = fileDaCreare(esito.file_da_creare);
    const fileJson = JSON.stringify(fileGenerati);
    const aggiornato = await svc.DomandaAssistente.update(recordId, {
      risposta: String(esito.risposta || 'Non sono riuscito a formulare una risposta: riprova riformulando la domanda.'),
      fonti_json: JSON.stringify(fonti),
      certezza,
      strumenti_json: risultati.length ? JSON.stringify({ strumenti: risultati.map(r => ({ strumento: r.strumento, parametri: r.parametri, fonte: r.fonte, periodo: r.periodo, dati_al: r.dati_al, errore: r.errore || '' })), piano: pianoRiuscito ? (piano && piano.strumenti && piano.strumenti[0] && /senza chiamare il modello/.test(String(piano.strumenti[0].perche || '')) ? 'scorciatoia' : 'pianificatore') : 'ripiego', letture: contiLetture }) : undefined,
      // Se il pianificatore ha guardato nel gestionale, la scheda lo dice, anche
      // se l'analisi iniziale della domanda non se n'era accorta.
      dati_gestionale: conDati > 0 || analisi.dati,
      // Quello che e' ACCADUTO, non quello che si era previsto alla creazione del
      // record: con soloDati internet non viene interrogato, e il riquadro
      // "Verificata sulle fonti" su una risposta senza fonti e' una bugia.
      ricerca_online: analisi.norma && !soloDati,
      ambito: risultati.length && analisi.ambito === 'normativa' ? 'mista' : analisi.ambito,
      dati_mancanti_json: Array.isArray(esito.dati_mancanti) && esito.dati_mancanti.length ? JSON.stringify(esito.dati_mancanti) : undefined,
      allegati_json: allegati.length ? JSON.stringify(allegatiSalvati) : '',
      file_generati_json: fileGenerati.length ? (fileJson.length <= 300000 ? fileJson : JSON.stringify(fileGenerati.map(f => ({ ...f, fogli: undefined, testo: undefined, non_conservato: true })))) : '',
      stato: 'completata',
      errore: '',
    });

    // LE PROPOSTE SI APRONO, LA CONOSCENZA APPROVATA NON SI TOCCA (02/10/2026).
    //
    // Qui finivano insieme tre cose diverse, e una sola di esse e' davvero
    // 'aprire una richiesta'.
    //
    // La PRECISAZIONE resta aperta a tutti, ed e' la scelta giusta: e' il
    // meccanismo che la regola dell'utente descrive - chi non modifica apre una
    // richiesta, e l'amministratore valuta. Nasce senza voce_id, quindi non
    // scavalca niente e non tocca nessuna voce approvata: resta in coda finche'
    // non la si approva.
    //
    // Le NOVITA' NORMATIVE no. Gli id delle voci stanno nel prompt, il modello
    // riempie voce_id leggendo la domanda, e proponiNovita mette da parte le
    // proposte in attesa su QUELLA voce: la vittima la sceglie chi scrive la
    // domanda. Una proposta in attesa, magari dell'amministratore, sparirebbe
    // perche' qualcuno ha fatto una domanda.
    //
    // scartaSuperate nemmeno: disattiva voci APPROVATE della base di conoscenza
    // (attiva: false, con il motivo). E' l'archivio che l'RLS dichiara
    // scrivibile solo dall'amministratore, e qui si passava col service role.
    //
    // I due try sono separati di proposito: se una delle due strade fallisce,
    // l'altra deve comunque andare. Prima un catch solo le ingoiava tutte e due.
    const puoScrivereConoscenza = eAmministratore(user);
    let precisazioni = [];
    let novita = [];
    try {
      precisazioni = await proponiPrecisazioni(base44, esito.precisazioni_utente, { oggi, utente: user.full_name || user.email, domandaId: recordId, domanda, approvate });
    } catch (_e) { /* la risposta resta valida anche se la precisazione non si salva */ }
    if (puoScrivereConoscenza) {
      try {
        novita = await proponiNovita(base44, (esito.novita_normative || []).slice(0, 3), { oggi, origine: 'domanda', approvate, collegamenti: { domanda_id: recordId } });
        if (novita.length || precisazioni.length) await scartaSuperate(base44);
      } catch (_e) { /* idem */ }
    }
    const proposte = novita.length + precisazioni.length;

    return Response.json({ ok: true, record: aggiornato || { ...record, risposta: esito.risposta, fonti_json: JSON.stringify(fonti), certezza, stato: 'completata' }, proposte, precisazioni: precisazioni.length, novita: novita.length, file_generati: fileGenerati });
  } catch (error) {
    const messaggio = error && error.message ? error.message : String(error);
    if (base44 && recordId) {
      try { await base44.asServiceRole.entities.DomandaAssistente.update(recordId, { stato: 'errore', errore: messaggio }); } catch (_e) { /* resta il messaggio principale */ }
    }
    return Response.json({ error: messaggio, record_id: recordId }, { status: 500 });
  }
}
