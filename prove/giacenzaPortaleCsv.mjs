// LA GIACENZA A PORTALE LETTA DAL CSV DEL PORTALE, SUL FILE VERO.
//
// L'utente ha estratto dalla schermata «dichiarazione» del portale la lista degli
// ordini dichiarabili di Irigom al 03/10/2026, ore 15:00: 143 ordini. Il file in
// prove/dati/portale_irigom_2026-10-03.csv e' quello, con la sola colonna
// «Origine» resa anonima (i nomi dei produttori non servono a questa prova):
// intestazioni, separatore, BOM, date, pesi e classi sono quelli veri.
//
// I numeri che questa prova difende, perche' sono il riscontro della regola del
// 22/09/2026 su dati veri:
//   - 543.220 kg disponibili in tutto;
//   - per fine trasporto: 144.780 in agosto, 375.140 in settembre, 23.300 in ottobre;
//   - i 144.780 di agosto sono esattamente AD93 + AE93 del registro, cioe' quello
//     che la dichiarazione di agosto doveva lasciare a portale;
//   - giacenza al 30/09/2026: 519.920 kg, e settembre non ha dichiarato nulla
//     perche' e' stato un mese di soli metalli (99.300 kg di ferro).
//
// E le trappole del formato, che su questo file non si vedono ma sugli export dei
// mesi prossimi costano un numero sbagliato detto in silenzio:
//   - «Peso dichiarato (kg)» non e' peso dichiarato: e' quello che si sta mettendo
//     nella dichiarazione aperta in quel momento, 1 kg per aprire una terziaria.
//     La giacenza e' la somma di «Peso disponibile»;
//   - la classe dice il canale: 1-4 rete, 9 ACI, e non si sommano mai;
//   - la virgola e' decimale in un file italiano e separatore delle migliaia in uno
//     inglese: lo dice il separatore dei campi, non il numero;
//   - un peso che non si legge, una data impossibile, un impianto scritto in due
//     modi e il filtro della schermata del portale toglierebbero chili senza dirlo.
// npm run prove
import { readFileSync } from 'node:fs';
import {
  leggiCsvPortale, giacenzaCsvAlGiorno, riscontroGiacenza,
  nomeSitoPortale, giornoDa, numeroDa, canaleDiClasse, ultimoGiornoDelMese,
} from '../src/lib/giacenzaPortaleCsv.js';
import { componiMese } from '../src/lib/praticaIrigom.js';

const testo = readFileSync(new URL('./dati/portale_irigom_2026-10-03.csv', import.meta.url), 'utf8');
const linee = testo.replace(/^﻿/, '').split(/\r?\n/).filter(x => x.trim());
const IRIGOM = { sito: 'IRIGOM SRL', giorno: '2026-09-30' };
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
/** Il file vero con una riga cambiata o aggiunta, per vedere se il modulo se ne accorge. */
const conRighe = (cambia) => leggiCsvPortale([linee[0], ...cambia(linee.slice(1))].join('\r\n'));
const kgDi = (lettura, p = IRIGOM) => giacenzaCsvAlGiorno(lettura, p).kg;

console.log('I PEZZI DEL FORMATO');
verifica('la data italiana diventa il giorno', giornoDa('24/08/2026') === '2026-08-24' && giornoDa('1/9/2026') === '2026-09-01');
verifica('un ISO resta com\'e\', e una data che non c\'e\' resta vuota', giornoDa('2026-08-24') === '2026-08-24' && giornoDa('') === '' && giornoDa('-') === '');
// Una data impossibile deve restare VUOTA, non diventare una chiave finta: con
// '2026-13-31' i chili finivano in un mese che non esiste e agosto non tornava piu'.
verifica('un mese o un giorno che non esistono non passano', giornoDa('31/13/2026') === '' && giornoDa('30/02/2026') === '' && giornoDa('00/01/2026') === '', `${giornoDa('31/13/2026')} ${giornoDa('30/02/2026')}`);
verifica('una data all\'americana non si prende per buona', giornoDa('09/25/2026') === '', giornoDa('09/25/2026'));
verifica('il 29 febbraio esiste solo negli anni bisestili', giornoDa('29/02/2024') === '2024-02-29' && giornoDa('29/02/2026') === '');
verifica('l\'ultimo giorno del mese', ultimoGiornoDelMese(2026, 2) === '2026-02-28' && ultimoGiornoDelMese(2024, 2) === '2024-02-29' && ultimoGiornoDelMese(2026, 12) === '2026-12-31' && ultimoGiornoDelMese(2026, 9) === '2026-09-30');
verifica('i numeri di un file italiano', numeroDa('23300') === 23300 && numeroDa('23.300') === 23300 && numeroDa('23.300,50') === 23300.5, String(numeroDa('23.300')));
verifica('i numeri di un file inglese', numeroDa('23,300', { inglese: true }) === 23300 && numeroDa('23,300.50', { inglese: true }) === 23300.5, String(numeroDa('23,300', { inglese: true })));
// La trappola: '3,340' da solo e' ambiguo. Letto all'italiana da' 3,34 - mille
// volte meno - e lo scarto sembrerebbe del gestionale.
verifica('la stessa cifra si legge diversa nei due formati', numeroDa('3,340') === 3.34 && numeroDa('3,340', { inglese: true }) === 3340);
verifica('quello che non e\' un numero torna null, non zero', numeroDa('') === null && numeroDa('4.500,00 kg') === null && numeroDa('n/d') === null && numeroDa('-') === null, String(numeroDa('4.500,00 kg')));
verifica('il nome del sito perde il prefisso del portale', nomeSitoPortale('Impianto di Irigom S.r.l.') === 'irigom' && nomeSitoPortale('IRIGOM SRL') === 'irigom', nomeSitoPortale('Impianto di Irigom S.r.l.'));
verifica('anche senza la preposizione, o con un prefisso diverso', nomeSitoPortale('Impianto Irigom S.r.l.') === 'irigom' && nomeSitoPortale('Stoccaggio Irigom S.r.l.') === 'irigom', nomeSitoPortale('Stoccaggio Irigom S.r.l.'));
verifica('le classi dicono il canale', canaleDiClasse(1) === 'RETE' && canaleDiClasse(4) === 'RETE' && canaleDiClasse(9) === 'ACI' && canaleDiClasse(0) === '');

console.log('IL FILE VERO DI IRIGOM, 03/10/2026');
const l = leggiCsvPortale(testo);
verifica('143 ordini, nessun doppione e nessuna riga da sistemare', l.righe.length === 143 && l.doppioni.length === 0 && l.senza_data.length === 0 && l.senza_classe.length === 0 && l.senza_peso.length === 0 && l.negativi.length === 0, `${l.righe.length} ${JSON.stringify(l.avvisi)}`);
verifica('nessun avviso: il file e\' pulito', l.avvisi.length === 0 && l.filtro_kg === 0, JSON.stringify(l.avvisi));
// Il file di prova deve avere i pesi col PUNTO DELLE MIGLIAIA, come li scrive il
// portale all'italiana ('3.340'): e' il formato che l'utente usa dal 03/10/2026.
// Senza questo controllo, un file di prova rigenerato coi pesi nudi lascerebbe
// scoperta la lettura all'italiana senza che nessuna prova se ne accorga.
const conPunto = linee.slice(1).filter(r => /\d\.\d{3}/.test(r.split(';')[10])).length;
verifica('il file di prova e\' davvero in formato italiano', conPunto === 132, `${conPunto} pesi col punto su 143`);
verifica('un solo sito, Irigom', l.siti.length === 1 && l.siti[0].sito_chiave === 'irigom', JSON.stringify(l.siti.map(s => s.sito_chiave)));
verifica('tutto rete, nessuna ACI: i canali non si mescolano', l.siti[0].rete_kg === 543220 && l.siti[0].aci_kg === 0 && l.siti[0].senza_canale_kg === 0, JSON.stringify(l.siti[0]));
verifica('il file arriva fino al 1 ottobre', l.primo_giorno === '2026-08-24' && l.ultimo_giorno === '2026-10-01', `${l.primo_giorno} ${l.ultimo_giorno}`);
// La trappola: una riga ha «Peso dichiarato» 1 kg, il segnaposto con cui si apre
// una terziaria a portale. Se finisse nella giacenza il totale sarebbe sbagliato.
const inDich = l.righe.reduce((s, r) => s + r.in_dichiarazione_kg, 0);
verifica('il kg della dichiarazione aperta resta fuori dalla giacenza', inDich === 1 && l.righe.filter(r => r.selezionato).length === 1, String(inDich));

console.log('LA GIACENZA A UN GIORNO');
const g30 = giacenzaCsvAlGiorno(l, IRIGOM);
verifica('al 30/09/2026 la giacenza di rete e\' 519.920 kg', g30.kg === 519920, String(g30.kg));
verifica('e quello arrivato dopo e\' 23.300 kg, che non riguarda settembre', g30.dopo_kg === 23300 && g30.dopo_ordini === 5, JSON.stringify([g30.dopo_kg, g30.dopo_ordini]));
verifica('al 31/08/2026 resta quello che agosto doveva lasciare: 144.780 kg', kgDi(l, { sito: 'IRIGOM SRL', giorno: '2026-08-31' }) === 144780, String(kgDi(l, { sito: 'IRIGOM SRL', giorno: '2026-08-31' })));
verifica('per mese: agosto 144.780, settembre 375.140, ottobre 23.300',
  g30.per_mese['2026-08'] === 144780 && g30.per_mese['2026-09'] === 375140
  && giacenzaCsvAlGiorno(l, { sito: 'IRIGOM SRL' }).per_mese['2026-10'] === 23300, JSON.stringify(g30.per_mese));
verifica('senza giorno si conta tutto il file', kgDi(l, { sito: 'IRIGOM SRL' }) === 543220);
verifica('per classe al 30/09: 475.240 di classe 1, 41.880 di classe 2, 2.800 di classe 3',
  g30.per_classe[1] === 475240 && g30.per_classe[2] === 41880 && g30.per_classe[3] === 2800, JSON.stringify(g30.per_classe));
verifica('un sito che non c\'e\' nel file da\' zero, e dice di chi sono i chili che ha lasciato fuori',
  kgDi(l, { sito: 'NAPPI SUD SRL', giorno: '2026-09-30' }) === 0
  && giacenzaCsvAlGiorno(l, { sito: 'NAPPI SUD SRL', giorno: '2026-09-30' }).altri_siti_kg === 543220, String(kgDi(l, { sito: 'NAPPI SUD SRL', giorno: '2026-09-30' })));

console.log('I CANALI NON SI SOMMANO MAI');
// Il file vero e' tutto di rete, quindi una prova sull'ACI qui non proverebbe
// niente: si aggiunge una riga di classe 9 da 50.000 kg e si guarda che non entri
// nella rete. Togliendo il filtro dei canali, questa prova deve fallire.
const conAci = conRighe(righe => [...righe, righe[0]
  .replace(/;\.class1;/, ';.class9;')
  .replace(/;ET\d+;/, ';ET26999999;')
  .replace(/;100;1;/, ';50000;0;')]);
verifica('la riga ACI si legge come ACI', conAci.righe.length === 144 && conAci.siti[0].aci_kg === 50000 && conAci.siti[0].rete_kg === 543220, JSON.stringify(conAci.siti[0]));
verifica('la rete non si prende l\'ACI', kgDi(conAci) === 519920, String(kgDi(conAci)));
verifica('l\'ACI non si prende la rete', kgDi(conAci, { ...IRIGOM, canale: 'ACI' }) === 50000, String(kgDi(conAci, { ...IRIGOM, canale: 'ACI' })));
verifica('e si dice quanti chili sono dell\'altro canale', giacenzaCsvAlGiorno(conAci, IRIGOM).altro_canale_kg === 50000);
const conClasseIgnota = conRighe(righe => righe.map((r, i) => (i === 0 ? r.replace(/;\.class1;/, ';.classX;') : r)));
verifica('una classe che non si riconosce si segnala e resta fuori',
  conClasseIgnota.senza_classe.length === 1 && conClasseIgnota.avvisi.some(a => /classe/.test(a)) && kgDi(conClasseIgnota) === 519820, String(kgDi(conClasseIgnota)));

console.log('QUELLO CHE IL MODULO LASCIA FUORI, LO DICE');
// Lo stesso impianto scritto in due modi: prima dimezzava la giacenza in silenzio.
const dueModi = conRighe(righe => righe.map((r, i) => (i % 2 ? r.replace('Impianto di Irigom S.r.l.', 'Stoccaggio Irigom S.r.l.') : r)));
verifica('lo stesso impianto scritto in due modi resta un impianto solo', dueModi.siti.length === 1 && kgDi(dueModi) === 519920, JSON.stringify(dueModi.siti.map(s => s.sito_chiave)));
const altroSito = conRighe(righe => righe.map((r, i) => (i % 2 ? r.replace('Impianto di Irigom S.r.l.', 'Impianto di Nappi Sud S.r.l.') : r)));
verifica('due impianti veri restano divisi, e si dice quanti chili sono dell\'altro',
  altroSito.siti.length === 2 && giacenzaCsvAlGiorno(altroSito, IRIGOM).altri_siti_kg > 0
  && giacenzaCsvAlGiorno(altroSito, IRIGOM).altri_siti.join() === 'Impianto di Nappi Sud S.r.l.', JSON.stringify(altroSito.siti.map(s => [s.sito_chiave, s.rete_kg])));
// Un peso che non si legge NON diventa zero in silenzio.
const pesoRotto = conRighe(righe => righe.map((r, i) => (i === 0 ? r.replace(';100;1;', ';100 kg;1;') : r)));
verifica('un peso che non si legge si segnala', pesoRotto.senza_peso.length === 1 && pesoRotto.avvisi.some(a => /non si legge come numero/.test(a)), JSON.stringify(pesoRotto.avvisi));
const negativo = conRighe(righe => righe.map((r, i) => (i === 0 ? r.replace(';100;1;', ';-100;1;') : r)));
verifica('un peso negativo si segnala', negativo.negativi.length === 1 && negativo.avvisi.some(a => /negativo/.test(a)), JSON.stringify(negativo.avvisi));
// Il filtro della schermata del portale viaggia dentro l'export: con quello
// acceso il file e' solo una parte della giacenza.
// Il peso si legge con numeroDa, non con Number: nel file vero e' '3.340', e
// Number lo prende per 3,34. Scritte con Number, due prove qui sotto passavano
// solo finche' l'export aveva i pesi senza il punto delle migliaia.
const pesoDi = (riga) => numeroDa(riga.split(';')[10]) || 0;
const filtrato = conRighe(righe => righe.filter(r => pesoDi(r) >= 5000)
  .map(r => { const c = r.split(';'); c[4] = '5.000'; return c.join(';'); }));
verifica('un export fatto col filtro acceso si riconosce e si dice',
  filtrato.filtro_kg === 5000 && filtrato.avvisi.some(a => /senza quel filtro/.test(a)) && kgDi(filtrato) === 198700, `${filtrato.filtro_kg} ${kgDi(filtrato)}`);

console.log('LE VIRGOLETTE E I SEPARATORI');
// 'GOMME 15" SRL': una misura in pollici, normale nel settore, e il portale non
// quota i campi. Prima apriva una stringa e si mangiava data e peso della riga.
const pollici = conRighe(righe => righe.map((r, i) => (i === 0 ? r.replace('PRODUTTORE 001', 'GOMME 15" SRL') : r)));
verifica('una virgoletta in mezzo a un campo non si mangia la riga',
  pollici.righe[0].origine === 'GOMME 15" SRL' && pollici.righe[0].fine_trasporto === '2026-08-24'
  && pollici.righe[0].disponibile_kg === 100 && kgDi(pollici) === 519920, JSON.stringify([pollici.righe[0].origine, pollici.righe[0].fine_trasporto, pollici.righe[0].disponibile_kg]));
// Un campo che SI APRE con le virgolette si legge come vuole il formato, anche col
// separatore e le virgolette doppie dentro.
const quotato = conRighe(righe => righe.map((r, i) => (i === 0 ? r.replace('PRODUTTORE 001', '"GOMME; E ""CERCHI"" SRL"') : r)));
verifica('un campo quotato porta dentro il separatore e le virgolette doppie',
  quotato.righe[0].origine === 'GOMME; E "CERCHI" SRL' && quotato.righe[0].disponibile_kg === 100 && kgDi(quotato) === 519920, JSON.stringify(quotato.righe[0].origine));
// Lo stesso file salvato in inglese: separatore virgola, migliaia con la virgola.
const inglese = [linee[0].split(';').join(','), ...linee.slice(1).map(r => {
  const c = r.split(';');
  c[10] = '"' + pesoDi(r).toLocaleString('en-US') + '"';
  return c.join(',');
})].join('\n');
const li = leggiCsvPortale(inglese);
verifica('un file salvato in inglese da\' gli stessi chili, non mille volte meno',
  li.righe.length === 143 && kgDi(li) === 519920 && li.senza_peso.length === 0, `${li.righe.length} ${kgDi(li)}`);
// E lo stesso file coi pesi senza il punto delle migliaia, com'erano nel primo
// export del portale ('3340' invece di '3.340'): i due si leggono uguale.
const senzaPunti = conRighe(righe => righe.map(r => { const c = r.split(';'); c[10] = String(pesoDi(r)); return c.join(';'); }));
verifica('coi pesi senza il punto delle migliaia i chili sono gli stessi',
  senzaPunti.righe.length === 143 && kgDi(senzaPunti) === 519920 && senzaPunti.senza_peso.length === 0, String(kgDi(senzaPunti)));
// Un ordine ripetuto (due pagine del portale che si sovrappongono) non si conta due volte.
const doppio = conRighe(righe => [...righe, righe[0]]);
verifica('un ordine ripetuto si conta una volta sola, e si dice',
  doppio.righe.length === 143 && doppio.doppioni.length === 1 && doppio.avvisi.some(a => /ripetut/.test(a)) && kgDi(doppio) === 519920, JSON.stringify([doppio.righe.length, doppio.doppioni]));

console.log('IL CSV E LA PRATICA: IL FERRO DI SETTEMBRE SI VEDE DA QUI');
// LA CATENA CHIUSA SU DUE FILE INDIPENDENTI, VERIFICATA IL 03/10/2026.
//
// Dal registro di Irigom («Irigom carico scarico 2026.xlsx», foglio Cons., riga
// 94 = settembre): AD94 = 412.420 di gomma in impianto, AE94 = 8.200 di metalli
// in giacenza, somma 420.620. Dal CSV del portale, che il registro non conosce:
// 519.920 kg di giacenza al 30/09. La differenza fa 99.300, cioe' esattamente
// X94, il ferro uscito a settembre - mese di soli metalli, nessuna nave, niente
// caricato a portale. E' il ferro da recuperare a ottobre.
//
// E l'ancora del saldo non e' piu' un'ipotesi: al 31/08 il portale aveva 144.780
// kg, cioe' AD93 + AE93 al chilo (144.780 + 0). Se qualche mese da gennaio a
// luglio avesse lasciato indietro del ferro, a fine agosto il portale ne avrebbe
// avuto di piu'. Quindi il conto del ferro era in pari al 31/08 e l'arretrato che
// arriva a ottobre e' tutto e solo quello di settembre.
const AD_AE_SETTEMBRE = 420620;
const AD_AE_AGOSTO = 144780;
verifica('al 31/08 il portale aveva esattamente AD93 + AE93: il conto del ferro era in pari',
  kgDi(l, { sito: 'IRIGOM SRL', giorno: '2026-08-31' }) === AD_AE_AGOSTO);
verifica('al 30/09 il portale supera AD94 + AE94 di 99.300 kg, il ferro di settembre',
  g30.kg - AD_AE_SETTEMBRE === 99300, String(g30.kg - AD_AE_SETTEMBRE));
const settembre = componiMese({
  riga: { mese: 'Settembre', uscite_cippato_kg: 0, uscite_ferro_kg: 99300, uscite_cssc_kg: 0, giacenza_totale_kg: AD_AE_SETTEMBRE, giacenza_ferro_kg: 0 },
  ferro: [{ destinatario: 'TRS', colore: 'FFC000', kg: 99300 }],
  lettura: 'giacenza', portaleFineMeseKg: g30.kg,
});
verifica('la pratica di settembre, con la giacenza del CSV, non carica niente a portale', settembre.solo_metalli === true && settembre.portale_kg === 0);
verifica('e dice che restano 99.300 kg di troppo rispetto ad AD + AE',
  settembre.verifica.resta_dopo_kg === g30.kg && settembre.verifica.deve_restare_kg === AD_AE_SETTEMBRE
  && settembre.verifica.differenza_kg === 99300 && settembre.verifica.torna === false, JSON.stringify(settembre.verifica));
verifica('che e\' esattamente il ferro uscito a settembre', settembre.verifica.differenza_kg === settembre.ferro_uscito_kg, `${settembre.verifica.differenza_kg} ${settembre.ferro_uscito_kg}`);

console.log('IL RISCONTRO NON SOSTITUISCE IL NUMERO DEL GESTIONALE');
const r = riscontroGiacenza(g30.kg, 519920);
verifica('quando torna, lo dice', r.torna === true && r.scarto_kg === 0);
const r2 = riscontroGiacenza(g30.kg, 500000);
verifica('quando non torna, lo scarto e\' col segno e i due numeri restano entrambi',
  r2.torna === false && r2.scarto_kg === 19920 && r2.portale_kg === 519920 && r2.gestionale_kg === 500000, JSON.stringify(r2));

console.log('I FILE CHE NON VANNO');
let errore = '';
try { leggiCsvPortale('a;b;c\n1;2;3'); } catch (e) { errore = e.message; }
verifica('un CSV di un\'altra cosa si rifiuta, dicendo quali colonne mancano', /non e' il csv delle dichiarazioni/i.test(errore) && /Peso disponibile/.test(errore), errore);
let vuoto = '';
try { leggiCsvPortale(''); } catch (e) { vuoto = e.message; }
verifica('un file vuoto si rifiuta', /vuoto/i.test(vuoto), vuoto);
const soloIntestazione = leggiCsvPortale(linee[0]);
verifica('un file con la sola intestazione si legge e non dice niente', soloIntestazione.righe.length === 0 && soloIntestazione.siti.length === 0 && kgDi(soloIntestazione) === 0);
const corta = conRighe(righe => [...righe, 'Ecotyre Scrl;Impianto di Irigom S.r.l.;1;Ciabattato (50-100mm);;1;ET26000001']);
verifica('una riga piu\' corta dell\'intestazione si segnala, non vale zero in silenzio',
  corta.senza_peso.join() === 'ET26000001' && corta.senza_data.join() === 'ET26000001' && corta.avvisi.length >= 2, JSON.stringify(corta.avvisi));

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
