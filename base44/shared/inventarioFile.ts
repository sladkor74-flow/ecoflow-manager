// L'INVENTARIO DEI FILE CHE LA PIATTAFORMA TIENE PER NOI.
//
// Serve perche' la piattaforma non sa cancellare un file: confermato dalla sua
// assistenza il 30/09/2026 ("none of them deletes files... I couldn't find any
// delete option for uploaded files in the SDK or the dashboard"). L'unico modo
// per far sparire davvero un file e' chiederlo al loro team, e per chiederlo
// bisogna sapere quali file sono: questo elenco e' quella lista.
//
// Vale anche dopo: e' l'unico posto da cui si vede che cosa resta caricato, visto
// che nessun pannello lo mostra.
//
// DUE GENERI, E LA DIFFERENZA E' TUTTO:
//   pubblico (file_url)  - caricato fino al 30/09/2026 con UploadFile. L'indirizzo
//                          funziona per chiunque ce l'abbia, per sempre. Sono
//                          questi i file urgenti da far rimuovere.
//   privato (file_uri)   - si apre solo con un link firmato che scade. Finche'
//                          nessuno lo firma, e' gia' irraggiungibile.

/** Dove stanno i riferimenti ai file, archivio per archivio. */
export const ARCHIVI_CON_FILE = [
  { entita: 'UploadLog', campoUrl: 'file_url', campoUri: 'file_uri', cosa: 'file di caricamento dati', etichetta: (r) => `${r.tipo_file || ''} · ${r.nome_file || ''}` },
  { entita: 'EsportazioneFatturazione', campoUrl: 'file_url', campoUri: null, cosa: 'export di fatturazione', etichetta: (r) => `${r.tipo || ''} ${r.mese || ''} ${r.anno || ''}` },
  { entita: 'DocumentoQualifica', campoUrl: null, campoUri: 'file_uri', cosa: 'documento di qualifica fornitore', etichetta: (r) => `${r.soggetto_nome || ''} · ${r.tipo_documento_nome || ''}` },
  { entita: 'ContrattoFornitore', campoUrl: null, campoUri: 'file_uri', cosa: 'contratto fornitore', etichetta: (r) => `${r.fornitore_nome || ''} ${r.anno || ''}` },
  { entita: 'ModelloContratto', campoUrl: null, campoUri: 'file_uri', cosa: 'modello di contratto', etichetta: (r) => `${r.nome || ''}` },
  { entita: 'ModelloDocumento', campoUrl: null, campoUri: 'file_uri', cosa: 'modello di documento', etichetta: (r) => `${r.nome || ''}` },
  { entita: 'QuadraturaFir', campoUrl: null, campoUri: 'file_uri', cosa: 'stampa della quadratura FIR', etichetta: (r) => `settimana ${r.settimana || ''}/${r.anno || ''} · ${r.file_nome || ''}` },
  { entita: 'VerificaReport', campoUrl: null, campoUri: 'file_uri', cosa: 'report settimanale di un fornitore', etichetta: (r) => `${r.sito_nome || ''} · settimana ${r.settimana || ''}/${r.anno || ''}` },
];

const testo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

// OGNI RIGA DI QUESTO ELENCO E' UN FILE CHE UN RECORD STA USANDO.
//
// L'inventario si costruisce DAI RECORD: se un file e' qui, c'e' un record che
// lo punta. Questo non e' un dettaglio tecnico, e' la cosa piu' importante del
// file, e il 02/10/2026 e' mancato poco che costasse caro: l'elenco e' stato
// mandato all'assistenza della piattaforma chiedendo la rimozione dei file, e
// dentro c'erano anche i 144 documenti di qualifica dei fornitori (DURC,
// contratti, polizze, visure), i 4 modelli con cui si generano le lettere e una
// stampa di quadratura. Li ha fermati l'assistenza, controllando lei: «if we
// delete them, those records will stay in your app but their documents will no
// longer open».
//
// Quindi ogni riga dice che cosa farne, a parole, e il CSV porta quella colonna:
//   pubblico - l'indirizzo funziona per chiunque ce l'abbia. Si fa rimuovere, ma
//              PRIMA si toglie il riferimento dai record (scollegaFilePubblici),
//              altrimenti il record resta a puntare un file che non c'e' piu'.
//   privato  - si apre solo con un link firmato che scade: non e' esposto, ed e'
//              il documento che quel record mostra. NON si fa rimuovere.
export const AZIONE_PUBBLICO = 'DA FAR RIMUOVERE: indirizzo pubblico. Prima togli il riferimento dal gestionale';
export const AZIONE_PRIVATO = 'NON RIMUOVERE: e\' il documento che questo record sta usando';
export const azioneFile = (genere) => (genere === 'pubblico' ? AZIONE_PUBBLICO : AZIONE_PRIVATO);

/** Una riga dell'inventario da un record. null se quel record non tiene nessun file. */
export function voceFile(def, r) {
  const url = def.campoUrl ? testo(r[def.campoUrl]) : '';
  const uri = def.campoUri ? testo(r[def.campoUri]) : '';
  if (!url && !uri) return null;
  const genere = url ? 'pubblico' : 'privato';
  return {
    entita: def.entita,
    id: testo(r.id),
    cosa: def.cosa,
    descrizione: testo(def.etichetta ? def.etichetta(r) : ''),
    genere,
    // In uso e' sempre vero: l'inventario nasce dai record. Si scrive comunque,
    // perche' chi legge l'elenco non sa come e' stato costruito.
    in_uso: true,
    azione: azioneFile(genere),
    riferimento: url || uri,
    caricato_il: testo(r.created_date).slice(0, 10),
  };
}

const csvCampo = (v) => {
  const s = String(v ?? '');
  return /[",;\n]/.test(s) ? '"' + s.split('"').join('""') + '"' : s;
};

/**
 * UN FILE PER RIGA, NON UN RECORD PER RIGA.
 *
 * Lo stesso file puo' essere puntato da piu' record: un caricamento forzato riusa
 * il file del tentativo fallito, e nel registro restano due righe con lo stesso
 * indirizzo. Sul file vero dell'utente, 72 record puntavano a 53 file. Chiedere
 * la rimozione di "72 file" a chi deve rimuoverli a mano e' un modo per farsi
 * dire che il conto non torna: si chiede la rimozione dei file, e si dice quanti
 * record li usavano.
 */
export function perFile(voci) {
  const per = new Map();
  for (const v of voci || []) {
    const k = v.riferimento;
    if (!per.has(k)) per.set(k, { ...v, record: 1, id: [v.id] });
    else { const g = per.get(k); g.record += 1; g.id.push(v.id); }
  }
  return [...per.values()].sort((a, b) => {
    if (a.genere !== b.genere) return a.genere === 'pubblico' ? -1 : 1;
    return String(a.caricato_il).localeCompare(String(b.caricato_il)) || String(a.entita).localeCompare(String(b.entita));
  });
}

/**
 * L'inventario in CSV, un file per riga e i pubblici per primi, perche' sono
 * quelli che scottano: il loro indirizzo funziona per chiunque ce l'abbia.
 * Separatore virgola: e' un file che si manda all'assistenza della piattaforma,
 * non si apre in Excel italiano.
 */
export function csvInventario(voci) {
  // La colonna "azione" sta per seconda, prima del riferimento: chi scorre
  // l'elenco la incontra comunque, e nessuna riga puo' piu' essere letta come
  // "questo file si puo' cancellare" quando invece un record lo sta usando.
  const righe = [['genere', 'azione', 'riferimento', 'archivio', 'cosa', 'descrizione', 'caricato_il', 'record_che_lo_usano'].join(',')];
  for (const v of perFile(voci)) {
    righe.push([v.genere, v.azione || azioneFile(v.genere), v.riferimento, v.entita, v.cosa, v.descrizione, v.caricato_il, v.record].map(csvCampo).join(','));
  }
  return righe.join('\n');
}

/**
 * La frase da scrivere all'assistenza, con i conti giusti: che cosa chiedere di
 * rimuovere e che cosa non deve essere toccato. Senza questa, l'elenco da solo
 * si legge come una lista di cancellazioni (02/10/2026).
 */
export function testoRichiesta(conta) {
  const c = conta || {};
  const pubblici = Number(c.pubblici) || 0;
  const privati = Number(c.privati) || 0;
  return [
    pubblici
      ? `Da rimuovere: ${pubblici} file con indirizzo pubblico (colonna genere = pubblico), quelli caricati prima del passaggio a UploadPrivateFile.`
      : 'Non ci sono piu\' file con indirizzo pubblico da rimuovere.',
    privati
      ? `Da NON rimuovere: ${privati} file privati. Sono i documenti che i record stanno usando - qualifiche, contratti, modelli, stampe - e si aprono solo con un link firmato che scade.`
      : '',
  ].filter(Boolean).join(' ');
}

/** Quanti sono: i FILE distinti, e a parte i record che li puntano. */
export function contaInventario(voci) {
  const xs = voci || [];
  const file = perFile(xs);
  const pubblici = file.filter(v => v.genere === 'pubblico');
  return {
    file: file.length,
    pubblici: pubblici.length,
    privati: file.length - pubblici.length,
    record: xs.length,
    // Tutti i file dell'inventario sono in uso da un record: e' da li' che
    // l'inventario nasce. Si dice, perche' e' la cosa che va capita prima di
    // chiedere a qualcuno di cancellare qualcosa.
    in_uso: file.length,
    da_far_rimuovere: pubblici.length,
    per_archivio: [...new Set(file.map(v => v.entita))].map(e => ({
      entita: e,
      quanti: file.filter(v => v.entita === e).length,
      pubblici: file.filter(v => v.entita === e && v.genere === 'pubblico').length,
    })).sort((a, b) => b.quanti - a.quanti),
  };
}
