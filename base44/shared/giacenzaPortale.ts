// La giacenza di rete a portale di un impianto, aggiornata a ogni caricamento.
//
// Il portale la da' nel file degli ordini non dichiarati: e' una fotografia, del
// giorno in cui il file e' stato caricato. Ma a ogni caricamento dei movimenti la
// giacenza cambia, per entrate e per uscite, e i moduli la devono seguire
// (regola dell'utente, 21/09/2026). Percio':
//
//   giacenza a portale = fotografia
//                        + i carichi che il gestionale conosce e il file no
//                        - le dichiarazioni caricate a portale dopo la fotografia
//
// Che cosa il portale conosce si decide dal NUMERO D'ORDINE, cercato fra gli
// ordini non dichiarati e nel report delle dichiarazioni: mai dalla data di
// chiusura dell'ordine a portale, che in nessun modulo decide nulla. Tutte le
// date sono giorni italiani di fine trasporto.
//
// La usano Dichiarazioni Impianti e Giacenze, cosi' i due moduli non possono
// dare numeri diversi.
//
// Un terminato SENZA FINE TRASPORTO (22/09/2026): il portale puo' conoscerlo,
// il gestionale non lo colloca. Non entra fra i carichi aggiunti alla
// fotografia, perche' senza giorno non si sa se e' arrivato prima o dopo; ma se
// il file del portale lo contiene, nella giacenza a portale c'e'. La differenza
// non si nasconde: formulariDaSistemare, qui sotto, dice per soggetto e canale
// quali sono e quanto pesano, e avvisoSenzaFine lo scrive.
import { giornoRoma } from "./giornoItaliano.ts";
import { eTerminato, dateDaSistemare, dateMancanti, dateIncoerenti, testoDate, giornoMovimento, annoOrdine, MESI_MOVIMENTI } from "./movimenti.ts";
import { eAci } from "./canaleSecondaria.ts";

/** Il giorno della fotografia: quello dell'ultimo file degli ordini non dichiarati caricato. */
export function giornoFotografia(nonDichiarati) {
  let max = '';
  for (const r of nonDichiarati || []) {
    const g = giornoRoma(r.created_date);
    if (g > max) max = g;
  }
  return max;
}

/**
 * Gli ordini che il portale conosce. Si segnano le righe degli ordini non
 * dichiarati e del report delle dichiarazioni; poi si chiede di un movimento.
 *
 * `fonte` dice da quale file viene la riga: 'non_dichiarati' (il default) o
 * 'dichiarazioni'. Serve a distinguire, per un terminato senza fine trasporto,
 * chi il portale conta ancora nella sua giacenza (e' fra i non dichiarati) da
 * chi ha gia' dichiarato (22/09/2026). Si tiene anche la fine trasporto che il
 * portale scrive per la primaria: se al formulario nel gestionale manca, la
 * data c'e' e va riportata.
 */
export function ordiniNotiAlPortale() {
  const primarie = new Set();
  const secondarie = new Set();
  const primarieNelFile = new Set();
  const secondarieNelFile = new Set();
  const finePrimaria = new Map(); // id della primaria -> giorno di fine trasporto scritto dal portale
  return {
    segna(r, fonte = 'non_dichiarati') {
      const p = String(r && r.ordine_primaria || '').trim();
      const s = String(r && r.ordine_secondaria || '').trim();
      const nelFile = fonte !== 'dichiarazioni';
      if (p) { primarie.add(p); if (nelFile) primarieNelFile.add(p); }
      if (s) { secondarie.add(s); if (nelFile) secondarieNelFile.add(s); }
      // La fine trasporto della riga e' quella della primaria (per una riga
      // passata da uno stoccaggio, l'arrivo allo stoccaggio): mai la chiusura.
      const g = giornoRoma(r && r.fine_trasporto);
      if (p && g && !finePrimaria.has(p)) finePrimaria.set(p, g);
    },
    /** Vero se il portale conosce il movimento: una primaria o una secondaria. */
    noto(movimento, tipo = 'primaria') {
      const id = String(movimento && movimento.id_ordine || '').trim();
      return !!id && (tipo === 'secondaria' ? secondarie.has(id) : primarie.has(id));
    },
    /** Vero se il movimento e' fra gli ordini non dichiarati: il portale lo conta nella sua giacenza. */
    nelFile(movimento, tipo = 'primaria') {
      const id = String(movimento && movimento.id_ordine || '').trim();
      return !!id && (tipo === 'secondaria' ? secondarieNelFile.has(id) : primarieNelFile.has(id));
    },
    /** La fine trasporto che il portale scrive per una primaria, 'AAAA-MM-GG'; stringa vuota se non la scrive. */
    fineAPortale(movimento) {
      return finePrimaria.get(String(movimento && movimento.id_ordine || '').trim()) || '';
    },
  };
}

/**
 * Le dichiarazioni di rete caricate a portale dopo la fotografia, per sito: il
 * file del portale le conta ancora come giacenza, il gestionale no.
 * @param {array} dichiarazioniSito  record DichiarazioneSito
 * @param {string} foto              giorno della fotografia
 * @param {function} chiaveDi        normalizzazione della ragione sociale
 * @param {number} primaDelMese      facoltativo: solo i mesi prima di questo (0-11)
 */
export function dichiaratoDopoLaFotografia(dichiarazioniSito, foto, chiaveDi, primaDelMese = 12) {
  const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const per = new Map();
  if (!foto) return per;
  for (const d of dichiarazioniSito || []) {
    if ((d.canale || 'RETE') !== 'RETE' || d.provenienza) continue;
    if (!d.caricata_inviata || !(String(d.caricata_il || '').slice(0, 10) > foto)) continue;
    if (MESI.indexOf(d.mese) >= primaDelMese) continue;
    const ns = chiaveDi(d.sito);
    if (ns) per.set(ns, (per.get(ns) || 0) + (Number(d.quantita_kg) || 0));
  }
  return per;
}

// --- I formulari terminati con le date da sistemare ---
//
// Immissione, inizio e fine trasporto sono obbligatorie (regola dell'utente,
// 22/09/2026: "se non ci sono vanno segnalate e questo vale sempre dove ci sono
// ordini terminati, non solo nei report settimanali"). Le regole sulle date
// stanno in shared/movimenti.ts (dateMancanti, dateIncoerenti, testoDate): qui
// si raccolgono i terminati che arrivano a un impianto o a uno stoccaggio, o che
// ne partono, per soggetto e per canale. Rete, ACI ed extra raccolta restano su
// gruppi diversi e non si sommano nemmeno nel conteggio.
//
// L'anno: quello della fine trasporto; chi non ce l'ha si conta nell'anno
// dell'immissione (annoOrdine, che serve apposta a questo conteggio e non
// colloca il movimento in nessun periodo); chi non ha nemmeno l'immissione si
// segnala in ogni anno, perche' non ce n'e' uno a cui attribuirlo.
//
// Con un'eccezione (22/09/2026): la fotografia del portale non ha anno. Un
// senza fine trasporto immesso in un altro anno - il caso frequente e' immesso a
// fine dicembre e arrivato a gennaio: nel file del 18/09/2026 le righe immesse
// prima del 2026 erano 211 - che il portale conosce e' nella sua giacenza anche
// oggi. Scartarlo per l'anno dell'immissione nascondeva la differenza proprio
// dove va detta. Percio' si tiene in sospeso (fuori_anno) e i gruppi lo tengono
// se il portale lo conosce; se no resta nell'anno della sua immissione. Chi ha la
// fine trasporto in un altro anno si segnala in quello, come sempre: e' collocato.

const ORDINE_CANALI = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];

/**
 * Raccoglitore dei terminati con le date da sistemare.
 *   const f = formulariDaSistemare({ anno, chiaveDi });
 *   f.segna(r, { tipo, canale, ruolo, verso, sito, controparte });
 *   f.gruppi(portaleConosce) -> [{ sito, chiave, ruolo, canale, n, arrivi, arrivi_kg, partenze, partenze_kg, senza_fine, ordini }]
 *   f.perCanale(portaleConosce) -> { RETE: {...}, ACI: {...}, EXTRA_RACCOLTA: {...} }
 * tipo: 'primaria' | 'secondaria' | 'terziaria'; ruolo: 'imp' | 'stoc';
 * verso: 'arrivo' (arriva al soggetto) | 'partenza' (parte dal soggetto).
 * `portaleConosce` e' ordiniNotiAlPortale() gia' riempito: dice quali dei
 * senza fine trasporto il portale conosce. L'extra raccolta a portale non c'e'.
 *
 * Arrivi e partenze non si sommano in un peso (22/09/2026): una terziaria che
 * parte dall'impianto e' materiale diverso, in verso opposto, e nella giacenza
 * di PFU non entra comunque. I pesi sono sempre divisi: arrivi_kg, partenze_kg.
 */
export function formulariDaSistemare({ anno = null, chiaveDi = (s) => String(s || '').trim().toLowerCase() } = {}) {
  const per = new Map(); // chiave|ruolo|canale -> { ..., ordini: Map }
  const annoNum = anno === null || anno === undefined || anno === '' ? null : Number(anno);

  // Gli ordini di un gruppo con quello che il portale ne sa. Un senza fine
  // trasporto di un altro anno resta solo se il portale lo conosce: e' nella sua
  // giacenza (o l'ha dichiarato), che anno non ne ha. Dove non si puo' chiedere
  // (ACI, extra raccolta, terziarie, o nessun portale) resta nel suo anno.
  const tenuti = (g, portale) => [...g.ordini.values()].map(({ tipo_portale, ...o }) => {
    const chiedi = !!(portale && tipo_portale);
    const mov = { id_ordine: o.id_ordine };
    return {
      ...o,
      noto_al_portale: chiedi ? portale.noto(mov, tipo_portale) : null,
      nel_file: chiedi && portale.nelFile ? portale.nelFile(mov, tipo_portale) : null,
      fine_a_portale: chiedi && tipo_portale === 'primaria' && o.senza_fine && portale.fineAPortale ? portale.fineAPortale(mov) : '',
    };
  }).filter(o => !o.fuori_anno || o.noto_al_portale === true);

  return {
    /**
     * Segna il movimento se e' un terminato con le date da sistemare; vero se
     * l'ha segnato. Un senza fine trasporto di un altro anno si segna in sospeso:
     * se resta lo decide gruppi(), quando si sa che cosa conosce il portale.
     */
    segna(r, dove) {
      if (!r || !dove || !dateDaSistemare(r)) return false;
      const a = annoOrdine(r);
      const senzaFine = !giornoMovimento(r);
      const fuoriAnno = annoNum !== null && a !== null && a !== annoNum;
      if (fuoriAnno && !senzaFine) return false;
      const sito = String(dove.sito || '').replace(/\s+/g, ' ').trim();
      const ns = chiaveDi(sito);
      if (!ns) return false;
      const ruolo = dove.ruolo === 'stoc' ? 'stoc' : 'imp';
      const canale = dove.canale || 'RETE';
      const k = `${ns}|${ruolo}|${canale}`;
      if (!per.has(k)) per.set(k, { sito, chiave: ns, ruolo, canale, ordini: new Map() });
      const g = per.get(k);
      const id = String(r.id_ordine || '').trim();
      const formulario = `${dove.tipo}|${id || r.numero_fir || r.id || `${k}|${g.ordini.size}`}`;
      const chiaveOrdine = `${formulario}|${dove.verso}`;
      if (g.ordini.has(chiaveOrdine)) return true;
      g.ordini.set(chiaveOrdine, {
        tipo: dove.tipo || 'primaria',
        verso: dove.verso === 'partenza' ? 'partenza' : 'arrivo',
        id_ordine: id,
        numero_fir: r.numero_fir || '',
        controparte: String(dove.controparte || '').trim(),
        kg: Math.round(Number(r.peso_effettivo) || 0),
        immesso_il: giornoRoma(r.ordine_immesso_il),
        iniziato_il: giornoRoma(r.trasporto_iniziato_il),
        finito_il: giornoMovimento(r),
        mancano: dateMancanti(r),
        incoerenze: dateIncoerenti(r),
        testo: testoDate(r),
        senza_fine: senzaFine,
        // Immesso in un altro anno e senza fine trasporto: resta se il portale lo conosce.
        fuori_anno: fuoriAnno,
        // Lo stesso formulario su due soggetti (la secondaria): nei conteggi per canale vale uno.
        formulario,
        // Che il portale lo conosca si chiede per numero d'ordine, e solo per
        // primarie e secondarie di rete: i due file che lo dicono (ordini non
        // dichiarati e report delle dichiarazioni) sono della rete, e l'extra
        // raccolta a portale non c'e'. Per l'ACI non si sa, e non si scrive.
        tipo_portale: canale !== 'RETE' ? '' : (dove.tipo === 'secondaria' ? 'secondaria' : dove.tipo === 'primaria' ? 'primaria' : ''),
      });
      return true;
    },

    /**
     * I gruppi, per soggetto, ruolo e canale, con i conteggi dei senza fine
     * trasporto. Di ogni ordine si dice se il portale lo conosce
     * (noto_al_portale), se lo conta ancora nella sua giacenza perche' e' fra i
     * non dichiarati (nel_file) e, per una primaria, la fine trasporto che il
     * portale scrive (fine_a_portale): null dove non si puo' chiedere.
     *
     * senza_fine.n e' quanti formulari non hanno la fine trasporto: un
     * conteggio di formulari da sistemare. I pesi sono divisi per verso,
     * arrivi_kg e partenze_kg, e non c'e' un peso che li sommi.
     */
    gruppi(portale = null) {
      const esito = [];
      for (const g of per.values()) {
        const ordini = tenuti(g, portale).map(({ formulario: _f, ...o }) => o)
          .sort((a, b) => (Number(b.senza_fine) - Number(a.senza_fine))
            || String(a.immesso_il || '9999').localeCompare(String(b.immesso_il || '9999'))
            || a.id_ordine.localeCompare(b.id_ordine));
        if (!ordini.length) continue;
        const senza = ordini.filter(o => o.senza_fine);
        const somma = (l) => l.reduce((s, o) => s + o.kg, 0);
        const arrivi = ordini.filter(o => o.verso === 'arrivo');
        const partenze = ordini.filter(o => o.verso === 'partenza');
        const arriviSenza = senza.filter(o => o.verso === 'arrivo');
        const partenzeSenza = senza.filter(o => o.verso === 'partenza');
        const noti = arriviSenza.filter(o => o.noto_al_portale === true);
        const nelFile = noti.filter(o => o.nel_file === true);
        const giaDichiarati = noti.filter(o => o.nel_file === false);
        const ignoti = arriviSenza.filter(o => o.noto_al_portale === false);
        const conFineAPortale = senza.filter(o => o.fine_a_portale);
        esito.push({
          sito: g.sito, chiave: g.chiave, ruolo: g.ruolo, canale: g.canale,
          n: ordini.length,
          arrivi: arrivi.length, arrivi_kg: somma(arrivi),
          partenze: partenze.length, partenze_kg: somma(partenze),
          senza_fine: {
            n: senza.length,
            arrivi_n: arriviSenza.length, arrivi_kg: somma(arriviSenza),
            partenze_n: partenzeSenza.length, partenze_kg: somma(partenzeSenza),
            noti_al_portale_n: noti.length, noti_al_portale_kg: somma(noti),
            // Dei noti: quanti il portale conta ancora nella giacenza, quanti ha gia' dichiarato.
            nel_file_n: nelFile.length, nel_file_kg: somma(nelFile),
            gia_dichiarati_n: giaDichiarati.length, gia_dichiarati_kg: somma(giaDichiarati),
            ignoti_al_portale_n: ignoti.length, ignoti_al_portale_kg: somma(ignoti),
            // Quelli di cui il portale scrive la fine trasporto: la data c'e', va riportata.
            fine_a_portale_n: conFineAPortale.length,
            // Immessi in un altro anno: qui perche' il portale li conosce.
            fuori_anno_n: senza.filter(o => o.fuori_anno).length,
          },
          ordini,
        });
      }
      return esito.sort((a, b) => (a.ruolo === b.ruolo ? 0 : a.ruolo === 'imp' ? -1 : 1)
        || a.sito.localeCompare(b.sito) || ORDINE_CANALI.indexOf(a.canale) - ORDINE_CANALI.indexOf(b.canale));
    },

    /**
     * Quanti formulari, canale per canale: ciascuno una volta sola anche se
     * compare su due soggetti (una secondaria parte da uno stoccaggio e arriva a
     * un impianto). I canali non si sommano: tre conteggi, mai un totale.
     *
     * Dei senza fine trasporto: quanti in tutto (senza_fine, un conteggio), poi
     * divisi per verso. Un ARRIVO e' un formulario che arriva a un impianto o a
     * uno stoccaggio (primarie e secondarie); una PARTENZA uno che parte da un
     * soggetto e non arriva a nessuno dei nostri (le terziarie). I pesi restano
     * divisi (22/09/2026): arrivi e partenze sono materiali diversi, in versi
     * opposti, e un peso che li somma non vuol dire niente. Stesso `portale` di
     * gruppi(), perche' gli ordini siano gli stessi.
     */
    perCanale(portale = null) {
      const visti = Object.fromEntries(ORDINE_CANALI.map(c => [c, new Map()]));
      for (const g of per.values()) {
        const m = visti[g.canale] || (visti[g.canale] = new Map());
        for (const o of tenuti(g, portale)) {
          const prima = m.get(o.formulario);
          m.set(o.formulario, { ...o, arriva: (prima && prima.arriva) || o.verso === 'arrivo' });
        }
      }
      return Object.fromEntries(Object.entries(visti).map(([c, m]) => {
        const l = [...m.values()];
        const senza = l.filter(o => o.senza_fine);
        const arrivi = senza.filter(o => o.arriva);
        const partenze = senza.filter(o => !o.arriva);
        const kg = (x) => x.reduce((s, o) => s + o.kg, 0);
        return [c, {
          n: l.length,
          senza_fine: senza.length,
          arrivi_senza_fine: arrivi.length, arrivi_senza_fine_kg: kg(arrivi),
          partenze_senza_fine: partenze.length, partenze_senza_fine_kg: kg(partenze),
        }];
      }));
    },
  };
}

const kgScritti = (v) => String(Math.round(Number(v) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const quanti = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;

/**
 * Che cosa comporta un gruppo di formulariDaSistemare senza fine trasporto, a
 * parole. contesto 'quadratura' (Dichiarazioni Impianti: giacenza calcolata
 * contro portale) o 'giacenze' (modulo Giacenze: la giacenza a portale
 * aggiornata ai caricamenti). Stringa vuota se non manca nessuna fine trasporto:
 * le altre date mancanti si segnalano nell'elenco, ma quegli ordini sono nei conti.
 *
 * La differenza fra portale e gestionale si dice, non si nasconde (22/09/2026):
 * - un arrivo che il portale ha fra i NON DICHIARATI e' nella giacenza a portale
 *   e in nessun mese del gestionale;
 * - uno che risulta GIA' DICHIARATO nella giacenza del portale non c'e' piu'; la
 *   calcolata esce piu' bassa anche di lui solo se quella dichiarazione e'
 *   registrata anche qui come caricata, e lo si dice cosi';
 * - uno che il portale NON CONOSCE non e' in nessuna delle due, perche' senza
 *   giorno non si aggiunge alla fotografia;
 * - per uno stoccaggio non si sa se il movimento e' prima o dopo la rilevazione.
 */
export function avvisoSenzaFine(g, contesto = 'quadratura') {
  const sf = g && g.senza_fine;
  if (!sf || !sf.n) return '';
  const frasi = [];
  const imp = g.ruolo !== 'stoc';
  const quadra = contesto === 'quadratura';
  const cosa = [];
  if (sf.arrivi_n) cosa.push(`${quanti(sf.arrivi_n, 'ordine arrivato', 'ordini arrivati')} (${kgScritti(sf.arrivi_kg)} kg)`);
  if (sf.partenze_n) cosa.push(`${quanti(sf.partenze_n, imp ? 'terziaria partita' : 'secondaria partita', imp ? 'terziarie partite' : 'secondarie partite')} (${kgScritti(sf.partenze_kg)} kg)`);
  const uno = sf.n === 1;
  frasi.push(`Senza la data di fine trasporto: ${cosa.join(' e ')}. ${uno ? 'Non si colloca' : 'Non si collocano'} in nessun mese finche' la data non arriva.`);
  // Immessi in un altro anno: si segnalano anche qui perche' il portale li
  // conosce, e la fotografia del portale anno non ne ha (22/09/2026).
  if (sf.fuori_anno_n) {
    const fa = sf.fuori_anno_n;
    frasi.push(`${fa === 1 ? '1 e\' stato immesso' : `${fa} sono stati immessi`} in un altro anno: ${fa === 1 ? 'compare' : 'compaiono'} anche qui perche' il portale ${fa === 1 ? 'lo conosce' : 'li conosce'}, e la sua giacenza non ha anno.`);
  }
  // Il portale scrive la fine trasporto della primaria: nel formulario va riportata.
  const fine = () => {
    const n = sf.fine_a_portale_n || 0;
    if (n) frasi.push(`${n === 1 ? 'Per 1 ordine' : `Per ${n} ordini`} la fine trasporto la scrive il portale: va riportata nel formulario del gestionale.`);
    return frasi.join(' ');
  };
  if (g.canale === 'EXTRA_RACCOLTA') {
    frasi.push(`L'extra raccolta a portale non c'e': la sua giacenza, fuori portale, ${uno ? 'non lo conta' : 'non li conta'}.`);
    return frasi.join(' ');
  }
  if (!imp) {
    // La rilevazione e' il saldo del portale a quel giorno: un movimento senza
    // giorno puo' esserci dentro o no, e fra i movimenti dopo non entra.
    const parti = [];
    if (sf.arrivi_n) parti.push(sf.arrivi_n === 1 ? 'se l\'arrivo e\' dopo la rilevazione, la giacenza dello stoccaggio non lo conta' : 'degli arrivi dopo la rilevazione la giacenza dello stoccaggio non tiene conto');
    if (sf.partenze_n) parti.push(sf.partenze_n === 1 ? 'se la partenza e\' dopo la rilevazione, la giacenza dello stoccaggio la conta ancora' : 'le partenze dopo la rilevazione la giacenza dello stoccaggio le conta ancora');
    frasi.push(`Non si sa se ${uno ? 'e\' avvenuto' : 'sono avvenuti'} prima o dopo la rilevazione del portale: ${parti.join('; ')}.`);
    if (quadra) frasi.push(`Nella giacenza calcolata non ${uno ? 'entra' : 'entrano'}, ne' fra le entrate ne' fra le partenze dell'anno.`);
    return fine();
  }
  if (sf.arrivi_n && g.canale === 'RETE') {
    const arrivo = sf.arrivi_n === 1 ? 'L\'arrivo non entra' : 'Gli arrivi non entrano';
    frasi.push(quadra
      ? `${arrivo} nella giacenza calcolata.`
      : `${arrivo} nel conferito dell'anno ne' fra i carichi aggiunti alla fotografia del portale.`);
    if (sf.noti_al_portale_n) {
      const lo = sf.noti_al_portale_n === 1;
      const nf = sf.nel_file_n || 0;
      const gd = sf.gia_dichiarati_n || 0;
      // Si sa dove il portale conta ciascuno solo se ha letto anche da quale file viene.
      const diviso = (nf || gd) && nf + gd === sf.noti_al_portale_n;
      if (quadra && diviso) {
        // Fra i non dichiarati e' certo: il portale lo conta, la calcolata no. Gia'
        // dichiarato dipende da noi: la calcolata esce piu' bassa solo se quella
        // dichiarazione e' registrata anche qui come caricata.
        frasi.push(`Il portale ne conosce ${sf.noti_al_portale_n} (${kgScritti(sf.noti_al_portale_kg)} kg).`);
        if (nf) frasi.push(`${nf === 1 ? '1 e\'' : `${nf} sono`} fra gli ordini non dichiarati (${kgScritti(sf.nel_file_kg)} kg), e quindi nella sua giacenza: nei suoi conti ${nf === 1 ? 'c\'e\'' : 'ci sono'}, nel gestionale no, e la giacenza calcolata esce piu' bassa di ${kgScritti(sf.nel_file_kg)} kg.`);
        if (gd) frasi.push(`${gd === 1 ? '1 risulta gia\' dichiarato' : `${gd} risultano gia' dichiarati`} (${kgScritti(sf.gia_dichiarati_kg)} kg): nella giacenza del portale non ${gd === 1 ? 'c\'e\'' : 'ci sono'} piu', e se la dichiarazione e' registrata anche qui come caricata la calcolata esce piu' bassa anche di quei ${kgScritti(sf.gia_dichiarati_kg)} kg.`);
      } else if (quadra) {
        frasi.push(`Il portale ne conosce ${sf.noti_al_portale_n} (${kgScritti(sf.noti_al_portale_kg)} kg) e ${lo ? 'lo conta' : 'li conta'} nella sua giacenza.`
          + ` Nei suoi conti ${lo ? 'c\'e\'' : 'ci sono'}, nel gestionale no: la giacenza calcolata esce piu' bassa di ${kgScritti(sf.noti_al_portale_kg)} kg.`);
      } else if (diviso) {
        if (nf) frasi.push(`${nf === 1 ? '1 arrivo' : `${nf} arrivi`} (${kgScritti(sf.nel_file_kg)} kg) ${nf === 1 ? 'e\'' : 'sono'} fra gli ordini non dichiarati del portale, e quindi nella giacenza a portale: il gestionale non ${nf === 1 ? 'lo colloca' : 'li colloca'} in nessun mese.`);
        if (gd) frasi.push(`${gd === 1 ? '1 arrivo' : `${gd} arrivi`} (${kgScritti(sf.gia_dichiarati_kg)} kg) ${gd === 1 ? 'risulta' : 'risultano'} gia' ${gd === 1 ? 'dichiarato' : 'dichiarati'} a portale: nella giacenza non ${gd === 1 ? 'c\'e\'' : 'ci sono'} piu'.`);
      } else {
        frasi.push(`Il portale ne conosce ${sf.noti_al_portale_n} (${kgScritti(sf.noti_al_portale_kg)} kg) e ${lo ? 'lo conta' : 'li conta'} nella sua giacenza: il gestionale non ${lo ? 'lo colloca' : 'li colloca'}.`);
      }
    }
    if (sf.ignoti_al_portale_n) {
      const lo = sf.ignoti_al_portale_n === 1;
      frasi.push(`${quanti(sf.ignoti_al_portale_n, 'arrivo', 'arrivi')} (${kgScritti(sf.ignoti_al_portale_kg)} kg) il portale non ${lo ? 'lo conosce' : 'li conosce'} ancora: `
        + (quadra
          ? `non ${lo ? 'e\'' : 'sono'} in nessuna delle due giacenze.`
          : `senza la data non ${lo ? 'si aggiunge' : 'si aggiungono'} alla fotografia, e alla giacenza a portale ${lo ? 'manca' : 'mancano'} finche' la fine trasporto non arriva.`));
    }
  } else if (sf.arrivi_n) {
    frasi.push(`${sf.arrivi_n === 1 ? 'L\'arrivo non entra' : 'Gli arrivi non entrano'} nel conferito ${g.canale === 'ACI' ? 'ACI ' : ''}dell'anno.`);
  }
  if (sf.partenze_n) frasi.push(sf.partenze_n === 1 ? 'La terziaria resta fuori dalle uscite dell\'anno; la giacenza di PFU non la tocca.' : 'Le terziarie restano fuori dalle uscite dell\'anno; la giacenza di PFU non la toccano.');
  return fine();
}

/**
 * I formulari del gestionale dietro le righe del file degli ordini non
 * dichiarati (22/09/2026). Una riga e' un ordine che il PORTALE conosce: il suo
 * formulario nel gestionale e' la primaria e, se il carico e' passato da uno
 * stoccaggio, la secondaria che l'ha portato all'impianto. Si segnano i
 * movimenti terminati con le date da sistemare, poi si chiede di una riga.
 *
 *   const f = formulariDelFile();
 *   f.segna(primaria, 'primaria'); f.segna(secondaria, 'secondaria');
 *   f.diRiga(riga) -> { formulari: [...], fuori, fine_a_portale, fine_dal_gestionale }
 *
 * `fuori` e' vero quando manca la fine trasporto del movimento che ha portato il
 * carico all'impianto: il portale lo conta nella giacenza, il gestionale non lo
 * colloca in nessun mese. `fine_a_portale` e' la fine trasporto della primaria
 * scritta nel file, quando al formulario manca: va riportata. Le secondarie ne
 * hanno una sola, la loro, che il file non scrive.
 *
 * Il caso rovescio: una riga del file senza fine trasporto, la cui primaria nel
 * gestionale la fine trasporto ce l'ha. Allora vale quella (fine_dal_gestionale):
 * e' sempre la fine trasporto, mai la chiusura, e Dichiarazioni Impianti colloca
 * la riga nello stesso modo.
 */
export function formulariDelFile() {
  const primarie = new Map();
  const secondarie = new Map();
  const finePrimarie = new Map(); // id della primaria terminata -> giorno di fine trasporto nel gestionale
  return {
    segna(r, tipo = 'primaria') {
      const id = String(r && r.id_ordine || '').trim();
      if (id && tipo !== 'secondaria' && eTerminato(r) && giornoMovimento(r)) finePrimarie.set(id, giornoMovimento(r));
      if (!id || !dateDaSistemare(r)) return false;
      (tipo === 'secondaria' ? secondarie : primarie).set(id, {
        tipo: tipo === 'secondaria' ? 'secondaria' : 'primaria',
        id_ordine: id,
        numero_fir: r.numero_fir || '',
        mancano: dateMancanti(r),
        testo: testoDate(r),
        senza_fine: !giornoMovimento(r),
      });
      return true;
    },
    diRiga(riga) {
      const prim = primarie.get(String(riga && riga.ordine_primaria || '').trim()) || null;
      const secId = String(riga && riga.ordine_secondaria || '').trim();
      const sec = secId ? secondarie.get(secId) || null : null;
      // Il movimento che arriva all'impianto: la secondaria, se la riga e' passata da uno stoccaggio.
      const arrivo = String(riga && riga.destinazione_secondaria || '').trim() && secId ? sec : prim;
      const fineFile = giornoRoma(riga && riga.fine_trasporto);
      return {
        formulari: [prim, sec].filter(Boolean),
        fuori: !!(arrivo && arrivo.senza_fine),
        fine_a_portale: prim && prim.senza_fine && fineFile ? fineFile : '',
        fine_dal_gestionale: fineFile ? '' : finePrimarie.get(String(riga && riga.ordine_primaria || '').trim()) || '',
      };
    },
  };
}

// --- La fotografia del portale, sul giorno in cui il carico e' arrivato ---
//
// Le righe del file degli ordini non dichiarati dicono a quale impianto il
// portale attribuisce un carico e quanto aspetta ancora di vederlo dichiarato.
// Dichiarazioni Impianti le colloca sul giorno in cui il carico e' ARRIVATO
// all'impianto: serve a dire "questo mese e' da dichiarare" e a dare la
// giacenza di rete a portale alla fine di ogni mese, su cui la pratica di Irigom
// calcola quanto dichiarare. Stava dentro riepilogoDichiarazioni; e' qui perche'
// si possa provare (prove/giacenzaPortale.mjs), 22/09/2026.
//
// - Un carico passato da uno stoccaggio arriva all'impianto con la SECONDARIA:
//   conta la sua fine trasporto, non quella della riga, che e' della primaria
//   allo stoccaggio. Verificato su agosto 2026: cosi' la giacenza di Irigom a
//   fine mese torna al chilo col registro dell'impianto.
// - Una secondaria terminata nel gestionale senza fine trasporto non ha un
//   giorno di arrivo: non si ripiega sulla fine trasporto della riga, che
//   metterebbe il carico in un mese sbagliato, piu' vecchio. Il carico resta
//   nella giacenza a portale, in nessuna fine mese, e si dice (senzaGiorno).
// - Una riga senza fine trasporto prende quella della primaria nel gestionale:
//   sempre la fine trasporto, mai la chiusura.
// - Il mese porta anche l'anno: un carico arrivato a dicembre dell'anno prima e
//   ancora da dichiarare non e' del dicembre di quest'anno.

/**
 * @param {array} nonDichiarati  righe OrdineNonDichiarato
 * @param {object} opzioni
 *   chiaveDi(s)        normalizzazione della ragione sociale
 *   ruoloPrimaria(id)  'stoc' se nel gestionale la primaria e' andata a uno stoccaggio
 *   secondarie         record Secondaria del gestionale
 *   finePrimaria(id)   fine trasporto ('AAAA-MM-GG') della primaria terminata nel gestionale, '' se non c'e'
 * @returns {{ portale, inAttesa, attesaCoppia, aPortale, perMese, perGiorno, senzaGiorno }}
 *   portale       Map ns impianto -> t della fotografia
 *   inAttesa      Map ns stoccaggio -> t gia' partite che il portale attribuisce ancora allo stoccaggio
 *   attesaCoppia  Map 'nsStoccaggio|nsImpianto' -> t partite e non ancora dichiarate
 *   aPortale      Set di chi compare nella fotografia
 *   perMese       Map 'ns|AAAA-MM' -> kg ancora da dichiarare, arrivati all'impianto in quel mese
 *   perGiorno     Map ns impianto -> Map giorno di arrivo -> kg
 *   senzaGiorno   Map ns impianto -> { n, kg, ordini } dei carichi senza un giorno di arrivo
 */
export function collocaFotografia(nonDichiarati, { chiaveDi = (s) => String(s || '').trim().toLowerCase(), ruoloPrimaria = () => '', secondarie = [], finePrimaria = () => '' } = {}) {
  const somma = (mappa, chiave, valore) => mappa.set(chiave, (mappa.get(chiave) || 0) + valore);
  const fineSecondaria = new Map(); // id della secondaria -> giorno in cui e' arrivata all'impianto
  const secondarieSenzaFine = new Set(); // id delle secondarie terminate che nel gestionale non hanno la fine trasporto
  for (const r of secondarie || []) {
    const id = String(r && r.id_ordine || '').trim();
    const g = giornoRoma(r && r.trasporto_finito_il);
    if (id && g) fineSecondaria.set(id, g);
    else if (id && eTerminato(r)) secondarieSenzaFine.add(id);
  }
  const esito = {
    portale: new Map(), inAttesa: new Map(), attesaCoppia: new Map(), aPortale: new Set(),
    perMese: new Map(), perGiorno: new Map(), senzaGiorno: new Map(),
  };
  for (const r of nonDichiarati || []) {
    const sec = String(r.destinazione_secondaria || '').trim();
    const sito = sec || String(r.destinazione || '').trim();
    const idPrimaria = String(r.ordine_primaria || '').trim();
    const ruolo = sec ? 'imp' : (ruoloPrimaria(idPrimaria) === 'stoc' ? 'stoc' : 'imp');
    const ns = chiaveDi(sito);
    // Il file degli ordini non dichiarati e' della rete: una riga ACI, se mai ci
    // fosse, non entra in una giacenza di rete.
    if (!ns || eAci({ prodotto: r.prodotto })) continue;
    esito.aPortale.add(ns);
    const kg = Number(r.peso_non_dichiarato_kg) || 0;
    if (ruolo === 'stoc') { somma(esito.inAttesa, ns, kg / 1000); continue; }
    somma(esito.portale, ns, kg / 1000);
    if (sec && r.destinazione) somma(esito.attesaCoppia, `${chiaveDi(r.destinazione)}|${ns}`, kg / 1000);
    const secId = String(r.ordine_secondaria || '').trim();
    const secondariaSenzaFine = !!(sec && secId && secondarieSenzaFine.has(secId));
    const g = secondariaSenzaFine ? '' : ((sec && secId && fineSecondaria.get(secId)) || giornoRoma(r.fine_trasporto) || finePrimaria(idPrimaria) || '');
    if (!g) {
      if (!esito.senzaGiorno.has(ns)) esito.senzaGiorno.set(ns, { n: 0, kg: 0, ordini: [] });
      const x = esito.senzaGiorno.get(ns);
      x.n++;
      x.kg += kg;
      x.ordini.push({
        ordine_primaria: r.ordine_primaria || '', ordine_secondaria: secId, numero_fir: r.numero_fir || '', kg: Math.round(kg),
        perche: secondariaSenzaFine ? 'la secondaria, nel gestionale, non ha la fine trasporto' : 'manca la fine trasporto, nel file del portale e nel formulario del gestionale',
      });
      continue;
    }
    somma(esito.perMese, `${ns}|${g.slice(0, 7)}`, kg);
    if (!esito.perGiorno.has(ns)) esito.perGiorno.set(ns, new Map());
    somma(esito.perGiorno.get(ns), g, kg);
  }
  for (const x of esito.senzaGiorno.values()) x.kg = Math.round(x.kg);
  return esito;
}

/**
 * La fotografia di un impianto alla fine di ogni mese dell'anno: i kg della
 * fotografia arrivati entro l'ultimo giorno del mese, dodici numeri interi.
 * Quelli senza un giorno di arrivo non ci sono mai (collocaFotografia().senzaGiorno).
 */
export function fotoAFineMese(collocata, ns, anno) {
  const giorni = (collocata && collocata.perGiorno && collocata.perGiorno.get(ns)) || new Map();
  return MESI_MOVIMENTI.map((_, i) => {
    const fine = `${anno}-${String(i + 1).padStart(2, '0')}-31`;
    let kg = 0;
    for (const [giorno, v] of giorni) if (giorno <= fine) kg += v;
    return Math.round(kg);
  });
}
