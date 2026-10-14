// Come EcoTyna decide dove andare a prendere i numeri.
//
// Prima di rispondere a una domanda sui dati si fa un passaggio in piu': si
// legge la domanda, si capisce di che periodo e di che canale parla, e si
// scelgono gli strumenti da interrogare fra quelli del registro. Poi si
// eseguono e solo allora si risponde, con i dati veri sotto gli occhi.
//
// Costa una chiamata in piu' per le domande sui dati, e vale la pena: la
// differenza e' fra un assistente che riassume quello che gli hanno messo in
// tasca e uno che va a guardare la cosa giusta.
//
// E dopo il pianificatore c'e' una GUARDIA (correggiPiano, 14/10/2026): il
// pianificatore e' un modello, e a «quanti ordini aperti ci sono a Siracusa?»
// aveva scelto le Richieste ECT, cioe' le richieste arrivate via email. Gli
// errori evidenti della mappa delle domande (MAPPA_DOMANDE) si riconoscono dalle
// parole della domanda, senza modello, e si correggono prima di eseguire.

import { provinciaChiesta } from "./province.ts";

const CANALI = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];

// Per questi strumenti il canale e' obbligatorio, perche' leggono tre archivi
// diversi e senza canale non saprebbero quale aprire: il raccolto (Terminati
// Rete, Terminati ACI, Extra Raccolta) e, dal 14/10/2026, gli ordini aperti
// (Assegnati Rete, Assegnati ACI) e chiusi. Per tutti gli altri e' un filtro:
// imporgli "RETE" quando nessuno l'ha chiesto significa nascondere le righe ACI
// ed extra che lo strumento avrebbe restituito gia' separate.
const CANALE_OBBLIGATORIO = new Set(['raccolto', 'ordini_aperti', 'ordini_chiusi']);

// Nella fatturazione e nelle tariffe il canale si chiama tipologia.
const SINONIMI_CANALE = { fatturazione: 'tipologia', tariffe: 'tipologia' };

// Qualche filtro il pianificatore lo scrive con un nome vicino ma non uguale.
// Il trasportatore (14/10/2026) e' il raccoglitore degli ordini e il vettore
// delle secondarie e terziarie.
const SINONIMI_PARAMETRI = {
  fornitore: ['raccoglitore', 'soggetto', 'produttore', 'trasportatore'],
  raccoglitore: ['fornitore', 'trasportatore'],
  trasportatore: ['raccoglitore', 'fornitore'],
  soggetto: ['fornitore'],
  produttore: ['fornitore', 'soggetto', 'origine'],
  origine: ['raccoglitore', 'fornitore', 'soggetto', 'produttore', 'sito'],
  cerca: ['testo'],
  testo: ['cerca'],
  sito: ['destinazione'],
  destinazione: ['sito'],
};

/**
 * La chiave con cui la scelta corretta dalla guardia viaggia fra i parametri di
 * uno strumento fino al suo risultato: eseguiStrumento (strumentiAssistente.ts)
 * la toglie prima di eseguire e la scrive accanto al periodo, che la chat mostra
 * in «Dove ho guardato». Nessuno strumento ha un parametro con questo nome.
 */
export const CHIAVE_SCELTA = '__scelta_corretta';

/** L'unione dei parametri di tutti gli strumenti, dichiarati uno per uno. */
const PARAMETRI = {
  anno: { type: 'integer' },
  mese: { type: 'string' },
  // Piu' mesi in una domanda sola: "nei mesi di luglio e agosto", "da marzo a
  // maggio". Prima c'era mese_da, che nessuno strumento accettava e che finiva
  // sempre fra i parametri ignorati.
  mesi: { type: 'array', items: { type: 'string' } },
  settimana: { type: 'integer' },
  canale: { type: 'string', enum: CANALI },
  raggruppa: { type: 'string', enum: ['raccoglitore', 'provincia', 'regione', 'classe', 'destinazione', 'mese', 'comune', 'pdr'] },
  // La sigla, ma vale anche il nome (segnalazione alta A74 del 20/09, corretta
  // il 12/10/2026): il pianificatore ricopia la domanda, «Bari», e gli archivi
  // scrivono «BA». Lo strumento riconosce tutte e due (provinciaChiesta,
  // province.ts) e dice quando non riconosce la provincia o non trova niente.
  provincia: { type: 'string', description: 'sigla della provincia (BA); se la domanda dice il nome (Bari) va bene anche il nome' },
  regione: { type: 'string' },
  raccoglitore: { type: 'string' },
  destinazione: { type: 'string' },
  sito: { type: 'string' },
  tipo: { type: 'string' },
  pivot: { type: 'string' },
  testo: { type: 'string' },
  cerca: { type: 'string' },
  produttore: { type: 'string' },
  fornitore: { type: 'string' },
  soggetto: { type: 'string' },
  stato: { type: 'string', description: 'per secondarie e terziarie: aperte o chiuse; per richieste_ect lo stato della richiesta' },
  origine: { type: 'string' },
  // Gli ordini aperti e chiusi (14/10/2026): il punto di raccolta, il comune, il
  // trasportatore di secondarie e terziarie, la classe e l'attesa degli aperti.
  pdr: { type: 'string', description: 'codice del punto di raccolta (42872) o il suo nome' },
  comune: { type: 'string' },
  trasportatore: { type: 'string' },
  classe: { type: 'string' },
  da_almeno_giorni: { type: 'integer' },
  solo_sospetti: { type: 'boolean' },
  modulo: { type: 'string' },
  tipologia: { type: 'string', enum: [...CANALI, 'TUTTE'] },
  direzione: { type: 'string', enum: ['PASSIVA', 'ATTIVA'] },
  prestazione: { type: 'string', enum: ['RACCOLTA', 'TRASPORTO_SECONDARIA', 'TRATTAMENTO', 'CONFERIMENTO_STOCCAGGIO'] },
  in_scadenza: { type: 'boolean' },
  solo_problemi: { type: 'boolean' },
  solo_non_iscritti: { type: 'boolean' },
};

export const SCHEMA_PIANO = {
  type: 'object',
  properties: {
    periodo: {
      type: 'object',
      properties: {
        anno: { type: 'integer' },
        mese: { type: 'string' },
        mesi: { type: 'array', items: { type: 'string' } },
        settimana: { type: 'integer' },
        descrizione: { type: 'string' },
      },
    },
    canali: { type: 'array', items: { type: 'string', enum: ['RETE', 'ACI', 'EXTRA_RACCOLTA'] } },
    strumenti: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nome: { type: 'string' },
          // I parametri vanno elencati uno per uno. Un oggetto libero, senza
          // proprieta' dichiarate, torna indietro sempre vuoto: e uno strumento
          // senza parametri risponde sull'anno intero, che quasi mai e' la
          // domanda. Qui c'e' l'unione dei parametri di tutti gli strumenti.
          parametri: { type: 'object', properties: PARAMETRI },
          perche: { type: 'string' },
        },
        required: ['nome'],
      },
    },
    tabella_utile: { type: 'boolean' },
    // Se per rispondere serve la NORMA, oltre ai numeri. Da questo dipende se si
    // cerca online, se si caricano le schede del corso e se la risposta porta
    // l'apparato delle fonti: una domanda sui dati non ne ha bisogno, e con la
    // ricerca online accesa usciva generica e piena di link.
    //
    // Non e' obbligatorio, e la mancanza vale come "serve": si sbaglia dal lato
    // delle fonti, perche' una risposta normativa senza fonti e' molto peggio di
    // una risposta sui dati con un link di troppo.
    serve_normativa: { type: 'boolean' },
    ragionamento: { type: 'string' },
  },
  required: ['strumenti'],
};

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/**
 * LA MAPPA DELLE DOMANDE SULLA COMMESSA (richiesta dell'utente del 14/10/2026).
 *
 * Parole dell'utente: EcoTyna «deve avere esattamente bene a mente il modulo o
 * i moduli giusti per cercare le risposte su domande afferenti alla commessa
 * Ecotyre». Quel giorno, a una domanda sugli ordini aperti in una provincia,
 * aveva risposto con le Richieste ECT invece che con gli Assegnati; lo stesso
 * giorno, col contratto, aveva preso target_raccoglitori. Le descrizioni del
 * catalogo da sole non bastano: il pianificatore sceglie il nome che somiglia
 * di piu' alla domanda, e «richieste» somiglia a «richieste_ect». Qui la mappa
 * e' scritta una volta, nelle parole dell'utente, ed entra nelle regole del
 * pianificatore; la guardia (correggiPiano) corregge gli errori evidenti.
 * Prova: prove/ecotynaModuliGiusti.mjs.
 */
export const MAPPA_DOMANDE = [
  '- DOVE SI CERCA: la mappa delle domande sulla commessa Ecotyre. Conta che cosa chiede la domanda, non il nome dello strumento che le somiglia di piu\'. Nel linguaggio di chi chiede «richieste», «ritiri» e «ordini» sono la stessa cosa: gli ordini del portale.',
  '- ORDINI APERTI (quanti, quali, in una provincia, in un comune, di un PDR o di un raccoglitore, da quanto tempo aspettano, i piu\' vecchi, l\'arretrato, «da ritirare», «in attesa»): ordini_aperti, che legge gli Assegnati. Canale RETE (Assegnati Rete) per i gommisti; ACI (Assegnati ACI) se la domanda parla di demolitori, autodemolizioni, autodemolitori o ACI; EXTRA_RACCOLTA per le campagne di extra raccolta. Con provincia, comune, pdr o raccoglitore se la domanda li nomina.',
  '- ORDINI CHIUSI (se e quando e\' stato chiuso un ordine, l\'ultimo ritiro di un PDR, quanti ordini chiusi o ritiri in un periodo e in una provincia, quanti ne ha fatti un raccoglitore): ordini_chiusi, che legge i Terminati Rete, i Terminati ACI o l\'Extra Raccolta secondo il canale, sul giorno di fine trasporto. Con pdr se la domanda nomina un punto di raccolta (il codice, per esempio 42872, o il nome) e mesi se nomina un periodo. Per le sole tonnellate raccolte resta raccolto.',
  // Revisione del 14/10/2026: «quanti ordini ha fatto Emmesse a settembre?» non
  // dice «chiusi», ma un ordine fatto in un mese e' un ordine chiuso.
  '- ORDINI senza dire aperti o chiusi: con un periodo (un mese, un anno, «da luglio a settembre») o con «fatti», «gestiti», «serviti» sono i CHIUSI (ordini_chiusi: «quanti ordini ha fatto Emmesse a settembre?»); senza periodo («quanti ordini ci sono a Siracusa?») sono gli APERTI (ordini_aperti), che non hanno periodo.',
  '- SECONDARIE e TERZIARIE, aperte o chiuse (verso un impianto, da uno stoccaggio, in un mese): secondarie e terziarie, con stato aperte o chiuse, destinazione e origine. La predittivita\' delle secondarie (target degli impianti, viaggi da programmare, plafond) resta proiezione_secondarie.',
  '- FATTURATO o costo di un fornitore in un periodo («quanto ha fatturato Emmesse», «quanto abbiamo pagato a ...»): fatturazione con tipo PASSIVA e fornitore (se chi chiede non e\' l\'amministratore lo strumento dice da se\' che e\' riservato); quanto ci spetta o abbiamo fatturato a Ecotyre: fatturazione con tipo ATTIVA. I prezzi in €/t restano tariffe.',
  '- RICHIESTE ECT: richieste_ect SOLO se la domanda parla di richieste arrivate via email (o via posta, PEC), di richieste ricevute dal consorzio, di Richieste ECT o della To-Do List. MAI per «ordini aperti», «ordini chiusi», «richieste aperte» o «richieste chiuse» in una provincia o di un PDR: sono ordini, e stanno negli Assegnati (ordini_aperti) e nei Terminati (ordini_chiusi).',
  '- Contratto, target annuo e atteso: contratto_ecotyre; target dei singoli raccoglitori: target_raccoglitori; giacenze: giacenze; dichiarazioni: riepilogo_dichiarazioni e dichiarazioni_impianti; un ID ordine o un formulario: cerca_movimento, che guarda anche gli ordini aperti.',
];

/** Le istruzioni della fase di pianificazione. */
export function istruzioniPiano(catalogo, domanda, oggi, storia = []) {
  const anno = Number(String(oggi).slice(0, 4));
  const meseIdx = Number(String(oggi).slice(5, 7)) - 1;
  return [
    'Sei la parte di EcoTyna che decide dove andare a prendere i numeri. Non rispondi alla domanda: scegli soltanto quali strumenti interrogare e con quali parametri.',
    '',
    `Oggi e' ${oggi} (ora italiana): siamo nel ${MESI[meseIdx]} ${anno}. "Questo mese" e' ${MESI[meseIdx]} ${anno}, "il mese scorso" e' ${MESI[(meseIdx + 11) % 12]} ${meseIdx === 0 ? anno - 1 : anno}, "quest'anno" e' il ${anno}.`,
    '',
    'Regole:',
    '- Scegli il numero piu' + '̀ piccolo di strumenti che basta a rispondere. Se ne serve uno solo, uno solo.',
    '- COMPILA SEMPRE I PARAMETRI. Sono la parte piu\' importante del tuo lavoro: uno strumento senza parametri risponde sull\'anno intero e su tutta la rete, e quasi mai e\' la domanda. Se la domanda dice un mese, metti mese; se dice una settimana, metti settimana; se nomina un raccoglitore, un impianto, un fornitore o un produttore, mettilo nel parametro giusto. Riempi anche periodo, cosi\' resta scritto di che cosa si parla.',
    '- Se la domanda parla di PIU\' MESI ("luglio e agosto", "da marzo a maggio", "nel primo trimestre") scrivili tutti in mesi, uno per voce, con il nome per esteso: un intervallo va aperto mese per mese. Per un mese solo usa mese. Non scrivere mai un intervallo dentro mese: verrebbe letto come un mese che non esiste.',
    '- Il canale va sempre deciso: RETE, ACI ed EXTRA RACCOLTA sono commesse indipendenti e non si sommano mai. Se la domanda non lo dice e parla di raccolta, e\' RETE; se parla di autodemolizione o ACI, e\' ACI. Se la domanda chiede "in tutto", "complessivamente" o riguarda piu\' canali, metti in canali tutti quelli che servono: lo strumento verra\' eseguito una volta per canale e i numeri resteranno distinti. "Esclusa l\'extra raccolta" o "esclusi i demolitori" tolgono quel canale, "ACI compresa" lo aggiunge agli altri. Aci Sant\'Antonio, Aci Catena, Aci Castello e Aci Bonaccorsi sono comuni della provincia di Catania (rete), non il canale ACI.',
    '- I target sono solo della rete: per l\'ACI non esistono.',
    // Variazione del contratto del 14/10/2026: a «qual e' oggi il target annuo
    // del contratto Ecotyre, e com'e' messa la Puglia rispetto all'atteso?» il
    // pianificatore sceglieva target_raccoglitori, che non legge il contratto:
    // la risposta dava la somma dei raccoglitori come target del contratto (quel
    // giorno uguale per caso, prima della variazione 11.650 contro 11.550) e diceva che
    // la regione non si poteva estrarre. Le descrizioni del catalogo da sole non
    // bastavano: la regola lo dice in chiaro.
    '- Per il contratto Ecotyre della rete (il target annuo, l\'atteso alla data, lo scarto, il residuo, la proiezione, le variazioni del consorzio, una regione rispetto al contratto o all\'atteso, "come stiamo" con la commessa) usa contratto_ecotyre, con regione se la domanda ne nomina una. Usa target_raccoglitori solo per i singoli raccoglitori ("chi e\' sotto target", "quanto ha fatto X rispetto al suo target"): la somma dei loro target non e\' il contratto.',
    '- Per "quanto abbiamo raccolto" usa raccolto, non report_mensile: raccolto da il totale e il dettaglio di un canale e di un periodo. Usa report_mensile solo se la domanda chiede proprio le pivot del Report Mensile o il confronto fra i mesi.',
    '- Se la domanda cita un numero di formulario o un ID ordine, usa cerca_movimento.',
    // Chiusura dell'audit, 11/10/2026: lo strumento del riepilogo delle
    // dichiarazioni e' nuovo, e senza questa riga il pianificatore continuava a
    // rispondere a «quanto resta da dichiarare» con le sole giacenze.
    '- Per "quanto resta da dichiarare" a un impianto, quali mesi sono ancora da dichiarare, se un impianto quadra col portale, le dichiarazioni doppie o quelle che il portale ha e il gestionale no, usa riepilogo_dichiarazioni, con sito se la domanda nomina un impianto: esce gia\' diviso per canale. Per la giacenza di un sito usa giacenze; per l\'elenco delle dichiarazioni mese per mese, con i materiali ricavati, dichiarazioni_impianti.',
    // La mappa delle domande sulla commessa (14/10/2026): MAPPA_DOMANDE qui sopra.
    ...MAPPA_DOMANDE,
    '- Se la domanda non riguarda i dati del gestionale ma una norma, una procedura o il corso, lascia strumenti vuoto.',
    '- serve_normativa: metti falso quando la domanda chiede SOLO numeri o stato dei nostri dati ("quanto ha raccolto", "quanti ordini sono aperti", "come e\' andata la quadratura", "chi e\' sotto target"): la risposta sara\' il numero e non serve ne\' cercare online ne\' citare norme. Metti vero quando c\'entra una regola, un obbligo, una scadenza di legge, una sanzione, una procedura del portale o il corso per responsabile tecnico, anche se la domanda chiede anche dei numeri. Nel dubbio metti vero: una risposta normativa senza fonti e\' un danno, un link di troppo su un numero e\' un fastidio.',
    '- Non inventare parametri che non esistono nello strumento.',
    '- tabella_utile: vero se la risposta sara\' un elenco che conviene consegnare anche come file.',
    '',
    'Strumenti disponibili:',
    ...catalogo.map(s => `- ${s.nome}: ${s.descrizione} Parametri: ${JSON.stringify(s.parametri)}. Moduli: ${s.moduli.join(', ')}.`),
    '',
    storia.length ? 'Le ultime domande della conversazione, per capire i riferimenti impliciti:' : '',
    ...storia.slice(-3).map(d => `- ${String(d.domanda || '').slice(0, 200)}`),
    '',
    'Domanda:',
    domanda,
  ].filter(Boolean).join('\n');
}

// ─── la guardia dopo il pianificatore ───

const senzaAccenti = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// La domanda come si confronta: minuscola, senza accenti, la punteggiatura come spazi.
const comeTesto = (s) => ' ' + senzaAccenti(s).toLowerCase().replace(/e-mail/g, 'email').replace(/[^a-z0-9€]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';

// La distanza fra due parole corte, con lo scambio di due lettere vicine: un
// errore di battitura («ordni», «aperit», «chisue») e' una lettera sola.
function distanza(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// Parole vere che a una lettera di distanza somigliano a una radice della mappa:
// «alert» non e' un refuso di «aperti».
// E i verbi: «da ritirare» e «da chiudere» sono ordini aperti, non chiusi.
const NON_REFUSI = new Set(['alert', 'allert', 'avete', 'aperitivo', 'ordinanza', 'ordinario', 'ordinaria', 'termine', 'termini', 'terminale',
  'ritirare', 'ritirarli', 'ritirarlo', 'ritirano', 'chiudere', 'chiude', 'chiudi', 'chiuda', 'chiudono', 'chiuderli', 'terminare', 'terminano']);

/**
 * Vero se la parola comincia con la radice, o le somiglia a meno di una lettera
 * (un errore di battitura). Le radici corte (meno di cinque lettere) valgono
 * solo per intero: con una lettera di tolleranza prenderebbero di tutto.
 */
function somiglia(parola, radice) {
  if (parola.startsWith(radice)) return true;
  if (radice.length < 5 || parola.length < 4 || parola[0] !== radice[0] || NON_REFUSI.has(parola)) return false;
  for (const n of [radice.length - 1, radice.length, radice.length + 1]) {
    if (n > 0 && n <= parola.length && distanza(parola.slice(0, n), radice) <= 1) return true;
  }
  return false;
}

const NOMI_MESI = MESI.map(m => m.toLowerCase());
const REGIONI = ['Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche', 'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', "Valle d'Aosta", 'Veneto'];
// Parole che chiudono un nome scritto nella domanda («verso Irigom a settembre»).
const FINE_NOME = new Set(['da', 'dal', 'dalla', 'dallo', 'dai', 'a', 'al', 'alla', 'ad', 'in', 'nel', 'nella', 'nei', 'di', 'del', 'della', 'dei', 'per', 'questo', 'questa', 'quest', 'mese', 'settimana', 'anno', 'oggi', 'e', 'ed', 'con', 'che', 'fino', 'tra', 'fra', 'sulla', 'sul', 'su', 'negli', 'ultimo', 'ultimi', 'scorso', 'quanto', 'quanti', 'quante', 'quando', 'come', 'nell', 'ci', 'sono', 'ha', 'hanno', 'il', 'lo', 'la', 'le', 'gli', 'i', 'piu', 'meno', 'almeno', 'ritirare', 'evadere', 'fare', 'chiudere', 'programmare', 'aperte', 'aperti', 'chiuse', 'chiusi', ...NOMI_MESI]);
// Parole che dopo «fatturato» non sono il nome di un fornitore.
const NON_FORNITORI = new Set(['attiva', 'passiva', 'totale', 'complessivo', 'complessiva', 'mensile', 'fornitori', 'fornitore', 'ecotyre', 'consorzio', 'smoco', 'rete', 'aci', 'extra']);
// Province che sono anche parole comuni: si prendono solo dopo «provincia di».
const PROVINCE_AMBIGUE = new Set(['fermo', 'prato', 'massa', 'lodi', 'carrara']);
// Sigle che scritte maiuscole sono anche parole («LE», «NO», «SI»).
const SIGLE_AMBIGUE = new Set(['LE', 'NO', 'SI', 'CE', 'TE', 'AL', 'IN', 'DI']);

// Un nome scritto dopo una parola chiave: fino a tre parole, fino alla prima parola che lo chiude.
function nomeDopo(parole, i) {
  const nome = [];
  for (let j = i; j < parole.length && nome.length < 3; j++) {
    const p = parole[j];
    if (!p || FINE_NOME.has(p) || /^\d/.test(p)) break;
    nome.push(p);
  }
  return nome.join(' ');
}

/**
 * DI CHE COSA PARLA LA DOMANDA, letto senza modello (14/10/2026). Serve alla
 * guardia per riconoscere gli errori evidenti del piano e per riempire i filtri
 * che la domanda dice e il piano ha dimenticato. Tollera gli errori di
 * battitura delle parole chiave (una lettera). oggi serve a «questo mese».
 *
 * Restituisce: email, ordini, aperti, chiusi, secondarie, terziarie,
 * predittivita, fatturato, tipo_fatturazione, contratto, raccoglitori, cancellati, canale
 * ('RETE', 'ACI', 'EXTRA_RACCOLTA' o '' se nessuno, piu' d'uno, negato o
 * aggiunto agli altri), canali_esclusi, provincia, regione, pdr, id,
 * destinazione, origine, fornitore, mesi, anno, periodo (se ne nomina uno),
 * chiede_dati.
 */
export function temaDellaDomanda(domanda, oggi = '') {
  const t = comeTesto(domanda);
  const parole = t.trim().split(' ').filter(Boolean);
  const c = (re) => re.test(t);
  const una = (radici) => parole.some(p => radici.some(r => somiglia(p, r)));

  const negazioneChiusi = c(/ non (?:ancora |sono |e |sia |stat[aoie] |state |stati )*(?:chius|ritirat|evas|terminat|fatt|complet)/);
  let aperti = una(['apert', 'assegnat']) || c(/ da (?:ritirare|evadere|fare|chiudere|prendere) /) || c(/ in (?:attesa|sospeso|coda) /)
    || c(/ (?:arretrat\w*|backlog|pendent\w*|inevas\w*) /) || negazioneChiusi;
  // «Quanti ordini ha fatto Emmesse a settembre?», «quante richieste abbiamo
  // servito a Bari nel 2025?», «quanti ordini ha gestito Green Tyre?»: un ordine
  // fatto, gestito o servito e' un ordine chiuso (revisione del 14/10/2026: senza
  // queste parole la guardia li prendeva per aperti e toglieva ordini_chiusi
  // scelto bene dal pianificatore). Il participio vale dopo un ausiliare o
  // subito dopo ordini, richieste e ritiri: «il fatto che» non e' un ordine.
  const fatti = c(/ (?:ha|hanno|abbiamo|avete|ho|hai|e|sono|sia|siano|stat[aoie]|stati|state) (?:gia |piu |tutti |tutte )?(?:fatt|gestit|servit|svolt)[oaie] /)
    || c(/ (?:ordin|richiest|ritir)\w* (?:gia )?(?:fatt|gestit|servit|svolt)[oaie] /);
  let chiusi = una(['chius', 'terminat', 'ritirat']) || c(/ (?:evas[aoie]|completat[aoie]|conclus[aoie]|effettuat[aoie]) /)
    || c(/ ultim[aoie] (?:ritir|ordin|richiest)/) || c(/ ritiri /) || c(/ quando .*(?:chius|ritir|evas|terminat|fatt)/) || fatti;
  if (negazioneChiusi) chiusi = false;
  const ordini = una(['ordin', 'richiest', 'ritir', 'assegnat', 'terminat']) || c(/ (?:evas[aoie]|backlog|arretrat\w*|prelievi|prelievo) /);
  const richieste = una(['richiest']);
  const email = c(/ (?:email|mail|posta|pec|inbox|casella) /) || c(/ ect /) || c(/ to ?do /)
    || (richieste && (c(/ (?:arrivat|ricevut|pervenut|inviat|scadut)\w* /)));
  const secondarie = una(['secondar']);
  const terziarie = una(['terziar']);
  const predittivita = c(/ (?:predittiv\w*|proiezion\w*|programm\w*|plafond|priorita|mercoledi|target) /);
  const tariffe = c(/ (?:tariff\w*|prezz\w*|listino) /) || c(/ (?:euro|€) (?:a|al|per) (?:t|tonnellata) /);
  const fatturato = !tariffe && (una(['fattur']) || c(/ (?:incass\w*|ricav\w*|passiva|attiva) /)
    || c(/ quanto (?:gli |le |ci )?(?:abbiamo pagato|abbiamo dato|dobbiamo pagare|dobbiamo dare|dobbiamo a|dobbiamo al|dobbiamo alla|paghiamo|spetta|deve|devono) /)
    || c(/ cost[oi] (?:di|del|della|dei|delle|dello) /));
  const tipo_fatturazione = c(/ (?:ecotyre|consorzio|ricav\w*|incass\w*|attiva) /) || c(/ ci (?:spetta|deve) /) ? 'ATTIVA' : 'PASSIVA';
  const contratto = !c(/ (?:fornitor\w*|subfornitor\w*|qualifica) /)
    && ((c(/ contratt\w* /) && c(/ (?:ecotyre|commessa|consorzio|target|atteso|annuo) /)) || c(/ atteso /) || c(/ target annuo /));
  const raccoglitori = c(/ (?:raccoglitor\w*|sotto target|chi e) /);
  // IL CANALE DETTO DALLA DOMANDA (revisione del 14/10/2026). Vale solo se la
  // domanda ne nomina UNO, in positivo e da solo: «extra raccolta esclusa» o
  // «esclusi i demolitori» lo tolgono, «ACI compresa», «compresi quelli dei
  // demolitori» e «in tutto» lo aggiungono agli altri, e in nessuno dei due casi
  // la guardia deve ridurre il piano a quel canale. E « aci » davanti a
  // Sant'Antonio, Catena, Castello, Bonaccorsi e alle frazioni di Acireale e' un
  // comune della provincia di Catania, coi punti di raccolta della rete: non e'
  // il canale ACI.
  const PAROLE_CANALE = {
    RETE: '(?:rete|gommist\\w*)',
    ACI: '(?:aci(?! (?:sant|s|san|santa|catena|castello|bonaccorsi|trezza|platani) )|autodemol\\w*|demolit\\w*|demoliz\\w*|rottamat\\w*|sfasciacarrozz\\w*)',
    EXTRA_RACCOLTA: '(?:extra ?raccolt\\w*)',
  };
  const nominati = {
    RETE: c(/ rete /) || una(['gommist']),
    ACI: c(/ aci (?!(?:sant|s|san|santa|catena|castello|bonaccorsi|trezza|platani) )/) || una(['autodemol', 'demolit', 'demoliz', 'rottamat', 'sfasciacarrozz']),
    EXTRA_RACCOLTA: c(/ extra ?raccolt/),
  };
  const tolto = (k) => new RegExp(` (?:esclu\\w*|eccett\\w*|tranne|salvo|meno) (?:\\w+ ){0,2}${PAROLE_CANALE[k]} | senza (?:\\w+ )?${PAROLE_CANALE[k]} | ${PAROLE_CANALE[k]} (?:\\w+ )?(?:esclu\\w*|eccettuat\\w*|a parte) `).test(t);
  // «Oltre a» aggiunge, «da oltre 60 giorni» no.
  const aggiunto = (k) => new RegExp(` (?:compres\\w*|inclus\\w*) (?:\\w+ ){0,3}${PAROLE_CANALE[k]} | (?:anche|oltre (?:a|ad|al|alla|ai|agli|all)) (?:\\w+ ){0,2}${PAROLE_CANALE[k]} | ${PAROLE_CANALE[k]} (?:\\w+ )?(?:compres\\w*|inclus\\w*) `).test(t);
  const canaliDetti = CANALI.filter(k => nominati[k] && !tolto(k));
  const canali_esclusi = CANALI.filter(k => nominati[k] && tolto(k));
  const tuttiICanali = c(/ (?:in tutto|complessiv\w*|tutti e tre|tutti i canali|totale generale|tutte le commesse) /);
  const canale = canaliDetti.length === 1 && !aggiunto(canaliDetti[0]) && !tuttiICanali ? canaliDetti[0] : '';

  // La provincia: un nome (anche di due o tre parole) o una sigla scritta
  // maiuscola. Le province che sono anche parole comuni solo dopo «provincia di».
  let provincia = '';
  const originale = senzaAccenti(domanda);
  for (let i = 0; i < parole.length && !provincia; i++) {
    for (const n of [3, 2, 1]) {
      const pezzo = parole.slice(i, i + n).join(' ');
      if (n === 1 && (FINE_NOME.has(pezzo) || pezzo.length < 3)) continue;
      if (n === 1 && PROVINCE_AMBIGUE.has(pezzo) && !(parole[i - 1] === 'di' && /provincia|prov/.test(parole[i - 2] || ''))) continue;
      const p = provinciaChiesta(pezzo);
      if (p && p.come === 'nome') { provincia = p.nome; break; }
    }
  }
  if (!provincia) {
    // UNA SIGLA DENTRO UN NOME NON E' UNA PROVINCIA (revisione del 14/10/2026):
    // «CL Service» e' C.L. SERVICE S.R.L., un raccoglitore della rete, non
    // Caltanissetta; «BS ECOSERVIZI» non e' Brescia. La sigla vale solo da sola:
    // non attaccata a un'altra parola scritta con la maiuscola (la prima parola
    // della frase non conta, ha la maiuscola per forza).
    // Non sono parti di un nome le parole del gestionale scritte maiuscole
    // («ordini aperti ACI BA») e un'altra sigla («SR CT»).
    const pezzi = originale.split(/[^A-Za-z0-9']+/).filter(Boolean);
    const DEL_GESTIONALE = new Set(['ACI', 'RETE', 'PDR', 'ECT', 'FIR', 'PFU', 'ID', 'SMOCO', 'ECOTYRE']);
    const maiuscola = (j) => j >= 0 && j < pezzi.length && /^[A-Z]/.test(pezzi[j]) && !(j === 0 && /^[A-Z][a-z]/.test(pezzi[j]))
      && !DEL_GESTIONALE.has(pezzi[j].toUpperCase()) && !(/^[A-Z]{2}$/.test(pezzi[j]) && (provinciaChiesta(pezzi[j]) || {}).come === 'sigla');
    const sigla = pezzi.find((s, j) => /^[A-Z]{2}$/.test(s) && !SIGLE_AMBIGUE.has(s) && (provinciaChiesta(s) || {}).come === 'sigla'
      && !maiuscola(j - 1) && !maiuscola(j + 1));
    if (sigla) provincia = sigla;
  }
  const regione = REGIONI.find(r => t.includes(` ${comeTesto(r).trim()} `)) || '';
  const pdrM = t.match(/ (?:pdr|p d r|punto di raccolta) (?:(?:n|nr|num|numero|cod|codice) )?(\d{2,6}) /);
  const idM = t.match(/ (et\d{6,}|ter\d{5,}|[a-z]{5}\d{6}[a-z]{2}) /);
  // «verso Irigom»: la destinazione; «da Nappi Sud»: l'origine (non «da luglio»).
  let destinazione = '';
  let origine = '';
  let fornitore = '';
  parole.forEach((p, i) => {
    if (!destinazione && (p === 'verso' || ((p === 'destinate' || p === 'destinati' || p === 'dirette' || p === 'diretti') && parole[i + 1] === 'a'))) {
      destinazione = nomeDopo(parole, p === 'verso' ? i + 1 : i + 2);
    }
    if (!origine && (secondarie || terziarie) && (p === 'da' || p === 'dallo' || p === 'dall') && !NOMI_MESI.includes(parole[i + 1] || '')) {
      origine = nomeDopo(parole, i + 1);
    }
    if (!fornitore && fatturato) {
      if (somiglia(p, 'fattur') && !['ecotyre', 'consorzio'].includes(parole[i + 1] || '')) {
        const salta = ['di', 'del', 'della', 'dello', 'da', 'a', 'al', 'alla', 'ad'].includes(parole[i + 1] || '') ? 2 : 1;
        fornitore = nomeDopo(parole, i + salta);
      } else if ((p === 'pagato' || p === 'pagare' || p === 'paghiamo' || p === 'dobbiamo') && ['a', 'al', 'alla', 'ad'].includes(parole[i + 1] || '')) {
        fornitore = nomeDopo(parole, i + 2);
      } else if ((p === 'costo' || p === 'costi') && ['di', 'del', 'della', 'dello', 'dei'].includes(parole[i + 1] || '')) {
        fornitore = nomeDopo(parole, i + 2);
      }
    }
  });
  if (NON_FORNITORI.has(fornitore.split(' ')[0])) fornitore = '';

  // I mesi: un intervallo («da luglio a settembre», «tra luglio e settembre»,
  // «luglio-settembre», «dal 1 luglio al 30 settembre»), un intervallo fino a
  // oggi («da luglio a oggi», «da luglio in poi»), un elenco («luglio e
  // settembre» sono due mesi, non tre), o «questo mese» e «il mese scorso».
  // Revisione del 14/10/2026: «da luglio a oggi» diventava il solo luglio,
  // «luglio-settembre» e «dal 1 luglio al 30 settembre» luglio e settembre senza
  // agosto. Il filtro va per mese intero: i giorni di un intervallo non contano.
  const meseOggi = Number(String(oggi).slice(5, 7)) - 1;
  const annoM = t.match(/ (20\d\d) /);
  const annoOggi = Number(String(oggi).slice(0, 4));
  const M = `(${NOMI_MESI.join('|')})`;
  const giorno = '(?:(?:il |l )?(?:\\d{1,2}|primo) )?';
  let mesi = [];
  const da = (i) => NOMI_MESI.indexOf(i);
  const intervallo = t.match(new RegExp(` (?:da|dal|dall|tra|fra) ${giorno}(?:mese di )?${M}(?: 20\\d\\d)? (?:a|al|ad|e|fino a|fino al|fino ad|sino a|sino al) ${giorno}(?:mese di )?${M} `))
    || senzaAccenti(domanda).toLowerCase().match(new RegExp(`\\b${M}\\s*[-–—/]\\s*${M}\\b`));
  if (intervallo && da(intervallo[1]) <= da(intervallo[2])) mesi = MESI.slice(da(intervallo[1]), da(intervallo[2]) + 1);
  // Fino a oggi: solo nell'anno in corso, e solo se il mese non e' ancora da
  // venire. «Da luglio 2025 a oggi» scavalca l'anno e coi mesi di un anno solo
  // non si dice: allora nessun mese, e il periodo resta quello del piano.
  const finoAOggi = !mesi.length && t.match(new RegExp(` (?:da|dal|dall|a partire da|a partire dal) ${giorno}(?:mese di )?${M}(?: (20\\d\\d))? (?:(?:a|ad|al|fino a|fino ad|fino al|sino a) (?:oggi|adesso|ora|questo mese|ieri)|in poi|ad oggi) `));
  const nellAnno = finoAOggi && (!finoAOggi[2] || Number(finoAOggi[2]) === annoOggi) && (!annoM || Number(annoM[1]) === annoOggi);
  if (nellAnno && meseOggi >= 0 && da(finoAOggi[1]) <= meseOggi) mesi = MESI.slice(da(finoAOggi[1]), meseOggi + 1);
  if (!mesi.length && !finoAOggi) mesi = MESI.filter((_m, i) => parole.includes(NOMI_MESI[i]));
  if (!mesi.length && meseOggi >= 0 && c(/ (?:questo mese|mese in corso) /)) mesi = [MESI[meseOggi]];
  if (!mesi.length && meseOggi >= 0 && c(/ (?:mese scorso|scorso mese) /)) mesi = [MESI[(meseOggi + 11) % 12]];
  // Se la domanda nomina un periodo: un ordine di un periodo e' un ordine chiuso
  // (gli aperti non hanno periodo, sono quelli di adesso).
  const periodo = mesi.length > 0 || !!annoM || c(/ (?:quest anno|nell anno|da inizio anno|dall inizio dell anno|finora|settimana|trimestre|semestre) /);
  // Se chiede dei dati: una domanda («quanti», «quando», «dimmi»...) o una
  // richiesta scritta di corsa, come le scrive l'utente («secondarie aperte
  // verso Irigom»), con uno stato o un filtro. Mai se parla di norme.
  // Le domande di PROCEDURA sono di norma anche senza le sue parole (revisione
  // del 14/10/2026): «entro quanti giorni va chiuso un ordine a portale?»,
  // «quali documenti servono per ritirare da un demolitore?», «quante copie del
  // formulario restano al produttore?», «quale classe va indicata nella
  // richiesta?». Hanno «quanti» e «ordine», ma non chiedono i nostri numeri.
  const norma = c(/ (?:obblig\w*|norma\w*|legge|decreto|articol\w*|sanzion\w*|si puo|devo|posso|bisogna|come si) /)
    || c(/ va(?:nno)? (?:(?:sempre|poi|prima|anche|gia|subito) )?(?!tutt|pagat|fatturat|dat[oaie] )\w+(?:at|ut|it|s|tt)[oaie] /) || c(/ entro quant[aieo] (?:giorni|ore|settimane|mesi) /)
    || c(/ (?:copi[ae]|documenti) (?:del|della|dei|delle|servono|occorrono|vanno|bisogna|si devono) /)
    || c(/ serv(?:e|ono) (?:per|a) (?:ritirare|chiudere|fare|compilare|trasportare|conferire|registrare|emettere|aprire) /)
    || c(/ (?:occorr\w*|si deve|si devono|deve essere|devono essere|chi deve|chi firma|chi compila) /);
  // Una domanda sul concetto («che differenza c'e' fra eseguito e terminato?»)
  // non chiede numeri, anche se parla di ordini chiusi.
  const concetto = c(/ (?:che differenza|cosa vuol dire|cosa significa|che significa|cos e|che cos e|spiegami|perche) /);
  const chiede_dati = !norma && !concetto && (c(/ (?:quant[aieo]|quali|quale|quando|elenc\w*|lista|dimmi|dammi|mostra\w*|ci sono|c e|numero|totale|risult\w*|ancora|ultim[aoie]|hai|abbiamo|ha|hanno) /)
    || !!provincia || !!(pdrM || idM) || !!destinazione || !!origine || mesi.length > 0);
  // Gli ordini cancellati non sono ne' aperti ne' chiusi: nessuno strumento della
  // mappa li conta, e la guardia non li manda fra gli aperti.
  const cancellati = c(/ cancellat\w* /) && !aperti && !chiusi;
  return {
    email, ordini, aperti, chiusi, secondarie, terziarie, predittivita, fatturato, tipo_fatturazione, contratto, raccoglitori, cancellati,
    canale, canali_esclusi, provincia, regione, pdr: pdrM ? pdrM[1] : '', id: idM ? idM[1].toUpperCase() : '', destinazione, origine, fornitore,
    mesi, anno: annoM ? Number(annoM[1]) : null, periodo, chiede_dati,
  };
}

// Come si dice, dopo «al posto», lo strumento che la guardia toglie.
const AL_POSTO = {
  richieste_ect: 'delle Richieste ECT', ordini_aperti: 'degli ordini aperti', ordini_chiusi: 'degli ordini chiusi', raccolto: 'del raccolto',
  panoramica_commessa: 'del riepilogo della commessa', punti_di_raccolta: "dell'anagrafica PDR", report_mensile: 'del Report Mensile',
  target_raccoglitori: 'dei target dei raccoglitori', secondarie: 'delle secondarie', terziarie: 'delle terziarie', tariffe: 'delle tariffe',
  fatturazione: 'della fatturazione', contratto_ecotyre: 'del contratto',
};

/**
 * LA GUARDIA DOPO IL PIANIFICATORE (richiesta dell'utente del 14/10/2026).
 *
 * Il pianificatore e' un modello: sceglie bene quasi sempre, e quando sbaglia
 * sbaglia il modulo, che e' l'errore peggiore perche' la risposta esce sicura e
 * con un numero vero di un'altra cosa. Il caso vero: «quanti ordini aperti ci
 * sono in provincia di Siracusa?» con le Richieste ECT. Qui, senza modello, si
 * riconoscono gli errori EVIDENTI della mappa (MAPPA_DOMANDE) e si correggono:
 *   - le Richieste ECT senza che la domanda parli di email: al loro posto gli
 *     ordini aperti, i chiusi, le secondarie, le terziarie o, con un ID ordine,
 *     la ricerca del movimento;
 *   - una domanda sulle richieste arrivate via email senza le Richieste ECT;
 *   - ordini aperti, ordini chiusi, secondarie, terziarie, fatturato di un
 *     fornitore e contratto chiesti, e al loro posto uno strumento che non li
 *     legge (il raccolto, il riepilogo, l'anagrafica PDR, i target dei
 *     raccoglitori...);
 *   - il canale degli ordini sbagliato quando la domanda lo dice (demolitori =
 *     ACI).
 * Uno strumento legittimo scelto in piu' (il Report Mensile per le secondarie,
 * la predittivita') non si tocca: la guardia corregge, non ripianifica. I filtri
 * che la domanda dice e il piano ha dimenticato (provincia, PDR, mesi, verso
 * quale impianto, quale fornitore) si aggiungono agli strumenti della mappa.
 *
 * Quello che NON e' un errore evidente resta del pianificatore (revisione del
 * 14/10/2026): fra ordini aperti e chiusi la guardia sceglie solo se la domanda
 * lo dice a parole; un canale lo impone solo se la domanda ne nomina uno, in
 * positivo e da solo, e il piano ne aveva uno diverso; una domanda di norma o di
 * procedura col piano vuoto resta senza strumenti.
 *
 * Restituisce { piano, correzioni }: il piano corretto (una copia) e che cosa si
 * e' cambiato. Ogni strumento messo o corretto dalla guardia porta in corretto
 * il perche', che arriva a «Dove ho guardato» (CHIAVE_SCELTA); anche i filtri
 * presi dalla domanda, che cambiano il numero, si dicono li'.
 */
export function correggiPiano(piano, catalogo, domanda = '', oggi = '') {
  if (!piano || !Array.isArray(piano.strumenti)) return { piano, correzioni: [] };
  const tema = temaDellaDomanda(domanda, oggi);
  const accetta = new Map((catalogo || []).map(s => [s.nome, new Set(Object.keys(s.parametri || {}))]));
  const nomeDi = (x) => String((x && x.nome) || '').trim();
  let strumenti = piano.strumenti.filter(Boolean).map(x => ({ ...x, parametri: { ...((x && x.parametri) || {}) } }));
  const correzioni = [];
  const ha = (n) => strumenti.some(x => nomeDi(x) === n);
  // Un piano senza nessuno strumento vero: vuoto, o solo con nomi inventati.
  const senzaStrumenti = () => !strumenti.some(x => accetta.has(nomeDi(x)));

  // Mette lo strumento giusto al posto degli sbagliati, coi filtri del piano che
  // conosce (anche scritti col nome vicino); forza vale sopra quelli del piano.
  const metti = (giusto, sbagliati, perche, forza = {}) => {
    if (!accetta.has(giusto) || ha(giusto)) return;
    const tolti = strumenti.filter(x => sbagliati.includes(nomeDi(x)));
    strumenti = strumenti.filter(x => !sbagliati.includes(nomeDi(x)));
    const ok = accetta.get(giusto);
    const ereditati = {};
    for (const x of tolti) {
      for (const [k, v] of Object.entries(x.parametri || {})) {
        if (v === null || v === undefined || v === '') continue;
        // Lo stato non passa da uno strumento all'altro: «aperta» di una
        // richiesta ECT non e' «aperte» o «chiuse» di una secondaria. Lo dice la
        // domanda, piu' sotto.
        if (k === 'stato') continue;
        // Un filtro che lo strumento giusto non conosce resta col suo nome: se il
        // suo valore e' nella domanda, strumentiDalPiano lo dice fra i filtri
        // ignorati («non filtrato per ...») invece di perderlo in silenzio.
        const chiave = ok.has(k) ? k : ((SINONIMI_PARAMETRI[k] || []).find(a => ok.has(a)) || k);
        if (ereditati[chiave] === undefined) ereditati[chiave] = v;
      }
    }
    const daTogliere = [...new Set(tolti.map(nomeDi))];
    const testo = daTogliere.length ? `scelto al posto ${daTogliere.map(n => AL_POSTO[n] || n).join(' e ')}: ${perche}` : `aggiunto: ${perche}`;
    strumenti.unshift({ nome: giusto, parametri: { ...ereditati, ...forza }, perche: testo, corretto: testo });
    correzioni.push({ da: daTogliere, a: giusto, perche });
  };
  // Lo strumento giusto entra se al suo posto c'e' uno sbagliato, o se il piano
  // non ha niente e la domanda chiede dei dati. Un piano vuoto con la norma
  // dichiarata (serve_normativa vero) e' il pianificatore che ha riconosciuto
  // una domanda di norma o di procedura, come la regola gli chiede: non e' un
  // errore evidente, e aggiungerci uno strumento voleva dire leggere migliaia di
  // righe e dire al modello «rispondi con questi dati» su «entro quanti giorni
  // va chiuso un ordine?» (revisione del 14/10/2026).
  const pianoDiNorma = piano.serve_normativa === true;
  const serve = (sbagliati) => strumenti.some(x => sbagliati.includes(nomeDi(x))) || (senzaStrumenti() && tema.chiede_dati && !pianoDiNorma);

  const ORDINI = 'la domanda parla di ordini, non di richieste arrivate via email';
  if (tema.id) {
    // Un ID ordine o un formulario: lo cerca cerca_movimento, anche fra gli aperti.
    if (!tema.email && ha('richieste_ect')) metti('cerca_movimento', ['richieste_ect'], 'la domanda cita un ordine o un formulario, che si cerca negli archivi, Assegnati compresi', { testo: tema.id });
  } else if (tema.email) {
    const sbagliati = ['ordini_aperti', 'ordini_chiusi', 'panoramica_commessa', 'raccolto'];
    if (!ha('richieste_ect') && serve(sbagliati)) metti('richieste_ect', sbagliati, 'la domanda parla di richieste arrivate via email, che stanno nelle Richieste ECT');
  } else {
    const diMovimenti = tema.ordini || tema.secondarie || tema.terziarie;
    if ((tema.secondarie || tema.terziarie) && !tema.predittivita) {
      const daMettere = ['secondarie', 'terziarie'].filter(x => tema[x]).map((q) => {
        const altro = q === 'secondarie' ? 'terziarie' : 'secondarie';
        const sbagliati = ['richieste_ect', 'ordini_aperti', 'ordini_chiusi', 'raccolto', 'panoramica_commessa', 'punti_di_raccolta', ...(tema[altro] ? [] : [altro])];
        // Anche qui si decide prima: con «secondarie e terziarie» il primo toglie lo sbagliato.
        return { q, sbagliati, serve: serve(sbagliati) };
      });
      for (const { q, sbagliati, serve: va } of daMettere) {
        if (va) metti(q, sbagliati, `la domanda parla di ${q}, che stanno nel modulo ${q === 'secondarie' ? 'Secondarie' : 'Terziarie'}`);
      }
    } else if (tema.ordini && !tema.secondarie && !tema.terziarie && !tema.cancellati) {
      // APERTI O CHIUSI (revisione del 14/10/2026). Se la domanda lo dice a
      // parole (aperti, da ritirare, in attesa; chiusi, ritirati, terminati,
      // fatti, gestiti, serviti) vale quello, anche sopra il pianificatore. Se
      // non lo dice, la sua scelta fra ordini_aperti e ordini_chiusi resta: prima
      // qui un ordine senza «chiuso» diventava aperto, e «quanti ordini ha fatto
      // Emmesse a settembre?» perdeva i 15 chiusi per gli aperti di adesso. Solo
      // quando al loro posto c'e' uno strumento sbagliato si sceglie dalla
      // domanda: con un periodo sono i chiusi, senza («quanti ordini ci sono a
      // Siracusa?») gli aperti, che non hanno periodo.
      const detto = tema.aperti || tema.chiusi;
      const giaScelto = ha('ordini_aperti') || ha('ordini_chiusi');
      const aperti = detto ? tema.aperti : !giaScelto && !tema.periodo;
      const chiusi = detto ? tema.chiusi : !giaScelto && tema.periodo;
      const perAperti = ['richieste_ect', 'raccolto', 'panoramica_commessa', 'punti_di_raccolta', 'report_mensile', ...(tema.aperti && !tema.chiusi ? ['ordini_chiusi'] : [])];
      const perChiusi = ['richieste_ect', 'raccolto', 'panoramica_commessa', 'punti_di_raccolta', ...(tema.chiusi && !tema.aperti ? ['ordini_aperti'] : [])];
      // Si decide prima di toccare il piano: con «aperti e chiusi» il primo
      // strumento messo toglie lo sbagliato, e il secondo non lo troverebbe piu'.
      const correggiAperti = aperti && serve(perAperti);
      const correggiChiusi = chiusi && serve(perChiusi);
      if (correggiAperti) metti('ordini_aperti', perAperti, `${ORDINI}; gli ordini aperti sono gli Assegnati`);
      if (correggiChiusi) metti('ordini_chiusi', perChiusi, `${ORDINI}; gli ordini chiusi sono i Terminati, sul giorno di fine trasporto`);
    }
    // Le Richieste ECT rimaste accanto agli strumenti giusti, senza email: via.
    // Solo se resta altro da guardare: un piano vuoto non risponde meglio.
    if (diMovimenti && ha('richieste_ect') && strumenti.some(x => accetta.has(nomeDi(x)) && nomeDi(x) !== 'richieste_ect')) {
      strumenti = strumenti.filter(x => nomeDi(x) !== 'richieste_ect');
      correzioni.push({ da: ['richieste_ect'], a: '', perche: ORDINI });
    }
    if (tema.fatturato && !ha('fatturazione')) {
      const sbagliati = ['richieste_ect', 'ordini_aperti', 'ordini_chiusi', 'panoramica_commessa', 'punti_di_raccolta', 'tariffe', ...(/ raccolt/.test(comeTesto(domanda)) ? [] : ['raccolto'])];
      if (serve(sbagliati)) metti('fatturazione', sbagliati, tema.tipo_fatturazione === 'ATTIVA' ? 'la domanda chiede quanto ci spetta da Ecotyre, cioe\' la fatturazione attiva' : 'la domanda chiede il fatturato di un fornitore, cioe\' la fatturazione passiva', { tipo: tema.tipo_fatturazione });
    }
    if (tema.contratto && !ha('contratto_ecotyre')) {
      const sbagliati = ['panoramica_commessa', ...(tema.raccoglitori ? [] : ['target_raccoglitori'])];
      if (serve(sbagliati)) metti('contratto_ecotyre', sbagliati, 'la domanda parla del contratto Ecotyre, e la somma dei target dei raccoglitori non e\' il contratto');
    }
  }

  // I FILTRI PRESI DALLA DOMANDA, strumento per strumento: cambiano il numero, e
  // si dicono in «Dove ho guardato» come le correzioni (revisione del 14/10/2026:
  // prima si aggiungevano in silenzio).
  const presi = new Map();
  const prendi = (x, k, v) => { if (!presi.has(x)) presi.set(x, []); presi.get(x).push([k, v]); };

  // IL CANALE DEGLI ORDINI. «Ordini aperti degli autodemolitori» sono gli
  // Assegnati ACI: un canale RETE scritto dal piano e' un errore evidente. Ma
  // solo quello (revisione del 14/10/2026): la domanda deve nominare UN canale,
  // in positivo e da solo (tema.canale: non «esclusa l'extra raccolta», non «ACI
  // compresa», non il comune di Aci Sant'Antonio), e il piano deve averne uno
  // diverso. Un piano con piu' canali, fra cui quello detto, resta com'e'; uno
  // strumento gia' sul canale detto non si raddoppia cambiando il suo gemello; un
  // piano senza canale lo prende dalla domanda.
  const canaliPiano = Array.isArray(piano.canali) ? [...new Set(piano.canali.map(c => String(c).toUpperCase().trim()).filter(c => CANALI.includes(c)))] : [];
  const canaleScritto = (x) => { const s = String((x.parametri || {}).canale || '').toUpperCase().trim(); return CANALI.includes(s) ? s : ''; };
  for (const x of strumenti) {
    const n = nomeDi(x);
    if (!['ordini_aperti', 'ordini_chiusi', 'raccolto', 'secondarie'].includes(n) || !tema.canale) continue;
    if (n === 'secondarie' && tema.canale === 'EXTRA_RACCOLTA') continue;
    const scritto = canaleScritto(x);
    const delPiano = scritto ? [scritto] : canaliPiano;
    if (delPiano.includes(tema.canale)) {
      // Il canale detto c'e' gia'. Con un canale solo lo si scrive; con piu'
      // canali (scelti dal pianificatore) si lascia l'espansione a strumentiDalPiano.
      if (!scritto && delPiano.length === 1) x.parametri.canale = tema.canale;
      continue;
    }
    // Un gemello gia' sul canale detto: questo, che ne ha un altro scelto dal
    // pianificatore, resta. Uno senza canale prende quello detto, e la chiamata
    // doppia la toglie strumentiDalPiano.
    if (delPiano.length && strumenti.some(y => y !== x && nomeDi(y) === n && canaleScritto(y) === tema.canale)) continue;
    x.parametri.canale = tema.canale;
    if (delPiano.length) {
      const perche = `il canale e' ${tema.canale}: la domanda parla di ${tema.canale === 'ACI' ? 'demolitori e autodemolizioni' : tema.canale === 'EXTRA_RACCOLTA' ? 'extra raccolta' : 'rete'}`;
      x.corretto = x.corretto ? `${x.corretto}; ${perche}` : perche;
      correzioni.push({ da: [n], a: n, perche });
    } else {
      prendi(x, 'canale', tema.canale);
    }
  }

  // I FILTRI CHE LA DOMANDA DICE E IL PIANO HA DIMENTICATO, sugli strumenti
  // della mappa: si aggiungono, non si cambiano (quello scritto dal piano vale).
  const periodo = piano.periodo || {};
  const conPeriodo = !!(periodo.mese || (Array.isArray(periodo.mesi) && periodo.mesi.length));
  const riempi = (x, k, v) => {
    const ok = accetta.get(nomeDi(x));
    if (!ok || !ok.has(k) || v === '' || v === null || v === undefined) return;
    const scritto = x.parametri[k];
    if (scritto === undefined || scritto === null || scritto === '' || (Array.isArray(scritto) && !scritto.length)) {
      x.parametri[k] = v;
      prendi(x, k, v);
    }
  };
  // La provincia letta nella domanda non si aggiunge se e' una parola del nome
  // gia' scritto dal piano: «CL Service» e' un raccoglitore, «Ecologia Bari» un
  // fornitore, e la loro provincia non e' un filtro chiesto (revisione del
  // 14/10/2026: 82 ordini chiusi di C.L. SERVICE diventavano zero a Caltanissetta).
  const NOMI_NEL_PIANO = ['raccoglitore', 'fornitore', 'trasportatore', 'soggetto', 'produttore', 'comune', 'pdr', 'destinazione', 'origine', 'sito', 'cerca', 'testo'];
  const nelNome = (x, v) => {
    const parola = comeTesto(v);
    return parola.trim().length > 0 && NOMI_NEL_PIANO.some(k => x.parametri[k] && comeTesto(x.parametri[k]).includes(parola));
  };
  for (const x of strumenti) {
    const n = nomeDi(x);
    if (['ordini_aperti', 'ordini_chiusi'].includes(n) && !nelNome(x, tema.provincia)) riempi(x, 'provincia', tema.provincia);
    if (['ordini_aperti', 'ordini_chiusi', 'raccolto'].includes(n)) riempi(x, 'pdr', tema.pdr);
    if (['ordini_chiusi', 'secondarie', 'terziarie', 'fatturazione'].includes(n) && !conPeriodo && tema.mesi.length) {
      if (tema.mesi.length === 1) riempi(x, 'mese', tema.mesi[0]);
      else riempi(x, 'mesi', tema.mesi);
    }
    if (['ordini_chiusi', 'secondarie', 'terziarie', 'fatturazione'].includes(n) && !periodo.anno) riempi(x, 'anno', tema.anno);
    if (['secondarie', 'terziarie'].includes(n)) {
      riempi(x, 'stato', tema.aperti && !tema.chiusi ? 'aperte' : tema.chiusi && !tema.aperti ? 'chiuse' : '');
      riempi(x, 'destinazione', tema.destinazione);
      riempi(x, 'origine', tema.origine);
    }
    if (n === 'fatturazione') {
      // Il tipo sbagliato e' un errore evidente quando la domanda lo dice: il
      // fatturato di un fornitore nominato e' la passiva, quanto ci spetta da
      // Ecotyre senza un fornitore e' l'attiva.
      const tipo = String(x.parametri.tipo || '').toUpperCase().trim();
      const giusto = tema.fatturato && ((tema.tipo_fatturazione === 'PASSIVA' && tema.fornitore) || (tema.tipo_fatturazione === 'ATTIVA' && !x.parametri.fornitore)) ? tema.tipo_fatturazione : '';
      if (giusto && tipo && tipo !== giusto) {
        const perche = giusto === 'PASSIVA' ? 'la domanda chiede il fatturato di un fornitore, cioe\' la passiva' : 'la domanda chiede quanto ci spetta da Ecotyre, cioe\' l\'attiva';
        x.parametri.tipo = giusto;
        x.corretto = x.corretto ? `${x.corretto}; ${perche}` : perche;
        correzioni.push({ da: [n], a: n, perche });
      }
      riempi(x, 'tipo', tema.fatturato ? tema.tipo_fatturazione : '');
      if (tema.tipo_fatturazione === 'PASSIVA') riempi(x, 'fornitore', tema.fornitore);
    }
    if (n === 'contratto_ecotyre') riempi(x, 'regione', tema.regione);
  }
  // Che cosa si e' preso dalla domanda, accanto al perche' della guardia: «filtri
  // presi dalla domanda: provincia CS, mesi Luglio, Agosto, Settembre».
  for (const [x, coppie] of presi) {
    const testo = `${coppie.length === 1 ? 'filtro preso' : 'filtri presi'} dalla domanda: ${coppie.map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(', ') : v}`).join('; ')}`;
    x.corretto = x.corretto ? `${x.corretto}; ${testo}` : testo;
    correzioni.push({ da: [nomeDi(x)], a: nomeDi(x), perche: testo, filtri: coppie });
  }
  return { piano: { ...piano, strumenti }, correzioni };
}

/**
 * Quali strumenti eseguire davvero, a partire dal piano.
 *
 * Due cose il modello se le dimentica quasi sempre, e sono proprio quelle che
 * fanno sbagliare il numero: il periodo che ha appena deciso non lo riporta nei
 * parametri, e quando i canali sono piu' d'uno chiede una cosa sola. Qui il
 * periodo si travasa in ogni strumento che lo accetta e i canali diventano una
 * chiamata ciascuno, cosi' restano separati anche nei dati, non solo a parole.
 */
export function strumentiDalPiano(pianoScelto, catalogo, oggi, domanda = '') {
  // LA GUARDIA (14/10/2026): prima di eseguire, gli errori evidenti della mappa
  // delle domande si correggono (correggiPiano qui sopra). Un piano non riuscito
  // (null) resta com'e': chi chiama ripiega sul riepilogo e lo dice.
  const { piano, correzioni } = correggiPiano(pianoScelto, catalogo, domanda, oggi);
  const annoOggi = Number(String(oggi).slice(0, 4));
  const accetta = new Map(catalogo.map(s => [s.nome, new Set(Object.keys(s.parametri || {}))]));
  // I filtri che uno strumento fa gia' da se' (impliciti nel catalogo): il raccolto
  // e' sempre raccolta, le giacenze escono gia' per canale, target e predittivita'
  // sono solo della rete. Scritti come parametri non sono filtri ignorati.
  const impliciti = new Map(catalogo.map(s => [s.nome, s.impliciti || {}]));
  const per = (piano && piano.periodo) || {};
  let canali = Array.isArray(piano && piano.canali) ? [...new Set(piano.canali.filter(c => CANALI.includes(c)))] : [];
  // "Quanto abbiamo raccolto in tutto?" vuole tutti e tre i canali, ciascuno per
  // conto suo. Il pianificatore ogni tanto ne mette uno solo e la risposta dice
  // che gli altri due non ci sono: allora li si aggiunge qui, a meno che la
  // domanda non nomini proprio un canale.
  const t = ' ' + String(domanda || '').toLowerCase() + ' ';
  const chiedeTutto = /(in tutto|complessiv|tutti e tre|tutti i canali|totale generale|tutte le commesse)/.test(t);
  const nominaCanale = /(\brete\b|\baci\b|autodemoliz|extra raccolta)/.test(t);
  if (chiedeTutto && !nominaCanale) canali = [...CANALI];
  // Se la domanda parla dell'anno, il mese non deve entrarci. Il pianificatore
  // ci mette il mese in corso per abitudine, e la risposta finisce per dare
  // settembre a chi aveva chiesto l'anno.
  const chiedeAnno = /(quest'? ?anno|nell'anno|dell'anno|annual|da inizio anno|dall'inizio dell'anno|finora|fino a oggi|a oggi|year to date|ytd)/.test(t);
  const nominaMese = /(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|questo mese|mese scorso|il mese)/.test(t);
  // «Da gennaio a oggi» nomina un mese ma chiede l'anno fino a oggi (visto in
  // produzione il 10/10/2026: alla passiva di Green Tyre «da gennaio a oggi» il
  // pianificatore metteva ottobre, e la risposta era un mese solo).
  const daInizioAnno = /\bdal?\s+(?:1°?\s+|primo\s+)?gennaio\s+(?:a|ad|al|fino\s+ad?)\s+(?:oggi|adesso|ora)\b/.test(t);
  const senzaMese = (chiedeAnno && !nominaMese) || daInizioAnno;
  const scelti = [];
  const sconosciuti = [];
  // Prima si scartano i nomi che non esistono, poi si conta fino a quattro:
  // altrimenti due nomi inventati in cima al piano si portavano via i posti
  // degli strumenti veri.
  const validi = (piano && Array.isArray(piano.strumenti) ? piano.strumenti : []).filter(x => {
    const nome = String((x && x.nome) || '').trim();
    if (accetta.has(nome)) return true;
    if (nome) sconosciuti.push(nome);
    return false;
  });
  for (const x of validi.slice(0, 4)) {
    const nome = String((x && x.nome) || '').trim();
    const ok = accetta.get(nome);
    const base = {};
    const ignorati = [];
    for (const [k, v] of Object.entries((x && x.parametri) || {})) {
      if (v === null || v === undefined || v === '') continue;
      if (ok.has(k)) { base[k] = v; continue; }
      // Il canale ha due nomi: «canale» nella maggior parte degli strumenti,
      // «tipologia» in fatturazione e tariffe. Scritto con l'altro nome arrivava
      // giusto allo strumento (piu' sotto, dai canali del piano) ma finiva anche
      // fra gli ignorati, e la risposta diceva «il numero non e' filtrato per
      // canale» su un numero che lo era (visto in produzione il 10/10/2026,
      // passiva di Green Tyre per la rete).
      const nomeCanale = ok.has('canale') ? 'canale' : (ok.has(SINONIMI_CANALE[nome] || '') ? SINONIMI_CANALE[nome] : '');
      if ((k === 'canale' || k === 'tipologia') && nomeCanale && CANALI.includes(String(v).toUpperCase().trim())) {
        if (base[nomeCanale] === undefined) base[nomeCanale] = String(v).toUpperCase().trim();
        continue;
      }
      // Un filtro scritto con il nome vicino si recupera; uno che non esiste
      // proprio si segnala, perche' buttarlo via in silenzio vuol dire
      // rispondere su tutto quando era stato chiesto su uno.
      // Lo stesso filtro gia' messo col nome vicino non e' un filtro ignorato: il
      // pianificatore scriveva «Green Tyre» sia come raccoglitore sia come fornitore,
      // il raccolto filtrava sul primo e il secondo finiva fra gli ignorati, e la
      // risposta diceva «non filtrato per il fornitore» su un numero filtrato
      // (visto in produzione il 10/10/2026).
      const uguale = (x, y) => String(x).toLowerCase().replace(/[^a-z0-9]/g, '') === String(y).toLowerCase().replace(/[^a-z0-9]/g, '');
      if ((SINONIMI_PARAMETRI[k] || []).some(a => ok.has(a) && base[a] !== undefined && uguale(base[a], v))) continue;
      const alias = (SINONIMI_PARAMETRI[k] || []).find(a => ok.has(a) && base[a] === undefined);
      if (alias) { base[alias] = v; continue; }
      // Si segnala solo un filtro che l'utente ha DAVVERO chiesto, cioe' il cui
      // valore compare nella domanda. Lo schema del piano dichiara l'unione dei
      // parametri di tutti gli strumenti, e il pianificatore ne riempie anche di
      // estranei: senza questo controllo, a "quanto ha raccolto Nappi Sud ad
      // agosto?" si attaccava in coda "il numero non e' filtrato per tipologia,
      // direzione, prestazione o stato di scadenza del documento", che non
      // c'entrava niente e sporcava una risposta giusta (visto in produzione il
      // 30/09/2026).
      // Un filtro booleano non compare MAI alla lettera nella domanda - nessuno
      // scrive "true" - e vogliono dire tutti "solo quelli con un problema": se
      // lo strumento non sa filtrarci, buttarlo via in silenzio vuol dire
      // presentare l'elenco intero come se fosse quello chiesto.
      // Raggruppare non e' filtrare: non cambia il numero, cambia come si legge.
      // Sulle giacenze di Nappi Sud, divise per classe, la risposta diceva «non
      // permette di raggruppare per classe» (visto in produzione il 10/10/2026).
      if (k === 'raggruppa') continue;
      const implicito = (impliciti.get(nome) || {})[k];
      if (implicito === '*' || (Array.isArray(implicito) && implicito.some(x => String(x).toUpperCase() === String(v).toUpperCase().trim()))) continue;
      if (typeof v === 'boolean') { if (v) ignorati.push({ parametro: k, valore: 'si' }); continue; }
      const valore = String(v).toLowerCase().trim();
      // Per radice, non per uguaglianza: chi scrive "Puglia" e chi scrive
      // "pugliese" chiede la stessa cosa, e il pianificatore normalizza.
      const radice = valore.slice(0, Math.min(5, valore.length));
      if (valore.length > 1 && (t.includes(valore) || (radice.length > 2 && t.includes(radice)))) {
        ignorati.push({ parametro: k, valore: String(v) });
      }
    }
    if (ok.has('anno') && base.anno == null) base.anno = Number(per.anno) || annoOggi;
    // «Da gennaio a oggi» e «quest'anno» parlano dell'anno IN CORSO: a uno
    // strumento chiesto per un anno passato (il confronto con lo stesso periodo
    // dell'anno scorso) i mesi del pianificatore restano, altrimenti il 2025
    // diventava l'anno intero contro il 2026 fino a oggi (revisione del 10/10/2026).
    const senzaMeseQui = senzaMese && Number(base.anno || annoOggi) === annoOggi;
    if (ok.has('mese') && !base.mese && per.mese && !senzaMeseQui) base.mese = per.mese;
    // Anche i mesi multipli viaggiano dal periodo allo strumento, e se la domanda
    // parla dell'anno se ne vanno insieme al mese singolo.
    if (ok.has('mesi') && !base.mesi && Array.isArray(per.mesi) && per.mesi.length && !senzaMeseQui) base.mesi = per.mesi;
    if (senzaMeseQui) { delete base.mese; delete base.mesi; }
    if (ok.has('settimana') && base.settimana == null && per.settimana) base.settimana = Number(per.settimana);
    // Il perche' della guardia viaggia coi parametri fino al risultato (eseguiStrumento).
    if (x.corretto) base[CHIAVE_SCELTA] = String(x.corretto);
    // Il canale, che in fatturazione e tariffe si chiama tipologia.
    const campoCanale = ok.has('canale') ? 'canale' : (ok.has(SINONIMI_CANALE[nome] || '') ? SINONIMI_CANALE[nome] : '');
    if (campoCanale) {
      const tuttiICanali = chiedeTutto && !nominaCanale;
      const suoi = tuttiICanali ? [...CANALI]
        : base[campoCanale] ? [base[campoCanale]]
        : canali.length ? canali
        : CANALE_OBBLIGATORIO.has(nome) ? ['RETE'] : [];
      if (!suoi.length) {
        // Filtro facoltativo e nessuno l'ha chiesto: si interroga senza, e lo
        // strumento restituisce i canali gia' separati nel suo riepilogo.
        scelti.push({ nome, parametri: base, ignorati });
      } else {
        for (const c of suoi) scelti.push({ nome, parametri: { ...base, [campoCanale]: c }, ignorati });
      }
    } else {
      scelti.push({ nome, parametri: base, ignorati });
    }
  }
  // Due chiamate uguali sono una, anche se una porta il perche' della guardia e
  // l'altra no (revisione del 14/10/2026: due ordini_aperti ACI identici restavano
  // doppi per via della nota). Resta la prima.
  const visti = new Set();
  const unici = scelti.filter(s => {
    // I filtri in ordine di nome: la guardia scrive il canale per ultimo.
    const k = s.nome + JSON.stringify(Object.keys(s.parametri).filter(c => c !== CHIAVE_SCELTA).sort().map(c => [c, s.parametri[c]]));
    if (visti.has(k)) return false;
    visti.add(k);
    return true;
  });
  // Quattro strumenti per tre canali fanno dodici chiamate: il tetto le deve
  // contenere, altrimenti gli ultimi canali sparivano senza che si sapesse.
  const TETTO = 12;
  const tenuti = unici.slice(0, TETTO);
  const scartati = unici.slice(TETTO);
  if (sconosciuti.length) tenuti.sconosciuti = sconosciuti;
  if (scartati.length) tenuti.scartati = scartati.map(s => `${s.nome} ${JSON.stringify(s.parametri)}`);
  if (correzioni.length) tenuti.correzioni = correzioni;
  return tenuti;
}

/**
 * I dati di uno strumento, dentro un budget di caratteri.
 *
 * Tagliare la stringa gia' serializzata spezzava il JSON a meta' e portava via
 * proprio le chiavi finali - totali, note, avvisi - che dicono come leggerlo.
 * Qui invece si accorciano gli elenchi finche' l'oggetto ci sta, e il resto
 * resta intero.
 */
function serializza(dati, budget) {
  if (typeof dati === 'string') return dati.length > budget ? dati.slice(0, budget) + ' …(troncato)' : dati;
  let testo = JSON.stringify(dati);
  if (testo.length <= budget) return testo;
  for (const quante of [30, 15, 8, 4, 2, 1, 0]) {
    const ridotto = JSON.parse(JSON.stringify(dati), function (chiave, valore) {
      if (valore && typeof valore === 'object' && Array.isArray(valore.righe) && typeof valore.quanti === 'number') {
        const tenute = valore.righe.slice(0, quante);
        return {
          ...valore,
          mostrate: tenute.length,
          righe: tenute,
          avviso: `ELENCO TAGLIATO: qui ci sono ${tenute.length} righe delle ${valore.quanti} totali. Il numero giusto e' "quanti": non contare le righe di questo elenco.`,
        };
      }
      return valore;
    });
    testo = JSON.stringify(ridotto);
    if (testo.length <= budget) return testo;
  }
  return testo.slice(0, budget) + ' …(troncato)';
}

/** Il blocco dei dati da mettere nel prompt della risposta. */
export function testoDati(risultati) {
  if (!risultati.length) return '';
  const parti = ['=== DATI DEL GESTIONALE ===',
    'Ogni blocco dice da dove viene, a che periodo si riferisce e quando e\' stato letto. Usa solo questi numeri.'];
  for (const r of risultati) {
    parti.push('');
    parti.push(`--- strumento: ${r.strumento}${r.parametri && Object.keys(r.parametri).length ? ' ' + JSON.stringify(r.parametri) : ''}`);
    if (r.errore) { parti.push(`NON DISPONIBILE: ${r.errore}`); continue; }
    parti.push(`fonte: ${r.fonte} | periodo: ${r.periodo} | dati al: ${r.dati_al}`);
    // La guardia ha cambiato strumento (14/10/2026): il modello lo sa, e risponde con questo.
    // Uno strumento AGGIUNTO a un piano vuoto e' meno sicuro di uno messo al posto di
    // uno sbagliato: se la domanda era di procedura, i numeri non servono
    // (revisione del 14/10/2026).
    if (r.scelta_dello_strumento) {
      const s = String(r.scelta_dello_strumento);
      parti.push(`SCELTA DELLO STRUMENTO: ${s}. ${/^aggiunto/.test(s)
        ? 'Il piano era vuoto e la guardia ha aggiunto questo modulo perche\' la domanda chiede dei dati: se invece chiede una norma o una procedura, rispondi su quella e lascia stare questi numeri.'
        : /scelto al posto/.test(s) ? 'Questo e\' il modulo giusto per la domanda: rispondi con questi dati.'
        : 'Il canale e i filtri qui sopra vengono dalla domanda: rispondi con questi dati.'}`);
    }
    if (r.parametri_ignorati && r.parametri_ignorati.length) {
      parti.push(`ATTENZIONE: questo strumento non conosce ${r.parametri_ignorati.map(i => `"${i.parametro}" (${i.valore})`).join(', ')}: il numero qui sotto NON e' filtrato per quello. Dillo nella risposta invece di far finta che il filtro ci fosse.`);
    }
    parti.push(serializza(r.dati, 24000));
  }
  return parti.join('\n');
}
