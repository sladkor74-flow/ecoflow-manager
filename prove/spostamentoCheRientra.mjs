// LO SPOSTAMENTO FRA LE RIGHE DELL'ACI CHE RIENTRA (seconda revisione del
// 13/10/2026).
//
// Sull'ACI di un impianto ci sono due righe, primaria e secondaria, e la giacenza
// a fine mese si chiude sul canale come il «Da dichiarare»: se le dichiarazioni
// di una riga coprono piu' di quello che vi e' arrivato, l'eccesso si toglie dai
// carichi piu' vecchi dell'altra (giacenzaAFineMeseDelCanale). Lo spostamento
// dura finche' la riga in eccesso non riceve arrivi suoi. Il caso del revisore,
// sulla copia dei dati veri: Gatim ACI d'aprile scritta 10.000 kg in primaria e
// 12.540 in secondaria invece di 8.200 e 14.340, e settembre non ancora caricato.
// Lo spostamento va da aprile ad agosto; a settembre gli arrivi della primaria
// lo riassorbono, la colonna toglie l'eccesso dal settembre della primaria e la
// secondaria conta ancora le sue 1,80 t d'aprile. Ma:
//   - il racconto diceva solo il primo mese, e come un fatto: «a fine aprile 1,80
//     t di questa riga risultano uscite con la dichiarazione dell'altra riga», e
//     due frasi dopo «oggi restano 1,80 t di aprile»;
//   - la primaria diceva che l'eccesso «esce dai carichi piu' vecchi dell'altra
//     riga», mentre la colonna lo toglie dal suo settembre;
//   - a settembre la secondaria passa da 0 a 14,62 t con 12,82 arrivate, la
//     primaria da 0 a 10,55 con 12,35: al tocco non si apriva niente.
// Nessun numero dei conti cambia: si prova che la storia dice quello che dicono
// i numeri. Parte costruita sempre, parte sui dati veri se la copia c'e'.
//
// IL PERCHE' DELLA FINE E' LO STESSO SU TUTTE E DUE LE RIGHE (revisione finale
// del 13/10/2026). Sulla riga che cedeva il perche' dipendeva solo dalla sua
// giacenza: con la secondaria che a settembre dichiara anche le sue 1,80 t
// d'aprile (la correzione naturale dell'errore) la sua giacenza e' 0, e diceva
// «su questa riga non resta niente da cui toglierlo» mentre la primaria diceva
// che i suoi arrivi lo riassorbono e che le tonnellate «tornano nella sua
// giacenza» (rientro_e_dichiarato.mjs e rientro_e_dichiarato_veri.mjs del
// revisore). Ora il perche' lo decide la riga che era in eccesso, e sulla riga
// che cedeva lo dice la giacenza del canale a fine mese, che
// riepilogoDichiarazioni mette sul mese (`giacenza_canale_fine_kg`); se la riga
// ha dichiarato lei le tonnellate che le tornano, lo dice. Sezioni 4 e 5, e il
// caso sui dati veri della sezione 6.
// npm run prove
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as STORIA from '../base44/shared/storiaDichiarazioni.ts';
import { MESI } from '../base44/shared/dichiarazioniImpianti.ts';
import { caricaLibPagine } from './dati/libPagine.mjs';

const { giacenzaAFineMeseDelCanale, raccontoDellaRiga } = STORIA;

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const zeri = () => new Array(12).fill(0);
const dodici = (pezzi) => { const a = zeri(); for (const [i, v] of Object.entries(pezzi)) a[Number(i)] = v; return a; };
const S = await caricaLibPagine('lib/storiaRiepilogo');
// La regola del tocco e' quella della pagina; se manca (il codice di prima) si
// ripiega su quella di prima, cosi' la prova lo dice verifica per verifica.
const siApre = (m, prima) => (typeof S.fineMeseDaSpiegare === 'function' ? S.fineMeseDaSpiegare(m, prima) : !!(m.caricato_kg > 0 || m.spostato_dal_canale_kg));
// Come finisce uno spostamento, nel racconto e al tocco: se manca (il codice di
// prima) la verifica fallisce invece di fermare la prova.
const MANCA = () => ({ manca: true });
const comeFinisceRacconto = typeof STORIA.comeFinisceLoSpostamento === 'function' ? STORIA.comeFinisceLoSpostamento : MANCA;
const comeFinisceTocco = typeof S.comeFinisceLoSpostamento === 'function' ? S.comeFinisceLoSpostamento : MANCA;
// La giacenza del canale a fine mese dove riepilogoDichiarazioni la mette
// (revisione finale del 13/10/2026): sul mese con uno spostamento e su quello
// dopo, le righe insieme.
const delCanale = (c, k, i) => {
  const somma = c.fine.some(f => f[i] === null || f[i] === undefined) ? null : c.fine.reduce((s, f) => s + f[i], 0);
  return somma !== null && (c.spostato[k][i] || (i > 0 && c.spostato[k][i - 1])) ? { giacenza_canale_fine_kg: somma } : {};
};

// La pagina disegnata (react-dom/server): la riga della giacenza a fine mese.
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(f => existsSync(f) && /\.\w+$/.test(f)) || base; };
let P = { disegna: () => '' };
try {
  const pacchetto = await build({
    stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server.browser'; import { RigaGiacenzaFineMese } from ${J(qui('../src/components/dichiarazioni/StoriaRiga.jsx'))}; export const disegna = (flusso) => renderToStaticMarkup(React.createElement('table', null, React.createElement('tbody', null, React.createElement(RigaGiacenzaFineMese, { flusso, nonDovuta: false, sfondo: '' }))));`, resolveDir: qui('.'), loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent', loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'alias', setup(b) { b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) })); } }],
  });
  P = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
} catch (e) { verifica('la riga della giacenza a fine mese si disegna', false, String(e && e.message).slice(0, 300)); }
// I mesi che al tocco si aprono, dalla pagina disegnata.
const mesiCheSiAprono = (flusso) => [...P.disegna(flusso).matchAll(/aria-label="Giacenza a fine ([a-z]+): da dove viene"/g)].map(x => x[1]);

// I tre controlli dello script del revisore (aci_spostato_che_torna.mjs), con la
// regola vera del tocco al posto della sua approssimazione (caricato > 0 o
// spostato diverso da zero).
function controlliDelRevisore(f, etichetta) {
  const difetti = [];
  for (let i = 1; i <= f.ultimo_mese; i++) {
    const m = f.mesi[i], p = f.mesi[i - 1];
    const atteso = p.giacenza_fine_kg + m.conferito_kg - m.caricato_kg;
    if (m.giacenza_fine_kg !== atteso) {
      // La giacenza non e' entrato meno caricato: al tocco si deve aprire, e
      // dire perche'.
      const frasi = siApre(m, p) ? S.percheFineMese(m, false, p) : [];
      if (!frasi.some(x => /chiusura sul canale|si chiudono insieme|Fino a fine/.test(x))) difetti.push(`${etichetta} ${m.mese}: ${m.giacenza_fine_kg - atteso} kg che nessuno spiega`);
    }
  }
  if (f.racconto.some(x => /risultano uscite/.test(x)) && !f.mesi.some(m => m.uscito_stimato)) difetti.push(`${etichetta}: il racconto dice «risultano uscite», la colonna no`);
  return difetti;
}

console.log('1. COSTRUITO: GATIM ACI, APRILE SULLA PROVENIENZA SBAGLIATA E SETTEMBRE NON CARICATO');
const CONF_P = dodici({ 3: 8200, 4: 7770, 5: 11340, 8: 12350 });
const CAR_P = dodici({ 3: 10000, 4: 7770, 5: 11340 });
const CONF_S = dodici({ 0: 27000, 2: 9820, 3: 14340, 4: 11900, 8: 12820 });
const CAR_S = dodici({ 0: 27000, 2: 9820, 3: 12540, 4: 11900 });
// La colonna «Da dichiarare» com'e' nella funzione vera (lo script del revisore):
// la primaria ha l'eccesso tolto dal suo settembre, la secondaria tiene aprile.
const RESTA_P = dodici({ 8: 10550 });
const RESTA_S = dodici({ 3: 1800, 8: 12820 });
const canale = giacenzaAFineMeseDelCanale([
  { partenzaKg: 0, conferito: CONF_P, caricato: CAR_P },
  { partenzaKg: 0, conferito: CONF_S, caricato: CAR_S },
], { ultimoMese: 9 });
verifica('i numeri del revisore: la primaria 0 fino ad agosto e 10.550 da settembre, la secondaria 0 e 14.620',
  J(canale.fine[0]) === J([0, 0, 0, 0, 0, 0, 0, 0, 10550, 10550, null, null]) && J(canale.fine[1]) === J([0, 0, 0, 0, 0, 0, 0, 0, 14620, 14620, null, null]), J(canale.fine));
verifica('e lo spostamento: +1.800 / -1.800 da aprile ad agosto, 0 da settembre',
  J(canale.spostato[0].slice(0, 10)) === J([0, 0, 0, 1800, 1800, 1800, 1800, 1800, 0, 0]) && J(canale.spostato[1].slice(0, 10)) === J([0, 0, 0, -1800, -1800, -1800, -1800, -1800, 0, 0]), J(canale.spostato));
// La riga com'e' nella risposta di riepilogoDichiarazioni, coi mesi della
// chiusura sul canale `c`, la giacenza del canale compresa.
const flussoDi = (c, provenienza, conferito, caricato, resta, k, altra) => {
  const mesi = MESI.map((mese, i) => ({
    mese, conferito_kg: conferito[i], caricato_kg: caricato[i], resta_kg: resta[i], uscito_kg: conferito[i] - resta[i], da_stoccaggi: [],
    uscito_stimato: provenienza === 'primaria' && i === 8,
    dichiarazione: caricato[i] ? { quantita_kg: caricato[i], caricata_inviata: true, caricata_il: '2026-09-21' } : null,
    giacenza_fine_kg: c.fine[k][i],
    ...(c.spostato[k][i] ? { spostato_dal_canale_kg: c.spostato[k][i] } : {}),
    ...delCanale(c, k, i),
  }));
  const racconto = raccontoDellaRiga({ anno: 2026, sito: 'Gatim', canale: 'ACI', provenienza, mesi,
    giacenza_fine_mese: mesi.map(m => m.giacenza_fine_kg), ultimo_mese: 9, righe_del_canale: 2, giacenza_canale_kg: c.fine.reduce((s, f) => s + f[9], 0), altre_provenienze: [altra] });
  return { provenienza, mesi, racconto, ultimo_mese: 9, giacenza_partenza_kg: 0 };
};
const flusso = (provenienza, conferito, caricato, resta, k, altra) => flussoDi(canale, provenienza, conferito, caricato, resta, k, altra);
const pri = flusso('primaria', CONF_P, CAR_P, RESTA_P, 0, 'secondaria');
const sec = flusso('secondaria', CONF_S, CAR_S, RESTA_S, 1, 'primaria');
{
  const tutto = [...pri.racconto, ...sec.racconto].join(' ');
  verifica('nessun «risultano uscite»: la colonna non toglie niente alla secondaria', !/risultano uscite/.test(tutto), tutto);
  verifica('la primaria dice il periodo dello spostamento: da fine aprile a fine agosto',
    pri.racconto.includes("Da fine aprile a fine agosto le dichiarazioni di questa riga avevano coperto 1,80 t più di quello che vi era arrivato, e l'eccesso si toglieva dai carichi più vecchi dell'altra riga dell'ACI (la secondaria): le righe di un canale si chiudono insieme, come la colonna «Da dichiarare» e le Giacenze."), J(pri.racconto));
  // Revisione finale del 13/10/2026: le tonnellate che tornano si dicono, e
  // dove vanno (la secondaria a settembre non le dichiara: nella sua giacenza).
  verifica('e come finisce: da settembre i suoi arrivi lo riassorbono, come la colonna che lo toglie dal suo settembre, e le 1,80 t tornano nella giacenza della secondaria',
    pri.racconto.includes("Da settembre gli arrivi di questa riga lo riassorbono: l'eccesso esce dai suoi carichi arrivati dopo, come nella colonna «Da dichiarare», e le 1,80 t tornano nella giacenza della secondaria."), J(pri.racconto));
  verifica('la giacenza del canale sta sui mesi dello spostamento e su quello dopo, e basta',
    J(pri.mesi.map(m => (m.giacenza_canale_fine_kg === undefined ? '-' : m.giacenza_canale_fine_kg))) === J(['-', '-', '-', 0, 0, 0, 0, 0, 25170, '-', '-', '-'])
      && J(sec.mesi.map(m => m.giacenza_canale_fine_kg)) === J(pri.mesi.map(m => m.giacenza_canale_fine_kg)), J(pri.mesi.map(m => m.giacenza_canale_fine_kg)));
  verifica('e il perche\' della fine e\' lo stesso sulle due righe: i suoi arrivi lo riassorbono',
    comeFinisceRacconto(pri.mesi[8], pri.mesi[7]).perche === 'riassorbito' && comeFinisceRacconto(sec.mesi[8], sec.mesi[7]).perche === 'riassorbito'
      && comeFinisceTocco(pri.mesi[8], pri.mesi[7]).perche === 'riassorbito' && comeFinisceTocco(sec.mesi[8], sec.mesi[7]).perche === 'riassorbito',
    J([comeFinisceRacconto(pri.mesi[8], pri.mesi[7]), comeFinisceRacconto(sec.mesi[8], sec.mesi[7])]));
  verifica('la primaria non dice piu\' che l\'eccesso «esce dai carichi più vecchi dell\'altra riga» come un fatto di oggi', !pri.racconto.some(x => /escono dai carichi più vecchi/.test(x)), J(pri.racconto));
  verifica('la secondaria dice il periodo: da fine aprile a fine agosto contava 1,80 t in meno',
    sec.racconto.includes("Da fine aprile a fine agosto la giacenza di questa riga contava 1,80 t in meno: le dichiarazioni dell'altra riga dell'ACI (la primaria) avevano coperto più di quello che vi era arrivato, e l'eccesso si toglieva dai carichi più vecchi di questa riga, perché le righe di un canale si chiudono insieme, come la colonna «Da dichiarare» e le Giacenze."), J(sec.racconto));
  verifica('e perche\' finisce: «da settembre gli arrivi della primaria lo riassorbono»',
    sec.racconto.includes('Da settembre gli arrivi della primaria lo riassorbono, e le 1,80 t tornano nella giacenza di questa riga.'), J(sec.racconto));
  const iRientro = sec.racconto.findIndex(x => /^Da settembre gli arrivi della primaria/.test(x));
  const iOggi = sec.racconto.findIndex(x => /^Oggi restano da dichiarare 14,62 t: 1,80 t di aprile e tutto settembre \(12,82 t\)/.test(x));
  verifica('e «oggi restano 1,80 t di aprile» viene dopo, coerente', iRientro >= 0 && iOggi > iRientro, J(sec.racconto));

  // Al tocco: settembre si apre e dice il rientro, su tutte e due le righe.
  const set = (f) => S.percheFineMese(f.mesi[8], false, f.mesi[7]);
  verifica('settembre della primaria si apre al tocco', siApre(pri.mesi[8], pri.mesi[7]) && mesiCheSiAprono(pri).includes('settembre'), J(mesiCheSiAprono(pri)));
  verifica('e dice perche\' 12,35 t arrivate fanno 10,55: le 1,80 t in eccesso ora le coprono i suoi arrivi',
    set(pri).includes('Fino a fine agosto le 1,80 t dichiarate su questa riga oltre quello che vi era arrivato si toglievano dai carichi di un\'altra riga dello stesso canale: da settembre le coprono gli arrivi di questa riga, come nella colonna «Da dichiarare».'), J(set(pri)));
  verifica('settembre della secondaria si apre al tocco', siApre(sec.mesi[8], sec.mesi[7]) && mesiCheSiAprono(sec).includes('settembre'), J(mesiCheSiAprono(sec)));
  verifica('e dice perche\' 12,82 t arrivate fanno 14,62: tornano le 1,80 t',
    set(sec).includes('Fino a fine agosto 1,80 t di questa riga si toglievano per le dichiarazioni di un\'altra riga dello stesso canale, che avevano coperto più di quello che vi era arrivato: da settembre le coprono gli arrivi di quella riga, e tornano nella giacenza di questa.'), J(set(sec)));
  verifica('ottobre, dove non cambia niente, resta un numero e basta', !mesiCheSiAprono(pri).includes('ottobre') && !mesiCheSiAprono(sec).includes('ottobre'));
  // Aprile: il numero non e' entrato meno caricato, e la prima frase non lo dice.
  const apr = S.percheFineMese(pri.mesi[3], false, pri.mesi[2]);
  verifica('aprile della primaria: «le dichiarazioni superano di 1,80 t quello che vi è entrato», non «è quello che è entrato meno...» e nessun -1,80',
    apr[0] === 'A fine aprile: 0,00 t in giacenza. Le dichiarazioni caricate su questa riga fino ad aprile superano di 1,80 t quello che vi è entrato: la differenza la fa la chiusura sul canale.' && !apr.some(x => /-1,80/.test(x)), J(apr));
  const aprS = S.percheFineMese(sec.mesi[3], false, sec.mesi[2]);
  verifica('aprile della secondaria: entrato meno caricato fa 1,80 t, e la chiusura le toglie',
    aprS[0] === 'A fine aprile: 0,00 t in giacenza. Quello che è entrato fino ad aprile meno le dichiarazioni caricate fino ad aprile, nella colonna in cui stanno, fa 1,80 t: la differenza la fa la chiusura sul canale.', J(aprS));
  const difetti = [...controlliDelRevisore(pri, 'primaria'), ...controlliDelRevisore(sec, 'secondaria')];
  verifica('i controlli dello script del revisore, con la regola vera del tocco: nessun punto in cui la storia dice una cosa e i numeri un\'altra', !difetti.length, difetti.join(' | '));
}

console.log('2. COSTRUITO: LO SPOSTAMENTO CHE FINISCE PERCHE\' IL CANALE VA SOTTO ZERO');
{
  // La secondaria assorbe ad aprile l'eccesso della primaria con il suo gennaio,
  // poi a maggio dichiara il suo gennaio: l'altra riga non ha piu' niente da
  // dare, e il canale va sotto zero. Non sono «gli arrivi» a chiudere lo
  // spostamento, e il racconto non lo deve dire.
  const c2 = giacenzaAFineMeseDelCanale([
    { partenzaKg: 0, conferito: dodici({ 3: 8200 }), caricato: dodici({ 3: 10000 }) },
    { partenzaKg: 0, conferito: dodici({ 0: 1800 }), caricato: dodici({ 4: 1800 }) },
  ], { ultimoMese: 9 });
  verifica('i numeri: la primaria 0 ad aprile e -1.800 da maggio, la secondaria 1.800 fino a marzo e poi 0',
    J(c2.fine[0].slice(0, 6)) === J([0, 0, 0, 0, -1800, -1800]) && J(c2.fine[1].slice(0, 6)) === J([1800, 1800, 1800, 0, 0, 0]) && J(c2.spostato[0].slice(0, 6)) === J([0, 0, 0, 1800, 0, 0]), `${J(c2.fine)} ${J(c2.spostato)}`);
  const mesiDi = (conferito, caricato, k) => MESI.map((mese, i) => ({ mese, conferito_kg: conferito[i], caricato_kg: caricato[i], resta_kg: 0, da_stoccaggi: [],
    dichiarazione: caricato[i] ? { quantita_kg: caricato[i], caricata_inviata: true, caricata_il: '2026-06-10' } : null,
    giacenza_fine_kg: c2.fine[k][i], ...(c2.spostato[k][i] ? { spostato_dal_canale_kg: c2.spostato[k][i] } : {}), ...delCanale(c2, k, i) }));
  const mp = mesiDi(dodici({ 3: 8200 }), dodici({ 3: 10000 }), 0);
  const ms = mesiDi(dodici({ 0: 1800 }), dodici({ 4: 1800 }), 1);
  const rp = raccontoDellaRiga({ anno: 2026, sito: 'Gatim', canale: 'ACI', provenienza: 'primaria', mesi: mp, giacenza_fine_mese: c2.fine[0], ultimo_mese: 9, righe_del_canale: 2, giacenza_canale_kg: -1800, altre_provenienze: ['secondaria'] });
  const rs = raccontoDellaRiga({ anno: 2026, sito: 'Gatim', canale: 'ACI', provenienza: 'secondaria', mesi: ms, giacenza_fine_mese: c2.fine[1], ultimo_mese: 9, righe_del_canale: 2, giacenza_canale_kg: -1800, altre_provenienze: ['primaria'] });
  // Revisione finale del 13/10/2026: le due righe dicono lo stesso perche' (la
  // secondaria a maggio ha dichiarato le sue 1,80 t, e alla primaria non resta
  // niente da cui toglierlo), e lo dicono tutte e due.
  verifica('la primaria: da maggio la secondaria non ha piu\' carichi, perche\' a maggio ha dichiarato le sue 1,80 t, e la giacenza va sotto zero: un errore',
    rp.includes("A fine aprile le dichiarazioni di questa riga avevano coperto 1,80 t più di quello che vi era arrivato, e l'eccesso si toglieva dai carichi più vecchi dell'altra riga dell'ACI (la secondaria): le righe di un canale si chiudono insieme, come la colonna «Da dichiarare» e le Giacenze.")
      && rp.includes('Da maggio la secondaria non ha più carichi da cui toglierlo, perché a maggio ha dichiarato le sue 1,80 t: la giacenza di questa riga va sotto zero, ed è un errore da correggere.') && !rp.some(x => /riassorbono/.test(x)), J(rp));
  verifica('la secondaria: da maggio su questa riga non resta niente da cui toglierlo, perche\' le ha dichiarate, e la primaria va sotto zero; nessun «riassorbono»',
    rs.includes('Da maggio su questa riga non resta niente da cui toglierlo, perché a maggio ha dichiarato le sue 1,80 t: la giacenza della primaria va sotto zero, ed è un errore da correggere.') && !rs.some(x => /riassorbono/.test(x)), J(rs));
  verifica('lo stesso perche\' sulle due righe, nel racconto e al tocco: senza carichi',
    [comeFinisceRacconto(mp[4], mp[3]), comeFinisceRacconto(ms[4], ms[3]), comeFinisceTocco(mp[4], mp[3]), comeFinisceTocco(ms[4], ms[3])].every(x => x.perche === 'senza_carichi' && x.dichiarato_kg === 1800),
    J([comeFinisceRacconto(mp[4], mp[3]), comeFinisceRacconto(ms[4], ms[3])]));
  const mag = S.percheFineMese(mp[4], false, mp[3]);
  verifica('e al tocco, a maggio della primaria: quella riga non ha piu\' carichi perche\' li ha dichiarati, la giacenza va sotto zero',
    siApre(mp[4], mp[3]) && mag.includes("Fino a fine aprile le 1,80 t dichiarate su questa riga oltre quello che vi era arrivato si toglievano dai carichi di un'altra riga dello stesso canale: a fine maggio quella riga non ha più carichi da cui toglierle, perché a maggio ha dichiarato le sue 1,80 t, e la giacenza va sotto zero. È un errore da correggere."), J(mag));
  const magS = S.percheFineMese(ms[4], false, ms[3]);
  verifica('e a maggio della secondaria: qui non resta niente perche\' le ha dichiarate, e la giacenza dell\'altra riga va sotto zero',
    siApre(ms[4], ms[3]) && magS.includes("Fino a fine aprile 1,80 t di questa riga si toglievano per le dichiarazioni di un'altra riga dello stesso canale: a fine maggio qui non resta niente da togliere, perché a maggio questa riga ha dichiarato le sue 1,80 t, e la giacenza dell'altra riga va sotto zero. È un errore da correggere."), J(magS));
}

console.log('3. COSTRUITO: UNO SPOSTAMENTO CHE CAMBIA DI MISURA');
{
  // Lo spostamento scende da 1.800 a 1.000 quando la primaria riceve 800 kg: il
  // mese si apre, e dice quanto era prima.
  const c3 = giacenzaAFineMeseDelCanale([
    { partenzaKg: 0, conferito: dodici({ 3: 8200, 5: 800 }), caricato: dodici({ 3: 10000 }) },
    { partenzaKg: 0, conferito: dodici({ 0: 5000 }), caricato: zeri() },
  ], { ultimoMese: 9 });
  verifica('i numeri: +1.800 ad aprile e maggio, +1.000 da giugno', J(c3.spostato[0].slice(0, 7)) === J([0, 0, 0, 1800, 1800, 1000, 1000]), J(c3.spostato[0]));
  const mesi = MESI.map((mese, i) => ({ mese, conferito_kg: [0, 0, 0, 8200, 0, 800][i] || 0, caricato_kg: i === 3 ? 10000 : 0, giacenza_fine_kg: c3.fine[0][i], ...(c3.spostato[0][i] ? { spostato_dal_canale_kg: c3.spostato[0][i] } : {}) }));
  const giu = S.percheFineMese(mesi[5], false, mesi[4]);
  verifica('giugno si apre e dice quanto era a fine maggio', siApre(mesi[5], mesi[4]) && giu.some(x => /le 1,00 t dichiarate su questa riga oltre quello che vi era arrivato si tolgono dai carichi più vecchi di un'altra riga dello stesso canale \(a fine maggio erano 1,80 t\)\.$/.test(x)), J(giu));
  const r3 = raccontoDellaRiga({ anno: 2026, sito: 'Gatim', canale: 'ACI', provenienza: 'primaria', mesi, giacenza_fine_mese: c3.fine[0], ultimo_mese: 9, righe_del_canale: 2, giacenza_canale_kg: 3200, altre_provenienze: ['secondaria'] });
  verifica('il racconto dice fin dove e\' arrivato', r3.some(x => x.startsWith("Da fine aprile le dichiarazioni di questa riga hanno coperto fino a 1,80 t più di quello che vi era arrivato, e l'eccesso si toglie dai carichi più vecchi dell'altra riga dell'ACI (la secondaria)")), J(r3));
}

// Le frasi che dicono un perche' diverso da «riassorbono», o le tonnellate che
// tornano in una giacenza dove non ci sono.
const NON_RESTA = /non resta niente da cui toglierlo|non resta niente da togliere|non ha più carichi/;
const IN_GIACENZA = /tornano nella (sua )?giacenza|tornano nella giacenza/;

console.log('4. COSTRUITO: IL RIENTRO NEL MESE IN CUI LA RIGA CHE CEDEVA DICHIARA LE SUE TONNELLATE');
{
  // Il rilievo della revisione finale del 13/10/2026 (rientro_e_dichiarato.mjs
  // del revisore): lo stesso Gatim, e a settembre la secondaria dichiara le sue
  // 12,82 t arrivate piu' le 1,80 t d'aprile, la correzione naturale
  // dell'errore. Lo spostamento finisce perche' gli arrivi della primaria lo
  // riassorbono: le due righe dicono lo stesso perche', e la secondaria dice che
  // le 1,80 t le ha dichiarate lei, non che «tornano nella sua giacenza» ne' che
  // «non resta niente da cui toglierlo».
  const caso = (setS) => {
    const carS = dodici({ 0: 27000, 2: 9820, 3: 12540, 4: 11900, 8: setS });
    const c = giacenzaAFineMeseDelCanale([{ partenzaKg: 0, conferito: CONF_P, caricato: CAR_P }, { partenzaKg: 0, conferito: CONF_S, caricato: carS }], { ultimoMese: 9 });
    const g = c.fine[1][8];
    return { c, p: flussoDi(c, 'primaria', CONF_P, CAR_P, RESTA_P, 0, 'secondaria'), s: flussoDi(c, 'secondaria', CONF_S, carS, dodici({ 8: g }), 1, 'primaria') };
  };
  const { c, p, s } = caso(14620);
  verifica('i numeri del revisore: la primaria 10.550 da settembre, la secondaria 0, lo spostamento ±1.800 da aprile ad agosto',
    J(c.fine[0]) === J([0, 0, 0, 0, 0, 0, 0, 0, 10550, 10550, null, null]) && J(c.fine[1]) === J([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null])
      && J(c.spostato[0].slice(0, 10)) === J([0, 0, 0, 1800, 1800, 1800, 1800, 1800, 0, 0]) && J(c.spostato[1].slice(0, 10)) === J([0, 0, 0, -1800, -1800, -1800, -1800, -1800, 0, 0]), `${J(c.fine)} ${J(c.spostato)}`);
  const fp = comeFinisceRacconto(p.mesi[8], p.mesi[7]), fs = comeFinisceRacconto(s.mesi[8], s.mesi[7]);
  verifica('come finisce, sulle due righe: riassorbito, e le 1,80 t le ha dichiarate la secondaria a settembre (la sua dichiarazione supera di 1,80 t i suoi arrivi)',
    fp.perche === 'riassorbito' && fs.perche === 'riassorbito' && fp.cedeva === false && fs.cedeva === true
      && fp.kg === 1800 && fs.kg === 1800 && fp.dichiarato_kg === 1800 && fs.dichiarato_kg === 1800 && fp.oltre_kg === 1800 && fs.oltre_kg === 1800, J([fp, fs]));
  verifica('la primaria: i suoi arrivi lo riassorbono, e le 1,80 t tornano alla secondaria, che a settembre le ha dichiarate',
    p.racconto.includes("Da settembre gli arrivi di questa riga lo riassorbono: l'eccesso esce dai suoi carichi arrivati dopo, come nella colonna «Da dichiarare», e le 1,80 t tornano alla secondaria, che a settembre le ha dichiarate."), J(p.racconto));
  verifica('la secondaria: gli arrivi della primaria lo riassorbono, e le 1,80 t le ha dichiarate lei a settembre',
    s.racconto.includes('Da settembre gli arrivi della primaria lo riassorbono, e le 1,80 t tornano a questa riga, che a settembre le ha dichiarate: la sua dichiarazione di settembre supera di 1,80 t quello che vi è arrivato nel mese.'), J(s.racconto));
  verifica('nessuna delle due dice «non resta niente», ne\' che le 1,80 t tornano in una giacenza',
    ![...p.racconto, ...s.racconto].some(x => NON_RESTA.test(x) || IN_GIACENZA.test(x)), J([...p.racconto, ...s.racconto].filter(x => NON_RESTA.test(x) || IN_GIACENZA.test(x))));
  // Al tocco, settembre: lo stesso perche' sulle due righe.
  const tp = S.percheFineMese(p.mesi[8], false, p.mesi[7]), ts = S.percheFineMese(s.mesi[8], false, s.mesi[7]);
  verifica('al tocco, settembre si apre sulle due righe', mesiCheSiAprono(p).includes('settembre') && mesiCheSiAprono(s).includes('settembre'), `${J(mesiCheSiAprono(p))} ${J(mesiCheSiAprono(s))}`);
  verifica('al tocco, la primaria: i suoi arrivi le coprono, e le 1,80 t tornano all\'altra riga, che a settembre le ha dichiarate',
    tp.includes("Fino a fine agosto le 1,80 t dichiarate su questa riga oltre quello che vi era arrivato si toglievano dai carichi di un'altra riga dello stesso canale: da settembre le coprono gli arrivi di questa riga, come nella colonna «Da dichiarare».")
      && tp.includes("Le 1,80 t tornano all'altra riga, che a settembre le ha dichiarate."), J(tp));
  verifica('al tocco, la secondaria: le coprono gli arrivi di quella riga, e le 1,80 t questa riga le ha dichiarate a settembre',
    ts.includes("Fino a fine agosto 1,80 t di questa riga si toglievano per le dichiarazioni di un'altra riga dello stesso canale, che avevano coperto più di quello che vi era arrivato: da settembre le coprono gli arrivi di quella riga, e le 1,80 t tornano a questa.")
      && ts.includes('A settembre questa riga le ha dichiarate: la sua dichiarazione supera di 1,80 t quello che vi è arrivato nel mese.'), J(ts));
  verifica('e al tocco nessuna delle due dice «non resta niente», ne\' che tornano in una giacenza', ![...tp, ...ts].some(x => NON_RESTA.test(x) || IN_GIACENZA.test(x)), J([...tp, ...ts]));
  const difetti = [...controlliDelRevisore(p, 'primaria'), ...controlliDelRevisore(s, 'secondaria')];
  verifica('i controlli dello script del revisore: nessun punto in cui la storia dice una cosa e i numeri un\'altra', !difetti.length, difetti.join(' | '));

  // Una parte sola: a settembre la secondaria dichiara 13,82 t, cioe' 1,00 t
  // d'aprile; le altre 0,80 restano nella sua giacenza.
  const q = caso(13820);
  verifica('una parte sola: la secondaria finisce settembre con 0,80 t', q.c.fine[1][8] === 800 && q.c.spostato[1][8] === 0, J(q.c.fine[1]));
  verifica('la primaria: le 1,80 t tornano alla secondaria, 1,00 t dichiarate a settembre e 0,80 t nella sua giacenza',
    q.p.racconto.includes("Da settembre gli arrivi di questa riga lo riassorbono: l'eccesso esce dai suoi carichi arrivati dopo, come nella colonna «Da dichiarare», e le 1,80 t tornano alla secondaria: 1,00 t le ha dichiarate a settembre, 0,80 t tornano nella sua giacenza."), J(q.p.racconto));
  verifica('la secondaria lo stesso, coi numeri della sua dichiarazione',
    q.s.racconto.includes('Da settembre gli arrivi della primaria lo riassorbono, e le 1,80 t tornano a questa riga: 1,00 t le copre la sua dichiarazione di settembre, che supera di 1,00 t quello che vi è arrivato nel mese, e 0,80 t tornano nella sua giacenza.'), J(q.s.racconto));
  verifica('e al tocco, sulle due righe',
    S.percheFineMese(q.p.mesi[8], false, q.p.mesi[7]).includes("Le 1,80 t tornano all'altra riga: 1,00 t le ha dichiarate a settembre, 0,80 t tornano nella sua giacenza.")
      && S.percheFineMese(q.s.mesi[8], false, q.s.mesi[7]).includes('A settembre questa riga ne ha dichiarate 1,00 t, perché la sua dichiarazione supera di 1,00 t quello che vi è arrivato nel mese; 0,80 t tornano nella sua giacenza.'),
    J([S.percheFineMese(q.p.mesi[8], false, q.p.mesi[7]), S.percheFineMese(q.s.mesi[8], false, q.s.mesi[7])]));
}

console.log('5. LA STESSA REGOLA NEL RACCONTO E AL TOCCO');
{
  // comeFinisceLoSpostamento e' scritta due volte, nel modulo condiviso (il
  // racconto) e nella libreria della pagina (il tocco): caso per caso, lo
  // stesso risultato.
  const casi = [];
  for (const spPrima of [1800, -1800, 0, 1000.4]) for (const sp of [0, 700]) for (const g of [0, 800, -1800, null, 14620]) for (const gPrima of [0, 500, null]) {
    for (const canale of [null, [-1000, 0], [0, 300], [14620, 0], [800, 0], ['solo mese', 0]]) {
      const m = { spostato_dal_canale_kg: sp, giacenza_fine_kg: g };
      const precedente = { spostato_dal_canale_kg: spPrima, giacenza_fine_kg: gPrima };
      if (Array.isArray(canale) && typeof g === 'number' && typeof gPrima === 'number') {
        if (canale[0] === 'solo mese') m.giacenza_canale_fine_kg = g;
        else { m.giacenza_canale_fine_kg = g + canale[0]; precedente.giacenza_canale_fine_kg = gPrima + canale[1]; }
      }
      casi.push([m, precedente]);
    }
  }
  casi.push([null, { spostato_dal_canale_kg: 1800, giacenza_fine_kg: 0 }], [{ giacenza_fine_kg: 0 }, null]);
  const diversi = casi.filter(([m, pr]) => J(comeFinisceRacconto(m, pr)) !== J(comeFinisceTocco(m, pr)));
  verifica(`${casi.length} casi: il racconto e il tocco decidono allo stesso modo`, typeof STORIA.comeFinisceLoSpostamento === 'function' && typeof S.comeFinisceLoSpostamento === 'function' && !diversi.length,
    J(diversi.slice(0, 3)));
  // E qualche caso letto a mano.
  verifica('uno spostamento che continua non e\' una fine', comeFinisceRacconto({ spostato_dal_canale_kg: 700, giacenza_fine_kg: 0 }, { spostato_dal_canale_kg: 1800, giacenza_fine_kg: 0 }) === null);
  verifica('la riga che cedeva senza la giacenza del canale e con 0: il perche\' non si sa, e non si dice',
    J(comeFinisceRacconto({ spostato_dal_canale_kg: 0, giacenza_fine_kg: 0 }, { spostato_dal_canale_kg: -1800, giacenza_fine_kg: 0 })) === J({ kg: 1800, cedeva: true, perche: null, oltre_kg: 1800, dichiarato_kg: 1800 }));
  verifica('la riga che cedeva con l\'altra ancora sotto zero: senza carichi',
    comeFinisceRacconto({ spostato_dal_canale_kg: 0, giacenza_fine_kg: 0, giacenza_canale_fine_kg: -1800 }, { spostato_dal_canale_kg: -1800, giacenza_fine_kg: 0, giacenza_canale_fine_kg: 0 }).perche === 'senza_carichi');
}

// ─────────────────────────────────────────────────────────────────────────────
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) {
  console.log(`Nessuna copia dei dati veri in ${CARTELLA}: la sezione 6 si salta.`);
} else {
  console.log('6. SUI DATI VERI: IL CASO DEL REVISORE');
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copie[copie.length - 1])).toString('utf8'));
  globalThis.__DATI_VERI = DATI.archivi;
  globalThis.__SCRITTE_DATI_VERI = [];
  const dv = readFileSync(qui('datiVeri.mjs'), 'utf8').replace(/\r/g, '');
  const SDK_FINTO = dv.slice(dv.indexOf('const SDK_FINTO = `') + 'const SDK_FINTO = `'.length, dv.indexOf('}`;') + 1);
  const f = await build({ entryPoints: [qui('../base44/functions/riepilogoDichiarazioni/entry.ts')], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    } }] });
  const M = await import('data:text/javascript;base64,' + Buffer.from(f.outputFiles[0].text).toString('base64'));
  const OraVera = Date;
  const ORA = DATI.meta.letto_fino_al;
  const ANNO = Number(String(ORA).slice(0, 4));
  const ms = OraVera.parse(ORA);
  const riepilogo = async (corpo) => {
    globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
    try { return await (await M.default({ json: async () => corpo })).json(); } finally { globalThis.Date = OraVera; }
  };
  if (ANNO !== 2026) console.log('  (la copia non e\' del 2026: il caso del revisore si salta)');
  else {
    // Le dichiarazioni cambiate solo per la durata della prova.
    const originali = DATI.archivi.DichiarazioneSito;
    const gatim = (r, mese, prov) => /gatim/i.test(r.sito || '') && r.canale === 'ACI' && Number(r.anno) === ANNO && r.mese === mese && (!prov || r.provenienza === prov);
    DATI.archivi.DichiarazioneSito = originali.map(r => (gatim(r, 'Aprile', 'primaria') ? { ...r, quantita_kg: 10000 } : gatim(r, 'Aprile', 'secondaria') ? { ...r, quantita_kg: 12540 } : gatim(r, 'Settembre') ? { ...r, caricata_inviata: false } : r));
    let R;
    try { R = await riepilogo({ anno: ANNO }); } finally { DATI.archivi.DichiarazioneSito = originali; }
    const s = R.siti.find(x => /gatim/i.test(x.sito) && x.tipo_destinazione !== 'stoc');
    const [p, q] = ['primaria', 'secondaria'].map(pr => s.flussi.find(x => x.canale === 'ACI' && x.provenienza === pr));
    verifica('i numeri sono quelli dello script del revisore: nessun conto cambia',
      J(p.mesi.map(m => m.giacenza_fine_kg)) === J([0, 0, 0, 0, 0, 0, 0, 0, 10550, 10550, null, null]) && J(q.mesi.map(m => m.giacenza_fine_kg)) === J([0, 0, 0, 0, 0, 0, 0, 0, 14620, 14620, null, null])
        && J(p.mesi.map(m => m.resta_kg)) === J(RESTA_P) && J(q.mesi.map(m => m.resta_kg)) === J(RESTA_S) && p.resta_t === 10.55 && q.resta_t === 14.62,
      `${J(p.mesi.map(m => m.giacenza_fine_kg))} ${J(q.mesi.map(m => m.resta_kg))}`);
    const difetti = [...controlliDelRevisore(p, 'primaria'), ...controlliDelRevisore(q, 'secondaria')];
    verifica('lo script del revisore, con la regola vera del tocco: nessun punto in cui la storia dice una cosa e i numeri un\'altra', !difetti.length, difetti.join(' | '));
    verifica('il racconto della primaria: da fine aprile a fine agosto, e da settembre i suoi arrivi lo riassorbono, e le 1,80 t tornano nella giacenza della secondaria',
      p.racconto.some(x => x.startsWith('Da fine aprile a fine agosto le dichiarazioni di questa riga avevano coperto 1,80 t più'))
        && p.racconto.includes("Da settembre gli arrivi di questa riga lo riassorbono: l'eccesso esce dai suoi carichi arrivati dopo, come nella colonna «Da dichiarare», e le 1,80 t tornano nella giacenza della secondaria."), J(p.racconto));
    verifica('quello della secondaria: «da settembre gli arrivi della primaria lo riassorbono», poi «1,80 t di aprile» ancora da dichiarare',
      q.racconto.includes('Da settembre gli arrivi della primaria lo riassorbono, e le 1,80 t tornano nella giacenza di questa riga.') && q.racconto.some(x => /^Oggi restano da dichiarare 14,62 t: 1,80 t di aprile/.test(x)) && !q.racconto.some(x => /risultano uscite/.test(x)), J(q.racconto));
    verifica('settembre si apre al tocco sulle due righe, nella pagina disegnata', mesiCheSiAprono(p).includes('settembre') && mesiCheSiAprono(q).includes('settembre'), `${J(mesiCheSiAprono(p))} ${J(mesiCheSiAprono(q))}`);
    // La giacenza del canale che la funzione mette sui mesi (revisione finale
    // del 13/10/2026): da aprile a settembre, le due righe insieme.
    const canaleDi = (f) => f.mesi.map(m => (m.giacenza_canale_fine_kg === undefined ? '-' : m.giacenza_canale_fine_kg));
    const somme = p.mesi.map((m, i) => (i >= 3 && i <= 8 ? m.giacenza_fine_kg + q.mesi[i].giacenza_fine_kg : '-'));
    verifica('la giacenza del canale sta da aprile a settembre sulle due righe, ed e\' la somma delle due',
      J(canaleDi(p)) === J(somme) && J(canaleDi(q)) === J(somme) && somme[8] === 25170, `${J(canaleDi(p))} ${J(canaleDi(q))}`);

    // IL RILIEVO DELLA REVISIONE FINALE (rientro_e_dichiarato_veri.mjs del
    // revisore): lo stesso caso, e a settembre la secondaria dichiara le sue
    // 12,82 t piu' le 1,80 t d'aprile (14.620 kg), la correzione naturale; il
    // settembre della primaria non e' ancora caricato.
    DATI.archivi.DichiarazioneSito = originali.map(r => (gatim(r, 'Aprile', 'primaria') ? { ...r, quantita_kg: 10000 } : gatim(r, 'Aprile', 'secondaria') ? { ...r, quantita_kg: 12540 }
      : gatim(r, 'Settembre', 'primaria') ? { ...r, caricata_inviata: false } : gatim(r, 'Settembre', 'secondaria') ? { ...r, quantita_kg: 14620, caricata_inviata: true } : r));
    let R2;
    try { R2 = await riepilogo({ anno: ANNO }); } finally { DATI.archivi.DichiarazioneSito = originali; }
    const s2 = R2.siti.find(x => /gatim/i.test(x.sito) && x.tipo_destinazione !== 'stoc');
    const [p2, q2] = ['primaria', 'secondaria'].map(pr => s2.flussi.find(x => x.canale === 'ACI' && x.provenienza === pr));
    verifica('i numeri del revisore: la primaria 10.550 da settembre, la secondaria 0 (nessun conto cambia)',
      J(p2.mesi.map(m => m.giacenza_fine_kg)) === J([0, 0, 0, 0, 0, 0, 0, 0, 10550, 10550, null, null]) && J(q2.mesi.map(m => m.giacenza_fine_kg)) === J([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null])
        && J(p2.mesi.map(m => m.spostato_dal_canale_kg || 0)) === J([0, 0, 0, 1800, 1800, 1800, 1800, 1800, 0, 0, 0, 0]) && J(q2.mesi.map(m => m.spostato_dal_canale_kg || 0)) === J([0, 0, 0, -1800, -1800, -1800, -1800, -1800, 0, 0, 0, 0]),
      `${J(p2.mesi.map(m => m.giacenza_fine_kg))} ${J(q2.mesi.map(m => m.giacenza_fine_kg))}`);
    verifica('la primaria: i suoi arrivi lo riassorbono, e le 1,80 t tornano alla secondaria, che a settembre le ha dichiarate',
      p2.racconto.includes("Da settembre gli arrivi di questa riga lo riassorbono: l'eccesso esce dai suoi carichi arrivati dopo, come nella colonna «Da dichiarare», e le 1,80 t tornano alla secondaria, che a settembre le ha dichiarate."), J(p2.racconto));
    verifica('la secondaria lo stesso perche\': gli arrivi della primaria lo riassorbono, e le 1,80 t le ha dichiarate lei a settembre',
      q2.racconto.includes('Da settembre gli arrivi della primaria lo riassorbono, e le 1,80 t tornano a questa riga, che a settembre le ha dichiarate: la sua dichiarazione di settembre supera di 1,80 t quello che vi è arrivato nel mese.'), J(q2.racconto));
    verifica('nessuna delle due dice «non resta niente», ne\' che le 1,80 t tornano in una giacenza',
      ![...p2.racconto, ...q2.racconto].some(x => NON_RESTA.test(x) || IN_GIACENZA.test(x)), J([...p2.racconto, ...q2.racconto].filter(x => NON_RESTA.test(x) || IN_GIACENZA.test(x))));
    const tp2 = S.percheFineMese(p2.mesi[8], false, p2.mesi[7]), tq2 = S.percheFineMese(q2.mesi[8], false, q2.mesi[7]);
    verifica('al tocco, settembre si apre sulle due righe e dice lo stesso perche\', con le 1,80 t dichiarate dalla secondaria',
      mesiCheSiAprono(p2).includes('settembre') && mesiCheSiAprono(q2).includes('settembre')
        && tp2.includes("Le 1,80 t tornano all'altra riga, che a settembre le ha dichiarate.")
        && tq2.includes("Fino a fine agosto 1,80 t di questa riga si toglievano per le dichiarazioni di un'altra riga dello stesso canale, che avevano coperto più di quello che vi era arrivato: da settembre le coprono gli arrivi di quella riga, e le 1,80 t tornano a questa.")
        && tq2.includes('A settembre questa riga le ha dichiarate: la sua dichiarazione supera di 1,80 t quello che vi è arrivato nel mese.')
        && ![...tp2, ...tq2].some(x => NON_RESTA.test(x) || IN_GIACENZA.test(x)), J([tp2, tq2]));
    verifica('la stessa regola sulle due righe, nel racconto e al tocco: riassorbito',
      [comeFinisceRacconto(p2.mesi[8], p2.mesi[7]), comeFinisceRacconto(q2.mesi[8], q2.mesi[7]), comeFinisceTocco(p2.mesi[8], p2.mesi[7]), comeFinisceTocco(q2.mesi[8], q2.mesi[7])].every(x => x && x.perche === 'riassorbito' && x.dichiarato_kg === 1800),
      J([comeFinisceRacconto(p2.mesi[8], p2.mesi[7]), comeFinisceRacconto(q2.mesi[8], q2.mesi[7])]));
    const difetti2 = [...controlliDelRevisore(p2, 'primaria'), ...controlliDelRevisore(q2, 'secondaria')];
    verifica('e i controlli dello script del revisore non trovano niente', !difetti2.length, difetti2.join(' | '));
  }
  verifica('niente scritto sugli archivi', globalThis.__SCRITTE_DATI_VERI.length === 0, globalThis.__SCRITTE_DATI_VERI.join());
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
