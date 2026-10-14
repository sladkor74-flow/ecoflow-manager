// I RECAPITI DEL FORNITORE: UN NOME SOLO DALL'ANAGRAFICA AL CONTRATTO
// (decisioni dell'utente del 13/10/2026).
//
// I contratti dell'anno cercavano in anagrafica il cellulare, la pec e il
// referente del fornitore (RECAPITI_DALL_ANAGRAFICA in
// base44/shared/segnapostiContratto.ts), ma l'anagrafica quei campi non li
// aveva e la scheda Fornitori non li faceva scrivere: arrivavano solo dal
// contratto dell'anno prima, o restavano da scrivere. Ora ci sono, con gli
// stessi nomi in quattro posti, e qui si prova che restano gli stessi:
//   - l'entita' Fornitore (base44/entities/Fornitore.jsonc) li dichiara;
//   - la scheda (src/components/fatturazione/FornitoriManager.jsx) li fa scrivere;
//   - lo storico delle modifiche li traccia (CAMPI_TRACCIATI, nei due specchi);
//   - valoriDelContratto li porta nei segnaposti FORNITORE_TEL_2,
//     FORNITORE_EMAIL_2 e FORNITORE_REFERENTE, con la fonte «anagrafica».
// Un nome cambiato in uno solo dei quattro posti fa fallire la prova.
//
// node prove/recapitiFornitore.mjs
import { readFileSync } from 'node:fs';
import { CAMPI_TRACCIATI } from '../base44/shared/campiTracciati.ts';
import { valoriDelContratto } from '../base44/shared/segnapostiContratto.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
// I file si leggono senza i ritorni a capo di Windows.
const leggi = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');

const NUOVI = ['cellulare', 'pec', 'referente'];

console.log('I NOMI CHE IL CONTRATTO CERCA IN ANAGRAFICA');
const sorgente = leggi('base44/shared/segnapostiContratto.ts');
const blocco = (sorgente.match(/const RECAPITI_DALL_ANAGRAFICA = \[([\s\S]*?)\];/) || [])[1] || '';
const coppie = [...blocco.matchAll(/\['(\w+)', '(\w+)'\]/g)].map(m => [m[1], m[2]]);
const campiCercati = coppie.map(c => c[1]);
verifica('il contratto cerca cellulare, pec e referente', NUOVI.every(c => campiCercati.includes(c)), J(coppie));

const entita = JSON.parse(leggi('base44/entities/Fornitore.jsonc').split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n'));
const proprieta = entita.properties || {};
const mancanti = campiCercati.filter(c => !proprieta[c]);
verifica('ogni campo che il contratto cerca e\' nell\'entita\' Fornitore', mancanti.length === 0, 'mancano: ' + mancanti.join(', '));
verifica('e i tre nuovi sono testo', NUOVI.every(c => proprieta[c] && proprieta[c].type === 'string'), J(NUOVI.map(c => proprieta[c])));

console.log('LA SCHEDA LI FA SCRIVERE');
const pagina = leggi('src/components/fatturazione/FornitoriManager.jsx');
const campiScheda = ((pagina.match(/const CAMPI_SCHEDA = \[([^\]]*)\]/) || [])[1] || '').match(/'(\w+)'/g) || [];
const scheda = campiScheda.map(s => s.replace(/'/g, ''));
verifica('la scheda Fornitori ha ogni campo che il contratto cerca', campiCercati.every(c => scheda.includes(c)), J({ scheda, campiCercati }));
verifica('e ognuno ha la sua casella', campiCercati.every(c => new RegExp(`campo\\('${c}', `).test(pagina)), J(campiCercati));

console.log('LO STORICO LI TRACCIA, NEI DUE SPECCHI');
verifica('CAMPI_TRACCIATI.Fornitore: cellulare, pec e referente, testo, non riservati',
  J(Object.keys(CAMPI_TRACCIATI.Fornitore || {}).sort()) === J([...NUOVI].sort()) && NUOVI.every(c => CAMPI_TRACCIATI.Fornitore[c].unita === 'testo' && !CAMPI_TRACCIATI.Fornitore[c].riservato), J(CAMPI_TRACCIATI.Fornitore));
const specchio = leggi('src/lib/campiTracciati.js');
verifica('lo specchio delle pagine li ha uguali', /Fornitore: \{\n\s+cellulare: \{ nome: 'cellulare', unita: 'testo' \},\n\s+pec: \{ nome: 'pec', unita: 'testo' \},\n\s+referente: \{ nome: 'referente', unita: 'testo' \},\n\s+\},/.test(specchio));

console.log('DALL\'ANAGRAFICA AL CONTRATTO');
{
  const fornitore = {
    id: 'fE', ragione_sociale: 'EMMESSE SRL', piva: '01234567890', telefono: '081 123456', email: 'info@emmesse.it',
    cellulare: '333 1234567', pec: 'emmesse@pec.it', referente: 'Mario Rossi',
  };
  const { valori, fonti } = valoriDelContratto({ anno: 2027, tipo: 'raccolta', canale: 'RETE', fornitore });
  verifica('il cellulare e\' FORNITORE_TEL_2, la pec FORNITORE_EMAIL_2, il referente FORNITORE_REFERENTE',
    valori.FORNITORE_TEL_2 === '333 1234567' && valori.FORNITORE_EMAIL_2 === 'emmesse@pec.it' && valori.FORNITORE_REFERENTE === 'Mario Rossi', J(valori));
  verifica('tutti con la fonte «anagrafica»', ['FORNITORE_TEL_2', 'FORNITORE_EMAIL_2', 'FORNITORE_REFERENTE', 'FORNITORE_TEL', 'FORNITORE_EMAIL'].every(k => fonti[k] === 'anagrafica'), J(fonti));
  // Un recapito che l'anagrafica non ha non si deduce: resta quello del
  // contratto dell'anno prima, o da scrivere.
  const senza = valoriDelContratto({ anno: 2027, tipo: 'raccolta', canale: 'RETE', fornitore: { ...fornitore, cellulare: '', pec: null, referente: undefined } });
  verifica('senza cellulare, pec e referente: niente dedotto dal telefono o dall\'email',
    !('FORNITORE_TEL_2' in senza.valori) && !('FORNITORE_EMAIL_2' in senza.valori) && !('FORNITORE_REFERENTE' in senza.valori) && senza.valori.FORNITORE_TEL === '081 123456', J(senza.valori));
  const precedente = { anno: 2026, valori: { FORNITORE_TEL_2: '333 0000000', FORNITORE_REFERENTE: 'Luigi Verdi' }, data_inizio: '2026-01-02' };
  const conPrima = valoriDelContratto({ anno: 2027, tipo: 'raccolta', canale: 'RETE', fornitore, precedente });
  verifica('l\'anagrafica vince sul contratto dell\'anno prima', conPrima.valori.FORNITORE_TEL_2 === '333 1234567' && conPrima.valori.FORNITORE_REFERENTE === 'Mario Rossi' && conPrima.fonti.FORNITORE_REFERENTE === 'anagrafica', J(conPrima.valori));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
