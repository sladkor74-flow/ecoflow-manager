// IL REGISTRO DEI FILE CHE NESSUN RECORD USA PIU'.
//
// La piattaforma non cancella i file. Lo ha detto la sua assistenza il
// 30/09/2026 e lo ha riconfermato il 02/10/2026, aggiungendo il pezzo che
// mancava: «Stored files have no retention schedule: a file stays in storage
// after its record is deleted or replaced, until support removes it». Nello
// stesso messaggio c'e' anche come si rimuovono, e questa e' la parte nuova:
// «We remove specific files on request. Send the file_uri values for private
// files or the full URLs for public ones».
//
// QUI STA IL BUCO CHE QUELLA RISPOSTA HA APERTO. L'inventario dei file
// (shared/inventarioFile.ts) nasce DAI RECORD: ogni sua riga e' un file che un
// record sta usando. Un file il cui record non c'e' piu' non compare da nessuna
// parte - non nell'inventario, non in un pannello della piattaforma, che non li
// mostra, e non nei nostri archivi. Resta caricato per sempre e non ne sappiamo
// piu' nemmeno il nome: e' esattamente il caso che shared/fileArchivio.ts chiama
// «il danno peggiore di tutta questa storia», non poter far rimuovere un file
// perche' non si sa piu' quale chiedere. Finche' la rimozione non si poteva
// chiedere a nessuno era una perdita senza rimedio; adesso che si puo' chiedere,
// l'unica cosa che manca e' sapere quali.
//
// E non e' un caso di scuola: cancellare la verifica di un report settimanale o
// una quadratura FIR e' un gesto normale del lavoro di ogni settimana - si
// rifa' la verifica, e quella di prima si cancella - e quando il fornitore ha
// mandato un PDF o una fotografia quel record porta un file_uri. Gli Excel no:
// si leggono nel browser e non salgono mai.
//
// Quindi prima di cancellare un record si scrive qui il suo file, e questo
// registro diventa l'elenco da mandare all'assistenza.
//
// NON SI SCRIVE UN FILE CHE QUALCUNO ANCORA USA. Il registro dice "nessuno lo
// usa piu'", e su quella frase qualcuno cancellera' per sempre: e' la stessa
// prudenza con cui l'inventario marca i privati "NON RIMUOVERE", dopo che il
// 02/10/2026 ci sono mancati 144 documenti di qualifica per un elenco mandato
// senza quella colonna.

/** Lo stato di una voce del registro, da quando si annota a quando il file e' sparito. */
export const STATI_DA_RIMUOVERE = ['da_chiedere', 'chiesto', 'rimosso'];

/** Perche' quel file non serve piu'. */
export const MOTIVO_RECORD_CANCELLATO = 'record cancellato';
export const MOTIVO_FILE_SOSTITUITO = 'file sostituito';

const testo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/**
 * La voce di registro per un record che sta per sparire. null se quel record non
 * tiene nessun file: non c'e' niente da far rimuovere e una riga vuota nel
 * registro sarebbe una richiesta sbagliata in piu'.
 *
 * Il genere si decide come nell'inventario: se ci sono tutti e due vince il
 * pubblico, perche' e' l'indirizzo che funziona per chiunque ce l'abbia.
 *
 * cosa e descrizione li passa chi chiama, che sa di che si tratta: "report
 * settimanale di un fornitore", "NAPPI SUD · settimana 38/2026". Servono a chi
 * legge il registro mesi dopo, quando il record non esiste piu' e il riferimento
 * e' solo una stringa.
 *
 * Funzione pura: le prove la chiamano senza toccare la piattaforma.
 */
export function voceDaRimuovere({ entita, record, motivo, cosa = '', descrizione = '', oggi = '' }) {
  const r = record || {};
  const url = testo(r.file_url);
  const uri = testo(r.file_uri);
  if (!url && !uri) return null;
  return {
    riferimento: url || uri,
    genere: url ? 'pubblico' : 'privato',
    entita: testo(entita),
    record_id: testo(r.id),
    cosa: testo(cosa),
    descrizione: testo(descrizione),
    motivo: testo(motivo) || MOTIVO_RECORD_CANCELLATO,
    annotato_il: testo(oggi).slice(0, 10),
    stato: 'da_chiedere',
  };
}

/**
 * Le voci che nel registro non ci sono ancora, senza doppioni fra loro.
 *
 * Lo stesso file puo' tornare piu' volte: una verifica rifatta tre volte sullo
 * stesso PDF, un caricamento forzato che riusa il file del tentativo fallito.
 * Chiedere tre volte la rimozione dello stesso file e' il modo per farsi dire
 * che il conto non torna.
 *
 * Funzione pura: le prove la chiamano senza toccare la piattaforma.
 */
export function vociNuove(voci, giaPresenti) {
  const visti = new Set((giaPresenti || []).map(v => testo(v && v.riferimento)).filter(Boolean));
  const fuori = [];
  for (const v of voci || []) {
    if (!v || !testo(v.riferimento)) continue;
    const k = testo(v.riferimento);
    if (visti.has(k)) continue;
    visti.add(k);
    fuori.push(v);
  }
  return fuori;
}

/**
 * Scrive le voci nel registro. Entita e' l'accesso all'archivio FileDaRimuovere:
 * dal browser base44.entities.FileDaRimuovere, da una funzione
 * base44.asServiceRole.entities.FileDaRimuovere.
 *
 * NON SOLLEVA MAI. Chi la chiama sta cancellando un record, e un'annotazione che
 * non riesce non deve far fallire la cancellazione: il gestionale si comporta
 * cosi' anche per gli alert dopo un caricamento. Se qualcosa va storto torna
 * l'errore scritto, che chi chiama puo' dire o ignorare.
 */
export async function annotaFileDaRimuovere(Entita, voci) {
  const buone = (voci || []).filter(v => v && testo(v.riferimento));
  if (!buone.length) return { annotati: 0, gia: 0, errore: null };
  try {
    const gia = [];
    for (const rif of new Set(buone.map(v => testo(v.riferimento)))) {
      const trovate = await Entita.filter({ riferimento: rif }, 'id', 1);
      if (trovate && trovate.length) gia.push({ riferimento: rif });
    }
    const nuove = vociNuove(buone, gia);
    for (const v of nuove) await Entita.create(v);
    return { annotati: nuove.length, gia: gia.length, errore: null };
  } catch (e) {
    return { annotati: 0, gia: 0, errore: e && e.message ? e.message : String(e) };
  }
}

// CHE COS'E' IL FILE DI UN RECORD, ARCHIVIO PER ARCHIVIO.
//
// Le stesse parole dell'inventario (shared/inventarioFile.ts), perche' una voce
// di questo registro e una dell'inventario parlano della stessa cosa e finiscono
// nello stesso elenco: due nomi diversi per lo stesso genere di file farebbero
// sembrare due pratiche quella che e' una. Che restino uguali lo controlla
// prove/fileDaRimuovere.mjs.
//
// Qui ci sono solo gli archivi da cui un record si cancella davvero. Gli altri -
// i documenti di qualifica, i contratti, i modelli, i caricamenti - non si
// cancellano mai: il record resta e porta la sua storia, quindi il file ha
// sempre qualcuno che lo nomina e l'inventario lo vede.
export const DESCRIVE = {
  VerificaReport: {
    cosa: 'report settimanale di un fornitore',
    etichetta: (r) => `${r.soggetto_nome || ''} · settimana ${r.settimana || ''}/${r.anno || ''}`,
  },
  QuadraturaFir: {
    cosa: 'stampa della quadratura FIR',
    etichetta: (r) => `settimana ${r.settimana || ''}/${r.anno || ''} · ${r.file_nome || ''}`,
  },
};

/**
 * La voce di registro per un record di un archivio noto: le parole non si
 * riscrivono a mano in ogni punto di cancellazione.
 *
 * Funzione pura: le prove la chiamano senza toccare la piattaforma.
 */
export function voceDaRimuovereDi(entita, record, motivo, oggi) {
  const d = DESCRIVE[entita] || {};
  return voceDaRimuovere({
    entita,
    record,
    motivo,
    cosa: d.cosa || '',
    descrizione: d.etichetta ? d.etichetta(record || {}) : '',
    oggi,
  });
}

/**
 * UNA RIGA SOLA DOVE SI CANCELLA. Si chiama prima della cancellazione, con il
 * record ancora in mano: dopo, il file_uri non si recupera piu' da nessuna parte.
 *
 * Non solleva mai, come annotaFileDaRimuovere: la cancellazione deve andare
 * avanti comunque.
 */
export async function annotaPrimaDiCancellare(Entita, entita, record, oggi, motivo = MOTIVO_RECORD_CANCELLATO) {
  return annotaFileDaRimuovere(Entita, [voceDaRimuovereDi(entita, record, motivo, oggi)]);
}
