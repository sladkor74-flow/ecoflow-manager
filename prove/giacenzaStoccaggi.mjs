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
import { movimentoStoccaggio, fraLeRilevazioni, verificaRilevazione, saldoMovimentiInArchivio, classiDiRilevazione, riconciliazionePiazzale, ancoraDellAnno, annoDellaLettura, puntoDiPartenza, puntiDiPartenza, anomaliaRilevazione } from '../base44/shared/giacenzaStoccaggi.ts';

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

console.log('\nL\'ESTRATTO CONTO: DALL\'ANCORA AL NUMERO CHE LA PAGINA MOSTRA');
// Regola della direzione del 24/09/2026: il numero parte dall'ancora dell'anno
// (qui la prima lettura del 2026, il 13/09) piu' tutti i movimenti finiti dopo.
// L'ultima lettura, del 20/09, e' il riscontro: non sposta il numero.
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
verifica('si parte dall\'ancora, il 13/09: rete 39.538 kg', ric.partenza_del === '2026-09-13' && rete.fotografia.del === '2026-09-13' && rete.fotografia.totale_kg === 39538 && rete.fotografia.ultima_del === '2026-09-20', JSON.stringify(rete.fotografia));
verifica('P: 19.739 all\'ancora, +5.000 -7.499, adesso 17.240', classeDi(rete, 'P').fotografia_kg === 19739 && classeDi(rete, 'P').ingressi_kg === 5000 && classeDi(rete, 'P').uscite_kg === 7499 && classeDi(rete, 'P').adesso_kg === 17240, JSON.stringify(classeDi(rete, 'P')));
verifica('M: 19.449 all\'ancora, +11.021, adesso 30.470', classeDi(rete, 'M').ingressi === 3 && classeDi(rete, 'M').ingressi_kg === 11021 && classeDi(rete, 'M').adesso_kg === 30470, JSON.stringify(classeDi(rete, 'M')));
verifica('una classe ferma resta com\'era', classeDi(rete, 'G1').adesso_kg === 350 && classeDi(rete, 'G1').ingressi === 0 && classeDi(rete, 'G1').uscite === 0);
verifica('il conto chiude: 39.538 + 16.021 - 7.499 = 48.060', rete.estratto.adesso_kg === 48060 && rete.estratto.ingressi_kg === 16021 && rete.estratto.uscite_kg === 7499, JSON.stringify(rete.estratto.adesso_kg));
verifica('i movimenti prima dell\'ancora restano fuori: sono gia\' nella sua lettura', rete.estratto.ingressi === 4 && rete.estratto.uscite === 2, JSON.stringify([rete.estratto.ingressi, rete.estratto.uscite]));
// Il riscontro: la lettura del 20/09 ha il totale giusto ma si porta dietro la
// ripartizione storta del 16/09. Lo scarto si dice; il numero resta il nostro.
verifica('il riscontro dell\'ultima lettura: 49.060 letti, 49.060 attesi, ripartizione sbagliata',
  rete.riscontro.del === '2026-09-20' && rete.riscontro.letto_kg === 49060 && rete.riscontro.atteso_kg === 49060 && rete.riscontro.scarto_kg === 0 && rete.riscontro.ripartizione_sbagliata === true,
  JSON.stringify(rete.riscontro));

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
verifica('niente da rileggere: lettura fresca, piazzale che torna', rete.rileggere.conviene === false && rete.rileggere.vecchia === false && rete.rileggere.perche.length === 0, JSON.stringify(rete.rileggere));

// Lo stesso piazzale fermo al 16/09: la ripartizione e' sbagliata, il materiale c'e'.
const al16 = riconciliazionePiazzale([rilev13, rilev16], movimenti, { oggi: '2026-09-23' }).canali.RETE;
verifica('se l\'ultima non torna si dice di quanto, classe per classe', al16.stato.esito === 'scosta' && al16.stato.classi_che_scostano.sort().join() === 'M,P', JSON.stringify(al16.stato.classi_che_scostano));
verifica('il totale del canale torna: e\' la ripartizione a essere sbagliata', al16.stato.ripartizione_sbagliata === true && al16.stato.scarto_kg === 0 && al16.stato.perche.includes("il materiale c'e' tutto"), al16.stato.perche);
verifica('e i candidati a spiegarlo ci sono', al16.stato.classi.find(c => c.classe === 'M').candidati[0].id_ordine === 'ET26138377');
verifica('una lettura che non torna e\' un motivo per rileggere, ma il numero non cambia', al16.rileggere.conviene === true && al16.rileggere.perche.some(p => p.includes("La giacenza mostrata non cambia")), JSON.stringify(al16.rileggere.perche));

// Materiale che manca davvero: il totale del canale non torna.
const mancante = riconciliazionePiazzale([rilev13, { ...rilev16, class1_kg: 21400 - 777 }], movimenti, { oggi: '2026-09-23' }).canali.RETE;
verifica('se non torna nemmeno il totale si dice che e\' materiale che manca', mancante.stato.ripartizione_sbagliata === false && mancante.stato.scarto_kg === -777 && mancante.stato.perche.includes('non trova riscontro nei movimenti'), mancante.stato.perche);

console.log('QUANDO CONVIENE RILEGGERE');
const vecchia = riconciliazionePiazzale([rilev13, rilev20], tutti, { oggi: '2026-11-01' }).canali.RETE;
verifica('una fotografia di oltre trenta giorni si dice vecchia, con quanti giorni ha', vecchia.rileggere.vecchia === true && vecchia.rileggere.giorni === 42 && vecchia.rileggere.perche[0] === "La lettura ha 42 giorni, piu' di 30: conviene rifarla.", JSON.stringify(vecchia.rileggere.perche));
// Tanto viavai dopo la lettura non e' piu' un motivo per rileggere: il numero
// viene dall'ancora e dai movimenti, non dalla lettura.
const viavai = riconciliazionePiazzale(
  [{ sito: 'PIAZZALE', data_rilevazione: '2026-09-20', class1_kg: 1000, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 0 }],
  [m('ET26142000', 5000, '2026-09-21T08:00:00Z', '')],
  { oggi: '2026-09-23' },
).canali.RETE;
verifica('il viavai dopo l\'ancora non fa rileggere', viavai.rileggere.conviene === false && !('superata' in viavai.rileggere), JSON.stringify(viavai.rileggere));
verifica('la giacenza pero\' resta quella: 1.000 + 5.000', viavai.estratto.adesso_kg === 6000 && viavai.estratto.movimentato_kg === 5000);

console.log('I CASI LIMITE GIA\' VISTI');
// Una classe sotto zero: l'ancora ha i chili nella classe sbagliata o manca un
// movimento. E' il caso del 16/09, visto dalla parte della giacenza.
const sottoZero = riconciliazionePiazzale(
  [{ sito: 'PIAZZALE', data_rilevazione: '2026-09-20', class1_kg: 10000, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 0 }],
  [m('SEC00430', 6030, '2026-09-21T09:00:00Z', '', { verso: 'uscita', classe: 'M', controparte: 'Tecnogum' })],
  { oggi: '2026-09-23' },
).canali.RETE;
verifica('una classe sotto zero si mostra per quello che e\'', sottoZero.estratto.classi_negative.join() === 'M' && classeDi(sottoZero, 'M').adesso_kg === -6030, JSON.stringify(sottoZero.estratto.classi_negative));
verifica('ed e\' un motivo per rileggere, detto con parole semplici', sottoZero.rileggere.conviene === true && sottoZero.rileggere.perche.some(p => p.includes('manca un movimento in archivio')), JSON.stringify(sottoZero.rileggere.perche));

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

// --- L'ANCORA DELL'ANNO (23/09/2026) ---
//
// Il caso vero, misurato a mano il 23/09/2026 su NAPPI SUD: partendo dalla
// giacenza dichiarata al 31/12/2025 (P 14.840, M 6.440, G1 13.680) e sommando
// TUTTI i movimenti del 2026 si arriva esattamente al saldo letto a portale il
// 23/09 (P 21.740, M 130, G1 350, ACI 1.640), scarto zero su ogni classe.
// La lettura del 23/09 e' dunque giusta: a sbagliare era quella del 16/09, che
// aveva 6.160 kg nella classe sbagliata. Il confronto con la sola precedente
// invece accusava la lettura nuova, e "conviene rileggere" restava acceso su un
// piazzale appena riletto.

console.log('\nL\'ANCORA DI UN ANNO: LA LETTURA PIU\' VECCHIA CHE LO COPRE');
const fineAnno = { sito: 'NAPPI SUD', data_rilevazione: '2025-12-31', class1_kg: 14840, class2_kg: 6440, class3_kg: 13680, class4_kg: 0, class9_kg: 0 };
verifica('l\'anno di una lettura viene dal suo giorno', annoDellaLettura('2026-09-23') === '2026' && annoDellaLettura('') === '');
verifica('la rilevazione del 31/12 precedente e\' l\'ancora dell\'anno', ancoraDellAnno([rilev16, fineAnno, rilev13], 2026) === fineAnno);
verifica('senza il 31/12 vale la prima lettura dell\'anno', ancoraDellAnno([rilev20, rilev16, rilev13], 2026) === rilev13);
verifica('una lettura di un altro anno non fa da ancora', ancoraDellAnno([fineAnno], 2028) === null && ancoraDellAnno([rilev13], 'boh') === null);
verifica('l\'ancora del 2025 e\' la lettura del 31/12/2025 stessa', ancoraDellAnno([fineAnno, rilev13], 2025) === fineAnno);
verifica('il punto di partenza e\' l\'ancora dell\'anno dell\'ultima lettura', puntoDiPartenza([rilev20, fineAnno, rilev16]) === fineAnno && puntoDiPartenza([rilev20, rilev16, rilev13]) === rilev13 && puntoDiPartenza([]) === null);
const punti = puntiDiPartenza([rilev20, fineAnno, rilev16, { ...rilev13, sito: 'ALTRO' }], s => String(s || '').toUpperCase());
verifica('per ogni piazzale il suo punto di partenza, con l\'ultima lettura accanto',
  punti.get('NAPPI SUD').record === fineAnno && punti.get('NAPPI SUD').quando === '2025-12-31' && punti.get('NAPPI SUD').ultima === rilev20 && punti.get('ALTRO').quando === '2026-09-13',
  JSON.stringify([...punti].map(([k, v]) => [k, v.quando, v.ultima_del])));

console.log('NAPPI SUD, 23/09/2026: LA LETTURA NUOVA E\' CONFERMATA DALL\'ANCORA');
// I movimenti veri del 2026, in forma compatta: il conto deve chiudere a zero.
const mov2026 = [
  m('ET26100000', 9560, '2026-02-05T08:00:00Z', '2026-02-07T08:00:00Z'),
  m('SEC00100', 13330, '2026-03-10T09:00:00Z', '2026-03-12T08:00:00Z', { verso: 'uscita', classe: 'G1', controparte: 'Irigom' }),
  m('SEC00412', 4499, '2026-09-14T09:00:00Z', '2026-09-14T18:00:00Z', { verso: 'uscita', classe: 'P', controparte: 'Irigom' }),
  m('ET26137000', 2861, '2026-09-14T07:00:00Z', '2026-09-15T10:00:00Z', { classe: 'M' }),
  // il formulario del caso vero: classe M, finito il 15/09, chiuso a portale il 18
  m('ET26138377', 6160, '2026-09-15T10:00:00Z', '2026-09-18T09:00:00Z', { classe: 'M', controparte: 'Nappi Sud' }),
  m('ET26139500', 1839, '2026-09-17T08:00:00Z', '2026-09-19T08:00:00Z'),
  m('ACI0091', 1640, '2026-09-19T08:00:00Z', '2026-09-21T08:00:00Z', { canale: 'ACI', classe: 'ACI', controparte: 'Green Tyre' }),
  m('SEC00500', 15331, '2026-09-21T09:00:00Z', '2026-09-24T08:00:00Z', { verso: 'uscita', classe: 'M', controparte: 'Irigom' }),
];
// La lettura sbagliata del 16/09: 6.160 kg spostati da M a P.
const nappi16 = { sito: 'NAPPI SUD', data_rilevazione: '2026-09-16', class1_kg: 26061, class2_kg: 9301, class3_kg: 350, class4_kg: 0, class9_kg: 0 };
// La lettura buona del 23/09, presa coi valori del portale.
const nappi23 = { sito: 'NAPPI SUD', data_rilevazione: '2026-09-23', class1_kg: 21740, class2_kg: 130, class3_kg: 350, class4_kg: 0, class9_kg: 1640 };

const nappi = riconciliazionePiazzale([fineAnno, nappi16, nappi23], mov2026, { oggi: '2026-09-23' });
const nRete = nappi.canali.RETE;
const ultima = nappi.storico[nappi.storico.length - 1];
verifica('l\'ancora dell\'ultima lettura e\' il 31/12/2025', nappi.ancora_del === '2025-12-31' && nappi.ultima_e_ancora === false, nappi.ancora_del);
verifica('dall\'ancora piu\' i movimenti del 2026 lo scarto e\' zero su ogni classe',
  ultima.ancora.quadra === true && ultima.ancora.scostano.length === 0, JSON.stringify(ultima.ancora.classi.map(c => [c.classe, c.atteso, c.letto, c.scarto])));
verifica('l\'attesa dall\'ancora e\' proprio il saldo letto: P 21.740, M 130, G1 350, ACI 1.640',
  ultima.ancora.classi.filter(c => ['P', 'M', 'G1', 'ACI'].includes(c.classe)).map(c => c.atteso).join() === '21740,130,350,1640',
  JSON.stringify(ultima.ancora.classi.map(c => [c.classe, c.atteso])));
verifica('contro la precedente invece si scosta, di 6.160 kg fra P e M',
  ultima.quadra === false && ultima.scostano.sort().join() === 'M,P' && ultima.canali.RETE.spostati_kg === 6160, JSON.stringify(ultima.canali.RETE));
verifica('ma e\' confermata dall\'ancora, e lo si dice', ultima.confermata_dall_ancora === true && ultima.ancora.nota.includes("e' confermata"), ultima.ancora.nota);
verifica('il canale lo dice da se\': la rete confermata, l\'ACI che tornava gia\'',
  nRete.stato.esito === 'confermata_ancora' && nappi.canali.ACI.stato.esito === 'quadra', JSON.stringify([nRete.stato.esito, nappi.canali.ACI.stato.esito]));
verifica('e si dice quale lettura sbaglia e di quanto',
  nRete.stato.letture_che_sbagliano.length === 1
  && nRete.stato.letture_che_sbagliano[0].del === '2026-09-16'
  && nRete.stato.letture_che_sbagliano[0].quanto === '6.160 kg fra P e M',
  JSON.stringify(nRete.stato.letture_che_sbagliano.map(l => [l.del, l.quanto])));
verifica('la frase nomina l\'ancora e la lettura che sbaglia',
  nRete.stato.perche.includes("torna con l'ancora dell'anno, la lettura del 31/12/2025")
  && nRete.stato.perche.includes("A sbagliare e' la lettura del 16/09/2026, di 6.160 kg fra P e M."),
  nRete.stato.perche);
// Il punto per cui il lavoro e' nato: il piazzale era appena stato riletto.
verifica('NON conviene rileggere un piazzale confermato dall\'ancora',
  nRete.rileggere.conviene === false && nRete.rileggere.perche.length === 0 && nRete.rileggere.nota.includes('rifarla non servirebbe'),
  JSON.stringify(nRete.rileggere));
verifica('la lettura del 16/09 resta segnalata per quello che e\'',
  nappi.storico[1].quadra === false && nappi.storico[1].confermata_dall_ancora === false && nappi.storico[1].canali.RETE.ripartizione_sbagliata === true,
  JSON.stringify(nappi.storico[1].canali.RETE));
verifica('nello storico del canale la lettura buona porta l\'ancora con se\'',
  nRete.letture[0].del === '2026-09-23' && nRete.letture[0].confermata_dall_ancora === true && nRete.letture[0].ancora_del === '2025-12-31',
  JSON.stringify(nRete.letture[0]));

console.log('L\'ANCORA E\' LA LETTURA STESSA: NIENTE CONFRONTO, E SI DICE');
const suAncora = nappi.storico[0];
verifica('la lettura del 31/12/2025 e\' l\'ancora del 2025', suAncora.ancora.e_la_lettura === true && suAncora.ancora.quadra === null && suAncora.confermata_dall_ancora === false);
verifica('e lo dice, invece di tacere', suAncora.ancora.nota.includes("e' l'ancora del 2025"), suAncora.ancora.nota);
verifica('il canale non inventa un\'ancora che non c\'e\'', nappi.canali.RETE.letture[2].e_ancora === true && nappi.canali.RETE.letture[2].ancora_del === '');

console.log('FRA L\'ANCORA E LA LETTURA CI SONO ALTRE LETTURE: SI DICE QUALE NON TORNA');
// Il 20/09 si rilegge il portale, che l'errore del 16/09 ce l'ha ancora: quella
// lettura torna con la precedente - sbaglia allo stesso modo - e a non tornare
// resta solo il 16/09.
const nappi20 = { sito: 'NAPPI SUD', data_rilevazione: '2026-09-20', class1_kg: 27900, class2_kg: 9301, class3_kg: 350, class4_kg: 0, class9_kg: 1640 };
const conTre = riconciliazionePiazzale([fineAnno, nappi16, nappi20, nappi23], mov2026, { oggi: '2026-09-23' });
const tRete = conTre.canali.RETE;
const tUltima = conTre.storico[conTre.storico.length - 1];
verifica('la lettura del 23/09 resta confermata dall\'ancora', tUltima.confermata_dall_ancora === true && tRete.stato.esito === 'confermata_ancora');
verifica('fra l\'ancora e lei ci sono due letture', tUltima.ancora.intermedie.map(l => l.del).join() === '2026-09-16,2026-09-20', JSON.stringify(tUltima.ancora.intermedie.map(l => l.del)));
verifica('a non tornare e\' solo il 16/09: il 20/09 sbaglia allo stesso modo e con la precedente torna',
  tUltima.ancora.non_tornano.join() === '2026-09-16' && tUltima.ancora.intermedie[1].quadra === true,
  JSON.stringify(tUltima.ancora.non_tornano));
// La frase nomina il 20/09 come la precedente da cui si scosta, e il 16/09 come
// quella che sbaglia: sono due ruoli diversi e non vanno confusi.
verifica('e la frase accusa il 16/09, non il 20/09 da cui si scosta',
  tRete.stato.perche.includes("si scosta da quella del 20/09/2026")
  && tRete.stato.perche.includes("A sbagliare e' la lettura del 16/09/2026, di 6.160 kg fra P e M.")
  && tRete.stato.letture_che_sbagliano.map(l => l.del).join() === '2026-09-16',
  tRete.stato.perche);
verifica('nemmeno qui conviene rileggere', tRete.rileggere.conviene === false, JSON.stringify(tRete.rileggere.perche));

console.log('SE NON TORNA NE\' CON L\'ANCORA NE\' CON LA PRECEDENTE, RESTA COM\'ERA');
// La stessa lettura del 23/09 con 777 kg di P in meno: non la conferma nessuno.
const storta23 = riconciliazionePiazzale(
  [fineAnno, nappi16, { ...nappi23, class1_kg: 21740 - 777 }], mov2026, { oggi: '2026-09-23' },
).canali.RETE;
verifica('resta una lettura che si scosta', storta23.stato.esito === 'scosta' && storta23.stato.confermata_dall_ancora === false, storta23.stato.esito);
verifica('e si dice che non torna nemmeno con l\'ancora', storta23.stato.perche.includes("Non torna nemmeno con l'ancora dell'anno, la lettura del 31/12/2025"), storta23.stato.perche);
verifica('e questa volta conviene rileggere', storta23.rileggere.conviene === true && storta23.rileggere.perche.some(p => p.includes('dice se lo scarto si chiude da solo')), JSON.stringify(storta23.rileggere.perche));

console.log('LA LETTURA E\' UN RISCONTRO, NON LA FONTE DEL NUMERO (24/09/2026)');
// L'ancora del 31/12/2025 piu' tutti i movimenti del 2026: P 21.740, M 130,
// G1 350, ACI 1.640. Una lettura giusta o una storta non spostano il numero.
verifica('la giacenza di NAPPI SUD e\' l\'ancora piu\' i movimenti: rete 22.220, ACI 1.640',
  nRete.estratto.adesso_kg === 22220 && nappi.canali.ACI.estratto.adesso_kg === 1640 && nRete.fotografia.del === '2025-12-31',
  JSON.stringify([nRete.estratto.adesso_kg, nappi.canali.ACI.estratto.adesso_kg]));
verifica('con la lettura giusta il riscontro torna a zero', nRete.riscontro.scarto_kg === 0 && nRete.riscontro.quadra === true, JSON.stringify(nRete.riscontro));
verifica('una lettura storta di 777 kg non sposta il numero', storta23.estratto.adesso_kg === 22220, JSON.stringify(storta23.estratto.adesso_kg));
verifica('lo scarto si dice nel riscontro', storta23.riscontro.scarto_kg === -777 && storta23.riscontro.letto_kg === 22220 - 777 && storta23.riscontro.atteso_kg === 22220, JSON.stringify(storta23.riscontro));
// Ultima lettura storta al 16/09 e basta: il numero non la segue.
const fermaAl16 = riconciliazionePiazzale([fineAnno, nappi16], mov2026.filter(x => x.finito_il <= '2026-09-16'), { oggi: '2026-09-16' }).canali.RETE;
verifica('anche quando l\'ultima lettura e\' quella storta del 16/09, le classi seguono i movimenti',
  fermaAl16.estratto.classi.find(c => c.classe === 'M').adesso_kg === 6440 + 2861 + 6160 && fermaAl16.riscontro.ripartizione_sbagliata === true,
  JSON.stringify(fermaAl16.estratto.classi.map(c => [c.classe, c.adesso_kg])));
const unaSola = riconciliazionePiazzale([fineAnno], mov2026, { oggi: '2026-09-23' }).canali.RETE;
verifica('quando l\'ultima lettura e\' l\'ancora non c\'e\' un riscontro da fare', unaSola.riscontro === null && unaSola.estratto.adesso_kg === 22220, JSON.stringify(unaSola.riscontro));

console.log('L\'ANOMALIA "RILEVAZIONE DA CONTROLLARE" SI GIUDICA DALL\'ANCORA');
// Il 23/09 su NAPPI SUD: si scosta dal 16/09 ma torna con l'ancora. In cima a
// Giacenze restava segnalata come anomalia anche dopo il 24/09.
const vAncora = (ultimaLettura, letture) => verificaRilevazione(ultimaLettura, letture[letture.length - 2], mov2026, { ancora: fineAnno, intermedie: letture.slice(1, -1) });
verifica('la lettura del 23/09, confermata dall\'ancora, non e\' un\'anomalia',
  anomaliaRilevazione(vAncora(nappi23, [fineAnno, nappi16, nappi23])) === null);
const anStorta = anomaliaRilevazione(vAncora({ ...nappi23, class1_kg: 21740 - 777 }, [fineAnno, nappi16, nappi23]));
verifica('una lettura che non torna con l\'ancora resta un\'anomalia, contro l\'ancora',
  anStorta && anStorta.contro_ancora === true && anStorta.precedente_del === '2025-12-31' && anStorta.classi.map(c => c.classe).join() === 'P' && anStorta.classi[0].scarto === -777,
  JSON.stringify(anStorta));
// Torna con la precedente ma non con l'ancora: per il numero conta l'ancora.
const anSepolta = anomaliaRilevazione(verificaRilevazione(nappi20, nappi16, mov2026, { ancora: fineAnno, intermedie: [nappi16] }));
verifica('una lettura che torna solo con la precedente storta e\' un\'anomalia',
  anSepolta && anSepolta.contro_ancora === true && anSepolta.classi.length > 0, JSON.stringify(anSepolta && anSepolta.classi.map(c => c.classe)));
// Senza ancora (o quando l'ancora e' la lettura stessa) vale la precedente.
const anSenza = anomaliaRilevazione(verificaRilevazione(rilev16, rilev13, movimenti));
verifica('senza ancora il confronto resta con la precedente', anSenza && anSenza.contro_ancora === false && anSenza.precedente_del === '2026-09-13', JSON.stringify(anSenza && anSenza.precedente_del));
verifica('senza verifica nessuna anomalia', anomaliaRilevazione(null) === null);

console.log('SENZA ANCORA NON SI INVENTA UN CONFRONTO');
const senzAncora = verificaRilevazione(nappi23, nappi16, mov2026);
verifica('chiamata senza ancora, la verifica non ne inventa una', senzAncora.ancora.senza_ancora === true && senzAncora.ancora.quadra === null && senzAncora.confermata_dall_ancora === false);
verifica('e il confronto con la precedente resta quello di sempre', senzAncora.quadra === false && senzAncora.scostano.sort().join() === 'M,P');
verifica('i canali non si mescolano nemmeno nell\'ancora',
  ultima.ancora.canali.RETE.quadra === true && ultima.ancora.canali.ACI.quadra === true && !('totale' in ultima.ancora));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
