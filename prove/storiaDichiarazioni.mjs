// LA STORIA DI UNA RIGA DEL RIEPILOGO DELLE DICHIARAZIONI (12/10/2026).
//
// Richiesta dell'utente sul Riepilogo di Dichiarazioni Impianti, dopo il caso
// T-Cycle: a marzo si sono dichiarati 146.860 kg, cioe' gennaio e febbraio, «ma
// risulta nulla in giacenza», e «a marzo risultano 20.620 kg che mancano dai
// conteggi»; pensava fossero lo stoccaggio. Il report del portale dice altro: la
// dichiarazione del 03/04 ha coperto gennaio 87,74 + febbraio 36,42 + 22,70 t di
// marzo, quella del 26/06 le 20,62 t rimaste di marzo + aprile + maggio + 77,60
// t di giugno; lo stoccaggio (249,06 t) e' ripartito tutto verso Tecnogum e non
// e' mai entrato nella riga dell'impianto. E poi: «metti la giacenza di cio' che
// resta dopo la dichiarazione... rendi visibile il quadro della situazione anche
// a chi vede per la prima volta questo gestionale».
//
// Qui si prova che il riepilogo lo dice, dai numeri e senza toccarne nessuno:
// 1. la giacenza a fine mese (T-Cycle rete 2026: 87,74 / 124,16 / 20,62 / 66,90 /
//    118,18 / 41,98 / 150,66 / 199,08 / 323,88 / 364,80);
// 2. gli agganci di ogni dichiarazione, anche presa dal portale in due giorni
//    (Irigom, febbraio: 547.260 kg l'11/03 e 174.400 il 12/03);
// 3. lo stoccaggio dello stesso sito e dove si dichiara (Tecnogum non dichiara:
//    il portale tiene 181,299 t in attesa sullo stoccaggio di T-Cycle);
// 4. il racconto della riga, e le parole al tocco della pagina;
// 5. sui dati veri (../dati-veri/, se c'e'): i numeri del caso T-Cycle, la
//    giacenza dell'ultimo mese uguale al «Da dichiarare» e alle Giacenze su ogni
//    impianto e canale, i mesi aperti della fotografia uguali alla colonna, e la
//    risposta di oggi identica a quella di HEAD tolti i campi nuovi;
// 6. la pagina disegnata e il foglio Excel sui dati veri;
// 7. le correzioni della revisione del 13/10/2026 (sezione R sui numeri
//    costruiti, sezione 10 sui dati veri): una copertura sola per casella (la
//    tendina, il dialogo e la scheda Impianti dicono quello che dice la «i»:
//    Irigom febbraio 721,66 t, non 174,40), la giacenza a fine mese dell'ACI
//    chiusa sul canale come il «Da dichiarare», il racconto che cita le Giacenze
//    col numero del canale quando le righe sono due, l'attesa del portale di un
//    altro anno sui soli carichi di quell'anno (seconda revisione: prima era
//    null), la «i» sotto la colonna ferma, i testi del guardiano. Lo
//    spostamento che rientra e l'attesa per anno hanno le loro prove:
//    prove/spostamentoCheRientra.mjs e prove/attesaDellAnno.mjs.
// npm run prove
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveObjectURL } from 'node:buffer';
import * as STORIA from '../base44/shared/storiaDichiarazioni.ts';
import { allineaAllaGiacenza, chiudiFraIFlussi } from '../base44/shared/usciteDichiarate.ts';
import { fotografiaDelGiorno, leggiFotografia } from '../base44/shared/indicatoriGiorno.ts';
import { MESI } from '../base44/shared/dichiarazioniImpianti.ts';
import { caricaLibPagine } from './dati/libPagine.mjs';

const { giacenzaAFineMese, abbinaCaricamenti, agganciDellaRiga, stoccaggioDelSito, raccontoDellaRiga } = STORIA;
// Le funzioni della revisione del 13/10/2026: se mancano la sezione 10 lo dice
// verifica per verifica, invece di fermarsi all'import.
const manca = (nome) => () => { throw new Error(`${nome} non c'e'`); };
const giacenzaAFineMeseDelCanale = STORIA.giacenzaAFineMeseDelCanale || manca('giacenzaAFineMeseDelCanale');
const copreDellaColonna = STORIA.copreDellaColonna || manca('copreDellaColonna');
const prova = (f) => { try { return f(); } catch (e) { return { errore: String(e && e.message) }; } };

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const sorgente = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');
const zeri = () => new Array(12).fill(0);
const dodici = (pezzi) => { const a = zeri(); for (const [i, v] of Object.entries(pezzi)) a[Number(i)] = v; return a; };

// T-CYCLE, RETE, 2026: i numeri veri dell'11/10/2026.
const CONFERITO = [87740, 36420, 43320, 46280, 51280, 119580, 108680, 48420, 124800, 40920, 0, 0];
const CARICATO = dodici({ 2: 146860, 5: 195780 });
const RESTA = dodici({ 5: 41980, 6: 108680, 7: 48420, 8: 124800, 9: 40920 });
const CARICAMENTI = [
  { giorno: '2025-07-02', kg: 256680, prima_kg: 256680, mesi: zeri() },
  { giorno: '2025-10-24', kg: 157054, prima_kg: 157054, mesi: zeri() },
  { giorno: '2026-01-09', kg: 320566, prima_kg: 320566, mesi: zeri() },
  { giorno: '2026-04-03', kg: 146860, prima_kg: 0, mesi: dodici({ 0: 87740, 1: 36420, 2: 22700 }) },
  { giorno: '2026-06-26', kg: 195780, prima_kg: 0, mesi: dodici({ 2: 20620, 3: 46280, 4: 51280, 5: 77600 }) },
];
const DICHIARAZIONI = [{ idx: 2, giorno: '2026-04-03', kg: 146860 }, { idx: 5, giorno: '2026-06-26', kg: 195780 }];
const FINE_TCYCLE = [87740, 124160, 20620, 66900, 118180, 41980, 150660, 199080, 323880, 364800, null, null];

console.log('1. LA GIACENZA A FINE MESE');
{
  const g = giacenzaAFineMese({ partenzaKg: 0, conferito: CONFERITO, caricato: CARICATO, ultimoMese: 9 });
  verifica('T-Cycle rete: 87,74 / 124,16 / 20,62 dopo la dichiarazione di marzo / ... / 364,80 a ottobre', J(g) === J(FINE_TCYCLE), J(g));
  verifica("l'ultimo mese e' la giacenza: entrato meno caricato", g[9] === CONFERITO.reduce((s, x) => s + x, 0) - CARICATO.reduce((s, x) => s + x, 0));
  verifica('dopo il mese di oggi non c\'e\' una fine mese: null, non zero', g[10] === null && g[11] === null);
  const conApertura = giacenzaAFineMese({ partenzaKg: 385360, conferito: dodici({ 0: 375000 }), caricato: dodici({ 0: 67180 }), ultimoMese: 0 });
  verifica("la casella dall'anno prima e' il punto di partenza (Irigom: 385,36 + 375,00 - 67,18)", conApertura[0] === 693180, J(conApertura));
}

console.log('2. GLI AGGANCI DI OGNI DICHIARAZIONE');
{
  const { per } = abbinaCaricamenti(CARICAMENTI, DICHIARAZIONI);
  const marzo = per.get(2);
  verifica('la dichiarazione di marzo si riconosce dal giorno del caricamento', marzo && J(marzo.giorni) === J(['2026-04-03']) && marzo.kg === 146860 && !marzo.parziale, J(marzo));
  verifica('e ha coperto gennaio 87.740, febbraio 36.420 e 22.700 di marzo', marzo && J(marzo.mesi.slice(0, 3)) === J([87740, 36420, 22700]));
  // IRIGOM, FEBBRAIO: il portale l'ha presa in due giorni. copertureDelCaricamento
  // guardava il solo 12/03 e ne vedeva 174.400 kg su 721.660.
  const irigom = [
    { giorno: '2026-02-19', kg: 403300, prima_kg: 403300, mesi: zeri() },
    { giorno: '2026-03-10', kg: 67180, prima_kg: 67180, mesi: zeri() },
    { giorno: '2026-03-11', kg: 547260, prima_kg: 318180, mesi: dodici({ 0: 229080 }) },
    { giorno: '2026-03-12', kg: 174400, prima_kg: 0, mesi: dodici({ 0: 145920, 1: 28480 }) },
  ];
  const ir = abbinaCaricamenti(irigom, [{ idx: 0, giorno: '2026-03-10', kg: 67180 }, { idx: 1, giorno: '2026-03-12', kg: 721660 }]).per;
  const feb = ir.get(1);
  verifica('Irigom febbraio: 721.660 kg = 547.260 l\'11/03 + 174.400 il 12/03, non un quarto', feb && feb.kg === 721660 && J(feb.giorni) === J(['2026-03-11', '2026-03-12']) && feb.prima_kg === 318180 && feb.mesi[0] === 375000 && feb.mesi[1] === 28480, J(feb));
  verifica('e il caricamento del 19/02, che non e\' nostro, non entra in nessuna', !ir.get(0).giorni.includes('2026-02-19') && !feb.giorni.includes('2026-02-19'));
  // Senza il giorno giusto vale il peso al chilo, se e' uno solo; senza niente si tace.
  const peso = abbinaCaricamenti(CARICAMENTI, [{ idx: 2, giorno: '2026-04-10', kg: 146861 }]).per.get(2);
  verifica('un giorno sbagliato si ritrova dal peso, con la tolleranza di 2 kg', peso && peso.giorni[0] === '2026-04-03', J(peso));
  verifica('una dichiarazione che il report non ha non si inventa', !abbinaCaricamenti(CARICAMENTI, [{ idx: 8, giorno: '2026-10-05', kg: 50000 }]).per.has(8));
  // Due nostre dichiarazioni caricate lo stesso giorno: il report le ha in un caricamento solo.
  const insieme = abbinaCaricamenti([{ giorno: '2026-05-04', kg: 30000, prima_kg: 0, mesi: dodici({ 2: 10000, 3: 20000 }) }], [{ idx: 2, giorno: '2026-05-04', kg: 10000 }, { idx: 3, giorno: '2026-05-04', kg: 20000 }]).per;
  verifica('due dichiarazioni caricate lo stesso giorno si dicono insieme', insieme.get(2) && J(insieme.get(2).insieme) === J([2, 3]) && insieme.get(3) === insieme.get(2));

  const a = agganciDellaRiga({ caricamenti: CARICAMENTI, dichiarazioni: DICHIARAZIONI, anno: 2026, lettaIl: '2025-12-31' });
  verifica('la colonna di marzo: 146,86 t = gen 87,74 + feb 36,42 + mar 22,70', a.delMese[2] && J(a.delMese[2].mesi) === J([{ mese: 'Gennaio', kg: 87740 }, { mese: 'Febbraio', kg: 36420 }, { mese: 'Marzo', kg: 22700 }]), J(a.delMese[2]));
  verifica('marzo e\' coperto in due volte: 22,70 dalla dichiarazione di marzo, 20,62 da quella di giugno',
    J(a.copertoDa[2]) === J([{ mese: 'Marzo', giorni: ['2026-04-03'], kg: 22700 }, { mese: 'Giugno', giorni: ['2026-06-26'], kg: 20620 }]), J(a.copertoDa[2]));
  verifica('gennaio dalla sola dichiarazione di marzo', J(a.copertoDa[0]) === J([{ mese: 'Marzo', giorni: ['2026-04-03'], kg: 87740 }]));
  verifica('il caricamento del 09/01/2026 (320,566 t su carichi degli anni prima) qui non e\' una dichiarazione del 2026', J(a.altri) === J([{ giorno: '2026-01-09', kg: 320566, prima_kg: 320566, anno_kg: 0 }]), J(a.altri));
  verifica('e i caricamenti del 2025 non sono «altri» del 2026', !a.altri.some(c => c.giorno.startsWith('2025')));
}

console.log('3. LO STOCCAGGIO DELLO STESSO SITO');
const STOC = stoccaggioDelSito({
  sito: 'T-CYCLE INDUSTRIES SRL', canale: 'RETE',
  entrato: [17960, 60400, 58580, 62040, 50080, 0, 0, 0, 0, 0, 0, 0],
  uscito: [14040, 57500, 65120, 56000, 56400, 0, 0, 0, 0, 0, 0, 0],
  verso: [{ impianto: 'TECNOGUM SRL', chiave: 'tecnogum', kg: 249060, dichiara: false, mesi_kg: [14040, 57500, 65120, 56000, 56400, 0, 0, 0, 0, 0, 0, 0] }],
  inPiazzaleT: 0, inAttesaT: 181.299, fotoIl: '2026-10-09',
});
{
  verifica('entrato in stoccaggio: 249,06 t, da gennaio a maggio', STOC && STOC.entrato_kg.reduce((s, x) => s + x, 0) === 249060 && STOC.entrato_t === 249.06, J(STOC && STOC.entrato_kg));
  verifica('ripartito tutto verso Tecnogum, mese per mese', STOC && STOC.verso.length === 1 && STOC.verso[0].mesi_kg.reduce((s, x) => s + x, 0) === 249060 && STOC.verso[0].dichiara === false);
  verifica("la frase dice dove si dichiara: l'impianto che lo riceve", STOC && /li dichiara l'impianto che li riceve, nella sua riga, nel mese in cui arrivano/.test(STOC.frasi[0]), STOC && STOC.frasi[0]);
  verifica('e che cosa dice il portale di quello che Tecnogum non dichiara: 181,299 t in attesa, col giorno del file',
    STOC && STOC.frasi.some(f => /TECNOGUM SRL sulla rete non ci dichiara, per accordo/.test(f) && /09\/10\/2026/.test(f) && /181,299 t allo stoccaggio di T-CYCLE INDUSTRIES SRL/.test(f)), J(STOC && STOC.frasi));
  verifica('un sito che nell\'anno non ha mosso niente in stoccaggio non ha righe', stoccaggioDelSito({ sito: 'X', canale: 'RETE', entrato: zeri(), uscito: zeri() }) === null);
}

console.log('4. IL RACCONTO DELLA RIGA');
const mesiDi = (conferito, caricato, resta, caricataIl = {}) => MESI.map((mese, i) => ({
  mese, conferito_kg: conferito[i], caricato_kg: caricato[i], resta_kg: resta[i], uscito_kg: conferito[i] - resta[i], da_stoccaggi: [],
  dichiarazione: caricato[i] ? { quantita_kg: caricato[i], caricata_inviata: true, caricata_il: caricataIl[i] || '' } : null,
}));
const RACCONTO = raccontoDellaRiga({
  anno: 2026, sito: 'T-CYCLE INDUSTRIES SRL', canale: 'RETE', provenienza: '', operazione: 'R1',
  mesi: mesiDi(CONFERITO, CARICATO, RESTA, { 2: '2026-04-03', 5: '2026-06-26' }),
  dall_anno_prima: { conferito_kg: 0, uscito_kg: 0, resta_kg: 0, al: '2025-12-31' },
  giacenza_fine_mese: FINE_TCYCLE, ultimo_mese: 9,
  agganci: agganciDellaRiga({ caricamenti: CARICAMENTI, dichiarazioni: DICHIARAZIONI, anno: 2026, lettaIl: '2025-12-31' }),
  stoccaggio: STOC,
});
{
  const tutto = RACCONTO.join(' ');
  const ha = (re) => RACCONTO.some(f => re.test(f));
  verifica('da quando riceve, in impianto', ha(/^Nel 2026 T-CYCLE INDUSTRIES SRL riceve in impianto PFU della rete da gennaio: 707,44 t fino a ottobre\.$/), RACCONTO[0]);
  verifica('fino a quando ha avuto anche lo stoccaggio, e a che cosa serviva', ha(/^Fino a maggio T-CYCLE INDUSTRIES SRL ha ricevuto i PFU in due modi: in impianto, per il trattamento e le uscite su nave, e in stoccaggio, tal quali, per mandarli a un altro impianto; da giugno solo in impianto\.$/), tutto);
  verifica('lo stoccaggio, dove e\' ripartito, e che qui non si dichiara', ha(/^Lo stoccaggio, 249,06 t, è ripartito tutto in secondaria verso TECNOGUM SRL: non entra in questa riga e qui non si dichiara/), tutto);
  verifica('la dichiarazione di marzo: il giorno, quanto, quali mesi, e la regola del portale',
    ha(/^La dichiarazione di marzo, caricata il 03\/04\/2026, ha coperto 146,86 t: gennaio, febbraio e 22,70 t di marzo, perché il portale copre sempre prima i carichi più vecchi ancora aperti\.$/), tutto);
  verifica('che cosa e\' rimasto dopo, e chi l\'ha coperto poi: le 20,62 t di marzo', ha(/^Sono rimaste in giacenza 20,62 t di marzo, non ancora uscite su nave, coperte poi dalla dichiarazione di giugno\.$/), tutto);
  verifica('la dichiarazione di giugno: le 20,62 t rimaste di marzo, aprile, maggio e 77,60 t di giugno',
    ha(/^La dichiarazione di giugno, caricata il 26\/06\/2026, ha coperto 195,78 t: le 20,62 t rimaste di marzo, aprile, maggio e 77,60 t di giugno\.$/), tutto);
  verifica('dopo giugno: 41,98 t di giugno, ancora li\'', ha(/^Sono rimaste in giacenza 41,98 t di giugno, non ancora uscite su nave\.$/), tutto);
  verifica('il caricamento del portale che qui non e\' una dichiarazione si dice, al singolare', ha(/^Nel report del portale c'è anche un caricamento del 2026 che qui non è fra le dichiarazioni \(il 09\/01\/2026 320,566 t\): copre carichi arrivati prima del 2026 e non tocca i mesi di quest'anno\.$/), tutto);
  verifica('oggi: 364,80 t, cioe\' 41,98 di giugno e quello che e\' arrivato da luglio a ottobre, la giacenza',
    ha(/^Oggi restano da dichiarare 364,80 t: 41,98 t di giugno e quello che è arrivato da luglio a ottobre \(322,82 t\)\. È la giacenza a fine ottobre, lo stesso numero della colonna «Da dichiarare» e delle Giacenze\.$/), tutto);
  verifica('nessun numero mancante scritto come parola', !/NaN|undefined|null/.test(tutto), tutto);
  verifica('ogni frase finisce col suo punto, uno solo', RACCONTO.every(f => /[.:]$/.test(f) && !/\.\.$/.test(f)), J(RACCONTO));
  // L'ACI non si aggancia, e lo dice; la rete non dovuta non ha giacenza da raccontare.
  const aci = raccontoDellaRiga({ anno: 2026, sito: 'Gatim', canale: 'ACI', provenienza: 'secondaria', mesi: mesiDi(dodici({ 0: 11900 }), dodici({ 0: 11900 }), zeri(), { 0: '2026-09-21' }), giacenza_fine_mese: dodici({}), ultimo_mese: 9 });
  verifica("l'ACI: ogni dichiarazione vale per il suo mese e la sua provenienza", aci.some(f => /^Sull'ACI il portale non pubblica agganci: ogni dichiarazione vale per il suo mese e per la sua provenienza \(qui la secondaria\)\.$/.test(f)), J(aci));
  const tecnogum = raccontoDellaRiga({ anno: 2026, sito: 'TECNOGUM SRL', canale: 'RETE', non_dovuta: true, mesi: mesiDi(dodici({ 0: 1000 }), zeri(), dodici({ 0: 1000 })), giacenza_fine_mese: new Array(12).fill(null), ultimo_mese: 9 });
  verifica('la rete non dovuta: niente da dichiarare, col perche\'', tecnogum.some(f => /^Per accordo TECNOGUM SRL non ci dichiara la rete/.test(f)) && !tecnogum.some(f => /Oggi restano/.test(f)), J(tecnogum));
  // Chi dichiara mese per mese non ha bisogno di dodici frasi.
  const gatim = raccontoDellaRiga({ anno: 2026, sito: 'Gatim', canale: 'RETE', operazione: 'R3',
    mesi: mesiDi(dodici({ 0: 78430, 1: 74240, 5: 112240 }), dodici({ 0: 78430, 1: 74240 }), dodici({ 5: 112240 }), { 0: '2026-03-12', 1: '2026-04-01' }),
    giacenza_fine_mese: [0, 0, 0, 0, 0, 112240, 112240, 112240, 112240, 112240, null, null], ultimo_mese: 9,
    agganci: agganciDellaRiga({ caricamenti: [{ giorno: '2026-03-12', kg: 78430, prima_kg: 0, mesi: dodici({ 0: 78430 }) }, { giorno: '2026-04-01', kg: 74240, prima_kg: 0, mesi: dodici({ 1: 74240 }) }], dichiarazioni: [{ idx: 0, giorno: '2026-03-12', kg: 78430 }, { idx: 1, giorno: '2026-04-01', kg: 74240 }], anno: 2026 }) });
  verifica('chi dichiara mese per mese: una frase sola per tutte', gatim.some(f => f === 'Le dichiarazioni di gennaio e febbraio hanno coperto ciascuna tutto il suo mese (caricate fra il 12/03/2026 e l\'01/04/2026).') && gatim.some(f => /^Oggi restano da dichiarare 112,24 t: tutto giugno \(112,24 t\)/.test(f)), J(gatim));
}

console.log('5. LE PAROLE DELLA PAGINA, AL TOCCO');
const S = await caricaLibPagine('lib/storiaRiepilogo');
{
  const a = agganciDellaRiga({ caricamenti: CARICAMENTI, dichiarazioni: DICHIARAZIONI, anno: 2026, lettaIl: '2025-12-31' });
  const marzo = { mese: 'Marzo', conferito_kg: 43320, caricato_kg: 146860, giacenza_fine_kg: 20620, dichiarazione_copre: a.delMese[2], coperto_da: a.copertoDa[2] };
  verifica('la somma della dichiarazione: «146,86 t = gen 87,74 + feb 36,42 + mar 22,70»', S.sommaCopertura(marzo.dichiarazione_copre) === '146,86 t = gen 87,74 + feb 36,42 + mar 22,70', S.sommaCopertura(marzo.dichiarazione_copre));
  const p = S.percheCasella(marzo);
  verifica('al tocco su marzo: la dichiarazione, i suoi agganci e il giorno', p[0] === 'Dichiarazione di marzo, caricata a portale il 03/04/2026: 146,86 t = gen 87,74 + feb 36,42 + mar 22,70.', J(p));
  verifica('e la nota del mese coperto in due volte: «20,62 t di marzo coperte dalla dichiarazione di giugno»', p.includes('20,62 t di marzo coperte dalla dichiarazione di giugno (26/06/2026).') && p.includes('Marzo è stato coperto in due volte:'), J(p));
  verifica('e quanto restava a fine marzo', p.includes('A fine marzo restavano in giacenza 20,62 t.'), J(p));
  verifica('marzo ha la «i» nell\'angolo, e anche gennaio (coperto da marzo)', S.casellaDaSpiegare(marzo) && S.casellaDaSpiegare({ mese: 'Gennaio', conferito_kg: 87740, coperto_da: a.copertoDa[0] }));
  verifica('un mese di Gatim, dichiarato da se\' e tutto, no: la casella resta pulita',
    !S.casellaDaSpiegare({ mese: 'Gennaio', conferito_kg: 78430, caricato_kg: 78430, dichiarazione_copre: { giorni: ['2026-03-12'], kg: 78430, prima_kg: 0, mesi: [{ mese: 'Gennaio', kg: 78430 }] }, coperto_da: [{ mese: 'Gennaio', giorni: ['2026-03-12'], kg: 78430 }] }));
  verifica('due giorni si dicono tutti e due', S.percheCasella({ mese: 'Febbraio', conferito_kg: 361880, caricato_kg: 721660, dichiarazione_copre: { giorni: ['2026-03-11', '2026-03-12'], kg: 721660, prima_kg: 318180, mesi: [{ mese: 'Gennaio', kg: 375000 }, { mese: 'Febbraio', kg: 28480 }] } })[0]
    === 'Dichiarazione di febbraio, caricata a portale in due volte, 11/03/2026 e 12/03/2026: 721,66 t = anni prima 318,18 + gen 375,00 + feb 28,48.');
  const r = sorgente('src/components/dichiarazioni/Riepilogo.jsx');
  const st = sorgente('src/components/dichiarazioni/StoriaRiga.jsx');
  verifica('il riepilogo ha il racconto, la «i» nelle caselle, la giacenza a fine mese e lo stoccaggio',
    r.includes('<RaccontoRiga frasi={flusso.racconto}') && r.includes('<AngoloPerche mese={m} />') && r.includes('<RigaGiacenzaFineMese flusso={flusso}') && r.includes('<RigheStoccaggio stoccaggio={flusso.stoccaggio_stesso_sito}'));
  const senzaCommenti = st.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  verifica('al tocco, non col passaggio del mouse: nessun title= nei pezzi nuovi', !/\btitle=/.test(senzaCommenti));
  verifica('e il riquadro scorre invece di uscire dallo schermo a 375 px', st.includes('max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto'));
}

console.log('R. LA REVISIONE DEL 13/10/2026, SUI NUMERI COSTRUITI');
{
  // R1. UNA COPERTURA SOLA PER CASELLA. Irigom febbraio: il portale ha preso la
  // dichiarazione in due giorni. `copre` (un giorno solo) diceva 174.400 kg nella
  // tendina, nel dialogo e nella scheda Impianti, la «i» 721.660.
  const irigomFeb = { giorni: ['2026-03-11', '2026-03-12'], kg: 721660, prima_kg: 318180, parziale: false, mesi: [{ mese: 'Gennaio', kg: 375000 }, { mese: 'Febbraio', kg: 28480 }] };
  const c = prova(() => copreDellaColonna(irigomFeb));
  verifica("`copre` viene dallo stesso aggancio della «i»: 721.660 kg in due giorni, «dall'anno prima» in testa come prima",
    J(c) === J({ giorno: '2026-03-12', giorni: ['2026-03-11', '2026-03-12'], kg: 721660, prima_kg: 318180, mesi: [{ mese: "dall'anno prima", kg: 318180 }, { mese: 'Gennaio', kg: 375000 }, { mese: 'Febbraio', kg: 28480 }] }), J(c));
  verifica('una colonna senza aggancio non ha `copre`', prova(() => copreDellaColonna(null)) === null && prova(() => copreDellaColonna({ giorni: [] })) === null);
  const cc = typeof S.coperturaCaricata === 'function' ? S.coperturaCaricata : () => '(manca coperturaCaricata)';
  const feb = { mese: 'Febbraio', conferito_kg: 361880, caricato_kg: 721660, dichiarazione_copre: irigomFeb };
  verifica('la tendina, il dialogo e la scheda Impianti hanno la frase della «i»: «caricata a portale in due volte, 11/03/2026 e 12/03/2026: 721,66 t = ...»',
    cc(feb) === 'caricata a portale in due volte, 11/03/2026 e 12/03/2026: 721,66 t = anni prima 318,18 + gen 375,00 + feb 28,48' && S.percheCasella(feb)[0] === `Dichiarazione di febbraio, ${cc(feb)}.`, cc(feb));
  verifica('due dichiarazioni caricate insieme: la frase dice con quale, perche\' il peso e\' di tutte e due',
    cc({ mese: 'Marzo', dichiarazione_copre: { giorni: ['2026-05-04'], kg: 30000, prima_kg: 0, insieme: ['Marzo', 'Aprile'], mesi: [{ mese: 'Marzo', kg: 10000 }, { mese: 'Aprile', kg: 20000 }] } })
      === 'caricata a portale, insieme a quella di aprile, il 04/05/2026: 30,00 t = mar 10,00 + apr 20,00');
  verifica('senza aggancio nessuna frase', cc({ mese: 'Maggio', caricato_kg: 1000 }) === '' && cc(null) === '');
  // I tre punti che leggevano `copre` ora leggono la frase comune.
  const togliCommenti = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const p of ['src/components/dichiarazioni/CellaMese.jsx', 'src/components/dichiarazioni/DialogoMese.jsx', 'src/components/dichiarazioni/SezioneImpianto.jsx']) {
    const s = togliCommenti(sorgente(p));
    verifica(`${p.split('/').pop()}: legge la copertura dallo stesso aggancio della «i», non piu' \`copre\``, !/\.copre\b/.test(s) && /coperturaCaricata\((mese|m)\)/.test(s));
  }

  // R2. LA GIACENZA A FINE MESE DELL'ACI SI CHIUDE SUL CANALE. Il caso del
  // revisore: Gatim aprile scritta 10.000 kg in primaria e 12.540 in secondaria
  // invece di 8.200 e 14.340, stesso totale del canale.
  const ACI = { ultimoMese: 9 };
  const g1 = prova(() => giacenzaAFineMeseDelCanale([
    { partenzaKg: 0, conferito: dodici({ 3: 8200, 4: 7770 }), caricato: dodici({ 3: 10000, 4: 7770 }) },
    { partenzaKg: 0, conferito: dodici({ 0: 27000, 3: 14340 }), caricato: dodici({ 0: 27000, 3: 12540 }) },
  ], ACI));
  const fino = (a) => [...a.slice(0, 10), null, null];
  verifica("la dichiarazione scritta sulla riga sbagliata: tutte e due le righe a 0, non -1.800 e +1.800 fino a ottobre",
    g1.fine && J(g1.fine[0]) === J(fino(zeri())) && J(g1.fine[1]) === J(fino(zeri())), J(g1.fine || g1));
  verifica('e quanto la chiusura ha spostato, da aprile: +1.800 sulla primaria, -1.800 sulla secondaria',
    g1.spostato && g1.spostato[0][3] === 1800 && g1.spostato[1][3] === -1800 && g1.spostato[0][2] === 0 && g1.spostato[1][9] === -1800, J(g1.spostato));
  // L'eccesso esce dal carico piu' vecchio dell'altra riga: gennaio della secondaria.
  const g2 = prova(() => giacenzaAFineMeseDelCanale([
    { partenzaKg: 0, conferito: dodici({ 3: 8200 }), caricato: dodici({ 3: 10000 }) },
    { partenzaKg: 0, conferito: dodici({ 0: 5000 }), caricato: zeri() },
  ], ACI));
  verifica("l'eccesso della primaria esce da gennaio della secondaria: 5.000 fino a marzo, poi 3.200",
    g2.fine && J(g2.fine[0]) === J(fino(zeri())) && J(g2.fine[1]) === J(fino([5000, 5000, 5000, 3200, 3200, 3200, 3200, 3200, 3200, 3200, 0, 0])), J(g2.fine || g2));
  // E prima di tutto dalla casella dall'anno prima, che e' il carico piu' vecchio.
  const g3 = prova(() => giacenzaAFineMeseDelCanale([
    { partenzaKg: 3000, conferito: zeri(), caricato: zeri() },
    { partenzaKg: 0, conferito: dodici({ 2: 2000 }), caricato: dodici({ 2: 4000 }) },
  ], ACI));
  verifica("l'eccesso della secondaria esce dalla casella dall'anno prima della primaria: 3.000, poi 1.000",
    g3.fine && J(g3.fine[0]) === J(fino([3000, 3000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 0, 0])) && J(g3.fine[1]) === J(fino(zeri())), J(g3.fine || g3));
  // Un canale sotto zero resta sotto zero, sulla riga che l'ha fatto: e' un
  // errore da correggere, e non si spalma sulle altre.
  const g4 = prova(() => giacenzaAFineMeseDelCanale([
    { partenzaKg: 0, conferito: dodici({ 3: 8200 }), caricato: dodici({ 3: 10000 }) },
    { partenzaKg: 0, conferito: zeri(), caricato: zeri() },
  ], ACI));
  verifica('un canale sotto zero resta sotto zero, sulla riga che l\'ha fatto', g4.fine && g4.fine[0][3] === -1800 && g4.fine[1][3] === 0, J(g4.fine || g4));
  // Una riga sola: il conto di prima, numero per numero.
  const g5 = prova(() => giacenzaAFineMeseDelCanale([{ partenzaKg: 0, conferito: CONFERITO, caricato: CARICATO }], ACI));
  verifica('con una riga sola e\' giacenzaAFineMese, numero per numero (T-Cycle)', g5.fine && J(g5.fine[0]) === J(FINE_TCYCLE) && g5.spostato[0].every(x => x === 0), J(g5.fine || g5));
  // Le tre proprieta', su 300 canali a due righe a caso (sempre gli stessi): il
  // canale non cambia di un chilo, nessuna riga sotto zero se il canale non lo
  // e', e l'ultimo mese e' il «Da dichiarare» della riga, cioe' la stessa
  // chiusura che riepilogoDichiarazioni fa sull'anno intero.
  let seme = 13102026;
  const caso = (n) => { seme = (seme * 1103515245 + 12345) % 2147483648; return seme % n; };
  const rotti = [];
  for (let k = 0; k < 300 && rotti.length < 5; k++) {
    const ultimo = 3 + caso(9);
    const righe = [0, 1].map(r => {
      const conferito = zeri(), caricato = zeri();
      for (let i = 0; i <= ultimo; i++) {
        if (caso(3)) conferito[i] = 100 * (1 + caso(80));
        if (!caso(3)) caricato[i] = 100 * caso(120);
      }
      return { partenzaKg: r === 0 && caso(2) ? 100 * caso(60) : 0, conferito, caricato };
    });
    const g = prova(() => giacenzaAFineMeseDelCanale(righe, { ultimoMese: ultimo }));
    if (!g.fine) { rotti.push(g.errore); break; }
    const grezze = righe.map(r => giacenzaAFineMese({ ...r, ultimoMese: ultimo }));
    for (let i = 0; i <= ultimo; i++) {
      const canale = grezze[0][i] + grezze[1][i];
      if (g.fine[0][i] + g.fine[1][i] !== canale) rotti.push(`caso ${k}, ${MESI[i]}: il canale fa ${canale}, le righe ${g.fine[0][i]} + ${g.fine[1][i]}`);
      if (canale >= 0 && (g.fine[0][i] < 0 || g.fine[1][i] < 0)) rotti.push(`caso ${k}, ${MESI[i]}: una riga sotto zero (${g.fine[0][i]}, ${g.fine[1][i]}) con il canale a ${canale}`);
    }
    // La chiusura dell'anno intero, come la fa riepilogoDichiarazioni su una riga senza report.
    const anno = chiudiFraIFlussi(righe.map((r, n) => allineaAllaGiacenza(r.conferito, r.conferito.map((x, i) => Math.min(x, r.caricato[i])), grezze[n][ultimo],
      n === 0 ? { conferito: r.partenzaKg, uscito: 0 } : null)));
    anno.forEach((a, n) => {
      const resta = a.resta.reduce((s, x) => s + x, 0) + a.prima.resta;
      // Quello che nemmeno l'altra riga assorbe resta sulla riga che l'ha fatto
      // (il canale e' sotto zero): e' l'unico caso in cui non e' il «Da dichiarare».
      if (g.fine[n][ultimo] !== resta - a.non_allocato_kg) rotti.push(`caso ${k}, riga ${n}: l'ultimo mese fa ${g.fine[n][ultimo]}, il «Da dichiarare» ${resta} (non allocato ${a.non_allocato_kg})`);
    });
    if (g.fine.some(f => f.slice(ultimo + 1).some(x => x !== null))) rotti.push(`caso ${k}: un numero dopo l'ultimo mese`);
  }
  verifica('su 300 canali a caso: il canale non cambia, nessuna riga sotto zero, e l\'ultimo mese e\' il «Da dichiarare»', !rotti.length, rotti.join(' | '));

  // R3. IL RACCONTO CITA LE GIACENZE COL NUMERO CHE LE GIACENZE HANNO. Gatim ACI
  // a settembre, prima della dichiarazione: 12,35 t in primaria, 12,82 in
  // secondaria, e le Giacenze dicono 25,17 t per l'ACI di Gatim.
  const rigaAci = (provenienza, kg, extra) => raccontoDellaRiga({
    anno: 2026, sito: 'Gatim', canale: 'ACI', provenienza,
    mesi: mesiDi(dodici({ 8: kg }), zeri(), dodici({ 8: kg })),
    giacenza_fine_mese: fino(dodici({ 8: kg, 9: kg })), ultimo_mese: 9, ...extra,
  });
  const primaria = rigaAci('primaria', 12350, { righe_del_canale: 2, giacenza_canale_kg: 25170 });
  verifica('una riga dell\'ACI non si dice «lo stesso numero delle Giacenze»: le Giacenze hanno le due righe insieme, e quanto fanno',
    primaria.includes('Oggi restano da dichiarare 12,35 t: tutto settembre (12,35 t). È la giacenza a fine ottobre di questa riga, lo stesso numero della colonna «Da dichiarare»; le Giacenze hanno un numero solo per l\'ACI, le due righe insieme: 25,17 t.')
      && !primaria.some(f => /e delle Giacenze/.test(f)), J(primaria));
  const vuota = raccontoDellaRiga({ anno: 2026, sito: 'Gatim', canale: 'ACI', provenienza: 'primaria', mesi: mesiDi(dodici({ 8: 12350 }), dodici({ 8: 12350 }), zeri(), { 8: '2026-10-02' }),
    giacenza_fine_mese: fino(zeri()), ultimo_mese: 9, righe_del_canale: 2, giacenza_canale_kg: 12820 });
  verifica('e se su questa riga non resta niente, dice di chi sono le tonnellate delle Giacenze',
    vuota.includes('Oggi su questa riga non resta niente da dichiarare: le 12,82 t che le Giacenze dicono per l\'ACI sono dell\'altra riga.'), J(vuota));
  const sola = rigaAci('primaria', 12350, { righe_del_canale: 1, giacenza_canale_kg: 12350 });
  verifica('una riga sola nel suo canale resta «lo stesso numero ... e delle Giacenze»', sola.some(f => /, lo stesso numero della colonna «Da dichiarare» e delle Giacenze\.$/.test(f)), J(sola));
  // Il mese in cui la chiusura sul canale ha spostato qualcosa si racconta: qui
  // lo spostamento dura fino all'ultimo mese, e si dice da quando (la seconda
  // revisione del 13/10/2026 ha tolto «il primo mese» e «risultano uscite»: il
  // caso che rientra sta in prove/spostamentoCheRientra.mjs).
  const spostata = raccontoDellaRiga({ anno: 2026, sito: 'Gatim', canale: 'ACI', provenienza: 'primaria',
    mesi: mesiDi(dodici({ 3: 8200 }), dodici({ 3: 10000 }), zeri(), { 3: '2026-09-21' }).map((m, i) => (i >= 3 && i <= 9 ? { ...m, spostato_dal_canale_kg: 1800 } : m)),
    giacenza_fine_mese: fino(zeri()), ultimo_mese: 9, righe_del_canale: 2, giacenza_canale_kg: 0 });
  verifica('il racconto dice perche\' la riga non e\' entrato meno caricato: la chiusura sul canale',
    spostata.includes('Da fine aprile le dichiarazioni di questa riga hanno coperto 1,80 t più di quello che vi era arrivato, e l\'eccesso si toglie dai carichi più vecchi dell\'altra riga dell\'ACI: le righe di un canale si chiudono insieme, come la colonna «Da dichiarare» e le Giacenze.')
      && spostata.includes('Oggi non resta niente da dichiarare.'), J(spostata));
  const pf = S.percheFineMese({ mese: 'Aprile', giacenza_fine_kg: 0, caricato_kg: 10000, spostato_dal_canale_kg: -1800 }, false);
  verifica('e il numero al tocco lo spiega', pf.some(f => /^Le righe di un canale si chiudono insieme, come la colonna «Da dichiarare»: un'altra riga dello stesso canale ha dichiarato più di quello che vi era arrivato, e 1,80 t si tolgono dai carichi più vecchi di questa\.$/.test(f)), J(pf));

  // R4. L'ATTESA DEL PORTALE E' DEL FILE DI OGGI. Su un altro anno non si passa:
  // il racconto non attribuisce a quell'anno carichi dell'anno dopo, e non dice
  // nemmeno «niente in attesa», che sarebbe un'altra invenzione.
  const senzaAttesa = stoccaggioDelSito({ sito: 'T-CYCLE INDUSTRIES SRL', canale: 'RETE', entrato: dodici({ 0: 1000 }), uscito: dodici({ 0: 1000 }),
    verso: [{ impianto: 'TECNOGUM SRL', chiave: 'tecnogum', kg: 1000, dichiara: false, mesi_kg: dodici({ 0: 1000 }) }], inAttesaT: null, fotoIl: '2026-10-09' });
  verifica("senza il numero dell'anno l'attesa resta null, non zero, e la frase non dice niente di inventato",
    senzaAttesa && senzaAttesa.in_attesa_t === null && !senzaAttesa.frasi.some(f => /non attribuisce allo stoccaggio niente|attribuisce ancora/.test(f))
      && senzaAttesa.frasi.some(f => /^TECNOGUM SRL sulla rete non ci dichiara, per accordo: quanto il portale tiene ancora in attesa sullo stoccaggio lo dice il file degli ordini non dichiarati, che è di oggi/.test(f)), J(senzaAttesa));
  const versoChiDichiara = stoccaggioDelSito({ sito: 'T-CYCLE INDUSTRIES SRL', canale: 'RETE', entrato: dodici({ 0: 1000 }), uscito: dodici({ 0: 1000 }),
    verso: [{ impianto: 'AKÇANSA ÇİMENTO - Canakkale', chiave: 'akcansa', kg: 1000, dichiara: true, mesi_kg: dodici({ 0: 1000 }) }], inAttesaT: null, fotoIl: '2026-10-09' });
  verifica('e verso chi dichiara, senza il numero, il portale non si nomina', versoChiDichiara && versoChiDichiara.in_attesa_t === null && !versoChiDichiara.frasi.some(f => /portale/i.test(f)), J(versoChiDichiara));

  // R5. LA «i» NON PASSA SOPRA LA COLONNA FERMA. La prima colonna della tabella
  // e' ferma con uno z-index (src/index.css, da 768 px); la «i» vive nello stesso
  // contesto di sovrapposizione, perche' il suo contenitore non ne fa uno.
  const st = sorgente('src/components/dichiarazioni/StoriaRiga.jsx');
  const rp = sorgente('src/components/dichiarazioni/Riepilogo.jsx');
  const css = sorgente('src/index.css');
  const angolo = st.slice(st.indexOf('export function AngoloPerche'), st.indexOf('/** Un numero che al tocco'));
  const zAngolo = Number(((angolo.match(/\babsolute\b[^"]*?\bz-(?:\[(\d+)\]|(\d+))/) || []).slice(1).find(Boolean)) || 0);
  const blocco = css.slice(css.indexOf('[data-scorre-lato] > table > thead > tr > th:first-child,'));
  const zColonna = Number((blocco.match(/z-index:\s*(\d+)/) || [])[1]);
  const isolato = /<div className="[^"]*\bisolate\b[^"]*">\s*<CellaMese/.test(rp);
  verifica('la «i» nell\'angolo sta sotto la colonna ferma quando la tabella scorre di lato', zColonna > 0 && (isolato || zAngolo < zColonna), `z della «i» ${zAngolo}, della colonna ferma ${zColonna}, contenitore isolato ${isolato}`);

  // R6. I TESTI DEL GUARDIANO: chi si guarda sono impianti e stoccaggi della rete.
  const ig = JSON.parse(sorgente('base44/entities/IndicatoreGiorno.jsonc').replace(/^\s*\/\/.*$/gm, ''));
  verifica('IndicatoreGiorno: l\'esito dice impianti e stoccaggi della rete', /ogni impianto e ogni stoccaggio della rete con un confronto a portale quadra/.test(ig.properties.esito.description), ig.properties.esito.description);
  verifica('gli scostamenti dicono anche gli stoccaggi, col loro segno', /stoccaggi della rete che non quadrano/.test(ig.properties.scostamenti_json.description) && /stoccaggio: true/.test(ig.properties.scostamenti_json.description));
  verifica('e i numeri per sito dicono i mesi aperti', /mesi_aperti \[\{ mese, provenienza \(solo ACI\), da_dichiarare_t \}\]/.test(ig.properties.siti_json.description) && /«dall'anno prima» in testa/.test(ig.properties.siti_json.description));
  const gn = JSON.parse(sorgente('base44/workflows/GuardianoNotturno.jsonc'));
  const passo = gn.definition.do.find(x => x.fotografia_del_giorno).fotografia_del_giorno['x-base44'];
  verifica('GuardianoNotturno: il passo e il lavoro dicono «la quadratura di impianti e stoccaggi della rete»',
    /la quadratura di impianti e stoccaggi della rete/i.test(passo.title) && /quadratura di impianti e stoccaggi della rete/.test(passo.description) && /quadratura di impianti e stoccaggi della rete/.test(gn.description)
      && !/tutti gli impianti|ogni impianto contro/.test(`${passo.title} ${passo.description} ${gn.description}`), passo.title);
}

// ─────────────────────────────────────────────────────────────────────────────
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) {
  console.log(`Nessuna copia dei dati veri in ${CARTELLA}: le sezioni 6-8 si saltano.`);
} else {
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copie[copie.length - 1])).toString('utf8'));
  console.log(`Copia: ${copie[copie.length - 1]}, letta il ${DATI.meta.letto_fino_al}`);
  globalThis.__DATI_VERI = DATI.archivi;
  globalThis.__SCRITTE_DATI_VERI = [];
  // L'SDK finto di prove/datiVeri.mjs, lo stesso: legge dalla copia, non scrive.
  const dv = sorgente('prove/datiVeri.mjs');
  const SDK_FINTO = dv.slice(dv.indexOf('const SDK_FINTO = `') + 'const SDK_FINTO = `'.length, dv.indexOf('}`;') + 1);
  const carica = async (opzioni) => {
    const p = await build({ bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', ...opzioni,
      plugins: [{ name: 'sdk-finto', setup(b) {
        b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
        b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
      } }] });
    const m = await import('data:text/javascript;base64,' + Buffer.from(p.outputFiles[0].text).toString('base64'));
    return async (corpo) => { const r = await m.default({ json: async () => corpo }); return { stato: r.status, j: await r.json() }; };
  };
  // La funzione di HEAD, coi moduli condivisi di oggi: tolti i campi nuovi, la
  // risposta deve essere la stessa al carattere.
  const diHead = async (nome) => {
    let testo;
    try { testo = execSync(`git show HEAD:base44/functions/${nome}/entry.ts`, { cwd: qui('..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; }
    return carica({ stdin: { contents: testo, resolveDir: qui(`../base44/functions/${nome}`), sourcefile: `${nome}-HEAD.ts`, loader: 'ts' } });
  };
  const OraVera = Date;
  const conOra = async (iso, f) => {
    const ms = OraVera.parse(iso);
    globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
    try { return await f(); } finally { globalThis.Date = OraVera; }
  };
  const ORA = DATI.meta.letto_fino_al;
  const ANNO = Number(String(ORA).slice(0, 4));
  const R = (await conOra(ORA, async () => (await carica({ entryPoints: [qui('../base44/functions/riepilogoDichiarazioni/entry.ts')] }))({ anno: ANNO }))).j;
  const G = (await conOra(ORA, async () => (await carica({ entryPoints: [qui('../base44/functions/calcolaGiacenze/entry.ts')] }))({ anno: ANNO }))).j;
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const impianti = (R.siti || []).filter(s => s.tipo_destinazione !== 'stoc');

  console.log('6. SUI DATI VERI: IL CASO T-CYCLE, AL CHILO');
  const tc = impianti.find(s => /T-CYCLE/.test(s.sito));
  const tcRete = tc && tc.flussi.find(f => f.canale === 'RETE');
  if (ANNO === 2026 && tcRete) {
    verifica('la giacenza a fine mese di T-Cycle rete: 87,74 / 124,16 / 20,62 / 66,90 / 118,18 / 41,98 / 150,66 / 199,08 / 323,88 / 364,80',
      J(tcRete.mesi.map(m => m.giacenza_fine_kg)) === J(FINE_TCYCLE), J(tcRete.mesi.map(m => m.giacenza_fine_kg)));
    // I conferimenti, contati qui direttamente dagli archivi: impianto e stoccaggio.
    const fine = (r) => String(r.trasporto_finito_il || '');
    const mese = (r) => { const d = new OraVera(fine(r)); const g = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit' }).format(d); return g.startsWith(String(ANNO)) ? Number(g.slice(5, 7)) - 1 : -1; };
    const perMese = (righe) => { const a = zeri(); for (const r of righe) { const i = mese(r); if (i >= 0) a[i] += Number(r.peso_effettivo) || 0; } return a; };
    const prim = DATI.archivi.PrimariaRete.filter(r => r.stato === 'terminato' && /t-?cycle/i.test(r.destinazione || ''));
    const imp = perMese(prim.filter(r => !/^stoc/i.test(String(r.tipo_destinazione || ''))));
    const sto = perMese(prim.filter(r => /^stoc/i.test(String(r.tipo_destinazione || ''))));
    verifica('le primarie in impianto, dagli archivi: gen 87.740 ... ott 40.920 (la riga del conferito)', J(imp) === J(CONFERITO) && J(tcRete.mesi.map(m => m.conferito_kg)) === J(CONFERITO), J(imp));
    const st = tcRete.stoccaggio_stesso_sito;
    verifica('in stoccaggio, dagli archivi e nella riga nuova: gen 17.960, feb 60.400, mar 58.580, apr 62.040, mag 50.080 (249.060)',
      st && J(st.entrato_kg) === J(sto) && J(sto) === J([17960, 60400, 58580, 62040, 50080, 0, 0, 0, 0, 0, 0, 0]), J(st && st.entrato_kg));
    const sec = perMese(DATI.archivi.Secondaria.filter(r => r.stato === 'terminato' && /t-?cycle/i.test(r.stoccaggio || '') && /tecnogum/i.test(r.destinazione || '')));
    const vT = st && st.verso.find(v => /TECNOGUM/.test(v.impianto));
    verifica('ripartito verso Tecnogum: gen 14.040, feb 57.500, mar 65.120, apr 56.000, mag 56.400 (249.060, tutto)',
      vT && J(vT.mesi_kg) === J(sec) && J(sec) === J([14040, 57500, 65120, 56000, 56400, 0, 0, 0, 0, 0, 0, 0]) && vT.kg === 249060 && vT.dichiara === false, J(vT));
    const gStoc = (G.righe || []).find(x => /T-CYCLE/.test(x.sito) && x.tipo_destinazione === 'stoc');
    verifica('e dice col numero vero quello che il portale tiene in attesa: 181,299 t, la colonna delle Giacenze',
      st && st.in_attesa_t === 181.299 && gStoc && gStoc.in_attesa_dichiarazione_t === 181.299 && st.frasi.some(f => f.includes('181,299 t')), `${st && st.in_attesa_t} / ${gStoc && gStoc.in_attesa_dichiarazione_t}`);
    const marzo = tcRete.mesi[2], giugno = tcRete.mesi[5];
    verifica('la dichiarazione di marzo: 146,86 t = gen 87,74 + feb 36,42 + mar 22,70', marzo.dichiarazione_copre && marzo.dichiarazione_copre.kg === 146860 && J(marzo.dichiarazione_copre.mesi) === J([{ mese: 'Gennaio', kg: 87740 }, { mese: 'Febbraio', kg: 36420 }, { mese: 'Marzo', kg: 22700 }]), J(marzo.dichiarazione_copre));
    verifica('quella di giugno: 195,78 t = mar 20,62 + apr 46,28 + mag 51,28 + giu 77,60', giugno.dichiarazione_copre && J(giugno.dichiarazione_copre.mesi) === J([{ mese: 'Marzo', kg: 20620 }, { mese: 'Aprile', kg: 46280 }, { mese: 'Maggio', kg: 51280 }, { mese: 'Giugno', kg: 77600 }]), J(giugno.dichiarazione_copre));
    verifica('marzo coperto in due volte, e i 20,62 t sono di marzo, in impianto: non lo stoccaggio',
      J((marzo.coperto_da || []).map(v => [v.mese, v.kg])) === J([['Marzo', 22700], ['Giugno', 20620]]) && 20620 !== sto[2], J(marzo.coperto_da));
    const L = await caricaLibPagine('lib/storiaRiepilogo');
    verifica('al tocco su marzo: «20,62 t di marzo coperte dalla dichiarazione di giugno»', L.percheCasella(marzo).some(f => f.startsWith('20,62 t di marzo coperte dalla dichiarazione di giugno')), J(L.percheCasella(marzo)));
    verifica('il racconto vero di T-Cycle dice le stesse frasi di quello costruito', J(tcRete.racconto) === J(RACCONTO), J(tcRete.racconto));
  } else verifica('T-Cycle rete c\'e\' nei dati veri', false, String(ANNO));

  console.log('7. SUI DATI VERI: L\'OROLOGIO SVIZZERO');
  const CAMPO = { RETE: 'giacenza_portale_t', ACI: 'giacenza_aci_t', EXTRA_RACCOLTA: 'giacenza_extra_t' };
  const t2 = (x) => Math.round(Number(x) * 100) / 100;
  let righe = 0;
  for (const s of impianti) {
    const g = (G.righe || []).find(x => x.tipo_destinazione !== 'stoc' && norm(x.sito) === norm(s.sito));
    for (const c of s.giacenze_canale || []) {
      const flussi = s.flussi.filter(f => f.canale === c.canale);
      if (!flussi.length || c.giacenza_t === null) continue;
      for (const f of flussi) {
        righe++;
        const ultimo = f.mesi[f.ultimo_mese] ? f.mesi[f.ultimo_mese].giacenza_fine_kg : null;
        verifica(`${s.sito} ${c.canale} ${f.provenienza}: la giacenza dell'ultimo mese e' il «Da dichiarare» della riga`, ultimo === Math.round(f.resta_t * 1000), `${ultimo} / ${f.resta_t}`);
        verifica(`${s.sito} ${c.canale} ${f.provenienza}: e dopo l'ultimo mese non c'e' un numero`, f.mesi.slice(f.ultimo_mese + 1).every(m => m.giacenza_fine_kg === null));
      }
      const somma = flussi.reduce((a, f) => a + f.mesi[f.ultimo_mese].giacenza_fine_kg, 0);
      verifica(`${s.sito} ${c.canale}: la giacenza a fine dell'ultimo mese e' quella del canale e delle Giacenze`, somma === Math.round(c.giacenza_t * 1000) && g && t2(g[CAMPO[c.canale]]) === t2(somma / 1000), `${somma} / ${c.giacenza_t} / ${g && g[CAMPO[c.canale]]}`);
    }
  }
  verifica('le righe controllate', righe >= 8, String(righe));
  // I mesi aperti della fotografia sono la colonna «Da dichiarare», canale per canale.
  const foto = leggiFotografia(fotografiaDelGiorno(R.siti, { giorno: String(ORA).slice(0, 10), anno: ANNO, doppioni: R.doppioni }));
  for (const v of foto.siti.filter(x => x.ruolo === 'imp')) {
    const s = impianti.find(x => x.chiave === v.chiave);
    for (const [canale, c] of Object.entries(v.canali)) {
      if (c.non_dovuta || !('resta_t' in c)) continue;
      const colonna = s.flussi.filter(f => f.canale === canale).reduce((a, f) => a + Math.round(f.da_dichiarare_t * 1000), 0);
      const aperti = (c.mesi_aperti || []).reduce((a, m) => a + Math.round(m.da_dichiarare_t * 1000), 0);
      verifica(`${v.sito} ${canale}: la somma dei mesi aperti della fotografia e' la colonna «Da dichiarare»`, Array.isArray(c.mesi_aperti) && aperti === colonna && colonna === Math.round(c.resta_t * 1000), `${aperti} / ${colonna} / ${c.resta_t}`);
    }
  }
  const irigom = foto.siti.find(v => /Irigom/.test(v.sito) && v.ruolo === 'imp');
  if (ANNO === 2026) {
    verifica('Irigom rete 652,84 t: 144,78 di agosto + 375,14 di settembre + 132,92 di ottobre',
      irigom && J(irigom.canali.RETE.mesi_aperti) === J([{ mese: 'Agosto', da_dichiarare_t: 144.78 }, { mese: 'Settembre', da_dichiarare_t: 375.14 }, { mese: 'Ottobre', da_dichiarare_t: 132.92 }]), J(irigom && irigom.canali.RETE.mesi_aperti));
    const tcF = foto.siti.find(v => /T-CYCLE/.test(v.sito) && v.ruolo === 'imp');
    verifica('T-Cycle rete: giugno 41,98, poi luglio-ottobre', tcF && J(tcF.canali.RETE.mesi_aperti.map(m => [m.mese, m.da_dichiarare_t])) === J([['Giugno', 41.98], ['Luglio', 108.68], ['Agosto', 48.42], ['Settembre', 124.8], ['Ottobre', 40.92]]), J(tcF && tcF.canali.RETE.mesi_aperti));
    const tg = foto.siti.find(v => /TECNOGUM/.test(v.sito));
    verifica('Tecnogum: la rete non dovuta non ha mesi aperti, e non e\' un elenco vuoto', tg && tg.canali.RETE.non_dovuta && !('mesi_aperti' in tg.canali.RETE));
    verifica('il guardiano conta impianti e stoccaggi della rete come la pagina: 6, con Nappi Sud',
      foto.nota === 'Tutti gli impianti e gli stoccaggi della rete con un confronto a portale quadrano (6).' && R.totali.siti_che_quadrano + R.totali.siti_da_quadrare === 6, foto.nota);
  }
  const conMesi = fotografiaDelGiorno(R.siti, { giorno: String(ORA).slice(0, 10), anno: ANNO }).siti_json.length;
  const senzaMesi = J(JSON.parse(fotografiaDelGiorno(R.siti, { giorno: String(ORA).slice(0, 10), anno: ANNO }).siti_json).map(v => ({ ...v, canali: Object.fromEntries(Object.entries(v.canali).map(([k, c]) => { const { mesi_aperti: _m, ...resto } = c; void _m; return [k, resto]; })) }))).length;
  console.log(`  la riga del giorno: siti_json ${senzaMesi} caratteri senza i mesi aperti, ${conMesi} con`);
  verifica('la riga del giorno resta piccola: i mesi aperti aggiungono meno di 2.000 caratteri', conMesi - senzaMesi < 2000, `${senzaMesi} -> ${conMesi}`);

  console.log('8. SUI DATI VERI: NESSUN NUMERO CAMBIA');
  const head = await diHead('riepilogoDichiarazioni');
  if (!head) console.log('  (git non disponibile: il confronto con HEAD si salta)');
  else {
    const H = (await conOra(ORA, () => head({ anno: ANNO }))).j;
    const NUOVI_FLUSSO = ['giacenza_partenza_kg', 'ultimo_mese', 'prima_coperta_da', 'caricamenti_non_nostri', 'racconto', 'stoccaggio_stesso_sito'];
    // `copre` dalla revisione del 13/10/2026 viene dallo stesso aggancio di
    // dichiarazione_copre (una copertura sola per casella) e porta anche
    // `giorni`: e' cambiato apposta, e qui sotto si guarda a parte; la sezione 10
    // lo prova casella per casella. spostato_dal_canale_kg c'e' solo dove la
    // chiusura sul canale ha spostato qualcosa fra le righe dell'ACI, e
    // giacenza_canale_fine_kg (revisione finale del 13/10/2026) su quei mesi e
    // sul mese dopo.
    const NUOVI_MESE = ['giacenza_fine_kg', 'dichiarazione_copre', 'coperto_da', 'copre', 'spostato_dal_canale_kg', 'giacenza_canale_fine_kg'];
    const senza = (o, chiavi) => Object.fromEntries(Object.entries(o).filter(([k]) => !chiavi.includes(k)));
    const pulita = {
      ...R,
      siti: R.siti.map(s => ({ ...s, flussi: (s.flussi || []).map(f => ({ ...senza(f, NUOVI_FLUSSO), mesi: f.mesi.map(m => senza(m, NUOVI_MESE)) })) })),
      stoccaggi: R.stoccaggi.map(s => ({ ...s, canali: s.canali.map(c => ({ ...c, verso: c.verso.map(v => senza(v, ['mesi_kg'])) })) })),
    };
    const pulitaH = { ...H, siti: H.siti.map(s => ({ ...s, flussi: (s.flussi || []).map(f => ({ ...f, mesi: f.mesi.map(m => senza(m, NUOVI_MESE)) })) })) };
    verifica('la risposta di oggi, tolti i campi nuovi, e\' quella di HEAD al carattere', J(pulita) === J(pulitaH), `${J(pulita).length} contro ${J(pulitaH).length}`);
    // `copre` di una dichiarazione presa dal portale in un giorno solo e' quello
    // di HEAD, nello stesso formato («dall'anno prima» in testa), con in piu'
    // `giorni`. Cambia solo dove il portale l'ha presa in piu' giorni.
    const copreDiversi = [];
    R.siti.forEach((s, a) => (s.flussi || []).forEach((f, b) => f.mesi.forEach((m, k) => {
      const h = (((H.siti[a] || {}).flussi || [])[b] || { mesi: [] }).mesi[k];
      const qui = m.copre ? senza(m.copre, ['giorni']) : null;
      const unGiorno = !m.copre || (m.copre.giorni || []).length === 1;
      if (unGiorno && J(qui) !== J(h ? h.copre || null : null)) copreDiversi.push(`${s.sito} ${f.canale} ${m.mese}`);
    })));
    verifica('`copre` di una dichiarazione presa in un giorno solo e\' quello di HEAD, nello stesso formato', !copreDiversi.length, copreDiversi.join(', '));
    verifica('e i campi nuovi ci sono', impianti.every(s => s.flussi.every(f => Array.isArray(f.racconto) && f.mesi.every(m => 'giacenza_fine_kg' in m))));
  }
  verifica('niente scritto sugli archivi', globalThis.__SCRITTE_DATI_VERI.length === 0, globalThis.__SCRITTE_DATI_VERI.join());

  console.log('9. LA PAGINA E IL FOGLIO, SUI DATI VERI');
  // La pagina disegnata (react-dom/server): le righe nuove ci sono, e nessun numero manca.
  const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
  const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(f => existsSync(f) && /\.\w+$/.test(f)) || base; };
  let html = '';
  try {
    const pacchetto = await build({
      stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server.browser'; import Riepilogo from ${J(qui('../src/components/dichiarazioni/Riepilogo.jsx'))}; export const disegna = (p) => renderToStaticMarkup(React.createElement(Riepilogo, p));`, resolveDir: qui('.'), loader: 'js' },
      bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent', loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'alias', setup(b) { b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) })); } }],
    });
    const P = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
    html = P.disegna({ dati: R, onApri: () => {}, soloLettura: true });
  } catch (e) { verifica('il riepilogo si disegna', false, String(e && e.message).slice(0, 300)); }
  const testo = html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  verifica('la pagina disegna la giacenza a fine mese di ogni riga', (testo.match(/giacenza a fine mese/g) || []).length >= 8, String((testo.match(/giacenza a fine mese/g) || []).length));
  verifica('e sotto T-Cycle le righe dello stoccaggio, verso Tecnogum', /in stoccaggio nel mese/.test(testo) && /ripartito in secondaria verso TECNOGUM SRL/.test(testo) && /249,06 t in tutto/.test(testo) && /TECNOGUM SRL non ci dichiara la rete, per accordo/.test(testo), '');
  verifica('i numeri della riga nuova di T-Cycle: 124,16 a febbraio e 20,62 a marzo', testo.includes('124,16') && testo.includes('20,62'));
  verifica('nessun «NaN» o «undefined» a video', !/NaN|undefined/.test(testo), (testo.match(/.{40}(NaN|undefined).{40}/) || [])[0]);
  verifica('il pulsante della storia accanto a ogni riga', (html.match(/aria-label="La storia di/g) || []).length >= 8);

  // Il foglio Excel: le stesse righe, le dichiarazioni caricate con gli agganci e la storia.
  const scaricati = [];
  globalThis.document = { body: { appendChild() {} }, createElement: () => ({ click() { scaricati.push({ nome: this.download, blob: resolveObjectURL(this.href) }); }, remove() {} }) };
  const E = await caricaLibPagine('lib/dichiarazioniExport', [["import { INTESTAZIONE_DATE, righeExcelDate } from '@/components/giacenze/DateDaSistemare';", "const INTESTAZIONE_DATE = ['Data']; const righeExcelDate = () => [];"]]);
  await E.esportaDichiarazioni(R, { stato: { letto: true, archivi: [], caricamenti_aperti: [] } });
  delete globalThis.document;
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  if (scaricati.length) await wb.xlsx.load(Buffer.from(await scaricati[0].blob.arrayBuffer()));
  const righeDi = (ws) => { const out = []; for (let n = 1; ws && n <= ws.rowCount; n++) out.push((ws.getRow(n).values || []).slice(1)); return out; };
  const riep = righeDi(wb.getWorksheet('Riepilogo'));
  const fineTc = riep.find(r => /T-CYCLE/.test(r[0]) && r[3] === 'Giacenza a fine mese (informativa)');
  verifica('nel foglio Riepilogo la giacenza a fine mese di T-Cycle, in kg, senza totale', fineTc && J(fineTc.slice(5, 15)) === J(FINE_TCYCLE.slice(0, 10)) && (fineTc[17] === undefined || fineTc[17] === null), J(fineTc));
  const stocTc = riep.find(r => /T-CYCLE/.test(r[0]) && r[3] === 'In stoccaggio nel mese (tal quale, non si dichiara qui)');
  const versoTc = riep.find(r => /T-CYCLE/.test(r[0]) && /^Ripartito in secondaria verso TECNOGUM SRL/.test(String(r[3])));
  verifica('e le righe dello stoccaggio, col loro totale', stocTc && stocTc[17] === 249.06 && versoTc && versoTc[17] === 249.06 && versoTc[7] === 65120, `${J(stocTc)} ${J(versoTc)}`);
  verifica('con la nota che sono da leggere', riep.some(r => typeof r[0] === 'string' && r[0].startsWith('Le righe «Giacenza a fine mese»')));
  const car = righeDi(wb.getWorksheet('Dichiarazioni caricate'));
  const carMarzo = car.find(r => /T-CYCLE/.test(r[0]) && r[2] === 'Marzo');
  verifica('il foglio delle dichiarazioni caricate: marzo, 03/04/2026, «146,86 t = gen 87,74 + feb 36,42 + mar 22,70»', carMarzo && carMarzo[3] === '03/04/2026' && carMarzo[carMarzo.length - 1] === '146,86 t = gen 87,74 + feb 36,42 + mar 22,70', J(carMarzo));
  const det = righeDi(wb.getWorksheet('Dettaglio'));
  const detMarzo = det.find(r => /T-CYCLE/.test(r[0]) && r[1] === 'Rete' && r[3] === 'Marzo');
  verifica('il dettaglio di marzo dice chi l\'ha coperto, in due volte', detMarzo && detMarzo[19] === 20620 && /22,70 t di marzo coperte dalla dichiarazione di marzo \(03\/04\/2026\); 20,62 t di marzo coperte dalla dichiarazione di giugno \(26\/06\/2026\)/.test(detMarzo[21]), J(detMarzo));
  const storia = righeDi(wb.getWorksheet('Storia'));
  verifica('e il foglio Storia ha il racconto di T-Cycle, frase per frase', storia.filter(r => /T-CYCLE/.test(r[0]) && r[1] === 'Rete').map(r => r[3]).join('|') === tcRete.racconto.join('|'), String(storia.length));

  console.log('10. LA REVISIONE DEL 13/10/2026, SUI DATI VERI');
  // 10.1 UNA COPERTURA SOLA PER CASELLA: `copre` (la tendina, il dialogo, la
  // scheda Impianti) e dichiarazione_copre (la «i») dallo stesso aggancio.
  {
    const diverse = [];
    let caselle = 0;
    for (const s of impianti) for (const f of s.flussi) for (const m of f.mesi) {
      if (!m.copre && !m.dichiarazione_copre) continue;
      caselle++;
      if (J(m.copre || null) !== J(prova(() => copreDellaColonna(m.dichiarazione_copre || null)))) diverse.push(`${s.sito} ${f.canale} ${m.mese}`);
    }
    verifica(`ogni casella ha una copertura sola: \`copre\` e la «i» dallo stesso aggancio (${caselle} caselle)`, caselle >= 20 && !diverse.length, diverse.join(', '));
    const ir = impianti.find(s => /Irigom/.test(s.sito));
    const irFeb = ir && ir.flussi.find(f => f.canale === 'RETE' && !f.provenienza).mesi[1];
    const frase = 'caricata a portale in due volte, 11/03/2026 e 12/03/2026: 721,66 t = anni prima 318,18 + gen 375,00 + feb 28,48';
    const cc = typeof S.coperturaCaricata === 'function' ? S.coperturaCaricata : () => '(manca coperturaCaricata)';
    if (ANNO === 2026) {
      verifica('Irigom rete, febbraio: `copre` dice 721.660 kg presi l\'11/03 e il 12/03, come la «i», non 174.400',
        irFeb && irFeb.copre && irFeb.copre.kg === 721660 && J(irFeb.copre.giorni) === J(['2026-03-11', '2026-03-12']) && irFeb.copre.giorno === '2026-03-12' && irFeb.copre.mesi[0].mese === "dall'anno prima", J(irFeb && irFeb.copre));
      verifica('e la frase comune e\' quella della «i»', irFeb && cc(irFeb) === frase && S.percheCasella(irFeb)[0] === `Dichiarazione di febbraio, ${frase}.`, irFeb && cc(irFeb));
      // La tendina della casella, nella pagina disegnata alla sezione 9.
      const titoli = [...html.matchAll(/title="([^"]*)"/g)].map(x => x[1].replace(/&#x27;/g, "'").replace(/&amp;/g, '&'));
      verifica('la tendina della casella di febbraio dice 721,66 t in due volte, e nessuna tendina dice piu\' «ha chiuso» col giorno solo',
        titoli.some(x => x.startsWith('Febbraio · ') && x.includes(frase)) && !titoli.some(x => /caricata a portale il \d\d\/\d\d\/\d{4}: ha chiuso/.test(x)), String(titoli.filter(x => /^Febbraio · /.test(x)).length));
      // La scheda Impianti di Irigom, disegnata: la tendina dell'uscito di febbraio.
      let scheda = '';
      try {
        const pacchetto = await build({
          stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server.browser'; import SezioneImpianto from ${J(qui('../src/components/dichiarazioni/SezioneImpianto.jsx'))}; export const disegna = (p) => renderToStaticMarkup(React.createElement(SezioneImpianto, p));`, resolveDir: qui('.'), loader: 'js' },
          bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent', loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' },
          plugins: [{ name: 'alias', setup(b) { b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) })); } }],
        });
        const P = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
        scheda = P.disegna({ sito: ir, onApri: () => {}, soloLettura: true }).replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
      } catch (e) { verifica('la scheda Impianti si disegna', false, String(e && e.message).slice(0, 300)); }
      verifica('la scheda Impianti di Irigom dice la stessa cosa sull\'uscito di febbraio', scheda.includes(`title="La dichiarazione di febbraio, ${frase}"`), (scheda.match(/title="La dichiarazione di febbraio[^"]*"/) || [])[0]);
    }
  }

  const fR = await carica({ entryPoints: [qui('../base44/functions/riepilogoDichiarazioni/entry.ts')] });
  const fG = await carica({ entryPoints: [qui('../base44/functions/calcolaGiacenze/entry.ts')] });
  // Una copia delle dichiarazioni con qualche riga cambiata, solo per la durata della prova.
  const conDichiarazioni = async (cambia, f) => {
    const originali = DATI.archivi.DichiarazioneSito;
    DATI.archivi.DichiarazioneSito = originali.map(r => cambia(r) || r);
    try { return await f(); } finally { DATI.archivi.DichiarazioneSito = originali; }
  };
  const gatimAci = (r, mese, provenienza) => /gatim/i.test(r.sito || '') && r.canale === 'ACI' && Number(r.anno) === ANNO && r.mese === mese && (!provenienza || r.provenienza === provenienza);
  const giro = async () => ({ R: (await conOra(ORA, () => fR({ anno: ANNO }))).j, G: (await conOra(ORA, () => fG({ anno: ANNO }))).j });
  const gatimDi = (X) => X.R.siti.find(s => s.tipo_destinazione !== 'stoc' && /gatim/i.test(s.sito));
  const gatimG = (X) => (X.G.righe || []).find(x => x.tipo_destinazione !== 'stoc' && /gatim/i.test(x.sito));

  // 10.2 L'ACI A DUE RIGHE: la dichiarazione di aprile di Gatim scritta per
  // 1.800 kg sulla provenienza sbagliata (lo script del revisore).
  if (ANNO === 2026) {
    const X = await conDichiarazioni(r => (gatimAci(r, 'Aprile', 'primaria') ? { ...r, quantita_kg: 10000 } : gatimAci(r, 'Aprile', 'secondaria') ? { ...r, quantita_kg: 12540 } : null), giro);
    const s = gatimDi(X);
    const righe = s.flussi.filter(f => f.canale === 'ACI');
    const canale = s.giacenze_canale.find(c => c.canale === 'ACI');
    verifica('Gatim ACI: il canale fa 0 in Dichiarazioni e nelle Giacenze', righe.length === 2 && canale.giacenza_t === 0 && gatimG(X).giacenza_aci_t === 0, `${canale && canale.giacenza_t} / ${gatimG(X) && gatimG(X).giacenza_aci_t}`);
    for (const f of righe) {
      const fine = f.mesi.map(m => m.giacenza_fine_kg);
      verifica(`Gatim ACI ${f.provenienza}: nessun mese sotto zero, e l'ultimo e' il «Da dichiarare» della riga`, fine.every(x => x === null || x >= 0) && fine[f.ultimo_mese] === Math.round(f.resta_t * 1000), J(fine));
    }
    const [pri, sec] = righe;
    verifica('aprile: +1,80 t spostate sulla primaria, -1,80 t sulla secondaria, e dette',
      pri.mesi[3].spostato_dal_canale_kg === 1800 && sec.mesi[3].spostato_dal_canale_kg === -1800 && !('spostato_dal_canale_kg' in pri.mesi[2])
        && pri.racconto.some(x => x.startsWith('Da fine aprile le dichiarazioni di questa riga hanno coperto 1,80 t più di quello che vi era arrivato, e l\'eccesso si toglie dai carichi più vecchi dell\'altra riga dell\'ACI (la secondaria)'))
        && sec.racconto.some(x => x.startsWith('Da fine aprile la giacenza di questa riga conta 1,80 t in meno: le dichiarazioni dell\'altra riga dell\'ACI (la primaria) hanno coperto più di quello che vi era arrivato'))
        // Seconda revisione del 13/10/2026: mai «risultano uscite», che la colonna smentiva.
        && !righe.some(f => f.racconto.some(x => /risultano uscite/.test(x))), `${J(pri.mesi.map(m => m.spostato_dal_canale_kg || 0))} ${J(sec.mesi.map(m => m.spostato_dal_canale_kg || 0))}`);
    verifica('nessuno dice «-1,80 t in giacenza»', !righe.some(f => f.mesi.some((m, i) => S.percheFineMese(m, false, f.mesi[i - 1] || null).some(x => /-1,80 t/.test(x)))));
    // La giacenza del canale a fine mese (revisione finale del 13/10/2026): sui
    // mesi con uno spostamento e sul mese dopo, la somma delle due righe; su
    // nessun altro mese.
    const attesoCanale = (f) => f.mesi.map((m, i) => ((m.spostato_dal_canale_kg || (i > 0 && f.mesi[i - 1].spostato_dal_canale_kg)) && m.giacenza_fine_kg !== null
      ? righe.reduce((s, x) => s + x.mesi[i].giacenza_fine_kg, 0) : '-'));
    verifica('la giacenza del canale sta sui mesi dello spostamento e sul mese dopo, ed e\' la somma delle due righe',
      righe.every(f => J(f.mesi.map(m => (m.giacenza_canale_fine_kg === undefined ? '-' : m.giacenza_canale_fine_kg))) === J(attesoCanale(f))) && attesoCanale(pri)[3] !== '-',
      J(righe.map(f => f.mesi.map(m => m.giacenza_canale_fine_kg))));
    // Sui dati veri di oggi nessuna riga sposta niente: la risposta e' quella di prima.
    verifica('sui dati veri di oggi la chiusura sul canale non sposta niente', impianti.every(x => x.flussi.every(f => f.mesi.every(m => !('spostato_dal_canale_kg' in m) && !('giacenza_canale_fine_kg' in m)))));
  }

  // 10.3 IL RACCONTO DELL'ACI E LE GIACENZE: settembre di Gatim ACI non ancora
  // caricato su tutte e due le provenienze, il caso di ogni mese prima della
  // dichiarazione (lo script del revisore).
  if (ANNO === 2026) {
    const X = await conDichiarazioni(r => (gatimAci(r, 'Settembre') ? { ...r, caricata_inviata: false } : null), giro);
    const s = gatimDi(X);
    const righe = s.flussi.filter(f => f.canale === 'ACI');
    const g = gatimG(X);
    const frasi = righe.map(f => f.racconto.find(x => /^Oggi restano/.test(x)) || '');
    const somma = righe.reduce((a, f) => a + Math.round(f.resta_t * 1000), 0);
    verifica('Gatim ACI: 12,35 + 12,82 t sulle righe, 25,17 t nelle Giacenze', J(righe.map(f => f.resta_t)) === J([12.35, 12.82]) && g && g.giacenza_aci_t === 25.17 && somma === 25170, `${J(righe.map(f => f.resta_t))} / ${g && g.giacenza_aci_t}`);
    verifica('le due righe non si dicono «lo stesso numero delle Giacenze»: dicono il numero delle Giacenze, 25,17 t, delle due righe insieme',
      frasi.every(x => x.includes("le Giacenze hanno un numero solo per l'ACI, le due righe insieme: 25,17 t.") && !/e delle Giacenze/.test(x)), J(frasi));
  }
  // E su tutti i dati veri di oggi: «lo stesso numero ... delle Giacenze» solo
  // dove la riga e' l'unica del suo canale, e allora e' il numero delle Giacenze.
  {
    const CAMPO_G = { RETE: 'giacenza_portale_t', ACI: 'giacenza_aci_t', EXTRA_RACCOLTA: 'giacenza_extra_t' };
    const false_ = [];
    for (const s of impianti) {
      const g = (G.righe || []).find(x => x.tipo_destinazione !== 'stoc' && norm(x.sito) === norm(s.sito));
      for (const f of s.flussi) {
        const frase = (f.racconto || []).find(x => /e delle Giacenze\.$/.test(x));
        if (!frase) continue;
        const sola = s.flussi.filter(x => x.canale === f.canale).length === 1;
        if (!sola || !g || t2(g[CAMPO_G[f.canale]]) !== t2(f.resta_t)) false_.push(`${s.sito} ${f.canale} ${f.provenienza}`);
      }
    }
    verifica('«lo stesso numero delle Giacenze» solo dove e\' vero', !false_.length, false_.join(', '));
  }

  // 10.4 L'ATTESA DEL PORTALE SOLO SULL'ANNO IN CORSO: sul riepilogo del 2025
  // la storia di T-Cycle attribuiva a quell'anno 181,299 t di carichi del 2026.
  if (ANNO === 2026) {
    const R25 = (await conOra(ORA, () => fR({ anno: 2025 }))).j;
    const tc25 = R25.siti.find(s => /T-CYCLE/.test(s.sito) && s.tipo_destinazione !== 'stoc');
    const f25 = tc25 && tc25.flussi.find(f => f.canale === 'RETE');
    const st25 = f25 && f25.stoccaggio_stesso_sito;
    // I carichi in attesa sullo stoccaggio di T-Cycle nel file del portale, per anno di fine trasporto.
    const prim = new Map(DATI.archivi.PrimariaRete.map(r => [String(r.id_ordine || '').trim(), r]));
    const perAnno = {};
    for (const r of DATI.archivi.OrdineNonDichiarato.filter(r => /t-?cycle/i.test(r.destinazione || '') && !String(r.destinazione_secondaria || '').trim())) {
      const p = prim.get(String(r.ordine_primaria || '').trim());
      if (!p || !/^stoc/i.test(String(p.tipo_destinazione || ''))) continue;
      const a = String(r.fine_trasporto || '').slice(0, 4) || '?';
      perAnno[a] = (perAnno[a] || 0) + (Number(r.peso_non_dichiarato_kg) || 0);
    }
    verifica('nel file del portale le 181,299 t in attesa sullo stoccaggio di T-Cycle sono tutte carichi del 2026', J(Object.keys(perAnno)) === J(['2026']) && Math.round(perAnno['2026']) === 181299, J(perAnno));
    // Dalla seconda revisione del 13/10/2026 su un anno passato l'attesa conta i
    // soli carichi di quell'anno, in Giacenze e Dichiarazioni insieme: per
    // T-Cycle nel 2025 sono 0 kg, un numero vero e non piu' null
    // (prove/attesaDellAnno.mjs).
    verifica('e il riepilogo del 2025 non le attribuisce al 2025: niente 181,299 t, l\'attesa dei carichi del 2025 e\' 0',
      st25 && st25.in_attesa_t === 0 && !st25.frasi.some(x => /181,299/.test(x)) && !f25.racconto.some(x => /181,299/.test(x)), J(st25 && st25.frasi));
    verifica('mentre quello del 2026 le dice, col numero delle Giacenze', tcRete && tcRete.stoccaggio_stesso_sito && tcRete.stoccaggio_stesso_sito.in_attesa_t === 181.299);
  }
  verifica('niente scritto sugli archivi nemmeno qui', globalThis.__SCRITTE_DATI_VERI.length === 0, globalThis.__SCRITTE_DATI_VERI.join());
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
