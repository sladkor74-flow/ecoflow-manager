// Etichette, colori ed elenco proposto del modulo Qualifica Fornitori.

export const RUOLI = {
  raccolta: 'Raccolta',
  trasporto_secondaria: 'Trasporto secondarie',
  trattamento: 'Impianto',
  stoccaggio: 'Stoccaggio',
  cliente: 'Cliente',
};

export const CATEGORIE = {
  anagrafica: 'Anagrafica',
  regolarita_contributiva: 'Regolarità contributiva',
  antimafia: 'Antimafia',
  albo_gestori: 'Albo Gestori Ambientali',
  autorizzazione_impianto: 'Autorizzazione impianto',
  garanzia_finanziaria: 'Garanzia finanziaria',
  assicurazione: 'Assicurazione',
  contratto: 'Contratto',
  certificazione: 'Certificazione',
  end_of_waste: 'End of Waste',
  altro: 'Altro',
};

// Stato di un singolo documento richiesto.
export const STATI_REQUISITO = {
  scaduto: { etichetta: 'Scaduto', classe: 'bg-red-100 text-red-800 border-red-200', punto: 'bg-red-500' },
  non_conforme: { etichetta: 'Non conforme', classe: 'bg-red-100 text-red-800 border-red-200', punto: 'bg-red-500' },
  mancante: { etichetta: 'Mancante', classe: 'bg-orange-100 text-orange-800 border-orange-200', punto: 'bg-orange-500' },
  in_scadenza: { etichetta: 'In scadenza', classe: 'bg-amber-100 text-amber-800 border-amber-200', punto: 'bg-amber-500' },
  da_verificare: { etichetta: 'Da verificare', classe: 'bg-sky-100 text-sky-800 border-sky-200', punto: 'bg-sky-500' },
  in_analisi: { etichetta: 'In analisi', classe: 'bg-violet-100 text-violet-800 border-violet-200', punto: 'bg-violet-500' },
  facoltativo_mancante: { etichetta: 'Facoltativo', classe: 'bg-muted text-muted-foreground border-border', punto: 'bg-muted-foreground/40' },
  valido: { etichetta: 'Valido', classe: 'bg-emerald-100 text-emerald-800 border-emerald-200', punto: 'bg-emerald-500' },
};

// Stato complessivo di un fornitore.
export const STATI_SOGGETTO = {
  critico: { etichetta: 'Critico', classe: 'bg-red-100 text-red-800 border-red-200' },
  da_completare: { etichetta: 'Da completare', classe: 'bg-orange-100 text-orange-800 border-orange-200' },
  in_scadenza: { etichetta: 'Qualificato, in scadenza', classe: 'bg-amber-100 text-amber-800 border-amber-200' },
  qualificato: { etichetta: 'Qualificato', classe: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

export const STATI_ALERT = ['scaduto', 'non_conforme', 'mancante', 'in_scadenza', 'da_verificare'];

// Ordine di urgenza degli alert.
export const URGENZA = { scaduto: 0, non_conforme: 1, in_scadenza: 2, mancante: 3, da_verificare: 4 };

export function dataIt(d) {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4);
}

export function quandoScade(giorni) {
  if (giorni == null) return '';
  if (giorni < 0) return `scaduto da ${Math.abs(giorni)} ${Math.abs(giorni) === 1 ? 'giorno' : 'giorni'}`;
  if (giorni === 0) return 'scade oggi';
  return `tra ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}`;
}

export function problemiDi(requisito) {
  return Array.isArray(requisito && requisito.problemi) ? requisito.problemi : [];
}

// Evento del modulo: la pagina lo emette dopo ogni ricalcolo, il menu lo ascolta
// per aggiornare il contatore degli alert senza attendere il prossimo giro.
export const EVENTO_AGGIORNAMENTO = 'qualifica-fornitori-aggiornata';

// Elenco documenti proposto come punto di partenza. Si modifica liberamente dal
// catalogo del modulo e va sostituito con l'elenco interno quando e' pronto.
export const CATALOGO_PROPOSTO = [
  {
    nome: 'Visura camerale',
    categoria: 'anagrafica',
    si_applica_a: 'raccolta,trasporto_secondaria,trattamento,stoccaggio,cliente',
    obbligatorio: true,
    tipo_scadenza: 'da_emissione',
    validita_mesi: 6,
    preavviso_giorni: 30,
    riferimento_normativo: 'Art. 41 DPR 445/2000: i certificati non relativi a stati immutabili valgono sei mesi dal rilascio',
    descrizione: 'Visura ordinaria aggiornata, con oggetto sociale, legale rappresentante e sedi operative.',
    ordine: 10,
  },
  {
    nome: 'DURC',
    categoria: 'regolarita_contributiva',
    si_applica_a: 'raccolta,trasporto_secondaria,trattamento,stoccaggio',
    obbligatorio: true,
    tipo_scadenza: 'da_emissione',
    validita_giorni: 120,
    preavviso_giorni: 20,
    riferimento_normativo: 'DM 30 gennaio 2015: il documento unico di regolarità contributiva vale 120 giorni',
    descrizione: 'Esito regolare, intestato al fornitore.',
    ordine: 20,
  },
  {
    nome: 'Iscrizione White List antimafia',
    categoria: 'antimafia',
    si_applica_a: 'raccolta,trasporto_secondaria,trattamento,stoccaggio',
    obbligatorio: true,
    tipo_scadenza: 'da_documento',
    validita_mesi: 12,
    preavviso_giorni: 60,
    riferimento_normativo: 'Art. 1 commi 52-53 L. 190/2012 e DPCM 18 aprile 2013: trasporto e smaltimento di rifiuti per conto di terzi',
    descrizione: 'Iscrizione nell\'elenco della Prefettura o domanda di rinnovo presentata nei termini.',
    ordine: 30,
  },
  {
    nome: 'Contratto con SMOCO',
    categoria: 'contratto',
    si_applica_a: 'raccolta,trasporto_secondaria,trattamento,stoccaggio',
    obbligatorio: true,
    tipo_scadenza: 'da_documento',
    preavviso_giorni: 60,
    descrizione: 'Contratto o accordo firmato da entrambe le parti, con durata e condizioni economiche.',
    ordine: 40,
  },
  {
    nome: 'Iscrizione Albo Nazionale Gestori Ambientali',
    categoria: 'albo_gestori',
    si_applica_a: 'raccolta,trasporto_secondaria',
    obbligatorio: true,
    tipo_scadenza: 'da_documento',
    preavviso_giorni: 90,
    riferimento_normativo: 'Art. 212 D.Lgs 152/2006 e DM 120/2014: categorie 4 o 5, iscrizione quinquennale',
    descrizione: 'Provvedimento di iscrizione in vigore.',
    ordine: 50,
  },
  {
    nome: 'Garanzia finanziaria per l\'Albo',
    categoria: 'garanzia_finanziaria',
    si_applica_a: 'raccolta,trasporto_secondaria',
    obbligatorio: false,
    tipo_scadenza: 'da_documento',
    preavviso_giorni: 60,
    descrizione: 'Polizza o fideiussione accettata dalla sezione regionale dell\'Albo.',
    ordine: 55,
  },
  {
    nome: 'Autorizzazione dell\'impianto',
    categoria: 'autorizzazione_impianto',
    si_applica_a: 'trattamento,stoccaggio',
    obbligatorio: true,
    tipo_scadenza: 'da_documento',
    preavviso_giorni: 180,
    riferimento_normativo: 'Art. 208 D.Lgs 152/2006 dieci anni con rinnovo 180 giorni prima; AUA DPR 59/2013 quindici anni; procedura semplificata artt. 214-216 cinque anni; AIA',
    descrizione: 'Provvedimento di autorizzazione in vigore.',
    ordine: 60,
  },
  {
    nome: 'Garanzie finanziarie dell\'impianto',
    categoria: 'garanzia_finanziaria',
    si_applica_a: 'trattamento,stoccaggio',
    obbligatorio: true,
    tipo_scadenza: 'da_documento',
    preavviso_giorni: 60,
    descrizione: 'Garanzie prestate a favore dell\'ente che ha rilasciato l\'autorizzazione.',
    ordine: 65,
  },
  {
    nome: 'Iscrizione RENTRI',
    categoria: 'anagrafica',
    si_applica_a: 'raccolta,trasporto_secondaria,trattamento,stoccaggio',
    obbligatorio: true,
    tipo_scadenza: 'nessuna',
    preavviso_giorni: 30,
    riferimento_normativo: 'DM 4 aprile 2023 n. 59: registro elettronico nazionale per la tracciabilità dei rifiuti',
    descrizione: 'Ricevuta di iscrizione e versamento del contributo annuale.',
    ordine: 70,
  },
  {
    nome: 'Conformità End of Waste della gomma vulcanizzata',
    categoria: 'end_of_waste',
    si_applica_a: 'trattamento',
    obbligatorio: false,
    tipo_scadenza: 'nessuna',
    preavviso_giorni: 30,
    riferimento_normativo: 'DM 31 marzo 2020 n. 78: gomma vulcanizzata granulare da PFU',
    descrizione: 'Documento che attesta la conformità al regolamento End of Waste.',
    ordine: 80,
  },
  {
    nome: 'Polizza di responsabilità civile',
    categoria: 'assicurazione',
    si_applica_a: 'raccolta,trasporto_secondaria,trattamento,stoccaggio',
    obbligatorio: false,
    tipo_scadenza: 'da_documento',
    preavviso_giorni: 30,
    descrizione: 'Polizza in corso di validità con quietanza di pagamento.',
    ordine: 90,
  },
  {
    nome: 'Certificazione ISO 14001',
    categoria: 'certificazione',
    si_applica_a: 'raccolta,trasporto_secondaria,trattamento,stoccaggio',
    obbligatorio: false,
    tipo_scadenza: 'da_documento',
    preavviso_giorni: 60,
    descrizione: 'Certificato in corso di validità rilasciato da un ente accreditato.',
    ordine: 95,
  },
  {
    nome: 'Contratto con Ecotyre',
    categoria: 'contratto',
    si_applica_a: 'cliente',
    obbligatorio: true,
    tipo_scadenza: 'da_documento',
    preavviso_giorni: 90,
    descrizione: 'Contratto di servizio in vigore per la raccolta dei PFU.',
    ordine: 40,
  },
  // Aggiunte il 21/09/2026: documenti che la normativa dei rifiuti e
  // dell'autotrasporto rende rilevanti per la filiera PFU. Nascono TUTTE
  // facoltative, cosi' si vedono sulla scheda di ogni fornitore senza
  // produrre alert: si decide con calma quali chiedere davvero e solo allora
  // si mettono obbligatorie dal catalogo del modulo.
  {
    nome: "Attestazione di pagamento del diritto annuale all'Albo",
    categoria: 'albo_gestori',
    si_applica_a: 'raccolta,trasporto_secondaria',
    obbligatorio: false,
    tipo_scadenza: 'da_emissione',
    validita_mesi: 12,
    preavviso_giorni: 45,
    riferimento_normativo: "DM 120/2014: versamento entro il 30 aprile di ogni anno. Il mancato pagamento comporta la sospensione d'ufficio dall'Albo e, dopo un anno, la cancellazione (art. 20 c.1 lett. f)",
    descrizione: "Ricevuta del versamento per l'anno in corso. Senza, l'iscrizione all'Albo viene sospesa e il trasportatore non puo' lavorare pur avendo in mano il provvedimento di iscrizione: per questo va chiesta a parte. Ne abbiamo trovate archiviate al posto del provvedimento stesso.",
    ordine: 52,
  },
  {
    nome: "Iscrizione all'Albo autotrasportatori conto terzi (REN)",
    categoria: 'altro',
    si_applica_a: 'raccolta,trasporto_secondaria',
    obbligatorio: false,
    tipo_scadenza: 'nessuna',
    preavviso_giorni: 60,
    riferimento_normativo: "Art. 230 D.lgs 152/2006 e Reg. UE 1071/2009: l'abilitazione ambientale non sostituisce quella stradale, si aggiunge",
    descrizione: "Chi trasporta rifiuti per conto di terzi deve essere iscritto anche all'Albo degli autotrasportatori e al Registro Elettronico Nazionale. Senza, non si ottiene nemmeno l'iscrizione all'Albo gestori.",
    ordine: 54,
  },
  {
    nome: 'Carte di circolazione dei veicoli',
    categoria: 'altro',
    si_applica_a: 'raccolta,trasporto_secondaria',
    obbligatorio: false,
    tipo_scadenza: 'nessuna',
    preavviso_giorni: 30,
    riferimento_normativo: 'Art. 93 D.lgs 285/1992, Codice della Strada',
    descrizione: "Carte di circolazione dei mezzi usati per la raccolta. Servono a verificare che le targhe siano quelle iscritte all'Albo gestori: un mezzo non iscritto non puo' trasportare rifiuti.",
    ordine: 56,
  },
  {
    nome: 'Patenti di guida degli autisti',
    categoria: 'altro',
    si_applica_a: 'raccolta,trasporto_secondaria',
    obbligatorio: false,
    tipo_scadenza: 'da_documento',
    preavviso_giorni: 60,
    riferimento_normativo: 'Art. 116 e 126 D.lgs 285/1992',
    descrizione: "Patenti in corso di validita' degli autisti impiegati. Se riguardano un solo fornitore conviene intestare la voce a lui, dal catalogo.",
    ordine: 57,
  },
  {
    nome: 'Carta di qualificazione del conducente (CQC)',
    categoria: 'altro',
    si_applica_a: 'raccolta,trasporto_secondaria',
    obbligatorio: false,
    tipo_scadenza: 'da_documento',
    preavviso_giorni: 60,
    riferimento_normativo: 'D.lgs 286/2005: obbligatoria per chi guida professionalmente veicoli adibiti al trasporto di cose oltre 3,5 t',
    descrizione: "CQC merci in corso di validita'. Si rinnova ogni cinque anni con un corso di formazione periodica.",
    ordine: 58,
  },
  {
    nome: 'Documentazione antincendio (SCIA o CPI)',
    categoria: 'autorizzazione_impianto',
    si_applica_a: 'trattamento,stoccaggio',
    obbligatorio: false,
    tipo_scadenza: 'da_emissione',
    validita_mesi: 60,
    preavviso_giorni: 90,
    riferimento_normativo: "DPR 151/2011, Allegato I attivita' 43: depositi di pneumatici e prodotti della gomma oltre 10.000 kg (categoria B oltre 50.000 kg). Attestazione di rinnovo periodico ogni cinque anni",
    descrizione: "SCIA antincendio con la ricevuta del Comando dei Vigili del Fuoco, oppure il CPI, oppure l'attestazione di rinnovo periodico di conformita'. Un piazzale di PFU supera i dieci quintali senza sforzo: e' il rischio piu' concreto di questa filiera.",
    ordine: 62,
  },
  {
    nome: 'Polizza per danni ambientali',
    categoria: 'assicurazione',
    si_applica_a: 'trattamento,stoccaggio',
    obbligatorio: false,
    tipo_scadenza: 'da_documento',
    preavviso_giorni: 45,
    riferimento_normativo: 'Parte VI del D.lgs 152/2006 sul danno ambientale',
    descrizione: "Copertura per inquinamento e danno ambientale, che la responsabilita' civile ordinaria spesso esclude. Va guardata la sezione inquinamento, non basta il massimale generale.",
    ordine: 92,
  },
  {
    nome: 'Documento di valutazione dei rischi (DVR)',
    categoria: 'certificazione',
    si_applica_a: 'raccolta,trasporto_secondaria,trattamento,stoccaggio',
    obbligatorio: false,
    tipo_scadenza: 'nessuna',
    preavviso_giorni: 30,
    riferimento_normativo: 'Art. 17 e 28 D.lgs 81/2008: obbligo non delegabile del datore di lavoro',
    descrizione: 'Almeno il frontespizio con data certa e le firme del datore di lavoro, del RSPP e del medico competente. Si aggiorna quando cambiano lavorazioni o organizzazione.',
    ordine: 96,
  },
  {
    nome: 'Modello 231 e Codice etico',
    categoria: 'certificazione',
    si_applica_a: 'raccolta,trasporto_secondaria,trattamento,stoccaggio',
    obbligatorio: false,
    tipo_scadenza: 'nessuna',
    preavviso_giorni: 30,
    riferimento_normativo: 'D.lgs 231/2001, art. 25-undecies: i reati ambientali sono fra i reati presupposto',
    descrizione: "Non e' un obbligo di legge, ma dei reati ambientali risponde anche la societa'. Sempre piu' consorzi lo chiedono lungo la filiera.",
    ordine: 98,
  },
  // Dalla lista interna "DOCUMENTI DA RICHIEDERE" della cartella dei contratti
  // subfornitori: otto documenti che l’azienda chiedeva gia’ e che il catalogo
  // del gestionale non chiedeva a nessuno. Sono la verifica dell’idoneita’
  // tecnico professionale dell’appaltatore, art. 26 D.lgs 81/2008. Anche
  // queste nascono facoltative.
  {
    nome: 'Autocertificazione di idoneita tecnico professionale',
    categoria: 'certificazione',
    si_applica_a: 'raccolta,trasporto_secondaria,trattamento,stoccaggio',
    obbligatorio: false,
    tipo_scadenza: 'da_emissione',
    validita_mesi: 12,
    preavviso_giorni: 30,
    riferimento_normativo: "Art. 26 c.1 lett. a) n.2 D.lgs 81/2008: chi affida lavori o servizi deve verificare l'idoneita' tecnico professionale dell'impresa",
    descrizione: "Autocertificazione ai sensi del DPR 445/2000, sul modello che l'azienda gia' usa (AUTOCERTIFICAZIONE IDONEITA' TECNICO PROFESSIONALE.docx). Si rinnova ogni anno.",
    ordine: 100,
  },
  {
    nome: 'Dichiarazione organico medio annuo e CCNL applicato',
    categoria: 'certificazione',
    si_applica_a: 'raccolta,trasporto_secondaria,trattamento,stoccaggio',
    obbligatorio: false,
    tipo_scadenza: 'da_emissione',
    validita_mesi: 12,
    preavviso_giorni: 30,
    riferimento_normativo: 'Art. 26 c.1 lett. a) n.2 D.lgs 81/2008',
    descrizione: 'Organico medio annuo distinto per qualifica e contratto collettivo applicato ai dipendenti. Modello interno MOD_Dichiarazione-organico-medio-annuo-DOMA.docx.',
    ordine: 102,
  },
  {
    nome: 'Dichiarazione di assenza di provvedimenti interdittivi',
    categoria: 'certificazione',
    si_applica_a: 'raccolta,trasporto_secondaria,trattamento,stoccaggio',
    obbligatorio: false,
    tipo_scadenza: 'da_emissione',
    validita_mesi: 12,
    preavviso_giorni: 30,
    riferimento_normativo: "Art. 14 D.lgs 81/2008: sospensione dell'attivita' imprenditoriale per lavoro irregolare o gravi violazioni sulla sicurezza",
    descrizione: "Dichiarazione di non essere destinatari di provvedimenti di sospensione o interdittivi. Si rinnova ogni anno insieme all'idoneita' tecnico professionale.",
    ordine: 104,
  },
  {
    nome: 'Modello UNILAV dei lavoratori impiegati',
    categoria: 'altro',
    si_applica_a: 'raccolta,trasporto_secondaria,trattamento,stoccaggio',
    obbligatorio: false,
    tipo_scadenza: 'nessuna',
    preavviso_giorni: 30,
    riferimento_normativo: 'DM 30 ottobre 2007: comunicazione obbligatoria di instaurazione del rapporto di lavoro',
    descrizione: 'Comunicazioni UNILAV dei lavoratori impiegati nel servizio: servono a dimostrare che chi lavora per noi e’ regolarmente assunto.',
    ordine: 106,
  },
  {
    nome: 'Nomine delle figure della sicurezza',
    categoria: 'certificazione',
    si_applica_a: 'raccolta,trasporto_secondaria,trattamento,stoccaggio',
    obbligatorio: false,
    tipo_scadenza: 'nessuna',
    preavviso_giorni: 30,
    riferimento_normativo: 'Titolo I Capo III D.lgs 81/2008',
    descrizione: 'Nomine di RSPP, medico competente, preposti e addetti a primo soccorso ed emergenze. Si aggiornano quando cambia una persona.',
    ordine: 108,
  },
  {
    nome: 'Attestati di formazione dei lavoratori',
    categoria: 'certificazione',
    si_applica_a: 'raccolta,trasporto_secondaria,trattamento,stoccaggio',
    obbligatorio: false,
    tipo_scadenza: 'da_documento',
    preavviso_giorni: 60,
    riferimento_normativo: 'Art. 37 D.lgs 81/2008 e Accordo Stato-Regioni: formazione generale e specifica, aggiornamento ogni cinque anni',
    descrizione: 'Formazione generale e specifica, piu’ gli addestramenti per le attrezzature usate. La scadenza e’ quella dell’aggiornamento quinquennale.',
    ordine: 110,
  },
  {
    nome: 'Giudizi di idoneita sanitaria',
    categoria: 'certificazione',
    si_applica_a: 'raccolta,trasporto_secondaria,trattamento,stoccaggio',
    obbligatorio: false,
    tipo_scadenza: 'da_documento',
    preavviso_giorni: 45,
    riferimento_normativo: 'Art. 41 D.lgs 81/2008: sorveglianza sanitaria e giudizio di idoneita’ alla mansione',
    descrizione: 'Giudizi del medico competente per i lavoratori impiegati nel servizio. Portano la data della visita successiva: quella e’ la scadenza.',
    ordine: 112,
  },
  {
    nome: 'Conformita e verifiche periodiche delle attrezzature',
    categoria: 'certificazione',
    si_applica_a: 'raccolta,trasporto_secondaria,trattamento,stoccaggio',
    obbligatorio: false,
    tipo_scadenza: 'da_documento',
    preavviso_giorni: 45,
    riferimento_normativo: 'Art. 71 c.8 e 11 D.lgs 81/2008 e DM 11 aprile 2011: verifiche periodiche di gru e carrelli elevatori',
    descrizione: 'Dichiarazioni di conformita’ CE e verbali delle verifiche periodiche delle attrezzature usate nel servizio: gru, carrelli elevatori, ragni.',
    ordine: 114,
  },
];
