// Lo stato degli archivi: fino a che giorno arrivano i dati, e il rinvio dei
// conti che si salvano mentre un archivio si sta riscrivendo.
//
// Due cose che servono in piu' posti (chiusura dell'audit, 11/10/2026):
//
// - DATI FINO AL. Il giorno del caricamento non dice fino a dove arrivano i dati:
//   un file caricato il 9 puo' fermarsi al 6. Finora lo sapeva solo EcoTyna
//   (strumento «caricamenti», in strumentiAssistente.ts); da qui lo legge anche
//   la dashboard, che lo mostra accanto al giorno del caricamento.
// - IL RINVIO. Chi salva un conto calcolato sui movimenti (passiva congelata,
//   fatturazione attiva, chiusura dell'anno, prefattura, fotografia del giorno)
//   non lo salva mentre un caricamento di un archivio che legge e' in corso,
//   interrotto o non riuscito: risponde 409 «rinviato» col motivo, come gia'
//   facevano verifiche, quadrature e alert. La regola su che cosa vuol dire «in
//   corso o interrotto» e' una sola, in registroCaricamenti.ts, e li' stanno
//   anche gli archivi che legge ciascun conto.
import { giornoRoma } from "./giornoItaliano.ts";
import { nostraRiga } from "./giacenzaPortale.ts";
import { statoCaricamenti, caricamentiDuranteLettura, descriviCaricamento } from "./reportSettimanali.ts";
import { TIPI_ATTIVA, TIPI_PASSIVA, TIPI_PREFATTURA, TIPI_CHIUSURA, TIPI_GIACENZE } from "./registroCaricamenti.ts";

// === Fino a che giorno arrivano i dati ===
//
// Per ogni archivio l'ultimo giorno che c'e' dentro, sul giorno italiano: per i
// movimenti l'ultima fine trasporto dei terminati, per il file dei non
// dichiarati il giorno della fotografia, per il report delle dichiarazioni
// l'ultima dichiarazione, per gli assegnati l'ultimo ordine immesso. Una lettura
// ordinata per archivio, di pochi record: non si legge mai l'archivio intero (il
// limite di richieste vale per tutta l'app).
//
// L'elenco e la lettura vengono da EcoTyna (10/10/2026), uguali: tipo_file dice
// da quale file del Caricamento Dati arriva l'archivio.
export const ARCHIVI_FINO_AL = [
  { archivio: 'primarie di rete', tipo_file: 'primarie', entita: 'PrimariaRete', campo: 'trasporto_finito_il', cosa: 'ultima fine trasporto dei terminati', filtro: { stato: 'terminato' } },
  { archivio: 'primarie ACI', tipo_file: 'primarie', entita: 'PrimariaAci', campo: 'trasporto_finito_il', cosa: 'ultima fine trasporto dei terminati', filtro: { stato: 'terminato' } },
  { archivio: 'secondarie', tipo_file: 'secondarie', entita: 'Secondaria', campo: 'trasporto_finito_il', cosa: 'ultima fine trasporto dei terminati', filtro: { stato: 'terminato' } },
  { archivio: 'terziarie', tipo_file: 'terziarie', entita: 'Terziaria', campo: 'trasporto_finito_il', cosa: 'ultima fine trasporto dei terminati', filtro: { stato: 'terminato' } },
  { archivio: 'extra raccolta', tipo_file: 'extra_raccolta', entita: 'ExtraRaccolta', campo: 'trasporto_finito_il', cosa: 'ultima fine trasporto dei terminati', filtro: { stato: 'terminato' } },
  { archivio: 'ordini non dichiarati (fotografia del portale)', tipo_file: 'ordini_non_dichiarati', entita: 'OrdineNonDichiarato', campo: 'created_date', cosa: 'giorno della fotografia', filtro: null },
  // SOLO LE RIGHE NOSTRE (11/10/2026). Il report delle dichiarazioni porta anche
  // quelle degli altri partner operativi, a volte sulle nostre stesse
  // destinazioni (Baucina su Irigom): una loro dichiarazione piu' recente
  // spostava il «fino al» del report, mentre riepilogoDichiarazioni quelle righe
  // le scarta con nostraRiga. Qui si fa lo stesso.
  { archivio: 'report delle dichiarazioni di trattamento', tipo_file: 'dichiarazioni_trattamento', entita: 'DichiarazioneTrattamento', campo: 'data_dichiarazione', cosa: 'ultima dichiarazione del partner operativo SMOCO', filtro: null, tiene: nostraRiga },
  { archivio: 'assegnati di rete', tipo_file: 'primarie', entita: 'Assegnato', campo: 'ordine_immesso_il', cosa: 'ultimo ordine immesso', filtro: null },
  { archivio: 'assegnati ACI', tipo_file: 'primarie', entita: 'AssegnatoAci', campo: 'ordine_immesso_il', cosa: 'ultimo ordine immesso', filtro: null },
];

// Gli archivi del riquadro della dashboard: uno o due per file caricato. Gli
// assegnati e l'extra raccolta no: l'extra raccolta non arriva da un file, e per
// «Primarie e assegnati» il giorno che conta e' la fine trasporto (regola 1).
export const ARCHIVI_DEL_CRUSCOTTO = ['PrimariaRete', 'PrimariaAci', 'Secondaria', 'Terziaria', 'OrdineNonDichiarato', 'DichiarazioneTrattamento'];

// Per il report delle dichiarazioni si va a pagine, con un tetto: se nel tetto
// non c'e' nessuna riga nostra lo si dice invece di chiamarlo vuoto.
const TETTO_NOSTRE = 1000;

// created_date arriva in UTC senza la Z finale: la si rimette, come per il registro.
const conZ = (v) => String(v).replace(/(Z|[+-]\d{2}:?\d{2})?$/, 'Z');

// Il giorno ('AAAA-MM-GG'); null se l'archivio e' vuoto; undefined se la lettura
// non riesce; { altrui, lette, tutte } se ci sono righe ma nessuna nostra.
async function ultimoGiorno(svc, { entita, campo, filtro, tiene }) {
  try {
    const pagina = tiene ? 50 : 5;
    const fino = tiene ? TETTO_NOSTRE : pagina;
    let lette = 0;
    let altrui = 0;
    for (let salta = 0; salta < fino; salta += pagina) {
      const righe = (filtro ? await svc[entita].filter(filtro, `-${campo}`, pagina, salta) : await svc[entita].list(`-${campo}`, pagina, salta)) || [];
      lette += righe.length;
      const tenute = tiene ? righe.filter(r => r && tiene(r)) : righe;
      altrui += righe.length - tenute.length;
      const giorni = tenute.map(r => r && r[campo]).filter(Boolean)
        .map(v => (campo === 'created_date' ? giornoRoma(conZ(v)) : giornoRoma(v)) || String(v).slice(0, 10)).filter(Boolean).sort();
      if (giorni.length) return giorni[giorni.length - 1];
      if (righe.length < pagina) break;
    }
    return altrui ? { altrui, lette, tutte: lette < fino } : null;
  } catch (_e) { return undefined; }
}

/**
 * Fino a che giorno arrivano i dati, archivio per archivio. svc sono le entita'
 * (base44.asServiceRole.entities); entita, se c'e', limita la lettura a quegli
 * archivi (la dashboard: ARCHIVI_DEL_CRUSCOTTO). Ogni voce:
 * { archivio, entita, tipo_file, dati_fino_al, cosa } piu', se serve,
 * vuoto, lettura_non_riuscita, oppure nessuna_riga_nostra con l'avviso.
 */
export async function datiFinoAl(svc, entita = null) {
  const elenco = entita ? ARCHIVI_FINO_AL.filter(a => entita.includes(a.entita)) : ARCHIVI_FINO_AL;
  return Promise.all(elenco.map(async (a) => {
    const giorno = await ultimoGiorno(svc, a);
    const voce = { archivio: a.archivio, entita: a.entita, tipo_file: a.tipo_file, cosa: a.cosa };
    if (giorno && typeof giorno === 'object') {
      return {
        ...voce, dati_fino_al: null, nessuna_riga_nostra: true,
        avviso: `${giorno.tutte ? `Nelle ${giorno.lette} righe dell'archivio` : `Fra le ultime ${giorno.lette} righe`} non ce n'e' nessuna del partner operativo SMOCO: le altre sono di altri partner e non contano. La data non si puo' dire, e non vuol dire che l'archivio sia vuoto.`,
      };
    }
    return { ...voce, dati_fino_al: giorno === undefined ? null : giorno, ...(giorno === undefined ? { lettura_non_riuscita: true } : giorno === null ? { vuoto: true } : {}) };
  }));
}

/**
 * Il «fino al» di ogni file del riquadro della dashboard: il giorno piu' avanti
 * fra i suoi archivi (le primarie sono rete e ACI nello stesso file). Contano
 * solo gli archivi del riquadro (ARCHIVI_DEL_CRUSCOTTO): l'ultimo ordine
 * assegnato arriva con le primarie ma misura un'altra cosa, e mescolato alla
 * fine trasporto la sposterebbe in avanti. Senza nessun giorno leggibile, null
 * con il perche'. { tipo_file: { fino_al, cosa, perche } }
 */
export function finoAlPerTipo(voci) {
  const out = {};
  for (const v of voci || []) {
    const t = v.tipo_file;
    if (!t || (v.entita && !ARCHIVI_DEL_CRUSCOTTO.includes(v.entita))) continue;
    const prima = out[t];
    if (v.dati_fino_al && (!prima || !prima.fino_al || v.dati_fino_al > prima.fino_al)) {
      out[t] = { fino_al: v.dati_fino_al, cosa: v.cosa, perche: '' };
      continue;
    }
    if (!prima) {
      out[t] = {
        fino_al: null, cosa: v.cosa,
        perche: v.nessuna_riga_nostra ? (v.avviso || '') : v.lettura_non_riuscita ? 'La lettura dell\'archivio non e\' riuscita.' : v.vuoto ? 'Nell\'archivio non c\'e\' nessuna riga.' : '',
      };
    }
  }
  return out;
}

// === Il rinvio dei conti che si salvano ===
//
// OGNI CONTO RINVIA SOLO SUGLI ARCHIVI CHE LEGGE (chiusura dell'audit,
// 11/10/2026). All'inizio i tipi erano gli stessi per tutte e cinque le
// funzioni (primarie, secondarie e terziarie): una riscrittura delle secondarie
// finita parziale fermava l'elaborazione dell'attiva, che le secondarie non le
// legge, e delle terziarie rimaste aperte da ieri fermavano anche il
// congelamento della passiva. Ora ciascuna passa i suoi tipi, presi da qui; il
// guardiano notturno (riepilogoDichiarazioni) legge movimenti, fotografia del
// portale e report delle dichiarazioni, e passa TIPI_GIACENZE.
export const TIPI_RINVIO = {
  attiva: TIPI_ATTIVA,
  passiva: TIPI_PASSIVA,
  prefattura: TIPI_PREFATTURA,
  chiusura: TIPI_CHIUSURA,
  fotografia: TIPI_GIACENZE,
};
// Il vecchio nome, per chi non dice che cosa legge: tutti i movimenti.
export const TIPI_CARICAMENTO_CONTI = TIPI_CHIUSURA;

/**
 * La risposta 409 «rinviato», col motivo: chi e' il caricamento, e che cosa
 * fare. extra si aggiunge alla risposta; se e' una funzione riceve il motivo.
 */
export function rispostaRinviata(cosa, caricamenti, extra = {}) {
  const daRicaricare = caricamenti.some(a => a.interrotto || a.esito === 'errore' || a.non_riuscito);
  const motivo = `Caricamento ${caricamenti.map(descriviCaricamento).join('; ')}.`;
  return Response.json({
    error: `Rinviato, non è stato salvato niente: ${cosa} si fa su archivi interi. ${motivo} `
      + (daRicaricare ? 'Ricarica il file, poi riprova.' : 'Riprova a caricamento concluso.'),
    rinviato: true,
    caricamenti_in_corso: caricamenti,
    ...(typeof extra === 'function' ? extra(motivo) : extra),
  }, { status: 409 });
}

/**
 * Il controllo, PRIMA e DOPO aver letto gli archivi, come in controlloQualifiche
 * e nei motori: un caricamento che parte mentre si legge, con una lettura sola
 * fatta prima, non si vedrebbe. L'uso:
 *
 *   const controllo = await controlloCaricamenti(base44, 'il congelamento della passiva', TIPI_RINVIO.passiva);
 *   if (controllo.rinvio) return controllo.rinvio;
 *   ... si leggono gli archivi ...
 *   const rinvio = await controllo.dopo();
 *   if (rinvio) return rinvio;
 *   ... si scrive ...
 */
export async function controlloCaricamenti(base44, cosa, tipi = TIPI_CARICAMENTO_CONTI, extra = {}) {
  // Un conto che non legge archivi caricati da file (il solo canale dell'extra
  // raccolta, tipiDeiCanali) non ha niente da aspettare.
  if (!tipi || !tipi.length) return { prima: null, rinvio: null, async dopo() { return null; } };
  const prima = await statoCaricamenti(base44, tipi);
  return {
    prima,
    rinvio: prima.in_corso.length ? rispostaRinviata(cosa, prima.in_corso, extra) : null,
    async dopo() {
      const durante = caricamentiDuranteLettura(prima, await statoCaricamenti(base44, tipi));
      return durante.length ? rispostaRinviata(cosa, durante, extra) : null;
    },
  };
}
