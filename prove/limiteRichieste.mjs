// Prova del ritentativo sul limite di richieste della piattaforma
// (base44/shared/limiteRichieste.ts) e della fine lettura a pagine
// (base44/shared/fetchAll.ts). npm run prove
import { conLimiteRichieste, conPazienza, eLimiteRichieste } from '../base44/shared/limiteRichieste.ts';
import { fetchAll, ultimaPagina } from '../base44/shared/fetchAll.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const respinta = () => Object.assign(new Error('Rate limit exceeded'), { status: 429 });
const attese = [1, 1, 1];

console.log('RICONOSCERE IL LIMITE');
verifica('stato 429', eLimiteRichieste({ status: 429 }));
verifica('stato nella risposta', eLimiteRichieste({ response: { status: 429 } }));
verifica('testo della piattaforma', eLimiteRichieste(new Error('Rate limit exceeded')) && eLimiteRichieste('Too Many Requests'));
verifica('un altro errore no', !eLimiteRichieste(Object.assign(new Error('Not found'), { status: 404 })) && !eLimiteRichieste(new Error('timeout')));

console.log('\nRIPETERE');
let giri = 0;
const r1 = await conPazienza(async () => { giri++; if (giri < 3) throw respinta(); return 'fatto'; }, { attese });
verifica('respinta due volte, poi riesce', r1 === 'fatto' && giri === 3, `giri=${giri}`);
giri = 0;
let errore = null;
try { await conPazienza(async () => { giri++; throw respinta(); }, { attese }); } catch (e) { errore = e; }
verifica('si arrende dopo le attese previste', errore && errore.status === 429 && giri === attese.length + 1, `giri=${giri}`);
giri = 0; errore = null;
try { await conPazienza(async () => { giri++; throw new Error('campo non valido'); }, { attese }); } catch (e) { errore = e; }
verifica('un errore vero non si ripete', errore && giri === 1);

console.log('\nIL CLIENT');
const chiamate = [];
let respingi = 0;
const archivio = (nome) => ({
  async list(...a) { chiamate.push([nome, 'list', ...a]); if (respingi > 0) { respingi--; throw respinta(); } return [{ id: 'x' }]; },
  async create(d) { chiamate.push([nome, 'create', d]); if (respingi > 0) { respingi--; throw respinta(); } return { id: 'nuovo', ...d }; },
  subscribe() { return 'abbonato'; },
});
const archivi = new Proxy({}, { get: (_, nome) => (typeof nome === 'string' ? archivio(nome) : undefined) });
let invocazioni = 0;
let rispostaFunzione = null;
const funzioni = { async invoke(nome, dati) { invocazioni++; if (rispostaFunzione) { const e = rispostaFunzione; rispostaFunzione = null; throw e; } return { data: { nome, dati } }; } };
const client = {
  entities: archivi,
  functions: funzioni,
  auth: { me: async () => ({ email: 'a@b' }) },
  get asServiceRole() { return { entities: archivi, functions: funzioni }; },
};
const b = conLimiteRichieste(client, { attese });

respingi = 2;
const letti = await b.entities.PrimariaRete.list('id', 5000, 0);
verifica('lettura respinta due volte arriva', letti.length === 1 && chiamate.filter(c => c[1] === 'list').length === 3);
respingi = 1;
const creato = await b.asServiceRole.entities.Alert.create({ titolo: 't' });
verifica('scrittura con asServiceRole respinta una volta: scritta una volta sola', creato.id === 'nuovo' && chiamate.filter(c => c[1] === 'create').length === 2);
verifica('gli argomenti passano com\'erano', JSON.stringify(chiamate.find(c => c[1] === 'list').slice(2)) === JSON.stringify(['id', 5000, 0]));
verifica('subscribe e auth passano senza toccarli', b.entities.X.subscribe() === 'abbonato' && (await b.auth.me()).email === 'a@b');

rispostaFunzione = Object.assign(new Error('Request failed'), { status: 429 });
const inv = await b.functions.invoke('f', { a: 1 });
verifica('funzione respinta dalla piattaforma (429): si ripete', inv.data.nome === 'f' && invocazioni === 2);
invocazioni = 0;
rispostaFunzione = Object.assign(new Error('Rate limit exceeded'), { status: 500 });
errore = null;
try { await b.asServiceRole.functions.invoke('f', {}); } catch (e) { errore = e; }
verifica('funzione che risponde 500 non si ripete, anche se dentro dice rate limit', errore && errore.status === 500 && invocazioni === 1);

console.log('\nNIENTE DOPPIO AVVOLGIMENTO');
// Come proteggiScritture (src/lib/permessi.js): un Proxy sugli archivi gia'
// avvolti, rimesso sul client con defineProperty.
const client2 = { entities: archivi, functions: funzioni };
const b2 = conLimiteRichieste(client2, { attese });
const originale = b2.entities;
const protetta = new Proxy({}, { get: (_t, nome) => { const g = originale[nome]; return g && typeof g === 'object' ? new Proxy(g, { get: (x, m) => x[m] }) : g; } });
Object.defineProperty(b2, 'entities', { get: () => protetta, configurable: true });
chiamate.length = 0;
respingi = 100;
errore = null;
try { await b2.entities.PrimariaRete.list('id', 1, 0); } catch (e) { errore = e; }
respingi = 0;
verifica('una richiesta sempre respinta parte 1 + attese volte, non al quadrato', errore && chiamate.length === attese.length + 1, `partite=${chiamate.length}`);

console.log('\nLETTURA A PAGINE');
verifica('pagina vuota: fine', ultimaPagina(0, 5000));
verifica('pagina corta non tonda: fine', ultimaPagina(624, 5000));
verifica('pagina piena: avanti', !ultimaPagina(5000, 5000));
verifica('pagina corta ma tonda (piattaforma che ne da\' 1000): avanti', !ultimaPagina(1000, 5000));
const righe = Array.from({ length: 10624 }, (_, i) => ({ id: `r${String(i).padStart(6, '0')}` }));
const letture = [];
const finto = (massimo) => ({ list: async (ord, limite, salta) => { letture.push([limite, salta]); return righe.slice(salta, salta + Math.min(limite, massimo)); } });
const tutte = await fetchAll(finto(5000), null, 'id');
verifica('10.624 righe in 3 pagine da 5000', tutte.length === 10624 && letture.length === 3, `letture=${letture.length}`);
letture.length = 0;
const tutte1000 = await fetchAll(finto(1000), null, 'id');
verifica('se la piattaforma ne desse 1000 per volta si leggono tutte lo stesso', tutte1000.length === 10624 && letture.length === 11, `letture=${letture.length}`);
letture.length = 0;
const giuste = Array.from({ length: 3000 }, (_, i) => ({ id: `g${i}` }));
const fintoTondo = { list: async (ord, limite, salta) => { letture.push([limite, salta]); return giuste.slice(salta, salta + limite); } };
const tondo = await fetchAll(fintoTondo, null, 'id');
verifica('archivio di 3000 righe esatte: una lettura in piu\', nessuna riga persa', tondo.length === 3000 && letture.length === 2);

console.log('\nTESTI LUNGHI IN BLOCCO');
const { precaricaParti, leggiCampo, eliminaCampo } = await import('../base44/shared/testoLungo.ts');
const partiArchivio = [];
for (const id of ['v1', 'v2', 'v3']) for (const campo of ['righe', 'esito']) for (let n = 1; n <= 3; n++) partiArchivio.push({ id: `${id}${campo}${n}`, entita: 'VerificaReport', record_id: id, campo, parte: n, totale: 3, testo: `${id}-${campo}-${n};` });
const corrisponde = (p, f) => Object.entries(f).every(([k, v]) => (v && typeof v === 'object' && v.$in ? v.$in.includes(p[k]) : p[k] === v));
const richiesteTesti = { filter: 0, deleteMany: 0 };
const clientTesti = { asServiceRole: { entities: { ContenutoEsteso: {
  filter: async (f, _o, lim = 1e9, salta = 0) => { richiesteTesti.filter++; return partiArchivio.filter(p => corrisponde(p, f)).slice(salta, salta + lim); },
  deleteMany: async (f) => { richiesteTesti.deleteMany++; for (let i = partiArchivio.length - 1; i >= 0; i--) if (corrisponde(partiArchivio[i], f)) partiArchivio.splice(i, 1); return {}; },
} } } };
const verificheTesti = ['v1', 'v2', 'v3'].map(id => ({ id, righe: '@parti:3', esito: '@parti:3' }));
await precaricaParti(clientTesti, 'VerificaReport', verificheTesti, ['righe', 'esito']);
const letturePrecarico = richiesteTesti.filter;
const testi = [];
for (const v of verificheTesti) testi.push(await leggiCampo(clientTesti, 'VerificaReport', v, 'righe'), await leggiCampo(clientTesti, 'VerificaReport', v, 'esito'));
verifica('sei testi di tre verifiche con una lettura sola', letturePrecarico === 1 && richiesteTesti.filter === 1, `letture=${richiesteTesti.filter}`);
verifica('i testi si ricompongono uguali', testi[0] === 'v1-righe-1;v1-righe-2;v1-righe-3;' && testi[5] === 'v3-esito-1;v3-esito-2;v3-esito-3;');
await eliminaCampo(clientTesti, 'VerificaReport', 'v2', 'righe');
verifica('le parti di un campo si cancellano con una richiesta, le altre restano', richiesteTesti.deleteMany === 1 && !partiArchivio.some(p => p.record_id === 'v2' && p.campo === 'righe') && partiArchivio.filter(p => p.record_id === 'v2').length === 3);
errore = null;
try { await leggiCampo(clientTesti, 'VerificaReport', verificheTesti[1], 'righe'); } catch (e) { errore = e; }
verifica('dopo la cancellazione il precaricato non vale piu\': si rilegge e si vede che manca', errore && /incompleto: 0 parti su 3/.test(errore.message) && richiesteTesti.filter === 2);
errore = null;
try { await eliminaCampo(clientTesti, 'VerificaReport', '', null); } catch (e) { errore = e; }
verifica('senza record non si cancella niente', errore && richiesteTesti.deleteMany === 1);

console.log(`\n${ok} verifiche riuscite, ${ko} fallite`);
process.exit(ko ? 1 : 0);
