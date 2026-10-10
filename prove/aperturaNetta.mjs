// Prova dell'APERTURA AL NETTO DI QUELLO CHE SI DICHIARA DOPO, 10/10/2026.
//
// Trovato dalla revisione delle correzioni del 10/10/2026, ed era il difetto
// piu' serio: la chiusura scrive come apertura dell'anno dopo la lettura del
// 31/12, cioe' il peso non ancora dichiarato quel giorno. Ma dicembre (e spesso
// novembre) si dichiara a gennaio, con DichiarazioneSito dell'anno chiuso, e
// l'anno nuovo sottrae solo le dichiarazioni dei suoi mesi. Senza correzione,
// nel 2027 la giacenza di rete restava 8 t mentre il portale diceva 0 - per
// tutto l'anno, su ogni impianto - e l'ACI restava gonfiata in tutti e due i
// moduli senza che nessuno lo vedesse.
//
// Qui girano le due funzioni vere (riepilogoDichiarazioni e calcolaGiacenze)
// sugli stessi archivi, e si guarda che dicano lo stesso numero, quello giusto.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { apertureDegliImpianti } from '../base44/shared/chiusuraAnno.ts';
import { aperturaNetta } from '../base44/shared/giacenzaPortale.ts';
import { quadratura } from '../base44/shared/dichiarazioniImpianti.ts';
import { normalizzaRagioneSociale as n } from '../base44/shared/normalizzaRagioneSociale.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('LA REGOLA, DA SOLA');
{
  const dich = [
    { sito: 'Gamma Tyres S.r.l.', anno: 2026, mese: 'Dicembre', canale: 'RETE', quantita_kg: 8000, caricata_inviata: true, caricata_il: '2027-01-15' },
    { sito: 'GAMMA TYRES SRL', anno: 2026, mese: 'Novembre', canale: 'RETE', quantita_kg: 10000, caricata_inviata: true, caricata_il: '2026-12-10' }, // prima della lettura: gia' fuori
    { sito: 'GAMMA TYRES SRL', anno: 2027, mese: 'Gennaio', canale: 'RETE', quantita_kg: 500, caricata_inviata: true, caricata_il: '2027-02-10' },   // del 2027: la sottrae il 2027
    { sito: 'GAMMA TYRES SRL', anno: 2026, mese: 'Dicembre', canale: 'ACI', quantita_kg: 3000, caricata_inviata: true, caricata_il: '2027-01-20' },
    { sito: 'GAMMA TYRES SRL', anno: 2026, mese: 'Dicembre', canale: 'RETE', quantita_kg: 999, caricata_inviata: false },                          // non caricata: non conta
    { sito: 'ALTRO SRL', anno: 2026, mese: 'Dicembre', canale: 'RETE', quantita_kg: 4000, caricata_inviata: true, caricata_il: '2027-01-15' },     // un altro impianto
  ];
  const riga = { sito: 'GAMMA TYRES SRL', anno: 2027, giacenza_riferimento_t: 8, giacenza_riferimento_aci_t: 3, apertura_del: '2026-12-31' };
  const r = aperturaNetta(riga, 'RETE', dich, n), a = aperturaNetta(riga, 'ACI', dich, n);
  verifica('rete: 8 t lette, 8 t di dicembre dichiarate dopo, 0 t di apertura', r.lorda_t === 8 && r.dichiarato_dopo_t === 8 && r.netta_t === 0, JSON.stringify(r));
  verifica("l'ACI per conto suo: 3 - 3 = 0, rete e ACI non si mescolano", a.netta_t === 0 && a.dichiarato_dopo_t === 3, JSON.stringify(a));
  const aMano = aperturaNetta({ ...riga, apertura_del: undefined }, 'RETE', dich, n);
  verifica("un'apertura scritta a mano non e' una lettura: resta quella", aMano.netta_t === 8 && aMano.dichiarato_dopo_t === 0, JSON.stringify(aMano));
  const senzaData = aperturaNetta(riga, 'RETE', [{ sito: 'GAMMA TYRES SRL', anno: 2026, canale: 'RETE', quantita_kg: 100, caricata_inviata: true }], n);
  verifica('una caricata senza giorno non si sottrae, e si conta a parte', senzaData.netta_t === 8 && senzaData.senza_data === 1, JSON.stringify(senzaData));
  const troppo = aperturaNetta({ ...riga, giacenza_riferimento_t: 5 }, 'RETE', dich, n);
  verifica("se dopo si e' dichiarato piu' di quanto si e' letto, il negativo si vede", troppo.netta_t === -3, JSON.stringify(troppo));
}

console.log('LE DUE FUNZIONI VERE, NEL 2027');
{
  const ARCHIVI = {};
  globalThis.__ARCHIVI_APERTURA = ARCHIVI;
  const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
const ordina = (righe) => [...righe].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const entita = (nome) => ({
  list: async (_o, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI_APERTURA[nome] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI_APERTURA[nome] || []).filter(r => soddisfa(r, f))).slice(skip, skip + lim),
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
  let seq = 0;
  const con = (nome, righe) => { ARCHIVI[nome] = righe.map(r => ({ id: 'r' + String(++seq).padStart(4, '0'), ...r })); };
  const g = (giorno) => `${giorno}T08:00:00Z`;
  const primaria = (id, dest, kg, giorno, extra = {}) => ({
    id_ordine: id, numero_fir: 'FIR' + id, classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: dest,
    tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: kg, trasporto_finito_il: g(giorno), ordine_chiuso_il: g(giorno), ...extra,
  });
  for (const v of ['Terziaria', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile',
    'GiacenzaStoccaggio', 'IndicatoreGiorno', 'ExtraRaccolta', 'Secondaria']) con(v, []);
  const GAMMA = 'GAMMA TYRES SRL';
  con('DichiarazioneTrattamento', [
    { ordine_primaria: 'ET26000101', prodotto: '.class1', partner_operativo: 'SMOCO S.r.l.', destinazione: GAMMA, data_dichiarazione: '2026-12-10', fine_trasporto: '2026-11-15', peso_associato_kg: 10000, id_dichiarazione: 'D11' },
    { ordine_primaria: 'ET26000102', prodotto: '.class1', partner_operativo: 'SMOCO S.r.l.', destinazione: GAMMA, data_dichiarazione: '2027-01-15', fine_trasporto: '2026-12-10', peso_associato_kg: 8000, id_dichiarazione: 'D12' },
  ]);
  con('PrimariaRete', [primaria('ET26000101', GAMMA, 10000, '2026-11-15'), primaria('ET26000102', GAMMA, 8000, '2026-12-10')]);
  con('PrimariaAci', [{ id_ordine: 'EA26000201', numero_fir: 'FA201', classe: 'C', destinazione: GAMMA, tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: 3000, trasporto_finito_il: g('2026-12-05'), ordine_chiuso_il: g('2026-12-05') }]);
  con('DichiarazioneSito', [
    { sito: GAMMA, anno: 2026, mese: 'Novembre', canale: 'RETE', provenienza: '', operazione: 'R3', quantita_kg: 10000, caricata_inviata: true, caricata_il: '2026-12-10' },
    { sito: GAMMA, anno: 2026, mese: 'Dicembre', canale: 'RETE', provenienza: '', operazione: 'R3', quantita_kg: 8000, caricata_inviata: true, caricata_il: '2027-01-15' },
    { sito: GAMMA, anno: 2026, mese: 'Dicembre', canale: 'ACI', provenienza: 'primaria', operazione: 'R3', quantita_kg: 3000, caricata_inviata: true, caricata_il: '2027-01-20' },
  ]);
  // Il file dei non dichiarati del 31/12/2026: dicembre c'e' ancora.
  con('OrdineNonDichiarato', [{ ordine_primaria: 'ET26000102', destinazione: GAMMA, prodotto: '.class1', peso_non_dichiarato_kg: 8000, created_date: '2026-12-31T17:00:00Z', fine_trasporto: '2026-12-10' }]);
  const riga26 = { sito: GAMMA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true, giacenza_riferimento_t: 0 };
  // La chiusura del 2026 con le letture di quel giorno: 8.000 kg di rete, 3.000 di ACI.
  const ap = apertureDegliImpianti({ anno: 2026, impianti: [{ chiave: n(GAMMA), nome: GAMMA }], letture_impianti: { [n(GAMMA)]: { pfu_kg: 8000, aci_kg: 3000 } }, siti: [riga26], chiave: n });
  verifica('la chiusura scrive la lettura com\'e\': 8 t di rete e 3 di ACI, dal 31/12', ap.piano[0].dati.giacenza_riferimento_t === 8 && ap.piano[0].dati.giacenza_riferimento_aci_t === 3 && ap.piano[0].dati.apertura_del === '2026-12-31', JSON.stringify(ap.piano[0].dati));
  con('GiacenzaSito', [riga26, { ...ap.piano[0].dati }]);

  const riepilogo = await funzione('riepilogoDichiarazioni');
  const giacenze = await funzione('calcolaGiacenze');
  const d27 = await riepilogo({ anno: 2027 });
  const g27 = await giacenze({ anno: 2027 });
  verifica('le due funzioni rispondono', !d27.error && !g27.error, `${d27.error || ''} ${g27.error || ''}`);
  const s27 = (d27.siti || []).find(s => s.sito === GAMMA) || {};
  const canale = (c) => (s27.giacenze_canale || []).find(x => x.canale === c) || {};
  const R = canale('RETE'), A = canale('ACI');
  verifica('Dichiarazioni 2027, rete: apertura 0 (8 lette - 8 dichiarate a gennaio), giacenza 0', R.apertura_t === 0 && R.giacenza_t === 0, JSON.stringify(R));
  verifica("e la pagina sa perche': 8 lette, 8 dichiarate dopo", R.apertura_letta_t === 8 && R.dichiarato_dopo_apertura_t === 8, JSON.stringify(R));
  verifica('Dichiarazioni 2027, ACI: 3 - 3 = 0, non 3 per tutto l\'anno', A.apertura_t === 0 && A.giacenza_t === 0, JSON.stringify(A));
  const q = quadratura(s27);
  verifica('la quadratura col portale del 2027 torna', q && q.quadra === true, JSON.stringify(q));
  const G = (g27.righe || []).find(r => r.sito === GAMMA && r.tipo_destinazione === 'imp') || {};
  verifica('Giacenze 2027: la colonna dell\'apertura dice 0 come Dichiarazioni', G.giacenza_riferimento_t === 0, String(G.giacenza_riferimento_t));
  verifica('Giacenze 2027: ACI 0, come Dichiarazioni', G.giacenza_aci_t === 0, String(G.giacenza_aci_t));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
