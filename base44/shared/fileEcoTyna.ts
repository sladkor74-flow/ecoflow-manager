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
  // file_rimasto c'e' solo quando la piattaforma non ha permesso di cancellare
  // l'allegato dopo averlo letto: e' l'unico modo di ritrovarlo, e credere di
  // aver liberato spazio senza averlo fatto e' peggio che saperlo.
  const daSalvare = conContenuto.map(a => ({
    rif: a.rif, nome: a.nome, tipo: a.tipo, dimensione: a.dimensione, tipo_documento: a.tipo_documento,
    caricato: !!a.file_uri, estratto: testo(a.contenuto, MAX_ESTRATTO),
    ...(a.file_rimasto ? { file_rimasto: a.file_rimasto, motivo_file_rimasto: a.motivo_file_rimasto || '' } : {}),
  }));
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
  '  - Un elenco dei dati del gestionale con l\'avviso ELENCO TAGLIATO (o elenco_tagliato) ha solo una parte delle righe: un file fatto con quelle e\' incompleto. Non offrirlo; se l\'utente lo chiede lo stesso, crealo con quello che hai e nella risposta di\' quante righe ha e quante sono in tutto, e che l\'elenco intero si esporta dal modulo del gestionale. Il gestionale riconosce il file fatto da un elenco tagliato dalle sue righe e gli scrive in testa che e\' parziale, con lo stesso avviso accanto al pulsante per scaricarlo: per questo nel file copia nomi, codici e numeri come li vedi nei dati, senza riscriverli.',
  '  - Pesi: tonnellate con due decimali (tre se i kg non sono tondi), kg interi. Canali RETE, ACI ed EXTRA RACCOLTA sempre separati.',
  '  - Nome del file chiaro, senza estensione. Nessun riferimento alla piattaforma su cui e\' costruito il gestionale.',
].join('\n');

// === I file fatti da un elenco tagliato (segnalazione alta A73 del 20/09, corretta il 12/10/2026) ===
//
// Gli elenchi degli strumenti arrivano al modello tagliati (elenco() in
// strumentiAssistente.ts: 60 righe dei 268 punti di raccolta di Bari) e a volte
// accorciati ancora per stare nel prompt (serializza in pianoAssistente.ts). Un
// file Excel o PDF il modello lo scrive con le righe che vede: fatto da un elenco
// tagliato e' incompleto, e niente lo diceva. Rifare l'elenco dal server senza
// taglio (un da_strumento rieseguito) e' stato valutato e lasciato: vorrebbe dire
// passare un «senza taglio» ai ventidue elenchi degli strumenti e trasformare
// ciascuno in un foglio, e un elenco intero di primarie non sta nei 300.000
// caratteri che si conservano con la domanda. Per ora: il prompt non offre il
// file su un elenco tagliato (regola 3-quater e REGOLE_FILE), e se lo si chiede
// lo stesso il file porta scritto che puo' essere parziale.

// QUALE ELENCO HA FATTO IL FILE (revisione del 13/10/2026, rilievo sulla A73).
// Il 12/10 il segno «parziale» andava a ogni file della risposta appena un
// elenco del blocco dei dati era tagliato: il raccolto per raccoglitore, intero
// (2 righe su 2), usciva «parziale» perche' nello stesso blocco c'erano 10 degli
// 11 ordini con le date da sistemare, e cosi' una lettera scritta nella stessa
// risposta. Ora il file si lega alle righe da cui viene: le sue celle (o le
// righe del testo) si confrontano con le righe degli elenchi che il modello ha
// visto, tagliati e interi, e il file e' parziale solo se le sue righe somigliano
// piu' a quelle di un elenco tagliato che a qualunque riga di un elenco intero.
// Un blocco troncato a meta', di cui le righe non si leggono, resta come prima:
// segna tutti i file, con il «se».

// Interi col punto delle migliaia, scritto a mano come in formato.ts: toLocaleString
// con l'italiano non lo mette sotto i diecimila («2680»).
const numeroIt = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Un valore come puo' finire in una cella: testo minuscolo senza spazi doppi, numeri col punto. '' se non dice niente. */
function valoreCella(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : '';
  if (typeof v !== 'string') return '';
  const t = v.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t || t === '—' || t === '-' || t === 'n/d') return '';
  if (/^-?[\d.,]+$/.test(t)) {
    const n = t.includes(',') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t);
    if (Number.isFinite(n)) return String(Math.round(n * 1000) / 1000);
  }
  return t;
}
const eNumero = (v) => /^-?\d+(?:\.\d+)?$/.test(v);

/** Tutti i valori di una riga di un elenco tagliato, anche quelli annidati: cio' che sta sotto un taglio e' tagliato anche lui. */
function valoriDi(x, out = new Set<string>()) {
  if (Array.isArray(x)) { for (const v of x) valoriDi(v, out); return out; }
  if (x && typeof x === 'object') { for (const v of Object.values(x)) valoriDi(v, out); return out; }
  const v = valoreCella(x);
  if (v) out.add(v);
  return out;
}

/** L'avviso di taglio di un oggetto: «ELENCO TAGLIATO» o elenco_tagliato; '' se non e' tagliato. */
function taglioDi(x) {
  const avviso = typeof x.avviso === 'string' && /ELENCO TAGLIATO/.test(x.avviso) ? x.avviso : '';
  return avviso || (typeof x.elenco_tagliato === 'string' ? x.elenco_tagliato : '');
}

/** Un elenco dentro i dati: tagliato, o con le righe e il «quanti» di elenco() (strumentiAssistente.ts). */
const eElenco = (x) => !!x && typeof x === 'object' && !Array.isArray(x) && (!!taglioDi(x) || (Array.isArray(x.righe) && typeof x.quanti === 'number'));

// LA RIGA INTERA E' LA RIGA, NON QUELLO CHE CONTIENE (revisione del 13/10/2026,
// rilievo sulla A73). Con la prima correzione del 13/10 la riga di un elenco
// intero prendeva tutti i valori annidati: l'elemento del canale della
// fatturazione attiva conteneva i mesi, il documento e i 20 ordini su 30 arrivati
// dopo (elenco tagliato), e ogni riga del file fatto da quegli ordini pareggiava
// con l'elemento del canale. Il pareggio non conta, e il file usciva senza nessun
// avviso: peggio di prima, quando portava almeno il «se». Lo stesso per i
// cambiati, i non piu' nel mese e le date da sistemare dell'attiva (un array di
// elenchi, uno per canale). Ora la riga di un elemento prende solo i valori suoi:
// i valori semplici, anche dentro un oggetto che non e' un elenco e dentro un
// array di valori semplici (piu' valori della stessa cella). Gli array di righe
// e gli elenchi annidati restano fuori: si visitano e si contano a parte.
function valoriPropri(x, out = new Set<string>()) {
  if (Array.isArray(x)) {
    for (const v of x) if (!v || typeof v !== 'object') valoriPropri(v, out);
    return out;
  }
  if (x && typeof x === 'object') {
    for (const v of Object.values(x)) if (!eElenco(v)) valoriPropri(v, out);
    return out;
  }
  const v = valoreCella(x);
  if (v) out.add(v);
  return out;
}

// Le righe di un elenco tagliato viaggiano accanto ai suoi numeri senza
// comparire quando lo si scrive: servono solo a legare un file al suo elenco.
const conRighe = (t, righe) => Object.defineProperty(t, 'righe', { value: righe, enumerable: false });

/** Gli elenchi di un blocco di dati gia' letto: le righe di quelli tagliati e di quelli interi. */
function elenchiDelBlocco(dati, strumento, tagliati, interi) {
  const visita = (x) => {
    if (Array.isArray(x)) {
      // Un elemento che e' esso stesso un elenco (le date da sistemare
      // dell'attiva, una per canale) non e' una riga: si visita e basta.
      for (const el of x) { if (!eElenco(el)) interi.push(valoriPropri(el)); if (el && typeof el === 'object') visita(el); }
      return;
    }
    if (!x || typeof x !== 'object') return;
    const taglio = taglioDi(x);
    if (!taglio) { for (const v of Object.values(x)) visita(v); return; }
    const m = taglio.match(/qui ci sono (?:i )?(\d+) .*?\bd(?:elle|ei) (\d+)/i);
    const righe = [];
    for (const v of Object.values(x)) {
      if (Array.isArray(v)) for (const el of v) righe.push(valoriDi(el));
      else visita(v);
    }
    tagliati.push(conRighe({ strumento, mostrate: m ? Number(m[1]) : null, quanti: m ? Number(m[2]) : null }, righe));
  };
  visita(dati);
}

/**
 * Gli elenchi arrivati tagliati al modello, letti dal blocco dei dati cosi' come
 * e' entrato nel prompt (testoDati): l'avviso «ELENCO TAGLIATO» dello strumento o
 * del prompt, elenco_tagliato, o un blocco troncato. { strumento, mostrate, quanti }:
 * i due numeri sono null quando l'avviso non li dice. Accanto, senza comparire
 * quando li si scrive, le righe che il modello ha visto: di ogni elenco tagliato
 * (righe, assenti se il blocco e' troncato a meta' e non si legge) e degli elenchi
 * interi (interi, sulla lista). Servono a fileDaElenchiTagliati.
 */
export function elenchiTagliati(testoDati) {
  const trovati = [];
  const interi = [];
  let strumento = '';
  for (const riga of String(testoDati || '').split('\n')) {
    const m = riga.match(/^--- strumento: (\S+)/);
    if (m) { strumento = m[1]; continue; }
    const t = riga.trim();
    if (/^[[{]/.test(t)) {
      let dati;
      try { dati = JSON.parse(t); } catch (_e) { dati = undefined; }
      if (dati !== undefined) { elenchiDelBlocco(dati, strumento, trovati, interi); continue; }
    }
    // Una riga che non si legge come dati (un blocco troncato a meta'): l'avviso
    // c'e', le righe no.
    let qui = 0;
    for (const x of riga.matchAll(/ELENCO TAGLIATO: qui ci sono (\d+) (?:righe|ordini) d(?:elle|ei) (\d+)/g)) {
      trovati.push({ strumento, mostrate: Number(x[1]), quanti: Number(x[2]) });
      qui++;
    }
    for (const x of riga.matchAll(/"elenco_tagliato":"Qui ci sono i (\d+) [^"]*? dei (\d+)/g)) {
      trovati.push({ strumento, mostrate: Number(x[1]), quanti: Number(x[2]) });
      qui++;
    }
    if (!qui && (/ELENCO TAGLIATO|"elenco_tagliato"/.test(riga) || / …\(troncato\)$/.test(riga))) trovati.push({ strumento, mostrate: null, quanti: null });
  }
  // Gli elenchi letti restano tutti, anche con gli stessi numeri: hanno righe
  // diverse. Quelli senza righe si dicono una volta.
  const visti = new Set();
  const lista = trovati.filter(t => {
    if (t.righe) return true;
    const k = `${t.strumento}|${t.mostrate}|${t.quanti}`;
    if (visti.has(k)) return false;
    visti.add(k);
    return true;
  });
  return Object.defineProperty(lista, 'interi', { value: interi, enumerable: false });
}

// Un valore che compare in un testo come parola intera: «bari» in «comune di
// Bari», non in «barista».
function nelTesto(s, v) {
  for (let i = s.indexOf(v); i >= 0; i = s.indexOf(v, i + 1)) {
    if (!/[a-z0-9]/.test(s[i - 1] || '') && !/[a-z0-9]/.test(s[i + v.length] || '')) return true;
  }
  return false;
}

/** Le righe di un file come insiemi di valori: le righe dei fogli, o le righe del testo. */
function righeDelFile(f, testiNoti) {
  if (Array.isArray(f.fogli)) {
    return f.fogli.flatMap(s => (Array.isArray(s && s.righe) ? s.righe : []).map(r => new Set((Array.isArray(r) ? r : [r]).map(valoreCella).filter(Boolean))));
  }
  return String(f.testo || '').split('\n').map(l => {
    // Una tabella del testo: le celle, come in un foglio.
    if (/^\s*\|.*\|\s*$/.test(l)) return new Set(l.trim().replace(/^\||\|$/g, '').split('|').map(valoreCella).filter(Boolean));
    // Il resto: i testi degli elenchi che la riga contiene. I numeri di una frase
    // (anni, date, quantita') no: si somigliano troppo per dire da dove vengono.
    const s = l.toLowerCase().replace(/\s+/g, ' ');
    return new Set(testiNoti.filter(v => nelTesto(s, v)));
  });
}

/**
 * Per ogni elenco tagliato, quante righe del file vengono da li': una riga del
 * file viene dall'elenco tagliato con cui ha piu' valori in comune (due punti un
 * testo, uno un numero), se ne ha almeno due e piu' che con qualunque riga di un
 * elenco intero.
 */
function righeDaiTagliati(f, tagliati, interi) {
  const indice = new Map();
  const di = [];
  const aggiungi = (valori, k) => {
    const id = di.length;
    di.push(k);
    for (const v of valori) { if (!indice.has(v)) indice.set(v, []); indice.get(v).push(id); }
  };
  tagliati.forEach((t, k) => (t.righe || []).forEach(r => aggiungi(r, k)));
  interi.forEach(r => aggiungi(r, -1));
  const testiNoti = [...indice.keys()].filter(v => v.length >= 4 && !eNumero(v));
  const conti = new Map();
  for (const valori of righeDelFile(f, testiNoti)) {
    const punti = new Map();
    for (const v of valori) {
      const righe = indice.get(v);
      // Un valore che hanno migliaia di righe non dice da quale viene.
      if (!righe || righe.length > 2000) continue;
      for (const id of righe) punti.set(id, (punti.get(id) || 0) + (eNumero(v) ? 1 : 2));
    }
    let k = -1, puntiTagliato = 0, puntiIntero = 0;
    for (const [id, p] of punti) {
      if (di[id] < 0) puntiIntero = Math.max(puntiIntero, p);
      else if (p > puntiTagliato) { puntiTagliato = p; k = di[id]; }
    }
    if (k >= 0 && puntiTagliato >= 2 && puntiTagliato > puntiIntero) conti.set(k, (conti.get(k) || 0) + 1);
  }
  return conti;
}

const comeTaglio = (t) => (t.quanti === null ? 'una parte delle righe' : `${numeroIt(t.mostrate)} ${t.mostrate === 1 ? 'riga' : 'righe'} su ${numeroIt(t.quanti)}`);

/**
 * I file scritti dal modello da un elenco tagliato: portano parziale, il testo
 * che la chat mostra accanto al pulsante Scarica e che il file scaricato porta
 * in testa (scaricaFileEcoTyna, src/lib/fileEcoTyna.js). Un file e' di un elenco
 * tagliato se almeno due sue righe vengono da li' (una, se l'elenco ne mostrava
 * una sola): un file con un elenco intero, o una lettera, non e' parziale perche'
 * nello stesso blocco c'era un altro elenco tagliato. Un blocco troncato a meta',
 * senza righe leggibili, segna tutti i file col «se». I file che modificano un
 * allegato (da_allegato) mai: quelli si fanno nel browser sulle righe vere del file.
 */
export function fileDaElenchiTagliati(file, tagliati) {
  const lista = Array.isArray(file) ? file : [];
  if (!Array.isArray(tagliati) || !tagliati.length) return lista;
  const interi = Array.isArray(tagliati.interi) ? tagliati.interi : [];
  const senzaRighe = tagliati.filter(t => !t.righe);
  const avvisoIncerto = senzaRighe.length
    ? `Per questa risposta EcoTyna ha letto ${senzaRighe.length === 1 ? 'un elenco tagliato' : 'elenchi tagliati'} (${[...new Set(senzaRighe.map(comeTaglio))].join('; ')}): se il file viene da li', ne contiene solo una parte. L'elenco intero si esporta dal modulo del gestionale.`
    : '';
  return lista.map(f => {
    if (!f || f.da_allegato) return f;
    const conti = righeDaiTagliati(f, tagliati, interi);
    const da = tagliati.filter((t, k) => t.righe && (conti.get(k) || 0) >= Math.min(2, Math.max(1, t.mostrate ?? 2)));
    if (da.length) {
      return { ...f, parziale: `Questo file e' fatto da ${da.length === 1 ? 'un elenco tagliato' : 'elenchi tagliati'} (${[...new Set(da.map(comeTaglio))].join('; ')}): ne contiene solo una parte. L'elenco intero si esporta dal modulo del gestionale.` };
    }
    return avvisoIncerto ? { ...f, parziale: avvisoIncerto } : f;
  });
}

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
