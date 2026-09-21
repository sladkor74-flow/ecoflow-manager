// Prova del cruscotto (base44/shared/cruscotto.ts): l'elenco unico delle cose da
// gestire, l'arretrato, i caricamenti, i mesi della fatturazione. In fondo le
// dichiarazioni riconosciute a portale (base44/shared/agganciaDichiarazioni.ts),
// da cui dipendono la quadratura e i mesi "caricati". npm run prove
import { cruscotto, etaArretrato, statoCaricamenti, statoMesiAttiva, nomeRegola } from '../base44/shared/cruscotto.ts';
import { caricamentiPortale, allineaDalPortale } from '../base44/shared/agganciaDichiarazioni.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const OGGI = '2026-09-20';
const ADESSO = Date.UTC(2026, 8, 20, 18, 0, 0);

console.log('ARRETRATO');
const eta = etaArretrato([
  { id_ordine: 'A', ordine_immesso_il: '2026-09-10T00:00:00Z', peso_stimato: 1000 },
  { id_ordine: 'B', ordine_immesso_il: '2026-08-10T00:00:00Z', peso_stimato: 2000 },
  { id_ordine: 'C', ordine_immesso_il: '2025-09-23T22:00:00Z', peso_stimato: 3000, ragione_sociale: 'Vecchio Srl' },
  { id_ordine: 'D', ordine_immesso_il: null },
], OGGI);
verifica('fasce di eta\' e il piu\' vecchio sul giorno italiano (22:00Z del 23/9 = 24/9)', eta.totale === 4 && eta.entro_30 === 1 && eta.da_31_a_60 === 1 && eta.oltre_60 === 1 && eta.kg_oltre_60 === 3000 && eta.senza_data === 1 && eta.piu_vecchio.id_ordine === 'C' && eta.piu_vecchio.immesso_il === '2025-09-24' && eta.piu_vecchio.giorni === 361, JSON.stringify(eta));

console.log('CARICAMENTI');
const logs = [
  { tipo_file: 'primarie', esito: 'successo', created_date: '2026-09-18T08:00:00', nome_file: 'PRIMARIE.xlsx', utente: 'Antonio' },
  { tipo_file: 'primarie', esito: 'successo', created_date: '2026-09-11T08:00:00' },
  { tipo_file: 'terziarie', esito: 'successo', created_date: '2026-08-26T08:00:00' },
  { tipo_file: 'secondarie', esito: 'in_corso', created_date: '2026-09-20T09:00:00', utente: 'Antonio' },     // nove ore fa: interrotto
  { tipo_file: 'secondarie', esito: 'successo', created_date: '2026-09-18T08:00:00' },
  { tipo_file: 'pdr', esito: 'in_corso', created_date: '2026-09-20T17:55:00' },                                // cinque minuti fa: in corso davvero
  { tipo_file: 'pdr', esito: 'errore', created_date: '2026-09-19T08:00:00' },
];
const c = statoCaricamenti(logs, OGGI, ADESSO, ['primarie', 'secondarie', 'terziarie', 'pdr']);
verifica('l\'ultimo riuscito per tipo, coi giorni', c.archivi[0].il === '2026-09-18' && c.archivi[0].giorni_fa === 2 && c.archivi[2].giorni_fa === 25 && c.archivi[3].il === null);
verifica('interrotto solo chi e\' fermo da oltre dieci minuti', c.interrotti.length === 1 && c.interrotti[0].tipo_file === 'secondarie');
const rifatto = statoCaricamenti([{ tipo_file: 'secondarie', esito: 'successo', created_date: '2026-09-20T10:00:00' }, ...logs], OGGI, ADESSO, ['secondarie']);
verifica('un caricamento interrotto alle 9 e rifatto alle 10 non e\' piu\' un problema', rifatto.interrotti.length === 0, JSON.stringify(rifatto.interrotti));
const nonRifatto = statoCaricamenti([{ tipo_file: 'secondarie', esito: 'successo', created_date: '2026-09-20T08:00:00' }, ...logs], OGGI, ADESSO, ['secondarie']);
verifica('se l\'ultimo riuscito e\' di PRIMA dell\'interruzione, il problema resta', nonRifatto.interrotti.length === 1);

console.log('MESI DELLA FATTURAZIONE ATTIVA');
const docs = [
  ...['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => ({ tipo: 'ATTIVA', anno: 2026, mese: 'Gennaio', tipologia: t, stato: 'chiusa' })),
  ...['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => ({ tipo: 'ATTIVA', anno: 2026, mese: 'Luglio', tipologia: t, stato: 'elaborata' })),
  { tipo: 'ATTIVA', anno: 2026, mese: 'Marzo', tipologia: 'RETE', stato: 'approvata', superato: true },
];
const mesi = statoMesiAttiva(docs, [{ anno: 2026, mese: 'Luglio', superata: false }, { anno: 2026, mese: 'Gennaio', superata: true }], 2026, OGGI);
verifica('si guardano i mesi finiti: da gennaio ad agosto, settembre e\' in corso', mesi.length === 8 && mesi[7].mese === 'Agosto');
verifica('gennaio chiuso, luglio elaborato con prefattura, marzo superato = da elaborare', mesi[0].chiuso && mesi[6].elaborato && mesi[6].prefattura && !mesi[2].elaborato && mesi[0].prefattura === false);

// Ogni canale ha il suo documento: un mese non e' elaborato ne' chiuso perche' lo e' un altro canale.
const perCanale = (mese, stati) => Object.entries(stati).map(([tipologia, stato]) => ({ tipo: 'ATTIVA', anno: 2026, mese, tipologia, stato }));
const docsCanali = [
  ...perCanale('Febbraio', { RETE: 'elaborata' }),                                        // ACI ed extra mancanti
  ...perCanale('Aprile', { RETE: 'chiusa', ACI: 'chiusa' }),                              // extra mancante
  ...perCanale('Maggio', { RETE: 'chiusa', ACI: 'chiusa', EXTRA_RACCOLTA: 'approvata' }), // extra aperta
  ...perCanale('Giugno', { RETE: 'approvata', ACI: 'chiusa', EXTRA_RACCOLTA: 'chiusa' }), // rete aperta
];
const mc = statoMesiAttiva(docsCanali, [], 2026, OGGI);
verifica('rete elaborata e ACI mancante: elaborato, con i canali mancanti detti per nome', mc[1].elaborato && JSON.stringify(mc[1].canali_mancanti) === '["ACI","EXTRA_RACCOLTA"]' && mc[1].canali.RETE.stato === 'elaborata' && !mc[1].chiuso, JSON.stringify(mc[1]));
verifica('rete e ACI chiuse, extra mancante: il mese NON e\' chiuso', !mc[3].chiuso && JSON.stringify(mc[3].canali_mancanti) === '["EXTRA_RACCOLTA"]', JSON.stringify(mc[3]));
verifica('rete e ACI chiuse, extra approvata: non chiuso, niente canali mancanti', !mc[4].chiuso && mc[4].canali_mancanti.length === 0 && mc[4].canali.RETE.chiuso && !mc[4].canali.EXTRA_RACCOLTA.chiuso);
const rc = cruscotto({ oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: [], alertAperti: [], uploadLogs: [], assegnatiRete: [], assegnatiAci: [], documenti: docsCanali, prefatture: [], riepilogoQualifica: null, giacenzeSito: [], impiantiTarget: [], richiesteEct: [] });
const fatt = rc.da_gestire.filter(v => v.area === 'Fatturazione attiva');
const vMancante = fatt.find(v => /con un canale non elaborato/.test(v.titolo));
verifica('voce "mesi con un canale non elaborato": febbraio (ACI, extra) e aprile (extra)', vMancante && vMancante.titolo.startsWith('2 ') && /Febbraio: ACI, Extra raccolta/.test(vMancante.dettaglio) && /Aprile: Extra raccolta/.test(vMancante.dettaglio), fatt.map(v => `${v.titolo} [${v.dettaglio}]`).join(' | '));
// La prefattura del portale copre solo rete e ACI: la chiede solo un mese in cui
// uno dei due e' elaborato e non chiuso. Maggio (rete e ACI chiuse, extra aperta)
// e aprile (rete e ACI chiuse) no; febbraio (rete aperta) e giugno (rete approvata) si'.
const vPref = fatt.find(v => /Prefattura/.test(v.titolo));
verifica('prefattura chiesta solo per febbraio e giugno, non per aprile e maggio', vPref && /Febbraio/.test(vPref.titolo) && /Giugno/.test(vPref.titolo) && !/Aprile|Maggio/.test(vPref.titolo), vPref && vPref.titolo);

// Le richieste del consorzio si leggono col loro esito salvato: lo ricalcola sui
// terminati ogni caricamento delle primarie (importaBlocco, ritiri_ect).
const rEct = cruscotto({ oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: [], alertAperti: [], uploadLogs: [], assegnatiRete: [], assegnatiAci: [], documenti: MESI8(), prefatture: MESI8().map(d => ({ anno: 2026, mese: d.mese })), riepilogoQualifica: null, giacenzeSito: [], impiantiTarget: [],
  richiesteEct: [{ esito: 'da_confermare', scadenza: '2026-09-11', evasione_rilevata_il: '2026-09-10' }, { scadenza: '2026-09-11' }, { scadenza: '2026-09-11', evaso_il: '2026-09-09' }] });
const vEct = rEct.da_gestire.filter(v => v.area === 'Richieste ECT');
verifica('ECT: ritirata e da spuntare non e\' oltre il termine; senza esito salvato lo si ricava dai campi', vEct.length === 2 && vEct.some(v => v.gravita === 'critico' && v.titolo.startsWith('1 ')) && vEct.some(v => v.gravita === 'info' && v.titolo.startsWith('2 ')), vEct.map(v => v.titolo).join(' | '));

verifica('i codici delle regole si leggono come parole, le sigle restano maiuscole', nomeRegola('REGOLA_RITARDO_SLA') === 'Ritardo SLA' && nomeRegola('REGOLA_MIX_CLASSI_CONSORZIALE') === 'Mix classi consorziale' && nomeRegola('Conferimento fuori rotta') === 'Conferimento fuori rotta');

console.log('ELENCO UNICO');
const r = cruscotto({
  oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: ['primarie', 'secondarie', 'terziarie', 'pdr'],
  alertAperti: [{ severita: 'critico', regola_nome: 'Ritardo SLA' }, { severita: 'warning', regola_nome: 'Ritardo SLA' }, { severita: 'info', regola_nome: 'Mix classi' }],
  uploadLogs: logs, assegnatiRete: [{ id_ordine: 'C', ordine_immesso_il: '2025-09-23T22:00:00Z', ragione_sociale: 'Vecchio Srl' }], assegnatiAci: [],
  documenti: docs, prefatture: [{ anno: 2026, mese: 'Luglio' }],
  riepilogoQualifica: { scaduti: 2, non_conformi: 0, in_scadenza: 3, soggetti_critici: [{ nome: 'Alfa Srl' }], anomalie_catalogo: 1, anomalie_catalogo_testo: 'Patenti degli autisti' },
  giacenzeSito: [{ sito: 'TECNOGUM SRL', anno: 2026, tipo_destinazione: 'imp', target_totale_t: 2305 }], impiantiTarget: [{ nome_impianto: 'tecnogum', target: 2300000, stato: 'attivo' }],
  richiesteEct: [{ esito: 'aperta', scadenza: '2026-09-11' }, { esito: 'aperta', scadenza: '2026-10-15' }, { esito: 'da_confermare' }, { esito: 'evasa', scadenza: '2026-01-01' }],
});
const titoli = r.da_gestire.map(v => `${v.gravita}:${v.area}`);
verifica('prima i critici', r.da_gestire[0].gravita === 'critico' && r.da_gestire.findIndex(v => v.gravita === 'info') > r.da_gestire.findIndex(v => v.gravita === 'attenzione'), titoli.join(' | '));
verifica('alert critici, caricamento interrotto, qualifica scaduta, target divergente, ECT oltre il termine', ['Alert', 'Caricamento dati', 'Qualifica fornitori', 'Target', 'Richieste ECT'].every(a => r.da_gestire.some(v => v.gravita === 'critico' && v.area === a)), titoli.join(' | '));
verifica('dati vecchi (terziarie 25 giorni), mai caricato (pdr), arretrato oltre 60, mesi da elaborare', r.da_gestire.some(v => /terziarie: dati di 25 giorni/.test(v.titolo)) && r.da_gestire.some(v => /Mai caricato: pdr/.test(v.titolo)) && r.da_gestire.some(v => /Rete: 1 ordini aperti da oltre 60/.test(v.titolo)) && r.da_gestire.some(v => /6 mesi finiti non ancora elaborati/.test(v.titolo)), r.da_gestire.map(v => v.titolo).join(' | '));
verifica('un documento del catalogo intestato a chi non ce, sulla dashboard', r.da_gestire.some(v => v.area === 'Qualifica fornitori' && v.gravita === 'critico' && /non verr. mai chiesto/.test(v.titolo) && v.dettaglio === 'Patenti degli autisti'), r.da_gestire.filter(v => v.area === 'Qualifica fornitori').map(v => v.titolo).join(' | '));
verifica('ogni voce porta dove si risolve', r.da_gestire.every(v => v.link && v.link.startsWith('/')));
verifica('una sola richiesta ECT oltre il termine (quella evasa e quella futura no)', r.da_gestire.find(v => v.area === 'Richieste ECT' && v.gravita === 'critico').titolo.startsWith('1 '));
const pulito = cruscotto({ oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: ['primarie'], alertAperti: [], uploadLogs: [logs[0]], assegnatiRete: [], assegnatiAci: [], documenti: MESI8(), prefatture: MESI8().map(d => ({ anno: 2026, mese: d.mese })), riepilogoQualifica: null, giacenzeSito: [], impiantiTarget: [], richiesteEct: [] });
verifica('tutto a posto: elenco vuoto', pulito.da_gestire.length === 0, pulito.da_gestire.map(v => v.titolo).join(' | '));

console.log('DICHIARAZIONI RICONOSCIUTE A PORTALE');
// Rete e ACI caricate lo stesso giorno, a mezzanotte italiana (22:00Z del giorno prima)
const righePortale = [
  { data_dichiarazione: '2026-06-10T00:00:00Z', destinazione: 'GATIM SRL', prodotto: 'G1 - pneumatici', peso_associato_kg: 71710, granulo_kg: 100 },
  { data_dichiarazione: '2026-06-09T22:00:00Z', destinazione: 'GATIM SRL', prodotto: '.class9 PFU Autodemolizione', peso_associato_kg: 7770 },
];
const cRete = caricamentiPortale(righePortale, 2026, 'RETE').get('GATIM SRL');
const cAci = caricamentiPortale(righePortale, 2026, 'ACI').get('GATIM SRL');
verifica('caricamenti separati per canale, sul giorno italiano', cRete.length === 1 && cRete[0].kg === 71710 && cAci.length === 1 && cAci[0].kg === 7770 && cAci[0].data === '2026-06-10', JSON.stringify({ cRete, cAci }));
const svcFinto = (scritte) => ({ DichiarazioneSito: { update: async (id, campi) => { scritte.push({ id, ...campi }); } } });
let scritte = [];
let esito = await allineaDalPortale(svcFinto(scritte), 2026, righePortale, [
  { id: 'r5', sito: 'Gatim Srl', canale: 'RETE', mese: 'Maggio', quantita_kg: 71710 },
  { id: 'a5', sito: 'Gatim Srl', canale: 'ACI', mese: 'Maggio', quantita_kg: 7770 },
]);
verifica('maggio rete e maggio ACI riconosciuti, niente arretrato', esito.aggiornate.length === 2 && esito.arretrato.length === 0 && esito.non_trovate.length === 0 && scritte.every(a => a.caricata_il === '2026-06-10'), JSON.stringify(esito));

// L'ACI si dichiara per provenienza: Gatim aprile, primaria 8.200 e secondaria
// 14.340, caricate lo stesso giorno (22.540 kg). La riga del report che e'
// arrivata da uno stoccaggio porta la destinazione secondaria.
const aprileAci = [
  { data_dichiarazione: '2026-05-12T08:00:00Z', destinazione: 'GATIM SRL', prodotto: '.class9 PFU Autodemolizione', peso_associato_kg: 8200, granulo_kg: 8000 },
  { data_dichiarazione: '2026-05-12T08:00:00Z', destinazione: 'NAPPI SUD SRL', destinazione_secondaria: 'GATIM SRL', prodotto: '.class9 PFU Autodemolizione', peso_associato_kg: 14340, granulo_kg: 14000 },
];
const nostreAprile = () => [
  { id: 'ap', sito: 'Gatim Srl', canale: 'ACI', provenienza: 'primaria', mese: 'Aprile', quantita_kg: 8200 },
  { id: 'as', sito: 'Gatim Srl', canale: 'ACI', provenienza: 'secondaria', mese: 'Aprile', quantita_kg: 14340 },
];
scritte = [];
esito = await allineaDalPortale(svcFinto(scritte), 2026, aprileAci, nostreAprile());
verifica('ACI per provenienza: le due righe di aprile riconosciute, niente arretrato "dell\'anno prima"', esito.aggiornate.length === 2 && esito.non_trovate.length === 0 && esito.arretrato.length === 0
  && scritte.find(s => s.id === 'ap').granulo_kg === 8000 && scritte.find(s => s.id === 'as').granulo_kg === 14000
  && esito.aggiornate.every(a => a.canale === 'ACI' && a.provenienza), JSON.stringify(esito));
// Se il portale non distingue come noi (tutto senza destinazione secondaria), il
// mese si riconosce sommando le due provenienze, e i materiali si dividono in
// proporzione ai chili.
scritte = [];
esito = await allineaDalPortale(svcFinto(scritte), 2026, aprileAci.map(r => ({ ...r, destinazione: 'GATIM SRL', destinazione_secondaria: '' })), nostreAprile());
const ap = scritte.find(s => s.id === 'ap'), as = scritte.find(s => s.id === 'as');
verifica('ACI classificata diversamente dal portale: riconosciuta sulla somma del mese, materiali divisi', esito.aggiornate.length === 2 && esito.arretrato.length === 0 && ap && as && ap.caricata_il === '2026-05-12' && ap.granulo_kg + as.granulo_kg === 22000 && ap.granulo_kg === Math.round(22000 * 8200 / 22540), JSON.stringify({ esito, scritte }));

function MESI8() { return ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto'].map(m => ({ tipo: 'ATTIVA', anno: 2026, mese: m, stato: 'chiusa' })); }

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
