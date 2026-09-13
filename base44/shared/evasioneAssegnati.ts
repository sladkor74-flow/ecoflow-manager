// Evasione degli ordini assegnati ai raccoglitori.
//
// A inizio mese ogni raccoglitore riceve la lista delle richieste da evadere in
// ordine cronologico di immissione, con in evidenza le prime o quelle
// prioritarie, e un target mensile. A ogni caricamento delle primarie si
// controlla come la lista viene evasa: quali richieste sono chiuse e da chi, se
// l'ordine cronologico e le priorita' sono rispettati, cosa viene evaso fuori
// lista, e quante richieste il raccoglitore potra' realisticamente evadere
// entro fine mese in base a target, ritmo del mese e storia dell'anno.
//
// Il controllo e' interamente calcolato: le liste portano l'ID dell'ordine, per
// cui non serve un modello per interpretarle, e ogni numero resta riproducibile.
//
// La data di evasione e' quella di fine trasporto, come in tutto il gestionale.

import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { getRegioneFromProvincia } from "./dataEnrichment.ts";
import { classeNormalizzata, nomiCoincidono, aggiungiGiorni, dataDaValore } from "./reportSettimanali.ts";

export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const RE_ID_ORDINE = /^[A-Z]{2}[0-9]{6,10}$/;

// Giorni lavorativi da cui una richiesta prioritaria aperta diventa un alert.
const GIORNI_TOLLERANZA_PRIORITARIE = 5;
// Sotto questa percentuale di target a fine mese la proiezione diventa un alert.
const SOGLIA_PROIEZIONE = 0.9;
// Ordini minimi di una classe perche' la statistica del raccoglitore sia usata.
const MINIMO_ORDINI_CLASSE = 8;

// === calendario ===

export const indiceMese = (anno, mese) => anno * 12 + (mese - 1);
export const primoGiorno = (anno, mese) => `${anno}-${String(mese).padStart(2, '0')}-01`;
export function ultimoGiorno(anno, mese) {
  return new Date(Date.UTC(anno, mese, 0)).toISOString().slice(0, 10);
}

function pasqua(anno) {
  const a = anno % 19, b = Math.floor(anno / 100), c = anno % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31), giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

const festivitaCache = new Map();
function festivita(anno) {
  if (!festivitaCache.has(anno)) {
    const fisse = ['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26'].map(g => `${anno}-${g}`);
    festivitaCache.set(anno, new Set([...fisse, aggiungiGiorni(pasqua(anno), 1)]));
  }
  return festivitaCache.get(anno);
}

export function lavorativo(ymd) {
  const giorno = new Date(ymd + 'T00:00:00Z').getUTCDay();
  return giorno >= 1 && giorno <= 5 && !festivita(+ymd.slice(0, 4)).has(ymd);
}

// Giorni lavorativi fra due date comprese; zero se l'intervallo e' vuoto.
export function giorniLavorativi(da, a) {
  if (!da || !a || da > a) return 0;
  let n = 0;
  for (let d = da; d <= a; d = aggiungiGiorni(d, 1)) if (lavorativo(d)) n++;
  return n;
}

const ymd = (v) => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s) ? s : null;
};
const targa = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const kgT = (kg) => (Math.round((Number(kg) || 0) / 10) / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' t';
const itData = (d) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '');

// === movimenti ===

// Il punto di raccolta si riconosce dal suo ID nel portale, o in mancanza dal nome.
function chiavePdr(r) {
  const id = String(r.id_pdr ?? '').trim();
  if (id && id !== '0') return 'id:' + id;
  const nome = normalizzaRagioneSociale(r.punto_di_raccolta || r.ragione_sociale || '');
  return nome ? 'nome:' + nome : '';
}

export function normalizzaPrimaria(r, canale) {
  const regione = String(r.regione || r.regioni || getRegioneFromProvincia(r.provincia) || '').trim();
  return {
    id_ordine: String(r.id_ordine || '').trim().toUpperCase(),
    canale,
    trasportatore: String(r.trasportatore || '').trim(),
    chiaveTrasp: normalizzaRagioneSociale(r.trasportatore || ''),
    immesso: ymd(r.ordine_immesso_il),
    fine: ymd(r.trasporto_finito_il),
    kg: Math.round(Number(r.peso_effettivo) || 0),
    pdr: chiavePdr(r),
    classe: classeNormalizzata(r.classe) || classeNormalizzata(r.prodotto),
    automezzo: targa(r.automezzo),
    produttore: String(r.ragione_sociale || r.punto_di_raccolta || '').trim(),
    comune: String(r.comune || '').trim(),
    provincia: String(r.provincia || '').trim(),
    regione,
  };
}

export function normalizzaAssegnato(r, canale) {
  return {
    id_ordine: String(r.id_ordine || '').trim().toUpperCase(),
    canale,
    trasportatore: String(r.trasportatore || '').trim(),
    chiaveTrasp: normalizzaRagioneSociale(r.trasportatore || ''),
    immesso: ymd(r.ordine_immesso_il),
    produttore: String(r.ragione_sociale || r.punto_di_raccolta || '').trim(),
    punto_raccolta: String(r.punto_di_raccolta || '').trim(),
    comune: String(r.comune || '').trim(),
    provincia: String(r.provincia || '').trim(),
    regione: String(r.regione || r.regioni || getRegioneFromProvincia(r.provincia) || '').trim(),
    classe: classeNormalizzata(r.classe) || classeNormalizzata(r.prodotto),
    pdr: chiavePdr(r),
  };
}

/**
 * Raccoglitori attivi nell'anno: chi ha chiuso primarie o ha ordini assegnati.
 * Le societa' del gruppo restano: anche SMOCO raccoglie e ha il proprio target.
 */
export function raccoglitoriAttivi(terminati, assegnati, anagrafica, anno) {
  const mappa = new Map();
  const aggiungi = (nome, chiave) => {
    if (!chiave) return;
    if (!mappa.has(chiave)) mappa.set(chiave, new Map());
    mappa.get(chiave).set(nome, (mappa.get(chiave).get(nome) || 0) + 1);
  };
  for (const t of terminati) if (t.fine && t.fine.slice(0, 4) === String(anno)) aggiungi(t.trasportatore, t.chiaveTrasp);
  for (const a of assegnati) aggiungi(a.trasportatore, a.chiaveTrasp);
  return [...mappa.entries()].map(([chiave, nomi]) => {
    const f = anagrafica.get(chiave);
    let nome = f && f.ragione_sociale ? f.ragione_sociale : '';
    if (!nome) for (const n of nomi.keys()) if (n.length > nome.length) nome = n;
    return { chiave, nome };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

// Target del mese dalla tabella dei raccoglitori primaria di Target & Status. I
// nomi li' sono scritti a mano, spesso abbreviati: si confrontano per contenuto.
export function trovaTarget(targets, nomeRaccoglitore) {
  const candidati = targets.filter(t => nomiCoincidono(t.raccoglitore, nomeRaccoglitore));
  return candidati.sort((a, b) => String(b.updated_date || '').localeCompare(String(a.updated_date || '')))[0] || null;
}

// === lettura dei file della lista ===

const intestazione = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/**
 * Estrae la lista dai fogli letti nel browser.
 * fogli: [{ file, nome, righe: [{ r, c: [valori], giallo }] }]
 *
 * La lista e' l'elenco degli assegnati filtrato per trasportatore: un foglio e'
 * una lista se ha una colonna di ID ordine del portale, e l'ordine delle righe e'
 * quello in cui le richieste vanno evase. Una riga e' prioritaria se e'
 * evidenziata o se riporta la parola priorita' o urgente.
 */
export function leggiListaDaFogli(fogli) {
  const righe = [];
  const avvisi = [];
  const visti = new Set();
  let duplicati = 0;
  const fogliLetti = [];

  for (const foglio of fogli) {
    // Colonna degli ID: quella con piu' valori nel formato del portale.
    const conteggi = new Map();
    for (const riga of foglio.righe) {
      (riga.c || []).forEach((v, j) => {
        if (RE_ID_ORDINE.test(String(v ?? '').trim().toUpperCase())) conteggi.set(j, (conteggi.get(j) || 0) + 1);
      });
    }
    if (conteggi.size === 0) continue;
    const colonnaId = [...conteggi.entries()].sort((a, b) => b[1] - a[1])[0][0];

    const primaRigaId = foglio.righe.findIndex(r => RE_ID_ORDINE.test(String((r.c || [])[colonnaId] ?? '').trim().toUpperCase()));
    const indiciColonne = {};
    for (let k = primaRigaId - 1; k >= 0; k--) {
      const testi = (foglio.righe[k].c || []).map(intestazione);
      if (testi.filter(Boolean).length >= 3) {
        testi.forEach((t, j) => { if (t && indiciColonne[t] === undefined) indiciColonne[t] = j; });
        break;
      }
    }
    const colonna = (...nomi) => {
      for (const n of nomi) for (const [t, j] of Object.entries(indiciColonne)) if (t === n || t.includes(n)) return j;
      return -1;
    };
    const c = {
      immesso: colonna('ordine_immesso_il', 'data_immissione', 'immess'),
      produttore: colonna('ragione_sociale', 'produttore', 'cliente'),
      punto: colonna('punto_di_raccolta'),
      comune: colonna('comune'),
      provincia: colonna('provincia'),
      prodotto: colonna('prodotto', 'classe'),
      priorita: colonna('priorit'),
    };
    const val = (riga, j) => (j >= 0 ? (riga.c || [])[j] : null);

    let righeFoglio = 0;
    for (const riga of foglio.righe) {
      const id = String((riga.c || [])[colonnaId] ?? '').trim().toUpperCase();
      if (!RE_ID_ORDINE.test(id)) continue;
      if (visti.has(id)) { duplicati++; continue; }
      visti.add(id);
      righeFoglio++;
      const testoRiga = (riga.c || []).map(v => String(v ?? '')).join(' ');
      const testoPriorita = String(val(riga, c.priorita) ?? '').trim();
      const perTesto = /priorit|urgent/i.test(testoRiga) || (!!testoPriorita && !/^(no|0|false)$/i.test(testoPriorita));
      righe.push({
        id_ordine: id,
        file: foglio.file,
        foglio: foglio.nome,
        riga_excel: riga.r,
        giallo: !!riga.giallo,
        priorita_testo: perTesto,
        motivo_priorita: perTesto ? (testoPriorita || 'indicata nel file') : (riga.giallo ? 'evidenziata' : ''),
        file_immesso: dataDaValore(val(riga, c.immesso)),
        file_produttore: String(val(riga, c.produttore) ?? '').trim(),
        file_punto: String(val(riga, c.punto) ?? '').trim(),
        file_comune: String(val(riga, c.comune) ?? '').trim(),
        file_provincia: String(val(riga, c.provincia) ?? '').trim(),
        file_classe: classeNormalizzata(val(riga, c.prodotto)),
      });
    }
    if (righeFoglio > 0) fogliLetti.push({ file: foglio.file, foglio: foglio.nome, righe: righeFoglio });
  }

  // Se e' evidenziata l'intera lista l'evidenziazione non indica priorita'.
  const gialle = righe.filter(r => r.giallo).length;
  const evidenziazioneValida = !(righe.length > 3 && gialle === righe.length);
  if (!evidenziazioneValida) avvisi.push('Tutte le righe della lista sono evidenziate: l\'evidenziazione non e\' stata considerata una priorita\'.');
  if (duplicati > 0) avvisi.push(`${duplicati} ${duplicati === 1 ? 'ordine compare' : 'ordini compaiono'} piu' volte nei file: e' stata tenuta la prima occorrenza.`);

  righe.forEach((r, i) => {
    r.posizione = i + 1;
    r.prioritaria = r.priorita_testo || (evidenziazioneValida && r.giallo);
    if (!r.prioritaria) r.motivo_priorita = '';
  });

  return { righe, avvisi, fogli: fogliLetti };
}

/**
 * Completa le righe della lista con i dati del gestionale al momento del
 * caricamento. Gli assegnati si svuotano man mano che gli ordini vengono chiusi,
 * quindi data di immissione, produttore, classe e quantita' si fissano ora.
 */
export function arricchisciLista(righe, assegnati, terminati) {
  const perIdAss = new Map(assegnati.map(a => [a.id_ordine, a]));
  const perIdTer = new Map(terminati.map(t => [t.id_ordine, t]));
  return righe.map(r => {
    const a = perIdAss.get(r.id_ordine);
    const t = perIdTer.get(r.id_ordine);
    const fonte = a || t || {};
    const provincia = fonte.provincia || r.file_provincia || '';
    return {
      posizione: r.posizione,
      id_ordine: r.id_ordine,
      prioritaria: r.prioritaria,
      motivo_priorita: r.motivo_priorita,
      file: r.file,
      foglio: r.foglio,
      riga_excel: r.riga_excel,
      canale: fonte.canale || null,
      data_immissione: fonte.immesso || r.file_immesso || null,
      produttore: fonte.produttore || r.file_produttore || r.file_punto || '',
      comune: fonte.comune || r.file_comune || '',
      provincia,
      regione: fonte.regione || getRegioneFromProvincia(provincia) || '',
      classe: fonte.classe || r.file_classe || null,
      pdr: fonte.pdr || '',
      trasportatore_assegnato: a ? a.trasportatore : '',
      stato_al_caricamento: a ? 'assegnata' : t ? 'gia_evasa' : 'non_riconosciuta',
    };
  });
}

// === storia del raccoglitore ===

const mediana = (valori) => {
  if (!valori.length) return null;
  const v = [...valori].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

// Le statistiche si basano solo sul peso effettivo a destinazione. Quantita' e
// pesi stimati li inserisce il punto di raccolta e spesso non corrispondono a
// cio' che viene ritirato; anche il numero di pezzi puo' essere fuorviante. Per
// classe si usa la mediana dei formulari, che non si lascia falsare da pochi
// valori anomali.
function statistiche(movimenti) {
  const perClasse = new Map();
  const viaggi = new Map();
  const mezzi = new Map();
  let kg = 0;
  for (const m of movimenti) {
    kg += m.kg;
    const c = m.classe || 'N/D';
    if (!perClasse.has(c)) perClasse.set(c, { ordini: 0, kg: 0, pesi: [] });
    const s = perClasse.get(c);
    s.ordini++;
    s.kg += m.kg;
    if (m.kg > 0) s.pesi.push(m.kg);
    const chiaveViaggio = m.fine + '|' + (m.automezzo || m.id_ordine);
    if (!viaggi.has(chiaveViaggio)) viaggi.set(chiaveViaggio, { kg: 0, ordini: 0, automezzo: m.automezzo });
    const v = viaggi.get(chiaveViaggio);
    v.kg += m.kg;
    v.ordini++;
  }
  for (const v of viaggi.values()) {
    if (!v.automezzo) continue;
    if (!mezzi.has(v.automezzo)) mezzi.set(v.automezzo, { automezzo: v.automezzo, viaggi: 0, kg: 0, kg_max: 0 });
    const z = mezzi.get(v.automezzo);
    z.viaggi++;
    z.kg += v.kg;
    z.kg_max = Math.max(z.kg_max, v.kg);
  }
  const classi = {};
  for (const [c, s] of perClasse) {
    const pesoTipico = mediana(s.pesi);
    classi[c] = {
      ordini: s.ordini,
      kg: s.kg,
      kg_medio_ordine: pesoTipico !== null ? Math.round(pesoTipico) : null,
    };
  }
  return {
    ordini: movimenti.length,
    kg,
    viaggi: viaggi.size,
    kg_per_viaggio: viaggi.size ? Math.round(kg / viaggi.size) : null,
    ordini_per_viaggio: viaggi.size ? Math.round((movimenti.length / viaggi.size) * 10) / 10 : null,
    classi,
    mezzi: [...mezzi.values()].map(z => ({ automezzo: z.automezzo, viaggi: z.viaggi, kg_medio: Math.round(z.kg / z.viaggi), kg_max: z.kg_max }))
      .sort((a, b) => b.viaggi - a.viaggi),
  };
}

// === controllo ===

/**
 * Controlla l'evasione di una lista.
 *
 * @param lista        { righe (arricchite), caricata_il }
 * @param raccoglitore { chiave, nome }
 * @param terminati    primarie terminate normalizzate, rete e ACI
 * @param assegnati    ordini assegnati attuali normalizzati, rete e ACI
 * @param altreListe   [{ chiave, nome, ids: Set }] liste degli altri raccoglitori nello stesso mese
 * @param targetKg     target del gestionale, oppure null
 */
export function controllaLista({ lista, raccoglitore, anno, mese, oggi, terminati, assegnati, altreListe, targetKg }) {
  const inizioMese = primoGiorno(anno, mese);
  const fineMese = ultimoGiorno(anno, mese);
  const caricataIl = ymd(lista.caricata_il) || inizioMese;
  const chiave = raccoglitore.chiave;

  // Orizzonte dei dati: l'ultima fine trasporto presente nelle primarie caricate.
  let datiAl = null;
  for (const t of terminati) if (t.fine && t.fine <= oggi && (!datiAl || t.fine > datiAl)) datiAl = t.fine;
  const finestraA = datiAl && datiAl < fineMese ? datiAl : fineMese;

  const perId = new Map();
  for (const t of terminati) if (t.fine) perId.set(t.id_ordine, t);
  const assegnatiPerId = new Map(assegnati.map(a => [a.id_ordine, a]));

  // --- stato di ogni richiesta ---
  const righe = lista.righe.map(r => {
    const t = perId.get(r.id_ordine);
    const a = assegnatiPerId.get(r.id_ordine);
    const base = { ...r, stato: null, chiusa_il: null, chiusa_da: '', kg: null, automezzo: '', saltate: 0, saltate_ids: [], stima_kg: null };
    if (t) {
      base.chiusa_il = t.fine;
      base.chiusa_da = t.trasportatore;
      base.kg = t.kg;
      base.automezzo = t.automezzo;
      if (t.fine < inizioMese) base.stato = 'evasa_prima';
      else base.stato = t.chiaveTrasp === chiave ? 'evasa' : 'evasa_da_altri';
    } else if (a) {
      base.stato = a.chiaveTrasp && a.chiaveTrasp !== chiave ? 'riassegnata' : 'aperta';
      if (base.stato === 'riassegnata') base.chiusa_da = a.trasportatore;
    } else {
      base.stato = 'non_piu_presente';
    }
    return base;
  });

  // --- cronologia: prima le prioritarie, poi l'ordine della lista ---
  const ordinate = [...righe].sort((x, y) => (Number(y.prioritaria) - Number(x.prioritaria)) || (x.posizione - y.posizione));
  const rango = new Map(ordinate.map((r, i) => [r.id_ordine, i]));
  // Una richiesta chiusa il giorno D salta quelle che la precedono e che a fine
  // giornata D erano ancora da evadere. Le chiusure dello stesso giorno non si
  // saltano a vicenda: un giro di raccolta ne chiude diverse insieme. Il
  // confronto si fa nella stessa regione, perche' un raccoglitore che lavora in
  // piu' regioni organizza i giri per zona.
  const saltateDa = (o) => ordinate.filter(e => rango.get(e.id_ordine) < rango.get(o.id_ordine)
    && e.stato !== 'non_piu_presente' && e.stato !== 'evasa_prima'
    && (!o.regione || !e.regione || e.regione === o.regione)
    && (!e.chiusa_il || e.chiusa_il > o.chiusa_il));
  for (const o of righe) {
    if (o.stato !== 'evasa') continue;
    const saltate = saltateDa(o);
    o.saltate = saltate.length;
    o.saltate_ids = saltate.slice(0, 5).map(e => e.id_ordine);
  }

  // --- raccolto del mese e fuori lista ---
  const idsLista = new Set(righe.map(r => r.id_ordine));
  const delMese = terminati.filter(t => t.chiaveTrasp === chiave && t.fine && t.fine >= inizioMese && t.fine <= fineMese);
  const raccoltoKg = delMese.reduce((s, t) => s + t.kg, 0);
  const fuoriLista = delMese.filter(t => !idsLista.has(t.id_ordine)).map(t => {
    const altra = altreListe.find(l => l.chiave !== chiave && l.ids.has(t.id_ordine));
    return {
      id_ordine: t.id_ordine, chiusa_il: t.fine, kg: t.kg, produttore: t.produttore, comune: t.comune, provincia: t.provincia, classe: t.classe,
      immesso: t.immesso,
      tipo: altra ? 'lista_altrui' : (t.immesso && t.immesso > caricataIl ? 'nuova' : 'precedente'),
      lista_di: altra ? altra.nome : '',
    };
  }).sort((x, y) => String(x.chiusa_il).localeCompare(String(y.chiusa_il)));

  // --- storia dell'anno ---
  const terminatiAnno = terminati.filter(t => t.fine && t.fine.slice(0, 4) === String(anno) && t.fine <= finestraA);
  const propriAnno = terminatiAnno.filter(t => t.chiaveTrasp === chiave);
  let storicoMovimenti = propriAnno.filter(t => t.fine < inizioMese);
  let storicoFinoA = aggiungiGiorni(inizioMese, -1);
  if (storicoMovimenti.length < 10) { storicoMovimenti = propriAnno; storicoFinoA = finestraA; }
  const storico = statistiche(storicoMovimenti);
  const generale = statistiche(terminatiAnno);
  const inizioAttivita = storicoMovimenti.reduce((m, t) => (!m || t.fine < m ? t.fine : m), null);
  const giorniStorico = inizioAttivita ? giorniLavorativi(inizioAttivita < `${anno}-01-01` ? `${anno}-01-01` : inizioAttivita, storicoFinoA) : 0;
  storico.giorni_lavorativi = giorniStorico;
  storico.kg_per_giorno = giorniStorico ? Math.round(storico.kg / giorniStorico) : null;
  storico.viaggi_per_giorno = giorniStorico ? Math.round((storico.viaggi / giorniStorico) * 100) / 100 : null;

  // --- stima del peso delle richieste aperte ---
  // Solo valori a fine trasporto. Per prima cosa i ritiri gia' fatti nell'anno
  // presso lo stesso punto di raccolta, chiunque li abbia eseguiti: il suo
  // piazzale e le sue gomme restano quelli. In mancanza, il peso effettivo tipico
  // di un formulario di quella classe per il raccoglitore, e se ne ha pochi per
  // tutti i raccoglitori.
  const perPdr = new Map();
  for (const t of terminatiAnno) {
    if (!t.pdr || !t.kg) continue;
    for (const k of [t.pdr + '|' + (t.classe || 'N/D'), t.pdr]) {
      if (!perPdr.has(k)) perPdr.set(k, []);
      perPdr.get(k).push(t.kg);
    }
  }
  const stima = (r) => {
    const stessaClasse = r.pdr ? perPdr.get(r.pdr + '|' + (r.classe || 'N/D')) : null;
    if (stessaClasse && stessaClasse.length >= 2) return { kg: Math.round(mediana(stessaClasse)), metodo: `ritiri effettivi di questo punto di raccolta, ${stessaClasse.length} nell'anno` };
    const qualsiasi = r.pdr ? perPdr.get(r.pdr) : null;
    if (qualsiasi && qualsiasi.length >= 2) return { kg: Math.round(mediana(qualsiasi)), metodo: `ritiri effettivi di questo punto di raccolta, altre classi, ${qualsiasi.length} nell'anno` };
    const propria = storico.classi[r.classe || 'N/D'];
    if (propria && propria.ordini >= MINIMO_ORDINI_CLASSE && propria.kg_medio_ordine) return { kg: propria.kg_medio_ordine, metodo: 'peso effettivo tipico della classe per il raccoglitore' };
    const tutti = generale.classi[r.classe || 'N/D'];
    if (tutti && tutti.kg_medio_ordine) return { kg: tutti.kg_medio_ordine, metodo: 'peso effettivo tipico della classe per tutti i raccoglitori' };
    if (storico.ordini) return { kg: Math.round(storico.kg / storico.ordini), metodo: 'peso effettivo medio per ordine del raccoglitore' };
    return { kg: null, metodo: 'nessun dato effettivo disponibile' };
  };

  // --- previsione ---
  const giorniTotali = giorniLavorativi(inizioMese, fineMese);
  const giorniTrascorsi = datiAl && datiAl >= inizioMese ? giorniLavorativi(inizioMese, finestraA) : 0;
  const meseConcluso = !!datiAl && datiAl >= fineMese;
  const giorniResidui = meseConcluso ? 0 : Math.max(0, giorniTotali - giorniTrascorsi);
  const ritmoMese = giorniTrascorsi > 0 ? Math.round(raccoltoKg / giorniTrascorsi) : null;
  let ritmo;
  if (giorniTrascorsi >= 5 && ritmoMese !== null && storico.kg_per_giorno) ritmo = Math.round((ritmoMese + storico.kg_per_giorno) / 2);
  else ritmo = storico.kg_per_giorno ?? ritmoMese ?? 0;
  const capacitaResidua = ritmo * giorniResidui;
  const proiezioneKg = raccoltoKg + capacitaResidua;

  const target = targetKg || null;
  const targetResiduo = target ? Math.max(0, target - raccoltoKg) : null;

  const aperte = ordinate.filter(r => r.stato === 'aperta');
  let cumulato = 0, evadibiliRitmo = 0, evadibiliTarget = 0;
  for (const r of aperte) {
    const s = stima(r);
    r.stima_kg = s.kg;
    r.metodo_stima = s.metodo;
    cumulato += s.kg || 0;
    r.entro_capacita = cumulato <= capacitaResidua;
    r.entro_target = targetResiduo !== null ? cumulato <= targetResiduo : null;
    if (r.entro_capacita) evadibiliRitmo++;
    if (r.entro_target) evadibiliTarget++;
  }
  const kgAperte = cumulato;
  const kgViaggio = storico.kg_per_viaggio || null;

  const previsione = {
    dati_al: datiAl,
    giorni_totali: giorniTotali,
    giorni_trascorsi: giorniTrascorsi,
    giorni_residui: giorniResidui,
    ritmo_mese_kg_giorno: ritmoMese,
    ritmo_storico_kg_giorno: storico.kg_per_giorno,
    ritmo_usato_kg_giorno: ritmo,
    capacita_residua_kg: capacitaResidua,
    proiezione_kg: proiezioneKg,
    target_kg: target,
    target_residuo_kg: targetResiduo,
    percentuale_proiezione: target ? Math.round((proiezioneKg / target) * 1000) / 10 : null,
    kg_richieste_aperte: kgAperte,
    portafoglio_sufficiente: targetResiduo !== null ? kgAperte >= targetResiduo : null,
    evadibili_ritmo: evadibiliRitmo,
    evadibili_target: evadibiliTarget,
    kg_per_viaggio: kgViaggio,
    viaggi_necessari: targetResiduo !== null && kgViaggio ? Math.ceil(targetResiduo / kgViaggio) : null,
    viaggi_possibili: storico.viaggi_per_giorno ? Math.floor(storico.viaggi_per_giorno * giorniResidui) : null,
  };

  // --- per regione, quando la lista ne tocca piu' d'una ---
  const regioni = [...new Set(righe.map(r => r.regione).filter(Boolean))];
  const perRegione = regioni.length > 1 ? regioni.map(reg => ({
    regione: reg,
    richieste: righe.filter(r => r.regione === reg).length,
    evase: righe.filter(r => r.regione === reg && r.stato === 'evasa').length,
    aperte: righe.filter(r => r.regione === reg && r.stato === 'aperta').length,
    raccolto_kg: delMese.filter(t => t.regione === reg).reduce((s, t) => s + t.kg, 0),
  })).sort((a, b) => b.richieste - a.richieste) : [];

  // --- conteggi ---
  const conta = (stato) => righe.filter(r => r.stato === stato).length;
  const fuoriOrdine = righe.filter(r => r.stato === 'evasa' && r.saltate > 0);
  const giorniDallInvio = giorniLavorativi(aggiungiGiorni(caricataIl, 1), finestraA);
  const prioritarieAperte = righe.filter(r => r.prioritaria && r.stato === 'aperta');

  // --- alert ---
  const alert = [];
  const aggiungi = (gravita, tipo, messaggio) => alert.push({ gravita, tipo, messaggio });
  const elenco = (lista, n = 4) => lista.slice(0, n).join(', ') + (lista.length > n ? ` e altri ${lista.length - n}` : '');

  if (!target) aggiungi('alta', 'target', 'Target mensile non impostato: la previsione rispetto al target non si puo\' calcolare. Inseriscilo accanto al nome del raccoglitore.');
  if (prioritarieAperte.length && giorniDallInvio >= GIORNI_TOLLERANZA_PRIORITARIE) {
    aggiungi('alta', 'prioritarie', `${prioritarieAperte.length} ${prioritarieAperte.length === 1 ? 'richiesta prioritaria ancora aperta' : 'richieste prioritarie ancora aperte'} dopo ${giorniDallInvio} giorni lavorativi dall'invio: ${elenco(prioritarieAperte.map(r => r.id_ordine))}.`);
  }
  if (target && giorniTrascorsi >= 5 && !meseConcluso && proiezioneKg < target * SOGLIA_PROIEZIONE) {
    aggiungi('alta', 'proiezione', `A questo ritmo chiude il mese a ${kgT(proiezioneKg)}, il ${previsione.percentuale_proiezione}% del target di ${kgT(target)}.`);
  }
  if (meseConcluso && target && raccoltoKg < target) {
    aggiungi('alta', 'proiezione', `Mese chiuso a ${kgT(raccoltoKg)}, il ${Math.round((raccoltoKg / target) * 1000) / 10}% del target di ${kgT(target)}.`);
  }
  if (fuoriOrdine.length) {
    const totaleSaltate = new Set(fuoriOrdine.flatMap(r => saltateDa(r).map(e => e.id_ordine))).size;
    aggiungi('media', 'cronologia', `${fuoriOrdine.length} ${fuoriOrdine.length === 1 ? 'richiesta evasa' : 'richieste evase'} fuori ordine, saltando ${totaleSaltate} ${totaleSaltate === 1 ? 'richiesta precedente ancora aperta' : 'richieste precedenti ancora aperte'} in quel momento.`);
  }
  const precedenti = fuoriLista.filter(f => f.tipo === 'precedente');
  if (precedenti.length) aggiungi('media', 'fuori_lista', `${precedenti.length} ${precedenti.length === 1 ? 'ordine evaso' : 'ordini evasi'} fuori lista, gia' esistenti all'invio della lista: ${elenco(precedenti.map(f => f.id_ordine))}.`);
  const altrui = fuoriLista.filter(f => f.tipo === 'lista_altrui');
  if (altrui.length) aggiungi('media', 'fuori_lista', `${altrui.length} ${altrui.length === 1 ? 'ordine evaso proveniva' : 'ordini evasi provenivano'} dalla lista di altri raccoglitori: ${elenco(altrui.map(f => `${f.id_ordine} di ${f.lista_di}`), 3)}.`);
  if (target && targetResiduo > 0 && previsione.portafoglio_sufficiente === false && !meseConcluso) {
    aggiungi('media', 'portafoglio', `Le richieste ancora aperte valgono circa ${kgT(kgAperte)}, meno dei ${kgT(targetResiduo)} che mancano al target.`);
  }
  if (aperte.length && !meseConcluso && evadibiliRitmo < aperte.length && giorniTrascorsi > 0) {
    aggiungi('media', 'capacita', `Al ritmo stimato di ${kgT(ritmo)} al giorno potra' evadere circa ${evadibiliRitmo} delle ${aperte.length} richieste aperte entro fine mese.`);
  }
  const daAltri = righe.filter(r => r.stato === 'evasa_da_altri');
  if (daAltri.length) {
    const chi = new Map();
    for (const r of daAltri) chi.set(r.chiusa_da, (chi.get(r.chiusa_da) || 0) + 1);
    aggiungi('info', 'da_altri', `${daAltri.length} ${daAltri.length === 1 ? 'richiesta della lista chiusa' : 'richieste della lista chiuse'} da altri raccoglitori: ${[...chi.entries()].map(([n, c]) => `${n} (${c})`).join(', ')}.`);
  }
  const riassegnate = righe.filter(r => r.stato === 'riassegnata');
  if (riassegnate.length) aggiungi('info', 'riassegnate', `${riassegnate.length} ${riassegnate.length === 1 ? 'richiesta della lista risulta ora assegnata' : 'richieste della lista risultano ora assegnate'} ad altri: ${elenco(riassegnate.map(r => `${r.id_ordine} a ${r.chiusa_da}`), 3)}.`);
  const sparite = righe.filter(r => r.stato === 'non_piu_presente');
  if (sparite.length) aggiungi('info', 'non_presenti', `${sparite.length} ${sparite.length === 1 ? 'richiesta non e\' piu\'' : 'richieste non sono piu\''} ne' tra gli assegnati ne' tra i terminati, probabilmente annullate: ${elenco(sparite.map(r => r.id_ordine))}.`);
  const nuove = fuoriLista.filter(f => f.tipo === 'nuova');
  if (nuove.length) aggiungi('info', 'nuove', `${nuove.length} ${nuove.length === 1 ? 'ordine evaso e\' stato immesso' : 'ordini evasi sono stati immessi'} dopo l'invio della lista.`);
  const nonRiconosciute = righe.filter(r => r.stato_al_caricamento === 'non_riconosciuta');
  if (nonRiconosciute.length) aggiungi('info', 'non_riconosciute', `${nonRiconosciute.length} ${nonRiconosciute.length === 1 ? 'ID della lista non corrispondeva' : 'ID della lista non corrispondevano'} a nessun ordine al momento del caricamento: ${elenco(nonRiconosciute.map(r => r.id_ordine))}.`);

  const PESO = { alta: 0, media: 1, info: 2 };
  alert.sort((x, y) => PESO[x.gravita] - PESO[y.gravita]);

  return {
    riepilogo: {
      richieste: righe.length,
      evase: conta('evasa'),
      evase_da_altri: daAltri.length,
      aperte: aperte.length,
      prioritarie_aperte: prioritarieAperte.length,
      fuori_ordine: fuoriOrdine.length,
      fuori_lista: fuoriLista.length,
      non_piu_presenti: sparite.length,
      riassegnate: riassegnate.length,
      raccolto_kg: raccoltoKg,
      target_kg: target,
      proiezione_kg: proiezioneKg,
      evadibili_ritmo: evadibiliRitmo,
      evadibili_target: evadibiliTarget,
      alert_alti: alert.filter(a => a.gravita === 'alta').length,
      alert_totali: alert.length,
      dati_al: datiAl,
    },
    alert,
    esito: {
      righe: ordinate.map(r => ({
        posizione: r.posizione, id_ordine: r.id_ordine, prioritaria: r.prioritaria, motivo_priorita: r.motivo_priorita,
        data_immissione: r.data_immissione, produttore: r.produttore, comune: r.comune, provincia: r.provincia, regione: r.regione,
        classe: r.classe, canale: r.canale, stato: r.stato, chiusa_il: r.chiusa_il, chiusa_da: r.chiusa_da,
        kg: r.kg, automezzo: r.automezzo, saltate: r.saltate, saltate_ids: r.saltate_ids,
        stima_kg: r.stima_kg, metodo_stima: r.metodo_stima || '', entro_capacita: r.entro_capacita ?? null, entro_target: r.entro_target ?? null,
      })),
      fuori_lista: fuoriLista,
      previsione,
      storico: {
        ordini: storico.ordini, kg: storico.kg, viaggi: storico.viaggi, kg_per_viaggio: storico.kg_per_viaggio,
        ordini_per_viaggio: storico.ordini_per_viaggio, giorni_lavorativi: storico.giorni_lavorativi,
        kg_per_giorno: storico.kg_per_giorno, viaggi_per_giorno: storico.viaggi_per_giorno,
        classi: storico.classi, mezzi: storico.mezzi.slice(0, 12),
      },
      per_regione: perRegione,
      data_riferimento: itData(datiAl),
    },
  };
}
