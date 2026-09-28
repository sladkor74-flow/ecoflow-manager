// L'anno dei dati di Target & Status (27/09/2026).
//
// Tutti gli input dell'anno - impianti e loro target, stoccaggi e collegamenti,
// target dei raccoglitori annuali e mensili, contratto Ecotyre, elenco dei siti
// delle giacenze - si scrivono in Target & Status, anno per anno, e gli altri
// moduli li leggono da li'. Un anno nuovo nasce come copia del precedente,
// segnata "copiato dal {anno-1}, da confermare"; un anno chiuso (prima di quello
// in corso, ora italiana) si legge soltanto.
//
// Questo file non importa niente apposta: la chiave dei nomi (in pratica
// normalizzaRagioneSociale) la passa chi chiama, cosi' lo specchio per il
// browser (src/lib/annoTarget.js) resta identico (prove/specchi.mjs).

/** L'anno a cui vale un record di configurazione: il suo, o il 2026 se non lo dice. */
export const annoDelRecord = (r) => Number((r && r.anno) || 2026);

const ANNO_ROMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric' });

/** L'anno in corso, in Italia. */
export const annoCorrenteRoma = () => Number(ANNO_ROMA.format(new Date()));

/** Un anno chiuso si legge soltanto: e' prima di quello in corso. */
export const annoChiuso = (anno) => Number(anno) < annoCorrenteRoma();

/** I record che valgono per quell'anno. */
export const recordDellAnno = (righe, anno) => (righe || []).filter(r => annoDelRecord(r) === Number(anno));

const attivo = (r) => !!r && r.stato !== 'non_attivo';
const quando = (r) => String((r && (r.updated_date || r.created_date)) || '');
const piuRecente = (a, b) => (quando(b) > quando(a) ? b : a);
const testo = (v) => String(v || '').trim().toLowerCase();
const eStoccaggio = (f) => (f.ruolo ? f.ruolo === 'stoccaggio' || f.ruolo === 'doppio_ruolo' : f.tipo === 'stoccaggio');
const conValore = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));
const comeLista = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/**
 * Il target dell'impianto di quell'anno, da Target & Status: il record attivo di
 * esattamente quell'anno (nessun ripiego sugli anni prima) il cui nome ha la
 * stessa chiave del sito. Se sono piu' d'uno, quello modificato per ultimo.
 * Restituisce { kg, record } oppure null.
 */
export function targetImpiantoDellAnno(impiantiTarget, nomeSito, anno, chiave) {
  const k = chiave(nomeSito);
  if (!k) return null;
  let trovato = null;
  for (const r of recordDellAnno(impiantiTarget, anno)) {
    if (!attivo(r) || chiave(r.nome_impianto) !== k) continue;
    trovato = trovato ? piuRecente(trovato, r) : r;
  }
  return trovato ? { kg: Number(trovato.target) || 0, record: trovato } : null;
}

/**
 * Il target delle primarie di un sito, in tonnellate: la somma dei target annui
 * dei raccoglitori di quell'anno legati a quel sito (TargetRaccoglitore.impianto).
 */
export function targetPrimarieDelSito(raccoglitori, sito, anno, chiave) {
  const k = chiave(sito);
  if (!k) return 0;
  let t = 0;
  for (const r of recordDellAnno(raccoglitori, anno)) {
    if (chiave(r.impianto) === k) t += Number(r.target_tonnellate) || 0;
  }
  return Math.round(t * 1000) / 1000;
}

/** La nota che accompagna ogni record copiato. */
export const notaCopia = (anno) => `copiato dal ${Number(anno) - 1}, da confermare`;

const RE_COPIA = /copiato dal \d{4}, da confermare/;
const ultimaNotaStorico = (storico) => {
  try {
    const s = typeof storico === 'string' ? JSON.parse(storico) : storico;
    return Array.isArray(s) && s.length ? String((s[s.length - 1] || {}).nota || '') : '';
  } catch { return ''; }
};

/**
 * Un record copiato dall'anno prima e non ancora confermato: la nota della copia
 * e' nel campo note (impianti, collegamenti, siti) o e' l'ultima voce dello
 * storico (target dei raccoglitori, mensili, contratto). Una correzione salvata
 * dopo la copia aggiunge una voce allo storico, e cosi' conferma il record.
 */
export const daConfermare = (r) => !!r && (RE_COPIA.test(String(r.note || '')) || RE_COPIA.test(ultimaNotaStorico(r.storico_json)));

/** Le note di un record senza la nota della copia: per confermarlo. */
export const senzaNotaCopia = (note) => String(note || '').replace(RE_COPIA, '').replace(/^[\s·]+|[\s·]+$/g, '');

/** Le note di un record copiato: la nota della copia davanti, poi quelle che aveva (senza la copia vecchia). */
export const conNotaCopia = (note, anno) => {
  const resto = senzaNotaCopia(note);
  return resto ? `${notaCopia(anno)} · ${resto}` : notaCopia(anno);
};

/**
 * Il piano della copia di un anno dal precedente: che cosa creare, senza
 * scrivere niente. sorgente ed esistenti sono { impianti, fornitori,
 * raccoglitori, mensili, commessa, siti } (gli archivi possono essere interi:
 * qui si tiene solo l'anno giusto, con annoDelRecord). regolePrecedenti sono le
 * regole della predittivita' dell'anno prima (regolePredittivita), da cui si
 * prende la priorita' degli stoccaggi che non l'hanno scritta. chiave e' la
 * normalizzazione dei nomi (normalizzaRagioneSociale). il e da finiscono nello
 * storico dei record copiati.
 *
 * Si salta tutto quello che l'anno ha gia' (la copia si puo' ripetere e completa
 * solo cio' che manca), quello che non e' attivo e i collegamenti a impianti che
 * non ci sono. I collegamenti escono con impianto_chiave al posto di
 * impianto_id: l'id del nuovo impianto si conosce solo dopo averlo creato.
 *
 * Un anno gia' compilato a mano non si inquina (28/09/2026): una categoria
 * (impianti, collegamenti, target annui, mensili, siti) si copia solo se l'anno
 * non ne ha, o ha soltanto record copiati e non ancora confermati (una copia
 * interrotta a meta' si completa). Altrimenti la categoria si salta intera, e
 * saltati.<categoria>_gia_compilati dice quante righe dell'anno prima restano fuori:
 * un raccoglitore tolto o rinominato non torna nell'anno in corso.
 *
 * Gli impianti che l'anno prima avevano il target solo in Giacenze
 * (GiacenzaSito.target_totale_t, senza record attivo di Target & Status con un
 * target) nascono con quel target e la predittivita' spenta, come fa
 * portaTargetInTargetStatus: la copia non li perde (daGiacenze li conta).
 */
export function pianoCopiaAnno({ anno, sorgente = {}, esistenti = {}, regolePrecedenti = {}, chiave, il = new Date().toISOString(), da = '' }) {
  const a = Number(anno), prima = a - 1;
  const nota = notaCopia(a);
  const storico = () => JSON.stringify([{ il, da, nota, prima: null }]);
  const saltati = {
    impianti_esistenti: 0, impianti_non_attivi: 0,
    collegamenti_esistenti: 0, collegamenti_non_attivi: 0, collegamenti_orfani: 0,
    raccoglitori_esistenti: 0, mensili_esistenti: 0,
    commessa_esistente: 0, siti_esistenti: 0,
  };
  const src = (nome) => recordDellAnno(comeLista(sorgente[nome]), prima);
  const gia = (nome) => recordDellAnno(comeLista(esistenti[nome]), a);
  // una categoria gia' scritta a mano nell'anno non si tocca
  const compilata = (nome) => gia(nome).some(r => !daConfermare(r));
  const salta = (nome, quanti) => { saltati[`${nome}_gia_compilati`] = (saltati[`${nome}_gia_compilati`] || 0) + quanti; };

  // --- impianti
  const impiantiPrima = src('impianti');
  const chiaviImpiantiGia = new Set(gia('impianti').map(r => chiave(r.nome_impianto)));
  const daCopiare = new Map();
  const spenti = new Set();
  for (const r of impiantiPrima) {
    const k = chiave(r.nome_impianto);
    if (!k) continue;
    if (!attivo(r)) { saltati.impianti_non_attivi++; spenti.add(k); continue; }
    daCopiare.set(k, daCopiare.has(k) ? piuRecente(daCopiare.get(k), r) : r);
  }
  // il target scritto solo in Giacenze nell'anno prima (per sito)
  const targetGiacenze = new Map();
  for (const s of src('siti')) {
    const k = chiave(s.sito);
    const t = Number(s.target_totale_t) || 0;
    if (!k || s.tipo_destinazione !== 'imp' || !(t > 0) || targetGiacenze.has(k)) continue;
    targetGiacenze.set(k, { sito: s.sito, kg: Math.round(t * 1000) });
  }
  const impianti = [];
  let daGiacenze = 0;
  const impiantiCompilati = compilata('impianti');
  const aggiungiImpianto = (k, payload) => {
    if (chiaviImpiantiGia.has(k)) { saltati.impianti_esistenti++; return; }
    if (impiantiCompilati) { salta('impianti', 1); return; }
    impianti.push(payload);
  };
  for (const [k, r] of daCopiare) {
    const g = targetGiacenze.get(k);
    const soloGiacenze = !(Number(r.target) > 0) && !!g;
    if (soloGiacenze && !chiaviImpiantiGia.has(k) && !impiantiCompilati) daGiacenze++;
    aggiungiImpianto(k, conValore({
      nome_impianto: r.nome_impianto, target: soloGiacenze ? g.kg : Number(r.target) || 0,
      totale_capacity_kg: r.totale_capacity_kg, regione: r.regione,
      segue_predittivita: soloGiacenze || r.segue_predittivita === false ? false : true,
      note: conNotaCopia(r.note, a), stato: 'attivo', anno: a,
    }));
  }
  // un impianto spento dall'amministratore resta fuori anche se Giacenze ha il target
  for (const [k, g] of targetGiacenze) {
    if (daCopiare.has(k) || spenti.has(k)) continue;
    if (!chiaviImpiantiGia.has(k) && !impiantiCompilati) daGiacenze++;
    aggiungiImpianto(k, {
      nome_impianto: g.sito, target: g.kg, segue_predittivita: false,
      note: conNotaCopia('target preso da Giacenze', a), stato: 'attivo', anno: a,
    });
  }

  // --- collegamenti fra stoccaggi (e raccoglitori) e impianti
  const impiantoPrimaPerId = new Map(impiantiPrima.map(r => [r.id, r]));
  const impiantoGiaPerId = new Map(gia('impianti').map(r => [r.id, r]));
  const chiaveCollegamento = (f, kImp) => `${chiave(f.nome)}|${kImp}|${f.ruolo || f.tipo || ''}`;
  const collegamentiGia = new Set(gia('fornitori').map(f => {
    const imp = f.impianto_id ? impiantoGiaPerId.get(f.impianto_id) : null;
    return chiaveCollegamento(f, imp ? chiave(imp.nome_impianto) : chiave(f.impianto_nome));
  }));
  // un collegamento senza id valido si lega per nome, come fa la predittivita'
  // (predittivitaDati): all'impianto dell'anno prima con quella chiave, il
  // migliore (attivo, poi il piu' recente)
  const impiantoPrimaPerChiave = new Map();
  for (const r of impiantiPrima) {
    const k = chiave(r.nome_impianto);
    if (!k) continue;
    const x = impiantoPrimaPerChiave.get(k);
    impiantoPrimaPerChiave.set(k, !x ? r : attivo(x) !== attivo(r) ? (attivo(r) ? r : x) : piuRecente(x, r));
  }
  const ordini = regolePrecedenti.priorita || {};
  const collegamenti = [];
  const visti = new Set();
  const collegamentiCompilati = compilata('fornitori');
  for (const f of src('fornitori')) {
    if (!attivo(f)) { saltati.collegamenti_non_attivi++; continue; }
    const imp = (f.impianto_id && impiantoPrimaPerId.get(f.impianto_id)) || impiantoPrimaPerChiave.get(chiave(f.impianto_nome)) || null;
    if (!imp || !attivo(imp) || !chiave(imp.nome_impianto)) { saltati.collegamenti_orfani++; continue; }
    const kImp = chiave(imp.nome_impianto);
    const kc = chiaveCollegamento(f, kImp);
    if (collegamentiGia.has(kc)) { saltati.collegamenti_esistenti++; continue; }
    if (visti.has(kc)) continue;
    visti.add(kc);
    if (collegamentiCompilati) { salta('collegamenti', 1); continue; }
    let priorita = Number(f.priorita) > 0 ? Number(f.priorita) : null;
    if (priorita === null && eStoccaggio(f)) {
      const ordine = ordini[chiave(f.nome)] || [];
      const i = ordine.indexOf(kImp);
      if (i >= 0) priorita = i + 1;
    }
    collegamenti.push({
      ...conValore({
        nome: f.nome, impianto_chiave: kImp, impianto_nome: imp.nome_impianto,
        ruolo: f.ruolo, tipo: f.tipo, plafond_stoccaggio_kg: f.plafond_stoccaggio_kg,
        regione: f.regione, note: conNotaCopia(f.note, a), stato: 'attivo', anno: a,
      }),
      priorita,
    });
  }

  // --- target dei raccoglitori, annui e mensili
  const kRacc = (r) => `${chiave(r.raccoglitore)}|${testo(r.regione)}|${chiave(r.impianto)}`;
  const raccGia = new Set(gia('raccoglitori').map(kRacc));
  const raccoglitori = [];
  const raccoglitoriCompilati = compilata('raccoglitori');
  for (const r of src('raccoglitori')) {
    if (raccGia.has(kRacc(r))) { saltati.raccoglitori_esistenti++; continue; }
    if (raccoglitoriCompilati) { salta('raccoglitori', 1); continue; }
    raccoglitori.push(conValore({
      raccoglitore: r.raccoglitore, regione: r.regione, impianto: r.impianto, anno: a,
      target_tonnellate: Number(r.target_tonnellate) || 0, storico_json: storico(),
    }));
  }
  const kMese = (r) => `${kRacc(r)}|${testo(r.mese)}`;
  const mesiGia = new Set(gia('mensili').map(kMese));
  const mensili = [];
  const mensiliCompilati = compilata('mensili');
  for (const r of src('mensili')) {
    if (mesiGia.has(kMese(r))) { saltati.mensili_esistenti++; continue; }
    if (mensiliCompilati) { salta('mensili', 1); continue; }
    mensili.push(conValore({
      regione: r.regione, impianto: r.impianto, raccoglitore: r.raccoglitore, mese: r.mese, anno: a,
      target: r.target, non_raccoglie: !!r.non_raccoglie, storico_json: storico(),
    }));
  }

  // --- contratto Ecotyre: solo se l'anno non ne ha uno
  let commessa = null;
  const commessaPrima = src('commessa').reduce((x, r) => (x ? piuRecente(x, r) : r), null);
  if (gia('commessa').length) {
    if (commessaPrima) saltati.commessa_esistente++;
  } else if (commessaPrima) {
    const { id: _id, created_date: _c, updated_date: _u, created_by: _b, created_by_id: _bi, is_sample: _s, storico_json: _st, fine_programmazione: _f, ...campi } = commessaPrima;
    commessa = { ...conValore(campi), anno: a, storico_json: storico() };
  }

  // --- elenco dei siti delle giacenze: ruoli si', riferimenti e target no
  const kSito = (r) => `${chiave(r.sito)}|${r.tipo_destinazione || ''}`;
  const sitiGia = new Set(gia('siti').map(kSito));
  const siti = [];
  const sitiVisti = new Set();
  const sitiCompilati = compilata('siti');
  for (const r of src('siti')) {
    const k = kSito(r);
    if (!chiave(r.sito)) continue;
    if (sitiGia.has(k)) { saltati.siti_esistenti++; continue; }
    if (sitiVisti.has(k)) continue;
    sitiVisti.add(k);
    if (sitiCompilati) { salta('siti', 1); continue; }
    const ruoli = Object.fromEntries(Object.entries(r).filter(([c]) => c.startsWith('ruolo')));
    siti.push(conValore({
      sito: r.sito, tipo_destinazione: r.tipo_destinazione, anno: a,
      dichiara_rete: r.dichiara_rete, tipologia_trattamento: r.tipologia_trattamento, ...ruoli,
      note: notaCopia(a),
    }));
  }

  return { impianti, collegamenti, raccoglitori, mensili, commessa, siti, saltati, daGiacenze };
}

/** Quanti record creerebbe il piano. */
export const conteggiPiano = (p) => ({
  impianti: p.impianti.length, collegamenti: p.collegamenti.length, raccoglitori: p.raccoglitori.length,
  mensili: p.mensili.length, commessa: p.commessa ? 1 : 0, siti: p.siti.length,
});
