// Prova del catalogo della qualifica (base44/shared/qualificaFornitori.ts): un
// documento si chiede per ruolo oppure a fornitori indicati per nome, mai in
// entrambi i modi. npm run prove
import {
  soggettiDelTipo, richiestoA, valutaSoggetto, eventiDaSegnalare, anomalieCatalogo,
} from '../base44/shared/qualificaFornitori.ts';
import { problemaTipoSbagliato } from '../base44/shared/tipiDocumento.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const OGGI = '2026-09-20';
const alfa = { chiave: 'alfa raccolta', nome: 'ALFA RACCOLTA SRL', ruoli: ['raccolta'] };
const beta = { chiave: 'beta trasporti', nome: 'BETA TRASPORTI SRL', ruoli: ['raccolta'] };
const soggetti = [alfa, beta];

const visura = { id: 't1', nome: 'Visura camerale', si_applica_a: 'raccolta', obbligatorio: true, tipo_scadenza: 'nessuna' };
const patenti = { id: 't2', nome: 'Patenti degli autisti', obbligatorio: true, tipo_scadenza: 'da_documento', preavviso_giorni: 30, solo_per_soggetti: [{ chiave: 'alfa raccolta', nome: 'ALFA RACCOLTA SRL' }] };
const cqc = { id: 't3', nome: 'CQC', si_applica_a: 'raccolta', obbligatorio: true, tipo_scadenza: 'da_documento', solo_per_soggetti: ['BETA TRASPORTI SRL'] };
const orfano = { id: 't4', nome: 'Documento orfano', si_applica_a: '', obbligatorio: true };
const perGamma = { id: 't5', nome: 'Patente Gamma', obbligatorio: true, solo_per_soggetti: [{ chiave: 'gamma spa', nome: 'GAMMA SPA' }] };
const spenta = { id: 't6', nome: 'Voce disattivata', attivo: false, solo_per_soggetti: [{ chiave: 'gamma spa', nome: 'GAMMA SPA' }] };
const catalogo = [visura, patenti, cqc, orfano, perGamma, spenta];

console.log('A CHI E RICHIESTO');
verifica('la ragione sociale scritta per esteso diventa la chiave', soggettiDelTipo(cqc)[0].chiave === 'beta trasporti');
verifica('senza fornitori indicati vale il ruolo', richiestoA(visura, alfa) && richiestoA(visura, beta));
verifica('con i fornitori indicati vale solo per loro', richiestoA(patenti, alfa) && !richiestoA(patenti, beta));
verifica('i fornitori indicati battono il ruolo', richiestoA(cqc, beta) && !richiestoA(cqc, alfa));
verifica('una voce disattivata non si chiede a nessuno', !richiestoA(spenta, alfa) && !richiestoA(spenta, beta));

console.log('VALUTAZIONE DEL SOGGETTO');
const vAlfa = valutaSoggetto(alfa, catalogo, [], OGGI);
const vBeta = valutaSoggetto(beta, catalogo, [], OGGI);
const nomi = (v) => v.requisiti.map(r => r.tipo_nome).sort();
verifica('ad ALFA si chiedono visura e patenti, non la CQC', String(nomi(vAlfa)) === String(['Patenti degli autisti', 'Visura camerale']), String(nomi(vAlfa)));
verifica('a BETA si chiedono visura e CQC, non le patenti', String(nomi(vBeta)) === String(['CQC', 'Visura camerale']), String(nomi(vBeta)));
verifica('il documento intestato e segnato come tale', vAlfa.requisiti.find(r => r.tipo_id === 't2').nominale === true && vAlfa.requisiti.find(r => r.tipo_id === 't1').nominale === false);
verifica('senza il file il documento risulta mancante', vAlfa.requisiti.find(r => r.tipo_id === 't2').stato === 'mancante' && vAlfa.stato === 'da_completare');

console.log('ALERT');
const mancanti = eventiDaSegnalare([vAlfa]).filter(e => e.stato === 'mancante');
verifica('la mancanza del documento intestato fa alert', mancanti.some(e => e.tipo === 'Patenti degli autisti' && e.soggetto === 'ALFA RACCOLTA SRL'));
const conScadenza = valutaSoggetto(alfa, [patenti], [
  { id: 'd1', soggetto_chiave: 'alfa raccolta', tipo_documento_id: 't2', stato: 'attivo', analisi_stato: 'completata', data_emissione: '2026-01-10', data_scadenza: '2026-10-05' },
], OGGI);
verifica('a quindici giorni dalla scadenza il documento e in scadenza', conScadenza.requisiti[0].stato === 'in_scadenza' && conScadenza.requisiti[0].giorni === 15);
const scadenze = eventiDaSegnalare([conScadenza]);
verifica('la scadenza del documento intestato fa alert, soglia 15', scadenze.some(e => e.stato === 'in_scadenza' && e.soglia === 15));
const scaduto = valutaSoggetto(alfa, [patenti], [
  { id: 'd2', soggetto_chiave: 'alfa raccolta', tipo_documento_id: 't2', stato: 'attivo', analisi_stato: 'completata', data_scadenza: '2026-09-01' },
], OGGI);
verifica('dopo la scadenza il documento e scaduto e il soggetto critico', scaduto.requisiti[0].stato === 'scaduto' && scaduto.stato === 'critico');

console.log('DOCUMENTO NELLA CASELLA SBAGLIATA');
// Il controllo sul tipo vale anche per i documenti analizzati prima che esistesse:
// si rilegge cio che l agente aveva estratto, senza chiamarlo di nuovo.
const visuraTipo = { id: 't7', nome: 'Visura camerale', si_applica_a: 'raccolta', obbligatorio: true, tipo_scadenza: 'nessuna' };
const conLettura = (tipoLetto, problemiSalvati) => ({ id: 'd3', soggetto_chiave: 'alfa raccolta', tipo_documento_id: 't7', stato: 'attivo', analisi_stato: 'completata', problemi_json: JSON.stringify(problemiSalvati || []), analisi_json: JSON.stringify({ lettura: { leggibile: true, tipo_documento: tipoLetto } }) });
const sbagliato = valutaSoggetto(alfa, [visuraTipo], [conLettura('DURC')], OGGI).requisiti[0];
verifica('un DURC caricato sotto la visura e non conforme, senza rianalizzarlo', sbagliato.stato === 'non_conforme' && /Documento sbagliato/.test(sbagliato.problemi[0].messaggio), sbagliato.stato + ' ' + JSON.stringify(sbagliato.problemi));
verifica('il messaggio nomina tutti e due i documenti', /Visura camerale/.test(sbagliato.problemi[0].messaggio) && /DURC/.test(sbagliato.problemi[0].messaggio));
const giusto = valutaSoggetto(alfa, [visuraTipo], [conLettura('Visura ordinaria')], OGGI).requisiti[0];
verifica('il documento giusto resta valido', giusto.stato === 'valido' && giusto.problemi.length === 0, giusto.stato);
const ignoto = valutaSoggetto(alfa, [visuraTipo], [conLettura('Attestazione SOA')], OGGI).requisiti[0];
verifica('se il tipo non si riconosce non si inventa un problema', ignoto.problemi.length === 0);
const dopoAgente = valutaSoggetto(alfa, [visuraTipo], [conLettura('DURC', [problemaTipoSbagliato('Visura camerale', { tipo_documento: 'DURC' })])], OGGI).requisiti[0];
verifica('il problema non si sdoppia se l agente lo aveva gia scritto', dopoAgente.problemi.filter(p => /Documento sbagliato/.test(p.messaggio)).length === 1);

console.log('ERRORI DI IMPOSTAZIONE');
const an = anomalieCatalogo(catalogo, soggetti, 2026);
const errori = an.filter(a => a.gravita === 'errore');
verifica('due errori: la voce senza destinatario e quella intestata a chi non ce', errori.length === 2, String(errori.map(e => e.tipo_id)));
verifica('la voce senza ruolo ne fornitore viene segnalata', errori.some(e => e.tipo_id === 't4'));
verifica('il fornitore che nel 2026 non risulta viene segnalato col nome', errori.some(e => e.tipo_id === 't5' && e.messaggio.includes('GAMMA SPA') && e.messaggio.includes('2026')));
verifica('una voce disattivata non produce errori', !an.some(a => a.tipo_id === 't6'));
verifica('ruoli e fornitori insieme: si avvisa che i ruoli non contano', an.some(a => a.tipo_id === 't3' && a.gravita === 'attenzione'));
verifica('le voci a posto non producono niente', !an.some(a => a.tipo_id === 't1' || a.tipo_id === 't2'));

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
