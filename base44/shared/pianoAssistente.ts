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
export function strumentiDalPiano(piano, catalogo, oggi) {
  const annoOggi = Number(String(oggi).slice(0, 4));
  const accetta = new Map(catalogo.map(s => [s.nome, new Set(Object.keys(s.parametri || {}))]));
  const per = (piano && piano.periodo) || {};
  const canali = Array.isArray(piano && piano.canali) ? [...new Set(piano.canali.filter(c => CANALI.includes(c)))] : [];
  const scelti = [];
  for (const x of (piano && Array.isArray(piano.strumenti) ? piano.strumenti : []).slice(0, 4)) {
    const nome = String((x && x.nome) || '').trim();
    const ok = accetta.get(nome);
    if (!ok) continue;
    const base = {};
    for (const [k, v] of Object.entries((x && x.parametri) || {})) {
      if (v === null || v === undefined || v === '' || !ok.has(k)) continue;
      base[k] = v;
    }
    if (ok.has('anno') && base.anno == null) base.anno = Number(per.anno) || annoOggi;
    if (ok.has('mese') && !base.mese && per.mese) base.mese = per.mese;
    if (ok.has('settimana') && base.settimana == null && per.settimana) base.settimana = Number(per.settimana);
    if (ok.has('canale')) {
      const suoi = base.canale ? [base.canale] : (canali.length ? canali : ['RETE']);
      for (const c of suoi) scelti.push({ nome, parametri: { ...base, canale: c } });
    } else {
      scelti.push({ nome, parametri: base });
    }
  }
  const visti = new Set();
  return scelti.filter(s => {
    const k = s.nome + JSON.stringify(s.parametri);
    if (visti.has(k)) return false;
    visti.add(k);
    return true;
  }).slice(0, 8);
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
    const testo = typeof r.dati === 'string' ? r.dati : JSON.stringify(r.dati);
    parti.push(testo.length > 24000 ? testo.slice(0, 24000) + ' …(troncato)' : testo);
  }
  return parti.join('\n');
}
