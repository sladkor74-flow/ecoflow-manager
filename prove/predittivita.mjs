// Prova del motore della predittivita' delle secondarie
// (base44/shared/predittivita.ts, calcolaPredittivita), con dati costruiti a
// mano: le regole date dall'utente il 26/09/2026, una per una.
//   - due proiezioni affiancate, sul target residuo dei raccoglitori e sul ritmo
//     reale delle ultime 12 settimane; un flusso senza target vale il ritmo; il
//     programma si fa sul target (utente, 27/09/2026);
//   - del target residuo di un raccoglitore conta la parte fino alla fine della
//     programmazione, in proporzione ai giorni che restano fino al 31/12;
//   - la priorita' di uno stoccaggio (Nappi Sud: prima Tecnogum, poi Irigom) non
//     e' "prima uno poi l'altro": ogni settimana li serve tutti; a chi resta
//     indietro si dice quanto manca;
//   - il plafond di uno stoccaggio, l'impianto che e' anche piazzale (T-Cycle),
//     l'impianto senza target escluso;
//   - il programma della settimana dopo: al primo la media arrotondata per
//     eccesso, agli altri l'avanzo fino alla loro parte, tutto nei limiti del
//     materiale;
//   - un viaggio fatto e' un camion in un giorno sullo stesso percorso;
//   - la giacenza del piazzale dall'ancora, fin dove arrivano i dati, l'anno a
//     cavallo (il ritmo di gennaio usa dicembre).
// La lettura dagli archivi: prove/predittivitaDati.mjs; la risposta per la
// pagina: prove/predittivitaRisposta.mjs; le funzioni: prove/predittivitaFunzioni.mjs.
// npm run prove
import { calcolaPredittivita, giacenzaPiazzale, chiaveViaggio, piuGiorni, lunediDi, giorniFra, SCENARI, SCENARIO_PROGRAMMA } from '../base44/shared/predittivita.ts';
import { regolePredittivita } from '../base44/shared/regolePredittivita.ts';
import { normalizzaRagioneSociale as chiave } from '../base44/shared/normalizzaRagioneSociale.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);

// Oggi e' mercoledi' 23/09/2026; i formulari della settimana scorsa arrivano a
// domenica 20/09. La finestra del ritmo sono le 12 settimane dal 29/06 al
// 20/09; la fine della programmazione e' il 18/12: dal 20/09 sono 89 giorni, e
// al 31/12 ce ne sono 102. Del target residuo di un raccoglitore conta quindi
// la parte 89/102; al ritmo, 89 giorni sono 89/7 settimane.
const OGGI = '2026-09-23';
const REGOLE = regolePredittivita(2026);
const QUOTA = 89 / 102;
const SETTIMANE = 89 / 7;
const KGV = 13000;

let n = 0;
const alle12 = (g) => `${g}T10:00:00Z`; // mezzogiorno italiano
const date = (g) => ({ ordine_immesso_il: alle12(g), trasporto_iniziato_il: alle12(g), trasporto_finito_il: alle12(g) });
const prim = (trasportatore, destinazione, kg, giorno, extra = {}) => ({ id: 'p' + (++n), id_ordine: 'P' + n, stato: 'terminato', classe: 'P', trasportatore, destinazione, tipo_destinazione: 'imp', peso_effettivo: kg, ...date(giorno), ...extra });
const sec = (stoccaggio, destinazione, kg, giorno, extra = {}) => ({ id: 's' + (++n), id_ordine: 'S' + n, stato: 'terminato', classe: 'P', stoccaggio, destinazione, tipo_destinazione: 'imp', peso_effettivo: kg, ...date(giorno), ...extra });
// le dodici domeniche della finestra del ritmo, dal 05/07 al 20/09
const DOMENICHE = Array.from({ length: 12 }, (_, i) => piuGiorni('2026-07-05', 7 * i));
const ogniSettimana = (trasportatore, destinazione, kg, extra = {}) => DOMENICHE.map(g => prim(trasportatore, destinazione, kg, g, extra));

// un formulario qualunque finito domenica 20/09: fin li' arrivano i dati
const OROLOGIO = prim('Qualcuno', 'Un Impianto Non Seguito', 1000, '2026-09-20');
const calcola = (d) => calcolaPredittivita({
  anno: 2026, oggi: OGGI, chiave, regole: REGOLE, fine: '2026-12-18',
  impianti: [], raccoglitori: [], stoccaggi: [], primarie: [], secondarie: [], ...d,
});
const impianto = (c, k) => c.impianti.find(i => i.chiave === k);
const stoccaggio = (c, k) => c.stoccaggi.find(s => s.chiave === k);
const flusso = (imp, nome) => imp.primarie.find(p => p.raccoglitore === nome);
const riga = (c, stocc, imp) => c.programma.find(r => r.stoccaggio === stocc && r.impianto === imp);
const tutti = (x, v) => SCENARI.every(s => x[s] === v);

console.log('I GIORNI');
verifica('gli scenari sono due, e si programma sul target', J(SCENARI) === J(['target', 'ritmo']) && SCENARIO_PROGRAMMA === 'target');
verifica('lunedi\' della settimana, anche di domenica', lunediDi('2026-09-23') === '2026-09-21' && lunediDi('2026-09-20') === '2026-09-14' && lunediDi('2026-09-21') === '2026-09-21');
verifica('giorni fra due date e date spostate, anche a cavallo d\'anno e con l\'ora legale', giorniFra('2026-09-20', '2026-12-18') === 89 && giorniFra('2026-09-20', '2026-12-31') === 102 && piuGiorni('2026-12-28', 7) === '2027-01-04' && piuGiorni('2026-10-24', 2) === '2026-10-26');

console.log('LE DUE PROIEZIONI');
// Irigom, 1.000 t. Quattro flussi di primaria:
//   Smoco       target 500 t, arrivate 296 t, 7 t a settimana: il target dice
//               204 t x 89/102 = 178 t, il ritmo 7 x 89/7 = 89 t;
//   Pneuservice target 300 t, arrivate 198 t, 14 t a settimana: il target dice
//               102 x 89/102 = 89 t, il ritmo 178 t;
//   Emmesse     senza target, 7 t a settimana: vale il ritmo, 89 t;
//   Nuovo       target 204 t, niente arrivato: target 178 t, ritmo 0.
const IRIGOM = { chiave: 'irigom', nome: 'Irigom', target_kg: 1000000 };
const flussiIrigom = [
  prim('Smoco Srl', 'Irigom Srl', 212000, '2026-03-10'), ...ogniSettimana('Smoco Srl', 'Irigom Srl', 7000),
  prim('Pneuservice Conversano', 'IRIGOM S.R.L.', 30000, '2026-02-10'), ...ogniSettimana('Pneuservice Conversano', 'IRIGOM S.R.L.', 14000),
  ...ogniSettimana('Emmesse', 'Irigom', 7000),
];
const dueProiezioni = calcola({
  impianti: [IRIGOM],
  raccoglitori: [
    { chiave: 'smoco', nome: 'Smoco', sito: 'irigom', target_kg: 500000 },
    { chiave: chiave('Pneuservice Conversano'), nome: 'Pneuservice', sito: 'irigom', target_kg: 300000 },
    { chiave: 'nuovo raccoglitore', nome: 'Nuovo Raccoglitore', sito: 'irigom', target_kg: 204000 },
  ],
  primarie: flussiIrigom,
});
const irigom = impianto(dueProiezioni, 'irigom');
const smoco = flusso(irigom, 'Smoco'), pneu = flusso(irigom, 'Pneuservice'), emmesse = flusso(irigom, 'Emmesse'), nuovo = flusso(irigom, 'Nuovo Raccoglitore');
verifica('ogni flusso ha il suo consuntivo e il suo ritmo', smoco && smoco.consuntivo_kg === 296000 && smoco.ritmo_settimanale_kg === 7000 && pneu.consuntivo_kg === 198000 && pneu.ritmo_settimanale_kg === 14000 && emmesse.consuntivo_kg === 84000 && nuovo.consuntivo_kg === 0, J(irigom.primarie));
verifica('Smoco rallenta: il target resta quello che gli manca, il ritmo e\' piu\' basso', J(smoco.attesa) === J({ target: 178000, ritmo: 89000 }), J(smoco.attesa));
verifica('Pneuservice corre piu\' del target: il target conta solo quello che gli manca', J(pneu.attesa) === J({ target: 89000, ritmo: 178000 }), J(pneu.attesa));
verifica('Emmesse senza target: in tutte e due le proiezioni vale il ritmo', emmesse.target_kg === null && emmesse.attesa.ritmo === 89000 && emmesse.attesa.target === 89000, J(emmesse));
verifica('un raccoglitore col target ma fermo: sul target porta il suo residuo, al ritmo niente', J(nuovo.attesa) === J({ target: 178000, ritmo: 0 }), J(nuovo.attesa));
verifica('i flussi dal piu\' grande', irigom.primarie.map(p => p.raccoglitore).join(',') === 'Smoco,Pneuservice,Emmesse,Nuovo Raccoglitore', irigom.primarie.map(p => p.raccoglitore).join(','));
verifica('la primaria attesa dell\'impianto, scenario per scenario', J(irigom.primaria_attesa) === J({ target: 534000, ritmo: 356000 }), J(irigom.primaria_attesa));
verifica('gia\' arrivato e residuo', irigom.gia_arrivato_kg === 578000 && irigom.residuo_kg === 422000 && irigom.target_superato === false, J([irigom.gia_arrivato_kg, irigom.residuo_kg]));
verifica('il resto deve arrivare in secondaria', J(irigom.fabbisogno_secondarie) === J({ target: 0, ritmo: 66000 }), J(irigom.fabbisogno_secondarie));
verifica('nessuno stoccaggio lo alimenta: manca tutto il fabbisogno', irigom.senza_stoccaggi === true && J(irigom.mancanza_kg) === J(irigom.fabbisogno_secondarie) && J(irigom.raggiunge) === J({ target: true, ritmo: false }), J([irigom.mancanza_kg, irigom.raggiunge]));
verifica('l\'orizzonte: dal giorno dopo i dati alla fine della programmazione', J(irigom.orizzonte) === J({ dal: '2026-09-21', al: '2026-12-18', giorni: 89, settimane: SETTIMANE }), J(irigom.orizzonte));

console.log('LA QUOTA DEL TARGET FINO ALLA FINE DELLA PROGRAMMAZIONE');
// Lo stesso Smoco, con la programmazione di Irigom che finisce il 30/11 (71
// giorni dal 20/09) o il 31/12: dei 204 t che mancano al suo target ne contano
// 204 x 71/102 = 142 t, o tutti.
const conFine = (fine) => flusso(impianto(calcola({
  impianti: [{ ...IRIGOM, fine }], raccoglitori: [{ chiave: 'smoco', nome: 'Smoco', sito: 'irigom', target_kg: 500000 }], primarie: flussiIrigom,
}), 'irigom'), 'Smoco');
verifica('fine al 30/11: 71/102 del target residuo, e il ritmo su 71 giorni', J(conFine('2026-11-30').attesa) === J({ target: 142000, ritmo: 71000 }), J(conFine('2026-11-30').attesa));
verifica('fine al 31/12: tutto il target residuo', conFine('2026-12-31').attesa.target === 204000, J(conFine('2026-12-31').attesa));
verifica('fine del 2026 del motore: 89/102', smoco.attesa.target === Math.round(204000 * QUOTA));
verifica('la fine dell\'impianto vale piu\' di quella dell\'anno', impianto(calcola({ impianti: [{ ...IRIGOM, fine: '2026-11-30' }] }), 'irigom').fine === '2026-11-30');

console.log('LA PRIORITA\' DI NAPPI SUD: PRIMA TECNOGUM, POI IRIGOM');
// Tecnogum: 1.159 t di target, arrivate 420 t (Ecorecuperi), attese 89 t in
// primaria: in secondaria servono 650 t, 50 viaggi. Irigom: 679 t, arrivate 200
// t (Smoco), attese 89 t: servono 390 t, 30 viaggi. Nappi Sud ha 821 t nel
// piazzale e al ritmo gliene arrivano altre 89 t: 910 t. A Tecnogum le sue 650,
// a Irigom le 260 che avanzano; a Irigom ne mancano 130 t.
const nappi = ({ giacenza = 821000, ritmo = 7000, destinazioni = [{ impianto: 'irigom', priorita: null }, { impianto: 'tecnogum', priorita: null }], plafond = null, extra = {} } = {}) => calcola({
  impianti: [{ chiave: 'tecnogum', nome: 'Tecnogum', target_kg: 1159000 }, { chiave: 'irigom', nome: 'Irigom', target_kg: 679000 }],
  stoccaggi: [{ chiave: 'nappi sud', nome: 'Nappi Sud', plafond_kg: plafond, giacenza_kg: giacenza, giacenza_da: '2025-12-31', destinazioni }],
  primarie: [
    prim('Ecorecuperi', 'Tecnogum Srl', 336000, '2026-03-02'), ...ogniSettimana('Ecorecuperi', 'Tecnogum Srl', 7000),
    prim('SMOCO', 'Irigom', 116000, '2026-03-02'), ...ogniSettimana('SMOCO', 'Irigom', 7000),
    ...ogniSettimana('Nappi Sud Srl', 'NAPPI SUD SRL', ritmo, { tipo_destinazione: 'stoc' }),
  ],
  ...extra,
});
const prio = nappi();
const tg = impianto(prio, 'tecnogum'), ir = impianto(prio, 'irigom'), ns = stoccaggio(prio, 'nappi sud');
verifica('la priorita\' delle regole del 2026, anche se la configurazione elenca Irigom per primo', ns && ns.destinazioni.map(d => `${d.impianto}:${d.priorita}`).join(',') === 'tecnogum:1,irigom:2', J(ns && ns.destinazioni));
verifica('i fabbisogni in secondaria', tg.fabbisogno_secondarie.target === 650000 && ir.fabbisogno_secondarie.target === 390000, J([tg.fabbisogno_secondarie, ir.fabbisogno_secondarie]));
verifica('il disponibile di Nappi Sud: giacenza piu\' entrate al ritmo', ns.disponibile.target === 910000 && ns.entrate_attese.target === 89000 && ns.giacenza_kg === 821000 && ns.entrate_flussi.length === 1 && ns.entrate_flussi[0].ritmo_settimanale_kg === 7000, J([ns.disponibile, ns.entrate_attese]));
const tgDaNappi = tg.da_stoccaggi.find(r => r.stoccaggio === 'nappi sud'), irDaNappi = ir.da_stoccaggi.find(r => r.stoccaggio === 'nappi sud');
verifica('a Tecnogum tutto quello che gli serve, 50 viaggi', tgDaNappi.kg.target === 650000 && tgDaNappi.viaggi_totali.target === 50 && tgDaNappi.priorita === 1, J(tgDaNappi));
verifica('a Irigom quello che avanza, 20 viaggi', irDaNappi.kg.target === 260000 && irDaNappi.viaggi_totali.target === 20 && irDaNappi.priorita === 2, J(irDaNappi));
verifica('i viaggi a settimana sull\'orizzonte', Math.abs(tgDaNappi.viaggi_settimana.target - 50 / SETTIMANE) < 1e-9 && Math.abs(irDaNappi.viaggi_settimana.target - 20 / SETTIMANE) < 1e-9);
verifica('Tecnogum raggiunge il target, a Irigom mancano 130 t', tg.mancanza_kg.target === 0 && tg.raggiunge.target === true && ir.mancanza_kg.target === 130000 && ir.raggiunge.target === false && ir.coperto_secondarie.target === 260000, J([tg.mancanza_kg, ir.mancanza_kg]));
verifica('Nappi Sud non tiene niente da parte', ns.non_assegnato.target === 0, J(ns.non_assegnato));
// Con materiale per tutti e due, tutti e due raggiungono, e il resto avanza.
const abbondanza = nappi({ giacenza: 2000000 });
verifica('con materiale per tutti nessuno resta indietro, e il resto avanza', impianto(abbondanza, 'irigom').mancanza_kg.target === 0 && impianto(abbondanza, 'tecnogum').mancanza_kg.target === 0 && stoccaggio(abbondanza, 'nappi sud').non_assegnato.target === 2089000 - 1040000, J(stoccaggio(abbondanza, 'nappi sud').non_assegnato));
// Una priorita' scritta nella configurazione vale piu' delle regole dell'anno.
const irigomPrima = nappi({ destinazioni: [{ impianto: 'irigom', priorita: 1 }, { impianto: 'tecnogum', priorita: 2 }] });
verifica('la priorita\' scritta in configurazione vale piu\' delle regole', impianto(irigomPrima, 'irigom').mancanza_kg.target === 0 && impianto(irigomPrima, 'tecnogum').mancanza_kg.target === 1040000 - 910000, J([impianto(irigomPrima, 'irigom').mancanza_kg, impianto(irigomPrima, 'tecnogum').mancanza_kg]));
// A pari priorita' il disponibile si divide in proporzione a quello che manca.
const pari = nappi({ destinazioni: [{ impianto: 'irigom', priorita: 1 }, { impianto: 'tecnogum', priorita: 1 }] });
const pariTg = impianto(pari, 'tecnogum').da_stoccaggi[0].kg.target, pariIr = impianto(pari, 'irigom').da_stoccaggi[0].kg.target;
verifica('a pari priorita\' in proporzione al fabbisogno', pariTg === 568750 && pariIr === 341250, J([pariTg, pariIr]));

console.log('IL PROGRAMMA DELLA SETTIMANA DOPO');
// Dal 28/09 al 04/10. Tecnogum ha la priorita': 50 viaggi in 89/7 settimane
// sono 3,93 a settimana, e ne prende 4 (per eccesso, cosi' arriva al target
// entro la fine). Irigom prende quelli che avanzano, fino alla sua parte (20).
// Nappi Sud puo' farne 58: 821 t, piu' 14 giorni di entrate a 1 t al giorno,
// meno 7 giorni di partenze a 5,5 viaggi a settimana (3,9 + 1,6) prima di lunedi'.
verifica('la settimana dopo', J(prio.prossima_settimana) === J({ dal: '2026-09-28', al: '2026-10-04' }), J(prio.prossima_settimana));
const rTg = riga(prio, 'Nappi Sud', 'Tecnogum'), rIr = riga(prio, 'Nappi Sud', 'Irigom');
verifica('al primo la media arrotondata per eccesso', rTg && rTg.media_settimanale === 3.9 && rTg.viaggi === 4 && rTg.kg === 4 * KGV && rTg.priorita === 1 && !rTg.limitato, J(rTg));
verifica('agli altri il loro ritmo settimanale per eccesso, non tutta la loro parte in una settimana', rIr && rIr.viaggi === 2 && rIr.spettanti === 20 && rIr.media_settimanale === 1.6 && !rIr.limitato, J(rIr));
verifica('quanti viaggi puo\' fare lo stoccaggio, e quanti sono programmati', J(ns.viaggi_prossima_settimana) === J({ possibili: 58, programmati: 6 }), J(ns.viaggi_prossima_settimana));
verifica('il motivo, a parole', rTg.motivo.includes('Ha la priorità') && rTg.motivo.includes('18/12/2026') && rTg.motivo.includes('3,9 viaggi') && rIr.motivo.includes('gliene spettano circa 20') && rIr.motivo.includes('mancheranno comunque circa 130,00 t'), J([rTg.motivo, rIr.motivo]));
verifica('righe della programmazione con chiave dell\'impianto e nome dello stoccaggio', rTg.chiave_impianto === 'tecnogum' && prio.programma.length === 2 && prio.programma[0].impianto === 'Tecnogum', J(prio.programma.map(r => r.impianto)));
// Il piazzale vuoto e 70 t a settimana in arrivo: 890 t fino alla fine, 650 a
// Tecnogum e 240 a Irigom (18 viaggi). Ma la settimana dopo i camion sono 5:
// 140 t in arrivo in 14 giorni, meno 7 giorni di partenze (3,9 + 1,5 a
// settimana). A Tecnogum i suoi 4, a Irigom 1 soltanto.
const vuoto = nappi({ giacenza: 0, ritmo: 70000 });
const vTg = riga(vuoto, 'Nappi Sud', 'Tecnogum'), vIr = riga(vuoto, 'Nappi Sud', 'Irigom');
verifica('il tetto del materiale: prima il primo, agli altri quello che resta', vTg.viaggi === 4 && !vTg.limitato && vIr.viaggi === 1 && vIr.limitato === true && Math.floor(vIr.spettanti) === 18 && J(stoccaggio(vuoto, 'nappi sud').viaggi_prossima_settimana) === J({ possibili: 5, programmati: 5 }), J([vTg, vIr, stoccaggio(vuoto, 'nappi sud').viaggi_prossima_settimana]));
verifica('chi e\' limitato dal materiale lo dice', vIr.motivo.includes('limitati dal materiale'), vIr.motivo);
// Il piazzale vuoto e 35 t a settimana: 445 t fino alla fine, tutte a
// Tecnogum (2,7 viaggi a settimana, cioe' 3), ma la settimana dopo i camion sono 2.
const poco = nappi({ giacenza: 0, ritmo: 35000 });
const pTg = riga(poco, 'Nappi Sud', 'Tecnogum'), pIr = riga(poco, 'Nappi Sud', 'Irigom');
verifica('anche il primo si ferma al materiale che c\'e\'', pTg.media_settimanale === 2.7 && pTg.viaggi === 2 && pTg.limitato === true && pIr.viaggi === 0 && pIr.spettanti === 0, J([pTg, pIr]));
verifica('a chi non avanza niente si dice', pIr.motivo.includes('non avanza materiale'), pIr.motivo);
// Un impianto la cui programmazione finisce prima della settimana dopo non si programma.
const chiuso = calcola({
  impianti: [{ chiave: 'tecnogum', nome: 'Tecnogum', target_kg: 1159000, fine: '2026-09-25' }, { chiave: 'irigom', nome: 'Irigom', target_kg: 679000 }],
  stoccaggi: [{ chiave: 'nappi sud', nome: 'Nappi Sud', giacenza_kg: 821000, destinazioni: [{ impianto: 'tecnogum' }, { impianto: 'irigom' }] }],
  primarie: [OROLOGIO],
});
verifica('la programmazione chiusa prima della settimana dopo non ha righe', chiuso.programma.map(r => r.impianto).join(',') === 'Irigom', J(chiuso.programma));

console.log('LO STOCCAGGIO CON PLAFOND');
// Deposito Sud ha un plafond di 100 t e quest'anno ne ha gia' spedite 60 (48 a
// Tecnogum e 12 a Gatim, che non e' seguito): ne restano 40 t, anche se nel
// piazzale ce ne sono 200. La settimana dopo non si fanno piu' di 3 viaggi.
const plafond = calcola({
  impianti: [{ chiave: 'tecnogum', nome: 'Tecnogum', target_kg: 2000000 }],
  stoccaggi: [{ chiave: 'deposito sud', nome: 'Deposito Sud', plafond_kg: 100000, giacenza_kg: 200000, giacenza_da: '2025-12-31', destinazioni: [{ impianto: 'tecnogum' }] }],
  primarie: [OROLOGIO],
  secondarie: [
    ...['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07'].map(g => sec('Deposito Sud', 'Tecnogum', 12000, g)),
    sec('Deposito Sud', 'Gatim', 12000, '2026-05-08'),
    sec('Deposito Sud', 'Tecnogum', 12000, '2025-11-05'), // l'anno scorso: il plafond e' dell'anno
  ],
});
const ds = stoccaggio(plafond, 'deposito sud');
verifica('il plafond si consuma con tutte le partenze dell\'anno verso altri', ds.plafond_kg === 100000 && ds.partiti_verso_altri_kg === 60000 && ds.residuo_plafond_kg === 40000, J(ds));
verifica('il disponibile si ferma al plafond', tutti(ds.disponibile, 40000) && impianto(plafond, 'tecnogum').da_stoccaggi[0].kg.target === 40000, J(ds.disponibile));
verifica('la settimana dopo non si programma oltre il plafond, tolto quello che partira\' prima di lunedi\'', ds.viaggi_prossima_settimana.possibili === 2, J(ds.viaggi_prossima_settimana));
// Senza plafond conta il materiale: 200 t, meno una settimana di partenze al
// passo del piano (1,2 viaggi) prima di lunedi': 14 viaggi.
const senzaPlafond = stoccaggio(calcola({ impianti: [{ chiave: 'tecnogum', nome: 'Tecnogum', target_kg: 2000000 }], stoccaggi: [{ chiave: 'deposito sud', nome: 'Deposito Sud', plafond_kg: 0, giacenza_kg: 200000, destinazioni: [{ impianto: 'tecnogum' }] }], primarie: [OROLOGIO] }), 'deposito sud');
verifica('un plafond a zero vuol dire senza plafond', senzaPlafond.plafond_kg === null && senzaPlafond.residuo_plafond_kg === null && senzaPlafond.disponibile.target === 200000 && senzaPlafond.viaggi_prossima_settimana.possibili === 14, J(senzaPlafond));

console.log('L\'IMPIANTO CHE E\' ANCHE PIAZZALE: T-CYCLE');
// T-Cycle tratta (1.050 t di target) e dal suo piazzale spedisce a Tecnogum,
// con un plafond di 250 t. All'impianto 100 t in primaria (7 t a settimana),
// nel piazzale 200 t (14 t a settimana), 60 t trasbordate a se stesso e 40 t
// partite per Tecnogum. Tecnogum (500 t): 84 t di Ecorecuperi e le 40 t da T-Cycle.
const tcycle = calcola({
  impianti: [{ chiave: 't-cycle', nome: 'T-Cycle', target_kg: 1050000 }, { chiave: 'tecnogum', nome: 'Tecnogum', target_kg: 500000 }],
  stoccaggi: [{ chiave: 't-cycle', nome: 'T-Cycle', plafond_kg: 250000, giacenza_kg: 20000, giacenza_da: '2025-12-31', destinazioni: [{ impianto: 't-cycle' }, { impianto: 'tecnogum' }] }],
  primarie: [
    prim('Logistica & Pneumatici', 'T-CYCLE INDUSTRIES SRL', 16000, '2026-04-01'), ...ogniSettimana('Logistica & Pneumatici', 'T-CYCLE INDUSTRIES SRL', 7000),
    prim('C.L. Service', 'T-Cycle Srl', 32000, '2026-05-01', { tipo_destinazione: 'stoc' }), ...ogniSettimana('C.L. Service', 'T-Cycle Srl', 14000, { tipo_destinazione: 'stoc' }),
    ...ogniSettimana('Ecorecuperi', 'Tecnogum', 7000),
  ],
  secondarie: [
    sec('T-Cycle', 'T-Cycle', 60000, '2026-08-03'),
    sec('T-Cycle', 'Tecnogum', 13000, '2026-08-04'), sec('T-Cycle', 'Tecnogum', 13000, '2026-08-05'), sec('T-Cycle', 'Tecnogum', 14000, '2026-08-06'),
  ],
});
const tcI = impianto(tcycle, 't-cycle'), tcS = stoccaggio(tcycle, 't-cycle'), tcTg = impianto(tcycle, 'tecnogum');
verifica('T-Cycle e\' impianto e piazzale, e il piazzale non alimenta se stesso', tcI && tcS && tcS.e_impianto === true && tcS.destinazioni.map(d => d.impianto).join(',') === 'tecnogum', J(tcS && tcS.destinazioni));
verifica('il gia\' arrivato di T-Cycle: il piazzale al netto di quello partito per Tecnogum, senza i trasbordi a se stesso', tcI.gia_arrivato_kg === 100000 + 200000 - 40000 && tcI.arrivato.da_se_stesso.kg === 60000 && tcTg.gia_arrivato_kg === 84000 + 40000, J([tcI.gia_arrivato_kg, tcTg.gia_arrivato_kg]));
verifica('il plafond si consuma solo con le partenze verso Tecnogum', tcS.partiti_verso_altri_kg === 40000 && tcS.residuo_plafond_kg === 210000, J(tcS));
verifica('le entrate del piazzale di un impianto si stimano sul ritmo in tutti gli scenari', tutti(tcS.entrate_attese, 178000), J(tcS.entrate_attese));
verifica('a Tecnogum il piazzale di T-Cycle da\' giacenza ed entrate', tcS.disponibile.target === 198000 && tcTg.da_stoccaggi[0].stoccaggio === 't-cycle' && tcTg.da_stoccaggi[0].kg.target === 198000, J([tcS.disponibile, tcTg.da_stoccaggi]));
verifica('a Tecnogum mancano 89 t', tcTg.fabbisogno_secondarie.target === 376000 - 89000 && tcTg.mancanza_kg.target === 89000, J([tcTg.fabbisogno_secondarie, tcTg.mancanza_kg]));
// All'impianto T-Cycle arriverebbero 89 + 178 t; 198 t partiranno per Tecnogum
// e non resteranno a lui.
verifica('quello che il piazzale spedira\' agli altri non resta a T-Cycle', tcI.primaria_attesa.target === 89000 + 178000 - 198000 && tcI.fabbisogno_secondarie.target === 790000 - 69000 && tcI.senza_stoccaggi === true, J([tcI.primaria_attesa, tcI.fabbisogno_secondarie]));
verifica('il fatto: i viaggi per Tecnogum, non i trasbordi a se stesso', tcycle.fatto.length === 1 && tcycle.fatto[0].stoccaggio === 't-cycle' && tcycle.fatto[0].impianto === 'tecnogum' && tcycle.fatto[0].viaggi === 3 && tcycle.fatto[0].kg === 40000, J(tcycle.fatto));
verifica('nel programma T-Cycle alimenta Tecnogum, non se stesso', tcycle.programma.length === 1 && tcycle.programma[0].impianto === 'Tecnogum', J(tcycle.programma));
// Se un altro stoccaggio alimenta T-Cycle, lo serve per quello che a T-Cycle
// manca davvero: tolto quello che il suo piazzale spedira' a Tecnogum. Nappi Sud
// ha 2.000 t: a T-Cycle servono 721 t, non le 523 che mancherebbero se il
// piazzale restasse tutto a lui, e non gli deve mancare niente mentre a Nappi
// Sud avanza materiale.
const tcycleNappi = calcola({
  impianti: [{ chiave: 't-cycle', nome: 'T-Cycle', target_kg: 1050000 }, { chiave: 'tecnogum', nome: 'Tecnogum', target_kg: 500000 }],
  stoccaggi: [
    { chiave: 'nappi sud', nome: 'Nappi Sud', giacenza_kg: 2000000, giacenza_da: '2025-12-31', destinazioni: [{ impianto: 't-cycle' }] },
    { chiave: 't-cycle', nome: 'T-Cycle', plafond_kg: 250000, giacenza_kg: 20000, giacenza_da: '2025-12-31', destinazioni: [{ impianto: 'tecnogum' }] },
  ],
  primarie: [
    prim('Logistica & Pneumatici', 'T-CYCLE INDUSTRIES SRL', 16000, '2026-04-01'), ...ogniSettimana('Logistica & Pneumatici', 'T-CYCLE INDUSTRIES SRL', 7000),
    prim('C.L. Service', 'T-Cycle Srl', 32000, '2026-05-01', { tipo_destinazione: 'stoc' }), ...ogniSettimana('C.L. Service', 'T-Cycle Srl', 14000, { tipo_destinazione: 'stoc' }),
    ...ogniSettimana('Ecorecuperi', 'Tecnogum', 7000),
  ],
  secondarie: [sec('T-Cycle', 'Tecnogum', 13000, '2026-08-04'), sec('T-Cycle', 'Tecnogum', 13000, '2026-08-05'), sec('T-Cycle', 'Tecnogum', 14000, '2026-08-06')],
});
const tcN = impianto(tcycleNappi, 't-cycle'), nsN = stoccaggio(tcycleNappi, 'nappi sud');
verifica('lo stoccaggio che alimenta T-Cycle copre quello che gli manca davvero', tcN.fabbisogno_secondarie.target === 721000 && tcN.da_stoccaggi[0].kg.target === 721000 && tcN.mancanza_kg.target === 0 && tcN.raggiunge.target === true, J([tcN.fabbisogno_secondarie, tcN.da_stoccaggi, tcN.mancanza_kg]));
verifica('e a Nappi Sud avanza il resto', nsN.non_assegnato.target === 2000000 - 721000, J(nsN.non_assegnato));
verifica('Tecnogum dal piazzale di T-Cycle come prima', impianto(tcycleNappi, 'tecnogum').mancanza_kg.target === 89000);

console.log('L\'IMPIANTO SENZA TARGET QUEST\'ANNO');
const senzaTarget = calcola({
  impianti: [{ chiave: 'gatim', nome: 'Gatim', target_kg: 0 }, { chiave: 'innorec', nome: 'Innorec' }, { chiave: 'irigom', nome: 'Irigom', target_kg: 500000 }],
  stoccaggi: [{ chiave: 'nappi sud', nome: 'Nappi Sud', giacenza_kg: 50000, destinazioni: [{ impianto: 'gatim' }, { impianto: 'irigom' }] }],
  secondarie: [sec('Nappi Sud', 'Gatim', 13000, '2026-09-15'), sec('Nappi Sud', 'Irigom', 13000, '2026-09-16')],
});
verifica('resta fuori dalla predittivita\'', senzaTarget.impianti.map(i => i.chiave).join(',') === 'irigom', J(senzaTarget.impianti.map(i => i.chiave)));
const avvisiSenzaTarget = senzaTarget.avvisi.filter(a => a.tipo === 'impianto_senza_target');
verifica('e si dice, uno per uno', avvisiSenzaTarget.length === 2 && avvisiSenzaTarget[0].impianto === 'Gatim' && avvisiSenzaTarget[0].testo.includes('non ha un target di rete per il 2026') && avvisiSenzaTarget[1].impianto === 'Innorec', J(avvisiSenzaTarget));
verifica('non e\' fra le destinazioni, nel fatto ne\' nel programma', stoccaggio(senzaTarget, 'nappi sud').destinazioni.map(d => d.impianto).join(',') === 'irigom' && senzaTarget.fatto.every(f => f.impianto !== 'gatim') && senzaTarget.programma.every(r => r.impianto !== 'Gatim'), J([senzaTarget.fatto, senzaTarget.programma]));
verifica('ma la secondaria verso Gatim consuma lo stesso il plafond', stoccaggio(senzaTarget, 'nappi sud').partiti_verso_altri_kg === 26000);

console.log('UN VIAGGIO FATTO E\' UN CAMION IN UN GIORNO');
// Nappi Sud -> Tecnogum, settimana dal 14/09: il 14 lo stesso camion (targa
// scritta in tre modi) porta quattro formulari, uno finito alle 00:30 italiane
// (22:30Z del 13); il 15 lo stesso camion ripassa, e ne passa un altro; il 16
// due ordini senza targa, uno in due quote. Sono 5 viaggi. Lo stesso camion il
// 15 va anche a Irigom: un altro percorso. Il 21 comincia un'altra settimana.
const viaggi = calcola({
  impianti: [{ chiave: 'tecnogum', nome: 'Tecnogum', target_kg: 2000000 }, { chiave: 'irigom', nome: 'Irigom', target_kg: 2000000 }],
  stoccaggi: [{ chiave: 'nappi sud', nome: 'Nappi Sud', giacenza_kg: 0, destinazioni: [{ impianto: 'tecnogum' }, { impianto: 'irigom' }] }],
  secondarie: [
    sec('Nappi Sud', 'Tecnogum', 8000, '2026-09-14', { automezzo: 'AB 123 CD', classe: 'P' }),
    sec('Nappi Sud', 'Tecnogum', 3000, '2026-09-14', { automezzo: 'AB123CD', classe: 'M' }),
    sec('Nappi Sud', 'TECNOGUM SRL', 1000, '2026-09-14', { automezzo: 'ab123cd', classe: 'G1' }),
    sec('Nappi Sud Srl', 'Tecnogum', 1000, '2026-09-14', { automezzo: 'AB123CD', trasporto_finito_il: '2026-09-13T22:30:00Z' }),
    sec('Nappi Sud', 'Tecnogum', 13000, '2026-09-15', { automezzo: 'AB123CD' }),
    sec('Nappi Sud', 'Tecnogum', 13000, '2026-09-15', { automezzo: 'XY999ZZ' }),
    sec('Nappi Sud', 'Tecnogum', 6000, '2026-09-16', { id_ordine: 'ORD1' }),
    sec('Nappi Sud', 'Tecnogum', 7000, '2026-09-16', { id_ordine: 'ORD1' }),
    sec('Nappi Sud', 'Tecnogum', 13000, '2026-09-16', { id_ordine: 'ORD2' }),
    sec('Nappi Sud', 'Irigom', 13000, '2026-09-15', { automezzo: 'AB123CD' }),
    sec('Nappi Sud', 'Tecnogum', 13000, '2026-09-21', { automezzo: 'AB123CD' }),
    sec('Nappi Sud', 'Tecnogum', 13000, '2026-09-17', { automezzo: 'AB123CD', classe: '9 - PFU Autodemolizione' }), // ACI: non e' della rete
    sec('Nappi Sud', 'Tecnogum', 13000, '2026-09-17', { automezzo: 'AB123CD', stato: 'assegnato' }),
  ],
});
const fatto = (settimana, imp) => viaggi.fatto.find(f => f.settimana === settimana && f.impianto === imp);
const f14 = fatto('2026-09-14', 'tecnogum');
verifica('stesso camion, stesso giorno, stesso percorso: un viaggio, anche con piu\' formulari divisi per classe', f14 && f14.viaggi === 5 && f14.kg === 8000 + 3000 + 1000 + 1000 + 13000 + 13000 + 6000 + 7000 + 13000, J(f14));
verifica('lo stesso camion verso un altro impianto e\' un altro viaggio', fatto('2026-09-14', 'irigom') && fatto('2026-09-14', 'irigom').viaggi === 1);
verifica('la settimana e\' quella del lunedi\' della fine trasporto', fatto('2026-09-21', 'tecnogum') && fatto('2026-09-21', 'tecnogum').viaggi === 1 && viaggi.fatto.length === 3, J(viaggi.fatto));
verifica('in ordine di settimana', viaggi.fatto.map(f => f.settimana).join(',') === '2026-09-14,2026-09-14,2026-09-21', J(viaggi.fatto.map(f => f.settimana)));
const unoDue = [sec('Nappi Sud', 'Tecnogum', 1, '2026-09-14', { automezzo: 'AB 123 CD' }), sec('NAPPI SUD SRL', 'Tecnogum Srl', 1, '2026-09-14', { automezzo: 'ab123cd' })];
verifica('la chiave del viaggio: giorno italiano, targa senza spazi, percorso', chiaveViaggio(unoDue[0], chiave) === '2026-09-14|AB123CD|nappi sud|tecnogum' && chiaveViaggio(unoDue[0], chiave) === chiaveViaggio(unoDue[1], chiave), chiaveViaggio(unoDue[0], chiave));
verifica('senza targa vale l\'ordine, poi il formulario', chiaveViaggio(sec('A', 'B', 1, '2026-09-14', { id_ordine: 'X1' }), chiave) === '2026-09-14|ORDINE:X1' && chiaveViaggio(sec('A', 'B', 1, '2026-09-14', { id_ordine: '', numero_fir: 'FIR9' }), chiave) === '2026-09-14|ORDINE:FIR9');

console.log('LA GIACENZA DEL PIAZZALE DALL\'ANCORA');
// Nappi Sud: 15 t al 31/12/2025. Entrano 10 + 4 + 1 t di primarie scaricate nel
// piazzale e 2 t di secondaria scaricata li'; partono 13 t per Tecnogum. Non
// contano: quello finito il giorno stesso dell'ancora (e' gia' nella lettura),
// l'ACI, gli assegnati, le primarie scaricate all'impianto, le secondarie ACI.
const movimentiNappi = {
  primarie: [
    prim('Nappi Sud', 'Nappi Sud Srl', 10000, '2026-01-05', { tipo_destinazione: 'stoc' }),
    prim('C.L. Service', 'NAPPI SUD', 4000, '2026-02-01', { tipo_destinazione: 'STOC ' }),
    prim('Nappi Sud', 'Nappi Sud', 9999, '2025-12-31', { tipo_destinazione: 'stoc' }),
    prim('Nappi Sud', 'Nappi Sud', 1000, '2025-12-31', { tipo_destinazione: 'stoc', trasporto_finito_il: '2025-12-31T23:30:00Z' }), // il 1 gennaio italiano
    prim('Nappi Sud', 'Nappi Sud', 7000, '2026-03-01', { tipo_destinazione: 'stoc', classe: '9 - PFU Autodemolizione' }),
    prim('Nappi Sud', 'Nappi Sud', 8000, '2026-03-01', { tipo_destinazione: 'stoc', stato: 'assegnato' }),
    prim('Nappi Sud', 'Nappi Sud', 3000, '2026-03-01', { tipo_destinazione: 'imp' }),
  ],
  secondarie: [
    sec('Nappi Sud', 'Tecnogum', 13000, '2026-03-01'),
    sec('Nappi Sud', 'Irigom', 13000, '2026-03-02', { classe: '9 - PFU Autodemolizione' }),
    sec('Altro Stoccaggio', 'Nappi Sud Srl', 2000, '2026-03-03', { tipo_destinazione: 'stoc' }),
  ],
};
verifica('ancora piu\' i movimenti di rete finiti dopo', giacenzaPiazzale({ chiaveStoccaggio: 'nappi sud', partenzaKg: 15000, partenzaDel: '2025-12-31', chiave, ...movimentiNappi }) === 15000 + 10000 + 4000 + 1000 + 2000 - 13000);
verifica('da una lettura dell\'anno si contano i movimenti dopo quella', giacenzaPiazzale({ chiaveStoccaggio: 'nappi sud', partenzaKg: 30000, partenzaDel: '2026-02-01', chiave, ...movimentiNappi }) === 30000 + 2000 - 13000);
verifica('senza ancora non c\'e\' una giacenza', giacenzaPiazzale({ chiaveStoccaggio: 'nappi sud', partenzaKg: null, partenzaDel: '2025-12-31', chiave, ...movimentiNappi }) === null && giacenzaPiazzale({ chiaveStoccaggio: 'nappi sud', partenzaKg: 5000, partenzaDel: '', chiave, ...movimentiNappi }) === null);
const senzaGiacenza = calcola({ impianti: [{ chiave: 'tecnogum', nome: 'Tecnogum', target_kg: 500000 }], stoccaggi: [{ chiave: 'nappi sud', nome: 'Nappi Sud', giacenza_kg: null, destinazioni: [{ impianto: 'tecnogum' }] }] });
verifica('il motore dice quando uno stoccaggio non ha da dove partire', stoccaggio(senzaGiacenza, 'nappi sud').giacenza_kg === null && senzaGiacenza.avvisi.some(a => a.tipo === 'stoccaggio_senza_giacenza' && a.stoccaggio === 'Nappi Sud'), J(senzaGiacenza.avvisi));
const giacenzaNegativa = stoccaggio(calcola({ impianti: [{ chiave: 'tecnogum', nome: 'Tecnogum', target_kg: 500000 }], stoccaggi: [{ chiave: 'nappi sud', nome: 'Nappi Sud', giacenza_kg: -27000, destinazioni: [{ impianto: 'tecnogum' }] }] }), 'nappi sud');
verifica('una giacenza sotto zero si mostra, ma non da\' materiale', giacenzaNegativa.giacenza_kg === -27000 && giacenzaNegativa.disponibile.target === 0 && giacenzaNegativa.viaggi_prossima_settimana.possibili === 0, J(giacenzaNegativa));

console.log('FIN DOVE ARRIVANO I DATI');
verifica('i dati arrivano a domenica: la settimana scorsa e\' completa', dueProiezioni.dati_al === '2026-09-20' && dueProiezioni.settimana_scorsa_completa === true && !dueProiezioni.avvisi.some(a => a.tipo === 'dati_incompleti'), J([dueProiezioni.dati_al, dueProiezioni.avvisi]));
verifica('la finestra del ritmo: 12 settimane fino ai dati', J(dueProiezioni.finestra_ritmo) === J({ dal: '2026-06-29', al: '2026-09-20', settimane: 12 }), J(dueProiezioni.finestra_ritmo));
const aVenerdi = calcola({ primarie: [prim('A', 'B', 1000, '2026-09-18'), prim('A', 'B', 1000, '2026-09-25')] });
verifica('fermi a venerdi\': la settimana scorsa puo\' non essere completa, e si dice', aVenerdi.dati_al === '2026-09-18' && aVenerdi.settimana_scorsa_completa === false && aVenerdi.avvisi.some(a => a.tipo === 'dati_incompleti' && a.testo.includes('18/09/2026') && a.testo.includes('20/09/2026')), J([aVenerdi.dati_al, aVenerdi.avvisi]));
verifica('un formulario dopo oggi non sposta i dati', aVenerdi.dati_al === '2026-09-18');
const vuotoAnno = calcola({ primarie: [prim('A', 'B', 1000, '2025-12-20')] });
verifica('niente dell\'anno: si dice il giorno vero a cui arrivano i dati, anche dell\'anno prima', vuotoAnno.dati_al === '2025-12-20' && vuotoAnno.settimana_scorsa_completa === false, vuotoAnno.dati_al);
verifica('la finestra del ritmo finisce al giorno vero dei dati, non a un 31/12 senza dati', vuotoAnno.finestra_ritmo.al === '2025-12-20', J(vuotoAnno.finestra_ritmo));
const lunedi = calcolaPredittivita({ anno: 2026, oggi: '2026-09-21', chiave, regole: REGOLE, fine: '2026-12-18', impianti: [], primarie: [prim('A', 'B', 1000, '2026-09-20')], secondarie: [] });
verifica('il lunedi\' con i dati fino a domenica: completa, e la settimana dopo e\' quella del 28', lunedi.settimana_scorsa_completa === true && lunedi.prossima_settimana.dal === '2026-09-28', J(lunedi.prossima_settimana));
verifica('le regole dell\'anno', dueProiezioni.kg_per_viaggio === 13000 && dueProiezioni.regole_definite === true && dueProiezioni.fine === '2026-12-18' && dueProiezioni.anno === 2026);

console.log('L\'ANNO A CAVALLO: IL RITMO DI GENNAIO USA DICEMBRE');
// Mercoledi' 13/01/2027: i dati arrivano a domenica 10/01, la finestra del
// ritmo comincia il 19/10/2026. Smoco porta 7 t ogni domenica dal 25/10/2026:
// il ritmo e' 7 t a settimana, ma dell'anno sono solo le 14 t di gennaio.
const REGOLE_2027 = regolePredittivita(2027);
const DOMENICHE_CAVALLO = Array.from({ length: 12 }, (_, i) => piuGiorni('2026-10-25', 7 * i));
const cavallo = calcolaPredittivita({
  anno: 2027, oggi: '2027-01-13', chiave, regole: REGOLE_2027, fine: '2027-12-31',
  impianti: [{ chiave: 'irigom', nome: 'Irigom', target_kg: 1000000 }],
  raccoglitori: [{ chiave: 'smoco', nome: 'Smoco', sito: 'irigom', target_kg: 364000 }],
  stoccaggi: [{ chiave: 'nappi sud', nome: 'Nappi Sud', giacenza_kg: 0, destinazioni: [{ impianto: 'irigom' }] }],
  primarie: [...DOMENICHE_CAVALLO.map(g => prim('Smoco', 'Irigom', 7000, g)), prim('Smoco', 'Irigom', 50000, '2026-06-01')],
  secondarie: [sec('Nappi Sud', 'Irigom', 13000, '2026-12-28'), sec('Nappi Sud', 'Irigom', 13000, '2027-01-05')],
});
const smoco27 = flusso(impianto(cavallo, 'irigom'), 'Smoco');
verifica('le ultime settimane chiuse, anche del 2026', cavallo.dati_al === '2027-01-10' && J(cavallo.finestra_ritmo) === J({ dal: '2026-10-19', al: '2027-01-10', settimane: 12 }), J(cavallo.finestra_ritmo));
verifica('il ritmo usa dicembre, il consuntivo e\' solo del 2027', smoco27.ritmo_settimanale_kg === 7000 && smoco27.consuntivo_kg === 14000, J(smoco27));
// al 31/12/2027 mancano 355 giorni: il target residuo (350 t) conta tutto, il ritmo 7 x 355/7
verifica('le due proiezioni del 2027', J(smoco27.attesa) === J({ target: 350000, ritmo: 355000 }), J(smoco27.attesa));
verifica('il gia\' arrivato e\' dell\'anno: le secondarie di dicembre no', impianto(cavallo, 'irigom').gia_arrivato_kg === 14000 + 13000, String(impianto(cavallo, 'irigom').gia_arrivato_kg));
verifica('il fatto e\' dell\'anno', cavallo.fatto.length === 1 && cavallo.fatto[0].settimana === '2027-01-04', J(cavallo.fatto));
verifica('un anno senza regole scritte lo dice', cavallo.regole_definite === false && cavallo.kg_per_viaggio === 13000 && cavallo.anno === 2027);
verifica('regole del 2026: 13 t a viaggio, Nappi Sud prima Tecnogum poi Irigom, 12 settimane', REGOLE.kg_per_viaggio === 13000 && J(REGOLE.priorita['nappi sud']) === J(['tecnogum', 'irigom']) && REGOLE.settimane_ritmo === 12 && REGOLE.definite === true && J(REGOLE_2027.priorita) === '{}');

console.log('SOLO RETE, SOLO TERMINATI');
const soloRete = calcola({
  impianti: [IRIGOM],
  primarie: [
    prim('Smoco', 'Irigom', 10000, '2026-09-01'),
    prim('Smoco', 'Irigom', 5000, '2026-09-01', { classe: '9 - PFU Autodemolizione' }),
    prim('Smoco', 'Irigom', 5000, '2026-09-01', { stato: 'assegnato' }),
    prim('Smoco', 'Irigom', 5000, '2026-09-01', { trasporto_finito_il: null }),
  ],
});
verifica('ACI, assegnati e senza fine trasporto non entrano in nessun conto', impianto(soloRete, 'irigom').gia_arrivato_kg === 10000 && flusso(impianto(soloRete, 'irigom'), 'Smoco').consuntivo_kg === 10000 && soloRete.dati_al === '2026-09-01', J(impianto(soloRete, 'irigom').primarie));

console.log('LA REVISIONE DEL 27/09/2026');
// Un impianto con la programmazione finita non riceve piu' niente: prima si
// prendeva tutto il materiale di Nappi Sud e risultava "arriva al target".
const finito = calcola({
  impianti: [{ chiave: 'tecnogum', nome: 'Tecnogum', target_kg: 1000000, fine: '2026-09-15' }, { chiave: 'irigom', nome: 'Irigom', target_kg: 1000000 }],
  stoccaggi: [{ chiave: 'nappi sud', nome: 'Nappi Sud', giacenza_kg: 400000, giacenza_da: '2025-12-31', destinazioni: [{ impianto: 'tecnogum', priorita: 1 }, { impianto: 'irigom', priorita: 2 }] }],
});
const tgF = impianto(finito, 'tecnogum'), irF = impianto(finito, 'irigom');
verifica('programmazione finita prima di oggi: niente dagli stoccaggi, e non arriva al target', tgF.fine < '2026-09-23' && tgF.coperto_secondarie.target === 0 && tgF.mancanza_kg.target === tgF.residuo_kg && tgF.raggiunge.target === false, J([tgF.coperto_secondarie, tgF.mancanza_kg]));
verifica('la sua parte resta a chi e\' ancora aperto', irF.coperto_secondarie.target === 400000, J(irF.coperto_secondarie));
const rIrF = riga(finito, 'Nappi Sud', 'Irigom');
verifica('nel programma chi resta e\' il primo: la sua media per eccesso, senza "priorita\'"', rIrF && rIrF.viaggi > 0 && !rIrF.motivo.includes('priorità') && !riga(finito, 'Nappi Sud', 'Tecnogum'), J(rIrF));
// La giacenza di un anno chiuso si ferma al 31/12: i movimenti dopo non contano.
const movAnnoDopo = { primarie: [], secondarie: [sec('Nappi Sud', 'Tecnogum', 13000, '2026-06-10'), sec('Nappi Sud', 'Tecnogum', 13000, '2027-02-10')] };
verifica('giacenza fino a un giorno: i movimenti dopo non entrano', giacenzaPiazzale({ chiaveStoccaggio: 'nappi sud', partenzaKg: 100000, partenzaDel: '2025-12-31', chiave, fino: '2026-12-31', ...movAnnoDopo }) === 87000
  && giacenzaPiazzale({ chiaveStoccaggio: 'nappi sud', partenzaKg: 100000, partenzaDel: '2025-12-31', chiave, ...movAnnoDopo }) === 74000);

console.log('IL PROGRAMMA SUL TARGET (27/09/2026)');
// Ecorecuperi porta a Tecnogum 20 t a settimana ma al suo target di 800 t
// mancano solo 100 t: al ritmo arriverebbero 20 x 89/7 = 254 t, sul target
// 100 x 89/102 = 87 t. Il programma segue il target residuo: a Tecnogum servono
// piu' secondarie di quante ne direbbe il ritmo.
const sulTarget = calcola({
  impianti: [{ chiave: 'tecnogum', nome: 'Tecnogum', target_kg: 2000000 }],
  raccoglitori: [{ chiave: 'ecorecuperi', nome: 'Ecorecuperi', sito: 'tecnogum', target_kg: 800000 }],
  stoccaggi: [{ chiave: 'nappi sud', nome: 'Nappi Sud', giacenza_kg: 2000000, destinazioni: [{ impianto: 'tecnogum' }] }],
  primarie: [prim('Ecorecuperi', 'Tecnogum', 460000, '2026-03-10'), ...ogniSettimana('Ecorecuperi', 'Tecnogum', 20000)],
});
const tgT = impianto(sulTarget, 'tecnogum');
const rottaT = tgT.da_stoccaggi[0];
const rigaT = riga(sulTarget, 'Nappi Sud', 'Tecnogum');
verifica('sul target serve piu\' secondaria che al ritmo', tgT.fabbisogno_secondarie.target > tgT.fabbisogno_secondarie.ritmo, J(tgT.fabbisogno_secondarie));
verifica('la media del programma e\' quella del target', rigaT && rigaT.media_settimanale === Math.round(rottaT.viaggi_settimana.target * 10) / 10 && rigaT.media_settimanale !== Math.round(rottaT.viaggi_settimana.ritmo * 10) / 10 && rigaT.viaggi === Math.ceil(rottaT.viaggi_settimana.target - 1e-9), J([rigaT, rottaT.viaggi_settimana]));
// Un target cambiato in Target & Status cambia tutto da li': con 900 t a Ecorecuperi
// mancano 200 t, e a Tecnogum servono meno secondarie.
const cambiato = impianto(calcola({
  impianti: [{ chiave: 'tecnogum', nome: 'Tecnogum', target_kg: 2000000 }],
  raccoglitori: [{ chiave: 'ecorecuperi', nome: 'Ecorecuperi', sito: 'tecnogum', target_kg: 900000 }],
  stoccaggi: [{ chiave: 'nappi sud', nome: 'Nappi Sud', giacenza_kg: 2000000, destinazioni: [{ impianto: 'tecnogum' }] }],
  primarie: [prim('Ecorecuperi', 'Tecnogum', 460000, '2026-03-10'), ...ogniSettimana('Ecorecuperi', 'Tecnogum', 20000)],
}), 'tecnogum');
verifica('un target cambiato si riflette subito', cambiato.fabbisogno_secondarie.target === tgT.fabbisogno_secondarie.target - Math.round(100000 * QUOTA) && cambiato.gia_arrivato_kg === tgT.gia_arrivato_kg, J([cambiato.fabbisogno_secondarie, tgT.fabbisogno_secondarie]));

console.log('LO STOCCAGGIO RIPARTISCE QUELLO CHE CI SARA\' DAVVERO');
// Chi scarica a Nappi Sud ha un target di 1.000 t e ne ha portate 300: sul target
// entrerebbero 700 x 89/102 t, al ritmo (5 t a settimana) 5 x 89/7 = 64 t. Il
// materiale da ripartire e' quello del ritmo, in tutti e due i conti.
const reale = stoccaggio(calcola({
  impianti: [{ chiave: 'tecnogum', nome: 'Tecnogum', target_kg: 2000000 }],
  raccoglitori: [{ chiave: 'grossista', nome: 'Grossista', sito: 'nappi sud', target_kg: 1000000 }],
  stoccaggi: [{ chiave: 'nappi sud', nome: 'Nappi Sud', giacenza_kg: 10000, destinazioni: [{ impianto: 'tecnogum' }] }],
  primarie: [prim('Grossista', 'Nappi Sud', 240000, '2026-03-10', { tipo_destinazione: 'Stoc' }), ...ogniSettimana('Grossista', 'Nappi Sud', 5000, { tipo_destinazione: 'Stoc' })],
}), 'nappi sud');
verifica('entrate al ritmo in tutti e due i conti', reale.entrate_attese.target === reale.entrate_attese.ritmo && reale.entrate_attese.ritmo === Math.round(5000 * SETTIMANE) && reale.disponibile.target === reale.disponibile.ritmo, J(reale.entrate_attese));
verifica('quanto entrerebbe col target resta come informazione', reale.entrate_se_rispettano_il_target_kg === Math.round(700000 * QUOTA), String(reale.entrate_se_rispettano_il_target_kg));

console.log('LA GIACENZA VECCHIA DEL PIAZZALE DI UN IMPIANTO ESCE PRIMA');
const conVecchia = (g) => impianto(calcola({
  impianti: [{ chiave: 't-cycle', nome: 'T-Cycle', target_kg: 1000000, giacenza_iniziale_kg: g }, { chiave: 'tecnogum', nome: 'Tecnogum', target_kg: 1000000 }],
  primarie: [prim('Smoco', 'T-Cycle', 50000, '2026-02-01', { tipo_destinazione: 'Stoc' })],
  secondarie: [sec('T-Cycle', 'Tecnogum', 30000, '2026-03-01')],
}), 't-cycle');
verifica('con 30 t al 31/12 la partenza non tocca le primarie dell\'anno', conVecchia(30000).gia_arrivato_kg === 50000 && conVecchia(30000).arrivato.ripartito_da_giacenza_vecchia_kg === 30000, J(conVecchia(30000).arrivato));
verifica('senza giacenza vecchia la partenza toglie dal gia\' arrivato', conVecchia(0).gia_arrivato_kg === 20000, String(conVecchia(0).gia_arrivato_kg));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
