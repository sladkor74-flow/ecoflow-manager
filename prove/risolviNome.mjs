// Prova del riconoscimento dei nomi nelle domande a EcoTyna
// (base44/shared/normalizzaRagioneSociale.ts: risolviNome). L'utente scrive il
// nome come gli viene, l'archivio ce l'ha per esteso. npm run prove
import { risolviNome, normalizzaRagioneSociale } from '../base44/shared/normalizzaRagioneSociale.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Nomi come stanno davvero negli archivi del gestionale.
const ARCHIVIO = [
  'EMMESSE SRL', 'Emmesse S.r.l.', 'GA.TIM. S.R.L.', 'IRIGOM S.R.L.', 'NAPPI SUD SRL',
  'SILVANO RENATO', 'ECO.GEA SRL', 'C.L. SERVICE S.R.L.', 'Ecorecuperi Srl',
  'AUTOTRASPORTI IELAPI DI CUNOCCHIELLA RITA', 'TECNOGUM SRL', 'T-CYCLE INDUSTRIES SRL',
  'ECOLOGICAL SYSTEMS SRL', 'SILVANO TRASPORTI SRL',
];

console.log('IL NOME SCRITTO PER ESTESO');
const e = risolviNome(ARCHIVIO, 'IRIGOM S.R.L.');
verifica('si riconosce', e.trovato && e.nomi[0] === 'IRIGOM S.R.L.');
verifica('e si sa perche', e.come === 'esatto');
verifica('la sigla societaria non conta', risolviNome(ARCHIVIO, 'irigom srl').trovato);

console.log('IL NOME ABBREVIATO, COME LO SCRIVE CHI FA LA DOMANDA');
const g = risolviNome(ARCHIVIO, 'Gatim');
verifica('Gatim trova GA.TIM. S.R.L.', g.trovato && g.nomi[0] === 'GA.TIM. S.R.L.', JSON.stringify(g));
const ec = risolviNome(ARCHIVIO, 'eco gea');
verifica('eco gea trova ECO.GEA SRL', ec.trovato && ec.nomi[0] === 'ECO.GEA SRL', JSON.stringify(ec));
const cl = risolviNome(ARCHIVIO, 'CL Service');
verifica('CL Service trova C.L. SERVICE', cl.trovato && cl.nomi[0] === 'C.L. SERVICE S.R.L.', JSON.stringify(cl));
const ie = risolviNome(ARCHIVIO, 'Ielapi');
verifica('Ielapi trova il nome lunghissimo', ie.trovato && ie.nomi[0].includes('IELAPI'), JSON.stringify(ie));
verifica('e si sa che e stata una somiglianza', ie.come === 'abbreviazione' || ie.come === 'contenuto');

console.log('LO STESSO FORNITORE SCRITTO IN DUE MODI NON SONO DUE FORNITORI');
const em = risolviNome(ARCHIVIO, 'Emmesse');
verifica('EMMESSE SRL e Emmesse S.r.l. sono uno solo', em.trovato, JSON.stringify(em));
verifica('e si tiene il nome come e scritto in archivio', em.nomi.length === 1);

console.log('DUE FORNITORI DIVERSI NON SI SOMMANO MAI');
const s = risolviNome(ARCHIVIO, 'Silvano');
verifica('Silvano e ambiguo: ce ne sono due', !s.trovato && s.come === 'ambiguo', JSON.stringify(s));
verifica('e si dicono quali sono', s.alternative.length === 2
  && s.alternative.some(n => n === 'SILVANO RENATO') && s.alternative.some(n => n === 'SILVANO TRASPORTI SRL'));
verifica('nessuna chiave sola da usare per filtrare', s.chiavi.length === 2);

console.log('IL NOME CHE NON ESISTE');
const n = risolviNome(ARCHIVIO, 'Pinco Pallo Trasporti');
verifica('non si trova', !n.trovato && n.come === 'nessuno');
verifica('e non si inventa un sostituto', n.nomi.length === 0 && n.chiavi.length === 0);
const vicino = risolviNome(ARCHIVIO, 'ecolo');
verifica('un nome quasi giusto si aggancia', vicino.trovato && vicino.nomi[0] === 'ECOLOGICAL SYSTEMS SRL', JSON.stringify(vicino));

console.log('I CASI LIMITE');
verifica('senza nome non si cerca', risolviNome(ARCHIVIO, '').come === 'niente_da_cercare');
verifica('senza archivio non si trova niente', !risolviNome([], 'Emmesse').trovato);
verifica('due lettere non bastano per somigliare', risolviNome(ARCHIVIO, 'ga').come === 'troppo corto');
verifica('un archivio con nomi vuoti non rompe', !risolviNome([null, '', '   '], 'Emmesse').trovato);
verifica('la tabella alias continua a valere', normalizzaRagioneSociale('T-CYCLE INDUSTRIES SRL') === 't-cycle'
  && risolviNome(ARCHIVIO, 'tcycle').trovato);

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
