// IL CONSUNTIVO DI CHIUSURA MESE DI UN FORNITORE, CONFRONTATO CON I NOSTRI DATI.
//
// Richiesta dell'utente (29/09/2026): si caricano i report definitivi a consuntivo
// con cui i fornitori chiudono il mese, se ne verifica l'esattezza - sulla raccolta
// se e' un raccoglitore, sui conferimenti ricevuti se e' un impianto o uno
// stoccaggio, sui trasporti effettuati se e' un trasportatore di secondarie - si
// stima il costo che sara' loro dovuto e lo si confronta con la fatturazione
// passiva, dichiarando la quadratura o le difformita'.
//
// E' UN REPORT LORO, NON UNA FATTURA (decisione dell'utente, 29/09/2026): si
// confrontano righe, formulari e chili, e accanto ci si mette l'importo previsto
// dalle tariffe. Non c'e' IVA, non c'e' imponibile, e non si pretende che il totale
// coincida con quello di una fattura: dal conto della passiva restano fuori per
// costruzione le terziarie, gli oneri fissi dell'extra raccolta e il trasporto
// delle secondarie di extra raccolta.
//
// TRE RUOLI, TRE BASI DIVERSE. Lo stesso soggetto puo' averne piu' di uno - chi
// raccoglie e ha anche il piazzale - e in quel caso i suoi consuntivi sono due,
// perche' due sono le prestazioni che ci fattura:
//   raccoglitore  -> le primarie che ha RACCOLTO (trasportatore del formulario);
//   impianto      -> tutto cio' che gli e' ARRIVATO, primarie e secondarie;
//   trasportatore -> le secondarie che ha PORTATO da un piazzale a un impianto.
//
// UN CANALE PER VOLTA (regola 3) e la FINE TRASPORTO come periodo (regola 1): un
// carico e' del mese in cui il camion ha finito, non di quello in cui il portale ha
// chiuso l'ordine giorni dopo.
import { eTerminato, giornoMovimento, canaleMovimento } from "./movimenti.ts";
import { contaFormulari, chiaveFormulario } from "./formulari.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { comeOrdine, comeNumero, comeGiorno } from "./prefattura.ts";
import { mappaFatturazione, fatturaA } from "./subfornitori.ts";

const kgTondi = (v) => Math.round(Number(v) || 0);
const pulisci = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const centesimi = (v) => Math.round((Number(v) || 0) * 100);

/** I ruoli con cui un fornitore ci fattura, e che cosa si guarda per ciascuno. */
export const RUOLI_CONSUNTIVO = [
  { chiave: 'raccoglitore', nome: 'Raccoglitore', base: 'le primarie che ha raccolto' },
  { chiave: 'impianto', nome: 'Impianto o stoccaggio', base: 'tutto quello che gli e\' arrivato, primarie e secondarie' },
  { chiave: 'trasportatore', nome: 'Trasportatore di secondarie', base: 'le secondarie che ha portato' },
];

/**
 * Il numero di formulario, confrontabile: "RG YTR-0226" e "RGYTR0226" sono lo
 * stesso. Una parola senza cifre non e' un formulario: "TOTALE" in fondo a una
 * colonna diventava una riga del consuntivo con quel nome, invece di essere
 * riconosciuta come la riga dei totali e contata fra quelle non abbinabili.
 */
export const chiaveFir = (v) => {
  const t = pulisci(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /[0-9]/.test(t) ? t : '';
};

/**
 * LE CHIAVI con cui una riga si puo' riconoscere: il formulario E l'ordine, non
 * uno solo.
 *
 * La prima stesura sceglieva il formulario e, in mancanza, l'ordine. Ma i nostri
 * movimenti il formulario ce l'hanno sempre, mentre il consuntivo di un fornitore
 * a volte porta solo il numero d'ordine: le due chiavi non si incontravano mai e
 * usciva il 100% di difformita', con gli stessi chili accusati due volte in versi
 * opposti. Tenendole tutte e due, si abbinano le righe che parlano dello stesso
 * carico comunque siano scritte.
 */
export function chiaviRiga(r) {
  const out = [];
  const fir = chiaveFir(r && (r.numero_fir || r.fir));
  if (fir) out.push(`FIR:${fir}`);
  const ord = comeOrdine((r && (r.id_ordine || r.ordine)) || '');
  if (ord) out.push(`ORD:${ord}`);
  return out;
}

/** La chiave principale di una riga, per darle un nome a video. */
export const chiaveRiga = (r) => chiaviRiga(r)[0] || '';

// Le intestazioni con cui si riconoscono le colonne di un consuntivo. Non si
// pretende nessuna colonna: un report di un raccoglitore puo' avere solo il
// formulario e i chili, ed e' il caso normale.
const INTESTAZIONI_CONSUNTIVO = [
  ['numero_fir', /\bfir\b|formulario|f\.?i\.?r\.?|documento/i],
  ['id_ordine', /ordine|ticket|\bordn?\b/i],
  ['kg', /peso|\bkg\b|quantit|q\.?t[aà]|tonnell/i],
  ['giorno', /data|giorno/i],
  ['importo', /importo|imponibile|totale|corrispettivo|valore|euro|€/i],
];

// Un formulario: lettere e cifre, almeno otto, con almeno una cifra. Serve a
// riconoscere la colonna quando le intestazioni non aiutano.
const PARE_FIR = (v) => { const t = chiaveFir(v); return t.length >= 8 && /[0-9]/.test(t) && /[A-Z]/.test(t); };

/**
 * LE RIGHE DI UN CONSUNTIVO, lette da un foglio.
 *
 * Il consuntivo di un fornitore NON e' la prefattura del portale: puo' non avere
 * nessun numero d'ordine, e pretenderlo - come faceva la prima stesura, che riusava
 * il lettore della prefattura - voleva dire non riuscire a caricare il documento
 * tipico, quello con formulario e chili.
 *
 * Le colonne si riconoscono dall'intestazione e, quando l'intestazione non basta,
 * dalla forma dei valori. Quello che NON si e' riusciti a leggere si dice: una riga
 * saltata in silenzio sono chili che spariscono.
 */
export function leggiRigheConsuntivo(tabelle) {
  const righe = [];
  const note = [];
  const colonneLette = [];
  let scartate = 0;

  for (const { nome, celle } of tabelle || []) {
    const t = celle || [];
    let iTesta = -1;
    let col = {};
    for (let i = 0; i < Math.min(40, t.length); i++) {
      const trovate = {};
      (t[i] || []).forEach((c, j) => {
        const testo = pulisci(c);
        if (!testo || comeNumero(testo) !== null) return;
        for (const [chiave, re] of INTESTAZIONI_CONSUNTIVO) {
          if (trovate[chiave] === undefined && re.test(testo)) { trovate[chiave] = { j, testo }; break; }
        }
      });
      // Basta il formulario, o l'ordine, piu' qualcosa che somigli a un peso.
      if ((trovate.numero_fir || trovate.id_ordine) && trovate.kg) { iTesta = i; col = trovate; break; }
    }

    const corpo = iTesta >= 0 ? t.slice(iTesta + 1) : t;
    // Se le intestazioni non bastano, si guarda la forma dei valori: la colonna coi
    // piu' valori che paiono formulari, e quella coi piu' numeri che paiono chili.
    if (!col.numero_fir && !col.id_ordine) {
      const contaFir = new Map(), contaOrd = new Map();
      for (const r of corpo) (r || []).forEach((c, j) => {
        if (PARE_FIR(c)) contaFir.set(j, (contaFir.get(j) || 0) + 1);
        if (comeOrdine(c)) contaOrd.set(j, (contaOrd.get(j) || 0) + 1);
      });
      const meglio = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0];
      const f = meglio(contaFir), o = meglio(contaOrd);
      if (f) col.numero_fir = { j: f[0], testo: '(riconosciuta dai valori)' };
      if (o && (!f || o[0] !== f[0])) col.id_ordine = { j: o[0], testo: '(riconosciuta dai valori)' };
      if (!col.kg) {
        const contaNum = new Map();
        for (const r of corpo) (r || []).forEach((c, j) => {
          if (j === (col.numero_fir && col.numero_fir.j) || j === (col.id_ordine && col.id_ordine.j)) return;
          const n = comeNumero(c);
          if (n !== null && n > 0) contaNum.set(j, (contaNum.get(j) || 0) + 1);
        });
        const k = meglio(contaNum);
        if (k) col.kg = { j: k[0], testo: '(riconosciuta dai valori)' };
      }
    }

    if (!col.numero_fir && !col.id_ordine) {
      note.push(`Foglio "${nome}": non ho trovato nessuna colonna con i formulari o i numeri d'ordine, saltato.`);
      continue;
    }
    colonneLette.push({
      foglio: nome,
      colonne: Object.fromEntries(Object.entries(col).map(([k, v]) => [k, v.testo])),
    });

    const prendi = (r, c) => (c && c.j >= 0 ? r[c.j] : null);
    for (const r of corpo) {
      const riga = r || [];
      const fir = pulisci(prendi(riga, col.numero_fir));
      const ord = pulisci(prendi(riga, col.id_ordine));
      if (!chiaveFir(fir) && !comeOrdine(ord)) { if (riga.some(c => pulisci(c))) scartate++; continue; }
      const kgLetti = comeNumero(prendi(riga, col.kg));
      // Un peso in tonnellate si riconosce dall'ordine di grandezza: un carico di
      // PFU pesa migliaia di chili, non tre.
      const kg = kgLetti === null ? 0 : (kgLetti > 0 && kgLetti < 200 ? kgLetti * 1000 : kgLetti);
      righe.push({
        numero_fir: fir,
        id_ordine: ord,
        kg: Math.round(kg),
        importo: col.importo ? comeNumero(prendi(riga, col.importo)) : null,
        giorno: col.giorno ? comeGiorno(prendi(riga, col.giorno)) : '',
      });
    }
  }

  if (scartate) note.push(`${scartate} righe non avevano ne' un formulario ne' un numero d'ordine: non si possono abbinare e non sono state lette.`);
  return { righe, note, colonne: colonneLette, scartate };
}

/** Lo stesso soggetto, scritto come viene. */
const stesso = (a, b) => {
  const x = normalizzaRagioneSociale(a || '');
  const y = normalizzaRagioneSociale(b || '');
  return !!x && !!y && x === y;
};

/**
 * I NOSTRI MOVIMENTI che riguardano quel fornitore, in quel ruolo, in quel mese e
 * in quel canale. E' la base su cui il suo consuntivo va verificato.
 *
 * @param archivi { primarieRete, primarieAci, secondarie, extraRaccolta }
 */
export function movimentiDelFornitore(archivi, { fornitore, ruolo, anno, mese, canale, fornitori = [] }) {
  const annoNum = Number(anno);
  const meseNum = Number(mese);
  // CHI FATTURA, NON CHI HA MATERIALMENTE LAVORATO. La fatturazione passiva
  // accorpa le tonnellate di un subfornitore al principale (mappaFatturazione):
  // Torres Giovanni raccoglie col proprio nome e fattura tramite Green Tyre. Senza
  // passare di qui, al principale si metteva accanto ai suoi soli chili l'importo
  // di tutto il gruppo, e al subfornitore non si trovava nessun costo e il suo
  // consuntivo usciva dichiarato a posto. I due moduli devono parlare dello stesso
  // soggetto, o i numeri non sono confrontabili.
  const mappa = mappaFatturazione(fornitori);
  const chiFattura = (nome) => fatturaA(mappa, nome).chiave;
  const cercato = chiFattura(fornitore) || normalizzaRagioneSociale(fornitore || '');
  const suo = (nome) => {
    const k = chiFattura(nome) || normalizzaRagioneSociale(nome || '');
    return !!k && !!cercato && k === cercato;
  };
  const delPeriodo = (r, archivio) => {
    if (!eTerminato(r)) return false;
    if (canaleMovimento(r, archivio) !== canale) return false;
    const g = giornoMovimento(r);
    return !!g && Number(g.slice(0, 4)) === annoNum && Number(g.slice(5, 7)) === meseNum;
  };
  const out = [];
  const prendi = (righe, archivio, riguarda) => {
    for (const r of righe || []) {
      if (!delPeriodo(r, archivio)) continue;
      if (!riguarda(r)) continue;
      out.push({ ...r, __archivio: archivio });
    }
  };

  const primarie = [
    [archivi.primarieRete || [], 'PrimariaRete'],
    [archivi.primarieAci || [], 'PrimariaAci'],
  ];
  const extra = archivi.extraRaccolta || [];

  if (ruolo === 'raccoglitore') {
    // Chi ha raccolto: il trasportatore del formulario di primaria.
    for (const [righe, arch] of primarie) prendi(righe, arch, r => suo(r.trasportatore));
    // NELL'EXTRA RACCOLTA ANCHE LE SECONDARIE sono pagate come RACCOLTA a chi le
    // trasporta (passivaCalcolo: raccoglitoriSource = tutti gli interventi).
    // Escluderle qui, come faceva la prima stesura, metteva accanto a sei
    // tonnellate l'importo di quindici, con una spiegazione inventata.
    prendi(extra, 'ExtraRaccolta', r => suo(r.trasportatore));
  } else if (ruolo === 'impianto') {
    // Tutto quello che gli e' arrivato: primarie scaricate da lui e secondarie in
    // ingresso. E' la stessa base su cui la passiva paga stoccaggio e trattamento.
    for (const [righe, arch] of primarie) prendi(righe, arch, r => suo(r.destinazione));
    prendi(archivi.secondarie || [], 'Secondaria', r => suo(r.destinazione));
    prendi(extra, 'ExtraRaccolta', r => suo(r.destinazione));
  } else if (ruolo === 'trasportatore') {
    // Le secondarie che ha portato: partono da un piazzale e arrivano a un impianto.
    // Quelle di extra raccolta non stanno qui: la passiva le paga come raccolta, non
    // come trasporto, e infatti il suo blocco dei trasporti per l'extra e' vuoto.
    prendi(archivi.secondarie || [], 'Secondaria', r => suo(r.trasportatore));
  }
  return out;
}

/**
 * IL CONFRONTO RIGA PER RIGA fra il consuntivo del fornitore e i nostri movimenti.
 *
 * Le quote dello stesso formulario si sommano prima del confronto, da una parte e
 * dall'altra: un formulario ripartito su due ordini e' un documento solo, e in
 * fattura conta la somma dei pesi (vedi formulari.ts).
 *
 * Tre esiti possibili per ogni formulario:
 *   - sta in tutti e due: si confrontano i chili;
 *   - solo nel consuntivo: ce lo fattura e noi non l'abbiamo. E' il caso piu'
 *     grave, perche' e' materiale che pagheremmo senza averlo registrato;
 *   - solo da noi: l'abbiamo e lui non l'ha messo. Di solito e' un ritardo suo,
 *     ma va detto, perche' se poi lo fattura a parte si paga due volte.
 *
 * Una tolleranza sui chili si passa da fuori: qui non si decide quanto e' "uguale".
 */
export function confrontaConsuntivo(righeConsuntivo, movimenti, { tolleranza_kg = 0 } = {}) {
  // Ogni gruppo tiene TUTTE le sue chiavi - formulario e ordine - cosi' una riga
  // del consuntivo che porta solo l'ordine trova lo stesso il nostro movimento, che
  // il formulario ce l'ha sempre.
  const raggruppa = (righe, peso, chiaviDi) => {
    const gruppi = [];
    const indice = new Map(); // chiave -> gruppo
    let senza = null;
    for (const r of righe || []) {
      const chiavi = chiaviDi(r);
      if (!chiavi.length) {
        if (!senza) senza = { chiavi: [], righe: [], kg: 0, senza_chiave: true };
        senza.righe.push(r);
        senza.kg += Number(peso(r)) || 0;
        continue;
      }
      let g = null;
      for (const k of chiavi) if (indice.has(k)) { g = indice.get(k); break; }
      if (!g) { g = { chiavi: [], righe: [], kg: 0 }; gruppi.push(g); }
      for (const k of chiavi) if (!g.chiavi.includes(k)) { g.chiavi.push(k); indice.set(k, g); }
      g.righe.push(r);
      g.kg += Number(peso(r)) || 0;
    }
    for (const g of gruppi) g.kg = kgTondi(g.kg);
    if (senza) senza.kg = kgTondi(senza.kg);
    return { gruppi, indice, senza };
  };

  const loro = raggruppa(righeConsuntivo, r => r.kg, chiaviRiga);
  const nostri = raggruppa(movimenti, r => r.peso_effettivo,
    r => chiaviRiga({ numero_fir: chiaveFormulario(r), id_ordine: r.id_ordine }));
  const senzaChiave = loro.senza;

  // L'UNITA' DEL CONFRONTO E' IL CARICO COME LO CONOSCIAMO NOI. Un formulario
  // ripartito su due ordini e' un carico solo: se il fornitore lo scrive su due
  // righe, una per ordine, quelle due righe vanno FUSE prima di confrontarle, o il
  // confronto direbbe due volte "peso diverso" su un documento che invece torna.
  const nome = (g) => (g.chiavi[0] || '');
  const loroPerNostro = new Map();
  const loroAbbinati = new Set();
  for (const l of loro.gruppi) {
    for (const k of l.chiavi) {
      const n = nostri.indice.get(k);
      if (!n) continue;
      if (!loroPerNostro.has(n)) loroPerNostro.set(n, []);
      if (!loroPerNostro.get(n).includes(l)) loroPerNostro.get(n).push(l);
      loroAbbinati.add(l);
      break;
    }
  }

  const voci = [];
  for (const n of nostri.gruppi) {
    const suoi = loroPerNostro.get(n) || [];
    if (!suoi.length) {
      voci.push({
        chiave: nome(n), esito: 'solo_gestionale', kg_consuntivo: null, kg_gestionale: n.kg, scarto_kg: null,
        righe_gestionale: n.righe.length, id_ordine: pulisci(n.righe[0] && n.righe[0].id_ordine),
      });
      continue;
    }
    const kgLoro = kgTondi(suoi.reduce((s, l) => s + l.kg, 0));
    const scarto = kgLoro - n.kg;
    voci.push({
      chiave: nome(n),
      esito: Math.abs(scarto) <= tolleranza_kg ? 'uguale' : 'peso_diverso',
      kg_consuntivo: kgLoro, kg_gestionale: n.kg, scarto_kg: scarto,
      righe_consuntivo: suoi.reduce((s, l) => s + l.righe.length, 0), righe_gestionale: n.righe.length,
      id_ordine: pulisci(n.righe[0] && n.righe[0].id_ordine),
    });
  }
  for (const l of loro.gruppi) {
    if (loroAbbinati.has(l)) continue;
    voci.push({ chiave: nome(l), esito: 'solo_consuntivo', kg_consuntivo: l.kg, kg_gestionale: null, scarto_kg: null, righe_consuntivo: l.righe.length });
  }

  const conta = (e) => voci.filter(v => v.esito === e).length;
  const kgDi = (e, campo) => voci.filter(v => v.esito === e).reduce((s, v) => s + (v[campo] || 0), 0);
  const totaleLoro = loro.gruppi.reduce((s, e) => s + e.kg, 0) + (senzaChiave ? senzaChiave.kg : 0);
  const totaleNostro = nostri.gruppi.reduce((s, e) => s + e.kg, 0);

  return {
    voci: voci.sort((a, b) => (Math.abs(b.scarto_kg || 0) - Math.abs(a.scarto_kg || 0)) || String(a.chiave).localeCompare(String(b.chiave))),
    uguali: conta('uguale'),
    peso_diverso: conta('peso_diverso'),
    solo_consuntivo: conta('solo_consuntivo'),
    solo_gestionale: conta('solo_gestionale'),
    kg_solo_consuntivo: kgDi('solo_consuntivo', 'kg_consuntivo'),
    kg_solo_gestionale: kgDi('solo_gestionale', 'kg_gestionale'),
    // Le righe del consuntivo senza formulario e senza ordine: non si possono
    // abbinare a niente, e tacerle le farebbe sparire dal conto.
    senza_chiave: senzaChiave ? senzaChiave.righe.length : 0,
    senza_chiave_kg: senzaChiave ? senzaChiave.kg : 0,
    totale_consuntivo_kg: totaleLoro,
    totale_gestionale_kg: totaleNostro,
    scarto_totale_kg: totaleLoro - totaleNostro,
    formulari_gestionale: contaFormulari(movimenti),
    // Quadra quando ogni formulario torna e non ne avanza da nessuna delle due parti.
    quadra: conta('peso_diverso') === 0 && conta('solo_consuntivo') === 0 && conta('solo_gestionale') === 0 && !senzaChiave,
  };
}

/**
 * IL COSTO PREVISTO per quel fornitore, preso dalla fatturazione passiva del mese.
 *
 * Non si ricalcola qui: si legge quello che la passiva ha gia' calcolato, che e'
 * l'unico numero che il gestionale considera dovuto. Calcolarne un secondo, con le
 * stesse tariffe ma un'altra aritmetica, vorrebbe dire avere due prezzi per lo
 * stesso carico e non sapere quale portare in fattura.
 *
 * Restituisce anche da QUALE blocco viene, perche' un soggetto che raccoglie e ha
 * il piazzale compare in due blocchi con due importi diversi, e confonderli
 * sarebbe pagarlo due volte o una volta sola.
 */
export function costoAttesoDallaPassiva(passiva, fornitore, ruolo) {
  if (!passiva) return null;
  const blocco = ruolo === 'raccoglitore' ? 'raccoglitori'
    : ruolo === 'impianto' ? 'impianti_stoccaggi'
      : 'trasporti_secondaria';
  const righe = (passiva[blocco] || []).filter(f => stesso(f.fornitore, fornitore));
  if (!righe.length) {
    return {
      trovato: false, blocco,
      motivo: `Nella fatturazione passiva di questo mese, nel blocco ${blocco.replace(/_/g, ' ')}, non c'e' nessuna riga per questo fornitore: o non gli spetta niente in questo canale, o manca la tariffa.`,
    };
  }
  return {
    trovato: true,
    blocco,
    tonnellate: righe.reduce((s, f) => s + (Number(f.totale_tonnellate) || 0), 0),
    importo: Math.round(righe.reduce((s, f) => s + centesimi(f.totale_euro), 0)) / 100,
    interno: righe.every(f => f.interno === true),
    righe: righe.flatMap(f => f.righe || []),
  };
}

/**
 * IL VERDETTO: il consuntivo del fornitore contro i nostri movimenti e contro il
 * costo che la passiva gli riconosce.
 *
 * Il confronto sul costo si fa in CENTESIMI interi: sommando in virgola mobile,
 * luglio 2026 usciva 226.692,48 da una parte e 226.692,49 dall'altra con le righe
 * identiche (e' la lezione di prefattura.ts).
 */
export function esitoConsuntivo({ confronto, costo, importo_consuntivo = null, tolleranza_euro = 0.015 }) {
  const kgPassiva = costo && costo.trovato ? Math.round(costo.tonnellate * 1000) : null;
  const scartoPassiva = kgPassiva === null ? null : confronto.totale_gestionale_kg - kgPassiva;
  const scartoImporto = importo_consuntivo === null || !costo || !costo.trovato
    ? null
    : (centesimi(importo_consuntivo) - centesimi(costo.importo)) / 100;
  const quadraPassiva = scartoPassiva === null ? null : scartoPassiva === 0;
  const quadraImporto = scartoImporto === null ? null : Math.abs(scartoImporto) <= tolleranza_euro;
  return {
    quadra_quantita: confronto.quadra,
    // I chili che paghiamo devono essere quelli che abbiamo: se la passiva ne conta
    // altri, prima di guardare gli euro va capito perche'.
    quadra_con_passiva: quadraPassiva,
    scarto_passiva_kg: scartoPassiva,
    importo_previsto: costo && costo.trovato ? costo.importo : null,
    importo_consuntivo,
    scarto_importo: scartoImporto,
    quadra_importo: quadraImporto,
    // Un fornitore interno non manda fattura: la passiva lo riporta a zero e non e'
    // una difformita'.
    interno: !!(costo && costo.interno),
    // IL VERDETTO COMPLESSIVO. Verde solo se torna TUTTO quello che si e' potuto
    // controllare. Prima l'importo non ci entrava - un consuntivo con 500 euro di
    // differenza usciva verde, con la differenza scritta dentro il riquadro verde -
    // e un costo che non si trova affatto (quadra_con_passiva null) passava per
    // buono, perche' null non e' false: era il caso del subfornitore e del
    // trasportatore di extra raccolta, dichiarati a posto senza che il gestionale
    // avesse un solo euro da opporre.
    quadra_tutto: confronto.quadra
      && quadraPassiva === true
      && (quadraImporto === null || quadraImporto === true),
    // Che cosa NON si e' potuto controllare: dirlo e' diverso dal dire che va bene.
    non_controllato: [
      !costo || !costo.trovato ? 'il costo previsto (la fatturazione passiva non ha una riga per questo fornitore in questo ruolo)' : '',
      importo_consuntivo === null ? "l'importo (il consuntivo non ne porta uno)" : '',
    ].filter(Boolean),
  };
}

/** Il testo del verdetto, in parole. Vuoto quando non c'e' niente da dire. */
export function testoEsitoConsuntivo(confronto, esito) {
  const parti = [];
  if (confronto.quadra) parti.push(`Il consuntivo corrisponde ai nostri movimenti: ${confronto.uguali} formulari, ${confronto.totale_consuntivo_kg} kg.`);
  else {
    const q = [];
    if (confronto.peso_diverso) q.push(`${confronto.peso_diverso} con un peso diverso`);
    if (confronto.solo_consuntivo) q.push(`${confronto.solo_consuntivo} che noi non abbiamo (${confronto.kg_solo_consuntivo} kg)`);
    if (confronto.solo_gestionale) q.push(`${confronto.solo_gestionale} che abbiamo noi e il consuntivo non riporta (${confronto.kg_solo_gestionale} kg)`);
    if (confronto.senza_chiave) q.push(`${confronto.senza_chiave} righe senza formulario ne' ordine, che non si possono abbinare`);
    parti.push(`Il consuntivo non corrisponde: ${q.join(', ')}.`);
  }
  if (esito.quadra_con_passiva === false) {
    parti.push(`I chili che la fatturazione passiva conta per questo fornitore sono ${Math.abs(esito.scarto_passiva_kg)} kg ${esito.scarto_passiva_kg > 0 ? 'in meno' : 'in piu'}' dei nostri movimenti del mese: di solito vuol dire che una tratta non ha una tariffa, o che una riga sta in un altro blocco.`);
  }
  if (esito.importo_consuntivo !== null && esito.quadra_importo === false) {
    parti.push(`L'importo del consuntivo si scosta di ${esito.scarto_importo > 0 ? '+' : ''}${esito.scarto_importo.toFixed(2)} euro da quello previsto.`);
  }
  if (esito.interno) parti.push('E\' un fornitore interno: la passiva lo riporta a zero perche\' non fattura, e la differenza sull\'importo non e\' una difformita\'.');
  // Quello che non si e' potuto controllare va detto: un verdetto che tace su un
  // controllo mancato si legge come un controllo passato.
  if ((esito.non_controllato || []).length) {
    parti.push(`Non si e' potuto controllare: ${esito.non_controllato.join('; ')}.`);
  }
  return parti.join(' ');
}
