// Prova della pratica mensile di Irigom (src/lib/praticaIrigom.js) sul caso vero
// di agosto 2026: dagli stessi dati del registro devono uscire, al chilo, le
// dichiarazioni prodotte il 18/09/2026, e con la regola del 22/09/2026 il totale
// da caricare a portale: 534.600 kg, l'extra raccolta dentro l'ultima terziaria.
// npm run prove
import { readFileSync } from 'node:fs';
import { quotaEct, formulariFerro, scegliAllegati, componiMese, dividiExtra, ripartisciFerro, extraDaSalvare, extraGiaDichiarate, finestraExtra, extraPerMese, extraDellePratiche, dichiarazioniExtra, testoExtraCompresa, extraCompresaDaNota } from '../src/lib/praticaIrigom.js';
import { dateDaSistemare, testoDate } from '../base44/shared/movimenti.ts';

const A = JSON.parse(readFileSync(new URL('./dati/irigom_agosto_2026.json', import.meta.url), 'utf8'));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('LA QUOTA ECT NELLE NOTE DI IRIGOM');
for (const [nota, atteso] of [
  ['ECP:10,72 ECT:6,62 LM: 10,62', 6620], ['ECT: 19,68 LM: 7,66', 19680], ['ECT 2,66', 2660], ['ect: 6,6', 6600],
  ['FECT:12.64', 12640], ['ECT: 11,68 TON', 11680], ['ECT:14,82 T', 14820], ['27,5 ECP 1,06 ECT', 1060],
  ['Angelo Palmisano:\nECT: 6,62', 6620], ['ecp: 24,2 lm:3,36', null], ['', null],
]) verifica(`"${nota}"`, quotaEct(nota) === atteso, `-> ${quotaEct(nota)}`);

console.log('I FORMULARI DEL FERRO DI AGOSTO');
const ff = formulariFerro(A.ferro);
verifica('quattro formulari nostri', ff.tabella.length === 4, String(ff.tabella.length));
verifica('stessi formulari e quote', JSON.stringify(ff.tabella.map(r => [r.formulario, r.kg, r.quota_kg])) === JSON.stringify(A.attese.ferro_tabella.map(r => [r.formulario, r.peso_kg, r.quota_kg])));
verifica('111.500 di peso, 82.500 di quota', ff.peso_kg === 111500 && ff.quota_kg === 82500, `${ff.peso_kg} ${ff.quota_kg}`);
verifica('MMF escluso anche se arancione', formulariFerro([{ destinatario: 'MMF', colore: 'FFC000', kg: 1000 }]).quota_kg === 0);

console.log('GLI ALLEGATI VII');
// Agosto e' stato dichiarato col criterio di allora ('ordine'): la pratica si
// rifa' uguale solo chiedendolo. Il criterio di adesso e' piu' avanti.
const sc = scegliAllegati(A.allegati, A.riga.uscite_cippato_kg, { criterio: 'ordine' });
verifica('i 17 allegati scelti', JSON.stringify(sc.scelti.map(a => a.numero)) === JSON.stringify(A.attese.allegati_scelti), JSON.stringify(sc.scelti.map(a => a.numero)));
verifica('coprono 463.800 kg', sc.coperto_kg === 463800, String(sc.coperto_kg));
verifica('prima SMOCO, poi TRANSAR', scegliAllegati([{ numero: 1, trasportatore: 'ALTRO', kg: 10 }, { numero: 2, trasportatore: 'TRANSAR', kg: 10 }, { numero: 3, trasportatore: 'SMOCO', kg: 10 }], 30).ordinati.map(a => a.numero).join() === '3,2,1');

console.log('GLI ALLEGATI VII: LA COMBINAZIONE PIU\' VICINA (22/09/2026)');
const vicino = scegliAllegati(A.allegati, A.riga.uscite_cippato_kg);
verifica('su agosto sfora meno del criterio di allora', vicino.coperto_kg >= A.riga.uscite_cippato_kg && vicino.coperto_kg < 463800, `${vicino.coperto_kg} contro 463800`);
verifica('sono tutti SMOCO: gli altri trasportatori non servono', vicino.scelti.every(a => /smoco/i.test(a.trasportatore)) && vicino.bacino === 'SMOCO');
verifica('lo scarto e\' quello dichiarato', vicino.scarto_kg === vicino.coperto_kg - A.riga.uscite_cippato_kg && vicino.basta);
const esatto = scegliAllegati([
  { numero: 1, trasportatore: 'SMOCO', kg: 30000 }, { numero: 2, trasportatore: 'SMOCO', kg: 20000 },
  { numero: 3, trasportatore: 'SMOCO', kg: 25000 }, { numero: 4, trasportatore: 'SMOCO', kg: 5000 },
], 25000);
verifica('se una combinazione fa il peso esatto, si prende quella', esatto.coperto_kg === 25000 && esatto.scarto_kg === 0, JSON.stringify(esatto.scelti.map(a => a.numero)));
verifica('a parita\' di somma vincono gli allegati di testa', esatto.scelti.map(a => a.numero).join() === '2,4' || esatto.scelti.map(a => a.numero).join() === '3', JSON.stringify(esatto.scelti.map(a => a.numero)));
const soloConTransar = scegliAllegati([
  { numero: 1, trasportatore: 'SMOCO', kg: 10000 }, { numero: 2, trasportatore: 'TRANSAR', kg: 12000 }, { numero: 3, trasportatore: 'ALTRO', kg: 11000 },
], 21000);
verifica('se SMOCO non basta si aggiunge TRANSAR, non gli altri', soloConTransar.coperto_kg === 22000 && soloConTransar.bacino === 'SMOCO e TRANSAR'
  && soloConTransar.scelti.map(a => a.numero).join() === '1,2', JSON.stringify(soloConTransar.scelti.map(a => a.numero)));
const nonBasta = scegliAllegati([{ numero: 1, trasportatore: 'SMOCO', kg: 1000 }, { numero: 2, trasportatore: 'ALTRO', kg: 2000 }], 10000);
verifica('se nemmeno tutti bastano si prende tutto e si dice che non basta', nonBasta.coperto_kg === 3000 && !nonBasta.basta && nonBasta.scelti.length === 2);
verifica('senza allegati non sceglie niente', scegliAllegati([], 1000).scelti.length === 0 && scegliAllegati(null, 0).coperto_kg === 0);

// Contro una ricerca esaustiva: su insiemi piccoli la combinazione trovata deve
// essere la migliore possibile, cioe' la somma piu' piccola che copre il peso.
let peggiori = 0;
let seme = 12345;
const caso = () => { seme = (seme * 1103515245 + 12345) & 0x7fffffff; return seme / 0x7fffffff; };
for (let prova = 0; prova < 60; prova++) {
  const n = 2 + Math.floor(caso() * 9);
  const pezzi = Array.from({ length: n }, (_, i) => ({ numero: i + 1, trasportatore: 'SMOCO', kg: 100 + Math.floor(caso() * 9900) }));
  const bersaglio = Math.floor(caso() * pezzi.reduce((s, p) => s + p.kg, 0));
  let migliore = Infinity;
  for (let mask = 0; mask < (1 << n); mask++) {
    let s = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) s += pezzi[i].kg;
    if (s >= bersaglio && s < migliore) migliore = s;
  }
  const trovato = scegliAllegati(pezzi, bersaglio);
  const sommaScelti = trovato.scelti.reduce((s, p) => s + p.kg, 0);
  if (trovato.coperto_kg !== migliore || sommaScelti !== trovato.coperto_kg) peggiori++;
}
verifica('60 casi a caso: sempre la somma migliore, e gli allegati scelti la fanno davvero', peggiori === 0, `${peggiori} casi sbagliati`);

console.log('LA PRATICA DI AGOSTO, COME E\' STATA FATTA (LETTURA DALLE USCITE)');
const m = componiMese({ criterio: 'ordine', riga: A.riga, ferro: A.ferro, allegati: A.allegati, ddt: [], lettura: 'uscite', extra: A.extra, terziarie: A.terziarie });
verifica('nessun blocco', m.blocchi.length === 0, JSON.stringify(m.blocchi));
verifica('17 terziarie da aprire', m.terziarie_da_aprire === 17);
const righe = m.terziarie.righe.map(r => ({ terziaria: r.terziaria, allegato: r.allegato, peso_allegato_kg: r.peso_allegato_kg, cippato_kg: r.cippato_kg, ferro_kg: r.ferro_kg, totale_kg: r.totale_kg }));
verifica('le 17 righe al chilo', JSON.stringify(righe) === JSON.stringify(A.attese.terziarie), JSON.stringify(righe.slice(-2)));
verifica('i totali della tabella', m.terziarie.peso_allegati_kg === A.attese.totali.peso_allegati_kg && m.terziarie.cippato_kg === A.attese.totali.cippato_kg
  && m.terziarie.ferro_kg === A.attese.totali.ferro_kg && m.terziarie.totale_kg === A.attese.totali.totale_kg, JSON.stringify(m.terziarie).slice(0, 200));
verifica('l\'extra raccolta sulla terziaria dell\'allegato 36', m.extra && m.extra.terziaria === A.attese.extra.terziaria && m.extra.allegato === 36
  && m.extra.cippato_kg === 340 && m.extra.ferro_kg === 120 && m.extra.totale_kg === 460, JSON.stringify(m.extra));
verifica('rete 534.140, extra 460 a parte', m.rete_kg === A.attese.rete_kg && m.extra_kg === 460, `${m.rete_kg} ${m.extra_kg}`);
verifica('nessuna dichiarazione oltre 38.000', m.terziarie.righe.every(r => r.chiusura_portale_kg <= 38000));
verifica('rete + extra = uscite del registro', m.terziarie.cippato_kg + m.extra.cippato_kg === A.riga.uscite_cippato_kg && m.terziarie.ferro_kg + m.extra.ferro_kg === A.riga.uscite_ferro_kg);

console.log('LA REGOLA DEL 22/09: L\'EXTRA DENTRO L\'ULTIMA TERZIARIA, A PORTALE');
// «inserisci il valore dell'extra raccolta nell'ultima terziaria affinche' il
// totale dichiarato a portale sia 534.600 kg nel mese di agosto, ma lascia il
// rigo con la stessa terziaria per l'extra raccolta».
verifica('a portale 534.600', m.portale_kg === A.attese.portale_kg, String(m.portale_kg));
verifica('le terziarie a portale sommano 534.600', m.terziarie.chiusura_portale_kg === 534600 && m.terziarie.extra_kg === 460, `${m.terziarie.chiusura_portale_kg} ${m.terziarie.extra_kg}`);
const ultimaAgo = m.terziarie.righe[m.terziarie.righe.length - 1];
verifica('l\'ultima si chiude a 20.340: 19.880 di rete + 460 di extra', ultimaAgo.totale_kg === 19880 && ultimaAgo.extra_kg === 460 && ultimaAgo.chiusura_portale_kg === 20340
  && JSON.stringify(m.chiusura_ultima_terziaria) === JSON.stringify(A.attese.chiusura_ultima_terziaria), JSON.stringify(m.chiusura_ultima_terziaria));
verifica('le altre si chiudono col loro totale', m.terziarie.righe.slice(0, -1).every(r => r.extra_kg === 0 && r.chiusura_portale_kg === r.totale_kg));
verifica('la riga dell\'extra dice che sta nella chiusura di quella terziaria', m.extra.rete_terziaria_kg === 19880 && m.extra.chiusura_terziaria_kg === 20340
  && /TER26154141/.test(m.extra.nota) && /20\.340/.test(m.extra.nota), m.extra.nota);
verifica('i materiali a portale: 452.100 di ciabattato e 82.500 di ferro', m.materiali_portale.cippato_kg === 452100 && m.materiali_portale.metalli_kg === 82500 && m.materiali_portale.cssc_kg === 0, JSON.stringify(m.materiali_portale));
verifica('i materiali di rete fanno la rete', m.materiali.cippato_kg + m.materiali.metalli_kg + m.materiali.cssc_kg === m.rete_kg);

console.log('LA LETTURA DALLA GIACENZA AD AGOSTO: LE DUE LETTURE COINCIDONO');
// Giacenza di rete a portale a fine agosto, per fine trasporto (le secondarie con
// la fine trasporto della secondaria): 679.380 kg. Deve restare AD + AE = 144.780.
const g = componiMese({ criterio: 'ordine', riga: A.riga, ferro: A.ferro, allegati: A.allegati, lettura: 'giacenza', portaleFineMeseKg: A.portale_fine_mese_kg, extra: A.extra, terziarie: A.terziarie });
verifica('nessun blocco e nessun avviso', g.blocchi.length === 0 && g.avvisi.length === 0, JSON.stringify([g.blocchi, g.avvisi]));
verifica('a portale 679.380 - (144.780 + 0) = 534.600', g.letture.giacenza.totale_kg === 534600 && g.portale_kg === 534600, `${g.letture.giacenza.totale_kg} ${g.portale_kg}`);
verifica('di cui rete 534.140 ed extra 460', g.rete_kg === 534140 && g.extra_kg === 460 && g.letture.giacenza.rete_kg === 534140, `${g.rete_kg} ${g.extra_kg}`);
// Fino al 22/09/2026 la giacenza dava la sola rete e l'extra si aggiungeva
// sopra: 460 kg di scarto e 82.960 kg di ferro, piu' di quello uscito.
verifica('scarto fra le letture 0', g.letture.scarto_kg === 0 && g.letture.uscite.totale_kg === 534600, String(g.letture.scarto_kg));
verifica('ferro dichiarato 82.500 = X', g.terziarie.ferro_kg + g.extra.ferro_kg === 82500 && g.materiali_portale.metalli_kg === A.riga.uscite_ferro_kg && g.ferro.dichiarato_kg === 82500);
verifica('nessun avviso "supera quello uscito"', !g.avvisi.some(a => /supera quello uscito/.test(a)));
verifica('le terziarie come nella lettura dalle uscite', JSON.stringify(g.terziarie) === JSON.stringify(m.terziarie) && g.chiusura_ultima_terziaria.portale_kg === 20340);

console.log('LA REGOLA DEL 22/09: A PORTALE RESTANO AD + AE DEL MESE');
// Luglio 2026: gomma in giacenza AD92 = 381.860, ferro AE92 = 25.140; giacenza di
// rete a portale a fine luglio 809.740. Dichiarato davvero: 402.740.
const luglio = componiMese({ riga: { uscite_cippato_kg: 252040, uscite_ferro_kg: 126160, uscite_cssc_kg: 25000, giacenza_cssc_kg: 0, giacenza_cippato_kg: 344600, giacenza_intero_kg: 37260, giacenza_totale_kg: 381860, giacenza_ferro_kg: 25140 }, lettura: 'giacenza', portaleFineMeseKg: 809740 });
verifica('luglio: 809.740 - (381.860 + 25.140) = 402.740', luglio.letture.giacenza.totale_kg === 402740 && luglio.letture.giacenza.rete_kg === 402740 && luglio.letture.giacenza.resta_kg === 407000, String(luglio.letture.giacenza.totale_kg));
// Il CSS-C in giacenza (Z) non resta a portale: una volta prodotto non e' piu' rifiuto.
const conCssc = componiMese({ riga: { uscite_cippato_kg: 1, giacenza_cssc_kg: 25000, giacenza_totale_kg: 100000, giacenza_ferro_kg: 5000 }, lettura: 'giacenza', portaleFineMeseKg: 200000 });
verifica('il CSS-C in giacenza non conta', conCssc.letture.giacenza.resta_kg === 105000, String(conCssc.letture.giacenza.resta_kg));

console.log('UN MESE SENZA EXTRA RACCOLTA NON CAMBIA');
// Agosto senza l'extra: tutto e' rete, l'ultima terziaria prende 15.440 + 4.900 e
// si chiude col suo totale.
const senza = componiMese({ criterio: 'ordine', riga: A.riga, ferro: A.ferro, allegati: A.allegati, lettura: 'giacenza', portaleFineMeseKg: A.portale_fine_mese_kg, terziarie: A.terziarie });
const ultimaSenza = senza.terziarie.righe[senza.terziarie.righe.length - 1];
verifica('a portale = rete = 534.600, niente extra', senza.portale_kg === 534600 && senza.rete_kg === 534600 && senza.extra_kg === 0 && senza.extra === null, `${senza.portale_kg} ${senza.rete_kg}`);
verifica('l\'ultima si chiude col suo totale', ultimaSenza.cippato_kg === 15440 && ultimaSenza.ferro_kg === 4900 && ultimaSenza.totale_kg === 20340 && ultimaSenza.chiusura_portale_kg === 20340
  && senza.chiusura_ultima_terziaria.extra_kg === 0, JSON.stringify(senza.chiusura_ultima_terziaria));
verifica('le altre 16 come nel mese con l\'extra', JSON.stringify(senza.terziarie.righe.slice(0, -1)) === JSON.stringify(m.terziarie.righe.slice(0, -1)));
verifica('materiali di rete e a portale uguali', JSON.stringify(senza.materiali) === JSON.stringify(senza.materiali_portale));

console.log('L\'EXTRA SENZA NAVE RESTA IN IMPIANTO');
// Un mese di solo CSS-C con un'extra raccolta spuntata: non e' partita nessuna
// nave, l'extra non esce e non entra nei conti; nella giacenza resta in impianto.
const rigaCssc = { uscite_cssc_kg: 50000, uscite_ferro_kg: 20000, giacenza_totale_kg: 80000, giacenza_ferro_kg: 0 };
const ferroCssc = [{ destinatario: 'TRS', colore: 'FFC000', kg: 20000 }];
const ddtCssc = [{ ddt: '1', data: '2026-09-01', kg: 25000 }, { ddt: '2', data: '2026-09-02', kg: 25000 }];
const senzaNave = componiMese({ riga: rigaCssc, ferro: ferroCssc, ddt: ddtCssc, lettura: 'giacenza', portaleFineMeseKg: 149540, extra: { formulari: [], cippato_kg: 340, ferro_kg: 120 } });
verifica('nessuna extra dichiarata e lo dice', senzaNave.extra === null && senzaNave.extra_kg === 0 && senzaNave.avvisi.some(a => /nessuna nave/.test(a)), JSON.stringify(senzaNave.avvisi));
verifica('il ferro dei DDT resta quello uscito', senzaNave.cssc.ferro_kg === 20000 && senzaNave.portale_kg === 70000 && senzaNave.rete_kg === 70000, `${senzaNave.cssc.ferro_kg} ${senzaNave.portale_kg}`);
verifica('nella giacenza l\'extra resta in impianto', senzaNave.letture.giacenza.resta_kg === 80000 - 460 && senzaNave.letture.giacenza.extra_in_giacenza_kg === 460 && senzaNave.letture.giacenza.totale_kg === 149540 - 79540, JSON.stringify(senzaNave.letture.giacenza));

console.log('L\'EXTRA SENZA NAVE, REGISTRATA, SI RIPROPONE IL MESE DOPO');
// Correzione del 22/09/2026: la pratica salvava in extra_json i formulari spuntati
// nella pagina, anche quando componiMese li lasciava in impianto. Registrato il
// mese, dal mese dopo risultavano dichiarati e l'extra si perdeva.
const spuntata = { formulari: [{ id: 'x-set', formulario: 'AAAAA000001BB', peso_kg: 460, fine_trasporto: '2026-09-10' }], cippato_kg: 340, ferro_kg: 120 };
const settembre = componiMese({ riga: rigaCssc, ferro: ferroCssc, ddt: ddtCssc, lettura: 'giacenza', portaleFineMeseKg: 149540, extra: spuntata });
const salvataSet = extraDaSalvare(settembre, 0.26);
verifica('senza nave in extra_json non va nessun formulario, resta la ripartizione', settembre.extra === null && !salvataSet.formulari && salvataSet.quota_ferro === 0.26, JSON.stringify(salvataSet));
const registrataSet = { anno: 2026, mese: 'Settembre', stato: 'registrata', extra_json: JSON.stringify(salvataSet) };
verifica('a ottobre l\'extra si ripropone', !extraGiaDichiarate([registrataSet], { anno: 2026, mese: 'Ottobre' }).has('x-set'));
verifica('e nessuna dichiarazione di extra da scrivere', settembre.extra === null && extraDellePratiche([registrataSet]).size === 0);
// Con la nave, invece, i formulari restano nella pratica: agosto 2026, l'extra di luglio.
const extraLuglio = { ...A.extra, formulari: [{ ...A.extra.formulari[0], id: 'x-lug', fine_trasporto: '2026-07-21' }] };
const agostoConId = componiMese({ criterio: 'ordine', riga: A.riga, ferro: A.ferro, allegati: A.allegati, lettura: 'uscite', extra: extraLuglio, terziarie: A.terziarie });
const agostoReg = { anno: 2026, mese: 'Agosto', stato: 'registrata', extra_json: JSON.stringify(extraDaSalvare(agostoConId, 0.26)) };
verifica('con la nave l\'extra resta nella pratica e a settembre non si ripropone', extraGiaDichiarate([agostoReg], { anno: 2026, mese: 'Settembre' }).has('x-lug')
  && JSON.parse(agostoReg.extra_json).cippato_kg === 340 && JSON.parse(agostoReg.extra_json).ferro_kg === 120);
verifica('rifacendo agosto si ripropone', !extraGiaDichiarate([agostoReg], { anno: 2026, mese: 'Agosto' }).has('x-lug'));
verifica('una pratica in preparazione non dichiara niente', !extraGiaDichiarate([{ ...agostoReg, stato: 'in_preparazione' }], { anno: 2026, mese: 'Settembre' }).has('x-lug'));

console.log('LE DATE OBBLIGATORIE DEI FORMULARI DELL\'EXTRA');
// Regola dell'utente del 22/09/2026: immissione, inizio e fine trasporto sono
// obbligatorie. Un formulario con la fine ma senza inizio trasporto resta nella
// pratica (l'extra e' partita) ma si segnala negli avvisi e accanto ai documenti.
const senzaInizio = { stato: 'terminato', ordine_immesso_il: '2026-07-01T08:00:00Z', trasporto_finito_il: '2026-07-21T10:00:00Z' };
const extraSenzaInizio = { ...A.extra, formulari: [{ ...A.extra.formulari[0], date_da_sistemare: dateDaSistemare(senzaInizio) ? testoDate(senzaInizio) : '' }] };
const conDate = componiMese({ criterio: 'ordine', riga: A.riga, ferro: A.ferro, allegati: A.allegati, lettura: 'uscite', extra: extraSenzaInizio, terziarie: A.terziarie });
verifica('si segnala negli avvisi e nel passo dei documenti', conDate.avvisi.some(a => /BSDCL002230PQ/.test(a) && /manca la data di inizio trasporto/.test(a)) && conDate.extra.avvisi_date.length === 1, JSON.stringify(conDate.avvisi));
verifica('e resta nella pratica: 534.600 a portale, 460 di extra', conDate.portale_kg === 534600 && conDate.extra_kg === 460 && conDate.blocchi.length === 0);
verifica('con le date a posto nessun avviso', m.extra.avvisi_date.length === 0);

console.log('IL CAMBIO D\'ANNO');
// L'extra arrivata a dicembre 2026 e partita con la nave di gennaio 2027 si
// propone nella pratica di gennaio e si scrive su dicembre 2026.
const fGen = finestraExtra({ anno: 2027, meseIdx: 0, annoPrimaConPratica: true });
verifica('a gennaio 2027 si propone l\'extra di dicembre 2026', fGen.da === '2026-01-01' && fGen.a === '2027-01-31' && '2026-12-15' >= fGen.da && '2026-12-15' <= fGen.a, JSON.stringify(fGen));
const fAgo = finestraExtra({ anno: 2026, meseIdx: 7, annoPrimaConPratica: false });
verifica('senza pratiche registrate nell\'anno prima si parte dal primo gennaio', fAgo.da === '2026-01-01' && fAgo.a === '2026-08-31' && !('2025-12-15' >= fAgo.da), JSON.stringify(fAgo));
verifica('senza mese scelto tutto l\'anno', finestraExtra({ anno: 2026 }).a === '2026-12-31');
const dicembre = { anno: 2026, mese: 'Dicembre', stato: 'registrata', extra_json: JSON.stringify({ quota_ferro: 0.26 }) };
const giaGen = extraGiaDichiarate([agostoReg, dicembre], { anno: 2027, mese: 'Gennaio' });
verifica('le pratiche dell\'anno prima contano', giaGen.has('x-lug') && !giaGen.has('x-dic'));
verifica('il gennaio 2026 non si confonde col gennaio 2027', extraGiaDichiarate([{ ...agostoReg, mese: 'Gennaio' }], { anno: 2027, mese: 'Gennaio' }).has('x-lug'));
const extraDic = { formulari: [{ id: 'x-dic', peso_kg: 500, fine_trasporto: '2026-12-15' }], cippato_kg: 370, ferro_kg: 130 };
const scrittaDic = dichiarazioniExtra(extraDic, [agostoReg, dicembre], { anno: 2027, mese: 'Gennaio' });
verifica('si scrive su dicembre 2026, non su gennaio 2027', JSON.stringify(scrittaDic) === JSON.stringify([{ anno: 2026, mese: 'Dicembre', quantita_kg: 500, cippato_kg: 370, metalli_kg: 130, questa_kg: 500, altre_kg: 0 }]), JSON.stringify(scrittaDic));

console.log('L\'EXTRA DI UN MESE IN PIU\' PRATICHE');
// Luglio 2026: 460 kg con la nave di agosto, altri 200 con quella di settembre.
// Si scriveva la sola parte dell'ultima pratica: luglio sarebbe sceso a 200.
const extraLuglio2 = { formulari: [{ id: 'x-lug2', peso_kg: 200, fine_trasporto: '2026-07-28' }], cippato_kg: 150, ferro_kg: 50 };
const scrittaSet = dichiarazioniExtra(extraLuglio2, [agostoReg], { anno: 2026, mese: 'Settembre' });
verifica('luglio vale 460 + 200', scrittaSet.length === 1 && scrittaSet[0].quantita_kg === 660 && scrittaSet[0].cippato_kg === 490 && scrittaSet[0].metalli_kg === 170 && scrittaSet[0].altre_kg === 460, JSON.stringify(scrittaSet));
const rifatta = dichiarazioniExtra(agostoConId.extra, [agostoReg], { anno: 2026, mese: 'Agosto' });
verifica('rifacendo agosto non si conta due volte', rifatta.length === 1 && rifatta[0].mese === 'Luglio' && rifatta[0].quantita_kg === 460 && rifatta[0].altre_kg === 0, JSON.stringify(rifatta));
verifica('quanto hanno scritto le pratiche, per "dichiarata a mano"', extraDellePratiche([agostoReg]).get('2026|Luglio').pfu_kg === 460);
const dueMesi = extraPerMese({ formulari: [{ peso_kg: 300, fine_trasporto: '2026-06-30' }, { peso_kg: 160, fine_trasporto: '2026-07-02' }, { peso_kg: 99 }], ferro_kg: 120 });
verifica('ferro in proporzione al peso, l\'ultimo mese col resto; senza fine trasporto fuori', dueMesi.length === 2 && dueMesi[0].ferro_kg === 78 && dueMesi[1].ferro_kg === 42
  && dueMesi[0].cippato_kg === 222 && dueMesi[1].cippato_kg === 118, JSON.stringify(dueMesi));

console.log('LA FRASE FISSA DELL\'EXTRA COMPRESA NELLA RETE');
// Finche' DichiarazioneSito non ha un campo, la nota della rete di Irigom dice in
// fondo quanta extra c'e' dentro la quantita'; vale l'ultima frase.
verifica('la frase', testoExtraCompresa(460) === '[extra compresa: 460 kg]' && testoExtraCompresa(1460) === '[extra compresa: 1.460 kg]');
verifica('si rilegge, e vale l\'ultima', extraCompresaDaNota(`A portale 534.600 kg. ${testoExtraCompresa(460)}\nPrima: 534.600 kg.\nA portale 534.140 kg, tutti di rete. ${testoExtraCompresa(0)}`) === 0
  && extraCompresaDaNota(`x ${testoExtraCompresa(1460)}`) === 1460 && extraCompresaDaNota('nota di prima del 22/09') === null);

console.log('I MESI SENZA NAVE');
const soloCssc = componiMese({ riga: { uscite_cssc_kg: 50000, uscite_ferro_kg: 84100, giacenza_cippato_kg: 1, giacenza_intero_kg: 0 }, ferro: [{ destinatario: 'TRS', colore: 'FFC000', kg: 84100 }], ddt: [{ ddt: '15', data: '2026-01-08', kg: 25000 }, { ddt: '22', data: '2026-01-13', kg: 25000 }], lettura: 'uscite' });
verifica('il ferro che non entra nei DDT resta in giacenza: nessuna dichiarazione di soli metalli', soloCssc.solo_ferro.length === 0 && soloCssc.rete_kg === 50000 + 26000, `${soloCssc.solo_ferro.length} ${soloCssc.rete_kg}`);
verifica('e lo dice', soloCssc.avvisi.some(a => /restano in giacenza/.test(a)));
const soloFerro = componiMese({ riga: { uscite_ferro_kg: 89780, giacenza_cippato_kg: 5000, giacenza_intero_kg: 1000 }, ferro: [{ destinatario: 'TRS', colore: 'FFC000', kg: 89780 }], lettura: 'uscite' });
verifica('aprile: solo metalli, a portale non si carica nulla', soloFerro.rete_kg === 0 && soloFerro.avvisi.some(a => /solo metalli/.test(a)), String(soloFerro.rete_kg));
verifica('aprile si segna come solo metalli ferrosi', soloFerro.solo_metalli === true && m.solo_metalli === false && soloCssc.solo_metalli === false);

console.log('IL FERRO IN ECCESSO SI DIVIDE');
// Due terziarie piene e due con posto: i 4.000 kg di ferro che le prime non
// reggono vanno meta' e meta' alle altre due, non tutti sull'ultima.
const piene = componiMese({ riga: { uscite_cippato_kg: 100000, uscite_ferro_kg: 40000, giacenza_cippato_kg: 1, giacenza_intero_kg: 0 }, ferro: [{ destinatario: 'TRS', colore: 'FFC000', kg: 40000 }],
  allegati: [{ numero: 1, trasportatore: 'SMOCO', kg: 30000 }, { numero: 2, trasportatore: 'SMOCO', kg: 30000 }, { numero: 3, trasportatore: 'SMOCO', kg: 20000 }, { numero: 4, trasportatore: 'SMOCO', kg: 20000 }], lettura: 'uscite' });
verifica("l'eccesso si divide fra chi ha posto", JSON.stringify(piene.terziarie.righe.map(r => r.ferro_kg)) === JSON.stringify([8000, 8000, 12000, 12000]) && piene.terziarie.righe.every(r => r.totale_kg <= 38000), JSON.stringify(piene.terziarie.righe.map(r => [r.cippato_kg, r.ferro_kg])));

console.log('I CASI DI CONFINE');
verifica('extra divisa come ad agosto', JSON.stringify(dividiExtra(460)) === JSON.stringify({ pfu_kg: 460, cippato_kg: 340, ferro_kg: 120 }));
const r = ripartisciFerro([{ base_kg: 30000 }, { base_kg: 20000 }], 20000);
verifica('chi supererebbe 38.000 cede il ferro agli altri', r.ferro[0] === 8000 && r.ferro[1] === 12000 && r.avanza_kg === 0, JSON.stringify(r));
const vuoto = componiMese({ riga: {}, ferro: [], allegati: [] });
verifica('un mese non compilato non si dichiara', vuoto.vuoto && vuoto.blocchi.length === 1);
const cssc = componiMese({ riga: { uscite_cssc_kg: 50000, uscite_ferro_kg: 20000, giacenza_cippato_kg: 0, giacenza_intero_kg: 0 }, ferro: [{ destinatario: 'TRS', colore: 'FFC000', kg: 20000 }], ddt: [{ ddt: '1', data: '2026-09-01', kg: 25000 }, { ddt: '2', data: '2026-09-02', kg: 25000 }], lettura: 'uscite' });
verifica('solo CSS-C: il ferro si divide fra i DDT', cssc.cssc.righe.map(x => x.ferro_kg).join() === '10000,10000' && cssc.rete_kg === 70000, JSON.stringify(cssc.cssc.righe.map(x => x.ferro_kg)));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
