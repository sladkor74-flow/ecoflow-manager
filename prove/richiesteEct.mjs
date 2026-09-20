// Prova dell'abbinamento delle richieste ECT (base44/shared/richiesteEct.ts):
// una richiesta si riconosce da produttore, classe e data di immissione, non dal
// numero di riga del foglio. Si lancia con: npm run prove
import { abbinaRichieste, chiaveRichiesta } from '../base44/shared/richiesteEct.ts';

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

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
