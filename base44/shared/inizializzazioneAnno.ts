// CHE COSA SERVE A UN ANNO PER COMINCIARE, E CHE COSA GLI MANCA.
//
// Il contratto con Ecotyre, e con tutti i fornitori, e' ANNUALE SENZA TACITO
// RINNOVO (regola dell'utente, 06/10/2026): il 31 dicembre scade tutto e il 1°
// gennaio non c'e' piu' niente in piedi. Non e' un dettaglio amministrativo, e'
// la differenza fra un gestionale che riparte e uno che si ferma:
//
// - `seedTariffe2026` e `seedTariffeAttive2026` chiudono le tariffe al
//   31/12/2026. Dal giorno dopo, in `attivaCalcolo.ts`, una riga senza tariffa
//   vale **zero euro** e nasce con `stato_validazione: 'errore'`. Lo stesso
//   sulla passiva. Al primo formulario di gennaio la fatturazione e' inservibile
//   finche' qualcuno non scrive i prezzi nuovi.
// - `copiaAnnoTarget` sa gia' portare avanti impianti, target, collegamenti,
//   contratto Ecotyre ed elenco siti. Le TARIFFE no: nessuno le copiava.
// - La fotografia dei piazzali al 31/12 si legge a portale QUEL GIORNO: la
//   pagina Unita' Locali mostra il saldo di adesso, non lo storico. Chi la
//   chiede il 7 gennaio legge un numero sbagliato e non se ne accorge - e' gia'
//   successo per sei piazzali sul 2025, e quella lettura non torna piu'.
//
// Questo modulo non fa niente da solo: dice, voce per voce, se l'anno e' pronto,
// che cosa manca e dove si rimedia. La verifica e' una SOMMA DI FATTI letti
// dagli archivi, non una scadenza scritta da qualche parte: cosi' resta vera
// anche l'anno prossimo, quando nessuno si ricordera' di questo codice.
import { conNotaCopia, daConfermare } from "./annoTarget.ts";

export const PRIMO_GIORNO = (anno) => `${Number(anno)}-01-01`;
export const ULTIMO_GIORNO = (anno) => `${Number(anno)}-12-31`;

const giorno = (v) => String(v || '').slice(0, 10);
const testo = (v) => String(v === undefined || v === null ? '' : v).trim().toLowerCase();
// Le date si scrivono all'italiana ovunque si leggano: 31/12/2026, non 2026-12-31.
const gg = (v) => (giorno(v) ? giorno(v).split('-').reverse().join('/') : '');

/**
 * Una tariffa copre quel giorno? Senza data di inizio vale da sempre, senza
 * data di fine vale per sempre: e' cosi' che le legge la fatturazione.
 */
export function copreIlGiorno(t, quando) {
  if (!t) return false;
  if (String(t.stato || 'attivo') !== 'attivo') return false;
  const da = giorno(t.data_inizio_validita);
  const a = giorno(t.data_fine_validita);
  if (da && da > quando) return false;
  if (a && a < quando) return false;
  return true;
}

/**
 * CHE COSA RENDE DUE TARIFFE «LA STESSA RIGA IN DUE ANNI».
 *
 * Tutto quello che la fatturazione usa per scegliere una tariffa, e nient'altro:
 * il VALORE no - e' proprio quello che cambia da un anno all'altro - e le date
 * nemmeno. Due righe con questa chiave uguale sono la stessa tariffa rinnovata.
 */
export function chiaveTariffa(t) {
  return [
    testo(t && t.direzione) || 'passiva',
    testo(t && t.tipologia),
    testo(t && t.prestazione),
    testo(t && t.fornitore_nome),
    testo(t && t.cliente),
    testo(t && t.servizio_nome),
    testo(t && t.servizio_ecotyre),
    testo(t && t.regione),
    testo(t && t.provincia),
    testo(t && t.classe_materiale),
    testo(t && t.eer_codice),
    testo(t && t.destinazione),
    testo(t && t.produttore),
    testo(t && t.destinatario),
    testo(t && t.unita_misura),
  ].join('|');
}

/**
 * Le tariffe che scadono con l'anno vecchio e che l'anno nuovo non ha.
 * Si guarda chi copre il 31 dicembre e non copre il 1° gennaio dopo: e' il
 * buco, e si misura sui fatti invece che su una data scritta nel codice.
 */
export function tariffeDaRinnovare(tariffe, anno, direzione = '') {
  const prima = ULTIMO_GIORNO(Number(anno) - 1);
  const dopo = PRIMO_GIORNO(anno);
  const dir = testo(direzione);
  const scelte = (tariffe || []).filter(t => !dir || testo(t.direzione || 'PASSIVA') === dir);
  const coperte = new Set();
  for (const t of scelte) if (copreIlGiorno(t, dopo)) coperte.add(chiaveTariffa(t));
  const per = new Map();
  for (const t of scelte) {
    if (!copreIlGiorno(t, prima)) continue;
    const k = chiaveTariffa(t);
    if (coperte.has(k) || per.has(k)) continue;
    per.set(k, t);
  }
  return [...per.values()];
}

/**
 * La stessa tariffa per l'anno nuovo: identica, con la validita' spostata e il
 * VALORE DELL'ANNO PRIMA come punto di partenza.
 *
 * Il prezzo si copia perche' la riga senza prezzo non serve a niente, ma si
 * copia SEGNATA: `conNotaCopia` scrive «copiato dal {anno-1}, da confermare», e
 * `daConfermare` la riconosce. Finche' nessuno l'ha confermata la voce della
 * lista resta gialla: un prezzo vecchio che passa per nuovo e' peggio di un
 * prezzo che manca, e questo e' l'unico modo di avere tutt'e due le cose -
 * la fatturazione che riparte e il dubbio che resta scritto.
 *
 * L'identificativo e le date di sistema non si copiano: nasce un record nuovo.
 */
export function copiaTariffa(t, anno) {
  const nuova = { ...t };
  for (const k of ['id', 'created_date', 'updated_date', 'created_by_id', 'created_by', 'is_sample']) delete nuova[k];
  nuova.data_inizio_validita = PRIMO_GIORNO(anno);
  nuova.data_fine_validita = ULTIMO_GIORNO(anno);
  nuova.stato = 'attivo';
  nuova.note = conNotaCopia(t && t.note, anno);
  return nuova;
}

/** Le tariffe dell'anno nate da una copia e non ancora confermate. */
export function tariffeDaConfermare(tariffe, anno, direzione = '') {
  const dir = testo(direzione);
  return (tariffe || []).filter(t => (!dir || testo(t.direzione || 'PASSIVA') === dir)
    && copreIlGiorno(t, PRIMO_GIORNO(anno)) && daConfermare(t));
}

/** Quanti giorni mancano al 1° gennaio dell'anno; negativo se e' gia' passato. */
export function giorniAlPrimoGennaio(anno, oggi) {
  const a = giorno(oggi);
  if (!a) return null;
  const da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const al = Date.UTC(Number(anno), 0, 1);
  return Math.round((al - da) / 86400000);
}

const voce = (chiave, titolo, perche, dove) => ({ chiave, titolo, perche, dove, stato: 'manca', dettaglio: '', azione: '' });
const conta = (righe, anno) => (righe || []).filter(r => Number(r && r.anno) === Number(anno)).length;

/**
 * LA LISTA DI CONTROLLO DELL'ANNO NUOVO.
 *
 * Sei voci, ognuna con il suo stato: `pronto` (non c'e' niente da fare),
 * `parziale` (c'e' qualcosa ma va confermato o completato), `manca`.
 * `azione` dice che cosa il gestionale sa fare da solo; `dove` dove si fa a mano.
 */
export function listaAnno({
  anno,
  tariffe = [],
  giacenzeSito = [],
  impiantiTarget = [],
  commesse = [],
  contrattiFornitore = [],
  rilevazioni = [],
  piazzali = [],
  oggi = '',
} = {}) {
  const annoNum = Number(anno);
  const voci = [];

  // 1-2. Le tariffe, una direzione per volta: non si mescolano mai, come i canali.
  for (const [dir, chiave, titolo, perche] of [
    ['ATTIVA', 'tariffe_attive', 'Tariffe verso Ecotyre', 'Senza tariffa una riga della fatturazione attiva vale zero euro e nasce in errore.'],
    ['PASSIVA', 'tariffe_passive', 'Tariffe verso i fornitori', 'Senza tariffa una riga della fatturazione passiva vale zero euro e nasce in errore.'],
  ]) {
    const v = voce(chiave, titolo, perche, 'Fatturazione > Anagrafiche > Tariffe');
    const mancano = tariffeDaRinnovare(tariffe, annoNum, dir);
    const daConf = tariffeDaConfermare(tariffe, annoNum, dir);
    const attive = (tariffe || []).filter(t => testo(t.direzione || 'PASSIVA') === testo(dir) && copreIlGiorno(t, PRIMO_GIORNO(annoNum)));
    if (mancano.length) {
      v.stato = 'manca';
      v.dettaglio = `${mancano.length} ${mancano.length === 1 ? 'tariffa scade' : 'tariffe scadono'} il ${gg(ULTIMO_GIORNO(annoNum - 1))} e il ${annoNum} non ${mancano.length === 1 ? "ce l'ha" : 'ce le ha'}.`;
      v.azione = 'copia_tariffe';
    } else if (daConf.length) {
      v.stato = 'parziale';
      v.dettaglio = `${daConf.length} ${daConf.length === 1 ? 'tariffa copiata' : 'tariffe copiate'} dal ${annoNum - 1} con il prezzo dell'anno prima: vanno confermate sul contratto.`;
    } else if (attive.length) {
      v.stato = 'pronto';
      v.dettaglio = `${attive.length} ${attive.length === 1 ? 'tariffa copre' : 'tariffe coprono'} il ${annoNum}.`;
    } else {
      v.stato = 'manca';
      v.dettaglio = `Nessuna tariffa copre il ${annoNum}, e nemmeno il ${annoNum - 1} ne aveva: vanno scritte dal contratto.`;
    }
    v.quante = mancano.length || daConf.length || attive.length;
    voci.push(v);
  }

  // 3. Il contratto Ecotyre: da li' arrivano target e prezzi veri.
  {
    const v = voce('contratto_ecotyre', 'Contratto Ecotyre', 'Target annuo, regioni e prezzi dell’anno vengono da qui.', 'Target & Status > Commessa Ecotyre');
    const n = conta(commesse, annoNum);
    v.stato = n ? 'pronto' : 'manca';
    v.quante = n;
    v.dettaglio = n ? `Il contratto ${annoNum} c’e’.` : `Il ${annoNum} non ha ancora un contratto.`;
    voci.push(v);
  }

  // 4. Target e siti: lo sa fare copiaAnnoTarget, che non sovrascrive niente.
  {
    const v = voce('target_e_siti', 'Target e siti', 'Senza i target mensili la copertura e la predittivita’ dell’anno non si calcolano.', 'Target & Status > Impianti > Copia dall’anno prima');
    const t = conta(impiantiTarget, annoNum);
    const s = conta(giacenzeSito, annoNum);
    v.quante = t;
    if (t && s) { v.stato = 'pronto'; v.dettaglio = `${t} target mensili e ${s} siti per il ${annoNum}.`; }
    else if (t || s) { v.stato = 'parziale'; v.dettaglio = `${t} target mensili e ${s} siti: manca una delle due metà.`; }
    else { v.stato = 'manca'; v.dettaglio = `Il ${annoNum} non ha ancora né target né siti.`; }
    voci.push(v);
  }

  // 5. La fotografia del 31/12: e' l'ancora da cui l'anno nuovo riparte, e si
  //    legge a portale QUEL GIORNO.
  {
    const al = ULTIMO_GIORNO(annoNum - 1);
    const v = voce('fotografia', `Fotografia dei piazzali al ${gg(al)}`, 'E’ il punto da cui ripartono le giacenze: il portale mostra il saldo di adesso, non quello di un mese fa, quindi si legge il 31 dicembre.', 'Giacenze > Chiusura anno');
    const fatte = new Set((rilevazioni || []).filter(r => giorno(r.data_rilevazione) === al).map(r => testo(r.sito)));
    const attesi = (piazzali || []).map(p => testo(p));
    const mancano = attesi.filter(p => !fatte.has(p));
    v.quante = fatte.size;
    if (!attesi.length) { v.stato = 'pronto'; v.dettaglio = 'Nessun piazzale da fotografare.'; }
    else if (!mancano.length) { v.stato = 'pronto'; v.dettaglio = `Tutti i ${attesi.length} piazzali hanno la lettura del ${gg(al)}.`; }
    else if (fatte.size) { v.stato = 'parziale'; v.dettaglio = `${fatte.size} piazzali su ${attesi.length} hanno la lettura del ${gg(al)}; mancano ${mancano.length}.`; }
    else { v.stato = 'manca'; v.dettaglio = `Nessuno dei ${attesi.length} piazzali ha la lettura del ${gg(al)}.`; }
    voci.push(v);
  }

  // 6. I contratti ai subfornitori: annuali anche loro.
  {
    const v = voce('contratti_fornitori', 'Contratti ai subfornitori', 'Annuali senza tacito rinnovo: vanno rigenerati e rifirmati ogni anno.', 'Qualifica Fornitori > Contratti');
    const n = conta(contrattiFornitore, annoNum);
    const prima = conta(contrattiFornitore, annoNum - 1);
    v.quante = n;
    // Il confronto con l'anno prima serve solo se l'anno prima ne aveva: dove non
    // c'erano contratti non c'e' niente da rinnovare, e dirlo «parziale» sarebbe
    // chiedere di completare una cosa che non esiste (10/10/2026).
    if (!prima && !n) { v.stato = 'pronto'; v.dettaglio = `Nel ${annoNum - 1} non ce n'erano: niente da rinnovare.`; }
    else if (!n) { v.stato = 'manca'; v.dettaglio = `Nessun contratto per il ${annoNum}; nel ${annoNum - 1} erano ${prima}.`; }
    else if (!prima || n >= prima) { v.stato = 'pronto'; v.dettaglio = `${n} ${n === 1 ? 'contratto' : 'contratti'} per il ${annoNum}.`; }
    else { v.stato = 'parziale'; v.dettaglio = `${n} ${n === 1 ? 'contratto' : 'contratti'} per il ${annoNum}, contro ${prima} del ${annoNum - 1}.`; }
    voci.push(v);
  }

  const giorni = giorniAlPrimoGennaio(annoNum, oggi);
  const mancanti = voci.filter(v => v.stato === 'manca').length;
  const parziali = voci.filter(v => v.stato === 'parziale').length;
  return {
    anno: annoNum,
    voci,
    giorni_al_primo_gennaio: giorni,
    pronte: voci.filter(v => v.stato === 'pronto').length,
    parziali,
    mancanti,
    pronto: mancanti === 0 && parziali === 0,
    // Si comincia a insistere a dicembre: prima e' presto, e un avviso dato
    // troppo presto si impara a ignorarlo.
    urgente: mancanti > 0 && giorni !== null && giorni <= 31,
    // QUANDO VALE LA PENA DIRLO IN DASHBOARD: dal 1° novembre, cioe' due mesi
    // prima, e finche' resta qualcosa da fare - anche a gennaio inoltrato, se
    // le tariffe nuove non le ha ancora confermate nessuno. Fuori da questa
    // finestra la dashboard tace: un avviso che sta li' tutto l'anno non e'
    // un avviso, e' arredamento.
    avvicinandosi: giorni !== null && giorni <= 61 && (mancanti > 0 || parziali > 0),
  };
}
