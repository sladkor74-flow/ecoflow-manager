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
          parametri: { type: 'object' },
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
    '- Il canale va sempre deciso: RETE, ACI ed EXTRA RACCOLTA sono commesse indipendenti e non si sommano mai. Se la domanda non lo dice e parla di raccolta, e\' RETE; se parla di autodemolizione o ACI, e\' ACI. Se la domanda riguarda piu\' canali, chiedi lo stesso strumento una volta per canale.',
    '- I target sono solo della rete: per l\'ACI non esistono.',
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
