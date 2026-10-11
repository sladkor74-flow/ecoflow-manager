// LA NOTA DEL DOCUMENTO SUPERATO, ALL'ITALIANA (revisione della chiusura,
// 11/10/2026).
//
// Rielaborando un canale dell'attiva gia' approvato o esportato, il documento
// vecchio resta nello Storico come superato, con una nota che dice quando e con
// che totali. La nota diceva «Rielaborato il 2026-10-11 ... con totale
// 372976.50 €, il nuovo calcolo dà 0.00 €»: la data all'americana e gli euro
// col punto decimale, nella stessa pagina che la chiusura dell'audit dava per
// sistemata. Qui la funzione vera, impacchettata con un SDK finto che conserva
// quello che si scrive sul documento. npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in)) ? v.$in.includes(r[k]) : r[k] === v);
const entita = (nome) => ({
  list: async () => [...(globalThis.__ARCHIVI[nome] || [])],
  filter: async (f) => (globalThis.__ARCHIVI[nome] || []).filter(r => soddisfa(r, f)),
  create: async (r) => ({ id: 'nuovo-' + nome, ...r }),
  update: async (id, r) => { globalThis.__AGGIORNATI.push({ nome, id, ...r }); return { id, ...r }; },
  bulkCreate: async (x) => x, delete: async () => ({}), deleteMany: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova@prova', full_name: 'Prova' }) }, asServiceRole: { entities }, entities };
}`;
const pacchetto = await build({
  entryPoints: [qui('../base44/functions/elaboraFatturazioneAttiva/entry.ts')],
  bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
  plugins: [{ name: 'sdk-finto', setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
  } }],
});
const elabora = (await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'))).default;

const rielabora = async (documento) => {
  globalThis.__AGGIORNATI = [];
  globalThis.__ARCHIVI = { DocumentoFatturazione: [documento], UploadLog: [] };
  const r = await elabora({ json: async () => ({ anno: 2026, mese: 'Settembre', tipologie: ['RETE'] }) });
  const j = await r.json();
  const superato = globalThis.__AGGIORNATI.find(a => a.id === documento.id && a.superato);
  return { stato: r.status, j, nota: superato ? superato.motivo_superato : null };
};

console.log('IL DOCUMENTO APPROVATO CHE SI RIELABORA');
{
  const x = await rielabora({ id: 'd1', tipo: 'ATTIVA', tipologia: 'RETE', anno: 2026, mese: 'Settembre', stato: 'approvata', totale: 372976.5 });
  verifica('il documento vecchio resta nello storico come superato, con la nota', x.stato === 200 && typeof x.nota === 'string', `${x.stato} ${JSON.stringify(x.j).slice(0, 200)}`);
  verifica('gli euro all\'italiana: punto per le migliaia, virgola, due decimali', /con totale 372\.976,50 €, il nuovo calcolo dà 0,00 €\./.test(x.nota || ''), x.nota);
  verifica('la data gg/mm/aaaa', /^Rielaborato il \d{2}\/\d{2}\/\d{4} da Prova: il documento era approvata/.test(x.nota || ''), x.nota);
  verifica('niente piu\' «372976.50» ne\' date aaaa-mm-gg', !/372976\.50/.test(x.nota || '') && !/\d{4}-\d{2}-\d{2}/.test(x.nota || ''), x.nota);
}

console.log('UN TOTALE CHE MANCA NON E\' ZERO');
{
  const x = await rielabora({ id: 'd2', tipo: 'ATTIVA', tipologia: 'RETE', anno: 2026, mese: 'Settembre', stato: 'esportata' });
  verifica('senza totale si scrive «—», non «0,00 €»', /con totale — €/.test(x.nota || '') && !/con totale 0,00/.test(x.nota || ''), x.nota);
  const piccolo = await rielabora({ id: 'd3', tipo: 'ATTIVA', tipologia: 'RETE', anno: 2026, mese: 'Settembre', stato: 'approvata', totale: 999.999 });
  verifica('999,999 si arrotonda al centesimo: 1.000,00', /con totale 1\.000,00 €/.test(piccolo.nota || ''), piccolo.nota);
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
