// Chi puo' aprire un file caricato (base44/shared/fileRiservato.ts) e il modo in
// cui si apre (funzione apriFile).
//
// PERCHE' SI PROVA. L'assistenza della piattaforma, il 05/10/2026: «Any
// signed-in user of your app who holds a private file_uri can call
// CreateFileSignedUrl with it and get a working signed URL. Signing isn't checked
// against that user, or against the RLS of the record that holds the reference».
// Cioe' il file_uri e' la chiave del documento per qualunque utente collegato, e
// non esiste un'impostazione per riservare la firma al server.
//
// Questo rende silenziosa una categoria di errori: basta che una funzione
// rimetta un file_uri nella risposta, o che un pulsante torni a firmare da solo, e
// i documenti dei fornitori - DURC, polizze, visure, patenti degli autisti -
// tornano apribili da chiunque sia collegato. A video non si vedrebbe niente: il
// pulsante resta nascosto come prima, ed e' proprio questo il punto. Per questo
// una parte di queste prove guarda il SORGENTE.
//
// npm run prove
import { readFileSync } from 'node:fs';
import {
  ARCHIVI_APRIBILI, SECONDI_LINK, archivioApribile, puoAprire, controllaRichiesta,
  MOTIVO_ARCHIVIO, MOTIVO_RISERVATO, MOTIVO_SOLO_RECORD, MOTIVO_SENZA_FILE,
} from '../base44/shared/fileRiservato.ts';
import { ARCHIVI_CON_FILE } from '../base44/shared/inventarioFile.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
// I fine-riga si normalizzano: su Windows il checkout scrive CRLF e un confronto
// che cerca uno '\n' direbbe che manca un controllo che invece c'e'.
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ENTITA = (nome) => {
  const testo = sorgente(`base44/entities/${nome}.jsonc`);
  return JSON.parse(testo.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n'));
};

const ADMIN = { id: 'u1', email: 'admin@smoco', role: 'admin' };
const OPERATORE = { id: 'u2', email: 'operatore@smoco', role: 'user' };
const CONSULTAZIONE = { id: 'u3', email: 'altro@smoco', role: 'user' };

console.log('IL LINK DURA POCO, PERCHE\' VALE PER CHIUNQUE CE L\'ABBIA');
verifica('trecento secondi, come consiglia l assistenza', SECONDI_LINK === 300);
verifica('e non si allunga di nascosto', SECONDI_LINK >= 60 && SECONDI_LINK <= 600, String(SECONDI_LINK));

console.log('L\'ELENCO DEGLI ARCHIVI: CI STA SOLO QUELLO CHE UN PULSANTE APRE');
{
  // Un archivio in piu' qui dentro e' una porta in piu', e una funzione che firma
  // qualunque campo di qualunque entita' sarebbe peggio del buco che chiude.
  const nomi = Object.keys(ARCHIVI_APRIBILI).sort();
  verifica('sono i quattro che il gestionale apre davvero',
    nomi.join(',') === 'ContrattoFornitore,DocumentoQualifica,ModelloContratto,ModelloDocumento', nomi.join(','));
  // Ogni archivio apribile deve essere un archivio che tiene file per davvero:
  // l'inventario dei file e' l'elenco di quelli, e nasce dagli stessi record.
  const conFile = new Set(ARCHIVI_CON_FILE.map(a => a.entita));
  verifica('e sono tutti archivi che tengono file', nomi.every(n => conFile.has(n)),
    nomi.filter(n => !conFile.has(n)).join(','));
  verifica('ognuno dice da quale campo e chi puo aprirlo',
    nomi.every(n => ARCHIVI_APRIBILI[n].campo && ['admin', 'tutti'].includes(ARCHIVI_APRIBILI[n].chi)));
  verifica('un archivio che non c e non si apre', archivioApribile('PrimariaRete') === null);
  verifica('e nemmeno un nome inventato o vuoto',
    archivioApribile('') === null && archivioApribile(undefined) === null && archivioApribile('toString') === null);
}

console.log('I DOCUMENTI DEI FORNITORI LI APRE L\'AMMINISTRATORE');
{
  // Sono DURC, polizze, visure, patenti degli autisti e CQC: documenti di terzi,
  // con dati personali di dipendenti di altre aziende. Il pulsante «Apri» nella
  // pagina si disegnava solo per l'amministratore da sempre; prima del
  // 05/10/2026 era l'unica cosa che lo impediva, e non impediva niente.
  verifica('l amministratore apre il documento di qualifica', puoAprire('DocumentoQualifica', ADMIN));
  verifica('un operatore no', !puoAprire('DocumentoQualifica', OPERATORE));
  verifica('chi consulta no', !puoAprire('DocumentoQualifica', CONSULTAZIONE));
  verifica('e chi non e collegato nemmeno', !puoAprire('DocumentoQualifica', null));
  verifica('il contratto di un fornitore e il suo modello, uguale',
    puoAprire('ContrattoFornitore', ADMIN) && !puoAprire('ContrattoFornitore', OPERATORE)
    && puoAprire('ModelloContratto', ADMIN) && !puoAprire('ModelloContratto', OPERATORE));
  // I modelli delle lettere no: la cartella del mese di Irigom la scarica
  // chiunque, e quel pulsante non e' mai stato riservato. Stringerlo qui
  // spegnerebbe un lavoro che si fa ogni mese.
  verifica('i modelli delle lettere li apre chiunque sia collegato',
    puoAprire('ModelloDocumento', OPERATORE) && puoAprire('ModelloDocumento', ADMIN));
  verifica('ma non chi non e collegato', !puoAprire('ModelloDocumento', null));
}

console.log('LA RICHIESTA SI CONTROLLA PRIMA DI TOCCARE GLI ARCHIVI');
{
  const buona = controllaRichiesta({ entita: 'DocumentoQualifica', id: 'd1', user: ADMIN });
  verifica('una richiesta buona passa, e dice da che campo leggere',
    buona.errore === null && buona.def.campo === 'file_uri', JSON.stringify(buona.errore));
  const senzaUtente = controllaRichiesta({ entita: 'DocumentoQualifica', id: 'd1', user: null });
  verifica('senza utente e 401', senzaUtente.stato === 401 && senzaUtente.errore === 'Unauthorized');
  const vietata = controllaRichiesta({ entita: 'DocumentoQualifica', id: 'd1', user: OPERATORE });
  verifica('a chi non puo si risponde 403, non 404', vietata.stato === 403 && vietata.errore === MOTIVO_RISERVATO);
  verifica('e gli si dice che puo aprire una richiesta', /modulo Richieste/.test(MOTIVO_RISERVATO));
  const altroArchivio = controllaRichiesta({ entita: 'PrimariaRete', id: 'x', user: ADMIN });
  verifica('da un archivio non previsto non si apre niente',
    altroArchivio.stato === 400 && altroArchivio.errore === MOTIVO_ARCHIVIO);
  verifica('senza identificativo non si cerca niente',
    controllaRichiesta({ entita: 'DocumentoQualifica', id: '', user: ADMIN }).stato === 400);
  // IL SERVER NON VA DOVE GLI SI DICE DI ANDARE. E' la regola che la scansione
  // di sicurezza ha imposto il 02/10/2026 su importEcotyreFile (SSRF). Qui vale
  // di piu', perche' la firma la mette il server: un file_uri accettato dal corpo
  // riaprirebbe esattamente il buco, con la comodita' in piu'.
  const conUri = controllaRichiesta({ entita: 'DocumentoQualifica', id: 'd1', file_uri: 'uri-di-un-altro', user: OPERATORE });
  verifica('un file_uri nel corpo non si accetta', conUri.stato === 400 && conUri.errore === MOTIVO_SOLO_RECORD);
  verifica('nemmeno dall amministratore',
    controllaRichiesta({ entita: 'DocumentoQualifica', id: 'd1', file_uri: 'x', user: ADMIN }).errore === MOTIVO_SOLO_RECORD);
  verifica('e nemmeno un indirizzo',
    controllaRichiesta({ entita: 'DocumentoQualifica', id: 'd1', file_url: 'https://media.base44.com/files/public/app/x', user: ADMIN }).errore === MOTIVO_SOLO_RECORD);
  // Il controllo del corpo viene PRIMA del permesso: cosi' la risposta non
  // cambia a seconda di chi chiede, e non si impara niente provandoci.
  verifica('il corpo si guarda prima del permesso', conUri.stato === 400);
}

console.log('IL file_uri NON ESCE DAL SERVER');
{
  // Il riepilogo della qualifica lo chiede la pagina a ogni apertura e la
  // funzione risponde a qualunque utente collegato. Finche' qui c'era il
  // file_uri, quello era il documento in chiaro.
  const s = sorgente('base44/shared/qualificaFornitori.ts');
  verifica('il riepilogo dice solo se il file c e', /ha_file: !!doc\.file_uri,/.test(s));
  verifica('e non manda piu il riferimento', !/file_uri: doc\.file_uri/.test(s), 'il file_uri e tornato nel riepilogo');
}
{
  // La seconda strada dell'assistenza: il riferimento in un archivio che solo
  // l'amministratore legge. Qui si puo' fare perche' la pagina non legge questo
  // archivio dal browser, legge il riepilogo della funzione.
  const rls = ENTITA('DocumentoQualifica').rls || {};
  verifica('DocumentoQualifica non e piu leggibile da tutti', rls.read !== true, JSON.stringify(rls.read));
  verifica('la lettura e dell amministratore',
    rls.read && rls.read.user_condition && rls.read.user_condition.role === 'admin', JSON.stringify(rls.read));
  verifica('e scrivere resta dell amministratore, come prima',
    ['create', 'update', 'delete'].every(k => rls[k] && rls[k].user_condition && rls[k].user_condition.role === 'admin'));
}
{
  // Nessuna pagina deve tornare a firmare da sola. E' il controllo che conta di
  // piu': una riga come questa non da' nessun errore, funziona benissimo, e
  // riapre il buco in silenzio.
  const pagine = [
    'src/components/qualifica/SoggettoDettaglio.jsx',
    'src/components/qualifica/ContrattiAnno.jsx',
    'src/components/dichiarazioni/PraticaIrigom.jsx',
  ];
  const colpevoli = pagine.filter(p => /CreateFileSignedUrl/.test(sorgente(p)));
  verifica('nessuna pagina firma piu da sola', colpevoli.length === 0, colpevoli.join(', '));
  const conLink = pagine.filter(p => /linkFile\(/.test(sorgente(p)));
  verifica('e tutte e tre passano da linkFile', conLink.length === 3, conLink.join(', '));
  // Il documento di qualifica si apre per identificativo del record: il browser
  // non ha piu' niente da firmare.
  verifica('il documento si apre per id', /linkFile\('DocumentoQualifica', doc\.id\)/.test(sorgente(pagine[0])));
  verifica('e il pulsante compare solo se il file c e ancora', /doc\.ha_file && \(/.test(sorgente(pagine[0])));
}
{
  // La funzione: il permesso lo decide il modulo condiviso, il record si legge
  // con asServiceRole (l'archivio dal browser non si legge piu') e la firma dura
  // quanto dice SECONDI_LINK.
  const f = sorgente('base44/functions/apriFile/entry.ts');
  verifica('il permesso lo decide controllaRichiesta', /const \{ def, errore, stato \} = controllaRichiesta\(/.test(f));
  verifica('e si risponde subito se non si puo', /if \(errore\) return Response\.json\(/.test(f));
  verifica('il record si legge con asServiceRole',
    /base44\.asServiceRole\.entities\[entita\]\.get\(id\)/.test(f));
  verifica('si firma solo il campo che l elenco indica', /record\[def\.campo\]/.test(f));
  verifica('con la scadenza del modulo condiviso', /expires_in: SECONDI_LINK/.test(f));
  verifica('un record senza file si dice, non si finge', /senza_file: true/.test(f) && /MOTIVO_SENZA_FILE/.test(f));
  verifica('e il motivo spiega i quaranta giorni', /quaranta giorni/.test(MOTIVO_SENZA_FILE));
  // Il nome del file nella risposta serve a video; il riferimento no, e non deve
  // tornare indietro per nessuna strada: chi lo riceve non ha piu' bisogno del
  // permesso per riusarlo.
  verifica('torna solo indirizzo, nome e scadenza',
    /return Response\.json\(\{ ok: true, url, nome: [^\n]*, scade_fra: SECONDI_LINK \}\);/.test(f));
  verifica('e il riferimento non e fra i campi che tornano', !/json\(\{[^}]*\buri\b/.test(f));
}

console.log('CHE COSA RESTA APERTO, SCRITTO DOVE SI LEGGE');
{
  // Gli archivi con un file che tengono ancora il riferimento su record che
  // tutti leggono. Non e' una svista: per UploadLog la lettura aperta SERVE
  // (otto pagine la usano per accorgersi di un caricamento nuovo), quindi la sola
  // strada e' spostare il riferimento, con la migrazione dei record. E' una
  // decisione sull'accesso e va chiesta. Questa prova tiene il conto: se un
  // giorno uno di questi viene chiuso, qui si vede.
  const aperti = ARCHIVI_CON_FILE.filter(a => {
    const rls = ENTITA(a.entita).rls || {};
    return rls.read === true;
  }).map(a => a.entita).sort();
  verifica('restano cinque archivi con il riferimento leggibile da tutti',
    aperti.join(',') === 'ContrattoFornitore,ModelloContratto,ModelloDocumento,QuadraturaFir,UploadLog,VerificaReport'
    || aperti.join(',') === 'ContrattoFornitore,EsportazioneFatturazione,ModelloContratto,ModelloDocumento,QuadraturaFir,UploadLog,VerificaReport',
    aperti.join(','));
  verifica('e il documento di qualifica non e fra quelli', !aperti.includes('DocumentoQualifica'));
  // Nelle istruzioni del progetto la cosa resta scritta, con il motivo: un
  // buco noto che non sta scritto da nessuna parte e' un buco dimenticato.
  const agents = sorgente('AGENTS.md');
  verifica('AGENTS.md riporta la precisazione dell assistenza',
    /A file_uri works as a capability within your app/.test(agents));
  verifica('e dice che cosa resta da decidere', /Quello che resta da decidere/.test(agents));
}

console.log('LE AFFERMAZIONI CHE NON SONO PIU\' VERE SONO STATE CORRETTE');
{
  // Erano tre, e dicevano tutte la stessa cosa sbagliata: che un file privato
  // non e' esposto. Era vero verso l'esterno, falso dentro l'app. Un commento
  // sbagliato su una difesa e' peggio di nessun commento: e' quello che fa
  // decidere male la volta dopo.
  const scaricabile = sorgente('base44/shared/fileScaricabile.ts');
  verifica('fileScaricabile.ts dice come stanno le cose',
    /PRIVATO VUOL DIRE "FUORI DALL'APP", NON "AL SICURO DA TUTTI"/.test(scaricabile));
  verifica('e manda a leggere la regola', /shared\/fileRiservato\.ts/.test(scaricabile));
  const inventario = sorgente('base44/shared/inventarioFile.ts');
  verifica('l inventario non dice piu che un privato e irraggiungibile',
    !/e' gia' irraggiungibile/.test(inventario) && !/non e' esposto, ed e'/.test(inventario));
  verifica('e spiega la differenza fra dentro e fuori', /Da fuori dall'applicazione e'/.test(inventario));
  // Il consiglio sull'inventario resta quello: un file privato in uso NON si fa
  // rimuovere. La precisazione non cambia questo, cambia chi lo puo' aprire.
  verifica('un privato in uso resta da non rimuovere', /NON si fa\n\/\/              rimuovere/.test(inventario));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
