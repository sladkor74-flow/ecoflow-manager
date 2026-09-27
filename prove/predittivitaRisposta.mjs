// Prova della risposta della predittivita' delle secondarie
// (base44/shared/predittivitaRisposta.ts), quella che leggono la pagina e gli
// assistenti, e del programma fissato in PianificazioneSettimanale:
//   - fra due righe dello stesso percorso e della stessa settimana vale quella
//     corretta a mano, poi la piu' recente; le righe del piano di prima (senza
//     origine) non contano;
//   - il programma del mercoledi' non sovrascrive le righe corrette a mano;
//   - settimana per settimana, il programmato resta quello fissato e accanto
//     c'e' il fatto: non diventa mai uguale all'arrivato;
//   - un anno chiuso si guarda al 31 dicembre, in sola lettura.
// Il giorno e' fissato a mercoledi' 23/09/2026. npm run prove
import { programmatiPerPercorso, fissaProgramma, predittivitaDellAnno, rispostaPredittivita, annoInCorso } from '../base44/shared/predittivitaRisposta.ts';
import { normalizzaRagioneSociale as chiave } from '../base44/shared/normalizzaRagioneSociale.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);

// --- il giorno fisso: mercoledi' 23/09/2026 alle 8 italiane
const ADESSO = Date.parse('2026-09-23T06:00:00Z');
const DataVera = Date;
class DataFissa extends DataVera {
  constructor(...a) { super(...(a.length ? a : [ADESSO])); }
  static now() { return ADESSO; }
}
globalThis.Date = DataFissa;

console.log('IL PROGRAMMA FISSATO, PERCORSO PER PERCORSO');
const fissati = programmatiPerPercorso([
  { id: 'a', data_inizio: '2026-09-28', fornitore_nome: 'Nappi Sud', impianto_nome: 'Tecnogum Srl', viaggi_previsti: 5, origine: 'programma', updated_date: '2026-09-23T06:00:00' },
  { id: 'b', data_inizio: '2026-09-28T00:00:00', fornitore_nome: 'NAPPI SUD SRL', impianto_nome: 'TECNOGUM', viaggi_previsti: 7, origine: 'manuale', updated_date: '2026-09-22T10:00:00' },
  { id: 'c', data_inizio: '2026-09-28', fornitore_nome: 'Nappi Sud', impianto_nome: 'Irigom', viaggi_previsti: 1, origine: 'programma', created_date: '2026-09-16T06:00:00' },
  { id: 'd', data_inizio: '2026-09-28', fornitore_nome: 'Nappi Sud', impianto_nome: 'Irigom', viaggi_previsti: 2, origine: 'programma', created_date: '2026-09-23T06:00:00' },
  { id: 'e', data_inizio: '2026-09-28', fornitore_nome: 'T-Cycle', impianto_nome: 'Tecnogum', viaggi_previsti: 9 },           // il piano di prima
  { id: 'f', data_inizio: '2026-09-21', fornitore_nome: 'Nappi Sud', impianto_nome: 'Tecnogum', viaggi_previsti: 3, origine: 'programma' },
  null,
]);
verifica('la riga corretta a mano vale piu\' del programma, anche se e\' piu\' vecchia; i nomi si confrontano normalizzati', fissati.get('2026-09-28|nappi sud|tecnogum').id === 'b', J([...fissati.values()].map(r => r.id)));
verifica('fra due righe del programma vale la piu\' recente', fissati.get('2026-09-28|nappi sud|irigom').id === 'd');
verifica('le righe senza origine non contano; ogni settimana ha le sue', !fissati.has('2026-09-28|t-cycle|tecnogum') && fissati.get('2026-09-21|nappi sud|tecnogum').id === 'f' && fissati.size === 3, J([...fissati.keys()]));
verifica('niente righe, niente programma', programmatiPerPercorso(null).size === 0 && programmatiPerPercorso([]).size === 0);

console.log('FISSARE IL PROGRAMMA');
const scritture = [];
const archivio = {
  PianificazioneSettimanale: {
    create: async (d) => { scritture.push({ op: 'create', d }); return { id: 'nuova', ...d }; },
    update: async (id, d) => { scritture.push({ op: 'update', id, d }); return { id, ...d }; },
  },
};
const esistenti = [
  { id: 'm1', data_inizio: '2026-09-28', fornitore_nome: 'Nappi Sud', impianto_nome: 'Tecnogum Srl', viaggi_previsti: 6, origine: 'manuale' },
  { id: 'p1', data_inizio: '2026-09-28', fornitore_nome: 'NAPPI SUD SRL', impianto_nome: 'Irigom', viaggi_previsti: 1, origine: 'programma' },
  { id: 'v1', data_inizio: '2026-09-28', fornitore_nome: 'T-Cycle', impianto_nome: 'Tecnogum', viaggi_previsti: 9 },
  { id: 'a1', data_inizio: '2026-09-21', fornitore_nome: 'T-Cycle', impianto_nome: 'Tecnogum', viaggi_previsti: 2, origine: 'programma' },
];
const mercoledi = await fissaProgramma(archivio, {
  anno: 2026, settimana: '2026-09-28', kgPerViaggio: 13000, manuale: false, esistenti,
  righe: [
    { stoccaggio: 'Nappi Sud', impianto: 'Tecnogum Srl', viaggi: 4, motivo: 'Priorita\'' },
    { stoccaggio: 'Nappi Sud', impianto: 'Irigom Srl', viaggi: 3.4, motivo: 'Avanzo' },
    { stoccaggio: 'T-Cycle', impianto: 'Tecnogum Srl', viaggi: -2 },
  ],
});
verifica('il mercoledi\' non tocca la riga corretta a mano', mercoledi.lasciate === 1 && mercoledi.scritte === 2 && !scritture.some(s => s.id === 'm1'), J([mercoledi, scritture]));
const aggiornata = scritture.find(s => s.id === 'p1');
verifica('la riga del programma della stessa settimana si aggiorna, non se ne crea un\'altra', aggiornata && aggiornata.op === 'update' && J(aggiornata.d) === J({ anno: 2026, data_inizio: '2026-09-28', data_fine: '2026-10-04', settimana_numero: 40, impianto_id: 'irigom', fornitore_nome: 'Nappi Sud', impianto_nome: 'Irigom Srl', viaggi_previsti: 3, kg_previsti: 39000, origine: 'programma', modificato_manuale: false, stato: 'programmato', note: 'Avanzo' }), J(aggiornata));
verifica('i campi che lo schema chiede ci sono sempre: impianto, numero e inizio della settimana', scritture.every(x => x.d.impianto_id && x.d.settimana_numero === 40 && x.d.data_inizio === '2026-09-28'), J(scritture.map(x => x.d)));
const creata = scritture.find(s => s.op === 'create');
verifica('una riga nuova per un percorso che non l\'aveva (quella senza origine non conta), mai sotto zero', creata && creata.d.fornitore_nome === 'T-Cycle' && creata.d.viaggi_previsti === 0 && creata.d.kg_previsti === 0 && creata.d.origine === 'programma' && scritture.length === 2, J(scritture));
scritture.length = 0;
const aMano = await fissaProgramma(archivio, { anno: 2026, settimana: '2026-09-28', kgPerViaggio: 13000, manuale: true, esistenti, righe: [{ stoccaggio: 'Nappi Sud', impianto: 'Tecnogum', viaggi: 7, motivo: 'Corretto a mano' }, { stoccaggio: 'Nappi Sud', impianto: 'Irigom', viaggi: 2 }] });
verifica('una correzione a mano riscrive la riga a mano e quella del programma', aMano.scritte === 2 && aMano.lasciate === 0 && scritture.map(s => `${s.op}:${s.id}:${s.d.origine}:${s.d.modificato_manuale}:${s.d.viaggi_previsti}`).join() === 'update:m1:manuale:true:7,update:p1:manuale:true:2', J(scritture));

console.log('LE SETTIMANE: PROGRAMMATO E FATTO');
// --- un SDK finto per leggere tutto il percorso: lettura, motore, risposta
const corrisponde = (valore, atteso) => {
  if (atteso === null) return valore === null || valore === undefined;
  if (atteso && typeof atteso === 'object' && !Array.isArray(atteso)) {
    if ('$gte' in atteso && !(valore !== null && valore !== undefined && String(valore) >= String(atteso.$gte))) return false;
    if ('$in' in atteso && !atteso.$in.includes(valore)) return false;
    return true;
  }
  return valore === atteso;
};
const sdkFinto = (archivi) => {
  const entita = (nome) => ({
    filter: async (f, _o, quanti = 1e9, salta = 0) => (archivi[nome] || []).filter(r => Object.entries(f || {}).every(([k, v]) => corrisponde(r[k], v))).slice(salta, salta + quanti),
    list: async (_o, quanti = 1e9, salta = 0) => (archivi[nome] || []).slice(salta, salta + quanti),
  });
  const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
  return { asServiceRole: { entities }, entities };
};
let n = 0;
const alle12 = (g) => `${g}T10:00:00Z`;
const date = (g) => ({ ordine_immesso_il: alle12(g), trasporto_iniziato_il: alle12(g), trasporto_finito_il: alle12(g) });
const prim = (trasportatore, destinazione, kg, giorno, extra = {}) => ({ id: 'p' + (++n), id_ordine: 'P' + n, stato: 'terminato', classe: 'P', trasportatore, destinazione, tipo_destinazione: 'imp', peso_effettivo: kg, ...date(giorno), ...extra });
const sec = (giorno, destinazione, automezzo, extra = {}) => ({ id: 's' + (++n), id_ordine: 'S' + n, stato: 'terminato', classe: 'P', stoccaggio: 'Nappi Sud', destinazione, tipo_destinazione: 'imp', peso_effettivo: 13000, automezzo, ...date(giorno), ...extra });
const riga = (settimana, fornitore_nome, impianto_nome, viaggi_previsti, origine, extra = {}) => ({ id: `w${++n}`, anno: 2026, data_inizio: settimana, fornitore_nome, impianto_nome, viaggi_previsti, origine, ...extra });
const ARCHIVI = {
  ImpiantoTargetSecondaria: [
    { id: 'iTg', nome_impianto: 'Tecnogum Srl', target: 1159000, stato: 'attivo' },
    { id: 'iIr', nome_impianto: 'Irigom Srl', target: 679000, stato: 'attivo' },
  ],
  FornitoreSecondaria: [
    { nome: 'Nappi Sud', impianto_id: 'iTg', ruolo: 'stoccaggio', stato: 'attivo' },
    { nome: 'Nappi Sud', impianto_id: 'iIr', ruolo: 'stoccaggio', stato: 'attivo' },
  ],
  TargetRaccoglitore: [],
  PrimariaRete: [
    prim('Ecorecuperi', 'Tecnogum Srl', 300000, '2026-03-02'),
    prim('SMOCO', 'Irigom', 100000, '2026-03-02'),
    prim('Nappi Sud', 'Nappi Sud', 70000, '2026-09-06', { tipo_destinazione: 'stoc' }),
    // un ordine in due righe (due classi), senza la data di inizio trasporto
    prim('Ecorecuperi', 'Tecnogum Srl', 1000, '2026-09-10', { id_ordine: 'ORD-DUE', classe: 'P', trasporto_iniziato_il: null }),
    prim('Ecorecuperi', 'Tecnogum Srl', 1000, '2026-09-10', { id_ordine: 'ORD-DUE', classe: 'M', trasporto_iniziato_il: null }),
  ],
  Secondaria: [
    // settimana dal 07/09: 3 viaggi (lo stesso camion porta due formulari l'8)
    sec('2026-09-08', 'Tecnogum Srl', 'AB123CD'), sec('2026-09-08', 'Tecnogum Srl', 'AB 123 CD', { classe: 'M', peso_effettivo: 1000 }),
    sec('2026-09-09', 'Tecnogum Srl', 'AB123CD'), sec('2026-09-10', 'Tecnogum Srl', 'XY999ZZ'),
    // settimana dal 14/09: 5 per Tecnogum, 2 per Irigom
    ...['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'].map(g => sec(g, 'Tecnogum Srl', 'AB123CD')),
    sec('2026-09-15', 'Irigom', 'XY999ZZ'), sec('2026-09-16', 'Irigom', 'XY999ZZ'),
    // settimana in corso: 1
    sec('2026-09-21', 'Tecnogum Srl', 'AB123CD'),
  ],
  GiacenzaStoccaggio: [{ sito: 'Nappi Sud', data_rilevazione: '2025-12-31', class1_kg: 800000 }],
  PianificazioneSettimanale: [
    riga('2026-09-07', 'Nappi Sud', 'Tecnogum Srl', 4, 'programma'),
    riga('2026-09-07', 'Nappi Sud', 'Irigom Srl', 9, undefined),                                   // il piano di prima: non conta
    riga('2026-09-14', 'Nappi Sud', 'Tecnogum Srl', 5, 'programma', { updated_date: '2026-09-09T06:00:00' }),
    riga('2026-09-14', 'NAPPI SUD SRL', 'TECNOGUM', 6, 'manuale', { updated_date: '2026-09-08T06:00:00' }),
    riga('2026-09-21', 'Nappi Sud', 'Tecnogum Srl', 4, 'programma'),
    riga('2026-09-28', 'Nappi Sud', 'Tecnogum Srl', 5, 'programma'),
    riga('2026-09-28', 'Nappi Sud', 'Irigom Srl', 2, 'manuale'),
    riga('2026-10-05', 'Nappi Sud', 'Tecnogum Srl', 5, 'programma'),                              // oltre la settimana dopo
  ],
  UploadLog: [],
};
const base44 = sdkFinto(ARCHIVI);
verifica('l\'anno in corso e\' quello italiano di oggi', annoInCorso() === 2026);
const { dati, calcolo, risposta } = await predittivitaDellAnno(base44, { puoFissare: true });
verifica('l\'anno in corso, oggi, e chi puo\' fissare', risposta.anno === 2026 && risposta.oggi === '2026-09-23' && risposta.sola_lettura === false && risposta.puo_fissare === true && risposta.dati_al === '2026-09-21' && risposta.settimana_scorsa_completa === true, J([risposta.anno, risposta.oggi, risposta.dati_al]));
const sett = (settimana, impianto) => risposta.settimane.find(x => x.settimana === settimana && x.impianto.toLowerCase().startsWith(impianto));
verifica('dalla settimana piu\' recente; nessuna oltre la settimana dopo', risposta.settimane.map(x => `${x.settimana}:${chiave(x.stoccaggio)}:${chiave(x.impianto)}`).join() === '2026-09-28:nappi sud:irigom,2026-09-28:nappi sud:tecnogum,2026-09-21:nappi sud:tecnogum,2026-09-14:nappi sud:irigom,2026-09-14:nappi sud:tecnogum,2026-09-07:nappi sud:tecnogum', J(risposta.settimane.map(x => `${x.settimana}:${x.stoccaggio}:${x.impianto}`)));
verifica('il programmato resta quello fissato, accanto il fatto', J(sett('2026-09-07', 'tecnogum')) === J({ settimana: '2026-09-07', stoccaggio: 'Nappi Sud', impianto: 'Tecnogum Srl', programmati: 4, programmati_manuale: false, fatti: 3, fatti_kg: 40000, al: '2026-09-13', aperta: false }), J(sett('2026-09-07', 'tecnogum')));
verifica('la correzione a mano vale piu\' del programma', sett('2026-09-14', 'tecnogum').programmati === 6 && sett('2026-09-14', 'tecnogum').programmati_manuale === true && sett('2026-09-14', 'tecnogum').fatti === 5, J(sett('2026-09-14', 'tecnogum')));
verifica('fatto senza programma: il programmato non c\'e\', non e\' zero', sett('2026-09-14', 'irigom').programmati === null && sett('2026-09-14', 'irigom').fatti === 2, J(sett('2026-09-14', 'irigom')));
verifica('la settimana in corso e la settimana dopo sono aperte', sett('2026-09-21', 'tecnogum').aperta === true && sett('2026-09-21', 'tecnogum').fatti === 1 && sett('2026-09-21', 'tecnogum').programmati === 4 && sett('2026-09-28', 'tecnogum').aperta === true && sett('2026-09-28', 'tecnogum').fatti === 0 && sett('2026-09-14', 'tecnogum').aperta === false);
verifica('la riga del piano di prima non compare', !risposta.settimane.some(x => x.programmati === 9));

console.log('IL PROGRAMMA DELLA SETTIMANA DOPO, CON QUELLO FISSATO');
const pr = (impianto) => risposta.programma.find(r => r.impianto === impianto);
verifica('accanto al calcolo, quello gia\' fissato', J(pr('Tecnogum Srl').fissato) === J({ viaggi: 5, manuale: false, id: ARCHIVI.PianificazioneSettimanale[5].id }) && J(pr('Irigom Srl').fissato) === J({ viaggi: 2, manuale: true, id: ARCHIVI.PianificazioneSettimanale[6].id }), J(risposta.programma));
verifica('i numeri del programma sono quelli del motore', risposta.programma.length === calcolo.programma.length && risposta.programma.every((r, i) => r.viaggi === calcolo.programma[i].viaggi && r.motivo === calcolo.programma[i].motivo));
const senzaFissati = rispostaPredittivita({ dati: { ...dati, programmati: [] }, calcolo, anno: 2026, oggi: '2026-09-23', solaLettura: false, puoFissare: false });
verifica('niente fissato: fissato e\' vuoto, e le settimane hanno solo il fatto', senzaFissati.programma.every(r => r.fissato === null) && senzaFissati.settimane.every(x => x.programmati === null) && senzaFissati.settimane.length === 4 && senzaFissati.puo_fissare === false, J(senzaFissati.settimane));

console.log('LA FORMA DELLA RISPOSTA');
const chiavi = (o) => Object.keys(o).sort().join();
verifica('i campi della risposta', chiavi(risposta) === 'anno,avvisi,configurazione_vuota,dati_al,fine,finestra_ritmo,impianti,kg_per_viaggio,lettura,oggi,programma,prossima_settimana,puo_fissare,regole_definite,settimana_scorsa_completa,settimane,sola_lettura,stoccaggi', chiavi(risposta));
verifica('i campi di un impianto', chiavi(risposta.impianti[0]) === 'chiave,composizione,coperto_secondarie,da_stoccaggi,fabbisogno_secondarie,fine,gia_arrivato_kg,mancanza_kg,nome,note,orizzonte,primaria_attesa,primarie,raggiunge,residuo_kg,senza_stoccaggi,target_kg,target_superato', chiavi(risposta.impianti[0]));
verifica('i campi di uno stoccaggio, e il nome delle destinazioni', chiavi(risposta.stoccaggi[0]) === 'chiave,destinazioni,disponibile,e_impianto,entrate_attese,entrate_flussi,fine,giacenza_da,giacenza_kg,nome,non_assegnato,partiti_verso_altri_kg,plafond_kg,residuo_plafond_kg,viaggi_prossima_settimana' && risposta.stoccaggi[0].destinazioni.map(d => d.nome).join() === 'Tecnogum Srl,Irigom Srl', J(risposta.stoccaggi[0]));
verifica('i campi di una riga del programma', chiavi(pr('Tecnogum Srl')) === 'chiave_impianto,fissato,impianto,kg,media_settimanale,motivo,priorita,spettanti,stoccaggio,viaggi', chiavi(pr('Tecnogum Srl')));
verifica('niente record interi nella risposta', !/trasporto_finito_il|"record"|"movimenti"/.test(J(risposta)));
verifica('la composizione del gia\' arrivato', J(risposta.impianti.find(i => i.chiave === 'tecnogum').composizione) === J({ primaria_impianto_kg: 302000, primaria_piazzale_netta_kg: 0, piazzale_ripartito_kg: 0, secondaria_kg: 13000 * 9 + 1000 }), J(risposta.impianti.find(i => i.chiave === 'tecnogum').composizione));
verifica('la lettura', risposta.lettura.dal === '2025-12-31' && risposta.lettura.primarie === 5 && risposta.lettura.secondarie === 12, J(risposta.lettura));

console.log('GLI AVVISI');
const date_ = risposta.avvisi.find(a => a.tipo === 'date_da_sistemare');
verifica('le date da sistemare dei formulari letti: un ordine in due righe e\' un ordine', date_ && date_.testo.includes('manca la data di inizio trasporto, 1 ordine (ORD-DUE)'), J(risposta.avvisi));
const conCaricamento = rispostaPredittivita({ dati: { ...dati, caricamento_in_corso: 'secondarie del 23/09/2026: non ancora concluso' }, calcolo, anno: 2026, oggi: '2026-09-23', solaLettura: false, puoFissare: true });
verifica('un caricamento in corso e\' il primo avviso, ed e\' grave', conCaricamento.avvisi[0].tipo === 'caricamento_in_corso' && conCaricamento.avvisi[0].grave === true && conCaricamento.avvisi[0].testo.startsWith('secondarie del 23/09/2026'), J(conCaricamento.avvisi[0]));
const senzaFine = rispostaPredittivita({ dati: { ...dati, senza_fine: null }, calcolo, anno: 2026, oggi: '2026-09-23', solaLettura: false, puoFissare: true });
verifica('se i senza fine trasporto non si sono letti si dice', senzaFine.avvisi.some(a => a.tipo === 'senza_fine_non_letti') && !risposta.avvisi.some(a => a.tipo === 'senza_fine_non_letti'));

console.log('UN ANNO CHIUSO');
const chiuso = await predittivitaDellAnno(base44, { anno: 2025, puoFissare: true });
verifica('si guarda al 31 dicembre, in sola lettura, e non si fissa niente', chiuso.risposta.anno === 2025 && chiuso.risposta.oggi === '2025-12-31' && chiuso.risposta.sola_lettura === true && chiuso.risposta.puo_fissare === false, J([chiuso.risposta.oggi, chiuso.risposta.sola_lettura, chiuso.risposta.puo_fissare]));
verifica('con la sua configurazione (qui nessuna)', chiuso.risposta.configurazione_vuota === true && chiuso.risposta.impianti.length === 0 && chiuso.risposta.programma.length === 0);
verifica('i dati di un anno chiuso si fermano al 31/12', chiuso.risposta.dati_al <= '2025-12-31');

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
