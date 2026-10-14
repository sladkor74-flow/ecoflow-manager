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
//
// Decisioni dell'utente del 13/10/2026: un fornitore con movimenti terminati
// (gia' nei conti, fatturati o da fatturare) non si elimina nemmeno con la
// conferma. La funzione risponde 409 con eliminabile: false e la sola proposta
// di disattivarlo, e la finestra della pagina non ha piu' «Elimina comunque».
// Senza movimenti (solo tariffe, voci, contratti) si elimina come prima, con la
// conferma. La finestra e la scheda si disegnano davvero con React lato server.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
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
    // Usato solo da una tariffa: nessun movimento.
    { id: 'fT', ragione_sociale: 'TAU AMBIENTE SRL', stato: 'attivo' },
    // Gia' disattivato, con un movimento terminato.
    { id: 'fS', ragione_sociale: 'SIGMA SPENTO SRL', stato: 'non_attivo' },
  ],
  Tariffa: [
    { id: 'tR', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_id: 'fE', fornitore_nome: 'EMMESSE SRL', unita_misura: '€/t', valore: 72, stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' },
    { id: 't27', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_id: 'fE', fornitore_nome: 'EMMESSE SRL', unita_misura: '€/t', valore: 75, stato: 'attivo', data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31' },
    { id: 'tA', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', unita_misura: '€/t', valore: 180, stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' },
    { id: 'tT', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_id: 'fT', fornitore_nome: 'TAU AMBIENTE SRL', unita_misura: '€/t', valore: 70, stato: 'attivo', data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31' },
  ],
  VocePassivaAmministrazione: [{ id: 'v1', anno: 2026, canale: 'RETE', soggetto: 'Emmesse S.r.l.', voce: 'Raccolta' }],
  ContrattoFornitore: [{ id: 'c1', anno: 2026, soggetto_chiave: 'emmesse', soggetto_nome: 'EMMESSE SRL', tipo_contratto: 'raccolta', canale: 'RETE' }],
  PrimariaRete: [
    primaria('ET1', { trasportatore: 'EMMESSE S.R.L.', destinazione: 'GATIM SRL' }),
    primaria('ET2', { trasportatore: 'EMMESSE SRL', destinazione: 'GATIM SRL', trasporto_finito_il: '2025-12-20T00:00:00Z' }),
    primaria('ET3', { trasportatore: 'EMMESSE SRL', destinazione: 'GATIM SRL', stato: 'cancellato' }),
    primaria('ET4', { trasportatore: 'ALTRO SRL', destinazione: 'GATIM SRL' }),
  ],
  PrimariaAci: [
    primaria('EA1', { trasportatore: 'ALTRO SRL', destinazione: 'IRIGOM SRL' }),
    primaria('SA1', { trasportatore: 'SIGMA SPENTO S.R.L.', destinazione: 'IRIGOM SRL', trasporto_finito_il: '2025-11-10T00:00:00Z' }),
  ],
  Secondaria: [],
  ExtraRaccolta: [],
});

console.log('IL FORNITORE USATO');
{
  const fermo = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fE' } });
  const r = fermo.j.riferimenti || {};
  verifica('non si elimina senza conferma: 409 e niente tolto', fermo.stato === 409 && eliminati(fermo).length === 0, J(fermo.j));
  // ET1 col nome scritto in un altro modo si conta; ET2 del 2025 anche (un
  // fornitore non ha periodo); il cancellato no, ALTRO no.
  verifica('conta tariffe, chi fattura tramite lui, voci, contratti e movimenti',
    r.tariffe === 2 && J(r.fatturano_tramite) === J(['NAPPI SUD SRL']) && r.voci_passiva === 1 && r.contratti === 1 && r.movimenti === 2 && r.movimenti_per_archivio.PrimariaRete === 2, J(r));
  // Decisioni del 13/10/2026: con movimenti terminati non si elimina, e il
  // testo non offre la conferma.
  verifica('ha movimenti: non eliminabile, e propone solo di disattivarlo, dicendolo',
    r.eliminabile === false && fermo.j.eliminabile === false && fermo.j.proposta === 'disattiva' && r.proposta === 'disattiva' && fermo.j.richiede_conferma === undefined
    && /è usato da/.test(fermo.j.error) && /Non si può eliminare: i suoi movimenti terminati sono già nei conti/.test(fermo.j.error)
    && /Si disattiva: resta per i conti già fatti/.test(fermo.j.error) && !/conviene disattivarlo/.test(fermo.j.error), J(fermo.j));
  const via = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fE', conferma_eliminazione: true, motivo: 'eliminato dall\'anagrafica dei fornitori' } });
  verifica('nemmeno con la conferma: 409, e niente tolto ne\' scritto',
    via.stato === 409 && via.j.eliminabile === false && eliminati(via).length === 0 && via.scritte.length === 0 && !(via.db.ModificaDato || []).length, J(via.j));
  const libero = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fZ' } });
  verifica('un fornitore che nessuno usa si elimina come prima', libero.stato === 200 && eliminati(libero).some(w => w.id === 'fZ'), J(libero.j));
  // Senza movimenti, ma con una tariffa: si elimina come prima, con la conferma.
  const soloTariffa = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fT' } });
  const rt = soloTariffa.j.riferimenti || {};
  verifica('senza movimenti ma con una tariffa: 409 con la conferma da chiedere',
    soloTariffa.stato === 409 && soloTariffa.j.richiede_conferma === true && rt.eliminabile === true && rt.movimenti === 0 && rt.tariffe === 1
    && /conviene disattivarlo/.test(soloTariffa.j.error) && eliminati(soloTariffa).length === 0, J(soloTariffa.j));
  const confermato = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fT', conferma_eliminazione: true, motivo: 'eliminato dall\'anagrafica dei fornitori' } });
  const storico = (confermato.db.ModificaDato || []).filter(x => x.entita === 'Fornitore' && x.record_id === 'fT');
  verifica('e con la conferma si elimina, e lo storico dice che cosa lo usava', confermato.stato === 200 && eliminati(confermato).some(w => w.id === 'fT')
    && storico.length > 0 && storico.every(x => x.operazione === 'delete' && /eliminazione confermata nonostante: 1 tariffa del fornitore/.test(x.motivo || '') && x.etichetta === 'TAU AMBIENTE SRL'),
    J({ j: confermato.j, storico }));
  // Gia' disattivato e con movimenti: non si elimina, e non gli si propone di
  // disattivarlo di nuovo.
  const spento = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fS', conferma_eliminazione: true } });
  verifica('gia\' disattivato con un movimento del 2025: 409, proposta gia_disattivato, niente tolto',
    spento.stato === 409 && spento.j.eliminabile === false && spento.j.proposta === 'gia_disattivato' && spento.j.riferimenti.movimenti_per_archivio.PrimariaAci === 1
    && /È già disattivato: resta così/.test(spento.j.error) && !/Si disattiva/.test(spento.j.error) && eliminati(spento).length === 0, J(spento.j));
  // Il doppione dello stesso nome: i movimenti per nome li prende l'altro
  // record, e questo si toglie (con la conferma, se le tariffe puntano a lui).
  const doppio = DB();
  doppio.Fornitore.push({ id: 'fE2', ragione_sociale: 'EMMESSE S.R.L.', stato: 'attivo' });
  const gemello = await chiama(modulo, { db: doppio, corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fE2' } });
  verifica('il doppione di EMMESSE senza collegamenti suoi si elimina: i movimenti restano all\'altro', gemello.stato === 200 && eliminati(gemello).some(w => w.id === 'fE2'), J(gemello.j));
  const conTariffe = await chiama(modulo, { db: doppio, corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fE' } });
  verifica('quello a cui puntano le tariffe, col doppione accanto, ha solo i collegamenti per id: eliminabile con la conferma',
    conTariffe.stato === 409 && conTariffe.j.richiede_conferma === true && conTariffe.j.riferimenti.eliminabile === true && conTariffe.j.riferimenti.movimenti === 0, J(conTariffe.j));
}

console.log('LA REGOLA DEL FORNITORE CON MOVIMENTI STA IN riferimentiAnagrafica');
{
  const { riferimentiFornitore, testoRiferimenti } = await import('../base44/shared/riferimentiAnagrafica.ts');
  const db = DB();
  const dati = { tariffe: db.Tariffa, fornitori: db.Fornitore, voci: db.VocePassivaAmministrazione, contratti: db.ContrattoFornitore, movimenti: { PrimariaRete: db.PrimariaRete, PrimariaAci: db.PrimariaAci } };
  const fE = riferimentiFornitore(db.Fornitore[0], dati);
  verifica('EMMESSE: due movimenti terminati, non eliminabile', fE.eliminabile === false && fE.movimenti === 2 && fE.proposta === 'disattiva', J(fE));
  // Un movimento cancellato non e' nei conti: non blocca.
  const soloCancellato = riferimentiFornitore(db.Fornitore[0], { ...dati, movimenti: { PrimariaRete: [db.PrimariaRete[2]] } });
  verifica('solo un movimento cancellato: eliminabile con la conferma', soloCancellato.eliminabile === true && soloCancellato.movimenti === 0 && soloCancellato.totale > 0, J(soloCancellato));
  verifica('il testo di un fornitore eliminabile resta quello di prima',
    testoRiferimenti(soloCancellato) === '«EMMESSE SRL» è usato da: 2 tariffe del fornitore; 1 fornitore che fattura tramite lui (NAPPI SUD SRL); 1 voce del foglio della passiva; 1 contratto. Invece di eliminarlo conviene disattivarlo: resta per i conti già fatti e non si propone più.', testoRiferimenti(soloCancellato));
  verifica('il testo del non eliminabile, parola per parola',
    testoRiferimenti(fE) === '«EMMESSE SRL» è usato da: 2 tariffe del fornitore; 1 fornitore che fattura tramite lui (NAPPI SUD SRL); 1 voce del foglio della passiva; 1 contratto; 2 primarie di rete terminate che lo nominano. Non si può eliminare: i suoi movimenti terminati sono già nei conti, fatturati o da fatturare, e resterebbero senza il loro fornitore. Si disattiva: resta per i conti già fatti e non si propone più nelle scelte.', testoRiferimenti(fE));
  const fZ = riferimentiFornitore(db.Fornitore[2], dati);
  verifica('chi non e\' usato da niente: eliminabile, nessun testo', fZ.eliminabile === true && fZ.totale === 0 && testoRiferimenti(fZ) === '', J(fZ));
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
  verifica('i fornitori: la conferma si manda solo dopo aver mostrato l\'elenco, e solo a un fornitore eliminabile',
    /conferma_eliminazione: true/.test(forn) && /finestraDaRisposta\(f, d\)/.test(forn) && /inUso\.riferimenti\.elenco/.test(forn)
    && /onElimina=\{\(\) => inUso && inUso\.eliminabile && elimina\(inUso\.f, true\)\}/.test(forn));
  verifica('e c\'e\' «Disattiva»', /onDisattiva=\{disattivaInUso\}/.test(forn) && /stato: 'non_attivo'/.test(forn));
  const tar = leggi('src/components/fatturazione/TariffeUnificate.jsx');
  verifica('le tariffe: l\'elenco nella finestra di eliminazione, con «Chiudi periodo»', /inUsoTariffa\.elenco/.test(tar) && /onClick=\{chiudiPeriodoInvece\}/.test(tar) && /conferma_eliminazione: true/.test(tar));
  verifica('la conferma parte solo dal secondo clic, a elenco mostrato', /handleDelete\(!!inUsoTariffa\)/.test(tar) && /conferma === true \? \{ conferma_eliminazione: true \}/.test(tar));
}

// LA FINESTRA E LA SCHEDA DEI FORNITORI, DISEGNATE (13/10/2026). Si disegnano
// con React lato server i pezzi veri di FornitoriManager.jsx, con le risposte
// vere della funzione; la finestra di sistema (Radix) e il menu a tendina si
// sostituiscono con contenitori semplici, e l'accesso con uno finto, come in
// prove/storicoModifiche.mjs (sezione 7).
console.log('LA FINESTRA E LA SCHEDA DEI FORNITORI, DISEGNATE');
{
  const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
  const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
  const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(existsSync) || base; };
  const FINTI = {
    client: 'export const base44 = { functions: { invoke: async () => ({ data: {} }) }, entities: {}, auth: { me: async () => ({}) } };',
    // La DialogContent finta tiene le classi (14/10/2026): la prova del telefono le guarda.
    dialog: `import React from 'react';
      const box = (tag) => ({ children }) => React.createElement(tag, null, children);
      export const Dialog = ({ open, children }) => (open ? React.createElement(React.Fragment, null, children) : null);
      export const DialogContent = ({ className, children }) => React.createElement('section', { className }, children);
      export const DialogHeader = box('div'); export const DialogFooter = box('div');
      export const DialogTitle = box('h2'); export const DialogDescription = box('p');`,
    select: `import React from 'react';
      const box = (tag) => ({ children }) => React.createElement(tag, null, children);
      export const Select = ({ value, children }) => React.createElement('div', { 'data-valore': value }, children);
      export const SelectTrigger = box('div'); export const SelectContent = box('div'); export const SelectValue = () => null;
      export const SelectItem = ({ value, children }) => React.createElement('span', { 'data-voce': value }, children);`,
    accesso: 'export const useAuth = () => ({ user: null, isLoadingAuth: false }); export const AuthProvider = ({ children }) => children;',
  };
  const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { FinestraInUso, SchedaFornitore, finestraDaRisposta, datiDaScrivere, schedaDi } from ${JSON.stringify(qui('../src/components/fatturazione/FornitoriManager.jsx'))};
export { finestraDaRisposta, datiDaScrivere, schedaDi };
const niente = () => {};
export const finestra = (inUso) => renderToStaticMarkup(React.createElement(FinestraInUso, { inUso, onChiudi: niente, onDisattiva: niente, onElimina: niente }));
export const scheda = (record) => renderToStaticMarkup(React.createElement(SchedaFornitore, { aperta: true, record, onChiudi: niente, onSalvato: niente }));
`;
  // src/lib/utils.js guarda window appena caricato (isIframe): un window finto,
  // come in prove/dati/libPagine.mjs.
  if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1 };
  let pagina = null;
  try {
    const pacchetto = await build({
      stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
      bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
      loader: { '.jsx': 'jsx', '.js': 'jsx' },
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'finti', setup(b) {
        b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'finto' }));
        b.onResolve({ filter: /^@\/components\/ui\/dialog$/ }, () => ({ path: 'dialog', namespace: 'finto' }));
        b.onResolve({ filter: /^@\/components\/ui\/select$/ }, () => ({ path: 'select', namespace: 'finto' }));
        b.onResolve({ filter: /^@\/lib\/AuthContext$/ }, () => ({ path: 'accesso', namespace: 'finto' }));
        b.onLoad({ filter: /.*/, namespace: 'finto' }, (args) => ({ contents: FINTI[args.path], loader: 'js', resolveDir: qui('.') }));
        b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) }));
      } }],
    });
    pagina = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  } catch (e) { verifica('la pagina dei fornitori si impacchetta e si carica', false, String(e && e.message).slice(0, 600)); }
  if (pagina) {
    // Le risposte vere della funzione, passate alla pagina.
    const risposta = async (id) => (await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'delete', id } })).j;
    const f = (id) => DB().Fornitore.find(x => x.id === id);
    const conMovimenti = pagina.finestraDaRisposta(f('fE'), await risposta('fE'));
    verifica('la risposta di EMMESSE apre la finestra, non eliminabile', conMovimenti && conMovimenti.eliminabile === false && conMovimenti.proposta === 'disattiva', J(conMovimenti));
    const bloccata = pagina.finestra(conMovimenti);
    verifica('con movimenti: «Disattiva» si\', «Elimina comunque» no',
      bloccata.includes('EMMESSE SRL non si può eliminare') && bloccata.includes('Disattiva') && !bloccata.includes('Elimina comunque')
      && bloccata.includes('2 primarie di rete terminate che lo nominano') && bloccata.includes('Si disattiva: resta per i conti già fatti'), bloccata.slice(0, 900));
    const spenta = pagina.finestra(pagina.finestraDaRisposta(f('fS'), await risposta('fS')));
    verifica('gia\' disattivato: ne\' «Disattiva» ne\' «Elimina comunque», solo «Chiudi»',
      !/> ?Disattiva</.test(spenta) && !spenta.includes('Elimina comunque') && spenta.includes('Chiudi') && spenta.includes('È già disattivato'), spenta.slice(0, 900));
    const libera = pagina.finestra(pagina.finestraDaRisposta(f('fT'), await risposta('fT')));
    verifica('senza movimenti: «Disattiva» ed «Elimina comunque», come prima',
      libera.includes('TAU AMBIENTE SRL è ancora usato') && libera.includes('Disattiva') && libera.includes('Elimina comunque'), libera.slice(0, 900));
    verifica('una risposta che non e\' l\'elenco (un errore) non apre la finestra', pagina.finestraDaRisposta(f('fE'), { error: 'Rate limit exceeded' }) === null && pagina.finestra(null) === '');

    // La scheda: i recapiti dei contratti si scrivono e si modificano.
    const record = { id: 'fE', ragione_sociale: 'EMMESSE SRL', tipo: 'trasportatore', piva: '01234567890', regione: 'Campania', telefono: '081 123456', cellulare: '333 1234567', email: 'info@emmesse.it', pec: 'emmesse@pec.it', referente: 'Mario Rossi', stato: 'attivo' };
    const html = pagina.scheda(record);
    verifica('la scheda mostra cellulare, pec e referente del fornitore',
      html.includes('Scheda di EMMESSE SRL') && html.includes('value="333 1234567"') && html.includes('value="emmesse@pec.it"') && html.includes('value="Mario Rossi"')
      && html.includes('Cellulare') && html.includes('PEC') && html.includes('Referente') && html.includes('Recapiti per i contratti'), html.slice(0, 1200));
    verifica('e lo storico delle modifiche del fornitore', html.includes('Storico'), html.slice(-600));
    const nuova = pagina.scheda(null);
    verifica('la scheda vuota per un fornitore nuovo, senza storico', nuova.includes('Nuovo fornitore') && nuova.includes('Cellulare') && !nuova.includes('Storico'), nuova.slice(0, 600));
    const s = pagina.schedaDi(record);
    verifica('una scheda non cambiata non scrive niente', J(pagina.datiDaScrivere(record, s)) === '{}');
    verifica('si scrivono solo i campi cambiati, e un recapito tolto e\' null',
      J(pagina.datiDaScrivere(record, { ...s, cellulare: ' 333 7654321 ', pec: '' })) === J({ cellulare: '333 7654321', pec: null }));
    verifica('un fornitore nuovo: i campi scritti, senza i vuoti',
      J(pagina.datiDaScrivere(null, { ...pagina.schedaDi(null), ragione_sociale: 'NUOVO SRL', referente: 'Anna Bianchi' })) === J({ ragione_sociale: 'NUOVO SRL', tipo: 'trasportatore', referente: 'Anna Bianchi' }));
    // Quello che la scheda scrive, la funzione vera lo salva e lo traccia.
    const dati = pagina.datiDaScrivere({ ...record, cellulare: '', pec: '', referente: '' }, s);
    const salvato = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'update', id: 'fE', dati } });
    const righe = (salvato.db.ModificaDato || []).filter(x => x.entita === 'Fornitore');
    verifica('salvati dalla funzione, con una riga di storico per campo',
      salvato.stato === 200 && salvato.db.Fornitore.find(x => x.id === 'fE').cellulare === '333 1234567'
      && J(righe.map(x => x.campo).sort()) === J(['cellulare', 'pec', 'referente']) && righe.every(x => x.etichetta === 'EMMESSE SRL' && x.riservato === false), J({ dati, righe }));

    // SU UN TELEFONO LA SCHEDA SCORRE (revisione del 14/10/2026). La
    // DialogContent del progetto (src/components/ui/dialog.jsx) e' fissata a
    // meta' schermo senza altezza massima: a 375 px le nove caselle una per
    // riga superano lo schermo, e Salva e Annulla ne uscivano senza potersi
    // raggiungere. Lo script del revisore mobile.mjs stimava circa 900 px.
    const classi = (h) => (h.match(/<section class="([^"]*)"/) || [])[1] || '';
    const scorre = (c) => /(^|\s)max-h-\[\d+vh\](\s|$)/.test(c) && /(^|\s)overflow-y-auto(\s|$)/.test(c);
    verifica('la scheda ha un\'altezza massima e scorre', scorre(classi(html)) && scorre(classi(nuova)), J([classi(html), classi(nuova)]));
    verifica('anche la finestra di chi usa il fornitore', scorre(classi(bloccata)), classi(bloccata));
    const dialog = leggi('src/components/ui/dialog.jsx');
    verifica('(la DialogContent del progetto non scorre da sola: serve la classe)', !/max-h-|overflow-y-auto/.test((dialog.match(/DialogPrimitive\.Content[\s\S]*?className=\{cn\(\s*"([^"]*)"/) || [])[1] || 'max-h-'));

    // LA RAGIONE SOCIALE SI CORREGGE, NON SI CAMBIA (14/10/2026): la scheda di
    // un fornitore che c'e' lo dice sotto il nome; quella nuova no.
    verifica('la scheda di un fornitore che c\'e\' dice che il nome resta quello del portale',
      html.includes('La ragione sociale resta quella dei formulari del portale') && !nuova.includes('La ragione sociale resta quella dei formulari del portale'), html.slice(0, 1500));

    // UN FORNITORE GIA' DISATTIVATO, SENZA MOVIMENTI MA CON UNA TARIFFA (lo
    // script del revisore spento.mjs). Il server dice «È già disattivato:
    // eliminandolo...»; la finestra nascondeva «Disattiva» ma il riquadro
    // proponeva ancora «Disattivandolo resta...», e non diceva che lo e' gia'.
    const soloTariffa = DB();
    soloTariffa.Tariffa.push({ ...soloTariffa.Tariffa[3], id: 'tS', fornitore_id: 'fS', fornitore_nome: 'SIGMA SPENTO SRL' });
    soloTariffa.PrimariaAci = soloTariffa.PrimariaAci.filter(r => r.id !== 'SA1');
    const rispostaSpento = (await chiama(modulo, { db: soloTariffa, corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fS' } })).j;
    const fin = pagina.finestraDaRisposta(f('fS'), rispostaSpento);
    const spentoLibero = pagina.finestra(fin);
    verifica('(la risposta: eliminabile con la conferma, proposta gia_disattivato)', rispostaSpento.richiede_conferma === true && rispostaSpento.riferimenti.eliminabile === true
      && rispostaSpento.riferimenti.proposta === 'gia_disattivato' && fin && fin.eliminabile === true, J(rispostaSpento));
    verifica('gia\' disattivato e senza movimenti: dice che lo e\' gia\', non propone di disattivarlo, e si elimina con la conferma',
      spentoLibero.includes('È già disattivato') && !spentoLibero.includes('Disattivandolo') && !/> ?Disattiva</.test(spentoLibero) && spentoLibero.includes('Elimina comunque'),
      spentoLibero.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
    verifica('e uno attivo senza movimenti lo propone ancora', libera.includes('Disattivandolo resta per i conti già fatti') && !libera.includes('È già disattivato'));
  }
}

// UNA LETTURA SOLA DEL RECORD DA ELIMINARE (13/10/2026). Da quando il fornitore
// ha campi tracciati (i recapiti dei contratti), eliminaConTraccia rileggeva il
// record gia' letto per i riferimenti: ora quello letto e' il «prima» dello
// storico. Sul banco la get e' una ricerca nell'elenco dell'archivio: si contano.
console.log('UNA LETTURA SOLA DEL RECORD DA ELIMINARE');
{
  const conta = async (entita, id) => {
    const db = DB();
    let letture = 0;
    db[entita] = new Proxy(db[entita], { get(t, p) {
      if (p === 'find') return (...a) => { letture++; return Array.prototype.find.apply(t, a); };
      return Reflect.get(t, p);
    } });
    globalThis.__DB = db; globalThis.__SCRITTE = []; globalThis.__RUOLO = 'admin';
    const risp = await modulo.default({ json: async () => ({ entita, operazione: 'delete', id }) });
    return { stato: risp.status, letture, storico: (db.ModificaDato || []).filter(x => x.record_id === id) };
  };
  const f = await conta('Fornitore', 'fZ');
  verifica('il fornitore libero: una lettura, eliminato, e lo storico lo dice', f.stato === 200 && f.letture === 1 && f.storico.length === 1 && f.storico[0].etichetta === 'ZETA TRASPORTI', J(f));
  const t = await conta('Tariffa', 't27');
  verifica('la tariffa del 2027: una lettura, e lo storico ha il prezzo di prima', t.stato === 200 && t.letture === 1 && t.storico.some(x => x.campo === 'valore' && x.prima === '75'), J(t));
}

console.log('IL NOME NON SI SVUOTA');
{
  const vuoto = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'update', id: 'fE', dati: { ragione_sociale: '  ' } } });
  verifica('una modifica che svuota il nome: 400, niente scritto', vuoto.stato === 400 && vuoto.scritte.length === 0 && /ha bisogno di un nome/.test(vuoto.j.error || ''), J(vuoto.j));
  const nullo = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'update', id: 'fE', dati: { ragione_sociale: null } } });
  verifica('anche col nome null', nullo.stato === 400 && nullo.scritte.length === 0, J(nullo.j));
  const ruoli = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'update', id: 'fE', dati: { ruolo_raccolta: true } } });
  verifica('una modifica senza il nome passa come prima', ruoli.stato === 200 && ruoli.scritte.some(w => w.op === 'update' && w.id === 'fE'), J(ruoli.j));
}

// LE TERZIARIE CONTANO (revisione del 14/10/2026). Sono movimenti terminati
// dell'archivio, di SMOCO, pagati dal portale in prefattura (ordini TER), e
// non si contavano: sui dati dell'11/10 IMPRIMET SRL, KATANE' TRASPORTI S.R.L.,
// PIRRERA ANTONIO e RIA PIETRINA, che hanno solo terziarie, si eliminavano
// senza una domanda (lo script del revisore terziarie.mjs). Le tariffe invece
// non danno il prezzo alle terziarie: per eliminarne una non si guardano.
console.log('LE TERZIARIE CONTANO');
{
  const terziaria = (id, campi) => primaria(id, { ragione_sociale: 'Irigom S.r.l.', destinazione: 'AKÇANSA ÇİMENTO - Canakkale', trasporto_finito_il: '2025-07-10T08:00:00Z', ...campi });
  const conTerziarie = () => {
    const db = DB();
    db.Fornitore.push(
      { id: 'fK', ragione_sociale: "KATANE' TRASPORTI S.R.L.", tipo: 'trasportatore', stato: 'attivo' },
      { id: 'fI', ragione_sociale: 'INNOREC SRL', tipo: 'impianto', stato: 'attivo' },
    );
    db.Terziaria = [
      terziaria('TK1', { trasportatore: "KATANE' TRASPORTI S.R.L." }), terziaria('TK2', { trasportatore: "KATANE' TRASPORTI S.R.L." }),
      terziaria('TK3', { trasportatore: "KATANE' TRASPORTI S.R.L." }),
      // l'impianto da cui parte e' la ragione sociale della terziaria
      terziaria('TI1', { ragione_sociale: 'INNOREC SRL', trasportatore: 'SMOCO S.R.L.' }),
    ];
    db.Tariffa.push({ id: 'tK', direzione: 'PASSIVA', tipologia: 'TUTTE', prestazione: 'TRASPORTO_SECONDARIA', fornitore_id: 'fK', fornitore_nome: "KATANE' TRASPORTI S.R.L.", unita_misura: '€/t', valore: 20, stato: 'attivo', data_inizio_validita: '2025-01-01', data_fine_validita: '2025-12-31' });
    return db;
  };
  const k = await chiama(modulo, { db: conTerziarie(), corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fK' } });
  verifica('il trasportatore con le sole terziarie non si elimina: 409, non eliminabile, e l\'elenco le dice',
    k.stato === 409 && k.j.eliminabile === false && k.j.riferimenti.movimenti_per_archivio.Terziaria === 3 && k.j.riferimenti.movimenti === 3
    && k.j.riferimenti.elenco.includes('3 terziarie terminate che lo nominano') && eliminati(k).length === 0, J(k.j));
  const kc = await chiama(modulo, { db: conTerziarie(), corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fK', conferma_eliminazione: true } });
  verifica('nemmeno con la conferma', kc.stato === 409 && eliminati(kc).length === 0 && kc.scritte.length === 0, J(kc.j));
  const imp = await chiama(modulo, { db: conTerziarie(), corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fI' } });
  verifica('l\'impianto da cui partono le terziarie (la loro ragione sociale) nemmeno',
    imp.stato === 409 && imp.j.eliminabile === false && imp.j.riferimenti.movimenti_per_archivio.Terziaria === 1 && /1 terziaria terminata che lo nominano/.test(imp.j.error), J(imp.j));
  const { riferimentiTariffa, CAMPI_FORNITORE_NEI_MOVIMENTI, ARCHIVI_CON_TARIFFA } = await import('../base44/shared/riferimentiAnagrafica.ts');
  verifica('le terziarie fra i movimenti, con chi trasporta, chi riceve e chi spedisce; non fra quelli con tariffa',
    J(CAMPI_FORNITORE_NEI_MOVIMENTI.Terziaria) === J(['trasportatore', 'destinazione', 'ragione_sociale']) && !ARCHIVI_CON_TARIFFA.includes('Terziaria') && ARCHIVI_CON_TARIFFA.length === 4);
  const db = conTerziarie();
  const rt = riferimentiTariffa(db.Tariffa.find(t => t.id === 'tK'), { movimenti: { Terziaria: db.Terziaria }, fornitori: db.Fornitore, oggi: '2026-10-14' });
  verifica('una tariffa non da\' il prezzo alle terziarie: non le conta', rt.totale === 0 && J(rt.movimenti_per_archivio) === '{}', J(rt));
  // La tariffa si elimina senza leggere le terziarie: una lettura in meno.
  const lette = { Terziaria: 0 };
  const dbConta = conTerziarie();
  dbConta.Terziaria = new Proxy(dbConta.Terziaria, { get(t, p) { if (p === 'slice' || p === 'filter') lette.Terziaria++; return Reflect.get(t, p); } });
  globalThis.__DB = dbConta; globalThis.__SCRITTE = []; globalThis.__RUOLO = 'admin';
  const via = await conOggi('2026-10-14T10:00:00Z', () => modulo.default({ json: async () => ({ entita: 'Tariffa', operazione: 'delete', id: 'tK' }) }));
  verifica('la tariffa del 2025 di KATANE\' (solo terziarie nel periodo) si elimina, senza leggere le terziarie',
    via.status === 200 && globalThis.__SCRITTE.some(w => w.op === 'delete' && w.id === 'tK') && lette.Terziaria === 0, J({ stato: via.status, lette }));
}

// LA RAGIONE SOCIALE DI UN FORNITORE GIA' USATO NON CAMBIA (revisione del
// 14/10/2026). Dalla scheda Fornitori il nome ora si modifica, e il blocco «con
// movimenti non si elimina» si aggirava rinominandolo: i movimenti portano il
// nome del portale, e col nome nuovo il fornitore non ne aveva piu'. Sui dati
// dell'11/10 BS ECOSERVIZI SRL (373 primarie): rinomina 200 senza storico, poi
// eliminazione 200 senza conferma (gli script del revisore rinomina.mjs e
// rinominaVeri.mjs). La sola rinomina cambiava anche la catena dei
// subfornitori: TORRES GIOVANNI rinominato non fatturava piu' tramite GREEN
// TYRE PROJECT SRL.
console.log('LA RAGIONE SOCIALE DI UN FORNITORE GIA\' USATO NON CAMBIA');
{
  const nome = (db, id) => db.Fornitore.find(x => x.id === id).ragione_sociale;
  const rin = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'update', id: 'fE', dati: { ragione_sociale: 'EMMESSE TRASPORTI SRL' } } });
  verifica('EMMESSE, con movimenti, non si rinomina: 409 con l\'elenco, niente scritto',
    rin.stato === 409 && rin.j.rinominabile === false && rin.j.riferimenti.movimenti === 2 && rin.scritte.length === 0 && nome(rin.db, 'fE') === 'EMMESSE SRL', J(rin.j));
  verifica('il testo, parola per parola',
    rin.j.error === '«EMMESSE SRL» è usato da: 2 tariffe del fornitore; 1 fornitore che fattura tramite lui (NAPPI SUD SRL); 1 voce del foglio della passiva; 1 contratto; 2 primarie di rete terminate che lo nominano. Non si rinomina in «EMMESSE TRASPORTI SRL»: movimenti, tariffe, voci e contratti lo cercano col nome che ha, e col nome nuovo resterebbero senza il loro fornitore. Della ragione sociale si corregge la scrittura (maiuscole, punti, S.R.L.); se è cambiata davvero, aggiungi il fornitore col nome nuovo e disattiva questo, che resta per i conti già fatti.', rin.j.error);
  // La catena del revisore: rinomina, poi eliminazione senza conferma.
  const dopo = await chiama(modulo, { db: rin.db, corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fE' } });
  verifica('e quindi non si elimina dopo: 409, non eliminabile', dopo.stato === 409 && dopo.j.eliminabile === false && eliminati(dopo).length === 0, J(dopo.j));
  // La stessa chiave: si corregge la scrittura, senza leggere i movimenti.
  const lette = { PrimariaRete: 0 };
  const dbConta = DB();
  dbConta.PrimariaRete = new Proxy(dbConta.PrimariaRete, { get(t, p) { if (p === 'slice' || p === 'filter') lette.PrimariaRete++; return Reflect.get(t, p); } });
  globalThis.__DB = dbConta; globalThis.__SCRITTE = []; globalThis.__RUOLO = 'admin';
  const stessa = await modulo.default({ json: async () => ({ entita: 'Fornitore', operazione: 'update', id: 'fE', dati: { ragione_sociale: 'Emmesse S.r.l.' } }) });
  verifica('«Emmesse S.r.l.» e\' la stessa chiave: si scrive, senza leggere i movimenti',
    stessa.status === 200 && globalThis.__SCRITTE.some(w => w.op === 'update' && w.id === 'fE') && lette.PrimariaRete === 0, J({ stato: stessa.status, lette }));
  const libero = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'update', id: 'fZ', dati: { ragione_sociale: 'ZETA LOGISTICA SRL' } } });
  verifica('un fornitore che niente usa ancora (un nome sbagliato appena scritto) si rinomina',
    libero.stato === 200 && nome(libero.db, 'fZ') === 'ZETA LOGISTICA SRL', J(libero.j));
  const tariffa = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'update', id: 'fT', dati: { ragione_sociale: 'TAU SERVIZI SRL' } } });
  verifica('uno con la sola tariffa no: la tariffa lo cerca col nome', tariffa.stato === 409 && tariffa.j.riferimenti.tariffe === 1 && tariffa.scritte.length === 0, J(tariffa.j));
  const spento = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'update', id: 'fS', dati: { ragione_sociale: 'SIGMA ACCESO SRL' } } });
  verifica('a uno gia\' disattivato non si dice di disattivarlo', spento.stato === 409 && /questo, già disattivato, resta per i conti già fatti\.$/.test(spento.j.error) && !/disattiva questo/.test(spento.j.error), spento.j.error);
  // Il doppione si dice prima: e' un rifiuto che non ha bisogno dei movimenti.
  const doppio = await chiama(modulo, { db: DB(), corpo: { entita: 'Fornitore', operazione: 'update', id: 'fZ', dati: { ragione_sociale: 'Emmesse srl' } } });
  verifica('rinominare ZETA come EMMESSE resta il rifiuto del doppione', doppio.stato === 409 && doppio.j.doppione && doppio.j.doppione.id === 'fE', J(doppio.j));
  // Il subfornitore: rinominato, la passiva lo pagava a lui, senza tariffa.
  const catena = DB();
  catena.Fornitore.push({ id: 'fG', ragione_sociale: 'GREEN TYRE PROJECT SRL', stato: 'attivo' },
    { id: 'fTo', ragione_sociale: 'TORRES GIOVANNI', stato: 'attivo', fattura_tramite_id: 'fG', fattura_tramite_nome: 'GREEN TYRE PROJECT SRL' });
  catena.PrimariaRete.push(primaria('TO1', { trasportatore: 'TORRES GIOVANNI', destinazione: 'IRIGOM SRL' }));
  const torres = await chiama(modulo, { db: catena, corpo: { entita: 'Fornitore', operazione: 'update', id: 'fTo', dati: { ragione_sociale: 'TORRES GIOVANNI DITTA INDIVIDUALE' } } });
  const { mappaFatturazione, fatturaA } = await import('../base44/shared/subfornitori.ts');
  const aChi = fatturaA(mappaFatturazione(torres.db.Fornitore), 'TORRES GIOVANNI');
  verifica('TORRES GIOVANNI non si rinomina, e le sue primarie restano fatturate tramite GREEN TYRE PROJECT SRL',
    torres.stato === 409 && /GREEN TYRE PROJECT/.test(J(aChi)), J({ stato: torres.stato, aChi }));
  // Il fornitore che non si legge non si rinomina.
  const rotto = DB();
  let caduta = false;
  rotto.Fornitore = new Proxy(rotto.Fornitore, { get(t, p) {
    if (p === 'find' && !caduta) return () => { caduta = true; throw new Error('errore passeggero'); };
    return Reflect.get(t, p);
  } });
  globalThis.__DB = rotto; globalThis.__SCRITTE = []; globalThis.__RUOLO = 'admin';
  const r = await modulo.default({ json: async () => ({ entita: 'Fornitore', operazione: 'update', id: 'fE', dati: { ragione_sociale: 'EMMESSE TRASPORTI SRL' } }) });
  const jr = await r.json();
  verifica('la lettura cade: errore, e niente scritto', caduta && r.status === 500 && globalThis.__SCRITTE.length === 0 && /non l'ho modificato/.test(jr.error || ''), J({ stato: r.status, jr }));
  const entry = leggi('base44/functions/gestisciAnagrafiche/entry.ts');
  verifica('la regola sta in riferimentiAnagrafica, non nella funzione',
    /siRinomina\(riferimenti\)/.test(entry) && /testoRinomina\(riferimenti, nome\)/.test(entry) && !/\.get\(id\)\.catch\(\(\) => null\)/.test(entry));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
