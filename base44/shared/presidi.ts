// I PRESIDI DELLA NOTTE, NELL'ELENCO DELLE COSE DA GESTIRE (chiusura dell'audit,
// 11/10/2026).
//
// Due cose che la dashboard deve dire senza che nessuno apra una pagina:
// - un lavoro pianificato che non riesce piu' (il battito, shared/battito.ts):
//   «Il controllo delle qualifiche non riesce da 3 giorni», con l'ultimo errore;
// - un'identita' fra moduli che si e' rotta stanotte (shared/invarianti.ts), coi
//   due numeri e i due moduli: «Giacenze 275,08 t, Dichiarazioni 154,22 t».
//
// Le voci hanno il formato di quelle di shared/cruscotto.ts ({ area, gravita,
// titolo, dettaglio, link }) piu' una `chiave`, per chi le unisce all'elenco e non
// vuole dire due volte la stessa cosa.
//
// NESSUNA VOCE SE NON C'E' NIENTE. Un avviso che grida a zero insegna a ignorare
// quelli veri, ed e' peggio di un avviso che non c'e', perche' costa attenzione
// ogni giorno senza dire niente. Percio':
// - un lavoro senza nessuna riga non si giudica: la riga nasce al primo giro, e il
//   giorno della pubblicazione tutti i lavori sono senza riga;
// - un giro mancato non basta: ci vogliono `soglia` giri attesi dal cron e passati
//   senza una riuscita (due per i lavori di ogni giorno, sei per quelli di ogni
//   ora, uno per il controllo del mese), contati dopo un margine, perche' un lavoro
//   delle 5 non si giudica alle 5 e un minuto (per un lavoro mai riuscito conta
//   anche il primo giro, che e' fallito: vedi statoLavoro);
// - un passo che viene dopo un altro (il controllo delle identita' dopo la
//   fotografia) non si dice quando non ha avuto occasione: la causa e' una, e la
//   voce e' una, quella del passo prima;
// - un'identita' che non si e' potuta verificare non e' rotta: lo dice il battito
//   del controllo, che in quel caso non e' riuscito. Ma una che era rotta
//   all'ultima verifica resta rotta finche' una verifica non la trova a posto, e
//   si dice «non riverificata» (riportaRotte, invarianti.ts).
import { LAVORI, lavoroDi, giriAttesi, leggiCron } from "./battito.ts";
import { leggiInvarianti, tt, eRotta } from "./invarianti.ts";
import { giornoRoma } from "./giornoItaliano.ts";

const MINUTO = 60000;
const ORA = 60 * MINUTO;
// Dopo l'orario del cron, quanto si aspetta prima di dire che un giro e' mancato.
const MARGINE_ORARIO = 30 * MINUTO;
const MARGINE_GIORNALIERO = 90 * MINUTO;
// La partenza registrata e' qualche secondo dopo l'orario: questo la protegge da
// un orologio che anticipa.
const ANTICIPO = 5 * MINUTO;

const ORE_ROMA = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const ilGiorno = (g) => String(g || '').slice(0, 10).split('-').reverse().join('/');
// Le date della piattaforma arrivano in UTC senza la Z: la si rimette.
const conZ = (v) => (v && !/(Z|[+-]\d{2}:?\d{2})$/.test(String(v)) ? `${v}Z` : v);
const istante = (v) => { if (!v) return null; const ms = Date.parse(conZ(v)); return Number.isFinite(ms) ? ms : null; };
const quando = (ms) => `il ${ilGiorno(giornoRoma(ms))} alle ${ORE_ROMA.format(new Date(ms))}`;
const giorniFra = (daMs, aMs) => {
  const a = giornoRoma(daMs), b = giornoRoma(aMs);
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);
};

/**
 * Lo stato di un lavoro, dalla sua riga EsecuzioneLavoro. null se la riga non c'e'.
 * { daDire, base, riuscita, partenza, mancati, orario }
 */
export function statoLavoro(lavoro, riga, adessoMs) {
  if (!lavoro || !riga) return null;
  const partenza = istante(riga.ultima_partenza);
  const riuscita = istante(riga.ultima_riuscita);
  // Mai riuscito: da quando lascia traccia, cioe' dal primo giro registrato
  // (prima_partenza, battito.ts). Una riga che non l'ha si arrangia con la sua
  // nascita, che e' la fine di quel giro, o con l'ultima partenza.
  const base = riuscita !== null ? riuscita : (istante(riga.prima_partenza) ?? istante(riga.created_date) ?? partenza);
  if (base === null) return null;
  if (!lavoro.cron) {
    // Un lavoro a evento non ha un orario da mancare: si dice quando l'ultimo giro
    // e' fallito, finche' uno dopo non riesce.
    const daDire = riga.ultimo_esito === 'fallito' && (riuscita === null || (partenza !== null && riuscita < partenza));
    return { daDire, base, riuscita, partenza, mancati: daDire ? 1 : 0, orario: false };
  }
  const c = leggiCron(lavoro.cron);
  if (!c) return null;
  const margine = c.orario ? MARGINE_ORARIO : MARGINE_GIORNALIERO;
  // Dopo una riuscita si contano i giri successivi: quello riuscito no.
  // IL PRIMO GIRO FALLITO CONTA (revisione delle migliorie, 11/10/2026). Un
  // lavoro che non e' mai riuscito ha fallito anche il giro che ha creato la
  // riga: quel giro e' un mancato come gli altri. Prima si contava dalla nascita
  // della riga escludendolo, e il controllo normativo che fallisce al primo giro
  // col battito (01/11/2026) non lo diceva nessuno fino a dicembre, il programma
  // del mercoledi' per una settimana, i lavori di ogni notte volevano tre notti
  // fallite invece di due. Il giro e' quello dell'orario del cron entro il
  // margine prima della partenza, lo stesso margine con cui un giro si da' per
  // mancato: copre il passo che parte dopo il guardiano (il controllo delle
  // identita') e un orologio della piattaforma in ritardo di qualche minuto.
  const da = riuscita !== null ? base + ANTICIPO : base - margine;
  const giri = giriAttesi(c, da, adessoMs - margine);
  const soglia = Number(lavoro.soglia) || 2;
  return { daDire: giri.length >= soglia, base, riuscita, partenza, mancati: giri.length, primoMancato: giri[0] || null, cron: c, orario: c.orario };
}

/**
 * Da quanto non riesce, a parole, nell'unita' del suo orario: ore per chi gira
 * ogni ora, giorni lavorativi per chi gira nei feriali (un venerdi' e un lunedi'
 * falliti sono due giri, non quattro giorni), giorni per chi gira ogni giorno, e
 * il primo giro mancato per chi gira una volta alla settimana o al mese.
 */
function daQuanto(s, adessoMs) {
  const c = s.cron;
  // Il tempo si misura dall'ultima riuscita. Per un lavoro mai riuscito si misura
  // dal giro prima del primo mancato, come se quello fosse riuscito: due notti
  // fallite sono «da 2 giorni» in tutti e due i casi, sei ore fallite «da 6 ore».
  const dal = s.riuscita !== null || !s.primoMancato ? s.base : s.primoMancato - (c.orario ? ORA : 24 * ORA);
  if (c.orario) {
    const ore = Math.max(1, Math.floor((adessoMs - dal) / ORA));
    return ore === 1 ? "da un'ora" : `da ${ore} ore`;
  }
  if (c.giorni || (c.settimana && c.settimana.size < 5)) return `dal giro del ${ilGiorno(giornoRoma(s.primoMancato))}`;
  if (c.settimana) return s.mancati === 1 ? 'da un giorno lavorativo' : `da ${s.mancati} giorni lavorativi`;
  const g = giorniFra(dal, adessoMs);
  return g <= 0 ? 'da oggi' : g === 1 ? 'da ieri' : `da ${g} giorni`;
}

function voceLavoro(l, riga, s, adessoMs) {
  const parti = [];
  if (riga.ultimo_esito === 'fallito') {
    const quante = Number(riga.fallimenti_di_fila) || 0;
    parti.push(`Ultimo tentativo ${s.partenza !== null ? quando(s.partenza) : ''}${quante > 1 ? ` (${quante} di fila)` : ''}: ${riga.errore || 'errore senza messaggio'}.`.replace('tentativo :', 'tentativo:'));
    parti.push(s.riuscita !== null ? `L'ultima volta che è riuscito: ${quando(s.riuscita)}.` : 'Da quando lascia traccia non è mai riuscito.');
  } else {
    // L'ultimo giro registrato e' riuscito, ma e' vecchio: dopo non e' rimasto
    // niente. Le ragioni possibili sono tre, e si dicono tutte e tre invece di
    // sceglierne una a caso.
    parti.push(`L'ultimo giro registrato è riuscito ${quando(s.partenza !== null ? s.partenza : s.base)}; dopo, nessun esito: il lavoro non parte, si interrompe prima di finire, oppure è rinviato per un caricamento a metà (che la dashboard dice fra i caricamenti).`);
  }
  if (l.senza) parti.push(`Finché non riparte, ${l.senza}.`);
  return {
    area: 'Manutenzione',
    gravita: 'attenzione',
    titolo: l.cron
      ? `${l.titolo} non riesce ${daQuanto(s, adessoMs)}`
      : `${l.titolo} non è riuscito all'ultimo giro`,
    dettaglio: parti.join(' '),
    link: l.link || '/',
    chiave: `lavoro:${l.lavoro}`,
  };
}

function voceIdentita(v, inv, oggi) {
  const [ma, mb] = Array.isArray(v.moduli) && v.moduli.length >= 2 ? v.moduli : ['Un modulo', "l'altro"];
  // Un numero che manca («—», un piazzale che un modulo non elenca) non e' un
  // numero diverso: lo si dice per quello che e' (revisione delle migliorie,
  // 11/10/2026).
  const manca = v.a === null || v.a === undefined || v.b === null || v.b === undefined;
  const perche = manca
    ? "Un modulo dice un numero e l'altro non lo dice: almeno uno dei due sbaglia."
    : 'Due numeri che devono essere uguali non lo sono: almeno uno dei due è sbagliato.';
  // Rotta all'ultima verifica e non riverificata (riportaRotte, invarianti.ts):
  // resta, coi numeri di quella verifica, e dice perche' non si e' riverificata.
  const riverificata = v.verificata === true;
  // Rotta a un controllo e non riverificata da uno rifatto lo stesso giorno
  // (revisione delle migliorie, 11/10/2026): non e' «stanotte» ma l'ora del
  // controllo rifatto, che e' l'istante dell'esito (riportaRotte, invarianti.ts).
  const stessoGiorno = !riverificata && !!inv && !!inv.giorno && String(v.rotta_il || '').slice(0, 10) === inv.giorno;
  const rifattoMs = stessoGiorno ? istante(inv.il) : null;
  const alle = rifattoMs !== null ? ` alle ${ORE_ROMA.format(new Date(rifattoMs))}` : '';
  const quandoNo = (!inv || !inv.giorno || !oggi || inv.giorno === oggi ? (stessoGiorno ? 'oggi' : 'stanotte') : `il ${ilGiorno(inv.giorno)}`) + alle;
  return {
    area: v.area || 'Giacenze',
    gravita: 'critico',
    titolo: `Un'identità fra moduli si è rotta: ${ma} ${tt(v.a)}, ${mb} ${tt(v.b)}${riverificata ? '' : ` (non riverificata ${quandoNo})`}`,
    dettaglio: `${v.frase}: ${v.dettaglio}. ${perche}`
      + (riverificata
        ? `${inv && inv.giorno ? ` Controllo del ${ilGiorno(inv.giorno)}.` : ''}`
        : ` Rotta al controllo del ${ilGiorno(v.rotta_il)}; ${quandoNo} non si è potuta riverificare (${v.motivo || 'motivo non detto'}): resta finché una verifica non la trova a posto.`),
    link: v.link || '/giacenze',
    chiave: `invariante:${v.id}`,
  };
}

/**
 * Le voci dei presidi. esecuzioni: le righe di EsecuzioneLavoro; indicatore:
 * l'ultima fotografia del giorno (la riga IndicatoreGiorno, o quella gia' letta
 * con leggiFotografia); oggi e adessoMs: il giorno italiano e l'istante.
 */
export function vociPresidi({ esecuzioni = [], indicatore = null, oggi = '', adessoMs = null } = {}) {
  const adesso = Number.isFinite(adessoMs) ? adessoMs : (oggi ? Date.parse(`${oggi}T12:00:00Z`) : Date.now());
  const voci = [];

  // Una riga per lavoro; se ce ne fossero due, conta la piu' recente.
  const righe = new Map();
  for (const r of esecuzioni || []) {
    if (!r || !r.lavoro) continue;
    const prima = righe.get(r.lavoro);
    if (!prima || (istante(r.ultima_partenza) || 0) > (istante(prima.ultima_partenza) || 0)) righe.set(r.lavoro, r);
  }
  const stati = new Map(LAVORI.map(l => [l.lavoro, statoLavoro(l, righe.get(l.lavoro), adesso)]));
  for (const l of LAVORI) {
    const s = stati.get(l.lavoro);
    if (!s || !s.daDire) continue;
    if (l.dopo) {
      // Il passo prima non e' riuscito dopo l'ultima riuscita di questo: questo non
      // ha avuto occasione. La voce, se c'e', e' del passo prima.
      const p = stati.get(l.dopo);
      if (p && (p.daDire || p.riuscita === null || p.riuscita <= s.base)) continue;
    }
    voci.push(voceLavoro(lavoroDi(l.lavoro), righe.get(l.lavoro), s, adesso));
  }

  const inv = indicatore
    ? (indicatore.invarianti !== undefined ? leggiInvarianti(indicatore.invarianti) : leggiInvarianti(indicatore.invarianti_json))
    : null;
  for (const v of (inv && Array.isArray(inv.voci) ? inv.voci : [])) {
    // Solo le rotte, anche quelle non riverificate; i doppioni la dashboard li
    // dice gia' con la loro voce.
    if (!eRotta(v) || v.nel_cruscotto) continue;
    voci.push(voceIdentita(v, inv, oggi));
  }
  return voci;
}
