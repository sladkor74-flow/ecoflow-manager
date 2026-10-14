// LA COPIA DI SICUREZZA SUI DATI VERI: DIVENTA LA COPIA DELLE PROVE (14/10/2026).
//
// La copia di sicurezza scaricata da Caricamento Dati (src/lib/copiaSicurezza.js)
// ha lo stesso formato della copia dei dati veri delle prove (../dati-veri,
// fuori dal repository): rinominata treadrider-dati-veri-aaaa-mm-gg.json.gz e
// messa nella cartella, deve diventare la copia nuova del quinto controllo. Qui
// la copia si rifa' dai dati veri: un client finto serve gli archivi della copia
// dell'11/10/2026 (ordinati e a pagine come la piattaforma) e le risposte del
// sito di quel momento, la copia di sicurezza li legge tutti, il file si
// riapre, e prove/datiVeri.mjs gira su quel file come sulla copia vera:
//  1. gli stessi archivi, riga per riga, e gli stessi conteggi nel meta;
//  2. prove/datiVeri.mjs da' lo stesso risultato sulla copia di sicurezza e
//     sulla copia dei dati veri (158 su 158 l'11/10/2026);
//  3. una copia a cui manca qualcosa non passa per buona (revisione del
//     15/10/2026): con Giacenze che non risponde, o con un archivio non letto,
//     il registro e la pagina lo dicono e prove/datiVeri.mjs fallisce dicendo
//     perche'. Prima la copia senza Giacenze usciva come buona e il controllo
//     dava «99 superate, 0 fallite» invece di 158, senza una parola;
//  4. il peso e i tempi, da sapere prima di farla sul sito.
// I file di prova stanno in una cartella temporanea che si toglie alla fine,
// anche se la prova cade: sono copie intere dei dati veri, tariffe dei costi
// comprese, e i dati veri stanno solo in ../dati-veri (revisione del
// 15/10/2026: ogni giro ne lasciava una da 3,7 MB).
// Gira solo sul PC: senza la copia salta e lo dice. node prove/copiaSicurezzaDatiVeri.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { caricaPagina } from './dati/paginaFinta.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));

const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) {
  console.log(`Nessuna copia dei dati veri in ${CARTELLA}: prova saltata.`);
  process.exit(0);
}
const nomeCopia = copie[copie.length - 1];
const DATI = JSON.parse(gunzipSync(readFileSync(join(CARTELLA, nomeCopia))).toString('utf8'));
console.log(`Copia: ${nomeCopia}, letta il ${DATI.meta.letto_fino_al}`);
const L = (await caricaPagina('lib/copiaSicurezza')).modulo;

// Il client finto: gli archivi della copia, ordinati e a pagine come la
// piattaforma; gli archivi che la copia non ha sono vuoti. Le funzioni
// rispondono quello che il sito rispondeva quando la copia e' stata letta.
// guasti: { Archivio o funzione: errore } per quello che non risponde.
const ordina = (righe, sort) => {
  const campo = String(sort || 'id').replace(/^[-+]/, '');
  const giu = String(sort || '').startsWith('-');
  return [...righe].sort((a, b) => {
    const x = a[campo], y = b[campo];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return giu ? -c : c;
  });
};
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v));
const ANNO = Number(String(DATI.meta.letto_fino_al).slice(0, 4));
const errore = (stato, testo) => { const e = new Error(`Request failed with status code ${stato}`); e.response = { status: stato, data: { error: testo } }; return e; };
const cliente = (guasti = {}) => {
  const conto = { richieste: 0, scritte: [] };
  const entita = (nome) => ({
    list: async (sort, quanti = 5000, salta = 0) => { conto.richieste++; if (guasti[nome]) throw guasti[nome]; return ordina(DATI.archivi[nome] || [], sort).slice(salta, salta + Math.min(quanti, 5000)); },
    filter: async (f, sort, quanti = 5000, salta = 0) => { conto.richieste++; return ordina((DATI.archivi[nome] || []).filter(r => soddisfa(r, f)), sort).slice(salta, salta + Math.min(quanti, 5000)); },
    create: async (r) => { conto.scritte.push({ nome, r }); return { id: 'nuova', ...r }; },
  });
  const client = {
    entities: new Proxy({}, { get: (_t, n) => entita(String(n)) }),
    functions: {
      invoke: async (nome, corpo) => {
        if (guasti[nome]) throw guasti[nome];
        const a = DATI.attesi[`${nome}_${corpo.anno}`];
        if (!a) throw new Error('nessuna risposta per ' + nome);
        return { data: a.risposta };
      },
    },
    auth: { me: async () => ({ role: 'admin', full_name: 'Controllo dati veri', email: 'controllo-dati-veri' }) },
  };
  return { client, conto };
};

// La copia di sicurezza, con l'orologio fermo al momento della lettura della
// copia: non aspetta (il ritmo serve sul sito) e prende quell'istante.
const faiCopia = async (guasti = {}) => {
  const { client, conto } = cliente(guasti);
  let ms = Date.parse(DATI.meta.letto_dal);
  let file = null, nome = null;
  const inizio = Date.now();
  const esito = await L.scaricaCopiaSicurezza({
    client, adesso: () => ms, pausa: async (x) => { ms += x; }, alMinuto: 1e9,
    scaricaFile: (b, n) => { file = b; nome = n; },
  });
  return { esito, file, nome, conto, durata: Date.now() - inizio };
};
const giorno = String(DATI.meta.letto_dal).slice(0, 10);

// Il passo che fa l'utente: la copia scaricata, rinominata, in una cartella
// che prove/datiVeri.mjs legge (DATI_VERI). Una cartella per copia, tutte
// dentro una cartella temporanea che si toglie alla fine.
const temporanea = mkdtempSync(join(tmpdir(), 'copia-sicurezza-veri-'));
let cartelle = 0;
const lancia = (dir) => {
  const r = spawnSync(process.execPath, ['--no-warnings', qui('datiVeri.mjs')], { env: { ...process.env, DATI_VERI: dir }, encoding: 'utf8' });
  const righe = (r.stdout || '').trim().split('\n');
  return { stato: r.status, ultima: righe[righe.length - 1], tutto: (r.stdout || '') + (r.stderr || '') };
};
const datiVeriSu = async (file) => {
  const dentro = join(temporanea, `cartella-${++cartelle}`) + '/';
  mkdirSync(dentro);
  writeFileSync(join(dentro, `treadrider-dati-veri-${giorno}.json.gz`), Buffer.from(await file.arrayBuffer()));
  return lancia(dentro);
};

try {
  const buona = await faiCopia();
  const { esito, file, nome, conto } = buona;

  console.log('1. GLI STESSI ARCHIVI, RIGA PER RIGA');
  verifica('il file col nome del giorno', nome === `treadrider-copia-${giorno}.json.gz`, nome);
  const C = JSON.parse(gunzipSync(Buffer.from(await file.arrayBuffer())).toString('utf8'));
  verifica('meta, archivi, attesi', J(Object.keys(C)) === J(['meta', 'archivi', 'attesi']));
  const diversi = [];
  for (const [n, righe] of Object.entries(DATI.archivi)) {
    const a = new Map(righe.map(r => [r.id, J(r)]));
    const b = C.archivi[n] || [];
    if (b.length !== a.size || b.some(r => a.get(r.id) !== J(r))) diversi.push(`${n}: ${b.length} contro ${a.size}`);
  }
  verifica('ogni archivio della copia dei dati veri e\' nella copia di sicurezza, uguale', diversi.length === 0, diversi.join(' | '));
  verifica('e i conteggi del meta sono quelli', Object.entries(DATI.meta.righe).every(([n, k]) => C.meta.righe[n] === k), J(Object.entries(DATI.meta.righe).filter(([n, k]) => C.meta.righe[n] !== k)));
  verifica('gli archivi che la copia dei dati veri non ha ci sono, vuoti', L.ARCHIVI_DELLA_COPIA.every(n => Array.isArray(C.archivi[n])) && Object.keys(C.archivi).length === L.ARCHIVI_DELLA_COPIA.length);
  verifica('gli attesi sono quelli del sito', J(C.attesi[`riepilogoDichiarazioni_${ANNO}`].risposta) === J(DATI.attesi[`riepilogoDichiarazioni_${ANNO}`].risposta)
    && J(C.attesi[`calcolaGiacenze_${ANNO}`].risposta) === J(DATI.attesi[`calcolaGiacenze_${ANNO}`].risposta));
  verifica('una scrittura sola, il registro delle copie', J(conto.scritte.map(s => s.nome)) === J(['CopiaSicurezza']), J(conto.scritte.map(s => s.nome)));
  verifica('e la riga di una copia completa non dice mancanze', esito.riga.non_letti === 0 && esito.riga.archivi_non_letti === '' && esito.riga.attesi_mancanti === '', J(esito.riga).slice(0, 300));

  console.log('2. prove/datiVeri.mjs SULLA COPIA DI SICUREZZA, COME SULLA COPIA VERA');
  const suCopia = await datiVeriSu(file);
  const suVera = lancia(CARTELLA.endsWith('/') || CARTELLA.endsWith('\\') ? CARTELLA : CARTELLA + '/');
  verifica('datiVeri.mjs passa sulla copia di sicurezza', suCopia.stato === 0 && / 0 fallite$/.test(suCopia.ultima), suCopia.tutto.slice(-600));
  verifica('con lo stesso risultato della copia vera', suCopia.ultima === suVera.ultima, `${suCopia.ultima} contro ${suVera.ultima}`);
  console.log(`  copia di sicurezza: ${suCopia.ultima}; copia vera: ${suVera.ultima}`);

  console.log('3. UNA COPIA A CUI MANCA QUALCOSA NON PASSA PER BUONA');
  // Giacenze che non risponde, come dopo una pubblicazione (503 o 504: il
  // ritentativo ripete solo i 429 e i 503, e un 504 passa).
  const senzaG = await faiCopia({ calcolaGiacenze: errore(504, 'tempo scaduto') });
  const chiaveG = `calcolaGiacenze_${ANNO}`;
  verifica('senza Giacenze: la copia si scarica e sa che cosa le manca', J(senzaG.esito.attesiMancanti) === J([chiaveG]) && senzaG.esito.attesiNonRisposti.length === 1 && senzaG.esito.attesiNonRisposti[0].nome === 'Giacenze', J(senzaG.esito.attesiNonRisposti));
  verifica('e la riga del registro lo dice', senzaG.esito.riga.attesi_mancanti === chiaveG && senzaG.esito.riga.non_letti === 0, J({ attesi: senzaG.esito.riga.attesi_mancanti }));
  const aVideo = L.testoAttesiMancanti(senzaG.esito.attesiNonRisposti) || '';
  verifica('e a video: va bene come copia di sicurezza, non come copia dei dati veri', /^Giacenze non ha risposto/.test(aVideo) && /copia di sicurezza/.test(aVideo) && /non come copia dei dati veri/.test(aVideo) && /tempo scaduto/.test(aVideo), aVideo);
  verifica('anche nell\'ultima copia della sezione', /senza i numeri di Giacenze: non vale come copia dei dati veri/.test(L.testoUltimaCopia(senzaG.esito.riga)), L.testoUltimaCopia(senzaG.esito.riga));
  const dvG = await datiVeriSu(senzaG.file);
  console.log(`  datiVeri.mjs sulla copia senza Giacenze: ${dvG.ultima} (uscita ${dvG.stato})`);
  verifica('datiVeri.mjs su quella copia fallisce', dvG.stato === 1 && !/ 0 fallite$/.test(dvG.ultima), `${dvG.stato} ${dvG.ultima}`);
  verifica('e dice perche\': manca la risposta di Giacenze', /ATTENZIONE: la copia .* non e' completa/.test(dvG.tutto) && new RegExp(`FALLITA: la copia ha tutto quello che serve ai tre controlli manca la risposta del sito ${chiaveG} \\(tempo scaduto\\)`).test(dvG.tutto), dvG.tutto.slice(0, 600));
  // Un archivio che non si legge e che i due moduli non usano: i numeri
  // tornerebbero lo stesso, quindi senza il controllo passerebbe per buona.
  const senzaO = await faiCopia({ Omologa: errore(500, 'servizio non disponibile') });
  verifica('senza un archivio: la riga del registro dice quale', senzaO.esito.riga.non_letti === 1 && senzaO.esito.riga.archivi_non_letti === 'Omologa', J({ n: senzaO.esito.riga.non_letti, quali: senzaO.esito.riga.archivi_non_letti }));
  const dvO = await datiVeriSu(senzaO.file);
  console.log(`  datiVeri.mjs sulla copia senza Omologa: ${dvO.ultima} (uscita ${dvO.stato})`);
  verifica('e datiVeri.mjs fallisce dicendo quale', dvO.stato === 1 && /FALLITA: la copia ha tutto quello che serve ai tre controlli l'archivio Omologa non si e' letto \(servizio non disponibile\)/.test(dvO.tutto), dvO.tutto.slice(0, 600));

  console.log('4. IL PESO E I TEMPI');
  const pesoVero = Math.round(readFileSync(join(CARTELLA, nomeCopia)).length / 1024);
  console.log(`  ${esito.archivi} archivi, ${esito.righe} righe, ${esito.kb} kB compressi (la copia dei dati veri: ${pesoVero} kB); ${conto.richieste} letture; preparata in ${(buona.durata / 1000).toFixed(1)} s sul PC.`);
  verifica('il registro dice il peso vero del file', esito.kb === Math.max(1, Math.round(file.size / 1024)));
  // Sul sito il ritmo e' di 40 richieste al minuto: le letture di questa copia
  // piu' le due funzioni (33) dicono quanti minuti ci vogliono.
  const minuti = Math.ceil((conto.richieste + 33) / L.RICHIESTE_AL_MINUTO);
  console.log(`  sul sito, a ${L.RICHIESTE_AL_MINUTO} richieste al minuto: circa ${minuti} minuti.`);
  verifica('sul sito ci vogliono pochi minuti', minuti <= 5, String(minuti));
} finally {
  rmSync(temporanea, { recursive: true, force: true });
}
verifica('nessuna copia dei dati veri lasciata nella cartella temporanea', !existsSync(temporanea), temporanea);

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
