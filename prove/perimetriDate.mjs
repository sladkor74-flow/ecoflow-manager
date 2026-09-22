// Prova dei perimetri delle date da sistemare (regola dell'utente del
// 22/09/2026: immissione, inizio e fine trasporto sono obbligatorie in ogni
// formulario terminato). Lo stesso insieme di ordini non puo' essere contato in
// due modi e chiamato allo stesso modo:
//   - le pivot analitiche (base44/shared/pivotCalculator.ts) contano le date da
//     sistemare sul periodo filtrato, come dashboard, report mensile e matrice,
//     e non su tutto l'archivio del canale;
//   - l'export delle secondarie (base44/functions/exportSecondarie) dice il
//     TOTALE dei formulari da correggere e, a parte, la sua QUOTA senza fine
//     trasporto: i due campi non si sommano, e il perimetro e' lo stesso nel
//     dettaglio e nella sintesi.
// I canali non si sommano mai, nemmeno in questi conteggi. npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { computeAllPivots } from '../base44/shared/pivotCalculator.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));

console.log('PIVOT: LE DATE DA SISTEMARE DEL PERIODO GUARDATO');
const archivio = (righe) => ({
  list: async (_o, lim = 1e9, salta = 0) => righe.slice(salta, salta + lim),
  filter: async (_f, _o, lim = 1e9, salta = 0) => righe.slice(salta, salta + lim),
});
const cliente = (tabelle) => ({ asServiceRole: { entities: new Proxy({}, { get: (_t, nome) => archivio(tabelle[nome] || []) }) } });

const prim = (id, campi = {}) => ({
  id, id_ordine: id, numero_fir: 'F' + id, stato: 'terminato', peso_effettivo: 1000,
  trasportatore: 'EMMESSE SRL', destinazione: 'GATIM SRL', provincia: 'NA', classe: 'P',
  ordine_immesso_il: '2026-09-01T08:00:00Z', trasporto_iniziato_il: '2026-09-08T06:00:00Z',
  trasporto_finito_il: '2026-09-08T10:00:00Z', ...campi,
});
// ET2 del 2026 senza inizio, ET3 del 2025 senza inizio, ET4 senza fine trasporto.
const rete = [
  prim('ET1'),
  prim('ET2', { trasporto_iniziato_il: null }),
  prim('ET3', { trasporto_iniziato_il: null, ordine_immesso_il: '2025-06-01T08:00:00Z', trasporto_finito_il: '2025-06-10T10:00:00Z' }),
  prim('ET4', { trasporto_finito_il: null }),
];
const del2026 = await computeAllPivots(cliente({ PrimariaRete: rete }), { anno: [2026] }, ['A']);
verifica('guardando il 2026: il senza inizio del 2025 non c\'e\', il senza fine si', del2026.dateDaSistemare.rete.totale === 2 && del2026.dateDaSistemare.rete.senza_fine_trasporto === 1, JSON.stringify(del2026.dateDaSistemare.rete));
verifica('la pivot conta i due movimenti del periodo, il senza fine resta fuori e si dice', del2026.pivotA.tree.totals.count === 2 && del2026.senzaFineTrasporto.rete.quanti === 1, JSON.stringify(del2026.pivotA.tree.totals));
const senzaFiltri = await computeAllPivots(cliente({ PrimariaRete: rete }), {}, ['A']);
verifica('senza filtri di periodo ci sono tutti e tre', senzaFiltri.dateDaSistemare.rete.totale === 3, JSON.stringify(senzaFiltri.dateDaSistemare.rete));
verifica('gli altri canali restano a zero, non si sommano alla rete', del2026.dateDaSistemare.aci.totale === 0 && del2026.dateDaSistemare.secondarie_rete.totale === 0 && del2026.dateDaSistemare.secondarie_aci.totale === 0);

console.log('EXPORT SECONDARIE: IL TOTALE E LA SUA QUOTA SENZA FINE TRASPORTO');
// La funzione importa l'SDK e SheetJS da npm: qui si impacchetta con esbuild
// (quello di vite) e due moduli finti. Del file non interessa il contenuto, ma i
// conteggi che tornano nella risposta.
const SDK_FINTO = `
function entita(nome) {
  const righe = () => (globalThis.__ARCHIVI[nome] || []);
  return {
    filter: async (_f, _o, lim = 1e9, skip = 0) => righe().slice(skip, skip + lim),
    list: async (_o, lim = 1e9, skip = 0) => righe().slice(skip, skip + lim),
  };
}
const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;
const XLSX_FINTO = `
export const utils = {
  book_new: () => ({ fogli: [] }),
  json_to_sheet: (righe) => ({ righe }),
  book_append_sheet: (wb, ws, nome) => { wb.fogli.push({ nome, righe: ws.righe }); },
};
export function write() { return 'ZmludG8='; }`;
const moduliFinti = {
  name: 'moduli-finti',
  setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
    b.onResolve({ filter: /^npm:xlsx/ }, () => ({ path: 'xlsx', namespace: 'finto' }));
    b.onLoad({ filter: /.*/, namespace: 'finto' }, (a) => ({ contents: a.path === 'sdk' ? SDK_FINTO : XLSX_FINTO, loader: 'js' }));
  },
};
const impacchettata = await build({
  entryPoints: [qui('../base44/functions/exportSecondarie/entry.ts')],
  bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', plugins: [moduliFinti],
});
const funzione = await import('data:text/javascript;base64,' + Buffer.from(impacchettata.outputFiles[0].text).toString('base64'));
const esporta = async (body) => (await funzione.default({ json: async () => body })).json();

const sec = (id, campi = {}) => ({
  id, id_ordine: id, numero_fir: 'F' + id, stato: 'terminato', peso_effettivo: 2000,
  stoccaggio: 'NAPPI SUD SRL', destinazione: 'IRIGOM SRL', trasportatore: 'SMOCO SRL',
  classe: 'P', provincia: 'NA',
  ordine_immesso_il: '2026-09-01T08:00:00Z', trasporto_iniziato_il: '2026-09-08T06:00:00Z',
  trasporto_finito_il: '2026-09-08T10:00:00Z', ...campi,
});
globalThis.__ARCHIVI = {
  Secondaria: [
    sec('S1'),
    sec('S2', { trasporto_iniziato_il: null }),                                            // nel mese, senza inizio
    sec('S3', { trasporto_finito_il: null }),                                              // senza fine: in nessun mese
    sec('S4', { trasporto_iniziato_il: null, trasporto_finito_il: '2025-06-10T10:00:00Z' }), // un altro anno
    sec('S5', { classe: '9 - PFU Autodemolizione', trasporto_finito_il: null }),           // ACI, senza fine
  ],
};
const filtri = { mese: ['Settembre'], anno: [2026] };
const sintesi = await esporta({ filters: filtri, mode: 'matrix' });
const dettaglio = await esporta({ filters: filtri, mode: 'detail' });
const chiave = (x) => JSON.stringify(x.date_da_sistemare_per_canale) + '|' + JSON.stringify(x.di_cui_senza_fine_trasporto_per_canale);
verifica('la sintesi conta i trasporti del mese e, a parte, i formulari da correggere', JSON.stringify(sintesi.righe_per_canale) === '{"Rete":2}'
  && sintesi.date_da_sistemare_per_canale.Rete === 2 && sintesi.di_cui_senza_fine_trasporto_per_canale.Rete === 1, JSON.stringify(sintesi.righe_per_canale) + ' ' + chiave(sintesi));
verifica('la quota senza fine sta dentro il totale: sommarli conterebbe due volte lo stesso ordine', sintesi.date_da_sistemare_per_canale.Rete > sintesi.di_cui_senza_fine_trasporto_per_canale.Rete);
verifica('dettaglio e sintesi contano lo stesso insieme, anche con un mese scelto', chiave(dettaglio) === chiave(sintesi), chiave(dettaglio) + ' contro ' + chiave(sintesi));
verifica('l\'ACI si conta a parte, mai sommata alla rete', sintesi.date_da_sistemare_per_canale.ACI === 1 && sintesi.di_cui_senza_fine_trasporto_per_canale.ACI === 1 && sintesi.righe_per_canale.ACI === undefined, chiave(sintesi));
verifica('il vecchio nome, che sembrava un conteggio a se\', non c\'e\' piu\'', !('senza_fine_trasporto_per_canale' in sintesi) && !('senza_fine_trasporto_per_canale' in dettaglio));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
