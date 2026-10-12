// I COLLEGAMENTI PORTANO DAVVERO ALLA SCHEDA E AL PERIODO (11/10/2026).
//
// La chiusura del mese (base44/shared/chiusuraMese.ts) e la dashboard portano a
// /fatturazione?tab=passiva&anno=2026&mese=Settembre&canale=ACI e simili. Prima
// le pagine non leggevano i parametri e si aprivano sulla scheda di sempre: il
// collegamento portava all'ingresso del modulo, non al punto da sistemare.
// Qui si prova:
// - la regola pura (src/lib/collegamenti.js): un parametro che non si capisce
//   si ignora, il mese col nome o col numero, il canale fra i tre;
// - che ogni collegamento scritto in chiusuraMese.ts punti a una pagina che
//   legge i parametri e a una scheda che quella pagina ha;
// - che le pagine leggano scheda, periodo e canale e li passino a chi li usa.
//
// node prove/collegamentiPagine.mjs
import { readFileSync } from 'node:fs';
import { leggiCollegamento, meseDaParametro, periodoDelCollegamento } from '../src/lib/collegamenti.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const leggi = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');

console.log('LA REGOLA: SI CAPISCE O SI IGNORA');
const a = leggiCollegamento('?tab=passiva&anno=2026&mese=Settembre&canale=ACI', ['passiva', 'attiva']);
verifica('scheda, anno, mese e canale', a.tab === 'passiva' && a.anno === 2026 && a.mese === 'Settembre' && a.canale === 'ACI', JSON.stringify(a));
verifica('il mese col numero', meseDaParametro('9') === 'Settembre' && meseDaParametro('12') === 'Dicembre' && meseDaParametro('01') === 'Gennaio');
verifica('il mese minuscolo', meseDaParametro('settembre') === 'Settembre');
verifica('un mese che non c\'e\' vale null', meseDaParametro('13') === null && meseDaParametro('0') === null && meseDaParametro('Settembrino') === null && meseDaParametro('') === null && meseDaParametro(null) === null);
const b = leggiCollegamento('?tab=margine&anno=abc&canale=tutti', ['passiva', 'attiva']);
verifica('una scheda che chi guarda non ha, un anno e un canale che non si capiscono valgono null', b.tab === null && b.anno === null && b.canale === null && b.mese === null, JSON.stringify(b));
verifica('anni fuori misura no', leggiCollegamento('?anno=26').anno === null && leggiCollegamento('?anno=2026.5').anno === null);
verifica('il canale in minuscolo si capisce', leggiCollegamento('?canale=extra_raccolta').canale === 'EXTRA_RACCOLTA');
verifica('il periodo solo con anno e mese tutti e due', periodoDelCollegamento({ anno: 2026, mese: null }, 'riserva') === 'riserva' && periodoDelCollegamento({ anno: 2026, mese: 'Settembre' }, null).mese === 'Settembre');
verifica('senza parametri tutto null', JSON.stringify(leggiCollegamento('', ['passiva'])) === JSON.stringify({ tab: null, anno: null, mese: null, canale: null }));

console.log('\nOGNI COLLEGAMENTO DELLA CHIUSURA DEL MESE ARRIVA A UNA SCHEDA CHE ESISTE');
const PAGINE = {
  '/fatturazione': 'src/pages/Fatturazione.jsx',
  '/verifiche-fornitori': 'src/pages/VerificheFornitori.jsx',
  '/verifiche': 'src/pages/Verifiche.jsx',
  '/dichiarazioni-impianti': 'src/pages/DichiarazioniImpianti.jsx',
};
const chiusura = leggi('base44/shared/chiusuraMese.ts');
const collegamenti = [
  ...[...chiusura.matchAll(/conPeriodo\('([^']+)', '([^']+)'/g)].map(m => ({ pagina: m[1], tab: m[2] })),
  ...[...chiusura.matchAll(/'(\/[a-z-]+)\?tab=([a-z-]+)/g)].map(m => ({ pagina: m[1], tab: m[2] })),
];
verifica('la chiusura del mese ha i suoi collegamenti', collegamenti.length >= 5, JSON.stringify(collegamenti));
// Le schede di una pagina: l'elenco SCHEDE, o schedeDi per chi e' amministratore.
const schedeDellaPagina = (src) => {
  const m = src.match(/const SCHEDE = \[([^\]]*)\]/) || src.match(/isAdmin \? \[([^\]]*)\]/);
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : [];
};
for (const c of collegamenti) {
  const file = PAGINE[c.pagina];
  verifica(`${c.pagina} e' una pagina conosciuta`, !!file, c.pagina);
  if (!file) continue;
  const src = leggi(file);
  verifica(`${c.pagina} legge i parametri del collegamento`, /leggiCollegamento\(location\.search/.test(src));
  verifica(`${c.pagina} ha la scheda «${c.tab}»`, schedeDellaPagina(src).includes(c.tab), JSON.stringify(schedeDellaPagina(src)));
  // La scheda deve esistere davvero nei Tabs della pagina.
  verifica(`${c.pagina}: la scheda «${c.tab}» c'e' a video`, new RegExp(`TabsTrigger value="${c.tab}"`).test(src));
}

console.log('\nLE PAGINE PASSANO PERIODO E CANALE A CHI LI USA');
const fa = leggi('src/pages/Fatturazione.jsx');
verifica('Fatturazione: i Tabs seguono la scheda del collegamento', /<Tabs value=\{tab\} onValueChange=\{setTab\}>/.test(fa));
verifica('Fatturazione: il periodo della passiva parte dal collegamento', /useState\(\(\) => periodoDelCollegamento\(arrivo, meseDiLavoro\(\)\)\)/.test(fa));
verifica('Fatturazione: il canale della passiva parte dal collegamento', /<Tabs value=\{canalePassiva\} onValueChange=\{setCanalePassiva\}>/.test(fa) && /useState\(arrivo\.canale \|\| 'RETE'\)/.test(fa));
verifica('Fatturazione: l\'attiva riceve il periodo del collegamento', /<FatturazioneAttiva .*periodoIniziale=\{periodoDelCollegamento\(arrivo, null\)\}/.test(fa));
verifica('FatturazioneAttiva parte dal periodo del collegamento', /useState\(\(\) => periodoIniziale \|\| meseDiLavoro\(\)\)/.test(leggi('src/components/fatturazione/FatturazioneAttiva.jsx')));
const vf = leggi('src/pages/VerificheFornitori.jsx');
verifica('Verifiche Fornitori: i consuntivi ricevono mese e canale', /<Consuntivi [^>]*periodoIniziale=\{periodoDelCollegamento\(arrivo, null\)\} canaleIniziale=\{arrivo\.canale\}/.test(vf));
const co = leggi('src/components/verifiche-fornitori/Consuntivi.jsx');
verifica('Consuntivi parte dal mese e dal canale del collegamento', /useState\(canaleIniziale \|\| 'RETE'\)/.test(co) && /\(periodoIniziale \|\| meseDiLavoro\(\)\)\.anno/.test(co));
const di = leggi('src/pages/DichiarazioniImpianti.jsx');
verifica('Dichiarazioni: anno e scheda dal collegamento', /useState\(\(\) => arrivo\.anno \|\| annoDiOggi\(\)\)/.test(di) && /<Tabs value=\{scheda\} onValueChange=\{setScheda\}>/.test(di));
verifica('Dichiarazioni: la pratica di Irigom riceve il mese, solo per la sua scheda e il suo anno', /meseIniziale=\{arrivo\.tab === 'irigom' && arrivo\.anno === anno \? arrivo\.mese : null\}/.test(di));
const pi = leggi('src/components/dichiarazioni/PraticaIrigom.jsx');
verifica('PraticaIrigom apre il mese del collegamento dopo aver letto le pratiche', /setArchiviLetti\(true\)/.test(pi) && /if \(MESI\.includes\(m\)\) scegliMese\(m\)/.test(pi));
// Un collegamento nuovo con la pagina gia' aperta (useEffect sull'indirizzo).
for (const p of Object.values(PAGINE)) verifica(`${p}: un collegamento nuovo con la pagina aperta si segue`, /\}, \[location\.search/.test(leggi(p)));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
