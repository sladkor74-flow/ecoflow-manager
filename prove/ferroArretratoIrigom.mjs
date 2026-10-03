// IL FERRO CHE IRIGOM LASCIA INDIETRO, E LA GIACENZA CHE DEVE TORNARE AD + AE.
//
// Regola dell'utente del 03/10/2026, sull'esempio di ottobre: a novembre si
// prepara ottobre, e dopo il caricamento «sul portale e quindi nel nostro
// gestionale la giacenza al 31 ottobre di irigom deve essere pari alla somma
// delle celle AD95+AE95», perche' a ottobre si dichiara anche il ferro uscito a
// settembre (cella X94), «che era gestito al di fuori del portale ma che adesso
// contribuisce al totale dei pfu». Settembre 2026 e' stato un mese di soli
// metalli: 99.300 kg di ferro usciti, nessuna nave, quindi nessuna terziaria a
// cui attaccarli e niente caricato a portale.
//
// Lo scenario di ottobre e' costruito a mano (i dati veri arrivano a novembre) e
// tenuto STRETTO sui 38.000 kg: con 158.000 kg di ferro da ripartire su 13
// dichiarazioni il limite del portale morde davvero, e se la ripartizione
// sbagliasse di poco la prova se ne accorgerebbe.
//
// Le due cose che questa prova difende, perche' sbagliarle costa due volte:
//   - l'arretrato NON si legge da metalli_kg della riga, che in un mese di soli
//     metalli vale tutta la colonna X mentre a portale non e' andato niente;
//   - un arretrato che si ripresenta il mese dopo si dichiarerebbe DUE VOLTE:
//     registrata la pratica di ottobre, a novembre deve tornare a zero.
// npm run prove
import { ferroArretrato, componiMese, mesiRecuperati, MESI, MAX_PER_DICHIARAZIONE_KG } from '../src/lib/praticaIrigom.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// ---------------------------------------------------------------------------
// Lo scenario: il foglio Cons. del 2026 e le pratiche dell'anno.

// La riga 95 del foglio Cons., cioe' ottobre: V, X, Y delle uscite e AD, AE
// delle giacenze. AD = cippato + SACI + PFU interi; Z (il CSS-C in giacenza) non
// resta a portale, e' end of waste.
const OTTOBRE = {
  mese: 'Ottobre',
  uscite_cippato_kg: 310000,  // V95: ciabattato uscito con la nave
  uscite_ferro_kg: 58700,     // X95: metalli ferrosi 19.12.02 usciti nel mese
  uscite_cssc_kg: 25000,      // Y95: CSS-C uscito in cementeria con DDT
  giacenza_cippato_kg: 198620,
  giacenza_saci_kg: 24100,
  giacenza_intero_kg: 42760,
  giacenza_totale_kg: 265480, // AD95
  giacenza_ferro_kg: 18240,   // AE95
  giacenza_cssc_kg: 25000,    // Z95: non resta a portale
};
const AD_PIU_AE = OTTOBRE.giacenza_totale_kg + OTTOBRE.giacenza_ferro_kg; // 283.720
const ARRETRATO_SETTEMBRE = 99300;

// La colonna X mese per mese. Novembre ha gia' delle uscite - si lavora a
// novembre - e non deve entrare nei conti di ottobre.
const FERRO_USCITO = {
  Gennaio: 84100, Febbraio: 71400, Marzo: 66820, Aprile: 89780, Maggio: 95240,
  Giugno: 78360, Luglio: 126160, Agosto: 82500, Settembre: ARRETRATO_SETTEMBRE,
  Ottobre: OTTOBRE.uscite_ferro_kg, Novembre: 41200, Dicembre: 0,
};
const mesi = MESI.map(m => (m === 'Ottobre' ? OTTOBRE : { mese: m, uscite_ferro_kg: FERRO_USCITO[m] }));

// Una pratica registrata: il ferro andato a portale sta in
// dati_json.materiali_portale.metalli_kg. metalli_kg della riga c'e' lo stesso,
// ed e' la trappola: in un mese di soli metalli vale tutta la colonna X.
const praticaRegistrata = (mese, metalliPortale) => ({
  anno: 2026, mese, stato: 'registrata', versione: 1, metalli_kg: FERRO_USCITO[mese],
  dati_json: JSON.stringify({ solo_metalli: false, materiali_portale: { cippato_kg: 0, metalli_kg: metalliPortale, cssc_kg: 0 } }),
});
// Un mese di soli metalli: la riga porta tutta la colonna X (regola del
// 03/10/2026), a portale non e' andato niente.
const praticaSoloMetalli = (mese) => ({
  anno: 2026, mese, stato: 'registrata', versione: 1, metalli_kg: FERRO_USCITO[mese],
  dati_json: JSON.stringify({ solo_metalli: true, materiali_portale: { cippato_kg: 0, metalli_kg: 0, cssc_kg: 0 } }),
});

// Le pratiche di Irigom si fanno nel gestionale da agosto 2026: agosto ha
// portato a portale tutto il suo ferro, settembre e' stato un mese di soli
// metalli. L'arretrato che arriva a ottobre e' tutto e solo quello di settembre;
// di gennaio-luglio il gestionale non sa cosa sia andato a portale, e quei mesi
// restano fuori dal saldo.
const PRATICHE = [
  praticaRegistrata('Agosto', FERRO_USCITO.Agosto),
  praticaSoloMetalli('Settembre'),
];
const PRIMA_DEL_GESTIONALE = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio'];

// I formulari del ferro di ottobre: la quota nostra deve fare X95 = 58.700.
const FERRO_OTTOBRE = [
  { riga: 4120, data: '2026-10-05', trasportatore: 'SMOCO', destinatario: 'TRS', formulario: 'CNDJM000401AB', kg: 24580, colore: 'FFC000', nota: '' },
  { riga: 4131, data: '2026-10-09', trasportatore: 'SMOCO', destinatario: 'TRS', formulario: 'CNDJM000402CD', kg: 18600, colore: 'FF66CC', nota: 'ECT: 12,34' },
  { riga: 4147, data: '2026-10-16', trasportatore: 'SMOCO', destinatario: 'TRS', formulario: 'CNDJM000403EF', kg: 34900, colore: 'FF66CC', nota: 'ECP:10,72 ECT:21,78 LM: 2,40' },
  { riga: 4158, data: '2026-10-20', trasportatore: 'SMOCO', destinatario: 'MMF', formulario: 'CNDJM000404GH', kg: 15200, colore: 'FFC000', nota: '' },
  { riga: 4166, data: '2026-10-27', trasportatore: 'SMOCO', destinatario: 'TRS', formulario: 'CNDJM000405IL', kg: 21300, colore: '92D050', nota: 'ecp: 18,4' },
];

// La nave di ottobre: dodici allegati VII SMOCO, 312.000 kg in tutto. Nessun
// sottoinsieme copre i 310.000 di ciabattato uscito, quindi si prendono tutti.
const ALLEGATI_OTTOBRE = [
  [41, 27340], [42, 25880], [43, 26420], [44, 25160], [45, 27900], [46, 26640],
  [47, 25520], [48, 26080], [49, 27120], [50, 25740], [51, 26300], [52, 21900],
].map(([numero, kg]) => ({ riga: 4200 + numero, data: '2026-10-29', numero, trasportatore: 'SMOCO', destinatario: 'AKCANSA', kg }));

// Un DDT di CSS-C, i 25.000 kg di solito, e dodici terziarie da aprire.
const DDT_OTTOBRE = [{ ddt: '318', data: '2026-10-21', kg: 25000 }];
const TER_OTTOBRE = Array.from({ length: 12 }, (_, i) => 'TER2619' + String(101 + i).padStart(4, '0'));

const PORTALE_FINE_OTTOBRE = AD_PIU_AE + OTTOBRE.uscite_cippato_kg + OTTOBRE.uscite_cssc_kg + OTTOBRE.uscite_ferro_kg + ARRETRATO_SETTEMBRE;

// ---------------------------------------------------------------------------

console.log('IL FERRO CHE UN MESE LASCIA INDIETRO');
const unMese = (mese, uscito) => [{ mese, uscite_ferro_kg: uscito }];
const soloMetalli = ferroArretrato(unMese('Settembre', 99300), [praticaSoloMetalli('Settembre')], { mese: 'Ottobre' });
verifica('un mese di soli metalli lascia indietro tutta la colonna X',
  soloMetalli.arretrato_kg === 99300 && soloMetalli.dettaglio[0].resta_kg === 99300 && soloMetalli.dettaglio[0].a_portale_kg === 0
  && soloMetalli.dettaglio[0].fonte === 'mese di soli metalli' && soloMetalli.mesi.join() === 'Settembre', JSON.stringify(soloMetalli));
// La trappola: metalli_kg della riga vale 99.300, materiali_portale 0. Se la
// prova passasse con arretrato 0 vorrebbe dire che si legge il campo sbagliato.
verifica('e l\'arretrato non si legge da metalli_kg della riga, che vale tutta la colonna X',
  soloMetalli.a_portale_kg === 0 && JSON.parse(praticaSoloMetalli('Settembre').dati_json).materiali_portale.metalli_kg === 0
  && praticaSoloMetalli('Settembre').metalli_kg === 99300, JSON.stringify(soloMetalli.dettaglio));

const conPratica = ferroArretrato(unMese('Agosto', 82500), [praticaRegistrata('Agosto', 62500)], { mese: 'Settembre' });
verifica('un mese con pratica registrata lascia indietro le uscite meno il ferro andato a portale',
  conPratica.arretrato_kg === 20000 && conPratica.dettaglio[0].fonte === 'dalla pratica', JSON.stringify(conPratica.dettaglio));
const quadra = ferroArretrato(unMese('Agosto', 82500), [praticaRegistrata('Agosto', 82500)], { mese: 'Settembre' });
verifica('un mese che ha portato a portale tutto il suo ferro non lascia niente',
  quadra.arretrato_kg === 0 && quadra.mesi.length === 0, JSON.stringify(quadra.dettaglio));

// Il saldo parte dal primo mese che il gestionale ha seguito: un buco DOPO
// quello e' un mese che non ha dichiarato niente a portale.
const dueMesi = (ferroAgosto, ferroSettembre) => [{ mese: 'Agosto', uscite_ferro_kg: ferroAgosto }, { mese: 'Settembre', uscite_ferro_kg: ferroSettembre }];
const conBuco = ferroArretrato(dueMesi(82500, 99300), [praticaRegistrata('Agosto', 82500)], { mese: 'Ottobre' });
verifica('un mese senza pratica, dopo il primo mese seguito, lascia indietro tutto',
  conBuco.arretrato_kg === 99300 && conBuco.dettaglio[1].fonte === 'senza pratica' && conBuco.dettaglio[1].resta_kg === 99300, JSON.stringify(conBuco.dettaglio));

// Una bozza non e' una dichiarazione: quel mese conta per intero nell'arretrato e
// si dice. Ci vuole un mese registrato prima, che faccia da ancora.
const dueRighe = (a, b) => [{ mese: 'Luglio', uscite_ferro_kg: a }, { mese: 'Agosto', uscite_ferro_kg: b }];
const daRegistrare = ferroArretrato(dueRighe(126160, 82500), [
  praticaRegistrata('Luglio', 126160),
  { ...praticaRegistrata('Agosto', 82500), stato: 'in_preparazione' },
], { mese: 'Settembre' });
verifica('una pratica preparata e non registrata non conta come portata a portale, e si dice che non si sa',
  daRegistrare.arretrato_kg === 82500 && daRegistrare.dettaglio[1].a_portale_kg === 0
  && daRegistrare.dettaglio[1].fonte === 'pratica da registrare' && daRegistrare.da_capire.join() === 'Agosto', JSON.stringify(daRegistrare));
verifica('un mese registrato non finisce fra quelli da capire', conPratica.da_capire.length === 0);
// Senza nessun mese registrato il saldo non parte: non si sa niente, e si dice
// che non si sa invece di dichiarare un numero.
const soloBozze = ferroArretrato(unMese('Agosto', 82500), [{ ...praticaRegistrata('Agosto', 82500), stato: 'in_preparazione' }], { mese: 'Settembre' });
verifica('senza nessuna pratica registrata il saldo non parte',
  soloBozze.arretrato_kg === 0 && soloBozze.dal_mese === '' && soloBozze.prima_del_gestionale.join() === 'Agosto', JSON.stringify(soloBozze));

// LE DUE TRAPPOLE DEL PULSANTE «SCARICA LA CARTELLA», che apre una bozza nuova
// accanto a quella registrata. Prima: il ferro di un mese registrato tornava
// arretrato e si dichiarava due volte; e una bozza su un mese vecchio spostava
// l'ancora indietro, tirando dentro al saldo tutti i mesi che il gestionale non
// ha seguito - a ottobre 2026 avrebbe proposto oltre 800 tonnellate di ferro.
const conBozzaSopra = ferroArretrato(unMese('Agosto', 82500), [
  praticaRegistrata('Agosto', 82500),
  { ...praticaRegistrata('Agosto', 0), stato: 'in_preparazione', versione: 2 },
], { mese: 'Settembre' });
verifica('una bozza aperta sopra un mese registrato non cancella quello che ha dichiarato',
  conBozzaSopra.arretrato_kg === 0 && conBozzaSopra.dettaglio[0].a_portale_kg === 82500
  && conBozzaSopra.dettaglio[0].fonte === 'dalla pratica', JSON.stringify(conBozzaSopra.dettaglio));
const bozzaVecchia = ferroArretrato(mesi, [...PRATICHE,
  { anno: 2026, mese: 'Gennaio', stato: 'in_preparazione', versione: 1, metalli_kg: 0, dati_json: '{}' },
], { mese: 'Ottobre' });
verifica('una bozza su un mese vecchio non sposta l\'ancora del saldo',
  bozzaVecchia.arretrato_kg === ARRETRATO_SETTEMBRE && bozzaVecchia.dal_mese === 'Agosto', JSON.stringify([bozzaVecchia.arretrato_kg, bozzaVecchia.dal_mese]));

// IL SALDO NON E' UNA SOMMA CON SEGNO. Un mese che recupera ferro venuto da
// fuori finestra lascerebbe una riga negativa che si mangia l'arretrato dei mesi
// dopo: il gestionale parte a ottobre, ottobre recupera i 99.300 di settembre
// (che e' fuori finestra), novembre di soli metalli ne lascia 41.200. Col saldo
// con segno veniva -58.100, portato a zero: dicembre dichiarava 41.200 kg in meno.
const fuori = ferroArretrato(
  [{ mese: 'Ottobre', uscite_ferro_kg: 58700 }, { mese: 'Novembre', uscite_ferro_kg: 41200 }],
  [praticaRegistrata('Ottobre', 158000), praticaSoloMetalli('Novembre')],
  { mese: 'Dicembre' });
verifica('un recupero da fuori finestra non si mangia l\'arretrato dei mesi dopo',
  fuori.arretrato_kg === 41200 && fuori.mesi.join() === 'Novembre' && fuori.fuori_finestra_kg === 99300, JSON.stringify(fuori));
// E un recupero paga i debiti piu' vecchi per primi, cosi' i mesi nominati sono
// quelli che devono ancora, e la somma dei chili fa esattamente l'arretrato.
const aMeta = ferroArretrato(
  [{ mese: 'Agosto', uscite_ferro_kg: 50000 }, { mese: 'Settembre', uscite_ferro_kg: 60000 }, { mese: 'Ottobre', uscite_ferro_kg: 10000 }],
  [praticaSoloMetalli('Agosto'), praticaSoloMetalli('Settembre'), praticaRegistrata('Ottobre', 80000)],
  { mese: 'Novembre' });
verifica('il recupero paga i debiti piu\' vecchi per primi',
  aMeta.arretrato_kg === 40000 && aMeta.mesi.join() === 'Settembre'
  && aMeta.componi[0].kg === 40000 && aMeta.fuori_finestra_kg === 0, JSON.stringify(aMeta));
verifica('i chili attribuiti ai mesi fanno esattamente l\'arretrato',
  aMeta.componi.reduce((s, c) => s + c.kg, 0) === aMeta.arretrato_kg);

const sostituita = ferroArretrato(unMese('Agosto', 82500), [
  { ...praticaRegistrata('Agosto', 82500), stato: 'sostituita', versione: 1 },
  { ...praticaRegistrata('Agosto', 62500), versione: 2 },
], { mese: 'Settembre' });
verifica('una pratica sostituita non si guarda e vince la versione piu\' alta',
  sostituita.arretrato_kg === 20000 && sostituita.dettaglio[0].a_portale_kg === 62500, JSON.stringify(sostituita.dettaglio));
const soloSostituita = ferroArretrato(dueMesi(82500, 99300), [
  praticaRegistrata('Agosto', 82500),
  { ...praticaRegistrata('Settembre', 99300), stato: 'sostituita' },
], { mese: 'Ottobre' });
verifica('se di un mese resta solo una pratica sostituita e\' come non averla',
  soloSostituita.arretrato_kg === 99300 && soloSostituita.dettaglio[1].fonte === 'senza pratica', JSON.stringify(soloSostituita.dettaglio));
const versioneAlta = ferroArretrato(unMese('Agosto', 82500), [
  { ...praticaRegistrata('Agosto', 70000), versione: 1 },
  { ...praticaRegistrata('Agosto', 82500), versione: 3 },
], { mese: 'Settembre' });
verifica('fra due registrate vale quella rifatta per ultima', versioneAlta.arretrato_kg === 0, JSON.stringify(versioneAlta.dettaglio));

const senzaDatiJson = ferroArretrato(unMese('Agosto', 82500), [{ anno: 2026, mese: 'Agosto', stato: 'registrata', versione: 1, metalli_kg: 82500 }], { mese: 'Settembre' });
verifica('una pratica vecchia senza dati_json ripiega sulla riga, e lo dice',
  senzaDatiJson.arretrato_kg === 0 && senzaDatiJson.dettaglio[0].fonte === 'dalla riga della pratica', JSON.stringify(senzaDatiJson.dettaglio));

const arrOttobre = ferroArretrato(mesi, PRATICHE, { mese: 'Ottobre' });
verifica('nell\'anno intero l\'arretrato di ottobre e\' tutto e solo il ferro di settembre',
  arrOttobre.arretrato_kg === ARRETRATO_SETTEMBRE && arrOttobre.mesi.join() === 'Settembre' && arrOttobre.da_capire.length === 0, JSON.stringify([arrOttobre.arretrato_kg, arrOttobre.mesi]));
verifica('e il conto e\' uscito meno andato a portale, mese per mese',
  arrOttobre.uscito_kg === 181800 && arrOttobre.a_portale_kg === 82500 && arrOttobre.dettaglio.length === 2, JSON.stringify([arrOttobre.uscito_kg, arrOttobre.a_portale_kg]));
verifica('i mesi dopo quello che si sta preparando non entrano mai nell\'arretrato',
  arrOttobre.dettaglio.every(r => MESI.indexOf(r.mese) < MESI.indexOf('Ottobre'))
  && !arrOttobre.dettaglio.some(r => r.mese === 'Ottobre' || r.mese === 'Novembre'), JSON.stringify(arrOttobre.dettaglio.map(r => r.mese)));
// I mesi prima della prima pratica non si contano: di quelli il gestionale non
// sa quanto sia arrivato a portale, e chiamarli arretrato vorrebbe dire
// dichiarare a ottobre sette mesi di ferro.
verifica('il saldo parte dal primo mese seguito dal gestionale, e i mesi di prima si dicono senza contarli',
  arrOttobre.dal_mese === 'Agosto' && arrOttobre.prima_del_gestionale.join() === PRIMA_DEL_GESTIONALE.join(), JSON.stringify([arrOttobre.dal_mese, arrOttobre.prima_del_gestionale]));
const maiSeguito = ferroArretrato(mesi, [], { mese: 'Ottobre' });
verifica('senza nessuna pratica non c\'e\' arretrato: quei mesi sono chiusi e stanno nella giacenza del portale',
  maiSeguito.arretrato_kg === 0 && maiSeguito.dal_mese === '' && maiSeguito.prima_del_gestionale.length === 9, JSON.stringify([maiSeguito.arretrato_kg, maiSeguito.prima_del_gestionale]));
const conZero = ferroArretrato(dueMesi(82500, 0), [praticaRegistrata('Agosto', 82500)], { mese: 'Ottobre' });
verifica('un mese senza uscite di ferro e senza pratica non compare nel dettaglio',
  conZero.dettaglio.length === 1 && conZero.dettaglio[0].mese === 'Agosto', JSON.stringify(conZero.dettaglio));
verifica('a gennaio non c\'e\' nessun mese prima', ferroArretrato(mesi, PRATICHE, { mese: 'Gennaio' }).arretrato_kg === 0);

console.log('OTTOBRE 2026: LA PRATICA CON L\'ARRETRATO DI SETTEMBRE');
const comune = { riga: OTTOBRE, ferro: FERRO_OTTOBRE, allegati: ALLEGATI_OTTOBRE, ddt: DDT_OTTOBRE, terziarie: TER_OTTOBRE, arretrato: arrOttobre };
const ott = componiMese({ ...comune, lettura: 'giacenza', portaleFineMeseKg: PORTALE_FINE_OTTOBRE });
verifica('niente blocca la pratica', ott.blocchi.length === 0, JSON.stringify(ott.blocchi));
verifica('i formulari del ferro fanno la colonna X: 58.700 kg',
  ott.ferro.quota_kg === OTTOBRE.uscite_ferro_kg && !ott.avvisi.some(a => /il registro va controllato/.test(a)), String(ott.ferro.quota_kg));
verifica('dodici allegati VII, dodici terziarie da aprire',
  ott.terziarie_da_aprire === 12 && ott.allegati.scelti.length === 12 && ott.allegati.coperto_kg === 312000 && ott.allegati.scarto_kg === 2000, JSON.stringify([ott.terziarie_da_aprire, ott.allegati.coperto_kg]));

console.log('LA GIACENZA A PORTALE E IL REGISTRO: DUE STRADE INDIPENDENTI PER LO STESSO TOTALE');
// La giacenza a portale a fine ottobre e' AD95 + AE95 + V + Y + X + 99.300: e'
// quello che il portale ha ancora addosso prima del caricamento. Partendo da
// li' e togliendo quello che deve restare (AD + AE) si deve ritrovare, al
// chilo, il totale che il registro calcola da solo: V + X + Y + arretrato.
verifica('la giacenza a portale di partenza e\' AD95 + AE95 + V + Y + X + 99.300',
  PORTALE_FINE_OTTOBRE === 776720 && ott.letture.giacenza.portale_fine_mese_kg === 776720, String(PORTALE_FINE_OTTOBRE));
verifica('dalla giacenza e dal registro esce lo stesso totale da caricare: 493.000 kg, scarto zero',
  ott.letture.giacenza.totale_kg === 493000 && ott.letture.registro.totale_kg === 493000 && ott.letture.scarto_kg === 0, JSON.stringify([ott.letture.giacenza.totale_kg, ott.letture.registro.totale_kg, ott.letture.scarto_kg]));
verifica('il registro e\' le uscite del mese piu\' l\'arretrato, e dice da che mese viene',
  ott.letture.registro.uscite_kg === 393700 && ott.letture.registro.arretrato_kg === ARRETRATO_SETTEMBRE
  && ott.letture.registro.mesi_arretrato.join() === 'Settembre' && ott.letture.usata === 'giacenza', JSON.stringify(ott.letture.registro));
verifica('dopo il caricamento a portale restano AD95 + AE95: 283.720 kg, differenza zero',
  ott.verifica.torna === true && ott.verifica.differenza_kg === 0 && ott.verifica.deve_restare_kg === AD_PIU_AE
  && ott.verifica.resta_a_portale_kg === AD_PIU_AE && ott.verifica.resta_dopo_kg === AD_PIU_AE, JSON.stringify(ott.verifica));
verifica('e non c\'e\' niente da spiegare sulla giacenza finale',
  !ott.avvisi.some(a => /resterebbero/.test(a)), JSON.stringify(ott.avvisi));
// Il confronto con le sole uscite resta, ed e' un'altra cosa: e' grande quanto
// l'arretrato, e senza quel numero lo scarto sembrerebbe un errore.
verifica('lo scarto contro le sole uscite del mese e\' esattamente l\'arretrato',
  ott.letture.scarto_uscite_kg === ARRETRATO_SETTEMBRE && ott.letture.uscite.totale_kg === 393700, String(ott.letture.scarto_uscite_kg));

console.log('LA CONTROPROVA: SENZA L\'ARRETRATO LA GIACENZA NON TORNA CON AD + AE');
const soloUscite = componiMese({ ...comune, lettura: 'uscite', portaleFineMeseKg: PORTALE_FINE_OTTOBRE });
verifica('con le sole uscite del mese si dichiarano 99.300 kg in meno',
  soloUscite.portale_kg === ott.portale_kg - ARRETRATO_SETTEMBRE && soloUscite.portale_kg === 393700, soloUscite.portale_kg + ' contro ' + ott.portale_kg);
verifica('e a portale resterebbero 99.300 kg di troppo: la giacenza non torna con AD + AE',
  soloUscite.verifica.torna === false && soloUscite.verifica.differenza_kg === ARRETRATO_SETTEMBRE, JSON.stringify(soloUscite.verifica));
verifica('la pratica lo dice, e nomina i chili e il mese che li ha lasciati',
  soloUscite.avvisi.some(a => /restano fuori 99\.300 kg usciti a settembre/.test(a) && /non torna con AD \+ AE/.test(a)), JSON.stringify(soloUscite.avvisi));

console.log('REGISTRATA OTTOBRE, A NOVEMBRE L\'ARRETRATO E\' ZERO: NIENTE DOPPIO CONTEGGIO');
// Un arretrato che si ripresenta ogni mese si dichiarerebbe due volte.
const ottobreRegistrata = {
  anno: 2026, mese: 'Ottobre', stato: 'registrata', versione: 1, metalli_kg: OTTOBRE.uscite_ferro_kg,
  dati_json: JSON.stringify({ solo_metalli: ott.solo_metalli, materiali_portale: ott.materiali_portale }),
};
verifica('la pratica registrata porta a portale il ferro ripartito, non quello uscito nel mese',
  JSON.parse(ottobreRegistrata.dati_json).materiali_portale.metalli_kg === ott.ferro.ripartito_kg
  && ott.ferro.ripartito_kg === 158000 && ottobreRegistrata.metalli_kg === 58700, JSON.stringify(ott.materiali_portale));
const arrNovembre = ferroArretrato(mesi, [...PRATICHE, ottobreRegistrata], { mese: 'Novembre' });
verifica('a novembre non resta piu\' niente da recuperare', arrNovembre.arretrato_kg === 0, JSON.stringify([arrNovembre.arretrato_kg, arrNovembre.uscito_kg, arrNovembre.a_portale_kg]));
const nov = componiMese({ riga: { mese: 'Novembre', uscite_ferro_kg: FERRO_USCITO.Novembre, giacenza_totale_kg: 120000, giacenza_ferro_kg: 41200 }, ferro: [{ destinatario: 'TRS', colore: 'FFC000', kg: 41200 }], lettura: 'uscite', arretrato: arrNovembre });
verifica('e la pratica di novembre non aggiunge niente al registro ne\' agli avvisi',
  nov.letture.registro.arretrato_kg === 0 && nov.letture.registro.totale_kg === nov.letture.uscite.totale_kg
  && !nov.avvisi.some(a => /rimasti indietro/.test(a) || /restano fuori/.test(a)), JSON.stringify(nov.avvisi));
verifica('senza l\'arretrato, e senza giacenza, si ripiega sulle uscite', nov.letture.usata === 'uscite' && nov.letture.giacenza === null && nov.verifica === null);
// Il recupero di ottobre ha pagato il debito di settembre, quindi a novembre
// settembre non si nomina piu' da nessuna parte: ne' nella lista dei mesi, ne'
// negli avvisi. Prima la lista lo teneva, e chi l'avesse mostrata accanto
// all'arretrato avrebbe scritto «0 kg da settembre».
verifica('pagato il debito, settembre non si nomina piu\': ne\' nella lista ne\' negli avvisi',
  arrNovembre.mesi.length === 0 && arrNovembre.componi.length === 0
  && nov.letture.registro.mesi_arretrato.length === 0
  && nov.letture.registro.arretrato_kg === 0 && !nov.avvisi.some(a => /settembre/i.test(a)), JSON.stringify([arrNovembre.mesi, nov.avvisi]));

console.log('IL LIMITE DEI 38.000 KG PER DICHIARAZIONE');
const righe = [...ott.cssc.righe, ...ott.terziarie.righe];
verifica('tredici dichiarazioni: un DDT di CSS-C e dodici terziarie', righe.length === 13 && ott.cssc.righe.length === 1, String(righe.length));
verifica('nessuna riga chiude sopra 38.000 kg, ne\' il CSS-C ne\' le terziarie',
  righe.every(r => r.chiusura_portale_kg <= MAX_PER_DICHIARAZIONE_KG) && MAX_PER_DICHIARAZIONE_KG === 38000,
  JSON.stringify(righe.map(r => r.chiusura_portale_kg)));
verifica('e il limite morde: almeno dieci chiudono esattamente a 38.000 kg, con residuo zero',
  righe.filter(r => r.chiusura_portale_kg === 38000).length >= 10 && righe.filter(r => r.residuo_kg === 0).length >= 10,
  JSON.stringify(righe.map(r => r.residuo_kg)));
verifica('il CSS-C delle righe fa Y95 e il ciabattato delle terziarie fa V95',
  ott.cssc.cssc_kg === OTTOBRE.uscite_cssc_kg && ott.terziarie.cippato_kg === OTTOBRE.uscite_cippato_kg, JSON.stringify([ott.cssc.cssc_kg, ott.terziarie.cippato_kg]));
verifica('la somma di quello che si carica a portale fa portale_kg',
  righe.reduce((s, r) => s + r.chiusura_portale_kg, 0) === ott.portale_kg && ott.portale_kg === 493000, String(righe.reduce((s, r) => s + r.chiusura_portale_kg, 0)));
verifica('il ferro ci sta tutto: niente avanza e niente resta in giacenza per la nave dopo',
  ott.ferro.avanza_kg === 0 && !ott.avvisi.some(a => /restano in giacenza/.test(a)), String(ott.ferro.avanza_kg));
verifica('e ogni riga e\' il suo materiale piu\' la sua quota di ferro',
  righe.every(r => r.chiusura_portale_kg === r.base_kg + r.ferro_kg + r.extra_kg)
  && righe.reduce((s, r) => s + r.ferro_kg, 0) === 158000, JSON.stringify(righe.map(r => [r.base_kg, r.ferro_kg])));
verifica('senza l\'arretrato il ferro da ripartire e\' quello del solo mese',
  soloUscite.ferro.da_portare_kg === OTTOBRE.uscite_ferro_kg && soloUscite.ferro.avanza_kg === 0, String(soloUscite.ferro.da_portare_kg));

console.log('LA DICHIARAZIONE EER 19.12.02 RESTA QUELLA DEL MESE');
// L'arretrato era gia' stato dichiarato al consorzio per email quando il ferro
// e' uscito: a portale mancava solo la terziaria a cui attaccarlo.
verifica('dichiarato_kg e\' il ferro uscito a ottobre, non ottobre piu\' settembre',
  ott.ferro.dichiarato_kg === OTTOBRE.uscite_ferro_kg && ott.ferro.dichiarato_kg !== OTTOBRE.uscite_ferro_kg + ARRETRATO_SETTEMBRE, String(ott.ferro.dichiarato_kg));
verifica('da_portare_kg invece li porta entrambi: 58.700 + 99.300 = 158.000',
  ott.ferro.da_portare_kg === 158000 && ott.ferro.arretrato_kg === ARRETRATO_SETTEMBRE && ott.ferro.recupero_kg === ARRETRATO_SETTEMBRE, JSON.stringify([ott.ferro.da_portare_kg, ott.ferro.arretrato_kg, ott.ferro.recupero_kg]));
verifica('e il ferro a portale comprende il recupero, mentre il mese resta di 58.700',
  ott.materiali_portale.metalli_kg === 158000 && ott.ferro_uscito_kg === OTTOBRE.uscite_ferro_kg, JSON.stringify(ott.materiali_portale));
verifica('i materiali a portale ricompongono il totale caricato',
  ott.materiali_portale.cippato_kg + ott.materiali_portale.metalli_kg + ott.materiali_portale.cssc_kg === ott.portale_kg
  && ott.rete_kg === ott.portale_kg && ott.extra_kg === 0, JSON.stringify(ott.materiali_portale));

console.log('GLI AVVISI NOMINANO L\'ARRETRATO E I MESI DA CUI VIENE');
// Un numero piu' grande di quello del registro, senza una frase che lo spieghi,
// fa dubitare di tutta la pratica.
const frase = ott.avvisi.find(a => /rimasti indietro/.test(a)) || '';
verifica('c\'e\' la frase che spiega il ferro in piu\'', frase !== '', JSON.stringify(ott.avvisi));
verifica('e dice i chili del mese, quelli recuperati e il mese da cui vengono',
  /158\.000 kg/.test(frase) && /58\.700 usciti nel mese/.test(frase) && /99\.300 kg rimasti indietro da settembre/.test(frase), frase);
verifica('e ricorda che la dichiarazione EER 19.12.02 del mese resta di 58.700 kg',
  /19\.12\.02/.test(frase) && /resta di 58\.700 kg/.test(frase), frase);
verifica('niente che il registro non spieghi', !/che il registro non spiega/.test(frase), frase);
verifica('e la pratica di ottobre non ha altri avvisi', ott.avvisi.length === 1, JSON.stringify(ott.avvisi));

// Un mese preparato e non registrato a portale non ci e' andato: il suo ferro
// conta per intero nell'arretrato, e la pratica chiede di registrarlo, altrimenti
// quei chili si dichiarano qui e poi una seconda volta col loro mese.
const conDaCapire = ferroArretrato(mesi, PRATICHE.map(p => (p.mese === 'Settembre' ? { ...p, stato: 'in_preparazione' } : p)), { mese: 'Ottobre' });
const ottDaCapire = componiMese({ ...comune, arretrato: conDaCapire, lettura: 'giacenza', portaleFineMeseKg: PORTALE_FINE_OTTOBRE });
verifica('un mese preparato e non registrato conta per intero, e la pratica chiede di registrarlo',
  conDaCapire.da_capire.join() === 'Settembre' && conDaCapire.arretrato_kg === ARRETRATO_SETTEMBRE
  && ottDaCapire.avvisi.some(a => /settembre conta per intero/.test(a) && /preparata ma non registrata/.test(a)), JSON.stringify([conDaCapire.da_capire, ottDaCapire.avvisi]));

console.log('SENZA LA GIACENZA A PORTALE SI RIPIEGA SUL REGISTRO');
// La giacenza e' il riscontro: se manca, il registro da' lo stesso numero da
// solo, e la pratica resta senza riscontro.
const senzaGiacenza = componiMese({ ...comune, lettura: 'giacenza' });
verifica('senza la giacenza vale il registro, non le sole uscite',
  senzaGiacenza.letture.usata === 'registro' && senzaGiacenza.portale_kg === 493000 && senzaGiacenza.verifica === null, JSON.stringify([senzaGiacenza.letture.usata, senzaGiacenza.portale_kg]));
verifica('e si dice che manca il riscontro, con i chili dell\'arretrato',
  senzaGiacenza.avvisi.some(a => /Manca la giacenza a portale/.test(a) && /99\.300 kg/.test(a) && /senza riscontro/.test(a)), JSON.stringify(senzaGiacenza.avvisi));
verifica('le dichiarazioni sono le stesse della lettura dalla giacenza',
  JSON.stringify(senzaGiacenza.terziarie.righe) === JSON.stringify(ott.terziarie.righe) && JSON.stringify(senzaGiacenza.cssc) === JSON.stringify(ott.cssc));

// L'arretrato si puo' passare anche come soli kg: il totale e' lo stesso, ma la
// frase non puo' nominare i mesi.
const soliKg = componiMese({ ...comune, arretrato: ARRETRATO_SETTEMBRE, lettura: 'giacenza', portaleFineMeseKg: PORTALE_FINE_OTTOBRE });
verifica('passando i soli kg il totale e la verifica non cambiano',
  soliKg.portale_kg === ott.portale_kg && soliKg.verifica.torna === true && soliKg.letture.scarto_kg === 0, String(soliKg.portale_kg));
verifica('ma senza i mesi la frase dice soltanto "nei mesi prima"',
  soliKg.letture.registro.mesi_arretrato.length === 0 && soliKg.avvisi.some(a => /99\.300 kg rimasti indietro\./.test(a)), JSON.stringify(soliKg.avvisi));
const senzaArretrato = componiMese({ ...comune, lettura: 'giacenza', portaleFineMeseKg: PORTALE_FINE_OTTOBRE - ARRETRATO_SETTEMBRE, arretrato: null });
verifica('un mese senza arretrato resta come prima: registro uguale alle uscite, nessuna frase',
  senzaArretrato.letture.registro.totale_kg === senzaArretrato.letture.uscite.totale_kg && senzaArretrato.letture.scarto_kg === 0
  && senzaArretrato.verifica.torna === true && senzaArretrato.avvisi.length === 0, JSON.stringify(senzaArretrato.avvisi));

console.log('QUELLO CHE SI DICE E\' QUELLO CHE ENTRA DAVVERO A PORTALE');
// Col limite dei 38.000 kg una parte del ferro resta fuori. Annunciare come
// caricato tutto il ferro voluto e' il modo di non recuperare mai piu'
// l'arretrato: chi rilegge il foglio a mesi di distanza lo crede fatto.
const strettoRiga = { mese: 'Ottobre', uscite_cippato_kg: 60000, uscite_ferro_kg: 10000, uscite_cssc_kg: 0, giacenza_totale_kg: 100000, giacenza_ferro_kg: 0 };
const stretto = componiMese({
  riga: strettoRiga,
  ferro: [{ destinatario: 'TRS', colore: 'FFC000', kg: 10000 }],
  allegati: [1, 2].map(n => ({ numero: n, data: '2026-10-20', trasportatore: 'SMOCO', destinatario: 'AKCANSA', kg: 30000 })),
  lettura: 'registro',
  arretrato: { arretrato_kg: 99300, mesi: ['Settembre'], componi: [{ mese: 'Settembre', kg: 99300 }], dettaglio: [], dal_mese: 'Agosto', prima_del_gestionale: [], da_capire: [], senza_pratica: [], fuori_finestra_kg: 0 },
});
verifica('il ferro voluto e quello che entra sono due numeri diversi',
  stretto.ferro.da_portare_kg === 109300 && stretto.ferro.ripartito_kg === 16000 && stretto.ferro.avanza_kg === 93300,
  JSON.stringify([stretto.ferro.da_portare_kg, stretto.ferro.ripartito_kg, stretto.ferro.avanza_kg]));
verifica('di arretrato se ne recuperano 6.000, e 93.300 restano indietro',
  stretto.ferro.recupero_vero_kg === 6000 && stretto.ferro.resta_indietro_kg === 93300, JSON.stringify(stretto.ferro));
const fraseStretta = stretto.avvisi.find(a => /ferro da portare a portale sarebbe/.test(a)) || '';
verifica('l\'avviso dice quanto ne entra davvero, non quanto se ne voleva',
  /ce ne entrano 16\.000/.test(fraseStretta) && /se ne recuperano 6\.000 kg da settembre/.test(fraseStretta)
  && /93\.300 restano indietro/.test(fraseStretta), fraseStretta);
verifica('e non annuncia come caricato tutto l\'arretrato',
  !/109\.300 kg: 10\.000 usciti nel mese piu' 99\.300/.test(fraseStretta), fraseStretta);

console.log('IL RECUPERO PAGA I MESI PIU\' VECCHI, E SI NOMINANO SOLO QUELLI');
const aperti = [{ mese: 'Settembre', kg: 99300 }, { mese: 'Ottobre', kg: 20000 }];
verifica('40.000 recuperati pagano solo settembre',
  JSON.stringify(mesiRecuperati(aperti, 40000)) === JSON.stringify([{ mese: 'Settembre', kg: 40000 }]), JSON.stringify(mesiRecuperati(aperti, 40000)));
verifica('120.000 pagano tutto e non vanno oltre',
  JSON.stringify(mesiRecuperati(aperti, 120000)) === JSON.stringify(aperti), JSON.stringify(mesiRecuperati(aperti, 120000)));
verifica('zero non paga nessuno', mesiRecuperati(aperti, 0).length === 0 && mesiRecuperati([], 5000).length === 0);

console.log('IN UN MESE DI SOLI METALLI IL LIMITE DEI 38.000 KG NON C\'ENTRA');
// Settembre 2026, il mese della regola: niente nave, niente DDT. La differenza
// con AD + AE c'e', ma il motivo non e' il limite del portale - non c'e' nessuna
// dichiarazione - ed e' che non e' partita nessuna nave.
const settembre = componiMese({
  riga: { mese: 'Settembre', uscite_cippato_kg: 0, uscite_ferro_kg: 99300, uscite_cssc_kg: 0, giacenza_totale_kg: 400000, giacenza_ferro_kg: 18240 },
  ferro: [{ destinatario: 'TRS', colore: 'FFC000', kg: 99300 }],
  lettura: 'giacenza', portaleFineMeseKg: 517540,
});
verifica('a portale non si carica nulla e la differenza e\' tutto il ferro',
  settembre.solo_metalli === true && settembre.portale_kg === 0 && settembre.verifica.differenza_kg === 99300 && settembre.verifica.torna === false, JSON.stringify(settembre.verifica));
const fraseSett = settembre.avvisi.find(a => /resterebbero/.test(a)) || '';
verifica('il motivo e\' che non e\' partita nessuna nave, non i 38.000 kg',
  /nessuna nave/.test(fraseSett) && !/38\.000/.test(fraseSett), fraseSett);
verifica('e non esce un secondo avviso che da\' un altro motivo per lo stesso numero',
  settembre.avvisi.filter(a => /38\.000/.test(a)).length === 0, JSON.stringify(settembre.avvisi));

console.log('IL CAMBIO D\'ANNO E I MESI SENZA PRATICA SI DICONO SEMPRE');
// A gennaio l'arretrato e' zero per costruzione, quindi senza la fotografia del
// portale la lettura ripiega sulle uscite: l'avviso dev'esserci comunque, perche'
// e' proprio quello il caso in cui il ferro di dicembre resta indietro.
const gennaio = componiMese({
  riga: { mese: 'Gennaio', uscite_cippato_kg: 200000, uscite_ferro_kg: 30000, uscite_cssc_kg: 25000, giacenza_totale_kg: 150000, giacenza_ferro_kg: 10000 },
  ferro: [{ destinatario: 'TRS', colore: 'FFC000', kg: 30000 }],
  lettura: 'uscite', arretrato: { arretrato_kg: 0, mesi: [], componi: [], dettaglio: [], dal_mese: '', prima_del_gestionale: [], da_capire: [], senza_pratica: [], fuori_finestra_kg: 0 },
});
verifica('a gennaio si dice che del dicembre prima non si legge nulla',
  gennaio.avvisi.some(a => /A gennaio il saldo del ferro riparte da zero/.test(a) && /dicembre/.test(a)), JSON.stringify(gennaio.avvisi));
// Un mese dentro la finestra senza nessuna pratica: il saldo conta tutto il suo
// ferro come arretrato, ma se quella dichiarazione e' stata caricata a portale
// fuori dal gestionale, dichiararlo di nuovo lo porta a portale due volte.
const senzaPratica = ferroArretrato(
  [{ mese: 'Agosto', uscite_ferro_kg: 82500 }, { mese: 'Settembre', uscite_cippato_kg: 310000, uscite_cssc_kg: 25000, uscite_ferro_kg: 99300 }],
  [praticaRegistrata('Agosto', 82500)], { mese: 'Ottobre' });
verifica('un mese senza pratica si segnala, e si dice che la nave c\'era',
  senzaPratica.senza_pratica.join() === 'Settembre' && senzaPratica.dettaglio[1].aveva_nave === true, JSON.stringify(senzaPratica.senza_pratica));
const ottSenza = componiMese({ ...comune, arretrato: senzaPratica, lettura: 'registro' });
verifica('e la pratica avverte che dichiararlo di nuovo lo porterebbe a portale due volte',
  ottSenza.avvisi.some(a => /nessuna pratica/.test(a) && /due volte/.test(a)), JSON.stringify(ottSenza.avvisi));

console.log('IL SALDO SULLE CIFRE VERE DEL 2026, LETTE DAL REGISTRO');
// Colonna X del foglio Cons. di «Irigom carico scarico 2026.xlsx», righe 86-94,
// letta il 03/10/2026. Le pratiche nel gestionale partono da agosto: agosto ha
// portato a portale tutto il suo ferro (il 31/08 il portale aveva 144.780 kg,
// cioe' AD93 + AE93 al chilo), settembre e' stato un mese di soli metalli.
const X_2026 = { Gennaio: 84100, Febbraio: 90360, Marzo: 113460, Aprile: 89780, Maggio: 102640, Giugno: 89580, Luglio: 126160, Agosto: 82500, Settembre: 99300 };
const mesiVeri = MESI.map(m => ({ mese: m, uscite_ferro_kg: X_2026[m] || 0 }));
const praticheVere = [
  { anno: 2026, mese: 'Agosto', stato: 'registrata', versione: 1, metalli_kg: 82500, dati_json: JSON.stringify({ solo_metalli: false, materiali_portale: { metalli_kg: 82500 } }) },
  { anno: 2026, mese: 'Settembre', stato: 'registrata', versione: 1, metalli_kg: 99300, dati_json: JSON.stringify({ solo_metalli: true, materiali_portale: { metalli_kg: 0 } }) },
];
const arrVero = ferroArretrato(mesiVeri, praticheVere, { mese: 'Ottobre' });
verifica('a ottobre 2026 l\'arretrato e\' 99.300 kg, tutto di settembre',
  arrVero.arretrato_kg === 99300 && arrVero.mesi.join() === 'Settembre' && arrVero.componi[0].kg === 99300, JSON.stringify([arrVero.arretrato_kg, arrVero.mesi]));
verifica('il saldo parte da agosto e i sette mesi prima si dicono, non si contano',
  arrVero.dal_mese === 'Agosto' && arrVero.prima_del_gestionale.length === 7 && arrVero.fuori_finestra_kg === 0, JSON.stringify([arrVero.dal_mese, arrVero.prima_del_gestionale]));
// La somma di gennaio-luglio e' 696.080 kg: contarla sarebbe il numero mostruoso
// che l'ancora esiste per evitare, e non sarebbe arretrato - al 31/08 il portale
// era esattamente ad AD93 + AE93, quindi quel ferro era gia' stato dichiarato.
verifica('senza l\'ancora si dichiarerebbero 696.080 kg di ferro in piu\'',
  ferroArretrato(mesiVeri, [praticheVere[1]], { mese: 'Ottobre' }).arretrato_kg === 99300
  && Object.entries(X_2026).filter(([m]) => MESI.indexOf(m) < MESI.indexOf('Agosto')).reduce((s, [, k]) => s + k, 0) === 696080);
// Settembre senza pratica nel gestionale: l'arretrato resta 99.300, ma si segnala,
// perche' se quella dichiarazione fosse stata caricata fuori dal gestionale quei
// chili andrebbero a portale due volte.
const senzaSettembre = ferroArretrato(mesiVeri, [praticheVere[0]], { mese: 'Ottobre' });
verifica('finche\' settembre non e\' registrato, l\'arretrato c\'e\' ma si chiede di registrarlo',
  senzaSettembre.arretrato_kg === 99300 && senzaSettembre.senza_pratica.join() === 'Settembre', JSON.stringify(senzaSettembre.senza_pratica));

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
