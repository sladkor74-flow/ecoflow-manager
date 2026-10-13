// I PUNTI CHE CAMBIANO IN UN CONTRATTO AI FORNITORI, E DA DOVE VENGONO I VALORI
// (giro K3 delle segnalazioni del 20/09, corretto il 12/10/2026).
//
// Decisione dell'utente dell'11/10/2026, testuale: «si deve generare tutti i
// contratti sia rete che aci come raccolta, trattamento e stoccaggio (poi crea un
// posto dove caricarti i vari format affinche' tu possa compilarli seguendo
// quello schema ed inserendo solo le cose che variano ovvero i dati del
// fornitore, le quantita' annue, il prezzo concordato, le date di validita',
// ecc...)».
//
// Qui stanno le regole che servono sia alla funzione contrattiAnno (che propone
// i valori) sia alle pagine (che riconoscono i punti in un format e scrivono il
// documento): il catalogo dei punti, come si scrive nel testo un valore (una
// data «02 Gennaio 2026» o «01/06/2026», un prezzo «70,00», una quantita'
// «1.050»), e da dove viene ciascun valore. Specchio: src/lib/segnapostiContratto.js.
//
// I valori vengono dai dati del gestionale e non s'inventano: il prezzo dalla
// tariffa passiva del fornitore valida nell'anno, la quantita' dal target, i
// dati del fornitore dall'anagrafica, il resto dal contratto dell'anno prima. Un
// valore che il gestionale non ha resta vuoto e si dice: nel documento il
// segnaposto rimane visibile, mai uno zero al posto di un numero che non c'e'.

/**
 * Il catalogo dei punti che cambiano da un contratto all'altro. tipo dice come
 * si scrive il valore nel documento (data, anno, quantita', prezzo, testo);
 * categoria raggruppa i punti nella proposta. I nomi dei segnaposto sono quelli
 * dei modelli fatti prima (TARGET_TON, QUOTA_TON, CORRISPETTIVO_*, PAGAMENTO):
 * un modello caricato con i nomi vecchi continua a funzionare.
 */
export const PUNTI_CONTRATTO = [
  { segnaposto: 'FORNITORE_RAGIONE_SOCIALE', nome: 'Ragione sociale del fornitore', categoria: 'fornitore', tipo: 'testo' },
  { segnaposto: 'FORNITORE_SEDE_LEGALE', nome: 'Sede legale', categoria: 'fornitore', tipo: 'testo' },
  { segnaposto: 'FORNITORE_SEDE_OPERATIVA', nome: 'Sede operativa', categoria: 'fornitore', tipo: 'testo' },
  { segnaposto: 'FORNITORE_PIVA', nome: 'Partita IVA', categoria: 'fornitore', tipo: 'testo' },
  { segnaposto: 'FORNITORE_CF', nome: 'Codice fiscale', categoria: 'fornitore', tipo: 'testo' },
  { segnaposto: 'FORNITORE_CCIAA', nome: 'Registro delle imprese (camera di commercio)', categoria: 'fornitore', tipo: 'testo' },
  { segnaposto: 'FORNITORE_REA', nome: 'Iscrizione alla camera di commercio (REA)', categoria: 'fornitore', tipo: 'testo' },
  { segnaposto: 'FORNITORE_RAPPRESENTANTE', nome: 'Legale rappresentante', categoria: 'fornitore', tipo: 'testo' },
  { segnaposto: 'FORNITORE_QUALIFICA', nome: 'Carica del legale rappresentante', categoria: 'fornitore', tipo: 'testo' },
  { segnaposto: 'FORNITORE_EMAIL', nome: 'Email del fornitore', categoria: 'fornitore', tipo: 'testo' },
  { segnaposto: 'FORNITORE_TEL', nome: 'Telefono del fornitore', categoria: 'fornitore', tipo: 'testo' },
  // Due punti che nascono dal lettore dei format (src/lib/modelliContratto.js,
  // revisione del 13/10/2026): il referente «per il Vettore: sig. …» e i numeri
  // d'iscrizione del vettore (albo, REN), con i loro _2 e _3. Nel catalogo
  // stanno fra i dati del fornitore anche per chi li sceglie a mano in «Modelli
  // dei contratti», e non fra gli «altri punti».
  { segnaposto: 'FORNITORE_REFERENTE', nome: 'Referente del fornitore', categoria: 'fornitore', tipo: 'testo' },
  { segnaposto: 'FORNITORE_ISCRIZIONE', nome: 'Numero d\'iscrizione del fornitore', categoria: 'fornitore', tipo: 'testo' },
  // Gli altri dati d'iscrizione del vettore che il lettore segna da controllare
  // nei contratti di trasporto compilati (ultimo giro della revisione del
  // 13/10/2026): la data o gli estremi dell'iscrizione, la provincia dell'albo
  // degli autotrasportatori, la classe dell'albo gestori. Col nome e la
  // categoria che gli da' il lettore, anche per i loro _2 e _3.
  { segnaposto: 'FORNITORE_ISCRIZIONE_DATA', nome: 'Data ed estremi dell\'iscrizione del fornitore', categoria: 'fornitore', tipo: 'testo' },
  { segnaposto: 'FORNITORE_ALBO_PROVINCIA', nome: 'Provincia dell\'albo degli autotrasportatori del fornitore', categoria: 'fornitore', tipo: 'testo' },
  { segnaposto: 'FORNITORE_ALBO_CLASSE', nome: 'Classe d\'iscrizione del fornitore all\'albo gestori ambientali', categoria: 'fornitore', tipo: 'testo' },
  { segnaposto: 'DATA_INIZIO', nome: 'Inizio di validità', categoria: 'date', tipo: 'data' },
  { segnaposto: 'DATA_FINE', nome: 'Fine di validità', categoria: 'date', tipo: 'data' },
  { segnaposto: 'DATA_FIRMA', nome: 'Data della firma', categoria: 'date', tipo: 'data' },
  { segnaposto: 'ANNO', nome: 'Anno del contratto', categoria: 'date', tipo: 'anno' },
  { segnaposto: 'TARGET_TON', nome: 'Quantità annua (t)', categoria: 'economico', tipo: 'quantita' },
  { segnaposto: 'QUOTA_TON', nome: 'Quantità annua (t)', categoria: 'economico', tipo: 'quantita' },
  { segnaposto: 'CORRISPETTIVO_RACCOLTA', nome: 'Prezzo della raccolta (€/t)', categoria: 'economico', tipo: 'prezzo' },
  { segnaposto: 'CORRISPETTIVO_STOCCAGGIO', nome: 'Prezzo dello stoccaggio (€/t)', categoria: 'economico', tipo: 'prezzo' },
  { segnaposto: 'CORRISPETTIVO_TRATTAMENTO', nome: 'Prezzo del trattamento (€/t)', categoria: 'economico', tipo: 'prezzo' },
  { segnaposto: 'CORRISPETTIVO_PMG1', nome: 'Prezzo del trattamento, classi P, M e G1 (€/t)', categoria: 'economico', tipo: 'prezzo' },
  { segnaposto: 'CORRISPETTIVO_P', nome: 'Prezzo del trattamento, classe P (€/t)', categoria: 'economico', tipo: 'prezzo' },
  { segnaposto: 'CORRISPETTIVO_M', nome: 'Prezzo del trattamento, classe M (€/t)', categoria: 'economico', tipo: 'prezzo' },
  { segnaposto: 'CORRISPETTIVO_G1', nome: 'Prezzo del trattamento, classe G1 (€/t)', categoria: 'economico', tipo: 'prezzo' },
  { segnaposto: 'CORRISPETTIVO_G2', nome: 'Prezzo del trattamento, classe G2 (€/t)', categoria: 'economico', tipo: 'prezzo' },
  { segnaposto: 'CORRISPETTIVO_TRASPORTO', nome: 'Prezzo del trasporto', categoria: 'economico', tipo: 'prezzo' },
  { segnaposto: 'CONTRIBUTO_NON_CONCORRENZA', nome: 'Contributo di non concorrenza (€/t)', categoria: 'economico', tipo: 'prezzo' },
  { segnaposto: 'PAGAMENTO', nome: 'Termini di pagamento', categoria: 'condizioni', tipo: 'testo' },
  { segnaposto: 'MODALITA_PAGAMENTO', nome: 'Modalità di pagamento', categoria: 'condizioni', tipo: 'testo' },
  { segnaposto: 'POLIZZA_RC', nome: 'Massimale della polizza RC', categoria: 'condizioni', tipo: 'testo' },
];

export const CATEGORIE_PUNTI = {
  fornitore: 'Dati del fornitore',
  date: 'Date e anno',
  economico: 'Quantità e prezzi',
  condizioni: 'Condizioni',
  altro: 'Altri punti',
};

/**
 * La voce del catalogo di un segnaposto; uno che il catalogo non conosce e' un
 * testo libero. Un secondo prezzo dello stesso tipo nello stesso format
 * (CORRISPETTIVO_RACCOLTA_2) e' un prezzo come il primo.
 */
export function puntoDi(segnaposto) {
  const s = String(segnaposto || '').trim();
  const voce = PUNTI_CONTRATTO.find(p => p.segnaposto === s);
  if (voce) return voce;
  const numero = s.match(/_(\d+)$/);
  const base = numero ? PUNTI_CONTRATTO.find(p => p.segnaposto === s.slice(0, numero.index)) : null;
  if (base) return { ...base, segnaposto: s, nome: `${base.nome} (${numero[1]}°)` };
  return { segnaposto: s, nome: s.replace(/_/g, ' ').toLowerCase(), categoria: 'altro', tipo: 'testo' };
}

// I punti dei prezzi: il loro valore di partenza in un format e' un costo, e
// nel modello non si conserva (il modello lo legge chiunque sia collegato,
// i costi solo l'amministratore).
export const ePrezzo = (segnaposto) => puntoDi(segnaposto).tipo === 'prezzo';

// I punti che nel contratto dell'anno nuovo non si riprendono dall'anno prima:
// date, anno, quantita' e prezzi si ricalcolano (calendario, target, tariffe).
// Ripresi tali e quali sarebbero valori vecchi spacciati per nuovi.
const SI_RICALCOLANO = /^(DATA_|ANNO$|TARGET_TON$|QUOTA_TON$|QUANTITA|CORRISPETTIVO_|LUOGO_DATA_FIRMA$)/;

// Il nome da solo non basta (revisione del 13/10/2026): CONTRIBUTO_NON_CONCORRENZA
// e' un prezzo del catalogo ma non comincia per CORRISPETTIVO_, e passava dal
// contratto dell'anno prima a quello nuovo come valore proposto. Si guarda anche
// il tipo del punto: un prezzo, una quantita', una data o un anno si ricalcolano
// sempre, comunque si chiamino (anche i secondi, TARGET_TON_2).
const siRicalcola = (k) => SI_RICALCOLANO.test(k) || ['prezzo', 'quantita', 'data', 'anno'].includes(puntoDi(k).tipo);

// ─── come si scrive un valore nel testo ───

export const MESI_CONTRATTO = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const isoValido = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '').slice(0, 10)) && String(v || '').length >= 10;

/**
 * Lo stile di una data com'e' scritta nel format, per riscrivere la data nuova
 * allo stesso modo: «02 Gennaio 2026» (giorno a due cifre, mese maiuscolo),
 * «2 gennaio 2026», «1° aprile 2026», «01/06/2026», «01.01.2026».
 */
export function stileDellaData(testo) {
  const t = String(testo || '').replace(/\s+/g, ' ').trim();
  let m = t.match(/^(\d{1,2})(°?)\s?([A-Za-zÀ-ÿ]+)\s(\d{4})$/);
  if (m) return { forma: 'lunga', zero: m[1].length === 2, maiuscola: /^[A-ZÀ-Þ]/.test(m[3]), ordinale: m[2] === '°' };
  m = t.match(/^(\d{1,2})([/.-])(\d{1,2})\2(\d{4})$/);
  if (m) return { forma: 'numerica', zero: m[1].length === 2, sep: m[2] };
  return null;
}

/** Una data aaaa-mm-gg scritta nello stile dato; senza stile, gg/mm/aaaa come i modelli di prima. */
export function scriviData(iso, stile = null) {
  const s = String(iso || '').slice(0, 10);
  if (!isoValido(s)) return '';
  const anno = s.slice(0, 4);
  const mese = Number(s.slice(5, 7));
  const giorno = Number(s.slice(8, 10));
  const st = stile || { forma: 'numerica', zero: true, sep: '/' };
  if (st.forma === 'numerica') {
    const sep = st.sep || '/';
    const g = st.zero === false ? String(giorno) : String(giorno).padStart(2, '0');
    const me = st.zero === false ? String(mese) : String(mese).padStart(2, '0');
    return `${g}${sep}${me}${sep}${anno}`;
  }
  let nomeMese = MESI_CONTRATTO[mese - 1] || '';
  if (st.maiuscola && nomeMese) nomeMese = nomeMese[0].toUpperCase() + nomeMese.slice(1);
  const g = giorno === 1 && st.ordinale ? '1°' : (st.zero ? String(giorno).padStart(2, '0') : String(giorno));
  return `${g} ${nomeMese} ${anno}`;
}

/** Legge una data scritta in un contratto («02 Gennaio 2026», «01/06/2026», «1° aprile 2026») e la da' come aaaa-mm-gg. */
export function leggiData(testo) {
  const t = String(testo || '').replace(/\s+/g, ' ').trim().toLowerCase();
  let m = t.match(/^(\d{1,2})°?\s?([a-zà-ÿ]+)\s(\d{4})$/);
  if (m) {
    const mese = MESI_CONTRATTO.indexOf(m[2]) + 1;
    if (!mese) return '';
    return `${m[3]}-${String(mese).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
  }
  m = t.match(/^(\d{1,2})([/.-])(\d{1,2})\2(\d{4})$/);
  if (m) return `${m[4]}-${String(Number(m[3])).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
  return '';
}

/** Un numero scritto all'italiana («1.050», «70,00», «1.500.000,00», «279,62»), oppure null. */
export function leggiNumeroItaliano(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v ?? '').replace(/[€\s]/g, '').replace(/euro/ig, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const conMigliaia = (intero) => String(intero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Una quantita' come la scrivono i contratti: «300», «1.050», «279,62». */
export function scriviQuantita(n) {
  const v = leggiNumeroItaliano(n);
  if (v === null) return '';
  const arrotondato = Math.round(v * 1000) / 1000;
  const [intero, decimali] = String(Math.abs(arrotondato)).split('.');
  return `${arrotondato < 0 ? '-' : ''}${conMigliaia(intero)}${decimali ? ',' + decimali : ''}`;
}

/** Un prezzo con due decimali: «70,00», «1.500,00». */
export function scriviPrezzo(n) {
  const v = leggiNumeroItaliano(n);
  if (v === null) return '';
  const [intero, decimali] = Math.abs(v).toFixed(2).split('.');
  return `${v < 0 ? '-' : ''}${conMigliaia(intero)},${decimali}`;
}

/**
 * Il valore di un segnaposto come va scritto nel documento. punto e' la voce del
 * modello (col suo stile, per le date); senza, vale il catalogo.
 */
export function valoreNelDocumento(segnaposto, valore, punto = null) {
  if (valore === undefined || valore === null || valore === '') return '';
  const tipo = (punto && punto.tipo) || puntoDi(segnaposto).tipo;
  if (tipo === 'data') return isoValido(valore) ? scriviData(valore, punto && punto.stile) : String(valore);
  if (tipo === 'anno') return String(valore);
  if (tipo === 'quantita') {
    const s = scriviQuantita(valore);
    return s || String(valore);
  }
  if (tipo === 'prezzo') {
    const s = scriviPrezzo(valore);
    return s || String(valore);
  }
  return String(valore);
}

/**
 * Tutti i valori pronti per il documento: ogni segnaposto scritto come vuole il
 * modello. Per i modelli di prima, che le date le avevano in tre forme
 * (DATA_INIZIO_IT, DATA_INIZIO_LUNGA), si aggiungono anche quelle, e si
 * ricalcolano SEMPRE dalla data: i contratti generati prima del 12/10/2026 hanno
 * DATA_INIZIO_LUNGA salvata fra i valori, e tenendola si sarebbe scritta la data
 * vecchia accanto a quella nuova.
 */
export function valoriPerIlDocumento(valori, punti = []) {
  const perNome = new Map((punti || []).map(p => [p.segnaposto, p]));
  const out = {};
  for (const [k, v] of Object.entries(valori || {})) {
    const s = valoreNelDocumento(k, v, perNome.get(k) || null);
    if (s !== '') out[k] = s;
  }
  for (const k of ['DATA_INIZIO', 'DATA_FINE', 'DATA_FIRMA']) {
    const v = valori && valori[k];
    if (!isoValido(v)) continue;
    out[`${k}_IT`] = scriviData(v, { forma: 'numerica', zero: true, sep: '/' });
    out[`${k}_LUNGA`] = scriviData(v, { forma: 'lunga' });
  }
  return out;
}

// ─── da dove vengono i valori ───

/** La sede come la scrivono i contratti: «Via Roma 1, 74016 Massafra (TA)». */
export function sedeDiAnagrafica(f) {
  if (!f) return '';
  const via = String(f.indirizzo || '').trim();
  const luogo = [String(f.cap || '').trim(), String(f.comune || '').trim()].filter(Boolean).join(' ');
  const prov = String(f.provincia || '').trim();
  const dopo = [luogo, prov ? `(${prov})` : ''].filter(Boolean).join(' ');
  return [via, dopo].filter(Boolean).join(', ');
}

const giornoLeggibile = (g) => {
  const s = String(g || '').slice(0, 10);
  return isoValido(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s;
};

/** Dove vale una tariffa, detto a parole: «verso GATIM», «in Basilicata», «classe G2», «dal 01/09/2026». */
export function doveVale(t) {
  const parti = [];
  if (t.classe_materiale) parti.push(`classe ${t.classe_materiale}`);
  if (t.destinazione) parti.push(`verso ${t.destinazione}`);
  if (t.produttore || t.destinatario) parti.push(`tratta ${t.produttore || '?'} → ${t.destinatario || '?'}`);
  if (t.provincia) parti.push(`provincia ${t.provincia}`);
  else if (t.regione) parti.push(`in ${t.regione}`);
  if (t.data_inizio_validita && !/-01-0[12]$/.test(String(t.data_inizio_validita).slice(0, 10))) parti.push(`dal ${giornoLeggibile(t.data_inizio_validita)}`);
  return parti.join(', ');
}

const prezzoLeggibile = (t) => `${scriviPrezzo(t.valore)} ${t.unita_misura || '€/t'}${doveVale(t) ? ` (${doveVale(t)})` : ''}`;

const PREZZO_DEL_TIPO = {
  raccolta: 'CORRISPETTIVO_RACCOLTA',
  stoccaggio: 'CORRISPETTIVO_STOCCAGGIO',
  trasporto_secondaria: 'CORRISPETTIVO_TRASPORTO',
};

// L'avviso del prezzo unico di raccolta e trattamento (comprensiva_trattamento,
// Green Tyre sull'ACI): il trattamento non ha un contratto a parte, e il prezzo
// della raccolta lo comprende.
const AVVISO_PREZZO_UNICO = 'La tariffa di raccolta è un prezzo unico che comprende il trattamento.';

/**
 * I prezzi del contratto dalle tariffe passive gia' scelte per fornitore,
 * prestazione, canale e anno. Un prezzo si scrive solo quando e' uno: con piu'
 * prezzi (per zona, per destinazione, per tratta) il modello non sa quale
 * mettere e lo si dice, invece di sceglierne uno a caso. Un prezzo a viaggio o
 * al chilo non si scrive dove il contratto parla di tonnellate; un prezzo a zero
 * non si scrive come se fosse un prezzo.
 */
export function prezziDalleTariffe(tipo, tariffe) {
  const valori = {};
  const avvisi = [];
  const tutte = (tariffe || []).filter(t => t && t.valore !== undefined && t.valore !== null && t.valore !== '');
  const aTonnellata = tutte.filter(t => !t.unita_misura || t.unita_misura === '€/t');
  for (const t of tutte) {
    if (t.unita_misura && t.unita_misura !== '€/t') avvisi.push(`C'è un prezzo in ${t.unita_misura}: ${prezzoLeggibile(t)}. Il contratto lo scrive a tonnellata: va scritto a mano.`);
  }
  const buone = aTonnellata.filter(t => {
    if (Number(t.valore) > 0) return true;
    avvisi.push(`In anagrafica c'è un prezzo a zero (${prezzoLeggibile(t)}): non lo scrivo nel contratto, controllalo.`);
    return false;
  });
  const distinti = (l) => [...new Set(l.map(t => Number(t.valore)))];
  if (buone.some(t => t.comprensiva_trattamento)) avvisi.push(AVVISO_PREZZO_UNICO);

  if (tipo === 'trattamento') {
    const perClasse = {};
    for (const c of ['P', 'M', 'G1', 'G2']) {
      const proprie = buone.filter(t => t.classe_materiale === c);
      const lista = proprie.length ? proprie : buone.filter(t => !t.classe_materiale);
      const d = distinti(lista);
      if (d.length === 1) perClasse[c] = d[0];
      else if (d.length > 1) avvisi.push(`Classe ${c}: più prezzi (${lista.map(prezzoLeggibile).join('; ')}). Scegli tu quale scrivere.`);
    }
    for (const [c, v] of Object.entries(perClasse)) valori[`CORRISPETTIVO_${c}`] = v;
    const pmg1 = ['P', 'M', 'G1'].map(c => perClasse[c]);
    if (pmg1.every(v => v !== undefined) && new Set(pmg1).size === 1) valori.CORRISPETTIVO_PMG1 = pmg1[0];
    else if (pmg1.some(v => v !== undefined)) avvisi.push(`Le classi P, M e G1 non hanno lo stesso prezzo (${['P', 'M', 'G1'].map(c => `${c} ${perClasse[c] === undefined ? '—' : scriviPrezzo(perClasse[c])}`).join(', ')}): un modello con un prezzo solo per P, M e G1 va compilato a mano.`);
    const tutteQuattro = ['P', 'M', 'G1', 'G2'].map(c => perClasse[c]);
    if (tutteQuattro.every(v => v !== undefined) && new Set(tutteQuattro).size === 1) valori.CORRISPETTIVO_TRATTAMENTO = tutteQuattro[0];
    return { valori, avvisi };
  }

  const chiave = PREZZO_DEL_TIPO[tipo];
  if (!chiave) return { valori, avvisi };
  const d = distinti(buone);
  if (d.length === 1) valori[chiave] = d[0];
  else if (d.length > 1) avvisi.push(`Più prezzi nell'anno: ${buone.map(prezzoLeggibile).join('; ')}. Il modello ne ha uno solo: scegli tu quale scrivere, o aggiungi i punti al modello.`);
  return { valori, avvisi };
}

/**
 * Le date del contratto: dal 2 gennaio al 31 dicembre dell'anno, come i
 * contratti 2026; se il contratto dell'anno prima cominciava a gennaio, con lo
 * stesso giorno. Un contratto partito a meta' anno (l'ACI di Gatim dal 2 marzo,
 * quello di Emmesse dal 1 giugno) non sposta l'inizio dell'anno dopo: quella era
 * una decorrenza, non la regola.
 */
export function dateDelContratto(anno, precedente = null) {
  const inizioPrima = String((precedente && precedente.data_inizio) || '').slice(5, 10);
  const inizio = /^01-0[1-9]$|^01-[12]\d$|^01-3[01]$/.test(inizioPrima) ? inizioPrima : '01-02';
  return { DATA_INIZIO: `${anno}-${inizio}`, DATA_FINE: `${anno}-12-31` };
}

const vuoto = (v) => v === undefined || v === null || v === '';

// I recapiti del fornitore che un format puo' avere piu' volte (FORNITORE_TEL e
// FORNITORE_TEL_2, FORNITORE_EMAIL e FORNITORE_EMAIL_2) e il campo
// dell'anagrafica da cui vengono, quando l'anagrafica ce l'ha. Il lettore dei
// format numera i recapiti nell'ordine in cui li trova: nei format del 2026 il
// secondo telefono e' il cellulare e la seconda email la pec (revisione del
// 13/10/2026). Un campo che l'anagrafica non ha non da' niente: il valore viene
// dal contratto dell'anno prima, o resta da scrivere.
const RECAPITI_DALL_ANAGRAFICA = [
  ['FORNITORE_EMAIL', 'email'],
  ['FORNITORE_TEL', 'telefono'],
  ['FORNITORE_TEL_2', 'cellulare'],
  ['FORNITORE_EMAIL_2', 'pec'],
  ['FORNITORE_REFERENTE', 'referente'],
];
const famigliaDi = (k) => String(k).replace(/_\d+$/, '');
// Lo stesso recapito scritto in due modi: un'email senza maiuscole, un telefono
// per le sole cifre («099 123456» e «099/123456»).
const stessoRecapito = (a, b) => {
  const s = (v) => {
    const t = String(v ?? '').trim().toLowerCase();
    return t.includes('@') ? t : (t.replace(/\D/g, '') || t.replace(/\s+/g, ''));
  };
  return s(a) !== '' && s(a) === s(b);
};

/**
 * I valori proposti per il contratto di un fornitore, per tipo e canale, con la
 * fonte di ciascuno e gli avvisi. Non scrive niente: la funzione contrattiAnno
 * li manda alla pagina, che li mostra e li fa confermare.
 *
 * @param anno        l'anno del contratto
 * @param tipo        raccolta | stoccaggio | trattamento | trasporto_secondaria
 * @param canale      RETE | ACI
 * @param fornitore   il record dell'anagrafica, o null
 * @param precedente  { anno, valori, data_inizio } l'ultimo contratto prima di quest'anno, o null
 * @param target      { t, anno, copiato } la quantita' annua dal target, o null;
 *                    copiato: il target e' una copia di «Prepara l'anno» non ancora confermata
 * @param tariffe     le tariffe passive gia' scelte per quel contratto, confermate
 * @param tariffeCopiate le tariffe dell'anno copiate da «Prepara l'anno» e non
 *                    ancora confermate, col prezzo dell'anno prima: non sono il
 *                    prezzo, si dicono e basta
 * @param tariffeRiscritte le copie di «Prepara l'anno» che l'amministratore ha
 *                    riscritto col prezzo nuovo senza confermarle: sono il prezzo
 *                    dell'anno, e si dice che sono ancora da confermare
 * @param prezzoUnico la raccolta ha il prezzo unico che comprende il trattamento
 *                    (letto anche sulle copie e sull'anno prima): e' un fatto di
 *                    struttura, e l'avviso c'e' anche senza tariffe confermate
 */
export function valoriDelContratto({ anno, tipo, canale, fornitore = null, precedente = null, target = null, tariffe = [], tariffeCopiate = [], tariffeRiscritte = [], prezzoUnico = false }) {
  const valori = {};
  const fonti = {};
  const avvisi = [];
  const metti = (k, v, fonte) => { if (vuoto(v)) return; valori[k] = v; fonti[k] = fonte; };

  // 1. Dal contratto dell'anno prima: i dati del fornitore che l'anagrafica non
  //    ha (rappresentante, camera di commercio), le condizioni di pagamento, la
  //    polizza. Non le date, l'anno, le quantita' e i prezzi.
  const vecchi = (precedente && precedente.valori) || {};
  for (const [k, v] of Object.entries(vecchi)) if (!siRicalcola(k)) metti(k, v, 'precedente');

  // 2. Dall'anagrafica, che e' la fonte dei dati del fornitore.
  if (fornitore) {
    metti('FORNITORE_RAGIONE_SOCIALE', String(fornitore.ragione_sociale || '').trim(), 'anagrafica');
    metti('FORNITORE_PIVA', String(fornitore.piva || '').trim(), 'anagrafica');
    metti('FORNITORE_CF', String(fornitore.codice_fiscale || '').trim(), 'anagrafica');
    metti('FORNITORE_SEDE_LEGALE', sedeDiAnagrafica(fornitore), 'anagrafica');
    // I recapiti, anche il cellulare, la pec e il referente quando l'anagrafica
    // li ha (revisione del 13/10/2026). Un recapito che il contratto dell'anno
    // prima aveva gia' in un altro punto della stessa famiglia non si ripete:
    // la pec dell'anagrafica scritta anche come email avrebbe tolto l'email e
    // messo la pec due volte nel Word.
    for (const [k, campo] of RECAPITI_DALL_ANAGRAFICA) {
      const v = String(fornitore[campo] ?? '').trim();
      if (!v) continue;
      const altrove = Object.entries(valori).some(([k2, v2]) => k2 !== k && famigliaDi(k2) === famigliaDi(k) && stessoRecapito(v2, v));
      if (altrove && !vuoto(valori[k])) continue;
      metti(k, v, 'anagrafica');
    }
  } else {
    avvisi.push('Il fornitore non è in anagrafica: i suoi dati vengono solo dal contratto dell\'anno prima, se c\'è.');
  }

  // 3. Le date e l'anno.
  const date = dateDelContratto(anno, precedente);
  metti('DATA_INIZIO', date.DATA_INIZIO, 'calendario');
  metti('DATA_FINE', date.DATA_FINE, 'calendario');
  metti('DATA_FIRMA', date.DATA_INIZIO, 'calendario');
  metti('ANNO', String(anno), 'calendario');

  // 4. La quantita' annua dal target. L'ACI il target non ce l'ha: si scrive a mano.
  if (target && !vuoto(target.t)) {
    // Un target copiato da «Prepara l'anno» e' il target scritto per l'anno in
    // Target & Status, e si propone come quello dell'anno prima quando l'anno non
    // ne ha uno; ma la quantita' e' ancora quella vecchia e si dice (revisione del
    // 13/10/2026: arrivava come target dell'anno nuovo senza nessun avviso).
    const fonteTarget = target.copiato ? 'target_copiato' : 'target';
    metti('TARGET_TON', Number(target.t), fonteTarget);
    metti('QUOTA_TON', Number(target.t), fonteTarget);
    if (target.anno && Number(target.anno) !== Number(anno)) avvisi.push(`La quantità è il target del ${target.anno}: quello del ${anno} non è ancora scritto in Target & Status.`);
    if (target.copiato) avvisi.push(`Il target del ${target.anno || anno} è copiato dal ${Number(target.anno || anno) - 1} con «Prepara l'anno», da confermare: la quantità la decide il contratto.`);
  } else if (tipo !== 'trasporto_secondaria') {
    avvisi.push(canale === 'ACI'
      ? 'Sull\'ACI il gestionale non ha un target: la quantità annua va scritta a mano.'
      : `In Target & Status non c'è un target del ${anno} per questo fornitore: la quantità annua va scritta a mano.`);
  }

  // 5. I prezzi dalle tariffe passive valide nell'anno: le confermate e quelle
  //    riscritte col prezzo nuovo (revisione del 13/10/2026). Una copia di
  //    «Prepara l'anno» corretta a mano dalla finestra delle tariffe tiene la nota
  //    della copia finche' non si conferma in blocco: con 72 al posto del 70 del
  //    2026 non e' il prezzo dell'anno prima, e non proporla obbligava a
  //    ribatterlo, sotto un avviso che la diceva «copiata dal 2026».
  const riscritte = (tariffeRiscritte || []).filter(t => t && !vuoto(t.valore));
  const confermate = prezziDalleTariffe(tipo, tariffe).valori;
  const prezzi = prezziDalleTariffe(tipo, [...(tariffe || []), ...riscritte]);
  for (const [k, v] of Object.entries(prezzi.valori)) metti(k, v, confermate[k] === v ? 'tariffa' : 'tariffa_da_confermare');
  avvisi.push(...prezzi.avvisi);
  if (riscritte.length) {
    avvisi.push(`${riscritte.length === 1 ? 'Tariffa' : 'Tariffe'} ${riscritte.map(prezzoLeggibile).join('; ')} ${riscritte.length === 1 ? 'scritta' : 'scritte'} per il ${anno} ma ancora ${riscritte.length === 1 ? 'segnata' : 'segnate'} da confermare: ${riscritte.length === 1 ? 'confermala' : 'confermale'} in «Prepara l'anno».`);
  }
  // Il prezzo unico e' un fatto di struttura, non un prezzo (revisione del
  // 13/10/2026): la riga del trattamento dice «sta nel contratto di raccolta»
  // anche quando le tariffe dell'anno sono solo copie o mancano, e allora la
  // raccolta deve dire che il prezzo da scrivere comprende il trattamento.
  if (tipo === 'raccolta' && prezzoUnico && !avvisi.includes(AVVISO_PREZZO_UNICO)) avvisi.push(AVVISO_PREZZO_UNICO);
  // Le tariffe copiate da «Prepara l'anno» portano il prezzo dell'anno prima con
  // la nota «da confermare»: proporle come prezzo del contratto nuovo era
  // circolare, perche' la copia si conferma proprio sul contratto (revisione del
  // 13/10/2026: dopo la copia 23 contratti 2027 proponevano il prezzo del 2026).
  // Restano un riferimento, detto come tale.
  const copiate = (tariffeCopiate || []).filter(t => t && !vuoto(t.valore));
  if (copiate.length) {
    avvisi.push(`${copiate.length === 1 ? 'Tariffa' : 'Tariffe'} ${copiate.map(prezzoLeggibile).join('; ')} ${copiate.length === 1 ? 'copiata' : 'copiate'} dal ${Number(anno) - 1} con «Prepara l'anno», da confermare: il prezzo lo decide il contratto.`);
  }
  if (!(tariffe || []).length && !riscritte.length) {
    avvisi.push(copiate.length
      ? `Nel ${anno} non c'è ancora una tariffa passiva ${canale === 'ACI' ? 'ACI' : 'di rete'} confermata per questa prestazione: il prezzo va scritto a mano.`
      : `In anagrafica non c'è una tariffa passiva ${canale === 'ACI' ? 'ACI' : 'di rete'} valida nel ${anno} per questa prestazione: il prezzo va scritto a mano.`);
  }

  return { valori, fonti, avvisi };
}

/**
 * Il punto del modello che porta la quantita' annua, cioe' quella scritta nel
 * Word: TARGET_TON nella raccolta, QUOTA_TON negli altri contratti (come li
 * propone src/lib/modelliContratto.js). La proposta mette il target in tutti e
 * due, e un modello ne chiede uno: la pagina salvava sul contratto la prima
 * quantita' scritta fra i due, e correggendo QUOTA_TON nel trattamento restava
 * salvata quella nascosta in TARGET_TON. EcoTyna rispondeva con quella
 * (revisione del 13/10/2026). Un modello senza quantita' non ne scrive: null.
 */
export function campoDellaQuantita(tipo, segnaposti = []) {
  const elenco = new Set(segnaposti || []);
  const suo = tipo === 'raccolta' ? 'TARGET_TON' : 'QUOTA_TON';
  const altro = tipo === 'raccolta' ? 'QUOTA_TON' : 'TARGET_TON';
  if (elenco.has(suo)) return suo;
  if (elenco.has(altro)) return altro;
  return null;
}

/**
 * Da dove si parte riaprendo un contratto: dai valori del contratto dell'anno,
 * se e' gia' stato generato, altrimenti dalla proposta. Riaprendo un contratto
 * tornavano i valori dell'anno prima e si perdevano quelli scritti
 * (segnalazione del 20/09, corretta il 12/10/2026). Dalla proposta si prendono
 * solo i punti che il contratto salvato non ha (un modello nuovo con un punto in
 * piu'): un valore salvato, anche vuoto, resta quello.
 * @returns { valori, da: 'contratto' | 'proposta', salvati: [segnaposto] }
 */
export function valoriDiPartenza(riga) {
  const salvati = riga && riga.contratto && riga.contratto.valori;
  const proposti = (riga && riga.proposta && riga.proposta.valori) || {};
  if (salvati && typeof salvati === 'object' && Object.keys(salvati).length) {
    return { valori: { ...proposti, ...salvati }, da: 'contratto', salvati: Object.keys(salvati) };
  }
  return { valori: { ...proposti }, da: 'proposta', salvati: [] };
}
