// Prova dello storico conservato al caricamento (base44/shared/storicoConservato.ts).
// Un file che comincia dal 2025 conserva i terminati con la fine trasporto nel
// 2024: non sono mancanti e non si cancellano. L'anno e' sempre quello della
// fine trasporto. npm run prove
import { annoDelloStorico, ordiniDaConservare, cancellatiDaLasciare, svuotaTranne } from '../base44/shared/storicoConservato.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const t = (id, fine, extra = {}) => ({ id_ordine: id, stato: 'Terminato', trasporto_finito_il: fine, ordine_immesso_il: '2024-11-01T08:00:00Z', ...extra });

console.log("DA QUALE ANNO SI CARICA");
verifica('nel 2026 dal 2025, nel 2027 dal 2026: lo dice il calendario, non il file', annoDelloStorico('2026-09-25') === 2025 && annoDelloStorico('2027-03-01') === 2026);

console.log('CHE COSA SI CONSERVA');
const archivio = [
  t('V1', '2024-06-10T08:00:00Z'), t('V1', '2024-06-10T08:00:00Z'), // due righe dello stesso ordine
  t('V2', '2024-12-30T08:00:00Z'),
  t('N1', '2025-03-01T08:00:00Z'),
  t('SF', null),                                                   // terminato senza fine trasporto
  { id_ordine: 'AS', stato: 'Assegnato', ordine_immesso_il: '2024-10-01T08:00:00Z' },
  t('MX', '2024-12-20T08:00:00Z'), t('MX', '2025-01-02T08:00:00Z'), // righe a cavallo
  t('F24', '2024-05-01T08:00:00Z'),                                 // del 2024, ma anche nel file
];
const idFile = new Set(['N1', 'F24']);
const c = ordiniDaConservare(archivio, idFile);
// Il portale filtra per immissione: per un terminato non dice niente. Assente
// dal file resta com'e', qualunque sia la sua fine trasporto (utente, 25/09/2026).
verifica('si conservano i terminati del 2024 assenti dal file, con tutte le righe', c.ordini.has('V1') && c.ordini.has('V2'), JSON.stringify([...c.ordini]));
verifica('anche un terminato finito nel 2025-2026 ma immesso prima dell\'export', c.ordini.has('MX'));
verifica('anche un terminato senza fine trasporto: resta, e si segnala come sempre', c.ordini.has('SF'));
verifica('in tutto 6 righe: V1 (2), V2, SF, MX (2)', c.righe === 6, String(c.righe));
verifica('un assegnato non si conserva mai: assente, e\' un vero mancante', !c.ordini.has('AS'));
verifica('quello che il file contiene non si conserva: lo riscrive il file', !c.ordini.has('F24') && !c.ordini.has('N1'));

console.log('I CANCELLATI DEGLI ANNI PRIMA SI LASCIANO ANDARE');
const canc = (id, immesso) => ({ id_ordine: id, stato: 'Cancellato', ordine_immesso_il: immesso });
const archivioCanc = [canc('C24', '2024-07-01T08:00:00Z'), canc('C25', '2025-02-01T08:00:00Z'), canc('C24F', '2024-03-01T08:00:00Z'), t('V1', '2024-06-10T08:00:00Z')];
const lasciati = cancellatiDaLasciare(archivioCanc, 2025, new Set(['C24F']));
verifica('un cancellato del 2024 assente dal file non serve piu\'', lasciati.has('C24'));
verifica('uno del 2025 resta nel controllo: serve come statistica', !lasciati.has('C25'));
verifica('uno che il file contiene lo riscrive il file', !lasciati.has('C24F'));
verifica('un terminato non e\' un cancellato', !lasciati.has('V1'));
verifica('e non si conserva: non e\' storico', !ordiniDaConservare(archivioCanc, new Set(['C24F'])).ordini.has('C24'));
verifica('senza anno di inizio non si lascia andare niente', cancellatiDaLasciare(archivioCanc, null, new Set()).size === 0);

console.log("LO SVUOTAMENTO TRANNE LO STORICO");
// Un archivio finto con la stessa interfaccia della piattaforma.
const finto = (righe) => {
  const stato = { righe: [...righe], chiamate: [] };
  const corrisponde = (r, q) => Object.entries(q).every(([k, v]) => (v && v.$in ? v.$in.includes(r[k]) : r[k] === v));
  stato.ent = {
    async deleteMany(q) { stato.chiamate.push(q); const prima = stato.righe.length; stato.righe = stato.righe.filter(r => !corrisponde(r, q)); return { deleted: prima - stato.righe.length }; },
    async filter(q) { return stato.righe.filter(r => corrisponde(r, q)); },
  };
  return stato;
};
const a1 = finto(archivio);
await svuotaTranne(a1.ent, archivio, c.ordini);
verifica('restano solo le righe conservate', a1.righe.length === 6 && a1.righe.every(r => c.ordini.has(r.id_ordine)), JSON.stringify(a1.righe.map(r => r.id_ordine)));
verifica('non si usa mai il deleteMany({}) quando c\'e\' da conservare', a1.chiamate.every(q => Object.keys(q).length > 0));
const a2 = finto(archivio);
await svuotaTranne(a2.ent, archivio, new Set());
verifica('senza niente da conservare e\' lo svuotamento di sempre', a2.righe.length === 0 && JSON.stringify(a2.chiamate) === '[{}]');
// Una piattaforma che non capisce il filtro: restituisce tutto a ogni query.
const a3 = finto(archivio);
a3.ent.filter = async () => a3.righe;
let fermato = false;
try { await svuotaTranne(a3.ent, archivio, c.ordini); } catch { fermato = true; }
verifica('se il filtro non e\' affidabile ci si ferma senza cancellare niente', fermato && a3.righe.length === archivio.length && a3.chiamate.length === 0);
// Molti ordini: si cancella a blocchi.
const tanti = Array.from({ length: 450 }, (_, i) => t('N' + i, '2025-02-01T08:00:00Z')).concat([t('V9', '2024-02-01T08:00:00Z')]);
const a4 = finto(tanti);
await svuotaTranne(a4.ent, tanti, new Set(['V9']));
verifica('a blocchi da 200 ID', a4.chiamate.length === 3 && a4.righe.length === 1 && a4.righe[0].id_ordine === 'V9', String(a4.chiamate.length));

console.log('LE RIGHE DI OGNI ORDINE CONSERVATO');
// Servono al browser per il confronto ordine per ordine di fine caricamento: un
// ordine conservato non e' ne' di troppo ne' mancante, e con questo numero si
// vede anche se lo svuotamento gli avesse tolto delle righe per sbaglio.
verifica('ogni ordine conservato dice quante righe ha', c.righePerOrdine.get('V1') === 2 && c.righePerOrdine.get('V2') === 1 && c.righePerOrdine.get('MX') === 2, JSON.stringify([...c.righePerOrdine]));
verifica('chi non si conserva non compare', !c.righePerOrdine.has('AS') && !c.righePerOrdine.has('F24'));
verifica('le righe per ordine sommano al totale', [...c.righePerOrdine.values()].reduce((s, x) => s + x, 0) === c.righe);

console.log('LO STATO "ESEGUITO" SI CONSERVA E SI SEGNALA (regola dell\'utente, 28/09/2026)');
// "Un ordine in stato eseguito va segnalato e mantenuto, cosi' che al prossimo
// caricamento abbia un altro stato (terminato o cancellato)" (utente,
// 28/09/2026). Un "eseguito" ha tutti i dati inseriti ma nessuno ha premuto il
// Chiudi a portale: non e' terminato e non e' cancellato. E' uno stato DI
// PASSAGGIO e si risolve da solo, perche' al caricamento dopo il portale gli ha
// dato lo stato definitivo e il file lo riscrive com'e' diventato. Trattarlo
// come un ordine mancante faceva chiedere la forzatura e, forzando, lo
// CANCELLAVA - proprio l'ordine che l'avviso sugli eseguiti serve a far vedere.
const es = (id, extra = {}) => ({ id_ordine: id, stato: 'Eseguito', trasporto_finito_il: '2024-08-01T08:00:00Z', ordine_immesso_il: '2024-07-01T08:00:00Z', ...extra });
const archivioEseguiti = [es('E1'), t('M1', '2024-09-01T08:00:00Z'), es('M1'), es('EF')];
const ce = ordiniDaConservare(archivioEseguiti, new Set(['EF']));
verifica('un eseguito assente dal file si conserva come un terminato', ce.ordini.has('E1'), JSON.stringify([...ce.ordini]));
verifica('un ordine con una riga terminata e una eseguita si conserva per intero', ce.ordini.has('M1') && ce.righePerOrdine.get('M1') === 2);
verifica('un eseguito che il file contiene lo riscrive il file', !ce.ordini.has('EF'));
verifica('in tutto 3 righe: E1, M1 (2)', ce.righe === 3, String(ce.righe));
// MANTENUTO NON BASTA: VA SEGNALATO. Un eseguito immesso prima dell'anno scorso
// resta fuori dall'export, quindi l'avviso sugli eseguiti - che guarda il file -
// non lo vede: senza questo conto resterebbe in archivio senza comparire da
// nessuna parte, cioe' il contrario di quello che l'utente ha chiesto.
verifica('quanti sono gli eseguiti conservati si dice', ce.eseguiti.ordini === 2 && ce.eseguiti.righe === 2, JSON.stringify(ce.eseguiti));
verifica('e si contano le righe eseguite, non tutte quelle dell\'ordine misto', ce.eseguiti.righe < ce.righe, JSON.stringify(ce.eseguiti));
verifica('senza eseguiti il conto e\' zero, e la frase resta quella dei terminati', ordiniDaConservare(archivio, idFile).eseguiti.righe === 0 && ordiniDaConservare(archivio, idFile).eseguiti.ordini === 0);

console.log('QUANDO IL FILTRO NON REGGE, CHI SA GESTIRE UN ESITO LO RICEVE');
// La regola non cambia - non si tocca niente e serve un caricamento completo dal
// primo anno - cambia solo il modo di dirla: con senzaErrore la frase arriva
// intera a chi carica, invece di diventare un 500 ritentato alla cieca.
const a5 = finto(archivio);
a5.ent.filter = async () => a5.righe;
const esito5 = await svuotaTranne(a5.ent, archivio, c.ordini, async () => {}, { senzaErrore: true });
verifica('si risponde non_fatta con il motivo, senza lanciare', esito5.non_fatta === true && esito5.dati_intatti === true && esito5.motivo.includes('caricamento completo'), JSON.stringify(esito5));
verifica('e l\'archivio non e\' stato toccato', a5.righe.length === archivio.length && a5.chiamate.length === 0);
// Il budget dell'invocazione: si smette prima della scadenza e si dice dove si e'
// arrivati, invece di farsi tagliare a meta' senza che nessuno lo sappia.
const a6 = finto(tanti);
const esito6 = await svuotaTranne(a6.ent, tanti, new Set(['V9']), async () => {}, { limiteMs: 1, t0: Date.now() - 1000 });
verifica('col tempo finito si dice quanti ordini si sono tolti e che non e\' finita', esito6.finito === false && esito6.cancellati_ordini === 200, JSON.stringify(esito6));
verifica('e le righe tolte sono tolte davvero: il giro dopo riprende da li\'', a6.righe.length === 251, String(a6.righe.length));
const esito7 = await svuotaTranne(a6.ent, a6.righe, new Set(['V9']));
verifica('richiamando si arriva in fondo', esito7.finito === true && a6.righe.length === 1 && a6.righe[0].id_ordine === 'V9');

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
