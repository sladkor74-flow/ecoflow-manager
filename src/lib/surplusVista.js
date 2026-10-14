// LA RIGA DEL SURPLUS NELLE PAGINE DELL'ATTIVA E DEL MARGINE (il surplus sulle
// tariffe, 13/10/2026).
//
// Richiesta dell'utente del 12/10/2026: in attiva come in passiva «una riga con
// l'importo standard ed una per il surplus (sempre riferito alle stesse
// tonnellate raccolte o trattate nel mese)», e tutto «in modo ordinato, elegante
// e professionale nonché semplice a colpo d'occhio». Il primo caso e' il Fuel
// Surcharge del consorzio Ecotyre, +5 €/t dal 01/10/2026 al 31/12/2026.
//
// La riga la fa il calcolo (base44/shared/attivaCalcolo.ts): una per canale e
// per surplus, con ZERO chili (le tonnellate su cui vale stanno in
// kg_riferimento, perche' nessuna somma di chili le conti due volte) e l'importo
// arrotondato una volta sul mese. Qui c'e' come le pagine la riconoscono, la
// mettono in fondo, la contano e la scrivono, in un punto solo: il riepilogo, i
// documenti, il dettaglio, la scheda della riga, la prefattura e il margine
// dicono le stesse parole e la mostrano con la stessa forma (STILE_SURPLUS e
// NomeSurplus.jsx: la barretta e l'etichetta «Surplus» nel colore del token
// --eco-surplus, il nome in corsivo, le tonnellate fra parentesi, come nella
// passiva e nelle tariffe).
//
// Il file non importa niente che legga il browser: le prove lo caricano in node
// (prove/attivaReportSurplus.mjs).
import { cifreItaliane, euro } from './formatoSoldi.js';
import { testoEuroT, periodoSurplus } from './surplus.js';

/** L'origine della riga di un surplus (VoceFatturazione.origine_dato), come in attivaCalcolo.ts. */
export const ORIGINE_SURPLUS = 'SURPLUS';

/**
 * La riga di un surplus: la stessa regola di eRigaSurplus in
 * base44/shared/attivaCalcolo.ts, che le pagine non possono importare (la prova
 * le confronta sulle stesse righe).
 */
export const eRigaSurplus = (riga) => !!riga && (!!riga.surplus_id || riga.origine_dato === ORIGINE_SURPLUS);

/**
 * Le righe dei formulari (e dei sovracosti a corpo dell'extra raccolta): tutte
 * tranne quelle dei surplus, nello stesso ordine. Sono le righe di prima del
 * surplus: i chili, gli ordini e il «Totale formulari» dei tre report
 * dell'amministrazione si contano su queste.
 */
export const soloFormulari = (righe) => (righe || []).filter(r => !eRigaSurplus(r));

// Il primo giorno di validita' della riga di un surplus, 'aaaa-mm-gg', dalla nota
// del calcolo («..., dal 16/09/2026 al 31/12/2026, ...»); vuoto se non c'e'.
const inizioRiga = (r) => {
  const m = /\bdal (\d{2})\/(\d{2})\/(\d{4})/.exec(String((r && r.note) || ''));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

/**
 * Le righe dei surplus, per nome e, a parita' di nome, per data di inizio (un
 * importo che cambia a meta' mese: prima il 5 €/t fino al 15/09, poi il 7): il
 * documento salvato le rilegge in un ordine qualunque.
 */
export const soloSurplus = (righe) => (righe || []).filter(eRigaSurplus)
  .sort((a, b) => String(a.descrizione || '').localeCompare(String(b.descrizione || ''), 'it') || inizioRiga(a).localeCompare(inizioRiga(b)));

/**
 * Le righe con quelle dei surplus in fondo, sotto i formulari, come le scrive il
 * calcolo e come stanno in fattura. Il documento salvato si rilegge ordinato per
 * fatturante, che e' lo stesso per tutte: senza, la riga del surplus poteva
 * finire a meta' dei formulari.
 */
export const surplusInFondo = (righe) => [...soloFormulari(righe), ...soloSurplus(righe)];

const centesimi = (v) => Math.round((Number(v) || 0) * 100);

/**
 * I conti di un elenco di righe dell'attiva, come li dice la fattura: lo
 * standard (i formulari), il surplus e il totale, in euro sommati in centesimi.
 * - formulari: quante righe non di surplus (gli ordini e i sovracosti a corpo);
 * - kg: i chili dei formulari; la riga del surplus ne ha zero apposta, e le sue
 *   tonnellate sono le stesse;
 * - voci_surplus: le righe del surplus, per nome.
 * escluseSospese (vero se non detto): una prestazione sospesa non si fattura,
 * come nei report.
 */
export function contiAttiva(righe, { escluseSospese = true } = {}) {
  const valide = (righe || []).filter(r => r && !(escluseSospese && r.sospesa));
  const formulari = soloFormulari(valide);
  const voci_surplus = soloSurplus(valide);
  const standard = formulari.reduce((s, r) => s + centesimi(r.totale), 0);
  const surplus = voci_surplus.reduce((s, r) => s + centesimi(r.totale), 0);
  return {
    formulari: formulari.length,
    kg: formulari.reduce((s, r) => s + (Number(r.quantita) || 0), 0),
    standard: standard / 100,
    surplus: surplus / 100,
    totale: (standard + surplus) / 100,
    voci_surplus,
  };
}

/** Le tonnellate di un peso in chili, all'italiana: due decimali, tre se i chili non sono tondi; «—» se manca. */
export function tonnellateDaKg(kg) {
  if (kg === null || kg === undefined || kg === '' || !Number.isFinite(Number(kg))) return '—';
  return cifreItaliane(Number(kg) / 1000, 2, 3);
}

/** «1.120,24 t × 5,00 €/t»: su che cosa si paga la riga del surplus, e quanto a tonnellata. */
export const baseSurplus = (kg, euroT) => `${tonnellateDaKg(kg)} t × ${testoEuroT(euroT) || '—'}`;

/**
 * La formula della riga di un surplus, per la scheda della riga: «1.120,24 t del
 * mese × 5,00 €/t = € 5.601,20, arrotondato una volta sul mese». Con la formula
 * dei formulari («kg ÷ 1.000 × prezzo») diceva «0 kg ÷ 1.000 × 5,00 = 5.601,20»,
 * perche' i chili della riga sono zero apposta.
 */
export const formulaSurplus = (riga) => `${tonnellateDaKg(riga && riga.kg_riferimento)} t del mese × ${testoEuroT(riga && riga.tariffa_valore) || '—'} = ${euro(riga && riga.totale)}, arrotondato una volta sul mese`;

/**
 * Da dove viene e quando vale un surplus del riepilogo (getRiepilogoEcotyre,
 * { origine, dal, al }): «consorzio Ecotyre · dal 01/10/2026 al 31/12/2026».
 */
export const dettaglioSurplus = (s) => [
  s && s.origine,
  periodoSurplus({ data_inizio_validita: s && s.dal, data_fine_validita: s && s.al }),
].filter(Boolean).join(' · ');

/**
 * Da dove viene e quando vale la riga di un surplus salvata nel documento, che
 * lo porta scritto solo nella nota del calcolo («Fuel Surcharge (consorzio
 * Ecotyre), dal 01/10/2026 al 31/12/2026, sulle stesse 1.120,24 t del mese»),
 * in pezzi: { origine: 'consorzio Ecotyre', periodo: 'dal 01/10/2026 al
 * 31/12/2026', altro: [] }. Il nome e le tonnellate la pagina li scrive gia'
 * accanto; un pezzo che non e' ne' l'origine ne' il periodo resta in altro,
 * com'e' scritto.
 */
export function partiRigaSurplus(riga) {
  const nome = String((riga && riga.descrizione) || '').trim();
  let nota = String((riga && riga.note) || '').trim();
  if (nome && nota.startsWith(nome)) nota = nota.slice(nome.length).trim();
  const tra = /^\(([^)]*)\)(.*)$/.exec(nota);
  const pezzi = (tra ? tra[2] : nota).replace(/^[,\s]+/, '').split(/,\s+/).filter(p => p && !/^sulle stesse\b/.test(p));
  const periodo = pezzi.find(p => /^(dal|fino al) \d{2}\/\d{2}\/\d{4}/.test(p)) || '';
  return { origine: tra ? tra[1].trim() : '', periodo, altro: pezzi.filter(p => p !== periodo) };
}

/** «consorzio Ecotyre · dal 01/10/2026 al 31/12/2026»: origine e periodo della riga di un surplus, dalla nota del calcolo. */
export function dettaglioRigaSurplus(riga) {
  const { origine, periodo, altro } = partiRigaSurplus(riga);
  return [origine, periodo, ...altro].filter(Boolean).join(' · ');
}

const nomeVoce = (r) => String((r && r.descrizione) || '').trim() || 'Surplus';

// LA RIGA DEL SURPLUS NEI TRE REPORT DELL'AMMINISTRAZIONE (decisione
// dell'utente del 13/10/2026 sera: il Fuel Surcharge «deve essere una voce
// disgiunta con un proprio rigo (per canale)»). Il report dell'attiva e il
// format dell'amministrazione, in Excel e in PDF, hanno le colonne dei modelli
// SMOCO, e la riga del surplus le riempie coi suoi pezzi: il nome dove le
// righe dicono il tipo, l'origine dove dicono l'ordine, la validita' dove
// dicono la data, «+5,00 €/t sulle 1.120,24 t del mese» dove dicono il
// formulario. Pezzi corti perche' il PDF tiene tre righe per cella: la frase
// intera, in una cella sola, sulle colonne strette dell'ACI sarebbe tagliata.
// La Quantita' resta vuota: le tonnellate sono quelle dei formulari qui sopra,
// e scritte anche li' le sommerebbe chi fa la somma della colonna.

/**
 * I pezzi della riga di un surplus per i report: { nome: 'Fuel Surcharge',
 * origine: 'consorzio Ecotyre', validita: 'dal 01/10/2026 al 31/12/2026',
 * base: '+5,00 €/t sulle 1.120,24 t del mese', euro_t: 5, kg: 1120240,
 * ordini: 380, totale: 5601.2 }. Le tonnellate sono quelle della riga
 * (kg_riferimento): con un surplus «solo questi fornitori» o che comincia a
 * meta' mese non sono tutte quelle del canale. Un pezzo che manca resta vuoto;
 * un importo a tonnellata che manca e' «—», non zero.
 */
export function pezziSurplusReport(riga) {
  const { origine, periodo } = partiRigaSurplus(riga);
  const euroT = riga && riga.tariffa_valore;
  const prezzo = testoEuroT(euroT);
  const kg = riga && riga.kg_riferimento;
  return {
    nome: nomeVoce(riga),
    origine,
    validita: periodo,
    base: `${prezzo ? `+${prezzo}` : '—'} sulle ${tonnellateDaKg(kg)} t del mese`,
    euro_t: euroT === null || euroT === undefined || euroT === '' || !Number.isFinite(Number(euroT)) ? null : Number(euroT),
    kg: Number(kg) || 0,
    ordini: riga && Number.isFinite(Number(riga.record_count)) ? Number(riga.record_count) : null,
    totale: centesimi(riga && riga.totale) / 100,
  };
}

/** Quante righe fa un testo che va a capo fra le parole in una cella larga «larga» caratteri. */
function righeACapo(testo, larga) {
  let righe = 1, lunga = 0;
  for (const parola of String(testo).split(/\s+/).filter(Boolean)) {
    const serve = lunga ? lunga + 1 + parola.length : parola.length;
    if (lunga && serve > larga) { righe += 1; lunga = parola.length; } else lunga = serve;
    if (lunga > larga) { righe += Math.ceil(lunga / larga) - 1; lunga %= larga; }
  }
  return righe;
}

/**
 * I colori della riga del surplus nei fogli Excel (ARGB): quelli dei fogli
 * della passiva e dell'elenco dell'extra raccolta, il token --eco-surplus
 * delle pagine (indaco: l'ambra e il rosso vogliono dire «c'e' un problema»,
 * e il surplus non lo e').
 */
export const COLORI_SURPLUS_FOGLI = { barra: 'FF6366F1', fondo: 'FFEEF2FF', testo: 'FF3730A3' };

/**
 * Veste una riga di un foglio Excel (exceljs) come riga del surplus: fondo
 * indaco chiaro, testo indaco scuro in corsivo, barra a sinistra, come nei
 * fogli della passiva. I testi vanno a capo nella loro cella, e la riga si
 * alza quanto serve (una stima dalla larghezza delle colonne): le colonne dei
 * modelli dell'amministrazione non si allargano.
 */
export function vestiRigaSurplusFoglio(riga, quante) {
  let linee = 1;
  for (let c = 1; c <= quante; c++) {
    const cella = riga.getCell(c);
    cella.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORI_SURPLUS_FOGLI.fondo } };
    cella.font = { ...(cella.font || {}), italic: true, color: { argb: COLORI_SURPLUS_FOGLI.testo } };
    if (typeof cella.value === 'string' && cella.value) {
      cella.alignment = { ...(cella.alignment || {}), wrapText: true, vertical: 'top' };
      const larga = Math.max(4, Math.floor(Number(riga.worksheet && riga.worksheet.getColumn(c).width) || 10));
      linee = Math.max(linee, righeACapo(cella.value, larga));
    }
  }
  const prima = riga.getCell(1);
  prima.border = { ...(prima.border || {}), left: { style: 'thick', color: { argb: COLORI_SURPLUS_FOGLI.barra } } };
  if (linee > 1) riga.height = Math.min(4, linee) * 13 + 2;
  return riga;
}

/**
 * QUANTE RIGHE DI FORMULARI E QUALI DI SURPLUS, A PAROLE: «380 righe e la riga
 * del Fuel Surcharge». Un surplus che cambia importo a meta' mese sono due
 * record con lo stesso nome, e il documento ha due righe (revisione del
 * 13/10/2026): «380 righe e 2 righe del Fuel Surcharge». Prima diceva «la riga»
 * anche li', e il file ne aveva 382.
 */
export function righeAParole(righe) {
  const { formulari, voci_surplus } = contiAttiva(righe, { escluseSospese: false });
  const quante = new Map();
  for (const r of voci_surplus) quante.set(nomeVoce(r), (quante.get(nomeVoce(r)) || 0) + 1);
  const frasi = [...quante].map(([nome, n]) => (n === 1 ? `la riga del ${nome}` : `${n} righe del ${nome}`));
  const prima = `${formulari} ${formulari === 1 ? 'riga' : 'righe'}`;
  if (!frasi.length) return prima;
  return `${[prima, ...frasi.slice(0, -1)].join(', ')} e ${frasi[frasi.length - 1]}`;
}

/**
 * IL NOME DI OGNI RIGA DI SURPLUS, PER DISTINGUERLE (revisione del 13/10/2026).
 * Due righe con lo stesso nome (il Fuel Surcharge a 5 €/t fino al 15/09 e a 7
 * dal 16/09) comparivano come due «Fuel Surcharge» uguali. Il nome resta solo
 * quando e' unico; altrimenti ci si aggiunge l'importo («Fuel Surcharge a 5,00
 * €/t») e, se anche quello e' uguale, il periodo. Un elemento per riga, nello
 * stesso ordine.
 */
function distingui(elenco, { nome, prezzo, periodo }) {
  return (elenco || []).map((r, _i, tutti) => {
    const stessi = tutti.filter(x => nome(x) === nome(r));
    if (stessi.length < 2) return nome(r);
    const p = prezzo(r);
    const prezzoUnico = !!p && stessi.filter(x => prezzo(x) === p).length === 1;
    const conPrezzo = `${nome(r)}${p ? ` a ${p}` : ''}`;
    return prezzoUnico ? conPrezzo : [conPrezzo, periodo(r)].filter(Boolean).join(', ');
  });
}
export const nomiVociSurplus = (voci) => distingui(voci, {
  nome: nomeVoce, prezzo: (r) => testoEuroT(r.tariffa_valore), periodo: (r) => partiRigaSurplus(r).periodo,
});

/**
 * Lo stesso per i surplus del margine (calcolaMargineAnno: { nome, euro_t_attiva,
 * euro_t_passiva, dal, al }): l'importo e' quello che si incassa, o quello che si
 * paga se il surplus e' solo passivo.
 */
export const nomiSurplusDistinti = (voci) => distingui(voci, {
  nome: (v) => String((v && v.nome) || '').trim() || 'Surplus',
  prezzo: (v) => testoEuroT(v.euro_t_attiva ?? v.euro_t_passiva ?? v.euro_t),
  periodo: (v) => periodoSurplus({ data_inizio_validita: v.dal, data_fine_validita: v.al }),
});

/**
 * I surplus sommati per nome, per i «di cui» sotto un totale: [{ nome, totale }]
 * in euro, sommati in centesimi. Due righe dello stesso surplus fanno un «di
 * cui» solo (revisione del 13/10/2026: erano due «di cui Fuel Surcharge»).
 */
export function surplusPerNome(voci) {
  const m = new Map();
  for (const r of voci || []) m.set(nomeVoce(r), (m.get(nomeVoce(r)) || 0) + centesimi(r.totale));
  return [...m].map(([nome, cent]) => ({ nome, totale: cent / 100 }));
}

/** Le origini dei surplus di un elenco di righe, una volta sola: ['consorzio Ecotyre']. */
export const originiSurplus = (righe) => [...new Set(soloSurplus(righe).map(r => partiRigaSurplus(r).origine).filter(Boolean))];

/**
 * La forma della riga del surplus, la stessa in ogni pagina (la passiva, le
 * tariffe, l'attiva e il margine) e nei fogli della passiva: il colore e' il
 * token --eco-surplus di src/index.css, un indaco chiaro e scuro (quello della
 * barra dei fogli Excel e PDF, 6366F1). Indaco e non ambra o rosso, che qui
 * vogliono dire «c'e' un problema»: il surplus non lo e'. Le classi sono quelle
 * di EtichettaSurplus e RIGA_SURPLUS della passiva (PassivaSurplus.jsx): la
 * barretta, l'etichetta «Surplus» per chi non distingue il colore, il nome in
 * corsivo, il fondo appena tinto; le tonnellate fra parentesi, perche' sono le
 * stesse del mese e non si sommano.
 */
export const STILE_SURPLUS = {
  /** il fondo della riga */
  fondo: 'bg-[hsl(var(--eco-surplus)/0.06)]',
  /** la barretta prima dell'etichetta */
  barra: 'h-4 w-1 shrink-0 rounded-full bg-[hsl(var(--eco-surplus))]',
  /** l'etichetta «Surplus» */
  etichetta: 'shrink-0 rounded bg-[hsl(var(--eco-surplus)/0.14)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--eco-surplus))]',
  /** il nome del surplus */
  nome: 'italic font-medium text-foreground',
  /** un «di cui» sotto un totale */
  diCui: 'text-[hsl(var(--eco-surplus))]',
  /** il bordo sinistro di un riquadro o di una frase */
  barretta: 'border-l-4 border-l-[hsl(var(--eco-surplus))]',
  /** il riquadro del surplus (la prefattura) */
  riquadro: 'border border-[hsl(var(--eco-surplus)/0.3)] bg-[hsl(var(--eco-surplus)/0.04)]',
  /** le tonnellate o i chili fra parentesi */
  parentesi: 'italic text-muted-foreground tabular-nums',
};

// IL SURPLUS NEL CONFRONTO CON LA PREFATTURA (confrontaPrefattura di
// base44/shared/prefattura.ts, canali[].surplus). Le parole dell'esito e della
// forma in cui la prefattura lo porta, e il tono del cartellino: verde quando
// torna, rosso quando no, ambra quando va chiarito, celeste per un'ipotesi.
export const ESITI_SURPLUS = {
  torna: { testo: 'torna', tono: 'ok' },
  arrotondamento: { testo: 'torna, arrotondamento', tono: 'ok' },
  non_torna: { testo: 'non torna', tono: 'errore' },
  assente: { testo: 'non in prefattura', tono: 'attenzione' },
  solo_prefattura: { testo: 'solo in prefattura', tono: 'attenzione' },
  senza_importo: { testo: 'senza importo', tono: 'attenzione' },
  fuori_prefattura: { testo: 'fuori dalla prefattura', tono: 'neutro' },
  ipotesi: { testo: 'da verificare', tono: 'osservazione' },
};
export const FORME_SURPLUS = {
  nel_prezzo: 'nel prezzo degli ordini',
  riga_per_ordine: 'una riga per ordine',
  riga_sola: 'una riga sola',
  insieme: 'una riga per più canali',
};

/**
 * Gli ordini su cui il surplus della prefattura non torna (forme a e b), in un
 * elenco solo: [{ id_ordine, kg, atteso, trovato, cosa }]. atteso e trovato in
 * euro; trovato null quando l'importo nella prefattura manca (non e' zero).
 */
export function ordiniSurplusDaChiarire(ordini) {
  const o = ordini || {};
  return [
    ...(o.senza || []).map(x => ({ id_ordine: x.id_ordine, kg: x.kg ?? null, atteso: x.atteso ?? null, trovato: 0, cosa: 'manca nella prefattura' })),
    ...(o.diversi || []).map(x => ({ id_ordine: x.id_ordine, kg: x.kg ?? null, atteso: x.atteso ?? null, trovato: x.importo ?? null, cosa: x.righe > 1 ? `diverso (${x.righe} righe)` : 'diverso' })),
    ...(o.in_piu || []).map(x => ({ id_ordine: x.id_ordine, kg: x.kg ?? null, atteso: 0, trovato: x.importo ?? null, cosa: 'il gestionale non lo prevede' })),
    ...(o.senza_importo || []).map(x => ({ id_ordine: x.id_ordine, kg: x.kg ?? null, atteso: x.atteso ?? null, trovato: null, cosa: 'senza importo' })),
  ];
}
