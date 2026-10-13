// L'Andamento di Target & Status: target e raccolto RETE per raccoglitore e
// regione, con l'abbinamento fra il nome del target e quello del portale
// (chiusura dell'audit, 11/10/2026).
//
// Specchio di base44/shared/andamentoTarget.ts per il browser: deve restare
// identico (prove/specchi.mjs). Le ragioni stanno nell'originale.
//
// I mesi vengono da pfuConstants.js e non da movimenti.js (revisione del
// 13/10/2026): dal 13/10 questo file lo importa anche reportGeneraleVista.js,
// per la regola del target mensile scritto due volte, e le prove caricano quella
// vista direttamente in node, dove l'alias @/ di movimenti.js non si risolve. I
// dodici nomi sono gli stessi, nello stesso ordine.
import { normalizzaRagioneSociale } from './normalizzaRagioneSocialeClient.js';
import { MESI as MESI_MOVIMENTI } from './pfuConstants.js';

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
 * I TARGET MENSILI CHE VALGONO: FRA I DOPPIONI VERI, L'ULTIMO MODIFICATO
 * (segnalazione alta del 20/09; una regola sola dalla revisione del 13/10/2026).
 *
 * Due righe di TargetMensile con lo stesso raccoglitore (nome normalizzato),
 * regione, impianto (normalizzato), ruolo, mese e anno sono lo stesso target
 * scritto due volte. La griglia di Target & Status ne mostra una e scrive «vale
 * l'ultimo modificato»: qui si sceglie la stessa, per updated_date e, a pari
 * data, quella che viene dopo nell'archivio (ordinamento stabile, come la
 * griglia). Il 12/10 la regola era entrata solo negli avvisi: l'Andamento, il suo
 * Excel, la dashboard e il Report generale sommavano ancora, e con 80 t e poi 50
 * t gli avvisi dicevano 50 e la pagina 130. Ora passano tutti da qui. Righe di
 * impianti o ruoli diversi restano target diversi e si sommano, come prima.
 *
 * Restituisce le righe scelte nell'ordine dell'archivio.
 */
export function targetMensiliValidi(records) {
  const testo = (v) => String(v || '').trim();
  const identita = (r) => `${normalizzaRagioneSociale(r.raccoglitore || '')}|${testo(r.regione)}|${normalizzaRagioneSociale(r.impianto || '')}|${testo(r.ruolo)}|${r.mese}|${r.anno}`;
  const elenco = records || [];
  const scelto = new Map();
  for (const r of [...elenco].sort((x, y) => String(x.updated_date || '').localeCompare(String(y.updated_date || '')))) scelto.set(identita(r), r);
  return elenco.filter(r => scelto.get(identita(r)) === r);
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
 * di piu' impianti si sommano, il doppione vero vale una volta sola
 * (targetMensiliValidi); il raccolto di due grafie dello stesso nome si
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

  // 1. le righe dei target: prima ci sono loro, poi il raccolto le cerca. Del
  // target scritto due volte conta l'ultimo modificato, come negli avvisi
  // (revisione del 13/10/2026)
  for (const t of targetMensiliValidi(mensili)) {
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
