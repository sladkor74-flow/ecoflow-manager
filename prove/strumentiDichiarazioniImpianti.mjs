// Prova degli strumenti DICHIARAZIONI_IMPIANTI e GIACENZE di EcoTyna sulle regole
// dei due moduli (chiusura dell'audit, 11/10/2026).
//
// 1. dichiarazioni_impianti sommava quantita_kg di tutte le righe: una gemella di
//    rete o di ACI (due righe sullo stesso mese) si contava due volte, mentre
//    Giacenze e Dichiarazioni, con leggiDichiarazioni, contano la prima e dicono
//    il doppione; e «Gatim» e «GATIM S.R.L.» erano due siti. Ora legge con
//    leggiDichiarazioni e dice anche il caricato a portale, lo stesso numero dei
//    due moduli (qui confrontato con le funzioni vere, SDK finto).
// 2. giacenze passava conferito_extra_t, che dall'11/10 sono le sole primarie,
//    ma non le secondarie di extra raccolta: la giacenza extra di un impianto non
//    si spiegava coi campi dello strumento.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const ARCHIVI = {};
globalThis.__ARCHIVI_DICH_ECOTYNA = ARCHIVI;
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
const ordina = (righe) => [...righe].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const entita = (nome) => ({
  list: async (_o, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI_DICH_ECOTYNA[nome] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI_DICH_ECOTYNA[nome] || []).filter(r => soddisfa(r, f))).slice(skip, skip + lim),
  create: async (r) => r, update: async (_id, r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'user', email: 'prova' }) }, asServiceRole: { entities }, entities };
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
const FUNZIONI = { calcolaGiacenze: await funzione('calcolaGiacenze'), riepilogoDichiarazioni: await funzione('riepilogoDichiarazioni') };
let rispostaFinta = null;
const svcFinto = new Proxy({}, { get: (_t, nome) => ({
  list: async (_o, lim = 1e9, skip = 0) => (ARCHIVI[String(nome)] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => (ARCHIVI[String(nome)] || []).filter(r => Object.entries(f || {}).every(([k, v]) => r[k] === v)).slice(skip, skip + lim),
}) });
const base44 = {
  asServiceRole: { entities: svcFinto },
  functions: { invoke: async (nome, corpo) => ({ data: rispostaFinta && nome === 'calcolaGiacenze' ? rispostaFinta : await FUNZIONI[nome](corpo) }) },
};
const { STRUMENTI } = await import('../base44/shared/strumentiAssistente.ts');
const dichiarazioni = STRUMENTI.find(s => s.nome === 'dichiarazioni_impianti');
const giacenze = STRUMENTI.find(s => s.nome === 'giacenze');

let seq = 0;
const con = (nome, righe) => { ARCHIVI[nome] = righe.map(r => ({ id: 'r' + String(++seq).padStart(4, '0'), ...r })); };
const g = (giorno) => `${giorno}T08:00:00Z`;
for (const v of ['DichiarazioneTrattamento', 'Terziaria', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile',
  'GiacenzaStoccaggio', 'IndicatoreGiorno', 'PrimariaAci', 'ExtraRaccolta', 'Secondaria', 'OrdineNonDichiarato',
  'DichiarazioneSito', 'GiacenzaSito', 'PrimariaRete']) con(v, []);
const GATIM = 'GATIM SRL';
const aci = (id, kg, giorno) => ({
  id_ordine: id, numero_fir: 'FIR' + id, classe: 'C - fino a 35 kg', prodotto: '.class1', destinazione: GATIM, tipo_destinazione: 'imp',
  stato: 'terminato', peso_effettivo: kg, trasportatore: 'RACC SRL', provincia: 'NA',
  ordine_immesso_il: g('2026-01-02'), trasporto_iniziato_il: g(giorno), trasporto_finito_il: g(giorno),
});
con('GiacenzaSito', [{ sito: GATIM, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true }]);
con('PrimariaAci', [aci('AC26000001', 5000, '2026-04-10')]);
// La gemella di aprile, ACI: due righe da 2 t, tutte e due caricate, una col nome
// scritto in un altro modo. Due campagne di extra raccolta a maggio, una caricata.
con('DichiarazioneSito', [
  { sito: GATIM, anno: 2026, mese: 'Aprile', canale: 'ACI', quantita_kg: 2000, caricata_inviata: true, caricata_il: '2026-05-05', granulo_kg: 1500 },
  { sito: 'Gatim S.r.l.', anno: 2026, mese: 'Aprile', canale: 'ACI', quantita_kg: 2000, caricata_inviata: true, caricata_il: '2026-05-06', granulo_kg: 1500 },
  { sito: GATIM, anno: 2026, mese: 'Maggio', canale: 'EXTRA_RACCOLTA', quantita_kg: 300, caricata_inviata: true, caricata_il: '2026-06-03' },
  { sito: GATIM, anno: 2026, mese: 'Maggio', canale: 'EXTRA_RACCOLTA', quantita_kg: 200, caricata_inviata: false },
]);

console.log('1. DICHIARAZIONI_IMPIANTI LEGGE COME I DUE MODULI');
{
  const r = (await dichiarazioni.esegui(base44, { anno: 2026 })).dati;
  const aciR = r.riepilogo.find(x => x.canale === 'ACI') || {};
  const extraR = r.riepilogo.find(x => x.canale === 'EXTRA_RACCOLTA') || {};
  verifica('un sito solo, anche scritto in due modi', r.riepilogo.filter(x => x.canale === 'ACI').length === 1, JSON.stringify(r.riepilogo));
  verifica('la gemella ACI di aprile si conta una volta: 2 t, non 4', aciR.dichiarato_t === 2 && aciR.caricato_a_portale_t === 2, JSON.stringify(aciR));
  const aprile = r.dichiarazioni.righe.find(x => x.canale === 'ACI' && x.mese === 'Aprile') || {};
  verifica('e il doppione si dice, sulla riga e nel riepilogo', /si conta la prima/.test(aprile.doppione || '') && aciR.mesi_con_doppione === 1 && !JSON.stringify(r).includes('"altre"'), JSON.stringify(aprile));
  verifica("le due campagne di extra raccolta si sommano, il caricato e' solo quella a portale", extraR.dichiarato_t === 0.5 && extraR.caricato_a_portale_t === 0.3, JSON.stringify(extraR));
  const maggio = r.dichiarazioni.righe.find(x => x.canale === 'EXTRA_RACCOLTA') || {};
  verifica('una riga di extra con due campagne, non caricata tutta', maggio.campagne_di_extra_raccolta === 2 && maggio.stato !== 'caricata' && maggio.caricato_a_portale_kg === 300, JSON.stringify(maggio));
  // Gli stessi numeri dei due moduli, sulle funzioni vere.
  const pagina = await FUNZIONI.riepilogoDichiarazioni({ anno: 2026 });
  const sp = pagina.siti.find(s => s.sito === GATIM) || {};
  verifica("il caricato ACI e' quello di Dichiarazioni Impianti", sp.dichiarato_caricato_aci_t === aciR.caricato_a_portale_t, `${sp.dichiarato_caricato_aci_t} contro ${aciR.caricato_a_portale_t}`);
  verifica('e quello extra', sp.dichiarato_caricato_extra_t === extraR.caricato_a_portale_t, `${sp.dichiarato_caricato_extra_t} contro ${extraR.caricato_a_portale_t}`);
  const gia = await FUNZIONI.calcolaGiacenze({ anno: 2026 });
  const rg = (gia.righe || []).find(x => x.sito === GATIM && x.tipo_destinazione !== 'stoc') || {};
  verifica('e quello delle Giacenze', rg.dichiarato_aci_t === aciR.caricato_a_portale_t, `${rg.dichiarato_aci_t} contro ${aciR.caricato_a_portale_t}`);
  const solo = (await dichiarazioni.esegui(base44, { anno: 2026, sito: 'gatim s.r.l.', canale: 'ACI', mese: 'aprile' })).dati;
  verifica('i filtri per sito, canale e mese tengono', solo.dichiarazioni.quanti === 1 && solo.riepilogo.length === 1 && solo.riepilogo[0].canale === 'ACI', JSON.stringify(solo).slice(0, 300));
  verifica('la nota dice che decurta solo il caricato', /solo quando risulta caricata/.test(r.nota) && /doppione/.test(r.nota));
  verifica("e non dice che per la rete il caricato e' il dichiarato delle Giacenze", /Per ACI ed extra raccolta e' lo stesso numero del dichiarato delle Giacenze/.test(r.nota) && /Per la rete coincide col dichiarato caricato di Dichiarazioni Impianti/.test(r.nota) && !/lo stesso numero di Giacenze e Dichiarazioni Impianti/.test(r.nota));
}

console.log('2. GIACENZE: LE SECONDARIE DI EXTRA RACCOLTA HANNO I LORO CAMPI');
{
  rispostaFinta = {
    righe: [{
      sito: GATIM, tipo_destinazione: 'imp', fotografia: { del: '2026-10-09' }, giacenza_rete_t: 0, giacenza_aci_t: 0,
      giacenza_extra_t: 1.7, conferito_extra_t: 1.2, secondarie_extra_in_t: 0.8, secondarie_extra_out_t: 0, dichiarato_extra_t: 0.3,
    }, {
      sito: 'NAPPI SUD SRL', tipo_destinazione: 'stoc', data_rilevazione: '2026-09-30', giacenza_rete_t: 10, giacenza_aci_t: 1,
      giacenza_extra_t: 0.4, conferito_extra_t: 1, secondarie_extra_in_t: 0, secondarie_extra_out_t: 0.6,
    }],
    anomalie: [],
  };
  const r = (await giacenze.esegui(base44, { anno: 2026 })).dati;
  const imp = r.siti.righe.find(x => x.sito === GATIM) || {};
  const stoc = r.siti.righe.find(x => x.sito === 'NAPPI SUD SRL') || {};
  verifica("l'impianto: primarie e secondarie di extra raccolta separate", imp.conferito_extra_t === 1.2 && imp.secondarie_extra_in_t === 0.8, JSON.stringify(imp));
  // Il dichiarato si legge dallo strumento, non si scrive a mano (revisione finale, 11/10/2026).
  verifica('e coi campi dello strumento la giacenza extra si spiega: 1,2 + 0,8 - 0,3 = 1,7', imp.dichiarato_extra_t === 0.3 && Math.round((imp.conferito_extra_t + imp.secondarie_extra_in_t - imp.dichiarato_extra_t) * 1000) / 1000 === imp.giacenza_extra_raccolta_t, JSON.stringify(imp));
  verifica('sul piazzale il dichiarato ACI ed extra non c\'e\': null, non zero', stoc.dichiarato_aci_t === null && stoc.dichiarato_extra_t === null, JSON.stringify(stoc));
  verifica('lo stoccaggio: le secondarie extra in uscita', stoc.secondarie_extra_out_t === 0.6, JSON.stringify(stoc));
  rispostaFinta = { righe: [{ sito: GATIM, tipo_destinazione: 'imp', fotografia: { del: '2026-10-09' }, giacenza_extra_t: 0 }], anomalie: [] };
  const vecchia = (await giacenze.esegui(base44, { anno: 2026 })).dati.siti.righe[0];
  verifica('un campo che la risposta non porta resta vuoto, non zero', vecchia.secondarie_extra_in_t === null && vecchia.secondarie_extra_out_t === null, JSON.stringify(vecchia));
  rispostaFinta = null;
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
