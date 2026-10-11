// Prova del PIAZZALE DI UN ANNO CHIUSO SENZA UNA LETTURA CHE LO APRA (revisione
// finale della chiusura dell'audit, 11/10/2026).
//
// Per un anno chiuso la giacenza di un piazzale si confronta con la lettura del
// 31/12 salvata dalla chiusura, e la giacenza di inizio anno parte dall'ancora di
// quell'anno. Ma se il piazzale non ha letture dell'anno prima del 31/12, l'«ancora»
// era proprio la lettura del 31/12: l'inizio si ricavava all'indietro dalla lettura
// con cui poi si confronta, e la quadratura diceva «quadra» per costruzione. E' il
// 2025 com'e' nei dati (la fotografia del 31/12/2024 non c'e'), e il 2026 di un
// piazzale che nel 2026 non ha letture. Ora la lettura del 31/12 non apre l'anno:
// senza un'altra lettura il confronto non si fa, l'apertura non si conosce in
// tutti e due i moduli, e la pagina dice perche'. Funzioni vere, SDK finto, orologio
// fermo. npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const ARCHIVI = {};
globalThis.__ARCHIVI_PAC = ARCHIVI;
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('$in' in v) return v.$in.includes(r[k]);
    if ('$gte' in v && !(r[k] != null && String(r[k]) >= String(v.$gte))) return false;
    if ('$lte' in v && !(r[k] != null && String(r[k]) <= String(v.$lte))) return false;
    return true;
  }
  if (v === null) return r[k] === null || r[k] === undefined || r[k] === '';
  return r[k] === v;
});
const ordina = (righe) => [...righe].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const entita = (nome) => ({
  list: async (_o, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI_PAC[nome] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI_PAC[nome] || []).filter(r => soddisfa(r, f))).slice(skip, skip + lim),
  create: async (r) => r, update: async (_id, r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;
const funzione = async (nome) => {
  const pacchetto = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    } }],
  });
  const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  return async (corpo) => (await modulo.default({ json: async () => corpo })).json();
};
const OraVera = Date;
const conOra = async (iso, f) => {
  const ms = OraVera.parse(iso);
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try { return await f(); } finally { globalThis.Date = OraVera; }
};
const VUOTI = ['DichiarazioneTrattamento', 'Terziaria', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile',
  'GiacenzaStoccaggio', 'IndicatoreGiorno', 'PrimariaAci', 'ExtraRaccolta', 'Secondaria', 'OrdineNonDichiarato',
  'DichiarazioneSito', 'GiacenzaSito', 'PrimariaRete', 'CommessaEcotyre', 'UploadLog'];
let seq = 0;
const azzera = () => { for (const k of Object.keys(ARCHIVI)) delete ARCHIVI[k]; for (const v of VUOTI) ARCHIVI[v] = []; };
const con = (nome, righe) => { ARCHIVI[nome] = righe.map(r => ({ id: 'r' + String(++seq).padStart(5, '0'), ...r })); };
const g = (giorno) => `${giorno}T08:00:00Z`;
const primaria = (id, dest, kg, giorno, extra = {}) => ({
  id_ordine: id, numero_fir: 'FIR' + id, classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: dest,
  tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: kg, trasportatore: 'RACCOLTA SRL', provincia: 'NA',
  ordine_immesso_il: g(giorno), trasporto_iniziato_il: g(giorno), trasporto_finito_il: g(giorno), ordine_chiuso_il: g(giorno), ...extra,
});
const lettura = (sito, giorno, kg, creata) => ({ sito, data_rilevazione: giorno, class1_kg: kg, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 0, created_date: creata });
const riepilogo = await funzione('riepilogoDichiarazioni');
const giacenze = await funzione('calcolaGiacenze');
// Le righe di un piazzale in tutti gli elenchi del riepilogo che portano una quadratura.
const quadrature = (d, sito) => Object.values(d).filter(Array.isArray).flatMap(v => v.filter(x => x && x.sito === sito && 'giacenza_portale_t' in x));
const rigaG = (r, sito) => (r.righe || []).find(x => x.sito === sito && x.tipo_destinazione === 'stoc') || null;

console.log("IL 2025 COM'E' NEI DATI: SOLO LA FOTOGRAFIA DEL 31/12/2025");
{
  const NAPPI = 'NAPPI SUD SRL', ALFA = 'ALFA SRL';
  azzera();
  con('GiacenzaSito', [
    { sito: NAPPI, tipo_destinazione: 'stoc', anno: 2025 }, { sito: ALFA, tipo_destinazione: 'imp', anno: 2025, dichiara_rete: true },
    { sito: NAPPI, tipo_destinazione: 'stoc', anno: 2026 }, { sito: ALFA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true },
  ]);
  con('PrimariaRete', [
    primaria('ET25000030', NAPPI, 10000, '2025-06-10', { tipo_destinazione: 'stoc' }),
    primaria('ET25000031', NAPPI, 15000, '2025-11-20', { tipo_destinazione: 'stoc' }),
    primaria('ET26000032', NAPPI, 5000, '2026-03-20', { tipo_destinazione: 'stoc' }),
  ]);
  con('Secondaria', [{ ...primaria('SEC25000001', ALFA, 10000, '2025-07-10'), stoccaggio: NAPPI }]);
  con('GiacenzaStoccaggio', [lettura(NAPPI, '2025-12-31', 60000, '2026-01-07T09:00:00Z'), lettura(NAPPI, '2026-09-16', 65000, '2026-09-16T09:00:00Z')]);
  const d = await conOra('2026-10-11T10:00:00Z', () => riepilogo({ anno: 2025 }));
  const G = await conOra('2026-10-11T10:00:00Z', () => giacenze({ anno: 2025 }));
  const q = quadrature(d, NAPPI).find(x => x.canale === 'RETE');
  verifica('il 2025 non si confronta con la lettura che lo chiude: non quadra per costruzione', q && q.quadra !== true && q.giacenza_portale_t === null, JSON.stringify(q && { calc: q.giacenza_calcolata_t, portale: q.giacenza_portale_t, quadra: q.quadra }));
  verifica('e dice perche\', senza dire che la chiusura non ha salvato la lettura', q && q.quadratura_anno_chiuso && /serve la giacenza di inizio anno/.test(q.quadratura_anno_chiuso.perche) && !/non ha salvato/.test(q.quadratura_anno_chiuso.perche), JSON.stringify(q && q.quadratura_anno_chiuso));
  verifica('nessun piazzale «che quadra» inventato', d.totali && !d.totali.siti_che_quadrano, JSON.stringify(d.totali && d.totali.siti_che_quadrano));
  const c = ((d.stoccaggi || []).find(x => x.sito === NAPPI) || { canali: [] }).canali.find(x => x.canale === 'RETE');
  verifica('la scheda Stoccaggi: «In piazzale» non si conosce, col perche\' dell\'anno chiuso', c && c.in_piazzale_t === null && /non ha una lettura che lo apra/.test(c.in_piazzale_perche || ''), JSON.stringify(c && { in: c.in_piazzale_t, perche: c.in_piazzale_perche }));
  const rg = rigaG(G, NAPPI);
  verifica('le Giacenze non ricavano l\'apertura dalla lettura del 31/12/2025', rg && rg.giacenza_riferimento_t !== 45, JSON.stringify(rg && rg.giacenza_riferimento_t));
}

console.log("IL 2026 DI UN PIAZZALE SENZA LETTURE NELL'ANNO, DOPO LA CHIUSURA");
{
  const BETA = 'BETA STOC SRL', ALFA = 'ALFA SRL';
  azzera();
  con('GiacenzaSito', [{ sito: BETA, tipo_destinazione: 'stoc', anno: 2026 }, { sito: ALFA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true }, { sito: BETA, tipo_destinazione: 'stoc', anno: 2027 }]);
  con('PrimariaRete', [
    primaria('ET26000030', BETA, 10000, '2026-06-10', { tipo_destinazione: 'stoc' }),
    primaria('ET26000031', BETA, 15000, '2026-11-20', { tipo_destinazione: 'stoc' }),
  ]);
  con('Secondaria', [{ ...primaria('SEC26000001', ALFA, 10000, '2026-07-10'), stoccaggio: BETA }]);
  con('GiacenzaStoccaggio', [lettura(BETA, '2026-12-31', 60000, '2027-01-02T09:00:00Z')]);
  const d = await conOra('2027-01-05T10:00:00Z', () => riepilogo({ anno: 2026 }));
  const G = await conOra('2027-01-05T10:00:00Z', () => giacenze({ anno: 2026 }));
  const q = quadrature(d, BETA).find(x => x.canale === 'RETE');
  verifica('la lettura del 31/12/2026 non apre il 2026: niente «quadra»', q && q.quadra !== true && q.giacenza_portale_t === null, JSON.stringify(q && { calc: q.giacenza_calcolata_t, portale: q.giacenza_portale_t, quadra: q.quadra }));
  const rg = rigaG(G, BETA);
  const c = ((d.stoccaggi || []).find(x => x.sito === BETA) || { canali: [] }).canali.find(x => x.canale === 'RETE');
  verifica('Giacenze e Dichiarazioni dicono la stessa apertura', rg && c && (rg.giacenza_riferimento_t ?? 0) === (c.giacenza_iniziale_t ?? 0), JSON.stringify({ giacenze: rg && rg.giacenza_riferimento_t, dichiarazioni: c && c.giacenza_iniziale_t }));
  verifica('e non la ricavano all\'indietro dalla lettura del 31/12 (sarebbe 45)', c && c.giacenza_iniziale_t !== 45, JSON.stringify(c && c.giacenza_iniziale_t));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
