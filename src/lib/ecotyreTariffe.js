// Specchio per le pagine di base44/shared/ecotyreTariffe.ts: le pagine non
// possono importare da base44/shared. Deve restare IDENTICO all'originale, a
// meno di questa intestazione e degli import, e lo controlla prove/specchi.mjs.
// E' nato l'11/10/2026 (chiusura dell'audit): la pagina e la scheda
// dell'extra raccolta avevano una loro copia della base dei 202 euro e un
// prezzo a due gradini, la fattura tre. Chi cambia una regola delle tariffe
// attive la cambia nell'originale e la ricopia qui.
// Import relativi con l'estensione: cosi' lo leggono anche le prove in node.

import { giornoRoma } from './giornoItaliano.js';
import { normalizzaRagioneSociale } from './normalizzaRagioneSocialeClient.js';
import { tariffaNonDisattivata, tariffaValeIl } from './validitaTariffa.js';

// La tariffa base dell'extra raccolta verso Ecotyre, un valore per anno. Regola
// dell'utente del 22/09/2026: «la tariffa dell'extra raccolta di base per la
// fatturazione attiva e' sempre 202 €/t nel 2026». Vale quando sull'intervento
// il prezzo attivo e' zero o vuoto e nella tabella delle tariffe attive non c'e'
// una EXTRA_RACCOLTA valida alla fine del trasporto (seedTariffeAttive2026 la
// semina a 202: i due numeri devono restare uguali). Un anno che qui non c'e' non
// ha una base: il prezzo va scritto sull'intervento o messo in tabella, e fino ad
// allora la riga e' un errore.
export const TARIFFA_BASE_EXTRA_RACCOLTA = { 2026: 202 };

/** La tariffa base dell'extra raccolta (€/t) per un anno, oppure null se per quell'anno non c'e'. */
export const tariffaBaseExtraRaccolta = (anno) => TARIFFA_BASE_EXTRA_RACCOLTA[Number(anno)] || null;

// CHI EMETTE LA FATTURA ATTIVA (chiusura dell'audit, 11/10/2026). L'utente: i
// fornitori di raccolta e trattamento fatturano a SMOCO, e SMOCO fa a Ecotyre
// una fattura per canale. Il foglio ACI dell'amministrazione scrive «SMOCO Srl»
// su ogni riga, da gennaio a settembre 2026, e cosi' la prefattura del portale.
// Le righe salvate prima di questa data portano ancora 'ECOTYRE': non si
// riscrivono, e i fogli stampano questo nome invece del campo.
export const FATTURANTE_ATTIVA = 'SMOCO Srl';

function normText(v) { return String(v || '').trim().toUpperCase(); }

export function sortTariffe(tariffe) {
  return [...tariffe].map(t => ({
    ...t,
    specificity: (t.classe_materiale ? 1 : 0) + (t.eer_codice ? 1 : 0) + (t.regione ? 1 : 0) + (t.servizio_ecotyre ? 1 : 0),
  })).sort((a, b) => b.specificity - a.specificity);
}

// Ricerca tariffa attiva per tipologia/cliente/classe/regione/EER/servizio_ecotyre con validita' temporale.
// servizioEcotyre undefined = non filtrare per servizio_ecotyre (backward compat).
// servizioEcotyre '' = solo tariffe con servizio_ecotyre vuoto (valgono per entrambi).
// servizioEcotyre 'TRASP'/'TRASP_TRATT' = solo tariffe con quel servizio_esatto.
export function findTariffa(tariffeSorted, tipologia, cliente, classe, regione, eer, dataRiferimento, servizioEcotyre) {
  // La validita' si confronta sul giorno italiano, non sull'istante: una tariffa
  // che finisce il 30 giugno vale per tutto il 30 giugno, anche per un trasporto
  // memorizzato con l'ora vera. Stessa regola di calcolaPassiva: dall'11/10/2026
  // e' una sola, tariffaValeIl di validitaTariffa.ts, che usano anche il foglio
  // dell'amministrazione e la lista dell'anno nuovo. Una tariffa 'non_attivo'
  // non vale mai, nemmeno con una data di fine.
  const giorno = dataRiferimento ? giornoRoma(dataRiferimento) : '';
  for (const t of tariffeSorted) {
    if (t.tipologia !== tipologia) continue;
    if (t.cliente && normText(t.cliente) !== normText(cliente)) continue;
    if (t.classe_materiale && t.classe_materiale !== classe) continue;
    if (t.regione && t.regione !== regione) continue;
    if (t.eer_codice && t.eer_codice !== eer) continue;
    if (servizioEcotyre !== undefined && (t.servizio_ecotyre || '') !== servizioEcotyre) continue;
    if (giorno ? !tariffaValeIl(t, giorno) : !tariffaNonDisattivata(t)) continue;
    return t;
  }
  return null;
}

// Risolve la tariffa per il committente ECOTYRE con preferenza servizio_ecotyre:
// 1) tariffa con servizio_ecotyre uguale al tipo determinato (TRASP o TRASP_TRATT)
// 2) se non esiste, tariffa con servizio_ecotyre vuoto (vale per entrambi)
// Nessun default: restituisce null se nessuna delle due esiste.
export function resolveTariffa(tariffeSorted, tipologia, classe, regione, eer, dataRiferimento, servizioEcotyre) {
  let t = findTariffa(tariffeSorted, tipologia, 'ECOTYRE', classe, regione, eer, dataRiferimento, servizioEcotyre);
  if (t) return t;
  return findTariffa(tariffeSorted, tipologia, 'ECOTYRE', classe, regione, eer, dataRiferimento, '');
}

/**
 * L'UNITA' DI MISURA DI UNA TARIFFA, ATTIVA O PASSIVA (06/10/2026; per le
 * passive dalla chiusura dell'audit, 11/10/2026).
 *
 * Gli stessi 202 salvati in €/kg moltiplicano per mille: un prezzo a tre cifre
 * non e' un prezzo al chilo, e uno sotto l'euro non e' un prezzo alla
 * tonnellata. Fino all'11/10 il controllo valeva solo per le tariffe attive: una
 * tariffa passiva di 90 €/kg si salvava, e il foglio dell'amministrazione la
 * stampava come 90.000 euro a tonnellata. Lo zero non si controlla: un prezzo a
 * zero e' ammesso.
 *
 * @returns [{ gravita: 'errore', messaggio }]
 */
export function controlliUnitaTariffa(nuova) {
  const errori = [];
  const valore = Number(nuova && nuova.valore) || 0;
  const unita = String((nuova && nuova.unita_misura) || '').trim();
  if (valore > 0) {
    if ((unita === '€/kg') && valore > 10) {
      errori.push({ gravita: 'errore', messaggio: `${valore} €/kg sono ${valore * 1000} € a tonnellata: se il prezzo e' per tonnellata, cambia l'unita' di misura.` });
    }
    if ((unita === '€/ton' || unita === '€/t') && valore < 1) {
      errori.push({ gravita: 'errore', messaggio: `${valore} €/t e' meno di un euro a tonnellata: se il prezzo e' per chilo, cambia l'unita' di misura.` });
    }
  }
  return errori;
}

/**
 * I CONTROLLI SU UNA TARIFFA ATTIVA, prima che faccia danni (06/10/2026).
 *
 * Due modi di rompere la tariffa unica della commessa Ecotyre, tutt'e due
 * silenziosi finche' non si guarda la fattura:
 *
 * 1) UNA SECONDA TARIFFA DELLO STESSO CANALE LEGATA AL SERVIZIO. resolveTariffa
 *    prova prima quella col servizio esatto: una RETE/ECOTYRE «solo trasporto»
 *    scavalcherebbe i 202 €/t di tutte le righe con quella dicitura, senza che
 *    niente lo dica.
 * 2) L'UNITA' DI MISURA SBAGLIATA. Gli stessi 202 salvati in €/kg moltiplicano
 *    per mille: luglio 2026 farebbe 226.692.480 € invece di 226.692,49. Una
 *    tariffa a tre cifre non e' un prezzo al chilo, e una sotto l'euro non e' un
 *    prezzo alla tonnellata.
 *
 * @returns [{ gravita: 'errore'|'avviso', messaggio }]
 */
export function controlliTariffaAttiva(nuova, esistenti = []) {
  // Il controllo dell'unita' e' lo stesso delle tariffe passive: sta in
  // controlliUnitaTariffa, qui sotto.
  const avvisi = controlliUnitaTariffa(nuova);
  const tipologia = normText(nuova && nuova.tipologia);
  const servizio = String((nuova && nuova.servizio_ecotyre) || '').trim();

  if (servizio) {
    // Il committente sta nel campo «cliente»: cercarlo in «cliente_fornitore»,
    // che sull'entita' Tariffa non esiste, rendeva questo avviso codice morto -
    // e la prova non se ne accorgeva perche' usava lo stesso nome sbagliato
    // (trovato dal controllo incrociato del 06/10/2026).
    const unica = (esistenti || []).find(t => normText(t.tipologia) === tipologia
      && normText(t.cliente) === 'ECOTYRE'
      && !String(t.servizio_ecotyre || '').trim()
      && t.id !== (nuova && nuova.id)
      && (t.stato === 'attivo' || !t.stato));
    if (unica) {
      avvisi.push({
        gravita: 'avviso',
        messaggio: `Per ${tipologia} c'e' gia' una tariffa che vale per tutte le diciture (${unica.valore} ${unica.unita_misura || ''}). Questa, legata a «${servizio}», avrebbe la precedenza su quelle righe: alla commessa Ecotyre la tariffa e' unica, e una seconda tariffa per servizio la spezza.`,
      });
    }
  }
  return avvisi;
}

// LE UNITA' CHE LA FATTURA ATTIVA SA LEGGERE (chiusura dell'audit, 11/10/2026).
// Prima un'unita' fuori elenco si moltiplicava come se fosse al chilo: 202 di
// una tariffa con l'unita' scritta male diventavano 202 euro per ogni chilo,
// mille volte tanto, e niente lo diceva. Adesso la riga vale zero e chi la
// calcola la mette in errore con la frase di unitaSconosciuta.
const UNITA_ATTIVE = ['€/kg', '€/t', '€/ton', '€/viaggio', '€/vg'];

/** Vero se la fattura attiva sa leggere questa unita' di misura. */
export const unitaAttivaRiconosciuta = (u) => UNITA_ATTIVE.includes(String(u || '').trim());

/** La frase di una riga a zero per un'unita' che non si sa leggere: la stessa per attiva e passiva. */
export const unitaSconosciuta = (u) => `unita' di misura «${String(u || '').trim() || 'vuota'}» sconosciuta: riga a zero. Correggi l'unita' della tariffa (€/t, €/kg o €/viaggio)`;

export function calcolaTotale(quantitaKg, tariffa) {
  if (!tariffa) return 0;
  const u = String(tariffa.unita_misura || '').trim();
  if (u === '€/kg') return quantitaKg * tariffa.valore;
  if (u === '€/ton' || u === '€/t') return (quantitaKg / 1000) * tariffa.valore;
  if (u === '€/viaggio' || u === '€/vg') return tariffa.valore;
  return 0;
}

export function fattoreConv(tariffa) {
  if (!tariffa) return 1000;
  const u = tariffa.unita_misura;
  return (u === '€/ton' || u === '€/t') ? 1000 : 1;
}

/**
 * IL PREZZO A TONNELLATA DI UNA RIGA DELL'ATTIVA (chiusura dell'audit, 11/10/2026).
 *
 * I report per l'amministrazione hanno la colonna «Euro/TON», e il format della
 * rete quella «Euro/Kg» ricavata dividendo per mille: ci si stampava il valore
 * della tariffa com'era, quindi una tariffa scritta in €/kg (0,202) usciva 0,202
 * sotto «Euro/TON» e 0,0002 al chilo, mentre il totale della riga era giusto.
 * Qui il valore si porta a tonnellata con l'unita' della riga, la stessa che
 * sceglie fattoreConv. Una riga senza unita' scritta e' delle prime, quando
 * l'attiva era tutta a tonnellata. null se la riga non si paga a peso (a viaggio,
 * a corpo, unita' sconosciuta): un prezzo a tonnellata li' non c'e', e non e' zero.
 */
export function prezzoATonnellata(valore, unita) {
  if (valore === null || valore === undefined || valore === '') return null;
  const v = Number(valore);
  if (!Number.isFinite(v)) return null;
  const u = String(unita || '').trim();
  if (u === '' || u === '€/t' || u === '€/ton') return v;
  if (u === '€/kg') return Math.round(v * 1000 * 1e6) / 1e6;
  return null;
}

/**
 * IL CENTESIMO COME LO FA EXCEL: MEZZO CENTESIMO PER ECCESSO, SUL NUMERO DECIMALE
 * (chiusura dell'audit, 11/10/2026).
 *
 * Math.round(v * 100) lavora sul numero binario, e un mezzo centesimo vero in
 * binario e' spesso un soffio sotto: 103 kg a 85 €/t fanno 8,755 euro, che il
 * calcolatore tiene come 8,75499999...; si arrotondava a 8,75, e il foglio Excel
 * dell'amministrazione, che rifa' il conto con =ROUND(...;2), diceva 8,76.
 * Aggiungere Number.EPSILON non basta appena l'importo supera l'euro. Qui il
 * numero si legge con 15 cifre significative, come lo tiene Excel, e il mezzo
 * centesimo va lontano da zero: e' il centesimo che il foglio ritrova quando
 * ricalcola. Lo usano la passiva dove il foglio Excel rifa' il conto riga per
 * riga (i costi di un intervento di extra raccolta, i viaggi misti a viaggio) e
 * la pagina dell'extra raccolta, che cosi' dicono lo stesso centesimo.
 */
export function arrotondaAlCentesimo(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const centesimi = Math.round(Number((Math.abs(n) * 100).toPrecision(15)));
  return n < 0 && centesimi ? -centesimi / 100 : centesimi / 100;
}

// Le tariffe che valgono per almeno un periodo: una tariffa rinegoziata resta
// buona per i mesi prima del cambio (decide la finestra di validita'). Dall'11/10/2026
// e' la regola unica di validitaTariffa.ts: 'non_attivo' non vale mai, nemmeno
// con una data di fine, come nel foglio e nella lista dell'anno nuovo.
export const tariffeAttiveValide = (tariffe) => (tariffe || []).filter(tariffaNonDisattivata);

export const eSecondariaExtra = (r) => String((r && r.tipo_movimento) || '').toLowerCase().trim() === 'secondaria';

// LA DICITURA E' «TRASP.+TRATT.» PER REGOLA, NON PER MANCANZA DI DATI
// (decisione dell'utente, 06/10/2026).
//
// Alla commessa Ecotyre si fattura con una tariffa unica (202 €/t per la rete
// nel 2026) e la dicitura normale e' trasporto piu' trattamento: «Trasp.» vale
// solo dove il trattamento lo fattura Ecotyre, e oggi e' il caso di Tecnogum.
//
// Prima era una deduzione: TRASP_TRATT usciva sia quando l'impianto non aveva
// la spunta sia quando la destinazione era vuota o sconosciuta all'anagrafica -
// il valore giusto per il motivo sbagliato. Adesso il default e' dichiarato, e
// solo la spunta esplicita di un fornitore RICONOSCIUTO lo cambia: cosi' una
// destinazione che non si trova non si traveste da scelta.
// Sta qui dall'11/10/2026 perche' la dicitura sceglie anche la tariffa
// dell'extra raccolta, e la pagina deve sceglierla come la fattura.
export const DICITURA_PREDEFINITA = 'TRASP_TRATT';

/** La regola della dicitura sui fornitori dati: una funzione movimento -> 'TRASP' | 'TRASP_TRATT'. */
export function servizioEcotyre(fornitori) {
  const perNome = new Map();
  for (const f of fornitori || []) {
    const key = normalizzaRagioneSociale(f && f.ragione_sociale);
    if (key) perNome.set(key, f);
  }
  return (r) => {
    const f = r && r.destinazione ? perNome.get(normalizzaRagioneSociale(r.destinazione)) : null;
    return f && f.trattamento_fatturato_da_ecotyre === true ? 'TRASP' : DICITURA_PREDEFINITA;
  };
}

// Una data come la legge chi la deve capire: 2026-12-31 -> 31/12/2026.
const giornoLeggibile = (g) => {
  const s = String(g || '').slice(0, 10);
  return s.length === 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s;
};

/**
 * Il prezzo attivo di un intervento di extra raccolta e da dove viene:
 * { origine: 'intervento' | 'tabella' | 'base' | 'secondaria' | '', id, valore,
 *   unita, fattore, anno_tariffa, altro_anno, nota, totale(kg) }.
 * 1) il prezzo scritto sull'intervento, se e' maggiore di zero;
 * 2) altrimenti la tariffa ATTIVA EXTRA_RACCOLTA valida alla fine del trasporto;
 * 3) altrimenti la base dell'anno (TARIFFA_BASE_EXTRA_RACCOLTA: 202 €/t nel 2026);
 * 4) altrimenti niente: valore 0, e la riga e' un errore.
 * Una secondaria non si fattura a Ecotyre (il ricavo sta sulla raccolta): per
 * lei il prezzo e' zero, qualunque cosa sia scritta sulla scheda.
 * Prima un intervento a zero restava a zero "da controllare": dal 22/09/2026 lo
 * zero non e' piu' una scelta, e' un prezzo non scritto.
 *
 * @param r l'intervento
 * @param tariffeSorted le tariffe attive, gia' passate da tariffeAttiveValide e sortTariffe
 * @param tipoServizio la dicitura della riga (servizioEcotyre)
 * @param anno l'anno dell'intervento, quello della fine trasporto
 * @param dataRiferimento il giorno su cui guardare la validita' della tariffa:
 *   senza, la fine trasporto. Serve alla scheda di un intervento ancora aperto,
 *   che una fine trasporto non ce l'ha; senza nessun giorno la tabella non si
 *   guarda, perche' una tariffa con una validita' non si sceglie a caso.
 */
export function prezzoAttivoExtra(r, tariffeSorted, tipoServizio, anno, dataRiferimento) {
  const aTonnellata = (valore) => (kg) => (kg / 1000) * valore;
  if (eSecondariaExtra(r)) {
    return { origine: 'secondaria', id: '', valore: 0, unita: '€/t', fattore: 1000, anno_tariffa: null, altro_anno: false, nota: 'Secondaria: non si fattura a Ecotyre, il ricavo sta sulla raccolta', totale: () => 0 };
  }
  const scritto = Number((r && r.prezzo_attivo_t) || 0);
  if (scritto > 0) {
    return { origine: 'intervento', id: 'intervento', valore: scritto, unita: '€/t', fattore: 1000, anno_tariffa: null, altro_anno: false, nota: 'Prezzo scritto sull\'intervento', totale: aTonnellata(scritto) };
  }
  const giornoRif = dataRiferimento || (r && r.trasporto_finito_il) || '';
  const daTabella = giornoRif ? resolveTariffa(tariffeSorted || [], 'EXTRA_RACCOLTA', r && r.classe, (r && r.regione) || '', r && r.cer, giornoRif, tipoServizio) : null;
  if (daTabella && Number(daTabella.valore) > 0) {
    const unita = daTabella.unita_misura || '€/t';
    // LA TARIFFA DELL'EXTRA RACCOLTA RESTA APERTA PER SCELTA (utente, 06/10/2026):
    // sono prestazioni occasionali su campagne che si rinnovano ogni anno, e il
    // prezzo si concorda intervento per intervento. Una tariffa senza scadenza
    // pero' continua a valere anche l'anno dopo: la riga deve dire di che anno
    // e' il prezzo che sta applicando, invece di spacciarlo per quello
    // dell'anno in corso.
    const dal = String(daTabella.data_inizio_validita || '').slice(0, 10);
    const al = String(daTabella.data_fine_validita || '').slice(0, 10);
    const annoTariffa = dal ? Number(dal.slice(0, 4)) : null;
    const altroAnno = annoTariffa !== null && Number(anno) !== annoTariffa;
    const periodo = dal
      ? (al ? `valida dal ${giornoLeggibile(dal)} al ${giornoLeggibile(al)}` : `valida dal ${giornoLeggibile(dal)}, senza scadenza`)
      : (al ? `valida fino al ${giornoLeggibile(al)}` : 'senza periodo di validita\'');
    // Un'unita' che la fattura non sa leggere fa una riga a zero: si dice qui,
    // e chi calcola la riga la mette in errore (11/10/2026).
    const sconosciuta = !unitaAttivaRiconosciuta(daTabella.unita_misura);
    return {
      origine: 'tabella', id: daTabella.id || 'tabella', valore: Number(daTabella.valore), unita, fattore: fattoreConv(daTabella),
      anno_tariffa: annoTariffa, altro_anno: altroAnno, unita_sconosciuta: sconosciuta,
      nota: `Tariffa base Ecotyre ${annoTariffa || anno}: ${daTabella.valore} ${unita}, dalla tabella delle tariffe attive, ${periodo} (sull'intervento il prezzo non e' scritto)`
        + (altroAnno ? `. ATTENZIONE: e' il prezzo del ${annoTariffa}, non del ${anno}` : '')
        + (sconosciuta ? `. ${unitaSconosciuta(daTabella.unita_misura)}` : ''),
      totale: (kg) => calcolaTotale(kg, daTabella),
    };
  }
  const baseAnno = tariffaBaseExtraRaccolta(anno);
  if (baseAnno) {
    return { origine: 'base', id: `base-${anno}`, valore: baseAnno, unita: '€/t', fattore: 1000, anno_tariffa: Number(anno), altro_anno: false, nota: `Tariffa base Ecotyre ${anno}: ${baseAnno} €/t (sull'intervento il prezzo non e' scritto)`, totale: aTonnellata(baseAnno) };
  }
  return { origine: '', id: 'intervento', valore: 0, unita: '€/t', fattore: 1000, anno_tariffa: null, altro_anno: false, nota: 'Prezzo attivo a zero sull\'intervento e nessuna tariffa base per l\'anno: riga a zero euro', totale: () => 0 };
}

/**
 * UN TERMINATO SENZA PESO EFFETTIVO SI DICE, CON LE STESSE PAROLE OVUNQUE
 * (chiusura dell'audit, 11/10/2026).
 *
 * Si valuta solo sul peso effettivo, e un valore mancante non e' zero. Prima la
 * pagina Extra Raccolta e il foglio dell'amministrazione ripiegavano sulla
 * quantita' ritirata, la fattura scartava l'intervento in silenzio e la passiva
 * lo contava a zero chili: tre numeri, e nessuno che lo dicesse. Le schede nuove
 * non si chiudono senza peso; restano quelle di prima. La frase e' una sola,
 * qui, perche' fattura, passiva e pagina la dicano uguale.
 */
export function avvisoPesoMancante(r) {
  const rif = String((r && (r.numero_fir || r.id_ordine)) || '').trim() || 'senza formulario';
  return `Extra raccolta ${rif}: terminato senza peso effettivo. Non entra nella fattura a Ecotyre e i costi a tonnellata valgono zero finché il peso effettivo non è scritto sull'intervento: la quantità ritirata o stimata non lo sostituisce.`;
}
