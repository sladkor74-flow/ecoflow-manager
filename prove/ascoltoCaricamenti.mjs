// UNA PAGINA APERTA E I CARICAMENTI: UN EVENTO PER RIGA DEL REGISTRO
// (revisione del 13/10/2026, rilievi sulle segnalazioni alte A3 e A14).
//
// importaBlocco scrive sul registro, per un caricamento delle primarie: la riga
// vecchia rimasta aperta chiusa in «errore», la riga nuova «in_corso», la sua
// chiusura «successo» (o «parziale»), e a ricalcoli finiti la nota «moduli
// collegati aggiornati» sulla stessa riga. Le pagine iscritte al registro
// rileggevano a ogni evento non «in_corso»: tre volte per un caricamento.
// src/lib/ascoltoCaricamenti.js li legge una volta per riga: «concluso» alla
// chiusura, «moduli_aggiornati» alla nota. Qui la sequenza vera, i casi di
// confine (pagina aperta a meta' caricamento o a meta' ricalcoli, eventi
// ripetuti, rifiuti a dati intatti, eventi senza id) e il testo della nota,
// che deve essere quello che scrive importaBlocco.
import { readFileSync } from 'node:fs';
import { caricaPagina } from './dati/paginaFinta.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const { modulo } = await caricaPagina('lib/ascoltoCaricamenti');
const { creaAscoltoCaricamenti } = modulo;
verifica('la libreria esporta creaAscoltoCaricamenti', typeof creaAscoltoCaricamenti === 'function');

// La nota come la scrive importaBlocco: il testo si legge dal suo sorgente.
const sorgente = readFileSync(new URL('../base44/functions/importaBlocco/entry.ts', import.meta.url), 'utf8').replace(/\r/g, '');
const nota = (sorgente.match(/const MODULI_AGGIORNATI = '([^']+)'/) || [])[1];
verifica('importaBlocco ha la sua costante della nota', !!nota, String(nota));
verifica('e la attacca al messaggio con « | »', sorgente.includes("messaggio: `${ultimo.messaggio || ''} | ${MODULI_AGGIORNATI}`"));
const conNota = (m) => `${m} | ${nota}`;

const sintesi = (e) => (e ? ['in_corso', 'concluso', 'moduli_aggiornati'].filter(k => e[k]).join('+') || '-' : 'null');

console.log('LA SEQUENZA VERA DI UN CARICAMENTO: UNA CONCLUSIONE E UNA NOTA');
{
  const leggi = creaAscoltoCaricamenti(['primarie', 'primarie_rete']);
  const riga = { id: 'u9', tipo_file: 'primarie', nome_file: 'primarie.xlsx', utente: 'admin', modalita: 'sostituzione' };
  const passi = [
    // apriCaricamento: la riga del tentativo di prima, rimasta aperta, si chiude in errore
    { type: 'update', data: { id: 'u8', tipo_file: 'primarie', esito: 'errore', modalita: 'sostituzione', messaggio: "Caricamento interrotto: avviato da admin e mai concluso. L'archivio poteva essere incompleto; e' stato ricaricato dopo." } },
    { type: 'create', data: { ...riga, esito: 'in_corso', messaggio: 'Caricamento in corso: archivio in riscrittura.' } },
    { type: 'update', data: { ...riga, esito: 'successo', messaggio: '10487 righe importate' } },
    { type: 'update', data: { ...riga, esito: 'successo', messaggio: conNota('10487 righe importate') } },
  ].map(leggi);
  verifica('la riga vecchia chiusa in errore non e\' una conclusione', sintesi(passi[0]) === '-', sintesi(passi[0]));
  verifica('la riga nuova e\' in corso', sintesi(passi[1]) === 'in_corso', sintesi(passi[1]));
  verifica('la chiusura con successo e\' la conclusione', sintesi(passi[2]) === 'concluso' && passi[2].esito === 'successo', sintesi(passi[2]));
  verifica('la nota non e\' un\'altra conclusione: sono i moduli aggiornati', sintesi(passi[3]) === 'moduli_aggiornati', sintesi(passi[3]));
  verifica('in tutto una conclusione e una nota', passi.filter(e => e && e.concluso).length === 1 && passi.filter(e => e && e.moduli_aggiornati).length === 1);
  const ancora = leggi({ type: 'update', data: { ...riga, esito: 'successo', messaggio: conNota('10487 righe importate') } });
  verifica('la stessa nota ripetuta non conta due volte', sintesi(ancora) === '-', sintesi(ancora));
}

console.log('I CASI DI CONFINE');
{
  const leggi = creaAscoltoCaricamenti(['primarie']);
  // la pagina aperta mentre il caricamento scriveva: la prima cosa che sente e' la chiusura
  verifica('un caricamento partito prima dell\'apertura si conclude lo stesso', sintesi(leggi({ type: 'update', data: { id: 'u10', tipo_file: 'primarie', esito: 'successo', messaggio: 'ok' } })) === 'concluso');
  // la pagina aperta a ricalcoli in corso: l'archivio letto e' gia' quello nuovo
  verifica('aperta a meta\' ricalcoli: la nota e\' solo la nota', sintesi(leggi({ type: 'update', data: { id: 'u11', tipo_file: 'primarie', esito: 'successo', messaggio: conNota('ok') } })) === 'moduli_aggiornati');
  // una riga vista aperta e poi chiusa in errore da un caricamento nuovo
  leggi({ type: 'create', data: { id: 'u12', tipo_file: 'primarie', esito: 'in_corso' } });
  verifica('aperta e poi chiusa in errore: non si rilegge, si aspetta il caricamento nuovo', sintesi(leggi({ type: 'update', data: { id: 'u12', tipo_file: 'primarie', esito: 'errore', messaggio: "... e' stato ricaricato dopo." } })) === '-');
  // un rifiuto a dati intatti (controlli anti-regressione): riga nuova gia' in errore
  verifica('un rifiuto a dati intatti non cambia l\'archivio', sintesi(leggi({ type: 'create', data: { id: 'u13', tipo_file: 'primarie', esito: 'errore', messaggio: 'Il file ha meno ordini' } })) === '-');
  // un caricamento fallito dopo lo svuotamento resta in_corso col messaggio cambiato
  verifica('«non riuscito» resta in corso', sintesi(leggi({ type: 'update', data: { id: 'u12b', tipo_file: 'primarie', esito: 'in_corso', messaggio: 'Caricamento non riuscito: ...' } })) === 'in_corso');
  leggi({ type: 'create', data: { id: 'u14', tipo_file: 'primarie', esito: 'in_corso' } });
  const parziale = leggi({ type: 'update', data: { id: 'u14', tipo_file: 'primarie', esito: 'parziale', messaggio: '3 righe non scritte' } });
  verifica('un parziale ha riscritto l\'archivio: e\' una conclusione, col suo esito', sintesi(parziale) === 'concluso' && parziale.esito === 'parziale', JSON.stringify(parziale));
  // senza id non si ricorda niente: ogni esito finale vale come prima
  verifica('senza id ogni chiusura conta, come prima', sintesi(leggi({ type: 'update', data: { tipo_file: 'primarie', esito: 'successo' } })) === 'concluso'
    && sintesi(leggi({ type: 'update', data: { tipo_file: 'primarie', esito: 'successo' } })) === 'concluso');
  // l'id fuori dal record, come lo legge PredittivitaSecondarie
  leggi({ type: 'create', id: 'u15', data: { tipo_file: 'primarie', esito: 'in_corso' } });
  verifica('l\'id puo\' stare fuori dal record', sintesi(leggi({ type: 'update', id: 'u15', data: { tipo_file: 'primarie', esito: 'successo' } })) === 'concluso'
    && sintesi(leggi({ type: 'update', id: 'u15', data: { tipo_file: 'primarie', esito: 'successo', messaggio: conNota('x') } })) === 'moduli_aggiornati');
  verifica('gli altri tipi non riguardano chi ascolta le primarie', leggi({ type: 'update', data: { id: 's1', tipo_file: 'secondarie', esito: 'successo', messaggio: conNota('x') } }) === null);
  verifica('una cancellazione non e\' un caricamento', leggi({ type: 'delete', data: { id: 'u10', tipo_file: 'primarie', esito: 'successo' } }) === null);
  verifica('un evento vuoto non rompe niente', leggi({}) === null && leggi(null) === null);
}

// UNA RISCRITTURA FINITA IN ERRORE HA CAMBIATO L'ARCHIVIO (revisione del
// 13/10/2026). Le pagine che passano a questo ascolto rileggevano a ogni
// «errore»: la pagina dei PDR, quando importPdrFile non riesce a rimettere
// l'anagrafica di prima, mostrava cosi' quella rimasta. La regola e' quella del
// registro: un «errore» con la modalita' «sostituzione» e' una riscrittura non
// riuscita, tranne la riga vecchia che un caricamento nuovo chiude.
console.log('LE RISCRITTURE NON RIUSCITE E I RIFIUTI A DATI INTATTI');
{
  const leggi = creaAscoltoCaricamenti(['pdr', 'secondarie']);
  const fallita = leggi({ type: 'create', data: { id: 'p1', tipo_file: 'pdr', esito: 'errore', modalita: 'sostituzione',
    messaggio: "Sostituzione non riuscita: 120 PDR su 3000 del file non sono entrati; anche il ripristino dell'anagrafica di prima si e' fermato a 2800 PDR su 2950. L'anagrafica e' incompleta: ricarica il file." } });
  verifica('PDR, ripristino non riuscito: l\'archivio e\' cambiato, si rilegge', sintesi(fallita) === 'concluso' && fallita.esito === 'errore' && fallita.id === 'p1', JSON.stringify(fallita));
  verifica('PDR, ripristino riuscito (niente modalita\'): dati intatti, niente', sintesi(leggi({ type: 'create', data: { id: 'p2', tipo_file: 'pdr', esito: 'errore',
    messaggio: "Sostituzione non riuscita: 120 PDR su 3000 del file non sono entrati. Ripristinata l'anagrafica di prima (2950 PDR): ricarica il file." } })) === '-');
  verifica('un rifiuto prima di toccare l\'archivio: niente', sintesi(leggi({ type: 'create', data: { id: 'p3', tipo_file: 'pdr', esito: 'errore', messaggio: 'Il file ha meno PDR di quelli in archivio' } })) === '-');
  // importEcotyreFile: la riga aperta senza modalita', chiusa in errore prima dello svuotamento
  leggi({ type: 'create', data: { id: 's2', tipo_file: 'secondarie', esito: 'in_corso' } });
  verifica('aperta e chiusa in errore prima dello svuotamento: niente', sintesi(leggi({ type: 'update', data: { id: 's2', tipo_file: 'secondarie', esito: 'errore', messaggio: 'Timeout (fase: lettura del file)' } })) === '-');
  // la riga vecchia ha la modalita' (apriCaricamento di importaBlocco la scrive), ma la chiude un caricamento nuovo
  verifica('la riga vecchia, con la sua modalita\', chiusa da un caricamento nuovo: niente', sintesi(leggi({ type: 'update', data: { id: 's3', tipo_file: 'secondarie', esito: 'errore', modalita: 'sostituzione',
    messaggio: "Caricamento non riuscito: nessuna riga scritta dopo lo svuotamento dell'archivio. L'archivio e' vuoto: ricarica il file. E' stato ricaricato dopo." } })) === '-');
  const ripetuta = leggi({ type: 'update', data: { id: 'p1', tipo_file: 'pdr', esito: 'errore', modalita: 'sostituzione', messaggio: "Sostituzione non riuscita: ... L'anagrafica e' incompleta: ricarica il file." } });
  verifica('la stessa riscrittura non riuscita sentita due volte conta una volta', sintesi(ripetuta) === '-', sintesi(ripetuta));
  verifica('l\'id e\' null se l\'evento non lo porta', leggi({ type: 'create', data: { tipo_file: 'pdr', esito: 'successo' } }).id === null);
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
