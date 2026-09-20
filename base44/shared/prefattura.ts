// La prefattura del portale Ecotyre contro il gestionale.
//
// Ogni mese il portale produce una prefattura: l'elenco degli ordini che Ecotyre
// riconosce, col peso e l'importo. Prima di esportare la fatturazione del mese la
// si confronta, ordine per ordine, con le righe che il gestionale calcola
// (attivaCalcolo.ts): quello che non coincide va chiarito PRIMA di fatturare.
//
// Qui ci sono le due parti pure, senza letture: riconoscere le colonne di un
// foglio qualunque (la prefattura non ha un tracciato garantito) e confrontare.
// Il canale di un ordine non si chiede a nessuno: e' quello che l'ordine ha nel
// gestionale.

const pulisci = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
// Gli importi si sommano in centesimi interi: sommando quattrocento importi con
// la virgola mobile il totale di luglio 2026 usciva 226.692,48 da una parte e
// 226.692,49 dall'altra, con tutte le righe identiche.
const centesimi = (v) => Math.round((Number(v) || 0) * 100);

// Il tracciato vero (prefattura provvisoria 3716, luglio 2026): ID Prefattura,
// Fatturante, Periodo, KeyAccount, Tipo (Trasp / Trasp+Tratt), Ordine, Data fine
// trasporto, Numero FIR, Prodotto, Quantità (kg), Prezzo Unitario (Euro/Kg),
// Prezzo Totale. Un foglio solo, rete e ACI insieme, l'extra raccolta non c'e'.

// Un ID ordine del portale: due-quattro lettere e almeno sei cifre (ET26084363, SEC26154852)
const E_ORDINE = /^[A-Z]{2,4}\d{6,}$/;
export const comeOrdine = (v) => pulisci(v).toUpperCase().replace(/[\s.]/g, '');

/** Il tipo di servizio come lo scrive il gestionale: "Trasp+Tratt" -> TRASP_TRATT, "Trasp" -> TRASP. */
export const comeServizio = (v) => { const t = pulisci(v).toUpperCase(); return /TRATT/.test(t) ? 'TRASP_TRATT' : /TRASP/.test(t) ? 'TRASP' : ''; };

const INTESTAZIONI = [
  ['ordine', /(id|n|num|numero|cod|codice)?[\s._°-]*ordine|^order/i],
  ['fir', /\bfir\b|formulario/i],
  ['kg', /peso|\bkg\b|quantit|q\.?t[aà]/i],
  ['importo', /importo|imponibile|totale|valore|corrispettivo/i],
  ['prezzo', /prezzo|tariffa|€\s*\/\s*t|eur\s*\/\s*t/i],
  ['servizio', /servizio|prestazione|tipo/i],
  ['data', /data|trasporto/i],
];

/** Un numero scritto all'italiana ("1.234,56"), all'inglese o gia' numero. null se non e' un numero. */
export function comeNumero(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = pulisci(v).replace(/[€\s]|kg|ton|t$/gi, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  // senza virgola, un punto seguito da tre cifre e' il separatore delle migliaia
  // all'italiana ("2.500" sono duemilacinquecento): il documento e' italiano
  else if ((s.match(/\./g) || []).length > 1 || /^-?\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/** Il giorno 'AAAA-MM-GG' di una cella: seriale di Excel, data o testo (gg/mm/aaaa o aaaa-mm-gg). */
export function comeGiorno(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
  if (v instanceof Date && !isNaN(v.getTime())) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  const s = pulisci(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}

/**
 * Il mese a cui si riferisce la prefattura, ricavato dalle date di fine trasporto
 * delle sue righe: e' scritto nel file, non serve che lo dica chi lo carica.
 * { anno, mese_idx, quota } col mese piu' frequente, oppure null se le date mancano.
 */
export function periodoPrefattura(righe) {
  const conta = new Map();
  for (const r of righe || []) if (r.giorno) conta.set(r.giorno.slice(0, 7), (conta.get(r.giorno.slice(0, 7)) || 0) + 1);
  const ordinati = [...conta.entries()].sort((a, b) => b[1] - a[1]);
  if (!ordinati.length) return null;
  const totale = ordinati.reduce((s, e) => s + e[1], 0);
  return { anno: Number(ordinati[0][0].slice(0, 4)), mese_idx: Number(ordinati[0][0].slice(5, 7)) - 1, quota: ordinati[0][1] / totale };
}

/**
 * Legge una prefattura da una o piu' tabelle (una per foglio): righe come array
 * di celle. Cerca la riga delle intestazioni, riconosce le colonne dai nomi e,
 * se il nome non basta, la colonna degli ordini dalla forma dei valori.
 * Restituisce { righe: [{ id_ordine, numero_fir, kg, importo, prezzo, servizio }], note: [] }.
 */
export function leggiTabellePrefattura(tabelle) {
  const righe = [];
  const note = [];
  for (const { nome, celle } of tabelle || []) {
    const t = celle || [];
    // la riga delle intestazioni: la prima, fra le prime 40, con almeno due nomi riconosciuti
    let iTesta = -1, colonne = {};
    for (let i = 0; i < Math.min(40, t.length); i++) {
      const trovate = {};
      (t[i] || []).forEach((c, j) => {
        const testo = pulisci(c);
        if (!testo || comeNumero(testo) !== null) return;
        for (const [chiave, re] of INTESTAZIONI) {
          if (trovate[chiave] === undefined && re.test(testo)) { trovate[chiave] = { j, testo }; break; }
        }
      });
      if (Object.keys(trovate).length >= 2 && (trovate.ordine || trovate.importo)) { iTesta = i; colonne = trovate; break; }
    }
    const corpo = t.slice(iTesta + 1);
    // la colonna degli ordini dalla forma dei valori, se l'intestazione non l'ha detta
    let jOrdine = colonne.ordine ? colonne.ordine.j : -1;
    if (jOrdine < 0) {
      const conta = new Map();
      for (const r of corpo) (r || []).forEach((c, j) => { if (E_ORDINE.test(comeOrdine(c))) conta.set(j, (conta.get(j) || 0) + 1); });
      const migliore = [...conta.entries()].sort((a, b) => b[1] - a[1])[0];
      if (migliore) jOrdine = migliore[0];
    }
    if (jOrdine < 0) { if (corpo.some(r => (r || []).some(c => pulisci(c)))) note.push(`Foglio "${nome}": nessuna colonna con gli ID ordine, saltato.`); continue; }

    const col = (k) => (colonne[k] ? colonne[k].j : -1);
    // il peso e' in tonnellate se lo dice l'intestazione, oppure se i valori sono piccoli e con decimali
    const valoriPeso = col('kg') >= 0 ? corpo.map(r => comeNumero((r || [])[col('kg')])).filter(v => v !== null && v > 0) : [];
    const mediana = valoriPeso.length ? [...valoriPeso].sort((a, b) => a - b)[Math.floor(valoriPeso.length / 2)] : 0;
    const inTonnellate = col('kg') >= 0 && (/\bt\b|tonn/i.test(colonne.kg.testo) && !/kg/i.test(colonne.kg.testo) || (mediana > 0 && mediana < 60));
    if (inTonnellate) note.push(`Foglio "${nome}": pesi letti come tonnellate e convertiti in kg.`);

    let lette = 0;
    for (const r of corpo) {
      const id = comeOrdine((r || [])[jOrdine]);
      if (!E_ORDINE.test(id)) continue;
      const peso = col('kg') >= 0 ? comeNumero(r[col('kg')]) : null;
      righe.push({
        id_ordine: id,
        numero_fir: col('fir') >= 0 ? pulisci(r[col('fir')]).toUpperCase() : '',
        kg: peso === null ? null : Math.round(inTonnellate ? peso * 1000 : peso),
        importo: col('importo') >= 0 ? comeNumero(r[col('importo')]) : null,
        prezzo: col('prezzo') >= 0 ? comeNumero(r[col('prezzo')]) : null,
        servizio: col('servizio') >= 0 ? pulisci(r[col('servizio')]) : '',
        giorno: col('data') >= 0 ? comeGiorno(r[col('data')]) : '',
        foglio: nome || '',
      });
      lette++;
    }
    if (lette && col('importo') < 0) note.push(`Foglio "${nome}": nessuna colonna con l'importo, si confrontano solo ordini e pesi.`);
    if (lette && col('kg') < 0) note.push(`Foglio "${nome}": nessuna colonna col peso, si confrontano solo ordini e importi.`);
  }
  return { righe, note };
}

/**
 * Legge la prefattura dal TESTO del suo PDF: le righe arrivano gia' ricostruite
 * (un array di celle per riga, da sinistra a destra), estratte nel browser con
 * pdf.js. Niente agente: con oltre quattrocento righe l'agente si rifiuta di
 * restituirle tutte (provato il 20/09/2026), mentre il testo del PDF e' esatto.
 *
 * Una riga di dettaglio: ID ordine, KeyAccount, produttore, classe, data
 * (gg-mm-aaaa), formulario, tipo, chili ("4 700"), prezzo al chilo ("0,2020"),
 * importo ("949,40"). Le celle a volte si fondono, percio' si lavora sulla riga
 * intera. In testa al documento c'e' il riepilogo stampato, per classi 1-4 e
 * per classe 9: i suoi totali dicono se la lettura e' completa.
 */
export function leggiLineePdfPrefattura(linee) {
  const righe = [];
  const note = [];
  let periodo = null;
  const stampati = { ordini: 0, kg: 0, euro: 0, blocchi: 0 };
  const numero = (t) => comeNumero(String(t).replace(/\s/g, '').replace(/Kg|Euro/gi, ''));
  for (const celle of linee || []) {
    const riga = (celle || []).map(pulisci).filter(Boolean).join(' ');
    if (!riga) continue;
    const mese = riga.match(/nel mese:\s*(\d{1,2})\/(\d{4})/i);
    if (mese) { periodo = { anno: Number(mese[2]), mese_idx: Number(mese[1]) - 1, quota: 1 }; continue; }
    // "Totale 410 1 122 240 Kg 226 692,48 Euro"
    const tot = riga.match(/^Totale\s+(\d+)\s+([\d ]+)\s*Kg\s+([\d .]+,\d{2})\s*Euro/i);
    if (tot) { stampati.ordini += Number(tot[1]); stampati.kg += numero(tot[2]) || 0; stampati.euro += Math.round((numero(tot[3]) || 0) * 100); stampati.blocchi++; continue; }
    const id = (riga.match(/^([A-Z]{2,4}\d{6,})\b/) || [])[1];
    if (!id) continue;
    const coda = riga.match(/(\d{2})-(\d{2})-(\d{4})\s+(\S+)\s+(Trasp\+Tratt|Trasp|Tratt)\s+([\d ]+?)\s+(\d+,\d{3,6})\s+([\d .]*\d,\d{2})$/);
    if (!coda) { note.push(`Riga dell'ordine ${id} non riconosciuta: "${riga.slice(0, 120)}".`); continue; }
    righe.push({
      id_ordine: id, numero_fir: coda[4].toUpperCase(), kg: Math.round(numero(coda[6]) || 0), importo: numero(coda[8]), prezzo: numero(coda[7]),
      servizio: coda[5], giorno: `${coda[3]}-${coda[2]}-${coda[1]}`, foglio: 'PDF',
    });
  }
  const sKg = righe.reduce((s, r) => s + (r.kg || 0), 0), sCent = righe.reduce((s, r) => s + Math.round((r.importo || 0) * 100), 0);
  const totali = stampati.blocchi ? { ordini: stampati.ordini, kg: stampati.kg, euro: stampati.euro / 100 } : null;
  let completa = null;
  if (totali) {
    // sugli importi il portale arrotonda il totale a modo suo: un centesimo per blocco e' tollerato
    completa = righe.length === totali.ordini && sKg === totali.kg && Math.abs(sCent - stampati.euro) <= 2 * stampati.blocchi;
    if (!completa) note.push(`ATTENZIONE: lette ${righe.length} righe per ${sKg} kg e ${(sCent / 100).toFixed(2)} euro, ma il riepilogo stampato dice ${totali.ordini} ordini, ${totali.kg} kg e ${totali.euro.toFixed(2)} euro: la lettura non e' completa.`);
  } else note.push('Nel PDF non ho trovato il riepilogo stampato dei totali: non posso controllare che la lettura sia completa.');
  return { righe, note, totali_stampati: totali, periodo: periodo || periodoPrefattura(righe), completa };
}

const somma = (m, id, kg, importo) => {
  const e = m.get(id) || { id_ordine: id, kg: 0, importo: 0, righe: 0, conKg: false, conImporto: false, servizio: '', fir: '' };
  if (kg !== null && kg !== undefined) { e.kg += kg; e.conKg = true; }
  if (importo !== null && importo !== undefined) { e.importo += importo; e.conImporto = true; }
  e.righe++;
  m.set(id, e);
};

/**
 * Confronta la prefattura con le righe del mese calcolate dal gestionale.
 * righePrefattura: da leggiTabellePrefattura. righeVive: { RETE: [...], ACI: [...],
 * EXTRA_RACCOLTA: [...] } da calcolaRigheAttiva. altrove: Map ordine -> { canale,
 * stato, giorno } su tutti gli archivi, per dire dove sta un ordine che il mese
 * non ha. Una prefattura puo' avere piu' righe per lo stesso ordine (trasporto e
 * trattamento): si sommano, come le righe a corpo del gestionale.
 */
export function confrontaPrefattura(righePrefattura, righeVive, altrove = new Map()) {
  const pre = new Map();
  for (const r of righePrefattura || []) {
    somma(pre, r.id_ordine, r.kg, r.importo);
    const e = pre.get(r.id_ordine);
    if (!e.servizio) e.servizio = comeServizio(r.servizio);
    if (!e.fir) e.fir = pulisci(r.numero_fir).toUpperCase();
  }
  const conImporti = [...pre.values()].some(e => e.conImporto);
  const conPesi = [...pre.values()].some(e => e.conKg);

  const canali = [];
  const visti = new Set();
  for (const canale of Object.keys(righeVive || {})) {
    const gest = new Map();
    for (const r of righeVive[canale] || []) {
      const id = comeOrdine(r.ordine);
      const e = gest.get(id) || { id_ordine: id, numero_fir: r.numero_fir || '', kg: 0, importo: 0, prezzo: 0, servizio: r.servizio_ecotyre || '' };
      e.kg += Number(r.quantita) || 0;
      e.importo += Number(r.totale) || 0;
      if (r.quantita > 0) e.prezzo = r.tariffa_valore;
      gest.set(id, e);
    }
    const soloGestionale = [], pesoDiverso = [], importoDiverso = [], servizioDiverso = [], firDiverso = [];
    let kgPre = 0, euroPre = 0, ordiniPre = 0;
    for (const [id, g] of gest) {
      const p = pre.get(id);
      if (!p) { soloGestionale.push({ id_ordine: id, numero_fir: g.numero_fir, kg: g.kg, importo: r2(g.importo) }); continue; }
      visti.add(id);
      ordiniPre++; kgPre += p.kg; euroPre += centesimi(p.importo);
      // il tipo di servizio decide il prezzo: se la prefattura dice Trasp e il gestionale Trasp+Tratt va saputo
      if (p.servizio && g.servizio && p.servizio !== g.servizio) servizioDiverso.push({ id_ordine: id, numero_fir: g.numero_fir, servizio_prefattura: p.servizio, servizio_gestionale: g.servizio, kg: Math.round(g.kg) });
      const firGest = pulisci(g.numero_fir).toUpperCase();
      if (p.fir && firGest && p.fir !== firGest) firDiverso.push({ id_ordine: id, fir_prefattura: p.fir, fir_gestionale: firGest, kg: Math.round(g.kg) });
      const kgDiversi = p.conKg && Math.round(p.kg) !== Math.round(g.kg);
      if (kgDiversi) pesoDiverso.push({ id_ordine: id, numero_fir: g.numero_fir, kg_prefattura: Math.round(p.kg), kg_gestionale: Math.round(g.kg), importo_prefattura: p.conImporto ? r2(p.importo) : null, importo_gestionale: r2(g.importo) });
      else if (p.conImporto && Math.abs(p.importo - g.importo) > 0.015) {
        importoDiverso.push({
          id_ordine: id, numero_fir: g.numero_fir, kg: Math.round(g.kg),
          importo_prefattura: r2(p.importo), importo_gestionale: r2(g.importo),
          // il prezzo che la prefattura sta applicando, ricavato: dice subito se e' una tariffa diversa
          prezzo_prefattura_t: g.kg ? r2(p.importo / (g.kg / 1000)) : null, prezzo_gestionale_t: g.prezzo || null,
        });
      }
    }
    const kgGest = [...gest.values()].reduce((s, e) => s + e.kg, 0);
    const euroGest = [...gest.values()].reduce((s, e) => s + centesimi(e.importo), 0) / 100;
    // L'extra raccolta non passa dalla prefattura del portale (verificato sulla
    // 3716 di luglio 2026: 416 ordini fra rete e ACI, l'intervento extra non c'e').
    // Se la prefattura non ne porta nessun ordine, le sue righe non sono differenze.
    const fuoriPrefattura = canale === 'EXTRA_RACCOLTA' && ordiniPre === 0;
    canali.push({
      canale, fuori_prefattura: fuoriPrefattura,
      gestionale: { ordini: gest.size, kg: Math.round(kgGest), euro: r2(euroGest) },
      prefattura: { ordini: ordiniPre, kg: conPesi ? Math.round(kgPre) : null, euro: conImporti ? euroPre / 100 : null },
      solo_gestionale: soloGestionale, peso_diverso: pesoDiverso, importo_diverso: importoDiverso,
      servizio_diverso: servizioDiverso, fir_diverso: firDiverso,
    });
  }

  // Le terziarie (ordini TER...): il portale le paga come "Trasp" a 8 euro la
  // tonnellata con l'allegato VII e a 10 col formulario (prefatture gennaio-agosto
  // 2026: 105 ordini, 25.846,51 euro). Decisione della direzione (20/09/2026): per
  // ora restano FUORI dalla fatturazione attiva e dai tre report, in una sezione
  // a parte tenuta pronta per quando servira'. Percio' non sono una differenza:
  // si mostrano col loro totale, e basta.
  const terziarie = { ordini: 0, kg: 0, euro: 0, righe: [] };
  for (const [id, p] of pre) {
    if (visti.has(id) || !/^TER/.test(id)) continue;
    visti.add(id);
    terziarie.ordini++; terziarie.kg += p.kg; terziarie.euro += centesimi(p.importo);
    const a = altrove.get(id) || null;
    terziarie.righe.push({ id_ordine: id, numero_fir: p.fir, kg: Math.round(p.kg), importo: r2(p.importo), prezzo_t: p.kg ? r2(p.importo / (p.kg / 1000)) : null, in_archivio: !!a });
  }
  terziarie.kg = Math.round(terziarie.kg); terziarie.euro = terziarie.euro / 100;
  terziarie.non_in_archivio = terziarie.righe.filter(x => !x.in_archivio).length;

  // Ordini della prefattura che il mese del gestionale non ha: si dice dove stanno
  const soloPrefattura = [];
  for (const [id, p] of pre) {
    if (visti.has(id)) continue;
    const a = altrove.get(id) || null;
    soloPrefattura.push({
      id_ordine: id, kg: p.conKg ? Math.round(p.kg) : null, importo: p.conImporto ? r2(p.importo) : null,
      canale: a ? a.canale : '', stato: a ? a.stato : '', giorno: a ? a.giorno : '',
      spiegazione: !a ? 'ordine sconosciuto al gestionale'
        : a.stato !== 'terminato' ? `nel gestionale è ${a.stato || 'senza stato'}`
        : !a.giorno ? 'nel gestionale non ha la fine trasporto'
        : `nel gestionale la fine trasporto è il ${a.giorno.split('-').reverse().join('/')}: un altro mese`,
    });
  }
  const differenze = soloPrefattura.length + canali.reduce((s, c) => s + (c.fuori_prefattura ? 0 : c.solo_gestionale.length) + c.peso_diverso.length + c.importo_diverso.length + c.servizio_diverso.length + c.fir_diverso.length, 0);
  return {
    coincide: differenze === 0 && pre.size > 0,
    differenze,
    ordini_prefattura: pre.size,
    con_importi: conImporti, con_pesi: conPesi,
    canali, solo_prefattura: soloPrefattura, terziarie,
  };
}
