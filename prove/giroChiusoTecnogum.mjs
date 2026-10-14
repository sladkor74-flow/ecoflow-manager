// TECNOGUM SULLA RETE E' UN GIRO CHIUSO (decisioni dell'utente del 13/10/2026).
//
// Le parole dell'utente: «tutte le 249,06 t sono andate in tecnogum per il quale
// impianto, come gia' sai, noi nel 2026 non facciamo dichiarazioni perche' loro
// non ci fatturano i conferimenti rete (trattamento); per cio' che ci riguarda il
// cerchio e' chiuso». Il file degli ordini non dichiarati del 09/10/2026
// attribuisce ancora 181,299 t allo stoccaggio di T-Cycle: partite tutte verso
// Tecnogum, non le chiudera' nessuna dichiarazione. Il numero resta quello del
// portale (serve alla quadratura) e nessun conto cambia; le pagine lo dicono
// «attribuite dal portale allo stoccaggio, ma per noi chiuse: Tecnogum sulla
// rete non dichiara a SMOCO», non come un'attesa da risolvere.
//
// Qui si prova:
// 1. la regola, attesaChiusaPerNoi (shared/giacenzaPortale.ts): si chiude solo
//    quello che non puo' essere andato altrove;
// 2. le due funzioni vere su un archivio costruito: lo stesso numero chiuso in
//    Giacenze e Dichiarazioni, stoccaggio per stoccaggio, e l'attesa e le
//    giacenze di prima;
// 3. le pagine: Giacenze, scheda Stoccaggi, Quadratura e le righe della storia;
// 4. sui dati veri (../dati-veri/, se c'e'): T-Cycle 181,299 t chiuse in tutti e
//    due i moduli, Nappi Sud no (manda anche a Irigom), l'attesa di prima.
// npm run prove
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as PORTALE from '../base44/shared/giacenzaPortale.ts';
import { normalizzaRagioneSociale as norm } from '../base44/shared/normalizzaRagioneSociale.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const manca = (nome) => () => { throw new Error(`${nome} non c'e'`); };
const attesaChiusaPerNoi = PORTALE.attesaChiusaPerNoi || manca('attesaChiusaPerNoi');
const percheAttesaChiusa = PORTALE.percheAttesaChiusa || manca('percheAttesaChiusa');
const prova = (f) => { try { return f(); } catch (e) { return { errore: String(e && e.message) }; } };

console.log('1. LA REGOLA');
{
  const tec = new Map([['tecnogum', 'TECNOGUM SRL']]);
  const verso = (giorno, chi) => ({ giorno, verso: chi });
  const base = { attesaT: 181.299, primoArrivo: '2026-01-10', partenze: [verso('2026-01-20', 'tecnogum'), verso('2026-05-30', 'tecnogum')], nonDichiarano: tec, inPiazzaleT: 0 };
  const tutta = prova(() => attesaChiusaPerNoi(base));
  verifica('partite tutte verso Tecnogum, piazzale vuoto: chiuse tutte le 181,299 t', tutta && tutta.chiusa_t === 181.299, J(tutta));
  verifica('col perche\' detto uguale nei due moduli', tutta && tutta.perche === 'attribuite dal portale allo stoccaggio, ma per noi chiuse: TECNOGUM SRL sulla rete non dichiara a SMOCO', J(tutta));
  const inPiazzale = prova(() => attesaChiusaPerNoi({ ...base, attesaT: 12, inPiazzaleT: 4 }));
  verifica('quello che e\' ancora in piazzale non e\' partito: chiuse 8 t su 12', inPiazzale && inPiazzale.chiusa_t === 8, J(inPiazzale));
  const misto = prova(() => attesaChiusaPerNoi({ ...base, partenze: [...base.partenze, verso('2026-03-01', 'irigom')] }));
  verifica('uno stoccaggio che manda anche a chi dichiara (Nappi Sud): resta un\'attesa', misto === null, J(misto));
  const prima = prova(() => attesaChiusaPerNoi({ ...base, partenze: [verso('2025-12-01', 'irigom'), ...base.partenze] }));
  verifica('una partenza verso chi dichiara, prima del primo carico in attesa, non conta', prima && prima.chiusa_t === 181.299, J(prima));
  const senzaFine = prova(() => attesaChiusaPerNoi({ ...base, partenze: [...base.partenze, verso('', 'irigom')] }));
  verifica('una partenza senza fine trasporto verso chi dichiara: non si sa quando, resta un\'attesa', senzaFine === null, J(senzaFine));
  verifica('un carico in attesa senza giorno di arrivo: non si chiude niente', prova(() => attesaChiusaPerNoi({ ...base, senzaGiorno: true })) === null);
  verifica('senza chi non dichiara: niente', prova(() => attesaChiusaPerNoi({ ...base, nonDichiarano: new Map() })) === null);
  verifica('senza la giacenza del piazzale (nessuna lettura): niente, non si indovina', prova(() => attesaChiusaPerNoi({ ...base, inPiazzaleT: null })) === null);
  verifica('nessuna partenza: niente', prova(() => attesaChiusaPerNoi({ ...base, partenze: [] })) === null);
  verifica('due impianti che non dichiarano: «... e ... sulla rete non dichiarano a SMOCO»',
    prova(() => percheAttesaChiusa(['TECNOGUM SRL', 'ALTRO SRL'])) === 'attribuite dal portale allo stoccaggio, ma per noi chiuse: TECNOGUM SRL e ALTRO SRL sulla rete non dichiarano a SMOCO');
}

// --- Le funzioni vere, con un SDK finto: uguaglianza, $in, $gte, $lte, null ---
const ARCHIVI = {};
globalThis.__ARCHIVI_GIRO_CHIUSO = ARCHIVI;
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
  list: async (_o, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI_GIRO_CHIUSO[nome] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI_GIRO_CHIUSO[nome] || []).filter(r => soddisfa(r, f))).slice(skip, skip + lim),
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
let seq = 0;
const VUOTI = ['DichiarazioneTrattamento', 'Terziaria', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile',
  'GiacenzaStoccaggio', 'IndicatoreGiorno', 'PrimariaAci', 'ExtraRaccolta', 'Secondaria', 'OrdineNonDichiarato',
  'DichiarazioneSito', 'GiacenzaSito', 'PrimariaRete', 'CommessaEcotyre', 'RegistroCaricamento', 'StatoArchivio', 'UploadLog'];
const con = (nome, righe) => { ARCHIVI[nome] = righe.map(r => ({ id: 'r' + String(++seq).padStart(5, '0'), ...r })); };
const g = (giorno) => `${giorno}T08:00:00Z`;
const movimento = (id, dest, kg, giorno, extra = {}) => ({
  id_ordine: id, numero_fir: 'FIR' + id, classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: dest,
  tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: kg, trasportatore: 'RACCOLTA SRL', provincia: 'NA',
  ordine_immesso_il: g(giorno), trasporto_iniziato_il: g(giorno), trasporto_finito_il: g(giorno), ordine_chiuso_il: g(giorno), ...extra,
});
const OGGI = '2026-10-11T10:00:00Z';
const TCY = 'T-CYCLE INDUSTRIES SRL', TEC = 'TECNOGUM SRL', IRI = 'IRIGOM SRL', NAP = 'NAPPI SUD SRL', DEP = 'DEPOSITO SUD SRL';
const nelFile = (ordine, dest, kg, fine) => ({ ordine_primaria: ordine, destinazione: dest, prodotto: '.class1', peso_non_dichiarato_kg: kg, created_date: '2026-10-05T06:00:00Z', fine_trasporto: fine });
// L'archivio: T-Cycle impianto e stoccaggio, che manda tutto a Tecnogum; Nappi Sud
// che manda a Irigom e a Tecnogum; un deposito che manda solo a Tecnogum e ha
// ancora 4 t in piazzale.
const archivio = ({ tecnogumDichiara = false, tcyAncheIrigom = false } = {}) => {
  for (const k of Object.keys(ARCHIVI)) delete ARCHIVI[k];
  for (const v of VUOTI) ARCHIVI[v] = [];
  con('GiacenzaSito', [
    { sito: TCY, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true },
    { sito: TCY, tipo_destinazione: 'stoc', anno: 2026 },
    { sito: TEC, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: tecnogumDichiara },
    { sito: IRI, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true },
    { sito: NAP, tipo_destinazione: 'stoc', anno: 2026 },
    { sito: DEP, tipo_destinazione: 'stoc', anno: 2026 },
  ]);
  const vuoto = (sito) => ({ sito, data_rilevazione: '2025-12-31', class1_kg: 0, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 0, created_date: '2026-01-02T09:00:00Z' });
  con('GiacenzaStoccaggio', [vuoto(TCY), vuoto(NAP), vuoto(DEP)]);
  con('PrimariaRete', [
    movimento('ET26TCYI01', TCY, 5000, '2026-02-10'),
    movimento('ET26TCYS01', TCY, 10000, '2026-01-10', { tipo_destinazione: 'stoc' }),
    movimento('ET26TCYS02', TCY, 10000, '2026-02-10', { tipo_destinazione: 'stoc' }),
    movimento('ET26TCYS03', TCY, 10000, '2026-03-10', { tipo_destinazione: 'stoc' }),
    movimento('ET26NAPS01', NAP, 20000, '2026-04-10', { tipo_destinazione: 'stoc' }),
    movimento('ET26NAPS02', NAP, 5000, '2026-04-12', { tipo_destinazione: 'stoc' }),
    movimento('ET26DEPS01', DEP, 8000, '2026-05-10', { tipo_destinazione: 'stoc' }),
    movimento('ET26DEPS02', DEP, 4000, '2026-05-20', { tipo_destinazione: 'stoc' }),
  ]);
  con('Secondaria', [
    movimento('SEC26TCY02', TEC, 10000, '2026-02-15', { stoccaggio: TCY }),
    movimento('SEC26TCY04', tcyAncheIrigom ? IRI : TEC, 20000, '2026-04-01', { stoccaggio: TCY }),
    movimento('SEC26NAP05', IRI, 20000, '2026-05-01', { stoccaggio: NAP }),
    movimento('SEC26NAP06', TEC, 5000, '2026-05-02', { stoccaggio: NAP }),
    movimento('SEC26DEP06', TEC, 8000, '2026-06-01', { stoccaggio: DEP }),
  ]);
  con('OrdineNonDichiarato', [
    nelFile('ET26TCYS01', TCY, 10000, '2026-01-10'), nelFile('ET26TCYS02', TCY, 10000, '2026-02-10'), nelFile('ET26TCYS03', TCY, 10000, '2026-03-10'),
    nelFile('ET26NAPS01', NAP, 20000, '2026-04-10'), nelFile('ET26NAPS02', NAP, 5000, '2026-04-12'),
    nelFile('ET26DEPS01', DEP, 8000, '2026-05-10'), nelFile('ET26DEPS02', DEP, 4000, '2026-05-20'),
  ]);
};
const giacenze = await funzione('calcolaGiacenze');
const riepilogo = await funzione('riepilogoDichiarazioni');
const due = async (opzioni) => {
  archivio(opzioni);
  return { G: await conOra(OGGI, () => giacenze({ anno: 2026 })), R: await conOra(OGGI, () => riepilogo({ anno: 2026 })) };
};
const rigaG = (G, sito) => (G.righe || []).find(r => r.tipo_destinazione === 'stoc' && norm(r.sito) === norm(sito)) || {};
const stocR = (R, sito) => (R.stoccaggi || []).find(s => norm(s.sito) === norm(sito)) || {};

console.log('2. LE DUE FUNZIONI VERE, SU UN ARCHIVIO COSTRUITO');
const { G, R } = await due();
{
  const PERCHE = 'attribuite dal portale allo stoccaggio, ma per noi chiuse: TECNOGUM SRL sulla rete non dichiara a SMOCO';
  const tg = rigaG(G, TCY), tr = stocR(R, TCY);
  verifica('T-Cycle: il portale attribuisce ancora 30 t allo stoccaggio, in tutti e due i moduli, come prima', tg.in_attesa_dichiarazione_t === 30 && tr.in_attesa_portale_t === 30, `${tg.in_attesa_dichiarazione_t} / ${tr.in_attesa_portale_t}`);
  verifica('e per noi sono chiuse tutte: 30 t nelle Giacenze e nelle Dichiarazioni, col perche\'', tg.in_attesa_chiusa_t === 30 && tr.in_attesa_chiusa_t === 30 && tg.in_attesa_chiusa_perche === PERCHE && tr.in_attesa_chiusa_perche === PERCHE, J([tg.in_attesa_chiusa_t, tr.in_attesa_chiusa_t, tg.in_attesa_chiusa_perche]));
  const ng = rigaG(G, NAP), nr = stocR(R, NAP);
  verifica('Nappi Sud manda anche a Irigom: 25 t restano un\'attesa, in tutti e due', ng.in_attesa_dichiarazione_t === 25 && nr.in_attesa_portale_t === 25 && ng.in_attesa_chiusa_t === undefined && nr.in_attesa_chiusa_t === undefined, J([ng.in_attesa_chiusa_t, nr.in_attesa_chiusa_t]));
  const dg = rigaG(G, DEP), dr = stocR(R, DEP);
  verifica('il deposito: 12 t in attesa, 4 ancora in piazzale, 8 per noi chiuse, in tutti e due', dg.in_attesa_dichiarazione_t === 12 && dg.giacenza_rete_t === 4 && dg.in_attesa_chiusa_t === 8 && dr.in_attesa_chiusa_t === 8, J([dg.in_attesa_dichiarazione_t, dg.giacenza_rete_t, dg.in_attesa_chiusa_t, dr.in_attesa_chiusa_t]));
  verifica('il totale della colonna resta il numero del portale (67 t), e accanto le 38 t per noi chiuse', G.totali.in_attesa_dichiarazione_t === 67 && G.totali.in_attesa_chiusa_t === 38, J([G.totali.in_attesa_dichiarazione_t, G.totali.in_attesa_chiusa_t]));
  const qDep = (R.siti || []).find(s => s.tipo_destinazione === 'stoc' && norm(s.sito) === norm(DEP) && s.canale === 'RETE') || {};
  verifica('la riga della Quadratura del deposito porta lo stesso numero chiuso', qDep.in_attesa_dichiarazione_t === 12 && qDep.in_attesa_chiusa_t === 8 && qDep.in_attesa_chiusa_perche === PERCHE, J(qDep));
  // Nessun numero dei conti cambia: le giacenze di rete dei piazzali sono quelle dei movimenti.
  verifica('le giacenze dei piazzali non cambiano: T-Cycle 0, Nappi Sud 0, il deposito 4, nei due moduli',
    tg.giacenza_rete_t === 0 && ng.giacenza_rete_t === 0 && dg.giacenza_rete_t === 4
    && (tr.canali || []).find(c => c.canale === 'RETE').in_piazzale_t === 0 && (dr.canali || []).find(c => c.canale === 'RETE').in_piazzale_t === 4,
    J([tg.giacenza_rete_t, ng.giacenza_rete_t, dg.giacenza_rete_t]));
  // Il racconto di T-Cycle: le 30 t sono per noi chiuse, e lo stoccaggio non lo dichiara nessuno.
  const tcy = (R.siti || []).find(s => s.tipo_destinazione !== 'stoc' && norm(s.sito) === norm(TCY));
  const fr = tcy && tcy.flussi.find(f => f.canale === 'RETE');
  const racconto = (fr && fr.racconto) || [];
  verifica('il racconto della riga di T-Cycle: «Le 30,00 t ... sono attribuite dal portale allo stoccaggio, ma per noi chiuse»',
    racconto.some(f => f.startsWith('Le 30,00 t del file degli ordini non dichiarati del 05/10/2026 sono attribuite dal portale allo stoccaggio, ma per noi chiuse: TECNOGUM SRL sulla rete non dichiara a SMOCO.'))
    && racconto.some(f => /è ripartito tutto in secondaria verso TECNOGUM SRL: non entra in questa riga e qui non si dichiara, e TECNOGUM SRL sulla rete non dichiara a SMOCO: per noi il giro è chiuso\./.test(f))
    && !racconto.some(f => /in attesa di una dichiarazione/.test(f)), J(racconto));
}
{
  const { G: G2, R: R2 } = await due({ tcyAncheIrigom: true });
  verifica('se T-Cycle avesse mandato una secondaria anche a Irigom, l\'attesa resterebbe un\'attesa, in tutti e due',
    rigaG(G2, TCY).in_attesa_chiusa_t === undefined && stocR(R2, TCY).in_attesa_chiusa_t === undefined && rigaG(G2, TCY).in_attesa_dichiarazione_t === 30, J([rigaG(G2, TCY).in_attesa_chiusa_t, stocR(R2, TCY).in_attesa_chiusa_t]));
  const { G: G3, R: R3 } = await due({ tecnogumDichiara: true });
  verifica('e se Tecnogum dichiarasse la rete, nessun giro chiuso: le stesse 30 t sono un\'attesa', rigaG(G3, TCY).in_attesa_chiusa_t === undefined && stocR(R3, TCY).in_attesa_chiusa_t === undefined && G3.totali.in_attesa_chiusa_t === undefined, J(G3.totali.in_attesa_chiusa_t));
}

console.log('3. LE PAGINE');
// La pagina disegnata (react-dom/server), coi componenti veri e gli alias di Vite.
// src/lib/utils.js guarda il browser appena caricata (isIframe): un window finto.
if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1 };
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(f => existsSync(f) && /\.\w+$/.test(f)) || base; };
const disegna = async (componente, props, esportato = 'default') => {
  try {
    const pacchetto = await build({
      stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server.browser'; import * as M from ${J(qui('../src/components/' + componente))}; export const disegna = (p) => renderToStaticMarkup(React.createElement(M[${J(esportato)}], p));`, resolveDir: qui('.'), loader: 'js' },
      bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent', loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'alias', setup(b) { b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) })); } }],
    });
    const P = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
    return P.disegna(props).replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
  } catch (e) { return `ERRORE ${String(e && e.message).slice(0, 300)}`; }
};
{
  const testo = await disegna('giacenze/SituazioneTable.jsx', { righe: G.righe, totali: G.totali, onVaiDaDichiarare: () => {} });
  verifica('Giacenze: la riga di T-Cycle dice 30,00 t «per noi chiuse: giro chiuso»', /30,00 t per noi chiuse: giro chiuso/.test(testo), testo.slice(0, 200));
  verifica('Giacenze: il deposito «di cui 8,00 t per noi chiuse», Nappi Sud le sue 25,00 t come prima', /12,00 t di cui 8,00 t per noi chiuse/.test(testo) && /25,00 t/.test(testo));
  verifica('Giacenze: il totale resta 67,00 t, «di cui 38,00 t per noi chiuse»', /67,00 t di cui 38,00 t per noi chiuse/.test(testo));
  verifica('Giacenze: nessun NaN o undefined a video', !/NaN|undefined/.test(testo), (testo.match(/.{40}(NaN|undefined).{40}/) || [])[0]);
}
{
  const testo = await disegna('dichiarazioni/Stoccaggi.jsx', { stoccaggi: R.stoccaggi });
  verifica('scheda Stoccaggi: «30,00 t attribuite dal portale allo stoccaggio, ma per noi chiuse: TECNOGUM SRL sulla rete non dichiara a SMOCO»',
    /30,00 t attribuite dal portale allo stoccaggio, ma per noi chiuse: TECNOGUM SRL sulla rete non dichiara a SMOCO\. Nessuna dichiarazione le chiuderà/.test(testo), testo.slice(0, 300));
  verifica('scheda Stoccaggi: il deposito dice le 4,00 t ancora in piazzale', /8,00 t attribuite dal portale allo stoccaggio, ma per noi chiuse: TECNOGUM SRL sulla rete non dichiara a SMOCO\. Le altre 4,00 t che il portale attribuisce allo stoccaggio sono ancora in piazzale\./.test(testo));
  verifica('scheda Stoccaggi: verso Tecnogum «per noi un giro chiuso», non piu\' «non glielo paghiamo»', /TECNOGUM SRL \d[\d.,]* t · per noi un giro chiuso: sulla rete non dichiara a SMOCO/.test(testo) && !/non glielo paghiamo/.test(testo));
}
{
  const testo = await disegna('dichiarazioni/Quadratura.jsx', { dati: R });
  verifica('Quadratura: il deposito, 8,00 t per noi chiuse e le altre 4,00 t ancora in piazzale', /8,00 t attribuite dal portale allo stoccaggio, ma per noi chiuse: TECNOGUM SRL sulla rete non dichiara a SMOCO/.test(testo) && /le altre 4,00 t che il portale attribuisce allo stoccaggio sono ancora in piazzale/.test(testo), testo.slice(0, 300));
  verifica('Quadratura: Nappi Sud come prima, 25,00 t gia\' partite in attesa dell\'impianto', /25,00 t gia' partite che il portale attribuisce ancora allo stoccaggio, finche' l'impianto non dichiara/.test(testo));
}
{
  const tcy = (R.siti || []).find(s => s.tipo_destinazione !== 'stoc' && norm(s.sito) === norm(TCY));
  const fr = tcy && tcy.flussi.find(f => f.canale === 'RETE');
  const testo = await disegna('dichiarazioni/StoriaRiga.jsx', { stoccaggio: fr && fr.stoccaggio_stesso_sito, sfondo: '' }, 'RigheStoccaggio');
  verifica('le righe della storia: «per noi un giro chiuso: TECNOGUM SRL sulla rete non dichiara a SMOCO»', /ripartito in secondaria verso TECNOGUM SRL per noi un giro chiuso: TECNOGUM SRL sulla rete non dichiara a SMOCO/.test(testo), testo.slice(0, 300));
}

console.log('4. SUI DATI VERI');
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) console.log(`  nessuna copia dei dati veri in ${CARTELLA}: sezione saltata`);
else {
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copie[copie.length - 1])).toString('utf8'));
  const ORA = DATI.meta.letto_fino_al;
  const ANNO = Number(String(ORA).slice(0, 4));
  for (const k of Object.keys(ARCHIVI)) delete ARCHIVI[k];
  Object.assign(ARCHIVI, DATI.archivi);
  const Gv = await conOra(ORA, () => giacenze({ anno: ANNO }));
  const Rv = await conOra(ORA, () => riepilogo({ anno: ANNO }));
  if (ANNO === 2026) {
    const PERCHE = 'attribuite dal portale allo stoccaggio, ma per noi chiuse: TECNOGUM SRL sulla rete non dichiara a SMOCO';
    const tg = rigaG(Gv, TCY), tr = stocR(Rv, TCY);
    verifica('T-Cycle: le 181,299 t del portale restano, e sono per noi chiuse in tutti e due i moduli',
      tg.in_attesa_dichiarazione_t === 181.299 && tr.in_attesa_portale_t === 181.299 && tg.in_attesa_chiusa_t === 181.299 && tr.in_attesa_chiusa_t === 181.299 && tg.in_attesa_chiusa_perche === PERCHE && tr.in_attesa_chiusa_perche === PERCHE,
      J([tg.in_attesa_dichiarazione_t, tg.in_attesa_chiusa_t, tr.in_attesa_portale_t, tr.in_attesa_chiusa_t]));
    const ng = rigaG(Gv, 'NAPPI SUD SRL'), nr = stocR(Rv, 'NAPPI SUD SRL');
    verifica('Nappi Sud manda a Irigom e a Tecnogum: le sue 860,099 t restano un\'attesa', ng.in_attesa_dichiarazione_t === 860.099 && ng.in_attesa_chiusa_t === undefined && nr.in_attesa_chiusa_t === undefined, J([ng.in_attesa_dichiarazione_t, ng.in_attesa_chiusa_t]));
    verifica('il totale della colonna resta 1.041,398 t, e accanto le 181,299 per noi chiuse', Gv.totali.in_attesa_dichiarazione_t === 1041.398 && Gv.totali.in_attesa_chiusa_t === 181.299, J([Gv.totali.in_attesa_dichiarazione_t, Gv.totali.in_attesa_chiusa_t]));
    // Ogni stoccaggio, lo stesso numero chiuso nei due moduli.
    const diversi = (Gv.righe || []).filter(r => r.tipo_destinazione === 'stoc').filter(r => (r.in_attesa_chiusa_t || null) !== (stocR(Rv, r.sito).in_attesa_chiusa_t || null));
    verifica('ogni stoccaggio: lo stesso numero chiuso nelle Giacenze e nelle Dichiarazioni', !diversi.length, J(diversi.map(r => r.sito)));
    const tcy = (Rv.siti || []).find(s => s.tipo_destinazione !== 'stoc' && /T-CYCLE/.test(s.sito));
    const fr = tcy && tcy.flussi.find(f => f.canale === 'RETE');
    verifica('il racconto di T-Cycle: le 181,299 t del file del 09/10/2026 per noi chiuse, e niente «in attesa di una dichiarazione»',
      fr && fr.racconto.some(f => f.startsWith('Le 181,299 t del file degli ordini non dichiarati del 09/10/2026 sono attribuite dal portale allo stoccaggio, ma per noi chiuse: TECNOGUM SRL sulla rete non dichiara a SMOCO.'))
      && !fr.racconto.some(f => /in attesa di una dichiarazione/.test(f)), J(fr && fr.racconto));
  } else verifica('la copia dei dati veri e\' del 2026', false, String(ANNO));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
