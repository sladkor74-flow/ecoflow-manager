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
  area: 'pfu' | 'tua' | 'rentri' | 'documenti';
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
    titolo: 'PFU da veicoli fuori uso (canale ACI)',
    testo: 'I PFU dei veicoli a fine vita sono raccolti e gestiti dietro corrispettivo pagato dal fondo costituito presso l\'Automobile Club d\'Italia, alimentato dal contributo riscosso alla vendita dei veicoli nuovi e vigilato da un comitato di cinque membri presieduto da ACI. Le attivita\' di ritiro e i costi si concordano con i demolitori. Non contano nel target dell\'art. 3: rientrano negli obiettivi della filiera dei veicoli fuori uso (D.Lgs. 209/2003).',
    fonti: ['DM 182/2019 art. 9'],
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
    id: 'tua-albo', area: 'tua', verificato_il: VERIFICATO_IL,
    titolo: 'Iscrizione all\'Albo Nazionale Gestori Ambientali',
    testo: 'Chi raccoglie e trasporta PFU per conto di terzi deve essere iscritto all\'Albo nella categoria 4, raccolta e trasporto di rifiuti speciali non pericolosi (la 5 riguarda i pericolosi). L\'iscrizione si rinnova ogni cinque anni e richiede garanzie finanziarie. Nel provvedimento vanno verificati il codice EER 16 01 03 (pneumatici fuori uso) e i veicoli utilizzati: un automezzo non elencato non puo\' trasportare quei rifiuti.',
    fonti: ['D.Lgs. 152/2006 art. 212', 'DM 3 giugno 2014 n. 120'],
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
];

/** Testo compatto delle voci scelte, da passare a un modello come riferimento. */
export function testoBaseConoscenza(aree?: string[]) {
  const voci = aree && aree.length ? BASE_CONOSCENZA.filter(v => aree.includes(v.area)) : BASE_CONOSCENZA;
  return voci.map(v => `- ${v.titolo} (verificato il ${v.verificato_il}; fonti: ${v.fonti.join('; ')}): ${v.testo}`).join('\n');
}
