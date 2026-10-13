import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from '../../shared/fetchAll.ts';
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { controlliTariffaAttiva, controlliUnitaTariffa } from "../../shared/ecotyreTariffe.ts";
import { conflittiTariffa, periodoTariffa } from "../../shared/conflittiTariffa.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { traccia, eliminaConTraccia, utenteDellaRichiesta, unisciTracce } from "../../shared/traccia.ts";
import { riferimentiFornitore, riferimentiTariffa, testoRiferimenti, ARCHIVI_MOVIMENTI } from "../../shared/riferimentiAnagrafica.ts";
import { oggiRoma, giornoRoma } from "../../shared/giornoItaliano.ts";
import {
  controlliSurplus, conflittiSurplus, giornoPrimaDi, mesiDelSurplus, euroTDi, valePerFornitore, fornitoriDelSurplus,
  importoSurplus, etichettaSurplus, periodoSurplus, testoEuroT, surplusValeIl, NOMI_CANALE,
} from "../../shared/surplus.ts";
import { tariffaNonDisattivata } from "../../shared/validitaTariffa.ts";
import { arrotondaAlCentesimo } from "../../shared/ecotyreTariffe.ts";
import { campoTracciato, stessoValore } from "../../shared/campiTracciati.ts";
import { leggiCampo, precaricaParti } from "../../shared/testoLungo.ts";
import { documentoDelCanale, chiusoFuoriDalGestionale, MESI_CHIUSURA } from "../../shared/chiusuraMese.ts";
import { eRigaDiMovimento } from "../../shared/attivaCalcolo.ts";
import { formatoTonnellate, arrotondaTonnellate } from "../../shared/formato.ts";

// Gestisce le operazioni di scrittura su entità anagrafiche (Tariffa, Fornitore, Servizio)
// e sui surplus delle tariffe (SurplusTariffa, dal 13/10/2026: vedi la sezione sotto).
// FornitoreSecondaria non passa piu' di qui (27/09/2026): i collegamenti degli
// stoccaggi sono dati dell'anno e si scrivono in Target & Status, con l'anno.
// Solo l'amministratore può eseguire creazione/modifica/cancellazione.
// Per Tariffa (create/update) applica validazione server-side:
//   - campi obbligatori, chiave di unicità, sovrapposizione periodi, auto-chiusura rinegoziazione.
// Le regole dei conflitti stanno in shared/conflittiTariffa.ts dall'11/10/2026,
// perche' le usa anche la copia d'anno (preparaAnno).
// Payload: { entita, operazione, id?, dati?, motivo?, conferma_eliminazione? }
// (per SurplusTariffa anche gruppo? e anteprima?: vedi la sezione del surplus).
//
// LE TARIFFE SI SCRIVONO CON LA TRACCIA (11/10/2026). Prezzo, unita', date di
// validita' e stato di una tariffa, scritti a mano o chiusi da un prezzo nuovo,
// finiscono nello storico delle modifiche (ModificaDato, shared/traccia.ts) con
// chi, quando, il valore di prima e il motivo che arriva nel payload. La
// risposta porta traccia: { scritta, righe, motivo? }; se lo storico non si
// scrive la tariffa resta salvata, e la pagina lo dice.
function norm(v) {
  return String(v || '').trim().toUpperCase();
}

// UN FORNITORE (O UN SERVIZIO) NON SI SCRIVE DUE VOLTE (chiusura dell'audit,
// 11/10/2026). Le tariffe avevano il controllo dei doppioni, l'anagrafica no: in
// archivio ci sono «GATIM» e «GATIM S.R.L.», che per la passiva, la qualifica e
// i report sono lo stesso soggetto (normalizzaRagioneSociale li fa uguali) e
// che ognuno legge come vuole - resta il record letto per ultimo. Il menu delle
// tariffe propone due GATIM, ed e' da li' che e' nato il doppione delle tariffe
// del 2027. Qui si rifiuta il nome nuovo, o il nome cambiato, che coincide con
// uno che c'e' gia'; il doppione esistente lo toglie l'amministratore dalla
// pagina, tenendo il record a cui puntano le tariffe. Una modifica che lascia il
// nome com'e' (i ruoli, lo stato, il «fattura tramite») passa sempre: finche' il
// doppione c'e', rifiutarla vorrebbe dire non poter piu' toccare nessuno dei due.
const CAMPO_NOME = { Fornitore: 'ragione_sociale', Servizio: 'nome' };
const chiaveNome = (nome) => normalizzaRagioneSociale(String(nome || ''));
async function nomeGiaPresente(base44, entita, nome, idEscluso = null) {
  const chiave = chiaveNome(nome);
  if (!chiave) return null;
  const tutti = await fetchAll(base44.asServiceRole.entities[entita]);
  return tutti.find(x => x && x.id !== idEscluso && chiaveNome(x[CAMPO_NOME[entita]]) === chiave) || null;
}

// PRIMA DI ELIMINARE SI GUARDA CHI LO USA (audit del 20/09, alta A88; corretta
// il 12/10/2026). Un fornitore o una tariffa si eliminavano subito: le tariffe,
// le voci della passiva, i contratti e i movimenti restavano senza il loro
// soggetto o senza prezzo, e lo storico registrava l'eliminazione senza
// fermarla. Ora, se qualcosa li usa, si risponde 409 con l'elenco
// (shared/riferimentiAnagrafica.ts) e la proposta che non rompe niente -
// disattivare il fornitore, chiudere il periodo della tariffa -; si elimina lo
// stesso solo con conferma_eliminazione, e il motivo nello storico lo dice.
// Se un archivio non si legge, l'errore sale: un controllo a meta' direbbe
// «nessuno lo usa» quando non lo sa.
//
// Lo stesso vale per il record da eliminare (revisione del 13/10/2026): la sua
// lettura finiva in un catch che dava null, e con null il controllo si saltava,
// cosi' un errore passeggero bastava a eliminare senza domande un fornitore
// usato. Se non si legge, si risponde errore e non si elimina niente.
async function riferimentiPrimaDiEliminare(base44, entita, id) {
  const svc = base44.asServiceRole.entities;
  const [cosa, eliminato] = entita === 'Tariffa' ? ['la tariffa', 'eliminata'] : ['il fornitore', 'eliminato'];
  let record;
  try {
    record = await svc[entita].get(id);
  } catch (e) {
    throw new Error(`Non riesco a leggere ${cosa} da eliminare (${e && e.message ? e.message : e}): non l'ho ${eliminato}, riprova.`);
  }
  if (!record) throw new Error(`Non trovo ${cosa} da eliminare: non l'ho ${eliminato}, ricarica la pagina.`);
  const movimenti = {};
  for (const archivio of ARCHIVI_MOVIMENTI) movimenti[archivio] = await fetchAll(svc[archivio]);
  const fornitori = await fetchAll(svc.Fornitore);
  // «Chiudi periodo» solo a una tariffa ancora aperta (revisione del
  // 13/10/2026): a una gia' chiusa - dal 01/01/2027 tutte quelle del 2026 - la
  // proposta portava a chiuderla a oggi, cioe' ad allungarla, contro i contratti
  // annuali senza tacito rinnovo. La regola, e il testo per una tariffa chiusa,
  // stanno in riferimentiTariffa e testoRiferimenti; qui si passa il giorno
  // italiano di oggi.
  if (entita === 'Tariffa') return riferimentiTariffa(record, { movimenti, fornitori, oggi: oggiRoma() });
  const [tariffe, voci, contratti] = [await fetchAll(svc.Tariffa), await fetchAll(svc.VocePassivaAmministrazione), await fetchAll(svc.ContrattoFornitore)];
  return riferimentiFornitore(record, { tariffe, fornitori, voci, contratti, movimenti });
}

// === IL SURPLUS SULLE TARIFFE (13/10/2026) ===
//
// Richiesta dell'utente del 12/10/2026: accanto alle tariffe un surplus in €/t,
// con le sue date, che il consorzio o un accordo commerciale concede (il Fuel
// Surcharge di Ecotyre, +5 €/t a tutti i raccoglitori dal 01/10 al 31/12/2026,
// su rete, ACI ed extra raccolta). Si scrive solo da qui, come le tariffe: solo
// l'amministratore, ogni record con la sua traccia nello storico delle
// modifiche (euro_t_passiva e' un costo, e la traccia lo riserva), le regole
// in shared/surplus.ts uguali a quelle della pagina.
//
// UN RECORD PER CANALE, LO STESSO GRUPPO. Il modulo della pagina sceglie i
// canali con tre caselle; qui ognuno diventa un record suo (i canali non si
// sommano mai, e il consorzio potrebbe chiudere l'ACI prima della rete), con lo
// stesso `gruppo`, che la pagina usa per mostrarli in una scheda sola.
//   create: dati con i campi del surplus e tipologie: ['RETE','ACI','EXTRA_RACCOLTA']
//           (o tipologia: 'RETE'); importi_per_canale: { ACI: { euro_t_passiva,
//           euro_t_attiva } } quando gli importi cambiano fra i canali; gruppo
//           (in cima al payload come per update e delete, o in dati.gruppo)
//           solo per aggiungere un canale a un surplus che c'e' gia', o per
//           riprovare un salvataggio fermato a meta'.
//   update: con id, un record (un canale); con gruppo, tutti i canali del
//           surplus insieme - con tipologie, quelli nuovi si creano e quelli
//           tolti si eliminano, ognuno con la sua traccia.
//   delete: con id un canale, con gruppo tutto il surplus.
// La risposta rimanda il gruppo dei record scritti. Un gruppo ha UNA riga per
// canale (revisione del 13/10/2026): la modifica di tutti i canali insieme e la
// scheda unica della pagina contano su questo, e una creazione (o una modifica
// che sposta un record) che metterebbe una seconda riga su un canale che il
// gruppo ha gia' si ferma con 400. L'importo nuovo da una data e' un surplus a
// se', senza gruppo: quello di prima si chiude da solo il giorno prima.
// Prima di scrivere si controlla TUTTO (controlliSurplus e conflittiSurplus su
// ogni canale): un canale in conflitto ferma anche gli altri, cosi' non resta
// un surplus a meta' (rete si', ACI no) per un errore che si poteva dire subito.
//
// I CONFLITTI SONO QUELLI DELLE TARIFFE: lo stesso surplus (stesso nome, stesso
// canale, stessa prestazione, fornitori in comune) negli stessi giorni si
// pagherebbe due volte, e si risponde 409; quello di prima che comincia prima
// del nuovo e non finisce dopo e' il cambio d'importo da una data, e si chiude
// il giorno prima, con la sua traccia (i «chiudibili», come per le tariffe).
// Due surplus con nomi diversi sulle stesse tonnellate si pagano tutti e due: e'
// un avviso, non un errore.
//
// I MESI GIA' CHIUSI (regola 10 del progetto, domanda D7). Se il surplus nuovo,
// cambiato o eliminato cambia un mese con l'attiva gia' fatturata o la passiva
// congelata, la risposta lo dice mese per mese,
// con la stima di quanto vale li': non si riapre niente da soli. La stima
// dell'attiva e' sulle righe del documento chiuso (i chili dei formulari, sul
// giorno italiano della fine del trasporto); quella della passiva sul conto
// congelato, per fornitore e senza gli interni (il surplus delle tonnellate di
// SMOCO resta a SMOCO, D2). Con anteprima: true si fanno tutti i controlli e si
// risponde senza scrivere niente: la pagina lo usa per chiedere conferma prima
// di salvare quando un mese chiuso cambia.
//
// L'ATTIVA GIA' FATTURATA NON E' SOLO QUELLA CHIUSA (risposta dell'utente del
// 13/10/2026). Un documento approvato o esportato e' gia' andato, o sta
// andando, all'amministrazione per la fattura: l'avviso scatta anche li', come
// per «chiusa» (STATI_GIA_FATTURATI), e la frase dice lo stato vero. Un
// documento solo elaborato o verificato no: si rielabora e il surplus entra.
const CANALE_A_PAROLE = { RETE: 'rete', ACI: 'ACI', EXTRA_RACCOLTA: 'extra raccolta' };
// Gli stati dell'attiva in cui il mese e' gia' fatturato, o in fattura.
const STATI_GIA_FATTURATI = ['approvata', 'esportata', 'chiusa'];
// La prestazione nella frase del conflitto: «per la raccolta», «per lo stoccaggio».
const CON_ARTICOLO = { RACCOLTA: 'la raccolta', TRATTAMENTO: 'il trattamento', CONFERIMENTO_STOCCAGGIO: 'lo stoccaggio', TRASPORTO_SECONDARIA: 'il trasporto delle secondarie' };
// Il canale e la prestazione scritti in un modo solo, come in shared/surplus.ts.
const codiceSurplus = (v) => String(v || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
const pad2 = (n) => String(n).padStart(2, '0');
const dataIt = (g) => { const s = String(g || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : ''; };
const euroIt = (v) => {
  const n = arrotondaAlCentesimo(v);
  const [intero, dec] = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '-' : '') + intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
};
const conSegno = (v) => (v > 0 ? `+${euroIt(v)}` : euroIt(v));
const aChiElenco = (s) => String((s && s.a_chi) || 'tutti').trim().toLowerCase() === 'elenco';
const ha = (o, c) => !!o && Object.prototype.hasOwnProperty.call(o, c);
// I campi di un surplus che si copiano su un canale aggiunto a un surplus che c'e'.
const CAMPI_DEL_SURPLUS = ['nome', 'origine', 'riferimento', 'prestazione', 'a_chi', 'fornitori_json', 'euro_t_passiva', 'euro_t_attiva', 'data_inizio_validita', 'data_fine_validita', 'stato', 'note'];

function nuovoGruppo() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `surplus-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Un importo come arriva dal modulo: un numero resta quello, «5,00» diventa 5,
// il vuoto e' null (in quella direzione il surplus non si paga: un valore
// mancante non e' zero). Un testo che non e' un numero resta testo, e lo ferma
// controlliSurplus dicendo quale.
function importoScritto(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const t = String(v).trim();
  if (!t) return null;
  const n = Number(/^\d+,\d+$/.test(t) ? t.replace(',', '.') : t);
  return Number.isFinite(n) ? n : t;
}

// Un giorno come arriva dal modulo: 'aaaa-mm-gg' resta quello; un istante si
// legge sul giorno italiano (le 22:30Z del 30/09 sono il 1° ottobre).
function giornoScritto(v) {
  const t = String(v ?? '').trim();
  return /T\d/.test(t) ? (giornoRoma(t) || t) : t;
}

/** I campi del surplus che arrivano nel payload, puliti; solo quelli che ci sono (una modifica scrive solo quelli). */
function datiSurplus(dati) {
  const d = dati || {};
  const out = {};
  for (const c of ['nome', 'riferimento', 'note']) if (ha(d, c)) out[c] = String(d[c] ?? '').trim();
  // Un gruppo vuoto non toglie il record dal suo surplus: si ignora.
  if (String(d.gruppo ?? '').trim()) out.gruppo = String(d.gruppo).trim();
  for (const c of ['origine', 'tipologia', 'prestazione']) if (ha(d, c)) out[c] = codiceSurplus(d[c]);
  if (ha(d, 'a_chi')) out.a_chi = String(d.a_chi || '').trim().toLowerCase();
  if (ha(d, 'stato')) out.stato = String(d.stato || '').trim().toLowerCase();
  if (ha(d, 'fornitori_json')) {
    const f = d.fornitori_json;
    out.fornitori_json = Array.isArray(f) ? (f.length ? JSON.stringify(f) : '') : (f === null || f === undefined ? '' : String(f).trim());
  }
  for (const c of ['euro_t_passiva', 'euro_t_attiva']) if (ha(d, c)) out[c] = importoScritto(d[c]);
  for (const c of ['data_inizio_validita', 'data_fine_validita']) if (ha(d, c)) out[c] = giornoScritto(d[c]);
  return out;
}

/** Gli importi di un canale quando cambiano fra i canali (importi_per_canale). */
function importiDelCanale(dati, canale) {
  const per = dati && dati.importi_per_canale;
  if (!per || typeof per !== 'object') return {};
  const voce = Object.entries(per).find(([k]) => codiceSurplus(k) === canale);
  if (!voce || !voce[1] || typeof voce[1] !== 'object') return {};
  const out = {};
  for (const c of ['euro_t_passiva', 'euro_t_attiva']) if (ha(voce[1], c)) out[c] = importoScritto(voce[1][c]);
  return out;
}

/** I canali chiesti, ciascuno una volta: tipologie, o la sola tipologia. */
function canaliChiesti(dati) {
  const d = dati || {};
  const elenco = Array.isArray(d.tipologie) ? d.tipologie : (ha(d, 'tipologia') ? [d.tipologia] : []);
  return [...new Set(elenco.map(codiceSurplus))];
}

// Una modifica che non cambia niente non si scrive: niente richieste in piu'.
const cambiaQualcosa = (prima, patch) => Object.keys(patch || {}).some(k => (campoTracciato('SurplusTariffa', k)
  ? !stessoValore('SurplusTariffa', k, prima && prima[k], patch[k])
  : String((prima && prima[k]) ?? '') !== String(patch[k] ?? '')));

// Le frasi di errori e avvisi: la stessa frase su piu' canali si dice una volta;
// i canali si scrivono davanti solo quando la frase non vale per tutti quelli
// della richiesta («ACI: ...»), altrimenti sarebbero solo rumore.
function frasiPerCanale(esiti, canaliDellaRichiesta) {
  const perFrase = new Map();
  for (const e of esiti) {
    if (!perFrase.has(e.messaggio)) perFrase.set(e.messaggio, []);
    const canali = perFrase.get(e.messaggio);
    if (e.canale && !canali.includes(e.canale)) canali.push(e.canale);
  }
  return [...perFrase.entries()].map(([m, canali]) => (canali.length && canali.length < canaliDellaRichiesta.size
    ? `${canali.map(c => NOMI_CANALE[c] || c).join(', ')}: ${m}` : m));
}

// === I mesi gia' chiusi che il surplus cambia ===

const giorniDelMese = (anno, mese) => new Date(Date.UTC(anno, mese, 0)).getUTCDate();
// I giorni del mese che il surplus copre, estremi compresi (0 se nessuno).
function giorniCoperti(s, anno, mese) {
  const inizio = `${anno}-${pad2(mese)}-01`;
  const fine = `${anno}-${pad2(mese)}-${pad2(giorniDelMese(anno, mese))}`;
  const suoDal = String(s.data_inizio_validita || '').slice(0, 10);
  const suoAl = String(s.data_fine_validita || '').slice(0, 10);
  const dal = suoDal && suoDal > inizio ? suoDal : inizio;
  const al = suoAl && suoAl < fine ? suoAl : fine;
  return dal > al ? 0 : Math.round((Date.parse(`${al}T12:00:00Z`) - Date.parse(`${dal}T12:00:00Z`)) / 86400000) + 1;
}

// Che cosa fa un surplus in un mese, in una direzione, scritto come testo:
// importo, giorni del mese coperti, prestazione e fornitori. Due elenchi di
// surplus con le stesse firme fanno lo stesso conto in quel mese: cambiare il
// riferimento o la nota, o la fine di un surplus da dicembre a novembre, non
// tocca ottobre, e ottobre non si dice.
function firma(s, anno, mese, direzione) {
  const euro = euroTDi(s, direzione);
  if (euro === null) return '';
  const prestazione = codiceSurplus(s.prestazione);
  if (direzione === 'ATTIVA' && prestazione === 'TRASPORTO_SECONDARIA') return '';
  const inizio = `${anno}-${pad2(mese)}-01`;
  const fine = `${anno}-${pad2(mese)}-${pad2(giorniDelMese(anno, mese))}`;
  const suoDal = String(s.data_inizio_validita || '').slice(0, 10);
  const suoAl = String(s.data_fine_validita || '').slice(0, 10);
  const dal = suoDal && suoDal > inizio ? suoDal : inizio;
  const al = suoAl && suoAl < fine ? suoAl : fine;
  if (dal > al) return '';
  const chi = aChiElenco(s) ? `elenco:${fornitoriDelSurplus(s).map(f => f.id || normalizzaRagioneSociale(f.nome)).sort().join(',')}` : 'tutti';
  return [euro, dal, al, direzione === 'PASSIVA' || aChiElenco(s) ? prestazione : '', chi].join('|');
}
const firme = (lista, anno, mese, direzione) => lista.map(s => firma(s, anno, mese, direzione)).filter(Boolean).sort().join('\n');

// L'attiva chiusa: i chili dei formulari del documento (non le righe a corpo,
// non quelle di un surplus) su cui il surplus vale, sul giorno italiano della
// fine del trasporto. Con «solo questi fornitori» il documento non dice chi ha
// raccolto: la stima e' su tutto il canale, quindi per eccesso.
function latoAttiva(lista, movimenti) {
  let euro = 0, kg = 0, perEccesso = false;
  const prezzi = new Set();
  for (const s of lista) {
    const e = euroTDi(s, 'ATTIVA');
    if (e === null || codiceSurplus(s.prestazione) === 'TRASPORTO_SECONDARIA') continue;
    const suoi = movimenti.filter(v => surplusValeIl(s, v.data_fine_trasporto)).reduce((x, v) => x + (Number(v.quantita) || 0), 0);
    if (aChiElenco(s)) perEccesso = true;
    euro += importoSurplus(suoi, e);
    kg += suoi;
    prezzi.add(e);
  }
  return { tonnellate: arrotondaTonnellate(kg / 1000), euro: arrotondaAlCentesimo(euro), euro_t: prezzi.size === 1 ? [...prezzi][0] : null, perEccesso };
}

// Le tonnellate di un fornitore del conto congelato su cui vale un surplus
// passivo: nel blocco della prestazione, e per trattamento e stoccaggio solo le
// righe di quella prestazione. Con «solo questi fornitori» che nomina un
// subraccoglitore, le sue tonnellate vanno al principale che le fattura (D6).
function tonnellateDelFornitore(f, s, prestazione) {
  const sue = (prestazione === 'TRATTAMENTO' || prestazione === 'CONFERIMENTO_STOCCAGGIO')
    ? (f.righe || []).filter(r => r && codiceSurplus(r.prestazione) === prestazione).reduce((x, r) => x + (Number(r.tonnellate) || 0), 0)
    : Number(f.totale_tonnellate) || 0;
  if (valePerFornitore(s, { nomi: [f.fornitore] })) return sue;
  if (!aChiElenco(s)) return 0;
  return (f.di_cui || []).filter(x => x && valePerFornitore(s, { nomi: [x.fornitore] })).reduce((x, y) => x + (Number(y.tonnellate) || 0), 0);
}

// La passiva congelata: per fornitore esterno, al centesimo come la riga del
// surplus nella passiva (una per fornitore). Il conto congelato e' del mese
// intero e non ha i giorni: un surplus che copre solo una parte del mese si
// stima in proporzione ai giorni che copre. Non per eccesso sul mese intero:
// col cambio d'importo dal 15 il surplus di prima (fino al 14) e quello nuovo
// (dal 15) si sarebbero contati tutti e due su tutto il mese. La raccolta
// dell'extra raccolta e' invece per eccesso: il conto congelato non distingue
// gli interventi primari dalle secondarie, che il surplus non paga.
function latoPassiva(lista, conto, t) {
  let euro = 0, kg = 0, perEccesso = false, inProporzione = false;
  const prezzi = new Set();
  const delMese = giorniDelMese(t.anno, t.mese);
  for (const s of lista) {
    const e = euroTDi(s, 'PASSIVA');
    const giorni = giorniCoperti(s, t.anno, t.mese);
    if (e === null || !giorni) continue;
    const quota = giorni / delMese;
    const prestazione = codiceSurplus(s.prestazione);
    const blocco = prestazione === 'RACCOLTA' ? conto.raccoglitori : prestazione === 'TRASPORTO_SECONDARIA' ? conto.trasporti_secondaria : conto.impianti_stoccaggi;
    if (quota < 1) inProporzione = true;
    if (t.canale === 'EXTRA_RACCOLTA' && prestazione === 'RACCOLTA') perEccesso = true;
    prezzi.add(e);
    for (const f of blocco || []) {
      if (!f || f.interno) continue;
      const suoi = Math.round(tonnellateDelFornitore(f, s, prestazione) * 1000 * quota);
      if (!suoi) continue;
      euro += importoSurplus(suoi, e);
      kg += suoi;
    }
  }
  return { tonnellate: arrotondaTonnellate(kg / 1000), euro: arrotondaAlCentesimo(euro), euro_t: prezzi.size === 1 ? [...prezzi][0] : null, perEccesso, inProporzione };
}

function confronto(prima, dopo, base) {
  const p = { tonnellate: prima.tonnellate, euro: prima.euro, euro_t: prima.euro_t };
  const d = { tonnellate: dopo.tonnellate, euro: dopo.euro, euro_t: dopo.euro_t };
  const stima = prima.perEccesso || dopo.perEccesso ? 'per_eccesso' : prima.inProporzione || dopo.inProporzione ? 'in_proporzione' : 'esatta';
  return { ...base, prima: p, dopo: d, differenza: arrotondaAlCentesimo(d.euro - p.euro), stima };
}

function fraseMeseChiuso(x) {
  const quanto = (p, chi) => {
    if (p.stima === 'non_stimabile') {
      return p.fuori_dal_gestionale ? "il mese è stato fatturato fuori dal gestionale, e l'importo non si stima" : "il conto congelato non si legge, e l'importo non si stima";
    }
    const stima = p.stima === 'per_eccesso' ? ' (stima per eccesso)' : p.stima === 'in_proporzione' ? ' (stima in proporzione ai giorni del mese)' : '';
    if (!p.prima.euro) return `il surplus vale ${euroIt(p.dopo.euro)} € ${chi} (${formatoTonnellate(p.dopo.tonnellate)} t${p.dopo.euro_t !== null ? ` a ${testoEuroT(p.dopo.euro_t)}` : ''})${stima}`;
    if (!p.dopo.euro) return `il surplus di ${euroIt(p.prima.euro)} € ${chi} non vale più${stima}`;
    return `il surplus ${chi} passa da ${euroIt(p.prima.euro)} € a ${euroIt(p.dopo.euro)} € (${conSegno(p.differenza)} €)${stima}`;
  };
  const parti = [];
  if (x.attiva) parti.push(`la fatturazione attiva è ${x.attiva.stato}${x.attiva.fattura_numero ? ` (fattura ${x.attiva.fattura_numero})` : ''}: ${quanto(x.attiva, 'da Ecotyre')}`);
  if (x.passiva) parti.push(`la passiva è congelata${x.passiva.congelato_il ? ` dal ${dataIt(giornoRoma(x.passiva.congelato_il))}` : ''}: ${quanto(x.passiva, 'ai fornitori')}`);
  // Approvata o esportata non e' ancora chiusa: se la fattura non e' stata
  // emessa, la rielaborazione del mese mette il surplus nel documento.
  const nonChiusa = x.attiva && x.attiva.stato !== 'chiusa'
    ? ' Se la fattura a Ecotyre non è ancora emessa, rielaborando il mese il surplus entra nel documento.'
    : '';
  return `${x.mese_nome} ${x.anno}, ${CANALE_A_PAROLE[x.canale] || x.canale}: ${parti.join('; ')}. Il gestionale non riapre niente da solo: la differenza si gestisce a parte.${nonChiusa}`;
}

/**
 * I mesi con l'attiva gia' fatturata (approvata, esportata o chiusa) o la
 * passiva congelata che i cambi cambiano.
 * cambi: [{ prima, dopo }] di record SurplusTariffa (null quando manca: un
 * surplus nuovo non ha prima, uno eliminato non ha dopo). Si guardano solo i
 * mesi fino a quello di oggi (uno dopo non puo' essere chiuso), e si leggono
 * documenti e congelati solo se almeno un mese cambia davvero: un surplus
 * scritto prima del suo periodo, come il Fuel Surcharge, non costa letture.
 * -> [{ anno, mese, mese_nome, canale, attiva, passiva, messaggio }]; attiva e
 *    passiva { stato, prima: { tonnellate, euro, euro_t }, dopo, differenza,
 *    stima: 'esatta'|'in_proporzione'|'per_eccesso'|'non_stimabile' } o null.
 */
async function mesiChiusiDelSurplus(base44, cambi, oggi = oggiRoma()) {
  const meseDiOggi = String(oggi).slice(0, 7);
  const toccati = new Map();
  for (const { prima, dopo } of cambi) {
    for (const [lato, s] of [['prima', prima], ['dopo', dopo]]) {
      if (!s || !tariffaNonDisattivata(s)) continue;
      const canale = codiceSurplus(s.tipologia);
      for (const { anno, mese } of mesiDelSurplus(s)) {
        if (`${anno}-${pad2(mese)}` > meseDiOggi) continue;
        const k = `${canale}|${anno}|${mese}`;
        if (!toccati.has(k)) toccati.set(k, { canale, anno, mese, prima: [], dopo: [] });
        toccati.get(k)[lato].push(s);
      }
    }
  }
  const ordineCanale = (c) => { const i = Object.keys(CANALE_A_PAROLE).indexOf(c); return i < 0 ? 9 : i; };
  const daGuardare = [...toccati.values()].map(t => ({
    ...t,
    attiva: firme(t.prima, t.anno, t.mese, 'ATTIVA') !== firme(t.dopo, t.anno, t.mese, 'ATTIVA'),
    passiva: firme(t.prima, t.anno, t.mese, 'PASSIVA') !== firme(t.dopo, t.anno, t.mese, 'PASSIVA'),
  })).filter(t => t.attiva || t.passiva)
    .sort((a, b) => a.anno - b.anno || a.mese - b.mese || ordineCanale(a.canale) - ordineCanale(b.canale));
  if (!daGuardare.length) return [];

  const svc = base44.asServiceRole.entities;
  const [documenti, congelati] = await Promise.all([fetchAll(svc.DocumentoFatturazione, { tipo: 'ATTIVA' }), fetchAll(svc.ChiusuraPassivaMese)]);
  const congelatoDi = (t) => congelati.filter(x => x && Number(x.anno) === t.anno && Number(x.mese) === t.mese && codiceSurplus(x.canale) === t.canale)
    .sort((a, b) => String(b.congelato_il || '').localeCompare(String(a.congelato_il || '')))[0] || null;
  // I conti congelati sono lunghi e stanno a pezzi: si leggono in blocco, non
  // uno per mese (il limite di richieste della piattaforma).
  await precaricaParti(base44, 'ChiusuraPassivaMese', daGuardare.filter(t => t.passiva).map(congelatoDi).filter(Boolean), ['passiva_json']);
  const vociLette = new Map();
  const esito = [];
  for (const t of daGuardare) {
    const meseNome = MESI_CHIUSURA[t.mese - 1];
    let attiva = null;
    let passiva = null;
    if (t.attiva) {
      const delMese = documenti.filter(x => x && Number(x.anno) === t.anno && x.mese === meseNome && !x.superato && x.stato !== 'bozza');
      const doc = documentoDelCanale(delMese, t.canale);
      // approvata, esportata o chiusa: il mese e' gia' fatturato (13/10/2026)
      if (doc && STATI_GIA_FATTURATI.includes(doc.stato)) {
        const base = { stato: doc.stato, documento_id: doc.id, fattura_numero: String(doc.fattura_numero || '') };
        if (chiusoFuoriDalGestionale(doc)) {
          attiva = { ...base, fuori_dal_gestionale: true, prima: null, dopo: null, differenza: null, stima: 'non_stimabile' };
        } else {
          if (!vociLette.has(doc.id)) vociLette.set(doc.id, await fetchAll(svc.VoceFatturazione, { documento_id: doc.id }));
          // Un documento senza canale (di prima dei documenti per canale) ha le
          // righe di tutti e tre: si prendono quelle del canale.
          const movimenti = vociLette.get(doc.id).filter(v => v && eRigaDiMovimento(v) && (!v.tipologia || codiceSurplus(v.tipologia) === t.canale));
          attiva = confronto(latoAttiva(t.prima, movimenti), latoAttiva(t.dopo, movimenti), base);
        }
      }
    }
    if (t.passiva) {
      const cong = congelatoDi(t);
      if (cong) {
        const base = { stato: 'congelata', congelato_il: String(cong.congelato_il || '') };
        let conto = null;
        try { conto = JSON.parse((await leggiCampo(base44, 'ChiusuraPassivaMese', cong, 'passiva_json')) || 'null'); } catch { conto = null; }
        passiva = conto && typeof conto === 'object'
          ? confronto(latoPassiva(t.prima, conto, t), latoPassiva(t.dopo, conto, t), base)
          : { ...base, prima: null, dopo: null, differenza: null, stima: 'non_stimabile' };
      }
    }
    const conta = (p) => !!p && (p.stima === 'non_stimabile' || p.differenza !== 0);
    if (!conta(attiva) && !conta(passiva)) continue;
    const x = { anno: t.anno, mese: t.mese, mese_nome: meseNome, canale: t.canale, attiva: conta(attiva) ? attiva : null, passiva: conta(passiva) ? passiva : null };
    esito.push({ ...x, messaggio: fraseMeseChiuso(x) });
  }
  return esito;
}

/**
 * Crea, modifica o elimina un surplus: un canale (id) o tutti i canali dello
 * stesso surplus (gruppo). Vedi il commento della sezione.
 */
async function gestisciSurplus(base44, richiesta, comeScrive) {
  const { operazione, id, dati, anteprima } = richiesta;
  const gruppo = String(richiesta.gruppo || '').trim();
  const svc = base44.asServiceRole.entities;
  const d = dati || {};
  if ((operazione === 'update' || operazione === 'delete') && !id && !gruppo) {
    return Response.json({ error: 'Per modificare o eliminare un surplus serve il suo id, o il gruppo per tutti i suoi canali insieme.' }, { status: 400 });
  }
  if (id && (Array.isArray(d.tipologie) || ha(d, 'importi_per_canale'))) {
    return Response.json({ error: "Con l'id si modifica un canale solo: per più canali insieme si passa il gruppo del surplus." }, { status: 400 });
  }

  const tutti = (await fetchAll(svc.SurplusTariffa)).filter(Boolean);
  const comuni = datiSurplus(d);
  // Il piano di quello che si scrive: un passo per record.
  const piani = [];
  if (operazione === 'create') {
    // Il gruppo della creazione arriva in cima al payload, come per update e
    // delete (e come lo rimanda la risposta del salvataggio fermato a meta'), o
    // in dati.gruppo. Prima si leggeva solo il secondo (revisione del
    // 13/10/2026): l'ACI aggiunto col gruppo in cima finiva in un gruppo nuovo,
    // la risposta diceva quello del payload, e l'eliminazione del surplus
    // lasciava l'ACI a pagare e fatturare 5 €/t. Due gruppi diversi non si
    // indovinano: 400.
    if (gruppo && comuni.gruppo && gruppo !== comuni.gruppo) {
      return Response.json({ error: 'Il gruppo del surplus arriva due volte, con due valori diversi: non si sa a quale surplus aggiungere il canale. Ricarica la pagina e riprova.' }, { status: 400 });
    }
    const g = gruppo || comuni.gruppo || nuovoGruppo();
    const canali = canaliChiesti(d);
    for (const c of canali.length ? canali : ['']) {
      const record = { stato: 'attivo', a_chi: 'tutti', ...comuni, tipologia: c, gruppo: g, ...importiDelCanale(d, c) };
      piani.push({ operazione: 'create', id: null, prima: null, patch: record, dopo: record });
    }
  } else if (id) {
    const rec = tutti.find(x => x.id === id);
    if (!rec) return Response.json({ error: 'Non trovo il surplus: forse è stato appena eliminato. Ricarica la pagina.' }, { status: 404 });
    if (operazione === 'update') piani.push({ operazione: 'update', id, prima: rec, patch: comuni, dopo: { ...rec, ...comuni } });
    else piani.push({ operazione: 'delete', id, prima: rec, patch: null, dopo: null });
  } else {
    const delGruppo = tutti.filter(x => String(x.gruppo || '') === gruppo);
    if (!delGruppo.length) return Response.json({ error: 'Non trovo il surplus: forse è stato appena eliminato. Ricarica la pagina.' }, { status: 404 });
    if (operazione === 'delete') {
      for (const rec of delGruppo) piani.push({ operazione: 'delete', id: rec.id, prima: rec, patch: null, dopo: null });
    } else {
      const perCanale = new Map();
      for (const rec of delGruppo) {
        const c = codiceSurplus(rec.tipologia);
        if (perCanale.has(c)) {
          return Response.json({ error: `Questo surplus ha due righe sul canale ${CANALE_A_PAROLE[c] || c}: modificale una per una.` }, { status: 400 });
        }
        perCanale.set(c, rec);
      }
      const canali = Array.isArray(d.tipologie) ? canaliChiesti(d) : [...perCanale.keys()];
      if (!canali.length) return Response.json({ error: 'Scegli almeno un canale. Per togliere il surplus da tutti i canali, eliminalo.' }, { status: 400 });
      const { tipologia: _tipologia, gruppo: _gruppo, ...comuniDelGruppo } = comuni;
      const modello = delGruppo[0];
      for (const c of canali) {
        const rec = perCanale.get(c);
        if (rec) {
          const patch = { ...comuniDelGruppo, ...importiDelCanale(d, c) };
          piani.push({ operazione: 'update', id: rec.id, prima: rec, patch, dopo: { ...rec, ...patch } });
        } else {
          // Un canale aggiunto prende il surplus com'e' sugli altri canali, e
          // sopra quello che arriva nel payload.
          const base = {};
          for (const k of CAMPI_DEL_SURPLUS) if (ha(modello, k) && modello[k] !== undefined) base[k] = modello[k];
          const record = { stato: 'attivo', a_chi: 'tutti', ...base, ...comuniDelGruppo, tipologia: c, gruppo, ...importiDelCanale(d, c) };
          piani.push({ operazione: 'create', id: null, prima: null, patch: record, dopo: record });
        }
      }
      for (const [c, rec] of perCanale) {
        if (!canali.includes(c)) piani.push({ operazione: 'delete', id: rec.id, prima: rec, patch: null, dopo: null, motivo: 'canale tolto dal surplus' });
      }
    }
  }

  // Una riga per canale nel gruppo (vedi il commento della sezione). Si
  // controllano solo i record che entrano in un posto (gruppo e canale) che non
  // era il loro: una modifica che lascia il record dov'e' passa sempre, cosi'
  // due righe che ci fossero gia' si possono correggere una per una.
  const toccati = new Set(piani.map(p => p.id).filter(Boolean));
  const dopoLeScritture = [...tutti.filter(x => !toccati.has(x.id)), ...piani.filter(p => p.dopo).map(p => p.dopo)];
  const occupati = [];
  for (const p of piani) {
    if (!p.dopo) continue;
    const g = String(p.dopo.gruppo || '');
    const c = codiceSurplus(p.dopo.tipologia);
    if (!g || (p.prima && String(p.prima.gruppo || '') === g && codiceSurplus(p.prima.tipologia) === c)) continue;
    const altro = dopoLeScritture.find(x => x !== p.dopo && String(x.gruppo || '') === g && codiceSurplus(x.tipologia) === c);
    if (altro) {
      occupati.push({
        canale: c, campo: 'gruppo',
        messaggio: `Questo surplus ha già una riga sul canale ${CANALE_A_PAROLE[c] || c} (${etichettaSurplus(altro)}), e ne ha una sola per canale: per cambiarla, modifica quella. Un surplus diverso, o l'importo nuovo da una certa data, si crea come surplus nuovo: quello di prima si chiude da solo il giorno prima.`,
      });
    }
  }
  if (occupati.length) {
    return Response.json({ error: occupati.map(e => e.messaggio).join(' '), errori: occupati }, { status: 400 });
  }

  // I controlli, su tutti i canali prima di scrivere il primo.
  const scritti = piani.filter(p => p.dopo);
  const canaliDellaRichiesta = new Set(scritti.map(p => codiceSurplus(p.dopo.tipologia)));
  const errori = [];
  const avvisi = [];
  for (const p of scritti) {
    const canale = codiceSurplus(p.dopo.tipologia);
    for (const e of controlliSurplus(p.dopo)) (e.gravita === 'errore' ? errori : avvisi).push({ canale, campo: e.campo, messaggio: e.messaggio });
    // Lo stato e' attivo o non_attivo (che non vale mai): un altro valore
    // l'archivio lo rifiuterebbe a meta' delle scritture.
    if (!['', 'attivo', 'non_attivo'].includes(String(p.dopo.stato ?? ''))) {
      errori.push({ canale, campo: 'stato', messaggio: `Lo stato «${p.dopo.stato}» non esiste: un surplus è attivo, o disattivato (non vale mai).` });
    }
  }
  if (errori.length) {
    return Response.json({ error: frasiPerCanale(errori, canaliDellaRichiesta).join(' '), errori }, { status: 400 });
  }
  const daChiudere = new Map();
  for (const p of scritti) {
    // Un surplus disattivato non vale mai: non si scontra con nessuno.
    if (!tariffaNonDisattivata(p.dopo)) continue;
    const canale = codiceSurplus(p.dopo.tipologia);
    const esito = conflittiSurplus(p.dopo, tutti, p.id);
    if (esito.conflitti.length) {
      const c = esito.conflitti[0];
      return Response.json({
        error: `Sul canale ${CANALE_A_PAROLE[canale] || canale}, per ${CON_ARTICOLO[codiceSurplus(c.prestazione)] || 'la stessa prestazione'}, c'è già ${etichettaSurplus(c)}: lo stesso surplus negli stessi giorni si pagherebbe due volte. Cambia le date, o modifica quello che c'è. Per cambiare l'importo da una certa data, scrivi il nuovo da quella data fino alla fine di quello di prima: quello di prima si chiude da solo il giorno prima.`,
        conflitto: { id: c.id, gruppo: String(c.gruppo || ''), nome: c.nome, tipologia: c.tipologia, prestazione: c.prestazione, periodo: periodoSurplus(c) },
        canale,
      }, { status: 409 });
    }
    for (const t of esito.chiudibili) daChiudere.set(t.id, { t, fine: giornoPrimaDi(p.dopo.data_inizio_validita), dal: p.dopo.data_inizio_validita });
    for (const a of esito.avvisi) avvisi.push({ canale, campo: a.campo, messaggio: a.messaggio });
  }

  // I mesi gia' chiusi che cambiano: per i chiudibili il «dopo» e' com'erano,
  // con la fine nuova.
  const cambi = piani.map(p => ({ prima: p.prima, dopo: p.dopo }))
    .concat([...daChiudere.values()].map(({ t, fine }) => ({ prima: t, dopo: { ...t, data_fine_validita: fine } })));
  const mesiChiusi = await mesiChiusiDelSurplus(base44, cambi);
  const testiAvvisi = [...frasiPerCanale(avvisi, canaliDellaRichiesta), ...mesiChiusi.map(m => m.messaggio)];
  // Il gruppo che la risposta rimanda e' quello dei record scritti, non quello
  // del payload (revisione del 13/10/2026): la pagina lo usa per la modifica e
  // l'eliminazione di tutti i canali insieme.
  const gruppoDellaRisposta = (piani[0] && ((piani[0].dopo && piani[0].dopo.gruppo) || (piani[0].prima && piani[0].prima.gruppo))) || gruppo || '';
  const surplusChiusi = [...daChiudere.values()].map(({ t, fine }) => ({
    id: t.id, gruppo: String(t.gruppo || ''), nome: t.nome, tipologia: t.tipologia, data_fine_validita: fine,
    euro_t_passiva: t.euro_t_passiva ?? null, euro_t_attiva: t.euro_t_attiva ?? null,
  }));

  if (anteprima === true) {
    return Response.json({
      anteprima: true,
      gruppo: gruppoDellaRisposta,
      piano: piani.map(p => ({ operazione: p.operazione, id: p.id, tipologia: codiceSurplus((p.dopo || p.prima).tipologia) })),
      ...(surplusChiusi.length ? { surplus_chiusi: surplusChiusi } : {}),
      ...(testiAvvisi.length ? { avvisi: testiAvvisi } : {}),
      ...(mesiChiusi.length ? { mesi_chiusi: mesiChiusi } : {}),
    });
  }

  // Le scritture. Prima si chiude il surplus di prima, poi si scrive il nuovo,
  // come per le tariffe: se il secondo passo non riesce, manca un surplus (e si
  // vede come differenza), non se ne pagano due. Se una scrittura si ferma a
  // meta' si dice che cosa e' stato scritto e che cosa no: il gruppo e' lo
  // stesso, e si riprova solo quello che manca.
  const tracce = [];
  const result = [];
  const fatti = [];
  const sulCanale = (p) => `sul canale ${CANALE_A_PAROLE[codiceSurplus((p.dopo || p.prima).tipologia)] || 'senza nome'}`;
  const fatto = (p) => `${p.operazione === 'create' ? 'creato' : p.operazione === 'update' ? 'modificato' : 'eliminato'} ${sulCanale(p)}`;
  const daFare = (p) => `${p.operazione === 'create' ? 'la creazione' : p.operazione === 'update' ? 'la modifica' : "l'eliminazione"} ${sulCanale(p)}`;
  let passo = null;
  try {
    for (const { t, fine, dal } of daChiudere.values()) {
      passo = `la chiusura al ${dataIt(fine)} di ${etichettaSurplus(t)}`;
      const chiuso = await traccia(svc, 'SurplusTariffa', t.id, { data_fine_validita: fine }, {
        ...comeScrive,
        motivo: `chiuso dal surplus nuovo che vale dal ${dataIt(dal)}${comeScrive.motivo ? `: ${comeScrive.motivo}` : ''}`,
      });
      tracce.push(chiuso.traccia);
      fatti.push(`chiuso al ${dataIt(fine)} ${etichettaSurplus(t)} sul canale ${CANALE_A_PAROLE[codiceSurplus(t.tipologia)] || t.tipologia}`);
    }
    for (const p of piani) {
      passo = daFare(p);
      if (p.operazione === 'delete') {
        const tolto = await eliminaConTraccia(svc, 'SurplusTariffa', p.id, { ...comeScrive, prima: p.prima, motivo: [p.motivo, comeScrive.motivo].filter(Boolean).join(': ') });
        tracce.push(tolto.traccia);
        result.push({ id: p.id, deleted: true });
      } else if (p.operazione === 'update' && !cambiaQualcosa(p.prima, p.patch)) {
        result.push(p.prima);
      } else {
        const scritto = await traccia(svc, 'SurplusTariffa', p.operazione === 'update' ? p.id : null, p.patch, comeScrive);
        tracce.push(scritto.traccia);
        result.push(scritto.record);
      }
      fatti.push(fatto(p));
    }
  } catch (e) {
    const motivo = e && e.message ? e.message : String(e);
    // Se si e' fermata la prima scrittura non c'e' niente di salvato, e la
    // frase lo dice (revisione del 13/10/2026): «salvato solo in parte» faceva
    // credere che qualcosa fosse scritto.
    return Response.json({
      error: fatti.length
        ? `Il surplus è salvato solo in parte. Fatto: ${fatti.join('; ')}. Non riuscito: ${passo} (${motivo}). Riprova solo quello che manca, con lo stesso gruppo.`
        : `Il surplus non è stato salvato: non è stato scritto niente. Non riuscito: ${passo} (${motivo}). Riprova.`,
      gruppo: gruppoDellaRisposta, fatti, non_riuscito: passo, traccia: unisciTracce(tracce),
    }, { status: 500 });
  }

  const risposta = { result, gruppo: gruppoDellaRisposta, traccia: unisciTracce(tracce) };
  if (surplusChiusi.length) risposta.surplus_chiusi = surplusChiusi;
  if (testiAvvisi.length) risposta.avvisi = testiAvvisi;
  if (mesiChiusi.length) risposta.mesi_chiusi = mesiChiusi;
  return Response.json(risposta);
}

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
    const { entita, operazione, id, dati, motivo, conferma_eliminazione, gruppo, anteprima } = await req.json();
    const svc = base44.asServiceRole.entities;
    const comeScrive = { utente: utenteDellaRichiesta(user), origine: 'Tariffe & Anagrafiche', motivo: String(motivo || '').trim() };
    const tracce = [];

    const ENTITA_AMMESSE = ['Tariffa', 'SurplusTariffa', 'Fornitore', 'Servizio'];
    const OPERAZIONI_AMMESSE = ['create', 'update', 'delete'];

    if (!ENTITA_AMMESSE.includes(entita)) {
      return Response.json({ error: 'Entità non ammessa. Valori validi: ' + ENTITA_AMMESSE.join(', ') }, { status: 400 });
    }
    if (!OPERAZIONI_AMMESSE.includes(operazione)) {
      return Response.json({ error: 'Operazione non ammessa. Valori validi: ' + OPERAZIONI_AMMESSE.join(', ') }, { status: 400 });
    }
    // Il surplus ha le sue regole (un record per canale, il gruppo, i mesi
    // chiusi): vedi gestisciSurplus qui sopra.
    if (entita === 'SurplusTariffa') {
      return await gestisciSurplus(base44, { operazione, id, gruppo, dati, anteprima }, comeScrive);
    }
    if ((operazione === 'update' || operazione === 'delete') && !id) {
      return Response.json({ error: 'ID obbligatorio per update e delete' }, { status: 400 });
    }

    // === VALIDAZIONE TARIFFA (create e update) ===
    let tariffeChiuse = [];
    // Gli avvisi che non fermano il salvataggio ma devono arrivare a chi salva.
    const avvisiTariffa = [];
    if (entita === 'Tariffa' && (operazione === 'create' || operazione === 'update')) {
      let effettivi = dati || {};

      // Per update, fondi il record esistente con i nuovi dati
      if (operazione === 'update') {
        const esistente = await base44.asServiceRole.entities.Tariffa.get(id);
        effettivi = { ...esistente, ...dati };
      }

      // a) Campi obbligatori (valore zero ammesso) - distinti per direzione
      const isAttiva = norm(effettivi.direzione) === 'ATTIVA';
      const campiObbligatori = isAttiva
        ? ['cliente', 'direzione', 'tipologia', 'unita_misura', 'valore']
        : ['fornitore_id', 'direzione', 'tipologia', 'prestazione', 'unita_misura', 'valore'];
      const mancanti = campiObbligatori.filter(c => {
        const v = effettivi[c];
        if (c === 'valore') return v === undefined || v === null;
        return v === undefined || v === null || String(v).trim() === '';
      });
      if (mancanti.length > 0) {
        return Response.json({ error: 'Campi obbligatori mancanti', mancanti }, { status: 400 });
      }

      // ATTIVA non ammette prestazione
      if (isAttiva && effettivi.prestazione && String(effettivi.prestazione).trim() !== '') {
        return Response.json({ error: 'Il campo prestazione non si applica alla fatturazione attiva.' }, { status: 400 });
      }

      // servizio_ecotyre si applica solo alla fatturazione attiva
      if (!isAttiva && effettivi.servizio_ecotyre && String(effettivi.servizio_ecotyre).trim() !== '') {
        return Response.json({ error: 'Il campo servizio_ecotyre si applica solo alla fatturazione attiva.' }, { status: 400 });
      }

      // Il prezzo unico che comprende il trattamento riguarda solo la raccolta
      // passiva: altrove non avrebbe significato.
      if (effettivi.comprensiva_trattamento === true && (isAttiva || norm(effettivi.prestazione) !== 'RACCOLTA')) {
        return Response.json({ error: 'Il prezzo unico comprensivo del trattamento si applica solo alle tariffe passive di raccolta.' }, { status: 400 });
      }

      // f) Data fine precedente a data inizio
      const inizio = effettivi.data_inizio_validita;
      const fine = effettivi.data_fine_validita;
      if (inizio && fine && new Date(fine) < new Date(inizio)) {
        return Response.json({ error: 'La data di fine validità precede la data di inizio' }, { status: 400 });
      }

      // TUTTE ammessa solo per TRASPORTO_SECONDARIA
      if (norm(effettivi.tipologia) === 'TUTTE' && norm(effettivi.prestazione) !== 'TRASPORTO_SECONDARIA') {
        return Response.json({ error: 'La tipologia TUTTE è ammessa solo per il trasporto delle secondarie.' }, { status: 400 });
      }

      // b-e) Verifica conflitti (chiave distinta per direzione). Le passive si
      // leggono tutte, non solo quelle dello stesso fornitore_id: lo stesso
      // fornitore scritto in due modi (due righe in anagrafica) e' lo stesso
      // fornitore anche qui, come per la passiva (conflittiTariffa.ts, 11/10/2026).
      // Le passive si leggono senza filtro sulla direzione: una tariffa salvata
      // prima che il campo esistesse non ce l'ha scritto, ed e' passiva.
      const esistenti = isAttiva
        ? await fetchAll(base44.asServiceRole.entities.Tariffa, { direzione: 'ATTIVA' })
        : (await fetchAll(base44.asServiceRole.entities.Tariffa)).filter(t => norm(t.direzione || 'PASSIVA') === 'PASSIVA');
      // Caso d: chiudibile se senza data fine e la nuova comincia dopo.
      const { conflitti, chiudibili } = conflittiTariffa(effettivi, esistenti, operazione === 'update' ? id : null);

      if (conflitti.length > 0) {
        const c = conflitti[0];
        const periodo = periodoTariffa(c);
        const desc = isAttiva
          ? `cliente: ${c.cliente}, tipologia: ${c.tipologia}, regione: ${c.regione || 'tutte'}`
          : `${c.fornitore_nome} (prestazione: ${c.prestazione})`;
        return Response.json({
          error: `Conflitto con tariffa esistente per ${desc}, periodo: ${periodo}. Modifica la chiave o le date di validità.`,
          conflitto: { id: c.id, fornitore_nome: c.fornitore_nome, prestazione: c.prestazione, cliente: c.cliente, tipologia: c.tipologia, regione: c.regione, periodo }
        }, { status: 409 });
      }

      // f) I DUE MODI SILENZIOSI DI ROMPERE LA TARIFFA UNICA (06/10/2026):
      // un'unita' di misura sbagliata, che moltiplica o divide per mille, e una
      // seconda tariffa dello stesso canale legata a una dicitura, che
      // scavalcherebbe quella che vale per tutte. Il primo e' un errore e ferma
      // il salvataggio; il secondo e' un avviso che torna a chi salva.
      // L'unita' di misura si controlla anche sulle passive (11/10/2026): 90 €/kg
      // si salvava, e nel foglio dell'amministrazione diventava 90.000 €/t.
      const controlli = isAttiva ? controlliTariffaAttiva(effettivi, esistenti) : controlliUnitaTariffa(effettivi);
      const errore = controlli.find(c => c.gravita === 'errore');
      if (errore) return Response.json({ error: errore.messaggio }, { status: 400 });
      avvisiTariffa.push(...controlli.map(c => c.messaggio));

      // d) Chiudi le tariffe chiudibili (rinegoziazione prezzo)
      // La tariffa chiusa resta 'attivo': lo stato non_attivo vuol dire "non
      // deve valere mai", e usarlo qui cancellerebbe il prezzo da tutti i mesi
      // gia' fatturati con quel prezzo. A dire fino a quando vale e' la data di
      // fine. Nell'elenco delle tariffe sparisce lo stesso, perche' isArchiviata
      // guarda anche la data di fine passata.
      for (const t of chiudibili) {
        const fineChiusura = new Date(inizio);
        fineChiusura.setDate(fineChiusura.getDate() - 1);
        const dataFine = fineChiusura.toISOString().slice(0, 10);
        const chiusa = await traccia(svc, 'Tariffa', t.id, { data_fine_validita: dataFine }, {
          ...comeScrive,
          motivo: `chiusa dal prezzo nuovo che vale dal ${String(inizio).slice(0, 10).split('-').reverse().join('/')}${comeScrive.motivo ? `: ${comeScrive.motivo}` : ''}`,
        });
        tracce.push(chiusa.traccia);
        tariffeChiuse.push({
          id: t.id, fornitore_nome: t.fornitore_nome,
          data_fine_validita: dataFine, valore: t.valore, unita_misura: t.unita_misura,
        });
      }
    }

    // Il nome di un fornitore o di un servizio: nuovo, o cambiato, non deve
    // coincidere con uno che c'e' gia'.
    if ((entita === 'Fornitore' || entita === 'Servizio') && (operazione === 'create' || operazione === 'update')) {
      const campo = CAMPO_NOME[entita];
      const nome = dati && dati[campo];
      if (operazione === 'create' && !String(nome || '').trim()) {
        return Response.json({ error: `Il ${entita === 'Fornitore' ? 'fornitore' : 'servizio'} ha bisogno di un nome.` }, { status: 400 });
      }
      // Su una modifica si controlla solo se il nome cambia davvero.
      let cambiaNome = nome !== undefined;
      if (cambiaNome && operazione === 'update') {
        const prima = await base44.asServiceRole.entities[entita].get(id).catch(() => null);
        cambiaNome = !prima || chiaveNome(prima[campo]) !== chiaveNome(nome);
      }
      if (cambiaNome) {
        const gia = await nomeGiaPresente(base44, entita, nome, operazione === 'update' ? id : null);
        if (gia) {
          const chi = String(gia[campo] || '').trim();
          return Response.json({
            error: `«${String(nome).trim()}» e «${chi}» sono lo stesso ${entita === 'Fornitore' ? 'fornitore' : 'servizio'} per il gestionale (stesso nome normalizzato): usa quello che c'e' gia', o correggi il suo nome.`,
            doppione: { id: gia.id, nome: chi, stato: gia.stato || '' },
          }, { status: 409 });
        }
      }
    }

    // Fornitori e servizi non hanno campi tracciati: passano di qui lo stesso,
    // e si scrivono senza una lettura in piu'.
    let result;
    if (operazione === 'create' || operazione === 'update') {
      const scritta = await traccia(svc, entita, operazione === 'update' ? id : null, dati || {}, comeScrive);
      tracce.push(scritta.traccia);
      result = scritta.record;
    } else if (operazione === 'delete') {
      // Chi usa il fornitore o la tariffa (A88, 12/10/2026): vedi
      // riferimentiPrimaDiEliminare qui sopra.
      if (entita === 'Fornitore' || entita === 'Tariffa') {
        const riferimenti = await riferimentiPrimaDiEliminare(base44, entita, id);
        if (riferimenti && riferimenti.totale > 0) {
          if (conferma_eliminazione !== true) {
            return Response.json({ error: testoRiferimenti(riferimenti), riferimenti, richiede_conferma: true, conferma: 'eliminazione' }, { status: 409 });
          }
          comeScrive.motivo = [comeScrive.motivo, `eliminazione confermata nonostante: ${riferimenti.elenco.join("; ")}`].filter(Boolean).join(' — ');
        }
      }
      const tolta = await eliminaConTraccia(svc, entita, id, comeScrive);
      tracce.push(tolta.traccia);
      result = { id, deleted: true };
    }

    const response = { result, traccia: unisciTracce(tracce) };
    if (tariffeChiuse.length > 0) {
      response.tariffe_chiuse = tariffeChiuse;
    }
    // Gli avvisi non fermano il salvataggio, ma non si perdono per strada.
    if (avvisiTariffa.length > 0) {
      response.avvisi = avvisiTariffa;
    }
    return Response.json(response);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}