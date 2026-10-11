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
import { giornoRoma } from "./giornoItaliano.ts";
import { statoRichiesta } from "./richiesteEct.ts";
import { giorniFa } from "./indicatoriGiorno.ts";
import { formatoKg } from "./formato.ts";
import { statoDelRegistro, avvisoCaricamento, nomeArchivio, RIGHE_REGISTRO } from "./registroCaricamenti.ts";

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
    const g = giornoRoma(r.ordine_immesso_il);
    if (!g) { eta.senza_data++; continue; }
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
      il, giorni_fa: giorniFaCaricato,
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
      // Il nome a video: col suo anno quando non e' quello che si guarda.
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

/**
 * L'elenco unico delle cose da gestire. Ogni voce: { area, gravita, titolo,
 * dettaglio, link }. dati: { oggi, adessoMs, anno, alertAperti, uploadLogs,
 * tipiFile, assegnatiRete, assegnatiAci, documenti, prefatture, riepilogoQualifica,
 * richiesteEct, verificheSedi, annoNuovo, fotografiaGiorno }.
 *
 * annoNuovo e' il risultato di listaAnno per l'anno dopo: decide da se' se
 * valga la pena dirlo (avvicinandosi), e qui si scrive soltanto.
 */
export function cruscotto(dati) {
  const { oggi, anno } = dati;
  const voci = [];
  const voce = (area, gravita, titolo, dettaglio, link) => voci.push({ area, gravita, titolo, dettaglio, link });

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
  // Le date obbligatorie hanno una voce per modulo e canale, qui sotto: la voce
  // generica degli alert conta gli altri, per non dire due volte la stessa cosa.
  const altri = (dati.alertAperti || []).filter(a => !eAlertDate(a));
  const altriCritici = altri.filter(a => a.severita === 'critico').length;
  const altriPerRegola = new Map();
  for (const a of altri) { const k = nomeRegola(a.regola_nome) || a.titolo || 'Senza regola'; altriPerRegola.set(k, (altriPerRegola.get(k) || 0) + 1); }
  const principali = [...altriPerRegola.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([regola, quanti]) => `${regola} (${quanti})`).join(' · ');
  if (altriCritici > 0) voce('Alert', 'critico', `${altriCritici} alert critici aperti`, principali, '/alert-engine');
  else if (altri.length > 0) voce('Alert', 'attenzione', `${altri.length} alert aperti`, principali, '/alert-engine');
  for (const a of (dati.alertAperti || []).filter(eAlertDate)) {
    const v = voceDate(a);
    voce('Date obbligatorie', v.gravita, v.titolo, v.dettaglio, v.link);
  }

  // Caricamenti: non riusciti, interrotti, in corso, e dati vecchi. La regola e'
  // quella dei motori (freschezzaArchivi, registroCaricamenti.ts) e il testo e'
  // lo stesso dell'avviso sopra i totali delle pagine (avvisoCaricamento).
  const tipiFile = dati.tipiFile || [...new Set((dati.uploadLogs || []).map(l => l && l.tipo_file).filter(Boolean))];
  const caricamenti = freschezzaArchivi(dati.uploadLogs, oggi, dati.adessoMs, tipiFile, dati.finoAl || {});
  for (const x of caricamenti.in_corso) voce('Caricamento dati', x.avviso.gravita, x.avviso.titolo, x.avviso.dettaglio, '/caricamento-dati');
  for (const a of caricamenti.archivi) {
    const fino = a.fino_al ? ` Dentro, i dati arrivano fino al ${ilGiorno(a.fino_al)} (${a.fino_al_cosa}).` : '';
    if (a.il === null) {
      voce('Caricamento dati', 'attenzione', `Mai caricato: ${a.nome}`, (a.righe_nel_registro >= RIGHE_REGISTRO
        ? `Nessuno degli ultimi ${a.righe_nel_registro} caricamenti di questo file nel registro è riuscito.`
        : a.righe_nel_registro ? 'Nel registro ci sono solo caricamenti di questo file non riusciti.' : 'Nel registro non c\'è nessun caricamento riuscito di questo file.') + fino, '/caricamento-dati');
    } else if (a.vecchio && a.misurata_su === 'fino_al') {
      voce('Caricamento dati', 'attenzione', `${a.nome}: dati fino al ${ilGiorno(a.fino_al)}`,
        `Caricato il ${ilGiorno(a.il)}${a.nome_file ? ` (${a.nome_file})` : ''}, ma dentro i dati arrivano fino al ${ilGiorno(a.fino_al)} (${a.fino_al_cosa}): ${a.fino_al_scarto} giorni prima del caricamento, ${a.eta_giorni} giorni fa. `
        + 'Più di tre settimane senza dati prima del caricamento non sono un periodo senza movimenti (nemmeno a Natale o a Ferragosto): il file sembra scaricato dal portale molto prima. I numeri di questo archivio sono fermi a quel giorno.',
        '/caricamento-dati');
    } else if (a.vecchio) {
      voce('Caricamento dati', 'attenzione', `${a.nome}: dati di ${a.giorni_fa} giorni fa`, `Ultimo caricamento riuscito il ${ilGiorno(a.il)}${a.nome_file ? ` (${a.nome_file})` : ''}. I numeri di questo archivio sono fermi a quel giorno.${fino}`, '/caricamento-dati');
    }
  }

  // Arretrato, per canale
  const arretrato = { RETE: etaArretrato(dati.assegnatiRete, oggi), ACI: etaArretrato(dati.assegnatiAci, oggi) };
  for (const [canale, e] of Object.entries(arretrato)) {
    if (e.oltre_60 > 0) voce('Arretrato', 'attenzione', `${canale === 'RETE' ? 'Rete' : 'ACI'}: ${e.oltre_60} ordini aperti da oltre 60 giorni`, `Su ${e.totale} aperti; il più vecchio da ${e.piu_vecchio.giorni} giorni (${e.piu_vecchio.id_ordine}, ${e.piu_vecchio.ragione_sociale}).`, canale === 'RETE' ? '/assegnati' : '/assegnati-aci');
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
  if (daElaborare.length) voce('Fatturazione attiva', 'attenzione', `${daElaborare.length} ${daElaborare.length === 1 ? 'mese finito non ancora elaborato' : 'mesi finiti non ancora elaborati'}`, daElaborare.join(', '), '/fatturazione');
  if (canaleMancante.length) voce('Fatturazione attiva', 'attenzione', `${canaleMancante.length} ${canaleMancante.length === 1 ? 'mese con un canale non elaborato' : 'mesi con un canale non elaborato'}`, canaleMancante.map(m => `${m.etichetta}: ${m.canali_mancanti.map(k => NOMI_CANALI_ATTIVA[k]).join(', ')}`).join(' · '), '/fatturazione');
  if (senzaPrefattura.length) voce('Fatturazione attiva', 'info', `Prefattura Ecotyre non caricata: ${senzaPrefattura.join(', ')}`, 'Il confronto con la prefattura si fa prima di esportare.', '/fatturazione');

  // Qualifica dei fornitori
  const q = dati.riepilogoQualifica || null;
  if (q && (Number(q.scaduti) > 0 || Number(q.non_conformi) > 0)) voce('Qualifica fornitori', 'critico', `${Number(q.scaduti) || 0} documenti scaduti, ${Number(q.non_conformi) || 0} non conformi`, (q.soggetti_critici || []).slice(0, 5).map(s => s.nome).join(', '), '/qualifica-fornitori');
  if (q && Number(q.in_scadenza) > 0) voce('Qualifica fornitori', 'info', `${q.in_scadenza} documenti in scadenza`, '', '/qualifica-fornitori');
  // Un documento intestato a un fornitore che non risulta non lo chiede nessuno:
  // e' un errore silenzioso, quindi va detto qui.
  if (q && Number(q.anomalie_catalogo) > 0) voce('Qualifica fornitori', 'critico', Number(q.anomalie_catalogo) === 1 ? 'Un documento del catalogo non verrà mai chiesto a nessuno' : `${q.anomalie_catalogo} documenti del catalogo non verranno mai chiesti a nessuno`, q.anomalie_catalogo_testo || '', '/qualifica-fornitori');

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
  let ectScadute = 0, ectDaRispondere = 0;
  for (const r of dati.richiesteEct || []) {
    const esito = r.esito || statoRichiesta(r);
    // 'da_confermare' resta per le richieste salvate prima di quella data.
    if (esito === 'da_confermare' || (esito === 'evasa' && !r.evasione_confermata)) ectDaRispondere++;
    else if (esito === 'aperta' && r.scadenza && String(r.scadenza).slice(0, 10) < oggi) ectScadute++;
  }
  if (ectScadute) voce('Richieste ECT', 'critico', `${ectScadute} richieste del consorzio oltre il termine`, 'Ritiri chiesti per email da Ecotyre e non ancora evasi alla data indicata.', '/todo');
  if (ectDaRispondere) voce('Richieste ECT', 'info', `${ectDaRispondere} richieste si sono chiuse da sole e aspettano la risposta al consorzio`, 'Gli ordini risultano tutti ritirati: la richiesta e\' evasa, resta da rispondere alla mail e spuntarla.', '/todo');

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
      '/pdr?scheda=sedi');
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
  const scost = (fg && fg.scostamenti) || [];
  if (scost.length) {
    voce('Giacenze', 'attenzione',
      `${scost.length === 1 ? 'Un impianto non quadra' : `${scost.length} impianti non quadrano`} col portale`,
      `${fg.nota} Controllo del ${ilGiorno(fg.giorno)}.`,
      '/giacenze');
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
      '/dichiarazioni-impianti');
  }
  const etaFoto = fg ? giorniFa(fg.giorno, oggi) : null;
  if (etaFoto !== null && etaFoto > 2) {
    voce('Manutenzione', 'info', `Il controllo notturno non gira da ${etaFoto} giorni`,
      `L'ultima verifica della quadratura e' del ${String(fg.giorno).split('-').reverse().join('/')}: finche' non riparte, uno scostamento nuovo non lo segnala nessuno.`,
      '/giacenze');
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
      `/target-status?tab=nuovo-anno&anno=${an.anno - 1}`);
  }

  voci.sort((a, b) => GRAVITA[a.gravita] - GRAVITA[b.gravita] || a.area.localeCompare(b.area, 'it'));
  return { oggi, anno: Number(anno), da_gestire: voci, alert, caricamenti, arretrato, mesi_attiva: mesiAttiva };
}
