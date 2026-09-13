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
];
