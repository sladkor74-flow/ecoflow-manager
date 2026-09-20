// Prova del promemoria della qualifica (base44/shared/emailQualifica.ts): deve
// essere un documento ordinato per urgenza, non un muro di righe. npm run prove
import { emailQualifica, esc, quando, motivo, SEZIONI } from '../base44/shared/emailQualifica.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const eventi = [
  { stato: 'scaduto', soggetto: 'ALFA & FIGLI SRL', tipo: 'DURC', scadenza: '2026-07-02', giorni: -80 },
  { stato: 'in_scadenza', soggetto: 'BETA SRL', tipo: 'Visura camerale', scadenza: '2026-09-25', giorni: 5 },
  { stato: 'in_scadenza', soggetto: 'GAMMA SRL', tipo: 'DURC', scadenza: '2026-09-20', giorni: 0 },
  { stato: 'mancante', soggetto: 'DELTA SRL', tipo: 'Iscrizione White List antimafia' },
  { stato: 'non_conforme', soggetto: 'EPSILON SRL', tipo: 'Visura camerale', problemi: [{ gravita: 'bloccante', messaggio: 'Documento sbagliato: qui va Visura camerale, ma il file e un DURC.' }], richiesta: 'Buongiorno, vi chiediamo cortesemente la visura camerale aggiornata.' },
  { stato: 'da_verificare', soggetto: 'ZETA SRL', tipo: 'Autorizzazione dell impianto', problemi: [{ gravita: 'attenzione', messaggio: 'La lettura automatica del file non ha funzionato.' }] },
];
const riepilogo = { soggetti: 22, qualificati: 9, da_completare: 8, critici: 5 };
const anomalie = [{ gravita: 'errore', tipo_nome: 'Patenti degli autisti', messaggio: 'Patenti degli autisti e richiesto a GAMMA SPA, che nel 2026 non risulta.' }];

const { oggetto, html } = emailQualifica({ anno: 2026, oggi: '2026-09-20', eventi, riepilogo, anomalie, completo: true });

console.log('OGGETTO');
verifica('conta ogni cosa per nome', oggetto.includes('1 scaduti') && oggetto.includes('2 in scadenza') && oggetto.includes('1 mai ricevuti'), oggetto);
verifica('nomina anche il documento senza destinatario', oggetto.includes('1 documento senza destinatario'), oggetto);

console.log('ORDINE DELLE SEZIONI');
const posizioni = SEZIONI.map(s => html.indexOf(s.titolo));
verifica('prima gli scaduti, poi i non conformi, poi le scadenze, i mancanti, i da verificare', posizioni.every((p, i) => p > 0 && (i === 0 || p > posizioni[i - 1])), String(posizioni));
verifica('ogni sezione dice quanti sono', html.includes('Documenti scaduti (1)') && html.includes('Documenti in scadenza (2)'));
verifica('dentro le sezioni si va per urgenza: oggi prima di fra cinque giorni', html.indexOf('GAMMA SRL') < html.indexOf('BETA SRL'));

console.log('COME SONO SCRITTE LE RIGHE');
verifica('e una tabella, non un elenco di righe', (html.match(/<tr/g) || []).length >= 8 && html.includes('<th'));
verifica('lo scaduto dice quando e da quanto', quando(eventi[0]).includes('scaduto il 02/07/2026') && quando(eventi[0]).includes('80 giorni fa'));
verifica('scade oggi si dice cosi', quando(eventi[2]) === 'scade oggi');
verifica('scade fra cinque giorni con la data', quando(eventi[1]) === 'scade fra 5 giorni, il 25/09/2026');
verifica('del non conforme si legge il motivo', motivo(eventi[4]).includes('Documento sbagliato'));

console.log('SICUREZZA E RIQUADRI');
verifica('la e commerciale del nome non rompe la pagina', html.includes('ALFA &amp; FIGLI SRL') && !html.includes('ALFA & FIGLI'));
verifica('esc protegge anche i segni di minore', esc('<script>') === '&lt;script&gt;');
verifica('i documenti senza destinatario hanno il loro riquadro', html.includes('non verranno mai chiesti a nessuno') && html.includes('GAMMA SPA'));
verifica('il quadro generale in cima', html.includes('Soggetti da qualificare') && html.includes('>22<'));
verifica('i testi pronti da inoltrare ci sono', html.includes('Testi pronti da inoltrare') && html.includes('visura camerale aggiornata'));

console.log('QUANDO NON CE NIENTE');
const vuoto = emailQualifica({ anno: 2026, oggi: '2026-09-20', eventi: [], riepilogo, anomalie: [], completo: false });
verifica('lo dice invece di mandare tabelle vuote', vuoto.html.includes('niente da richiedere') && !vuoto.html.includes('Documenti scaduti'));
verifica('e si vede che sono solo le novita', vuoto.html.includes('solo le novita'));

console.log('TROPPI TESTI DA INOLTRARE');
const tanti = Array.from({ length: 9 }, (_, i) => ({ stato: 'non_conforme', soggetto: 'S' + i, tipo: 'DURC', richiesta: 'testo ' + i }));
const molti = emailQualifica({ anno: 2026, oggi: '2026-09-20', eventi: tanti, riepilogo, anomalie: [], completo: true });
verifica('se ne mostrano cinque e si dice dove sono gli altri', molti.html.includes('testo 4') && !molti.html.includes('testo 5') && molti.html.includes('Gli altri 4 testi'));

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
