// DI QUALI MESI SONO GLI ORDINI DA DICHIARARE (getOrdiniDaDichiarare, DaDichiarareTable).
//
// Il fatto vero, 09/10/2026. L'utente apre gli ordini da dichiarare di T-Cycle
// dal pulsante della scheda Situazione e dice: «non compaiono poi in elenco gli
// ingressi di ottobre e mi chiedo: come fai a trovarti con la giacenza attuale se
// non consideri anche quelli? c'e' qualcosa che non va».
//
// Gli ordini c'erano, e il conto era giusto al chilo: 114 righe per 352.940 kg,
// esattamente la giacenza dell'impianto, ottobre compreso con 12 ordini e 29.060
// kg. Non andava la LETTURA. L'elenco e' ordinato dal carico arrivato da piu'
// tempo e mostra cento righe per pagina: la prima pagina finisce a settembre -
// 100 righe per 318.460 kg - e sotto c'era scritto «TOTALE (114 ordini) 352.940
// kg», che e' il totale di tutte. Chi guarda vede un totale che le righe davanti
// non fanno, e i 34.480 kg mancanti sono proprio settembre in parte e ottobre
// tutto: la conclusione «ottobre non e' contato» era l'unica possibile.
//
// Percio' la funzione manda sempre il conto per mese di TUTTO l'elenco filtrato,
// non della pagina, e la pagina lo mostra sopra la tabella; il totale sotto le
// righe dice che e' dell'elenco, e dove la pagina non basta si scrive anche il
// suo. npm run prove
import { readFileSync } from 'node:fs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// Il raggruppamento, come lo fa la funzione: per mese della fine trasporto, e chi
// non ce l'ha in un gruppo suo con la chiave vuota - fingere un mese sarebbe
// peggio che dirlo.
const perMeseDi = (righe) => {
  const per = new Map();
  for (const r of righe) {
    const chiave = r.fine ? r.fine.slice(0, 7) : '';
    if (!per.has(chiave)) per.set(chiave, { mese: chiave, ordini: 0, kg: 0 });
    const x = per.get(chiave);
    x.ordini++;
    x.kg += r.kg;
  }
  return [...per.values()]
    .sort((a, b) => (a.mese || '9999-99').localeCompare(b.mese || '9999-99'))
    .map(x => ({ ...x, kg: Math.round(x.kg) }));
};

// T-Cycle, 09/10/2026: i 114 ordini che l'impianto deve dichiarare.
// Settembre e' spezzato come lo spezza la pagina: i primi 32 ordini (119.380 kg)
// chiudono le cento righe, gli altri 2 (5.420 kg) finiscono nella pagina dopo.
const TCYCLE = [
  ['2026-06', 16, 41980], ['2026-07', 39, 108680], ['2026-08', 13, 48420],
  ['2026-09', 32, 119380], ['2026-09', 2, 5420], ['2026-10', 12, 29060],
];
const righe = TCYCLE.flatMap(([mese, n, kg]) => Array.from({ length: n }, () => ({ fine: `${mese}-15`, kg: kg / n })));

console.log('T-CYCLE: L\'ELENCO HA OTTOBRE, E ADESSO SI VEDE');
{
  const g = perMeseDi(righe);
  verifica('cinque mesi, da giugno a ottobre', g.length === 5 && g[0].mese === '2026-06' && g[4].mese === '2026-10');
  verifica('ottobre c e: 12 ordini per 29.060 kg',
    g[4].ordini === 12 && g[4].kg === 29060, JSON.stringify(g[4]));
  verifica('e la somma dei mesi e la giacenza dell impianto, 352.940 kg',
    g.reduce((s, x) => s + x.kg, 0) === 352940 && g.reduce((s, x) => s + x.ordini, 0) === 114);
  // IL DIFETTO, in due numeri: la prima pagina e il totale sotto.
  const pagina = righe.slice(0, 100);
  verifica('la prima pagina pesa 318.460 kg, non 352.940',
    Math.round(pagina.reduce((s, r) => s + r.kg, 0)) === 318460, String(Math.round(pagina.reduce((s, r) => s + r.kg, 0))));
  verifica('e i 34.480 kg che non si vedevano sono parte di settembre e tutto ottobre',
    352940 - 318460 === 34480);
  verifica('la prima pagina finisce a settembre: ottobre e nella successiva',
    perMeseDi(pagina).length === 4);
}

console.log('I MESI SI CONTANO SU TUTTO L\'ELENCO, NON SULLA PAGINA');
{
  const g = perMeseDi(righe.slice(0, 100));
  verifica('contati sulla pagina, ottobre non c e: ed e proprio l errore da non ripetere',
    !g.some(x => x.mese === '2026-10'));
  verifica('contati su tutto, c e', perMeseDi(righe).some(x => x.mese === '2026-10'));
}

console.log('CHI NON HA LA FINE TRASPORTO HA UN GRUPPO SUO');
{
  const g = perMeseDi([{ fine: '2026-07-10', kg: 1000 }, { fine: '', kg: 2000 }, { fine: '', kg: 500 }]);
  verifica('due gruppi, e quello senza data in fondo', g.length === 2 && g[1].mese === '');
  verifica('col suo conto, non sommato a un mese qualunque', g[1].ordini === 2 && g[1].kg === 2500);
  verifica('e il mese vero resta intero', g[0].mese === '2026-07' && g[0].kg === 1000);
}

console.log('LA FUNZIONE E LA PAGINA FANNO QUESTO');
{
  const f = sorgente('base44/functions/getOrdiniDaDichiarare/entry.ts');
  verifica('il conto per mese si fa sulle righe filtrate, tutte',
    /const perMese = new Map\(\);\s*\n\s*for \(const r of filtrate\)/.test(f));
  verifica('il mese e quello della fine trasporto, mai la chiusura a portale',
    /const fine = fineDi\(r, dateFiltrate\.get\(r\)\);\s*\n\s*const chiave = fine \? fine\.slice\(0, 7\) : '';/.test(f));
  verifica('e si manda sempre, con la pagina', f.includes('per_mese,'));
  verifica('chi non ha la data finisce per ultimo', f.includes("(a.mese || '9999-99').localeCompare(b.mese || '9999-99')"));

  const t = sorgente('src/components/giacenze/DaDichiarareTable.jsx');
  verifica('la pagina mostra i mesi sopra la tabella', t.includes('Di quali mesi:') && t.includes('data?.per_mese'));
  verifica('e dice che l elenco parte dal carico piu vecchio e che i mesi recenti sono dopo',
    t.includes('i mesi più recenti sono nelle pagine dopo'));
  verifica('il totale sotto le righe dice di essere dell elenco, non della pagina',
    t.includes("TOTALE DELL&apos;ELENCO") && t.includes('In questa pagina'));
  verifica('e il peso della pagina si somma dalle righe che si vedono',
    t.includes('righe.reduce((s, r) => s + (r.peso_non_dichiarato_kg || 0), 0)'));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
