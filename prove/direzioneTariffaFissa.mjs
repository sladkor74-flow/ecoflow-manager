// LA DIREZIONE DI UNA TARIFFA NON SI CAMBIA (chiusura del giro del 14/10/2026).
//
// Rilievo del gruppo delle tariffe riservate (H-1): la scheda delle tariffe
// tiene la direzione in sola lettura, ma gestisciAnagrafiche accettava un
// update di una tariffa PASSIVA in ATTIVA (prestazione vuota e cliente). Lo
// storico delle modifiche calcola «riservato» sul record di dopo, che e'
// attivo: la riga «valore 72 -> 210» nasceva non riservata, e chi non e'
// amministratore leggeva il prezzo del fornitore. Ora la funzione rifiuta il
// cambio di direzione, senza scrivere niente; una tariffa senza direzione e'
// passiva, e scriverci PASSIVA non e' un cambio.
//
// node prove/direzioneTariffaFissa.mjs
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);

const modulo = await caricaFunzione('gestisciAnagrafiche');
const FORNITORI = [{ id: 'F-EMM', ragione_sociale: 'EMMESSE SRLS', stato: 'attivo', ruolo_raccolta: true }];
const passiva = (extra = {}) => ({ id: 'T1', fornitore_id: 'F-EMM', fornitore_nome: 'EMMESSE SRLS', direzione: 'PASSIVA', tipologia: 'EXTRA_RACCOLTA', prestazione: 'RACCOLTA', unita_misura: '€/t', valore: 72, data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', stato: 'attivo', ...extra });
const attiva = { id: 'T2', direzione: 'ATTIVA', cliente: 'ECOTYRE', tipologia: 'EXTRA_RACCOLTA', unita_misura: '€/t', valore: 202, data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', stato: 'attivo' };
const db = (tariffe) => ({ Tariffa: tariffe, Fornitore: FORNITORI, ModificaDato: [], SurplusTariffa: [] });
const update = (id, dati) => ({ entita: 'Tariffa', motivo: 'prova', operazione: 'update', id, dati });

console.log('1. Da passiva ad attiva: rifiutata, niente scritto');
{
  const r = await chiama(modulo, { ruolo: 'admin', db: db([passiva()]), corpo: update('T1', { direzione: 'ATTIVA', prestazione: '', cliente: 'ECOTYRE', valore: 210 }) });
  verifica('risponde 400', r.stato === 400, `stato ${r.stato}`);
  verifica('e dice perche\'', /direzione/i.test(String(r.j && r.j.error)), J(r.j));
  verifica('la tariffa resta passiva a 72', r.db.Tariffa[0].direzione === 'PASSIVA' && r.db.Tariffa[0].valore === 72, J(r.db.Tariffa[0]));
  verifica('nessuna riga nello storico (il 72 non diventa leggibile)', r.db.ModificaDato.length === 0, J(r.db.ModificaDato));
  verifica('nessuna scrittura', r.scritte.length === 0, J(r.scritte));
}

console.log('2. Da attiva a passiva: rifiutata');
{
  const r = await chiama(modulo, { ruolo: 'admin', db: db([attiva]), corpo: update('T2', { direzione: 'PASSIVA', fornitore_id: 'F-EMM', prestazione: 'RACCOLTA' }) });
  verifica('risponde 400', r.stato === 400, `stato ${r.stato}`);
  verifica('la tariffa resta attiva', r.db.Tariffa[0].direzione === 'ATTIVA', J(r.db.Tariffa[0]));
}

console.log('3. Una tariffa senza direzione e\' passiva: scriverci PASSIVA non e\' un cambio');
{
  const r = await chiama(modulo, { ruolo: 'admin', db: db([passiva({ direzione: undefined })]), corpo: update('T1', { direzione: 'PASSIVA', valore: 75 }) });
  verifica('risponde 200', r.stato === 200, `stato ${r.stato} ${J(r.j)}`);
  verifica('il valore e\' 75', r.db.Tariffa[0].valore === 75, J(r.db.Tariffa[0]));
  const riga = r.db.ModificaDato.find(m => m.campo === 'valore');
  verifica('la riga del valore e\' riservata', riga && riga.riservato === true, J(r.db.ModificaDato));
  const r2 = await chiama(modulo, { ruolo: 'admin', db: db([passiva({ direzione: undefined })]), corpo: update('T1', { direzione: 'ATTIVA', prestazione: '', cliente: 'ECOTYRE' }) });
  verifica('e scriverci ATTIVA e\' un cambio: 400', r2.stato === 400, `stato ${r2.stato}`);
}

console.log('4. Le modifiche di sempre passano come prima');
{
  // La scheda non manda la direzione in un update (TariffeForm.jsx).
  const r = await chiama(modulo, { ruolo: 'admin', db: db([passiva()]), corpo: update('T1', { valore: 75, unita_misura: '€/t', note: '' }) });
  verifica('passiva senza direzione nel corpo: 200', r.stato === 200, `stato ${r.stato} ${J(r.j)}`);
  verifica('il valore e\' 75 e la riga e\' riservata', r.db.Tariffa[0].valore === 75 && r.db.ModificaDato.some(m => m.campo === 'valore' && m.riservato === true), J(r.db.ModificaDato));
  const r2 = await chiama(modulo, { ruolo: 'admin', db: db([passiva()]), corpo: update('T1', { direzione: 'passiva ', valore: 75 }) });
  verifica('la stessa direzione scritta in minuscolo: 200', r2.stato === 200, `stato ${r2.stato} ${J(r2.j)}`);
  const r3 = await chiama(modulo, { ruolo: 'admin', db: db([attiva]), corpo: update('T2', { direzione: 'ATTIVA', valore: 210 }) });
  verifica('attiva con la sua direzione: 200, e la riga non e\' riservata', r3.stato === 200 && r3.db.ModificaDato.some(m => m.campo === 'valore' && m.riservato === false), `stato ${r3.stato} ${J(r3.db.ModificaDato)}`);
  const r4 = await chiama(modulo, { ruolo: 'user', db: db([passiva()]), corpo: update('T1', { direzione: 'ATTIVA', prestazione: '', cliente: 'ECOTYRE' }) });
  verifica('chi non e\' amministratore resta in sola lettura', r4.stato === 403 && r4.scritte.length === 0, `stato ${r4.stato}`);
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
