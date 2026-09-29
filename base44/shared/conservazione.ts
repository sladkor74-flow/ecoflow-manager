// CONSERVAZIONE DEI DOCUMENTI DEI FORNITORI: si alleggerisce, non si cancella.
//
// Richiesta dell'utente (29/09/2026): "quando carico i documenti dei fornitori,
// che siano report settimanali o mensili a consuntivo o gli ordini assegnati ad
// inizio mese, al fine di non appesantire il dominio, devono automaticamente
// cancellarsi dopo i famosi 40 giorni, ma deve restare il contenuto ovvero la
// storia scritta per poterne fruire in futuro".
//
// Quindi al quarantesimo giorno di ogni documento restano il record, i suoi
// numeri di sintesi e una storia scritta in italiano. Se ne vanno le righe lette
// e il confronto riga per riga: sono il grosso del peso, perche' finiscono in
// ContenutoEsteso a pezzi da ottomila caratteri, e sono la parte che nessuno
// riapre dopo un mese.
//
// IL RECORD NON SI CANCELLA PIU'. Prima di questa regola le verifiche dei report
// settimanali sparivano per intero al quarantesimo giorno e le liste degli
// assegnati dopo due mesi: se ne andava proprio la storia che adesso si vuole
// tenere.
//
// I quaranta giorni si contano dal CARICAMENTO, non dalla competenza. La regola 1
// dice che la competenza di un movimento e' la fine trasporto, ma un documento si
// conserva da quando e' arrivato: un consuntivo di settembre che il fornitore
// manda a novembre, contato sulla competenza, nascerebbe gia' scaduto e si
// alleggerirebbe prima di essere letto.
//
// La storia sta in un campo NORMALE del record e non passa mai da valoreCampo: se
// sfondasse gli ottomila caratteri tornerebbe in ContenutoEsteso, cioe' esattamente
// il peso che si voleva togliere. Per questo si taglia, e il taglio si dice.
//
// Qui dentro c'e' solo la regola, senza piattaforma: le prove la chiamano cosi'
// com'e' (prove/conservazione.mjs).

import { giorniDa } from "./fileArchivio.ts";
import { eliminaCampo } from "./testoLungo.ts";
import { formatoKg } from "./formato.ts";

export const GIORNI_CONSERVAZIONE = 40;

/** Quanto puo' essere lunga una storia: sotto la soglia di testoLungo.ts, sempre. */
export const LUNGHEZZA_STORIA = 4000;

/**
 * I campi che si svuotano, entita' per entita': le righe lette dal documento e il
 * confronto riga per riga. Tutto il resto (i contatori, i verdetti per canale, le
 * date) sono campi normali del record e restano dove sono.
 */
export const CAMPI_PESANTI = {
  VerificaReport: ['righe_report_json', 'lettura_json', 'esito_json'],
  QuadraturaFir: ['righe_json', 'lettura_json', 'esito_json'],
  ListaAssegnati: ['righe_json', 'avvisi_json'],
  ControlloEvasione: ['esito_json', 'alert_json'],
  ConsuntivoFornitore: ['righe_json', 'esito_json'],
};

/**
 * Da quale data si contano i giorni, in ordine di preferenza: sempre il momento in
 * cui il documento e' arrivato nel gestionale. created_date e' l'ultima rete: la
 * mette la piattaforma e c'e' sempre.
 */
export const CAMPI_DATA = {
  VerificaReport: ['avviata_il', 'verificata_il', 'created_date'],
  QuadraturaFir: ['avviata_il', 'verificata_il', 'created_date'],
  ListaAssegnati: ['caricata_il', 'created_date'],
  ControlloEvasione: ['eseguito_il', 'created_date'],
  ConsuntivoFornitore: ['caricato_il', 'confrontato_il', 'created_date'],
};

/** Un documento a cui e' gia' stato tolto il dettaglio. */
export const eAlleggerito = (r) => !!(r && r.alleggerito_il);

const testo = (v) => String(v ?? '').trim();
const it = (d) => { const s = testo(d).slice(0, 10); return s.length === 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : ''; };
const numero = (v) => Number(v) || 0;
const plurale = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;

/** I campi pesanti di un record che contengono ancora qualcosa. */
export function campiPesantiPieni(record, entita) {
  return (CAMPI_PESANTI[entita] || []).filter(c => testo(record && record[c]) !== '');
}

/** Da quanti giorni e' stato caricato questo documento. null se non si sa datarlo. */
export function etaGiorni(record, entita, adessoMs) {
  for (const campo of CAMPI_DATA[entita] || []) {
    const g = giorniDa(testo(record && record[campo]), adessoMs);
    if (g !== null) return g;
  }
  return null;
}

/**
 * I documenti arrivati al quarantesimo giorno che hanno ancora qualcosa da
 * togliere: il dettaglio, o un file rimasto nell'archivio privato.
 *
 * Un documento senza data non si tocca: non saperlo datare non e' una ragione per
 * svuotarlo. Chi chiama lo dice, invece di fingere che non esista.
 *
 * Funzione pura: le prove la chiamano senza toccare la piattaforma.
 */
export function daAlleggerire(records, opzioni) {
  const o = opzioni || {};
  const entita = o.entita;
  const giorni = o.giorni == null ? GIORNI_CONSERVAZIONE : Number(o.giorni);
  const adessoMs = o.adessoMs || Date.now();
  const scelti = [];
  const senzaData = [];
  for (const r of records || []) {
    if (!r || !r.id || eAlleggerito(r)) continue;
    const campi = campiPesantiPieni(r, entita);
    const file = testo(r.file_uri);
    // Campi gia' vuoti, storia scritta e nessun giorno segnato: e' la firma di un
    // alleggerimento INTERROTTO a meta' (la piattaforma ha risposto 429, la
    // funzione e' scaduta, si e' pubblicato in quel momento). Va ripreso, non
    // scartato: le sue parti pesanti sono ancora in ContenutoEsteso e nessuno le
    // raggiungerebbe piu', perche' si cancellano per record e il record non le
    // nomina piu'.
    const interrotto = campi.length === 0 && testo(r.storia) !== '';
    if (campi.length === 0 && !file && !interrotto) continue;
    const eta = etaGiorni(r, entita, adessoMs);
    if (eta === null) { senzaData.push(r.id); continue; }
    if (eta < giorni) continue;
    scelti.push({ id: r.id, giorni: eta, campi, file_uri: file, ripreso: interrotto });
  }
  scelti.sort((a, b) => b.giorni - a.giorni);
  return { scelti, senza_data: senzaData };
}

/** Taglia una storia troppo lunga dicendo che e' tagliata. */
export function tagliaStoria(t, massimo = LUNGHEZZA_STORIA) {
  const s = testo(t).replace(/\n{3,}/g, '\n\n');
  if (s.length <= massimo) return s;
  const coda = ' […] il resto della storia non e\' stato conservato.';
  return s.slice(0, massimo - coda.length).replace(/\s+\S*$/, '') + coda;
}

/** Un elenco tagliato a quanti, che dice quanti ne restano fuori. */
function elenco(voci, quanti) {
  const v = voci.filter(Boolean);
  if (v.length <= quanti) return v;
  return [...v.slice(0, quanti), `e altri ${v.length - quanti}`];
}

// === REPORT SETTIMANALE ===
//
// Il record porta gia' sedici contatori e il verdetto per canale come campi suoi:
// la meta' della storia c'e' gia'. Quello che vive SOLO dentro l'esito, e che qui
// si salva in parole, sono i formulari e i chili per movimentazione e canale (la
// quadratura) e chi non tornava.

/** La storia di una verifica di report settimanale. esito puo' mancare. */
export function storiaVerifica(v, esito = null) {
  const r = v || {};
  const righe = [];
  const periodo = r.data_inizio && r.data_fine ? `, dal ${it(r.data_inizio)} al ${it(r.data_fine)}` : '';
  const dichiarazione = testo(r.file_tipo) === 'dichiarazione';
  righe.push(dichiarazione
    ? `${testo(r.soggetto_nome)}: dichiarata nessuna movimentazione nella settimana ${r.settimana} del ${r.anno}${periodo}.${testo(r.nota) ? ` Comunicazione: ${testo(r.nota)}.` : ''}`
    : `Report settimanale di ${testo(r.soggetto_nome)}, settimana ${r.settimana} del ${r.anno}${periodo}${testo(r.file_nome) ? `, file «${testo(r.file_nome)}»` : ''}.`);

  const verdetto = [];
  if (r.verificata_il) verdetto.push(`Verificato il ${it(r.verificata_il)}`);
  if (testo(r.conformita)) verdetto.push(`conformita' ${testo(r.conformita)}`);
  if (verdetto.length) righe.push(verdetto.join(', ') + '.');

  // Rete, ACI ed extra raccolta non si sommano mai (regola 3): il verdetto si dice
  // canale per canale, come sul record.
  const perCanale = (r.per_canale || []).filter(c => c && (testo(c.nome) || testo(c.canale)));
  if (perCanale.length) {
    righe.push(perCanale.map(c => {
      const dettagli = [
        numero(c.anomalie) ? plurale(numero(c.anomalie), 'anomalia', 'anomalie') : '',
        numero(c.assenti) ? plurale(numero(c.assenti), 'formulario assente dal report', 'formulari assenti dal report') : '',
      ].filter(Boolean).join(', ');
      return `${testo(c.nome) || testo(c.canale)}: conformita' ${testo(c.conformita) || 'non indicata'}${dettagli ? ` (${dettagli})` : ''}`;
    }).join('. ') + '.');
  }

  if (!dichiarazione) {
    const conti = [
      numero(r.conformi) ? plurale(numero(r.conformi), 'conforme', 'conformi') : '',
      numero(r.con_discrepanze) ? `${numero(r.con_discrepanze)} con discrepanze` : '',
      numero(r.non_trovate) ? `${plurale(numero(r.non_trovate), 'non trovata', 'non trovate')} nel gestionale` : '',
      numero(r.duplicate) ? plurale(numero(r.duplicate), 'duplicata', 'duplicate') : '',
    ].filter(Boolean).join(', ');
    righe.push(`Nel report ${plurale(numero(r.righe_report), 'riga', 'righe')}${conti ? `: ${conti}` : ''}.`);
  }
  const altro = [
    numero(r.assenti_nel_report) ? `${plurale(numero(r.assenti_nel_report), 'formulario del gestionale non era', 'formulari del gestionale non erano')} nel report` : '',
    numero(r.date_da_sistemare) ? `${plurale(numero(r.date_da_sistemare), 'formulario ha', 'formulari hanno')} le date da sistemare` : '',
    numero(r.osservazioni) ? plurale(numero(r.osservazioni), 'osservazione', 'osservazioni') : '',
    numero(r.rettifiche) ? `${plurale(numero(r.rettifiche), 'rettifica', 'rettifiche')} da fare sul portale` : '',
    numero(r.righe_escluse) ? `${plurale(numero(r.righe_escluse), 'riga esclusa', 'righe escluse')} (${formatoKg(numero(r.peso_escluse_kg))} kg)` : '',
  ].filter(Boolean);
  if (altro.length) righe.push(altro.join('; ') + '.');
  if (r.uscite_verificate === false) righe.push('Il report riportava i soli ingressi: le uscite non sono state controllate.');

  const e = esito || {};
  // Formulari e chili per movimentazione e canale: sul record non ci sono, e
  // senza di loro la storia direbbe "parziale, tre anomalie" senza un chilo.
  const quadratura = (e.quadratura || []).filter(q => q && (numero(q.formulari_report) > 0 || numero(q.formulari_gestionale) > 0));
  if (quadratura.length) {
    righe.push('Formulari e chili per movimentazione e canale — ' + quadratura.map(q =>
      `${testo(q.nome)}: report ${numero(q.formulari_report)} per ${formatoKg(numero(q.kg_report))} kg, gestionale ${numero(q.formulari_gestionale)} per ${formatoKg(numero(q.kg_gestionale))} kg`
    ).join('; ') + '.');
  }

  const anomale = (e.esiti || []).filter(x => x && x.anomalia);
  if (anomale.length) {
    righe.push('Non tornavano — ' + elenco(anomale.map(x => {
      const rep = x.report || {};
      const messaggi = (x.discrepanze || []).map(d => testo(d.messaggio)).filter(Boolean).join('; ');
      const chi = testo(rep.fir) || testo(rep.ordine) || `riga ${x.n}`;
      return `${chi}${messaggi ? `: ${messaggi}` : ` (${testo(x.esito)})`}`;
    }), 20).join('. ') + '.');
  }
  const assenti = e.assenti || [];
  if (assenti.length) {
    righe.push('Registrati nel gestionale e assenti dal report — ' + elenco(assenti.map(a =>
      `${testo(a.fir)}${testo(a.ordine) ? ` (ordine ${testo(a.ordine)})` : ''}, ${formatoKg(numero(a.kg))} kg${a.fine ? ` del ${it(String(a.fine))}` : ''}`
    ), 20).join('; ') + '.');
  }
  if (testo(e.nota_date)) righe.push(`Lettura delle date: ${testo(e.nota_date)}.`);

  return tagliaStoria(righe.join('\n'));
}

// === QUADRATURA FIR ===

/** La storia di una quadratura FIR settimanale. esito puo' mancare. */
export function storiaQuadratura(q, esito = null) {
  const r = q || {};
  const righe = [];
  const periodo = r.data_inizio && r.data_fine ? `, dal ${it(r.data_inizio)} al ${it(r.data_fine)}` : '';
  righe.push(`Quadratura FIR della settimana ${r.settimana} del ${r.anno}${periodo}${testo(r.file_nome) ? `, file «${testo(r.file_nome)}»` : ''}.`);
  const lettura = [
    r.verificata_il ? `Verificata il ${it(r.verificata_il)}` : '',
    numero(r.tabelle) ? plurale(numero(r.tabelle), 'tabella riconosciuta', 'tabelle riconosciute') : '',
    numero(r.righe_lette) ? plurale(numero(r.righe_lette), 'riga letta', 'righe lette') : '',
    r.lettura_verificata === true ? 'trascrizione confermata dai totali stampati sul file' : '',
    r.lettura_verificata === false ? 'trascrizione NON confermata dai totali stampati sul file' : '',
  ].filter(Boolean);
  if (lettura.length) righe.push(lettura.join(', ') + '.');
  if (numero(r.settimana_indicata) && numero(r.settimana_indicata) !== numero(r.settimana)) {
    righe.push(`Sul file era scritta la settimana ${numero(r.settimana_indicata)}.`);
  }

  const perCanale = (r.per_canale || []).filter(c => c && testo(c.canale));
  if (perCanale.length) {
    righe.push(perCanale.map(c => {
      const dettagli = [
        `${numero(c.congruenti)} celle su ${numero(c.celle)} congruenti`,
        numero(c.incongruenti) ? plurale(numero(c.incongruenti), 'scostamento', 'scostamenti') : '',
        numero(c.non_confrontabili) ? `${numero(c.non_confrontabili)} non confrontabili` : '',
        numero(c.date_da_sistemare) ? `${plurale(numero(c.date_da_sistemare), 'formulario ha', 'formulari hanno')} le date da sistemare` : '',
      ].filter(Boolean).join(', ');
      return `${testo(c.canale)}: quadratura ${testo(c.conformita) || 'non indicata'} (${dettagli})`;
    }).join('. ') + '.');
  }

  const e = esito || {};
  const scostamenti = [];
  for (const f of e.flussi || []) {
    for (const c of (f && f.celle) || []) {
      if (!c || c.verdetto === 'congruente') continue;
      const fonte = (nome, v) => (v ? `${nome} ${numero(v.n)} per ${formatoKg(numero(v.kg))} kg` : '');
      const numeri = [fonte('WINSINFO', c.winsinfo), fonte('portale', c.ecotyre), fonte('gestionale', c.gestionale)].filter(Boolean).join(', ');
      scostamenti.push(`${testo(f.titolo)} — ${testo(c.impianto) || '?'} · ${testo(c.trasportatore) || '?'}: ${numeri || 'nessun dato'}`);
    }
  }
  if (scostamenti.length) righe.push('Non quadravano — ' + elenco(scostamenti, 20).join('. ') + '.');
  const mancanti = (e.flussi || []).flatMap(f => ((f && f.tabelle_mancanti) || []).map(m => `${testo(f.titolo)}: manca la tabella di ${m}`));
  if (mancanti.length) righe.push(elenco(mancanti, 6).join('; ') + '.');
  const osservazioni = (e.osservazioni || []).map(o => testo(typeof o === 'string' ? o : o && o.messaggio)).filter(Boolean);
  if (osservazioni.length) righe.push('Osservazioni — ' + elenco(osservazioni, 6).join('; ') + '.');

  return tagliaStoria(righe.join('\n'));
}

// === LISTA DEGLI ORDINI ASSEGNATI ===

/** La storia di una lista di assegnati mandata a un raccoglitore. */
export function storiaLista(l, avvisi = null) {
  const r = l || {};
  const righe = [];
  righe.push(`Lista degli ordini assegnati a ${testo(r.raccoglitore_nome) || testo(r.raccoglitore_chiave)} per il mese ${numero(r.mese)}/${numero(r.anno)}.`);
  const come = [
    r.inviata_il ? `Inviata il ${it(r.inviata_il)}` : '',
    r.caricata_il ? `caricata nel gestionale il ${it(r.caricata_il)}` : '',
    testo(r.file_nomi) ? `dai file ${testo(r.file_nomi)}` : '',
  ].filter(Boolean);
  if (come.length) righe.push(come.join(', ') + '.');
  // I conteggi della lista sono della SOLA RETE (regola 3): lista e target sono
  // di rete, e gli ordini ACI o di extra raccolta finiti in lista restano fuori
  // dai suoi conti. Detto, altrimenti a distanza di mesi quel numero si legge
  // come "tutte le richieste".
  righe.push(`${plurale(numero(r.richieste), 'richiesta di rete', 'richieste di rete')}${numero(r.prioritarie) ? `, di cui ${numero(r.prioritarie)} prioritarie` : ''}. Gli ordini ACI o di extra raccolta eventualmente finiti in lista restano fuori da questo conto.`);
  const voci = (avvisi || []).map(a => testo(typeof a === 'string' ? a : a && (a.testo || a.messaggio))).filter(Boolean);
  if (voci.length) righe.push('Avvisi di lettura — ' + elenco(voci, 10).join('; ') + '.');
  return tagliaStoria(righe.join('\n'));
}

/**
 * La storia di un controllo dell'evasione. Gli alert sono gia' frasi italiane
 * complete: si tengono quelle alte e medie, che sono la storia vera del mese, e le
 * informative si lasciano andare col dettaglio.
 */
export function storiaControllo(c, alert = null, esito = null) {
  const r = c || {};
  const righe = [];
  righe.push(`Controllo dell'evasione di ${testo(r.raccoglitore_nome) || testo(r.raccoglitore_chiave)}, mese ${numero(r.mese)}/${numero(r.anno)}, eseguito il ${it(r.eseguito_il)}${r.dati_al ? ` sui dati fino al ${it(r.dati_al)}` : ''}.`);
  const conti = [
    `${plurale(numero(r.richieste), 'richiesta in lista', 'richieste in lista')}`,
    `${numero(r.evase)} evase`,
    numero(r.evase_da_altri) ? `${numero(r.evase_da_altri)} evase da altri` : '',
    `${numero(r.aperte)} ancora aperte`,
    numero(r.prioritarie_aperte) ? `${numero(r.prioritarie_aperte)} prioritarie aperte` : '',
    numero(r.arretrate_aperte) ? `${numero(r.arretrate_aperte)} arretrate aperte` : '',
    numero(r.fuori_ordine) ? `${numero(r.fuori_ordine)} evase fuori ordine` : '',
    numero(r.trascurate) ? `${numero(r.trascurate)} trascurate` : '',
    numero(r.fuori_lista) ? `${numero(r.fuori_lista)} evase fuori lista` : '',
    numero(r.annullate) ? `${numero(r.annullate)} annullate sul portale` : '',
    numero(r.riassegnate) ? `${numero(r.riassegnate)} riassegnate` : '',
    numero(r.non_piu_presenti) ? `${numero(r.non_piu_presenti)} non piu' presenti` : '',
  ].filter(Boolean).join(', ');
  righe.push(conti + '.');
  const pesi = [
    numero(r.raccolto_kg) ? `raccolto ${formatoKg(numero(r.raccolto_kg))} kg` : '',
    numero(r.target_kg) ? `target ${formatoKg(numero(r.target_kg))} kg` : '',
    numero(r.proiezione_kg) ? `proiezione a fine mese ${formatoKg(numero(r.proiezione_kg))} kg` : '',
  ].filter(Boolean);
  if (pesi.length) righe.push('Sulla rete: ' + pesi.join(', ') + '.');

  const voci = (alert || []).filter(a => a && (a.gravita === 'alta' || a.gravita === 'media')).map(a => testo(a.testo)).filter(Boolean);
  if (voci.length) righe.push('Segnalazioni — ' + elenco(voci, 10).join(' ') );
  else if (numero(r.alert_alti)) righe.push(`${plurale(numero(r.alert_alti), 'segnalazione alta', 'segnalazioni alte')} su ${numero(r.alert_totali)} in tutto.`);

  const e = esito || {};
  const aperte = (e.righe || []).filter(x => x && x.stato === 'aperta');
  if (aperte.length) {
    righe.push('Restavano aperte — ' + elenco(aperte.map(x =>
      `${testo(x.id_ordine)}${testo(x.produttore) ? ` (${testo(x.produttore)}` : ''}${testo(x.comune) ? `, ${testo(x.comune)}` : ''}${testo(x.produttore) ? ')' : ''}${x.prioritaria ? ', prioritaria' : ''}`
    ), 20).join('; ') + '.');
  }
  return tagliaStoria(righe.join('\n'));
}

// === CONSUNTIVO DI CHIUSURA MESE ===
//
// Qui la storia NON riporta ne' l'importo previsto ne' lo scarto con la
// fatturazione passiva: il record lo legge chiunque (rls read: true) e i costi
// sono dell'amministratore. L'importo scritto dal fornitore sul suo consuntivo e'
// gia' un campo del record e si puo' dire.

/** La storia di un consuntivo di chiusura mese di un fornitore. */
export function storiaConsuntivo(c, esitoCompleto = null) {
  const r = c || {};
  const righe = [];
  const canale = testo(r.canale).replace('_', ' ');
  righe.push(`Consuntivo di ${testo(r.fornitore)} come ${testo(r.ruolo)}, ${canale}, mese ${numero(r.mese)}/${numero(r.anno)}${testo(r.file_nome) ? `, file «${testo(r.file_nome)}»` : ''}.`);
  const quando = [
    r.caricato_il ? `Caricato il ${it(r.caricato_il)}` : '',
    r.confrontato_il ? `confrontato il ${it(r.confrontato_il)}` : '',
  ].filter(Boolean);
  if (quando.length) righe.push(quando.join(', ') + '.');

  const e = esitoCompleto || {};
  const conf = e.confronto || {};
  righe.push(r.quadra
    ? 'Il consuntivo corrispondeva ai nostri movimenti.'
    : 'Il consuntivo NON corrispondeva ai nostri movimenti.');
  const numeri = [
    (conf.voci || []).length ? plurale((conf.voci || []).length, 'formulario confrontato', 'formulari confrontati') : '',
    numero(conf.uguali) ? `${numero(conf.uguali)} uguali` : '',
    numero(conf.peso_diverso) ? `${numero(conf.peso_diverso)} con un peso diverso` : '',
    numero(conf.solo_consuntivo) ? `${numero(conf.solo_consuntivo)} che noi non avevamo (${formatoKg(numero(conf.kg_solo_consuntivo))} kg)` : '',
    numero(conf.solo_gestionale) ? `${numero(conf.solo_gestionale)} che avevamo noi e il consuntivo non riportava (${formatoKg(numero(conf.kg_solo_gestionale))} kg)` : '',
    numero(conf.senza_chiave) ? `${numero(conf.senza_chiave)} righe senza formulario ne' ordine` : '',
  ].filter(Boolean).join(', ');
  if (numeri) righe.push(numeri + '.');
  const pesi = [
    numero(conf.totale_consuntivo_kg) ? `consuntivo ${formatoKg(numero(conf.totale_consuntivo_kg))} kg` : '',
    numero(conf.totale_gestionale_kg) ? `gestionale ${formatoKg(numero(conf.totale_gestionale_kg))} kg` : '',
  ].filter(Boolean);
  if (pesi.length) righe.push('Chili a confronto: ' + pesi.join(', ') + '.');
  if (r.importo_consuntivo !== undefined && r.importo_consuntivo !== null && r.importo_consuntivo !== '') {
    righe.push(`Importo scritto sul consuntivo: ${Number(r.importo_consuntivo).toFixed(2)} euro.`);
  }
  const nonControllato = ((e.esito || {}).non_controllato) || [];
  if (nonControllato.length) righe.push(`Non si e' potuto controllare: ${nonControllato.map(testo).filter(Boolean).join('; ')}.`);
  if (testo(r.note)) righe.push(`Note: ${testo(r.note)}.`);
  return tagliaStoria(righe.join('\n'));
}

/** La frase che si aggiunge in coda a ogni storia quando il dettaglio viene tolto. */
export const MOTIVO_GIORNI = `era stato caricato da oltre ${GIORNI_CONSERVAZIONE} giorni`;
export const MOTIVO_MESE = 'il suo mese e\' chiuso e non si controlla piu\'';
export const MOTIVO_LISTA_NUOVA = 'e\' arrivata una lista piu\' recente dello stesso raccoglitore';
export const motivoSuperato = (quando) => `e\' stato superato dal controllo del ${it(quando) || 'giorno dopo'}`;

/**
 * La frase che si aggiunge in coda a ogni storia quando il dettaglio viene tolto.
 * Il motivo va detto per esteso e va detto VERO: un controllo superato in giornata
 * a cui si scrivesse "caricato da oltre quaranta giorni" resterebbe una bugia
 * nell'archivio per sempre.
 */
export function nota(oggi, motivo = MOTIVO_GIORNI) {
  return `Dettaglio tolto il ${it(oggi)}: ${motivo}. Restano i numeri di sintesi e questa storia; le righe lette e il confronto riga per riga non ci sono piu'.`;
}

/** Storia piu' nota, come si scrive sul record. */
export function conNota(storia, oggi, motivo = MOTIVO_GIORNI) {
  return tagliaStoria(`${testo(storia)}\n\n${nota(oggi, motivo)}`, LUNGHEZZA_STORIA + 300);
}

// === TOGLIERE IL DETTAGLIO ===
//
// Da qui in giu' si tocca la piattaforma: le prove si fermano sopra.

/**
 * Toglie a un documento le righe lette e il confronto riga per riga, e ci scrive
 * sopra la storia. Il record resta.
 *
 * L'ORDINE CONTA. Prima si svuotano i campi e si scrive la storia, poi si
 * cancellano le parti in ContenutoEsteso, e solo alla fine si segna il giorno.
 * Se si cancellassero prima le parti e l'aggiornamento non riuscisse, nel campo
 * resterebbe il segnaposto "@parti:N" senza le parti dietro: non e' un campo
 * vuoto, e' un campo rotto, e leggiCampo lancia invece di mostrare la storia.
 * Il giorno si segna per ultimo perche' un alleggerimento interrotto a meta'
 * venga ripreso la volta dopo, invece di risultare gia' fatto: daAlleggerire
 * riconosce i campi vuoti con la storia scritta e senza il giorno, e ripassa di
 * qui a finire il lavoro.
 *
 * Una storia gia' scritta NON si riscrive. Al secondo passaggio l'esito non c'e'
 * piu', e ricalcolarla darebbe una storia povera al posto di quella ricca: il
 * lavoro di riprendere un alleggerimento non deve distruggere quello che il primo
 * giro aveva salvato.
 */
export async function togliIlDettaglio(base44, entita, record, storia, oggi, motivo = MOTIVO_GIORNI) {
  const svc = base44.asServiceRole.entities;
  const campi = {};
  for (const c of CAMPI_PESANTI[entita] || []) campi[c] = '';
  campi.storia = testo(record.storia) || conNota(storia, oggi, motivo);
  await svc[entita].update(record.id, campi);
  // Senza il nome del campo cancella le parti di TUTTI i campi del record con una
  // sola richiesta: la storia non e' mai spezzata, quindi non c'e' niente da
  // salvare.
  await eliminaCampo(base44, entita, record.id);
  await svc[entita].update(record.id, { alleggerito_il: oggi });
}
