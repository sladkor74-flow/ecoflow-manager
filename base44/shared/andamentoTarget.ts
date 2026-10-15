// L'ANDAMENTO DI TARGET & STATUS: TARGET E RACCOLTO RETE PER RACCOGLITORE E
// REGIONE (chiusura dell'audit, 11/10/2026).
//
// Le righe le costruisce questa funzione sola, per la pagina, il suo PDF e il
// file Excel (exportStatusExcel). Prima la pagina aveva il suo conto e l'Excel un
// altro: il file scorreva solo il raccolto e cercava il target per nome esatto,
// quindi perdeva i target senza raccolto nell'anno (il 2 gennaio quasi tutti) e
// quelli scritti abbreviati. Con 1.800 t di target il file ne mostrava 1.000.
//
// IL NOME DEL TARGET E QUELLO DEL PORTALE. Il target puo' essere scritto
// abbreviato («PNEUSERVICE SRL» per «PNEUSERVICE CONVERSANO SRL»): il raccolto va
// prima al target con lo stesso nome normalizzato, poi a quello il cui nome e'
// un'abbreviazione del nome del portale, mai il contrario. E' l'abbinatore di
// targetRaccoglitori.ts (targetDelPortale), lo stesso degli alert e di EcoTyna:
// qui ce n'e' una copia identica solo perche' le pagine non possono importare da
// base44/shared, e prove/andamentoTarget.mjs controlla che le due copie restino
// uguali lettera per lettera. Prima l'Andamento faceva di quel raccoglitore due
// righe, 600 t di target con raccolto zero e 200 t di raccolto con target zero,
// mentre il Report generale ne faceva una.
//
// Lo specchio per il browser e' src/lib/andamentoTarget.js (prove/specchi.mjs).
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { MESI_MOVIMENTI } from "./movimenti.ts";
import { daConfermare } from "./annoTarget.ts";

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
 * I TARGET COPIATI E NON CONFERMATI (prova generale del cambio d'anno,
 * 15/10/2026). Un target copiato dall'anno prima e non ancora confermato
 * (daConfermare di annoTarget.ts) non e' ancora un target deciso: la dashboard
 * lo toglie dalla classifica e lo conta, checkTargetAlerts non apre avvisi su di
 * lui. L'Andamento di Target & Status invece, il 15/01/2027 col contratto 2027
 * confermato e i 147 target mensili e 14 annui dei raccoglitori ancora copiati,
 * li mostrava con target, residuo e Δ come se fossero decisi. Ora ogni riga
 * dice quali dei suoi target sono copiati: annuoDaConfermare (almeno uno dei
 * target annui), in ogni mese daConfermare (almeno una riga del mese),
 * targetCopiati e targetScritti (quante righe di target ha la riga e quante
 * sono copiate). I numeri restano quelli scritti: chi mostra la riga dice
 * «copiato, da confermare».
 *
 * @returns [{ raccoglitore, regione, targetAnnuo, raccoltoTotale, leftover, mesi: [{ mese, target, raccolto, delta, daConfermare }], nomi, annuoDaConfermare, targetCopiati, targetScritti }]
 *   leftover e' il residuo dell'anno, target annuo meno raccolto (negativo:
 *   target superato); il delta del mese e' target meno raccolto. I nomi dei campi
 *   restano quelli che leggono il PDF e la presentazione (statusExports.js).
 */
export function righeAndamento({ mensili = [], annui = [], raccolto = [], filtri = {} }) {
  const testo = (v) => String(v || '').trim();
  const righe = new Map();
  const riga = (nome, regione) => {
    const k = `${normalizzaRagioneSociale(nome || '')}|||${testo(regione)}`;
    if (!righe.has(k)) righe.set(k, { raccoglitore: testo(nome), regione: testo(regione), target: {}, raccolto: {}, raccoltoTotale: 0, annuo: 0, nomi: new Set(), mesiCopiati: new Set(), annuoCopiato: false, copiati: 0, scritti: 0 });
    const r = righe.get(k);
    if (testo(nome)) r.nomi.add(testo(nome));
    return r;
  };

  // 1. le righe dei target: prima ci sono loro, poi il raccolto le cerca. Del
  // target scritto due volte conta l'ultimo modificato, come negli avvisi
  // (revisione del 13/10/2026)
  // (e quali sono copiati dall'anno prima e non confermati, 15/10/2026)
  const conta = (r, x) => { r.scritti++; if (daConfermare(x)) { r.copiati++; return true; } return false; };
  for (const t of targetMensiliValidi(mensili)) {
    const r = riga(t.raccoglitore, t.regione);
    r.target[t.mese] = (r.target[t.mese] || 0) + (t.non_raccoglie ? 0 : Number(t.target) || 0);
    if (conta(r, t)) r.mesiCopiati.add(t.mese);
  }
  const senzaRegione = [];
  for (const a of annui) {
    if (!testo(a.regione)) { senzaRegione.push(a); continue; }
    const r = riga(a.raccoglitore, a.regione);
    r.annuo += Number(a.target_tonnellate) || 0;
    if (conta(r, a)) r.annuoCopiato = true;
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
    if (conta(dest, a)) dest.annuoCopiato = true;
  }

  const fRegione = filtri.regione || [];
  const fRaccoglitore = filtri.raccoglitore || [];
  return [...righe.values()].map(r => {
    const mesi = MESI_MOVIMENTI.map(m => {
      const target = r.target[m] || 0;
      const racc = r.raccolto[m] || 0;
      return { mese: m, target, raccolto: racc, delta: target - racc, daConfermare: r.mesiCopiati.has(m) };
    });
    return {
      raccoglitore: r.raccoglitore, regione: r.regione, targetAnnuo: r.annuo, raccoltoTotale: r.raccoltoTotale, leftover: r.annuo - r.raccoltoTotale, mesi, nomi: [...r.nomi],
      annuoDaConfermare: r.annuoCopiato, targetCopiati: r.copiati, targetScritti: r.scritti,
    };
  }).filter(row => {
    if (fRegione.length > 0 && !fRegione.includes(row.regione)) return false;
    if (fRaccoglitore.length > 0 && !row.nomi.some(n => fRaccoglitore.includes(n))) return false;
    return row.targetAnnuo || row.raccoltoTotale || row.mesi.some(m => m.target);
  }).sort((a, b) => a.regione.localeCompare(b.regione) || a.raccoglitore.localeCompare(b.raccoglitore));
}

/**
 * Quanti target dell'anno sono copiati dall'anno prima e non ancora confermati
 * (15/10/2026): { copiati, scritti }, contati sui record come li conta la scheda
 * Target raccoglitori - i mensili validi (del mensile scritto due volte vale
 * l'ultimo, targetMensiliValidi) e gli annui - anche quelli con target zero, che
 * nelle righe dell'Andamento non hanno una riga. Per la frase sopra le tabelle
 * «N target su M copiati dal 2026, da confermare in Target raccoglitori»: la
 * stessa nella tabella per raccoglitore e nel Report generale.
 */
export function targetCopiatiDellAnno({ mensili = [], annui = [] } = {}) {
  const tutti = [...targetMensiliValidi(mensili || []), ...(annui || [])];
  return { copiati: tutti.filter(daConfermare).length, scritti: tutti.length };
}

/**
 * Quanti target delle righe dell'Andamento sono copiati dall'anno prima e non
 * ancora confermati (15/10/2026): { copiati, scritti, righe }, righe e' quante
 * righe ne hanno almeno uno. Per la frase sopra le tabelle: «N target su M
 * copiati dall'anno prima, da confermare in Target raccoglitori».
 */
export function targetCopiatiDelleRighe(righe) {
  const elenco = righe || [];
  return {
    copiati: elenco.reduce((s, r) => s + (Number(r.targetCopiati) || 0), 0),
    scritti: elenco.reduce((s, r) => s + (Number(r.targetScritti) || 0), 0),
    righe: elenco.filter(r => Number(r.targetCopiati) > 0).length,
  };
}

/**
 * La frase sopra le tabelle dell'Andamento (revisione del 15/10/2026, prima in
 * TargetTable.jsx): «147 target su 161 copiati dal 2026, da confermare in
 * Target raccoglitori: si vedono, ma non sono ancora decisi.»; '' se non ce ne
 * sono. Qui perche' la dicono uguale la tabella per raccoglitore, il Report
 * generale e i file dell'Andamento (PDF e presentazione).
 */
export function fraseTargetCopiati({ copiati, scritti } = {}, anno) {
  if (!copiati) return '';
  const da = anno ? `dal ${Number(anno) - 1}` : "dall'anno prima";
  return `${copiati} target su ${scritti} ${copiati === 1 ? 'copiato' : 'copiati'} ${da}, da confermare in Target raccoglitori: si vedono, ma non sono ancora decisi.`;
}

/**
 * Il segno di una riga dell'Andamento coi target copiati (revisione del
 * 15/10/2026): «copiato, da confermare» se lo sono tutti i suoi target, «N
 * target copiati, da confermare» (o «1 target copiato, ...») se lo sono solo
 * alcuni, '' se nessuno. Lo stesso nella tabella per raccoglitore e nei file
 * dell'Andamento.
 */
export function segnoTargetCopiati(riga) {
  const copiati = Number(riga && riga.targetCopiati) || 0;
  if (!copiati) return '';
  if (copiati === Number(riga.targetScritti)) return 'copiato, da confermare';
  return `${copiati} target ${copiati === 1 ? 'copiato' : 'copiati'}, da confermare`;
}
