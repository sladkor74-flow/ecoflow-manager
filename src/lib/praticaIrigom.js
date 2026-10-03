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
// Il ferro che resta indietro

const leggiDatiJson = (p) => {
  try { return JSON.parse((p && p.dati_json) || '{}') || {}; } catch (e) { return {}; }
};

/**
 * Il ferro dei mesi prima che non e' mai arrivato a portale.
 *
 * Le uscite di metalli ferrosi non hanno un documento che si carichi a portale:
 * il loro peso viaggia dentro le dichiarazioni delle terziarie e dei DDT di
 * CSS-C, e il portale accetta al massimo 38.000 kg per dichiarazione. In un mese
 * senza nave e senza CSS-C non c'e' niente a cui attaccarlo: il ferro esce
 * dall'impianto, si dichiara al consorzio per email, e a portale resta da
 * dichiarare. Rientra con la nave dopo (gennaio, marzo, aprile e settembre 2026).
 *
 * Questo e' quel saldo: quanto ferro e' uscito dal registro nei mesi prima meno
 * quanto ne hanno portato a portale le loro dichiarazioni. Serve a dire il totale
 * del mese senza passare dalla giacenza del portale - la seconda strada per lo
 * stesso numero - e a scriverlo in chiaro, perche' un mese che dichiara piu'
 * ferro di quello uscito, senza una frase che lo spieghi, sembra un errore.
 *
 * Regola dell'utente del 03/10/2026, sull'esempio di ottobre: a novembre si
 * dichiara anche il ferro uscito a settembre (cella X94 del foglio Cons.), «che
 * era gestito al di fuori del portale ma che adesso contribuisce al totale dei
 * pfu», perche' dopo il caricamento la giacenza a portale deve essere AD + AE.
 *
 * DUE FONTI, NON UNA. Quanto ferro un mese ha portato a portale lo dice la sua
 * pratica, ma le pratiche nel gestionale cominciano ad agosto 2026 e un mese puo'
 * essere stato registrato a mano, senza pratica: nel riepilogo si vede lo stesso
 * - ad aprile e a settembre 2026 la casella arancione «solo metalli ferrosi,
 * dichiarati al consorzio via email» - e quella e' una prova buona quanto l'altra.
 * Percio' si guarda prima la pratica e poi la DichiarazioneSito di rete del mese:
 * con quantita' a zero (o motivo_assenza 'solo_metalli') a portale non e' andato
 * niente, con una quantita' vera i metalli dentro la dichiarazione sono il ferro
 * arrivato a portale. Un mese senza ne' l'una ne' l'altra si dice, non si indovina.
 *
 * @param {array}  mesi            le dodici righe del foglio Cons. [{ mese, uscite_ferro_kg }]
 * @param {array}  pratiche        le PraticaIrigom dell'anno
 * @param {string} p.mese          il mese che si sta preparando: si guardano solo quelli prima
 * @param {array}  p.dichiarazioni le DichiarazioneSito di RETE di quel sito, gia' filtrate
 */
export function ferroArretrato(mesi, pratiche, { mese, dichiarazioni = [] } = {}) {
  const fino = MESI.indexOf(mese);
  const dichDelMese = (nome) => (dichiarazioni || []).find(d => d && d.mese === nome) || null;
  /**
   * Quanto ferro quel mese ha portato a portale, e da che cosa lo sappiamo.
   * `noto` falso vuol dire che non si sa: non e' zero, e non si conta.
   */
  const quantoAPortale = (p, dati, bozza, d, uscito) => {
    if (p && dati && dati.solo_metalli) return { kg: 0, noto: true, fonte: 'mese di soli metalli' };
    if (p && dati && dati.materiali_portale && Number.isFinite(Number(dati.materiali_portale.metalli_kg))) {
      return { kg: intero(dati.materiali_portale.metalli_kg), noto: true, fonte: 'dalla pratica' };
    }
    // Pratica di prima del 22/09/2026, senza materiali_portale: la sua riga porta
    // i metalli della sola rete, e il ferro dell'extra raccolta - che a portale
    // c'e' andato dentro l'ultima terziaria - sta nell'extra. Senza sommarlo
    // diventava arretrato (120 kg su agosto 2026).
    if (p) return { kg: intero(p.metalli_kg) + intero(leggiExtraJson(p).ferro_kg), noto: true, fonte: 'dalla riga della pratica' };
    if (d) {
      const quantita = intero(d.quantita_kg);
      if (d.motivo_assenza === 'solo_metalli' || quantita === 0) {
        return { kg: 0, noto: true, fonte: 'dichiarato al consorzio, a portale niente' };
      }
      // Una dichiarazione scritta ma non ancora caricata non ha portato niente a
      // portale, e quando la caricherai ne portera': contarla adesso chiuderebbe
      // un debito ancora aperto. Tutti gli altri lettori del gestionale guardano
      // questo flag, e anche la giacenza di fine mese della pagina.
      if (!d.caricata_inviata) return { kg: 0, noto: false, fonte: 'dichiarazione non ancora caricata a portale' };
      const metalli = intero(d.metalli_kg);
      if (metalli > 0) return { kg: metalli, noto: true, fonte: 'dalla dichiarazione del mese' };
      // Una dichiarazione caricata a portale senza i metalli scritti: quanto ferro
      // portasse non si sa. Dire zero farebbe nascere un arretrato che forse non
      // c'e', e dichiararlo di nuovo lo porterebbe a portale due volte.
      return { kg: 0, noto: false, fonte: 'dichiarazione senza i metalli scritti' };
    }
    if (bozza) return { kg: 0, noto: true, fonte: 'pratica da registrare' };
    // Nessuna traccia: se in quel mese non e' uscito ferro non c'e' niente da
    // sapere; se e' uscito, non si sa che fine abbia fatto.
    return { kg: 0, noto: !uscito, fonte: uscito ? 'senza pratica e senza dichiarazione' : 'niente da dire' };
  };
  // VALE LA VERSIONE REGISTRATA, NON LA PIU' RECENTE.
  //
  // Riscaricare la cartella di un mese gia' registrato apre una bozza (versione
  // nuova, stato in_preparazione) accanto a quella registrata. Prendendo la piu'
  // recente, quel mese risultava di colpo senza niente a portale e il suo ferro
  // tornava arretrato: un clic su «scarica la cartella» di agosto e ottobre
  // dichiarava 82.500 kg due volte. Una bozza non cancella quello che il mese ha
  // gia' dichiarato; si segnala, perche' significa che qualcuno lo sta rifacendo.
  const dellMese = (nome, soloRegistrate) => (pratiche || [])
    .filter(x => x && x.mese === nome && x.stato !== 'sostituita' && (!soloRegistrate || x.stato === 'registrata'))
    .sort((a, b) => (b.versione || 1) - (a.versione || 1))[0] || null;
  // DA DOVE PARTE IL SALDO: dal primo mese che il gestionale ha seguito.
  //
  // Le pratiche di Irigom si fanno qui dentro da agosto 2026: dei mesi prima il
  // gestionale non sa quanto ferro sia arrivato a portale, e contarli vorrebbe
  // dire chiamare arretrato tutto il ferro di gennaio-luglio - sette mesi, oltre
  // 696 tonnellate - e dichiarare a ottobre un numero mostruoso. Quei mesi sono
  // chiusi: quello che hanno lasciato indietro, se l'hanno fatto, sta gia' dentro
  // la giacenza del portale, che e' il riscontro dell'altra lettura.
  // DA DOVE PARTE IL SALDO: DOPO L'ULTIMO MESE CHE NON SI SA.
  //
  // Il conto del ferro e' una catena: ogni mese o lascia un debito o ne paga uno,
  // e basta un anello mancante perche' tutto quello che sta prima diventi
  // illeggibile. Un mese che non si sa non si puo' saltare tenendo quelli prima:
  // saltandolo, i debiti dei mesi precedenti restano aperti anche quando e' stato
  // proprio lui a pagarli, e si dichiarerebbero una seconda volta.
  //
  // Il caso vero, trovato in revisione il 03/10/2026: nell'archivio le
  // dichiarazioni di rete di Irigom esistono da gennaio ma non dicono quanti
  // metalli portavano. Facendo partire la finestra dalla prima dichiarazione, il
  // saldo apriva i debiti di aprile e luglio - mesi di soli metalli - e nessuno
  // li pagava, perche' maggio, che quel ferro l'aveva riportato con la nave,
  // restava fuori per via dei metalli non scritti. L'arretrato di ottobre passava
  // da 99.300 a 315.240 kg: 215.940 kg gia' a portale, pronti a essere dichiarati
  // due volte. Ripartendo dopo l'ultimo mese illeggibile la catena e' intera, e
  // quello che resta fuori si dice.
  const letture = [];
  for (let i = 0; i < MESI.length; i++) {
    if (fino >= 0 && i >= fino) break;
    const nome = MESI[i];
    const riga = (mesi || []).find(m => m && m.mese === nome);
    const uscito = intero(riga && riga.uscite_ferro_kg);
    const p = dellMese(nome, true);
    const bozza = p ? null : dellMese(nome, false);
    const dich = p ? null : dichDelMese(nome);
    const dati = p ? leggiDatiJson(p) : null;
    const letto = quantoAPortale(p, dati, bozza, dich, uscito);
    // Se nel mese e' uscito ciabattato o CSS-C, allora c'erano terziarie o DDT a
    // cui il ferro poteva essere attaccato: dire «mancava la terziaria» su quel
    // mese sarebbe falso, e il motivo va scritto in un altro modo.
    const avevaNave = intero(riga && riga.uscite_cippato_kg) > 0 || intero(riga && riga.uscite_cssc_kg) > 0;
    letture.push({ nome, uscito, bozza: !!bozza && !dich, avevaNave, ...letto });
  }
  // L'anello mancante piu' recente: la catena buona comincia subito dopo.
  let inizio = 0;
  for (let i = letture.length - 1; i >= 0; i--) {
    if (!letture[i].noto) { inizio = i + 1; break; }
  }
  const dettaglio = [];
  const prima = [];
  const daCapire = [];
  const nonSiSa = [];
  const senzaNiente = [];
  letture.forEach((l, i) => {
    if (i < inizio) {
      if (!l.uscito) return;
      prima.push(l.nome);
      if (l.fonte === 'senza pratica e senza dichiarazione') senzaNiente.push(l.nome);
      else if (!l.noto) nonSiSa.push(l.nome);
      return;
    }
    if (l.bozza) daCapire.push(l.nome);
    if (!l.uscito && !l.kg) return;
    dettaglio.push({ mese: l.nome, uscito_kg: l.uscito, a_portale_kg: l.kg, resta_kg: l.uscito - l.kg, fonte: l.fonte, aveva_nave: l.avevaNave });
  });
  const uscito_kg = somma(dettaglio, 'uscito_kg');
  const a_portale_kg = somma(dettaglio, 'a_portale_kg');

  // IL SALDO E' UN REGISTRO DI DEBITI, NON UNA SOMMA CON SEGNO.
  //
  // Un mese che recupera lascia una riga negativa, e sommando con segno quella
  // riga si mangiava l'arretrato dei mesi dopo. Il caso vero: se il gestionale
  // parte a ottobre, la pratica di ottobre recupera il ferro di settembre, che
  // sta fuori dalla finestra; la sua riga vale -99.300, novembre di soli metalli
  // ne lascia 41.200, e il saldo con segno diceva -58.100, che componiMese
  // portava a zero. Dicembre dichiarava 41.200 kg di ferro in meno e nessun
  // avviso lo diceva. Lo stesso capita a ogni capodanno.
  //
  // Quindi: ogni mese che lascia ferro indietro apre un debito, ogni mese che ne
  // recupera paga i debiti piu' vecchi per primi, e quello che resta aperto e'
  // l'arretrato - sempre positivo, e sempre attribuito ai mesi giusti. Un
  // recupero che non trova debiti aperti viene da fuori finestra: non si puo'
  // restituire a nessuno, e si dice.
  const coda = [];
  let fuoriFinestra = 0;
  for (const r of dettaglio) {
    if (r.resta_kg > 0) { coda.push({ mese: r.mese, kg: r.resta_kg }); continue; }
    let paga = -r.resta_kg;
    while (paga > 0 && coda.length) {
      const quanto = Math.min(paga, coda[0].kg);
      coda[0].kg -= quanto;
      paga -= quanto;
      if (coda[0].kg <= 0) coda.shift();
    }
    if (paga > 0) fuoriFinestra += paga;
  }

  return {
    arretrato_kg: somma(coda, 'kg'),
    uscito_kg,
    a_portale_kg,
    dettaglio,
    // il primo mese della catena buona, e quelli di prima che restano fuori dal
    // saldo perche' non si sa quanto ferro abbiano portato a portale
    // il primo mese che il saldo conta davvero, non il primo della finestra: i mesi
    // senza niente da dire non sono un inizio
    dal_mese: dettaglio.length ? dettaglio[0].mese : '',
    prima_del_gestionale: prima,
    // I mesi che devono ancora del ferro, coi chili che restano aperti: la somma
    // fa esattamente arretrato_kg. Chi scrive la frase che spiega l'arretrato
    // parte da qui, cosi' non puo' dire un numero diverso da quello dichiarato,
    // ne' nominare un mese che il recupero ha gia' pareggiato.
    componi: coda.map(c => ({ mese: c.mese, kg: c.kg })),
    mesi: coda.map(c => c.mese),
    // ferro recuperato oltre quello che questa finestra conosce
    fuori_finestra_kg: fuoriFinestra,
    // un mese preparato e non registrato non si sa se e' andato a portale: lo si dice
    da_capire: daCapire,
    // I mesi dentro la finestra di cui il gestionale non ha ne' una pratica ne' una
    // dichiarazione: il saldo conta il loro ferro come arretrato, ma se quella
    // dichiarazione e' stata caricata a portale fuori dal gestionale quel ferro non
    // e' arretrato, e dichiararlo di nuovo lo porterebbe a portale due volte.
    senza_pratica: senzaNiente,
    // Mesi con una dichiarazione che non dice quanti metalli portava, o non ancora
    // caricata a portale: quel ferro non si sa dove sia finito, e la catena del
    // saldo si spezza li'. Restano fuori invece di valere zero - uno zero inventato
    // qui diventa un arretrato che forse non esiste, da dichiarare due volte.
    non_si_sa: nonSiSa,
  };
}

/**
 * Quali mesi paga un recupero, coi chili: il ferro che rientra paga i debiti piu'
 * vecchi per primi, come nel saldo. Serve a non nominare, in un avviso, mesi che
 * il recupero non tocca: con 119.300 kg aperti fra settembre e ottobre e 40.000
 * recuperati, paga solo settembre.
 */
export function mesiRecuperati(componi, quanto) {
  const pagati = [];
  let resta = Math.max(0, intero(quanto));
  for (const c of componi || []) {
    if (resta <= 0) break;
    const kg = Math.min(resta, intero(c.kg));
    if (kg > 0) pagati.push({ mese: c.mese, kg });
    resta -= kg;
  }
  return pagati;
}

/** L'arretrato come numero, sia che arrivi da ferroArretrato sia come kg. */
const arretratoKg = (a) => (a && typeof a === 'object' ? intero(a.arretrato_kg) : intero(a));
const arretratoMesi = (a) => (a && typeof a === 'object' && Array.isArray(a.mesi) ? a.mesi : []);

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
 * @param {object} p.arretrato       quello che torna da ferroArretrato (o i soli kg): il ferro
 *                                   dei mesi prima che a portale non e' ancora arrivato
 */
export function componiMese({ riga, ferro = [], allegati = [], ddt = [], portaleFineMeseKg = null, lettura = 'giacenza', extra = null, extraInGiacenzaKg = 0, terziarie = [], criterio = 'vicino', arretrato = null }) {
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

  // Le tre letture del totale da dichiarare A PORTALE (CSS-C + terziarie), con
  // dentro l'extra raccolta partita con la nave: regola dell'utente del 22/09/2026.
  // - uscite: V + X + Y del foglio Cons., tutto cio' che e' uscito nel mese,
  //   extra raccolta compresa (i suoi 340 + 120 kg di agosto sono in V e in X);
  // - registro: le uscite del mese piu' il ferro che i mesi senza nave hanno
  //   lasciato indietro, che a portale non e' ancora stato dichiarato (regola
  //   dell'utente del 03/10/2026, vedi ferroArretrato);
  // - giacenza: la giacenza di rete a portale a fine mese meno quello che deve
  //   restarci (AD + AE, meno l'extra ancora in impianto).
  // In tutte e tre la parte di rete e' il totale meno l'extra. Registro e giacenza
  // sono due strade indipendenti per lo stesso numero: se non danno lo stesso
  // totale c'e' qualcosa da capire prima di caricare, ed e' quello che dice lo
  // scarto. Superato il 22/09/2026: la lettura dalla giacenza dava la sola rete e
  // l'extra si aggiungeva sopra; ad agosto usciva uno scarto di 460 kg fra le
  // letture e un ferro di 82.960 kg, piu' di quello uscito. Con la regola nuova le
  // letture di agosto coincidono: 534.600 kg, scarto 0, ferro 82.500 = X.
  const arretratoFerro = Math.max(0, arretratoKg(arretrato));
  const uscite = { totale_kg: V + X + Y, extra_kg: extraPfu, rete_kg: V + X + Y - extraPfu };
  const registro = {
    uscite_kg: uscite.totale_kg,
    arretrato_kg: arretratoFerro,
    mesi_arretrato: arretratoMesi(arretrato),
    totale_kg: uscite.totale_kg + arretratoFerro,
    extra_kg: extraPfu,
    rete_kg: uscite.totale_kg + arretratoFerro - extraPfu,
  };
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
  // Lo scarto confronta la giacenza col registro, non con le sole uscite del mese:
  // senza l'arretrato un mese che recupera il ferro di quello prima mostrerebbe
  // uno scarto grande quanto l'arretrato, e sembrerebbe un errore invece di essere
  // il recupero. Senza arretrato il registro vale le uscite e lo scarto e' quello
  // di prima. Resta anche il confronto con le sole uscite, che e' un'altra cosa.
  const scarto = giacenza ? giacenza.totale_kg - registro.totale_kg : null;
  const scartoUscite = giacenza ? giacenza.totale_kg - uscite.totale_kg : null;
  // La sola lettura che ha bisogno della giacenza a portale e' quella dalla
  // giacenza: le altre due le sceglie chi lavora e vanno rispettate anche senza,
  // altrimenti un pulsante premuto non fa niente e il totale non e' quello che
  // mostra il riquadro acceso.
  const usata = lettura === 'uscite' ? 'uscite'
    : lettura === 'registro' ? 'registro'
      : giacenza ? 'giacenza'
        : (arretratoFerro > 0 ? 'registro' : 'uscite');
  if (lettura === 'giacenza' && !giacenza) {
    avvisi.push(arretratoFerro > 0
      ? `Manca la giacenza a portale di fine mese: uso le uscite del registro piu' l'arretrato di ferro (${mig(arretratoFerro)} kg), e resta senza riscontro.`
      : 'Manca la giacenza a portale di fine mese: uso le uscite del registro.');
  }
  const totalePortaleKg = usata === 'giacenza' ? giacenza.totale_kg : usata === 'registro' ? registro.totale_kg : uscite.totale_kg;
  if (arretratoFerro > 0 && usata === 'uscite') {
    avvisi.push(`Le uscite del mese non portano l'arretrato di ferro: restano fuori ${mig(arretratoFerro)} kg usciti ${arretratoMesi(arretrato).length ? `a ${arretratoMesi(arretrato).join(', ').toLowerCase()}` : 'nei mesi prima'} e mai dichiarati a portale. Con questa lettura la giacenza a portale non torna con AD + AE del registro.`);
  }
  if (usata === 'registro' && arretrato && typeof arretrato === 'object') {
    if (!arretrato.dal_mese) {
      avvisi.push('Il saldo del ferro non si puo\' fare: di nessun mese di quest\'anno il gestionale sa quanto ne sia arrivato a portale. Questa lettura porta le sole uscite del mese, e se qualche mese ha lasciato indietro del ferro lo sa solo la giacenza a portale.');
    } else if (Array.isArray(arretrato.prima_del_gestionale) && arretrato.prima_del_gestionale.length) {
      avvisi.push(`Il saldo del ferro parte da ${String(arretrato.dal_mese).toLowerCase()}: di ${arretrato.prima_del_gestionale.join(', ').toLowerCase()} non si sa quanto ferro sia arrivato a portale, quindi quei mesi restano fuori e questa lettura vale solo se erano in pari. Il riscontro e' la giacenza a portale, che li porta comunque dentro.`);
    }
  }
  if (arretrato && Array.isArray(arretrato.da_capire) && arretrato.da_capire.length) {
    avvisi.push(`Nell'arretrato di ferro ${arretrato.da_capire.join(', ').toLowerCase()} conta per intero: la pratica di quel mese e' preparata ma non registrata, quindi a portale non ci e' andato niente. Registrala, altrimenti quel ferro si dichiara qui e poi una seconda volta col suo mese.`);
  }
  if (arretrato && arretrato.fuori_finestra_kg > 0) {
    avvisi.push(`Una pratica dei mesi scorsi ha portato a portale ${mig(arretrato.fuori_finestra_kg)} kg di ferro in piu' di quello uscito, e il saldo non sa a quale mese appartengano: vengono da prima di ${String(arretrato.dal_mese || "quando il gestionale ha preso in mano Irigom").toLowerCase()} o dall'anno scorso. Non li ho sottratti all'arretrato di questo mese: il riscontro e' la giacenza a portale.`);
  }
  // Il saldo guarda solo i mesi dell'anno: il registro di carico e scarico e' uno
  // per anno, e del dicembre prima non si legge la colonna X. A gennaio quindi
  // l'arretrato e' sempre zero, e se dicembre ha lasciato indietro del ferro solo
  // la giacenza a portale lo sa.
  // Vale per ogni lettura che non sia quella dalla giacenza, non solo per quella
  // dal registro: a gennaio l'arretrato e' zero per costruzione, quindi senza la
  // fotografia del portale la lettura ripiega sulle uscite e l'avviso, gia' scritto
  // una volta per la sola lettura dal registro, non sarebbe mai uscito nel caso per
  // cui serviva.
  if (usata !== 'giacenza' && String(riga && riga.mese || '') === MESI[0]) {
    avvisi.push('A gennaio il saldo del ferro riparte da zero: il registro e\' quello dell\'anno nuovo e del dicembre prima non si legge nulla. Se a dicembre non e\' partita la nave, quel ferro non e\' in questa lettura e resta da dichiarare: serve la giacenza a portale di fine mese.');
  }
  if (usata !== 'giacenza' && arretrato && Array.isArray(arretrato.senza_pratica) && arretrato.senza_pratica.length) {
    avvisi.push(`Di ${arretrato.senza_pratica.join(', ').toLowerCase()} il gestionale non ha ne' una pratica ne' una dichiarazione: li' il conto del ferro si ferma, e tutto quello che viene prima resta fuori dal saldo. Non li conto come arretrato - se quelle dichiarazioni sono state caricate a portale fuori dal gestionale, dichiararle qui le porterebbe a portale due volte. Registra quei mesi e il saldo si allunga all'indietro.`);
  }
  if (usata !== 'giacenza' && arretrato && Array.isArray(arretrato.non_si_sa) && arretrato.non_si_sa.length) {
    avvisi.push(`Di ${arretrato.non_si_sa.join(', ').toLowerCase()} la dichiarazione c'e' ma non dice quanti metalli ferrosi portava, o non e' ancora caricata a portale: li' il conto del ferro si ferma, perche' un mese saltato non paga i debiti dei mesi prima e li lascerebbe aperti anche se e' stato lui a chiuderli. Scrivi i metalli su quelle dichiarazioni e il saldo si allunga all'indietro.`);
  }

  // Il ferro e' la parte che si aggiusta: CSS-C e ciabattato sono fatti
  // documentati. L'extra e' gia' dentro il totale a portale e non va aggiunta.
  const ferroTotale = totalePortaleKg - V - Y;
  if (ferroTotale < 0) blocchi.push(`Con questa lettura il ferro verrebbe negativo (${mig(ferroTotale)} kg): ciabattato e CSS-C usciti superano gia' quanto dichiarare. Controlla la giacenza a portale e la riga del mese.`);

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
  // Senza nessuna dichiarazione nel mese il limite dei 38.000 kg non c'entra: il
  // motivo lo dice l'avviso dei soli metalli, qui sotto. Prima questo avviso
  // diceva che il ferro «non entra nei DDT di CSS-C» anche in un mese che non ha
  // nessun DDT, e per lo stesso numero uscivano due motivi diversi.
  if (avanza > 0 && posti.length) {
    avvisi.push(righeTer.length
      ? `Restano ${mig(avanza)} kg di ferro che non entrano nelle terziarie senza superare ${mig(MAX_PER_DICHIARAZIONE_KG)} kg: servirebbe un altro allegato VII; altrimenti restano in giacenza per la nave dopo.`
      : `Restano ${mig(avanza)} kg di ferro che non entrano nei DDT di CSS-C senza superare ${mig(MAX_PER_DICHIARAZIONE_KG)} kg: senza una nave il resto non si carica, resta in giacenza e si dichiara con la prossima.`);
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
  // UN MESE DI SOLI METALLI: IL FERRO USCITO SI DICE, MA FUORI DAI MATERIALI.
  //
  // Regola dell'utente, 03/10/2026: «nel riepilogo metti tutta la quota di ferro
  // uscita che leggi dalla tabella - quello e' tutto Ecotyre - quindi ad aprile
  // metti 89.780 e a settembre metti 99.300».
  //
  // Il primo tentativo l'ho messo DENTRO materiali e materiali_portale, e ha
  // rotto tutto: quei due oggetti hanno un vincolo scritto due righe sotto -
  // cippato + metalli + CSS-C deve fare rete_kg, e materiali_portale deve fare
  // portale_kg - e in un mese di soli metalli quei totali sono ZERO, perche' a
  // portale non si carica niente. Aggiungendoci il ferro le differenze
  // diventavano negative. L'utente: «rifacendo la pratica il ferro non esce e da'
  // valori negativi».
  //
  // Il ferro di quei mesi non e' un materiale di una dichiarazione: e' una
  // quantita' uscita dal registro, e sta in un campo suo.
  const soloMetalli = !posti.length && X > 0;

  // IL FERRO IN PIU' DI QUELLO USCITO NEL MESE: SI DICE QUANTO NE ENTRA DAVVERO.
  //
  // Il ferro da portare a portale puo' superare quello uscito nel mese, e non e'
  // un errore: e' il recupero dei mesi senza nave. Va detto per nome, perche' un
  // numero piu' grande di quello del registro, senza una frase che lo spieghi, fa
  // dubitare di tutta la pratica. Ma la frase deve dire quello che entra DAVVERO
  // nelle dichiarazioni, non quello che si voleva: col limite dei 38.000 kg una
  // parte resta fuori, e annunciare l'arretrato come caricato e' il modo di non
  // recuperarlo mai piu' - chi rilegge il foglio a mesi di distanza lo crede fatto.
  // Per questo si scrive dopo la ripartizione, e nomina solo i mesi che il
  // recupero paga davvero, dai piu' vecchi.
  const ferroAPortale = cssc.ferro_kg + terz.ferro_kg + (rigaExtra ? rigaExtra.ferro_kg : 0);
  const recupero = Math.min(Math.max(0, ferroTotale - X), arretratoFerro);
  const recuperoVero = Math.min(Math.max(0, ferroAPortale - X), arretratoFerro);
  const pagati = arretrato && typeof arretrato === 'object' ? mesiRecuperati(arretrato.componi, recuperoVero) : [];
  if (ferroTotale > X) {
    const daiMesi = pagati.length ? ` da ${pagati.map(p => p.mese).join(', ').toLowerCase()}` : '';
    const nonSpiegato = ferroTotale - X - recupero;
    if (recupero > 0) {
      avvisi.push(avanza > 0
        ? `Il ferro da portare a portale sarebbe ${mig(ferroTotale)} kg - ${mig(X)} usciti nel mese piu' ${mig(recupero)} kg rimasti indietro dai mesi senza nave - ma nelle dichiarazioni del mese ce ne entrano ${mig(ferroAPortale)} senza passare i ${mig(MAX_PER_DICHIARAZIONE_KG)} kg: di arretrato se ne recuperano ${mig(recuperoVero)} kg${daiMesi}, e ${mig(arretratoFerro - recuperoVero)} restano indietro per la nave dopo. La dichiarazione EER 19.12.02 di questo mese resta di ${mig(X)} kg.`
        : `Il ferro che le dichiarazioni portano a portale e' ${mig(ferroAPortale)} kg: ${mig(X)} usciti nel mese piu' ${mig(recuperoVero)} kg rimasti indietro${daiMesi}${nonSpiegato > 0 ? ` e altri ${mig(nonSpiegato)} kg che il registro non spiega` : ''}. La dichiarazione EER 19.12.02 di questo mese resta di ${mig(X)} kg: l'arretrato era gia' stato dichiarato al consorzio quando il ferro e' uscito, a portale invece non ci e' arrivato.`);
    } else {
      avvisi.push(`Il ferro da dichiarare (${mig(ferroTotale)} kg) supera quello uscito nel mese secondo il registro (${mig(X)} kg): la dichiarazione EER 19.12.02 resta di ${mig(X)} kg, la differenza la porta il portale.`);
    }
  }

  // LA PROVA DELLA PRATICA: dopo il caricamento, a portale deve restare AD + AE.
  //
  // Regola dell'utente del 22/09/2026, ripetuta il 03/10/2026 sull'esempio di
  // ottobre: «sul portale e quindi nel nostro gestionale la giacenza al 31 ottobre
  // di irigom deve essere pari alla somma delle celle AD95+AE95». E' il controllo
  // che chiude il giro, e non e' lo stesso dello scarto fra le letture: lo scarto
  // guarda i totali di partenza, questo guarda come finisce. Fra i due c'e' il
  // ferro che non entra nelle dichiarazioni senza passare i 38.000 kg: con la
  // lettura dalla giacenza i totali tornano e la giacenza finale no.
  const portaleDichiarato = reteDichiarata + extraDichiarata;
  const verifica = giacenza ? {
    // AD + AE della riga del mese: la gomma in impianto piu' i metalli in giacenza
    deve_restare_kg: restaRegistroKg,
    extra_in_giacenza_kg: extraRestaKg,
    // quello che deve restare a portale, che l'extra ancora in impianto non conosce
    resta_a_portale_kg: restaKg,
    // quello che ci resterebbe caricando questa pratica
    resta_dopo_kg: giacenza.portale_fine_mese_kg - portaleDichiarato,
    differenza_kg: giacenza.portale_fine_mese_kg - portaleDichiarato - restaKg,
    torna: giacenza.portale_fine_mese_kg - portaleDichiarato === restaKg,
  } : null;
  if (verifica && !verifica.torna) {
    const d = verifica.differenza_kg;
    // L'ordine dei motivi conta: in un mese di soli metalli non c'e' nessuna
    // dichiarazione, quindi il limite dei 38.000 kg non e' la causa di niente, e
    // darlo come motivo contraddiceva l'avviso due righe sopra.
    const perche = !posti.length
      ? 'nel mese non e\' partita nessuna nave e non c\'e\' nessun DDT di CSS-C: non c\'e\' niente a cui attaccare il ferro, che resta in giacenza fino alla nave dopo'
      : avanza > 0
        ? `restano fuori ${mig(avanza)} kg di ferro che non entrano nelle dichiarazioni senza passare i ${mig(MAX_PER_DICHIARAZIONE_KG)} kg`
        : usata !== 'giacenza'
          ? `stai dichiarando ${usata === 'registro' ? 'il registro' : 'le uscite del mese'} e non la giacenza a portale`
          : 'i DDT di CSS-C o gli allegati VII non coprono quello che il registro dice uscito';
    avvisi.push(`Caricando a portale ${mig(portaleDichiarato)} kg, alla fine del mese a portale resterebbero ${mig(verifica.resta_dopo_kg)} kg invece dei ${mig(verifica.resta_a_portale_kg)} che dice il registro (gomma AD + ferro AE${extraRestaKg ? `, meno ${mig(extraRestaKg)} kg di extra raccolta ancora in impianto` : ''}): ${d > 0 ? `ne resterebbero ${mig(d)} di troppo` : `ne mancherebbero ${mig(-d)}`}, perche' ${perche}.`);
  }

  return {
    vuoto,
    letture: { uscite, registro, giacenza, scarto_kg: scarto, scarto_uscite_kg: scartoUscite, usata },
    // Il controllo che chiude il giro: a portale deve restare AD + AE.
    verifica,
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
    // dichiarato_kg e' la dichiarazione EER 19.12.02 del mese, che vale sempre il
    // ferro uscito nel mese; da_portare_kg e' il peso di ferro che le dichiarazioni
    // a portale si prendono, arretrato dei mesi senza nave compreso.
    // da_portare_kg e' il ferro che questa lettura VUOLE portare a portale;
    // ripartito_kg quello che ci entra davvero, che col limite dei 38.000 kg puo'
    // essere meno. Chi scrive una frase per l'utente usa ripartito_kg e
    // recuperati: dire che l'arretrato e' stato caricato quando e' entrato solo in
    // parte e' il modo di non recuperarlo mai piu'.
    ferro: {
      ...ff,
      dichiarato_kg: ff.quota_kg,
      arretrato_kg: arretratoFerro,
      recupero_kg: recupero,
      recupero_vero_kg: recuperoVero,
      recuperati: pagati,
      resta_indietro_kg: Math.max(0, arretratoFerro - recuperoVero),
      da_portare_kg: Math.max(0, ferroTotale),
      ripartito_kg: ferroAPortale,
      avanza_kg: avanza,
    },
    // bacino e scarto vengono con la scelta: la pagina dice fra quali allegati ha
    // cercato e di quanto la somma sfora, e senza questi due diceva il falso.
    allegati: { ordinati: scelta.ordinati, scelti: scelta.scelti, coperto_kg: scelta.coperto_kg, bacino: scelta.bacino, scarto_kg: scelta.scarto_kg },
    terziarie_da_aprire: righeTer.length,
    // Usciti solo metalli ferrosi, nessuna gomma e nessun CSS-C: il mese si segna
    // "solo metalli ferrosi" e a portale non si carica nulla.
    solo_metalli: soloMetalli,
    // Il ferro uscito nel mese secondo il registro (colonna X del foglio Cons.):
    // in un mese di soli metalli e' tutto quello che c'e' da dire, e la
    // dichiarazione del mese lo porta in metalli_kg con la quantita' a zero -
    // nessun controllo si lamenta, perche' guardano tutti una quantita' > 0.
    ferro_uscito_kg: X,
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
