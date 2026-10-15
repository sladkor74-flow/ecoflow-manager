// Prova del QUADRO DELLA COMMESSA (base44/shared/quadroCommessa.ts, migliorie
// dell'11/10/2026): i numeri nuovi della dashboard, fatti con le regole di oggi.
//
// 1. Il caso vero dell'11/10/2026: il profilo rivisto del contratto 2026 (foglio
//    «Target Piarulli», colonna «Target new», 11.571,64 t), target 11.550 t,
//    raccolto 8.818,55 t, dati fino all'08/10/2026. Atteso 8.689,23 t, scarto
//    +129,32 t, residuo 2.731,45 t, proiezione 11.721,90 t (101,5%), servono
//    996,18 t al mese contro 1.043,34 del profilo (95,5%). Sono i numeri che la
//    copia dei dati veri da' con la funzione intera (prove/dashboardDatiVeri.mjs).
// 2. I casi limite: gennaio e febbraio senza proiezione, l'anno passato, l'anno
//    senza contratto, il 2 gennaio senza ritiri dell'anno: mai uno zero
//    inventato, null col perche'.
// 3. I mesi, le regioni e i raccoglitori tornano col raccolto, e i raccoglitori
//    sono quelli di Target & Status (computeRaccoltoData, righeAndamento).
// Revisione delle migliorie (11/10/2026), i rilievi dei revisori:
// 5. un anno passato fatturato prima del gestionale non e' dodici mesi «da
//    elaborare»: si guarda dal primo mese con un documento, il resto lo dice la nota;
// 6. le province ferme sono quelle senza ritiri negli ultimi due mesi finiti, non
//    quelle con due mesi a zero in qualunque momento dell'anno; dalla revisione
//    del 13/10/2026 anche quelle del contratto mai servite, da marzo;
// 7. un anno chiuso si misura al 31/12, non al giorno dei dati dell'anno dopo.
// npm run prove
import * as Q from '../base44/shared/quadroCommessa.ts';
import { attesoAllaData, targetAnnuoDellAnno } from '../base44/shared/attesoContratto.ts';
import { computeRaccoltoData } from '../base44/shared/raccoltoCalculator.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const due = (x) => (x === null || x === undefined ? null : Math.round(x * 100) / 100);

const PROFILO = [851.29, 915.48, 868.47, 932.55, 1053.85, 1100, 1100, 550, 1050, 1100, 1100, 950];
const contratto = { anno: 2026, target_annuo_t: 11550, target_mensile_json: J(PROFILO), budget_rete_json: J([720, 790, 920, 930, 900, 960, 970, 420, 1030, 1120, 1150, 1190]),
  target_prezzo_regioni_json: J([{ regione: 'Puglia', target_t: 400, prezzo: 95 }, { regione: 'Calabria', target_t: 250, prezzo: 95 }]), budget_aci_json: J([15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15]) };
// Il kpi come lo scrive getDashboardRaccolta.
const kpiDi = (commessa, anno, giorno, raccolto, altro = {}) => {
  const t = targetAnnuoDellAnno(commessa, anno);
  const a = attesoAllaData(commessa, anno, giorno);
  return {
    raccolto_rete_anno: raccolto, raccolto_aci_anno: 0, raccolto_extra_anno: 0, previsione_aci: 0,
    target: t.t, raggiungimento_pct: t.t ? (raccolto / t.t) * 100 : null,
    atteso: t.t === null || a.atteso_t === null ? null : { giorno, atteso_t: a.atteso_t, pct: (a.atteso_t / t.t) * 100, scarto_t: raccolto - a.atteso_t },
    target_ripiego: t.fonte === 'ripiego' ? [anno] : [], target_da_confermare: t.da_confermare ? [anno] : [], ...altro,
  };
};
const rete = (anno, oggi, giorno, raccolto, commessa = contratto, righe = []) => Q.quadroRete({ anno, oggi, giornoDati: giorno, commessa, kpi: kpiDi(commessa, anno, giorno, raccolto), reteAnno: righe, rete: righe, mensili: [], annui: [] });

console.log('1. IL CASO VERO DELL\'11/10/2026');
const vero = rete(2026, '2026-10-11', '2026-10-08', 8818.55);
verifica('quota del profilo al giorno dei dati: 0,752314', Math.abs(vero.atteso.quota - 0.752314) < 1e-6, String(vero.atteso.quota));
verifica('atteso 8.689,23 t, scarto +129,32 t', due(vero.atteso.atteso_t) === 8689.23 && due(vero.atteso.scarto_t) === 129.32, J(vero.atteso));
verifica('fatto dell\'anno 76,35%', due(vero.pct_target) === 76.35);
verifica('residuo 2.731,45 t', due(vero.residuo_t) === 2731.45, String(vero.residuo_t));
verifica('proiezione 11.721,90 t, il 101,5% del target', due(vero.proiezione.t) === 11721.9 && Math.round(vero.proiezione.pct_target * 10) / 10 === 101.5 && vero.proiezione.finale === false, J(vero.proiezione));
verifica('servono 996,18 t al mese contro 1.043,34 del profilo: il 95,5% del ritmo del contratto', due(vero.ritmo.servono_t_mese) === 996.18 && due(vero.ritmo.contratto_t_mese) === 1043.34 && Math.round(vero.ritmo.pct_ritmo * 10) / 10 === 95.5 && vero.ritmo.mesi_restanti === 2.7419, J(vero.ritmo));
verifica('gennaio del profilo riportato all\'annuo: 849,70 t, non 851,29', due(vero.mesi[0].target_t) === 849.7 && vero.profilo.rivisto && vero.profilo.somma_t === 11571.64, J([vero.mesi[0], vero.profilo]));
verifica('il budget di SMOCO del mese', vero.mesi[0].budget_t === 720 && vero.mesi[11].budget_t === 1190);
verifica('il progressivo del target a dicembre e\' il target', vero.mesi[11].target_cum_t === 11550, String(vero.mesi[11].target_cum_t));
verifica('ottobre coperto per otto giorni, novembre e dicembre futuri: raccolto assente, non zero', Math.abs(vero.mesi[9].coperto - 8 / 31) < 0.001 && vero.mesi[10].futuro && vero.mesi[10].raccolto_t === null && vero.mesi[11].raccolto_cum_t === null, J(vero.mesi.slice(9)));

console.log('2. I CASI LIMITE');
const feb = rete(2026, '2026-02-20', '2026-02-18', 1500);
verifica('a febbraio niente proiezione, col perche\'', feb.proiezione === null && /gennaio e febbraio/.test(feb.proiezione_perche), J([feb.proiezione, feb.proiezione_perche]));
verifica('il 28/02/2026 si', rete(2026, '2026-03-02', '2026-02-28', 1700).proiezione !== null);
const bis = { ...contratto, anno: 2028 };
verifica('nel 2028 bisestile il 28/02 non basta, il 29/02 si', rete(2028, '2028-03-02', '2028-02-28', 1700, bis).proiezione === null && rete(2028, '2028-03-02', '2028-02-29', 1700, bis).proiezione !== null);
const passato = rete(2025, '2026-10-11', '2026-10-08', 11101.57, { anno: 2025, target_annuo_t: 11200 });
verifica('anno passato: la proiezione e\' il raccolto, niente ritmo', passato.proiezione && passato.proiezione.t === 11101.57 && passato.proiezione.finale === true && passato.ritmo === null && passato.atteso && passato.atteso.quota === 1, J([passato.proiezione, passato.ritmo, passato.atteso]));
const senza = rete(2027, '2027-03-10', '2027-03-08', 900, null);
verifica('anno senza contratto: target, atteso, residuo, proiezione, ritmo null, mai 0', senza.target_t === null && senza.atteso === null && senza.residuo_t === null && senza.proiezione === null && senza.ritmo === null && /non ha un target/.test(senza.proiezione_perche), J(senza));
verifica('e i mesi col solo raccolto: target null', senza.mesi.every(m => m.target_t === null && m.target_cum_t === null), J(senza.mesi.slice(0, 2)));
const gennaio = rete(2027, '2027-01-02', '2026-12-31', 0, { anno: 2027, target_annuo_t: 11600 });
verifica('il 2 gennaio, nessun ritiro dell\'anno: atteso null (non «0,0%»), proiezione null', gennaio.atteso === null && gennaio.proiezione === null && /Nessun ritiro del 2027/.test(gennaio.proiezione_perche) && gennaio.ritmo === null, J([gennaio.atteso, gennaio.proiezione_perche]));
verifica('e i mesi sono tutti futuri', gennaio.mesi.every(m => m.futuro && m.raccolto_t === null));
verifica('target superato: residuo negativo, niente ritmo', rete(2026, '2026-10-11', '2026-10-08', 11700).residuo_t === -150 && rete(2026, '2026-10-11', '2026-10-08', 11700).ritmo === null);

console.log('3. I MESI, LE REGIONI, I RACCOGLITORI');
let n = 0;
const T = (g) => `${g}T10:00:00Z`;
const prim = (tr, prov, kg, g, altro = {}) => ({ id: 'p' + String(++n).padStart(5, '0'), id_ordine: 'P' + n, stato: 'terminato', provincia: prov, trasportatore: tr, peso_effettivo: kg, ordine_immesso_il: T(g), trasporto_iniziato_il: T(g), trasporto_finito_il: T(g), ...altro });
const RIGHE = [
  prim('SMOCO SRL', 'NA', 10000, '2026-01-10'), prim('SMOCO SRL', 'NA', 2500, '2026-03-31T23:30:00Z'.slice(0, 10)),
  // un ordine su due righe: un ritiro solo
  prim('PNEUSERVICE CONVERSANO SRL', 'BA', 3000, '2026-02-05', { id_ordine: 'DOPPIO' }), prim('PNEUSERVICE CONVERSANO SRL', 'BA', 1000, '2026-02-05', { id_ordine: 'DOPPIO' }),
  prim('ALFA SRL', 'CT', 5000, '2026-09-30'),
  prim('BETA SRL', 'PA', 800, '2026-10-05'),
  // senza target
  prim('GAMMA SRL', 'BA', 1200, '2026-06-01'),
  // dell'anno prima e senza fine trasporto: fuori
  prim('SMOCO SRL', 'NA', 99999, '2025-12-31'),
  { ...prim('SMOCO SRL', 'NA', 77777, '2026-05-01'), trasporto_finito_il: null },
];
const anno26 = RIGHE.filter(r => r.trasporto_finito_il && r.trasporto_finito_il.startsWith('2026'));
const finto = { asServiceRole: { entities: { PrimariaRete: { list: async (_o, lim = 1e9, skip = 0) => RIGHE.slice(skip, skip + lim) }, PrimariaAci: { list: async () => [] } } } };
const daTS = await computeRaccoltoData(finto, { anno: 2026 });
const nostro = Q.raccoltoPerRaccoglitore(RIGHE, 2026);
verifica('il raccolto per raccoglitore e\' quello di Target & Status, riga per riga (nomi, regioni, mesi)', J(nostro) === J(daTS.by_raccoglitore), J([nostro, daTS.by_raccoglitore]));
const mensili = [
  // PNEUSERVICE scritto abbreviato, come succede in Target & Status
  ...['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'].map(m => ({ raccoglitore: 'PNEUSERVICE SRL', regione: 'Puglia', mese: m, anno: 2026, target: 1 })),
  ...['Gennaio', 'Febbraio', 'Marzo'].map(m => ({ raccoglitore: 'SMOCO S.r.l.', regione: 'Campania', mese: m, anno: 2026, target: 10 })),
  { raccoglitore: 'SMOCO S.r.l.', regione: 'Campania', mese: 'Aprile', anno: 2026, target: 10, non_raccoglie: true },
  { raccoglitore: 'ALFA SRL', regione: 'Sicilia', mese: 'Settembre', anno: 2026, target: 2 },
  // copiato dall'anno prima, da confermare: fuori dalla classifica
  { raccoglitore: 'BETA SRL', regione: 'Sicilia', mese: 'Ottobre', anno: 2026, target: 50, storico_json: J([{ il: '2025-12-20', nota: 'copiato dal 2025, da confermare' }]) },
];
const racc = Q.raccoglitoriRete({ righe: RIGHE, anno: 2026, giornoDati: '2026-10-08', oggi: '2026-10-11', mensili, annui: [] });
const tutti = [...racc.indietro, ...racc.avanti];
const pneu = tutti.find(r => /PNEUSERVICE/.test(r.raccoglitore));
verifica('il target abbreviato trova il raccolto del nome del portale', pneu && pneu.raccolto_t === 4 && pneu.target_mesi_t === 12, J(pneu));
verifica('target ad oggi: i mesi finiti interi, ottobre per 8 giorni su 31', pneu && Math.abs(pneu.target_ad_oggi_t - (9 + 8 / 31)) < 0.001, J(pneu));
const smoco = tutti.find(r => /SMOCO/.test(r.raccoglitore));
verifica('un mese «non raccoglie» vale zero', smoco && smoco.target_mesi_t === 30 && smoco.raccolto_t === 12.5 && smoco.scarto_t === -17.5, J(smoco));
verifica('il copiato e\' fuori dalla classifica e si conta', !tutti.some(r => /BETA/.test(r.raccoglitore)) && racc.da_confermare === 1, J(racc));
verifica('chi non ha target: si conta col suo raccolto', racc.senza_target.quanti === 1 && racc.senza_target.raccolto_t === 1.2, J(racc.senza_target));
verifica('piu\' indietro, in tonnellate: SMOCO (-17,5 t) e PNEUSERVICE (-5,26 t); piu\' avanti: Alfa (+3 t)', racc.indietro.map(r => r.raccoglitore).join() === 'SMOCO S.r.l.,PNEUSERVICE SRL' && racc.avanti.map(r => r.raccoglitore).join() === 'ALFA SRL' && racc.con_target === 3, J(racc));
verifica('i ritiri sono ordini distinti: due righe dello stesso ordine sono un ritiro', Q.ordiniDistinti(anno26) === anno26.length - 1);
const conMesi = Q.quadroRete({ anno: 2026, oggi: '2026-10-11', giornoDati: '2026-10-08', commessa: contratto, kpi: kpiDi(contratto, 2026, '2026-10-08', anno26.reduce((s, r) => s + r.peso_effettivo, 0) / 1000), reteAnno: anno26, rete: RIGHE, mensili, annui: [],
  targetVsRaccolto: [{ regione: 'Campania', target: 4400, atteso: 3310.18, raccolto: 12.5 }, { regione: 'Puglia', target: 2500, atteso: 1880.79, raccolto: 5.2 }, { regione: 'Sicilia', target: 2500, atteso: 1880.79, raccolto: 5.8 }],
  conRiparto: true, raccoltoPerRegione: { Campania: 12.5, Puglia: 5.2, Sicilia: 5.8, Altro: 0.75, Toscana: 1.25 } });
const kg = (x) => Math.round(x * 1000);
verifica('mesi: la somma del raccolto e\' il raccolto, e il progressivo di dicembre pure', kg(conMesi.mesi.reduce((s, m) => s + (m.raccolto_t || 0), 0)) === kg(conMesi.raccolto_t) && conMesi.mesi[11].raccolto_cum_t === null && kg(conMesi.mesi[9].raccolto_cum_t) === kg(conMesi.raccolto_t), J(conMesi.mesi.map(m => [m.raccolto_t, m.raccolto_cum_t])));
verifica('regioni: fuori dal contratto Toscana e «Altro» (senza provincia), e la somma torna col raccolto al chilo', J(conMesi.fuori_contratto) === J({ raccolto_t: 2, regioni: [{ regione: 'Toscana', raccolto_t: 1.25 }, { regione: 'Altro', raccolto_t: 0.75 }] })
  && kg(conMesi.regioni.reduce((s, r) => s + r.raccolto_t, 0) + conMesi.fuori_contratto.raccolto_t) === kg(25.5), J(conMesi.fuori_contratto));
verifica('lo scarto della regione e\' raccolto meno atteso', conMesi.regioni[0].scarto_t === 12.5 - 3310.18, J(conMesi.regioni[0]));

console.log('4. I CANALI NON SI SOMMANO, E NIENTE EURO');
const q = Q.quadroCommessa({ anno: 2026, oggi: '2026-10-11', giornoDati: '2026-10-08', commessa: contratto,
  kpi: { ...kpiDi(contratto, 2026, '2026-10-08', 25.5), raccolto_aci_anno: 3, previsione_aci: 650, raccolto_extra_anno: 0.4 },
  reteAnno: anno26, rete: RIGHE, aciAnno: [prim('X', 'BA', 2000, '2026-03-01'), prim('Y', 'RC', 1000, '2026-04-01')], extraAnno: [{ r: prim('Z', 'NA', 400, '2026-04-02') }], mensili: [], annui: [] });
const chiavi = (o, via = '') => (o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => [via + k, ...chiavi(v, via + k + '.')]) : []);
verifica('nessun campo «totale» che metta insieme i canali', !chiavi(q).some(k => /(^|\.)total/i.test(k)), chiavi(q).filter(k => /total/i.test(k)).join());
verifica('la rete resta la rete: ACI ed extra non la toccano', q.rete.raccolto_t === 25.5 && q.aci.raccolto_t === 3 && q.extra.raccolto_t === 0.4);
verifica('ACI per regione, dalla provincia, contro la previsione indicativa; il prezzo non esce', J(q.aci.regioni) === J([{ regione: 'Puglia', previsione_t: 400, raccolto_t: 2, pct: 0.5 }, { regione: 'Calabria', previsione_t: 250, raccolto_t: 1, pct: 0.4 }]) && q.aci.budget_t === 180 && q.aci.ritiri === 2, J(q.aci));
verifica('niente euro, prezzi, costi, ricavi o margini', !/euro|prezzo|costo|ricavo|margine/i.test(J(q)), J(q).match(/.{30}(euro|prezzo|costo|ricavo|margine).{30}/i));
verifica('extra: interventi, ultimo intervento', q.extra.interventi === 1 && q.extra.ultimo_giorno === '2026-04-02');
verifica('l\'anno in corso non ha i mesi dell\'attiva qui (li ha il cruscotto)', q.mesi_attiva === null && q.anno_chiuso === false);

// REVISIONE DELLE MIGLIORIE (11/10/2026): i tre rilievi dei revisori che
// toccano il quadro.
console.log('5. L\'ATTIVA DI UN ANNO PASSATO: DAL PRIMO MESE CON UN DOCUMENTO');
{
  // Il 2025 e' stato fatturato prima del gestionale: nessun documento qui. Prima
  // usciva con dodici mesi «da elaborare» su tre canali, a video e nel PDF.
  const doc = (mese, tipologia, stato = 'chiusa') => ({ tipo: 'ATTIVA', anno: 2025, mese, tipologia, stato });
  const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const daSettembre = MESI.slice(8).flatMap(m => ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(c => doc(m, c)));
  const quadro25 = (documenti) => Q.quadroCommessa({ anno: 2025, oggi: '2026-10-11', giornoDati: '2026-10-08', commessa: { anno: 2025, target_annuo_t: 11200 },
    kpi: kpiDi({ anno: 2025, target_annuo_t: 11200 }, 2025, '2026-10-08', 11101.57), reteAnno: [], rete: [], aciAnno: [], extraAnno: [], mensili: [], annui: [], documenti, prefatture: [] });
  const vuoto = quadro25([]);
  verifica('nessun documento del 2025: nessun mese, non dodici «da elaborare»', Array.isArray(vuoto.mesi_attiva) && vuoto.mesi_attiva.length === 0, J(vuoto.mesi_attiva && vuoto.mesi_attiva.length));
  verifica('e la nota lo dice', /^Nessun documento della fatturazione attiva del 2025 nel gestionale/.test(vuoto.mesi_attiva_nota || ''), vuoto.mesi_attiva_nota);
  const parziale = quadro25(daSettembre);
  verifica('documenti da settembre: si guarda da settembre, quattro mesi', parziale.mesi_attiva && J(parziale.mesi_attiva.map(m => m.mese)) === J(MESI.slice(8)) && parziale.mesi_attiva.every(m => m.elaborato), J(parziale.mesi_attiva && parziale.mesi_attiva.map(m => m.mese)));
  verifica('e la nota dice quelli che restano fuori: «da gennaio ad agosto»', parziale.mesi_attiva_nota === 'Il 2025 si guarda da settembre, il primo mese con un documento nel gestionale: da gennaio ad agosto è stato fatturato prima del gestionale.', parziale.mesi_attiva_nota);
  const intero = quadro25(MESI.flatMap(m => ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(c => doc(m, c))));
  verifica('un anno con tutti i documenti: dodici mesi, nessuna nota', intero.mesi_attiva && intero.mesi_attiva.length === 12 && intero.mesi_attiva_nota === '', J([intero.mesi_attiva && intero.mesi_attiva.length, intero.mesi_attiva_nota]));
  const buco = quadro25([doc('Marzo', 'RETE'), doc('Marzo', 'ACI'), doc('Marzo', 'EXTRA_RACCOLTA')]);
  verifica('dopo il primo mese con un documento, un mese senza resta «da elaborare»: non si nasconde niente', buco.mesi_attiva && buco.mesi_attiva.length === 10 && buco.mesi_attiva[0].mese === 'Marzo' && buco.mesi_attiva[1].elaborato === false, J(buco.mesi_attiva && buco.mesi_attiva.slice(0, 2)));
  verifica('l\'anno in corso: niente nota, i mesi li ha il cruscotto', q.mesi_attiva_nota === '' || q.mesi_attiva_nota === undefined);
}

console.log('6. LE PROVINCE FERME: GLI ULTIMI DUE MESI FINITI');
{
  // Il riquadro chiede le province senza ritiri negli ultimi due mesi finiti.
  // Prima passava l'elenco di Terminati Rete (due mesi a zero in qualunque
  // momento dell'anno): sulla copia dell'11/10/2026 KR, VV e TP, che a settembre
  // avevano raccolto.
  const pf = (righe, anno, oggi) => Q.provinceFerme(righe, anno, oggi);
  const RIGHE_PF = [
    prim('A', 'KR', 1000, '2026-01-15'), prim('A', 'KR', 1000, '2026-04-10'), prim('A', 'KR', 1000, '2026-09-20'),   // ferma a febbraio-marzo, poi ha ripreso
    prim('B', 'VV', 1000, '2026-03-05'), prim('B', 'VV', 1000, '2026-09-02'),
    prim('C', 'TP', 1000, '2026-06-10'),                                                                       // ferma: l'ultimo a giugno
    // la notte del 31/07 alle 22:30 UTC in Italia e' gia' il 1° agosto: non e' ferma
    { ...prim('D', 'MT', 1000, '2026-07-31'), trasporto_finito_il: '2026-07-31T22:30:00Z' },
    prim('E', 'CS', 1000, '2026-03-01'), prim('E', 'CS', 1000, '2026-10-05'),                                  // ripresa a ottobre, mese non finito
    prim('F', 'RC', 1000, '2026-05-01'), { ...prim('F', 'RC', 1000, '2026-09-01'), stato: 'in corso' },        // il ritiro di settembre non e' terminato
    prim('G', 'LE', 1000, '2025-12-20'),                                                                       // lavorava l'anno prima e si e' fermata: e' ferma
    prim('H', 'FG', 1000, '2024-11-28'),                                                                       // ferma da due anni: non lavora piu' qui
  ];
  const ott = pf(RIGHE_PF, 2026, '2026-10-11');
  verifica('l\'11/10/2026 i due mesi finiti sono agosto e settembre', ott.anno_in_corso === true && J(ott.dal) === J({ giorno: '2026-08-01', mese: 'Agosto', anno: 2026 }), J(ott.dal));
  verifica('ferme LE (ultimo il 20/12/2025), RC (01/05) e TP (10/06), dalla piu\' vecchia', J((ott.province || []).map(p => [p.provincia, p.regione, p.ultimo])) === J([['LE', 'Puglia', '2025-12-20'], ['RC', 'Calabria', '2026-05-01'], ['TP', 'Sicilia', '2026-06-10']]), J(ott.province));
  verifica('FG, senza ritiri dal 2024, non lavora piu\' qui: non si dice', !(ott.province || []).some(p => p.provincia === 'FG'), J(ott.province));
  verifica('KR e VV, ferme a inizio anno e poi tornate, non sono ferme', !(ott.province || []).some(p => p.provincia === 'KR' || p.provincia === 'VV'), J(ott.province));
  verifica('il giorno e\' quello italiano della fine trasporto: MT (31/07 22:30 UTC, 01/08 in Italia) non e\' ferma', !(ott.province || []).some(p => p.provincia === 'MT'));
  verifica('un ritiro del mese in corso vuol dire che la provincia ha ripreso: CS non e\' ferma', !(ott.province || []).some(p => p.provincia === 'CS'));
  const gen = pf([prim('A', 'NA', 1000, '2026-10-20'), prim('B', 'BA', 1000, '2026-12-10'), prim('C', 'CT', 1000, '2027-01-05')], 2027, '2027-01-15');
  verifica('a gennaio i due mesi finiti sono novembre e dicembre dell\'anno prima: NA (ultimo il 20/10/2026) e\' ferma', J(gen.dal) === J({ giorno: '2026-11-01', mese: 'Novembre', anno: 2026 }) && J((gen.province || []).map(p => p.provincia)) === J(['NA']), J(gen));
  // IL CAMBIO D'ANNO DOPO FEBBRAIO (12/10/2026). Il rilievo: NA ferma dal
  // 10/11/2026 e SA dal 15/12/2026; il 15/02/2027 NA era ferma, il 15/03/2027 e
  // il 15/04/2027 il riquadro diceva «nessuna», perche' «lavorava» solo chi aveva
  // un ritiro nell'anno. SA non compariva mai.
  const CAMBIO = [prim('A', 'NA', 1000, '2026-11-10'), prim('B', 'SA', 1000, '2026-12-15'),
    prim('C', 'BA', 1000, '2027-01-10'), prim('C', 'BA', 1000, '2027-02-10'), prim('C', 'BA', 1000, '2027-03-02')];
  const nomiFerme = (o) => (o.province || []).map(p => p.provincia).join(',');
  verifica('il 15/02/2027 (dicembre e gennaio): NA, non SA che a dicembre ha raccolto', nomiFerme(pf(CAMBIO, 2027, '2027-02-15')) === 'NA', nomiFerme(pf(CAMBIO, 2027, '2027-02-15')));
  verifica('il 15/03/2027 (gennaio e febbraio): NA e SA, ancora ferme', nomiFerme(pf(CAMBIO, 2027, '2027-03-15')) === 'NA,SA', nomiFerme(pf(CAMBIO, 2027, '2027-03-15')));
  verifica('il 15/04/2027: NA e SA, e BA, che a marzo ha raccolto, no', nomiFerme(pf(CAMBIO, 2027, '2027-04-15')) === 'NA,SA', nomiFerme(pf(CAMBIO, 2027, '2027-04-15')));
  verifica('e l\'ultimo ritiro detto e\' quello dell\'anno prima', J(pf(CAMBIO, 2027, '2027-03-15').province.map(p => p.ultimo)) === J(['2026-11-10', '2026-12-15']));
  const passato = pf(RIGHE_PF, 2025, '2026-10-11');
  verifica('un anno passato non si guarda', passato.anno_in_corso === false && passato.province.length === 0);
}
{
  // LE PROVINCE DEL CONTRATTO MAI SERVITE (revisione del 13/10/2026). Prima il
  // riquadro guardava solo chi aveva ritiri: una provincia del contratto mai
  // servita non «lavorava» e non si diceva mai. Ora provinceFerme riceve le
  // province del contratto dell'anno (provinceDelContratto) e quadroRete gliele
  // passa dal contratto che ha gia'.
  const contrattoConProvince = { ...contratto, regioni_json: J([{ regione: 'Campania', province: 'Tutte le provincie', target_t: 4400 }, { regione: 'Puglia', province: 'BA,BR,TA,LE', target_t: 2500 }]) };
  const delContratto = [{ provincia: 'NA', regione: 'Campania' }, { provincia: 'BA', regione: 'Puglia' }, { provincia: 'LE', regione: 'Puglia' }];
  const RIGHE_C = [prim('A', 'NA', 1000, '2026-09-20'), prim('G', 'LE', 1000, '2025-12-20')];
  const pfc = (oggi) => Q.provinceFerme(RIGHE_C, Number(oggi.slice(0, 4)), oggi, delContratto);
  const ott = pfc('2026-10-11');
  const ba = (ott.province || []).find(p => p.provincia === 'BA');
  verifica('BA, del contratto e mai servita, e\' ferma: ultimo vuoto e mai_servita', !!ba && ba.regione === 'Puglia' && ba.ultimo === '' && ba.mai_servita === true, J(ott.province));
  verifica('e viene prima di tutte: e\' ferma da piu\' tempo', (ott.province || [])[0] && ott.province[0].provincia === 'BA', J((ott.province || []).map(p => p.provincia)));
  verifica('LE, servita l\'anno prima, resta con il suo ultimo ritiro (non «mai servita»)', (ott.province || []).some(p => p.provincia === 'LE' && p.ultimo === '2025-12-20' && !p.mai_servita), J(ott.province));
  verifica('NA, del contratto e servita a settembre, non e\' ferma', !(ott.province || []).some(p => p.provincia === 'NA'));
  verifica('a febbraio (dicembre e gennaio) una provincia nuova del contratto non si dice ancora, come nella matrice', !(pfc('2027-02-15').province || []).some(p => p.provincia === 'BA') && !(Q.provinceFerme([], 2026, '2026-02-15', delContratto).province || []).some(p => p.provincia === 'BA'));
  verifica('a marzo (gennaio e febbraio) si', (Q.provinceFerme([], 2026, '2026-03-15', delContratto).province || []).some(p => p.provincia === 'BA' && p.mai_servita));
  verifica('senza l\'elenco del contratto il riquadro e\' quello di prima', !(Q.provinceFerme(RIGHE_C, 2026, '2026-10-11').province || []).some(p => p.provincia === 'BA'));
  // il riquadro della dashboard: quadroRete passa le province del contratto
  const qr = rete(2026, '2026-10-11', '2026-10-08', 8818.55, contrattoConProvince, RIGHE_C);
  const ferme = (qr.province_ferme && qr.province_ferme.province) || [];
  verifica('quadroRete: le province del contratto mai servite sono fra le ferme (AV, BN, CE, SA, BA, BR, TA)', J(ferme.filter(p => p.mai_servita).map(p => p.provincia).sort()) === J(['AV', 'BA', 'BN', 'BR', 'CE', 'SA', 'TA']), J(ferme));
  verifica('quadroRete senza province nel contratto: nessuna mai servita', !(rete(2026, '2026-10-11', '2026-10-08', 8818.55, contratto, RIGHE_C).province_ferme.province || []).some(p => p.mai_servita));
}

console.log('7. UN ANNO CHIUSO SI MISURA AL 31/12');
{
  // Le etichette scrivevano «Atteso al 08/10» guardando il 2025: il giorno dei
  // dati e' del 2026, l'atteso e' quello dell'anno intero.
  const gm = typeof Q.giornoDellaMisura === 'function' ? Q.giornoDellaMisura : () => undefined;
  verifica('il giorno della misura: 31/12 per un anno chiuso, il giorno dei dati per l\'anno in corso, niente senza ritiri', gm(2025, '2026-10-08') === '2025-12-31' && gm(2026, '2026-10-08') === '2026-10-08' && gm(2027, '2026-12-31') === '' && gm(2026, '') === '', J([gm(2025, '2026-10-08'), gm(2026, '2026-10-08'), gm(2027, '2026-12-31')]));
  verifica('l\'atteso del 2025 e\' al 31/12/2025, l\'anno intero', passato.atteso && passato.atteso.giorno === '2025-12-31' && passato.atteso.fine_anno === true && passato.atteso.quota === 1, J(passato.atteso));
  verifica('quello del 2026 al giorno dei dati', vero.atteso.giorno === '2026-10-08' && vero.atteso.fine_anno === false, J(vero.atteso));
  verifica('il quadro porta il giorno della misura', q.giorno_misura === '2026-10-08');
}

// PROVA GENERALE DEL CAMBIO D'ANNO (15/10/2026). Il giorno della misura guarda
// anche oggi: un anno prima di quello di oggi e' chiuso e si misura al 31/12,
// qualunque sia l'ultimo ritiro caricato. La pausa di Natale c'e' davvero
// (l'anno scorso dal 22/12/2025 al 05/01/2026): il 05/01/2027, con l'ultimo
// ritiro del 2026 al 22/12 e nessun ritiro del 2027, la dashboard diceva per il
// 2026 «Atteso al 22/12», la proiezione a fine anno su un anno finito e la
// Campania a 4.295,127 t di atteso; il 15/01, arrivati i ritiri di gennaio, lo
// stesso anno al 31/12. Due misure dello stesso anno, e la prima andava nel
// riepilogo del lunedi'. Qui il conto della dashboard e di EcoTyna
// (contrattoDellaRete, contrattoRete.ts), sugli stessi ritiri.
console.log("8. IL CAMBIO D'ANNO: UN ANNO CHIUSO SI MISURA AL 31/12 ANCHE CON L'ULTIMO RITIRO AL 22/12");
{
  const { contrattoDellaRete } = await import('../base44/shared/contrattoRete.ts');
  const c26 = { ...contratto, id: 'c26', regioni_json: J([{ regione: 'Campania', target_t: 4400 }, { regione: 'Puglia', target_t: 7150 }]), updated_date: '2026-06-01T10:00:00' };
  const c27 = { ...c26, id: 'c27', anno: 2027, target_annuo_t: 11600, updated_date: '2026-12-20T10:00:00' };
  // i ritiri del 2026 fino al 22/12, poi la pausa; quelli del 2027 dall'08/01
  const R26 = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    R26.push(prim('SMOCO SRL', 'NA', 290000, `2026-${mm}-10`), prim('PNEUSERVICE CONVERSANO SRL', 'BA', 480000, `2026-${mm}-12`));
  }
  R26.push(prim('SMOCO SRL', 'NA', 12345, '2026-12-22'));
  const R27 = [prim('SMOCO SRL', 'NA', 30000, '2027-01-08'), prim('SMOCO SRL', 'NA', 20000, '2027-01-14')];
  const conta = (oggi, righe) => contrattoDellaRete({ commesse: [c26, c27], anno: 2026, rete: righe, oggi });
  const capodanno = conta('2027-01-01', R26);
  const cinque = conta('2027-01-05', R26);
  const quindici = conta('2027-01-15', [...R26, ...R27]);
  verifica('il 05/01/2027 il 2026 e\' chiuso e il giorno della misura e\' il 31/12, non il 22/12', cinque.anno_chiuso === true && cinque.giorno_dati === '2026-12-22' && cinque.giorno_misura === '2026-12-31', J([cinque.anno_chiuso, cinque.giorno_dati, cinque.giorno_misura]));
  verifica('l\'atteso e\' il target intero al 31/12, quota 1: 11.550 t', cinque.rete.atteso && cinque.rete.atteso.giorno === '2026-12-31' && cinque.rete.atteso.fine_anno === true && cinque.rete.atteso.quota === 1 && cinque.rete.atteso.atteso_t === 11550 && cinque.kpi.atteso.atteso_t === 11550, J([cinque.rete.atteso, cinque.kpi.atteso]));
  verifica('la proiezione e\' il raccolto, finale; niente ritmo', cinque.rete.proiezione && cinque.rete.proiezione.finale === true && cinque.rete.proiezione.t === cinque.rete.raccolto_t && cinque.rete.ritmo === null, J([cinque.rete.proiezione, cinque.rete.raccolto_t]));
  const camp = cinque.rete.regioni.find(r => r.regione === 'Campania') || {};
  verifica('la Campania: atteso 4.400 t, il suo contratto intero', camp.atteso_t === 4400 && Math.abs(camp.scarto_t - (camp.raccolto_t - 4400)) < 1e-6, J(camp));
  verifica('dicembre e\' coperto tutto: i mesi interi, anche per la classifica dei raccoglitori', cinque.rete.mesi[11].coperto === 1 && cinque.rete.mesi.every(m => !m.futuro), J(cinque.rete.mesi[11]));
  const senzaGiornoDati = (x) => { const { giorno_dati: _g, ...resto } = x; return J({ ...resto, kpi: { ...resto.kpi, atteso: resto.kpi.atteso && { ...resto.kpi.atteso, giorno: undefined } } }); };
  verifica('il 05/01/2027 e il 15/01/2027 dicono gli stessi numeri del 2026', senzaGiornoDati(cinque) === senzaGiornoDati(quindici), `\n    05/01 ${J(cinque.rete.atteso)} ${J(cinque.rete.proiezione)}\n    15/01 ${J(quindici.rete.atteso)} ${J(quindici.rete.proiezione)}`);
  verifica('e cosi\' il 01/01/2027, prima ancora di un ritiro', senzaGiornoDati(capodanno) === senzaGiornoDati(cinque), J([capodanno.giorno_misura, capodanno.rete.atteso]));
  // il 2027, nello stesso giorno, non ha ancora un ritiro: niente atteso, non zero
  const c27oggi = contrattoDellaRete({ commesse: [c26, c27], anno: 2027, rete: R26, oggi: '2027-01-05' });
  verifica('il 2027 il 05/01/2027, senza ritiri suoi: atteso null, nessun giorno della misura', c27oggi.giorno_misura === '' && c27oggi.rete.atteso === null && c27oggi.kpi.atteso === null && /Nessun ritiro del 2027/.test(c27oggi.rete.proiezione_perche)
    && c27oggi.rete.regioni.every(r => r.atteso_t === null && r.scarto_t === null), J([c27oggi.giorno_misura, c27oggi.rete.atteso, c27oggi.rete.regioni]));
  // controprova: l'anno in corso resta misurato all'ultimo ritiro
  const dicembre = conta('2026-12-28', R26);
  verifica('controprova: il 28/12/2026 il 2026 e\' l\'anno in corso, misurato al 22/12', dicembre.anno_chiuso === false && dicembre.giorno_misura === '2026-12-22' && dicembre.rete.atteso.giorno === '2026-12-22' && dicembre.rete.atteso.fine_anno === false
    && dicembre.rete.proiezione && dicembre.rete.proiezione.finale === false && dicembre.rete.atteso.quota < 1, J([dicembre.giorno_misura, dicembre.rete.atteso, dicembre.rete.proiezione]));
  const ottobre = conta('2026-10-15', R26.filter(r => r.trasporto_finito_il < '2026-10-11'));
  verifica('controprova: il 15/10/2026 il 2026 si misura all\'ultimo ritiro (10/10)', ottobre.giorno_misura === '2026-10-10' && ottobre.rete.atteso.giorno === '2026-10-10' && !ottobre.rete.atteso.fine_anno, J([ottobre.giorno_misura, ottobre.rete.atteso]));
}

// LA PREVISIONE ACI COPIATA (prova generale del cambio d'anno, 15/10/2026).
// Copiato l'anno, il contratto 2027 porta la previsione e i corrispettivi ACI
// del 2026, annuali e senza tacito rinnovo: la rete lo diceva («copiato, da
// confermare»), l'ACI no. quadro.aci.da_confermare e' lo stesso daConfermare
// del contratto; le parole della pagina in prove/andamentoFiltriAnno.mjs.
console.log('9. LA PREVISIONE ACI COPIATA DICE «DA CONFERMARE»');
{
  const copiato = { ...contratto, anno: 2027, storico_json: J([{ il: '2026-12-28T10:00:00Z', nota: 'copiato dal 2026, da confermare' }]) };
  const confermato = { ...copiato, storico_json: J([...JSON.parse(copiato.storico_json), { il: '2027-01-08T10:00:00Z', nota: 'confermato' }]) };
  const aci = (commessa) => Q.quadroAci({ anno: 2027, oggi: '2027-01-15', giornoDati: '2027-01-14', commessa, kpi: { raccolto_aci_anno: 4.2, previsione_aci: 650 }, aciAnno: [prim('X', 'BA', 4200, '2027-01-12')] });
  const daCopia = aci(copiato);
  verifica('il contratto copiato e non confermato: quadro.aci.da_confermare vero, coi numeri dell\'anno prima', daCopia.da_confermare === true && daCopia.previsione_t === 650 && daCopia.budget_t === 180, J(daCopia));
  verifica('controprova: confermato, niente «da confermare»', aci(confermato).da_confermare === false && aci(contratto).da_confermare === false && aci(null).da_confermare === false);
  const qq = Q.quadroCommessa({ anno: 2027, oggi: '2027-01-15', giornoDati: '2027-01-14', commessa: copiato, kpi: { ...kpiDi(copiato, 2027, '2027-01-14', 1), raccolto_aci_anno: 4.2, previsione_aci: 650 }, reteAnno: [], rete: [], aciAnno: [], extraAnno: [], mensili: [], annui: [] });
  verifica('nel quadro intero l\'ACI lo dice come la rete', qq.aci.da_confermare === true && qq.rete.da_confermare === true, J([qq.aci.da_confermare, qq.rete.da_confermare]));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
