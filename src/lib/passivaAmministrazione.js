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
const rigaSenzaTariffa = (r) => /senza tariffa/i.test(String(r && r.note || ''));

/** Vero se la tariffa e' valida nel giorno dato (vuoto = sempre). */
function tariffaInVigore(t, giorno) {
  if (!giorno) return true;
  const inizio = String(t.data_inizio_validita || '').slice(0, 10);
  if (inizio && inizio > giorno) return false;
  const fine = String(t.data_fine_validita || '').slice(0, 10);
  if (fine && fine < giorno) return false;
  return true;
}

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
    && String(t.stato || 'attivo') !== 'non_attivo'
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
 */
export function assegnaRighe(vociSoggetto, righeSoggetto) {
  const conCriterio = vociSoggetto.map(v => ({ voce: v, criterio: criterioDi(v) })).filter(x => x.criterio);
  const senzaCriterio = vociSoggetto.find(v => !criterioDi(v)) || null;
  const quote = new Map(vociSoggetto.map(v => [v, { tonnellate: 0, viaggi: 0, righe: [] }]));
  const fuori = [];
  for (const r of righeSoggetto || []) {
    const trovata = conCriterio.find(x => rigaDellaVoce(x.criterio, r));
    const dove = trovata ? trovata.voce : senzaCriterio;
    if (!dove) { fuori.push(r); continue; }
    const q = quote.get(dove);
    q.tonnellate += Number(r.tonnellate) || 0;
    q.viaggi += Number(r.viaggi) || 0;
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

/**
 * Un blocco del foglio. Torna { righe, totale_t, totale_euro, non_previsti }.
 *
 * Le righe sono di tre tipi: 'soggetto' (il totale del fornitore), 'voce' (una
 * riga del modello, anche a zero) e 'senza_voce' (i chili del fornitore che
 * nessuna voce ha preso: si scrivono, perche' un chilo che sparisce dal foglio e'
 * un chilo che non si fattura).
 *
 * non_previsti sono i fornitori che nel mese hanno movimenti ma non hanno nessuna
 * voce nel modello: non si buttano via e non si inventano prezzi - si elencano,
 * perche' e' il segnale che il modello va aggiornato.
 */
export function bloccoPassiva(voci, dati, canale, blocco, tariffe, giorno) {
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
  const soggettiUsati = new Set();
  const ordineSoggetti = [...new Set(scelte.map(v => testo(v.soggetto)))];
  for (const soggetto of ordineSoggetti) {
    const sue = scelte.filter(v => testo(v.soggetto) === soggetto);
    const righeSoggetto = perSoggetto.get(nome(soggetto)) || [];
    soggettiUsati.add(nome(soggetto));
    const { quote, fuori } = assegnaRighe(sue, righeSoggetto);
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
      return {
        tipo: 'voce',
        soggetto,
        voce: testo(v.voce),
        tonnellate: q.tonnellate,
        viaggi: q.viaggi,
        prezzo: p.prezzo,
        unita_misura: p.unita_misura,
        fonte_prezzo: p.fonte,
        // Negli impianti dell'ACI il foglio ha due colonne di prezzo: la voce
        // dice in quale delle due sta il suo.
        colonna_prezzo: testo(v.colonna_prezzo),
        totale: p.importo !== undefined ? p.importo : importoVoce(p.prezzo, p.unita_misura, q.tonnellate, q.viaggi),
        note: avvisi.filter(Boolean).join(' '),
      };
    });
    const tFuori = n3(fuori.reduce((s, r) => s + (Number(r.tonnellate) || 0), 0));
    const tSoggetto = n3(dettaglio.reduce((s, d) => s + d.tonnellate, 0) + tFuori);
    const eSoggetto = n2(dettaglio.reduce((s, d) => s + d.totale, 0));
    righe.push({ tipo: 'soggetto', soggetto, tonnellate: tSoggetto, totale: eSoggetto });
    for (const d of dettaglio) righe.push(d);
    if (tFuori > 0) righe.push({ tipo: 'senza_voce', soggetto, tonnellate: tFuori, dettaglio: descriviFuori(fuori) });
    totaleT += tSoggetto;
    totaleEuro += eSoggetto;
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
      out.push({ soggetto: g.fornitore, interno: g.interno === true, tonnellate: g.totale_tonnellate, importo: g.totale_euro });
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
  const raccoglitori = bloccoPassiva(voci, righePiatte(passiva && passiva.raccoglitori), canale, 'raccoglitori', tariffe, giorno);
  const impianti = bloccoPassiva(voci, righePiatte(passiva && passiva.impianti_stoccaggi), canale, 'impianti', tariffe, giorno);
  // Il trasporto: il trasportatore e' il fornitore del gruppo, produttore e
  // destinatario stanno sulla riga della tratta.
  const trasporti = (passiva && passiva.trasporti_secondaria || []).flatMap(g => (g.righe || []).map(t => ({
    produttore: testo(t.stoccaggio),
    trasportatore: testo(g.fornitore),
    destinatario: testo(t.destinazione),
    tonnellate: n3(t.tonnellate),
    unita_misura: t.unita_misura === '€/viaggio' ? 'euro_viaggio' : 'euro_tonnellata',
    prezzo: Number(t.tariffa_valore) || 0,
    viaggi: Number(t.viaggi) || 0,
    totale: n2(t.importo),
    note: testo(t.note),
  })));
  const totaleTrasporti = n2(trasporti.reduce((s, t) => s + t.totale, 0));
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
      totale_t: n3(trasporti.reduce((s, t) => s + t.tonnellate, 0)),
      totale_euro: totaleTrasporti,
    },
    // L'EXTRA RACCOLTA NON HA VOCI FISSE: ogni intervento fa storia a se', coi
    // suoi prezzi scritti a mano sull'intervento prima di passarlo a terminato.
    // Il suo blocco e' il dettaglio degli interventi chiusi nel mese e lo
    // costruisce src/lib/extraRaccoltaAmministrazione.js dal modulo Extra
    // Raccolta, come ha chiesto l'utente il 03/10/2026; qui si riporta e basta,
    // perche' questo file deve restare caricabile dalle prove senza tirarsi
    // dietro mezzo gestionale.
    extra: canale === 'EXTRA_RACCOLTA' ? (extra || null) : null,
    // Il numero in cima al foglio: i blocchi di QUESTO canale, mai di altri.
    totale_euro: n2(raccoglitori.totale_euro + impianti.totale_euro + totaleTrasporti
      + (canale === 'EXTRA_RACCOLTA' && extra ? Number(extra.totale_euro) || 0 : 0)),
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
      fuori.push({
        anno, canale, blocco,
        soggetto: testo(g.fornitore),
        voce: '',
        prezzo: Number(prima.tariffa_valore) || 0,
        unita_misura: String(prima.unita_misura || '').includes('viaggio') ? 'euro_viaggio' : 'euro_tonnellata',
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
