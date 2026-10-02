// Specchio di base44/shared/fileDaRimuovere.ts: il registro dei file che nessun
// record usa piu', da far rimuovere all'assistenza della piattaforma, che non ha
// nessun modo di cancellarli da sola. Le pagine non possono importare da
// base44/shared e questo serve anche a loro: le verifiche dei report e le
// quadrature si cancellano dal browser, ed e' li' che un file resterebbe
// caricato senza che nessuno ne sappia piu' il nome. Le due copie restano uguali
// perche' prove/specchi.mjs lo controlla.

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
