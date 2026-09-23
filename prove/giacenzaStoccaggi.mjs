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
import { movimentoStoccaggio, fraLeRilevazioni, verificaRilevazione, saldoMovimentiInArchivio, classiDiRilevazione, riconciliazionePiazzale } from '../base44/shared/giacenzaStoccaggi.ts';

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

// --- La riconciliazione permanente del piazzale (23/09/2026) ---
//
// Il lavoro fatto a mano su Nappi Sud, rifatto dal gestionale a ogni
// caricamento: da dove viene la giacenza di adesso, che verdetto ha avuto ogni
// lettura del portale, come sta il piazzale e quando conviene rileggere.

console.log('\nL\'ESTRATTO CONTO: DALLA FOTOGRAFIA AL NUMERO CHE LA PAGINA MOSTRA');
// Dopo il 16/09 arriva una lettura che torna, il 20/09: 21.400 + 5.000 di P.
const rilev20 = { sito: 'NAPPI SUD', data_rilevazione: '2026-09-20', class1_kg: 26400, class2_kg: 22310, class3_kg: 350, class4_kg: 0, class9_kg: 0 };
// E dopo quella lettura il piazzale continua a lavorare.
const dopoIl20 = [
  m('SEC00420', 3000, '2026-09-21T09:00:00Z', '2026-09-24T08:00:00Z', { verso: 'uscita', classe: 'P', controparte: 'Irigom' }),
  m('ET26141000', 2000, '2026-09-22T08:00:00Z', '', { classe: 'M' }),
];
const tutti = [...movimenti, ...dopoIl20];
const ric = riconciliazionePiazzale([rilev16, rilev13, rilev20], tutti, { oggi: '2026-09-23' });
const rete = ric.canali.RETE;
const classeDi = (canale, c) => canale.estratto.classi.find(x => x.classe === c);
verifica('parte dalla lettura piu\' recente, comunque siano ordinate', ric.ultima_del === '2026-09-20' && ric.rilevazioni === 3 && ric.giorni_dalla_lettura === 3, JSON.stringify([ric.ultima_del, ric.giorni_dalla_lettura]));
verifica('la fotografia e\' quella del 20/09: rete 49.060 kg', rete.fotografia.del === '2026-09-20' && rete.fotografia.totale_kg === 49060, JSON.stringify(rete.fotografia));
verifica('P: 26.400 di fotografia, un\'uscita da 3.000, adesso 23.400', classeDi(rete, 'P').fotografia_kg === 26400 && classeDi(rete, 'P').uscite === 1 && classeDi(rete, 'P').uscite_kg === 3000 && classeDi(rete, 'P').adesso_kg === 23400, JSON.stringify(classeDi(rete, 'P')));
verifica('M: 22.310 di fotografia, un ingresso da 2.000, adesso 24.310', classeDi(rete, 'M').ingressi === 1 && classeDi(rete, 'M').ingressi_kg === 2000 && classeDi(rete, 'M').adesso_kg === 24310, JSON.stringify(classeDi(rete, 'M')));
verifica('una classe ferma resta com\'era', classeDi(rete, 'G1').adesso_kg === 350 && classeDi(rete, 'G1').ingressi === 0 && classeDi(rete, 'G1').uscite === 0);
verifica('il conto chiude: 49.060 + 2.000 - 3.000 = 48.060', rete.estratto.adesso_kg === 48060 && rete.estratto.ingressi_kg === 2000 && rete.estratto.uscite_kg === 3000, JSON.stringify(rete.estratto.adesso_kg));
verifica('i movimenti prima della lettura restano fuori: sono gia\' nella fotografia', rete.estratto.ingressi === 1 && rete.estratto.uscite === 1, JSON.stringify([rete.estratto.ingressi, rete.estratto.uscite]));

console.log('LO STORICO: OGNI LETTURA COL SUO VERDETTO, NON SOLO L\'ULTIMA');
verifica('tre letture, dalla piu\' vecchia alla piu\' recente', ric.storico.map(s => s.del).join(' ') === '2026-09-13 2026-09-16 2026-09-20', ric.storico.map(s => s.del).join(' '));
verifica('la prima non ha un punto di partenza: non si dice se tornava', ric.storico[0].senza_precedente === true && ric.storico[0].quadra === null);
// E' il punto del lavoro: il 16/09 era sbagliata e il controllo di oggi non la
// guarda piu', perche' guarda solo la piu' recente contro la precedente.
const sepolta = ric.storico.find(s => s.del === '2026-09-16');
verifica('la lettura sbagliata del 16/09 resta visibile anche se ne sono arrivate altre dopo', sepolta.quadra === false && sepolta.canali.RETE.ripartizione_sbagliata === true, JSON.stringify(sepolta.canali.RETE));
verifica('e si porta dietro le sue classi e i suoi candidati', sepolta.classi.length === 2 && sepolta.classi.every(c => c.candidati[0].id_ordine === 'ET26138377'), JSON.stringify(sepolta.classi.map(c => c.classe)));
verifica('l\'ultima invece tornava', ric.storico[2].quadra === true && ric.storico[2].ultima === true && ric.storico[2].classi.length === 0);
verifica('le letture del canale vengono dalla piu\' recente', rete.letture.map(l => l.del).join(' ') === '2026-09-20 2026-09-16 2026-09-13', rete.letture.map(l => l.del).join(' '));
verifica('ognuna dice quanto leggeva quel giorno, solo del suo canale', rete.letture[0].letto_kg === 49060 && rete.letture[1].letto_kg === 44060, JSON.stringify(rete.letture.map(l => l.letto_kg)));
verifica('e di quanto si scostava', rete.letture[1].quadra === false && rete.letture[1].scarto_kg === 0 && rete.letture[1].ripartizione_sbagliata === true && rete.letture[1].classi.length === 2, JSON.stringify(rete.letture[1]));

console.log('LO STATO DI ADESSO');
verifica('l\'ultima lettura tornava, e lo si dice', rete.stato.esito === 'quadra' && rete.stato.quadra === true && rete.stato.perche.startsWith("L'ultima lettura tornava"), rete.stato.perche);
verifica('niente da rileggere: lettura fresca, piazzale che torna', rete.rileggere.conviene === false && rete.rileggere.vecchia === false && rete.rileggere.superata === false && rete.rileggere.perche.length === 0, JSON.stringify(rete.rileggere));

// Lo stesso piazzale fermo al 16/09: la ripartizione e' sbagliata, il materiale c'e'.
const al16 = riconciliazionePiazzale([rilev13, rilev16], movimenti, { oggi: '2026-09-23' }).canali.RETE;
verifica('se l\'ultima non torna si dice di quanto, classe per classe', al16.stato.esito === 'scosta' && al16.stato.classi_che_scostano.sort().join() === 'M,P', JSON.stringify(al16.stato.classi_che_scostano));
verifica('il totale del canale torna: e\' la ripartizione a essere sbagliata', al16.stato.ripartizione_sbagliata === true && al16.stato.scarto_kg === 0 && al16.stato.perche.includes("il materiale c'e' tutto"), al16.stato.perche);
verifica('e i candidati a spiegarlo ci sono', al16.stato.classi.find(c => c.classe === 'M').candidati[0].id_ordine === 'ET26138377');
verifica('una lettura che non torna e\' un motivo per rileggere', al16.rileggere.conviene === true && al16.rileggere.perche.some(p => p.includes('rimette a posto il punto di partenza')), JSON.stringify(al16.rileggere.perche));

// Materiale che manca davvero: il totale del canale non torna.
const mancante = riconciliazionePiazzale([rilev13, { ...rilev16, class1_kg: 21400 - 777 }], movimenti, { oggi: '2026-09-23' }).canali.RETE;
verifica('se non torna nemmeno il totale si dice che e\' materiale che manca', mancante.stato.ripartizione_sbagliata === false && mancante.stato.scarto_kg === -777 && mancante.stato.perche.includes('non trova riscontro nei movimenti'), mancante.stato.perche);

console.log('QUANDO CONVIENE RILEGGERE');
const vecchia = riconciliazionePiazzale([rilev13, rilev20], tutti, { oggi: '2026-11-01' }).canali.RETE;
verifica('una fotografia di oltre trenta giorni si dice vecchia, con quanti giorni ha', vecchia.rileggere.vecchia === true && vecchia.rileggere.giorni === 42 && vecchia.rileggere.perche[0] === "La lettura ha 42 giorni, piu' di 30: conviene rifarla.", JSON.stringify(vecchia.rileggere.perche));
// Il viavai ha superato quello che c'era: la fotografia regge ormai poco del conto.
const viavai = riconciliazionePiazzale(
  [{ sito: 'PIAZZALE', data_rilevazione: '2026-09-20', class1_kg: 1000, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 0 }],
  [m('ET26142000', 5000, '2026-09-21T08:00:00Z', '')],
  { oggi: '2026-09-23' },
).canali.RETE;
verifica('se dopo la lettura si e\' mosso piu' + ' di quanto ce n\'era, lo si dice', viavai.rileggere.superata === true && viavai.rileggere.conviene === true && viavai.rileggere.perche.some(p => p.includes('dipende ormai dai movimenti')), JSON.stringify(viavai.rileggere.perche));
verifica('la giacenza pero\' resta quella: 1.000 + 5.000', viavai.estratto.adesso_kg === 6000 && viavai.estratto.movimentato_kg === 5000);

console.log('I CASI LIMITE GIA\' VISTI');
// Una classe sotto zero: il punto di partenza e' sbagliato, e nessun caricamento
// puo' correggerlo. E' il caso del 16/09, visto dalla parte della giacenza.
const sottoZero = riconciliazionePiazzale(
  [{ sito: 'PIAZZALE', data_rilevazione: '2026-09-20', class1_kg: 10000, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 0 }],
  [m('SEC00430', 6030, '2026-09-21T09:00:00Z', '', { verso: 'uscita', classe: 'M', controparte: 'Tecnogum' })],
  { oggi: '2026-09-23' },
).canali.RETE;
verifica('una classe sotto zero si mostra per quello che e\'', sottoZero.estratto.classi_negative.join() === 'M' && classeDi(sottoZero, 'M').adesso_kg === -6030, JSON.stringify(sottoZero.estratto.classi_negative));
verifica('ed e\' un motivo per rileggere, detto con parole semplici', sottoZero.rileggere.conviene === true && sottoZero.rileggere.perche.some(p => p.includes('nessun caricamento puo\' correggerlo')), JSON.stringify(sottoZero.rileggere.perche));

// Un piazzale senza nessuna lettura: la giacenza non si calcola, e si dice.
const senzaLettura = riconciliazionePiazzale([], movimenti, { oggi: '2026-09-23' });
verifica('senza lettura non c\'e\' un punto di partenza', senzaLettura.senza_rilevazione === true && senzaLettura.rilevazioni === 0 && senzaLettura.storico.length === 0);
verifica('e il numero di adesso non si inventa', senzaLettura.canali.RETE.estratto.adesso_kg === null && senzaLettura.canali.RETE.fotografia === null && senzaLettura.canali.RETE.senza_fotografia === true);
verifica('i movimenti pero\' si contano lo stesso, da quando comincia l\'archivio', senzaLettura.canali.RETE.estratto.ingressi === 5 && senzaLettura.canali.RETE.estratto.uscite === 1 && senzaLettura.canali.RETE.archivio.dal === '2026-09-10', JSON.stringify(senzaLettura.canali.RETE.archivio.dal));
verifica('la prima lettura va presa, e lo si dice', senzaLettura.canali.RETE.stato.esito === 'senza_lettura' && senzaLettura.canali.RETE.rileggere.conviene === true && senzaLettura.canali.RETE.rileggere.perche[0].includes('unita\' locali di stoccaggio'), JSON.stringify(senzaLettura.canali.RETE.rileggere.perche));

// Un piazzale senza movimenti: la giacenza e' la fotografia, e basta.
const fermo = riconciliazionePiazzale([rilev16], [], { oggi: '2026-09-23' });
verifica('senza movimenti la giacenza e\' la fotografia', fermo.senza_movimenti === true && fermo.canali.RETE.estratto.adesso_kg === 44060 && fermo.canali.RETE.estratto.movimentato_kg === 0);
verifica('con una lettura sola non si dice se tornava', fermo.canali.RETE.stato.esito === 'senza_precedente' && fermo.canali.RETE.stato.quadra === null, fermo.canali.RETE.stato.perche);
verifica('e non c\'e\' niente da rileggere', fermo.canali.RETE.rileggere.conviene === false, JSON.stringify(fermo.canali.RETE.rileggere.perche));

console.log('I CANALI RESTANO SEPARATI ANCHE QUI');
const conCanali = riconciliazionePiazzale([rilev13, { ...rilev16, class9_kg: 1640 }], conAci, { oggi: '2026-09-23' });
verifica('l\'ACI ha il suo estratto e il suo verdetto', conCanali.canali.ACI.stato.esito === 'quadra' && conCanali.canali.ACI.estratto.adesso_kg === 1640 && conCanali.canali.RETE.stato.esito === 'scosta', JSON.stringify([conCanali.canali.ACI.stato.esito, conCanali.canali.RETE.stato.esito]));
verifica('nessun totale fra i canali', !('totale' in conCanali) && !('adesso_kg' in conCanali) && !('totale_kg' in conCanali));
verifica('l\'extra raccolta a portale non c\'e\': niente fotografia e niente numero di adesso', conCanali.canali.EXTRA_RACCOLTA.senza_fotografia === true && conCanali.canali.EXTRA_RACCOLTA.estratto.adesso_kg === null && conCanali.canali.EXTRA_RACCOLTA.letture.length === 0);
verifica('per l\'extra raccolta non c\'e\' niente da rileggere, e si dice perche\'', conCanali.canali.EXTRA_RACCOLTA.rileggere.conviene === false && conCanali.canali.EXTRA_RACCOLTA.stato.esito === 'fuori_portale', conCanali.canali.EXTRA_RACCOLTA.stato.perche);
verifica('i suoi movimenti restano suoi', conCanali.canali.EXTRA_RACCOLTA.archivio.saldo_kg === 8000 && conCanali.canali.EXTRA_RACCOLTA.estratto.ingressi_kg === 8000);
// La somma dei soli movimenti in archivio e' quella di saldoMovimentiInArchivio,
// riusata e non rifatta: accanto alla giacenza, mai al posto suo.
const suo = saldoMovimentiInArchivio(conAci);
verifica('la somma dei movimenti in archivio e\' la stessa di sempre', JSON.stringify(conCanali.canali.RETE.archivio) === JSON.stringify(suo.RETE), JSON.stringify(conCanali.canali.RETE.archivio));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
