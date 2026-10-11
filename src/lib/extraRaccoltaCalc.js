// Calcoli condivisi per Extra Raccolta — usato sia dalla pagina sia dall'esportazione.
// Nessun valore viene memorizzato nell'entità: tutto è ricalcolato dai campi di input.
// Import relativo con l'estensione: cosi' lo legge anche la prova in node.
import { giornoRoma } from './giornoItaliano.js';
import {
  TARIFFA_BASE_EXTRA_RACCOLTA, tariffaBaseExtraRaccolta, prezzoAttivoExtra as prezzoAttivoComune,
  sortTariffe, tariffeAttiveValide, servizioEcotyre, eSecondariaExtra, avvisoPesoMancante,
  arrotondaAlCentesimo,
} from './ecotyreTariffe.js';
import { tariffaValeIl } from './validitaTariffa.js';
import { normalizzaRagioneSociale } from './normalizzaRagioneSocialeClient.js';
import { PROV_TO_REGION } from './regioneMap.js';

// IL PREZZO ATTIVO E' QUELLO DELLA FATTURA, DALLA STESSA FUNZIONE (chiusura
// dell'audit, 11/10/2026). Qui c'era una copia della sola base dei 202 euro e un
// prezzo a due gradini - scritto, poi base - mentre la fattura ne ha tre:
// scritto, Tariffa ATTIVA EXTRA_RACCOLTA, base. Dal 2027, con la tariffa del 2026
// rimasta aperta per scelta, la fattura diceva 202 €/t con l'avviso «prezzo del
// 2026» e la scheda «per il 2027 non c'e' una tariffa base: scrivi il prezzo»; e
// con la tabella a un valore diverso da 202 la pagina diceva un ricavo e la
// fattura un altro. Ora il prezzo lo sceglie prezzoAttivoExtra di
// ecotyreTariffe.js, lo specchio di quella della fattura, con le tariffe attive
// che la pagina legge una volta (contestoPrezzi). Senza contesto restano i due
// gradini che non hanno bisogno di letture: il prezzo scritto e la base.
export { TARIFFA_BASE_EXTRA_RACCOLTA, tariffaBaseExtraRaccolta };

/**
 * Le tariffe attive e i fornitori che la pagina ha letto, pronti per il prezzo:
 * le tariffe filtrate e ordinate come le ordina la fattura, e la regola della
 * dicitura (Trasp. o Trasp.+Tratt.) che sceglie fra due tariffe dello stesso canale.
 */
export function contestoPrezzi(tariffeAttive = [], fornitori = []) {
  return { tariffe: sortTariffe(tariffeAttiveValide(tariffeAttive || [])), servizio: servizioEcotyre(fornitori || []) };
}
const CONTESTO_VUOTO = contestoPrezzi();

/**
 * L'anno di un intervento: la fine del trasporto; per uno ancora ASSEGNATO, che un
 * trasporto non l'ha fatto, la data della richiesta.
 *
 * Il ripiego vale solo per chi non e' terminato. Un terminato senza fine trasporto
 * non sta in nessun anno (regola 1) e qui torna null: prendendo l'anno
 * dell'immissione, una scheda vecchia terminata a cavallo d'anno prendeva la tariffa
 * base dell'anno sbagliato, e il margine mostrato non era quello vero. Le tre date
 * sono obbligatorie dal 22/09/2026 e le schede nuove ce l'hanno; quelle di prima si
 * segnalano, non si indovinano.
 */
export function annoIntervento(r) {
  const fine = giornoRoma(r && r.trasporto_finito_il);
  if (fine) return Number(fine.slice(0, 4));
  if (String((r && r.stato) || '').toLowerCase().trim() === 'terminato') return null;
  const immesso = giornoRoma(r && r.ordine_immesso_il);
  return immesso ? Number(immesso.slice(0, 4)) : null;
}

/**
 * Il prezzo attivo di un intervento, lo stesso della fatturazione attiva: quello
 * di prezzoAttivoExtra (origine, valore, unita, nota, altro_anno, totale(kg)...)
 * piu' `base` (vero se il prezzo non e' scritto ma viene dalla tabella o dalla
 * base dell'anno) e `anno`. Le secondarie non si fatturano a Ecotyre (il ricavo
 * sta sulla raccolta): per loro il prezzo e' zero.
 * `dataRiferimento` serve alla scheda di un intervento ancora aperto, che la fine
 * trasporto non ce l'ha.
 */
export function prezzoAttivoExtra(r, contesto = CONTESTO_VUOTO, dataRiferimento = '', annoScelto = null) {
  const c = contesto || CONTESTO_VUOTO;
  const anno = annoScelto || annoIntervento(r);
  const p = prezzoAttivoComune(r, c.tariffe, c.servizio(r || {}), anno, dataRiferimento || undefined);
  return { ...p, base: p.origine === 'tabella' || p.origine === 'base', anno };
}

/**
 * IL COSTO PASSIVO DA PROPORRE SU UN INTERVENTO: la tariffa PASSIVA di
 * EXTRA_RACCOLTA del fornitore per quella prestazione, scelta come la sceglie
 * passivaCalcolo. Torna la tariffa, o null.
 *
 * Per la raccolta la cascata di findTariffaRaccolta - destinazione, provincia,
 * regione, generica: prendere la prima tariffa del fornitore precompilava, per
 * Emmesse, i 72 euro di Gatim su un ritiro scaricato a Irigom, che ne costa 90.
 * Per impianti e stoccaggi, come findTariffaImpianto, conta solo la classe. A
 * parita' di livello vince quella per classe sulla generica.
 *
 * LA VALIDITA' E' QUELLA DELLA FATTURAZIONE (chiusura dell'audit, 11/10/2026):
 * tariffaValeIl sul giorno italiano di fine trasporto, o di oggi per un
 * intervento ancora aperto. La scheda voleva lo stato scritto 'attivo', e una
 * tariffa con lo stato vuoto - che per la passiva vale - non si proponeva; e
 * confrontava le date come testo, senza leggere il giorno italiano.
 *
 * @param tariffe le tariffe lette dalla scheda (le passive dell'extra raccolta)
 * @param fornitore { id, ragione_sociale } dall'anagrafica
 * @param prestazione 'RACCOLTA', 'TRATTAMENTO' o 'CONFERIMENTO_STOCCAGGIO'
 * @param intervento la scheda: trasporto_finito_il, classe, destinazione, provincia
 * @param oggi il giorno italiano di oggi ('aaaa-mm-gg')
 */
export function tariffaPassivaProposta(tariffe, fornitore, prestazione, intervento, oggi) {
  if (!fornitore) return null;
  const f = intervento || {};
  const data = f.trasporto_finito_il || oggi;
  const nomeFornitore = normalizzaRagioneSociale(fornitore.ragione_sociale);
  const valida = (t) => {
    if (!t) return false;
    const suo = (fornitore.id && t.fornitore_id === fornitore.id) || (!!nomeFornitore && normalizzaRagioneSociale(t.fornitore_nome) === nomeFornitore);
    if (!suo || t.prestazione !== prestazione || t.direzione !== 'PASSIVA') return false;
    if (t.tipologia !== 'EXTRA_RACCOLTA') return false;
    if (!tariffaValeIl(t, data)) return false;
    if (t.classe_materiale && t.classe_materiale !== f.classe) return false;
    return true;
  };
  const vuoto = (s) => !String(s || '').trim();
  const maiuscolo = (s) => String(s || '').trim().toUpperCase();
  const perClasse = (c) => c.find(t => t.classe_materiale) || c[0] || null;
  const c = (tariffe || []).filter(valida);
  if (prestazione !== 'RACCOLTA') return perClasse(c);
  const dest = vuoto(f.destinazione) ? '' : normalizzaRagioneSociale(f.destinazione);
  const prov = maiuscolo(f.provincia);
  const reg = maiuscolo(PROV_TO_REGION[prov]);
  const livelli = [
    dest ? c.filter(t => !vuoto(t.destinazione) && normalizzaRagioneSociale(t.destinazione) === dest) : [],
    prov ? c.filter(t => vuoto(t.destinazione) && maiuscolo(t.provincia) === prov) : [],
    reg ? c.filter(t => vuoto(t.destinazione) && vuoto(t.provincia) && maiuscolo(t.regione) === reg) : [],
    c.filter(t => vuoto(t.destinazione) && vuoto(t.provincia) && vuoto(t.regione)),
  ];
  for (const l of livelli) { const m = perClasse(l); if (m) return m; }
  return null;
}

/** Un terminato senza peso effettivo: si segnala, e la quantita' ritirata non lo sostituisce. */
export const senzaPesoEffettivo = (r) => !(Number(r && r.peso_effettivo) > 0);
export { avvisoPesoMancante };

const r2 = (v) => Math.round(v * 100) / 100;

export function calcExtraRaccolta(r, contesto = CONTESTO_VUOTO) {
  // SOLO IL PESO EFFETTIVO (11/10/2026). Qui si ripiegava sulla quantita'
  // ritirata: la pagina e il foglio dell'amministrazione valutavano un intervento
  // che la fattura scartava e la passiva contava a zero chili. Si valuta solo sul
  // peso effettivo, e un peso che manca si dice (senza_peso, kg null): non si
  // sostituisce con un altro numero.
  const senza_peso = senzaPesoEffettivo(r);
  const quantita_kg = senza_peso ? 0 : Number(r.peso_effettivo);
  const tonnellate = Math.round((quantita_kg / 1000) * 1000) / 1000;

  // Il ricavo e' quello della fattura, riga per riga come lei: il prezzo per il
  // peso e i tre sovracosti, ciascuno al centesimo. Una secondaria e un
  // terminato senza peso in fattura non entrano: qui il loro ricavo e' zero, e
  // `fatturato` dice perche' la pagina non deve mostrarlo come un incasso.
  const prezzo = prezzoAttivoExtra(r, contesto);
  const prezzoAttivo = prezzo.valore;
  const sovraRaccolta = Number(r.sovracosto_raccolta || 0);
  const sovraTrasporto = Number(r.sovracosto_trasporto || 0);
  const sovraTrattamento = Number(r.sovracosto_trattamento || 0);
  const fatturato = !eSecondariaExtra(r) && !senza_peso;

  const ricavo = fatturato
    ? r2(r2(prezzo.totale(quantita_kg)) + r2(sovraRaccolta) + r2(sovraTrasporto) + r2(sovraTrattamento))
    : 0;

  const costoRaccolta = Number(r.costo_raccolta_t || 0);
  const costoStoccaggio = Number(r.costo_stoccaggio_t || 0);
  const costoTrattamento = Number(r.costo_trattamento_t || 0);
  const costoPulizia = Number(r.costo_pulizia || 0);
  const costiAggiuntivi = Number(r.costi_aggiuntivi || 0);
  // Il trasporto di un intervento si paga A VIAGGIO, non a tonnellata: e' un
  // importo fisso come la pulizia. Il campo e' nato il 03/10/2026, perche' nel
  // foglio dell'amministrazione la colonna «PREZZO (Euro/viaggio)» c'era e qui
  // non c'era niente da scriverci: il trasporto non si pagava, e per una
  // secondaria - un trasferimento da uno stoccaggio a un impianto, che non ha un
  // costo di raccolta - non si pagava proprio nulla al trasportatore.
  const costoTrasporto = Number(r.costo_trasporto_viaggio || 0);
  // I SOVRACOSTI DELLA PASSIVA HANNO UN PADRONE. L'utente, 03/10/2026: «il
  // sovraccosto nella passiva puo' essere dovuto al raccoglitore (quando ad
  // esempio ha dovuto sostenere costi imprevisti nella raccolta) o per l'impianto
  // di conferimento che li deve lavorare». Sono importi fissi, come il trasporto:
  // non si moltiplicano per le tonnellate. Da non confondere con i tre
  // sovracosto_* qui sopra, che sono del RICAVO.
  const sovraRaccoglitore = Number(r.sovracosto_pagato_raccoglitore || 0);
  const sovraImpianto = Number(r.sovracosto_pagato_impianto || 0);

  // OGNI COSTO A TONNELLATA AL CENTESIMO PER CONTO SUO, POI LA SOMMA (chiusura
  // dell'audit, 11/10/2026). E' la grana della passiva: la raccolta si paga al
  // raccoglitore e il trattamento all'impianto, ciascuno arrotondato al
  // centesimo. Qui si arrotondava una volta sola la somma, e 2,631 t a 90 + 95
  // €/t facevano 486,73 (486,735 in binario e' un soffio sotto il mezzo
  // centesimo), dove la passiva paga 236,79 + 249,95 = 486,74: sull'esempio
  // dell'audit pagina e foglio dicevano 2.661,59 e la passiva 2.661,61. Il
  // centesimo e' quello di arrotondaAlCentesimo, lo stesso della passiva e di
  // =ROUND(...;2) del foglio Excel. I chili per il costo sono quelli veri, come
  // in passiva (peso / 1000), non le tonnellate gia' arrotondate a tre decimali.
  const t = quantita_kg / 1000;
  const costi = {
    raccolta: arrotondaAlCentesimo(t * costoRaccolta),
    stoccaggio: arrotondaAlCentesimo(t * costoStoccaggio),
    trattamento: arrotondaAlCentesimo(t * costoTrattamento),
  };
  const costo_totale = arrotondaAlCentesimo(costi.raccolta + costi.stoccaggio + costi.trattamento
    + costoPulizia + costiAggiuntivi + costoTrasporto + sovraRaccoglitore + sovraImpianto);

  const margine = Math.round((ricavo - costo_totale) * 100) / 100;
  const margine_perc = ricavo !== 0 ? Math.round((margine / ricavo * 100) * 100) / 100 : 0;

  return {
    tonnellate, kg: senza_peso ? null : quantita_kg, senza_peso, fatturato,
    prezzo_attivo: prezzoAttivo, prezzo, ricavo, costi, costo_totale, margine, margine_perc,
  };
}

// Totale riga per export: il prezzo per il peso, come la riga della fattura,
// senza sovracosti. Zero per chi in fattura non entra.
export function totaleRiga(r, contesto = CONTESTO_VUOTO) {
  const c = calcExtraRaccolta(r, contesto);
  return c.fatturato ? r2(c.prezzo.totale(c.kg)) : 0;
}

// Aggregazione per produttore per analisi margine
export function aggregaPerProduttore(records, contesto = CONTESTO_VUOTO) {
  const map = {};
  for (const r of records) {
    const p = r.produttore || '(senza produttore)';
    if (!map[p]) map[p] = { costi_aggiuntivi: 0, raccolta: 0, stoccaggio: 0, trattamento: 0, pulizia: 0, trasporto: 0, sovracosto_raccoglitore: 0, sovracosto_impianto: 0, costo_totale: 0, ricavi: 0, margine: 0 };
    const c = calcExtraRaccolta(r, contesto);
    map[p].costi_aggiuntivi += Number(r.costi_aggiuntivi || 0);
    // Le voci a tonnellata come le conta il costo totale, gia' al centesimo per
    // intervento: cosi' le colonne fanno il costo totale (11/10/2026).
    map[p].raccolta += c.costi.raccolta;
    map[p].stoccaggio += c.costi.stoccaggio;
    map[p].trattamento += c.costi.trattamento;
    map[p].pulizia += Number(r.costo_pulizia || 0);
    map[p].trasporto += Number(r.costo_trasporto_viaggio || 0);
    map[p].sovracosto_raccoglitore += Number(r.sovracosto_pagato_raccoglitore || 0);
    map[p].sovracosto_impianto += Number(r.sovracosto_pagato_impianto || 0);
    map[p].costo_totale += c.costo_totale;
    map[p].ricavi += c.ricavo;
    map[p].margine += c.margine;
  }
  return map;
}
