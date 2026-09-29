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
import { movimentiDelFornitore, confrontaConsuntivo, costoAttesoDallaPassiva, esitoConsuntivo, testoEsitoConsuntivo, chiaveRiga } from '../base44/shared/consuntivoFornitore.ts';

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

const luiInPiu = confrontaConsuntivo([{ numero_fir: 'FIRET1', kg: 5000 }, { numero_fir: 'FIRET2', kg: 3000 }, { numero_fir: 'FIRX', kg: 2000 }], suoi);
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

console.log('IL TESTO CHE SI LEGGE');
verifica('quando quadra lo dice in parole', /corrisponde ai nostri movimenti/.test(testoEsitoConsuntivo(tuttoBene, buono)));
verifica('e quando no, dice che cosa non torna',
  /non corrisponde/.test(testoEsitoConsuntivo(luiInPiu, esitoConsuntivo({ confronto: luiInPiu, costo })))
  && /che noi non abbiamo/.test(testoEsitoConsuntivo(luiInPiu, esitoConsuntivo({ confronto: luiInPiu, costo }))),
  testoEsitoConsuntivo(luiInPiu, esitoConsuntivo({ confronto: luiInPiu, costo })));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
