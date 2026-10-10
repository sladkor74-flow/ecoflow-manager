// Prova di CHI ENTRA NELLA CHIUSURA DELL'ANNO, 10/10/2026.
//
// Trovato verificando l'eliminazione di PRT SRL (utente, 10/10/2026: «devi
// sempre considerare come partner operativo Smoco e non altri ... tale impianto
// non compare in alcun modo da anni nei nostri ragionamenti»). La chiusura del
// 2026 prendeva i movimenti «fino al 31/12» senza un inizio, e gli archivi
// tengono anche il 2023-2025: chiedeva la lettura del 31/12 ai piazzali
// Ecorecuperi e Rpn e agli impianti New Deal, Corgom, A.L.F., MAJESTIQUE CARBON
// e AKCANSA, nessuno con un movimento nel 2026. Un piazzale senza lettura blocca
// il salvataggio, e un impianto senza lettura si porta dietro un'apertura vuota.
//
// La regola degli impianti che svuotano l'anno prima (23/09/2026) resta: INNOREC
// non ha contratto nel 2026 ma ha 27 terziarie SMOCO nel 2026, e resta dentro;
// e resta dentro un piazzale fermo che aveva ancora PFU all'ultima rilevazione.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { sitiDellaChiusura } from '../base44/shared/chiusuraAnno.ts';
import { normalizzaRagioneSociale as n } from '../base44/shared/normalizzaRagioneSociale.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('LA REGOLA: CONTA L\'ANNO CHE SI CHIUDE');
{
  const giorni = new Map([
    [`${n('Irigom S.r.l.')}|imp`, ['2025-11-03', '2026-02-10']],
    [`${n('INNOREC SRL')}|imp`, ['2024-05-02', '2025-07-01', '2026-02-18']],      // svuota nel 2026: dentro
    [`${n('New Deal S.r.l')}|imp`, ['2024-03-01', '2025-09-30']],                  // fermo dal 2025: fuori
    [`${n('Rpn S.r.l.')}|stoc`, ['2024-06-01', '2025-12-30']],                     // fermo dal 2025: fuori
    [`${n('AKCANSA CIMENTO')}|imp`, ['2025-04-04']],
    [`${n('Nappi Sud Srl A Socio Unico')}|stoc`, ['2026-12-31']],                  // l'ultimo giorno conta
    [`${n('FUTURO SRL')}|stoc`, ['2027-01-02']],                                   // l'anno dopo no
  ]);
  const rilevazioni = [
    { sito: 'PRT SRL', data_rilevazione: '2026-09-13', class1_kg: 0 },             // dell'anno, anche a zero: dentro
    { sito: 'FERMO PIENO SRL', data_rilevazione: '2025-12-31', class1_kg: 4200 },  // ha ancora PFU: dentro
    { sito: 'FERMO VUOTO SRL', data_rilevazione: '2025-06-30', class2_kg: 900 },
    { sito: 'FERMO VUOTO SRL', data_rilevazione: '2025-12-31', class2_kg: 0 },     // l'ultima e' vuota: fuori
    { sito: 'SOLO ACI SRL', data_rilevazione: '2025-12-31', class9_kg: 300 },      // l'ACI e' giacenza anche lei
    { sito: 'SENZA DATA SRL', class1_kg: 0 },                                      // senza data si tiene
    { sito: 'GIA 2027 SRL', data_rilevazione: '2027-01-15', class1_kg: 800 },      // dell'anno dopo: fuori
  ];
  const giacenzeSito = [
    { sito: 'T-CYCLE INDUSTRIES SRL', tipo_destinazione: 'stoc', anno: 2026 },
    { sito: 'T-CYCLE INDUSTRIES SRL', tipo_destinazione: 'imp', anno: 2026 },
    { sito: 'TECNOGUM SRL', anno: 2026 },                                          // senza ruolo: impianto
  ];
  const { piazzali, impianti } = sitiDellaChiusura({ anno: 2026, giorniPerSito: giorni, rilevazioni, giacenzeSito, chiave: n });
  const P = (x) => piazzali.has(n(x)), I = (x) => impianti.has(n(x));
  verifica('Irigom, con movimenti nel 2026: impianto', I('Irigom S.r.l.'));
  verifica('INNOREC, senza contratto ma con terziarie nel 2026: resta (regola del 23/09)', I('INNOREC SRL'));
  verifica('New Deal, fermo dal 2025: fuori', !I('New Deal S.r.l') && !P('New Deal S.r.l'));
  verifica('Rpn, fermo dal 2025: fuori', !P('Rpn S.r.l.'));
  verifica('AKCANSA, una secondaria del 2025: fuori', !I('AKCANSA CIMENTO'));
  verifica('un movimento del 31/12 conta', P('Nappi Sud Srl A Socio Unico'));
  verifica("uno del 2 gennaio dopo no", !P('FUTURO SRL'));
  verifica("una rilevazione dell'anno, anche a zero, fa un piazzale (si toglie dalla pagina, come PRT)", P('PRT SRL'));
  verifica("un piazzale fermo con PFU all'ultima rilevazione resta: quella giacenza c'e' ancora", P('FERMO PIENO SRL'));
  verifica("se l'ultima rilevazione di prima e' vuota, fuori, anche se una piu' vecchia era piena", !P('FERMO VUOTO SRL'));
  verifica("l'ACI e' giacenza anche lei", P('SOLO ACI SRL'));
  verifica('una rilevazione senza data si tiene: meglio una lettura in piu\' che una giacenza persa', P('SENZA DATA SRL'));
  verifica("una rilevazione dell'anno dopo non fa un piazzale di quest'anno", !P('GIA 2027 SRL'));
  verifica("l'anagrafica dell'anno vale per tutti e due i ruoli", P('T-CYCLE INDUSTRIES SRL') && I('T-CYCLE INDUSTRIES SRL'));
  verifica('una riga senza ruolo e\' un impianto, come prima', I('TECNOGUM SRL') && !P('TECNOGUM SRL'));
}

console.log('LA FUNZIONE VERA, CON GLI ARCHIVI DEL 10/10/2026 IN PICCOLO');
{
  const ARCHIVI = {};
  globalThis.__ARCHIVI_CHIUSURA = ARCHIVI;
  const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
const ordina = (righe) => [...righe].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const entita = (nome) => ({
  list: async (_o, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI_CHIUSURA[nome] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI_CHIUSURA[nome] || []).filter(r => soddisfa(r, f))).slice(skip, skip + lim),
  create: async (r) => r, update: async (_id, r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;
  const pacchetto = await build({
    entryPoints: [qui('../base44/functions/chiusuraAnno/entry.ts')],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    } }],
  });
  const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  const chiudi = async (corpo) => (await modulo.default({ json: async () => corpo })).json();

  let seq = 0;
  const riga = (campi) => ({ id: 'r' + String(++seq).padStart(4, '0'), stato: 'terminato', classe: 'P - fino a 35 kg', prodotto: '.class1', peso_effettivo: 1000, ...campi });
  const fine = (giorno) => `${giorno}T00:00:00.000Z`;
  ARCHIVI.PrimariaRete = [
    riga({ destinazione: 'Irigom S.r.l.', tipo_destinazione: 'imp', trasporto_finito_il: fine('2026-03-10') }),
    riga({ destinazione: 'Nappi Sud Srl A Socio Unico', tipo_destinazione: 'stoc', trasporto_finito_il: fine('2026-05-10') }),
    riga({ destinazione: 'New Deal S.r.l', tipo_destinazione: 'imp', trasporto_finito_il: fine('2024-04-10') }),
    riga({ destinazione: 'INNOREC SRL', tipo_destinazione: 'imp', trasporto_finito_il: fine('2025-04-10') }),
    riga({ destinazione: 'Ecorecuperi Srl', tipo_destinazione: 'stoc', trasporto_finito_il: fine('2024-02-10') }),
  ];
  ARCHIVI.PrimariaAci = [];
  ARCHIVI.ExtraRaccolta = [];
  ARCHIVI.Secondaria = [
    riga({ stoccaggio: 'Rpn S.r.l.', destinazione: 'TECNOGUM SRL', tipo_destinazione: 'imp', trasporto_finito_il: fine('2025-11-20') }),
    riga({ stoccaggio: 'Nappi Sud Srl A Socio Unico', destinazione: 'AKÇANSA ÇİMENTO - Canakkale', tipo_destinazione: 'imp', trasporto_finito_il: fine('2025-03-03') }),
  ];
  ARCHIVI.Terziaria = [
    riga({ unita_locale_origine: 'INNOREC SRL', ragione_sociale: 'INNOREC SRL', destinazione: 'AKÇANSA ÇİMENTO - Canakkale', partner_operativo: 'SMOCO Srl', trasporto_finito_il: fine('2026-02-18') }),
  ];
  ARCHIVI.GiacenzaStoccaggio = [];
  ARCHIVI.GiacenzaSito = [{ id: 's1', sito: 'Irigom S.r.l.', tipo_destinazione: 'imp', anno: 2026 }];

  const d = await chiudi({ anno: 2026, azione: 'prepara' });
  const piazzali = (d.piazzali || []).map(x => x.nome);
  const impianti = (d.richieste || []).filter(x => /impianto/i.test(JSON.stringify(x))).map(x => x.nome);
  const nomi = JSON.stringify(d.richieste || []);
  verifica('la funzione risponde', !d.error, JSON.stringify(d).slice(0, 200));
  verifica('i piazzali: solo Nappi Sud, che ha lavorato nel 2026', piazzali.join() === 'Nappi Sud Srl A Socio Unico', piazzali.join(' | '));
  verifica('Irigom e INNOREC fra gli impianti a cui chiedere la lettura', /Irigom/.test(nomi) && /INNOREC/.test(nomi), impianti.join(' | '));
  verifica('New Deal, Rpn, Ecorecuperi e AKCANSA no', !/New Deal|Rpn|Ecorecuperi|AK[CÇ]ANSA/i.test(nomi), nomi.slice(0, 400));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
