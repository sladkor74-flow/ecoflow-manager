// Prova dell'abbinamento delle richieste ECT (base44/shared/richiesteEct.ts):
// una richiesta si riconosce da produttore, classe e data di immissione, non dal
// numero di riga del foglio. Si lancia con: npm run prove
import { abbinaRichieste, chiaveRichiesta, idOrdineDaSalvare, riconosciOrdine, ritiriTerminati, evasioneOrdini, listaOrdini, testoTerminatiSenzaFine } from '../base44/shared/richiesteEct.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// L'elenco com'e' oggi: ogni richiesta porta la riga da cui fu letta e cio' che ha messo l'utente
const esistenti = [
  { id: 'A', riga_excel: 3, pdr_nome: 'Rossi Gomme', classe: 'P', ordine_immesso_il: '2026-08-01', mail_inviata_il: '2026-08-20', nota: 'entro settembre', evasione_confermata: true },
  { id: 'B', riga_excel: 4, pdr_nome: 'Bianchi Pneumatici S.r.l.', classe: '', ordine_immesso_il: '2026-08-05', mail_inviata_il: '2026-08-20', nota: '', id_ordine_manuale: 'ET26111111' },
  // due ordini dello stesso produttore lo stesso giorno, senza classe: nel foglio vero succede
  { id: 'C1', riga_excel: 5, pdr_nome: 'Perrone Elio', classe: '', ordine_immesso_il: '2026-05-25', mail_inviata_il: '2026-08-28', nota: 'P', trasportatore: 'NAPPI SUD' },
  { id: 'C2', riga_excel: 6, pdr_nome: 'Perrone Elio', classe: '', ordine_immesso_il: '2026-05-25', mail_inviata_il: '2026-08-28', nota: 'M', trasportatore: 'NAPPI SUD' },
  { id: 'D', riga_excel: 7, pdr_nome: 'Verdi Auto', classe: 'M', ordine_immesso_il: '2026-09-01', mail_inviata_il: null, nota: '' },
];
const riga = (e, n, altro = {}) => ({ riga_excel: n, pdr_nome: e.pdr_nome, classe: e.classe, ordine_immesso_il: e.ordine_immesso_il, mail_inviata_il: e.mail_inviata_il, nota: e.nota, trasportatore: e.trasportatore, ...altro });
const ids = (a) => a.map(e => (e ? e.id : null)).join(',');

console.log('FOGLIO INVARIATO');
verifica('ognuna ritrova se stessa', ids(abbinaRichieste(esistenti.map(e => riga(e, e.riga_excel)), esistenti)) === 'A,B,C1,C2,D');

console.log('UNA RIGA INSERITA IN CIMA (tutte scendono di uno)');
const nuova = { riga_excel: 3, pdr_nome: 'Nuovo Gommista', classe: 'G1', ordine_immesso_il: '2026-09-10', mail_inviata_il: '2026-09-15', nota: '' };
const scese = [nuova, ...esistenti.map(e => riga(e, e.riga_excel + 1))];
const a1 = abbinaRichieste(scese, esistenti);
verifica('la nuova non ruba la spunta di Rossi (che stava alla riga 3)', a1[0] === null);
verifica('le altre restano se stesse', ids(a1.slice(1)) === 'A,B,C1,C2,D', ids(a1));

console.log('FOGLIO ORDINATO AL CONTRARIO');
const rovescio = [...esistenti].reverse().map((e, i) => riga(e, 3 + i));
verifica('ognuna ritrova se stessa, gemelle comprese (le distingue la nota)', ids(abbinaRichieste(rovescio, esistenti)) === 'D,C2,C1,B,A', ids(abbinaRichieste(rovescio, esistenti)));

console.log('CORREZIONI NEL FOGLIO');
const conMail = esistenti.map(e => riga(e, e.riga_excel, e.id === 'D' ? { mail_inviata_il: '2026-09-12' } : {}));
verifica('aggiunta la data della mail: resta la stessa richiesta', ids(abbinaRichieste(conMail, esistenti)) === 'A,B,C1,C2,D');
const conData = esistenti.map(e => riga(e, e.riga_excel, e.id === 'B' ? { ordine_immesso_il: '2026-08-06' } : {}));
verifica('corretta la data di immissione sulla stessa riga: resta la stessa richiesta', ids(abbinaRichieste(conData, esistenti)) === 'A,B,C1,C2,D');
const nomeScritto = esistenti.map(e => riga(e, e.riga_excel, e.id === 'B' ? { pdr_nome: 'BIANCHI  PNEUMATICI SRL' } : {}));
verifica('maiuscole, spazi e punteggiatura del nome non contano', ids(abbinaRichieste(nomeScritto, esistenti)) === 'A,B,C1,C2,D');

console.log('RIGA TOLTA DAL FOGLIO');
const senzaB = esistenti.filter(e => e.id !== 'B').map((e, i) => riga(e, 3 + i));
const a2 = abbinaRichieste(senzaB, esistenti);
verifica('nessuna prende il posto di quella tolta', ids(a2) === 'A,C1,C2,D' && !a2.some(e => e && e.id === 'B'), ids(a2));
verifica('ogni richiesta esistente si abbina al massimo una volta', new Set(a1.filter(Boolean).map(e => e.id)).size === a1.filter(Boolean).length);
verifica('chiave: il giorno conta, l\'ora no', chiaveRichiesta({ pdr_nome: 'x', ordine_immesso_il: '2026-08-01T00:00:00.000Z' }) === chiaveRichiesta({ pdr_nome: 'X', ordine_immesso_il: '2026-08-01' }));

// La stessa regola per il foglio ECT (importaRichiesteEct) e per il ricalcolo
// dopo le primarie (importaBlocco): un ID riconosciuto non si perde.
console.log('ID GIA\' RICONOSCIUTO');
const richiesta = { pdr_nome: 'Rossi Gomme', classe: '', ordine_immesso_il: '2026-09-01' };
const gia = { ...richiesta, id_ordine: 'ET26000001', id_ordine_stato: 'trovato', id_ordine_candidati: '' };
const unOrdine = [{ id_ordine: 'ET26000001', punto_di_raccolta: 'ROSSI GOMME', ordine_immesso_il: '2026-09-01T07:00:00Z', stato: 'terminato' }];
const dueOrdini = [...unOrdine, { id_ordine: 'ET26000002', punto_di_raccolta: 'ROSSI GOMME', ordine_immesso_il: '2026-09-01T09:00:00Z', stato: 'assegnato' }];
const ambiguo = riconosciOrdine(richiesta, dueOrdini);
verifica('un secondo ordine dello stesso giorno rende ambiguo il riconoscimento', ambiguo.id_ordine_stato === 'ambiguo' && ambiguo.id_ordine === '', JSON.stringify(ambiguo));
const tenuto = idOrdineDaSalvare(gia, ambiguo);
verifica('ma l\'ID gia\' riconosciuto resta, col suo stato', tenuto.id_ordine === 'ET26000001' && tenuto.id_ordine_stato === 'trovato', JSON.stringify(tenuto));
verifica('e resta anche se l\'ordine non si trova piu\'', idOrdineDaSalvare(gia, riconosciOrdine(richiesta, [])).id_ordine === 'ET26000001');
verifica('un altro ID lo sostituisce', idOrdineDaSalvare(gia, { id_ordine: 'ET26000009', id_ordine_stato: 'trovato', id_ordine_candidati: '' }).id_ordine === 'ET26000009');
const nuovo = idOrdineDaSalvare(null, ambiguo);
verifica('senza ID salvato vale il riconoscimento, ambiguo compreso', nuovo.id_ordine === '' && nuovo.id_ordine_stato === 'ambiguo' && nuovo.id_ordine_candidati === 'ET26000001, ET26000002' && idOrdineDaSalvare({ ...richiesta, id_ordine: '' }, ambiguo).id_ordine_stato === 'ambiguo', JSON.stringify(nuovo));
verifica('richiesta nuova: il riconoscimento', idOrdineDaSalvare(null, riconosciOrdine(richiesta, unOrdine)).id_ordine === 'ET26000001');

console.log('RITIRI SULLA FINE TRASPORTO');
const { terminati, senzaFine } = ritiriTerminati([
  { id_ordine: 'A', stato: 'terminato', trasporto_finito_il: '2026-09-30T22:30:00Z', ordine_chiuso_il: '2026-10-04T08:00:00Z' },
  { id_ordine: 'B', stato: 'Terminato', trasporto_finito_il: null, ordine_chiuso_il: '2026-09-20T08:00:00Z' },
  { id_ordine: 'C', stato: 'assegnato', trasporto_finito_il: null },
  { id_ordine: 'D', stato: 'terminato', trasporto_finito_il: null },
  { id_ordine: 'D', stato: 'terminato', trasporto_finito_il: '2026-09-12T08:00:00Z' },
]);
verifica('il giorno e\' quello italiano della fine trasporto, mai la chiusura', terminati.get('A') === '2026-10-01', terminati.get('A'));
verifica('un terminato senza fine trasporto non e\' ritirato, e non ripiega sulla chiusura', !terminati.has('B') && senzaFine.has('B'));
verifica('chi non e\' terminato non e\' in nessuno dei due', !terminati.has('C') && !senzaFine.has('C'));
verifica('basta una riga con la data perche\' l\'ordine sia ritirato', terminati.get('D') === '2026-09-12' && !senzaFine.has('D'));
const ev = evasioneOrdini(listaOrdini({ id_ordine_manuale: 'A, B' }), terminati);
verifica('una richiesta con un ordine senza data non e\' evasa', ev.totali === 2 && ev.evasi === 1 && ev.ultima === null, JSON.stringify(ev));
verifica('il testo dice quante e quali restano aperte', testoTerminatiSenzaFine([{ pdr: 'Rossi Gomme', id_ordine: 'B' }]).startsWith('Una richiesta') && testoTerminatiSenzaFine([{ pdr: 'X', id_ordine: 'B' }, { pdr: 'Y', id_ordine: 'E' }]).includes('2 richieste') && testoTerminatiSenzaFine([]) === '');

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
