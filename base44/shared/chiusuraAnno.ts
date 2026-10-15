// La chiusura dell'anno: la fotografia da cui ripartono le giacenze dell'anno dopo.
//
// Ogni anno le giacenze devono ripartire dalla fotografia del 31 dicembre
// precedente (richiesta dell'utente, 23/09/2026). La fotografia e' una LETTURA
// del portale, non un conto nostro: per un piazzale il saldo per classe (P, M,
// G1 e G2 sono la rete, la classe 9 e' l'ACI), per un impianto il file degli
// ordini non ancora dichiarati a quella data. Questa procedura non inventa quei
// numeri: prepara l'elenco di cio' che serve, dice dove va messo, lo confronta
// con quello che i movimenti dicono e salva la fotografia dove i calcoli la
// cercheranno - un record di rilevazione al 31/12, lo stesso che la giacenza di
// uno stoccaggio usa come punto di partenza.
//
// IL RISCHIO DI UNA FOTOGRAFIA PRESA E BASTA: L'ELENCO DI DICEMBRE.
// Il periodo di un movimento e' la FINE DEL TRASPORTO; il portale chiude
// l'ordine giorni dopo. Al passaggio 2025-2026, sui dati veri: 3 secondarie
// finite a dicembre 2025 e chiuse a portale il 07/01/2026 (41.900 kg), 2
// primarie e 48 terziarie chiuse fra gennaio e febbraio (1.575 t). Una
// fotografia presa senza quell'elenco li perde per sempre: nella fotografia non
// ci sono, perche' il portale non li aveva ancora chiusi, e fra i movimenti
// dell'anno nuovo nemmeno, perche' per noi sono finiti a dicembre. Per questo
// l'elenco si guarda uno per uno e il salvataggio resta bloccato finche' una
// voce e' senza decisione.
//
// La chiusura a portale non decide nessun periodo, qui come altrove: dice
// soltanto se la fotografia quel movimento lo contiene gia'. E' l'unico uso che
// se ne fa, ed e' lo stesso di verificaRilevazione.
//
// I canali restano separati: rete, ACI ed extra raccolta non si sommano mai,
// nemmeno nel totale dell'elenco. L'extra raccolta a portale non c'e': le sue
// voci si elencano ma non toccano nessuna lettura.
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { contaFormulari } from "./formulari.ts";
import { notaCopia, daConfermare } from "./annoTarget.ts";
import { formatoKg } from "./formato.ts";
import { giornoRoma } from "./giornoItaliano.ts";
import { eTerminato } from "./movimenti.ts";
import { eAci } from "./canaleSecondaria.ts";
import { leggiDichiarazioni } from "./dichiarazioniImpianti.ts";
import { ingressoMovimento } from "./ingressoMovimento.ts";
import { carichiNonNelFile } from "./riconciliazioneDaDichiarare.ts";
import {
  CLASSI_RILEVAZIONE,
  ancoraDellAnno,
  classePfu,
  classiDiRilevazione,
  forseDopoLaChiusura,
  kgAciDiRilevazione,
  letturaDellaChiusura,
  kgReteDiRilevazione,
  momentoRilevazione,
  movimentoStoccaggio,
  scriviRettificate,
  verificaRilevazione,
} from "./giacenzaStoccaggi.ts";
import {
  GRUPPO_TERZIARIE, PERCHE_SENZA_FOTOGRAFIA, giornoFotografia, ordiniNotiAlPortale, ruoloDellaRiga, giornoAllImpianto,
  finiDelleSecondarie, dichiaratoDopoLaFotografia, aperturaDelSito, aperturaNetta, sitiDellAnno, arriviDopoLaChiusura,
} from "./giacenzaPortale.ts";

/** Il giorno da cui ripartira' l'anno dopo. */
export const giornoChiusura = (anno) => `${anno}-12-31`;

/**
 * Un giorno 'AAAA-MM-GG' come si scrive in un testo: gg/mm/aaaa (15/10/2026,
 * prova generale del cambio d'anno, difetto 31). I testi della chiusura - le
 * richieste, i blocchi, il perche' delle voci di dicembre, gli avvisi - si
 * leggono nella pagina, nel PDF e nel foglio Excel com'e': «al 2026-12-31» era
 * il formato delle chiavi, non delle frasi. Chiavi e campi (finito_il,
 * chiuso_il, giorno) restano ISO.
 */
export const giornoScritto = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '');

/** Il primo giorno del mese che nessuno deve dimenticare. */
export const primoDicembre = (anno) => `${anno}-12-01`;

/** I canali che il portale rileva, e le classi che ciascuno puo' muovere. */
const CLASSI_DI_CANALE = { RETE: ['P', 'M', 'G1', 'G2'], ACI: ['ACI'] };

/**
 * Le terziarie non sono un canale: escono da un impianto verso le cementerie e
 * la giacenza di PFU non la toccano. Stanno in un gruppo loro, come in Giacenze,
 * cosi' il numero della rete resta quello della rete.
 *
 * Il nome del gruppo e' uno solo, quello di shared/giacenzaPortale.ts, che usano
 * Giacenze, Dichiarazioni e ingressoMovimento: qui ce n'era una seconda copia,
 * uguale per caso (revisione della chiusura dell'audit, 11/10/2026). Si
 * riesporta, perche' la funzione della chiusura e le prove lo prendono da qui.
 */
export { GRUPPO_TERZIARIE };

/**
 * I GRUPPI CHE NON HANNO CLASSE (regola dell'utente, 28/09/2026).
 * Le terziarie escono dall'impianto verso le cementerie: non sono PFU divisi in
 * P, M, G1 e G2, e una classe non ce l'hanno. Gliene veniva data una per forza
 * ('ND') e finivano dentro il controllo per classe, che su di loro non vuol dire
 * niente: parole dell'utente, «togli le anomalie per classe, le terziarie non
 * hanno classe». Il controllo non si nasconde, si toglie dove non c'entra: per i
 * PIAZZALI, dove la classe esiste davvero, resta tutto.
 */
export const senzaClasse = (canale) => canale === GRUPPO_TERZIARIE;

const kg = (v) => Math.round(Number(v) || 0);
const classiVuote = () => Object.fromEntries(CLASSI_RILEVAZIONE.map(c => [c, 0]));

// La classe di un prodotto si legge con classePfu, che sta in
// shared/giacenzaStoccaggi.ts insieme al resto delle regole del piazzale: qui
// c'era una seconda copia della stessa regola, e le due si erano scostate.
export { classePfu };

/**
 * Vero se una lettura c'e' davvero. Un campo lasciato vuoto non arriva dal
 * browser, quindi una lettura appena sfiorata e poi cancellata sarebbe un
 * oggetto vuoto: salvata sarebbe un piazzale azzerato per sbaglio. Uno zero
 * scritto apposta invece vale: vuol dire piazzale verificato e vuoto.
 */
export function letturaPresente(lettura) {
  return !!lettura && CLASSI_RILEVAZIONE.some(c => Number.isFinite(Number(lettura[c])) && lettura[c] !== null && lettura[c] !== '');
}

/** Le classi di una lettura scritta a mano: kg interi, le sole classi del portale. */
export function classiDiLettura(lettura) {
  const out = classiVuote();
  for (const c of CLASSI_RILEVAZIONE) out[c] = kg(lettura && lettura[c]);
  return out;
}

/** Il record di rilevazione che una lettura del 31/12 produrrebbe. */
export function rilevazioneDaLettura(sito, giorno, lettura, extra = {}) {
  const c = classiDiLettura(lettura);
  return {
    sito,
    data_rilevazione: giorno,
    class1_kg: c.P, class2_kg: c.M, class3_kg: c.G1, class4_kg: c.G2, class9_kg: c.ACI,
    ...extra,
  };
}

/**
 * Un movimento dell'anno che si chiude, in forma compatta.
 * Il giorno e' sempre la fine del trasporto (movimentoStoccaggio); qui si
 * aggiunge di chi e' il movimento, con che ruolo e di che tipo, perche'
 * l'elenco di dicembre riguarda i piazzali e gli impianti insieme.
 */
export function movimentoChiusura(r, { sito = '', nome = '', ruolo = 'stoc', tipo = 'primaria', ...resto } = {}) {
  const m = movimentoStoccaggio(r, resto);
  // Chi non ha classe non se ne prende una per forza: resta vuota, e chi
  // controlla per classe lo vede e lo lascia stare.
  const classe = senzaClasse(m.canale) ? '' : m.classe;
  return { ...m, classe, sito, nome: nome || sito, ruolo, tipo };
}

/**
 * Su questa voce si puo' prendere una DECISIONE PER CLASSE, oppure si elenca e basta.
 *
 * Si decide solo dove esiste un saldo per classe del portale da rettificare: su un
 * PIAZZALE (di un impianto il portale ci da' il totale, non la ripartizione per
 * classe), in un canale che il portale rileva (l'extra raccolta a portale non c'e')
 * e con una classe (le terziarie escono verso le cementerie e in un saldo per classe
 * non ci sono - regola dell'utente, 28/09/2026). La pagina offre il pulsante
 * esattamente qui, e l'avviso deve contare esattamente questo: chiedere decisioni
 * dove non c'e' niente da premere e' un avviso che non si puo' chiudere.
 */
export const decidibilePerClasse = (v) => !!v && v.ruolo !== 'imp' && !senzaClasse(v.canale) && !!CLASSI_DI_CANALE[v.canale];

/** La chiave di una voce dell'elenco: e' su questa che si scrive la decisione. */
export const chiaveVoce = (v) =>
  [v.sito, v.ruolo, v.tipo, v.verso, v.id_ordine || v.numero_fir || 'senza-ordine', v.classe || 'senza-classe'].join('|');

/**
 * La chiave di un gruppo dell'elenco: sito e RUOLO.
 * Chi e' insieme impianto e stoccaggio - Irigom, T-Cycle - ha due giacenze
 * diverse, che si leggono in due modi diversi: quello che arriva al suo
 * piazzale non e' quello che ha in impianto, e non si mescolano.
 */
export const chiaveGruppo = (sito, ruolo) => `${sito}|${ruolo === 'imp' ? 'imp' : 'stoc'}`;

const vuotoCanale = () => ({ n: 0, formulari: 0, ingressi: 0, ingressi_kg: 0, uscite: 0, uscite_kg: 0, netto_kg: 0 });

function sommaVoci(voci) {
  const per = {};
  for (const v of voci) {
    if (!per[v.canale]) per[v.canale] = vuotoCanale();
    const s = per[v.canale];
    s.n++;
    if (v.verso === 'uscita') { s.uscite++; s.uscite_kg += v.kg; s.netto_kg -= v.kg; }
    else { s.ingressi++; s.ingressi_kg += v.kg; s.netto_kg += v.kg; }
  }
  // I formulari si contano per numero, una volta sola: lo stesso documento puo'
  // stare su piu' ordini e contarlo due volte sballerebbe il confronto.
  for (const [canale, s] of Object.entries(per)) s.formulari = contaFormulari(voci.filter(v => v.canale === canale));
  return per;
}

/**
 * L'ELENCO DI DICEMBRE: i movimenti finiti a dicembre dell'anno che si chiude e
 * non ancora chiusi a portale alla data della fotografia. Sono quelli che la
 * fotografia non ha ancora scalato o aggiunto, e vanno visti uno per uno.
 *
 * @param {array}  movimenti      movimenti di piazzali e impianti (movimentoChiusura)
 * @param {number} anno           l'anno che si chiude
 * @param {string} fotografiaDel  il giorno della lettura del portale (per difetto il 31/12)
 */
export function elencoDicembre(movimenti, anno, { fotografiaDel = '' } = {}) {
  const dal = primoDicembre(anno);
  const al = giornoChiusura(anno);
  const foto = fotografiaDel || al;
  const voci = [];
  // I movimenti dell'anno finiti PRIMA di dicembre e ancora aperti alla
  // fotografia sono rari - il portale chiude in pochi giorni - ma se ci sono
  // hanno lo stesso identico effetto: si dicono, con quanto pesano.
  const prima = [];
  for (const m of movimenti || []) {
    // Senza fine trasporto un movimento non sta in nessun periodo: non e' di
    // dicembre e non si puo' mettere in una fotografia. Lo dicono gli altri
    // moduli, con nome e cognome; qui resta fuori.
    if (!m || !m.finito_il || m.finito_il > al || m.finito_il < `${anno}-01-01`) continue;
    // L'unico uso della chiusura a portale: dire se la fotografia lo contiene gia'.
    if (m.chiuso_il && m.chiuso_il <= foto) continue;
    const voce = {
      ...m,
      chiave: chiaveVoce(m),
      // Se su questa voce una decisione per classe esiste: lo legge l'avviso e lo
      // legge la pagina, che cosi' non possono dire due cose diverse.
      decidibile: decidibilePerClasse(m),
      perche: m.chiuso_il
        ? `finito il ${giornoScritto(m.finito_il)}, chiuso a portale il ${giornoScritto(m.chiuso_il)}: dopo la fotografia del ${giornoScritto(foto)}`
        : `finito il ${giornoScritto(m.finito_il)} e non ancora chiuso a portale`,
    };
    if (m.finito_il < dal) prima.push(voce); else voci.push(voce);
  }
  const ordine = (v, campo) => String(v[campo] || '');
  const perNomeEData = (a, b) => ordine(a, 'nome').localeCompare(ordine(b, 'nome'))
    || ordine(a, 'finito_il').localeCompare(ordine(b, 'finito_il'))
    || ordine(a, 'id_ordine').localeCompare(ordine(b, 'id_ordine'));
  voci.sort(perNomeEData);
  prima.sort(perNomeEData);

  const siti = [];
  const perSito = new Map();
  const riga = (v) => {
    const k = chiaveGruppo(v.sito, v.ruolo);
    if (!perSito.has(k)) {
      const r = { chiave: k, sito: v.sito, nome: v.nome, ruolo: v.ruolo === 'imp' ? 'imp' : 'stoc', voci: [], aperti_prima: [], per_canale: {}, per_canale_prima: {} };
      perSito.set(k, r);
      siti.push(r);
    }
    return perSito.get(k);
  };
  for (const v of voci) riga(v).voci.push(v);
  for (const v of prima) riga(v).aperti_prima.push(v);
  for (const s of siti) { s.per_canale = sommaVoci(s.voci); s.per_canale_prima = sommaVoci(s.aperti_prima); }

  // L'elenco si divide in due: quello su cui una decisione per classe si PUO'
  // prendere, e quello che si elenca e basta. Tenerli insieme faceva dire
  // all'avviso che servivano decisioni anche dove la pagina non offre niente da
  // premere, e la frase «senza una decisione su ognuno si perdono» era falsa.
  //
  // Una decisione per classe esiste solo dove esiste un saldo per classe del
  // portale da rettificare, cioe':
  //  - su un PIAZZALE, perche' solo i piazzali partono da una lettura del portale
  //    per classe (di un impianto si sa il totale, non la ripartizione);
  //  - nei canali che il portale rileva, RETE e ACI: l'extra raccolta a portale
  //    non c'e';
  //  - e solo se la classe c'e': le terziarie escono verso le cementerie e in un
  //    saldo per classe non ci sono (regola dell'utente, 28/09/2026).
  const perClasse = voci.filter(v => v.decidibile);
  const senzaLaClasse = voci.filter(v => !v.decidibile);

  return {
    anno,
    dal, al,
    fotografia_del: foto,
    n: voci.length,
    voci,
    siti,
    // Quanto pesa l'elenco: un totale per canale, mai uno solo. E' il rischio
    // che si corre a non guardarlo.
    per_canale: sommaVoci(voci),
    // Le voci che il controllo per classe riguarda, e le altre.
    n_per_classe: perClasse.length,
    per_canale_per_classe: sommaVoci(perClasse),
    senza_classe: senzaLaClasse,
    n_senza_classe: senzaLaClasse.length,
    per_canale_senza_classe: sommaVoci(senzaLaClasse),
    // Perche' su queste non si decide: sono tre motivi diversi, e dirli tutti e tre
    // «movimenti senza classe» era falso per due terzi.
    n_senza_classe_terziarie: senzaLaClasse.filter(v => senzaClasse(v.canale)).length,
    n_senza_classe_impianti: senzaLaClasse.filter(v => !senzaClasse(v.canale) && v.ruolo === 'imp').length,
    n_senza_classe_extra: senzaLaClasse.filter(v => !senzaClasse(v.canale) && v.ruolo !== 'imp' && !CLASSI_DI_CANALE[v.canale]).length,
    aperti_prima: prima,
    n_prima: prima.length,
    per_canale_prima: sommaVoci(prima),
  };
}

/** Le voci dell'elenco che riguardano un sito in un ruolo: il piazzale o l'impianto. */
export const vociDelSito = (elenco, sito, ruolo = 'stoc') =>
  (elenco && elenco.siti.find(s => s.chiave === chiaveGruppo(sito, ruolo))) || null;

// --- La rettifica: dalla lettura del portale alla fotografia da salvare ---
//
// Tre decisioni, una per voce, e nessuna presa dal gestionale:
//   'gia_nel_portale'  la fotografia lo contiene gia': non si tocca niente;
//   'rettifica'        il portale non ce l'ha ancora: si aggiunge (ingresso) o
//                      si toglie (uscita) dalla sua classe;
//   'classe:X'         il portale lo conta, ma nella classe X invece che nella
//                      sua: il peso si sposta da X alla classe giusta e il
//                      totale del canale non cambia. E' il caso del 16/09 su
//                      Nappi Sud, dove il totale tornava e la ripartizione no.

/** La classe indicata da una decisione 'classe:X', oppure stringa vuota. */
export function classeDecisa(decisione) {
  const s = String(decisione || '').trim();
  if (!s.toLowerCase().startsWith('classe:')) return '';
  const c = s.slice(7).trim().toUpperCase();
  return CLASSI_RILEVAZIONE.includes(c) ? c : '';
}

/**
 * La lettura del portale corretta con le decisioni prese sull'elenco di dicembre.
 * Restituisce le classi da salvare e, voce per voce, che cosa e' stato fatto.
 */
export function rettificaDicembre(lettura, voci, decisioni = {}) {
  const partenza = classiDiLettura(lettura);
  const classi = { ...partenza };
  const applicate = [], ignorate = [], da_decidere = [], fuori_portale = [], non_applicabili = [], senza_classe = [];

  for (const v of voci || []) {
    // Chi non ha classe sta fuori dal controllo per classe, prima di ogni altra
    // cosa: le terziarie escono verso le cementerie e in un saldo per classe non
    // ci sono. Si elencano, non si decidono e non producono nessuna anomalia.
    if (senzaClasse(v.canale)) { senza_classe.push(v); continue; }
    // L'extra raccolta a portale non c'e': si elenca, non tocca nessuna lettura.
    if (!CLASSI_DI_CANALE[v.canale]) { fuori_portale.push(v); continue; }
    // LA DECISIONE PER DIFETTO E' RETTIFICARE, E NON E' UN'IPOTESI (09/10/2026).
    //
    // In questo elenco ci finisce solo chi il portale NON aveva ancora chiuso
    // alla fotografia: e' il criterio con cui l'elenco si costruisce
    // (elencoDicembre, `m.chiuso_il && m.chiuso_il <= foto` esce). Se il portale
    // non l'aveva chiuso, nel saldo che si legge quel giorno non c'e': va
    // rettificato. Chiedere all'utente di confermarlo voce per voce era
    // chiedergli di ripetere quello che il portale ha gia' detto, e intanto la
    // fotografia restava bloccata - su Nappi Sud, quattro movimenti di dicembre
    // 2025 chiusi tutti il 07/01/2026.
    //
    // Resta sua l'ultima parola: «gia' nella lettura» se il portale quel saldo
    // lo ricalcola all'indietro, o la classe in cui il portale l'ha messo.
    const sceltaUtente = String(decisioni[v.chiave] || '').trim();
    const scelta = sceltaUtente || 'rettifica';
    if (scelta === 'gia_nel_portale') { ignorate.push({ ...v, decisione: scelta }); continue; }
    const dove = classeDecisa(scelta);
    if (scelta !== 'rettifica' && !dove) { da_decidere.push(v); continue; }
    // Un prodotto che non si riconosce non ha una classe in cui metterlo: si
    // dice, invece di scaricarlo su una classe a caso.
    if (!CLASSI_RILEVAZIONE.includes(v.classe)) { non_applicabili.push({ ...v, motivo: 'la classe del prodotto non si riconosce' }); continue; }
    const segno = v.verso === 'uscita' ? -1 : 1;
    classi[v.classe] += segno * v.kg;
    // 'classe:X': il portale l'aveva messo in X, da li' si toglie.
    if (dove) classi[dove] -= segno * v.kg;
    // `proposta`: l'ha decisa il gestionale, non l'utente. La pagina e i fogli
    // lo dicono, cosi' una rettifica applicata da se' non passa per una scelta
    // che qualcuno ha fatto.
    applicate.push({ ...v, decisione: scelta, proposta: !sceltaUtente, classe_del_portale: dove || '', effetto_kg: segno * v.kg });
  }

  const differenza = {};
  for (const c of CLASSI_RILEVAZIONE) differenza[c] = classi[c] - partenza[c];
  return { lettura: partenza, classi, differenza, applicate, ignorate, da_decidere, fuori_portale, non_applicabili, senza_classe };
}

/** Le rilevazioni di un piazzale in ordine, dalla piu' vecchia alla piu' recente. */
function inOrdine(rilevazioni) {
  return [...(rilevazioni || [])].sort((a, b) =>
    momentoRilevazione(a).localeCompare(momentoRilevazione(b))
    || String(a.created_date || '').localeCompare(String(b.created_date || '')));
}

/**
 * Il confronto di un piazzale: che cosa ci si aspettava di leggere al 31/12,
 * che cosa e' stato letto e lo scarto, con e senza la rettifica di dicembre.
 *
 * L'attesa e il confronto li fa verificaRilevazione, lo stesso conto che
 * sorveglia le rilevazioni di tutti i giorni: qui cambia solo la data.
 */
export function confrontoPiazzale(piazzale, { anno, fotografiaDel = '', lettura: letta = null, voci = [], aperti_prima = [], decisioni = {} } = {}) {
  const giorno = giornoChiusura(anno);
  // Un oggetto senza nemmeno un numero non e' una lettura: e' un campo sfiorato.
  const lettura = letturaPresente(letta) ? letta : null;
  const storico = inOrdine(piazzale.rilevazioni);
  const movimenti = piazzale.movimenti || [];
  // Una rilevazione gia' registrata al 31/12 e' una fotografia gia' salvata: il
  // punto di partenza dell'attesa resta quella prima di lei.
  const gia = storico.filter(r => momentoRilevazione(r) === giorno);
  const precedente = storico.filter(r => momentoRilevazione(r) < giorno).pop() || null;
  const rett = rettificaDicembre(lettura, voci, decisioni);

  // L'attesa non dipende dalla lettura: si chiede con una lettura a zero e si
  // guardano le sole colonne dell'atteso.
  const soloAttesa = verificaRilevazione(rilevazioneDaLettura(piazzale.nome, giorno, {}), precedente, movimenti);
  const attesa = soloAttesa.classi.map(c => ({
    classe: c.classe, canale: c.canale,
    precedente_kg: c.precedente_kg,
    ingressi: c.ingressi, ingressi_kg: c.ingressi_kg,
    uscite: c.uscite, uscite_kg: c.uscite_kg,
    atteso: c.atteso,
  }));

  // La chiusura si giudica anche dall'ancora dell'anno: la giacenza da cui
  // l'anno e' ripartito, piu' tutti i movimenti da allora. E' il criterio con cui
  // si chiude - si riparte da una giacenza dichiarata e non si sbaglia piu' - e
  // qui serve piu' che altrove: se una lettura di mezzo era storta, il confronto
  // con la sola precedente accuserebbe proprio la chiusura.
  const ancora = ancoraDellAnno(storico, anno);
  const ancoraDel = ancora ? momentoRilevazione(ancora) : '';
  const intermedie = ancoraDel
    ? storico.filter(r => momentoRilevazione(r) > ancoraDel && momentoRilevazione(r) < giorno)
    : [];
  const conAncora = { ancora, intermedie };
  const verifica_lettura = lettura ? verificaRilevazione(rilevazioneDaLettura(piazzale.nome, giorno, rett.lettura), precedente, movimenti, conAncora) : null;
  const verifica_da_salvare = lettura ? verificaRilevazione(rilevazioneDaLettura(piazzale.nome, giorno, rett.classi), precedente, movimenti, conAncora) : null;

  // Una classe negativa si guarda solo DOVE UNA LETTURA C'E': rettificare un
  // saldo che non si e' ancora letto parte da zero, e il meno viene da li', non
  // da un piazzale in rosso. Senza questo, dal 09/10/2026 - da quando la
  // rettifica si applica da se' - ogni piazzale non ancora letto si sarebbe
  // portato dietro un secondo avviso che non voleva dire niente.
  const negative = lettura ? CLASSI_RILEVAZIONE.filter(c => rett.classi[c] < 0) : [];
  const blocchi = [];
  if (!lettura) blocchi.push({ tipo: 'lettura_mancante', testo: `Manca la lettura del portale al ${giornoScritto(giorno)}: il saldo per classe della pagina Unita' Locali di Stoccaggio.` });
  if (rett.da_decidere.length) blocchi.push({ tipo: 'dicembre_da_decidere', n: rett.da_decidere.length, testo: `${rett.da_decidere.length === 1 ? "Una voce dell'elenco di dicembre e' senza decisione" : `${rett.da_decidere.length} voci dell'elenco di dicembre sono senza decisione`}: per ognuna va detto se la fotografia la contiene gia'.` });
  if (rett.non_applicabili.length) blocchi.push({ tipo: 'classe_sconosciuta', n: rett.non_applicabili.length, testo: `${rett.non_applicabili.length} movimenti hanno un prodotto che non si riconosce: la classe va decisa prima di salvare.` });
  if (negative.length) blocchi.push({ tipo: 'classe_negativa', classi: negative, testo: `Dopo la rettifica ${negative.length === 1 ? 'la classe' : 'le classi'} ${negative.join(', ')} ${negative.length === 1 ? 'resta negativa' : 'restano negative'}: un piazzale non puo' avere meno di zero.` });

  return {
    // La chiave normalizzata: e' quella con cui si scrivono le letture e con
    // cui l'elenco di dicembre raggruppa le voci.
    sito: piazzale.chiave || piazzale.sito || '',
    nome: piazzale.nome,
    anno,
    giorno,
    fotografia_del: fotografiaDel || giorno,
    precedente_del: precedente ? momentoRilevazione(precedente) : '',
    precedente_classi: precedente ? classiDiRilevazione(precedente) : null,
    gia_salvata: gia.length > 0,
    gia_salvata_classi: gia.length ? classiDiRilevazione(gia[gia.length - 1]) : null,
    lettura: lettura ? rett.lettura : null,
    rettifica: rett,
    da_salvare: lettura && !blocchi.length ? rett.classi : null,
    attesa,
    verifica_lettura,
    verifica_da_salvare,
    dicembre: { n: (voci || []).length, per_canale: sommaVoci(voci || []) },
    // Gli aperti di prima non si rettificano da qui: si dicono, perche' uno
    // scarto che resta dopo la rettifica di dicembre di solito e' loro.
    aperti_prima: { n: (aperti_prima || []).length, per_canale: sommaVoci(aperti_prima || []), voci: aperti_prima || [] },
    blocchi,
    pronto: !!lettura && blocchi.length === 0,
  };
}

// --- Che cosa chiedere al portale ---

const DOVE = {
  piazzale: "Portale, pagina Unita' Locali di Stoccaggio: il saldo per classe (P, M, G1, G2 e la classe 9, che e' l'ACI) al 31 dicembre.",
  impianto: 'Portale, file degli ordini non ancora dichiarati scaricato al 31 dicembre: il peso non dichiarato dell\'impianto.',
  // L'ACI degli impianti a portale non c'e' (decisione dell'utente del
  // 15/10/2026, D2): il numero da cui ripartire lo propone il gestionale.
  aci: "L'ACI degli impianti a portale non c'e': il gestionale propone la giacenza ACI che calcola al 31 dicembre (apertura + arrivi - dichiarato); accanto, la colonna ACI della lettera di Ecotyre e lo scarto.",
};

/**
 * DOVE SI LEGGE LA RETE DI UN IMPIANTO, CON L'ID GIUSTO (15/10/2026, prova
 * generale del cambio d'anno, difetto 4). Sotto la stessa ragione sociale il file
 * del portale ha le righe dell'impianto e quelle del suo piazzale: T-Cycle 118
 * righe con id destinazione 38449 (364.800 kg) e 72 con id 38490 (181.299 kg,
 * partite verso Tecnogum). La pagina chiedeva «il peso non dichiarato
 * dell'impianto» senza dire quale id contare, e il totale delle 190 righe
 * diventava un'apertura 2027 di 546,099 t. Ora il testo dice l'id da contare e
 * quante righe sono del piazzale.
 */
function doveDellImpianto(p) {
  if (!p || !p.rete) return DOVE.impianto;
  if (p.rete.non_dovuta) return `La rete questo impianto non ce la dichiara: non si legge. ${DOVE.aci}`;
  const r = p.rete;
  const ids = (r.id_impianto || []).join(', ');
  const piazzale = r.altro_ruolo && r.altro_ruolo.righe
    ? ` ${r.altro_ruolo.righe === 1 ? 'Una riga' : `Le ${r.altro_ruolo.righe} righe`} con id ${(r.altro_ruolo.id || []).join(', ') || 'diverso'} (${formatoKg(r.altro_ruolo.kg)} kg) ${r.altro_ruolo.righe === 1 ? "e' del suo piazzale e non si conta" : 'sono del suo piazzale e non si contano'}.`
    : '';
  return `${DOVE.impianto}${ids ? ` Conta solo le righe con id destinazione ${ids}.` : ''}${piazzale} ${DOVE.aci}`;
}

/**
 * L'elenco di cio' che serve e dove va messo. La procedura non inventa nessuno
 * di questi numeri: li chiede, e dice quali sono gia' arrivati.
 */
export function cosaChiedereAlPortale({ anno, piazzali = [], impianti = [], letture = {}, letture_impianti = {}, elenco = null, proposte = null } = {}) {
  const giorno = giornoChiusura(anno);
  const dicembreDi = (chiave, ruolo) => {
    const s = elenco ? vociDelSito(elenco, chiave, ruolo) : null;
    return { n: s ? s.voci.length : 0, per_canale: s ? s.per_canale : {} };
  };
  const richieste = [];
  for (const p of piazzali) {
    const l = letturaPresente(letture[p.chiave]) ? letture[p.chiave] : null;
    richieste.push({
      chiave: p.chiave, nome: p.nome, tipo: 'piazzale',
      cosa: `Lettura del saldo per classe al ${giornoScritto(giorno)}`,
      dove: DOVE.piazzale,
      campi: [...CLASSI_RILEVAZIONE],
      stato: l ? 'inserita' : 'da_chiedere',
      dicembre: dicembreDi(p.chiave, 'stoc'),
    });
  }
  for (const i of impianti) {
    const l = letture_impianti[i.chiave];
    const p = proposte ? proposte[i.chiave] : null;
    // Chi la rete non la dichiara (Tecnogum) non ha una rete da leggere: si
    // chiede solo l'ACI (decisione dell'utente del 15/10/2026, D3).
    const nonDovuta = i.dichiara_rete === false || !!(p && p.rete && p.rete.non_dovuta);
    richieste.push({
      chiave: i.chiave, nome: i.nome, tipo: 'impianto',
      cosa: nonDovuta
        ? `ACI al ${giornoScritto(giorno)} (la rete non ce la dichiara)`
        : `File degli ordini non dichiarati al ${giornoScritto(giorno)}, e l'ACI`,
      dove: doveDellImpianto(p),
      campi: nonDovuta ? ['aci_kg'] : ['pfu_kg', 'aci_kg'],
      stato: l && (l.pfu_kg !== undefined || l.aci_kg !== undefined) ? 'inserita' : 'da_chiedere',
      dicembre: dicembreDi(i.chiave, 'imp'),
    });
  }
  return richieste;
}

// --- La lettera delle giacenze di fine anno ---
//
// E' la comunicazione che si manda al consorzio: due tabelle, i piazzali per
// classe e gli impianti per codice EER. Si legge come la si riceve, a righe di
// celle, e non si corregge: serve a confrontare, e una differenza si dice.
//
// Il file vero del 31/12 porta la tabella degli impianti due volte, la seconda
// con numeri diversi (GATIM 176.140 kg nella seconda e niente nella prima):
// i blocchi si leggono tutti, vale l'ultimo e la differenza si segnala.

const MARCATORE = /^giacenze\s+(impianti|stoccaggi)$/i;
const CONTINUA = /^(\s*|\[\s*kg\s*\]|eer\b.*)$/i;

const testo = (v) => String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim();
const numero = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : Math.round(n);
};

/** Le colonne di un blocco: si riconoscono dal titolo, che puo' stare su piu' righe. */
function colonneDelBlocco(righe, inizio) {
  const titoli = [];
  let fine = inizio;
  for (let k = inizio; k < Math.min(righe.length, inizio + 4); k++) {
    const riga = righe[k] || [];
    if (k > inizio && !CONTINUA.test(testo(riga[0]))) break;
    riga.forEach((c, i) => { titoli[i] = `${titoli[i] || ''} ${testo(c)}`.trim(); });
    fine = k;
  }
  const colonne = {};
  titoli.forEach((t, i) => {
    // La prima colonna e' il nome del sito, in tutte e due le tabelle: non e'
    // un valore, e il suo titolo porta l'EER dell'intera tabella.
    if (i === 0) return;
    const T = t.toUpperCase();
    if (!T) return;
    if (/^P$/.test(T)) colonne.P = i;
    else if (/^M$/.test(T)) colonne.M = i;
    else if (/^G1$/.test(T)) colonne.G1 = i;
    else if (/^G2$/.test(T)) colonne.G2 = i;
    else if (/\bACI\b/.test(T)) colonne.aci_kg = i;
    else if (/16\.01\.03|\bPFU\b/.test(T)) colonne.pfu_kg = i;
    else if (/CSS|END OF WASTE/.test(T)) colonne.cssc_kg = i;
    else if (/CIABATT/.test(T)) colonne.ciabattato_kg = i;
    else if (/CIPP/.test(T)) colonne.cippato_kg = i;
    else if (/19\.12\.02|METALL/.test(T)) colonne.metalli_kg = i;
  });
  return { colonne, fine };
}

/** Un blocco della lettera: le sue righe e il totale che dichiara. */
function leggiBlocco(righe, inizio, tipo, foglio) {
  const { colonne, fine } = colonneDelBlocco(righe, inizio);
  const campi = Object.keys(colonne);
  if (!campi.length) return { blocco: null, fine };
  const voci = [];
  let totale = null;
  let k = fine + 1;
  for (; k < righe.length; k++) {
    const riga = righe[k] || [];
    const nome = testo(riga[0]);
    const valori = {};
    let qualcosa = false;
    for (const campo of campi) {
      const n = numero(riga[colonne[campo]]);
      valori[campo] = n === null ? null : n;
      if (n !== null) qualcosa = true;
    }
    if (/^totale/i.test(nome)) { totale = valori; k++; break; }
    if (!nome) { if (qualcosa) continue; break; }
    if (MARCATORE.test(nome)) break;
    voci.push({ nome, chiave: normalizzaRagioneSociale(nome), ...valori });
  }
  return { blocco: { tipo, foglio, campi, voci, totale }, fine: k - 1 };
}

/** Il giorno a cui la lettera si riferisce, se lo scrive: "... al 31/12/2024". */
function giornoDellaLettera(riga) {
  for (const c of riga || []) {
    const m = /\bal\s+(\d{2})\/(\d{2})\/(\d{4})\b/i.exec(testo(c));
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return '';
}

/**
 * La lettera delle giacenze, letta come arriva.
 * @param {array} fogli  [{ nome, righe }], righe come array di celle
 */
export function leggiLetteraGiacenze(fogli) {
  const blocchi = [];
  let al = '';
  for (const foglio of fogli || []) {
    const righe = foglio.righe || [];
    for (let i = 0; i < righe.length; i++) {
      const riga = righe[i] || [];
      if (!al) al = giornoDellaLettera(riga);
      const marcatore = riga.map(testo).find(c => MARCATORE.test(c));
      if (!marcatore) continue;
      const tipo = /impianti/i.test(marcatore) ? 'impianti' : 'stoccaggi';
      const { blocco, fine } = leggiBlocco(righe, i, tipo, foglio.nome || '');
      if (blocco) blocchi.push(blocco);
      i = Math.max(fine, i);
    }
  }

  // Vale l'ultimo blocco; se uno prima diceva altro, la differenza si dice.
  const avvisi = [];
  const unisci = (tipo) => {
    const per = new Map();
    for (const b of blocchi.filter(x => x.tipo === tipo)) {
      for (const v of b.voci) {
        const prima = per.get(v.chiave);
        if (prima) {
          const cambiati = b.campi.filter(c => (prima[c] || 0) !== (v[c] || 0));
          if (cambiati.length) {
            avvisi.push({
              tipo: 'blocchi_diversi', livello: 'attenzione', sito: v.nome, campi: cambiati,
              testo: `${v.nome} compare piu' volte nella lettera con numeri diversi (${cambiati.join(', ')}): vale l'ultima tabella.`,
            });
          }
        }
        per.set(v.chiave, v);
      }
    }
    return [...per.values()];
  };

  const stoccaggi = unisci('stoccaggi');
  const impianti = unisci('impianti');
  if (!blocchi.length) avvisi.push({ tipo: 'niente_da_leggere', livello: 'attenzione', testo: "Nel file non ho riconosciuto nessuna tabella: servono le intestazioni «GIACENZE IMPIANTI» o «GIACENZE STOCCAGGI»." });
  return { al, blocchi: blocchi.length, stoccaggi, impianti, avvisi };
}

/**
 * Il confronto fra gli impianti e la lettera.
 * Il PFU (EER 16.01.03) e' la rete, l'ACI sta nella sua colonna e non si somma;
 * CSS-C, ciabattato, cippato e metalli sono derivati, si mostrano e basta:
 * non sono giacenza di PFU.
 */
export function confrontoLettera({ impianti = [], letture_impianti = {}, lettera = null, elenco = null, proposte = null } = {}) {
  const daLettera = new Map((lettera && lettera.impianti ? lettera.impianti : []).map(v => [v.chiave, v]));
  const visti = new Set();
  const righe = impianti.map(i => {
    const l = letture_impianti[i.chiave] || {};
    const v = daLettera.get(i.chiave) || null;
    if (v) visti.add(i.chiave);
    const letto = l.pfu_kg === undefined || l.pfu_kg === null || l.pfu_kg === '' ? null : kg(l.pfu_kg);
    const lettoAci = l.aci_kg === undefined || l.aci_kg === null || l.aci_kg === '' ? null : kg(l.aci_kg);
    const s = elenco ? vociDelSito(elenco, i.chiave, 'imp') : null;
    // LA PROPOSTA DEL GESTIONALE, ACCANTO A QUELLO CHE SI E' SCRITTO (15/10/2026,
    // difetti 4 e 6): la rete come il gestionale ha caricato il file del 31/12,
    // l'ACI come la calcola (decisione dell'utente del 15/10/2026, D2). Uno
    // scarto fra la casella e la proposta si dice col motivo, e un numero diverso
    // si salva solo confermato (apertureDegliImpianti).
    const p = proposte ? proposte[i.chiave] || null : null;
    const propostaRete = p && p.rete && !p.rete.non_dovuta ? p.rete.kg : null;
    const propostaAci = p && p.aci ? p.aci.kg : null;
    const scartoProposta = letto !== null && propostaRete !== null && propostaRete !== undefined ? letto - propostaRete : null;
    const scartoPropostaAci = lettoAci !== null && propostaAci !== null && propostaAci !== undefined ? lettoAci - propostaAci : null;
    return {
      chiave: i.chiave, nome: i.nome,
      dichiara_rete: !(i.dichiara_rete === false || (p && p.rete && p.rete.non_dovuta)),
      lettura_kg: letto, lettura_aci_kg: lettoAci, file_del: l.file_del || '',
      proposta: p,
      proposta_kg: propostaRete === undefined ? null : propostaRete,
      proposta_aci_kg: propostaAci === undefined ? null : propostaAci,
      scarto_proposta_kg: scartoProposta,
      scarto_proposta_aci_kg: scartoPropostaAci,
      motivo_scarto: scartoProposta ? motivoDelloScarto(p, letto) : '',
      motivo_scarto_aci: scartoPropostaAci ? motivoDelloScartoAci(p, lettoAci) : '',
      lettera: v ? {
        pfu_kg: v.pfu_kg || 0, aci_kg: v.aci_kg || 0, cssc_kg: v.cssc_kg || 0,
        ciabattato_kg: v.ciabattato_kg || 0, cippato_kg: v.cippato_kg || 0, metalli_kg: v.metalli_kg || 0,
      } : null,
      scarto_kg: letto !== null && v ? letto - (v.pfu_kg || 0) : null,
      scarto_aci_kg: lettoAci !== null && v ? lettoAci - (v.aci_kg || 0) : null,
      dicembre: { n: s ? s.voci.length : 0, per_canale: s ? s.per_canale : {} },
    };
  });
  const avvisi = [];
  for (const v of daLettera.values()) {
    if (visti.has(v.chiave)) continue;
    avvisi.push({ tipo: 'solo_in_lettera', livello: 'attenzione', sito: v.nome, testo: `${v.nome} sta nella lettera ma non fra gli impianti del gestionale.` });
  }
  return { righe, avvisi };
}

/** Il confronto fra un piazzale e la tabella dei piazzali della lettera. */
export function letteraDelPiazzale(lettera, chiave) {
  const v = (lettera && lettera.stoccaggi ? lettera.stoccaggi : []).find(x => x.chiave === chiave);
  if (!v) return null;
  const classi = classiVuote();
  for (const c of CLASSI_RILEVAZIONE) classi[c] = kg(c === 'ACI' ? v.aci_kg : v[c]);
  return { nome: v.nome, classi };
}

/**
 * La procedura intera, per un anno: l'elenco di dicembre, che cosa chiedere al
 * portale, il confronto di ogni piazzale e quello degli impianti con la lettera.
 * E' il dossier: la funzione lo restituisce, la pagina lo mostra, l'Excel lo scrive.
 */
export function preparaChiusura({
  anno,
  fotografia_del = '',
  piazzali = [],
  impianti = [],
  letture = {},
  decisioni = {},
  letture_impianti = {},
  lettera = null,
  proposte = null,
} = {}) {
  const giorno = giornoChiusura(anno);
  const tutti = [
    ...piazzali.flatMap(p => p.movimenti || []),
    ...impianti.flatMap(i => i.movimenti || []),
  ];
  const elenco = elencoDicembre(tutti, anno, { fotografiaDel: fotografia_del });

  const confronti = piazzali.map(p => {
    const s = vociDelSito(elenco, p.chiave, 'stoc');
    const c = confrontoPiazzale(p, {
      anno,
      fotografiaDel: fotografia_del,
      lettura: letturaPresente(letture[p.chiave]) ? letture[p.chiave] : null,
      voci: s ? s.voci : [],
      aperti_prima: s ? s.aperti_prima : [],
      decisioni,
    });
    return { ...c, lettera: letteraDelPiazzale(lettera, p.chiave) };
  });

  const impiantiConfronto = confrontoLettera({ impianti, letture_impianti, lettera, elenco, proposte });

  const avvisi = [...(lettera ? lettera.avvisi || [] : []), ...impiantiConfronto.avvisi];
  // Una lettera intestata a un altro 31 dicembre confronterebbe due anni diversi
  // senza dirlo: e' successo davvero, il file si chiama 31-12-2025 e dentro
  // dichiara le giacenze al 31/12/2024.
  if (lettera && lettera.al && lettera.al !== giorno) {
    avvisi.push({ tipo: 'lettera_altro_anno', livello: 'attenzione', testo: `La lettera dichiara le giacenze al ${giornoScritto(lettera.al)}, non al ${giornoScritto(giorno)}: controlla di aver caricato quella giusta.` });
  }
  // IN CIMA ALLA PAGINA SOLO QUELLO CHE CHIEDE QUALCOSA (09/10/2026).
  //
  // Erano tre riquadri ambra, ripetuti identici dentro la scheda dell'elenco, e
  // due dei tre non chiedevano niente: le terziarie una classe non ce l'hanno e
  // i movimenti degli impianti non entrano nella fotografia dei piazzali, quindi
  // non c'e' nessun pulsante da premere e l'avviso non si poteva chiudere. Su
  // 44 voci, 40 erano di questo tipo. Quello che si elenca e basta resta
  // nell'elenco, dove sta accanto alle righe che racconta; qui sale solo quello
  // che blocca la fotografia.
  // L'ACI DI UN IMPIANTO CON LA CASELLA VUOTA (15/10/2026, prova generale del
  // cambio d'anno, difetto 6). A portale l'ACI non c'e', la casella restava vuota
  // e il 2027 ripartiva da zero: Gatim, 5 t di ACI di dicembre non dichiarate al
  // 31/12/2026, spariva il 02/01 e andava a -5 t quando a gennaio arrivava la
  // dichiarazione di dicembre. Ora si dice, impianto per impianto, chi ha una
  // giacenza ACI al 31/12 e la casella vuota, con la proposta del gestionale e la
  // lettera accanto (decisione dell'utente del 15/10/2026, D2).
  // E UN NUMERO DIVERSO DALLA PROPOSTA (difetto 4): si dice lo scarto col
  // motivo, e si salva solo confermandolo.
  for (const r of impiantiConfronto.righe) {
    if (r.proposta_aci_kg !== null && r.proposta_aci_kg !== 0 && r.lettura_aci_kg === null) {
      avvisi.push({
        tipo: 'aci_vuota', livello: 'attenzione', sito: r.nome,
        testo: `${r.nome}: al ${giornoScritto(giorno)} il gestionale calcola ${formatoKg(r.proposta_aci_kg)} kg di ACI ancora da dichiarare, e la casella ACI e' vuota. Senza, l'ACI del ${Number(anno) + 1} non ha un'apertura e resta «—» nelle Giacenze e nelle Dichiarazioni${r.lettera ? `; la lettera di Ecotyre dice ${formatoKg(r.lettera.aci_kg)} kg` : ''}.`,
      });
    }
    if (r.scarto_proposta_kg) {
      avvisi.push({
        tipo: 'rete_diversa_dalla_proposta', livello: 'attenzione', sito: r.nome,
        testo: `${r.nome}: nella casella della rete ci sono ${formatoKg(r.lettura_kg)} kg, il gestionale propone ${formatoKg(r.proposta_kg)} kg (${r.motivo_scarto}). L'apertura si salva solo confermando il numero scritto.`,
      });
    }
    if (r.scarto_proposta_aci_kg) {
      avvisi.push({
        tipo: 'aci_diversa_dalla_proposta', livello: 'attenzione', sito: r.nome,
        testo: `${r.nome}: nella casella ACI ci sono ${formatoKg(r.lettura_aci_kg)} kg, ${r.motivo_scarto_aci}${r.lettera ? `; la lettera di Ecotyre dice ${formatoKg(r.lettera.aci_kg)} kg` : ''}. L'apertura si salva solo confermando il numero scritto.`,
      });
    }
    // UNA GIACENZA SOTTO ZERO AL 31/12 (revisione del 15/10/2026): la proposta
    // resta vuota e si dice perche', impianto per impianto, canale per canale.
    for (const [canale, nome] of [['rete', 'rete'], ['aci', 'ACI']]) {
      const x = r.proposta && r.proposta[canale];
      if (!x || !x.negativa) continue;
      avvisi.push({
        tipo: `${canale}_negativa`, livello: 'attenzione', sito: r.nome,
        testo: `${r.nome}: al ${giornoScritto(giorno)} il gestionale calcola ${formatoKg(x.calcolata_kg)} kg di ${nome}, sotto zero. Una giacenza sotto zero non esiste: c'e' una dichiarazione di troppo o un arrivo che manca, e va corretto prima. La casella non si riempie da sola, e un numero sotto zero non si salva.`,
      });
    }
  }
  const daDecidere = confronti.reduce((s, c) => s + c.rettifica.da_decidere.length, 0);
  if (daDecidere) {
    avvisi.push({
      tipo: 'elenco_dicembre', n: daDecidere, livello: 'attenzione',
      testo: `Ci sono ${daDecidere} movimenti di dicembre su cui la decisione non e' chiara: finche' restano cosi' non stanno ne' in questa fotografia ne' fra i movimenti dell'anno nuovo, e si perdono.`,
    });
  }

  return {
    anno,
    giorno,
    fotografia_del: elenco.fotografia_del,
    elenco_dicembre: elenco,
    richieste: cosaChiedereAlPortale({ anno, piazzali, impianti, letture, letture_impianti, elenco, proposte }),
    piazzali: confronti,
    impianti: impiantiConfronto.righe,
    lettera,
    riepilogo: {
      piazzali: confronti.length,
      piazzali_pronti: confronti.filter(c => c.pronto).length,
      piazzali_salvati: confronti.filter(c => c.gia_salvata).length,
      letture_mancanti: confronti.filter(c => !c.lettura).length,
      voci_dicembre: elenco.n,
      // Quante di quelle voci il controllo per classe le riguarda, e quante no.
      voci_per_classe: elenco.n_per_classe,
      voci_senza_classe: elenco.n_senza_classe,
      voci_aperte_prima: elenco.n_prima,
      voci_da_decidere: confronti.reduce((s, c) => s + c.rettifica.da_decidere.length, 0),
      impianti: impiantiConfronto.righe.length,
      impianti_letti: impiantiConfronto.righe.filter(r => r.lettura_kg !== null).length,
    },
    avvisi,
  };
}

/**
 * LE APERTURE DEGLI IMPIANTI PER L'ANNO DOPO (10/10/2026).
 *
 * La chiusura chiedeva gia' a ogni impianto le due letture del 31 dicembre -
 * il peso non dichiarato della rete e quello dell'ACI, dal file del portale
 * scaricato quel giorno - e le confrontava con la lettera di Ecotyre. Poi le
 * buttava. E nessun altro punto del gestionale le scriveva: la chiusura salvava
 * solo i piazzali, la copia d'anno crea le righe dell'anno nuovo SENZA apertura
 * (apposta: copiare quella del 2026 nel 2027 sarebbe sbagliato), e la lista
 * dell'anno nuovo non la controllava. Restava un campo a mano in Giacenze.
 *
 * Il 2 gennaio ogni impianto sarebbe ripartito da zero mentre il portale si porta
 * dietro la giacenza vera: con i numeri del 10/10/2026, circa 1.617 t di scarto
 * su Irigom, T-Cycle, Green Tyre e Gatim, e il guardiano notturno che li segnala
 * tutti dal primo giorno. L'audit del 10/10/2026 l'ha trovato prima di gennaio.
 *
 * La regola: si scrive solo quello che sta nelle caselle (la lettera e' un
 * confronto, non una fonte), sulla riga dell'impianto dell'anno dopo. Se la riga
 * non c'e' si crea come la creerebbe la copia d'anno - stessi campi, stessa nota
 * «da confermare» - cosi' la copia, dopo, la riconosce come sua e completa gli
 * altri siti invece di fermarsi. Un'apertura gia' scritta da una chiusura non si
 * cambia senza `sostituisci`: e' il punto da cui riparte un anno intero.
 *
 * LA RIGA DELL'ANNO DOPO ANCHE PER CHI NON HA LETTURA (15/10/2026, prova
 * generale del cambio d'anno, difetto 11; decisione dell'utente del
 * 15/10/2026, D3). Tecnogum la rete non ce la dichiara e l'ACI a portale non
 * c'e': senza lettura finiva fra i «senza lettura» e la sua riga 2027 non
 * nasceva. Chi sa che la rete non la dichiara e' proprio quella riga: senza, dal
 * 1° gennaio Tecnogum tornava un impianto che dichiara la rete (1.833,43 t a
 * portale, 320 ordini, e ogni notte «TECNOGUM SRL -1.833,43 t»). Ora la riga
 * dell'anno dopo nasce anche senza lettura - ruolo, tipologia e dichiara_rete
 * dall'anno che si chiude, nessun campo di apertura, nota «copiato dal 2026, da
 * confermare · dalla chiusura del 31/12/2026», che la copia d'anno riconosce
 * come sua - e a chi la rete non la dichiara la lettura di rete non si chiede:
 * non e' fra i «senza lettura». Un'apertura mai scritta resta «—» col perche'
 * (aperturaNetta), mai zero.
 *
 * UN NUMERO DIVERSO DALLA PROPOSTA SI SALVA SOLO CONFERMATO (15/10/2026,
 * difetto 4). La casella della rete si riempiva a mano dal file del 31/12, e il
 * file di T-Cycle ha sotto lo stesso nome 118 righe dell'impianto e 72 del suo
 * piazzale: il totale (546,099 t invece di 364,80) diventava l'apertura, e ogni
 * notte «T-CYCLE INDUSTRIES SRL +181,299 t». La chiusura ora propone la parte
 * dell'impianto come il gestionale ha caricato il file (proposteDegliImpianti) e
 * l'ACI che calcola al 31/12 (decisione dell'utente del 15/10/2026, D2); un
 * numero scritto diverso dalla proposta non si scrive finche' non e' confermato
 * (`conferme`, 'chiave|RETE' o 'chiave|ACI'): resta in `da_confermare` con lo
 * scarto e il motivo.
 *
 * E L'APERTURA SI LEGGE COI CARICHI ARRIVATI DOPO (15/10/2026, difetto 5). Al
 * salvataggio (`salvata_il`) la riga riceve l'istante e che cosa la proposta
 * aveva gia' contato (apertura_salvata_il, apertura_rettificate_json): i carichi
 * di fine dicembre che il portale chiude a gennaio, e che quella sera il
 * gestionale non aveva, si aggiungono leggendo (aperturaNetta), una volta sola.
 *
 * @param {object} p
 * @param {number} p.anno              l'anno che si chiude
 * @param {array}  p.impianti          gli impianti del dossier ({ chiave, nome, dichiara_rete })
 * @param {object} p.letture_impianti  per chiave: { pfu_kg, aci_kg } letti al 31/12
 * @param {array}  p.siti              le righe di GiacenzaSito (di tutti gli anni)
 * @param {function} p.chiave          il normalizzatore dei nomi
 * @param {boolean} p.sostituisci      riscrive un'apertura gia' scritta da una chiusura
 * @param {object} p.proposte          per chiave, le proposte del gestionale (proposteDegliImpianti)
 * @param {array}  p.conferme          'chiave|RETE', 'chiave|ACI': i numeri diversi dalla proposta confermati
 * @param {string} p.salvata_il        l'istante del salvataggio; vuoto quando si prepara soltanto
 */
export function apertureDegliImpianti({ anno, impianti = [], letture_impianti = {}, siti = [], chiave, sostituisci = false, proposte = null, conferme = [], salvata_il = '' } = {}) {
  const a = Number(anno);
  const dopo = a + 1;
  const al = giornoChiusura(a);
  const n = typeof chiave === 'function' ? chiave : ((v) => String(v || '').trim().toUpperCase());
  const numero = (v) => (v === undefined || v === null || String(v).trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  const t3 = (v) => Math.round(v) / 1000;
  const eImpianto = (s) => !String(s.tipo_destinazione || 'imp').toLowerCase().startsWith('stoc');
  const rigaDi = (ns, an) => (siti || []).find(s => s && Number(s.anno) === an && eImpianto(s) && n(s.sito) === ns) || null;
  const confermate = new Set((conferme || []).map(String));
  // La riga nuova dell'anno dopo, come la crea la copia d'anno: ruolo,
  // tipologia, dichiara_rete e i ruoli scritti, mai target ne' aperture.
  const rigaNuova = (i, ora, extra) => {
    const ruoli = Object.fromEntries(Object.entries(ora).filter(([c]) => c.startsWith('ruolo')));
    const riga = {
      sito: ora.sito || i.nome, tipo_destinazione: 'imp', anno: dopo,
      dichiara_rete: ora.dichiara_rete, tipologia_trattamento: ora.tipologia_trattamento, ...ruoli,
      ...extra,
    };
    for (const k of Object.keys(riga)) if (riga[k] === undefined) delete riga[k];
    return riga;
  };
  const piano = [], senzaLettura = [], gia = [], daConfermare = [], rifiutate = [];
  for (const i of impianti || []) {
    const l = (letture_impianti || {})[i.chiave] || {};
    const rete = numero(l.pfu_kg), aci = numero(l.aci_kg);
    // La riga dell'anno che si chiude; se manca, quella dell'anno prima ancora
    // (un sito portato avanti, sitiDellAnno).
    const ora = rigaDi(i.chiave, a) || rigaDi(i.chiave, a - 1) || {};
    const nonDichiara = ora.dichiara_rete === false || i.dichiara_rete === false;
    const esistente = rigaDi(i.chiave, dopo);
    if (rete === null && aci === null) {
      if (!nonDichiara) senzaLettura.push(i.nome);
      if (!esistente) piano.push({ azione: 'crea', sito: i.nome, senza_apertura: true, dati: rigaNuova(i, ora, { note: `${notaCopia(dopo)} · dalla chiusura del ${giornoScritto(al)}` }) });
      continue;
    }
    // UN NUMERO SOTTO ZERO NON DIVENTA UN'APERTURA (revisione del 15/10/2026):
    // una giacenza sotto zero non esiste, e nemmeno una conferma la rende vera.
    // Resta fuori, col motivo (rifiutate), come le classi negative di un piazzale.
    const sotto = [['rete', rete], ['ACI', aci]].filter(([, v]) => v !== null && v < 0);
    if (sotto.length) {
      rifiutate.push({ sito: i.nome, chiave: i.chiave, motivo: `${sotto.map(([c, v]) => `${c} ${formatoKg(Math.round(v))} kg`).join(', ')}: una giacenza sotto zero non esiste, e non diventa l'apertura del ${dopo}` });
      continue;
    }
    const p = proposte ? proposte[i.chiave] || null : null;
    const scarti = [];
    const propostaRete = p && p.rete && !p.rete.non_dovuta && p.rete.kg !== null && p.rete.kg !== undefined ? p.rete.kg : null;
    const propostaAci = p && p.aci && p.aci.kg !== null && p.aci.kg !== undefined ? p.aci.kg : null;
    if (rete !== null && propostaRete !== null && Math.round(rete) !== propostaRete && !confermate.has(`${i.chiave}|RETE`)) {
      scarti.push({ canale: 'RETE', letto_kg: Math.round(rete), proposta_kg: propostaRete, scarto_kg: Math.round(rete) - propostaRete, motivo: motivoDelloScarto(p, Math.round(rete)) });
    }
    if (aci !== null && propostaAci !== null && Math.round(aci) !== propostaAci && !confermate.has(`${i.chiave}|ACI`)) {
      scarti.push({ canale: 'ACI', letto_kg: Math.round(aci), proposta_kg: propostaAci, scarto_kg: Math.round(aci) - propostaAci, motivo: motivoDelloScartoAci(p, Math.round(aci)) });
    }
    if (scarti.length) { daConfermare.push({ sito: i.nome, chiave: i.chiave, scarti }); continue; }
    const dati = { apertura_del: al };
    if (rete !== null) dati.giacenza_riferimento_t = t3(rete);
    if (aci !== null) dati.giacenza_riferimento_aci_t = t3(aci);
    if (salvata_il) {
      dati.apertura_salvata_il = salvata_il;
      dati.apertura_rettificate_json = scriviRettificate(
        (p && p.rete && p.rete.fotografia_del) || '',
        (p && p.rete && p.rete.movimenti) || [],
        (p && p.aci && p.aci.movimenti) || [],
      );
    }
    if (esistente) {
      const giaScritta = esistente.apertura_del === al;
      const uguale = (dati.giacenza_riferimento_t === undefined || Number(esistente.giacenza_riferimento_t || 0) === dati.giacenza_riferimento_t)
        && (dati.giacenza_riferimento_aci_t === undefined || Number(esistente.giacenza_riferimento_aci_t || 0) === dati.giacenza_riferimento_aci_t);
      if (giaScritta && uguale) { gia.push({ sito: i.nome, motivo: 'gia\' scritta, uguale' }); continue; }
      if (giaScritta && !sostituisci) { gia.push({ sito: i.nome, motivo: `c'e' gia' un'apertura del ${giornoScritto(al)}: per cambiarla serve la conferma di sostituzione` }); continue; }
      piano.push({ azione: 'aggiorna', id: esistente.id, sito: i.nome, dati, prima: { rete_t: Number(esistente.giacenza_riferimento_t || 0), aci_t: Number(esistente.giacenza_riferimento_aci_t || 0) } });
    } else {
      piano.push({ azione: 'crea', sito: i.nome, dati: rigaNuova(i, ora, { ...dati, note: `${notaCopia(dopo)} · apertura dalla chiusura del ${giornoScritto(al)}` }) });
    }
  }
  return { anno: dopo, al, piano, senza_lettura: senzaLettura, gia_scritte: gia, da_confermare: daConfermare, rifiutate };
}

/** Perche' la rete scritta non e' la proposta: le parti della proposta, e quella che fa lo scarto se una lo fa al chilo. */
export function motivoDelloScarto(p, letto) {
  const r = p && p.rete;
  if (!r || r.kg === null || r.kg === undefined || letto === null || letto === undefined) return '';
  const scarto = Math.round(letto) - r.kg;
  if (!scarto) return '';
  const ids = (r.id_impianto || []).join(', ');
  const altro = r.altro_ruolo || { righe: 0, kg: 0, id: [] };
  if (altro.righe && scarto === altro.kg) {
    return `${altro.righe === 1 ? "una riga e' del piazzale" : `${altro.righe} righe sono del piazzale`}, id ${(altro.id || []).join(', ') || 'diverso'} (${formatoKg(altro.kg)} kg): si contano solo quelle dell'impianto${ids ? `, id ${ids}` : ''}`;
  }
  if (r.aggiunti_n && scarto === -r.aggiunti_kg) {
    return `${r.aggiunti_n === 1 ? 'manca il carico' : `mancano i ${r.aggiunti_n} carichi`} che il file non ha ancora (${formatoKg(r.aggiunti_kg)} kg): il gestionale li ha, e il portale li conta appena chiusi`;
  }
  if (r.dichiarato_dopo_kg && scarto === r.dichiarato_dopo_kg) {
    return `${formatoKg(r.dichiarato_dopo_kg)} kg sono stati dichiarati a portale dopo il file: il portale li ha gia' tolti`;
  }
  if (r.fuori_anno && r.fuori_anno.righe && scarto === r.fuori_anno.kg) {
    return `${r.fuori_anno.righe === 1 ? "una riga e' di un carico" : `${r.fuori_anno.righe} righe sono di carichi`} arrivati dopo il ${giornoScritto(r.al)} (${formatoKg(r.fuori_anno.kg)} kg)`;
  }
  return `il gestionale propone ${formatoKg(r.kg)} kg: ${formatoKg(r.file_kg)} kg dalle righe dell'impianto${ids ? ` (id ${ids})` : ''}, piu' ${formatoKg(r.aggiunti_kg)} kg di carichi che il file non ha ancora, meno ${formatoKg(r.dichiarato_dopo_kg)} kg dichiarati dopo il file`;
}

/** Perche' una proposta sotto zero resta vuota (revisione del 15/10/2026). */
export const PERCHE_PROPOSTA_NEGATIVA = "Al 31/12 il gestionale calcola meno di zero: una giacenza sotto zero non esiste, c'e' una dichiarazione di troppo o un arrivo che manca. Va corretto prima: l'apertura dell'anno dopo non lo deve ereditare, e la casella non si riempie da sola.";

/** Perche' l'ACI scritta non e' quella che il gestionale calcola al 31/12. */
export function motivoDelloScartoAci(p, letto) {
  const x = p && p.aci;
  if (!x || x.kg === null || x.kg === undefined || letto === null || letto === undefined) return '';
  if (!(Math.round(letto) - x.kg)) return '';
  return `il gestionale calcola ${formatoKg(x.kg)} kg al ${giornoScritto(x.al)}: apertura ${formatoKg(x.apertura_kg)} kg, piu' ${formatoKg(x.arrivi_kg)} kg arrivati, meno ${formatoKg(x.dichiarato_kg)} kg dichiarati`;
}

/**
 * LE PROPOSTE DELLA CHIUSURA PER GLI IMPIANTI (15/10/2026, prova generale del
 * cambio d'anno, difetti 4 e 6).
 *
 * LA RETE: la parte dell'impianto del file del 31/12, come il gestionale l'ha
 * caricato. Le righe del ruolo 'imp' (ruoloDellaRiga: quelle del piazzale dello
 * stesso sito, partite in secondaria, sono di chi le ha ricevute), piu' i
 * carichi terminati che il file non ha ancora (carichiNonNelFile), meno quello
 * che si e' dichiarato a portale dopo il file (dichiaratoDopoLaFotografia): e' il
 * giacenza_portale_t delle Giacenze al 31/12, con le stesse regole. Con un file
 * scaricato dopo il 31/12 (una chiusura salvata a gennaio) si tengono solo i
 * carichi arrivati entro il 31/12, e il dichiarato dopo il file lo toglie
 * l'apertura netta, leggendo.
 *
 * L'ACI: a portale non c'e'. Decisione dell'utente del 15/10/2026 (D2, «ok per
 * i tuoi consigli»): la chiusura propone la giacenza ACI che il gestionale
 * calcola al 31/12 - apertura + arrivi - dichiarato caricato entro il 31/12 - e
 * accanto mostra la colonna ACI della lettera di Ecotyre e lo scarto; la salva
 * l'amministratore quando l'ha vista. E' il giacenza_aci_t delle Giacenze al
 * 31/12.
 *
 * Ogni proposta porta i movimenti che ha contato e che una chiusura potrebbe
 * non vedere (forseDopoLaChiusura): al salvataggio diventano le voci gia' viste
 * dell'apertura (difetto 5).
 *
 * @returns {object} chiave -> { rete, aci }
 */
export function proposteDegliImpianti({
  anno, impianti = [], nonDichiarati = [], reportDichiarazioni = [], primarieRete = [], primarieAci = [], secondarie = [],
  dichiarazioniSito = [], giacenzeSito = [], chiaveDi = normalizzaRagioneSociale,
} = {}) {
  const a = Number(anno);
  const al = giornoChiusura(a);
  const inizio = `${a}-01-01`;
  const voluti = new Set((impianti || []).map(i => i.chiave));
  const siti = sitiDellAnno(giacenzeSito, a, { chiaveDi, annoDiOggi: a });
  const nonDichiaraRete = new Set(siti.righe.filter(g => g.dichiara_rete === false).map(g => chiaveDi(g.sito)));
  const ruoloPrimaria = new Map();
  const finePrimaria = new Map();
  for (const r of [...(primarieRete || []), ...(primarieAci || [])]) {
    const id = String((r && r.id_ordine) || '').trim();
    const td = String((r && r.tipo_destinazione) || '').toLowerCase().trim();
    if (id && td) ruoloPrimaria.set(id, td.startsWith('stoc') ? 'stoc' : 'imp');
  }
  for (const r of primarieRete || []) {
    const id = String((r && r.id_ordine) || '').trim();
    const g = eTerminato(r) ? giornoRoma(r.trasporto_finito_il) : '';
    if (id && g) finePrimaria.set(id, g);
  }
  const finiSecondarie = finiDelleSecondarie(secondarie);
  const foto = giornoFotografia(nonDichiarati);
  const conosce = ordiniNotiAlPortale();
  for (const r of nonDichiarati || []) conosce.segna(r);
  for (const r of reportDichiarazioni || []) conosce.segna(r, 'dichiarazioni');

  const per = new Map();
  const di = (ns) => {
    if (!per.has(ns)) per.set(ns, { file: { righe: 0, kg: 0 }, ids: new Set(), altro: { righe: 0, kg: 0, id: new Set() }, fuori: { righe: 0, kg: 0 }, aggiunti: [], aci: { kg: 0, movimenti: [] } });
    return per.get(ns);
  };
  for (const r of nonDichiarati || []) {
    const sec = String((r && r.destinazione_secondaria) || '').trim();
    const ns = chiaveDi(sec || (r && r.destinazione));
    if (!ns || !voluti.has(ns) || eAci({ prodotto: r.prodotto })) continue;
    const kgRiga = Number(r.peso_non_dichiarato_kg) || 0;
    const x = di(ns);
    if (ruoloDellaRiga(r, (id) => ruoloPrimaria.get(id) || '') === 'stoc') {
      x.altro.righe++; x.altro.kg += kgRiga;
      if (r.id_destinazione !== undefined && r.id_destinazione !== null && r.id_destinazione !== '') x.altro.id.add(String(r.id_destinazione));
      continue;
    }
    const g = giornoAllImpianto(r, { finiSecondarie, finePrimaria: (id) => finePrimaria.get(id) || '' });
    if (g && g > al) { x.fuori.righe++; x.fuori.kg += kgRiga; continue; }
    x.file.righe++; x.file.kg += kgRiga;
    const id = sec ? r.id_destinazione_secondaria : r.id_destinazione;
    if (id !== undefined && id !== null && id !== '') x.ids.add(String(id));
  }
  // I carichi che il file non ha ancora, arrivati entro il 31/12.
  const carichi = carichiNonNelFile({ foto, portaleConosce: conosce, chiaveDi, nonDichiaraRete });
  for (const r of primarieRete || []) carichi.segna(r, 'primaria');
  for (const r of secondarie || []) carichi.segna(r, 'secondaria');
  for (const m of carichi.movimenti()) {
    if (!voluti.has(m.ns) || !m.giorno || m.giorno > al) continue;
    di(m.ns).aggiunti.push(movimentoStoccaggio(m.r, { canale: 'RETE', verso: 'ingresso', classe: classePfu(m.r.classe, m.r.prodotto) }));
  }
  // Il dichiarato a portale dopo il file, fino al 31/12 (o fino al file, se e' dopo).
  const finoAl = foto > al ? foto : al;
  const dopo = dichiaratoDopoLaFotografia((dichiarazioniSito || []).filter(d => !d.caricata_il || String(d.caricata_il).slice(0, 10) <= finoAl), foto, chiaveDi);

  // L'ACI: gli arrivi all'impianto dell'anno, primarie e secondarie, entro il 31/12.
  const arrivi = arriviDopoLaChiusura();
  const segnaAci = (r, archivio) => {
    const d = ingressoMovimento(r, archivio, chiaveDi);
    arrivi.segna(r, d);
    if (!eTerminato(r) || d.canale !== 'ACI' || !d.arrivo || d.arrivo.ruolo !== 'imp') return;
    if (d.tipo !== 'primaria' && d.tipo !== 'secondaria') return;
    const g = giornoRoma(r.trasporto_finito_il);
    if (!g || g < inizio || g > al || !voluti.has(d.arrivo.chiave)) return;
    const x = di(d.arrivo.chiave);
    const m = movimentoStoccaggio(r, { canale: 'ACI', verso: 'ingresso', classe: 'ACI' });
    x.aci.kg += m.kg;
    if (forseDopoLaChiusura(m)) x.aci.movimenti.push(m);
  };
  for (const r of primarieAci || []) segnaAci(r, 'PrimariaAci');
  for (const r of primarieRete || []) segnaAci(r, 'PrimariaRete');
  for (const r of secondarie || []) segnaAci(r, 'Secondaria');
  const lette = leggiDichiarazioni((dichiarazioniSito || []).filter(d => !d.caricata_il || String(d.caricata_il).slice(0, 10) <= al), { anno: a, chiaveDi });
  const righeDi = (ns) => siti.righe.filter(g => chiaveDi(g.sito) === ns && String(g.tipo_destinazione || 'imp').toLowerCase().trim() !== 'stoc');

  const esito = {};
  for (const ns of voluti) {
    const x = di(ns);
    const aggiuntiKg = Math.round(x.aggiunti.reduce((s, m) => s + m.kg, 0));
    const dopoKg = Math.round(dopo.get(ns) || 0);
    const nonDovuta = nonDichiaraRete.has(ns);
    const ap = aperturaDelSito(righeDi(ns), 'ACI', dichiarazioniSito, chiaveDi, { annoPrimaNelGestionale: siti.haLAnnoPrima, arrivi: (k, c) => arrivi.di(k, c) });
    const dichAci = Math.round(lette.kgCaricati(ns, 'ACI'));
    const aperturaKg = ap.manca ? null : Math.round(ap.netta_t * 1000);
    // UNA GIACENZA SOTTO ZERO NON SI PROPONE (revisione del 15/10/2026). Irigom
    // con 20 t di ACI arrivate e 25 dichiarate e caricate (una dichiarazione
    // sbagliata) ha nelle Giacenze -5 t al 31/12: la chiusura la proponeva, la
    // pagina la metteva da se' nella casella, e il 2027 partiva da -5 t senza un
    // avviso. Una giacenza sotto zero non esiste: e' un errore da correggere, e
    // l'apertura dell'anno dopo non lo deve ereditare. La proposta resta vuota
    // (kg null), il numero calcolato si dice (calcolata_kg, negativa) e la
    // chiusura mette l'avviso impianto per impianto (preparaChiusura).
    const reteKg = nonDovuta || !foto ? null : Math.round(x.file.kg) + aggiuntiKg - dopoKg;
    const aciKg = aperturaKg === null ? null : aperturaKg + Math.round(x.aci.kg) - dichAci;
    const sottoZero = (v) => v !== null && v < 0;
    esito[ns] = {
      rete: {
        al, fotografia_del: foto || '',
        non_dovuta: nonDovuta,
        senza_file: !foto,
        // Senza il file del portale non c'e' niente da proporre; chi la rete non la
        // dichiara non ha una rete da leggere.
        kg: sottoZero(reteKg) ? null : reteKg,
        ...(sottoZero(reteKg) ? { calcolata_kg: reteKg, negativa: true, perche: PERCHE_PROPOSTA_NEGATIVA } : {}),
        ...(!foto && !nonDovuta ? { perche: PERCHE_SENZA_FOTOGRAFIA } : {}),
        file_kg: Math.round(x.file.kg), file_righe: x.file.righe, id_impianto: [...x.ids].sort(),
        altro_ruolo: { righe: x.altro.righe, kg: Math.round(x.altro.kg), id: [...x.altro.id].sort() },
        fuori_anno: { righe: x.fuori.righe, kg: Math.round(x.fuori.kg) },
        aggiunti_n: x.aggiunti.length, aggiunti_kg: aggiuntiKg,
        dichiarato_dopo_kg: dopoKg,
        movimenti: x.aggiunti.filter(forseDopoLaChiusura),
      },
      aci: {
        al,
        kg: sottoZero(aciKg) ? null : aciKg,
        ...(sottoZero(aciKg) ? { calcolata_kg: aciKg, negativa: true, perche: PERCHE_PROPOSTA_NEGATIVA } : {}),
        ...(ap.manca ? { manca: true, perche: ap.perche } : {}),
        apertura_kg: aperturaKg, arrivi_kg: Math.round(x.aci.kg), dichiarato_kg: dichAci,
        movimenti: x.aci.movimenti,
      },
    };
  }
  return esito;
}

/**
 * QUALI SITI ENTRANO NELLA CHIUSURA DELL'ANNO (10/10/2026).
 *
 * Un sito entra se nell'anno che si chiude ha un movimento, una rilevazione del
 * piazzale o una riga di GiacenzaSito; oppure se non ha fatto niente ma la sua
 * ultima rilevazione di prima aveva ancora PFU da smaltire, perche' quella
 * giacenza c'e' ancora (la regola degli impianti che svuotano l'anno prima, 23/09).
 *
 * Prima i movimenti si prendevano «fino al 31/12» senza un inizio: gli archivi
 * tengono anche il 2023-2025, e ogni sito passato di li' anni fa diventava un
 * piazzale o un impianto a cui chiedere la lettura del 31/12. Sui dati del
 * 10/10/2026 la chiusura del 2026 chiedeva i piazzali Ecorecuperi e Rpn e gli
 * impianti New Deal, Corgom, A.L.F., MAJESTIQUE CARBON e AKCANSA, nessuno con un
 * movimento nel 2026; e un piazzale senza lettura blocca il salvataggio.
 * L'utente: «devi sempre considerare come partner operativo Smoco», e quei siti
 * da anni non compaiono nei nostri ragionamenti.
 *
 * I movimenti degli anni prima restano a chi li usa (il saldo atteso parte
 * dall'ultima rilevazione, che puo' essere dell'anno prima): qui decidono
 * solo chi entra.
 *
 * @param {number} p.anno            l'anno che si chiude
 * @param {Map}    p.giorniPerSito   'chiave|stoc' o 'chiave|imp' -> giorni (AAAA-MM-GG) di fine trasporto
 * @param {array}  p.rilevazioni     le righe di GiacenzaStoccaggio, di tutti gli anni
 * @param {array}  p.giacenzeSito    le righe di GiacenzaSito dell'anno che si chiude
 * @param {function} p.chiave        il normalizzatore dei nomi
 * @returns {{ piazzali: Set, impianti: Set }} le chiavi dei siti che entrano
 */
export function sitiDellaChiusura({ anno, giorniPerSito = new Map(), rilevazioni = [], giacenzeSito = [], chiave } = {}) {
  const inizio = `${anno}-01-01`;
  const al = giornoChiusura(anno);
  const piazzali = new Set(), impianti = new Set();
  for (const [k, giorni] of giorniPerSito) {
    const [ns, ruolo] = String(k).split('|');
    if (!ns || !(giorni || []).some(g => g >= inizio && g <= al)) continue;
    (ruolo === 'imp' ? impianti : piazzali).add(ns);
  }
  // Le rilevazioni: quelle dell'anno contano tutte, anche a zero (un piazzale
  // rilevato quest'anno e' un piazzale di quest'anno; uno che non c'entra si
  // toglie da Giacenze > Stoccaggi, come PRT il 10/10/2026). Una senza data si
  // tiene: meglio una lettura chiesta in piu' che una giacenza persa. Di quelle
  // di prima conta solo l'ultima, e solo se ha ancora qualcosa.
  const ultimaPrima = new Map();
  for (const r of rilevazioni) {
    const ns = chiave(r && r.sito);
    if (!ns) continue;
    const g = String((r && r.data_rilevazione) || '').slice(0, 10);
    if (!g || (g >= inizio && g <= al)) { piazzali.add(ns); continue; }
    if (g < inizio) {
      const prima = ultimaPrima.get(ns);
      if (!prima || g > String(prima.data_rilevazione || '').slice(0, 10)) ultimaPrima.set(ns, r);
    }
  }
  for (const [ns, r] of ultimaPrima) {
    if (kgReteDiRilevazione(r) + kgAciDiRilevazione(r) > 0) piazzali.add(ns);
  }
  // Il ruolo scritto nell'anagrafica dell'anno vale sempre.
  for (const s of giacenzeSito) {
    const ns = chiave(s && s.sito);
    if (!ns) continue;
    const ruolo = String((s && s.tipo_destinazione) || '').toLowerCase().trim();
    (ruolo === 'stoc' ? piazzali : impianti).add(ns);
  }
  return { piazzali, impianti };
}

/**
 * Una riga creata dalla chiusura conta come copia «da confermare»: la copia
 * d'anno non si ferma. Con l'apertura («apertura dalla chiusura») o senza, per
 * l'impianto senza lettura («dalla chiusura», 15/10/2026).
 */
export const rigaDellaChiusura = (r) => daConfermare(r) && /dalla chiusura/.test(String((r && r.note) || ''));

/**
 * I CARICHI DI DICEMBRE ARRIVATI DOPO LA CHIUSURA (15/10/2026, prova generale del
 * cambio d'anno, difetto 5): la voce per l'amministratore. La sera del 31/12 il
 * gestionale non ha i carichi finiti a fine dicembre che il portale chiude a
 * gennaio; quando arrivano entrano da soli nell'apertura dell'anno dopo
 * (letturaDellaChiusura per i piazzali, aperturaNetta per gli impianti), e qui si
 * dice quanti sono e dove, perche' un numero che cambia da solo si deve vedere.
 * Nessuna lettura in piu': chi chiama ha gia' le rilevazioni, le righe dell'anno
 * dopo e i movimenti.
 *
 * @param {object} p
 *   anno            l'anno chiuso
 *   rilevazioni     le righe di GiacenzaStoccaggio
 *   righeAnnoDopo   le righe di GiacenzaSito dell'anno dopo
 *   piazzali        (chiave) -> movimenti del piazzale (movimentiDopoLaChiusura().di)
 *   arrivi          (chiave, canale) -> arrivi all'impianto (arriviDopoLaChiusura().di)
 *   dichiarazioni   tutte le DichiarazioneSito
 *   chiaveDi, nomeDi
 * @returns {{ n, voci: [{ sito, ruolo, canale, n, kg }], avviso }}
 */
export function arrivatiDopoLaChiusuraDellAnno({ anno, rilevazioni = [], righeAnnoDopo = [], piazzali = () => [], arrivi = () => [], dichiarazioni = [], chiaveDi = normalizzaRagioneSociale, nomeDi = (k) => k } = {}) {
  const al = giornoChiusura(anno);
  const voci = [];
  const ultime = new Map();
  for (const r of rilevazioni || []) {
    if (!r || !r.chiusura_salvata_il || momentoRilevazione(r) !== al) continue;
    const ns = chiaveDi(r.sito);
    const prima = ultime.get(ns);
    if (!prima || String(r.created_date || '') > String(prima.created_date || '')) ultime.set(ns, r);
  }
  for (const [ns, r] of ultime) {
    const letta = letturaDellaChiusura(r, piazzali(ns));
    const arr = (letta && letta.arrivati_dopo_la_chiusura) || [];
    for (const canale of ['RETE', 'ACI']) {
      const suoi = arr.filter(m => m.canale === canale);
      if (suoi.length) voci.push({ sito: nomeDi(ns) || r.sito, ruolo: 'stoc', canale, n: suoi.length, kg: suoi.reduce((t, m) => t + (m.verso === 'uscita' ? -m.kg : m.kg), 0) });
    }
  }
  for (const g of righeAnnoDopo || []) {
    if (!g || !g.apertura_salvata_il || String(g.apertura_del || '').slice(0, 10) !== al) continue;
    if (String(g.tipo_destinazione || 'imp').toLowerCase().trim() === 'stoc') continue;
    for (const canale of ['RETE', 'ACI']) {
      const x = aperturaNetta(g, canale, dichiarazioni, chiaveDi, { arrivi });
      if (x.arrivati_dopo) voci.push({ sito: nomeDi(chiaveDi(g.sito)) || g.sito, ruolo: 'imp', canale, n: x.arrivati_dopo, kg: Math.round(x.arrivati_dopo_t * 1000) });
    }
  }
  const n = voci.reduce((t, v) => t + v.n, 0);
  const nome = { RETE: 'rete', ACI: 'ACI' };
  const avviso = n ? {
    tipo: 'arrivati_dopo_la_chiusura', livello: 'informazione', n,
    testo: `${n === 1 ? 'Un carico finito' : `${n} carichi finiti`} entro il ${giornoScritto(al)} e chiusi a portale dopo la chiusura ${n === 1 ? "e' entrato" : 'sono entrati'} da soli nell'apertura del ${Number(anno) + 1}: `
      + voci.map(v => `${v.sito}${v.ruolo === 'stoc' ? ' (piazzale)' : ''}, ${nome[v.canale]}: ${v.n} per ${formatoKg(v.kg)} kg`).join('; ')
      + ". La chiusura non va rifatta: le letture del 31/12 restano quelle salvate.",
  } : null;
  return { n, voci, avviso };
}
