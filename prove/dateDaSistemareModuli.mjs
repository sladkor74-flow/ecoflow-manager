// Prova delle date obbligatorie nei moduli che le perdevano (regola dell'utente
// del 22/09/2026: immissione, inizio e fine trasporto sono obbligatorie nei
// formulari, e dove mancano si segnala in ogni modulo con ordini terminati).
// La regola sta in movimenti.ts; qui si prova chi la usa: i soggetti della
// qualifica (qualificaFornitori.ts), l'evasione degli assegnati per canale
// (evasioneAssegnati.ts), lo strumento giacenze di EcoTyna
// (strumentiAssistente.ts) e le frasi del report settimanale, a video e nel PDF
// (reportSettimanaleExport.js). npm run prove
import { readFileSync } from 'node:fs';
import { individuaSoggetti } from '../base44/shared/qualificaFornitori.ts';
import { normalizzaPrimaria, situazioneCanali } from '../base44/shared/evasioneAssegnati.ts';
import { eseguiStrumento } from '../base44/shared/strumentiAssistente.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const archivio = (righe) => ({ list: async () => righe, filter: async () => righe });
const finto = (tabelle) => ({ asServiceRole: { entities: Object.fromEntries(['PrimariaRete', 'PrimariaAci', 'ExtraRaccolta', 'Secondaria', 'Fornitore', 'QualificaInclusione'].map(n => [n, archivio(tabelle[n] || [])])) } });

console.log('QUALIFICA: CHI HA SOLO TERMINATI SENZA FINE TRASPORTO');
const date = (immesso, inizio, fine) => ({ stato: 'terminato', ordine_immesso_il: immesso, trasporto_iniziato_il: inizio, trasporto_finito_il: fine });
const esito = await individuaSoggetti(finto({
  PrimariaRete: [
    { id_ordine: 'ET1', trasportatore: 'ALFA SRL', destinazione: 'IMPIANTO UNO', tipo_destinazione: 'Imp', key_account: 'ECOTYRE', ...date('2026-05-01T08:00:00Z', '2026-05-03T08:00:00Z', '2026-05-03T10:00:00Z') },
    { id_ordine: 'ET2', numero_fir: 'FIR2', trasportatore: 'BETA SRL', destinazione: 'IMPIANTO UNO', tipo_destinazione: 'Imp', key_account: 'ECOTYRE', ...date('2026-06-01T08:00:00Z', '2026-06-03T08:00:00Z', null) },
    { id_ordine: 'ET3', trasportatore: 'GAMMA SRL', ...date('2025-12-01T08:00:00Z', null, null) },
    { id_ordine: 'ET4', trasportatore: 'EPSILON SRL', ...date(null, '2026-08-01T08:00:00Z', null) },
    { id_ordine: 'ET5', trasportatore: 'ZETA SRL', ...date('2026-08-01T08:00:00Z', null, null) },
    { id_ordine: 'ET6', trasportatore: 'OMEGA SRL', stato: 'assegnato', ordine_immesso_il: '2026-08-01T08:00:00Z' },
  ],
  PrimariaAci: [
    { id_ordine: 'EA1', trasportatore: 'BETA SRL', destinazione: 'IMPIANTO UNO', tipo_destinazione: 'Imp', ...date('2026-07-01T08:00:00Z', null, null) },
  ],
  Secondaria: [
    { id_ordine: 'ES1', stoccaggio: 'DELTA STOCCAGGI', trasportatore: 'ALFA SRL', destinazione: 'IMPIANTO UNO', classe: 'P', ...date('2026-06-10T08:00:00Z', '2026-06-11T08:00:00Z', null) },
  ],
  QualificaInclusione: [{ id: 'q1', azione: 'escludi', soggetto_nome: 'ZETA SRL', motivo: 'non contrattualizzato' }],
}), 2026);
const nomi = esito.soggetti.map(s => s.nome);
const daDate = esito.soggetti_da_date;
const trova = (nome, ruolo, canale) => daDate.filter(s => s.nome === nome && s.ruolo === ruolo && (!canale || s.canale === canale));
verifica('i soggetti restano quelli con la fine trasporto nell\'anno', nomi.includes('ALFA SRL') && nomi.includes('IMPIANTO UNO') && !nomi.includes('BETA SRL') && !nomi.includes('DELTA STOCCAGGI'), JSON.stringify(nomi));
verifica('chi ha solo terminati senza fine trasporto si dice a parte, un canale per volta', trova('BETA SRL', 'raccolta', 'RETE').length === 1 && trova('BETA SRL', 'raccolta', 'ACI').length === 1, JSON.stringify(daDate));
verifica('con l\'ordine e le date che mancano', trova('BETA SRL', 'raccolta', 'RETE')[0].ordini[0] === 'ET2 (FIR FIR2): manca la data di fine trasporto' && trova('BETA SRL', 'raccolta', 'RETE')[0].quanti === 1, JSON.stringify(trova('BETA SRL', 'raccolta', 'RETE')));
verifica('uno stoccaggio delle secondarie senza fine trasporto', trova('DELTA STOCCAGGI', 'stoccaggio', 'RETE').length === 1 && trova('DELTA STOCCAGGI', 'stoccaggio')[0].movimento === 'secondarie');
verifica('un soggetto gia\' presente, ma senza quel ruolo, si dice per il ruolo', trova('ALFA SRL', 'trasporto_secondaria').length === 1 && trova('ALFA SRL', 'raccolta').length === 0);
verifica('un ruolo che il soggetto ha gia\' non si ripete', trova('IMPIANTO UNO', 'trattamento').length === 0 && trova('ECOTYRE', 'cliente').length === 0);
verifica('l\'anno e\' quello dell\'immissione: un senza fine del 2025 non c\'e\'', trova('GAMMA SRL', 'raccolta').length === 0);
verifica('senza immissione vale l\'inizio trasporto', trova('EPSILON SRL', 'raccolta').length === 1 && trova('EPSILON SRL', 'raccolta')[0].ordini[0].includes('mancano le date di immissione e fine trasporto'), JSON.stringify(trova('EPSILON SRL', 'raccolta')));
verifica('chi e\' escluso a mano non si ripete, chi non e\' terminato nemmeno', trova('ZETA SRL', 'raccolta').length === 0 && daDate.every(s => s.nome !== 'OMEGA SRL'));

console.log('EVASIONE ASSEGNATI: EVASI DEL MESE CON LE DATE DA SISTEMARE');
const riga = (id, canale, d, altro = {}) => normalizzaPrimaria({ id_ordine: id, trasportatore: 'ALFA SRL', peso_effettivo: 1000, provincia: 'NA', ...d, ...altro }, canale);
const terminati = [
  riga('ET10', 'rete', date('2026-09-01T08:00:00Z', '2026-09-02T08:00:00Z', '2026-09-02T10:00:00Z')),
  riga('ET11', 'rete', date('2026-09-01T08:00:00Z', null, '2026-09-05T10:00:00Z')),
  riga('ET12', 'rete', date('2026-09-01T08:00:00Z', null, null)),
  riga('ET13', 'rete', date(null, null, '2026-08-20T10:00:00Z')),
  // l'ACI di prova: gli manca l'immissione. Un inizio prima dell'immissione non
  // e' piu' un'incoerenza (movimenti.ts): a portale l'immissione e' la
  // registrazione dell'ordine e arriva spesso dopo la partenza.
  riga('EA10', 'aci', date(null, '2026-09-08T08:00:00Z', '2026-09-12T10:00:00Z')),
];
verifica('normalizzaPrimaria porta le date da sistemare, vuote se sono a posto', terminati[0].date === '' && terminati[1].date === 'manca la data di inizio trasporto');
const { canali, alert } = situazioneCanali({ chiave: terminati[0].chiaveTrasp, anno: 2026, mese: 9, oggi: '2026-09-22', terminati, assegnati: [] });
verifica('rete: l\'evaso senza inizio trasporto e\' contato e si dice', canali.rete.evasi === 2 && canali.rete.date_da_sistemare.length === 1 && canali.rete.date_da_sistemare[0].id_ordine === 'ET11', JSON.stringify(canali.rete));
verifica('il senza fine resta fra i senza fine, non fra le date del mese', canali.rete.senza_fine.includes('ET12') && !canali.rete.date_da_sistemare.some(v => v.id_ordine === 'ET12'));
verifica('un evaso di un altro mese non e\' nelle date del mese', !canali.rete.date_da_sistemare.some(v => v.id_ordine === 'ET13'));
verifica('ACI a parte, con la sua data mancante', canali.aci.date_da_sistemare.length === 1 && canali.aci.date_da_sistemare[0].date === 'manca la data di immissione' && canali.extra.date_da_sistemare.length === 0, JSON.stringify(canali.aci));
const alertDate = alert.filter(a => a.tipo === 'date_da_sistemare');
verifica('un alert per canale, mai uno per tutti', alertDate.length === 2 && alertDate[0].messaggio.includes('di rete') && alertDate[0].messaggio.includes('ET11') && alertDate[1].messaggio.includes('ACI'), JSON.stringify(alertDate));

console.log('ECOTYNA: LA GIACENZA DI UN SITO SOLO');
const anomalie = [
  ...Array.from({ length: 30 }, (_, i) => ({ tipo: 'giacenza_negativa', sito: 'ALTRO SITO ' + i, classe: 'P', kg: -1 })),
  { tipo: 'date_da_sistemare', sito: 'NAPPI SUD SRL', canale: 'RETE', n: 2 },
  { tipo: 'ordini_senza_fine_trasporto', n: 1, kg: 100 },
];
const righeGiacenze = [
  { sito: 'NAPPI SUD SRL', tipo_destinazione: 'Stoc', data_rilevazione: '2026-09-01', giacenza_rete_t: 10, date_da_sistemare: [{ canale: 'RETE', n: 2, senza_fine: 1 }] },
  { sito: 'ALTRO SITO 0', tipo_destinazione: 'Imp', fotografia: { del: '2026-09-01' }, giacenza_rete_t: 5 },
];
const conGiacenze = { functions: { invoke: async () => ({ data: { righe: righeGiacenze, anomalie } }) }, asServiceRole: { entities: {} } };
const unSito = (await eseguiStrumento(conGiacenze, 'giacenze', { anno: 2026, sito: 'Nappi Sud' })).dati;
verifica('le anomalie del sito chiesto vengono prima e non si tagliano; restano quelle senza sito', unSito.anomalie.quanti === 2 && unSito.anomalie.righe[0].tipo === 'date_da_sistemare' && unSito.anomalie.righe[1].tipo === 'ordini_senza_fine_trasporto', JSON.stringify(unSito.anomalie).slice(0, 300));
verifica('la riga del sito porta le sue date da sistemare, per canale', unSito.siti.righe.length === 1 && unSito.siti.righe[0].date_da_sistemare[0].senza_fine === 1);
verifica('senza un sito, tutte le anomalie', (await eseguiStrumento(conGiacenze, 'giacenze', { anno: 2026 })).dati.anomalie.quanti === 32);

console.log('REPORT SETTIMANALE: LE FRASI DELLE DATE, A VIDEO E NEL PDF');
const sorgente = readFileSync(new URL('../src/lib/reportSettimanaleExport.js', import.meta.url), 'utf8')
  .replace("import { jsPDF } from 'jspdf';", 'const jsPDF = null;')
  .replace("import { formatTonnellate, formatPercentuale } from '@/lib/utils';", 'const formatTonnellate = String, formatPercentuale = String;');
const { frasiDateDaSistemare } = await import('data:text/javascript;base64,' + Buffer.from(sorgente).toString('base64'));
const frasi = frasiDateDaSistemare({ nome_mese: 'Settembre', date_da_sistemare: {
  senza_fine: { ordini: 3, senza_fine: 3, esempi: [{ id_ordine: 'ET1', numero_fir: 'F1', date: 'manca la data di fine trasporto' }] },
  nel_mese: { ordini: 1, senza_fine: 0, esempi: [{ id_ordine: 'ET2', numero_fir: '', date: 'manca la data di inizio trasporto' }] },
} });
verifica('una frase per i senza fine, fuori da ogni settimana, e una per il mese', frasi.length === 2 && frasi[0].includes('non contati in nessuna settimana: 3 ordini (ET1 (FIR F1): manca la data di fine trasporto; e altri 2)') && frasi[1].startsWith('Di Settembre') && frasi[1].includes('1 ordine (ET2: manca'), JSON.stringify(frasi));
verifica('niente da dire: nessuna frase', frasiDateDaSistemare({}).length === 0 && frasiDateDaSistemare(null).length === 0);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
