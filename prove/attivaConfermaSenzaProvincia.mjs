// UN RITIRO ACI SENZA PROVINCIA FA CHIEDERE CONFERMA PRIMA DI ELABORARE
// (revisione del gruppo D-H, 14/10/2026, sulla decisione del 13/10/2026).
//
// Dal 13/10/2026 un ritiro ACI senza provincia ne' regione e' un errore: la
// riga resta a zero euro e il documento ACI non si verifica finche' non si
// corregge (calcolaRigheAttiva, anomalia 'regione_mancante' con gravita
// 'errore'). Non e' piu' anche una combinazione senza tariffa: AttivaDashboard
// contava solo quelle, e con le tariffe ACI tutte regionali del 2026 «Elabora
// Mese» e «Rielabora» partivano senza chiedere niente. Prima le chiedevano.
//
// La prova monta AttivaDashboard (paginaFinta) con le anomalie del calcolo vero.
// Uso: node prove/attivaConfermaSenzaProvincia.mjs [percorso di AttivaDashboard.jsx]
// (senza argomento, quella del repository).
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const QUI = dirname(fileURLToPath(import.meta.url));
// la prova sta in prove/ del repository; dallo scratchpad si passa la radice con REPO
const REPO = process.env.REPO ? resolve(process.env.REPO) : resolve(QUI, '..');
const { caricaPagina, aspetta, trova, testo, nomeDi, clienteFinto } = await import(pathToFileURL(join(REPO, 'prove/dati/paginaFinta.mjs')).href);
const { calcolaRigheAttiva } = await import(pathToFileURL(join(REPO, 'base44/shared/attivaCalcolo.ts')).href);

let ok = 0, ko = 0;
const verifica = (nome, cond, dettaglio) => {
  if (cond) { ok++; console.log('  ok  ' + nome); } else { ko++; console.log('  NO  ' + nome + (dettaglio !== undefined ? ' -> ' + (typeof dettaglio === 'string' ? dettaglio : JSON.stringify(dettaglio)) : '')); }
};

// La pagina da provare: quella del repository o, se data, un'altra copia, coi
// percorsi relativi portati sul repository (in una cartella temporanea, tolta subito).
const scelta = process.argv[2] ? resolve(process.argv[2]) : join(REPO, 'src/components/fatturazione/AttivaDashboard.jsx');
const sorgente = readFileSync(scelta, 'utf8');
let p;
if (!process.argv[2]) p = await caricaPagina('components/fatturazione/AttivaDashboard');
else {
  const cartella = join(tmpdir(), 'prova-attiva-conferma-' + process.pid);
  mkdirSync(cartella, { recursive: true });
  const copia = join(cartella, 'AttivaDashboard.jsx');
  writeFileSync(copia, sorgente.replace(/from '\.\/([\w]+)'/g, "from '@/components/fatturazione/$1'"));
  try { p = await caricaPagina('components/fatturazione/AttivaDashboard', { file: copia }); } finally { rmSync(cartella, { recursive: true, force: true }); }
}

console.log('\n=== IL CALCOLO: CON LE TARIFFE ACI TUTTE REGIONALI, UN RITIRO SENZA PROVINCIA E\' UN ERRORE E NON UNA TARIFFA ===');
// le tariffe ACI attive del 2026, come nei dati veri: solo regionali, nessuna generica
const tariffe = [['Puglia', 240], ['Campania', 240], ['Basilicata', 230], ['Sicilia', 230], ['Calabria', 230]].map(([regione, valore], i) => ({
  id: 't-aci-' + i, direzione: 'ATTIVA', tipologia: 'ACI', regione, valore, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31',
}));
const ritiro = { id: 'aci-1', id_ordine: 'ET26999999', numero_fir: 'FIR999', provincia: '', regione: '', partner_operativo: 'SMOCO', stato: 'terminato', classe: 'C', cer: '160103',
  ordine_immesso_il: '2026-10-01T08:00:00.000Z', trasporto_iniziato_il: '2026-10-05T07:00:00.000Z', trasporto_finito_il: '2026-10-05T08:00:00.000Z', peso_effettivo: 2000 };
const calcolo = calcolaRigheAttiva({ reteAll: [], aciAll: [ritiro], extraAll: [], fornitori: [], tariffe, anno: 2026, mese: 'Ottobre', surplus: [] });
const anomalie = calcolo.anomalie;
verifica("l'anomalia e' una sola, 'regione_mancante', con gravita 'errore'", anomalie.length === 1 && anomalie[0].tipo === 'regione_mancante' && anomalie[0].gravita === 'errore', anomalie.map(a => [a.tipo, a.gravita]));
verifica('nessuna combinazione senza tariffa', !anomalie.some(a => !a.tipo || a.tipo === 'senza_tariffa'));

// Monta la dashboard, passa le anomalie dell'anteprima come fa RiepilogoEcotyre.
async function monta({ anomalieAnteprima, data = { RETE: {}, ACI: {}, EXTRA_RACCOLTA: {} }, funzioni = {} }) {
  const cli = clienteFinto({ funzioni: { elaboraFatturazioneAttiva: async () => ({ anomalie: [], superati: [] }), ...funzioni } });
  globalThis.__CLIENTE_FINTO = cli.cliente;
  const stato = { elaborato: 0 };
  const r = p.monta(p.Componente, { periodo: { anno: 2026, mese: 'Ottobre' }, setPeriodo: () => {}, data, loading: false, elaborating: false, onElabora: async () => { stato.elaborato++; }, onReload: async () => {}, isAdmin: true, anomalie: [], onVaiTariffe: () => {} });
  await aspetta(10);
  const riepilogo = trova(r.albero, el => el.props && typeof el.props.onAnomalieChange === 'function')[0];
  riepilogo.props.onAnomalieChange(anomalieAnteprima);
  await aspetta(10);
  return { r, cli, stato };
}
const dialogoAperto = (r) => trova(r.albero, el => nomeDi(el) === 'AlertDialog' && el.props.open)[0];
const elaboraMese = (r) => trova(r.albero, el => nomeDi(el) === 'Button' && /Elabora Mese/.test(testo(el)))[0];
const pulsante = (r, canale, azione) => trova(r.albero, el => nomeDi(el) === 'Pulsante' && el.props.azione === azione && el.props.t?.key === canale)[0];

console.log('\n=== «ELABORA MESE» CHIEDE CONFERMA E DICE DELLA PROVINCIA ===');
{
  const { r, stato } = await monta({ anomalieAnteprima: anomalie });
  elaboraMese(r).props.onClick();
  await aspetta(10);
  const d = dialogoAperto(r);
  const t = d ? testo(d) : '';
  verifica('la conferma si apre', !!d);
  verifica('il mese non si elabora subito', stato.elaborato === 0, stato.elaborato);
  verifica('la frase dice il ritiro senza provincia, coi chili in tonnellate', /ACI: un ritiro senza provincia né regione \(2,00 t\)/.test(t), t);
  verifica('e manda a correggere la provincia nel caricamento', /correggi la provincia nel caricamento/.test(t), t);
  verifica('non parla di una tariffa che manca', !/tariffa applicabile/.test(t), t);
  const conferma = d && trova(d, el => nomeDi(el) === 'AlertDialogAction')[0];
  if (conferma) { conferma.props.onClick(); await aspetta(10); }
  verifica('«Elabora comunque» elabora una volta', !!conferma && stato.elaborato === 1, { conferma: !!conferma, elaborato: stato.elaborato });
  r.smonta();
}

console.log('\n=== SENZA ANOMALIE SI ELABORA SUBITO; LA TARIFFA MANCANTE RESTA COM\'ERA ===');
{
  const { r, stato } = await monta({ anomalieAnteprima: [] });
  elaboraMese(r).props.onClick();
  await aspetta(10);
  verifica('nessuna conferma, elaborato subito', !dialogoAperto(r) && stato.elaborato === 1, { dialogo: !!dialogoAperto(r), elaborato: stato.elaborato });
  r.smonta();
}
{
  const { r, stato } = await monta({ anomalieAnteprima: [{ tipo: 'senza_tariffa', tipologia: 'RETE', tonnellate: 3.5, descrizione: 'x' }] });
  elaboraMese(r).props.onClick();
  await aspetta(10);
  const d = dialogoAperto(r);
  verifica('una combinazione senza tariffa chiede conferma con la sua frase', !!d && /non hanno una tariffa applicabile/.test(testo(d)) && !/provincia/.test(testo(d)) && stato.elaborato === 0, d ? testo(d) : 'nessun dialogo');
  r.smonta();
}

console.log('\n=== «RIELABORA» DEL CANALE: L\'ACI CHIEDE CONFERMA, LA RETE NO ===');
{
  const doc = (k) => ({ id: 'doc-' + k, stato: 'elaborata', totale: 0, numero_voci: 1, voci_errore: k === 'ACI' ? 1 : 0 });
  const data = { RETE: { documento: doc('RETE'), righe: [] }, ACI: { documento: doc('ACI'), righe: [] }, EXTRA_RACCOLTA: {} };
  const { r, cli } = await monta({ anomalieAnteprima: anomalie, data });
  pulsante(r, 'ACI', 'rielabora').props.onClick();
  await aspetta(10);
  const d = dialogoAperto(r);
  const t = d ? testo(d) : '';
  verifica("Rielabora ACI apre la conferma del canale", !!d && /Rielaborare ACI di Ottobre 2026/.test(t), t);
  verifica('con la frase della provincia', /un ritiro senza provincia né regione/.test(t) && /correggi la provincia nel caricamento/.test(t), t);
  verifica("e non rielabora finche' non si conferma", cli.funzioniChiamate('elaboraFatturazioneAttiva').length === 0, cli.funzioniChiamate('elaboraFatturazioneAttiva').length);
  // il banner degli errori del documento non manda alle tariffe e basta
  // l'elemento piu' interno col testo: i suoi antenati vengono prima nell'elenco
  const banner = trova(r.albero, el => /Prestazioni con errori/.test(testo(el))).at(-1);
  const tb = banner ? testo(banner) : '';
  verifica("il riquadro degli errori dice ACI 1 e le due cause, la provincia compresa", /ACI 1/.test(tb) && /ritiro senza provincia/.test(tb) && !/\(tariffa mancante\)/.test(tb), tb);
  r.smonta();
  const altro = await monta({ anomalieAnteprima: anomalie, data });
  pulsante(altro.r, 'RETE', 'rielabora').props.onClick();
  await aspetta(10);
  const chiamate = altro.cli.funzioniChiamate('elaboraFatturazioneAttiva');
  verifica('Rielabora Rete parte subito, solo per la rete', !dialogoAperto(altro.r) && chiamate.length === 1 && JSON.stringify(chiamate[0].payload.tipologie) === '["RETE"]', { dialogo: !!dialogoAperto(altro.r), chiamate: chiamate.map(c => c.payload) });
  altro.r.smonta();
}

console.log('\n=== LA FRASE: SINGOLARE, PLURALE, UN ALTRO ERRORE ===');
{
  const f = p.modulo.fraseErrore;
  verifica('fraseErrore esportata', typeof f === 'function');
  if (typeof f === 'function') {
    const tre = f({ tipo: 'regione_mancante', gravita: 'errore', tipologia: 'ACI', quanti: 3, tonnellate: 6.5 });
    verifica('tre ritiri: plurale, tonnellate all\'italiana', /ACI: 3 ritiri senza provincia né regione \(6,50 t\)/.test(tre) && /saranno salvati a zero euro/.test(tre), tre);
    verifica('un altro errore usa la descrizione del calcolo', f({ tipo: 'altro', gravita: 'errore', descrizione: 'Descrizione del calcolo.' }) === 'Descrizione del calcolo.');
  }
  // il messaggio di «Verifica» non respinta: l'ACI dice anche la provincia
  const s = sorgente.replace(/\r/g, '');
  verifica('la verifica non riuscita dell\'ACI dice anche il ritiro senza provincia', /una tariffa che manca o un ritiro senza provincia/.test(s));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
