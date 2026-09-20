// Prova del cruscotto (base44/shared/cruscotto.ts): l'elenco unico delle cose da
// gestire, l'arretrato, i caricamenti, i mesi della fatturazione. npm run prove
import { cruscotto, etaArretrato, statoCaricamenti, statoMesiAttiva, nomeRegola } from '../base44/shared/cruscotto.ts';

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

verifica('i codici delle regole si leggono come parole, le sigle restano maiuscole', nomeRegola('REGOLA_RITARDO_SLA') === 'Ritardo SLA' && nomeRegola('REGOLA_MIX_CLASSI_CONSORZIALE') === 'Mix classi consorziale' && nomeRegola('Conferimento fuori rotta') === 'Conferimento fuori rotta');

console.log('ELENCO UNICO');
const r = cruscotto({
  oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: ['primarie', 'secondarie', 'terziarie', 'pdr'],
  alertAperti: [{ severita: 'critico', regola_nome: 'Ritardo SLA' }, { severita: 'warning', regola_nome: 'Ritardo SLA' }, { severita: 'info', regola_nome: 'Mix classi' }],
  uploadLogs: logs, assegnatiRete: [{ id_ordine: 'C', ordine_immesso_il: '2025-09-23T22:00:00Z', ragione_sociale: 'Vecchio Srl' }], assegnatiAci: [],
  documenti: docs, prefatture: [{ anno: 2026, mese: 'Luglio' }],
  riepilogoQualifica: { scaduti: 2, non_conformi: 0, in_scadenza: 3, soggetti_critici: [{ nome: 'Alfa Srl' }] },
  giacenzeSito: [{ sito: 'TECNOGUM SRL', anno: 2026, tipo_destinazione: 'imp', target_totale_t: 2305 }], impiantiTarget: [{ nome_impianto: 'tecnogum', target: 2300000, stato: 'attivo' }],
  richiesteEct: [{ esito: 'aperta', scadenza: '2026-09-11' }, { esito: 'aperta', scadenza: '2026-10-15' }, { esito: 'da_confermare' }, { esito: 'evasa', scadenza: '2026-01-01' }],
});
const titoli = r.da_gestire.map(v => `${v.gravita}:${v.area}`);
verifica('prima i critici', r.da_gestire[0].gravita === 'critico' && r.da_gestire.findIndex(v => v.gravita === 'info') > r.da_gestire.findIndex(v => v.gravita === 'attenzione'), titoli.join(' | '));
verifica('alert critici, caricamento interrotto, qualifica scaduta, target divergente, ECT oltre il termine', ['Alert', 'Caricamento dati', 'Qualifica fornitori', 'Target', 'Richieste ECT'].every(a => r.da_gestire.some(v => v.gravita === 'critico' && v.area === a)), titoli.join(' | '));
verifica('dati vecchi (terziarie 25 giorni), mai caricato (pdr), arretrato oltre 60, mesi da elaborare', r.da_gestire.some(v => /terziarie: dati di 25 giorni/.test(v.titolo)) && r.da_gestire.some(v => /Mai caricato: pdr/.test(v.titolo)) && r.da_gestire.some(v => /Rete: 1 ordini aperti da oltre 60/.test(v.titolo)) && r.da_gestire.some(v => /6 mesi finiti non ancora elaborati/.test(v.titolo)), r.da_gestire.map(v => v.titolo).join(' | '));
verifica('ogni voce porta dove si risolve', r.da_gestire.every(v => v.link && v.link.startsWith('/')));
verifica('una sola richiesta ECT oltre il termine (quella evasa e quella futura no)', r.da_gestire.find(v => v.area === 'Richieste ECT' && v.gravita === 'critico').titolo.startsWith('1 '));
const pulito = cruscotto({ oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: ['primarie'], alertAperti: [], uploadLogs: [logs[0]], assegnatiRete: [], assegnatiAci: [], documenti: MESI8(), prefatture: MESI8().map(d => ({ anno: 2026, mese: d.mese })), riepilogoQualifica: null, giacenzeSito: [], impiantiTarget: [], richiesteEct: [] });
verifica('tutto a posto: elenco vuoto', pulito.da_gestire.length === 0, pulito.da_gestire.map(v => v.titolo).join(' | '));

function MESI8() { return ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto'].map(m => ({ tipo: 'ATTIVA', anno: 2026, mese: m, stato: 'chiusa' })); }

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
