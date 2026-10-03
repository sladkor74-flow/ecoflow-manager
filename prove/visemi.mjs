// LA BOCCA DI ECOTYNA SEGUE LE SILLABE, NON IL CASO.
//
// Prima la bocca si apriva a un numero sorteggiato ogni 110 millesimi, e quel
// numero non arrivava nemmeno al disegno: nessuno passava `intensita` all'avatar,
// quindi per tutta la risposta la bocca stava ferma, socchiusa.
//
// Ora le forme arrivano da src/lib/visemi.js, che legge il testo. Quello che
// questa prova difende, perche' sono le cose che se si rompono si vedono a occhio:
//
//   - le labbra si CHIUDONO su m, b, p ("mamma" fa M A M A): e' il movimento piu'
//     evidente di tutta la faccia, e se manca la bocca sembra sfasata;
//   - un gruppo di consonanti fa UN movimento, non uno per lettera: lo "scr" di
//     "scrivere" e' un gesto unico, altrimenti si vede il tremolio da marionetta;
//   - dentro un numero il punto e la virgola NON sono pause: su «38.000» la bocca
//     non si deve fermare, perche' si legge "trentottomila" tutto attaccato;
//   - la traccia e' un orario, e dall'orario si sa dove deve stare la bocca quando
//     la voce vera annuncia la parola che attacca: e' cosi' che la bocca non
//     accumula ritardo su una risposta lunga;
//   - l'accento cambia il suono, non la forma: «perché» finisce con la bocca di E.
// npm run prove
import { traccia, visemaA, istanteDelCarattere, apertura, DURATE, RIPOSO } from '../src/lib/visemi.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const forme = (testo, opzioni) => traccia(testo, opzioni).fotogrammi.map(f => f.v).join(' ');

// --- le forme delle parole ---------------------------------------------------
verifica('«Ciao» fa le quattro forme delle sue lettere', forme('Ciao') === 'C I A O', forme('Ciao'));
verifica('le maiuscole non cambiano niente', forme('CIAO') === forme('ciao'));
verifica('«mamma»: le labbra si chiudono due volte', forme('mamma') === 'M A M A', forme('mamma'));
verifica('«papa»: p e b sono labiali come la m', forme('papa') === 'M A M A' && forme('baba') === 'M A M A');
verifica('«fa» e «va»: il labbro sotto i denti', forme('fa') === 'F A' && forme('va') === 'F A');
verifica('«perché»: l\'accento non cambia la forma', forme('perché') === 'M E C E', forme('perché'));
verifica('«uomo»: le vocali attaccate restano due forme', forme('uomo') === 'U O M O', forme('uomo'));

// --- un gruppo di consonanti e' un gesto solo -------------------------------
verifica('«scrivere»: scr e\' un movimento, non tre', forme('scrivere') === 'C I F E C E', forme('scrivere'));
verifica('in un gruppo vince la labiale, che si vede', forme('ambo') === 'A M O', forme('ambo'));
verifica('la labiale batte anche la dentelabiale', forme('avba') === 'A M A', forme('avba'));
const scr = traccia('scrivere').fotogrammi[0];
verifica('il gruppo di tre lettere dura piu\' di una sola, ma non il triplo',
  scr.a - scr.da === DURATE.consonante + 2 * DURATE.consonanteInPiu, String(scr.a - scr.da));

// --- i numeri ----------------------------------------------------------------
const numero = traccia('38.000');
verifica('dentro un numero il punto non e\' una pausa', !numero.fotogrammi.some(f => f.v === RIPOSO), forme('38.000'));
verifica('ogni cifra fa due movimenti, con la vocale che cambia',
  forme('38.000') === 'C A C E C O C I C A', forme('38.000'));
verifica('cinque cifre durano quanto cinque parole corte', numero.durata === 5 * DURATE.cifra, String(numero.durata));
verifica('la virgola decimale dentro un numero non ferma la bocca',
  !traccia('1.234,56').fotogrammi.some(f => f.v === RIPOSO), forme('1.234,56'));

// --- le pause ----------------------------------------------------------------
const frase = traccia('Sì, certo.');
const pause = frase.fotogrammi.filter(f => f.v === RIPOSO);
verifica('la virgola e il punto fermano la bocca', pause.length === 2, String(pause.length));
verifica('il punto ferma piu\' della virgola',
  pause[0].a - pause[0].da === DURATE.pausaBreve && pause[1].a - pause[1].da === DURATE.pausaLunga);
verifica('spazi e segni che non si pronunciano non lasciano fotogrammi',
  traccia('   ---   ').durata === 0 && traccia('   ---   ').fotogrammi.length === 0);
verifica('un testo vuoto non rompe niente', traccia('').durata === 0 && traccia(null).fotogrammi.length === 0);

// --- l'orario e' continuo e in ordine ---------------------------------------
const lunga = traccia('EcoTyna, dimmi quanto ferro resta a portale: sono 99.300 kg di settembre.');
let continuo = true, inOrdine = true, abbastanzaLunghi = true;
for (let i = 0; i < lunga.fotogrammi.length; i++) {
  const f = lunga.fotogrammi[i];
  if (f.a - f.da < 20) abbastanzaLunghi = false;
  if (i && lunga.fotogrammi[i - 1].a !== f.da) continuo = false;
  if (i && lunga.fotogrammi[i - 1].i > f.i) inOrdine = false;
}
verifica('i fotogrammi non lasciano buchi ne\' si sovrappongono', continuo);
verifica('le posizioni nel testo non tornano indietro', inOrdine);
verifica('nessun fotogramma dura meno di 20 millesimi', abbastanzaLunghi);
verifica('la durata e\' la fine dell\'ultimo fotogramma',
  lunga.durata === lunga.fotogrammi[lunga.fotogrammi.length - 1].a);

// La bocca si muove davvero: su una frase cosi' deve cambiare forma molte volte.
// E' la prova che difende dal difetto vero che c'era: una bocca immobile.
let cambi = 0;
for (let i = 1; i < lunga.fotogrammi.length; i++) if (lunga.fotogrammi[i].v !== lunga.fotogrammi[i - 1].v) cambi++;
verifica('su una frase intera la bocca cambia forma almeno trenta volte', cambi >= 30, String(cambi));

// --- leggere l'ora -----------------------------------------------------------
const ciao = traccia('Ciao, sono EcoTyna.');
verifica('al millesimo zero la bocca e\' sulla prima forma', visemaA(ciao, 0) === 'C');
verifica('fuori dalla traccia la bocca sta a riposo',
  visemaA(ciao, -5) === RIPOSO && visemaA(ciao, ciao.durata) === RIPOSO && visemaA(ciao, 99999) === RIPOSO);
verifica('una traccia vuota non rompe la lettura', visemaA(traccia(''), 10) === RIPOSO && visemaA(null, 10) === RIPOSO);
let tuttiTrovati = true;
for (const f of ciao.fotogrammi) {
  if (visemaA(ciao, f.da) !== f.v) tuttiTrovati = false;
  if (visemaA(ciao, f.a - 1) !== f.v) tuttiTrovati = false;
}
verifica('ogni fotogramma si ritrova sia all\'inizio sia alla fine del suo tempo', tuttiTrovati);

// --- rimettere la bocca in riga con la voce vera -----------------------------
// La sintesi avvisa a che lettera e' arrivata: da li' si sa a che millesimo
// dovrebbe stare la bocca. Se questo non torna, la bocca si sfasa.
verifica('la prima lettera sta al millesimo zero', istanteDelCarattere(ciao, 0) === 0);
verifica('«sono» attacca con la bocca della s',
  visemaA(ciao, istanteDelCarattere(ciao, 6)) === 'C', String(istanteDelCarattere(ciao, 6)));
verifica('«EcoTyna» attacca con la bocca della E',
  visemaA(ciao, istanteDelCarattere(ciao, 11)) === 'E', String(istanteDelCarattere(ciao, 11)));
verifica('una posizione oltre il testo non manda la bocca fuori traccia',
  istanteDelCarattere(ciao, 9999) === ciao.fotogrammi[ciao.fotogrammi.length - 1].da);
verifica('una posizione assurda vale come l\'inizio', istanteDelCarattere(ciao, -3) === 0);

// --- la velocita' della voce --------------------------------------------------
const svelta = traccia('Ciao, sono EcoTyna.', { velocita: 2 });
verifica('a velocita\' doppia la traccia dura circa la meta\'',
  Math.abs(svelta.durata - ciao.durata / 2) <= ciao.fotogrammi.length,
  svelta.durata + ' contro ' + ciao.durata);
verifica('a velocita\' doppia le forme sono le stesse', forme('Ciao, sono EcoTyna.', { velocita: 2 }) === forme('Ciao, sono EcoTyna.'));
verifica('una velocita\' assurda non azzera la traccia',
  traccia('ciao', { velocita: 0 }).durata === traccia('ciao').durata &&
  traccia('ciao', { velocita: -1 }).durata === traccia('ciao').durata);

// --- quanto e' aperta la bocca -----------------------------------------------
verifica('l\'apertura va dalla a chiusa alla a spalancata',
  apertura('A') > apertura('O') && apertura('O') > apertura('U') && apertura('U') > apertura('E') &&
  apertura('E') > apertura('C') && apertura('C') > apertura('I') && apertura('I') > apertura('F') &&
  apertura('F') > apertura('M'));
verifica('sulle labbra chiuse l\'apertura e\' zero', apertura('M') === 0);
verifica('a riposo la bocca e\' praticamente chiusa', apertura(RIPOSO) < 0.05 && apertura('qualunque cosa') < 0.05);

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
