// L'ANAGRAFICA NON SI SCRIVE DUE VOLTE, E LE TARIFFE PASSIVE HANNO GLI STESSI
// CONTROLLI DELLE ATTIVE (chiusura dell'audit, 11/10/2026). Si prova la funzione
// vera, gestisciAnagrafiche, con l'archivio finto di prove/dati/bancoFunzioni.mjs.
//
// 1. Un fornitore (o un servizio) il cui nome normalizzato c'e' gia' non si
//    crea: in archivio ci sono «GATIM» e «GATIM S.R.L.», per tutto il gestionale
//    lo stesso soggetto, ed e' da quel doppione che e' nato il doppione delle
//    tariffe del 2027. Una modifica che lascia il nome com'e' passa sempre.
// 2. Le tariffe passive dello stesso fornitore scritto in due modi sono in
//    conflitto come per la passiva, che sceglie per nome normalizzato.
// 3. 90 €/kg su una tariffa passiva si fermava solo sulle attive (5.7).
//
// node prove/anagraficheDoppioni.mjs
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const modulo = await caricaFunzione('gestisciAnagrafiche');
const creati = (s, entita) => s.scritte.filter(w => w.op === 'create' && w.entita === entita);

const DB = {
  Fornitore: [
    { id: 'fA', ragione_sociale: 'GATIM', tipo: 'impianto', stato: 'attivo' },
    { id: 'fB', ragione_sociale: 'GATIM S.R.L.', tipo: 'trasportatore', stato: 'attivo' },
    { id: 'fC', ragione_sociale: 'ALFA SRL', tipo: 'trasportatore', stato: 'attivo' },
  ],
  Servizio: [{ id: 's1', nome: 'Raccolta PFU', stato: 'attivo' }],
  Tariffa: [
    { id: 't26', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'TRATTAMENTO', fornitore_id: 'fB', fornitore_nome: 'GATIM S.R.L.', unita_misura: '€/t', valore: 105, stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' },
  ],
};

console.log('1. UN FORNITORE, UN NOME');
{
  const doppio = await chiama(modulo, { db: DB, corpo: { entita: 'Fornitore', operazione: 'create', dati: { ragione_sociale: 'Gatim S.r.l.', tipo: 'impianto' } } });
  verifica('«Gatim S.r.l.» con «GATIM» in archivio: rifiutato con 409', doppio.stato === 409 && /stesso fornitore/.test(doppio.j.error || ''), JSON.stringify(doppio.j));
  verifica('e non si scrive niente', doppio.scritte.length === 0, JSON.stringify(doppio.scritte));
  verifica('la risposta dice quale c\'e\' gia\'', doppio.j.doppione && ['fA', 'fB'].includes(doppio.j.doppione.id), JSON.stringify(doppio.j.doppione));

  const nuovo = await chiama(modulo, { db: DB, corpo: { entita: 'Fornitore', operazione: 'create', dati: { ragione_sociale: 'BETA SRL', tipo: 'impianto' } } });
  verifica('un nome nuovo si crea', nuovo.stato === 200 && creati(nuovo, 'Fornitore').length === 1, JSON.stringify(nuovo.j));

  const vuoto = await chiama(modulo, { db: DB, corpo: { entita: 'Fornitore', operazione: 'create', dati: { ragione_sociale: '  ' } } });
  verifica('senza nome non si crea', vuoto.stato === 400 && vuoto.scritte.length === 0, JSON.stringify(vuoto.j));

  const flag = await chiama(modulo, { db: DB, corpo: { entita: 'Fornitore', operazione: 'update', id: 'fA', dati: { stato: 'non_attivo' } } });
  verifica('cambiare lo stato di GATIM, col doppione ancora in archivio, si puo\'', flag.stato === 200 && flag.scritte.some(w => w.op === 'update' && w.id === 'fA'), JSON.stringify(flag.j));
  const stessoNome = await chiama(modulo, { db: DB, corpo: { entita: 'Fornitore', operazione: 'update', id: 'fA', dati: { ragione_sociale: 'GATIM', interno: false } } });
  verifica('e anche salvarlo col suo nome di sempre', stessoNome.stato === 200, JSON.stringify(stessoNome.j));
  const rinomina = await chiama(modulo, { db: DB, corpo: { entita: 'Fornitore', operazione: 'update', id: 'fC', dati: { ragione_sociale: 'Gatim srl' } } });
  verifica('ma rinominare ALFA in «Gatim srl» no', rinomina.stato === 409 && rinomina.scritte.length === 0, JSON.stringify(rinomina.j));
  // Il doppione si toglie, ma dal 12/10/2026 (A88) prima si guarda chi lo usa:
  // la tariffa t26 punta proprio a GATIM S.R.L. per id. I nomi li prende GATIM,
  // che resta; quel collegamento per id no, e si dice prima di eliminare.
  const fermo = await chiama(modulo, { db: DB, corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fB' } });
  verifica('il doppione con una tariffa che punta a lui: prima di eliminarlo lo si dice', fermo.stato === 409 && fermo.j.richiede_conferma === true
    && fermo.j.riferimenti.tariffe === 1 && fermo.j.riferimenti.gemello && fermo.j.riferimenti.gemello.id === 'fA' && !fermo.scritte.some(w => w.op === 'delete'), JSON.stringify(fermo.j));
  const elimina = await chiama(modulo, { db: DB, corpo: { entita: 'Fornitore', operazione: 'delete', id: 'fB', conferma_eliminazione: true } });
  verifica('e con la conferma il doppione si puo\' togliere', elimina.stato === 200 && elimina.scritte.some(w => w.op === 'delete' && w.id === 'fB'));

  const servizio = await chiama(modulo, { db: DB, corpo: { entita: 'Servizio', operazione: 'create', dati: { nome: 'RACCOLTA PFU' } } });
  verifica('lo stesso per i servizi', servizio.stato === 409 && servizio.scritte.length === 0, JSON.stringify(servizio.j));
}

console.log('2. LE TARIFFE DELLO STESSO FORNITORE SCRITTO IN DUE MODI');
{
  const t27 = { direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'TRATTAMENTO', fornitore_id: 'fA', fornitore_nome: 'GATIM', unita_misura: '€/t', valore: 110, data_inizio_validita: '2026-06-01', data_fine_validita: '2026-12-31', stato: 'attivo' };
  const r = await chiama(modulo, { db: DB, corpo: { entita: 'Tariffa', operazione: 'create', dati: t27 } });
  verifica('un trattamento di «GATIM» sovrapposto a quello di «GATIM S.R.L.»: conflitto (prima contava solo fornitore_id)', r.stato === 409 && creati(r, 'Tariffa').length === 0, JSON.stringify(r.j));
  verifica('e il periodo si dice all\'italiana', /01\/01\/2026 → 31\/12\/2026/.test(r.j.error || ''), r.j.error);
  const dopo = await chiama(modulo, { db: DB, corpo: { entita: 'Tariffa', operazione: 'create', dati: { ...t27, data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31' } } });
  verifica('per il 2027, che non si sovrappone, si salva', dopo.stato === 200 && creati(dopo, 'Tariffa').length === 1, JSON.stringify(dopo.j));
  // la rinegoziazione: una tariffa aperta dello stesso fornitore scritto
  // nell'altro modo si chiude il giorno prima, come quella dello stesso id
  const aperta = { ...DB, Tariffa: [{ ...DB.Tariffa[0], data_fine_validita: '' }] };
  // la tariffa nuova ha la sua fine: dalla prova generale del cambio d'anno
  // (15/10/2026, difetto 7) una rete senza fine al 31/12 non si salva piu'
  const rineg = await chiama(modulo, { db: aperta, corpo: { entita: 'Tariffa', operazione: 'create', dati: t27 } });
  verifica('rinegoziare chiude la tariffa aperta dell\'altra grafia il 31/05', rineg.stato === 200 && rineg.scritte.some(w => w.op === 'update' && w.id === 't26' && w.dati.data_fine_validita === '2026-05-31'), JSON.stringify(rineg.scritte));
  // una tariffa disattivata non e' un conflitto: non vale mai
  const spenta = { ...DB, Tariffa: [{ ...DB.Tariffa[0], stato: 'non_attivo' }] };
  const conSpenta = await chiama(modulo, { db: spenta, corpo: { entita: 'Tariffa', operazione: 'create', dati: t27 } });
  verifica('una tariffa non_attivo non blocca il salvataggio', conSpenta.stato === 200, JSON.stringify(conSpenta.j));
  // una passiva salvata prima che esistesse la direzione e' passiva
  const senzaDirezione = { ...DB, Tariffa: [{ ...DB.Tariffa[0], direzione: undefined }] };
  const r2 = await chiama(modulo, { db: senzaDirezione, corpo: { entita: 'Tariffa', operazione: 'create', dati: t27 } });
  verifica('una tariffa senza direzione conta come passiva', r2.stato === 409, JSON.stringify(r2.j));
}

console.log("3. L'UNITA' DI MISURA ANCHE SULLE PASSIVE");
{
  // con la fine al 31/12 dell'anno, come vuole una rete dal 15/10/2026 (difetto 7)
  const base = { direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_id: 'fC', fornitore_nome: 'ALFA SRL', stato: 'attivo', data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31' };
  const kg = await chiama(modulo, { db: DB, corpo: { entita: 'Tariffa', operazione: 'create', dati: { ...base, unita_misura: '€/kg', valore: 90 } } });
  verifica('90 €/kg su una passiva: errore (90.000 euro a tonnellata)', kg.stato === 400 && /€\/kg/.test(kg.j.error || '') && creati(kg, 'Tariffa').length === 0, JSON.stringify(kg.j));
  const t = await chiama(modulo, { db: DB, corpo: { entita: 'Tariffa', operazione: 'create', dati: { ...base, unita_misura: '€/t', valore: 0.09 } } });
  verifica('0,09 €/t: errore speculare', t.stato === 400 && creati(t, 'Tariffa').length === 0, JSON.stringify(t.j));
  const buona = await chiama(modulo, { db: DB, corpo: { entita: 'Tariffa', operazione: 'create', dati: { ...base, unita_misura: '€/t', valore: 90 } } });
  verifica('90 €/t si salva', buona.stato === 200 && creati(buona, 'Tariffa').length === 1, JSON.stringify(buona.j));
  const viaggio = await chiama(modulo, { db: DB, corpo: { entita: 'Tariffa', operazione: 'create', dati: { ...base, prestazione: 'TRASPORTO_SECONDARIA', tipologia: 'TUTTE', unita_misura: '€/viaggio', valore: 400 } } });
  verifica('400 €/viaggio si salva', viaggio.stato === 200, JSON.stringify(viaggio.j));
  const op = await chiama(modulo, { db: DB, ruolo: 'user', corpo: { entita: 'Fornitore', operazione: 'create', dati: { ragione_sociale: 'GAMMA SRL' } } });
  verifica('e scrive solo l\'amministratore', op.stato !== 200 && op.scritte.length === 0, String(op.stato));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
