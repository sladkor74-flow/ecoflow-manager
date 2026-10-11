// L'Andamento di Target & Status: target e raccolto RETE per raccoglitore e
// regione, con l'abbinamento fra il nome del target e quello del portale
// (chiusura dell'audit, 11/10/2026).
//
// Specchio di base44/shared/andamentoTarget.ts per il browser: deve restare
// identico (prove/specchi.mjs). Le ragioni stanno nell'originale.
import { normalizzaRagioneSociale } from './normalizzaRagioneSocialeClient.js';
import { MESI_MOVIMENTI } from './movimenti.js';

/**
 * Stesso raccoglitore fra il nome scritto nel target e quello del portale: nome
 * normalizzato uguale ("SMOCO S.r.l." e "SMOCO SRL"), oppure nome del target
 * abbreviato le cui parole stanno tutte nel nome del portale. Mai il contrario.
 */
export function stessoRaccoglitore(nomeTarget, nomePortale) {
  const a = normalizzaRagioneSociale(nomeTarget || '');
  const b = normalizzaRagioneSociale(nomePortale || '');
  if (!a || !b) return false;
  if (a === b) return true;
  const paroleB = new Set(b.split(' '));
  const paroleA = a.split(' ').filter(p => p.length > 2);
  return paroleA.length > 0 && paroleA.every(p => paroleB.has(p));
}

/**
 * Target a cui va il raccolto di un nome del portale: quello con lo stesso nome
 * normalizzato; se non c'e', il primo il cui nome e' un'abbreviazione del portale.
 * candidati: elenco di nomi di target gia' filtrati (per esempio per regione).
 */
export function targetDelPortale(candidati, nomePortale) {
  const b = normalizzaRagioneSociale(nomePortale || '');
  return candidati.find(n => normalizzaRagioneSociale(n || '') === b)
    ?? candidati.find(n => stessoRaccoglitore(n, nomePortale))
    ?? null;
}

/**
 * Le righe dell'Andamento, una per raccoglitore e regione.
 *
 * mensili: le righe di TargetMensile dell'anno; annui: quelle di
 * TargetRaccoglitore; raccolto: by_raccoglitore di computeRaccolto, canale RETE
 * (per mese, con i nomi dei mesi); filtri: { regione: [], raccoglitore: [] }
 * della pagina, che il file non ha.
 *
 * Una riga c'e' se ha un target annuo, un target mensile o del raccolto: un
 * target senza raccolto resta, ed e' proprio quello che il file perdeva. I target
 * di piu' impianti si sommano; il raccolto di due grafie dello stesso nome si
 * somma (prima la seconda prendeva il posto della prima). Un target annuo senza
 * regione va alla riga con lo stesso nome, e se sono piu' d'una a quella con piu'
 * raccolto.
 *
 * @returns [{ raccoglitore, regione, targetAnnuo, raccoltoTotale, leftover, mesi: [{ mese, target, raccolto, delta }], nomi }]
 *   leftover e' il residuo dell'anno, target annuo meno raccolto (negativo:
 *   target superato); il delta del mese e' target meno raccolto. I nomi dei campi
 *   restano quelli che leggono il PDF e la presentazione (statusExports.js).
 */
export function righeAndamento({ mensili = [], annui = [], raccolto = [], filtri = {} }) {
  const testo = (v) => String(v || '').trim();
  const righe = new Map();
  const riga = (nome, regione) => {
    const k = `${normalizzaRagioneSociale(nome || '')}|||${testo(regione)}`;
    if (!righe.has(k)) righe.set(k, { raccoglitore: testo(nome), regione: testo(regione), target: {}, raccolto: {}, raccoltoTotale: 0, annuo: 0, nomi: new Set() });
    const r = righe.get(k);
    if (testo(nome)) r.nomi.add(testo(nome));
    return r;
  };

  // 1. le righe dei target: prima ci sono loro, poi il raccolto le cerca
  for (const t of mensili) {
    const r = riga(t.raccoglitore, t.regione);
    r.target[t.mese] = (r.target[t.mese] || 0) + (t.non_raccoglie ? 0 : Number(t.target) || 0);
  }
  const senzaRegione = [];
  for (const a of annui) {
    if (!testo(a.regione)) { senzaRegione.push(a); continue; }
    riga(a.raccoglitore, a.regione).annuo += Number(a.target_tonnellate) || 0;
  }
  const conTarget = [...righe.values()];

  // 2. il raccolto: al target della stessa regione, col nome uguale o abbreviato
  for (const x of raccolto) {
    const candidati = conTarget.filter(r => r.regione === testo(x.regione));
    const nome = targetDelPortale(candidati.map(r => r.raccoglitore), x.raccoglitore);
    const r = nome !== null ? candidati.find(c => c.raccoglitore === nome) : riga(x.raccoglitore, x.regione);
    if (testo(x.raccoglitore)) r.nomi.add(testo(x.raccoglitore));
    r.raccoltoTotale += Number(x.totale) || 0;
    for (const m of MESI_MOVIMENTI) r.raccolto[m] = (r.raccolto[m] || 0) + (Number(x.mesi && x.mesi[m]) || 0);
  }

  // 3. i target annui senza regione
  for (const a of senzaRegione) {
    const tutte = [...righe.values()];
    let candidati = tutte.filter(r => normalizzaRagioneSociale(r.raccoglitore) === normalizzaRagioneSociale(a.raccoglitore || ''));
    if (!candidati.length) candidati = tutte.filter(r => stessoRaccoglitore(a.raccoglitore, r.raccoglitore));
    const dest = candidati.sort((x, y) => y.raccoltoTotale - x.raccoltoTotale)[0] || riga(a.raccoglitore, '');
    dest.annuo += Number(a.target_tonnellate) || 0;
  }

  const fRegione = filtri.regione || [];
  const fRaccoglitore = filtri.raccoglitore || [];
  return [...righe.values()].map(r => {
    const mesi = MESI_MOVIMENTI.map(m => {
      const target = r.target[m] || 0;
      const racc = r.raccolto[m] || 0;
      return { mese: m, target, raccolto: racc, delta: target - racc };
    });
    return { raccoglitore: r.raccoglitore, regione: r.regione, targetAnnuo: r.annuo, raccoltoTotale: r.raccoltoTotale, leftover: r.annuo - r.raccoltoTotale, mesi, nomi: [...r.nomi] };
  }).filter(row => {
    if (fRegione.length > 0 && !fRegione.includes(row.regione)) return false;
    if (fRaccoglitore.length > 0 && !row.nomi.some(n => fRaccoglitore.includes(n))) return false;
    return row.targetAnnuo || row.raccoltoTotale || row.mesi.some(m => m.target);
  }).sort((a, b) => a.regione.localeCompare(b.regione) || a.raccoglitore.localeCompare(b.raccoglitore));
}
