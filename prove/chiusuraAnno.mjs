// Prova della procedura di chiusura d'anno (base44/shared/chiusuraAnno.ts),
// 23/09/2026.
//
// Il fatto che la procedura esiste per evitare: al passaggio 2025-2026 ci sono
// 3 secondarie finite a dicembre 2025 e chiuse a portale il 07/01/2026 (41.900
// kg), piu' primarie e terziarie chiuse fra gennaio e febbraio. Una fotografia
// del 31/12 presa e basta li perde per sempre: nella fotografia non ci sono,
// perche' il portale non li aveva ancora chiusi, e fra i movimenti dell'anno
// nuovo nemmeno, perche' per noi sono finiti a dicembre.
//
// La lettera si legge sul file vero, "Giacenze Ecotyre al 31-12-2025.xlsx":
// due tabelle (piazzali per classe, impianti per EER), la tabella degli
// impianti ripetuta due volte con numeri diversi e, nel testo, una data che non
// e' quella del nome del file.
//
// In coda c'e' anche il dossier Excel: il componente e' JSX, quindi si
// impacchetta con esbuild (quello di vite) e si chiama la sola funzione che
// scrive il file, senza grafica - come in prove/controlloRilevazione.mjs.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  giornoChiusura, GRUPPO_TERZIARIE, movimentoChiusura, elencoDicembre, rettificaDicembre,
  confrontoPiazzale, cosaChiedereAlPortale, leggiLetteraGiacenze,
  confrontoLettera, letteraDelPiazzale, preparaChiusura, vociDelSito,
} from '../base44/shared/chiusuraAnno.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Un movimento: id, kg, fine trasporto, chiusura a portale.
const mov = (id, kg, finito, chiuso, opzioni = {}) => movimentoChiusura(
  { id_ordine: id, numero_fir: opzioni.fir || `FIR${id}`, peso_effettivo: kg, trasporto_finito_il: finito, ordine_chiuso_il: chiuso },
  {
    sito: opzioni.sito || 'nappi sud', nome: opzioni.nome || 'NAPPI SUD SRL',
    ruolo: opzioni.ruolo || 'stoc', tipo: opzioni.tipo || 'primaria',
    canale: opzioni.canale || 'RETE', verso: opzioni.verso || 'ingresso',
    classe: opzioni.classe || 'P', controparte: opzioni.controparte || 'C.L. Service',
  },
);

const g = (giorno) => `${giorno}T08:00:00Z`;

// Il piazzale: l'ultima rilevazione e' del 31/10, poi i movimenti dell'anno.
const RILEVAZIONE_31_10 = { sito: 'NAPPI SUD SRL', data_rilevazione: '2025-10-31', class1_kg: 60000, class2_kg: 40000, class3_kg: 0, class4_kg: 0, class9_kg: 0 };
const MOVIMENTI = [
  // novembre, chiuso subito: il portale lo ha gia'
  mov('ET25110020', 5000, g('2025-11-20'), g('2025-11-25')),
  // novembre, ancora aperto alla fotografia: non e' di dicembre, ma la fotografia non lo contiene
  mov('ET25112700', 4000, g('2025-11-27'), g('2026-01-05')),
  // dicembre, chiuso prima della fotografia: il portale lo ha gia'
  mov('ET25120500', 10000, g('2025-12-05'), g('2025-12-09')),
  // dicembre, chiuso a gennaio: nell'elenco
  mov('ET25122800', 8000, g('2025-12-28'), g('2026-01-12'), { classe: 'M' }),
  // le tre secondarie del caso vero: 41.900 kg usciti a dicembre, chiusi il 07/01
  mov('SEC25121800', 14000, g('2025-12-18'), g('2026-01-07'), { tipo: 'secondaria', verso: 'uscita', controparte: 'IRIGOM SRL' }),
  mov('SEC25121900', 13900, g('2025-12-19'), g('2026-01-07'), { tipo: 'secondaria', verso: 'uscita', controparte: 'IRIGOM SRL' }),
  mov('SEC25122200', 14000, g('2025-12-22'), g('2026-01-07'), { tipo: 'secondaria', verso: 'uscita', classe: 'M', controparte: 'TECNOGUM SRL' }),
  // l'extra raccolta: a portale non c'e', si elenca e basta
  mov('EXT25122900', 2000, g('2025-12-29'), null, { canale: 'EXTRA_RACCOLTA' }),
  // l'anno nuovo: non e' di questa chiusura
  mov('ET26010300', 3000, g('2026-01-03'), g('2026-01-08')),
  // un terminato senza fine trasporto non sta in nessun periodo
  mov('ET25999999', 7000, null, g('2026-01-04')),
];
// Un impianto: le terziarie di dicembre chiuse a febbraio. Le terziarie non
// sono un canale - escono verso le cementerie e la giacenza di PFU non la
// toccano - e stanno in un gruppo loro, come in Giacenze.
const terziaria = { sito: 'innorec', nome: 'INNOREC SRL', ruolo: 'imp', tipo: 'terziaria', canale: GRUPPO_TERZIARIE, verso: 'uscita', classe: 'ND', controparte: 'Cementeria' };
const TERZIARIE = [
  mov('TER25123000', 20000, g('2025-12-30'), g('2026-02-04'), terziaria),
  mov('TER25123100', 18000, g('2025-12-31'), g('2026-02-06'), terziaria),
];

console.log("L'ELENCO DI DICEMBRE: QUELLO CHE LA FOTOGRAFIA NON HA ANCORA VISTO");
const elenco = elencoDicembre([...MOVIMENTI, ...TERZIARIE], 2025);
const ids = elenco.voci.map(v => v.id_ordine).sort();
verifica('ci sono solo i movimenti di dicembre non ancora chiusi alla fotografia',
  JSON.stringify(ids) === JSON.stringify(['EXT25122900', 'ET25122800', 'SEC25121800', 'SEC25121900', 'SEC25122200', 'TER25123000', 'TER25123100'].sort()), JSON.stringify(ids));
verifica('chi e\' stato chiuso prima della fotografia non c\'e\'', !ids.includes('ET25120500'));
verifica('l\'anno nuovo non c\'entra', !ids.includes('ET26010300'));
verifica('senza fine trasporto non sta in nessun periodo', !ids.includes('ET25999999'));
verifica('il taglio e\' il 31 dicembre', elenco.dal === '2025-12-01' && elenco.al === '2025-12-31' && elenco.fotografia_del === '2025-12-31');

console.log('QUANTO PESA, UN CANALE PER VOLTA');
const rete = elenco.per_canale.RETE;
verifica('la rete: 4 movimenti, 8.000 in entrata e 41.900 in uscita',
  rete.n === 4 && rete.ingressi_kg === 8000 && rete.uscite_kg === 41900 && rete.netto_kg === -33900, JSON.stringify(rete));
verifica('le tre secondarie del caso vero fanno 41.900 kg', rete.uscite === 3 && rete.uscite_kg === 41900);
verifica('l\'extra raccolta ha il suo totale, mai sommato alla rete', elenco.per_canale.EXTRA_RACCOLTA.n === 1 && elenco.per_canale.EXTRA_RACCOLTA.netto_kg === 2000);
verifica('nessun totale fra i canali', !('totale' in elenco.per_canale) && !('netto_kg' in elenco.per_canale));
verifica('i formulari si contano per numero, una volta sola', rete.formulari === 4, String(rete.formulari));

console.log('APERTI DA PRIMA DI DICEMBRE: RARI, MA HANNO LO STESSO EFFETTO');
verifica('il movimento del 27/11 ancora aperto si dice a parte', elenco.n_prima === 1 && elenco.aperti_prima[0].id_ordine === 'ET25112700');
verifica('e non si mescola con l\'elenco di dicembre', !ids.includes('ET25112700') && elenco.per_canale_prima.RETE.ingressi_kg === 4000);

console.log('PER SITO, CANALE E CLASSE, CON PESO E ID ORDINE');
const nappi = elenco.siti.find(s => s.sito === 'nappi sud');
const innorec = elenco.siti.find(s => s.sito === 'innorec');
verifica('il piazzale ha le sue voci', nappi && nappi.voci.length === 5 && nappi.per_canale.RETE.n === 4);
verifica('l\'impianto ha le sue terziarie', innorec && innorec.voci.length === 2 && innorec.voci.every(v => v.tipo === 'terziaria' && v.ruolo === 'imp'));
verifica('ogni voce porta peso, classe e id ordine', nappi.voci.every(v => typeof v.kg === 'number' && v.classe && 'id_ordine' in v));
verifica('e il perche\' sta scritto', nappi.voci.find(v => v.id_ordine === 'SEC25121800').perche.includes('chiuso a portale il 2026-01-07'));

console.log('CHI E\' INSIEME IMPIANTO E PIAZZALE RESTA DIVISO');
// Irigom e T-Cycle hanno due giacenze, lette in due modi diversi: quello che
// arriva al loro piazzale non e' quello che hanno in impianto.
const dueRuoli = elencoDicembre([
  mov('SEC25122600', 9000, g('2025-12-26'), g('2026-01-09'), { sito: 'irigom', nome: 'IRIGOM SRL', ruolo: 'stoc', tipo: 'secondaria', classe: 'ACI', canale: 'ACI' }),
  mov('TER25122700', 20340, g('2025-12-27'), g('2026-02-03'), { sito: 'irigom', nome: 'IRIGOM SRL', ruolo: 'imp', tipo: 'terziaria', canale: GRUPPO_TERZIARIE, verso: 'uscita', classe: 'ND' }),
], 2025);
verifica('due gruppi, uno per ruolo', dueRuoli.siti.length === 2 && dueRuoli.siti.map(s => s.chiave).sort().join(' ') === 'irigom|imp irigom|stoc', JSON.stringify(dueRuoli.siti.map(s => s.chiave)));
verifica('il piazzale vede solo quello che arriva a lui', vociDelSito(dueRuoli, 'irigom', 'stoc').voci.map(v => v.id_ordine).join() === 'SEC25122600');
verifica('e l\'impianto solo le sue uscite', vociDelSito(dueRuoli, 'irigom', 'imp').voci.map(v => v.id_ordine).join() === 'TER25122700');

console.log('CHE COSA CHIEDERE AL PORTALE');
const piazzali = [{ chiave: 'nappi sud', nome: 'NAPPI SUD SRL', rilevazioni: [RILEVAZIONE_31_10], movimenti: MOVIMENTI }];
const impianti = [{ chiave: 'innorec', nome: 'INNOREC SRL', movimenti: TERZIARIE }, { chiave: 'gatim', nome: 'GATIM SRL', movimenti: [] }];
const richieste = cosaChiedereAlPortale({ anno: 2025, piazzali, impianti, letture: {}, letture_impianti: {}, elenco });
verifica('una richiesta per piazzale e una per impianto', richieste.length === 3);
verifica('al piazzale si chiede il saldo per classe', richieste[0].tipo === 'piazzale' && JSON.stringify(richieste[0].campi) === JSON.stringify(['P', 'M', 'G1', 'G2', 'ACI']) && richieste[0].stato === 'da_chiedere');
verifica('e si dice dove si legge', richieste[0].dove.includes("Unita' Locali di Stoccaggio"));
verifica('all\'impianto si chiede il file degli ordini non dichiarati', richieste[1].tipo === 'impianto' && richieste[1].cosa.includes('2025-12-31'));
verifica('accanto alla richiesta c\'e\' quanto pende di dicembre', richieste[0].dicembre.n === 5 && richieste[1].dicembre.n === 2);
verifica('una lettura gia\' inserita si vede', cosaChiedereAlPortale({ anno: 2025, piazzali, impianti, letture: { 'nappi sud': { P: 1 } } })[0].stato === 'inserita');

console.log('SENZA DECISIONI NON SI SALVA');
// La lettura vera del portale al 31/12: le uscite non ancora scalate e
// l'ingresso del 28/12 non ancora aggiunto.
const LETTURA = { P: 75000, M: 40000, G1: 0, G2: 0, ACI: 0 };
const nudo = confrontoPiazzale(piazzali[0], { anno: 2025, lettura: LETTURA, voci: nappi.voci, aperti_prima: nappi.aperti_prima });
verifica('le voci senza decisione sono tutte li\'', nudo.rettifica.da_decidere.length === 4, String(nudo.rettifica.da_decidere.length));
verifica('l\'extra raccolta non si decide: a portale non c\'e\'', nudo.rettifica.fuori_portale.length === 1 && nudo.rettifica.fuori_portale[0].canale === 'EXTRA_RACCOLTA');
verifica('il salvataggio e\' bloccato, e si dice perche\'', nudo.pronto === false && nudo.blocchi.some(b => b.tipo === 'dicembre_da_decidere'));
verifica('senza lettura del portale non si salva', confrontoPiazzale(piazzali[0], { anno: 2025, voci: nappi.voci }).blocchi.some(b => b.tipo === 'lettura_mancante'));
// Un campo sfiorato e poi cancellato non arriva: senza questo controllo il
// piazzale risulterebbe letto a zero e si salverebbe azzerato.
verifica('una lettura senza nemmeno un numero non e\' una lettura',
  confrontoPiazzale(piazzali[0], { anno: 2025, lettura: {}, voci: [] }).blocchi.some(b => b.tipo === 'lettura_mancante'));
verifica('uno zero scritto apposta invece vale: piazzale verificato e vuoto',
  confrontoPiazzale({ chiave: 'vuoto', nome: 'VUOTO', rilevazioni: [], movimenti: [] }, { anno: 2025, lettura: { P: 0 }, voci: [] }).pronto === true);
verifica('e la richiesta al portale resta da chiedere', cosaChiedereAlPortale({ anno: 2025, piazzali, impianti, letture: { 'nappi sud': {} } })[0].stato === 'da_chiedere');

console.log('LA RETTIFICA: DALLA LETTURA DEL PORTALE ALLA FOTOGRAFIA DA SALVARE');
const DECISIONI = {
  'nappi sud|stoc|secondaria|uscita|SEC25121800|P': 'rettifica',
  'nappi sud|stoc|secondaria|uscita|SEC25121900|P': 'rettifica',
  'nappi sud|stoc|secondaria|uscita|SEC25122200|M': 'rettifica',
  'nappi sud|stoc|primaria|ingresso|ET25122800|M': 'rettifica',
};
const pieno = confrontoPiazzale(piazzali[0], { anno: 2025, lettura: LETTURA, voci: nappi.voci, aperti_prima: nappi.aperti_prima, decisioni: DECISIONI });
verifica('le uscite di dicembre si tolgono: P 75.000 - 27.900 = 47.100', pieno.rettifica.classi.P === 47100, JSON.stringify(pieno.rettifica.classi));
verifica('e l\'ingresso si aggiunge: M 40.000 - 14.000 + 8.000 = 34.000', pieno.rettifica.classi.M === 34000);
verifica('la lettura del portale resta com\'era, accanto alla fotografia da salvare', pieno.lettura.P === 75000 && pieno.da_salvare.P === 47100);
verifica('ora si puo\' salvare', pieno.pronto === true && pieno.blocchi.length === 0);
verifica('quello che gia\' c\'era nella fotografia non si tocca',
  confrontoPiazzale(piazzali[0], { anno: 2025, lettura: LETTURA, voci: nappi.voci, decisioni: { ...DECISIONI, 'nappi sud|stoc|primaria|ingresso|ET25122800|M': 'gia_nel_portale' } }).rettifica.classi.M === 26000);

console.log('IL CONFRONTO, CON LO STESSO CONTO DELLE RILEVAZIONI DI TUTTI I GIORNI');
const attesaP = pieno.attesa.find(c => c.classe === 'P');
const attesaM = pieno.attesa.find(c => c.classe === 'M');
verifica('l\'attesa parte dalla rilevazione precedente', pieno.precedente_del === '2025-10-31' && attesaP.precedente_kg === 60000);
verifica('P attesa 51.100, M attesa 34.000', attesaP.atteso === 51100 && attesaM.atteso === 34000, JSON.stringify([attesaP.atteso, attesaM.atteso]));
const lettoP = pieno.verifica_lettura.classi.find(c => c.classe === 'P');
verifica('la lettura nuda si scosta di quello che il portale non ha ancora scalato', lettoP.scarto === 23900 && pieno.verifica_lettura.scostano.includes('P'));
const salvataM = pieno.verifica_da_salvare.classi.find(c => c.classe === 'M');
verifica('dopo la rettifica la classe M quadra', salvataM.scarto === 0);
// Resta lo scarto del movimento di novembre ancora aperto: e' il motivo per cui
// gli aperti di prima si dicono invece di nasconderli.
const salvataP = pieno.verifica_da_salvare.classi.find(c => c.classe === 'P');
verifica('quello che resta e\' il movimento di novembre ancora aperto', salvataP.scarto === -4000 && pieno.aperti_prima.n === 1, String(salvataP.scarto));

console.log('IL PORTALE PUO\' AVERLO MESSO NELLA CLASSE SBAGLIATA');
// L'eco del 16/09 su Nappi Sud: il totale torna, la ripartizione no.
const storto = [mov('ET25123000', 6160, g('2025-12-30'), g('2026-01-04'), { classe: 'M' })];
const elencoStorto = elencoDicembre(storto, 2025);
const rettStorta = rettificaDicembre({ P: 30000, M: 10000 }, elencoStorto.voci, { [elencoStorto.voci[0].chiave]: 'classe:P' });
verifica('il peso si sposta dalla classe sbagliata a quella giusta', rettStorta.classi.P === 23840 && rettStorta.classi.M === 16160, JSON.stringify(rettStorta.classi));
verifica('e il totale del canale non cambia', (rettStorta.classi.P + rettStorta.classi.M) === 40000);
verifica('una classe che non si riconosce si dice, non si indovina',
  rettificaDicembre({ P: 1000 }, elencoDicembre([mov('ET25123100', 500, g('2025-12-30'), null, { classe: 'ND' })], 2025).voci, { 'nappi sud|stoc|primaria|ingresso|ET25123100|ND': 'rettifica' }).non_applicabili.length === 1);
verifica('una classe che resterebbe negativa blocca il salvataggio',
  confrontoPiazzale({ chiave: 'x', nome: 'X', rilevazioni: [], movimenti: [] }, {
    anno: 2025, lettura: { P: 1000 }, voci: elencoStorto.voci.map(v => ({ ...v, verso: 'uscita', kg: 50000, classe: 'P' })),
    decisioni: { [elencoStorto.voci[0].chiave]: 'rettifica' },
  }).blocchi.some(b => b.tipo === 'classe_negativa'));

console.log('LA LETTERA DELLE GIACENZE DI FINE ANNO, COM\'E\' DAVVERO');
// Le righe sono quelle del file vero, "Giacenze Ecotyre al 31-12-2025.xlsx".
const FOGLIO_STOCCAGGI = [
  ['OGGETTO: Comunicazione giacenze impianti di trattamento e stoccaggi al 31/12/2024', '', '', '', '', ''],
  ['DICHIARA', '', '', '', '', ''],
  ['GIACENZE STOCCAGGI', '', '', '', '', ''],
  ['EER 16.01.03 [Kg]', 'P', 'M', 'G1', 'G2', 'ACI'],
  ['NAPPI SUD SRL', 14840, 6440, 13680, '', 0],
  ['RPN SRL', '', '', '', '', ''],
  ['IRIGOM SRL', '', '', '', '', 6360],
  ['TOTALE', 14840, 6440, 13680, 0, 6360],
  ['SMOCO S.R.L.', '', '', '', '', ''],
];
const FOGLIO_IMPIANTI = [
  ['GIACENZE IMPIANTI', 'EER 16.01.03', 'CSS-C', 'EER 19.12.04', 'EER 19.12.04', 'EER 19.12.02', ''],
  ['', '', '', '', '', '(METALLI FERROSI)', 'ACI'],
  ['[Kg]', '(PFU)', '(End of Waste)', '(CIABATTATO)', '(CIPPATO)', '', ''],
  ['', '', '', '', '', '', ''],
  ['GATIM SRL', '', '', '', '', '', ''],
  ['IRIGOM SRL', 32360, '', '', 178000, 900, ''],
  ['INNOREC SRL', '', '', 665770, '', '', ''],
  ['T-CYCLE SRL', '', '', '', '', '', ''],
  ['TRS SRL', 0, '', '', '', '', ''],
  ['GREEN TYRE PROJECT', '', '', 609240, '', '', ''],
  ['TOTALE', 32360, 0, 1275010, 178000, 900, 0],
  ['Massafra, 10/01/2025', '', '', '', '', '', ''],
  ['', '', '', '', '', '', ''],
  ['GIACENZE IMPIANTI', 'EER 16.01.03', 'CSS-C', 'EER 19.12.04', 'EER 19.12.04', 'EER 19.12.02', 'ACI'],
  ['', '', '', '', '', '', ''],
  ['[Kg]', '(PFU)', '(End of Waste)', '(CIABATTATO)', '(CIPPATO)', '(METALLI FERROSI)', ''],
  ['', '', '', '', '', '', ''],
  ['GATIM SRL', 176140, '', '', '', '', ''],
  ['IRIGOM SRL', 32360, '', '', 178000, 900, ''],
  ['INNOREC SRL', '', '', 665770, '', '', ''],
  ['T-CYCLE SRL', '', '', '', '', '', ''],
  ['TRS SRL', '', '', '', '', '', ''],
  ['GREEN TYRE PROJECT', 95120, '', '', '', '', ''],
  ['TOTALE', 303620, 0, 665770, 178000, 900, 0],
];
const lettera = leggiLetteraGiacenze([{ nome: 'Sheet1', righe: FOGLIO_STOCCAGGI }, { nome: 'Sheet2', righe: FOGLIO_IMPIANTI }]);
verifica('legge tutte e tre le tabelle', lettera.blocchi === 3, String(lettera.blocchi));
const nappiLettera = lettera.stoccaggi.find(s => s.chiave === 'nappi sud');
verifica('i piazzali per classe', nappiLettera && nappiLettera.P === 14840 && nappiLettera.M === 6440 && nappiLettera.G1 === 13680 && nappiLettera.aci_kg === 0, JSON.stringify(nappiLettera));
verifica('il nome si riconosce come nelle movimentazioni', lettera.stoccaggi.find(s => s.chiave === 'irigom').aci_kg === 6360);
const irigomLettera = lettera.impianti.find(i => i.chiave === 'irigom');
verifica('gli impianti per EER', irigomLettera.pfu_kg === 32360 && irigomLettera.cippato_kg === 178000 && irigomLettera.metalli_kg === 900 && irigomLettera.ciabattato_kg === null, JSON.stringify(irigomLettera));
verifica('la colonna dei nomi non diventa un valore', !('pfu_kg' in nappiLettera) || nappiLettera.pfu_kg === undefined);
verifica('la tabella ripetuta: vale l\'ultima', lettera.impianti.find(i => i.chiave === 'gatim').pfu_kg === 176140);
verifica('e la differenza si dice', lettera.avvisi.some(a => a.tipo === 'blocchi_diversi' && /GATIM/i.test(a.sito)));
verifica('la data della lettera si legge dal testo', lettera.al === '2024-12-31', lettera.al);
verifica('il piazzale sa che cosa dichiara la lettera', letteraDelPiazzale(lettera, 'nappi sud').classi.G1 === 13680);

console.log('IL CONFRONTO DEGLI IMPIANTI CON LA LETTERA');
const conf = confrontoLettera({
  impianti: [{ chiave: 'gatim', nome: 'GATIM SRL' }, { chiave: 'innorec', nome: 'INNOREC SRL' }],
  letture_impianti: { gatim: { pfu_kg: 200000, file_del: '2025-12-31' } },
  lettera, elenco,
});
const gatim = conf.righe.find(r => r.chiave === 'gatim');
verifica('letto a portale, dichiarato in lettera, scarto', gatim.lettura_kg === 200000 && gatim.lettera.pfu_kg === 176140 && gatim.scarto_kg === 23860, JSON.stringify(gatim));
verifica('senza lettura non si inventa uno scarto', conf.righe.find(r => r.chiave === 'innorec').scarto_kg === null);
verifica('i derivati si mostrano e non si sommano al PFU', 'cssc_kg' in gatim.lettera && 'metalli_kg' in gatim.lettera && !('totale_kg' in gatim.lettera));
verifica('chi sta in lettera e non fra gli impianti si segnala', conf.avvisi.some(a => a.tipo === 'solo_in_lettera' && /IRIGOM/i.test(a.sito)));

console.log('LA PROCEDURA INTERA');
const dossier = preparaChiusura({
  anno: 2025, piazzali, impianti,
  letture: { 'nappi sud': LETTURA },
  decisioni: DECISIONI,
  letture_impianti: { gatim: { pfu_kg: 200000 } },
  lettera,
});
verifica('il giorno da cui ripartira\' l\'anno dopo', dossier.giorno === giornoChiusura(2025) && dossier.giorno === '2025-12-31');
verifica('un piazzale pronto, nessuna voce da decidere', dossier.riepilogo.piazzali_pronti === 1 && dossier.riepilogo.voci_da_decidere === 0);
// La chiave normalizzata e' quella con cui si scrivono le letture: senza,
// la pagina scriverebbe le letture su una casella che non esiste.
verifica('ogni piazzale si riconosce dalla sua chiave', dossier.piazzali[0].sito === 'nappi sud' && dossier.elenco_dicembre.siti.some(s => s.sito === 'nappi sud'));
verifica('l\'elenco di dicembre e\' nel dossier', dossier.riepilogo.voci_dicembre === 7 && dossier.elenco_dicembre.siti.length === 2);
verifica('l\'avviso dice quanto pesa, un canale per volta, e che cosa si rischia',
  dossier.avvisi.some(a => a.tipo === 'elenco_dicembre'
    && a.testo.includes('rete 4 per 33.900 kg netti')
    && a.testo.includes('terziarie 2 per 38.000 kg netti')
    && a.testo.includes('si perdono')),
  JSON.stringify(dossier.avvisi.find(a => a.tipo === 'elenco_dicembre')));
verifica('la lettera di un altro 31 dicembre si segnala', dossier.avvisi.some(a => a.tipo === 'lettera_altro_anno' && a.testo.includes('2024-12-31')));
verifica('gli impianti ci sono anche senza lettura', dossier.impianti.length === 2 && dossier.riepilogo.impianti_letti === 1);
// Un impianto non piu' contrattualizzato svuota la giacenza dell'anno prima:
// non si esclude mai (regola dell'utente, 23/09/2026).
verifica('un impianto senza contratto quest\'anno resta nell\'elenco', dossier.impianti.some(i => i.chiave === 'innorec'));

console.log('IL DOSSIER EXCEL: SI SCRIVE E SI RILEGGE');
// react, le icone e i componenti grafici non servono - si chiama solo la
// funzione che scrive il file; @/lib/utils e' quello vero, perche' i formati
// (kg interi col punto delle migliaia) fanno parte di quello che si prova.
// exceljs si risolve al pacchetto vero: il file dev'essere un .xlsx apribile.
const senzaGrafica = {
  name: 'senza-grafica',
  setup(b) {
    b.onResolve({ filter: /^react(\/|$)|^lucide-react$|^@\/components\/ui\/|^@\/api\//, }, () => ({ path: 'vuoto', namespace: 'stub' }));
    b.onResolve({ filter: /^@\/lib\// }, (a) => ({ path: qui('../src/lib/' + a.path.replace('@/lib/', '') + '.js') }));
    b.onResolve({ filter: /^@\/components\/giacenze\// }, (a) => ({ path: qui('../src/components/giacenze/' + a.path.replace('@/components/giacenze/', '') + '.jsx') }));
    b.onResolve({ filter: /^exceljs$/ }, () => ({ path: pathToFileURL(qui('../node_modules/exceljs/dist/exceljs.js')).href, external: true }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'module.exports = {};', loader: 'js' }));
  },
};
const pacchetto = await build({
  entryPoints: [qui('../src/components/giacenze/ChiusuraAnno.jsx')], bundle: true, write: false,
  format: 'esm', platform: 'neutral', loader: { '.jsx': 'jsx' }, jsx: 'transform', logLevel: 'silent', plugins: [senzaGrafica],
});
// utils legge window a caricamento (isIframe): qui basta che esista.
globalThis.window = globalThis.window || { self: 1, top: 1 };
const { scaricaDossierChiusura } = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));

// Il browser che non c'e': si cattura il file invece di scaricarlo.
let catturato = null, nomeFile = '';
globalThis.Blob = class { constructor(parti) { catturato = parti[0]; } };
globalThis.URL.createObjectURL = () => 'blob:prova';
globalThis.URL.revokeObjectURL = () => {};
globalThis.document = {
  createElement: () => ({ click() {}, remove() {}, set href(_v) {}, set download(v) { nomeFile = v; } }),
  body: { appendChild() {} },
};
await scaricaDossierChiusura(dossier);
verifica('il file si scrive, col nome dell\'anno che si chiude', !!catturato && nomeFile === 'Chiusura_2025_giacenze_al_31-12.xlsx', nomeFile);

const modulo = await import(pathToFileURL(qui('../node_modules/exceljs/dist/exceljs.js')).href);
const ExcelJS = modulo.default || modulo;
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(Buffer.from(catturato));
const fogli = wb.worksheets.map(w => w.name);
verifica('ci sono tutti i fogli: letture, elenco di dicembre, scarti, lettera',
  JSON.stringify(fogli) === JSON.stringify(['Chiusura 2025', 'Da chiedere al portale', 'Elenco dicembre', 'Letture e scarti', 'Lettera']), JSON.stringify(fogli));
const testoDi = (foglio) => {
  const righe = [];
  wb.getWorksheet(foglio).eachRow({ includeEmpty: false }, (r) => righe.push(r.values.map(v => (v && v.richText ? v.richText.map(t => t.text).join('') : v))));
  return righe;
};
const dicembre = testoDi('Elenco dicembre');
verifica('l\'elenco di dicembre e\' nel file, riga per riga', dicembre.length === 11, String(dicembre.length));
verifica('e porta la decisione presa su ognuna', dicembre.some(r => r.includes('SEC25121800') && r.includes('rettificata')));
verifica('le terziarie di un impianto non si decidono da qui', dicembre.some(r => r.includes('TER25123000') && r.includes('riguarda un impianto')));
verifica('i pesi sono kg interi, le uscite col meno', dicembre.some(r => r.includes('SEC25121800') && r.includes(-14000)));
const scarti = testoDi('Letture e scarti');
verifica('per ogni classe: attesa, letta, scarto e quello che si salva',
  scarti.some(r => r[1] === 'NAPPI SUD SRL' && r[2] === 'P' && r[7] === 51100 && r[8] === 75000 && r[9] === 23900 && r[10] === 47100), JSON.stringify(scarti[1]));
const lettera2 = testoDi('Lettera');
verifica('il confronto con la lettera, senza sommare i derivati al PFU',
  lettera2.some(r => r.includes('GATIM SRL') && r.includes(176140) && r.includes(23860)));
verifica('e i piazzali che la lettera dichiara', lettera2.some(r => r.includes('NAPPI SUD SRL') && r.includes(13680)));

// --- La chiusura giudicata dall'ancora dell'anno ---
//
// La chiusura si confronta con la rilevazione prima di lei, ma quella puo'
// essere storta: e' quello che e' successo su NAPPI SUD, dove la lettura buona
// del 23/09 risultava "scostante" perche' confrontata con quella sbagliata del
// 16/09. Al 31 dicembre lo stesso errore accuserebbe proprio la chiusura. Il
// secondo confronto - l'ancora dell'anno piu' tutti i movimenti da allora - la
// conferma e nomina la lettura di mezzo che sbaglia.
console.log("LA CHIUSURA CONFERMATA DALL'ANCORA DELL'ANNO");
const ANCORA_2024 = { sito: 'PIAZZALE PROVA', data_rilevazione: '2024-12-31', class1_kg: 10000, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 0 };
// La lettura di settembre e' sbagliata: i 3.000 kg entrati in M il portale li
// ha ancora in P. Il totale torna, la ripartizione no.
const LETTURA_STORTA = { sito: 'PIAZZALE PROVA', data_rilevazione: '2025-09-30', class1_kg: 18000, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 0 };
const MOV_PROVA = [
  mov('ET25031000', 5000, g('2025-03-10'), g('2025-03-12'), { sito: 'prova', nome: 'PIAZZALE PROVA' }),
  mov('ET25061000', 3000, g('2025-06-10'), g('2025-06-12'), { sito: 'prova', nome: 'PIAZZALE PROVA', classe: 'M' }),
  mov('SEC25110500', 2000, g('2025-11-05'), g('2025-11-10'), { sito: 'prova', nome: 'PIAZZALE PROVA', tipo: 'secondaria', verso: 'uscita', controparte: 'IRIGOM SRL' }),
];
const piazzaleProva = { chiave: 'prova', nome: 'PIAZZALE PROVA', rilevazioni: [ANCORA_2024, LETTURA_STORTA], movimenti: MOV_PROVA };
// Dall'ancora: P 10.000 + 5.000 - 2.000 = 13.000, M 3.000. E' quello che il
// portale legge al 31/12.
const chiusuraProva = confrontoPiazzale(piazzaleProva, { anno: 2025, lettura: { P: 13000, M: 3000, G1: 0, G2: 0, ACI: 0 }, voci: [] });
const ancoraProva = chiusuraProva.verifica_da_salvare.ancora;
verifica('la chiusura si scosta dalla lettura prima di lei', chiusuraProva.verifica_da_salvare.scostano.length === 2,
  JSON.stringify(chiusuraProva.verifica_da_salvare.scostano.map(x => x.classe)));
verifica('ma torna con l\'ancora dell\'anno, quindi e\' confermata',
  chiusuraProva.verifica_da_salvare.confermata_dall_ancora === true && ancoraProva.quadra === true, ancoraProva.nota);
verifica('l\'ancora e\' la giacenza da cui l\'anno e\' ripartito', ancoraProva.del === '2024-12-31' && ancoraProva.senza_ancora === false);
verifica('e si dice quale lettura di mezzo sbaglia', ancoraProva.non_tornano.join() === '2025-09-30', JSON.stringify(ancoraProva.non_tornano));
verifica('a parole: confermata, e il colpevole ha un nome',
  ancoraProva.nota.includes("e' confermata") && ancoraProva.nota.includes("A sbagliare e' la lettura del 30/09/2025"), ancoraProva.nota);
verifica('la chiusura resta salvabile: non e\' lei a sbagliare', chiusuraProva.pronto === true && chiusuraProva.blocchi.length === 0);
// Senza un'ancora non si inventa un secondo confronto.
const senzaAncora = confrontoPiazzale({ chiave: 'nuovo', nome: 'NUOVO', rilevazioni: [], movimenti: [] }, { anno: 2025, lettura: { P: 0 }, voci: [] });
verifica('senza nessuna lettura non c\'e\' ancora, e lo si dice', senzaAncora.verifica_da_salvare.ancora.senza_ancora === true);
// La prima lettura dell'anno fa da ancora quando la chiusura dell'anno prima
// non c'e': se l'ancora e' la chiusura stessa, non c'e' niente prima di lei.
const soloChiusura = confrontoPiazzale({ chiave: 'solo', nome: 'SOLO', rilevazioni: [], movimenti: MOV_PROVA }, { anno: 2025, lettura: { P: 3000 }, voci: [] });
verifica('e la chiusura non si confronta con se stessa', soloChiusura.verifica_da_salvare.ancora.senza_ancora === true);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
