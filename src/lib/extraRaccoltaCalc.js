// Calcoli condivisi per Extra Raccolta — usato sia dalla pagina sia dall'esportazione.
// Nessun valore viene memorizzato nell'entità: tutto è ricalcolato dai campi di input.
// Import relativo con l'estensione: cosi' lo legge anche la prova in node.
import { giornoRoma, oggiRoma } from './giornoItaliano.js';
import {
  TARIFFA_BASE_EXTRA_RACCOLTA, tariffaBaseExtraRaccolta, prezzoAttivoExtra as prezzoAttivoComune,
  sortTariffe, tariffeAttiveValide, servizioEcotyre, eSecondariaExtra, avvisoPesoMancante,
  arrotondaAlCentesimo,
} from './ecotyreTariffe.js';
import { tariffaValeIl, tariffaNonDisattivata } from './validitaTariffa.js';
import { normalizzaRagioneSociale } from './normalizzaRagioneSocialeClient.js';
import { PROV_TO_REGION } from './regioneMap.js';
import { surplusDelMovimento, surplusNonDisattivati, importoSurplus, etichettaSurplus, euroTDi, NOMI_ORIGINE } from './surplus.js';

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
 *
 * IL SURPLUS SULLE TARIFFE (13/10/2026). Il Fuel Surcharge del consorzio
 * Ecotyre, +5 €/t dal 01/10/2026 al 31/12/2026, vale anche sull'extra raccolta:
 * SMOCO lo fattura a Ecotyre e lo paga ai raccoglitori, con la sua riga e mai
 * sommato a rete e ACI. Perche' la pagina dica lo stesso ricavo della fattura e
 * lo stesso costo della passiva, il contesto porta anche:
 * - `surplus`: i record di SurplusTariffa letti tutti (il disattivato si toglie
 *   qui, come per le tariffe); di questi contano solo quelli dell'extra raccolta;
 * - `fornitori`: l'anagrafica intera, non solo quelli con la spunta della
 *   dicitura, perche' un fornitore interno (SMOCO) il surplus non lo riceve e un
 *   elenco «solo questi fornitori» si riconosce anche per id;
 * - `subfornitori`: il modulo src/lib/subfornitori.js ({ mappaFatturazione,
 *   fatturaA }), la catena di chi fattura per chi. Il surplus delle tonnellate di
 *   un subraccoglitore si paga al principale, come la tariffa. Arriva da chi
 *   chiama perche' subfornitori.js importa con l'alias delle pagine, che le prove
 *   in node non sanno leggere; senza, ognuno fattura per se'.
 * Senza i tre argomenti nuovi il contesto e' quello di prima e i numeri pure.
 *
 * LE TARIFFE DEI TRASPORTI (13/10/2026). Una secondaria di extra raccolta si
 * paga come un trasporto di secondaria, con la tariffa della tratta nel
 * contratto del vettore (decisione dell'utente del 13/10/2026, vedi
 * trasportoIntervento). `tariffePassive` sono le tariffe passive lette da chi
 * chiama (tutte, o le sole TRASPORTO_SECONDARIA): qui restano quelle dei
 * trasporti non disattivate. Senza, `trasporti` e' null: il contratto non e'
 * stato letto, e una secondaria resta col prezzo scritto sull'intervento, con
 * `trasporto.non_letto` vero perche' chi mostra il costo lo possa dire.
 * I viaggi delle secondarie (a viaggio lo stesso camion si paga una volta) li
 * aggiunge conViaggi, con l'elenco degli interventi che chi chiama ha gia' letto.
 */
export function contestoPrezzi(tariffeAttive = [], fornitori = [], surplus = [], subfornitori = null, tariffePassive = null) {
  return {
    tariffe: sortTariffe(tariffeAttiveValide(tariffeAttive || [])),
    servizio: servizioEcotyre(fornitori || []),
    surplus: surplusNonDisattivati(surplus || []).filter(s => canaleDi(s) === 'EXTRA_RACCOLTA'),
    anagrafica: anagraficaSurplus(fornitori || [], subfornitori),
    trasporti: Array.isArray(tariffePassive)
      ? tariffePassive.filter(t => t && t.prestazione === 'TRASPORTO_SECONDARIA' && String(t.direzione || 'PASSIVA').toUpperCase() === 'PASSIVA' && tariffaNonDisattivata(t))
      : null,
  };
}

// Il canale scritto in un modo solo, come in surplus.js: «EXTRA RACCOLTA» e
// «EXTRA_RACCOLTA» sono lo stesso canale.
const canaleDi = (s) => String((s && s.tipologia) || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

/**
 * Chi e' chi nell'anagrafica, per il surplus, con le regole dei due calcoli che
 * la pagina deve ridire, che non leggono la stessa anagrafica:
 * - la passiva (calcolaPassiva) legge i soli fornitori attivi: da quelli vengono
 *   chi e' interno, l'id di chi fattura (l'ultimo con quel nome, come
 *   fornitoreByNorm) e la catena dei subfornitori;
 * - l'attiva (elaboraFatturazioneAttiva) li legge tutti: da tutti vengono l'id
 *   per un elenco (il primo con quel nome, come idPerChiave) e la catena.
 */
function anagraficaSurplus(fornitori, subfornitori) {
  const attivi = (fornitori || []).filter(f => f && f.stato === 'attivo');
  const catena = (elenco) => {
    const s = subfornitori;
    const mappa = s && typeof s.mappaFatturazione === 'function' && typeof s.fatturaA === 'function' ? s.mappaFatturazione(elenco) : null;
    return (nome) => {
      const originale = String(nome || '').trim();
      const f = mappa && originale ? s.fatturaA(mappa, originale) : null;
      if (f && f.chiave) return { nome: String(f.nome || originale).trim(), chiave: f.chiave };
      return { nome: originale, chiave: normalizzaRagioneSociale(originale) };
    };
  };
  const perChiave = new Map();
  for (const f of attivi) {
    const k = normalizzaRagioneSociale(f.ragione_sociale);
    if (k) perChiave.set(k, f);
  }
  const idPrimo = new Map();
  for (const f of fornitori || []) {
    const k = normalizzaRagioneSociale(f && f.ragione_sociale);
    if (k && f.id && !idPrimo.has(k)) idPrimo.set(k, String(f.id));
  }
  return {
    passiva: {
      fattura: catena(attivi),
      interno: (nome) => { const f = perChiave.get(normalizzaRagioneSociale(nome)); return !!(f && f.interno === true); },
      idDi: (chiave) => String((perChiave.get(chiave) || {}).id || ''),
    },
    attiva: { fattura: catena(fornitori || []), idPrimo },
  };
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
 * L'ANNO DEI FILE DELL'ELENCO (prova del cambio d'anno, 15/10/2026). La pagina si
 * apre con l'anno su «Tutti», e i file prendevano l'anno di oggi: il 10/02/2027
 * il dicembre 2026, scelto il solo mese, usciva «Dicembre 2027» nel nome, nel
 * foglio e nell'intestazione, e dal 2028 lo stesso file avrebbe messo insieme i
 * dicembre di due anni. Ora l'anno del documento e' quello dei movimenti:
 * - l'anno scelto, se c'e';
 * - con «Tutti», l'anno degli interventi esportati (fine trasporto, giorno
 *   italiano) se e' uno solo; senza interventi, quello di oggi, come prima;
 * - interventi di piu' anni con un mese scelto: non si esporta, si chiede
 *   l'anno (chiedi, la frase per la pagina): un mese e' di un anno solo;
 * - interventi di piu' anni senza mese: anno null, il documento dice «tutti
 *   gli anni».
 * -> { anno: numero | null, anni: [...], chiedi: '' | frase }
 */
export function annoDelDocumento({ anno = '', mese = '', interventi = [], oggi = '' } = {}) {
  if (anno) return { anno: Number(anno), anni: [Number(anno)], chiedi: '' };
  const anni = [...new Set((interventi || []).map(annoIntervento).filter(a => a !== null))].sort((a, b) => a - b);
  if (anni.length === 1) return { anno: anni[0], anni, chiedi: '' };
  if (!anni.length) return { anno: Number(String(oggi || oggiRoma()).slice(0, 4)), anni, chiedi: '' };
  if (mese) {
    return { anno: null, anni, chiedi: `Gli interventi di ${String(mese).toLowerCase()} sono di più anni (${anni.slice(0, -1).join(', ')} e ${anni[anni.length - 1]}): scegli l'anno per esportarli, un documento per anno.` };
  }
  return { anno: null, anni, chiedi: '' };
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

// A CHI VA UN SURPLUS, A PAROLE (13/10/2026): il Fuel Surcharge e' della
// raccolta, e va ai raccoglitori, mai ai produttori («il fuel surcharge non
// riguarda i produttori ma i trasportatori ovvero i raccoglitori», l'utente).
// Il titolo del blocco del surplus nei file dell'elenco e nella nota della
// pagina accanto ai pulsanti: «Fuel Surcharge ai raccoglitori». Un surplus
// senza prestazione (solo da Ecotyre) si guarda sulla raccolta di ciascun
// raccoglitore.
const AI_CHI_SURPLUS = { RACCOLTA: 'ai raccoglitori', TRATTAMENTO: 'agli impianti', CONFERIMENTO_STOCCAGGIO: 'agli stoccaggi', TRASPORTO_SECONDARIA: 'ai trasportatori delle secondarie' };
export const aiChiSurplus = (prestazione) => AI_CHI_SURPLUS[prestazione] || 'ai raccoglitori';
export const titoloSurplus = (nome, prestazione) => `${nome} ${AI_CHI_SURPLUS[prestazione] || 'sulla raccolta dei raccoglitori'}`;

/** Un terminato senza peso effettivo: si segnala, e la quantita' ritirata non lo sostituisce. */
export const senzaPesoEffettivo = (r) => !(Number(r && r.peso_effettivo) > 0);
export { avvisoPesoMancante };

// ─── IL TRASPORTO: UNA SECONDARIA E' UN TRASPORTO DI SECONDARIA (13/10/2026) ───
// Decisione dell'utente del 13/10/2026: «le eventuali secondarie di extra
// raccolta saranno trattate come normali trasporti di secondaria con il loro
// €\t oppure €\viaggio a seconda del tragitto e dei contratti». Qui la stessa
// regola della passiva (tariffaTrasportoExtra e trasportoInterventoExtra in
// base44/shared/passivaCalcolo.ts), perche' pagina, scheda e foglio
// dell'amministrazione dicano il costo che la passiva paga:
// prove/extraRaccoltaSecondarie.mjs confronta i due conti caso per caso.
// - la tariffa TRASPORTO_SECONDARIA del vettore (chi fattura, dopo la catena
//   dei subfornitori) per la tratta, dallo stoccaggio alla destinazione, valida
//   nel giorno italiano della fine del trasporto: prima una tariffa scritta per
//   l'extra raccolta, poi quella «TUTTE» del contratto del vettore;
// - a tonnellata sui chili dell'intervento, a viaggio una volta per viaggio: un
//   camion in un giorno, che puo' portare piu' interventi (qui sotto);
// - senza contratto, il prezzo a viaggio scritto sull'intervento.
// Una primaria paga il suo trasporto a viaggio scritto sull'intervento, come
// sempre.
const UNITA_TRASPORTO = { '€/t': (kg, v) => (kg / 1000) * v, '€/kg': (kg, v) => kg * v, '€/viaggio': (_kg, v) => v };

// ─── LO STESSO VIAGGIO SI PAGA UNA VOLTA (revisione del 14/10/2026) ───
// Un viaggio e' un camion in un giorno, anche nell'extra raccolta: due
// secondarie sullo stesso automezzo, lo stesso giorno italiano, sulla stessa
// tratta e con lo stesso vettore (chi fattura) - per esempio due formulari
// divisi per classe - sono UN viaggio. A viaggio il prezzo del contratto si
// paga una volta sola e si divide fra gli interventi in proporzione ai chili,
// come il viaggio misto fra rete e ACI (regola dell'utente del 22/09/2026); a
// tonnellata ognuno paga i suoi chili. Prima ogni intervento pagava il viaggio
// intero: due formulari dello stesso camion a 400 €/viaggio facevano 800 €.
// Senza targa gli interventi dello stesso giorno sulla stessa tratta contano
// come un viaggio solo. Il prezzo scritto a mano sull'intervento resta di
// quell'intervento. E' la regola della passiva (chiaveViaggioExtra,
// quoteDelViaggio e trasportoInterventoExtra in base44/shared/passivaCalcolo.ts),
// scritta due volte perche' questo file lo leggono le pagine:
// prove/extraRaccoltaSecondarie.mjs le confronta.
const chiaveViaggio = (r) => `${giornoRoma(r && r.trasporto_finito_il)}|${String((r && r.automezzo) || '').toUpperCase().replace(/[^A-Z0-9]/g, '')}`;

/** Il viaggio di una secondaria: vettore, tratta, giorno italiano e targa. */
export function chiaveViaggioExtra(r, trasKey) {
  return `${trasKey}|${normalizzaRagioneSociale(r && r.stoccaggio)}|${normalizzaRagioneSociale(r && r.destinazione)}|${chiaveViaggio(r)}`;
}

/** Chi e' un intervento fra quelli dello stesso viaggio, per l'ordine delle quote. */
export function chiaveInterventoExtra(r) {
  return `${String((r && r.id) || '')}|${String((r && r.numero_fir) || '')}|${String((r && r.id_ordine) || '')}`;
}

/**
 * Le quote di un prezzo a viaggio fra gli interventi dello stesso viaggio, al
 * centesimo: in proporzione ai chili (senza chili, in parti uguali); l'ultimo,
 * nell'ordine di `chiave`, prende la differenza, cosi' la somma e' il prezzo.
 * membri: [{ chiave, kg }] -> Map(chiave -> euro)
 */
export function quoteDelViaggio(valore, membri) {
  const ordinati = [...(membri || [])].sort((a, b) => (a.chiave < b.chiave ? -1 : a.chiave > b.chiave ? 1 : 0));
  const kgDi = (m) => (Number(m.kg) > 0 ? Number(m.kg) : 0);
  const kgViaggio = ordinati.reduce((s, m) => s + kgDi(m), 0);
  const quote = new Map();
  let date = 0;
  ordinati.forEach((m, i) => {
    if (i === ordinati.length - 1) { quote.set(m.chiave, arrotondaAlCentesimo(valore - date)); return; }
    const parte = kgViaggio > 0 ? kgDi(m) / kgViaggio : 1 / ordinati.length;
    const euro = arrotondaAlCentesimo(valore * parte);
    date += euro;
    quote.set(m.chiave, euro);
  });
  return quote;
}

/**
 * Il contesto con i viaggi delle secondarie: gli interventi terminati, con la
 * fine del trasporto, raggruppati per viaggio (chiaveViaggioExtra), come li
 * raggruppa la passiva. Chi mostra il costo di un intervento lo chiama una
 * volta con l'elenco che ha gia' letto (la pagina con tutti gli interventi, il
 * foglio dell'amministrazione con quelli del mese): nessuna lettura in piu'.
 * Senza, ogni intervento e' un viaggio a se'.
 */
export function conViaggi(contesto, interventi) {
  const c = contesto || CONTESTO_VUOTO;
  const p = (c.anagrafica || ANAGRAFICA_VUOTA).passiva;
  const viaggi = new Map();
  for (const r of interventi || []) {
    if (!r || !eSecondariaExtra(r) || String(r.stato || '').toLowerCase().trim() !== 'terminato') continue;
    if (!giornoRoma(r.trasporto_finito_il)) continue;
    const trasportatore = String(r.trasportatore || '').trim();
    if (!trasportatore) continue;
    const k = chiaveViaggioExtra(r, p.fattura(trasportatore).chiave);
    if (!viaggi.has(k)) viaggi.set(k, []);
    viaggi.get(k).push(r);
  }
  return { ...c, viaggi };
}

// Gli interventi del viaggio di `r`, lui compreso con i suoi valori di adesso
// (la scheda puo' averli appena cambiati): quelli del contesto con lo stesso
// viaggio, tolto lui stesso.
function membriDelViaggio(r, c, trasKey) {
  if (!(c.viaggi instanceof Map)) return [r];
  const stesso = (x) => x === r || (!!(x && x.id) && !!(r && r.id) && String(x.id) === String(r.id));
  return [...(c.viaggi.get(chiaveViaggioExtra(r, trasKey)) || []).filter(x => !stesso(x)), r];
}

/** La tariffa della tratta nel contratto del vettore, o null. */
export function tariffaTrasportoExtra(tariffe, trasKey, stoccaggio, destinazione, quando) {
  const prodKey = normalizzaRagioneSociale(stoccaggio);
  const destKey = normalizzaRagioneSociale(destinazione);
  if (!trasKey || !prodKey || !destKey) return null;
  for (const tip of ['EXTRA_RACCOLTA', 'TUTTE']) {
    const trovata = (tariffe || []).find(t =>
      t && t.prestazione === 'TRASPORTO_SECONDARIA'
      && String(t.direzione || 'PASSIVA').toUpperCase() === 'PASSIVA'
      && tariffaNonDisattivata(t)
      && normalizzaRagioneSociale(t.fornitore_nome) === trasKey
      && t.tipologia === tip
      && tariffaValeIl(t, quando)
      && normalizzaRagioneSociale(t.produttore) === prodKey
      && normalizzaRagioneSociale(t.destinatario) === destKey);
    if (trovata) return trovata;
  }
  return null;
}

/**
 * Il trasporto di un intervento: quanto si paga al vettore e da dove viene il
 * prezzo.
 * -> { origine: 'contratto' | 'intervento' | '', tariffa, valore, unita_misura,
 *      importo (al centesimo), scritto, fornitore, interno, sconosciuta, non_letto,
 *      viaggio }
 * `non_letto`: una secondaria con un contesto che le tariffe dei trasporti non
 * le ha (contestoPrezzi senza il quinto argomento): il prezzo e' quello scritto,
 * ma il contratto potrebbe dirne un altro. Il contratto di un vettore interno
 * non si paga, come in passiva: a se stessa SMOCO non fattura.
 * `viaggio`: null, oppure, per un contratto a viaggio con altri interventi sullo
 * stesso viaggio (conViaggi), { interventi, altri, kg, kg_viaggio,
 * prezzo_viaggio, quota, giorno, targa }: l'importo e' la quota dell'intervento.
 */
export function trasportoIntervento(r, contesto = CONTESTO_VUOTO) {
  const c = contesto || CONTESTO_VUOTO;
  const scritto = Number(r && r.costo_trasporto_viaggio) > 0 ? Number(r.costo_trasporto_viaggio) : 0;
  const daScritto = { origine: scritto > 0 ? 'intervento' : '', tariffa: null, valore: scritto, unita_misura: '€/viaggio', importo: arrotondaAlCentesimo(scritto), scritto, fornitore: '', interno: false, sconosciuta: false, non_letto: false, viaggio: null };
  if (!eSecondariaExtra(r)) return daScritto;
  const trasportatore = String((r && r.trasportatore) || '').trim();
  const p = (c.anagrafica || ANAGRAFICA_VUOTA).passiva;
  const f = trasportatore ? p.fattura(trasportatore) : { nome: '', chiave: '' };
  const interno = !!trasportatore && p.interno(f.nome);
  const scrittoQui = { ...daScritto, fornitore: f.nome, interno, ...(interno ? { importo: 0 } : {}) };
  if (!Array.isArray(c.trasporti)) return { ...scrittoQui, non_letto: true };
  const tariffa = tariffaTrasportoExtra(c.trasporti, f.chiave, r.stoccaggio, r.destinazione, r.trasporto_finito_il);
  if (!tariffa) return scrittoQui;
  const unita = String(tariffa.unita_misura || '').trim();
  const valore = Number(tariffa.valore) || 0;
  const calcolo = UNITA_TRASPORTO[unita];
  const kg = Number(r.peso_effettivo) > 0 ? Number(r.peso_effettivo) : 0;
  let importo = interno || !calcolo ? 0 : arrotondaAlCentesimo(calcolo(kg, valore));
  let viaggio = null;
  const membri = calcolo && unita === '€/viaggio' ? membriDelViaggio(r, c, f.chiave) : [r];
  if (membri.length > 1) {
    // Lo stesso viaggio di altri interventi: si paga una volta, diviso per peso.
    const quota = quoteDelViaggio(valore, membri.map(x => ({ chiave: chiaveInterventoExtra(x), kg: Number(x && x.peso_effettivo) || 0 }))).get(chiaveInterventoExtra(r)) ?? 0;
    if (!interno) importo = quota;
    viaggio = {
      interventi: membri.length,
      altri: membri.filter(x => x !== r).sort((a, b) => chiaveInterventoExtra(a).localeCompare(chiaveInterventoExtra(b))).map(x => String((x && (x.numero_fir || x.id_ordine)) || '—')),
      kg,
      kg_viaggio: membri.reduce((s, x) => s + (Number(x && x.peso_effettivo) > 0 ? Number(x.peso_effettivo) : 0), 0),
      prezzo_viaggio: valore,
      quota: valore ? quota / valore : 0,
      giorno: giornoRoma(r.trasporto_finito_il),
      targa: String(r.automezzo || '').trim(),
    };
  }
  return {
    origine: 'contratto', tariffa, valore, unita_misura: unita,
    importo,
    scritto, fornitore: f.nome, interno, sconosciuta: !calcolo, non_letto: false, viaggio,
  };
}

const r2 = (v) => Math.round(v * 100) / 100;

// ─── IL SURPLUS SULLE TARIFFE (13/10/2026) ───
// Richiesta dell'utente del 12/10/2026: «una riga con l'importo standard ed una
// per il surplus (sempre riferito alle stesse tonnellate raccolte o trattate nel
// mese)», in attiva come in passiva. La fattura (attivaCalcolo.ts) e la passiva
// (passivaCalcolo.ts) lo calcolano sul MESE: l'attiva una riga per surplus sui
// chili fatturati del canale, la passiva una riga per fornitore e per surplus
// sui suoi chili, ciascuna arrotondata una volta al centesimo (importoSurplus).
// La pagina invece lavora per intervento. Qui ci sono le due cose:
// - surplusIntervento: la QUOTA di un intervento, per la scheda e per la riga
//   dell'elenco, con le stesse regole dei due calcoli (quando vale, a chi, su
//   quali chili);
// - surplusDelMese: il conto col centesimo che fa fede, quello del mese, raggruppato
//   come lo raggruppano fattura e passiva. Con piu' interventi nello stesso mese
//   la somma delle quote puo' scostarsi di qualche centesimo: i totali della
//   pagina usano il mese, e la pagina dice lo scarto quando c'e'.

// Il campo del costo di ogni prestazione su un intervento, come in passivaCalcolo.
const CAMPO_COSTO = { TRATTAMENTO: 'costo_trattamento_t', CONFERIMENTO_STOCCAGGIO: 'costo_stoccaggio_t' };
// La prestazione che si paga alla destinazione, dal suo tipo: impianto o stoccaggio.
const prestazioneDaTipo = (tipo) => {
  const t = String(tipo || '').toLowerCase().trim();
  return t === 'imp' ? 'TRATTAMENTO' : t === 'stoc' ? 'CONFERIMENTO_STOCCAGGIO' : '';
};
const eTerminatoExtra = (r) => String((r && r.stato) || '').toLowerCase().trim() === 'terminato';
// Lo stesso surplus nei due calcoli: l'id del record, o nome, inizio e importo
// per uno senza id (come la chiave dell'attiva).
const chiaveSurplus = (s, euroT) => String((s && s.id) || '') || `${s && s.nome}|${s && s.data_inizio_validita}|${euroT}`;
const ANAGRAFICA_VUOTA = anagraficaSurplus([], null);

// La voce di un surplus su un intervento, nella forma che leggono pagina e scheda.
function voceSurplus(s, euroT, kg, altro = {}) {
  return {
    chiave: chiaveSurplus(s, euroT),
    surplus_id: String(s.id || ''),
    nome: String(s.nome || '').trim() || 'Surplus',
    origine: NOMI_ORIGINE[String(s.origine || '').trim().toUpperCase()] || '',
    riferimento: String(s.riferimento || '').trim(),
    prestazione: String(s.prestazione || '').trim().toUpperCase().replace(/[\s-]+/g, '_'),
    a_chi: String(s.a_chi || 'tutti').trim().toLowerCase() === 'elenco' ? 'elenco' : 'tutti',
    euro_t: euroT,
    euro_t_attiva: euroTDi(s, 'ATTIVA'),
    euro_t_passiva: euroTDi(s, 'PASSIVA'),
    kg,
    dal: String(s.data_inizio_validita || '').slice(0, 10),
    al: String(s.data_fine_validita || '').slice(0, 10),
    etichetta: etichettaSurplus(s),
    ...altro,
  };
}

/**
 * I surplus di un intervento, come la quota che gli tocca.
 *
 * -> { attivo: [voce + importo], passivo: [voce + importo, fornitore, fornitore_chiave, interno] }
 *
 * ATTIVO, come attivaCalcolo.ts: sui chili che si fatturano a Ecotyre (un
 * intervento primario col peso effettivo; una secondaria no), nel giorno
 * italiano della fine del trasporto, per ogni surplus dell'extra raccolta con
 * l'importo da Ecotyre. «Tutti» vale su tutto il canale, anche sui chili
 * raccolti da SMOCO (D2: quel surplus resta a SMOCO); un elenco guarda il
 * raccoglitore per la raccolta e la destinazione per trattamento e stoccaggio.
 *
 * PASSIVO, come passivaCalcolo.ts: la raccolta al raccoglitore (chi fattura per
 * lui, dopo la catena dei subfornitori) sugli interventi primari; il trattamento
 * o lo stoccaggio alla destinazione, su tutto quello che arriva (anche le
 * secondarie), con la seconda prestazione quando sull'intervento c'e' anche
 * l'altro costo; il trasporto delle secondarie a chi le trasporta, solo se il
 * viaggio ha un costo. Un fornitore interno non lo riceve: la voce resta, con
 * importo zero e interno vero, perche' la pagina possa dire «al raccoglitore
 * niente».
 *
 * L'importo di ogni voce e' la quota dell'intervento, arrotondata da sola: il
 * centesimo che fa fede e' quello di surplusDelMese.
 */
export function surplusIntervento(r, contesto = CONTESTO_VUOTO) {
  const c = contesto || CONTESTO_VUOTO;
  const elenco = c.surplus || [];
  const vuoto = { attivo: [], passivo: [] };
  if (!r || !elenco.length) return vuoto;
  const quando = r.trasporto_finito_il;
  if (!giornoRoma(quando)) return vuoto;
  const kg = Number(r.peso_effettivo) > 0 ? Number(r.peso_effettivo) : 0;
  if (!kg) return vuoto;
  const a = c.anagrafica || ANAGRAFICA_VUOTA;
  const secondaria = eSecondariaExtra(r);
  const canale = 'EXTRA_RACCOLTA';
  const trasportatore = String(r.trasportatore || '').trim();
  const destinazione = String(r.destinazione || '').trim();

  // L'attiva riconosce un fornitore dell'elenco per id o per nome: chi e' scritto
  // sull'intervento e chi fattura per lui.
  const perAttiva = (nome) => {
    const originale = String(nome || '').trim();
    if (!originale) return { id: '', nomi: [] };
    const f = a.attiva.fattura(originale);
    return {
      id: a.attiva.idPrimo.get(f.chiave) || a.attiva.idPrimo.get(normalizzaRagioneSociale(originale)) || '',
      nomi: [...new Set([originale, f.nome].filter(Boolean))],
    };
  };
  const p = a.passiva;
  // A CHI VA, ANCHE NELL'ATTIVO (13/10/2026). Il surplus da Ecotyre non e' del
  // produttore: l'utente, il 13/10/2026, «il fuel surcharge non riguarda i
  // produttori ma i trasportatori ovvero i raccoglitori, su questo non ci devono
  // essere confusioni». Ogni quota attiva porta quindi il fornitore a cui il
  // surplus e' dovuto, con la regola dell'elenco: il raccoglitore (chi fattura
  // per lui, come in passiva) per la raccolta e per un surplus senza
  // prestazione, la destinazione per trattamento e stoccaggio. Il file
  // dell'elenco lo usa per il blocco «Fuel Surcharge ai raccoglitori».
  const raccoglitoreDi = trasportatore ? p.fattura(trasportatore) : { nome: '', chiave: '' };
  const aChiVa = (s) => (['TRATTAMENTO', 'CONFERIMENTO_STOCCAGGIO'].includes(String(s.prestazione || '').trim().toUpperCase().replace(/[\s-]+/g, '_'))
    ? { fornitore: destinazione, fornitore_chiave: normalizzaRagioneSociale(destinazione), sul_movimento: destinazione }
    : { fornitore: raccoglitoreDi.nome, fornitore_chiave: raccoglitoreDi.chiave, sul_movimento: trasportatore });
  const attivo = [];
  if (!secondaria) {
    const raccoglitore = perAttiva(trasportatore);
    const impianto = perAttiva(destinazione);
    const validi = surplusDelMovimento(elenco, {
      tipologia: canale, prestazione: '', quando,
      fornitore: raccoglitore,
      fornitori: { RACCOLTA: raccoglitore, TRATTAMENTO: impianto, CONFERIMENTO_STOCCAGGIO: impianto },
    }, 'ATTIVA');
    for (const { surplus: s, euro_t } of validi) attivo.push(voceSurplus(s, euro_t, kg, { importo: importoSurplus(kg, euro_t), ...aChiVa(s) }));
  }

  const passivo = [];
  const paga = (prestazione, fornitore, chiave, nomi, interno, sulMovimento) => {
    const validi = surplusDelMovimento(elenco, { tipologia: canale, prestazione, quando, fornitore: { id: p.idDi(chiave), nomi } }, 'PASSIVA');
    for (const { surplus: s, euro_t } of validi) {
      passivo.push(voceSurplus(s, euro_t, kg, {
        prestazione, fornitore, fornitore_chiave: chiave, interno, sul_movimento: sulMovimento,
        importo: interno ? 0 : importoSurplus(kg, euro_t),
      }));
    }
  };
  // la raccolta: solo gli interventi primari, perche' una secondaria e' un
  // trasferimento da uno stoccaggio, non una raccolta
  if (trasportatore && !secondaria) {
    const f = raccoglitoreDi;
    paga('RACCOLTA', f.nome, f.chiave, [f.nome, trasportatore], p.interno(f.nome), trasportatore);
  }
  // il trattamento o lo stoccaggio, alla destinazione
  const principale = prestazioneDaTipo(r.tipo_destinazione);
  if (principale && destinazione) {
    const chiave = normalizzaRagioneSociale(destinazione);
    const altra = principale === 'TRATTAMENTO' ? 'CONFERIMENTO_STOCCAGGIO' : 'TRATTAMENTO';
    const prestazioni = Number(r[CAMPO_COSTO[altra]] || 0) > 0 ? [principale, altra] : [principale];
    for (const prestazione of prestazioni) paga(prestazione, destinazione, chiave, [destinazione], p.interno(destinazione), destinazione);
  }
  // il trasporto delle secondarie, se il viaggio si paga: col contratto della
  // tratta o col prezzo scritto, come in passiva (13/10/2026)
  if (secondaria && trasportatore && trasportoIntervento(r, c).origine) {
    const f = raccoglitoreDi;
    paga('TRASPORTO_SECONDARIA', f.nome, f.chiave, [f.nome, trasportatore], p.interno(f.nome), trasportatore);
  }
  return { attivo, passivo };
}

/**
 * IL CENTESIMO CHE FA FEDE E' QUELLO DEL MESE. Il surplus di un elenco di
 * interventi raggruppato come lo raggruppano la fattura e la passiva: per mese
 * (il giorno italiano della fine del trasporto, solo i terminati) e per surplus
 * l'attivo; per mese, surplus e fornitore che fattura il passivo. Ogni gruppo si
 * arrotonda una volta: importoSurplus(chili del gruppo, €/t).
 *
 * -> { attivo: [{ mese, ...voce, kg, importo, quote, interventi }],
 *      passivo: [{ mese, ...voce, fornitore, kg, importo, quote, interventi }],
 *      interni: [{ mese, ...voce, fornitore, kg, interventi }],
 *      per_surplus: [{ chiave, nome, origine, etichetta, euro_t_attiva, euro_t_passiva,
 *                      kg_attivo, attivo, quote_attivo, kg_passivo, passivo, quote_passivo,
 *                      fornitori: [{ fornitore, kg, importo }], interni: [{ fornitore, kg }] }],
 *      totale_attivo, totale_passivo, quote_attivo, quote_passivo }
 * quote_* e' la somma delle quote dei singoli interventi: se differisce dal
 * totale, la differenza e' l'arrotondamento, e il totale e' quello giusto.
 */
export function surplusDelMese(interventi, contesto = CONTESTO_VUOTO) {
  const attivi = new Map();
  const passivi = new Map();
  // A chi va (13/10/2026): per mese, surplus e fornitore che lo riceve, i chili
  // della parte da Ecotyre e quelli della parte ai fornitori (per_fornitore).
  const aChi = new Map();
  const diChi = (mese, v) => {
    const k = `${mese}|${v.chiave}|${v.fornitore_chiave || ''}`;
    if (!aChi.has(k)) {
      const { fornitore, fornitore_chiave, sul_movimento: _s, importo: _i, kg: _k, interno: _n, ...voce } = v;
      aChi.set(k, { ...voce, mese, fornitore: fornitore || '', fornitore_chiave: fornitore_chiave || '', sul_movimento: new Set(), kg_attivo: 0, kg_passivo: 0, interno: false, interventi: new Set() });
    }
    return aChi.get(k);
  };
  for (const r of interventi || []) {
    if (!eTerminatoExtra(r)) continue;
    const giorno = giornoRoma(r.trasporto_finito_il);
    if (!giorno) continue;
    const mese = giorno.slice(0, 7);
    const s = surplusIntervento(r, contesto);
    const idIntervento = String(r.id || r.numero_fir || r.id_ordine || '');
    for (const v of s.attivo) {
      const k = `${mese}|${v.chiave}`;
      const { fornitore: _f, fornitore_chiave: _fc, sul_movimento: _sm, ...voce } = v;
      const acc = attivi.get(k) || { ...voce, mese, kg: 0, quote: 0, interventi: 0 };
      acc.kg += v.kg; acc.quote += v.importo; acc.interventi++;
      attivi.set(k, acc);
      const chi = diChi(mese, v);
      chi.kg_attivo += v.kg;
      if (v.sul_movimento) chi.sul_movimento.add(v.sul_movimento);
      chi.interventi.add(idIntervento);
    }
    for (const v of s.passivo) {
      const k = `${mese}|${v.chiave}|${v.fornitore_chiave}`;
      const { sul_movimento: _sm, ...voce } = v;
      const acc = passivi.get(k) || { ...voce, mese, kg: 0, quote: 0, interventi: 0 };
      acc.kg += v.kg; acc.quote += v.importo; acc.interventi++;
      passivi.set(k, acc);
      const chi = diChi(mese, v);
      chi.kg_passivo += v.kg;
      chi.interno = chi.interno || !!v.interno;
      if (v.sul_movimento) chi.sul_movimento.add(v.sul_movimento);
      chi.interventi.add(idIntervento);
    }
  }
  const ordine = (x, y) => x.mese.localeCompare(y.mese) || x.nome.localeCompare(y.nome, 'it') || x.dal.localeCompare(y.dal)
    || String(x.fornitore || '').localeCompare(String(y.fornitore || ''), 'it');
  // L'attiva arrotonda i chili al grammo prima del prezzo, la passiva no: si
  // rifanno uguali (sui chili interi, che sono quelli dei formulari, e' lo stesso).
  const attivo = [...attivi.values()].filter(v => v.kg > 0)
    .map(({ importo: _q, ...v }) => ({ ...v, importo: importoSurplus(Math.round(v.kg * 1000) / 1000, v.euro_t), quote: arrotondaAlCentesimo(v.quote) }))
    .sort(ordine);
  const tutti = [...passivi.values()].filter(v => v.kg > 0)
    .map(({ importo: _q, ...v }) => ({ ...v, importo: v.interno ? 0 : importoSurplus(v.kg, v.euro_t), quote: arrotondaAlCentesimo(v.quote) }))
    .sort(ordine);
  const passivo = tutti.filter(v => !v.interno);
  const interni = tutti.filter(v => v.interno).map(({ importo: _i, quote: _q, ...v }) => v);
  const somma = (elenco, campo) => arrotondaAlCentesimo(elenco.reduce((x, v) => x + (Number(v[campo]) || 0), 0));

  // Per la fascia della pagina: un surplus alla volta, mesi insieme.
  const perSurplus = new Map();
  const di = (v) => {
    if (!perSurplus.has(v.chiave)) {
      perSurplus.set(v.chiave, {
        chiave: v.chiave, surplus_id: v.surplus_id, nome: v.nome, origine: v.origine, riferimento: v.riferimento,
        prestazione: v.prestazione, a_chi: v.a_chi, etichetta: v.etichetta, dal: v.dal, al: v.al,
        euro_t_attiva: v.euro_t_attiva, euro_t_passiva: v.euro_t_passiva,
        kg_attivo: 0, attivo: 0, quote_attivo: 0, kg_passivo: 0, passivo: 0, quote_passivo: 0,
        fornitori: new Map(), interni: new Map(),
      });
    }
    return perSurplus.get(v.chiave);
  };
  for (const v of attivo) { const p = di(v); p.kg_attivo += v.kg; p.attivo += v.importo; p.quote_attivo += v.quote; }
  for (const v of passivo) {
    const p = di(v);
    p.kg_passivo += v.kg; p.passivo += v.importo; p.quote_passivo += v.quote;
    const f = p.fornitori.get(v.fornitore_chiave) || { fornitore: v.fornitore, kg: 0, importo: 0 };
    f.kg += v.kg; f.importo += v.importo;
    p.fornitori.set(v.fornitore_chiave, f);
  }
  for (const v of interni) {
    const p = di(v);
    const f = p.interni.get(v.fornitore_chiave) || { fornitore: v.fornitore, kg: 0 };
    f.kg += v.kg;
    p.interni.set(v.fornitore_chiave, f);
  }
  const per_surplus = [...perSurplus.values()].map(p => ({
    ...p,
    attivo: arrotondaAlCentesimo(p.attivo), quote_attivo: arrotondaAlCentesimo(p.quote_attivo),
    passivo: arrotondaAlCentesimo(p.passivo), quote_passivo: arrotondaAlCentesimo(p.quote_passivo),
    fornitori: [...p.fornitori.values()].map(f => ({ ...f, importo: arrotondaAlCentesimo(f.importo) }))
      .sort((x, y) => y.kg - x.kg || x.fornitore.localeCompare(y.fornitore, 'it')),
    interni: [...p.interni.values()].sort((x, y) => y.kg - x.kg || x.fornitore.localeCompare(y.fornitore, 'it')),
  })).sort((x, y) => x.nome.localeCompare(y.nome, 'it') || x.dal.localeCompare(y.dal));

  // A CHI VA (13/10/2026): una riga per mese, surplus e fornitore che lo riceve -
  // il raccoglitore per il Fuel Surcharge, mai il produttore - con la parte da
  // Ecotyre (ricavo) e quella al fornitore (costo), ognuna al suo centesimo. Il
  // costo e' quello della passiva, fornitore per fornitore (un interno: zero,
  // con `interno`); il ricavo in fattura si arrotonda invece una volta sul mese
  // (attivo), e la somma delle righe puo' scostarsene di un centesimo: chi le
  // mostra lo dice. Una parte che il surplus non ha e' null, non zero.
  // `sul_movimento`: i nomi scritti sugli interventi diversi da chi riceve, cioe'
  // i subraccoglitori per cui il principale fattura.
  const per_fornitore = [...aChi.values()].filter(v => v.kg_attivo > 0 || v.kg_passivo > 0).map(v => {
    const attiva = v.euro_t_attiva !== null && v.euro_t_attiva !== undefined;
    const passiva = v.euro_t_passiva !== null && v.euro_t_passiva !== undefined;
    return {
      ...v,
      sul_movimento: [...v.sul_movimento].filter(n => normalizzaRagioneSociale(n) !== v.fornitore_chiave),
      interventi: v.interventi.size,
      ricavo: attiva && v.kg_attivo > 0 ? importoSurplus(Math.round(v.kg_attivo * 1000) / 1000, v.euro_t_attiva) : null,
      costo: passiva && v.kg_passivo > 0 ? (v.interno ? 0 : importoSurplus(v.kg_passivo, v.euro_t_passiva)) : null,
    };
  }).sort(ordine);

  return {
    attivo, passivo, interni, per_surplus, per_fornitore,
    totale_attivo: somma(attivo, 'importo'),
    totale_passivo: somma(passivo, 'importo'),
    quote_attivo: somma(attivo, 'quote'),
    quote_passivo: somma(passivo, 'quote'),
  };
}

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

  const ricavo_standard = fatturato
    ? r2(r2(prezzo.totale(quantita_kg)) + r2(sovraRaccolta) + r2(sovraTrasporto) + r2(sovraTrattamento))
    : 0;

  // Una secondaria non e' una raccolta: un costo di raccolta scritto su di lei
  // non si paga, come in passiva, che lo dice fra le anomalie (13/10/2026).
  const costoRaccolta = eSecondariaExtra(r) ? 0 : Number(r.costo_raccolta_t || 0);
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
  // Dal 13/10/2026 una secondaria si paga come un trasporto di secondaria: la
  // tariffa della tratta nel contratto del vettore, a tonnellata o a viaggio, e
  // il prezzo scritto solo senza contratto (trasportoIntervento, qui sopra).
  const trasporto = trasportoIntervento(r, contesto);
  const costoTrasporto = trasporto.importo;
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
    // il trasporto dell'intervento, gia' in euro (13/10/2026): a viaggio, o la
    // tariffa della tratta per una secondaria
    trasporto: costoTrasporto,
  };
  const costo_standard = arrotondaAlCentesimo(costi.raccolta + costi.stoccaggio + costi.trattamento
    + costoPulizia + costiAggiuntivi + costoTrasporto + sovraRaccoglitore + sovraImpianto);

  // Il surplus (13/10/2026): la quota di questo intervento, in piu' dello
  // standard. ricavo e costo_totale la comprendono, come la fattura e la passiva
  // comprendono la riga del surplus; ricavo_standard e costo_standard sono i
  // numeri di prima. Senza un surplus in corso sono gli stessi.
  const sur = surplusIntervento(r, contesto);
  const surplus_attivo = fatturato ? sur.attivo : [];
  const surplus_passivo = sur.passivo;
  const surplus_ricavo = arrotondaAlCentesimo(surplus_attivo.reduce((s, v) => s + v.importo, 0));
  const surplus_costo = arrotondaAlCentesimo(surplus_passivo.reduce((s, v) => s + v.importo, 0));
  const ricavo = surplus_ricavo ? arrotondaAlCentesimo(ricavo_standard + surplus_ricavo) : ricavo_standard;
  const costo_totale = surplus_costo ? arrotondaAlCentesimo(costo_standard + surplus_costo) : costo_standard;

  const margine = Math.round((ricavo - costo_totale) * 100) / 100;
  const margine_perc = ricavo !== 0 ? Math.round((margine / ricavo * 100) * 100) / 100 : 0;
  // UN INTERVENTO DA FATTURARE SENZA PREZZO (prova del cambio d'anno,
  // 15/10/2026): prezzo a zero e nessuna tariffa per l'anno, o un'unita' che la
  // fattura non sa leggere. E' la riga che la fatturazione attiva mette in
  // errore (attivaCalcolo.ts): il suo ricavo e' zero perche' il prezzo manca,
  // e il margine che ne esce non e' un margine. I totali lo contano.
  const senza_prezzo = fatturato && (!(Number(prezzo.valore) > 0) || !!prezzo.unita_sconosciuta);

  return {
    tonnellate, kg: senza_peso ? null : quantita_kg, senza_peso, fatturato, senza_prezzo,
    prezzo_attivo: prezzoAttivo, prezzo, ricavo, costi, costo_totale, margine, margine_perc,
    ricavo_standard, costo_standard, trasporto,
    surplus_attivo, surplus_passivo, surplus_ricavo, surplus_costo,
  };
}

/**
 * La frase di un margine che non si calcola perche' degli interventi da fatturare
 * non hanno un prezzo (prova del cambio d'anno, 15/10/2026): la stessa nella
 * pagina e nei file per l'amministratore (extraRaccoltaExport.js). '' se zero.
 */
export const testoInterventiSenzaPrezzo = (n) => (Number(n) > 0
  ? `${Number(n) === 1 ? 'un intervento' : `${n} interventi`} da fatturare senza prezzo: margine non calcolabile, ricavi e costi parziali`
  : '');

/**
 * I totali di un elenco di interventi, quelli dei riquadri della pagina: lo
 * standard intervento per intervento (come le righe della fattura e della
 * passiva) e il surplus col centesimo del mese (surplusDelMese). Cosi' sugli
 * interventi di un mese la pagina dice il ricavo della fattura e il costo della
 * passiva, al centesimo; la somma delle quote dei singoli interventi sta in
 * `surplus.quote_attivo` e `surplus.quote_passivo`, per dire lo scarto.
 * Contano solo i terminati con la fine del trasporto, come in fattura.
 * kg_raccolti: i chili raccolti dal produttore, senza le secondarie (che portano
 * lo stesso peso una seconda volta).
 */
export function totaliExtraRaccolta(interventi, contesto = CONTESTO_VUOTO) {
  const elenco = (interventi || []).filter(r => eTerminatoExtra(r) && giornoRoma(r.trasporto_finito_il));
  let kgRaccolti = 0, ricaviStandard = 0, costiStandard = 0, senzaPrezzo = 0;
  for (const r of elenco) {
    const c = calcExtraRaccolta(r, contesto);
    if (!eSecondariaExtra(r)) kgRaccolti += Number(r.peso_effettivo) || 0;
    if (c.senza_prezzo) senzaPrezzo++;
    ricaviStandard += c.ricavo_standard;
    costiStandard += c.costo_standard;
  }
  const surplus = surplusDelMese(elenco, contesto);
  const ricavi_standard = arrotondaAlCentesimo(ricaviStandard);
  const costi_standard = arrotondaAlCentesimo(costiStandard);
  const ricavi = arrotondaAlCentesimo(ricavi_standard + surplus.totale_attivo);
  const costi = arrotondaAlCentesimo(costi_standard + surplus.totale_passivo);
  // UN MARGINE FATTO DA UN RICAVO CHE MANCA NON E' UN MARGINE (prova del cambio
  // d'anno, 15/10/2026). Il 15/01/2027 un intervento del 2027 senza prezzo
  // (base 2026 chiusa, prezzo non scritto) e uno a 210 €/t facevano ricavi
  // 147,00, costi 260,50 e un margine di -113,50 (-77,21%). Con un intervento da
  // fatturare senza prezzo il margine e la percentuale sono null («—» nella
  // pagina, col perche'), ricavi e costi restano e sono una parte. Come il
  // margine della commessa (margine.ts). Un valore mancante non e' zero.
  const margine = senzaPrezzo ? null : arrotondaAlCentesimo(ricavi - costi);
  return {
    interventi: elenco.length,
    kg_raccolti: kgRaccolti, tonnellate: kgRaccolti / 1000,
    ricavi_standard, costi_standard, ricavi, costi, margine,
    margine_perc: margine === null ? null : ricavi !== 0 ? Math.round((margine / ricavi * 100) * 100) / 100 : 0,
    senza_prezzo: senzaPrezzo,
    testo_senza_prezzo: testoInterventiSenzaPrezzo(senzaPrezzo),
    surplus,
  };
}

// Totale riga per export: il prezzo per il peso, come la riga della fattura,
// senza sovracosti. Zero per chi in fattura non entra.
export function totaleRiga(r, contesto = CONTESTO_VUOTO) {
  const c = calcExtraRaccolta(r, contesto);
  return c.fatturato ? r2(c.prezzo.totale(c.kg)) : 0;
}

// Aggregazione per produttore per analisi margine: SOLO LO STANDARD.
//
// IL SURPLUS NON E' DEL PRODUTTORE (decisione dell'utente del 13/10/2026): «il
// fuel surcharge non riguarda i produttori ma i trasportatori ovvero i
// raccoglitori, su questo non ci devono essere confusioni». Dal 13/10 mattina
// qui costo totale e ricavi comprendevano le quote del surplus quando il
// contesto lo portava, e un produttore risultava avere un Fuel Surcharge suo.
// Ora l'analisi per produttore e' lo standard qualunque contesto riceva, e il
// surplus si guarda per chi lo riceve (per_fornitore di surplusDelMese, il
// blocco «Fuel Surcharge ai raccoglitori» del file dell'elenco).
export function aggregaPerProduttore(records, contesto = CONTESTO_VUOTO) {
  const map = {};
  for (const r of records) {
    const p = r.produttore || '(senza produttore)';
    if (!map[p]) map[p] = { costi_aggiuntivi: 0, raccolta: 0, stoccaggio: 0, trattamento: 0, pulizia: 0, trasporto: 0, sovracosto_raccoglitore: 0, sovracosto_impianto: 0, costo_totale: 0, ricavi: 0, margine: 0, senza_prezzo: 0 };
    const c = calcExtraRaccolta(r, contesto);
    map[p].costi_aggiuntivi += Number(r.costi_aggiuntivi || 0);
    // Le voci a tonnellata come le conta il costo totale, gia' al centesimo per
    // intervento: cosi' le colonne fanno il costo totale (11/10/2026).
    map[p].raccolta += c.costi.raccolta;
    map[p].stoccaggio += c.costi.stoccaggio;
    map[p].trattamento += c.costi.trattamento;
    map[p].pulizia += Number(r.costo_pulizia || 0);
    // il trasporto che si paga davvero: per una secondaria il contratto della
    // tratta (13/10/2026)
    map[p].trasporto += c.costi.trasporto;
    map[p].sovracosto_raccoglitore += Number(r.sovracosto_pagato_raccoglitore || 0);
    map[p].sovracosto_impianto += Number(r.sovracosto_pagato_impianto || 0);
    map[p].costo_totale += c.costo_standard;
    map[p].ricavi += c.ricavo_standard;
    map[p].margine += Math.round((c.ricavo_standard - c.costo_standard) * 100) / 100;
    // gli interventi da fatturare senza prezzo (revisione del 15/10/2026): il
    // margine del produttore che ne ha uno non e' un margine, e l'analisi lo dice
    if (c.senza_prezzo) map[p].senza_prezzo++;
  }
  return map;
}
