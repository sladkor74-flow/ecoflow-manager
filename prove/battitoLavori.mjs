// Prova del BATTITO DEI LAVORI PIANIFICATI (chiusura dell'audit, 11/10/2026).
//
// Undici lavori girano da soli e fino a oggi solo il guardiano lasciava una
// traccia con la data: un lavoro che cominciava a rispondere 500 non lo vedeva
// nessuno. Ora ognuno mette attorno al suo corpo l'involucro conBattito
// (base44/shared/battito.ts), che lascia una riga EsecuzioneLavoro per lavoro.
//
// Qui si controlla:
// 1. che ogni funzione chiamata da un workflow sia in LAVORI, col cron del suo
//    workflow: un lavoro nuovo non nasce senza battito, e un orario cambiato in
//    un posto solo fa cadere la prova;
// 2. che ogni lavoro usi davvero l'involucro, col suo nome;
// 3. i giri che un cron prevede, nel fuso italiano;
// 4. l'involucro: scrive quando riesce e quando fallisce, non copre l'errore, non
//    cambia la risposta, non scrive sui rinvii, scrive solo l'amministratore, e
//    ricorda la partenza del primo giro (revisione delle migliorie, 11/10/2026:
//    per un lavoro mai riuscito la dashboard conta i mancati da li');
// 5. le funzioni vere: il guardiano (solo il giro del workflow) e il motore degli
//    alert quando non riesce.
// npm run prove
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LAVORI, lavoroDi, leggiCron, giriAttesi, conBattito, giudicaRisposta } from '../base44/shared/battito.ts';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
// I file dell'albero di lavoro possono essere CRLF: i \r si tolgono prima di cercare.
const sorgente = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');

console.log('1. OGNI FUNZIONE DEI WORKFLOW E\' IN LAVORI, COL SUO CRON');
// I passi di un workflow che chiamano una funzione, col cron del workflow (null se parte a evento).
const passiDeiWorkflow = () => {
  const out = [];
  for (const f of readdirSync(qui('../base44/workflows/')).filter(n => n.endsWith('.jsonc'))) {
    const w = JSON.parse(sorgente('base44/workflows/' + f));
    const cfg = (w.trigger && w.trigger.config) || {};
    const cron = cfg.trigger_type === 'scheduled' ? cfg.cron_expression : null;
    for (const passo of (w.definition && w.definition.do) || []) {
      for (const corpo of Object.values(passo)) {
        if (corpo && corpo.call === 'invoke_backend_function' && corpo.with && corpo.with.function_name) {
          out.push({ workflow: f.replace(/\.jsonc$/, ''), funzione: corpo.with.function_name, cron });
        }
      }
    }
  }
  return out;
};
// Il controllo, scritto come funzione: la prova lo usa due volte, sui LAVORI veri e
// su un elenco a cui manca un lavoro, per vedere che se ne accorge.
const mancantiIn = (lavori, passi) => {
  const per = new Map(lavori.map(l => [l.lavoro, l]));
  const problemi = [];
  for (const p of passi) {
    const l = per.get(p.funzione);
    if (!l) { problemi.push(`${p.funzione} (workflow ${p.workflow}) non e' in LAVORI`); continue; }
    if (p.cron && l.workflow === p.workflow && l.cron !== p.cron) problemi.push(`${p.funzione}: LAVORI dice ${l.cron}, il workflow ${p.workflow} ${p.cron}`);
  }
  return problemi;
};
const passi = passiDeiWorkflow();
verifica('i workflow chiamano almeno dieci funzioni', new Set(passi.map(p => p.funzione)).size >= 10, J([...new Set(passi.map(p => p.funzione))]));
verifica('ogni function_name dei workflow e\' in LAVORI, col cron del suo workflow', mancantiIn(LAVORI, passi).length === 0, mancantiIn(LAVORI, passi).join(' | '));
verifica('la prova se ne accorge, se un lavoro manca', mancantiIn(LAVORI.filter(l => l.lavoro !== 'alleggerisciDocumenti'), passi).some(x => x.includes('alleggerisciDocumenti')));
verifica('e se un orario cambia in un posto solo', mancantiIn(LAVORI.map(l => (l.lavoro === 'controlloQualifiche' ? { ...l, cron: '30 8 * * 1-5' } : l)), passi).some(x => x.includes('controlloQualifiche')));
// Ogni lavoro di LAVORI e' chiamato da un workflow: niente voci morte.
const chiamate = new Set(passi.map(p => p.funzione));
verifica('nessun lavoro in LAVORI che nessun workflow chiama', LAVORI.every(l => chiamate.has(l.lavoro)), LAVORI.filter(l => !chiamate.has(l.lavoro)).map(l => l.lavoro).join(','));
// Il cron di ciascuno e' quello del suo workflow, e si legge.
for (const l of LAVORI) {
  const suoi = passi.filter(p => p.funzione === l.lavoro && p.workflow === l.workflow);
  verifica(`${l.lavoro}: il workflow ${l.workflow} lo chiama`, suoi.length >= 1);
  verifica(`${l.lavoro}: cron ${l.cron}`, suoi.every(p => p.cron === l.cron) && (l.cron === null || leggiCron(l.cron) !== null), J(suoi));
  verifica(`${l.lavoro}: ha titolo, link e che cosa non succede senza`, !!l.titolo && /^\//.test(l.link || '') && !!l.senza);
}
verifica('il controllo delle identita\' e\' il passo dopo la fotografia', (() => {
  const w = JSON.parse(sorgente('base44/workflows/GuardianoNotturno.jsonc'));
  const foto = w.definition.do.find(x => x.fotografia_del_giorno);
  const inv = w.definition.do.find(x => x.controlla_invarianti);
  return foto && inv && foto.fotografia_del_giorno.then === 'controlla_invarianti' && inv.controlla_invarianti.then === 'end'
    && inv.controlla_invarianti.with.function_name === 'controllaInvarianti' && lavoroDi('controllaInvarianti').dopo === 'riepilogoDichiarazioni';
})());

console.log('2. OGNI LAVORO USA L\'INVOLUCRO, COL SUO NOME');
for (const l of LAVORI) {
  const s = sorgente(`base44/functions/${l.lavoro}/entry.ts`);
  const nome = l.lavoro.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  verifica(`${l.lavoro}: importa conBattito`, /import \{ conBattito[^}]*\} from "\.\.\/\.\.\/shared\/battito\.ts";/.test(s));
  verifica(`${l.lavoro}: l'export default e' uno solo, ed e' l'involucro col suo nome`,
    s.split('export default').length === 2
    && new RegExp(`export default async function\\(req\\) \\{\\n  return conBattito\\(\\(\\) => conLimiteRichieste\\(createClientFromRequest\\(req\\)\\), '${nome}', \\(\\) => \\w+\\(req\\), req\\);\\n\\}\\n?$`).test(s));
}

console.log('3. I GIRI DI UN CRON, NEL FUSO ITALIANO');
{
  const ms = (iso) => Date.parse(iso);
  const it = (t) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' }).format(new Date(t));
  // Il guardiano alle 5 italiane: d'estate sono le 3 UTC, d'inverno le 4.
  const g = giriAttesi('0 5 * * *', ms('2026-10-09T03:00:30Z'), ms('2026-10-11T06:00:00Z'));
  verifica('alle 5 di ogni giorno: il 10 e l\'11, non il 9 (gia\' passato)', J(g.map(it)) === J(['2026-10-10 05:00', '2026-10-11 05:00']), J(g.map(it)));
  const dst = giriAttesi('0 5 * * *', ms('2026-10-24T00:00:00Z'), ms('2026-10-26T12:00:00Z'));
  verifica('al cambio dell\'ora (25/10/2026) resta alle 5 italiane', J(dst.map(it)) === J(['2026-10-24 05:00', '2026-10-25 05:00', '2026-10-26 05:00']) && dst[1] - dst[0] === 25 * 3600000, J(dst.map(it)));
  const feriali = giriAttesi('30 7 * * 1-5', ms('2026-10-09T05:00:00Z'), ms('2026-10-12T09:00:00Z'));
  verifica('nei giorni feriali: venerdi\' 9 e lunedi\' 12, il fine settimana no', J(feriali.map(it)) === J(['2026-10-09 07:30', '2026-10-12 07:30']), J(feriali.map(it)));
  const mese = giriAttesi('0 7 1 * *', ms('2026-10-01T06:00:00Z'), ms('2026-12-02T00:00:00Z'));
  verifica('il primo del mese alle 7: novembre e dicembre', J(mese.map(it)) === J(['2026-11-01 07:00', '2026-12-01 07:00']), J(mese.map(it)));
  const mercoledi = giriAttesi('0 8,14 * * 3', ms('2026-10-12T00:00:00Z'), ms('2026-10-19T00:00:00Z'));
  verifica('il mercoledi\' alle 8 e alle 14', J(mercoledi.map(it)) === J(['2026-10-14 08:00', '2026-10-14 14:00']), J(mercoledi.map(it)));
  const ore = giriAttesi('55 * * * *', ms('2026-10-11T06:00:00Z'), ms('2026-10-11T09:00:00Z'));
  verifica('ogni ora ai 55: tre giri in tre ore', ore.length === 3 && it(ore[0]) === '2026-10-11 08:55', J(ore.map(it)));
  verifica('un cron che non si capisce non da\' giri, non ne inventa', leggiCron('ogni tanto') === null && giriAttesi('ogni tanto', 0, Date.now()).length === 0);
  verifica('la domenica si scrive anche 7', leggiCron('0 9 * * 7').settimana.has(0));
}

console.log('4. L\'INVOLUCRO');
// Un client finto: EsecuzioneLavoro in memoria, chi chiede in UTENTE, ogni lettura e scrittura annotata.
const finto = ({ ruolo = 'admin', righe = [], rompiScrittura = false } = {}) => {
  const db = righe.map(r => ({ ...r }));
  const log = [];
  let n = 0;
  const E = {
    filter: async (f) => { log.push('filter'); return db.filter(r => Object.entries(f).every(([k, v]) => r[k] === v)).map(r => ({ ...r })); },
    create: async (r) => { log.push('create'); if (rompiScrittura) throw new Error('Rate limit exceeded'); const x = { id: 'e' + (++n), ...r }; db.push(x); return x; },
    update: async (id, r) => { log.push('update'); if (rompiScrittura) throw new Error('Rate limit exceeded'); const x = db.find(y => y.id === id); Object.assign(x, r); return x; },
    delete: async (id) => { log.push('delete'); const i = db.findIndex(y => y.id === id); if (i >= 0) db.splice(i, 1); return {}; },
  };
  return { db, log, client: { auth: { me: async () => { log.push('me'); return ruolo ? { role: ruolo } : null; } }, asServiceRole: { entities: { EsecuzioneLavoro: E } } } };
};
const risposta = (corpo, status = 200) => Response.json(corpo, { status });
{
  const f = finto();
  const r = risposta({ alleggeriti: 12, restano: 0, file: { cancellati: 3 } });
  const fuori = await conBattito(f.client, 'alleggerisciDocumenti', async () => r);
  verifica('riuscito: la risposta e\' la stessa, e si legge ancora', fuori === r && (await fuori.json()).alleggeriti === 12);
  const riga = f.db[0];
  verifica('riuscito: una riga, con partenza, riuscita, esito e sintesi', f.db.length === 1 && riga.lavoro === 'alleggerisciDocumenti' && riga.ultimo_esito === 'riuscito'
    && riga.ultima_partenza === riga.ultima_riuscita && riga.fallimenti_di_fila === 0 && riga.sintesi === '12 documenti alleggeriti, 0 rimasti; 3 file tolti' && riga.errore === '', J(riga));

  const prima = riga.ultima_riuscita;
  await new Promise(x => setTimeout(x, 5));
  const r500 = risposta({ error: 'Rate limit exceeded' }, 500);
  const fuori500 = await conBattito(f.client, 'alleggerisciDocumenti', async () => r500);
  verifica('fallito (500): la risposta resta quella, intatta', fuori500 === r500 && fuori500.status === 500 && (await fuori500.json()).error === 'Rate limit exceeded');
  verifica('fallito (500): la stessa riga, con l\'errore, e l\'ultima riuscita non si tocca', f.db.length === 1 && f.db[0].ultimo_esito === 'fallito' && f.db[0].errore === 'Rate limit exceeded'
    && f.db[0].ultima_riuscita === prima && f.db[0].ultima_partenza > prima && f.db[0].fallimenti_di_fila === 1 && f.db[0].sintesi === '', J(f.db[0]));

  const errore = new Error('database non raggiungibile');
  let preso = null;
  try { await conBattito(f.client, 'alleggerisciDocumenti', async () => { throw errore; }); } catch (e) { preso = e; }
  verifica('un errore lanciato risale, ed e\' lo stesso errore', preso === errore);
  verifica('e si registra: due di fila', f.db[0].ultimo_esito === 'fallito' && f.db[0].errore === 'database non raggiungibile' && f.db[0].fallimenti_di_fila === 2, J(f.db[0]));

  await conBattito(f.client, 'alleggerisciDocumenti', async () => risposta({ alleggeriti: 1, restano: 0 }));
  verifica('il primo giro che riesce rimette a zero i fallimenti', f.db[0].ultimo_esito === 'riuscito' && f.db[0].fallimenti_di_fila === 0 && f.db[0].errore === '' && f.db[0].ultima_riuscita > prima, J(f.db[0]));
  // IL PRIMO GIRO REGISTRATO (revisione delle migliorie, 11/10/2026): la
  // partenza del giro che ha creato la riga resta, giro dopo giro. Per un lavoro
  // mai riuscito la dashboard conta i mancati da li', quel giro compreso.
  verifica('la riga ricorda la partenza del primo giro, e i giri dopo non la toccano', f.db[0].prima_partenza === prima && f.db[0].ultima_partenza > prima, J(f.db[0]));
}
{
  // Un lavoro che fallisce dal primo giro: la riga nasce col fallimento, senza
  // ultima riuscita, e con la partenza di quel giro.
  const f = finto();
  const prima = Date.now();
  await conBattito(f.client, 'controlloNormativo', async () => risposta({ error: 'Il modello non ha risposto' }, 500));
  const r = f.db[0] || {};
  verifica('fallito al primo giro: la riga nasce con la partenza del giro, che e\' la prima', f.db.length === 1 && r.ultimo_esito === 'fallito' && !r.ultima_riuscita
    && r.prima_partenza === r.ultima_partenza && Date.parse(r.prima_partenza) >= prima - 1000 && Date.parse(r.prima_partenza) <= Date.now(), J(r));
  await new Promise(x => setTimeout(x, 5));
  await conBattito(f.client, 'controlloNormativo', async () => risposta({ error: 'Il modello non ha risposto' }, 500));
  verifica('al secondo giro la prima partenza resta quella, e l\'aggiornamento non la riscrive', f.db[0].prima_partenza === r.prima_partenza && f.db[0].ultima_partenza > r.prima_partenza
    && f.db[0].fallimenti_di_fila === 2 && !f.log.slice(f.log.indexOf('update')).includes('create'), J(f.db[0]));
}
{
  // Un rinvio non scrive niente, nemmeno il battito: ne' il 409 dei conti che si
  // salvano, ne' il 200 «rinviato» del controllo delle qualifiche.
  const f = finto();
  const r409 = risposta({ error: 'Rinviato, non è stato salvato niente', rinviato: true }, 409);
  const fuori = await conBattito(f.client, 'controlloQualifiche', async () => r409);
  const fuori200 = await conBattito(f.client, 'controlloQualifiche', async () => risposta({ rinviato: true, da_inviare: 0 }));
  verifica('un rinvio non scrive niente e non legge niente', fuori === r409 && fuori200.status === 200 && f.log.length === 0 && f.db.length === 0, J(f.log));
}
{
  const f = finto({ ruolo: 'user' });
  await conBattito(f.client, 'alleggerisciDocumenti', async () => risposta({ error: 'sola lettura', sola_lettura: true }, 403));
  verifica('chi non e\' amministratore non scrive il battito', f.db.length === 0 && !f.log.some(x => x !== 'me'), J(f.log));
}
{
  const f = finto();
  let giri = 0;
  const pagina = await conBattito(f.client, 'riepilogoDichiarazioni', async () => { giri++; return risposta({ anno: 2026 }); }, { json: async () => ({ anno: 2026 }) });
  const conAnno = await conBattito(f.client, 'riepilogoDichiarazioni', async () => { giri++; return risposta({ anno: 2025 }); }, { json: async () => ({ registra: true, anno: 2025 }) });
  verifica('la pagina che apre il riepilogo non e\' il guardiano: niente battito, e il lavoro gira una volta', pagina.status === 200 && conAnno.status === 200 && giri === 2 && f.log.length === 0, J(f.log));
  const pannello = await conBattito(f.client, 'checkTargetAlerts', async () => risposta({ missed: [] }), { json: async () => ({ crea_alerts: false }) });
  verifica('il pannello dei target (crea_alerts falso) nemmeno', pannello.status === 200 && f.log.length === 0, J(f.log));
  await conBattito(f.client, 'checkTargetAlerts', async () => risposta({ missed: [{}], at_risk: [] }), { json: async () => ({ crea_alerts: true }) });
  verifica('il giro che apre gli alert si', f.db.length === 1 && f.db[0].sintesi === '1 target mancato, 0 a rischio', J(f.db));
  // Una richiesta vera: il corpo si legge da una copia, e il lavoro lo ritrova intatto.
  const req = new Request('http://x/', { method: 'POST', body: JSON.stringify({ registra: true }) });
  let letto = null;
  await conBattito(f.client, 'riepilogoDichiarazioni', async () => { letto = await req.json(); return risposta({ fotografia: { scritta: true, nota: 'Tutti gli impianti con un confronto a portale quadrano (5).' } }); }, req);
  verifica('con una richiesta vera il corpo resta al lavoro', letto && letto.registra === true);
  const g = f.db.find(x => x.lavoro === 'riepilogoDichiarazioni');
  verifica('e il guardiano lascia il battito, con la nota del giorno', g && g.ultimo_esito === 'riuscito' && /quadrano \(5\)/.test(g.sintesi), J(g));
}
{
  // La fotografia che non si scrive: la risposta e' 200, ma il giro non e' riuscito.
  const v = await giudicaRisposta(lavoroDi('riepilogoDichiarazioni'), risposta({ fotografia: { scritta: false, errore: 'Input should be a valid dictionary' } }));
  verifica('la fotografia non scritta e\' un giro non riuscito, col motivo', v && v.esito === 'fallito' && /valid dictionary/.test(v.errore), J(v));
  const inv = await giudicaRisposta(lavoroDi('controllaInvarianti'), risposta({ invarianti: { scritte: true, non_verificate: 1, motivi: 'la Dashboard non ha risposto: timeout (il raccolto di rete)' } }));
  verifica('un\'identita\' non verificata e\' un giro non riuscito, coi motivi come li scrive il controllo', inv && inv.esito === 'fallito' && inv.errore === 'la Dashboard non ha risposto: timeout (il raccolto di rete)', J(inv));
}
{
  const f = finto({ rompiScrittura: true });
  const r = risposta({ alleggeriti: 1 });
  const fuori = await conBattito(f.client, 'alleggerisciDocumenti', async () => r);
  verifica('se il battito non si scrive, il lavoro non se ne accorge', fuori === r && fuori.status === 200);
}
{
  const f = finto({ righe: [{ id: 'a', lavoro: 'aggiornaCorsoRT', ultimo_esito: 'riuscito' }, { id: 'b', lavoro: 'aggiornaCorsoRT', ultimo_esito: 'fallito' }] });
  await conBattito(f.client, 'aggiornaCorsoRT', async () => risposta({ controllate: 2, con_aggiornamenti: 0 }));
  verifica('due righe dello stesso lavoro: si aggiorna la prima e si toglie l\'altra', f.db.length === 1 && f.db[0].id === 'a' && f.db[0].sintesi === '2 schede ricontrollate, 0 con aggiornamenti', J(f.db));
}

console.log('5. LE FUNZIONI VERE');
{
  const riepilogo = await caricaFunzione('riepilogoDichiarazioni');
  const notte = await chiama(riepilogo, { ruolo: 'admin', corpo: { registra: true } });
  const b = (notte.db.EsecuzioneLavoro || [])[0];
  verifica('il guardiano scrive la fotografia e il suo battito', notte.stato === 200 && notte.scritte.some(w => w.entita === 'IndicatoreGiorno')
    && b && b.lavoro === 'riepilogoDichiarazioni' && b.ultimo_esito === 'riuscito' && b.sintesi === notte.j.fotografia.nota, J({ s: notte.stato, b, f: notte.j.fotografia }));
  const pagina = await chiama(riepilogo, { ruolo: 'admin', corpo: { anno: Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric' }).format(new Date())) } });
  verifica('la pagina no', pagina.stato === 200 && !pagina.scritte.some(w => w.entita === 'EsecuzioneLavoro'), J(pagina.scritte));
  const altro = await chiama(riepilogo, { ruolo: 'user', corpo: { registra: true } });
  verifica('un utente qualunque no', altro.stato === 200 && altro.scritte.length === 0, J(altro.scritte));

  const motore = await caricaFunzione('runAlertEngine');
  const storto = await chiama(motore, { ruolo: 'admin', corpo: { modulo: 'nessuno' } });
  const m = (storto.db.EsecuzioneLavoro || [])[0];
  verifica('il motore degli alert che non riesce lascia l\'errore, e risponde come prima', storto.stato === 400 && storto.j.error === 'modulo non valido'
    && m && m.ultimo_esito === 'fallito' && m.errore === 'modulo non valido' && m.fallimenti_di_fila === 1, J({ s: storto.stato, m }));
}

console.log('6. GLI ARCHIVI: OGNI CAMPO CHE SI SCRIVE E\' DICHIARATO');
{
  // .jsonc: le righe di commento si tolgono prima di leggere (come scrittureDegliUtenti.mjs).
  const entita = (nome) => JSON.parse(sorgente(`base44/entities/${nome}.jsonc`).split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n'));
  const E = entita('EsecuzioneLavoro');
  const f = finto();
  await conBattito(f.client, 'alleggerisciDocumenti', async () => risposta({ alleggeriti: 1 }));
  await conBattito(f.client, 'alleggerisciDocumenti', async () => risposta({ error: 'x' }, 500));
  const campi = Object.keys(f.db[0]).filter(k => k !== 'id');
  verifica('EsecuzioneLavoro dichiara ogni campo che il battito scrive', campi.every(k => E.properties[k]), campi.filter(k => !E.properties[k]).join(','));
  verifica('gli esiti scritti sono quelli dell\'elenco', J(E.properties.ultimo_esito.enum) === J(['riuscito', 'fallito']));
  verifica('lo leggono tutti, lo scrive solo l\'amministratore', E.rls.read === true && ['create', 'update', 'delete'].every(op => E.rls[op] && E.rls[op].user_condition && E.rls[op].user_condition.role === 'admin'), J(E.rls));
  const I = entita('IndicatoreGiorno');
  verifica('IndicatoreGiorno ha il campo delle identita\' fra moduli', I.properties.invarianti_json && I.properties.invarianti_json.type === 'string', J(Object.keys(I.properties)));
}

// 7. IL CONTROLLO NORMATIVO DEL MESE, COL MESE ITALIANO (prova del cambio d'anno
// del 15/10/2026, difetto 36). Il giro pianificato non si ripete nello stesso
// mese: confrontava il mese UTC di eseguito_il col mese italiano di oggi, e un
// controllo lanciato a mano alle 00:30 dell'01/01/2027 (2026-12-31T23:30Z)
// risultava di dicembre. Il giro delle 7:00 dello stesso giorno ne creava un
// secondo, con le sue chiamate al modello.
console.log('7. IL CONTROLLO NORMATIVO DEL MESE, COL MESE ITALIANO');
{
  const normativo = await caricaFunzione('controlloNormativo');
  const OraVera = Date;
  const alle = async (iso, f) => {
    const ms = OraVera.parse(iso);
    globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
    try { return await f(); } finally { globalThis.Date = OraVera; }
  };
  const fatto = (eseguito_il) => ({ id: 'c1', eseguito_il, avviato_da: 'manuale', esito: 'completato', proposte: 0 });
  const giro = (iso, eseguito_il) => alle(iso, () => chiama(normativo, { db: { ControlloNormativo: [fatto(eseguito_il)] }, ruolo: 'admin', corpo: {} }));
  const nuovi = (r) => r.scritte.filter(s => s.entita === 'ControlloNormativo' && s.op === 'create').length;
  // Il giro delle 7:00 italiane dell'01/01/2027, dopo uno a mano alle 00:30 dello stesso giorno.
  const notte = await giro('2027-01-01T06:00:00Z', '2026-12-31T23:30:00.000Z');
  verifica('l\'01/01/2027 alle 7:00, gia\' fatto alle 00:30 dello stesso giorno: si salta', notte.stato === 200 && notte.j.saltato === 'Controllo del mese gia\' eseguito' && nuovi(notte) === 0, J({ s: notte.stato, saltato: notte.j.saltato, nuovi: nuovi(notte) }));
  // Come quando il primo e' delle 10:00.
  const mattina = await giro('2027-01-01T10:00:00Z', '2027-01-01T09:00:00.000Z');
  verifica('come quando il primo e\' delle 10:00', mattina.j.saltato === 'Controllo del mese gia\' eseguito' && nuovi(mattina) === 0);
  // La controprova: uno del 31/12/2026 alle 23:30 italiane e' di dicembre, e non ferma quello di gennaio.
  const dicembre = await giro('2027-01-01T06:00:00Z', '2026-12-31T22:30:00.000Z');
  verifica('uno del 31/12/2026 alle 23:30 italiane non fa saltare quello di gennaio', !dicembre.j.saltato && nuovi(dicembre) === 1, J({ s: dicembre.stato, saltato: dicembre.j.saltato, nuovi: nuovi(dicembre) }));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
