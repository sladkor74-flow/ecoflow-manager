// Quanto materiale ha davvero uno stoccaggio, adesso, un canale per volta.
//
// La rilevazione fotografa il saldo del portale per classe: P, M, G1 e G2 sono
// la rete, la classe 9 e' l'ACI. Per avere la giacenza di oggi si parte
// dall'ANCORA DELL'ANNO - la rilevazione del 31/12 precedente, o la prima
// dell'anno - e si contano i movimenti di quel canale finiti dopo. Le letture
// successive sono un riscontro: si confrontano, non spostano il numero (regola
// della direzione, 24/09/2026; puntoDiPartenza, piu' sotto).
//
// Tre regole dell'utente, senza eccezioni (21/09/2026):
// - un movimento conta dalla FINE DEL TRASPORTO, sul giorno italiano; la data di
//   chiusura dell'ordine a portale non decide nulla, nemmeno come ripiego: un
//   movimento senza fine trasporto non si conta;
// - la giacenza segue ogni caricamento: entrate e uscite dopo l'ancora;
// - rete, ACI ed extra raccolta non si sommano mai. L'extra raccolta a portale
//   non c'e': la sua giacenza si tiene a parte.
//
// Il taglio e' il GIORNO della rilevazione: i movimenti di quel giorno si
// considerano dentro, perche' chi la scrive la sera sta gia' guardando un portale
// aggiornato; contano quelli finiti dal giorno dopo. E' la stessa regola di
// Dichiarazioni Impianti, Giacenze e Predittivita': un carico non puo' risultare
// dentro per un modulo e fuori per un altro.
import { giornoRoma } from "./giornoItaliano.ts";
import { formatoKg } from "./formato.ts";

/** Un valore di data in millisecondi, trattando come UTC cio' che non porta fuso. */
export function istante(v) {
  if (!v) return null;
  const s = String(v);
  const d = new Date(/Z$|[+-]\d\d:\d\d$/.test(s) || s.length <= 10 ? s : s + 'Z');
  return isNaN(d.getTime()) ? null : d.getTime();
}

/** Il giorno a cui si riferisce una rilevazione di giacenza, 'AAAA-MM-GG'. */
export function momentoRilevazione(rec) {
  if (!rec) return '';
  return rec.data_rilevazione ? String(rec.data_rilevazione).slice(0, 10) : giornoRoma(rec.created_date);
}

/** Vero se il trasporto del movimento e' finito dopo il giorno della rilevazione. */
export function dopoLaRilevazione(movimento, giorno) {
  const g = giornoRoma(movimento && movimento.trasporto_finito_il);
  return !!g && !!giorno && g > giorno;
}

/**
 * L'ultima rilevazione per ciascuno stoccaggio, per chiave normalizzata. E' il
 * riscontro piu' recente, non il punto di partenza della giacenza: quello lo da'
 * puntiDiPartenza.
 */
export function ultimeRilevazioni(rilevazioni, chiaveDi) {
  const per = new Map();
  for (const r of rilevazioni || []) {
    const k = chiaveDi(r.sito);
    if (!k) continue;
    const quando = momentoRilevazione(r);
    const prima = per.get(k);
    // A parita' di giorno vale quella registrata per ultima.
    const piuRecente = !prima || quando > prima.quando
      || (quando === prima.quando && String(r.created_date || '') > String(prima.record.created_date || ''));
    if (piuRecente) per.set(k, { record: r, quando, data: quando });
  }
  return per;
}

/** I kg delle sole classi di rete di una rilevazione: la classe 9 e' ACI. */
export const kgReteDiRilevazione = (rec) =>
  ['class1_kg', 'class2_kg', 'class3_kg', 'class4_kg'].reduce((s, c) => s + (Number(rec && rec[c]) || 0), 0);

/** I kg ACI di una rilevazione: la classe 9, e basta. */
export const kgAciDiRilevazione = (rec) => Number(rec && rec.class9_kg) || 0;

// --- Due controlli che sorvegliano la rilevazione (23/09/2026) ---
//
// Il 16/09 la rilevazione di NAPPI SUD aveva 6.160 kg nella classe sbagliata:
// erano del formulario ET26138377, classe M, arrivato il 15/09 e chiuso a portale
// dopo la lettura, e il portale li mostrava ancora in P. Il totale era giusto, la
// ripartizione no, e la classe M usciva a -6.030 kg. Nessun caricamento poteva
// correggerla, perche' l'errore stava nel punto di partenza.
//
// Da qui due conti. Non cambiano la giacenza: la guardano da fuori.
//
// - verificaRilevazione: che cosa ci si aspettava di leggere, classe per classe,
//   partendo dalla rilevazione precedente e contando i movimenti fra le due date.
//   Se una classe si scosta lo si dice subito, con i formulari che possono
//   spiegarlo; se non si spiega, si dice che non si spiega. Niente invenzioni.
// - saldoMovimentiInArchivio: la somma dei soli movimenti in archivio. NON e' una
//   giacenza: i file non partono da quando il piazzale era vuoto. Su Nappi Sud
//   l'archivio comincia il 12/01/2024 e la somma da' P -61.420, M -24.150,
//   G1 -2.690 kg, che un piazzale non puo' avere. E' un termine di confronto, e si
//   mostra per quello che e', dicendo da quando conta.
//
// IL CONFRONTO CON L'ANCORA DELL'ANNO (23/09/2026).
// Il confronto con la sola lettura precedente ha un difetto: se a sbagliare e'
// la precedente, e' la lettura GIUSTA a risultare storta. E' successo il 23/09
// su NAPPI SUD: la lettura nuova, presa coi valori del portale, si scostava
// perche' la si confrontava con quella del 16/09, che aveva 6.160 kg nella
// classe sbagliata; e "conviene rileggere" restava acceso su un piazzale appena
// riletto. Misurato a mano lo stesso giorno: partendo dalla giacenza dichiarata
// al 31/12/2025 (P 14.840, M 6.440, G1 13.680) e sommando TUTTI i movimenti del
// 2026 si arriva esattamente al saldo letto il 23/09 (P 21.740, M 130, G1 350,
// ACI 1.640), scarto zero su ogni classe.
// Da qui il secondo confronto, accanto a quello con la precedente: l'ancora
// dell'anno, cioe' la lettura piu' vecchia che copre l'anno - la rilevazione del
// 31/12 precedente se c'e', altrimenti la prima lettura dell'anno. Se la lettura
// torna con l'ancora e' confermata, anche quando si scosta dalla precedente: a
// sbagliare e' una lettura in mezzo, e si dice quale e di quanto.

/** I canali che toccano un piazzale. Restano separati: non si sommano mai. */
export const CANALI_PIAZZALE = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];

/** Le classi della rilevazione: P, M, G1 e G2 sono la rete, la 9 e' l'ACI. */
export const CLASSI_RILEVAZIONE = ['P', 'M', 'G1', 'G2', 'ACI'];

/** I canali che il portale rileva, e le classi di ciascuno. L'extra raccolta a portale non c'e'. */
const CLASSI_DI_CANALE = { RETE: ['P', 'M', 'G1', 'G2'], ACI: ['ACI'] };

/** I kg per classe di una rilevazione, interi: 1-4 la rete, la 9 l'ACI. */
export function classiDiRilevazione(rec) {
  return {
    P: Math.round(Number(rec && rec.class1_kg) || 0),
    M: Math.round(Number(rec && rec.class2_kg) || 0),
    G1: Math.round(Number(rec && rec.class3_kg) || 0),
    G2: Math.round(Number(rec && rec.class4_kg) || 0),
    ACI: Math.round(Number(rec && rec.class9_kg) || 0),
  };
}

/**
 * Un movimento di piazzale in forma compatta, quello che serve ai due conti.
 * Il giorno e' sempre la FINE DEL TRASPORTO sul giorno italiano; la chiusura a
 * portale si porta dietro solo per raccontarla - non colloca niente, e' il
 * portale che chiude l'ordine giorni dopo il trasporto.
 * La classe la risolve chi chiama, con la regola dei prodotti che usa gia'.
 */
export function movimentoStoccaggio(r, { canale = 'RETE', verso = 'ingresso', classe = 'ND', controparte = '' } = {}) {
  return {
    id_ordine: String((r && r.id_ordine) || '').trim(),
    numero_fir: (r && r.numero_fir) || '',
    canale,
    verso: verso === 'uscita' ? 'uscita' : 'ingresso',
    classe: classe || 'ND',
    kg: Math.round(Number(r && r.peso_effettivo) || 0),
    finito_il: giornoRoma(r && r.trasporto_finito_il),
    chiuso_il: giornoRoma(r && r.ordine_chiuso_il),
    controparte: String(controparte || '').replace(/\s+/g, ' ').trim(),
  };
}

/**
 * I movimenti fra due rilevazioni: finiti DOPO il giorno della precedente e
 * ENTRO quello della nuova, che sta dentro. E' lo stesso taglio della giacenza
 * (dopoLaRilevazione), preso dai due capi.
 */
export function fraLeRilevazioni(movimenti, dal, al) {
  return (movimenti || []).filter(m => m && m.finito_il && (!dal || m.finito_il > dal) && (!al || m.finito_il <= al));
}

// Un movimento finito nei giorni subito prima della lettura e chiuso a portale
// dopo e' il caso tipico dello scarto: il portale l'ha gia' nel totale ma non
// ancora nella classe giusta. Tre giorni sono il margine con cui il portale
// chiude gli ordini.
const GIORNI_A_RIDOSSO = 3;
// Un elenco di candidati serve a capire, non a riempire la pagina.
const MAX_CANDIDATI = 10;

/** Il giorno di N giorni prima. Le rilevazioni sono giorni puri: l'ora non serve. */
function giorniPrima(giorno, n) {
  const d = new Date(String(giorno || '') + 'T00:00:00Z');
  if (isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Il confronto di una lettura con una base, classe per classe.
 *
 *   atteso = base + ingressi - uscite del periodo
 *   scarto = letto - atteso
 *
 * La base e' la lettura precedente oppure l'ancora dell'anno: il conto e' lo
 * stesso, cambia solo da dove si parte e quanto periodo ci sta in mezzo.
 *
 * Uno scarto negativo vuol dire che il portale mostra meno di quanto i movimenti
 * dicono; positivo, di piu'. I candidati a spiegarlo si cercano fra i movimenti
 * dello stesso canale nel periodo: quelli il cui peso, da solo, fa lo scarto, e
 * quelli finiti a ridosso della lettura e chiusi a portale dopo. Un formulario
 * finito nella classe sbagliata spiega due scarti opposti, uno per classe: per
 * questo i candidati si cercano in tutto il canale e non nella sola classe.
 *
 * @param {object} rilevazione  il record GiacenzaStoccaggio letto
 * @param {object} base         la lettura da cui si parte, o null
 * @param {array}  movimenti    movimenti del piazzale (movimentoStoccaggio), tutto l'archivio
 */
function confrontoConBase(rilevazione, base, movimenti) {
  const del = momentoRilevazione(rilevazione);
  const baseDel = base ? momentoRilevazione(base) : '';
  const letto = classiDiRilevazione(rilevazione);
  const partenza = baseDel ? classiDiRilevazione(base) : null;
  // Senza una lettura da cui partire non c'e' un punto di partenza: non si attende nulla.
  const periodo = baseDel ? fraLeRilevazioni(movimenti, baseDel, del) : [];
  const aRidosso = giorniPrima(del, GIORNI_A_RIDOSSO);

  // I movimenti del periodo, canale per canale e classe per classe.
  const per = new Map(); // 'canale|classe' -> saldo
  for (const m of periodo) {
    // L'extra raccolta a portale non c'e': una rilevazione non la legge.
    if (!CLASSI_DI_CANALE[m.canale]) continue;
    const k = m.canale + '|' + m.classe;
    if (!per.has(k)) per.set(k, { ingressi: 0, ingressi_kg: 0, uscite: 0, uscite_kg: 0 });
    const s = per.get(k);
    if (m.verso === 'uscita') { s.uscite++; s.uscite_kg += m.kg; } else { s.ingressi++; s.ingressi_kg += m.kg; }
  }

  const candidatiPer = (canale, scarto) => {
    const peso = Math.abs(scarto);
    return periodo
      .filter(m => m.canale === canale)
      .map(m => {
        const esatto = m.kg === peso;
        // La chiusura a portale non decide niente: dice solo che il portale
        // quell'ordine lo stava ancora sistemando quando la lettura e' stata presa.
        const ridosso = !!(aRidosso && m.finito_il >= aRidosso && m.chiuso_il && m.chiuso_il > del);
        if (!esatto && !ridosso) return null;
        return {
          ...m,
          peso_esatto: esatto,
          perche: esatto && ridosso
            ? "il suo peso, da solo, fa lo scarto, ed e' finito a ridosso della rilevazione e chiuso a portale dopo la lettura"
            : esatto
              ? 'il suo peso, da solo, fa lo scarto'
              : "finito a ridosso della rilevazione e chiuso a portale dopo la lettura",
        };
      })
      .filter(Boolean)
      .sort((a, b) => (Number(b.peso_esatto) - Number(a.peso_esatto)) || b.finito_il.localeCompare(a.finito_il))
      .slice(0, MAX_CANDIDATI);
  };

  const classi = [];
  const canali = {};
  for (const canale of Object.keys(CLASSI_DI_CANALE)) {
    // Le classi del canale, piu' quelle che il periodo ha portato e la
    // rilevazione non ha (ND: un prodotto che non si riconosce). Tacerle
    // farebbe tornare i conti delle altre per sbaglio.
    const elenco = [...CLASSI_DI_CANALE[canale]];
    for (const k of per.keys()) {
      const [c, cl] = k.split('|');
      if (c === canale && !elenco.includes(cl)) elenco.push(cl);
    }
    const scostano = [];
    let scartoCanale = 0;
    let spostatiCanale = 0;
    let movimentiCanale = 0;
    for (const classe of elenco) {
      const s = per.get(canale + '|' + classe) || { ingressi: 0, ingressi_kg: 0, uscite: 0, uscite_kg: 0 };
      movimentiCanale += s.ingressi + s.uscite;
      const base = partenza ? (partenza[classe] || 0) : null;
      const atteso = base === null ? null : base + s.ingressi_kg - s.uscite_kg;
      const valore = letto[classe] || 0;
      const scarto = atteso === null ? null : valore - atteso;
      const voce = {
        classe, canale,
        precedente_kg: base,
        ingressi: s.ingressi, ingressi_kg: s.ingressi_kg,
        uscite: s.uscite, uscite_kg: s.uscite_kg,
        atteso, letto: valore, scarto,
        candidati: [], spiegato: false, nota: '',
      };
      if (scarto) {
        scostano.push(classe);
        scartoCanale += scarto;
        if (scarto > 0) spostatiCanale += scarto;
        voce.candidati = candidatiPer(canale, scarto);
        const esatti = voce.candidati.filter(c => c.peso_esatto).length;
        voce.spiegato = esatti > 0;
        voce.nota = esatti
          ? `Lo scarto e' esattamente il peso di ${esatti === 1 ? 'un formulario' : `${esatti} formulari`} del periodo.`
          : voce.candidati.length === 1
            ? "Nessun formulario, da solo, fa lo scarto; c'e' un movimento finito a ridosso della rilevazione e chiuso a portale dopo la lettura."
            : voce.candidati.length
              ? `Nessun formulario, da solo, fa lo scarto; ci sono ${voce.candidati.length} movimenti finiti a ridosso della rilevazione e chiusi a portale dopo la lettura.`
              : 'Lo scarto non si spiega con i movimenti del periodo.';
      }
      classi.push(voce);
    }
    canali[canale] = {
      movimenti: movimentiCanale,
      scarto_kg: scartoCanale,
      // Quanti chili sono finiti nella casella sbagliata: la somma degli scarti
      // in piu'. Quando il totale del canale torna e' questo il numero da dire,
      // perche' lo scarto netto e' zero e da solo non direbbe niente.
      spostati_kg: spostatiCanale,
      classi_che_scostano: scostano,
      quadra: baseDel ? scostano.length === 0 : null,
      // Il caso del 16/09: il totale del canale torna, la ripartizione fra le classi no.
      ripartizione_sbagliata: scostano.length > 0 && scartoCanale === 0,
    };
  }

  const scostano = classi.filter(c => c.scarto).map(c => c.classe);
  return {
    del,
    base_del: baseDel,
    senza_base: !baseDel,
    classi,
    scostano,
    // Senza una lettura da cui partire non si puo' dire se quadra: non si dice.
    quadra: baseDel ? scostano.length === 0 : null,
    canali,
  };
}

// --- L'ancora dell'anno ---

/** Le letture di un piazzale in ordine: dalla piu' vecchia alla piu' recente. */
function letturePerGiorno(rilevazioni) {
  return [...(rilevazioni || [])].filter(Boolean).sort((a, b) =>
    momentoRilevazione(a).localeCompare(momentoRilevazione(b))
    // A parita' di giorno vale quella registrata per ultima, come ovunque.
    || String(a.created_date || '').localeCompare(String(b.created_date || '')));
}

/** L'anno a cui appartiene una lettura, dal suo giorno 'AAAA-MM-GG'. */
export const annoDellaLettura = (giorno) => String(giorno || '').slice(0, 4);

/** Un giorno 'AAAA-MM-GG' come si scrive in una frase: GG/MM/AAAA. */
const giornoScritto = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '');

/**
 * L'ancora di un anno: la lettura piu' vecchia che copre quell'anno.
 * E' la rilevazione del 31/12 dell'anno prima - la giacenza dichiarata, il punto
 * da cui l'anno riparte - e se non c'e' la prima lettura dell'anno stesso.
 *
 * @param {array} rilevazioni  i record GiacenzaStoccaggio del piazzale
 * @param {string|number} anno l'anno da ancorare
 */
export function ancoraDellAnno(rilevazioni, anno) {
  const a = String(anno || '');
  if (!/^\d{4}$/.test(a)) return null;
  const letture = letturePerGiorno(rilevazioni);
  // La chiusura dell'anno prima vale su tutto: se ce ne fosse piu' d'una nello
  // stesso giorno vale l'ultima registrata, come ovunque.
  const chiusura = letture.filter(r => momentoRilevazione(r) === `${Number(a) - 1}-12-31`).pop();
  if (chiusura) return chiusura;
  return letture.find(r => annoDellaLettura(momentoRilevazione(r)) === a) || null;
}

// --- Da dove parte il numero (regola della direzione, 24/09/2026) ---
//
// La giacenza di un piazzale e' una somma algebrica: l'ancora dell'anno piu'
// tutti i movimenti con fine trasporto successiva, classe per classe e canale
// per canale. La lettura del portale e' un riscontro, non la fonte del numero:
// quando si scosta lo scarto si spiega, ma il numero mostrato resta quello dei
// nostri movimenti. Prima si partiva dall'ultima lettura, e una lettura storta
// (NAPPI SUD, 16/09/2026) si portava dietro la giacenza di tutti i moduli.

/**
 * Il punto da cui parte la giacenza di un piazzale: l'ancora dell'anno
 * dell'ultima lettura - il 31/12 precedente, o la prima lettura dell'anno.
 * Senza letture non c'e' un punto di partenza e la risposta e' null.
 *
 * @param {array} rilevazioni  i record GiacenzaStoccaggio del piazzale, in qualunque ordine
 */
export function puntoDiPartenza(rilevazioni) {
  const letture = letturePerGiorno(rilevazioni);
  if (!letture.length) return null;
  const ultima = letture[letture.length - 1];
  // L'ancora c'e' sempre, quando c'e' una lettura: al piu' e' l'ultima stessa,
  // se e' la prima dell'anno.
  return ancoraDellAnno(letture, annoDellaLettura(momentoRilevazione(ultima))) || ultima;
}

/**
 * Il punto di partenza di ciascuno stoccaggio, per chiave normalizzata: la
 * stessa forma di ultimeRilevazioni ({ record, quando, data }), piu' l'ultima
 * lettura, che resta il riscontro.
 */
export function puntiDiPartenza(rilevazioni, chiaveDi) {
  const per = new Map(); // chiave -> letture
  for (const r of rilevazioni || []) {
    const k = r && chiaveDi(r.sito);
    if (!k) continue;
    if (!per.has(k)) per.set(k, []);
    per.get(k).push(r);
  }
  const esito = new Map();
  for (const [k, letture] of per) {
    const record = puntoDiPartenza(letture);
    if (!record) continue;
    const quando = momentoRilevazione(record);
    const ultima = letturePerGiorno(letture).pop();
    esito.set(k, { record, quando, data: quando, ultima, ultima_del: momentoRilevazione(ultima) });
  }
  return esito;
}

/** Di quanto sbaglia una lettura su un canale, in kg e con le classi. */
function quantoSbaglia(canale) {
  if (!canale || canale.quadra !== false) return '';
  const classi = canale.classi_che_scostano || [];
  const dove = classi.length ? ` fra ${classi.join(' e ')}` : '';
  // Se il totale del canale torna i chili non mancano: sono nella classe
  // sbagliata, e quello che conta e' quanti se ne sono spostati.
  if (canale.ripartizione_sbagliata) return `${formatoKg(canale.spostati_kg)} kg${dove}`;
  return `${canale.scarto_kg > 0 ? '+' : ''}${formatoKg(canale.scarto_kg)} kg${dove}`;
}

/**
 * Il confronto di una lettura con l'ancora dell'anno, piu' il verdetto di ogni
 * lettura che sta in mezzo. Se la lettura torna con l'ancora e' confermata:
 * a sbagliare e' una di quelle in mezzo, e le si nomina.
 *
 * @param {object} rilevazione  la lettura da giudicare
 * @param {object} ancora       l'ancora del suo anno, o null
 * @param {array}  intermedie   le letture fra l'ancora e questa, dalla piu' vecchia
 * @param {array}  movimenti    movimenti del piazzale, tutto l'archivio
 */
function confrontoConAncora(rilevazione, ancora, intermedie, movimenti) {
  const del = momentoRilevazione(rilevazione);
  const vuoto = {
    del: '', quadra: null, e_la_lettura: false, senza_ancora: true,
    classi: [], scostano: [], canali: {}, intermedie: [], non_tornano: [],
    nota: "Non c'e' un'ancora dell'anno con cui confrontare questa lettura.",
  };
  const ancoraDel = ancora ? momentoRilevazione(ancora) : '';
  if (!ancora || !ancoraDel || !del) return vuoto;
  // L'ancora e' questa lettura: e' lei il punto di partenza dell'anno, e prima
  // di lei non c'e' niente da confrontare. Si dice, invece di tacere.
  if (ancora === rilevazione || ancoraDel > del) {
    return {
      ...vuoto, del: ancoraDel, senza_ancora: false, e_la_lettura: true,
      nota: `Questa lettura e' l'ancora del ${annoDellaLettura(del)}: e' il punto da cui l'anno riparte, e non c'e' una lettura piu' vecchia con cui confrontarla.`,
    };
  }

  const c = confrontoConBase(rilevazione, ancora, movimenti);
  // Ogni lettura in mezzo contro quella prima di lei: quando questa torna con
  // l'ancora, e' fra loro che sta l'errore.
  const catena = [ancora, ...(intermedie || []).filter(Boolean)];
  const inMezzo = [];
  for (let i = 1; i < catena.length; i++) {
    const v = confrontoConBase(catena[i], catena[i - 1], movimenti);
    inMezzo.push({
      del: v.del,
      precedente_del: v.base_del,
      quadra: v.quadra,
      scostano: v.scostano,
      canali: v.canali,
      classi: v.classi.filter(x => x.scarto),
    });
  }
  const nonTornano = inMezzo.filter(l => l.quadra === false);

  const daQuando = `l'ancora del ${annoDellaLettura(del)}, la lettura del ${giornoScritto(ancoraDel)} piu' tutti i movimenti da allora`;
  let nota;
  if (c.quadra) {
    const chi = nonTornano.length
      ? ` A sbagliare ${nonTornano.length === 1 ? "e' la lettura" : 'sono le letture'} del ${nonTornano.map(l => giornoScritto(l.del)).join(' e del ')}.`
      : '';
    nota = `Questa lettura torna con ${daQuando}: e' confermata.${chi}`;
  } else {
    nota = `Questa lettura non torna nemmeno con ${daQuando}.`;
  }

  return {
    del: ancoraDel,
    senza_ancora: false,
    e_la_lettura: false,
    quadra: c.quadra,
    classi: c.classi,
    scostano: c.scostano,
    canali: c.canali,
    intermedie: inMezzo,
    // Le letture in mezzo che non tornano: quelle da rifare, non questa.
    non_tornano: nonTornano.map(l => l.del),
    nota,
  };
}

/**
 * Che cosa ci si aspettava di leggere in una rilevazione, classe per classe,
 * partendo dalla lettura precedente, e - quando la si passa - anche partendo
 * dall'ancora dell'anno.
 *
 * Due confronti, perche' quello con la sola precedente accusa la lettura giusta
 * quando a sbagliare e' la precedente: e' il caso del 23/09 su NAPPI SUD.
 *
 * @param {object} rilevazione  il record GiacenzaStoccaggio appena letto
 * @param {object} precedente   la rilevazione prima di questa, o null
 * @param {array}  movimenti    movimenti del piazzale (movimentoStoccaggio), tutto l'archivio
 * @param {object} opzioni      { ancora, intermedie }: l'ancora dell'anno e le letture fra le due
 */
export function verificaRilevazione(rilevazione, precedente, movimenti, { ancora = null, intermedie = [] } = {}) {
  const c = confrontoConBase(rilevazione, precedente, movimenti);
  const daAncora = confrontoConAncora(rilevazione, ancora, intermedie, movimenti);
  // Il verdetto dell'ancora vale un canale per volta: rete e ACI non si sommano
  // mai, e una puo' essere confermata mentre l'altra no.
  const canali = {};
  for (const [nome, v] of Object.entries(c.canali)) {
    const a = daAncora.canali[nome] || null;
    canali[nome] = {
      ...v,
      confermata_dall_ancora: !!(a && a.quadra === true),
      ancora_quadra: a ? a.quadra : null,
    };
  }
  return {
    del: c.del,
    precedente_del: c.base_del,
    senza_precedente: c.senza_base,
    classi: c.classi,
    scostano: c.scostano,
    quadra: c.quadra,
    canali,
    ancora: daAncora,
    // Confermata dall'ancora: la lettura e' giusta anche se si scosta dalla
    // precedente, perche' a sbagliare e' una lettura in mezzo.
    confermata_dall_ancora: daAncora.quadra === true,
  };
}

/**
 * L'anomalia "rilevazione da controllare" di un piazzale, o null se non ce n'e'.
 *
 * Il riscontro che conta e' quello con l'ancora dell'anno piu' tutti i
 * movimenti (regola della direzione, 24/09/2026): e' da li' che parte il
 * numero. Una lettura che si scosta dalla precedente ma torna con l'ancora e'
 * giusta, e a sbagliare era la precedente - NAPPI SUD il 23/09/2026, segnalata
 * per giorni in cima a Giacenze senza motivo. Il confronto con la sola
 * precedente vale solo quando l'ancora non c'e' o e' la lettura stessa.
 *
 * @param {object} verifica  il risultato di verificaRilevazione
 */
export function anomaliaRilevazione(verifica) {
  if (!verifica) return null;
  const a = verifica.ancora;
  const conAncora = !!(a && !a.senza_ancora && !a.e_la_lettura);
  const classi = (conAncora ? a.classi : verifica.classi).filter(c => c.scarto);
  if (!classi.length) return null;
  return {
    del: verifica.del,
    precedente_del: conAncora ? a.del : verifica.precedente_del,
    contro_ancora: conAncora,
    classi,
    canali: conAncora ? a.canali : verifica.canali,
  };
}

/**
 * Il saldo dei SOLI movimenti in archivio, canale per canale e classe per
 * classe, con il giorno del primo movimento che lo compone e quanti sono.
 *
 * Non e' una giacenza e non va mostrato come tale: vale dal primo movimento in
 * archivio (`dal`), non da quando il piazzale era vuoto, e sui piazzali piu'
 * vecchi esce negativo. Serve accanto alla giacenza per vedere a colpo d'occhio
 * quanto manca all'appello e da quando.
 *
 * @param {array} movimenti  movimenti del piazzale (movimentoStoccaggio)
 */
export function saldoMovimentiInArchivio(movimenti) {
  const esito = {};
  for (const canale of CANALI_PIAZZALE) {
    esito[canale] = {
      dal: '', al: '', movimenti: 0,
      ingressi: 0, ingressi_kg: 0, uscite: 0, uscite_kg: 0,
      saldo_kg: 0,
      classi_kg: Object.fromEntries([...CLASSI_RILEVAZIONE, 'ND'].map(c => [c, 0])),
      senza_fine: 0,
    };
  }
  for (const m of movimenti || []) {
    const c = m && esito[m.canale];
    if (!c) continue;
    // Senza fine trasporto un movimento non si colloca in nessun giorno: fuori
    // dal saldo, contato a parte perche' la differenza si dice.
    if (!m.finito_il) { c.senza_fine++; continue; }
    c.movimenti++;
    if (!c.dal || m.finito_il < c.dal) c.dal = m.finito_il;
    if (m.finito_il > c.al) c.al = m.finito_il;
    const segno = m.verso === 'uscita' ? -1 : 1;
    const classe = m.classe in c.classi_kg ? m.classe : 'ND';
    c.classi_kg[classe] += segno * m.kg;
    c.saldo_kg += segno * m.kg;
    if (segno > 0) { c.ingressi++; c.ingressi_kg += m.kg; } else { c.uscite++; c.uscite_kg += m.kg; }
  }
  return esito;
}

// --- La riconciliazione permanente di un piazzale (23/09/2026) ---
//
// Il 22 e il 23 settembre la riconciliazione di NAPPI SUD si e' fatta a mano: da
// dove viene la giacenza di adesso, che cosa diceva ogni lettura del portale,
// che cosa non torna e se conviene rileggere. Da qui la fa il gestionale, per
// ogni piazzale e a ogni caricamento.
//
// Non cambia nessun numero e non ne inventa: mette in fila quelli che ci sono
// gia', un canale per volta - rete e ACI non si sommano mai - e riusa i due
// conti che esistono: verificaRilevazione per il verdetto di ogni lettura,
// saldoMovimentiInArchivio per la somma dei soli movimenti, che una giacenza non
// e'. Quattro cose, nell'ordine in cui servono:
//
// 1. l'estratto conto: l'ancora dell'anno, piu' gli ingressi e meno le uscite
//    finiti dopo, classe per classe, fino al numero che la pagina mostra; e
//    accanto il riscontro dell'ultima lettura, con lo scarto (24/09/2026);
// 2. lo storico delle letture, ognuna col suo verdetto - contro la precedente e
//    contro l'ancora dell'anno: una lettura sbagliata sepolta indietro nel tempo
//    non si ripescava piu', e una lettura giusta presa dopo una sbagliata
//    risultava storta lei;
// 3. com'e' adesso: se l'ultima lettura tornava, e se no di quanto, se e' la
//    ripartizione fra le classi a essere sbagliata (il materiale c'e', sta nella
//    casella sbagliata) o se manca davvero, con i candidati a spiegarlo;
// 4. quando conviene rileggere il portale, detto con parole semplici.

/** Oltre questi giorni una lettura del portale e' vecchia e conviene rifarla. */
const GIORNI_LETTURA_VECCHIA = 30;

/** Quanti giorni separano due giorni 'AAAA-MM-GG'; null se una data non si legge. */
function giorniFra(dal, al) {
  const a = new Date(String(dal || '') + 'T00:00:00Z').getTime();
  const b = new Date(String(al || '') + 'T00:00:00Z').getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * L'estratto conto di un canale: l'ancora dell'anno, poi gli ingressi e le
 * uscite finiti dopo, classe per classe, fino al numero di adesso.
 *
 * Il taglio e' quello di sempre: contano i movimenti finiti DAL GIORNO DOPO
 * l'ancora, per fine trasporto. Senza ancora i movimenti si mostrano lo stesso,
 * ma il numero di adesso resta vuoto: una somma di movimenti non e' una
 * giacenza, e spacciarla per tale sarebbe una bugia comoda.
 */
function estrattoDiCanale(canale, fotografia, movimenti, dal) {
  const dopo = fraLeRilevazioni(movimenti, dal, '').filter(m => m.canale === canale);
  // Le classi del canale, piu' quelle che i movimenti hanno portato e la
  // fotografia non ha (ND: un prodotto che non si riconosce).
  const elenco = [...(CLASSI_DI_CANALE[canale] || [])];
  for (const m of dopo) if (!elenco.includes(m.classe)) elenco.push(m.classe);

  const classi = [];
  let ingressi = 0, ingressiKg = 0, uscite = 0, usciteKg = 0, fotoKg = 0, adessoKg = 0;
  for (const classe of elenco) {
    let inN = 0, inKg = 0, outN = 0, outKg = 0;
    for (const m of dopo) {
      if (m.classe !== classe) continue;
      if (m.verso === 'uscita') { outN++; outKg += m.kg; } else { inN++; inKg += m.kg; }
    }
    const foto = fotografia ? (fotografia[classe] || 0) : null;
    const adesso = foto === null ? null : foto + inKg - outKg;
    classi.push({
      classe, canale,
      fotografia_kg: foto,
      ingressi: inN, ingressi_kg: inKg,
      uscite: outN, uscite_kg: outKg,
      adesso_kg: adesso,
    });
    ingressi += inN; ingressiKg += inKg; uscite += outN; usciteKg += outKg;
    if (foto !== null) { fotoKg += foto; adessoKg += adesso; }
  }
  return {
    dal,
    classi,
    fotografia_kg: fotografia ? fotoKg : null,
    ingressi, ingressi_kg: ingressiKg,
    uscite, uscite_kg: usciteKg,
    // Quanto materiale si e' mosso dall'ancora in poi: entrate e uscite insieme.
    movimentato_kg: ingressiKg + usciteKg,
    adesso_kg: fotografia ? adessoKg : null,
    classi_negative: classi.filter(c => c.adesso_kg !== null && c.adesso_kg < 0).map(c => c.classe),
  };
}

/** Le letture fra l'ancora e l'ultima che non tornano su questo canale. */
function lettureCheSbagliano(verdetto, canale) {
  const a = verdetto && verdetto.ancora ? verdetto.ancora : null;
  if (!a || !a.intermedie) return [];
  return a.intermedie
    .filter(l => l.canali[canale] && l.canali[canale].quadra === false)
    .map(l => ({
      del: l.del,
      precedente_del: l.precedente_del,
      scarto_kg: l.canali[canale].scarto_kg,
      spostati_kg: l.canali[canale].spostati_kg,
      ripartizione_sbagliata: !!l.canali[canale].ripartizione_sbagliata,
      classi_che_scostano: l.canali[canale].classi_che_scostano,
      quanto: quantoSbaglia(l.canali[canale]),
      classi: l.classi.filter(c => c.canale === canale),
    }));
}

/** Com'e' messo un canale adesso, secondo l'ultima lettura. Niente frasi inventate. */
function statoDiCanale(canale, verdetto, haFotografia) {
  // Le stesse voci per ogni esito: chi legge non deve indovinare se un campo c'e'.
  const base = {
    quadra: null, scarto_kg: 0, ripartizione_sbagliata: false,
    classi_che_scostano: [], classi: [],
    confermata_dall_ancora: false, ancora_del: '', letture_che_sbagliano: [],
  };
  if (canale === 'EXTRA_RACCOLTA') {
    return {
      ...base, esito: 'fuori_portale',
      perche: "L'extra raccolta a portale non c'e': non esiste una lettura da cui partire, e la somma dei suoi movimenti non e' una giacenza.",
    };
  }
  if (!haFotografia) {
    return {
      ...base, esito: 'senza_lettura',
      perche: "Questo piazzale non ha nessuna lettura del portale: senza un punto di partenza la giacenza non si calcola, e restano i soli movimenti in archivio, che una giacenza non sono.",
    };
  }
  const c = verdetto && verdetto.canali ? verdetto.canali[canale] : null;
  const ancora = verdetto && verdetto.ancora ? verdetto.ancora : null;
  const confermata = !!(c && c.confermata_dall_ancora);
  const ancoraDel = ancora && !ancora.senza_ancora && !ancora.e_la_lettura ? ancora.del : '';
  if (!c || c.quadra === null) {
    return {
      ...base, esito: 'senza_precedente',
      perche: "E' la prima lettura di questo piazzale: non ce n'e' una prima da cui partire, quindi non si puo' dire se tornava.",
    };
  }
  if (c.quadra) {
    // Torna con la precedente ma non con l'ancora: l'errore sta piu' indietro,
    // in una lettura che questa si porta dietro. Si dice, senza gridare.
    const nonTornaConAncora = ancoraDel && c.ancora_quadra === false;
    return {
      ...base, esito: 'quadra', quadra: true, confermata_dall_ancora: confermata,
      ancora_del: ancoraDel,
      letture_che_sbagliano: lettureCheSbagliano(verdetto, canale),
      perche: "L'ultima lettura tornava: ogni classe leggeva quello che i movimenti dicevano."
        + (confermata ? ` Torna anche con l'ancora dell'anno, la lettura del ${giornoScritto(ancoraDel)}.` : '')
        + (nonTornaConAncora ? ` Non torna pero' con l'ancora dell'anno, la lettura del ${giornoScritto(ancoraDel)} piu' tutti i movimenti da allora: fra le due c'e' una lettura che sbaglia e che questa si porta dietro.` : ''),
    };
  }
  const classi = (verdetto.classi || []).filter(x => x.canale === canale);
  if (confermata) {
    // Il caso del 23/09 su NAPPI SUD: la lettura nuova si scosta dalla
    // precedente, ma torna con l'ancora dell'anno. A sbagliare e' quella in mezzo.
    const sbagliano = lettureCheSbagliano(verdetto, canale);
    const chi = sbagliano.length
      ? ` A sbagliare ${sbagliano.length === 1 ? "e' la lettura" : 'sono le letture'} del ${sbagliano.map(l => `${giornoScritto(l.del)}, di ${l.quanto}`).join('; del ')}.`
      : ' A sbagliare e\' una delle letture in mezzo.';
    return {
      ...base, esito: 'confermata_ancora', quadra: false,
      scarto_kg: c.scarto_kg,
      ripartizione_sbagliata: !!c.ripartizione_sbagliata,
      classi_che_scostano: c.classi_che_scostano,
      classi,
      confermata_dall_ancora: true,
      ancora_del: ancoraDel,
      letture_che_sbagliano: sbagliano,
      perche: `L'ultima lettura si scosta da quella del ${giornoScritto(verdetto.precedente_del)}, ma torna con l'ancora dell'anno, la lettura del ${giornoScritto(ancoraDel)} piu' tutti i movimenti da allora: e' giusta lei.${chi}`,
    };
  }
  return {
    ...base, esito: 'scosta', quadra: false,
    scarto_kg: c.scarto_kg,
    ripartizione_sbagliata: !!c.ripartizione_sbagliata,
    classi_che_scostano: c.classi_che_scostano,
    // Le classi che si scostano, con i candidati a spiegarle: stanno nel verdetto.
    classi,
    ancora_del: ancoraDel,
    letture_che_sbagliano: lettureCheSbagliano(verdetto, canale),
    perche: (c.ripartizione_sbagliata
      // Il caso del 16/09 su Nappi Sud: i chili ci sono tutti, stanno nella classe sbagliata.
      ? "L'ultima lettura non tornava, ma il totale del canale si': il materiale c'e' tutto, e' la ripartizione fra le classi a essere sbagliata."
      : "L'ultima lettura non tornava, e non torna nemmeno il totale del canale: non e' una questione di classi, e' materiale che non trova riscontro nei movimenti.")
      + (ancoraDel ? ` Non torna nemmeno con l'ancora dell'anno, la lettura del ${giornoScritto(ancoraDel)}: e' questa lettura a essere da rifare.` : ''),
  };
}

/**
 * Se conviene rileggere il portale, e perche'. Parole semplici, un motivo per
 * riga. Una lettura nuova e' un riscontro: dice se i nostri movimenti tornano
 * con il portale, non cambia la giacenza, che parte dall'ancora dell'anno.
 */
function rileggereCanale(canale, estratto, stato, giorni) {
  // L'extra raccolta il portale non la tiene: non c'e' niente da rileggere.
  if (canale === 'EXTRA_RACCOLTA') {
    return {
      conviene: false, giorni: null, vecchia: false, classi_negative: [], nota: '',
      perche: ["L'extra raccolta a portale non c'e': non c'e' una lettura da rifare."],
    };
  }
  if (stato.esito === 'senza_lettura') {
    return {
      conviene: true, giorni: null, vecchia: false, classi_negative: [], nota: '',
      perche: ["Non c'e' nessuna lettura del portale da cui partire: la prima si prende dalla pagina delle unita' locali di stoccaggio."],
    };
  }
  const perche = [];
  const vecchia = giorni !== null && giorni > GIORNI_LETTURA_VECCHIA;
  // Una lettura vecchia e' un riscontro vecchio: il numero non invecchia con
  // lei, ma da troppo tempo nessuno controlla che i movimenti tornino col portale.
  if (vecchia) perche.push(`La lettura ha ${giorni} giorni, piu' di ${GIORNI_LETTURA_VECCHIA}: conviene rifarla.`);
  if (estratto.classi_negative.length) {
    perche.push(`Sotto zero ${estratto.classi_negative.length === 1 ? 'la classe' : 'le classi'} ${estratto.classi_negative.join(', ')}: dall'ancora dell'anno ne risulta uscita piu' di quanta ne sia entrata. O l'ancora ha i chili nella classe sbagliata o manca un movimento in archivio: una lettura nuova aiuta a capire quale.`);
  }
  if (stato.esito === 'scosta') {
    perche.push("L'ultima lettura non tornava con i nostri movimenti: rifarla adesso, che il portale ha chiuso quegli ordini, dice se lo scarto si chiude da solo. La giacenza mostrata non cambia: e' quella dei movimenti.");
  }
  // Una lettura confermata dall'ancora non e' un motivo per rileggere: si
  // scostava dalla precedente perche' a sbagliare era la precedente. Il 23/09 su
  // NAPPI SUD "conviene rileggere" restava acceso su un piazzale appena riletto.
  const nota = stato.esito === 'confermata_ancora'
    ? `La lettura e' confermata dall'ancora dell'anno${stato.ancora_del ? `, quella del ${giornoScritto(stato.ancora_del)}` : ''}: non e' lei a sbagliare, e rifarla non servirebbe.`
    : '';
  return { conviene: perche.length > 0, giorni, vecchia, classi_negative: estratto.classi_negative, nota, perche };
}

/**
 * Il riscontro dell'ultima lettura su un canale: quanto leggeva il portale,
 * quanto dicevano quel giorno l'ancora piu' i nostri movimenti, e lo scarto.
 * Null quando l'ultima lettura e' l'ancora stessa: non c'e' niente da riscontrare.
 */
function riscontroDiCanale(canale, ultima, confronto) {
  const c = confronto && confronto.canali[canale];
  if (!c) return null;
  const letto = canale === 'ACI' ? kgAciDiRilevazione(ultima) : kgReteDiRilevazione(ultima);
  return {
    del: confronto.del,
    letto_kg: letto,
    atteso_kg: letto - c.scarto_kg,
    scarto_kg: c.scarto_kg,
    quadra: c.quadra,
    ripartizione_sbagliata: !!c.ripartizione_sbagliata,
    classi_che_scostano: c.classi_che_scostano,
  };
}

/**
 * La riconciliazione di un piazzale, canale per canale: da dove viene la
 * giacenza di adesso, che verdetto ha avuto ogni lettura, come sta il piazzale e
 * quando conviene rileggere il portale.
 *
 * @param {array}  rilevazioni  i record GiacenzaStoccaggio del piazzale, in qualunque ordine
 * @param {array}  movimenti    i movimenti del piazzale (movimentoStoccaggio), tutto l'archivio
 * @param {object} opzioni      { oggi }: il giorno italiano di oggi, per dire se la lettura e' vecchia
 */
export function riconciliazionePiazzale(rilevazioni, movimenti, { oggi = '' } = {}) {
  const letture = letturePerGiorno(rilevazioni);
  const mov = (movimenti || []).filter(Boolean);
  const ultima = letture.length ? letture[letture.length - 1] : null;
  const del = ultima ? momentoRilevazione(ultima) : '';
  // Il numero parte dall'ancora dell'anno, non dall'ultima lettura (24/09/2026):
  // l'ultima lettura e' il riscontro, e si confronta qui sotto canale per canale.
  const partenza = puntoDiPartenza(letture);
  const partenzaDel = partenza ? momentoRilevazione(partenza) : '';
  const fotografia = partenza ? classiDiRilevazione(partenza) : null;
  const riscontro = partenza && ultima && ultima !== partenza ? confrontoConBase(ultima, partenza, mov) : null;

  // Lo storico: ogni lettura col suo verdetto, non solo l'ultima. Di ciascuna si
  // tengono le sole classi che si scostano, coi loro candidati: le altre
  // tornavano e non c'e' niente da dire.
  const storico = letture.map((r, i) => {
    // Ogni lettura ha due punti di partenza: quella prima di lei e l'ancora del
    // suo anno. Le letture in mezzo servono a dire quale sbaglia, se sbaglia.
    const ancora = ancoraDellAnno(letture, annoDellaLettura(momentoRilevazione(r)));
    const iAncora = ancora ? letture.indexOf(ancora) : -1;
    const intermedie = iAncora >= 0 && iAncora < i ? letture.slice(iAncora + 1, i) : [];
    const v = verificaRilevazione(r, i > 0 ? letture[i - 1] : null, mov, { ancora, intermedie });
    return {
      del: v.del,
      precedente_del: v.precedente_del,
      senza_precedente: v.senza_precedente,
      ultima: i === letture.length - 1,
      quadra: v.quadra,
      scostano: v.scostano,
      canali: v.canali,
      classi: v.classi.filter(c => c.scarto),
      ancora: v.ancora,
      confermata_dall_ancora: v.confermata_dall_ancora,
      // Quanto leggeva quel giorno, un canale per volta: mai la somma dei due.
      letto_kg: { RETE: kgReteDiRilevazione(r), ACI: kgAciDiRilevazione(r) },
    };
  });
  const verdetto = storico.length ? storico[storico.length - 1] : null;
  const giorni = del && oggi ? giorniFra(del, oggi) : null;
  const archivio = saldoMovimentiInArchivio(mov);

  const canali = {};
  for (const canale of CANALI_PIAZZALE) {
    // L'extra raccolta non ha una fotografia: i suoi movimenti si contano da
    // quando comincia l'archivio, e il numero di adesso resta vuoto.
    const fuoriPortale = canale === 'EXTRA_RACCOLTA';
    const senzaFotografia = fuoriPortale || !fotografia;
    const estratto = estrattoDiCanale(canale, senzaFotografia ? null : fotografia, mov, fuoriPortale ? '' : partenzaDel);
    const stato = statoDiCanale(canale, verdetto, !!fotografia);
    canali[canale] = {
      canale,
      senza_fotografia: senzaFotografia,
      // La "fotografia" da cui parte l'estratto e' l'ancora dell'anno.
      fotografia: senzaFotografia ? null : { del: partenzaDel, totale_kg: estratto.fotografia_kg, ultima_del: del },
      estratto,
      riscontro: fuoriPortale ? null : riscontroDiCanale(canale, ultima, riscontro),
      stato,
      rileggere: rileggereCanale(canale, estratto, stato, giorni),
      // Il verdetto di ogni lettura per questo canale, dalla piu' recente: una
      // lettura sbagliata resta visibile anche quando ne sono arrivate altre dopo.
      letture: fuoriPortale ? [] : storico.slice().reverse().map(s => ({
        del: s.del,
        precedente_del: s.precedente_del,
        senza_precedente: s.senza_precedente,
        ultima: s.ultima,
        letto_kg: canale === 'ACI' ? s.letto_kg.ACI : s.letto_kg.RETE,
        quadra: s.canali[canale] ? s.canali[canale].quadra : null,
        scarto_kg: s.canali[canale] ? s.canali[canale].scarto_kg : 0,
        movimenti: s.canali[canale] ? s.canali[canale].movimenti : 0,
        ripartizione_sbagliata: s.canali[canale] ? !!s.canali[canale].ripartizione_sbagliata : false,
        // Confermata dall'ancora: si scosta dalla precedente ma torna con il
        // punto di partenza dell'anno, quindi e' giusta lei.
        confermata_dall_ancora: s.canali[canale] ? !!s.canali[canale].confermata_dall_ancora : false,
        ancora_del: s.ancora && !s.ancora.senza_ancora && !s.ancora.e_la_lettura ? s.ancora.del : '',
        e_ancora: !!(s.ancora && s.ancora.e_la_lettura),
        classi: s.classi.filter(c => c.canale === canale),
      })),
      // La somma dei soli movimenti in archivio di questo canale, per averla
      // accanto: resta quello che e', un termine di confronto, non una giacenza.
      archivio: archivio[canale],
    };
  }

  const suaAncora = verdetto ? verdetto.ancora : null;
  return {
    rilevazioni: letture.length,
    ultima_del: del,
    // Da dove parte il numero: l'ancora dell'anno dell'ultima lettura.
    partenza_del: partenzaDel,
    giorni_dalla_lettura: giorni,
    senza_rilevazione: !ultima,
    movimenti: mov.length,
    senza_movimenti: mov.length === 0,
    // L'ancora dell'anno dell'ultima lettura: da dove riparte il conto, e se e'
    // l'ultima lettura stessa a fare da ancora.
    ancora_del: suaAncora && !suaAncora.senza_ancora && !suaAncora.e_la_lettura ? suaAncora.del : '',
    ultima_e_ancora: !!(suaAncora && suaAncora.e_la_lettura),
    confermata_dall_ancora: !!(verdetto && verdetto.confermata_dall_ancora),
    ancora_nota: suaAncora ? suaAncora.nota : '',
    storico,
    canali,
  };
}
