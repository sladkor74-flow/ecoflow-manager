// LA PAGINA DELLA DASHBOARD (src/pages/Dashboard.jsx e src/components/dashboard,
// migliorie dell'11/10/2026).
//
// Chiesto dall'utente: «sistema meglio anche il modulo dashboard, permetti gli
// alert a scomparsa e rendilo piu' professionale ed esaustivo sulla commessa».
//
// 1. Le richieste all'apertura: la pagina chiama solo cruscottoOperativo,
//    getDashboardRaccolta e, per l'amministratore e con l'anno scelto,
//    calcolaMargine. Non piu' getDashboardStats (tolta) ne' il pannello dei
//    target (checkTargetAlerts), e la chiusura del mese si scarica e si legge
//    solo quando si apre.
// 2. I numeri a video sono quelli delle funzioni: le sezioni si disegnano con
//    React lato server su un quadro fatto da quadroCommessa.ts, e il testo deve
//    dire al carattere i numeri del kpi, all'italiana; senza contratto «—», mai
//    «0%» o «su 0 t». La pagina intera si disegna senza dati, e a chi non e'
//    amministratore non mostra economia ne' euro.
// 3. Le voci non si ripetono, quelle del margine sono solo dell'amministratore,
//    e le critiche nascoste restano nel conteggio.
// 4. Il PDF del quadro: niente euro senza «con l'economia» (e mai a chi non e'
//    amministratore), «—» per un valore che manca, i canali mai sommati.
// 5. Nella pagina degli alert ogni riga dice dove si corregge, col collegamento.
// 6. Nel sorgente: niente title= per le spiegazioni (non si vedono sul
//    telefono), niente .toFixed, localStorage solo in src/lib/avvisiNascosti.js,
//    nessuna parola della piattaforma a video.
// Revisione delle migliorie (11/10/2026), i rilievi dei revisori: le province
// ferme sono quelle senza ritiri negli ultimi due mesi finiti; un anno chiuso si
// misura al 31/12 e le regioni dicono il perche' vero; l'attiva di un anno
// senza documenti e' una nota, non dodici «da elaborare»; la quadratura ha
// l'etichetta e il numero di Dichiarazioni Impianti; «Controlli automatici»
// conta le voci dei presidi e del guardiano dovunque stiano, e il suo segno le mostra.
// npm run prove
import { build } from 'esbuild';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as Q from '../base44/shared/quadroCommessa.ts';
import { attesoAllaData, targetAnnuoDellAnno } from '../base44/shared/attesoContratto.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const sorgente = (p) => (existsSync(qui('../' + p)) ? readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '') : '');
const CARTELLA = 'src/components/dashboard/';
// I file della dashboard; la chiusura del mese ha la sua prova (chiusuraMesePannello).
const FILE = existsSync(qui('../' + CARTELLA)) ? readdirSync(qui('../' + CARTELLA)).filter(f => /\.(jsx?|ts)$/.test(f) && f !== 'ChiusuraMese.jsx').map(f => CARTELLA + f) : [];
const pagina = sorgente('src/pages/Dashboard.jsx');
const componenti = FILE.map(f => [f, sorgente(f)]);

console.log('1. LE RICHIESTE ALL\'APERTURA');
const chiamate = (testo) => [...testo.matchAll(/functions\.invoke\(\s*'([^']+)'/g)].map(m => m[1]);
verifica('la pagina chiama solo cruscottoOperativo, getDashboardRaccolta e calcolaMargine', J([...new Set(chiamate(pagina))].sort()) === J(['calcolaMargine', 'cruscottoOperativo', 'getDashboardRaccolta']), J(chiamate(pagina)));
verifica('nessun componente della dashboard (fuori dalla chiusura) chiama una funzione da se\'', componenti.every(([, s]) => chiamate(s).length === 0), componenti.filter(([, s]) => chiamate(s).length).map(([f]) => f).join());
const tutto = pagina + componenti.map(([, s]) => s).join('\n');
const senzaCommenti = (x) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const ripetuti = /getDashboardStats|checkTargetAlerts|AlertBadge|TargetAlertsPanel/;
verifica('mai getDashboardStats ne\' checkTargetAlerts, niente badge in alto', !ripetuti.test(senzaCommenti(tutto)), (senzaCommenti(tutto).match(/.{0,60}(getDashboardStats|checkTargetAlerts|AlertBadge|TargetAlertsPanel).{0,40}/) || [])[0]);
verifica('la funzione getDashboardStats non c\'e\' piu\'', !existsSync(qui('../base44/functions/getDashboardStats/entry.ts')));
verifica('il margine si chiede con l\'anno scelto, e solo per l\'amministratore', /invoke\('calcolaMargine', \{ anno \}\)/.test(pagina) && /const prontoPerMargine = isAdmin && /.test(pagina) && /if \(!prontoPerMargine\) return undefined;/.test(pagina), '');
verifica('e parte dopo che cruscotto e quadro hanno risposto', /prontoPerMargine = isAdmin && !!\(cruscotto \|\| erroreCruscotto\) && !!raccoltaPronta/.test(pagina));
verifica('la sezione Economia esiste solo per l\'amministratore', /\{isAdmin && <SezioneEconomia/.test(pagina) && !/<SezioneEconomia/.test(pagina.replace(/\{isAdmin && <SezioneEconomia/, '')));
verifica('la chiusura del mese si scarica pigra e si monta solo da aperta', /const ChiusuraMese = lazy\(\(\) => import\('@\/components\/dashboard\/ChiusuraMese'\)\)/.test(pagina)
  && /\{!chiusuraAperta \? \([\s\S]*?\) : \([\s\S]*?<ChiusuraMese isAdmin=\{isAdmin\} anno=\{anno\} \/>/.test(pagina)
  && /useState\(false\);\s*const meseLavoro/.test(pagina), '');
verifica('un anno solo, dall\'indirizzo, scelto fra gli anni del giorno italiano', /anniDaScegliere\(\{ dal: 2025, dopo: 1, oggi \}\)/.test(pagina) && /params\.get\('anno'\)/.test(pagina) && /getDashboardRaccolta', \{ anno: \[anno\] \}/.test(pagina));

console.log('2. I NUMERI A VIDEO SONO QUELLI DELLE FUNZIONI');
// Il pacchetto: le sezioni vere, React lato server, il client finto.
const CLIENT_FINTO = 'export const base44 = { functions: { invoke: async (n) => { (globalThis.__CHIESTE = globalThis.__CHIESTE || []).push(n); return { data: {} }; } } };';
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(f => existsSync(f) && !/[\\/]$/.test(f) && /\.\w+$/.test(f)) || base; };
const nomi = ['QuadroInBreve', 'SezioneRete', 'SezioneAci', 'SezioneExtra', 'SezioneImpianti', 'SezioneFatturazione', 'SezioneEconomia', 'FreschezzaDati', 'DaGestire'];
const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { MemoryRouter } from 'react-router-dom';
${nomi.map(n => `import ${n} from ${JSON.stringify(qui(`../src/components/dashboard/${n}.jsx`))};`).join('\n')}
export * as voci from ${JSON.stringify(qui('../src/components/dashboard/vociDashboard.js'))};
export * as pdf from ${JSON.stringify(qui('../src/components/dashboard/esportaQuadro.js'))};
export * as avvisi from ${JSON.stringify(qui('../src/lib/avvisiNascosti.js'))};
import Dashboard from ${JSON.stringify(qui('../src/pages/Dashboard.jsx'))};
const C = { ${nomi.join(', ')}, Dashboard };
export const componenti = C;
export const disegna = (nome, props, indirizzo = '/') => renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [indirizzo] }, React.createElement(C[nome], props)));
`;
// Chi guarda: lo decide la prova (globalThis.__UTENTE).
const AUTH_FINTO = 'export const useAuth = () => ({ user: globalThis.__UTENTE || null });';
let L = null;
try {
  const pacchetto = await build({
    stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.jsx': 'jsx', '.js': 'jsx' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'finti', setup(b) {
      b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'client-finto' }));
      b.onResolve({ filter: /^@\/lib\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'client-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'client-finto' }, (a) => ({ contents: a.path === 'auth' ? AUTH_FINTO : CLIENT_FINTO, loader: 'js' }));
      b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) }));
    } }],
  });
  if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }) };
  L = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
} catch (e) { verifica('le sezioni della dashboard si impacchettano e si caricano', false, String(e && e.message).slice(0, 400)); }

// Il caso vero dell'11/10/2026 (prove/quadroCommessa.mjs): profilo rivisto del
// contratto 2026, target 11.550 t, raccolto 8.818,55 t, dati fino all'08/10.
const PROFILO = [851.29, 915.48, 868.47, 932.55, 1053.85, 1100, 1100, 550, 1050, 1100, 1100, 950];
const contratto = { anno: 2026, target_annuo_t: 11550, target_mensile_json: J(PROFILO), target_prezzo_regioni_json: J([{ regione: 'Puglia', target_t: 400, prezzo: 95 }, { regione: 'Calabria', target_t: 250, prezzo: 95 }]) };
const kpiDi = (commessa, anno, giorno, raccolto, aci = 102.85, extra = 31.4) => {
  const t = targetAnnuoDellAnno(commessa, anno);
  const a = attesoAllaData(commessa, anno, giorno);
  return {
    raccolto_rete_anno: raccolto, raccolto_aci_anno: aci, raccolto_extra_anno: extra, previsione_aci: commessa ? 650 : 0,
    target: t.t, raggiungimento_pct: t.t ? (raccolto / t.t) * 100 : null,
    atteso: t.t === null || a.atteso_t === null ? null : { giorno, atteso_t: a.atteso_t, pct: (a.atteso_t / t.t) * 100, scarto_t: raccolto - a.atteso_t },
    target_ripiego: t.fonte === 'ripiego' ? [anno] : [], target_da_confermare: t.da_confermare ? [anno] : [],
  };
};
let n = 0;
const T = (g) => `${g}T10:00:00Z`;
const riga = (tr, prov, kg, g) => ({ id: 'p' + (++n), id_ordine: 'P' + n, stato: 'terminato', provincia: prov, trasportatore: tr, peso_effettivo: kg, ordine_immesso_il: T(g), trasporto_iniziato_il: T(g), trasporto_finito_il: T(g) });
const RETE = [riga('SMOCO SRL', 'NA', 10000, '2026-01-10'), riga('ALFA SRL', 'BA', 5000, '2026-09-10')];
const ACI = [riga('DEMOLIZIONI SUD', 'BA', 2500, '2026-03-02')];
const quadroDi = (anno, oggi, giorno, commessa, raccolto) => Q.quadroCommessa({
  anno, oggi, giornoDati: giorno, commessa, kpi: kpiDi(commessa, anno, giorno, raccolto), fonteTarget: commessa ? 'contratto' : null,
  rete: RETE, reteAnno: RETE, aciAnno: ACI, extraAnno: [], targetVsRaccolto: [], conRiparto: false, raccoltoPerRegione: {}, mensili: [], annui: [], senzaFine: 0,
});
const q26 = quadroDi(2026, '2026-10-11', '2026-10-08', contratto, 8818.55);
const q27 = quadroDi(2027, '2027-03-10', '2027-03-08', null, 900);
const disegna = (nome, props, indirizzo) => { try { return L ? L.disegna(nome, props, indirizzo) : ''; } catch (e) { verifica(`${nome} si disegna`, false, String(e && e.message).slice(0, 300)); return ''; } };
// Le tonnellate all'italiana, scritte qui per conto loro: due decimali, tre se i
// chili non sono tondi, il punto per le migliaia.
const tIt = (v) => { let [i, d] = (Math.round(Math.abs(v) * 1000) / 1000).toFixed(3).split('.'); while (d.length > 2 && d.endsWith('0')) d = d.slice(0, -1); return `${v < 0 ? '-' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d} t`; };
const testo = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');

const tessere = testo(disegna('QuadroInBreve', { quadro: q26, impianti: null, annoInCorso: true, caricamento: false, onVai: () => {} }));
verifica('la tessera della rete: 76,4% e 8.818,55 t su 11.550,00 t (kpi.raggiungimento_pct, raccolto, target)', tessere.includes('76,4%') && tessere.includes('8.818,55 t su 11.550,00 t'), tessere.slice(0, 400));
verifica('l\'atteso al giorno dei dati e lo scarto a parole: «atteso al 08/10: 75,2% · ▲ avanti di 129,319 t»', tessere.includes('atteso al 08/10: 75,2%') && tessere.includes('avanti di 129,319 t'), tessere.slice(0, 500));
verifica('ACI ed extra a parte, coi loro numeri: 102,85 t su 650,00 t indicative, 31,40 t', tessere.includes('102,85 t') && tessere.includes('previsione indicativa di 650,00 t') && tessere.includes('31,40 t') && tessere.includes('non si somma alla rete'), tessere);
verifica('nessuna tessera che sommi i canali (8.818,55 + 102,85 + 31,40 = 8.952,80)', !tessere.includes('8.952,8') && !/totale/i.test(tessere));

const rete26 = testo(disegna('SezioneRete', { quadro: q26, arretrato: { totale: 12, entro_30: 8, da_31_a_60: 3, oltre_60: 1, piu_vecchio: { id_ordine: 'P9', ragione_sociale: 'GOMME SRL', provincia: 'NA', giorni: 75 } }, annoInCorso: true, daGestire: 2, onDaGestire: () => {} }));
const R = q26.rete;
for (const [nome, v] of [['target', tIt(R.target_t)], ['raccolto', tIt(R.raccolto_t)], ['atteso', tIt(R.atteso.atteso_t)], ['scarto', `avanti di ${tIt(R.atteso.scarto_t)}`], ['residuo', tIt(R.residuo_t)], ['proiezione', tIt(R.proiezione.t)], ['ritmo', `${tIt(R.ritmo.servono_t_mese)} al mese`]]) {
  verifica(`la sezione Rete dice il ${nome} del quadro: ${v}`, rete26.includes(v), rete26.slice(0, 600));
}
verifica('la proiezione e il ritmo si spiegano al tocco, non in title=', /Da dove viene questo numero/.test(disegna('SezioneRete', { quadro: q26, arretrato: null, annoInCorso: true })) && !/\stitle="/.test(disegna('SezioneRete', { quadro: q26, arretrato: null, annoInCorso: true })));
verifica('il segno «2 da gestire» porta alle voci della sezione', rete26.includes('2 da gestire'));
verifica('gli ordini aperti della rete sono quelli di oggi (cruscotto)', rete26.includes('12 aperti') && rete26.includes('1 oltre 60'));

const rete27 = testo(disegna('SezioneRete', { quadro: q27, arretrato: null, annoInCorso: true }));
const tess27 = testo(disegna('QuadroInBreve', { quadro: q27, impianti: null, annoInCorso: true, caricamento: false, onVai: () => {} }));
verifica('il 2027 senza contratto: «—» e «contratto non inserito», mai «0,0%» ne\' «su 0»', tess27.includes('contratto non inserito') && !/0,0%|su 0,00 t/.test(tess27 + rete27) && /Target annuo del contratto — /.test(rete27), tess27);
verifica('e lo dice nel mese per mese', rete27.includes('Il contratto Ecotyre del 2027 non è inserito in Target & Status'));

// Le province ferme: senza ritiri negli ultimi due mesi finiti (revisione delle
// migliorie, 11/10/2026). L'11/10 sono agosto e settembre: NA ha l'ultimo ritiro
// a gennaio, BA a settembre. Prima erano «due mesi a zero di fila» in qualunque
// momento dell'anno, e BA (zero da gennaio ad agosto) risultava ferma.
const ferme26 = (rete26.match(/Province ferme.*?Terminati Rete/) || [''])[0];
verifica('«Una provincia senza ritiri da agosto: NA (Campania), l\'ultimo ritiro il 10/01/2026»; BA no', ferme26.includes('Una provincia senza ritiri da agosto') && ferme26.includes('NA (Campania), l\'ultimo ritiro il 10/01/2026') && !ferme26.includes('BA'), ferme26);

// Un anno chiuso si misura al 31/12 (revisione delle migliorie, 11/10/2026): il
// 2025 guardato l'11/10/2026, coi dati fino all'08/10/2026, diceva «Atteso al
// 08/10» su un numero che e' il target intero, e «senza ritiri dell'anno» alle
// regioni di un anno con 11.101,57 t raccolte e un contratto senza riparto.
const c25 = { anno: 2025, target_annuo_t: 11200 };
const q25 = Q.quadroCommessa({
  anno: 2025, oggi: '2026-10-11', giornoDati: '2026-10-08', commessa: c25, kpi: kpiDi(c25, 2025, '2026-10-08', 11101.57), fonteTarget: 'contratto',
  rete: [], reteAnno: [], aciAnno: [], extraAnno: [], conRiparto: false, raccoltoPerRegione: { Puglia: 5000, Campania: 6101.57 }, mensili: [], annui: [], senzaFine: 0,
  // senza riparto, come lo scrive getDashboardRaccolta: le regioni col solo raccolto
  targetVsRaccolto: [{ regione: 'Campania', target: null, atteso: null, raccolto: 6101.57 }, { regione: 'Puglia', target: null, atteso: null, raccolto: 5000 }],
});
const rete25 = testo(disegna('SezioneRete', { quadro: q25, arretrato: null, annoInCorso: false }));
const tess25 = testo(disegna('QuadroInBreve', { quadro: q25, impianti: null, annoInCorso: false, caricamento: false, onVai: () => {} }));
verifica('il 2025: «Atteso al 31/12» e «atteso al 31/12», mai il giorno dei dati del 2026', rete25.includes('Atteso al 31/12 11.200,00 t') && tess25.includes('atteso al 31/12: 100,0%') && !/al 08\/10/.test(rete25 + tess25), (rete25.match(/.{0,40}al 08\/10.{0,40}/) || [rete25.slice(0, 300)])[0]);
verifica('i raccoglitori «sul loro target al 31/12»', rete25.includes('Raccoglitori sul loro target al 31/12'), (rete25.match(/Raccoglitori sul loro target[^.]{0,30}/) || [''])[0]);
verifica('le regioni: il perche\' vero, il contratto senza riparto, non «senza ritiri dell\'anno»', rete25.includes('il contratto Ecotyre del 2025 non ha il riparto per regione') && !rete25.includes('senza ritiri dell\'anno non c\'è ancora'), (rete25.match(/Lo scarto per regione[^.]+\./) || [''])[0]);
// Il 2025 vero non ha un contratto: ha un target di ripiego (11.200 t, nessuna
// CommessaEcotyre del 2025 sulla copia dei dati veri dell'11/10/2026). Il perche'
// delle regioni diceva «il contratto Ecotyre del 2025 non ha il riparto», cioe'
// dava al contratto una mancanza: la causa vera e' che il contratto non c'e'
// (revisione delle migliorie, 12/10/2026).
const q25r = Q.quadroCommessa({
  anno: 2025, oggi: '2026-10-11', giornoDati: '2026-10-08', commessa: null, fonteTarget: 'ripiego',
  kpi: { ...kpiDi(c25, 2025, '2026-10-08', 11101.57), target_ripiego: [2025] },
  rete: [], reteAnno: [], aciAnno: [], extraAnno: [], conRiparto: false, raccoltoPerRegione: { Puglia: 5000, Campania: 6101.57 }, mensili: [], annui: [], senzaFine: 0,
  targetVsRaccolto: [{ regione: 'Campania', target: null, atteso: null, raccolto: 6101.57 }, { regione: 'Puglia', target: null, atteso: null, raccolto: 5000 }],
});
const rete25r = testo(disegna('SezioneRete', { quadro: q25r, arretrato: null, annoInCorso: false }));
const regioni25r = (rete25r.match(/Lo scarto per regione[^.]+\./) || [''])[0];
verifica('il 2025 col target di ripiego: le regioni dicono «target di ripiego», non un contratto del 2025 che non c\'e\'', q25r.rete.ripiego === true && /il 2025 ha un target di ripiego/.test(regioni25r) && /senza contratto non c'è un riparto per regione/.test(regioni25r) && !/contratto Ecotyre del 2025 non ha/.test(rete25r), regioni25r);

const aci = testo(disegna('SezioneAci', { quadro: q26, arretrato: null, annoInCorso: false }));
verifica('ACI: raccolto, previsione indicativa e la regione dalla provincia (Puglia 2,50 t su 400,00 t)', aci.includes('102,85 t') && aci.includes('650,00 t') && /Puglia 400,00 t 2,50 t/.test(aci), aci.slice(0, 500));

// La quadratura e' quella di Dichiarazioni Impianti (revisione delle migliorie,
// 11/10/2026): impianti e stoccaggi della rete con una giacenza a portale, l'ACI
// degli stoccaggi a parte. Qui 5 righe della rete, una non quadra; lo stoccaggio
// lo si dice.
const imp = { stato: 'fresca', perche: '', giorno: '2026-10-11', eta_giorni: 0, con_confronto: 5, quadrano: 4,
  scostamenti: [{ sito: 'Gatim', scarto_t: 1.2, calcolata_t: 261.62, portale_t: 260.42, stoccaggio: false }], aci_stoccaggi: { con_confronto: 1, quadrano: 1 },
  da_dichiarare: { RETE: { t: 914.46, impianti: 2 }, ACI: { t: 1.2, impianti: 1 }, EXTRA_RACCOLTA: { t: 0.4, impianti: 1 } }, sotto_zero: [{ sito: 'Gatim', canale: 'ACI', giacenza_t: -3.5 }], doppioni: 0,
  caricati_dopo: [{ tipo_file: 'primarie', nome: 'Primarie e assegnati', il: '2026-10-11' }] };
const impianti = testo(disegna('SezioneImpianti', { impianti: imp, annoInCorso: true, anno: 2026 }));
verifica('Impianti: 4 su 5 quadrano, da dichiarare per canale come la notte l\'ha scritto, mai sommato', impianti.includes('4 su 5') && impianti.includes('914,46 t') && impianti.includes('1,20 t') && impianti.includes('0,40 t') && !impianti.includes('916,06'), impianti.slice(0, 600));
verifica('la quadratura con l\'etichetta di Dichiarazioni Impianti, «Rete: quadratura con il portale», e l\'ACI degli stoccaggi a parte', impianti.includes('Rete: quadratura con il portale 4 su 5') && impianti.includes('ACI negli stoccaggi, a parte: 1 su 1'), impianti.slice(0, 600));
const conStoccaggio = testo(disegna('SezioneImpianti', { impianti: { ...imp, scostamenti: [...imp.scostamenti, { sito: 'NAPPI SUD SRL', scarto_t: -2.5, calcolata_t: 23.38, portale_t: 25.88, stoccaggio: true }] }, annoInCorso: true, anno: 2026 }));
verifica('chi non quadra ed e\' uno stoccaggio si dice stoccaggio', conStoccaggio.includes('NAPPI SUD SRL (stoccaggio)') && conStoccaggio.includes('2 da verificare'), conStoccaggio.slice(0, 700));
const tessImp = testo(disegna('QuadroInBreve', { quadro: q26, impianti: imp, annoInCorso: true, caricamento: false, onVai: () => {} }));
verifica('la tessera degli impianti dice lo stesso: «4 su 5 rete: quadratura con il portale»', tessImp.includes('4 su 5') && tessImp.includes('rete: quadratura con il portale') && !tessImp.includes('impianti che quadrano'), tessImp);
verifica('la giacenza sotto zero a parte, e i file entrati dopo la notte', impianti.includes('giacenza sotto zero') && impianti.includes('Dopo il controllo della notte sono stati caricati: Primarie e assegnati (11/10)'));
const impPassato = testo(disegna('SezioneImpianti', { impianti: imp, annoInCorso: false, anno: 2025 }));
verifica('per un anno chiuso la quadratura della notte non si mostra', !impPassato.includes('4 su 5') && impPassato.includes('per il 2025 si guarda Giacenze'));

const fatt = testo(disegna('SezioneFatturazione', { mesi: [{ mese: 'Settembre', etichetta: 'Settembre', canali: { RETE: { elaborato: true, chiuso: true }, ACI: { elaborato: true, chiuso: false }, EXTRA_RACCOLTA: { elaborato: false, chiuso: false } }, prefattura: false }], anno: 2026 }));
verifica('la fatturazione: uno stato per canale, a parole', fatt.includes('Rete: chiusa') && fatt.includes('ACI: elaborata') && fatt.includes('Extra raccolta: da elaborare') && !/€/.test(fatt), fatt);
// Un anno passato senza documenti (il 2025, fatturato prima del gestionale): la
// nota, non dodici «da elaborare» (revisione delle migliorie, 11/10/2026).
const nota25 = 'Nessun documento della fatturazione attiva del 2025 nel gestionale: i mesi fatturati prima del gestionale non si elaborano qui.';
const fatt25 = testo(disegna('SezioneFatturazione', { mesi: [], nota: nota25, anno: 2025 }));
verifica('il 2025 senza documenti: la nota, nessun «da elaborare», nessun «nessun mese finito»', fatt25.includes(nota25) && !fatt25.includes('da elaborare') && !fatt25.includes('Nessun mese finito'), fatt25);

const archiviFresc = { archivi: [{ tipo_file: 'primarie', nome: 'Primarie e assegnati', il: '2026-10-09', fino_al: '2026-10-08', fino_al_cosa: 'la fine trasporto dei terminati', giorni_fa: 2 }] };
const V0 = L ? L.voci : {};
const riassunto = (voci) => (typeof V0.riassuntoControlli === 'function' ? V0.riassuntoControlli(voci) : undefined);
const fresc = testo(disegna('FreschezzaDati', { caricamenti: archiviFresc, controlli: riassunto([]) }));
verifica('la freschezza: due date, e i controlli della notte', fresc.includes('09/10/2026') && fresc.includes('08/10/2026') && fresc.includes('tutti regolari'), fresc.slice(-200));

// I CONTROLLI AUTOMATICI DICONO QUELLO CHE DICE DA GESTIRE (revisione delle
// migliorie, 11/10/2026). Un'identita' rotta e' un presidio della sezione
// impianti; il guardiano fermo senza la riga del suo lavoro e' una voce del
// cruscotto (Manutenzione), non un presidio. Prima: il primo era «1 lavoro da
// guardare» e il segno portava a Da gestire filtrato sui «dati», vuoto; il
// secondo non si contava, e accanto a «non gira da 4 giorni» c'era «tutti regolari».
{
  const identita = { area: 'Giacenze', gravita: 'critico', titolo: 'Un\'identità fra moduli si è rotta: Giacenze 275,08 t, Dichiarazioni 154,22 t', dettaglio: 'Irigom, rete', link: '/giacenze', chiave: 'invariante:giacenze_uguali', sezione: 'impianti', origine: 'presidi', ecotyna: false };
  const guardiano = { area: 'Manutenzione', gravita: 'info', titolo: 'Il controllo notturno non gira da 4 giorni', dettaglio: 'x', link: '/giacenze', chiave: 'lavoro:riepilogoDichiarazioni', sezione: 'dati', ecotyna: false };
  const altra = { area: 'Arretrato', gravita: 'attenzione', titolo: 'Rete: 1 ordini aperti da oltre 60 giorni', dettaglio: '', link: '/assegnati', chiave: 'arretrato:RETE', sezione: 'rete' };
  const voci = [identita, guardiano, altra];
  const r = riassunto(voci);
  verifica('il riassunto conta le voci dei controlli dovunque stiano: 2, un\'identita\' rotta e un lavoro, una critica', r && r.quante === 2 && r.identita === 1 && r.lavori === 1 && r.critiche === 1, J(r));
  // Il filtro che il segno «N da gestire» dei controlli passa davvero, toccandolo.
  const filtroDelSegno = (props) => {
    let filtro;
    const visita = (e) => {
      if (!e || typeof e !== 'object') return;
      if (Array.isArray(e)) { e.forEach(visita); return; }
      if (e.props && typeof e.props.onApri === 'function' && 'quante' in e.props) e.props.onApri();
      if (e.props) visita(e.props.children);
    };
    try { visita(L.componenti.FreschezzaDati({ ...props, onDaGestire: (f) => { filtro = f; } })); } catch (e) { verifica('FreschezzaDati si legge', false, String(e && e.message)); }
    return filtro;
  };
  const props = { caricamenti: archiviFresc, controlli: r, daGestire: 0 };
  const riga = testo(disegna('FreschezzaDati', props)).match(/Controlli automatici:.*/)?.[0] || '';
  verifica('«Controlli automatici: 1 identità fra moduli rotta · 1 lavoro pianificato che non riesce», 2 da gestire', riga.includes('1 identità fra moduli rotta · 1 lavoro pianificato che non riesce') && riga.includes('2 da gestire'), riga);
  verifica('mai «tutti regolari» accanto al guardiano fermo, e l\'identita\' rotta non e\' un «lavoro»', !riga.includes('tutti regolari') && !/lavoro da guardare|lavori da guardare/.test(riga), riga);
  const filtro = filtroDelSegno(props);
  const lista = testo(disegna('DaGestire', { visibili: voci.map(v => ({ voce: v, tornata: null })), nascoste: [], filtro, aperto: true, onApri() {}, onNascondi() {}, onRimetti() {}, onRimettiTutte() {}, onTogliFiltro() {} }));
  verifica('il segno porta a Da gestire filtrato sui controlli: l\'identita\' rotta (impianti) e il guardiano (dati), non le altre', filtro !== undefined && filtro !== null && lista.includes('Solo Controlli automatici') && lista.includes('identità fra moduli si è rotta') && lista.includes('non gira da 4 giorni') && !lista.includes('ordini aperti da oltre 60'), `${J(filtro)} ${lista.slice(0, 400)}`);
  const soloGuardiano = testo(disegna('FreschezzaDati', { caricamenti: archiviFresc, controlli: riassunto([guardiano]) })).match(/Controlli automatici:.*/)?.[0] || '';
  verifica('il guardiano fermo da solo: si conta, niente «tutti regolari»', soloGuardiano.includes('1 lavoro pianificato che non riesce') && !soloGuardiano.includes('tutti regolari'), soloGuardiano);
  const inLettura = testo(disegna('FreschezzaDati', { caricamenti: archiviFresc, controlli: null })).match(/Controlli automatici:.*/)?.[0] || '';
  verifica('finche\' il cruscotto non risponde non si sa: «—», non «tutti regolari»', inLettura.includes('—') && !inLettura.includes('tutti regolari'), inLettura);
  const maiScritto = testo(disegna('FreschezzaDati', { caricamenti: archiviFresc, controlli: riassunto([]), notteAssente: true })).match(/Controlli automatici:.*/)?.[0] || '';
  verifica('se il controllo della notte non ha mai scritto, lo si dice', maiScritto.includes('non ha ancora scritto niente') && !maiScritto.includes('tutti regolari'), maiScritto);
  verifica('la pagina passa a FreschezzaDati il riassunto delle voci, non i soli presidi', /controlli=\{cruscotto \? riassuntoControlli\(voci\) : null\}/.test(pagina) && !/contaPresidi/.test(pagina));
}

const eco = testo(disegna('SezioneEconomia', { margine: { anno: 2026, canali: [{ canale: 'RETE', anno: { margine: 1234.5, margine_pct: 12.3, tonnellate: 100, ricavo: 10000, costo: 8765.5, ricavo_t: 100, costo_t: 87.655, margine_t: 12.345 } }] }, anno: 2026 }));
verifica('l\'economia: euro all\'italiana, due decimali', eco.includes('€ 1.234,50') && eco.includes('€ 8.765,50') && eco.includes('visibile solo all\'amministratore'), eco);

// La pagina intera, al primo disegno (prima delle risposte): non si rompe senza
// dati, e l'economia c'e' solo per l'amministratore.
{
  globalThis.__UTENTE = { id: 'u1', email: 'a@b.it', role: 'admin' };
  const admin = testo(disegna('Dashboard', {}, '/?anno=2025'));
  globalThis.__UTENTE = { id: 'u2', email: 'c@d.it', role: 'user' };
  const altro = testo(disegna('Dashboard', {}));
  globalThis.__UTENTE = null;
  const annoOggi = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric' }).format(new Date()));
  verifica('la pagina si apre senza dati: intestazione, indice, Da gestire, chiusura del mese chiusa', admin.includes('Commessa Ecotyre 2025') && admin.includes('SMOCO Srl, partner operativo') && admin.includes('Da gestire') && admin.includes('Chiusura del mese, 2025') && altro.includes('I passi di fine mese'), admin.slice(0, 400));
  verifica('l\'anno dall\'indirizzo; senza, quello in corso in Italia', admin.includes('Commessa Ecotyre 2025') && altro.includes(`Commessa Ecotyre ${annoOggi}`));
  verifica('l\'amministratore ha l\'economia nell\'indice e la casella del PDF', admin.includes('Economia') && admin.includes('con l\'economia'));
  verifica('chi non e\' amministratore no: niente economia, niente casella, niente euro', !/Economia|con l'economia|€/.test(altro), (altro.match(/.{0,40}(Economia|€).{0,40}/) || [])[0]);
  verifica('al primo disegno nessuna chiamata: le letture partono dagli effetti', !(globalThis.__CHIESTE || []).length, J(globalThis.__CHIESTE));
}

console.log('3. LE VOCI DI «DA GESTIRE»');
const V = L ? L.voci : null;
const margine = { anno: 2026, canali: [{ canale: 'RETE', mesi: [{ mese: 'Settembre', righe_senza_prezzo: 3, anomalie_passiva: 1 }] }] };
verifica('le voci del margine solo per l\'amministratore', V && V.vociDalMargine(margine, false).length === 0 && V.vociDalMargine(margine, true).length === 2);
verifica('col loro anno nel titolo, la chiave e la sezione', V && J(V.vociDalMargine(margine, true).map(v => [v.titolo, v.chiave, v.sezione])) === J([['Rete, Settembre 2026: 3 righe senza tariffa', 'margine:RETE:2026:Settembre:senza-tariffa', 'fatturazione'], ['Rete, Settembre 2026: 1 anomalia in passiva', 'passiva:RETE:2026:Settembre', 'economia']]), V && J(V.vociDalMargine(margine, true)));
const dalCruscotto = [
  { area: 'Alert', gravita: 'attenzione', titolo: '2 alert aperti', dettaglio: '', link: '/alert-engine', chiave: 'alert:altri', sezione: 'generale' },
  { area: 'Arretrato', gravita: 'attenzione', titolo: 'Rete: 1 ordini aperti da oltre 60 giorni', dettaglio: '', link: '/assegnati', chiave: 'arretrato:RETE', sezione: 'rete' },
];
const unite = V ? V.unisciVoci(dalCruscotto, V.vociDalMargine(margine, true), dalCruscotto, V.vociDalMargine(margine, true)) : [];
verifica('le voci non si ripetono: una risposta doppia non raddoppia l\'elenco', unite.length === 4 && new Set(unite.map(v => v.chiave)).size === 4, J(unite.map(v => v.chiave)));
verifica('e si mettono in fila per gravita\'', unite[0] && unite[0].gravita === 'critico');
verifica('il segno di una sezione conta le sue voci', V && V.contaPerSezione(unite, 'rete') === 1 && V.contaPerSezione(unite, 'fatturazione') === 1);
// Le critiche nascoste restano nel conteggio del pannello.
const A = L ? L.avvisi : null;
const critica = { area: 'Qualifica fornitori', gravita: 'critico', titolo: '3 documenti scaduti, 0 non conformi', dettaglio: 'Alfa', link: '/qualifica-fornitori', chiave: 'qualifica:scaduti', sezione: 'generale', ecotyna: true };
const presidio = { area: 'Manutenzione', gravita: 'attenzione', titolo: 'Il controllo delle qualifiche non riesce da 2 giorni lavorativi', dettaglio: 'x', link: '/qualifica-fornitori', chiave: 'lavoro:controlloQualifiche', sezione: 'dati', origine: 'presidi', ecotyna: false };
const s = A ? A.smista([critica, presidio, ...dalCruscotto], [A.nascondi(critica, '2026-10-11', { giorni: 7 })], '2026-10-11') : { visibili: [], nascoste: [] };
const pannello = testo(disegna('DaGestire', { visibili: s.visibili, nascoste: s.nascoste, filtro: null, aperto: true, onApri() {}, onNascondi() {}, onRimetti() {}, onRimettiTutte() {}, onTogliFiltro() {} }));
verifica('una critica nascosta resta nel conteggio: «1 critici», «1 nascosto (1 critico fino a stasera)»', pannello.includes('1 critici') && pannello.includes('1 nascosto (1 critico fino a stasera)'), pannello.slice(0, 300));
verifica('e si nasconde solo per oggi', A && A.nascondi(critica, '2026-10-11', { giorni: 7 }).fino_al === '2026-10-11');
const conEcotyna = disegna('DaGestire', { visibili: [{ voce: { ...dalCruscotto[0], ecotyna: true }, tornata: null }, { voce: presidio, tornata: null }], nascoste: [], filtro: null, aperto: true, onApri() {}, onNascondi() {}, onRimetti() {}, onRimettiTutte() {}, onTogliFiltro() {} });
verifica('un pulsante «Chiedi a EcoTyna» per la voce degli alert, nessuno per il presidio', (conEcotyna.match(/Chiedi a EcoTyna/g) || []).length === 1 && conEcotyna.includes('/assistente?domanda='), String((conEcotyna.match(/Chiedi a EcoTyna/g) || []).length));
const filtrato = testo(disegna('DaGestire', { visibili: s.visibili, nascoste: s.nascoste, filtro: 'rete', aperto: true, onApri() {}, onNascondi() {}, onRimetti() {}, onRimettiTutte() {}, onTogliFiltro() {} }));
verifica('filtrato sulla rete mostra solo le sue voci, col chip per togliere il filtro', filtrato.includes('Solo Rete') && filtrato.includes('ordini aperti da oltre 60 giorni') && !filtrato.includes('2 alert aperti'), filtrato.slice(0, 300));
const chiuso = testo(disegna('DaGestire', { visibili: s.visibili, nascoste: s.nascoste, filtro: null, aperto: false, onApri() {}, onNascondi() {}, onRimetti() {}, onRimettiTutte() {}, onTogliFiltro() {} }));
verifica('chiuso, resta la sola riga dei conteggi', chiuso.includes('1 critici') && !chiuso.includes('2 alert aperti'), chiuso);

console.log('4. IL PDF DEL QUADRO');
const P = L ? L.pdf : null;
const celle = (a) => (a ? [a.titolo, a.sottotitolo, ...a.riepilogo.flatMap(r => [r.etichetta, String(r.valore)]), ...a.sezioni.flatMap(s => [s.titolo, ...s.colonne.map(c => c.titolo), ...s.righe.flatMap(r => r.celle.map(String))]), ...a.note].join(' | ') : '');
const marg = { anno: 2026, canali: [{ canale: 'RETE', anno: { margine: 1234.5, margine_pct: 12.3, tonnellate: 100, ricavo: 10000, costo: 8765.5, ricavo_t: 100, costo_t: 87.655, margine_t: 12.345 } }] };
const base = { quadro: q26, impianti: imp, annoInCorso: true, mesiAttiva: [{ mese: 'Settembre', etichetta: 'Settembre', canali: { RETE: { elaborato: true, chiuso: true }, ACI: { elaborato: false }, EXTRA_RACCOLTA: { elaborato: false } }, prefattura: true }], margine: marg };
const senzaEco = P ? P.argomentiQuadroPdf({ ...base, conEconomia: false, isAdmin: true }) : null;
const conEco = P ? P.argomentiQuadroPdf({ ...base, conEconomia: true, isAdmin: true }) : null;
const nonAdmin = P ? P.argomentiQuadroPdf({ ...base, conEconomia: true, isAdmin: false }) : null;
verifica('senza «con l\'economia» nessun euro, margine, costo o ricavo', senzaEco && !/€|margine|costo|ricavo/i.test(celle(senzaEco)) && !senzaEco.sezioni.some(s => s.colonne.some(c => c.tipo === 'euro')), celle(senzaEco).match(/.{0,40}(€|margine|costo|ricavo).{0,40}/i)?.[0]);
verifica('con l\'economia, per l\'amministratore, la sezione c\'e\'', conEco && conEco.sezioni.some(s => /Economia/.test(s.titolo) && s.colonne.some(c => c.tipo === 'euro')));
verifica('a chi non e\' amministratore mai, anche se la casella arrivasse accesa', nonAdmin && !nonAdmin.sezioni.some(s => s.colonne.some(c => c.tipo === 'euro')) && !/margine|costo|ricavo/i.test(celle(nonAdmin)));
verifica('il nome del file e il titolo', senzaEco && senzaEco.nomeFile === 'Quadro commessa Ecotyre 2026 - dati al 08-10-2026' && senzaEco.titolo === 'Commessa Ecotyre 2026 — SMOCO Srl, partner operativo' && senzaEco.titoloNote === 'Come si leggono questi numeri', senzaEco && J([senzaEco.nomeFile, senzaEco.titolo]));
verifica('Da gestire non va nel PDF', senzaEco && !/da gestire/i.test(celle(senzaEco)));
verifica('le tonnellate all\'italiana e i numeri del quadro', senzaEco && senzaEco.riepilogo[0].valore === '8.818,55 t' && senzaEco.riepilogo[1].valore === '76,4%', senzaEco && J(senzaEco.riepilogo));
const pdf27 = P ? P.argomentiQuadroPdf({ quadro: q27, annoInCorso: true }) : null;
const target27 = pdf27 && pdf27.sezioni.find(s => /Rete — regioni/.test(s.titolo)).righe.find(r => r.stile === 'totale');
verifica('un valore che manca esce «—», non vuoto ne\' zero', target27 && target27.celle[1] === '—' && pdf27.riepilogo[1].valore === '—' && pdf27.sezioni[0].righe[0].celle[1] === '—', target27 && J(target27));
verifica('nessuna riga, colonna o riquadro somma i canali', senzaEco && !/totale (dei canali|commessa|generale)|rete \+ aci/i.test(celle(senzaEco)) && senzaEco.sezioni.every(s => !(s.colonne.some(c => /^Rete$/.test(c.titolo)) && s.colonne.some(c => /totale/i.test(c.titolo)))));
verifica('nel PDF niente frecce che il suo carattere non ha', senzaEco && !/[▲▼]/.test(celle(senzaEco)), celle(senzaEco).match(/.{0,30}[▲▼].{0,30}/)?.[0]);
// Revisione delle migliorie (11/10/2026): la quadratura con l'etichetta e il
// numero di Dichiarazioni Impianti, l'ACI degli stoccaggi a parte.
const rq = (a, etichetta) => (a ? (a.riepilogo.find(r => r.etichetta === etichetta) || {}).valore : undefined);
verifica('nel PDF «Rete: quadratura con il portale 4 su 5» e l\'ACI degli stoccaggi a parte, 1 su 1', rq(senzaEco, 'Rete: quadratura con il portale') === '4 su 5' && rq(senzaEco, 'ACI negli stoccaggi, a parte: quadratura con il portale') === '1 su 1', senzaEco && J(senzaEco.riepilogo));
// Il 2025: atteso al 31/12, e l'attiva senza documenti detta nella nota, senza
// dodici righe «da elaborare».
const pdf25 = P ? P.argomentiQuadroPdf({ quadro: { ...q25, mesi_attiva: [], mesi_attiva_nota: nota25 }, annoInCorso: false, mesiAttiva: [] }) : null;
verifica('PDF del 2025: «scarto sull\'atteso al 31/12» e la colonna «Atteso al 31/12», mai «atteso al 08/10»', pdf25 && pdf25.riepilogo.some(r => r.etichetta === 'Rete: scarto sull\'atteso al 31/12') && pdf25.sezioni.some(s => s.colonne.some(c => c.titolo === 'Atteso al 31/12')) && !/atteso al 08\/10/i.test(celle(pdf25)), pdf25 && (celle(pdf25).match(/.{0,40}tteso al \d\d\/\d\d.{0,20}/) || [])[0]);
verifica('e la nota dell\'atteso dice l\'anno intero', pdf25 && pdf25.note.some(x => x.includes('per l\'anno intero: il 2025 è chiuso, e l\'atteso al 31/12 è il target.')), pdf25 && J(pdf25.note[2]));
verifica('PDF del 2025: nessuna riga «da elaborare», la nota della fatturazione attiva', pdf25 && !/da elaborare/.test(celle(pdf25)) && pdf25.note.includes(`Fatturazione attiva: ${nota25}`), pdf25 && J(pdf25.note.slice(-2)));

console.log('5. NELLA PAGINA DEGLI ALERT, DOVE SI CORREGGE');
{
  let D = null;
  try { D = await import('../src/lib/doveSiRisolve.js'); } catch (e) { verifica('src/lib/doveSiRisolve.js si carica', false, String(e && e.message)); }
  if (D) {
    verifica('un avviso dei target porta all\'Andamento dell\'anno del suo mese', J(D.doveSiRisolve({ modulo: 'primarie_rete', entity_type: 'TargetMensile', record_id: 'ALFA SRL|Campania|Settembre|2026' })) === J({ link: '/target-status?tab=andamento&anno=2026', nome: 'Target & Status, Andamento 2026' }));
    verifica('le date e le tratte al modulo dei movimenti', D.doveSiRisolve({ modulo: 'secondarie', entity_type: 'Secondaria' }).link === '/secondarie' && D.doveSiRisolve({ modulo: 'primarie_aci' }).link === '/primarie-aci');
    verifica('le verifiche dei report e i file del caricamento al loro posto', D.doveSiRisolve({ modulo: 'verifiche', entity_type: 'VerificaReport' }).link === '/verifiche' && D.doveSiRisolve({ modulo: 'manutenzione', entity_type: 'UploadLog' }).link === '/caricamento-dati');
    verifica('un modulo che non si conosce: nessun collegamento inventato', D.doveSiRisolve({ modulo: 'altro' }) === null);
    verifica('il modulo col suo nome, non col codice', D.nomeModuloAlert('primarie_rete') === 'Terminati Rete' && D.nomeModuloAlert('nuovo_modulo') === 'nuovo modulo');
  }
  const pannelloAlert = sorgente('src/components/alerts/AlertsPanel.jsx');
  verifica('il pannello degli alert mostra «Si corregge in ...» col collegamento, e il nome del modulo', /Si corregge in \{doveSiRisolve\(a\)\.nome\}/.test(pannelloAlert) && /<Link to=\{doveSiRisolve\(a\)\.link\}/.test(pannelloAlert) && /\{nomeModuloAlert\(a\.modulo\)\}/.test(pannelloAlert) && !/· \{a\.modulo\}/.test(pannelloAlert));
}

console.log('6. NEL SORGENTE');
const nuovi = componenti.filter(([f]) => f !== CARTELLA + 'ChiusuraMese.jsx');
verifica('nessun title= per le spiegazioni: si aprono al tocco (Perche)', nuovi.every(([, s]) => !/\stitle=["{]/.test(s)) && !/\stitle=["{]/.test(pagina), nuovi.filter(([, s]) => /\stitle=["{]/.test(s)).map(([f]) => f).join());
verifica('nessun .toFixed( per mostrare numeri', nuovi.every(([, s]) => !s.includes('.toFixed(')) && !pagina.includes('.toFixed('));
verifica('localStorage solo in src/lib/avvisiNascosti.js, sempre dentro try', !/localStorage/.test(pagina) && nuovi.every(([, s]) => !/localStorage/.test(s)) && (sorgente('src/lib/avvisiNascosti.js').match(/localStorage\.\w+\(/g) || []).length === 2
  && /try \{\s*const testo = globalThis\.localStorage\.getItem/.test(sorgente('src/lib/avvisiNascosti.js')) && /try \{\s*const m = memoria \|\| memoriaVuota\(\);\s*globalThis\.localStorage\.setItem/.test(sorgente('src/lib/avvisiNascosti.js')));
const aVideo = [tessere, rete26, rete27, aci, impianti, fatt, fresc, eco, pannello].join(' ');
verifica('nessuna parola della piattaforma a video', aVideo.length > 1000 && !/base44/i.test(aVideo));
verifica('nessuna parola della piattaforma nei testi dei sorgenti (fuori dagli import)', ![pagina, ...nuovi.map(([, s]) => s)].some(s => /base44/i.test(s.replace(/^import .*$/gm, '').replace(/base44\.functions\.invoke/g, '').replace(/\/\/.*$/gm, ''))));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
