// IL MOTORE DEGLI ALERT AL CAMBIO D'ANNO (A54 dell'audit del 20/09, corretta il
// 12/10/2026). Si gira la funzione vera, runAlertEngine, sul banco di
// prove/dati/bancoFunzioni.mjs, con la data di oggi finta.
//
// Prima il motore guardava solo i record dell'anno di oggi e chiudeva come
// risolto ogni alert aperto la cui condizione non ritrovava: il 02/01/2027 un
// ritiro del 20/12/2026 col peso zero, mai corretto, diventava «risolto:
// condizione non presente nei dati 2027». Ora:
// 1. si controllano l'anno in corso e quello prima: l'alert vero del 20/12/2026
//    resta aperto il 02/01/2027 e anche ad aprile; quando il peso arriva si
//    chiude, con la nota che dice l'anno giusto;
// 2. alert nuovi sull'anno prima solo a gennaio e febbraio; mai sul 2025 oggi;
// 3. un alert di un anno che non si controlla piu' resta aperto (se ne chiudono
//    solo i doppioni);
// 4. le rotte si leggono anno per anno: un viaggio fuori rotta del 2026 resta
//    fuori rotta a gennaio 2027, anche se nel 2027 la stessa destinazione e'
//    diventata abituale;
// 5. mix, SLA e scostamento si misurano sull'anno in corso: un loro alert
//    scritto l'ultima volta nel 2026 resta aperto a gennaio 2027, uno scritto
//    nel 2027 si chiude quando la condizione non c'e' piu';
// 6. la data delle note di chiusura e' all'italiana (gg/mm/aaaa), anche in
//    checkTargetAlerts; e nel testo degli alert le rotte dicono il giorno e i
//    kg all'italiana, il ritardo SLA giorni e percentuali con la virgola;
// 7. il banco ha bulkUpdate: senza, le chiusure del motore cadevano nel catch e
//    la prova vedeva aperti alert che la funzione vera chiude.
//
// Revisione del 13/10/2026:
// 8. le province inattive: un alert si chiude da solo solo se la sua coppia di
//    mesi sta fra quelli che la matrice ha rivalutato (i mesi finiti dell'anno,
//    e a gennaio e febbraio novembre e dicembre dell'anno prima). Prima il
//    02/01/2027 l'alert di settembre-ottobre 2026 si chiudeva «risolto ... nei
//    dati 2027», e il 01/03/2027 quello di novembre-dicembre 2026. Il testo
//    porta l'anno dei due mesi; quelli di prima, senza, si leggono lo stesso;
// 9. sull'anno prima le regole di tratta rifatte nel 2027 non aprono alert
//    nuovi: tolta a gennaio 2027 una destinazione ammessa nel 2026, nascevano
//    15 alert falsi sui viaggi del 2026. Con la regola del 2026 mai toccata
//    quelli aperti si riscrivono e si chiudono come prima (sezione 12);
// 10. le province del contratto mai servite (A58): il motore passa i contratti
//    alla matrice con una lettura per giro, e l'alert dice «del contratto:
//    nessun ritiro nell'anno».
//
// Revisione successiva del 13/10/2026 (i rilievi sulle correzioni di sopra):
// 11. l'alert delle province fuori dai mesi della matrice resta com'e': la
//    chiave non ha i mesi, e riscritto con la coppia trovata oggi si chiudeva
//    «risolto» appena quella si risolveva. CE ferma a ottobre-novembre 2026:
//    a gennaio diventava «Novembre 2026 - Dicembre 2026» e l'08/01/2027, col
//    ritiro del 28/12 registrato il 07/01, si chiudeva con ottobre e novembre a
//    zero. Lo stesso ad AV ad aprile 2027. Chiuso a mano, nasce quello nuovo;
//    la sezione 10 pretendeva la riscrittura di BA ed e' corretta;
// 12. le regole di tratta sull'anno prima: si applica quella scritta (creata e
//    cambiata l'ultima volta) prima del 01/01, che era la regola di quell'anno.
//    Il viaggio del 30/12/2026 a Gatim registrato il 04/01/2027, con la regola
//    del 01/03/2026 mai toccata, apre il suo alert; col primo rimedio non lo
//    apriva mai. Una regola scritta nel 2027 sul 2026 non apre, non riscrive e
//    non chiude: l'alert aperto resta e si conta.
//
// node prove/alertCambioAnno.mjs
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);

// La data di oggi finta: new Date() e Date.now() danno quell'istante, il resto e' vero.
const VeroDate = Date;
async function conOggi(iso, fn) {
  const fisso = VeroDate.parse(iso);
  class Finto extends VeroDate {
    constructor(...a) { if (a.length === 0) super(fisso); else super(...a); }
    static now() { return fisso; }
  }
  globalThis.Date = Finto;
  try { return await fn(); } finally { globalThis.Date = VeroDate; }
}

const motore = await caricaFunzione('runAlertEngine');
const gira = (iso, db, modulo = 'primarie_rete') => conOggi(iso, () => chiama(motore, { db, corpo: { modulo } }));
const alertDi = (r, id) => (r.db.Alert || []).find(a => a.id === id) || {};
const nuoviAlert = (r) => (r.db.Alert || []).filter(a => String(a.id).startsWith('Alert-nuovo-'));

const REGOLA_PESO = { id: 'r1', modulo: 'primarie_rete', attiva: true, tipo_regola: 'anomalia_peso', config: {}, severita: 'warning', nome: 'Peso mancante' };
const ritiro = (id, giorno, peso, extra = {}) => ({
  id: 'p-' + id, id_ordine: id, numero_fir: 'FIR' + id, stato: 'terminato', quantita_ritirata: 10, peso_effettivo: peso,
  ordine_immesso_il: giorno + 'T08:00:00Z', trasporto_iniziato_il: giorno + 'T08:00:00Z', trasporto_finito_il: giorno + 'T10:00:00Z',
  destinazione: 'IRIGOM SRL', trasportatore: 'NAPPI SUD SRL', provincia: 'NA', regione: 'Campania', tipo_destinazione: 'imp', classe: 'A', ...extra,
});
const alertPeso = (id, ordine) => ({
  id, modulo: 'primarie_rete', stato: 'aperto', record_id: ordine, regola_id: 'r1', regola_nome: 'Peso mancante', entity_type: 'PrimariaRete',
  titolo: `Peso effettivo mancante per ${ordine}`, descrizione: `Record ${ordine}: quantità ritirata 10 ma peso effettivo = 0 o mancante.`, severita: 'warning',
});

console.log("1. L'ALERT VERO DEL 20/12/2026 NON SI CHIUDE AL CAMBIO D'ANNO");
{
  const db = { RegolaAlert: [REGOLA_PESO], PrimariaRete: [ritiro('ET26150000', '2026-12-20', 0)], Alert: [alertPeso('al1', 'ET26150000')], UploadLog: [] };
  const dicembre = await gira('2026-12-28T10:00:00Z', db);
  verifica('il 28/12/2026 l\'alert e\' aperto', dicembre.stato === 200 && alertDi(dicembre, 'al1').stato === 'aperto', J([dicembre.stato, dicembre.j.error, alertDi(dicembre, 'al1')]));
  const gennaio = await gira('2027-01-02T10:00:00Z', db);
  verifica('il 02/01/2027 resta aperto: il peso non e\' mai arrivato', gennaio.stato === 200 && alertDi(gennaio, 'al1').stato === 'aperto', J([gennaio.stato, gennaio.j.error, alertDi(gennaio, 'al1')]));
  verifica('e non si crea un doppione', nuoviAlert(gennaio).length === 0, J(nuoviAlert(gennaio)));
  verifica('la risposta dice gli anni controllati e quelli che aprono alert nuovi', J(gennaio.j.anni_controllati) === J([2026, 2027]) && J(gennaio.j.anni_alert_nuovi) === J([2026, 2027]) && gennaio.j.anno === 2027, J(gennaio.j));
  // la pagina scrive «su N record del 2027 controllati»: N resta quello dell'anno
  verifica('i record controllati, quelli dell\'anno e per anno', gennaio.j.record_scansionati === 0 && J(gennaio.j.record_per_anno) === J({ 2026: 1, 2027: 0 }), J([gennaio.j.record_scansionati, gennaio.j.record_per_anno]));
  const aprile = await gira('2027-04-10T10:00:00Z', db);
  verifica('il 10/04/2027 resta aperto: il 2026 si controlla ancora', alertDi(aprile, 'al1').stato === 'aperto', J(alertDi(aprile, 'al1')));
  verifica('ad aprile sul 2026 non nascono alert nuovi', J(aprile.j.anni_alert_nuovi) === J([2027]), J(aprile.j.anni_alert_nuovi));

  const corretto = { ...db, PrimariaRete: [ritiro('ET26150000', '2026-12-20', 9800)] };
  const risolto = await gira('2027-01-02T10:00:00Z', corretto);
  const a = alertDi(risolto, 'al1');
  verifica('corretto il peso, il 02/01/2027 si chiude', a.stato === 'risolto', J(a));
  verifica('con la data all\'italiana e l\'anno del ritiro nella nota', a.risolto_note === 'Chiuso automaticamente il 02/01/2027: condizione non presente nei dati 2026', J(a.risolto_note));
  const risoltoAprile = await gira('2027-04-10T10:00:00Z', corretto);
  verifica('corretto ad aprile, si chiude lo stesso', alertDi(risoltoAprile, 'al1').stato === 'risolto' && /il 10\/04\/2027: condizione non presente nei dati 2026$/.test(alertDi(risoltoAprile, 'al1').risolto_note || ''), J(alertDi(risoltoAprile, 'al1')));

  const cancellato = { ...db, PrimariaRete: [ritiro('ET26150000', '2026-12-20', 0, { stato: 'cancellato' })] };
  const via = await gira('2027-01-02T10:00:00Z', cancellato);
  verifica('un ordine cancellato chiude l\'alert, e la nota dice perche\'', alertDi(via, 'al1').stato === 'risolto' && /ET26150000 non è più fra i terminati con la fine del trasporto/.test(alertDi(via, 'al1').risolto_note || ''), J(alertDi(via, 'al1')));

  const dopo = await gira('2028-01-10T10:00:00Z', db);
  verifica('nel 2028 il 2026 non si controlla piu\': l\'alert resta aperto, com\'e\'', alertDi(dopo, 'al1').stato === 'aperto' && dopo.j.alerts_anni_non_controllati === 1, J([alertDi(dopo, 'al1'), dopo.j.alerts_anni_non_controllati]));
  const doppio = await gira('2028-01-10T10:00:00Z', { ...db, Alert: [alertPeso('al1', 'ET26150000'), alertPeso('al1bis', 'ET26150000')] });
  verifica('fuori dagli anni controllati si chiudono solo i doppioni', alertDi(doppio, 'al1').stato === 'aperto' && alertDi(doppio, 'al1bis').stato === 'risolto'
    && /^Chiuso automaticamente il 10\/01\/2028: doppione/.test(alertDi(doppio, 'al1bis').risolto_note || ''), J([alertDi(doppio, 'al1'), alertDi(doppio, 'al1bis')]));
}

console.log("2. ALERT NUOVI SULL'ANNO PRIMA SOLO A GENNAIO E FEBBRAIO");
{
  const db = { RegolaAlert: [REGOLA_PESO], PrimariaRete: [ritiro('ET26150001', '2026-12-29', 0)], Alert: [], UploadLog: [] };
  const gennaio = await gira('2027-01-12T10:00:00Z', db);
  verifica('il ritiro del 29/12/2026 caricato a gennaio apre il suo alert', nuoviAlert(gennaio).some(a => a.record_id === 'ET26150001'), J(nuoviAlert(gennaio)));
  const febbraio = await gira('2027-02-28T10:00:00Z', db);
  verifica('anche il 28 febbraio', nuoviAlert(febbraio).some(a => a.record_id === 'ET26150001'), J(nuoviAlert(febbraio)));
  const marzo = await gira('2027-03-01T10:00:00Z', db);
  verifica('dal 1 marzo no: l\'anno prima non apre piu\' alert', nuoviAlert(marzo).length === 0 && marzo.j.alerts_creati === 0, J(nuoviAlert(marzo)));

  const oggi = await gira('2026-10-11T10:00:00Z', { ...db, PrimariaRete: [ritiro('ET25150002', '2025-06-10', 0), ritiro('ET26150003', '2026-06-10', 0)] });
  verifica('oggi nessun alert nuovo sul 2025, quello sul 2026 si', J(nuoviAlert(oggi).map(a => a.record_id)) === J(['ET26150003']), J(nuoviAlert(oggi).map(a => a.record_id)));
}

console.log('3. LE ROTTE SI LEGGONO ANNO PER ANNO');
{
  // 25 viaggi di ALFA a Irigom e uno a Gatim nel 2026: quello a Gatim e' fuori
  // rotta (1 su 26). Nel 2027 ALFA va solo a Gatim, due volte: li' non e' fuori
  // rotta. Sommando i due anni Gatim farebbe 3 su 28 e l'alert del 2026 si
  // chiuderebbe.
  const viaggi = [];
  for (let i = 0; i < 25; i++) viaggi.push(ritiro(`ET2616${String(i).padStart(4, '0')}`, '2026-11-' + String(1 + (i % 28)).padStart(2, '0'), 5000, { trasportatore: 'ALFA SRL' }));
  viaggi.push(ritiro('ET26169999', '2026-12-15', 5000, { trasportatore: 'ALFA SRL', destinazione: 'GATIM SRL' }));
  viaggi.push(ritiro('ET27100001', '2027-01-04', 5000, { trasportatore: 'ALFA SRL', destinazione: 'GATIM SRL' }));
  viaggi.push(ritiro('ET27100002', '2027-01-05', 5000, { trasportatore: 'ALFA SRL', destinazione: 'GATIM SRL' }));
  const rotta = { id: 'ro1', modulo: 'primarie_rete', stato: 'aperto', record_id: 'FIRET26169999', regola_id: 'rotta_conferimento', regola_nome: 'Conferimento fuori rotta', entity_type: 'PrimariaRete', titolo: 'Conferimento fuori rotta: ALFA SRL a GATIM SRL', descrizione: 'x', severita: 'warning' };
  const db = { RegolaAlert: [], PrimariaRete: viaggi, Alert: [rotta], UploadLog: [] };
  const gennaio = await gira('2027-01-08T10:00:00Z', db);
  verifica('il 08/01/2027 il viaggio fuori rotta del 2026 resta fuori rotta, e l\'alert aperto', gennaio.stato === 200 && alertDi(gennaio, 'ro1').stato === 'aperto', J([gennaio.j.error, alertDi(gennaio, 'ro1')]));
  verifica('e ne prende il testo di oggi, sui viaggi del 2026', /su 26 viaggi dell'anno/.test(alertDi(gennaio, 'ro1').descrizione || ''), J(alertDi(gennaio, 'ro1').descrizione));
  verifica('col giorno e i kg all\'italiana', /Formulario FIRET26169999, ordine ET26169999, del 15\/12\/2026, 5\.000 kg\./.test(alertDi(gennaio, 'ro1').descrizione || ''), J(alertDi(gennaio, 'ro1').descrizione));
  verifica('i viaggi del 2027 a Gatim non sono fuori rotta', !nuoviAlert(gennaio).some(a => /ET271/.test(a.descrizione || '')), J(nuoviAlert(gennaio)));
  const corretto = await gira('2027-01-08T10:00:00Z', { ...db, PrimariaRete: viaggi.map(v => (v.id_ordine === 'ET26169999' ? { ...v, destinazione: 'IRIGOM SRL' } : v)) });
  verifica('corretta la destinazione, si chiude con l\'anno del formulario', alertDi(corretto, 'ro1').stato === 'risolto' && /il 08\/01\/2027: condizione non presente nei dati 2026$/.test(alertDi(corretto, 'ro1').risolto_note || ''), J(alertDi(corretto, 'ro1')));
}

console.log("4. MIX, SLA E SCOSTAMENTO: SOLO SULL'ANNO IN CORSO");
{
  const sla = { id: 'rs', modulo: 'primarie_rete', attiva: true, tipo_regola: 'ritardo_sla', config: {}, severita: 'warning', nome: 'Ritardo SLA' };
  const alertSla = (id, chi, scritto) => ({ id, modulo: 'primarie_rete', stato: 'aperto', record_id: chi, regola_id: 'rs', regola_nome: 'Ritardo SLA', entity_type: 'PrimariaRete', titolo: `Ritardo SLA critico: ${chi}`, descrizione: 'x', severita: 'warning', created_date: scritto, updated_date: scritto });
  const db = { RegolaAlert: [sla], PrimariaRete: [ritiro('ET27100003', '2027-01-04', 5000)], UploadLog: [],
    Alert: [alertSla('sl26', 'ALFA SRL', '2026-11-30T10:00:00.000000'), alertSla('sl27', 'BETA SRL', '2027-01-03T10:00:00.000000')] };
  const gennaio = await gira('2027-01-08T10:00:00Z', db);
  verifica('il ritardo SLA scritto nel 2026 resta aperto: parla del 2026', alertDi(gennaio, 'sl26').stato === 'aperto', J(alertDi(gennaio, 'sl26')));
  verifica('quello scritto nel 2027, senza piu\' la condizione, si chiude', alertDi(gennaio, 'sl27').stato === 'risolto' && /il 08\/01\/2027: condizione non presente nei dati 2027$/.test(alertDi(gennaio, 'sl27').risolto_note || ''), J(alertDi(gennaio, 'sl27')));

  // Un trasportatore lento nel 2026: l'alert nasce coi giorni e la percentuale
  // con la virgola (toFixed scriveva 14.5).
  const lento = (id, immesso, finito) => ritiro(id, finito, 5000, { trasportatore: 'LENTO SRL', ordine_immesso_il: immesso + 'T08:00:00Z', trasporto_iniziato_il: finito + 'T08:00:00Z' });
  const r = await gira('2026-10-11T10:00:00Z', { RegolaAlert: [sla], UploadLog: [], Alert: [], PrimariaRete: [lento('ET26180001', '2026-06-01', '2026-06-20'), lento('ET26180002', '2026-06-01', '2026-06-11')] });
  const testo = (nuoviAlert(r).find(a => a.record_id === 'LENTO SRL') || {}).descrizione || '';
  verifica('il ritardo SLA scrive i numeri con la virgola', /Nr Giorni medio \d+,\d gg dall'immissione alla fine del trasporto, % fuori tempo \d+,\d%/.test(testo) && !/\d\.\d/.test(testo), J([testo, r.j.error]));
}

console.log("5. LE NOTE DI CHIUSURA DEI TARGET, ALL'ITALIANA");
{
  const target = await caricaFunzione('checkTargetAlerts');
  const db = {
    TargetMensile: [{ id: 'm1', raccoglitore: 'BETA SRL', regione: 'Campania', mese: 'Settembre', anno: 2026, target: 100 }],
    PrimariaRete: [ritiro('ET26150010', '2026-09-10', 120000, { trasportatore: 'BETA SRL' })],
    UploadLog: [],
    Alert: [
      { id: 'tm1', modulo: 'primarie_rete', stato: 'aperto', entity_type: 'TargetMensile', record_id: 'ALFA SRL|Campania|Settembre|2026', titolo: 'Target non raggiunto', descrizione: 'x', severita: 'warning' },
      { id: 'gi1', modulo: 'giacenze', stato: 'aperto', regola_id: 'target_impianto_divergente', record_id: 'IRIGOM', titolo: 'Target divergente', descrizione: 'x', severita: 'warning' },
    ],
  };
  const r = await conOggi('2026-10-11T10:00:00Z', () => chiama(target, { db, corpo: {} }));
  const tm = alertDi(r, 'tm1'), gi = alertDi(r, 'gi1');
  verifica('l\'alert del raccoglitore senza target si chiude col giorno all\'italiana', r.stato === 200 && tm.stato === 'risolto' && /^Chiuso automaticamente il 11\/10\/2026: rivalutato sui dati caricati/.test(tm.risolto_note || ''), J([r.stato, r.j.error, tm]));
  verifica('anche quello del target dell\'impianto', gi.stato === 'risolto' && /^Chiuso automaticamente il 11\/10\/2026: /.test(gi.risolto_note || ''), J(gi));
}

console.log('6. NESSUNA NOTA COL GIORNO IN FORMATO MACCHINA');
{
  const db = { RegolaAlert: [REGOLA_PESO], PrimariaRete: [ritiro('ET27100004', '2027-01-04', 5000)], UploadLog: [],
    Alert: [alertPeso('d1', 'ET27100004'), alertPeso('d2', 'ET27100004'),
      { id: 'dt', modulo: 'primarie_rete', stato: 'aperto', record_id: 'primarie_rete', regola_id: 'date_obbligatorie_rete', regola_nome: 'Date', entity_type: 'PrimariaRete', titolo: 'x', descrizione: 'x', severita: 'warning' }] };
  const r = await gira('2027-01-08T10:00:00Z', db);
  const note = (r.db.Alert || []).filter(a => a.stato === 'risolto').map(a => a.risolto_note);
  verifica('si chiudono l\'alert risolto, il suo doppione e quello delle date', note.length === 3, J(note));
  verifica('tutte col giorno 08/01/2027 e nessuna con 2027-01-08', note.every(n => /^Chiuso automaticamente il 08\/01\/2027: /.test(n)) && !note.some(n => /\d{4}-\d{2}-\d{2}/.test(n)), J(note));
}

console.log('7. IL BANCO HA BULKUPDATE');
{
  const db = { RegolaAlert: [REGOLA_PESO], PrimariaRete: [ritiro('ET26150020', '2026-06-10', 5000)], Alert: [alertPeso('b1', 'ET26150020')], UploadLog: [] };
  const r = await gira('2026-10-11T10:00:00Z', db);
  const scritte = r.scritte.filter(s => s.op === 'bulkUpdate' && s.entita === 'Alert');
  verifica('la chiusura passa da bulkUpdate e si vede fra le scritture', scritte.length === 1 && scritte[0].righe.length === 1 && scritte[0].righe[0].id === 'b1', J(r.scritte));
  verifica('e l\'archivio finto la registra', alertDi(r, 'b1').stato === 'risolto' && r.j.alerts_chiusi === 1, J([alertDi(r, 'b1'), r.j.alerts_chiusi]));
}

// --- Revisione del 13/10/2026 ---

const REGOLA_PROV = { id: 'rp', modulo: 'primarie_rete', attiva: true, tipo_regola: 'province_inattive', config: {}, severita: 'warning', nome: 'Province inattive' };
// Un ritiro il 10 di ciascun mese dato ('aaaa-mm'), nella provincia data.
const ritiriIn = (provincia, regione, mesi, prefisso) => mesi.map((m, i) => ritiro(`${prefisso}${String(i).padStart(4, '0')}`, `${m}-10`, 5000, { provincia, regione }));
// I mesi 'aaaa-mm' dal primo all'ultimo (compresi), tranne quelli in «salvo».
function mesiFra(da, a, salvo = []) {
  const out = [];
  let [y, m] = da.split('-').map(Number);
  const [ya, ma] = a.split('-').map(Number);
  while (y < ya || (y === ya && m <= ma)) {
    const s = `${y}-${String(m).padStart(2, '0')}`;
    if (!salvo.includes(s)) out.push(s);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
const alertProv = (id, provincia, descrizione, scritto) => ({ id, modulo: 'primarie_rete', stato: 'aperto', record_id: provincia, regola_id: 'rp', regola_nome: 'Province inattive',
  entity_type: 'PrimariaRete', titolo: `Provincia inattiva: ${provincia}`, descrizione, severita: 'warning', created_date: scritto, updated_date: scritto });
const testoProv = (provincia, regione, coppia) => `Provincia ${provincia} (${regione}): 2 mesi consecutivi con 0 raccolte (${coppia}). Pianificare raccolte nel terzo mese per rispettare i requisiti consorziali.`;
const nuovoDi = (r, regola) => nuoviAlert(r).filter(a => a.regola_id === regola);

console.log("8. LE PROVINCE INATTIVE: SI CHIUDE DA SOLO SOLO L'ALERT DEI MESI CHE LA MATRICE HA GUARDATO");
{
  // AV lavora tutto il 2026 tranne settembre e ottobre (il caso della revisione).
  const AV = ritiriIn('AV', 'Campania', mesiFra('2026-01', '2026-12', ['2026-09', '2026-10']), 'ET26AV');
  const db = { RegolaAlert: [REGOLA_PROV], PrimariaRete: AV, Alert: [], UploadLog: [] };
  const dic = await gira('2026-12-20T10:00:00Z', db);
  const nato = nuovoDi(dic, 'rp')[0] || {};
  verifica('il 20/12/2026 nasce l\'alert di AV, coi due mesi e il loro anno', nato.record_id === 'AV' && nato.descrizione === testoProv('AV', 'Campania', 'Settembre 2026 - Ottobre 2026'), J([dic.j.error, nato.descrizione]));

  const aperto = { ...db, Alert: [alertProv('pv1', 'AV', testoProv('AV', 'Campania', 'Settembre 2026 - Ottobre 2026'), '2026-12-20T10:00:00.000000')] };
  const gen = await gira('2027-01-02T10:00:00Z', aperto);
  verifica('il 02/01/2027 resta aperto: settembre e ottobre 2026 non li ha guardati nessuno', gen.stato === 200 && alertDi(gen, 'pv1').stato === 'aperto' && gen.j.alerts_chiusi === 0, J([gen.j.error, alertDi(gen, 'pv1')]));
  verifica('e la risposta lo conta fra quelli fuori dai periodi controllati', gen.j.alerts_anni_non_controllati === 1, J(gen.j.alerts_anni_non_controllati));
  const apr = await gira('2027-04-10T10:00:00Z', aperto);
  verifica('anche il 10/04/2027', alertDi(apr, 'pv1').stato === 'aperto', J(alertDi(apr, 'pv1')));
  // il testo di prima, senza l'anno: i mesi sono dell'anno in cui fu scritto
  const vecchio = await gira('2027-01-02T10:00:00Z', { ...db, Alert: [alertProv('pv2', 'AV', testoProv('AV', 'Campania', 'Settembre - Ottobre'), '2026-12-20T10:00:00.000000')] });
  verifica('col testo di prima («Settembre - Ottobre», scritto nel 2026) resta aperto lo stesso', alertDi(vecchio, 'pv2').stato === 'aperto', J(alertDi(vecchio, 'pv2')));

  // dentro l'anno il ritiro di settembre caricato tardi chiude l'alert: i mesi li ha guardati
  const corretto = { RegolaAlert: [REGOLA_PROV], PrimariaRete: ritiriIn('AV', 'Campania', mesiFra('2026-01', '2026-12', ['2026-10']), 'ET26AV'), UploadLog: [],
    Alert: [alertProv('pv3', 'AV', testoProv('AV', 'Campania', 'Settembre 2026 - Ottobre 2026'), '2026-11-15T10:00:00.000000')] };
  const chiuso = await gira('2026-12-20T10:00:00Z', corretto);
  verifica('dentro l\'anno, arrivato il ritiro di settembre, si chiude con l\'anno dei mesi', alertDi(chiuso, 'pv3').stato === 'risolto'
    && alertDi(chiuso, 'pv3').risolto_note === 'Chiuso automaticamente il 20/12/2026: condizione non presente nei dati 2026', J(alertDi(chiuso, 'pv3')));
  const chiusoVecchio = await gira('2026-12-20T10:00:00Z', { ...corretto, Alert: [alertProv('pv4', 'AV', testoProv('AV', 'Campania', 'Settembre - Ottobre'), '2026-11-15T10:00:00.000000')] });
  verifica('anche col testo di prima', alertDi(chiusoVecchio, 'pv4').stato === 'risolto', J(alertDi(chiusoVecchio, 'pv4')));
}
{
  // BN ferma a novembre e dicembre 2026, ripartita a gennaio 2027 (il caso vicino).
  const BN = [...ritiriIn('BN', 'Campania', mesiFra('2026-01', '2026-10'), 'ET26BN'), ...ritiriIn('BN', 'Campania', ['2027-01', '2027-02'], 'ET27BN')];
  const gen = await gira('2027-01-20T10:00:00Z', { RegolaAlert: [REGOLA_PROV], PrimariaRete: BN, Alert: [], UploadLog: [] });
  const nato = nuovoDi(gen, 'rp')[0] || {};
  verifica('il 20/01/2027 nasce l\'alert di BN su novembre e dicembre 2026', nato.descrizione === testoProv('BN', 'Campania', 'Novembre 2026 - Dicembre 2026'), J(nato.descrizione));
  const mar = await gira('2027-03-01T10:00:00Z', { RegolaAlert: [REGOLA_PROV], PrimariaRete: BN, UploadLog: [],
    Alert: [alertProv('pb1', 'BN', testoProv('BN', 'Campania', 'Novembre 2026 - Dicembre 2026'), '2027-01-20T10:00:00.000000')] });
  verifica('il 01/03/2027 resta aperto: da marzo novembre e dicembre 2026 non si guardano piu\'', alertDi(mar, 'pb1').stato === 'aperto' && mar.j.alerts_anni_non_controllati === 1, J([alertDi(mar, 'pb1'), mar.j.alerts_anni_non_controllati]));
  // a gennaio il ritiro di dicembre 2026 caricato tardi lo chiude: la coppia e' guardata
  const tardi = await gira('2027-01-25T10:00:00Z', { RegolaAlert: [REGOLA_PROV], PrimariaRete: [...BN, ...ritiriIn('BN', 'Campania', ['2026-12'], 'ET26BNX')], UploadLog: [],
    Alert: [alertProv('pb2', 'BN', testoProv('BN', 'Campania', 'Novembre 2026 - Dicembre 2026'), '2027-01-20T10:00:00.000000')] });
  verifica('a gennaio, arrivato il ritiro di dicembre 2026, si chiude coi dati 2026', alertDi(tardi, 'pb2').stato === 'risolto'
    && alertDi(tardi, 'pb2').risolto_note === 'Chiuso automaticamente il 25/01/2027: condizione non presente nei dati 2026', J(alertDi(tardi, 'pb2')));
  // il testo di prima a cavallo d'anno, «Dicembre 2026 - Gennaio» scritto a febbraio 2027
  const SA = [...ritiriIn('SA', 'Campania', mesiFra('2026-01', '2026-11'), 'ET26SA'), ...ritiriIn('SA', 'Campania', ['2027-01'], 'ET27SA')];
  const cavallo = (oggi) => gira(oggi, { RegolaAlert: [REGOLA_PROV], PrimariaRete: SA, UploadLog: [],
    Alert: [alertProv('ps1', 'SA', testoProv('SA', 'Campania', 'Dicembre 2026 - Gennaio'), '2027-02-05T10:00:00.000000')] });
  const feb = await cavallo('2027-02-20T10:00:00Z');
  verifica('«Dicembre 2026 - Gennaio» (testo di prima): a febbraio, arrivato gennaio, si chiude coi dati 2026 e 2027', alertDi(feb, 'ps1').stato === 'risolto'
    && /: condizione non presente nei dati 2026 e 2027$/.test(alertDi(feb, 'ps1').risolto_note || ''), J(alertDi(feb, 'ps1')));
  const marzo = await cavallo('2027-03-02T10:00:00Z');
  verifica('e a marzo resta aperto: dicembre 2026 non si guarda piu\'', alertDi(marzo, 'ps1').stato === 'aperto', J(alertDi(marzo, 'ps1')));
}
{
  // I mesi che il motore crede guardati sono quelli che la matrice guarda: in
  // ogni periodo dell'anno la coppia appena trovata, risolta lo stesso giorno, si
  // chiude. Se la matrice cambia i mesi che guarda, qui si vede.
  const CASI = [
    ['2026-12-15', ['2026-10', '2026-11'], 'Ottobre 2026 - Novembre 2026', 'nei dati 2026'],
    ['2027-01-15', ['2026-11', '2026-12'], 'Novembre 2026 - Dicembre 2026', 'nei dati 2026'],
    ['2027-02-15', ['2026-12', '2027-01'], 'Dicembre 2026 - Gennaio 2027', 'nei dati 2026 e 2027'],
    ['2027-03-15', ['2027-01', '2027-02'], 'Gennaio 2027 - Febbraio 2027', 'nei dati 2027'],
    ['2027-07-15', ['2027-05', '2027-06'], 'Maggio 2027 - Giugno 2027', 'nei dati 2027'],
  ];
  for (const [giorno, vuoti, coppia, nota] of CASI) {
    // PZ lavora in tutti i mesi finiti tranne i due vuoti, e anche nel mese in
    // corso (il 5): una provincia senza nessun ritiro nell'anno, fuori contratto,
    // non sta nella matrice.
    const fino = mesiFra('2026-01', '2027-12').filter(m => m < giorno.slice(0, 7));
    const PZ = [...ritiriIn('PZ', 'Basilicata', fino.filter(m => !vuoti.includes(m)), 'ETPZ'), ritiro('ETPZOGGI', giorno.slice(0, 8) + '05', 5000, { provincia: 'PZ', regione: 'Basilicata' })];
    const nato = nuovoDi(await gira(giorno + 'T10:00:00Z', { RegolaAlert: [REGOLA_PROV], PrimariaRete: PZ, Alert: [], UploadLog: [] }), 'rp')[0] || {};
    verifica(`il ${giorno} la matrice trova ${coppia}`, nato.descrizione === testoProv('PZ', 'Basilicata', coppia), J(nato.descrizione));
    const risolto = await gira(giorno + 'T10:00:00Z', { RegolaAlert: [REGOLA_PROV], PrimariaRete: [...PZ, ...ritiriIn('PZ', 'Basilicata', [vuoti[0]], 'ETPZX')], UploadLog: [],
      Alert: [alertProv('pz', 'PZ', testoProv('PZ', 'Basilicata', coppia), giorno + 'T09:00:00.000000')] });
    verifica(`e risolta lo stesso giorno si chiude (${nota})`, alertDi(risolto, 'pz').stato === 'risolto' && (alertDi(risolto, 'pz').risolto_note || '').endsWith(`condizione non presente ${nota}`), J(alertDi(risolto, 'pz')));
  }
}

console.log("9. SULL'ANNO PRIMA LE REGOLE DI TRATTA RIFATTE QUEST'ANNO NON APRONO ALERT NUOVI");
{
  // 30 viaggi del 2026 da Nappi Sud, meta' a Irigom e meta' a Tecnogum (il caso
  // della revisione). Nel 2026 la regola ammette tutti e due; a gennaio 2027
  // l'amministratore toglie Tecnogum.
  const viaggio = (i, giorno, destinazione) => ({ id: 's-' + i, id_ordine: 'ET26S' + String(i).padStart(4, '0'), numero_fir: 'FIRS' + i, stato: 'terminato', peso_effettivo: 20000,
    ordine_immesso_il: giorno + 'T08:00:00Z', trasporto_iniziato_il: giorno + 'T08:00:00Z', trasporto_finito_il: giorno + 'T10:00:00Z',
    stoccaggio: 'NAPPI SUD SRL', destinazione, trasportatore: 'NAPPI SUD SRL' });
  const viaggi = [];
  for (let i = 0; i < 30; i++) viaggi.push(viaggio(i, `2026-${String(1 + (i % 12)).padStart(2, '0')}-1${i % 9}`, i % 2 ? 'IRIGOM SRL' : 'TECNOGUM SRL'));
  // La pagina le regole le crea, le attiva e le disattiva, ma non ne cambia la
  // configurazione: togliere Tecnogum vuol dire rifare la regola, che porta la
  // data del giorno in cui e' rifatta (sezione 12).
  const tratta = (ammesse, scritta) => ({ id: 'rt', modulo: 'secondarie', attiva: true, tipo_regola: 'tratta_autorizzata', severita: 'warning', nome: 'Tratta Nappi Sud',
    ...(scritta ? { created_date: scritta, updated_date: scritta } : {}),
    config: { campo_origine: 'stoccaggio', valore_origine: 'NAPPI SUD SRL', campo_destinazione: 'destinazione', destinazioni_ammesse: ammesse } });
  const DEL_2026 = '2026-03-01T09:00:00.000000', DEL_2027 = '2027-01-03T09:00:00.000000';
  const sec = (iso, db) => gira(iso, { UploadLog: [], Alert: [], ...db }, 'secondarie');

  const dic = await sec('2026-12-20T10:00:00Z', { RegolaAlert: [tratta(['IRIGOM SRL', 'TECNOGUM SRL'], DEL_2026)], Secondaria: viaggi });
  verifica('il 20/12/2026, con Irigom e Tecnogum ammesse, nessun alert di tratta', dic.stato === 200 && nuovoDi(dic, 'rt').length === 0, J([dic.j.error, nuovoDi(dic, 'rt').length]));
  const gen = await sec('2027-01-05T10:00:00Z', { RegolaAlert: [tratta(['IRIGOM SRL'], DEL_2027)], Secondaria: viaggi });
  verifica('il 05/01/2027, tolta Tecnogum (regola rifatta a gennaio), nessun alert nuovo sui viaggi del 2026 che allora erano in regola', gen.stato === 200 && nuovoDi(gen, 'rt').length === 0,
    J([gen.j.error, nuovoDi(gen, 'rt').length, (nuovoDi(gen, 'rt')[0] || {}).descrizione]));
  const senzaDate = await sec('2027-01-05T10:00:00Z', { RegolaAlert: [tratta(['IRIGOM SRL'])], Secondaria: viaggi });
  verifica('una regola senza date vale come scritta quest\'anno: nessun alert sul 2026', senzaDate.stato === 200 && nuovoDi(senzaDate, 'rt').length === 0, J(nuovoDi(senzaDate, 'rt').length));
  const nuovo2027 = await sec('2027-01-05T10:00:00Z', { RegolaAlert: [tratta(['IRIGOM SRL'], DEL_2027)], Secondaria: [...viaggi, { ...viaggio(99, '2027-01-04', 'TECNOGUM SRL'), id_ordine: 'ET27S0099' }] });
  verifica('un viaggio del 2027 a Tecnogum apre il suo alert, come sempre', J(nuovoDi(nuovo2027, 'rt').map(a => a.record_id)) === J(['ET27S0099']), J(nuovoDi(nuovo2027, 'rt').map(a => a.record_id)));

  // Un alert gia' aperto su un viaggio del 2026 a Gatim (fuori tratta anche nel
  // 2026), con la regola del 2026 mai toccata: resta aperto, prende il testo di
  // oggi, e si chiude quando si corregge. Con una regola del 2027, sezione 12.
  const gatim = { ...viaggio(50, '2026-12-03', 'GATIM SRL'), id_ordine: 'ET26S0050' };
  const apertoT = { id: 'at1', modulo: 'secondarie', stato: 'aperto', record_id: 'ET26S0050', regola_id: 'rt', regola_nome: 'Tratta Nappi Sud', entity_type: 'Secondaria',
    titolo: 'Destinazione non autorizzata per NAPPI SUD SRL', descrizione: 'Record ET26S0050: origine "NAPPI SUD SRL" con destinazione non ammessa "GATIM SRL". Destinazioni ammesse: IRIGOM SRL, TECNOGUM SRL.', severita: 'warning' };
  const ancora = await sec('2027-01-05T10:00:00Z', { RegolaAlert: [tratta(['IRIGOM SRL'], DEL_2026)], Secondaria: [...viaggi, gatim], Alert: [apertoT] });
  verifica('l\'alert aperto sul 2026 resta aperto e prende il testo di oggi', alertDi(ancora, 'at1').stato === 'aperto' && /Destinazioni ammesse: IRIGOM SRL\.$/.test(alertDi(ancora, 'at1').descrizione || ''), J(alertDi(ancora, 'at1')));
  const sistemato = await sec('2027-01-05T10:00:00Z', { RegolaAlert: [tratta(['IRIGOM SRL'], DEL_2026)], Secondaria: [...viaggi, { ...gatim, destinazione: 'IRIGOM SRL' }], Alert: [apertoT] });
  verifica('corretta la destinazione, si chiude coi dati 2026', alertDi(sistemato, 'at1').stato === 'risolto' && /: condizione non presente nei dati 2026$/.test(alertDi(sistemato, 'at1').risolto_note || ''), J(alertDi(sistemato, 'at1')));
  // il peso, che non dipende da una configurazione dell'anno, apre ancora sul 2026 a gennaio (sezione 2)

  // Gli altri due tipi di regola di tratta, sulle primarie: un ritiro del 2026 e
  // uno del 2027 fuori dalla combinazione ammessa. A gennaio 2027 nasce solo
  // quello del 2027; il peso zero dello stesso ritiro del 2026 apre invece il suo.
  const ALTRE = [
    { id: 'tc', modulo: 'primarie_rete', attiva: true, tipo_regola: 'tratta_combinazione', severita: 'warning', nome: 'Combinazione',
      config: { campo_classe: 'classe', valore_classe: 'A', campo_origine: 'trasportatore', origine_ammessa: 'NAPPI SUD SRL', campo_destinazione: 'destinazione', destinazione_ammessa: 'IRIGOM SRL' } },
    { id: 'tk', modulo: 'primarie_rete', attiva: true, tipo_regola: 'tratte_autorizzate_classe', severita: 'warning', nome: 'Tratte per classe',
      config: { classe: 'A', campo_origine: 'trasportatore', campo_destinazione: 'destinazione', combinazioni_ammesse: [{ origine: 'NAPPI SUD SRL', destinazione: 'IRIGOM SRL' }] } },
  ];
  const fuori = (id, giorno, extra = {}) => ritiro(id, giorno, 5000, { destinazione: 'GATIM SRL', ...extra });
  const pri = await gira('2027-01-05T10:00:00Z', { RegolaAlert: [...ALTRE, REGOLA_PESO], UploadLog: [], Alert: [],
    PrimariaRete: [fuori('ET26170001', '2026-12-28', { peso_effettivo: 0 }), fuori('ET27170002', '2027-01-04')] });
  for (const r of ALTRE) {
    verifica(`${r.tipo_regola}: a gennaio solo il ritiro del 2027`, J(nuovoDi(pri, r.id).map(a => a.record_id)) === J(['ET27170002']), J([pri.j.error, nuovoDi(pri, r.id).map(a => a.record_id)]));
  }
  verifica('il peso zero del ritiro del 2026 apre il suo alert a gennaio', J(nuovoDi(pri, 'r1').map(a => a.record_id)) === J(['ET26170001']), J(nuovoDi(pri, 'r1').map(a => a.record_id)));
}

console.log('10. LE PROVINCE DEL CONTRATTO MAI SERVITE (A58)');
{
  // Il riparto del contratto 2026 com'e' scritto nell'archivio (11/10/2026), come in prove/provinceDelContratto.mjs.
  const REGIONI = '[{"regione":"Campania","province":"Tutte le provincie","target_t":4400},{"regione":"Puglia","province":"BA,BR,TA,LE","target_t":2500},{"regione":"Basilicata","province":"Tutte le provincie","target_t":500},{"regione":"Calabria","province":"Tutte le provincie","target_t":1650},{"regione":"Sicilia","province":"CT, SR, TP, AG, CL, EN, RG","target_t":2500}]';
  const contratto = (anno) => ({ id: 'c' + anno, anno, target_annuo_t: 11550, regioni_json: REGIONI, updated_date: `${anno}-01-10T00:00:00Z` });
  const NA = ritiriIn('NA', 'Campania', mesiFra('2026-01', '2026-09'), 'ET26NA');
  // Le letture dei contratti: ogni list o filter del banco passa una volta da __DB.CommessaEcotyre.
  let lettureContratti = 0;
  let dbVero;
  Object.defineProperty(globalThis, '__DB', { configurable: true, get: () => dbVero,
    set: (v) => { dbVero = new Proxy(v, { get: (t, k) => { if (k === 'CommessaEcotyre') lettureContratti++; return t[k]; } }); } });
  const conta = async (fn) => { lettureContratti = 0; const r = await fn(); return [r, lettureContratti]; };

  const [ott, letture] = await conta(() => gira('2026-10-15T10:00:00Z', { RegolaAlert: [REGOLA_PROV], PrimariaRete: NA, CommessaEcotyre: [contratto(2026)], Alert: [], UploadLog: [] }));
  const ba = nuovoDi(ott, 'rp').find(a => a.record_id === 'BA') || {};
  verifica('BA, del contratto e mai servita, ha il suo alert', ott.stato === 200 && ba.descrizione === "Provincia BA (Puglia), del contratto: nessun ritiro nell'anno (Gennaio 2026 - Settembre 2026). Pianificare le raccolte per rispettare i requisiti consorziali.", J([ott.j.error, ba.descrizione]));
  verifica('tutte le 22 province del contratto senza ritiri, e non NA che lavora', nuovoDi(ott, 'rp').length === 22 && !nuovoDi(ott, 'rp').some(a => a.record_id === 'NA'), J(nuovoDi(ott, 'rp').map(a => a.record_id)));
  verifica('una lettura dei contratti per giro, non una per provincia', letture === 1, String(letture));
  const [, senzaRegola] = await conta(() => gira('2026-10-15T10:00:00Z', { RegolaAlert: [REGOLA_PESO], PrimariaRete: NA, CommessaEcotyre: [contratto(2026)], Alert: [], UploadLog: [] }));
  verifica('senza la regola delle province i contratti non si leggono', senzaRegola === 0, String(senzaRegola));
  const senzaContratto = await gira('2026-10-15T10:00:00Z', { RegolaAlert: [REGOLA_PROV], PrimariaRete: NA, Alert: [], UploadLog: [] });
  verifica('senza contratto nell\'archivio la matrice e\' quella dei movimenti, come prima', senzaContratto.stato === 200 && nuovoDi(senzaContratto, 'rp').length === 0, J(nuovoDi(senzaContratto, 'rp').map(a => a.record_id)));

  // L'alert di BA scritto a dicembre (gennaio-novembre 2026) a gennaio 2027 non si
  // chiude: gennaio 2026 non lo guarda piu' nessuno.
  const [gen] = await conta(() => gira('2027-01-05T10:00:00Z', { RegolaAlert: [REGOLA_PROV], PrimariaRete: NA, CommessaEcotyre: [contratto(2026), contratto(2027)], UploadLog: [],
    Alert: [alertProv('pba', 'BA', "Provincia BA (Puglia), del contratto: nessun ritiro nell'anno (Gennaio 2026 - Novembre 2026). Pianificare le raccolte per rispettare i requisiti consorziali.", '2026-12-20T10:00:00.000000')] }));
  verifica('il 05/01/2027 l\'alert di BA del 2026 resta aperto', alertDi(gen, 'pba').stato === 'aperto', J(alertDi(gen, 'pba')));
  // A marzo 2027, col contratto 2027, BA e' ancora senza ritiri, ma l'alert del
  // 2026 non diventa quello del 2027 (revisione successiva, sezione 11): resta
  // sul 2026, si conta fra quelli da chiudere a mano e non ne nasce un altro.
  // Prima la prova pretendeva la riscrittura: poi, al primo ritiro di febbraio
  // 2027, l'alert si chiudeva «risolto» e il 2026 di BA spariva.
  const TESTO_BA_2026 = "Provincia BA (Puglia), del contratto: nessun ritiro nell'anno (Gennaio 2026 - Novembre 2026). Pianificare le raccolte per rispettare i requisiti consorziali.";
  const marzo = (alert) => conta(() => gira('2027-03-05T10:00:00Z', { RegolaAlert: [REGOLA_PROV], PrimariaRete: NA, CommessaEcotyre: [contratto(2026), contratto(2027)], UploadLog: [], Alert: [alert] }));
  const [mar] = await marzo(alertProv('pba', 'BA', TESTO_BA_2026, '2026-12-20T10:00:00.000000'));
  verifica('a marzo 2027 l\'alert di BA del 2026 resta aperto, col testo del 2026', alertDi(mar, 'pba').stato === 'aperto' && alertDi(mar, 'pba').descrizione === TESTO_BA_2026, J(alertDi(mar, 'pba')));
  verifica('e si conta fra quelli fuori perimetro, senza un alert nuovo di BA', mar.j.alerts_anni_non_controllati === 1 && !nuovoDi(mar, 'rp').some(a => a.record_id === 'BA'), J([mar.j.alerts_anni_non_controllati, nuovoDi(mar, 'rp').filter(a => a.record_id === 'BA')]));
  // chiuso a mano, al giro dopo nasce quello del 2027
  const [dopoMano] = await marzo({ ...alertProv('pba', 'BA', TESTO_BA_2026, '2026-12-20T10:00:00.000000'), stato: 'risolto' });
  verifica('chiuso a mano l\'alert del 2026, nasce quello del 2027', /nessun ritiro nell'anno \(Gennaio 2027 - Febbraio 2027\)/.test((nuovoDi(dopoMano, 'rp').find(a => a.record_id === 'BA') || {}).descrizione || ''), J(nuovoDi(dopoMano, 'rp').filter(a => a.record_id === 'BA')));
  delete globalThis.__DB;
}

// --- Revisione successiva del 13/10/2026 ---

// Un giro dopo l'altro, come sulla piattaforma: l'alert creato ha la data di
// creazione, quello riscritto o chiuso prende la data del giro.
async function giro(iso, db, modulo = 'primarie_rete') {
  const r = await gira(iso, db, modulo);
  const istante = iso.replace(/Z$/, '').replace(/\.\d+$/, '') + '.000000';
  const scritti = new Set(r.scritte.filter(s => s.entita === 'Alert' && s.op === 'bulkUpdate').flatMap(s => s.righe.map(x => x.id)));
  for (const a of r.db.Alert || []) {
    if (!a.created_date) { a.created_date = istante; a.updated_date = istante; }
    else if (scritti.has(a.id)) a.updated_date = istante;
  }
  return r;
}
const chiusoAMano = (db, id) => ({ ...db, Alert: db.Alert.map(a => (a.id === id ? { ...a, stato: 'risolto', risolto_note: 'chiuso a mano' } : a)) });
const apertiDi = (r, regola, chi) => (r.db.Alert || []).filter(a => a.regola_id === regola && a.record_id === chi && a.stato === 'aperto');

console.log("11. LE PROVINCE FUORI DAI MESI DELLA MATRICE NON SI RISCRIVONO CON LA COPPIA NUOVA");
{
  // CE lavora tutto il 2026 tranne ottobre e novembre; il ritiro del 28/12/2026
  // si registra il 07/01/2027 e arriva col caricamento dell'08/01 (il caso della
  // revisione, g1_ottobre_dicembre.mjs).
  const CE = ritiriIn('CE', 'Campania', mesiFra('2026-01', '2026-09'), 'ET26CE');
  const tardo = ritiro('ET26CEDIC', '2026-12-28', 5000, { provincia: 'CE', regione: 'Campania' });
  const OTT_NOV = testoProv('CE', 'Campania', 'Ottobre 2026 - Novembre 2026');
  const dic = await giro('2026-12-15T10:00:00Z', { RegolaAlert: [REGOLA_PROV], PrimariaRete: CE, Alert: [], UploadLog: [] });
  const ce = nuovoDi(dic, 'rp')[0] || {};
  verifica('il 15/12/2026 nasce l\'alert di CE su ottobre e novembre 2026', dic.stato === 200 && ce.descrizione === OTT_NOV, J([dic.j.error, ce.descrizione]));
  const gen5 = await giro('2027-01-05T10:00:00Z', dic.db);
  verifica('il 05/01/2027, con dicembre ancora vuoto, resta su ottobre-novembre e non diventa novembre-dicembre', alertDi(gen5, ce.id).stato === 'aperto'
    && alertDi(gen5, ce.id).descrizione === OTT_NOV && gen5.j.alerts_aggiornati === 0, J([alertDi(gen5, ce.id).descrizione, gen5.j.alerts_aggiornati]));
  verifica('si conta fra quelli da chiudere a mano, e finche\' e\' aperto non ne nasce un altro', gen5.j.alerts_anni_non_controllati === 1 && gen5.j.alerts_creati === 0 && apertiDi(gen5, 'rp', 'CE').length === 1,
    J([gen5.j.alerts_anni_non_controllati, gen5.j.alerts_creati]));
  const gen8 = await giro('2027-01-08T10:00:00Z', { ...gen5.db, PrimariaRete: [...gen5.db.PrimariaRete, tardo] });
  verifica('l\'08/01/2027, arrivato il ritiro di dicembre, non si chiude «risolto»: ottobre e novembre 2026 sono ancora a zero', alertDi(gen8, ce.id).stato === 'aperto'
    && alertDi(gen8, ce.id).descrizione === OTT_NOV && gen8.j.alerts_chiusi === 0 && gen8.j.alerts_anni_non_controllati === 1, J([alertDi(gen8, ce.id), gen8.j.alerts_chiusi]));
  // chiuso a mano il 05/01, al giro dopo nasce quello della coppia che la matrice vede
  const gen6 = await giro('2027-01-06T10:00:00Z', chiusoAMano(gen5.db, ce.id));
  verifica('chiuso a mano, al giro dopo nasce l\'alert di novembre-dicembre 2026', J(apertiDi(gen6, 'rp', 'CE').map(a => a.descrizione)) === J([testoProv('CE', 'Campania', 'Novembre 2026 - Dicembre 2026')]),
    J(apertiDi(gen6, 'rp', 'CE').map(a => a.descrizione)));
}
{
  // AV ferma a settembre-ottobre 2026, e a febbraio-marzo 2027 (g1_sovrascrittura.mjs).
  const AV = [...ritiriIn('AV', 'Campania', mesiFra('2026-01', '2026-12', ['2026-09', '2026-10']), 'ET26AV'),
    ...ritiriIn('AV', 'Campania', ['2027-01', '2027-04'], 'ET27AV')];
  const SET_OTT = testoProv('AV', 'Campania', 'Settembre 2026 - Ottobre 2026');
  const dic = await giro('2026-12-20T10:00:00Z', { RegolaAlert: [REGOLA_PROV], PrimariaRete: AV.filter(r => r.trasporto_finito_il < '2027'), Alert: [], UploadLog: [] });
  const av = nuovoDi(dic, 'rp')[0] || {};
  const gen = await giro('2027-01-02T10:00:00Z', { ...dic.db, PrimariaRete: AV.filter(r => r.trasporto_finito_il < '2027-01-02') });
  verifica('il 02/01/2027 l\'alert di AV resta aperto e si conta', av.descrizione === SET_OTT && alertDi(gen, av.id).stato === 'aperto' && gen.j.alerts_anni_non_controllati === 1, J([av.descrizione, alertDi(gen, av.id).stato, gen.j.alerts_anni_non_controllati]));
  const apr = await giro('2027-04-10T10:00:00Z', { ...gen.db, PrimariaRete: AV });
  verifica('il 10/04/2027, con febbraio e marzo 2027 a zero, resta su settembre-ottobre 2026 e si conta ancora', alertDi(apr, av.id).descrizione === SET_OTT
    && apr.j.alerts_anni_non_controllati === 1 && apr.j.alerts_creati === 0, J([alertDi(apr, av.id).descrizione, apr.j.alerts_anni_non_controllati, apr.j.alerts_creati]));
  const apr20 = await giro('2027-04-20T10:00:00Z', { ...apr.db, PrimariaRete: [...AV, ritiro('ET27AV03', '2027-03-28', 5000, { provincia: 'AV', regione: 'Campania' })] });
  verifica('il 20/04/2027, arrivato il ritiro di marzo, non si chiude: settembre e ottobre 2026 sono ancora a zero', alertDi(apr20, av.id).stato === 'aperto'
    && apr20.j.alerts_chiusi === 0 && apr20.j.alerts_anni_non_controllati === 1, J([alertDi(apr20, av.id), apr20.j.alerts_anni_non_controllati]));

  // Dentro i mesi della matrice si riscrive come prima: il 20/12/2026, arrivato
  // il ritiro di settembre, l'alert diventa quello di ottobre-novembre.
  const AV2 = ritiriIn('AV', 'Campania', mesiFra('2026-01', '2026-12', ['2026-10', '2026-11']), 'ET26AV');
  const dentro = await giro('2026-12-20T10:00:00Z', { RegolaAlert: [REGOLA_PROV], PrimariaRete: AV2, UploadLog: [],
    Alert: [alertProv('pv9', 'AV', SET_OTT, '2026-11-15T10:00:00.000000')] });
  verifica('dentro i mesi della matrice l\'alert si riscrive con la coppia nuova, e non si conta', alertDi(dentro, 'pv9').stato === 'aperto'
    && alertDi(dentro, 'pv9').descrizione === testoProv('AV', 'Campania', 'Ottobre 2026 - Novembre 2026') && dentro.j.alerts_aggiornati === 1 && dentro.j.alerts_anni_non_controllati === 0,
    J([alertDi(dentro, 'pv9').descrizione, dentro.j.alerts_aggiornati, dentro.j.alerts_anni_non_controllati]));
}

console.log("12. LE REGOLE DI TRATTA SULL'ANNO PRIMA: CONTA LA DATA DELLA REGOLA");
{
  const viaggio = (i, giorno, destinazione, anno = '26') => ({ id: 's-' + anno + i, id_ordine: `ET${anno}S` + String(i).padStart(4, '0'), numero_fir: `FIRS${anno}${i}`, stato: 'terminato', peso_effettivo: 20000,
    ordine_immesso_il: giorno + 'T08:00:00Z', trasporto_iniziato_il: giorno + 'T08:00:00Z', trasporto_finito_il: giorno + 'T10:00:00Z',
    stoccaggio: 'NAPPI SUD SRL', destinazione, trasportatore: 'NAPPI SUD SRL' });
  const viaggi = [];
  for (let i = 0; i < 20; i++) viaggi.push(viaggio(i, `2026-${String(1 + (i % 12)).padStart(2, '0')}-1${i % 9}`, 'IRIGOM SRL'));
  // La regola porta le date della piattaforma, senza fuso: sono UTC.
  const tratta = (ammesse, creata, cambiata = creata) => ({ id: 'rt', modulo: 'secondarie', attiva: true, tipo_regola: 'tratta_autorizzata', severita: 'warning', nome: 'Tratta Nappi Sud',
    created_date: creata, updated_date: cambiata,
    config: { campo_origine: 'stoccaggio', valore_origine: 'NAPPI SUD SRL', campo_destinazione: 'destinazione', destinazioni_ammesse: ammesse } });
  const MAI_TOCCATA = tratta(['IRIGOM SRL'], '2026-03-01T09:00:00.000000');
  const tardi = viaggio(99, '2026-12-30', 'GATIM SRL');
  const sulTardi = (r) => (r.db.Alert || []).filter(a => a.record_id === 'ET26S0099' && a.regola_id === 'rt');

  // Il caso della revisione (g1_tratta_dicembre.mjs).
  const dic = await giro('2026-12-31T10:00:00Z', { RegolaAlert: [MAI_TOCCATA], Secondaria: viaggi, Alert: [], UploadLog: [] }, 'secondarie');
  const gen = await giro('2027-01-05T10:00:00Z', { ...dic.db, Secondaria: [...viaggi, tardi] }, 'secondarie');
  verifica('il viaggio del 30/12/2026 a Gatim registrato a gennaio, con la regola del 2026 mai toccata, apre il suo alert il 05/01/2027',
    gen.stato === 200 && sulTardi(gen).length === 1 && /destinazione non ammessa "GATIM SRL"/.test(sulTardi(gen)[0].descrizione || ''), J([gen.j.error, sulTardi(gen)]));
  const feb = await giro('2027-02-20T10:00:00Z', gen.db, 'secondarie');
  verifica('il 20/02/2027 e\' ancora uno, aperto', sulTardi(feb).length === 1 && sulTardi(feb)[0].stato === 'aperto', J(sulTardi(feb)));
  const mar = await giro('2027-03-05T10:00:00Z', { ...dic.db, Secondaria: [...viaggi, tardi] }, 'secondarie');
  verifica('arrivato a marzo, l\'anno prima non apre piu\' (come peso e rotte)', sulTardi(mar).length === 0, J(sulTardi(mar)));

  // Una regola creata o cambiata nel 2027 (anche solo disattivata e riattivata) non misura il 2026.
  for (const [nome, regola] of [
    ['disattivata e riattivata il 02/01/2027', tratta(['IRIGOM SRL'], '2026-03-01T09:00:00.000000', '2027-01-02T09:00:00.000000')],
    ['rifatta il 03/01/2027', tratta(['IRIGOM SRL'], '2027-01-03T09:00:00.000000')],
    ['scritta alle 23:30 UTC del 31/12/2026, cioe\' il 01/01/2027 in Italia', tratta(['IRIGOM SRL'], '2026-12-31T23:30:00Z')],
  ]) {
    const r = await giro('2027-01-05T10:00:00Z', { RegolaAlert: [regola], Secondaria: [...viaggi, tardi], Alert: [], UploadLog: [] }, 'secondarie');
    verifica(`regola ${nome}: nessun alert sul viaggio del 2026`, r.stato === 200 && sulTardi(r).length === 0, J([r.j.error, sulTardi(r)]));
  }

  // L'alert gia' aperto su un viaggio del 2026 a Gatim, e a gennaio 2027 la
  // regola rifatta ammette Gatim (la domanda G1-b): non si chiude «risolto», nel
  // 2026 era un errore. Resta com'e' e si conta.
  const gatim = viaggio(50, '2026-12-03', 'GATIM SRL');
  const TESTO_AT = 'Record ET26S0050: origine "NAPPI SUD SRL" con destinazione non ammessa "GATIM SRL". Destinazioni ammesse: IRIGOM SRL.';
  const apertoT = { id: 'at2', modulo: 'secondarie', stato: 'aperto', record_id: 'ET26S0050', regola_id: 'rt', regola_nome: 'Tratta Nappi Sud', entity_type: 'Secondaria',
    titolo: 'Destinazione non autorizzata per NAPPI SUD SRL', descrizione: TESTO_AT, severita: 'warning', created_date: '2026-12-04T10:00:00.000000', updated_date: '2026-12-04T10:00:00.000000' };
  const conGatim = tratta(['IRIGOM SRL', 'GATIM SRL'], '2027-01-03T09:00:00.000000');
  const ammessa = await giro('2027-01-05T10:00:00Z', { RegolaAlert: [conGatim], Secondaria: [...viaggi, gatim], Alert: [apertoT], UploadLog: [] }, 'secondarie');
  verifica('ammessa Gatim nel 2027, l\'alert del viaggio del 2026 resta aperto, com\'era', alertDi(ammessa, 'at2').stato === 'aperto' && alertDi(ammessa, 'at2').descrizione === TESTO_AT
    && ammessa.j.alerts_chiusi === 0, J([alertDi(ammessa, 'at2'), ammessa.j.alerts_chiusi]));
  verifica('e si conta fra quelli da chiudere a mano', ammessa.j.alerts_anni_non_controllati === 1, J(ammessa.j.alerts_anni_non_controllati));
  const aprileAmmessa = await giro('2027-04-10T10:00:00Z', { RegolaAlert: [conGatim], Secondaria: [...viaggi, gatim], Alert: [apertoT], UploadLog: [] }, 'secondarie');
  verifica('anche ad aprile', alertDi(aprileAmmessa, 'at2').stato === 'aperto' && aprileAmmessa.j.alerts_anni_non_controllati === 1, J([alertDi(aprileAmmessa, 'at2').stato, aprileAmmessa.j.alerts_anni_non_controllati]));
  // con la regola rifatta nel 2027 il motore il 2026 non lo misura: corretto il viaggio, l'alert si chiude a mano
  const rifatta = tratta(['IRIGOM SRL'], '2027-01-03T09:00:00.000000');
  const corretto = await giro('2027-01-05T10:00:00Z', { RegolaAlert: [rifatta], Secondaria: [...viaggi, { ...gatim, destinazione: 'IRIGOM SRL' }], Alert: [apertoT], UploadLog: [] }, 'secondarie');
  verifica('con la regola rifatta nel 2027, corretto il viaggio del 2026 l\'alert resta da chiudere a mano', alertDi(corretto, 'at2').stato === 'aperto' && corretto.j.alerts_anni_non_controllati === 1,
    J([alertDi(corretto, 'at2'), corretto.j.alerts_anni_non_controllati]));
  // la regola del 2026 mai toccata invece lo chiude (sezione 9)
  const mai = await giro('2027-01-05T10:00:00Z', { RegolaAlert: [MAI_TOCCATA], Secondaria: [...viaggi, { ...gatim, destinazione: 'IRIGOM SRL' }], Alert: [apertoT], UploadLog: [] }, 'secondarie');
  verifica('con la regola del 2026 mai toccata, corretto il viaggio, si chiude coi dati 2026', alertDi(mai, 'at2').stato === 'risolto' && /: condizione non presente nei dati 2026$/.test(alertDi(mai, 'at2').risolto_note || ''), J(alertDi(mai, 'at2')));
  // sul 2027 la regola rifatta vale come sempre
  const nuovo = await giro('2027-01-05T10:00:00Z', { RegolaAlert: [rifatta], Secondaria: [...viaggi, gatim, viaggio(7, '2027-01-04', 'GATIM SRL', '27')], Alert: [apertoT], UploadLog: [] }, 'secondarie');
  verifica('e un viaggio del 2027 a Gatim apre il suo alert', J(nuovoDi(nuovo, 'rt').map(a => a.record_id)) === J(['ET27S0007']), J(nuovoDi(nuovo, 'rt').map(a => a.record_id)));

  // Gli altri due tipi di regola di tratta, sulle primarie (come la sezione 9): con
  // le date del 2026 aprono anche sul ritiro del 2026, con quelle del 2027 no.
  const ALTRE = (creata) => [
    { id: 'tc', modulo: 'primarie_rete', attiva: true, tipo_regola: 'tratta_combinazione', severita: 'warning', nome: 'Combinazione', created_date: creata, updated_date: creata,
      config: { campo_classe: 'classe', valore_classe: 'A', campo_origine: 'trasportatore', origine_ammessa: 'NAPPI SUD SRL', campo_destinazione: 'destinazione', destinazione_ammessa: 'IRIGOM SRL' } },
    { id: 'tk', modulo: 'primarie_rete', attiva: true, tipo_regola: 'tratte_autorizzate_classe', severita: 'warning', nome: 'Tratte per classe', created_date: creata, updated_date: creata,
      config: { classe: 'A', campo_origine: 'trasportatore', campo_destinazione: 'destinazione', combinazioni_ammesse: [{ origine: 'NAPPI SUD SRL', destinazione: 'IRIGOM SRL' }] } },
  ];
  const fuori = (id, giorno) => ritiro(id, giorno, 5000, { destinazione: 'GATIM SRL' });
  const PRI = [fuori('ET26170011', '2026-12-28'), fuori('ET27170012', '2027-01-04')];
  for (const [creata, attesi] of [['2026-05-01T09:00:00.000000', ['ET26170011', 'ET27170012']], ['2027-01-02T09:00:00.000000', ['ET27170012']]]) {
    const r = await giro('2027-01-05T10:00:00Z', { RegolaAlert: ALTRE(creata), PrimariaRete: PRI, Alert: [], UploadLog: [] });
    for (const id of ['tc', 'tk']) {
      verifica(`${id === 'tc' ? 'tratta_combinazione' : 'tratte_autorizzate_classe'} scritta il ${creata.slice(0, 10)}: alert su ${attesi.join(' e ')}`,
        J(nuovoDi(r, id).map(a => a.record_id).sort()) === J(attesi), J([r.j.error, nuovoDi(r, id).map(a => a.record_id)]));
    }
  }
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
