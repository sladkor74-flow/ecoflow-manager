// PRIMA DI ELIMINARE UN FORNITORE O UNA TARIFFA SI GUARDA CHI LI USA (audit del
// 20/09/2026, alta A88, corretta il 12/10/2026).
//
// gestisciAnagrafiche eliminava subito, e la pagina dei fornitori chiedeva solo
// «Eliminare X?»: le tariffe, le voci della passiva, i contratti e i movimenti
// restavano senza soggetto, o senza prezzo. Ora la funzione conta i riferimenti
// (base44/shared/riferimentiAnagrafica.ts) e, se ce ne sono, risponde 409 con
// l'elenco e la proposta - disattivare il fornitore, chiudere il periodo della
// tariffa -; con conferma_eliminazione elimina, e lo storico dice che cosa
// c'era. Si prova la funzione vera col banco di prove/dati/bancoFunzioni.mjs, e
// le due pagine sul sorgente. npm run prove
import { readFileSync } from 'node:fs';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const leggi = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');

const modulo = await caricaFunzione('gestisciAnagrafiche');
const eliminati = (r) => r.scritte.filter(w => w.op === 'delete');
// «Oggi» fisso (revisione del 13/10/2026): una tariffa del 2026 e' aperta fino
// al 31/12 e chiusa dal 01/01/2027, e la prova non deve cambiare esito col
// calendario.
const conOggi = async (istante, fn) => {
  const Vera = Date;
  class Finta extends Vera {
    constructor(...a) { if (a.length) super(...a); else super(istante); }
    static now() { return new Vera(istante).getTime(); }
  }
  globalThis.Date = Finta;
  try { return await fn(); } finally { globalThis.Date = Vera; }
};

const primaria = (id, campi) => ({ id, id_ordine: id, stato: 'terminato', peso_effettivo: 2000, trasporto_finito_il: '2026-05-10T00:00:00Z', ...campi });
const DB = () => ({
  Fornitore: [
    { id: 'fE', ragione_sociale: 'EMMESSE SRL', stato: 'attivo' },
    { id: 'fN', ragione_sociale: 'NAPPI SUD SRL', stato: 'attivo', fattura_tramite_id: 'fE', fattura_tramite_nome: 'EMMESSE SRL' },
    { id: 'fZ', ragione_sociale: 'ZETA TRASPORTI', stato: 'attivo' },
  ],
  Tariffa: [
    { id: 'tR', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_id: 'fE', fornitore_nome: 'EMMESSE SRL', unita_misura: '€/t', valore: 72, stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' },
    { id: 't27', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_id: 'fE', fornitore_nome: 'EMMESSE SRL', unita_misura: '€/t', valore: 75, stato: 'attivo', data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31' },
    { id: 'tA', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', unita_misura: '€/t', valore: 180, stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' },
  ],
  VocePassivaAmministrazione: [{ id: 'v1', anno: 2026, canale: 'RETE', soggetto: 'Emmesse S.r.l.', voce: 'Raccolta' }],
  ContrattoFornitore: [{ id: 'c1', anno: 2026, soggetto_chiave: 'emmesse', soggetto_nome: 'EMMESSE SRL', tipo_contratto: 'raccolta', canale: 'RETE' }],
  PrimariaRete: [
    primaria('ET1', { trasportatore: 'EMMESSE S.R.L.', destinazione: 'GATIM SRL' }),
    primaria('ET2', { trasportatore: 'EMMESSE SRL', destinazione: 'GATIM SRL', trasporto_finito_il: '2025-12-20T00:00:00Z' }),
    primaria('ET3', { trasportatore: 'EMMESSE SRL', destinazione: 'GATIM SRL', stato: 'cancellato' }),
    primaria('ET4', { trasportatore: 'ALTRO SRL', destinazione: 'GATIM SRL' }),
  ],
  PrimariaAci: [primaria('EA1', { trasportatore: 'ALTRO SRL', destinazione: 'IRIGOM SRL' })],
  Secondaria: [],
  ExtraRaccolta: [],
});

console.log('IL FORNITORE USATO');
{
  const fermo = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fE' } });
  const r = fermo.j.riferimenti || {};
  verifica('non si elimina senza conferma: 409 e niente tolto', fermo.stato === 409 && fermo.j.richiede_conferma === true && eliminati(fermo).length === 0, J(fermo.j));
  // ET1 col nome scritto in un altro modo si conta; ET2 del 2025 anche (un
  // fornitore non ha periodo); il cancellato no, ALTRO no.
  verifica('conta tariffe, chi fattura tramite lui, voci, contratti e movimenti',
    r.tariffe === 2 && J(r.fatturano_tramite) === J(['NAPPI SUD SRL']) && r.voci_passiva === 1 && r.contratti === 1 && r.movimenti === 2 && r.movimenti_per_archivio.PrimariaRete === 2, J(r));
  verifica('e propone di disattivarlo, dicendolo', r.proposta === 'disattiva' && /è usato da/.test(fermo.j.error) && /conviene disattivarlo/.test(fermo.j.error), fermo.j.error);
  const via = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fE', conferma_eliminazione: true, motivo: 'eliminato dall\'anagrafica dei fornitori' } });
  verifica('con la conferma si elimina', via.stato === 200 && eliminati(via).some(w => w.id === 'fE'), J(via.j));
  const libero = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fZ' } });
  verifica('un fornitore che nessuno usa si elimina come prima', libero.stato === 200 && eliminati(libero).some(w => w.id === 'fZ'), J(libero.j));
}

console.log('LA TARIFFA USATA');
{
  // Il 13/10/2026 la tariffa del 2026 e' ancora aperta.
  const fermo = await conOggi('2026-10-13T10:00:00Z', () => chiama(modulo, { db: DB(), corpo: { entita: 'Tariffa', operazione: 'delete', id: 'tR' } }));
  const r = fermo.j.riferimenti || {};
  // nel 2026, terminate, raccolte da EMMESSE: solo ET1
  verifica('la raccolta di EMMESSE 2026: i movimenti del suo periodo e del suo ruolo', fermo.stato === 409 && r.movimenti === 1 && r.movimenti_per_archivio.PrimariaRete === 1 && eliminati(fermo).length === 0, J(r));
  verifica('e propone di chiudere il periodo', r.proposta === 'chiudi_periodo' && /conviene chiudere il periodo/.test(fermo.j.error) && /01\/01\/2026 → 31\/12\/2026/.test(fermo.j.error), fermo.j.error);
  const via = await chiama(modulo, { db: DB(), corpo: { entita: 'Tariffa', operazione: 'delete', id: 'tR', conferma_eliminazione: true } });
  verifica('con la conferma si elimina', via.stato === 200 && eliminati(via).some(w => w.id === 'tR'));
  const storico = (via.db.ModificaDato || []).filter(x => x.operazione === 'delete' && x.record_id === 'tR');
  verifica('e lo storico dice che cosa la usava', storico.length > 0 && storico.every(x => /eliminazione confermata nonostante: 1 primaria di rete terminata nel suo periodo/.test(x.motivo || '')), J(storico.map(x => x.motivo)));
  const futura = await chiama(modulo, { db: DB(), corpo: { entita: 'Tariffa', operazione: 'delete', id: 't27' } });
  verifica('la tariffa del 2027, che non ha ancora movimenti, si elimina senza domande', futura.stato === 200 && eliminati(futura).some(w => w.id === 't27'), J(futura.j));
  const attiva = await chiama(modulo, { db: DB(), corpo: { entita: 'Tariffa', operazione: 'delete', id: 'tA' } });
  verifica('il prezzo attivo ACI conta le primarie ACI del periodo, non quelle di rete', attiva.stato === 409 && attiva.j.riferimenti.movimenti === 1 && attiva.j.riferimenti.movimenti_per_archivio.PrimariaAci === 1, J(attiva.j.riferimenti));
  // L'ambito: una tariffa della Puglia non da' il prezzo a un ritiro di Roma.
  const conAmbito = DB();
  conAmbito.PrimariaAci[0].provincia = 'RM';
  conAmbito.Tariffa.push({ ...conAmbito.Tariffa[2], id: 'tP', regione: 'Puglia' }, { ...conAmbito.Tariffa[0], id: 'tN', stato: 'non_attivo' });
  const puglia = await chiama(modulo, { db: conAmbito, corpo: { entita: 'Tariffa', operazione: 'delete', id: 'tP' } });
  verifica('il prezzo ACI della Puglia non conta il ritiro di Roma: si elimina', puglia.stato === 200 && eliminati(puglia).some(w => w.id === 'tP'), J(puglia.j));
  const spenta = await chiama(modulo, { db: conAmbito, corpo: { entita: 'Tariffa', operazione: 'delete', id: 'tN' } });
  verifica('una tariffa «non attiva» non vale mai: eliminarla non toglie prezzi', spenta.stato === 200 && eliminati(spenta).some(w => w.id === 'tN'), J(spenta.j));
}

console.log('I NUMERI DELL\'ELENCO, ALL\'ITALIANA');
{
  const { riferimentiTariffa } = await import('../base44/shared/riferimentiAnagrafica.ts');
  const tante = Array.from({ length: 1234 }, (_, i) => primaria('M' + i, { trasportatore: 'EMMESSE SRL' }));
  const r = riferimentiTariffa(DB().Tariffa[0], { movimenti: { PrimariaRete: tante }, fornitori: DB().Fornitore });
  verifica('1.234 movimenti col punto delle migliaia', r.movimenti === 1234 && /^1\.234 primarie di rete terminate nel suo periodo/.test(r.elenco[0]), J(r.elenco));
}

console.log('UN ARCHIVIO CHE NON SI LEGGE NON DICE «NESSUNO LO USA»');
{
  const rotto = DB();
  rotto.PrimariaRete = { slice: () => { throw new Error('archivio non raggiungibile'); }, filter: () => { throw new Error('archivio non raggiungibile'); } };
  const r = await chiama(modulo, { db: rotto, corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fZ' } });
  verifica('errore, e niente eliminato', r.stato === 500 && eliminati(r).length === 0, J(r.j));
}

// Il record da eliminare che non si legge (revisione del 13/10/2026): la sua
// lettura finiva in un catch che dava null, il controllo si saltava e il
// fornitore usato si eliminava senza domande.
console.log('UN FORNITORE CHE NON SI LEGGE NON SI ELIMINA');
{
  const db = DB();
  let fallita = false;
  // La prima ricerca nell'archivio dei fornitori (la get) cade una volta.
  db.Fornitore = new Proxy(db.Fornitore, { get(t, p) {
    if (p === 'find' && !fallita) return () => { fallita = true; throw new Error('errore passeggero'); };
    return Reflect.get(t, p);
  } });
  // chiama copia l'archivio in JSON, e la copia perderebbe la trappola.
  globalThis.__DB = db; globalThis.__SCRITTE = []; globalThis.__RUOLO = 'admin';
  const risp = await modulo.default({ json: async () => ({ entita: 'Fornitore', operazione: 'delete', id: 'fE' }) });
  const j = await risp.json();
  verifica('la lettura del fornitore cade: errore, e niente eliminato',
    fallita && risp.status === 500 && !globalThis.__SCRITTE.some(w => w.op === 'delete') && /non l'ho eliminato/.test(j.error || ''), J({ stato: risp.status, j }));
  const sparita = await chiama(modulo, { db: DB(), corpo: { entita: 'Tariffa', operazione: 'delete', id: 'nessuna' } });
  verifica('una tariffa che non c\'e\': errore, e niente eliminato', sparita.stato === 500 && eliminati(sparita).length === 0 && /non l'ho eliminata/.test(sparita.j.error || ''), J(sparita.j));
}

// A UNA TARIFFA GIA' CHIUSA NON SI PROPONE DI CHIUDERE IL PERIODO (revisione
// del 13/10/2026). Dal 01/01/2027 eliminare una tariffa 2026 usata proponeva
// «chiudi periodo», e il prompt proponeva la data di oggi: accettandolo il
// prezzo del 2026 valeva anche nel 2027, contro i contratti annuali senza
// tacito rinnovo.
console.log('LA TARIFFA GIA\' CHIUSA');
{
  const nel2027 = await conOggi('2027-01-05T10:00:00Z', () => chiama(modulo, { db: DB(), corpo: { entita: 'Tariffa', operazione: 'delete', id: 'tR' } }));
  verifica('nel 2027 la tariffa 2026 usata: 409, ma niente «chiudi periodo»',
    nel2027.stato === 409 && nel2027.j.riferimenti.proposta === 'periodo_chiuso' && !/conviene chiudere il periodo/.test(nel2027.j.error)
    && /Il suo periodo è già chiuso/.test(nel2027.j.error) && /01\/01\/2026 → 31\/12\/2026/.test(nel2027.j.error) && eliminati(nel2027).length === 0, J(nel2027.j));
  const nel2026 = await conOggi('2026-10-13T10:00:00Z', () => chiama(modulo, { db: DB(), corpo: { entita: 'Tariffa', operazione: 'delete', id: 'tR' } }));
  verifica('nel 2026 la stessa tariffa e\' ancora aperta: «chiudi periodo»', nel2026.stato === 409 && nel2026.j.riferimenti.proposta === 'chiudi_periodo' && /conviene chiudere il periodo/.test(nel2026.j.error), J(nel2026.j));
  // Il giorno e' quello italiano: alle 23:30 UTC del 31/12/2026 in Italia e' gia' il 2027.
  const capodanno = await conOggi('2026-12-31T23:30:00Z', () => chiama(modulo, { db: DB(), corpo: { entita: 'Tariffa', operazione: 'delete', id: 'tR' } }));
  verifica('a mezzanotte e mezza del 01/01/2027 in Italia e\' gia\' chiusa', capodanno.j.riferimenti && capodanno.j.riferimenti.proposta === 'periodo_chiuso', J(capodanno.j));
  const senzaFine = DB();
  senzaFine.Tariffa[0].data_fine_validita = null;
  const aperta = await conOggi('2027-01-05T10:00:00Z', () => chiama(modulo, { db: senzaFine, corpo: { entita: 'Tariffa', operazione: 'delete', id: 'tR' } }));
  verifica('una tariffa senza data di fine resta da chiudere', aperta.stato === 409 && aperta.j.riferimenti.proposta === 'chiudi_periodo', J(aperta.j));
  // La risposta, parola per parola: lo spostamento della regola in
  // riferimentiAnagrafica non la cambia.
  verifica('il testo della tariffa chiusa, parola per parola',
    nel2027.j.error === 'La tariffa (01/01/2026 → 31/12/2026) è usata da: 1 primaria di rete terminata nel suo periodo (01/01/2026 → 31/12/2026), a cui può dare il prezzo. Il suo periodo è già chiuso: vale solo per i giorni che ha coperto e non va allungato. Eliminandola, quei movimenti restano senza prezzo, anche nei mesi già fatturati.'
    && J(Object.keys(nel2027.j)) === J(['error', 'riferimenti', 'richiede_conferma', 'conferma'])
    && J(Object.keys(nel2027.j.riferimenti)) === J(['entita', 'id', 'periodo', 'movimenti', 'movimenti_per_archivio', 'totale', 'elenco', 'proposta']), J(nel2027.j));
}

// LA REGOLA DELLA TARIFFA CHIUSA STA IN riferimentiAnagrafica (revisione del
// 13/10/2026). Stava in gestisciAnagrafiche (periodoAncoraAperto, testoConferma):
// riferimentiTariffa chiamata da sola diceva ancora «chiudi periodo» a una
// tariffa del 2026 letta nel 2027 (lo script del revisore a88_chiusa.mjs).
console.log('LA REGOLA DELLA TARIFFA CHIUSA STA IN riferimentiAnagrafica');
{
  const { riferimentiTariffa, testoRiferimenti } = await import('../base44/shared/riferimentiAnagrafica.ts');
  const db = DB();
  const dati = (oggi) => ({ movimenti: { PrimariaRete: db.PrimariaRete }, fornitori: db.Fornitore, ...(oggi ? { oggi } : {}) });
  const tR = db.Tariffa[0];
  const nel2027 = riferimentiTariffa(tR, dati('2027-01-05'));
  verifica('riferimentiTariffa nel 2027: periodo_chiuso', nel2027.proposta === 'periodo_chiuso' && nel2027.totale === 1, J(nel2027));
  verifica('e testoRiferimenti dice che e\' chiusa, senza proporre di chiuderla',
    /Il suo periodo è già chiuso: vale solo per i giorni che ha coperto e non va allungato/.test(testoRiferimenti(nel2027)) && !/conviene chiudere il periodo/.test(testoRiferimenti(nel2027)), testoRiferimenti(nel2027));
  verifica('il 13/10/2026 e\' ancora aperta: chiudi_periodo', riferimentiTariffa(tR, dati('2026-10-13')).proposta === 'chiudi_periodo');
  verifica('l\'ultimo giorno di validita\' e\' gia\' chiusa (chiudere a oggi non la accorcia)', riferimentiTariffa(tR, dati('2026-12-31')).proposta === 'periodo_chiuso');
  verifica('senza data di fine resta da chiudere anche nel 2027', riferimentiTariffa({ ...tR, data_fine_validita: null }, dati('2027-01-05')).proposta === 'chiudi_periodo');
  // Senza `oggi` vale il giorno italiano di oggi.
  const daSola = await conOggi('2026-12-31T23:30:00Z', () => riferimentiTariffa(tR, dati(null)));
  verifica('senza «oggi», alle 23:30 UTC del 31/12/2026 in Italia e\' gia\' il 2027', daSola.proposta === 'periodo_chiuso', J(daSola));
  const entry = leggi('base44/functions/gestisciAnagrafiche/entry.ts');
  verifica('gestisciAnagrafiche non ha piu\' una regola sua e passa il giorno italiano',
    !/periodoAncoraAperto|testoConferma|'periodo_chiuso'/.test(entry) && /riferimentiTariffa\(record, \{ movimenti, fornitori, oggi: oggiRoma\(\) \}\)/.test(entry)
    && /error: testoRiferimenti\(riferimenti\)/.test(entry));
}

console.log('LA PAGINA DELLE TARIFFE NON ALLUNGA UN PERIODO');
{
  const tar = leggi('src/components/fatturazione/TariffeUnificate.jsx');
  const pezzo = (inizio, fine) => { const i = tar.indexOf(inizio); const f = tar.indexOf(fine, i); return i >= 0 && f > i ? tar.slice(i, f) : ''; };
  // Le funzioni della pagina, prese dal sorgente e fatte girare con un «oggi» fisso.
  const aiuti = [pezzo('function periodoAncoraAperto(t) {', '\n}') + '\n}', pezzo('const dataIt = ', '\n'), pezzo('function leggiDataScritta(testo) {', '\n}') + '\n}'].join('\n');
  const corpo = pezzo('const closePeriod = async (t) => {', '  const reopenPeriod');
  const presenti = /periodoAncoraAperto/.test(aiuti) && /leggiDataScritta/.test(aiuti) && /closePeriod/.test(corpo);
  verifica('la pagina ha le funzioni della chiusura', presenti);
  const prova = (oggi, risposta) => {
    const chiamate = [], avvisi = [], domande = [];
    let f = {};
    try {
      const fabbrica = new Function('prompt', 'alert', 'base44', 'notaTraccia', 'load', 'oggiRoma', `${aiuti}\n${corpo}\nreturn { closePeriod, periodoAncoraAperto, leggiDataScritta };`);
      f = fabbrica((testo, proposta) => { domande.push(proposta); return risposta; }, (t) => avvisi.push(t),
        { functions: { invoke: async (_nome, dati) => { chiamate.push(dati); return { data: {} }; } } }, () => '', () => {}, () => oggi);
    } catch (e) { avvisi.push('la pagina non si ricostruisce: ' + e.message); }
    return { f, chiamate, avvisi, domande };
  };
  const t2026 = { id: 'tR', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', stato: 'attivo' };
  const chiusa = prova('2027-01-05', '05/01/2027');
  if (chiusa.f.closePeriod) await chiusa.f.closePeriod(t2026);
  verifica('a una tariffa gia\' chiusa non si chiede nessuna data e non si scrive niente',
    chiusa.f.closePeriod && chiusa.chiamate.length === 0 && chiusa.domande.length === 0 && /già chiuso: vale fino al 31\/12\/2026/.test(chiusa.avvisi[0] || ''), J(chiusa));
  const lunga = prova('2026-10-13', '15/01/2027');
  if (lunga.f.closePeriod) await lunga.f.closePeriod(t2026);
  verifica('la data proposta e\' oggi, all\'italiana', lunga.domande[0] === '13/10/2026', J(lunga.domande));
  verifica('una data dopo la fine che ha gia\' non si accetta', lunga.f.closePeriod && lunga.chiamate.length === 0 && /non lo allunga/.test(lunga.avvisi[0] || ''), J(lunga));
  const giusta = prova('2026-10-13', '31/10/2026');
  if (giusta.f.closePeriod) await giusta.f.closePeriod(t2026);
  verifica('una data prima della fine accorcia il periodo', giusta.chiamate.length === 1 && giusta.chiamate[0].dati.data_fine_validita === '2026-10-31', J(giusta.chiamate));
  const { leggiDataScritta } = prova('2026-10-13', null).f;
  verifica('le date scritte: gg/mm/aaaa e aaaa-mm-gg sì, 31/02 no', typeof leggiDataScritta === 'function'
    && leggiDataScritta('5/1/2027') === '2027-01-05' && leggiDataScritta('2026-10-31') === '2026-10-31' && leggiDataScritta('31/02/2026') === null && leggiDataScritta('domani') === null);
  verifica('«Chiudi periodo» nella finestra solo se la proposta e\' quella e la tariffa e\' aperta',
    /inUsoTariffa\.proposta === 'chiudi_periodo' && deleteTarget && periodoAncoraAperto\(deleteTarget\) && \(\s*<Button variant="outline" onClick=\{chiudiPeriodoInvece\}/.test(tar));
  verifica('e nessun prompt propone la data UTC di oggi', !/prompt\([^)]*new Date\(\)\.toISOString\(\)/.test(tar));
}

console.log('LE DUE PAGINE');
{
  const forn = leggi('src/components/fatturazione/FornitoriManager.jsx');
  verifica('i fornitori: la conferma si manda solo dopo aver mostrato l\'elenco', /conferma_eliminazione: true/.test(forn) && /richiede_conferma && d\.riferimenti/.test(forn) && /inUso\.riferimenti\.elenco/.test(forn));
  verifica('e accanto c\'e\' «Disattiva»', /onClick=\{disattivaInUso\}/.test(forn) && /stato: 'non_attivo'/.test(forn));
  const tar = leggi('src/components/fatturazione/TariffeUnificate.jsx');
  verifica('le tariffe: l\'elenco nella finestra di eliminazione, con «Chiudi periodo»', /inUsoTariffa\.elenco/.test(tar) && /onClick=\{chiudiPeriodoInvece\}/.test(tar) && /conferma_eliminazione: true/.test(tar));
  verifica('la conferma parte solo dal secondo clic, a elenco mostrato', /handleDelete\(!!inUsoTariffa\)/.test(tar) && /conferma === true \? \{ conferma_eliminazione: true \}/.test(tar));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
