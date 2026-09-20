// Riconoscimento del tipo di documento caricato nella qualifica fornitori.
//
// Un DURC non e' una visura camerale e non e' una White List: caricare il
// documento nella casella sbagliata e' l'errore piu' facile da fare e il piu'
// difficile da accorgersene, perche' il documento e' valido, e' solo al posto
// sbagliato. L'agente lo controlla gia', ma il suo e' un giudizio: qui c'e' una
// rete di sicurezza che non dipende dal modello.
//
// Il criterio e' prudente: si segnala un documento sbagliato SOLO quando sia il
// nome della casella sia il tipo letto dal file vengono riconosciuti con
// certezza e appartengono a due famiglie diverse. Se anche solo uno dei due non
// si riconosce non si dice niente e vale il giudizio dell'agente: meglio un
// controllo in meno che dichiarare sbagliato un documento giusto.

/**
 * Le famiglie di documenti della commessa. "parole" sono sequenze intere: si
 * cercano fra spazi, quindi "iso 14001" non scatta dentro un'altra parola e
 * "durc" non scatta dentro "durchmesser". Vince la parola piu' lunga trovata,
 * cioe' la piu' specifica: "polizza fideiussoria" batte "polizza".
 */
export const FAMIGLIE = [
  { chiave: 'durc', nome: 'DURC', parole: ['durc', 'durc online', 'documento unico di regolarita contributiva', 'regolarita contributiva'] },
  { chiave: 'visura', nome: 'Visura camerale', parole: ['visura', 'visura camerale', 'visura ordinaria', 'visura storica', 'visura di evasione', 'registro delle imprese', 'certificato camera di commercio'] },
  { chiave: 'white_list', nome: 'Iscrizione alla White List antimafia', parole: ['white list', 'whitelist', 'elenco prefettizio', 'elenchi prefettizi', 'elenco dei fornitori prestatori di servizi ed esecutori di lavori'] },
  { chiave: 'antimafia', nome: 'Comunicazione o informazione antimafia', parole: ['comunicazione antimafia', 'informazione antimafia', 'certificazione antimafia', 'certificato antimafia', 'liberatoria antimafia'] },
  { chiave: 'albo_gestori', nome: 'Iscrizione all\'Albo Nazionale Gestori Ambientali', parole: ['albo gestori', 'albo gestori ambientali', 'albo nazionale gestori', 'albo nazionale gestori ambientali', 'iscrizione all albo', 'provvedimento di iscrizione all albo'] },
  { chiave: 'rentri', nome: 'Iscrizione al RENTRI', parole: ['rentri', 'registro elettronico nazionale'] },
  { chiave: 'autorizzazione_impianto', nome: 'Autorizzazione dell\'impianto', parole: ['aua', 'aia', 'autorizzazione unica ambientale', 'autorizzazione integrata ambientale', 'autorizzazione ordinaria', 'autorizzazione dell impianto', 'autorizzazione impianto', 'provvedimento autorizzativo', 'articolo 208', 'art 208', 'articolo 216', 'art 216'] },
  { chiave: 'garanzia_finanziaria', nome: 'Garanzia finanziaria', parole: ['garanzia finanziaria', 'garanzie finanziarie', 'fideiussione', 'fideiussoria', 'polizza fideiussoria', 'garanzia fideiussoria'] },
  { chiave: 'polizza_rc', nome: 'Polizza di responsabilita civile', parole: ['responsabilita civile', 'polizza rct', 'rct rco', 'polizza di responsabilita civile', 'assicurazione di responsabilita civile'] },
  { chiave: 'iso', nome: 'Certificazione del sistema di gestione (ISO)', parole: ['iso 14001', 'iso 9001', 'iso 45001', 'sistema di gestione ambientale', 'sistema di gestione per la qualita'] },
  { chiave: 'end_of_waste', nome: 'Conformita End of Waste', parole: ['end of waste', 'cessazione della qualifica di rifiuto', 'gomma vulcanizzata granulare'] },
  { chiave: 'contratto', nome: 'Contratto', parole: ['contratto', 'accordo quadro', 'convenzione', 'scrittura privata', 'lettera di incarico'] },
  { chiave: 'patente', nome: 'Patente di guida', parole: ['patente', 'patente di guida'] },
  { chiave: 'cqc', nome: 'Carta di qualificazione del conducente (CQC)', parole: ['cqc', 'carta di qualificazione del conducente'] },
  { chiave: 'carta_circolazione', nome: 'Carta di circolazione', parole: ['carta di circolazione', 'libretto di circolazione'] },
  { chiave: 'adr', nome: 'Certificato ADR', parole: ['adr', 'certificato adr', 'merci pericolose'] },
];

// minuscolo, senza accenti e senza punteggiatura, con uno spazio ai due capi:
// cosi' una parola si cerca fra spazi e non dentro un'altra parola
function normalizza(v) {
  return ' ' + String(v ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() + ' ';
}

/**
 * La famiglia di un testo, oppure null se non si riconosce o se due famiglie
 * diverse hanno la stessa evidenza. Restituisce { chiave, nome, parola }.
 */
export function riconosciTipoDocumento(testo) {
  const t = normalizza(testo);
  if (t.trim().length < 2) return null;
  let migliore = null;
  let ambiguo = false;
  for (const f of FAMIGLIE) {
    for (const parola of f.parole) {
      if (!t.includes(' ' + parola + ' ')) continue;
      if (!migliore || parola.length > migliore.parola.length) {
        migliore = { chiave: f.chiave, nome: f.nome, parola };
        ambiguo = false;
      } else if (parola.length === migliore.parola.length && f.chiave !== migliore.chiave) {
        ambiguo = true;
      }
    }
  }
  return ambiguo ? null : migliore;
}

/**
 * Confronta la casella del catalogo con il documento letto dal file.
 * esito: 'coincide' | 'diverso' | 'incerto'.
 */
export function confrontaTipoDocumento(nomeAtteso, lettura) {
  const attesa = riconosciTipoDocumento(nomeAtteso);
  // Si guarda il tipo dichiarato dalla lettura; la sintesi si usa solo se quello
  // manca, perche' una sintesi puo' nominare di passaggio altri documenti.
  const letto = String((lettura && lettura.tipo_documento) || '').trim();
  const letta = riconosciTipoDocumento(letto || (lettura && lettura.sintesi) || '');
  if (!attesa || !letta) return { esito: 'incerto', attesa, letta };
  return { esito: attesa.chiave === letta.chiave ? 'coincide' : 'diverso', attesa, letta };
}

/**
 * Il problema da segnalare quando il file e' un documento diverso da quello che
 * la casella chiede, oppure null. Il messaggio si costruisce qui perche' lo
 * scrivono in due: l'agente quando analizza il file e la valutazione quando
 * rilegge un documento analizzato prima che questo controllo esistesse.
 */
export function problemaTipoSbagliato(nomeAtteso, lettura) {
  const confronto = confrontaTipoDocumento(nomeAtteso, lettura);
  if (confronto.esito !== 'diverso') return null;
  const letto = String((lettura && lettura.tipo_documento) || '').trim();
  return {
    gravita: 'bloccante',
    messaggio: 'Documento sbagliato: qui va "' + nomeAtteso + '", ma il file e\' ' + confronto.letta.nome
      + (letto ? ' (letto come "' + letto + '")' : '') + '. Caricalo nella casella giusta.',
  };
}

/**
 * Problemi che si vedono dalla sola lettura, senza giudizio del modello:
 * file illeggibile, lettura vuota, tipo non dichiarato.
 */
export function problemiLettura(lettura) {
  const l = lettura || {};
  const testo = (v) => String(v ?? '').trim();
  const problemi = [];

  if (l.leggibile === false) {
    const perche = testo(l.note_lettura);
    problemi.push({
      gravita: 'bloccante',
      messaggio: 'Il documento non e\' leggibile o e\' incompleto' + (perche ? ': ' + perche : '.')
        + ' Ricaricalo come PDF non protetto, oppure rifai la scansione con la pagina intera e a fuoco.',
    });
    return problemi;
  }

  // Il modello dice di averlo letto ma non ne ha tirato fuori niente: succede con
  // le scansioni senza testo, i file protetti e le pagine bianche.
  const nienteDati = !testo(l.intestatario) && !testo(l.partita_iva) && !testo(l.codice_fiscale)
    && !testo(l.data_emissione) && !testo(l.data_scadenza) && !testo(l.numero_documento) && !testo(l.ente_emittente);
  if (nienteDati && testo(l.sintesi).length < 20) {
    problemi.push({
      gravita: 'bloccante',
      messaggio: 'Dal file non e\' stato letto nessun dato: puo\' essere una scansione senza testo, un file protetto da password o una pagina vuota. Controllalo e ricaricalo.',
    });
    return problemi;
  }

  if (!testo(l.tipo_documento)) {
    problemi.push({ gravita: 'attenzione', messaggio: 'Dalla lettura non si capisce di che documento si tratti: verificalo a mano.' });
  }
  return problemi;
}
