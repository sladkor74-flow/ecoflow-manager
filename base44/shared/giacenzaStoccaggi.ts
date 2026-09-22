// Quanto materiale ha davvero uno stoccaggio, adesso, un canale per volta.
//
// La rilevazione fotografa il saldo del portale per classe: P, M, G1 e G2 sono
// la rete, la classe 9 e' l'ACI. Per avere la giacenza di oggi si parte dalla
// fotografia e si contano i movimenti di quel canale finiti dopo.
//
// Tre regole dell'utente, senza eccezioni (21/09/2026):
// - un movimento conta dalla FINE DEL TRASPORTO, sul giorno italiano; la data di
//   chiusura dell'ordine a portale non decide nulla, nemmeno come ripiego: un
//   movimento senza fine trasporto non si conta;
// - la giacenza segue ogni caricamento: entrate e uscite dopo la rilevazione;
// - rete, ACI ed extra raccolta non si sommano mai. L'extra raccolta a portale
//   non c'e': la sua giacenza si tiene a parte.
//
// Il taglio e' il GIORNO della rilevazione: i movimenti di quel giorno si
// considerano dentro, perche' chi la scrive la sera sta gia' guardando un portale
// aggiornato; contano quelli finiti dal giorno dopo. E' la stessa regola di
// Dichiarazioni Impianti, Giacenze e Predittivita': un carico non puo' risultare
// dentro per un modulo e fuori per un altro.
import { giornoRoma } from "./giornoItaliano.ts";

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

/** L'ultima rilevazione per ciascuno stoccaggio, per chiave normalizzata. */
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
 * Che cosa ci si aspettava di leggere in una rilevazione, classe per classe.
 *
 *   atteso = rilevazione precedente + ingressi - uscite del periodo
 *   scarto = letto - atteso
 *
 * Uno scarto negativo vuol dire che il portale mostra meno di quanto i movimenti
 * dicono; positivo, di piu'. I candidati a spiegarlo si cercano fra i movimenti
 * dello stesso canale nel periodo: quelli il cui peso, da solo, fa lo scarto, e
 * quelli finiti a ridosso della lettura e chiusi a portale dopo. Un formulario
 * finito nella classe sbagliata spiega due scarti opposti, uno per classe: per
 * questo i candidati si cercano in tutto il canale e non nella sola classe.
 *
 * @param {object} rilevazione  il record GiacenzaStoccaggio appena letto
 * @param {object} precedente   la rilevazione prima di questa, o null
 * @param {array}  movimenti    movimenti del piazzale (movimentoStoccaggio), tutto l'archivio
 */
export function verificaRilevazione(rilevazione, precedente, movimenti) {
  const del = momentoRilevazione(rilevazione);
  const precedenteDel = precedente ? momentoRilevazione(precedente) : '';
  const letto = classiDiRilevazione(rilevazione);
  const partenza = precedenteDel ? classiDiRilevazione(precedente) : null;
  // Senza una rilevazione prima non c'e' un punto di partenza: non si attende nulla.
  const periodo = precedenteDel ? fraLeRilevazioni(movimenti, precedenteDel, del) : [];
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
      classi_che_scostano: scostano,
      quadra: precedenteDel ? scostano.length === 0 : null,
      // Il caso del 16/09: il totale del canale torna, la ripartizione fra le classi no.
      ripartizione_sbagliata: scostano.length > 0 && scartoCanale === 0,
    };
  }

  const scostano = classi.filter(c => c.scarto).map(c => c.classe);
  return {
    del,
    precedente_del: precedenteDel,
    senza_precedente: !precedenteDel,
    classi,
    scostano,
    // Senza una rilevazione precedente non si puo' dire se quadra: non si dice.
    quadra: precedenteDel ? scostano.length === 0 : null,
    canali,
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
