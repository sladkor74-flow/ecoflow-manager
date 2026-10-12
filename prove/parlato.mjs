// Prova del PARLATO DI ECOTYNA (utente, 11/10/2026: «vorrei rendere EcoTyna piu'
// realistica e con una voce meno robotica»).
//
// Quello che questa prova difende, perche' sono le cose che si sentono:
//
//   1. il testo DETTO, non quello scritto: «412,30 t» e' «quattrocentododici
//      virgola trenta tonnellate», «05/10/2026» e' «cinque ottobre
//      duemilaventisei», «PFU» e' «pi effe u», «GREEN TYRE PROJECT SRL» e'
//      «Green Tyre Project», e il formulario RGYTR025688FF non si legge;
//   2. FRASE PER FRASE: enunciati corti (Chrome tronca da solo quelli lunghi),
//      una pausa breve fra le frasi e una piu' lunga fra i paragrafi, e una
//      lettura fermata non riparte da sola;
//   3. LA VOCE MIGLIORE: le voci in fila per qualita', ma una voce online (che
//      riceve il testo) non si sceglie da sola: si propone;
//   4. la versione PARLATA al posto del testo intero, e un riassunto per le
//      risposte che non ce l'hanno;
//   5. la sua eco nel microfono non e' un'interruzione.
// Revisione delle migliorie (11/10/2026): gli articoli col suffisso (184-ter,
// 188-bis) e gli atti europei (2008/98/CE) si dicono col numero, un mese
// scritto 2026-09 e' «settembre duemilaventisei» e non un intervallo; le sue
// parole di stop non la fermano, una domanda che riprende le sue parole si'.
// Verifica delle correzioni (12/10/2026): una sua parola capita male in una
// parola da domanda («quanto» per «quando») non la ferma, «ok basta» si' anche
// quando lei dice «basta», e la domanda che comincia con le sue parole parte
// intera (togliEco toglie solo pezzi della sua frase, non parole sparse).
// Le risposte di prova sono costruite come quelle vere di EcoTyna dopo le
// regole del 10/10/2026 (numeri e date all'italiana, codici d'ordine negli avvisi).
// npm run prove
import { readFileSync } from 'node:fs';
import {
  interoInParole, numeroInParole, testoParlato, dividiInFrasi, frasiDaDire, PAUSE, MASSIMO_FRASE, AL_POSTO_DELLA_TABELLA,
  riassuntoParlato, daDireDi, qualitaVoce, ordinaVoci, voceDaUsare, voceDaProporre, etichettaVoce, nomeBreveVoce, tonoDellaVoce,
  leggiAVoce, eInterruzione, togliEco, soloStop, soloComando,
} from '../src/lib/parlato.js';
import { traccia } from '../src/lib/visemi.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const detto = (dentro, atteso, nome) => verifica(`${nome}: «${dentro}»`, testoParlato(dentro) === atteso, `uscito «${testoParlato(dentro)}»`);
const contiene = (dentro, pezzo, nome) => verifica(`${nome}: «${dentro}» dice «${pezzo}»`, testoParlato(dentro).includes(pezzo), `uscito «${testoParlato(dentro)}»`);
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');

// Risposte come quelle vere.
const R_RACCOLTO = 'Ad agosto 2026 Emmesse ha raccolto 412,30 t sulla rete, in 58 formulari.\n\nIn più ci sono 2 ordini (3,38 t) ancora in «eseguito»: aspettano il pulsante Chiudi a portale (ET26152600, ET26152611).';
const R_TELEGRAFICA = 'GREEN TYRE PROJECT SRL, rete, luglio 2026: 49.947,30 euro; agosto 2026: 51.210,00 euro.';
const R_DICHIARAZIONI = "Su Irigom restano da dichiarare 1.617,22 t di rete: 1.200,00 t dall'anno prima e 417,22 t di settembre 2026.\n\n| Mese | t |\n|---|---|\n| dall'anno prima | 1.200,00 |\n| settembre 2026 | 417,22 |\n\nTecnogum, rete: — (per accordo non ci dichiara la rete).";
const R_NORMA = "Il responsabile tecnico deve verificare che l'impianto sia autorizzato per il codice EER 16 01 03 (art. 208 del D.Lgs. 152/2006) e che i PFU viaggino con il FIR.\n\n- Controlla l'iscrizione all'Albo del trasportatore.\n- Tieni copia dell'autorizzazione aggiornata al 05/10/2026.";
// Una risposta di norma con gli articoli piu' citati del mestiere e un mese
// come lo portano gli strumenti (revisione, 11/10/2026).
const R_NORMA_EOW = "La gomma dei PFU smette di essere rifiuto secondo l'art. 184-ter del D.Lgs. 152/2006 e il DM 78/2020; la gerarchia viene dalla direttiva 2008/98/CE.\n\n- La tracciabilità sta negli artt. 188-bis e 188-ter.\n- I codici sono quelli della decisione 2000/532/CE.\n- Per Irigom il mese 2026-09 resta aperto con 417,22 t.";

console.log('1. I NUMERI IN PAROLE');
for (const [n, atteso] of [[0, 'zero'], [1, 'uno'], [21, 'ventuno'], [23, 'ventitré'], [28, 'ventotto'], [100, 'cento'], [108, 'centotto'],
  [180, 'centottanta'], [1000, 'mille'], [1003, 'milletré'], [2026, 'duemilaventisei'], [21000, 'ventunomila'],
  [1000000, 'un milione'], [1000003, 'un milione tre'], [2500000, 'due milioni cinquecentomila']]) {
  verifica(`${n} si dice «${atteso}»`, interoInParole(n) === atteso, interoInParole(n));
}
verifica('le migliaia col punto e i decimali con la virgola', numeroInParole('1.617,22') === 'milleseicentodiciassette virgola ventidue', numeroInParole('1.617,22'));
verifica('gli zeri dopo la virgola si dicono', numeroInParole('0,05') === 'zero virgola zero cinque', numeroInParole('0,05'));
verifica('i decimali tutti a zero no', numeroInParole('1.600,00') === 'milleseicento', numeroInParole('1.600,00'));
verifica('il meno davanti', numeroInParole('-3,20') === 'meno tre virgola venti', numeroInParole('-3,20'));
verifica('lo zero davanti: cifra per cifra, come nei codici EER', numeroInParole('01') === 'zero uno', numeroInParole('01'));

console.log('2. IL TESTO DETTO');
detto(R_TELEGRAFICA, 'Green Tyre Project, rete, luglio duemilaventisei: quarantanovemilanovecentoquarantasette euro e trenta centesimi; agosto duemilaventisei: cinquantunomiladuecentodieci euro.', 'la risposta telegrafica dell\'11/10');
contiene('412,30 t', 'quattrocentododici virgola trenta tonnellate', 'le tonnellate per esteso');
contiene('Irigom 12.400 kg', 'dodicimilaquattrocento chili', 'i chili');
contiene('72 €/t a Gatim', 'settantadue euro a tonnellata', 'euro a tonnellata');
contiene('€ 1.600,50', 'milleseicento euro e cinquanta centesimi', 'il segno dell\'euro davanti');
contiene('copertura 76,4%', 'settantasei virgola quattro per cento', 'per cento');
contiene('Nappi Sud ha 1 t di ACI', 'una tonnellata di aci', 'una tonnellata, al singolare');
contiene('T-CYCLE 1 kg', 'un chilo', 'un chilo, al singolare');
contiene('aggiornata al 05/10/2026', 'cinque ottobre duemilaventisei', 'le date in parole');
contiene('dal 01/10/2026', 'dal primo ottobre duemilaventisei', 'il primo del mese');
contiene('del 2026-10-05', 'cinque ottobre duemilaventisei', 'le date come le salva il gestionale');
contiene('la giacenza al 31/12', 'al trentuno dicembre', 'giorno e mese dopo una preposizione');
contiene('alle 10.30', 'alle dieci e trenta', 'le ore');
contiene('i PFU', 'pi effe u', 'PFU');
contiene('il FIR del mese', 'il fir', 'FIR si dice come una parola');
contiene('il canale ACI', 'aci', 'ACI si dice come una parola');
contiene('iscritti al RENTRI', 'rentri', 'RENTRI');
contiene('certificati EoW', 'end of waste', 'EoW');
contiene('codice EER 16 01 03', 'e e erre sedici zero uno zero tre', 'il codice EER');
contiene('D.Lgs. 152/2006', 'decreto legislativo centocinquantadue del duemilasei', 'il decreto legislativo');
contiene('DM 182/2019', 'decreto ministeriale centottantadue del duemiladiciannove', 'il decreto ministeriale');
contiene('allegato VII, parte IV', 'allegato sette, parte quarta', 'i numeri romani');
// Le norme che hanno la forma di un codice d'ordine (lettere e almeno tre
// cifre) si dicono col numero: prima sparivano (revisione, 11/10/2026).
detto("Il recupero di materia dei PFU e' regolato dall'art. 184-ter del D.Lgs. 152/2006.",
  "Il recupero di materia dei pi effe u è regolato dall'articolo centottantaquattro ter del decreto legislativo centocinquantadue del duemilasei.", 'un articolo col suffisso');
contiene('La tracciabilità sta negli artt. 188-bis e 188-ter.', 'negli articoli centottantotto bis e centottantotto ter', 'due articoli col suffisso');
contiene("Il sottoprodotto e' definito dall'art. 184-bis, comma 1.", 'articolo centottantaquattro bis, comma uno', 'il suffisso e il comma');
contiene("l'art. 184ter e l'art. 208-quater", 'articolo centottantaquattro ter e l\'articolo duecentotto quater', 'il suffisso attaccato e gli altri suffissi');
contiene('La gerarchia viene dalla direttiva 2008/98/CE.', 'dalla direttiva duemilaotto novantotto ci e', 'una direttiva europea');
contiene("L'elenco dei rifiuti e' nella decisione 2000/532/CE.", 'nella decisione duemila cinquecentotrentadue ci e', 'una decisione europea');
contiene('la vecchia direttiva 91/689/CEE', 'la vecchia direttiva novantuno seicentottantanove ci e e', 'un atto della CEE');
// Un mese come lo portano gli strumenti non e' un intervallo.
detto('Per Irigom il mese 2026-09 resta aperto con 417,22 t.',
  'Per Irigom il mese di settembre duemilaventisei resta aperto con quattrocentodiciassette virgola ventidue tonnellate.', 'un mese scritto come nei dati');
contiene('Dal 2026-09 al 2026-10 il conto è fermo.', 'Da settembre duemilaventisei a ottobre duemilaventisei', 'le preposizioni davanti a un mese');
contiene('il conto del 2026-08', 'il conto di agosto duemilaventisei', '«del» davanti a un mese');
contiene('classi 1-4, anni 2025-2026', 'classi da uno a quattro, anni da duemilaventicinque a duemilaventisei', 'un intervallo resta un intervallo');
verifica('la data intera resta una data', testoParlato('al 2026-09-30').includes('trenta settembre duemilaventisei'), testoParlato('al 2026-09-30'));
contiene('GREEN TYRE PROJECT SRL ha', 'Green Tyre Project ha', 'la ragione sociale senza SRL e senza tutto maiuscolo');
contiene('Emmesse S.r.l. ha raccolto', 'Emmesse ha raccolto', 'S.r.l. in mezzo alla frase');
detto('Lo dice Emmesse S.r.l.', 'Lo dice Emmesse.', 'S.r.l. in fondo alla frase si porta via il punto, che si rimette');
contiene('NAPPI SUD', 'Nappi Sud', 'due parole maiuscole');
contiene('ECO.GEA', 'Ecogea', 'il punto in mezzo al nome');
contiene('Silvano Renato e SILVANO TRASPORTI SRL', 'Silvano Renato e Silvano Trasporti', 'i nomi che si somigliano restano interi');
detto("L'ordine ET26152600 è fermo.", "L'ordine è fermo.", 'un codice d\'ordine non si legge: resta «l\'ordine»');
detto('Tre ordini non hanno la fine trasporto: ET26152600, ET26152611 e ET26152699.', 'Tre ordini non hanno la fine trasporto.', 'un elenco di codici sparisce col suo «:»');
contiene('il FIR RGYTR025688FF', 'il fir', 'un numero di formulario');
verifica('e del formulario non resta niente', !/rgytr|025688/i.test(testoParlato('il FIR RGYTR025688FF del mese')), testoParlato('il FIR RGYTR025688FF del mese'));
detto('Tecnogum, rete: — (per accordo non ci dichiara la rete).', 'Tecnogum, rete: nessun valore, per accordo non ci dichiara la rete.', 'il «—» di un valore che manca non si legge come un trattino');
contiene("perche' e' piu' semplice, ma un po' lento", 'perché è più semplice, ma un po\' lento', 'gli accenti scritti con l\'apostrofo, «po\'» escluso');
contiene('il file report_2026-10-05.xlsx', 'il file', 'i nomi dei file non si leggono');
verifica('il nome del file sparisce', !/report|xlsx/.test(testoParlato('il file report_2026-10-05.xlsx')), testoParlato('il file report_2026-10-05.xlsx'));
contiene('EcoTyna ti risponde', 'Ecotina', 'il suo nome come si dice');
{
  const t = testoParlato(R_DICHIARAZIONI);
  verifica('una tabella diventa una frase sola', t.split(AL_POSTO_DELLA_TABELLA).length === 2, t);
  // 417,22 sta nella frase e nella tabella: si deve sentire una volta sola.
  verifica('e i suoi numeri non si leggono', t.split('quattrocentodiciassette virgola ventidue').length === 2, t);
}
for (const [nome, r] of [['raccolto', R_RACCOLTO], ['telegrafica', R_TELEGRAFICA], ['dichiarazioni', R_DICHIARAZIONI], ['norma', R_NORMA], ['end of waste', R_NORMA_EOW]]) {
  const t = testoParlato(r);
  verifica(`risposta ${nome}: nessuna cifra resta da leggere`, !/\d/.test(t), t);
  verifica(`risposta ${nome}: nessun segno di markdown`, !/[*#|`_]/.test(t), t);
  verifica(`risposta ${nome}: nessuna unita' abbreviata`, !/\s(t|kg|€)(\s|[.,;:]|$)/.test(t), t);
}
contiene(R_NORMA, 'Controlla l\'iscrizione all\'Albo del trasportatore.', 'le voci di un elenco diventano frasi');
{
  const t = testoParlato(R_NORMA_EOW);
  verifica('la risposta di norma dice i suoi numeri', ['articolo centottantaquattro ter', 'duemilaotto novantotto', 'articoli centottantotto bis e centottantotto ter', 'duemila cinquecentotrentadue', 'il mese di settembre duemilaventisei']
    .every(pezzo => t.includes(pezzo)), t);
}
verifica('il titolo di una sezione diventa una frase a se\'', testoParlato('## Riepilogo\nRete: 12 t') === 'Riepilogo.\n\nRete: dodici tonnellate.', JSON.stringify(testoParlato('## Riepilogo\nRete: 12 t')));

console.log('3. FRASE PER FRASE');
{
  const frasi = frasiDaDire(R_RACCOLTO);
  verifica('la risposta si divide nelle sue frasi', frasi.length === 2, JSON.stringify(frasi));
  verifica('fra due paragrafi la pausa lunga', frasi[0].pausa === PAUSE.paragrafo, String(frasi[0].pausa));
  verifica('dopo l\'ultima nessuna pausa', frasi[frasi.length - 1].pausa === 0);
  const tre = dividiInFrasi('Prima frase. Seconda frase! Terza?\n\nNuovo paragrafo.');
  verifica('dentro un paragrafo la pausa breve', tre.map(f => f.pausa).join(',') === `${PAUSE.frase},${PAUSE.frase},${PAUSE.paragrafo},0`, JSON.stringify(tre));
  verifica('la pausa fra i paragrafi e\' piu\' lunga di quella fra le frasi', PAUSE.paragrafo > PAUSE.frase);
  const lunga = 'Ecco il riepilogo, ' + 'con le tonnellate di rete e di aci e di extra raccolta, '.repeat(8) + 'e basta.';
  const pezzi = dividiInFrasi(lunga);
  verifica('una frase lunga si spezza in enunciati corti', pezzi.length > 1 && pezzi.every(p => p.testo.length <= MASSIMO_FRASE), pezzi.map(p => p.testo.length).join(','));
  verifica('spezzata dove c\'e\' una virgola, senza pausa in piu\'', pezzi.slice(0, -1).every(p => /,$/.test(p.testo) && p.pausa === PAUSE.virgola), JSON.stringify(pezzi.slice(0, 2)));
  verifica('e senza perdere parole', pezzi.map(p => p.testo).join(' ').replace(/\s+/g, ' ') === lunga.replace(/\s+/g, ' '));
  verifica('niente enunciati di sola punteggiatura', dividiInFrasi('Ciao. . ! Bene.').every(f => /\p{L}/u.test(f.testo)), JSON.stringify(dividiInFrasi('Ciao. . ! Bene.')));
  verifica('un testo vuoto non da\' enunciati', dividiInFrasi('').length === 0 && frasiDaDire(null).length === 0);
  // La bocca segue le sillabe vere: un numero in parole fa movimenti di lettere,
  // non i due movimenti a cifra che si usavano per le cifre.
  const unaFrase = frasiDaDire('Sono 412,30 t.')[0].testo;
  verifica('la bocca ha le lettere del numero detto', traccia(unaFrase).fotogrammi.length > traccia('Sono 412,30 t.').fotogrammi.length, unaFrase);
}

console.log('4. LA VERSIONE PARLATA');
verifica('la voce dice da_dire quando c\'e\'', daDireDi({ da_dire: 'Sono 412,30 t.', risposta: R_RACCOLTO }) === 'Sono 412,30 t.');
verifica('quella arrivata con la risposta vale anche se l\'archivio non l\'ha', daDireDi({ risposta: R_RACCOLTO }, 'Detta.') === 'Detta.');
verifica('senza, le prime frasi e l\'avviso che il resto e\' scritto',
  daDireDi({ risposta: R_RACCOLTO }) === 'Ad agosto 2026 Emmesse ha raccolto 412,30 t sulla rete, in 58 formulari. Gli altri dettagli te li ho scritti qui sotto.',
  daDireDi({ risposta: R_RACCOLTO }));
verifica('una risposta di una frase si dice tutta, senza avvisi', riassuntoParlato('Ad agosto 2026 Emmesse ha raccolto 412,30 t sulla rete.') === 'Ad agosto 2026 Emmesse ha raccolto 412,30 t sulla rete.');
verifica('al massimo due frasi', riassuntoParlato('Prima. Seconda. Terza.') === 'Prima. Seconda. Gli altri dettagli te li ho scritti qui sotto.', riassuntoParlato('Prima. Seconda. Terza.'));
verifica('un titolo in testa non e\' la risposta', riassuntoParlato('## Riepilogo\n\nLa rete ha 12 t.') === 'La rete ha 12 t.', riassuntoParlato('## Riepilogo\n\nLa rete ha 12 t.'));
verifica('una tabella dopo la risposta si annuncia, non si legge', /Gli altri dettagli/.test(riassuntoParlato('La rete ha 12 t.\n\n| a | b |\n|---|---|\n| 1 | 2 |')));
verifica('una risposta vuota non dice niente', daDireDi({ risposta: '' }) === '' && daDireDi(null) === '');

console.log('5. LA VOCE MIGLIORE');
const edge = [
  { name: 'Microsoft Elsa - Italian (Italy)', lang: 'it-IT', localService: true },
  { name: 'Microsoft Cosimo - Italian (Italy)', lang: 'it-IT', localService: true },
  { name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true },
  { name: 'Microsoft Diego Online (Natural) - Italian (Italy)', lang: 'it-IT', localService: false },
  { name: 'Microsoft Elsa Online (Natural) - Italian (Italy)', lang: 'it-IT', localService: false },
  { name: 'Microsoft Isabella Online (Natural) - Italian (Italy)', lang: 'it-IT', localService: false },
];
const chrome = [
  { name: 'Microsoft Elsa - Italian (Italy)', lang: 'it-IT', localService: true },
  { name: 'Google italiano', lang: 'it-IT', localService: false },
  { name: 'Google US English', lang: 'en-US', localService: false },
];
const safari = [
  { name: 'Alice', lang: 'it-IT', localService: true },
  { name: 'Luca', lang: 'it-IT', localService: true },
  { name: 'Federica (Premium)', lang: 'it-IT', localService: true },
  { name: 'Alice', lang: 'it-CH', localService: true },
];
{
  const o = ordinaVoci(edge);
  verifica('Edge: le voci naturali prima, le donne prima a parita\'', o.map(v => nomeBreveVoce(v)).join(',') === 'Elsa,Isabella,Diego,Elsa,Cosimo', o.map(v => v.name).join(' | '));
  verifica('solo le voci italiane', o.every(v => /^it/.test(v.lang)));
  const inUso = voceDaUsare(o);
  verifica('Edge: senza il si\' dell\'utente resta la voce del computer', inUso && inUso.name === 'Microsoft Elsa - Italian (Italy)', inUso && inUso.name);
  verifica('Edge: e si propone la voce naturale online', voceDaProporre(o, inUso)?.name === 'Microsoft Elsa Online (Natural) - Italian (Italy)');
  verifica('Edge: col si\' si usa la naturale', voceDaUsare(o, { online: true })?.name === 'Microsoft Elsa Online (Natural) - Italian (Italy)');
  verifica('la voce scelta dall\'utente vince su tutto', voceDaUsare(o, { nome: 'Microsoft Cosimo - Italian (Italy)', online: true })?.name === 'Microsoft Cosimo - Italian (Italy)');
  verifica('una voce scelta che non c\'e\' piu\' non lascia muta EcoTyna', voceDaUsare(o, { nome: 'Voce sparita' })?.name === 'Microsoft Elsa - Italian (Italy)');
  verifica('con la voce migliore gia\' in uso non si propone niente', voceDaProporre(o, o[0]) === null);
}
{
  const o = ordinaVoci(chrome);
  verifica('Chrome: Google italiano prima della voce di base', o[0].name === 'Google italiano' && o.length === 2, o.map(v => v.name).join(' | '));
  verifica('Chrome: si usa la voce del computer e si propone Google', voceDaUsare(o).name === 'Microsoft Elsa - Italian (Italy)' && voceDaProporre(o, voceDaUsare(o))?.name === 'Google italiano');
}
{
  const o = ordinaVoci(safari);
  verifica('Safari: la voce Premium scaricata prima di tutte, e l\'italiano d\'Italia prima di quello svizzero', o[0].name === 'Federica (Premium)' && o[o.length - 1].lang === 'it-CH', o.map(v => `${v.name} ${v.lang}`).join(' | '));
  verifica('Safari: la Premium sta sul computer, si usa da sola e non c\'e\' niente da proporre', voceDaUsare(o).name === 'Federica (Premium)' && voceDaProporre(o, voceDaUsare(o)) === null);
}
verifica('se le voci sono tutte online, si usa quella che c\'e\'', voceDaUsare(ordinaVoci([{ name: 'Google italiano', lang: 'it-IT', localService: false }]))?.name === 'Google italiano');
verifica('senza voci, nessuna voce', voceDaUsare([]) === null && ordinaVoci(null).length === 0);
verifica('nel selettore la qualita\' accanto al nome', etichettaVoce(edge[4]) === 'Elsa · naturale, online' && etichettaVoce(edge[0]) === 'Elsa · di base'
  && etichettaVoce(chrome[1]) === 'Google italiano · buona, online' && etichettaVoce(safari[2]) === 'Federica · premium',
  [etichettaVoce(edge[4]), etichettaVoce(edge[0]), etichettaVoce(chrome[1]), etichettaVoce(safari[2])].join(' | '));
verifica('una voce online e\' online anche se lo dice solo il nome', qualitaVoce({ name: 'Microsoft Elsa Online (Natural) - Italian (Italy)', lang: 'it-IT' }).online);
verifica('il tono: una voce naturale non si ritocca', tonoDellaVoce(edge[4]) === 1 && tonoDellaVoce(safari[2]) === 1 && tonoDellaVoce(chrome[1]) === 1);
verifica('il tono: le voci di base tengono il ritocco di prima', tonoDellaVoce(edge[0]) === 1.05 && tonoDellaVoce(null) === 1.05);

console.log('6. LEGGERE FRASE PER FRASE');
// Un motore finto: registra gli enunciati e lascia decidere alla prova quando
// cominciano e quando finiscono. I timer sono finti anche loro.
const banco = () => {
  let ora = 0;
  let coda = [];
  const timer = {
    setTimeout: (fn, ms) => { const t = { fn, quando: ora + ms, vivo: true }; coda.push(t); return t; },
    clearTimeout: (t) => { if (t) t.vivo = false; },
  };
  const avanza = (ms) => {
    const fine = ora + ms;
    for (;;) {
      const prossimo = coda.filter(t => t.vivo && t.quando <= fine).sort((a, b) => a.quando - b.quando)[0];
      if (!prossimo) break;
      prossimo.vivo = false;
      ora = prossimo.quando;
      prossimo.fn();
    }
    ora = fine;
    coda = coda.filter(t => t.vivo);
  };
  const detti = [];
  const sintesi = {
    speaking: false, pending: false, annullate: 0,
    speak(u) { detti.push(u); this.pending = true; },
    cancel() { this.annullate++; this.speaking = false; this.pending = false; },
  };
  const parte = () => { const u = detti[detti.length - 1]; sintesi.pending = false; sintesi.speaking = true; u.onstart && u.onstart(); return u; };
  const finisce = () => { const u = detti[detti.length - 1]; sintesi.speaking = false; u.onend && u.onend(); };
  class Enunciato { constructor(testo) { this.text = testo; } }
  return { timer, avanza, detti, sintesi, parte, finisce, Enunciato };
};
{
  const b = banco();
  const eventi = [];
  const frasi = [{ testo: 'Prima.', pausa: 200 }, { testo: 'Seconda.', pausa: 600 }, { testo: 'Terza.', pausa: 0 }];
  leggiAVoce({
    sintesi: b.sintesi, Enunciato: b.Enunciato, frasi, voce: edge[4], timer: b.timer,
    alInizio: (k) => eventi.push('inizio ' + k), allaFineFrase: (k) => eventi.push('fine ' + k), allaFine: (m) => eventi.push('tutto ' + m),
    alConfine: (k, c) => eventi.push(`confine ${k} ${c}`),
  });
  verifica('parte dalla prima frase, e solo da quella', b.detti.length === 1 && b.detti[0].text === 'Prima.');
  verifica('l\'enunciato e\' in italiano, con la voce scelta e il tono naturale', b.detti[0].lang === 'it-IT' && b.detti[0].voice === edge[4] && b.detti[0].pitch === 1);
  b.parte();
  b.detti[0].onboundary({ charIndex: 3 });
  b.finisce();
  verifica('finita una frase, la dopo aspetta la pausa', b.detti.length === 1);
  b.avanza(199);
  verifica('...non prima', b.detti.length === 1);
  b.avanza(1);
  verifica('...e poi parte', b.detti.length === 2 && b.detti[1].text === 'Seconda.');
  b.parte(); b.finisce(); b.avanza(600);
  b.parte(); b.finisce();
  verifica('le tre frasi in ordine, ognuna col suo inizio e la sua fine', eventi.join(',') === 'inizio 0,confine 0 3,fine 0,inizio 1,fine 1,inizio 2,fine 2,tutto finito', eventi.join(','));
  b.avanza(10000);
  verifica('finita la lettura non parte altro', b.detti.length === 3);
}
{
  const b = banco();
  const eventi = [];
  const frasi = [{ testo: 'Prima.', pausa: 200 }, { testo: 'Seconda.', pausa: 200 }, { testo: 'Terza.', pausa: 0 }];
  const l = leggiAVoce({ sintesi: b.sintesi, Enunciato: b.Enunciato, frasi, voce: edge[0], timer: b.timer, allaFine: (m) => eventi.push(m) });
  verifica('le voci di base tengono il tono di prima', b.detti[0].pitch === 1.05);
  b.parte(); b.finisce(); b.avanza(200); b.parte();
  l.ferma();
  verifica('fermata: lo dice una volta, come «fermata»', eventi.join(',') === 'fermata' && b.sintesi.annullate >= 2);
  // La sintesi, fermata, chiude l'enunciato in corso con un errore o con la fine.
  b.detti[1].onerror && b.detti[1].onerror({ error: 'interrupted' });
  b.detti[1].onend && b.detti[1].onend();
  b.avanza(10000);
  verifica('una lettura fermata non riparte con la frase dopo', b.detti.length === 2 && eventi.length === 1, b.detti.map(u => u.text).join(','));
}
{
  const b = banco();
  const frasi = [{ testo: 'Prima.', pausa: 0 }, { testo: 'Seconda.', pausa: 0 }];
  leggiAVoce({ sintesi: b.sintesi, Enunciato: b.Enunciato, frasi, voce: edge[4], ripiego: edge[0], timer: b.timer });
  b.detti[0].onerror({ error: 'network' });
  verifica('la voce online senza rete: la stessa frase con la voce del computer', b.detti.length === 2 && b.detti[1].text === 'Prima.' && b.detti[1].voice === edge[0], b.detti.map(u => `${u.text} ${u.voice.name}`).join(' | '));
  b.parte(); b.finisce(); b.avanza(0);
  verifica('...e si resta su quella', b.detti.length === 3 && b.detti[2].voice === edge[0]);
}
{
  const b = banco();
  const eventi = [];
  leggiAVoce({ sintesi: b.sintesi, Enunciato: b.Enunciato, frasi: [{ testo: 'Prima.', pausa: 0 }, { testo: 'Seconda.', pausa: 0 }], voce: edge[0], timer: b.timer, allaFine: (m) => eventi.push(m) });
  // La sintesi l'ha lasciata cadere: non e' partita e non c'e' niente in coda.
  b.sintesi.pending = false;
  b.avanza(1200);
  verifica('un enunciato che non parte si riprova una volta', b.detti.length === 2 && b.detti[1].text === 'Prima.');
  b.sintesi.pending = false;
  b.avanza(1200);
  verifica('...e se tace ancora si passa alla frase dopo, senza restare appesi', b.detti.length === 3 && b.detti[2].text === 'Seconda.');
  b.parte();
  // Parte e non avvisa mai la fine: la guardia se ne accorge quando la sintesi tace.
  b.sintesi.speaking = false;
  b.avanza(20000);
  verifica('una frase che non avvisa la fine non lascia la lettura appesa', eventi.join(',') === 'finito', eventi.join(','));
}

console.log('7. LA SUA ECO NEL MICROFONO');
{
  const dettoOra = `Ad agosto 2026 Emmesse ha raccolto 412,30 t sulla rete. ${testoParlato('Ad agosto 2026 Emmesse ha raccolto 412,30 t sulla rete.')}`;
  verifica('la sua frase sentita dal microfono non e\' un\'interruzione', !eInterruzione('Emmesse ha raccolto quattrocentododici virgola trenta tonnellate', dettoOra));
  verifica('nemmeno quando il microfono scrive i numeri in cifre', !eInterruzione('412,30 tonnellate sulla rete', dettoOra));
  verifica('una domanda nuova si', eInterruzione('scusa ma Gatim a settembre quanto ha fatto', dettoOra));
  verifica('«basta» la ferma sempre', eInterruzione('basta', dettoOra) && eInterruzione('ferma', dettoOra));
  verifica('una parola sola non sua non basta (un colpo di tosse trascritto)', !eInterruzione('Gatim', dettoOra));
  verifica('il silenzio non interrompe', !eInterruzione('', dettoOra));
  verifica('la domanda senza la sua eco in testa', togliEco('sulla rete basta scusa Gatim a settembre', dettoOra) === 'scusa Gatim a settembre', togliEco('sulla rete basta scusa Gatim a settembre', dettoOra));
  verifica('«basta» da solo non e\' una domanda', soloStop('basta') && soloStop('Ferma!') && !soloStop('basta un formulario?'));

  // Le sue parole di stop (revisione, 11/10/2026). Le frasi si dicono una per
  // volta: il primo risultato di «Basta ricaricare il file» e' «basta».
  const conBasta = "Su Irigom il file di settembre 2026 non e' completo. Basta ricaricare il file del portale e i conti tornano.";
  const dettoBasta = `${conBasta}\n${testoParlato(conBasta)}`;
  verifica('il suo «basta» dalle casse non la ferma', !eInterruzione('basta', dettoBasta) && !eInterruzione('Basta ricaricare', dettoBasta));
  verifica('...una parola di stop che lei non dice si\'', eInterruzione('ferma', dettoBasta) && eInterruzione('stop', dettoBasta));
  verifica('...e «basta» con una domanda dietro anche', eInterruzione('basta dimmi l\'ACI', dettoBasta));
  // Comandi e domande corte (verifica della rifinitura, 12/10/2026): un comando
  // e' fatto solo di parole di stop e di riempitivi; «aspetta, perche'?» e' una
  // domanda e parte. Il provvisorio della sua «Basta ricaricare» non la ferma.
  verifica('«ok basta», «basta grazie», «aspetta un attimo» sono comandi', soloComando('ok basta') && soloComando('basta grazie') && soloComando('aspetta un attimo') && soloComando('ok basta grazie'));
  verifica('«aspetta, perché?», «basta, e Gatim?», «silenzio assenso?» non sono comandi', !soloComando('aspetta, perché?') && !soloComando('basta, e Gatim?') && !soloComando('silenzio assenso?'));
  verifica('il provvisorio «basta ricarica» della sua frase non la ferma', !eInterruzione('basta ricarica', dettoBasta) && !eInterruzione('basta caricare', dettoBasta));
  verifica('...«ok basta grazie» si', eInterruzione('ok basta grazie', dettoBasta));
  // «chi» non e' mai il suo «che» capito male: lei dice «che ha raccolto».
  const dCheHa = 'Ad agosto 2026 sulla rete il primo e\' Emmesse, che ha raccolto 412,30 t in 58 formulari. Segue Gatim, che non ha ancora chiuso tre formulari.';
  verifica('«chi ha raccolto di più ad agosto» la ferma anche se lei dice «che ha raccolto»', eInterruzione('chi ha raccolto di più ad agosto', `${dCheHa}\n${testoParlato(dCheHa)}`));
  // Una domanda che riprende le sue parole: due parole nuove su sette.
  const d2 = 'Ad agosto 2026 Emmesse ha raccolto 412,30 t sulla rete, in 58 formulari.';
  const detto2 = `${d2}\n${testoParlato(d2)}`;
  verifica('una domanda che riprende le sue parole la ferma', eInterruzione('quanto ha raccolto Emmesse sulla rete a settembre', detto2));
  verifica('la sua eco con due parole capite male no', !eInterruzione('ad agosto 2026 Emmesse ha raccolto 412,30 tonnellate sulla rete in 58 formulari ecco tutto', detto2));
  const conQuanto = 'Quanto alla rete, Emmesse ha raccolto 412,30 t.';
  verifica('una parola da domanda che dice lei e\' eco', !eInterruzione('quanto alla rete Emmesse ha raccolto 412 30 tonnellate', `${conQuanto}\n${testoParlato(conQuanto)}`));

  // La verifica delle correzioni (12/10/2026). Il riconoscimento capisce male
  // anche lei: una sua parola diventa una parola da domanda che le somiglia
  // (quando->quanto, poi->puoi, deve->dove, «cos'e'» scritto «cosa e'») e un
  // nome si storpia. Erano due parole nuove, una da domanda: si fermava da sola.
  const det = (s) => `${s}\n${testoParlato(s)}`;
  const dQuando = det('Quando Irigom chiude il mese, la giacenza di Nappi Sud scende a 120,40 t sulla rete.');
  const dPoi = det('Poi Irigom deve dichiarare 412,30 t a Ecotyre entro il 15 ottobre.');
  const dCos = det("Ecco cos'e' successo a Emmesse: 412,30 t sulla rete ad agosto.");
  verifica('la sua eco con «quanto» per il suo «quando» e un nome storpiato non la ferma',
    !eInterruzione('quanto Irigom chiude il mese la giacenza di Napoli sud scende a 120,40 tonnellate sulla rete', dQuando));
  verifica('...ne\' con «puoi» per «poi» e «dove» per «deve»',
    !eInterruzione('puoi Irigom dove dichiarare 412,30 tonnellate a Ecotyre entro il 15 ottobre', dPoi));
  verifica('...ne\' col suo «cos\'e\'» scritto «cosa e\'»',
    !eInterruzione('ecco cosa è successo a emme esse 412,30 tonnellate sulla rete ad agosto', dCos));
  verifica('una domanda vera arriva lo stesso, anche se lei dice «quando»',
    eInterruzione('scusa ma Gatim a settembre quanto ha fatto', dQuando) && eInterruzione('quanto ha raccolto Gatim a settembre', dQuando));
  verifica('...e la parola da domanda conta ancora se non somiglia a una sua',
    eInterruzione('quanto ha raccolto Emmesse sulla rete a settembre', detto2));
  // Lei dice «che» quasi sempre: una sua parola capita male sta dove la dice lei,
  // fra le parole che ha vicino; «chi» in testa a una domanda e' dell'utente.
  const dChe = det("Ad agosto 2026 Emmesse ha raccolto 412,30 t sulla rete, piu' di Gatim, che e' ferma a 300 t.");
  verifica('«chi ha raccolto di più» la ferma anche se lei dice «che»', eInterruzione('chi ha raccolto di più a settembre', dChe));
  // Con «basta» nella sua risposta: «basta» da solo e «basta ricaricare» sono
  // suoi, ma una parola che lei non dice accanto al «basta» e' l'utente.
  for (const s of ['ok basta', 'basta grazie', 'basta così']) verifica(`«${s}» la ferma anche quando lei dice «basta»`, eInterruzione(s, dettoBasta));
  verifica('...e «basta» e «basta ricaricare» restano la sua eco', !eInterruzione('basta', dettoBasta) && !eInterruzione('Basta ricaricare', dettoBasta));
  verifica('un comando non e\' una domanda: «ok basta», «basta grazie», «basta così»',
    soloComando('ok basta') && soloComando('basta grazie') && soloComando('basta così') && soloComando('basta'));
  verifica('...una domanda con «basta» dentro si\'', !soloComando('basta un formulario?') && !soloComando('quanto ha fatto Gatim'));

  // La sua eco in testa si toglie, le sue parole sparse no: una domanda che
  // comincia col fornitore o col canale appena detti da lei partiva mozza.
  const toglie = (s, d, atteso, nome) => verifica(nome, togliEco(s, d) === atteso, `uscito «${togliEco(s, d)}»`);
  toglie('Emmesse sulla rete a settembre quanto ha raccolto', detto2, 'Emmesse sulla rete a settembre quanto ha raccolto', 'la domanda che comincia col fornitore parte intera');
  toglie('Emmesse a settembre quanto ha raccolto sulla rete', detto2, 'Emmesse a settembre quanto ha raccolto sulla rete', '...anche col canale in fondo');
  toglie('sulla rete quanto ha fatto Gatim', detto2, 'sulla rete quanto ha fatto Gatim', 'due parole sue di fila in testa restano: il canale non si perde');
  toglie('ad agosto quanto ha fatto Gatim', detto2, 'ad agosto quanto ha fatto Gatim', '...ne\' il mese');
  toglie('in 58 formulari quanto ha raccolto Emmesse a settembre', detto2, 'quanto ha raccolto Emmesse a settembre', 'un pezzo della sua frase in testa si toglie');
  toglie('ad agosto 2026 Emmesse ha raccolto 412,30 tonnellate sulla rete scusa quanto ha fatto Gatim', detto2, 'scusa quanto ha fatto Gatim', '...anche coi numeri scritti in cifre e le tonnellate dette');
  toglie('412,30 tonnellate sulla rete basta', detto2, '', 'la sua eco e il «basta» che l\'ha fermata: niente domanda');
  toglie('sulla rete basta e a settembre', detto2, 'e a settembre', 'le sue parole prima del «basta» si tolgono, quelle dell\'utente dopo restano tutte');
  toglie('la giacenza resta ferma a 12,5 tonnellate scusa quanto manca', det('La giacenza resta ferma a 12,5 t. Aspetta la chiusura del mese.'), 'scusa quanto manca', 'una sua parola di stop dentro la sua frase e\' eco come le altre');
}

console.log('8. IL COLLEGAMENTO');
{
  const voce = sorgente('src/lib/voce.js');
  verifica('la voce legge frase per frase', /frasiDaDire\(testo\)/.test(voce) && /leggiAVoce\(\{/.test(voce));
  verifica('non c\'e\' piu\' un enunciato unico per tutta la risposta', !/new SpeechSynthesisUtterance\(/.test(voce));
  verifica('il tono non e\' piu\' fisso', !/pitch = 1\.05/.test(voce));
  verifica('le voci in fila per qualita\' e la scelta che chiede per le voci online', /ordinaVoci\(/.test(voce) && /voceDaUsare\(voci, \{ nome: nomeVoce, online: online === 'si' \}\)/.test(voce));
  const chat = sorgente('src/components/assistente/ChatAssistente.jsx');
  verifica('la risposta nuova si dice nella versione parlata, non per intero', /voce\.parla\(daDireDi\(ultima, parlate\[ultima\.id\]\)\)/.test(chat) && !/voce\.parla\(ultima\.risposta\)/.test(chat));
  verifica('la versione parlata arrivata con la risposta si tiene', /if \(res\.data\.da_dire\) setParlate/.test(chat));
  verifica('il testo intero si legge solo a richiesta', /Leggi tutta la risposta/.test(chat) && /voce\.parla\(tutto \? d\.risposta : daDireDi\(d, parlate\[d\.id\]\)\)/.test(chat));
  verifica('nel selettore la qualita\' della voce', /\{etichettaVoce\(v\)\}/.test(chat));
  verifica('la voce online si propone e decide l\'utente', /voce\.proposta &&/.test(chat) && /voce\.usaOnline\(true\)/.test(chat) && /voce\.usaOnline\(false\)/.test(chat));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
