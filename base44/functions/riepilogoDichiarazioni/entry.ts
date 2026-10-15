import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { conBattito } from "../../shared/battito.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { giornoRoma, oggiRoma } from "../../shared/giornoItaliano.ts";
import { eTerminato, eEseguito, periodoMovimento } from "../../shared/movimenti.ts";
import { MESI, operazioneDa, quadratura, leggiDichiarazioni, doppioniDichiarazioni, kgCaricatiDi } from "../../shared/dichiarazioniImpianti.ts";
import { giornoFotografia, ordiniNotiAlPortale, dichiaratoDopoLaFotografia, aperturaDelSito, formulariDaSistemare, avvisoSenzaFine, collocaFotografia, fotoAFineMese, nostraRiga, letturaDelTrentuno as letturaDelTrentunoDi, annoPrimaDelGestionale, PERCHE_ANNO_PRIMA_DEL_GESTIONALE, partenzeDegliStoccaggi, attesaChiusaPerNoi, totaleDellaColonna, PERCHE_SENZA_LETTURA_DEL_TRENTUNO, PERCHE_SENZA_FOTOGRAFIA, sitiDellAnno, arriviDopoLaChiusura, notaSenzaApertura, sitiPortati } from "../../shared/giacenzaPortale.ts";
import { puntiDiPartenza, ancoraDellAnno, dopoLaRilevazione, kgReteDiRilevazione, kgAciDiRilevazione, momentoRilevazione, PERCHE_PIAZZALE_SENZA_LETTURA, PERCHE_PIAZZALE_SENZA_INIZIO, movimentiDopoLaChiusura, rilevazioniDopoLaChiusura, ciSonoFotografieDellaChiusura } from "../../shared/giacenzaStoccaggi.ts";
import { ingressoMovimento, eSecondariaExtra } from "../../shared/ingressoMovimento.ts";
import { carichiNonNelFile } from "../../shared/riconciliazioneDaDichiarare.ts";
import { confrontaConIlPortale } from "../../shared/agganciaDichiarazioni.ts";
import { raccoglitoreUscite, allineaAllaGiacenza, chiudiFraIFlussi } from "../../shared/usciteDichiarate.ts";
import { fotografiaDelGiorno, vociSito, mesiAperti } from "../../shared/indicatoriGiorno.ts";
import { giacenzaAFineMeseDelCanale, copreDellaColonna, agganciDellaRiga, stoccaggioDelSito, raccontoDellaRiga } from "../../shared/storiaDichiarazioni.ts";
import { eAmministratore } from "../../shared/permessi.ts";
import { TIPI_GIACENZE } from "../../shared/registroCaricamenti.ts";
import { controlloCaricamenti } from "../../shared/statoArchivi.ts";

// Dichiarazioni degli impianti, mese per mese, con la quadratura delle giacenze.
//
// Tre regole dell'utente, senza eccezioni (21/09/2026):
// 1. Ogni ragionamento si fa sulla FINE DEL TRASPORTO, mai sulla data di
//    chiusura dell'ordine a portale.
// 2. Ogni caricamento aggiorna tutto: la giacenza a portale non resta ferma al
//    giorno del file degli ordini non dichiarati, ma segue i movimenti caricati
//    dopo, in entrata e in uscita.
// 3. Rete, ACI ed extra raccolta non si mescolano mai: ne' nelle giacenze, ne'
//    nelle dichiarazioni, ne' nei totali.
// E dal 22/09/2026: immissione, inizio e fine trasporto sono obbligatorie nei
// formulari. Un terminato a cui ne manca una, o con le date incoerenti, si
// segnala sull'impianto o sullo stoccaggio a cui arriva o da cui parte, per
// canale. Senza fine trasporto non si colloca in nessun mese e non entra nella
// giacenza calcolata finche' la data non arriva; se il portale lo conosce, nella
// sua giacenza c'e', e la quadratura lo dice (shared/giacenzaPortale.ts).
//
// Chi dichiara e' l'IMPIANTO, perche' e' l'impianto che tratta. Uno stoccaggio
// non tratta: riceve i PFU e li rimanda in secondaria, e in quel viaggio e' il
// PRODUTTORE. La dichiarazione di quello che e' passato da uno stoccaggio si puo'
// chiedere solo dopo il secondo viaggio, e la fa l'impianto che lo ha ricevuto.
// Percio' alle righe da dichiarare di un impianto vanno le primarie arrivate
// all'impianto e le secondarie arrivate dagli stoccaggi, con scritto da quale;
// uno stoccaggio ha entrate, partenze e piazzale, canale per canale. Chi e'
// insieme impianto e stoccaggio (Irigom, T-Cycle) si tiene diviso sul tipo di
// destinazione di ogni movimento.
//
// Payload: { anno }
async function riepilogoDelleDichiarazioni(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const corpo = await req.json().catch(() => ({}));
    const { anno } = corpo;
    // IL GUARDIANO NOTTURNO (10/10/2026). Con registra:true la funzione, oltre a
    // rispondere, lascia scritta la fotografia del giorno: i numeri per sito e
    // l'esito della quadratura. La scrive solo il lavoro notturno, mai
    // l'apertura di una pagina, altrimenti ogni visita riscriverebbe la riga.
    // Scrive solo l'amministratore (chiusura dell'audit, 11/10/2026): il lavoro
    // notturno gira come lui, come il controllo delle qualifiche e gli avvisi dei
    // target; chiunque altro chieda registra riceve la risposta senza scrivere.
    const registraChiesto = corpo.registra === true;
    const registra = registraChiesto && eAmministratore(user);
    // Il lavoro notturno non scrive l'anno negli argomenti: un anno cablato in
    // uno scheduler e' la trappola che scatta il 1° gennaio, quando nessuno si
    // ricorda di cambiarlo e il guardiano continua a controllare l'anno vecchio
    // senza dirlo. Chi chiede dalla pagina lo dice sempre, e allora vale il suo.
    const annoNum = Number(anno) || (registraChiesto ? Number(oggiRoma().slice(0, 4)) : 0);
    if (!annoNum) return Response.json({ error: 'Anno obbligatorio' }, { status: 400 });

    const norm = normalizzaRagioneSociale;
    const td = (v) => String(v || '').toLowerCase().trim();
    const t3 = (v) => Math.round(v * 1000) / 1000;
    const peso = (r) => (Number(r.peso_effettivo) || 0);
    const somma = (mappa, chiave, valore) => mappa.set(chiave, (mappa.get(chiave) || 0) + valore);
    // IL GIORNO ITALIANO DI UNA DATA SI CALCOLA UNA VOLTA PER CHIAMATA (giro della
    // velocita' del 14/10/2026): qui sotto la fine trasporto di una primaria si
    // chiedeva due o tre volte, e quella di ogni riga del report una, sempre
    // passando dal fuso di Roma. Si ricorda il giorno di ogni testo gia' visto;
    // il giorno e' quello di giornoRoma, sempre.
    const giorniLetti = new Map();
    const giornoDi = (v) => {
      if (typeof v !== 'string') return giornoRoma(v);
      let g = giorniLetti.get(v);
      if (g === undefined) { g = giornoRoma(v); giorniLetti.set(v, g); }
      return g;
    };
    // Il mese e l'anno di un movimento sono quelli della fine del trasporto, sul
    // giorno italiano: la regola di tutto il gestionale (shared/movimenti.ts).
    const periodo = (r) => {
      if (!eTerminato(r)) return null;
      const p = periodoMovimento(r);
      return p && p.anno === annoNum ? p : null;
    };
    const CANALI_PORTALE = ['RETE', 'ACI'];
    // I canali su cui si calcola una giacenza: tutti e tre, sempre separati.
    const CANALI_GIACENZA = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];
    // UN ANNO CHIUSO NON SI CONFRONTA COL PORTALE DI OGGI (chiusura dell'audit,
    // 11/10/2026). La calcolata di un anno passato e' quella al 31/12, il
    // portale di adesso no: chi guardava il 2026 a gennaio 2027 - la vista con
    // cui si chiude l'anno - vedeva «da verificare» ogni impianto che dopo il
    // 31/12 aveva ricevuto qualcosa. Per un anno chiuso il confronto si fa con la
    // lettura del 31/12 che la chiusura ha salvato (l'apertura dell'anno dopo per
    // gli impianti, la rilevazione del 31/12 per i piazzali); se non c'e', la
    // quadratura non si fa e la pagina lo dice.
    const annoDiOggi = Number(oggiRoma().slice(0, 4));
    const annoChiuso = annoNum < annoDiOggi;
    const fineAnno = `${annoNum}-12-31`;
    // L'ULTIMO MESE CHE HA GIA' UNA FINE (12/10/2026): fin li' la riga «giacenza a
    // fine mese» del riepilogo ha un numero, dopo «—». Per l'anno in corso e' il
    // mese di oggi, per un anno chiuso dicembre. Serve solo a quella riga.
    const ultimoMeseAnno = annoChiuso ? 11 : annoNum > annoDiOggi ? -1 : Number(oggiRoma().slice(5, 7)) - 1;

    // LA FOTOGRAFIA DEL GIORNO NON SI SCRIVE SU UN ARCHIVIO A META' (chiusura
    // dell'audit, 11/10/2026). Mentre un file si riscrive, o dopo un caricamento
    // interrotto o finito parziale, la quadratura di stanotte direbbe scostamenti
    // che non ci sono - o non vedrebbe quelli veri - e lo storico terrebbe per
    // sempre i numeri di un archivio a meta'. Il guardiano allora non scrive
    // niente e risponde 409 «rinviato», col motivo: la riga di oggi manca, e la
    // dashboard lo dice insieme al caricamento da ripetere. Oltre ai movimenti
    // contano la fotografia del portale e il report delle dichiarazioni
    // (TIPI_GIACENZE). Lo stato si legge prima e dopo aver letto gli archivi;
    // vale solo per chi scrive la fotografia: la pagina legge come prima.
    const scriveLaFotografia = registra && annoNum === annoDiOggi;
    const controllo = scriveLaFotografia
      ? await controlloCaricamenti(base44, 'la fotografia del giorno', TIPI_GIACENZE,
        (motivo) => ({ fotografia: { scritta: false, rinviata: true, motivo } }))
      : null;
    if (controllo && controllo.rinvio) return controllo.rinvio;

    const svc = base44.asServiceRole.entities;
    // Le dichiarazioni dell'anno prima servono a una cosa sola, ma importante:
    // una dichiarazione di dicembre si carica a portale a gennaio, e una di un
    // anno vecchio si puo' segnare caricata in qualunque momento. Se quel
    // caricamento e' successivo alla fotografia degli ordini non dichiarati, il
    // file conta ancora quei chili come giacenza e noi no: e' lo scarto che la
    // pagina deve mostrare. Filtrando per anno quelle righe non si vedevano
    // affatto, e questo modulo diceva un numero diverso dal modulo Giacenze, che
    // le dichiarazioni le legge tutte (audit del 03/10/2026).
    //
    // E «tutte» vuol dire tutte (audit del 10/10/2026). Il 03/10 si era aggiunto
    // l'anno prima, ma una dichiarazione di DUE anni fa caricata oggi scala la
    // giacenza a portale di oggi esattamente come una di quest'anno, e le giacenze
    // la contavano mentre qui no. E guardando un anno passato - a gennaio, quando
    // si chiude il 2026 - le dichiarazioni dell'anno nuovo caricate dopo la
    // fotografia entravano in un modulo e non nell'altro. Qui servono solo a
    // questo conto, quindi si leggono tutte: l'archivio e' piccolo.
    //
    // OGNI ARCHIVIO SI LEGGE UNA VOLTA, E TUTTI INSIEME (giro della velocita' del
    // 14/10/2026, sull'approvazione dell'utente: «per me ok ... sulla velocita'»).
    // Le dichiarazioni mensili si leggevano due volte, quelle dell'anno e tutte:
    // quelle dell'anno ora si prendono da tutte, in memoria, nello stesso ordine
    // (fetchAll ordina tutte e due le letture allo stesso modo, e filtrare non
    // sposta niente). Lo stesso per i siti: quelli dell'anno e, per un anno
    // chiuso, quelli dell'anno dopo vengono da una lettura sola. E il report
    // delle dichiarazioni e le primarie di rete, i due archivi grandi, si
    // leggevano dopo tutti gli altri e una pagina per volta: sette richieste in
    // fila dopo le prime dieci. Ora partono con le altre, a pagine da 5000 in
    // ordine di id (fetchAll, l'ordine in cui perPagina le passava), e si
    // scorrono dopo, nello stesso ordine di prima: chi le segna (il portale che
    // conosce un ordine, le uscite dal report, i carichi non ancora nel file) ha
    // bisogno che il report sia letto tutto prima delle primarie, e cosi' e'.
    // Sui dati veri dell'11/10/2026: 15 richieste invece di 16 sull'anno in
    // corso e 15 invece di 17 su un anno chiuso; le richieste in fila, una dopo
    // l'altra, 4 invece di 8 (le quattro pagine del report). Le risposte sono
    // identiche sul 2026, sul 2025 e sul 2024 (prove/velocitaGiacenze.mjs).
    const [giacenzeSitoTutte, dichiarazioniTutte, aci, extra, secondarie, terziarie, nonDichiarati, rilevazioniLette, reportDichiarazioni, primarieRete] = await Promise.all([
      fetchAll(svc.GiacenzaSito),
      fetchAll(svc.DichiarazioneSito),
      fetchAll(svc.PrimariaAci),
      fetchAll(svc.ExtraRaccolta),
      fetchAll(svc.Secondaria),
      fetchAll(svc.Terziaria),
      fetchAll(svc.OrdineNonDichiarato),
      fetchAll(svc.GiacenzaStoccaggio),
      fetchAll(svc.DichiarazioneTrattamento, null, 'id'),
      fetchAll(svc.PrimariaRete, null, 'id'),
    ]);
    // I siti e le dichiarazioni dell'anno, come li dava il filtro per anno (il
    // campo e' un numero obbligatorio in tutti e due gli archivi).
    // I SITI DELL'ANNO, E QUELLI DELL'ANNO PRIMA CHE LA RIGA NON L'HANNO ANCORA
    // (15/10/2026, prova generale del cambio d'anno, difetti 11 e 12; decisione
    // dell'utente del 15/10/2026, D3): finche' ne' la copia d'anno ne' la
    // chiusura hanno scritto la riga del 2027, un sito del 2026 si porta avanti
    // con ruolo, tipologia e dichiara_rete (sitiDellAnno, la regola delle Giacenze
    // e dell'elenco). Prima le Dichiarazioni del 2027 non elencavano nessun
    // impianto, e Tecnogum, al primo carico, tornava a dichiarare la rete. Un anno
    // prima del gestionale si giudica sulle righe dell'anno sole, come prima.
    const sitiAnno = sitiDellAnno(giacenzeSitoTutte, annoNum, { chiaveDi: norm, annoDiOggi });
    const giacenzeSito = sitiAnno.righe;
    // E lo dice (revisione del 15/10/2026): l'elenco nella risposta, la frase nella nota della notte.
    const portati = sitiPortati(sitiAnno.portate, annoNum);
    // I CARICHI DELL'ANNO CHIUSO ARRIVATI DOPO LA CHIUSURA (15/10/2026, difetto
    // 5): le fotografie e le aperture salvate dalla chiusura si leggono coi
    // carichi finiti a fine dicembre che il portale ha chiuso dopo (le stesse
    // regole delle Giacenze). Solo se una chiusura salvata c'e'.
    const servonoGliArrivi = ciSonoFotografieDellaChiusura(rilevazioniLette) || giacenzeSitoTutte.some(g => g && g.apertura_salvata_il);
    const arriviPiazzali = movimentiDopoLaChiusura();
    const arriviImpianti = arriviDopoLaChiusura();
    if (servonoGliArrivi) {
      for (const [lista, archivio] of [[primarieRete, 'PrimariaRete'], [aci, 'PrimariaAci'], [secondarie, 'Secondaria']]) {
        for (const r of lista) {
          const d = ingressoMovimento(r, archivio, norm);
          arriviPiazzali.segna(r, d);
          arriviImpianti.segna(r, d);
        }
      }
    }
    const rilevazioni = servonoGliArrivi ? rilevazioniDopoLaChiusura(rilevazioniLette, (k) => arriviPiazzali.di(k), norm) : rilevazioniLette;
    const opzioniAperture = { annoPrimaNelGestionale: sitiAnno.haLAnnoPrima, arrivi: (k, c) => arriviImpianti.di(k, c) };
    const dichiarazioni = dichiarazioniTutte.filter(d => d.anno === annoNum);
    // Le aperture dell'anno dopo: per un anno chiuso sono la lettura del 31/12.
    const giacenzeAnnoDopo = annoChiuso ? giacenzeSitoTutte.filter(g => g.anno === annoNum + 1) : [];

    // --- La fotografia del portale ---
    // Il file degli ordini non dichiarati e' una fotografia, del giorno in cui e'
    // stato caricato. Che cosa il portale conosce lo dicono i NUMERI D'ORDINE che
    // compaiono lì o nel report delle dichiarazioni: un carico che il gestionale
    // ha e il portale no - arrivato dopo, o non ancora nel file - si aggiunge alla
    // fotografia, cosi' la giacenza a portale segue ogni caricamento.
    // La regola e' una sola per tutto il gestionale: shared/giacenzaPortale.ts.
    const fotoPortale = giornoFotografia(nonDichiarati);
    const portaleConosce = ordiniNotiAlPortale();
    for (const r of nonDichiarati) portaleConosce.segna(r);
    // Il report delle dichiarazioni: che cosa risulta dichiarato al portale per gli
    // ordini dell'anno (per fine trasporto), e quali ordini il portale conosce.
    // Una dichiarazione che il portale ha agganciato a ordini dell'anno prima non
    // compare qui, quindi una differenza non e' per forza un mese sfuggito. Solo
    // rete: se nel report comparisse una riga ACI, resta fuori.
    const dichiaratoPortale = new Map();
    // Le righe che servono a confrontare i caricamenti del portale con le nostre
    // dichiarazioni mensili: si tengono mentre si scorre, perche' il report non
    // si rilegge due volte (confrontaConIlPortale lavora su queste sole colonne).
    const righeDichiarazione = [];
    // QUANTO DI OGNI MESE IL PORTALE HA GIA' PORTATO VIA (09/10/2026).
    //
    // Il report ha una riga per ordine, con il peso agganciato e il giorno del
    // caricamento: da li' si sa quanto di ogni mese di ARRIVO e' uscito, senza
    // dedurlo. Il mese di un carico passato da uno stoccaggio e' quello in cui la
    // secondaria e' arrivata all'impianto, non la fine trasporto della primaria
    // che il report scrive: la regola sta in shared/usciteDichiarate.ts.
    const fineSecondarie = new Map();
    for (const r of secondarie) {
      const idSec = String(r.id_ordine || '').trim();
      const g = giornoDi(r.trasporto_finito_il);
      if (idSec && g) fineSecondarie.set(idSec, g);
    }
    const uscite = raccoglitoreUscite({ chiaveDi: norm, fineSecondaria: (id) => fineSecondarie.get(id) || '', anno: annoNum });
    // Il report si scorre qui, letto con gli altri archivi (14/10/2026): prima
    // si leggeva qui, una pagina per volta.
    const rigaDelReport = (r) => {
      // Che il portale conosca quell'ordine e' un fatto, chiunque l'abbia
      // dichiarato: si segna prima di qualunque filtro.
      portaleConosce.segna(r, 'dichiarazioni');
      // Il report porta anche le dichiarazioni di altri partner operativi, e a
      // volte sulle nostre stesse destinazioni: non sono roba nostra e non vanno
      // confrontate con le nostre dichiarazioni (utente, 08/10/2026).
      if (!nostraRiga(r)) return;
      righeDichiarazione.push({
        data_dichiarazione: r.data_dichiarazione, fine_trasporto: r.fine_trasporto, prodotto: r.prodotto,
        destinazione: r.destinazione, destinazione_secondaria: r.destinazione_secondaria,
        peso_associato_kg: r.peso_associato_kg,
        granulo_kg: r.granulo_kg, fibre_kg: r.fibre_kg, metallo_kg: r.metallo_kg, cippato_kg: r.cippato_kg, ciabattato_kg: r.ciabattato_kg,
      });
      // Quanto di ogni mese di arrivo questa riga ha portato via: il raccoglitore
      // tiene fuori da se' l'ACI e gli altri anni.
      uscite.segna(r);
      // Il portale lo conosce ma non lo conta piu' in giacenza: per chi non ha
      // la fine trasporto la differenza si dice (22/09/2026).
      if (eAci({ prodotto: r.prodotto }) || !giornoDi(r.fine_trasporto).startsWith(String(annoNum))) return;
      const ns = norm(String(r.destinazione_secondaria || '').trim() || r.destinazione);
      if (!ns) return;
      somma(dichiaratoPortale, ns, Number(r.peso_associato_kg) || 0);
    };
    for (const r of reportDichiarazioni) rigaDelReport(r);

    // I terminati con le date da sistemare, per soggetto e canale (22/09/2026).
    // Si segnano mentre si leggono gli archivi; se il portale li conosce lo si
    // chiede alla fine, quando fotografia e report sono letti tutti.
    const daSistemare = formulariDaSistemare({ anno: annoNum, chiaveDi: norm });
    // Come in calcolaGiacenze: chi non dichiara la rete per accordo non ha una
    // giacenza di rete che il portale tenga per noi, e i suoi carichi non sono
    // 'non ancora nel file'.
    const nonDichiaraRete = new Set(giacenzeSito.filter(g => g.dichiara_rete === false).map(g => norm(g.sito)));
    // Gli stessi, col nome scritto nella scheda dei siti: lo dice l'attesa che per
    // noi e' un giro chiuso (decisioni dell'utente del 13/10/2026).
    const nonDichiaranoNomi = new Map(giacenzeSito.filter(g => g.dichiara_rete === false).map(g => [norm(g.sito), String(g.sito || '').trim()]));
    // UN ANNO PRIMA DEL GESTIONALE (decisioni dell'utente del 13/10/2026): un anno
    // chiuso che qui non e' mai stato aperto, senza siti ne' dichiarazioni. La
    // giacenza calcolata era tutto quello che era arrivato (Irigom 2025: 4.439,08
    // t) e le Giacenze dicevano il portale di oggi (652,84 t). Non si ricostruisce:
    // tutti e due i moduli dicono «—» con lo stesso perche' (annoPrimaDelGestionale).
    const primaDelGestionale = annoPrimaDelGestionale({ anno: annoNum, annoDiOggi, sitiDellAnno: sitiAnno.dellAnno });
    const percheGestionale = primaDelGestionale ? PERCHE_ANNO_PRIMA_DEL_GESTIONALE(annoNum) : null;
    // Le partenze di rete di ogni stoccaggio, verso chi e quando: dicono se
    // l'attesa del portale e' un giro chiuso per noi (attesaChiusaPerNoi). La
    // stessa raccolta delle Giacenze.
    const partenzeStoc = partenzeDegliStoccaggi();
    // I CARICHI CHE LA FOTOGRAFIA NON CONTIENE: LA REGOLA E' UNA, IN
    // shared/riconciliazioneDaDichiarare.ts (revisione della chiusura dell'audit,
    // 11/10/2026). Da inizioAggiunti e di qualunque anno, non solo di quello
    // guardato (revisione del 10/10/2026); solo la rete che arriva all'impianto;
    // non di chi la rete non la dichiara. Qui era riscritta a mano, come nelle
    // Giacenze e nell'elenco «Da dichiarare»: tre copie con lo stesso esito.
    const nonAncora = carichiNonNelFile({ foto: fotoPortale, portaleConosce, chiaveDi: norm, nonDichiaraRete });
    let movimentiFinoAl = '';
    const segnaFine = (r) => { const g = giornoDi(r.trasporto_finito_il); if (g > movimentiFinoAl) movimentiFinoAl = g; };
    // DOVE ENTRA UN MOVIMENTO: chi lo riceve, con che ruolo, su che canale, e per
    // una secondaria da quale piazzale parte. Lo dice shared/ingressoMovimento.ts,
    // lo stesso file che chiedono le Giacenze (chiusura dell'audit, 11/10/2026):
    // qui il tipo di destinazione delle secondarie non si guardava, e i due moduli
    // mettevano lo stesso viaggio in due posti diversi (C2, C9).
    const dove = (r, archivio) => ingressoMovimento(r, archivio, norm);

    // --- Chi riceve, per canale e mese: solo cio' che arriva a un impianto ---
    const conferito = new Map();   // ns|canale|provenienza|mese -> kg
    const daStoccaggi = new Map(); // ns|canale|provenienza|mese -> Map(nome stoccaggio -> kg)
    const aggiungi = (ns, canale, provenienza, mese, kg, stoccaggio = '') => {
      if (!ns || !mese) return;
      const k = `${ns}|${canale}|${provenienza}|${mese}`;
      somma(conferito, k, kg);
      if (stoccaggio) {
        if (!daStoccaggi.has(k)) daStoccaggi.set(k, new Map());
        somma(daStoccaggi.get(k), stoccaggio, kg);
      }
    };
    // Totali dell'anno, sempre per canale: `${ns}|${canale}` -> kg.
    const entrataImp = new Map();   // primarie arrivate all'impianto
    const entrataStoc = new Map();  // primarie arrivate allo stoccaggio
    const secIn = new Map();        // secondarie arrivate all'impianto
    const secOut = new Map();       // secondarie partite dallo stoccaggio
    const terz = new Map();         // terziarie in uscita (non sono un canale)
    let reteTutte = 0;

    // --- Gli stoccaggi: entrate, partenze in secondaria e verso chi ---
    const stoc = new Map(); // ns -> Map(canale -> { entrato: kg[12], uscito: kg[12], verso: Map(nsImpianto -> kg) })
    const canaleStoc = (ns, canale) => {
      if (!stoc.has(ns)) stoc.set(ns, new Map());
      const m = stoc.get(ns);
      // versoMesi: le partenze verso ogni impianto, mese per mese (12/10/2026), per
      // le righe dello stoccaggio di chi e' anche impianto nel riepilogo. Non
      // entrano in nessun conto: verso resta il totale di prima.
      if (!m.has(canale)) m.set(canale, { entrato: new Array(12).fill(0), uscito: new Array(12).fill(0), verso: new Map(), versoMesi: new Map() });
      return m.get(canale);
    };

    // La rilevazione di uno stoccaggio a portale e' per classe: P, M, G1 e G2 sono
    // la rete, la classe 9 e' l'ACI. Si tiene divisa per canale, e dall'ancora
    // dell'anno la giacenza segue i movimenti con la fine del trasporto dopo
    // (24/09/2026: le letture successive sono un riscontro, non la partenza).
    // Quale rilevazione vale e da che giorno lo dice shared/giacenzaStoccaggi.ts,
    // la stessa regola di Giacenze e Predittivita': qui si leggeva solo
    // data_rilevazione, e una rilevazione senza quel campo (che Giacenze data dal
    // giorno in cui e' stata registrata) restava senza giorno, e lo stoccaggio
    // tornava alla giacenza di inizio anno. Un modulo diceva un piazzale e
    // l'altro un altro.
    const rilevazione = new Map(); // ns -> { data, RETE: t, ACI: t }
    for (const [ns, ril] of puntiDiPartenza(rilevazioni, norm)) {
      rilevazione.set(ns, { data: ril.data, RETE: kgReteDiRilevazione(ril.record) / 1000, ACI: kgAciDiRilevazione(ril.record) / 1000 });
    }
    // UN ANNO CHIUSO PARTE DALLA SUA ANCORA, NON DA QUELLA DI OGGI (revisione
    // della chiusura dell'audit, 11/10/2026). L'ancora di oggi e' quella
    // dell'anno dell'ultima lettura: appena l'anno dopo ha una lettura, per il
    // 2026 guardato a gennaio 2027 diventa la rilevazione del 31/12/2026, e
    // portata indietro coi movimenti del 2026 faceva una giacenza di inizio anno
    // costruita apposta per tornare con quella stessa rilevazione. Nappi Sud con
    // 40 t al 31/12/2025, +25 e -10 nel 2026, 60 lette al 31/12/2026: la sera
    // del 31/12 partiva da 40 e la calcolata (55) non quadrava, giusto; dopo una
    // lettura del 15/01/2027 partiva da 45 e quadrava, e le 5 t che il
    // gestionale non ha sparivano. Per un anno chiuso il confronto si fa
    // davvero solo se la calcolata parte dall'ancora di quell'anno.
    // L'anno in corso resta sull'ancora di oggi, quella del numero a portale e
    // delle Giacenze: dal 1 gennaio alla prima lettura dell'anno nuovo e' ancora
    // quella dell'anno prima, e partire dal 31/12 avrebbe fatto «da verificare»
    // ogni piazzale che al 31/12 non tornava, con le Giacenze su un altro numero.
    const ancoraChiuso = new Map(); // ns -> { data, RETE: t, ACI: t }
    // UN ANNO CHIUSO NON SI APRE CON LA LETTURA CHE LO CHIUDE (revisione finale,
    // 11/10/2026). Se un piazzale non ha letture dell'anno prima del 31/12,
    // ancoraDellAnno restituiva proprio la rilevazione del 31/12: la giacenza di
    // inizio anno si ricavava all'indietro dalla lettura con cui poi si confronta,
    // e la quadratura diceva «quadra» per costruzione. E' il 2025 com'e' nei
    // dati: la fotografia del 31/12/2024 non c'e'. Quella lettura si esclude; se
    // non resta niente il piazzale non ha un punto di partenza suo per quell'anno
    // (senzaAncoraChiuso), e il confronto non si fa, dicendolo.
    const senzaAncoraChiuso = new Set();
    if (annoChiuso) {
      const letturePerSito = new Map();
      for (const r of rilevazioni) {
        const k = r && norm(r.sito);
        if (!k) continue;
        if (!letturePerSito.has(k)) letturePerSito.set(k, []);
        letturePerSito.get(k).push(r);
      }
      for (const [ns, letture] of letturePerSito) {
        const a = ancoraDellAnno(letture.filter(l => momentoRilevazione(l) !== fineAnno), annoNum);
        if (a) ancoraChiuso.set(ns, { data: momentoRilevazione(a), RETE: kgReteDiRilevazione(a) / 1000, ACI: kgAciDiRilevazione(a) / 1000 });
        else senzaAncoraChiuso.add(ns);
      }
    }
    const dopoRilevazione = new Map(); // ns|canale -> t (entrate meno partenze finite dopo la rilevazione)
    const movimentoDopo = (ns, canale, r, valore) => {
      // Senza fine trasporto non conta: non si sa se e' prima o dopo (e si segnala).
      const ril = rilevazione.get(ns);
      if (!ril || !dopoLaRilevazione(r, ril.data)) return;
      somma(dopoRilevazione, `${ns}|${canale}`, valore);
    };
    // IL PIAZZALE PARTE DALL'ANCORA, COME IL SUO NUMERO A PORTALE (chiusura
    // dell'audit, 11/10/2026). La calcolata di un piazzale partiva dall'apertura
    // scritta in GiacenzaSito, che nessuno scrive per l'anno nuovo (la chiusura
    // salva la rilevazione del 31/12, non quel campo) e che per l'ACI non ha mai
    // scritto nessuno; il numero a portale invece parte dall'ancora. Dal 2
    // gennaio ogni piazzale sarebbe stato «da verificare» per tutto l'anno, di
    // tutta la sua giacenza. Adesso la base e' una sola, l'ancora: la giacenza a
    // inizio anno e' l'ancora portata al 31/12 dell'anno prima con i movimenti
    // in mezzo, avanti o indietro. Qui si tengono, per piazzale e canale, tutti i
    // movimenti con la fine trasporto, di qualunque anno.
    const movPiazzale = new Map(); // ns|canale -> [{ giorno, kg }] (+ entrate, - partenze)
    const segnaPiazzale = (ns, canale, r, kg) => {
      const giorno = giornoDi(r.trasporto_finito_il);
      if (!ns || !giorno || !CANALI_PORTALE.includes(canale)) return;
      const k = `${ns}|${canale}`;
      if (!movPiazzale.has(k)) movPiazzale.set(k, []);
      movPiazzale.get(k).push({ giorno, kg });
    };
    // Il saldo dei movimenti fra due giorni, estremo sinistro escluso: se `a` viene
    // dopo `b` il conto va all'indietro, col segno cambiato.
    const saldoFra = (ns, canale, a, b) => {
      const lista = movPiazzale.get(`${ns}|${canale}`) || [];
      if (a <= b) return lista.reduce((s, m) => s + (m.giorno > a && m.giorno <= b ? m.kg : 0), 0);
      return -lista.reduce((s, m) => s + (m.giorno > b && m.giorno <= a ? m.kg : 0), 0);
    };

    // Chi sono i siti e con che ruolo si scopre dai formulari, una volta sola.
    const nomi = new Map();    // ns -> nome leggibile
    const ruoliDi = new Map(); // ns -> Set di ruoli ('imp', 'stoc')
    const segnaRuolo = (ns, ruolo) => {
      if (!ruoliDi.has(ns)) ruoliDi.set(ns, new Set());
      ruoliDi.get(ns).add(ruolo);
    };
    const conosci = (ns, nome) => { if (ns && !nomi.has(ns)) nomi.set(ns, nome); };
    for (const g of giacenzeSito) { conosci(norm(g.sito), g.sito); segnaRuolo(norm(g.sito), td(g.tipo_destinazione) || 'imp'); }

    // Il portale scrive nel file degli ordini non dichiarati solo l'ID della
    // primaria: che fosse diretta a uno stoccaggio si sa da qui.
    const ordineTipo = new Map();

    // IL LIMBO: GLI ORDINI "ESEGUITO" CHE NESSUNO HA CHIUSO A PORTALE.
    //
    // Un ordine eseguito ha tutti i dati dentro - peso, formulario, date - ma il
    // pulsante Chiudi non e' stato premuto. Il gestionale conta solo i terminati,
    // quindi quei chili non entrano in nessun conto: non nel raccolto, non nelle
    // giacenze, non negli ingressi di questa pagina. Spariscono in silenzio, ed e'
    // il modo peggiore di perdere un dato, perche' il totale sembra completo.
    //
    // Non si sommano ai terminati, che sarebbe inventare un movimento: si contano
    // a parte e si DICONO, finche' a portale non vengono chiusi (regola scritta in
    // shared/movimenti.ts, eEseguito). Qui si tengono per impianto e per canale,
    // mai sommati fra canali, e con il mese quando la fine trasporto c'e' gia'.
    //
    // L'utente l'ha chiesto il 02/10/2026, dopo il caso di Green Tyre: due ritiri
    // di Torres del 30 settembre, 11.700 kg, che a portale non comparivano ne' fra
    // i dichiarati ne' fra i non dichiarati. La pagina mostrava meno del vero e non
    // diceva perche'.
    const limbo = new Map(); // ns|canale -> Map(ordine -> { id_ordine, numero_fir, kg, mese })
    const segnaLimbo = (sito, canale, r) => {
      const ns = norm(sito);
      if (!ns || !eEseguito(r)) return;
      const chiave = `${ns}|${canale}`;
      if (!limbo.has(chiave)) limbo.set(chiave, new Map());
      const per = limbo.get(chiave);
      const id = String(r.id_ordine || '').trim();
      // Senza numero d'ordine la riga vale da sola: due righe senza id non sono
      // lo stesso ordine solo perche' gli manca lo stesso campo.
      const k = id || `riga-${per.size + 1}`;
      const gia = per.get(k) || { id_ordine: id, numero_fir: String(r.numero_fir || '').trim(), kg: 0, mese: '' };
      gia.kg += peso(r);
      // Il mese e' quello della fine trasporto, come ovunque (regola 1). Un
      // eseguito di solito ce l'ha: e' il Chiudi che manca, non i dati.
      const p = periodoMovimento(r);
      if (p && p.anno === annoNum && !gia.mese) gia.mese = p.mese;
      per.set(k, gia);
    };

    // Una primaria (rete, ACI o extra raccolta): all'impianto o allo stoccaggio.
    // Il canale lo decide il materiale e il ruolo il tipo di destinazione, con la
    // risposta di ingressoMovimento: un formulario senza tipo e' dell'impianto.
    const primaria = (r, archivio) => {
      const d = dove(r, archivio);
      const canale = d.canale;
      const ruolo = d.arrivo ? d.arrivo.ruolo : 'imp';
      const id = String(r.id_ordine || '').trim();
      if (id && !d.senza_tipo) ordineTipo.set(id, ruolo);
      // Prima del periodo: un terminato senza fine trasporto qui sotto esce, ma si segnala.
      daSistemare.segna(r, { tipo: 'primaria', canale, ruolo, verso: 'arrivo', sito: r.destinazione, controparte: r.trasportatore || r.ragione_sociale });
      segnaLimbo(r.destinazione, canale, r);
      if (!eTerminato(r) || !d.arrivo) return null;
      const ns = d.arrivo.chiave;
      if (ruolo === 'stoc') { movimentoDopo(ns, canale, r, peso(r) / 1000); segnaPiazzale(ns, canale, r, peso(r)); }
      const p = periodo(r);
      if (!p) return null;
      conosci(ns, r.destinazione);
      segnaRuolo(ns, ruolo);
      somma(ruolo === 'stoc' ? entrataStoc : entrataImp, `${ns}|${canale}`, peso(r));
      if (ruolo === 'stoc') canaleStoc(ns, canale).entrato[p.mese_idx] += peso(r);
      return { ns, ruolo, p };
    };

    // La fine trasporto delle primarie di rete nel gestionale, per le righe del file
    // del portale che non la scrivono (piu' sotto).
    const fineRete = new Map(); // id_ordine -> giorno
    // Le primarie di rete si scorrono qui, lette con gli altri archivi (14/10/2026).
    const primariaDiRete = (r) => {
      const idRete = String(r.id_ordine || '').trim();
      const giornoRete = eTerminato(r) ? giornoDi(r.trasporto_finito_il) : '';
      if (idRete && giornoRete) fineRete.set(idRete, giornoRete);
      // IL CANALE LO DECIDE IL MATERIALE, NON L'ARCHIVIO IN CUI LA RIGA SI TROVA.
      //
      // E' la regola di tutto il gestionale (shared/canaleSecondaria.ts, eAci), e qui
      // mancava: ogni riga di PrimariaRete veniva contata come rete, classe 9
      // compresa. Le Giacenze invece guardano la classe. Una riga di ACI finita
      // nell'archivio della rete era quindi ACI in un modulo e rete nell'altro, e i
      // due moduli davano due giacenze diverse per lo stesso formulario.
      //
      // All'importazione le righe si smistano gia' per classe (shared/primarie.ts,
      // archivioPrimaria), quindi oggi in archivio non dovrebbero essercene: questa
      // e' la rete di sicurezza, perche' basta una riga per far divergere i due
      // moduli senza che nessuno se ne accorga. I due devono dire gli stessi numeri
      // su tutti e tre i canali (regola dell'utente, 03/10/2026).
      const dr = dove(r, 'PrimariaRete');
      const canaleRiga = dr.canale;
      // Il file degli ordini non dichiarati e' della RETE: una riga di classe 9 non
      // si aggiunge alla fotografia del portale, come gia' fa calcolaGiacenze. Si
      // segna prima del filtro dell'anno: un carico di dicembre arrivato dopo una
      // fotografia di gennaio il file non ce l'ha, qualunque anno si guardi.
      nonAncora.segna(r, 'primaria');
      const c = primaria(r, 'PrimariaRete');
      if (!c) return;
      segnaFine(r);
      if (canaleRiga === 'RETE') reteTutte += peso(r);
      if (c.ruolo === 'stoc') return;
      aggiungi(c.ns, canaleRiga, canaleRiga === 'ACI' ? 'primaria' : '', c.p.mese, peso(r));
    };
    for (const r of primarieRete) primariaDiRete(r);
    for (const r of aci) {
      const c = primaria(r, 'PrimariaAci');
      if (!c || c.ruolo === 'stoc') continue;
      aggiungi(c.ns, 'ACI', 'primaria', c.p.mese, peso(r));
    }
    for (const r of extra) {
      if (eSecondariaExtra(r)) continue; // piu' sotto, con le secondarie
      const c = primaria(r, 'ExtraRaccolta');
      if (!c || c.ruolo === 'stoc') continue;
      aggiungi(c.ns, 'EXTRA_RACCOLTA', '', c.p.mese, peso(r));
    }

    // Una secondaria: lo stoccaggio che la spedisce e' il produttore, e se arriva
    // a un impianto e' l'impianto che la dichiara. Le secondarie di rete e quelle
    // ACI stanno nello stesso archivio e restano su canali separati.
    //
    // UNA SECONDARIA ARRIVA DOVE DICE IL SUO TIPO DI DESTINAZIONE (chiusura
    // dell'audit, 11/10/2026, C2 e C9). Qui il tipo non si guardava e ogni
    // secondaria finiva sull'impianto. Una arrivata al PIAZZALE di un sito che e'
    // anche impianto (come Irigom) stava sul piazzale nelle Giacenze e
    // sull'impianto qui: lo stesso viaggio cambiava l'entrato della quadratura e
    // la giacenza ACI dell'impianto. Una di extra raccolta arrivata a un piazzale
    // puro faceva di quel piazzale un impianto che deve dichiarare. Ora entra nel
    // piazzale che la riceve - nelle entrate del mese e fra i movimenti dopo la
    // rilevazione - come una primaria arrivata li', e non nelle righe da
    // dichiarare di nessuno: si dichiarera' quando ripartira' verso un impianto.
    const secondaria = (r, archivio) => {
      const d = dove(r, archivio);
      partenzeStoc.segna(r, d);
      const canale = d.canale;
      const provenienza = canale === 'ACI' ? 'secondaria' : '';
      const dest = d.arrivo ? d.arrivo.chiave : '';
      const alPiazzale = !!(d.arrivo && d.arrivo.ruolo === 'stoc');
      const daStoc = d.partenza ? d.partenza.chiave : '';
      // Lo stesso formulario arriva a chi lo riceve e parte dallo stoccaggio: si
      // segnala su tutti e due, e nel conteggio per canale vale uno.
      daSistemare.segna(r, { tipo: 'secondaria', canale, ruolo: alPiazzale ? 'stoc' : 'imp', verso: 'arrivo', sito: r.destinazione, controparte: r.stoccaggio });
      daSistemare.segna(r, { tipo: 'secondaria', canale, ruolo: 'stoc', verso: 'partenza', sito: r.stoccaggio, controparte: r.destinazione });
      segnaLimbo(r.destinazione, canale, r);
      if (!dest || !eTerminato(r)) return null;
      movimentoDopo(daStoc, canale, r, -peso(r) / 1000);
      segnaPiazzale(daStoc, canale, r, -peso(r));
      if (alPiazzale) { movimentoDopo(dest, canale, r, peso(r) / 1000); segnaPiazzale(dest, canale, r, peso(r)); }
      const p = periodo(r);
      if (!p) return null;
      conosci(dest, r.destinazione);
      segnaRuolo(dest, alPiazzale ? 'stoc' : 'imp');
      if (alPiazzale) canaleStoc(dest, canale).entrato[p.mese_idx] += peso(r);
      else somma(secIn, `${dest}|${canale}`, peso(r));
      if (daStoc) {
        conosci(daStoc, r.stoccaggio);
        segnaRuolo(daStoc, 'stoc');
        somma(secOut, `${daStoc}|${canale}`, peso(r));
        const c = canaleStoc(daStoc, canale);
        c.uscito[p.mese_idx] += peso(r);
        somma(c.verso, dest, peso(r));
        if (!c.versoMesi.has(dest)) c.versoMesi.set(dest, new Array(12).fill(0));
        c.versoMesi.get(dest)[p.mese_idx] += peso(r);
      }
      if (!alPiazzale) aggiungi(dest, canale, provenienza, p.mese, peso(r), r.stoccaggio || 'stoccaggio non indicato');
      return { dest, daStoc, p };
    };
    for (const r of secondarie) {
      // Nella giacenza a portale dell'impianto entra solo quello che arriva
      // all'impianto: una secondaria al suo piazzale sta sul piazzale (C2), come
      // nelle Giacenze. Lo decide carichiNonNelFile, con ingressoMovimento.
      nonAncora.segna(r, 'secondaria');
      secondaria(r, 'Secondaria');
    }
    for (const r of extra) {
      if (eSecondariaExtra(r)) secondaria(r, 'ExtraRaccolta');
    }
    // Le terziarie partono dall'impianto verso le cementerie: non sono un canale,
    // e il loro gruppo fra le date da sistemare e' TERZIARIE. Qui si segnavano
    // 'RETE' e finivano nel numero della rete, nel gruppo rete dell'impianto e
    // nella quadratura, mentre le Giacenze le tenevano a parte (11/10/2026, C3 e
    // C11): ora il gruppo lo decide formulariDaSistemare, per tutti e due.
    for (const r of terziarie) {
      const d = dove(r, 'Terziaria');
      daSistemare.segna(r, { tipo: 'terziaria', canale: d.canale, ruolo: 'imp', verso: 'partenza', sito: d.partenza ? d.partenza.sito : '', controparte: r.destinazione });
      if (!periodo(r) || !d.partenza) continue;
      somma(terz, d.partenza.chiave, peso(r));
    }

    // UN PIAZZALE CON UNA GIACENZA E' UN SITO DELL'ANNO ANCHE SENZA MOVIMENTI
    // (15/10/2026, prova generale del cambio d'anno, difetto 12). Dal 01/01 al
    // 04/01/2027 Nappi Sud aveva 35,88 t nelle Giacenze e nelle Dichiarazioni non
    // compariva: i siti dell'anno venivano solo dalle righe dell'anno e dai
    // movimenti, e la notte passava da «quadrano (6)» a «quadrano (5)» senza dire
    // perche'. Le Giacenze elencano ogni piazzale con una rilevazione: qui entra
    // chi ha una rilevazione il cui punto di partenza ha una giacenza (rete o ACI
    // diversa da zero). Un piazzale a zero non cambia niente: sul 2026 Green Tyre
    // e GATIM come piazzali restano fuori, come prima. Vale per un anno
    // cominciato: l'anno dopo guardato prima del 1° gennaio resta com'era, come
    // per i siti portati avanti (sitiDellAnno).
    for (const [ns, ril] of rilevazione) {
      if (annoNum > annoDiOggi || !(ril.RETE > 0 || ril.ACI > 0)) continue;
      segnaRuolo(ns, 'stoc');
      const nome = (rilevazioni.find(r => r && norm(r.sito) === ns) || {}).sito;
      conosci(ns, nome || ns);
    }
    // Uno stoccaggio con una giacenza - rilevata a portale o di inizio anno - ha
    // il suo canale anche se quest'anno non si e' mosso niente: la giacenza c'e'.
    for (const [ns, ril] of rilevazione) {
      if (!(ruoliDi.get(ns) || new Set()).has('stoc')) continue;
      for (const canale of CANALI_PORTALE) if (ril[canale] > 0) canaleStoc(ns, canale);
    }
    for (const g of giacenzeSito) {
      if (td(g.tipo_destinazione) !== 'stoc') continue;
      if (Number(g.giacenza_riferimento_t) > 0) canaleStoc(norm(g.sito), 'RETE');
      if (Number(g.giacenza_riferimento_aci_t) > 0) canaleStoc(norm(g.sito), 'ACI');
    }

    // --- Giacenza del portale alla fotografia: conferito non ancora dichiarato ---
    // Le righe del file, sull'impianto e sul giorno in cui il carico e' ARRIVATO:
    // per una primaria passata da uno stoccaggio vale la fine trasporto della
    // secondaria; una secondaria terminata senza fine trasporto non ha un giorno di
    // arrivo, e il carico resta a portale ma in nessun mese (foto_senza_giorno); una
    // riga senza fine trasporto prende quella della primaria nel gestionale, mai la
    // chiusura. La regola sta in shared/giacenzaPortale.ts (collocaFotografia),
    // dove e' provata (prove/giacenzaPortale.mjs), 22/09/2026.
    // L'ATTESA SULLO STOCCAGGIO DI UN ANNO CHE NON E' QUELLO IN CORSO (seconda
    // revisione del 13/10/2026): il file e' di oggi, e sul 2025 la scheda
    // Stoccaggi diceva 146,34 t partite verso Irigom «che il portale aspetta
    // ancora», la Quadratura 860,099 t in attesa su Nappi Sud, tutti carichi del
    // 2026. Su un altro anno l'attesa conta solo i carichi di quell'anno, come le
    // Giacenze (nellAttesaDellAnno); la fotografia degli impianti non cambia.
    const collocata = collocaFotografia(nonDichiarati, {
      chiaveDi: norm,
      ruoloPrimaria: (id) => ordineTipo.get(id) || '',
      secondarie,
      finePrimaria: (id) => fineRete.get(id) || '',
      anno: annoNum,
      annoDiOggi,
    });
    const portale = collocata.portale;           // ns impianto -> t
    const inAttesa = collocata.inAttesa;         // ns stoccaggio -> t gia' partite che il portale attribuisce ancora allo stoccaggio
    const attesaCoppia = collocata.attesaCoppia; // nsStoccaggio|nsImpianto -> t partite e non ancora dichiarate
    // Ancora in attesa di dichiarazione, per mese di arrivo: il mese con il suo
    // anno, cosi' un carico di dicembre dell'anno prima non finisce nel dicembre
    // di quest'anno.
    const nonDichiaratoNel = (ns, i) => collocata.perMese.get(`${ns}|${annoNum}-${String(i + 1).padStart(2, '0')}`) || 0;

    // La giacenza di rete a portale alla fine di ogni mese, per fine trasporto:
    // quello che il file del portale aspetta ancora, piu' i carichi che il file
    // non contiene. Serve a calcolare quanto dichiarare per un mese chiuso (la
    // pratica di Irigom). Le dichiarazioni caricate dopo la fotografia le toglie
    // chi la usa, perche' dipende da quale mese sta dichiarando.
    const fineMese = (ns) => {
      const foto = fotoAFineMese(collocata, ns, annoNum);
      return MESI.map((mese, i) => {
        const fine = `${annoNum}-${String(i + 1).padStart(2, '0')}-31`;
        const aggiunti = nonAncora.di(ns).ordini.filter(x => x.fine_trasporto && x.fine_trasporto <= fine).reduce((s, x) => s + x.kg, 0);
        return { mese, foto_kg: foto[i], aggiunti_kg: Math.round(aggiunti) };
      });
    };

    // --- Dichiarazioni per sito, canale, provenienza e mese ---
    //
    // DUE RIGHE SULLA STESSA CHIAVE NON SI SOVRASCRIVONO PIU' (10/10/2026).
    // Qui c'era una Map.set secca: l'ultima letta vinceva e la prima spariva
    // dai conti senza una parola, mentre le giacenze invece la sommavano. Lo
    // stesso dato, in meno da una parte e in piu' dall'altra.
    //
    // Ora decide la regola (shared/dichiarazioniImpianti.ts): l'extra raccolta
    // si somma, perche' due campagne nello stesso mese sono due cose vere; gli
    // altri canali no, perche' sommare un errore lo nasconderebbe dentro un
    // numero credibile - si tiene la prima e si segna che ce n'e' un'altra.
    //
    // Dall'11/10/2026 le unisce leggiDichiarazioni, la stessa funzione con cui le
    // Giacenze leggono il dichiarato per canale: una regola, scritta una volta,
    // per i due moduli che devono dire gli stessi numeri (C4).
    const perDich = leggiDichiarazioni(dichiarazioni, { anno: annoNum, chiaveDi: norm }).perChiave;
    for (const d of dichiarazioni) {
      const ns = norm(d.sito);
      if (!nomi.has(ns)) { nomi.set(ns, d.sito); segnaRuolo(ns, 'imp'); }
    }
    // I doppioni che ci sono GIA', quelli che nessun controllo vedeva: finche'
    // restano, un mese di rete o di ACI ha due righe e i numeri dipendono da
    // quale modulo si guarda. L'extra raccolta resta fuori: li' e' legittimo.
    const doppioni = doppioniDichiarazioni(dichiarazioni, { anno: annoNum, chiaveDi: norm });
    const dichiarazioneDi = (d) => d && {
      id: d.id, quantita_kg: Number(d.quantita_kg) || 0, caricata_inviata: !!d.caricata_inviata, ricevuta_email: !!d.ricevuta_email,
      ricevuta_il: d.ricevuta_il || '', caricata_il: d.caricata_il || '', note: d.note || '', motivo_assenza: d.motivo_assenza || '',
      granulo_kg: Number(d.granulo_kg) || 0, fibre_kg: Number(d.fibre_kg) || 0, metalli_kg: Number(d.metalli_kg) || 0,
      ciabattato_kg: Number(d.ciabattato_kg) || 0, cippato_kg: Number(d.cippato_kg) || 0, cssc_kg: Number(d.cssc_kg) || 0, altro_kg: Number(d.altro_kg) || 0,
      // QUELLO CHE unisciDichiarazioni HA MESSO INSIEME NON SI PERDE QUI (audit del
      // 10/10/2026). Questa funzione ricostruisce la dichiarazione campo per campo
      // e lasciava fuori i tre che servono quando in un mese ci sono piu' righe:
      // i chili davvero caricati di piu' campagne di extra raccolta (senza, una
      // campagna caricata e una no davano 0 caricato qui e il peso giusto nelle
      // giacenze), le gemelle di un doppione e quante campagne sono.
      ...(typeof d.caricato_kg === 'number' ? { caricato_kg: d.caricato_kg } : {}),
      ...(d.altre && d.altre.length ? { altre: d.altre } : {}),
      ...(d.ripetizioni > 1 ? { ripetizioni: d.ripetizioni } : {}),
    };
    // Gli agganci di ogni riga, per il racconto che si scrive dopo gli stoccaggi.
    const agganciDi = new Map(); // flusso -> agganciDellaRiga(...) o null
    // Di un canale senza apertura, il resto che si conosce (15/10/2026): flusso -> { resta_t, mesi }.
    const conosciutoDi = new Map();
    const flussiDi = (ns, operazione) => {
      const chiavi = new Set();
      for (const k of conferito.keys()) {
        const [sito, canale, provenienza] = k.split('|');
        if (sito === ns) chiavi.add(`${canale}|${provenienza}`);
      }
      for (const k of perDich.keys()) {
        const [sito, canale, provenienza] = k.split('|');
        if (sito === ns) chiavi.add(`${canale}|${provenienza}`);
      }
      // LA CASELLA «DALL'ANNO PRIMA», per rete e ACI (11/10/2026). Entra
      // l'apertura netta, la stessa della giacenza del canale; per la rete esce
      // quello che il report aggancia a carichi degli anni prima con caricamenti
      // venuti dopo la lettura del 31/12, tolte le dichiarazioni dell'anno chiuso
      // caricate dopo quella lettura, che l'apertura netta ha gia' tolto.
      // Sta sulla prima riga del canale; se il canale quest'anno non ha ancora
      // una riga - a gennaio, prima di ogni arrivo - gliene si da' una, perche'
      // la giacenza c'e' e la colonna la deve dire.
      const caselle = new Map(); // canale -> { conferito, uscito, letta, dichiarato_dopo, al }
      for (const canale of CANALI_PORTALE) {
        const ap = apertura(ns, 'imp', canale);
        // Un'apertura mai scritta non ha una casella: la riga del canale e' «—»
        // (15/10/2026, difetto 6), qui sotto. Ma la riga c'e' anche senza arrivi
        // nell'anno (revisione del 15/10/2026): Irigom con 20 t di ACI al
        // 31/12/2026 e la casella ACI della chiusura vuota non aveva nessuna
        // riga ACI, e la pagina non diceva niente della sua ACI, ne' un numero ne'
        // un «—». La giacenza forse c'e', e la colonna deve dire che non si sa.
        if (ap.manca) {
          if (![...chiavi].some(c => c.split('|')[0] === canale)) chiavi.add(canale === 'ACI' ? 'ACI|primaria' : 'RETE|');
          continue;
        }
        const al = (giacenzeDi(ns, 'imp').map(x => String(x.apertura_del || '').slice(0, 10)).find(Boolean)) || `${annoNum - 1}-12-31`;
        const dopoKg = Math.round(ap.dichiarato_dopo_t * 1000);
        const usciti = canale === 'RETE' ? Math.max(0, uscite.primaDopo(ns, al) - dopoKg) : 0;
        const casella = { conferito: Math.round(ap.netta_t * 1000), uscito: usciti, letta: Math.round(ap.lorda_t * 1000), dichiarato_dopo: dopoKg, al };
        if (!casella.conferito && !casella.uscito) continue;
        caselle.set(canale, casella);
        if (![...chiavi].some(c => c.split('|')[0] === canale)) chiavi.add(canale === 'ACI' ? 'ACI|primaria' : 'RETE|');
      }
      if (!chiavi.size) chiavi.add('RETE|');
      const ordinate = [...chiavi].sort();
      const conCasella = new Set(CANALI_PORTALE.map(canale => ordinate.find(c => c.split('|')[0] === canale)).filter(Boolean));
      const calcolati = ordinate.map(c => {
        const [canale, provenienza] = c.split('|');
        const grezzi = MESI.map((mese, i) => {
          const chiave = `${ns}|${canale}|${provenienza}|${mese}`;
          const da = daStoccaggi.get(chiave);
          const daStoc = da ? [...da.entries()].map(([stoccaggio, kg]) => ({ stoccaggio, kg: Math.round(kg) })).sort((a, b) => b.kg - a.kg) : [];
          const totale = Math.round(conferito.get(chiave) || 0);
          const dich = perDich.get(chiave) || {};
          const dichiarata = Math.round(Number(dich.quantita_kg) || 0);
          // UNA REGOLA SOLA PER IL CARICATO (chiusura dell'audit, 11/10/2026).
          // Qui si ricalcolava a mano - caricata_inviata ? quantita : 0 - e su due
          // campagne di extra raccolta unite, una caricata e una no, il flag
          // dell'unione e' falso: il mese diceva caricato 0 mentre caricato_kg
          // diceva 300, e la colonna «Da dichiarare» contava come da dichiarare
          // anche la campagna caricata. kgCaricatiDi e' la regola che usano le
          // Giacenze e il dichiarato del flusso.
          const caricatoAPortale = Math.round(kgCaricatiDi(dich));
          // Un mese segnato NON DOVUTA non si deve a nessuno: non entra in cio'
          // che resta da dichiarare. SOLO METALLI invece si': a portale non si
          // carica nulla e il ferro va con la prossima uscita di gomma, quindi
          // quei chili restano da dichiarare (regola dell'utente sul ferro,
          // 02/10/2026).
          // E se il sito la rete non la dichiara per accordo (dichiara_rete falso,
          // oggi Tecnogum), nessun mese di rete e' dovuto, segnato o no. Prima lo era
          // solo gennaio, l'unico segnato a mano: la colonna diceva 1.833,43 t di
          // resto e 1.710,51 da dichiarare sullo stesso flusso (audit 10/10/2026).
          const nonDovuta = dich.motivo_assenza === 'non_dovuta' || (canale === 'RETE' && nonDichiaraRete.has(ns));
          return {
            mese,
            conferito_kg: totale,
            // QUANTO DI QUEL MESE E' STATO DAVVERO CARICATO A PORTALE.
            //
            // E' il dichiarato vero del mese - solo le righe con caricata_inviata
            // - e serve a chi legge la tabella per mettere in fila le due cose:
            // quello che si e' dichiarato e quello che e' entrato. Si calcolava
            // gia' qui e si buttava via, e ogni pezzo di interfaccia se lo
            // ricavava da se' dal flag, con il rischio di leggere quantita_kg
            // nudo - che sulle righe seminate contiene il DA dichiarare, non il
            // dichiarato (06/10/2026).
            caricato_kg: caricatoAPortale,
            // Quanto e' arrivato direttamente e quanto dagli stoccaggi, in secondaria.
            diretto_kg: totale - daStoc.reduce((s, x) => s + x.kg, 0),
            da_stoccaggi: daStoc,
            non_dichiarato_kg: canale === 'RETE' ? Math.round(nonDichiaratoNel(ns, i)) : 0,
            // QUANTO RESTA DA DICHIARARE A PORTALE, DI QUEL MESE.
            //
            // Gli ingressi del mese in quell'impianto, meno quello che per quel
            // mese e' stato DAVVERO CARICATO A PORTALE (regola dell'utente,
            // 01/10/2026: le quantita' ancora da dichiarare sono gli ingressi del
            // mese in quello specifico impianto).
            //
            // SI SOTTRAE SOLO IL CARICATO, non tutto quello che e' scritto nel
            // campo quantita'. Lo dice l'entita' stessa, su caricata_inviata:
            // «Solo i mesi con questo flag true concorrono a decurtare la
            // giacenza». Qui si sottraeva comunque, e il 02/10/2026 l'utente ha
            // segnalato il risultato: su GREEN TYRE settembre - mese in cui a
            // portale non e' stato dichiarato niente - il gestionale mostrava
            // 105.740 kg come gia' dichiarati, e su Gatim settembre, invece dei
            // 122.170 kg che il portale aspetta, ne mostrava 17.940.
            //
            // Quei numeri vengono dalle righe di DichiarazioneSito seminate il
            // 12/09/2026 (seedGiacenze2026): per i mesi non ancora dichiarati
            // portano in quantita_kg il quantitativo DA dichiarare a quella data,
            // con caricata_inviata false. Scritte nel campo che tutto il modulo
            // legge come «quanto l'impianto ha dichiarato».
            //
            // E risolve da se' la regola del ferro (utente, 02/10/2026): le uscite
            // di ferro si gestiscono fuori dal portale, quindi non sono mai
            // caricate, quindi non decurtano niente. Non c'e' da sommarle: basta
            // non sottrarle.
            //
            // IL 09/10/2026 LA REGOLA SI E' FATTA PIU' PRECISA, non diversa. Gli
            // ingressi del mese restano l'unita' di conto, ma il dichiarato da
            // sottrarre non e' quello scritto su quel mese: e' quello che il
            // portale ha agganciato a QUEI carichi, e che puo' essere arrivato con
            // la dichiarazione di un mese dopo. Lo dice il report, ordine per
            // ordine (shared/usciteDichiarate.ts), e si calcola sotto, quando i
            // dodici mesi sono tutti in mano.
            non_dovuta: nonDovuta,
            // La dichiarazione che c'e' ma non e' ancora a portale non si perde:
            // e' un'altra cosa dal non averla, e la casella lo dice.
            dichiarato_non_caricato_kg: dichiarata - caricatoAPortale,
            dichiarazione: dichiarazioneDi(perDich.get(chiave) || null),
          };
        });
        // QUANTO DI OGNI MESE E' USCITO, E QUANTO NE RESTA.
        //
        // Il report del portale dice, mese di arrivo per mese di arrivo, quanto
        // e' stato agganciato a una dichiarazione: e' un dato, non una stima. Il
        // conto si chiude sulla giacenza del canale - apertura + entrato -
        // dichiarato e caricato - che e' lo stesso numero della colonna «Da
        // dichiarare» e della quadratura col portale: cosi' la riga non puo' piu'
        // dire due cose diverse (il caso T-Cycle del 09/10/2026: 532,68 t nelle
        // caselle contro 352,94 t nella colonna).
        //
        // Il report e' quello della RETE: per ACI ed extra raccolta non c'e'
        // nessun aggancio pubblicato, e il mese parte dal suo dichiarato.
        //
        // DAL 11/10/2026 IL CONTO SI CHIUDE SULLA GIACENZA SU TUTTI E TRE I CANALI,
        // con la casella dall'anno prima in testa. Prima solo la rete diretta lo
        // faceva, e senza l'apertura: per ACI ed extra la colonna era la somma dei
        // mesi e non la giacenza (due campagne extra, una caricata: 0,5 contro
        // 0,2), e un'apertura ACI non stava in nessun mese.
        const reteDiretta = canale === 'RETE' && !provenienza;
        const dalReport = reteDiretta ? uscite.per(ns) : null;
        // SE IL REPORT CONOSCE L'IMPIANTO, I MESI VENGONO DAL REPORT, ANCHE QUANDO
        // HA SOLO AGGANCI A CARICHI DEGLI ANNI PRIMA (revisione della chiusura
        // dell'audit, 11/10/2026). Le prime navi del 2027 di Irigom il portale le aggancia ai
        // carichi di novembre e dicembre 2026: il report ha l'impianto solo con
        // righe dell'anno prima, che escono dalla casella. Qui si ripartiva allora
        // dal dichiarato del mese, e la stessa nave usciva due volte, dalla casella
        // e dal suo mese: con 600 t di apertura e una nave di 300 t a febbraio la
        // riga faceva 600 t contro una giacenza di 900, e la pagina scriveva «a
        // portale risultano dichiarati 300.000 kg in piu'». Il report dice che di
        // quest'anno non e' uscito ancora niente; quello che non ha ancora visto
        // lo chiude la giacenza, dal carico piu' vecchio, come fa il portale.
        const semi = dalReport
          ? dalReport.mesi
          : grezzi.map(m => Math.min(m.conferito_kg, m.caricato_kg));
        const casella = conCasella.has(c) ? caselle.get(canale) || null : null;
        const aperturaKg = casella ? casella.conferito : 0;
        const conferitoKg = grezzi.reduce((s, m) => s + m.conferito_kg, 0);
        const caricatoKg = grezzi.reduce((s, m) => s + m.caricato_kg, 0);
        const allineato = allineaAllaGiacenza(
          grezzi.map(m => m.conferito_kg),
          semi,
          aperturaKg + conferitoKg - caricatoKg,
          casella ? { conferito: casella.conferito, uscito: reteDiretta ? casella.uscito : 0 } : null,
        );
        return { c, canale, provenienza, grezzi, dalReport, casella, allineato };
      });
      // Un canale con piu' righe (l'ACI: primaria e secondaria) si chiude sul
      // canale: quello che una riga non assorbe esce dalle altre (chiudiFraIFlussi).
      for (const canale of CANALI_GIACENZA) {
        const suoi = calcolati.filter(x => x.canale === canale);
        if (suoi.length < 2) continue;
        chiudiFraIFlussi(suoi.map(x => x.allineato)).forEach((a, i) => { suoi[i].allineato = a; });
      }
      // LA GIACENZA A FINE MESE SI CHIUDE SUL CANALE, COME IL «DA DICHIARARE»
      // (revisione del 13/10/2026). Contata riga per riga, sull'ACI a due righe
      // una dichiarazione scritta sulla provenienza sbagliata dava -1.800 kg su una
      // riga e +1.800 sull'altra fino a ottobre, mentre la colonna diceva 0 su
      // tutte e due. Ora ogni fine mese passa dalla stessa chiusura delle righe del
      // canale (giacenzaAFineMeseDelCanale): con una riga sola e' il conto di
      // prima, numero per numero. Le righe di un canale hanno anche lo stesso
      // ultimo mese: la chiusura di un mese vale solo con tutte le righe dentro.
      const fineDi = new Map(); // calcolato -> { fine, spostato, ultimo }
      for (const canale of CANALI_GIACENZA) {
        const suoi = calcolati.filter(x => x.canale === canale);
        if (!suoi.length) continue;
        let ultimo = ultimoMeseAnno;
        for (const x of suoi) x.grezzi.forEach((m, i) => { if (m.conferito_kg || m.caricato_kg) ultimo = Math.max(ultimo, i); });
        const { fine, spostato } = giacenzaAFineMeseDelCanale(suoi.map(x => ({
          partenzaKg: x.casella ? x.allineato.prima.conferito : 0,
          conferito: x.grezzi.map(m => m.conferito_kg),
          caricato: x.grezzi.map(m => m.caricato_kg),
        })), { ultimoMese: ultimo });
        // La giacenza del canale a fine mese, le righe insieme: serve a dire su
        // ogni riga perche' uno spostamento finisce (revisione finale del
        // 13/10/2026). Solo dove le righe sono piu' d'una.
        const delCanale = suoi.length > 1
          ? MESI.map((_, i) => (fine.some(f => f[i] === null || f[i] === undefined) ? null : fine.reduce((s, f) => s + f[i], 0)))
          : null;
        suoi.forEach((x, k) => fineDi.set(x, { fine: fine[k], spostato: spostato[k], ultimo, canale: delCanale }));
      }
      return calcolati.map((calcolato) => {
        const { canale, provenienza, grezzi, dalReport, casella, allineato } = calcolato;
        const nonDovutaFlusso = canale === 'RETE' && nonDichiaraRete.has(ns);
        // La casella dall'anno prima, se la riga ce l'ha: quanto e' entrato
        // (l'apertura netta), quanto ne e' uscito, quanto ne resta. La lettura del
        // 31/12 e quello che dell'anno chiuso si e' dichiarato dopo si dicono,
        // perche' l'apertura netta si possa rifare a occhio.
        const prima = casella ? {
          conferito_kg: allineato.prima.conferito,
          uscito_kg: allineato.prima.uscito,
          resta_kg: allineato.prima.resta,
          uscito_stimato: allineato.prima.stimato,
          // Quanto il report aggancia agli anni prima oltre l'apertura: non tocca i
          // mesi dell'anno (allineaAllaGiacenza), si dice e basta.
          agganciato_oltre_kg: allineato.prima.oltre_kg || 0,
          da_dichiarare_kg: nonDovutaFlusso ? 0 : allineato.prima.resta,
          letta_kg: casella.letta,
          dichiarato_dopo_kg: casella.dichiarato_dopo,
          al: casella.al,
        } : null;
        const restoPrima = prima ? prima.resta_kg : 0;
        // LA STORIA DELLA RIGA (12/10/2026, richiesta dell'utente sul caso T-Cycle):
        // la giacenza alla fine di ogni mese e gli agganci di ogni dichiarazione
        // caricata, letti dal report. Sono campi in piu', informativi: nessun
        // numero qui sopra li usa, e nessuno di questi entra nei conti
        // (shared/storiaDichiarazioni.ts). La giacenza a fine mese parte dalla
        // casella dall'anno prima e toglie il caricato nella colonna in cui la
        // pagina lo mette; il suo ultimo mese e' la giacenza di oggi. Su un canale
        // con piu' righe e' gia' chiusa sul canale (fineDi, qui sopra).
        const fineCanale = fineDi.get(calcolato);
        const ultimoMese = fineCanale.ultimo;
        const fineMeseKg = nonDovutaFlusso ? MESI.map(() => null) : fineCanale.fine;
        const agganci = dalReport ? agganciDellaRiga({
          caricamenti: dalReport.caricamenti,
          dichiarazioni: grezzi.map((m, i) => ({ idx: i, giorno: giornoRoma(m.dichiarazione && m.dichiarazione.caricata_il), kg: m.caricato_kg })).filter(d => d.kg > 0),
          anno: annoNum,
          lettaIl: casella ? casella.al : `${annoNum - 1}-12-31`,
        }) : null;
        const mesi = grezzi.map((m, i) => ({
          ...m,
          // Di questo mese e' uscito questo, con le dichiarazioni caricate a
          // portale (anche quelle di un altro mese).
          uscito_kg: allineato.uscito[i],
          // E questo c'e' ancora: la parte di quel mese che e' giacenza.
          resta_kg: allineato.resta[i],
          // Una parte dell'uscito e' stata ripartita dal gestionale, perche' il
          // report del portale non ha ancora quella dichiarazione: la casella lo
          // dice invece di farlo passare per un dato letto.
          uscito_stimato: allineato.stimato[i],
          // Un mese non dovuto non resta da dichiarare a nessuno (utente, 02/10/2026).
          da_dichiarare_kg: m.non_dovuta ? 0 : allineato.resta[i],
          // Se in questo mese una dichiarazione e' stata caricata a portale:
          // quali mesi ha portato via. E' il processo che l'utente vuole leggere
          // («con la nave di marzo sono andati via gennaio, febbraio e parte di
          // marzo», 09/10/2026).
          // UNA COPERTURA SOLA PER CASELLA (revisione del 13/10/2026): e' lo stesso
          // aggancio di dichiarazione_copre, nel formato di prima. Era
          // copertureDelCaricamento, un giorno solo: Irigom febbraio, che il
          // portale ha preso in due giorni, diceva 174.400 kg qui e 721.660 nella
          // «i» della stessa casella.
          copre: dalReport ? copreDellaColonna(agganci && agganci.delMese[i]) : null,
          // Quanto resta alla fine di questo mese (null dopo il mese di oggi).
          giacenza_fine_kg: fineMeseKg[i],
          // Quanto di quella giacenza la chiusura sul canale ha spostato da o verso
          // le altre righe dello stesso canale (solo l'ACI ne ha due): c'e' solo
          // dove non e' zero, e dice perche' il numero non e' entrato meno caricato.
          ...(!nonDovutaFlusso && fineCanale.spostato[i] ? { spostato_dal_canale_kg: fineCanale.spostato[i] } : {}),
          // E la giacenza del canale a fine mese, le righe insieme, dove uno
          // spostamento c'e' o e' appena finito: dice se l'altra riga e' ancora
          // in eccesso, cioe' perche' lo spostamento finisce, lo stesso su tutte e
          // due le righe (revisione finale del 13/10/2026). La giacenza della riga
          // da sola non lo dice: la secondaria di Gatim a 0 perche' a settembre
          // aveva dichiarato le sue 1,80 t diceva «non resta niente da cui
          // toglierlo», mentre lo spostamento l'avevano riassorbito gli arrivi
          // della primaria.
          ...(!nonDovutaFlusso && fineCanale.canale && fineCanale.canale[i] !== null && (fineCanale.spostato[i] || (i > 0 && fineCanale.spostato[i - 1]))
            ? { giacenza_canale_fine_kg: fineCanale.canale[i] } : {}),
          // La dichiarazione di questa colonna, che cosa ha coperto (anche quando il
          // portale l'ha presa in due giorni), e chi ha coperto gli arrivi del mese.
          ...(agganci && agganci.delMese[i] ? { dichiarazione_copre: agganci.delMese[i] } : {}),
          ...(agganci && agganci.copertoDa[i].length ? { coperto_da: agganci.copertoDa[i] } : {}),
        }));
        const flusso = {
          canale, provenienza, operazione,
          // Il flusso di rete di chi non la dichiara: si vede quello che arriva, ma
          // un resto da dichiarare non esiste e la pagina scrive «—» col perche'.
          non_dovuta: nonDovutaFlusso,
          // In testa alla riga, prima di gennaio: l'apertura e che fine ha fatto.
          dall_anno_prima: prima,
          mesi,
          // Quello che e' arrivato nell'anno; l'apertura sta a parte, qui accanto.
          conferito_t: t3(mesi.reduce((s, m) => s + m.conferito_kg, 0) / 1000),
          apertura_t: t3((prima ? prima.conferito_kg : 0) / 1000),
          uscito_t: t3((mesi.reduce((s, m) => s + m.uscito_kg, 0) + (prima ? prima.uscito_kg : 0)) / 1000),
          // LA SOMMA DELLA RIGA, CASELLA DALL'ANNO PRIMA COMPRESA: e' la giacenza del
          // canale per costruzione, ed e' il numero della colonna «Da dichiarare».
          resta_t: t3((mesi.reduce((s, m) => s + m.resta_kg, 0) + restoPrima) / 1000),
          // Il report dice agganciato piu' di quanto le nostre dichiarazioni
          // caricate: il portale ha dichiarazioni che il gestionale non ha.
          uscito_oltre_kg: allineato.oltre_kg,
          // Quello che nessun mese riesce ad assorbire: se c'e', c'e' da capire.
          uscito_non_allocato_kg: allineato.non_allocato_kg + allineato.fuori_mese_kg,
          da_dichiarare_t: t3((mesi.reduce((s, m) => s + m.da_dichiarare_kg, 0) + (prima ? prima.da_dichiarare_kg : 0)) / 1000),
          da_stoccaggi_t: t3(mesi.reduce((s, m) => s + m.da_stoccaggi.reduce((x, y) => x + y.kg, 0), 0) / 1000),
          dichiarato_caricato_t: t3(mesi.reduce((s, m) => s + kgCaricatiDi(m.dichiarazione), 0) / 1000),
          dichiarato_totale_t: t3(mesi.reduce((s, m) => s + (m.dichiarazione ? m.dichiarazione.quantita_kg : 0), 0) / 1000),
          // La storia della riga (12/10/2026): da dove parte la giacenza a fine
          // mese, fin dove arriva, che cosa la casella dall'anno prima ha visto
          // uscire e quali caricamenti del portale qui non sono dichiarazioni.
          // Il racconto e lo stoccaggio dello stesso sito si aggiungono piu' sotto,
          // quando gli stoccaggi sono contati.
          giacenza_partenza_kg: nonDovutaFlusso ? null : (prima ? prima.conferito_kg : 0),
          ultimo_mese: ultimoMese,
          ...(agganci && agganci.primaDa.length && prima ? { prima_coperta_da: agganci.primaDa } : {}),
          ...(agganci && agganci.altri.length ? { caricamenti_non_nostri: agganci.altri } : {}),
        };
        // UN ANNO PRIMA DEL GESTIONALE (decisioni dell'utente del 13/10/2026): la
        // giacenza non si ricostruisce, e con lei quello che di ogni mese resta da
        // dichiarare. Sul 2025 dei dati veri la riga di Irigom diceva 0 da
        // dichiarare, la sua giacenza a fine dicembre 4.439,08 t e le Giacenze
        // 652,84: tre numeri, nessuno vero. Ora «—» (null) su tutto quello che e'
        // giacenza, col perche' nel racconto; gli arrivi e le uscite lette dal
        // report restano, perche' sono dati.
        if (primaDelGestionale) {
          flusso.prima_del_gestionale = true;
          flusso.resta_t = null;
          flusso.da_dichiarare_t = null;
          flusso.giacenza_partenza_kg = null;
          if (prima) { prima.resta_kg = null; prima.da_dichiarare_kg = null; }
          for (const m of mesi) {
            m.resta_kg = null;
            m.da_dichiarare_kg = null;
            m.giacenza_fine_kg = null;
            delete m.spostato_dal_canale_kg;
            delete m.giacenza_canale_fine_kg;
          }
        }
        // UN'APERTURA MAI SCRITTA (15/10/2026, prova generale del cambio d'anno,
        // difetto 6): la giacenza del canale e' «—», e con lei quello che di ogni
        // mese resta da dichiarare, perche' il portale aggancia prima i carichi
        // dell'anno prima, che non si conoscono. La riga «Da dichiarare» dice «—»
        // come la giacenza, col perche': mai zero, mai sotto zero.
        //
        // L'ACI TIENE I SUOI MESI (revisione del 15/10/2026). Sull'ACI niente si
        // aggancia: ogni conferimento si dichiara col suo mese, e quello che di un
        // mese dell'anno resta da dichiarare non dipende dall'apertura. Senza i
        // mesi la chiusura del mese diceva «fatto» su 10 t di ACI di febbraio mai
        // dichiarate. Si azzerano solo la casella dall'anno prima, che non si
        // conosce, e quello che la contiene (il resto della riga, la giacenza a
        // fine mese). Sulla rete i mesi dipendono dall'apertura - il portale
        // aggancia prima i carichi dell'anno prima - e restano «—».
        //
        // E IL RESTO CHE SI CONOSCE (revisione del 15/10/2026): quello dei carichi
        // dell'anno, contato senza la casella - il minimo, perche' con l'apertura
        // le dichiarazioni dell'anno andrebbero prima a lei. Non si mostra nella
        // pagina: serve ai numeri del giorno (conosciutoDi, piu' sotto), dove un
        // resto null faceva dire alla chiusura del mese «niente da dichiarare» e
        // alla dashboard 0 t.
        const apCanale = (canale === 'RETE' || canale === 'ACI') && !nonDovutaFlusso && !primaDelGestionale ? apertura(ns, 'imp', canale) : null;
        if (apCanale && apCanale.manca) {
          conosciutoDi.set(flusso, { resta_t: flusso.resta_t, mesi: mesi.map(m => ({ mese: m.mese, da_dichiarare_kg: m.da_dichiarare_kg })) });
          flusso.senza_apertura = true;
          flusso.perche_senza_apertura = apCanale.perche;
          // Il perche' del «—» della riga, dove la pagina lo cerca.
          flusso.perche = apCanale.perche;
          flusso.resta_t = null;
          flusso.da_dichiarare_t = null;
          flusso.giacenza_partenza_kg = null;
          for (const m of mesi) {
            if (canale !== 'ACI') {
              m.resta_kg = null;
              m.da_dichiarare_kg = null;
            }
            m.giacenza_fine_kg = null;
            delete m.spostato_dal_canale_kg;
            delete m.giacenza_canale_fine_kg;
          }
        }
        agganciDi.set(flusso, agganci);
        return flusso;
      });
    };

    // Gli ordini in limbo di un impianto, canale per canale, dal piu' pesante.
    // Mai sommati fra canali (regola 3): ogni voce dice il suo.
    const eseguitiDi = (ns) => [...limbo.entries()]
      .filter(([k]) => k.split('|')[0] === ns)
      .map(([k, per]) => {
        const ordini = [...per.values()].map(o => ({ ...o, kg: Math.round(o.kg) })).sort((a, b) => b.kg - a.kg);
        return {
          canale: k.split('|')[1],
          ordini: ordini.length,
          kg: ordini.reduce((s, o) => s + o.kg, 0),
          mesi: [...new Set(ordini.map(o => o.mese).filter(Boolean))],
          esempi: ordini.slice(0, 20),
        };
      })
      .filter(x => x.ordini > 0)
      .sort((a, b) => b.kg - a.kg);

    const giacenzeDi = (ns, ruolo) => giacenzeSito.filter(x => norm(x.sito) === ns && (td(x.tipo_destinazione) || 'imp') === ruolo);
    // La giacenza al 31/12 dell'anno prima e' della rete; quella ACI, dove c'e',
    // sta nel suo campo. Non si sommano. Un'apertura letta il 31/12 si prende al
    // netto delle dichiarazioni dell'anno chiuso caricate dopo (aperturaNetta,
    // 10/10/2026): lo stesso conto delle Giacenze.
    // Dal 15/10/2026 la regola e' aperturaDelSito, la stessa delle Giacenze: una
    // riga che l'apertura non l'ha mai avuta dice «—» col perche' (manca), e
    // un'apertura salvata dalla chiusura si legge coi carichi di dicembre
    // arrivati dopo (opzioniAperture).
    const apertura = (ns, ruolo, canale) => aperturaDelSito(giacenzeDi(ns, ruolo), canale, dichiarazioniTutte, norm, opzioniAperture);
    const iniziale = (ns, ruolo, canale) => apertura(ns, ruolo, canale).netta_t;
    const kgInT = (mappa, chiave) => t3((mappa.get(chiave) || 0) / 1000);
    const dichiaratoPerCanale = (flussi, canale, soloCaricate = true) => t3(flussi.filter(f => f.canale === canale)
      .reduce((s, f) => s + (soloCaricate ? f.dichiarato_caricato_t : f.dichiarato_totale_t), 0));

    // --- I terminati con le date da sistemare, per soggetto e canale ---
    // Un soggetto che ha solo questo compare lo stesso: e' la cosa da sistemare.
    const datePer = new Map(); // ns|ruolo -> gruppi, uno per canale
    for (const g of daSistemare.gruppi(portaleConosce)) {
      const k = `${g.chiave}|${g.ruolo}`;
      if (!datePer.has(k)) datePer.set(k, []);
      datePer.get(k).push({ ...g, avviso: avvisoSenzaFine(g, 'quadratura') });
      conosci(g.chiave, g.sito);
      segnaRuolo(g.chiave, g.ruolo);
      if (g.ruolo === 'stoc' && !stoc.has(g.chiave)) stoc.set(g.chiave, new Map());
    }
    const dateDi = (ns, ruolo) => datePer.get(`${ns}|${ruolo}`) || [];
    const gruppoDate = (ns, ruolo, canale) => dateDi(ns, ruolo).find(g => g.canale === canale) || null;

    // --- Il portale di un anno chiuso: la lettura del 31/12 (11/10/2026) ---
    // Per un impianto e' l'apertura dell'anno dopo scritta dalla chiusura (col suo
    // giorno, apertura_del): una giacenza di riferimento scritta a mano non e' una
    // lettura. Si prende al netto delle dichiarazioni dell'anno chiuso caricate
    // dopo quel giorno (aperturaNetta), perche' la calcolata dell'anno le toglie
    // gia': la dichiarazione di dicembre si carica a gennaio.
    // La regola sta in shared/giacenzaPortale.ts (letturaDelTrentuno), la stessa
    // con cui ora le Giacenze dicono la giacenza di rete di un anno chiuso
    // (decisioni dell'utente del 13/10/2026): qui era scritta a mano, e le
    // Giacenze su un anno chiuso dicevano il portale di oggi.
    const letturaDelTrentuno = (ns, canale) => letturaDelTrentunoDi(giacenzeAnnoDopo, { chiave: ns, canale, anno: annoNum, dichiarazioni: dichiarazioniTutte, chiaveDi: norm, arrivi: opzioniAperture.arrivi });
    // Per un piazzale e' la rilevazione del 31/12, quella che la chiusura salva:
    // se ce n'e' piu' d'una vale l'ultima registrata, come ovunque.
    const rilevazioneDelTrentuno = (ns) => rilevazioni
      .filter(r => norm(r && r.sito) === ns && momentoRilevazione(r) === fineAnno)
      .sort((a, b) => String(a.created_date || '').localeCompare(String(b.created_date || '')))
      .pop() || null;
    // Un impianto di un anno prima del gestionale non si confronta con niente, e
    // il perche' e' quello delle Giacenze (decisioni dell'utente del
    // 13/10/2026). Un piazzale tiene il suo, lo stesso delle Giacenze: senza una
    // lettura che apra l'anno la giacenza non ha un punto di partenza.
    const quadraturaAnnoChiuso = (letta, senzaInizio = false, impianto = false) => ({
      al: fineAnno,
      lettura: !!letta,
      ...(impianto && primaDelGestionale ? { prima_del_gestionale: true } : {}),
      perche: impianto && primaDelGestionale && !letta ? percheGestionale : senzaInizio
        ? `Il ${annoNum} e' chiuso: per confrontare la giacenza calcolata al 31/12 con la lettura del portale di quel giorno serve la giacenza di inizio anno, cioe' una lettura del 31/12/${annoNum - 1} o una fatta durante il ${annoNum}, e questo piazzale non ce l'ha. Il confronto non si puo' fare: non e' un errore da verificare.`
        : letta
        ? `Il ${annoNum} e' chiuso: la giacenza calcolata al 31/12 si confronta con la lettura del portale di quel giorno, salvata dalla chiusura dell'anno, non con il portale di oggi.`
        : `Il ${annoNum} e' chiuso e la quadratura col portale vale per l'anno in corso: per un anno chiuso il confronto si fa con la lettura del 31/12/${annoNum}, che la chiusura dell'anno non ha salvato. Non e' un errore da verificare.`,
    });

    // --- Gli impianti ---
    // Qui, e solo qui, entrano anche le dichiarazioni dell'anno prima: tutto il
    // resto della pagina e' dell'anno scelto.
    const dichiaratoDopo = dichiaratoDopoLaFotografia(dichiarazioniTutte, fotoPortale, norm);
    const impianti = [...nomi.entries()].filter(([ns]) => (ruoliDi.get(ns) || new Set(['imp'])).has('imp')).map(([ns, nome]) => {
      const ruoli = [...(ruoliDi.get(ns) || new Set(['imp']))].sort();
      const g = giacenzeDi(ns, 'imp')[0] || giacenzeSito.find(x => norm(x.sito) === ns) || null;
      const operazione = operazioneDa(g && g.tipologia_trattamento);
      const flussi = flussiDi(ns, operazione);
      // CON LA FOTOGRAFIA, CHI NON C'E' HA ZERO (10/10/2026). Il file degli ordini non
      // dichiarati e' l'elenco completo dei nostri: un impianto che non ci compare
      // ha dichiarato tutto. Qui diventava «—» e la quadratura non si faceva, mentre
      // le Giacenze dicevano 0: T.R.S., 227,18 t arrivate e 227,18 dichiarate. Senza
      // portale resta solo chi il file non l'ha caricato, o chi per accordo non
      // dichiara la rete (Tecnogum), che ha il suo «—».
      const senzaPortale = !fotoPortale || nonDichiaraRete.has(ns);
      const aggiunti = nonAncora.di(ns).ordini;
      const aggiuntiT = t3(aggiunti.reduce((s, x) => s + x.kg, 0) / 1000);
      // Le dichiarazioni di rete caricate a portale dopo la fotografia: il file le
      // conta ancora come giacenza, il gestionale no.
      const dopoFoto = t3((dichiaratoDopo.get(ns) || 0) / 1000);
      const fotoT = senzaPortale ? null : t3(portale.get(ns) || 0);
      // Un anno chiuso: la lettura del 31/12 al posto del portale di oggi. Chi la
      // rete non la dichiara non ha una giacenza da confrontare, chiuso o no.
      // Un anno prima del gestionale non ha numeri a portale, come nelle Giacenze,
      // che lo guardano prima della lettura del 31/12: la stessa regola.
      const lettura31 = annoChiuso && !primaDelGestionale && !nonDichiaraRete.has(ns) ? letturaDelTrentuno(ns, 'RETE') : null;
      // La quadratura e' della rete: i terminati di rete arrivati senza fine
      // trasporto sono quelli che la giacenza calcolata non puo' contare.
      const dateRete = gruppoDate(ns, 'imp', 'RETE');
      const sito = {
        sito: nome,
        chiave: ns,
        canale: 'RETE',
        ruoli,
        tipo_destinazione: 'imp',
        // Anche stoccaggio: la parte di stoccaggio sta nell'elenco degli stoccaggi.
        anche_stoccaggio: ruoli.includes('stoc'),
        tipologia_trattamento: (g && g.tipologia_trattamento) || '',
        // Chi non ci manda la dichiarazione di rete - perche' quel trattamento non
        // glielo paghiamo - non deve comparire come inadempiente: e' un accordo.
        dichiara_rete: !(g && g.dichiara_rete === false),
        // UN SITO PORTATO DALL'ANNO PRIMA LO DICE (revisione del 15/10/2026;
        // decisione dell'utente del 15/10/2026, D3): finche' la riga dell'anno non
        // c'e', ruolo e «dichiara la rete» vengono dall'anno prima, «da confermare
        // sul contratto». Prima lo sapeva solo la riga interna.
        ...(g && g.portata_dal ? { portata_dal: g.portata_dal, nota_portata: g.nota_portata } : {}),
        operazione,
        giacenza_iniziale_t: iniziale(ns, 'imp', 'RETE'),
        target_primarie_t: t3(giacenzeSito.filter(x => norm(x.sito) === ns).reduce((s, x) => s + (Number(x.target_primarie_t) || 0), 0)),
        // Arrivato all'impianto, canale per canale: primarie dirette e secondarie.
        conferito_t: kgInT(entrataImp, `${ns}|RETE`),
        conferito_aci_t: kgInT(entrataImp, `${ns}|ACI`),
        conferito_extra_t: kgInT(entrataImp, `${ns}|EXTRA_RACCOLTA`),
        secondarie_in_t: kgInT(secIn, `${ns}|RETE`),
        secondarie_aci_in_t: kgInT(secIn, `${ns}|ACI`),
        secondarie_extra_in_t: kgInT(secIn, `${ns}|EXTRA_RACCOLTA`),
        terziarie_out_t: kgInT(terz, ns),
        // Dichiarato, canale per canale: non si sommano.
        dichiarato_caricato_rete_t: dichiaratoPerCanale(flussi, 'RETE'),
        dichiarato_caricato_aci_t: dichiaratoPerCanale(flussi, 'ACI'),
        dichiarato_caricato_extra_t: dichiaratoPerCanale(flussi, 'EXTRA_RACCOLTA'),
        dichiarato_totale_rete_t: dichiaratoPerCanale(flussi, 'RETE', false),
        dichiarato_portale_t: t3((dichiaratoPortale.get(ns) || 0) / 1000),
        // La quadratura e' della rete: entra quello che e' arrivato all'impianto,
        // in primaria e in secondaria, per fine trasporto; lo stoccaggio, se ne ha
        // uno, sta a parte.
        entrato_confronto_t: t3((kgInT(entrataImp, `${ns}|RETE`) + kgInT(secIn, `${ns}|RETE`))),
        uscito_confronto_t: 0,
        // La giacenza a portale: la fotografia, piu' i carichi che il file non
        // contiene ancora, meno le dichiarazioni caricate dopo. Per un anno chiuso
        // la lettura del 31/12, meno quello che dell'anno si e' dichiarato dopo:
        // le stesse tre colonne, con quel giorno al posto della fotografia.
        giacenza_portale_foto_t: annoChiuso ? (lettura31 ? lettura31.letta_t : null) : fotoT,
        aggiunti_alla_foto: annoChiuso ? [] : aggiunti,
        aggiunti_alla_foto_t: annoChiuso ? 0 : aggiuntiT,
        dichiarato_dopo_foto_t: annoChiuso ? (lettura31 ? lettura31.dichiarato_dopo_t : 0) : dopoFoto,
        giacenza_portale_t: annoChiuso
          ? (lettura31 ? lettura31.netta_t : null)
          : (fotoT === null ? null : t3(fotoT + aggiuntiT - dopoFoto)),
        // Di che giorno e' il numero a portale: la fotografia, o il 31/12 di un anno chiuso.
        portale_al: annoChiuso ? (lettura31 ? fineAnno : null) : (senzaPortale ? null : fotoPortale),
        quadratura_anno_chiuso: annoChiuso && !nonDichiaraRete.has(ns) ? quadraturaAnnoChiuso(lettura31, false, true) : null,
        // UN ANNO PRIMA DEL GESTIONALE (decisioni dell'utente del 13/10/2026): la
        // giacenza dei suoi impianti non si ricostruisce, e il sito lo dice.
        ...(primaDelGestionale ? { prima_del_gestionale: true, perche_prima_del_gestionale: percheGestionale } : {}),
        // LA GIACENZA DI TUTTI E TRE I CANALI, SEPARATE (03/10/2026).
        //
        // Stessa formula per tutti - apertura + entrato - dichiarato caricato -
        // perche' i due moduli devono dire gli stessi numeri su tutti i canali e
        // perche' la giacenza E' il residuo da dichiarare. I canali non si sommano
        // mai: tre numeri, uno per riga del riepilogo.
        //
        // L'apertura esiste solo per rete e ACI (GiacenzaSito ha due campi, non
        // tre): per l'extra raccolta si parte da zero, e va detto invece di farlo
        // sembrare un saldo che viene da prima.
        // Solo a portale la fotografia c'e': per ACI ed extra non si confronta
        // niente, perche' a portale quei canali non sono gestiti.
        giacenze_canale: CANALI_GIACENZA.map(canale => {
          const ap = canale === 'EXTRA_RACCOLTA' ? null : apertura(ns, 'imp', canale);
          const apertura_ = ap ? ap.netta_t : 0;
          const entrato = t3(kgInT(entrataImp, `${ns}|${canale}`) + kgInT(secIn, `${ns}|${canale}`));
          const dichiarato = dichiaratoPerCanale(flussi, canale);
          return {
            canale,
            apertura_t: apertura_,
            // Quanto della lettura del 31/12 si e' dichiarato dopo: si vede, non sparisce.
            ...(ap && ap.dichiarato_dopo_t ? { apertura_letta_t: ap.lorda_t, dichiarato_dopo_apertura_t: ap.dichiarato_dopo_t } : {}),
            // E quanto vi e' entrato coi carichi di dicembre arrivati dopo la chiusura (15/10/2026, difetto 5).
            ...(ap && ap.arrivati_dopo ? { apertura_arrivati_dopo: ap.arrivati_dopo, apertura_arrivati_dopo_t: ap.arrivati_dopo_t } : {}),
            entrato_t: entrato,
            dichiarato_caricato_t: dichiarato,
            // LA RETE DI CHI NON LA DICHIARA NON HA UNA GIACENZA (utente, 10/10/2026:
            // «“—” con la spiegazione, in tutti e due i moduli»). Qui valeva 1.833,43 t
            // - tutto quello che e' arrivato, perche' niente si dichiara - e nelle
            // giacenze 0: due numeri per la stessa cosa, e il guardiano notturno
            // sommava questo nello storico della rete, dove era il 53% del totale.
            ...(canale === 'RETE' && nonDichiaraRete.has(ns)
              ? { giacenza_t: null, negativa: false, non_dovuta: true, perche: "Per accordo questo impianto non ci dichiara la rete: il trattamento non e' a nostro carico, il portale non tiene per noi una giacenza di rete e niente resta da dichiarare. Quello che e' arrivato si vede, una giacenza da dichiarare non c'e'." }
              // UN ANNO PRIMA DEL GESTIONALE (decisioni dell'utente del 13/10/2026):
              // senza l'apertura e senza le dichiarazioni dell'anno qui valeva tutto
              // l'arrivato (Irigom 2025: 4.439,08 t), e le Giacenze il portale di
              // oggi (652,84 t). Non si ricostruisce: «—» su tutti e tre i canali,
              // col perche' delle Giacenze.
              : primaDelGestionale
              ? { giacenza_t: null, negativa: false, prima_del_gestionale: true, perche: percheGestionale }
              // UN'APERTURA MAI SCRITTA (15/10/2026, difetto 6): «—» col perche',
              // le stesse parole delle Giacenze. Mai zero, mai sotto zero.
              : ap && ap.manca
              ? { giacenza_t: null, negativa: false, senza_apertura: true, perche: ap.perche }
              : {
                giacenza_t: t3(apertura_ + entrato - dichiarato),
                // Una giacenza sotto zero non esiste: e' un errore da correggere, e si
                // dice invece di azzerarla (regola dell'utente, 03/10/2026).
                negativa: t3(apertura_ + entrato - dichiarato) < 0,
              }),
            apertura_disponibile: canale !== 'EXTRA_RACCOLTA',
          };
        }),
        portale_fine_mese: senzaPortale ? [] : fineMese(ns),
        // La rilevazione del suo stoccaggio sta a parte (scheda Stoccaggi).
        rilevazione_stoccaggio: ruoli.includes('stoc') && rilevazione.has(ns) ? { RETE: t3(rilevazione.get(ns).RETE), ACI: t3(rilevazione.get(ns).ACI), data: rilevazione.get(ns).data } : null,
        flussi,
        // I terminati arrivati qui o partiti da qui con le date da sistemare, per
        // canale, con l'elenco degli ordini (regola dell'utente, 22/09/2026).
        date_da_sistemare: dateDi(ns, 'imp'),
        // Gli ordini che a portale sono 'eseguito' e non chiusi: i loro chili non
        // sono in nessuna casella, e la pagina lo deve dire.
        eseguiti: eseguitiDi(ns),
        senza_fine_trasporto: dateRete ? dateRete.senza_fine : null,
        avviso_senza_fine: dateRete ? dateRete.avviso : '',
        // I carichi del file del portale senza un giorno di arrivo: nella giacenza a
        // portale ci sono, ma in nessuna giacenza a fine mese (portale_fine_mese).
        foto_senza_giorno: collocata.senzaGiorno.get(ns) || null,
      };
      // Di un anno prima del gestionale anche la giacenza di rete «che ne
      // risulta» non c'e': sarebbe tutto l'arrivato, lo stesso numero tolto qui
      // sopra dalla giacenza del canale (decisioni dell'utente del 13/10/2026).
      const q = quadratura(sito);
      // SENZA L'APERTURA LA CALCOLATA NON C'E' (15/10/2026, difetto 6): con l'anno
      // copiato e la chiusura non ancora salvata ogni impianto ripartiva da zero,
      // e la notte diceva «4 impianti si scostano dal portale: Irigom S.r.l.
      // -652,84 t...». Non si scosta: non si sa. La calcolata e la quadratura
      // sono «—» col perche', e la notte lo dice a parte (notaSenzaApertura).
      const senzaApertura = CANALI_PORTALE.filter(c => !(c === 'RETE' && nonDichiaraRete.has(ns)) && !primaDelGestionale && apertura(ns, 'imp', c).manca);
      const percheRete = senzaApertura.includes('RETE') ? apertura(ns, 'imp', 'RETE').perche : null;
      return {
        ...sito, ...q,
        ...(primaDelGestionale ? { giacenza_calcolata_t: null, scarto_t: null, quadra: null } : {}),
        ...(percheRete ? { giacenza_calcolata_t: null, scarto_t: null, quadra: null, perche_senza_apertura: percheRete } : {}),
        ...(senzaApertura.length ? { senza_apertura: senzaApertura } : {}),
      };
    }).filter(s => s.conferito_t || s.conferito_aci_t || s.conferito_extra_t || s.secondarie_in_t || s.secondarie_aci_in_t || s.secondarie_extra_in_t
      || s.dichiarato_totale_rete_t || s.flussi.some(f => f.dichiarato_totale_t) || s.giacenza_iniziale_t || s.giacenza_portale_t
      // Un'apertura conta anche se e' tutta dichiarata dopo (netta 0, letta 8) o se
      // e' solo ACI: il sito ha una giacenza da cui l'anno parte, e si deve vedere.
      || (s.giacenze_canale || []).some(c => c.apertura_t || c.apertura_letta_t)
      // Un impianto portato avanti dall'anno prima, o con la riga dell'anno, che
      // l'apertura non l'ha ancora: c'e', e dice perche' i suoi numeri sono «—».
      || (s.senza_apertura && s.senza_apertura.length)
      || s.date_da_sistemare.length || s.eseguiti.length)
      .sort((a, b) => (b.conferito_t + b.secondarie_in_t) - (a.conferito_t + a.secondarie_in_t) || a.sito.localeCompare(b.sito));

    // --- Gli stoccaggi: canale per canale ---
    const impianto = new Map(impianti.map(s => [s.chiave, s]));
    const soloStoccaggio = (ns) => { const r = ruoliDi.get(ns); return !!r && r.size === 1 && r.has('stoc'); };
    const stoccaggi = [...stoc.entries()].map(([ns, canali]) => {
      const ril = rilevazione.get(ns);
      const righe = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].filter(c => canali.has(c)).map(canale => {
        const c = canali.get(canale);
        const entrato = c.entrato.reduce((s, x) => s + x, 0);
        const uscito = c.uscito.reduce((s, x) => s + x, 0);
        // In piazzale: dalla rilevazione del portale piu' i movimenti finiti dopo,
        // quando c'e' (l'extra raccolta a portale non c'e'); se no dalla giacenza
        // di inizio anno piu' entrate meno partenze.
        const daRilevazione = ril && ril.data && CANALI_PORTALE.includes(canale) && !senzaAncoraChiuso.has(ns);
        // LA GIACENZA DI INIZIO ANNO DI UN PIAZZALE VIENE DALL'ANCORA (11/10/2026):
        // l'ancora portata al 31/12 dell'anno prima coi movimenti che stanno in
        // mezzo, in avanti o all'indietro. E' la stessa base del numero a portale,
        // quindi calcolata e portale non possono piu' partire da due punti diversi.
        // L'apertura scritta in GiacenzaSito resta solo per chi una rilevazione non
        // ce l'ha.
        // Per un anno chiuso la base e' l'ancora di quell'anno, se c'e' (vedi
        // ancoraChiuso); se no l'ancora di oggi, portata indietro.
        const base = (daRilevazione && ancoraChiuso.get(ns)) || ril;
        const inizio = canale === 'EXTRA_RACCOLTA' ? 0
          : daRilevazione ? t3((Math.round(base[canale] * 1000) + saldoFra(ns, canale, base.data, `${annoNum - 1}-12-31`)) / 1000)
            : iniziale(ns, 'stoc', canale);
        return {
          canale,
          giacenza_iniziale_t: inizio,
          entrato_t: t3(entrato / 1000),
          uscito_t: t3(uscito / 1000),
          saldo_t: t3((entrato - uscito) / 1000),
          // UN PIAZZALE SENZA NESSUNA LETTURA NON HA UNA GIACENZA DI RETE NE' DI ACI
          // (chiusura dell'audit, 11/10/2026, C15): qui era l'apertura scritta piu'
          // il saldo dell'anno, nelle Giacenze 0, nella Predittivita' niente. La
          // regola e' una: la giacenza di un piazzale parte da una lettura del
          // portale, e senza resta null in tutti e due i moduli, col perche'.
          // L'extra raccolta a portale non c'e' e una lettura non la puo' avere:
          // resta entrate meno partenze dell'anno, come nelle Giacenze.
          in_piazzale_t: daRilevazione ? t3(ril[canale] + (dopoRilevazione.get(`${ns}|${canale}`) || 0))
            : CANALI_PORTALE.includes(canale) ? null : t3(inizio + (entrato - uscito) / 1000),
          in_piazzale_da: daRilevazione ? 'rilevazione' : CANALI_PORTALE.includes(canale) ? 'senza_rilevazione' : 'movimenti',
          ...(!daRilevazione && CANALI_PORTALE.includes(canale) ? { in_piazzale_perche: senzaAncoraChiuso.has(ns) ? PERCHE_PIAZZALE_SENZA_INIZIO(annoNum) : PERCHE_PIAZZALE_SENZA_LETTURA } : {}),
          mesi: MESI.map((mese, i) => ({ mese, entrato_kg: Math.round(c.entrato[i]), uscito_kg: Math.round(c.uscito[i]) })),
          verso: [...c.verso.entries()].map(([nsImp, kg]) => {
            const imp = impianto.get(nsImp);
            return {
              impianto: (imp && imp.sito) || nomi.get(nsImp) || nsImp,
              chiave: nsImp,
              t: t3(kg / 1000),
              // Per la rete, quanto di quello partito verso questo impianto il portale
              // aspetta ancora che l'impianto dichiari. Su un anno che non e' quello
              // in corso, dei soli carichi di quell'anno (attesaCoppia, qui sopra).
              in_attesa_t: canale === 'RETE' ? t3(attesaCoppia.get(`${ns}|${nsImp}`) || 0) : null,
              dichiara: canale !== 'RETE' || !imp || imp.dichiara_rete !== false,
              // Le stesse partenze, mese per mese (12/10/2026): solo da leggere.
              mesi_kg: (c.versoMesi.get(nsImp) || new Array(12).fill(0)).map(x => Math.round(x)),
            };
          }).sort((a, b) => b.t - a.t),
        };
      });
      // L'ATTESA CHE PER NOI E' UN GIRO CHIUSO (decisioni dell'utente del
      // 13/10/2026): quanto di quello che il portale attribuisce ancora allo
      // stoccaggio e' partito tutto verso chi la rete non la dichiara a SMOCO
      // (Tecnogum). Il numero del portale resta com'e', per la quadratura; accanto
      // si dice quanto non e' un'attesa da risolvere. La regola e' una,
      // attesaChiusaPerNoi, e la giacenza del piazzale e' la stessa delle
      // Giacenze: quella della riga della rete, zero se il piazzale ha una lettura
      // e la rete non ha righe, null dove le Giacenze non hanno un numero.
      const attesaT = t3(inAttesa.get(ns) || 0);
      const reteQui = righe.find(c => c.canale === 'RETE');
      const attesaChiusa = attesaChiusaPerNoi({
        attesaT, primoArrivo: collocata.primoInAttesa.get(ns) || '', senzaGiorno: collocata.inAttesaSenzaGiorno.has(ns),
        partenze: partenzeStoc.di(ns), nonDichiarano: nonDichiaranoNomi,
        inPiazzaleT: reteQui ? reteQui.in_piazzale_t : (ril && !(annoChiuso && senzaAncoraChiuso.has(ns)) ? 0 : null),
      });
      return {
        sito: nomi.get(ns) || ns,
        chiave: ns,
        anche_impianto: !soloStoccaggio(ns),
        canali: righe,
        rilevazione_il: ril ? ril.data : '',
        in_attesa_portale_t: attesaT,
        // Di quell'attesa, quanto per noi e' chiuso e perche': solo se c'e'.
        ...(attesaChiusa ? { in_attesa_chiusa_t: attesaChiusa.chiusa_t, in_attesa_chiusa_perche: attesaChiusa.perche } : {}),
        // Dichiarazioni registrate sullo stoccaggio: non dovrebbero esserci. Non si
        // cancellano, si mostrano, perche' vanno spostate sull'impianto che ha
        // ricevuto le secondarie.
        dichiarazioni_registrate: soloStoccaggio(ns) ? dichiarazioni
          .filter(d => norm(d.sito) === ns && Number(d.quantita_kg) > 0)
          .map(d => ({ canale: d.canale || 'RETE', provenienza: d.provenienza || '', mese: d.mese, quantita_kg: Number(d.quantita_kg) || 0 })) : [],
        // I terminati arrivati allo stoccaggio o ripartiti con le date da sistemare, per canale.
        date_da_sistemare: dateDi(ns, 'stoc'),
      };
    }).filter(s => s.canali.some(c => c.entrato_t || c.uscito_t || c.giacenza_iniziale_t) || s.dichiarazioni_registrate.length || s.date_da_sistemare.length)
      // In ordine di rete entrata, poi di ACI: i canali non si sommano nemmeno per ordinare.
      .sort((a, b) => {
        const di = (s, k) => (s.canali.find(c => c.canale === k) || { entrato_t: 0 }).entrato_t;
        return di(b, 'RETE') - di(a, 'RETE') || di(b, 'ACI') - di(a, 'ACI') || a.sito.localeCompare(b.sito);
      });

    // IL RACCONTO DI OGNI RIGA, E LO STOCCAGGIO DI CHI E' ANCHE IMPIANTO
    // (12/10/2026, richiesta dell'utente sul caso T-Cycle: «per completezza e
    // memoria storica... un rigo laddove c'e' una situazione come quella di
    // T-CYCLE»). Chi nell'anno ha avuto, sullo stesso canale, anche il ruolo di
    // stoccaggio ha sotto le sue righe quello che e' entrato in stoccaggio, tal
    // quale, e verso chi e' ripartito; e ogni riga ha la sua storia in poche
    // frasi, scritte dai numeri gia' calcolati qui sopra. Sono campi in piu':
    // non entrano nel conferito, nel caricato, nel «Da dichiarare» ne' nei
    // totali, e i canali restano separati.
    const stoccaggioDi = new Map(stoccaggi.map(s => [s.chiave, s]));
    for (const s of impianti) {
      const st = stoccaggioDi.get(s.chiave);
      for (const canale of CANALI_GIACENZA) {
        const suoi = s.flussi.filter(f => f.canale === canale);
        if (!suoi.length) continue;
        const c = st ? st.canali.find(x => x.canale === canale) : null;
        // L'ATTESA DEL PORTALE E' DEL FILE DI OGGI (revisione del 13/10/2026): il
        // numero in attesa sullo stoccaggio non distingue l'anno dei carichi, e
        // sul riepilogo del 2025 la storia di T-Cycle attribuiva a quell'anno
        // 181,299 t di carichi del 2026. Dalla seconda revisione del 13/10/2026
        // su un altro anno il numero e' dei soli carichi di quell'anno (qui
        // sopra, collocaFotografia), lo stesso delle Giacenze, e la frase lo dice.
        const qui = c ? stoccaggioDelSito({
          sito: s.sito, canale,
          entrato: c.mesi.map(m => m.entrato_kg), uscito: c.mesi.map(m => m.uscito_kg),
          verso: c.verso.map(v => ({ impianto: v.impianto, chiave: v.chiave, kg: Math.round(v.t * 1000), dichiara: v.dichiara, mesi_kg: v.mesi_kg })),
          inPiazzaleT: c.in_piazzale_t, inAttesaT: canale === 'RETE' ? st.in_attesa_portale_t : null,
          // Quanto di quell'attesa per noi e' chiuso (decisioni dell'utente del 13/10/2026).
          attesaChiusa: canale === 'RETE' && st.in_attesa_chiusa_t ? { t: st.in_attesa_chiusa_t, perche: st.in_attesa_chiusa_perche } : null,
          annoCarichi: annoNum !== annoDiOggi ? annoNum : null, fotoIl: fotoPortale || '',
        }) : null;
        const ultima = suoi[suoi.length - 1];
        if (qui) ultima.stoccaggio_stesso_sito = qui;
        // Il numero del canale, quello delle Giacenze: per una riga che non e'
        // l'unica del suo canale il racconto dice che lo fanno le righe insieme.
        const gc = (s.giacenze_canale || []).find(x => x.canale === canale);
        const giacenzaCanaleKg = gc && typeof gc.giacenza_t === 'number' ? Math.round(gc.giacenza_t * 1000) : null;
        for (const f of suoi) {
          f.racconto = raccontoDellaRiga({
            anno: annoNum, sito: s.sito, canale, provenienza: f.provenienza, operazione: s.operazione,
            non_dovuta: f.non_dovuta, prima_del_gestionale: !!f.prima_del_gestionale, mesi: f.mesi, dall_anno_prima: f.dall_anno_prima,
            giacenza_fine_mese: f.mesi.map(m => m.giacenza_fine_kg), ultimo_mese: f.ultimo_mese,
            agganci: agganciDi.get(f) || null, stoccaggio: f === ultima ? qui : null,
            righe_del_canale: suoi.length, giacenza_canale_kg: giacenzaCanaleKg,
            // Le altre righe del canale per nome, per dire chi riassorbe uno
            // spostamento (seconda revisione del 13/10/2026).
            altre_provenienze: suoi.filter(x => x !== f).map(x => x.provenienza || ''),
          });
        }
      }
    }

    // La quadratura degli stoccaggi puri, un canale per volta: la loro giacenza a
    // portale e' la rilevazione per classe, aggiornata con i movimenti dopo.
    const righeStoccaggio = stoccaggi.filter(s => !s.anche_impianto).flatMap(s => s.canali
      .filter(c => CANALI_PORTALE.includes(c.canale))
      .map(c => {
        const dateCanale = gruppoDate(s.chiave, 'stoc', c.canale);
        // Un anno chiuso si confronta con la rilevazione del 31/12, non con il
        // piazzale di oggi (11/10/2026).
        // Senza una lettura che apra l'anno chiuso la calcolata non ha un punto di
        // partenza suo: il confronto con il 31/12 non si fa, e si dice.
        const senzaInizio = annoChiuso && senzaAncoraChiuso.has(s.chiave);
        const ril31 = annoChiuso && !senzaInizio ? rilevazioneDelTrentuno(s.chiave) : null;
        const riga = {
          sito: s.sito,
          chiave: `${s.chiave}|${c.canale}`,
          canale: c.canale,
          tipo_destinazione: 'stoc',
          giacenza_iniziale_t: c.giacenza_iniziale_t,
          entrato_confronto_t: c.entrato_t,
          uscito_confronto_t: c.uscito_t,
          dichiarato_caricato_rete_t: 0,
          giacenza_portale_t: annoChiuso
            ? (ril31 ? t3((c.canale === 'ACI' ? kgAciDiRilevazione(ril31) : kgReteDiRilevazione(ril31)) / 1000) : null)
            : (c.in_piazzale_da === 'rilevazione' ? c.in_piazzale_t : null),
          quadratura_anno_chiuso: annoChiuso ? quadraturaAnnoChiuso(ril31, senzaInizio) : null,
          rilevazione_il: annoChiuso ? (ril31 ? fineAnno : '') : s.rilevazione_il,
          // Su un anno che non e' quello in corso, dei soli carichi di quell'anno:
          // lo stesso numero delle Giacenze (seconda revisione del 13/10/2026).
          in_attesa_dichiarazione_t: c.canale === 'RETE' ? s.in_attesa_portale_t : 0,
          // E quanto ne e' per noi un giro chiuso, con le parole delle Giacenze.
          ...(c.canale === 'RETE' && s.in_attesa_chiusa_t ? { in_attesa_chiusa_t: s.in_attesa_chiusa_t, in_attesa_chiusa_perche: s.in_attesa_chiusa_perche } : {}),
          flussi: [],
          date_da_sistemare: dateCanale ? [dateCanale] : [],
          senza_fine_trasporto: dateCanale ? dateCanale.senza_fine : null,
          avviso_senza_fine: dateCanale ? dateCanale.avviso : '',
        };
        return { ...riga, ...quadratura(riga) };
      }));

    const siti = [...impianti, ...righeStoccaggio];
    const confrontabili = siti.filter(x => x.giacenza_portale_t !== null && x.giacenza_portale_t !== undefined);
    const perCanale = (campo) => t3(impianti.reduce((s, x) => s + (x[campo] || 0), 0));
    // IL TOTALE A PORTALE CON UN IMPIANTO SENZA NUMERO NON E' UN TOTALE (revisione
    // del 14/10/2026). Il 2026 guardato il 05/01/2027, prima che la chiusura salvi
    // la lettura del 31/12, aveva tutti gli impianti a «—» e il totale a 0, che in
    // testa alla pagina si leggeva «a portale: 0,00 t». Un impianto che la rete ce
    // la dichiara e non ha il numero a portale manca per uno dei tre motivi delle
    // Giacenze (l'anno prima del gestionale, la lettura del 31/12 che non c'e', il
    // file degli ordini non dichiarati mai caricato): il totale diventa «—» e dice
    // quali impianti e perche', con la regola e le parole delle Giacenze
    // (totaleDellaColonna). Chi la rete non la dichiara non manca. Sui dati veri
    // dell'anno in corso nessun impianto e' senza il numero: niente cambia.
    const percheSenzaPortale = primaDelGestionale ? percheGestionale : annoChiuso ? PERCHE_SENZA_LETTURA_DEL_TRENTUNO(annoNum) : PERCHE_SENZA_FOTOGRAFIA;
    const totalePortale = totaleDellaColonna(impianti.map(x => ({ sito: x.sito, t: x.giacenza_portale_t, perche: nonDichiaraRete.has(x.chiave) ? null : percheSenzaPortale })));
    const dichiaranti = impianti.filter(x => x.dichiara_rete !== false);
    const totaleCalcolata = totaleDellaColonna(dichiaranti.map(x => ({ sito: x.sito, t: x.giacenza_calcolata_t, perche: x.perche_senza_apertura || null })));
    const totaleConfrontabile = totaleDellaColonna(dichiaranti.filter(x => x.giacenza_portale_t !== null).map(x => ({ sito: x.sito, t: x.giacenza_calcolata_t, perche: x.perche_senza_apertura || null })));
    const totali = {
      // Tutte le primarie di rete dell'anno, a impianti e stoccaggi: ogni carico una volta sola.
      conferito_t: t3(reteTutte / 1000),
      // Dichiarato, canale per canale: rete, ACI ed extra raccolta non si sommano.
      dichiarato_caricato_rete_t: perCanale('dichiarato_caricato_rete_t'),
      dichiarato_totale_rete_t: perCanale('dichiarato_totale_rete_t'),
      dichiarato_caricato_aci_t: perCanale('dichiarato_caricato_aci_t'),
      dichiarato_caricato_extra_t: perCanale('dichiarato_caricato_extra_t'),
      dichiarato_portale_t: perCanale('dichiarato_portale_t'),
      // La giacenza degli impianti e' della rete: solo quella si somma qui. E solo
      // di chi la rete ce la dichiara: per Tecnogum era tutto l'arrivato, 1.833,43 t
      // nel numero in testa alla pagina, mentre lo storico e le Giacenze dicono
      // «—» (revisione del 10/10/2026).
      // Di un anno prima del gestionale nessuna delle tre c'e' (decisioni
      // dell'utente del 13/10/2026): null, non la somma di righe vuote, che
      // farebbe zero.
      // Un impianto senza l'apertura (15/10/2026) non ha una calcolata: il totale
      // segue totaleDellaColonna, «—» col perche', mai la somma delle altre.
      giacenza_calcolata_t: primaDelGestionale || totaleCalcolata.t === null ? null : t3(totaleCalcolata.t),
      // Solo gli impianti che a portale una giacenza ce l'hanno.
      giacenza_calcolata_confrontabile_t: primaDelGestionale || totaleConfrontabile.t === null ? null : t3(totaleConfrontabile.t),
      ...(!primaDelGestionale && totaleCalcolata.perche ? { perche_calcolata: totaleCalcolata.perche } : {}),
      giacenza_portale_t: primaDelGestionale || totalePortale.t === null ? null : t3(totalePortale.t),
      // Perche' il totale a portale e' «—», con le parole delle Giacenze; di un anno
      // prima del gestionale lo dice gia' il perche' dell'anno. Solo se c'e'.
      ...(!primaDelGestionale && totalePortale.perche ? { perche_totali: { RETE: totalePortale.perche } } : {}),
      aggiunti_alla_foto_t: perCanale('aggiunti_alla_foto_t'),
      // I conteggi della quadratura, un canale per volta.
      siti_che_quadrano: confrontabili.filter(x => x.canale === 'RETE' && x.quadra === true).length,
      siti_da_quadrare: confrontabili.filter(x => x.canale === 'RETE' && x.quadra === false).length,
      aci_che_quadrano: confrontabili.filter(x => x.canale === 'ACI' && x.quadra === true).length,
      aci_da_quadrare: confrontabili.filter(x => x.canale === 'ACI' && x.quadra === false).length,
      // I formulari terminati con le date da sistemare: un conteggio per canale,
      // ciascun formulario una volta sola, mai un totale dei tre.
      date_da_sistemare: daSistemare.perCanale(portaleConosce),
      // Un anno prima del gestionale, detto una volta con le parole delle Giacenze;
      // sull'anno in corso il campo non c'e', e la risposta resta quella di prima.
      ...(primaDelGestionale ? { prima_del_gestionale: true, perche_prima_del_gestionale: percheGestionale } : {}),
    };

    // LE DICHIARAZIONI CHE IL PORTALE HA E IL GESTIONALE NO.
    //
    // Si calcola a ogni apertura della pagina, non solo quando qualcuno preme
    // «Allinea dal portale»: il 01/10/2026 l'utente ha dichiarato a portale il
    // quantitativo di agosto di un impianto e il gestionale non se n'e'
    // accorto, perche' quel caricamento finiva fra l'arretrato e l'arretrato non
    // si vedeva da nessuna parte.
    const daInserire = confrontaConIlPortale(righeDichiarazione, annoNum, dichiarazioni).da_inserire;

    // La fotografia del giorno: la quadratura rifatta stanotte, e i numeri che
    // fra sei mesi diranno «com'era a ottobre». Una riga per giorno: si
    // riscrive, non si aggiunge. Se non si riesce a scrivere la risposta esce
    // lo stesso - il guardiano e' un servizio in piu', non un ostacolo.
    let fotografia = null;
    // La riga di oggi e' dell'anno in corso: con un altro anno negli argomenti
    // si sarebbe riscritta coi numeri di quell'anno, e lo storico avrebbe detto
    // «com'era oggi» su un anno che oggi non si guarda (annoDiOggi, in testa).
    if (registraChiesto && !registra) {
      fotografia = { scritta: false, motivo: "la fotografia del giorno la scrive solo l'amministratore" };
    } else if (registra && annoNum !== annoDiOggi) {
      fotografia = { scritta: false, motivo: `la fotografia del giorno e' dell'anno in corso (${annoDiOggi}), non del ${annoNum}` };
    } else if (registra) {
      const rinvio = await controllo.dopo();
      if (rinvio) return rinvio;
      const giorno = oggiRoma();
      // GLI IMPIANTI SENZA APERTURA NON SI CONFRONTANO (15/10/2026, difetti 6 e
      // 12): un impianto senza l'apertura del 31/12 non si scosta dal portale e
      // non quadra, perche' la calcolata non c'e'. Si tiene fuori dal conto del
      // confronto (la nota diceva «quadrano (6)» contandolo, o «4 impianti si
      // scostano») e si dice a parte coi nomi; nei numeri del giorno (siti_json)
      // il suo portale resta quello che e'.
      const fuoriConfronto = (s) => Array.isArray(s.senza_apertura) && s.senza_apertura.includes('RETE');
      const riga = fotografiaDelGiorno(siti.map(s => (fuoriConfronto(s) ? { ...s, giacenza_portale_t: null } : s)), { giorno, anno: annoNum, doppioni });
      const senzaApertura = notaSenzaApertura(siti, annoNum);
      if (siti.some(s => Array.isArray(s.senza_apertura) && s.senza_apertura.length)) {
        // Nei numeri del giorno la giacenza di un canale senza apertura e' «—»,
        // non zero.
        //
        // IL RESTO DA DICHIARARE E' QUELLO CHE SI CONOSCE (revisione del
        // 15/10/2026). Qui si scriveva null anche il resto, e chi legge i numeri
        // del giorno lo prendeva per «niente da dichiarare»: la chiusura di
        // dicembre fatta il 10/01/2027, con l'anno copiato e la chiusura del 2026
        // non ancora salvata, diceva «fatto» su Irigom e Alfa con 58 t di gennaio
        // da dichiarare, e la dashboard «da dichiarare: 0 t»; con l'ACI di Irigom
        // senza apertura, 10 t di febbraio mai dichiarate non le vedeva nessuno.
        // Ora il resto e' quello dei carichi dell'anno, contato senza la casella
        // dall'anno prima (conosciutoDi): sull'ACI i mesi sono quelli veri, sulla
        // rete il minimo, perche' con l'apertura le dichiarazioni andrebbero prima
        // a lei. Il canale lo dice (senza_apertura, resta_almeno): quanto resta
        // dell'anno prima non si sa, e la nota della notte lo dice coi nomi.
        const voce = (s) => {
          const v = vociSito(s);
          for (const c of Array.isArray(s.senza_apertura) ? s.senza_apertura : []) {
            if (!v.canali[c]) continue;
            const suoi = (s.flussi || []).filter(f => f && !f.non_dovuta && String(f.canale || 'RETE') === c);
            const resta = suoi.reduce((t, f) => t + (Number((conosciutoDi.get(f) || {}).resta_t) || 0), 0);
            const aperti = mesiAperti(suoi.map(f => (conosciutoDi.has(f) ? { ...f, dall_anno_prima: null, mesi: conosciutoDi.get(f).mesi } : f)));
            v.canali[c] = { ...v.canali[c], giacenza_t: null, senza_apertura: true, resta_almeno: true, resta_t: t3(Math.max(0, resta)) };
            if (aperti) v.canali[c].mesi_aperti = aperti; else delete v.canali[c].mesi_aperti;
          }
          return v;
        };
        riga.siti_json = JSON.stringify(siti.map(voce));
      }
      if (senzaApertura) riga.nota = `${riga.nota} ${senzaApertura}`;
      // E i siti portati dall'anno prima, da confermare (revisione del 15/10/2026, D3).
      if (portati.nota) riga.nota = `${riga.nota} ${portati.nota}`;
      try {
        const gia = await svc.IndicatoreGiorno.filter({ giorno });
        if (gia && gia.length) {
          await svc.IndicatoreGiorno.update(gia[0].id, riga);
          // Un giorno scritto due volte sarebbe due storie dello stesso giorno:
          // i doppioni nati prima di questo controllo si tolgono.
          for (const d of gia.slice(1)) await svc.IndicatoreGiorno.delete(d.id).catch(() => {});
        } else {
          await svc.IndicatoreGiorno.create(riga);
        }
        fotografia = { giorno: riga.giorno, esito: riga.esito, nota: riga.nota, scritta: true };
      } catch (e) {
        fotografia = { giorno, esito: riga.esito, nota: riga.nota, scritta: false, errore: e && e.message ? e.message : String(e) };
      }
    }

    return Response.json({
      anno: annoNum, mesi: MESI, siti, stoccaggi, totali, fotografia, doppioni,
      foto_portale_il: fotoPortale,
      // Un anno chiuso si confronta con la lettura del 31/12, non col portale di oggi.
      anno_chiuso: annoChiuso,
      // Un anno prima del gestionale (decisioni dell'utente del 13/10/2026): la
      // giacenza degli impianti non si ricostruisce, e la pagina lo dice sopra i
      // numeri, con lo stesso perche' delle Giacenze.
      ...(primaDelGestionale ? { prima_del_gestionale: true, perche_prima_del_gestionale: percheGestionale } : {}),
      dichiarazioni_da_inserire: daInserire,
      // Fin dove arrivano i movimenti caricati (fine trasporto): se e' dopo la
      // fotografia, la giacenza a portale e' stata aggiornata con quello che manca.
      movimenti_fino_al: movimentiFinoAl,
      // I siti portati dall'anno prima, da confermare (revisione del 15/10/2026, D3): solo se ci sono.
      ...(portati.elenco.length ? { siti_portati: portati.elenco, nota_siti_portati: portati.nota } : {}),
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}

// IL BATTITO (chiusura dell'audit, 11/10/2026): il giro del guardiano notturno
// lascia il suo esito in EsecuzioneLavoro (shared/battito.ts), anche quando non
// riesce. Solo il giro del guardiano - registra senza anno, come lo chiama il
// workflow -: le pagine che aprono il riepilogo non lasciano niente. La risposta
// resta quella di sopra, e un errore risale com'e'.
export default async function(req) {
  return conBattito(() => conLimiteRichieste(createClientFromRequest(req)), 'riepilogoDichiarazioni', () => riepilogoDelleDichiarazioni(req), req);
}
