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
import { formatoKg } from "./formato.ts";
import {
  CLASSI_RILEVAZIONE,
  classiDiRilevazione,
  momentoRilevazione,
  movimentoStoccaggio,
  verificaRilevazione,
} from "./giacenzaStoccaggi.ts";

/** Il giorno da cui ripartira' l'anno dopo. */
export const giornoChiusura = (anno) => `${anno}-12-31`;

/** Il primo giorno del mese che nessuno deve dimenticare. */
export const primoDicembre = (anno) => `${anno}-12-01`;

/** I canali che il portale rileva, e le classi che ciascuno puo' muovere. */
const CLASSI_DI_CANALE = { RETE: ['P', 'M', 'G1', 'G2'], ACI: ['ACI'] };

/**
 * Le terziarie non sono un canale: escono da un impianto verso le cementerie e
 * la giacenza di PFU non la toccano. Stanno in un gruppo loro, come in Giacenze,
 * cosi' il numero della rete resta quello della rete.
 */
export const GRUPPO_TERZIARIE = 'TERZIARIE';

const kg = (v) => Math.round(Number(v) || 0);
const classiVuote = () => Object.fromEntries(CLASSI_RILEVAZIONE.map(c => [c, 0]));

/**
 * La classe di un prodotto, come la scrive il portale: "P - fino a 35 kg",
 * ".class1", "PFU Autodemolizione". E' la stessa regola di calcolaGiacenze
 * (classeDa): sta qui perche' serve a chi prepara i movimenti della chiusura,
 * e andra' tenuta in un punto solo.
 */
export function classePfu(...valori) {
  const t = valori.map(v => String(v || '')).join(' ').toUpperCase();
  if (/AUTODEMOL|\bACI\b|CLASS ?9/.test(t)) return 'ACI';
  if (/CLASS ?3|\bG ?1\b/.test(t)) return 'G1';
  if (/CLASS ?4|\bG ?2\b/.test(t)) return 'G2';
  if (/CLASS ?2|(^|[^A-Z0-9])M([^A-Z0-9]|$)/.test(t)) return 'M';
  if (/CLASS ?1|(^|[^A-Z0-9])P([^A-Z0-9]|$)/.test(t)) return 'P';
  return 'ND';
}

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
  return { ...m, sito, nome: nome || sito, ruolo, tipo };
}

/** La chiave di una voce dell'elenco: e' su questa che si scrive la decisione. */
export const chiaveVoce = (v) =>
  [v.sito, v.ruolo, v.tipo, v.verso, v.id_ordine || v.numero_fir || 'senza-ordine', v.classe].join('|');

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
      perche: m.chiuso_il
        ? `finito il ${m.finito_il}, chiuso a portale il ${m.chiuso_il}: dopo la fotografia del ${foto}`
        : `finito il ${m.finito_il} e non ancora chiuso a portale`,
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
  const applicate = [], ignorate = [], da_decidere = [], fuori_portale = [], non_applicabili = [];

  for (const v of voci || []) {
    // L'extra raccolta a portale non c'e': si elenca, non tocca nessuna lettura.
    if (!CLASSI_DI_CANALE[v.canale]) { fuori_portale.push(v); continue; }
    const scelta = String(decisioni[v.chiave] || '').trim();
    if (!scelta) { da_decidere.push(v); continue; }
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
    applicate.push({ ...v, decisione: scelta, classe_del_portale: dove || '', effetto_kg: segno * v.kg });
  }

  const differenza = {};
  for (const c of CLASSI_RILEVAZIONE) differenza[c] = classi[c] - partenza[c];
  return { lettura: partenza, classi, differenza, applicate, ignorate, da_decidere, fuori_portale, non_applicabili };
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

  const verifica_lettura = lettura ? verificaRilevazione(rilevazioneDaLettura(piazzale.nome, giorno, rett.lettura), precedente, movimenti) : null;
  const verifica_da_salvare = lettura ? verificaRilevazione(rilevazioneDaLettura(piazzale.nome, giorno, rett.classi), precedente, movimenti) : null;

  const negative = CLASSI_RILEVAZIONE.filter(c => rett.classi[c] < 0);
  const blocchi = [];
  if (!lettura) blocchi.push({ tipo: 'lettura_mancante', testo: `Manca la lettura del portale al ${giorno}: il saldo per classe della pagina Unita' Locali di Stoccaggio.` });
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
};

/**
 * L'elenco di cio' che serve e dove va messo. La procedura non inventa nessuno
 * di questi numeri: li chiede, e dice quali sono gia' arrivati.
 */
export function cosaChiedereAlPortale({ anno, piazzali = [], impianti = [], letture = {}, letture_impianti = {}, elenco = null } = {}) {
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
      cosa: `Lettura del saldo per classe al ${giorno}`,
      dove: DOVE.piazzale,
      campi: [...CLASSI_RILEVAZIONE],
      stato: l ? 'inserita' : 'da_chiedere',
      dicembre: dicembreDi(p.chiave, 'stoc'),
    });
  }
  for (const i of impianti) {
    const l = letture_impianti[i.chiave];
    richieste.push({
      chiave: i.chiave, nome: i.nome, tipo: 'impianto',
      cosa: `File degli ordini non dichiarati al ${giorno}`,
      dove: DOVE.impianto,
      campi: ['pfu_kg', 'aci_kg'],
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
              tipo: 'blocchi_diversi', sito: v.nome, campi: cambiati,
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
  if (!blocchi.length) avvisi.push({ tipo: 'niente_da_leggere', testo: "Nel file non ho riconosciuto nessuna tabella: servono le intestazioni «GIACENZE IMPIANTI» o «GIACENZE STOCCAGGI»." });
  return { al, blocchi: blocchi.length, stoccaggi, impianti, avvisi };
}

/**
 * Il confronto fra gli impianti e la lettera.
 * Il PFU (EER 16.01.03) e' la rete, l'ACI sta nella sua colonna e non si somma;
 * CSS-C, ciabattato, cippato e metalli sono derivati, si mostrano e basta:
 * non sono giacenza di PFU.
 */
export function confrontoLettera({ impianti = [], letture_impianti = {}, lettera = null, elenco = null } = {}) {
  const daLettera = new Map((lettera && lettera.impianti ? lettera.impianti : []).map(v => [v.chiave, v]));
  const visti = new Set();
  const righe = impianti.map(i => {
    const l = letture_impianti[i.chiave] || {};
    const v = daLettera.get(i.chiave) || null;
    if (v) visti.add(i.chiave);
    const letto = l.pfu_kg === undefined || l.pfu_kg === null || l.pfu_kg === '' ? null : kg(l.pfu_kg);
    const lettoAci = l.aci_kg === undefined || l.aci_kg === null || l.aci_kg === '' ? null : kg(l.aci_kg);
    const s = elenco ? vociDelSito(elenco, i.chiave, 'imp') : null;
    return {
      chiave: i.chiave, nome: i.nome,
      lettura_kg: letto, lettura_aci_kg: lettoAci, file_del: l.file_del || '',
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
    avvisi.push({ tipo: 'solo_in_lettera', sito: v.nome, testo: `${v.nome} sta nella lettera ma non fra gli impianti del gestionale.` });
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

  const impiantiConfronto = confrontoLettera({ impianti, letture_impianti, lettera, elenco });

  const avvisi = [...(lettera ? lettera.avvisi || [] : []), ...impiantiConfronto.avvisi];
  // Una lettera intestata a un altro 31 dicembre confronterebbe due anni diversi
  // senza dirlo: e' successo davvero, il file si chiama 31-12-2025 e dentro
  // dichiara le giacenze al 31/12/2024.
  if (lettera && lettera.al && lettera.al !== giorno) {
    avvisi.push({ tipo: 'lettera_altro_anno', testo: `La lettera dichiara le giacenze al ${lettera.al}, non al ${giorno}: controlla di aver caricato quella giusta.` });
  }
  const perCanaleInParole = (per) => Object.entries(per)
    .map(([canale, s]) => `${canale.replace(/_/g, ' ').toLowerCase()} ${s.n} per ${formatoKg(Math.abs(s.netto_kg))} kg netti`)
    .join('; ');
  if (elenco.n) {
    avvisi.push({ tipo: 'elenco_dicembre', n: elenco.n, testo: `Ci sono ${elenco.n} movimenti finiti a dicembre e non ancora chiusi a portale alla fotografia: ${perCanaleInParole(elenco.per_canale)}. Senza una decisione su ognuno non stanno ne' in questa fotografia ne' fra i movimenti dell'anno nuovo, e si perdono.` });
  }
  if (elenco.n_prima) {
    avvisi.push({ tipo: 'aperti_prima_di_dicembre', n: elenco.n_prima, testo: `Ci sono anche ${elenco.n_prima} movimenti dell'anno finiti prima di dicembre e ancora aperti a portale alla fotografia (${perCanaleInParole(elenco.per_canale_prima)}): la fotografia non li contiene, e uno scarto che resta dopo la rettifica di dicembre di solito e' loro.` });
  }

  return {
    anno,
    giorno,
    fotografia_del: elenco.fotografia_del,
    elenco_dicembre: elenco,
    richieste: cosaChiedereAlPortale({ anno, piazzali, impianti, letture, letture_impianti, elenco }),
    piazzali: confronti,
    impianti: impiantiConfronto.righe,
    lettera,
    riepilogo: {
      piazzali: confronti.length,
      piazzali_pronti: confronti.filter(c => c.pronto).length,
      piazzali_salvati: confronti.filter(c => c.gia_salvata).length,
      letture_mancanti: confronti.filter(c => !c.lettura).length,
      voci_dicembre: elenco.n,
      voci_aperte_prima: elenco.n_prima,
      voci_da_decidere: confronti.reduce((s, c) => s + c.rettifica.da_decidere.length, 0),
      impianti: impiantiConfronto.righe.length,
      impianti_letti: impiantiConfronto.righe.filter(r => r.lettura_kg !== null).length,
    },
    avvisi,
  };
}
