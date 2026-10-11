// CONTROLLO DELLE ROTTE: LE TARIFFE SI LEGGONO TUTTE (chiusura dell'audit,
// 11/10/2026, revisione dei soldi).
//
// controlloRotte leggeva le tariffe con il filtro { stato: 'attivo' }
// dell'archivio, e perdeva quelle con lo stato vuoto, che per la fatturazione
// valgono come attive (tariffaNonDisattivata di validitaTariffa.ts). Un
// raccoglitore che scarica su due impianti, con la sua tariffa per ciascuno ma
// una delle due scritta senza stato, finiva fra le «tariffe da verificare» con la
// frase «non c'e' una tariffa propria»: falso. Le disattivate invece restano
// fuori. La prova chiama la funzione vera, con un archivio finto che applica i
// filtri come l'archivio vero. npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const SDK_FINTO = `
const passa = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
const entita = (nome) => ({
  list: async (_o, _l, skip) => (skip ? [] : (globalThis.__ARCHIVI[nome] || [])),
  filter: async (f, _o, _l, skip) => (skip ? [] : (globalThis.__ARCHIVI[nome] || []).filter(r => passa(r, f))),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'user', email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;
const pacchetto = await build({
  entryPoints: [fileURLToPath(new URL('../base44/functions/controlloRotte/entry.ts', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
  plugins: [{ name: 'sdk-finto', setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
  } }],
});
const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
const chiama = async (corpo) => {
  const r = await modulo.default({ json: async () => corpo });
  return { stato: r.status, j: await r.json() };
};

// Emmesse raccoglie e scarica a Gatim e a Irigom, con un prezzo per ciascuno.
const primaria = (id, dest) => ({
  id, stato: 'terminato', id_ordine: id, numero_fir: 'F' + id, trasportatore: 'EMMESSE SRLS', destinazione: dest, tipo_destinazione: 'imp',
  peso_effettivo: 10000, provincia: 'CS', ordine_immesso_il: '2026-09-01T00:00:00.000Z', trasporto_iniziato_il: '2026-09-10T00:00:00.000Z', trasporto_finito_il: '2026-09-10T10:00:00.000Z',
});
const tariffa = (id, destinazione, valore, stato) => ({
  id, direzione: 'PASSIVA', prestazione: 'RACCOLTA', tipologia: 'RETE', fornitore_nome: 'EMMESSE SRLS', destinazione, valore, unita_misura: '€/t',
  data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', ...(stato === undefined ? {} : { stato }),
});
const movimenti = { PrimariaRete: [primaria('A', 'GATIM S.R.L.'), primaria('B', 'Irigom S.r.l.')] };

console.log('UNA TARIFFA SCRITTA SENZA STATO CONTA');
{
  globalThis.__ARCHIVI = { ...movimenti, Tariffa: [tariffa('g', 'GATIM S.R.L.', 72, 'attivo'), tariffa('i', 'Irigom S.r.l.', 90, undefined)] };
  const r = await chiama({ anno: 2026 });
  verifica('la funzione risponde', r.stato === 200, JSON.stringify(r.j).slice(0, 200));
  verifica('Emmesse ha un prezzo per Gatim e uno per Irigom: niente da verificare (prima: «per Irigom non c\'e\' una tariffa propria»)',
    Array.isArray(r.j.tariffe_da_verificare) && r.j.tariffe_da_verificare.length === 0, JSON.stringify(r.j.tariffe_da_verificare));
}

console.log('UNA TARIFFA DISATTIVATA NO');
{
  globalThis.__ARCHIVI = { ...movimenti, Tariffa: [tariffa('g', 'GATIM S.R.L.', 72, 'attivo'), tariffa('i', 'Irigom S.r.l.', 90, 'non_attivo'), tariffa('gen', '', 80, 'attivo')] };
  const r = await chiama({ anno: 2026 });
  const emmesse = (r.j.tariffe_da_verificare || []).find(x => /EMMESSE/.test(x.origine));
  verifica('con quella di Irigom disattivata, Irigom e\' scoperta e si paga la generica', !!emmesse && emmesse.destinazioni_senza_tariffa_propria.length === 1 && /Irigom/.test(emmesse.destinazioni_senza_tariffa_propria[0]) && emmesse.tariffa_generica === 80,
    JSON.stringify(r.j.tariffe_da_verificare));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
