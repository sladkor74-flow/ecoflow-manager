// Prova degli AVVISI A SCOMPARSA della dashboard (src/lib/avvisiNascosti.js,
// migliorie dell'11/10/2026).
//
// Chiesto dall'utente: «permetti gli alert a scomparsa». Una voce si nasconde per
// oggi o per sette giorni (le critiche solo per oggi, e restano nel conteggio), e
// torna da sola se diventa piu' grave, se un suo numero sale, se cambia o quando
// scade. Una voce che migliora non torna: tornare per un miglioramento
// insegnerebbe a ignorare il pannello. La memoria sta nel browser, per utente, e
// un browser che non la permette non rompe niente. In fondo le voci vere del
// cruscotto: quelle con un numero che sale da solo ogni giorno non tornano ogni
// mattina. E la voce dei target del mese (revisione delle migliorie,
// 11/10/2026): torna se entra un raccoglitore nuovo anche a conto uguale (BETA al
// posto di ALFA), non se uno esce. npm run prove
import * as A from '../src/lib/avvisiNascosti.js';
import { cruscotto } from '../base44/shared/cruscotto.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const OGGI = '2026-10-11';
const DOMANI = '2026-10-12';

console.log('LO SCHELETRO, LA CHIAVE, LE MISURE');
verifica('12 o 15 ordini: lo stesso scheletro', A.scheletro('Rete: 12 ordini aperti da oltre 60 giorni') === A.scheletro('Rete: 15 ordini aperti da oltre 60 giorni') && A.scheletro('Rete: 12 ordini aperti da oltre 60 giorni') === 'Rete: # ordini aperti da oltre # giorni');
verifica('le date spariscono: «Controllo del 10/10/2026.» e «del 2026-10-11»', A.scheletro('Gatim si scosta. Controllo del 10/10/2026.') === A.scheletro('Gatim si scosta. Controllo del 11/10/2026.') && !/2026/.test(A.scheletro('aggiornato il 2026-10-11 alle 05:30')), A.scheletro('Gatim si scosta. Controllo del 10/10/2026.'));
verifica('«1.234,56 t» diventa «# t»', A.scheletro('Gatim 1.234,56 t') === 'Gatim # t', A.scheletro('Gatim 1.234,56 t'));
const v1 = { area: 'Arretrato', gravita: 'attenzione', titolo: 'Rete: 12 ordini aperti da oltre 60 giorni', dettaglio: 'Su 40 aperti.', link: '/assegnati' };
verifica('la chiave non cambia coi numeri', A.chiaveVoce(v1) === A.chiaveVoce({ ...v1, titolo: 'Rete: 15 ordini aperti da oltre 60 giorni' }));
verifica('la chiave scritta vince', A.chiaveVoce({ ...v1, chiave: 'arretrato:RETE' }) === 'arretrato:RETE');
verifica('le misure all\'italiana: «1.234,56» vale 1234,56; le date non sono misure', J(A.misureVoce({ titolo: 'Gatim 1.234,56 t e 12 ordini al 10/10/2026, 2026-10-11' })) === J([1234.56, 12]), J(A.misureVoce({ titolo: 'Gatim 1.234,56 t e 12 ordini al 10/10/2026, 2026-10-11' })));
verifica('le misure scritte vincono, anche vuote', J(A.misureVoce({ titolo: 'dati di 12 giorni fa', misure: [] })) === '[]');

console.log('LA SCADENZA');
verifica('una critica: solo oggi', A.scadenza('critico', OGGI) === OGGI && A.scadenza('critico', OGGI, 7) === OGGI);
verifica('sette giorni a cavallo d\'anno', A.scadenza('attenzione', '2026-12-28') === '2027-01-04');
verifica('il 2028 e\' bisestile', A.scadenza('info', '2028-02-25', 7) === '2028-03-03');
verifica('«per oggi» e\' oggi', A.scadenza('attenzione', OGGI, 0) === OGGI);
const critica = { area: 'Alert', gravita: 'critico', titolo: '2 alert critici aperti', dettaglio: 'Ritardo SLA (2)', link: '/alert-engine', chiave: 'alert:altri' };
verifica('nascondere una critica per 7 giorni la nasconde solo per oggi', A.nascondi(critica, OGGI, { giorni: 7 }).fino_al === OGGI);
const riga = A.nascondi(v1, OGGI, { giorni: 7 });
verifica('la riga ricorda chiave, firma, misure, gravita\', titolo e giorni', riga.chiave === A.chiaveVoce(v1) && riga.firma === 'Su # aperti.' && J(riga.misure) === J([12, 60]) && riga.gravita === 'attenzione' && riga.titolo === v1.titolo && riga.il === OGGI && riga.fino_al === '2026-10-18', J(riga));

console.log('QUANDO TORNA');
verifica('identica il giorno dopo: resta nascosta', A.percheTorna(riga, v1, DOMANI) === null);
verifica('il giorno dopo la scadenza: torna', J(A.percheTorna(riga, v1, '2026-10-19')) === J({ motivo: 'scaduta' }));
verifica('l\'ultimo giorno resta ancora', A.percheTorna(riga, v1, '2026-10-18') === null);
verifica('da attenzione a critica: torna, e dice perche\'', J(A.percheTorna(riga, { ...v1, gravita: 'critico' }, DOMANI)) === J({ motivo: 'piu_grave', da: 'attenzione', a: 'critico' }));
verifica('da 12 a 15: torna, col numero di prima e quello di adesso', J(A.percheTorna(riga, { ...v1, titolo: 'Rete: 15 ordini aperti da oltre 60 giorni' }, DOMANI)) === J({ motivo: 'numero_salito', da: 12, a: 15 }));
verifica('da 12 a 9: NON torna (una voce che migliora resta nascosta)', A.percheTorna(riga, { ...v1, titolo: 'Rete: 9 ordini aperti da oltre 60 giorni' }, DOMANI) === null);
verifica('un nome nuovo nel dettaglio: torna come cambiata', J(A.percheTorna(riga, { ...v1, dettaglio: 'Su 40 aperti. Gatim.' }, DOMANI)) === J({ motivo: 'cambiata' }));
verifica('misure di lunghezza diversa: cambiata', J(A.percheTorna(riga, { ...v1, titolo: 'Rete: 12 ordini aperti da oltre 60 giorni, 3 senza data' }, DOMANI)) === J({ motivo: 'cambiata' }));
verifica('uno scarto negativo che cresce e\' un numero che sale', A.percheTorna(A.nascondi({ titolo: 'Gatim -1,20 t', gravita: 'info' }, OGGI, { giorni: 7 }), { titolo: 'Gatim -1,50 t', gravita: 'info' }, DOMANI)?.motivo === 'numero_salito');
verifica('l\'etichetta delle tornate', A.testoTornata({ motivo: 'numero_salito', da: 1234.5, a: 1500 }) === 'tornata: il numero è salito da 1.234,5 a 1.500' && A.testoTornata({ motivo: 'piu_grave', a: 'critico' }) === 'tornata: è diventata critica' && A.testoTornata({ motivo: 'scaduta' }) === '');

console.log('LO SMISTAMENTO');
{
  const altra = { area: 'Fatturazione attiva', gravita: 'info', titolo: 'Prefattura non caricata: Agosto', dettaglio: '', link: '/fatturazione', chiave: 'attiva:prefattura' };
  const righe = [A.nascondi(critica, OGGI), A.nascondi(v1, OGGI, { giorni: 7 })];
  const s = A.smista([critica, v1, altra], righe, OGGI);
  verifica('le nascoste si contano a parte, critiche comprese (il pannello le dice)', s.nascoste.length === 2 && s.nascoste.some(x => x.voce.gravita === 'critico') && s.visibili.length === 1 && s.visibili[0].voce === altra, J(s));
  const d = A.smista([critica, v1, altra], s.memoria, DOMANI);
  verifica('il giorno dopo la critica torna (scaduta), l\'altra resta', d.visibili.some(x => x.voce === critica && x.tornata.motivo === 'scaduta') && d.nascoste.length === 1 && d.nascoste[0].voce === v1, J(d));
  verifica('e la riga scaduta esce dalla memoria', d.memoria.length === 1 && d.memoria[0].chiave === A.chiaveVoce(v1), J(d.memoria));
  const sale = A.smista([{ ...v1, titolo: 'Rete: 15 ordini aperti da oltre 60 giorni' }], s.memoria, DOMANI);
  verifica('una voce che torna perde la sua riga', sale.visibili[0].tornata.motivo === 'numero_salito' && !sale.memoria.some(r => r.chiave === A.chiaveVoce(v1)), J(sale));
  const sparita = A.smista([], [A.nascondi(v1, OGGI, { giorni: 7 })], DOMANI);
  verifica('una riga senza voce resta fino al suo giorno', sparita.memoria.length === 1);
  verifica('poi se ne va', A.smista([], [A.nascondi(v1, OGGI, { giorni: 7 })], '2026-10-19').memoria.length === 0);
  const tante = Array.from({ length: 250 }, (_, i) => ({ chiave: 'k' + i, firma: '', misure: [], gravita: 'info', il: `2026-10-${String(1 + (i % 10)).padStart(2, '0')}`, fino_al: '2026-10-30' }));
  const molte = A.smista([], tante, OGGI);
  verifica('oltre 200 righe restano le piu\' recenti', molte.memoria.length === 200 && molte.memoria.every(r => r.il >= '2026-10-03'), String(molte.memoria.length));
}

console.log('LA MEMORIA NEL BROWSER');
{
  const negozio = new Map();
  globalThis.localStorage = { getItem: (k) => (negozio.has(k) ? negozio.get(k) : null), setItem: (k, v) => negozio.set(k, String(v)) };
  const anna = { id: 'u1', email: 'anna@x' };
  const bruno = { email: 'bruno@x' };
  verifica('la prima volta: vuota', J(A.leggiMemoria(anna)) === J({ v: 1, nascoste: [], aperte: {} }));
  A.scriviMemoria(anna, { v: 1, nascoste: [A.nascondi(v1, OGGI, { giorni: 7 })], aperte: { daGestire: false } });
  verifica('si rilegge com\'era', A.leggiMemoria(anna).nascoste.length === 1 && A.leggiMemoria(anna).aperte.daGestire === false);
  verifica('due utenti, due chiavi', A.leggiMemoria(bruno).nascoste.length === 0 && negozio.has('eco_dashboard_u1') && A.chiaveMemoria(bruno) === 'eco_dashboard_bruno@x');
  negozio.set('eco_dashboard_u1', '{rotto');
  verifica('un JSON rotto vale come vuoto', J(A.leggiMemoria(anna)) === J(A.memoriaVuota()));
  negozio.set('eco_dashboard_u1', J({ v: 99, nascoste: [{ chiave: 'x' }] }));
  verifica('un\'altra versione vale come vuota', A.leggiMemoria(anna).nascoste.length === 0);
  globalThis.localStorage = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('QuotaExceeded'); } };
  let errore = null;
  try { verifica('un browser che lancia (Safari privato): memoria vuota', J(A.leggiMemoria(anna)) === J(A.memoriaVuota())); verifica('e scrivere non rompe niente', A.scriviMemoria(anna, A.memoriaVuota()) === false); } catch (e) { errore = e; }
  verifica('nessuna eccezione', errore === null, String(errore));
  delete globalThis.localStorage;
  verifica('senza localStorage del tutto: vuota, senza errori', J(A.leggiMemoria(anna)) === J(A.memoriaVuota()) && A.scriviMemoria(anna, A.memoriaVuota()) === false);
}

console.log('LE VOCI VERE DEL CRUSCOTTO NON TORNANO OGNI MATTINA');
{
  const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre'];
  const documenti = MESI.flatMap(m => ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => ({ tipo: 'ATTIVA', anno: 2026, mese: m, tipologia: t, stato: 'chiusa' })));
  const giorno = (oggi) => cruscotto({
    oggi, adessoMs: Date.parse(`${oggi}T08:00:00Z`), anno: 2026, tipiFile: ['primarie'],
    alertAperti: [], uploadLogs: [{ tipo_file: 'primarie', esito: 'successo', created_date: '2026-09-29T08:00:00', nome_file: 'PRIMARIE.xlsx' }],
    assegnatiRete: [], assegnatiAci: [], documenti, prefatture: MESI.map(m => ({ anno: 2026, mese: m })), riepilogoQualifica: null, richiesteEct: [],
    fotografiaGiorno: { giorno: '2026-10-07', siti: [], scostamenti: [], doppioni: [] },
  }).da_gestire;
  const oggiVoci = giorno(OGGI);
  const domaniVoci = giorno(DOMANI);
  const prim = (vv) => vv.find(v => v.chiave === 'caricamento:primarie:vecchio');
  const guard = (vv) => vv.find(v => v.chiave === 'lavoro:riepilogoDichiarazioni');
  verifica('le due voci ci sono, coi giorni che crescono', prim(oggiVoci) && /12 giorni fa/.test(prim(oggiVoci).titolo) && /13 giorni fa/.test(prim(domaniVoci).titolo) && /da 4 giorni/.test(guard(oggiVoci).titolo) && /da 5 giorni/.test(guard(domaniVoci).titolo), J(oggiVoci));
  const memoria = [A.nascondi(prim(oggiVoci), OGGI, { giorni: 7 }), A.nascondi(guard(oggiVoci), OGGI, { giorni: 7 })];
  const s = A.smista(domaniVoci, memoria, DOMANI);
  verifica('nascoste oggi, domani restano nascoste tutte e due', s.visibili.length === 0 && s.nascoste.length === 2, J(s.visibili.map(x => [x.voce.titolo, x.tornata])));
  // Senza le misure scritte dal cruscotto tornerebbero: e' la ragione per cui ci sono.
  const senzaMisure = A.smista(domaniVoci.map(v => ({ ...v, misure: undefined })), memoria.map(r => ({ ...r, misure: A.misureVoce({ titolo: r.titolo }) })), DOMANI);
  verifica('(controprova interna: con le misure dal titolo tornerebbero ogni mattina)', senzaMisure.visibili.length === 2 && senzaMisure.visibili.every(x => x.tornata.motivo === 'numero_salito'), J(senzaMisure.visibili.map(x => x.tornata)));
  const chiavi = domaniVoci.map(v => A.chiaveVoce(v));
  verifica('nessuna chiave ripetuta fra le voci', new Set(chiavi).size === chiavi.length, J(chiavi));
}

console.log('UN NOME NUOVO FA TORNARE LA VOCE DEI TARGET (revisione delle migliorie, 11/10/2026)');
{
  // Gli alert di checkTargetAlerts, come li legge il cruscotto: record_id raccoglitore|regione|mese|anno.
  const alert = (nome, regione = 'Puglia') => ({ id: nome, stato: 'aperto', entity_type: 'TargetMensile', record_id: `${nome}|${regione}|Ottobre|2026`, severita: 'warning',
    titolo: `Target a rischio: ${nome} — ${regione} (Ottobre 2026)` });
  const voce = (oggi, alerts) => cruscotto({ oggi, adessoMs: Date.parse(`${oggi}T08:00:00Z`), anno: 2026, tipiFile: [], alertAperti: alerts, uploadLogs: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], riepilogoQualifica: null, richiesteEct: [] })
    .da_gestire.find(v => v.area === 'Target raccoglitori');
  const alfa = voce(OGGI, [alert('ALFA SRL')]);
  const riga = A.nascondi(alfa, OGGI, { giorni: 7 });
  verifica('la voce porta i nomi (con la regione) e la riga li ricorda', J(alfa.elementi) === J(['ALFA SRL (Puglia)']) && J(riga.elementi) === J(['ALFA SRL (Puglia)']), J([alfa.elementi, riga]));
  const beta = voce(DOMANI, [alert('BETA SRL')]);
  verifica('BETA al posto di ALFA, stesso conto: torna, e dice il nome nuovo', J(A.percheTorna(riga, beta, DOMANI)) === J({ motivo: 'nome_nuovo', nuovi: ['BETA SRL (Puglia)'] }), J(A.percheTorna(riga, beta, DOMANI)));
  verifica('l\'etichetta: «tornata: c\'è un nome nuovo, BETA SRL (Puglia)»', A.testoTornata(A.percheTorna(riga, beta, DOMANI)) === 'tornata: c\'è un nome nuovo, BETA SRL (Puglia)', A.testoTornata(A.percheTorna(riga, beta, DOMANI)));
  const lo_stesso_raccoglitore_altrove = voce(DOMANI, [alert('ALFA SRL', 'Sicilia')]);
  verifica('lo stesso raccoglitore in un\'altra regione e\' un nome nuovo', A.percheTorna(riga, lo_stesso_raccoglitore_altrove, DOMANI)?.motivo === 'nome_nuovo');
  const due = A.nascondi(voce(OGGI, [alert('ALFA SRL'), alert('BETA SRL')]), OGGI, { giorni: 7 });
  verifica('uno dei due esce: la voce migliora e resta nascosta', A.percheTorna(due, voce(DOMANI, [alert('BETA SRL')]), DOMANI) === null);
  verifica('identica il giorno dopo: resta nascosta', A.percheTorna(riga, voce(DOMANI, [alert('ALFA SRL')]), DOMANI) === null);
  verifica('una riga ricordata senza nomi (di prima) non si confronta coi nomi', A.percheTorna({ ...riga, elementi: undefined }, beta, DOMANI) === null);
  verifica('una voce senza nomi non ne scrive nella riga', !('elementi' in A.nascondi(v1, OGGI)));
  verifica('piu\' di tre nomi nuovi: i primi tre e «e altri»', A.testoTornata({ motivo: 'nome_nuovo', nuovi: ['A', 'B', 'C', 'D'] }) === 'tornata: ci sono 4 nomi nuovi, A, B, C e altri');
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
