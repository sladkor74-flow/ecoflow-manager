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
import { comeOrdine } from "./prefattura.ts";

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
 * La chiave con cui una riga del consuntivo e una nostra si riconoscono: il NUMERO
 * DI FORMULARIO, che e' quello che un fornitore scrive sul suo riepilogo. Se non
 * c'e', l'ID ordine. Senza nessuno dei due la riga non si puo' abbinare a niente e
 * si dira'.
 */
export function chiaveRiga(r) {
  const fir = pulisci(r && (r.numero_fir || r.fir)).toUpperCase().replace(/[\s.-]/g, '');
  if (fir) return `FIR:${fir}`;
  const ord = comeOrdine((r && (r.id_ordine || r.ordine)) || '');
  return ord ? `ORD:${ord}` : '';
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
export function movimentiDelFornitore(archivi, { fornitore, ruolo, anno, mese, canale }) {
  const annoNum = Number(anno);
  const meseNum = Number(mese);
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
    for (const [righe, arch] of primarie) prendi(righe, arch, r => stesso(r.trasportatore, fornitore));
    prendi(extra, 'ExtraRaccolta', r => String(r.tipo_movimento || '').toLowerCase().trim() !== 'secondaria' && stesso(r.trasportatore, fornitore));
  } else if (ruolo === 'impianto') {
    // Tutto quello che gli e' arrivato: primarie scaricate da lui e secondarie in
    // ingresso. E' la stessa base su cui la passiva paga stoccaggio e trattamento.
    for (const [righe, arch] of primarie) prendi(righe, arch, r => stesso(r.destinazione, fornitore));
    prendi(archivi.secondarie || [], 'Secondaria', r => stesso(r.destinazione, fornitore));
    prendi(extra, 'ExtraRaccolta', r => stesso(r.destinazione, fornitore));
  } else if (ruolo === 'trasportatore') {
    // Le secondarie che ha portato: partono da un piazzale e arrivano a un impianto.
    prendi(archivi.secondarie || [], 'Secondaria', r => stesso(r.trasportatore, fornitore));
    prendi(extra, 'ExtraRaccolta', r => String(r.tipo_movimento || '').toLowerCase().trim() === 'secondaria' && stesso(r.trasportatore, fornitore));
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
  const raggruppa = (righe, peso, numero) => {
    const m = new Map();
    for (const r of righe || []) {
      const k = chiaveRiga(numero ? { numero_fir: numero(r) } : r) || chiaveRiga(r);
      if (!k) {
        const senza = m.get('__SENZA_CHIAVE__') || { chiave: '', righe: [], kg: 0, senza_chiave: true };
        senza.righe.push(r);
        senza.kg += kgTondi(peso(r));
        m.set('__SENZA_CHIAVE__', senza);
        continue;
      }
      if (!m.has(k)) m.set(k, { chiave: k, righe: [], kg: 0 });
      const e = m.get(k);
      e.righe.push(r);
      e.kg += Number(peso(r)) || 0;
    }
    for (const e of m.values()) e.kg = kgTondi(e.kg);
    return m;
  };

  const loro = raggruppa(righeConsuntivo, r => r.kg);
  const nostri = raggruppa(movimenti, r => r.peso_effettivo, r => chiaveFormulario(r) || r.id_ordine);

  const senzaChiave = loro.get('__SENZA_CHIAVE__') || null;
  loro.delete('__SENZA_CHIAVE__');
  nostri.delete('__SENZA_CHIAVE__');

  const voci = [];
  for (const [k, l] of loro) {
    const n = nostri.get(k);
    if (!n) {
      voci.push({ chiave: k, esito: 'solo_consuntivo', kg_consuntivo: l.kg, kg_gestionale: null, scarto_kg: null, righe_consuntivo: l.righe.length });
      continue;
    }
    const scarto = l.kg - n.kg;
    voci.push({
      chiave: k,
      esito: Math.abs(scarto) <= tolleranza_kg ? 'uguale' : 'peso_diverso',
      kg_consuntivo: l.kg, kg_gestionale: n.kg, scarto_kg: scarto,
      righe_consuntivo: l.righe.length, righe_gestionale: n.righe.length,
      id_ordine: pulisci(n.righe[0] && n.righe[0].id_ordine),
    });
  }
  for (const [k, n] of nostri) {
    if (loro.has(k)) continue;
    voci.push({
      chiave: k, esito: 'solo_gestionale', kg_consuntivo: null, kg_gestionale: n.kg, scarto_kg: null,
      righe_gestionale: n.righe.length, id_ordine: pulisci(n.righe[0] && n.righe[0].id_ordine),
    });
  }

  const conta = (e) => voci.filter(v => v.esito === e).length;
  const kgDi = (e, campo) => voci.filter(v => v.esito === e).reduce((s, v) => s + (v[campo] || 0), 0);
  const totaleLoro = [...loro.values()].reduce((s, e) => s + e.kg, 0) + (senzaChiave ? senzaChiave.kg : 0);
  const totaleNostro = [...nostri.values()].reduce((s, e) => s + e.kg, 0);

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
  return {
    quadra_quantita: confronto.quadra,
    // I chili che paghiamo devono essere quelli che abbiamo: se la passiva ne conta
    // altri, prima di guardare gli euro va capito perche'.
    quadra_con_passiva: scartoPassiva === null ? null : scartoPassiva === 0,
    scarto_passiva_kg: scartoPassiva,
    importo_previsto: costo && costo.trovato ? costo.importo : null,
    importo_consuntivo,
    scarto_importo: scartoImporto,
    quadra_importo: scartoImporto === null ? null : Math.abs(scartoImporto) <= tolleranza_euro,
    // Un fornitore interno non manda fattura: la passiva lo riporta a zero e non e'
    // una difformita'.
    interno: !!(costo && costo.interno),
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
  return parti.join(' ');
}
