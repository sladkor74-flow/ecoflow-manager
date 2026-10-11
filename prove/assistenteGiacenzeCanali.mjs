// Prova dell'ACI E DELL'EXTRA RACCOLTA NEL RIEPILOGO DI ECOTYNA (chiusura
// dell'audit, 11/10/2026).
//
// Il riepilogo della commessa (base44/shared/assistente.ts) scriveva «ACI negli
// stoccaggi» col totale di calcolaGiacenze, che dal 03/10 comprende anche gli
// impianti; lo strumento giacenze sommava invece i soli stoccaggi. Un impianto
// con 7 t ACI non dichiarate e un piazzale con 3 t di classe 9: il riepilogo
// diceva «ACI negli stoccaggi 10 t», lo strumento 3. E l'intestazione chiamava
// «non pertinenti» l'ACI e l'extra raccolta degli impianti, mentre la riga ne
// stampava il valore. Ora tutti e due dicono impianti e stoccaggi, sulle righe.
//
// I numeri vengono dalla funzione vera (calcolaGiacenze, con un SDK finto) e
// passano dalle due strade di EcoTyna: il riepilogo e lo strumento.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const ARCHIVI = {};
globalThis.__ARCHIVI_ECOTYNA_CANALI = ARCHIVI;
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => v === null ? (r[k] === null || r[k] === undefined) : r[k] === v);
const ordina = (righe) => [...righe].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const entita = (nome) => ({
  list: async (_o, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI_ECOTYNA_CANALI[nome] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI_ECOTYNA_CANALI[nome] || []).filter(r => soddisfa(r, f))).slice(skip, skip + lim),
  create: async (r) => r, update: async (_id, r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export const servizio = { entities };
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;
const pacchetto = await build({
  entryPoints: [qui('../base44/functions/calcolaGiacenze/entry.ts')],
  bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
  plugins: [{ name: 'sdk-finto', setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
  } }],
});
const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
const calcolaGiacenze = async (corpo) => (await modulo.default({ json: async () => corpo })).json();

// Il client che EcoTyna riceve: legge gli stessi archivi e chiama la funzione vera.
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v === null ? (r[k] === null || r[k] === undefined) : r[k] === v));
const ordina = (righe) => [...righe].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const entities = new Proxy({}, { get: (_t, nome) => ({
  list: async (_o, lim = 1e9, skip = 0) => ordina(ARCHIVI[nome] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => ordina((ARCHIVI[nome] || []).filter(r => soddisfa(r, f))).slice(skip, skip + lim),
}) });
const chiamate = [];
const base44 = {
  asServiceRole: { entities },
  functions: { invoke: async (nome, corpo) => { chiamate.push(nome); if (nome !== 'calcolaGiacenze') throw new Error('funzione inattesa ' + nome); return { data: await calcolaGiacenze(corpo) }; } },
};

let seq = 0;
const con = (nome, righe) => { ARCHIVI[nome] = righe.map(r => ({ id: 'r' + String(++seq).padStart(4, '0'), ...r })); };
const g = (giorno) => `${giorno}T08:00:00Z`;
for (const v of ['DichiarazioneTrattamento', 'Terziaria', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile',
  'GiacenzaStoccaggio', 'IndicatoreGiorno', 'PrimariaAci', 'ExtraRaccolta', 'Secondaria', 'OrdineNonDichiarato',
  'DichiarazioneSito', 'GiacenzaSito', 'PrimariaRete', 'CommessaEcotyre', 'ControlloEvasione', 'Alert', 'RiepilogoQualifica']) con(v, []);

// Lo scenario della verifica (dich-verifica S3): ALFA impianto con 7 t ACI
// arrivate e non dichiarate, 2,5 t di extra raccolta arrivate; NAPPI SUD piazzale
// con 3 t di classe 9 e 1,2 t di extra raccolta in piazzale.
const ALFA = 'ALFA RECYCLING SRL';
const NAPPI = 'NAPPI SUD SRL';
con('GiacenzaSito', [{ sito: ALFA, tipo_destinazione: 'imp', anno: 2026 }, { sito: NAPPI, tipo_destinazione: 'stoc', anno: 2026 }]);
con('PrimariaAci', [{ id_ordine: 'ET26000010', numero_fir: 'FIRA10', destinazione: ALFA, tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: 7000,
  classe: 'PFU Autodemolizione', prodotto: '.class9', trasportatore: 'RACC SRL', provincia: 'NA',
  ordine_immesso_il: g('2026-04-01'), trasporto_iniziato_il: g('2026-04-05'), trasporto_finito_il: g('2026-04-05') }]);
con('ExtraRaccolta', [
  { id_ordine: 'EX1', numero_fir: 'FIRX1', destinazione: ALFA, tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: 2500, tipo_movimento: 'primaria',
    produttore: 'OFFICINA X', ordine_immesso_il: g('2026-05-01'), trasporto_iniziato_il: g('2026-05-02'), trasporto_finito_il: g('2026-05-02') },
  { id_ordine: 'EX2', numero_fir: 'FIRX2', destinazione: NAPPI, tipo_destinazione: 'stoc', stato: 'terminato', peso_effettivo: 1200, tipo_movimento: 'primaria',
    produttore: 'OFFICINA Y', ordine_immesso_il: g('2026-05-01'), trasporto_iniziato_il: g('2026-05-03'), trasporto_finito_il: g('2026-05-03') },
]);
con('GiacenzaStoccaggio', [{ sito: NAPPI, data_rilevazione: '2025-12-31', class1_kg: 40000, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 3000, created_date: '2026-01-02T08:00:00Z' }]);
con('OrdineNonDichiarato', [{ ordine_primaria: 'XX', destinazione: 'ALTRO SRL', prodotto: '.class1', peso_non_dichiarato_kg: 0, created_date: '2026-10-01T06:00:00Z', fine_trasporto: '2026-09-20' }]);

const G = await calcolaGiacenze({ anno: 2026 });
const riga = (sito) => (G.righe || []).find(r => r.sito === sito) || {};
console.log('IL MODULO GIACENZE, PER RIFERIMENTO');
verifica('ALFA ha 7 t ACI e 2,5 t di extra raccolta', riga(ALFA).giacenza_aci_t === 7 && riga(ALFA).giacenza_extra_t === 2.5, JSON.stringify([riga(ALFA).giacenza_aci_t, riga(ALFA).giacenza_extra_t]));
verifica('NAPPI SUD ha 3 t ACI in piazzale', riga(NAPPI).giacenza_aci_t === 3, String(riga(NAPPI).giacenza_aci_t));
verifica('e il totale del modulo li somma: 10 t (non e\' «negli stoccaggi»)', G.totali && G.totali.giacenza_aci_t === 10, String(G.totali && G.totali.giacenza_aci_t));

const { situazioneGestionale } = await import('../base44/shared/assistente.ts');
const { STRUMENTI } = await import('../base44/shared/strumentiAssistente.ts');

console.log('IL RIEPILOGO DELLA COMMESSA');
const testo = await situazioneGestionale(base44, '2026-10-11');
const rigaTotali = testo.split('\n').find(r => r.startsWith('Giacenze per canale')) || '';
verifica('ACI divisa fra impianti e stoccaggi', /ACI: impianti 7,00 t, stoccaggi 3,00 t/.test(rigaTotali), rigaTotali);
verifica('extra raccolta divisa fra impianti e stoccaggi', /EXTRA RACCOLTA: impianti 2,50 t[^;]*, stoccaggi 1,20 t/.test(rigaTotali), rigaTotali);
verifica('niente piu\' «ACI negli stoccaggi» col totale di tutti', !/ACI negli stoccaggi/.test(testo));
const intestazione = testo.split('\n').find(r => r.startsWith('Impianti e stoccaggi, un canale per colonna')) || '';
verifica("l'intestazione non chiama piu' «non pertinenti» l'ACI e l'extra degli impianti", intestazione && !/l'ACI e l'extra raccolta di un impianto/.test(intestazione), intestazione.slice(-400));
verifica('e dice che negli impianti sono apertura + arrivato - dichiarato', /In un impianto la giacenza ACI e quella di extra raccolta sono apertura \+ arrivato - dichiarato/.test(intestazione));

console.log('LO STRUMENTO GIACENZE DICE GLI STESSI NUMERI');
const giac = STRUMENTI.find(s => s.nome === 'giacenze');
const tot = (await giac.esegui(base44, { anno: 2026 })).dati.totali;
verifica('ACI: impianti 7, stoccaggi 3', tot.aci && tot.aci.giacenza_impianti_t === 7 && tot.aci.giacenza_stoccaggi_t === 3, JSON.stringify(tot.aci));
verifica('extra raccolta: impianti 2,5, in piazzale 1,2', tot.extra_raccolta && tot.extra_raccolta.impianti_t === 2.5 && tot.extra_raccolta.in_piazzale_t === 1.2, JSON.stringify(tot.extra_raccolta));
const soloAlfa = (await giac.esegui(base44, { anno: 2026, sito: 'Alfa Recycling' })).dati;
verifica("chiedendo l'impianto, la sua ACI e' quella degli impianti", soloAlfa.totali.aci.giacenza_impianti_t === 7 && soloAlfa.totali.aci.giacenza_stoccaggi_t === 0, JSON.stringify(soloAlfa.totali.aci));
verifica("e la riga dell'impianto porta la sua extra raccolta", soloAlfa.siti.righe[0].giacenza_extra_raccolta_t === 2.5, JSON.stringify(soloAlfa.siti.righe[0]));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
