// L'ANNO DELLA COPIA DI SICUREZZA E QUELLO DEL QUINTO CONTROLLO (prova del
// cambio d'anno del 15/10/2026, difetto 28).
//
// La copia di sicurezza (src/lib/copiaSicurezza.js) chiede a Giacenze e a
// Dichiarazioni le risposte dell'anno del giorno ITALIANO in cui la lettura
// comincia, e le salva come riepilogoDichiarazioni_AAAA e calcolaGiacenze_AAAA.
// prove/datiVeri.mjs le cercava con l'anno UTC della fine della lettura (i primi
// quattro caratteri di letto_fino_al): una copia fatta fra le 00:05 e le 00:40
// dell'01/01/2027 aveva gli attesi del 2027 e la prova cercava il 2026; una
// cominciata alle 23:50 del 31/12 e finita all'01:10 aveva quelli del 2026 e la
// prova cercava il 2027. Tutte e due fallivano con «manca la risposta del sito»
// su una copia buona. Qui la riga dell'anno di prove/datiVeri.mjs si prende dal
// sorgente e si fa girare sulle copie che la copia di sicurezza vera produce a
// quelle ore, con archivi finti e vuoti. npm run prove
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { giornoRoma } from '../base44/shared/giornoItaliano.ts';
import { caricaPagina } from './dati/paginaFinta.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// La riga dell'anno, com'e' nel quinto controllo (i file sono CRLF: via i \r).
const sorgente = readFileSync(fileURLToPath(new URL('./datiVeri.mjs', import.meta.url)), 'utf8').replace(/\r/g, '');
const riga = sorgente.match(/^const ANNO = (.+);$/m);
verifica('prove/datiVeri.mjs ha la sua riga dell\'anno', !!riga);
const annoDelControllo = riga ? new Function('DATI', 'giornoRoma', `return ${riga[1]};`) : () => null;

const L = (await caricaPagina('lib/copiaSicurezza')).modulo;
// La copia vera, con l'orologio fermo all'inizio finche' non ha chiesto gli
// attesi, e alla fine dopo: come una lettura che dura dall'uno all'altro istante.
const copiaAlle = async (dal, fino) => {
  let chiesti = false;
  const client = {
    auth: { me: async () => ({ role: 'admin', email: 'prova@prova', full_name: 'Prova' }) },
    entities: new Proxy({}, { get: () => ({ list: async () => [], filter: async () => [] }) }),
    functions: { invoke: async (_nome, corpo) => { chiesti = true; return { data: { siti: [], righe: [], totali: {}, anno_chiesto: corpo.anno } }; } },
  };
  const t0 = Date.parse(dal), t1 = Date.parse(fino);
  return L.leggiCopia({ client, archivi: ['UploadLog', 'CommessaEcotyre'], adesso: () => (chiesti ? t1 : t0), pausa: async () => {} });
};

console.log('LA PROVA CERCA GLI ATTESI CHE LA COPIA HA');
const scenari = [
  { nome: 'A, dalle 00:05 alle 00:40 italiane dell\'01/01/2027', dal: '2026-12-31T23:05:00Z', fino: '2026-12-31T23:40:00Z', anno: 2027 },
  { nome: 'B, dalle 23:50 italiane del 31/12/2026 all\'01:10 dell\'01/01/2027', dal: '2026-12-31T22:50:00Z', fino: '2027-01-01T00:10:00Z', anno: 2026 },
  { nome: 'C, il 05/01/2027 alle 10', dal: '2027-01-05T09:00:00Z', fino: '2027-01-05T09:20:00Z', anno: 2027 },
  { nome: 'D, come la copia vera dell\'11/10/2026', dal: '2026-10-11T09:19:42.364Z', fino: '2026-10-11T09:20:22.947Z', anno: 2026 },
];
for (const s of scenari) {
  const dati = await copiaAlle(s.dal, s.fino);
  const chiavi = Object.keys(dati.attesi || {});
  const anno = annoDelControllo(dati, giornoRoma);
  verifica(`${s.nome}: la copia salva gli attesi del ${s.anno}`, chiavi.includes(`riepilogoDichiarazioni_${s.anno}`) && chiavi.includes(`calcolaGiacenze_${s.anno}`), JSON.stringify(chiavi));
  verifica(`${s.nome}: il quinto controllo li cerca col ${s.anno}`, anno === s.anno, String(anno));
}
// Una copia di prima della copia di sicurezza, senza letto_dal: vale la fine,
// col giorno italiano (alle 00:40 italiane dell'01/01/2027 e' il 2027).
verifica('una copia senza letto_dal usa la fine, col giorno italiano', annoDelControllo({ meta: { letto_fino_al: '2026-12-31T23:40:00Z' } }, giornoRoma) === 2027);
// La controprova: di giorno, a meta' anno, l'anno e' quello di sempre.
verifica('una copia del 15/10/2026 alle 10 e\' del 2026', annoDelControllo({ meta: { letto_dal: '2026-10-15T08:00:00Z', letto_fino_al: '2026-10-15T08:20:00Z' } }, giornoRoma) === 2026);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
