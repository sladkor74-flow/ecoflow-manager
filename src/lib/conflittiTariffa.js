// Specchio per le pagine di base44/shared/conflittiTariffa.ts: le pagine non
// possono importare da base44/shared. Deve restare IDENTICO all'originale, a
// meno di questa intestazione e degli import, e lo controlla prove/specchi.mjs.
// E' nato l'11/10/2026 (chiusura dell'audit): l'elenco delle tariffe segnava
// «Duplicata» solo le tariffe con lo stesso fornitore_id, e due prezzi di Gatim
// per lo stesso periodo - uno su «GATIM», uno su «GATIM S.R.L.» - passavano
// muti, mentre la passiva li vedeva come lo stesso fornitore. Chi cambia la
// regola la cambia nell'originale e la ricopia qui.
// Import relativi con l'estensione: cosi' lo leggono anche le prove in node.

import { normalizzaRagioneSociale } from './normalizzaRagioneSocialeClient.js';
import { tariffaNonDisattivata } from './validitaTariffa.js';

function norm(v) {
  return String(v || '').trim().toUpperCase();
}
const ragione = (v) => normalizzaRagioneSociale(String(v || ''));

/** Due tipologie sono in conflitto se uguali, o una e' TUTTE e l'altra RETE/ACI. */
export function tipologiaMatch(t1, t2) {
  const a = norm(t1);
  const b = norm(t2);
  if (a === b) return true;
  if (a === 'TUTTE' && (b === 'RETE' || b === 'ACI')) return true;
  if (b === 'TUTTE' && (a === 'RETE' || a === 'ACI')) return true;
  return false;
}

/** Lo stesso fornitore: stesso id, oppure stesso nome normalizzato. */
export function stessoFornitore(t1, t2) {
  const id1 = norm(t1 && t1.fornitore_id), id2 = norm(t2 && t2.fornitore_id);
  if (id1 && id1 === id2) return true;
  const n1 = ragione(t1 && t1.fornitore_nome), n2 = ragione(t2 && t2.fornitore_nome);
  return !!n1 && n1 === n2;
}

/** Due tariffe passive hanno la stessa chiave: fornitore, prestazione, ambito e tipologia (con TUTTE). */
export function chiaveMatch(t1, t2) {
  if (!stessoFornitore(t1, t2)) return false;
  // la direzione vuota e' PASSIVA, come nello schema: una tariffa salvata prima
  // che il campo esistesse e' una passiva come le altre
  if (norm(t1.direzione || 'PASSIVA') !== norm(t2.direzione || 'PASSIVA')) return false;
  for (const c of ['prestazione', 'classe_materiale', 'provincia', 'regione']) {
    if (norm(t1[c]) !== norm(t2[c])) return false;
  }
  for (const c of ['destinazione', 'produttore', 'destinatario']) {
    if (ragione(t1[c]) !== ragione(t2[c])) return false;
  }
  return tipologiaMatch(t1.tipologia, t2.tipologia);
}

/** Chiave delle tariffe attive: cliente, tipologia, classe, regione, EER, servizio. */
export function chiaveMatchAttiva(t1, t2) {
  const campi = ['cliente', 'tipologia', 'classe_materiale', 'regione', 'eer_codice', 'servizio_ecotyre'];
  for (const c of campi) {
    if (norm(t1[c]) !== norm(t2[c])) return false;
  }
  return true;
}

/** Due periodi si sovrappongono (fine assente = periodo aperto = infinito). */
export function periodiSovrapposti(inizio1, fine1, inizio2, fine2) {
  const i1 = inizio1 ? new Date(inizio1).getTime() : 0;
  const f1 = fine1 ? new Date(fine1).getTime() : Infinity;
  const i2 = inizio2 ? new Date(inizio2).getTime() : 0;
  const f2 = fine2 ? new Date(fine2).getTime() : Infinity;
  return i1 <= f2 && i2 <= f1;
}

/**
 * Le tariffe esistenti con cui una tariffa nuova (o modificata) si scontra:
 * { conflitti, chiudibili }. Chiudibile e' una tariffa aperta (senza data di
 * fine) della stessa chiave che comincia prima della nuova: e' la rinegoziazione,
 * e chi salva a mano la chiude il giorno prima. Tutte le altre sovrapposizioni
 * sono conflitti. Le tariffe 'non_attivo' non contano: non valgono mai.
 * @param idEscluso l'id della tariffa che si sta modificando, da non confrontare con se stessa
 */
export function conflittiTariffa(nuova, esistenti, idEscluso = null) {
  const isAttiva = norm(nuova && nuova.direzione) === 'ATTIVA';
  const inizio = nuova && nuova.data_inizio_validita;
  const fine = nuova && nuova.data_fine_validita;
  const conflitti = [];
  const chiudibili = [];
  for (const t of esistenti || []) {
    if (!t || (idEscluso && t.id === idEscluso)) continue;
    if (!tariffaNonDisattivata(t)) continue;
    if (norm(t.direzione || 'PASSIVA') !== norm((nuova && nuova.direzione) || 'PASSIVA')) continue;
    const chiaveOk = isAttiva ? chiaveMatchAttiva(nuova, t) : chiaveMatch(nuova, t);
    if (!chiaveOk) continue;
    if (!periodiSovrapposti(inizio, fine, t.data_inizio_validita, t.data_fine_validita)) continue;
    if (!t.data_fine_validita && inizio && new Date(inizio) > new Date(t.data_inizio_validita || 0)) chiudibili.push(t);
    else conflitti.push(t);
  }
  return { conflitti, chiudibili };
}

/** Il periodo di una tariffa a parole, per i messaggi: gg/mm/aaaa → gg/mm/aaaa o «aperto». */
export function periodoTariffa(t) {
  const it = (v) => { const s = String(v || '').slice(0, 10); return s.length === 10 ? s.split('-').reverse().join('/') : ''; };
  return `${it(t && t.data_inizio_validita) || 'n.d.'} → ${it(t && t.data_fine_validita) || 'aperto'}`;
}
