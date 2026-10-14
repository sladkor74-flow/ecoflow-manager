// LA SITUAZIONE DEI CONTRATTI AI FORNITORI DI UN ANNO: chi va contrattualizzato,
// per quale prestazione e su quale canale (giro K3 delle segnalazioni del
// 20/09, corretto il 12/10/2026).
//
// Tre difetti di contrattiAnno, tutti veri sul codice dell'11/10/2026:
// - i contratti si facevano solo sulla rete (const canale = 'RETE'): i modelli
//   ACI non si usavano mai, e un raccoglitore che lavora su rete e ACI aveva un
//   contratto solo. Decisione dell'utente dell'11/10/2026: «si deve generare tutti
//   i contratti sia rete che aci come raccolta, trattamento e stoccaggio». Il
//   canale si ricava dai movimenti: raccolta ACI = raccoglitore nelle primarie
//   ACI, trattamento ACI = impianto che riceve ACI, stoccaggio ACI = piazzale che
//   stocca ACI. Due canali, due contratti, ognuno col suo modello e i suoi valori:
//   rete e ACI non si sommano mai;
// - l'anno prima si guardava solo se l'anno chiesto non aveva nessun soggetto:
//   bastavano un'inclusione manuale nel 2027 o i primi viaggi di gennaio perche'
//   l'elenco 2027 mostrasse solo quei soggetti, e i contratti gia' generati per
//   gli altri sparissero dalla tabella. Ora l'elenco e' l'unione dei soggetti
//   dell'anno, di quelli dell'anno prima finche' l'anno chiesto non e' finito, e
//   di chi ha gia' un contratto dell'anno;
// - riaprendo un contratto tornavano i valori dell'anno prima: la funzione non
//   mandava i valori del contratto dell'anno.
//
// Decisione dell'utente del 13/10/2026: chi nell'ACI raccoglie e stocca (oggi
// Nappi Sud, Ecorecuperi negli anni in cui lo fa) ha UN contratto ACI «raccolta e
// stoccaggio» coi due prezzi, come il contratto vero di Nappi Sud 2026 (quello
// di Ecorecuperi del 2024 ha un prezzo solo, «Trasporto+Stoccaggio»). Prima ne
// aspettavamo due, raccolta ACI e stoccaggio ACI, e il contratto di Nappi Sud
// contava doppio. Ora la raccolta ACI e' «raccolta e stoccaggio»
// (raccolta_e_stoccaggio), col modello ACI che ha anche il prezzo dello
// stoccaggio, e lo stoccaggio ACI e' «non dovuto: sta nel contratto di raccolta
// e stoccaggio», come il trattamento compreso nel prezzo unico di Green Tyre.
// Quando il contratto di raccolta ACI dell'anno c'e' gia', lo dice lui, non i
// movimenti (revisione del 14/10/2026): coi due prezzi lo stoccaggio sta dentro
// anche nei mesi senza viaggi, di sola raccolta lo stoccaggio resta da fare.
//
// Qui la regola, senza letture: la funzione legge gli archivi e la chiama. Cosi'
// si prova anche senza piattaforma (prove/contrattiCanali.mjs).

import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { canaleMovimento } from "./movimenti.ts";
import { annoRoma, giornoRoma } from "./giornoItaliano.ts";
import { tariffaNonDisattivata } from "./validitaTariffa.ts";
import { impiantiTargetDellAnno } from "./targetImpianti.ts";
import { annoDelRecord, daConfermare } from "./annoTarget.ts";
import { chiaveTariffa } from "./inizializzazioneAnno.ts";
import { targetDelPortale } from "./targetRaccoglitori.ts";
import { valoriDelContratto, doveVale, eModelloRaccoltaEStoccaggio, eContrattoRaccoltaEStoccaggio } from "./segnapostiContratto.ts";

export const TIPI_CONTRATTO = [
  { chiave: 'raccolta', ruolo: 'raccolta', prestazione: 'RACCOLTA' },
  { chiave: 'stoccaggio', ruolo: 'stoccaggio', prestazione: 'CONFERIMENTO_STOCCAGGIO' },
  { chiave: 'trattamento', ruolo: 'trattamento', prestazione: 'TRATTAMENTO' },
  { chiave: 'trasporto_secondaria', ruolo: 'trasporto_secondaria', prestazione: 'TRASPORTO_SECONDARIA' },
];

// I canali che hanno contratti annuali. L'extra raccolta no: sono campagne
// occasionali, con tariffe aperte e senza contratto dell'anno (regola
// dell'utente del 06/10/2026, memoria «Contratti annuali senza tacito rinnovo»).
export const CANALI_CONTRATTO = ['RETE', 'ACI'];

// Il trasporto delle secondarie ha un contratto solo per vettore, per tutti e due
// i canali: le tariffe del trasporto sono «TUTTE» (rete e ACI) e il format
// («Contratto Servizi Trasporto») non parla di canale. Si registra come RETE,
// com'era, perche' i contratti gia' generati lo sono; a video si legge «rete e ACI».
export const CANALE_DEL_TRASPORTO = 'RETE';

// Come contrattiAnno ha sempre letto l'anno di un movimento: un terminato, nel
// giorno italiano della fine del trasporto (regola 1: mai la chiusura).
const terminatoNelAnno = (r, anno) => String((r && r.stato) || '').toLowerCase().trim() === 'terminato' && annoRoma(r.trasporto_finito_il) === anno;
// dal: solo i movimenti finiti da quel giorno italiano in poi (aaaa-mm-gg), per
// l'ultimo trimestre dell'anno prima (revisione del 13/10/2026).
const finitoDal = (r, dal) => !dal || String(giornoRoma(r && r.trasporto_finito_il) || '') >= dal;

/**
 * I ruoli di ogni soggetto, canale per canale, dai movimenti di un anno. Le
 * stesse regole dei soggetti della qualifica (individuaSoggetti): chi trasporta
 * una primaria raccoglie, chi la riceve tratta o stocca secondo il tipo di
 * destinazione; nelle secondarie il piazzale stocca, il vettore trasporta e la
 * destinazione tratta. In piu' qui c'e' il canale.
 * dal (facoltativo, aaaa-mm-gg): solo i movimenti finiti da quel giorno in poi.
 * @returns Map chiave -> Map ruolo -> Set canali
 */
export function ruoliPerCanale({ rete = [], aci = [], extra = [], sec = [] } = {}, anno, dal = '') {
  const mappa = new Map();
  const aggiungi = (nome, ruolo, canale) => {
    const k = normalizzaRagioneSociale(String(nome || '').replace(/\s+/g, ' ').trim());
    if (!k) return;
    if (!mappa.has(k)) mappa.set(k, new Map());
    const ruoli = mappa.get(k);
    if (!ruoli.has(ruolo)) ruoli.set(ruolo, new Set());
    ruoli.get(ruolo).add(canale);
  };
  for (const [archivio, righe] of [['PrimariaRete', rete], ['PrimariaAci', aci], ['ExtraRaccolta', extra]]) {
    for (const r of righe || []) {
      if (!terminatoNelAnno(r, anno) || !finitoDal(r, dal)) continue;
      const canale = canaleMovimento(r, archivio);
      const td = String(r.tipo_destinazione || '').toLowerCase().trim();
      aggiungi(r.trasportatore, 'raccolta', canale);
      aggiungi(r.destinazione, td === 'stoc' ? 'stoccaggio' : 'trattamento', canale);
    }
  }
  for (const r of sec || []) {
    if (!terminatoNelAnno(r, anno) || !finitoDal(r, dal)) continue;
    const canale = canaleMovimento(r, 'Secondaria');
    aggiungi(r.stoccaggio, 'stoccaggio', canale);
    aggiungi(r.trasportatore, 'trasporto_secondaria', canale);
    aggiungi(r.destinazione, 'trattamento', canale);
  }
  return mappa;
}

const canaliDi = (mappa, chiave, ruolo) => [...((mappa.get(chiave) || new Map()).get(ruolo) || [])];

/**
 * Le tariffe passive di un contratto: quel fornitore (per id o per nome), quella
 * prestazione, quel canale (o «TUTTE»; per il trasporto qualunque canale, perche'
 * il contratto e' uno), che valgono in almeno un giorno dell'anno. Le
 * disattivate non valgono mai (regola unica di validitaTariffa.ts). Si prendono
 * TUTTE quelle dell'anno, non la prima: un prezzo rinegoziato a meta' anno o uno
 * per destinazione sono due prezzi, e il contratto lo deve dire.
 */
export function tariffeDelContratto(tariffe, { chiave, fornitoreId = null }, tipo, canale, anno) {
  const t0 = TIPI_CONTRATTO.find(t => t.chiave === tipo);
  if (!t0) return [];
  const inizio = `${anno}-01-01`;
  const fine = `${anno}-12-31`;
  return (tariffe || []).filter(t => {
    if (!t || !tariffaNonDisattivata(t)) return false;
    if (String(t.direzione || 'PASSIVA').toUpperCase() !== 'PASSIVA') return false;
    if (String(t.prestazione || '').toUpperCase() !== t0.prestazione) return false;
    const tip = String(t.tipologia || '').toUpperCase();
    if (tipo !== 'trasporto_secondaria' && tip !== canale && tip !== 'TUTTE') return false;
    const suo = (fornitoreId && t.fornitore_id === fornitoreId) || normalizzaRagioneSociale(t.fornitore_nome || '') === chiave;
    if (!suo) return false;
    const da = String(t.data_inizio_validita || '').slice(0, 10);
    const a = String(t.data_fine_validita || '').slice(0, 10);
    return (!da || da <= fine) && (!a || a >= inizio);
  });
}

/**
 * Una tariffa dell'anno nata da «Prepara l'anno» e non ancora confermata porta
 * ancora il prezzo dell'anno prima? (revisione del 13/10/2026). La finestra
 * delle tariffe salva il valore nuovo e lascia la nota della copia: la copia
 * della raccolta di rete di GATIM portata da 70 a 72 restava «copiata dal 2026»,
 * e il contratto non proponeva il 72. E' una copia solo se il suo valore e'
 * quello della tariffa dell'anno prima: la stessa riga (chiaveTariffa, anche se
 * nel frattempo disattivata), o, se la riga e' cambiata, una tariffa dell'anno
 * prima dello stesso fornitore per la stessa prestazione e canale. Senza nessun
 * prezzo dell'anno prima con cui confrontarla (la riga del 2026 cancellata) vale
 * la sua nota, e resta una copia: un prezzo vecchio che passa per nuovo e'
 * peggio di un prezzo da scrivere a mano.
 */
export function eAncoraLaCopia(copia, tariffe, tariffePrima, prima) {
  const chiave = chiaveTariffa(copia);
  const inizio = `${prima}-01-01`;
  const fine = `${prima}-12-31`;
  const stessaRiga = (tariffe || []).filter(t => {
    if (!t || t === copia || chiaveTariffa(t) !== chiave) return false;
    const da = String(t.data_inizio_validita || '').slice(0, 10);
    const a = String(t.data_fine_validita || '').slice(0, 10);
    return (!da || da <= fine) && (!a || a >= inizio);
  });
  const confronto = stessaRiga.length ? stessaRiga : (tariffePrima || []);
  if (!confronto.length) return true;
  return confronto.some(t => Number(t.valore) === Number(copia.valore));
}

const oggettoDa = (json) => {
  if (!json) return null;
  if (typeof json === 'object') return json;
  try { const o = JSON.parse(json); return o && typeof o === 'object' ? o : null; } catch { return null; }
};

const quanteVersioni = (c) => { const v = oggettoDa(c && c.versioni_json); return Array.isArray(v) ? v.length : 0; };

/**
 * La situazione dei contratti di un anno, pronta per la pagina.
 *
 * soggettiAnno / esclusiAnno: individuaSoggetti dell'anno chiesto;
 * soggettiPrima: individuaSoggetti dell'anno prima (servono finche' l'anno
 * chiesto non e' finito); archivi: { rete, aci, extra, sec } per i canali;
 * admin: chi chiede e' l'amministratore. I valori dei contratti, le tariffe e le
 * proposte contengono prezzi: li vede solo lui (regola dei costi del 16/09).
 */
export function situazioneContratti({
  anno, oggi, admin = false,
  soggettiAnno = [], esclusiAnno = [], soggettiPrima = [],
  archivi = {}, contratti = [], modelli = [], fornitori = [],
  targetRaccoglitori = [], impiantiTarget = [], tariffe = [],
}) {
  const annoNum = Number(anno);
  const annoOggi = Number(String(oggi || '').slice(0, 4)) || annoNum;
  // L'anno prima conta finche' l'anno chiesto non e' finito. Per un anno che
  // deve ancora cominciare (i contratti del 2027 si preparano a dicembre) chi
  // lavorava l'anno prima e' atteso; per l'anno in corso chi non ha piu'
  // movimenti ne' un contratto finisce in un elenco a parte, da guardare, e non
  // si conta: ottobre 2026 non deve aspettarsi un contratto da chi ha smesso nel 2025.
  const conAnnoPrima = String(oggi || '') <= `${annoNum}-12-31`;
  const prima = annoNum - 1;
  const attesoDallAnnoPrima = annoNum > annoOggi;
  // GENNAIO NON E' OTTOBRE (revisione del 13/10/2026). Il 1° gennaio l'anno chiesto
  // diventa quello in corso, e con la regola di sopra tutti i fornitori dell'anno
  // prima senza ancora un viaggio passavano fra i «da decidere»: guardati l'08/01/2027
  // i contratti 2027 attesi erano 3 invece di 33. Ma i contratti chiudono al 31/12
  // senza tacito rinnovo (memoria «Contratti annuali senza tacito rinnovo»): a
  // gennaio quelli dell'anno nuovo sono da fare per tutti. Decisione del 13/10/2026:
  // dal 1° gennaio al 31 marzo chi ha lavorato nell'ultimo trimestre dell'anno prima,
  // per quella prestazione e su quel canale, e' atteso; chi ha smesso prima resta
  // «da decidere», e dal 1° aprile chi non ha ne' movimenti dell'anno ne' un
  // contratto torna «da decidere» come in ottobre.
  const giornoOggi = String(oggi || '').slice(0, 10);
  const primoTrimestre = !attesoDallAnnoPrima && giornoOggi >= `${annoNum}-01-01` && giornoOggi <= `${annoNum}-03-31`;

  const ruoliAnno = ruoliPerCanale(archivi, annoNum);
  const ruoliPrima = conAnnoPrima ? ruoliPerCanale(archivi, prima) : new Map();
  const ruoliFinePrima = primoTrimestre ? ruoliPerCanale(archivi, prima, `${prima}-10-01`) : new Map();
  const esclusi = new Set((esclusiAnno || []).map(e => e.chiave));
  const contrattiAnno = (contratti || []).filter(c => Number(c.anno) === annoNum && c.stato !== 'annullato');

  // L'unione dei soggetti.
  const soggetti = new Map();
  for (const s of soggettiAnno || []) soggetti.set(s.chiave, { ...s, origine: s.origine === 'manuale' ? 'manuale' : 'anno' });
  if (conAnnoPrima) {
    for (const s of soggettiPrima || []) {
      if (esclusi.has(s.chiave)) continue;
      if (!soggetti.has(s.chiave)) soggetti.set(s.chiave, { ...s, origine: 'anno_prima' });
    }
  }
  for (const c of contrattiAnno) {
    if (!c.soggetto_chiave || soggetti.has(c.soggetto_chiave)) continue;
    soggetti.set(c.soggetto_chiave, { chiave: c.soggetto_chiave, nome: c.soggetto_nome || c.soggetto_chiave, ruoli: [], origine: 'contratto' });
  }
  const ruoliPrimaDi = new Map((soggettiPrima || []).map(s => [s.chiave, s.ruoli || []]));

  const perChiave = (elenco, campo) => {
    const m = new Map();
    for (const x of elenco || []) {
      const k = normalizzaRagioneSociale(x[campo]);
      if (k && !m.has(k)) m.set(k, x);
    }
    return m;
  };
  const fornitorePer = perChiave(fornitori, 'ragione_sociale');
  // Il target di un impianto vale un anno (26/09/2026): quello dell'anno chiesto,
  // o l'ultimo scritto, e la pagina dice da quale anno viene. E' un target di rete.
  const impiantoPer = impiantiTargetDellAnno(impiantiTarget, annoNum);

  // I target per raccoglitore si sommano fra le regioni, abbinati col nome del
  // portale (targetDelPortale): prima il nome uguale, poi l'abbreviazione, mai il
  // contrario, mai a caso (chiusura dell'audit, 11/10/2026).
  const targetDellAnno = (targetRaccoglitori || []).filter(t => Number(t.anno) === annoNum);
  const nomiTarget = [...new Set(targetDellAnno.map(t => String(t.raccoglitore || '').trim()).filter(Boolean))];
  const chiaviSoggetti = new Set(soggetti.keys());
  const raccoglitori = [...soggetti.values()].filter(s => (s.ruoli || []).includes('raccolta')
    || canaliDi(ruoliAnno, s.chiave, 'raccolta').length > 0 || canaliDi(ruoliPrima, s.chiave, 'raccolta').length > 0);
  const soggettoDelTarget = new Map();
  for (const nome of nomiTarget) {
    const k = normalizzaRagioneSociale(nome);
    if (!k) continue;
    if (chiaviSoggetti.has(k)) { soggettoDelTarget.set(nome, k); continue; }
    const suoi = raccoglitori.filter(s => normalizzaRagioneSociale(targetDelPortale(nomiTarget, s.nome || s.chiave) || '') === k);
    if (suoi.length === 1) soggettoDelTarget.set(nome, suoi[0].chiave);
  }
  const targetPer = new Map();
  // Chi ha almeno un target copiato da «Prepara l'anno» e non ancora confermato
  // (daConfermare, annoTarget.ts): la quantita' si propone, ma col suo avviso.
  const targetCopiatoPer = new Set();
  for (const t of targetDellAnno) {
    const k = soggettoDelTarget.get(String(t.raccoglitore || '').trim()) || normalizzaRagioneSociale(t.raccoglitore);
    if (!k) continue;
    targetPer.set(k, (targetPer.get(k) || 0) + (Number(t.target_tonnellate) || 0));
    if (daConfermare(t)) targetCopiatoPer.add(k);
  }

  // Sulla raccolta ACI i modelli sono due (13/10/2026): quello della sola
  // raccolta e quello della raccolta e stoccaggio, che ha anche il prezzo dello
  // stoccaggio. Ogni contratto prende il suo.
  const modelloPer = (tipo, canale, conStoccaggio = false) => (modelli || [])
    .filter(m => m.tipo_contratto === tipo && (m.canale || 'RETE') === canale && (m.stato || 'attivo') === 'attivo'
      && (tipo !== 'raccolta' || canale !== 'ACI' || eModelloRaccoltaEStoccaggio(m) === conStoccaggio))
    .sort((a, b) => Number(b.anno_riferimento || 0) - Number(a.anno_riferimento || 0)
      || String(b.created_date || '').localeCompare(String(a.created_date || '')))[0] || null;
  // Il modello da cui e' stato fatto un contratto, anche se poi e' stato
  // sostituito da un format nuovo: dice com'e' fatto quel contratto (14/10/2026).
  const modelloDelContratto = (c) => (c && c.modello_id ? (modelli || []).find(m => m.id === c.modello_id) || null : null);

  // Il prezzo unico di raccolta e trattamento (comprensiva_trattamento) si legge
  // sulle tariffe dell'anno; per un anno che non ha ancora le sue tariffe (i
  // contratti del 2027 si preparano a dicembre) su quelle dell'anno prima.
  const prezzoUnico = (fornitoreDi, canale) => {
    const dellAnno = tariffeDelContratto(tariffe, fornitoreDi, 'raccolta', canale, annoNum);
    const lista = dellAnno.length ? dellAnno : tariffeDelContratto(tariffe, fornitoreDi, 'raccolta', canale, prima);
    return lista.some(t => t.comprensiva_trattamento);
  };

  const righe = [];
  const daDecidere = [];
  let attesi = 0, fatti = 0;
  for (const s of soggetti.values()) {
    const f = fornitorePer.get(s.chiave) || null;
    const fornitoreDi = { chiave: s.chiave, fornitoreId: f ? f.id : null };
    const contrattoDi = (tipoChiave, canale) => contrattiAnno.find(c => c.soggetto_chiave === s.chiave && c.tipo_contratto === tipoChiave
      && (c.canale || 'RETE') === canale) || null;
    // Prima le prove di ogni prestazione, canale per canale; poi le righe. Il
    // contratto ACI di raccolta e stoccaggio (13/10/2026) guarda due prestazioni
    // insieme: la riga della raccolta deve sapere dello stoccaggio, e viceversa.
    const prove = new Map();
    for (const tipo of TIPI_CONTRATTO) {
      // canale -> da dove si sa che serve: 'anno' (movimenti o inclusione
      // dell'anno), 'contratto' (c'e' gia' un contratto dell'anno), 'anno_prima'.
      const evidenze = new Map();
      const segna = (canale, ev) => {
        const c = tipo.chiave === 'trasporto_secondaria' ? CANALE_DEL_TRASPORTO : canale;
        if (!CANALI_CONTRATTO.includes(c)) return;
        const forza = { contratto: 3, anno: 2, anno_prima: 1 };
        if (!evidenze.has(c) || forza[ev] > forza[evidenze.get(c)]) evidenze.set(c, ev);
      };
      const canaliAnno = canaliDi(ruoliAnno, s.chiave, tipo.ruolo);
      for (const c of canaliAnno) segna(c, 'anno');
      // Un ruolo dell'anno senza movimenti (un'inclusione manuale) non ha un
      // canale: vale la rete, com'era, e la pagina lo dice.
      if (s.origine !== 'anno_prima' && (s.ruoli || []).includes(tipo.ruolo) && !canaliAnno.length && s.origine !== 'contratto') segna('RETE', 'anno');
      if (conAnnoPrima) {
        const canaliPrima = canaliDi(ruoliPrima, s.chiave, tipo.ruolo);
        for (const c of canaliPrima) segna(c, 'anno_prima');
        if (!canaliPrima.length && (ruoliPrimaDi.get(s.chiave) || []).includes(tipo.ruolo)) segna('RETE', 'anno_prima');
      }
      for (const c of contrattiAnno) {
        if (c.soggetto_chiave === s.chiave && c.tipo_contratto === tipo.chiave) segna(c.canale || 'RETE', 'contratto');
      }
      // I canali su cui lavorava nell'ultimo trimestre dell'anno prima (solo da
      // gennaio a marzo): il trasporto e' un contratto solo, registrato RETE.
      const canaliFinePrima = new Set(canaliDi(ruoliFinePrima, s.chiave, tipo.ruolo)
        .map(c => (tipo.chiave === 'trasporto_secondaria' ? CANALE_DEL_TRASPORTO : c)));
      prove.set(tipo.chiave, { evidenze, canaliFinePrima });
    }
    const daUltimoTrimestreDi = (tipoChiave, canale) => {
      const p = prove.get(tipoChiave);
      return p.evidenze.get(canale) === 'anno_prima' && primoTrimestre && p.canaliFinePrima.has(canale);
    };
    const daDecidereDi = (tipoChiave, canale) => !contrattoDi(tipoChiave, canale) && prove.get(tipoChiave).evidenze.get(canale) === 'anno_prima'
      && !attesoDallAnnoPrima && !daUltimoTrimestreDi(tipoChiave, canale);
    // RACCOLTA E STOCCAGGIO ACI, UN CONTRATTO SOLO (decisione dell'utente del
    // 13/10/2026). Dai movimenti vale quando il fornitore ha tutte e due le righe
    // sull'ACI, nello stesso stato (tutte e due attese, o tutte e due da
    // decidere), e non ha gia' un contratto di stoccaggio ACI a parte per l'anno.
    // Se una delle due c'e' solo per l'anno prima (ha smesso di stoccare, o di
    // raccogliere) le righe restano due: il contratto unico non si propone a chi
    // fa una cosa sola.
    const unicoDaiMovimenti = prove.get('raccolta').evidenze.has('ACI') && prove.get('stoccaggio').evidenze.has('ACI')
      && !contrattoDi('stoccaggio', 'ACI') && daDecidereDi('raccolta', 'ACI') === daDecidereDi('stoccaggio', 'ACI');
    // Ma quando il contratto di raccolta ACI dell'anno c'e' gia', com'e' fatto lo
    // dice lui (revisione del 14/10/2026). Prima lo dicevano sempre i movimenti:
    // - il contratto 2027 di Nappi Sud coi due prezzi, firmato a dicembre, il
    //   15/04/2027 senza ancora un viaggio ACI dell'anno (nel 2026 l'ACI di Nappi
    //   Sud non ha viaggiato a gennaio, febbraio e aprile) tornava «sola
    //   raccolta», lo stoccaggio ACI diventava da decidere a parte e la pagina,
    //   riaprendolo, proponeva il modello senza il prezzo dello stoccaggio;
    // - un contratto di sola raccolta firmato prima che il fornitore cominciasse a
    //   stoccare sull'ACI diventava «raccolta e stoccaggio», e lo stoccaggio ACI
    //   «non dovuto»: nessun contratto lo copriva e i conti lo nascondevano.
    // Ora un contratto coi due prezzi copre lo stoccaggio ACI anche nei mesi
    // senza viaggi; uno di sola raccolta no, e lo stoccaggio ACI e' un contratto
    // da fare. Si puo' fare a parte, o rigenerando quello di raccolta col modello
    // della raccolta e stoccaggio (si_puo_unire_lo_stoccaggio), come vuole la
    // decisione: un contratto solo.
    const raccoltaAci = contrattoDi('raccolta', 'ACI');
    const raccoltaEStoccaggio = raccoltaAci ? eContrattoRaccoltaEStoccaggio(raccoltaAci, modelloDelContratto(raccoltaAci)) : unicoDaiMovimenti;
    const stoccaggioDaUnire = !!raccoltaAci && !raccoltaEStoccaggio && unicoDaiMovimenti;

    // Le tariffe di un contratto: quelle dell'anno, divise fra confermate, copie
    // di «Prepara l'anno» ancora col prezzo dell'anno prima e copie riscritte
    // col prezzo nuovo, e quelle dell'anno prima come riferimento.
    // Le tariffe dell'anno copiate da «Prepara l'anno» e non ancora confermate
    // portano il prezzo dell'anno prima: non sono il prezzo del contratto, che
    // e' proprio il posto dove si confermano (revisione del 13/10/2026).
    // Ma una copia riscritta col prezzo nuovo e non ancora confermata e' il
    // prezzo dell'anno, da confermare: si propone, e si dice (eAncoraLaCopia).
    const tariffeDi = (tipoChiave, canale) => {
      const sueTariffe = tariffeDelContratto(tariffe, fornitoreDi, tipoChiave, canale, annoNum);
      const tariffePrima = tariffeDelContratto(tariffe, fornitoreDi, tipoChiave, canale, prima);
      const tariffeCopiate = sueTariffe.filter(t => daConfermare(t) && eAncoraLaCopia(t, tariffe, tariffePrima, prima));
      return {
        tariffe: sueTariffe.filter(t => !daConfermare(t)),
        tariffeCopiate,
        tariffeRiscritte: sueTariffe.filter(t => daConfermare(t) && !tariffeCopiate.includes(t)),
        tariffePrima,
      };
    };

    const suoi = [];
    for (const tipo of TIPI_CONTRATTO) {
      const { evidenze } = prove.get(tipo.chiave);
      for (const canale of CANALI_CONTRATTO) {
        if (!evidenze.has(canale)) continue;
        const evidenza = evidenze.get(canale);
        const contratto = contrattoDi(tipo.chiave, canale);
        // Il contratto ACI di raccolta e stoccaggio: la riga della raccolta lo
        // porta, quella dello stoccaggio sta dentro (se non ha gia' un contratto suo).
        const conStoccaggio = raccoltaEStoccaggio && canale === 'ACI' && tipo.chiave === 'raccolta';
        const nelContrattoDiRaccolta = raccoltaEStoccaggio && canale === 'ACI' && tipo.chiave === 'stoccaggio' && !contratto;
        // Il contratto di sola raccolta ACI gia' fatto, e quest'anno anche lo
        // stoccaggio ACI: la raccolta si puo' rigenerare coi due prezzi (14/10/2026).
        const daUnire = stoccaggioDaUnire && canale === 'ACI' && (tipo.chiave === 'raccolta' || (tipo.chiave === 'stoccaggio' && !contratto));
        // Tre prestazioni che non sono un contratto a parte, e non si contano:
        // - il trattamento di rete di un impianto che Ecotyre paga da se'
        //   (trattamento_fatturato_da_ecotyre: Tecnogum nel 2026, «non ci fattura
        //   il trattamento e se le gestisce per se'», memoria «Tecnogum solo ACI»);
        // - il trattamento compreso nel prezzo unico della raccolta dello stesso
        //   fornitore e canale (comprensiva_trattamento: Green Tyre sull'ACI, un
        //   contratto solo di raccolta e trattamento);
        // - lo stoccaggio ACI di chi sull'ACI raccoglie e stocca: sta nel
        //   contratto di raccolta e stoccaggio (13/10/2026).
        const divise = tariffeDi(tipo.chiave, canale);
        const { tariffeCopiate, tariffeRiscritte, tariffePrima } = divise;
        const tariffeConfermate = divise.tariffe;
        let motivoNonDovuto = '';
        if (!contratto && tipo.chiave === 'trattamento' && canale === 'RETE' && f && f.trattamento_fatturato_da_ecotyre) {
          motivoNonDovuto = 'Il trattamento della rete di questo impianto lo paga Ecotyre: non è un contratto di SMOCO.';
        } else if (!contratto && tipo.chiave === 'trattamento' && prezzoUnico(fornitoreDi, canale)) {
          motivoNonDovuto = 'Il trattamento è compreso nel prezzo unico della raccolta: sta nel contratto di raccolta.';
        } else if (nelContrattoDiRaccolta) {
          motivoNonDovuto = 'Lo stoccaggio ACI sta nel contratto di raccolta e stoccaggio: un contratto solo, con i due prezzi.';
        }
        const nonDovuto = !!motivoNonDovuto;
        const daUltimoTrimestre = daUltimoTrimestreDi(tipo.chiave, canale);
        // Lo stoccaggio che sta nel contratto di raccolta e stoccaggio non si
        // decide a parte: si decide il contratto, sulla riga della raccolta, e
        // conta una volta sola anche fra i «da decidere».
        const decidere = daDecidereDi(tipo.chiave, canale) && !nelContrattoDiRaccolta;

        const precedente = (contratti || [])
          .filter(c => c.soggetto_chiave === s.chiave && c.tipo_contratto === tipo.chiave
            && (c.canale || 'RETE') === canale && Number(c.anno) < annoNum && c.stato !== 'annullato')
          .sort((a, b) => Number(b.anno) - Number(a.anno)
            || String(b.data_inizio || '').localeCompare(String(a.data_inizio || ''))
            || String(b.created_date || '').localeCompare(String(a.created_date || '')))[0] || null;
        const modello = modelloPer(tipo.chiave, canale, conStoccaggio);

        // La quantita' annua: il target e' della rete. Sull'ACI il gestionale
        // non ne ha uno, e il valore resta da scrivere: mai zero.
        let target = null;
        let targetAnno = null;
        let targetCopiato = false;
        if (canale === 'RETE' && tipo.chiave === 'raccolta' && targetPer.has(s.chiave)) { target = targetPer.get(s.chiave); targetAnno = annoNum; targetCopiato = targetCopiatoPer.has(s.chiave); }
        // Il target degli impianti (ImpiantoTargetSecondaria) e' quello del
        // trattamento: per lo stoccaggio non vale. Il 2026 lo dice: T-Cycle ha
        // 1.050 t di trattamento e 250 t di stoccaggio a contratto, e prima il
        // contratto di stoccaggio prendeva le 1.050.
        if (canale === 'RETE' && tipo.chiave === 'trattamento') {
          const imp = impiantoPer.get(s.chiave);
          if (imp && imp.target) { target = Math.round(Number(imp.target) / 1000); targetAnno = annoDelRecord(imp); targetCopiato = daConfermare(imp); }
        }

        const riga = {
          tipo: tipo.chiave,
          canale,
          // il contratto ACI di raccolta e stoccaggio, coi due prezzi (13/10/2026)
          raccolta_e_stoccaggio: conStoccaggio,
          // la raccolta ACI fatta di sola raccolta, che rigenerata col modello
          // della raccolta e stoccaggio comprende anche lo stoccaggio (14/10/2026)
          si_puo_unire_lo_stoccaggio: daUnire && tipo.chiave === 'raccolta',
          evidenza,
          da_ultimo_trimestre: daUltimoTrimestre,
          da_decidere: decidere,
          non_dovuto: nonDovuto,
          motivo_non_dovuto: motivoNonDovuto || null,
          stato: contratto ? contratto.stato : (nonDovuto ? 'non_dovuto' : 'mancante'),
          contratto_id: contratto ? contratto.id : null,
          contratto: contratto ? {
            id: contratto.id, data_inizio: contratto.data_inizio, data_fine: contratto.data_fine,
            quantitativo_previsto_t: contratto.quantitativo_previsto_t, condizioni_pagamento: contratto.condizioni_pagamento,
            // Il riferimento al file non va al browser (05/10/2026): si apre da apriFile.
            file_nome: contratto.file_nome, ha_file: !!contratto.file_uri, documento_firmato: !!contratto.documento_firmato,
            generato_il: contratto.generato_il, inviato_il: contratto.inviato_il, controfirmato_il: contratto.controfirmato_il,
            modello_id: contratto.modello_id, modello_nome: contratto.modello_nome, note: contratto.note,
            documento_qualifica_id: contratto.documento_qualifica_id || null,
            versioni: quanteVersioni(contratto),
            ...(admin ? { valori: oggettoDa(contratto.valori_json) } : {}),
          } : null,
          precedente_id: precedente ? precedente.id : null,
          precedente: precedente ? {
            id: precedente.id, anno: precedente.anno, data_inizio: precedente.data_inizio, data_fine: precedente.data_fine,
            quantitativo_previsto_t: precedente.quantitativo_previsto_t, condizioni_pagamento: precedente.condizioni_pagamento,
            file_nome: precedente.file_nome,
            ...(admin ? { valori: oggettoDa(precedente.valori_json) } : {}),
          } : null,
          modello_id: modello ? modello.id : null,
          modello_nome: modello ? modello.nome : null,
          target_t: target,
          target_anno: targetAnno,
          target_copiato: targetCopiato,
        };
        if (admin && !nonDovuto) {
          const sue = tariffeConfermate;
          // Nel contratto ACI di raccolta e stoccaggio anche le tariffe dello
          // stoccaggio ACI dello stesso fornitore: il secondo prezzo del contratto.
          // Anche nella raccolta di sola raccolta che si puo' rigenerare coi due
          // prezzi: il modello lo sceglie l'amministratore, e il prezzo c'e'.
          const stoccaggio = conStoccaggio || (daUnire && tipo.chiave === 'raccolta') ? tariffeDi('stoccaggio', 'ACI') : null;
          const proposta = valoriDelContratto({
            anno: annoNum, tipo: tipo.chiave, canale, fornitore: f,
            precedente: precedente ? { anno: precedente.anno, data_inizio: precedente.data_inizio, valori: oggettoDa(precedente.valori_json) } : null,
            target: target === null ? null : { t: target, anno: targetAnno, copiato: targetCopiato },
            tariffe: sue,
            tariffeCopiate,
            tariffeRiscritte,
            // Il prezzo unico si legge come lo legge la riga del trattamento, anche
            // sulle copie e sull'anno prima: se il trattamento dice «sta nel
            // contratto di raccolta», la raccolta lo dice (revisione del 13/10/2026).
            prezzoUnico: tipo.chiave === 'raccolta' && prezzoUnico(fornitoreDi, canale),
            stoccaggio,
          });
          // Chi lavora sotto un altro fornitore che gli fattura le prestazioni
          // (fattura_tramite: Torres sotto Green Tyre nel 2026) forse non ha un
          // contratto suo con SMOCO: lo si dice, la decisione e' dell'amministratore.
          if (f && f.fattura_tramite_nome) proposta.avvisi.push(`Lavora sotto ${f.fattura_tramite_nome}, che gli fattura le prestazioni: controlla se il contratto è suo o di ${f.fattura_tramite_nome}.`);
          // Il contratto di raccolta ACI fatto e' di sola raccolta, e quest'anno il
          // fornitore stocca anche sull'ACI (revisione del 14/10/2026): lo si dice
          // sulle due righe, perche' la decisione e' un contratto solo.
          if (daUnire && tipo.chiave === 'raccolta') proposta.avvisi.push('Il contratto di raccolta ACI fatto è di sola raccolta, e quest\'anno sull\'ACI stocca anche: rigeneralo col modello della raccolta e stoccaggio e i due prezzi stanno in un contratto solo, senza lo stoccaggio ACI a parte.');
          if (daUnire && tipo.chiave === 'stoccaggio') proposta.avvisi.push('Il contratto di raccolta ACI di questo fornitore è di sola raccolta: lo stoccaggio ACI non ce l\'ha. Rigenera quello col modello della raccolta e stoccaggio, coi due prezzi, oppure fai qui un contratto di stoccaggio a parte.');
          // servizio: di quale prezzo del contratto e' la tariffa, solo quando i
          // prezzi sono due (raccolta e stoccaggio)
          const comeTariffa = (t, servizio = null) => ({ valore: t.valore, unita_misura: t.unita_misura || '€/t', dove: doveVale(t), dal: t.data_inizio_validita || null, al: t.data_fine_validita || null, ...(servizio ? { servizio } : {}) });
          const qui = stoccaggio ? 'raccolta' : null;
          riga.proposta = {
            ...proposta,
            // le confermate e le copie riscritte col prezzo nuovo, segnate da_confermare
            tariffe: [...sue.map(t => comeTariffa(t, qui)), ...tariffeRiscritte.map(t => ({ ...comeTariffa(t, qui), da_confermare: true })),
              ...(stoccaggio ? [...stoccaggio.tariffe.map(t => comeTariffa(t, 'stoccaggio')), ...stoccaggio.tariffeRiscritte.map(t => ({ ...comeTariffa(t, 'stoccaggio'), da_confermare: true }))] : [])],
            // Le copie di «Prepara l'anno» ancora da confermare: un riferimento,
            // come le tariffe dell'anno prima, mai il valore.
            tariffe_copiate: [...tariffeCopiate.map(t => comeTariffa(t, qui)), ...(stoccaggio ? stoccaggio.tariffeCopiate.map(t => comeTariffa(t, 'stoccaggio')) : [])],
            // Le tariffe dell'anno prima si mostrano accanto al prezzo, come
            // riferimento, e non diventano mai il valore: i contratti chiudono al
            // 31/12 senza tacito rinnovo, e il prezzo del 2027 non e' quello del
            // 2026 finche' qualcuno non lo conferma (memoria «Contratti annuali
            // senza tacito rinnovo»).
            tariffe_anno_prima: [...tariffePrima.map(t => comeTariffa(t, qui)), ...(stoccaggio ? stoccaggio.tariffePrima.map(t => comeTariffa(t, 'stoccaggio')) : [])],
          };
        }
        if (decidere) { daDecidere.push({ ...riga, soggetto: s.chiave }); }
        else if (!nonDovuto) {
          attesi++;
          if (contratto && contratto.stato === 'controfirmato') fatti++;
        }
        suoi.push(riga);
      }
    }
    if (!suoi.length) continue;
    righe.push({
      chiave: s.chiave,
      nome: s.nome,
      ruoli: s.ruoli || [],
      origine: s.origine,
      fornitore_id: f ? f.id : null,
      piva: (f && f.piva) || s.piva || '',
      fornitore: f ? {
        ragione_sociale: f.ragione_sociale, piva: f.piva, codice_fiscale: f.codice_fiscale,
        indirizzo: f.indirizzo, cap: f.cap, comune: f.comune, provincia: f.provincia,
        email: f.email, telefono: f.telefono,
        trattamento_fatturato_da_ecotyre: !!f.trattamento_fatturato_da_ecotyre,
      } : null,
      contratti: suoi,
    });
  }
  righe.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it'));

  return {
    anno: annoNum,
    anno_prima: conAnnoPrima ? prima : null,
    anno_prima_atteso: conAnnoPrima && attesoDallAnnoPrima,
    // da gennaio a marzo: chi lavorava nell'ultimo trimestre dell'anno prima e' atteso
    anno_prima_ultimo_trimestre: conAnnoPrima && primoTrimestre,
    soggetti: righe,
    da_decidere: daDecidere.length,
    modelli: (modelli || []).filter(m => (m.stato || 'attivo') === 'attivo').map(m => ({
      id: m.id, nome: m.nome, tipo_contratto: m.tipo_contratto, canale: m.canale || 'RETE',
      anno_riferimento: m.anno_riferimento, file_nome: m.file_nome, ha_file: !!m.file_uri,
      segnaposti_json: m.segnaposti_json, punti_json: m.punti_json || null,
      // il modello ACI della raccolta e stoccaggio (13/10/2026)
      raccolta_e_stoccaggio: eModelloRaccoltaEStoccaggio(m),
      fornitore_origine: m.fornitore_origine || null, created_date: m.created_date || null,
    })),
    totali: { attesi, controfirmati: fatti, da_fare: attesi - fatti },
  };
}
