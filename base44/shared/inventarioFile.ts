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
  { entita: 'VerificaReport', campoUrl: null, campoUri: 'file_uri', cosa: 'report settimanale di un fornitore', etichetta: (r) => `${r.soggetto_nome || ''} · settimana ${r.settimana || ''}/${r.anno || ''}` },
];

const testo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

// QUESTO ELENCO NON E' UNA LISTA DI CANCELLAZIONI: OGNI RIGA DICE CHE FARNE.
//
// Il 02/10/2026 e' mancato poco che costasse caro. L'elenco e' stato mandato
// all'assistenza della piattaforma chiedendo la rimozione dei file, e dentro
// c'erano anche i 144 documenti di qualifica dei fornitori (DURC, contratti,
// polizze, visure), i 4 modelli con cui si generano le lettere e una stampa di
// quadratura. Li ha fermati l'assistenza, controllando lei: «if we delete them,
// those records will stay in your app but their documents will no longer open».
//
// Quindi ogni riga dice che cosa farne, a parole, e il CSV porta quella colonna.
// I casi sono tre:
//   pubblico - l'indirizzo funziona per chiunque ce l'abbia. Si fa rimuovere, ma
//              PRIMA si toglie il riferimento dai record (scollegaFilePubblici),
//              altrimenti il record resta a puntare un file che non c'e' piu'.
//   orfano   - nessun record lo usa piu': il record che lo teneva e' stato
//              cancellato e il nome del file ce l'ha solo il registro
//              FileDaRimuovere (shared/fileDaRimuovere.ts). Si fa rimuovere
//              anche se privato, perche' non serve piu' a nessuno.
//   privato  - si apre solo con un link firmato che scade: non e' esposto, ed e'
//              il documento che quel record mostra. NON si fa rimuovere.
//
// LE DUE SORGENTI. Fino al 02/10/2026 l'inventario nasceva solo DAI RECORD: se
// un file era qui, c'era un record che lo puntava. Era vero e insieme era il
// limite - un file il cui record non c'e' piu' non compariva da nessuna parte -
// e quel limite si e' potuto chiudere solo quando l'assistenza ha detto che i
// file si rimuovono a richiesta. Adesso le sorgenti sono due: i record, e il
// registro dei file che nessuno usa piu'.
export const AZIONE_PUBBLICO = 'DA FAR RIMUOVERE: indirizzo pubblico. Prima togli il riferimento dal gestionale';
export const AZIONE_PRIVATO = 'NON RIMUOVERE: e\' il documento che questo record sta usando';
// LA TERZA AZIONE, DAL 02/10/2026: il file che non ha piu' nessun record.
//
// Finche' l'inventario nasceva solo dai record, un file del genere non si
// poteva nemmeno nominare: il record se l'era portato via. Ora le
// cancellazioni lo scrivono nel registro FileDaRimuovere
// (shared/fileDaRimuovere.ts) e da li' entra qui. E' l'unico genere di file
// privato che si fa rimuovere, perche' e' l'unico che nessuno sta usando:
// l'assistenza della piattaforma lo toglie su richiesta, mandandole il file_uri.
export const AZIONE_ORFANO = 'DA FAR RIMUOVERE: nessun record lo usa';
export const azioneFile = (genere, inUso = true) => {
  if (inUso === false) return AZIONE_ORFANO;
  return genere === 'pubblico' ? AZIONE_PUBBLICO : AZIONE_PRIVATO;
};

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

/**
 * Una riga dell'inventario da una voce del registro FileDaRimuovere: un file che
 * nessun record usa piu'. in_uso e' falso, ed e' la differenza che conta.
 */
export function voceOrfana(r) {
  const rif = testo(r && r.riferimento);
  if (!rif) return null;
  return {
    entita: testo(r.entita),
    id: testo(r.id),
    cosa: testo(r.cosa),
    descrizione: testo(r.descrizione),
    genere: testo(r.genere) === 'pubblico' ? 'pubblico' : 'privato',
    in_uso: false,
    azione: AZIONE_ORFANO,
    riferimento: rif,
    caricato_il: testo(r.annotato_il).slice(0, 10),
    motivo: testo(r.motivo),
    stato: testo(r.stato) || 'da_chiedere',
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
    const usato = v.in_uso !== false;
    if (!per.has(k)) { per.set(k, { ...v, record: usato ? 1 : 0, id: [v.id] }); continue; }
    const g = per.get(k);
    g.id.push(v.id);
    if (!usato) continue;
    g.record += 1;
    // L'USO VINCE SEMPRE. Lo stesso file puo' comparire come orfano nel registro
    // e come file di un record vivo: succede se una cancellazione non e' andata
    // in porto, o se due record puntavano allo stesso file e se n'e' cancellato
    // uno. In quel caso non si fa rimuovere, perche' qualcuno lo sta ancora
    // usando: fra le due letture si tiene quella che non fa danni.
    if (g.in_uso === false) {
      g.in_uso = true;
      g.entita = v.entita;
      g.cosa = v.cosa;
      g.descrizione = v.descrizione;
      g.caricato_il = v.caricato_il;
    }
    g.azione = azioneFile(g.genere, true);
  }
  // Prima i pubblici, che scottano; poi gli orfani, che si fanno rimuovere; per
  // ultimi i privati in uso, che non si toccano.
  const priorita = (v) => (v.genere === 'pubblico' ? 0 : (v.in_uso === false ? 1 : 2));
  return [...per.values()].sort((a, b) => {
    if (priorita(a) !== priorita(b)) return priorita(a) - priorita(b);
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
  const orfani = Number(c.orfani) || 0;
  const privatiInUso = Math.max(0, (Number(c.privati) || 0) - orfani);
  return [
    pubblici
      ? `Da rimuovere: ${pubblici} file con indirizzo pubblico (colonna genere = pubblico), quelli caricati prima del passaggio a UploadPrivateFile.`
      : "Non ci sono piu' file con indirizzo pubblico da rimuovere.",
    // I file del registro: nessun record li usa piu', quindi si fanno rimuovere
    // anche se privati. L'assistenza della piattaforma, 02/10/2026: li toglie su
    // richiesta mandandole il file_uri.
    orfani
      ? `Da rimuovere anche: ${orfani} file che nessun record usa piu' (colonna azione = ${AZIONE_ORFANO}). Il record che li teneva e' stato cancellato: il riferimento scritto in colonna e' il file_uri da mandare.`
      : '',
    privatiInUso
      ? `Da NON rimuovere: ${privatiInUso} file privati. Sono i documenti che i record stanno usando - qualifiche, contratti, modelli, stampe - e si aprono solo con un link firmato che scade.`
      : '',
  ].filter(Boolean).join(' ');
}

/** Quanti sono: i FILE distinti, e a parte i record che li puntano. */
export function contaInventario(voci) {
  const xs = voci || [];
  const file = perFile(xs);
  const pubblici = file.filter(v => v.genere === 'pubblico');
  // Gli orfani vengono dal registro FileDaRimuovere: nessun record li usa piu'.
  // Fino al 02/10/2026 non esistevano come idea, e l'inventario poteva dire
  // "sono tutti in uso" perche' nasceva solo dai record. Ora non si puo' piu'.
  const orfani = file.filter(v => v.in_uso === false);
  return {
    file: file.length,
    pubblici: pubblici.length,
    privati: file.length - pubblici.length,
    orfani: orfani.length,
    // I record che tengono un file: gli orfani non ne hanno nessuno.
    record: xs.filter(v => v.in_uso !== false).length,
    in_uso: file.length - orfani.length,
    // Si fa rimuovere un file se il suo indirizzo e pubblico OPPURE se nessun
    // record lo usa piu'. Un orfano pubblico e' una cosa sola, non due.
    da_far_rimuovere: pubblici.length + orfani.filter(v => v.genere !== 'pubblico').length,
    per_archivio: [...new Set(file.map(v => v.entita))].map(e => ({
      entita: e,
      quanti: file.filter(v => v.entita === e).length,
      pubblici: file.filter(v => v.entita === e && v.genere === 'pubblico').length,
      orfani: file.filter(v => v.entita === e && v.in_uso === false).length,
    })).sort((a, b) => b.quanti - a.quanti),
  };
}
