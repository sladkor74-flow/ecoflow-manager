// LE ORE DEL PORTALE NEI CALCOLI CONDIVISI (difetto 9, 16/10/2026).
//
// Il portale scrive l'ora ITALIANA, e il gestionale la salva com'e' scritta,
// con la Z per convenzione: '2026-12-31T23:30:00.000Z' e' il 31/12/2026 alle
// 23:30 italiane. I moduli condivisi leggevano l'immissione, la chiusura e il
// giorno della dichiarazione con giornoRoma, che aggiungeva di nuovo l'ora
// italiana: un ordine immesso dopo le 22 d'estate o dopo le 23 d'inverno finiva
// al giorno dopo, e a capodanno nell'anno dopo. Ora li leggono con giornoPortale
// e annoPortale (giornoItaliano), il giorno scritto nel file. La fine del
// trasporto invece e' un giorno senza ora, salvato a mezzanotte Z, e resta su
// giornoRoma come i periodi, Giacenze e Dichiarazioni.
//
// Qui ogni modulo corretto riceve un valore delle 23:30 del 31/12 e deve dire il
// 31/12:
//   - movimenti (giornoOrdine, giornoElenco, annoElenco, meseElenco,
//     giornoImmissione, tempiRaccolta);
//   - dataEnrichment (mese, settimana e anno di un assegnato; i tempi di
//     raccolta e il mese di immissione di una primaria, con la replica di
//     ET26020377, immesso il 31/01/2026 alle 23:55);
//   - cruscotto (eta' dell'arretrato), filtroPeriodo (i senza fine trasporto da
//     segnalare), giacenzaPortale (i formulari da sistemare), giacenzaStoccaggi
//     (la chiusura, che decide che cosa arriva dopo la fotografia);
//   - evasioneAssegnati (gli ordini normalizzati, e controllaLista su una lista
//     salvata PRIMA della correzione, che ha in righe_json il giorno di
//     giornoRoma); evasioneAssegnatiDati (VERSIONE_REGOLE 3: un controllo fatto
//     con le regole 2 si rifa' da solo, sul banco con la funzione vera);
//   - ordiniEseguiti, storicoConservato, statoArchivi, agganciaDichiarazioni,
//     usciteDichiarate, primarieReteAnalytics e pivotCalculator.
// Gli specchi per il browser (src/lib/movimenti.js, src/lib/ordiniEseguiti.js)
// hanno lo stesso corpo: lo controlla prove/specchi.mjs.
//
// LA PROVA GIRA DUE VOLTE, con TZ=UTC (il server) e con TZ=Europe/Rome (il
// browser): si rilancia da sola e pretende in tutti e due i fusi lo stesso esito
// e gli stessi risultati.
//
// npm run prove
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FUSI = ['UTC', 'Europe/Rome'];

if (!process.env.ORE_PORTALE_CALCOLI_FUSO) {
  let fallite = 0;
  const risultati = {};
  for (const fuso of FUSI) {
    const r = spawnSync(process.execPath, ['--no-warnings', fileURLToPath(import.meta.url)], {
      env: { ...process.env, TZ: fuso, ORE_PORTALE_CALCOLI_FUSO: fuso }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
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
// nuove mancano, e la prova deve cadere sulle verifiche, non sull'import.
const M = await import('../base44/shared/movimenti.ts');
const DE = await import('../base44/shared/dataEnrichment.ts');
const CR = await import('../base44/shared/cruscotto.ts');
const FP = await import('../base44/shared/filtroPeriodo.ts');
const GP = await import('../base44/shared/giacenzaPortale.ts');
const GS = await import('../base44/shared/giacenzaStoccaggi.ts');
const EA = await import('../base44/shared/evasioneAssegnati.ts');
const OE = await import('../base44/shared/ordiniEseguiti.ts');
const SC = await import('../base44/shared/storicoConservato.ts');
const SA = await import('../base44/shared/statoArchivi.ts');
const AD = await import('../base44/shared/agganciaDichiarazioni.ts');
const UD = await import('../base44/shared/usciteDichiarate.ts');
const PA = await import('../base44/shared/primarieReteAnalytics.ts');
const PC = await import('../base44/shared/pivotCalculator.ts');
const { caricaFunzione, chiama } = await import('./dati/bancoFunzioni.mjs');
const { normalizzaRagioneSociale } = await import('../base44/shared/normalizzaRagioneSociale.ts');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + (extra ? ' ' + extra : '')); } };
// I risultati da confrontare fra i due fusi.
const RISULTATI = {};
const annota = (chiave, valore) => { RISULTATI[chiave] = valore === undefined ? null : valore; return valore; };
const J = (x) => JSON.stringify(x);

// Le ore del portale di questa prova, tutte nella forma che salva lo scrittore.
const ULTIMO_DELL_ANNO = '2026-12-31T23:30:00.000Z';   // 31/12/2026 alle 23:30 italiane
const ET26020377 = '2026-01-31T23:55:47.000Z';          // 31/01/2026 alle 23:55:47, il caso vero

// R1, terminato: immesso il 31/12 alle 23:30, finito il 15/01, chiuso il 18/01 alle 23:45.
const R1 = {
  id: 'r1', id_ordine: 'ET26999001', numero_fir: 'FIR R1', stato: 'terminato', trasportatore: 'ALFA SRL', provincia: 'NA', classe: 'P', prodotto: 'P - fino a 35 kg', peso_effettivo: 4000,
  ordine_immesso_il: ULTIMO_DELL_ANNO, trasporto_iniziato_il: '2027-01-15T00:00:00.000Z', trasporto_finito_il: '2027-01-15T00:00:00.000Z', ordine_chiuso_il: '2027-01-18T23:45:00.000Z',
};
// A1, assegnato: immesso il 31/12 alle 23:30.
const A1 = { id: 'a1', id_ordine: 'ET26999002', stato: 'assegnato', trasportatore: 'ALFA SRL', provincia: 'NA', regione: 'Campania', classe: 'P', ragione_sociale: 'GOMMISTA UNO', peso_stimato: 1500, ordine_immesso_il: ULTIMO_DELL_ANNO };
// E1, la replica di ET26020377: immesso il 31/01/2026 alle 23:55, finito il 06/02/2026.
const E1 = {
  id: 'e1', id_ordine: 'ET26020377', stato: 'terminato', trasportatore: 'ALFA SRL', provincia: 'NA', classe: 'P', prodotto: 'P - fino a 35 kg', peso_effettivo: 2000,
  ordine_immesso_il: ET26020377, trasporto_iniziato_il: '2026-02-06T00:00:00.000Z', trasporto_finito_il: '2026-02-06T00:00:00.000Z', ordine_chiuso_il: '2026-02-10T09:12:00.000Z',
};
// Un cancellato e un terminato senza fine trasporto, immessi il 31/12 alle 23:30.
const C1 = { id: 'c1', id_ordine: 'ET26999003', stato: 'cancellato', trasportatore: 'ALFA SRL', provincia: 'NA', classe: 'P', ordine_immesso_il: ULTIMO_DELL_ANNO };
const T1 = { id: 't1', id_ordine: 'ET26999004', numero_fir: 'FIR T1', stato: 'terminato', trasportatore: 'ALFA SRL', provincia: 'NA', classe: 'P', prodotto: 'P - fino a 35 kg', peso_effettivo: 3000, ordine_immesso_il: ULTIMO_DELL_ANNO };

console.log(`TZ=${process.env.ORE_PORTALE_CALCOLI_FUSO}`);

console.log('\nMOVIMENTI (movimenti.ts e lo specchio src/lib/movimenti.js)');
{
  const v = annota('movimenti.cancellato', [M.giornoOrdine(C1), M.annoOrdine(C1), M.meseOrdine(C1), M.giornoElenco(C1), M.annoElenco(C1), M.meseElenco(C1)]);
  verifica('un cancellato immesso il 31/12 alle 23:30: giornoOrdine, annoOrdine, meseOrdine, giornoElenco, annoElenco e meseElenco dicono il 31/12/2026', J(v) === J(['2026-12-31', 2026, 'Dicembre', '2026-12-31', 2026, 'Dicembre']), J(v));
  verifica('giornoImmissione, il punto solo da cui si legge l\'immissione: il 31/12', typeof M.giornoImmissione === 'function' && annota('movimenti.giornoImmissione', M.giornoImmissione(A1)) === '2026-12-31',
    typeof M.giornoImmissione === 'function' ? M.giornoImmissione(A1) : 'manca');
  const t = annota('movimenti.tempiRaccolta', M.tempiRaccolta(R1));
  verifica('tempiRaccolta: dal 31/12 al 15/01 sono 15 giorni, scadenza il 30/01/2027', t && t.scadenza === '2027-01-30' && t.giorni === 15 && t.esito === 'OK', J(t));
  const e = annota('movimenti.tempiET26020377', M.tempiRaccolta(E1));
  verifica('tempiRaccolta di ET26020377: 6 giorni, scadenza il 02/03/2026', e && e.scadenza === '2026-03-02' && e.giorni === 6, J(e));
  verifica('la fine trasporto resta un giorno: giornoMovimento non cambia', M.giornoMovimento(R1) === '2027-01-15' && M.giornoMovimento({ trasporto_finito_il: '2026-09-30T22:00:00.000Z' }) === '2026-10-01');
  verifica('un terminato si colloca sempre sulla fine, non sull\'immissione', M.giornoElenco(R1) === '2027-01-15' && M.annoElenco(R1) === 2027);
}

console.log('\nARRICCHIMENTO (dataEnrichment.ts)');
{
  const a = annota('enrich.assegnato', (({ mese, anno, settimane }) => ({ mese, anno, settimane }))(DE.enrichRecord(A1, 'Assegnato')));
  verifica('un assegnato immesso il 31/12 alle 23:30 e\' di dicembre 2026, settimana 53', a.mese === 'Dicembre' && a.anno === 2026 && a.settimane === 53, J(a));
  const e = annota('enrich.ET26020377', (({ mese, anno, mese_immissione, nr_giorni, scadenza_ordine, raccolta_nei_tempi }) => ({ mese, anno, mese_immissione, nr_giorni, scadenza_ordine, raccolta_nei_tempi }))(DE.enrichRecord(E1, 'PrimariaRete')));
  verifica('ET26020377: immesso a gennaio, 6 giorni, scadenza il 02/03, raccolto a febbraio',
    e.mese_immissione === 'Gennaio' && e.nr_giorni === 6 && e.scadenza_ordine === '2026-03-02T12:00:00.000Z' && e.mese === 'Febbraio' && e.anno === 2026 && e.raccolta_nei_tempi === 'OK', J(e));
  const c = annota('enrich.cancellato', (({ mese, anno }) => ({ mese, anno }))(DE.enrichRecord(C1, 'PrimariaRete')));
  verifica('un cancellato, che non ha trasporto, si colloca all\'immissione: dicembre 2026', c.mese === 'Dicembre' && c.anno === 2026, J(c));
  const t = annota('enrich.campiTempi', DE.campiTempiRaccolta(R1));
  verifica('i campi dei tempi di R1: 15 giorni, scadenza il 30/01/2027', t.nr_giorni === 15 && t.scadenza_ordine === '2027-01-30T12:00:00.000Z' && t.raccolta_nei_tempi === 'OK', J(t));
  // La fine si legge come la leggono i periodi, Giacenze e Dichiarazioni
  // (giornoMovimento): sui valori salvati, sempre a mezzanotte Z, e' lo stesso
  // giorno; qui una mezzanotte italiana vecchia, 22:00Z del 30/09, resta ottobre.
  const f = DE.enrichRecord({ stato: 'terminato', trasporto_finito_il: '2026-09-30T22:00:00.000Z' }, 'PrimariaRete');
  verifica('la fine trasporto resta letta come i periodi (giornoMovimento)', f.mese === 'Ottobre' && f.anno === 2026 && f.mese === M.periodoMovimento({ trasporto_finito_il: '2026-09-30T22:00:00.000Z' }).mese, J([f.mese, f.anno]));
}

console.log('\nCRUSCOTTO (cruscotto.ts): ETA\' DELL\'ARRETRATO');
{
  const eta = annota('cruscotto.eta', CR.etaArretrato([A1], '2027-01-10'));
  verifica('immesso il 31/12: al 10/01 aspetta da 10 giorni', eta.piu_vecchio && eta.piu_vecchio.immesso_il === '2026-12-31' && eta.piu_vecchio.giorni === 10 && eta.entro_30 === 1, J(eta.piu_vecchio));
  const zero = CR.etaArretrato([A1], '2026-12-31');
  verifica('e il 31/12 stesso aspetta da 0 giorni', zero.piu_vecchio && zero.piu_vecchio.giorni === 0, J(zero.piu_vecchio));
}

console.log('\nFILTRO PERIODO (filtroPeriodo.ts): I SENZA FINE TRASPORTO DA SEGNALARE');
{
  const dic = annota('filtroPeriodo.dicembre', FP.dateDaSegnalare([T1], 2026, 11));
  verifica('un terminato senza fine immesso il 31/12 alle 23:30 si segnala nella fatturazione di dicembre 2026', dic.senza_fine.length === 1 && dic.senza_fine[0].immesso_il === '2026-12-31', J(dic.senza_fine));
  const testo = FP.anomalieDateFormulari([T1], 2026, 11, 'RETE').map(a => a.descrizione).join(' ');
  verifica('e la frase dice «immesso il 31/12/2026»', /immesso il 31\/12\/2026/.test(testo), testo.slice(0, 200));
}

console.log('\nGIACENZE (giacenzaPortale.ts e giacenzaStoccaggi.ts)');
{
  const m = annota('giacenzaStoccaggi.movimento', GS.movimentoStoccaggio(R1, { canale: 'RETE', verso: 'ingresso', classe: 'P' }));
  verifica('la chiusura delle 23:45 del 18/01 e\' del 18/01; la fine resta il 15/01', m.chiuso_il === '2027-01-18' && m.finito_il === '2027-01-15', J([m.chiuso_il, m.finito_il]));
  const f = GP.formulariDaSistemare({ anno: 2026 });
  f.segna(T1, { tipo: 'primaria', canale: 'RETE', ruolo: 'imp', verso: 'arrivo', sito: 'IRIGOM SRL', controparte: 'ALFA SRL' });
  const ordini = (f.gruppi(null) || []).flatMap(g => g.ordini || []);
  annota('giacenzaPortale.formulari', ordini.map(o => [o.id_ordine, o.immesso_il, o.fuori_anno]));
  verifica('un senza fine trasporto immesso il 31/12/2026 e\' dell\'anno 2026: resta nei formulari da sistemare, immesso il 31/12', ordini.length === 1 && ordini[0].immesso_il === '2026-12-31' && ordini[0].fuori_anno === false,
    J(ordini.map(o => [o.id_ordine, o.immesso_il, o.fuori_anno])));
}

console.log('\nEVASIONE ASSEGNATI (evasioneAssegnati.ts)');
{
  const p = EA.normalizzaPrimaria(R1, 'rete'), a = EA.normalizzaAssegnato(A1, 'rete'), c = EA.normalizzaCancellato(C1, 'rete');
  annota('evasione.normalizzati', [p.immesso, a.immesso, c.immesso, p.fine]);
  verifica('normalizzaPrimaria, normalizzaAssegnato e normalizzaCancellato: immesso il 31/12', p.immesso === '2026-12-31' && a.immesso === '2026-12-31' && c.immesso === '2026-12-31' && p.fine === '2027-01-15', J([p.immesso, a.immesso, c.immesso, p.fine]));
  verifica('le regole dell\'evasione sono alla versione 3', annota('evasione.versione', EA.VERSIONE_REGOLE) === 3, String(EA.VERSIONE_REGOLE));

  // UNA LISTA SALVATA PRIMA DELLA CORREZIONE (V1, obiezione 1). arricchisciLista
  // fissa il giorno di immissione nelle righe al caricamento della lista, e
  // quelle caricate prima del difetto 9 lo hanno con giornoRoma: l'ordine
  // immesso il 31/12/2025 alle 23:30 vi risulta del 01/01/2026. controllaLista
  // deve prendere il giorno dall'ordine vivo, e la copia salvata solo per un
  // ordine che non c'e' piu' in nessun archivio.
  const vecchio = { id_ordine: 'ET25999999', stato: 'assegnato', ordine_immesso_il: '2025-12-31T23:30:00.000Z', trasportatore: 'ALFA SRL', provincia: 'BA', ragione_sociale: 'PRODUTTORE UNO', classe: 'M', id_pdr: 1 };
  const nuovo = { id_ordine: 'ET26000001', stato: 'assegnato', ordine_immesso_il: '2026-01-01T09:00:00.000Z', trasportatore: 'ALFA SRL', provincia: 'BA', ragione_sociale: 'PRODUTTORE DUE', classe: 'M', id_pdr: 2 };
  const ass = [EA.normalizzaAssegnato(vecchio, 'rete'), EA.normalizzaAssegnato(nuovo, 'rete')];
  // un ritiro di rete nel mese, cosi' il mese si valuta
  const ter = EA.normalizzaPrimaria({ id_ordine: 'ET26000500', stato: 'terminato', ordine_immesso_il: '2026-01-05T10:00:00.000Z', trasporto_iniziato_il: '2026-01-29T00:00:00.000Z', trasporto_finito_il: '2026-01-29T00:00:00.000Z', trasportatore: 'ALFA SRL', provincia: 'BA', ragione_sociale: 'PRODUTTORE TRE', classe: 'M', id_pdr: 3, peso_effettivo: 4000 }, 'rete');
  const salvata = (id, posizione, data_immissione) => ({ posizione, id_ordine: id, prioritaria: false, motivo_priorita: '', file: 'alfa gennaio.xlsx', foglio: 'Foglio1', riga_excel: posizione + 1, canale: 'rete', data_immissione, produttore: '', comune: '', provincia: 'BA', regione: 'Puglia', classe: 'M', pdr: '', trasportatore_assegnato: 'ALFA SRL', stato_al_caricamento: 'assegnata' });
  const righe = [
    salvata('ET26000001', 1, '2026-01-01'),
    salvata('ET25999999', 2, '2026-01-01'),   // salvata col giorno di giornoRoma: in realta' e' del 31/12/2025
    salvata('ET25888888', 3, '2025-11-30'),   // un ordine che non e' piu' in nessun archivio
  ];
  const esito = EA.controllaLista({
    lista: { righe, caricata_il: '2026-01-02T08:00:00.000Z', inviata_il: '2026-01-02T08:00:00.000Z' },
    raccoglitore: { chiave: ter.chiaveTrasp, nome: 'ALFA SRL' }, anno: 2026, mese: 1, oggi: '2026-01-30',
    terminati: [ter], assegnati: ass, altreListe: [], targetKg: null, cancellati: [],
  });
  const riga = (id) => (esito.esito.righe || []).find(r => r.id_ordine === id) || {};
  annota('evasione.lista', { righe: (esito.esito.righe || []).map(r => [r.id_ordine, r.data_immissione, r.stato]), alert: esito.alert.map(x => x.tipo), arretrate_aperte: esito.riepilogo.arretrate_aperte });
  verifica('la riga salvata col 01/01 prende il giorno dell\'ordine vivo: 31/12/2025', riga('ET25999999').data_immissione === '2025-12-31', J(riga('ET25999999')));
  verifica('e quindi e\' arretrata: una richiesta aperta immessa prima del 2026', esito.riepilogo.arretrate_aperte === 1, J(esito.riepilogo));
  const arretrate = esito.alert.find(x => x.tipo === 'arretrate');
  verifica('con l\'alert delle arretrate, che dice «ET25999999 del 31/12/2025»', !!arretrate && /ET25999999 del 31\/12\/2025/.test(arretrate.messaggio), J(esito.alert.map(x => x.tipo)));
  const posto = (id) => (esito.esito.righe || []).findIndex(r => r.id_ordine === id);
  verifica('nella cronologia viene prima delle richieste del 2026', posto('ET25999999') >= 0 && posto('ET25999999') < posto('ET26000001'), J((esito.esito.righe || []).map(r => r.id_ordine)));
  verifica('un ordine che non e\' piu\' in nessun archivio tiene la data salvata', riga('ET25888888').data_immissione === '2025-11-30' && riga('ET25888888').stato === 'non_piu_presente', J(riga('ET25888888')));
  verifica('l\'esito salvato porta le regole 3', esito.esito.regole === 3, String(esito.esito.regole));
}

console.log('\nEVASIONE ASSEGNATI (evasioneAssegnatiDati.ts): UN CONTROLLO CON LE REGOLE 2 SI RIFA\' DA SOLO');
{
  // Sul banco, con la funzione vera evasioneAssegnati e l'orologio fermo al
  // 20/10/2026. Il controllo della lista e' stato eseguito il 16/10/2026, dopo
  // il limite di prima (15/10/2026) e prima di quello nuovo (15/11/2026), sulle
  // stesse primarie e con lo stesso target: con le regole 2 e' superato e si
  // rifa', con le regole 3 resta.
  const VeraData = Date;
  const adesso = VeraData.parse('2026-10-20T10:00:00Z');
  class DataFinta extends VeraData {
    constructor(...a) { if (a.length === 0) super(adesso); else super(...a); }
    static now() { return adesso; }
  }
  const NAPPI = 'NAPPI SUD SRL';
  const kN = normalizzaRagioneSociale(NAPPI);
  const db = (regole) => ({
    UploadLog: [{ id: 'u1', tipo_file: 'primarie', esito: 'successo', created_date: '2026-10-10T08:00:00' }],
    Fornitore: [{ id: 'f1', ragione_sociale: NAPPI }],
    PrimariaRete: [{ id: 'p1', id_ordine: 'ET26000010', stato: 'terminato', trasportatore: NAPPI, ordine_immesso_il: '2026-10-01T06:00:00.000Z', trasporto_iniziato_il: '2026-10-05T00:00:00.000Z', trasporto_finito_il: '2026-10-05T00:00:00.000Z', peso_effettivo: 4000, classe: 'P', id_pdr: 301, punto_di_raccolta: 'PDR 1', ragione_sociale: 'GOMMISTA 1', comune: 'Napoli', provincia: 'NA', regione: 'Campania' }],
    PrimariaAci: [],
    Assegnato: [{ id: 'a1', id_ordine: 'ET25000800', trasportatore: NAPPI, ordine_immesso_il: '2025-12-31T23:30:00.000Z', provincia: 'NA', regione: 'Campania', classe: 'P' }],
    AssegnatoAci: [],
    ExtraRaccolta: [],
    TargetMensile: [{ id: 't1', anno: 2026, mese: 'Ottobre', raccoglitore: NAPPI, regione: 'Campania', impianto: 'IRIGOM SRL', target: 45 }],
    ListaAssegnati: [{ id: 'L10', anno: 2026, mese: 10, raccoglitore_chiave: kN, raccoglitore_nome: NAPPI, file_nomi: 'nappi ottobre.xlsx', caricata_il: '2026-10-02T08:00:00.000Z', inviata_il: '2026-10-01',
      richieste: 1, prioritarie: 0, avvisi_json: '[]', righe_json: JSON.stringify([{ posizione: 1, id_ordine: 'ET25000800', prioritaria: false, data_immissione: '2026-01-01' }]) }],
    ControlloEvasione: [{ id: 'C10', lista_id: 'L10', raccoglitore_chiave: kN, raccoglitore_nome: NAPPI, anno: 2026, mese: 10, eseguito_il: '2026-10-16T10:00:00.000Z', primarie_caricate_il: '2026-10-10T08:00:00',
      richieste: 1, evase: 0, aperte: 1, raccolto_kg: 0, target_kg: 45000, proiezione_kg: 0, alert_alti: 0, alert_totali: 0, alert_json: '[]', esito_json: JSON.stringify({ regole }) }],
  });
  const modulo = await caricaFunzione('evasioneAssegnati');
  const prova = async (regole) => {
    globalThis.Date = DataFinta;
    try { return await chiama(modulo, { db: db(regole), ruolo: 'user', corpo: { anno: 2026, mese: 10 } }); } finally { globalThis.Date = VeraData; }
  };
  const rifatti = (r) => r.scritte.filter(s => s.op === 'create' && s.entita === 'ControlloEvasione').map(s => s.dati.lista_id);
  const con2 = await prova(2);
  const con3 = await prova(3);
  annota('evasioneAssegnatiDati.rifatti', { regole2: rifatti(con2), regole3: rifatti(con3) });
  verifica('la funzione risponde', con2.stato === 200 && con3.stato === 200, `${con2.stato} ${con3.stato} ${J(con2.j.error || con3.j.error || '')}`);
  verifica('il controllo del 16/10 con le regole 2 si rifa\'', J(rifatti(con2)) === '["L10"]', J(rifatti(con2)));
  verifica('quello con le regole 3 resta com\'e\'', rifatti(con3).length === 0, J(rifatti(con3)));
  // il controllo rifatto, come resta nell'archivio dopo il salvataggio dell'esito
  const nuovo = (con2.db.ControlloEvasione || []).find(c => c.id !== 'C10' && c.lista_id === 'L10');
  let esitoNuovo = {};
  try { esitoNuovo = JSON.parse((nuovo && nuovo.esito_json) || '{}'); } catch { esitoNuovo = { illeggibile: nuovo && nuovo.esito_json }; }
  verifica('e il controllo rifatto ha le regole 3 e la riga al 31/12/2025, dall\'ordine vivo', esitoNuovo.regole === 3 && (esitoNuovo.righe || []).some(r => r.id_ordine === 'ET25000800' && r.data_immissione === '2025-12-31'),
    J({ regole: esitoNuovo.regole, righe: (esitoNuovo.righe || []).map(r => [r.id_ordine, r.data_immissione]) }));
}

console.log('\nORDINI IN «ESEGUITO» (ordiniEseguiti.ts e lo specchio src/lib/ordiniEseguiti.js)');
{
  const X1 = { id: 'x1', id_ordine: 'ET26999005', numero_fir: 'FIR X1', stato: 'eseguito', trasportatore: 'ALFA SRL', provincia: 'NA', classe: 'P', peso_effettivo: 2500, ordine_immesso_il: ULTIMO_DELL_ANNO, trasporto_iniziato_il: '2027-01-05T00:00:00.000Z', trasporto_finito_il: '2027-01-05T00:00:00.000Z' };
  const r = OE.ordiniEseguiti({ PrimariaRete: [X1] }, { oggi: '2027-01-10', annoInizio: 2027 });
  const o = ((r.gruppi || [])[0] || {}).elenco?.[0] || {};
  annota('ordiniEseguiti', [o.immesso_il, o.anno_immissione, o.fuori_export]);
  verifica('immesso il 31/12/2026: e\' del 2026, fuori da un export che parte dal 2027', o.immesso_il === '2026-12-31' && o.anno_immissione === 2026 && o.fuori_export === true, J([o.immesso_il, o.anno_immissione, o.fuori_export]));
}

console.log('\nSTORICO CONSERVATO (storicoConservato.ts)');
{
  const via = SC.cancellatiDaLasciare([C1], 2027, new Set());
  annota('storicoConservato', [...via]);
  verifica('un cancellato immesso il 31/12/2026 alle 23:30 e\' del 2026: con un export che parte dal 2027 si lascia andare', via.has('ET26999003'), J([...via]));
  verifica('con un export che parte dal 2026 resta', !SC.cancellatiDaLasciare([C1], 2026, new Set()).has('ET26999003'));
}

console.log('\nDATI FINO AL (statoArchivi.ts)');
{
  // Un archivio finto che ordina come la piattaforma: '-campo' dal piu' recente.
  const archivio = (righe) => {
    const ordina = (sort) => { const c = String(sort || '').replace(/^-/, ''); return [...righe].sort((a, b) => String(b[c] || '').localeCompare(String(a[c] || ''))); };
    return { list: async (sort, l = 1e9, s = 0) => ordina(sort).slice(s, s + l), filter: async (f, sort, l = 1e9, s = 0) => ordina(sort).filter(r => Object.entries(f || {}).every(([k, v]) => r[k] === v)).slice(s, s + l) };
  };
  const svc = new Proxy({
    Assegnato: archivio([A1, { ...A1, id: 'a0', ordine_immesso_il: '2026-12-20T10:00:00.000Z' }]),
    DichiarazioneTrattamento: archivio([{ id: 'd1', partner_operativo: 'SMOCO SRL', data_dichiarazione: '2026-01-31T23:55:00.000Z' }]),
    PrimariaRete: archivio([{ ...R1, id: 'p9' }]),
  }, { get: (t, k) => t[k] || archivio([]) });
  const voci = await SA.datiFinoAl(svc, ['Assegnato', 'DichiarazioneTrattamento', 'PrimariaRete']);
  const di = (e) => (voci.find(v => v.entita === e) || {}).dati_fino_al;
  annota('statoArchivi', [di('Assegnato'), di('DichiarazioneTrattamento'), di('PrimariaRete')]);
  verifica('gli assegnati arrivano al 31/12/2026, non al 01/01/2027', di('Assegnato') === '2026-12-31', String(di('Assegnato')));
  verifica('il report delle dichiarazioni al 31/01/2026', di('DichiarazioneTrattamento') === '2026-01-31', String(di('DichiarazioneTrattamento')));
  verifica('le primarie all\'ultima fine trasporto, il 15/01/2027', di('PrimariaRete') === '2027-01-15', String(di('PrimariaRete')));
}

console.log('\nDICHIARAZIONI A PORTALE (agganciaDichiarazioni.ts e usciteDichiarate.ts)');
{
  const righe = [
    { data_dichiarazione: '2026-01-31T23:55:00.000Z', destinazione: 'GATIM SRL', prodotto: 'G1 - pneumatici', peso_associato_kg: 1000, fine_trasporto: '2026-01-20T00:00:00.000Z' },
    { data_dichiarazione: ULTIMO_DELL_ANNO, destinazione: 'IRIGOM SRL', prodotto: 'P - pneumatici', peso_associato_kg: 2000, fine_trasporto: '2026-12-10T00:00:00.000Z' },
  ];
  const c26 = AD.caricamentiPortale(righe, 2026, 'RETE');
  const c27 = AD.caricamentiPortale(righe, 2027, 'RETE');
  const gatim = (c26.get('GATIM SRL') || [])[0] || {};
  const irigom = (c26.get('IRIGOM SRL') || [])[0] || {};
  annota('agganciaDichiarazioni', { gatim: [gatim.data, gatim.mesi], irigom: irigom.data, irigom2027: (c27.get('IRIGOM SRL') || []).map(c => c.data) });
  verifica('il caricamento delle 23:55 del 31/01 e\' del 31/01, a gennaio', gatim.data === '2026-01-31' && gatim.data.slice(5, 7) === '01' && J(gatim.mesi) === J([{ mese: '2026-01', kg: 1000 }]), J(gatim));
  verifica('quello delle 23:30 del 31/12/2026 e\' del 2026', irigom.data === '2026-12-31', J(irigom));
  verifica('e nel 2027 non c\'e\': non e\' un caricamento del 2027 e chiude ordini del 2026', !(c27.get('IRIGOM SRL') || []).length, J(c27.get('IRIGOM SRL')));
  const u = UD.raccoglitoreUscite({ anno: 2026 });
  for (const r of righe) u.segna(r);
  const g = u.per('gatim srl') || { caricamenti: [] };
  annota('usciteDichiarate', g.caricamenti.map(c => c.giorno));
  verifica('le uscite dichiarate: il caricamento del 31/01', J(g.caricamenti.map(c => c.giorno)) === '["2026-01-31"]', J(g.caricamenti));
  const i = u.per('irigom srl') || { caricamenti: [] };
  verifica('e quello del 31/12/2026', J(i.caricamenti.map(c => c.giorno)) === '["2026-12-31"]', J(i.caricamenti));
}

console.log('\nTEMPI DI RACCOLTA (primarieReteAnalytics.ts)');
{
  const s = PA.computeSlaMetrics([T1, R1], 2026);
  const s27 = PA.computeSlaMetrics([T1, R1], 2027);
  annota('primarieReteAnalytics', [s.non_misurati.senza_fine_trasporto, s27.non_misurati.senza_fine_trasporto, s27.avg_giorni]);
  verifica('il terminato senza fine immesso il 31/12/2026 si conta nel 2026', s.non_misurati.senza_fine_trasporto === 1 && s27.non_misurati.senza_fine_trasporto === 0, J([s.non_misurati, s27.non_misurati]));
  verifica('e R1, finito il 15/01/2027, ha 15 giorni di raccolta nel 2027', s27.avg_giorni === 15 && s27.totale_ordini === 1, J([s27.avg_giorni, s27.totale_ordini]));
}

console.log('\nPIVOT PER IMMISSIONE (pivotCalculator.ts, modulo che oggi nessuna pagina importa)');
{
  const archivio = (righe) => ({ list: async (_o, l = 1e9, s = 0) => righe.slice(s, s + l), filter: async (_f, _o, l = 1e9, s = 0) => righe.slice(s, s + l) });
  const cliente = (tabelle) => ({ asServiceRole: { entities: new Proxy({}, { get: (_t, nome) => archivio(tabelle[nome] || []) }) } });
  const conta = async (anno) => { const r = await PC.computeAllPivots(cliente({ Assegnato: [A1] }), { anno: [anno] }, ['H']); return r.pivotH.tree.totals.count || 0; };
  const n26 = await conta(2026), n27 = await conta(2027);
  annota('pivotCalculator', [n26, n27]);
  verifica('l\'assegnato immesso il 31/12/2026 alle 23:30 e\' nella pivot del 2026, non del 2027', n26 === 1 && n27 === 0, J([n26, n27]));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
console.log('RISULTATI ' + JSON.stringify(RISULTATI));
process.exit(ko ? 1 : 0);
