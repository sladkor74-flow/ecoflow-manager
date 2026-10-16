// LE ORE DEL PORTALE SUI DATI VERI (difetto 9, 16/10/2026).
//
// Il portale scrive l'ora ITALIANA, e il gestionale la salva com'e' scritta,
// con la Z per convenzione: '2026-01-31T23:55:47.000Z' e' il 31/01/2026 alle
// 23:55:47 italiane. Fino al 16/10/2026 i moduli la leggevano con giornoRoma, che
// le aggiungeva di nuovo l'ora italiana; ora la leggono con giornoPortale. Le
// prove costruite (prove/orePortaleCalcoli.mjs) dicono che ogni modulo legge
// bene un valore delle 23:30 del 31/12; questa dice che la regola regge sugli
// archivi veri, sulla copia in ../dati-veri/ (vedi prove/datiVeri.mjs, che sulla
// stessa copia pretende Giacenze = Dichiarazioni al chilo e gli stessi numeri del
// sito: deve restare verde con gli stessi attesi).
//
// LE REGOLE VALGONO SU OGNI COPIA, I NUMERI SOLO SULLA LORO (V2, obiezione 1). Su
// una copia nuova ci saranno piu' ordini immessi dopo le 22 e piu' dichiarazioni:
// i conteggi crescono senza che niente sia rotto. Quindi su qualunque copia:
//   1. la forma: ogni valore dei campi con l'ora (ORE_PORTALE) e di solo giorno
//      (GIORNI_PORTALE) negli archivi dei file del portale ha la forma dello
//      scrittore, 'AAAA-MM-GGThh:mm:ss.mmmZ', e giornoPortale lo legge. Se la
//      piattaforma un giorno restituisse questi campi in un'altra forma, lo si
//      vede qui, campo per campo, invece di perdere le date in silenzio;
//   2. il patto dello scrittore: inizio e fine trasporto sono sempre a
//      mezzanotte Z (e le date dell'extra raccolta, che la scheda scrive come
//      giorni);
//   3. il giorno: giornoPortale e' il giorno scritto, arrotondato al secondo, e
//      giornoRoma ne da' un altro esattamente quando l'ora scritta, letta come
//      istante UTC, cade dopo la mezzanotte italiana: dalle 23:00 con l'ora
//      solare, dalle 22:00 con l'ora legale. Si contano e si stampano per campo;
//   4. i derivati salvati delle primarie di rete: ogni differenza fra i campi
//      salvati e quelli ricalcolati (nr_giorni, scadenza_ordine,
//      mese_immissione, raccolta_nei_tempi) sta su un ordine della regola 3.
//      Mese, anno e settimane sono il periodo, e chi ha la fine del trasporto
//      non li cambia mai. Un ordine aperto o cancellato invece si colloca
//      all'immissione (dataPeriodo): se e' della regola 3 ed e' stato salvato
//      col codice di prima, porta il mese, l'anno o la settimana del giorno
//      dopo. Si ammette solo cosi': senza fine trasporto, nella regola 3, e col
//      valore salvato uguale a quello della lettura di prima (revisione del
//      16/10/2026: un cancellato immesso il 28/02 alle 23:43 restava a marzo
//      fino al caricamento dopo, e uno conservato che il file non riporta piu'
//      ci resta per sempre; la prova cadeva senza che niente fosse rotto). Su
//      una copia scaricata dopo un caricamento delle primarie fatto col codice
//      nuovo le differenze sono 0, salvo quei conservati;
//   5. i tempi medi di raccolta: per ogni anno, la somma dei giorni misurati
//      sale di un giorno per ogni terminato della regola 3 finito dopo il giorno
//      scritto della sua immissione, e i misurati crescono di quelli finiti
//      quel giorno stesso (prima non si misuravano: «immissione dopo il ritiro»).
// Sulla copia dell'11/10/2026 (riconosciuta dal nome e da meta.letto_dal) si
// pretendono anche i numeri della fotografia: 19 immissioni di rete (una cambia
// mese: ET26020377), 14 immissioni e 23 chiusure del report delle
// dichiarazioni, 0 negli altri campi; 19 nr_giorni, 19 scadenze, 1 mese di
// immissione; i giorni di raccolta +13 nel 2026, +5 nel 2025, +1 nel 2024, con
// le medie di rete 99,5415, 75,4641 e 44,8300. Su un'altra copia gli stessi
// conteggi si stampano senza confrontarli.
//
// Si leggono la copia piu' recente e, se c'e' ed e' un'altra, quella dell'11/10.
// Senza copie la prova si salta e lo dice. Gira due volte, con TZ=UTC e con
// TZ=Europe/Rome, e pretende gli stessi risultati. npm run prove
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) {
  console.log(`Nessuna copia dei dati veri in ${CARTELLA}: prova saltata.`);
  process.exit(0);
}

const FUSI = ['UTC', 'Europe/Rome'];
if (!process.env.ORE_PORTALE_DATI_VERI_FUSO) {
  let fallite = 0;
  const risultati = {};
  for (const fuso of FUSI) {
    const r = spawnSync(process.execPath, ['--no-warnings', fileURLToPath(import.meta.url)], {
      env: { ...process.env, TZ: fuso, ORE_PORTALE_DATI_VERI_FUSO: fuso }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    const righe = (r.stdout || '').split(/\r?\n/);
    const riga = righe.find(l => l.startsWith('RISULTATI '));
    risultati[fuso] = riga ? riga.slice('RISULTATI '.length) : null;
    console.log(`\n===== con TZ=${fuso} =====`);
    console.log(righe.filter(l => !l.startsWith('RISULTATI ')).join('\n').trim());
    if ((r.stderr || '').trim()) console.log(r.stderr.trim());
    if (r.status !== 0) fallite++;
  }
  console.log('\nGLI STESSI RISULTATI IN TUTTI E DUE I FUSI');
  const a = risultati.UTC, b = risultati['Europe/Rome'];
  if (a === null || b === null) {
    fallite++;
    console.log('  FALLITA: un fuso non ha restituito i risultati');
  } else if (a !== b) {
    fallite++;
    const ja = JSON.parse(a), jb = JSON.parse(b);
    const diversi = Object.keys({ ...ja, ...jb }).filter(k => JSON.stringify(ja[k]) !== JSON.stringify(jb[k]));
    console.log(`  FALLITA: ${diversi.length} risultati diversi fra UTC e Roma`);
    for (const k of diversi.slice(0, 15)) console.log(`    ${k}: UTC ${JSON.stringify(ja[k])} / Roma ${JSON.stringify(jb[k])}`);
  } else console.log(`  ${Object.keys(JSON.parse(a)).length} risultati, identici`);
  console.log(fallite ? `\nFALLITA in ${fallite} punti` : '\ntutto superato, in UTC e in Roma');
  process.exit(fallite ? 1 : 0);
}

// ===========================================================================
// Da qui in giu' gira una volta per fuso.
// ===========================================================================
// I moduli si importano interi: sul codice di prima (la controprova) le funzioni
// nuove possono mancare, e la prova deve cadere sulle verifiche, non sull'import.
const GI = await import('../base44/shared/giornoItaliano.ts');
const PR = await import('../base44/shared/primarie.ts');
const M = await import('../base44/shared/movimenti.ts');
const DE = await import('../base44/shared/dataEnrichment.ts');
const PA = await import('../base44/shared/primarieReteAnalytics.ts');
const { giornoRoma } = GI;
// Il giorno scritto, arrotondato al secondo: se giornoPortale manca si usa la
// regola scritta, cosi' sul codice di prima cadono le verifiche dei moduli.
const giornoPortale = GI.giornoPortale || ((v) => (v ? new Date(Math.round(Date.parse(v) / 1000) * 1000).toISOString().slice(0, 10) : ''));
const ORE = PR.ORE_PORTALE ? [...PR.ORE_PORTALE] : ['ordine_immesso_il', 'ordine_chiuso_il', 'data_immissione', 'data_chiusura', 'data_dichiarazione', 'data_esecuzione'];
const GIORNI = PR.GIORNI_PORTALE ? [...PR.GIORNI_PORTALE] : ['trasporto_iniziato_il', 'trasporto_finito_il', 'inizio_trasporto', 'fine_trasporto'];
// Gli archivi che si riempiono dai file del portale, con lo scrittore unico.
const ARCHIVI_PORTALE = ['PrimariaRete', 'PrimariaAci', 'Assegnato', 'AssegnatoAci', 'Secondaria', 'Terziaria', 'DichiarazioneTrattamento', 'OrdineNonDichiarato'];
// Le date dell'extra raccolta le scrive la scheda, come giorni (dataDaGiorno).
const CAMPI_EXTRA = ['ordine_immesso_il', 'trasporto_iniziato_il', 'trasporto_finito_il'];
const FORMA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MEZZANOTTE_Z = /T00:00:00\.000Z$/;

const COPIA_11_10 = 'treadrider-dati-veri-2026-10-11.json.gz';
const LETTA_11_10 = '2026-10-11T09:19:42.364Z';
const daLeggere = [...new Set([copie[copie.length - 1], ...(copie.includes(COPIA_11_10) ? [COPIA_11_10] : [])])];

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + (extra ? ' ' + extra : '')); } };
const RISULTATI = {};
const J = (x) => JSON.stringify(x);
const pieni = (righe, campo) => (righe || []).map(r => r && r[campo]).filter(v => v !== null && v !== undefined && v !== '');

// Lo scarto dell'ora italiana in un istante, in minuti: 60 con l'ora solare, 120
// con l'ora legale.
const ORA_ROMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const scartoRoma = (ms) => {
  const p = {};
  for (const x of ORA_ROMA.formatToParts(new Date(ms))) p[x.type] = x.value;
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000) / 60000);
};
const giornoDi = (ms) => new Date(ms).toISOString().slice(0, 10);

for (const nome of daLeggere) {
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + nome)).toString('utf8'));
  const A = DATI.archivi || {};
  const fotografia = nome === COPIA_11_10 && DATI.meta && DATI.meta.letto_dal === LETTA_11_10;
  const R = (RISULTATI[nome] = {});
  console.log(`\n######## ${nome}, letta dal ${DATI.meta && DATI.meta.letto_dal} ${fotografia ? '(la copia della fotografia dell\'11/10/2026)' : '(regole, senza i numeri della fotografia)'}`);
  const archivi = ARCHIVI_PORTALE.filter(a => Array.isArray(A[a]) && A[a].length);

  console.log('\n1. LA FORMA DELLO SCRITTORE');
  const fuoriForma = {};
  for (const a of archivi) for (const c of [...ORE, ...GIORNI]) {
    const valori = pieni(A[a], c);
    if (!valori.length) continue;
    const fuori = valori.filter(v => typeof v !== 'string' || !FORMA.test(v) || !giornoPortale(v));
    if (fuori.length) fuoriForma[`${a}.${c}`] = { quanti: fuori.length, esempi: fuori.slice(0, 3) };
  }
  R.fuori_forma = fuoriForma;
  verifica('ogni ora e ogni giorno del portale ha la forma dello scrittore e un giorno leggibile', Object.keys(fuoriForma).length === 0, J(fuoriForma));
  const millesimi999 = Object.fromEntries(archivi.map(a => [a, ORE.reduce((n, c) => n + pieni(A[a], c).filter(v => /\.999Z$/.test(String(v))).length, 0)]).filter(([, n]) => n));
  R.millesimi_999 = millesimi999;
  console.log(`  valori .999 (righe vecchie, si leggono arrotondati al secondo): ${J(millesimi999)}`);

  console.log('\n2. IL PATTO DELLO SCRITTORE: I GIORNI A MEZZANOTTE Z');
  const fuoriMezzanotte = {};
  for (const a of archivi) for (const c of GIORNI) {
    const n = pieni(A[a], c).filter(v => !MEZZANOTTE_Z.test(String(v))).length;
    if (n) fuoriMezzanotte[`${a}.${c}`] = n;
  }
  for (const c of CAMPI_EXTRA) {
    const n = pieni(A.ExtraRaccolta, c).filter(v => !/^\d{4}-\d{2}-\d{2}(T00:00:00(\.0+)?Z)?$/.test(String(v))).length;
    if (n) fuoriMezzanotte[`ExtraRaccolta.${c}`] = n;
  }
  R.fuori_mezzanotte = fuoriMezzanotte;
  verifica('inizio e fine trasporto, e le date dell\'extra raccolta, sono tutti a mezzanotte', Object.keys(fuoriMezzanotte).length === 0, J(fuoriMezzanotte));
  // Sui giorni giornoRoma e giornoPortale danno lo stesso giorno: e' per questo
  // che i lettori delle fini (periodi, Giacenze, Dichiarazioni) restano com'erano.
  let giorniDiversi = 0;
  for (const a of archivi) for (const c of GIORNI) for (const v of pieni(A[a], c)) if (giornoRoma(v) !== giornoPortale(v)) giorniDiversi++;
  R.giorni_diversi = giorniDiversi;
  verifica('sui campi di solo giorno giornoRoma e giornoPortale danno lo stesso giorno', giorniDiversi === 0, String(giorniDiversi));

  console.log('\n3. IL GIORNO DELLE ORE DEL PORTALE');
  const conta = {};
  const regola3 = new Map();   // archivio -> Set di id dei record la cui immissione cambia giorno
  let giornoSbagliato = 0, predizioneSbagliata = 0, arrotondatiAlGiornoDopo = 0;
  const esempi = [];
  for (const a of archivi) {
    regola3.set(a, new Set());
    for (const c of ORE) {
      const valori = (A[a] || []).filter(r => r && r[c]);
      if (!valori.length) continue;
      let diversi = 0, mesi = 0;
      const mesiCambiati = [];
      for (const r of valori) {
        const v = r[c];
        const ms = Date.parse(v);
        const scritto = giornoDi(Math.round(ms / 1000) * 1000);
        if (giornoPortale(v) !== scritto) { giornoSbagliato++; if (esempi.length < 5) esempi.push(`${a}.${c} ${v}: ${giornoPortale(v)}`); }
        if (scritto !== giornoDi(ms)) { arrotondatiAlGiornoDopo++; continue; }
        const minuti = Math.floor((ms - Date.UTC(+scritto.slice(0, 4), +scritto.slice(5, 7) - 1, +scritto.slice(8, 10))) / 60000);
        const dopoMezzanotte = minuti + scartoRoma(ms) >= 24 * 60;
        const cambia = giornoRoma(v) !== giornoPortale(v);
        if (cambia !== dopoMezzanotte) { predizioneSbagliata++; if (esempi.length < 5) esempi.push(`${a}.${c} ${v}: roma ${giornoRoma(v)} portale ${giornoPortale(v)}`); }
        if (cambia) {
          diversi++;
          if (giornoRoma(v).slice(0, 7) !== giornoPortale(v).slice(0, 7)) { mesi++; mesiCambiati.push(r.id_ordine || r.id); }
          if (c === 'ordine_immesso_il') regola3.get(a).add(r.id);
        }
      }
      conta[`${a}.${c}`] = { valori: valori.length, giorno_diverso: diversi, mese_diverso: mesi, ...(mesiCambiati.length ? { cambiano_mese: mesiCambiati.slice(0, 5) } : {}) };
      console.log(`  ${a}.${c}: ${valori.length} valori, giorno diverso ${diversi}, mese diverso ${mesi}${mesiCambiati.length ? ' (' + mesiCambiati.slice(0, 5).join(', ') + ')' : ''}`);
    }
  }
  R.regola3 = conta;
  verifica('giornoPortale e\' il giorno scritto nel file, arrotondato al secondo', giornoSbagliato === 0, `${giornoSbagliato} ${J(esempi)}`);
  verifica('giornoRoma da\' un altro giorno esattamente quando l\'ora scritta, letta come UTC, passa la mezzanotte italiana', predizioneSbagliata === 0, `${predizioneSbagliata} ${J(esempi)}`);
  R.arrotondati_al_giorno_dopo = arrotondatiAlGiornoDopo;
  console.log(`  valori che l'arrotondamento al secondo porta al giorno dopo (23:59:59.5 e oltre): ${arrotondatiAlGiornoDopo}`);

  console.log('\n4. I DERIVATI SALVATI DELLE PRIMARIE DI RETE');
  const P = A.PrimariaRete || [];
  const ricalcolati = DE.enrichRecords(P, 'PrimariaRete');
  const nr3 = regola3.get('PrimariaRete') || new Set();
  // Com'era: l'immissione letta col giorno di giornoRoma. Si rifa' sulla stessa
  // funzione con l'immissione spostata a mezzogiorno di quel giorno; serve qui e
  // nei tempi medi (punto 5).
  const comeEra = P.map(r => (r.ordine_immesso_il && giornoRoma(r.ordine_immesso_il) ? { ...r, ordine_immesso_il: giornoRoma(r.ordine_immesso_il) + 'T12:00:00.000Z' } : r));
  const ricalcolatiComeEra = DE.enrichRecords(comeEra, 'PrimariaRete');
  const PERIODO = ['mese', 'anno', 'settimane'];
  const differenze = {}, fuoriRegola = {};
  let periodiDiPrima = 0;
  for (const c of ['nr_giorni', 'scadenza_ordine', 'mese_immissione', 'raccolta_nei_tempi', ...PERIODO]) {
    let n = 0;
    const fuori = [];
    P.forEach((r, i) => {
      if (!(c in r)) return;   // un campo che l'archivio non ha non si confronta
      const salvato = r[c] ?? null, nuovo = ricalcolati[i][c] ?? null;
      if (String(salvato) === String(nuovo)) return;
      n++;
      // Il periodo di un ordine senza fine trasporto e' l'immissione: cambia solo
      // se l'ordine e' della regola 3 e il valore salvato e' quello di prima.
      const ammessa = nr3.has(r.id) && (!PERIODO.includes(c)
        || (!r.trasporto_finito_il && String(salvato) === String(ricalcolatiComeEra[i][c] ?? null)));
      if (!ammessa) fuori.push(`${r.id_ordine}: ${salvato} -> ${nuovo}`);
      else if (PERIODO.includes(c)) periodiDiPrima++;
    });
    differenze[c] = n;
    if (fuori.length) fuoriRegola[c] = { quanti: fuori.length, esempi: fuori.slice(0, 3) };
  }
  R.derivati = differenze;
  console.log(`  differenze fra salvato e ricalcolato: ${J(differenze)}`);
  if (periodiDiPrima) console.log(`  di cui mese, anno o settimana di un ordine senza fine trasporto, salvati col giorno di prima: ${periodiDiPrima}`);
  verifica('ogni differenza dei tempi e del mese di immissione sta su un ordine della regola 3; mese, anno e settimane cambiano solo su un ordine della regola 3 senza fine trasporto, salvati come li leggeva il codice di prima', Object.keys(fuoriRegola).length === 0, J(fuoriRegola));
  const immissione = (r) => giornoPortale(r.ordine_immesso_il);
  const finiti = P.filter(r => M.eTerminato(r) && M.giornoMovimento(r));
  verifica('i tempi di raccolta partono dal giorno scritto dell\'immissione', finiti.every(r => { const t = M.tempiRaccolta(r); return !immissione(r) ? t === null : t && t.scadenza === giornoDi(Date.parse(immissione(r) + 'T00:00:00Z') + 30 * 86400000); }));

  console.log('\n5. I TEMPI MEDI DI RACCOLTA');
  // Com'era: comeEra, dal punto 4.
  const anni = [...new Set(finiti.map(r => Number(M.giornoMovimento(r).slice(0, 4))))].sort();
  const tempi = {};
  for (const anno of anni) {
    const ora = PA.computeSlaMetrics(P, anno), prima = PA.computeSlaMetrics(comeEra, anno);
    const somma = (x) => x.trasportatori.reduce((s, t) => s + t.nr_giorni_sum, 0);
    const delloStesso = finiti.filter(r => nr3.has(r.id) && Number(M.giornoMovimento(r).slice(0, 4)) === anno && M.dateIncoerenti(r).length === 0);
    const unGiornoInPiu = delloStesso.filter(r => M.giornoMovimento(r) > immissione(r)).length;
    const oraMisurati = delloStesso.filter(r => M.giornoMovimento(r) === immissione(r)).length;
    tempi[anno] = { giorni_in_piu: somma(ora) - somma(prima), misurati_in_piu: ora.totale_ordini - prima.totale_ordini, media: Math.round(ora.avg_giorni * 10000) / 10000, media_prima: Math.round(prima.avg_giorni * 10000) / 10000 };
    console.log(`  ${anno}: giorni ${somma(prima)} -> ${somma(ora)} (+${somma(ora) - somma(prima)}), misurati ${prima.totale_ordini} -> ${ora.totale_ordini}, media ${prima.avg_giorni.toFixed(4)} -> ${ora.avg_giorni.toFixed(4)}`);
    verifica(`${anno}: un giorno in piu' per ogni terminato della regola 3 finito dopo la sua immissione`, somma(ora) - somma(prima) === unGiornoInPiu, `${somma(ora) - somma(prima)} contro ${unGiornoInPiu}`);
    verifica(`${anno}: e si misurano in piu' quelli finiti il giorno stesso dell'immissione`, ora.totale_ordini - prima.totale_ordini === oraMisurati, `${ora.totale_ordini - prima.totale_ordini} contro ${oraMisurati}`);
  }
  R.tempi = tempi;

  if (fotografia) {
    console.log('\nLA FOTOGRAFIA DELL\'11/10/2026');
    const g = (k) => (conta[k] || { giorno_diverso: 0, mese_diverso: 0 });
    verifica('19 immissioni di rete al giorno dopo, una al mese dopo: ET26020377', g('PrimariaRete.ordine_immesso_il').giorno_diverso === 19 && g('PrimariaRete.ordine_immesso_il').mese_diverso === 1
      && J(g('PrimariaRete.ordine_immesso_il').cambiano_mese) === '["ET26020377"]', J(g('PrimariaRete.ordine_immesso_il')));
    verifica('14 immissioni e 23 chiusure del report delle dichiarazioni, nessuna al mese dopo', g('DichiarazioneTrattamento.data_immissione').giorno_diverso === 14 && g('DichiarazioneTrattamento.data_chiusura').giorno_diverso === 23
      && g('DichiarazioneTrattamento.data_immissione').mese_diverso === 0 && g('DichiarazioneTrattamento.data_chiusura').mese_diverso === 0, J([g('DichiarazioneTrattamento.data_immissione'), g('DichiarazioneTrattamento.data_chiusura')]));
    const altri = Object.entries(conta).filter(([k]) => !['PrimariaRete.ordine_immesso_il', 'DichiarazioneTrattamento.data_immissione', 'DichiarazioneTrattamento.data_chiusura'].includes(k) && conta[k].giorno_diverso);
    verifica('0 in ogni altro campo', altri.length === 0, J(altri));
    verifica('nessun valore che l\'arrotondamento porta al giorno dopo', arrotondatiAlGiornoDopo === 0, String(arrotondatiAlGiornoDopo));
    verifica('979 valori .999: 601 in Secondaria e 378 in Terziaria', millesimi999.Secondaria === 601 && millesimi999.Terziaria === 378 && Object.keys(millesimi999).length === 2, J(millesimi999));
    const chiusureND = ['data_immissione', 'data_esecuzione', 'data_chiusura'].reduce((n, c) => n + pieni(A.OrdineNonDichiarato, c).filter(v => !MEZZANOTTE_Z.test(String(v))).length, 0);
    verifica('le date degli ordini non dichiarati sono tutte a mezzanotte', chiusureND === 0, String(chiusureND));
    verifica('derivati: 19 nr_giorni, 19 scadenze, 1 mese di immissione, nessun esito dei tempi, nessun mese, anno o settimana', differenze.nr_giorni === 19 && differenze.scadenza_ordine === 19 && differenze.mese_immissione === 1 && differenze.raccolta_nei_tempi === 0
      && differenze.mese === 0 && differenze.anno === 0 && differenze.settimane === 0, J(differenze));
    const t = (anno) => tempi[anno] || {};
    verifica('i giorni di raccolta: +13 nel 2026, +5 nel 2025, +1 nel 2024, e gli stessi ordini misurati', t(2026).giorni_in_piu === 13 && t(2025).giorni_in_piu === 5 && t(2024).giorni_in_piu === 1
      && t(2026).misurati_in_piu === 0 && t(2025).misurati_in_piu === 0 && t(2024).misurati_in_piu === 0, J(tempi));
    verifica('le medie di rete: 99,5415 nel 2026, 75,4641 nel 2025, 44,8300 nel 2024', t(2026).media === 99.5415 && t(2025).media === 75.4641 && t(2024).media === 44.83, J([t(2026).media, t(2025).media, t(2024).media]));
    verifica('che prima erano 99,5372, 75,4627 e 44,8297', t(2026).media_prima === 99.5372 && t(2025).media_prima === 75.4627 && t(2024).media_prima === 44.8297, J([t(2026).media_prima, t(2025).media_prima, t(2024).media_prima]));
  }
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
// Un risultato per riga, cosi' fra i due fusi si dice quale cambia.
const piatti = {};
for (const [copia, r] of Object.entries(RISULTATI)) for (const [k, v] of Object.entries(r)) piatti[copia + ': ' + k] = v;
console.log('RISULTATI ' + JSON.stringify(piatti));
process.exit(ko ? 1 : 0);
