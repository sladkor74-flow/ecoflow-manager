import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { oggiRoma, annoRoma } from "../../shared/giornoItaliano.ts";
import { eTerminato, periodoMovimento, giornoMovimento } from "../../shared/movimenti.ts";
import { computeProvinceMatrixData, computeRaccoglitoriMixData, computeSlaMetrics } from "../../shared/primarieReteAnalytics.ts";
import { conferimentiSospetti } from "../../shared/rotteConferimenti.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";

// Il controllo delle rotte non nasce da una RegolaAlert configurata: e' un
// controllo di coerenza della commessa. Ha pero' bisogno di un identificativo
// suo, e deve essere lo stesso nella chiave, nell'alert salvato e nella
// chiusura, altrimenti l'alert si ricrea a ogni giro e non si chiude mai.
const REGOLA_ROTTA = 'rotta_conferimento';
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { canaleDi } from "../../shared/canaleSecondaria.ts";
import { aggregaTargetMensili, targetDelPortale } from "../../shared/targetRaccoglitori.ts";
import { formatoTonnellate } from "../../shared/formato.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { statoCaricamenti, caricamentiDuranteLettura, descriviCaricamento, riepilogoDate, descriviVoceDate } from "../../shared/reportSettimanali.ts";

// Le date obbligatorie dei formulari: immissione, inizio e fine trasporto
// (regola dell'utente del 22/09/2026, "vanno segnalate e questo vale sempre dove
// ci sono ordini terminati"). Come le rotte, non e' una RegolaAlert da
// configurare: e' la commessa che lo chiede, e vale sempre, in ogni modulo di
// movimenti e per canale. Un alert per modulo e canale, con l'elenco degli
// ordini, che si riscrive a ogni giro e si chiude da solo quando le date ci sono.
// regola_id: date_obbligatorie_<canale>; record_id: il modulo.
const REGOLA_DATE = 'date_obbligatorie';
const NOME_REGOLA_DATE = 'Ordini terminati con date obbligatorie mancanti o incoerenti';
// Quanti ordini si scrivono nel testo dell'alert: gli altri si contano.
const ORDINI_NEL_TESTO = 40;

// I caricamenti che riscrivono l'archivio letto da ciascun modulo. Il file unico
// delle primarie riscrive rete, ACI e assegnati; primarie_rete e primarie_aci
// sono i tipi di quando si caricavano separati. L'extra raccolta non ha un file:
// le sue schede scrivono nel registro una riga 'extra_raccolta' quando la
// modifica tocca un giorno di fine trasporto, e dal 22/09/2026 quella riga avvia
// il motore (workflow AlertEngineAutoRun). Una scheda senza fine trasporto non la
// scrive: allora il motore lo lancia la pagina dopo il salvataggio
// (dopoCaricamento, src/lib/importGrandeFile.js). Cosi' l'alert delle date
// dell'extra raccolta si rivaluta a ogni modifica, come gli altri.
const CARICAMENTI_DEL_MODULO = {
  primarie_rete: ['primarie', 'primarie_rete'],
  primarie_aci: ['primarie', 'primarie_aci'],
  assegnati: ['primarie'],
  secondarie: ['secondarie'],
  terziarie: ['terziarie'],
  extra_raccolta: ['extra_raccolta'],
};

// Il nome del modulo nel titolo dell'alert, e i canali in cui si divide: le
// secondarie di rete e quelle ACI stanno nello stesso archivio. Le terziarie non
// hanno un canale; l'extra raccolta e' il suo.
const NOME_MODULO = { primarie_rete: 'Primarie rete', primarie_aci: 'Primarie ACI', secondarie: 'Secondarie', terziarie: 'Terziarie', extra_raccolta: 'Extra raccolta' };
const CANALI_DATE = {
  primarie_rete: () => 'rete',
  primarie_aci: () => 'ACI',
  secondarie: (r) => (canaleDi(r) === 'ACI' ? 'ACI' : 'rete'),
  terziarie: () => '',
  extra_raccolta: () => 'extra',
};
const NOME_CANALE_DATE = { rete: 'rete', ACI: 'ACI', extra: 'extra raccolta' };

// Le parole con cui l'alert di ritardo SLA dice cosa misura. Un alert ignorato
// il cui testo non le contiene era stato scritto quando i giorni si contavano
// fino alla chiusura a portale: quella decisione riguardava un'altra misura.
const MISURA_SLA = "dall'immissione alla fine del trasporto";

// La chiave di un alert: lo stesso record (o raccoglitore, provincia...) e la stessa regola.
const chiaveAlert = (a) => `${a.record_id}|||${a.regola_id}`;

// Registra una condizione presente oggi nei dati, col testo calcolato adesso. Se
// la stessa chiave compare due volte vale la prima, come per l'alert che si crea.
const segna = (attuali, key, alert) => { if (!attuali.has(key)) attuali.set(key, alert); };

// Motore di controllo: scansiona i record di un modulo e genera Alert per le regole violate.
// Payload: { modulo }
//
// - Si controllano solo i dati dell'anno in corso e, per le primarie, i soli
//   formulari terminati: un ordine cancellato non ha pesi ne' destinazione.
// - Un alert gia' aperto per lo stesso record e la stessa regola non si ricrea,
//   ma se la condizione c'e' ancora con numeri diversi (una media, una
//   percentuale, un raccolto) se ne riscrive il testo: restava quello del giorno
//   in cui era nato, e a video c'erano numeri che nessun modulo mostrava piu'.
// - Gli alert aperti delle regole del modulo la cui condizione non c'e' piu' (o
//   doppioni dello stesso alert) vengono chiusi come risolti, con una nota: non si
//   cancella nulla. Le chiusure si fermano a un tempo massimo e riprendono al giro
//   successivo.
// - Se l'archivio del modulo si sta riscrivendo (un caricamento aperto o rimasto
//   a meta') non si tocca niente e si risponde 409: su un archivio a meta' ogni
//   condizione sembrerebbe sparita, e gli alert aperti si chiuderebbero tutti.
//   Lo stato dei caricamenti si legge prima dell'archivio e si rilegge dopo,
//   prima di scrivere: un caricamento partito o concluso nel frattempo rinvia
//   il controllo allo stesso modo.
// - I terminati senza fine trasporto non hanno un anno e restano fuori dal
//   controllo delle altre regole (regola 1): non si ripiega sull'immissione, ma
//   si contano, di qualunque anno, e la risposta li dice, per canale.
// - Le date obbligatorie (immissione, inizio e fine trasporto, 22/09/2026) si
//   controllano su tutti i terminati del modulo, di qualunque anno: un alert per
//   modulo e canale con l'elenco degli ordini (ID ordine, formulario, date che
//   mancano o non tornano). Critico se a qualcuno manca la fine trasporto, che
//   lo toglie da ogni periodo; si chiude da solo quando le date arrivano. Un
//   alert ignorato vale per quell'elenco: se l'elenco cambia, se ne apre uno.
// - I controlli della commessa (rotte e date) girano anche senza nessuna
//   RegolaAlert attiva nel modulo: non si configurano.

const TEMPO_MASSIMO_MS = 40000;
const MESI_ANNO = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

// L'anno di un movimento e' quello del giorno italiano della fine del trasporto
// (annoRoma). Prima una correzione a mano riportava al giorno giusto solo le
// mezzanotti italiane esatte: un trasporto finito alle 00:30 del 1 gennaio restava
// nell'anno prima.
function daControllare(record, modulo, anno) {
  if (modulo === 'assegnati') return true;
  // Per tutti i movimenti, primarie, secondarie e terziarie, contano solo i
  // terminati: un ordine annullato ha ancora destinazione e peso in archivio, e
  // finiva nel denominatore delle rotte.
  if (!eTerminato(record)) return false;
  return annoRoma(record.trasporto_finito_il) === anno;
}

export default async function(req) {
  const inizio = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();

    const body = await req.json();
    const { modulo } = body;

    const ENTITY_MAP = {
      secondarie: 'Secondaria',
      primarie_rete: 'PrimariaRete',
      primarie_aci: 'PrimariaAci',
      terziarie: 'Terziaria',
      assegnati: 'Assegnato',
      extra_raccolta: 'ExtraRaccolta',
    };

    if (!ENTITY_MAP[modulo]) {
      return Response.json({ error: 'modulo non valido' }, { status: 400 });
    }
    const entityName = ENTITY_MAP[modulo];

    // Carica regole attive per il modulo. Senza regole configurate si va avanti
    // lo stesso: rotte e date obbligatorie sono controlli della commessa. Solo
    // gli assegnati, che non sono movimenti, non ne hanno.
    const regole = (await base44.asServiceRole.entities.RegolaAlert.filter({ modulo, attiva: true })) || [];
    if (regole.length === 0 && !CANALI_DATE[modulo]) {
      return Response.json({ modulo, alerts_creati: 0, messaggio: 'Nessuna regola attiva per questo modulo' });
    }

    // Prima di leggere l'archivio: se un caricamento lo sta riscrivendo, o l'ha
    // lasciato a meta', il controllo si rinvia. Il flusso automatico riparte da
    // solo quando il caricamento si conclude.
    const prima = await statoCaricamenti(base44, CARICAMENTI_DEL_MODULO[modulo]);
    if (prima.in_corso.length) {
      const c = prima.in_corso[0];
      const chi = [c.nome_file && `file ${c.nome_file}`, c.utente && `di ${c.utente}`, c.data && `del ${c.data}`].filter(Boolean).join(', ');
      return Response.json({
        error: c.interrotto
          ? `Il caricamento ${c.tipo_file}${chi ? ` (${chi})` : ''} si è interrotto e l'archivio può essere a metà: ricaricare il file, poi ripetere il controllo degli alert.`
          : `È aperto il caricamento ${c.tipo_file}${chi ? ` (${chi})` : ''}: gli alert si ricontrollano da soli quando è concluso.`,
        rinviato: true,
        caricamenti_in_corso: prima.in_corso,
      }, { status: 409 });
    }

    // Record da validare: anno in corso, per le primarie solo i terminati.
    const anno = Number(oggiRoma().slice(0, 4));
    const tutti = await fetchAll(base44.asServiceRole.entities[entityName]);
    const records = tutti.filter(r => daControllare(r, modulo, anno));
    // Regola 1: un terminato senza fine trasporto non ha anno, e daControllare lo
    // scarta in silenzio: su di lui non si valutano pesi, tratte e rotte. Si
    // conta, di qualunque anno e anche senza immissione, e la risposta lo dice.
    // Le secondarie di rete e quelle ACI stanno nello stesso archivio: si contano
    // per canale, mai insieme.
    const senzaFine = new Map();
    if (modulo !== 'assegnati') {
      for (const r of tutti) {
        if (!eTerminato(r) || giornoMovimento(r)) continue;
        const canale = modulo === 'secondarie' ? (eAci(r) ? 'ACI' : 'rete') : '';
        if (!senzaFine.has(canale)) senzaFine.set(canale, { canale, quanti: 0, esempi: [] });
        const g = senzaFine.get(canale);
        g.quanti++;
        if (g.esempi.length < 5 && r.id_ordine) g.esempi.push(String(r.id_ordine));
      }
    }

    // Tutti gli alert aperti del modulo, pagina per pagina: senza, il controllo dei
    // doppioni vedeva solo i primi e a ogni caricamento li ricreava.
    const existingAlerts = await fetchAll(base44.asServiceRole.entities.Alert, { modulo, stato: 'aperto' }, 'created_date');
    const existingKeys = new Set(existingAlerts.map(chiaveAlert));
    // L'alert aperto di ciascuna chiave, il piu' vecchio (gli altri sono doppioni
    // e si chiudono sotto): e' quello di cui si aggiorna il testo.
    const apertiPerChiave = new Map();
    for (const a of existingAlerts) if (!apertiPerChiave.has(chiaveAlert(a))) apertiPerChiave.set(chiaveAlert(a), a);
    // Un alert che l'amministratore ha ignorato e' una decisione presa: la stessa
    // condizione sullo stesso record non si ripropone. Prima si guardavano solo
    // gli aperti, e al giro dopo l'alert ignorato rinasceva come nuovo.
    // Fa eccezione il ritardo SLA ignorato sulla misura fino alla chiusura a
    // portale: la decisione riguardava giorni che non si contano piu', e se il
    // trasportatore resta critico anche fino alla fine del trasporto l'alert si
    // ripropone con i numeri veri.
    const regoleSlaId = new Set(regole.filter(r => r.tipo_regola === 'ritardo_sla').map(r => r.id));
    const ignorati = await fetchAll(base44.asServiceRole.entities.Alert, { modulo, stato: 'ignorato' }, 'created_date');
    // Le date obbligatorie si segnalano sempre (22/09/2026): un alert ignorato
    // vale solo per l'elenco che diceva. Se gli ordini da sistemare cambiano, il
    // testo cambia e l'alert si riapre come nuovo.
    const dateIgnorate = new Map();
    for (const a of ignorati) {
      if (regoleSlaId.has(a.regola_id) && !String(a.descrizione || '').includes(MISURA_SLA)) continue;
      if (String(a.regola_id || '').startsWith(REGOLA_DATE)) {
        if (!dateIgnorate.has(chiaveAlert(a))) dateIgnorate.set(chiaveAlert(a), new Set());
        dateIgnorate.get(chiaveAlert(a)).add(String(a.descrizione || ''));
        continue;
      }
      existingKeys.add(chiaveAlert(a));
    }
    // Condizioni presenti oggi nei dati, col testo di oggi: gli alert aperti fuori
    // da questo insieme si chiudono, quelli dentro prendono il testo nuovo.
    const attuali = new Map();

    const newAlerts = [];

    for (const record of records) {
      for (const regola of regole) {
        const violazione = checkRegola(record, regola, entityName);
        if (violazione) {
          const key = `${record.id_ordine}|||${regola.id}`;
          // Le regole si valutano su un formulario alla volta, quindi i canali non
          // si sommano mai; ma su una secondaria va detto di quale canale e',
          // perche' rete e autodemolizione si guardano separatamente.
          const canale = entityName === 'Secondaria' ? canaleDi(record) : null;
          const alert = {
            titolo: canale === 'ACI' ? `${violazione.titolo} · ACI` : violazione.titolo,
            descrizione: violazione.descrizione,
            severita: regola.severita || 'warning',
            modulo,
            entity_type: entityName,
            record_id: record.id_ordine || '',
            regola_id: regola.id,
            regola_nome: regola.nome,
            stato: 'aperto',
          };
          segna(attuali, key, alert);
          if (existingKeys.has(key)) continue; // skip duplicati
          existingKeys.add(key);
          newAlerts.push(alert);
        }
      }
    }

    // --- Controlli aggregati ---
    // Le rotte si controllano su tutti i moduli: vale per le primarie come per
    // le secondarie, dove l'origine e' lo stoccaggio che produce il viaggio.
    // Gli altri controlli aggregati riguardano solo le primarie di rete.
    // Nell'extra raccolta lo stesso archivio tiene raccolte e trasferimenti, e le
    // rotte non si sono mai controllate qui: il controllo delle rotte
    // (controlloRotte) guarda le sole raccolte. Restano le date obbligatorie.
    if (modulo === 'primarie_rete') {
      // Target dell'anno in corso, sommati per raccoglitore, regione e mese.
      const targets = aggregaTargetMensili(await base44.asServiceRole.entities.TargetMensile.filter({ anno: Number(oggiRoma().slice(0, 4)) }, '-created_date', 5000));
      newAlerts.push(...checkAggregateRules(records, regole, existingKeys, targets, attuali));
    } else if (modulo === 'secondarie') {
      // Le secondarie di rete e quelle ACI stanno nello stesso archivio: contarle
      // insieme farebbe un denominatore che non esiste in nessun altro modulo, e
      // una rotta ACI vera finirebbe segnalata come errore perche' annegata fra
      // i viaggi di rete.
      newAlerts.push(...soloRotte(records.filter(r => !eAci(r)), existingKeys, attuali, entityName, modulo, 'rete'));
      newAlerts.push(...soloRotte(records.filter(eAci), existingKeys, attuali, entityName, modulo, 'ACI'));
    } else if (modulo !== 'extra_raccolta') {
      newAlerts.push(...soloRotte(records, existingKeys, attuali, entityName, modulo));
    }

    // Le date obbligatorie, su tutti i terminati del modulo di qualunque anno
    // (anche chi la fine trasporto non ce l'ha, e quindi un anno non ha), un
    // canale per volta: rete e ACI delle secondarie non si contano insieme.
    const dateObbligatorie = [];
    if (CANALI_DATE[modulo]) {
      const perCanale = new Map();
      for (const r of tutti) {
        const c = CANALI_DATE[modulo](r);
        if (!perCanale.has(c)) perCanale.set(c, []);
        perCanale.get(c).push(r);
      }
      for (const [canale, righe] of perCanale) {
        const riepilogo = riepilogoDate(righe, ORDINI_NEL_TESTO);
        if (!riepilogo) continue;
        dateObbligatorie.push({ canale, ordini: riepilogo.ordini, senza_fine: riepilogo.senza_fine });
        const alert = alertDate(modulo, entityName, canale, riepilogo);
        const key = chiaveAlert(alert);
        segna(attuali, key, alert);
        if (existingKeys.has(key)) continue;
        // ignorato con lo stesso elenco: la decisione presa vale ancora
        if (dateIgnorate.has(key) && dateIgnorate.get(key).has(alert.descrizione)) continue;
        existingKeys.add(key);
        newAlerts.push(alert);
      }
    }

    // Prima di scrivere si rilegge lo stato dei caricamenti: uno partito mentre si
    // leggeva l'archivio o si valutavano le regole non si vedeva, e su un archivio
    // a meta' gli alert aperti si chiudevano come "condizione non presente nei
    // dati". Lo stesso per uno concluso nel frattempo: l'archivio letto puo'
    // essere quello a meta'. Non si scrive niente; il flusso automatico riparte a
    // caricamento concluso.
    const durante = caricamentiDuranteLettura(prima, await statoCaricamenti(base44, CARICAMENTI_DEL_MODULO[modulo]));
    if (durante.length) {
      return Response.json({
        error: `Controllo degli alert rinviato, non è stato scritto niente. Caricamento ${durante.map(descriviCaricamento).join('; ')}.`,
        rinviato: true,
        caricamenti_in_corso: durante,
      }, { status: 409 });
    }

    // Bulk create alerts (chunk di 100)
    let creati = 0;
    const CHUNK = 100;
    for (let i = 0; i < newAlerts.length; i += CHUNK) {
      const chunk = newAlerts.slice(i, i + CHUNK);
      try {
        await base44.asServiceRole.entities.Alert.bulkCreate(chunk);
        creati += chunk.length;
      } catch (e) { /* skip */ }
    }

    // Gli alert aperti la cui condizione c'e' ancora prendono il testo calcolato
    // oggi: un "Nr Giorni medio 14,2" scritto sulla chiusura a portale, o il
    // raccolto di un mese fermo al caricamento di allora, restavano a video
    // mentre la pagina mostrava altri numeri. Si scrive solo dove cambia.
    const daAggiornare = [];
    for (const [key, a] of apertiPerChiave) {
      const nuovo = attuali.get(key);
      if (!nuovo) continue;
      // Gli alert delle date portano anche quanti ordini e quanti senza fine
      // trasporto: il cruscotto li legge da li', senza rileggere gli archivi.
      const conteggi = nuovo.quanti !== undefined ? { quanti: nuovo.quanti, senza_fine: nuovo.senza_fine, canale: nuovo.canale } : null;
      const conteggiCambiati = !!conteggi && (a.quanti !== conteggi.quanti || a.senza_fine !== conteggi.senza_fine || (a.canale || '') !== (conteggi.canale || ''));
      if ((a.titolo || '') !== (nuovo.titolo || '') || (a.descrizione || '') !== (nuovo.descrizione || '') || (a.severita || '') !== (nuovo.severita || '') || conteggiCambiati) {
        daAggiornare.push({ id: a.id, titolo: nuovo.titolo, descrizione: nuovo.descrizione, severita: nuovo.severita, ...(conteggi || {}) });
      }
    }
    let aggiornati = 0;
    for (let i = 0; i < daAggiornare.length && Date.now() - inizio < TEMPO_MASSIMO_MS; i += CHUNK) {
      const blocco = daAggiornare.slice(i, i + CHUNK);
      try {
        await base44.asServiceRole.entities.Alert.bulkUpdate(blocco);
        aggiornati += blocco.length;
      } catch (e) { /* ripreso al giro successivo */ }
    }

    // Chiusura degli alert superati e dei doppioni, solo per le regole di questo
    // motore: gli alert creati da altri controlli restano come sono.
    // La regola delle rotte non sta fra le RegolaAlert configurate, ma i suoi
    // alert devono chiudersi come gli altri quando il formulario viene corretto.
    // Cosi' anche quella delle date obbligatorie, un id per canale.
    const idDate = new Set([REGOLA_DATE, ...Object.keys(NOME_CANALE_DATE).map(c => `${REGOLA_DATE}_${c}`)]);
    const idRegole = new Set([...regole.map(r => r.id), REGOLA_ROTTA, REGOLA_ROTTA + '_rete', REGOLA_ROTTA + '_ACI', ...idDate]);
    const visti = new Set();
    const daChiudere = [];
    for (const a of existingAlerts) {
      if (!idRegole.has(a.regola_id)) continue;
      const key = chiaveAlert(a);
      if (!attuali.has(key)) {
        daChiudere.push({ id: a.id, stato: 'risolto', risolto_note: idDate.has(a.regola_id)
          ? `Chiuso automaticamente il ${oggiRoma()}: gli ordini terminati di questo modulo e canale hanno tutte le date obbligatorie, e nell'ordine giusto`
          : `Chiuso automaticamente il ${oggiRoma()}: condizione non presente nei dati ${anno}` });
      } else if (visti.has(key)) {
        daChiudere.push({ id: a.id, stato: 'risolto', risolto_note: `Chiuso automaticamente il ${oggiRoma()}: doppione di un alert ancora aperto` });
      } else {
        visti.add(key);
      }
    }
    let chiusi = 0;
    for (let i = 0; i < daChiudere.length && Date.now() - inizio < TEMPO_MASSIMO_MS; i += CHUNK) {
      const blocco = daChiudere.slice(i, i + CHUNK);
      try {
        await base44.asServiceRole.entities.Alert.bulkUpdate(blocco);
        chiusi += blocco.length;
      } catch (e) { /* ripreso al giro successivo */ }
    }

    return Response.json({
      modulo,
      anno,
      record_scansionati: records.length,
      regole_valutate: regole.length,
      alerts_creati: creati,
      alerts_aggiornati: aggiornati,
      alerts_da_aggiornare: daAggiornare.length - aggiornati,
      alerts_chiusi: chiusi,
      alerts_da_chiudere: daChiudere.length - chiusi,
      alerts_totali_aperti: existingAlerts.length + creati - chiusi,
      // terminati esclusi dal controllo perche' senza fine trasporto, per canale
      terminati_senza_fine_trasporto: [...senzaFine.values()],
      // terminati con date obbligatorie mancanti o incoerenti, di qualunque anno, per canale
      date_obbligatorie: dateObbligatorie,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * L'alert delle date obbligatorie di un modulo e di un canale: l'elenco degli
 * ordini (ID ordine, formulario, date che mancano o non tornano), i primi
 * ORDINI_NEL_TESTO per esteso e gli altri contati. Critico se a qualcuno manca
 * la fine trasporto: quello non sta in nessun periodo, e quindi in nessuna
 * fatturazione, target o giacenza, finche' la data non arriva.
 */
function alertDate(modulo, entityName, canale, riepilogo) {
  const dove = `${NOME_MODULO[modulo]}${canale && modulo === 'secondarie' ? ` · ${NOME_CANALE_DATE[canale]}` : ''}`;
  const n = riepilogo.ordini;
  const elenco = riepilogo.esempi.map(descriviVoceDate).join('; ') + (n > riepilogo.esempi.length ? `; e altri ${n - riepilogo.esempi.length}` : '');
  const correzione = modulo === 'extra_raccolta'
    ? 'Le date si inseriscono nella scheda di extra raccolta.'
    : 'Le date si correggono nel file del portale e si ricaricano.';
  return {
    titolo: `${dove}: ${n} ${n === 1 ? 'ordine terminato' : 'ordini terminati'} con date obbligatorie mancanti o incoerenti`,
    descrizione: `Immissione, inizio e fine trasporto sono obbligatorie nei formulari. ${n === 1 ? 'Un ordine' : `${n} ordini`}`
      + (riepilogo.senza_fine ? `, di cui ${riepilogo.senza_fine} senza fine trasporto (fuori da ogni periodo, e quindi da fatturazione, target e giacenze, finche' la data manca)` : '')
      + `: ${elenco}. ${correzione} L'alert si chiude da solo quando le date ci sono.`,
    severita: riepilogo.senza_fine ? 'critico' : 'warning',
    modulo,
    entity_type: entityName,
    record_id: modulo,
    regola_id: canale ? `${REGOLA_DATE}_${canale}` : REGOLA_DATE,
    regola_nome: NOME_REGOLA_DATE,
    stato: 'aperto',
    canale: canale || '',
    quanti: n,
    senza_fine: riepilogo.senza_fine,
  };
}

// --- Motore di validazione regole ---
function checkRegola(record, regola, entityName) {
  const config = regola.config || {};
  const tipo = regola.tipo_regola;

  if (tipo === 'tratta_autorizzata') {
    // config: { campo_origine, valore_origine, campo_destinazione, destinazioni_ammesse: [], case_sensitive? }
    const valOrigine = String(record[config.campo_origine || 'stoccaggio'] || '').trim();
    const valDest = String(record[config.campo_destinazione || 'destinazione'] || '').trim();
    const expectedOrigine = String(config.valore_origine || '').trim();

    const matchOrigine = normalizzaRagioneSociale(valOrigine) === normalizzaRagioneSociale(expectedOrigine);

    if (!matchOrigine) return null; // regola non applicabile a questo record

    const ammesse = (config.destinazioni_ammesse || []).map(d => normalizzaRagioneSociale(d));
    const destOk = ammesse.some(d => normalizzaRagioneSociale(valDest) === d);

    if (!destOk) {
      return {
        titolo: regola.messaggio_alert || `Destinazione non autorizzata per ${expectedOrigine}`,
        descrizione: `Record ${record.id_ordine || ''}: origine "${valOrigine}" con destinazione non ammessa "${valDest}". Destinazioni ammesse: ${(config.destinazioni_ammesse || []).join(', ')}.`,
      };
    }
  }

  if (tipo === 'tratta_combinazione') {
    // config: { campo_classe, valore_classe, campo_origine, origine_ammessa, campo_destinazione, destinazione_ammessa }
    const valClasse = String(record[config.campo_classe || 'classe'] || '').trim().toUpperCase();
    const expectedClasse = String(config.valore_classe || '').trim().toUpperCase();
    if (valClasse !== expectedClasse) return null;

    const valOrigine = normalizzaRagioneSociale(record[config.campo_origine || 'stoccaggio']);
    const valDest = normalizzaRagioneSociale(record[config.campo_destinazione || 'destinazione']);
    const origOk = normalizzaRagioneSociale(config.origine_ammessa);
    const destOk = normalizzaRagioneSociale(config.destinazione_ammessa);

    if (valOrigine !== origOk || valDest !== destOk) {
      return {
        titolo: regola.messaggio_alert || `Tratta non conforme per classe ${expectedClasse}`,
        descrizione: `Record ${record.id_ordine || ''}: classe ${valClasse} con origine "${valOrigine}" e destinazione "${valDest}". Combinazione ammessa: origine="${config.origine_ammessa}", destinazione="${config.destinazione_ammessa}".`,
      };
    }
  }

  if (tipo === 'tratte_autorizzate_classe') {
    // config: { classe, campo_origine, campo_destinazione, combinazioni_ammesse: [{origine, destinazione}] }
    // Per i record della classe specificata, la coppia (origine, destinazione) deve essere una delle combinazioni ammesse.
    const valClasse = String(record[config.campo_classe || 'classe'] || '').trim().toUpperCase();
    // Supporta classe singola (config.classe) o multipla (config.classi array); se nessuna specificata, applica a tutti
    const classiAmmesse = Array.isArray(config.classi) && config.classi.length > 0
      ? config.classi.map(c => String(c).trim().toUpperCase())
      : (config.classe ? [String(config.classe).trim().toUpperCase()] : []);
    if (classiAmmesse.length > 0 && !classiAmmesse.includes(valClasse)) return null;
    const expectedClasse = classiAmmesse.length > 0 ? classiAmmesse.join('/') : 'qualsiasi';

    const rawOrigine = String(record[config.campo_origine || 'stoccaggio'] || '').trim();
    const rawDest = String(record[config.campo_destinazione || 'destinazione'] || '').trim();
    const valOrigine = normalizzaRagioneSociale(rawOrigine);
    const valDest = normalizzaRagioneSociale(rawDest);

    const ammesse = (config.combinazioni_ammesse || []).map(c => ({
      origine: normalizzaRagioneSociale(c.origine),
      destinazione: normalizzaRagioneSociale(c.destinazione),
    }));

    const matchOk = ammesse.some(c => valOrigine === c.origine && valDest === c.destinazione);

    if (!matchOk) {
      const combinazioniTxt = (config.combinazioni_ammesse || []).map(c => `${c.origine} → ${c.destinazione}`).join('; ');
      const labelOrigine = config.campo_origine || 'stoccaggio';
      return {
        titolo: regola.messaggio_alert || `Tratta non autorizzata per classe ${expectedClasse}`,
        descrizione: `Record ${record.id_ordine || ''}: classe ${valClasse} con ${labelOrigine} "${rawOrigine}" e destinazione "${rawDest}". Combinazioni ammesse: ${combinazioniTxt}.`,
      };
    }
  }

  if (tipo === 'anomalia_peso') {
    // config: { soglia_zero: true }
    // Conta solo il peso effettivo: il peso stimato del portale non e' un riferimento
    // attendibile e non si usa in nessuna valutazione (soglia_deviazione ignorata).
    const pesoEff = record.peso_effettivo;
    const quantitaRit = record.quantita_ritirata;

    if (config.soglia_zero !== false && quantitaRit > 0 && (!pesoEff || pesoEff === 0)) {
      return {
        titolo: regola.messaggio_alert || `Peso effettivo mancante per ${record.id_ordine}`,
        descrizione: `Record ${record.id_ordine}: quantità ritirata ${quantitaRit} ma peso effettivo = 0 o mancante.`,
      };
    }
  }

  return null;
}

// I soli controlli di rotta, per i moduli che non hanno gli altri aggregati.
function soloRotte(records, existingKeys, attuali, archivio, modulo, canale = '') {
  return checkAggregateRules(records, [], existingKeys, [], attuali, archivio, modulo, canale);
}

// --- Controlli aggregati per primarie_rete ---
function checkAggregateRules(records, regole, existingKeys, targets = [], attuali = new Map(), archivio = 'PrimariaRete', modulo = 'primarie_rete', canale = '') {
  const alerts = [];
  // Ogni condizione trovata si segna col testo calcolato adesso, anche quando
  // l'alert c'e' gia' (per riscriverne il testo); si crea solo se la chiave non
  // e' ne' aperta ne' ignorata.
  const proponi = (key, alert) => {
    segna(attuali, key, alert);
    if (existingKeys.has(key)) return;
    existingKeys.add(key);
    alerts.push(alert);
  };

  // Formulari chiusi su una destinazione dove quell'origine non va mai.
  //
  // Non serve una regola scritta in configurazione: e' un controllo di coerenza
  // della commessa, non una soglia da tarare. Un raccoglitore conferisce dove ha
  // il proprio impianto o dove ha l'accordo di stoccare, e quando un formulario
  // si chiude sulla destinazione sbagliata il movimento finisce su un impianto
  // che non l'ha mai visto: da li' sbagliano giacenze, dichiarazioni e
  // fatturazione.
  for (const sospetto of conferimentiSospetti(records, archivio)) {
    const record_id = sospetto.numero_fir || sospetto.id_ordine || '';
    const key = `${record_id}|||${REGOLA_ROTTA}${canale ? '_' + canale : ''}`;
    proponi(key, {
      titolo: `Conferimento fuori rotta${canale ? ' (' + canale + ')' : ''}: ${sospetto.origine} a ${sospetto.destinazione}`,
      descrizione: `${sospetto.testo} Formulario ${sospetto.numero_fir || '(senza numero)'}`
        + (sospetto.id_ordine ? `, ordine ${sospetto.id_ordine}` : '')
        + `, del ${sospetto.giorno}, ${sospetto.kg} kg.`
        // le date obbligatorie che gli mancano, se ne mancano (22/09/2026)
        + (sospetto.date_da_sistemare ? ` Date obbligatorie: ${sospetto.date_da_sistemare}.` : ''),
      severita: 'warning',
      modulo,
      entity_type: archivio,
      record_id,
      regola_id: REGOLA_ROTTA + (canale ? '_' + canale : ''),
      regola_nome: 'Conferimento fuori rotta',
      stato: 'aperto',
    });
  }

  // Regole province inattive (2 mesi consecutivi a zero)
  const regoleProvince = regole.filter(r => r.tipo_regola === 'province_inattive');
  if (regoleProvince.length > 0) {
    const matrix = computeProvinceMatrixData(records);
    for (const prov of matrix.province_with_zeros) {
      for (const regola of regoleProvince) {
        const key = `${prov.provincia}|||${regola.id}`;
        const zeroPair = prov.last_zero_pair;
        proponi(key, {
          titolo: regola.messaggio_alert || `Provincia inattiva: ${prov.provincia}`,
          descrizione: `Provincia ${prov.provincia} (${prov.regione}): 2 mesi consecutivi con 0 raccolte (${zeroPair?.start} - ${zeroPair?.end}). Pianificare raccolte nel terzo mese per rispettare i requisiti consorziali.`,
          severita: regola.severita || 'warning',
          modulo: 'primarie_rete',
          entity_type: 'PrimariaRete',
          record_id: prov.provincia,
          regola_id: regola.id,
          regola_nome: regola.nome,
          stato: 'aperto',
        });
      }
    }
  }

  // Regole mix classi deviazione
  const regoleMix = regole.filter(r => r.tipo_regola === 'mix_classi_deviazione');
  if (regoleMix.length > 0) {
    const mix = computeRaccoglitoriMixData(records);
    for (const racc of mix.raccoglitori_con_deviazione) {
      for (const regola of regoleMix) {
        const key = `${racc.raccoglitore}|||${regola.id}`;
        const devDetails = racc.deviazioni_significative.map(d =>
          `${d.classe}: ${d.attuale.toFixed(1)}% vs target ${d.target}% (Δ${d.deviazione > 0 ? '+' : ''}${d.deviazione.toFixed(1)}%)`
        ).join('; ');
        proponi(key, {
          titolo: regola.messaggio_alert || `Mix classi non conforme: ${racc.raccoglitore}`,
          descrizione: `Raccoglitore "${racc.raccoglitore}": deviazione significativa dal mix classi consorziale. ${devDetails}. Totale raccolto: ${formatoTonnellate(racc.totale_peso)} t.`,
          severita: regola.severita || 'warning',
          modulo: 'primarie_rete',
          entity_type: 'PrimariaRete',
          record_id: racc.raccoglitore,
          regola_id: regola.id,
          regola_nome: regola.nome,
          stato: 'aperto',
        });
      }
    }
  }

  // Regole scostamento target grave (Delta < soglia_pct, default -15%)
  const regoleScostamento = regole.filter(r => r.tipo_regola === 'scostamento_target');
  if (regoleScostamento.length > 0 && targets && targets.length > 0) {
    // Solo RETE terminati dell'anno dei target, nel mese della fine trasporto letto
    // sul giorno italiano (periodoMovimento): col mese UTC un ritiro del primo del
    // mese salvato a mezzanotte italiana finiva nel mese prima, e il delta di quel
    // mese poteva scendere sotto soglia senza motivo.
    const annoTarget = Number(targets[0]?.anno) || Number(oggiRoma().slice(0, 4));
    // anche "oggi" e' il giorno italiano, per decidere quali mesi sono conclusi
    const oggi = oggiRoma();
    const annoOggi = Number(oggi.slice(0, 4));
    const meseOggi = Number(oggi.slice(5, 7)) - 1;
    const raccoltoByKey = {};
    for (const r of records) {
      if (!eTerminato(r)) continue;
      const periodo = periodoMovimento(r);
      if (!periodo || periodo.anno !== annoTarget) continue;
      const racc = (r.trasportatore || 'N/D').trim();
      const regione = r.regione || 'Altro';
      const mese = MESI_ANNO[periodo.mese_idx];
      const peso = (r.peso_effettivo || 0) / 1000;
      const key = `${racc}|||${regione}|||${mese}`;
      raccoltoByKey[key] = (raccoltoByKey[key] || 0) + peso;
    }
    for (const target of targets) {
      const racc = (target.raccoglitore || '').trim();
      const regione = (target.regione || '').trim();
      const mese = (target.mese || '').trim();
      const targetVal = target.target || 0;
      if (targetVal <= 0) continue;
      // Solo mesi conclusi: il mese in corso lo segue il controllo dei target con la proiezione.
      const indiceMese = MESI_ANNO.indexOf(mese);
      if (indiceMese < 0 || (annoTarget === annoOggi && indiceMese >= meseOggi) || annoTarget > annoOggi) continue;
      const nomiRegione = targets.filter(x => (x.regione || '').trim() === regione && (x.mese || '').trim() === mese).map(x => (x.raccoglitore || '').trim());
      const raccolto = Object.entries(raccoltoByKey)
        .filter(([k]) => { const [r, reg, m] = k.split('|||'); return reg === regione && m === mese && targetDelPortale(nomiRegione, r) === racc; })
        .reduce((s, [, v]) => s + v, 0);
      const delta = raccolto - targetVal;
      const pctDelta = (delta / targetVal) * 100;
      const soglia = regoleScostamento[0]?.config?.soglia_pct || -15;
      if (pctDelta < soglia) {
        for (const regola of regoleScostamento) {
          // Stessa chiave degli alert salvati (record_id|||regola): prima non coincideva
          // e l'alert si ricreava a ogni giro.
          const alertKey = `${racc}|${regione}|${mese}|||${regola.id}`;
          proponi(alertKey, {
            titolo: regola.messaggio_alert || `Scostamento target grave: ${racc} - ${regione} - ${mese}`,
            descrizione: `Raccoglitore "${racc}" (${regione}, ${mese}): target ${formatoTonnellate(targetVal)} t, raccolto ${formatoTonnellate(raccolto)} t, Δ ${formatoTonnellate(delta)} ton (${pctDelta.toFixed(1)}%). Soglia: ${soglia}%.`,
            severita: regola.severita || 'critico',
            modulo: 'primarie_rete',
            entity_type: 'PrimariaRete',
            record_id: `${racc}|${regione}|${mese}`,
            regola_id: regola.id,
            regola_nome: regola.nome,
            stato: 'aperto',
          });
        }
      }
    }
  }

  // Regole ritardo SLA critico (Nr Giorni medio > 12 o % fuori tempo > 20%).
  // I giorni vanno dall'immissione alla fine del trasporto (computeSlaMetrics li
  // ricalcola, non legge i campi salvati). Un alert aperto sulla vecchia misura,
  // quella fino alla chiusura a portale, si chiude da solo se il trasportatore
  // non e' piu' critico, e se lo e' ancora prende il testo con i giorni nuovi.
  const regoleSla = regole.filter(r => r.tipo_regola === 'ritardo_sla');
  if (regoleSla.length > 0) {
    const sla = computeSlaMetrics(records);
    for (const t of sla.trasportatori) {
      if (t.has_sla_critical) {
        for (const regola of regoleSla) {
          const key = `${t.trasportatore}|||${regola.id}`;
          proponi(key, {
            titolo: regola.messaggio_alert || `Ritardo SLA critico: ${t.trasportatore}`,
            descrizione: `Trasportatore "${t.trasportatore}": Nr Giorni medio ${t.nr_giorni_medio.toFixed(1)} gg ${MISURA_SLA}, % fuori tempo ${t.pct_dopo_scadenza.toFixed(1)}%. Soglie: > 12 gg medio o > 20% fuori tempo.`,
            severita: regola.severita || 'warning',
            modulo: 'primarie_rete',
            entity_type: 'PrimariaRete',
            record_id: t.trasportatore,
            regola_id: regola.id,
            regola_nome: regola.nome,
            stato: 'aperto',
          });
        }
      }
    }
  }

  return alerts;
}