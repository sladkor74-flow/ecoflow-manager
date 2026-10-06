// Prova delle sezioni PDF delle schede di Giacenze e Target & Status
// (src/lib/giacenzePdf.js), chieste dall'utente il 06/10/2026: «un pulsante per
// esportare in pdf la situazione presente in ogni momento».
//
// Qui si controlla la forma degli argomenti - quella che esportaSezioniPdf si
// aspetta - e due cose che si sbagliano facilmente: un valore di riepilogo senza
// `tipo` finisce scritto in EURO, e le percentuali non sono euro. npm run prove
import { situazionePdf, derivatiPdf, targetPdf, targetRaccoglitoriPdf } from '../src/lib/giacenzePdf.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const righe = [
  { sito: 'Irigom S.r.l.', tipo_destinazione: 'imp', giacenza_portale_t: 555.34, giacenza_classi_kg: { P: 508460, M: 44080, G1: 7800, G2: 0, ACI: 0 }, in_attesa_dichiarazione_t: 0, ordini_da_dichiarare: 194, dichiarato_t: 2877.48, granulo_t: 1000, fibre_t: 200, metallo_t: 300, ciabattato_t: 0, cippato_t: 0, target_primarie_t: 3423.077, target_totale_t: 4445, conferito_primarie_t: 2716, secondarie_nette_t: 731.66, conferito_t: 3447.66, residuo_t: 997.34, percentuale_target: 61.1, conferito_aci_t: 0, conferito_extra_t: 0.46 },
  { sito: 'NAPPI SUD SRL', tipo_destinazione: 'stoc', giacenza_portale_t: 30.44, giacenza_classi_kg: { P: 18180, M: 7270, G1: 4990, G2: 0, ACI: 0 }, in_attesa_dichiarazione_t: 836.04, ordini_da_dichiarare: 390, dichiarato_t: 0, target_primarie_t: 2437.844, target_totale_t: 0, conferito_primarie_t: 1626.84, secondarie_nette_t: -1631.36, conferito_t: 1626.84, residuo_t: null, percentuale_target: null, conferito_aci_t: 19.72, conferito_extra_t: 0 },
];
const totali = { giacenza_portale_t: 1447.83, giacenza_aci_t: 26.81, in_attesa_dichiarazione_t: 836.04, dichiarato_t: 5339.66, granulo_t: 1000, fibre_t: 200, metallo_t: 300, target_primarie_t: 11550, target_totale_t: 11545, conferito_primarie_t: 8575.62, conferito_t: 10466.41 };

const forma = (a, quante) => a && typeof a.nomeFile === 'string' && a.nomeFile.length > 0
  && typeof a.titolo === 'string' && Array.isArray(a.sezioni) && a.sezioni.length === quante
  && a.sezioni.every(s => Array.isArray(s.colonne) && Array.isArray(s.righe)
    && s.righe.every(r => Array.isArray(r.celle) && r.celle.length === s.colonne.length));

console.log('LE TRE SCHEDE DI GIACENZE');
{
  const s = situazionePdf(2026, righe, totali);
  verifica('situazione: la forma e\' quella che esportaSezioniPdf si aspetta', forma(s, 1), JSON.stringify(s.sezioni?.[0]?.righe?.[0]));
  verifica('e ogni riga ha tante celle quante le colonne',
    s.sezioni[0].righe.length === 2 && s.sezioni[0].righe[0].celle.length === s.sezioni[0].colonne.length);
  verifica('il ruolo si legge a parole, non come sigla',
    s.sezioni[0].righe[0].celle[1] === 'Impianto' && s.sezioni[0].righe[1].celle[1] === 'Stoccaggio');

  const d = derivatiPdf(2026, righe, totali);
  verifica('derivati: ci sono solo i siti che hanno dichiarato', forma(d, 1) && d.sezioni[0].righe.length === 1);

  const t = targetPdf(2026, righe, totali);
  verifica('target: la forma torna', forma(t, 1));
  verifica('una percentuale ha il suo tipo, altrimenti il PDF la scrive in euro',
    t.sezioni[0].colonne.find(c => c.titolo === 'Copertura %')?.tipo === 'percentuale',
    JSON.stringify(t.sezioni[0].colonne.map(c => [c.titolo, c.tipo])));
  verifica('un residuo che non c\'e\' resta vuoto e non diventa zero',
    t.sezioni[0].righe[1].celle[7] === null, String(t.sezioni[0].righe[1].celle[7]));
}

console.log('OGNI VALORE DI RIEPILOGO DICE CHE COS\'E\'');
{
  // esportaTabella.js: `testoCella(r.valore, r.tipo || 'euro')`. Un riquadro
  // senza tipo stampa "11.550,00 €" al posto di "11.550,00 t".
  for (const [nome, a] of [['situazione', situazionePdf(2026, righe, totali)], ['derivati', derivatiPdf(2026, righe, totali)], ['target', targetPdf(2026, righe, totali)], ['raccoglitori', targetRaccoglitoriPdf(2026, [], null)]]) {
    verifica(`${nome}: nessun riquadro di riepilogo senza tipo`,
      (a.riepilogo || []).every(r => !!r.tipo), JSON.stringify((a.riepilogo || []).filter(r => !r.tipo)));
  }
}

console.log('LA GRIGLIA DEI TARGET DEI RACCOGLITORI');
{
  const elenco = [
    { nome: 'SMOCO S.r.l.', regione: 'Puglia', impianto: 'IRIGOM SRL', annuo: { target_tonnellate: 1850 }, mesi: { Gennaio: { target: 140 }, Febbraio: { target: 160 } } },
    { nome: 'EMMESSE SRLS', regione: 'Calabria', impianto: '', annuo: { target_tonnellate: 50 }, mesi: { Maggio: { target: 10 } } },
  ];
  const quote = (r) => (r.nome === 'EMMESSE SRLS' ? [{ impianto: 'Irigom S.r.l.', pct: 62 }, { impianto: 'Gatim', pct: 38 }] : []);
  const a = targetRaccoglitoriPdf(2026, elenco, quote);
  verifica('la forma torna e le celle sono quante le colonne', forma(a, 1));
  verifica('chi ha l\'impianto scritto lo mostra', a.sezioni[0].righe[0].celle[0] === 'IRIGOM SRL');
  verifica('chi non ce l\'ha dice come il gestionale lo sta ripartendo',
    a.sezioni[0].righe[1].celle[0] === 'ripartito: Irigom S.r.l. 62%, Gatim 38%', a.sezioni[0].righe[1].celle[0]);
  verifica('la somma dei mesi e il da ripartire sono calcolati, non copiati',
    a.sezioni[0].righe[0].celle[16] === 300 && a.sezioni[0].righe[0].celle[17] === 1550,
    JSON.stringify(a.sezioni[0].righe[0].celle.slice(15)));
  verifica('un mese che non raccoglie resta vuoto, non zero',
    targetRaccoglitoriPdf(2026, [{ nome: 'X', mesi: { Gennaio: { target: 10, non_raccoglie: true } }, annuo: null }], null).sezioni[0].righe[0].celle[4] === null);
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
