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
  produttore: ['fornitore', 'soggetto'],
  cerca: ['testo'],
  testo: ['cerca'],
  sito: ['destinazione'],
  destinazione: ['sito'],
};

/** L'unione dei parametri di tutti gli strumenti, dichiarati uno per uno. */
const PARAMETRI = {
  anno: { type: 'integer' },
  mese: { type: 'string' },
  mese_da: { type: 'integer' },
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
    '- Il canale va sempre deciso: RETE, ACI ed EXTRA RACCOLTA sono commesse indipendenti e non si sommano mai. Se la domanda non lo dice e parla di raccolta, e\' RETE; se parla di autodemolizione o ACI, e\' ACI. Se la domanda chiede "in tutto", "complessivamente" o riguarda piu\' canali, metti in canali tutti quelli che servono: lo strumento verra\' eseguito una volta per canale e i numeri resteranno distinti.',
    '- I target sono solo della rete: per l\'ACI non esistono.',
    '- Per "quanto abbiamo raccolto" usa raccolto, non report_mensile: raccolto da il totale e il dettaglio di un canale e di un periodo. Usa report_mensile solo se la domanda chiede proprio le pivot del Report Mensile o il confronto fra i mesi.',
    '- Se la domanda cita un numero di formulario o un ID ordine, usa cerca_movimento.',
    '- Se la domanda non riguarda i dati del gestionale ma una norma, una procedura o il corso, lascia strumenti vuoto.',
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
      if (alias) base[alias] = v;
      else ignorati.push({ parametro: k, valore: String(v) });
    }
    if (ok.has('anno') && base.anno == null) base.anno = Number(per.anno) || annoOggi;
    if (ok.has('mese') && !base.mese && per.mese && !senzaMese) base.mese = per.mese;
    if (senzaMese) delete base.mese;
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
