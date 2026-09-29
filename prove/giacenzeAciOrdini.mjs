// Prova degli ORDINI DIETRO LA GIACENZA ACI DI UN PIAZZALE, 28/09/2026.
//
// Richiesta dell'utente: «laddove vedi una giacenza di ACI negli stoccaggi,
// permetti di vedere tutti gli ordini collegati al raggiungimento di quel
// valore». Ogni riga dice da quale archivio viene. Il canale lo decide il
// MATERIALE e non l'archivio (decisione dell'utente, 28/09/2026), quindi una
// primaria di classe 9 e' ACI anche se si trovasse nell'archivio della rete:
// oggi non capita, perche' il caricamento le smista col materiale e rifiuta il
// blocco che non torna, e qui si prova come rete di sicurezza.
//
// Qui non si prova un pezzo di logica a parte: si fa girare la funzione vera
// (base44/functions/calcolaGiacenze), impacchettata con esbuild e con un SDK
// finto che legge archivi in memoria. Cosi' la prova dice davvero quello che
// l'utente vedra' a video: che il totale degli ordini torna AL CHILO col numero
// della colonna, e che i chili di una classe 9 arrivata da un archivio di rete
// non finiscono nel numero della rete.
//
// Prima di questa regola quei chili si perdevano: entravano nel saldo della rete
// sotto la classe ACI, che nessun conto legge, e uscivano da tutte e due le
// giacenze.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// --- Gli archivi in memoria, letti dall'SDK finto ---
const ARCHIVI = {};
globalThis.__ARCHIVI = ARCHIVI;

const SDK_FINTO = `
const ordina = (righe, ord) => {
  const campo = String(ord || 'id').replace(/^[-+]/, '') || 'id';
  return [...righe].sort((a, b) => String(a[campo] ?? '').localeCompare(String(b[campo] ?? '')));
};
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
const entita = (nome) => ({
  list: async (ord = 'id', lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI[nome] || [], ord).slice(skip, skip + lim),
  filter: async (f, ord = 'id', lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI[nome] || []).filter(r => soddisfa(r, f)), ord).slice(skip, skip + lim),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;

const finti = {
  name: 'sdk-finto',
  setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
  },
};

const pacchetto = await build({
  entryPoints: [qui('../base44/functions/calcolaGiacenze/entry.ts')],
  bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', plugins: [finti],
});
const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
const calcolaGiacenze = async (corpo) => {
  const res = await modulo.default({ json: async () => corpo });
  return res.json();
};

// --- Il caso: NAPPI SUD, l'ancora al 31/12/2025 e i movimenti del 2026 ---
let seq = 0;
const con = (nome, righe) => { ARCHIVI[nome] = righe.map(r => ({ id: 'r' + (++seq).toString().padStart(4, '0'), ...r })); };
const g = (giorno) => `${giorno}T08:00:00Z`;

const PIAZZALE = 'NAPPI SUD SRL';
const ALTRO = 'ALTRO PIAZZALE SRL';

con('GiacenzaSito', [
  { sito: PIAZZALE, tipo_destinazione: 'stoc', anno: 2026 },
  { sito: ALTRO, tipo_destinazione: 'stoc', anno: 2026 },
]);
// L'ancora dell'anno: la giacenza dichiarata al 31/12 precedente. La classe 9 e'
// l'ACI, le classi 1-4 sono la rete.
con('GiacenzaStoccaggio', [
  { sito: PIAZZALE, data_rilevazione: '2025-12-31', class1_kg: 10000, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 1000 },
  { sito: ALTRO, data_rilevazione: '2025-12-31', class1_kg: 0, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 0 },
]);
con('PrimariaRete', [
  // una primaria di rete vera
  {
    id_ordine: 'ET26000001', numero_fir: 'FIRRETE1', numero_ordine_interno: '162684-15',
    classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: PIAZZALE, tipo_destinazione: 'stoc',
    stato: 'terminato', peso_effettivo: 5000, trasporto_finito_il: g('2026-03-10'), ordine_chiuso_il: g('2026-03-14'),
    trasportatore: 'C.L. Service',
  },
  // LA RIGA DEL CASO: classe 9 nell'archivio della RETE, scaricata in piazzale.
  {
    id_ordine: 'ET26000002', numero_fir: 'FIRACI9', numero_ordine_interno: '163142-85',
    classe: 'PFU Autodemolizione', prodotto: '.class9', destinazione: PIAZZALE, tipo_destinazione: 'stoc',
    stato: 'terminato', peso_effettivo: 640, trasporto_finito_il: g('2026-04-01'), ordine_chiuso_il: g('2026-04-06'),
    trasportatore: 'Nappi Sud',
  },
  // un ACI dell'archivio di rete senza fine trasporto: fuori dal conto, e si dice
  {
    id_ordine: 'ET26000009', numero_fir: 'FIRACISENZA', numero_ordine_interno: '165000-01',
    classe: 'PFU Autodemolizione', prodotto: '.class9', destinazione: PIAZZALE, tipo_destinazione: 'stoc',
    stato: 'terminato', peso_effettivo: 200, trasporto_finito_il: null, ordine_chiuso_il: g('2026-05-20'),
    trasportatore: 'Nappi Sud',
  },
]);
con('PrimariaAci', [
  {
    id_ordine: 'ET26000003', numero_fir: 'FIRACI1', numero_ordine_interno: '164000-11',
    classe: 'PFU Autodemolizione', prodotto: '.class9', destinazione: PIAZZALE, tipo_destinazione: 'stoc',
    stato: 'terminato', peso_effettivo: 500, trasporto_finito_il: g('2026-05-02'), ordine_chiuso_il: g('2026-05-06'),
    trasportatore: 'Nappi Sud',
  },
]);
con('Secondaria', [
  // l'ACI che riparte dal piazzale verso un impianto: uscita
  {
    id_ordine: 'SEC26000001', numero_fir: 'FIRSEC1', numero_ordine_interno: '170000-01',
    classe: 'PFU Autodemolizione', prodotto: '.class9', stoccaggio: PIAZZALE, destinazione: 'IRIGOM SRL',
    tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: 300, trasporto_finito_il: g('2026-06-05'),
  },
  // sull'altro piazzale esce classe P che non e' mai entrata: la classe va sotto
  // zero, e per i PIAZZALI quel controllo per classe deve restare
  {
    id_ordine: 'SEC26000002', numero_fir: 'FIRSEC2', numero_ordine_interno: '170000-02',
    classe: 'P - fino a 35 kg', prodotto: '.class1', stoccaggio: ALTRO, destinazione: 'IRIGOM SRL',
    tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: 500, trasporto_finito_il: g('2026-06-06'),
  },
]);
for (const vuoto of ['OrdineNonDichiarato', 'DichiarazioneTrattamento', 'ExtraRaccolta', 'Terziaria', 'DichiarazioneSito', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore']) con(vuoto, []);

const esito = await calcolaGiacenze({ anno: 2026 });
verifica('la funzione risponde', !esito.error, JSON.stringify(esito.error));
const riga = (esito.righe || []).find(r => r.sito === PIAZZALE && r.tipo_destinazione === 'stoc');
verifica('il piazzale c\'e\'', !!riga, JSON.stringify((esito.righe || []).map(r => r.sito + '|' + r.tipo_destinazione)));

console.log('UNA CLASSE 9 NELL\'ARCHIVIO DELLA RETE E\' ACI, NON RETE');
verifica('la rete resta la rete: 10.000 di ancora + 5.000 arrivati = 15.000',
  riga.giacenza_classi_kg.P === 15000, JSON.stringify(riga.giacenza_classi_kg));
verifica('l\'ACI: 1.000 di ancora + 640 dai terminati rete + 500 ACI - 300 usciti = 1.840',
  riga.giacenza_classi_kg.ACI === 1840, JSON.stringify(riga.giacenza_classi_kg));
verifica('i 640 kg non entrano nel numero della rete', riga.giacenza_rete_t === 15, String(riga.giacenza_rete_t));
verifica('e non si perdono per strada', riga.giacenza_aci_t === 1.84, String(riga.giacenza_aci_t));

console.log('GLI ORDINI CHE FANNO QUEL NUMERO, UNO PER UNO');
verifica('il dettaglio c\'e\'', !!riga.aci_dettaglio);
// Se non ci fosse, le verifiche qui sotto devono FALLIRE una per una e dire
// quali: una prova che si schianta alla prima non dice quanto manca.
const d = riga.aci_dettaglio || { ordini: [], senza_fine_ordini: [] };
verifica('parte dall\'ancora dell\'anno', d.ancora_del === '2025-12-31' && d.ancora_kg === 1000, JSON.stringify([d.ancora_del, d.ancora_kg]));
verifica('tre movimenti: due entrate e un\'uscita', d.ordini.length === 3 && d.ingressi === 2 && d.uscite === 1, JSON.stringify([d.ordini.length, d.ingressi, d.uscite]));
verifica('in ordine di fine trasporto', d.ordini.map(o => o.finito_il).join() === '2026-04-01,2026-05-02,2026-06-05', d.ordini.map(o => o.finito_il).join());
const cerca = (id) => d.ordini.find(o => o.id_ordine === id) || {};
const dalRete = cerca('ET26000002');
verifica('la riga di classe 9 dice che sta nei terminati rete', dalRete && dalRete.archivio === 'terminati_rete', JSON.stringify(dalRete));
verifica('e porta ID ordine, ticket, fine trasporto, controparte e kg',
  dalRete.ticket === '163142-85' && dalRete.finito_il === '2026-04-01' && dalRete.controparte === 'Nappi Sud' && dalRete.kg === 640,
  JSON.stringify(dalRete));
verifica('l\'ACI dell\'archivio ACI si distingue', cerca('ET26000003').archivio === 'terminati_aci');
verifica('e la secondaria in uscita e\' un\'uscita', cerca('SEC26000001').verso === 'uscita');

console.log('IL TOTALE TORNA AL CHILO CON IL NUMERO DELLA COLONNA');
verifica('ancora + entrate - uscite = 1.840', d.totale_kg === 1840 && d.ingressi_kg === 1140 && d.uscite_kg === 300, JSON.stringify([d.totale_kg, d.ingressi_kg, d.uscite_kg]));
verifica('ed e\' esattamente il numero della colonna', d.colonna_kg === riga.giacenza_classi_kg.ACI && d.scarto_kg === 0 && d.torna === true,
  JSON.stringify([d.colonna_kg, d.scarto_kg, d.torna]));

console.log('CHI NON HA LA FINE TRASPORTO RESTA FUORI, E SI DICE');
verifica('un ACI senza fine trasporto non entra nel totale', d.senza_fine === 1 && d.senza_fine_kg === 200, JSON.stringify([d.senza_fine, d.senza_fine_kg]));
verifica('e non e\' nell\'elenco di quelli che compongono il numero', !d.ordini.some(o => o.id_ordine === 'ET26000009'));
verifica('ma lo si sa quale', (d.senza_fine_ordini[0] || {}).id_ordine === 'ET26000009');

console.log('LA STESSA RIGA HA LO STESSO CANALE IN TUTTE LE COLONNE');
// La classe 9 dell'archivio di rete era ACI nella colonna della giacenza e RETE nel
// Conferito, nel residuo e nella percentuale del target: la pagina diceva due cose
// diverse sullo stesso record in due colonne affiancate, e la fatturazione - che usa
// canaleMovimento - la fatturava ACI. I 640 kg vanno nel conferito ACI.
verifica('il conferito di rete non contiene i 640 kg di classe 9', riga.conferito_primarie_t === 5,
  JSON.stringify([riga.conferito_primarie_t, riga.conferito_aci_t]));
verifica('che stanno nel conferito ACI, con gli altri 500', riga.conferito_aci_t === 1.14,
  JSON.stringify([riga.conferito_primarie_t, riga.conferito_aci_t]));

// Su un IMPIANTO la giacenza a portale e' della rete: una classe 9 non ci entra.
con('PrimariaRete', [
  ...ARCHIVI.PrimariaRete.map(({ id: _id, ...r }) => r),
  {
    id_ordine: 'ET26000020', numero_fir: 'FIRACIIMP', numero_ordine_interno: '166000-77',
    classe: 'PFU Autodemolizione', prodotto: '.class9', destinazione: 'IRIGOM SRL', tipo_destinazione: 'imp',
    stato: 'terminato', peso_effettivo: 7000, trasporto_finito_il: g('2026-07-02'), ordine_chiuso_il: g('2026-07-08'),
    trasportatore: 'Nappi Sud',
  },
]);
con('GiacenzaSito', [
  { sito: PIAZZALE, tipo_destinazione: 'stoc', anno: 2026 },
  { sito: ALTRO, tipo_destinazione: 'stoc', anno: 2026 },
  { sito: 'IRIGOM SRL', tipo_destinazione: 'imp', anno: 2026 },
]);
const esitoImp = await calcolaGiacenze({ anno: 2026 });
const irigom = (esitoImp.righe || []).find(r => r.sito === 'IRIGOM SRL' && r.tipo_destinazione === 'imp') || {};
verifica('i 7.000 kg di classe 9 non entrano nella giacenza di rete a portale di un impianto',
  (irigom.giacenza_rete_t || 0) === 0, JSON.stringify([irigom.giacenza_rete_t, irigom.conferito_primarie_t]));
verifica('e nemmeno nel suo conferito di rete', (irigom.conferito_primarie_t || 0) === 0,
  JSON.stringify([irigom.conferito_primarie_t, irigom.conferito_aci_t]));

console.log('IL RESIDUO SI MISURA SU TUTTO QUELLO CHE E\' ARRIVATO (29/09/2026)');
// Il target totale di un impianto comprende gia' cio' che gli arriva in secondaria
// dai piazzali, quindi il residuo sottrae il Conferito RETE - primarie piu'
// secondarie in ingresso - e non le sole primarie. Sottraendo le sole primarie
// usciva piu' alto del vero (sui dati veri: Irigom 1.798,70 t invece di 1.067,04).
// La COPERTURA invece resta sulle primarie: e' il target di raccolta, e le
// secondarie sono materiale gia' raccolto che si sposta.
con('GiacenzaSito', [
  { sito: PIAZZALE, tipo_destinazione: 'stoc', anno: 2026 },
  { sito: ALTRO, tipo_destinazione: 'stoc', anno: 2026 },
  { sito: 'IRIGOM SRL', tipo_destinazione: 'imp', anno: 2026, target_totale_t: 100, target_primarie_t: 60 },
]);
con('PrimariaRete', [
  ...ARCHIVI.PrimariaRete.map(({ id: _id, ...r }) => r),
  // 40 t di primarie arrivate all'impianto
  {
    id_ordine: 'ET26000030', numero_fir: 'FIRIMP1', classe: 'P - fino a 35 kg', prodotto: '.class1',
    destinazione: 'IRIGOM SRL', tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: 40000,
    trasporto_finito_il: g('2026-08-01'), ordine_chiuso_il: g('2026-08-05'), trasportatore: 'C.L. Service',
  },
]);
con('Secondaria', [
  ...ARCHIVI.Secondaria.map(({ id: _id, ...r }) => r),
  // 25 t di secondarie di rete arrivate allo stesso impianto dal piazzale
  {
    id_ordine: 'SEC26000030', numero_fir: 'FIRSEC30', classe: 'P - fino a 35 kg', prodotto: '.class1',
    stoccaggio: PIAZZALE, destinazione: 'IRIGOM SRL', tipo_destinazione: 'imp',
    stato: 'terminato', peso_effettivo: 25000, trasporto_finito_il: g('2026-08-10'),
  },
]);
const esitoRes = await calcolaGiacenze({ anno: 2026 });
const imp = (esitoRes.righe || []).find(r => r.sito === 'IRIGOM SRL' && r.tipo_destinazione === 'imp') || {};
// Le secondarie di rete in ingresso sono 25 t piu' i 500 kg che arrivano dall'altro
// piazzale; i 300 kg di ACI restano fuori, perche' i canali non si mescolano.
verifica('il conferito e\' primarie piu\' secondarie di RETE in ingresso, ACI escluso',
  imp.conferito_primarie_t === 40 && imp.secondarie_in_t === 25.5 && imp.conferito_t === 65.5,
  JSON.stringify([imp.conferito_primarie_t, imp.secondarie_in_t, imp.conferito_t]));
verifica('il residuo sottrae tutto quello che e\' arrivato: 100 - 65,5 = 34,5', imp.residuo_t === 34.5,
  JSON.stringify([imp.target_totale_t, imp.conferito_t, imp.residuo_t]));
verifica('e non le sole primarie, che darebbero 60', imp.residuo_t !== 60, String(imp.residuo_t));
verifica('la copertura resta sulla raccolta, cioe\' le primarie: 40 su 100', Math.round(imp.percentuale_target) === 40,
  String(imp.percentuale_target));
verifica('il target delle primarie si mostra ma nel residuo non entra', imp.target_primarie_t === 60
  && imp.residuo_t === imp.target_totale_t - imp.conferito_t, JSON.stringify([imp.target_primarie_t, imp.residuo_t]));
// Un piazzale non ha target totale: niente residuo, e non lo si inventa dalle primarie.
const piazz = (esitoRes.righe || []).find(r => r.sito === PIAZZALE && r.tipo_destinazione === 'stoc') || {};
verifica('un piazzale senza target totale non ha residuo', piazz.residuo_t === null, String(piazz.residuo_t));

console.log('PER I PIAZZALI IL CONTROLLO PER CLASSE RESTA');
const negative = (esito.anomalie || []).filter(a => a.tipo === 'giacenza_negativa');
verifica('una classe sotto zero su un piazzale e\' ancora un\'anomalia per classe',
  negative.some(a => a.classe === 'P' && a.kg === -500 && /ALTRO/i.test(a.sito)), JSON.stringify(negative));
verifica('e riguarda solo chi la classe ce l\'ha davvero', negative.every(a => ['P', 'M', 'G1', 'G2', 'ACI'].includes(a.classe)), JSON.stringify(negative.map(a => a.classe)));

console.log('UN IMPIANTO NON HA QUESTO DETTAGLIO: LA SUA GIACENZA NON VIENE DAI NOSTRI MOVIMENTI');
const impianto = (esito.righe || []).find(r => r.tipo_destinazione === 'imp');
verifica('l\'impianto non porta il dettaglio degli ordini ACI', !impianto || impianto.aci_dettaglio === null, JSON.stringify(impianto && impianto.sito));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
