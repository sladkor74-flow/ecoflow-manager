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

const CANALI = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];

// Per un solo strumento il canale e' obbligatorio, perche' legge tre archivi
// diversi e senza canale non saprebbe quale aprire. Per tutti gli altri e' un
// filtro: imporgli "RETE" quando nessuno l'ha chiesto significa nascondere le
// righe ACI ed extra che lo strumento avrebbe restituito gia' separate.
const CANALE_OBBLIGATORIO = new Set(['raccolto']);

// Nella fatturazione e nelle tariffe il canale si chiama tipologia.
const SINONIMI_CANALE = { fatturazione: 'tipologia', tariffe: 'tipologia' };

// Qualche filtro il pianificatore lo scrive con un nome vicino ma non uguale.
const SINONIMI_PARAMETRI = {
  fornitore: ['raccoglitore', 'soggetto', 'produttore'],
  raccoglitore: ['fornitore'],
  soggetto: ['fornitore'],
  produttore: ['fornitore', 'soggetto', 'origine'],
  origine: ['raccoglitore', 'fornitore', 'soggetto', 'produttore', 'sito'],
  cerca: ['testo'],
  testo: ['cerca'],
  sito: ['destinazione'],
  destinazione: ['sito'],
};

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
  raggruppa: { type: 'string', enum: ['raccoglitore', 'provincia', 'regione', 'classe', 'destinazione', 'mese'] },
  provincia: { type: 'string' },
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
  stato: { type: 'string' },
  origine: { type: 'string' },
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
    '- Il canale va sempre deciso: RETE, ACI ed EXTRA RACCOLTA sono commesse indipendenti e non si sommano mai. Se la domanda non lo dice e parla di raccolta, e\' RETE; se parla di autodemolizione o ACI, e\' ACI. Se la domanda chiede "in tutto", "complessivamente" o riguarda piu\' canali, metti in canali tutti quelli che servono: lo strumento verra\' eseguito una volta per canale e i numeri resteranno distinti.',
    '- I target sono solo della rete: per l\'ACI non esistono.',
    '- Per "quanto abbiamo raccolto" usa raccolto, non report_mensile: raccolto da il totale e il dettaglio di un canale e di un periodo. Usa report_mensile solo se la domanda chiede proprio le pivot del Report Mensile o il confronto fra i mesi.',
    '- Se la domanda cita un numero di formulario o un ID ordine, usa cerca_movimento.',
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

/**
 * Quali strumenti eseguire davvero, a partire dal piano.
 *
 * Due cose il modello se le dimentica quasi sempre, e sono proprio quelle che
 * fanno sbagliare il numero: il periodo che ha appena deciso non lo riporta nei
 * parametri, e quando i canali sono piu' d'uno chiede una cosa sola. Qui il
 * periodo si travasa in ogni strumento che lo accetta e i canali diventano una
 * chiamata ciascuno, cosi' restano separati anche nei dati, non solo a parole.
 */
export function strumentiDalPiano(piano, catalogo, oggi, domanda = '') {
  const annoOggi = Number(String(oggi).slice(0, 4));
  const accetta = new Map(catalogo.map(s => [s.nome, new Set(Object.keys(s.parametri || {}))]));
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
  const senzaMese = chiedeAnno && !nominaMese;
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
      // Un filtro scritto con il nome vicino si recupera; uno che non esiste
      // proprio si segnala, perche' buttarlo via in silenzio vuol dire
      // rispondere su tutto quando era stato chiesto su uno.
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
      const valore = String(v).toLowerCase().trim();
      if (valore && valore.length > 1 && t.includes(valore)) ignorati.push({ parametro: k, valore: String(v) });
    }
    if (ok.has('anno') && base.anno == null) base.anno = Number(per.anno) || annoOggi;
    if (ok.has('mese') && !base.mese && per.mese && !senzaMese) base.mese = per.mese;
    // Anche i mesi multipli viaggiano dal periodo allo strumento, e se la domanda
    // parla dell'anno se ne vanno insieme al mese singolo.
    if (ok.has('mesi') && !base.mesi && Array.isArray(per.mesi) && per.mesi.length && !senzaMese) base.mesi = per.mesi;
    if (senzaMese) { delete base.mese; delete base.mesi; }
    if (ok.has('settimana') && base.settimana == null && per.settimana) base.settimana = Number(per.settimana);
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
  const visti = new Set();
  const unici = scelti.filter(s => {
    const k = s.nome + JSON.stringify(s.parametri);
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
    if (r.parametri_ignorati && r.parametri_ignorati.length) {
      parti.push(`ATTENZIONE: questo strumento non conosce ${r.parametri_ignorati.map(i => `"${i.parametro}" (${i.valore})`).join(', ')}: il numero qui sotto NON e' filtrato per quello. Dillo nella risposta invece di far finta che il filtro ci fosse.`);
    }
    parti.push(serializza(r.dati, 24000));
  }
  return parti.join('\n');
}

// === LA SCORCIATOIA ===
//
// Una domanda sui dati costa DUE chiamate al modello: una per decidere quali
// strumenti interrogare e una per rispondere. Per la domanda piu' frequente -
// "quanto ha raccolto il tale a agosto?" - il piano e' sempre lo stesso, e farlo
// decidere a un modello e' tempo buttato (richiesta dell'utente del 30/09/2026:
// la vuole piu' performante).
//
// La scorciatoia riconosce UNA forma sola e strettissima. Al minimo dubbio
// restituisce null e decide il pianificatore come prima: una scorciatoia che
// indovina e' peggio di nessuna scorciatoia, perche' il numero sbagliato arriva
// piu' in fretta.
//
// Il nome del soggetto non viene controllato qui: ci pensa risolviNome dentro lo
// strumento, che se non lo riconosce lo dice invece di rispondere zero.

// Parole che spostano la domanda altrove: raggruppamenti, confronti, target,
// previsioni. Ci sono strumenti apposta, e li sceglie il pianificatore.
const FUORI_SCORCIATOIA = /\b(target|provinc\w*|region\w*|classe|classi|destinazion\w*|impiant\w*|stoccagg\w*|confront\w*|rispetto|media|previs\w*|proiezion\w*|quadratur\w*|giacenz\w*|fattur\w*|tariff\w*|assegnat\w*|evas\w*|alert|scadut\w*|qualific\w*|omologh\w*|rentri|pdr|settiman\w*|primo trimestre|semestre)\b/;

const PREPOSIZIONI = /^(?:il|lo|la|i|gli|le|un|uno|una|di|del|dello|della|dei|degli|delle|da|dal|dalla|a|ad|al|alla|in|nel|nella|nei|per|con|su)\s+/;

/**
 * Il piano per la domanda canonica sul raccolto, senza chiamare il modello.
 * null quando la domanda non e' esattamente quella forma.
 *
 * Funzione pura: le prove la chiamano senza toccare la piattaforma.
 */
export function pianoDiretto(domanda, oggi) {
  const testo = String(domanda || '').replace(/\s+/g, ' ').trim();
  // Una domanda sola: due frasi vogliono dire due richieste.
  if ((testo.match(/\?/g) || []).length > 1) return null;
  const t = testo.toLowerCase().replace(/[?!.]+$/, '').trim();
  if (FUORI_SCORCIATOIA.test(t)) return null;

  const m = t.match(/^quant[oie](?:\s+tonnellate|\s+kg|\s+chili)?\s+(?:ha|hanno|abbiamo|avete|e'\s+stato|è\s+stato)\s+(?:raccolt\w+|conferit\w+|portat\w+|ritirat\w+)\s*(.*)$/);
  if (!m) return null;
  let resto = ` ${m[1].trim()} `;

  // Il canale, se nominato.
  let canale = null;
  if (/\baci\b/.test(resto)) canale = 'ACI';
  else if (/\bextra\s+raccolta\b/.test(resto)) canale = 'EXTRA_RACCOLTA';
  else if (/\brete\b/.test(resto)) canale = 'RETE';
  resto = resto.replace(/\b(sul|sulla|nel|nella|in|di|del)?\s*(canale\s+)?(aci|extra\s+raccolta|rete)\b/g, ' ');

  // L'anno, se scritto.
  const anno = (resto.match(/\b(20\d\d)\b/) || [])[1];
  resto = resto.replace(/\b20\d\d\b/g, ' ');

  // I mesi. Si accettano l'elenco e l'intervallo, come mesiChiesti.
  const nomiMese = MESI.map(x => x.toLowerCase()).join('|');
  // String.raw, non un template normale: in un template `\b` non e' il confine di
  // parola ma il carattere di backspace, e `\s` perde il backslash. Costruita
  // cosi', questa regex non riconosceva nessun mese e il nome del mese finiva
  // dentro il nome del raccoglitore.
  const cerca = (f, flag) => new RegExp(f, flag);
  const trovati = resto.match(cerca(String.raw`\b(?:${nomiMese})\b`, 'g')) || [];
  const intervallo = cerca(String.raw`\b(${nomiMese})\s*(?:-|–|\ba\b|\bal\b|\bfino\s+a\b)\s*(${nomiMese})\b`).test(resto);
  const primoMese = resto.search(cerca(String.raw`\b(?:${nomiMese})\b`));
  // Il soggetto e' quello che viene PRIMA del periodo.
  let soggetto = (primoMese >= 0 ? resto.slice(0, primoMese) : resto)
    .replace(/\b(nel|nei|nella|del|dei|il|i|mese|mesi|di|a|ad|in|per|durante|scorso|corrente|questo|quest)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
  while (PREPOSIZIONI.test(soggetto + ' ')) soggetto = soggetto.replace(PREPOSIZIONI, '').trim();

  // Senza periodo e senza soggetto non c'e' niente da accorciare: e' la domanda
  // generica sull'anno, e il pianificatore la sa gestire meglio.
  if (!trovati.length && !anno && !soggetto) return null;
  // Un soggetto che non somiglia a una ragione sociale ma a una descrizione ("il
  // raccoglitore che opera nella zona di Bari"): la scorciatoia non ci prova,
  // perche' quel nome non si abbinera' mai e la risposta sarebbe un vicolo cieco
  // arrivato in fretta. Quattro parole bastano per i nomi veri, compreso
  // "autotrasporti ielapi cunocchiella rita".
  if (soggetto && soggetto.split(' ').length > 4) return null;
  if (/\b(che|quale|quali|cui|zona|area|tutti|tutte|ogni|nessun\w*|raccoglitor\w*|fornitor\w*|client\w*|trasportator\w*|soggett\w*|impres\w*|ditt\w*)\b/.test(soggetto)) return null;

  const parametri = { canale: canale || 'RETE' };
  if (anno) parametri.anno = Number(anno);
  else parametri.anno = Number(String(oggi).slice(0, 4));
  if (intervallo) parametri.mesi = [resto.slice(primoMese).trim()];
  else if (trovati.length > 1) parametri.mesi = trovati.map(x => MESI[MESI.findIndex(v => v.toLowerCase() === x)]);
  else if (trovati.length === 1) parametri.mese = MESI[MESI.findIndex(v => v.toLowerCase() === trovati[0])];
  if (soggetto) parametri.raccoglitore = soggetto;
  return [{ nome: 'raccolto', parametri, perche: 'domanda canonica sul raccolto: piano deciso senza chiamare il modello' }];
}
