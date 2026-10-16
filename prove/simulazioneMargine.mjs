// LA SIMULAZIONE DEL MARGINE COL COSTO DI SMOCO RACCOGLITORE (16/10/2026).
//
// Richiesta dell'utente del 16/10/2026: simulare il margine della commessa al
// variare del costo €/t di SMOCO come raccoglitore, scritto a mano, senza
// toccare nessun altro conto. SMOCO e' un fornitore interno: nella passiva le
// sue tonnellate costano zero, e il margine vero su quelle tonnellate e' piu'
// alto del vero. Qui si provano i due pezzi che fanno i numeri:
//   a. il campo `raccolta` di base44/shared/margine.ts su dati costruiti: le
//      tonnellate di SMOCO (con chi raccoglie per lui nella catena dei
//      subfornitori), la media degli esterni senza il prezzo unico, le righe
//      senza prezzo e il surplus, le secondarie e gli stoccaggi di SMOCO;
//   b. l'invarianza: tolto `raccolta`, ogni mese e ogni anno sono identici, in
//      JSON, a quelli del commit 19cf73e, sui dati costruiti e sui dati veri;
//      la funzione porta il campo alla pagina e non scrive niente;
//   c. sui dati veri dell'11/10/2026 i numeri del progetto: le tonnellate di
//      SMOCO mese per mese, gli esterni a 76,07 / 94,82 / 90,00 €/t, le
//      secondarie di SMOCO, la quadratura con le tonnellate del canale;
//   d. la regola, src/lib/simulazioneMargine.js: le letture del costo scritto,
//      il margine simulato a 60 €/t, il pareggio al centesimo, il confronto con
//      gli esterni, il «—» che resta «—», nessun totale dei canali, la memoria
//      del browser che lancia;
//   e. la guardia «non entra in niente»: la regola la importano solo la
//      sezione della scheda e i suoi file, il server non la nomina, e lei non
//      parla col server.
// Col codice di prima la prova fallisce nelle sue verifiche, non all'import.
//
// node prove/simulazioneMargine.mjs
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { calcolaMargineAnno } from '../base44/shared/margine.ts';
import { caricaLibPagine } from './dati/libPagine.mjs';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const J = (x) => JSON.stringify(x);
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const r3 = (v) => Math.round((v + Number.EPSILON) * 1000) / 1000;
const rac = (x) => (x && x.raccolta) || {};
const canale = (m, c) => m.canali.find(x => x.canale === c);

let S = null;
try { S = await caricaLibPagine('lib/simulazioneMargine'); } catch (e) { console.log('  (la regola non si carica: ' + String(e && e.message).slice(0, 120) + ')'); }

// ─── I DATI COSTRUITI ───
const base = { stato: 'terminato', cer: '160103', classe: 'A', provincia: 'BA', tipo_destinazione: 'imp', destinazione: 'BETA IMPIANTI' };
const giorno = (g) => ({ ordine_immesso_il: g, trasporto_iniziato_il: g, trasporto_finito_il: g });
const rete = (id, trasportatore, kg, g, altro = {}) => ({ ...base, id, id_ordine: 'ET' + id, numero_fir: 'F' + id, trasportatore, peso_effettivo: kg, automezzo: 'AA' + id, ...giorno(g), ...altro });
const aci = (id, trasportatore, kg, g, altro = {}) => rete(id, trasportatore, kg, g, { classe: 'C', regione: 'Puglia', peso_stimato: kg, id_ordine: 'EA' + id, ...altro });
const intervento = (id, trasportatore, kg, prezzo, costoRaccolta) => ({ id, stato: 'terminato', tipo_movimento: 'primaria', id_ordine: 'ER' + id, numero_fir: 'FIR ' + id,
  produttore: 'COMUNE DI PROVA', trasportatore, destinazione: 'GATIM S.R.L.', tipo_destinazione: 'imp', provincia: 'NA', classe: 'P', cer: '160103',
  ...giorno('2026-04-10T08:00:00.000Z'), peso_effettivo: kg, prezzo_attivo_t: prezzo, costo_raccolta_t: costoRaccolta, costo_trattamento_t: 90 });
const DATI = {
  reteAll: [
    rete('R1', 'SMOCO S.R.L.', 3000, '2026-01-10T08:00:00.000Z'),
    // il subraccoglitore di SMOCO: fattura tramite SMOCO, le sue tonnellate sono di SMOCO
    rete('R2', 'SUB RACCOLTE SRL', 1000, '2026-01-11T08:00:00.000Z'),
    rete('R3', 'ALFA SRL', 10000, '2026-01-12T08:00:00.000Z'),
    rete('R4', 'VIAGGI SRL', 2000, '2026-01-13T08:00:00.000Z'),
    rete('R5', 'SMOCO S.R.L.', 2000, '2026-02-10T08:00:00.000Z'),
    rete('R6', 'ALFA SRL', 5000, '2026-02-12T08:00:00.000Z'),
  ],
  aciAll: [
    aci('A1', 'SMOCO S.R.L.', 1500, '2026-02-05T08:00:00.000Z'),
    // prezzo unico: raccoglie e tratta lo stesso fornitore, la tariffa comprende il trattamento
    aci('A2', 'GREEN TYRE PROJECT SRL', 1600, '2026-02-06T08:00:00.000Z', { destinazione: 'GREEN TYRE PROJECT SRL' }),
    // uno stoccaggio di SMOCO: costa zero anche lui
    aci('A3', 'ALFA SRL', 2000, '2026-02-07T08:00:00.000Z', { destinazione: 'SMOCO S.R.L.', tipo_destinazione: 'stoc' }),
    // marzo: un raccoglitore senza tariffa, il margine del mese e' «—»
    aci('A4', 'SENZA PREZZO SRL', 1500, '2026-03-05T08:00:00.000Z'),
    aci('A5', 'SMOCO S.R.L.', 1500, '2026-03-06T08:00:00.000Z'),
  ],
  extraAll: [intervento('E1', 'SMOCO S.R.L.', 500, 200, 0), intervento('E2', 'EMMESSE SRLS', 700, 210, 115)],
  secondarieAll: [{ stato: 'terminato', cer: '160103', classe: 'A', id: 'S1', id_ordine: 'S1', numero_fir: 'FS1', peso_effettivo: 4000, ...giorno('2026-02-20T08:00:00.000Z'),
    stoccaggio: 'NAPPI SUD', trasportatore: 'SMOCO S.R.L.', destinazione: 'BETA IMPIANTI', tipo_destinazione: 'imp', automezzo: 'SM001' }],
  fornitori: [
    { id: 'f-smoco', ragione_sociale: 'SMOCO S.R.L.', stato: 'attivo', interno: true },
    { id: 'f-sub', ragione_sociale: 'SUB RACCOLTE SRL', stato: 'attivo', fattura_tramite_nome: 'SMOCO S.R.L.' },
    { id: 'f-alfa', ragione_sociale: 'ALFA SRL', stato: 'attivo' },
    { id: 'f-viaggi', ragione_sociale: 'VIAGGI SRL', stato: 'attivo' },
    { id: 'f-green', ragione_sociale: 'GREEN TYRE PROJECT SRL', stato: 'attivo' },
    { id: 'f-senza', ragione_sociale: 'SENZA PREZZO SRL', stato: 'attivo' },
    { id: 'f-beta', ragione_sociale: 'BETA IMPIANTI', stato: 'attivo' },
    { id: 'f-emmesse', ragione_sociale: 'EMMESSE SRLS', stato: 'attivo' },
    { id: 'f-gatim', ragione_sociale: 'GATIM S.R.L.', stato: 'attivo' },
    { id: 'f-nappi', ragione_sociale: 'NAPPI SUD', stato: 'attivo' },
  ],
  tariffe: [
    { id: 'a1', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo' },
    { id: 'a2', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: 'Puglia', valore: 240, unita_misura: '€/t', stato: 'attivo' },
    { id: 'p1', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Alfa s.r.l.', tipologia: 'RETE', valore: 60, unita_misura: '€/t' },
    { id: 'p2', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'TRATTAMENTO', fornitore_nome: 'Beta Impianti', tipologia: 'RETE', valore: 80, unita_misura: '€/t' },
    { id: 'p3', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Alfa s.r.l.', tipologia: 'ACI', valore: 90, unita_misura: '€/t' },
    { id: 'p4', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Viaggi srl', tipologia: 'RETE', valore: 400, unita_misura: '€/viaggio' },
    { id: 'p5', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Green Tyre Project srl', tipologia: 'ACI', valore: 225, unita_misura: '€/t', comprensiva_trattamento: true },
    { id: 'p6', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'TRATTAMENTO', fornitore_nome: 'Beta Impianti', tipologia: 'ACI', valore: 70, unita_misura: '€/t' },
  ],
  // un surplus di raccolta sulla rete a febbraio (come prove/margineSurplus.mjs)
  surplusAll: [{ id: 'fs-rete', gruppo: 'g-fs', nome: 'Fuel Surcharge', origine: 'CONSORZIO', tipologia: 'RETE', prestazione: 'RACCOLTA', a_chi: 'tutti',
    euro_t_passiva: 5, euro_t_attiva: 5, data_inizio_validita: '2026-02-01', data_fine_validita: '2026-02-28', stato: 'attivo' }],
};
const M = calcolaMargineAnno(DATI, 2026, 3);
const [RT, AC, EX] = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(c => canale(M, c));

console.log('a. IL CAMPO RACCOLTA SUI DATI COSTRUITI');
verifica('ogni mese e ogni anno dei tre canali ha il campo raccolta', M.canali.every(c => c.mesi.every(x => x.raccolta) && c.anno.raccolta), J(RT.mesi[0]).slice(0, 200));
const CAMPI = ['tonnellate_interni', 'interni', 'tonnellate_esterni', 'euro_esterni', 'euro_t_esterni', 'esterni', 'tonnellate_prezzo_unico', 'euro_prezzo_unico', 'tonnellate_senza_prezzo', 'surplus_esterni', 'secondarie_interni', 'impianti_interni'];
verifica('il campo ha i nomi del contratto, e solo quelli', M.canali.every(c => [...c.mesi, c.anno].every(x => J(Object.keys(rac(x)).sort()) === J([...CAMPI].sort()))), J(Object.keys(rac(RT.anno))));
const rg = rac(RT.mesi[0]);
verifica('rete gennaio: 4 t di SMOCO, di cui 1 t del subraccoglitore che fattura tramite SMOCO', rg.tonnellate_interni === 4 && J(rg.interni) === J([{ fornitore: 'SMOCO S.R.L.', tonnellate: 4, di_cui: [{ fornitore: 'SUB RACCOLTE SRL', tonnellate: 1 }] }]), J(rg.interni));
verifica('rete gennaio: esterni 12 t, 1.000 € (ALFA 10 t a 60 €/t, VIAGGI 2 t a 400 €/viaggio), 83,33 €/t', rg.tonnellate_esterni === 12 && rg.euro_esterni === 1000 && rg.euro_t_esterni === 83.33
  && J(rg.esterni) === J([{ fornitore: 'ALFA SRL', tonnellate: 10, euro: 600, euro_t: 60 }, { fornitore: 'VIAGGI SRL', tonnellate: 2, euro: 400, euro_t: 200 }]), J(rg));
verifica('rete gennaio: niente prezzo unico, niente senza prezzo, niente surplus, nessuna secondaria', rg.tonnellate_prezzo_unico === 0 && rg.euro_prezzo_unico === 0 && rg.tonnellate_senza_prezzo === 0 && rg.surplus_esterni === 0
  && J(rg.secondarie_interni) === J({ tonnellate: 0, viaggi: 0 }) && J(rg.impianti_interni) === J({ tonnellate: 0 }), J(rg));
const rf = rac(RT.mesi[1]);
verifica('rete febbraio: il surplus pagato ad ALFA (5 t x 5 €/t = 25 €) e\' a parte, fuori dalla media (60 €/t)', rf.surplus_esterni === 25 && rf.euro_esterni === 300 && rf.euro_t_esterni === 60 && RT.mesi[1].costo_surplus === 25, J(rf));
verifica('rete febbraio: la secondaria trasportata da SMOCO, 4 t in un viaggio, a costo zero', J(rf.secondarie_interni) === J({ tonnellate: 4, viaggi: 1 }), J(rf.secondarie_interni));
const ra = rac(RT.anno);
verifica('rete anno: 6 t di SMOCO (di cui 1 del subraccoglitore), esterni 17 t e 1.300 €, 76,47 €/t dalle somme', ra.tonnellate_interni === 6 && J(ra.interni) === J([{ fornitore: 'SMOCO S.R.L.', tonnellate: 6, di_cui: [{ fornitore: 'SUB RACCOLTE SRL', tonnellate: 1 }] }])
  && ra.tonnellate_esterni === 17 && ra.euro_esterni === 1300 && ra.euro_t_esterni === r2(1300 / 17) && ra.euro_t_esterni === 76.47, J(ra));
verifica('rete anno: la lista degli esterni unita per fornitore, per tonnellate', J(ra.esterni) === J([{ fornitore: 'ALFA SRL', tonnellate: 15, euro: 900, euro_t: 60 }, { fornitore: 'VIAGGI SRL', tonnellate: 2, euro: 400, euro_t: 200 }]), J(ra.esterni));
verifica('rete anno: surplus 25 e la secondaria di SMOCO', ra.surplus_esterni === 25 && J(ra.secondarie_interni) === J({ tonnellate: 4, viaggi: 1 }), J(ra));
const af = rac(AC.mesi[1]);
verifica('ACI febbraio: 1,6 t a prezzo unico (225 €/t, 360 €) fuori dalla media; esterni solo ALFA, 2 t a 90 €/t', af.tonnellate_prezzo_unico === 1.6 && af.euro_prezzo_unico === 360 && af.tonnellate_esterni === 2 && af.euro_t_esterni === 90
  && J(af.esterni) === J([{ fornitore: 'ALFA SRL', tonnellate: 2, euro: 180, euro_t: 90 }]), J(af));
verifica('ACI febbraio: 1,5 t di SMOCO e 2 t stoccate da SMOCO a costo zero', af.tonnellate_interni === 1.5 && J(af.impianti_interni) === J({ tonnellate: 2 }), J(af));
const am = rac(AC.mesi[2]);
verifica('ACI marzo: il raccoglitore senza tariffa e\' senza prezzo (1,5 t), nessun esterno paragonabile: media null, non zero', am.tonnellate_senza_prezzo === 1.5 && am.tonnellate_esterni === 0 && am.euro_t_esterni === null && am.esterni.length === 0, J(am));
verifica('ACI marzo: il margine del mese e\' «—» (prezzi mancanti), e quello dell\'anno', AC.mesi[2].margine === null && AC.mesi[2].testo_prezzi_mancanti !== '' && AC.anno.margine === null, J({ m: AC.mesi[2].margine, t: AC.mesi[2].testo_prezzi_mancanti }));
const aa = rac(AC.anno);
verifica('ACI anno: 3 t di SMOCO, prezzo unico 1,6 t, senza prezzo 1,5 t, esterni 2 t a 90 €/t, stoccaggi di SMOCO 2 t', aa.tonnellate_interni === 3 && aa.tonnellate_prezzo_unico === 1.6 && aa.euro_prezzo_unico === 360
  && aa.tonnellate_senza_prezzo === 1.5 && aa.tonnellate_esterni === 2 && aa.euro_t_esterni === 90 && aa.impianti_interni.tonnellate === 2, J(aa));
const ea = rac(EX.anno);
verifica('extra raccolta: 0,5 t di SMOCO (interno, 0 €), esterni EMMESSE 0,7 t a 115 €/t dall\'intervento', ea.tonnellate_interni === 0.5 && ea.tonnellate_esterni === 0.7 && ea.euro_esterni === 80.5 && ea.euro_t_esterni === 115
  && J(ea.esterni) === J([{ fornitore: 'EMMESSE SRLS', tonnellate: 0.7, euro: 80.5, euro_t: 115 }]), J(ea));
verifica('extra raccolta: un mese senza movimenti ha zeri e media null', rac(EX.mesi[0]).tonnellate_interni === 0 && rac(EX.mesi[0]).euro_t_esterni === null && rac(EX.mesi[0]).esterni.length === 0, J(rac(EX.mesi[0])));
let quadraCostruiti = true;
for (const c of M.canali) for (const x of [...c.mesi, c.anno]) {
  const r = rac(x);
  if (r3((r.tonnellate_interni || 0) + (r.tonnellate_esterni || 0) + (r.tonnellate_prezzo_unico || 0) + (r.tonnellate_senza_prezzo || 0)) !== x.tonnellate) quadraCostruiti = false;
}
verifica('le tonnellate del canale = SMOCO + esterni + prezzo unico + senza prezzo, in ogni mese e nell\'anno', quadraCostruiti);

// ─── L'INVARIANZA ───
console.log('b. TOLTO RACCOLTA, IL MARGINE E\' QUELLO DEL COMMIT 19cf73e');
const senzaRaccolta = (m) => {
  const c = JSON.parse(J(m));
  for (const k of c.canali) { for (const x of k.mesi) delete x.raccolta; delete k.anno.raccolta; }
  return c;
};
let PRIMA = null;
try {
  const testo = execSync('git show 19cf73e:base44/shared/margine.ts', { cwd: qui('..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const p = await build({ stdin: { contents: testo, resolveDir: qui('../base44/shared'), sourcefile: 'margine-19cf73e.ts', loader: 'ts' },
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' });
  PRIMA = await import('data:text/javascript;base64,' + Buffer.from(p.outputFiles[0].text).toString('base64'));
} catch (e) { console.log('  (git o il commit 19cf73e non disponibili: il confronto col codice di prima si salta) ' + String(e && e.message).slice(0, 100)); }
if (PRIMA) {
  const vecchio = PRIMA.calcolaMargineAnno(DATI, 2026, 3);
  verifica('dati costruiti: ogni mese e anno identico al carattere, tolto raccolta', J(senzaRaccolta(M)) === J(vecchio), `${J(senzaRaccolta(M)).slice(0, 200)}\n${J(vecchio).slice(0, 200)}`);
  verifica('...e il codice di prima non aveva il campo', !vecchio.canali[0].mesi[0].raccolta && !vecchio.canali[0].anno.raccolta);
  for (const fino of [0, 11]) verifica(`dati costruiti fino al mese ${fino}: identico`, J(senzaRaccolta(calcolaMargineAnno(DATI, 2026, fino))) === J(PRIMA.calcolaMargineAnno(DATI, 2026, fino)));
}
const fn = await caricaFunzione('calcolaMargine');
const F = await chiama(fn, { db: { PrimariaRete: DATI.reteAll, PrimariaAci: DATI.aciAll, ExtraRaccolta: DATI.extraAll, Secondaria: DATI.secondarieAll, Fornitore: DATI.fornitori, Tariffa: DATI.tariffe, SurplusTariffa: DATI.surplusAll }, ruolo: 'admin', corpo: { anno: 2026 } });
const fRete = (F.j.canali || []).find(c => c.canale === 'RETE');
verifica('la funzione porta il campo alla pagina, senza scrivere niente', F.stato === 200 && rac(fRete && fRete.anno).tonnellate_interni === 6 && rac(fRete && fRete.mesi[0]).euro_t_esterni === 83.33 && (F.scritte || []).length === 0, J(F.j).slice(0, 200));
const U = await chiama(fn, { db: {}, ruolo: 'user', corpo: { anno: 2026 } });
verifica('la funzione: costi, margini e raccolta solo all\'amministratore', U.stato !== 200 && !U.j.canali);

// ─── I DATI VERI ───
console.log('c. SUI DATI VERI DELL\'11/10/2026');
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
let V = null;
if (!copie.length) console.log('  copia dei dati veri assente: parte saltata');
else {
  const A = JSON.parse(gunzipSync(readFileSync(join(CARTELLA, copie[copie.length - 1]))).toString('utf8')).archivi;
  const veri = { reteAll: A.PrimariaRete, aciAll: A.PrimariaAci, extraAll: A.ExtraRaccolta, secondarieAll: A.Secondaria, fornitori: A.Fornitore, tariffe: A.Tariffa };
  V = { ...calcolaMargineAnno(veri, 2026, 9), calcolato_il: '2026-10-11T10:00:00.000Z' };
  if (PRIMA) verifica('dati veri: ogni mese e anno identico al commit 19cf73e, tolto raccolta', J(senzaRaccolta({ anno: V.anno, canali: V.canali })) === J(PRIMA.calcolaMargineAnno(veri, 2026, 9)));
  const [vR, vA, vE] = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(c => canale(V, c));
  verifica('il margine vero non cambia: rete 542.558,63 (30,5%), ACI 10.500,34 (30,0%), extra 54,32 (31,3%)', vR.anno.margine === 542558.63 && vR.anno.margine_pct === 30.5 && vA.anno.margine === 10500.34 && vA.anno.margine_pct === 30 && vE.anno.margine === 54.32 && vE.anno.margine_pct === 31.3,
    J([vR.anno.margine, vA.anno.margine, vE.anno.margine]));
  const SMOCO = {
    RETE: [200.08, 185.56, 240.74, 226.72, 253.7, 263.88, 308.02, 142.3, 253.68, 85.18],
    ACI: [20.64, 6.6, 20.14, 0, 9.32, 6.54, 11.98, 3.04, 4.9, 0],
    EXTRA_RACCOLTA: [0, 0, 0, 0, 0, 0, 0.46, 0, 0, 0],
  };
  for (const [c, attese] of Object.entries(SMOCO)) {
    const k = canale(V, c);
    verifica(`${c}: le tonnellate di SMOCO mese per mese`, J(k.mesi.map(x => rac(x).tonnellate_interni)) === J(attese), J(k.mesi.map(x => rac(x).tonnellate_interni)));
  }
  verifica('anno: 2.159,86 t di SMOCO sulla rete, 83,16 sull\'ACI, 0,46 sull\'extra raccolta', rac(vR.anno).tonnellate_interni === 2159.86 && rac(vA.anno).tonnellate_interni === 83.16 && rac(vE.anno).tonnellate_interni === 0.46,
    J([rac(vR.anno).tonnellate_interni, rac(vA.anno).tonnellate_interni, rac(vE.anno).tonnellate_interni]));
  verifica('nessuno raccoglie per SMOCO nel 2026: i di_cui sono vuoti', [vR, vA, vE].every(k => (rac(k.anno).interni || []).every(i => i.di_cui.length === 0)) && J((rac(vR.anno).interni || []).map(i => i.fornitore)) === J(['SMOCO S.R.L.']));
  const rv = rac(vR.anno), av = rac(vA.anno), ev = rac(vE.anno);
  verifica('rete: esterni 76,07 €/t (506.529,08 € su 6.658,69 t)', rv.euro_t_esterni === 76.07 && rv.euro_esterni === 506529.08 && rv.tonnellate_esterni === 6658.69, J({ m: rv.euro_t_esterni, e: rv.euro_esterni, t: rv.tonnellate_esterni }));
  const perF = Object.fromEntries((rv.esterni || []).map(e => [e.fornitore, e.euro_t]));
  verifica('rete per fornitore: Nappi Sud 58,00, Green Tyre 90,00, Pneuservice 100,00, Eco.Gea 473,37 a viaggio', perF['Nappi Sud Srl A Socio Unico'] === 58 && perF['GREEN TYRE PROJECT SRL'] === 90 && perF['PNEUSERVICE CONVERSANO SRL'] === 100 && perF['ECO.GEA SRL'] === 473.37 && (rv.esterni || []).length === 10, J(perF));
  verifica('ACI: esterni 94,82 €/t (5.630,64 € su 59,38 t), fuori 5,32 t di Green Tyre a prezzo unico (1.197,00 €)', av.euro_t_esterni === 94.82 && av.euro_esterni === 5630.64 && av.tonnellate_esterni === 59.38 && av.tonnellate_prezzo_unico === 5.32 && av.euro_prezzo_unico === 1197,
    J({ m: av.euro_t_esterni, t: av.tonnellate_esterni, u: av.tonnellate_prezzo_unico }));
  verifica('extra raccolta: esterni 90,00 €/t su 0,40 t soltanto', ev.euro_t_esterni === 90 && ev.tonnellate_esterni === 0.4, J(ev));
  verifica('nessuna riga esterna senza prezzo nel 2026, nessun surplus nella copia', [rv, av, ev].every(r => r.tonnellate_senza_prezzo === 0 && r.surplus_esterni === 0));
  verifica('secondarie di SMOCO: rete 786,82 t in 55 viaggi, ACI 80,70 t in 7; nessuno stoccaggio interno', J(rv.secondarie_interni) === J({ tonnellate: 786.82, viaggi: 55 }) && J(av.secondarie_interni) === J({ tonnellate: 80.7, viaggi: 7 })
    && rv.impianti_interni.tonnellate === 0 && av.impianti_interni.tonnellate === 0, J([rv.secondarie_interni, av.secondarie_interni]));
  let quadra = true;
  for (const k of [vR, vA]) for (const x of [...k.mesi, k.anno]) {
    const r = rac(x);
    if (r3((r.tonnellate_interni || 0) + (r.tonnellate_esterni || 0) + (r.tonnellate_prezzo_unico || 0) + (r.tonnellate_senza_prezzo || 0)) !== x.tonnellate) quadra = false;
  }
  verifica('rete e ACI: le tonnellate del canale = SMOCO + esterni + prezzo unico + senza prezzo, in ogni mese', quadra);
}

// ─── LA REGOLA ───
console.log('d. LA REGOLA DELLA SIMULAZIONE');
const WINANSI = new Set([...'€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'].map(c => c.charCodeAt(0)));
const winAnsi = (s) => [...String(s)].every(ch => { const n = ch.charCodeAt(0); return (n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff) || WINANSI.has(n); });
const testiDi = (sim) => [S.FRASE_SIMULAZIONE, S.testoParametri(sim.parametri), S.testoPeriodo(sim),
  ...sim.canali.flatMap(c => [c.nome, c.pareggio.testo, c.confronto.testo, ...c.note, ...c.mesi.map(x => x.perche), c.anno.perche])];
// il pareggio cercato a forza bruta, indipendente dalla regola: il piu' alto
// centesimo a cui anno.margine - somma dei mesi r2(t x p) non va sotto zero
const pareggioForzaBruta = (c) => {
  const resta = (k) => r2(c.anno.margine - r2(c.mesi.reduce((s, x) => s + r2(rac(x).tonnellate_interni * (k / 100)), 0)));
  let k = 0;
  while (resta(k + 1) >= 0) k++;
  return k / 100;
};
if (!S) verifica('la regola src/lib/simulazioneMargine.js si carica', false);
else {
  const L = S.leggiEuroT;
  verifica('le costanti del contratto', J(S.CANALI_SIMULAZIONE) === J(['RETE', 'ACI', 'EXTRA_RACCOLTA']) && J(S.NOMI_SIMULAZIONE) === J({ RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' })
    && S.CHIAVE_MEMORIA_SIMULAZIONE === 'eco_simulazione_margine'
    && S.FRASE_SIMULAZIONE === 'Simulazione: il costo €/t di SMOCO come raccoglitore è scritto a mano; il risultato non si salva e non entra nella fatturazione, nel margine vero né in nessun altro conto del gestionale.');
  verifica('leggiEuroT: vuoto e null sono «nessun valore», senza errore', J(L('')) === J({ valore: null, errore: '' }) && J(L('   ')) === J({ valore: null, errore: '' }) && J(L(null)) === J({ valore: null, errore: '' }) && J(L(undefined)) === J({ valore: null, errore: '' }));
  const letture = [['60', 60], ['60,5', 60.5], ['1.234,56', 1234.56], ['1.234', 1234], ['60.5', 60.5], ['60.50', 60.5], ['62,50 €/t', 62.5], ['€ 62,50', 62.5], ['62,50€', 62.5], [' 0 ', 0], [60, 60], [12.345, 12.35], ['12,345', 12.35], ['2.500.000', 2500000], ['1.23', 1.23]];
  for (const [t, v] of letture) verifica(`leggiEuroT(${J(t)}) = ${v}`, L(t).valore === v && L(t).errore === '', J(L(t)));
  verifica('leggiEuroT: un negativo e\' un errore, col trattino e col meno tipografico', L('-5').valore === null && L('-5').errore === 'Un costo non può essere negativo.' && L('−3,50').errore === 'Un costo non può essere negativo.' && L(-1).errore === 'Un costo non può essere negativo.');
  for (const t of ['abc', '60,5,5', '1.2345', '0.125', '12,', '6 0 x', '€', Number.NaN]) verifica(`leggiEuroT(${J(String(t))}): errore`, L(t).valore === null && L(t).errore === 'Scrivi un numero di euro per tonnellata, per esempio 62,50.', J(L(t)));
  verifica('valoriIniziali: un valore unico, campi vuoti', J(S.valoriIniziali()) === J({ uguali: true, unico: '', RETE: '', ACI: '', EXTRA_RACCOLTA: '' }));
  const pu = S.parametriDaValori({ ...S.valoriIniziali(), unico: '60', RETE: '1' });
  verifica('parametriDaValori: con «uguali» il valore unico vale per i tre canali', J(pu.parametri) === J({ RETE: 60, ACI: 60, EXTRA_RACCOLTA: 60 }) && J(pu.errori) === J({ RETE: '', ACI: '', EXTRA_RACCOLTA: '' }), J(pu));
  const pd = S.parametriDaValori({ uguali: false, unico: '99', RETE: '60', ACI: '-1', EXTRA_RACCOLTA: '' });
  verifica('parametriDaValori: canale per canale, con l\'errore di ciascuno', J(pd.parametri) === J({ RETE: 60, ACI: null, EXTRA_RACCOLTA: null }) && pd.errori.ACI === 'Un costo non può essere negativo.' && pd.errori.RETE === '' && pd.errori.EXTRA_RACCOLTA === '', J(pd));
  verifica('scriviEuro e scriviEuroT all\'italiana, «—» se il valore manca', S.scriviEuro(412967.03) === '412.967,03' && S.scriviEuro(-316.37) === '-316,37' && S.scriviEuro(0) === '0,00' && S.scriviEuro(null) === '—' && S.scriviEuro(undefined) === '—'
    && S.scriviEuroT(60) === '60,00 €/t' && S.scriviEuroT(null) === '—');
  verifica('testoParametri: uno per i tre canali, o canale per canale', S.testoParametri({ RETE: 60, ACI: 60, EXTRA_RACCOLTA: 60 }) === '60,00 €/t per i tre canali'
    && S.testoParametri({ RETE: 60, ACI: 55, EXTRA_RACCOLTA: null }) === 'Rete 60,00 €/t · ACI 55,00 €/t · Extra raccolta —', S.testoParametri({ RETE: 60, ACI: 55, EXTRA_RACCOLTA: null }));

  // sui dati costruiti
  const simC = S.simulaMargine({ ...M, calcolato_il: '2026-04-30T10:00:00.000Z' }, { RETE: 50, ACI: 50, EXTRA_RACCOLTA: 50 });
  verifica('simulaMargine: anno, calcolato_il, parametri e tre canali, e nient\'altro', J(Object.keys(simC || {})) === J(['anno', 'calcolato_il', 'parametri', 'canali']) && simC.canali.length === 3
    && J(simC.canali.map(c => c.canale)) === J(['RETE', 'ACI', 'EXTRA_RACCOLTA']) && simC.anno === 2026 && simC.calcolato_il === '2026-04-30T10:00:00.000Z', J(Object.keys(simC || {})));
  const chiavi = new Set();
  const raccogli = (x) => { if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { chiavi.add(k); raccogli(v); } };
  raccogli(simC);
  verifica('nessun campo somma i canali: niente totale, somma, complessivo', ![...chiavi].some(k => /totale|somma|complessiv/i.test(k)), [...chiavi].join(','));
  const sR = simC.canali[0];
  verifica('i campi di un canale e di un periodo sono quelli del contratto', J(Object.keys(sR)) === J(['canale', 'nome', 'euro_t', 'mesi', 'anno', 'pareggio', 'confronto', 'esterni', 'interni', 'note'])
    && J(Object.keys(sR.anno)) === J(['mese', 'tonnellate', 'ricavo', 'tonnellate_smoco', 'costo_simulato', 'margine_vero', 'margine_vero_pct', 'margine_simulato', 'margine_simulato_pct', 'margine_simulato_t', 'euro_t_esterni', 'tonnellate_esterni', 'perche'])
    && J(Object.keys(sR.confronto)) === J(['euro_t_esterni', 'tonnellate_esterni', 'scarto_euro_t', 'differenza_affidando', 'margine_alla_media', 'esito', 'testo']), J(Object.keys(sR)));
  verifica('rete a 50 €/t: gennaio 4 t x 50 = 200 € in meno, febbraio 2 t x 50 = 100', sR.mesi[0].costo_simulato === 200 && sR.mesi[0].margine_simulato === r2(RT.mesi[0].margine - 200)
    && sR.mesi[1].costo_simulato === 100 && sR.mesi[1].margine_simulato === r2(RT.mesi[1].margine - 100) && sR.mesi[0].tonnellate_smoco === 4 && sR.mesi[0].margine_vero === RT.mesi[0].margine, J(sR.mesi.slice(0, 2)));
  verifica('rete a 50 €/t, l\'anno: costo 300, margine, % sul ricavo e €/t sulle t del canale', sR.anno.costo_simulato === 300 && sR.anno.margine_simulato === r2(RT.anno.margine - 300)
    && sR.anno.margine_simulato_pct === Math.round((RT.anno.margine - 300) / RT.anno.ricavo * 1000) / 10 && sR.anno.margine_simulato_t === r2((RT.anno.margine - 300) / RT.anno.tonnellate) && sR.anno.euro_t_esterni === 76.47, J(sR.anno));
  verifica('rete: il pareggio e\' quello cercato a forza bruta', sR.pareggio.euro_t === pareggioForzaBruta(RT) && sR.pareggio.euro_t > 0, J({ p: sR.pareggio, f: pareggioForzaBruta(RT) }));
  verifica('rete: il confronto con la media degli esterni (76,47 €/t)', sR.confronto.euro_t_esterni === 76.47 && sR.confronto.tonnellate_esterni === 17 && sR.confronto.scarto_euro_t === -26.47
    && sR.confronto.differenza_affidando === r2((r2(4 * 76.47) + r2(2 * 76.47)) - (r2(4 * 50) + r2(2 * 50))) && sR.confronto.margine_alla_media === r2(RT.anno.margine - (r2(4 * 76.47) + r2(2 * 76.47))) && sR.confronto.esito === 'smoco', J(sR.confronto));
  // Chiusura del giro del 16/10/2026: il risparmio e' al centesimo il margine
  // simulato meno il margine alla media, i due numeri che lo stesso documento scrive.
  verifica('rete: il risparmio e\' il margine simulato meno il margine alla media', sR.confronto.differenza_affidando === r2(sR.anno.margine_simulato - sR.confronto.margine_alla_media), J({ risparmio: sR.confronto.differenza_affidando, simulato: sR.anno.margine_simulato, media: sR.confronto.margine_alla_media }));
  verifica('rete: le note dicono il subraccoglitore, il surplus degli esterni, quello sulle t di SMOCO, la secondaria e l\'anno fin qui',
    sR.note.some(n => n.includes('SUB RACCOLTE SRL') && n.includes('1,00 t')) && sR.note.some(n => /surplus pagato ai raccoglitori esterni \(25,00 €\)/.test(n))
    && sR.note.some(n => /Sulle 2,00 t di SMOCO Ecotyre paga anche il surplus/.test(n)) && sR.note.some(n => /viaggio di secondarie/.test(n) && n.includes('4,00 t'))
    && sR.note.some(n => n.includes('gennaio–aprile')), J(sR.note));
  verifica('rete: esterni e interni dell\'anno', J(sR.esterni) === J(ra.esterni) && J(sR.interni) === J(ra.interni));
  const sA = simC.canali[1];
  verifica('ACI: marzo con i prezzi mancanti resta «—» col perche\' del margine, anche simulato', sA.mesi[2].margine_simulato === null && sA.mesi[2].margine_simulato_pct === null && sA.mesi[2].margine_simulato_t === null
    && sA.mesi[2].costo_simulato === 75 && sA.mesi[2].perche === AC.mesi[2].testo_prezzi_mancanti && sA.mesi[2].perche !== '', J(sA.mesi[2]));
  verifica('ACI: l\'anno resta «—», il pareggio non si calcola e dice perche\'', sA.anno.margine_simulato === null && sA.anno.perche === AC.anno.testo_prezzi_mancanti && sA.pareggio.euro_t === null
    && sA.pareggio.testo.includes(AC.anno.testo_prezzi_mancanti) && sA.confronto.margine_alla_media === null, J(sA.pareggio));
  verifica('ACI: febbraio, con tutti i prezzi, e\' un numero', sA.mesi[1].margine_simulato === r2(AC.mesi[1].margine - 75) && sA.mesi[1].perche === '', J(sA.mesi[1]));
  verifica('ACI: la media e\' 90 €/t (ALFA), non 150 col prezzo unico dentro', sA.confronto.euro_t_esterni === 90 && sA.confronto.scarto_euro_t === -40, J(sA.confronto));
  verifica('ACI: le note dicono il prezzo unico, le righe senza prezzo, lo stoccaggio di SMOCO e l\'anno non calcolabile',
    sA.note.some(n => /1,60 t dei raccoglitori esterni sono a prezzo unico \(360,00 €\)/.test(n)) && sA.note.some(n => /1,50 t dei raccoglitori esterni non hanno un prezzo/.test(n))
    && sA.note.some(n => /2,00 t stoccate o trattate da SMOCO/.test(n)) && sA.note.some(n => /Il margine dell'anno non è calcolabile/.test(n) && n.includes('marzo')), J(sA.note));
  const sE = simC.canali[2];
  verifica('extra raccolta a 50 €/t: aprile 0,5 t x 50 = 25 €; media 115 €/t', sE.mesi[3].costo_simulato === 25 && sE.anno.costo_simulato === 25 && sE.anno.margine_simulato === r2(EX.anno.margine - 25) && sE.confronto.euro_t_esterni === 115, J(sE.anno));
  // senza parametro
  const simN = S.simulaMargine(M, { RETE: null, ACI: undefined });
  const nR = simN.canali[0];
  verifica('senza parametro: costi e margini simulati null, il confronto senza esito, ma pareggio e media ci sono', nR.euro_t === null && nR.mesi.every(x => x.costo_simulato === null && x.margine_simulato === null) && nR.anno.costo_simulato === null
    && nR.anno.margine_simulato === null && nR.pareggio.euro_t === sR.pareggio.euro_t && nR.confronto.euro_t_esterni === 76.47 && nR.confronto.margine_alla_media === sR.confronto.margine_alla_media
    && nR.confronto.esito === null && nR.confronto.scarto_euro_t === null && nR.confronto.differenza_affidando === null && J(simN.parametri) === J({ RETE: null, ACI: null, EXTRA_RACCOLTA: null }), J(nR.anno));
  verifica('senza parametro i margini veri restano', nR.anno.margine_vero === RT.anno.margine && nR.mesi[0].margine_vero === RT.mesi[0].margine);
  // SMOCO che non raccoglie: 0 t, il pareggio non si calcola
  const soloAlfa = calcolaMargineAnno({ ...DATI, reteAll: DATI.reteAll.filter(r => r.trasportatore === 'ALFA SRL'), aciAll: [], extraAll: [], secondarieAll: [] }, 2026, 1);
  const s0 = S.simulaCanale(canale(soloAlfa, 'RETE'), 60);
  verifica('0 t di SMOCO: il pareggio e\' null col perche\', il costo simulato zero', s0.pareggio.euro_t === null && /SMOCO non ha raccolto/.test(s0.pareggio.testo) && s0.anno.costo_simulato === 0 && s0.anno.margine_simulato === canale(soloAlfa, 'RETE').anno.margine, J(s0.pareggio));
  // un margine gia' negativo: nessun costo lo tiene in pari
  const negativo = calcolaMargineAnno({ ...DATI, tariffe: DATI.tariffe.map(t => (t.id === 'p1' ? { ...t, valore: 400 } : t)), aciAll: [], extraAll: [] }, 2026, 1);
  const sNeg = S.simulaCanale(canale(negativo, 'RETE'), 60);
  verifica('margine vero <= 0: il pareggio e\' null col perche\'', canale(negativo, 'RETE').anno.margine < 0 && sNeg.pareggio.euro_t === null && /nessun costo lo tiene in pari/.test(sNeg.pareggio.testo) && /-/.test(sNeg.pareggio.testo), J(sNeg.pareggio));
  // una risposta senza il campo raccolta (il calcolo di prima): niente simulazione, e non zero
  const vecchiaRisposta = senzaRaccolta(M);
  const sV = S.simulaCanale(vecchiaRisposta.canali[0], 60);
  verifica('una risposta senza raccolta: tonnellate di SMOCO e costi null, non zero, e si dice', sV.anno.tonnellate_smoco === null && sV.anno.costo_simulato === null && sV.anno.margine_simulato === null && sV.mesi[0].costo_simulato === null
    && sV.pareggio.euro_t === null && sV.anno.perche !== '' && sV.note.length === 1, J(sV.anno));
  verifica('simulaMargine senza dati: null', S.simulaMargine(null, {}) === null && S.simulaMargine({}, {}) === null);
  // margine a costi diversi
  const costi = S.margineACostiDiversi(RT, 50);
  verifica('margine a costi diversi: 0 €/t, il costo scritto, la media, il pareggio, in ordine', J(costi.map(x => x.euro_t)) === J([0, 50, 76.47, sR.pareggio.euro_t]) && costi[0].etichetta === 'nel gestionale oggi'
    && costi[0].costo_simulato === 0 && costi[0].margine_simulato === RT.anno.margine && costi[1].margine_simulato === sR.anno.margine_simulato && costi[3].margine_simulato >= 0
    && J(Object.keys(costi[0])) === J(['euro_t', 'etichetta', 'costo_simulato', 'margine_simulato', 'margine_simulato_pct']), J(costi));
  const costi0 = S.margineACostiDiversi(RT, 0);
  verifica('...senza doppioni: a 0 €/t il costo scritto si unisce a «nel gestionale oggi»', costi0.length === 3 && costi0[0].euro_t === 0 && /nel gestionale oggi/.test(costi0[0].etichetta) && /il costo scritto/.test(costi0[0].etichetta), J(costi0));
  verifica('testoPeriodo: gennaio–aprile 2026, un mese, dodici mesi', S.testoPeriodo(simC) === 'gennaio–aprile 2026'
    && S.testoPeriodo(S.simulaMargine(calcolaMargineAnno(DATI, 2026, 0), {})) === 'gennaio 2026' && S.testoPeriodo(S.simulaMargine(calcolaMargineAnno(DATI, 2026, 11), {})) === '2026', S.testoPeriodo(simC));
  verifica('dati costruiti: ogni frase in caratteri WinAnsi, niente meno tipografico', testiDi(simC).every(winAnsi) && testiDi(simC).every(t => !t.includes('−')) && testiDi(S.simulaMargine({ anno: 2026, canali: negativo.canali }, { RETE: 60 })).every(winAnsi),
    testiDi(simC).filter(t => !winAnsi(t)).join(' | '));

  // sui dati veri: i numeri del progetto
  if (V) {
    const intattoV = J(V);
    const sim = S.simulaMargine(V, { RETE: 60, ACI: 60, EXTRA_RACCOLTA: 60 });
    const [vR, vA, vE] = sim.canali;
    verifica('a 60 €/t, rete: costo 129.591,60, margine 412.967,03, 23,2%, 46,83 €/t', vR.anno.costo_simulato === 129591.6 && vR.anno.margine_simulato === 412967.03 && vR.anno.margine_simulato_pct === 23.2 && vR.anno.margine_simulato_t === 46.83, J(vR.anno));
    verifica('a 60 €/t, ACI: costo 4.989,60, margine 5.510,74, 15,7%, 37,27 €/t', vA.anno.costo_simulato === 4989.6 && vA.anno.margine_simulato === 5510.74 && vA.anno.margine_simulato_pct === 15.7 && vA.anno.margine_simulato_t === 37.27, J(vA.anno));
    verifica('a 60 €/t, extra raccolta: costo 27,60, margine 26,72, 15,4%, 31,07 €/t', vE.anno.costo_simulato === 27.6 && vE.anno.margine_simulato === 26.72 && vE.anno.margine_simulato_pct === 15.4 && vE.anno.margine_simulato_t === 31.07, J(vE.anno));
    verifica('a 60 €/t, i mesi della rete', J(vR.mesi.map(x => x.margine_simulato)) === J([34171.07, 43521.06, 41427.65, 44598.05, 56982.02, 49730.26, 53285.93, 23198.46, 54254.94, 11797.59]), J(vR.mesi.map(x => x.margine_simulato)));
    verifica('a 60 €/t, l\'ACI: aprile e settembre negativi gia\' senza SMOCO (-1.218,70; -22,37), settembre diventa -316,37', vA.mesi[3].margine_vero === -1218.7 && vA.mesi[3].margine_simulato === -1218.7 && vA.mesi[8].margine_vero === -22.37 && vA.mesi[8].margine_simulato === -316.37, J([vA.mesi[3], vA.mesi[8]]));
    verifica('pareggi: rete 251,20, ACI 126,26, extra raccolta 118,09 €/t', vR.pareggio.euro_t === 251.2 && vA.pareggio.euro_t === 126.26 && vE.pareggio.euro_t === 118.09, J([vR.pareggio, vA.pareggio, vE.pareggio]));
    for (const c of sim.canali) {
      const k = canale(V, c.canale);
      const al = S.simulaCanale(k, c.pareggio.euro_t).anno.margine_simulato, dopo = S.simulaCanale(k, r2(c.pareggio.euro_t + 0.01)).anno.margine_simulato;
      verifica(`${c.canale}: al pareggio il margine resta >= 0, un centesimo dopo va sotto zero; come la forza bruta`, al >= 0 && dopo < 0 && c.pareggio.euro_t === pareggioForzaBruta(k), J({ al, dopo, p: c.pareggio.euro_t }));
    }
    verifica('al pareggio resta: rete +1,79, ACI +0,56, extra raccolta 0,00; a 126,27 l\'ACI fa -0,27, a 118,10 l\'extra -0,01', S.simulaCanale(canale(V, 'RETE'), 251.2).anno.margine_simulato === 1.79 && S.simulaCanale(canale(V, 'ACI'), 126.26).anno.margine_simulato === 0.56
      && S.simulaCanale(canale(V, 'ACI'), 126.27).anno.margine_simulato === -0.27 && S.simulaCanale(canale(V, 'EXTRA_RACCOLTA'), 118.09).anno.margine_simulato === 0 && S.simulaCanale(canale(V, 'EXTRA_RACCOLTA'), 118.1).anno.margine_simulato === -0.01);
    verifica('confronto rete: scarto -16,07 €/t, raccogliere da se\' fa risparmiare 34.708,95, alla media il margine sarebbe 378.258,08', vR.confronto.euro_t_esterni === 76.07 && vR.confronto.scarto_euro_t === -16.07
      && vR.confronto.differenza_affidando === 34708.95 && vR.confronto.margine_alla_media === 378258.08 && vR.confronto.esito === 'smoco', J(vR.confronto));
    verifica('confronto ACI: 2.895,61 e 2.615,13 (5.510,74 - 2.615,13); extra raccolta: 13,80 e 12,92', vA.confronto.scarto_euro_t === -34.82 && vA.confronto.differenza_affidando === 2895.61 && vA.confronto.margine_alla_media === 2615.13
      && vE.confronto.scarto_euro_t === -30 && vE.confronto.differenza_affidando === 13.8 && vE.confronto.margine_alla_media === 12.92, J([vA.confronto, vE.confronto]));
    verifica('a 100 €/t la rete costa piu\' degli esterni: esito «esterni», affidare fa risparmiare', S.simulaCanale(canale(V, 'RETE'), 100).confronto.esito === 'esterni' && S.simulaCanale(canale(V, 'RETE'), 100).confronto.differenza_affidando === r2(S.simulaCanale(canale(V, 'RETE'), 100).anno.margine_simulato - S.simulaCanale(canale(V, 'RETE'), 100).confronto.margine_alla_media)
      && S.simulaCanale(canale(V, 'RETE'), 100).confronto.differenza_affidando < 0
      && S.simulaCanale(canale(V, 'RETE'), 76.07).confronto.esito === 'pari');
    // Chiusura del giro del 16/10/2026 (lo script del revisore S-2, risparmio.mjs):
    // col risparmio fatto come (media - costo) x t sull'anno, 9 casi su 27 non
    // tornavano al centesimo coi due margini scritti accanto (l'ACI a 60 €/t:
    // 2.895,63 contro 5.510,74 - 2.615,13 = 2.895,61).
    const nonTornano = [];
    let casiRisparmio = 0;
    for (const p of [0, 50, 55, 60, 62.5, 70, 80, 90, 100]) {
      for (const c of S.simulaMargine(V, { RETE: p, ACI: p, EXTRA_RACCOLTA: p }).canali) {
        if (c.anno.margine_simulato === null || c.confronto.margine_alla_media === null) continue;
        casiRisparmio++;
        const atteso = r2(c.anno.margine_simulato - c.confronto.margine_alla_media);
        if (c.confronto.differenza_affidando !== atteso) nonTornano.push(`${c.canale} a ${p}: ${c.confronto.differenza_affidando} invece di ${atteso}`);
      }
    }
    verifica('dati veri, da 0 a 100 €/t sui tre canali: il risparmio e\' sempre il margine simulato meno il margine alla media', casiRisparmio === 27 && nonTornano.length === 0, `${casiRisparmio} casi; ${nonTornano.join(' | ')}`);
    verifica('le note dei dati veri: il prezzo unico sull\'ACI, i viaggi di secondarie di SMOCO, l\'anno fin qui', vA.note.some(n => n.includes('5,32 t') && n.includes('1.197,00 €')) && vR.note.some(n => n.includes('55 viaggi') && n.includes('786,82 t'))
      && vA.note.some(n => n.includes('7 viaggi') && n.includes('80,70 t')) && vR.note.some(n => n.includes('gennaio–ottobre')), J([vR.note, vA.note]));
    verifica('testoPeriodo: gennaio–ottobre 2026', S.testoPeriodo(sim) === 'gennaio–ottobre 2026', S.testoPeriodo(sim));
    verifica('dati veri: ogni frase in caratteri WinAnsi', testiDi(sim).every(winAnsi) && testiDi(S.simulaMargine(V, {})).every(winAnsi), testiDi(sim).filter(t => !winAnsi(t)).join(' | '));
    verifica('la simulazione non tocca la risposta del margine: identica prima e dopo', J(V) === intattoV && canale(V, 'RETE').anno.margine === 542558.63 && !('costo_simulato' in canale(V, 'RETE').anno));
  }

  // la memoria del browser
  const SCRITTO = { uguali: false, unico: '', RETE: '60', ACI: '55,5', EXTRA_RACCOLTA: '' };
  const lancia = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); } };
  let senzaEccezioni = true, letto, scritto;
  try { letto = S.leggiMemoriaSimulazione(lancia); scritto = S.scriviMemoriaSimulazione(SCRITTO, lancia); } catch { senzaEccezioni = false; }
  verifica('memoria che lancia su getItem e setItem: niente eccezioni, campi vuoti e false', senzaEccezioni && J(letto) === J(S.valoriIniziali()) && scritto === false, J({ letto, scritto }));
  const proxyCheLancia = new Proxy({}, { get() { throw new Error('accesso negato'); } });
  senzaEccezioni = true;
  try { letto = S.leggiMemoriaSimulazione(proxyCheLancia); scritto = S.scriviMemoriaSimulazione(SCRITTO, proxyCheLancia); } catch { senzaEccezioni = false; }
  verifica('memoria che lancia anche solo a guardarla: niente eccezioni', senzaEccezioni && J(letto) === J(S.valoriIniziali()) && scritto === false);
  const descrittore = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError: localStorage bloccato'); } });
  senzaEccezioni = true;
  try { letto = S.leggiMemoriaSimulazione(); scritto = S.scriviMemoriaSimulazione(SCRITTO); } catch { senzaEccezioni = false; }
  verifica('localStorage del browser che lancia appena lo si guarda: niente eccezioni', senzaEccezioni && J(letto) === J(S.valoriIniziali()) && scritto === false);
  if (descrittore) Object.defineProperty(globalThis, 'localStorage', descrittore); else delete globalThis.localStorage;
  senzaEccezioni = true;
  try { letto = S.leggiMemoriaSimulazione(null); scritto = S.scriviMemoriaSimulazione(SCRITTO, null); } catch { senzaEccezioni = false; }
  verifica('senza memoria: campi vuoti e false', senzaEccezioni && J(letto) === J(S.valoriIniziali()) && scritto === false);
  const cassetto = new Map();
  const memoria = { getItem: (k) => (cassetto.has(k) ? cassetto.get(k) : null), setItem: (k, v) => cassetto.set(k, String(v)) };
  verifica('memoria vuota: i campi vuoti', J(S.leggiMemoriaSimulazione(memoria)) === J(S.valoriIniziali()));
  const fatto = S.scriviMemoriaSimulazione({ ...SCRITTO, segreto: 'no', RETE: 60 }, memoria);
  verifica('andata e ritorno: si salva sotto la chiave solo la forma dei campi, solo testi', fatto === true && [...cassetto.keys()].join() === 'eco_simulazione_margine'
    && J(JSON.parse(cassetto.get('eco_simulazione_margine'))) === J({ uguali: false, unico: '', RETE: '', ACI: '55,5', EXTRA_RACCOLTA: '' }), cassetto.get('eco_simulazione_margine'));
  S.scriviMemoriaSimulazione(SCRITTO, memoria);
  verifica('...e si rilegge uguale', J(S.leggiMemoriaSimulazione(memoria)) === J(SCRITTO), J(S.leggiMemoriaSimulazione(memoria)));
  cassetto.set('eco_simulazione_margine', '{non e\' json');
  verifica('una memoria guasta torna ai campi vuoti', J(S.leggiMemoriaSimulazione(memoria)) === J(S.valoriIniziali()));
  cassetto.set('eco_simulazione_margine', J({ uguali: 'si', unico: 5, RETE: ['x'], ACI: 'x'.repeat(200) }));
  const strana = S.leggiMemoriaSimulazione(memoria);
  verifica('una memoria di un\'altra forma si riporta alla forma dei campi', strana.uguali === true && strana.unico === '' && strana.RETE === '' && strana.ACI.length === 40 && strana.EXTRA_RACCOLTA === '', J(strana));
}

// ─── LA GUARDIA ───
console.log('e. LA SIMULAZIONE NON ENTRA IN NIENTE');
const sorgenti = (cartella) => {
  const fuori = [];
  const giro = (d) => {
    for (const n of readdirSync(d)) {
      if (n === 'node_modules' || n.startsWith('.')) continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) giro(p);
      else if (/\.(js|jsx|ts|tsx|mjs)$/.test(n)) fuori.push(p);
    }
  };
  if (existsSync(cartella)) giro(cartella);
  return fuori;
};
const RADICE = qui('..');
const rel = (p) => relative(RADICE, p).replace(/\\/g, '/');
const leggiSenzaR = (p) => readFileSync(p, 'utf8').replace(/\r/g, '');
const IMPORTA = /(?:from\s*|import\s*\(\s*|import\s+)['"][^'"]*\/simulazioneMargine(?:\.js)?['"]/;
const AMMESSI = ['src/components/fatturazione/SimulazioneMargine.jsx', 'src/lib/simulazioneMargineExport.js'];
const chiImporta = [...sorgenti(qui('../src')), ...sorgenti(qui('../base44'))].filter(p => IMPORTA.test(leggiSenzaR(p))).map(rel);
verifica('la regola la importano solo la sezione della scheda e i suoi file (PDF ed Excel)', chiImporta.every(p => AMMESSI.includes(p)), chiImporta.join(', '));
const nelServer = sorgenti(qui('../base44')).filter(p => /simulazioneMargine/i.test(leggiSenzaR(p))).map(rel);
verifica('il server non la nomina: nessun file di base44', nelServer.length === 0, nelServer.join(', '));
const REGOLA = qui('../src/lib/simulazioneMargine.js');
const regola = existsSync(REGOLA) ? leggiSenzaR(REGOLA) : '';
verifica('la regola esiste', regola.length > 0);
verifica('la regola non parla col server: niente base44, invoke, entities, fetch', !!regola && !/base44|invoke|entities|fetch/i.test(regola), (regola.match(/base44|invoke|entities|fetch/i) || [''])[0]);
const importi = regola.match(/^\s*import\b.*$/gm) || [];
verifica('la regola importa solo formatNumber, formatTonnellate, formatPercentuale da @/lib/utils, e niente di pigro', importi.length === 1
  && /^import \{ formatNumber, formatTonnellate, formatPercentuale \} from '@\/lib\/utils';$/.test(importi[0].trim()) && !/import\s*\(/.test(regola), importi.join(' | '));
verifica('la regola non scrive negli archivi: niente create, update, delete, bulkCreate', !/\.(create|update|delete|bulkCreate|bulkUpdate)\s*\(/.test(regola));
const margineSrc = leggiSenzaR(qui('../base44/shared/margine.ts'));
verifica('margine.ts: il paragrafo della raccolta in testa, e il campo nei mesi e nell\'anno', /LA RACCOLTA DI SMOCO E DEGLI ESTERNI \(16\/10\/2026\)/.test(margineSrc)
  && /raccolta: raccoltaDelMese\(costo, tariffePassivePerId\)/.test(margineSrc) && /raccolta: raccoltaDellAnno\(canali\[canale\]\.mesi\)/.test(margineSrc));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
