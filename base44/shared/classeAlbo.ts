// Classe di iscrizione all'Albo contro il target PFU assegnato al raccoglitore.
//
// Per le categorie 4, 5 e 8 la classe fissa le tonnellate annue che l'impresa
// puo' gestire in totale, tutti i rifiuti e non solo i PFU (DM 120/2014 art. 9
// c. 3). Se il target PFU assegnato supera gia' da solo il limite della classe,
// l'iscrizione non basta: il documento dell'Albo diventa non conforme finche'
// non arriva la variazione di classe o qualcuno lo verifica a mano.
//
// Il controllo non modifica i documenti salvati: aggiunge il problema solo al
// calcolo della situazione, cosi' segue i target anche quando cambiano.

import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { leggiProblemi } from "./qualificaFornitori.ts";
import { formatoTonnellate } from "./formato.ts";

// Limite superiore escluso, in tonnellate annue; la classe A non ha limite.
export const LIMITI_CLASSE = { A: null, B: 200000, C: 60000, D: 15000, E: 6000, F: 3000 };

// Oltre questa quota del limite si segnala comunque, perche' la classe conta
// anche i rifiuti gestiti fuori dalla commessa.
export const QUOTA_ATTENZIONE = 0.85;

const numero = (v) => formatoTonnellate(v);

/** Classe della categoria 4 letta dai dati estratti dal documento, o null. */
export function classeCategoria4(categorie) {
  const testo = (Array.isArray(categorie) ? categorie : [categorie]).filter(Boolean).map(String).join(' ');
  if (!testo) return null;
  const conParola = /(?:^|[^\d])4(?![\d])[^\dA-Za-z]{0,6}classe\s*[:.\-–]?\s*([a-f])(?![a-z])/i.exec(testo);
  if (conParola) return conParola[1].toUpperCase();
  // "4 F", "4-F", "4F": solo lettera maiuscola, per non leggere "4 e 5" come classe E
  const breve = /(?:^|[^\d.])4\s*[-–]?\s*([A-F])(?![A-Za-z])/.exec(testo);
  return breve ? breve[1] : null;
}

/** Problema da segnalare per un target annuo in tonnellate, o null. */
export function problemaClasse(classe, targetT, anno) {
  const limite = LIMITI_CLASSE[classe];
  if (!limite || !(targetT > 0)) return null;
  if (targetT >= limite) {
    return { gravita: 'bloccante', messaggio: `Il target PFU assegnato nel ${anno}, ${numero(targetT)} t, supera il limite della classe ${classe} dell'iscrizione all'Albo (meno di ${numero(limite)} t l'anno di rifiuti gestiti in totale). Serve la variazione di classe; se e' gia' stata ottenuta carica il nuovo provvedimento.` };
  }
  if (targetT >= limite * QUOTA_ATTENZIONE) {
    return { gravita: 'attenzione', messaggio: `Il target PFU assegnato nel ${anno}, ${numero(targetT)} t, e' il ${Math.round(targetT / limite * 100)}% del limite della classe ${classe} (meno di ${numero(limite)} t l'anno). La classe conta tutti i rifiuti gestiti dall'impresa, non solo i PFU della commessa: verifica che resti sotto il limite.` };
  }
  return null;
}

// Stesso raccoglitore: nome uguale, oppure nome del target abbreviato le cui
// parole stanno tutte nel nome del soggetto.
function delSoggetto(records, chiave) {
  const esatti = records.filter(r => normalizzaRagioneSociale(r.raccoglitore || '') === chiave);
  if (esatti.length || !chiave) return esatti;
  const paroleNome = new Set(chiave.split(' '));
  return records.filter(r => {
    const parole = normalizzaRagioneSociale(r.raccoglitore || '').split(' ').filter(p => p.length > 2);
    return parole.length > 0 && parole.every(p => paroleNome.has(p));
  });
}

/** Target PFU dell'anno per un soggetto: il maggiore fra annuo e somma dei mesi. */
export function targetAnnuoSoggetto(chiave, annui, mensili) {
  const annuo = delSoggetto(annui, chiave).reduce((s, r) => s + (Number(r.target_tonnellate) || 0), 0);
  const mesi = delSoggetto(mensili, chiave).filter(r => !r.non_raccoglie).reduce((s, r) => s + (Number(r.target) || 0), 0);
  return Math.max(annuo, mesi);
}

/**
 * Restituisce i documenti con il problema di classe aggiunto dove serve.
 * soggetti: [{ chiave, ruoli }]; documenti: DocumentoQualifica attivi.
 */
export function applicaControlloClasse(documenti, soggetti, annui, mensili, anno) {
  const raccoglitori = new Map(soggetti.filter(s => (s.ruoli || []).includes('raccolta')).map(s => [s.chiave, s]));
  if (!raccoglitori.size) return documenti;
  const targetPer = new Map();
  return documenti.map(doc => {
    if (!raccoglitori.has(doc.soggetto_chiave) || !doc.analisi_json) return doc;
    let lettura = null;
    try { lettura = JSON.parse(doc.analisi_json).lettura; } catch (_e) { return doc; }
    const classe = classeCategoria4(lettura && lettura.categorie_albo);
    if (!classe) return doc;
    if (!targetPer.has(doc.soggetto_chiave)) targetPer.set(doc.soggetto_chiave, targetAnnuoSoggetto(doc.soggetto_chiave, annui, mensili));
    const problema = problemaClasse(classe, targetPer.get(doc.soggetto_chiave), anno);
    if (!problema) return doc;
    return { ...doc, problemi_json: JSON.stringify([...leggiProblemi(doc), problema]) };
  });
}
