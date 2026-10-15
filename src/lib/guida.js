// LA GUIDA DENTRO IL GESTIONALE (14/10/2026).
//
// Proposta all'utente il 14/10/2026 fra le cose da creare - «una guida dentro
// il gestionale per chi non e' amministratore: cosa vede, cosa puo' esportare,
// come apre una richiesta» - e accettata lo stesso giorno («per me ok [...] su
// quanto da creare, procedi pure»).
//
// Qui stanno i testi e la struttura; la pagina (src/pages/Guida.jsx) li mostra
// soltanto. Sono scritti per chi usa il gestionale tutti i giorni, non per chi
// lo programma: frasi brevi, del tu, nessun nome di funzione o di archivio, e
// nessun riferimento alla piattaforma su cui il gestionale gira. Ogni frase e'
// stata controllata sul codice delle pagine e su AGENTS.md: una guida che
// promette un pulsante che non c'e' e' peggio di nessuna guida.
//
// Tre regole tengono la guida viva:
// - ogni voce del menu (src/components/Layout.jsx) ha qui il suo modulo, con lo
//   stesso nome e lo stesso percorso: prove/guida.mjs confronta i due elenchi,
//   e un modulo nuovo senza guida fa cadere la prova;
// - ogni collegamento porta a una rotta di src/App.jsx, e una scheda nominata
//   con ?tab= esiste nella pagina (stessa prova);
// - le parti per livello vengono da src/lib/livelli.js, lo stesso elenco della
//   pagina Utenti: quello che la guida dice di un livello e' quello che
//   l'amministratore concede.
//
// Una parte puo' valere per un livello solo (`perLivello`) o essere solo
// dell'amministratore (`soloPer: ['admin']`): chi legge vede la sua, e
// l'amministratore vede anche quelle degli altri, per sapere che cosa vedono.

import { LIVELLI, LIVELLO_PREDEFINITO, livelloValido } from './livelli.js';

export const PERCORSO_GUIDA = '/guida';

/** I livelli nell'ordine in cui la guida li racconta: da chi guarda a chi governa. */
export const ORDINE_LIVELLI = ['consultazione', 'operatore_base', 'admin'];

/**
 * Il livello di chi legge, deciso una volta dalla pagina. Amministratore e'
 * solo chi lo e' per il ruolo (isAdmin), come in permessi.js: un livello
 * «admin» scritto altrove non basta. Nel dubbio, il meno possibile: un livello
 * non ancora letto vale consultazione.
 */
export function livelloDellaGuida(livello, isAdmin = false) {
  if (isAdmin) return 'admin';
  const l = livelloValido(livello);
  return l === 'admin' ? LIVELLO_PREDEFINITO : l;
}

// Le funzioni qui sotto ricevono il livello gia' deciso dalla pagina con
// livelloDellaGuida; uno sconosciuto vale consultazione.
const noto = (livello) => (ORDINE_LIVELLI.includes(livello) ? livello : LIVELLO_PREDEFINITO);

export const nomeLivello = (livello) => LIVELLI[noto(livello)].nome;

// ---------------------------------------------------------------------------
// I MODULI DEL MENU, nello stesso ordine del menu.
//
// Ogni modulo: a che cosa serve, che cosa vedi, che cosa puoi esportare, che
// cosa e' solo dell'amministratore, ed eventuali note per un livello. Un
// elenco `esporti` vuoto vuol dire che la pagina non ha esportazioni: lo dice
// `senzaEsportazioni`, mai un elenco vuoto muto.
// ---------------------------------------------------------------------------

export const MODULI = [
  {
    percorso: '/',
    nome: 'Dashboard',
    aCosaServe: 'Il quadro della commessa Ecotyre dell’anno scelto: come va la raccolta e che cosa c’è da gestire.',
    cosaVedi: [
      'L’anno si sceglie in alto: la pagina guarda un anno solo.',
      '«Da gestire»: l’unico elenco delle cose da sistemare, dalla più grave. Ogni voce ha «Apri», che porta dove si risolve, e «Nascondi»; alcune anche «Chiedi a EcoTyna».',
      'Una voce si nasconde per oggi o per 7 giorni; una critica solo per oggi. Torna da sola quando scade o se peggiora.',
      'Le sezioni Rete, ACI ed Extra raccolta, sempre separate. La Rete ha il contratto e l’atteso a oggi.',
      'Poi Impianti, Fatturazione attiva, Chiusura del mese e «A quando sono aggiornati i dati».',
      'La «i» accanto a un numero apre il suo perché: toccala.',
    ],
    esporti: [
      '«Esporta il quadro (PDF)»: il quadro com’è a video. L’elenco «Da gestire» nel PDF non va.',
      '«Riepilogo della settimana (PDF)», da girare alla direzione. Non parte per email: il PDF lo scarichi e lo mandi tu.',
    ],
    soloAmministratore: [
      'La sezione Economia, e nel PDF la casella «con l’economia».',
      'Nel riepilogo della settimana, costi e margine.',
      'In «Da gestire», gli errori del sito non ancora visti e il promemoria della copia di sicurezza.',
    ],
    parole: ['quadro', 'cruscotto', 'home', 'avvisi', 'chiusura del mese', 'riepilogo settimanale', 'direzione', 'lunedì'],
  },
  {
    percorso: '/caricamento-dati',
    nome: 'Caricamento Dati',
    aCosaServe: 'Qui entrano nel gestionale i file Excel scaricati dal portale Ecotyre. Ogni caricamento sostituisce i dati di prima dello stesso tipo e aggiorna da solo tutti i moduli.',
    cosaVedi: [
      'Cinque riquadri, uno per file: Primarie, Secondarie, Terziarie, Dichiarazioni Trattamento, Ordini Non Dichiarati.',
      'Il file delle Primarie è uno solo: il gestionale lo divide da sé in Terminati Rete, Terminati ACI, Assegnati Rete e Assegnati ACI.',
      'Lo Storico Caricamenti: quando, quale file, chi l’ha caricato, quante righe sono entrate e com’è andata.',
    ],
    esporti: [],
    senzaEsportazioni: 'Qui non si esporta: i dati si guardano ed esportano nei loro moduli.',
    soloAmministratore: [
      'Caricare Dichiarazioni Trattamento e Ordini Non Dichiarati.',
      'L’elenco dei file caricati, per la pulizia dell’archivio.',
      'La copia di sicurezza di tutti gli archivi, in un file che resta sul PC.',
    ],
    perLivello: {
      consultazione: 'Qui guardi soltanto: lo Storico Caricamenti ti dice a quando sono aggiornati i file. Se manca un caricamento, chiedilo con una richiesta.',
      operatore_base: 'Puoi caricare tre file: Primarie, Secondarie e Terziarie. Dopo il tuo caricamento il gestionale rifà da solo verifiche, alert e quadrature delle settimane recenti: lascia la pagina aperta finché non ha finito. Se restano ordini «eseguito», un riquadro giallo li elenca con l’ID: copiali o scaricali in Excel.',
      admin: 'Carichi tutti e cinque i file. Dopo ogni caricamento, se restano ordini «eseguito», un riquadro giallo li elenca con l’ID: si copiano o si scaricano in Excel.',
    },
    parole: ['importare', 'file', 'excel', 'portale', 'storico caricamenti', 'upload', 'copia di sicurezza', 'backup'],
  },
  {
    percorso: '/assegnati',
    nome: 'Assegnati Rete',
    aCosaServe: 'Gli ordini della rete (i gommisti) ancora in stato «assegnato»: l’arretrato da ritirare. Arrivano dal file delle Primarie.',
    cosaVedi: [
      'I numeri dell’arretrato in alto, poi la Matrice Aggregata e il Dettaglio Ordini.',
      'Cerchi un ordine col suo ID, o un punto di raccolta per nome o codice PDR.',
      'Filtri per anno, mese, regione, provincia, partner, trasportatore e classe.',
    ],
    esporti: ['«Excel Matrice» ed «Excel Dettaglio».'],
    soloAmministratore: [],
    nienteDaModificare: 'Qui non si modifica niente: gli ordini cambiano col caricamento delle Primarie.',
    parole: ['aperti', 'arretrato', 'backlog', 'da ritirare', 'gommisti', 'ordini aperti'],
  },
  {
    percorso: '/assegnati-aci',
    nome: 'Assegnati ACI',
    aCosaServe: 'Gli ordini ACI (demolitori e autodemolizioni) ancora in stato «assegnato». Arrivano dal file delle Primarie.',
    cosaVedi: [
      'La stessa pagina degli Assegnati Rete: numeri, Matrice Aggregata, Dettaglio Ordini, ricerca per ID e filtri.',
      'Un ordine ACI con lo stimato sotto i 1.500 kg viene segnalato: è una regola del portale, e la correzione si chiede al consorzio.',
    ],
    esporti: ['«Excel Matrice» ed «Excel Dettaglio».'],
    soloAmministratore: [],
    nienteDaModificare: 'Qui non si modifica niente: gli ordini cambiano col caricamento delle Primarie.',
    parole: ['aperti', 'autodemolizioni', 'demolitori', 'arretrato', 'stimato'],
  },
  {
    percorso: '/pdr',
    nome: 'PDR',
    aCosaServe: 'L’anagrafica dei clienti Ecotyre: gommisti e autodemolitori con i loro punti di raccolta (PDR).',
    cosaVedi: [
      'Le schede Punti di raccolta, Clienti, Mappa e Sedi operative.',
      'Filtri e ricerca per ragione sociale, comune e altri campi.',
      'Sedi operative: sul formulario va la sede dove si ritira davvero, non la sede legale. Qui c’è il controllo punto per punto.',
    ],
    esporti: ['«Esporta Excel».'],
    soloAmministratore: [
      'Caricare il file dei PDR, che sostituisce l’anagrafica di prima.',
      'Lanciare il controllo delle sedi operative e decidere quale indirizzo vale.',
    ],
    parole: ['punto di raccolta', 'anagrafica', 'clienti', 'mappa', 'sede operativa', 'sede legale'],
  },
  {
    percorso: '/primarie-rete',
    nome: 'Terminati Rete',
    aCosaServe: 'I ritiri della rete già terminati: raccolta per provincia e mix delle classi per raccoglitore.',
    cosaVedi: [
      'Le schede Dettaglio Ordini, Province & FIR, % di scostamento per classi, SLA & Tempi.',
      'Cerchi un ordine col suo ID, o un punto di raccolta per nome o codice PDR.',
      'Gli avvisi delle date da sistemare: un terminato senza fine trasporto non sta in nessun mese.',
    ],
    esporti: [],
    senzaEsportazioni: 'Questa pagina non ha esportazioni: la raccolta di rete per provincia e mese la esporti da Verifiche, schede Raccolto per provincia e Ritiri per provincia.',
    soloAmministratore: [],
    nienteDaModificare: 'Qui non si modifica niente: i terminati arrivano dal file delle Primarie.',
    parole: ['chiusi', 'ritiri', 'raccolto', 'province', 'classi', 'sla', 'tempi', 'ordini chiusi'],
  },
  {
    percorso: '/primarie-aci',
    nome: 'Terminati ACI',
    aCosaServe: 'I ritiri ACI già terminati, per destinazione e per mese.',
    cosaVedi: [
      'Le schede Per Destinazione, Per Mese, Dettaglio Record e Conferimenti per settimana.',
    ],
    esporti: ['Dalla scheda Conferimenti per settimana: «Esporta Excel».'],
    soloAmministratore: [],
    nienteDaModificare: 'Qui non si modifica niente: i terminati arrivano dal file delle Primarie.',
    parole: ['chiusi', 'autodemolizioni', 'destinazioni', 'conferimenti', 'ordini chiusi'],
  },
  {
    percorso: '/secondarie',
    nome: 'Secondarie',
    aCosaServe: 'I trasporti dagli stoccaggi agli impianti, tratta per tratta.',
    cosaVedi: [
      'In alto scegli il canale, Rete o ACI: numeri, matrice, dettaglio ed Excel sono sempre di un canale solo.',
      'Le schede Matrice per Tratta, Dettaglio Ordini e Report settimanale.',
    ],
    esporti: ['«Excel Sintesi» ed «Excel Dettaglio» del canale scelto.', 'Dal Report settimanale: «Esporta Excel».'],
    soloAmministratore: [],
    perLivello: {
      consultazione: 'Il file delle Secondarie lo carica l’amministratore o un operatore base: se manca, chiedilo con una richiesta.',
      operatore_base: 'Il file delle Secondarie lo puoi caricare tu, da Caricamento Dati.',
    },
    parole: ['stoccaggi', 'tratte', 'viaggi', 'trasporti'],
  },
  {
    percorso: '/terziarie',
    nome: 'Terziarie',
    aCosaServe: 'I prodotti che escono dagli impianti, per impianto e per materiale.',
    cosaVedi: ['I viaggi dagli impianti verso cementerie o altri impianti, con i filtri per impianto, destinazione, mese e materiale, e la ricerca per ID ordine.'],
    esporti: ['«Esporta Excel».'],
    soloAmministratore: [],
    perLivello: {
      operatore_base: 'Il file delle Terziarie lo puoi caricare tu, da Caricamento Dati.',
    },
    parole: ['prodotti', 'materiali', 'cementerie', 'uscite'],
  },
  {
    percorso: '/giacenze',
    nome: 'Giacenze',
    aCosaServe: 'Quanto PFU c’è negli impianti e negli stoccaggi, canale per canale, e quanto resta da dichiarare.',
    cosaVedi: [
      'Le schede Situazione, Da dichiarare, Derivati, Target, Stoccaggi e Chiusura anno.',
      'Rete e ACI restano separate anche qui.',
      'Se un caricamento è in corso o non è finito, la pagina lo dice sopra i totali.',
    ],
    esporti: [
      '«Esporta Excel» in alto: tutta la pagina.',
      'Il pulsante PDF dentro ogni scheda: quello che hai davanti, coi filtri di quel momento.',
      'Nella scheda Da dichiarare anche l’Excel delle righe.',
    ],
    soloAmministratore: [
      'Siti e target, nella scheda Target.',
      'Le rilevazioni degli stoccaggi.',
      'La chiusura dell’anno.',
    ],
    parole: ['stock', 'piazzale', 'impianti', 'stoccaggi', 'da dichiarare', 'derivati'],
  },
  {
    percorso: '/extra-raccolta',
    nome: 'Extra Raccolta',
    aCosaServe: 'Le campagne di extra raccolta, intervento per intervento: un intervento si inserisce come assegnato e si chiude come terminato, con FIR, fine trasporto e peso. Solo i terminati vanno in fattura.',
    cosaVedi: [
      'L’elenco degli interventi del periodo, con i filtri.',
      'Gli avvisi degli interventi con le date da sistemare: senza fine trasporto un intervento non ha un mese.',
      'In fondo, i Conferimenti per settimana: primarie e secondarie dell’extra raccolta.',
    ],
    esporti: ['«Esporta Excel» ed «Esporta PDF».', 'Dai Conferimenti per settimana: «Esporta Excel».'],
    soloAmministratore: [
      'Aggiungere e correggere gli interventi.',
      'Costi e margine: le colonne «Costo totale» e «Margine», nella pagina e nei file.',
    ],
    parole: ['campagne', 'interventi', 'extra'],
  },
  {
    percorso: '/target-status',
    nome: 'Target & Status',
    aCosaServe: 'L’unico posto dove si scrivono i target: contratto Ecotyre, raccoglitori, impianti e stoccaggi. Tutti gli altri moduli leggono da qui.',
    cosaVedi: [
      'Le schede Andamento, Target raccoglitori, Commessa Ecotyre, Impianti e stoccaggi, Zone dei raccoglitori e Nuovo anno.',
      'Un anno chiuso si consulta in sola lettura.',
      'Nuovo anno: che cosa manca all’anno nuovo per cominciare. Contratti e tariffe scadono il 31 dicembre.',
      'Le tariffe copiate dall’anno prima con «Prepara le tariffe» si confermano nella scheda Nuovo anno: finché non lo sono, le righe che le usano restano «da confermare» e il documento del mese non si verifica.',
    ],
    esporti: ['Nella scheda Andamento: Excel, PDF e presentazione (PPT).'],
    soloAmministratore: [
      'Scrivere i target, il contratto Ecotyre e le sue variazioni, le zone dei raccoglitori, impianti e stoccaggi.',
      'Preparare l’anno nuovo.',
    ],
    parole: ['obiettivi', 'contratto', 'commessa', 'andamento', 'regioni', 'zone'],
  },
  {
    percorso: '/report',
    nome: 'Report',
    aCosaServe: 'Il report settimanale della raccolta di rete: target del mese, raccolto per settimana, residuo del mese e andamento per regione e raccoglitore.',
    cosaVedi: [
      'Si rifà da solo dai dati: segue ogni caricamento delle Primarie.',
      'Sotto l’intestazione, i terminati di rete con le date da sistemare.',
    ],
    esporti: ['«Esporta PDF».'],
    soloAmministratore: [],
    nienteDaModificare: 'Qui non si modifica niente: il report si calcola dai dati.',
    parole: ['settimanale', 'regioni', 'raccoglitori', 'residuo'],
  },
  {
    percorso: '/report-mensile',
    nome: 'Report Mensile',
    aCosaServe: 'Le stesse pivot del foglio REPORT MENSILE, più la raccolta dell’anno per raccoglitore e impianto.',
    cosaVedi: [
      'Scegli anno e mese. Le schede: Rete, ACI, Secondarie di rete, Terziarie ed extra.',
      'Accanto a ogni titolo un’etichetta dice se guarda il mese scelto o l’anno intero.',
    ],
    esporti: ['«Esporta scheda»: la scheda aperta, in Excel.'],
    soloAmministratore: [],
    nienteDaModificare: 'Qui non si modifica niente: le pivot si calcolano dai dati.',
    parole: ['pivot', 'mensile', 'viaggi'],
  },
  {
    percorso: '/alert-engine',
    nome: 'Alert & Controllo',
    aCosaServe: 'I controlli automatici sui dati: anomalie, date mancanti, scostamenti.',
    cosaVedi: [
      'Le schede Alert Attivi e Gestione Regole.',
      'Ogni alert dice «Si corregge in …» e ti porta alla pagina giusta.',
    ],
    esporti: [],
    senzaEsportazioni: 'Questa pagina non ha esportazioni.',
    soloAmministratore: [
      'Lanciare il motore degli alert su un modulo.',
      'Segnare un alert come risolto o ignorarlo.',
      'Scrivere e cambiare le regole.',
      'La scheda Errori del sito: gli errori che le pagine hanno incontrato, raggruppati, da segnare visti.',
    ],
    parole: ['anomalie', 'avvisi', 'controlli', 'regole', 'errori', 'errori del sito'],
  },
  {
    percorso: '/fatturazione',
    nome: 'Fatturazione',
    aCosaServe: 'La fatturazione della commessa: l’attiva verso Ecotyre, una fattura per canale, e la passiva dei fornitori.',
    cosaVedi: [
      'La scheda Attiva: Dashboard, Dettaglio, Prefattura Ecotyre ed Esportazioni del mese scelto.',
      'Rete, ACI ed Extra raccolta hanno ciascuno il suo documento.',
    ],
    esporti: ['Dalla scheda Esportazioni dell’attiva: un file per canale, in Excel o in PDF, anche nel formato dell’amministrazione.'],
    soloAmministratore: [
      'Le schede Passiva, Margine, Fornitori, Tariffe & Anagrafiche e Storico: costi e margine li vede solo l’amministratore.',
      'Elaborare, verificare, approvare, chiudere e riaprire il mese dell’attiva.',
    ],
    parole: ['fatture', 'attiva', 'passiva', 'prefattura', 'tariffe', 'prezzi', 'margine', 'costi'],
  },
  {
    percorso: '/qualifica-fornitori',
    nome: 'Qualifica Fornitori',
    aCosaServe: 'I documenti richiesti ai fornitori e al cliente contrattualizzati nell’anno: chi li ha, chi no e che cosa scade.',
    cosaVedi: [
      'Ogni documento caricato viene letto e controllato: validità e scadenza.',
      'Le schede Documenti e Contratti.',
      'Il numero rosso nel menu accanto a Qualifica Fornitori: gli alert da gestire.',
    ],
    esporti: ['«Elenco in Excel» ed «Elenco in PDF».'],
    soloAmministratore: [
      'Il catalogo dei documenti, includere un soggetto, caricare i documenti.',
      'Il promemoria degli alert aperti.',
    ],
    parole: ['documenti', 'scadenze', 'fornitori', 'contratti', 'autorizzazioni'],
  },
  {
    percorso: '/omologhe',
    nome: 'Omologhe',
    aCosaServe: 'Le schede di omologa dei produttori: valgono un anno e si recepiscono al primo ritiro dal punto di raccolta.',
    cosaVedi: [
      'Le schede Elenco e Divergenze.',
      'Il colore si scalda man mano che la scadenza si avvicina.',
      'Le divergenze fra il nostro elenco e il registro dell’impianto restano in attesa finché una persona non le verifica.',
    ],
    esporti: ['«Excel».'],
    soloAmministratore: [
      'Aggiornare dai file.',
      'Collegare un’omologa ai suoi PDR e verificare le divergenze.',
    ],
    parole: ['omologa', 'produttori', 'scadenza'],
  },
  {
    percorso: '/dichiarazioni-rentri',
    nome: 'Dichiarazioni RENTRI',
    aCosaServe: 'Per ogni produttore la sua dichiarazione e, accanto, che cosa dice il portale dei suoi punti di raccolta.',
    cosaVedi: [
      'I riquadri: dichiarazioni, iscritti al RENTRI, FIR digitale e cartaceo, da aggiornare.',
      'Dove dichiarazione e portale non coincidono, il modulo lo segnala.',
      'I dati del portale vengono dal modulo PDR.',
    ],
    esporti: ['«Excel».'],
    soloAmministratore: ['Aggiornare dal file.', 'Confermare il collegamento di una dichiarazione ai PDR.'],
    parole: ['rentri', 'produttori', 'fir digitale', 'iscritti'],
  },
  {
    percorso: '/dichiarazioni-impianti',
    nome: 'Dichiarazioni Impianti',
    aCosaServe: 'Ogni mese gli impianti dichiarano che cosa hanno ricavato dai PFU che abbiamo conferito. Una dichiarazione caricata a portale toglie quei PFU dalla giacenza dell’impianto.',
    cosaVedi: [
      'Le schede Riepilogo, Impianti, Stoccaggi, Irigom e Quadratura.',
      'Quali mesi della rete sono caricati a portale lo riconosce da sé il file Dichiarazioni Trattamento: qui non c’è niente da premere.',
      'Gli stoccaggi non dichiarano: quello che rimandano in secondaria lo dichiara l’impianto che lo riceve.',
    ],
    esporti: ['«Esporta» (Excel).'],
    soloAmministratore: [
      'Scrivere le dichiarazioni di ACI ed extra raccolta, che a portale non si gestiscono.',
      'Preparare la pratica mensile di Irigom.',
      'Togliere le dichiarazioni inesistenti.',
    ],
    parole: ['dichiarazioni', 'trattamento', 'derivati', 'irigom', 'giacenza', 'quadratura'],
  },
  {
    percorso: '/verifiche',
    nome: 'Verifiche',
    aCosaServe: 'I controlli sui dati che mandano i fornitori, confrontati col gestionale.',
    cosaVedi: [
      'Le schede Report settimanali, Quadratura FIR, Raccolto per provincia, Ritiri per provincia e Rotte.',
      'Dopo quaranta giorni il dettaglio riga per riga si toglie: restano i numeri di sintesi e la storia scritta.',
      'Rotte: chi conferisce dove, e i formulari che sembrano chiusi sulla destinazione sbagliata.',
    ],
    esporti: [
      'Di una verifica settimanale: il PDF per l’impianto e l’Excel.',
      'Di una quadratura FIR: il «Report PDF».',
      'Raccolto e Ritiri per provincia: Excel e PDF.',
    ],
    soloAmministratore: [
      'Caricare i report settimanali degli impianti e degli stoccaggi.',
      'Caricare la stampa della quadratura FIR.',
    ],
    parole: ['quadratura', 'fir', 'report settimanali', 'province', 'rotte', 'controlli'],
  },
  {
    percorso: '/verifiche-fornitori',
    nome: 'Verifiche Fornitori',
    aCosaServe: 'Come lavorano i fornitori: se evadono le richieste nell’ordine in cui arrivano, e come va la raccolta di ogni raccoglitore, mese per mese e zona per zona.',
    cosaVedi: [
      'Le schede Evasione assegnati, Andamento e zone, Consuntivi e costi.',
      'Nei consuntivi il confronto sulle quantità, formulari e chili, lo vedi per intero.',
    ],
    esporti: ['Da Andamento e zone: «Esporta Excel».', 'Dal confronto di un consuntivo: «Esporta».'],
    soloAmministratore: [
      'Caricare le liste che i raccoglitori ricevono a inizio mese.',
      'Caricare i consuntivi dei fornitori e congelare il conto della passiva.',
      'L’importo previsto di un consuntivo: viene dalla passiva, che è riservata.',
    ],
    parole: ['evasione', 'liste', 'consuntivi', 'raccoglitori', 'zone'],
  },
  {
    percorso: '/assistente',
    nome: 'EcoTyna',
    aCosaServe: 'L’assistente del gestionale: risponde sulle norme (PFU, rifiuti, RENTRI, Albo) e sui dati della commessa.',
    cosaVedi: [
      'Le schede Domande, Esercitazione RT e Corso RT, per l’esame di responsabile tecnico.',
      'Sotto ogni risposta sui dati, «Dove ho guardato» dice i moduli letti e a che data sono i dati.',
    ],
    esporti: ['Chiedile un file: lo prepara da scaricare in Excel, CSV, Word, PDF o testo.'],
    soloAmministratore: [
      'La Base di conoscenza.',
      'Allegare file alla domanda.',
    ],
    parole: ['assistente', 'domande', 'norme', 'corso', 'esame', 'responsabile tecnico'],
  },
  {
    percorso: '/predittivita-secondarie',
    nome: 'Predittività Secondarie',
    aCosaServe: 'Quanti viaggi di secondarie servono, settimana per settimana, perché ogni impianto arrivi al suo target. Solo rete, un anno alla volta.',
    cosaVedi: [
      'Le schede Programma della settimana, Simulazione, Impianti, Stoccaggi, Settimane e Assistente.',
      'Il programma della settimana dopo si fissa da solo il mercoledì mattina.',
      'Gli anni chiusi si guardano in sola lettura.',
    ],
    esporti: ['«Esporta la situazione» (PDF).'],
    soloAmministratore: [
      'Correggere e fissare a mano il programma della settimana.',
      'Impianti e stoccaggi dell’anno, che si scrivono in Target & Status.',
    ],
    parole: ['previsione', 'viaggi', 'programma', 'secondarie', 'simulazione'],
  },
  {
    percorso: '/todo',
    nome: 'To-Do List',
    aCosaServe: 'Attività, solleciti e pratiche con scadenze, e le richieste di ritiro che il consorzio manda per email.',
    cosaVedi: [
      'Due sezioni: Attività e Richieste ECT.',
      'Un’attività con l’ID ordine si chiude da sola quando l’ordine diventa terminato. Se il portale cancella l’ordine, passa da sola fra le cancellate.',
      'Il numero blu nel menu accanto a To-Do List: le attività da fare.',
      'Una richiesta ECT dell’anno prima resta finché non si chiude, e porta scritto «richiesta del» e il suo anno.',
    ],
    esporti: [],
    senzaEsportazioni: 'Questa pagina non ha esportazioni.',
    soloAmministratore: [
      'Aggiungere, chiudere ed eliminare le attività.',
      'Caricare il file di gestione delle Richieste ECT e spuntare le risposte al consorzio.',
    ],
    parole: ['attività', 'scadenze', 'solleciti', 'richieste ect', 'email', 'consorzio'],
  },
  {
    percorso: '/richieste',
    nome: 'Richieste',
    aCosaServe: 'Il modo per chiedere all’amministratore un caricamento, una correzione o una cosa nuova. Resta scritto che cosa hai chiesto e com’è finita.',
    cosaVedi: [
      'Le tue richieste, divise per stato: In attesa, Approvata, Eseguita, Non accolta, Tutte.',
      'Sotto ogni richiesta, la risposta dell’amministratore.',
    ],
    esporti: [],
    senzaEsportazioni: 'Questa pagina non ha esportazioni.',
    soloAmministratore: ['Vedere le richieste di tutti, rispondere e decidere: Approva, Fatto, Non accolgo.'],
    perLivello: {
      consultazione: 'Scrivi qui che cosa ti serve: la risposta la trovi in questa pagina. Più sotto, «Come chiedere una correzione o un caricamento».',
      operatore_base: 'Scrivi qui che cosa ti serve: la risposta la trovi in questa pagina. Più sotto, «Come chiedere una correzione o un caricamento».',
      admin: 'Le richieste degli altri arrivano qui: il numero nel menu dice quante sono da valutare. Scrivi la risposta e scegli Approva, Fatto o Non accolgo.',
    },
    parole: ['chiedere', 'aprire una richiesta', 'nuova richiesta', 'correzione', 'domanda', 'amministratore', 'aiuto'],
  },
  {
    percorso: '/utenti',
    nome: 'Utenti',
    soloAdmin: true,
    aCosaServe: 'Chi entra nel gestionale e con quale livello: Consultazione, Operatore base o Amministratore.',
    cosaVedi: [
      'Le tre schede dei livelli, con quello che ciascuno può e non può fare.',
      'Chi entra per la prima volta parte sempre in consultazione.',
    ],
    esporti: [],
    senzaEsportazioni: 'Questa pagina non ha esportazioni.',
    soloAmministratore: [
      'Tutta la pagina: la vede solo l’amministratore.',
      'Cambiare il livello di una persona. Vale dal suo prossimo accesso.',
    ],
    parole: ['livelli', 'permessi', 'accessi', 'persone'],
  },
];

// ---------------------------------------------------------------------------
// LE SEZIONI GENERALI.
//
// Ogni sezione ha dei gruppi; ogni gruppo un elenco di elementi
// { titolo?, testo, link? }. `soloPer` limita la sezione a dei livelli.
// ---------------------------------------------------------------------------

/** Una domanda da portare a EcoTyna: la scrive nella casella, la manda chi legge. */
export const domandaPerEcoTyna = (domanda) => `/assistente?domanda=${encodeURIComponent(domanda)}`;

export const ESEMPI_ECOTYNA = [
  'Quanti ordini aperti ci sono in provincia di Cosenza?',
  'Quanti ordini di rete sono stati chiusi a Cosenza da luglio a settembre?',
  'Quanto resta da dichiarare agli impianti, canale per canale?',
  'Quali raccoglitori sono sotto target questo mese?',
  'Che cosa deve verificare il responsabile tecnico prima di affidare i PFU a un impianto?',
];

export const SEZIONI = [
  {
    id: 'richieste',
    titolo: 'Come chiedere una correzione o un caricamento',
    intro: 'Il gestionale lo modifica solo l’amministratore. Se ti serve un caricamento, una correzione o una cosa nuova, lo chiedi dal modulo Richieste: resta scritto che cosa hai chiesto e com’è finita.',
    gruppi: [
      {
        titolo: 'Come si apre',
        numerato: true,
        elementi: [
          { testo: 'Apri Richieste dal menu. Molte pagine, quando le guardi in sola lettura, hanno anche il collegamento «Apri una richiesta».', link: { percorso: '/richieste', testo: 'Apri Richieste' } },
          { testo: 'In «Nuova richiesta» scrivi un titolo breve. Per esempio: «Caricare il file delle primarie della settimana 38».' },
          { testo: 'Scegli il modulo. Se non è nell’elenco, scegli «Altro» e scrivilo nella descrizione.' },
          { testo: 'Scegli che cosa serve: caricare un file o dei dati, correggere un dato sbagliato, modificare qualcosa che c’è già, aggiungere qualcosa che non c’è, altro.' },
          { testo: 'Scegli l’urgenza: Con calma, Normale o Urgente. Poi premi «Invia la richiesta».' },
        ],
      },
      {
        titolo: 'Che cosa scrivere',
        elementi: [
          { testo: 'Racconta che cosa serve e perché. Titolo e descrizione sono obbligatori.' },
          { testo: 'Se riguarda un movimento, scrivi il numero del formulario e l’ID ordine.' },
          { testo: 'Scrivi dove l’hai visto: la pagina, la scheda, l’anno e il mese.' },
          { testo: 'Se un numero ti sembra sbagliato, scrivi quello che vedi e quello che ti aspetti.' },
        ],
      },
      {
        titolo: 'Che cosa succede dopo',
        elementi: [
          { testo: 'La richiesta parte «In attesa». Nel menu, accanto a Richieste, un numero ti dice quante tue richieste sono ancora in attesa.' },
          { testo: 'L’amministratore la valuta e la segna Approvata, Eseguita quando ha fatto, oppure Non accolta. Può scriverti una risposta.' },
          { testo: 'La risposta la trovi nella pagina Richieste, sotto la tua richiesta: non arriva per email.' },
          { testo: 'Con i pulsanti sopra l’elenco vedi le richieste per stato, o tutte.' },
        ],
      },
    ],
  },
  {
    id: 'parole',
    titolo: 'Le parole del portale',
    intro: 'Le parole che trovi in tutte le pagine, spiegate in breve.',
    gruppi: [
      {
        titolo: 'Lo stato di un ordine',
        elementi: [
          { titolo: 'Assegnato', testo: 'L’ordine è affidato a un raccoglitore e il ritiro non è ancora chiuso. Lo trovi in Assegnati Rete o Assegnati ACI.', link: { percorso: '/assegnati', testo: 'Assegnati Rete' } },
          { titolo: 'Eseguito', testo: 'Il trasporto c’è, ma a portale l’ordine non è stato chiuso. È un limbo: finché non diventa terminato o cancellato non entra in nessun conto. A ogni caricamento il gestionale lo segnala con l’ID ordine.' },
          { titolo: 'Terminato', testo: 'L’ordine è chiuso, con FIR, fine trasporto e peso. Lo trovi in Terminati Rete o Terminati ACI: raccolto, giacenze e fatture si fanno sui terminati.', link: { percorso: '/primarie-rete', testo: 'Terminati Rete' } },
          { titolo: 'Cancellato', testo: 'Il portale ha annullato l’ordine: non si ritira e non conta. Un’attività della To-Do List che lo aspettava passa da sola fra le cancellate.' },
        ],
      },
      {
        titolo: 'I tre canali',
        elementi: [
          { titolo: 'Rete', testo: 'Gli ordini dei gommisti. È l’unico canale con i target del contratto Ecotyre.' },
          { titolo: 'ACI', testo: 'Gli ordini di demolitori e autodemolizioni.' },
          { titolo: 'Extra raccolta', testo: 'Le campagne occasionali, gestite nel loro modulo: a portale non ci sono.', link: { percorso: '/extra-raccolta', testo: 'Extra Raccolta' } },
          { titolo: 'Mai sommati', testo: 'Rete, ACI ed extra raccolta non si sommano mai: ogni numero è di un canale solo, anche negli Excel e nei PDF.' },
        ],
      },
      {
        titolo: 'Movimenti e documenti',
        elementi: [
          { titolo: 'Fine trasporto', testo: 'Il giorno in cui il trasporto è finito. Decide a quale giorno, settimana, mese e anno appartiene un movimento. La chiusura a portale arriva giorni dopo e non conta mai per i periodi.' },
          { titolo: 'FIR', testo: 'Il formulario che accompagna ogni trasporto di rifiuti. Le date di immissione, inizio e fine trasporto sono obbligatorie. Sul formulario va la sede operativa del punto di raccolta, non la sede legale.' },
          { titolo: 'PDR', testo: 'Il punto di raccolta: il gommista o l’autodemolitore dove si ritirano i PFU. Ha il suo codice PDR.', link: { percorso: '/pdr', testo: 'PDR' } },
          { titolo: 'Primarie, secondarie, terziarie', testo: 'Le primarie sono i ritiri dai punti di raccolta. Le secondarie portano i PFU dagli stoccaggi agli impianti. Le terziarie portano fuori dagli impianti i prodotti ricavati.' },
          { titolo: 'Dichiarazione', testo: 'Ogni mese un impianto dichiara che cosa ha ricavato dai PFU ricevuti. Caricata a portale, toglie quei PFU dalla sua giacenza.', link: { percorso: '/dichiarazioni-impianti', testo: 'Dichiarazioni Impianti' } },
          { titolo: 'Peso', testo: 'Si conta sempre il peso effettivo, mai lo stimato.' },
        ],
      },
    ],
  },
  {
    id: 'ecotyna',
    titolo: 'Come chiedere a EcoTyna',
    intro: 'Scrivi la domanda come la diresti a un collega. Se il browser lo permette, puoi anche dettarla col microfono.',
    gruppi: [
      {
        titolo: 'Domande buone',
        elementi: [
          ...ESEMPI_ECOTYNA.map(e => ({ testo: e, link: { percorso: domandaPerEcoTyna(e), testo: 'Prova' } })),
        ],
      },
      {
        titolo: 'Come chiedere bene',
        elementi: [
          { testo: 'Di’ se vuoi gli ordini aperti o quelli chiusi, il canale (rete, ACI, extra raccolta), il periodo e la provincia.' },
          { testo: 'Se dici «ordini» con un periodo, EcoTyna guarda quelli chiusi; senza un periodo, quelli aperti.' },
          { testo: 'Un mese senza l’anno è l’ultimo già cominciato: a gennaio «dicembre» è il dicembre dell’anno prima, e la risposta dice l’anno.' },
          { testo: 'Per un ordine preciso scrivi il suo ID o il numero del formulario.' },
        ],
      },
      {
        titolo: 'Dove guarda',
        elementi: [
          { testo: 'Gli ordini aperti negli Assegnati: Rete per i gommisti, ACI per demolitori e autodemolizioni, le campagne nell’Extra Raccolta.' },
          { testo: 'Gli ordini chiusi nei Terminati Rete, nei Terminati ACI o nell’Extra Raccolta, sul giorno di fine trasporto.' },
          { testo: 'Le Richieste ECT solo se parli delle richieste arrivate per email.' },
          { testo: 'Sotto la risposta, «Dove ho guardato» ti dice i moduli letti e a che data sono i dati.' },
          { testo: 'Sulle norme cita le fonti e dice quanto è sicura: certezza alta, media o bassa, da confermare. Per decisioni con conseguenze legali verifica sempre il testo vigente.' },
          { testo: 'Costi e prezzi dei fornitori li dice solo all’amministratore.' },
        ],
      },
    ],
    collegamento: { percorso: '/assistente', testo: 'Apri EcoTyna' },
  },
  {
    id: 'mese',
    titolo: 'I passi del mese',
    soloPer: ['admin'],
    intro: 'Quello che il gestionale ti chiede ogni mese, nell’ordine in cui lo controlla la sezione «Chiusura del mese» della Dashboard. Il gestionale chiude i mesi da settembre 2026: quelli prima sono stati fatturati fuori.',
    gruppi: [
      {
        titolo: 'Durante il mese',
        elementi: [
          { testo: 'Carica i file del portale: Primarie, Secondarie, Terziarie, Dichiarazioni Trattamento e Ordini Non Dichiarati. Ogni caricamento aggiorna tutti i moduli.', link: { percorso: '/caricamento-dati', testo: 'Caricamento Dati' } },
          { testo: 'Guarda il riquadro degli ordini rimasti «eseguito»: vanno chiusi a portale, altrimenti non entrano in nessun conto.' },
          { testo: 'Ogni settimana, in Verifiche: i report settimanali di impianti e stoccaggi, e la stampa della quadratura FIR.', link: { percorso: '/verifiche', testo: 'Verifiche' } },
          { testo: 'A inizio mese, in Verifiche Fornitori: la lista che ogni raccoglitore ha ricevuto.', link: { percorso: '/verifiche-fornitori?tab=evasione', testo: 'Evasione assegnati' } },
          { testo: 'Le richieste di ritiro arrivate per email: To-Do List, sezione Richieste ECT, col file di gestione.', link: { percorso: '/todo', testo: 'To-Do List' } },
          { testo: 'Ogni giorno, la Dashboard: l’elenco «Da gestire».', link: { percorso: '/', testo: 'Dashboard' } },
          // Il 15/10/2026 tolto «dopo sette giorni la Dashboard te lo ricorda»: la
          // regola del promemoria (promemoriaCopia.ts) non la chiamava ancora
          // nessuno, e la guida non promette quello che il gestionale non fa.
          // Rimesso alla chiusura dello stesso giorno, quando il cruscotto ha
          // cominciato a chiamarla (cruscotto.ts, cruscottoOperativo): ora la
          // sezione 8 di prove/guida.mjs vuole che la guida lo dica.
          { testo: 'Una volta alla settimana, la copia di sicurezza in Caricamento Dati: la sezione ti dice il giorno dell’ultima copia. Se passano sette giorni senza una copia, «Da gestire» della Dashboard te lo ricorda.', link: { percorso: '/caricamento-dati', testo: 'Copia di sicurezza' } },
        ],
      },
      {
        titolo: 'La chiusura del mese',
        numerato: true,
        elementi: [
          { titolo: 'Dati del mese completi', testo: 'Primarie e secondarie caricate quando è scaduto il termine per registrare i formulari partiti a fine mese: dieci giorni dalla partenza, domeniche escluse.', link: { percorso: '/caricamento-dati', testo: 'Caricamento Dati' } },
          { titolo: 'Terminati del mese a posto', testo: 'Nessuna data da sistemare e nessun ordine rimasto «eseguito».', link: { percorso: '/alert-engine', testo: 'Alert & Controllo' } },
          { titolo: 'Dichiarazioni degli impianti', testo: 'Sulla rete i mesi caricati a portale li riconosce il file Dichiarazioni Trattamento. ACI ed extra raccolta le scrivi tu. Per Irigom c’è la pratica del mese, nella sua scheda.', link: { percorso: '/dichiarazioni-impianti?tab=riepilogo', testo: 'Dichiarazioni Impianti' } },
          { titolo: 'Attiva, un passo per canale', testo: 'In Fatturazione, scheda Attiva: Elabora, Verifica, confronto con la Prefattura Ecotyre (rete e ACI), Approva, Esportazioni. Chiudi quando l’amministrazione conferma la fattura, con il giorno e, se c’è, il numero.', link: { percorso: '/fatturazione?tab=attiva', testo: 'Fatturazione attiva' } },
          { titolo: 'Passiva, un passo per canale', testo: 'In Verifiche Fornitori, scheda Consuntivi e costi: «Congela il conto della passiva», poi carica i consuntivi dei fornitori e guarda se quadrano. Il giudizio sul consuntivo autorizza la sua fattura.', link: { percorso: '/verifiche-fornitori?tab=consuntivi', testo: 'Consuntivi e costi' } },
          { titolo: 'Quadrature FIR delle settimane', testo: 'Ogni settimana del mese con la sua quadratura completata, su ogni canale.', link: { percorso: '/verifiche?tab=quadratura-fir', testo: 'Quadratura FIR' } },
          { testo: 'Sotto, la sezione elenca i mesi prima ancora aperti: si aprono uno per volta.' },
        ],
      },
      {
        titolo: 'La fatturazione',
        elementi: [
          { testo: 'I fornitori fatturano a SMOCO. SMOCO fa a Ecotyre tre fatture, una per canale.' },
          { testo: 'La passiva, canale per canale, sta in Fatturazione, scheda Passiva; il margine nella scheda Margine. Costi e margine li vedi solo tu.', link: { percorso: '/fatturazione?tab=passiva', testo: 'Fatturazione passiva' } },
          { testo: 'Contratti e tariffe sono annuali senza tacito rinnovo. Prima del 1° gennaio, Target & Status, scheda Nuovo anno, dice che cosa manca all’anno nuovo.', link: { percorso: '/target-status?tab=nuovo-anno', testo: 'Nuovo anno' } },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// I LIVELLI: chi legge vede il suo, l'amministratore tutti e tre.
// ---------------------------------------------------------------------------

const INTRO_LIVELLO = {
  consultazione: 'Guardi ed esporti tutto. Dove una pagina dice «sola lettura», caricamenti e modifiche li fa l’amministratore: chiedili con una richiesta.',
  operatore_base: 'Oltre a consultare, carichi i tre file del portale, Primarie, Secondarie e Terziarie, da Caricamento Dati. Il resto lo chiedi con una richiesta.',
  admin: 'Governi il gestionale: carichi, modifichi, fatturi. In questa guida vedi anche le parti degli altri livelli, per sapere che cosa vedono loro.',
};

/** I livelli da raccontare a chi legge: il suo, o tutti e tre all'amministratore. */
export function livelliDaMostrare(livello) {
  const mio = noto(livello);
  const quali = mio === 'admin' ? ORDINE_LIVELLI : [mio];
  return quali.map(k => ({
    chiave: k,
    nome: LIVELLI[k].nome,
    sommario: LIVELLI[k].sommario,
    intro: INTRO_LIVELLO[k],
    puo: [...LIVELLI[k].puo],
    nonPuo: [...LIVELLI[k].nonPuo],
    tuo: k === mio,
  }));
}

/** Le sezioni generali che chi legge vede. */
export function sezioniVisibili(livello) {
  const mio = noto(livello);
  return SEZIONI.filter(s => !s.soloPer || s.soloPer.includes(mio) || mio === 'admin');
}

/** Le note per livello di un modulo: la sua a chi legge, tutte all'amministratore. */
export function notePerLivello(modulo, livello) {
  const mio = noto(livello);
  const note = modulo.perLivello || {};
  return ORDINE_LIVELLI
    .filter(k => note[k] && (mio === 'admin' || k === mio))
    .map(k => ({ livello: k, nome: LIVELLI[k].nome, testo: note[k], tuo: k === mio }));
}

/** L'ancora di un modulo nella pagina: «Target & Status» -> modulo-target-status. */
export const idDelModulo = (modulo) => `modulo-${normalizza(modulo.nome).replace(/ /g, '-')}`;

/** Il modulo si puo' aprire da chi legge? Utenti e' solo dell'amministratore. */
export const moduloApribile = (modulo, livello) => !modulo.soloAdmin || noto(livello) === 'admin';

// ---------------------------------------------------------------------------
// LA RICERCA.
//
// Chi cerca scrive come parla: «come apro una richiesta», «esportare in pdf»,
// «predittivita» senza accento. Le parole si confrontano senza accenti e senza
// maiuscole; le parole vuote (articoli, preposizioni, «come», «posso») non
// contano; ogni parola rimasta si accorcia alla radice («esportare» -> esport,
// «richieste» -> richiest) e deve trovare una parola della voce che comincia
// cosi'. Tutte le parole devono esserci: una ricerca che si allarga a ogni
// parola in piu' non trova piu' niente di preciso.
// ---------------------------------------------------------------------------

export const normalizza = (t) => String(t == null ? '' : t)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const PAROLE_VUOTE = new Set(('il lo la i gli le l un uno una un di a da in con su per tra fra e ed o od che come cosa cos c '
  + 'del dello della dei degli delle dell al allo alla ai agli alle all dal dallo dalla dai dagli dalle dall '
  + 'nel nello nella nei negli nelle nell sul sullo sulla sui sugli sulle sull mi ti si ci vi ne non '
  + 'sono sei siamo ho hai ha abbiamo posso puoi puo dove quando quale quali quanto quanti chi perche '
  + 'mio mia miei mie tuo tua tuoi tue suo sua suoi sue questo questa questi queste quel quello quella '
  + 'faccio fare fa devo deve serve servono voglio vorrei')
  .split(/\s+/));

const SUFFISSI = ['azioni', 'azione', 'amento', 'imento', 'menti', 'mente', 'zioni', 'zione',
  'are', 'ere', 'ire', 'ato', 'ata', 'ati', 'ate', 'ito', 'ita', 'iti', 'ite', 'uto', 'uta', 'uti', 'ute'];

/** La radice di una parola gia' normalizzata: almeno tre lettere. */
export function radice(parola) {
  let p = parola;
  for (const s of SUFFISSI) {
    if (p.endsWith(s) && p.length - s.length >= 3) { p = p.slice(0, -s.length); break; }
  }
  while (p.length > 3 && /[aeiou]$/.test(p)) p = p.slice(0, -1);
  return p;
}

/** Le radici delle parole che contano in una ricerca. */
export function paroleDellaRicerca(domanda) {
  const tutte = normalizza(domanda).split(' ').filter(Boolean);
  const piene = tutte.filter(p => !PAROLE_VUOTE.has(p));
  // Una ricerca fatta solo di parole vuote («come») cerca quelle.
  const usate = piene.length ? piene : tutte;
  return [...new Set(usate.map(radice))];
}

const testiDegliElementi = (elementi) => (elementi || []).flatMap(e => [e.titolo, e.testo, e.link && e.link.testo]);

/** Tutto il testo di un modulo che chi legge vede. */
// I titoli dei blocchi contano come a video: «esportare pdf» trova i moduli
// che esportano in PDF anche quando la frase dice solo «il PDF per
// l'impianto», e «solo amministratore» trova i moduli che hanno quella parte.
export function testoDelModulo(modulo, livello) {
  const esporti = modulo.esporti || [];
  const soloAdmin = modulo.soloAmministratore || [];
  return [
    modulo.nome, modulo.aCosaServe, ...(modulo.cosaVedi || []),
    esporti.length ? 'Che cosa puoi esportare' : '', ...esporti,
    modulo.senzaEsportazioni, modulo.nienteDaModificare,
    soloAdmin.length ? 'Lo fa solo l’amministratore' : '', ...soloAdmin,
    ...notePerLivello(modulo, livello).map(n => n.testo), ...(modulo.parole || []),
  ].filter(Boolean).join(' \n ');
}

/** Tutto il testo di una sezione. */
export function testoDellaSezione(sezione) {
  return [
    sezione.titolo, sezione.intro,
    ...(sezione.gruppi || []).flatMap(g => [g.titolo, ...testiDegliElementi(g.elementi)]),
    sezione.collegamento && sezione.collegamento.testo,
  ].filter(Boolean).join(' \n ');
}

/** Tutto il testo della parte dei livelli. */
export function testoDeiLivelli(livello) {
  return ['Il tuo livello', 'livelli permessi', ...livelliDaMostrare(livello).flatMap(l => [l.nome, l.sommario, l.intro, ...l.puo, ...l.nonPuo])].join(' \n ');
}

const paroleDi = (testo) => normalizza(testo).split(' ').filter(Boolean);
const contiene = (testo, radici) => {
  const parole = paroleDi(testo);
  return radici.every(r => parole.some(p => p.startsWith(r)));
};

/**
 * Cerca nella guida che chi legge vede. Senza parole utili restituisce tutto
 * con `attiva: false`. Le voci restano nell'ordine della guida.
 */
export function cercaNellaGuida(domanda, livello) {
  const radici = radiciSicure(domanda);
  const sezioni = sezioniVisibili(livello);
  if (!radici.length) {
    return { attiva: false, radici, livelli: true, sezioni, moduli: MODULI, quanti: null };
  }
  const livelli = contiene(testoDeiLivelli(livello), radici);
  const sezioniTrovate = sezioni.filter(s => contiene(testoDellaSezione(s), radici));
  const moduliTrovati = MODULI.filter(m => contiene(testoDelModulo(m, livello), radici));
  return {
    attiva: true, radici, livelli, sezioni: sezioniTrovate, moduli: moduliTrovati,
    quanti: (livelli ? 1 : 0) + sezioniTrovate.length + moduliTrovati.length,
  };
}

// Una domanda lunghissima incollata per sbaglio non deve far lavorare la
// pagina su migliaia di parole: si guardano le prime venti.
function radiciSicure(domanda) {
  return paroleDellaRicerca(String(domanda || '').slice(0, 300)).slice(0, 20);
}

/**
 * Il testo diviso in pezzi, con le parole trovate segnate: la pagina le
 * evidenzia. Le parole si dividono come nella ricerca, senza perdere niente
 * del testo originale (accenti, maiuscole, punteggiatura).
 */
export function pezziEvidenziati(testo, radici) {
  const t = String(testo == null ? '' : testo);
  if (!radici || !radici.length) return [{ testo: t, evidenziato: false }];
  const pezzi = [];
  for (const parte of t.split(/([\p{L}\p{N}]+)/u)) {
    if (!parte) continue;
    const n = normalizza(parte);
    const si = /^[\p{L}\p{N}]+$/u.test(parte) && n && radici.some(r => n.startsWith(r));
    const ultimo = pezzi[pezzi.length - 1];
    if (ultimo && ultimo.evidenziato === !!si && !si) ultimo.testo += parte;
    else pezzi.push({ testo: parte, evidenziato: !!si });
  }
  return pezzi.length ? pezzi : [{ testo: t, evidenziato: false }];
}

// ---------------------------------------------------------------------------
// I COLLEGAMENTI: tutti quelli che la guida scrive, per la prova.
// ---------------------------------------------------------------------------

export function collegamentiDellaGuida() {
  const tutti = MODULI.map(m => ({ da: `modulo ${m.nome}`, percorso: m.percorso }));
  for (const s of SEZIONI) {
    if (s.collegamento) tutti.push({ da: `sezione ${s.titolo}`, percorso: s.collegamento.percorso });
    for (const g of s.gruppi || []) {
      for (const e of g.elementi || []) if (e.link) tutti.push({ da: `sezione ${s.titolo}`, percorso: e.link.percorso });
    }
  }
  return tutti;
}
