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
//
// UN CONTROLLO SALTATO SI DICE (segnalazione alta A66 del 20/09, corretta il
// 12/10/2026). Fino ad allora la classe si leggeva solo nelle forme brevi
// («Categoria 4 classe E», «4-F»): «Categoria 4: raccolta e trasporto di rifiuti
// speciali non pericolosi - classe E» e «categoria 4 e 5 classe F» davano null,
// e con la classe non letta il documento tornava indietro com'era. Un target di
// 3.200 t su un'iscrizione in classe F, che arriva a meno di 3.000 t, passava
// senza una parola. Ora la lettura conosce anche le forme del provvedimento vero
// (la classe scritta come quantita' annua, «4 - F» a margine) e, quando per un
// raccoglitore con target la classe non si legge da nessun documento, il
// documento dell'Albo porta l'avviso «controllo classe/target non eseguito».

import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { famigliaDocumento, leggiProblemi, letturaDi } from "./qualificaFornitori.ts";
import { formatoTonnellate } from "./formato.ts";
import { targetMensiliValidi } from "./targetRaccoglitori.ts";

// Limite superiore escluso, in tonnellate annue; la classe A non ha limite.
export const LIMITI_CLASSE = { A: null, B: 200000, C: 60000, D: 15000, E: 6000, F: 3000 };

// Oltre questa quota del limite si segnala comunque, perche' la classe conta
// anche i rifiuti gestiti fuori dalla commessa.
export const QUOTA_ATTENZIONE = 0.85;

const numero = (v) => formatoTonnellate(v);

// Le forme che si leggono, prese dai provvedimenti e dalle visure dei fornitori
// della commessa (archivio CONTRATTI SUBFORNITORI, 2026):
//   «categoria 4 classe C», «cat. 4 classe E fino al 16/03/2029»,
//   «categoria 4 in classe D», «Categoria 4: raccolta e trasporto ... - classe E»,
//   «categoria 4 e 5 classe F» (la classe vale per tutte e due);
//   «da Classe: F (quantita' ...) a Classe: E (quantita' ...)», la variazione
//    (vale la classe nuova);
//   «4 - F» (a margine del provvedimento), «4F», «Cat. 4_E», «4B e 5C», «4-A e 5-B»;
//   «Categoria: Raccolta e trasporto di rifiuti speciali non pericolosi
//    Classe: quantita' annua complessivamente trattata inferiore a 3.000 t.»,
//   cioe' la categoria 4 scritta per esteso e la classe come quantita'.
//
// Fra il «4» e la parola «classe» puo' stare la descrizione della categoria, ma
// non una cifra ne' un'altra «categoria» ne' un'altra «classe»: cosi' in
// «categoria 4, categoria 5 classe C» la C resta della 5. L'unico numero
// ammesso e' il codice EER («Categoria 4 (EER 16 01 03) classe E»).
const ALTRE_CATEGORIE = String.raw`(?:\s*(?:,|\be\b|\bed\b|\/|-|–)\s*\d{1,2}(?:\s*-?\s*bis)?(?!\d))*`;
const DESCRIZIONE = String.raw`(?:(?!class[ei]\b|categori)(?:\d{2}[ .]\d{2}[ .]\d{2}\*?|[^\d])){0,160}?`;
const PAROLA_CLASSE = String.raw`class[ei]\b\s*[:.\-–]?\s*`;
const CON_NUMERO = new RegExp(String.raw`(?:^|[^\d])4(?!\d)` + ALTRE_CATEGORIE + DESCRIZIONE + PAROLA_CLASSE, 'gi');
// La categoria 4 e' per definizione la raccolta e il trasporto dei rifiuti
// speciali non pericolosi (DM 120/2014 art. 8): il provvedimento la scrive
// cosi', senza il numero accanto.
const PER_ESTESO = new RegExp(String.raw`raccolta\s+e\s+trasporto\s+(?:di\s+|dei\s+)?rifiuti\s+speciali\s+non\s+pericolosi` + DESCRIZIONE + PAROLA_CLASSE, 'gi');
// Solo lettera maiuscola, per non leggere «4 e 5» come classe E. Il punto prima
// del 4 si accetta solo dopo «cat» («CAT.4F»), non dopo una cifra.
const BREVE = /(?:^|[^\d.]|(?<=[Cc][Aa][Tt])\.)4(\s*[-–_]?\s*)([A-F])(?![A-Za-z])/g;

/**
 * La classe scritta come quantita' annua, nelle parole del provvedimento:
 * «inferiore a 3.000 t.» e' la F, «superiore o uguale a 3.000 t. e inferiore a
 * 6.000 t.» la E, «superiore o uguale a 200.000 t.» la A. Il limite superiore
 * dice la classe, perche' i limiti sono quelli di LIMITI_CLASSE.
 */
export function classeDaQuantita(testo) {
  const t = String(testo || '');
  const inferiore = /inferiore\s+a\s+(\d{1,3}(?:[.\s]\d{3})+|\d+)\s*(?:t\b|t\.|tonn)/i.exec(t);
  if (inferiore) {
    const limite = Number(inferiore[1].replace(/[.\s]/g, ''));
    return Object.keys(LIMITI_CLASSE).find(k => LIMITI_CLASSE[k] === limite) || null;
  }
  if (/(?:superiore|pari)\s+o\s+(?:uguale|superiore)\s+a\s+200[.\s]?000\s*(?:t\b|t\.|tonn)/i.test(t)) return 'A';
  return null;
}

// Cio' che segue la parola «classe»: la lettera, oppure la quantita'. In una
// variazione («dalla classe F alla classe E») vale la classe nuova.
//
// LA VARIAZIONE VERA HA LE QUANTITA' (revisione del 13/10/2026). Il
// provvedimento di variazione di Green Tyre (prot. 19235/2026 del 18/02/2026)
// scrive «da Classe: F (quantità annua complessivamente trattata inferiore a
// 3.000 t.) a Classe: E (quantità ...)». La classe nuova si cercava solo subito
// dopo la lettera e la parentesi della quantita' la nascondeva: si leggeva la
// F, la vecchia, e con un target di 3.200 t proprio il provvedimento della
// variazione diventava «non conforme» perche' chiedeva la variazione. Fra la
// lettera e «a classe» ora puo' stare la quantita' fra parentesi.
const VARIAZIONE = /^[a-f](?![a-zà-ÿ])(?:\s*\([^()]{0,300}\))?[\s,]*(?:alla|in|a)\s+class[ei]\b\s*[:.\-–]?\s*([a-f])(?![a-zà-ÿ])/i;
function classeDopo(resto) {
  const lettera = /^([a-f])(?![a-zà-ÿ])/i.exec(resto);
  if (lettera) {
    const nuova = VARIAZIONE.exec(resto);
    return (nuova ? nuova[1] : lettera[1]).toUpperCase();
  }
  // la quantita' si cerca fino alla prossima categoria, non oltre
  const fine = resto.search(/;|\bcategori|\bcat\.|\n\s*\n/i);
  return classeDaQuantita(fine >= 0 ? resto.slice(0, fine) : resto.slice(0, 200));
}

/**
 * Tutto cio' che si legge della categoria 4: { classe, lette }. "lette" sono le
 * classi trovate, senza doppioni; se sono piu' d'una e diverse la classe non si
 * sa con certezza e "classe" resta null: meglio un controllo dichiarato non
 * eseguito che un confronto fatto sulla classe sbagliata.
 */
export function letturaClasseCategoria4(categorie) {
  const testo = (Array.isArray(categorie) ? categorie : [categorie]).filter(Boolean).map(String).join(' ');
  const lette = new Set();
  if (!testo.trim()) return { classe: null, lette: [] };
  for (const re of [CON_NUMERO, PER_ESTESO]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(testo))) {
      const c = classeDopo(testo.slice(re.lastIndex));
      if (c) lette.add(c);
    }
  }
  BREVE.lastIndex = 0;
  let b;
  while ((b = BREVE.exec(testo))) {
    // «CATEGORIE 4 E 5» scritto tutto maiuscolo: la E e' la congiunzione. Lo e'
    // anche in «CATEGORIA 4 E CATEGORIA 5 CLASSE F», che si leggeva classe E:
    // dopo la E viene un'altra categoria (revisione del 13/10/2026).
    const congiunzione = b[2] === 'E' && /^\s+$/.test(b[1]) && /^\s*(?:\d|cat)/i.test(testo.slice(BREVE.lastIndex));
    if (!congiunzione) lette.add(b[2]);
  }
  const elenco = [...lette].sort();
  return { classe: elenco.length === 1 ? elenco[0] : null, lette: elenco };
}

/** Classe della categoria 4 letta dai dati estratti dal documento, o null. */
export function classeCategoria4(categorie) {
  return letturaClasseCategoria4(categorie).classe;
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

/**
 * L'avviso per un raccoglitore con target la cui classe non si legge da nessun
 * documento. Dice perche' (mai letto, classe non scritta nella lettura, classi
 * in contrasto) e cosa fare, col target da confrontare.
 */
export function problemaClasseNonLetta(lettura, letta, targetT, anno) {
  const categorie = lettura && lettura.categorie_albo;
  const scritte = (Array.isArray(categorie) ? categorie : [categorie]).filter(Boolean).map(String).join('; ');
  let perche;
  if (!lettura) perche = "il documento non è ancora stato letto dall'agente, quindi la classe dell'iscrizione non si conosce";
  else if (letta && letta.lette.length > 1) perche = `dalla lettura risultano classi diverse per la categoria 4 (${letta.lette.join(' e ')})`;
  else if (scritte) perche = `dalla lettura non si ricava la classe della categoria 4 (letto: «${scritte.length > 160 ? scritte.slice(0, 157) + '...' : scritte}»)`;
  else perche = "dalla lettura non risultano né la categoria né la classe dell'iscrizione";
  return {
    gravita: 'attenzione',
    messaggio: `Controllo classe/target non eseguito: ${perche}. Il target PFU assegnato nel ${anno} è ${numero(targetT)} t: verifica sul provvedimento che la classe della categoria 4 lo copra (la F arriva a meno di ${numero(LIMITI_CLASSE.F)} t l'anno, la E a meno di ${numero(LIMITI_CLASSE.E)} t), oppure rianalizza il documento.`,
  };
}

// Il documento dell'iscrizione all'Albo gestori, riconosciuto dal nome della
// casella o, se quello non lo dice, dal tipo letto nel file. Le famiglie sono
// quelle del controllo sulla casella sbagliata (base44/shared/tipiDocumento.ts),
// ma l'Albo gestori si riconosce solo dalle parole dei gestori ambientali
// (famigliaDocumento, revisione del 13/10/2026): «Iscrizione all'Albo
// autotrasportatori conto terzi (REN)» non ha categorie ne' classi, e l'avviso
// della classe non letta su di lui era doppio e chiedeva una rilettura inutile.
function eIscrizioneAlbo(doc, lettura) {
  const casella = famigliaDocumento(doc.tipo_documento_nome || '');
  if (casella) return casella.chiave === 'albo_gestori';
  const letto = famigliaDocumento((lettura && lettura.tipo_documento) || '');
  return !!letto && letto.chiave === 'albo_gestori';
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

/**
 * Target PFU dell'anno per un soggetto: il maggiore fra annuo e somma dei mesi.
 *
 * IL TARGET MENSILE SCRITTO DUE VOLTE VALE UNA (revisione del 13/10/2026). Due
 * righe con lo stesso raccoglitore, regione, impianto, ruolo e mese sono lo
 * stesso target: Target & Status ne mostra una, l'ultima modificata, e cosi'
 * l'Andamento, gli avvisi ed EcoTyna (targetMensiliValidi). Qui si sommavano: un
 * mese scritto 80 t e corretto in 50 t contava 130 t, e la classe dell'Albo si
 * confrontava con un target piu' alto del vero (un bloccante o un'attenzione su
 * un'iscrizione che il target vero non supera).
 */
export function targetAnnuoSoggetto(chiave, annui, mensili) {
  const annuo = delSoggetto(annui, chiave).reduce((s, r) => s + (Number(r.target_tonnellate) || 0), 0);
  const mesi = delSoggetto(targetMensiliValidi(mensili || []), chiave).filter(r => !r.non_raccoglie).reduce((s, r) => s + (Number(r.target) || 0), 0);
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
  const target = (chiave) => {
    if (!targetPer.has(chiave)) targetPer.set(chiave, targetAnnuoSoggetto(chiave, annui, mensili));
    return targetPer.get(chiave);
  };
  const letture = documenti.map(doc => {
    if (!raccoglitori.has(doc.soggetto_chiave)) return null;
    const lettura = letturaDi(doc);
    return { lettura, letta: letturaClasseCategoria4(lettura && lettura.categorie_albo) };
  });
  // Il controllo e' eseguito se almeno un documento del raccoglitore dice la
  // classe: allora il confronto c'e', su quel documento.
  const conClasse = new Set(documenti.filter((doc, i) => letture[i] && letture[i].letta.classe).map(doc => doc.soggetto_chiave));
  return documenti.map((doc, i) => {
    const l = letture[i];
    if (!l) return doc;
    if (l.letta.classe) {
      const problema = problemaClasse(l.letta.classe, target(doc.soggetto_chiave), anno);
      return problema ? { ...doc, problemi_json: JSON.stringify([...leggiProblemi(doc), problema]) } : doc;
    }
    if (conClasse.has(doc.soggetto_chiave) || !eIscrizioneAlbo(doc, l.lettura)) return doc;
    const t = target(doc.soggetto_chiave);
    if (!(t > 0)) return doc;
    return { ...doc, problemi_json: JSON.stringify([...leggiProblemi(doc), problemaClasseNonLetta(l.lettura, l.letta, t, anno)]) };
  });
}
