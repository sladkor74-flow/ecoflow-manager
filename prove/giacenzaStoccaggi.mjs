// Prova dei due controlli della rilevazione di uno stoccaggio
// (base44/shared/giacenzaStoccaggi.ts), 23/09/2026.
//
// Il caso vero: il 16/09 la rilevazione di NAPPI SUD portava 6.160 kg nella
// classe sbagliata - erano del formulario ET26138377, classe M, arrivato il
// 15/09 e chiuso a portale dopo la lettura - e il portale li mostrava ancora in
// P. Il totale era giusto, la ripartizione no, e nessun caricamento poteva
// correggerla perche' l'errore stava nel punto di partenza. Il controllo lo
// avrebbe detto subito: M attesa 28.470, letta 22.310, 6.160 kg di scarto,
// quanto quel formulario.
//
// Il secondo conto e' la somma dei soli movimenti in archivio: non e' una
// giacenza - i file non partono da quando il piazzale era vuoto - ma un termine
// di confronto, che dice da quando conta.
// npm run prove
import { movimentoStoccaggio, fraLeRilevazioni, verificaRilevazione, saldoMovimentiInArchivio, classiDiRilevazione } from '../base44/shared/giacenzaStoccaggi.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Un movimento di piazzale: id, kg, giorno di fine trasporto, giorno di chiusura a portale.
const m = (id, kg, finito, chiuso, { canale = 'RETE', verso = 'ingresso', classe = 'P', controparte = 'C.L. Service' } = {}) =>
  movimentoStoccaggio(
    { id_ordine: id, peso_effettivo: kg, trasporto_finito_il: finito, ordine_chiuso_il: chiuso },
    { canale, verso, classe, controparte },
  );

console.log('IL MOVIMENTO SI COLLOCA SULLA FINE TRASPORTO, GIORNO ITALIANO');
// Le 22:00Z del 14 settembre sono mezzanotte in Italia: il giorno e' il 15.
const notturno = m('ET26138900', 3000, '2026-09-14T22:00:00Z', '2026-09-20T08:00:00Z');
verifica('la fine trasporto vale sul giorno italiano', notturno.finito_il === '2026-09-15', notturno.finito_il);
verifica('la chiusura a portale si porta dietro ma non colloca', notturno.chiuso_il === '2026-09-20');
verifica('kg interi', m('X', 1200.4, '2026-09-15T08:00:00Z', '').kg === 1200);
verifica('senza fine trasporto non ha giorno', m('X', 100, null, '2026-09-20T08:00:00Z').finito_il === '');

console.log('IL TAGLIO: IL GIORNO DELLA RILEVAZIONE STA DENTRO');
const scala = ['2026-09-13', '2026-09-14', '2026-09-16', '2026-09-17']
  .map((g, i) => m('T' + i, 100, g + 'T08:00:00Z', ''));
const dentro = fraLeRilevazioni(scala, '2026-09-13', '2026-09-16').map(x => x.finito_il);
verifica('dal giorno dopo la precedente al giorno della nuova compreso', JSON.stringify(dentro) === JSON.stringify(['2026-09-14', '2026-09-16']), JSON.stringify(dentro));

console.log('NAPPI SUD, 16/09/2026: IL TOTALE TORNA, LA RIPARTIZIONE NO');
const rilev13 = { sito: 'NAPPI SUD', data_rilevazione: '2026-09-13', class1_kg: 19739, class2_kg: 19449, class3_kg: 350, class4_kg: 0, class9_kg: 0 };
const rilev16 = { sito: 'NAPPI SUD', data_rilevazione: '2026-09-16', class1_kg: 21400, class2_kg: 22310, class3_kg: 350, class4_kg: 0, class9_kg: 0 };
verifica('le classi di una rilevazione: 1-4 la rete, la 9 l\'ACI', JSON.stringify(classiDiRilevazione(rilev13)) === JSON.stringify({ P: 19739, M: 19449, G1: 350, G2: 0, ACI: 0 }));

const movimenti = [
  // fuori dal periodo, da una parte e dall'altra: in archivio ci sono lo stesso
  m('ET26130000', 10000, '2026-09-10T08:00:00Z', '2026-09-12T08:00:00Z'),
  m('ET26136000', 1000, '2026-09-13T08:00:00Z', '2026-09-14T08:00:00Z', { classe: 'M' }),
  // il periodo: 14, 15 e 16 settembre
  m('SEC00412', 4499, '2026-09-14T09:00:00Z', '2026-09-14T18:00:00Z', { verso: 'uscita', classe: 'P', controparte: 'Irigom' }),
  m('ET26137000', 2861, '2026-09-14T07:00:00Z', '2026-09-15T10:00:00Z', { classe: 'M' }),
  // il formulario del caso vero: classe M, arrivato il 15, chiuso a portale il 18
  m('ET26138377', 6160, '2026-09-15T10:00:00Z', '2026-09-18T09:00:00Z', { classe: 'M', controparte: 'Nappi Sud' }),
  // dopo la lettura
  m('ET26139500', 5000, '2026-09-17T08:00:00Z', '2026-09-19T08:00:00Z'),
];

const esito = verificaRilevazione(rilev16, rilev13, movimenti);
const di = (c) => esito.classi.find(x => x.classe === c);
verifica('parte dalla rilevazione precedente', esito.del === '2026-09-16' && esito.precedente_del === '2026-09-13' && esito.senza_precedente === false);
verifica('M: attesa 28.470, letta 22.310, scarto -6.160', di('M').atteso === 28470 && di('M').letto === 22310 && di('M').scarto === -6160, JSON.stringify(di('M')));
verifica('P: attesa 15.240, letta 21.400, scarto +6.160', di('P').atteso === 15240 && di('P').letto === 21400 && di('P').scarto === 6160, JSON.stringify(di('P')));
verifica('G1 non si muove e non scosta', di('G1').atteso === 350 && di('G1').scarto === 0 && di('G1').candidati.length === 0);
verifica('il movimento del 13 e\' gia\' nella rilevazione precedente, non nel periodo', di('M').ingressi === 2 && di('M').ingressi_kg === 9021, JSON.stringify({ n: di('M').ingressi, kg: di('M').ingressi_kg }));
verifica('quello del 17 e\' dopo la lettura', di('P').uscite === 1 && di('P').uscite_kg === 4499 && di('P').ingressi === 0);
verifica('si scostano P e M', JSON.stringify(esito.scostano.sort()) === JSON.stringify(['M', 'P']) && esito.quadra === false);
verifica('il totale della rete torna: e\' la ripartizione a essere sbagliata', esito.canali.RETE.scarto_kg === 0 && esito.canali.RETE.ripartizione_sbagliata === true && esito.canali.RETE.quadra === false, JSON.stringify(esito.canali.RETE));

console.log('CHI PUO\' SPIEGARE LO SCARTO');
const candM = di('M').candidati;
verifica('un solo candidato: il formulario del caso vero', candM.length === 1 && candM[0].id_ordine === 'ET26138377', JSON.stringify(candM.map(c => c.id_ordine)));
verifica('il suo peso, da solo, fa lo scarto', candM[0].peso_esatto === true && candM[0].kg === 6160);
verifica('ed e\' finito a ridosso della lettura, chiuso a portale dopo', candM[0].finito_il === '2026-09-15' && candM[0].chiuso_il === '2026-09-18' && candM[0].perche.includes('chiuso a portale dopo'));
verifica('lo scarto si spiega, e lo si dice', di('M').spiegato === true && di('M').nota === "Lo scarto e' esattamente il peso di un formulario del periodo.", di('M').nota);
// La classe sbagliata spiega due scarti opposti: il candidato si cerca in tutto
// il canale, non nella sola classe, altrimenti in P non si trovava niente.
verifica('lo stesso formulario spiega anche il +6.160 di P, ed e\' di classe M', di('P').candidati.length === 1 && di('P').candidati[0].id_ordine === 'ET26138377' && di('P').candidati[0].classe === 'M');
verifica('chi non c\'entra resta fuori', !JSON.stringify(candM).includes('ET26137000') && !JSON.stringify(candM).includes('SEC00412'));

console.log('SE NON SI SPIEGA, SI DICE CHE NON SI SPIEGA');
const storto = verificaRilevazione({ ...rilev16, class1_kg: 15240 + 777, class2_kg: 28470 }, rilev13, movimenti);
const sp = storto.classi.find(x => x.classe === 'P');
verifica('nessun formulario fa 777 kg: lo scarto non e\' spiegato', sp.scarto === 777 && sp.spiegato === false);
// Resta comunque il sospettato di sempre: finito a ridosso e chiuso a portale
// dopo la lettura. Si mostra per quello che e', senza dire che fa lo scarto.
verifica('resta chi e\' finito a ridosso e chiuso a portale dopo', sp.candidati.length === 1 && sp.candidati[0].id_ordine === 'ET26138377' && sp.candidati[0].peso_esatto === false, JSON.stringify(sp.candidati.map(c => c.id_ordine)));
verifica('la nota non inventa niente', sp.nota === "Nessun formulario, da solo, fa lo scarto; c'e' un movimento finito a ridosso della rilevazione e chiuso a portale dopo la lettura.", sp.nota);
verifica('e il totale della rete non torna piu\'', storto.canali.RETE.scarto_kg === 777 && storto.canali.RETE.ripartizione_sbagliata === false);
// Nessun indizio: tutto chiuso a portale prima della lettura e nessun peso che torni.
const muto = verificaRilevazione(
  { sito: 'NAPPI SUD', data_rilevazione: '2026-09-16', class1_kg: 20516, class2_kg: 22310, class3_kg: 350, class4_kg: 0, class9_kg: 0 },
  rilev13,
  [m('ET26137000', 2861, '2026-09-14T07:00:00Z', '2026-09-15T10:00:00Z', { classe: 'M' })],
);
const muta = muto.classi.find(x => x.classe === 'P');
verifica('senza nessun indizio non si propone nessuno', muta.scarto === 777 && muta.candidati.length === 0 && muta.spiegato === false);
verifica('e si dice che non si spiega', muta.nota === 'Lo scarto non si spiega con i movimenti del periodo.', muta.nota);

console.log('UNA RILEVAZIONE CHE QUADRA NON DICE NIENTE');
const giusta = verificaRilevazione({ ...rilev16, class1_kg: 15240, class2_kg: 28470 }, rilev13, movimenti);
verifica('nessuna classe si scosta', giusta.scostano.length === 0 && giusta.quadra === true && giusta.canali.RETE.quadra === true);
verifica('nessun candidato da mostrare', giusta.classi.every(c => c.candidati.length === 0 && c.nota === ''));

console.log('SENZA UNA RILEVAZIONE PRIMA NON SI ATTENDE NIENTE');
const prima = verificaRilevazione(rilev16, null, movimenti);
verifica('non c\'e\' un punto di partenza', prima.senza_precedente === true && prima.precedente_del === '' && prima.quadra === null);
verifica('l\'atteso non si inventa, e il letto si mostra', prima.classi.every(c => c.atteso === null && c.scarto === null) && prima.classi.find(c => c.classe === 'M').letto === 22310);
verifica('nessuna classe si segnala', prima.scostano.length === 0 && prima.canali.RETE.quadra === null);

console.log('I CANALI NON SI MESCOLANO');
const conAci = [
  ...movimenti,
  m('ACI0091', 1640, '2026-09-15T08:00:00Z', '2026-09-17T08:00:00Z', { canale: 'ACI', classe: 'ACI', controparte: 'Green Tyre' }),
  m('EXT0007', 8000, '2026-09-15T08:00:00Z', '', { canale: 'EXTRA_RACCOLTA', classe: 'P', controparte: 'Cliente privato' }),
];
const conNove = verificaRilevazione({ ...rilev16, class9_kg: 1640 }, rilev13, conAci);
const aci = conNove.classi.find(c => c.classe === 'ACI');
verifica('la classe 9 si muove solo con l\'ACI', aci.canale === 'ACI' && aci.atteso === 1640 && aci.scarto === 0, JSON.stringify(aci));
verifica('l\'ACI ha il suo verdetto, la rete il suo', conNove.canali.ACI.quadra === true && conNove.canali.RETE.quadra === false);
verifica('l\'extra raccolta a portale non c\'e\': non entra in nessuna classe', conNove.classi.every(c => c.ingressi_kg !== 8000) && conNove.canali.RETE.movimenti === 3, JSON.stringify(conNove.canali.RETE));

console.log('DAI SOLI MOVIMENTI IN ARCHIVIO: UN CONFRONTO, NON UNA GIACENZA');
const senzaFine = m('ET26140000', 2000, null, '2026-09-20T08:00:00Z');
const saldo = saldoMovimentiInArchivio([...conAci, senzaFine]);
verifica('conta dal primo movimento in archivio, non da quando il piazzale era vuoto', saldo.RETE.dal === '2026-09-10' && saldo.RETE.al === '2026-09-17', JSON.stringify([saldo.RETE.dal, saldo.RETE.al]));
verifica('quanti movimenti lo compongono', saldo.RETE.movimenti === 6 && saldo.RETE.ingressi === 5 && saldo.RETE.uscite === 1, JSON.stringify(saldo.RETE));
verifica('per classe: P 10.501, M 10.021', saldo.RETE.classi_kg.P === 10501 && saldo.RETE.classi_kg.M === 10021, JSON.stringify(saldo.RETE.classi_kg));
verifica('il saldo del canale e\' la somma delle sue classi', saldo.RETE.saldo_kg === 20522 && saldo.RETE.ingressi_kg === 25021 && saldo.RETE.uscite_kg === 4499);
verifica('senza fine trasporto non entra nel saldo, e si dice quanti sono', saldo.RETE.senza_fine === 1);
verifica('ACI ed extra raccolta hanno il loro saldo, mai sommato alla rete', saldo.ACI.saldo_kg === 1640 && saldo.EXTRA_RACCOLTA.saldo_kg === 8000 && saldo.ACI.dal === '2026-09-15');
verifica('un canale senza movimenti resta a zero, senza data', saldoMovimentiInArchivio([]).ACI.movimenti === 0 && saldoMovimentiInArchivio([]).ACI.dal === '');
verifica('nessun totale fra i canali', !('totale' in saldo) && !('saldo_kg' in saldo));

// Il fatto misurato su Nappi Sud: sulla storia intera la somma dei soli
// movimenti e' negativa, perche' l'archivio comincia il 12/01/2024 e il piazzale
// c'era gia'. E' la prova che questo numero non e' una giacenza.
const storia = saldoMovimentiInArchivio([
  m('S1', 5000, '2024-01-12T08:00:00Z', ''),
  m('S2', 66420, '2024-02-01T08:00:00Z', '', { verso: 'uscita' }),
]);
verifica('sulla storia intera puo\' uscire negativo: non e\' una giacenza', storia.RETE.saldo_kg === -61420 && storia.RETE.dal === '2024-01-12', JSON.stringify(storia.RETE));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
