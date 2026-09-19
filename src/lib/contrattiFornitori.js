// I contratti dei fornitori: tipi, campi e proposte per l'anno nuovo.
//
// Ogni anno i contratti si rifanno: cambiano le date, gli importi, le condizioni
// di pagamento e il quantitativo previsto. Il resto - articoli, obblighi,
// penali, foro - resta quello del modello. Qui stanno le regole di quello che
// cambia; il documento lo compone src/lib/docxModello.js.
//
// Rete, ACI ed extra raccolta hanno contratti distinti e non si sommano mai:
// il canale fa parte dell'identita' del contratto, non e' un dettaglio.

export const TIPI_CONTRATTO = [
  { chiave: 'raccolta', nome: 'Raccolta', ruolo: 'raccolta', prestazione: 'RACCOLTA' },
  { chiave: 'stoccaggio', nome: 'Stoccaggio', ruolo: 'stoccaggio', prestazione: 'CONFERIMENTO_STOCCAGGIO' },
  { chiave: 'trattamento', nome: 'Trattamento', ruolo: 'trattamento', prestazione: 'TRATTAMENTO' },
  { chiave: 'trasporto_secondaria', nome: 'Trasporto di secondaria', ruolo: 'trasporto_secondaria', prestazione: 'TRASPORTO_SECONDARIA' },
];

export const CANALI = [
  { chiave: 'RETE', nome: 'Rete' },
  { chiave: 'ACI', nome: 'ACI' },
  { chiave: 'EXTRA_RACCOLTA', nome: 'Extra raccolta' },
];

export const STATI_CONTRATTO = {
  mancante: { nome: 'Da fare', classe: 'border-muted bg-muted/40 text-muted-foreground' },
  bozza: { nome: 'Bozza', classe: 'border-slate-300 bg-slate-50 text-slate-700' },
  generato: { nome: 'Generato', classe: 'border-blue-200 bg-blue-50 text-blue-800' },
  inviato: { nome: 'Inviato', classe: 'border-amber-200 bg-amber-50 text-amber-800' },
  controfirmato: { nome: 'Controfirmato', classe: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  annullato: { nome: 'Annullato', classe: 'border-red-200 bg-red-50 text-red-800' },
};

export const nomeTipo = (t) => (TIPI_CONTRATTO.find(x => x.chiave === t) || {}).nome || t;
export const nomeCanale = (c) => (CANALI.find(x => x.chiave === c) || {}).nome || c;

// I campi che si chiedono sempre, qualunque sia il tipo di contratto.
export const CAMPI_COMUNI = [
  { chiave: 'DATA_INIZIO', nome: 'Data di inizio', tipo: 'data' },
  { chiave: 'DATA_FINE', nome: 'Data di fine', tipo: 'data' },
  { chiave: 'LUOGO_DATA_FIRMA', nome: 'Luogo e data della firma', tipo: 'testo' },
  { chiave: 'FORNITORE_RAGIONE_SOCIALE', nome: 'Ragione sociale del fornitore', tipo: 'testo' },
  { chiave: 'FORNITORE_PIVA', nome: 'Partita IVA', tipo: 'testo' },
  { chiave: 'FORNITORE_SEDE_LEGALE', nome: 'Sede legale', tipo: 'testo' },
  { chiave: 'FORNITORE_RAPPRESENTANTE', nome: 'Legale rappresentante', tipo: 'testo' },
  { chiave: 'FORNITORE_QUALIFICA', nome: 'Qualifica del rappresentante', tipo: 'testo' },
  { chiave: 'PAGAMENTO', nome: 'Condizioni di pagamento', tipo: 'testo_lungo' },
];

// Quello che cambia da un tipo all'altro: il quantitativo e i corrispettivi.
export const CAMPI_PER_TIPO = {
  raccolta: [
    { chiave: 'TARGET_TON', nome: 'Quantitativo previsto (t)', tipo: 'numero' },
    { chiave: 'CORRISPETTIVO_RACCOLTA', nome: 'Corrispettivo raccolta (€/t)', tipo: 'importo' },
    { chiave: 'CONTRIBUTO_NON_CONCORRENZA', nome: 'Contributo non concorrenza (€/t)', tipo: 'importo' },
    { chiave: 'POLIZZA_RC', nome: 'Massimale polizza RC', tipo: 'testo' },
  ],
  stoccaggio: [
    { chiave: 'QUOTA_TON', nome: 'Quantitativo previsto (t)', tipo: 'numero' },
    { chiave: 'CORRISPETTIVO_STOCCAGGIO', nome: 'Corrispettivo stoccaggio (€/t)', tipo: 'importo' },
    { chiave: 'NOME_IMPIANTO', nome: 'Impianto di destinazione', tipo: 'testo' },
    { chiave: 'POLIZZA_RC', nome: 'Massimale polizza RC', tipo: 'testo' },
  ],
  trattamento: [
    { chiave: 'QUOTA_TON', nome: 'Quantitativo previsto (t)', tipo: 'numero' },
    { chiave: 'CORRISPETTIVO_PMG1', nome: 'Corrispettivo classi P, M, G1 (€/t)', tipo: 'importo' },
    { chiave: 'CORRISPETTIVO_G2', nome: 'Corrispettivo classe G2 (€/t)', tipo: 'importo' },
    { chiave: 'TIPOLOGIA_TRATTAMENTO', nome: 'Tipologia di trattamento', tipo: 'testo' },
  ],
  trasporto_secondaria: [
    { chiave: 'QUOTA_TON', nome: 'Quantitativo previsto (t)', tipo: 'numero' },
    { chiave: 'PAGAMENTO_GIORNI', nome: 'Giorni di pagamento', tipo: 'numero' },
    { chiave: 'IBAN', nome: 'IBAN', tipo: 'testo' },
  ],
};

export const campiDi = (tipo) => [...CAMPI_COMUNI, ...(CAMPI_PER_TIPO[tipo] || [])];

const dueCifre = (n) => String(n).padStart(2, '0');

/** Le date proposte per l'anno nuovo: dal 2 gennaio al 31 dicembre. */
export function dateProposte(anno) {
  return { DATA_INIZIO: `${anno}-01-02`, DATA_FINE: `${anno}-12-31` };
}

export const dataIt = (iso) => (iso ? `${dueCifre(Number(String(iso).slice(8, 10)))}/${dueCifre(Number(String(iso).slice(5, 7)))}/${String(iso).slice(0, 4)}` : '');

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const dataLunga = (iso) => (iso ? `${Number(String(iso).slice(8, 10))} ${MESI[Number(String(iso).slice(5, 7)) - 1]} ${String(iso).slice(0, 4)}` : '');

/**
 * I valori di partenza per il contratto dell'anno nuovo.
 *
 * Si parte da quelli dell'anno prima, perche' quasi tutto resta uguale, e si
 * cambiano solo le date e cio' che il gestionale sa gia': la ragione sociale e i
 * dati del fornitore dall'anagrafica, il quantitativo previsto dal target.
 * Quello che cambia rispetto all'anno prima si segna, cosi' chi rilegge vede
 * subito dove mettere gli occhi.
 */
export function valoriProposti({ anno, precedente, fornitore, targetT }) {
  const vecchi = precedente && precedente.valori_json ? JSON.parse(precedente.valori_json) : {};
  const date = dateProposte(anno);
  const valori = { ...vecchi, ...date, ANNO: String(anno) };
  valori.DATA_INIZIO_LUNGA = dataLunga(date.DATA_INIZIO);
  valori.DATA_FINE_LUNGA = dataLunga(date.DATA_FINE);
  if (fornitore) {
    if (fornitore.ragione_sociale) valori.FORNITORE_RAGIONE_SOCIALE = fornitore.ragione_sociale;
    if (fornitore.piva) valori.FORNITORE_PIVA = fornitore.piva;
    if (fornitore.codice_fiscale) valori.FORNITORE_CF = fornitore.codice_fiscale;
    const sede = [fornitore.indirizzo, fornitore.cap, fornitore.comune, fornitore.provincia ? `(${fornitore.provincia})` : '']
      .filter(Boolean).join(' ');
    if (sede.trim()) valori.FORNITORE_SEDE_LEGALE = sede.trim();
    if (fornitore.email) valori.FORNITORE_EMAIL = fornitore.email;
    if (fornitore.telefono) valori.FORNITORE_TEL = fornitore.telefono;
  }
  if (targetT != null && targetT !== '') {
    const t = String(targetT).replace('.', ',');
    valori.TARGET_TON = t;
    valori.QUOTA_TON = t;
  }
  const cambiati = Object.keys(valori).filter(k => String(vecchi[k] ?? '') !== String(valori[k] ?? ''));
  return { valori, vecchi, cambiati };
}

/** Le date nei formati che i contratti usano, pronte per i segnaposto. */
export function completaDate(valori) {
  const v = { ...valori };
  if (v.DATA_INIZIO) { v.DATA_INIZIO_IT = dataIt(v.DATA_INIZIO); v.DATA_INIZIO_LUNGA = dataLunga(v.DATA_INIZIO); }
  if (v.DATA_FINE) { v.DATA_FINE_IT = dataIt(v.DATA_FINE); v.DATA_FINE_LUNGA = dataLunga(v.DATA_FINE); }
  // Nei contratti le date compaiono in italiano: il segnaposto delle date
  // riceve il formato giorno/mese/anno, non quello con cui si salvano.
  if (v.DATA_INIZIO) v.DATA_INIZIO = dataIt(valori.DATA_INIZIO);
  if (v.DATA_FINE) v.DATA_FINE = dataIt(valori.DATA_FINE);
  return v;
}

/** Il nome del file del contratto generato. */
export function nomeFileContratto({ anno, soggetto, tipo, canale }) {
  const pulito = String(soggetto || '').replace(/[\\/:*?"<>|]+/g, '-').trim();
  const c = canale && canale !== 'RETE' ? ` ${canale}` : '';
  return `Contratto ${nomeTipo(tipo)}${c} ${anno} - ${pulito}.docx`;
}
