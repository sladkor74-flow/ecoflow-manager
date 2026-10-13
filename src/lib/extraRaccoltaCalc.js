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
 */
export function contestoPrezzi(tariffeAttive = [], fornitori = [], surplus = [], subfornitori = null) {
  return {
    tariffe: sortTariffe(tariffeAttiveValide(tariffeAttive || [])),
    servizio: servizioEcotyre(fornitori || []),
    surplus: surplusNonDisattivati(surplus || []).filter(s => canaleDi(s) === 'EXTRA_RACCOLTA'),
    anagrafica: anagraficaSurplus(fornitori || [], subfornitori),
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
  const attivo = [];
  if (!secondaria) {
    const raccoglitore = perAttiva(trasportatore);
    const impianto = perAttiva(destinazione);
    const validi = surplusDelMovimento(elenco, {
      tipologia: canale, prestazione: '', quando,
      fornitore: raccoglitore,
      fornitori: { RACCOLTA: raccoglitore, TRATTAMENTO: impianto, CONFERIMENTO_STOCCAGGIO: impianto },
    }, 'ATTIVA');
    for (const { surplus: s, euro_t } of validi) attivo.push(voceSurplus(s, euro_t, kg, { importo: importoSurplus(kg, euro_t) }));
  }

  const passivo = [];
  const p = a.passiva;
  const paga = (prestazione, fornitore, chiave, nomi, interno) => {
    const validi = surplusDelMovimento(elenco, { tipologia: canale, prestazione, quando, fornitore: { id: p.idDi(chiave), nomi } }, 'PASSIVA');
    for (const { surplus: s, euro_t } of validi) {
      passivo.push(voceSurplus(s, euro_t, kg, {
        prestazione, fornitore, fornitore_chiave: chiave, interno,
        importo: interno ? 0 : importoSurplus(kg, euro_t),
      }));
    }
  };
  // la raccolta: solo gli interventi primari, perche' una secondaria e' un
  // trasferimento da uno stoccaggio, non una raccolta
  if (trasportatore && !secondaria) {
    const f = p.fattura(trasportatore);
    paga('RACCOLTA', f.nome, f.chiave, [f.nome, trasportatore], p.interno(f.nome));
  }
  // il trattamento o lo stoccaggio, alla destinazione
  const principale = prestazioneDaTipo(r.tipo_destinazione);
  if (principale && destinazione) {
    const chiave = normalizzaRagioneSociale(destinazione);
    const altra = principale === 'TRATTAMENTO' ? 'CONFERIMENTO_STOCCAGGIO' : 'TRATTAMENTO';
    const prestazioni = Number(r[CAMPO_COSTO[altra]] || 0) > 0 ? [principale, altra] : [principale];
    for (const prestazione of prestazioni) paga(prestazione, destinazione, chiave, [destinazione], p.interno(destinazione));
  }
  // il trasporto delle secondarie, se il viaggio si paga
  if (secondaria && trasportatore && Number(r.costo_trasporto_viaggio || 0) > 0) {
    const f = p.fattura(trasportatore);
    paga('TRASPORTO_SECONDARIA', f.nome, f.chiave, [f.nome, trasportatore], p.interno(f.nome));
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
  for (const r of interventi || []) {
    if (!eTerminatoExtra(r)) continue;
    const giorno = giornoRoma(r.trasporto_finito_il);
    if (!giorno) continue;
    const mese = giorno.slice(0, 7);
    const s = surplusIntervento(r, contesto);
    for (const v of s.attivo) {
      const k = `${mese}|${v.chiave}`;
      const acc = attivi.get(k) || { ...v, mese, kg: 0, quote: 0, interventi: 0 };
      acc.kg += v.kg; acc.quote += v.importo; acc.interventi++;
      attivi.set(k, acc);
    }
    for (const v of s.passivo) {
      const k = `${mese}|${v.chiave}|${v.fornitore_chiave}`;
      const acc = passivi.get(k) || { ...v, mese, kg: 0, quote: 0, interventi: 0 };
      acc.kg += v.kg; acc.quote += v.importo; acc.interventi++;
      passivi.set(k, acc);
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

  return {
    attivo, passivo, interni, per_surplus,
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

  return {
    tonnellate, kg: senza_peso ? null : quantita_kg, senza_peso, fatturato,
    prezzo_attivo: prezzoAttivo, prezzo, ricavo, costi, costo_totale, margine, margine_perc,
    ricavo_standard, costo_standard,
    surplus_attivo, surplus_passivo, surplus_ricavo, surplus_costo,
  };
}

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
  let kgRaccolti = 0, ricaviStandard = 0, costiStandard = 0;
  for (const r of elenco) {
    const c = calcExtraRaccolta(r, contesto);
    if (!eSecondariaExtra(r)) kgRaccolti += Number(r.peso_effettivo) || 0;
    ricaviStandard += c.ricavo_standard;
    costiStandard += c.costo_standard;
  }
  const surplus = surplusDelMese(elenco, contesto);
  const ricavi_standard = arrotondaAlCentesimo(ricaviStandard);
  const costi_standard = arrotondaAlCentesimo(costiStandard);
  const ricavi = arrotondaAlCentesimo(ricavi_standard + surplus.totale_attivo);
  const costi = arrotondaAlCentesimo(costi_standard + surplus.totale_passivo);
  const margine = arrotondaAlCentesimo(ricavi - costi);
  return {
    interventi: elenco.length,
    kg_raccolti: kgRaccolti, tonnellate: kgRaccolti / 1000,
    ricavi_standard, costi_standard, ricavi, costi, margine,
    margine_perc: ricavi !== 0 ? Math.round((margine / ricavi * 100) * 100) / 100 : 0,
    surplus,
  };
}

// Totale riga per export: il prezzo per il peso, come la riga della fattura,
// senza sovracosti. Zero per chi in fattura non entra.
export function totaleRiga(r, contesto = CONTESTO_VUOTO) {
  const c = calcExtraRaccolta(r, contesto);
  return c.fatturato ? r2(c.prezzo.totale(c.kg)) : 0;
}

// Aggregazione per produttore per analisi margine. Con un surplus nel contesto
// (13/10/2026) costo totale e ricavi comprendono le quote del surplus, e le due
// voci `surplus_costo` e `surplus_ricavo` le dicono: le colonne dei costi piu'
// surplus_costo fanno sempre il costo totale.
export function aggregaPerProduttore(records, contesto = CONTESTO_VUOTO) {
  const map = {};
  for (const r of records) {
    const p = r.produttore || '(senza produttore)';
    if (!map[p]) map[p] = { costi_aggiuntivi: 0, raccolta: 0, stoccaggio: 0, trattamento: 0, pulizia: 0, trasporto: 0, sovracosto_raccoglitore: 0, sovracosto_impianto: 0, surplus_costo: 0, costo_totale: 0, surplus_ricavo: 0, ricavi: 0, margine: 0 };
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
    map[p].surplus_costo += c.surplus_costo;
    map[p].surplus_ricavo += c.surplus_ricavo;
    map[p].costo_totale += c.costo_totale;
    map[p].ricavi += c.ricavo;
    map[p].margine += c.margine;
  }
  return map;
}
