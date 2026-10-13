// Specchio per le pagine di base44/shared/campiTracciati.ts: le pagine non
// possono importare da base44/shared. Deve restare IDENTICO all'originale, a
// meno di questa intestazione e degli import, e lo controlla prove/specchi.mjs.
// E' nato l'11/10/2026 con lo storico delle modifiche (ModificaDato): le
// pagine e le funzioni scrivono i numeri che fanno i conti, e devono tracciarli
// con la stessa regola - quali campi, quando un valore e' cambiato, che cosa
// si registra. Chi cambia la regola la cambia nell'originale e la ricopia qui.
// Non importa niente, cosi' lo leggono anche le prove in node.

/**
 * I campi che si tracciano, archivio per archivio. unita dice come si legge il
 * valore: kg, t, €, €/t, €/viaggio, giorno, si_no, testo, json; prezzo_tariffa
 * e prezzo_voce prendono l'unita' dal record (unita_misura). mostra: 't' dice
 * che il valore e' salvato in chili ma la pagina lo scrive in tonnellate, come
 * il target degli impianti in Target & Status. predefinito e' il
 * valore che vale quando il campo e' vuoto: serve solo a non registrare come
 * modifica il passaggio da «vuoto» al suo stesso valore (uno stato 'attivo'
 * scritto su un record che non l'aveva). riservato: e' un costo, e i costi dei
 * fornitori li vede solo l'amministratore, anche in EcoTyna. celle e colonne,
 * solo sui campi json: l'unita' dei numeri dentro la tabella (celle per i
 * dodici mesi, colonne per le righe con regione, classe o destinazione).
 * elenco, solo sui campi json che sono un elenco di fornitori: il campo delle
 * righe che porta il nome, e la differenza si dice coi nomi di prima e di dopo.
 */
export const CAMPI_TRACCIATI = {
  ImpiantoTargetSecondaria: {
    nome_impianto: { nome: "nome dell'impianto", unita: 'testo' },
    target: { nome: 'target di rete', unita: 'kg', mostra: 't' },
    totale_capacity_kg: { nome: 'capacità totale', unita: 'kg', mostra: 't' },
    data_fine: { nome: 'fine della programmazione', unita: 'giorno' },
    stato: { nome: 'stato', unita: 'testo', predefinito: 'attivo' },
    segue_predittivita: { nome: 'seguito dalla predittività', unita: 'si_no', predefinito: true },
  },
  ImpiantoTarget: {
    target: { nome: 'target del mese', unita: 't' },
  },
  TargetRaccoglitore: {
    target_tonnellate: { nome: 'target annuo', unita: 't' },
    attivo_dal: { nome: 'attivo dal', unita: 'giorno' },
    impianto: { nome: 'impianto di destinazione', unita: 'testo' },
    ruolo: { nome: 'impianto o piazzale', unita: 'testo', predefinito: '' },
  },
  TargetMensile: {
    target: { nome: 'target del mese', unita: 't' },
    non_raccoglie: { nome: 'non raccoglie nel mese', unita: 'si_no', predefinito: false },
    impianto: { nome: 'impianto di destinazione', unita: 'testo' },
    ruolo: { nome: 'impianto o piazzale', unita: 'testo', predefinito: '' },
  },
  TargetRaccoglitorePrimaria: {
    target_kg: { nome: 'target del mese', unita: 'kg' },
    non_raccoglie: { nome: 'non raccoglie nel mese', unita: 'si_no', predefinito: false },
  },
  GiacenzaSito: {
    sito: { nome: 'sito', unita: 'testo' },
    tipo_destinazione: { nome: 'ruolo del sito', unita: 'testo' },
    giacenza_riferimento_t: { nome: 'giacenza di apertura (rete)', unita: 't' },
    giacenza_riferimento_aci_t: { nome: 'giacenza di apertura (ACI)', unita: 't' },
    apertura_del: { nome: "giorno dell'apertura", unita: 'giorno' },
    dichiara_rete: { nome: 'dichiara la rete', unita: 'si_no', predefinito: true },
  },
  Tariffa: {
    valore: { nome: 'prezzo', unita: 'prezzo_tariffa' },
    unita_misura: { nome: 'unità di misura', unita: 'testo' },
    data_inizio_validita: { nome: 'valida dal', unita: 'giorno' },
    data_fine_validita: { nome: 'valida fino al', unita: 'giorno' },
    stato: { nome: 'stato', unita: 'testo', predefinito: 'attivo' },
    comprensiva_trattamento: { nome: 'prezzo comprensivo del trattamento', unita: 'si_no', predefinito: false },
  },
  // Il surplus sulle tariffe (13/10/2026): il Fuel Surcharge del consorzio
  // Ecotyre e gli accordi commerciali cambiano attiva, passiva e margine come un
  // prezzo, quindi si tracciano come le tariffe. L'importo ai fornitori e' un
  // costo, e lo vede solo l'amministratore; quello da Ecotyre no, come
  // l'attiva. Un surplus senza importo da Ecotyre e' invece tutto un costo, e
  // si riserva in ogni campo (campoRiservato). I fornitori dell'elenco si
  // dicono per nome, non come JSON.
  SurplusTariffa: {
    nome: { nome: 'nome', unita: 'testo' },
    tipologia: { nome: 'canale', unita: 'testo' },
    prestazione: { nome: 'prestazione', unita: 'testo' },
    euro_t_passiva: { nome: 'surplus ai fornitori', unita: '€/t', riservato: true },
    euro_t_attiva: { nome: 'surplus da Ecotyre', unita: '€/t' },
    data_inizio_validita: { nome: 'valido dal', unita: 'giorno' },
    data_fine_validita: { nome: 'valido fino al', unita: 'giorno' },
    stato: { nome: 'stato', unita: 'testo', predefinito: 'attivo' },
    a_chi: { nome: 'a chi vale', unita: 'testo', predefinito: 'tutti' },
    fornitori_json: { nome: "fornitori dell'elenco", unita: 'json', elenco: 'nome' },
  },
  // Le tabelle della commessa con l'unita' dei loro numeri, come nella scheda:
  // i dodici mesi e i target in tonnellate, il prezzo della previsione ACI in
  // €/t, la ripartizione per classe in percentuale (salvata come frazione: 0,3
  // e' il 30%). Senza, lo storico scriveva «percentuale 0,3 → 0,35» e EcoTyna
  // chiamava tonnellate anche prezzi e percentuali (revisione delle migliorie,
  // 11/10/2026).
  CommessaEcotyre: {
    target_annuo_t: { nome: 'target annuo', unita: 't' },
    regioni_json: { nome: 'target per regione', unita: 'json', colonne: { target_t: { nome: 'target', unita: 't' } } },
    classi_json: { nome: 'ripartizione per classe', unita: 'json', colonne: { percentuale: { nome: 'percentuale', unita: '%' } } },
    target_mensile_iniziale_json: { nome: 'target mensile iniziale', unita: 'json', celle: 't' },
    target_mensile_json: { nome: 'target mensile rivisto', unita: 'json', celle: 't' },
    budget_rete_json: { nome: 'budget mensile RETE', unita: 'json', celle: 't' },
    budget_aci_json: { nome: 'budget mensile ACI', unita: 'json', celle: 't' },
    destinazioni_json: { nome: 'quantità per destinazione', unita: 'json', colonne: { target_t: { nome: 'target', unita: 't' } } },
    target_prezzo_regioni_json: { nome: 'previsione ACI per regione', unita: 'json', colonne: { target_t: { nome: 'target', unita: 't' }, prezzo: { nome: 'prezzo', unita: '€/t' } } },
    fine_programmazione: { nome: 'fine della programmazione', unita: 'giorno' },
    kg_per_viaggio: { nome: 'chili per viaggio', unita: 'kg' },
  },
  DichiarazioneSito: {
    quantita_kg: { nome: 'quantità dichiarata', unita: 'kg' },
    caricata_inviata: { nome: 'caricata a portale', unita: 'si_no', predefinito: false },
    motivo_assenza: { nome: "motivo dell'assenza", unita: 'testo', predefinito: '' },
  },
  // Nell'extra raccolta un costo vuoto e un costo a zero sono la stessa cosa (il
  // modulo li salva a zero, e zero sul prezzo vuol dire «vale la tariffa base»):
  // per questo predefinito 0, altrimenti il primo salvataggio di una scheda
  // vecchia registrerebbe dodici modifiche finte.
  ExtraRaccolta: {
    prezzo_attivo_t: { nome: 'prezzo a Ecotyre', unita: '€/t', predefinito: 0 },
    sovracosto_raccolta: { nome: 'sovracosto di raccolta (attivo)', unita: '€', predefinito: 0 },
    sovracosto_trasporto: { nome: 'sovracosto di trasporto (attivo)', unita: '€', predefinito: 0 },
    sovracosto_trattamento: { nome: 'sovracosto di trattamento (attivo)', unita: '€', predefinito: 0 },
    costo_raccolta_t: { nome: 'costo di raccolta', unita: '€/t', predefinito: 0, riservato: true },
    costo_stoccaggio_t: { nome: 'costo di stoccaggio', unita: '€/t', predefinito: 0, riservato: true },
    costo_trattamento_t: { nome: 'costo di trattamento', unita: '€/t', predefinito: 0, riservato: true },
    costo_trasporto_viaggio: { nome: 'costo del trasporto', unita: '€/viaggio', predefinito: 0, riservato: true },
    sovracosto_pagato_raccoglitore: { nome: 'sovracosto pagato al raccoglitore', unita: '€', predefinito: 0, riservato: true },
    sovracosto_pagato_impianto: { nome: "sovracosto pagato all'impianto", unita: '€', predefinito: 0, riservato: true },
    costo_pulizia: { nome: 'costo di pulizia', unita: '€', predefinito: 0, riservato: true },
    costi_aggiuntivi: { nome: 'costi aggiuntivi', unita: '€', predefinito: 0, riservato: true },
  },
  VocePassivaAmministrazione: {
    soggetto: { nome: 'soggetto', unita: 'testo' },
    voce: { nome: 'voce', unita: 'testo', predefinito: '' },
    prezzo: { nome: 'prezzo', unita: 'prezzo_voce' },
    unita_misura: { nome: 'unità di misura', unita: 'testo', predefinito: 'euro_tonnellata' },
    criterio_json: { nome: 'criterio dei movimenti', unita: 'json' },
    attiva: { nome: 'attiva nel foglio', unita: 'si_no', predefinito: true },
  },
};

/** Gli archivi i cui record sono tutti costi: il foglio della passiva. */
const ENTITA_RISERVATE = ['VocePassivaAmministrazione'];

/** Gli archivi tracciati, per la prova che cerca chi scrive fuori dall'involucro. */
export const ENTITA_TRACCIATE = Object.keys(CAMPI_TRACCIATI);

export const entitaTracciata = (entita) => Object.prototype.hasOwnProperty.call(CAMPI_TRACCIATI, entita);

/** La descrizione di un campo tracciato, o null. */
export const campoTracciato = (entita, campo) => (entitaTracciata(entita) && Object.prototype.hasOwnProperty.call(CAMPI_TRACCIATI[entita], campo) ? CAMPI_TRACCIATI[entita][campo] : null);

/** Vero se la patch scrive almeno un campo tracciato di quell'archivio. */
export const toccaCampiTracciati = (entita, patch) => Object.keys(patch || {}).some(c => !!campoTracciato(entita, c));

/** Il nome di un campo come si legge a video. */
export const nomeCampo = (entita, campo) => {
  if (!campo) return 'record';
  const spec = campoTracciato(entita, campo);
  return spec ? spec.nome : String(campo).replace(/_/g, ' ');
};

const vuoto = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const NUMERICHE = ['kg', 't', '€', '€/t', '€/kg', '€/viaggio', 'prezzo_tariffa', 'prezzo_voce'];
export const unitaNumerica = (unita) => NUMERICHE.includes(unita);

// Il JSON scritto sempre allo stesso modo, con le chiavi in ordine: due pagine
// che costruiscono lo stesso criterio con le chiavi in un altro ordine scrivono
// lo stesso dato. Prima il confronto conservava l'ordine, e sulle 8 voci vere
// di Irigom ogni salvataggio dalla pagina registrava un «criterio dei
// movimenti» cambiato mai cambiato (revisione delle migliorie, 11/10/2026).
const ordinato = (v) => (Array.isArray(v) ? v.map(ordinato)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, ordinato(v[k])])) : v);
const testoJson = (v) => JSON.stringify(ordinato(v));
// Una tabella senza nessun valore (dodici mesi tutti vuoti, nessuna riga, un
// criterio senza condizioni) e' un campo vuoto: una commessa nuova con le
// tabelle ancora da scrivere non ha «riscritto» niente. Lo zero resta un valore.
const jsonVuoto = (v) => vuoto(v)
  || (Array.isArray(v) && v.every(jsonVuoto))
  || (!!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

// Il valore come si confronta: il vuoto prende il predefinito, i numeri si
// confrontano come numeri (1250 e '1250' sono lo stesso target, e 0,1+0,2 e
// 0,3 lo stesso prezzo), i giorni sul giorno, il JSON sul suo contenuto e non
// sulla forma in cui e' scritto, ne' sull'ordine delle chiavi (la commessa
// riscrive tutte le tabelle a ogni salvataggio: una tabella che non cambia non
// e' una modifica, e una tabella tutta vuota vale vuoto).
function normalizza(spec, v) {
  const x = vuoto(v) ? (spec.predefinito === undefined ? null : spec.predefinito) : v;
  if (x === null) return null;
  if (unitaNumerica(spec.unita)) {
    const n = Number(x);
    return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : String(x).trim();
  }
  if (spec.unita === 'si_no') return x === true || x === 'true';
  if (spec.unita === 'giorno') return String(x).slice(0, 10);
  if (spec.unita === 'json') {
    try {
      const dato = typeof x === 'string' ? JSON.parse(x) : x;
      if (jsonVuoto(dato)) return null;
      // Un elenco di fornitori non ha un ordine: gli stessi fornitori scelti in
      // un altro ordine sono lo stesso elenco (13/10/2026).
      return spec.elenco && Array.isArray(dato) ? testoJson(dato.map(testoJson).sort()) : testoJson(dato);
    } catch { return String(x).trim(); }
  }
  return String(x).trim();
}

/** Vero se i due valori del campo sono lo stesso valore. */
export function stessoValore(entita, campo, a, b) {
  const spec = campoTracciato(entita, campo) || { unita: 'testo' };
  return normalizza(spec, a) === normalizza(spec, b);
}

/**
 * Il valore come si salva in ModificaDato: testo, o null se il campo e' vuoto.
 * Si salva il valore vero, non il predefinito: un costo che non c'era resta
 * «—», non diventa zero.
 */
export function testoDelValore(v) {
  if (vuoto(v)) return null;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Il valore riletto da ModificaDato, col tipo del suo campo: numeri come numeri, si/no come vero/falso. */
export function valoreDelTesto(unita, testo) {
  if (testo === null || testo === undefined || testo === '') return null;
  if (unitaNumerica(unita)) {
    const n = Number(testo);
    return Number.isFinite(n) ? n : testo;
  }
  if (unita === 'si_no') return testo === 'true';
  return testo;
}

const UNITA_TARIFFA = { '€/t': '€/t', '€/kg': '€/kg', '€/viaggio': '€/viaggio' };

/** L'unita' con cui si legge il valore del campo, per quel record. */
export function unitaDelCampo(entita, campo, record) {
  const spec = campoTracciato(entita, campo);
  if (!spec) return 'testo';
  const r = record || {};
  if (spec.unita === 'prezzo_tariffa') return UNITA_TARIFFA[r.unita_misura] || '€';
  if (spec.unita === 'prezzo_voce') return r.unita_misura === 'euro_viaggio' ? '€/viaggio' : '€/t';
  return spec.unita;
}

/** Vero se il campo e' un costo dei fornitori, che vede solo l'amministratore. */
export function campoRiservato(entita, campo, record) {
  const spec = campoTracciato(entita, campo);
  if (spec && spec.riservato) return true;
  if (ENTITA_RISERVATE.includes(entita)) return true;
  // Una tariffa senza direzione e' passiva: e' stata scritta prima che il campo
  // esistesse (gestisciAnagrafiche la legge cosi').
  if (entita === 'Tariffa') return String((record && record.direzione) || 'PASSIVA').toUpperCase() !== 'ATTIVA';
  // Un surplus senza importo da Ecotyre (un accordo commerciale con un
  // fornitore, pagato solo da SMOCO) e' tutto un costo dei fornitori, come una
  // tariffa passiva: nome, fornitori, prestazione e periodo dell'accordo li vede
  // solo l'amministratore, in pagina e in EcoTyna. Con l'importo da Ecotyre e'
  // anche una voce dell'attiva, e resta riservato solo l'importo ai fornitori
  // (revisione del surplus, 13/10/2026). Un importo che non si legge vale vuoto.
  if (entita === 'SurplusTariffa') return !(Number(record && record.euro_t_attiva) > 0);
  return false;
}

const parte = (v) => String(v ?? '').trim();
const unisci = (...parti) => parti.map(parte).filter(Boolean).join(' · ');

/**
 * Di che cosa si parla, come si legge in una riga di storico: «IRIGOM S.R.L. ·
 * 2026», «Commessa Ecotyre 2026», «GATIM SRL · RETE · agosto 2026».
 */
export function etichettaDi(entita, record) {
  const r = record || {};
  const anno = parte(r.anno);
  switch (entita) {
    case 'ImpiantoTargetSecondaria': return unisci(r.nome_impianto, anno);
    case 'ImpiantoTarget': return unisci(r.impianto, [parte(r.mese), anno].filter(Boolean).join(' '));
    case 'TargetRaccoglitore':
    case 'TargetMensile':
    case 'TargetRaccoglitorePrimaria': {
      const verso = parte(r.impianto) ? `verso ${parte(r.impianto)}${r.ruolo === 'stoccaggio' ? ' (piazzale)' : ''}` : '';
      return unisci(r.raccoglitore, r.regione, verso, [parte(r.mese), anno].filter(Boolean).join(' '));
    }
    case 'GiacenzaSito': return unisci(r.sito, r.tipo_destinazione === 'stoc' ? 'stoccaggio' : r.tipo_destinazione === 'imp' ? 'impianto' : '', anno);
    case 'Tariffa': {
      const attiva = String(r.direzione || 'PASSIVA').toUpperCase() === 'ATTIVA';
      const tratta = parte(r.produttore) || parte(r.destinatario) ? `${parte(r.produttore) || '…'} → ${parte(r.destinatario) || '…'}` : '';
      return unisci(attiva ? (r.cliente || 'ECOTYRE') : r.fornitore_nome, attiva ? 'attiva' : r.prestazione, r.tipologia,
        r.classe_materiale ? `classe ${r.classe_materiale}` : '', r.regione, r.provincia, r.destinazione, tratta,
        r.data_inizio_validita ? `dal ${String(r.data_inizio_validita).slice(0, 10).split('-').reverse().join('/')}` : '');
    }
    // «Fuel Surcharge · EXTRA RACCOLTA · RACCOLTA · dal 01/10/2026»: un record per
    // canale, e il canale e' la prima cosa da sapere di una modifica.
    case 'SurplusTariffa': return unisci(r.nome || 'surplus', parte(r.tipologia).replace(/_/g, ' '), parte(r.prestazione).replace(/_/g, ' '),
      r.data_inizio_validita ? `dal ${String(r.data_inizio_validita).slice(0, 10).split('-').reverse().join('/')}` : '');
    case 'CommessaEcotyre': return `Commessa Ecotyre ${anno}`.trim();
    case 'DichiarazioneSito': return unisci(r.sito, [parte(r.canale) || 'RETE', parte(r.provenienza)].filter(Boolean).join(' '), [parte(r.mese), anno].filter(Boolean).join(' '));
    case 'ExtraRaccolta': return unisci(r.id_ordine || r.numero_fir, r.produttore || r.ragione_sociale || r.punto_di_raccolta, anno);
    case 'VocePassivaAmministrazione': return unisci(r.soggetto, r.voce, r.canale, anno);
    default: return unisci(r.nome || r.id, anno);
  }
}

/** L'anno a cui si riferisce il record: il suo campo anno, o per una tariffa e un surplus il primo giorno di validita'. */
export function annoDi(entita, record) {
  const r = record || {};
  const a = Number(r.anno);
  if (Number.isInteger(a) && a > 2000) return a;
  if (entita === 'Tariffa' || entita === 'SurplusTariffa') {
    const d = Number(String(r.data_inizio_validita || '').slice(0, 4));
    if (Number.isInteger(d) && d > 2000) return d;
  }
  return null;
}

/**
 * Le modifiche dei campi tracciati fra due stati dello stesso record.
 *
 * Su una modifica contano solo i campi della patch: quelli che non scrive non
 * cambiano. Su una creazione e su una cancellazione contano i campi tracciati
 * con un valore diverso da quello che varrebbe da vuoti: un target nato a 50 t
 * si registra, uno stato 'attivo' o un «non raccoglie: no» no, perche' sono
 * il default e riempirebbero lo storico di righe che non dicono niente. Se non
 * resta nessun campo c'e' comunque una riga (campo vuoto): un record tracciato
 * che nasce o sparisce non passa mai in silenzio.
 */
export function modificheDelRecord(entita, { prima = null, dopo = null, patch = null, operazione = 'update' } = {}) {
  if (!entitaTracciata(entita)) return [];
  const campi = Object.keys(CAMPI_TRACCIATI[entita]);
  const a = prima || {};
  const b = dopo || {};
  const record = operazione === 'delete' ? a : b;
  const una = (campo) => ({
    campo, prima: testoDelValore(a[campo]), dopo: testoDelValore(b[campo]),
    unita: unitaDelCampo(entita, campo, record), riservato: campoRiservato(entita, campo, record),
  });
  if (operazione === 'update') {
    const scritti = Object.keys(patch || b).filter(c => campi.includes(c));
    return scritti.filter(c => !stessoValore(entita, c, a[c], b[c])).map(una);
  }
  const lato = operazione === 'delete' ? a : b;
  const conValore = campi.filter(c => !vuoto(lato[c]) && !stessoValore(entita, c, null, lato[c])).map(una);
  if (conValore.length) return conValore;
  return [{ campo: '', prima: null, dopo: null, unita: 'testo', riservato: ENTITA_RISERVATE.includes(entita) || (entita === 'Tariffa' && campoRiservato(entita, 'valore', record))
    || (entita === 'SurplusTariffa' && campoRiservato(entita, 'nome', record)) }];
}

/**
 * Le righe da scrivere in ModificaDato per le modifiche di un record. utente,
 * origine, motivo ed etichetta arrivano da chi scrive; il e' l'istante della
 * modifica (lo stesso per tutte le righe di una scrittura).
 */
export function righeDiModifica(entita, { record_id = '', prima = null, dopo = null, patch = null, operazione = 'update' } = {}, { utente = '', origine = '', motivo = '', etichetta = '', il = '' } = {}) {
  const record = operazione === 'delete' ? prima : { ...(prima || {}), ...(dopo || {}) };
  const quando = il || new Date().toISOString();
  const nome = parte(etichetta) || etichettaDi(entita, record);
  const anno = annoDi(entita, record);
  return modificheDelRecord(entita, { prima, dopo, patch, operazione }).map(m => ({
    entita, record_id: parte(record_id), etichetta: nome, campo: m.campo,
    ...(m.prima !== null ? { prima: m.prima } : {}),
    ...(m.dopo !== null ? { dopo: m.dopo } : {}),
    unita: m.unita, operazione, utente: parte(utente), il: quando,
    origine: parte(origine), motivo: parte(motivo), riservato: !!m.riservato,
    ...(anno ? { anno } : {}),
  }));
}

const NOMI_MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const CHIAVI_RIGA = ['regione', 'classe', 'destinazione', 'soggetto'];
const leggiJson = (testo) => { if (testo === null || testo === undefined || testo === '') return null; try { return JSON.parse(testo); } catch { return testo; } };

/**
 * Che cosa e' cambiato dentro un campo JSON (le tabelle della commessa, il
 * criterio di una voce della passiva): un elenco di { voce, prima, dopo, unita? },
 * cosi' a video e in EcoTyna si legge «giugno: 900 t → 950 t» invece di due
 * tabelle intere. Dodici numeri sono i mesi; righe con regione, classe o
 * destinazione si confrontano riga per riga (una riga nuova o tolta si dice
 * cella per cella; se non ha nessun valore, col solo nome: { voce, riga:
 * 'aggiunta' o 'tolta', valori: 'nessuno' }); un oggetto chiave per chiave.
 *
 * spec e' la descrizione del campo (campoTracciato): celle e colonne danno
 * l'unita' dei numeri. Una percentuale salvata come frazione si restituisce gia'
 * moltiplicata per cento (0,35 diventa 35, unita' '%'), come la scrive la scheda.
 */
export function differenzeJson(testoPrima, testoDopo, spec = null) {
  const a = leggiJson(testoPrima);
  const b = leggiJson(testoDopo);
  // Un elenco di fornitori (quelli di un surplus «solo questi», 13/10/2026):
  // conta chi c'e', non l'ordine, e si dice coi nomi di prima e di dopo,
  // «GATIM S.R.L. → GATIM S.R.L., EMMESSE SRLS». Come tabella di righe sarebbe
  // uscito l'id dell'anagrafica di ogni fornitore aggiunto.
  if (spec && spec.elenco) {
    const nomi = (v) => (Array.isArray(v) ? v : []).map(x => parte(x && typeof x === 'object' ? x[spec.elenco] : x)).filter(Boolean);
    const na = nomi(a);
    const nb = nomi(b);
    if ([...na].sort().join('\n') === [...nb].sort().join('\n')) return [];
    return [{ voce: '', prima: na.length ? na.join(', ') : null, dopo: nb.length ? nb.join(', ') : null }];
  }
  const colonne = (spec && spec.colonne) || {};
  const valore = (v) => (v === undefined || v === null || v === '' ? null : typeof v === 'object' ? testoJson(v) : v);
  const diverso = (x, y) => JSON.stringify(valore(x)) !== JSON.stringify(valore(y));
  const inUnita = (v, unita) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
    return unita === '%' && n !== null ? Math.round(n * 1000000) / 10000 : v;
  };
  const differenza = (voce, x, y, unita) => ({ voce, prima: inUnita(valore(x), unita), dopo: inUnita(valore(y), unita), ...(unita ? { unita } : {}) });
  const nomeColonna = (c) => (colonne[c] && colonne[c].nome) || String(c).replace(/_/g, ' ');
  const unitaColonna = (c) => (colonne[c] && colonne[c].unita) || '';
  const out = [];
  const numeri = (v) => Array.isArray(v) && v.every(x => x === null || x === '' || typeof x === 'number' || (typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x))));
  if ((a === null || numeri(a)) && (b === null || numeri(b)) && (a || b)) {
    const n = Math.max((a || []).length, (b || []).length);
    for (let i = 0; i < n; i++) {
      const x = a ? a[i] : null;
      const y = b ? b[i] : null;
      if (diverso(x, y)) out.push(differenza(n === 12 ? NOMI_MESI[i] : `${i + 1}`, x, y, (spec && spec.celle) || ''));
    }
    return out;
  }
  const righe = (v) => (Array.isArray(v) && v.every(x => x && typeof x === 'object' && !Array.isArray(x)) ? v : null);
  if ((a === null || righe(a)) && (b === null || righe(b)) && (a || b)) {
    const tutte = [...(a || []), ...(b || [])];
    const chiave = CHIAVI_RIGA.find(k => tutte.some(r => r[k] !== undefined)) || null;
    const nome = (r, i) => (chiave && parte(r[chiave])) || `riga ${i + 1}`;
    const mappa = (v) => new Map((v || []).map((r, i) => [nome(r, i), r]));
    const ma = mappa(a);
    const mb = mappa(b);
    for (const k of new Set([...ma.keys(), ...mb.keys()])) {
      const x = ma.get(k);
      const y = mb.get(k);
      if (!x || !y) {
        const riga = x || y;
        const celle = Object.keys(riga).filter(c => c !== chiave && valore(riga[c]) !== null);
        // Una riga senza nessun valore (le cinque regioni ancora vuote di una
        // commessa nuova fatta dalla scheda) si dice per nome: prima finiva
        // come JSON intero, a video e a EcoTyna (revisione delle migliorie,
        // 11/10/2026). Quello che si registra non cambia.
        if (!celle.length) { out.push({ voce: k, riga: x ? 'tolta' : 'aggiunta', valori: 'nessuno' }); continue; }
        for (const c of celle) out.push(differenza(`${k}, ${nomeColonna(c)}`, x ? x[c] : null, y ? y[c] : null, unitaColonna(c)));
        continue;
      }
      for (const c of new Set([...Object.keys(x), ...Object.keys(y)])) {
        if (c === chiave) continue;
        if (diverso(x[c], y[c])) out.push(differenza(`${k}, ${nomeColonna(c)}`, x[c], y[c], unitaColonna(c)));
      }
    }
    return out;
  }
  const oggetto = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
  if ((a === null || oggetto(a)) && (b === null || oggetto(b)) && (a || b)) {
    for (const c of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
      const x = a ? a[c] : null;
      const y = b ? b[c] : null;
      if (diverso(x, y)) out.push({ voce: String(c).replace(/_/g, ' '), prima: valore(x), dopo: valore(y) });
    }
    return out;
  }
  if (diverso(a, b)) out.push({ voce: '', prima: valore(a), dopo: valore(b) });
  return out;
}

// La risposta di una scrittura senza niente da tracciare.
const NESSUNA_TRACCIA = { scritta: true, righe: 0 };
const motivoDi = (e) => String((e && e.response && e.response.data && e.response.data.error) || (e && e.data && e.data.error) || (e && e.message) || e || 'errore sconosciuto');

/**
 * Scrive in ModificaDato le righe di una o piu' scritture. Non lancia mai: il
 * dato e' gia' scritto, e una traccia che non riesce si dice, non annulla il
 * lavoro. Le righe vanno a blocchi di cento, per il limite di richieste.
 */
export async function registraModifiche(archivi, righe) {
  if (!righe || !righe.length) return { ...NESSUNA_TRACCIA };
  try {
    const registro = archivi.ModificaDato;
    if (righe.length === 1 || typeof registro.bulkCreate !== 'function') {
      for (const r of righe) await registro.create(r);
    } else {
      for (let i = 0; i < righe.length; i += 100) await registro.bulkCreate(righe.slice(i, i + 100));
    }
    return { scritta: true, righe: righe.length };
  } catch (e) {
    return { scritta: false, righe: righe.length, motivo: motivoDi(e) };
  }
}

/**
 * Crea (id vuoto) o modifica un record e ne registra le modifiche.
 *
 * Una modifica che non tocca nessun campo tracciato, o un archivio che non si
 * traccia, si scrive e basta: niente lettura in piu'. Altrimenti si rilegge il
 * record prima di scrivere, perche' il «prima» deve essere quello vero
 * dell'archivio, non quello che la pagina aveva in mano quando e' stata aperta.
 *
 * Restituisce { record, traccia: { scritta, righe, motivo? } }. Se la lettura o
 * la scrittura del dato non riescono si lancia, come prima: il dato non c'e'.
 */
export async function scriviTracciato(archivi, entita, id, patch, opzioni = {}) {
  const archivio = archivi[entita];
  const dati = patch || {};
  if (!entitaTracciata(entita) || (id && !toccaCampiTracciati(entita, dati))) {
    const record = id ? await archivio.update(id, dati) : await archivio.create(dati);
    return { record, traccia: { ...NESSUNA_TRACCIA } };
  }
  const prima = id ? await archivio.get(id) : null;
  const record = id ? await archivio.update(id, dati) : await archivio.create(dati);
  const dopo = id ? { ...(prima || {}), ...dati } : { ...dati, ...(record || {}) };
  const righe = righeDiModifica(entita, {
    record_id: id || (record && record.id) || '', prima, dopo, patch: id ? dati : null, operazione: id ? 'update' : 'create',
  }, opzioni);
  return { record, traccia: await registraModifiche(archivi, righe) };
}

/**
 * Cancella un record tracciato e registra quello che c'era. opzioni.prima
 * evita la rilettura quando il record e' gia' in mano (le cancellazioni a
 * gruppi della passiva); altrimenti si rilegge.
 */
export async function eliminaTracciato(archivi, entita, id, opzioni = {}) {
  const archivio = archivi[entita];
  if (!entitaTracciata(entita)) {
    await archivio.delete(id);
    return { record: null, traccia: { ...NESSUNA_TRACCIA } };
  }
  const prima = opzioni.prima || await archivio.get(id);
  await archivio.delete(id);
  const righe = righeDiModifica(entita, { record_id: id, prima, dopo: null, operazione: 'delete' }, opzioni);
  return { record: prima, traccia: await registraModifiche(archivi, righe) };
}

// Chi scrive a gruppi puo' passare opzioni.riprova, che avvolge ogni scrittura
// del dato (un blocco, una cancellazione): la passiva riprova da se' dopo il
// limite di richieste, un pezzo per volta, e un pezzo ripetuto non deve
// ripetere quelli gia' scritti.
const senzaRiprova = (fn) => fn();

/**
 * Crea tanti record insieme (il modello della passiva, la copia di un anno) e
 * registra le creazioni con una scrittura sola nel registro. A blocchi di
 * cinquanta, con bulkCreate quando c'e'. opzioni.unoPerUno crea un record per
 * volta anche se bulkCreate c'e': serve a chi ha bisogno dell'id di ognuno
 * dalla risposta di create (gli impianti della copia d'anno, a cui si
 * agganciano subito i collegamenti degli stoccaggi). Il registro resta a blocchi.
 *
 * Se una creazione non riesce si registrano quelle fatte e poi si lancia, come
 * in eliminaTracciati: i record creati ci sono davvero, e una copia d'anno
 * interrotta a meta' deve avere nello storico quello che ha scritto (revisione
 * delle migliorie, 11/10/2026).
 */
export async function creaTracciati(archivi, entita, righeNuove, opzioni = {}) {
  const archivio = archivi[entita];
  const riprova = typeof opzioni.riprova === 'function' ? opzioni.riprova : senzaRiprova;
  const creati = [];
  let errore = null;
  try {
    for (let i = 0; i < (righeNuove || []).length; i += 50) {
      const blocco = righeNuove.slice(i, i + 50);
      if (opzioni.unoPerUno !== true && typeof archivio.bulkCreate === 'function') {
        const fatti = await riprova(() => archivio.bulkCreate(blocco));
        blocco.forEach((r, j) => creati.push({ ...r, ...((Array.isArray(fatti) && fatti[j]) || {}) }));
      } else {
        for (const r of blocco) creati.push({ ...r, ...((await riprova(() => archivio.create(r))) || {}) });
      }
    }
  } catch (e) {
    errore = e;
  }
  if (!entitaTracciata(entita)) {
    if (errore) throw errore;
    return { record: creati, traccia: { ...NESSUNA_TRACCIA } };
  }
  const il = opzioni.il || new Date().toISOString();
  const righe = creati.flatMap(r => righeDiModifica(entita, { record_id: r.id || '', prima: null, dopo: r, operazione: 'create' }, { ...opzioni, il }));
  const traccia = await registraModifiche(archivi, righe);
  if (errore) throw errore;
  return { record: creati, traccia };
}

/**
 * Cancella tanti record gia' in mano (le voci che un modello sostituisce) e
 * registra che cosa c'era con una scrittura sola nel registro. Se una
 * cancellazione non riesce si registrano quelle fatte e poi si lancia: le
 * cancellate sono sparite davvero, e lo storico lo deve sapere.
 */
export async function eliminaTracciati(archivi, entita, records, opzioni = {}) {
  const archivio = archivi[entita];
  const riprova = typeof opzioni.riprova === 'function' ? opzioni.riprova : senzaRiprova;
  const il = opzioni.il || new Date().toISOString();
  const tolti = [];
  let errore = null;
  for (const r of records || []) {
    try {
      await riprova(() => archivio.delete(r.id));
      tolti.push(r);
    } catch (e) {
      errore = e;
      break;
    }
  }
  const righe = entitaTracciata(entita)
    ? tolti.flatMap(r => righeDiModifica(entita, { record_id: r.id || '', prima: r, dopo: null, operazione: 'delete' }, { ...opzioni, il }))
    : [];
  const traccia = await registraModifiche(archivi, righe);
  if (errore) throw errore;
  return { record: tolti, traccia };
}

/** Somma le tracce di piu' scritture: scritta solo se tutte lo sono, col primo motivo. */
export function unisciTracce(tracce) {
  const elenco = (tracce || []).filter(Boolean);
  const fallita = elenco.find(t => t.scritta === false);
  return {
    scritta: !fallita,
    righe: elenco.reduce((s, t) => s + (Number(t.righe) || 0), 0),
    ...(fallita ? { motivo: fallita.motivo } : {}),
  };
}

/**
 * La frase da dire quando il dato e' salvato ma la traccia no; null se e'
 * andato tutto bene. Accetta la traccia o la risposta di una scrittura.
 */
export function notaTraccia(esito) {
  const t = esito && esito.traccia ? esito.traccia : esito;
  if (!t || t.scritta !== false) return null;
  return `Il dato è salvato, ma la modifica non è finita nello storico delle modifiche${t.motivo ? `: ${t.motivo}` : ''}.`;
}
