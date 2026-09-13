// Le otto pivot del foglio REPORT MENSILE del gestionale Excel, riprodotte con
// le stesse righe, le stesse colonne e la stessa misura.
//
// Nel foglio ogni pivot porta il proprio filtro di pagina. Quattro guardano un
// singolo mese, quattro l'anno intero: la distinzione e' conservata nel campo
// "periodo" di ciascuna definizione, cosi' il selettore del modulo agisce dove
// serve e lascia stare il resto.
//
// Il periodo si determina sempre da stato "terminato" e da trasporto_finito_il,
// mai dai campi mese o anno del record: quelli non distinguono le annualita' e
// sommerebbero lo stesso mese di anni diversi.

import { getClasseFromProdotto, getRegioneFromProvincia } from "./dataEnrichment.ts";
import { meseToIndice } from "./filtroPeriodo.ts";

export const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

// Ordine merceologico delle classi, lo stesso usato dal portale.
const ORDINE_CLASSI = ['P', 'M', 'G1', 'G2', 'PFU Autodemolizione'];

const COLONNA_UNICA = 'Totale';

// === estrazione dei campi ===

function testo(v) {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s || 'N/D';
}

function dataFine(r) {
  if (!r.trasporto_finito_il) return null;
  const d = new Date(r.trasporto_finito_il);
  return isNaN(d.getTime()) ? null : d;
}

function eTerminato(r) {
  return String(r.stato || '').toLowerCase().trim() === 'terminato';
}

const ESTRATTORI = {
  'Regione': (r) => testo(r.regioni || r.regione || getRegioneFromProvincia(r.provincia)),
  'Trasportatore': (r) => testo(r.trasportatore),
  'Destinazione': (r) => testo(r.destinazione),
  'Tipo destinazione': (r) => {
    const t = String(r.tipo_destinazione || '').toLowerCase().trim();
    if (t === 'imp') return 'Impianto';
    if (t === 'stoc') return 'Stoccaggio';
    return testo(r.tipo_destinazione);
  },
  'Classe': (r) => testo(r.classe || getClasseFromProdotto(r.prodotto)),
  'Stoccaggio': (r) => testo(r.stoccaggio),
  'Ragione sociale': (r) => testo(r.ragione_sociale),
  'Produttore': (r) => testo(r.produttore || r.ragione_sociale),
  'Mese': (r) => { const d = dataFine(r); return d ? MESI[d.getMonth()] : 'N/D'; },
};

const MISURE = {
  peso: (r) => (Number(r.peso_effettivo) || 0) / 1000,
  conteggio: () => 1,
};

const ETICHETTE_MISURE = { peso: 'Peso [t]', conteggio: 'Viaggi' };

// === definizioni delle pivot ===

export const PIVOT_DEFS = {
  raccolta: {
    titolo: 'Raccolta',
    nota: 'Quanto ha raccolto ciascun raccoglitore, per regione e per classe.',
    entita: 'PrimariaRete',
    gruppo: 'rete',
    periodo: 'mese',
    righe: ['Regione', 'Trasportatore'],
    colonna: 'Classe',
    misure: ['peso'],
  },
  impianti: {
    titolo: 'Impianti',
    nota: 'Dove e\' finito il raccolto, separando gli impianti dagli stoccaggi.',
    entita: 'PrimariaRete',
    gruppo: 'rete',
    periodo: 'mese',
    righe: ['Destinazione', 'Tipo destinazione'],
    colonna: 'Classe',
    misure: ['peso'],
  },
  viaggiRete: {
    titolo: 'Viaggi per destinazione',
    nota: 'Numero di viaggi e peso trasportato da ciascun vettore verso ogni destinazione.',
    entita: 'PrimariaRete',
    gruppo: 'rete',
    periodo: 'mese',
    righe: ['Destinazione', 'Trasportatore'],
    colonna: null,
    misure: ['conteggio', 'peso'],
  },
  aci: {
    titolo: 'ACI',
    nota: 'Andamento mensile dei PFU da autodemolizione, per regione, vettore e destinazione.',
    entita: 'PrimariaAci',
    gruppo: 'aci',
    periodo: 'anno',
    righe: ['Regione', 'Trasportatore', 'Destinazione'],
    colonna: 'Mese',
    misure: ['peso'],
  },
  secondarie: {
    titolo: 'Secondarie',
    nota: 'Trasferimenti dagli stoccaggi agli impianti, per classe e vettore.',
    entita: 'Secondaria',
    gruppo: 'secondarie',
    periodo: 'anno',
    righe: ['Stoccaggio', 'Classe', 'Trasportatore'],
    colonna: 'Destinazione',
    misure: ['peso'],
  },
  viaggiSecondarie: {
    titolo: 'Viaggi secondari per destinazione',
    nota: 'Numero di viaggi e peso in arrivo a ciascun impianto dagli stoccaggi.',
    entita: 'Secondaria',
    gruppo: 'secondarie',
    periodo: 'mese',
    righe: ['Destinazione', 'Trasportatore'],
    colonna: null,
    misure: ['conteggio', 'peso'],
  },
  terziarie: {
    titolo: 'Terziarie',
    nota: 'Uscite dagli impianti verso le cementerie e gli impianti finali.',
    entita: 'Terziaria',
    gruppo: 'terziarie',
    periodo: 'anno',
    righe: ['Ragione sociale'],
    colonna: 'Destinazione',
    misure: ['peso'],
  },
  extra: {
    titolo: 'Extra raccolta',
    nota: 'Raccolte fuori circuito ordinario, per produttore e vettore.',
    entita: 'ExtraRaccolta',
    gruppo: 'terziarie',
    periodo: 'anno',
    righe: ['Produttore', 'Trasportatore'],
    colonna: 'Destinazione',
    misure: ['peso'],
  },
};

// Le schede del modulo e le pivot che ciascuna contiene, nell'ordine del foglio.
export const GRUPPI = [
  { chiave: 'rete', titolo: 'Rete', pivot: ['raccolta', 'impianti', 'viaggiRete'] },
  { chiave: 'aci', titolo: 'ACI', pivot: ['aci'] },
  { chiave: 'secondarie', titolo: 'Secondarie', pivot: ['secondarie', 'viaggiSecondarie'] },
  { chiave: 'terziarie', titolo: 'Terziarie ed extra', pivot: ['terziarie', 'extra'] },
];

// === costruzione dell'albero ===

function ordinaColonne(cols) {
  if (cols.every(c => MESI.includes(c))) {
    return cols.sort((a, b) => MESI.indexOf(a) - MESI.indexOf(b));
  }
  if (cols.every(c => ORDINE_CLASSI.includes(c))) {
    return cols.sort((a, b) => ORDINE_CLASSI.indexOf(a) - ORDINE_CLASSI.indexOf(b));
  }
  return cols.sort((a, b) => a.localeCompare(b, 'it'));
}

function arrotonda(n) {
  return Math.round(n * 100) / 100;
}

// Costruisce un nodo per livello di riga, accumulando i valori per colonna.
function costruisci(records, chiaviRiga, chiaveColonna, misure) {
  function nodo(righe, livello) {
    const valori = {};
    const totali = {};
    for (const m of misure) totali[m] = 0;

    const accumula = (dove, r) => {
      const col = chiaveColonna(r);
      if (!valori[dove]) valori[dove] = {};
      if (!valori[dove][col]) { valori[dove][col] = {}; for (const m of misure) valori[dove][col][m] = 0; }
      for (const m of misure) valori[dove][col][m] += MISURE[m](r);
    };

    if (livello >= chiaviRiga.length) {
      for (const r of righe) accumula('v', r);
      const v = valori['v'] || {};
      for (const m of misure) for (const c of Object.keys(v)) totali[m] += v[c][m];
      return { valori: v, totali, figli: null };
    }

    const gruppi = new Map();
    for (const r of righe) {
      const k = chiaviRiga[livello](r);
      if (!gruppi.has(k)) gruppi.set(k, []);
      gruppi.get(k).push(r);
    }

    const propri = {};
    const figli = [];
    for (const [k, sotto] of gruppi) {
      const figlio = nodo(sotto, livello + 1);
      figlio.etichetta = k;
      for (const [col, vals] of Object.entries(figlio.valori)) {
        if (!propri[col]) { propri[col] = {}; for (const m of misure) propri[col][m] = 0; }
        for (const m of misure) propri[col][m] += vals[m];
      }
      figli.push(figlio);
    }
    for (const m of misure) for (const c of Object.keys(propri)) totali[m] += propri[c][m];
    figli.sort((a, b) => String(a.etichetta).localeCompare(String(b.etichetta), 'it'));
    return { valori: propri, totali, figli };
  }

  const radice = nodo(records, 0);

  (function arrotondaAlbero(n) {
    for (const c of Object.keys(n.valori)) for (const m of misure) n.valori[c][m] = arrotonda(n.valori[c][m]);
    for (const m of misure) n.totali[m] = arrotonda(n.totali[m]);
    if (n.figli) n.figli.forEach(arrotondaAlbero);
  })(radice);

  return { radice, colonne: ordinaColonne(Object.keys(radice.valori)) };
}

/**
 * Calcola una pivot a partire dai record grezzi dell'entita'.
 *
 * @param {string} chiave  nome della pivot in PIVOT_DEFS
 * @param {array}  records tutti i record dell'entita', non filtrati
 * @param {number} anno    anno selezionato
 * @param {string} mese    mese selezionato, usato solo dalle pivot mensili
 */
export function calcolaPivot(chiave, records, anno, mese) {
  const def = PIVOT_DEFS[chiave];
  if (!def) throw new Error('Pivot sconosciuta: ' + chiave);

  const annoNum = Number(anno);
  const meseNum = def.periodo === 'mese' ? meseToIndice(mese) : -1;

  const filtrati = (records || []).filter(r => {
    if (!eTerminato(r)) return false;
    const d = dataFine(r);
    if (!d || d.getFullYear() !== annoNum) return false;
    if (def.periodo === 'mese' && d.getMonth() !== meseNum) return false;
    return true;
  });

  const chiaviRiga = def.righe.map(e => ESTRATTORI[e]);
  const chiaveColonna = def.colonna ? ESTRATTORI[def.colonna] : () => COLONNA_UNICA;
  const { radice, colonne } = costruisci(filtrati, chiaviRiga, chiaveColonna, def.misure);

  return {
    chiave,
    titolo: def.titolo,
    nota: def.nota,
    periodo: def.periodo,
    etichetteRiga: def.righe,
    etichettaColonna: def.colonna,
    senzaColonne: !def.colonna,
    colonne,
    misure: def.misure,
    etichetteMisure: def.misure.map(m => ETICHETTE_MISURE[m]),
    radice,
    righeLette: filtrati.length,
  };
}
