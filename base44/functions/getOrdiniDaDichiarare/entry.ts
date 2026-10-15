import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll, perPagina } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { giornoRoma, annoRoma, oggiRoma } from "../../shared/giornoItaliano.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { formulariDelFile, ruoloDellaRiga, giornoFotografia, ordiniNotiAlPortale, dichiaratoDopoLaFotografia, inizioAggiunti, finiDelleSecondarie, giornoDelCarico, nellAttesaDellAnno, sitiDellAnno } from "../../shared/giacenzaPortale.ts";
import { eTerminato } from "../../shared/movimenti.ts";
import { carichiNonNelFile, riconciliazioneDaDichiarare, scalaDichiaratoDopo, contoPerMese } from "../../shared/riconciliazioneDaDichiarare.ts";

// Restituisce l'elenco paginato degli ordini da dichiarare: le righe del file
// del portale degli ordini non dichiarati (OrdineNonDichiarato) PIU' i carichi
// che il gestionale conosce e il file non ha ancora (15/10/2026, vedi sotto).
// Payload: { sito, provincia, anno, ricerca, limite, offset, tutte } - tutti opzionali.
// Con tutte: true le righe non si tagliano a mille: serve agli export, che
// scrivevano il TOTALE di tutto l'elenco sotto le sole prime mille righe.
// Richiede solo utente autenticato.
//
// Tutto per FINE DEL TRASPORTO, sul giorno italiano: l'anno, l'ordinamento e i
// giorni di attesa. La data di chiusura dell'ordine a portale si mostra soltanto
// e non decide nulla (regola dell'utente, 21/09/2026). Il file e' della rete: una
// riga ACI, se mai ci fosse, resta fuori, perche' i canali non si mescolano.
//
// Le date del formulario (regola dell'utente, 22/09/2026): immissione, inizio e
// fine trasporto sono obbligatorie e, dove mancano, si segnalano. Una riga del
// file e' un ordine che il PORTALE conosce; il suo formulario nel gestionale e' la
// primaria (e, se il carico e' passato da uno stoccaggio, la secondaria che l'ha
// portato all'impianto). Se quel formulario e' terminato con una data mancante o
// incoerente la riga lo dice, con quali date. Se manca la fine trasporto del
// movimento che arriva all'impianto, il portale conta il carico nella sua
// giacenza e il gestionale non lo colloca in nessun mese: fuori_dai_mesi; se al
// formulario della primaria manca la fine trasporto e il file la scrive, la riga
// la riporta (fine_a_portale) perche' la si ricopi. La regola che lega una riga
// ai suoi formulari sta in shared/giacenzaPortale.ts (formulariDelFile).
//
// L'ELENCO E' IL FILE DEL PORTALE PIU' I CARICHI ARRIVATI DOPO (15/10/2026).
//
// La domanda dell'utente: «non capisco perche' ad ottobre in t-cycle sono entrati
// finora 49,04 t e nelle giacenze alla voce di ottobre risulta ancora 40,92 t».
// La giacenza della Situazione (372,92 t) e il pulsante (122 ordini) contavano i
// 4 carichi del 12-13/10 che il file del 09/10 non ha ancora; l'elenco, il suo
// totale e la fascia dei mesi solo le 118 righe del file, e i 4 carichi stavano
// in un «quali sono» che si vedeva solo arrivando dal pulsante. Ora, per tutti
// gli impianti con una regola sola:
//  - i carichi che il gestionale conosce e il file non ha ancora
//    (carichiNonNelFile, shared/riconciliazioneDaDichiarare.ts: la regola della
//    giacenza e del riepilogo delle dichiarazioni) sono RIGHE dell'elenco, con
//    nel_file falso, e passano dagli stessi filtri delle altre; solo quelli
//    arrivati al sito dopo il giorno del file (arrivato_dopo_il_file) si dicono
//    «arrivati dopo»: uno terminato prima e chiuso a portale dopo il file e'
//    «non ancora nel file»;
//  - il dichiarato a portale dopo la fotografia si toglie dalle righe a cui il
//    portale lo aggancia, dal carico piu' vecchio (scalaDichiaratoDopo): la riga
//    resta, dice quanto ne e' uscito, e il peso da dichiarare e' quello che resta;
//  - percio' il totale dell'elenco di un impianto e' la sua giacenza a portale
//    della Situazione, al chilo, e il numero delle righe e' quello del pulsante;
//  - il mese di una riga e' quello del giorno in cui il carico e' arrivato al
//    sito a cui il portale lo attribuisce (giornoDelCarico): per un carico passato
//    da uno stoccaggio la fine trasporto della secondaria, come nel riepilogo
//    delle dichiarazioni, cosi' i mesi di questo elenco sono quelli che le
//    Dichiarazioni Impianti dicono da dichiarare. La colonna «Fine trasporto»
//    resta quella del file, e la riga dice il giorno dell'arrivo all'impianto
//    quando e' un altro (giorno_al_sito).
// Lo stoccaggio resta quello che e': le sue righe sono carichi passati dal
// piazzale e gia' ripartiti, «in attesa di dichiarazione», non giacenza
// dell'impianto, e non hanno carichi aggiunti (il materiale arrivato al piazzale
// non diventa un carico dell'impianto: lo decide ingressoMovimento).
//
// Filtri:
//   sito     -> destinazione_secondaria se valorizzata, altrimenti destinazione (normalizzaRagioneSociale)
//   provincia-> confronto in maiuscolo e con trim
//   anno     -> anno del giorno in cui il carico e' arrivato al sito (accetta ancora anno_chiusura dalle pagine vecchie)
//   ricerca  -> corrispondenza parziale case-insensitive su numero_fir e numero d'ordine
//   solo_date_da_sistemare -> solo le righe il cui formulario ha le date da sistemare
//   ruolo    -> 'imp' (da dichiarare su quell'impianto) o 'stoc' (passati dal piazzale e gia' ripartiti)
//
// Restituisce: righe (paginate), totale_righe, totale_kg, per_mese (di quali mesi
// sono gli ordini di tutto l'elenco filtrato, non della pagina, con le parti:
// arrivati dopo il file, dichiarato dopo, impianto e stoccaggio), parti (le
// stesse sul totale), foto_del (il giorno del file), siti_distinti (anche, con un
// sito scelto, gli altri impianti che hanno solo carichi arrivati dopo),
// province_distinte, anni_distinti, date_da_sistemare ({ n, kg, fuori_dai_mesi,
// fuori_dai_mesi_kg } delle righe filtrate), senza_fine_a_portale (righe del file
// senza fine trasporto), senza_fine_dal_gestionale (quante la prendono dalla
// primaria nel gestionale), carichi_dopo_il_file ({ cercati, errore }).
//
// La riga di riconciliazione (11/10/2026) c'e' sempre, non solo arrivando dal
// pulsante (il vecchio riconcilia: true non serve piu' e si ignora): con un sito
// e un ruolo che non sia 'stoc', riconciliazione = righe del file + carichi non
// ancora nel file - dichiarato dopo la fotografia = giacenza a portale, e righe +
// carichi = il numero del pulsante, sempre di TUTTO il sito anche con l'anno o la
// provincia scelti (elenco dice quanto ne mostra l'elenco filtrato); per un sito
// che e' anche stoccaggio, la parte dello stoccaggio a parte. Senza un sito,
// riconciliazione_siti: la stessa riga per ogni impianto, e gli stoccaggi.
//
// carichi_del (anno, dal 14/10/2026) -> solo i carichi arrivati in quell'anno al
// sito a cui il portale li attribuisce: all'impianto (la fine della secondaria,
// se il carico e' passato da un piazzale) o al piazzale, per fine trasporto. E'
// la regola con cui le Giacenze di un anno passato contano gli ordini da
// dichiarare (giornoDelCarico e nellAttesaDellAnno,
// shared/giacenzaPortale.ts): il pulsante di quell'anno apre l'elenco con
// carichi_del, e l'elenco dice lo stesso numero, carichi non ancora nel file
// compresi. Sull'anno in corso e su quello dopo non filtra niente. La riga di
// riconciliazione dice solo gli ordini (file + carichi non ancora nel file =
// pulsante): la giacenza di un anno chiuso e' la lettura del 31/12, non questo
// elenco.
//
// LE LETTURE (15/10/2026, misurate sui dati veri dell'11/10). I carichi che il
// file non ha si cercano fra le primarie e le secondarie terminate da
// inizioAggiunti in avanti (la finestra: 3.104 primarie e 167 secondarie, una
// pagina ciascuna). Le stesse primarie servono alle righe del file: tutte le 943
// primarie del file erano nella finestra, e le domande per numero d'ordine si
// fanno solo per quelle che la finestra non ha. Che il portale conosca un carico
// lo dice il report delle dichiarazioni: se ne leggono le righe dichiarate da
// inizio finestra in avanti (3.236 righe, una pagina; un carico non si dichiara
// prima di arrivare), e solo per i carichi che restano si chiede il report per
// numero d'ordine, che fa il conto esatto qualunque data porti la riga. Misurato
// sui dati veri: con tutti i siti da 9 richieste a 6; dal pulsante di un
// impianto, con la riga di riconciliazione, da 8-14 a 6 (T-Cycle 8, Irigom 14);
// sfogliando le pagine o con un filtro da 3-4 a 6, perche' la riga c'e' sempre;
// dal pulsante di uno stoccaggio 4, come prima. Con dei carichi arrivati dopo il
// file, una o due richieste in piu' per numero d'ordine, per quei soli carichi.
// Ogni richiesta e' una pagina; nessuna lettura per riga.
const BLOCCO_ORDINI = 150;
const BLOCCHI_INSIEME = 3;

/** Legge i record di `entity` con `campo` (id_ordine se non si dice) fra `ids`, a blocchi, e li passa a `fn`; quanti ne ha letti. */
async function perOrdini(entity, ids, fn, campo = 'id_ordine') {
  const blocchi = [];
  for (let i = 0; i < ids.length; i += BLOCCO_ORDINI) blocchi.push(ids.slice(i, i + BLOCCO_ORDINI));
  let letti = 0;
  for (let i = 0; i < blocchi.length; i += BLOCCHI_INSIEME) {
    const esiti = await Promise.all(blocchi.slice(i, i + BLOCCHI_INSIEME)
      .map(blocco => fetchAll(entity, { [campo]: { $in: blocco } }, 'id')));
    for (const righe of esiti) for (const r of righe) { letti++; fn(r); }
  }
  return letti;
}

/**
 * Come perOrdini, con un ripiego. Se la domanda per numero d'ordine da' errore o
 * non torna nessun record, si rilegge tutto l'archivio pagina per pagina e si
 * tengono gli ordini voluti: meglio lenta che una scheda che non segnala le date
 * da sistemare. `fn` puo' ricevere due volte lo stesso record: formulariDelFile
 * lo tiene una volta sola. `giaTrovati` sono gli ordini voluti che la finestra
 * ha gia' portato (15/10/2026): se la domanda torna vuota ma non da' errore,
 * quei pochi che mancano non sono nel gestionale, e non si rilegge l'archivio.
 */
async function leggiOrdini(entity, ids, fn, giaTrovati = 0) {
  if (!ids.length) return;
  let letti = 0, guasto = false;
  try { letti = await perOrdini(entity, ids, fn); } catch { guasto = true; }
  if (letti || (giaTrovati && !guasto)) return;
  const voluti = new Set(ids);
  await perPagina(entity, null, (r) => { if (voluti.has(String(r.id_ordine || '').trim())) fn(r); });
}

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { sito, provincia, ricerca, limite, offset } = body;
    const soloDate = !!body.solo_date_da_sistemare;
    // 'imp' = i carichi che quell'impianto deve dichiarare; 'stoc' = quelli passati
    // dal suo piazzale e gia' ripartiti, che dichiara chi li ha ricevuti.
    const ruoloChiesto = ['imp', 'stoc'].includes(String(body.ruolo || '').trim().toLowerCase()) ? String(body.ruolo).trim().toLowerCase() : null;
    const anno = body.anno ?? body.anno_chiusura;
    // L'anno dei carichi (carichi_del, 14/10/2026): sull'anno in corso vale tutto
    // il file, come senza (nellAttesaDellAnno), e la riga di riconciliazione resta
    // quella che arriva alla giacenza. Anche sull'anno dopo (revisione del
    // 14/10/2026): li' le Giacenze contano tutto il file accanto alla fotografia di
    // oggi, e un elenco dei soli carichi di quell'anno era vuoto, con una riga che
    // chiamava quella giacenza «la lettura del 31/12». Il filtro vale solo per un
    // anno passato, come ordiniDiUnAnnoPassato in calcolaGiacenze.
    const annoDiOggi = Number(oggiRoma().slice(0, 4));
    const carichiChiesti = body.carichi_del === undefined || body.carichi_del === null || body.carichi_del === '' ? null : Number(body.carichi_del);
    const carichiDel = carichiChiesti !== null && Number.isFinite(carichiChiesti) && carichiChiesti < annoDiOggi ? carichiChiesti : null;

    const norm = normalizzaRagioneSociale;
    const tutte = !!body.tutte;
    const limiteNum = Math.min(Number(limite) || 100, 1000);
    const offsetNum = Math.max(Number(offset) || 0, 0);

    const svc = base44.asServiceRole.entities;
    const righeFile = await fetchAll(svc.OrdineNonDichiarato);
    const all = righeFile.filter(r => !eAci({ prodotto: r.prodotto }));
    // Il giorno del file e quello che il portale conosce: le righe del file
    // subito, il report delle dichiarazioni piu' sotto.
    const foto = giornoFotografia(righeFile);
    const portaleConosce = ordiniNotiAlPortale();
    for (const r of righeFile) portaleConosce.segna(r);

    const sitoNorm = sito ? norm(sito) : null;
    const provUpper = provincia ? String(provincia).trim().toUpperCase() : null;
    const annoNum = anno ? Number(anno) : null;
    const ricercaLower = ricerca ? String(ricerca).trim().toLowerCase() : null;

    function sitoDiRiga(r) {
      const sec = String(r.destinazione_secondaria || '').trim();
      if (sec) return sec;
      return String(r.destinazione || '').trim();
    }

    // --- Le letture dei carichi che il file non ha ancora ---
    // Servono solo se l'elenco puo' avere righe di un impianto: dal pulsante di uno
    // stoccaggio no, e li' le letture restano quelle di prima. Senza il file non
    // c'e' una fotografia a cui aggiungerli. Su un anno passato finito prima della
    // finestra non ce ne possono essere (14/10/2026): si leggono solo i siti di
    // quell'anno, per sapere chi la rete non la dichiara.
    const servonoICarichi = !!foto && ruoloChiesto !== 'stoc';
    const inizio = inizioAggiunti(foto);
    const nessunAggiunto = !servonoICarichi || (carichiDel !== null && `${carichiDel}-12-31` < inizio);
    let finestra = null;
    if (!nessunAggiunto) {
      // Un giorno di margine per il giorno italiano, come le Giacenze.
      const d = new Date(`${inizio}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      const giorno = d.toISOString().slice(0, 10);
      finestra = { giorno, filtro: { stato: 'terminato', trasporto_finito_il: { $gte: `${giorno}T00:00:00` } } };
    }
    // Se una di queste letture non riesce l'elenco esce lo stesso, con le sole
    // righe del file, e lo dice (carichi_dopo_il_file.errore, e la riga di
    // riconciliazione): mai un elenco piu' corto che si spaccia per la giacenza.
    let erroreCarichi = '';
    const motivo = (e) => (e && e.message ? e.message : String(e));
    let primarieFinestra = [], secondarieFinestra = [], giacenzeSito = [], dichiarazioniSito = [], reportRecente = [];
    if (servonoICarichi) {
      try {
        let sitiTutti = [];
        [primarieFinestra, secondarieFinestra, sitiTutti, dichiarazioniSito, reportRecente] = await Promise.all([
          finestra ? fetchAll(svc.PrimariaRete, finestra.filtro) : Promise.resolve([]),
          finestra ? fetchAll(svc.Secondaria, finestra.filtro) : Promise.resolve([]),
          // I SITI DELL'ANNO, E QUELLI DELL'ANNO PRIMA CHE LA RIGA NON L'HANNO
          // ANCORA (15/10/2026, prova generale del cambio d'anno, difetto 11;
          // decisione dell'utente del 15/10/2026, D3): una lettura sola, come
          // prima, ma di tutti gli anni (l'archivio ha qualche riga per anno), e la
          // regola delle Giacenze e delle Dichiarazioni (sitiDellAnno). Il 02/01/2027,
          // senza la riga 2027 di Tecnogum, l'elenco dava 320 righe per 1.833.430 kg
          // a un impianto che la rete non ce la dichiara.
          fetchAll(svc.GiacenzaSito),
          carichiDel === null ? fetchAll(svc.DichiarazioneSito) : Promise.resolve([]),
          finestra ? fetchAll(svc.DichiarazioneTrattamento, { data_dichiarazione: { $gte: finestra.giorno } }) : Promise.resolve([]),
        ]);
        giacenzeSito = sitiDellAnno(sitiTutti, carichiDel !== null ? carichiDel : annoDiOggi, { chiaveDi: norm, annoDiOggi }).righe;
      } catch (e) {
        erroreCarichi = motivo(e);
        primarieFinestra = []; secondarieFinestra = []; giacenzeSito = []; dichiarazioniSito = []; reportRecente = [];
      }
    }

    // I formulari del gestionale da sistemare: primarie di rete e secondarie
    // terminate con una data obbligatoria mancante o incoerente, lette solo per
    // gli ordini del file che servono (vedi in testa): quelli del sito scelto (di
    // tutto il sito, perche' la riga di riconciliazione e il dichiarato dopo sono
    // del sito) e quelli senza fine trasporto nel file, per l'anno.
    const formulari = formulariDelFile();
    const idPrimarie = new Set();
    const idSecondarie = new Set();
    for (const r of all) {
      const serve = !sitoNorm || norm(sitoDiRiga(r)) === sitoNorm || !giornoRoma(r.fine_trasporto);
      if (!serve) continue;
      const p = String(r.ordine_primaria || '').trim();
      const s = String(r.ordine_secondaria || '').trim();
      if (p) idPrimarie.add(p);
      if (s) idSecondarie.add(s);
    }
    // A CHE TITOLO IL CARICO STA SU QUEL SITO. Un'azienda puo' essere impianto e
    // piazzale insieme: quello che e' passato dal piazzale ed e' ripartito in
    // secondaria sta come giacenza su chi l'ha ricevuto, e lo dichiara lui. Il
    // ruolo lo dice la primaria nel gestionale, e si legge qui senza una lettura
    // in piu' (utente, 08/10/2026).
    const tipoPrimaria = new Map();
    // Il giorno in cui un carico e' arrivato al sito: la fine trasporto della
    // primaria terminata (come fineRete nelle Giacenze) e quella delle secondarie
    // lette qui, le stesse delle righe che servono. Nessuna lettura in piu'.
    const finePrimarie = new Map();
    const secondarieLette = [];
    const segnaPrimaria = (r) => {
      formulari.segna(r, 'primaria');
      const id = String(r.id_ordine || '').trim();
      const td = String(r.tipo_destinazione || '').trim().toLowerCase();
      if (id && td) tipoPrimaria.set(id, td.startsWith('stoc') ? 'stoc' : 'imp');
      const fine = eTerminato(r) ? giornoRoma(r.trasporto_finito_il) : '';
      if (id && fine) finePrimarie.set(id, fine);
    };
    // Le secondarie ACI non portano righe di questo file, che e' della rete.
    const segnaSecondaria = (r) => { secondarieLette.push(r); if (!eAci(r)) formulari.segna(r, 'secondaria'); };
    // Quello che la finestra ha gia' portato non si chiede di nuovo.
    const vistePrimarie = new Set();
    const visteSecondarie = new Set();
    for (const r of primarieFinestra) {
      const id = String(r.id_ordine || '').trim();
      if (idPrimarie.has(id)) { segnaPrimaria(r); vistePrimarie.add(id); }
    }
    for (const r of secondarieFinestra) {
      const id = String(r.id_ordine || '').trim();
      if (idSecondarie.has(id)) { segnaSecondaria(r); visteSecondarie.add(id); }
    }

    // Che il portale conosca un carico: il report delle dichiarazioni recenti
    // subito, poi per numero d'ordine solo quello che resta (vedi in testa).
    // Chi la rete non la dichiara per accordo (oggi Tecnogum) non ha carichi
    // «in ritardo nel file»: non ce ne sono proprio.
    for (const r of reportRecente) portaleConosce.segna(r, 'dichiarazioni');
    const nonDichiaraRete = new Set(giacenzeSito.filter(g => g.dichiara_rete === false).map(g => norm(g.sito)));
    const carichi = carichiNonNelFile({ foto, portaleConosce, chiaveDi: norm, nonDichiaraRete });
    const daChiedere = (righe, tipo) => righe.filter(r => {
      const ns = carichi.candidato(r, tipo);
      return !!ns && (!sitoNorm || ns === sitoNorm) && !portaleConosce.noto(r, tipo);
    });
    const candidatePrimarie = erroreCarichi ? [] : daChiedere(primarieFinestra, 'primaria');
    const candidateSecondarie = erroreCarichi ? [] : daChiedere(secondarieFinestra, 'secondaria');
    const ids = (righe) => [...new Set(righe.map(r => String(r.id_ordine || '').trim()).filter(Boolean))];
    const nelReport = (lista, campo) => perOrdini(svc.DichiarazioneTrattamento, ids(lista), (r) => portaleConosce.segna(r, 'dichiarazioni'), campo)
      .catch((e) => { erroreCarichi = erroreCarichi || motivo(e); });
    await Promise.all([
      leggiOrdini(svc.PrimariaRete, [...idPrimarie].filter(id => !vistePrimarie.has(id)), segnaPrimaria, vistePrimarie.size),
      leggiOrdini(svc.Secondaria, [...idSecondarie].filter(id => !visteSecondarie.has(id)), segnaSecondaria, visteSecondarie.size),
      nelReport(candidatePrimarie, 'ordine_primaria'),
      nelReport(candidateSecondarie, 'ordine_secondaria'),
    ]);
    if (!erroreCarichi) {
      for (const r of candidatePrimarie) carichi.segna(r, 'primaria');
      for (const r of candidateSecondarie) carichi.segna(r, 'secondaria');
    }
    // IL MENU DEI SITI CON UN SITO GIA' SCELTO (revisione del 15/10/2026). La
    // scheda rifa' il menu a ogni risposta, e i carichi arrivati dopo il file si
    // cercano solo per il sito scelto: scelto T-Cycle, T.R.S. - che nel file non
    // c'e' e ha solo carichi arrivati dopo - spariva dal menu finche' non si
    // tornava a «Tutti i siti». I nomi degli altri impianti vengono dalle
    // primarie e secondarie della finestra gia' lette, con la stessa decisione
    // (candidato) e quello che il portale conosce gia' qui: nessuna lettura in
    // piu'. Il report per numero d'ordine si chiede solo per il sito scelto: un
    // impianto i cui carichi il portale conosce solo da un report vecchio puo'
    // comparire nel menu e, scelto, dire che non ha niente da dichiarare.
    const sitiDeiCandidati = new Map();
    if (sitoNorm && !erroreCarichi) {
      for (const [righe, tipo] of [[primarieFinestra, 'primaria'], [secondarieFinestra, 'secondaria']]) {
        for (const r of righe) {
          const ns = carichi.candidato(r, tipo);
          if (ns && ns !== sitoNorm && !sitiDeiCandidati.has(ns) && !portaleConosce.noto(r, tipo)) sitiDeiCandidati.set(ns, String(r.destinazione || '').trim());
        }
      }
    }

    // --- Le righe: quelle del file e i carichi arrivati dopo ---
    const finiSecondarie = finiDelleSecondarie(secondarieLette);
    const ruoloPrimaria = (id) => tipoPrimaria.get(id) || '';
    const finePrimaria = (id) => finePrimarie.get(id) || '';
    const righeTutte = [];
    for (const r of all) {
      const date = formulari.diRiga(r);
      const ruolo = ruoloDellaRiga(r, ruoloPrimaria);
      const nome = sitoDiRiga(r);
      righeTutte.push({
        nel_file: true, r, date, ruolo, nome, chiave: norm(nome),
        // La fine trasporto della riga: quella del file o, se il file non la
        // scrive, quella della primaria nel gestionale. Mai la chiusura (22/09/2026).
        fine: giornoRoma(r.fine_trasporto) || date.fine_dal_gestionale || '',
        // Il giorno in cui il carico e' arrivato al sito: decide mese, anno e ordine.
        giorno: giornoDelCarico(r, ruolo, { finiSecondarie, finePrimaria }),
        kg: Number(r.peso_non_dichiarato_kg) || 0,
        provincia: r.provincia, fir: r.numero_fir, ordini: [r.ordine_primaria],
      });
    }
    for (const m of carichi.movimenti()) {
      const r = m.r;
      // Il formulario nel gestionale del carico: le date da sistemare, se ce ne sono.
      formulari.segna(r, m.tipo);
      const date = m.tipo === 'secondaria'
        ? formulari.diRiga({ ordine_secondaria: r.id_ordine, destinazione_secondaria: r.destinazione })
        : formulari.diRiga({ ordine_primaria: r.id_ordine, fine_trasporto: m.giorno });
      righeTutte.push({
        nel_file: false, carico: m, date, ruolo: 'imp', nome: String(r.destinazione || '').trim(), chiave: m.ns,
        fine: m.giorno, giorno: m.giorno, kg: Number(r.peso_effettivo) || 0,
        provincia: r.provincia, fir: r.numero_fir, ordini: [r.id_ordine],
        // Arrivato al sito dopo il giorno del file, o prima e il file non l'ha
        // lo stesso (un ordine chiuso a portale dopo il file): la scritta della
        // riga dice quale delle due, e solo nel primo caso «arrivato dopo il
        // file» (revisione del 15/10/2026). Lo stesso giorno del file non si sa
        // se prima o dopo la fotografia: si dice «non ancora nel file».
        dopo: !!foto && !!m.giorno && m.giorno > foto,
      });
    }

    // Il dichiarato a portale dopo la fotografia, sulle righe a cui il portale lo
    // aggancia: solo sull'anno in corso, dove l'elenco arriva alla giacenza.
    const dopoPerSito = new Map();
    if (servonoICarichi && !erroreCarichi && carichiDel === null) {
      for (const [ns, kg] of dichiaratoDopoLaFotografia(dichiarazioniSito, foto, norm)) if (!nonDichiaraRete.has(ns)) dopoPerSito.set(ns, kg);
    }
    const { tolto, oltre } = scalaDichiaratoDopo(righeTutte, dopoPerSito);
    const netto = (x) => x.kg - (tolto.get(x) || 0);

    const passa = (x) => {
      if (sitoNorm && x.chiave !== sitoNorm) return false;
      if (provUpper && String(x.provincia || '').trim().toUpperCase() !== provUpper) return false;
      if (ricercaLower) {
        const fir = String(x.fir || '').toLowerCase();
        if (!fir.includes(ricercaLower) && !x.ordini.some(o => String(o || '').toLowerCase().includes(ricercaLower))) return false;
      }
      return true;
    };
    const dellAnnoDeiCarichi = (x) => carichiDel === null || nellAttesaDellAnno(x.giorno, carichiDel, annoDiOggi);

    const filtrate = [];
    let senzaFineAPortale = 0;
    let senzaFineDalGestionale = 0;
    // Un sito per chiave: un carico arrivato dopo puo' scrivere il nome in un
    // altro modo, e il menu non deve offrire due volte lo stesso impianto.
    const sitiSet = new Map();
    const provinceSet = new Set();
    const anniSet = new Set();
    const oggi = oggiRoma();
    const giorniFra = (da, a) => Math.round((Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) - Date.UTC(+da.slice(0, 4), +da.slice(5, 7) - 1, +da.slice(8, 10))) / 86400000);

    for (const x of righeTutte) {
      // Valori distinti per i filtri, su tutte le righe: anche un impianto che nel
      // file non c'e' e ha solo carichi arrivati dopo si deve poter scegliere.
      if (x.nome && !sitiSet.has(x.chiave)) sitiSet.set(x.chiave, x.nome);
      const prov = String(x.provincia || '').trim().toUpperCase();
      if (prov) provinceSet.add(prov);
      const annoArrivo = annoRoma(x.giorno);
      if (annoArrivo !== null) anniSet.add(annoArrivo);

      if (!passa(x)) continue;
      if (annoNum !== null && annoArrivo !== annoNum) continue;
      if (soloDate && !x.date.formulari.length) continue;
      // Chiesto il ruolo, restano solo le righe di quel titolo: dal pulsante
      // dell'impianto si vede quello che l'impianto deve dichiarare, e basta.
      if (ruoloChiesto && x.ruolo !== ruoloChiesto) continue;
      // Su un anno passato, solo i carichi arrivati in quell'anno: gli ordini che
      // il pulsante delle Giacenze di quell'anno conta.
      if (!dellAnnoDeiCarichi(x)) continue;
      filtrate.push(x);
      if (x.nel_file && !giornoRoma(x.r.fine_trasporto)) { senzaFineAPortale++; if (x.date.fine_dal_gestionale) senzaFineDalGestionale++; }
    }
    for (const [ns, nome] of sitiDeiCandidati) if (nome && !sitiSet.has(ns)) sitiSet.set(ns, nome);

    // Dal carico arrivato da piu' tempo; quelli senza giorno in fondo.
    filtrate.sort((a, b) => (a.giorno || '9999').localeCompare(b.giorno || '9999'));

    // L'elenco e' tutto il sito (o tutti i siti) se non c'e' un filtro che ne
    // mostra una parte: solo allora il dichiarato che va oltre le righe (una
    // giacenza sotto zero) entra nel totale, perche' il totale e' la giacenza.
    const conFiltri = !!provUpper || annoNum !== null || !!ricercaLower || soloDate;
    const oltreNellElenco = conFiltri ? 0 : [...oltre].filter(([ns]) => !sitoNorm || ns === sitoNorm).reduce((s, [, kg]) => s + kg, 0);
    const somma = (l, f) => Math.round(l.reduce((s, x) => s + f(x), 0));

    const totale_righe = filtrate.length;
    const totale_kg = somma(filtrate, netto) - Math.round(oltreNellElenco);
    // DI QUALI MESI SONO (regola dell'utente, 09/10/2026), su tutto l'elenco
    // filtrato e non sulla pagina, con le parti (15/10/2026): quanti di quel mese
    // sono arrivati dopo il file e quanto si e' dichiarato dopo. Un carico senza
    // giorno non ha mese e si conta a parte, perche' fingere un mese sarebbe
    // peggio che dirlo.
    const per_mese = contoPerMese(filtrate.map(x => ({ giorno: x.giorno, kg: netto(x), nel_file: x.nel_file, ruolo: x.ruolo, dichiarato_dopo_kg: tolto.get(x) || 0 })));
    const nelFile = filtrate.filter(x => x.nel_file);
    const dopoIlFile = filtrate.filter(x => !x.nel_file);
    const comeImpianto = filtrate.filter(x => x.ruolo === 'imp');
    const comeStoccaggio = filtrate.filter(x => x.ruolo === 'stoc');
    // Le parti del totale: file (il peso che il file scrive) + arrivati dopo -
    // dichiarato dopo - quello che va oltre le righe = totale_kg.
    // dopo_il_file sono i carichi che il file non ha; arrivati_dopo quanti di
    // loro sono arrivati al sito dopo il giorno del file: se sono tutti, la testa
    // della scheda dice «arrivati dopo», se no «non ancora nel file» (15/10/2026).
    const parti = {
      foto_del: foto || null,
      nel_file: { ordini: nelFile.length, kg: somma(nelFile, x => x.kg) },
      dopo_il_file: { ordini: dopoIlFile.length, kg: somma(dopoIlFile, x => x.kg), arrivati_dopo: dopoIlFile.filter(x => x.dopo).length },
      dichiarato_dopo: { ordini: filtrate.filter(x => tolto.has(x)).length, kg: somma(filtrate, x => tolto.get(x) || 0) },
      oltre_kg: Math.round(oltreNellElenco),
      imp: { ordini: comeImpianto.length, kg: somma(comeImpianto, netto) - Math.round(oltreNellElenco) },
      stoc: { ordini: comeStoccaggio.length, kg: somma(comeStoccaggio, netto) },
    };
    // Le righe filtrate col formulario da sistemare, e quelle che il gestionale non
    // colloca in nessun mese: un conteggio della rete, l'unico canale del file.
    const conDate = filtrate.filter(x => x.date.formulari.length);
    const fuori = filtrate.filter(x => x.date.fuori);
    const pagina = tutte ? filtrate.slice(offsetNum) : filtrate.slice(offsetNum, offsetNum + limiteNum);

    // --- La riga di riconciliazione ---
    const nomeDi = (ns) => {
      const g = giacenzeSito.find(x => norm(x.sito) === ns);
      if (g && g.sito) return String(g.sito).trim();
      const x = righeTutte.find(y => y.chiave === ns && y.nome);
      if (x) return x.nome;
      return ns === sitoNorm && sito ? String(sito).trim() : ns;
    };
    const eImpianto = (ns) => righeTutte.some(x => x.chiave === ns && x.ruolo === 'imp')
      || giacenzeSito.some(g => norm(g.sito) === ns && (String(g.tipo_destinazione || '').toLowerCase().trim() || 'imp') !== 'stoc')
      || dopoPerSito.has(ns);
    // La riga di un sito, di TUTTO il sito: i filtri dell'elenco non la cambiano.
    const rigaDelSitoSola = (ns) => {
      const sue = righeTutte.filter(x => x.chiave === ns && dellAnnoDeiCarichi(x));
      const fileImp = sue.filter(x => x.nel_file && x.ruolo === 'imp');
      const stoc = sue.filter(x => x.ruolo === 'stoc');
      const stoccaggio = stoc.length ? { ordini: stoc.length, kg: somma(stoc, x => x.kg) } : null;
      const nome = nomeDi(ns);
      // Solo stoccaggio: niente lo dice impianto (righe da dichiarare, carichi, la
      // scheda dei siti). Dal pulsante di un impianto (ruolo 'imp') e' un impianto
      // anche senza righe: su un anno passato i suoi ordini possono essere zero.
      if (!eImpianto(ns) && !(ns === sitoNorm && ruoloChiesto === 'imp')) return { foto_del: foto || null, sito: nome, solo_stoccaggio: true, stoccaggio };
      if (nonDichiaraRete.has(ns)) return { foto_del: foto || null, sito: nome, non_dovuta: true, file_ordini: fileImp.length, file_kg: somma(fileImp, x => x.kg), stoccaggio };
      const tuttiAggiunti = carichi.di(ns);
      const ordini = carichiDel === null ? tuttiAggiunti.ordini : tuttiAggiunti.ordini.filter(o => nellAttesaDellAnno(o.fine_trasporto, carichiDel, annoDiOggi));
      const aggiunti = { n: ordini.length, kg: ordini.reduce((s, o) => s + o.kg, 0), ordini };
      const base = riconciliazioneDaDichiarare({ foto, fileOrdini: fileImp.length, fileKg: somma(fileImp, x => x.kg), aggiunti, dichiaratoDopoKg: carichiDel === null ? (dopoPerSito.get(ns) || 0) : 0 });
      const diche = { sito: nome, chiave: ns, stoccaggio, oltre_kg: Math.round(oltre.get(ns) || 0) };
      // Gli ordini di un anno passato: file + carichi non ancora nel file = il
      // pulsante di quell'anno. Niente giacenza (null): e' la lettura del 31/12.
      if (carichiDel !== null) return { ...base, ...diche, carichi_del: carichiDel, dichiarato_dopo_kg: null, giacenza_kg: null };
      return { ...base, ...diche };
    };
    // UN SITO PORTATO DALL'ANNO PRIMA LO DICE (revisione del 15/10/2026;
    // decisione dell'utente del 15/10/2026, D3): finche' la riga dell'anno non
    // c'e', «dichiara la rete» viene dall'anno prima, da confermare sul
    // contratto. La riga di riconciliazione lo porta, come le Giacenze e le
    // Dichiarazioni.
    const rigaDelSito = (ns) => {
      const x = rigaDelSitoSola(ns);
      const p = giacenzeSito.find(g => norm(g.sito) === ns && g.portata_dal);
      return p ? { ...x, portata_dal: p.portata_dal, nota_portata: p.nota_portata } : x;
    };
    let riconciliazione = null;
    let riconciliazione_siti = null;
    if (sitoNorm && ruoloChiesto !== 'stoc') {
      if (!foto) riconciliazione = { senza_fotografia: true };
      else if (erroreCarichi) riconciliazione = { errore: erroreCarichi };
      else {
        riconciliazione = rigaDelSito(sitoNorm);
        // Quello che l'elenco filtrato ne mostra, come impianto: con l'anno o la
        // provincia scelti e' una parte, e la riga lo dice.
        if (!riconciliazione.solo_stoccaggio) {
          const mostrate = comeImpianto.filter(x => x.chiave === sitoNorm);
          riconciliazione.elenco = { ordini: mostrate.length, kg: somma(mostrate, netto) - (conFiltri ? 0 : Math.round(oltre.get(sitoNorm) || 0)) };
          riconciliazione.filtri = conFiltri;
        }
        // Chiesto il solo impianto, la parte dello stoccaggio non si dice.
        if (ruoloChiesto === 'imp') riconciliazione.stoccaggio = null;
      }
    } else if (!sitoNorm && ruoloChiesto !== 'stoc') {
      if (!foto) riconciliazione_siti = { senza_fotografia: true };
      else if (erroreCarichi) riconciliazione_siti = { errore: erroreCarichi };
      else {
        const chiavi = new Set([
          ...righeTutte.map(x => x.chiave),
          ...giacenzeSito.map(g => norm(g.sito)),
          ...dopoPerSito.keys(),
        ].filter(Boolean));
        // Un piazzale che non ha niente nel file non ha niente da dire.
        const righe = [...chiavi].map(rigaDelSito).filter(x => !x.solo_stoccaggio || x.stoccaggio).sort((a, b) => String(a.sito).localeCompare(String(b.sito), 'it', { sensitivity: 'base' }));
        const impianti = righe.filter(x => !x.solo_stoccaggio).map(({ stoccaggio: _s, ...x }) => x);
        const stoccaggi = righe.filter(x => x.stoccaggio).map(x => ({ sito: x.sito, ordini: x.stoccaggio.ordini, kg: x.stoccaggio.kg }));
        const contati = impianti.filter(x => !x.non_dovuta);
        riconciliazione_siti = {
          foto_del: foto,
          carichi_del: carichiDel,
          impianti,
          stoccaggi,
          // La somma delle giacenze di rete degli impianti: il totale «come
          // impianto» dell'elenco senza filtri. Su un anno passato non c'e'.
          giacenza_kg: carichiDel === null ? contati.reduce((s, x) => s + x.giacenza_kg, 0) : null,
          ordini_pulsante: impianti.reduce((s, x) => s + (x.non_dovuta ? x.file_ordini : x.ordini_pulsante), 0),
        };
      }
    }

    const righe = pagina.map(x => {
      const r = x.r || (x.carico && x.carico.r) || {};
      const via = tolto.get(x) || 0;
      const secondaria = !x.nel_file && x.carico.tipo === 'secondaria';
      const base = x.nel_file ? {
        ordine_primaria: r.ordine_primaria || '',
        ordine_secondaria: r.ordine_secondaria || '',
        numero_fir: r.numero_fir || '',
        fine_trasporto: x.fine || null,
        // Solo da mostrare: non decide nulla.
        data_chiusura: r.data_chiusura || null,
        punto_di_raccolta: r.punto_di_raccolta || '',
        destinazione: r.destinazione || '',
        destinazione_secondaria: r.destinazione_secondaria || '',
        // La fine trasporto che il portale scrive, quando al formulario della primaria manca.
        fine_a_portale: x.date.fine_a_portale || null,
        // Il file non scrive la fine trasporto e questa e' quella del gestionale.
        fine_dal_gestionale: !!x.date.fine_dal_gestionale,
      } : {
        // Un carico che il file non ha ancora: i dati sono quelli del formulario
        // nel gestionale. Una secondaria si scrive come le righe del file passate
        // da uno stoccaggio: la destinazione e' il piazzale, «trasferito a»
        // l'impianto.
        ordine_primaria: secondaria ? '' : (r.id_ordine || ''),
        ordine_secondaria: secondaria ? (r.id_ordine || '') : '',
        numero_fir: r.numero_fir || '',
        fine_trasporto: x.giorno || null,
        data_chiusura: null,
        punto_di_raccolta: secondaria ? '' : (r.punto_di_raccolta || ''),
        destinazione: secondaria ? (r.stoccaggio || '') : (r.destinazione || ''),
        destinazione_secondaria: secondaria ? (r.destinazione || '') : '',
        fine_a_portale: null,
        fine_dal_gestionale: false,
        carico: { tipo: x.carico.tipo, da: secondaria ? (r.stoccaggio || '') : (r.trasportatore || '') },
      };
      return {
        ...base,
        comune: r.comune || '',
        provincia: r.provincia || '',
        prodotto: r.prodotto || '',
        cer: r.cer || '',
        // Quello che resta da dichiarare: il peso del file, o del formulario, meno
        // il dichiarato dopo il file che il portale ha agganciato a questa riga.
        peso_non_dichiarato_kg: netto(x),
        ...(via ? { peso_del_file_kg: x.kg, dichiarato_dopo_kg: via } : {}),
        trasportatore: r.trasportatore || '',
        // Il giorno in cui il carico e' arrivato al sito: il mese e l'ordine della
        // riga. Per un carico passato da uno stoccaggio e' la fine della secondaria.
        giorno_al_sito: x.giorno || null,
        // Da quanti giorni il carico e' arrivato e aspetta la dichiarazione.
        giorni_attesa: x.giorno ? giorniFra(x.giorno, oggi) : null,
        // Il formulario nel gestionale: le date che mancano o non tornano.
        date_da_sistemare: x.date.formulari,
        fuori_dai_mesi: x.date.fuori,
        ruolo: x.ruolo,
        // Nel file del portale, o arrivato dopo: il file non l'ha ancora.
        nel_file: x.nel_file,
        // Fuori dal file e arrivato al sito dopo il giorno del file: solo allora
        // la riga dice «arrivato dopo il file», se no «non ancora nel file».
        arrivato_dopo_il_file: !x.nel_file && !!x.dopo,
      };
    });

    return Response.json({
      righe,
      totale_righe,
      // Chilogrammi interi.
      totale_kg,
      // Di quali mesi sono gli ordini dell'elenco filtrato, non della pagina.
      per_mese,
      foto_del: foto || null,
      parti,
      // File + carichi non ancora nel file - dichiarato dopo = giacenza (11/10/2026).
      riconciliazione,
      riconciliazione_siti,
      carichi_dopo_il_file: { cercati: servonoICarichi && !erroreCarichi, errore: erroreCarichi || null },
      date_da_sistemare: { n: conDate.length, kg: somma(conDate, netto), fuori_dai_mesi: fuori.length, fuori_dai_mesi_kg: somma(fuori, netto) },
      // Righe del file senza fine trasporto, e quante la prendono dal gestionale.
      senza_fine_a_portale: senzaFineAPortale,
      senza_fine_dal_gestionale: senzaFineDalGestionale,
      siti_distinti: [...sitiSet.values()].sort(),
      province_distinte: [...provinceSet].sort(),
      anni_distinti: [...anniSet].sort((a, b) => a - b),
      limite: tutte ? totale_righe : limiteNum,
      offset: offsetNum
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
