// File e EcoTyna: allegati da leggere e file da preparare.
//
// Excel, CSV, Word e testo arrivano gia' letti dal browser (nessun file sul dominio);
// PDF e immagini arrivano caricati in un'area privata e li legge il modello. I file
// da preparare sono descritti qui e generati nel browser quando si scaricano.

export const MAX_ALLEGATI = 3;
const MAX_TESTO_ALLEGATO = 40000;
const MAX_ESTRATTO = 20000;

export const FORMATI_FILE = ['xlsx', 'csv', 'docx', 'pdf', 'txt'];

export const TIPI_OPERAZIONE = ['filtra', 'ordina', 'rinomina_colonna', 'elimina_colonne', 'tieni_colonne', 'sostituisci', 'imposta_valore', 'aggiungi_colonna', 'raggruppa', 'totale'];

export const SCHEMA_FILE_DA_CREARE = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      nome: { type: 'string' },
      formato: { type: 'string', enum: FORMATI_FILE },
      descrizione: { type: 'string' },
      testo: { type: 'string' },
      fogli: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            nome: { type: 'string' },
            intestazioni: { type: 'array', items: { type: 'string' } },
            righe: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
          },
        },
      },
      da_allegato: { type: 'string' },
      foglio: { type: 'string' },
      riga_intestazione: { type: 'number' },
      mantieni_altri_fogli: { type: 'boolean' },
      operazioni: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tipo: { type: 'string', enum: TIPI_OPERAZIONE },
            colonna: { type: 'string' },
            colonna2: { type: 'string' },
            colonne: { type: 'array', items: { type: 'string' } },
            per: { type: 'array', items: { type: 'string' } },
            somma: { type: 'array', items: { type: 'string' } },
            operatore: { type: 'string', enum: ['uguale', 'diverso', 'contiene', 'non_contiene', 'maggiore', 'minore', 'maggiore_uguale', 'minore_uguale', 'vuoto', 'non_vuoto'] },
            operazione: { type: 'string', enum: ['somma', 'differenza', 'prodotto', 'rapporto', 'kg_in_t', 't_in_kg', 'copia', 'testo'] },
            valore: { type: 'string' },
            nuovo_nome: { type: 'string' },
            direzione: { type: 'string', enum: ['crescente', 'decrescente'] },
            da: { type: 'string' },
            a: { type: 'string' },
          },
        },
      },
    },
  },
};

export const SCHEMA_LETTURA_FILE = {
  type: 'object',
  properties: {
    file: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nome: { type: 'string' },
          tipo_documento: { type: 'string' },
          contenuto: { type: 'string' },
          note: { type: 'string' },
        },
      },
    },
  },
};

const testo = (v, max) => String(v ?? '').slice(0, max);

/** Allegati ricevuti dal browser, ripuliti. */
export function allegatiRicevuti(v) {
  return (Array.isArray(v) ? v : []).slice(0, MAX_ALLEGATI).map(a => ({
    nome: testo(a && a.nome, 200) || 'file',
    tipo: ['tabella', 'documento', 'testo', 'pdf', 'immagine'].includes(a && a.tipo) ? a.tipo : 'testo',
    dimensione: Number(a && a.dimensione) || 0,
    testo: testo(a && a.testo, MAX_TESTO_ALLEGATO),
    tagliato: !!(a && a.tagliato),
    file_uri: typeof (a && a.file_uri) === 'string' ? a.file_uri : '',
  }));
}

/** Istruzioni per leggere PDF e immagini allegati. */
export function istruzioniLettura(domanda, allegati) {
  return [
    'Leggi con attenzione i file allegati e trascrivi fedelmente il contenuto utile per rispondere alla richiesta qui sotto.',
    `File, nell'ordine: ${allegati.map(a => a.nome).join('; ')}.`,
    '- Testo: riporta intestazioni, date, numeri, codici (EER, FIR, partite IVA, iscrizioni), importi, pesi, firme e timbri come sono scritti.',
    '- Tabelle: una riga per riga della tabella, celle separate da ";", con la riga di intestazione.',
    '- Non riassumere i dati e non inventare nulla. Se una parte e\' illeggibile o manca, scrivilo in note.',
    '- contenuto: al massimo 20.000 caratteri per file; tipo_documento: che documento e\' (per esempio formulario, visura, fattura, autorizzazione, report).',
    '',
    `RICHIESTA: ${domanda}`,
  ].join('\n');
}

/** Sezione ALLEGATI del prompt e allegati da salvare con la domanda (solo un estratto, non i file). */
export function allegatiPerPrompt(allegati, letture) {
  // Letture del modello abbinate ai file: prima per nome, poi quelle rimaste nell'ordine.
  const lista = (Array.isArray(letture) ? letture : []).filter(Boolean);
  const abbinate = new Map();
  const caricati = allegati.filter(a => a.file_uri);
  for (const a of caricati) {
    const l = lista.find(x => !abbinate.has(x) && String(x.nome || '').trim().toLowerCase() === a.nome.toLowerCase());
    if (l) abbinate.set(l, a);
  }
  for (const a of caricati) {
    if ([...abbinate.values()].includes(a)) continue;
    const l = lista.find(x => !abbinate.has(x));
    if (l) abbinate.set(l, a);
  }
  const letturaDi = (a) => [...abbinate.entries()].find(([, x]) => x === a)?.[0] || null;
  const conContenuto = allegati.map((a, i) => {
    const letto = a.file_uri ? letturaDi(a) : null;
    const contenuto = a.file_uri ? testo(letto && letto.contenuto, MAX_TESTO_ALLEGATO) : a.testo;
    return {
      ...a,
      rif: `F${i + 1}`,
      tipo_documento: letto ? testo(letto.tipo_documento, 200) : '',
      note: letto ? testo(letto.note, 500) : '',
      contenuto,
    };
  });
  const sezione = conContenuto.map(a => [
    `[${a.rif}] ${a.nome} (${a.tipo}${a.tipo_documento ? `, ${a.tipo_documento}` : ''})${a.tagliato ? ' - contenuto tagliato' : ''}`,
    a.note ? `Note di lettura: ${a.note}` : '',
    a.contenuto || '(contenuto non leggibile)',
  ].filter(Boolean).join('\n')).join('\n\n');
  const daSalvare = conContenuto.map(a => ({ rif: a.rif, nome: a.nome, tipo: a.tipo, dimensione: a.dimensione, tipo_documento: a.tipo_documento, caricato: !!a.file_uri, estratto: testo(a.contenuto, MAX_ESTRATTO) }));
  return { sezione, daSalvare };
}

export const REGOLE_FILE = [
  'FILE',
  '- Se ci sono ALLEGATI rispondi sul loro contenuto: citali con il riferimento ([F1], [F2]) e riporta numeri, date e codici come sono scritti. Se un contenuto e\' tagliato dillo e usa il riepilogo delle colonne per i totali.',
  '- Controlla i documenti con la base di conoscenza e i dati del gestionale: validita\' e scadenze, firme, codici EER, iscrizioni e classi, pesi, coerenza tra documenti. Segnala con chiarezza cosa non torna e cosa manca.',
  '- Se l\'utente chiede di creare un file (Excel, CSV, Word, PDF, testo) o di modificarne uno allegato, compila file_da_creare e nella risposta spiega in breve che cosa contiene; il pulsante per scaricarlo compare sotto la risposta. Senza una richiesta esplicita non creare file.',
  '  - Tabelle (xlsx, csv): fogli con intestazioni e righe; numeri senza separatore delle migliaia e con il punto per i decimali; date AAAA-MM-GG.',
  '  - Documenti (docx, pdf, txt): lettere, relazioni, verbali, procedure, email in testo markdown semplice (titoli con #, elenchi con -, grassetto con **, tabelle con |).',
  '  - Per modificare un foglio allegato con molte righe non riscriverle: indica da_allegato (nome esatto del file), foglio, e le operazioni in ordine (filtra, ordina, rinomina_colonna, elimina_colonne, tieni_colonne, sostituisci, imposta_valore, aggiungi_colonna, raggruppa, totale) usando i nomi delle colonne dell\'intestazione. Per documenti Word, PDF o di testo allegati riscrivi il testo completo gia\' modificato.',
  '  - Usa solo dati presenti negli allegati, nei dati del gestionale o nella domanda: mai dati inventati; cio\' che manca resta vuoto o si scrive [da completare].',
  '  - Pesi: tonnellate con due decimali (tre se i kg non sono tondi), kg interi. Canali RETE, ACI ed EXTRA RACCOLTA sempre separati.',
  '  - Nome del file chiaro, senza estensione. Nessun riferimento alla piattaforma su cui e\' costruito il gestionale.',
].join('\n');

/** File da creare restituiti dal modello, ripuliti e con limiti di dimensione. */
export function fileDaCreare(v) {
  return (Array.isArray(v) ? v : []).slice(0, 5).map(f => {
    if (!f || !FORMATI_FILE.includes(f.formato)) return null;
    const base = {
      nome: testo(f.nome, 120).replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'EcoTyna',
      formato: f.formato,
      descrizione: testo(f.descrizione, 500),
    };
    if (f.formato === 'xlsx' || f.formato === 'csv') {
      if (f.da_allegato) {
        return {
          ...base,
          da_allegato: testo(f.da_allegato, 200),
          foglio: testo(f.foglio, 100),
          riga_intestazione: Number(f.riga_intestazione) || 1,
          mantieni_altri_fogli: !!f.mantieni_altri_fogli,
          operazioni: (Array.isArray(f.operazioni) ? f.operazioni : []).filter(o => o && TIPI_OPERAZIONE.includes(o.tipo)).slice(0, 30),
        };
      }
      const fogli = (Array.isArray(f.fogli) ? f.fogli : []).slice(0, 10).map(s => ({
        nome: testo(s && s.nome, 31),
        intestazioni: (Array.isArray(s && s.intestazioni) ? s.intestazioni : []).slice(0, 100).map(h => testo(h, 200)),
        righe: (Array.isArray(s && s.righe) ? s.righe : []).slice(0, 5000).map(r => (Array.isArray(r) ? r : [r]).slice(0, 100).map(c => testo(c, 1000))),
      })).filter(s => s.intestazioni.length || s.righe.length);
      return fogli.length ? { ...base, fogli } : null;
    }
    const t = testo(f.testo, 100000);
    return t.trim() ? { ...base, testo: t } : null;
  }).filter(Boolean);
}
