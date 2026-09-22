// Prova delle regole di lettura dei movimenti (base44/shared/movimenti.ts):
// stato, periodo sul giorno italiano, settimana ISO, canale, giorno degli
// elenchi. npm run prove
import { eTerminato, periodoMovimento, settimanaIso, canaleMovimento, filtraMovimenti, giornoOrdine, giornoElenco, annoElenco, meseElenco, dateMancanti, dateIncoerenti, dateDaSistemare, testoDate } from '../base44/shared/movimenti.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('STATO E PERIODO');
verifica('terminato, anche scritto male', eTerminato({ stato: ' Terminato ' }) && !eTerminato({ stato: 'cancellato' }) && !eTerminato({}));
const p = periodoMovimento({ trasporto_finito_il: '2026-09-30T22:00:00.000Z', ordine_chiuso_il: '2026-09-15T00:00:00Z' });
verifica('mezzanotte italiana del 1 ottobre (22:00Z del 30/9) e\' ottobre', p.giorno === '2026-10-01' && p.mese === 'Ottobre' && p.mese_idx === 9 && p.anno === 2026);
verifica('la chiusura a portale non fa periodo', periodoMovimento({ ordine_chiuso_il: '2026-09-15T00:00:00Z' }) === null);
verifica('capodanno italiano: 23:30Z del 31/12 e\' l\'anno dopo', periodoMovimento({ trasporto_finito_il: '2026-12-31T23:30:00Z' }).anno === 2027);

console.log('SETTIMANA ISO');
verifica('1 gennaio 2026 (giovedi\') = settimana 1', settimanaIso('2026-01-01') === 1);
verifica('29 dicembre 2025 (lunedi\') = settimana 1 del 2026', settimanaIso('2025-12-29') === 1);
verifica('8 giugno 2026 = settimana 24, 14 giugno ancora 24, 15 giugno 25', settimanaIso('2026-06-08') === 24 && settimanaIso('2026-06-14') === 24 && settimanaIso('2026-06-15') === 25);
verifica('7 settembre 2026 = settimana 37', settimanaIso('2026-09-07') === 37);
verifica('1 gennaio 2027 (venerdi\') = settimana 53 del 2026', settimanaIso('2027-01-01') === 53);

console.log('CANALE E FILTRO');
verifica('canale: archivio ACI, classe 9, extra', canaleMovimento({}, 'PrimariaAci') === 'ACI' && canaleMovimento({ classe: '9 - PFU Autodemolizione' }) === 'ACI' && canaleMovimento({ classe: 'A' }) === 'RETE' && canaleMovimento({}, 'ExtraRaccolta') === 'EXTRA_RACCOLTA');
const dati = [
  { id: 1, stato: 'terminato', classe: 'A', trasporto_finito_il: '2026-06-10T00:00:00Z' },
  { id: 2, stato: 'cancellato', classe: 'A', trasporto_finito_il: '2026-06-11T00:00:00Z' },
  { id: 3, stato: 'terminato', classe: '9 - PFU Autodemolizione', trasporto_finito_il: '2026-06-12T00:00:00Z' },
  { id: 4, stato: 'terminato', classe: 'A', trasporto_finito_il: '2025-06-12T00:00:00Z' },
  { id: 5, stato: 'terminato', classe: 'A', trasporto_finito_il: null, ordine_chiuso_il: '2026-06-12T00:00:00Z' },
  { id: 6, stato: 'terminato', classe: 'A', trasporto_finito_il: '2026-07-01T00:00:00Z' },
];
const ids = (l) => l.map(r => r.id).join(',');
verifica('giugno 2026: solo terminati con fine trasporto nel mese', ids(filtraMovimenti(dati, { anno: 2026, mese: 'Giugno' })) === '1,3');
verifica('giugno 2026 rete: l\'ACI resta fuori', ids(filtraMovimenti(dati, { anno: 2026, mese: 5, canale: 'RETE' })) === '1');
verifica('anno 2026: senza il 2025 e senza chi non ha la fine trasporto', ids(filtraMovimenti(dati, { anno: 2026 })) === '1,3,6');
verifica('piu\' mesi e piu\' anni', ids(filtraMovimenti(dati, { anno: [2025, 2026], mese: ['giugno', 'Luglio'], canale: 'RETE' })) === '1,4,6');
verifica('anche non terminati, se chiesto', ids(filtraMovimenti(dati, { anno: 2026, mese: 'Giugno', ancheNonTerminati: true })) === '1,2,3');

console.log('GIORNO DEGLI ELENCHI');
const immessoMaggio = '2026-05-20T08:00:00Z';
verifica('terminato: la fine trasporto, non la chiusura ne\' l\'immissione', giornoElenco({ stato: 'terminato', ordine_immesso_il: immessoMaggio, trasporto_finito_il: '2026-06-30T22:30:00Z', ordine_chiuso_il: '2026-07-04T10:00:00Z' }) === '2026-07-01');
const senzaFine = { stato: 'terminato', ordine_immesso_il: immessoMaggio, ordine_chiuso_il: '2026-07-04T10:00:00Z' };
verifica('terminato senza fine trasporto: niente giorno, mese e anno', giornoElenco(senzaFine) === '' && meseElenco(senzaFine) === null && annoElenco(senzaFine) === null);
verifica('giornoOrdine invece ripiega sull\'immissione (resta per i conteggi per anno di immissione)', giornoOrdine(senzaFine) === '2026-05-20');
const cancellato = { stato: 'cancellato', ordine_immesso_il: '2025-12-31T23:30:00Z' };
verifica('non terminato: l\'immissione, sul giorno italiano', giornoElenco(cancellato) === '2026-01-01' && annoElenco(cancellato) === 2026 && meseElenco(cancellato) === 'Gennaio');
verifica('non terminato con la fine trasporto: la fine trasporto', meseElenco({ stato: 'assegnato', ordine_immesso_il: immessoMaggio, trasporto_finito_il: '2026-06-10T08:00:00Z' }) === 'Giugno');
verifica('senza date: niente', giornoElenco({ stato: 'assegnato' }) === '' && annoElenco({}) === null);

console.log('LE DATE OBBLIGATORIE DI UN TERMINATO (regola del 22/09/2026)');
const completo = { stato: 'terminato', ordine_immesso_il: '2026-09-01T08:00:00Z', trasporto_iniziato_il: '2026-09-03T07:00:00Z', trasporto_finito_il: '2026-09-03T22:30:00Z' };
verifica('tutte e tre: niente da segnalare', dateMancanti(completo).length === 0 && !dateDaSistemare(completo));
verifica('senza fine trasporto: la dice', JSON.stringify(dateMancanti({ ...completo, trasporto_finito_il: null })) === '["fine trasporto"]' && testoDate({ ...completo, trasporto_finito_il: null }) === 'manca la data di fine trasporto');
verifica('senza nessuna: le dice tutte', dateMancanti({ stato: 'Terminato' }).length === 3);
verifica('un ordine non terminato non si giudica', dateMancanti({ stato: 'assegnato' }).length === 0 && !dateDaSistemare({ stato: 'cancellato' }));
verifica("fine prima dell'inizio: incoerente", dateIncoerenti({ ...completo, trasporto_finito_il: '2026-09-02T10:00:00Z' }).length === 1);
// A portale l'immissione e' la registrazione dell'ordine, che spesso arriva dopo
// la partenza: sui dati veri capita a 941 ordini (22/09/2026), fino a 129 giorni.
// Non e' un'incoerenza: le date devono esserci, l'ordine fra le prime due no.
verifica('partito prima di essere immesso: non e\' un\'incoerenza', dateIncoerenti({ ...completo, trasporto_iniziato_il: '2026-08-20T07:00:00Z', trasporto_finito_il: '2026-08-20T16:00:00Z' }).length === 0);
verifica('ma le tre date devono esserci lo stesso', dateMancanti({ ...completo, ordine_immesso_il: null }).length === 1);
verifica('stesso giorno italiano: coerente', dateIncoerenti({ ...completo, trasporto_iniziato_il: '2026-09-03T21:00:00Z', trasporto_finito_il: '2026-09-03T21:30:00Z' }).length === 0);
verifica('la chiusura non sostituisce la fine', dateMancanti({ ...completo, trasporto_finito_il: null, ordine_chiuso_il: '2026-09-05T08:00:00Z' }).includes('fine trasporto'));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
