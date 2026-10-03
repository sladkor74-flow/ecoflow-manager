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
  const quote = new Map(vociSoggetto.map(v => [v, { tonnellate: 0, viaggi: 0, righe: 0 }]));
  const fuori = [];
  for (const r of righeSoggetto || []) {
    const trovata = conCriterio.find(x => rigaDellaVoce(x.criterio, r));
    const dove = trovata ? trovata.voce : senzaCriterio;
    if (!dove) { fuori.push(r); continue; }
    const q = quote.get(dove);
    q.tonnellate += Number(r.tonnellate) || 0;
    q.viaggi += Number(r.viaggi) || 0;
    q.righe += 1;
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
export function bloccoPassiva(voci, dati, canale, blocco) {
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
      return {
        tipo: 'voce',
        soggetto,
        voce: testo(v.voce),
        tonnellate: q.tonnellate,
        viaggi: q.viaggi,
        prezzo: Number(v.prezzo) || 0,
        unita_misura: v.unita_misura || 'euro_tonnellata',
        // Negli impianti dell'ACI il foglio ha due colonne di prezzo: la voce
        // dice in quale delle due sta il suo.
        colonna_prezzo: testo(v.colonna_prezzo),
        totale: importoVoce(v.prezzo, v.unita_misura, q.tonnellate, q.viaggi),
        note: testo(v.note),
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
    if (dettaglio.length) {
      for (const r of dettaglio) out.push({ soggetto: g.fornitore, ...r });
    } else if (g) {
      out.push({ soggetto: g.fornitore, tonnellate: g.totale_tonnellate, importo: g.totale_euro });
    }
  }
  return out;
}

const NOMI = { RETE: 'RETE', ACI: 'ACI', EXTRA_RACCOLTA: 'EXTRA RACCOLTA' };

/**
 * Il foglio intero di un canale: i tre blocchi e il totale in cima, com'e' nel
 * file dell'amministrazione.
 *
 * `passiva` e' quello che restituisce calcolaPassiva: { raccoglitori,
 * impianti_stoccaggi, trasporti_secondaria }. Il trasporto non ha voci fisse -
 * le righe sono i viaggi del mese - quindi si riporta com'e'.
 */
export function foglioPassiva(voci, passiva, canale, mese, anno) {
  const aci = canale === 'ACI';
  const raccoglitori = bloccoPassiva(voci, righePiatte(passiva && passiva.raccoglitori), canale, 'raccoglitori');
  const impianti = bloccoPassiva(voci, righePiatte(passiva && passiva.impianti_stoccaggi), canale, 'impianti');
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
    // Il numero in cima al foglio: i tre blocchi di QUESTO canale, mai di altri.
    totale_euro: n2(raccoglitori.totale_euro + impianti.totale_euro + totaleTrasporti),
  };
}

/** I fogli dei canali chiesti, costruiti dalle voci e dalla passiva gia' calcolata. */
export function fogliDa(voci, passivePerCanale, mese, anno) {
  return Object.entries(passivePerCanale || {})
    .filter(([, p]) => p)
    .map(([canale, p]) => foglioPassiva(voci, p, canale, mese, anno));
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
