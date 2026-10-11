// CHE COSA DI UN MESE E' DAVVERO USCITO (shared/usciteDichiarate.ts).
//
// Il fatto vero, 09/10/2026. Sul riepilogo di T-Cycle gennaio, febbraio, aprile e
// maggio stavano in giallo - cioe' «ancora da dichiarare» - quando quei PFU erano
// partiti da mesi. Parole dell'utente: «nel mese della dichiarazione caricata al
// portale laddove c'e' stata effettivamente l'uscita in nave, il quantitativo dei
// mesi precedenti viene comunque decurtato e tenerlo in giallo potrebbe
// confondere... con la nave di marzo sono andati via i quantitativi di gennaio e
// febbraio e parte di quelli di marzo, analogamente con la nave di giugno».
//
// Il conto non si deduce: il report delle dichiarazioni del portale ha una riga
// per ORDINE, con il peso agganciato e il giorno del caricamento. I numeri di
// queste prove sono quelli letti nel gestionale il 09/10/2026, e il riscontro e'
// doppio: la somma di quello che resta deve fare la giacenza del canale E, mese
// per mese, i chili che il file degli ordini non dichiarati aspetta ancora.
// npm run prove
import { meseArrivoDellaRiga, raccoglitoreUscite, allineaAllaGiacenza, chiudiFraIFlussi, copertureDelCaricamento } from '../base44/shared/usciteDichiarate.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const somma = (a) => a.reduce((s, x) => s + x, 0);
const uguali = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// --- T-CYCLE 2026: DUE NAVI, DIECI MESI ---
// Arrivato all'impianto, mese per mese (le primarie con destinazione impianto:
// quelle che arrivano al suo piazzale sono un'altra cosa e le dichiara chi le
// riceve dopo).
const TC_CONFERITO = [87740, 36420, 43320, 46280, 51280, 119580, 108680, 48420, 124800, 29060, 0, 0];
// Quello che il report del portale aggancia, per mese di ARRIVO.
const TC_USCITO = [87740, 36420, 43320, 46280, 51280, 77600, 0, 0, 0, 0, 0, 0];
// Le due dichiarazioni caricate: 146.860 kg il 03/04 (il nostro mese di marzo) e
// 195.780 kg il 26/06 (giugno). Giacenza: 0 di apertura + 695.580 - 342.640.
const TC_GIACENZA = 352940;
// E questo e' quello che il file degli ordini non dichiarati aspetta ancora,
// mese per mese: 114 righe, 352.940 kg.
const TC_PORTALE = [0, 0, 0, 0, 0, 41980, 108680, 48420, 124800, 29060, 0, 0];

console.log('T-CYCLE: I MESI TORNANO COL PORTALE, AL CHILO');
{
  const a = allineaAllaGiacenza(TC_CONFERITO, TC_USCITO, TC_GIACENZA);
  verifica('quello che resta di ogni mese e quello che il portale aspetta',
    uguali(a.resta, TC_PORTALE), JSON.stringify(a.resta));
  verifica('e la somma e la giacenza del canale, 352.940 kg',
    somma(a.resta) === TC_GIACENZA, String(somma(a.resta)));
  verifica('gennaio e febbraio sono usciti tutti: non sono piu da dichiarare',
    a.resta[0] === 0 && a.resta[1] === 0 && a.uscito[0] === 87740 && a.uscito[1] === 36420);
  verifica('marzo e uscito tutto, in due riprese: 22.700 con la nave di marzo e 20.620 con quella di giugno',
    a.uscito[2] === 43320 && a.resta[2] === 0);
  verifica('di giugno sono usciti 77.600 e restano 41.980',
    a.uscito[5] === 77600 && a.resta[5] === 41980);
  verifica('da luglio in poi non e uscito niente',
    a.uscito.slice(6).every(x => x === 0));
  verifica('niente e stato stimato: e tutto letto dal report',
    a.stimato.every(x => x === false) && a.non_allocato_kg === 0 && a.oltre_kg === 0);
  // IL DIFETTO SEGNALATO, in un numero: il vecchio conto mese per mese.
  const vecchio = TC_CONFERITO.map((c, i) => Math.max(0, c - [0, 0, 146860, 0, 0, 195780, 0, 0, 0, 0, 0, 0][i]));
  verifica('col vecchio conto le caselle dicevano 532.680 kg contro i 352.940 della colonna',
    somma(vecchio) === 532680, String(somma(vecchio)));
  verifica('e quattro mesi gia usciti restavano in giallo',
    vecchio[0] > 0 && vecchio[1] > 0 && vecchio[3] > 0 && vecchio[4] > 0);
}

console.log('IL CARICAMENTO DICE QUALI MESI HA PORTATO VIA');
{
  const caricamenti = [
    { giorno: '2026-04-03', kg: 146860, mesi: [87740, 36420, 22700, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { giorno: '2026-06-26', kg: 195780, mesi: [0, 0, 20620, 46280, 51280, 77600, 0, 0, 0, 0, 0, 0] },
  ];
  const marzo = copertureDelCaricamento(caricamenti, { caricata_inviata: true, caricata_il: '2026-04-03', quantita_kg: 146860 });
  verifica('la nave di marzo ha chiuso gennaio, febbraio e parte di marzo',
    marzo && marzo.mesi.length === 3 && marzo.mesi[0].mese === 'Gennaio' && marzo.mesi[2].kg === 22700, JSON.stringify(marzo));
  const giugno = copertureDelCaricamento(caricamenti, { caricata_inviata: true, caricata_il: '2026-06-26', quantita_kg: 195780 });
  verifica('quella di giugno il resto di marzo, aprile, maggio e parte di giugno',
    giugno && giugno.mesi.length === 4 && giugno.mesi[0].kg === 20620 && giugno.mesi[3].kg === 77600);
  verifica('i due caricamenti insieme fanno il dichiarato dell anno',
    marzo.kg + giugno.kg === 342640);
  // Se il giorno non torna si riconosce dal peso, con la tolleranza di 2 kg che
  // tutto il modulo usa; e se non torna nemmeno quello non si inventa niente.
  verifica('senza il giorno giusto si riconosce dal peso',
    (copertureDelCaricamento(caricamenti, { caricata_inviata: true, caricata_il: '2026-04-05', quantita_kg: 146861 }) || {}).giorno === '2026-04-03');
  verifica('e senza nessun riscontro si tace',
    copertureDelCaricamento(caricamenti, { caricata_inviata: true, caricata_il: '2026-05-10', quantita_kg: 50000 }) === null);
  verifica('una dichiarazione non caricata non copre niente',
    copertureDelCaricamento(caricamenti, { caricata_inviata: false, caricata_il: '2026-04-03', quantita_kg: 146860 }) === null);
}

console.log('IL MESE DI UN CARICO PASSATO DA UNO STOCCAGGIO E QUELLO DELLA SECONDARIA');
{
  // Il report scrive la fine trasporto della PRIMARIA, cioe' l'arrivo al
  // piazzale; all'impianto quel carico e' arrivato con la secondaria, e il
  // riepilogo lo conta nel mese della secondaria. Su Irigom, che nel 2026 ha
  // ricevuto 747,30 t in secondaria, senza questa regola tre mesi uscivano
  // negativi e il totale diceva 652,28 t invece di 637,44.
  const fine = (id) => ({ SEC26001754: '2026-01-09' }[id] || '');
  verifica('col numero della secondaria vale il giorno in cui e arrivata all impianto',
    meseArrivoDellaRiga({ destinazione: 'NAPPI SUD SRL', destinazione_secondaria: 'Irigom S.r.l.', ordine_secondaria: 'SEC26001754', fine_trasporto: '2025-12-22' }, fine) === '2026-01-09');
  verifica('senza secondaria vale la fine trasporto della primaria',
    meseArrivoDellaRiga({ destinazione: 'Irigom S.r.l.', fine_trasporto: '2026-03-18' }, fine) === '2026-03-18');
  verifica('se la secondaria nel gestionale non ha la data si ripiega sulla primaria',
    meseArrivoDellaRiga({ destinazione: 'NAPPI SUD SRL', destinazione_secondaria: 'Irigom S.r.l.', ordine_secondaria: 'SEC26009999', fine_trasporto: '2026-04-02' }, fine) === '2026-04-02');
  verifica('e senza nessuna data non si colloca', meseArrivoDellaRiga({ destinazione: 'Irigom S.r.l.' }, fine) === '');
}

console.log('IRIGOM 2026: LA GIACENZA TORNA CON LA REGOLA DELLA SECONDARIA, NON SENZA');
{
  const conferito = [375000, 361880, 392740, 368000, 343780, 423780, 499540, 272380, 375140, 117520, 0, 0];
  const uscito = [375000, 361880, 392740, 368000, 343780, 423780, 499540, 127600, 0, 0, 0, 0];
  // 385,36 t di apertura + 3.529,76 entrate - 3.277,68 dichiarate e caricate.
  const giacenza = 385360 + somma(conferito) - 3277680;
  verifica('la giacenza del canale e 637.440 kg', giacenza === 637440, String(giacenza));
  const a = allineaAllaGiacenza(conferito, uscito, giacenza);
  verifica('la somma dei mesi fa la giacenza', somma(a.resta) === 637440, String(somma(a.resta)));
  verifica('restano agosto per 144.780, settembre e ottobre interi',
    uguali(a.resta, [0, 0, 0, 0, 0, 0, 0, 144780, 375140, 117520, 0, 0]), JSON.stringify(a.resta));
  verifica('nessun mese va sotto zero', a.resta.every(x => x >= 0));
  verifica('e l apertura del 2025 e stata chiusa dalle dichiarazioni dell anno, fuori da questi mesi',
    somma(uscito) === 2892320 && 3277680 - somma(uscito) === 385360);
  // CONTRO-PROVA. Con la fine trasporto della primaria - cioe' senza la regola
  // della secondaria - gli agganci cadono nei mesi sbagliati: e' il numero che
  // usciva davvero, 652,28 t, con tre mesi negativi.
  const senzaRegola = [370000, 361600, 399200, 351980, 387750, 388530, 505620, 112800, 0, 0, 0, 0];
  const scarti = conferito.map((c, i) => c - senzaRegola[i]);
  verifica('senza quella regola tre mesi escono negativi', scarti.filter(x => x < 0).length === 3, JSON.stringify(scarti.filter(x => x < 0)));
  verifica('e la somma direbbe 652.280 kg invece di 637.440', somma(scarti) === 652280, String(somma(scarti)));
}

console.log('GATIM 2026: CHI DICHIARA MESE PER MESE TORNA UGUALE');
{
  const conferito = [78430, 74240, 66550, 74470, 71710, 112240, 0, 0, 122170, 17310, 0, 0];
  const uscito = [78430, 74240, 66550, 74470, 71710, 0, 0, 0, 0, 0, 0, 0];
  const a = allineaAllaGiacenza(conferito, uscito, somma(conferito) - 365400);
  verifica('resta giugno, settembre e ottobre: 251.720 kg',
    uguali(a.resta, [0, 0, 0, 0, 0, 112240, 0, 0, 122170, 17310, 0, 0]) && somma(a.resta) === 251720);
  verifica('e sono gli stessi mesi e gli stessi chili del file del portale', somma(a.resta) === 251720);
  verifica('niente stimato, niente fuori posto', a.stimato.every(x => !x) && a.non_allocato_kg === 0 && a.oltre_kg === 0);
}

console.log('QUELLO CHE IL REPORT NON HA ANCORA SI RIPARTISCE DAI MESI PIU VECCHI, E SI DICE');
{
  // Una dichiarazione caricata a portale dopo l'ultimo export del report: il
  // gestionale sa quanto, non sa su quali ordini. Il portale aggancia dal piu'
  // vecchio, e cosi' si fa - segnando che quella parte e' una stima.
  const conferito = [50000, 60000, 70000, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const a = allineaAllaGiacenza(conferito, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 100000);
  verifica('gennaio esce tutto e di febbraio 30.000: dal piu vecchio',
    uguali(a.resta, [0, 30000, 70000, 0, 0, 0, 0, 0, 0, 0, 0, 0]), JSON.stringify(a.resta));
  verifica('la somma resta la giacenza', somma(a.resta) === 100000);
  verifica('e i mesi toccati sono segnati come stimati',
    a.stimato[0] === true && a.stimato[1] === true && a.stimato[2] === false);
  // CONTRO-PROVA: senza la giacenza non si ripartisce niente, e i mesi dicono
  // solo quello che il report dice.
  const senza = allineaAllaGiacenza(conferito, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], null);
  verifica('senza il numero certo non si inventa un ordine di uscita',
    somma(senza.resta) === 180000 && senza.stimato.every(x => !x));
}

console.log('DOVE IL CONTO NON SI CHIUDE NON SI AGGIUSTA: SI DICE');
{
  // Il portale ha agganciato piu' di quanto risulti dalle nostre dichiarazioni
  // caricate: e' il caso delle dichiarazioni che il portale ha e il gestionale no
  // (01/10/2026). Non si tocca niente, e la differenza si scrive.
  const a = allineaAllaGiacenza([50000, 50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [50000, 50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 30000);
  verifica('oltre_kg dice di quanto il portale e piu avanti', a.oltre_kg === 30000, String(a.oltre_kg));
  verifica('e i mesi restano quelli che dice il report', somma(a.resta) === 0 && a.stimato.every(x => !x));
  // Un aggancio che cade in un mese dove non e' arrivato tanto: si sposta sui
  // mesi prima, e quello che non trova posto si dichiara non allocato.
  const b = allineaAllaGiacenza([10000, 1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 5000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], null);
  verifica('l eccesso di un mese si scala dai mesi prima',
    uguali(b.resta, [6000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), JSON.stringify(b.resta));
  const c = allineaAllaGiacenza([0, 1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 5000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], null);
  verifica('e quello che non trova posto da nessuna parte si dice', c.fuori_mese_kg === 4000, String(c.fuori_mese_kg));
  verifica('niente va mai sotto zero', c.resta.every(x => x >= 0) && b.resta.every(x => x >= 0));
}

console.log('IL RACCOGLITORE: SOLO LA RETE, SOLO L ANNO CHIESTO, SOLO IL NOSTRO MESE');
{
  const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const fine = (id) => ({ SEC26001754: '2026-01-09' }[id] || '');
  const u = raccoglitoreUscite({ chiaveDi: norm, fineSecondaria: fine, anno: 2026 });
  u.segna({ destinazione: 'T-CYCLE INDUSTRIES SRL', fine_trasporto: '2026-01-14', data_dichiarazione: '2026-04-03', peso_associato_kg: 3314, prodotto: '.class2' });
  u.segna({ destinazione: 'T-CYCLE INDUSTRIES SRL', fine_trasporto: '2026-01-20', data_dichiarazione: '2026-04-03', peso_associato_kg: 28340, prodotto: '.class1' });
  // Una classe 9 e' ACI: la giacenza di rete non la tocca.
  u.segna({ destinazione: 'T-CYCLE INDUSTRIES SRL', fine_trasporto: '2026-01-21', data_dichiarazione: '2026-04-03', peso_associato_kg: 9999, prodotto: '.class9' });
  // Un ordine di un altro anno resta fuori dai dodici mesi: dal 11/10/2026 va
  // nella casella dall'anno prima, col giorno del suo caricamento.
  u.segna({ destinazione: 'T-CYCLE INDUSTRIES SRL', fine_trasporto: '2025-10-02', data_dichiarazione: '2026-01-15', peso_associato_kg: 88460, prodotto: '.class1' });
  // E uno dell'anno dopo non c'entra per niente.
  u.segna({ destinazione: 'T-CYCLE INDUSTRIES SRL', fine_trasporto: '2027-01-05', data_dichiarazione: '2027-02-15', peso_associato_kg: 777, prodotto: '.class1' });
  // Un carico passato dal piazzale: va sul mese della secondaria e sull'impianto
  // che l'ha ricevuta, non sullo stoccaggio.
  u.segna({ destinazione: 'NAPPI SUD SRL', destinazione_secondaria: 'Irigom S.r.l.', ordine_secondaria: 'SEC26001754', fine_trasporto: '2025-12-22', data_dichiarazione: '2026-02-11', peso_associato_kg: 14840, prodotto: '.class1' });
  const tc = u.per(norm('T-CYCLE INDUSTRIES SRL'));
  verifica('gennaio di T-Cycle porta i due agganci di rete, non l ACI e non il 2025',
    tc.mesi[0] === 31654 && somma(tc.mesi) === 31654, JSON.stringify(tc.mesi));
  const del0304 = tc.caricamenti.find(c => c.giorno === '2026-04-03');
  verifica('e il caricamento del 03/04 e uno solo, col suo totale',
    tc.caricamenti.filter(c => c.giorno === '2026-04-03').length === 1 && del0304.kg === 31654 && del0304.prima_kg === 0, JSON.stringify(tc.caricamenti));
  // LA CASELLA DALL'ANNO PRIMA (11/10/2026): il carico del 2025 agganciato il
  // 15/01/2026 e' apertura uscita, e il caricamento lo dice.
  const del1501 = tc.caricamenti.find(c => c.giorno === '2026-01-15');
  verifica('il carico del 2025 agganciato il 15/01 e apertura che esce, non un mese dell anno',
    tc.ha_anno === true && !!del1501 && del1501.prima_kg === 88460 && somma(del1501.mesi) === 0, JSON.stringify(del1501));
  verifica('e si conta solo se agganciato dopo la lettura del 31/12',
    u.primaDopo(norm('T-CYCLE INDUSTRIES SRL'), '2025-12-31') === 88460 && u.primaDopo(norm('T-CYCLE INDUSTRIES SRL'), '2026-01-15') === 0);
  verifica('il 2027 resta fuori da tutto', !tc.caricamenti.some(c => c.giorno === '2027-02-15') && somma(tc.mesi) === 31654);
  const ir = u.per(norm('Irigom S.r.l.'));
  verifica('la secondaria arrivata il 09/01 sta nel gennaio di Irigom',
    !!ir && ir.mesi[0] === 14840 && somma(ir.mesi) === 14840, JSON.stringify(ir && ir.mesi));
  verifica('e sullo stoccaggio non c e niente', u.per(norm('NAPPI SUD SRL')) === null);
  verifica('un impianto mai visto non da una riga vuota', u.per('CHISSACHI') === null);
}

console.log("LA CASELLA DALL'ANNO PRIMA: LA SOMMA DELLA RIGA E' LA GIACENZA, ANCHE A GENNAIO");
{
  // Il caso dell'audit (chiusura, 11/10/2026): Irigom a gennaio 2027, apertura
  // di 600 t scritta dalla chiusura, 300 t arrivate, nessuna nave ancora. Senza
  // la casella la riga diceva 300 contro una giacenza di 900, e la pagina
  // «a portale risultano dichiarati 600.000 kg in piu'», che era falso.
  const conferito = [300000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const zero = new Array(12).fill(0);
  const senza = allineaAllaGiacenza(conferito, zero, 900000);
  verifica('controprova: senza la casella la riga dice 300 e accende il falso avviso',
    somma(senza.resta) === 300000 && senza.oltre_kg === 600000, JSON.stringify([somma(senza.resta), senza.oltre_kg]));
  const con = allineaAllaGiacenza(conferito, zero, 900000, { conferito: 600000, uscito: 0 });
  verifica('con la casella la riga fa 900, la giacenza, e nessun avviso',
    somma(con.resta) + con.prima.resta === 900000 && con.oltre_kg === 0 && con.non_allocato_kg === 0,
    JSON.stringify([somma(con.resta), con.prima, con.oltre_kg]));
  // Marzo: la nave porta via 650 t. Il portale aggancia dal piu' vecchio: tutta
  // l'apertura (letta dal report: 600 t di carichi del 2026) e 50 t di gennaio.
  const marzo = allineaAllaGiacenza(conferito, [50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 250000, { conferito: 600000, uscito: 600000 });
  verifica('la nave svuota prima la casella, poi gennaio', marzo.prima.resta === 0 && marzo.resta[0] === 250000 && !marzo.prima.stimato && !marzo.stimato[0]);
  // Se il report non ha ancora la nave, il gestionale la ripartisce dal piu'
  // vecchio, e la casella e' la prima a svuotarsi: segnata come stimata.
  const stimata = allineaAllaGiacenza(conferito, zero, 250000, { conferito: 600000, uscito: 0 });
  verifica('senza il report la nave svuota la casella e 50 t di gennaio, stimati',
    stimata.prima.resta === 0 && stimata.prima.stimato && stimata.resta[0] === 250000 && stimata.stimato[0]);
  // Senza casella i dodici mesi fanno esattamente quello che facevano: e' il
  // caso di T-Cycle, che il 09/10 tornava al chilo.
  const tc = allineaAllaGiacenza(TC_CONFERITO, TC_USCITO, TC_GIACENZA, null);
  verifica('senza casella T-Cycle torna come prima, mese per mese', uguali(tc.resta, TC_PORTALE) && tc.prima.conferito === 0 && tc.prima.resta === 0);
  // Il carico del 2025 uscito piu' dell'apertura netta: l'eccesso resta fuori dai
  // mesi dell'anno (si dice in prima.oltre_kg), e la riga fa sempre la giacenza.
  const troppo = allineaAllaGiacenza([10000, 10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], zero, 12000, { conferito: 5000, uscito: 8000 });
  verifica('la riga fa la giacenza anche quando dal report esce piu dell apertura', somma(troppo.resta) + troppo.prima.resta === 12000, JSON.stringify(troppo));
  verifica("e l'eccesso della casella si dice, senza diventare un avviso", troppo.prima.oltre_kg === 3000 && troppo.oltre_kg === 0, JSON.stringify(troppo.prima));

  // IRIGOM, 2026, I NUMERI VERI DELL'11/10/2026 (visto in produzione dopo la
  // pubblicazione). Apertura 385,36 t; il report aggancia alle dichiarazioni del
  // 2026 circa 1.729 t arrivate nel 2025; dei carichi del 2026 ne aggancia 2.878 t;
  // la giacenza del canale e' 652,84. L'eccesso della casella si spostava su
  // gennaio, febbraio e avanti: tutti i mesi risultavano dichiarati, la colonna
  // faceva 0 e la pagina diceva «652.840 kg dichiarati in piu'».
  const IR_CONFERITO = [375000, 361880, 392740, 368000, 343780, 423780, 499540, 272380, 375140, 132920, 0, 0];
  const IR_REPORT = [375000, 361880, 392740, 368000, 343780, 423780, 499540, 113280, 0, 0, 0, 0];
  const ir = allineaAllaGiacenza(IR_CONFERITO, IR_REPORT, 652840, { conferito: 385360, uscito: 1729000 });
  verifica('Irigom: la riga «Da dichiarare» fa la giacenza, 652,84 t', somma(ir.resta) + ir.prima.resta === 652840, JSON.stringify([somma(ir.resta), ir.prima]));
  verifica('nessun falso «dichiarati in piu\'» e niente di non allocato', ir.oltre_kg === 0 && ir.non_allocato_kg === 0, JSON.stringify([ir.oltre_kg, ir.non_allocato_kg]));
  verifica("la casella esce tutta (l'apertura e' gia' dichiarata) e l'eccesso degli anni prima si dice a parte", ir.prima.resta === 0 && ir.prima.oltre_kg === 1729000 - 385360, JSON.stringify(ir.prima));
  verifica('settembre e ottobre restano da dichiarare: i mesi del 2026 non li svuotano gli arrivi del 2025', ir.resta[8] === 375140 && ir.resta[9] === 132920, JSON.stringify(ir.resta));
}

console.log("UN CANALE CON PIU' RIGHE SI CHIUDE SUL CANALE");
{
  // L'ACI di un impianto: primaria con l'apertura (20 t) e 4 t arrivate in
  // secondaria. La dichiarazione di 22 t e' scritta sulla riga della secondaria:
  // quella riga ha in pancia 4 t, le altre 18 escono dalla casella della
  // primaria. Giacenza del canale: 20 + 4 - 22 = 2.
  const zero = new Array(12).fill(0);
  const p = allineaAllaGiacenza(zero, zero, 20000, { conferito: 20000, uscito: 0 });
  const s = allineaAllaGiacenza([0, 4000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 4000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4000 - 22000);
  verifica('controprova: riga per riga la secondaria non assorbe 18 t e la primaria tiene tutto',
    s.non_allocato_kg === 18000 && p.prima.resta === 20000);
  const [p2, s2] = chiudiFraIFlussi([p, s]);
  verifica('sul canale le 18 t escono dalla casella dell altra riga, stimate',
    p2.prima.resta === 2000 && p2.prima.stimato && s2.non_allocato_kg === 0, JSON.stringify([p2.prima, s2.non_allocato_kg]));
  verifica('e la somma delle righe del canale e la giacenza del canale',
    somma(p2.resta) + p2.prima.resta + somma(s2.resta) + s2.prima.resta === 2000);
  verifica('gli originali non si toccano', p.prima.resta === 20000 && s.non_allocato_kg === 18000);
  // Quello che nemmeno le altre righe assorbono resta non allocato, e si dice.
  const [, s3] = chiudiFraIFlussi([allineaAllaGiacenza(zero, zero, 1000, { conferito: 1000, uscito: 0 }), s]);
  verifica('quello che il canale non assorbe resta non allocato', s3.non_allocato_kg === 17000, String(s3.non_allocato_kg));
}

console.log('IL CARICAMENTO CHE HA CHIUSO ANCHE L APERTURA LO DICE');
{
  const c = [{ giorno: '2027-03-20', kg: 650000, prima_kg: 600000, mesi: [50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }];
  const x = copertureDelCaricamento(c, { caricata_inviata: true, caricata_il: '2027-03-20', quantita_kg: 650000 });
  verifica("la nave di marzo ha chiuso prima l'anno prima, poi gennaio",
    x && x.prima_kg === 600000 && x.mesi[0].mese === "dall'anno prima" && x.mesi[0].kg === 600000 && x.mesi[1].mese === 'Gennaio', JSON.stringify(x));
}

console.log('LA FUNZIONE E LE PAGINE USANO QUESTA REGOLA, NON UN ALTRA');
{
  const { readFileSync } = await import('node:fs');
  const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  const f = sorgente('base44/functions/riepilogoDichiarazioni/entry.ts');
  verifica('il riepilogo raccoglie gli agganci dal report mentre lo legge',
    f.includes('uscite.segna(r)') && f.includes('raccoglitoreUscite({ chiaveDi: norm'));
  verifica('e usa la fine trasporto della secondaria per i carichi passati dal piazzale',
    f.includes('fineSecondaria: (id) => fineSecondarie.get(id)'));
  // Dal 11/10/2026 su tutti e tre i canali, con la casella dall'anno prima.
  verifica('il conto si chiude sulla giacenza del canale, su ogni riga, con la casella dall anno prima',
    /allineaAllaGiacenza\(\s*grezzi\.map\(m => m\.conferito_kg\),\s*semi,\s*aperturaKg \+ conferitoKg - caricatoKg,\s*casella \? \{ conferito: casella\.conferito, uscito: reteDiretta \? casella\.uscito : 0 \} : null,\s*\)/.test(f.replace(/\r/g, '')));
  verifica('e un canale con piu righe si chiude sul canale', f.includes('chiudiFraIFlussi(suoi.map(x => x.allineato))'));
  verifica('quello che resta di un mese e il resto, non gli ingressi meno il dichiarato del mese',
    f.includes('da_dichiarare_kg: m.non_dovuta ? 0 : allineato.resta[i]')
    && !f.includes('da_dichiarare_kg: nonDovuta ? 0 : Math.max(0, totale - caricatoAPortale)'));
  verifica('il report vale solo per la rete diretta: su ACI ed extra il mese parte dal suo dichiarato',
    f.includes("const reteDiretta = canale === 'RETE' && !provenienza")
    && f.includes('grezzi.map(m => Math.min(m.conferito_kg, m.caricato_kg))'));
  verifica('e la riga porta uscito, resta e le due differenze da capire',
    /uscito_t: /.test(f) && /resta_t: /.test(f) && /uscito_oltre_kg: /.test(f) && /uscito_non_allocato_kg: /.test(f));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
