// LE SCRITTURE DI SERVIZIO LASCIANO LA LORO RIGA NELLO STORICO (11/10/2026).
//
// La chiusura dell'anno (aperture degli impianti) e la pulizia delle
// dichiarazioni seminate scrivono e cancellano numeri che fanno i conti: dal
// giro dello storico delle modifiche passano dall'involucro (shared/traccia.ts).
// Qui si fanno girare le funzioni vere con l'archivio finto e si guarda che:
// - ogni riga tolta dalla pulizia finisca in ModificaDato con la riga INTERA
//   di prima (non il riassunto dell'elenco), chi, da dove e perche';
// - la risposta porti traccia { scritta, righe }, e che se lo storico non si
//   scrive la riga si tolga lo stesso e la risposta lo dica.
//
// node prove/storicoScrittureDiServizio.mjs
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('LA PULIZIA DELLE DICHIARAZIONI SCRIVE NELLO STORICO QUELLO CHE TOGLIE');
const ripulisci = await caricaFunzione('ripulisciDichiarazioni');
// Una riga vuota (da togliere) e una vera caricata a portale (da tenere).
const vuota = { id: 'd-vuota', anno: 2026, sito: 'GATIM SRL', canale: 'RETE', mese: 'Luglio', quantita_kg: 0, stato_portale: 'da_caricare', note: '' };
const vera = { id: 'd-vera', anno: 2026, sito: 'GATIM SRL', canale: 'RETE', mese: 'Giugno', quantita_kg: 120000, stato_portale: 'caricata' };
const r = await chiama(ripulisci, { db: { DichiarazioneSito: [vuota, vera] }, corpo: { anno: 2026, conferma: true } });
const tolte = (r.j.tolte || []).map(x => x.id);
verifica('la pulizia toglie solo la riga vuota', r.stato === 200 && tolte.length === 1 && tolte[0] === 'd-vuota', JSON.stringify(r.j));
const registro = (r.db.ModificaDato || []);
verifica('la riga tolta entra nello storico', registro.length >= 1, JSON.stringify(r.scritte));
const riga = registro.find(x => x.record_id === 'd-vuota') || {};
verifica('nello storico c\'e\' chi, da dove e perche\'', riga.operazione === 'delete' && riga.origine === 'Dichiarazioni, pulizia' && /seminata o vuota/.test(riga.motivo || '') && riga.utente === 'prova@prova', JSON.stringify(riga));
// Il «prima» e' la riga intera: l'anno c'e' nel record, non nel riassunto che
// daTogliere restituisce (sito, mese, kg, perche').
verifica("il prima e' la riga intera dell'archivio, non il riassunto",riga.anno === 2026 && /2026/.test(riga.etichetta || ''), JSON.stringify(riga));
verifica('la risposta porta la traccia', r.j.traccia && r.j.traccia.scritta === true && r.j.traccia.righe >= 1, JSON.stringify(r.j.traccia));
verifica('la riga vera resta', (r.db.DichiarazioneSito || []).some(x => x.id === 'd-vera'));

// Se il registro non si scrive, la riga si toglie lo stesso e la risposta lo dice.
const r2 = await (async () => {
  globalThis.__DB = JSON.parse(JSON.stringify({ DichiarazioneSito: [vuota, vera] }));
  globalThis.__SCRITTE = [];
  globalThis.__RUOLO = 'admin';
  // Il registro rifiuta le scritture, come prima che l'archivio sia pubblicato.
  Object.defineProperty(globalThis.__DB, 'ModificaDato', { get() { throw new Error('archivio ModificaDato non pubblicato'); }, configurable: true });
  const risp = await ripulisci.default({ json: async () => ({ anno: 2026, conferma: true }) });
  return { stato: risp.status, j: await risp.json() };
})();
verifica('senza registro la riga si toglie lo stesso', r2.stato === 200 && (r2.j.tolte || []).length === 1, JSON.stringify(r2.j));
verifica('e la risposta dice che lo storico non si e\' scritto', r2.j.traccia && r2.j.traccia.scritta === false, JSON.stringify(r2.j.traccia));

console.log('\nCHI NON E\' AMMINISTRATORE NON TOGLIE NIENTE E NON SCRIVE NELLO STORICO');
const r3 = await chiama(ripulisci, { db: { DichiarazioneSito: [vuota, vera] }, ruolo: 'user', corpo: { anno: 2026, conferma: true } });
verifica('un utente non toglie righe', r3.stato !== 200 && (r3.db.DichiarazioneSito || []).length === 2, JSON.stringify(r3.j));
verifica('e non scrive nello storico', !(r3.db.ModificaDato || []).length);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
