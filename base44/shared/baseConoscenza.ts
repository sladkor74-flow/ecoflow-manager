// Base di conoscenza normativa e operativa della commessa PFU.
//
// Fonte unica per l'agente che controlla i documenti dei fornitori e per lo
// spazio domande del gestionale. Ogni voce indica le fonti e il giorno in cui e'
// stata verificata: le norme cambiano, quindi chi la usa deve comunque
// controllare sulle fonti ufficiali che non ci siano novita' successive.
//
// Ultima verifica complessiva: 14 settembre 2026.

export const VERIFICATO_IL = '2026-09-14';

export const FONTI_UFFICIALI = [
  'https://www.normattiva.it (testi vigenti di D.Lgs. 152/2006 e decreti)',
  'https://www.gazzettaufficiale.it',
  'https://www.rentri.gov.it (RENTRI, FAQ e decreti direttoriali)',
  'https://www.albonazionalegestoriambientali.it',
  'https://www.mase.gov.it (Ministero dell\'ambiente, PFU e consultazioni)',
];

export type VoceConoscenza = {
  id: string;
  area: 'pfu' | 'tua' | 'albo' | 'rentri' | 'documenti' | 'gestionale';
  titolo: string;
  testo: string;
  fonti: string[];
  verificato_il: string;
};

export const BASE_CONOSCENZA: VoceConoscenza[] = [
  // === DM 19 novembre 2019 n. 182 (PFU) ===
  {
    id: 'pfu-obbligo-target', area: 'pfu', verificato_il: VERIFICATO_IL,
    titolo: 'Obbligo di gestione e target annuale dei PFU',
    testo: 'Produttori e importatori di pneumatici, singolarmente o in forma associata come Ecotyre, gestiscono nell\'anno solare quantita\' in peso di PFU di qualsiasi marca pari a quelle immesse sul mercato del ricambio nell\'anno precedente, dedotta la quota di usati ceduti all\'estero; 100 kg di pneumatici nuovi valgono 95 kg di PFU (art. 3 c. 1 e 4). Per il target contano i PFU raccolti e trattati nell\'anno; quelli raccolti e messi in riserva contano se trattati entro il 30 aprile dell\'anno successivo (art. 3 c. 5). I PFU da veicoli fuori uso non rientrano in questo target (art. 9 c. 9).',
    fonti: ['DM 182/2019 artt. 3 e 9', 'D.Lgs. 152/2006 art. 228'],
  },
  {
    id: 'pfu-ordine-chiamata', area: 'pfu', verificato_il: VERIFICATO_IL,
    titolo: 'Raccolta regolare e ordine di chiamata dei generatori',
    testo: 'La gestione dei PFU e\' regolare e continuativa per l\'intero anno solare. Si risponde alle richieste di raccolta secondo l\'ordine di chiamata dei generatori (gommisti, officine e altri punti di generazione), fatta salva la facolta\' di organizzare la gestione con modalita\' che ne garantiscano efficienza ed economicita\' (art. 3 c. 6). E\' il fondamento della regola interna di evadere le richieste in ordine cronologico.',
    fonti: ['DM 182/2019 art. 3 c. 6'],
  },
  {
    id: 'pfu-incarichi', area: 'pfu', verificato_il: VERIFICATO_IL,
    titolo: 'Incarichi a raccoglitori, trasportatori, stoccaggi e impianti',
    testo: 'Produttori e forme associate possono adempiere indirettamente con incarichi conferiti con contratti scritti per settori di attivita\' determinati e limitati; gli incaricati operano sotto la loro direzione e responsabilita\' e gli incarichi si comunicano al Ministero entro trenta giorni. Gli obblighi di informazione, comunicazione e rendiconto non sono delegabili (art. 3 c. 7). Il progetto del sistema collettivo deve contenere copia di tutte le autorizzazioni e iscrizioni ad albi delle imprese incaricate (Allegato VI punto 13) e l\'indicazione degli strumenti di pesatura (punto 11).',
    fonti: ['DM 182/2019 art. 3 c. 7, Allegato VI'],
  },
  {
    id: 'pfu-aree-geografiche', area: 'pfu', verificato_il: VERIFICATO_IL,
    titolo: 'Ripartizione del target per area geografica',
    testo: 'Le forme associate ripartiscono semestralmente il target per area geografica secondo l\'Allegato V: Piemonte-Valle d\'Aosta-Liguria 11%, Lombardia 15%, Trentino Alto Adige-Friuli Venezia Giulia-Veneto 12%, Emilia Romagna 8%, Toscana-Marche-Umbria 11%, Lazio-Abruzzo-Molise 13%, Campania 9%, Puglia-Basilicata-Calabria 10%, Sicilia-Sardegna 11%. E\' consentito uno scostamento del 10% sul target di ciascuna area, fermo l\'obbligo di raccolta totale del 100%.',
    fonti: ['DM 182/2019 Allegato V'],
  },
  {
    id: 'pfu-tracciabilita-scadenze', area: 'pfu', verificato_il: VERIFICATO_IL,
    titolo: 'Tracciabilita\' e scadenze dei sistemi collettivi',
    testo: 'I sistemi usano strumenti informatici che rendono tracciabili i flussi dei PFU dall\'origine alla raccolta fino al recupero (art. 3 c. 12). Scadenze verso il Ministero: 31 gennaio dichiarazione dell\'immesso (Allegato III); 31 maggio PFU gestiti (Allegato IV), bilancio con relazione sugli obiettivi e, per le forme associate, quantita\' raccolte per area con percentuale di realizzazione (Allegato VII); 31 ottobre comunicazione del contributo ambientale (art. 6). Sanzioni per i produttori o le forme associate: mancato raggiungimento del target pari al contributo dei quantitativi non gestiti maggiorato del 50%; omessa comunicazione 15% del contributo; comunicazione tardiva 5% (art. 8).',
    fonti: ['DM 182/2019 artt. 3, 4, 6 e 8'],
  },
  {
    id: 'pfu-autodemolizione', area: 'pfu', verificato_il: VERIFICATO_IL,
    titolo: 'PFU da veicoli fuori uso: il sistema ACI',
    testo: 'I PFU dei veicoli a fine vita hanno un sistema separato (art. 9): produttori e importatori di pneumatici, direttamente o tramite forme associate e soggetti abilitati, li ritirano gratis dai centri di raccolta dei veicoli fuori uso (demolitori) e sono pagati con un corrispettivo per tonnellata dal fondo presso l\'ACI, alimentato dal contributo riscosso alla vendita dei veicoli nuovi e fissato ogni anno dal Comitato entro il 31 ottobre (Allegato IX). Il Comitato, cinque membri presieduto da ACI, pubblica ogni anno l\'elenco dei soggetti abilitati (domande entro il 30 novembre) e il Disciplinare operativo. Regole del Disciplinare (versione 2024, impostazione confermata dalla modulistica 2026): il demolitore censito al PRA prenota sul portale un ritiro di almeno 1.500 kg, compatibile con i veicoli radiati, e sceglie l\'operatore; il fondo autorizza solo se ha capienza; l\'operatore ritira entro 15 giorni di calendario senza chiedere nulla al demolitore, con tolleranza del 10% in piu\' sul peso; i PFU vanno solo a recupero di materia e il peso avviato a recupero non puo\' superare di oltre il 10% quello ritirato; le pratiche si dichiarano entro il 15 del mese successivo, si fattura sul riepilogo del 16 e il fondo paga entro 45 giorni; l\'operatore garantisce almeno 100 t l\'anno; il corrispettivo puo\' variare per regione. Questi PFU non contano nel target dell\'art. 3 (art. 9 c. 9): e\' un canale del tutto separato dalla rete dei gommisti. Per questo la previsione di raccolta ACI e\' solo indicativa: i ritiri partono solo su richiesta dei demolitori, sopra 1,5 t, possono bloccarsi per incompatibilita\' con i veicoli radiati o per incapienza del fondo, il demolitore puo\' scegliere un altro operatore e il pagamento richiede formulari e certificazioni di riciclo caricati sul portale. I centri di demolizione sono impianti autorizzati iscritti al RENTRI, quindi dal 16 settembre 2026 i loro ritiri vanno con FIR digitale: verificarlo con il singolo demolitore.',
    fonti: ['DM 182/2019 art. 9', 'Disciplinare per la gestione operativa degli PFU, anno 2024', 'https://www.pneumaticifuoriuso.it'],
  },
  {
    id: 'pfu-revisione', area: 'pfu', verificato_il: VERIFICATO_IL,
    titolo: 'Revisione del DM 182/2019 in corso',
    testo: 'Il Ministero ha aperto una consultazione pubblica sulla proposta di revisione del DM 182/2019 dal 13 gennaio al 12 febbraio 2026. Alla verifica del 14 settembre 2026 non risulta adottato un nuovo decreto: vale il testo del 2019. Controllare periodicamente se la revisione viene pubblicata.',
    fonti: ['https://www.mase.gov.it, consultazione pubblica sulla revisione del DM 182/2019'],
  },

  // === D.Lgs. 152/2006 ===
  {
    id: 'tua-registro', area: 'tua', verificato_il: VERIFICATO_IL,
    titolo: 'Registro cronologico di carico e scarico',
    testo: 'Tengono il registro chi raccoglie e trasporta rifiuti a titolo professionale, commercianti e intermediari, chi effettua recupero e smaltimento, consorzi e sistemi riconosciuti, i produttori iniziali di rifiuti pericolosi e i produttori iniziali di rifiuti non pericolosi da lavorazioni industriali e artigianali e da trattamento di rifiuti e acque (art. 184 c. 3 lett. c, d, g). Sono esonerati i produttori iniziali di rifiuti non pericolosi con non piu\' di dieci dipendenti (art. 190 c. 5). Per la Cassazione la visura camerale non prova da sola il numero effettivo di dipendenti.',
    fonti: ['D.Lgs. 152/2006 artt. 184 e 190'],
  },
  {
    id: 'tua-fir-microraccolta', area: 'tua', verificato_il: VERIFICATO_IL,
    titolo: 'Formulario e microraccolta',
    testo: 'Il trasporto di rifiuti e\' accompagnato dal formulario di identificazione (FIR). La microraccolta e\' la raccolta da piu\' produttori o detentori con lo stesso automezzo, effettuata nel piu\' breve tempo tecnicamente possibile: nel formulario si indicano tutte le tappe intermedie previste nello spazio del percorso e, se il percorso cambia, il percorso effettivo nelle annotazioni.',
    fonti: ['D.Lgs. 152/2006 art. 193'],
  },
  {
    id: 'tua-albo', area: 'albo', verificato_il: VERIFICATO_IL,
    titolo: 'Iscrizione all\'Albo Nazionale Gestori Ambientali',
    testo: 'Chi raccoglie e trasporta PFU per conto di terzi deve essere iscritto all\'Albo nella categoria 4, raccolta e trasporto di rifiuti speciali non pericolosi (la 5 riguarda i pericolosi). L\'iscrizione dura cinque anni e si rinnova con autocertificazione della permanenza dei requisiti. Nel provvedimento vanno verificati il codice EER 16 01 03 (pneumatici fuori uso), i veicoli utilizzati (un automezzo non elencato non puo\' trasportare quei rifiuti), la classe e il responsabile tecnico.',
    fonti: ['D.Lgs. 152/2006 art. 212', 'DM 3 giugno 2014 n. 120 artt. 8, 9, 22'],
  },
  {
    id: 'albo-categorie-classi', area: 'albo', verificato_il: VERIFICATO_IL,
    titolo: 'Categorie, classi e requisiti finanziari dell\'Albo',
    testo: 'Categorie principali: 1 rifiuti urbani; 2-bis produttori che trasportano i propri rifiuti; 4 speciali non pericolosi; 5 speciali pericolosi; 8 intermediazione e commercio senza detenzione; 9 bonifica dei siti; 10 bonifica dei beni contenenti amianto. Per le categorie 4, 5 e 8 la classe dipende dalle tonnellate annue complessivamente gestite dall\'impresa (tutti i rifiuti, non solo i PFU): A almeno 200.000; B da 60.000 a 200.000; C da 15.000 a 60.000; D da 6.000 a 15.000; E da 3.000 a 6.000; F meno di 3.000. Un fornitore che gestisce piu\' tonnellate di quelle consentite dalla sua classe va segnalato. In categoria 4 la capacita\' finanziaria e\' di 9.000 euro per il primo veicolo e, per ogni veicolo in piu\', 5.000 euro se supera 3,5 t o 900 euro se non le supera; le garanzie finanziarie a favore dello Stato servono invece per i rifiuti pericolosi e per l\'intermediazione. E\' intermediario, e va iscritto in categoria 8, chi dispone il recupero o lo smaltimento di rifiuti per conto di terzi senza averne la materiale disponibilita\'. Diritto annuale per le categorie 1, 4, 5 e 8: da 150 euro (classe F) a 1.800 euro (classe A).',
    fonti: ['DM 3 giugno 2014 n. 120 artt. 8, 9, 11, 24', 'D.Lgs. 152/2006 artt. 183 c. 1 lett. l, 212 c. 10'],
  },
  {
    id: 'albo-responsabile-tecnico', area: 'albo', verificato_il: VERIFICATO_IL,
    titolo: 'Il responsabile tecnico (RT) e i suoi compiti',
    testo: 'Le imprese iscritte nelle categorie 1, 4, 5, 8, 9 e 10 nominano un responsabile tecnico, anche esterno, che opera in modo effettivo e continuativo. Requisiti: diploma di scuola secondaria di secondo grado, esperienza nel settore secondo categoria e classe (Allegato A della Delibera 6/2025) e idoneita\' accertata con verifica. Compiti (Delibera 1/2019): coordina il personale; definisce le procedure per emergenze, incidenti e imprevisti; vigila sul rispetto delle prescrizioni dell\'iscrizione; verifica la validita\' delle iscrizioni e delle autorizzazioni dei soggetti a cui affida i rifiuti; nelle categorie 1, 4 e 5 redige e firma l\'attestazione di idoneita\' dei veicoli e ne controlla il mantenimento. Chi e\' RT di piu\' imprese deve comunicare a ciascuna gli altri incarichi.',
    fonti: ['DM 3 giugno 2014 n. 120 artt. 12-13', 'Delibera Albo n. 1 del 23 gennaio 2019', 'Delibera Albo n. 6 del 26 novembre 2025'],
  },
  {
    id: 'albo-rt-verifiche', area: 'albo', verificato_il: VERIFICATO_IL,
    titolo: 'Verifiche di idoneita\' del responsabile tecnico',
    testo: 'Dal 2 gennaio 2026 vale la Delibera Albo n. 6 del 26 novembre 2025, che ha riunito la disciplina e abrogato le precedenti (tra cui la n. 6 del 30 maggio 2017). Verifica iniziale: modulo generale piu\' almeno un modulo specialistico (trasporto per le categorie 1, 4 e 5; intermediazione per la 8; bonifica siti per la 9; amianto per la 10), al massimo tre moduli per sessione; 40 quiz a risposta multipla per modulo in 60 minuti; +1 per risposta esatta, -0,5 per errata, 0 per non data; si supera con almeno 32 punti nel generale e 34 nello specialistico. L\'idoneita\' vale cinque anni. Verifica di aggiornamento: solo il modulo specialistico, che contiene anche quiz generali, soglia 28 punti; si puo\' sostenere dall\'anno prima della scadenza fino a 12 mesi dopo, ma dalla scadenza al superamento il RT non puo\' operare; oltre i 12 mesi si ripete la verifica iniziale. Il legale rappresentante con tre anni continuativi di esperienza nel settore puo\' essere dispensato dalle verifiche solo per la propria impresa; restano titolo di studio ed esperienza e la dispensa decade se cessa la rappresentanza. I 3.600 quiz ufficiali aggiornati, attenti alla tracciabilita\' digitale, sono pubblicati sul sito dell\'Albo dal 19 dicembre 2025; il SISTRI e\' abolito dal 2019 e sostituito dal RENTRI.',
    fonti: ['Delibera Albo n. 6 del 26 novembre 2025', 'https://www.albonazionalegestoriambientali.it'],
  },
  {
    id: 'tua-autorizzazioni', area: 'tua', verificato_il: VERIFICATO_IL,
    titolo: 'Autorizzazioni di impianti e stoccaggi',
    testo: 'Un impianto o uno stoccaggio deve essere autorizzato per il codice EER 16 01 03 e per le operazioni svolte, per esempio R13 per la messa in riserva e R3 o R1 per il recupero. Validita\': autorizzazione unica art. 208 dieci anni, con domanda di rinnovo 180 giorni prima della scadenza; procedura semplificata artt. 214-216 con comunicazione da rinnovare ogni cinque anni; AUA (DPR 59/2013) quindici anni; AIA secondo il provvedimento. La gomma vulcanizzata granulare cessa di essere rifiuto alle condizioni del DM 31 marzo 2020 n. 78.',
    fonti: ['D.Lgs. 152/2006 artt. 184-ter, 208, 214-216', 'DPR 59/2013', 'DM 78/2020'],
  },
  {
    id: 'tua-sanzioni-2025', area: 'tua', verificato_il: VERIFICATO_IL,
    titolo: 'Sanzioni inasprite per gli illeciti sui rifiuti',
    testo: 'Il decreto-legge 8 agosto 2025 n. 116, convertito dalla legge 3 ottobre 2025 n. 147 (in vigore dall\'8 ottobre 2025), ha inasprito le pene per gli illeciti nella gestione dei rifiuti, tra cui gli artt. 255 e 256 del D.Lgs. 152/2006 sulla gestione non autorizzata e il trasporto illecito, con effetti anche sulla responsabilita\' delle imprese (D.Lgs. 231/2001).',
    fonti: ['DL 116/2025 convertito dalla L. 147/2025'],
  },

  // === RENTRI (DM 4 aprile 2023 n. 59) ===
  {
    id: 'rentri-iscrizione', area: 'rentri', verificato_il: VERIFICATO_IL,
    titolo: 'Chi si iscrive al RENTRI',
    testo: 'Si iscrivono al RENTRI, qualunque sia il numero di dipendenti, chi raccoglie e trasporta rifiuti a titolo professionale, gli impianti di recupero e smaltimento e gli intermediari: la finestra si e\' chiusa il 13 febbraio 2025. I produttori si iscrivono per fasce di dipendenti e tipo di rifiuto. La legge di bilancio 2026 (L. 30 dicembre 2025 n. 199) ha escluso tra gli altri consorzi, piccoli imprenditori agricoli, imprese che trasportano i propri rifiuti non pericolosi e liberi professionisti; il RENTRI ne ha comunicato la cancellazione il 30 gennaio 2026. Il contributo annuale si versa entro il 30 aprile.',
    fonti: ['DM 59/2023', 'L. 199/2025', 'https://www.rentri.gov.it'],
  },
  {
    id: 'rentri-fir-digitale', area: 'rentri', verificato_il: VERIFICATO_IL,
    titolo: 'FIR digitale: date e sanzioni',
    testo: 'Nuovi modelli di registro e FIR con vidimazione digitale dal 13 febbraio 2025. Per i soggetti iscritti il FIR digitale (xFIR) era obbligatorio dal 13 febbraio 2026, ma il periodo transitorio con il cartaceo e\' stato prorogato al 15 settembre 2026 (DL 31 dicembre 2025 n. 200, art. 13, convertito dalla L. 27 febbraio 2026 n. 26). Dal 16 settembre 2026 gli iscritti emettono il FIR solo in digitale; dal 15 settembre 2026 si applicano le sanzioni per omessa o incompleta trasmissione dei dati dei formulari al RENTRI (secondo fonti di settore da 500 a 2.000 euro per i non pericolosi, escluse le violazioni solo formali che non compromettono la tracciabilita\'). Il formato lo decide il produttore all\'emissione e vale per tutta la filiera; la stampa di un xFIR non lo rende cartaceo.',
    fonti: ['DL 200/2025 art. 13 convertito dalla L. 26/2026', 'https://www.rentri.gov.it'],
  },
  {
    id: 'rentri-produttori-non-iscritti', area: 'rentri', verificato_il: VERIFICATO_IL,
    titolo: 'Gommisti e produttori non iscritti al RENTRI',
    testo: 'I soggetti esclusi dall\'obbligo di iscrizione (art. 190 c. 5 e 6 del D.Lgs. 152/2006), come i gommisti con non piu\' di dieci dipendenti che producono PFU non pericolosi, emettono il FIR solo in formato cartaceo, vidimato digitalmente tramite il RENTRI, e non trasmettono al RENTRI i dati dei formulari (FAQ RENTRI del 13 gennaio 2026). Quindi dal 16 settembre 2026 le primarie da questi punti di raccolta restano su FIR cartaceo vidimato anche se il trasportatore e\' iscritto, mentre i trasporti tra soggetti iscritti, come le secondarie da stoccaggio a impianto, vanno con FIR digitale. Il trasportatore concorda prima del ritiro tipo di formulario, firme e strumenti.',
    fonti: ['FAQ RENTRI 13 gennaio 2026', 'https://www.rentri.gov.it/area-produttori-di-rifiuti-non-iscritti', 'D.Lgs. 152/2006 art. 190'],
  },

  // === Documenti di qualifica ===
  {
    id: 'doc-regole-base', area: 'documenti', verificato_il: VERIFICATO_IL,
    titolo: 'Regole di validita\' dei documenti ricorrenti',
    testo: 'Visura camerale: sei mesi dal rilascio (art. 41 DPR 445/2000). DURC: 120 giorni (DM 30 gennaio 2015). Iscrizione all\'Albo: fino alla scadenza del provvedimento, rinnovo quinquennale. Autorizzazioni d\'impianto: fino alla scadenza indicata nel provvedimento, con le durate tipiche della voce sulle autorizzazioni. White list antimafia della Prefettura: dodici mesi, con domanda di rinnovo presentata nei termini. Iscrizione RENTRI: nessuna scadenza, ma va verificato il pagamento del contributo annuale.',
    fonti: ['DPR 445/2000 art. 41', 'DM 30 gennaio 2015', 'L. 190/2012 art. 1 c. 52-53'],
  },

  // === Regole operative del gestionale, confermate dalla direzione SMOCO ===
  {
    id: 'gest-periodo-fatturazione', area: 'gestionale', verificato_il: VERIFICATO_IL,
    titolo: 'Periodo di competenza, fatturazione e anno dei dati',
    testo: 'Il raccolto di un periodo si calcola solo sui formulari con stato terminato, per data di fine trasporto: mai con i campi mese e anno del record ne\' con la data di chiusura dell\'ordine. In fatturazione vanno solo i terminati, mai ordini con altro stato, e i tre canali RETE, ACI ed EXTRA RACCOLTA restano separati. Si lavora sui dati dell\'anno in corso: quelli degli anni precedenti non si usano, salvo le richieste arretrate ancora da evadere.',
    fonti: ['Regole della direzione SMOCO'],
  },
  {
    id: 'gest-target', area: 'gestionale', verificato_il: VERIFICATO_IL,
    titolo: 'Target dei raccoglitori e del contratto',
    testo: 'I target si scrivono una sola volta, in Target & Status, e tutti i moduli li leggono da li\'. Il target annuo di un raccoglitore si fissa a inizio anno o quando comincia a lavorare e si ripartisce mese per mese a inizio mese: i ragionamenti usano il mensile e la somma dei mesi coincide, a meno di arrotondamenti, con l\'annuo. Le righe sono per impianto di destinazione, regione e raccoglitore; SMOCO ha un target per regione. Il contratto Ecotyre fissa il target per regione, per classe di pneumatico e per destinazione.',
    fonti: ['Regole della direzione SMOCO'],
  },
  {
    id: 'gest-liste-assegnati', area: 'gestionale', verificato_il: VERIFICATO_IL,
    titolo: 'Liste degli assegnati e priorita\' di evasione',
    testo: 'Ogni mese il consorzio assegna a ciascun raccoglitore una lista di richieste proporzionata al suo target, circa 4 t per ritiro: e\' la lista a stabilire chi deve evadere, e una richiesta si evade una sola volta. Sul portale la richiesta resta assegnata finche\' non viene terminata o cancellata; le cancellazioni hanno un motivo (per esempio ritirata da altro operatore, livelli minimi non raggiunti, rifiuto, ordine doppio o inesistente, sostituzione per aggiornamento dati). Ordine di evasione nella stessa provincia: prima le richieste indicate come prioritarie nei file, che sono forzature chieste dal consorzio via email e prevalgono sempre; poi quelle immesse negli anni precedenti; poi le altre per data di immissione. Scavalcare richieste piu\' vecchie della stessa zona le rende trascurate.',
    fonti: ['Regole della direzione SMOCO', 'DM 182/2019 art. 3 c. 6'],
  },
  {
    id: 'gest-raccoglitori-2026', area: 'gestionale', verificato_il: VERIFICATO_IL,
    titolo: 'Situazione dei raccoglitori nel 2026',
    testo: 'In Puglia raccolgono sia SMOCO sia Pneuservice, quindi le loro zone si sovrappongono normalmente. Gli ordini che il portale assegna a Logistica Srl finiscono nella lista di Nappi Sud: nel 2026 Logistica Srl fa solo trasporti di secondarie. Royal Green non e\' contrattualizzata. C.L. Service non raccoglie a settembre 2026.',
    fonti: ['Indicazioni della direzione SMOCO, settembre 2026'],
  },
  {
    id: 'gest-uso-gestionale', area: 'gestionale', verificato_il: VERIFICATO_IL,
    titolo: 'Il gestionale sostituisce il file Excel',
    testo: 'Il gestionale nasce per lavorare senza il file Excel "Gestione Ecotyre": le importazioni da Excel servono solo al passaggio iniziale, e il file resta in uso solo per prudenza finche\' il gestionale non e\' completo e collaudato. Per i dati fa fede il gestionale.',
    fonti: ['Regole della direzione SMOCO'],
  },
  {
    id: 'gest-canali-indipendenti', area: 'gestionale', verificato_il: VERIFICATO_IL,
    titolo: 'RETE, ACI ed Extra Raccolta sono canali indipendenti',
    testo: 'RETE (richieste dei punti di raccolta dal portale Ecotyre), ACI (ritiri dai demolitori pagati dal fondo ACI) ed EXTRA RACCOLTA (interventi extra inseriti a mano) sono canali indipendenti: si osservano, analizzano, controllano e fatturano separatamente e non si sommano mai. Tutti i target, cioe\' contratto Ecotyre per regione, raccoglitori e impianti, si confrontano solo con la RETE. L\'ACI ha una previsione indicativa nel contratto ACI Ecotyre (per il 2026 650 t su tutte le regioni, con corrispettivo di 230-240 euro/t secondo la regione) che di solito non si raggiunge per le criticita\' del circuito ACI. L\'Extra Raccolta non ha target.',
    fonti: ['Regole della direzione SMOCO, settembre 2026'],
  },
];

/** Aree normative, senza le regole interne del gestionale. */
export const AREE_NORMATIVE = ['pfu', 'tua', 'albo', 'rentri', 'documenti'];

/** Testo compatto delle voci scelte, da passare a un modello come riferimento. */
export function testoBaseConoscenza(aree?: string[]) {
  return testoConoscenza([], aree);
}

// Voci aggiunte dal gestionale (entita' ConoscenzaAssistente): FAQ confermate,
// regole interne e aggiornamenti normativi approvati. Un aggiornamento con
// voce_id sostituisce il testo della voce del codice finche' non la si riscrive qui.
export type VoceApprovata = {
  tipo: string;
  area?: string;
  titolo?: string;
  testo?: string;
  fonti_json?: string;
  voce_id?: string;
  verificato_il?: string;
};

const fontiDi = (v: VoceApprovata) => {
  try { const f = JSON.parse(v.fonti_json || '[]'); return Array.isArray(f) ? f.map(String) : []; } catch { return []; }
};

/** Voci approvate e attive salvate nel gestionale; lista vuota se l'entita' non e' leggibile. */
export async function vociApprovate(base44) {
  try {
    const voci = await base44.asServiceRole.entities.ConoscenzaAssistente.filter({ stato: 'approvata' }, '-created_date', 500);
    return voci.filter(v => v.attiva !== false);
  } catch (_e) {
    return [];
  }
}

export function testoConoscenza(approvate: VoceApprovata[] = [], aree?: string[]) {
  const ammessa = (area?: string) => !aree || !aree.length || aree.includes(area || 'gestionale');
  const sostituzioni = new Map(approvate.filter(v => v.tipo === 'aggiornamento_normativo' && v.voce_id).map(v => [v.voce_id, v]));
  const righe = BASE_CONOSCENZA.filter(v => ammessa(v.area)).map(v => {
    const s = sostituzioni.get(v.id);
    if (s && s.testo) {
      const fonti = fontiDi(s);
      return `- ${v.titolo} (aggiornata il ${s.verificato_il || ''}; fonti: ${(fonti.length ? fonti : v.fonti).join('; ')}): ${s.testo}`;
    }
    return `- ${v.titolo} (verificato il ${v.verificato_il}; fonti: ${v.fonti.join('; ')}): ${v.testo}`;
  });
  for (const v of approvate) {
    if ((v.tipo === 'aggiornamento_normativo' && v.voce_id && BASE_CONOSCENZA.some(b => b.id === v.voce_id)) || !v.testo || !ammessa(v.area)) continue;
    const etichetta = v.tipo === 'faq' ? 'FAQ confermata' : v.tipo === 'regola_interna' ? 'Regola interna' : 'Aggiornamento approvato';
    const fonti = fontiDi(v);
    righe.push(`- ${etichetta}: ${v.titolo || ''} (${v.verificato_il ? 'del ' + v.verificato_il : ''}${fonti.length ? '; fonti: ' + fonti.join('; ') : ''}): ${v.testo}`);
  }
  return righe.join('\n');
}
