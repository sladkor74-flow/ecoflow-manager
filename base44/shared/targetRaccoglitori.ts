// Target dei raccoglitori: fonte unica, scritta solo in Target & Status.
//
// - Annuo per raccoglitore, e per regione quando lavora in piu' regioni (SMOCO):
//   TargetRaccoglitore, in tonnellate, definito a inizio anno o alla
//   contrattualizzazione.
// - Mensile: TargetMensile, in tonnellate, per raccoglitore e regione, con
//   l'indicazione "non raccoglie" e lo storico delle modifiche. E' quello che si
//   decide a inizio mese e puo' cambiare nel corso del mese.
//
// Tutti i moduli leggono da qui: una modifica vale subito ovunque.

import { fetchAll } from "./fetchAll.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { targetMensiliValidi } from "./andamentoTarget.ts";

export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export async function targetMensiliAnno(base44, anno) {
  return fetchAll(base44.asServiceRole.entities.TargetMensile, { anno: Number(anno) });
}

// Record dello stesso raccoglitore: prima quelli con lo stesso nome normalizzato;
// solo se non ce ne sono, quelli scritti con un'abbreviazione del nome, cioe' le
// cui parole stanno tutte nel nome del portale ("Pneuservice" per "PNEUSERVICE
// CONVERSANO SRL"). Mai il contrario: "Logistica Srl" non prende i target di
// "Logistica & Pneumatici".
export function recordDelRaccoglitore(records, nome) {
  const chiave = normalizzaRagioneSociale(nome || '');
  const esatti = records.filter(r => normalizzaRagioneSociale(r.raccoglitore || '') === chiave);
  if (esatti.length || !chiave) return esatti;
  const paroleNome = new Set(chiave.split(' ').filter(Boolean));
  return records.filter(r => {
    const parole = normalizzaRagioneSociale(r.raccoglitore || '').split(' ').filter(p => p.length > 2);
    return parole.length > 0 && parole.every(p => paroleNome.has(p));
  });
}

// L'ABBINATORE FRA IL NOME DEL TARGET E QUELLO DEL PORTALE sta in
// andamentoTarget.ts, e da qui si riesporta (chiusura dell'audit, 11/10/2026).
// Prima ce n'erano due copie, qui e li', tenute uguali lettera per lettera da
// prove/andamentoTarget.mjs: ora il codice c'e' una volta sola, e alert,
// EcoTyna, predittivita' e contratti usano proprio quello dell'Andamento.
// - stessoRaccoglitore(nomeTarget, nomePortale): nome normalizzato uguale
//   ("SMOCO S.r.l." e "SMOCO SRL"), oppure nome del target abbreviato le cui
//   parole stanno tutte nel nome del portale. Mai il contrario.
// - targetDelPortale(candidati, nomePortale): il target con lo stesso nome
//   normalizzato; se non c'e', il primo il cui nome e' un'abbreviazione del
//   portale.
export { stessoRaccoglitore, targetDelPortale } from "./andamentoTarget.ts";
// Anche la regola del target mensile scritto due volte sta li' (vale l'ultimo
// modificato, revisione del 13/10/2026), e da qui si riesporta. La leggono
// dallo stesso posto aggregaTargetMensili (avvisi) e targetRaccoglitoreMese
// (evasione degli assegnati) qui sotto, il riepilogo dei dati di EcoTyna
// (situazioneGestionale, assistente.ts: la riga del raccoglitore somma il
// target del mese su queste righe, perche' da aggregaTargetMensili passa solo
// l'elenco dei nomi), la ripartizione dei target fra gli impianti
// (ripartisciTargetPrimarie, targetImpianti.ts) e il target dell'anno con cui
// si confronta la classe dell'Albo dei raccoglitori (targetAnnuoSoggetto,
// classeAlbo.ts). Andamento, Report generale e report settimanale la prendono
// da andamentoTarget.ts.
export { targetMensiliValidi };

/**
 * Target di un raccoglitore in un mese, sommando le regioni.
 * null se per quel mese non e' stato scritto nulla.
 * Del target scritto due volte (stessa regione, impianto, ruolo e mese) conta
 * l'ultimo modificato, come nell'Andamento (revisione del 13/10/2026).
 */
export function targetRaccoglitoreMese(records, nome, mese) {
  const righe = recordDelRaccoglitore(targetMensiliValidi(records.filter(r => r.mese === mese)), nome);
  if (!righe.length) return null;
  const t = righe.reduce((s, r) => s + (Number(r.target) || 0), 0);
  return {
    target_kg: Math.round(t * 1000),
    non_raccoglie: righe.every(r => !!r.non_raccoglie),
    regioni: righe.map(r => ({ regione: r.regione || '', impianto: r.impianto || '', target_t: Number(r.target) || 0, non_raccoglie: !!r.non_raccoglie })),
  };
}

/**
 * Target mensili sommati per raccoglitore, regione e mese: un raccoglitore puo'
 * avere piu' righe, una per impianto di destinazione. Chi non raccoglie conta zero.
 * Il nome restituito e' quello scritto nel target, uguale a quello del portale.
 *
 * IL DOPPIONE VERO VALE UNA VOLTA, L'ULTIMO MODIFICATO (segnalazione alta del
 * 20/09, corretta il 12/10/2026). Due righe con lo stesso raccoglitore, regione,
 * impianto, ruolo e mese sono lo stesso target scritto due volte: la griglia di
 * Target & Status ne mostra una e scrive «vale l'ultimo modificato», mentre qui
 * si sommavano, e alert, export ed EcoTyna vedevano 100 t dove la pagina ne
 * mostrava 50. Ora la regola e' una: l'ultimo modificato (updated_date; a pari
 * data, quello che viene dopo, come nella griglia). Righe di impianti o ruoli
 * diversi restano target diversi e si sommano: e' la regola confermata dalla
 * regressione del 20/09. Dalla revisione del 13/10/2026 la scelta la fa
 * targetMensiliValidi (andamentoTarget.ts), la stessa dell'Andamento, del suo
 * Excel, della dashboard e del Report generale: il 12/10 stava solo qui, e gli
 * avvisi dicevano 50 dove la pagina diceva ancora 130.
 */
export function aggregaTargetMensili(records) {
  const mappa = new Map();
  for (const r of targetMensiliValidi(records)) {
    const chiave = `${normalizzaRagioneSociale(r.raccoglitore || '')}|${String(r.regione || '').trim()}|${r.mese}|${r.anno}`;
    if (!mappa.has(chiave)) mappa.set(chiave, { raccoglitore: String(r.raccoglitore || '').trim(), regione: String(r.regione || '').trim(), mese: r.mese, anno: r.anno, target: 0 });
    if (!r.non_raccoglie) mappa.get(chiave).target += Number(r.target) || 0;
  }
  return [...mappa.values()];
}

/** Target annui sommati per raccoglitore e regione (piu' impianti diventano uno). */
export function aggregaTargetAnnui(records) {
  const mappa = new Map();
  for (const r of records) {
    const chiave = `${normalizzaRagioneSociale(r.raccoglitore || '')}|${String(r.regione || '').trim()}`;
    if (!mappa.has(chiave)) mappa.set(chiave, { raccoglitore: String(r.raccoglitore || '').trim(), regione: String(r.regione || '').trim(), target_tonnellate: 0 });
    mappa.get(chiave).target_tonnellate += Number(r.target_tonnellate) || 0;
  }
  return [...mappa.values()];
}
