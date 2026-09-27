// Prova delle tre funzioni della predittivita' delle secondarie sugli stessi
// archivi, dopo la rifondazione del 26/09/2026: un motore solo
// (base44/shared/predittivita.ts) e una risposta sola (predittivitaRisposta.ts).
//   - calcolaPianificazioneSecondaria: aprire la pagina non scrive niente; solo
//     l'amministratore fissa a mano i viaggi di una settimana (azione 'fissa'),
//     mai su una settimana passata ne' su un anno chiuso;
//   - proiezioneSecondarie: la stessa risposta, per chi la chiama con questo nome;
//   - analisiSettimanalePredittiva (il mercoledi' alle 8): fissa il programma
//     della settimana dopo e non tocca le righe corrette a mano; non scrive su un
//     archivio che si sta caricando.
// E restano vere le regole del gia' arrivato di rete (giaArrivatoDiRete, 22 e
// 25/09/2026): lo stesso numero ovunque, il piazzale di T-Cycle al netto di
// quello che riparte per Tecnogum, i trasbordi a se stesso che non consumano il
// plafond.
//
// Le funzioni importano l'SDK da npm: qui si impacchettano con esbuild (quello
// di vite, gia' fra i pacchetti) e un SDK finto che legge e scrive gli archivi di
// globalThis.__ARCHIVI, capisce i filtri della piattaforma ($gte, $in, null) e
// annota le scritture in globalThis.__SCRITTI. L'utente e' globalThis.__UTENTE
// (null: il workflow, senza utente). Il giorno e' fissato a mercoledi'
// 23/09/2026 alle 8 italiane. npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));

// --- il giorno fisso
const ADESSO = Date.parse('2026-09-23T06:00:00Z');
const DataVera = Date;
class DataFissa extends DataVera {
  constructor(...a) { super(...(a.length ? a : [ADESSO])); }
  static now() { return ADESSO; }
}
globalThis.Date = DataFissa;

// --- l'SDK finto
const SDK_FINTO = `
const corrisponde = (valore, atteso) => {
  if (atteso === null) return valore === null || valore === undefined;
  if (atteso && typeof atteso === 'object' && !Array.isArray(atteso)) {
    for (const op of Object.keys(atteso)) if (op !== '$gte' && op !== '$in') throw new Error('operatore sconosciuto: ' + op);
    if ('$gte' in atteso && !(valore !== null && valore !== undefined && String(valore) >= String(atteso.$gte))) return false;
    if ('$in' in atteso && !atteso.$in.includes(valore)) return false;
    return true;
  }
  return valore === atteso;
};
let orologio = 0;
const istante = () => new Date(Date.now() + (++orologio) * 1000).toISOString().replace('Z', '');
function entita(nome) {
  const righe = () => (globalThis.__ARCHIVI[nome] ||= []);
  const scrivi = (x) => { globalThis.__SCRITTI.push({ nome, ...x }); };
  return {
    filter: async (f, _o, quanti = 1e9, salta = 0) => righe().filter(r => Object.entries(f || {}).every(([k, v]) => corrisponde(r[k], v))).slice(salta, salta + quanti).map(r => ({ ...r })),
    list: async (_o, quanti = 1e9, salta = 0) => righe().slice(salta, salta + quanti).map(r => ({ ...r })),
    create: async (d) => { const r = { id: nome + '-' + (righe().length + 1), created_date: istante(), ...d }; righe().push(r); scrivi({ op: 'create', id: r.id, d }); return { ...r }; },
    update: async (id, d) => { const r = righe().find(x => x.id === id); if (!r) throw new Error('record inesistente: ' + id); Object.assign(r, d, { updated_date: istante() }); scrivi({ op: 'update', id, d }); return { ...r }; },
  };
}
const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
export function createClientFromRequest() {
  return { auth: { me: async () => { if (!globalThis.__UTENTE) throw new Error('non autenticato'); return globalThis.__UTENTE; } }, asServiceRole: { entities }, entities };
}`;
const sdkFinto = {
  name: 'sdk-finto',
  setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
    b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
  },
};
async function funzione(nome) {
  const r = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', plugins: [sdkFinto],
  });
  const m = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
  return async (body = {}) => { const res = await m.default({ json: async () => body }); return { status: res.status, body: await res.json() }; };
}

// --- gli archivi
const D = (fine, extra = {}) => ({ ordine_immesso_il: '2026-05-01T08:00:00Z', trasporto_iniziato_il: fine, trasporto_finito_il: fine, ...extra });
let n = 0;
const prim = (trasp, dest, tipo, kg, fine, extra = {}) => ({ id: 'p' + (++n), id_ordine: 'P' + n, stato: 'terminato', classe: 'A', trasportatore: trasp, destinazione: dest, tipo_destinazione: tipo, peso_effettivo: kg, ...D(fine), ...extra });
const sec = (sto, dest, kg, fine, extra = {}) => ({ id: 's' + (++n), id_ordine: 'S' + n, stato: 'terminato', classe: 'A', stoccaggio: sto, destinazione: dest, tipo_destinazione: 'imp', peso_effettivo: kg, ...D(fine), ...extra });
const ARCHIVI = () => ({
  ImpiantoTargetSecondaria: [
    { id: 'iT', nome_impianto: 'T-CYCLE INDUSTRIES SRL', target: 1050000, totale_capacity_kg: 1300000, stato: 'attivo' },
    { id: 'iG', nome_impianto: 'Tecnogum Srl', target: 500000, stato: 'attivo' },
    { id: 'iI', nome_impianto: 'Irigom Srl', target: 800000, stato: 'attivo' },
  ],
  FornitoreSecondaria: [
    { id: 'fT', nome: 'T-Cycle', impianto_id: 'iG', impianto_nome: 'Tecnogum Srl', ruolo: 'doppio_ruolo', plafond_stoccaggio_kg: 250000, stato: 'attivo' },
    { id: 'fT2', nome: 'T-Cycle', impianto_id: 'iT', impianto_nome: 'T-CYCLE INDUSTRIES SRL', ruolo: 'raccoglitore', stato: 'attivo' },
    { id: 'fN1', nome: 'Nappi Sud', impianto_id: 'iG', impianto_nome: 'Tecnogum Srl', ruolo: 'stoccaggio', stato: 'attivo' },
    { id: 'fN2', nome: 'Nappi Sud', impianto_id: 'iI', impianto_nome: 'Irigom Srl', ruolo: 'stoccaggio', stato: 'attivo' },
    { id: 'fC', nome: 'C.L. Service', impianto_id: 'iI', impianto_nome: 'Irigom Srl', ruolo: 'raccoglitore', stato: 'attivo' },
    { id: 'fI', nome: 'Irigom', impianto_id: 'iI', impianto_nome: 'Irigom Srl', ruolo: 'stoccaggio', stato: 'attivo' },
  ],
  PrimariaRete: [
    prim('C.L. Service', 'IRIGOM SRL', 'stoc', 50000, '2026-09-15T09:00:00Z'),       // nel piazzale di Irigom
    prim('Logistica & Pneumatici', 'T-Cycle Srl', 'imp', 100000, '2026-06-10T09:00:00Z'),
    prim('C.L. Service', 'T-Cycle Srl', 'stoc', 50000, '2026-06-10T09:00:00Z'),       // nel piazzale di T-Cycle
    prim('C.L. Service', 'T-Cycle Srl', 'stoc', 100000, '2026-07-10T09:00:00Z'),
    prim('C.L. Service', 'T-Cycle Srl', 'stoc', 100000, '2026-08-10T09:00:00Z'),
    prim('Ecorecuperi', 'Tecnogum', 'imp', 20000, '2026-09-16T09:00:00Z'),
    prim('Ecorecuperi', 'Tecnogum', 'imp', 1000, '2026-07-01T09:00:00Z', { trasporto_iniziato_il: null }), // manca l'inizio: contata e segnalata
    { id: 'px', id_ordine: 'PX', stato: 'terminato', classe: 'A', trasportatore: 'X', destinazione: 'Irigom', tipo_destinazione: 'imp', peso_effettivo: 5000, ordine_immesso_il: '2026-09-01T08:00:00Z', trasporto_iniziato_il: '2026-09-02T08:00:00Z', trasporto_finito_il: null, ordine_chiuso_il: '2026-09-05T08:00:00Z' }, // senza fine: fuori e segnalata
    prim('X', 'Irigom', 'imp', 7000, '2026-09-15T09:00:00Z', { classe: '9 - PFU Autodemolizione' }), // ACI: fuori
    prim('X', 'Irigom', 'imp', 9000, '2025-09-15T09:00:00Z'),                                       // l'anno scorso: non si legge nemmeno
  ],
  Secondaria: [
    sec('Irigom', 'Irigom', 40000, '2026-09-17T09:00:00Z'),         // dal piazzale di Irigom a se stesso: mai
    sec('Nappi Sud', 'Irigom', 27000, '2026-09-18T09:00:00Z'),
    sec('T-Cycle', 'T-Cycle', 50000, '2026-06-12T09:00:00Z'),       // dal piazzale di T-Cycle a se stesso: mai
    sec('T-Cycle', 'T-Cycle', 60000, '2026-07-12T09:00:00Z'),
    sec('T-Cycle', 'T-Cycle', 60000, '2026-08-12T09:00:00Z'),
    sec('T-Cycle', 'Tecnogum', 40000, '2026-06-12T09:00:00Z'),      // dal piazzale di T-Cycle a Tecnogum: lo conta Tecnogum
    sec('Nappi Sud', 'Tecnogum', 13500, '2026-06-12T09:00:00Z'),
  ],
  TargetRaccoglitore: [
    { raccoglitore: 'C.L. Service', target_tonnellate: 200, anno: 2026 },
    { raccoglitore: 'Nappi Sud', target_tonnellate: 2100, anno: 2026 },
    { raccoglitore: 'T-Cycle', target_tonnellate: 300, anno: 2026 },
  ],
  GiacenzaStoccaggio: [
    { id: 'g1', sito: 'T-Cycle', data_rilevazione: '2026-08-31', class1_kg: 20000, created_date: '2026-09-01T08:00:00Z' },
    { id: 'g2', sito: 'Nappi Sud', data_rilevazione: '2025-12-31', class1_kg: 300000, created_date: '2026-01-02T08:00:00Z' },
  ],
  PianificazioneSettimanale: [],
  UploadLog: [],
  Alert: [
    { id: 'a1', modulo: 'secondarie', stato: 'aperto', regola_id: 'suggerimento_predittivita_settimanale', titolo: 'Suggerimento Predittività Settimanale 14/09' },
    { id: 'a2', modulo: 'secondarie', stato: 'aperto', regola_id: 'altro', titolo: 'Un altro alert' },
  ],
});
const AMMINISTRATORE = { role: 'admin', email: 'admin@prova', full_name: 'Amministratore' };
const UTENTE = { role: 'user', email: 'utente@prova' };
globalThis.__ARCHIVI = ARCHIVI();
globalThis.__SCRITTI = [];
globalThis.__UTENTE = AMMINISTRATORE;

let ok = 0, ko = 0;
const verifica = (nome, c, extra = '') => { if (c) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const scrittiIn = (nome) => globalThis.__SCRITTI.filter(s => s.nome === nome);

const pianificazione = await funzione('calcolaPianificazioneSecondaria');
const proiezione = await funzione('proiezioneSecondarie');
const mercoledi = await funzione('analisiSettimanalePredittiva');

console.log('APRIRE LA PAGINA NON SCRIVE NIENTE');
const dash = await pianificazione();
const pro = await proiezione();
verifica('le due funzioni rispondono', dash.status === 200 && pro.status === 200, J([dash.body.error, pro.body.error]));
verifica('nessuna scrittura, nemmeno dall\'amministratore', globalThis.__SCRITTI.length === 0, J(globalThis.__SCRITTI));
verifica('la proiezione e\' la stessa risposta della pagina', J(pro.body) === J(dash.body));
verifica('l\'anno in corso, oggi, la settimana dopo', dash.body.anno === 2026 && dash.body.oggi === '2026-09-23' && dash.body.sola_lettura === false && dash.body.puo_fissare === true && J(dash.body.prossima_settimana) === J({ dal: '2026-09-28', al: '2026-10-04' }), J([dash.body.anno, dash.body.oggi, dash.body.prossima_settimana]));
verifica('fin dove arrivano i dati', dash.body.dati_al === '2026-09-18' && dash.body.settimana_scorsa_completa === false && dash.body.avvisi.some(a => a.tipo === 'dati_incompleti'), J([dash.body.dati_al, dash.body.settimana_scorsa_completa]));
verifica('si legge solo dal 31/12/2025', dash.body.lettura.dal === '2025-12-31' && dash.body.lettura.primarie === 8, J(dash.body.lettura));
globalThis.__UTENTE = UTENTE;
const dashUtente = await pianificazione();
verifica('chi non e\' amministratore vede tutto ma non puo\' fissare', dashUtente.status === 200 && dashUtente.body.puo_fissare === false && dashUtente.body.impianti.length === 3);
globalThis.__UTENTE = null;
verifica('senza utente niente', (await pianificazione()).status === 401 && (await proiezione()).status === 401);
globalThis.__UTENTE = AMMINISTRATORE;

console.log('LO STESSO GIA\' ARRIVATO E LO STESSO RESIDUO');
// T-Cycle: 100.000 all'impianto + 250.000 nel piazzale - 40.000 ripartiti per
// Tecnogum; le secondarie a se stesso fuori. Tecnogum: 21.000 in primaria, i
// 40.000 da T-Cycle e 13.500 da Nappi Sud. Irigom: 50.000 nel piazzale e 27.000
// da Nappi Sud, non la secondaria a se stesso.
const ATTESO = { 'T-CYCLE INDUSTRIES SRL': [310000, 740000], 'Tecnogum Srl': [74500, 425500], 'Irigom Srl': [77000, 723000] };
for (const [nome, [arr, res]] of Object.entries(ATTESO)) {
  const d = dash.body.impianti.find(x => x.nome === nome);
  verifica(`${nome}: ${arr} arrivati, ${res} da arrivare`, d && d.gia_arrivato_kg === arr && d.residuo_kg === res, J(d && { g: d.gia_arrivato_kg, r: d.residuo_kg }));
}
const tc = dash.body.impianti.find(x => x.chiave === 't-cycle');
verifica('il piazzale di T-Cycle al netto di quello che riparte per Tecnogum', J(tc.composizione) === J({ primaria_impianto_kg: 100000, primaria_piazzale_netta_kg: 210000, piazzale_ripartito_kg: 40000, secondaria_kg: 0 }), J(tc.composizione));
verifica('le note di T-Cycle: a se stesso, per Tecnogum, il netto', tc.note.length === 3 && tc.note[0].includes('170,00 t') && tc.note[1].includes('40,00 t') && tc.note[1].includes('Tecnogum Srl') && tc.note[2].includes('ne restano 210,00 t'), J(tc.note));
const irigom = dash.body.impianti.find(x => x.chiave === 'irigom');
verifica('Irigom: la primaria nel piazzale e Nappi Sud, non la secondaria a se stesso', J(irigom.composizione) === J({ primaria_impianto_kg: 0, primaria_piazzale_netta_kg: 50000, piazzale_ripartito_kg: 0, secondaria_kg: 27000 }) && irigom.note.some(x => x.includes('1 secondaria') && x.includes('40,00 t')), J([irigom.composizione, irigom.note]));

console.log('IL PIAZZALE DI T-CYCLE');
const pzTc = dash.body.stoccaggi.find(s => s.chiave === 't-cycle');
verifica('e\' anche un impianto, e alimenta Tecnogum', pzTc && pzTc.e_impianto === true && J(pzTc.destinazioni) === J([{ impianto: 'tecnogum', priorita: 99, nome: 'Tecnogum Srl' }]), J(pzTc && pzTc.destinazioni));
verifica('i trasbordi a se stesso non consumano il plafond', pzTc.plafond_kg === 250000 && pzTc.partiti_verso_altri_kg === 40000 && pzTc.residuo_plafond_kg === 210000, J(pzTc));
verifica('la giacenza dalla prima lettura dell\'anno', pzTc.giacenza_kg === 20000 && pzTc.giacenza_da === '2026-08-31', J(pzTc));
const pzNappi = dash.body.stoccaggi.find(s => s.chiave === 'nappi sud');
verifica('Nappi Sud: prima Tecnogum, poi Irigom; la giacenza dall\'ancora al 31/12', pzNappi.destinazioni.map(d => `${d.nome}:${d.priorita}`).join() === 'Tecnogum Srl:1,Irigom Srl:2' && pzNappi.giacenza_kg === 300000 - 13500 - 27000, J(pzNappi));
verifica('il piazzale di Irigom, registrato per Irigom, non e\' una fonte', !dash.body.stoccaggi.some(s => s.chiave === 'irigom') && !dash.body.avvisi.some(a => a.stoccaggio === 'Irigom'), J(dash.body.stoccaggi.map(s => s.chiave)));

console.log('IL TARGET DI UN RACCOGLITORE SENZA IMPIANTO');
// C.L. Service ha portato 50 t al piazzale di Irigom e 250 t a quello di
// T-Cycle: dei 200 t di target un sesto a Irigom, il resto a T-Cycle. Le due
// quote fanno il target una volta sola.
const clIrigom = irigom.primarie.find(p => p.raccoglitore === 'C.L. Service');
const clTc = tc.primarie.find(p => p.raccoglitore === 'C.L. Service');
verifica('diviso fra i siti in proporzione alle consegne', clIrigom.target_kg === 33333 && clTc.target_kg === 166667 && clIrigom.target_kg + clTc.target_kg === 200000, J([clIrigom, clTc]));

console.log('GLI AVVISI');
const dateAvviso = dash.body.avvisi.find(a => a.tipo === 'date_da_sistemare');
verifica('le date da sistemare: l\'inizio mancante e il senza fine trasporto', dateAvviso && dateAvviso.testo.includes('manca la data di inizio trasporto, 1 ordine') && dateAvviso.testo.includes('manca la data di fine trasporto, 1 ordine (PX)'), J(dateAvviso));

console.log('IL PROGRAMMA A MANO: SOLO L\'AMMINISTRATORE');
const fissa = (x) => pianificazione({ azione: 'fissa', anno: 2026, settimana: '2026-09-28', righe: [{ stoccaggio: 'Nappi Sud', impianto: 'Tecnogum Srl', viaggi: 3 }], ...x });
globalThis.__UTENTE = UTENTE;
const negato = await fissa();
verifica('chi non e\' amministratore non fissa niente', negato.status === 403 && negato.body.sola_lettura === true && globalThis.__SCRITTI.length === 0, J(negato));
globalThis.__UTENTE = AMMINISTRATORE;
const passata = await fissa({ settimana: '2026-09-14' });
const nonLunedi = await fissa({ settimana: '2026-09-30' });
const fuoriPercorso = await fissa({ righe: [{ stoccaggio: 'Irigom', impianto: 'Tecnogum', viaggi: 2 }] });
const annoChiuso = await fissa({ anno: 2025, settimana: '2025-12-22' });
const sconosciuta = await pianificazione({ azione: 'cancella' });
const viaggiStorti = await fissa({ righe: [{ stoccaggio: 'Nappi Sud', impianto: 'Tecnogum', viaggi: 2.5 }] });
verifica('una settimana passata resta com\'era', passata.status === 409 && /gia' passata/.test(passata.body.error), J(passata.body));
verifica('la settimana si indica col lunedi\'', nonLunedi.status === 400 && nonLunedi.body.error.includes('28/09/2026'), J(nonLunedi.body));
verifica('solo i percorsi della predittivita\'', fuoriPercorso.status === 400, J(fuoriPercorso.body));
verifica('un anno chiuso non si cambia', annoChiuso.status === 409, J(annoChiuso.body));
verifica('azioni sconosciute e viaggi non interi rifiutati', sconosciuta.status === 400 && viaggiStorti.status === 400, J([sconosciuta.body, viaggiStorti.body]));
verifica('niente e\' stato scritto', globalThis.__SCRITTI.length === 0, J(globalThis.__SCRITTI));
const fissato = await fissa();
const righeFissate = () => globalThis.__ARCHIVI.PianificazioneSettimanale;
verifica('l\'amministratore fissa: una riga a mano', fissato.status === 200 && J(fissato.body.fissato) === J({ settimana: '2026-09-28', scritte: 1 }) && righeFissate().length === 1, J([fissato.status, fissato.body.fissato, fissato.body.error]));
const manuale = righeFissate()[0];
verifica('la riga dice settimana, percorso, viaggi e che e\' a mano', manuale.anno === 2026 && manuale.data_inizio === '2026-09-28' && manuale.data_fine === '2026-10-04' && manuale.fornitore_nome === 'Nappi Sud' && manuale.impianto_nome === 'Tecnogum Srl' && manuale.viaggi_previsti === 3 && manuale.kg_previsti === 39000 && manuale.origine === 'manuale' && manuale.stato === 'programmato' && manuale.note.includes('Amministratore'), J(manuale));
verifica('la risposta e\' gia\' aggiornata', J(fissato.body.programma.find(r => r.stoccaggio === 'Nappi Sud' && r.impianto === 'Tecnogum Srl').fissato) === J({ viaggi: 3, manuale: true, id: manuale.id }), J(fissato.body.programma));

console.log('IL PROGRAMMA DEL MERCOLEDI\'');
globalThis.__UTENTE = UTENTE;
const mercolediNegato = await mercoledi();
verifica('una persona che non e\' amministratore non lo lancia', mercolediNegato.status === 403, J(mercolediNegato));
globalThis.__UTENTE = null; // il workflow non ha utente
globalThis.__SCRITTI = [];
const mer = await mercoledi();
verifica('risponde', mer.status === 200 && mer.body.ok === true, J(mer.body));
verifica('fissa la settimana dopo', mer.body.fissato === true && J(mer.body.settimana) === J({ dal: '2026-09-28', al: '2026-10-04' }), J(mer.body.settimana));
verifica('con i numeri della pagina', J(mer.body.righe.map(r => [r.stoccaggio, r.impianto, r.viaggi])) === J(dash.body.programma.map(r => [r.stoccaggio, r.impianto, r.viaggi])), J([mer.body.righe, dash.body.programma.map(r => r.viaggi)]));
verifica('non tocca la riga corretta a mano', mer.body.lasciate_manuali === 1 && mer.body.scritte === dash.body.programma.length - 1 && !scrittiIn('PianificazioneSettimanale').some(s => s.id === manuale.id) && righeFissate()[0].viaggi_previsti === 3 && righeFissate()[0].origine === 'manuale', J(scrittiIn('PianificazioneSettimanale')));
verifica('le altre righe sono del programma', righeFissate().length === dash.body.programma.length && righeFissate().slice(1).every(r => r.origine === 'programma' && r.stato === 'programmato' && r.data_inizio === '2026-09-28' && r.modificato_manuale === false), J(righeFissate()));
verifica('il riassunto dice la correzione a mano e fin dove arrivano i dati', mer.body.riassunto.includes('Nappi Sud → Tecnogum Srl: 3 viaggi (corretti a mano') && mer.body.riassunto.includes('18/09/2026'), mer.body.riassunto);
verifica('i suggerimenti del lunedi\' rimasti aperti si chiudono, gli altri alert no', mer.body.suggerimenti_chiusi === 1 && globalThis.__ARCHIVI.Alert.find(a => a.id === 'a1').stato === 'risolto' && globalThis.__ARCHIVI.Alert.find(a => a.id === 'a2').stato === 'aperto');
const quante = righeFissate().length;
const ancora = await mercoledi();
verifica('rilanciato (il passaggio delle 14), un programma gia\' fissato non si rifa\': nessuna riga nuova ne\' cambiata', ancora.status === 200 && ancora.body.gia_fissato === true && ancora.body.fissato === false && righeFissate().length === quante && ancora.body.suggerimenti_chiusi === 0, J(ancora.body));
globalThis.__UTENTE = AMMINISTRATORE;
const dopo = await pianificazione();
verifica('la pagina mostra il programma fissato, nella riga della settimana dopo', dopo.body.programma.every(r => r.fissato && r.fissato.viaggi === (r.stoccaggio === 'Nappi Sud' && r.impianto === 'Tecnogum Srl' ? 3 : r.viaggi)) && dopo.body.settimane.filter(s => s.settimana === '2026-09-28').length === dopo.body.programma.length, J(dopo.body.settimane));

console.log('UN CARICAMENTO IN CORSO');
globalThis.__UTENTE = null;
globalThis.__ARCHIVI.UploadLog = [{ id: 'u1', tipo_file: 'secondarie', esito: 'in_corso', created_date: '2026-09-23T05:55:00', nome_file: 'secondarie.xlsx', utente: 'Mario' }];
globalThis.__SCRITTI = [];
const rinviato = await mercoledi();
verifica('il programma non si fissa su un archivio a meta\'', rinviato.status === 409 && rinviato.body.rinviato === true && rinviato.body.fissato === false && !scrittiIn('PianificazioneSettimanale').length && rinviato.body.error.includes('secondarie'), J(rinviato.body));
globalThis.__UTENTE = AMMINISTRATORE;
const conCaricamento = await pianificazione();
verifica('la pagina lo dice per primo', conCaricamento.body.avvisi[0].tipo === 'caricamento_in_corso' && conCaricamento.body.avvisi[0].grave === true, J(conCaricamento.body.avvisi[0]));
globalThis.__ARCHIVI.UploadLog = [];

console.log('UN ANNO CHIUSO');
const del2025 = await proiezione({ anno: 2025 });
verifica('si guarda al 31 dicembre, in sola lettura', del2025.status === 200 && del2025.body.anno === 2025 && del2025.body.oggi === '2025-12-31' && del2025.body.sola_lettura === true && del2025.body.puo_fissare === false, J([del2025.status, del2025.body.oggi, del2025.body.sola_lettura]));
verifica('con la sua configurazione: i record senza anno sono del 2026', del2025.body.configurazione_vuota === true, J(del2025.body.impianti));
verifica('un anno che non e\' cominciato no', (await proiezione({ anno: 2027 })).status === 400 && (await pianificazione({ anno: 2027 })).status === 400 && (await proiezione({ anno: 'due' })).status === 400);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
