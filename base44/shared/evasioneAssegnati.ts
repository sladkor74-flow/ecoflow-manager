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
// La lista e' dimensionata sul target: tante richieste quante ne servono al peso
// tipico di un ritiro, anche se il raccoglitore ha molti piu' ordini assegnati.
// Una richiesta puo' essere cancellata sul portale per ordine doppio, PDR
// inesistente, raccolta rifiutata, ritiro gia' eseguito da altri o aggiornamento
// del portale: risulta annullata con il suo motivo e non pesa sul raccoglitore,
// ma quando le aperte non bastano piu' al target servono nuove richieste.
//
// Chi deve evadere una richiesta lo stabilisce la lista, anche se sul portale
// l'ordine e' assegnato a un altro trasportatore: puo' capitare che un altro
// raccoglitore la evada, ma una richiesta si evade una sola volta. L'ordine di
// evasione si valuta per provincia: prima le prioritarie, poi dalla richiesta
// immessa per prima.
//
// Una richiesta resta assegnata sul portale finche' non viene cancellata o chiusa
// come terminata, e il raccoglitore chiude i ritiri qualche giorno dopo il
// trasporto. Le primarie sono complete solo fino a qualche giorno prima
// dell'estrazione del file: cronologia, trascurate, prioritarie e ritmo del mese
// si valutano fino a quella data, perche' dopo una richiesta aperta puo' essere
// gia' ritirata ma non ancora chiusa.
//
// La data di evasione e' quella di fine trasporto, come in tutto il gestionale.
//
// Rete, ACI ed extra raccolta restano sempre separati. Le liste e il target
// riguardano la sola rete: gli ACI non hanno target e non si mandano in lista, ma
// una richiesta ACI aperta va segnalata perche' il raccoglitore la evada subito.
// Le richieste di extra raccolta si inseriscono a mano nel modulo Extra Raccolta
// come assegnate e si seguono allo stesso modo.

import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { getRegioneFromProvincia } from "./dataEnrichment.ts";
import { classeNormalizzata, nomiCoincidono, aggiungiGiorni, giorniTra, dataDaValore } from "./reportSettimanali.ts";

export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const RE_ID_ORDINE = /^[A-Z]{2}[0-9]{6,10}$/;

// Giorni lavorativi da cui una richiesta prioritaria aperta diventa un alert.
const GIORNI_TOLLERANZA_PRIORITARIE = 5;
// Sotto questa percentuale di target a fine mese la proiezione diventa un alert.
const SOGLIA_PROIEZIONE = 0.9;
// Ordini minimi di una classe perche' la statistica del raccoglitore sia usata.
const MINIMO_ORDINI_CLASSE = 8;
// Peso indicativo di un ritiro, il cassone di una motrice con ragno, quando il
// raccoglitore non ha ancora formulari nell'anno.
const KG_RITIRO_INDICATIVO = 4000;
// Limiti dei giorni entro cui un raccoglitore chiude i ritiri sul portale.
const RITARDO_CHIUSURA_MINIMO = 2;
const RITARDO_CHIUSURA_MASSIMO = 7;

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

// Alcuni raccoglitori lavorano anche il sabato: per loro il sabato conta.
export function lavorativo(ymd, sabato = false) {
  const giorno = new Date(ymd + 'T00:00:00Z').getUTCDay();
  const feriale = (giorno >= 1 && giorno <= 5) || (sabato && giorno === 6);
  return feriale && !festivita(+ymd.slice(0, 4)).has(ymd);
}

// Giorni lavorativi fra due date comprese; zero se l'intervallo e' vuoto.
export function giorniLavorativi(da, a, sabato = false) {
  if (!da || !a || da > a) return 0;
  let n = 0;
  for (let d = da; d <= a; d = aggiungiGiorni(d, 1)) if (lavorativo(d, sabato)) n++;
  return n;
}

// Un raccoglitore lavora di sabato se nell'anno ha chiuso formulari in almeno
// quattro sabati e in almeno un sabato su quattro.
function lavoraDiSabato(movimenti, da, a) {
  const sabatiAttivi = new Set(movimenti.filter(m => new Date(m.fine + 'T00:00:00Z').getUTCDay() === 6).map(m => m.fine)).size;
  let sabati = 0;
  for (let d = da; d && a && d <= a; d = aggiungiGiorni(d, 1)) if (new Date(d + 'T00:00:00Z').getUTCDay() === 6) sabati++;
  return sabatiAttivi >= 4 && sabati > 0 && sabatiAttivi / sabati >= 0.25;
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
    chiuso: ymd(r.ordine_chiuso_il),
    kg: Math.round(Number(r.peso_effettivo) || 0),
    pdr: chiavePdr(r),
    classe: classeNormalizzata(r.classe) || classeNormalizzata(r.prodotto),
    automezzo: targa(r.automezzo),
    produttore: String(r.ragione_sociale || r.punto_di_raccolta || r.produttore || '').trim(),
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
    produttore: String(r.ragione_sociale || r.punto_di_raccolta || r.produttore || '').trim(),
    punto_raccolta: String(r.punto_di_raccolta || '').trim(),
    comune: String(r.comune || '').trim(),
    provincia: String(r.provincia || '').trim(),
    regione: String(r.regione || r.regioni || getRegioneFromProvincia(r.provincia) || '').trim(),
    classe: classeNormalizzata(r.classe) || classeNormalizzata(r.prodotto),
    pdr: chiavePdr(r),
  };
}

// Ordine cancellato sul portale, con il motivo della cancellazione.
export function normalizzaCancellato(r, canale) {
  const motivo = String(r.motivo_cancellazione || '').replace(/^altro\s*:\s*/i, '').trim();
  return { ...normalizzaAssegnato(r, canale), motivo: motivo ? motivo[0].toUpperCase() + motivo.slice(1) : '' };
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
  const visti = new Map();
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
    // Prima i nomi esatti, poi quelli che li contengono, esclusi codici e ID.
    const colonna = (...nomi) => {
      for (const n of nomi) if (indiciColonne[n] !== undefined) return indiciColonne[n];
      for (const n of nomi) for (const [t, j] of Object.entries(indiciColonne)) if (t.includes(n) && !/^(id|codice)_/.test(t)) return j;
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
    // Un file o un foglio con priorita' o urgente nel nome contiene solo prioritarie.
    const prioritarioPerNome = /priorit|urgent/i.test(`${foglio.file || ''} ${foglio.nome || ''}`);

    let righeFoglio = 0;
    for (const riga of foglio.righe) {
      const id = String((riga.c || [])[colonnaId] ?? '').trim().toUpperCase();
      if (!RE_ID_ORDINE.test(id)) continue;
      const testoRiga = (riga.c || []).map(v => String(v ?? '')).join(' ');
      const testoPriorita = String(val(riga, c.priorita) ?? '').trim();
      const perTesto = prioritarioPerNome || /priorit|urgent/i.test(testoRiga) || (!!testoPriorita && !/^(no|0|false)$/i.test(testoPriorita));
      const motivoTesto = prioritarioPerNome ? `file ${foglio.file}` : (testoPriorita || 'indicata nel file');
      // Un ordine ripetuto resta dove compare la prima volta, ma se altrove e'
      // indicato come prioritario lo diventa.
      if (visti.has(id)) {
        duplicati++;
        const prima = visti.get(id);
        if (perTesto && !prima.priorita_testo) { prima.priorita_testo = true; prima.motivo_priorita = motivoTesto; }
        if (riga.giallo) prima.giallo = true;
        continue;
      }
      righeFoglio++;
      const nuova = {
        id_ordine: id,
        file: foglio.file,
        foglio: foglio.nome,
        riga_excel: riga.r,
        giallo: !!riga.giallo,
        priorita_testo: perTesto,
        motivo_priorita: perTesto ? motivoTesto : (riga.giallo ? 'evidenziata' : ''),
        file_immesso: dataDaValore(val(riga, c.immesso)),
        file_produttore: String(val(riga, c.produttore) ?? '').trim(),
        file_punto: String(val(riga, c.punto) ?? '').trim(),
        file_comune: String(val(riga, c.comune) ?? '').trim(),
        file_provincia: String(val(riga, c.provincia) ?? '').trim(),
        file_classe: classeNormalizzata(val(riga, c.prodotto)),
      };
      visti.set(id, nuova);
      righe.push(nuova);
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
    else if (!r.motivo_priorita) r.motivo_priorita = 'evidenziata';
  });

  return { righe, avvisi, fogli: fogliLetti };
}

/**
 * Completa le righe della lista con i dati del gestionale al momento del
 * caricamento. Gli assegnati si svuotano man mano che gli ordini vengono chiusi,
 * quindi data di immissione, produttore, classe e quantita' si fissano ora.
 */
export function arricchisciLista(righe, assegnati, terminati, cancellati = []) {
  const perIdAss = new Map(assegnati.map(a => [a.id_ordine, a]));
  const perIdTer = new Map(terminati.map(t => [t.id_ordine, t]));
  const perIdCanc = new Map(cancellati.map(c => [c.id_ordine, c]));
  return righe.map(r => {
    const a = perIdAss.get(r.id_ordine);
    const t = perIdTer.get(r.id_ordine);
    const c = perIdCanc.get(r.id_ordine);
    const fonte = a || t || c || {};
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
      stato_al_caricamento: a ? 'assegnata' : t ? 'gia_evasa' : c ? 'annullata' : 'non_riconosciuta',
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
  const pesoMediano = mediana(movimenti.map(m => m.kg).filter(k => k > 0));
  return {
    ordini: movimenti.length,
    kg,
    kg_mediano_ordine: pesoMediano !== null ? Math.round(pesoMediano) : null,
    viaggi: viaggi.size,
    kg_per_viaggio: viaggi.size ? Math.round(kg / viaggi.size) : null,
    ordini_per_viaggio: viaggi.size ? Math.round((movimenti.length / viaggi.size) * 10) / 10 : null,
    classi,
    mezzi: [...mezzi.values()].map(z => ({ automezzo: z.automezzo, viaggi: z.viaggi, kg_medio: Math.round(z.kg / z.viaggi), kg_max: z.kg_max }))
      .sort((a, b) => b.viaggi - a.viaggi),
  };
}

// Giorni entro cui il raccoglitore chiude sul portale nove ritiri su dieci, dai
// suoi formulari dell'anno o, se ne ha pochi, da quelli di tutti. Zero se le
// primarie non portano la data di chiusura: in quel caso non si puo' misurare.
function ritardoChiusura(propri, tutti, anno) {
  const ritardi = (mov) => mov.filter(t => t.canale !== 'extra' && t.chiuso && t.fine && t.fine.slice(0, 4) === String(anno) && t.chiuso >= t.fine)
    .map(t => giorniTra(t.fine, t.chiuso));
  let v = ritardi(propri);
  if (v.length < MINIMO_ORDINI_CLASSE) v = ritardi(tutti);
  if (!v.length) return 0;
  v.sort((a, b) => a - b);
  const p90 = v[Math.min(v.length - 1, Math.floor(v.length * 0.9))];
  return Math.min(RITARDO_CHIUSURA_MASSIMO, Math.max(RITARDO_CHIUSURA_MINIMO, Math.ceil(p90)));
}

// === controllo ===

/**
 * Controlla l'evasione di una lista.
 *
 * @param lista        { righe (arricchite), caricata_il }
 * @param raccoglitore { chiave, nome }
 * @param terminati    primarie terminate normalizzate, rete e ACI
 * @param assegnati    ordini assegnati attuali normalizzati, rete e ACI
 * @param altreListe   [{ chiave, nome, ids: Set, caricata_il }] liste degli altri raccoglitori nello stesso mese
 * @param targetKg     target del gestionale, oppure null
 * @param cancellati   ordini cancellati sul portale normalizzati, con il motivo
 */
export function controllaLista({ lista, raccoglitore, anno, mese, oggi, terminati, assegnati, altreListe, targetKg, cancellati = [] }) {
  const inizioMese = primoGiorno(anno, mese);
  const fineMese = ultimoGiorno(anno, mese);
  // Data in cui la lista e' stata inviata al raccoglitore; per le liste caricate
  // senza, quella di caricamento.
  const caricataIl = ymd(lista.inviata_il) || ymd(lista.caricata_il) || inizioMese;
  const chiave = raccoglitore.chiave;
  // Liste, target e previsione riguardano la sola rete.
  const rete = terminati.filter(t => t.canale === 'rete');

  // Orizzonte dei dati: l'ultima fine trasporto presente nelle primarie caricate.
  // L'extra raccolta, inserita a mano, non lo sposta.
  let datiAl = null;
  for (const t of terminati) if (t.canale !== 'extra' && t.fine && t.fine <= oggi && (!datiAl || t.fine > datiAl)) datiAl = t.fine;
  const finestraA = datiAl && datiAl < fineMese ? datiAl : fineMese;

  // Dati completi: fino alla data di estrazione del file, cioe' l'ultima chiusura
  // sul portale, meno i giorni entro cui il raccoglitore chiude i suoi ritiri.
  let dataFile = null;
  for (const t of terminati) if (t.canale !== 'extra' && t.chiuso && t.chiuso <= oggi && (!dataFile || t.chiuso > dataFile)) dataFile = t.chiuso;
  const ritardo = dataFile ? ritardoChiusura(terminati.filter(t => t.chiaveTrasp === chiave), terminati, anno) : 0;
  let consolidatoAl = datiAl ? aggiungiGiorni(dataFile || datiAl, -ritardo) : aggiungiGiorni(inizioMese, -1);
  if (consolidatoAl > finestraA) consolidatoAl = finestraA;
  const consolidata = (d) => !!d && d <= consolidatoAl;

  const perId = new Map();
  for (const t of terminati) if (t.fine) perId.set(t.id_ordine, t);
  const assegnatiPerId = new Map(assegnati.map(a => [a.id_ordine, a]));
  const cancellatiPerId = new Map(cancellati.map(c => [c.id_ordine, c]));

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
      // Chi deve evadere lo stabilisce la lista, non il trasportatore indicato sul
      // portale: la richiesta passa a un altro solo se compare nella lista di un
      // altro raccoglitore caricata dopo questa.
      const spostata = altreListe.find(l => l.chiave !== chiave && l.ids.has(r.id_ordine) && String(l.caricata_il || '') > String(lista.caricata_il || ''));
      base.stato = spostata ? 'riassegnata' : 'aperta';
      if (spostata) base.chiusa_da = spostata.nome;
      else if (a.chiaveTrasp && a.chiaveTrasp !== chiave) base.assegnata_sul_portale_a = a.trasportatore;
    } else if (cancellatiPerId.has(r.id_ordine)) {
      base.stato = 'annullata';
      base.motivo_annullamento = cancellatiPerId.get(r.id_ordine).motivo || 'motivo non indicato';
    } else {
      base.stato = 'non_piu_presente';
    }
    return base;
  });

  // --- raccolto del mese e fuori lista ---
  const idsLista = new Set(righe.map(r => r.id_ordine));
  const delMese = rete.filter(t => t.chiaveTrasp === chiave && t.fine && t.fine >= inizioMese && t.fine <= fineMese);
  const raccoltoKg = delMese.reduce((s, t) => s + t.kg, 0);
  const fuoriLista = delMese.filter(t => !idsLista.has(t.id_ordine)).map(t => {
    const altra = altreListe.find(l => l.chiave !== chiave && l.ids.has(t.id_ordine));
    return {
      id_ordine: t.id_ordine, chiusa_il: t.fine, kg: t.kg, produttore: t.produttore, comune: t.comune, provincia: t.provincia, classe: t.classe,
      immesso: t.immesso, regione: t.regione, pdr: t.pdr,
      tipo: altra ? 'lista_altrui' : (t.immesso && t.immesso > caricataIl ? 'nuova' : 'precedente'),
      lista_di: altra ? altra.nome : '',
    };
  }).sort((x, y) => String(x.chiusa_il).localeCompare(String(y.chiusa_il)));

  // Un ordine evaso fuori lista presso lo stesso punto di raccolta e per la
  // stessa classe di una richiesta annullata o ancora aperta ne e' il doppione o
  // il sostituto: la richiesta risulta evasa con quell'ordine, che non conta come
  // fuori lista.
  const stessoRitiro = (e, x) => !!e.pdr && e.pdr === x.pdr && (e.classe || '') === (x.classe || '') && !e.evasa_con;
  for (const x of fuoriLista) {
    if (!x.pdr) continue;
    const r = righe.find(e => e.stato === 'annullata' && stessoRitiro(e, x)) || righe.find(e => e.stato === 'aperta' && stessoRitiro(e, x));
    if (!r) continue;
    x.tipo = 'stesso_pdr';
    x.richiesta = r.id_ordine;
    r.evasa_con = x.id_ordine;
    r.chiusa_il = x.chiusa_il;
    if (r.stato === 'aperta') {
      r.stato = 'evasa_altro_ordine';
      r.chiusa_da = raccoglitore.nome;
      r.kg = x.kg;
    }
  }
  const fuoriListaEffettivi = fuoriLista.filter(x => x.tipo !== 'stesso_pdr');
  const evasaDalRaccoglitore = (r) => r.stato === 'evasa' || r.stato === 'evasa_altro_ordine';

  // --- cronologia: per provincia, prima le prioritarie, poi la richiesta immessa per prima ---
  // Le richieste si confrontano nella stessa provincia, o in mancanza nella stessa
  // regione, perche' un raccoglitore organizza i giri per zona.
  const provinciaDi = (x) => String(x.provincia || '').trim().toUpperCase();
  const stessaZona = (a, b) => {
    const pa = provinciaDi(a), pb = provinciaDi(b);
    if (pa && pb) return pa === pb;
    return !a.regione || !b.regione || a.regione === b.regione;
  };
  const ordinate = [...righe].sort((x, y) => (Number(y.prioritaria) - Number(x.prioritaria))
    || String(x.data_immissione || '9999').localeCompare(String(y.data_immissione || '9999'))
    || (x.posizione - y.posizione));
  const rango = new Map(ordinate.map((r, i) => [r.id_ordine, i]));
  // Una richiesta chiusa il giorno D salta quelle che la precedono nella stessa
  // zona e che a fine giornata D erano ancora da evadere. Le chiusure dello stesso
  // giorno non si saltano a vicenda: un giro di raccolta ne chiude diverse
  // insieme. Una richiesta ancora aperta risulta saltata solo da chiusure con dati
  // completi: potrebbe essere gia' ritirata e non ancora chiusa sul portale.
  const saltateDa = (o) => ordinate.filter(e => rango.get(e.id_ordine) < rango.get(o.id_ordine)
    && !['non_piu_presente', 'evasa_prima', 'annullata'].includes(e.stato)
    && stessaZona(e, o)
    && (e.chiusa_il ? e.chiusa_il > o.chiusa_il : consolidata(o.chiusa_il)));
  for (const o of righe) {
    if (!evasaDalRaccoglitore(o)) continue;
    const saltate = saltateDa(o);
    o.saltate = saltate.length;
    o.saltate_ids = saltate.slice(0, 5).map(e => e.id_ordine);
  }

  // --- richieste trascurate ---
  // Una richiesta aperta e' trascurata quando, dopo l'invio della lista, il
  // raccoglitore ha evaso richieste che la seguono nella stessa provincia. Un
  // ordine evaso fuori lista scavalca invece la prima richiesta ancora aperta
  // della sua provincia, quella che andava evasa per prima. Non serve che sia
  // prioritaria o evidenziata: scavalcarla va sollecitato. Contano solo le
  // chiusure con dati completi.
  for (const e of righe) {
    e.scavalcata_successive = 0;
    e.scavalcata_fuori = 0;
    if (e.stato !== 'aperta') continue;
    e.scavalcata_successive = righe.filter(o => evasaDalRaccoglitore(o) && o.chiusa_il >= caricataIl && consolidata(o.chiusa_il) && rango.get(o.id_ordine) > rango.get(e.id_ordine) && stessaZona(o, e)).length;
  }
  for (const x of fuoriListaEffettivi) {
    if (x.chiusa_il < caricataIl || !consolidata(x.chiusa_il)) continue;
    const prima = ordinate.find(e => e.stato === 'aperta' && stessaZona(e, x));
    if (prima) prima.scavalcata_fuori++;
  }
  const trascurate = ordinate.filter(r => r.stato === 'aperta' && (r.scavalcata_successive + r.scavalcata_fuori) > 0);

  // --- storia dell'anno ---
  const terminatiAnno = rete.filter(t => t.fine && t.fine.slice(0, 4) === String(anno) && t.fine <= finestraA);
  const propriAnno = terminatiAnno.filter(t => t.chiaveTrasp === chiave);
  let storicoMovimenti = propriAnno.filter(t => t.fine < inizioMese);
  let storicoFinoA = aggiungiGiorni(inizioMese, -1);
  if (storicoMovimenti.length < 10) { storicoMovimenti = propriAnno; storicoFinoA = finestraA; }
  const storico = statistiche(storicoMovimenti);
  const generale = statistiche(terminatiAnno);
  const inizioAttivita = storicoMovimenti.reduce((m, t) => (!m || t.fine < m ? t.fine : m), null);
  const inizioStorico = inizioAttivita ? (inizioAttivita < `${anno}-01-01` ? `${anno}-01-01` : inizioAttivita) : null;
  // Il sabato si riconosce da tutti i formulari del raccoglitore, anche ACI ed extra.
  const tuttiPropri = terminati.filter(t => t.chiaveTrasp === chiave && t.fine && t.fine.slice(0, 4) === String(anno) && t.fine <= finestraA);
  const sabato = inizioStorico ? lavoraDiSabato(tuttiPropri, inizioStorico, finestraA) : false;
  const giorniStorico = inizioStorico ? giorniLavorativi(inizioStorico, storicoFinoA, sabato) : 0;
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
  const giorniTotali = giorniLavorativi(inizioMese, fineMese, sabato);
  const giorniTrascorsi = datiAl && datiAl >= inizioMese ? giorniLavorativi(inizioMese, finestraA, sabato) : 0;
  // Il ritmo del mese si misura sui giorni con dati completi; quelli successivi,
  // ancora in parte da chiudere sul portale, si stimano con il ritmo.
  const giorniConsolidati = consolidatoAl >= inizioMese ? giorniLavorativi(inizioMese, consolidatoAl, sabato) : 0;
  const kgConsolidati = delMese.filter(t => t.fine <= consolidatoAl).reduce((s, t) => s + t.kg, 0);
  const meseConcluso = !!datiAl && consolidatoAl >= fineMese;
  const giorniResidui = meseConcluso ? 0 : Math.max(0, giorniTotali - giorniTrascorsi);
  const ritmoMese = giorniConsolidati > 0 ? Math.round(kgConsolidati / giorniConsolidati) : null;
  let ritmo;
  if (giorniConsolidati >= 5 && ritmoMese !== null && storico.kg_per_giorno) ritmo = Math.round((ritmoMese + storico.kg_per_giorno) / 2);
  else ritmo = storico.kg_per_giorno ?? ritmoMese ?? 0;
  const proiezioneKg = meseConcluso ? raccoltoKg : Math.max(raccoltoKg, kgConsolidati + ritmo * Math.max(0, giorniTotali - giorniConsolidati));
  const capacitaResidua = proiezioneKg - raccoltoKg;

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
  // Peso tipico di un ritiro per dimensionare la lista sul target: la mediana dei
  // formulari del raccoglitore se ne ha abbastanza, altrimenti il cassone di una
  // motrice con ragno.
  const ritiroDaStorico = storico.ordini >= MINIMO_ORDINI_CLASSE && !!storico.kg_mediano_ordine;
  const kgRitiro = ritiroDaStorico ? storico.kg_mediano_ordine : KG_RITIRO_INDICATIVO;
  const valoreListaKg = righe.reduce((s, r) => s + (evasaDalRaccoglitore(r) ? r.kg || 0 : r.stato === 'aperta' ? r.stima_kg || 0 : 0), 0);
  const richiesteMancanti = targetResiduo !== null && kgAperte < targetResiduo ? Math.ceil((targetResiduo - kgAperte) / kgRitiro) : 0;

  const previsione = {
    dati_al: datiAl,
    data_file: dataFile,
    consolidato_al: consolidatoAl,
    ritardo_chiusura_giorni: ritardo,
    giorni_consolidati: giorniConsolidati,
    kg_consolidati: kgConsolidati,
    giorni_totali: giorniTotali,
    lavora_sabato: sabato,
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
    kg_ritiro_tipico: kgRitiro,
    ritiro_da_storico: ritiroDaStorico,
    valore_lista_kg: valoreListaKg,
    richieste_per_target: target ? Math.round(target / kgRitiro) : null,
    richieste_mancanti: richiesteMancanti,
    evadibili_ritmo: evadibiliRitmo,
    evadibili_target: evadibiliTarget,
    kg_per_viaggio: kgViaggio,
    viaggi_necessari: targetResiduo !== null && kgViaggio ? Math.ceil(targetResiduo / kgViaggio) : null,
    viaggi_possibili: storico.viaggi_per_giorno ? Math.floor(storico.viaggi_per_giorno * giorniResidui) : null,
  };

  // --- per provincia, quando la lista ne tocca piu' d'una ---
  const province = [...new Set(righe.map(provinciaDi).filter(Boolean))];
  const nella = (p) => righe.filter(r => provinciaDi(r) === p);
  const perProvincia = province.length > 1 ? province.map(p => ({
    provincia: p,
    richieste: nella(p).length,
    evase: nella(p).filter(evasaDalRaccoglitore).length,
    aperte: nella(p).filter(r => r.stato === 'aperta').length,
    trascurate: nella(p).filter(r => r.stato === 'aperta' && (r.scavalcata_successive + r.scavalcata_fuori) > 0).length,
    raccolto_kg: delMese.filter(t => provinciaDi(t) === p).reduce((s, t) => s + t.kg, 0),
  })).sort((a, b) => b.richieste - a.richieste) : [];

  // --- conteggi ---
  const fuoriOrdine = righe.filter(r => evasaDalRaccoglitore(r) && r.saltate > 0);
  const giorniDallInvio = giorniLavorativi(aggiungiGiorni(caricataIl, 1), consolidatoAl, sabato);
  const prioritarieAperte = righe.filter(r => r.prioritaria && r.stato === 'aperta');

  // --- alert ---
  const alert = [];
  const aggiungi = (gravita, tipo, messaggio) => alert.push({ gravita, tipo, messaggio });
  const elenco = (lista, n = 4) => lista.slice(0, n).join(', ') + (lista.length > n ? ` e altri ${lista.length - n}` : '');

  if (!target) aggiungi('alta', 'target', 'Target mensile non impostato: la previsione rispetto al target non si puo\' calcolare. Inseriscilo accanto al nome del raccoglitore.');
  if (trascurate.length) {
    const prima = trascurate[0];
    const cosa = [];
    if (prima.scavalcata_successive) cosa.push(`${prima.scavalcata_successive} ${prima.scavalcata_successive === 1 ? 'richiesta successiva' : 'richieste successive'}`);
    if (prima.scavalcata_fuori) cosa.push(`${prima.scavalcata_fuori} ${prima.scavalcata_fuori === 1 ? 'ordine fuori lista' : 'ordini fuori lista'}`);
    const altre = trascurate.length > 1 ? ` Trascurate anche: ${elenco(trascurate.slice(1).map(r => `n. ${r.posizione} ${r.id_ordine}`), 4)}.` : '';
    aggiungi('alta', 'trascurate', `${trascurate.length === 1 ? 'Una richiesta trascurata' : `${trascurate.length} richieste trascurate`}: la n. ${prima.posizione}, ${prima.id_ordine}${prima.produttore ? ' di ' + prima.produttore : ''}, immessa il ${itData(prima.data_immissione)}, e' ancora aperta sul portale, ma il raccoglitore ha gia' evaso ${cosa.join(' e ')}.${altre}`);
  }
  if (prioritarieAperte.length && giorniDallInvio >= GIORNI_TOLLERANZA_PRIORITARIE) {
    aggiungi('alta', 'prioritarie', `${prioritarieAperte.length} ${prioritarieAperte.length === 1 ? 'richiesta prioritaria ancora aperta' : 'richieste prioritarie ancora aperte'} sul portale dopo ${giorniDallInvio} giorni lavorativi dall'invio, con dati completi fino al ${itData(consolidatoAl)}: ${elenco(prioritarieAperte.map(r => r.id_ordine))}.`);
  }
  if (target && giorniConsolidati >= 5 && !meseConcluso && proiezioneKg < target * SOGLIA_PROIEZIONE) {
    aggiungi('alta', 'proiezione', `A questo ritmo chiude il mese a ${kgT(proiezioneKg)}, il ${previsione.percentuale_proiezione}% del target di ${kgT(target)}.`);
  }
  if (meseConcluso && target && raccoltoKg < target) {
    aggiungi('alta', 'proiezione', `Mese chiuso a ${kgT(raccoltoKg)}, il ${Math.round((raccoltoKg / target) * 1000) / 10}% del target di ${kgT(target)}.`);
  }
  if (fuoriOrdine.length) {
    const totaleSaltate = new Set(fuoriOrdine.flatMap(r => saltateDa(r).map(e => e.id_ordine))).size;
    aggiungi('media', 'cronologia', `${fuoriOrdine.length} ${fuoriOrdine.length === 1 ? 'richiesta evasa' : 'richieste evase'} fuori ordine, saltando ${totaleSaltate} ${totaleSaltate === 1 ? 'richiesta precedente ancora aperta' : 'richieste precedenti ancora aperte'} in quel momento.`);
  }
  const precedenti = fuoriListaEffettivi.filter(f => f.tipo === 'precedente');
  if (precedenti.length) aggiungi('media', 'fuori_lista', `${precedenti.length} ${precedenti.length === 1 ? 'ordine evaso' : 'ordini evasi'} fuori lista, gia' esistenti all'invio della lista: ${elenco(precedenti.map(f => f.id_ordine))}.`);
  const altrui = fuoriListaEffettivi.filter(f => f.tipo === 'lista_altrui');
  if (altrui.length) aggiungi('media', 'fuori_lista', `${altrui.length} ${altrui.length === 1 ? 'ordine evaso proveniva' : 'ordini evasi provenivano'} dalla lista di altri raccoglitori: ${elenco(altrui.map(f => `${f.id_ordine} di ${f.lista_di}`), 3)}.`);
  // Annullate, evase da altri e riassegnate svuotano la lista: quando le aperte
  // non bastano piu' al target servono nuove richieste.
  if (target && targetResiduo > 0 && kgAperte < targetResiduo * SOGLIA_PROIEZIONE && !meseConcluso) {
    const uscite = righe.filter(r => ['annullata', 'evasa_da_altri', 'riassegnata', 'non_piu_presente'].includes(r.stato) && !r.evasa_con).length;
    const causa = uscite ? ` Dalla lista ${uscite === 1 ? "e' uscita una richiesta" : `sono uscite ${uscite} richieste`} tra annullate, evase da altri e riassegnate.` : '';
    aggiungi('media', 'portafoglio', `Le richieste ancora aperte valgono circa ${kgT(kgAperte)}, meno dei ${kgT(targetResiduo)} che mancano al target: servono circa ${richiesteMancanti} ${richiesteMancanti === 1 ? 'richiesta' : 'richieste'} in piu', a ${kgT(kgRitiro)} per ritiro.${causa}`);
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
  const altroSulPortale = righe.filter(r => r.stato === 'aperta' && r.assegnata_sul_portale_a);
  if (altroSulPortale.length) {
    const chi = new Map();
    for (const r of altroSulPortale) chi.set(r.assegnata_sul_portale_a, (chi.get(r.assegnata_sul_portale_a) || 0) + 1);
    aggiungi('info', 'portale', `${altroSulPortale.length === 1 ? 'Una richiesta aperta risulta' : `${altroSulPortale.length} richieste aperte risultano`} sul portale assegnat${altroSulPortale.length === 1 ? 'a' : 'e'} a un altro trasportatore: ${[...chi.entries()].map(([n, c]) => `${n} (${c})`).join(', ')}. Restano richieste di questa lista.`);
  }
  const riassegnate = righe.filter(r => r.stato === 'riassegnata');
  if (riassegnate.length) aggiungi('info', 'riassegnate', `${riassegnate.length} ${riassegnate.length === 1 ? 'richiesta e\' passata' : 'richieste sono passate'} nella lista di un altro raccoglitore caricata dopo: ${elenco(riassegnate.map(r => `${r.id_ordine} a ${r.chiusa_da}`), 3)}.`);
  const sparite = righe.filter(r => r.stato === 'non_piu_presente');
  if (sparite.length) aggiungi('info', 'non_presenti', `${sparite.length} ${sparite.length === 1 ? 'richiesta non e\' piu\'' : 'richieste non sono piu\''} ne' tra gli assegnati ne' tra i terminati ne' tra i cancellati del file caricato: ${elenco(sparite.map(r => r.id_ordine))}.`);
  const annullate = righe.filter(r => r.stato === 'annullata');
  if (annullate.length) {
    const motivi = new Map();
    for (const r of annullate) motivi.set(r.motivo_annullamento, (motivi.get(r.motivo_annullamento) || 0) + 1);
    const sostituite = annullate.filter(r => r.evasa_con).length;
    const conSostituto = sostituite ? ` ${sostituite === 1 ? "Una e' stata evasa" : `${sostituite} sono state evase`} con un altro ordine allo stesso punto di raccolta.` : '';
    aggiungi('info', 'annullate', `${annullate.length === 1 ? "Una richiesta della lista e' stata annullata" : `${annullate.length} richieste della lista sono state annullate`} sul portale: ${[...motivi.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} (${n})`).join(', ')}.${conSostituto}`);
  }
  const conAltroOrdine = righe.filter(r => r.stato === 'evasa_altro_ordine');
  if (conAltroOrdine.length) {
    aggiungi('media', 'altro_ordine', `${conAltroOrdine.length === 1 ? "Una richiesta risulta ancora assegnata ma e' stata evasa" : `${conAltroOrdine.length} richieste risultano ancora assegnate ma sono state evase`} con un altro ordine allo stesso punto di raccolta, probabilmente un doppione da annullare sul portale: ${elenco(conAltroOrdine.map(r => `${r.id_ordine} con ${r.evasa_con}`), 3)}.`);
  }
  const nuove = fuoriListaEffettivi.filter(f => f.tipo === 'nuova');
  if (nuove.length) aggiungi('info', 'nuove', `${nuove.length} ${nuove.length === 1 ? 'ordine evaso e\' stato immesso' : 'ordini evasi sono stati immessi'} dopo l'invio della lista.`);
  const nonRiconosciute = righe.filter(r => r.stato_al_caricamento === 'non_riconosciuta');
  if (nonRiconosciute.length) aggiungi('info', 'non_riconosciute', `${nonRiconosciute.length} ${nonRiconosciute.length === 1 ? 'ID della lista non corrispondeva' : 'ID della lista non corrispondevano'} a nessun ordine al momento del caricamento: ${elenco(nonRiconosciute.map(r => r.id_ordine))}.`);

  const PESO = { alta: 0, media: 1, info: 2 };
  alert.sort((x, y) => PESO[x.gravita] - PESO[y.gravita]);

  return {
    riepilogo: {
      richieste: righe.length,
      evase: righe.filter(evasaDalRaccoglitore).length,
      evase_da_altri: daAltri.length,
      aperte: aperte.length,
      prioritarie_aperte: prioritarieAperte.length,
      fuori_ordine: fuoriOrdine.length,
      trascurate: trascurate.length,
      fuori_lista: fuoriListaEffettivi.length,
      non_piu_presenti: sparite.length,
      annullate: annullate.length,
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
        scavalcata_successive: r.scavalcata_successive || 0, scavalcata_fuori: r.scavalcata_fuori || 0,
        motivo_annullamento: r.motivo_annullamento || '', evasa_con: r.evasa_con || '', assegnata_sul_portale_a: r.assegnata_sul_portale_a || '',
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
      per_provincia: perProvincia,
      data_riferimento: itData(datiAl),
    },
  };
}

/**
 * Cosa fa un raccoglitore nel mese nei tre canali, rete, ACI ed extra raccolta:
 * formulari evasi, peso e richieste ancora aperte. Non dipende dalla lista:
 * vale anche per chi non ne ha ricevuta una, ed e' li' che si vedono le
 * richieste ACI e di extra raccolta da sollecitare.
 */
export function situazioneCanali({ chiave, anno, mese, oggi, terminati, assegnati }) {
  const inizio = primoGiorno(anno, mese), fine = ultimoGiorno(anno, mese);
  const canali = {};
  for (const canale of ['rete', 'aci', 'extra']) {
    const evasi = terminati.filter(t => t.canale === canale && t.chiaveTrasp === chiave && t.fine && t.fine >= inizio && t.fine <= fine);
    const aperte = assegnati.filter(a => a.canale === canale && a.chiaveTrasp === chiave)
      .map(a => ({
        id_ordine: a.id_ordine, immesso: a.immesso, giorni: a.immesso ? giorniTra(a.immesso, oggi) : null,
        produttore: a.produttore, comune: a.comune, provincia: a.provincia, classe: a.classe,
      }))
      .sort((x, y) => String(x.immesso || '9999').localeCompare(String(y.immesso || '9999')));
    canali[canale] = { evasi: evasi.length, kg: evasi.reduce((t, m) => t + m.kg, 0), aperte };
  }
  const alert = [];
  const descrivi = (lista) => lista.slice(0, 4).map(a => `${a.id_ordine}${a.giorni !== null ? ` da ${a.giorni} ${a.giorni === 1 ? 'giorno' : 'giorni'}` : ''}`).join(', ') + (lista.length > 4 ? ` e altre ${lista.length - 4}` : '');
  if (canali.aci.aperte.length) {
    alert.push({ gravita: 'alta', tipo: 'aci_aperte', messaggio: `${canali.aci.aperte.length === 1 ? 'Una richiesta ACI aperta' : `${canali.aci.aperte.length} richieste ACI aperte`} da evadere il prima possibile, o da chiudere sul portale se gia' ritirat${canali.aci.aperte.length === 1 ? 'a' : 'e'}: ${descrivi(canali.aci.aperte)}.` });
  }
  if (canali.extra.aperte.length) {
    alert.push({ gravita: 'media', tipo: 'extra_aperte', messaggio: `${canali.extra.aperte.length === 1 ? 'Una richiesta di extra raccolta aperta' : `${canali.extra.aperte.length} richieste di extra raccolta aperte`}, da evadere o da segnare terminate nel modulo Extra Raccolta: ${descrivi(canali.extra.aperte)}.` });
  }
  return { canali, alert };
}
