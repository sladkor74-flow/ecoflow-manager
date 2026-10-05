// CHI PUO' APRIRE UN FILE CARICATO, E PERCHE' IL file_uri NON SI MANDA AL BROWSER.
//
// RISPOSTA DELL'ASSISTENZA DELLA PIATTAFORMA, 05/10/2026. E' la correzione di una
// cosa che in questo repository era scritta come vera in tre posti:
//
//   «A file_uri works as a capability within your app. Any signed-in user of your
//    app who holds a private file_uri can call CreateFileSignedUrl with it and get
//    a working signed URL. Signing isn't checked against that user, or against the
//    RLS of the record that holds the reference. There's currently no setting that
//    limits CreateFileSignedUrl to asServiceRole calls from a backend function.
//    Signed file URLs keep working from the browser even with core integration
//    protection turned on.»
//
// Quindi un file privato NON e' "irraggiungibile finche' nessuno lo firma", come
// dicevano i commenti di fileScaricabile.ts e inventarioFile.ts. E' irraggiungibile
// per chi sta FUORI dall'applicazione - e quella difesa resta intera, ed e' la
// ragione per cui si carica solo con UploadPrivateFile. Per chi e' DENTRO, cioe'
// per qualunque utente collegato, il file_uri e' la chiave del documento: chi lo
// legge lo apre, e nessuna regola RLS glielo impedisce.
//
// IL DANNO CHE QUESTO APRIVA, misurato sul codice il 05/10/2026: la funzione
// qualificaFornitori, che la pagina chiama a ogni apertura e che risponde a
// qualunque utente collegato, mandava nel riepilogo il `file_uri` di ogni
// documento di qualifica. Nella pagina il pulsante «Apri» si disegna solo per
// l'amministratore (`{isAdmin && ...}` in SoggettoDettaglio.jsx), quindi
// l'intenzione era scritta: quei documenti li apre lui. Ma sono DURC, polizze,
// visure, patenti degli autisti e CQC - documenti di terzi, con dati personali di
// dipendenti di altre aziende - e con il file_uri in mano li apriva chiunque fosse
// collegato. Un pulsante nascosto non e' un permesso.
//
// LA REGOLA, DA QUI IN AVANTI. Il riferimento di un file non esce dal server se
// non a chi quel file lo puo' aprire, e si apre passando dalla funzione apriFile,
// che guarda il record e firma con asServiceRole. E' la prima delle tre strade che
// l'assistenza indica, ed e' quella che tiene anche se la seconda (il file_uri in
// un archivio che solo l'amministratore legge) non si puo' applicare, perche' quel
// campo sta in un archivio che tutti devono leggere.

const testo = (v) => String(v ?? '').trim();

// Quanto vale il link firmato. L'assistenza: «Keep the expiry short (for example,
// the default 300 seconds), since a signed URL works for anyone who has it until
// it expires». 300 secondi e' il minimo della piattaforma e bastano: il link si
// chiede nel momento in cui si preme il pulsante.
export const SECONDI_LINK = 300;

// GLI ARCHIVI DA CUI SI PUO' CHIEDERE UN FILE, E CHI PUO' CHIEDERLO.
//
// E' un elenco di permessi, non una comodita': una funzione che firma qualunque
// campo di qualunque archivio sarebbe peggio del buco che chiude, perche'
// basterebbe conoscere il nome di un'entita'. Qui ci sono solo gli archivi che un
// pulsante del gestionale apre davvero, oggi. Gli altri si aggiungono quando
// servono - un ramo che nessun chiamante usa e' tutto il rischio e nessun
// servizio reso (e' la lezione del 02/10/2026 su controlloQualifiche).
//
//   chi: 'admin'  lo apre solo l'amministratore. Coincide con il pulsante che la
//                 pagina gia' disegnava per lui solo: adesso lo dice il server.
//   chi: 'tutti'  lo apre qualunque utente collegato. Non e' una rinuncia: sono i
//                 modelli delle lettere, e la cartella del mese di Irigom la
//                 scarica chiunque (il pulsante non e' mai stato riservato).
export const ARCHIVI_APRIBILI = {
  DocumentoQualifica: {
    campo: 'file_uri', chi: 'admin',
    cosa: 'documento di qualifica di un fornitore',
    nome: (r) => `${r.soggetto_nome || ''} ${r.tipo_documento_nome || ''}`.trim() || r.file_nome,
  },
  ContrattoFornitore: {
    campo: 'file_uri', chi: 'admin',
    cosa: 'contratto di un fornitore',
    nome: (r) => `${r.fornitore_nome || ''} ${r.anno || ''}`.trim() || r.file_nome,
  },
  ModelloContratto: {
    campo: 'file_uri', chi: 'admin',
    cosa: 'modello di contratto',
    nome: (r) => r.nome || r.file_nome,
  },
  ModelloDocumento: {
    campo: 'file_uri', chi: 'tutti',
    cosa: 'modello di lettera',
    nome: (r) => r.nome || r.file_nome,
  },
};

export const MOTIVO_ARCHIVIO = 'Da questo archivio il gestionale non apre file.';
export const MOTIVO_RISERVATO = 'Questo documento lo apre solo l\'amministratore.'
  + ' Puoi consultare ed esportare tutto il resto; per averne una copia apri una richiesta dal modulo Richieste.';
export const MOTIVO_SENZA_FILE = 'Questo record non ha piu\' un file: il dettaglio dei documenti si conserva quaranta giorni.';
// Un indirizzo non si accetta da chi chiama: e' la stessa regola di
// fileScaricabile.riferimentoDalCorpo, trovata dalla scansione di sicurezza il
// 02/10/2026. Qui vale ancora di piu', perche' la firma la mette il server.
export const MOTIVO_SOLO_RECORD = 'Un file si chiede per archivio e identificativo del record, non per indirizzo.';

/** La definizione di quell'archivio, oppure null se da li' non si aprono file. */
export const archivioApribile = (entita) => Object.prototype.hasOwnProperty.call(ARCHIVI_APRIBILI, testo(entita))
  ? ARCHIVI_APRIBILI[testo(entita)]
  : null;

/** true se questo utente puo' aprire i file di quell'archivio. */
export function puoAprire(entita, user) {
  const def = archivioApribile(entita);
  if (!def) return false;
  if (def.chi === 'tutti') return !!user;
  return !!user && user.role === 'admin';
}

/**
 * Che cosa rispondere a una richiesta di apertura, guardata prima di toccare gli
 * archivi: { def, errore, stato }. Se errore non e' null chi chiama risponde e si
 * ferma. Sta qui, e non nella funzione, perche' e' la regola: le prove la leggono
 * da un posto solo.
 */
export function controllaRichiesta({ entita, id, file_uri, file_url, user }) {
  if (!user) return { def: null, errore: 'Unauthorized', stato: 401 };
  if (testo(file_uri) || testo(file_url)) return { def: null, errore: MOTIVO_SOLO_RECORD, stato: 400 };
  const def = archivioApribile(entita);
  if (!def) return { def: null, errore: MOTIVO_ARCHIVIO, stato: 400 };
  if (!testo(id)) return { def: null, errore: 'Manca l\'identificativo del record.', stato: 400 };
  if (!puoAprire(entita, user)) return { def: null, errore: MOTIVO_RISERVATO, stato: 403 };
  return { def, errore: null, stato: 200 };
}
