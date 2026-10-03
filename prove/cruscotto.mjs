// Prova del cruscotto (base44/shared/cruscotto.ts): l'elenco unico delle cose da
// gestire, l'arretrato, i caricamenti, i mesi della fatturazione. In fondo le
// dichiarazioni riconosciute a portale (base44/shared/agganciaDichiarazioni.ts),
// da cui dipendono la quadratura e i mesi "caricati". npm run prove
import { cruscotto, etaArretrato, statoCaricamenti, statoMesiAttiva, nomeRegola } from '../base44/shared/cruscotto.ts';
import { caricamentiPortale, allineaDalPortale, confrontaConIlPortale, canaliDaScrivere } from '../base44/shared/agganciaDichiarazioni.ts';

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
// Un caricamento fallito dopo lo svuotamento resta "in_corso" (importEcotyreFile,
// importaBlocco); un file sbagliato caricato dopo si chiude in "errore" a dati
// intatti, e non deve nascondere l'archivio rimasto vuoto.
const fallito = statoCaricamenti([
  { tipo_file: 'secondarie', esito: 'errore', created_date: '2026-09-20T12:00:00', messaggio: 'Formato file non valido' },
  { tipo_file: 'secondarie', esito: 'in_corso', created_date: '2026-09-20T11:00:00', messaggio: 'Caricamento non riuscito: nessuna riga scritta dopo lo svuotamento dell\'archivio' },
  { tipo_file: 'secondarie', esito: 'successo', created_date: '2026-09-18T08:00:00' },
], OGGI, ADESSO, ['secondarie']);
verifica('fallito dopo lo svuotamento e poi un file rifiutato: resta interrotto', fallito.interrotti.length === 1 && fallito.interrotti[0].il === '2026-09-20', JSON.stringify(fallito.interrotti));

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
const rc = cruscotto({ oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: [], alertAperti: [], uploadLogs: [], assegnatiRete: [], assegnatiAci: [], documenti: docsCanali, prefatture: [], riepilogoQualifica: null, richiesteEct: [] });
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
const rEct = cruscotto({ oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: [], alertAperti: [], uploadLogs: [], assegnatiRete: [], assegnatiAci: [], documenti: MESI8(), prefatture: MESI8().map(d => ({ anno: 2026, mese: d.mese })), riepilogoQualifica: null,
  richiesteEct: [{ esito: 'da_confermare', scadenza: '2026-09-11', evasione_rilevata_il: '2026-09-10' }, { scadenza: '2026-09-11' }, { scadenza: '2026-09-11', evaso_il: '2026-09-09' }] });
const vEct = rEct.da_gestire.filter(v => v.area === 'Richieste ECT');
// Dal 29/09/2026 una richiesta coi suoi ordini tutti terminati si chiude da sola:
// la voce non dice piu' "aspettano la tua spunta" ma "aspettano la risposta al
// consorzio", che e' la cosa che resta davvero da fare. Le tre righe qui sopra: una
// vecchia 'da_confermare', una aperta e scaduta, una con la data di evasione dal
// foglio del consorzio (che adesso vale evasa).
verifica('ECT: chi e\' stato ritirato non e\' oltre il termine, e resta da rispondere al consorzio',
  vEct.length === 2 && vEct.some(v => v.gravita === 'critico' && v.titolo.startsWith('1 '))
  && vEct.some(v => v.gravita === 'info' && v.titolo.startsWith('2 ') && /risposta al consorzio/.test(v.titolo)),
  vEct.map(v => v.titolo).join(' | '));
// Una richiesta gia' spuntata non torna a chiedere una risposta.
const rEctSpuntata = cruscotto({ oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: [], alertAperti: [], uploadLogs: [], assegnatiRete: [], assegnatiAci: [], documenti: MESI8(), prefatture: MESI8().map(d => ({ anno: 2026, mese: d.mese })), riepilogoQualifica: null,
  richiesteEct: [{ esito: 'evasa', evasione_rilevata_il: '2026-09-10', evasione_confermata: true }] });
verifica('e una gia\' spuntata non chiede piu\' niente', rEctSpuntata.da_gestire.filter(v => v.area === 'Richieste ECT').length === 0);

verifica('i codici delle regole si leggono come parole, le sigle restano maiuscole', nomeRegola('REGOLA_RITARDO_SLA') === 'Ritardo SLA' && nomeRegola('REGOLA_MIX_CLASSI_CONSORZIALE') === 'Mix classi consorziale' && nomeRegola('Conferimento fuori rotta') === 'Conferimento fuori rotta');

console.log('ELENCO UNICO');
const r = cruscotto({
  oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: ['primarie', 'secondarie', 'terziarie', 'pdr'],
  alertAperti: [{ severita: 'critico', regola_nome: 'Ritardo SLA' }, { severita: 'warning', regola_nome: 'Ritardo SLA' }, { severita: 'info', regola_nome: 'Mix classi' }],
  uploadLogs: logs, assegnatiRete: [{ id_ordine: 'C', ordine_immesso_il: '2025-09-23T22:00:00Z', ragione_sociale: 'Vecchio Srl' }], assegnatiAci: [],
  documenti: docs, prefatture: [{ anno: 2026, mese: 'Luglio' }],
  riepilogoQualifica: { scaduti: 2, non_conformi: 0, in_scadenza: 3, soggetti_critici: [{ nome: 'Alfa Srl' }], anomalie_catalogo: 1, anomalie_catalogo_testo: 'Patenti degli autisti' },
  // Dal 27/09/2026 il target dell'impianto sta solo in Target & Status: due numeri
  // diversi nei vecchi archivi non sono piu' una voce del cruscotto.
  giacenzeSito: [{ sito: 'TECNOGUM SRL', anno: 2026, tipo_destinazione: 'imp', target_totale_t: 2305 }], impiantiTarget: [{ nome_impianto: 'tecnogum', target: 2300000, stato: 'attivo' }],
  richiesteEct: [{ esito: 'aperta', scadenza: '2026-09-11' }, { esito: 'aperta', scadenza: '2026-10-15' }, { esito: 'da_confermare' }, { esito: 'evasa', scadenza: '2026-01-01' }],
});
const titoli = r.da_gestire.map(v => `${v.gravita}:${v.area}`);
verifica('prima i critici', r.da_gestire[0].gravita === 'critico' && r.da_gestire.findIndex(v => v.gravita === 'info') > r.da_gestire.findIndex(v => v.gravita === 'attenzione'), titoli.join(' | '));
verifica('alert critici, caricamento interrotto, qualifica scaduta, ECT oltre il termine', ['Alert', 'Caricamento dati', 'Qualifica fornitori', 'Richieste ECT'].every(a => r.da_gestire.some(v => v.gravita === 'critico' && v.area === a)), titoli.join(' | '));
verifica('nessuna voce sul target divergente: il target si scrive in un posto solo', !r.da_gestire.some(v => v.area === 'Target' || /Target divergente/.test(v.titolo)), titoli.join(' | '));
verifica('dati vecchi (terziarie 25 giorni), mai caricato (pdr), arretrato oltre 60, mesi da elaborare', r.da_gestire.some(v => /terziarie: dati di 25 giorni/.test(v.titolo)) && r.da_gestire.some(v => /Mai caricato: pdr/.test(v.titolo)) && r.da_gestire.some(v => /Rete: 1 ordini aperti da oltre 60/.test(v.titolo)) && r.da_gestire.some(v => /6 mesi finiti non ancora elaborati/.test(v.titolo)), r.da_gestire.map(v => v.titolo).join(' | '));
verifica('un documento del catalogo intestato a chi non ce, sulla dashboard', r.da_gestire.some(v => v.area === 'Qualifica fornitori' && v.gravita === 'critico' && /non verr. mai chiesto/.test(v.titolo) && v.dettaglio === 'Patenti degli autisti'), r.da_gestire.filter(v => v.area === 'Qualifica fornitori').map(v => v.titolo).join(' | '));
verifica('ogni voce porta dove si risolve', r.da_gestire.every(v => v.link && v.link.startsWith('/')));
verifica('una sola richiesta ECT oltre il termine (quella evasa e quella futura no)', r.da_gestire.find(v => v.area === 'Richieste ECT' && v.gravita === 'critico').titolo.startsWith('1 '));
const pulito = cruscotto({ oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: ['primarie'], alertAperti: [], uploadLogs: [logs[0]], assegnatiRete: [], assegnatiAci: [], documenti: MESI8(), prefatture: MESI8().map(d => ({ anno: 2026, mese: d.mese })), riepilogoQualifica: null, richiesteEct: [] });
verifica('tutto a posto: elenco vuoto', pulito.da_gestire.length === 0, pulito.da_gestire.map(v => v.titolo).join(' | '));

console.log('DATE OBBLIGATORIE (regola del 22/09/2026)');
// Il motore degli alert apre un alert per modulo e canale con quanti ordini
// terminati hanno date obbligatorie mancanti o incoerenti: il cruscotto li legge
// da li', senza rileggere le primarie, e ne fa una voce ciascuno col collegamento.
const alertDate = [
  { severita: 'critico', modulo: 'primarie_rete', canale: 'rete', regola_id: 'date_obbligatorie_rete', regola_nome: 'Ordini terminati con date obbligatorie mancanti o incoerenti', quanti: 3, senza_fine: 1, titolo: 'x' },
  { severita: 'warning', modulo: 'secondarie', canale: 'ACI', regola_id: 'date_obbligatorie_ACI', regola_nome: 'Ordini terminati con date obbligatorie mancanti o incoerenti', quanti: 1, senza_fine: 0, titolo: 'x' },
  { severita: 'warning', modulo: 'extra_raccolta', canale: 'extra', regola_id: 'date_obbligatorie_extra', regola_nome: 'Ordini terminati con date obbligatorie mancanti o incoerenti', titolo: 'Extra raccolta: ordini con date da sistemare' },
  { severita: 'warning', modulo: 'primarie_rete', regola_id: 'r1', regola_nome: 'Ritardo SLA' },
];
const rd = cruscotto({ oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: [], alertAperti: alertDate, uploadLogs: [], assegnatiRete: [], assegnatiAci: [], documenti: MESI8(), prefatture: MESI8().map(d => ({ anno: 2026, mese: d.mese })), riepilogoQualifica: null, richiesteEct: [] });
const vDate = rd.da_gestire.filter(v => v.area === 'Date obbligatorie');
const vRete = vDate.find(v => v.link === '/primarie-rete');
const vSec = vDate.find(v => v.link === '/secondarie');
const vExtra = vDate.find(v => v.link === '/extra-raccolta');
verifica('una voce per modulo e canale, col collegamento al modulo', vDate.length === 3 && vRete && vSec && vExtra, vDate.map(v => `${v.titolo} -> ${v.link}`).join(' | '));
verifica('rete: critica, 3 ordini, dice il senza fine trasporto', vRete.gravita === 'critico' && /^Primarie rete: 3 ordini terminati con date obbligatorie/.test(vRete.titolo) && /Di cui 1 senza fine trasporto/.test(vRete.dettaglio), JSON.stringify(vRete));
verifica('secondarie ACI: da guardare, col canale nel titolo', vSec.gravita === 'attenzione' && /^Secondarie · ACI: 1 ordine terminato/.test(vSec.titolo), JSON.stringify(vSec));
verifica('un alert senza conteggi si dice col suo titolo; l\'extra si corregge nella scheda', vExtra.titolo === 'Extra raccolta: ordini con date da sistemare' && /nella scheda/.test(vExtra.dettaglio), JSON.stringify(vExtra));
const vAlert = rd.da_gestire.filter(v => v.area === 'Alert');
verifica('la voce generica degli alert non li conta due volte: resta il ritardo SLA', vAlert.length === 1 && vAlert[0].titolo === '1 alert aperti' && /Ritardo SLA \(1\)/.test(vAlert[0].dettaglio) && rd.alert.totale === 4, vAlert.map(v => `${v.titolo} [${v.dettaglio}]`).join(' | '));

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
// L'ACI SI RICONOSCE MA NON SI SCRIVE (regola dell'utente, 02/10/2026).
//
// Il confronto con il portale resta su tutti e due i canali, perche' serve a
// DIRE quali mesi il portale conosce. La scrittura no: fra i campi che si
// salvano ci sono i materiali, e sull'ACI quelli li trascrive l'amministratore
// dalle dichiarazioni cartacee che gli impianti mandano via email - «non c'e'
// altro modo che sia io ad inserirli manualmente». Riscriverli coi numeri del
// portale sarebbe una perdita, non un doppione.
verifica("maggio: la rete si scrive, l'ACI si riconosce e si lascia stare",
  esito.aggiornate.length === 1 && esito.aggiornate[0].canale === 'RETE'
  && esito.arretrato.length === 0 && esito.non_trovate.length === 0
  && scritte.length === 1 && scritte[0].caricata_il === '2026-06-10', JSON.stringify(esito));

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
verifica('ACI per provenienza: riconosciute senza arretrato, e nessuna riscritta',
  esito.aggiornate.length === 0 && esito.non_trovate.length === 0 && esito.arretrato.length === 0
  && scritte.length === 0, JSON.stringify({ esito, scritte }));
// Se il portale non distingue come noi (tutto senza destinazione secondaria), il
// mese si riconosce sommando le due provenienze, e i materiali si dividono in
// proporzione ai chili.
scritte = [];
esito = await allineaDalPortale(svcFinto(scritte), 2026, aprileAci.map(r => ({ ...r, destinazione: 'GATIM SRL', destinazione_secondaria: '' })), nostreAprile());
const ap = scritte.find(s => s.id === 'ap'), as = scritte.find(s => s.id === 'as');
verifica('ACI classificata diversamente dal portale: si riconosce, e i materiali restano quelli scritti a mano',
  esito.aggiornate.length === 0 && esito.arretrato.length === 0 && scritte.length === 0, JSON.stringify({ esito, scritte }));
// E se un domani si volesse l'ACI, lo si deve chiedere per nome: allora si
// riconosce sulla somma del mese e i materiali si dividono in proporzione ai
// chili, che e' il comportamento costruito il 29/09/2026 e che resta li'.
scritte = [];
esito = await allineaDalPortale(svcFinto(scritte), 2026, aprileAci.map(r => ({ ...r, destinazione: 'GATIM SRL', destinazione_secondaria: '' })), nostreAprile(), ['RETE', 'ACI']);
{
  const ap = scritte.find(s => s.id === 'ap'), as = scritte.find(s => s.id === 'as');
  verifica("chiedendolo per nome, l'ACI si allinea come prima",
    esito.aggiornate.length === 2 && ap && as && ap.caricata_il === '2026-05-12'
    && ap.granulo_kg + as.granulo_kg === 22000 && ap.granulo_kg === Math.round(22000 * 8200 / 22540),
    JSON.stringify({ esito, scritte }));
}

// === UNA DICHIARAZIONE CHE IL PORTALE HA E IL GESTIONALE NO ===
//
// Il 01/10/2026 l'utente ha dichiarato a portale il quantitativo di agosto
// raccolto da Green Tyre Project e il gestionale non se n'e' accorto: senza una
// nostra riga mensile con lo stesso peso non c'era niente da agganciare, e quel
// caricamento finiva fra "l'arretrato dell'anno prima" - una motivazione falsa -
// che la pagina non mostrava affatto. Ora si guarda di che mese sono gli ordini
// che il caricamento chiude.
console.log('UNA DICHIARAZIONE CHE IL PORTALE HA E IL GESTIONALE NO');
const gtp = [
  { data_dichiarazione: '2026-10-01T08:00:00Z', fine_trasporto: '2026-08-12T10:00:00Z', destinazione: 'GREEN TYRE PROJECT SRL', prodotto: 'G1 - pneumatici', peso_associato_kg: 18400, granulo_kg: 15000 },
  { data_dichiarazione: '2026-10-01T08:00:00Z', fine_trasporto: '2026-08-27T10:00:00Z', destinazione: 'GREEN TYRE PROJECT SRL', prodotto: 'G1 - pneumatici', peso_associato_kg: 6200, granulo_kg: 5000 },
];
{
  const e = confrontaConIlPortale(gtp, 2026, []);
  verifica('non e\' piu\' arretrato: e\' una dichiarazione da inserire', e.arretrato.length === 0 && e.da_inserire.length === 1, JSON.stringify(e));
  const v = e.da_inserire[0];
  verifica('col sito, il canale, i chili e il giorno del caricamento', v.sito === 'GREEN TYRE PROJECT SRL' && v.canale === 'RETE'
    && v.kg === 24600 && v.quanti === 1 && v.caricamenti[0].data === '2026-10-01', JSON.stringify(v));
  verifica('e DI CHE MESE sono gli ordini che chiude: agosto, tutti', v.mesi.length === 1 && v.mesi[0].mese === '2026-08' && v.mesi[0].kg === 24600, JSON.stringify(v.mesi));
  verifica('dicendo perche\' non si e\' trovato', /nessuna dichiarazione di rete di questo impianto/.test(v.motivo), v.motivo);
}
{
  // Con la nostra riga di agosto giusta si aggancia e non resta niente da inserire.
  const e = confrontaConIlPortale(gtp, 2026, [{ id: 'g8', sito: 'Green Tyre Project srl', canale: 'RETE', mese: 'Agosto', quantita_kg: 24600 }]);
  verifica('con la nostra riga di agosto si aggancia', e.trovati.length === 1 && e.da_inserire.length === 0 && e.arretrato.length === 0
    && e.trovati[0].caricata_il === '2026-10-01' && e.trovati[0].materiali.granulo_kg === 20000, JSON.stringify(e));
}
{
  // Un caricamento che chiude ordini dell'anno prima e' arretrato per davvero.
  const vecchio = gtp.map(r => ({ ...r, fine_trasporto: '2025-11-20T10:00:00Z' }));
  const e = confrontaConIlPortale(vecchio, 2026, []);
  verifica('l\'arretrato vero resta arretrato', e.da_inserire.length === 0 && e.arretrato.length === 1
    && /ordini degli anni precedenti/.test(e.arretrato[0].motivo), JSON.stringify(e.arretrato));
}
{
  // Un caricamento di un impianto che ha altre dichiarazioni ma nessuna con
  // quel peso: anche quello e' da inserire, non arretrato.
  const e = confrontaConIlPortale(gtp, 2026, [{ id: 'g7', sito: 'Green Tyre Project srl', canale: 'RETE', mese: 'Luglio', quantita_kg: 9000 }]);
  verifica('nessun nostro mese con quel peso: da inserire, non arretrato', e.da_inserire.length === 1 && e.arretrato.length === 0
    && /nessun nostro mese ha questo peso/.test(e.da_inserire[0].motivo), JSON.stringify(e.da_inserire));
  verifica('e il nostro luglio resta fra i mesi non trovati a portale', e.non_trovate.length === 1 && e.non_trovate[0].mese === 'Luglio', JSON.stringify(e.non_trovate));
}
{
  // I mesi degli ordini chiusi si tengono anche unendo i caricamenti dello
  // stesso giorno (ACI, dove le provenienze si sommano).
  const c = caricamentiPortale(gtp, 2026, 'RETE').get('GREEN TYRE PROJECT SRL');
  verifica('un caricamento porta i mesi dei suoi ordini e la provenienza', c.length === 1 && c[0].mesi.length === 1
    && c[0].mesi[0].mese === '2026-08' && c[0].provenienze.join() === 'primaria', JSON.stringify(c));
}

function MESI8() { return ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto'].map(m => ({ tipo: 'ATTIVA', anno: 2026, mese: m, stato: 'chiusa' })); }

// CHI NON DICE NIENTE ALLINEA SOLO LA RETE.
//
// La libreria lo faceva gia', ma la funzione allineaDichiarazioni ribaltava quel
// valore - rete E ACI - e il caricamento dei dati la chiama senza dire niente
// (src/lib/importGrandeFile.js, passo 'allineaDichiarazioni'). Cosi' ogni
// caricamento riscriveva l'ACI coi numeri del portale e cancellava i materiali
// trascritti a mano dalle dichiarazioni cartacee. Trovato dall'audit del
// 03/10/2026, da due revisori per conto loro.
// LA DICHIARAZIONE DI DICEMBRE SI CARICA A GENNAIO.
//
// Difetto alta dell'audit del 03/10/2026. L'anno di una riga del report si
// prendeva dal giorno del CARICAMENTO: chiedendo il 2026 la riga del 07/01/2027
// veniva scartata, e chiedendo il 2027 non trovava nessuna nostra riga, perche'
// le nostre dichiarazioni di dicembre sono dell'anno 2026. Non si agganciava in
// nessuno dei due anni e dicembre restava «da dichiarare» per sempre, senza un
// avviso da nessuna parte. Il periodo di un movimento e' la fine del trasporto
// (regola 1), e vale anche qui.
console.log('LA DICHIARAZIONE DI DICEMBRE CARICATA A GENNAIO');
const dicembre = [
  { data_dichiarazione: '2027-01-07T09:00:00Z', fine_trasporto: '2026-12-18T00:00:00Z', destinazione: 'GREEN TYRE PROJECT SRL', prodotto: 'G1 - pneumatici', peso_associato_kg: 80000 },
];
const cDic = caricamentiPortale(dicembre, 2026, 'RETE').get('GREEN TYRE PROJECT SRL');
verifica('il caricamento di gennaio sta nell\'anno degli ordini che chiude',
  !!cDic && cDic.length === 1 && cDic[0].kg === 80000, JSON.stringify(cDic));
verifica('ma il giorno resta quello vero del caricamento, che e\' la data da scrivere',
  !!cDic && !!cDic[0] && cDic[0].data === '2027-01-07', JSON.stringify(cDic));
// Nel 2027 la stessa riga si vede ancora - il caricamento e' di gennaio 2027 -
// ma li' e' arretrato, perche' per il 2027 chiude ordini dell'anno prima: e'
// esattamente quello che deve dire, invece di cercare un mese del 2027 che non
// esiste.
verifica('nel 2027 la stessa riga c\'e\', ma come arretrato',
  confrontaConIlPortale(dicembre, 2027, []).arretrato.length === 1
  && confrontaConIlPortale(dicembre, 2027, []).da_inserire.length === 0,
  JSON.stringify(confrontaConIlPortale(dicembre, 2027, [])));
scritte = [];
esito = await allineaDalPortale(svcFinto(scritte), 2026, dicembre, [
  { id: 'dic', sito: 'Green Tyre Project Srl', canale: 'RETE', mese: 'Dicembre', quantita_kg: 80000 },
]);
verifica('cosi\' dicembre si aggancia, e si segna caricata il 07/01/2027',
  esito.aggiornate.length === 1 && scritte.length === 1 && scritte[0].id === 'dic' && scritte[0].caricata_il === '2027-01-07',
  JSON.stringify({ esito, scritte }));
verifica('e non resta ne\' fra le non trovate ne\' fra l\'arretrato',
  esito.non_trovate.length === 0 && esito.arretrato.length === 0, JSON.stringify(esito));
// Senza fine trasporto l'unica data e' quella del caricamento, e si usa quella.
verifica('una riga senza fine trasporto resta nell\'anno in cui e\' stata caricata',
  caricamentiPortale([{ data_dichiarazione: '2026-06-10T00:00:00Z', destinazione: 'GATIM SRL', prodotto: 'G1', peso_associato_kg: 1000 }], 2026, 'RETE').size === 1
  && caricamentiPortale([{ data_dichiarazione: '2026-06-10T00:00:00Z', destinazione: 'GATIM SRL', prodotto: 'G1', peso_associato_kg: 1000 }], 2027, 'RETE').size === 0);

console.log('CANALI CHE SI SCRIVONO');
verifica('senza indicazione si scrive solo la rete',
  canaliDaScrivere(undefined).join() === 'RETE' && canaliDaScrivere(null).join() === 'RETE' && canaliDaScrivere([]).join() === 'RETE');
verifica("l'ACI si scrive solo chiedendolo per nome",
  canaliDaScrivere(['ACI']).join() === 'ACI' && canaliDaScrivere(['RETE', 'ACI']).join() === 'RETE,ACI');
verifica('un canale che non esiste non apre la scrittura a niente',
  canaliDaScrivere(['EXTRA_RACCOLTA']).join() === 'RETE' && canaliDaScrivere(['ACI', 'EXTRA_RACCOLTA']).join() === 'ACI');
verifica('un valore che non e\' un elenco vale come niente detto',
  canaliDaScrivere('ACI').join() === 'RETE' && canaliDaScrivere({ ACI: true }).join() === 'RETE');

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
