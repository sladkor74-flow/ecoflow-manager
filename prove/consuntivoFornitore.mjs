// Prova del CONSUNTIVO DI CHIUSURA MESE di un fornitore
// (base44/shared/consuntivoFornitore.ts).
//
// Richiesta dell'utente (29/09/2026): si carica il report definitivo con cui il
// fornitore chiude il mese, se ne verifica l'esattezza riga per riga, si stima il
// costo previsto e lo si confronta con la fatturazione passiva, dichiarando la
// quadratura o le difformita'. E' un report SUO, senza IVA (decisione dell'utente).
//
// Le regole controllate qui: tre ruoli e tre basi diverse, un canale per volta, il
// periodo e' la fine trasporto, le quote dello stesso formulario si sommano prima
// del confronto, e quello che manca da una parte o dall'altra si dice.
// npm run prove
import { movimentiDelFornitore, confrontaConsuntivo, costoAttesoDallaPassiva, esitoConsuntivo, testoEsitoConsuntivo, chiaveRiga, chiaveFir, leggiRigheConsuntivo, pareOrdine, periodoSospetto, righeCheParonoTotali, colonneDaIntestazioni, importoTotaleDalFoglio, canaleDaClasse, canaleDellaRiga, chiaviDelGestionale, avvisoArretrati, avvisiDate, righeDaStampa } from '../base44/shared/consuntivoFornitore.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);

const g = (d) => `${d}T09:00:00Z`;
const prim = (id, c = {}) => ({
  id_ordine: id, numero_fir: 'FIR' + id, stato: 'terminato',
  trasportatore: 'C.L. SERVICE S.R.L.', destinazione: 'IRIGOM SRL', provincia: 'SA',
  peso_effettivo: 5000, classe: 'P - fino a 35 kg', prodotto: '.class1',
  trasporto_finito_il: g('2026-09-10'), ordine_chiuso_il: g('2026-10-05'), ...c,
});
const sec = (id, c = {}) => ({
  id_ordine: id, numero_fir: 'FIR' + id, stato: 'terminato',
  stoccaggio: 'NAPPI SUD SRL', destinazione: 'IRIGOM SRL', trasportatore: 'TRANSAR SRL',
  peso_effettivo: 12000, classe: 'P - fino a 35 kg', prodotto: '.class1',
  trasporto_finito_il: g('2026-09-12'), ...c,
});

const ARCHIVI = {
  primarieRete: [prim('ET1'), prim('ET2', { peso_effettivo: 3000 }), prim('ET3', { trasportatore: 'EMMESSE SRL' })],
  primarieAci: [],
  secondarie: [sec('SEC1'), sec('SEC2', { trasportatore: 'LOGISTICA SRL' })],
  extraRaccolta: [],
};
const P = { anno: 2026, mese: 9, canale: 'RETE' };

console.log('TRE RUOLI, TRE BASI DIVERSE');
const daRaccoglitore = movimentiDelFornitore(ARCHIVI, { ...P, fornitore: 'C.L. Service S.r.l.', ruolo: 'raccoglitore' });
verifica('il raccoglitore risponde delle primarie che ha raccolto', daRaccoglitore.length === 2
  && daRaccoglitore.every(r => r.trasportatore === 'C.L. SERVICE S.R.L.'), J(daRaccoglitore.map(r => r.id_ordine)));
verifica('il nome si riconosce anche scritto in un altro modo', daRaccoglitore.length === 2);
const daImpianto = movimentiDelFornitore(ARCHIVI, { ...P, fornitore: 'IRIGOM SRL', ruolo: 'impianto' });
verifica('l\'impianto risponde di TUTTO quello che gli e\' arrivato, primarie e secondarie',
  daImpianto.length === 5, J(daImpianto.map(r => r.id_ordine)));
const daTrasportatore = movimentiDelFornitore(ARCHIVI, { ...P, fornitore: 'TRANSAR SRL', ruolo: 'trasportatore' });
verifica('il trasportatore risponde delle secondarie che ha portato', daTrasportatore.length === 1
  && daTrasportatore[0].id_ordine === 'SEC1', J(daTrasportatore.map(r => r.id_ordine)));

console.log('UN CANALE PER VOLTA, E IL PERIODO E\' LA FINE TRASPORTO');
const conAci = { ...ARCHIVI, primarieRete: [...ARCHIVI.primarieRete, prim('ET9', { classe: 'PFU Autodemolizione', prodotto: '.class9' })] };
verifica('una classe 9 nell\'archivio della rete non entra nel consuntivo di rete',
  movimentiDelFornitore(conAci, { ...P, fornitore: 'C.L. Service S.r.l.', ruolo: 'raccoglitore' }).length === 2);
verifica('ma entra in quello ACI',
  movimentiDelFornitore(conAci, { ...P, canale: 'ACI', fornitore: 'C.L. Service S.r.l.', ruolo: 'raccoglitore' }).length === 1);
const altroMese = { ...ARCHIVI, primarieRete: [prim('ET8', { trasporto_finito_il: g('2026-08-31'), ordine_chiuso_il: g('2026-09-02') })] };
verifica('un carico finito ad agosto e chiuso a settembre e\' di agosto',
  movimentiDelFornitore(altroMese, { ...P, fornitore: 'C.L. Service S.r.l.', ruolo: 'raccoglitore' }).length === 0
  && movimentiDelFornitore(altroMese, { ...P, mese: 8, fornitore: 'C.L. Service S.r.l.', ruolo: 'raccoglitore' }).length === 1);
verifica('un terminato senza fine trasporto non sta in nessun mese',
  movimentiDelFornitore({ ...ARCHIVI, primarieRete: [prim('ET7', { trasporto_finito_il: null })] },
    { ...P, fornitore: 'C.L. Service S.r.l.', ruolo: 'raccoglitore' }).length === 0);

console.log('IL CONFRONTO RIGA PER RIGA');
const suoi = daRaccoglitore;
const tuttoBene = confrontaConsuntivo([
  { numero_fir: 'FIRET1', kg: 5000 },
  { numero_fir: 'FIRET2', kg: 3000 },
], suoi);
verifica('quando tutto torna, quadra', tuttoBene.quadra === true && tuttoBene.uguali === 2, J(tuttoBene));
verifica('e i totali sono gli stessi', tuttoBene.totale_consuntivo_kg === 8000 && tuttoBene.totale_gestionale_kg === 8000 && tuttoBene.scarto_totale_kg === 0);

const pesoDiverso = confrontaConsuntivo([{ numero_fir: 'FIRET1', kg: 5400 }, { numero_fir: 'FIRET2', kg: 3000 }], suoi);
verifica('un peso diverso si dice, col suo scarto', pesoDiverso.quadra === false && pesoDiverso.peso_diverso === 1
  && pesoDiverso.voci[0].scarto_kg === 400, J(pesoDiverso.voci[0]));

const luiInPiu = confrontaConsuntivo([{ numero_fir: 'FIRET1', kg: 5000 }, { numero_fir: 'FIRET2', kg: 3000 }, { numero_fir: 'FIRX99', kg: 2000 }], suoi);
verifica('un formulario che ci fattura e noi non abbiamo si dice', luiInPiu.solo_consuntivo === 1
  && luiInPiu.kg_solo_consuntivo === 2000, J(luiInPiu.voci.find(v => v.esito === 'solo_consuntivo')));
const noiInPiu = confrontaConsuntivo([{ numero_fir: 'FIRET1', kg: 5000 }], suoi);
verifica('e uno che abbiamo noi e lui non riporta pure', noiInPiu.solo_gestionale === 1
  && noiInPiu.kg_solo_gestionale === 3000, J(noiInPiu.voci.find(v => v.esito === 'solo_gestionale')));

console.log('LE QUOTE DELLO STESSO FORMULARIO SI SOMMANO PRIMA DEL CONFRONTO');
// Il caso vero: RGYTR022620TW su due ordini, 1.960 + 1.500 = 3.460 kg. Il
// fornitore lo scrive una riga sola da 3.460: deve tornare.
const ripartito = movimentiDelFornitore({
  ...ARCHIVI,
  primarieRete: [
    prim('ET26091175', { numero_fir: 'RGYTR022620TW', peso_effettivo: 1960 }),
    prim('ET26102183', { numero_fir: 'RGYTR022620TW', peso_effettivo: 1500 }),
  ],
}, { ...P, fornitore: 'C.L. Service S.r.l.', ruolo: 'raccoglitore' });
const conRipartito = confrontaConsuntivo([{ numero_fir: 'RGYTR022620TW', kg: 3460 }], ripartito);
verifica('un formulario ripartito su due ordini torna con una riga sola da 3.460',
  conRipartito.quadra === true && conRipartito.voci[0].kg_gestionale === 3460 && conRipartito.voci[0].righe_gestionale === 2, J(conRipartito.voci[0]));
verifica('e i formulari restano uno', conRipartito.formulari_gestionale === 1, String(conRipartito.formulari_gestionale));

console.log('LE RIGHE CHE NON SI POSSONO ABBINARE SI DICONO');
const senzaNulla = confrontaConsuntivo([{ numero_fir: 'FIRET1', kg: 5000 }, { kg: 900 }], suoi);
verifica('una riga senza formulario ne\' ordine si conta a parte', senzaNulla.senza_chiave === 1
  && senzaNulla.senza_chiave_kg === 900 && senzaNulla.quadra === false, J([senzaNulla.senza_chiave, senzaNulla.senza_chiave_kg]));
verifica('ma i suoi chili restano nel totale del consuntivo', senzaNulla.totale_consuntivo_kg === 5900, String(senzaNulla.totale_consuntivo_kg));
verifica('la chiave e\' il formulario, e in mancanza l\'ordine',
  chiaveRiga({ numero_fir: 'RG 123-4' }) === 'FIR:RG1234' && chiaveRiga({ ordine: 'et 26.091175' }) === 'ORD:ET26091175' && chiaveRiga({}) === '');

console.log('IL COSTO PREVISTO SI LEGGE DALLA PASSIVA, NON SI RICALCOLA');
const passiva = {
  raccoglitori: [{ fornitore: 'C.L. SERVICE S.R.L.', totale_tonnellate: 8, totale_euro: 640, righe: [{}] }],
  impianti_stoccaggi: [{ fornitore: 'IRIGOM SRL', totale_tonnellate: 29, totale_euro: 2900, righe: [{}] }],
  trasporti_secondaria: [{ fornitore: 'TRANSAR SRL', totale_tonnellate: 12, totale_euro: 840, righe: [{}] }],
};
const costo = costoAttesoDallaPassiva(passiva, 'C.L. Service S.r.l.', 'raccoglitore');
verifica('si prende il blocco giusto per il ruolo', costo.trovato === true && costo.blocco === 'raccoglitori'
  && costo.importo === 640 && costo.tonnellate === 8, J(costo));
verifica('lo stesso soggetto in due ruoli ha due importi diversi, e non si confondono',
  costoAttesoDallaPassiva(passiva, 'IRIGOM SRL', 'impianto').importo === 2900
  && costoAttesoDallaPassiva(passiva, 'IRIGOM SRL', 'raccoglitore').trovato === false);
verifica('se nella passiva non c\'e\', si dice perche\' invece di mettere zero',
  /non c'e' nessuna riga/.test(costoAttesoDallaPassiva(passiva, 'SCONOSCIUTA SRL', 'raccoglitore').motivo));
verifica('senza il conto della passiva non si inventa un costo', costoAttesoDallaPassiva(null, 'X', 'raccoglitore') === null);

console.log('IL VERDETTO');
const buono = esitoConsuntivo({ confronto: tuttoBene, costo, importo_consuntivo: 640 });
verifica('quadra su tutto', buono.quadra_quantita === true && buono.quadra_con_passiva === true && buono.quadra_importo === true, J(buono));
const conScarto = esitoConsuntivo({ confronto: tuttoBene, costo, importo_consuntivo: 700 });
verifica('un importo diverso si dice, col suo scarto', conScarto.quadra_importo === false && conScarto.scarto_importo === 60, J(conScarto));
verifica('e sotto la tolleranza no', esitoConsuntivo({ confronto: tuttoBene, costo, importo_consuntivo: 640.01 }).quadra_importo === true);
// I chili della passiva diversi dai nostri: prima di guardare gli euro va capito.
const passivaCorta = { raccoglitori: [{ fornitore: 'C.L. SERVICE S.R.L.', totale_tonnellate: 5, totale_euro: 400, righe: [] }] };
const conPassivaCorta = esitoConsuntivo({ confronto: tuttoBene, costo: costoAttesoDallaPassiva(passivaCorta, 'C.L. Service S.r.l.', 'raccoglitore') });
verifica('se la passiva conta altri chili, si dice', conPassivaCorta.quadra_con_passiva === false
  && conPassivaCorta.scarto_passiva_kg === 3000, J(conPassivaCorta));
verifica('senza importo nel consuntivo non si giudica l\'importo',
  esitoConsuntivo({ confronto: tuttoBene, costo }).quadra_importo === null);
const interno = costoAttesoDallaPassiva({ raccoglitori: [{ fornitore: 'SMOCO SRL', totale_tonnellate: 8, totale_euro: 0, interno: true, righe: [] }] }, 'SMOCO SRL', 'raccoglitore');
verifica('un fornitore interno si riconosce', esitoConsuntivo({ confronto: tuttoBene, costo: interno }).interno === true);

console.log('IL LETTORE: UN CONSUNTIVO NON E\' UNA PREFATTURA');
// Il caso che la prima stesura non riusciva nemmeno a caricare: formulario e chili,
// senza nessun numero d'ordine. E' il documento tipico di un raccoglitore.
const soloFir = leggiRigheConsuntivo([{ nome: 'Riepilogo Settembre', celle: [
  ['Formulario', 'Data scarico', 'Peso kg'],
  ['RGYTR000021AA', '10/09/2026', 5000],
  ['RGYTR000022AA', '15/09/2026', 3000],
] }]);
verifica('un consuntivo con formulario e chili si legge', soloFir.righe.length === 2
  && soloFir.righe[0].numero_fir === 'RGYTR000021AA' && soloFir.righe[0].kg === 5000, J(soloFir.righe));
verifica('e si dice quali colonne sono state riconosciute', soloFir.colonne.length === 1
  && soloFir.colonne[0].colonne.numero_fir === 'Formulario', J(soloFir.colonne));
// SENZA INTESTAZIONI NON SI LEGGE, e si dice perche'. Fino al 01/10/2026 le
// colonne si indovinavano dalla forma dei valori: il formulario si riconosce,
// ma il PESO no - qualunque colonna di numeri gli somiglia. Misurato sui
// consuntivi veri, indovinando uscivano 323.051.160 kg dal registro di IRIGOM.
const senzaTeste = leggiRigheConsuntivo([{ nome: 'F1', celle: [
  ['RGYTR000021AA', 5000], ['RGYTR000022AA', 3000],
] }]);
verifica('senza intestazioni non si legge niente', senzaTeste.righe.length === 0, J(senzaTeste.righe));
verifica('e si dice che il peso non si sa quale sia', senzaTeste.note.some(n => /non so quale colonna sia il peso/.test(n)), J(senzaTeste.note));
verifica('e si dice che cosa serve', senzaTeste.note.some(n => /Serve un foglio con le intestazioni/.test(n)), J(senzaTeste.note));
// I pesi in tonnellate si riconoscono dall'ordine di grandezza.
const inTonnellate = leggiRigheConsuntivo([{ nome: 'T', celle: [['Formulario', 'Peso t'], ['RGYTR000021AA', 5.4]] }]);
verifica('un peso in tonnellate diventa chili', inTonnellate.righe[0].kg === 5400, String(inTonnellate.righe[0].kg));
// Le righe non abbinabili si dicono, non spariscono in silenzio.
const conScarti = leggiRigheConsuntivo([{ nome: 'S', celle: [
  ['Formulario', 'Peso kg'], ['RGYTR000021AA', 5000], ['TOTALE', 5000],
] }]);
verifica('una riga senza formulario si conta e si dice', conScarti.righe.length === 1
  && conScarti.scartate === 1 && conScarti.note.some(n => /non avevano/.test(n)), J([conScarti.scartate, conScarti.note]));

console.log('SI ABBINA SUL FORMULARIO O SULL\'ORDINE, NON SU UNO SOLO');
// Il difetto: i nostri movimenti hanno sempre il formulario, il consuntivo a volte
// solo l'ordine. Le due chiavi non si incontravano mai e usciva il 100% di
// difformita', con gli stessi chili accusati due volte in versi opposti.
const perOrdine = confrontaConsuntivo([
  { id_ordine: 'ET26091175', kg: 1960 },
  { id_ordine: 'ET26102183', kg: 1500 },
], ripartito);
verifica('un consuntivo che porta gli ORDINI si abbina ai nostri movimenti',
  perOrdine.quadra === true && perOrdine.uguali === 1 && perOrdine.solo_consuntivo === 0 && perOrdine.solo_gestionale === 0,
  J([perOrdine.uguali, perOrdine.solo_consuntivo, perOrdine.solo_gestionale]));
verifica('e i chili tornano: 1.960 + 1.500 = 3.460', perOrdine.voci[0].kg_consuntivo === 3460 && perOrdine.voci[0].kg_gestionale === 3460, J(perOrdine.voci[0]));

console.log('I SUBFORNITORI: CHI FATTURA, NON CHI HA LAVORATO');
// La passiva accorpa le tonnellate del subfornitore al principale. Senza fare lo
// stesso, al principale si metteva accanto ai suoi soli chili l'importo di tutto il
// gruppo, e il subfornitore usciva "a posto" senza nessun costo da opporgli.
const FORNITORI = [
  { ragione_sociale: 'GREEN TYRE PROJECT SRL' },
  { ragione_sociale: 'TORRES GIOVANNI', fattura_tramite_nome: 'GREEN TYRE PROJECT SRL' },
];
const conSub = {
  primarieRete: [
    prim('ET10', { trasportatore: 'GREEN TYRE PROJECT SRL', numero_fir: 'FIRGTP1', peso_effettivo: 10000 }),
    prim('ET11', { trasportatore: 'TORRES GIOVANNI', numero_fir: 'FIRTOR1', peso_effettivo: 4000 }),
  ],
  primarieAci: [], secondarie: [], extraRaccolta: [],
};
const delGruppo = movimentiDelFornitore(conSub, { ...P, fornitore: 'GREEN TYRE PROJECT SRL', ruolo: 'raccoglitore', fornitori: FORNITORI });
verifica('i movimenti del principale comprendono quelli del subfornitore', delGruppo.length === 2
  && delGruppo.reduce((s, r) => s + r.peso_effettivo, 0) === 14000, J(delGruppo.map(r => [r.id_ordine, r.trasportatore])));
verifica('e chiedendo il subfornitore si ottiene lo stesso gruppo, che e\' chi fattura',
  movimentiDelFornitore(conSub, { ...P, fornitore: 'TORRES GIOVANNI', ruolo: 'raccoglitore', fornitori: FORNITORI }).length === 2);
const consGruppo = confrontaConsuntivo([{ numero_fir: 'FIRGTP1', kg: 10000 }, { numero_fir: 'FIRTOR1', kg: 4000 }], delGruppo);
verifica('e il consuntivo del principale, che li fattura tutti e due, quadra', consGruppo.quadra === true, J(consGruppo.voci.map(v => [v.chiave, v.esito])));

console.log('EXTRA RACCOLTA: LE SECONDARIE SONO PAGATE COME RACCOLTA');
// La passiva le conta fra le raccolte del trasportatore; escluderle metteva accanto
// a sei tonnellate l'importo di quindici, con una spiegazione inventata.
const extraArchivi = {
  primarieRete: [], primarieAci: [], secondarie: [],
  extraRaccolta: [
    { id_ordine: 'EX1', numero_fir: 'FIREX1', stato: 'terminato', trasportatore: 'EMMESSE SRL', peso_effettivo: 10000, trasporto_finito_il: g('2026-09-10') },
    { id_ordine: 'EX2', numero_fir: 'FIREX2', stato: 'terminato', tipo_movimento: 'secondaria', trasportatore: 'EMMESSE SRL', peso_effettivo: 4000, trasporto_finito_il: g('2026-09-12') },
  ],
};
const extraRacc = movimentiDelFornitore(extraArchivi, { anno: 2026, mese: 9, canale: 'EXTRA_RACCOLTA', fornitore: 'EMMESSE SRL', ruolo: 'raccoglitore' });
verifica('anche la secondaria di extra raccolta sta fra le sue raccolte', extraRacc.length === 2
  && extraRacc.reduce((s, r) => s + r.peso_effettivo, 0) === 14000, J(extraRacc.map(r => r.id_ordine)));
verifica('e non sta fra i trasporti di secondaria, dove la passiva non la paga',
  movimentiDelFornitore(extraArchivi, { anno: 2026, mese: 9, canale: 'EXTRA_RACCOLTA', fornitore: 'EMMESSE SRL', ruolo: 'trasportatore' }).length === 0);

console.log('IL VERDETTO NON E\' VERDE SE I SOLDI NON TORNANO');
const soldiStorti = esitoConsuntivo({ confronto: tuttoBene, costo, importo_consuntivo: 900 });
verifica('chili perfetti ma 260 euro di differenza: NON quadra', soldiStorti.quadra_tutto === false
  && soldiStorti.quadra_quantita === true, J([soldiStorti.quadra_tutto, soldiStorti.scarto_importo]));
const senzaCosto = esitoConsuntivo({ confronto: tuttoBene, costo: { trovato: false, motivo: 'niente' } });
verifica('e nemmeno quando un costo da opporre non esiste affatto', senzaCosto.quadra_tutto === false, J(senzaCosto));
verifica('ma si dice che cosa non si e\' potuto controllare, invece di tacere',
  senzaCosto.non_controllato.length === 2 && /il costo previsto/.test(senzaCosto.non_controllato[0]), J(senzaCosto.non_controllato));
verifica('quando torna tutto, quadra', esitoConsuntivo({ confronto: tuttoBene, costo, importo_consuntivo: 640 }).quadra_tutto === true);
verifica('e senza importo sul consuntivo il verdetto resta buono sui chili',
  esitoConsuntivo({ confronto: tuttoBene, costo }).quadra_tutto === true);

console.log('IL TESTO CHE SI LEGGE');
verifica('quando quadra lo dice in parole', /corrisponde ai nostri movimenti/.test(testoEsitoConsuntivo(tuttoBene, buono)));
verifica('e quando no, dice che cosa non torna',
  /non corrisponde/.test(testoEsitoConsuntivo(luiInPiu, esitoConsuntivo({ confronto: luiInPiu, costo })))
  && /che noi non abbiamo/.test(testoEsitoConsuntivo(luiInPiu, esitoConsuntivo({ confronto: luiInPiu, costo }))),
  testoEsitoConsuntivo(luiInPiu, esitoConsuntivo({ confronto: luiInPiu, costo })));

// === IL CONSUNTIVO DI LOGISTICA & PNEUMATICI, 30/09/2026 ===
//
// Segnalazione dell'utente: "mi hai riportato un insieme di non conformita' senza
// senso come se non avessi per niente compreso il file del fornitore". Dal report
// del confronto si vede che cosa il gestionale aveva creduto di leggere: fra i
// "carichi che il fornitore ci fattura" c'erano l'intestazione di una colonna, una
// sigla di provincia, un pezzo di ragione sociale e due righe di totale.
//
// Queste prove riproducono quelle righe esatte.
console.log('UNA PAROLA NON E\' UN NUMERO D\'ORDINE');
verifica('una sigla di provincia non e un ordine', pareOrdine('AV') === '');
verifica('un pezzo di ragione sociale non e un ordine', pareOrdine('NAPPI') === '');
verifica("l'intestazione di una colonna non e un ordine", pareOrdine("PR (PROVINCIA UNITA' LOCALE PRODUTTORE)") === '');
verifica('una parola qualunque non e un ordine', pareOrdine('TOTALE') === '' && pareOrdine('Fornitore') === '');
verifica('un ordine vero lo e', pareOrdine('ET26125844') === 'ET26125844');
verifica('e lo e anche scritto male', pareOrdine(' et 26.125844 ') === 'ET26125844');
verifica('un numero corto ma con cifre resta un ordine', pareOrdine('0068') === '0068');
verifica('due caratteri no', pareOrdine('A1') === '');

console.log('LE RIGHE DI INTESTAZIONE NON DIVENTANO CARICHI');
{
  // Il foglio come il gestionale lo leggeva quando NON trovava l'intestazione:
  // titoli e metadati diventavano carichi. Adesso un foglio senza intestazione
  // non si legge affatto, ed e' la difesa definitiva: non c'e' nessuna riga
  // inventata perche' non c'e' nessuna riga.
  const celle = [
    ['Consuntivo mensile', null, null],
    ['Fornitore', 'LOGISTICA & PNEUMATICI SRL', null],
    ["PR (PROVINCIA UNITA' LOCALE PRODUTTORE)", 'NAPPI', 'AV'],
    ['RTXZV001717KH', 'ET26125844', 3700],
    ['RTXZV001718KR', 'ET26112026', 3540],
  ];
  const lette = leggiRigheConsuntivo([{ nome: 'Foglio1', celle }]);
  verifica('niente si legge, quindi niente si inventa', lette.righe.length === 0, J(lette.righe));
  verifica("l'intestazione non e diventata un carico", !lette.righe.some(r => /PROVINCIA/i.test(r.numero_fir + r.id_ordine)));
  verifica('e si dice che i formulari ci sono ma il peso no', lette.note.some(n => /ci sono dei formulari ma non riconosco la riga delle intestazioni/.test(n)), J(lette.note));
}
{
  // Lo stesso foglio CON la sua intestazione: si legge tutto.
  const celle = [
    ['Consuntivo mensile', null, null, null],
    ['N. FORMULARIO', 'ORDINE ET', 'NETTO IN KG', 'CLASSE'],
    ['RTXZV001717KH', 'ET26125844', 3700, 'P'],
    ['RTXZV001718KR', 'ET26112026', 3540, 'P'],
  ];
  const lette = leggiRigheConsuntivo([{ nome: 'Foglio1', celle }]);
  verifica('con le intestazioni si legge tutto', lette.righe.length === 2 && lette.righe[0].kg === 3700, J(lette.righe));
  verifica("e il titolo sopra non e un carico", !lette.righe.some(r => /Consuntivo/i.test(r.numero_fir)));
  verifica('e la classe arriva', lette.righe.every(r => r.classe === 'P'), J(lette.righe.map(r => r.classe)));
}
{
  // Il foglio GIACENZA di NAPPI: nessun formulario, e si dice che non e' un
  // elenco di carichi invece di inventarne.
  const celle = [
    [null, null, null, null, 'GIAC 31 LUGLIO 2026', null, 'GIACENZA FINALE'],
    ['TOT GOMMISTI', -38480, 'KG', null, 51800, 'TOT.'],
    ['classe 1', -17080, 'KG', null, 32900, 'CLS 1', 15820],
  ];
  const lette = leggiRigheConsuntivo([{ nome: 'GIACENZA', celle }]);
  verifica('le giacenze non diventano carichi', lette.righe.length === 0, J(lette.righe));
  verifica('e si dice che non e un elenco di carichi', lette.note.some(n => /non e' un elenco di carichi/.test(n)), J(lette.note));
}

console.log('LE RIGHE DI UN ALTRO MESE RESTANO FUORI');
{
  // IRIGOM manda il registro di carico e scarico dell'ANNO: 3.026 righe per
  // 15.298 tonnellate. Confrontato tutto contro un mese solo darebbe migliaia di
  // finte difformita', che sono semplicemente gli altri undici mesi.
  const movimenti = [{ numero_fir: 'RTXZV001718KR', id_ordine: 'ET26112026', peso_effettivo: 3540 }];
  const righe = [
    { numero_fir: 'RTXZV001718KR', kg: 3540, giorno: '2026-08-03' },
    { numero_fir: 'AAAAA000001AA', kg: 9000, giorno: '2026-03-14' },
    { numero_fir: 'AAAAA000002AA', kg: 8000, giorno: '2026-04-02' },
  ];
  const c = confrontaConsuntivo(righe, movimenti, { tolleranza_kg: 1, anno: 2026, mese: 8 });
  verifica('la riga del mese quadra', c.uguali === 1, J(c.voci));
  verifica('le altre due restano fuori', c.fuori_periodo === 2 && c.kg_fuori_periodo === 17000, J(c));
  verifica('e non sono difformita', c.solo_consuntivo === 0, J(c.voci));
  verifica('il consuntivo quadra', c.quadra === true, J(c));
  const testo = testoEsitoConsuntivo(c, esitoConsuntivo({ confronto: c, costo: null }));
  verifica('e il testo lo spiega', /2 righe del consuntivo sono di un altro mese/.test(testo), testo);
  // Tre mesi non fanno un registro: in un consuntivo del mese quelle due righe
  // vanno chiarite, non archiviate come normali (utente, 01/10/2026). Senza le
  // chiavi del gestionale non si puo' dire di piu': non si sa se da noi quei
  // carichi ci sono, quindi non si accusa nessuno di non averli registrati.
  verifica('dicendo che in un consuntivo del mese vanno chiarite', /vanno chiarite col fornitore prima di pagarle/.test(testo), testo);
  verifica('senza le chiavi del gestionale non si distingue di piu', c.date_sbagliate_quante === 0
    && c.arretrati_da_registrare === 0 && c.altri_mesi_quante === 0 && c.registro_di_piu_mesi === false, J({ s: c.date_sbagliate_quante, a: c.arretrati_da_registrare, m: c.altri_mesi_quante }));
}
{
  // Una riga senza data non si sa di che mese sia: resta nel confronto, perche'
  // buttarla fuori sarebbe peggio che confrontarla.
  const righe = [{ numero_fir: 'AAAAA000003AA', kg: 1000, giorno: '' }];
  const c = confrontaConsuntivo(righe, [], { tolleranza_kg: 1, anno: 2026, mese: 8 });
  verifica('senza data si confronta comunque', c.fuori_periodo === 0 && c.solo_consuntivo === 1, J(c));
}
{
  // Senza anno e mese non si filtra niente: il confronto resta quello di prima.
  const righe = [{ numero_fir: 'AAAAA000004AA', kg: 1000, giorno: '2026-03-01' }];
  const c = confrontaConsuntivo(righe, [], { tolleranza_kg: 1 });
  verifica('senza periodo non si filtra', c.fuori_periodo === 0 && c.solo_consuntivo === 1, J(c));
}

console.log('LE RIGHE DI TOTALE SI SEGNALANO, NON SI CANCELLANO');
{
  // I carichi veri di questo fornitore stanno fra 3.400 e 4.500 kg; il report ne
  // aveva letti due da 35.620 e 89.180, che sommati fanno il totale del mese.
  const movimenti = [
    { numero_fir: 'RTXZV001717KH', id_ordine: 'ET26125844', peso_effettivo: 3700 },
    { numero_fir: 'RTXZV001718KR', id_ordine: 'ET26112026', peso_effettivo: 4460 },
  ];
  const righe = [
    { numero_fir: 'RTXZV001717KH', kg: 3700 },
    { numero_fir: 'RTXZV001772FZ', kg: 35620 },
    { numero_fir: 'RTXZV001845CB', kg: 89180 },
  ];
  const paiono = righeCheParonoTotali(righe, movimenti);
  verifica('le due righe grosse si segnalano', paiono.length === 2, J(paiono));
  verifica('e si dice qual e il nostro carico piu pesante', paiono[0].massimo_nostro === 4460, J(paiono[0]));
  verifica('il carico vero non si segnala', !paiono.some(p => /001717/.test(p.chiave)), J(paiono));
  // Non si cancellano: su un documento che autorizza una fattura non si butta
  // via niente in silenzio.
  verifica('le righe restano tutte', righe.length === 3);
  verifica('senza nostri movimenti non si giudica', righeCheParonoTotali(righe, []).length === 0);
}

console.log('IL FILE DI UN ALTRO MESE SI DICE SUBITO');
{
  // Successo davvero: "LOG&PNEUM - settembre2026.xlsx" caricato nel consuntivo di
  // agosto. Venti difformita' al posto di una riga.
  const a = periodoSospetto({ nomeFile: 'LOG&PNEUM - settembre2026.xlsx', righe: [], anno: 2026, mese: 8 });
  verifica('il nome del file lo tradisce', a && a.some(x => /nel nome c'è settembre/.test(x)), J(a));
  verifica('e si dice che le difformita non vogliono dire niente', a.some(x => /non vuol dire niente/.test(x)), J(a));
  verifica('col mese giusto non si dice niente', periodoSospetto({ nomeFile: 'LOG&PNEUM - settembre2026.xlsx', righe: [], anno: 2026, mese: 9 }) === null);
  verifica('e senza nome di mese nemmeno', periodoSospetto({ nomeFile: 'consuntivo.xlsx', righe: [], anno: 2026, mese: 8 }) === null);
}
{
  const righe = [{ giorno: '2026-09-03' }, { giorno: '2026-09-11' }, { giorno: '2026-09-28' }];
  const a = periodoSospetto({ nomeFile: 'consuntivo.xlsx', righe, anno: 2026, mese: 8 });
  verifica('le date delle righe lo tradiscono', a && a.some(x => /Nessuna delle 3 righe datate/.test(x)), J(a));
  verifica('e dicono la piu vecchia', a.some(x => /03\/09\/2026/.test(x)), J(a));
  const giuste = periodoSospetto({ nomeFile: 'consuntivo.xlsx', righe, anno: 2026, mese: 9 });
  verifica('nel mese giusto tacciono', giuste === null, J(giuste));
  const meta = periodoSospetto({ nomeFile: 'x.xlsx', righe: [{ giorno: '2026-08-30' }, { giorno: '2026-09-01' }, { giorno: '2026-09-02' }, { giorno: '2026-09-03' }], anno: 2026, mese: 8 });
  verifica('poche dentro e molte fuori: si invita a controllare', meta && meta.some(x => /Solo 1 righe su 4/.test(x)), J(meta));
}

// === I FORMATI VERI DEI FORNITORI (75 file, 2026) ===
//
// Studiati il 01/10/2026 sulla cartella RETE/FATTURAZIONE: ogni fornitore
// intitola le colonne a modo suo, e un vocabolario di parole non bastera' mai.
// Quello che non cambia e' la FORMA dei valori.
console.log('LE INTESTAZIONI PROPONGONO, I VALORI DECIDONO');
{
  // GATIM e TRS: la colonna del formulario si chiama "Num.Fiscale (Numerazione
  // Fiscale)" e accanto c'e' "Data Doc. (Data Documento)". La vecchia regola del
  // formulario cercava la parola "documento" e prendeva LA DATA: nove file di
  // aprile, maggio, giugno e luglio leggevano una data al posto del formulario.
  const celle = [
    ['Data Reg. (Data Registrazione)', 'Data Doc. (Data Documento)', 'Num.Fiscale (Numerazione Fiscale)', 'P.Netto (Peso Netto Rifiuto in Kg)'],
    ['2026-05-07', '2026-05-06', 'HTQKS000785VB', 4590],
    ['2026-05-08', '2026-05-06', 'HTQKS000788LC', 4650],
  ];
  const col = colonneDaIntestazioni(celle[0]);
  verifica('"Data Documento" e una DATA, non un formulario', col.giorno && /^Data/.test(col.giorno.testo), J(col.giorno));
  verifica('il formulario e "Num.Fiscale"', col.numero_fir && /Num\.Fiscale/.test(col.numero_fir.testo), J(col.numero_fir));
  verifica('e il peso e "P.Netto"', col.kg && /P\.Netto/.test(col.kg.testo), J(col.kg));
  const lette = leggiRigheConsuntivo([{ nome: 'Foglio1', celle }]);
  verifica('si leggono i due carichi coi formulari veri', lette.righe.length === 2
    && lette.righe[0].numero_fir === 'HTQKS000785VB' && lette.righe[1].kg === 4650, J(lette.righe));
  verifica("e l'intestazione si e trovata", !lette.note.some(n => /non ho trovato la riga delle intestazioni/.test(n)), J(lette.note));
}
{
  // Il principio: se l'intestazione dice una cosa e i valori un'altra, vincono i
  // valori. Serve per i fornitori futuri, che chiameranno le colonne come vogliono.
  const celle = [
    ['Documento', 'Codice', 'Peso'],
    ['12/08/2026', 'RTXZV001718KR', 3540],
    ['13/08/2026', 'RTXZV001735JM', 3660],
    ['14/08/2026', 'RTXZV001743PL', 3840],
  ];
  const lette = leggiRigheConsuntivo([{ nome: 'X', celle }]);
  verifica('si usa la colonna che ha davvero i formulari', lette.righe.length === 3
    && lette.righe.every(r => /^RTXZV/.test(r.numero_fir)), J(lette.righe.map(r => r.numero_fir)));
  verifica('e si dice che si e cambiata idea', lette.note.some(n => /ho usato quella/.test(n)), J(lette.note));
}

console.log('LE TARIFFE IN FONDO AL FOGLIO NON SONO FORMULARI');
{
  // Il caso che ha fatto esplodere il consuntivo di LOGISTICA & PNEUMATICI: sotto
  // le righe c'e' il riquadro dei costi per zona, con le tariffe al chilo 0,068 -
  // 0,071 - 0,072. Normalizzate diventavano "0068", "0071", "0072" e uscivano
  // come tre formulari che il fornitore ci fatturava.
  verifica('una tariffa non e un formulario', chiaveFir(0.068) === '' && chiaveFir('0,071') === '' && chiaveFir('0.072') === '');
  verifica('un formulario vero lo e', chiaveFir('RTXZV001718KR') === 'RTXZV001718KR');
  verifica('e anche scritto spaziato', chiaveFir('RG YTR-0226') === 'RGYTR0226');
  verifica('una sigla senza cifre no', chiaveFir('TOTALE') === '' && chiaveFir('NAPPI') === '');
  verifica('un formulario tutto cifre deve essere lungo', chiaveFir('12345678') === '12345678' && chiaveFir('1234') === '');
}
{
  // Il foglio di LOGISTICA & PNEUMATICI di agosto 2026, ridotto all'osso: le
  // righe, l'etichetta di mezzo, e il riquadro dei costi per zona.
  const celle = [
    ['Ragione Sociale Produttore', "Pr (Provincia Unita' Locale Produttore)", 'Data Doc. (Data Documento)', 'Num.Fiscale (Numerazione Fiscale)', 'Rif.Docum. (Riferimento Documento)', 'P.Netto'],
    ['C GOMME SRL', 'NA', '2026-08-03', 'RTXZV001718KR', 'ET26112026', 3540],
    ['CORSO PNEUS SRLS', 'NA', '2026-08-03', 'RTXZV001735JM', 'ET26127995', 3660],
    [null, 'NAPPI', null, null, null, null],
    [],
    [null, null, null, 'ZONA DI TRASPORTO', 'KG TOTALI', 'TARIFFA AL KG', 'IMPONIBILE', 'TOTALE IVATO'],
    [null, null, null, 'NAPOLI/SALERNO', 30860, 0.068, 2098.48, 2560.1456],
    [null, null, null, 'AVELLINO', 0, 0.071, 0, 0],
    [null, null, null, 'CASERTA', 14760, 0.072, 1062.72, 1296.5184],
    [null, null, null, 'TOTALI', 45620, null, 3161.2, 3856.66],
  ];
  const lette = leggiRigheConsuntivo([{ nome: 'Foglio1', celle }]);
  const chiavi = lette.righe.map(r => r.numero_fir);
  verifica('solo i due carichi veri', lette.righe.length === 2, J(chiavi));
  verifica('le tariffe non sono diventate formulari', !chiavi.some(k => /^0,?0[67]/.test(k)), J(chiavi));
  verifica("l'etichetta NAPPI non e diventata un carico", !chiavi.includes('NAPPI'), J(chiavi));
  verifica("l'intestazione della provincia nemmeno", !chiavi.some(k => /PROVINCIA/i.test(k)), J(chiavi));

  // E l'imponibile dichiarato dal fornitore si legge: era proprio il numero che
  // il gestionale diceva di non poter controllare.
  const tot = importoTotaleDalFoglio(celle);
  verifica("l'imponibile si legge dalla riga dei totali", tot && tot.importo === 3161.2, J(tot));
  verifica('e si dice da quale colonna', tot.colonna === 'IMPONIBILE', J(tot));
  verifica('non si prende il totale IVATO', tot.importo !== 3856.66);
  verifica('e arriva anche da leggiRigheConsuntivo', lette.importo_totale && lette.importo_totale.importo === 3161.2, J(lette.importo_totale));
}
{
  // Senza riquadro dei costi non si inventa niente.
  const celle = [
    ['N. Formulario', 'Kg'],
    ['RTXZV001718KR', 3540],
  ];
  verifica('senza totali, nessun importo', importoTotaleDalFoglio(celle) === null);
  verifica('e il verdetto lo dira', leggiRigheConsuntivo([{ nome: 'X', celle }]).importo_totale === null);
}

console.log('IL CANALE DI UNA RIGA LO DICE LA CLASSE');
{
  // Regola dell'utente (01/10/2026): classe 9 = autodemolizione = ACI, le altre
  // sono rete. Verificata su tutti gli archivi: TERMINATI RETE non ha mai la 9,
  // TERMINATI ACI non ha mai altro. Nei fogli dei fornitori la classe e' spesso
  // un "9" secco, che eAci da sola non riconoscerebbe.
  for (const v of ['9', '.class9', '9 - PFU Autodemolizione', 'PFU Autodemolizione', '09']) {
    verifica(`"${v}" e ACI`, canaleDaClasse(v) === 'ACI', canaleDaClasse(v));
  }
  for (const v of ['P', 'M', 'G1', 'G2', '1', '2', '3', '4', '.class1', '.class4']) {
    verifica(`"${v}" e rete`, canaleDaClasse(v) === 'RETE', canaleDaClasse(v));
  }
  // Vuoto non vuol dire rete: vuol dire che non si sa, ed e' diverso.
  for (const v of ['PLASMIX FINE', '0', '', 'CLASSE', 'IMPONIBILE']) {
    verifica(`"${v}" non dice niente`, canaleDaClasse(v) === '', canaleDaClasse(v));
  }
}

console.log('IL CANALE: PRIMA IL MOVIMENTO, POI LA CLASSE, POI IL NOME DEL FILE');
{
  // 1. Il movimento abbinato e' la fonte certa: formulari e ordini non si
  //    ripetono fra i canali (zero numeri in comune fra 2.971 movimenti di rete
  //    e 45 ACI).
  const mov = { classe: 'P', __archivio: 'PrimariaAci' };
  verifica('il movimento vince su tutto', canaleDellaRiga({ classe: '9' }, mov, 'ACI.xlsx').canale === 'ACI');
  verifica('e si dice da dove viene', canaleDellaRiga({ classe: '9' }, mov, '').come === 'movimento');
  // 2. Senza movimento, la classe della riga.
  const daClasse = canaleDellaRiga({ classe: '9' }, null, 'GOMMISTI.xlsx');
  verifica('senza movimento vale la classe', daClasse.canale === 'ACI' && daClasse.come === 'classe', J(daClasse));
  // 3. Senza nemmeno la classe, il nome del file: GATIM manda due file separati.
  const daNome = canaleDellaRiga({ classe: '' }, null, 'GATIM - Gennaio circuito ACI.xlsx');
  verifica('poi il nome del file', daNome.canale === 'ACI' && daNome.come === 'nome_file', J(daNome));
  verifica('"circuito gommisti" non e ACI', canaleDellaRiga({ classe: '' }, null, 'GATIM - Gennaio circuito gommisti.xlsx').canale === '');
  verifica('e senza indizi non si inventa', canaleDellaRiga({ classe: '' }, null, 'consuntivo.xlsx').canale === '');
}

console.log('UNA RIGA DI UN ALTRO CANALE NON E\' UNA DIFFORMITA\'');
{
  // Il consuntivo di rete di un fornitore che nello stesso foglio mette anche
  // una riga ACI. Prima quella riga usciva come "ce lo fattura e noi non
  // l'abbiamo": un'accusa a un documento corretto.
  const movimenti = [{ numero_fir: 'RTXZV001718KR', id_ordine: 'ET26112026', peso_effettivo: 3540 }];
  const righe = [
    { numero_fir: 'RTXZV001718KR', kg: 3540, classe: 'P' },
    { numero_fir: 'BSDCL001462BJ', kg: 2100, classe: '9' },
  ];
  const c = confrontaConsuntivo(righe, movimenti, { tolleranza_kg: 1, canale: 'RETE' });
  verifica('la riga di rete quadra', c.uguali === 1, J(c.voci));
  verifica('quella ACI non e fra le difformita', c.solo_consuntivo === 0, J(c.voci));
  verifica('sta nel suo riquadro', c.altro_canale === 1 && c.kg_altro_canale === 2100, J(c));
  verifica('e si dice quale canale', c.canali_altrui.join() === 'ACI', J(c.canali_altrui));
  const voce = c.voci.find(v => v.esito === 'altro_canale');
  verifica('con la provenienza del giudizio', voce.canale_riga === 'ACI' && voce.canale_da === 'classe', J(voce));
  // Il testo lo dice SEMPRE, anche se il resto quadra: altrimenti quelle righe
  // non le controllerebbe nessuno.
  const testo = testoEsitoConsuntivo(c, esitoConsuntivo({ confronto: c, costo: null }));
  verifica('il testo invita ad aprire l altro canale', /Apri anche il consuntivo di ACI/.test(testo), testo);
  verifica('e dice che non e una difformita', /non sono una difformità|non è una difformità/.test(testo), testo);
}
{
  // Senza canale indicato non si marca niente: il confronto resta quello di prima.
  const movimenti = [];
  const righe = [{ numero_fir: 'BSDCL001462BJ', kg: 2100, classe: '9' }];
  const c = confrontaConsuntivo(righe, movimenti, { tolleranza_kg: 1 });
  verifica('senza canale la riga resta una difformita', c.solo_consuntivo === 1 && c.altro_canale === 0, J(c.voci));
}
{
  // Stesso canale: la riga e' una difformita' vera e tale resta.
  const righe = [{ numero_fir: 'RTXZV009999ZZ', kg: 3000, classe: 'P' }];
  const c = confrontaConsuntivo(righe, [], { tolleranza_kg: 1, canale: 'RETE' });
  verifica('una riga di rete che non abbiamo resta una difformita', c.solo_consuntivo === 1 && c.altro_canale === 0, J(c.voci));
}

// === UNA RIGA DI UN ALTRO MESE CHE NEL GESTIONALE NON C'E' ===
//
// La stessa cosa che il 01/10/2026 e' costata un richiamo in ufficio sul report
// settimanale. Nel consuntivo di settembre di NAPPI SUD c'era un carico del 13
// luglio, senza numero d'ordine: senza questo controllo si metteva da parte in
// silenzio come "riga di un altro mese", che e' vero e non basta.
console.log('\nUN CARICO DI UN ALTRO MESE CHE NEL GESTIONALE NON RISULTA');
{
  const archivi = {
    primarieRete: [{ numero_fir: 'RGYTR027030CR', id_ordine: 'ET26134560' }],
    primarieAci: [], secondarie: [], extraRaccolta: [{ numero_fir: 'XRIF0001', id_ordine: '' }],
  };
  const noti = chiaviDelGestionale(archivi);
  verifica('le chiavi del gestionale prendono formulari e ordini di ogni archivio e stato',
    noti.has('FIR:RGYTR027030CR') && noti.has('ORD:ET26134560') && noti.size === 3, J([...noti]));

  const righe = [
    // di settembre e nostra: si confronta normalmente
    { numero_fir: 'BSDCL001000AA', kg: 3000, giorno: '2026-09-10' },
    // di agosto ma registrata: solo di un altro mese, non si dice niente
    { numero_fir: 'RGYTR027030CR', kg: 1680, giorno: '2026-08-31' },
    // di luglio e mai registrata: e' questa
    { numero_fir: 'RGYTR027595LQ', kg: 800, giorno: '2026-07-13', id_ordine: 'ET' },
  ];
  const movimenti = [{ numero_fir: 'BSDCL001000AA', id_ordine: 'ET26150000', peso_effettivo: 3000 }];
  const c = confrontaConsuntivo(righe, movimenti, { tolleranza_kg: 1, anno: 2026, mese: 9, formulari_noti: noti });
  verifica('le due righe di altri mesi restano fuori dal confronto', c.fuori_periodo === 2 && c.kg_fuori_periodo === 2480, J({ f: c.fuori_periodo, kg: c.kg_fuori_periodo }));
  verifica('il mese quadra lo stesso: non sono chili di questo mese', c.quadra === true && c.uguali === 1, J({ q: c.quadra, u: c.uguali }));
  verifica('ma quella mai registrata si dice, una sola', c.arretrati_da_registrare === 1 && c.kg_arretrati === 800
    && c.arretrati[0].numero_fir === 'RGYTR027595LQ' && c.arretrati[0].giorno === '2026-07-13', J(c.arretrati));
  // 13/07/2026 e' un lunedi': dieci giorni utili, domenica 19 fuori, termine il 24.
  verifica('col suo termine di registrazione', c.arretrati[0].termine && c.arretrati[0].termine.scadenza === '2026-07-24'
    && c.arretrati[0].termine.partenza_da === 'report_arrivo', J(c.arretrati[0].termine));
  const avviso = avvisoArretrati(c);
  verifica('e l\'avviso lo scrive in italiano, col termine e senza niente che invecchi',
    /Un carico di un altro mese compare in questo consuntivo e nel gestionale non risulta/.test(avviso)
    && /RGYTR027595LQ del 13\/07\/2026, 800 kg \(termine di registrazione: 24\/07\/2026\)/.test(avviso)
    && /dieci giorni|10 giorni/.test(avviso) && !/scaduto da/.test(avviso), avviso);

  // Senza le chiavi del gestionale il controllo non si fa: meglio niente che
  // dire "mai registrato" di un carico che non si e' potuto cercare.
  const senza = confrontaConsuntivo(righe, movimenti, { tolleranza_kg: 1, anno: 2026, mese: 9 });
  verifica('senza le chiavi non si accusa nessuno', senza.arretrati_da_registrare === 0 && senza.fuori_periodo === 2, J(senza.arretrati));
  verifica('e senza arretrati l\'avviso e\' vuoto', avvisoArretrati(senza) === '' && avvisoArretrati(null) === '');
}
// === LA DATA DI UN MESE CHE NON C'ENTRA E' UN ERRORE ===
//
// Parole dell'utente (01/10/2026): «non e' concepibile scrivere una data di
// registrazione formulario di verifica del mese, indipendentemente dalla
// settimana, con un mese che non c'entra niente: deve essere evidenziato come
// errore». L'errore di NAPPI era di aver scritto luglio su un carico di
// settembre. Le tre cose che prima sembravano la stessa:
//   a) il carico da noi si conclude NEL mese: la data e' sbagliata, e la riga
//      deve restare nel confronto o i suoi chili mancano;
//   b) da noi non risulta per niente: mai registrato, col termine che corre;
//   c) da noi si conclude davvero in un altro mese: va nel consuntivo di quel
//      mese, e se quel mese e' fatturato si rischia di pagarlo due volte.
console.log('\nUNA DATA DI UN ALTRO MESE SU UN CARICO DI QUESTO MESE');
{
  const mov = (fir, ordine, giorno, kg) => ({ numero_fir: fir, id_ordine: ordine, stato: 'terminato', peso_effettivo: kg, trasporto_finito_il: `${giorno}T09:00:00Z` });
  const archivi = {
    primarieRete: [
      mov('BSDCL001000AA', 'ET26150000', '2026-09-10', 3000),
      // il carico che NAPPI ha scritto 13 luglio: da noi e' del 29 settembre
      mov('RGYTR027595LQ', 'ET26150001', '2026-09-29', 800),
      // questo invece e' davvero di agosto
      mov('RGYTR027030CR', 'ET26134560', '2026-08-31', 1680),
    ],
    primarieAci: [], secondarie: [], extraRaccolta: [],
  };
  const noti = chiaviDelGestionale(archivi);
  verifica('le chiavi portano anche le date dei nostri movimenti', noti.get('FIR:RGYTR027595LQ').giorni[0] === '2026-09-29'
    && noti.get('FIR:RGYTR027030CR').giorni[0] === '2026-08-31', J([...noti]));

  const righe = [
    { numero_fir: 'BSDCL001000AA', kg: 3000, giorno: '2026-09-10' },
    { numero_fir: 'RGYTR027595LQ', kg: 800, giorno: '2026-07-13', id_ordine: 'ET' },  // data sbagliata
    { numero_fir: 'RGYTR027030CR', kg: 1680, giorno: '2026-08-31' },                   // davvero di agosto
    { numero_fir: 'HTQKS009999ZZ', kg: 500, giorno: '2026-07-20' },                    // mai registrato
  ];
  const movimenti = [
    { numero_fir: 'BSDCL001000AA', id_ordine: 'ET26150000', peso_effettivo: 3000 },
    { numero_fir: 'RGYTR027595LQ', id_ordine: 'ET26150001', peso_effettivo: 800 },
  ];
  const c = confrontaConsuntivo(righe, movimenti, { tolleranza_kg: 1, anno: 2026, mese: 9, formulari_noti: noti });

  verifica('la data sbagliata si segnala, una sola', c.date_sbagliate_quante === 1
    && c.date_sbagliate[0].numero_fir === 'RGYTR027595LQ' && c.date_sbagliate[0].giorno === '2026-07-13'
    && c.date_sbagliate[0].nostro_giorno === '2026-09-29', J(c.date_sbagliate));
  verifica('e la sua riga RESTA nel confronto, coi suoi chili', c.uguali === 2 && c.totale_consuntivo_kg === 3800
    && c.solo_gestionale === 0, J({ u: c.uguali, kg: c.totale_consuntivo_kg, sg: c.solo_gestionale }));
  verifica('la riga davvero di agosto resta fuori e si dice a parte', c.altri_mesi_quante === 1
    && c.altri_mesi[0].numero_fir === 'RGYTR027030CR' && c.altri_mesi[0].nostro_giorno === '2026-08-31', J(c.altri_mesi));
  verifica('quella mai registrata resta fra gli arretrati', c.arretrati_da_registrare === 1
    && c.arretrati[0].numero_fir === 'HTQKS009999ZZ' && c.arretrati[0].termine.scadenza === '2026-07-31', J(c.arretrati));
  verifica('fuori dal confronto ce ne restano due, non tre', c.fuori_periodo === 2 && c.kg_fuori_periodo === 2180, J({ f: c.fuori_periodo, kg: c.kg_fuori_periodo }));
  verifica('tre mesi non sono un registro', c.registro_di_piu_mesi === false && c.mesi_nel_file.length === 3, J(c.mesi_nel_file));

  const avvisi = avvisiDate(c);
  verifica('l\'avviso della data sbagliata viene per primo e dice i due giorni',
    /^DATA SBAGLIATA su un carico/.test(avvisi[0]) && /scrive 13\/07\/2026, da noi il trasporto si conclude il 29\/09\/2026/.test(avvisi[0])
    && /va corretta nel file del fornitore/.test(avvisi[0]), avvisi[0]);
  verifica('poi quello del carico mai registrato', /nel gestionale non risulta/.test(avvisi[1]) && /HTQKS009999ZZ/.test(avvisi[1]), avvisi[1]);
  verifica('poi la riga dell\'altro mese, col rischio di pagarla due volte',
    /appartiene a un altro mese/.test(avvisi[2]) && /non pagarle due volte/.test(avvisi[2]), avvisi[2]);

  // Il riquadro non puo' restare verde con scritto dentro che c'e' un errore.
  const v = esitoConsuntivo({ confronto: c, costo: { trovato: true, tonnellate: 3.8, importo: 100 }, importo_consuntivo: 100 });
  verifica('il verdetto NON e\' verde: una data sbagliata e\' un errore', v.quadra_quantita === true && v.quadra_tutto === false, J({ q: v.quadra_quantita, t: v.quadra_tutto }));
  const testo = testoEsitoConsuntivo(c, v);
  verifica('e il testo lo dice: scritto 13/07 invece di 29/09', /scritto 13\/07\/2026 invece di 29\/09\/2026/.test(testo)
    && /errore del file del fornitore/.test(testo), testo);
  verifica('e non chiama "non una difformità" le righe di un altro mese di un consuntivo del mese',
    !/non sono una difformità. Succede con i registri/.test(testo) && /non pagarle due volte/.test(testo), testo);
}
{
  // IL REGISTRO DELL'ANNO E' UN'ALTRA COSA. IRIGOM manda tutti i mesi: quelle
  // righe sono la natura del documento, non un errore, e il verdetto resta verde.
  const righe = [];
  for (let m = 1; m <= 12; m++) righe.push({ numero_fir: `BSDCL00100${m}AA`, kg: 1000, giorno: `2026-${String(m).padStart(2, '0')}-10` });
  const movimenti = [{ numero_fir: 'BSDCL001006AA', id_ordine: 'ET1', peso_effettivo: 1000 }];
  const archivi = { primarieRete: righe.map((r, i) => ({ numero_fir: r.numero_fir, id_ordine: `ET${i}`, stato: 'terminato', peso_effettivo: 1000, trasporto_finito_il: `${r.giorno}T09:00:00Z` })), primarieAci: [], secondarie: [], extraRaccolta: [] };
  const c = confrontaConsuntivo(righe, movimenti, { tolleranza_kg: 1, anno: 2026, mese: 6, formulari_noti: chiaviDelGestionale(archivi) });
  verifica('dodici mesi sono un registro', c.registro_di_piu_mesi === true && c.fuori_periodo === 11 && c.altri_mesi_quante === 11, J({ r: c.registro_di_piu_mesi, f: c.fuori_periodo }));
  verifica('nessuna data sbagliata e nessun arretrato', c.date_sbagliate_quante === 0 && c.arretrati_da_registrare === 0);
  verifica('e il registro non toglie il verde', esitoConsuntivo({ confronto: c, costo: { trovato: true, tonnellate: 1, importo: 50 }, importo_consuntivo: 50 }).quadra_tutto === true);
  verifica('l\'avviso dice che e\' un registro, non un errore', /e\' un registro, non il consuntivo di un mese solo/.test(avvisiDate(c).join(' ')), J(avvisiDate(c)));
}
{
  // "Blocco/Serie" e' come ECOLOGICAL SYSTEMS chiama il formulario.
  const col = colonneDaIntestazioni(['N.', 'Blocco/Serie', 'Tipo', 'Produttore', 'Peso']);
  verifica('la colonna "Blocco/Serie" e\' il formulario', col.numero_fir && col.numero_fir.j === 1 && col.kg && col.kg.j === 4, J(col));
  // Ma "formulario" scritto per nome vince sempre su "blocco".
  const col2 = colonneDaIntestazioni(['Blocco/Serie', 'Num. di formulario', 'Peso netto']);
  verifica('e "formulario" scritto per nome vince su "blocco"', col2.numero_fir.j === 1, J(col2));
}

// === UNA STAMPA INCOLLATA IN EXCEL (ECORECUPERI) ===
//
// Non e' un foglio di calcolo: ogni riga e' una stringa sola con le colonne
// allineate a spazi, il formulario e la data dentro la stringa del produttore e
// il peso su un'altra riga del blocco. Qui si prova che il peso viene dal blocco
// giusto e che quando non c'e' non si prende da un'altra riga: e' la regola che
// ha retto tutto il resto del lettore.
console.log('\nUNA STAMPA INCOLLATA IN EXCEL');
const STAMPA = [
  ['Elenco Movimenti', '', '', 'Pagina           1'],
  [''],
  ['Codice       Produttore                      Codice     Smaltitore / Trasportatore        Data Reg.      C.E.R.'],
  ['002453                                       000156     TECNOGUM S.R.L.                        10.120'],
  ['900000              ECORECUPERI SRL'],
  ['Data D. / Nr.doc                             Peso (Kg)'],
  ['MELENCHI S.R.L.                              LQQDP001425TP      01-09-2026      160103'],
  ['002453                                       000156     TECNOGUM S.R.L.                           820'],
  ['900000              ECORECUPERI SRL'],
  ['MELENCHI S.R.L.                              LQQDP001424GB      01-09-2026      160103'],
  ['002721                                       000156     TECNOGUM S.R.L.                         2.400'],
  ['900000              ECORECUPERI SRL'],
  ['GUIDA GOMME DI GUIDA VINCENZO                LQQDP001470KG      04-09-2026      160103'],
  [''],
  ['', '', 'Mov.', '', 'Colli', 'MC', 'Kg'],
  ['', 'Totali Gener.'],
];
{
  const s = righeDaStampa(STAMPA, 'Sheet1');
  verifica('legge i tre carichi della stampa', s && s.righe.length === 3, J(s && s.righe));
  verifica('e ogni peso viene dal suo blocco, non da quello accanto',
    s.righe[0].numero_fir === 'LQQDP001425TP' && s.righe[0].kg === 10120
    && s.righe[1].numero_fir === 'LQQDP001424GB' && s.righe[1].kg === 820
    && s.righe[2].numero_fir === 'LQQDP001470KG' && s.righe[2].kg === 2400, J(s.righe.map(r => [r.numero_fir, r.kg])));
  verifica('con la data e il produttore letti dalla stessa riga', s.righe[0].giorno === '2026-09-01'
    && s.righe[0].produttore === 'MELENCHI S.R.L.' && s.righe[2].giorno === '2026-09-04', J(s.righe[0]));
  verifica('il totale non diventa un carico, e l\'intestazione nemmeno', s.righe.every(r => r.kg > 0 && r.kg < 20000));
  verifica('e dice come ha letto', s.note.some(n => /e' una stampa incollata in Excel/.test(n)), J(s.note));
}
{
  // Al secondo carico si toglie la riga del peso: non deve prendere quello del
  // primo. Un peso di un altro carico e' esattamente il numero sbagliato con
  // l'aria di essere giusto.
  const senzaPeso = STAMPA.filter((r, i) => i !== 7);
  const s = righeDaStampa(senzaPeso, 'Sheet1');
  verifica('un carico senza il suo peso non si legge', s.righe.length === 2
    && !s.righe.some(r => r.numero_fir === 'LQQDP001424GB'), J(s.righe.map(r => [r.numero_fir, r.kg])));
  verifica('e non prende il peso del carico precedente', !s.righe.some(r => r.kg === 10120 && r.numero_fir !== 'LQQDP001425TP'), J(s.righe));
  verifica('lo dice, col numero del formulario', s.note.some(n => /non ha un peso riconoscibile/.test(n) && /LQQDP001424GB/.test(n)), J(s.note));
}
{
  verifica('un foglio che non e\' una stampa di movimenti torna null', righeDaStampa([['Data', 'FIR', 'Kg'], ['01/09/2026', 'LQQDP001425TP', 1000]], 'x') === null);
  verifica('e due soli carichi non bastano a chiamarla stampa', righeDaStampa(STAMPA.slice(0, 11), 'x') === null, J(righeDaStampa(STAMPA.slice(0, 11), 'x')));
  // Dentro il lettore vero: senza intestazioni, prima di arrendersi, prova la stampa.
  const lette = leggiRigheConsuntivo([{ nome: 'Sheet1', celle: STAMPA }]);
  verifica('leggiRigheConsuntivo la riconosce da sola', lette.righe.length === 3 && lette.scartate === 0
    && lette.colonne[0].colonne.kg === '(stampa: peso nella riga del codice sopra)', J({ r: lette.righe.length, c: lette.colonne }));
  verifica('e non dice piu\' "non riconosco la riga delle intestazioni"', !lette.note.some(n => /non riconosco la riga delle intestazioni/.test(n)), J(lette.note));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
