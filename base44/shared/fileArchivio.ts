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
 * Prova a cancellare un file. Restituisce { riuscita, come, negata }:
 * come e' il nome dell'operazione che ha funzionato, oppure il motivo; negata
 * dice che la piattaforma ha rifiutato l'operazione in quanto operazione, e
 * allora riprovare non serve.
 */
export async function cancellaFile(base44, fileUri) {
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
        nonRiusciti.push({ id: c.id, nome_file: c.nome_file, motivo: esito.come, negata: !!esito.negata });
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
      await segnalaFileNonRimossi(base44, { supporto: supportoCancellazione(base44), nonRiusciti, bloccati: restano, oggi });
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
          nonRiusciti.push({ tipo_file: g.tipo_file, nome_file: c.nome_file, motivo: esito.come, negata: !!esito.negata });
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

// === SI PUO' CANCELLARE, SI'  O NO? ===
//
// Il gestionale prova a togliere ogni file che non serve piu'. Ma nessuno sa se la
// piattaforma lo consenta: non e' documentato, e cancellaFile prova i nomi noti.
// Finche' l'esito resta dentro la risposta di una funzione, nessuno lo legge e si
// crede di aver liberato spazio senza averlo fatto. Quindi si guarda, e si dice.

/** Quali operazioni di cancellazione la piattaforma espone. Non cancella niente. */
export function supportoCancellazione(base44) {
  let core = null;
  try { core = base44.asServiceRole.integrations.Core; } catch (_e) { core = null; }
  const nomi = ['DeleteFile', 'DeletePrivateFile', 'RemoveFile'];
  const operazioni = core ? nomi.filter(n => typeof core[n] === 'function') : [];
  return { supportata: operazioni.length > 0, operazioni, provate: nomi };
}

const REGOLA_FILE = 'file_non_rimossi';

/**
 * Apre (o chiude) l'alert sui file che non si riesce a togliere.
 *
 * Un alert e' l'unico posto dove l'amministratore lo vede senza chiedere a
 * nessuno: la risposta di una funzione pianificata non la legge mai. Si chiude da
 * solo quando i file se ne vanno, come tutti gli altri alert del gestionale.
 */
export async function segnalaFileNonRimossi(base44, { supporto, nonRiusciti = [], bloccati = null, oggi }) {
  const Alert = base44.asServiceRole.entities.Alert;
  const record_id = 'archivio-file';
  const aperti = await Alert.filter({ regola_id: REGOLA_FILE, record_id, stato: 'aperto' }, 'id', 20);
  const giorno = String(oggi || '').slice(0, 10).split('-').reverse().join('/');
  // TRE CASI, TRE FRASI DIVERSE. Fino al 30/09/2026 ce n'erano due, e il caso
  // vero - le operazioni ci sono ma la piattaforma le rifiuta - cadeva nel primo:
  // l'alert diceva "59 file non sono stati rimossi... il gestionale riprova da
  // solo alla prossima pulizia notturna", cioe' prometteva un ritentativo che non
  // puo' riuscire. Chi legge deve sapere se aspettare o se chiedere.
  const assenti = !supporto.supportata;
  const negata = cancellazioneNegata(nonRiusciti);
  const consentita = !assenti && !negata;
  // Quanti file restano li': i falliti sono quelli provati, e da quando si smette
  // al primo rifiuto dell'operazione sono uno o due. Il numero vero lo sa chi
  // chiama, e se non lo dice si contano i falliti.
  const quanti = bloccati == null ? nonRiusciti.length : Math.max(Number(bloccati) || 0, nonRiusciti.length);

  if (consentita && nonRiusciti.length === 0) {
    for (const a of aperti) {
      await Alert.update(a.id, { stato: 'risolto', risolto_note: `Chiuso automaticamente il ${giorno}: i file si cancellano di nuovo.` });
    }
    return { alert: 'chiuso', quanti: aperti.length };
  }

  const elenco = nonRiusciti.slice(0, 15).map(n => `- ${n.nome_file || n.entita || n.id || 'file'}: ${n.motivo || 'motivo non riportato'}`);
  if (nonRiusciti.length > elenco.length) elenco.push(`- e altri ${nonRiusciti.length - elenco.length}`);
  const dati = {
    titolo: consentita
      ? `${quanti} ${quanti === 1 ? 'file non e\' stato' : 'file non sono stati'} rimossi dall'archivio`
      : negata
        ? `La piattaforma rifiuta di cancellare i file: ${quanti} restano nell'archivio`
        : 'La piattaforma non consente di cancellare i file: l\'archivio non si puo\' alleggerire',
    descrizione: [
      consentita
        ? `Il ${giorno} il gestionale ha provato a togliere dei file che non servono piu' e non ci e' riuscito.`
        : negata
          ? `Il ${giorno} il gestionale ha provato a togliere i file che non servono piu' e la piattaforma ha rifiutato l'operazione: le funzioni ci sono (${(supporto.operazioni || []).join(', ')}) ma ogni chiamata torna indietro col rifiuto. Non e' un problema di un file: riprovare da' lo stesso esito su tutti, quindi il gestionale ha smesso dopo il primo tentativo invece di ripeterlo a vuoto su ogni file. I record, i dati e la storia scritta non ne soffrono - l'alleggerimento dei documenti a 40 giorni continua a funzionare, perche' li' se ne va il testo, non il file - cresce soltanto lo spazio occupato dai file caricati.`
          : `Il ${giorno} il gestionale ha cercato le operazioni per cancellare un file e non ne ha trovata nessuna (provate: ${(supporto.provate || []).join(', ')}). Finche' resta cosi', nessun file caricato puo' essere rimosso: ne' i PDF dei report settimanali e delle quadrature, ne' gli allegati dell'assistente, ne' gli Excel del Caricamento Dati. I record e i dati non ne soffrono: cresce soltanto lo spazio occupato.`,
      ...(elenco.length ? [negata ? 'Il rifiuto, per esteso:' : 'File rimasti:', ...elenco] : []),
      consentita
        ? 'Il gestionale riprova da solo alla prossima pulizia notturna. Se il motivo si ripete, va chiesto all\'assistenza della piattaforma.'
        : negata
          ? 'Va chiesto all\'assistenza della piattaforma se la cancellazione dei file si possa abilitare. Nel frattempo i file vecchi restano dove sono e vanno eventualmente rimossi a mano dall\'area file della piattaforma; per non farne salire di nuovi si possono leggere nel browser, come si fa per le primarie. Appena la cancellazione funziona, questo avviso si chiude da solo.'
          : 'Da chiedere all\'assistenza della piattaforma. In alternativa si puo\' evitare di far salire i file, leggendoli nel browser come si fa per le primarie.',
    ].join('\n'),
    severita: 'warning',
    modulo: 'manutenzione',
    entity_type: 'UploadLog',
    record_id,
    regola_id: REGOLA_FILE,
    regola_nome: 'File che non si riesce a togliere dall\'archivio',
    stato: 'aperto',
    quanti,
  };
  if (aperti.length) {
    await Alert.update(aperti[0].id, dati);
    for (const a of aperti.slice(1)) await Alert.update(a.id, { stato: 'risolto', risolto_note: `Chiuso automaticamente il ${giorno}: doppione.` });
    return { alert: 'aggiornato', quanti, negata };
  }
  await Alert.create(dati);
  return { alert: 'aperto', quanti, negata };
}
