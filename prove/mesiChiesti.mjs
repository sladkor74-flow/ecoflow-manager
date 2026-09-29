// Prova dei mesi chiesti a EcoTyna (base44/shared/strumentiAssistente.ts:
// mesiChiesti). "nei mesi di luglio e agosto" sono due mesi, "da marzo a maggio"
// sono tre: prima ne veniva letto uno solo e il resto diventava in silenzio tutto
// l'anno. npm run prove
import { mesiChiesti } from '../base44/shared/strumentiAssistente.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const nomi = (mese, mesi) => mesiChiesti(mese, mesi).nomi.join('|');
const ign = (mese, mesi) => mesiChiesti(mese, mesi).ignorati.join('|');

console.log('UN MESE SOLO');
verifica('il nome del mese', nomi('Agosto') === 'Agosto');
verifica('non importa come e scritto', nomi('agosto') === 'Agosto' && nomi('  AGOSTO ') === 'Agosto');
verifica('senza mese e tutto l anno', nomi('') === '' && nomi(null) === '' && mesiChiesti().indici.size === 0);

console.log('PIU MESI');
verifica('un elenco', nomi(null, ['Luglio', 'Agosto']) === 'Luglio|Agosto');
verifica('scritti in un campo solo con la e', nomi('luglio e agosto') === 'Luglio|Agosto');
verifica('con la virgola', nomi('luglio, agosto') === 'Luglio|Agosto');
verifica('con ed', nomi('agosto ed ottobre') === 'Agosto|Ottobre');
verifica('sempre in ordine di calendario', nomi(null, ['Ottobre', 'Marzo', 'Luglio']) === 'Marzo|Luglio|Ottobre');
verifica('lo stesso mese due volte conta una', mesiChiesti('Luglio', ['Luglio']).indici.size === 1);

console.log('UN INTERVALLO SI APRE TUTTO');
verifica('da marzo a maggio sono tre mesi', nomi('da marzo a maggio') === 'Marzo|Aprile|Maggio');
verifica('col trattino', nomi('marzo-maggio') === 'Marzo|Aprile|Maggio');
verifica('dal gennaio al dicembre e tutto l anno', mesiChiesti('dal gennaio al dicembre').indici.size === 12);
verifica('lo stesso mese due volte resta uno', nomi('da luglio a luglio') === 'Luglio');
verifica('un intervallo a cavallo dell anno NON si indovina', mesiChiesti('da dicembre a febbraio').indici.size === 0,
  nomi('da dicembre a febbraio'));
verifica('e si dice che non si e capito', ign('da dicembre a febbraio').includes('dicembre'));

console.log('QUELLO CHE NON E UN MESE SI DICE');
verifica('una parola qualunque non diventa un mese', mesiChiesti('pippo').indici.size === 0);
verifica('e finisce fra gli ignorati', ign('pippo') === 'pippo');
verifica('un mese buono e uno finto: si tiene il buono e si dice l altro',
  nomi('Agosto e pippo') === 'Agosto' && ign('Agosto e pippo') === 'pippo');
verifica('un numero non e un mese', mesiChiesti('8').indici.size === 0 && ign('8') === '8');

console.log('IN ITALIANO DAVANTI A VOCALE SI SCRIVE AD');
verifica('da gennaio ad agosto sono otto mesi', mesiChiesti('da gennaio ad agosto').indici.size === 8, nomi('da gennaio ad agosto'));
verifica('da luglio ad ottobre sono quattro', mesiChiesti('da luglio ad ottobre').indici.size === 4);
verifica('fino ad aprile parte da gennaio', nomi('da gennaio fino ad aprile') === 'Gennaio|Febbraio|Marzo|Aprile');

console.log('DUE MESI ATTACCATI DA UNA PAROLA CHE NON SI CAPISCE');
verifica('non si indovina se e elenco o intervallo', mesiChiesti('marzo oppure maggio').indici.size === 0, nomi('marzo oppure maggio'));
verifica('e si dice che non si e capito', ign('marzo oppure maggio').includes('marzo'));
verifica('ma un elenco vero resta un elenco', nomi('marzo, maggio') === 'Marzo|Maggio');

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
