// Il cruscotto: che cosa richiede attenzione, in un posto solo.
//
// Ogni modulo ha le sue anomalie nella sua pagina, e per sapere se c'era qualcosa
// da fare bisognava aprirle tutte. Qui si raccolgono, leggendo solo archivi
// piccoli (alert, registro dei caricamenti, ordini aperti, documenti di
// fatturazione, prefatture, riepilogo della qualifica, richieste del
// consorzio): niente che costi quanto un ricalcolo. Le anomalie di prezzo della
// fatturazione arrivano a parte, dal margine, che la pagina chiede dopo.
//
// Funzioni pure: ricevono gli elenchi gia' letti. Rete, ACI ed extra raccolta
// restano separati anche qui.
import { giornoPortale } from "./giornoItaliano.ts";
import { statoRichiesta, evasaInParte, oltreIlTermine } from "./richiesteEct.ts";
import { giorniFa, chiSiScosta, notaDelGiorno, scostamentiAci, notaAci } from "./indicatoriGiorno.ts";
import { surplusNonDisattivati, NOMI_ORIGINE } from "./surplus.ts";
import { campoRiservato } from "./campiTracciati.ts";
import { formatoKg, formatoTonnellate } from "./formato.ts";
import { commessaDellAnno } from "./annoTarget.ts";
import { regioniDellAnno, scartiDalContratto } from "./attesoContratto.ts";
import { statoDelRegistro, avvisoCaricamento, nomeArchivio, RIGHE_REGISTRO } from "./registroCaricamenti.ts";
import { ordiniEseguiti, voceEseguiti } from "./ordiniEseguiti.ts";
import { vociPromemoriaCopia, AREA_COPIA } from "./promemoriaCopia.ts";

export const MESI_CRUSCOTTO = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
// I tre documenti di un mese della fatturazione attiva, uno per canale.
export const CANALI_ATTIVA = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];
const NOMI_CANALI_ATTIVA = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
// Oltre questi giorni un archivio si considera non aggiornato.
export const GIORNI_DATI_VECCHI = 10;

// GLI ARCHIVI IN CUI UN GIORNO SENZA RIGHE VUOL DIRE UN FILE VECCHIO (chiusura
// dell'audit, 11/10/2026). Il giorno del caricamento non dice fino a dove
// arrivano i dati: un file scaricato dal portale tre settimane fa e caricato
// ieri ha dentro i dati di tre settimane fa. Ma il «fino al» dice un file
// vecchio solo dove un vuoto di giorni non e' un periodo senza movimenti: le
// primarie, e la fotografia dei non dichiarati, che e' il giorno in cui si
// carica. Nelle terziarie, nelle secondarie e nelle dichiarazioni di
// trattamento settimane senza righe sono normali (file del 26/09/2026: 63 giorni
// senza terziarie terminate fra dicembre 2025 e febbraio 2026, e l'ultima e' del
// 19/07; nel report delle dichiarazioni 29 giorni senza una dichiarazione SMOCO
// fra maggio e giugno 2026): li' la voce gialla resta sul giorno del caricamento,
// e il «fino al» si mostra soltanto. Altrimenti la dashboard griderebbe al lupo
// ogni estate, e un avviso che grida al lupo fa ignorare quelli veri.
export const FINO_AL_FITTO = ['primarie', 'ordini_non_dichiarati'];

// ANCHE LE PRIMARIE HANNO I LORO BUCHI (revisione della chiusura, 11/10/2026).
// Si era scritto che si chiudono tutti i giorni, e la voce gialla si accendeva
// quando il «fino al» aveva piu' di dieci giorni. Nel file vero (PRIMARIE.xlsx
// del 09/10/2026, 6.028 terminati SMOCO con la fine trasporto) non c'e' nessuna
// fine trasporto fra il 22/12/2025 e l'08/01/2026 (17 giorni) ne' fra il 07/08 e
// il 18/08/2026 (11 giorni): un file caricato il 05/01 la mattina stessa, completo,
// faceva dire «dati fino al 22/12/2025 ... fermi a quel giorno», e dal 2 al 7
// gennaio succedeva ogni anno. Ora la voce sul «fino al» non guarda oggi ma lo
// scarto fra il giorno del caricamento e l'ultimo giorno dentro il file, e si
// accende oltre tre settimane: piu' del buco piu' lungo del file vero, con
// qualche giorno di margine per un Natale con un fine settimana in piu' o un
// file scaricato il giorno prima. Un file che invecchia senza essere ricaricato
// lo dice gia' l'altra voce, sul giorno del caricamento, dopo dieci giorni.
export const GIORNI_SCARTO_FINO_AL = 21;

const ilGiorno = (g) => String(g || '').split('-').reverse().join('/');
const giorniFra = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);

/** Da quanto aspettano gli ordini aperti: entro 30, 31-60, oltre 60 giorni, e il piu' vecchio. */
export function etaArretrato(ordini, oggi) {
  const eta = { totale: 0, entro_30: 0, da_31_a_60: 0, oltre_60: 0, kg_oltre_60: 0, senza_data: 0, piu_vecchio: null };
  for (const r of ordini || []) {
    eta.totale++;
    const g = giornoPortale(r.ordine_immesso_il);
    if (!g) { eta.senza_data++; continue; }
    // L'immissione e' l'ora del portale, l'ora italiana scritta con la Z: i
    // giorni si contano dal giorno scritto nel file (giornoPortale, difetto 9,
    // 16/10/2026). Con giornoRoma un ordine immesso dopo le 22 d'estate o dopo
    // le 23 d'inverno aspettava un giorno in meno.
    const giorni = giorniFra(g, oggi);
    if (giorni <= 30) eta.entro_30++; else if (giorni <= 60) eta.da_31_a_60++; else { eta.oltre_60++; eta.kg_oltre_60 += Number(r.peso_stimato) || 0; }
    if (!eta.piu_vecchio || giorni > eta.piu_vecchio.giorni) eta.piu_vecchio = { giorni, id_ordine: r.id_ordine || '', ragione_sociale: r.ragione_sociale || r.punto_di_raccolta || '', provincia: r.provincia || '', immesso_il: g, partner_operativo: r.partner_operativo || '' };
  }
  return eta;
}

/**
 * A quando sono aggiornati i dati, file per file, e i caricamenti che rendono un
 * archivio inaffidabile.
 *
 * UNA REGOLA SOLA (chiusura dell'audit, 11/10/2026). Qui c'era una seconda
 * statoCaricamenti, con le sue regole: conosceva solo «successo» e «in_corso»
 * scaduto. Dopo una riscrittura delle primarie finita «parziale» i motori
 * (alert, verifiche, predittivita', il programma del mercoledi') rinviavano con
 * «il caricamento va ripetuto», e la dashboard taceva e mostrava la data
 * dell'ultimo successo come se i dati fossero freschi. Ora la regola e' quella
 * dei motori, in registroCaricamenti.ts (bloccante, riuscito, superato da un
 * caricamento riuscito dopo): una riscrittura non riuscita compare come
 * «Caricamento non riuscito: ricarica il file», e la freschezza e' quella
 * dell'ultimo caricamento riuscito.
 *
 * logs: le righe del registro (di qualunque tipo, in qualunque ordine). finoAl:
 * { tipo_file: { fino_al, cosa, perche } } da finoAlPerTipo (statoArchivi.ts);
 * senza, la freschezza si misura solo sul giorno del caricamento.
 */
export function freschezzaArchivi(logs, oggi, adessoMs, tipi, finoAl = {}) {
  const stato = statoDelRegistro(logs || [], tipi, adessoMs);
  const nelRegistro = (t) => (logs || []).filter(l => l && l.tipo_file === t).length;
  const archivi = tipi.map(t => {
    const u = stato.ultimi[t] || null;
    const aperto = stato.in_corso.find(x => x.tipo_file === t) || null;
    const il = (u && u.data) || null;
    const f = (finoAl && finoAl[t]) || null;
    const finoAlGiorno = (f && f.fino_al) || null;
    const giorniFaCaricato = il ? giorniFra(il, oggi) : null;
    const giorniFaFinoAl = finoAlGiorno ? giorniFra(finoAlGiorno, oggi) : null;
    // Quanti giorni prima del caricamento si fermano i dati del file. Negativo
    // se il «fino al» e' nel futuro (una data sbagliata nel file): non fa
    // sembrare fresco un file vecchio, perche' allora conta il caricamento.
    const scartoFinoAl = il && finoAlGiorno ? giorniFra(finoAlGiorno, il) : null;
    const suFinoAl = FINO_AL_FITTO.includes(t) && scartoFinoAl !== null && scartoFinoAl > GIORNI_SCARTO_FINO_AL;
    const vecchioCaricamento = giorniFaCaricato !== null && giorniFaCaricato > GIORNI_DATI_VECCHI;
    const eta = suFinoAl ? giorniFaFinoAl : giorniFaCaricato;
    return {
      tipo_file: t, nome: nomeArchivio(t),
      nome_file: (u && u.nome_file) || '', utente: (u && u.utente) || '',
      // L'istante in cui il caricamento si e' chiuso: dice se un file e' entrato
      // dopo il controllo della notte (quadroImpianti), anche lo stesso giorno.
      il, concluso_il: (u && u.concluso_il) || null, giorni_fa: giorniFaCaricato,
      fino_al: finoAlGiorno, fino_al_cosa: (f && f.cosa) || '', fino_al_perche: (f && f.perche) || '', fino_al_giorni_fa: giorniFaFinoAl,
      fino_al_scarto: scartoFinoAl,
      eta_giorni: eta, misurata_su: suFinoAl ? 'fino_al' : 'caricamento',
      vecchio: suFinoAl || vecchioCaricamento,
      // Le righe del tipo nel registro: «mai caricato» e «nessuno degli ultimi
      // riuscito» sono due cose diverse.
      righe_nel_registro: nelRegistro(t),
      stato: aperto ? avvisoCaricamento(aperto).stato : null,
    };
  });
  const inCorso = stato.in_corso.map(x => ({ ...x, nome: nomeArchivio(x.tipo_file), avviso: avvisoCaricamento(x) }));
  return {
    archivi,
    in_corso: inCorso,
    // Quelli da ricaricare: interrotti o non riusciti (non chi sta caricando adesso).
    interrotti: inCorso.filter(x => x.avviso.stato !== 'in_corso'),
  };
}

/**
 * Lo stato dei mesi della fatturazione attiva: elaborato, prefattura caricata,
 * chiuso. Solo i mesi gia' finiti.
 *
 * Rete, ACI ed extra raccolta hanno ciascuno il suo documento e il suo ciclo di
 * vita: lo stato del mese da solo non basta, perche' "elaborato" bastava che lo
 * fosse un canale e uno stato "chiusa / approvata" non diceva quale dei due era
 * indietro. Percio' accanto allo stato del mese c'e' quello di ogni canale, e
 * `canali_mancanti` dice quali documenti mancano in un mese elaborato. I
 * documenti senza canale (tipologia) valgono solo per lo stato del mese.
 * Un mese e' chiuso quando lo sono tutti e tre i canali: con la rete e l'ACI
 * chiuse e l'extra raccolta mai elaborata risultava chiuso, e la dashboard lo
 * coloriva di verde mentre l'elenco diceva che un canale mancava.
 */
export function statoMesiAttiva(documenti, prefatture, anno, oggi) {
  const annoNum = Number(anno);
  const ultimoFinito = Number(oggi.slice(0, 4)) > annoNum ? 11 : Number(oggi.slice(5, 7)) - 2;   // il mese in corso non e' ancora da fatturare
  const statoDi = (docs) => {
    const stati = [...new Set(docs.map(d => d.stato))];
    return !docs.length ? 'da elaborare' : stati.length === 1 ? stati[0] : stati.join(' / ');
  };
  const meseDi = (a, m) => {
    const nome = MESI_CRUSCOTTO[m];
    const docs = (documenti || []).filter(d => d.tipo === 'ATTIVA' && Number(d.anno) === a && d.mese === nome && !d.superato && d.stato !== 'bozza');
    const conCanale = docs.some(d => CANALI_ATTIVA.includes(d.tipologia));
    const canali = conCanale ? Object.fromEntries(CANALI_ATTIVA.map(k => {
      const dk = docs.filter(d => d.tipologia === k);
      return [k, { elaborato: dk.length > 0, stato: statoDi(dk), chiuso: dk.length > 0 && dk.every(d => d.stato === 'chiusa') }];
    })) : null;
    return {
      mese: nome,
      anno: a,
      // Il nome a video: col suo anno quando non e' quello che si guarda (e con
      // mesi di due anni nell'elenco sempre, qui sotto).
      etichetta: a === annoNum ? nome : `${nome} ${a}`,
      elaborato: docs.length > 0,
      stato: statoDi(docs),
      chiuso: canali ? CANALI_ATTIVA.every(k => canali[k].chiuso) : docs.length > 0 && docs.every(d => d.stato === 'chiusa'),
      prefattura: (prefatture || []).some(p => Number(p.anno) === a && p.mese === nome && !p.superata),
      canali,
      canali_mancanti: canali ? CANALI_ATTIVA.filter(k => !canali[k].elaborato) : [],
    };
  };
  // I MESI DELL'ANNO PRIMA ANCORA APERTI (chiusura dell'audit, 11/10/2026).
  // L'ultimo mese finito si contava sull'anno in corso: il 15 gennaio l'elenco
  // era vuoto e il 10 febbraio c'era solo gennaio. Dicembre, e un novembre
  // ancora aperto, sparivano dalla dashboard proprio quando vanno chiusi. Si era
  // corretto per gennaio e febbraio, e il 1° marzo sparivano di nuovo: un
  // dicembre mai elaborato non diventa a posto perche' e' cominciato marzo.
  // Ora i mesi dell'anno prima non ancora chiusi restano finche' non si
  // chiudono, in qualunque mese; quelli chiusi sono a posto e non hanno niente
  // da dire. Si parte dal primo mese dell'anno prima che ha un documento: i
  // mesi fatturati prima che il gestionale esistesse non si sono mai elaborati
  // qui, e non c'e' niente da chiudere (un anno senza documenti non si guarda).
  const mesi = [];
  for (const a of anniMesiAttiva(annoNum, oggi)) {
    if (a === annoNum) continue;
    const mesiPrima = Array.from({ length: 12 }, (_, m) => meseDi(a, m));
    const primo = mesiPrima.findIndex(x => x.elaborato);
    if (primo < 0) continue;
    for (const x of mesiPrima.slice(primo)) if (!x.chiuso) mesi.push(x);
  }
  for (let m = 0; m <= ultimoFinito; m++) mesi.push(meseDi(annoNum, m));
  // CON MESI DI PIU' ANNI, OGNI MESE COL SUO ANNO (prova del cambio d'anno,
  // 15/10/2026, difetto 37). Il 10/02/2027 «Da gestire» scriveva «Ottobre 2026,
  // Novembre 2026, Dicembre 2026, Gennaio»: il mese dell'anno guardato era senza
  // anno in mezzo a quelli dell'anno prima. Quando l'elenco ha mesi di due anni
  // tutte le etichette portano l'anno (le stesse servono a «Prefattura non
  // caricata»); con i mesi di un anno solo resta com'era.
  if (new Set(mesi.map(x => x.anno)).size > 1) for (const x of mesi) x.etichetta = `${x.mese} ${x.anno}`;
  return mesi;
}

/**
 * Gli anni di cui servono i documenti della fatturazione attiva: quello che si
 * guarda e, se e' l'anno in corso, anche quello prima, in qualunque mese (i suoi
 * mesi non ancora chiusi restano finche' non si chiudono). Guardando un anno
 * passato si vedono i suoi dodici mesi, e basta.
 */
export function anniMesiAttiva(anno, oggi) {
  const annoNum = Number(anno);
  const annoOggi = Number(String(oggi).slice(0, 4));
  return annoNum === annoOggi ? [annoNum - 1, annoNum] : [annoNum];
}

/**
 * Se servono le prefatture dell'anno prima: solo se c'e' un suo documento
 * elaborato e non ancora chiuso, l'unico caso in cui la dashboard chiede la
 * prefattura di quel mese. Le prefatture portano le righe del portale, e
 * leggerle tutte a ogni apertura della dashboard per niente costa.
 */
export function servonoPrefattureAnnoPrima(documenti, anno, oggi) {
  const anni = anniMesiAttiva(anno, oggi);
  if (anni.length < 2) return false;
  return (documenti || []).some(d => d && d.tipo === 'ATTIVA' && Number(d.anno) === anni[0] && !d.superato && d.stato !== 'bozza' && d.stato !== 'chiusa');
}

const GRAVITA = { critico: 0, attenzione: 1, info: 2 };

// Gli alert delle date obbligatorie (immissione, inizio e fine trasporto,
// regola dell'utente del 22/09/2026): il motore degli alert ne apre uno per
// modulo e canale a ogni caricamento, con quanti ordini e quanti senza fine
// trasporto. Qui si leggono quelli, e non le primarie: il cruscotto legge solo
// archivi piccoli. Ognuno e' una voce sua, col collegamento al modulo dove gli
// ordini si vedono. Dal 22/09/2026 anche le schede di extra raccolta avviano il
// motore quando si salvano (AlertEngineAutoRun e dopoCaricamento).
const REGOLA_DATE = 'date_obbligatorie';
export const eAlertDate = (a) => String((a && a.regola_id) || '').startsWith(REGOLA_DATE);
const LINK_MODULO = { primarie_rete: '/primarie-rete', primarie_aci: '/primarie-aci', secondarie: '/secondarie', terziarie: '/terziarie', extra_raccolta: '/extra-raccolta' };
const NOME_MODULO = { primarie_rete: 'Primarie rete', primarie_aci: 'Primarie ACI', secondarie: 'Secondarie', terziarie: 'Terziarie', extra_raccolta: 'Extra raccolta' };
const NOME_CANALE_DATE = { rete: 'rete', ACI: 'ACI', extra: 'extra raccolta' };

// LA SEZIONE DELLA DASHBOARD DI UNA VOCE (migliorie dell'11/10/2026). La pagina
// e' il quadro della commessa, a sezioni per canale; «Da gestire» resta l'unico
// elenco dei problemi, e una sezione mostra solo il segno «2 da gestire» che
// porta alle sue voci. Il campo dice quale: le date per modulo, l'arretrato per
// canale, il resto per area.
const SEZIONE_DATE = { primarie_rete: 'rete', primarie_aci: 'aci', extra_raccolta: 'extra', secondarie: 'impianti', terziarie: 'impianti' };
const SEZIONE_AREA = {
  'Alert': 'generale', 'Target raccoglitori': 'rete', 'Date obbligatorie': 'generale', 'Caricamento dati': 'dati',
  'Manutenzione': 'dati', 'Arretrato': 'rete', 'Fatturazione attiva': 'fatturazione', 'Fatturazione passiva': 'economia',
  'Qualifica fornitori': 'generale', 'Richieste ECT': 'rete', 'Punti di raccolta': 'generale', 'Giacenze': 'impianti',
  'Dichiarazioni': 'impianti', 'Nuovo anno': 'generale', 'Surplus sulle tariffe': 'fatturazione',
  'Errori del sito': 'dati', [AREA_COPIA]: 'dati',
};
export const SEZIONI_DASHBOARD = ['rete', 'aci', 'extra', 'impianti', 'fatturazione', 'economia', 'dati', 'generale'];
/** La sezione di una voce: la sua, se l'ha scritta; altrimenti quella della sua area. */
export const sezioneDellaVoce = (v) => (v && SEZIONI_DASHBOARD.includes(v.sezione) ? v.sezione : SEZIONE_AREA[v && v.area] || 'generale');

// Le aree di cui EcoTyna sa leggere i dati coi suoi strumenti
// (strumentiAssistente.ts): per le altre - i lavori della notte, l'anno nuovo -
// non c'e' niente da chiederle, e il pulsante non si mostra. Dal 14/10/2026
// nemmeno per gli errori del sito: EcoTyna non legge quel registro, che e' del
// solo amministratore. Ne' per la copia di sicurezza (chiusura del 15/10/2026):
// e' un file che si scarica, non un dato da chiedere.
const AREE_SENZA_ECOTYNA = new Set(['Manutenzione', 'Nuovo anno', 'Errori del sito', AREA_COPIA]);
export const siChiedeAEcotyna = (v) => !!v && !AREE_SENZA_ECOTYNA.has(v.area) && v.origine !== 'presidi';

/** La voce dell'elenco per un alert delle date obbligatorie. */
function voceDate(a) {
  const quanti = Number(a.quanti);
  const senzaFine = Number(a.senza_fine) || 0;
  // Un alert scritto senza i conteggi si dice col suo titolo.
  const dove = `${NOME_MODULO[a.modulo] || a.modulo || 'Movimenti'}${a.modulo === 'secondarie' && a.canale ? ` · ${NOME_CANALE_DATE[a.canale] || a.canale}` : ''}`;
  const titolo = Number.isFinite(quanti) && quanti > 0
    ? `${dove}: ${quanti} ${quanti === 1 ? 'ordine terminato' : 'ordini terminati'} con date obbligatorie mancanti o incoerenti`
    : (a.titolo || `${dove}: ordini terminati con date obbligatorie mancanti o incoerenti`);
  const dettaglio = `${senzaFine ? `Di cui ${senzaFine} senza fine trasporto: fuori da ogni periodo, fatturazione e target finché la data manca. ` : ''}`
    + `Immissione, inizio e fine trasporto sono obbligatorie: ${a.modulo === 'extra_raccolta' ? 'le date si inseriscono nella scheda' : 'le date si correggono nel file del portale e si ricaricano'}. L'elenco degli ordini è nell'alert.`;
  return { gravita: a.severita === 'critico' || senzaFine ? 'critico' : 'attenzione', titolo, dettaglio, link: LINK_MODULO[a.modulo] || '/alert-engine' };
}

// GLI AVVISI DEI TARGET DEI RACCOGLITORI, UNA VOCE PER MESE (migliorie
// dell'11/10/2026). checkTargetAlerts li scrive come Alert (entity_type
// TargetMensile, record_id raccoglitore|regione|mese|anno): finivano nella voce
// generica «N alert aperti» col titolo intero di ognuno, e in fondo alla pagina
// un pannello li ricalcolava una seconda volta, con una lettura in piu'. Ora
// escono dalla voce generica e fanno una voce per mese, che porta all'Andamento
// di Target & Status dell'anno; il conto alert.totale resta di tutti.
export const eAlertTarget = (a) => !!a && a.entity_type === 'TargetMensile' && periodoAlertTarget(a) !== null;
export function periodoAlertTarget(a) {
  const parti = String((a && a.record_id) || '').split('|');
  if (parti.length < 4) return null;
  const mese = parti[parti.length - 2];
  const anno = Number(parti[parti.length - 1]);
  return MESI_CRUSCOTTO.includes(mese) && anno ? { mese, anno, raccoglitore: parti.slice(0, parti.length - 3).join('|'), regione: parti[parti.length - 3] } : null;
}
function vociTarget(alerts) {
  const perMese = new Map();
  for (const a of alerts) {
    const p = periodoAlertTarget(a);
    const k = `${p.mese}|${p.anno}`;
    if (!perMese.has(k)) perMese.set(k, { ...p, righe: [] });
    perMese.get(k).righe.push({ a, raccoglitore: p.raccoglitore, regione: p.regione });
  }
  return [...perMese.values()]
    .sort((x, y) => (y.anno * 12 + MESI_CRUSCOTTO.indexOf(y.mese)) - (x.anno * 12 + MESI_CRUSCOTTO.indexOf(x.mese)))
    .map(m => {
      const n = m.righe.length;
      const nonRaggiunti = m.righe.filter(r => /^Target non raggiunto/.test(String(r.a.titolo || ''))).length;
      const aRischio = n - nonRaggiunti;
      const nomi = [...new Set(m.righe.map(r => r.raccoglitore).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'it'));
      // UN RACCOGLITORE IN PIU' REGIONI E' UN TARGET PER REGIONE (13/10/2026). Sul
      // sito agosto diceva «5 raccoglitori» e poi tre nomi senza «e altri»: SMOCO
      // aveva tre target, uno per regione. Il titolo conta i raccoglitori, dice i
      // target quando sono di piu', e il nome porta le sue regioni.
      const regioniDi = new Map();
      for (const r of m.righe) {
        if (!r.raccoglitore) continue;
        if (!regioniDi.has(r.raccoglitore)) regioniDi.set(r.raccoglitore, new Set());
        if (r.regione) regioniDi.get(r.raccoglitore).add(r.regione);
      }
      const etichetta = (nome) => {
        const reg = [...(regioniDi.get(nome) || [])].sort((x, y) => x.localeCompare(y, 'it'));
        return reg.length > 1 ? `${nome} (${reg.join(', ')})` : nome;
      };
      const quanti = nomi.length || n;
      const target = quanti < n ? ` (${n} target, uno per regione)` : '';
      // «A RISCHIO» E' SOTTO IL 90%, NON SOTTO IL 70% (revisione delle migliorie,
      // 11/10/2026). checkTargetAlerts apre l'alert sotto il 70% della proiezione e
      // lo tiene aperto, aggiornato, finche' la proiezione resta sotto il 90%: un
      // alert aperto all'82% diceva «sotto il 70%». La soglia vera dell'alert
      // aperto e' il 90%; il numero di ognuno e' nell'alert.
      const parti = [nonRaggiunti ? `${nonRaggiunti} ${nonRaggiunti === 1 ? 'non raggiunto' : 'non raggiunti'}` : '',
        aRischio ? `${aRischio} a rischio (proiezione di fine mese sotto il 90% del target)` : ''].filter(Boolean).join(', ');
      return {
        area: 'Target raccoglitori',
        gravita: m.righe.some(r => r.a.severita === 'critico') ? 'critico' : 'attenzione',
        titolo: `${quanti === 1 ? 'Un raccoglitore' : `${quanti} raccoglitori`} sotto il target di ${m.mese} ${m.anno}${target}`,
        dettaglio: `${parti}: ${nomi.slice(0, 3).map(etichetta).join(', ')}${nomi.length > 3 ? ` e altri ${nomi.length - 3}` : ''}. Il dettaglio di ognuno è nell'alert.`,
        link: `/target-status?tab=andamento&anno=${m.anno}`,
        chiave: `target:${m.mese}|${m.anno}`,
        sezione: 'rete',
        // Nascosta, torna se sale il conto dei non raggiunti o degli a rischio
        // (un raccoglitore che entra, un mese che si chiude e fa di un «a
        // rischio» un «non raggiunto»), o se c'e' un raccoglitore nuovo anche a
        // conto uguale (elementi: BETA al posto di ALFA, revisione delle migliorie,
        // 11/10/2026); non torna se uno esce. La firma non ha i nomi, che
        // cambierebbero anche quando la voce migliora.
        firma: `${m.mese}|${m.anno}`,
        misure: [nonRaggiunti, aRischio],
        elementi: [...new Set(m.righe.map(r => (r.regione ? `${r.raccoglitore} (${r.regione})` : r.raccoglitore)))].sort((x, y) => x.localeCompare(y, 'it')),
      };
    });
}

// Le regole degli alert sono salvate col loro codice (REGOLA_SCOSTAMENTO_TARGET):
// a video si leggono come parole, tenendo maiuscole le sigle.
const SIGLE = new Set(['SLA', 'ACI', 'FIR', 'PFU', 'PDR', 'ECT']);
export function nomeRegola(v) {
  const t = String(v || '').trim();
  if (!/^REGOLA_/.test(t)) return t;
  const parole = t.replace(/^REGOLA_/, '').split('_').filter(Boolean).map(p => (SIGLE.has(p) ? p : p.toLowerCase()));
  const frase = parole.join(' ');
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

// IL SURPLUS DELL'ANNO PRIMA E' FINITO (decisioni dell'utente del 13/10/2026,
// gruppo B).
//
// Il Fuel Surcharge del consorzio vale dal 01/10/2026 al 31/12/2026, e i
// contratti sono annuali senza tacito rinnovo: un surplus non si copia mai da
// solo nell'anno nuovo (preparaAnno non lo porta, regola 5 del 13/10/2026). Se
// il consorzio lo rinnova, il 1° gennaio nessuno se ne accorge: la passiva e
// l'attiva di gennaio escono senza la riga, e la differenza salta fuori solo al
// confronto con la prefattura, a febbraio. Dal 01/01/2027 la dashboard lo
// ricorda: «Fuel Surcharge del 2026: finito il 31/12/2026», col collegamento
// alla linguetta Surplus delle tariffe.
//
// La voce c'e' solo se un surplus e' finito l'anno prima (fine di validita'
// nell'anno prima, non disattivato) e nell'anno in corso non ce n'e' nessuno
// con lo stesso nome: scritto quello nuovo, sparisce da sola. Una voce per
// nome, coi canali che il surplus aveva (un record per canale), mai sommati.
// Solo i surplus con l'importo da Ecotyre: quelli pagati solo da SMOCO, un
// accordo commerciale coi fornitori, sono costi riservati all'amministratore
// in ogni campo (campoRiservato), e questo elenco lo vede chiunque.
//
// Il nome si confronta come lo confronta conflittiSurplus (surplus.ts, che non
// esporta la sua chiaveNome): senza accenti, maiuscole e segni.
const chiaveNomeSurplus = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const giornoSurplus = (v) => String(v || '').trim().slice(0, 10);
const ORDINE_CANALI_SURPLUS = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];
const CANALE_DETTO = { RETE: 'rete', ACI: 'ACI', EXTRA_RACCOLTA: 'extra raccolta' };
// «rete, ACI ed extra raccolta», «rete e ACI»: «ed» solo davanti a una e.
const elencoE = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} ${/^e/i.test(xs[xs.length - 1]) ? 'ed' : 'e'} ${xs[xs.length - 1]}` : xs[0] || '');

/** Le voci dei surplus finiti l'anno prima e non riscritti nell'anno di oggi. */
export function vociSurplusFiniti(surplus, oggi) {
  const anno = Number(String(oggi || '').slice(0, 4));
  if (!anno) return [];
  const vivi = surplusNonDisattivati(surplus).filter(s => s && chiaveNomeSurplus(s.nome));
  // Un surplus dell'anno di oggi con lo stesso nome, di qualunque canale: e'
  // stato riscritto, e la voce non serve piu'.
  const toccaLAnno = (s) => {
    const dal = giornoSurplus(s.data_inizio_validita), al = giornoSurplus(s.data_fine_validita);
    return (!dal || dal <= `${anno}-12-31`) && (!al || al >= `${anno}-01-01`);
  };
  const riscritti = new Set(vivi.filter(toccaLAnno).map(s => chiaveNomeSurplus(s.nome)));
  const gruppi = new Map();
  for (const s of vivi) {
    if (giornoSurplus(s.data_fine_validita).slice(0, 4) !== String(anno - 1)) continue;
    if (campoRiservato('SurplusTariffa', 'nome', s)) continue;
    const k = chiaveNomeSurplus(s.nome);
    if (riscritti.has(k)) continue;
    if (!gruppi.has(k)) gruppi.set(k, []);
    gruppi.get(k).push(s);
  }
  const it = (g) => (g ? g.split('-').reverse().join('/') : '');
  return [...gruppi.entries()].sort(([a], [b]) => a.localeCompare(b, 'it')).map(([k, righe]) => {
    const nome = String(righe[0].nome || '').trim();
    const dal = righe.map(s => giornoSurplus(s.data_inizio_validita)).filter(Boolean).sort()[0] || '';
    const al = righe.map(s => giornoSurplus(s.data_fine_validita)).sort().pop();
    const canali = ORDINE_CANALI_SURPLUS.filter(c => righe.some(s => String(s.tipologia || '').toUpperCase() === c)).map(c => CANALE_DETTO[c]);
    const consorzio = righe.some(s => String(s.origine || '').toUpperCase() === 'CONSORZIO');
    const origine = consorzio ? NOMI_ORIGINE.CONSORZIO : NOMI_ORIGINE.ACCORDO_COMMERCIALE;
    return {
      area: 'Surplus sulle tariffe', gravita: 'info',
      titolo: `${nome} del ${anno - 1}: finito il ${it(al)}`,
      dettaglio: `${nome} (${origine})${dal ? `, dal ${it(dal)} al ${it(al)}` : `, fino al ${it(al)}`}${canali.length ? `, valeva su ${elencoE(canali)}` : ''}. `
        + `Nel ${anno} non c'è: ${consorzio ? 'se il consorzio lo rinnova' : "se l'accordo si rinnova"}, va riscritto con le date nuove nella linguetta «Surplus» delle tariffe. `
        + 'Non si copia da solo nell’anno nuovo, perché i contratti sono annuali: senza, attiva e passiva escono senza la sua riga.',
      link: '/fatturazione?tab=tariffe&sezione=surplus',
      chiave: `surplus-finito:${k}|${anno - 1}`,
      sezione: 'fatturazione',
    };
  });
}

// I RACCOGLITORI CHE NON FANNO IL CONTRATTO (chiusura del giro delle decisioni,
// 14/10/2026, sulla richiesta dell'utente dello stesso giorno).
//
// L'utente aveva aggiunto le 100 t di ottobre del consorzio al target di SMOCO in
// Puglia, nella scheda dei raccoglitori (11.650 t), e il contratto era rimasto a
// 11.550: la dashboard, l'atteso, l'Andamento ed EcoTyna leggono il contratto e
// non si muovevano, e niente lo diceva fuori da quella scheda («non sto notando
// che da altre parti la modifica viene interessata, compresa la dashboard»). La
// scheda ora avvisa (scartiDalContratto di attesoContratto.ts) e apre la
// variazione gia' compilata; qui la stessa regola sugli stessi numeri della sua
// tabella per regione: la somma dei target annui dei raccoglitori dell'anno,
// regione per regione com'e' scritta, contro il riparto del contratto
// (regioni_json; senza riparto la scheda non confronta, e nemmeno qui). Sotto
// mezza tonnellata e' un arrotondamento (SOGLIA_VARIAZIONE_T): sui dati veri
// dell'11/10/2026 Campania 4.400,38 contro 4.400 e Calabria 1.649,62 contro 1.650
// non fanno nessuna voce. Un target senza regione la scheda lo mette dove il
// raccoglitore raccoglie di piu', che qui non si sa: non si conta, e la voce lo
// dice. Nessuna lettura in piu': cruscottoOperativo legge gia' target annui e
// contratti per l'anno nuovo.
/** Le regioni dove i target annui dei raccoglitori non fanno il contratto: al piu' una voce. */
export function vociContrattoRaccoglitori(commesse, targetRaccoglitori, anno) {
  const commessa = commessaDellAnno(commesse, anno);
  if (!commessa) return [];
  const contratto = regioniDellAnno(commessa, anno);
  if (contratto.fonte !== 'contratto') return [];
  const dellAnno = (targetRaccoglitori || []).filter(t => t && Number(t.anno) === Number(anno));
  // Un anno senza nessun target dei raccoglitori non e' uno scarto da registrare:
  // i target mancano, e lo dice la voce dell'anno nuovo.
  if (!dellAnno.length) return [];
  const regioni = [...new Set([...contratto.righe.map(r => r.regione), ...dellAnno.map(t => t.regione).filter(Boolean)])];
  const perRegione = regioni.map(reg => {
    const c = contratto.righe.find(r => r.regione === reg);
    return { regione: reg, annuo: dellAnno.filter(t => t.regione === reg).reduce((s, t) => s + (Number(t.target_tonnellate) || 0), 0), contratto: c ? c.target_t : null };
  });
  const scarti = scartiDalContratto(commessa, perRegione, []);
  if (!scarti.length) return [];
  const t = (v) => formatoTonnellate(Math.abs(v));
  const piuMeno = (d) => (d > 0 ? 'più' : 'meno');
  const senzaRegione = dellAnno.filter(x => !x.regione && Number(x.target_tonnellate) > 0).length;
  const uno = scarti.length === 1 ? scarti[0] : null;
  const titolo = uno
    ? `I raccoglitori della ${uno.regione} hanno ${t(uno.differenza_t)} t ${piuMeno(uno.differenza_t)} del contratto ${anno}`
    : `In ${scarti.length} regioni i target dei raccoglitori non fanno il contratto ${anno}`;
  const righe = scarti.map(s => `${s.regione}: raccoglitori ${formatoTonnellate(s.raccoglitori_t)} t, contratto ${formatoTonnellate(s.contratto_t)} t (${s.differenza_t > 0 ? '+' : '-'}${t(s.differenza_t)} t)`);
  const dettaglio = `${righe.join(' · ')}. `
    + 'Se è una variazione del consorzio, va registrata nel contratto («Registra la variazione» nella scheda Target raccoglitori, o «Variazione del contratto» nella scheda Commessa Ecotyre): '
    + 'finché non c\'è, la dashboard, l\'atteso alla data, l\'Andamento ed EcoTyna dicono il contratto di prima. Se invece il contratto è giusto, vanno corretti i target dei raccoglitori.'
    + (senzaRegione ? ` ${senzaRegione === 1 ? 'Un target annuo senza regione non è contato' : `${senzaRegione} target annui senza regione non sono contati`}: la scheda lo mette nella regione dove il raccoglitore raccoglie di più.` : '');
  return [{
    area: 'Target raccoglitori', gravita: 'attenzione', titolo, dettaglio,
    link: `/target-status?tab=raccoglitori&anno=${anno}`,
    chiave: `contratto-raccoglitori:${anno}`,
    sezione: 'rete',
    // Nascosta, torna se cambiano le regioni o il verso, o se una differenza cresce.
    firma: `${anno}|${scarti.map(s => `${s.regione}${s.differenza_t > 0 ? '+' : '-'}`).join(',')}`,
    misure: scarti.map(s => Math.abs(s.differenza_t)),
  }];
}

// GLI ERRORI DEL SITO (migliorie del 14/10/2026, approvate dall'utente: «per me
// ok sulle cose da sistemare, sulla velocità e su quanto da creare, procedi
// pure»).
//
// Un errore visto da un collega - una pagina che si rompe, una chiamata che non
// riesce - l'amministratore lo scopriva solo se il collega glielo diceva. Le
// pagine ora lo annotano da se' (ErroreSito, src/lib/registroErrori.js) e qui
// diventa una voce: quanti errori non ancora segnati visti da ieri (giorno
// italiano dell'errore, ieri e oggi), e i piu' frequenti. Una voce sola, area
// «Errori del sito», sezione dati, collegamento alla scheda «Errori del sito» di
// Alert & Controllo, dove si segnano visti e la voce sparisce. Solo per
// l'amministratore: cruscottoOperativo legge il registro (una lettura, filtrata
// sui non visti e limitata a LIMITE_ERRORI_CRUSCOTTO righe, le piu' recenti) solo
// quando chiede lui; senza righe lette la voce non c'e'. Il titolo dice
// «almeno» solo se la lettura e' piena E sono tutte righe da ieri: se fra le
// lette c'e' una riga piu' vecchia, quelle da ieri sono arrivate tutte (vengono
// prima) e il conto e' esatto (revisione del 15/10/2026). Grave («attenzione»)
// con una pagina che si rompe, un errore non preso o un errore del server; le
// altre (rete, limite di richieste, richieste rifiutate) sono un'informazione.
// Il numero sale da solo con gli errori: nascosta, torna se sale o se entra un
// errore di un altro genere (elementi), non per un giorno in piu'. Gli elementi
// sono nomi da leggere - il messaggio fra «», la chiamata e la pagina - perche'
// l'etichetta «tornata» li mostra (revisione del 15/10/2026: erano le impronte
// interne del registro, una chiave tecnica lunga che a 375 px usciva dallo
// schermo). Gli utenti si contano per created_by_id, che la piattaforma
// restituisce sempre (l'email, created_by, no).
export const LIMITE_ERRORI_CRUSCOTTO = 200;
const ERRORI_GRAVI = new Set(['pagina', 'non_preso', 'server']);
// I conti delle volte sono interi col punto delle migliaia: la stessa scrittura
// dei chili (formatoKg), che e' quella di un intero qualunque.
const intero = (n) => formatoKg(n);
const giornoPrimaDi = (g) => {
  const s = String(g || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  return new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) - 86400000).toISOString().slice(0, 10);
};

/** La voce degli errori del sito non ancora visti, da ieri: al piu' una. */
export function vociErroriSito(errori, oggi) {
  if (!Array.isArray(errori) || !errori.length) return [];
  const ieri = giornoPrimaDi(oggi);
  if (!ieri) return [];
  const recenti = errori.filter(r => r && r.visto !== true && String(r.giorno || '').slice(0, 10) >= ieri);
  if (!recenti.length) return [];
  const gruppi = new Map();
  for (const r of recenti) {
    const k = String(r.impronta || [r.tipo, r.coinvolto_tipo, r.coinvolto, r.pagina, r.messaggio].map(x => x || '').join('|'));
    const g = gruppi.get(k) || { messaggio: r.messaggio || '', pagina: r.pagina || '', coinvolto: r.coinvolto || '', volte: 0 };
    g.volte += Math.max(1, Math.round(Number(r.volte) || 1));
    gruppi.set(k, g);
  }
  const n = [...gruppi.values()].reduce((s, g) => s + g.volte, 0);
  const ordinati = [...gruppi.entries()].sort((a, b) => b[1].volte - a[1].volte || a[0].localeCompare(b[0]));
  // Nel nome il messaggio si accorcia: l'etichetta della voce tornata ne mostra tre.
  const corto = (m) => (m.length > 80 ? `${m.slice(0, 79).trimEnd()}…` : m);
  const nome = (g, accorcia = (m) => m) => `«${accorcia(g.messaggio || 'senza messaggio')}»${g.coinvolto ? ` (${g.coinvolto})` : ''} in ${g.pagina || '/'}`;
  const descrivi = (g) => `${nome(g)}, ${intero(g.volte)} ${g.volte === 1 ? 'volta' : 'volte'}`;
  const primi = ordinati.slice(0, 3).map(([, g]) => descrivi(g));
  const altri = ordinati.length - primi.length;
  const utenti = new Set(recenti.map(r => r.created_by_id || r.created_by).filter(Boolean)).size;
  const troncato = errori.length >= LIMITE_ERRORI_CRUSCOTTO && !errori.some(r => r && String(r.giorno || '').slice(0, 10) < ieri);
  const titolo = troncato
    ? `Almeno ${intero(n)} errori del sito da ieri`
    : `${n === 1 ? 'Un errore del sito' : `${intero(n)} errori del sito`} da ieri`;
  const dettaglio = `${ordinati.length === 1 ? (n === 1 ? 'È questo' : 'Sempre lo stesso') : 'I più frequenti'}: ${primi.join(' · ')}`
    + `${altri > 0 ? ` · e ${altri === 1 ? 'un altro errore' : `altri ${intero(altri)} errori`} diversi` : ''}.`
    + `${utenti ? ` ${utenti === 1 ? 'Lo ha incontrato un utente' : `Li hanno incontrati ${intero(utenti)} utenti`}.` : ''}`
    + ' Si guardano in Alert & Controllo, nella scheda «Errori del sito», e lì si segnano visti.';
  return [{
    area: 'Errori del sito',
    gravita: recenti.some(r => ERRORI_GRAVI.has(r.tipo)) ? 'attenzione' : 'info',
    titolo, dettaglio,
    link: '/alert-engine?tab=errori',
    chiave: 'errori-sito',
    sezione: 'dati',
    firma: 'errori-sito',
    misure: [n],
    elementi: [...new Set(ordinati.slice(0, 20).map(([, g]) => nome(g, corto)))],
  }];
}

/**
 * L'elenco unico delle cose da gestire. Ogni voce: { area, gravita, titolo,
 * dettaglio, link }. dati: { oggi, adessoMs, anno, alertAperti, uploadLogs,
 * tipiFile, assegnatiRete, assegnatiAci, documenti, prefatture, riepilogoQualifica,
 * richiesteEct, verificheSedi, annoNuovo, fotografiaGiorno, surplus, commesse,
 * targetRaccoglitori, eseguiti, erroriSito, copieSicurezza, amministratore }.
 *
 * annoNuovo e' il risultato di listaAnno per l'anno dopo: decide da se' se
 * valga la pena dirlo (avvicinandosi), e qui si scrive soltanto.
 */
export function cruscotto(dati) {
  const { oggi, anno } = dati;
  const voci = [];
  // OGNI VOCE HA LA SUA CHIAVE E LA SUA SEZIONE (migliorie dell'11/10/2026). La
  // chiave dice chi e' la voce al di la' dei numeri: con lei la dashboard ricorda
  // una voce nascosta e la fa tornare quando ha qualcosa di nuovo da dire
  // (src/lib/avvisiNascosti.js). Dove un numero sale da solo col passare dei
  // giorni - «dati di 12 giorni fa», «non gira da 3 giorni» - la voce scrive anche
  // firma e misure, altrimenti tornerebbe ogni mattina senza che sia cambiato
  // niente.
  const voce = (area, gravita, titolo, dettaglio, link, altro = {}) => voci.push({ area, gravita, titolo, dettaglio, link, ...altro });

  // Alert aperti, per gravita' e per regola
  const alert = { totale: 0, critici: 0, warning: 0, info: 0, per_regola: [] };
  const perRegola = new Map();
  for (const a of dati.alertAperti || []) {
    alert.totale++;
    if (a.severita === 'critico') alert.critici++; else if (a.severita === 'warning') alert.warning++; else alert.info++;
    const k = nomeRegola(a.regola_nome) || a.titolo || 'Senza regola';
    perRegola.set(k, (perRegola.get(k) || 0) + 1);
  }
  alert.per_regola = [...perRegola.entries()].map(([regola, quanti]) => ({ regola, quanti })).sort((a, b) => b.quanti - a.quanti).slice(0, 8);
  // Le date obbligatorie hanno una voce per modulo e canale, e i target dei
  // raccoglitori una per mese, qui sotto: la voce generica degli alert conta gli
  // altri, per non dire due volte la stessa cosa.
  const altri = (dati.alertAperti || []).filter(a => !eAlertDate(a) && !eAlertTarget(a));
  const altriCritici = altri.filter(a => a.severita === 'critico').length;
  // IL DETTAGLIO CONTA QUELLO CHE DICE IL TITOLO (13/10/2026). Sul sito «18 alert
  // critici aperti» era seguito dalle regole di tutti i 40 aperti: il conto per
  // regola ora e' dei critici quando il titolo parla dei critici, gli altri si
  // dicono a parte, e oltre le prime tre regole si dice quante ne restano.
  const perRegolaDi = (lista) => {
    const m = new Map();
    for (const a of lista) { const k = nomeRegola(a.regola_nome) || a.titolo || 'Senza regola'; m.set(k, (m.get(k) || 0) + 1); }
    const tutte = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const resto = tutte.slice(3).reduce((s, [, q]) => s + q, 0);
    return tutte.slice(0, 3).map(([regola, quanti]) => `${regola} (${quanti})`).join(' · ') + (resto ? ` · altre regole (${resto})` : '');
  };
  if (altriCritici > 0) {
    const nonCritici = altri.length - altriCritici;
    voce('Alert', 'critico', `${altriCritici === 1 ? 'Un alert critico aperto' : `${altriCritici} alert critici aperti`}`,
      perRegolaDi(altri.filter(a => a.severita === 'critico')) + (nonCritici ? `; e ${nonCritici === 1 ? 'uno non critico' : `${nonCritici} non critici`}` : ''),
      '/alert-engine', { chiave: 'alert:altri' });
  } else if (altri.length > 0) voce('Alert', 'attenzione', `${altri.length === 1 ? 'Un alert aperto' : `${altri.length} alert aperti`}`, perRegolaDi(altri), '/alert-engine', { chiave: 'alert:altri' });
  for (const v of vociTarget((dati.alertAperti || []).filter(eAlertTarget))) voci.push(v);
  for (const a of (dati.alertAperti || []).filter(eAlertDate)) {
    const v = voceDate(a);
    voce('Date obbligatorie', v.gravita, v.titolo, v.dettaglio, v.link, { chiave: `date:${a.modulo || ''}:${a.canale || ''}`, sezione: SEZIONE_DATE[a.modulo] || 'generale' });
  }

  // Caricamenti: non riusciti, interrotti, in corso, e dati vecchi. La regola e'
  // quella dei motori (freschezzaArchivi, registroCaricamenti.ts) e il testo e'
  // lo stesso dell'avviso sopra i totali delle pagine (avvisoCaricamento).
  const tipiFile = dati.tipiFile || [...new Set((dati.uploadLogs || []).map(l => l && l.tipo_file).filter(Boolean))];
  const caricamenti = freschezzaArchivi(dati.uploadLogs, oggi, dati.adessoMs, tipiFile, dati.finoAl || {});
  for (const x of caricamenti.in_corso) voce('Caricamento dati', x.avviso.gravita, x.avviso.titolo, x.avviso.dettaglio, '/caricamento-dati', { chiave: `caricamento:${x.tipo_file}:${x.avviso.stato}` });
  for (const a of caricamenti.archivi) {
    const fino = a.fino_al ? ` Dentro, i dati arrivano fino al ${ilGiorno(a.fino_al)} (${a.fino_al_cosa}).` : '';
    if (a.il === null) {
      voce('Caricamento dati', 'attenzione', `Mai caricato: ${a.nome}`, (a.righe_nel_registro >= RIGHE_REGISTRO
        ? `Nessuno degli ultimi ${a.righe_nel_registro} caricamenti di questo file nel registro è riuscito.`
        : a.righe_nel_registro ? 'Nel registro ci sono solo caricamenti di questo file non riusciti.' : 'Nel registro non c\'è nessun caricamento riuscito di questo file.') + fino, '/caricamento-dati',
      { chiave: `caricamento:${a.tipo_file}:mai`, firma: a.tipo_file, misure: [] });
    } else if (a.vecchio && a.misurata_su === 'fino_al') {
      // I giorni crescono da soli ogni mattina: la voce nascosta torna solo con
      // un caricamento nuovo o un «fino al» diverso.
      voce('Caricamento dati', 'attenzione', `${a.nome}: dati fino al ${ilGiorno(a.fino_al)}`,
        `Caricato il ${ilGiorno(a.il)}${a.nome_file ? ` (${a.nome_file})` : ''}, ma dentro i dati arrivano fino al ${ilGiorno(a.fino_al)} (${a.fino_al_cosa}): ${a.fino_al_scarto} giorni prima del caricamento, ${a.eta_giorni} giorni fa. `
        + 'Più di tre settimane senza dati prima del caricamento non sono un periodo senza movimenti (nemmeno a Natale o a Ferragosto): il file sembra scaricato dal portale molto prima. I numeri di questo archivio sono fermi a quel giorno.',
        '/caricamento-dati', { chiave: `caricamento:${a.tipo_file}:fino-al`, firma: `${a.tipo_file}|${a.il}|${a.fino_al}`, misure: [] });
    } else if (a.vecchio) {
      voce('Caricamento dati', 'attenzione', `${a.nome}: dati di ${a.giorni_fa} giorni fa`, `Ultimo caricamento riuscito il ${ilGiorno(a.il)}${a.nome_file ? ` (${a.nome_file})` : ''}. I numeri di questo archivio sono fermi a quel giorno.${fino}`, '/caricamento-dati',
        { chiave: `caricamento:${a.tipo_file}:vecchio`, firma: `${a.tipo_file}|${a.il}`, misure: [] });
    }
  }

  // Arretrato, per canale. Il dettaglio dice da quanti giorni aspetta il piu'
  // vecchio, che cresce da solo: la voce nascosta torna solo se crescono gli
  // ordini oltre i 60 giorni.
  const arretrato = { RETE: etaArretrato(dati.assegnatiRete, oggi), ACI: etaArretrato(dati.assegnatiAci, oggi) };
  for (const [canale, e] of Object.entries(arretrato)) {
    if (e.oltre_60 > 0) voce('Arretrato', 'attenzione', `${canale === 'RETE' ? 'Rete' : 'ACI'}: ${e.oltre_60} ordini aperti da oltre 60 giorni`, `Su ${e.totale} aperti; il più vecchio da ${e.piu_vecchio.giorni} giorni (${e.piu_vecchio.id_ordine}, ${e.piu_vecchio.ragione_sociale}).`, canale === 'RETE' ? '/assegnati' : '/assegnati-aci',
      { chiave: `arretrato:${canale}`, sezione: canale === 'RETE' ? 'rete' : 'aci', firma: canale, misure: [e.oltre_60] });
  }

  // GLI ORDINI RIMASTI «ESEGUITO» A PORTALE (richiesta dell'utente del
  // 14/10/2026): UNA voce sola per primarie, secondarie e terziarie, con gli ID
  // nel dettaglio e il collegamento al modulo. La regola e le parole sono quelle
  // dell'esito del caricamento e delle pagine (ordiniEseguiti.ts). dati.eseguiti
  // sono le righe in «eseguito» lette da chi chiama, una lettura filtrata per
  // stato per archivio; un archivio non letto vale null e la voce lo dice.
  // Sparisce da sola quando il caricamento dopo li risolve (quelli fuori
  // dall'export, con un export che parte dal loro anno: fraseFuoriExport): la
  // dashboard rilegge l'archivio. Senza dati.eseguiti la voce non c'e'.
  if (dati.eseguiti) {
    const v = voceEseguiti(ordiniEseguiti(dati.eseguiti, { oggi }));
    if (v) voci.push(v);
  }

  // Fatturazione attiva: mesi finiti e non ancora elaborati, o senza prefattura
  const mesiAttiva = statoMesiAttiva(dati.documenti, dati.prefatture, anno, oggi);
  const daElaborare = mesiAttiva.filter(m => !m.elaborato).map(m => m.etichetta);
  // Un mese elaborato puo' avere un canale indietro: si dice quale, invece di
  // darlo per elaborato perche' lo e' un altro canale.
  const canaleMancante = mesiAttiva.filter(m => m.elaborato && m.canali_mancanti.length);
  // La prefattura del portale copre solo rete e ACI: la chiede un mese in cui
  // uno dei due e' elaborato e non ancora chiuso, non l'extra raccolta.
  const senzaPrefattura = mesiAttiva.filter(m => m.elaborato && !m.prefattura && (m.canali ? ['RETE', 'ACI'].some(k => m.canali[k].elaborato && !m.canali[k].chiuso) : !m.chiuso)).map(m => m.etichetta);
  // La prefattura non dice numeri: la voce torna quando cambiano i mesi che la
  // chiedono, e il titolo li nomina.
  if (daElaborare.length) voce('Fatturazione attiva', 'attenzione', `${daElaborare.length} ${daElaborare.length === 1 ? 'mese finito non ancora elaborato' : 'mesi finiti non ancora elaborati'}`, daElaborare.join(', '), '/fatturazione', { chiave: 'attiva:da-elaborare' });
  if (canaleMancante.length) voce('Fatturazione attiva', 'attenzione', `${canaleMancante.length} ${canaleMancante.length === 1 ? 'mese con un canale non elaborato' : 'mesi con un canale non elaborato'}`, canaleMancante.map(m => `${m.etichetta}: ${m.canali_mancanti.map(k => NOMI_CANALI_ATTIVA[k]).join(', ')}`).join(' · '), '/fatturazione', { chiave: 'attiva:canale-mancante' });
  if (senzaPrefattura.length) voce('Fatturazione attiva', 'info', `Prefattura Ecotyre non caricata: ${senzaPrefattura.join(', ')}`, 'Il confronto con la prefattura si fa prima di esportare.', '/fatturazione', { chiave: 'attiva:prefattura', firma: senzaPrefattura.join(', '), misure: [] });

  // Qualifica dei fornitori
  const q = dati.riepilogoQualifica || null;
  if (q && (Number(q.scaduti) > 0 || Number(q.non_conformi) > 0)) voce('Qualifica fornitori', 'critico', `${Number(q.scaduti) || 0} documenti scaduti, ${Number(q.non_conformi) || 0} non conformi`, (q.soggetti_critici || []).slice(0, 5).map(s => s.nome).join(', '), '/qualifica-fornitori', { chiave: 'qualifica:scaduti' });
  if (q && Number(q.in_scadenza) > 0) voce('Qualifica fornitori', 'info', `${q.in_scadenza} documenti in scadenza`, '', '/qualifica-fornitori', { chiave: 'qualifica:in-scadenza' });
  // Un documento intestato a un fornitore che non risulta non lo chiede nessuno:
  // e' un errore silenzioso, quindi va detto qui.
  if (q && Number(q.anomalie_catalogo) > 0) voce('Qualifica fornitori', 'critico', Number(q.anomalie_catalogo) === 1 ? 'Un documento del catalogo non verrà mai chiesto a nessuno' : `${q.anomalie_catalogo} documenti del catalogo non verranno mai chiesti a nessuno`, q.anomalie_catalogo_testo || '', '/qualifica-fornitori', { chiave: 'qualifica:catalogo' });

  // Richieste del consorzio: scadute e ancora aperte, o ritirate e da confermare.
  // L'esito e' quello salvato: lo ricalcola sui terminati ogni caricamento delle
  // primarie (importaBlocco, azione ritiri_ect) e ogni apertura delle richieste,
  // sulla fine trasporto e senza mai cancellare un ritiro gia' rilevato. Qui non
  // si rifa': vorrebbe dire rileggere le primarie, e il cruscotto legge solo
  // archivi piccoli.
  // Dal 29/09/2026 una richiesta i cui ordini risultano tutti terminati si chiude
  // DA SOLA. La voce che diceva "aspettano la tua spunta" non spariva pero' senza
  // perdere una cosa vera: a quelle richieste bisogna ancora RISPONDERE al
  // consorzio, che scrive per email. Cambia il significato della spunta - non piu'
  // "ho verificato" ma "ho risposto" - e la voce resta.
  // Dal 14/10/2026 una richiesta si chiude da sola anche EVASA IN PARTE: un
  // ordine terminato e gli altri cancellati a portale (evasaInParte). Di lei
  // «gli ordini risultano tutti ritirati» non e' vero, e la voce lo dice.
  // Dal 15/10/2026 il termine e' quello che vale nella To-Do List: corretto a
  // mano dall'amministratore (scadenza_manuale), se c'e', se no quello del foglio
  // (oltreIlTermine, richiesteEct.ts). Letto da r.scadenza, una richiesta col
  // termine spostato in avanti restava «oltre il termine» qui e non nella pagina.
  let ectScadute = 0, ectDaRispondere = 0, ectInParte = 0;
  for (const r of dati.richiesteEct || []) {
    const esito = r.esito || statoRichiesta(r);
    // 'da_confermare' resta per le richieste salvate prima di quella data.
    if (esito === 'da_confermare' || (esito === 'evasa' && !r.evasione_confermata)) { ectDaRispondere++; if (evasaInParte(r)) ectInParte++; }
    else if (esito === 'aperta' && oltreIlTermine(r, oggi)) ectScadute++;
  }
  const dettaglioDaRispondere = !ectInParte
    ? 'Gli ordini risultano tutti ritirati: la richiesta e\' evasa, resta da rispondere alla mail e spuntarla.'
    : ectDaRispondere === 1
      ? 'Nessun suo ordine e\' piu\' da ritirare: e\' evasa in parte, un ordine risulta cancellato a portale. Resta da rispondere alla mail e spuntarla.'
      : `Nessun loro ordine e' piu' da ritirare: ${ectInParte === ectDaRispondere ? 'sono tutte evase in parte' : ectInParte === 1 ? 'una e\' evasa in parte' : `${ectInParte} sono evase in parte`} (qualche ordine risulta cancellato a portale)${ectInParte === ectDaRispondere ? '' : ', le altre hanno gli ordini tutti ritirati'}. Resta da rispondere alla mail e spuntarle.`;
  if (ectScadute) voce('Richieste ECT', 'critico', `${ectScadute} richieste del consorzio oltre il termine`, 'Ritiri chiesti per email da Ecotyre e non ancora evasi alla data indicata.', '/todo', { chiave: 'ect:scadute' });
  if (ectDaRispondere) voce('Richieste ECT', 'info', `${ectDaRispondere} richieste si sono chiuse da sole e aspettano la risposta al consorzio`, dettaglioDaRispondere, '/todo', { chiave: 'ect:da-rispondere' });

  // LE SEDI OPERATIVE DA DECIDERE. Sul formulario va la sede operativa, non la
  // sede legale: quando il controllo in rete trova una sede diversa da quella
  // dell'anagrafica, nessuno la cambia da solo, e finche' qualcuno non decide il
  // formulario si prepara su un indirizzo di cui non ci si fida.
  const sediDaDecidere = (dati.verificheSedi || []).filter(v => v && !v.superata && ['diverso', 'incerto'].includes(v.esito) && (v.stato || 'da_decidere') === 'da_decidere');
  if (sediDaDecidere.length) {
    const nomi = sediDaDecidere.slice(0, 4).map(v => v.ragione_sociale || v.descrizione_pdr || ('PDR ' + v.id_pdr)).join(', ');
    const diverse = sediDaDecidere.filter(v => v.esito === 'diverso').length;
    voce('Punti di raccolta', diverse ? 'attenzione' : 'info',
      `${sediDaDecidere.length} ${sediDaDecidere.length === 1 ? 'sede operativa da decidere' : 'sedi operative da decidere'}`,
      `${diverse ? diverse + ' con un indirizzo diverso da quello del portale. ' : ''}${nomi}`,
      '/pdr?scheda=sedi', { chiave: 'pdr:sedi' });
  }

  // IL GUARDIANO NOTTURNO (10/10/2026).
  //
  // Ogni notte la quadratura di tutti gli impianti si rifa' da se' e lascia
  // scritta una riga (IndicatoreGiorno). Qui si legge soltanto: se qualcosa
  // si e' scostato lo si trova la mattina, senza aprire nessuna pagina. E se
  // il controllo ha smesso di girare lo si dice, perche' un guardiano che
  // dorme e un guardiano che non trova niente si assomigliano troppo.
  const fg = dati.fotografiaGiorno;
  // DUE COSE DIVERSE, DUE VOCI DIVERSE (10/10/2026).
  //
  // L'esito «da guardare» ha due cause: un impianto che si scosta dal portale e
  // una dichiarazione in doppio. Finche' la voce era una sola, un doppione
  // senza scostamenti avrebbe scritto «0 impianti non quadrano col portale»: un
  // avviso a zero, come quello dei file - e un avviso che grida al lupo a zero
  // e' il modo piu' sicuro di far ignorare quelli veri.
  //
  // IMPIANTI O STOCCAGGI (12/10/2026). Il guardiano contava i soli impianti,
  // mentre la pagina Dichiarazioni e la sezione Impianti di questa dashboard
  // dicono la quadratura su impianti e stoccaggi della rete (6 su 6, con Nappi
  // Sud): uno stoccaggio della rete che non quadrava lo diceva la sezione, e qui
  // niente. Ora la fotografia li porta tutti e due (indicatoriGiorno.ts), e il
  // titolo dice chi si scosta: «Uno stoccaggio non quadra», «2 impianti e uno
  // stoccaggio non quadrano».
  //
  // Le righe di scostamenti_json sono della rete; se una ne arrivasse col
  // canale ACI resta fuori da questa voce, che e' della rete. Il dettaglio e'
  // la riga del guardiano per la sola rete (notaDelGiorno): la nota intera,
  // dal 13/10/2026, puo' dire anche gli stoccaggi ACI, che hanno la voce loro.
  const scost = ((fg && fg.scostamenti) || []).filter(x => x && x.canale !== 'ACI');
  if (scost.length) {
    const quali = chiSiScosta(scost);
    voce('Giacenze', 'attenzione',
      `${quali.testo.charAt(0).toUpperCase()}${quali.testo.slice(1)} ${quali.uno ? 'non quadra' : 'non quadrano'} col portale`,
      `${notaDelGiorno(scost, 0, (fg && fg.doppioni) || [])} Controllo del ${ilGiorno(fg.giorno)}.`,
      '/giacenze', { chiave: 'giacenze:scostamenti' });
  }
  // GLI STOCCAGGI ACI CHE NON QUADRANO (decisioni dell'utente del 13/10/2026,
  // gruppo B). Uno stoccaggio con la giacenza ACI (classe 9) a portale - oggi
  // Nappi Sud - che non quadra diventa una voce la mattina, come uno della
  // rete, ma sua: i canali non si mescolano. Si legge dalle righe della
  // fotografia con la regola del guardiano (scostamentiAci), quindi anche da una
  // fotografia scritta prima di quel giorno. Prima lo diceva solo il conteggio
  // della sezione Impianti, «ACI negli stoccaggi, a parte».
  const scostAci = fg ? scostamentiAci(fg.siti || []) : [];
  if (scostAci.length) {
    voce('Giacenze', 'attenzione',
      `${scostAci.length === 1 ? 'Uno stoccaggio ACI non quadra' : `${scostAci.length} stoccaggi ACI non quadrano`} col portale`,
      `${notaAci(scostAci)} È la giacenza ACI del piazzale, la classe 9 della rilevazione a portale: sta a parte dalla rete, e si guarda in Giacenze sul canale ACI. Controllo del ${ilGiorno(fg.giorno)}.`,
      '/giacenze', { chiave: 'giacenze:scostamenti-aci', sezione: 'impianti' });
  }
  // IL DOPPIONE SI PRESENTA COME DOPPIONE.
  //
  // Altrove si traveste: nel confronto col portale la gemella non pareggia
  // nessun caricamento e finisce fra «i mesi che il portale non conosce», che
  // manda a cercare un problema dove non c'e'. Qui si dice la cosa vera, e si
  // dice dove: il mese e il canale, perche' si sistema in un posto solo.
  const dopp = (fg && fg.doppioni) || [];
  if (dopp.length) {
    const kgInPiu = dopp.reduce((s, x) => s + (Number(x.kg_in_piu) || 0), 0);
    voce('Dichiarazioni', 'critico',
      `${dopp.length === 1 ? 'Una dichiarazione è doppia' : `${dopp.length} dichiarazioni sono doppie`}`,
      `${dopp.slice(0, 3).map(x => `${x.sito} ${x.mese} ${x.canale === 'RETE' ? 'rete' : x.canale}`).join(', ')}`
      // Il testo dice quello che fanno i due moduli dall'11/10/2026: leggono le
      // dichiarazioni con leggiDichiarazioni e di due gemelle contano la prima.
      // Prima diceva che le giacenze le sommavano, e non e' piu' vero.
      + `${dopp.length > 3 ? ` e altre ${dopp.length - 3}` : ''}. Finché ci sono, Giacenze e Dichiarazioni contano la prima riga e ignorano le altre`
      + `${kgInPiu ? ` (${formatoKg(kgInPiu)} kg di troppo, nelle righe ignorate)` : ''}: se quella giusta è un'altra, dichiarato e giacenza sono sbagliati in tutti e due. Il doppione va tolto. Controllo del ${ilGiorno(fg.giorno)}.`,
      '/dichiarazioni-impianti', { chiave: 'dichiarazioni:doppioni' });
  }
  // La chiave e' quella del battito del guardiano (presidi.ts, lavoro
  // riepilogoDichiarazioni): quando il battito sa dire di piu' - l'errore, da
  // quante notti - resta la sua voce e questa non si ripete (unisciPresidi).
  // «Non gira da N giorni» cresce ogni mattina: nascosta, torna solo con una
  // fotografia nuova.
  const etaFoto = fg ? giorniFa(fg.giorno, oggi) : null;
  if (etaFoto !== null && etaFoto > 2) {
    voce('Manutenzione', 'info', `Il controllo notturno non gira da ${etaFoto} giorni`,
      `L'ultima verifica della quadratura e' del ${String(fg.giorno).split('-').reverse().join('/')}: finche' non riparte, uno scostamento nuovo non lo segnala nessuno.`,
      '/giacenze', { chiave: CHIAVE_GUARDIANO, firma: String(fg.giorno), misure: [] });
  }

  // L'ANNO NUOVO, QUANDO COMINCIA AD AVVICINARSI (10/10/2026).
  //
  // Il contratto e' annuale senza tacito rinnovo: il 31 dicembre scade tutto,
  // e dal 1° gennaio una riga senza tariffa vale zero euro e nasce in errore.
  // La scheda che dice che cosa manca esiste, ma una scheda che nessuno apre
  // non serve: da due mesi prima la cosa compare qui, dove si guarda ogni
  // mattina. Quando decidere di parlare lo stabilisce listaAnno
  // (shared/inizializzazioneAnno.ts): qui si scrive e basta.
  const an = dati.annoNuovo;
  if (an && an.avvicinandosi) {
    const quando = an.giorni_al_primo_gennaio;
    const cosa = [an.mancanti ? `${an.mancanti} ${an.mancanti === 1 ? 'cosa manca' : 'cose mancano'}` : '',
      an.parziali ? `${an.parziali} ${an.parziali === 1 ? 'e' : 'sono'} da confermare` : ''].filter(Boolean).join(', ');
    const tempo = quando > 0
      ? `${quando} ${quando === 1 ? 'giorno' : 'giorni'} al 1° gennaio.`
      : `Il ${an.anno} e' gia' cominciato.`;
    voce('Nuovo anno', quando <= 0 && an.mancanti ? 'critico' : 'attenzione',
      `${an.anno}: ${cosa}`,
      `${tempo} ${(an.voci || []).filter(v => v.stato !== 'pronto').map(v => v.titolo).join(' \u00b7 ')}.`,
      // La scheda prepara l'anno dopo quello scelto: per aprire il 2027 si sceglie il 2026.
      `/target-status?tab=nuovo-anno&anno=${an.anno - 1}`, { chiave: `anno-nuovo:${an.anno}` });
  }

  // I SURPLUS DELL'ANNO PRIMA CHE SONO FINITI (decisioni dell'utente del
  // 13/10/2026, gruppo B): vociSurplusFiniti, qui sopra. dati.surplus sono i
  // SurplusTariffa letti da chi chiama; senza, la voce non c'e'.
  for (const v of vociSurplusFiniti(dati.surplus, oggi)) voci.push(v);

  // I RACCOGLITORI CHE NON FANNO IL CONTRATTO (14/10/2026): vociContrattoRaccoglitori,
  // qui sopra. dati.commesse e dati.targetRaccoglitori sono i CommessaEcotyre e i
  // TargetRaccoglitore letti da chi chiama; senza, la voce non c'e'.
  for (const v of vociContrattoRaccoglitori(dati.commesse, dati.targetRaccoglitori, anno)) voci.push(v);

  // GLI ERRORI DEL SITO (14/10/2026): vociErroriSito, qui sopra. dati.erroriSito
  // sono le righe di ErroreSito non viste, lette da chi chiama e solo per
  // l'amministratore; senza, la voce non c'e'.
  for (const v of vociErroriSito(dati.erroriSito, oggi)) voci.push(v);

  // IL PROMEMORIA DELLA COPIA DI SICUREZZA (migliorie del 14/10/2026, agganciato
  // alla chiusura del 15/10/2026). La regola sta in promemoriaCopia.ts: nessuna
  // copia negli ultimi sette giorni, mai fatta o l'ultima incompleta. Fino a
  // questa chiusura non la chiamava nessuno, e la sezione di Caricamento Dati
  // prometteva «dopo sette giorni la dashboard te lo ricorda» a vuoto.
  // dati.copieSicurezza e' la riga piu' recente di CopiaSicurezza, letta da chi
  // chiama solo per l'amministratore (dati.amministratore); senza lettura (null)
  // la voce non c'e': un registro non letto non e' «mai fatta».
  for (const v of vociPromemoriaCopia({ righe: dati.copieSicurezza, oggi, amministratore: dati.amministratore === true })) voci.push(v);

  const tutte = unisciPresidi(voci, dati.presidi);
  tutte.sort((a, b) => GRAVITA[a.gravita] - GRAVITA[b.gravita] || a.area.localeCompare(b.area, 'it'));
  return {
    oggi, anno: Number(anno), da_gestire: tutte, alert, caricamenti, arretrato, mesi_attiva: mesiAttiva,
    impianti: quadroImpianti(fg, caricamenti, oggi, dati.fotografiaScrittaIl || null),
  };
}

const CHIAVE_GUARDIANO = 'lavoro:riepilogoDichiarazioni';

/**
 * I PRESIDI DELLA NOTTE NELL'ELENCO UNICO (migliorie dell'11/10/2026).
 *
 * vociPresidi (presidi.ts) dice un lavoro pianificato che non riesce piu' e
 * un'identita' fra moduli che si e' rotta. Entrano qui come le altre, con
 * origine 'presidi' e la loro sezione. Una causa, una voce: se un presidio ha la
 * stessa chiave di una voce del cruscotto (il guardiano), resta il presidio, che
 * sa dire l'errore e da quante notti. «Non riesce da N giorni» cresce ogni
 * mattina: nascosta, una voce di un lavoro torna solo se cambia gravita' o se il
 * lavoro cambia; non per un giorno in piu'. Le chiavi restano uniche anche se
 * due voci se le contendono: alla seconda si aggiunge il numero.
 */
export function unisciPresidi(voci, presidi) {
  const dalPresidio = (presidi || []).filter(p => p && p.titolo).map(p => {
    const chiave = String(p.chiave || `presidio:${p.titolo}`);
    const lavoro = chiave.startsWith('lavoro:');
    return {
      ...p,
      chiave,
      origine: 'presidi',
      sezione: SEZIONI_DASHBOARD.includes(p.sezione) ? p.sezione : (SEZIONE_AREA[p.area] || 'dati'),
      ...(lavoro && p.firma === undefined ? { firma: chiave } : {}),
      ...(lavoro && !Array.isArray(p.misure) ? { misure: [] } : {}),
    };
  });
  const deiPresidi = new Set(dalPresidio.map(p => p.chiave));
  const tutte = [...voci.filter(v => !deiPresidi.has(v.chiave)), ...dalPresidio]
    // ecotyna: se la pagina offre «Chiedi a EcoTyna» per questa voce. La regola
    // sta qui e la pagina la legge, cosi' non ce n'e' una seconda nel browser.
    .map(v => ({ ...v, sezione: sezioneDellaVoce(v), ecotyna: siChiedeAEcotyna(v) }));
  const viste = new Map();
  for (const v of tutte) {
    const k = v.chiave || `${v.area}|${v.titolo}`;
    const n = (viste.get(k) || 0) + 1;
    viste.set(k, n);
    v.chiave = n === 1 ? k : `${k}#${n}`;
  }
  return tutte;
}

// I canali della dashboard, sempre separati: mai un totale dei tre.
const CANALI_IMPIANTI = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];
// Il canale di una riga della fotografia: un impianto e' della rete (il portale
// tiene la giacenza degli impianti solo per la rete); una riga di stoccaggio ha
// il canale in fondo alla chiave, come la scrive riepilogoDichiarazioni.
const canaleDelSito = (s) => (s.ruolo === 'stoc' ? ((String(s.chiave || '').match(/\|(RETE|ACI)$/) || [])[1] || null) : 'RETE');
// Gli archivi che cambiano i numeri della quadratura: caricati dopo la notte,
// i numeri di adesso sono gia' altri.
const ARCHIVI_DELLA_FOTOGRAFIA = ['primarie', 'secondarie', 'terziarie', 'ordini_non_dichiarati', 'dichiarazioni_trattamento'];
// Le date della piattaforma arrivano in UTC senza la Z: la si rimette.
const istanteUtc = (v) => { if (!v) return null; const s = String(v); const ms = Date.parse(/(Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}Z`); return Number.isFinite(ms) ? ms : null; };

/**
 * GLI IMPIANTI NELLA DASHBOARD, DALLA FOTOGRAFIA DELLA NOTTE (migliorie
 * dell'11/10/2026).
 *
 * Ogni notte la quadratura di tutti gli impianti si rifa' con la regola di
 * Dichiarazioni Impianti e Giacenze, e il risultato resta scritto
 * (IndicatoreGiorno, vociSito). Qui non si ricalcola niente: si somma quello che
 * la notte ha scritto, canale per canale e mai fra canali.
 *
 * - Quadratura: la stessa di Dichiarazioni Impianti, «Rete: quadratura con il
 *   portale». Contava i soli impianti, e l'11/10/2026 la dashboard scriveva
 *   «5 su 5» mentre la pagina diceva «6 su 6»: la pagina conta anche gli
 *   stoccaggi puri della rete che hanno una rilevazione a portale (Nappi Sud),
 *   e l'ACI degli stoccaggi a parte (riepilogoDichiarazioni, totali). Lo stesso
 *   concetto non puo' avere due numeri in due pagine: qui si contano le stesse
 *   righe, che la fotografia ha gia' (sono i siti della pagina), con la stessa
 *   regola: quadra si' o no. Una riga di stoccaggio porta il canale nella
 *   chiave («nappi sud|RETE»), un impianto e' sempre della rete.
 * - Da dichiarare: la colonna «Da dichiarare» delle Dichiarazioni
 *   (Riepilogo.jsx), sommata impianto per impianto. La colonna mostra il resto
 *   dei flussi; «—» per la rete non dovuta per accordo (Tecnogum), che non
 *   entra; e la giacenza del canale in rosso quando e' sotto zero, che qui sta a
 *   parte (sotto_zero) e non entra nella cifra.
 * - Gli stoccaggi no: nella fotografia ci sono solo i piazzali puri, senza
 *   canali (Nappi Sud nel file vero dell'11/10/2026), e i piazzali di T-Cycle e
 *   Irigom stanno con l'impianto. Una somma da li' non sarebbe il numero delle
 *   Giacenze, e un numero diverso in due pagine e' peggio di nessuno.
 *
 * Senza fotografia, o con una di piu' di due giorni, i numeri sono null col
 * perche': la voce della manutenzione sta in Da gestire.
 */
export function quadroImpianti(fg, caricamenti, oggi, scrittaIl = null) {
  const vuoto = (stato, perche) => ({
    stato, perche, giorno: fg ? fg.giorno || null : null, eta_giorni: fg ? giorniFa(fg.giorno, oggi) : null,
    con_confronto: null, quadrano: null, scostamenti: [], aci_stoccaggi: null, da_dichiarare: null, sotto_zero: [], doppioni: null, caricati_dopo: [],
  });
  if (!fg || !fg.giorno) return vuoto('assente', 'Il controllo della notte non ha ancora scritto nessuna fotografia.');
  const eta = giorniFa(fg.giorno, oggi);
  if (eta === null || eta > 2) return vuoto('vecchia', `L'ultimo controllo della notte è del ${ilGiorno(fg.giorno)}: i suoi numeri non sono di oggi.`);
  const impianti = (fg.siti || []).filter(s => s && s.ruolo === 'imp');
  const confrontabili = (fg.siti || []).filter(s => s && s.giacenza_portale_t !== null && s.giacenza_portale_t !== undefined);
  const delCanale = (c) => confrontabili.filter(s => canaleDelSito(s) === c);
  const rete = delCanale('RETE');
  const aci = delCanale('ACI');
  const scost = rete.filter(s => s.quadra === false)
    .map(x => ({ sito: x.sito, scarto_t: x.scarto_t, calcolata_t: x.giacenza_calcolata_t, portale_t: x.giacenza_portale_t, stoccaggio: x.ruolo === 'stoc' }))
    .sort((x, y) => Math.abs(Number(y.scarto_t) || 0) - Math.abs(Number(x.scarto_t) || 0));
  const daDichiarare = {};
  const sottoZero = [];
  for (const c of CANALI_IMPIANTI) {
    let kg = 0, quanti = 0;
    for (const s of impianti) {
      const v = s.canali && s.canali[c];
      if (!v || v.non_dovuta || (c === 'RETE' && s.dichiara_rete === false)) continue;
      if (v.giacenza_t !== null && v.giacenza_t !== undefined && Number(v.giacenza_t) < 0) {
        sottoZero.push({ sito: s.sito, canale: c, giacenza_t: Number(v.giacenza_t) });
        continue;
      }
      const resta = Number(v.resta_t) || 0;
      if (resta > 0) { kg += Math.round(resta * 1000); quanti++; }
    }
    daDichiarare[c] = { t: kg / 1000, impianti: quanti };
  }
  // I file entrati dopo la fotografia: per istante se si sa quando e' stata
  // scritta, altrimenti per giorno.
  const scritta = istanteUtc(scrittaIl);
  const caricatiDopo = ((caricamenti && caricamenti.archivi) || [])
    .filter(a => ARCHIVI_DELLA_FOTOGRAFIA.includes(a.tipo_file) && a.il)
    .filter(a => (scritta !== null && istanteUtc(a.concluso_il) !== null ? istanteUtc(a.concluso_il) > scritta : a.il > fg.giorno))
    .map(a => ({ tipo_file: a.tipo_file, nome: a.nome, il: a.il }));
  const quadranoRete = rete.filter(s => s.quadra === true).length;
  const quadranoAci = aci.filter(s => s.quadra === true).length;
  return {
    stato: 'fresca', perche: '', giorno: fg.giorno, eta_giorni: eta,
    // come la pagina: quadrano + da quadrare, una riga senza esito non conta
    con_confronto: quadranoRete + scost.length,
    quadrano: quadranoRete,
    scostamenti: scost,
    // l'ACI degli stoccaggi, a parte: mai sommata alla rete
    aci_stoccaggi: { con_confronto: quadranoAci + aci.filter(s => s.quadra === false).length, quadrano: quadranoAci },
    da_dichiarare: daDichiarare,
    sotto_zero: sottoZero,
    doppioni: (fg.doppioni || []).length,
    caricati_dopo: caricatiDopo,
  };
}
