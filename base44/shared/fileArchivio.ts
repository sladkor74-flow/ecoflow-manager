// Togliere un file dall'archivio privato.
//
// La piattaforma non documenta un nome unico per questa operazione: si provano
// quelli noti e si dice com'e' andata, invece di dare per scontato che sia
// riuscita. Se nessuno esiste il file resta dov'e' e chi chiama lo scrive: e'
// meglio saperlo che credere di aver liberato spazio senza averlo fatto.

// UN RIFIUTO DELL'OPERAZIONE NON E' UN FALLIMENTO DEL FILE.
//
// Verificato in produzione il 30/09/2026: le operazioni esistono nell'SDK, ma
// ogni chiamata torna "Method Not Allowed". Sono due cose diverse e vanno dette
// diversamente: un file che non se ne va per un motivo suo domani se ne andra',
// un'operazione rifiutata dara' lo stesso esito su ogni file, sempre. Sapere
// quale dei due casi e' quello vero decide se riprovare o smettere.
const OPERAZIONE_NEGATA = /method not allowed|not implemented|not supported|not permitted|non consentit|\b405\b|\b501\b/i;

/**
 * CANCELLARE UN FILE NON SI PUO'. NON SI PROVA NEMMENO PIU'.
 *
 * L'assistenza della piattaforma, 30/09/2026: le uniche integrazioni sui file
 * sono UploadFile, UploadPrivateFile, CreateFileSignedUrl e
 * ExtractDataFromUploadedFile, e "none of them deletes files". DeleteFile,
 * DeletePrivateFile e RemoveFile non sono endpoint: "integrations.Core accetta
 * qualunque nome di metodo tu chiami", ed e' per questo che esistevano
 * all'apparenza e rispondevano "Method Not Allowed".
 *
 * Quindi non si chiama piu' niente. Ogni tentativo costava tre richieste a
 * vuoto per file contro il limite al minuto di TUTTA l'app: nove a ogni domanda
 * con allegati fatta a EcoTyna, sei a ogni caricamento, tre a ogni quadratura.
 *
 * RESTITUISCE SEMPRE riuscita: false, E NON PUO' FARE ALTRIMENTI. Sette punti
 * del gestionale decidono su questo valore se svuotare il riferimento al file
 * sul record. Se questa funzione dicesse "riuscita" senza che il file sia
 * sparito, quei record perderebbero l'indirizzo di un file che resta vivo e
 * raggiungibile da chiunque abbia il link: il file diventerebbe impossibile da
 * far rimuovere, perche' non sapremmo piu' quale chiedere. E' il danno peggiore
 * di tutta questa storia e va evitato qui, in un punto solo.
 *
 * Il file si fa rimuovere chiedendolo al team della piattaforma, con l'elenco
 * che produce shared/inventarioFile.ts. Per i file nuovi il problema non si
 * pone: salgono privati e il link firmato scade da solo (shared/fileScaricabile.ts).
 */
export async function cancellaFile(_base44, fileUri) {
  if (!fileUri) return { riuscita: false, come: 'nessun file', negata: false };
  return {
    riuscita: false,
    negata: true,
    come: 'la piattaforma non ha nessuna operazione per cancellare un file: si fanno rimuovere dal suo team',
  };
}

/** Il vecchio tentativo, tenuto per il giorno in cui la piattaforma aggiungesse davvero la cancellazione. Non lo chiama nessuno. */
export async function provaACancellare(base44, fileUri) {
  if (!fileUri) return { riuscita: false, come: 'nessun file', negata: false };
  const core = base44.asServiceRole.integrations.Core;
  const nomi = ['DeleteFile', 'DeletePrivateFile', 'RemoveFile'];
  const disponibili = nomi.filter(n => typeof core[n] === 'function');
  if (disponibili.length === 0) return { riuscita: false, come: 'la piattaforma non consente di cancellare i file', negata: true };
  // Si provano TUTTI i nomi disponibili, non solo il primo: fino al 29/09/2026 qui
  // c'era un return dentro il catch, cosi' bastava che il primo fallisse perche'
  // gli altri non venissero mai tentati e il file restasse dov'era.
  const motivi = [];
  for (const nome of disponibili) {
    try {
      await core[nome]({ file_uri: fileUri });
      return { riuscita: true, come: nome };
    } catch (e) {
      motivi.push(`${nome}: ${e && e.message ? e.message : e}`);
    }
  }
  // Negata solo se TUTTE le operazioni disponibili sono state rifiutate in quanto
  // operazioni. Se una ha fallito per un motivo suo - il file non c'e' piu', la
  // rete - la piattaforma la consente e domani puo' riuscire: si resta prudenti e
  // si riprova, perche' smettere per sbaglio vorrebbe dire non cancellare mai piu'.
  return { riuscita: false, come: `nessuna cancellazione e' riuscita (${motivi.join('; ')})`, negata: motivi.every(m => OPERAZIONE_NEGATA.test(m)) };
}

/**
 * Vero quando la piattaforma rifiuta l'OPERAZIONE, non il singolo file: allora
 * riprovare non serve e l'alert deve dire questo, non "riprovo stanotte".
 * Basta un fallimento di altro genere perche' si torni a considerarla consentita.
 *
 * Funzione pura: le prove la chiamano senza toccare la piattaforma.
 */
export function cancellazioneNegata(nonRiusciti) {
  const xs = nonRiusciti || [];
  return xs.length > 0 && xs.every(n => n && n.negata === true);
}

/** Quanti giorni sono passati da una data ISO. */
export function giorniDa(iso, adessoMs) {
  const t = iso ? new Date(iso).getTime() : 0;
  return t > 0 ? Math.floor(((adessoMs || Date.now()) - t) / 86400000) : null;
}

/**
 * I documenti sostituiti abbastanza vecchi da poter perdere il file allegato.
 * Il record resta: sintesi, scadenza, problemi e motivo della sostituzione sono
 * la storia del fornitore e non si toccano. Se ne va solo il file, che nel
 * frattempo e' stato rimpiazzato da uno piu' recente ed esiste comunque nella
 * cartella dei contratti.
 *
 * Funzione pura: le prove la chiamano senza toccare la piattaforma.
 */
export function daAlleggerire(documenti, opzioni) {
  const o = opzioni || {};
  const anni = o.anni == null ? 3 : Number(o.anni);
  const adessoMs = o.adessoMs || Date.now();
  const soglia = anni * 365;
  const scelti = [];
  for (const d of documenti || []) {
    if (!d || d.stato !== 'sostituito' || !d.file_uri) continue;
    // si guarda quando il documento e' stato messo da parte, non quando e' nato
    const eta = giorniDa(d.updated_date || d.created_date, adessoMs);
    if (eta === null || eta < soglia) continue;
    scelti.push({
      id: d.id, soggetto_nome: d.soggetto_nome, tipo_documento_nome: d.tipo_documento_nome,
      file_nome: d.file_nome, giorni: eta, anni: Math.floor(eta / 365),
    });
  }
  return scelti.sort((a, b) => b.giorni - a.giorni);
}

// === I FILE DEL CARICAMENTO DATI ===
//
// Regola dell'utente (29/09/2026): "i file excel che carico nel modulo
// 'caricamento dati' si devono sostituire ogni volta che carico il successivo,
// sempre che sia stato caricato al 100%. non ha senso mantenere un file
// precedente che dice le stesse cose di quello successivo a cui aggiunge di volta
// in volta poche righe".
//
// Sono i file piu' grossi del gestionale: gli export del portale Ecotyre, che
// ogni volta ripetono tutto e aggiungono le righe nuove. Finivano in area
// PUBBLICA e il loro indirizzo restava per sempre nel registro dei caricamenti,
// senza che nessuno li cancellasse mai.
//
// IL RECORD DEL REGISTRO NON SI TOCCA: righe importate, righe in archivio prima,
// forzature, foglio riconosciuto e messaggio sono il controllo anti-regressione e
// la storia dei caricamenti. Se ne va solo il file.
//
// "Al 100%" vuol dire esito 'successo', cioe' nessuna riga fallita: un
// caricamento parziale o interrotto lascia stare i file di prima, perche' quello
// di prima potrebbe essere ancora l'unico completo.

/**
 * I caricamenti precedenti dello stesso tipo che possono perdere il file: tutti
 * tranne quello appena concluso. Dal piu' vecchio, cosi' un tetto per volta
 * smaltisce prima l'arretrato.
 *
 * Funzione pura: le prove la chiamano senza toccare la piattaforma.
 */
export function fileDaSostituire(registro, { tipoFile, idCorrente, fileCorrente = '' }) {
  // Lo STESSO file di quello appena caricato non si tocca. Un caricamento forzato
  // riusa il file del tentativo che non era riuscito (pendingFileUrlRef in
  // CaricamentoDati.jsx), quindi il tentativo vecchio e quello nuovo puntano allo
  // stesso indirizzo: cancellarlo perche' "e' del caricamento di prima" vorrebbe
  // dire cancellare il file del caricamento buono.
  const corrente = String(fileCorrente || '').trim();
  return (registro || [])
    .filter(l => l && l.id && l.id !== idCorrente
      && String(l.tipo_file || '') === String(tipoFile)
      && String(l.file_url || '').trim() !== ''
      && String(l.file_url || '').trim() !== corrente)
    .map(l => ({
      id: l.id,
      file_url: String(l.file_url).trim(),
      nome_file: String(l.nome_file || ''),
      quando: String(l.created_date || ''),
    }))
    .sort((a, b) => String(a.quando).localeCompare(String(b.quando)));
}

/**
 * Toglie il file ai caricamenti precedenti dello stesso tipo. Si chiama solo dopo
 * un caricamento riuscito al 100%.
 *
 * Se la piattaforma non consente di cancellare, l'indirizzo resta scritto nel
 * registro e si riprovera' al caricamento dopo: meglio saperlo che credere di
 * aver liberato spazio senza averlo fatto.
 */
export async function sostituisciFilePrecedenti(base44, { tipoFile, idCorrente, oggi, massimo = 40 }) {
  const Log = base44.asServiceRole.entities.UploadLog;
  // Qui si e' appena finito un caricamento: si guardano i piu' recenti di quel
  // tipo, non tutto il registro dall'inizio dei tempi. Dopo la prima pulizia con
  // un file resta un caricamento solo per tipo, e l'arretrato piu' vecchio lo
  // smaltisce comunque il lavoro notturno (sostituisciFileArretrati).
  const registro = await Log.filter({ tipo_file: tipoFile }, '-created_date', 500);
  const corrente = registro.find(l => l.id === idCorrente);
  const candidati = fileDaSostituire(registro, { tipoFile, idCorrente, fileCorrente: corrente ? corrente.file_url : '' });
  let tolti = 0;
  const nonRiusciti = [];
  const gia = new Set();
  // SMETTERE DI PROVARE QUANDO IL RIFIUTO E' DELL'OPERAZIONE. Ritentarla su ogni
  // file costa tre richieste a vuoto per file: con cinquanta file sono
  // centocinquanta richieste contro il limite al minuto di TUTTA l'app
  // (limiteRichieste.ts), e l'esito non cambia di una virgola.
  let negata = false;
  const lista = candidati.slice(0, Math.max(0, massimo));
  for (const c of lista) {
    if (negata) break;
    if (!gia.has(c.file_url)) {
      const esito = await cancellaFile(base44, c.file_url);
      if (!esito.riuscita) {
        nonRiusciti.push({ id: c.id, nome_file: c.nome_file, motivo: esito.come, negata: !!esito.negata, pubblico: true });
        if (esito.negata) negata = true;
        continue;
      }
      gia.add(c.file_url);
    }
    const vecchio = registro.find(l => l.id === c.id);
    const nota = `File rimosso il ${String(oggi || '').slice(0, 10)}: sostituito da un caricamento piu' recente dello stesso tipo, che contiene le stesse righe e le nuove.`;
    await Log.update(c.id, {
      file_url: '',
      messaggio: [String((vecchio && vecchio.messaggio) || '').trim(), nota].filter(Boolean).join(' | '),
    });
    tolti++;
  }
  // L'esito si DICE, non resta dentro la risposta di un caricamento che nessuno
  // rilegge: e' cosi' che finora nessuno sapeva se i file si cancellassero
  // davvero. Solo quando c'e' qualcosa da dire, per non aggiungere richieste a un
  // caricamento che ne fa gia' tante.
  const restano = Math.max(0, candidati.length - tolti);
  if (nonRiusciti.length || tolti > 0) {
    try {
      await segnalaFileNonRimossi(base44, { nonRiusciti, bloccati: restano, oggi });
    } catch (_e) { /* il caricamento e' andato: non lo si fa fallire per un alert */ }
  }
  return { candidati: candidati.length, tolti, restano, non_riusciti: nonRiusciti, negata };
}

/**
 * L'ARRETRATO: i file dei caricamenti di prima, tipo per tipo.
 *
 * sostituisciFilePrecedenti lavora quando arriva un caricamento nuovo. Ma i file
 * caricati fino a ieri restano dov'e' finche' quel tipo di dato non si ricarica,
 * e ce ne sono di tipi che si caricano una volta al mese o meno. Questa dice, per
 * ogni tipo, quale file tenere e quali togliere.
 *
 * Si tiene il file del caricamento RIUSCITO AL 100% piu' recente. Se di quel tipo
 * non ce n'e' nessuno riuscito, si tiene il piu' recente che abbia un file e
 * basta: togliere l'ultimo superstite di una serie di caricamenti andati male
 * vorrebbe dire restare senza niente.
 *
 * Funzione pura: le prove la chiamano senza toccare la piattaforma.
 */
export function arretratiDaSostituire(registro) {
  const perTipo = new Map();
  for (const l of registro || []) {
    if (!l || !l.id || String(l.file_url || '').trim() === '') continue;
    const tipo = String(l.tipo_file || '');
    if (!perTipo.has(tipo)) perTipo.set(tipo, []);
    perTipo.get(tipo).push(l);
  }
  // Prima si decide che cosa si TIENE, in tutti i tipi, e poi si toglie: due
  // caricamenti possono puntare allo stesso file (una forzatura riusa quello del
  // tentativo fallito), e togliere "il vecchio" cancellerebbe il file del nuovo.
  const tenuti = new Map();
  const quando = (l) => String(l.created_date || '');
  for (const [tipo, righe] of perTipo) {
    const ordinate = [...righe].sort((a, b) => quando(b).localeCompare(quando(a)));
    tenuti.set(tipo, ordinate.find(l => String(l.esito || '') === 'successo') || ordinate[0]);
  }
  const urlTenuti = new Set([...tenuti.values()].map(l => String(l.file_url).trim()));
  const gruppi = [];
  for (const [tipo, righe] of perTipo) {
    const ordinate = [...righe].sort((a, b) => quando(b).localeCompare(quando(a)));
    const tenuto = tenuti.get(tipo);
    const daTogliere = ordinate
      .filter(l => l.id !== tenuto.id && !urlTenuti.has(String(l.file_url).trim()))
      .map(l => ({ id: l.id, file_url: String(l.file_url).trim(), nome_file: String(l.nome_file || ''), quando: quando(l), esito: String(l.esito || '') }));
    if (daTogliere.length) gruppi.push({ tipo_file: tipo, tenuto: { id: tenuto.id, nome_file: String(tenuto.nome_file || ''), esito: String(tenuto.esito || '') }, da_togliere: daTogliere });
  }
  return gruppi.sort((a, b) => b.da_togliere.length - a.da_togliere.length);
}

/** Toglie i file dell'arretrato, tipo per tipo. Con un tetto per giro. */
export async function sostituisciFileArretrati(base44, { oggi, massimo = 40 }) {
  const Log = base44.asServiceRole.entities.UploadLog;
  const registro = [];
  for (let skip = 0; skip < 50000; skip += 1000) {
    const pagina = await Log.filter({}, 'id', 1000, skip);
    registro.push(...pagina);
    if (pagina.length < 1000) break;
  }
  const gruppi = arretratiDaSostituire(registro);
  let tolti = 0;
  let restano = 0;
  const nonRiusciti = [];
  // Lo stesso indirizzo puo' comparire su piu' record: si cancella una volta.
  const gia = new Set();
  // Come sopra: se la piattaforma rifiuta l'operazione si smette, invece di
  // ripeterla a vuoto su tutto l'arretrato.
  let negata = false;
  for (const g of gruppi) {
    for (const c of g.da_togliere) {
      if (negata) { restano++; continue; }
      if (tolti >= massimo) { restano++; continue; }
      if (!gia.has(c.file_url)) {
        const esito = await cancellaFile(base44, c.file_url);
        if (!esito.riuscita) {
          nonRiusciti.push({ tipo_file: g.tipo_file, nome_file: c.nome_file, motivo: esito.come, negata: !!esito.negata, pubblico: true });
          if (esito.negata) negata = true;
          // Un file che non se ne va resta li': prima non veniva contato, e
          // "restano" diceva solo quelli rinviati per il tetto.
          restano++;
          continue;
        }
        gia.add(c.file_url);
      }
      const vecchio = registro.find(l => l.id === c.id);
      const nota = `File rimosso il ${String(oggi || '').slice(0, 10)}: sostituito dal caricamento piu' recente dello stesso tipo, che contiene le stesse righe e le nuove.`;
      await Log.update(c.id, {
        file_url: '',
        messaggio: [String((vecchio && vecchio.messaggio) || '').trim(), nota].filter(Boolean).join(' | '),
      });
      tolti++;
    }
  }
  return {
    tipi: gruppi.map(g => ({ tipo_file: g.tipo_file, da_togliere: g.da_togliere.length, tenuto: g.tenuto.nome_file })),
    tolti, restano, non_riusciti: nonRiusciti, negata,
  };
}

// === SI PUO' CANCELLARE? NO, E NON SERVE CHIEDERLO AL CODICE ===
//
// Qui c'era supportoCancellazione, che decideva guardando se
// integrations.Core avesse le funzioni: typeof core.DeleteFile === 'function'.
// Quel controllo era sempre vero, per costruzione. Il modulo integrations
// dell'SDK e' un Proxy che, per QUALUNQUE nome che non cominci con '_' e non sia
// 'then', restituisce una funzione che fa una POST a
// /integration-endpoints/Core/<nome>. Quindi la filter non scartava mai niente:
// non era un rilevamento, era una costante travestita da rilevamento, e da li'
// nasceva l'alert che diceva all'utente "le funzioni ci sono ma vengono
// rifiutate" e gli consigliava di farsele abilitare.
//
// La risposta vera e' un fatto, non una misura, e sta scritta qui.

/** Che cosa la piattaforma sa fare con i file. Verificato con la sua assistenza. */
export const STATO_CANCELLAZIONE = {
  esiste: false,
  verificato_il: '2026-09-30',
  // Richiesto di nuovo il 02/10/2026, chiedendo anche se la cancellazione
  // esistesse a programma o in arrivo: "Nothing in the docs or the public
  // roadmap mentions a delete endpoint for stored files, and I can't confirm
  // one".
  riconfermato_il: '2026-10-02',
  integrazioni_esistenti: ['UploadFile', 'UploadPrivateFile', 'CreateFileSignedUrl', 'ExtractDataFromUploadedFile'],
  // La risposta del 02/10/2026 ha aggiunto i due pezzi che mancavano.
  //
  // Il primo: un file non scade mai da solo. «Stored files have no retention
  // schedule: a file stays in storage after its record is deleted or replaced,
  // until support removes it». Quindi cancellare un record non libera niente,
  // e porta via l'unica cosa che sapevamo di quel file: il suo nome. Per
  // questo ogni cancellazione lo scrive prima nel registro FileDaRimuovere
  // (shared/fileDaRimuovere.ts), da cui l'inventario lo ripesca.
  //
  // Il secondo: la rimozione a richiesta e' una strada aperta, non un favore
  // una volta sola. «We remove specific files on request. Send the file_uri
  // values for private files or the full URLs for public ones, I list what I
  // find under your app, and I delete only what you confirm».
  conservazione: "nessuna: un file resta anche dopo che il suo record e' stato cancellato o sostituito",
  come_si_rimuove: "chiedendolo al team della piattaforma, mandando il file_uri dei privati o l'indirizzo completo dei pubblici: l'elenco lo produce shared/inventarioFile.ts",
  limite_di_spazio: 'nessuno per app; solo sul singolo file (50MB documenti, 100MB video)',
};

const REGOLA_FILE = 'file_non_rimossi';

/**
 * Apre (o chiude) l'alert sui file che non si riesce a togliere.
 *
 * Un alert e' l'unico posto dove l'amministratore lo vede senza chiedere a
 * nessuno: la risposta di una funzione pianificata non la legge mai. Si chiude da
 * solo quando i file se ne vanno, come tutti gli altri alert del gestionale.
 */
export async function segnalaFileNonRimossi(base44, { nonRiusciti = [], bloccati = null, oggi }) {
  const Alert = base44.asServiceRole.entities.Alert;
  const record_id = 'archivio-file';
  const aperti = await Alert.filter({ regola_id: REGOLA_FILE, record_id, stato: 'aperto' }, 'id', 20);
  const giorno = String(oggi || '').slice(0, 10).split('-').reverse().join('/');
  // TRE CASI, TRE FRASI DIVERSE. Fino al 30/09/2026 ce n'erano due, e il caso
  // vero - le operazioni ci sono ma la piattaforma le rifiuta - cadeva nel primo:
  // l'alert diceva "59 file non sono stati rimossi... il gestionale riprova da
  // solo alla prossima pulizia notturna", cioe' prometteva un ritentativo che non
  // puo' riuscire. Chi legge deve sapere se aspettare o se chiedere.
  // UN TESTO SOLO, E VERO.
  //
  // Prima ce n'erano tre, e raccontavano tutti qualcosa che non esiste: che le
  // funzioni di cancellazione ci fossero e venissero rifiutate, che il gestionale
  // avrebbe riprovato la notte dopo, che bastasse farsi abilitare la
  // cancellazione, che i file si potessero togliere a mano da un pannello, che lo
  // spazio occupato crescesse verso un limite. L'assistenza della piattaforma il
  // 30/09/2026 le ha smentite tutte: non esiste nessuna operazione per
  // cancellare, non c'e' niente da abilitare, il pannello non ha quel pulsante e
  // non c'e' nessun limite di spazio per app.
  //
  // L'avviso non si chiude piu' da solo, e non deve: si chiude quando il team
  // della piattaforma ha rimosso i file, e quello lo sa solo una persona.
  const quanti = bloccati == null ? nonRiusciti.length : Math.max(Number(bloccati) || 0, nonRiusciti.length);
  const pubblici = (nonRiusciti || []).filter(n => n && n.pubblico).length;

  // UN AVVISO NON SI RISCRIVE A ZERO (10/10/2026).
  //
  // Questa funzione gira dopo ogni pulizia, e una pulizia che non trova niente
  // da togliere non vuol dire che i file di prima se ne siano andati: la
  // piattaforma non li cancella, quindi sono ancora li'. Riscrivere l'avviso con
  // quanti = 0 gli faceva dire «0 file caricati restano sulla piattaforma:
  // cancellarli non si puo'», una frase che si contraddice da sola, e per mesi
  // e' stata in cima agli avvisi dell'amministratore.
  //
  // Un avviso che grida al lupo a zero e' il modo piu' sicuro di far ignorare
  // quelli veri: il presidio vale quanto la fiducia che gli si da'.
  //
  // A zero: se non c'e' niente di aperto non si apre niente; se c'e', si lascia
  // stare, perche' il conto lo abbassa solo chi ha visto i file andarsene - cioe'
  // la persona che chiude l'avviso quando il team della piattaforma le conferma
  // di averli rimossi.
  if (!quanti) {
    if (!aperti.length) return { alert: 'niente', quanti: 0, pubblici };
    return { alert: 'lasciato', quanti: Number(aperti[0].quanti) || 0, pubblici };
  }

  const elenco = nonRiusciti.slice(0, 15).map(n => `- ${n.nome_file || n.entita || n.id || 'file'}`);
  if (nonRiusciti.length > elenco.length) elenco.push(`- e altri ${nonRiusciti.length - elenco.length}`);
  const dati = {
    titolo: `${quanti} ${quanti === 1 ? 'file caricato resta' : 'file caricati restano'} sulla piattaforma: cancellarli non si puo'`,
    descrizione: [
      `Al ${giorno} ${quanti === 1 ? 'c\'e\' un file' : `ci sono ${quanti} file`} che non serve piu' e che non si riesce a togliere. Non e' un guasto e non e' colpa di un caricamento: la piattaforma non ha nessuna operazione per cancellare un file, ne' da programma ne' dal suo pannello, e l'ha confermato la sua assistenza il 30/09/2026. Quello che sale, resta.`,
      'I dati non ne soffrono: i record, i numeri e la storia scritta sono al loro posto, e l\'alleggerimento dei documenti a quaranta giorni continua a funzionare, perche\' li\' se ne va il testo e non il file. Non c\'e\' nemmeno un limite di spazio da temere: i limiti sono solo sulla dimensione del singolo file.',
      pubblici
        ? `Attenzione pero': ${pubblici === 1 ? 'uno di questi file e\' stato caricato' : `${pubblici} di questi file sono stati caricati`} in area pubblica, prima del 30/09/2026. Il loro indirizzo funziona per chiunque ce l'abbia e non si puo' revocare. Sono quelli da far rimuovere per primi.`
        : 'I file nuovi salgono in area privata: si aprono solo con un link firmato che scade in pochi minuti, quindi restano occupati ma non sono raggiungibili da nessuno.',
      ...(elenco.length ? ['Di che file si tratta:', ...elenco] : []),
      'Che cosa si puo\' fare: farli rimuovere dal team della piattaforma, che e\' l\'unica strada che esiste. L\'elenco completo da mandargli si scarica dal pulsante "Elenco dei file caricati", in Caricamento Dati. Questo avviso non si chiude da solo: chiudilo tu quando te lo confermano.',
    ].join('\n'),
    severita: 'warning',
    modulo: 'manutenzione',
    entity_type: 'UploadLog',
    record_id,
    regola_id: REGOLA_FILE,
    regola_nome: 'File caricati che non si possono cancellare',
    stato: 'aperto',
    quanti,
  };
  if (aperti.length) {
    await Alert.update(aperti[0].id, dati);
    for (const a of aperti.slice(1)) await Alert.update(a.id, { stato: 'risolto', risolto_note: `Chiuso automaticamente il ${giorno}: doppione.` });
    return { alert: 'aggiornato', quanti, pubblici };
  }
  await Alert.create(dati);
  return { alert: 'aperto', quanti, pubblici };
}
