import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { conBattito } from "../../shared/battito.ts";
import { oggiRoma, annoRoma } from "../../shared/giornoItaliano.ts";
import { eTerminato, periodoMovimento, giornoMovimento, primoAnnoControllato } from "../../shared/movimenti.ts";
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
import { formatoTonnellate, formatoKg } from "../../shared/formato.ts";
import { daConfermare } from "../../shared/annoTarget.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { statoCaricamenti, caricamentiDuranteLettura, descriviCaricamento, riepilogoVociDate, descriviVoceDate, dataItaliana } from "../../shared/reportSettimanali.ts";
import { giornoDellaConfigurazione } from "../../shared/configurazioneRegolaAlert.ts";

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

// LO SCOSTAMENTO DAL TARGET HA L'ANNO NELLA CHIAVE (prova generale del cambio
// d'anno, 15/10/2026). La chiave era raccoglitore|regione|mese, senza l'anno: il
// 10/02/2027 lo scostamento di gennaio 2026, ignorato il 25/09/2026, bloccava
// quello di gennaio 2027 (creati 0), e quello rimasto aperto si riscriveva coi
// numeri del 2027 («target 100,00 t, raccolto 30,00 t, Δ -70,00 ton»), e i
// numeri del 2026 sparivano. Ora record_id e chiave portano l'anno del target
// e il testo lo dice («Gennaio 2027»): un alert per anno, e un ignorato vale
// solo per il suo. Un alert scritto prima, senza l'anno, e' dell'anno italiano
// di created_date, non di updated_date: un ignorato ha updated_date nel giorno
// in cui lo si e' ignorato (come le province, decisioni dell'utente del
// 13/10/2026). Nello stesso anno l'aperto di prima si riscrive col testo e il
// record_id nuovi, senza doppioni.
//
// L'ANNO STA DOPO UNO SPAZIO, NON DOPO UNA BARRA (revisione del 15/10/2026): il
// record_id e' raccoglitore|regione|mese anno («ALFA SRL|Puglia|Gennaio 2027»),
// come lo dice il testo. Col primo rimedio era raccoglitore|regione|mese|anno,
// identico a quello degli avvisi dei target del mese di checkTargetAlerts, che
// cerca il «gia' aperto» fra tutti gli aperti di primarie_rete: il 10/02/2027
// lo scostamento aperto di ALFA su gennaio 2027 bloccava la nascita di «Target
// non raggiunto: ALFA SRL — Puglia (Gennaio 2027)» (creati 0), e un «Target a
// rischio» di gennaio non diventava «non raggiunto» (aggiornati 0): mancavano
// la voce del mese nel cruscotto e il collegamento all'Andamento. Con lo
// spazio i due record_id non coincidono mai.
const scostamentoConAnno = (recordId) => /\|\S+ \d{4}$/.test(String(recordId || ''));
/** L'anno del target di un alert di scostamento: quello nel record_id, o per i testi di prima l'anno italiano di created_date. */
function annoDelloScostamento(a) {
  const id = String(a.record_id || '');
  if (scostamentoConAnno(id)) return Number(id.slice(-4));
  return annoRoma(a.created_date || a.updated_date) || null;
}
/** La chiave di un alert di scostamento, con l'anno anche per quelli scritti senza. */
const chiaveDelloScostamento = (a) => (scostamentoConAnno(a.record_id) ? chiaveAlert(a) : `${a.record_id} ${annoDelloScostamento(a) || ''}|||${a.regola_id}`);

// Registra una condizione presente oggi nei dati, col testo calcolato adesso. Se
// la stessa chiave compare due volte vale la prima, come per l'alert che si crea.
const segna = (attuali, key, alert) => { if (!attuali.has(key)) attuali.set(key, alert); };

// Motore di controllo: scansiona i record di un modulo e genera Alert per le regole violate.
// Payload: { modulo }
//
// - Si controllano i dati dell'anno in corso e di quello prima (il perimetro,
//   vedi PERIMETRO sotto) e, per le primarie, i soli formulari terminati: un
//   ordine cancellato non ha pesi ne' destinazione. Gli alert nuovi sull'anno
//   prima nascono solo a gennaio e febbraio, e un alert si chiude da solo solo
//   se il suo record sta negli anni controllati.
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
//   si contano, dall'anno scorso in poi (dateDaControllare), e la risposta li dice, per canale.
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

// IL PERIMETRO: QUALI ANNI SI CONTROLLANO (A54 dell'audit del 20/09, corretta il
// 12/10/2026). Prima si guardava solo l'anno di oggi, e ogni alert aperto la cui
// condizione non si ritrovava si chiudeva come risolto: il 02/01/2027 un ritiro
// del 20/12/2026 col peso zero, mai corretto, diventava «risolto: condizione non
// presente nei dati 2027». Lo stesso per tratte, rotte, scostamenti e SLA. Ora:
// - si controllano l'anno in corso e quello prima, come le date obbligatorie
//   (primoAnnoControllato, movimenti.ts): il portale si ancora al 31/12
//   dell'anno prima, e un formulario di dicembre si registra e si corregge a
//   gennaio (dieci giorni dalla partenza, domeniche escluse). Non costa nessuna
//   lettura in piu': l'archivio del modulo si legge gia' tutto.
// - gli alert NUOVI sull'anno prima nascono solo nei primi MESI_NUOVI_ANNO_PRIMA
//   mesi, quando arrivano e si correggono i formulari di dicembre; dopo, l'anno
//   prima serve solo a riscrivere e a chiudere gli alert che ci sono. Aprirne
//   tutto l'anno vorrebbe dire misurare un anno finito con le regole (tratte,
//   destinazioni) dell'anno nuovo, e il giorno della pubblicazione aprire alert
//   sul 2025 che nessuno ha mai chiesto.
// - un alert si chiude da solo SOLO se il suo record sta negli anni controllati
//   (perimetroDellAlert): quello di un anno che non si controlla piu' resta
//   aperto, com'e', finche' qualcuno non lo risolve o lo ignora. Cosi' la fine
//   di febbraio, o il cambio d'anno, non fanno sparire niente.
// - i controlli che si misurano su un anno intero e la cui chiave non porta
//   l'anno (mix classi, ritardo SLA: raccoglitore, trasportatore) restano
//   sull'anno in corso, e un loro alert scritto l'ultima volta in un anno prima
//   resta aperto. Lo scostamento dal target si misura anche lui sull'anno in
//   corso, ma dal 15/10/2026 la sua chiave porta l'anno del target
//   (raccoglitore|regione|mese anno, vedi chiaveDelloScostamento): un suo alert
//   di un anno prima resta aperto, e quello dell'anno nuovo nasce accanto.
// - la chiusura dell'anno delle Giacenze non fa da confine: scrive le
//   rilevazioni del 31/12 sito per sito, dice che la giacenza e' fotografata e
//   non che i formulari sono giusti, e leggerla costerebbe una richiesta a ogni
//   giro del motore.
// - (revisione del 13/10/2026) le regole di tratta configurate (REGOLE_DI_TRATTA)
//   non hanno un anno: valgono dal giorno in cui sono scritte. Sull'anno prima
//   si applica solo quella scritta prima del 01/01 di quest'anno, giorno
//   italiano (creata e cambiata l'ultima volta prima: scrittaPrimaDellAnno), che
//   era la regola di quell'anno: apre alert nuovi a gennaio e febbraio, come
//   peso e rotte, e il viaggio del 30/12 registrato il 04/01 ha il suo alert.
//   Una regola creata o cambiata quest'anno sull'anno prima non si applica: non
//   apre, non riscrive e non chiude. «Cambiata» vuol dire la configurazione
//   (decisioni dell'utente del 13/10/2026): attivarla e disattivarla no, vedi
//   scrittaPrimaDellAnno. Tolta a gennaio una destinazione ammessa l'anno
//   prima, nasceva un alert falso per ogni viaggio di allora, e aggiunta a
//   gennaio chiudeva come risolto l'alert di un viaggio che allora era un
//   errore; ora quell'alert resta com'e', e si conta fra quelli fuori perimetro.
//   Il primo rimedio (nessun alert nuovo di tratta sull'anno prima) lasciava
//   senza alert proprio i formulari di dicembre registrati a gennaio.
// - (revisione del 13/10/2026) le province inattive: la matrice guarda i mesi
//   finiti dell'anno e, a gennaio e febbraio, novembre e dicembre dell'anno
//   prima. Un alert la cui coppia di mesi sta fuori da quei mesi non e' stato
//   rivalutato e resta aperto (perimetroProvince): il 02/01/2027 l'alert di
//   settembre-ottobre 2026 si chiudeva «risolto ... nei dati 2027» senza che
//   nessuno avesse guardato settembre e ottobre. Resta anche com'e': la chiave
//   e' provincia|||regola, senza i mesi, e riscritto con la coppia trovata oggi
//   («Novembre 2026 - Dicembre 2026») si chiudeva «risolto» appena quella si
//   risolveva, con settembre e ottobre ancora a zero. Finche' e' aperto la
//   coppia nuova non apre un alert suo; chiuso a mano, nasce al giro dopo.
//   Ignorato, vale solo per la sua coppia di mesi (decisioni dell'utente del
//   13/10/2026, vedi provinceIgnorate): una coppia nuova a zero apre un alert
//   nuovo, e l'ignorato resta ignorato.
const MESI_NUOVI_ANNO_PRIMA = 2;
const REGOLE_DELL_ANNO = new Set(['mix_classi_deviazione', 'ritardo_sla', 'scostamento_target']);
const REGOLE_DI_TRATTA = new Set(['tratta_autorizzata', 'tratta_combinazione', 'tratte_autorizzate_classe']);

// Se una regola e' stata scritta tutta prima del 01/01 dell'anno dato (giorno
// italiano), quindi era la regola dell'anno prima (revisione del 13/10/2026, vedi
// PERIMETRO). Conta il giorno della configurazione (configurata_il, decisioni
// dell'utente del 13/10/2026): la pagina lo scrive quando crea la regola, e
// attivarla o disattivarla non lo cambia. Prima contavano created_date e
// updated_date, e una regola del 2026 disattivata e riattivata il 02/01/2027
// diventava del 2027: il viaggio del 30/12/2026 registrato il 04/01 restava
// senza il suo alert. Una regola senza quel giorno, o con una configurazione che
// non e' piu' quella dell'impronta (cambiata fuori dalla pagina), ripiega sulle
// date di sistema: creata e cambiata l'ultima volta prima. Senza nessuna data non
// lo si sa, e vale come scritta quest'anno.
function scrittaPrimaDellAnno(regola, anno) {
  const configurata = giornoDellaConfigurazione(regola);
  if (configurata) return Number(configurata.slice(0, 4)) < anno;
  const creata = annoRoma(regola.created_date);
  const cambiata = annoRoma(regola.updated_date || regola.created_date);
  return !!creata && !!cambiata && creata < anno && cambiata < anno;
}

// I numeri e le date nel testo degli alert, all'italiana (12/10/2026): toFixed
// scriveva «Nr Giorni medio 14.2» e «12.5%», e le rotte «del 2026-12-15, 5000
// kg». Ora 14,2, 12,5%, «del 15/12/2026, 5.000 kg». Il testo nuovo riscrive una
// volta gli alert aperti (si aggiorna dove cambia), e la chiave non cambia.
const unDecimale = (n) => (Number(n) || 0).toFixed(1).replace('.', ',');

// L'anno di un movimento e' quello del giorno italiano della fine del trasporto
// (annoRoma). Prima una correzione a mano riportava al giorno giusto solo le
// mezzanotti italiane esatte: un trasporto finito alle 00:30 del 1 gennaio restava
// nell'anno prima.
function daControllare(record, modulo, anni) {
  if (modulo === 'assegnati') return true;
  // Per tutti i movimenti, primarie, secondarie e terziarie, contano solo i
  // terminati: un ordine annullato ha ancora destinazione e peso in archivio, e
  // finiva nel denominatore delle rotte.
  if (!eTerminato(record)) return false;
  return anni.has(annoRoma(record.trasporto_finito_il));
}

async function motoreAlert(req) {
  const inizio = Date.now();
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
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

    // Record da validare: anno in corso e anno prima (il PERIMETRO, sopra), per
    // le primarie solo i terminati. Gli alert nuovi: l'anno in corso, e l'anno
    // prima solo a gennaio e febbraio.
    const oggi = oggiRoma();
    const anno = Number(oggi.slice(0, 4));
    const anniControllati = new Set();
    for (let a = primoAnnoControllato(oggi); a <= anno; a++) anniControllati.add(a);
    const anniNuovi = new Set([...anniControllati].filter(a => a === anno || Number(oggi.slice(5, 7)) <= MESI_NUOVI_ANNO_PRIMA));
    const tutti = await fetchAll(base44.asServiceRole.entities[entityName]);
    const records = tutti.filter(r => daControllare(r, modulo, anniControllati));
    // I record di un anno solo: le rotte si leggono anno per anno (la quota di
    // una destinazione e' sui viaggi dell'anno), e i controlli dell'anno intero
    // (mix, SLA, scostamento, province) girano sull'anno in corso. Gli assegnati
    // non hanno un anno: valgono tutti, come prima.
    const dellAnno = (a) => (modulo === 'assegnati' ? (a === anno ? records : []) : records.filter(r => annoRoma(r.trasporto_finito_il) === a));
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
    // La chiave di un alert gia' scritto: per lo scostamento dal target con
    // l'anno, anche per quelli di prima che non l'hanno (15/10/2026, vedi
    // chiaveDelloScostamento).
    const regoleScostamentoId = new Set(regole.filter(r => r.tipo_regola === 'scostamento_target').map(r => r.id));
    const chiaveDi = (a) => (regoleScostamentoId.has(a.regola_id) ? chiaveDelloScostamento(a) : chiaveAlert(a));
    const existingKeys = new Set(existingAlerts.map(chiaveDi));
    // L'alert aperto di ciascuna chiave, il piu' vecchio (gli altri sono doppioni
    // e si chiudono sotto): e' quello di cui si aggiorna il testo.
    const apertiPerChiave = new Map();
    for (const a of existingAlerts) if (!apertiPerChiave.has(chiaveDi(a))) apertiPerChiave.set(chiaveDi(a), a);
    // Un alert che l'amministratore ha ignorato e' una decisione presa: la stessa
    // condizione sullo stesso record non si ripropone. Prima si guardavano solo
    // gli aperti, e al giro dopo l'alert ignorato rinasceva come nuovo.
    // Fa eccezione il ritardo SLA ignorato sulla misura fino alla chiusura a
    // portale: la decisione riguardava giorni che non si contano piu', e se il
    // trasportatore resta critico anche fino alla fine del trasporto l'alert si
    // ripropone con i numeri veri.
    const regoleSlaId = new Set(regole.filter(r => r.tipo_regola === 'ritardo_sla').map(r => r.id));
    const regoleProvinceId = new Set(regole.filter(r => r.tipo_regola === 'province_inattive').map(r => r.id));
    const ignorati = await fetchAll(base44.asServiceRole.entities.Alert, { modulo, stato: 'ignorato' }, 'created_date');
    // Le date obbligatorie si segnalano sempre (22/09/2026): un alert ignorato
    // vale solo per l'elenco che diceva. Se gli ordini da sistemare cambiano, il
    // testo cambia e l'alert si riapre come nuovo.
    const dateIgnorate = new Map();
    // Le province inattive (decisioni dell'utente del 13/10/2026): un alert
    // ignorato vale solo per la sua coppia di mesi. La chiave e'
    // provincia|||regola, senza i mesi, e l'ignorato la bloccava per sempre: una
    // provincia ignorata per settembre-ottobre poteva restare a zero anche a
    // novembre, dicembre e oltre senza che nessun alert lo dicesse. Ora si tiene,
    // per chiave, l'ultimo mese delle coppie ignorate (coppiaProvincia): la
    // stessa coppia non riapre niente, una coppia nuova a zero apre un alert
    // nuovo, e l'ignorato resta ignorato. Si confronta l'ultimo mese e non il
    // testo: i testi di prima non avevano l'anno, e quello di una provincia mai
    // servita («nessun ritiro nell'anno (Gennaio 2026 - Settembre 2026)») dice la
    // stessa coppia agosto-settembre. Un mese scritto senza l'anno e' dell'anno in
    // cui l'alert e' nato: updated_date di un ignorato e' il giorno in cui lo si e'
    // ignorato. Un testo senza la coppia blocca la chiave, come prima.
    const provinceIgnorate = new Map();
    for (const a of ignorati) {
      if (regoleSlaId.has(a.regola_id) && !String(a.descrizione || '').includes(MISURA_SLA)) continue;
      if (String(a.regola_id || '').startsWith(REGOLA_DATE)) {
        if (!dateIgnorate.has(chiaveAlert(a))) dateIgnorate.set(chiaveAlert(a), new Set());
        dateIgnorate.get(chiaveAlert(a)).add(String(a.descrizione || ''));
        continue;
      }
      const coppia = regoleProvinceId.has(a.regola_id) ? coppiaProvincia(a.descrizione, annoRoma(a.created_date || a.updated_date) || anno) : null;
      if (coppia) {
        if (!provinceIgnorate.has(chiaveAlert(a))) provinceIgnorate.set(chiaveAlert(a), new Set());
        provinceIgnorate.get(chiaveAlert(a)).add(coppia.fine);
        continue;
      }
      // lo scostamento ignorato vale per il suo anno (chiaveDelloScostamento)
      existingKeys.add(chiaveDi(a));
    }
    // L'alert nuovo di una provincia sulla coppia di mesi (lo stesso ultimo mese)
    // di un suo alert ignorato: la decisione vale ancora, e non nasce. Il testo
    // nuovo porta sempre l'anno dei mesi.
    const provinciaIgnorata = (alert) => {
      const ignorate = provinceIgnorate.get(chiaveAlert(alert));
      const coppia = ignorate ? coppiaProvincia(alert.descrizione, anno) : null;
      return !!coppia && ignorate.has(coppia.fine);
    };
    // Condizioni presenti oggi nei dati, col testo di oggi: gli alert aperti fuori
    // da questo insieme si chiudono, quelli dentro prendono il testo nuovo.
    const attuali = new Map();

    const newAlerts = [];

    // Le regole di tratta scritte quest'anno: sull'anno prima non si applicano
    // (revisione del 13/10/2026, vedi PERIMETRO).
    const tratteDiQuestAnno = new Set(regole.filter(r => REGOLE_DI_TRATTA.has(r.tipo_regola) && !scrittaPrimaDellAnno(r, anno)).map(r => r.id));

    for (const record of records) {
      // Sull'anno prima, fuori da gennaio e febbraio, la condizione si segna (tiene
      // aperto l'alert che c'e' e ne riscrive il testo) ma un alert nuovo non nasce.
      // Gli assegnati non hanno un anno: valgono come l'anno in corso.
      const annoRecord = modulo === 'assegnati' ? anno : annoRoma(record.trasporto_finito_il);
      const puoNascere = anniNuovi.has(annoRecord);
      for (const regola of regole) {
        // Una regola di tratta scritta quest'anno non misura l'anno prima: non
        // apre, non riscrive e non chiude. L'alert che c'e' resta com'e' e si
        // conta fra quelli fuori perimetro (perimetroDellAlert).
        if (annoRecord !== anno && tratteDiQuestAnno.has(regola.id)) continue;
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
          if (existingKeys.has(key) || !puoNascere) continue; // skip duplicati
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
      // Target dell'anno in corso, sommati per raccoglitore, regione e mese. Un
      // target copiato dall'anno prima e non ancora confermato non e' un target
      // deciso, e lo scostamento grave non si misura su quello (chiusura
      // dell'audit, 11/10/2026, come checkTargetAlerts): basta una riga copiata
      // fra quelle sommate perche' il mese di quel raccoglitore resti fuori.
      const righeTarget = await fetchAll(base44.asServiceRole.entities.TargetMensile, { anno: Number(oggiRoma().slice(0, 4)) });
      const chiaveTarget = (t) => `${normalizzaRagioneSociale(t.raccoglitore || '')}|${String(t.regione || '').trim()}|${t.mese}`;
      const copiati = new Set(righeTarget.filter(daConfermare).map(chiaveTarget));
      const targets = aggregaTargetMensili(righeTarget).filter(t => !copiati.has(chiaveTarget(t)));
      // I contratti Ecotyre, per le province del contratto mai servite (A58,
      // revisione del 13/10/2026): senza, una provincia del contratto senza un
      // ritiro non stava nella matrice e non era mai «inattiva». Una lettura per
      // giro, e solo se c'e' una regola delle province; un errore ferma il giro
      // invece di chiudere come risolti gli alert di quelle province.
      const commesse = regole.some(r => r.tipo_regola === 'province_inattive')
        ? await fetchAll(base44.asServiceRole.entities.CommessaEcotyre)
        : null;
      // Tutti i controlli aggregati sull'anno in corso; dell'anno prima solo le
      // rotte, che hanno per chiave il formulario e quindi un anno solo.
      const recordsAnno = dellAnno(anno);
      newAlerts.push(...checkAggregateRules(recordsAnno, regole, existingKeys, targets, attuali, 'PrimariaRete', 'primarie_rete', '', tutti, true, commesse));
      for (const a of anniControllati) {
        if (a !== anno) newAlerts.push(...soloRotte(dellAnno(a), existingKeys, attuali, entityName, modulo, '', anniNuovi.has(a)));
      }
    } else if (modulo === 'secondarie') {
      // Le secondarie di rete e quelle ACI stanno nello stesso archivio: contarle
      // insieme farebbe un denominatore che non esiste in nessun altro modulo, e
      // una rotta ACI vera finirebbe segnalata come errore perche' annegata fra
      // i viaggi di rete. Un anno per volta, per la stessa ragione.
      for (const a of anniControllati) {
        newAlerts.push(...soloRotte(dellAnno(a).filter(r => !eAci(r)), existingKeys, attuali, entityName, modulo, 'rete', anniNuovi.has(a)));
        newAlerts.push(...soloRotte(dellAnno(a).filter(eAci), existingKeys, attuali, entityName, modulo, 'ACI', anniNuovi.has(a)));
      }
    } else if (modulo !== 'extra_raccolta') {
      for (const a of anniControllati) newAlerts.push(...soloRotte(dellAnno(a), existingKeys, attuali, entityName, modulo, '', modulo === 'assegnati' || anniNuovi.has(a)));
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
        const riepilogo = riepilogoVociDate(righe, ORDINI_NEL_TESTO);
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

    // Bulk create alerts (chunk di 100), tranne le province ignorate sulla
    // stessa coppia di mesi (provinciaIgnorata, decisioni del 13/10/2026)
    const daCreare = newAlerts.filter(a => !provinciaIgnorata(a));
    let creati = 0;
    const CHUNK = 100;
    for (let i = 0; i < daCreare.length; i += CHUNK) {
      const chunk = daCreare.slice(i, i + CHUNK);
      try {
        await base44.asServiceRole.entities.Alert.bulkCreate(chunk);
        creati += chunk.length;
      } catch (e) { /* skip */ }
    }

    // Gli alert aperti la cui condizione c'e' ancora prendono il testo calcolato
    // oggi: un "Nr Giorni medio 14,2" scritto sulla chiusura a portale, o il
    // raccolto di un mese fermo al caricamento di allora, restavano a video
    // mentre la pagina mostrava altri numeri. Si scrive solo dove cambia.
    // Un alert delle province la cui coppia di mesi sta fuori da quelli che la
    // matrice guarda oggi non si riscrive con la coppia trovata adesso (revisione
    // del 13/10/2026): la chiave non ha i mesi, e l'alert di ottobre-novembre
    // 2026 diventava a gennaio quello di novembre-dicembre, e si chiudeva
    // «risolto» all'arrivo del ritiro di dicembre, con ottobre ancora a zero.
    // Resta com'e', e si conta fra quelli fuori perimetro (sotto).
    // La condizione di oggi di una provincia sulla coppia di mesi ignorata non
    // tiene aperto l'alert della stessa chiave, e non lo riscrive (revisione del
    // 14/10/2026 sulle decisioni del 13/10): l'ignorato vale per quella coppia, e
    // la decisione e' gia' presa. AV ignorata per agosto-settembre: il 02/11
    // ottobre era ancora a zero e nasceva, giusto, l'alert di settembre-ottobre;
    // il 09/11, registrato il ritiro del 28/10, la coppia a zero tornava
    // agosto-settembre, e l'alert aperto si riscriveva proprio con la coppia
    // ignorata e restava aperto per sempre, su mesi passati. Ora si chiude: la
    // sua condizione non c'e' piu'. Un aperto sulla stessa coppia ignorata (un
    // doppione di prima) si chiude dicendolo (ignorateOggi, sotto).
    const ignorateOggi = new Map();
    for (const [key, alert] of [...attuali]) {
      if (!provinciaIgnorata(alert)) continue;
      ignorateOggi.set(key, coppiaProvincia(alert.descrizione, anno).fine);
      attuali.delete(key);
    }
    const tipoDi = new Map(regole.map(r => [r.id, r.tipo_regola]));
    const mesiProvince = mesiDellaMatrice(oggi);
    const provinceFerme = new Set();
    const daAggiornare = [];
    for (const [key, a] of apertiPerChiave) {
      const nuovo = attuali.get(key);
      if (!nuovo) continue;
      if (tipoDi.get(a.regola_id) === 'province_inattive' && !perimetroProvince(a, anno, mesiProvince).controllato) {
        provinceFerme.add(a.id);
        continue;
      }
      // Gli alert delle date portano anche quanti ordini e quanti senza fine
      // trasporto: il cruscotto li legge da li', senza rileggere gli archivi.
      const conteggi = nuovo.quanti !== undefined ? { quanti: nuovo.quanti, senza_fine: nuovo.senza_fine, canale: nuovo.canale } : null;
      const conteggiCambiati = !!conteggi && (a.quanti !== conteggi.quanti || a.senza_fine !== conteggi.senza_fine || (a.canale || '') !== (conteggi.canale || ''));
      // il record_id cambia solo per lo scostamento scritto prima senza l'anno
      // (15/10/2026): nello stesso anno l'aperto prende quello con l'anno
      const recordCambiato = (a.record_id || '') !== (nuovo.record_id || '');
      if ((a.titolo || '') !== (nuovo.titolo || '') || (a.descrizione || '') !== (nuovo.descrizione || '') || (a.severita || '') !== (nuovo.severita || '') || conteggiCambiati || recordCambiato) {
        daAggiornare.push({ id: a.id, titolo: nuovo.titolo, descrizione: nuovo.descrizione, severita: nuovo.severita, ...(conteggi || {}), ...(recordCambiato ? { record_id: nuovo.record_id } : {}) });
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
    // Un alert la cui condizione non c'e' piu' si chiude solo se il suo record
    // sta negli anni controllati (perimetroDellAlert, A54, 12/10/2026): uno di un
    // anno che non si controlla piu' resta aperto com'e', e se ne chiudono solo i
    // doppioni. La data della nota e' all'italiana (prima usciva 2027-01-02).
    const idDate = new Set([REGOLA_DATE, ...Object.keys(NOME_CANALE_DATE).map(c => `${REGOLA_DATE}_${c}`)]);
    const idRegole = new Set([...regole.map(r => r.id), REGOLA_ROTTA, REGOLA_ROTTA + '_rete', REGOLA_ROTTA + '_ACI', ...idDate]);
    const contesto = { modulo, anno, anniControllati, anniDeiRecord: anniDeiRecord(tutti), mesiProvince, tratteDiQuestAnno };
    const oggiIt = dataItaliana(oggi);
    const visti = new Set();
    const daChiudere = [];
    let restanoAperti = 0;
    for (const a of existingAlerts) {
      if (!idRegole.has(a.regola_id)) continue;
      const key = chiaveDi(a);
      if (!attuali.has(key)) {
        const genere = idDate.has(a.regola_id) ? 'date' : String(a.regola_id || '').startsWith(REGOLA_ROTTA) ? 'rotta' : tipoDi.get(a.regola_id);
        const perimetro = perimetroDellAlert(a, genere, contesto);
        if (!perimetro.controllato) {
          if (visti.has(key)) daChiudere.push({ id: a.id, stato: 'risolto', risolto_note: `Chiuso automaticamente il ${oggiIt}: doppione di un alert ancora aperto` });
          else { visti.add(key); restanoAperti++; }
          continue;
        }
        // la provincia ferma oggi sulla coppia ignorata, e l'aperto e' su quella
        // stessa coppia: la condizione c'e', ma e' gia' stata decisa
        const coppiaAperta = genere === 'province_inattive' && ignorateOggi.has(key) ? coppiaProvincia(a.descrizione, annoRoma(a.updated_date || a.created_date) || anno) : null;
        const giaIgnorata = !!coppiaAperta && coppiaAperta.fine === ignorateOggi.get(key);
        daChiudere.push({ id: a.id, stato: 'risolto', risolto_note: genere === 'date'
          ? `Chiuso automaticamente il ${oggiIt}: gli ordini terminati di questo modulo e canale hanno tutte le date obbligatorie, e nell'ordine giusto`
          : `Chiuso automaticamente il ${oggiIt}: ${giaIgnorata ? 'la stessa coppia di mesi è già stata ignorata' : perimetro.nota}` });
      } else if (visti.has(key)) {
        daChiudere.push({ id: a.id, stato: 'risolto', risolto_note: `Chiuso automaticamente il ${oggiIt}: doppione di un alert ancora aperto` });
      } else {
        visti.add(key);
        // la provincia rimasta sulla sua coppia di mesi, fuori dalla matrice di oggi
        if (provinceFerme.has(a.id)) restanoAperti++;
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
      // gli anni dei record controllati, e quelli su cui possono nascere alert nuovi
      anni_controllati: [...anniControllati],
      anni_alert_nuovi: [...anniNuovi],
      // quelli dell'anno in corso: la pagina scrive «su N record del <anno>
      // controllati». Quanti per ciascun anno controllato, in record_per_anno.
      record_scansionati: dellAnno(anno).length,
      record_per_anno: Object.fromEntries([...anniControllati].map(a => [a, dellAnno(a).length])),
      regole_valutate: regole.length,
      alerts_creati: creati,
      alerts_aggiornati: aggiornati,
      alerts_da_aggiornare: daAggiornare.length - aggiornati,
      alerts_chiusi: chiusi,
      alerts_da_chiudere: daChiudere.length - chiusi,
      // aperti su record di anni che non si controllano piu', su mesi che la
      // matrice delle province non rivaluta piu', o su viaggi dell'anno prima
      // con una regola di tratta scritta quest'anno: restano come sono
      alerts_anni_non_controllati: restanoAperti,
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
 * Gli anni dei formulari a cui puo' riferirsi un alert, letti dall'archivio
 * appena letto: per ID ordine (le regole sul singolo record) e per numero di
 * formulario (le rotte). Solo i terminati con la fine trasporto: gli altri non
 * stanno in nessun anno.
 */
function anniDeiRecord(tutti) {
  const anni = new Map();
  for (const r of tutti) {
    if (!eTerminato(r)) continue;
    const a = annoRoma(r.trasporto_finito_il);
    if (!a) continue;
    for (const k of [r.id_ordine, r.numero_fir]) {
      const s = String(k || '').trim();
      if (!s) continue;
      if (!anni.has(s)) anni.set(s, new Set());
      anni.get(s).add(a);
    }
  }
  return anni;
}

/**
 * Se la condizione di un alert aperto e' stata davvero rivalutata in questo
 * giro (A54, 12/10/2026), e con quale nota si chiude se non c'e' piu'.
 * - date obbligatorie: tutti gli anni; assegnati: non hanno un anno.
 * - province inattive: solo se la coppia di mesi dell'alert sta fra i mesi che
 *   la matrice ha rivalutato (perimetroProvince, revisione del 13/10/2026). Il
 *   12/10 valevano sempre come controllate, ma la matrice dell'anno prima
 *   guarda solo novembre e dicembre, e solo a gennaio e febbraio.
 * - mix, SLA e scostamento: si misurano solo sull'anno in corso e non hanno un
 *   record dietro. Per mix e SLA l'anno e' quello dell'ultima volta che il
 *   motore ha scritto l'alert (lo riscrive coi numeri nuovi finche' la
 *   condizione c'e'): scritto in un anno prima, parla di quell'anno e resta
 *   aperto. Lo scostamento parla dell'anno del suo target, scritto nel
 *   record_id, o per i testi di prima l'anno di created_date
 *   (annoDelloScostamento, 15/10/2026).
 * - regole sul singolo formulario e rotte: l'anno e' quello del record,
 *   ricavato dall'archivio (fine trasporto, giorno italiano). Fuori dagli anni
 *   controllati resta aperto. Se il record non e' piu' fra i terminati con la
 *   fine trasporto (cancellato, tolto dal file, data sparita) si chiude come
 *   prima, e la nota lo dice: l'alert delle date obbligatorie segue la data che
 *   manca.
 * - regole di tratta scritte quest'anno (tratteDiQuestAnno, revisione del
 *   13/10/2026): l'anno prima non lo misurano, quindi per loro conta solo
 *   l'anno in corso. L'alert di un viaggio dell'anno prima resta aperto anche
 *   se la regola nuova ammette la destinazione: allora era un errore.
 * genere: 'date', 'rotta' o il tipo della regola. Non si chiama «tipo» apposta:
 * prove/regoleAlert.mjs legge i confronti tipo === '...' del motore come i tipi
 * di regola che il motore valuta.
 */
function perimetroDellAlert(a, genere, { modulo, anno, anniControllati, anniDeiRecord, mesiProvince, tratteDiQuestAnno }) {
  const tuttiGliAnni = [...anniControllati].sort((x, y) => x - y).join(' e ');
  if (genere === 'province_inattive') return perimetroProvince(a, anno, mesiProvince);
  if (modulo === 'assegnati' || genere === 'date') {
    return { controllato: true, nota: `condizione non presente nei dati ${anno}` };
  }
  if (REGOLE_DELL_ANNO.has(genere)) {
    // lo scostamento parla dell'anno del suo target (15/10/2026); mix e SLA
    // dell'anno in cui il motore li ha scritti l'ultima volta
    const scritto = genere === 'scostamento_target' ? annoDelloScostamento(a) : annoRoma(a.updated_date || a.created_date);
    return { controllato: !scritto || scritto === anno, nota: `condizione non presente nei dati ${anno}` };
  }
  const id = String(a.record_id || '').trim();
  if (!id) return { controllato: true, nota: `condizione non presente nei dati ${tuttiGliAnni}` };
  const anni = anniDeiRecord.get(id);
  if (!anni || !anni.size) return { controllato: true, nota: `${id} non è più fra i terminati con la fine del trasporto` };
  const misura = (x) => anniControllati.has(x) && (x === anno || !tratteDiQuestAnno.has(a.regola_id));
  const dentro = [...anni].filter(misura).sort((x, y) => x - y);
  if (!dentro.length) return { controllato: false, nota: '' };
  return { controllato: true, nota: `condizione non presente nei dati ${dentro.join(' e ')}` };
}

// I mesi come numero unico, anno * 12 + indice del mese: si confrontano e si
// contano anche a cavallo d'anno.
const numeroMese = (anno, idx) => anno * 12 + idx;

/**
 * I mesi che la matrice delle province rivaluta oggi (computeProvinceMatrixData,
 * primarieReteAnalytics.ts): i mesi finiti dell'anno e, a gennaio e febbraio,
 * novembre e dicembre dell'anno prima (la coppia a cavallo d'anno, revisione
 * del 10/10/2026). Se la matrice cambia i mesi che guarda, va cambiato anche
 * qui: lo controlla prove/alertCambioAnno.mjs.
 */
function mesiDellaMatrice(oggi) {
  const anno = Number(oggi.slice(0, 4));
  const mese = Number(oggi.slice(5, 7)) - 1;
  const mesi = new Set();
  for (let i = 0; i < mese; i++) mesi.add(numeroMese(anno, i));
  if (mese <= 1) { mesi.add(numeroMese(anno - 1, 10)); mesi.add(numeroMese(anno - 1, 11)); }
  return mesi;
}

// La coppia di mesi scritta nel testo dell'alert delle province: «(Settembre
// 2026 - Ottobre 2026)», o nel testo di prima «(Settembre - Ottobre)» e
// «(Dicembre 2026 - Gennaio)», coi mesi dell'anno senza l'anno.
const MESE_E_ANNO = `(${MESI_ANNO.join('|')})(?: (\\d{4}))?`;
const COPPIA_DI_MESI = new RegExp(`\\(${MESE_E_ANNO} - ${MESE_E_ANNO}\\)`);

/**
 * I due mesi scritti nel testo di un alert delle province, come numeri
 * (numeroMese), o null se il testo non li ha. Un mese senza l'anno (i testi di
 * prima) e' dell'anno dato. Per una provincia mai servita il primo e' gennaio
 * («nessun ritiro nell'anno (Gennaio 2026 - Settembre 2026)») e l'ultimo e'
 * quello della coppia vuota: per questo un ignorato si confronta sull'ultimo
 * (provinceIgnorate, decisioni dell'utente del 13/10/2026).
 */
function coppiaProvincia(descrizione, anno) {
  const m = String(descrizione || '').match(COPPIA_DI_MESI);
  if (!m) return null;
  return { inizio: numeroMese(Number(m[2]) || anno, MESI_ANNO.indexOf(m[1])), fine: numeroMese(Number(m[4]) || anno, MESI_ANNO.indexOf(m[3])) };
}

/**
 * Il perimetro di un alert delle province inattive (revisione del 13/10/2026).
 * Prima era sempre «controllato»: il 02/01/2027 l'alert di settembre-ottobre
 * 2026 si chiudeva come risolto «nei dati 2027», perche' a gennaio la matrice
 * guarda solo novembre e dicembre del 2026, e il 01/03/2027 lo stesso accadeva
 * a quello di novembre-dicembre 2026. Ora si chiude da solo solo se i mesi della
 * sua coppia sono fra quelli che la matrice ha rivalutato in questo giro; se no
 * resta aperto, come gli altri alert fuori perimetro, e la risposta lo conta.
 * Un mese scritto senza l'anno (i testi di prima) e' dell'anno in cui il motore
 * ha scritto l'alert l'ultima volta: un alert aperto lo scrivono solo i motori,
 * la pagina lo chiude o lo ignora. Un testo senza la coppia si tratta come mix
 * e SLA: si chiude solo se scritto quest'anno.
 * Decide anche se l'alert si riscrive con la coppia trovata oggi: fuori
 * perimetro no, resta sulla sua (giro di revisione successivo, 13/10/2026).
 */
function perimetroProvince(a, anno, mesiProvince) {
  const scritto = annoRoma(a.updated_date || a.created_date) || anno;
  const coppia = coppiaProvincia(a.descrizione, scritto);
  if (!coppia) return { controllato: scritto === anno, nota: `condizione non presente nei dati ${anno}` };
  const { inizio, fine } = coppia;
  if (!mesiProvince.has(inizio) || !mesiProvince.has(fine)) return { controllato: false, nota: '' };
  const anni = [...new Set([Math.floor(inizio / 12), Math.floor(fine / 12)])].join(' e ');
  return { controllato: true, nota: `condizione non presente nei dati ${anni}` };
}

/**
 * Il testo dell'alert di una provincia inattiva (revisione del 13/10/2026). I
 * mesi della coppia portano sempre l'anno: la matrice lo scrive solo per quelli
 * dell'anno prima («Novembre 2026 - Dicembre 2026», «Dicembre 2026 - Gennaio»),
 * e un «Settembre - Ottobre» letto a gennaio non dice di quale anno sia. Da
 * quell'anno dipende se l'alert si puo' chiudere da solo (perimetroProvince).
 * Una provincia del contratto senza nessun ritiro nell'anno (senza_ritiri, A58)
 * lo dice, coi mesi da gennaio all'ultimo finito, invece della sola coppia.
 */
function descrizioneProvincia(prov, annoMatrice) {
  const conAnno = (m) => (/\d{4}$/.test(String(m ?? '')) ? String(m) : `${m} ${annoMatrice}`);
  const coppia = prov.last_zero_pair || {};
  const nellAnno = !/\d{4}$/.test(String(coppia.start ?? ''));
  if (prov.senza_ritiri && nellAnno) {
    return `Provincia ${prov.provincia} (${prov.regione}), del contratto: nessun ritiro nell'anno (${MESI_ANNO[0]} ${annoMatrice} - ${conAnno(coppia.end)}). Pianificare le raccolte per rispettare i requisiti consorziali.`;
  }
  return `Provincia ${prov.provincia} (${prov.regione}): 2 mesi consecutivi con 0 raccolte (${conAnno(coppia.start)} - ${conAnno(coppia.end)}). Pianificare raccolte nel terzo mese per rispettare i requisiti consorziali.`;
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

// I soli controlli di rotta, per i moduli che non hanno gli altri aggregati, e
// per l'anno prima. creaNuovi falso: le condizioni si segnano (tengono aperto e
// riscrivono l'alert che c'e') ma alert nuovi non ne nascono (PERIMETRO, sopra).
function soloRotte(records, existingKeys, attuali, archivio, modulo, canale = '', creaNuovi = true) {
  return checkAggregateRules(records, [], existingKeys, [], attuali, archivio, modulo, canale, records, creaNuovi);
}

// --- Controlli aggregati per primarie_rete ---
// storico: tutti i ritiri, anche degli anni prima, per le province a cavallo d'anno.
// commesse: i contratti Ecotyre, per le province del contratto senza ritiri (A58).
function checkAggregateRules(records, regole, existingKeys, targets = [], attuali = new Map(), archivio = 'PrimariaRete', modulo = 'primarie_rete', canale = '', storico = records, creaNuovi = true, commesse = null) {
  const alerts = [];
  // Ogni condizione trovata si segna col testo calcolato adesso, anche quando
  // l'alert c'e' gia' (per riscriverne il testo); si crea solo se la chiave non
  // e' ne' aperta ne' ignorata, e se l'anno ammette alert nuovi. La provincia
  // ignorata sulla stessa coppia di mesi si toglie prima di scrivere
  // (provinciaIgnorata, decisioni dell'utente del 13/10/2026).
  const proponi = (key, alert) => {
    segna(attuali, key, alert);
    if (existingKeys.has(key) || !creaNuovi) return;
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
        + `, del ${dataItaliana(sospetto.giorno)}, ${formatoKg(sospetto.kg)} kg.`
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
    // Tutti i ritiri, non solo quelli dell'anno: a gennaio e febbraio la funzione
    // guarda anche novembre e dicembre dell'anno prima (la coppia a cavallo d'anno,
    // revisione del 10/10/2026). I terminati e gli anni li sceglie lei.
    // Coi contratti (A58, 13/10/2026) entrano a zero anche le province del
    // contratto dell'anno mai servite: senza, non comparivano mai.
    const matrix = computeProvinceMatrixData(storico, null, commesse ? { commesse } : {});
    for (const prov of matrix.province_with_zeros) {
      for (const regola of regoleProvince) {
        const key = `${prov.provincia}|||${regola.id}`;
        proponi(key, {
          titolo: regola.messaggio_alert || `Provincia inattiva: ${prov.provincia}`,
          descrizione: descrizioneProvincia(prov, matrix.current_year),
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
          `${d.classe}: ${unDecimale(d.attuale)}% vs target ${d.target}% (Δ${d.deviazione > 0 ? '+' : ''}${unDecimale(d.deviazione)}%)`
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
          // e l'alert si ricreava a ogni giro. Con l'anno del target (prova
          // generale del cambio d'anno, 15/10/2026, vedi chiaveDelloScostamento),
          // dopo uno spazio: con la barra coincideva con gli avvisi dei target di
          // checkTargetAlerts e li bloccava (revisione del 15/10/2026).
          const recordId = `${racc}|${regione}|${mese} ${annoTarget}`;
          const alertKey = `${recordId}|||${regola.id}`;
          proponi(alertKey, {
            titolo: regola.messaggio_alert || `Scostamento target grave: ${racc} - ${regione} - ${mese} ${annoTarget}`,
            descrizione: `Raccoglitore "${racc}" (${regione}, ${mese} ${annoTarget}): target ${formatoTonnellate(targetVal)} t, raccolto ${formatoTonnellate(raccolto)} t, Δ ${formatoTonnellate(delta)} ton (${unDecimale(pctDelta)}%). Soglia: ${soglia}%.`,
            severita: regola.severita || 'critico',
            modulo: 'primarie_rete',
            entity_type: 'PrimariaRete',
            record_id: recordId,
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
            descrizione: `Trasportatore "${t.trasportatore}": Nr Giorni medio ${unDecimale(t.nr_giorni_medio)} gg ${MISURA_SLA}, % fuori tempo ${unDecimale(t.pct_dopo_scadenza)}%. Soglie: > 12 gg medio o > 20% fuori tempo.`,
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

// IL BATTITO (chiusura dell'audit, 11/10/2026): ogni giro del lavoro lascia il
// suo esito in EsecuzioneLavoro (shared/battito.ts), anche quando non riesce; la
// risposta resta quella di sopra, e un errore risale com'e'.
export default async function(req) {
  return conBattito(() => conLimiteRichieste(createClientFromRequest(req)), 'runAlertEngine', () => motoreAlert(req), req);
}
