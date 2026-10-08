// VALE SOLO L'ULTIMA RICHIESTA PARTITA.
//
// L'08/10/2026, in Giacenze, aprendo «da dichiarare» dal pulsante di T-Cycle
// nella scheda Situazione, l'elenco mostrava 998 ordini di TUTTI gli impianti
// sotto il filtro «T-CYCLE INDUSTRIES SRL»: la tabella nasceva senza filtro e
// lanciava subito la lettura di tutti gli ordini, poi arrivava il filtro e
// partiva la seconda lettura; la seconda, piu' leggera, tornava per prima e la
// prima la sovrascriveva. Su quell'elenco si decide che cosa dichiarare, e
// dichiarare a un impianto dei carichi finiti altrove e' un errore grosso.
//
// Qui si prova il guardiano, con due letture in volo insieme e i tempi
// rovesciati, come nella realta'. npm run prove
import { creaSequenza } from '../src/lib/ultimaRichiesta.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const attendi = (ms) => new Promise(r => setTimeout(r, ms));

console.log('DUE LETTURE IN VOLO, LA PIU\' VECCHIA NON SI PRENDE LO SCHERMO');
{
  const sequenza = creaSequenza();
  let aVideo = null;
  // La lettura senza filtro parte per prima ed e' la piu' lenta: 998 ordini.
  const senzaFiltro = (async () => {
    const mia = sequenza.inizia();
    await attendi(40);
    if (!sequenza.valida(mia)) return 'scartata';
    aVideo = 'tutti gli impianti';
    return 'mostrata';
  })();
  // Un istante dopo arriva il filtro: 186 ordini, torna subito.
  await attendi(5);
  const conFiltro = (async () => {
    const mia = sequenza.inizia();
    await attendi(5);
    if (!sequenza.valida(mia)) return 'scartata';
    aVideo = 'solo T-Cycle';
    return 'mostrata';
  })();
  const [a, b] = await Promise.all([senzaFiltro, conFiltro]);
  verifica('la lettura senza filtro, tornata per ultima, viene scartata', a === 'scartata', a);
  verifica('quella col filtro si mostra', b === 'mostrata', b);
  verifica('e a video resta il filtro chiesto', aVideo === 'solo T-Cycle', String(aVideo));
}

console.log('UNA LETTURA SOLA SI MOSTRA SEMPRE');
{
  const sequenza = creaSequenza();
  const mia = sequenza.inizia();
  await attendi(5);
  verifica('nessuno le passa davanti', sequenza.valida(mia) === true);
}

console.log('E OGNI TABELLA HA LA SUA SEQUENZA');
{
  const a = creaSequenza(), b = creaSequenza();
  const prima = a.inizia();
  b.inizia(); b.inizia();
  verifica('una lettura di un\'altra tabella non invalida la mia', a.valida(prima) === true);
  const seconda = a.inizia();
  verifica('ma la mia successiva si', a.valida(prima) === false && a.valida(seconda) === true);
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
