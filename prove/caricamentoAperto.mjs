// I RICALCOLI DOPO UN CARICAMENTO GUARDANO IL REGISTRO COME I MOTORI
// (revisione della chiusura, 11/10/2026).
//
// Dopo un caricamento il browser lancia i ricalcoli (verifiche, qualifica,
// evasione...), ma prima guarda se primarie o secondarie sono a meta'
// (caricamentoAperto, src/lib/importGrandeFile.js). Lo guardava con una regola
// sua, la terza: la prima riga del registro che non fosse in «errore», e
// bloccava solo se era ancora «in_corso». Una riscrittura delle primarie finita
// «parziale» passava per buona: i ricalcoli partivano, i motori rispondevano 409
// uno per uno, e la dashboard diceva «non riuscito: ricarica il file». Ora la
// regola e' quella del registro (registroCaricamenti), la stessa della
// dashboard e dei motori.
//
// Si prova il modulo vero del browser, impacchettato con un client finto: il
// registro dei caricamenti in memoria e le funzioni annotate. npm run prove
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const CLIENT_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in)) ? v.$in.includes(r[k]) : r[k] === v);
const ordina = (righe, o) => { const c = String(o || 'id').replace(/^[-+]/, ''); const s = String(o || '').startsWith('-') ? -1 : 1; return [...righe].sort((a, b) => String(a[c] ?? '').localeCompare(String(b[c] ?? '')) * s); };
const entita = (nome) => ({
  filter: async (f, o, lim = 1e9) => ordina((globalThis.__ARCHIVI[nome] || []).filter(r => soddisfa(r, f)), o).slice(0, lim),
  list: async (o, lim = 1e9) => ordina(globalThis.__ARCHIVI[nome] || [], o).slice(0, lim),
  create: async (d) => { (globalThis.__ARCHIVI[nome] ||= []).push({ id: 'c' + Math.random(), created_date: new Date().toISOString(), ...d }); return d; },
  update: async () => ({}),
});
export const base44 = {
  functions: { invoke: async (nome, corpo) => { globalThis.__INVOCATE.push(nome); return { status: 200, data: {} }; } },
  entities: new Proxy({}, { get: (_t, nome) => entita(String(nome)) }),
  auth: { me: async () => ({ full_name: 'Prova', email: 'prova' }) },
};`;
// utils.js guarda window.self per sapere se sta dentro un iframe.
globalThis.window = globalThis.window || { self: {}, top: {} };
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(existsSync) || base; };
const pacchetto = await build({
  entryPoints: [qui('../src/lib/importGrandeFile.js')],
  bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
  plugins: [{ name: 'finti', setup(b) {
    b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'client-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'client-finto' }, () => ({ contents: CLIENT_FINTO, loader: 'js' }));
    b.onResolve({ filter: /^(npm:)?xlsx$/ }, () => ({ path: qui('../node_modules/xlsx/xlsx.mjs') }));
    b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) }));
  } }],
});
const { dopoCaricamento } = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
const R = await import(pathToFileURL(qui('../base44/shared/registroCaricamenti.ts')).href);

// created_date come lo scrive la piattaforma: UTC senza la Z.
const fa = (minuti) => new Date(Date.now() - minuti * 60000).toISOString().replace('Z', '');
const SECONDARIE_OK = { id: 's1', tipo_file: 'secondarie', esito: 'successo', modalita: 'sostituzione', created_date: fa(5), nome_file: 'SECONDARIE.xlsx', utente: 'Antonio' };
const PRIMARIE_OK = { id: 'p1', tipo_file: 'primarie', esito: 'successo', modalita: 'sostituzione', created_date: fa(3 * 1440), nome_file: 'PRIMARIE.xlsx' };

const dopoLeSecondarie = async (registro) => {
  globalThis.__ARCHIVI = { UploadLog: registro.map(r => ({ ...r })) };
  globalThis.__INVOCATE = [];
  const esiti = await dopoCaricamento('secondarie');
  return { esiti, invocate: globalThis.__INVOCATE };
};
const fermi = (x, testo) => x.esiti.length > 0 && x.esiti.every(e => e.ok === false && testo.test(String(e.errore || ''))) && x.invocate.length === 0;
// La regola del registro sulle stesse righe: lo stato che dice la dashboard.
const statoDashboard = (registro) => R.statoDelRegistro(registro, ['primarie', 'secondarie'], Date.now()).in_corso.map(a => R.avvisoCaricamento(a).stato);

console.log('UNA RISCRITTURA DELLE PRIMARIE FINITA PARZIALE');
{
  const PARZIALE = { id: 'p2', tipo_file: 'primarie', esito: 'parziale', modalita: 'sostituzione', created_date: fa(60), nome_file: 'PRIMARIE.xlsx', utente: 'Antonio', messaggio: '4800 righe importate, 200 righe non scritte' };
  const registro = [SECONDARIE_OK, PARZIALE, PRIMARIE_OK];
  const x = await dopoLeSecondarie(registro);
  verifica('i ricalcoli non partono: l\'archivio delle primarie e\' a meta\'', fermi(x, /^rinviato: il caricamento primarie di Antonio \(PRIMARIE\.xlsx\) non e' riuscito/), JSON.stringify(x));
  verifica('e si dice di ricaricare il file', x.esiti.every(e => /ricarica il file/.test(e.errore || '')), JSON.stringify(x.esiti));
  verifica('come la dashboard: «non riuscito»', JSON.stringify(statoDashboard(registro)) === '["non_riuscito"]', JSON.stringify(statoDashboard(registro)));
}

console.log('APERTO ADESSO, INTERROTTO, NON RIUSCITO: COME PRIMA');
{
  const adesso = await dopoLeSecondarie([SECONDARIE_OK, { id: 'p3', tipo_file: 'primarie', esito: 'in_corso', modalita: 'sostituzione', created_date: fa(2), nome_file: 'PRIMARIE.xlsx', utente: 'Mario' }, PRIMARIE_OK]);
  verifica('un caricamento delle primarie in corso adesso: si rifa\' quando finisce', fermi(adesso, /^rinviato: caricamento primarie di Mario \(PRIMARIE\.xlsx\) in corso; si rifa' quando finisce$/), JSON.stringify(adesso.esiti));
  const ieri = await dopoLeSecondarie([SECONDARIE_OK, { id: 'p4', tipo_file: 'primarie', esito: 'in_corso', modalita: 'sostituzione', created_date: fa(1440), nome_file: 'PRIMARIE.xlsx' }, PRIMARIE_OK]);
  verifica('aperto da ieri: interrotto, da ricaricare', fermi(ieri, /^rinviato: il caricamento primarie \(PRIMARIE\.xlsx\) e' rimasto interrotto/), JSON.stringify(ieri.esiti));
  const dichiarato = await dopoLeSecondarie([SECONDARIE_OK, { id: 'p5', tipo_file: 'primarie', esito: 'in_corso', modalita: 'sostituzione', created_date: fa(3), messaggio: "Caricamento non riuscito: nessuna riga scritta dopo lo svuotamento dell'archivio." }, PRIMARIE_OK]);
  verifica('una riga che dichiara di non essere riuscita: non riuscito, anche se aperta da tre minuti', fermi(dichiarato, /non e' riuscito/), JSON.stringify(dichiarato.esiti));
  // Un file sbagliato rifiutato dopo il caricamento fallito non lo nasconde.
  const rifiutato = await dopoLeSecondarie([{ id: 'e1', tipo_file: 'primarie', esito: 'errore', created_date: fa(1), messaggio: 'Formato file non valido' }, SECONDARIE_OK, { id: 'p6', tipo_file: 'primarie', esito: 'in_corso', modalita: 'sostituzione', created_date: fa(30) }, PRIMARIE_OK]);
  verifica('un file rifiutato a dati intatti, caricato dopo, non nasconde l\'archivio a meta\'', fermi(rifiutato, /rimasto interrotto/), JSON.stringify(rifiutato.esiti));
}

console.log('UN REGISTRO PULITO, O UN PROBLEMA GIA\' SUPERATO');
{
  const pulito = await dopoLeSecondarie([SECONDARIE_OK, PRIMARIE_OK]);
  verifica('con il registro pulito i ricalcoli partono', pulito.esiti.length > 0 && pulito.esiti.every(e => e.ok) && pulito.invocate.includes('ricontrollaDichiarazioni') && pulito.invocate.includes('qualificaFornitori'), JSON.stringify(pulito));
  const superato = await dopoLeSecondarie([SECONDARIE_OK, { ...PRIMARIE_OK, id: 'p7', created_date: fa(30) }, { id: 'p8', tipo_file: 'primarie', esito: 'parziale', modalita: 'sostituzione', created_date: fa(60) }]);
  verifica('una riscrittura parziale gia\' rifatta dopo con successo non ferma niente', superato.esiti.every(e => e.ok) && superato.invocate.length > 0, JSON.stringify(superato.esiti));
  const vecchioTipo = await dopoLeSecondarie([SECONDARIE_OK, { ...PRIMARIE_OK, id: 'p9', created_date: fa(30) }, { id: 'r1', tipo_file: 'primarie_rete', esito: 'in_corso', created_date: fa(200 * 1440) }]);
  verifica('un caricamento di una volta (primarie_rete) rimasto aperto e poi riscritto dalle primarie non ferma niente', vecchioTipo.esiti.every(e => e.ok), JSON.stringify(vecchioTipo.esiti));
  // Un «parziale» che non ha riscritto l'archivio (aggiunta) e' un caricamento riuscito.
  const aggiunta = await dopoLeSecondarie([SECONDARIE_OK, { id: 'p10', tipo_file: 'primarie', esito: 'parziale', modalita: 'aggiunta', created_date: fa(10) }, PRIMARIE_OK]);
  verifica('un parziale in aggiunta non ferma i ricalcoli', aggiunta.esiti.every(e => e.ok), JSON.stringify(aggiunta.esiti));
}

console.log("OGNI RICALCOLO GUARDA SOLO CIO' CHE LEGGE (revisione finale, 11/10/2026)");
{
  // Le secondarie riscritte ieri sono finite «parziale»; oggi le primarie si caricano bene.
  const SEC_PARZIALE = { id: 's2', tipo_file: 'secondarie', esito: 'parziale', modalita: 'sostituzione', created_date: fa(1440), nome_file: 'SECONDARIE.xlsx', utente: 'Antonio' };
  globalThis.__ARCHIVI = { UploadLog: [{ ...PRIMARIE_OK, id: 'p11', created_date: fa(2) }, SEC_PARZIALE, { ...SECONDARIE_OK, created_date: fa(3 * 1440) }] };
  globalThis.__INVOCATE = [];
  const esiti = await dopoCaricamento('primarie');
  const inv = globalThis.__INVOCATE;
  verifica('evasione, ritiri ECT e to-do leggono le sole primarie: partono', ['controllaEvasioneAssegnati', 'importaBlocco', 'controllaTodoOrdini'].every(n => inv.includes(n)), JSON.stringify(inv));
  const fermi2 = esiti.filter(e => !e.ok);
  verifica('verifiche e qualifica leggono anche le secondarie: si rinviano, col motivo', fermi2.length === 2 && fermi2.every(e => /secondarie .*non e' riuscito/.test(e.errore || '')) && !inv.includes('ricontrollaDichiarazioni') && !inv.includes('qualificaFornitori'), JSON.stringify(esiti));
}
{
  // Le primarie riscritte stamattina sono finite «parziale»; si salva una scheda di extra raccolta.
  const PRIM_PARZIALE = { id: 'p12', tipo_file: 'primarie', esito: 'parziale', modalita: 'sostituzione', created_date: fa(30), nome_file: 'PRIMARIE.xlsx', utente: 'Antonio' };
  globalThis.__ARCHIVI = { UploadLog: [PRIM_PARZIALE, PRIMARIE_OK, SECONDARIE_OK] };
  globalThis.__INVOCATE = [];
  const esiti = await dopoCaricamento('extra_raccolta', { giorni: ['2026-10-10'] });
  const righe = globalThis.__ARCHIVI.UploadLog.filter(r => r.tipo_file === 'extra_raccolta');
  verifica("la scheda si registra lo stesso: la riga che fa partire l'alert dell'extra raccolta c'e'", righe.length === 1, JSON.stringify(globalThis.__ARCHIVI.UploadLog.map(r => r.tipo_file)));
  verifica('e i ricalcoli che leggono le primarie si rinviano, col motivo', esiti.length > 0 && esiti.every(e => !e.ok && /primarie .*non e' riuscito/.test(e.errore || '')), JSON.stringify(esiti));
}
console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
