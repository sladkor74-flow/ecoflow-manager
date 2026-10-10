// Prova delle DUE FALLE DI PERMESSI trovate dalla verifica di chiusura dell'audit
// (11/10/2026). Regola dell'utente del 16/09: solo l'amministratore modifica, e i
// costi dei fornitori sono suoi (calcolaPassiva e calcolaMargine rispondono «sola
// lettura» agli altri).
//
// 1. EcoTyna, su una domanda di piu' mesi, faceva il conto della passiva coi
//    permessi del servizio e lo diceva a chiunque fosse collegato; lo strumento
//    delle tariffe dava anche i prezzi dei fornitori.
// 2. riepilogoDichiarazioni con registra:true scriveva la fotografia del giorno
//    per qualunque utente, e con un altro anno negli argomenti riscriveva la riga
//    di oggi coi numeri di quell'anno.
//
// La seconda si prova sulla funzione vera, con un SDK finto che conta le scritture.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log("1. ECOTYNA: I COSTI LI VEDE L'AMMINISTRATORE");
{
  const R = new URL('../base44/shared/', import.meta.url).href;
  const { STRUMENTI } = await import(R + 'strumentiAssistente.ts');
  const letture = [];
  const TARIFFE = [
    { id: 't1', direzione: 'PASSIVA', prestazione: 'RACCOLTA', tipologia: 'RETE', fornitore_nome: 'EMMESSE SRLS', valore: 72, unita_misura: '€/t', stato: 'attivo' },
    { id: 't2', direzione: 'ATTIVA', prestazione: 'RACCOLTA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo' },
  ];
  const finto = {
    asServiceRole: { entities: new Proxy({}, { get: (_t, nome) => ({
      filter: async (f) => { letture.push(String(nome)); return String(nome) === 'Tariffa' ? TARIFFE.filter(t => Object.entries(f || {}).every(([k, v]) => t[k] === v)) : []; },
      list: async () => { letture.push(String(nome)); return []; },
    }) }) },
    functions: { invoke: async (n) => { letture.push('funzione ' + n); return { data: {} }; } },
  };
  const fatt = STRUMENTI.find(s => s.nome === 'fatturazione');
  const tar = STRUMENTI.find(s => s.nome === 'tariffe');

  letture.length = 0;
  const senza = (await fatt.esegui(finto, { anno: 2026, tipo: 'PASSIVA', tipologia: 'RETE', mesi: ['Febbraio', 'Marzo'] })).dati;
  verifica('la passiva di piu\' mesi, senza sapere chi chiede: riservata', senza.riservato === true && /riservati all'amministratore/.test(senza.nota), JSON.stringify(senza).slice(0, 200));
  verifica('e non si legge niente: il conto non si fa nemmeno', letture.length === 0, letture.join(','));
  const operatore = (await fatt.esegui(finto, { anno: 2026, tipo: 'PASSIVA', mese: 'Settembre' }, { amministratore: false })).dati;
  verifica('anche col mese, a chi non e\' amministratore: riservata', operatore.riservato === true);
  verifica('e la funzione del modulo non si chiama', !letture.includes('funzione calcolaPassiva'), letture.join(','));
  letture.length = 0;
  const admin = await fatt.esegui(finto, { anno: 2026, tipo: 'PASSIVA', mese: 'Settembre' }, { amministratore: true }).catch(e => ({ errore: e.message }));
  verifica("all'amministratore si fa il conto del modulo", letture.includes('funzione calcolaPassiva') && !(admin.dati && admin.dati.riservato), letture.join(','));
  const attiva = await fatt.esegui(finto, { anno: 2026, tipo: 'ATTIVA', mese: 'Settembre' }, { amministratore: false }).catch(e => ({ errore: e.message }));
  verifica("l'attiva (quanto ci spetta) resta per tutti", !(attiva.dati && attiva.dati.riservato), JSON.stringify(attiva).slice(0, 200));

  const tPass = (await tar.esegui(finto, { direzione: 'PASSIVA' }, { amministratore: false })).dati;
  verifica('le tariffe passive chieste da chi non e\' amministratore: riservate', tPass.riservato === true && !JSON.stringify(tPass).includes('EMMESSE'));
  const tTutte = (await tar.esegui(finto, {}, { amministratore: false })).dati;
  verifica('senza direzione restano le attive, e si dice perche\'',
    tTutte.tariffe.righe ? tTutte.tariffe.righe.every(t => t.direzione === 'ATTIVA') && tTutte.tariffe.righe.length === 1 : JSON.stringify(tTutte.tariffe).includes('ECOTYRE') && !JSON.stringify(tTutte.tariffe).includes('EMMESSE'),
    JSON.stringify(tTutte).slice(0, 300));
  verifica('con la nota', /solo le tariffe attive/.test(tTutte.nota_riservate || ''));
  const tAdmin = (await tar.esegui(finto, {}, { amministratore: true })).dati;
  verifica("all'amministratore tutte e due", JSON.stringify(tAdmin.tariffe).includes('EMMESSE') && JSON.stringify(tAdmin.tariffe).includes('ECOTYRE') && !tAdmin.nota_riservate);

  const src = readFileSync(qui('../base44/functions/chiediAssistente/entry.ts'), 'utf8');
  verifica('chiediAssistente dice agli strumenti chi chiede', /cache\.amministratore = eAmministratore\(user\);/.test(src));
}

console.log('2. LA FOTOGRAFIA DEL GIORNO');
{
  const SDK_FINTO = `
const entita = (nome) => ({
  list: async () => [],
  filter: async () => [],
  create: async (r) => { globalThis.__SCRITTE.push('create ' + nome + ' ' + (r && r.anno)); return { id: 'n', ...r }; },
  update: async (id, r) => { globalThis.__SCRITTE.push('update ' + nome); return r; },
  delete: async () => { globalThis.__SCRITTE.push('delete ' + nome); return {}; },
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: globalThis.__RUOLO, email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;
  const pacchetto = await build({
    entryPoints: [qui('../base44/functions/riepilogoDichiarazioni/entry.ts')],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    } }],
  });
  const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  const chiama = async (ruolo, corpo) => {
    globalThis.__RUOLO = ruolo; globalThis.__SCRITTE = [];
    const r = await modulo.default({ json: async () => corpo });
    return { stato: r.status, j: await r.json(), scritte: globalThis.__SCRITTE };
  };
  const anno = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric' }).format(new Date()));

  const notte = await chiama('admin', { registra: true });
  verifica('il lavoro notturno (amministratore, senza anno) scrive la riga di oggi, sull\'anno in corso',
    notte.stato === 200 && notte.scritte.includes(`create IndicatoreGiorno ${anno}`) && notte.j.fotografia && notte.j.fotografia.scritta === true,
    JSON.stringify({ s: notte.stato, w: notte.scritte, f: notte.j.fotografia }));

  const altro = await chiama('user', { registra: true });
  verifica("un utente qualunque riceve la risposta", altro.stato === 200 && altro.j.anno === anno, String(altro.stato));
  verifica('ma non scrive niente', altro.scritte.length === 0, altro.scritte.join(','));
  verifica('e la risposta dice perche\'', altro.j.fotografia && altro.j.fotografia.scritta === false && /solo l'amministratore/.test(altro.j.fotografia.motivo || ''), JSON.stringify(altro.j.fotografia));

  const vecchio = await chiama('admin', { registra: true, anno: anno - 1 });
  verifica("con un altro anno la riga di oggi non si riscrive", vecchio.stato === 200 && vecchio.scritte.length === 0, vecchio.scritte.join(','));
  verifica('e lo dice', vecchio.j.fotografia && vecchio.j.fotografia.scritta === false && /dell'anno in corso/.test(vecchio.j.fotografia.motivo || ''), JSON.stringify(vecchio.j.fotografia));

  const pagina = await chiama('user', { anno });
  verifica('la pagina (senza registra) non scrive e non porta una fotografia', pagina.scritte.length === 0 && pagina.j.fotografia === null);
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
