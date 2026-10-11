// RICARICARE UN CONSUNTIVO LO SOSTITUISCE, NON NE CREA UN SECONDO (chiusura
// dell'audit, 11/10/2026).
//
// Il caso: l'amministratore ricarica il file corretto di un fornitore per lo
// stesso mese e canale. La pagina mandava 'carica' senza id, elaboraConsuntivo
// cercava il record solo per id e ne creava un altro: in elenco due righe dello
// stesso fornitore e mese, la vecchia rossa e la nuova verde. Con il nome
// scritto in un altro modo («Gatim» e «GATIM S.R.L.») sembravano due fornitori.
// Ora il record si cerca per nome normalizzato, ruolo, anno, mese e canale; senza
// conferma si risponde 409 con quello che c'e', con la conferma lo si aggiorna, e
// il caricamento di prima resta raccontato nelle note (che la storia del
// quarantesimo giorno riporta).
//
// Si prova la funzione vera con l'archivio finto di prove/dati/bancoFunzioni.mjs.
// node prove/consuntivoRicaricato.mjs
import { readFileSync } from 'node:fs';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';
import * as consuntivo from '../base44/shared/consuntivoFornitore.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const modulo = await caricaFunzione('elaboraConsuntivo');
const VECCHIO = {
  id: 'c1', fornitore: 'GATIM S.R.L.', ruolo: 'impianto', anno: 2026, mese: 9, canale: 'RETE',
  file_nome: 'vecchio.xlsx', caricato_il: '2026-10-01T09:00:00.000Z', confrontato_il: '2026-10-01T09:00:00.000Z',
  quadra: false, importo_consuntivo: 1234.5, righe_json: '[]', esito_json: '{}', note: '',
};
const tabelle = [{ nome: 'Foglio1', celle: [['Formulario', 'Peso kg'], ['RGYTR000021AA', 5400]] }];
const carica = (extra = {}) => ({ azione: 'carica', fornitore: 'Gatim', ruolo: 'impianto', anno: 2026, mese: 9, canale: 'RETE', file_nome: 'corretto.xlsx', tabelle, ...extra });
const nuoviConsuntivi = (s) => s.scritte.filter(w => w.op === 'create' && w.entita === 'ConsuntivoFornitore');
const aggiornamenti = (s, id) => s.scritte.filter(w => w.op === 'update' && w.entita === 'ConsuntivoFornitore' && w.id === id);

console.log('1. SENZA CONFERMA NON SI SOSTITUISCE NIENTE');
{
  const r = await chiama(modulo, { db: { ConsuntivoFornitore: [VECCHIO] }, corpo: carica() });
  verifica('«Gatim» con «GATIM S.R.L.» gia\' caricato per settembre: 409 da confermare', r.stato === 409 && r.j.da_confermare === true && r.j.esistente && r.j.esistente.id === 'c1', JSON.stringify(r.j).slice(0, 300));
  verifica('il messaggio dice quale, quando e da che file, all\'italiana', /GATIM S\.R\.L\./.test(r.j.error || '') && /settembre 2026/i.test(r.j.error || '') && /01\/10\/2026/.test(r.j.error || '') && /vecchio\.xlsx/.test(r.j.error || ''), r.j.error);
  verifica('e non si scrive niente', r.scritte.length === 0, JSON.stringify(r.scritte));
}

console.log('2. CON LA CONFERMA SI AGGIORNA LO STESSO RECORD');
{
  const r = await chiama(modulo, { db: { ConsuntivoFornitore: [VECCHIO] }, corpo: carica({ sostituisci: true }) });
  verifica('nessun consuntivo nuovo (prima ne nasceva un secondo)', r.stato === 200 && nuoviConsuntivi(r).length === 0, JSON.stringify(nuoviConsuntivi(r)).slice(0, 200));
  const up = aggiornamenti(r, 'c1').map(w => w.dati).reduce((a, b) => ({ ...a, ...b }), {});
  verifica('si aggiorna c1 col file nuovo e il caricamento di oggi', up.file_nome === 'corretto.xlsx' && up.caricato_il && up.caricato_il !== VECCHIO.caricato_il, JSON.stringify(up).slice(0, 300));
  verifica('le note raccontano il caricamento di prima', /Sostituisce il caricamento del 01\/10\/2026 \(file «vecchio\.xlsx»\), che NON corrispondeva ai nostri movimenti, importo scritto 1\.234,50 euro/.test(up.note || ''), up.note);
  verifica("l'importo del file di prima non resta appeso al nuovo", up.importo_consuntivo === null, String(up.importo_consuntivo));
  verifica('in archivio resta un consuntivo solo per Gatim a settembre', r.db.ConsuntivoFornitore.length === 1, String(r.db.ConsuntivoFornitore.length));
}

console.log("3. UN CONSUNTIVO GIA' ALLEGGERITO: LA SUA STORIA PASSA NELLE NOTE");
{
  const alleggerito = { ...VECCHIO, righe_json: '', esito_json: '', alleggerito_il: '2026-11-10', storia: 'Consuntivo di GATIM S.R.L. come impianto.\nIl consuntivo NON corrispondeva ai nostri movimenti.', note: 'telefonato il 02/10' };
  const r = await chiama(modulo, { db: { ConsuntivoFornitore: [alleggerito] }, corpo: carica({ sostituisci: true }) });
  const up = aggiornamenti(r, 'c1').map(w => w.dati).reduce((a, b) => ({ ...a, ...b }), {});
  verifica('la storia del caricamento sostituito e le note di prima restano', /restava la storia: «Consuntivo di GATIM S\.R\.L\. come impianto\. Il consuntivo NON corrispondeva/.test(up.note || '') && /telefonato il 02\/10$/.test(up.note || ''), up.note);
  verifica('e il record torna intero, non piu\' alleggerito', up.alleggerito_il === '' && up.storia === '', JSON.stringify({ a: up.alleggerito_il, s: up.storia }));
}

console.log('4. UN ALTRO RUOLO, UN ALTRO MESE: UN ALTRO CONSUNTIVO');
{
  const r = await chiama(modulo, { db: { ConsuntivoFornitore: [VECCHIO] }, corpo: carica({ ruolo: 'raccoglitore' }) });
  verifica('Gatim come raccoglitore si crea senza chiedere niente', r.stato === 200 && nuoviConsuntivi(r).length === 1, JSON.stringify(r.j).slice(0, 200));
  const ottobre = await chiama(modulo, { db: { ConsuntivoFornitore: [VECCHIO] }, corpo: carica({ mese: 10 }) });
  verifica('e cosi\' Gatim a ottobre', ottobre.stato === 200 && nuoviConsuntivi(ottobre).length === 1);
  const op = await chiama(modulo, { db: { ConsuntivoFornitore: [VECCHIO] }, ruolo: 'user', corpo: carica({ sostituisci: true }) });
  verifica('chi non e\' amministratore non carica e non sostituisce', op.stato !== 200 && op.scritte.length === 0, String(op.stato));
}

console.log('5. LA REGOLA, E LA PAGINA');
{
  const { chiaveConsuntivo, consuntivoGiaCaricato } = consuntivo;
  verifica('la chiave normalizza il nome come il conto', typeof chiaveConsuntivo === 'function'
    && chiaveConsuntivo({ fornitore: 'Gatim', ruolo: 'impianto', anno: 2026, mese: 9, canale: 'rete' }) === chiaveConsuntivo(VECCHIO));
  if (typeof consuntivoGiaCaricato === 'function') {
    const doppi = consuntivoGiaCaricato([VECCHIO, { ...VECCHIO, id: 'c0', caricato_il: '2026-09-30T08:00:00.000Z' }], { fornitore: 'gatim srl', ruolo: 'impianto', anno: 2026, mese: 9, canale: 'RETE' });
    verifica('fra due doppioni nati prima si sostituisce il piu\' recente', doppi.precedente && doppi.precedente.id === 'c1' && doppi.altri.length === 1);
  } else verifica('consuntivoGiaCaricato c\'e\'', false);
  const pagina = readFileSync(new URL('../src/components/verifiche-fornitori/Consuntivi.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('la pagina chiede conferma e manda «sostituisci»', /window\.confirm\(`C'è già il consuntivo di/.test(pagina) && /sostituisci: !!prima/.test(pagina));
  verifica('e riconosce lo stesso fornitore col nome normalizzato', /normalizzaRagioneSociale\(x\.fornitore/.test(pagina));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
