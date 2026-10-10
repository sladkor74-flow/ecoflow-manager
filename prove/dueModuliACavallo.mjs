// Prova di GIACENZE E DICHIARAZIONI: I CASI CHE LA REVISIONE DEL 10/10/2026 HA TROVATO.
//
// La regola dell'utente (03/10/2026) e' che i due moduli dicano gli stessi numeri
// su tutti e tre i canali. prove/dueModuliStessiNumeri.mjs la controlla sull'anno
// in corso; qui ci sono i tre modi in cui si rompeva ancora:
//   1. A CAVALLO D'ANNO: i carichi che il file del portale non ha ancora le
//      Giacenze li prendevano dall'anno della fotografia, le Dichiarazioni
//      dall'anno guardato. Fotografia del 02/01/2027, un carico del 29/12 e uno
//      del 05/01 arrivati dopo: 11 t in un modulo, 11,5 nell'altro, 14,5 il vero.
//   2. IL FILTRO SMOCO: le Giacenze sommavano al dichiarato le righe di un altro
//      partner (Baucina) che hanno un nostro impianto come secondaria.
//   3. TECNOGUM NEL NUMERO IN TESTA: la giacenza calcolata degli impianti, in
//      testa alla pagina Dichiarazioni, comprendeva la rete che Tecnogum per
//      accordo non dichiara.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const ARCHIVI = {};
globalThis.__ARCHIVI_CAVALLO = ARCHIVI;
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
const ordina = (righe) => [...righe].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const entita = (nome) => ({
  list: async (_o, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI_CAVALLO[nome] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI_CAVALLO[nome] || []).filter(r => soddisfa(r, f))).slice(skip, skip + lim),
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
const giacenze = await funzione('calcolaGiacenze');
const riepilogo = await funzione('riepilogoDichiarazioni');

let seq = 0;
const con = (nome, righe) => { ARCHIVI[nome] = righe.map(r => ({ id: 'r' + String(++seq).padStart(4, '0'), ...r })); };
const g = (giorno) => `${giorno}T08:00:00Z`;
const primaria = (id, dest, kg, giorno, extra = {}) => ({
  id_ordine: id, numero_fir: 'FIR' + id, classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: dest,
  tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: kg, trasporto_finito_il: g(giorno), ordine_chiuso_il: g(giorno), ...extra,
});
const vuoti = () => {
  for (const v of ['DichiarazioneTrattamento', 'Terziaria', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile',
    'GiacenzaStoccaggio', 'IndicatoreGiorno', 'PrimariaAci', 'ExtraRaccolta', 'Secondaria', 'OrdineNonDichiarato',
    'DichiarazioneSito', 'GiacenzaSito', 'PrimariaRete']) con(v, []);
};
const ALFA = 'ALFA RECYCLING SRL';

console.log("1. A CAVALLO D'ANNO, I CARICHI CHE IL FILE NON HA ANCORA");
for (const [foto, nome] of [['2027-01-02', 'fotografia del 2 gennaio'], ['2026-12-28', 'fotografia del 28 dicembre']]) {
  vuoti();
  con('GiacenzaSito', [
    { sito: ALFA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true },
    { sito: ALFA, tipo_destinazione: 'imp', anno: 2027, dichiara_rete: true },
  ]);
  con('PrimariaRete', [
    primaria('ET26000002', ALFA, 8000, '2026-12-20'),
    primaria('ET26000099', ALFA, 3500, '2026-12-29'),   // arrivato dopo la fotografia del 28/12, registrato tardi per quella del 02/01
    primaria('ET27000001', ALFA, 3000, '2027-01-05'),   // arrivato dopo tutte e due
  ]);
  con('OrdineNonDichiarato', [
    { ordine_primaria: 'ET26000002', destinazione: ALFA, prodotto: '.class1', peso_non_dichiarato_kg: 8000, created_date: `${foto}T06:00:00Z`, fine_trasporto: '2026-12-20' },
  ]);
  for (const anno of [2026, 2027]) {
    const G = await giacenze({ anno });
    const D = await riepilogo({ anno });
    const rG = (G.righe || []).find(r => r.sito === ALFA && r.tipo_destinazione === 'imp');
    const sD = (D.siti || []).find(s => s.sito === ALFA);
    const pG = rG && rG.giacenza_portale_t, pD = sD && sD.giacenza_portale_t;
    verifica(`${nome}, guardando il ${anno}: 8 + 3,5 + 3 = 14,5 t in tutti e due i moduli`, pG === 14.5 && pD === 14.5, `Giacenze ${pG}, Dichiarazioni ${pD}`);
  }
}

console.log('2. IL DICHIARATO E\' SOLO QUELLO CON SMOCO PARTNER OPERATIVO');
{
  vuoti();
  con('GiacenzaSito', [{ sito: ALFA, tipo_destinazione: 'imp', anno: 2025, dichiara_rete: true }]);
  con('PrimariaRete', [primaria('ET25000001', ALFA, 5000, '2025-03-10')]);
  con('DichiarazioneTrattamento', [
    { ordine_primaria: 'ET25000001', prodotto: '.class1', partner_operativo: 'SMOCO S.r.l.', destinazione: ALFA, data_dichiarazione: '2025-04-10', fine_trasporto: '2025-03-10', peso_associato_kg: 5000, id_dichiarazione: 'D1' },
    // Una riga di Baucina: un altro partner, con un nostro impianto come secondaria.
    { ordine_primaria: 'BX25000777', prodotto: '.class1', partner_operativo: 'Baucina Recycling Tyres', destinazione: 'BAUCINA RECYCLING TYRES', destinazione_secondaria: ALFA, data_dichiarazione: '2025-05-10', fine_trasporto: '2025-04-20', peso_associato_kg: 4100, id_dichiarazione: 'D2' },
  ]);
  const G = await giacenze({ anno: 2025 });
  const D = await riepilogo({ anno: 2025 });
  const rG = (G.righe || []).find(r => r.sito === ALFA && r.tipo_destinazione === 'imp');
  const sD = (D.siti || []).find(s => s.sito === ALFA);
  verifica('Giacenze: il dichiarato di ALFA e\' 5 t, non 9,1 con quello di Baucina', rG && rG.dichiarato_t === 5, rG && String(rG.dichiarato_t));
  verifica('lo stesso numero del modulo Dichiarazioni', rG && sD && rG.dichiarato_t === sD.dichiarato_portale_t, `${rG && rG.dichiarato_t} / ${sD && sD.dichiarato_portale_t}`);
  verifica('e l\'impianto di Baucina non diventa una riga delle Giacenze', !(G.righe || []).some(r => /baucina/i.test(r.sito)), (G.righe || []).map(r => r.sito).join(' | '));
}

console.log('3. TECNOGUM NON ENTRA NEL NUMERO IN TESTA ALLA PAGINA');
{
  vuoti();
  const TEC = 'TECNOGUM SRL';
  con('GiacenzaSito', [
    { sito: ALFA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true },
    { sito: TEC, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: false },
  ]);
  con('PrimariaRete', [primaria('ET26000001', ALFA, 8000, '2026-03-10'), primaria('ET26000002', TEC, 7000, '2026-03-11')]);
  const D = await riepilogo({ anno: 2026 });
  const tec = (D.siti || []).find(s => s.sito === TEC);
  verifica("in testa alla pagina la giacenza calcolata e' di ALFA soltanto: 8 t, non 15", D.totali && D.totali.giacenza_calcolata_t === 8, D.totali && String(D.totali.giacenza_calcolata_t));
  verifica('Tecnogum resta nell\'elenco, con la sua rete non dovuta', tec && tec.dichiara_rete === false, JSON.stringify(tec && { dichiara_rete: tec.dichiara_rete }));
}

console.log('4. LE PAGINE');
{
  const ex = readFileSync(qui('../src/lib/dichiarazioniExport.js'), 'utf8');
  verifica("il foglio Dettaglio non scrive «resta» per la rete non dovuta", ex.includes('f.non_dovuta ? null : (m.resta_kg || null)'));
  const sc = readFileSync(qui('../src/components/dichiarazioni/SezioneImpianto.jsx'), 'utf8');
  verifica('la scheda dell\'impianto scrive «—» per la giacenza di rete di chi non la dichiara', /Giacenza di rete che ne risulta: <strong>\{sito\.dichiara_rete === false/.test(sc));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
