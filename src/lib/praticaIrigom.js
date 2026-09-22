// La pratica mensile delle dichiarazioni di Irigom: le regole, senza pagina.
//
// Le dichiarazioni di Irigom le prepariamo noi. Ogni mese, dal registro di
// carico e scarico dell'impianto, si ricavano:
//   - i formulari del ferro (EER 19.12.02) che sono della nostra commessa e con
//     che quota;
//   - gli allegati VII della nave con cui e' uscito il ciabattato (EER 19.12.04),
//     e quindi quante terziarie aprire a portale;
//   - i DDT del CSS-C, che viaggia con documento di trasporto perche' ha cessato
//     la qualifica di rifiuto;
//   - quanto dichiarare, e come ripartirlo, senza superare i 38.000 kg per
//     dichiarazione che il portale accetta.
//
// Le regole vengono dalle dichiarazioni di agosto 2026, rifatte da capo da un
// secondo agente con le sole regole scritte: 525 valori su 525 tornano. Il caso
// di prova e' in prove/praticaIrigom.mjs.
//
// Canali: la rete e l'extra raccolta restano separate. L'extra raccolta parte con
// la nave nell'ultima terziaria (stesso allegato VII): nei documenti e nel
// riepilogo si scrive in una tabella sua e si dichiara a parte, sul canale extra
// raccolta. A PORTALE invece quella terziaria si chiude col suo peso intero, parte
// di rete piu' extra, e il totale caricato comprende l'extra (regola dell'utente
// del 22/09/2026, agosto 2026: 534.600 kg a portale, di cui 460 di extra nella
// terziaria TER26154141, chiusa a 20.340 = 19.880 di rete + 460). L'extra e'
// gestita fuori portale: il gestionale vede solo il totale caricato, e la riga
// dell'extra raccolta la chiude a mano l'utente.

export const MAX_PER_DICHIARAZIONE_KG = 38000;
export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const intero = (n) => Math.round(Number(n) || 0);
const alleDecine = (n) => Math.floor(n / 10) * 10;
const somma = (righe, campo) => righe.reduce((s, r) => s + (Number(r[campo]) || 0), 0);
// Il punto delle migliaia a mano: toLocaleString non lo mette sui numeri di quattro cifre.
const mig = (v) => String(intero(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ---------------------------------------------------------------------------
// Il ferro

/**
 * La quota ECOTYRE scritta nella nota di un formulario del ferro, in kg.
 *
 * Irigom annota a mano, nel commento della cella, come si divide un formulario
 * fra i consorzi: "ECP:10,72 ECT:6,62 LM: 10,62" (Ecopneus, Ecotyre, libero
 * mercato), in tonnellate. Le forme viste nel 2026: "ECT: 6,62", "ECT 2,66",
 * "ect: 6,6", "FECT:12.64", "ECT: 11,68 TON" e anche il numero prima della
 * sigla, "27,5 ECP 1,06 ECT". Si cerca prima il numero dopo ECT, poi quello prima.
 */
export function quotaEct(nota) {
  const t = String(nota || '');
  const dopo = /ECT\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i.exec(t);
  const prima = dopo ? null : /(\d+(?:[.,]\d+)?)\s*(?:TON|T)?\s*ECT\b/i.exec(t);
  const m = dopo || prima;
  if (!m) return null;
  const tonnellate = Number(m[1].replace(',', '.'));
  return Number.isFinite(tonnellate) ? Math.round(tonnellate * 1000) : null;
}

/**
 * Quali formulari del ferro del mese sono nostri e con che quota.
 *
 * - Quelli con destinatario MMF non entrano mai, nemmeno se arancioni: sono
 *   metalli puliti o sporchi di un altro giro.
 * - Cella arancione (FFC000): tutto il peso.
 * - Altrimenti conta la nota: se c'e' una quota ECT entra quella, qualunque sia
 *   il colore (nel 2026 il rosa dei parziali e' cambiato tre volte).
 * - Tutto il resto e' di altri: verde Ecopneus, note senza ECT.
 *
 * @param {array} righe [{ riga, data, trasportatore, destinatario, formulario, kg, colore, nota }]
 */
export function formulariFerro(righe) {
  const esiti = (righe || []).map(r => {
    const kg = intero(r.kg);
    const base = { ...r, kg };
    if (/^\s*mmf\s*$/i.test(r.destinatario || '')) return { ...base, quota_kg: 0, esito: 'escluso', motivo: 'destinatario MMF: non e\' della commessa' };
    if (String(r.colore || '').toUpperCase().slice(-6) === 'FFC000') return { ...base, quota_kg: kg, esito: 'intero', motivo: 'cella arancione: tutto il formulario' };
    const q = quotaEct(r.nota);
    if (q !== null && q > 0) return { ...base, quota_kg: Math.min(q, kg), esito: 'quota', motivo: `quota ECT nella nota: ${mig(q)} kg` };
    return { ...base, quota_kg: 0, esito: 'escluso', motivo: r.nota ? 'la nota non ha una quota ECT' : 'di un altro consorzio' };
  });
  const nostri = esiti.filter(r => r.quota_kg > 0);
  return {
    esiti,
    tabella: nostri,
    peso_kg: somma(nostri, 'kg'),
    quota_kg: somma(nostri, 'quota_kg'),
  };
}

// ---------------------------------------------------------------------------
// Gli allegati VII e le terziarie

const gruppoTrasporto = (a) => (/smoco/i.test(a.trasportatore || '') ? 0 : /transar/i.test(a.trasportatore || '') ? 1 : 2);

/** Prima SMOCO, poi TRANSAR, poi gli altri; dentro ogni gruppo per numero. */
export function ordinaAllegati(allegati) {
  return [...(allegati || [])].sort((a, b) => gruppoTrasporto(a) - gruppoTrasporto(b) || (Number(a.numero) || 0) - (Number(b.numero) || 0));
}

/**
 * La combinazione di allegati con la somma piu' vicina al peso da coprire, mai
 * sotto se si puo' fare: fra due che vanno bene uguale vince quella che usa gli
 * allegati piu' avanti nell'ordine di priorita' (SMOCO, TRANSAR, gli altri) e
 * con i numeri piu' bassi.
 *
 * Si cercano tutte le somme possibili con un insieme di bit per passo, e poi si
 * torna indietro scartando l'allegato piu' recente ogni volta che la somma si
 * raggiunge anche senza: cosi' restano quelli di testa.
 */
function combinazioneVicina(pool, target) {
  const pesi = pool.map(a => Math.max(0, intero(a.kg)));
  const n = pesi.length;
  const massimo = pesi.reduce((s, k) => s + k, 0);
  if (!n || massimo === 0) return { scelti: [], somma: 0 };
  // oltre il peso da coprire non serve guardare piu' del piu' grande allegato
  const limite = Math.min(massimo, target + Math.max(...pesi));
  const parole = (limite >> 5) + 1;
  // strati[i] = le somme che si fanno con i primi i allegati
  const strati = [new Uint32Array(parole)];
  strati[0][0] = 1;
  for (let i = 0; i < n; i++) {
    const prima = strati[i];
    const dopo = new Uint32Array(prima);
    const k = pesi[i];
    if (k > 0 && k <= limite) {
      const salto = k >> 5, bit = k & 31;
      for (let w = parole - 1; w >= 0; w--) {
        const sorgente = w - salto;
        if (sorgente < 0) break;
        let v = prima[sorgente] << bit;
        if (bit && sorgente > 0) v |= prima[sorgente - 1] >>> (32 - bit);
        dopo[w] |= v;
      }
    }
    strati.push(dopo);
  }
  const raggiunta = (strato, s) => s >= 0 && s <= limite && (strati[strato][s >> 5] & (1 << (s & 31))) !== 0;
  let migliore = null;
  for (let s = 0; s <= limite; s++) {
    if (!raggiunta(n, s)) continue;
    const scarto = Math.abs(s - target);
    const sotto = s < target ? 1 : 0;
    if (!migliore || sotto < migliore.sotto || (sotto === migliore.sotto && scarto < migliore.scarto)) {
      migliore = { somma: s, scarto, sotto };
    }
  }
  if (!migliore) return { scelti: [], somma: 0 };
  const usati = [];
  let resto = migliore.somma;
  for (let i = n; i > 0; i--) {
    if (raggiunta(i - 1, resto)) continue; // si arriva anche senza questo
    usati.push(i - 1);
    resto -= pesi[i - 1];
  }
  return { scelti: usati.reverse().map(i => pool[i]), somma: migliore.somma };
}

/**
 * Gli allegati VII da dichiarare: la combinazione con la somma piu' vicina al
 * ciabattato uscito nel mese (extra raccolta compresa), mai sotto se si puo'.
 * Si cerca prima fra i soli SMOCO; se non bastano si aggiungono i TRANSAR e per
 * ultimi gli altri trasportatori (regola dell'utente). Tante terziarie quanti
 * allegati scelti, e l'ultimo si dichiara in parte.
 *
 * Fino al 22/09/2026 si prendevano i primi dell'ordine finche' non bastavano: la
 * somma sforava anche di molto e l'ultima terziaria restava lontana dal peso del
 * suo allegato.
 */
export function scegliAllegati(allegati, cippatoKg, { criterio = 'vicino' } = {}) {
  const ordinati = ordinaAllegati(allegati);
  const target = intero(cippatoKg);
  // 'ordine' e' la regola di prima del 22/09/2026: i primi dell'ordine finche'
  // non bastano. Serve a rifare una pratica gia' consegnata con quella regola
  // (agosto 2026) senza cambiarne gli allegati.
  if (criterio === 'ordine') {
    const scelti = [];
    let coperto = 0;
    for (const a of ordinati) {
      if (coperto >= target) break;
      scelti.push(a);
      coperto += intero(a.kg);
    }
    return { ordinati, scelti, coperto_kg: coperto, basta: coperto >= target, scarto_kg: coperto - target, bacino: 'ordine di priorita\'' };
  }
  const bacini = [
    { fino: 0, nome: 'SMOCO' },
    { fino: 1, nome: 'SMOCO e TRANSAR' },
    { fino: 2, nome: 'tutti i trasportatori' },
  ];
  let ultima = { scelti: [], somma: 0, nome: '' };
  for (const b of bacini) {
    const pool = ordinati.filter(a => gruppoTrasporto(a) <= b.fino);
    if (!pool.length) continue;
    const c = combinazioneVicina(pool, target);
    ultima = { ...c, nome: b.nome };
    if (c.somma >= target) break;
  }
  const scelti = ordinaAllegati(ultima.scelti);
  return {
    ordinati,
    scelti,
    coperto_kg: ultima.somma,
    basta: ultima.somma >= target,
    scarto_kg: ultima.somma - target,
    bacino: ultima.nome,
  };
}

/**
 * Ripartisce il ferro su un gruppo di dichiarazioni: a ciascuna la stessa quota,
 * alle decine, e all'ultima il resto. Se una supera i 38.000 kg, l'eccedenza va
 * alle altre finche' c'e' posto, sempre a decine.
 *
 * @param {array} posti [{ base_kg }] il materiale di ciascuna (ciabattato o CSS-C)
 */
export function ripartisciFerro(posti, ferroKg, max = MAX_PER_DICHIARAZIONE_KG) {
  const n = posti.length;
  const ferro = posti.map(() => 0);
  if (!n || ferroKg <= 0) return { ferro, avanza_kg: Math.max(0, intero(ferroKg)) };
  const quota = alleDecine(ferroKg / n);
  for (let i = 0; i < n; i++) ferro[i] = i < n - 1 ? quota : intero(ferroKg) - quota * (n - 1);
  // Chi sfora cede l'eccedenza, e l'eccedenza si divide in parti uguali, a
  // decine, fra chi ha ancora posto: messa tutta su una riga, a luglio 2026 ne
  // sarebbe uscita una col 74% di ferro, e nel foglio nessuna ha mai passato il 40%.
  let eccedenza = 0;
  for (let i = 0; i < n; i++) {
    const posto = max - intero(posti[i].base_kg);
    if (ferro[i] > posto) { eccedenza += ferro[i] - Math.max(0, posto); ferro[i] = Math.max(0, posto); }
  }
  const posto = (i) => max - intero(posti[i].base_kg) - ferro[i];
  for (let giro = 0; giro < 100 && eccedenza > 0; giro++) {
    const conPosto = posti.map((_, i) => i).filter(i => posto(i) > 0);
    if (!conPosto.length) break;
    const parte = Math.max(10, alleDecine(eccedenza / conPosto.length));
    for (const i of conPosto) {
      const metto = Math.min(parte, posto(i), eccedenza);
      ferro[i] += metto;
      eccedenza -= metto;
      if (eccedenza <= 0) break;
    }
  }
  return { ferro, avanza_kg: eccedenza };
}

// ---------------------------------------------------------------------------
// L'extra raccolta

/**
 * Divide i PFU di extra raccolta fra ciabattato e ferro. La ripartizione la da'
 * l'impianto; se non c'e', si propone quella dell'ultima volta (agosto 2026:
 * 460 kg = 340 + 120, cioe' il 26% di ferro), alle decine, e resta correggibile.
 */
export function dividiExtra(pfuKg, quotaFerro = 120 / 460) {
  const pfu = intero(pfuKg);
  const ferro = Math.round((pfu * quotaFerro) / 10) * 10;
  return { pfu_kg: pfu, cippato_kg: pfu - ferro, ferro_kg: ferro };
}

// Quale extra raccolta proporre, cosa ne resta scritto nella pratica e come si
// scrive sul suo canale. Stavano nella pagina (PraticaIrigom.jsx), dove non si
// potevano provare: qui le prova prove/praticaIrigom.mjs (correzioni del 22/09/2026).

const leggiExtraJson = (p) => {
  try { return JSON.parse((p && p.extra_json) || '{}') || {}; } catch (e) { return {}; }
};
const stessaPratica = (p, anno, mese) => Number(p.anno) === Number(anno) && p.mese === mese;

/**
 * Cosa si scrive in PraticaIrigom.extra_json: SOLO l'extra raccolta che la
 * pratica dichiara davvero, cioe' pratica.extra, quella partita con la nave.
 * Si scrivevano i formulari spuntati nella pagina: in un mese senza nave
 * componiMese li lascia in impianto (pratica.extra = null), ma registrando quel
 * mese finivano lo stesso nella pratica, e dal mese dopo risultavano dichiarati:
 * non si proponevano piu', nessuna dichiarazione di extra raccolta li portava e la
 * lettura dalla giacenza non li toglieva piu' da quello che resta a portale.
 * Senza extra dichiarata resta solo la ripartizione del ferro, da riproporre.
 */
export function extraDaSalvare(pratica, quotaFerro = null) {
  const e = pratica && pratica.extra;
  if (!e) return quotaFerro === null || quotaFerro === undefined ? {} : { quota_ferro: quotaFerro };
  return { formulari: e.formulari || [], cippato_kg: e.cippato_kg, ferro_kg: e.ferro_kg, quota_ferro: quotaFerro };
}

/**
 * Gli id dei formulari di extra raccolta gia' dichiarati da una pratica
 * registrata, dell'anno o dell'anno prima, tranne quella del mese che si sta
 * rifacendo. Si leggono anche le pratiche dell'anno prima: un'extra arrivata a
 * dicembre e partita con la nave di gennaio sta nella pratica di gennaio.
 */
export function extraGiaDichiarate(pratiche, { anno, mese }) {
  const s = new Set();
  for (const p of pratiche || []) {
    if (!p || p.stato !== 'registrata' || stessaPratica(p, anno, mese)) continue;
    for (const f of leggiExtraJson(p).formulari || []) if (f && f.id) s.add(f.id);
  }
  return s;
}

/**
 * Da che giorno a che giorno, per fine trasporto (giorno italiano, 'AAAA-MM-GG'),
 * l'extra raccolta arrivata a Irigom si propone nella pratica di un mese: fino
 * all'ultimo giorno del mese dichiarato. Si parte dal primo gennaio dell'anno
 * prima quando in quell'anno la pratica c'era gia' (almeno una registrata), per
 * l'extra di dicembre che parte con la nave di gennaio; altrimenti dal primo
 * gennaio dell'anno: prima della pratica l'extra la dichiarava l'utente a mano, e
 * nessuna pratica l'avrebbe mai tolta dalle proposte.
 * meseIdx 0-11; -1 se il mese non e' scelto (tutto l'anno).
 */
export function finestraExtra({ anno, meseIdx = -1, annoPrimaConPratica = false }) {
  const a = Number(anno);
  return {
    da: `${annoPrimaConPratica ? a - 1 : a}-01-01`,
    // '-31' anche per i mesi piu' corti: e' un confronto fra stringhe
    a: `${a}-${String(meseIdx >= 0 ? meseIdx + 1 : 12).padStart(2, '0')}-31`,
  };
}

/**
 * L'extra raccolta di un blocco ({ formulari, cippato_kg, ferro_kg }: pratica.extra
 * o l'extra_json di una pratica) mese per mese della fine trasporto dei suoi
 * formulari, con l'anno: [{ anno, mese, pfu_kg, cippato_kg, ferro_kg }], in ordine.
 * Il ferro si divide in proporzione al peso e l'ultimo mese prende il resto,
 * cosi' i chili tornano. Un formulario senza fine trasporto non ha mese e resta
 * fuori: nelle proposte non entra.
 */
export function extraPerMese(extra) {
  const mesi = new Map();
  for (const f of (extra && extra.formulari) || []) {
    const g = String((f && f.fine_trasporto) || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(g)) continue;
    const anno = Number(g.slice(0, 4));
    const mese = MESI[Number(g.slice(5, 7)) - 1];
    const k = `${anno}|${mese}`;
    if (!mesi.has(k)) mesi.set(k, { anno, mese, pfu_kg: 0, cippato_kg: 0, ferro_kg: 0 });
    mesi.get(k).pfu_kg += intero(f.peso_kg);
  }
  const elenco = [...mesi.values()].sort((x, y) => x.anno - y.anno || MESI.indexOf(x.mese) - MESI.indexOf(y.mese));
  const pfu = somma(elenco, 'pfu_kg');
  const ferro = intero(extra && extra.ferro_kg);
  let messo = 0;
  elenco.forEach((m, i) => {
    m.ferro_kg = i < elenco.length - 1 ? (pfu ? Math.round((ferro * m.pfu_kg) / pfu) : 0) : ferro - messo;
    messo += m.ferro_kg;
    m.cippato_kg = m.pfu_kg - m.ferro_kg;
  });
  return elenco;
}

/**
 * Quanto hanno scritto sul canale extra raccolta le pratiche registrate, mese per
 * mese: Map 'AAAA|Mese' -> { anno, mese, pfu_kg, cippato_kg, ferro_kg }.
 * escludi: { anno, mese } della pratica che si rifa', oppure null per tutte.
 */
export function extraDellePratiche(pratiche, escludi = null) {
  const tot = new Map();
  for (const p of pratiche || []) {
    if (!p || p.stato !== 'registrata' || (escludi && stessaPratica(p, escludi.anno, escludi.mese))) continue;
    for (const m of extraPerMese(leggiExtraJson(p))) {
      const k = `${m.anno}|${m.mese}`;
      const s = tot.get(k) || { anno: m.anno, mese: m.mese, pfu_kg: 0, cippato_kg: 0, ferro_kg: 0 };
      s.pfu_kg += m.pfu_kg;
      s.cippato_kg += m.cippato_kg;
      s.ferro_kg += m.ferro_kg;
      tot.set(k, s);
    }
  }
  return tot;
}

/**
 * Le dichiarazioni EXTRA_RACCOLTA da scrivere registrando la pratica { anno, mese }:
 * una per mese (e anno) di fine trasporto dei suoi formulari, sul mese del
 * formulario. Ciascuna vale quello che ci hanno scritto le ALTRE pratiche
 * registrate piu' la parte di questa: la stessa extra di luglio puo' partire in
 * parte con la nave di agosto e in parte con quella di settembre, e quella di
 * dicembre con la nave di gennaio. Si scriveva la sola parte dell'ultima pratica,
 * e quella di prima spariva dal numero.
 * @returns [{ anno, mese, quantita_kg, cippato_kg, metalli_kg, questa_kg, altre_kg }]
 */
export function dichiarazioniExtra(extra, pratiche, { anno, mese }) {
  const altre = extraDellePratiche(pratiche, { anno, mese });
  return extraPerMese(extra).map(m => {
    const a = altre.get(`${m.anno}|${m.mese}`) || { pfu_kg: 0, cippato_kg: 0, ferro_kg: 0 };
    return {
      anno: m.anno, mese: m.mese,
      quantita_kg: m.pfu_kg + a.pfu_kg, cippato_kg: m.cippato_kg + a.cippato_kg, metalli_kg: m.ferro_kg + a.ferro_kg,
      questa_kg: m.pfu_kg, altre_kg: a.pfu_kg,
    };
  });
}

// La dichiarazione di rete di Irigom vale il totale caricato a portale, extra
// raccolta dell'ultima terziaria compresa (regola dell'utente del 22/09/2026).
// Finche' DichiarazioneSito non ha un campo per dirlo, la sua nota porta sempre,
// in fondo, questa frase fissa, anche con 0 kg: chi confronta la rete di Irigom
// col conferito la legge con extraCompresaDaNota e sottrae quei chili, senza
// sommarli all'extra, che ha la sua dichiarazione. Vale l'ultima frase della nota:
// rifacendo la registrazione la nota di prima resta sopra, nello storico.
export const testoExtraCompresa = (kg) => `[extra compresa: ${mig(kg)} kg]`;
/** I kg di extra raccolta compresi nella dichiarazione di rete, dall'ultima frase fissa della nota; null se non c'e'. */
export function extraCompresaDaNota(note) {
  const tutte = [...String(note || '').matchAll(/\[extra compresa: (\d[\d.]*) kg\]/g)];
  return tutte.length ? Number(tutte[tutte.length - 1][1].replace(/\./g, '')) : null;
}

// ---------------------------------------------------------------------------
// Il mese

/**
 * Compone la pratica del mese.
 *
 * I tre numeri del risultato, da non confondere (regola dell'utente del
 * 22/09/2026, agosto 2026 fra parentesi):
 * - portale_kg: il totale da caricare A PORTALE, CSS-C piu' terziarie, ciascuna
 *   col peso con cui si chiude. Comprende l'extra raccolta partita con la nave,
 *   che sta nell'ultima terziaria. E' quello che il portale decurta dalla
 *   giacenza di rete e che il report delle dichiarazioni riconosce (534.600).
 * - rete_kg: la parte di rete, senza l'extra: la riga IRIGOM del riepilogo (534.140).
 * - extra_kg: l'extra raccolta, riga EXTRA RACCOLTA, canale suo (460).
 * Si mostrano sempre come "di cui", mai sommati fra loro: portale_kg e' gia' il
 * totale, rete_kg + extra_kg lo ricompongono.
 *
 * @param {object} p
 * @param {object} p.riga            riga del mese dal foglio Cons. (uscite e giacenze)
 * @param {array}  p.ferro           formulari del ferro del mese (tutti, anche non nostri)
 * @param {array}  p.allegati        allegati VII del mese
 * @param {array}  p.ddt             DDT di CSS-C nostri del mese [{ ddt, data, kg }]
 * @param {number} p.portaleFineMeseKg giacenza di rete a portale a fine mese (per fine trasporto)
 * @param {string} p.lettura         'giacenza' (regola del 19/09/2026) oppure 'uscite'
 * @param {object} p.extra           { formulari: [{ id, formulario, peso_kg, inizio_trasporto, fine_trasporto, date_da_sistemare, ... }], cippato_kg, ferro_kg } oppure null;
 *                                   date_da_sistemare e' il testoDate del formulario, '' se le date ci sono tutte e tornano
 * @param {number} p.extraInGiacenzaKg extra raccolta arrivata a Irigom entro fine mese e non ancora lavorata
 * @param {array}  p.terziarie       numeri TER aperti a portale, se gia' ci sono
 */
export function componiMese({ riga, ferro = [], allegati = [], ddt = [], portaleFineMeseKg = null, lettura = 'giacenza', extra = null, extraInGiacenzaKg = 0, terziarie = [], criterio = 'vicino' }) {
  const avvisi = [];
  const blocchi = [];
  const V = intero(riga && riga.uscite_cippato_kg);
  const X = intero(riga && riga.uscite_ferro_kg);
  const Y = intero(riga && riga.uscite_cssc_kg);

  // Gli allegati VII: quanti ne servono a coprire il ciabattato. Si scelgono
  // prima delle letture perche' dicono se nel mese e' partita una nave, e con
  // lei l'extra raccolta.
  const scelta = scegliAllegati(allegati, V, { criterio });
  const n = scelta.scelti.length;

  // L'extra raccolta esce solo con la nave, nell'ultima terziaria. Senza
  // terziarie nel mese non e' uscita: resta in impianto, non entra nei conti del
  // mese e si dichiara con la nave dopo. Prima del 22/09/2026 restava nei conti:
  // con la lettura dalla giacenza il suo peso finiva sui DDT del CSS-C, come
  // ferro di rete.
  const extraProposta = extra ? intero(extra.cippato_kg) + intero(extra.ferro_kg) : 0;
  const extraSenzaNave = extraProposta > 0 && n === 0;
  if (extraSenzaNave) {
    avvisi.push(V > 0
      ? `C'e' extra raccolta da dichiarare (${mig(extraProposta)} kg) ma senza allegati VII non c'e' la terziaria a cui attaccarla: resta fuori dai conti finche' gli allegati non ci sono.`
      : `C'e' extra raccolta da dichiarare (${mig(extraProposta)} kg) ma nel mese non e' partita nessuna nave, quindi nessuna terziaria a cui attaccarla: resta in impianto e si dichiara con la nave dopo.`);
  }
  const extraPfu = extraSenzaNave ? 0 : extraProposta;
  const extraCipp = extra && !extraSenzaNave ? intero(extra.cippato_kg) : 0;
  const extraFerro = extra && !extraSenzaNave ? intero(extra.ferro_kg) : 0;
  // Quanto deve restare a portale dopo la dichiarazione del mese, regola
  // dell'utente del 22/09/2026: la somma delle celle AD e AE della riga del mese
  // nel foglio Cons. AD e' la giacenza TOTALE di gomma (cippato AA + SACI AB +
  // PFU interi AC), AE quella dei metalli ferrosi (19.12.02): insieme sono quello
  // che resta in impianto dei PFU ricevuti, ancora da trattare o da far uscire.
  // Il CSS-C in giacenza (Z) non c'e': una volta prodotto non e' piu' rifiuto.
  // Torna al chilo con luglio (381.860 + 25.140) e agosto (144.780 + 0) 2026.
  const gomma = riga && riga.giacenza_totale_kg !== undefined && riga.giacenza_totale_kg !== null
    ? intero(riga.giacenza_totale_kg)
    : intero(riga && riga.giacenza_cippato_kg) + intero(riga && riga.giacenza_saci_kg) + intero(riga && riga.giacenza_intero_kg);
  const restaRegistroKg = gomma + intero(riga && riga.giacenza_ferro_kg);
  // La giacenza del registro comprende anche l'extra raccolta arrivata e non
  // ancora lavorata, che il portale di rete non conosce: a portale deve restare la
  // sola parte di rete. A luglio 2026 non la si era tolta, e 460 kg di extra sono
  // rimasti a portale come rete. Ci va anche l'extra scelta per la pratica che
  // resta in impianto perche' nel mese non e' partita la nave (senza ciabattato
  // uscito: se il ciabattato e' uscito ma mancano gli allegati, la pratica e'
  // comunque bloccata).
  const extraRestaKg = intero(extraInGiacenzaKg) + (extraSenzaNave && V === 0 ? extraProposta : 0);
  const restaKg = Math.max(0, restaRegistroKg - extraRestaKg);

  // Un mese ancora tutto a zero nel registro non e' compilato: non si dichiara.
  const vuoto = !V && !X && !Y && !restaRegistroKg && !(ddt || []).length;
  if (vuoto) blocchi.push('Il mese non e\' ancora compilato nel registro: giacenze, uscite e DDT sono tutti a zero. Finche\' e\' cosi\' non si dichiara nulla e i PFU restano in giacenza.');

  // Il ferro dei formulari: deve fare la colonna X del foglio Cons.
  const ff = formulariFerro(ferro);
  if (ff.quota_kg !== X) avvisi.push(`I formulari del ferro danno ${mig(ff.quota_kg)} kg di quota nostra, il foglio Cons. ne segna ${mig(X)}: il registro va controllato prima di dichiarare.`);

  // Le due letture del totale da dichiarare A PORTALE (CSS-C + terziarie), con
  // dentro l'extra raccolta partita con la nave: regola dell'utente del 22/09/2026.
  // - uscite: V + X + Y del foglio Cons., tutto cio' che e' uscito nel mese,
  //   extra raccolta compresa (i suoi 340 + 120 kg di agosto sono in V e in X);
  // - giacenza: la giacenza di rete a portale a fine mese meno quello che deve
  //   restarci (AD + AE, meno l'extra ancora in impianto).
  // In tutte e due la parte di rete e' il totale meno l'extra. Superato il
  // 22/09/2026: la lettura dalla giacenza dava la sola rete e l'extra si
  // aggiungeva sopra; ad agosto usciva uno scarto di 460 kg fra le letture e un
  // ferro di 82.960 kg, piu' di quello uscito. Con la regola nuova le due letture
  // di agosto coincidono: 534.600 kg, scarto 0, ferro 82.500 = X.
  const uscite = { totale_kg: V + X + Y, extra_kg: extraPfu, rete_kg: V + X + Y - extraPfu };
  const giacenza = portaleFineMeseKg === null || portaleFineMeseKg === undefined ? null : {
    // la giacenza di rete a portale a fine mese, per fine trasporto
    portale_fine_mese_kg: intero(portaleFineMeseKg),
    // quello che a portale deve restare: AD + AE meno l'extra ancora in impianto
    resta_kg: restaKg,
    extra_in_giacenza_kg: extraRestaKg,
    // il totale da caricare a portale secondo questa lettura, e le sue due parti
    totale_kg: intero(portaleFineMeseKg) - restaKg,
    extra_kg: extraPfu,
    rete_kg: intero(portaleFineMeseKg) - restaKg - extraPfu,
  };
  const scarto = giacenza ? giacenza.totale_kg - uscite.totale_kg : null;
  const usata = lettura === 'uscite' || !giacenza ? 'uscite' : 'giacenza';
  if (lettura === 'giacenza' && !giacenza) avvisi.push('Manca la giacenza a portale di fine mese: uso le uscite del registro.');
  const totalePortaleKg = usata === 'giacenza' ? giacenza.totale_kg : uscite.totale_kg;

  // Il ferro e' la parte che si aggiusta: CSS-C e ciabattato sono fatti
  // documentati. L'extra e' gia' dentro il totale a portale e non va aggiunta.
  const ferroTotale = totalePortaleKg - V - Y;
  if (ferroTotale < 0) blocchi.push(`Con questa lettura il ferro verrebbe negativo (${mig(ferroTotale)} kg): ciabattato e CSS-C usciti superano gia' quanto dichiarare. Controlla la giacenza a portale e la riga del mese.`);
  if (ferroTotale > X) avvisi.push(`Il ferro da dichiarare (${mig(ferroTotale)} kg) supera quello uscito nel mese secondo il registro (${mig(X)} kg): la dichiarazione EER 19.12.02 resta di ${mig(X)} kg, la differenza la porta il portale.`);

  if (V > 0 && !scelta.basta) blocchi.push(`Gli allegati VII del mese coprono ${mig(scelta.coperto_kg)} kg, meno del ciabattato uscito (${mig(V)} kg): mancano allegati nel registro.`);

  // Le righe da dichiarare: prima i DDT di CSS-C (spezzati se oltre il limite),
  // poi le terziarie, una per allegato scelto.
  const righeCssc = [];
  for (const d of ddt || []) {
    const kg = intero(d.kg);
    const parti = Math.max(1, Math.ceil(kg / MAX_PER_DICHIARAZIONE_KG));
    let resto = kg;
    for (let i = 0; i < parti; i++) {
      const quota = Math.min(MAX_PER_DICHIARAZIONE_KG, resto);
      righeCssc.push({ tipo: 'cssc', ddt: d.ddt, data: d.data, parte: parti > 1 ? `${i + 1} di ${parti}` : '', base_kg: quota, cssc_kg: quota });
      resto -= quota;
    }
  }
  const righeTer = scelta.scelti.map((a, i) => ({
    tipo: 'terziaria', allegato: a.numero, trasportatore: a.trasportatore, destinatario: a.destinatario, data: a.data,
    peso_allegato_kg: intero(a.kg),
    base_kg: i < n - 1 ? intero(a.kg) : V - somma(scelta.scelti.slice(0, n - 1), 'kg'),
  }));
  righeTer.forEach(r => { r.cippato_kg = r.base_kg; });

  const posti = [...righeCssc, ...righeTer];
  const { ferro: quote, avanza_kg: avanza } = ripartisciFerro(posti, Math.max(0, ferroTotale));
  posti.forEach((r, i) => { r.ferro_kg = quote[i]; r.totale_kg = r.base_kg + r.ferro_kg; });
  // Il ferro che non entra nelle dichiarazioni del mese non si carica da solo: le
  // uscite di metalli non vanno a portale senza un DDT o un allegato VII. Resta in
  // giacenza e rientra con la nave dopo, come a gennaio, marzo e aprile 2026:
  // dichiarazioni di soli metalli non ce ne sono mai state.
  const soloFerro = [];
  if (avanza > 0) {
    avvisi.push(righeTer.length
      ? `Restano ${mig(avanza)} kg di ferro che non entrano nelle terziarie senza superare ${mig(MAX_PER_DICHIARAZIONE_KG)} kg: servirebbe un altro allegato VII; altrimenti restano in giacenza per la nave dopo.`
      : `Restano ${mig(avanza)} kg di ferro che non entrano nei DDT di CSS-C: senza una nave non si caricano, restano in giacenza e si dichiarano con la prossima.`);
  }
  if (!posti.length && ferroTotale > 0) avvisi.push('Nel mese sono usciti solo metalli: a portale non si carica nulla e la quantita\' resta in giacenza fino alla nave dopo.');

  // L'extra raccolta parte nell'ultima terziaria. Nella riga della terziaria
  // resta la parte di rete (cippato_kg, ferro_kg, totale_kg: ad agosto 19.880,
  // come nei documenti consegnati), l'extra si scrive in una riga sua con la
  // stessa terziaria, e la terziaria si chiude a portale col peso intero
  // (chiusura_portale_kg = totale_kg + extra_kg: 20.340). Regola del 22/09/2026.
  posti.forEach(r => { r.extra_kg = 0; });
  let rigaExtra = null;
  if (extraPfu > 0) {
    const ultima = righeTer[righeTer.length - 1];
    if (ultima.cippato_kg < extraCipp || ultima.ferro_kg < extraFerro) blocchi.push('L\'ultima terziaria e\' troppo piccola per contenere l\'extra raccolta: controlla la ripartizione.');
    else {
      ultima.cippato_kg -= extraCipp;
      ultima.ferro_kg -= extraFerro;
      ultima.totale_kg = ultima.cippato_kg + ultima.ferro_kg;
      ultima.extra_kg = extraPfu;
      // Le date obbligatorie dei formulari (regola dell'utente del 22/09/2026):
      // un formulario con la fine trasporto ma con l'immissione o l'inizio che
      // mancano, o con le date nell'ordine sbagliato, resta nella pratica, perche'
      // l'extra e' partita e la fine trasporto la colloca; ma si segnala negli
      // avvisi (passo 2 e foglio Controlli) e accanto ai documenti (avvisi_date),
      // perche' il documento dell'extra riporta le date come sono. Prima l'avviso
      // stava solo accanto alla casella del passo 2 e il Word usciva col buco.
      const avvisiDate = (extra.formulari || []).filter(f => f && f.date_da_sistemare).map(f => `Il formulario ${f.formulario || 'senza numero'} dell'extra raccolta ha le date da sistemare: ${f.date_da_sistemare}. Immissione, inizio e fine trasporto sono obbligatorie: sistemale nel formulario prima di mandare il documento dell'extra raccolta, che riporta inizio e fine trasporto cosi' come sono (una data che manca resta vuota).`);
      avvisi.push(...avvisiDate);
      rigaExtra = {
        allegato: ultima.allegato, trasportatore: ultima.trasportatore, destinatario: ultima.destinatario, data: ultima.data, peso_allegato_kg: ultima.peso_allegato_kg,
        cippato_kg: extraCipp, ferro_kg: extraFerro, totale_kg: extraPfu, formulari: extra.formulari || [],
        // la terziaria in cui sta e come si chiude a portale: parte di rete + questa extra
        rete_terziaria_kg: ultima.totale_kg,
        chiusura_terziaria_kg: ultima.totale_kg + extraPfu,
        avvisi_date: avvisiDate,
      };
    }
  }
  // Il peso con cui ogni dichiarazione si chiude a portale: e' questo che non
  // deve passare i 38.000 kg.
  posti.forEach(r => { r.chiusura_portale_kg = r.totale_kg + r.extra_kg; });

  // I numeri TER, in ordine crescente, vanno agli allegati nell'ordine di scelta.
  const ter = [...new Set((terziarie || []).map(t => String(t).trim().toUpperCase()).filter(Boolean))].sort();
  righeTer.forEach((r, i) => { r.terziaria = ter[i] || ''; });
  if (ter.length && ter.length !== righeTer.length) avvisi.push(`Servono ${righeTer.length} terziarie e ne sono state indicate ${ter.length}.`);
  if (rigaExtra) {
    rigaExtra.terziaria = righeTer[righeTer.length - 1].terziaria;
    const quale = rigaExtra.terziaria || `dell'allegato VII n. ${rigaExtra.allegato}`;
    rigaExtra.nota = `extra raccolta compresa nella chiusura a portale della terziaria ${quale}: ${mig(rigaExtra.chiusura_terziaria_kg)} kg = ${mig(rigaExtra.rete_terziaria_kg)} di rete + ${mig(rigaExtra.totale_kg)} di extra raccolta (${mig(rigaExtra.cippato_kg)} di ciabattato e ${mig(rigaExtra.ferro_kg)} di ferro)`;
  }

  for (const r of posti) {
    r.residuo_kg = MAX_PER_DICHIARAZIONE_KG - r.chiusura_portale_kg;
    if (r.chiusura_portale_kg > MAX_PER_DICHIARAZIONE_KG) blocchi.push(`Una dichiarazione supera ${mig(MAX_PER_DICHIARAZIONE_KG)} kg (${mig(r.chiusura_portale_kg)}).`);
  }

  const cssc = { righe: righeCssc, cssc_kg: somma(righeCssc, 'cssc_kg'), ferro_kg: somma(righeCssc, 'ferro_kg'), totale_kg: somma(righeCssc, 'totale_kg') };
  if (cssc.cssc_kg !== Y) avvisi.push(`I DDT di CSS-C del mese fanno ${mig(cssc.cssc_kg)} kg, il foglio Cons. ne segna ${mig(Y)}.`);
  const terz = {
    righe: righeTer,
    peso_allegati_kg: somma(righeTer, 'peso_allegato_kg'),
    // la parte di rete delle terziarie: come nelle tabelle dei documenti
    cippato_kg: somma(righeTer, 'cippato_kg'),
    ferro_kg: somma(righeTer, 'ferro_kg'),
    totale_kg: somma(righeTer, 'totale_kg'),
    // l'extra raccolta dentro l'ultima, e quanto fanno le terziarie a portale
    extra_kg: somma(righeTer, 'extra_kg'),
    chiusura_portale_kg: somma(righeTer, 'chiusura_portale_kg'),
  };
  const reteDichiarata = cssc.totale_kg + terz.totale_kg + somma(soloFerro, 'totale_kg');
  const extraDichiarata = rigaExtra ? rigaExtra.totale_kg : 0;
  const ultima = righeTer[righeTer.length - 1] || null;
  return {
    vuoto,
    letture: { uscite, giacenza, scarto_kg: scarto, usata },
    // Il totale da caricare a portale: CSS-C + terziarie col peso di chiusura,
    // extra raccolta partita con la nave compresa. Va nella dichiarazione di rete
    // del gestionale, perche' e' quello che il portale decurta e riconosce.
    portale_kg: reteDichiarata + extraDichiarata,
    // La parte di rete, senza l'extra: la riga IRIGOM del riepilogo.
    rete_kg: reteDichiarata,
    // L'extra raccolta di questa pratica: riga EXTRA RACCOLTA, canale suo.
    extra_kg: extraDichiarata,
    // Come si chiude a portale l'ultima terziaria: la parte di rete, l'extra che
    // porta (0 se non ce n'e') e il peso con cui si chiude.
    chiusura_ultima_terziaria: ultima ? { terziaria: ultima.terziaria, allegato: ultima.allegato, rete_kg: ultima.totale_kg, extra_kg: ultima.extra_kg, portale_kg: ultima.chiusura_portale_kg } : null,
    ferro: { ...ff, dichiarato_kg: ff.quota_kg },
    // bacino e scarto vengono con la scelta: la pagina dice fra quali allegati ha
    // cercato e di quanto la somma sfora, e senza questi due diceva il falso.
    allegati: { ordinati: scelta.ordinati, scelti: scelta.scelti, coperto_kg: scelta.coperto_kg, bacino: scelta.bacino, scarto_kg: scelta.scarto_kg },
    terziarie_da_aprire: righeTer.length,
    // Usciti solo metalli ferrosi, nessuna gomma e nessun CSS-C: il mese si segna
    // "solo metalli ferrosi" e a portale non si carica nulla.
    solo_metalli: !posti.length && X > 0,
    cssc,
    terziarie: terz,
    solo_ferro: soloFerro,
    extra: rigaExtra,
    // I materiali della sola rete: cippato + metalli + CSS-C = rete_kg.
    materiali: {
      cippato_kg: terz.cippato_kg,
      metalli_kg: cssc.ferro_kg + terz.ferro_kg + somma(soloFerro, 'ferro_kg'),
      cssc_kg: cssc.cssc_kg,
    },
    // I materiali di tutte le chiusure a portale, extra compresa: cippato +
    // metalli + CSS-C = portale_kg. Vanno nella dichiarazione di rete del gestionale.
    materiali_portale: {
      cippato_kg: terz.cippato_kg + (rigaExtra ? rigaExtra.cippato_kg : 0),
      metalli_kg: cssc.ferro_kg + terz.ferro_kg + somma(soloFerro, 'ferro_kg') + (rigaExtra ? rigaExtra.ferro_kg : 0),
      cssc_kg: cssc.cssc_kg,
    },
    avvisi,
    blocchi,
  };
}

export { mig as migliaia };
