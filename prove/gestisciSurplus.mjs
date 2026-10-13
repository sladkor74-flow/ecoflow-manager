// IL SURPLUS SULLE TARIFFE SI SALVA DA gestisciAnagrafiche (13/10/2026).
//
// Richiesta dell'utente del 12/10/2026: un surplus in €/t accanto alle tariffe,
// con le sue date (il Fuel Surcharge del consorzio Ecotyre, +5 €/t dal 01/10 al
// 31/12/2026 su rete, ACI ed extra raccolta). Si prova la funzione vera con
// l'archivio finto di prove/dati/bancoFunzioni.mjs:
//
// 1. solo l'amministratore scrive; gli altri hanno la sola lettura;
// 2. un record per canale, con lo stesso gruppo, ciascuno con la sua traccia
//    nello storico delle modifiche (l'importo ai fornitori riservato);
// 3. i campi che mancano: 400, e nessun canale si scrive se uno e' sbagliato;
// 4. lo stesso surplus negli stessi giorni: 409, come le tariffe;
// 5. il cambio d'importo da una data chiude il surplus di prima il giorno
//    prima, con la sua traccia;
// 6. la modifica e l'eliminazione di tutti i canali insieme (il gruppo);
// 7. i mesi gia' chiusi (attiva approvata, esportata o chiusa, passiva
//    congelata) si dicono con la stima, sul giorno italiano della fine del
//    trasporto, senza riaprire niente (approvata ed esportata dal 13/10/2026,
//    risposta dell'utente);
// 8. un salvataggio che si ferma a meta' dice che cosa ha scritto e che cosa no
//    (e, se si ferma al primo passo, che non ha scritto niente);
// 9. il gruppo della creazione e' quello scritto, anche in cima al payload, e
//    un gruppo ha una riga sola per canale (revisione del 13/10/2026);
// 10. sui dati veri (se la copia c'e'): il Fuel Surcharge vero non tocca mesi
//    chiusi; con settembre chiuso la stima dice i numeri del progetto.
//
// node prove/gestisciSurplus.mjs
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';
import { NOTA_CHIUSO_FUORI } from '../base44/shared/chiusuraMese.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (v) => JSON.stringify(v);
// Una sezione che si ferma per un errore (la funzione di prima, che il surplus
// non lo conosce) conta come fallita e lascia girare le altre.
const sezione = async (titolo, corpo) => {
  console.log(titolo);
  try { await corpo(); } catch (e) { ko++; console.log('  FALLITA: la sezione si e\' fermata: ' + (e && e.message ? e.message : e)); }
};

const modulo = await caricaFunzione('gestisciAnagrafiche');
const scritteDi = (s, entita, op = null) => s.scritte.filter(w => w.entita === entita && (!op || w.op === op));
const registro = (s) => s.db.ModificaDato || [];

const FUEL = {
  nome: 'Fuel Surcharge', origine: 'CONSORZIO', riferimento: 'comunicazione Ecotyre del 30/09/2026', prestazione: 'RACCOLTA', a_chi: 'tutti',
  euro_t_passiva: 5, euro_t_attiva: 5, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31',
};
const crea = (dati, altro = {}) => ({ entita: 'SurplusTariffa', operazione: 'create', dati, ...altro });

await sezione('1. SOLO L\'AMMINISTRATORE SCRIVE UN SURPLUS', async () => {
  for (const corpo of [crea({ ...FUEL, tipologie: ['RETE'] }), { entita: 'SurplusTariffa', operazione: 'update', id: 's1', dati: { euro_t_passiva: 9 } }, { entita: 'SurplusTariffa', operazione: 'delete', gruppo: 'g1' }]) {
    const r = await chiama(modulo, { db: { SurplusTariffa: [{ id: 's1', ...FUEL, tipologia: 'RETE', gruppo: 'g1' }] }, ruolo: 'user', corpo });
    verifica(`${corpo.operazione} di chi non e' amministratore: 403, sola lettura, niente scritto`, r.stato === 403 && r.j.sola_lettura === true && r.scritte.length === 0, J(r));
  }
});

await sezione('2. UN RECORD PER CANALE, LO STESSO GRUPPO, CIASCUNO CON LA SUA TRACCIA', async () => {
  const r = await chiama(modulo, { db: {}, corpo: crea({ ...FUEL, tipologie: ['RETE', 'ACI', 'EXTRA RACCOLTA'] }, { motivo: 'comunicazione del consorzio' }) });
  const creati = scritteDi(r, 'SurplusTariffa', 'create');
  verifica('tre canali: tre record', r.stato === 200 && creati.length === 3, J(r.j));
  verifica('uno per canale, «EXTRA RACCOLTA» scritto come EXTRA_RACCOLTA', J(creati.map(w => w.dati.tipologia)) === J(['RETE', 'ACI', 'EXTRA_RACCOLTA']), J(creati.map(w => w.dati.tipologia)));
  const gruppi = new Set(creati.map(w => w.dati.gruppo));
  verifica('lo stesso gruppo, non vuoto, rimandato nella risposta', gruppi.size === 1 && !!creati[0].dati.gruppo && r.j.gruppo === creati[0].dati.gruppo, J([...gruppi]));
  verifica('i campi del surplus su ogni record, stato attivo e a tutti',
    creati.every(w => w.dati.nome === 'Fuel Surcharge' && w.dati.origine === 'CONSORZIO' && w.dati.prestazione === 'RACCOLTA' && w.dati.euro_t_passiva === 5 && w.dati.euro_t_attiva === 5
      && w.dati.data_inizio_validita === '2026-10-01' && w.dati.data_fine_validita === '2026-12-31' && w.dati.stato === 'attivo' && w.dati.a_chi === 'tutti'), J(creati));
  verifica('nessun campo del payload che non e\' del surplus (tipologie) finisce nel record', creati.every(w => !('tipologie' in w.dati) && !('importi_per_canale' in w.dati)));
  verifica('la risposta porta i tre record', Array.isArray(r.j.result) && r.j.result.length === 3 && r.j.result.every(x => x.id), J(r.j.result));

  const righe = registro(r);
  const ids = r.db.SurplusTariffa.map(x => x.id);
  verifica('ogni record ha le sue righe nello storico (7 campi diversi dal default, per tre)',
    righe.length === 21 && ids.every(id => righe.filter(x => x.record_id === id).length === 7) && r.j.traccia.scritta === true && r.j.traccia.righe === 21, J(righe.map(x => [x.record_id, x.campo])));
  verifica('l\'importo ai fornitori e\' riservato, quello da Ecotyre no',
    righe.filter(x => x.campo === 'euro_t_passiva').length === 3 && righe.filter(x => x.campo === 'euro_t_passiva').every(x => x.riservato === true)
    && righe.filter(x => x.campo === 'euro_t_attiva').every(x => x.riservato === false), J(righe.filter(x => /euro_t/.test(x.campo))));
  verifica('chi, da dove e perche\'', righe.every(x => x.utente === 'prova@prova' && x.origine === 'Tariffe & Anagrafiche' && x.motivo === 'comunicazione del consorzio' && x.operazione === 'create' && x.entita === 'SurplusTariffa'), J(righe[0]));
  verifica('l\'etichetta dice il canale', righe.some(x => x.etichetta === 'Fuel Surcharge · EXTRA RACCOLTA · RACCOLTA · dal 01/10/2026'), J([...new Set(righe.map(x => x.etichetta))]));

  // Gli importi diversi fra i canali, e il modulo che scrive all'italiana.
  const diversi = await chiama(modulo, { db: {}, corpo: crea({ ...FUEL, euro_t_passiva: '5,00', euro_t_attiva: '5,00', data_inizio_validita: '2026-09-30T22:30:00.000Z', tipologie: ['RETE', 'ACI'], importi_per_canale: { ACI: { euro_t_passiva: 4, euro_t_attiva: '4,50' } } }) });
  const per = Object.fromEntries(scritteDi(diversi, 'SurplusTariffa', 'create').map(w => [w.dati.tipologia, w.dati]));
  verifica('«5,00» e\' 5; l\'ACI coi suoi importi', diversi.stato === 200 && per.RETE.euro_t_passiva === 5 && per.RETE.euro_t_attiva === 5 && per.ACI.euro_t_passiva === 4 && per.ACI.euro_t_attiva === 4.5, J(per));
  verifica('le 22:30Z del 30/09 sono il 1° ottobre in Italia', per.RETE.data_inizio_validita === '2026-10-01' && per.ACI.data_inizio_validita === '2026-10-01', J(per.RETE));

  // Un surplus solo passivo (un accordo commerciale che Ecotyre non paga) e'
  // tutto un costo: riservato in ogni riga (campoRiservato, ondata 1).
  const accordo = await chiama(modulo, { db: {}, corpo: crea({ ...FUEL, nome: 'Accordo Gatim', origine: 'ACCORDO_COMMERCIALE', a_chi: 'elenco', fornitori_json: [{ id: 'fG', nome: 'GATIM S.R.L.' }], euro_t_passiva: 2, euro_t_attiva: '', tipologia: 'RETE' }) });
  const suo = scritteDi(accordo, 'SurplusTariffa', 'create');
  verifica('un accordo solo passivo: un record, l\'elenco come JSON, l\'importo da Ecotyre vuoto (non zero)',
    accordo.stato === 200 && suo.length === 1 && suo[0].dati.euro_t_attiva === null && suo[0].dati.fornitori_json === J([{ id: 'fG', nome: 'GATIM S.R.L.' }]), J(suo));
  verifica('e tutte le sue righe nello storico sono riservate', registro(accordo).length > 0 && registro(accordo).every(x => x.riservato === true), J(registro(accordo).map(x => [x.campo, x.riservato])));

  const tutte = await chiama(modulo, { db: {}, corpo: crea({ ...FUEL, tipologie: ['TUTTE'] }) });
  verifica('TUTTE non e\' un canale: 400, e niente scritto', tutte.stato === 400 && tutte.scritte.length === 0 && tutte.j.errori.some(e => e.campo === 'tipologia') && /un canale solo/.test(tutte.j.error), J(tutte.j));
});

await sezione('3. I CAMPI CHE MANCANO: 400, E NESSUN CANALE A META\'', async () => {
  const senza = await chiama(modulo, { db: {}, corpo: crea({ ...FUEL, nome: '  ', data_fine_validita: '', tipologie: ['RETE', 'ACI'] }) });
  verifica('senza nome e senza fine: 400, niente scritto', senza.stato === 400 && senza.scritte.length === 0, J(senza.j));
  const campi = new Set((senza.j.errori || []).map(e => e.campo));
  verifica('gli errori dicono il campo che li causa', campi.has('nome') && campi.has('data_fine_validita'), J(senza.j.errori));
  verifica('la stessa frase su tutti i canali si dice una volta, senza i canali davanti', (senza.j.error.match(/Manca il nome/g) || []).length === 1 && /^Manca il nome/.test(senza.j.error), senza.j.error);
  const senzaImporti = await chiama(modulo, { db: {}, corpo: crea({ ...FUEL, euro_t_passiva: null, euro_t_attiva: '', tipologia: 'RETE' }) });
  verifica('senza nessun importo: 400', senzaImporti.stato === 400 && senzaImporti.j.errori.some(e => e.campo === 'euro_t_passiva') && senzaImporti.scritte.length === 0, J(senzaImporti.j));
  const secondarie = await chiama(modulo, { db: {}, corpo: crea({ ...FUEL, prestazione: 'TRASPORTO_SECONDARIA', tipologia: 'RETE' }) });
  verifica('il trasporto delle secondarie con la parte da Ecotyre: 400', secondarie.stato === 400 && secondarie.j.errori.some(e => e.campo === 'euro_t_attiva'), J(secondarie.j));
  const nel2027 = await chiama(modulo, { db: {}, corpo: crea({ ...FUEL, data_fine_validita: '2027-01-31', tipologia: 'RETE' }) });
  verifica('oltre il 31/12 dell\'anno di inizio: 400 (contratti annuali)', nel2027.stato === 400 && /31\/12\/2026/.test(nel2027.j.error), J(nel2027.j));
  const unoSbagliato = await chiama(modulo, { db: {}, corpo: crea({ ...FUEL, tipologie: ['RETE', 'ACI', 'EXTRA_RACCOLTA'], importi_per_canale: { ACI: { euro_t_passiva: 0, euro_t_attiva: null } } }) });
  verifica('un canale sbagliato ferma anche gli altri due, e la frase dice quale', unoSbagliato.stato === 400 && unoSbagliato.scritte.length === 0 && /^ACI: /.test(unoSbagliato.j.error), J(unoSbagliato.j));
  const nonCe = await chiama(modulo, { db: {}, corpo: { entita: 'SurplusTariffa', operazione: 'update', id: 'manca', dati: { euro_t_passiva: 6 } } });
  verifica('un surplus che non c\'e\': 404, niente scritto', nonCe.stato === 404 && nonCe.scritte.length === 0, J(nonCe.j));
  const idConCanali = await chiama(modulo, { db: { SurplusTariffa: [{ id: 's1', ...FUEL, tipologia: 'RETE', gruppo: 'g1' }] }, corpo: { entita: 'SurplusTariffa', operazione: 'update', id: 's1', dati: { tipologie: ['RETE', 'ACI'] } } });
  verifica('con l\'id un canale solo: tipologie si passano col gruppo', idConCanali.stato === 400 && idConCanali.scritte.length === 0, J(idConCanali.j));
  const statoStrano = await chiama(modulo, { db: {}, corpo: crea({ ...FUEL, stato: 'sospeso', tipologia: 'RETE' }) });
  verifica('uno stato che non esiste: 400 prima di scrivere', statoStrano.stato === 400 && statoStrano.scritte.length === 0 && statoStrano.j.errori.some(e => e.campo === 'stato'), J(statoStrano.j));
  const senzaGruppo = await chiama(modulo, { db: { SurplusTariffa: [{ id: 's1', ...FUEL, tipologia: 'RETE', gruppo: 'g1' }] }, corpo: { entita: 'SurplusTariffa', operazione: 'update', id: 's1', dati: { gruppo: '', euro_t_attiva: 6 } } });
  verifica('un gruppo vuoto nel payload non toglie il record dal suo surplus', senzaGruppo.stato === 200 && J(scritteDi(senzaGruppo, 'SurplusTariffa', 'update')[0].dati) === J({ euro_t_attiva: 6 }), J(senzaGruppo.scritte));
  const senzaChi = await chiama(modulo, { db: {}, corpo: { entita: 'SurplusTariffa', operazione: 'delete' } });
  verifica('eliminare senza id ne\' gruppo: 400', senzaChi.stato === 400 && senzaChi.scritte.length === 0, J(senzaChi.j));
});

await sezione('4. LO STESSO SURPLUS NEGLI STESSI GIORNI: 409', async () => {
  const DB = { SurplusTariffa: [{ id: 'sR', ...FUEL, tipologia: 'RETE', gruppo: 'g0', stato: 'attivo' }] };
  const dentro = await chiama(modulo, { db: DB, corpo: crea({ ...FUEL, data_inizio_validita: '2026-10-15', data_fine_validita: '2026-11-30', tipologia: 'RETE' }) });
  verifica('il Fuel Surcharge dentro quello che c\'e\': 409, niente scritto', dentro.stato === 409 && dentro.scritte.length === 0 && dentro.j.conflitto.id === 'sR', J(dentro.j));
  verifica('il messaggio dice il canale, la prestazione, il periodo all\'italiana e il perche\'',
    /Sul canale rete, per la raccolta, c'è già Fuel Surcharge \(consorzio Ecotyre\), dal 01\/10\/2026 al 31\/12\/2026/.test(dentro.j.error) && /si pagherebbe due volte/.test(dentro.j.error), dentro.j.error);
  const dueCanali = await chiama(modulo, { db: DB, corpo: crea({ ...FUEL, tipologie: ['ACI', 'RETE'] }) });
  verifica('rete in conflitto: nemmeno l\'ACI si scrive', dueCanali.stato === 409 && dueCanali.scritte.length === 0 && dueCanali.j.canale === 'RETE', J(dueCanali.j));
  const aci = await chiama(modulo, { db: DB, corpo: crea({ ...FUEL, tipologia: 'ACI' }) });
  verifica('lo stesso surplus sull\'ACI non e\' un conflitto: i canali non si sommano', aci.stato === 200 && scritteDi(aci, 'SurplusTariffa', 'create').length === 1, J(aci.j));
  const accordo = await chiama(modulo, { db: DB, corpo: crea({ ...FUEL, nome: 'Accordo Gatim', origine: 'ACCORDO_COMMERCIALE', a_chi: 'elenco', fornitori_json: [{ id: 'fG', nome: 'GATIM S.R.L.' }], euro_t_passiva: 2, euro_t_attiva: null, tipologia: 'RETE' }) });
  verifica('un surplus con un altro nome sulle stesse tonnellate: si salva, con l\'avviso', accordo.stato === 200 && (accordo.j.avvisi || []).some(a => /si applicano tutti e due/.test(a)), J(accordo.j));
  const spento = await chiama(modulo, { db: { SurplusTariffa: [{ ...DB.SurplusTariffa[0], stato: 'non_attivo' }] }, corpo: crea({ ...FUEL, tipologia: 'RETE' }) });
  verifica('un surplus disattivato non e\' un conflitto: non vale mai', spento.stato === 200, J(spento.j));
  const modifica = await chiama(modulo, { db: { SurplusTariffa: [...DB.SurplusTariffa, { id: 'sR2', ...FUEL, tipologia: 'RETE', gruppo: 'g9', data_inizio_validita: '2026-07-01', data_fine_validita: '2026-09-30' }] }, corpo: { entita: 'SurplusTariffa', operazione: 'update', id: 'sR2', dati: { data_fine_validita: '2026-10-31' } } });
  verifica('allungare un surplus sopra un altro uguale: 409, niente scritto', modifica.stato === 409 && modifica.scritte.length === 0 && modifica.j.conflitto.id === 'sR', J(modifica.j));
  const seStesso = await chiama(modulo, { db: DB, corpo: { entita: 'SurplusTariffa', operazione: 'update', id: 'sR', dati: { euro_t_attiva: 7 } } });
  verifica('un surplus non e\' in conflitto con se stesso', seStesso.stato === 200 && scritteDi(seStesso, 'SurplusTariffa', 'update').length === 1, J(seStesso.j));
  const riga = registro(seStesso).find(x => x.campo === 'euro_t_attiva');
  verifica('e la modifica si registra: 5 → 7, non riservato', riga && riga.prima === '5' && riga.dopo === '7' && riga.riservato === false && riga.record_id === 'sR', J(registro(seStesso)));
  const costo = await chiama(modulo, { db: DB, corpo: { entita: 'SurplusTariffa', operazione: 'update', id: 'sR', dati: { euro_t_passiva: 6 } } });
  verifica('l\'importo ai fornitori cambiato: riga riservata', registro(costo).length === 1 && registro(costo)[0].campo === 'euro_t_passiva' && registro(costo)[0].riservato === true, J(registro(costo)));
});

await sezione('5. IL CAMBIO D\'IMPORTO DA UNA DATA CHIUDE IL SURPLUS DI PRIMA IL GIORNO PRIMA', async () => {
  const DB = { SurplusTariffa: [{ id: 'sR', ...FUEL, tipologia: 'RETE', gruppo: 'g0', stato: 'attivo' }] };
  const r = await chiama(modulo, { db: DB, corpo: crea({ ...FUEL, euro_t_passiva: 6, euro_t_attiva: 6, data_inizio_validita: '2026-11-01', tipologia: 'RETE' }, { motivo: 'nuova comunicazione' }) });
  const chiusura = scritteDi(r, 'SurplusTariffa', 'update');
  verifica('il Fuel Surcharge a 6 €/t dal 01/11: quello a 5 si chiude il 31/10', r.stato === 200 && chiusura.length === 1 && chiusura[0].id === 'sR' && J(chiusura[0].dati) === J({ data_fine_validita: '2026-10-31' }), J(r.scritte));
  verifica('e il nuovo si scrive dopo la chiusura', r.scritte.findIndex(w => w.op === 'update' && w.entita === 'SurplusTariffa') < r.scritte.findIndex(w => w.op === 'create' && w.entita === 'SurplusTariffa'), J(r.scritte.map(w => w.op + ' ' + w.entita)));
  verifica('la risposta lo dice', J(r.j.surplus_chiusi) === J([{ id: 'sR', gruppo: 'g0', nome: 'Fuel Surcharge', tipologia: 'RETE', data_fine_validita: '2026-10-31', euro_t_passiva: 5, euro_t_attiva: 5 }]), J(r.j.surplus_chiusi));
  const riga = registro(r).find(x => x.record_id === 'sR');
  verifica('la chiusura ha la sua riga nello storico, col perche\'', riga && riga.campo === 'data_fine_validita' && riga.prima === '2026-12-31' && riga.dopo === '2026-10-31'
    && riga.motivo === 'chiuso dal surplus nuovo che vale dal 01/11/2026: nuova comunicazione', J(riga));
  // Uno che finisce prima di quello di prima non e' un cambio d'importo: e' un buco a dicembre.
  const buco = await chiama(modulo, { db: DB, corpo: crea({ ...FUEL, euro_t_passiva: 6, data_inizio_validita: '2026-11-01', data_fine_validita: '2026-11-30', tipologia: 'RETE' }) });
  verifica('il nuovo che finisce prima di quello di prima: conflitto, non chiusura', buco.stato === 409 && buco.scritte.length === 0, J(buco.j));
});

await sezione('6. TUTTI I CANALI INSIEME: IL GRUPPO', async () => {
  const tre = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map((c, i) => ({ id: `s${i}`, ...FUEL, tipologia: c, gruppo: 'g1', stato: 'attivo' }));
  const accorcia = await chiama(modulo, { db: { SurplusTariffa: tre }, corpo: { entita: 'SurplusTariffa', operazione: 'update', gruppo: 'g1', dati: { data_fine_validita: '2026-11-30' } } });
  verifica('la fine cambiata sul gruppo: tre modifiche', accorcia.stato === 200 && scritteDi(accorcia, 'SurplusTariffa', 'update').length === 3
    && scritteDi(accorcia, 'SurplusTariffa', 'update').every(w => J(w.dati) === J({ data_fine_validita: '2026-11-30' })), J(accorcia.scritte));
  verifica('ognuna con la sua riga', registro(accorcia).length === 3 && new Set(registro(accorcia).map(x => x.record_id)).size === 3, J(registro(accorcia)));
  const togli = await chiama(modulo, { db: { SurplusTariffa: tre }, corpo: { entita: 'SurplusTariffa', operazione: 'update', gruppo: 'g1', dati: { tipologie: ['RETE', 'ACI'] } } });
  verifica('tolta l\'extra raccolta: si elimina il suo record, e gli altri due non si riscrivono',
    togli.stato === 200 && J(togli.scritte.filter(w => w.entita === 'SurplusTariffa')) === J([{ op: 'delete', entita: 'SurplusTariffa', id: 's2' }]), J(togli.scritte));
  verifica('con la sua traccia e il perche\'', registro(togli).length > 0 && registro(togli).every(x => x.operazione === 'delete' && x.record_id === 's2' && x.motivo === 'canale tolto dal surplus'), J(registro(togli)));
  const soloRete = [tre[0]];
  const aggiungi = await chiama(modulo, { db: { SurplusTariffa: soloRete }, corpo: { entita: 'SurplusTariffa', operazione: 'update', gruppo: 'g1', dati: { tipologie: ['RETE', 'ACI'], importi_per_canale: { ACI: { euro_t_passiva: 4 } } } } });
  const nuovo = scritteDi(aggiungi, 'SurplusTariffa', 'create');
  verifica('aggiunta l\'ACI: un record nuovo nello stesso gruppo, col surplus della rete e il suo importo',
    aggiungi.stato === 200 && nuovo.length === 1 && nuovo[0].dati.tipologia === 'ACI' && nuovo[0].dati.gruppo === 'g1' && nuovo[0].dati.nome === 'Fuel Surcharge'
    && nuovo[0].dati.euro_t_passiva === 4 && nuovo[0].dati.euro_t_attiva === 5 && nuovo[0].dati.data_fine_validita === '2026-12-31' && !('id' in nuovo[0].dati), J(nuovo));
  const tutto = await chiama(modulo, { db: { SurplusTariffa: tre }, corpo: { entita: 'SurplusTariffa', operazione: 'delete', gruppo: 'g1', motivo: 'scritto per errore' } });
  verifica('eliminare il gruppo elimina i tre canali, ciascuno con la sua traccia',
    tutto.stato === 200 && scritteDi(tutto, 'SurplusTariffa', 'delete').length === 3 && (tutto.db.SurplusTariffa || []).length === 0
    && new Set(registro(tutto).map(x => x.record_id)).size === 3 && registro(tutto).every(x => x.operazione === 'delete' && x.motivo === 'scritto per errore'), J(tutto.j));
  const niente = await chiama(modulo, { db: { SurplusTariffa: tre }, corpo: { entita: 'SurplusTariffa', operazione: 'update', gruppo: 'g1', dati: { nome: 'Fuel Surcharge', euro_t_passiva: 5 } } });
  verifica('una modifica che non cambia niente non scrive niente', niente.stato === 200 && niente.scritte.length === 0, J(niente.scritte));
  const doppio = await chiama(modulo, { db: { SurplusTariffa: [...tre, { id: 's9', ...FUEL, tipologia: 'RETE', gruppo: 'g1', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-03-31' }] }, corpo: { entita: 'SurplusTariffa', operazione: 'update', gruppo: 'g1', dati: { euro_t_passiva: 6 } } });
  verifica('due righe sullo stesso canale nel gruppo: si modificano una per una', doppio.stato === 400 && doppio.scritte.length === 0, J(doppio.j));
  const vuoto = await chiama(modulo, { db: { SurplusTariffa: tre }, corpo: { entita: 'SurplusTariffa', operazione: 'update', gruppo: 'g1', dati: { tipologie: [] } } });
  verifica('nessun canale: 400, per togliere tutto si elimina', vuoto.stato === 400 && vuoto.scritte.length === 0, J(vuoto.j));
});

await sezione('7. I MESI GIA\' CHIUSI SI DICONO, CON LA STIMA, E NON SI RIAPRE NIENTE', async () => {
  // Ottobre 2026 sulla rete: l'attiva e' chiusa (fattura 123/2026) e la passiva
  // congelata. Le righe del documento: 10 t finite alle 23:30 italiane del
  // 14/10, 20 t alle 00:30 italiane del 15/10, 30 t il 20/10; una riga a corpo
  // e una di un surplus, che non sono formulari; una riga di un altro documento.
  const ottobre = {
    DocumentoFatturazione: [
      { id: 'dR10', tipo: 'ATTIVA', tipologia: 'RETE', anno: 2026, mese: 'Ottobre', stato: 'chiusa', fattura_numero: '123/2026', data_elaborazione: '2026-11-03T10:00:00Z' },
      { id: 'dR10vecchio', tipo: 'ATTIVA', tipologia: 'RETE', anno: 2026, mese: 'Ottobre', stato: 'approvata', superato: true, data_elaborazione: '2026-11-01T10:00:00Z' },
    ],
    VoceFatturazione: [
      { id: 'v1', documento_id: 'dR10', tipologia: 'RETE', quantita: 10000, unita_misura: '€/t', data_fine_trasporto: '2026-10-14T21:30:00.000Z' },
      { id: 'v2', documento_id: 'dR10', tipologia: 'RETE', quantita: 20000, unita_misura: '€/t', data_fine_trasporto: '2026-10-14T22:30:00.000Z' },
      { id: 'v3', documento_id: 'dR10', tipologia: 'RETE', quantita: 30000, unita_misura: '€/t', data_fine_trasporto: '2026-10-20T08:00:00.000Z' },
      { id: 'v4', documento_id: 'dR10', tipologia: 'RETE', quantita: 5000, unita_misura: '€ a corpo', data_fine_trasporto: '2026-10-20T08:00:00.000Z' },
      { id: 'v5', documento_id: 'dR10', tipologia: 'RETE', quantita: 0, surplus_id: 'altro', origine_dato: 'SURPLUS', kg_riferimento: 60000, data_fine_trasporto: null },
      { id: 'v6', documento_id: 'dR10vecchio', tipologia: 'RETE', quantita: 99000, unita_misura: '€/t', data_fine_trasporto: '2026-10-20T08:00:00.000Z' },
    ],
    ChiusuraPassivaMese: [{
      id: 'cR10', anno: 2026, mese: 10, canale: 'RETE', congelato_il: '2026-11-05T09:00:00Z', totale_euro: 1000,
      passiva_json: J({
        raccoglitori: [
          { fornitore: 'GREEN TYRE PROJECT SRL', interno: false, totale_tonnellate: 100, righe: [], di_cui: [] },
          { fornitore: 'SMOCO S.R.L.', interno: true, totale_tonnellate: 50, righe: [], di_cui: [] },
          { fornitore: 'GATIM S.R.L.', interno: false, totale_tonnellate: 10.005, righe: [], di_cui: [] },
        ],
        impianti_stoccaggi: [{ fornitore: 'IRIGOM S.R.L.', interno: false, totale_tonnellate: 70, righe: [{ prestazione: 'TRATTAMENTO', tonnellate: 70 }] }],
        trasporti_secondaria: [],
      }),
    }],
  };
  const dal15 = await chiama(modulo, { db: ottobre, corpo: crea({ ...FUEL, data_inizio_validita: '2026-10-15', tipologia: 'RETE' }) });
  const m = (dal15.j.mesi_chiusi || [])[0] || {};
  verifica('un surplus dal 15/10 con ottobre chiuso: si salva, e la risposta lo dice', dal15.stato === 200 && scritteDi(dal15, 'SurplusTariffa', 'create').length === 1 && (dal15.j.mesi_chiusi || []).length === 1
    && m.anno === 2026 && m.mese === 10 && m.mese_nome === 'Ottobre' && m.canale === 'RETE', J(dal15.j));
  verifica('attiva: 50 t dal giorno italiano 15/10 (le 22:30Z del 14 si', m.attiva && m.attiva.stato === 'chiusa' && m.attiva.fattura_numero === '123/2026'
    && m.attiva.dopo.tonnellate === 50 && m.attiva.dopo.euro === 250 && m.attiva.prima.euro === 0 && m.attiva.differenza === 250 && m.attiva.stima === 'esatta', J(m.attiva));
  // Il conto congelato non ha i giorni: dal 15 al 31 sono 17 giorni su 31.
  // GREEN TYRE 100 t -> 54.839 kg -> 274,20 €; GATIM 10,005 t -> 5.487 kg ->
  // 27,44 €; SMOCO, interno, niente.
  verifica('passiva: i raccoglitori esterni del conto congelato, SMOCO no, al centesimo per fornitore, in proporzione ai 17 giorni su 31',
    m.passiva && m.passiva.stato === 'congelata' && m.passiva.dopo.tonnellate === 60.326 && m.passiva.dopo.euro === 301.64 && m.passiva.differenza === 301.64 && m.passiva.stima === 'in_proporzione', J(m.passiva));
  verifica('la frase, all\'italiana', m.messaggio === 'Ottobre 2026, rete: la fatturazione attiva è chiusa (fattura 123/2026): il surplus vale 250,00 € da Ecotyre (50,00 t a 5,00 €/t); la passiva è congelata dal 05/11/2026: il surplus vale 301,64 € ai fornitori (60,326 t a 5,00 €/t) (stima in proporzione ai giorni del mese). Il gestionale non riapre niente da solo: la differenza si gestisce a parte.', m.messaggio);
  verifica('ed e\' fra gli avvisi', (dal15.j.avvisi || []).includes(m.messaggio), J(dal15.j.avvisi));
  verifica('niente riaperto: nessuna scrittura su documenti, righe e congelati', !dal15.scritte.some(w => ['DocumentoFatturazione', 'VoceFatturazione', 'ChiusuraPassivaMese'].includes(w.entita)), J(dal15.scritte));

  const dal1 = await chiama(modulo, { db: ottobre, corpo: crea({ ...FUEL, tipologia: 'RETE' }) });
  const m1 = dal1.j.mesi_chiusi[0];
  verifica('dal 01/10: 60 t nell\'attiva, e la passiva esatta (500,00 + 50,03: il centesimo per fornitore)', m1.attiva.dopo.tonnellate === 60 && m1.attiva.dopo.euro === 300 && m1.passiva.stima === 'esatta'
    && m1.passiva.dopo.tonnellate === 110.005 && m1.passiva.dopo.euro === 550.03, J(m1));

  // Il cambio d'importo a meta' ottobre, con ottobre chiuso: quello a 5 €/t si
  // chiude il 14, quello a 6 vale dal 15. Nell'attiva i giorni ci sono: 10 t a
  // 5 e 50 t a 6, cioe' 350,00 invece di 300,00. Nella passiva i due si
  // dividono il mese (14 e 17 giorni), senza contarlo due volte.
  const conCinque = { ...ottobre, SurplusTariffa: [{ id: 'sR', ...FUEL, tipologia: 'RETE', gruppo: 'g0', stato: 'attivo' }] };
  const cambio = await chiama(modulo, { db: conCinque, corpo: crea({ ...FUEL, euro_t_passiva: 6, euro_t_attiva: 6, data_inizio_validita: '2026-10-15', tipologia: 'RETE' }) });
  const mc = (cambio.j.mesi_chiusi || [])[0] || {};
  verifica('6 €/t dal 15/10: quello a 5 si chiude il 14/10', cambio.stato === 200 && cambio.j.surplus_chiusi && cambio.j.surplus_chiusi[0].data_fine_validita === '2026-10-14', J(cambio.j.surplus_chiusi));
  verifica('attiva di ottobre: da 300,00 a 350,00 (+50,00), sui giorni', mc.attiva && mc.attiva.prima.euro === 300 && mc.attiva.dopo.euro === 350 && mc.attiva.differenza === 50 && mc.attiva.stima === 'esatta' && mc.attiva.dopo.euro_t === null, J(mc.attiva));
  const quota = (t, giorni) => Math.round(t * 1000 * giorni / 31);
  const centesimo = (kg, e) => Math.round(Number((kg * e / 1000 * 100).toPrecision(15))) / 100;
  const attesa = [[100, 14, 5], [10.005, 14, 5], [100, 17, 6], [10.005, 17, 6]].reduce((s, [t, g, e]) => s + centesimo(quota(t, g), e), 0);
  verifica('passiva di ottobre: i due surplus si dividono il mese, e il totale non e\' contato due volte', mc.passiva && mc.passiva.prima.euro === 550.03
    && Math.abs(mc.passiva.dopo.euro - attesa) < 0.005 && mc.passiva.dopo.tonnellate === 110.005 && mc.passiva.stima === 'in_proporzione', J(mc.passiva) + ' atteso ' + attesa);

  const prima = await chiama(modulo, { db: ottobre, corpo: crea({ ...FUEL, tipologia: 'RETE' }, { anteprima: true }) });
  verifica('in anteprima: gli stessi mesi, e niente scritto', prima.stato === 200 && prima.j.anteprima === true && prima.scritte.length === 0 && J(prima.j.mesi_chiusi) === J(dal1.j.mesi_chiusi)
    && J(prima.j.piano) === J([{ operazione: 'create', id: null, tipologia: 'RETE' }]), J(prima.j));

  const conIlSurplus = { ...ottobre, SurplusTariffa: [{ id: 'sR', ...FUEL, tipologia: 'RETE', gruppo: 'g0', stato: 'attivo', data_inizio_validita: '2026-10-15' }] };
  const sei = await chiama(modulo, { db: conIlSurplus, corpo: { entita: 'SurplusTariffa', operazione: 'update', id: 'sR', dati: { euro_t_attiva: 6, euro_t_passiva: 6 } } });
  const ms = sei.j.mesi_chiusi[0];
  verifica('da 5 a 6 €/t su ottobre chiuso: la differenza', sei.stato === 200 && ms.attiva.prima.euro === 250 && ms.attiva.dopo.euro === 300 && ms.attiva.differenza === 50
    && /il surplus da Ecotyre passa da 250,00 € a 300,00 € \(\+50,00 €\)/.test(ms.messaggio), J(ms));
  const nota = await chiama(modulo, { db: conIlSurplus, corpo: { entita: 'SurplusTariffa', operazione: 'update', id: 'sR', dati: { riferimento: 'comunicazione del 02/10/2026', note: 'vedi email' } } });
  verifica('cambiare il riferimento non cambia nessun conto: nessun mese, nessun avviso', nota.stato === 200 && !nota.j.mesi_chiusi && !nota.j.avvisi, J(nota.j));
  const fine = await chiama(modulo, { db: conIlSurplus, corpo: { entita: 'SurplusTariffa', operazione: 'update', id: 'sR', dati: { data_fine_validita: '2026-11-30' } } });
  verifica('accorciarlo a novembre non tocca ottobre', fine.stato === 200 && !fine.j.mesi_chiusi, J(fine.j));
  const via = await chiama(modulo, { db: conIlSurplus, corpo: { entita: 'SurplusTariffa', operazione: 'delete', id: 'sR' } });
  verifica('eliminarlo: ottobre perde il surplus, e si dice', via.stato === 200 && via.j.mesi_chiusi[0].attiva.differenza === -250 && /il surplus di 250,00 € da Ecotyre non vale più/.test(via.j.mesi_chiusi[0].messaggio), J(via.j));
  const aci = await chiama(modulo, { db: ottobre, corpo: crea({ ...FUEL, tipologia: 'ACI' }) });
  verifica('ottobre chiuso sulla rete non riguarda l\'ACI', aci.stato === 200 && !aci.j.mesi_chiusi, J(aci.j));
  const elenco = await chiama(modulo, { db: ottobre, corpo: crea({ ...FUEL, nome: 'Accordo Gatim', origine: 'ACCORDO_COMMERCIALE', a_chi: 'elenco', fornitori_json: [{ id: 'fG', nome: 'GATIM' }], tipologia: 'RETE' }) });
  const me = elenco.j.mesi_chiusi[0];
  verifica('solo Gatim: nella passiva le sue 10,005 t (50,03 €), nell\'attiva una stima per eccesso', me.passiva.dopo.euro === 50.03 && me.passiva.stima === 'esatta' && me.attiva.stima === 'per_eccesso', J(me));
  const trattamento = await chiama(modulo, { db: ottobre, corpo: crea({ ...FUEL, nome: 'Accordo Irigom', origine: 'ACCORDO_COMMERCIALE', prestazione: 'TRATTAMENTO', euro_t_attiva: null, euro_t_passiva: 3, tipologia: 'RETE' }) });
  const mt = trattamento.j.mesi_chiusi[0];
  verifica('un surplus sul trattamento solo passivo: le righe di trattamento degli impianti, e l\'attiva non c\'entra', mt.passiva.dopo.tonnellate === 70 && mt.passiva.dopo.euro === 210 && mt.attiva === null, J(mt));
  const illeggibile = await chiama(modulo, { db: { ...ottobre, ChiusuraPassivaMese: [{ ...ottobre.ChiusuraPassivaMese[0], passiva_json: '@parti:2' }] }, corpo: crea({ ...FUEL, tipologia: 'RETE' }) });
  verifica('un conto congelato che non si legge: il mese si dice lo stesso, senza importo', illeggibile.stato === 200 && illeggibile.j.mesi_chiusi[0].passiva.stima === 'non_stimabile'
    && /il conto congelato non si legge/.test(illeggibile.j.mesi_chiusi[0].messaggio), J(illeggibile.j.mesi_chiusi));
  // Un conto congelato lungo sta a pezzi in ContenutoEsteso (shared/testoLungo.ts): si ricompone.
  const testo = ottobre.ChiusuraPassivaMese[0].passiva_json;
  const meta = Math.ceil(testo.length / 2);
  const aPezzi = await chiama(modulo, {
    db: {
      ...ottobre,
      ChiusuraPassivaMese: [{ ...ottobre.ChiusuraPassivaMese[0], passiva_json: '@parti:2' }],
      ContenutoEsteso: [testo.slice(0, meta), testo.slice(meta)].map((t, i) => ({ id: `ce${i}`, entita: 'ChiusuraPassivaMese', record_id: 'cR10', campo: 'passiva_json', parte: i + 1, totale: 2, testo: t })),
    },
    corpo: crea({ ...FUEL, tipologia: 'RETE' }),
  });
  verifica('un conto congelato a pezzi si ricompone, e la stima e\' la stessa', aPezzi.stato === 200 && aPezzi.j.mesi_chiusi[0].passiva.dopo.euro === 550.03, J(aPezzi.j.mesi_chiusi));
  const fuori = await chiama(modulo, {
    db: { DocumentoFatturazione: [{ id: 'dS9', tipo: 'ATTIVA', tipologia: 'RETE', anno: 2026, mese: 'Agosto', stato: 'chiusa', note: NOTA_CHIUSO_FUORI }] },
    corpo: crea({ ...FUEL, data_inizio_validita: '2026-08-01', data_fine_validita: '2026-08-31', tipologia: 'RETE' }),
  });
  verifica('agosto, fatturato fuori dal gestionale: si dice, senza stima', fuori.stato === 200 && fuori.j.mesi_chiusi[0].attiva.stima === 'non_stimabile' && /fatturato fuori dal gestionale/.test(fuori.j.mesi_chiusi[0].messaggio), J(fuori.j.mesi_chiusi));
  // L'attiva approvata o esportata e' gia' fatturata anche se non e' chiusa
  // (risposta dell'utente del 13/10/2026): l'avviso scatta, con lo stato vero e
  // la stessa stima; elaborata o verificata no, si rielabora e il surplus entra.
  for (const stato of ['esportata', 'approvata']) {
    const r = await chiama(modulo, { db: { ...ottobre, DocumentoFatturazione: [{ ...ottobre.DocumentoFatturazione[0], stato, fattura_numero: '' }], ChiusuraPassivaMese: [] }, corpo: crea({ ...FUEL, tipologia: 'RETE' }) });
    const x = (r.j.mesi_chiusi || [])[0] || {};
    verifica(`un documento ${stato} ma non chiuso: il mese e' gia' fatturato, e si dice con la stima (60,00 t, 300,00 €)`, r.stato === 200 && (r.j.mesi_chiusi || []).length === 1
      && x.attiva && x.attiva.stato === stato && x.attiva.dopo.euro === 300 && x.attiva.dopo.tonnellate === 60 && x.attiva.stima === 'esatta' && x.passiva === null, J(r.j));
    verifica(`...la frase dice «${stato}» e che rielaborando, se la fattura non e' emessa, il surplus entra`,
      x.messaggio === `Ottobre 2026, rete: la fatturazione attiva è ${stato}: il surplus vale 300,00 € da Ecotyre (60,00 t a 5,00 €/t). Il gestionale non riapre niente da solo: la differenza si gestisce a parte. Se la fattura a Ecotyre non è ancora emessa, rielaborando il mese il surplus entra nel documento.`
      && (r.j.avvisi || []).includes(x.messaggio), x.messaggio);
    verifica(`...e in anteprima si ferma per la conferma, senza scrivere`, await chiama(modulo, { db: { ...ottobre, DocumentoFatturazione: [{ ...ottobre.DocumentoFatturazione[0], stato }], ChiusuraPassivaMese: [] }, corpo: crea({ ...FUEL, tipologia: 'RETE' }, { anteprima: true }) })
      .then(p => p.stato === 200 && p.scritte.length === 0 && (p.j.mesi_chiusi || []).length === 1));
  }
  for (const stato of ['elaborata', 'verificata']) {
    const r = await chiama(modulo, { db: { ...ottobre, DocumentoFatturazione: [{ ...ottobre.DocumentoFatturazione[0], stato }], ChiusuraPassivaMese: [] }, corpo: crea({ ...FUEL, tipologia: 'RETE' }) });
    verifica(`un documento ${stato} non e' ancora fatturato: niente da dire`, r.stato === 200 && !r.j.mesi_chiusi, J(r.j));
  }
  // chiusa resta come prima: la frase senza la riga della rielaborazione
  verifica('chiusa: la frase di prima, senza «rielaborando»', !/rielaborando/.test(m.messaggio) && /la fatturazione attiva è chiusa \(fattura 123\/2026\)/.test(m.messaggio), m.messaggio);
});

await sezione('8. UN SALVATAGGIO CHE SI FERMA A META\' DICE CHE COSA HA SCRITTO', async () => {
  // La seconda creazione non riesce (il limite di richieste, per esempio): la
  // rete e' scritta, l'ACI no, e la risposta lo dice col gruppo per riprovare.
  globalThis.__DB = {};
  const archivio = [];
  let creazioni = 0;
  archivio.push = function (...x) { if (++creazioni > 1) throw new Error('limite di richieste'); return Array.prototype.push.apply(this, x); };
  globalThis.__DB.SurplusTariffa = archivio;
  globalThis.__SCRITTE = [];
  globalThis.__RUOLO = 'admin';
  const risposta = await modulo.default({ json: async () => crea({ ...FUEL, tipologie: ['RETE', 'ACI'] }) });
  const j = await risposta.json();
  verifica('500, con quello che e\' stato fatto e quello che no', risposta.status === 500 && /salvato solo in parte/.test(j.error) && /Fatto: creato sul canale rete/.test(j.error)
    && /Non riuscito: la creazione sul canale ACI \(limite di richieste\)/.test(j.error), J(j));
  verifica('il gruppo per riprovare e la traccia di quello scritto', j.gruppo && archivio[0].gruppo === j.gruppo && j.traccia && j.traccia.righe === 7, J(j));
  // Si riprova quello che manca col gruppo della risposta, in cima al payload
  // come per update e delete: l'ACI entra nello stesso surplus, e la risposta
  // dice quel gruppo (revisione del 13/10/2026: finiva in un gruppo nuovo).
  const riprova = await chiama(modulo, { db: { SurplusTariffa: [{ ...archivio[0] }] }, corpo: crea({ ...FUEL, tipologia: 'ACI' }, { gruppo: j.gruppo }) });
  const aci = (riprova.db.SurplusTariffa || []).find(x => x.tipologia === 'ACI');
  verifica('riprovato l\'ACI col gruppo della risposta: entra nello stesso surplus', riprova.stato === 200 && aci && aci.gruppo === j.gruppo && riprova.j.gruppo === j.gruppo, J({ risposta: riprova.j.gruppo, scritto: aci && aci.gruppo, atteso: j.gruppo }));

  // La prima scrittura non riesce: non c'e' niente di salvato, e la frase lo
  // dice (revisione del 13/10/2026: diceva «salvato solo in parte»).
  globalThis.__DB = {};
  const vuoto = [];
  vuoto.push = function () { throw new Error('limite di richieste'); };
  globalThis.__DB.SurplusTariffa = vuoto;
  globalThis.__SCRITTE = [];
  globalThis.__RUOLO = 'admin';
  const niente = await modulo.default({ json: async () => crea({ ...FUEL, tipologia: 'RETE' }) });
  const jn = await niente.json();
  verifica('la prima creazione non riesce: la frase dice che non e\' stato salvato niente, non «in parte»',
    niente.status === 500 && jn.error === 'Il surplus non è stato salvato: non è stato scritto niente. Non riuscito: la creazione sul canale rete (limite di richieste). Riprova.'
    && J(jn.fatti) === '[]' && vuoto.length === 0 && globalThis.__SCRITTE.length === 0, J(jn));
  // Lo stesso quando non riesce la chiusura del surplus di prima, che si
  // scrive per prima: niente chiuso, niente creato.
  globalThis.__DB = { SurplusTariffa: [{ id: 'sR', ...FUEL, tipologia: 'RETE', gruppo: 'g0', stato: 'attivo' }] };
  globalThis.__DB.SurplusTariffa.findIndex = function () { throw new Error('limite di richieste'); };
  globalThis.__SCRITTE = [];
  const chiusura = await modulo.default({ json: async () => crea({ ...FUEL, euro_t_passiva: 6, euro_t_attiva: 6, data_inizio_validita: '2026-11-01', tipologia: 'RETE' }) });
  const jc = await chiusura.json();
  verifica('la chiusura di quello di prima non riesce: non e\' stato salvato niente, e la frase lo dice',
    chiusura.status === 500 && /^Il surplus non è stato salvato: non è stato scritto niente\. Non riuscito: la chiusura al 31\/10\/2026 di Fuel Surcharge/.test(jc.error) && !/in parte/.test(jc.error)
    && globalThis.__SCRITTE.length === 0 && globalThis.__DB.SurplusTariffa[0].data_fine_validita === '2026-12-31', J(jc));
});

await sezione('9. IL GRUPPO DELLA CREAZIONE E\' QUELLO SCRITTO, E HA UNA RIGA PER CANALE', async () => {
  // Revisione del 13/10/2026. Il gruppo in cima al payload si ignorava nella
  // creazione, ma la risposta lo rimandava: l'ACI «aggiunto» al Fuel Surcharge
  // finiva in un gruppo nuovo, e l'eliminazione del surplus lo lasciava a pagare
  // e fatturare 5 €/t. E una creazione con un gruppo poteva mettere una seconda
  // riga su un canale che il gruppo aveva gia', e da li' il gruppo non si
  // modificava piu' tutto insieme.
  const DB = { SurplusTariffa: [{ id: 'sR', ...FUEL, tipologia: 'RETE', gruppo: 'g1', stato: 'attivo' }] };
  const conGruppo = await chiama(modulo, { db: DB, corpo: crea({ ...FUEL, tipologia: 'ACI' }, { gruppo: 'g1' }) });
  const aci = (conGruppo.db.SurplusTariffa || []).find(x => x.tipologia === 'ACI');
  verifica('l\'ACI aggiunto col gruppo in cima al payload: scritto nel gruppo g1, e la risposta dice g1',
    conGruppo.stato === 200 && aci && aci.gruppo === 'g1' && conGruppo.j.gruppo === 'g1', J({ risposta: conGruppo.j.gruppo, scritto: aci && aci.gruppo }));
  const via = await chiama(modulo, { db: conGruppo.db, corpo: { entita: 'SurplusTariffa', operazione: 'delete', gruppo: 'g1' } });
  verifica('eliminato il surplus g1: non resta nessun canale a pagare e fatturare', via.stato === 200 && (via.db.SurplusTariffa || []).length === 0
    && scritteDi(via, 'SurplusTariffa', 'delete').length === 2, J(via.db.SurplusTariffa));
  const inDati = await chiama(modulo, { db: DB, corpo: crea({ ...FUEL, tipologia: 'ACI', gruppo: 'g1' }) });
  verifica('col gruppo in dati.gruppo, lo stesso', inDati.stato === 200 && inDati.j.gruppo === 'g1' && scritteDi(inDati, 'SurplusTariffa', 'create')[0].dati.gruppo === 'g1', J(inDati.j));
  const dueGruppi = await chiama(modulo, { db: DB, corpo: crea({ ...FUEL, tipologia: 'ACI', gruppo: 'g2' }, { gruppo: 'g1' }) });
  verifica('due gruppi diversi nello stesso payload: 400, niente scritto', dueGruppi.stato === 400 && dueGruppi.scritte.length === 0 && /due valori diversi/.test(dueGruppi.j.error), J(dueGruppi.j));
  const anteprima = await chiama(modulo, { db: DB, corpo: crea({ ...FUEL, tipologia: 'ACI' }, { gruppo: 'g1', anteprima: true }) });
  verifica('in anteprima il gruppo e\' quello che si scriverebbe', anteprima.stato === 200 && anteprima.j.gruppo === 'g1' && anteprima.scritte.length === 0, J(anteprima.j));

  const secondaRete = await chiama(modulo, { db: DB, corpo: crea({ ...FUEL, nome: 'Fuel Surcharge bis', tipologia: 'RETE', gruppo: 'g1' }) });
  verifica('una seconda riga sulla rete nel gruppo g1: 400 sul campo gruppo, niente scritto', secondaRete.stato === 400 && secondaRete.scritte.length === 0
    && J(secondaRete.j.errori.map(e => [e.canale, e.campo])) === J([['RETE', 'gruppo']]), J(secondaRete.j));
  verifica('e il messaggio dice quale riga c\'e\' gia\' e che cosa fare',
    /^Questo surplus ha già una riga sul canale rete \(Fuel Surcharge \(consorzio Ecotyre\), dal 01\/10\/2026 al 31\/12\/2026\), e ne ha una sola per canale/.test(secondaRete.j.error)
    && /si crea come surplus nuovo: quello di prima si chiude da solo il giorno prima/.test(secondaRete.j.error), secondaRete.j.error);
  const poi = await chiama(modulo, { db: DB, corpo: { entita: 'SurplusTariffa', operazione: 'update', gruppo: 'g1', dati: { riferimento: 'comunicazione del 02/10/2026' } } });
  verifica('e il gruppo si modifica ancora tutto insieme', poi.stato === 200 && scritteDi(poi, 'SurplusTariffa', 'update').length === 1, J(poi.j));
  // Il cambio d'importo col gruppo: sarebbe una seconda riga sulla rete. Non si
  // scrive niente, nemmeno la chiusura di quello di prima.
  const cambio = await chiama(modulo, { db: DB, corpo: crea({ ...FUEL, euro_t_passiva: 6, euro_t_attiva: 6, data_inizio_validita: '2026-11-01', tipologia: 'RETE' }, { gruppo: 'g1' }) });
  verifica('l\'importo nuovo da una data nello stesso gruppo: 400, e quello di prima non si chiude', cambio.stato === 400 && cambio.scritte.length === 0, J(cambio.j));
  // Anche senza conflitto di date (la rete del gruppo e' finita a settembre):
  // il posto e' preso lo stesso.
  const finito = { SurplusTariffa: [{ ...DB.SurplusTariffa[0], data_inizio_validita: '2026-07-01', data_fine_validita: '2026-09-30' }] };
  const reteEAci = await chiama(modulo, { db: finito, corpo: crea({ ...FUEL, tipologie: ['RETE', 'ACI'] }, { gruppo: 'g1' }) });
  verifica('rete e ACI nel gruppo che ha gia\' la rete (finita a settembre): 400, e nemmeno l\'ACI si scrive', reteEAci.stato === 400 && reteEAci.scritte.length === 0, J(reteEAci.j));
  // Una modifica con l'id che sposta un record nel posto di un altro: 400.
  const dueCanali = { SurplusTariffa: [...DB.SurplusTariffa, { id: 'sA', ...FUEL, nome: 'Accordo ACI', tipologia: 'ACI', gruppo: 'g1', stato: 'attivo' }, { id: 'sX', ...FUEL, tipologia: 'RETE', gruppo: 'g2', stato: 'attivo', nome: 'Accordo', data_inizio_validita: '2026-11-01' }] };
  const spostaCanale = await chiama(modulo, { db: dueCanali, corpo: { entita: 'SurplusTariffa', operazione: 'update', id: 'sA', dati: { tipologia: 'RETE' } } });
  verifica('l\'ACI del gruppo g1 portato sulla rete, che g1 ha gia\': 400, niente scritto', spostaCanale.stato === 400 && spostaCanale.scritte.length === 0, J(spostaCanale.j));
  const spostaGruppo = await chiama(modulo, { db: dueCanali, corpo: { entita: 'SurplusTariffa', operazione: 'update', id: 'sX', dati: { gruppo: 'g1' } } });
  verifica('una rete portata nel gruppo g1, che ha gia\' la rete: 400, niente scritto', spostaGruppo.stato === 400 && spostaGruppo.scritte.length === 0, J(spostaGruppo.j));
  // Due righe sullo stesso canale che ci fossero gia': una per una si
  // correggono, perche' la modifica le lascia dove sono.
  const giaDoppie = { SurplusTariffa: [...DB.SurplusTariffa, { id: 's9', ...FUEL, tipologia: 'RETE', gruppo: 'g1', stato: 'attivo', data_inizio_validita: '2026-07-01', data_fine_validita: '2026-09-30' }] };
  const unaPerUna = await chiama(modulo, { db: giaDoppie, corpo: { entita: 'SurplusTariffa', operazione: 'update', id: 's9', dati: { euro_t_passiva: 6 } } });
  verifica('due righe gia\' doppie: la modifica di una delle due passa', unaPerUna.stato === 200 && scritteDi(unaPerUna, 'SurplusTariffa', 'update').length === 1, J(unaPerUna.j));
  const fuori = await chiama(modulo, { db: giaDoppie, corpo: { entita: 'SurplusTariffa', operazione: 'update', id: 's9', dati: { gruppo: 'g-luglio' } } });
  verifica('e una si porta in un surplus suo', fuori.stato === 200 && fuori.j.gruppo === 'g-luglio' && fuori.db.SurplusTariffa.find(x => x.id === 's9').gruppo === 'g-luglio', J(fuori.j));
});

await sezione('10. SUI DATI VERI: OGGI NIENTE DA DIRE; SETTEMBRE CHIUSO DIREBBE I NUMERI DEL PROGETTO', async () => {
  // La copia dei dati veri (fuori dal repository, come prove/datiVeri.mjs): il
  // Fuel Surcharge vero (01/10-31/12/2026) non tocca nessun mese chiuso, e non
  // costa letture. Poi settembre 2026 fatto chiudere e congelare con i conti
  // veri (le righe dell'attiva e il conto della passiva come li calcola il
  // gestionale), e un Fuel Surcharge dal 01/09: la stima del salvataggio deve
  // dire i numeri del progetto (rete 5.601,20 € da Ecotyre su 1.120,24 t e
  // 4.332,80 € ai nove raccoglitori esterni su 866,56 t; ACI 94,45 e 69,95 €).
  const { existsSync, readdirSync, readFileSync } = await import('node:fs');
  const { gunzipSync } = await import('node:zlib');
  const { fileURLToPath } = await import('node:url');
  const cartella = process.env.DATI_VERI || fileURLToPath(new URL('../../dati-veri/', import.meta.url));
  const copie = existsSync(cartella) ? readdirSync(cartella).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
  if (!copie.length) { console.log(`  Nessuna copia dei dati veri in ${cartella}: sezione saltata.`); return; }
  const A = JSON.parse(gunzipSync(readFileSync(cartella + copie[copie.length - 1])).toString('utf8')).archivi;
  const { calcolaRigheAttiva } = await import('../base44/shared/attivaCalcolo.ts');
  const { calcolaPassivaMese } = await import('../base44/shared/passivaCalcolo.ts');
  const archivi = (altro = {}) => ({ DocumentoFatturazione: A.DocumentoFatturazione || [], ChiusuraPassivaMese: A.ChiusuraPassivaMese || [], SurplusTariffa: A.SurplusTariffa || [], ...altro });
  const tre = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];

  const oggi = await chiama(modulo, { db: archivi(), corpo: crea({ ...FUEL, tipologie: tre }, { anteprima: true }) });
  verifica('il Fuel Surcharge vero sui tre canali: si salverebbe, nessun mese chiuso, nessun avviso', oggi.stato === 200 && oggi.j.piano.length === 3 && !oggi.j.mesi_chiusi && !oggi.j.avvisi && oggi.scritte.length === 0, J(oggi.j));

  const attiva = calcolaRigheAttiva({ reteAll: A.PrimariaRete, aciAll: A.PrimariaAci, extraAll: A.ExtraRaccolta, fornitori: A.Fornitore, tariffe: A.Tariffa.filter(t => t.direzione === 'ATTIVA'), anno: 2026, mese: 'Settembre' });
  const documenti = (A.DocumentoFatturazione || []).map(d => (d.tipo === 'ATTIVA' && d.anno === 2026 && d.mese === 'Settembre' && !d.superato ? { ...d, stato: 'chiusa' } : d));
  const voci = [];
  for (const c of tre) {
    const doc = documenti.find(d => d.tipo === 'ATTIVA' && d.anno === 2026 && d.mese === 'Settembre' && d.tipologia === c && !d.superato);
    for (const v of attiva.righe[c]) voci.push({ ...v, id: `v${voci.length}`, documento_id: doc.id });
  }
  const passivaIn = {
    primarieRete: A.PrimariaRete, primarieAci: A.PrimariaAci, secondarieAll: A.Secondaria, extraRaccoltaAll: A.ExtraRaccolta,
    tariffeAll: A.Tariffa.filter(t => String(t.direzione || 'PASSIVA') === 'PASSIVA'), fornitoriAll: A.Fornitore.filter(x => x.stato === 'attivo'),
  };
  const congelati = tre.map((c, i) => ({ id: `c${i}`, anno: 2026, mese: 9, canale: c, congelato_il: '2026-10-05T10:00:00Z', passiva_json: J(calcolaPassivaMese(passivaIn, 2026, 8, 'Settembre', c)) }));
  const settembre = await chiama(modulo, {
    db: archivi({ DocumentoFatturazione: documenti, VoceFatturazione: voci, ChiusuraPassivaMese: congelati }),
    corpo: crea({ ...FUEL, data_inizio_validita: '2026-09-01', tipologie: tre }, { anteprima: true }),
  });
  const per = Object.fromEntries((settembre.j.mesi_chiusi || []).map(m => [m.canale, m]));
  verifica('rete: 5.601,20 € da Ecotyre su 1.120,24 t, 4.332,80 € ai raccoglitori esterni su 866,56 t (SMOCO no)',
    per.RETE && per.RETE.attiva.dopo.euro === 5601.2 && per.RETE.attiva.dopo.tonnellate === 1120.24 && per.RETE.passiva.dopo.euro === 4332.8 && per.RETE.passiva.dopo.tonnellate === 866.56
    && per.RETE.attiva.stima === 'esatta' && per.RETE.passiva.stima === 'esatta', J(per.RETE));
  verifica('ACI: 94,45 € su 18,89 t e 69,95 € su 13,99 t', per.ACI && per.ACI.attiva.dopo.euro === 94.45 && per.ACI.attiva.dopo.tonnellate === 18.89 && per.ACI.passiva.dopo.euro === 69.95 && per.ACI.passiva.dopo.tonnellate === 13.99, J(per.ACI));
  verifica('extra raccolta: nessun intervento a settembre, niente da dire', !per.EXTRA_RACCOLTA, J(per.EXTRA_RACCOLTA));
  verifica('e in anteprima non si scrive niente', settembre.scritte.length === 0, J(settembre.scritte));
});

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
