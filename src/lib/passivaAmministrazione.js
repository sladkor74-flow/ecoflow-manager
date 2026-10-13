// IL FOGLIO DELLA PASSIVA NEL «FORMAT AMMINISTRAZIONE».
//
// Qui c'e' solo la COSTRUZIONE del foglio, senza Excel ne' PDF: le prove la
// caricano senza tirarsi dietro le librerie dei file. Chi scrive i file e'
// src/lib/passivaAmministrazioneExcel.js e src/lib/passivaAmministrazionePdf.js.
//
// Il foglio vero dell'amministrazione (passiva\Fatturazione passiva Ecotyre
// (settembre).xlsx) e' un unico foglio con un blocco per canale - RETE, ACI -
// e dentro ogni blocco tre tabelle:
//   RACCOGLITORI          chi raccoglie, con le sue voci e il suo prezzo;
//   IMPIANTI \ STOCCAGGI  chi tratta o stocca, con le sue voci;
//   TRASPORTO (secondarie) un viaggio per riga.
//
// LE DUE TABELLE HANNO DUE FORME DIVERSE, e sono entrambe nel loro file:
//   RETE  a DUE LIVELLI: il soggetto in grassetto col suo totale, e sotto le sue
//         voci rientrate (LOGISTICA & PNEUMATICI, e sotto Napoli, Salerno,
//         Avellino, Caserta);
//   ACI   PIATTA: una riga per voce, con l'etichetta «NAPPI SUD - (Campania)», e
//         negli impianti DUE colonne di prezzo, stoccaggio e trattamento.
// Si riproducono entrambe: e' il foglio su cui l'amministrazione lavora davvero.
//
// LE VOCI SONO UN MODELLO FISSO, E SI VEDONO SEMPRE ANCHE A ZERO.
//
// Scelta dell'utente, 03/10/2026, fra le opzioni che gli avevo proposto: modello
// fisso E modificabile da lui. Il perche' si legge nel suo foglio di settembre:
// sotto LOGISTICA & PNEUMATICI ci sono quattro righe - Napoli 68, Salerno 68,
// Avellino 71, Caserta 72 - e due di quelle sono a zero. Tenerle vuol dire che il
// foglio e' identico ogni mese e che un conferimento comparso dove prima non ce
// n'erano si vede a colpo d'occhio; generarle solo quando c'e' qualcosa vuol dire
// un foglio che cambia forma ogni mese.
//
// Le voci stanno nell'archivio VocePassivaAmministrazione, che l'utente corregge
// quando cambia un accordo. Le QUANTITA' no: quelle le mette il gestionale dai
// movimenti del mese, cioe' da quello che calcolaPassiva ha gia' calcolato.

import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';
import { getRegioneFromProvincia } from '@/lib/regioneMap';
import { tariffaValeIl, tariffaNonDisattivata } from '@/lib/validitaTariffa';

const n2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const n3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
const testo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const chiave = (v) => testo(v).toLowerCase();

// I NOMI DEI FORNITORI NON SI CONFRONTANO LETTERA PER LETTERA.
//
// Lo stesso soggetto e' scritto in modi diversi a seconda di dove si legge:
// «Gatim» fra gli impianti e «GATIM S.R.L.» fra i raccoglitori, «T.R.S. SRL» e
// «TRS SRL», «Nappi Sud Srl A Socio Unico» e «NAPPI SUD SRL». Nel foglio
// dell'amministrazione sono scritti in un terzo modo ancora. Con il confronto
// esatto il modello non si agganciava e tutti i fornitori finivano fra i non
// previsti, cioe' il foglio usciva a zero: si usa la regola che il gestionale
// usa da sempre per riconoscere una ragione sociale.
const nome = (v) => normalizzaRagioneSociale(testo(v));

export const EER_PFU = 160103;

/**
 * I viaggi che si PAGANO su una riga della passiva.
 *
 * Su una tratta a viaggio, un viaggio misto porta formulari di tutti e due i
 * canali e ciascun canale ne paga solo la sua quota di chili: la passiva la
 * calcola in viaggi_quota. Dove la quota non c'e' (tariffa a tonnellata, o riga
 * che non viene dal trasporto) si pagano i viaggi contati.
 */
export function viaggiPagati(r) {
  // La quota NON arrotondata, quando la passiva la da' (11/10/2026): il foglio
  // Excel la moltiplica per il prezzo con =ROUND(F*G;2) e rifa' l'importo della
  // passiva al centesimo. Con la quota arrotondata a due decimali la riga di
  // rete di 707,69 diventava 708,00 al primo ricalcolo.
  const esatta = r && r.viaggi_quota_esatta;
  if (esatta !== null && esatta !== undefined && Number.isFinite(Number(esatta))) return Number(esatta);
  const quota = r && r.viaggi_quota;
  if (quota === null || quota === undefined) return Number(r && r.viaggi) || 0;
  return Number(quota) || 0;
}

/**
 * I VIAGGI PAGATI DI UNA RIGA DEL TRASPORTO A VIAGGIO: l'importo della passiva
 * diviso il prezzo (chiusura dell'audit, 11/10/2026).
 *
 * Il foglio Excel rifa' il totale con =ROUND(F*G;2). Con la quota dei chili in G
 * la riga di rete tornava, ma quella ACI no: la passiva paga all'ACI il resto
 * dei viaggi misti (i viaggi veri meno la rete arrotondata), e al mezzo
 * centesimo il resto non e' il prezzo per la quota arrotondato. Tratta a 300
 * €/viaggio, un viaggio di sola ACI e uno misto con 14.500 kg di rete e 1.500 di
 * ACI: la passiva paga 328,12, G valeva 1,09375 e Excel ricalcolando faceva
 * 328,13, cioe' 600,01 per due viaggi da 300. Con importo diviso prezzo G e'
 * 1,0937333: si legge 1,09 come prima, Excel rifa' 328,12 sempre, e le righe di
 * rete e ACI della stessa tratta sommano i viaggi veri. La quota dei chili resta
 * scritta nella nota della riga. Su una riga interna (importo zero perche' non si
 * fattura) o senza prezzo restano i viaggi di viaggiPagati.
 */
export function viaggiPagatiTrasporto(t, gruppo = null) {
  const aViaggio = String((t && t.unita_misura) || '').trim() === '€/viaggio';
  const prezzo = Number(t && t.tariffa_valore);
  const importo = Number(t && t.importo);
  const interno = !!(gruppo && gruppo.interno);
  if (aViaggio && !interno && Number.isFinite(prezzo) && prezzo > 0 && Number.isFinite(importo) && importo > 0) return importo / prezzo;
  return viaggiPagati(t);
}

/** Il totale di una riga: a tonnellata o a viaggio, come dice l'unita'. */
export function importoVoce(prezzo, unita, tonnellate, viaggi) {
  const p = Number(prezzo) || 0;
  if (unita === 'euro_viaggio') return n2(p * (Number(viaggi) || 0));
  return n2(p * (Number(tonnellate) || 0));
}

/**
 * Le voci di un blocco, ordinate come vanno stampate: prima per ordine, poi per
 * nome del soggetto, poi per nome della voce.
 *
 * Le voci SENZA SOGGETTO si buttano via: in archivio ce ne sono, nate da una
 * proposta automatica sbagliata del 03/10/2026, e nel foglio comparivano come
 * righe vuote a zero sotto l'intestazione. Una voce senza soggetto non puo'
 * agganciare nessun movimento, quindi non e' una voce.
 */
export function vociOrdinate(voci, canale, blocco) {
  return (voci || [])
    .filter(v => v && v.attiva !== false && v.canale === canale && v.blocco === blocco && testo(v.soggetto))
    .slice()
    .sort((a, b) => (Number(a.ordine) || 0) - (Number(b.ordine) || 0)
      || testo(a.soggetto).localeCompare(testo(b.soggetto), 'it')
      || testo(a.voce).localeCompare(testo(b.voce), 'it'));
}

/** Il criterio di una voce, letto dal testo JSON dell'archivio. */
export function criterioDi(voce) {
  try {
    const c = voce && voce.criterio_json ? JSON.parse(voce.criterio_json) : null;
    if (!c || typeof c !== 'object') return null;
    // Un criterio vuoto non e' un criterio: la voce prende quello che resta.
    const pieno = ['regione', 'provincia', 'destinazione', 'provenienza', 'prestazione']
      .some(k => testo(c[k])) || (Array.isArray(c.classi) && c.classi.length);
    return pieno ? c : null;
  } catch {
    return null;
  }
}

// La prestazione, nelle righe degli impianti, si chiama TRATTAMENTO o
// CONFERIMENTO_STOCCAGGIO. Nel foglio dell'amministrazione si legge «stoccaggio»
// o «trattamento»: si accettano le due scritture.
const PRESTAZIONI = {
  trattamento: 'TRATTAMENTO',
  stoccaggio: 'CONFERIMENTO_STOCCAGGIO',
  conferimento_stoccaggio: 'CONFERIMENTO_STOCCAGGIO',
};
const prestazioneChiave = (v) => PRESTAZIONI[chiave(v).replace(/\s+/g, '_')] || chiave(v).toUpperCase();

/**
 * Vero se la riga del mese appartiene a questa voce.
 *
 * L'aggancio e' per SOGGETTO (lo fa chi chiama) e, dentro il soggetto, per il
 * criterio scritto sulla voce: regione, provincia, destinazione, provenienza
 * (primaria, secondaria, extra), prestazione (trattamento o stoccaggio) e
 * classi. Il criterio sulle classi combacia se la riga ha ALMENO UNA delle
 * classi elencate: una riga puo' portarne piu' di una ("P,M") e la voce «classi
 * P+M» le vuole insieme.
 */
export function rigaDellaVoce(criterio, r) {
  if (!criterio) return false;
  // La regione, se sulla riga non c'e' scritta, si ricava dalla provincia: e' la
  // stessa regola che usa il calcolo della passiva per scegliere le tariffe, e
  // serve perche' una riga senza regione non faccia sparire i chili dal foglio.
  if (criterio.regione) {
    const reg = testo(r.regione) || getRegioneFromProvincia(r.provincia) || '';
    if (chiave(reg) !== chiave(criterio.regione)) return false;
  }
  if (criterio.provincia && chiave(r.provincia) !== chiave(criterio.provincia)) return false;
  // La destinazione e' una ragione sociale: si confronta normalizzata, e in
  // subordine per pezzo di nome, perche' nel foglio e' scritta «conferimenti su
  // Gatim» e nei movimenti e' «GATIM S.R.L.».
  if (criterio.destinazione) {
    const a = chiave(r.destinazione), b = chiave(criterio.destinazione);
    const uguali = nome(r.destinazione) && nome(r.destinazione) === nome(criterio.destinazione);
    if (!uguali && (!a || !b || (!a.includes(b) && !b.includes(a)))) return false;
  }
  if (criterio.provenienza && chiave(r.provenienza) !== chiave(criterio.provenienza)) return false;
  if (criterio.prestazione && prestazioneChiave(r.prestazione) !== prestazioneChiave(criterio.prestazione)) return false;
  if (Array.isArray(criterio.classi) && criterio.classi.length) {
    const sue = testo(r.classe).split(/[,+/]/).map(x => chiave(x)).filter(Boolean);
    if (!criterio.classi.some(c => sue.includes(chiave(c)))) return false;
  }
  return true;
}

// IL PREZZO NON STA SCRITTO NEL FOGLIO: STA NEL TARIFFARIO.
//
// L'utente, 03/10/2026: «gli altri prezzi li dovresti gia' avere nel tariffario
// 2026 anche perche' hai letto tutti i loro contratti». Giusto: un prezzo
// ricopiato in due posti e' un prezzo che prima o poi diverge, e il numero che
// fa fede e' quello che il gestionale applica davvero quando calcola la passiva.
//
// Percio' il prezzo di una voce si cerca in quest'ordine:
//   1. QUELLO CHE IL MESE HA APPLICATO: la tariffa che sta sulle righe dei
//      movimenti. Cosi' il foglio dice esattamente quello che dice il modulo
//      della fatturazione passiva a video - non possono divergere.
//   2. IL TARIFFARIO: per le righe a zero, dove movimenti non ce ne sono, si
//      legge la tariffa in vigore in quel mese.
//   3. IL PREZZO SCRITTO SULLA VOCE: solo se le altre due non dicono niente, e
//      in quel caso il foglio lo dichiara nella colonna delle note.
//
// Le unita' di misura del tariffario sono tre. Il foglio ha una colonna sola di
// prezzo, quindi: euro a tonnellata e euro al chilo diventano entrambi un prezzo
// a tonnellata (0,090 euro/kg sono 90 euro/t) e il conto torna uguale; euro a
// viaggio resta a viaggio e si moltiplica per i viaggi.
const PRESTAZIONI_BLOCCO = {
  raccoglitori: ['RACCOLTA'],
  impianti: ['TRATTAMENTO', 'CONFERIMENTO_STOCCAGGIO'],
};

// Che cosa dice il calcolo della passiva su una riga, letto dalla sua nota:
// sono le tre ragioni per cui un importo puo' essere zero.
const rigaInterna = (r) => /interno/i.test(String(r && r.note || '')) || (r && r.interno === true);
const rigaCompresa = (r) => /compreso/i.test(String(r && r.note || '')) || (r && r.compreso_nella_raccolta === true);
// Una riga con un'unita' di misura che la passiva non sa leggere vale zero come
// una senza tariffa (11/10/2026): il suo prezzo non e' un prezzo da scrivere.
const rigaSenzaTariffa = (r) => /senza tariffa|sconosciuta/i.test(String(r && r.note || ''));

// Le unita' del tariffario che il foglio sa trasformare in una colonna di prezzo.
const UNITA_TARIFFARIO = ['€/t', '€/kg', '€/viaggio'];

/**
 * Vero se la tariffa vale nel giorno dato. E' la regola unica della fattura,
 * della passiva e della lista dell'anno nuovo (validitaTariffa, 11/10/2026): una
 * tariffa 'non_attivo' non vale mai. Senza un giorno (il mese non si e' potuto
 * leggere) conta solo lo stato, come prima.
 */
const tariffaInVigore = (t, giorno) => (giorno ? tariffaValeIl(t, giorno) : tariffaNonDisattivata(t));

/**
 * La tariffa del tariffario che spetta a una voce: stesso fornitore, stessa
 * prestazione, stesso canale, e i criteri della voce.
 *
 * Fra piu' tariffe possibili vince la piu' specifica, con la stessa scala che usa
 * il calcolo della passiva: destinazione, poi provincia, poi regione, poi quella
 * generica. Se restano in ballo due tariffe diverse non si indovina: si lascia
 * decidere al prezzo scritto sulla voce e il foglio lo dice.
 */
export function tariffaDellaVoce(tariffe, voce, canale, blocco, giorno) {
  const soggetto = nome(voce && voce.soggetto);
  if (!soggetto) return null;
  const criterio = criterioDi(voce) || {};
  const prestazioni = criterio.prestazione
    ? [prestazioneChiave(criterio.prestazione)]
    : (PRESTAZIONI_BLOCCO[blocco] || []);
  const candidate = (tariffe || []).filter(t => t
    && String(t.direzione || 'PASSIVA') === 'PASSIVA'
    && UNITA_TARIFFARIO.includes(String(t.unita_misura || '').trim())
    && nome(t.fornitore_nome) === soggetto
    && prestazioni.includes(String(t.prestazione || ''))
    && ['TUTTE', canale].includes(String(t.tipologia || 'TUTTE'))
    && tariffaInVigore(t, giorno)
    // La classe: una tariffa senza classe vale per tutte; con la classe vale solo
    // se e' una di quelle che la voce raccoglie.
    && (!testo(t.classe_materiale) || !Array.isArray(criterio.classi) || !criterio.classi.length
      || criterio.classi.some(c => chiave(c) === chiave(t.classe_materiale)))
    && (!testo(t.destinazione) || (criterio.destinazione && nome(t.destinazione) === nome(criterio.destinazione)))
    && (!testo(t.provincia) || (criterio.provincia && chiave(t.provincia) === chiave(criterio.provincia)))
    && (!testo(t.regione) || (criterio.regione && chiave(t.regione) === chiave(criterio.regione))));
  if (!candidate.length) return null;
  const peso = (t) => (testo(t.destinazione) ? 8 : 0) + (testo(t.provincia) ? 4 : 0)
    + (testo(t.regione) ? 2 : 0) + (testo(t.classe_materiale) ? 1 : 0);
  const migliori = candidate.filter(t => peso(t) === Math.max(...candidate.map(peso)));
  const valori = [...new Set(migliori.map(t => `${Number(t.valore) || 0}|${t.unita_misura || ''}`))];
  return valori.length === 1 ? migliori[0] : null;
}

/** Il prezzo di una riga di trasporto della passiva: zero se la sua unita' non si sa leggere. */
const prezzoTrasporto = (t) => (UNITA_TARIFFARIO.includes(String((t && t.unita_misura) || '').trim())
  ? prezzoDaTariffa(t.tariffa_valore, t.unita_misura)
  : { prezzo: 0, unita_misura: 'euro_tonnellata' });

/** Il prezzo a tonnellata (o a viaggio) e l'unita' del foglio, da una tariffa. */
function prezzoDaTariffa(valore, unita) {
  const v = Number(valore) || 0;
  if (unita === '€/viaggio' || unita === 'euro_viaggio') return { prezzo: v, unita_misura: 'euro_viaggio' };
  // 0,090 euro al chilo sono 90 euro a tonnellata: il foglio ha una colonna sola.
  if (unita === '€/kg') return { prezzo: Math.round(v * 1000 * 10000) / 10000, unita_misura: 'euro_tonnellata' };
  return { prezzo: v, unita_misura: 'euro_tonnellata' };
}

/**
 * Il prezzo di una voce e da dove viene. Torna { prezzo, unita_misura, fonte,
 * importo } - `importo` solo quando il prezzo non basta a spiegarlo, cioe'
 * quando le righe della voce hanno tariffe diverse fra loro.
 */
export function prezzoDellaVoce(voce, righe, tariffe, canale, blocco, giorno) {
  const tutte = righe || [];
  // Il calcolo della passiva scrive sulla riga perche' un importo e' zero, e
  // sono tre cose diverse che non si possono confondere:
  //   INTERNO           l'ha fatto SMOCO: a se stessi non si fattura;
  //   COMPRESO          il trattamento e' dentro il prezzo unico della raccolta
  //                     (Green Tyre sull'ACI, 225 euro): fatturarlo di nuovo
  //                     vorrebbe dire pagarlo due volte;
  //   SENZA TARIFFA     nel tariffario manca, e questo si' va sistemato.
  // Prima dicevo «controlla il tariffario» anche sulle righe di SMOCO, che sono
  // giuste: un avviso che grida al torto fa smettere di guardare gli avvisi.
  // Una riga «porta una tariffa» solo se il campo c'e' davvero: le righe di
  // riepilogo di un fornitore senza dettaglio non ce l'hanno, e prenderle per
  // tariffe da zero euro vorrebbe dire azzerargli la fattura.
  const applicate = tutte.filter(r => r && r.tariffa_valore !== undefined && r.tariffa_valore !== null
    && !rigaInterna(r) && !rigaCompresa(r) && !rigaSenzaTariffa(r));
  if (applicate.length) {
    const distinte = [...new Set(applicate.map(r => `${Number(r.tariffa_valore) || 0}|${r.unita_misura || ''}`))];
    if (distinte.length === 1) {
      return { ...prezzoDaTariffa(applicate[0].tariffa_valore, applicate[0].unita_misura), fonte: 'movimenti' };
    }
    // Tariffe diverse sulla stessa voce: il prezzo non si puo' scrivere in una
    // cella, ma l'importo e' quello che il calcolo ha fatto, riga per riga.
    return {
      prezzo: null,
      unita_misura: 'euro_tonnellata',
      fonte: 'vari',
      importo: n2(applicate.reduce((s, r) => s + (Number(r.importo) || 0), 0)),
    };
  }
  // Niente da fatturare per come e' fatto l'accordo: il prezzo e' zero e non si
  // va a cercare altrove, altrimenti il tariffario o il modello rimetterebbero
  // in fattura quello che il calcolo ha deciso di non pagare.
  if (tutte.length && tutte.every(r => rigaInterna(r) || rigaCompresa(r))) {
    return {
      prezzo: 0,
      unita_misura: 'euro_tonnellata',
      fonte: tutte.some(rigaCompresa) ? 'compreso' : 'interno',
    };
  }
  const t = tariffaDellaVoce(tariffe, voce, canale, blocco, giorno);
  if (t) return { ...prezzoDaTariffa(t.valore, t.unita_misura), fonte: 'tariffario' };
  return {
    prezzo: Number(voce.prezzo) || 0,
    unita_misura: voce.unita_misura || 'euro_tonnellata',
    fonte: 'modello',
  };
}

/**
 * I CHILI DEL MESE SI ASSEGNANO, NON SI FILTRANO.
 *
 * Ogni riga del mese va a UNA sola voce: la prima, nell'ordine del foglio, il cui
 * criterio la riconosce; quello che nessun criterio riconosce va alla voce senza
 * criterio del soggetto - nel foglio dell'amministrazione e' la riga unica dei
 * fornitori con un prezzo solo - e se nemmeno quella c'e' resta fuori e si
 * dichiara.
 *
 * Perche' assegnare e non filtrare: T-CYCLE ha quattro voci, tre con le classi e
 * una «STOCK (fatturato)» senza criterio. Filtrando, ogni voce guardava tutte le
 * righe del fornitore e la voce senza criterio riprendeva anche i chili delle
 * altre tre: il totale del fornitore usciva doppio. Assegnando, la somma delle
 * voci fa sempre esattamente il totale del fornitore nel mese.
 *
 * QUALE VOCE, QUANDO DUE LA RICONOSCONO (chiusura dell'audit, 11/10/2026). Una
 * raccolta di Logistica da Napoli scaricata a Nappi Sud la riconoscono sia
 * «Campania - NAPOLI» (provincia NA, 68) sia «conferiti c/o Nappi Sud»
 * (destinazione, 71). La passiva sceglie il prezzo con la cascata destinazione,
 * provincia, regione, e la paga 71; il foglio la dava alla prima voce in ordine
 * di stampa, NAPOLI, con prezzo 71 - o «vari» se nel mese c'erano anche righe a
 * 68 - e lasciava a zero la voce di Nappi Sud. Ora, se la riga dice quale
 * tariffa la passiva ha scelto (tariffa_id) e una delle voci che la riconoscono
 * ha proprio quella tariffa (tariffaDi, cioe' tariffaDellaVoce), la riga va li'.
 * Altrimenti, come prima, alla prima nell'ordine del foglio.
 *
 * @param tariffaDi facoltativo: voce -> la tariffa del tariffario che le spetta
 */
export function assegnaRighe(vociSoggetto, righeSoggetto, tariffaDi = null) {
  const conCriterio = vociSoggetto.map(v => ({ voce: v, criterio: criterioDi(v) })).filter(x => x.criterio);
  const senzaCriterio = vociSoggetto.find(v => !criterioDi(v)) || null;
  const quote = new Map(vociSoggetto.map(v => [v, { tonnellate: 0, viaggi: 0, viaggi_pagati: 0, righe: [] }]));
  const fuori = [];
  // La tariffa di ogni voce si cerca una volta sola, e solo se serve.
  const idVoce = new Map();
  const idDi = (v) => {
    if (!idVoce.has(v)) {
      const t = tariffaDi ? tariffaDi(v) : null;
      idVoce.set(v, t && t.id ? String(t.id) : '');
    }
    return idVoce.get(v);
  };
  for (const r of righeSoggetto || []) {
    const candidate = conCriterio.filter(x => rigaDellaVoce(x.criterio, r));
    const tid = String((r && r.tariffa_id) || '');
    const perTariffa = tid && candidate.length > 1 ? candidate.find(x => idDi(x.voce) === tid) : null;
    const trovata = perTariffa || candidate[0];
    const dove = trovata ? trovata.voce : senzaCriterio;
    if (!dove) { fuori.push(r); continue; }
    const q = quote.get(dove);
    q.tonnellate += Number(r.tonnellate) || 0;
    q.viaggi += Number(r.viaggi) || 0;
    q.viaggi_pagati += viaggiPagati(r);
    // Le righe si tengono, non si contano soltanto: da loro si legge la tariffa
    // che il mese ha applicato davvero.
    q.righe.push(r);
  }
  for (const q of quote.values()) q.tonnellate = n3(q.tonnellate);
  return { quote, fuori };
}

/** Come si descrive a parole cio' che e' rimasto fuori, per dirlo nel foglio. */
export function descriviFuori(righe) {
  const pezzi = (righe || []).map(r => [
    testo(r.classe) && testo(r.classe) !== '—' ? `classe ${testo(r.classe)}` : '',
    testo(r.provenienza) && testo(r.provenienza) !== '—' ? `da ${testo(r.provenienza)}` : '',
    testo(r.provincia) && testo(r.provincia) !== '—' ? testo(r.provincia) : '',
    testo(r.destinazione) && testo(r.destinazione) !== '—' ? `verso ${testo(r.destinazione)}` : '',
  ].filter(Boolean).join(' '));
  return [...new Set(pezzi.filter(Boolean))].join('; ');
}

// ─── IL SURPLUS SULLE TARIFFE (13/10/2026) ───
//
// Richiesta dell'utente del 12/10/2026: accanto alla tariffa un eventuale
// surplus in €/t con le sue date, e in fattura «una riga con l'importo standard
// ed una per il surplus (sempre riferito alle stesse tonnellate raccolte o
// trattate nel mese)». Il primo e' il Fuel Surcharge del consorzio Ecotyre, +5
// €/t a tutti i raccoglitori dal 01/10/2026 al 31/12/2026.
//
// Il surplus NON e' una voce del modello: e' una riga che il foglio aggiunge da
// se', dal calcolo della passiva, sotto le voci del soggetto. Il numero e'
// quello del calcolo (una riga per fornitore e per surplus, t x €/t arrotondato
// una volta, come il fornitore la scrive in fattura): il foglio non lo rifa'.
// Le tonnellate della riga sono le stesse del mese e NON si sommano una seconda
// volta: il totale del soggetto e del blocco in tonnellate resta quello delle
// voci, quello in euro comprende il surplus. Nel periodo di validita' la riga
// c'e' anche a zero per i soggetti del modello che nel mese non hanno portato
// niente, come le voci: il foglio resta lo stesso ogni mese. Un fornitore
// interno non la riceve: a se stessi non si fattura.

// Le prestazioni di un blocco, come le scrive il calcolo sulle righe del surplus.
const PRESTAZIONI_SURPLUS = {
  raccoglitori: ['RACCOLTA'],
  impianti: ['TRATTAMENTO', 'CONFERIMENTO_STOCCAGGIO'],
};
// Negli impianti dell'ACI il prezzo va nella colonna della prestazione.
const COLONNA_SURPLUS = { CONFERIMENTO_STOCCAGGIO: 'stoccaggio', TRATTAMENTO: 'trattamento' };
const COLONNA_PRESTAZIONE = { stoccaggio: 'CONFERIMENTO_STOCCAGGIO', trattamento: 'TRATTAMENTO' };
const giornoIt = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10).split('-').reverse().join('/') : '');

/** «dal 01/10/2026 al 31/12/2026», dai giorni che il calcolo scrive sulla riga. */
export function periodoDelSurplus(s) {
  const dal = giornoIt(s && s.dal);
  const al = giornoIt(s && s.al);
  if (dal && al) return `dal ${dal} al ${al}`;
  if (dal) return `dal ${dal}`;
  if (al) return `fino al ${al}`;
  return '';
}

/** La nota della riga del surplus: da dove viene, quando vale, e che le tonnellate non si sommano. */
export function notaDelSurplus(s) {
  const testa = [testo(s && s.origine), periodoDelSurplus(s)].filter(Boolean).join(', ');
  return `${testa ? `${testa}: ` : ''}surplus sulle stesse tonnellate del mese, che non si sommano una seconda volta`;
}

// Le tonnellate all'italiana dentro una frase: due decimali, tre se i chili non
// sono tondi (come il calcolo della passiva).
const tTesto = (t) => {
  const kg = Math.round((Number(t) || 0) * 1000);
  const [i, d] = (kg / 1000).toFixed(kg % 10 === 0 ? 2 : 3).split('.');
  return `${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`;
};

// IL FOGLIO NON E' IL CALCOLO, SULLE TONNELLATE SENZA TARIFFA (revisione del
// 13/10/2026). Il calcolo della passiva lascia a zero la riga standard di un
// movimento senza la tariffa del mese, e la riga del surplus lo dice: «il
// surplus c'è, la riga standard no». Il foglio pero' quelle tonnellate le
// prezza lo stesso quando la voce un prezzo ce l'ha: dal modello (13 t x 70 =
// 910 €, «il prezzo arriva dal modello»), dal tariffario per la voce, o con la
// tariffa degli altri movimenti della stessa voce (GAMMA: Napoli a 70, Salerno
// senza tariffa, la voce prende tutte le 6 t a 70). Nello stesso documento la
// riga standard era pagata e quella del surplus diceva che non c'era. Qui si
// dice quello che il foglio fa davvero; la frase del calcolo resta quando nel
// foglio la riga standard e' davvero a zero (prezzo zero, tariffe diverse, o
// chili che nessuna voce prende).
const PREZZO_SENZA_TARIFFA = {
  modello: 'il prezzo del modello',
  tariffario: 'il prezzo che il tariffario dà alla voce',
  movimenti: 'la tariffa degli altri movimenti della voce',
};
const rigaStandardSenzaTariffa = (r) => /senza tariffa/i.test(String(r && r.note || '')) && !rigaInterna(r) && !rigaCompresa(r);

/**
 * Quanto delle tonnellate senza tariffa di una prestazione il foglio prezza lo
 * stesso: { tutte, prezzate, fonti }. `voci` e' l'elenco { righe, fonte,
 * prezzata } delle voci del soggetto, `fuori` le righe che nessuna voce prende.
 */
function coperturaSenzaTariffa(blocco, prestazione, voci, fuori) {
  let tutte = 0;
  let prezzate = 0;
  const fonti = [];
  const conta = (r, voce) => {
    if (!rigaStandardSenzaTariffa(r)) return;
    const p = blocco === 'raccoglitori' ? 'RACCOLTA' : prestazioneChiave(r.prestazione);
    if (p !== prestazione) return;
    const t = Number(r.tonnellate) || 0;
    tutte += t;
    if (voce && voce.prezzata) {
      prezzate += t;
      if (!fonti.includes(voce.fonte)) fonti.push(voce.fonte);
    }
  };
  for (const v of voci || []) for (const r of v.righe || []) conta(r, v);
  for (const r of fuori || []) conta(r, null);
  return { tutte: n3(tutte), prezzate: n3(prezzate), fonti };
}

/**
 * L'avviso della riga del surplus nel foglio: quello del calcolo, se nel foglio
 * la riga standard di quelle tonnellate e' a zero; altrimenti quello che il
 * foglio fa davvero, con le stesse tonnellate del calcolo.
 */
export function avvisoSurplusDelFoglio(s, copertura) {
  const avviso = testo(s && s.avviso);
  if (!avviso || !copertura || !(copertura.prezzate > 0)) return avviso;
  const senza = n3(s.tonnellate_senza_tariffa);
  const su = senza > 0 && senza < n3(s.tonnellate) ? ` su ${tTesto(senza)} t delle ${tTesto(s.tonnellate)}` : '';
  const fonte = copertura.fonti.map(f => PREZZO_SENZA_TARIFFA[f]).filter(Boolean).join(' e ');
  const parte = copertura.prezzate < copertura.tutte
    ? ` su ${tTesto(copertura.prezzate)} t delle ${tTesto(copertura.tutte)} senza tariffa, le altre no`
    : '';
  return `Tariffa del mese mancante${su}: nel foglio la riga standard ha ${fonte}${parte}; il surplus c'è lo stesso.`;
}

/**
 * Una riga 'surplus' del foglio: dal calcolo, oppure a zero per un soggetto senza movimenti.
 * Se il fornitore non ha la tariffa del mese il calcolo lo dice sulla riga
 * (s.avviso, risposta dell'utente del 13/10/2026): l'avviso va in testa alla
 * nota, che il foglio Excel e il PDF scrivono, e resta anche nel suo campo.
 * Chi costruisce il blocco puo' passare l'avviso del foglio (avvisoSurplusDelFoglio).
 */
function rigaSurplus(soggetto, s, tonnellate, totale, avvisoDelFoglio = null) {
  const prestazione = testo(s.prestazione).toUpperCase();
  const avviso = avvisoDelFoglio !== null ? testo(avvisoDelFoglio) : testo(s.avviso);
  const nota = notaDelSurplus(s);
  return {
    tipo: 'surplus',
    soggetto,
    voce: testo(s.nome) || 'Surplus',
    nome: testo(s.nome) || 'Surplus',
    origine: testo(s.origine),
    surplus_id: testo(s.surplus_id),
    prestazione,
    tonnellate: n3(tonnellate),
    viaggi: 0,
    prezzo: Number(s.euro_t) || 0,
    unita_misura: 'euro_tonnellata',
    colonna_prezzo: COLONNA_SURPLUS[prestazione] || '',
    totale: n2(totale),
    dal: testo(s.dal),
    al: testo(s.al),
    etichetta: testo(s.etichetta),
    note: avviso ? `${avviso} ${nota.charAt(0).toUpperCase()}${nota.slice(1)}` : nota,
    ...(avviso ? { avviso, tonnellate_senza_tariffa: n3(s.tonnellate_senza_tariffa) } : {}),
  };
}

/**
 * Le righe del surplus dei gruppi del calcolo, per soggetto (nome normalizzato,
 * come le righe del mese): { nome -> [righe del surplus del calcolo] }.
 */
export function surplusPerSoggetto(gruppi) {
  const fuori = new Map();
  for (const g of gruppi || []) {
    if (!g || g.interno === true || !Array.isArray(g.surplus) || !g.surplus.length) continue;
    const k = nome(g.fornitore);
    if (!fuori.has(k)) fuori.set(k, []);
    fuori.get(k).push(...g.surplus);
  }
  return fuori;
}

/**
 * I soggetti interni del canale: quelli che il calcolo dice interni in uno
 * qualunque dei tre blocchi, quelli dei surplus del mese, e - per un soggetto
 * che nel mese non ha movimenti nel canale, e quindi il calcolo non nomina - le
 * voci del modello che lo dicono nella nota («Interno: non fatturato.»).
 */
export function soggettiInterni(passiva, voci) {
  const fuori = new Set();
  for (const blocco of ['raccoglitori', 'impianti_stoccaggi', 'trasporti_secondaria']) {
    for (const g of (passiva && passiva[blocco]) || []) if (g && g.interno === true) fuori.add(nome(g.fornitore));
  }
  for (const s of (passiva && passiva.surplus_del_mese) || []) {
    for (const f of (s && s.interni) || []) fuori.add(nome(f.fornitore));
  }
  const perSoggetto = new Map();
  for (const v of voci || []) {
    if (!v || !testo(v.soggetto)) continue;
    const k = nome(v.soggetto);
    if (!perSoggetto.has(k)) perSoggetto.set(k, []);
    perSoggetto.get(k).push(v);
  }
  for (const [k, sue] of perSoggetto) {
    if (sue.every(v => /\binterno\b/i.test(testo(v.note)) && !(Number(v.prezzo) > 0))) fuori.add(k);
  }
  fuori.delete('');
  return fuori;
}

/** Le prestazioni di un soggetto in un blocco: per decidere quali surplus lo riguardano. */
function prestazioniDelSoggetto(blocco, vociSoggetto, righeSoggetto) {
  if (blocco === 'raccoglitori') return new Set(['RACCOLTA']);
  const fuori = new Set();
  for (const r of righeSoggetto || []) if (testo(r.prestazione)) fuori.add(prestazioneChiave(r.prestazione));
  for (const v of vociSoggetto || []) {
    const c = criterioDi(v);
    if (c && testo(c.prestazione)) fuori.add(prestazioneChiave(c.prestazione));
    if (COLONNA_PRESTAZIONE[testo(v.colonna_prezzo)]) fuori.add(COLONNA_PRESTAZIONE[testo(v.colonna_prezzo)]);
  }
  return fuori;
}

/** Vero se un surplus del mese con un elenco nomina il soggetto (fra i pagati, i senza righe o gli interni). */
function elencoNomina(s, k) {
  const nomi = [
    ...((s && s.fornitori) || []).map(f => f && f.fornitore),
    ...((s && s.senza_righe) || []),
    ...((s && s.interni) || []).map(f => f && f.fornitore),
  ];
  return nomi.some(x => nome(x) === k);
}

/**
 * Le righe del surplus di un soggetto in un blocco: quelle del calcolo (con le
 * sue tonnellate e il suo importo) e, per i surplus del mese che lo riguardano
 * e che il calcolo non gli ha dato perche' nel periodo non ha portato niente, la
 * riga a zero. In ordine di nome e di inizio, come nel calcolo.
 *
 * @param coperturaDi facoltativo: prestazione -> coperturaSenzaTariffa, per dire
 *   l'avviso di una tariffa mancante come lo fa il foglio (13/10/2026)
 */
function righeSurplusDelSoggetto(surplus, blocco, soggetto, vociSoggetto, righeSoggetto, coperturaDi = null) {
  if (!surplus) return [];
  const k = nome(soggetto);
  const prestazioni = PRESTAZIONI_SURPLUS[blocco] || [];
  const dalCalcolo = ((surplus.perSoggetto && surplus.perSoggetto.get(k)) || [])
    .filter(s => prestazioni.includes(testo(s.prestazione).toUpperCase()));
  const fuori = dalCalcolo.map(s => rigaSurplus(soggetto, s, s.tonnellate, s.importo,
    testo(s.avviso) && coperturaDi ? avvisoSurplusDelFoglio(s, coperturaDi(testo(s.prestazione).toUpperCase())) : null));
  if (!(surplus.interni && surplus.interni.has(k))) {
    const sue = prestazioniDelSoggetto(blocco, vociSoggetto, righeSoggetto);
    for (const s of surplus.delMese || []) {
      const p = testo(s.prestazione).toUpperCase();
      if (!prestazioni.includes(p) || !sue.has(p)) continue;
      if (testo(s.a_chi).toLowerCase() === 'elenco' && !elencoNomina(s, k)) continue;
      if (dalCalcolo.some(x => testo(x.surplus_id) && testo(x.surplus_id) === testo(s.surplus_id))) continue;
      fuori.push(rigaSurplus(soggetto, s, 0, 0));
    }
  }
  return fuori.sort((a, b) => a.nome.localeCompare(b.nome, 'it') || a.dal.localeCompare(b.dal));
}

/**
 * Un blocco del foglio. Torna { righe, totale_t, totale_euro, totale_standard,
 * totale_surplus, non_previsti }.
 *
 * Le righe sono di quattro tipi: 'soggetto' (il totale del fornitore), 'voce'
 * (una riga del modello, anche a zero), 'surplus' (il surplus sulle tariffe,
 * sotto le voci del soggetto: le tonnellate sono le stesse del mese e non si
 * sommano, l'importo si') e 'senza_voce' (i chili del fornitore che nessuna voce
 * ha preso: si scrivono, perche' un chilo che sparisce dal foglio e' un chilo
 * che non si fattura).
 *
 * non_previsti sono i fornitori che nel mese hanno movimenti ma non hanno nessuna
 * voce nel modello: non si buttano via e non si inventano prezzi - si elencano,
 * perche' e' il segnale che il modello va aggiornato.
 *
 * @param surplus facoltativo: { perSoggetto, delMese, interni } (foglioPassiva);
 *   senza, il blocco e' quello di prima del surplus, riga per riga
 */
export function bloccoPassiva(voci, dati, canale, blocco, tariffe, giorno, surplus = null) {
  const scelte = vociOrdinate(voci, canale, blocco);
  const perSoggetto = new Map();
  for (const r of dati || []) {
    const k = nome(r.soggetto);
    if (!perSoggetto.has(k)) perSoggetto.set(k, []);
    perSoggetto.get(k).push(r);
  }
  const righe = [];
  let totaleT = 0;
  let totaleEuro = 0;
  let totaleSurplus = 0;
  const soggettiUsati = new Set();
  const ordineSoggetti = [...new Set(scelte.map(v => testo(v.soggetto)))];
  for (const soggetto of ordineSoggetti) {
    const sue = scelte.filter(v => testo(v.soggetto) === soggetto);
    const righeSoggetto = perSoggetto.get(nome(soggetto)) || [];
    soggettiUsati.add(nome(soggetto));
    const { quote, fuori } = assegnaRighe(sue, righeSoggetto, (v) => tariffaDellaVoce(tariffe, v, canale, blocco, giorno));
    // Le voci con le loro righe, da dove viene il prezzo e se le tonnellate le
    // paga: serve all'avviso del surplus di chi non ha la tariffa del mese.
    const prezzate = [];
    const dettaglio = sue.map(v => {
      const q = quote.get(v);
      const p = prezzoDellaVoce(v, q.righe, tariffe, canale, blocco, giorno);
      // Quando il prezzo non viene ne' dai movimenti ne' dal tariffario, il
      // foglio lo dichiara: un numero senza una fonte, su una fattura, va detto.
      const avvisi = [testo(v.note)];
      if (p.fonte === 'modello' && q.righe.some(rigaSenzaTariffa)) {
        avvisi.push('Nel tariffario non c\'e\' la tariffa per questi movimenti: il prezzo arriva dal modello. Da sistemare nel tariffario.');
      } else if (p.fonte === 'compreso') {
        avvisi.push('Compreso nel prezzo unico della raccolta: qui non si fattura, altrimenti si paga due volte.');
      } else if (p.fonte === 'vari') {
        avvisi.push(`Tariffe diverse sulla stessa voce (${q.righe.length} righe): l'importo e' quello calcolato riga per riga. Se vanno distinte, aggiungi una voce.`);
      }
      // IL SOVRACOSTO STA DENTRO L'IMPORTO, NON DENTRO IL PREZZO.
      //
      // Un sovracosto di un intervento di extra raccolta si paga al raccoglitore
      // o all'impianto (precisazione dell'utente, 03/10/2026) e il calcolo lo
      // somma all'importo della sua riga, fuori dalla moltiplicazione tariffa per
      // peso. Qui l'importo di una voce si rifa' da prezzo per tonnellate: senza
      // aggiungerlo, una riga che nella fatturazione passiva vale 620 euro nel
      // foglio ne valeva 500, e i due moduli devono dire gli stessi numeri.
      //
      // Quando le righe hanno tariffe diverse fra loro l'importo e' gia' la somma
      // di quelli calcolati, sovracosto compreso: aggiungerlo di nuovo sarebbe
      // pagarlo due volte.
      const oltre = p.fonte === 'vari' ? 0 : n2(q.righe.reduce((s, r) => s + (Number(r.sovracosto_euro) || 0), 0));
      const motivi = [...new Set(q.righe.map(r => testo(r.sovracosto_motivo)).filter(Boolean))];
      if (oltre > 0) {
        avvisi.push(`Di cui ${oltre.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € di sovracosto per costi imprevisti, oltre la tariffa per il peso${motivi.length ? `: ${motivi.join(' / ')}` : '.'}`);
      }
      const base = p.importo !== undefined ? p.importo : importoVoce(p.prezzo, p.unita_misura, q.tonnellate, q.viaggi_pagati);
      const totale = n2(base + oltre);
      // Quando il prezzo viene dai movimenti, l'importo del foglio deve fare
      // esattamente quello che ha calcolato la passiva: se non torna, lo si dice
      // invece di lasciare due numeri diversi in due pagine.
      //
      // ANCHE UN CENTESIMO (chiusura dell'audit, 11/10/2026). La soglia era
      // «oltre 0,01 €», e una differenza di un centesimo esatto passava muta: la
      // passiva arrotonda per provincia e destinazione, il foglio per voce, e
      // due primarie da 1.003 kg a 68 €/t fanno 136,40 da una parte e 136,41
      // dall'altra. Quale delle due grane sia quella della fattura del fornitore
      // il file di settembre non lo dice (pesi a 10 kg e prezzi interi: le grane
      // danno lo stesso centesimo), quindi non si sceglie: si avvisa. E quando
      // la differenza e' un centesimo si dice che e' l'arrotondamento, perche'
      // chi legge non vada a cercare un prezzo sbagliato che non c'e'.
      if (p.fonte === 'movimenti' && q.righe.length) {
        const calcolato = n2(q.righe.reduce((s, r) => s + (Number(r.importo) || 0), 0));
        const scarto = Math.abs(calcolato - totale);
        if (scarto > 0.005) {
          const euro = calcolato.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
          avvisi.push(scarto < 0.015
            ? `La fatturazione passiva per questa voce calcola ${euro} €: e' un centesimo di arrotondamento, perche' la passiva arrotonda riga per riga (provincia e destinazione) e il foglio sulla voce intera.`
            : `La fatturazione passiva per questa voce calcola ${euro} €: la differenza va guardata.`);
        }
      }
      prezzate.push({ righe: q.righe, fonte: p.fonte, prezzata: !!PREZZO_SENZA_TARIFFA[p.fonte] && Number(p.prezzo) > 0 && totale > 0 });
      return {
        tipo: 'voce',
        soggetto,
        voce: testo(v.voce),
        tonnellate: q.tonnellate,
        viaggi: q.viaggi,
        viaggi_pagati: n2(q.viaggi_pagati),
        prezzo: p.prezzo,
        unita_misura: p.unita_misura,
        fonte_prezzo: p.fonte,
        // Quanto dell'importo non viene dalla moltiplicazione: lo scrittore del
        // foglio lo aggiunge alla formula, cosi' il conto si legge per intero.
        oltre_tariffa: oltre,
        // Negli impianti dell'ACI il foglio ha due colonne di prezzo: la voce
        // dice in quale delle due sta il suo.
        colonna_prezzo: testo(v.colonna_prezzo),
        totale,
        note: avvisi.filter(Boolean).join(' '),
      };
    });
    const tFuori = n3(fuori.reduce((s, r) => s + (Number(r.tonnellate) || 0), 0));
    const tSoggetto = n3(dettaglio.reduce((s, d) => s + d.tonnellate, 0) + tFuori);
    const eStandard = n2(dettaglio.reduce((s, d) => s + d.totale, 0));
    // Il surplus: le sue righe vanno nell'importo del soggetto, non nelle sue
    // tonnellate (sono le stesse del mese, gia' contate nelle voci).
    const sueSurplus = righeSurplusDelSoggetto(surplus, blocco, soggetto, sue, righeSoggetto,
      (prestazione) => coperturaSenzaTariffa(blocco, prestazione, prezzate, fuori));
    const eSurplus = n2(sueSurplus.reduce((s, d) => s + d.totale, 0));
    const eSoggetto = n2(eStandard + eSurplus);
    righe.push({ tipo: 'soggetto', soggetto, tonnellate: tSoggetto, totale: eSoggetto, totale_standard: eStandard, totale_surplus: eSurplus });
    for (const d of dettaglio) righe.push(d);
    for (const d of sueSurplus) righe.push(d);
    if (tFuori > 0) righe.push({ tipo: 'senza_voce', soggetto, tonnellate: tFuori, dettaglio: descriviFuori(fuori) });
    totaleT += tSoggetto;
    totaleEuro += eSoggetto;
    totaleSurplus += eSurplus;
  }
  // Chi ha movimenti ma non e' nel modello: si dice, non si indovina.
  const nonPrevisti = [...perSoggetto.entries()]
    .filter(([k]) => !soggettiUsati.has(k))
    .map(([, righeS]) => ({
      soggetto: testo(righeS[0].soggetto),
      tonnellate: n3(righeS.reduce((s, r) => s + (Number(r.tonnellate) || 0), 0)),
    }))
    .filter(x => x.tonnellate > 0)
    .sort((a, b) => b.tonnellate - a.tonnellate);
  return {
    righe,
    totale_t: n3(totaleT),
    totale_euro: n2(totaleEuro),
    // lo standard e il surplus: senza surplus lo standard e' il totale di prima
    totale_standard: n2(totaleEuro - totaleSurplus),
    totale_surplus: n2(totaleSurplus),
    non_previsti: nonPrevisti,
  };
}

/**
 * LE RIGHE PIATTE DI UN BLOCCO, dalla forma che ha calcolaPassiva.
 *
 * calcolaPassiva raggruppa per fornitore: { fornitore, righe: [...], totale_* }.
 * Qui serve una riga per volta, col nome del soggetto addosso, perche' il foglio
 * dell'amministrazione mette il soggetto in grassetto e le sue voci sotto.
 *
 * Il 03/10/2026 questo adattatore non c'era e il foglio usciva TUTTO A ZERO coi
 * nomi vuoti: cercavo r.soggetto su righe che si chiamano fornitore e tengono i
 * numeri dentro righe[]. L'utente l'ha visto subito: «ci sono ancora errori».
 *
 * Un fornitore senza righe di dettaglio porta comunque il suo totale: meglio una
 * riga sola che perderlo.
 */
export function righePiatte(gruppi) {
  const out = [];
  for (const g of gruppi || []) {
    const dettaglio = g && Array.isArray(g.righe) ? g.righe : [];
    // `interno` sta sul gruppo, non sulle righe: senza portarlo giu', le righe di
    // SMOCO sembrerebbero righe a cui manca la tariffa.
    if (dettaglio.length) {
      for (const r of dettaglio) out.push({ soggetto: g.fornitore, interno: g.interno === true, ...r });
    } else if (g) {
      // Lo STANDARD, non il totale (il surplus sulle tariffe, 13/10/2026): dal
      // calcolo totale_euro comprende il surplus, che nel foglio ha la sua riga
      // sotto il soggetto; qui ripreso dentro il totale si pagherebbe due volte.
      const standard = g.totale_standard !== undefined && g.totale_standard !== null ? g.totale_standard : g.totale_euro;
      out.push({ soggetto: g.fornitore, interno: g.interno === true, tonnellate: g.totale_tonnellate, importo: standard });
    }
  }
  return out;
}

const NOMI = { RETE: 'RETE', ACI: 'ACI', EXTRA_RACCOLTA: 'EXTRA RACCOLTA' };
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/** Il quindici del mese in aaaa-mm-gg, per leggere il tariffario di quel mese. */
export function giornoDelMese(anno, mese) {
  const i = MESI.findIndex(m => chiave(m) === chiave(mese));
  if (!anno || i < 0) return '';
  return `${anno}-${String(i + 1).padStart(2, '0')}-15`;
}

/**
 * Il foglio intero di un canale: i tre blocchi e il totale in cima, com'e' nel
 * file dell'amministrazione.
 *
 * `passiva` e' quello che restituisce calcolaPassiva: { raccoglitori,
 * impianti_stoccaggi, trasporti_secondaria }. Il trasporto non ha voci fisse -
 * le righe sono i viaggi del mese - quindi si riporta com'e'.
 */
export function foglioPassiva(voci, passiva, canale, mese, anno, tariffe, extra) {
  const aci = canale === 'ACI';
  // Il giorno con cui si guarda il tariffario: il quindici del mese, che sta
  // dentro il mese qualunque sia e quindi prende le tariffe di quel mese anche
  // quando un accordo e' cambiato il primo o l'ultimo giorno.
  const giorno = giornoDelMese(anno, mese);
  // Il surplus del canale, dal calcolo (13/10/2026): le righe di ogni fornitore,
  // i surplus in corso nel mese (per le righe a zero) e chi e' interno.
  const delMese = Array.isArray(passiva && passiva.surplus_del_mese) ? passiva.surplus_del_mese : [];
  const interni = soggettiInterni(passiva, (voci || []).filter(v => v && v.canale === canale));
  const surplusDi = (gruppi) => ({ perSoggetto: surplusPerSoggetto(gruppi), delMese, interni });
  // L'extra raccolta col suo blocco di interventi non ha voci ne' trasporti nel
  // foglio: i tre blocchi restano vuoti com'erano, e il suo surplus sta nel
  // blocco degli interventi (extraConSurplus).
  const dati = canale === 'EXTRA_RACCOLTA' && extra ? {} : (passiva || {});
  const raccoglitori = bloccoPassiva(voci, righePiatte(dati.raccoglitori), canale, 'raccoglitori', tariffe, giorno, surplusDi(dati.raccoglitori));
  const impianti = bloccoPassiva(voci, righePiatte(dati.impianti_stoccaggi), canale, 'impianti', tariffe, giorno, surplusDi(dati.impianti_stoccaggi));
  // Il trasporto: il trasportatore e' il fornitore del gruppo, produttore e
  // destinatario stanno sulla riga della tratta. Il surplus del trasporto delle
  // secondarie, se c'e', sta sotto le tratte del suo trasportatore, una riga per
  // surplus: anche qui le tonnellate sono le stesse e non si sommano.
  const trasporti = (dati.trasporti_secondaria || []).flatMap(g => [...(g.righe || []).map(t => ({
    produttore: testo(t.stoccaggio),
    trasportatore: testo(g.fornitore),
    destinatario: testo(t.destinazione),
    tonnellate: n3(t.tonnellate),
    // Un prezzo al chilo diventa un prezzo a tonnellata, come nelle voci
    // (11/10/2026): la colonna e' «€\t» e la formula e' peso per costo, quindi
    // 0,03 €/kg scritti cosi' com'erano facevano un trasporto mille volte piu'
    // piccolo al primo ricalcolo. Un'unita' che la passiva non sa leggere fa una
    // riga a zero, detta nella nota: il prezzo resta zero anche qui, altrimenti
    // la formula del foglio Excel, ricalcolando, la rimetterebbe a prezzo pieno.
    unita_misura: prezzoTrasporto(t).unita_misura,
    prezzo: prezzoTrasporto(t).prezzo,
    viaggi: Number(t.viaggi) || 0,
    // I VIAGGI CONTATI NON SONO SEMPRE QUELLI CHE SI PAGANO. Un viaggio misto
    // porta formulari di tutti e due i canali e ogni canale ne paga la sua quota:
    // due viaggi interi piu' un misto al 60% fanno TRE viaggi contati e 2,6
    // pagati. Il foglio moltiplicava il prezzo per i viaggi contati, quindi lo
    // stesso camion si pagava intero di qua e intero di la' (audit 03/10/2026).
    viaggi_pagati: viaggiPagatiTrasporto(t, g),
    totale: n2(t.importo),
    // UN TRASPORTO INTERNO NON SI FATTURA. SMOCO trasporta da se' e la passiva lo
    // mette a zero; nel foglio pero' restavano scritti il prezzo e i viaggi, e il
    // totale era una FORMULA prezzo x viaggi col risultato zero in memoria. Basta
    // che Excel ricalcoli - e ricalcola da solo appena si tocca una cella - e quel
    // trasporto torna a 350 euro dentro il totale del canale (audit 03/10/2026).
    interno: !!g.interno,
    note: testo(t.note),
  })), ...(g.interno === true ? [] : (g.surplus || [])
    .filter(s => testo(s.prestazione).toUpperCase() === 'TRASPORTO_SECONDARIA')
    .map(s => ({ ...rigaSurplus(testo(g.fornitore), s, s.tonnellate, s.importo), produttore: '', trasportatore: testo(g.fornitore), destinatario: '', viaggi_pagati: 0, interno: false })))]);
  const totaleTrasporti = n2(trasporti.reduce((s, t) => s + t.totale, 0));
  const surplusTrasporti = n2(trasporti.filter(eRigaSurplus).reduce((s, t) => s + t.totale, 0));
  const extraFoglio = canale === 'EXTRA_RACCOLTA' && extra ? extraConSurplus(extra, passiva) : null;
  return {
    canale,
    nome_canale: NOMI[canale] || canale,
    mese,
    anno,
    // La rete sta a due livelli, l'ACI e' piatta: sono due forme diverse nello
    // stesso file dell'amministrazione, non una scelta nostra.
    stile: aci ? 'piatto' : 'due_livelli',
    raccoglitori: {
      ...raccoglitori,
      titolo: 'RACCOGLITORI',
      etichetta_prezzo: 'Costo di Raccolta [€\\t]',
      due_prezzi: false,
    },
    impianti: {
      ...impianti,
      titolo: aci ? 'IMPIANTI \\ STOCCAGGI (ACI)' : 'IMPIANTI \\ STOCCAGGI',
      etichetta_prezzo: aci ? 'Costo di Stoccaggio [€\\t]' : 'Costo [€\\t]',
      // Negli impianti dell'ACI il loro foglio tiene stoccaggio e trattamento in
      // due colonne: lo stesso impianto puo' fare l'uno o l'altro a prezzi
      // diversi, e la fattura li distingue.
      due_prezzi: aci,
      etichette_prezzo: aci ? ['Costo di Stoccaggio [€\\t]', 'Costo di Trattamento [€\\t]'] : null,
    },
    trasporti: {
      righe: trasporti,
      // le tonnellate dei viaggi, non quelle ripetute sulle righe del surplus
      totale_t: n3(trasporti.filter(t => !eRigaSurplus(t)).reduce((s, t) => s + t.tonnellate, 0)),
      totale_euro: totaleTrasporti,
      totale_standard: n2(totaleTrasporti - surplusTrasporti),
      totale_surplus: surplusTrasporti,
    },
    // L'EXTRA RACCOLTA NON HA VOCI FISSE: ogni intervento fa storia a se', coi
    // suoi prezzi scritti a mano sull'intervento prima di passarlo a terminato.
    // Il suo blocco e' il dettaglio degli interventi chiusi nel mese e lo
    // costruisce src/lib/extraRaccoltaAmministrazione.js dal modulo Extra
    // Raccolta, come ha chiesto l'utente il 03/10/2026; qui si riporta e basta,
    // perche' questo file deve restare caricabile dalle prove senza tirarsi
    // dietro mezzo gestionale. Il surplus degli interventi, che il blocco del
    // modulo porta gia', qui si veste come le altre righe del surplus
    // (extraConSurplus).
    extra: canale === 'EXTRA_RACCOLTA' ? extraFoglio : null,
    // Il numero in cima al foglio: i blocchi di QUESTO canale, mai di altri.
    // Per l'extra raccolta il blocco degli interventi ha gia' dentro il trasporto
    // a viaggio di ciascuno (colonna TRASPORTO), e la passiva mette lo stesso
    // viaggio fra i trasporti: sommarli contava il viaggio due volte, e il PDF
    // scriveva in testa 786,74 su una tabella che chiude a 636,74 (revisione
    // finale, 11/10/2026). Il totale del canale e' quello del blocco, che e'
    // anche l'unico che il PDF disegna e quello a cui punta la cella in cima
    // dell'Excel.
    totale_euro: canale === 'EXTRA_RACCOLTA' && extra
      ? n2(Number(extraFoglio.totale_euro) || 0)
      : n2(raccoglitori.totale_euro + impianti.totale_euro + totaleTrasporti),
    // I surplus del mese su questo canale, per i riquadri e le note dei file: il
    // nome, quanto vale a tonnellata e quanto fa nel foglio. Il «di cui» del
    // canale e' la somma delle righe del foglio, cioe' quello che il foglio paga.
    surplus: delMese.map(s => ({
      nome: testo(s.nome) || 'Surplus', origine: testo(s.origine), prestazione: testo(s.prestazione).toUpperCase(),
      euro_t: Number(s.euro_t) || 0, dal: testo(s.dal), al: testo(s.al), etichetta: testo(s.etichetta),
    })),
    totale_surplus: canale === 'EXTRA_RACCOLTA' && extra
      ? n2(Number(extraFoglio.totale_surplus) || 0)
      : n2(raccoglitori.totale_surplus + impianti.totale_surplus + surplusTrasporti),
  };
}

/** Vero per una riga del surplus sulle tariffe, in qualunque blocco del foglio. */
export const eRigaSurplus = (r) => !!r && r.tipo === 'surplus';

/**
 * IL SURPLUS NEL BLOCCO DELL'EXTRA RACCOLTA (13/10/2026).
 *
 * Gli interventi restano quelli del modulo Extra Raccolta, coi loro prezzi (la
 * regola dell'utente del 03/10/2026), e il surplus pure: il blocco del modulo
 * (bloccoExtraRaccolta col contesto dei prezzi) lo porta gia', una riga per
 * fornitore e per surplus col centesimo del mese, contata come la passiva. Qui
 * quelle righe si vestono come le altre righe del surplus del foglio, in fondo
 * agli interventi. Se il blocco non le porta (un blocco fatto senza contesto) e
 * chi chiama passa il calcolo della passiva del canale, si prendono dal calcolo:
 * mai da tutti e due, che sarebbe pagarle due volte.
 *
 * Torna il blocco con `surplus` (le righe del foglio), `totale_interventi` (lo
 * standard: la somma degli interventi, come prima), `totale_surplus` e
 * `totale_euro` che li comprende. Senza surplus il blocco e' quello di prima, a
 * parte i tre campi.
 */
export function extraConSurplus(extra, passiva) {
  const dalModulo = Array.isArray(extra && extra.surplus) ? extra.surplus : [];
  const righe = [];
  if (dalModulo.length) {
    for (const v of dalModulo) {
      if (!v) continue;
      const r = rigaSurplus(testo(v.fornitore || v.soggetto), v, v.tonnellate, v.importo !== undefined ? v.importo : v.totale);
      // la nota del modulo dice anche su quanti interventi: si tiene la sua
      righe.push(testo(v.note) ? { ...r, note: testo(v.note) } : r);
    }
  } else {
    for (const blocco of ['raccoglitori', 'impianti_stoccaggi', 'trasporti_secondaria']) {
      for (const g of (passiva && passiva[blocco]) || []) {
        if (!g || g.interno === true) continue;
        for (const s of g.surplus || []) righe.push(rigaSurplus(testo(g.fornitore), s, s.tonnellate, s.importo));
      }
    }
  }
  righe.sort((a, b) => a.nome.localeCompare(b.nome, 'it') || a.soggetto.localeCompare(b.soggetto, 'it') || a.dal.localeCompare(b.dal));
  // Lo standard: quello che il blocco dice (col surplus del modulo il suo
  // totale_euro lo comprende gia'), o la somma degli interventi.
  const standard = extra && extra.totale_standard !== undefined && extra.totale_standard !== null
    ? Number(extra.totale_standard) || 0
    : Number(extra && extra.totale_euro) || 0;
  const interventi = n2(standard);
  const totaleSurplus = n2(righe.reduce((s, r) => s + r.totale, 0));
  return {
    ...extra,
    surplus: righe,
    totale_interventi: interventi,
    totale_surplus: totaleSurplus,
    totale_euro: n2(interventi + totaleSurplus),
  };
}

/** I fogli dei canali chiesti, costruiti dalle voci e dalla passiva gia' calcolata. */
export function fogliDa(voci, passivePerCanale, mese, anno, tariffe, extra) {
  return Object.entries(passivePerCanale || {})
    .filter(([, p]) => p)
    .map(([canale, p]) => foglioPassiva(voci, p, canale, mese, anno, tariffe, extra));
}

export const nomeFilePassiva = (anno, mese, come, estensione) =>
  `Format_amministrazione_PASSIVA${come === 'canali' ? '_per_canale' : ''}_${mese}_${anno}.${estensione}`;

/**
 * Il modello proposto a partire da un mese gia' calcolato: un punto di partenza
 * da correggere, non una verita'. Serve a non far cominciare l'utente da un
 * foglio vuoto quando l'anno e' nuovo o il fornitore e' nuovo. Una voce per
 * fornitore, senza criterio - cioe' «tutto quello che ha portato» - col prezzo
 * che il mese ha usato.
 */
export function modelloDaPassiva(passiva, canale, anno) {
  const fuori = [];
  const aggiungi = (blocco, gruppi) => {
    let i = 0;
    for (const g of gruppi || []) {
      if (!g || !testo(g.fornitore)) continue;
      // Il prezzo della prima riga del fornitore: e' un punto di partenza, non
      // una verita'. Se il fornitore ha piu' tariffe le voci le separa l'utente.
      const prima = (g.righe && g.righe[0]) || {};
      // Il prezzo nell'unita' del foglio: 0,090 €/kg sono 90 €/t (11/10/2026;
      // prima si copiava il valore grezzo e lo si diceva a tonnellata).
      const pz = prezzoDaTariffa(prima.tariffa_valore, prima.unita_misura);
      fuori.push({
        anno, canale, blocco,
        soggetto: testo(g.fornitore),
        voce: '',
        prezzo: pz.prezzo,
        unita_misura: String(prima.unita_misura || '').includes('viaggio') ? 'euro_viaggio' : pz.unita_misura,
        ordine: ++i * 10,
        attiva: true,
        note: `Proposta dal calcolo di ${canale} ${anno}: controlla prezzo e voci.`,
      });
    }
  };
  aggiungi('raccoglitori', passiva && passiva.raccoglitori);
  aggiungi('impianti', passiva && passiva.impianti_stoccaggi);
  return fuori;
}
