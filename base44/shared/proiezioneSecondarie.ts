// Il gia' arrivato di rete degli impianti seguiti e le date da sistemare dei
// loro formulari: i due conti che la predittivita' delle secondarie condivide
// con il resto del gestionale.
//
// La predittivita' vera e propria - le due proiezioni, la ripartizione degli
// stoccaggi per priorita', il programma della settimana - sta nel motore,
// base44/shared/predittivita.ts (26/09/2026). Qui prima c'era anche la
// proiezione mese per mese (13,5 t a viaggio, mesi interi), uno dei tre conti
// diversi per la stessa domanda: e' stata tolta.
//
// Solo rete, solo terminati, per fine trasporto sul giorno italiano.

import { eTerminato, periodoMovimento, canaleMovimento, ordiniDaSistemare, testoOrdine, ordineSenzaFine } from "./movimenti.ts";
import { formatoKg, formatoTonnellate } from "./formato.ts";

const tonnellate = (kg) => formatoTonnellate((Number(kg) || 0) / 1000);

// ---------------------------------------------------------------------------
// Il gia' arrivato di rete di un impianto seguito: un conto solo.
//
// Regola dell'utente del 22/09/2026: le primarie scaricate nel piazzale di un
// impianto seguito (tipo_destinazione 'stoc', per esempio lo stoccaggio di
// Irigom) «si contano perché la predittività delle secondarie si basa sul
// residuo totale che diminuisce anche con le primarie». Fino a quel giorno i
// conti erano tre e non coincidevano: la Proiezione le contava, la Dashboard
// (calcolaPianificazioneSecondaria) teneva solo le primarie scaricate
// all'impianto, e il suggerimento del lunedi' aveva un conto suo, che contava
// anche le secondarie dal piazzale dell'impianto all'impianto stesso. Adesso
// lo legge il motore della predittivita' (predittivita.ts), e da li' tutte le
// schede, il programma del mercoledi' e gli assistenti:
//
//   gia' arrivato = primarie di rete terminate arrivate all'impianto
//                 + primarie di rete terminate scaricate nel suo piazzale (stesso
//                   soggetto), al netto di quello che dal piazzale riparte in
//                   secondaria per ALTRI impianti
//                 + secondarie di rete terminate arrivate all'impianto da ALTRI
//                   stoccaggi;
//   residuo       = target - gia' arrivato, lo stesso numero ovunque.
//
// Le secondarie dal piazzale dell'impianto all'impianto stesso non si contano
// mai: quei PFU si sono gia' contati quando sono arrivati al sito in primaria, e
// contarli di nuovo al trasbordo li farebbe valere due volte. Si contano a parte
// (da_se_stesso) e si dice quante sono.
//
// Il piazzale conta al netto (correzione del 22/09/2026, confermata
// dall'utente il 25/09/2026): quello che dal piazzale di T-Cycle parte per Tecnogum non lo
// tratta T-Cycle, e Tecnogum lo conta gia' fra le sue secondarie da altri
// stoccaggi. Tenuto anche nel gia' arrivato di T-Cycle, gli stessi PFU
// abbassavano due residui, e quello di T-Cycle usciva piu' piccolo del vero: il
// suo target di 1.050.000 kg e' la quota dell'impianto, mentre il plafond di
// 250.000 kg del piazzale (migraTCycleImpianto) e' proprio quello che si spedisce
// agli altri. Si toglie sul giorno della fine trasporto della secondaria.
//
// Le uscite dal piazzale seguono l'ordine di arrivo (utente, 27/09/2026): esce
// prima la giacenza vecchia, quella rimasta al 31/12 dell'anno prima, e poi, in
// ordine cronologico, quello che e' entrato dopo. Una partenza che prende dalla
// giacenza vecchia non era nel gia' arrivato dell'anno e non si toglie; solo
// quando la giacenza vecchia e' finita le partenze cominciano a togliere le
// primarie dell'anno.
//
// Si tolgono solo le partenze verso gli impianti seguiti, quelli con un target
// (utente, 27/09/2026): le secondarie verso impianti senza target non sono
// oggetto della predittivita' e stanno nel modulo Secondarie. Consumano pero'
// il piazzale come tutte le altre, nell'ordine di arrivo.
//
// Solo rete, solo terminati, e l'anno e' quello della fine trasporto sul giorno
// italiano (periodoMovimento): mai la chiusura a portale. Un terminato senza
// fine trasporto non si colloca e resta fuori, e lo segnala
// dateDaSistemareDiRete qui sotto.
// ---------------------------------------------------------------------------

const tipoPiazzale = (r) => String((r && r.tipo_destinazione) || '').toLowerCase().trim() === 'stoc';
const pesoDi = (r) => Number(r && r.peso_effettivo) || 0;
const piu = (mappa, k, kg) => { mappa[k] = (mappa[k] || 0) + kg; };

/**
 * Il gia' arrivato di rete di ogni impianto seguito, nell'anno.
 *
 * @param {Iterable<string>} impianti  le chiavi (ragione sociale normalizzata) degli impianti seguiti
 * @param {array} primarie    le primarie; si tengono da se' le terminate di rete
 * @param {array} secondarie  le secondarie; idem
 * @param {number} anno       l'anno della fine trasporto
 * @param {function} chiave   la normalizzazione della ragione sociale (normalizzaRagioneSociale)
 * @param {Map} [giacenzeIniziali]  chiave dell'impianto -> kg di rete nel suo
 *                            piazzale al 31/12 dell'anno prima (esce per prima)
 * @returns {Map} chiave dell'impianto -> {
 *   primaria_kg            primarie contate: all'impianto + piazzale al netto
 *   primaria_impianto_kg   scaricate all'impianto
 *   primaria_piazzale_kg   scaricate nel piazzale, tutte
 *   piazzale_ripartito_kg  di quelle, ripartite per altri impianti e tolte
 *   primaria_piazzale_netta_kg  primaria_piazzale_kg - piazzale_ripartito_kg
 *   ripartito_da_giacenza_vecchia_kg  partenze verso impianti seguiti uscite
 *                          dalla giacenza al 31/12 dell'anno prima: non si tolgono
 *   ripartito_non_tolto_kg partenze verso impianti seguiti che non trovavano ne'
 *                          giacenza vecchia ne' primarie dell'anno da cui togliersi
 *   secondaria_kg, totale_kg (il gia' arrivato), arrivato_al_sito_kg (tutto
 *   quello che e' arrivato al sito, ripartito compreso: per la capacita')
 *   primaria_per_mese, secondaria_per_mese   (indice del mese 0-11 -> kg; la
 *                primaria e' gia' al netto del ripartito, sul mese della partenza)
 *   movimenti   [{ flusso: 'primaria'|'secondaria'|'ripartita', piazzale, da, a,
 *                giorno, mese_idx, kg, record }]; le ripartite hanno i kg in
 *                negativo, cosi' la somma dei movimenti e' il gia' arrivato
 *   da_se_stesso { viaggi, kg }   le secondarie dal proprio piazzale, lasciate fuori
 *   verso_altri  { chiave destinazione -> { viaggi, kg, seguito } }  le secondarie
 *                partite dal suo piazzale verso un altro impianto; seguito se e'
 *                un impianto della predittivita', che le conta nel suo gia' arrivato
 * }
 */
export function giaArrivatoDiRete(impianti, primarie, secondarie, anno, chiave, giacenzeIniziali = null) {
  const out = new Map();
  // entrate e uscite del piazzale di ciascun impianto, per il netto
  const piazzale = new Map();
  for (const k of impianti || []) {
    if (!k || out.has(k)) continue;
    out.set(k, {
      chiave: k,
      primaria_kg: 0, primaria_impianto_kg: 0, primaria_piazzale_kg: 0,
      piazzale_ripartito_kg: 0, primaria_piazzale_netta_kg: 0, ripartito_da_giacenza_vecchia_kg: 0, ripartito_non_tolto_kg: 0,
      secondaria_kg: 0, totale_kg: 0, arrivato_al_sito_kg: 0,
      primaria_per_mese: {}, secondaria_per_mese: {},
      movimenti: [],
      da_se_stesso: { viaggi: 0, kg: 0 },
      verso_altri: {},
    });
    piazzale.set(k, []);
  }
  const anno_ = Number(anno);

  for (const r of primarie || []) {
    if (!eTerminato(r) || canaleMovimento(r, 'PrimariaRete') !== 'RETE') continue;
    const dest = chiave(r.destinazione);
    const x = out.get(dest);
    if (!x) continue;
    const p = periodoMovimento(r);
    if (!p || p.anno !== anno_) continue;
    const kg = pesoDi(r);
    const nelPiazzale = tipoPiazzale(r);
    x.primaria_kg += kg;
    if (nelPiazzale) {
      x.primaria_piazzale_kg += kg;
      piazzale.get(dest).push({ giorno: p.giorno, entra: kg });
    } else x.primaria_impianto_kg += kg;
    piu(x.primaria_per_mese, p.mese_idx, kg);
    x.movimenti.push({ flusso: 'primaria', piazzale: nelPiazzale, da: chiave(r.trasportatore), a: dest, giorno: p.giorno, mese_idx: p.mese_idx, kg, record: r });
  }

  for (const r of secondarie || []) {
    if (!eTerminato(r) || canaleMovimento(r, 'Secondaria') !== 'RETE') continue;
    const p = periodoMovimento(r);
    if (!p || p.anno !== anno_) continue;
    const dest = chiave(r.destinazione);
    const orig = chiave(r.stoccaggio);
    const kg = pesoDi(r);
    // partita dal piazzale di un impianto seguito verso un altro impianto: consuma
    // il piazzale; si toglie solo se l'altro e' seguito (vedi sopra)
    const partenza = orig && dest && orig !== dest ? out.get(orig) : null;
    if (partenza) {
      if (!partenza.verso_altri[dest]) partenza.verso_altri[dest] = { viaggi: 0, kg: 0, seguito: out.has(dest) };
      partenza.verso_altri[dest].viaggi++;
      partenza.verso_altri[dest].kg += kg;
      piazzale.get(orig).push({ giorno: p.giorno, esce: kg, mese_idx: p.mese_idx, dest, seguito: out.has(dest), record: r });
    }
    const x = out.get(dest);
    if (!x) continue;
    if (orig && orig === dest) { x.da_se_stesso.viaggi++; x.da_se_stesso.kg += kg; continue; }
    x.secondaria_kg += kg;
    piu(x.secondaria_per_mese, p.mese_idx, kg);
    x.movimenti.push({ flusso: 'secondaria', piazzale: tipoPiazzale(r), da: orig, a: dest, giorno: p.giorno, mese_idx: p.mese_idx, kg, record: r });
  }

  for (const x of out.values()) {
    // Il netto del piazzale, in ordine di giorno: nello stesso giorno prima le
    // entrate. Ogni partenza esce prima dalla giacenza vecchia, poi da quello
    // che nell'anno e' entrato nel piazzale e non e' ancora ripartito.
    const eventi = piazzale.get(x.chiave).sort((a, b) => (a.giorno < b.giorno ? -1 : a.giorno > b.giorno ? 1 : (a.esce ? 1 : 0) - (b.esce ? 1 : 0)));
    let vecchia = Math.max(0, Number(giacenzeIniziali && giacenzeIniziali.get(x.chiave)) || 0);
    let dentro = 0;
    for (const e of eventi) {
      if (!e.esce) { dentro += e.entra; continue; }
      const daVecchia = Math.min(e.esce, vecchia);
      vecchia -= daVecchia;
      const tolto = Math.min(e.esce - daVecchia, dentro);
      dentro -= tolto;
      if (!e.seguito) continue;
      x.ripartito_da_giacenza_vecchia_kg += daVecchia;
      x.ripartito_non_tolto_kg += e.esce - daVecchia - tolto;
      if (tolto <= 0) continue;
      x.piazzale_ripartito_kg += tolto;
      piu(x.primaria_per_mese, e.mese_idx, -tolto);
      x.movimenti.push({ flusso: 'ripartita', piazzale: true, da: x.chiave, a: e.dest, giorno: e.giorno, mese_idx: e.mese_idx, kg: -tolto, record: e.record });
    }
    x.primaria_impianto_kg = Math.round(x.primaria_impianto_kg);
    x.primaria_piazzale_kg = Math.round(x.primaria_piazzale_kg);
    x.piazzale_ripartito_kg = Math.round(x.piazzale_ripartito_kg);
    x.ripartito_da_giacenza_vecchia_kg = Math.round(x.ripartito_da_giacenza_vecchia_kg);
    x.ripartito_non_tolto_kg = Math.round(x.ripartito_non_tolto_kg);
    x.primaria_piazzale_netta_kg = x.primaria_piazzale_kg - x.piazzale_ripartito_kg;
    x.primaria_kg = x.primaria_impianto_kg + x.primaria_piazzale_netta_kg;
    x.secondaria_kg = Math.round(x.secondaria_kg);
    x.totale_kg = x.primaria_kg + x.secondaria_kg;
    x.arrivato_al_sito_kg = x.totale_kg + x.piazzale_ripartito_kg;
    x.da_se_stesso.kg = Math.round(x.da_se_stesso.kg);
    for (const v of Object.values(x.verso_altri)) v.kg = Math.round(v.kg);
  }
  return out;
}

/** Il residuo di rete di un impianto: target meno gia' arrivato, anche sotto zero se il target e' superato. */
export const residuoDiRete = (target, arrivato) => Math.round((Number(target) || 0) - ((arrivato && arrivato.totale_kg) || 0));

/**
 * Le note sul gia' arrivato di un impianto: le secondarie dal suo piazzale a se
 * stesso lasciate fuori, quelle partite dal suo piazzale verso altri impianti
 * (e' il caso di T-Cycle, il cui piazzale alimenta Tecnogum) e come il piazzale
 * conta al netto di quello che riparte. Dicono come e' fatto il conto, perche'
 * chi legge i residui di due impianti sappia che quei PFU stanno in uno solo.
 *
 * @param {object} x      un elemento di giaArrivatoDiRete
 * @param {function} nomeDi  chiave -> nome da mostrare
 * @param {number} anno
 */
export function noteGiaArrivato(x, nomeDi, anno) {
  if (!x) return [];
  const nome = (k) => (nomeDi ? nomeDi(k) : k) || k;
  const note = [];
  if (x.da_se_stesso.viaggi) {
    const n = x.da_se_stesso.viaggi;
    note.push(`${n} ${n === 1 ? 'secondaria' : 'secondarie'} di rete dal piazzale di ${nome(x.chiave)} all'impianto stesso (${tonnellate(x.da_se_stesso.kg)} t) non ${n === 1 ? 'è contata' : 'sono contate'} nel già arrivato: quei PFU si contano quando arrivano al sito in primaria, e contarli anche al trasbordo li farebbe valere due volte.`);
  }
  const uscite = Object.entries(x.verso_altri || {});
  for (const [dest, v] of uscite) {
    note.push(`Dal piazzale di ${nome(x.chiave)} sono partite nel ${anno} ${tonnellate(v.kg)} t di secondarie di rete per ${nome(dest)} (${v.viaggi} ${v.viaggi === 1 ? 'viaggio' : 'viaggi'})${v.seguito ? ', che le conta nel suo già arrivato' : `: ${nome(dest)} non ha un target, quindi non sono oggetto della predittività e non si tolgono dal già arrivato (si vedono nel modulo Secondarie)`}.`);
  }
  if (x.ripartito_da_giacenza_vecchia_kg) {
    note.push(`Delle secondarie partite dal piazzale di ${nome(x.chiave)} verso impianti seguiti, ${tonnellate(x.ripartito_da_giacenza_vecchia_kg)} t sono uscite dalla giacenza rimasta al 31/12/${Number(anno) - 1}: esce prima la giacenza vecchia, e quella non era nel già arrivato del ${anno}, quindi non si toglie.`);
  }
  if (x.piazzale_ripartito_kg) {
    const altroSeguito = uscite.some(([, v]) => v.seguito);
    note.push(`Il piazzale conta per ${nome(x.chiave)} al netto di quello che riparte per altri impianti seguiti, una volta finita la giacenza vecchia: delle ${tonnellate(x.primaria_piazzale_kg)} t di primarie di rete scaricate nel piazzale se ne tolgono ${tonnellate(x.piazzale_ripartito_kg)} t, e nel già arrivato ne restano ${tonnellate(x.primaria_piazzale_netta_kg)} t. Quello che riparte non lo tratta ${nome(x.chiave)}${altroSeguito ? ', e l\'impianto seguito che lo riceve lo conta già: tenuto anche qui, gli stessi PFU abbasserebbero due residui' : ''}.`);
  }
  if (x.ripartito_non_tolto_kg) {
    note.push(`${tonnellate(x.ripartito_non_tolto_kg)} t partite dal piazzale di ${nome(x.chiave)} non si tolgono dal già arrivato: nel ${anno}, fino al giorno della partenza, nel piazzale non c'erano né giacenza al 31/12/${Number(anno) - 1} né primarie di rete dell'anno da cui toglierle. Manca la giacenza al 31/12 del piazzale, oppure le primarie arrivate non sono segnate come scaricate nel piazzale: in quel caso va corretto il formulario.`);
  }
  return note;
}

/**
 * Gli ORDINI terminati di rete con le date obbligatorie da sistemare, fra quelli
 * che la predittivita' legge. Regola dell'utente del 22/09/2026: «le date
 * immissione, inizio e fine trasporto sono obbligatorie nei formulari, se non ci
 * sono vanno segnalate e questo vale sempre dove ci sono ordini terminati». Prima
 * qui si contavano solo i senza fine trasporto.
 *
 * Si guardano le primarie arrivate ai siti della predittivita' e le secondarie
 * che ne partono o ci arrivano: quelle con la fine trasporto nell'anno e quelle
 * senza fine trasporto di qualunque anno, che non si possono collocare. Chi ha
 * la fine trasporto resta nei conti, sul suo giorno, e si segnala; chi non l'ha
 * resta fuori da tutti i conti e si segnala lo stesso, dicendo quali date
 * mancano. Le regole sono quelle di movimenti.ts (dateDaSistemare, testoDate).
 *
 * Si contano ORDINI distinti, non righe (ordiniDaSistemare e chiaveOrdine di
 * movimenti.ts, la stessa degli elenchi e degli altri conti): lo stesso ordine
 * sta in archivio con piu' righe, una per classe o per quota, e contato riga per
 * riga usciva due volte nell'avviso ("2 ordini (ET1, ET1)"). Di un ordine si
 * dicono le date da sistemare di tutte le sue righe; e' fuori dai conti se a una
 * sua riga manca la fine trasporto.
 *
 * @param {Set|array} siti  le chiavi dei siti (sitiDellaPredittivita().tutti)
 * @returns {{ primarie: array, secondarie: array, senza_fine: { primarie, secondarie }, avviso: string }}
 *   ogni elemento e' un ordine: { id_ordine, testo, fuori_dai_conti, righe }
 */
export function dateDaSistemareDiRete(primarie, secondarie, siti, anno, chiave) {
  const dentro = siti instanceof Set ? siti : new Set(siti || []);
  const anno_ = Number(anno);
  // le righe che si guardano: dell'anno, o senza fine trasporto
  const dellAnno = (r) => { const p = periodoMovimento(r); return !p || p.anno === anno_; };
  const righe = { primarie: [], secondarie: [] };
  for (const r of primarie || []) {
    if (!eTerminato(r) || canaleMovimento(r, 'PrimariaRete') !== 'RETE') continue;
    if (dentro.has(chiave(r.destinazione)) && dellAnno(r)) righe.primarie.push(r);
  }
  for (const r of secondarie || []) {
    if (!eTerminato(r) || canaleMovimento(r, 'Secondaria') !== 'RETE') continue;
    if ((dentro.has(chiave(r.destinazione)) || dentro.has(chiave(r.stoccaggio))) && dellAnno(r)) righe.secondarie.push(r);
  }
  const esito = { primarie: [], secondarie: [], senza_fine: { primarie: 0, secondarie: 0 }, avviso: '' };
  for (const flusso of ['primarie', 'secondarie']) {
    for (const o of ordiniDaSistemare(righe[flusso])) {
      const r = o.righe[0];
      const fuori = ordineSenzaFine(o);
      esito[flusso].push({ id_ordine: String(r.id_ordine || r.numero_fir || ''), testo: testoOrdine(o), fuori_dai_conti: fuori, righe: o.righe.length });
      if (fuori) esito.senza_fine[flusso]++;
    }
  }
  esito.avviso = avvisoDate(esito, anno_);
  return esito;
}

// Quanti ordini mostrare per ogni tipo di date da sistemare: gli altri si contano.
const MOSTRA_ORDINI = 5;
// "manca la data di fine trasporto, 2 ordini (A, B); fine trasporto prima dell'inizio, 1 ordine (C)"
function descriviDate(elenco) {
  const gruppi = new Map();
  for (const x of elenco) {
    if (!gruppi.has(x.testo)) gruppi.set(x.testo, []);
    gruppi.get(x.testo).push(x.id_ordine || 'senza numero');
  }
  return [...gruppi.entries()].map(([testo, ordini]) => {
    const mostrati = ordini.slice(0, MOSTRA_ORDINI).join(', ');
    const altri = ordini.length > MOSTRA_ORDINI ? ` e altri ${formatoKg(ordini.length - MOSTRA_ORDINI)}` : '';
    return `${testo}, ${formatoKg(ordini.length)} ${ordini.length === 1 ? 'ordine' : 'ordini'} (${mostrati}${altri})`;
  }).join('; ');
}

function avvisoDate(e, anno) {
  const np = e.primarie.length, ns = e.secondarie.length;
  if (!np && !ns) return '';
  const ordini = (n) => `${formatoKg(n)} ${n === 1 ? 'ordine' : 'ordini'}`;
  const parti = [];
  if (np) parti.push(`Primarie, ${ordini(np)}: ${descriviDate(e.primarie)}.`);
  if (ns) parti.push(`Secondarie, ${ordini(ns)}: ${descriviDate(e.secondarie)}.`);
  let testo = `Ordini di rete terminati con le date obbligatorie da sistemare nei formulari (immissione, inizio e fine trasporto), verso gli impianti seguiti e i loro stoccaggi: quelli del ${anno} e quelli senza fine trasporto di qualunque anno. Ogni ordine si conta una volta, anche se ha più righe. ${parti.join(' ')}`;
  const sf = e.senza_fine.primarie + e.senza_fine.secondarie;
  if (sf) testo += ` Gli ordini senza fine trasporto (primarie: ${formatoKg(e.senza_fine.primarie)}, secondarie: ${formatoKg(e.senza_fine.secondarie)}) restano fuori dal già arrivato, dalle settimane e dalle giacenze degli stoccaggi finché un nuovo caricamento non porta la data.`;
  if (sf < np + ns) testo += ' Gli altri sono contati sul giorno della loro fine trasporto.';
  return testo;
}
