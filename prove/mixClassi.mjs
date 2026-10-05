// Prova del mix classi dei raccoglitori (base44/shared/primarieReteAnalytics.ts),
// la scheda "% di scostamento per classi" di Terminati Rete.
//
// Due viste, due domande (richiesta dell'utente del 06/10/2026): quanto pesa una
// classe sul raccolto, e quanto si e' fatto del target DI QUELLA CLASSE, cioe'
// del target annuo ripartito col mix consorziale P=75 M=20 G1=4 G2=1. npm run prove
import { computeRaccoglitoriMixData, TARGET_MIX_CLASSI } from '../base44/shared/primarieReteAnalytics.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const arrotonda = (v) => Math.round(v * 100) / 100;

let n = 0;
const riga = (trasportatore, classe, kg, extra = {}) => ({
  id_ordine: 'O' + (++n), stato: 'terminato',
  trasporto_finito_il: '2026-05-15T10:00:00Z',
  ordine_immesso_il: '2026-05-01T10:00:00Z', trasporto_iniziato_il: '2026-05-14T10:00:00Z',
  trasportatore, classe, prodotto: classe === 'P' ? 'P - fino a 35 kg' : classe + ' - prodotto',
  peso_effettivo: kg, provincia: 'SA', ...extra,
});

const filtri = { anno: [2026] };

console.log('IL TARGET DI UNA CLASSE E\' LA SUA QUOTA DEL TARGET ANNUO');
{
  // 1.000 t di target, 600 t di P raccolte: non e' il 60% (che sarebbe il peso
  // della P sul target intero) ma l'80%, perche' il target di P e' 750 t.
  const d = computeRaccoglitoriMixData(
    [riga('Alfa Srl', 'P', 600000), riga('Alfa Srl', 'M', 100000)],
    { 'Alfa Srl': 1000 }, filtri,
  );
  const r = d.raccoglitori[0];
  verifica('il target della classe e\' il target annuo per la quota consorziale',
    r.target_classi.P === 750 && r.target_classi.M === 200 && r.target_classi.G1 === 40 && r.target_classi.G2 === 10,
    JSON.stringify(r.target_classi));
  verifica('la percentuale sul target e\' sul target della classe, non su quello intero',
    arrotonda(r.percentuali_target.P) === 80 && arrotonda(r.percentuali_target.M) === 50,
    JSON.stringify(r.percentuali_target));
  verifica('le tonnellate di ogni classe ci sono, non solo la percentuale',
    r.tonnellate.P === 600 && r.tonnellate.M === 100 && r.tonnellate.G1 === 0, JSON.stringify(r.tonnellate));
  verifica('la percentuale sul raccolto resta il mix: 600 su 700',
    arrotonda(r.percentuali.P) === 85.71 && arrotonda(r.percentuali.M) === 14.29, JSON.stringify(r.percentuali));
  verifica('e il delta resta la differenza in punti dal mix consorziale',
    arrotonda(r.deviazioni.P) === arrotonda(r.percentuali.P - TARGET_MIX_CLASSI.P)
    && r.has_deviazione === true, JSON.stringify(r.deviazioni));
}

console.log('IL NOME DEL RACCOGLITORE SI RICONOSCE COME OVUNQUE');
{
  // I file del portale scrivono "SMOCO S.R.L.", i target "SMOCO S.r.l.": cercando
  // per nome esatto il piu' grande dei raccoglitori risultava senza target e
  // tutta la vista si azzerava.
  const d = computeRaccoglitoriMixData([riga('SMOCO S.R.L.', 'P', 100000)], { 'SMOCO S.r.l.': 1000 }, filtri);
  verifica('due grafie dello stesso nome si incontrano', d.raccoglitori[0].target_raccoglitore === 1000,
    String(d.raccoglitori[0].target_raccoglitore));

  // Chi ha piu' righe di target - una per regione - le somma tutte.
  const somma = computeRaccoglitoriMixData(
    [riga('SMOCO S.R.L.', 'P', 100000)],
    { 'SMOCO S.r.l.': 200, 'SMOCO SRL': 700, 'Smoco': 850 }, filtri,
  );
  verifica('piu\' righe di target dello stesso raccoglitore si sommano',
    somma.raccoglitori[0].target_raccoglitore === 1750, String(somma.raccoglitori[0].target_raccoglitore));

  // Senza target la percentuale non si inventa: resta zero e la pagina lo dice.
  const senza = computeRaccoglitoriMixData([riga('Beta', 'P', 100000)], {}, filtri);
  verifica('senza target le percentuali sul target restano a zero, e il target di classe pure',
    senza.raccoglitori[0].percentuali_target.P === 0 && senza.raccoglitori[0].target_classi.P === 0);
}

console.log('RETE, ACI ED EXTRA RACCOLTA NON SI SOMMANO MAI');
{
  // Una riga di autodemolizione finita nell'archivio di rete non e' rete: stava
  // nel totale del raccoglitore e abbassava la quota di tutte le classi.
  const d = computeRaccoglitoriMixData([
    riga('Alfa Srl', 'P', 750000),
    riga('Alfa Srl', 'M', 200000),
    riga('Alfa Srl', 'G1', 40000),
    riga('Alfa Srl', 'G2', 10000),
    riga('Alfa Srl', 'PFU Autodemolizione', 500000, { prodotto: 'PFU Autodemolizione' }),
  ], { 'Alfa Srl': 1000 }, filtri);
  const r = d.raccoglitori[0];
  verifica('l\'autodemolizione resta fuori dal totale di rete', r.totale_peso === 1000, String(r.totale_peso));
  verifica('e il mix torna esattamente ai target consorziali, senza diluizione',
    arrotonda(r.percentuali.P) === 75 && arrotonda(r.percentuali.M) === 20
    && arrotonda(r.percentuali.G1) === 4 && arrotonda(r.percentuali.G2) === 1, JSON.stringify(r.percentuali));
  verifica('chi ha il mix giusto e\' conforme', r.has_deviazione === false);
  verifica('e sul target e\' al cento per cento in tutte le classi',
    Object.values(r.percentuali_target).every(v => arrotonda(v) === 100), JSON.stringify(r.percentuali_target));
}

console.log('UNA CLASSE SCRITTA SOLO NEL PRODOTTO NON SI PERDE');
{
  // Col campo classe vuoto il peso restava fuori da ogni classe ma dentro il
  // totale: il mix usciva piu' basso del vero su tutte e quattro.
  const d = computeRaccoglitoriMixData([
    riga('Alfa Srl', '', 750000, { prodotto: 'P - fino a 35 kg' }),
    riga('Alfa Srl', 'M', 250000),
  ], { 'Alfa Srl': 1000 }, filtri);
  const r = d.raccoglitori[0];
  verifica('la classe si legge dal prodotto quando il campo e\' vuoto',
    r.tonnellate.P === 750 && arrotonda(r.percentuali.P) === 75, JSON.stringify([r.tonnellate, r.percentuali]));
  verifica('e non resta niente fuori dalle classi', r.altro_t === 0, String(r.altro_t));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
