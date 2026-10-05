// Il target annuo di un impianto si scrive in un posto solo, Target & Status
// (ImpiantoTargetSecondaria.target, chili), anno per anno; Giacenze e la
// predittivita' lo leggono da li' (decisione dell'utente, 27/09/2026). Il vecchio
// confronto fra il target di Giacenze e quello di Target & Status non serve piu'.
//
// Un record di ImpiantoTargetSecondaria vale un anno (il suo campo anno; senza
// anno vale il 2026, la regola di annoDelRecord in regolePredittivita.ts): i
// record degli anni chiusi restano attivi, perche' niente si cancella. Il target
// di esattamente un anno si legge con targetImpiantoDellAnno (annoTarget.ts);
// qui resta la lettura con il ripiego sugli anni prima, per chi prepara i
// contratti di un anno non ancora scritto.
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { annoDelRecord } from "./regolePredittivita.ts";
import { targetImpiantoDellAnno, targetPrimariePerRuolo, recordDellAnno } from "./annoTarget.ts";
import { ripartisciQuota, normalizzaQuote } from "./ripartizioneTarget.ts";

const attivo = (imp) => imp && (!imp.stato || imp.stato === 'attivo');

/** I mesi come li scrive TargetMensile, in minuscolo. */
const MESI_TARGET = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/**
 * Il record di Target & Status che vale per ogni impianto in un anno, per nome
 * normalizzato: quello dell'anno, o se manca il piu' recente degli anni prima
 * (un contratto nuovo parte dal target dell'ultimo anno scritto). Mai quello di
 * un anno dopo. Fra due record dello stesso anno vale il piu' recente. L'anno da
 * cui viene il record lo dice annoDelRecord(record).
 * @returns {Map<string, object>}
 */
export function impiantiTargetDellAnno(impiantiTarget, anno) {
  const annoNum = Number(anno);
  const recente = (r) => String((r && (r.updated_date || r.created_date)) || '');
  const out = new Map();
  for (const imp of impiantiTarget || []) {
    if (!attivo(imp) || annoDelRecord(imp) > annoNum) continue;
    const k = normalizzaRagioneSociale(imp.nome_impianto);
    if (!k) continue;
    const prima = out.get(k);
    if (!prima || annoDelRecord(imp) > annoDelRecord(prima)
      || (annoDelRecord(imp) === annoDelRecord(prima) && recente(imp) > recente(prima))) out.set(k, imp);
  }
  return out;
}

/**
 * LO STORICO DICE DOVE VA IL TARGET DI UN RACCOGLITORE (05/10/2026).
 *
 * In Target & Status il target di un raccoglitore si puo' legare a un impianto a
 * mano, e Giacenze somma i target legati al sito. Ma un raccoglitore non
 * conferisce a un impianto solo: nel 2026 gli stessi raccoglitori hanno scaricato
 * su piu' siti, e l'utente non poteva scegliere - «non si puo' associare un solo
 * impianto (o stoccaggio) ad un raccoglitore [...] ripartisci tu gli impianti in
 * base allo storico e ai quantitativi». Finche' nessuno li ripartiva, quei target
 * restavano fuori da ogni sito e quattro siti continuavano a dire «target ancora
 * scritto in Giacenze».
 *
 * Qui il target delle righe che l'impianto NON ce l'hanno scritto si divide fra i
 * siti dove quel raccoglitore ha davvero portato le primarie di rete dell'anno,
 * in proporzione ai chili. Le righe con l'impianto scritto non si toccano: la
 * mano dell'utente vince sempre, ed e' il modo di correggere una ripartizione che
 * non va. Si rifa' a ogni caricamento di dati, quindi i conferimenti che
 * arriveranno la aggiornano da soli, senza che nessuno la rifaccia a mano.
 *
 * SOLO LE PRIMARIE DI RETE. Il target e' di raccolta, e la raccolta sono le
 * primarie: il sito a cui vanno quelle tonnellate e' quello dove il raccoglitore
 * le scarica, anche quando di la' ripartono in secondaria (il piazzale di Nappi
 * Sud, che alimenta Irigom e Tecnogum, prende il suo target, non Irigom).
 * Contare anche le secondarie farebbe contare due volte lo stesso pneumatico, e
 * il target delle primarie non sarebbe piu' delle primarie.
 *
 * IL RUOLO LO DICE IL VIAGGIO. Ogni conferimento porta il suo tipo di
 * destinazione: cosi' Irigom, che per la rete riceve all'impianto e per l'ACI al
 * piazzale, prende il target sulla riga giusta senza che nessuno lo scriva.
 *
 * LA REGIONE, QUANDO LO STORICO CE L'HA. Le righe del target sono per
 * raccoglitore e regione (Nappi Sud ha Campania e Basilicata): se di quella
 * regione lo storico esiste si ripartisce su quello, altrimenti su tutto lo
 * storico del raccoglitore - meglio una ripartizione per nome che un target che
 * non arriva da nessuna parte.
 *
 * @param conferiti righe { raccoglitore, regione, sito, ruolo: 'imp'|'stoc', kg }
 * @returns {{ per: Map<string, number>, dettaglio: Map<string, object[]>, senzaStorico: object[] }}
 *   per: 'chiave del sito|ruolo' -> tonnellate ripartite;
 *   dettaglio: la stessa chiave -> [{ raccoglitore, regione, t }];
 *   senzaStorico: le righe di target che non si sono potute ripartire.
 */
export function ripartisciTargetPrimarie({ raccoglitori = [], mensili = [], conferiti = [], anno, chiave = normalizzaRagioneSociale }) {
  const testo = (v) => String(v || '').trim().toLowerCase();
  const t3 = (v) => Math.round(v * 1000) / 1000;
  const dove = (sito, ruolo) => chiave(sito) + '|' + (ruolo === 'stoc' || ruolo === 'stoccaggio' ? 'stoc' : 'imp');
  const vuotoMesi = () => Array.from({ length: 12 }, () => new Map());
  const segna = (m, k, t) => m.set(k, t3((m.get(k) || 0) + t));

  // LO STORICO, INTERO E MESE PER MESE.
  //
  // Mese per mese perche' la regola guarda il mese: quello che e' arrivato a un
  // sito a maggio spiega il target di maggio, non quello di ottobre. Intero per
  // la parte di target annuo che nessun mese si e' preso.
  const storico = new Map();     // chiave del raccoglitore -> { anno: Map, mesi: [12] Map } (tonnellate)
  const perRegione = new Map();  // 'chiave del raccoglitore|regione' -> idem
  const suo = (mappa, k) => {
    let x = mappa.get(k);
    if (!x) { x = { anno: new Map(), mesi: vuotoMesi() }; mappa.set(k, x); }
    return x;
  };
  for (const c of conferiti || []) {
    const kr = chiave(c.raccoglitore), ks = chiave(c.sito), t = (Number(c.kg) || 0) / 1000;
    if (!kr || !ks || !(t > 0)) continue;
    const k = dove(c.sito, c.ruolo);
    const i = Number(c.mese);
    for (const x of [suo(storico, kr), suo(perRegione, kr + '|' + testo(c.regione))]) {
      segna(x.anno, k, t);
      if (i >= 0 && i < 12) segna(x.mesi[i], k, t);
    }
  }

  // I TARGET MENSILI, E L'IMPIANTO SCRITTO SULLE LORO RIGHE.
  const mesiTarget = new Map(); // 'chiave del raccoglitore|regione' -> { tot: [12], scritto: [12] Map }
  for (const m of recordDellAnno(mensili, anno)) {
    const kr = chiave(m.raccoglitore);
    if (!kr) continue;
    const k = kr + '|' + testo(m.regione);
    let x = mesiTarget.get(k);
    if (!x) { x = { tot: Array.from({ length: 12 }, () => 0), scritto: vuotoMesi() }; mesiTarget.set(k, x); }
    const i = MESI_TARGET.indexOf(testo(m.mese));
    if (i < 0) continue;
    const q = m.non_raccoglie ? 0 : Number(m.target) || 0;
    if (!(q > 0)) continue;
    x.tot[i] = t3(x.tot[i] + q);
    if (chiave(m.impianto)) segna(x.scritto[i], dove(m.impianto, m.ruolo), q);
  }

  const per = new Map();
  const dettaglio = new Map();
  const senzaStorico = [];
  for (const r of recordDellAnno(raccoglitori, anno)) {
    if (chiave(r.impianto)) continue; // scritto a mano sulla riga annua: non si tocca
    const kr = chiave(r.raccoglitore);
    const t = Number(r.target_tonnellate) || 0;
    if (!kr || !(t > 0)) continue;
    const reg = testo(r.regione);
    // la storia di quella regione se c'e', altrimenti tutta quella del raccoglitore
    const sua = (reg && perRegione.get(kr + '|' + reg)) || storico.get(kr) || null;
    const mesi = mesiTarget.get(kr + '|' + reg) || null;
    const scrittoOvunque = mesi ? mesi.scritto.reduce((s, m) => s + m.size, 0) : 0;
    if ((!sua || !sua.anno.size) && !scrittoOvunque) {
      senzaStorico.push({ raccoglitore: r.raccoglitore || '', regione: r.regione || '', target_t: t });
      continue;
    }
    // dove va quello che non e' arrivato: l'impianto scritto sui mesi se c'e',
    // altrimenti quello dell'ultimo mese in cui ha conferito
    let rif = '';
    if (mesi) {
      const pesi = new Map();
      for (const m of mesi.scritto) for (const [k, q] of m) segna(pesi, k, q);
      for (const [k, q] of [...pesi].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) { rif = k; break; }
    }
    if (!rif && sua) {
      for (let i = 11; i >= 0 && !rif; i--) {
        let max = 0;
        for (const [k, q] of sua.mesi[i]) if (q > max) { max = q; rif = k; }
      }
      // se dei conferimenti non si sa il mese, vale il piu' grande dell'anno:
      // meglio il sito dove porta di piu' che nessun sito
      if (!rif) { let max = 0; for (const [k, q] of sua.anno) if (q > max) { max = q; rif = k; } }
    }

    // mese per mese, poi il target annuo che nessun mese si e' preso
    const quote = new Map();
    const aggiungi = (m) => { for (const [k, v] of m) { const x = quote.get(k) || { target: 0, stimato: false }; x.target = t3(x.target + v.target); x.stimato = x.stimato || v.stimato; quote.set(k, x); } };
    let sommaMesi = 0;
    if (mesi) {
      for (let i = 0; i < 12; i++) {
        if (!(mesi.tot[i] > 0)) continue;
        sommaMesi = t3(sommaMesi + mesi.tot[i]);
        aggiungi(ripartisciQuota({ target: mesi.tot[i], scritto: mesi.scritto[i], arrivato: (sua ? sua.mesi[i] : new Map()), riferimento: rif }));
      }
    }
    const resto = t3(t - sommaMesi);
    if (resto > 0) aggiungi(ripartisciQuota({ target: resto, arrivato: (sua ? sua.anno : new Map()), riferimento: rif }));

    const finali = normalizzaQuote(quote, t);
    for (const [k, v] of finali) {
      // la quota senza posto non si butta in silenzio: la dice senzaStorico
      if (!k) { senzaStorico.push({ raccoglitore: r.raccoglitore || '', regione: r.regione || '', target_t: v.target }); continue; }
      per.set(k, t3((per.get(k) || 0) + v.target));
      const d = dettaglio.get(k) || [];
      d.push({ raccoglitore: r.raccoglitore || '', regione: r.regione || '', t: v.target, stimato: v.stimato });
      dettaglio.set(k, d);
    }
  }
  return { per, dettaglio, senzaStorico };
}


/**
 * I due target di una riga di Giacenze (tonnellate), letti da Target & Status:
 * - target_totale_t, solo per gli impianti: il target dell'impianto di
 *   esattamente quell'anno (ImpiantoTargetSecondaria, chili, con
 *   targetImpiantoDellAnno);
 * - target_primarie_t: la somma dei target dei raccoglitori di quell'anno legati
 *   al sito (TargetRaccoglitore.impianto, con targetPrimarieDelSito), piu' la
 *   quota che a questo sito arriva dalla ripartizione sullo storico dei
 *   conferimenti (ripartite, da ripartisciTargetPrimarie). Le righe senza ruolo
 *   non dicono se portano all'impianto o allo stoccaggio: la loro somma va su una
 *   riga sola del sito (primarieQui), di norma quella dell'impianto, perche' il
 *   totale non la conti due volte. Le quote ripartite il ruolo ce l'hanno, perche'
 *   lo dice il viaggio.
 *
 * Transizione (27/09/2026): finche' un numero e' scritto solo nel vecchio campo di
 * Giacenze (GiacenzaSito.target_totale_t / target_primarie_t) si usa quello, e
 * da_portare lo dice, per chiedere di portarlo in Target & Status. Per le
 * primarie il vecchio campo vale solo se il sito, in Target & Status, non ne ha.
 *
 * da_portare.spento: il target e' in Giacenze perche' l'impianto, in Target &
 * Status, per quell'anno c'e' ma non e' attivo.
 *
 * @returns {{ target_totale_t: number, target_primarie_t: number, target_primarie_ripartite_t: number, ripartizione: object[], da_portare: { totale: boolean, primarie: boolean, spento: boolean }, record: object|null }}
 */
export function targetRigaGiacenze({ sito, td, anno, giacenzaSito = null, impiantiTarget = [], raccoglitori = [], primarieQui = td === 'imp', soloRuolo = false, ripartite = null, chiave = normalizzaRagioneSociale }) {
  const da_portare = { totale: false, primarie: false, spento: false, primarie_senza_impianto: false };
  let target_totale_t = 0;
  let record = null;
  if (td === 'imp') {
    const t = targetImpiantoDellAnno(impiantiTarget, sito, anno, chiave);
    if (t) record = t.record;
    // un record attivo con target zero o vuoto non cancella il target scritto in
    // Giacenze (28/09/2026): finche' in Target & Status non c'e' un numero vale il vecchio
    if (t && t.kg > 0) target_totale_t = t.kg / 1000;
    else if (Number(giacenzaSito?.target_totale_t) > 0) {
      target_totale_t = Number(giacenzaSito.target_totale_t);
      da_portare.totale = true;
      // l'impianto c'e' in Target & Status per quell'anno, ma e' spento: va riacceso a mano
      const k = chiave(sito);
      da_portare.spento = !t && !!k && recordDellAnno(impiantiTarget, anno).some(r => chiave(r.nome_impianto) === k);
    }
  }
  let target_primarie_t = 0;
  // IL RUOLO SCRITTO SULLA RIGA DECIDE SU QUALE DELLE DUE RIGHE DEL SITO VA.
  //
  // Un sito con due ruoli - il capannone e il piazzale - in Giacenze ha due
  // righe, e il target puo' essere diverso sulle due. Le righe del target che il
  // ruolo non ce l'hanno scritto (quasi tutte) vanno dove andavano prima: sulla
  // riga che porta le primarie del sito, che e' l'impianto, o il piazzale se
  // l'impianto non c'e'. Se poi di quel sito esiste una riga sola, quella prende
  // tutto, ruoli compresi, perche' altrimenti un target resterebbe senza casa.
  const q = targetPrimariePerRuolo(raccoglitori, sito, anno, chiave);
  // LE QUOTE RIPARTITE SULLO STORICO (05/10/2026), che il ruolo lo portano
  // scritto: vanno sulla riga del ruolo a cui il materiale e' arrivato, e solo
  // se di quel ruolo la riga non c'e' finiscono sull'altra (soloRuolo).
  const kSito = chiave(sito);
  const quota = (r) => (ripartite?.per && kSito ? Number(ripartite.per.get(kSito + '|' + r)) || 0 : 0);
  const chi = (r) => (ripartite?.dettaglio && kSito ? ripartite.dettaglio.get(kSito + '|' + r) || [] : []);
  const suoTd = td === 'stoc' ? 'stoc' : 'imp';
  const altroTd = td === 'stoc' ? 'imp' : 'stoc';
  const rSuo = quota(suoTd);
  const rAltro = quota(altroTd);
  const ripartizione = [...chi(suoTd), ...(soloRuolo ? chi(altroTd) : [])];
  let target_primarie_ripartite_t = 0;
  const somma = q.imp + q.stoc + q.senza + rSuo + rAltro;
  if (somma > 0) {
    const suo = td === 'stoc' ? q.stoc : q.imp;
    const altro = td === 'stoc' ? q.imp : q.stoc;
    target_primarie_ripartite_t = Math.round((rSuo + (soloRuolo ? rAltro : 0)) * 1000) / 1000;
    target_primarie_t = Math.round((suo + (soloRuolo ? altro : 0) + (primarieQui ? q.senza : 0) + target_primarie_ripartite_t) * 1000) / 1000;
  }
  else if (Number(giacenzaSito?.target_primarie_t) > 0) {
    target_primarie_t = Number(giacenzaSito.target_primarie_t);
    da_portare.primarie = true;
    // DIRE QUAL E' LA COSA CHE MANCA DAVVERO.
    //
    // Il target delle primarie di un sito e' la somma dei target dei raccoglitori
    // LEGATI a quel sito, cioe' delle righe che hanno scritto l'impianto. Quando
    // i target dei raccoglitori ci sono ma nessuno porta il nome di questo sito,
    // l'avviso diceva «scrivi i target dei raccoglitori»: e l'utente li aveva
    // gia' scritti tutti, 11.550 tonnellate, e non capiva che cosa gli si stesse
    // chiedendo. Sono due situazioni diverse e vanno dette in due modi
    // (04/10/2026, dopo che l'avviso ha mandato l'utente a cercare un dato che
    // c'era gia').
    da_portare.primarie_senza_impianto = recordDellAnno(raccoglitori, anno)
      .some(r => Number(r.target_tonnellate) > 0);
  }
  return { target_totale_t, target_primarie_t, target_primarie_ripartite_t, ripartizione, da_portare, record };
}

/** Il testo dell'anomalia di un target ancora scritto solo in Giacenze. */
export const testoTargetDaPortare = (cosa = 'totale') => (cosa === 'primarie_senza_impianto'
  ? "target delle primarie ancora scritto in Giacenze: i target dei raccoglitori ci sono, ma nessuno e' legato a questo sito e nell'anno nessuno ci ha portato primarie da ripartire - scrivi l'impianto sulle loro righe in Target & Status"
  : cosa === 'primarie'
    ? "target delle primarie ancora scritto in Giacenze: per quest'anno non c'e' nessun target dei raccoglitori, scrivili in Target & Status"
    : cosa === 'spento'
    ? "target ancora scritto in Giacenze: in Target & Status l'impianto c'e' ma non e' attivo, riattivalo a mano e scrivi li' il target"
    : "target ancora scritto in Giacenze: portalo in Target & Status");
