// LE IDENTITA' FRA MODULI, CONTROLLATE OGNI NOTTE (chiusura dell'audit, 11/10/2026).
//
// L'audit del 10/10/2026 ha chiesto lo stesso numero a due moduli, sui dati veri,
// e ha trovato i difetti dove non coincideva: Giacenze e Dichiarazioni uguali
// canale per canale (53 confronti su 54), il raccolto di rete 8.818,55 t uguale in
// quattro moduli, nessun doppione. Il primo difetto trovato dal guardiano notturno
// («ACI dichiarato 115,54 t» sullo stoccaggio GATIM: 275,08 t nelle Giacenze contro
// 154,22 nelle Dichiarazioni) e' venuto proprio da un confronto fra due moduli. Ma
// quei confronti stavano negli script usa e getta dell'audit e, su dati finti, in
// prove/dueModuliStessiNumeri.mjs: sui dati veri non li rifaceva nessuno. L'11/10
// una correzione passata da tutte le prove ha rotto la colonna «Da dichiarare»
// sui dati veri di Irigom (0 contro una giacenza di 652,84 t): l'identita' (b) qui
// sotto l'avrebbe trovata da sola, la notte stessa.
//
// Ogni voce: { id, frase, breve, moduli, servono, tolleranza, area, link,
// verifica(dati) -> { ok, a, b, moduli, dettaglio, casi } }. I dati sono le
// RISPOSTE delle funzioni vere (calcolaGiacenze, riepilogoDichiarazioni,
// getDashboardRaccolta), chieste da controllaInvarianti come le chiede lo
// strumento delle giacenze di EcoTyna: qui non si ricalcola niente, si confronta.
// Un terzo conto avrebbe dato una terza risposta.
//
// SI PARTE SOLO DA IDENTITA' GIA' VERIFICATE SUI DATI VERI, ciascuna con la sua
// tolleranza scritta: un avviso che grida a zero insegna a ignorare quelli veri.
// Le altre voci del censimento (circa meta' delle 91) entrano qui solo dopo averle
// viste tornare sui dati veri.
//
// FUORI, PER ORA: attiva elaborata = ricavi del margine e passiva = costi del
// margine. Il margine non ha regole sue (usa attivaCalcolo e passivaCalcolo), quindi
// contro il calcolo della passiva il confronto e' vero per costruzione; ha senso
// solo contro le fotografie salvate (documenti elaborati, passiva congelata), che
// dopo un caricamento cambiano per ragioni legittime e griderebbero al lupo se non
// si sa quando ciascuna e' stata scattata. E calcolaMargine rilegge tutti gli
// archivi dei movimenti una quarta volta nella stessa notte.
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { formatoTonnellate, formatoKg } from "./formato.ts";
import { notaDoppioni } from "./indicatoriGiorno.ts";

/**
 * Le funzioni vere da cui vengono i numeri, e come si chiamano. `nonRisponde` e'
 * come lo si dice a video (revisione delle migliorie, 11/10/2026): il motivo di
 * una voce non verificata finisce nella dashboard, e li' si nomina il modulo,
 * non la funzione che lo calcola.
 */
export const FONTI = {
  giacenze: { funzione: 'calcolaGiacenze', modulo: 'Giacenze', nonRisponde: 'le Giacenze non hanno risposto', corpo: (anno) => ({ anno }) },
  dichiarazioni: { funzione: 'riepilogoDichiarazioni', modulo: 'Dichiarazioni', nonRisponde: 'le Dichiarazioni non hanno risposto', corpo: (anno) => ({ anno }) },
  dashboard: { funzione: 'getDashboardRaccolta', modulo: 'Dashboard', nonRisponde: 'la Dashboard non ha risposto', corpo: (anno) => ({ anno }) },
};

const CANALI = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];
const NOME_CANALE = { RETE: 'rete', ACI: 'ACI', EXTRA_RACCOLTA: 'extra raccolta' };
// Quanti casi si tengono per voce: l'esito sta in una riga di IndicatoreGiorno.
const MAX_CASI = 20;

// AL CENTESIMO, COME LA MISURA DEL 10/10/2026. Le Giacenze arrotondano a due
// decimali e le Dichiarazioni a tre: lo scarto dovuto all'arrotondamento resta
// sotto 0,006 t, e 0,01 t lo copre senza coprire un errore vero.
export const TOLLERANZA_CENTESIMO_T = 0.01;

const vuoto = (v) => v === null || v === undefined;
const num = (v) => Number(v) || 0;
const t3 = (v) => Math.round(num(v) * 1000) / 1000;
/** Le tonnellate come le scrive il gestionale; «—» per un numero che non c'e'. */
export const tt = (v) => (vuoto(v) ? '—' : `${formatoTonnellate(t3(v))} t`);
// Gli stessi numeri, o nessun numero in tutti e due (dueModuliStessiNumeri.mjs).
const uguali = (a, b, tol) => (vuoto(a) ? vuoto(b) : !vuoto(b) && Math.abs(num(a) - num(b)) <= tol);
const scartoDi = (a, b) => (vuoto(a) || vuoto(b) ? Infinity : Math.abs(num(a) - num(b)));

// I casi rotti, il piu' grosso per primo; a e b della voce sono i suoi.
function esitoDaCasi(casi, confronti, moduli, descrivi) {
  const ordinati = [...casi].sort((x, y) => y.scarto - x.scarto);
  const primo = ordinati[0] || null;
  const altri = ordinati.length - 1;
  return {
    ok: ordinati.length === 0,
    confronti,
    a: primo ? primo.a : null,
    b: primo ? primo.b : null,
    moduli,
    dettaglio: primo ? descrivi(primo) + (altri > 0 ? `; e ${altri === 1 ? 'un altro caso' : `altri ${altri} casi`}` : '') : '',
    casi: ordinati.slice(0, MAX_CASI).map(c => ({ ...c, scarto: c.scarto === Infinity ? null : t3(c.scarto) })),
  };
}

/**
 * IL CATALOGO. L'ordine e' quello in cui si leggono.
 */
export const VOCI_INVARIANTI = [
  {
    id: 'giacenze_uguali',
    frase: 'Ogni impianto e ogni piazzale ha la stessa giacenza nelle Giacenze e nelle Dichiarazioni, canale per canale',
    breve: 'la giacenza nei due moduli',
    moduli: ['Giacenze', 'Dichiarazioni'],
    servono: ['giacenze', 'dichiarazioni'],
    tolleranza: TOLLERANZA_CENTESIMO_T,
    area: 'Giacenze', link: '/giacenze',
    // Le stesse coppie di confrontaTutto (prove/dueModuliStessiNumeri.mjs). Per la
    // rete di un impianto il numero delle Giacenze e' quello a portale, e cosi' nelle
    // Dichiarazioni: la calcolata contro il portale e' la quadratura, che e' gia' il
    // mestiere del guardiano. Un impianto che uno dei due moduli non elenca non si
    // confronta (lo filtrano ciascuno sulla propria attivita'); un piazzale si'.
    //
    // UN PIAZZALE CHE LE DICHIARAZIONI NON ELENCANO NON E' UNO ZERO (revisione
    // delle migliorie, 11/10/2026). Si leggeva «0,00 t nelle Dichiarazioni», in
    // rosso: sulla copia dei dati veri, il 02/01/2027 col 2027 non ancora
    // preparato, le Dichiarazioni non elencano nessun sito e le Giacenze danno
    // 25,88 t al piazzale Nappi Sud. Le Dichiarazioni non dicono 0: non lo
    // mostrano. Ora, per un piazzale che non elencano:
    // - dove le Giacenze non hanno niente (0 o «—») non c'e' niente da
    //   confrontare: nessuno dei due dice una giacenza (cosi' oggi Green Tyre e
    //   GATIM come piazzali, a 0 nelle Giacenze e assenti dalle Dichiarazioni);
    // - dove le Giacenze hanno una giacenza resta un caso, ma col numero che manca
    //   («—») e detto per quello che e': il piazzale nelle Dichiarazioni non
    //   compare. Una giacenza che uno dei due moduli non vede e' proprio cio' che
    //   questa voce deve trovare (il caso GATIM del 10/10/2026).
    // Lo zero resta per il canale che manca a un piazzale elencato: li' il
    // riepilogo elenca i canali con movimenti o giacenza, e quello che manca vale 0.
    //
    // E DALL'ALTRA PARTE (revisione delle migliorie, 11/10/2026): si girava solo
    // sulle righe delle Giacenze, e un piazzale con 40 t di ACI che solo le
    // Dichiarazioni elencano dava «torna». Ora un piazzale delle Dichiarazioni
    // che le Giacenze non elencano fa caso allo stesso modo, solo per i canali
    // con una giacenza (non 0, non «—»). Sui dati veri dell'11/10/2026 le
    // Dichiarazioni elencano tre piazzali, tutti anche nelle Giacenze: niente
    // cambia, e i confronti restano 27.
    //
    // E GLI IMPIANTI COME I PIAZZALI (15/10/2026, prova generale del cambio
    // d'anno, difetto 12). Un impianto che un modulo solo elencava non si
    // confrontava: il 05/01/2027, senza la copia d'anno, le Giacenze avevano
    // cinque impianti con una giacenza (Tecnogum 1.833,43 t, Irigom 652,84 t...)
    // e le Dichiarazioni nessuno, e la notte segnalava solo il piazzale. Ora un
    // impianto con una giacenza (non 0, non «—») che l'altro modulo non elenca e'
    // un caso, dalle due parti, come il piazzale. Sui dati veri dell'11/10/2026
    // i sei impianti sono in tutti e due i moduli: i confronti non cambiano.
    verifica({ giacenze: G, dichiarazioni: D }) {
      const tol = this.tolleranza;
      const impiantiD = new Map((D.siti || []).filter(s => s.tipo_destinazione !== 'stoc').map(s => [s.chiave, s]));
      const piazzaliD = new Map((D.stoccaggi || []).map(s => [s.chiave, s]));
      const casi = [];
      let confronti = 0;
      const confronta = (sito, ruolo, canale, a, b) => {
        confronti++;
        if (!uguali(a, b, tol)) casi.push({ sito, ruolo, canale, a: vuoto(a) ? null : t3(a), b: vuoto(b) ? null : t3(b), scarto: scartoDi(a, b) });
      };
      for (const g of G.righe || []) {
        const k = normalizzaRagioneSociale(g.sito);
        if (g.tipo_destinazione === 'stoc') {
          const d = piazzaliD.get(k);
          for (const [canale, campo] of [['RETE', 'giacenza_rete_t'], ['ACI', 'giacenza_aci_t'], ['EXTRA_RACCOLTA', 'giacenza_extra_t']]) {
            const a = g[campo];
            if (!d) {
              if (vuoto(a) || Math.abs(num(a)) <= tol) continue;
              // Lo scarto e' la giacenza che l'altro modulo non vede: ordina il caso
              // fra gli altri per quanto pesa, invece di metterlo sempre in cima.
              confronti++;
              casi.push({ sito: g.sito, ruolo: 'stoc', canale, a: t3(a), b: null, scarto: Math.abs(num(a)), assente: true });
              continue;
            }
            const x = (d.canali || []).find(c => c.canale === canale);
            // Un canale senza movimenti ne' giacenza il riepilogo non lo elenca: vale zero, o niente.
            confronta(g.sito, 'stoc', canale, a, x ? x.in_piazzale_t : (vuoto(a) ? null : 0));
          }
        } else {
          const d = impiantiD.get(k);
          if (!d) {
            for (const [canale, a] of [['RETE', g.giacenza_portale_t], ['ACI', g.giacenza_aci_t], ['EXTRA_RACCOLTA', g.giacenza_extra_t]]) {
              if (vuoto(a) || Math.abs(num(a)) <= tol) continue;
              confronti++;
              casi.push({ sito: g.sito, ruolo: 'imp', canale, a: t3(a), b: null, scarto: Math.abs(num(a)), assente: true });
            }
            continue;
          }
          const gc = (canale) => (d.giacenze_canale || []).find(c => c.canale === canale) || {};
          confronta(g.sito, 'imp', 'RETE', g.giacenza_portale_t, d.giacenza_portale_t);
          confronta(g.sito, 'imp', 'ACI', g.giacenza_aci_t, gc('ACI').giacenza_t);
          confronta(g.sito, 'imp', 'EXTRA_RACCOLTA', g.giacenza_extra_t, gc('EXTRA_RACCOLTA').giacenza_t);
        }
      }
      const impiantiG = new Set((G.righe || []).filter(g => g.tipo_destinazione !== 'stoc').map(g => normalizzaRagioneSociale(g.sito)));
      for (const [k, d] of impiantiD) {
        if (impiantiG.has(k || normalizzaRagioneSociale(d.sito || ''))) continue;
        const gc = (canale) => (d.giacenze_canale || []).find(c => c.canale === canale) || {};
        for (const [canale, b] of [['RETE', d.giacenza_portale_t], ['ACI', gc('ACI').giacenza_t], ['EXTRA_RACCOLTA', gc('EXTRA_RACCOLTA').giacenza_t]]) {
          if (vuoto(b) || Math.abs(num(b)) <= tol) continue;
          confronti++;
          casi.push({ sito: d.sito || k, ruolo: 'imp', canale, a: null, b: t3(b), scarto: Math.abs(num(b)), assente: true, assente_in: 'Giacenze' });
        }
      }
      const piazzaliG = new Set((G.righe || []).filter(g => g.tipo_destinazione === 'stoc').map(g => normalizzaRagioneSociale(g.sito)));
      for (const [k, d] of piazzaliD) {
        if (piazzaliG.has(k || normalizzaRagioneSociale(d.sito || ''))) continue;
        for (const x of d.canali || []) {
          const b = x.in_piazzale_t;
          if (vuoto(b) || Math.abs(num(b)) <= tol || !NOME_CANALE[x.canale]) continue;
          confronti++;
          casi.push({ sito: d.sito || k, ruolo: 'stoc', canale: x.canale, a: null, b: t3(b), scarto: Math.abs(num(b)), assente: true, assente_in: 'Giacenze' });
        }
      }
      const chi = (c) => (c.ruolo === 'stoc' ? 'il piazzale' : "l'impianto");
      return esitoDaCasi(casi, confronti, ['Giacenze', 'Dichiarazioni'],
        (c) => (c.assente_in === 'Giacenze'
          ? `${c.sito}${c.ruolo === 'stoc' ? ' (piazzale)' : ''}, ${NOME_CANALE[c.canale]}: ${tt(c.b)} nelle Dichiarazioni, mentre nelle Giacenze ${chi(c)} non compare`
          : `${c.sito}${c.ruolo === 'stoc' ? ' (piazzale)' : ''}, ${NOME_CANALE[c.canale]}: ${tt(c.a)} nelle Giacenze, `
            + (c.assente ? `mentre nelle Dichiarazioni ${chi(c)} non compare` : `${tt(c.b)} nelle Dichiarazioni`)));
    },
  },
  {
    id: 'riga_da_dichiarare',
    frase: 'Per ogni impianto e canale la riga «Da dichiarare» somma la giacenza del canale',
    breve: 'la riga «Da dichiarare»',
    moduli: ['Da dichiarare', 'Giacenza del canale'],
    servono: ['dichiarazioni'],
    tolleranza: TOLLERANZA_CENTESIMO_T,
    area: 'Dichiarazioni', link: '/dichiarazioni-impianti',
    // E' l'identita' che avrebbe trovato da sola la regressione dell'11/10/2026 su
    // Irigom: la riga faceva 0 e la giacenza 652,84 t. La rete di chi non la
    // dichiara (giacenza null) non ha un resto: «—» in tutti e due, e non si
    // confronta. Quando la riga non torna, il riepilogo dice gia' perche' secondo
    // lui (il portale aggancia piu' delle nostre dichiarazioni, o una
    // dichiarazione che nessun mese assorbe): si riporta, perche' e' la prima cosa
    // da guardare - un difetto del conto o una dichiarazione da inserire.
    verifica({ dichiarazioni: D }) {
      const tol = this.tolleranza;
      const casi = [];
      let confronti = 0;
      for (const s of (D.siti || []).filter(x => x.tipo_destinazione !== 'stoc')) {
        for (const canale of CANALI) {
          const gc = (s.giacenze_canale || []).find(c => c.canale === canale);
          if (!gc || vuoto(gc.giacenza_t)) continue;
          const flussi = (s.flussi || []).filter(f => (f.canale || 'RETE') === canale && !f.non_dovuta);
          const riga = t3(flussi.reduce((t, f) => t + num(f.resta_t), 0));
          // Nessuna riga e nessuna giacenza: niente da confrontare.
          if (!flussi.length && Math.abs(num(gc.giacenza_t)) <= tol) continue;
          confronti++;
          if (Math.abs(riga - num(gc.giacenza_t)) > tol) {
            casi.push({
              sito: s.sito, canale, a: riga, b: t3(gc.giacenza_t), scarto: Math.abs(riga - num(gc.giacenza_t)),
              oltre_kg: flussi.reduce((t, f) => t + num(f.uscito_oltre_kg), 0),
              non_allocato_kg: flussi.reduce((t, f) => t + num(f.uscito_non_allocato_kg), 0),
            });
          }
        }
      }
      return esitoDaCasi(casi, confronti, ['Da dichiarare', 'Giacenza del canale'], (c) => {
        const perche = [
          c.oltre_kg ? `secondo il riepilogo il portale aggancia ${formatoKg(c.oltre_kg)} kg più delle nostre dichiarazioni` : '',
          c.non_allocato_kg ? `${formatoKg(c.non_allocato_kg)} kg dichiarati non trovano posto in nessun mese` : '',
        ].filter(Boolean).join(', ');
        return `${c.sito}, ${NOME_CANALE[c.canale]}: la riga «Da dichiarare» somma ${tt(c.a)}, la giacenza del canale è ${tt(c.b)}${perche ? ` (${perche})` : ''}`;
      });
    },
  },
  {
    id: 'raccolto_rete',
    frase: "Il raccolto di rete dell'anno è lo stesso nella Dashboard, nelle Giacenze e nelle Dichiarazioni",
    breve: 'il raccolto di rete',
    moduli: ['Dashboard', 'Giacenze', 'Dichiarazioni'],
    servono: ['dashboard', 'giacenze', 'dichiarazioni'],
    // Il totale delle Giacenze e' la somma delle righe, ciascuna arrotondata al
    // centesimo: puo' scostarsi di mezzo centesimo per riga senza che niente sia
    // sbagliato. La tolleranza lo dice, e non di piu'.
    tolleranza: (dati) => t3(TOLLERANZA_CENTESIMO_T + 0.005 * ((dati.giacenze && dati.giacenze.righe) || []).length),
    area: 'Dashboard', link: '/',
    // Ogni carico una volta sola: la Dashboard conta le primarie di rete terminate
    // dell'anno, le Giacenze il conferito delle primarie (riga TOTALE), le
    // Dichiarazioni tutte le primarie di rete a impianti e piazzali.
    verifica(dati) {
      const tol = this.tolleranza(dati);
      const valori = [
        { modulo: 'Dashboard', t: dati.dashboard && dati.dashboard.kpi ? dati.dashboard.kpi.raccolto_rete_anno : null },
        { modulo: 'Giacenze', t: dati.giacenze && dati.giacenze.totali ? dati.giacenze.totali.conferito_t : null },
        { modulo: 'Dichiarazioni', t: dati.dichiarazioni && dati.dichiarazioni.totali ? dati.dichiarazioni.totali.conferito_t : null },
      ];
      let peggiore = null;
      for (let i = 0; i < valori.length; i++) {
        for (let k = i + 1; k < valori.length; k++) {
          const x = valori[i], y = valori[k];
          if (uguali(x.t, y.t, tol)) continue;
          const scarto = scartoDi(x.t, y.t);
          if (!peggiore || scarto > peggiore.scarto) peggiore = { x, y, scarto };
        }
      }
      const elenco = valori.map(v => `${v.modulo} ${tt(v.t)}`).join(', ');
      return {
        ok: !peggiore,
        confronti: 3,
        a: peggiore ? (vuoto(peggiore.x.t) ? null : t3(peggiore.x.t)) : t3(valori[0].t),
        b: peggiore ? (vuoto(peggiore.y.t) ? null : t3(peggiore.y.t)) : t3(valori[1].t),
        moduli: peggiore ? [peggiore.x.modulo, peggiore.y.modulo] : ['Dashboard', 'Giacenze'],
        dettaglio: peggiore ? `raccolto di rete: ${elenco} (tolleranza ${formatoTonnellate(tol)} t)` : '',
        casi: valori.map(v => ({ modulo: v.modulo, t: vuoto(v.t) ? null : t3(v.t) })),
      };
    },
  },
  {
    id: 'nessun_doppione',
    frase: 'Nessuna dichiarazione mensile è doppia',
    breve: 'i doppioni delle dichiarazioni',
    moduli: ['Dichiarazioni'],
    servono: ['dichiarazioni'],
    tolleranza: 0,
    area: 'Dichiarazioni', link: '/dichiarazioni-impianti',
    // E' il controllo che il guardiano fa gia' (doppioniDichiarazioni nel
    // riepilogo, doppioni_json nella fotografia del giorno), riletto dalla stessa
    // risposta: e la dashboard lo dice gia' con la sua voce, quindi qui non ne fa
    // un'altra (nelCruscotto).
    nelCruscotto: true,
    verifica({ dichiarazioni: D }) {
      const d = D.doppioni || [];
      return { ok: d.length === 0, confronti: 1, a: d.length, b: 0, moduli: ['Dichiarazioni', 'Dichiarazioni'], dettaglio: d.length ? notaDoppioni(d) : '', casi: d.slice(0, MAX_CASI).map(x => ({ sito: x.sito, canale: x.canale, mese: x.mese, quante: x.quante })) };
    },
  },
];

/** Le fonti che servono a un elenco di voci, una volta sola. */
export function fontiDelleVoci(voci = VOCI_INVARIANTI) {
  return [...new Set((voci || []).flatMap(v => v.servono || []))];
}

const tolleranzaDi = (v, dati) => (typeof v.tolleranza === 'function' ? v.tolleranza(dati) : v.tolleranza);

/**
 * Le voci, sui dati delle funzioni. `errori` dice perche' una fonte manca: le voci
 * che ne hanno bisogno restano non verificate, col motivo, e non diventano ne'
 * rotte ne' in linea. { il, giorno, anno, esito, nota, voci }.
 */
export function verificaInvarianti(dati, { errori = {}, voci = VOCI_INVARIANTI, giorno = '', anno = null, il = '' } = {}) {
  const esiti = (voci || []).map((v) => {
    const base = { id: v.id, frase: v.frase, moduli: v.moduli, area: v.area, link: v.link, ...(v.nelCruscotto ? { nel_cruscotto: true } : {}) };
    const mancano = (v.servono || []).filter(f => !(dati && dati[f]));
    if (mancano.length) {
      // Il motivo finisce nella dashboard: il modulo, non la funzione.
      return { ...base, verificata: false, ok: null, motivo: mancano.map(f => `${FONTI[f] ? FONTI[f].nonRisponde : `la fonte ${f} non ha risposto`}${errori[f] ? `: ${errori[f]}` : ''}`).join('; ') };
    }
    try {
      const r = v.verifica(dati);
      return { ...base, verificata: true, tolleranza: tolleranzaDi(v, dati), ...r };
    } catch (e) {
      return { ...base, verificata: false, ok: null, motivo: `il confronto si è fermato: ${e && e.message ? e.message : String(e)}` };
    }
  });
  return { il, giorno, anno, esito: esitoDi(esiti), nota: notaInvarianti(esiti), voci: esiti };
}

/**
 * Rotta: trovata rotta stanotte, oppure rotta all'ultima verifica e non
 * riverificata da allora (`rotta_il`, vedi riportaRotte).
 */
export const eRotta = (v) => !!v && (v.verificata ? v.ok === false : !!v.rotta_il);

function esitoDi(voci) {
  if (voci.some(eRotta)) return 'rotte';
  return voci.some(v => !v.verificata) ? 'non_verificate' : 'in_linea';
}

const ilGiorno = (g) => String(g || '').slice(0, 10).split('-').reverse().join('/');

/** L'esito in una riga: quante tornano, e la prima che non torna coi suoi due numeri. */
export function notaInvarianti(voci) {
  const v = voci || [];
  const rotte = v.filter(eRotta);
  const nonV = v.filter(e => !e.verificata);
  const verificate = v.length - nonV.length;
  const parti = [];
  if (rotte.length) {
    const r = rotte[0];
    parti.push(`${rotte.length === 1 ? "Un'identità fra moduli si è rotta" : `${rotte.length} identità fra moduli si sono rotte`}: ${r.dettaglio}`
      + `${r.verificata ? '' : ` (al controllo del ${ilGiorno(r.rotta_il)}, non riverificata)`}.`);
  } else if (verificate) {
    parti.push(`${verificate === 1 ? "L'identità fra moduli torna" : `Le ${verificate} identità fra moduli tornano`}.`);
  }
  if (nonV.length) parti.push(`${nonV.length === 1 ? 'Una non si è potuta verificare' : `${nonV.length} non si sono potute verificare`}: ${nonV[0].motivo}.`);
  return parti.join(' ');
}

const PER_ID = new Map(VOCI_INVARIANTI.map(v => [v.id, v]));
const breveDi = (v) => (PER_ID.get(v.id) && PER_ID.get(v.id).breve) || v.breve || v.frase || "un'identità";

/**
 * Perche' non si sono potute verificare, in italiano corrente: il motivo e, fra
 * parentesi, le voci col loro nome breve. E' l'errore del battito del controllo,
 * e la dashboard lo mostra (revisione delle migliorie, 11/10/2026): prima diceva
 * «giacenze_uguali: calcolaGiacenze non ha risposto: timeout», gli
 * identificativi del catalogo e i nomi delle funzioni. Lo stesso motivo per piu'
 * voci si dice una volta.
 */
export function motiviNonVerificate(voci) {
  const perMotivo = new Map();
  for (const v of (voci || []).filter(x => x && !x.verificata)) {
    const m = v.motivo || 'motivo non detto';
    if (!perMotivo.has(m)) perMotivo.set(m, []);
    perMotivo.get(m).push(breveDi(v));
  }
  return [...perMotivo.entries()].map(([m, brevi]) => `${m} (${brevi.join(', ')})`).join('; ');
}

/**
 * Unisce l'esito di stanotte a quello gia' scritto nella stessa riga: un passo
 * che controlla solo alcune voci non cancella le altre dello stesso giorno. Di un
 * altro giorno non si tiene niente (per quello c'e' riportaRotte).
 */
export function unisciInvarianti(prima, nuovo) {
  if (!prima || !nuovo || prima.giorno !== nuovo.giorno) return nuovo;
  const ids = new Set((nuovo.voci || []).map(v => v.id));
  const voci = [...(prima.voci || []).filter(v => !ids.has(v.id)), ...(nuovo.voci || [])];
  const ordine = new Map(VOCI_INVARIANTI.map((v, i) => [v.id, i]));
  voci.sort((x, y) => (ordine.has(x.id) ? ordine.get(x.id) : 99) - (ordine.has(y.id) ? ordine.get(y.id) : 99));
  return { ...nuovo, esito: esitoDi(voci), nota: notaInvarianti(voci), voci };
}

/**
 * UNA ROTTA NON SPARISCE PERCHE' STANOTTE NON SI E' POTUTA RIVERIFICARE
 * (revisione delle migliorie, 11/10/2026).
 *
 * Sulla copia dei dati veri, con la regressione dell'11/10 rimessa: la notte del
 * 12/10 la riga «Da dichiarare» di Irigom risulta rotta (0 contro 652,84 t); la
 * notte del 13/10 il conto e' ancora rotto, ma le Dichiarazioni chiamate dal
 * controllo rispondono 500. Una voce non verificata non e' rotta, e il battito
 * del controllo parla solo dalla seconda notte: il 13/10 la voce rossa del
 * giorno prima spariva in silenzio, e un conto rotto sembrava sistemato.
 *
 * Ora una voce non verificata stanotte che all'ultima verifica era rotta resta
 * rotta, coi numeri e il giorno di quella verifica (`rotta_il`) e col motivo di
 * stanotte, finche' una verifica non la trova a posto. Resta anche non
 * verificata: il battito del controllo continua a dire che non riesce.
 *
 * precedenti: gli esiti scritti nei giorni prima (invarianti_json), in qualunque
 * ordine. Contano solo quelli dello stesso anno: il controllo guarda l'anno in
 * corso, e una rotta del 2026 non e' un'identita' del 2027. Per ogni voce si
 * risale all'esito piu' recente che ne sa qualcosa (verificata, rotta o a posto,
 * o gia' riportata); un esito in cui nemmeno allora si e' potuta verificare si
 * salta.
 *
 * ANCHE L'ESITO GIA' SCRITTO OGGI (revisione delle migliorie, 11/10/2026). La
 * rotta trovata alle 5 spariva se lo stesso giorno il controllo si rilanciava -
 * a mano, proprio per vedere se una correzione aveva sistemato il conto - e una
 * fonte non rispondeva: la voce non verificata delle 11 prendeva il posto di
 * quella rotta delle 5 (unisciInvarianti), e qui si guardavano solo i giorni
 * prima, a posto. Non tornava nemmeno le notti dopo, finche' la fonte taceva.
 * Ora conta anche un esito dello stesso giorno, purche' scritto prima di questo
 * (`il`, l'istante del controllo): si ordina per giorno e poi per istante. Un
 * esito dello stesso giorno senza istante non si sa se viene prima, e non conta.
 */
export function riportaRotte(nuovo, precedenti = []) {
  if (!nuovo || !Array.isArray(nuovo.voci) || !nuovo.voci.some(v => !v.verificata)) return nuovo;
  const giorno = String(nuovo.giorno || '9999');
  const vienePrima = (e) => String(e.giorno) < giorno
    || (String(e.giorno) === giorno && !!e.il && !!nuovo.il && String(e.il) < String(nuovo.il));
  const prima = (precedenti || [])
    .filter(e => e && Array.isArray(e.voci) && e.giorno && vienePrima(e)
      && (nuovo.anno == null || e.anno == null || Number(e.anno) === Number(nuovo.anno)))
    .sort((x, y) => String(y.giorno).localeCompare(String(x.giorno)) || String(y.il || '').localeCompare(String(x.il || '')));
  let riportate = 0;
  const voci = nuovo.voci.map((v) => {
    if (v.verificata) return v;
    for (const e of prima) {
      const p = e.voci.find(x => x && x.id === v.id);
      if (!p || (!p.verificata && !p.rotta_il)) continue;
      if (!eRotta(p)) return v;
      riportate++;
      return {
        ...v,
        rotta_il: p.verificata ? e.giorno : p.rotta_il,
        moduli: p.moduli, a: p.a, b: p.b, dettaglio: p.dettaglio, casi: p.casi, confronti: p.confronti, tolleranza: p.tolleranza,
      };
    }
    return v;
  });
  if (!riportate) return nuovo;
  return { ...nuovo, esito: esitoDi(voci), nota: notaInvarianti(voci), voci };
}

/**
 * QUALI ANNI SI CONTROLLANO STANOTTE (15/10/2026, prova generale del cambio
 * d'anno, difetto 27). Il controllo guardava solo l'anno in corso: il 31/12/2026
 * trovava «Irigom, ACI: 20,00 t nelle Giacenze, 12,00 t nelle Dichiarazioni», e
 * dall'01/01/2027 la voce spariva mentre sul 2026 i due moduli dicevano ancora
 * 20 e 12. A gennaio e febbraio il 2026 si sta ancora chiudendo - dichiarazioni
 * e carichi di dicembre - e si controlla anche lui, con le stesse fonti (tre
 * chiamate in piu' per notte, due mesi l'anno). Fuori da quei due mesi solo
 * l'anno in corso, come prima.
 *
 * @param {string} oggi  il giorno italiano, 'AAAA-MM-GG'
 * @returns {number[]} gli anni, dal piu' vecchio
 */
export function anniDaControllare(oggi) {
  const g = String(oggi || '').slice(0, 10);
  const anno = Number(g.slice(0, 4));
  const mese = Number(g.slice(5, 7));
  return mese === 1 || mese === 2 ? [anno - 1, anno] : [anno];
}

/**
 * I DUE ANNI IN UNA FOTOGRAFIA SOLA (15/10/2026, difetto 27). La riga del giorno
 * e' una: ogni voce del catalogo vi compare una volta, coi casi dei due anni
 * insieme, e ogni caso dice il suo anno («2026: Irigom S.r.l., ACI: ...»).
 * - rotta se e' rotta in uno dei due anni (anche se l'altro non si e' potuto
 *   verificare: quello che si e' visto rotto e' rotto);
 * - non verificata se nessun anno l'ha trovata rotta e uno non si e' potuto
 *   verificare, col motivo e l'anno;
 * - in linea solo se torna in tutti e due.
 * Con un anno solo l'esito e' quello di sempre, senza l'anno davanti.
 *
 * @param {Array<{ anno: number, esito: object }>} esiti  verificaInvarianti per anno, dal piu' vecchio
 */
export function unisciAnni(esiti) {
  const lista = (esiti || []).filter(e => e && e.esito);
  if (lista.length <= 1) return lista.length ? lista[0].esito : null;
  const ultimo = lista[lista.length - 1].esito;
  const ordine = [];
  const per = new Map();
  for (const { anno, esito } of lista) {
    for (const v of esito.voci || []) {
      if (!per.has(v.id)) { per.set(v.id, []); ordine.push(v.id); }
      per.get(v.id).push({ anno, v });
    }
  }
  const conAnno = (anno, testo) => (testo ? `${anno}: ${testo}` : '');
  const voci = ordine.map((id) => {
    const anni = per.get(id);
    const base = anni[anni.length - 1].v;
    const verificate = anni.filter(x => x.v.verificata);
    const nonVerificate = anni.filter(x => !x.v.verificata);
    const motivo = nonVerificate.map(x => conAnno(x.anno, x.v.motivo)).filter(Boolean).join('; ');
    const comune = { anni: anni.map(x => x.anno), confronti: verificate.reduce((t, x) => t + (Number(x.v.confronti) || 0), 0) };
    const rotte = verificate.filter(x => x.v.ok === false);
    if (rotte.length) {
      const prima = rotte[0];
      return {
        ...base, ...comune, verificata: true, ok: false,
        a: prima.v.a, b: prima.v.b, moduli: prima.v.moduli, tolleranza: prima.v.tolleranza,
        dettaglio: rotte.map(x => conAnno(x.anno, x.v.dettaglio)).join('; '),
        casi: rotte.flatMap(x => (x.v.casi || []).map(c => ({ anno: x.anno, ...c }))).slice(0, MAX_CASI),
        ...(motivo ? { non_verificate_anni: motivo } : {}),
      };
    }
    if (nonVerificate.length) {
      return { ...base, ...comune, verificata: false, ok: null, motivo };
    }
    return { ...base, ...comune, verificata: true, ok: true, dettaglio: '', casi: [] };
  });
  return { ...ultimo, anni: lista.map(e => e.anno), esito: esitoDi(voci), nota: notaInvarianti(voci), voci };
}

/** Rilegge l'esito scritto: un JSON rotto o assente non rompe niente. */
export function leggiInvarianti(testo) {
  if (!testo) return null;
  if (typeof testo === 'object') return testo;
  try { return JSON.parse(testo); } catch (_e) { return null; }
}
