// CONTROLLO DELLE ROTTE: LE TARIFFE SI LEGGONO TUTTE (chiusura dell'audit,
// 11/10/2026, revisione dei soldi).
//
// controlloRotte leggeva le tariffe con il filtro { stato: 'attivo' }
// dell'archivio, e perdeva quelle con lo stato vuoto, che per la fatturazione
// valgono come attive (tariffaNonDisattivata di validitaTariffa.ts). Un
// raccoglitore che scarica su due impianti, con la sua tariffa per ciascuno ma
// una delle due scritta senza stato, finiva fra le «tariffe da verificare» con la
// frase «non c'e' una tariffa propria»: falso. Le disattivate invece restano
// fuori. La prova chiama la funzione vera, con un archivio finto che applica i
// filtri come l'archivio vero. npm run prove
//
// I PREZZI SOLO ALL'AMMINISTRATORE (chiusura del giro del 14/10/2026). Le
// tariffe di raccolta sono passive, cioe' costi dei fornitori, e
// controlloRotte risponde a chiunque sia collegato: mandava il prezzo per
// destinazione, la generica e il prezzo dentro il testo, e la scheda Controllo
// rotte di Verifiche scriveva «72 €/t» a chi non e' amministratore. Fino a quel
// giorno questa prova chiedeva da utente semplice e pretendeva la generica di
// 80: pretendeva la fuga. Ora le sezioni di sempre chiedono da amministratore,
// e quelle nuove guardano che cosa arriva agli altri, alla scheda e a chi
// chiama la regola senza dire chi chiede.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { caricaPagina, aspetta, testo, clienteFinto } from './dati/paginaFinta.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const SDK_FINTO = `
const passa = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
const entita = (nome) => ({
  list: async (_o, _l, skip) => (skip ? [] : (globalThis.__ARCHIVI[nome] || [])),
  filter: async (f, _o, _l, skip) => (skip ? [] : (globalThis.__ARCHIVI[nome] || []).filter(r => passa(r, f))),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: globalThis.__RUOLO || 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;
const pacchetto = await build({
  entryPoints: [fileURLToPath(new URL('../base44/functions/controlloRotte/entry.ts', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
  plugins: [{ name: 'sdk-finto', setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
  } }],
});
const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
const chiama = async (corpo, ruolo = 'admin') => {
  globalThis.__RUOLO = ruolo;
  const r = await modulo.default({ json: async () => corpo });
  return { stato: r.status, j: await r.json() };
};

// Emmesse raccoglie e scarica a Gatim e a Irigom, con un prezzo per ciascuno.
const primaria = (id, dest) => ({
  id, stato: 'terminato', id_ordine: id, numero_fir: 'F' + id, trasportatore: 'EMMESSE SRLS', destinazione: dest, tipo_destinazione: 'imp',
  peso_effettivo: 10000, provincia: 'CS', ordine_immesso_il: '2026-09-01T00:00:00.000Z', trasporto_iniziato_il: '2026-09-10T00:00:00.000Z', trasporto_finito_il: '2026-09-10T10:00:00.000Z',
});
const tariffa = (id, destinazione, valore, stato) => ({
  id, direzione: 'PASSIVA', prestazione: 'RACCOLTA', tipologia: 'RETE', fornitore_nome: 'EMMESSE SRLS', destinazione, valore, unita_misura: '€/t',
  data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', ...(stato === undefined ? {} : { stato }),
});
const movimenti = { PrimariaRete: [primaria('A', 'GATIM S.R.L.'), primaria('B', 'Irigom S.r.l.')] };

console.log('UNA TARIFFA SCRITTA SENZA STATO CONTA');
{
  globalThis.__ARCHIVI = { ...movimenti, Tariffa: [tariffa('g', 'GATIM S.R.L.', 72, 'attivo'), tariffa('i', 'Irigom S.r.l.', 90, undefined)] };
  const r = await chiama({ anno: 2026 });
  verifica('la funzione risponde', r.stato === 200, JSON.stringify(r.j).slice(0, 200));
  verifica('Emmesse ha un prezzo per Gatim e uno per Irigom: niente da verificare (prima: «per Irigom non c\'e\' una tariffa propria»)',
    Array.isArray(r.j.tariffe_da_verificare) && r.j.tariffe_da_verificare.length === 0, JSON.stringify(r.j.tariffe_da_verificare));
}

console.log('UNA TARIFFA DISATTIVATA NO');
{
  globalThis.__ARCHIVI = { ...movimenti, Tariffa: [tariffa('g', 'GATIM S.R.L.', 72, 'attivo'), tariffa('i', 'Irigom S.r.l.', 90, 'non_attivo'), tariffa('gen', '', 80, 'attivo')] };
  const r = await chiama({ anno: 2026 });
  const emmesse = (r.j.tariffe_da_verificare || []).find(x => /EMMESSE/.test(x.origine));
  verifica('con quella di Irigom disattivata, Irigom e\' scoperta e si paga la generica', !!emmesse && emmesse.destinazioni_senza_tariffa_propria.length === 1 && /Irigom/.test(emmesse.destinazioni_senza_tariffa_propria[0]) && emmesse.tariffa_generica === 80,
    JSON.stringify(r.j.tariffe_da_verificare));
  const u = await chiama({ anno: 2026 }, 'user');
  const eu = (u.j.tariffe_da_verificare || []).find(x => /EMMESSE/.test(x.origine));
  verifica('chi non e\' amministratore vede la stessa voce, Irigom scoperta, ma senza la generica',
    !!eu && eu.destinazioni_senza_tariffa_propria.length === 1 && /Irigom/.test(eu.destinazioni_senza_tariffa_propria[0]) && !('tariffa_generica' in eu),
    JSON.stringify(u.j.tariffe_da_verificare));
}

// Le chiavi e le cifre che dicono un prezzo, cercate in tutta la risposta.
const PREZZI = ['"tariffa"', '"tariffa_generica"', '"unita_misura"', '€'];
const chiaviDiPrezzo = (x) => PREZZI.filter(p => JSON.stringify(x).includes(p));

console.log('I PREZZI SOLO ALL\'AMMINISTRATORE: UNA TARIFFA SOLA PER DUE DESTINAZIONI');
const soloGenerica = { ...movimenti, Tariffa: [tariffa('gen', '', 72, 'attivo')] };
{
  globalThis.__ARCHIVI = soloGenerica;
  const a = await chiama({ anno: 2026 }, 'admin');
  const atteso = [{
    origine: 'EMMESSE SRLS', tipologia: 'RETE',
    destinazioni: [{ destinazione: 'GATIM S.R.L.', viaggi: 1, kg: 10000, tariffa: null }, { destinazione: 'Irigom S.r.l.', viaggi: 1, kg: 10000, tariffa: null }],
    tariffa_generica: 72, unita_misura: '€/t',
    destinazioni_senza_tariffa_propria: ['GATIM S.R.L.', 'Irigom S.r.l.'], kg_in_gioco: 20000,
    testo: 'EMMESSE SRLS conferisce su 2 destinazioni (GATIM S.R.L. 1 viaggi, Irigom S.r.l. 1 viaggi) e si paga tutto alla stessa tariffa, 72.  Controlla il contratto: se il prezzo cambia con la destinazione, la tariffa va inserita per ciascuna.',
  }];
  verifica('all\'amministratore la voce di sempre, coi prezzi, al carattere', JSON.stringify(a.j.tariffe_da_verificare) === JSON.stringify(atteso), JSON.stringify(a.j.tariffe_da_verificare));
  const u = await chiama({ anno: 2026 }, 'user');
  const v = (u.j.tariffe_da_verificare || [])[0];
  verifica('a chi non e\' amministratore la voce arriva', u.stato === 200 && !!v && v.origine === 'EMMESSE SRLS' && v.kg_in_gioco === 20000, JSON.stringify(u.j.tariffe_da_verificare));
  verifica('ma senza prezzi: niente tariffa, generica, unita\' ne\' euro', chiaviDiPrezzo(u.j.tariffe_da_verificare).length === 0, chiaviDiPrezzo(u.j.tariffe_da_verificare).join(', '));
  verifica('e il 72 non c\'e\' nemmeno nel testo', !!v && !/72/.test(v.testo) && /e si paga tutto alla stessa tariffa\. {2}Controlla/.test(v.testo), v && v.testo);
  verifica('dice quali destinazioni non hanno un prezzo loro (tutte e due)', !!v && v.destinazioni.every(d => d.tariffa_propria === false) && v.destinazioni_senza_tariffa_propria.length === 2, JSON.stringify(v && v.destinazioni));
  verifica('rotte, sospetti e stoccaggi restano quelli dell\'amministratore', JSON.stringify([u.j.flussi, u.j.stoccaggi_condivisi]) === JSON.stringify([a.j.flussi, a.j.stoccaggi_condivisi]));
}

console.log('UN PREZZO PER GATIM, LA GENERICA PER IRIGOM');
const unaPropria = { ...movimenti, Tariffa: [tariffa('g', 'GATIM S.R.L.', 72, 'attivo'), tariffa('gen', '', 80, 'attivo')] };
let perLaScheda = {};
{
  globalThis.__ARCHIVI = unaPropria;
  const a = await chiama({ anno: 2026 }, 'admin');
  const va = (a.j.tariffe_da_verificare || [])[0];
  const di = (v, re) => ((v && v.destinazioni) || []).find(d => re.test(d.destinazione)) || {};
  verifica('all\'amministratore: Gatim 72, Irigom senza, «si paga la generica di 80.»', !!va && di(va, /GATIM/).tariffa === 72 && di(va, /Irigom/).tariffa === null && /si paga la generica di 80\./.test(va.testo), JSON.stringify(va));
  const u = await chiama({ anno: 2026 }, 'user');
  const vu = (u.j.tariffe_da_verificare || [])[0];
  verifica('agli altri: Gatim ha un prezzo suo, Irigom no, senza dire quanto', !!vu && di(vu, /GATIM/).tariffa_propria === true && di(vu, /Irigom/).tariffa_propria === false, JSON.stringify(vu));
  verifica('e il testo dice «si paga la generica.» senza 80 ne\' 72', !!vu && /si paga la generica\. Controlla/.test(vu.testo) && !/80|72/.test(vu.testo) && chiaviDiPrezzo(u.j.tariffe_da_verificare).length === 0, vu && vu.testo);
  perLaScheda = { admin: a.j, user: u.j };
}

console.log('LA SCHEDA CONTROLLO ROTTE DI VERIFICHE, E LA REGOLA SENZA CHI CHIEDE');
{
  const p = await caricaPagina('components/verifiche/ControlloRotte');
  const scheda = async (risposta) => {
    const cli = clienteFinto({ funzioni: { controlloRotte: async () => risposta } });
    globalThis.__CLIENTE_FINTO = cli.cliente;
    const r = p.monta(p.Componente);
    await aspetta();
    const t = testo(r.albero);
    r.smonta();
    return t;
  };
  const tu = await scheda(perLaScheda.user);
  verifica('agli altri la scheda non scrive €/t', /Raccoglitori che conferiscono su più destinazioni/.test(tu) && !/€\/t/.test(tu), tu.slice(-400));
  verifica('e scrive «senza prezzo suo» solo per Irigom', /Irigom S\.r\.l\. 1 viaggi, senza prezzo suo/.test(tu) && !/GATIM S\.R\.L\. 1 viaggi, senza prezzo suo/.test(tu), tu.slice(-400));
  const ta = await scheda(perLaScheda.admin);
  verifica('all\'amministratore come prima: «GATIM S.R.L. 1 viaggi, 72 €/t · Irigom S.r.l. 1 viaggi, senza prezzo suo»', /GATIM S\.R\.L\. 1 viaggi, 72 €\/t · Irigom S\.r\.l\. 1 viaggi, senza prezzo suo/.test(ta), ta.slice(-400));

  const { tariffeDaVerificare } = await import('../base44/shared/rotteConferimenti.ts');
  const righe = movimenti.PrimariaRete;
  const senza = tariffeDaVerificare(righe, 'PrimariaRete', soloGenerica.Tariffa, 'RETE');
  verifica('chi chiama tariffeDaVerificare senza dire conPrezzi non riceve prezzi', senza.length === 1 && chiaviDiPrezzo(senza).length === 0 && !/72/.test(senza[0].testo), JSON.stringify(senza));
  const con = tariffeDaVerificare(righe, 'PrimariaRete', soloGenerica.Tariffa, 'RETE', { conPrezzi: true });
  verifica('con conPrezzi: true si\'', con.length === 1 && con[0].tariffa_generica === 72, JSON.stringify(con));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
