// Prova della pagina Terminati ACI (src/pages/PrimarieAci.jsx) e dei controlli
// del portale che le servono (src/lib/controlliPortaleAci.js), dall'audit del
// 20/09/2026, alte A12 e A13, corrette il 12/10/2026.
//
// Il dettaglio non aveva ne' il formulario ne' il ticket ne' lo stimato, e
// «Record» contava righe: un formulario ripartito su due ordini - la regola del
// portale quando il carico supera il 110% dello stimato del ticket - risultava
// due volte, e un ordine fuori regola si scopriva solo in fattura. Le soglie
// devono essere quelle della passiva, altrimenti la pagina e la fattura dicono
// due cose diverse dello stesso ordine. npm run prove
import { readFileSync } from 'node:fs';
import { caricaLibPagine } from './dati/libPagine.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const leggi = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');

const { controlliPortaleAci, problemiDellaRiga, MINIMO_ACI_KG, SOGLIA_ACI } = await caricaLibPagine('lib/controlliPortaleAci');
const formulariPagine = await caricaLibPagine('lib/formulari');
const { contaFormulari, contaFormulariConNumero } = formulariPagine;
const formulariFunzioni = await import('../base44/shared/formulari.ts');

console.log('LE SOGLIE SONO QUELLE DELLA PASSIVA');
// Dalla revisione del 13/10/2026 le soglie stanno in formulari (e nello
// specchio), e la pagina le importa invece di copiarle. La passiva, finche' le
// tiene sue, deve dire gli stessi numeri; se le importa, va bene lo stesso.
verifica('le soglie stanno in formulari, uguali nella copia delle funzioni e in quella delle pagine',
  formulariFunzioni.MINIMO_ACI_KG === 1500 && formulariFunzioni.SOGLIA_ACI === 1.1
  && formulariPagine.MINIMO_ACI_KG === formulariFunzioni.MINIMO_ACI_KG && formulariPagine.SOGLIA_ACI === formulariFunzioni.SOGLIA_ACI);
const controlliSorgente = leggi('src/lib/controlliPortaleAci.js');
verifica('i controlli della pagina le importano, senza una copia loro',
  /import \{[^}]*\bMINIMO_ACI_KG\b[^}]*\bSOGLIA_ACI\b[^}]*\} from '@\/lib\/formulari'/.test(controlliSorgente) && !/const (MINIMO_ACI_KG|SOGLIA_ACI) =/.test(controlliSorgente)
  && MINIMO_ACI_KG === formulariPagine.MINIMO_ACI_KG && SOGLIA_ACI === formulariPagine.SOGLIA_ACI);
const passiva = leggi('base44/shared/passivaCalcolo.ts');
const minimo = passiva.match(/const MINIMO_ACI_KG = (\d+);/);
const soglia = passiva.match(/const SOGLIA_ACI = ([\d.]+);/);
const importDaFormulari = (passiva.match(/import \{([^}]*)\} from ["']\.\/formulari\.ts["']/) || [])[1] || '';
const passivaImporta = /\bMINIMO_ACI_KG\b/.test(importDaFormulari) && /\bSOGLIA_ACI\b/.test(importDaFormulari);
verifica('stimato minimo uguale alla passiva', passivaImporta || (minimo && Number(minimo[1]) === MINIMO_ACI_KG), `${minimo && minimo[1]} contro ${MINIMO_ACI_KG}`);
verifica('soglia del ticket uguale alla passiva', passivaImporta || (soglia && Number(soglia[1]) === SOGLIA_ACI), `${soglia && soglia[1]} contro ${SOGLIA_ACI}`);

console.log('I CONTROLLI SULLE RIGHE');
// Il caso vero del 9 giugno 2026: RGYTR022620TW ripartito su due ordini, ciascuno
// col suo ticket e dentro la sua soglia. Non e' un doppione.
const ripartito = [
  { id_ordine: 'ET26091175', numero_ordine_interno: '162684-15', numero_fir: 'RGYTR022620TW', peso_stimato: 2800, peso_effettivo: 1960 },
  { id_ordine: 'ET26102183', numero_ordine_interno: '163142-85', numero_fir: 'RGYTR022620TW', peso_stimato: 1500, peso_effettivo: 1500 },
];
const sotto = { id_ordine: 'ET1', numero_ordine_interno: 'T1', numero_fir: 'AAAAA000001AA', peso_stimato: 1400, peso_effettivo: 1400 };
const oltre = { id_ordine: 'ET2', numero_ordine_interno: 'T2', numero_fir: 'AAAAA000002AA', peso_stimato: 2800, peso_effettivo: 3100 };
const alLimite = { id_ordine: 'ET3', numero_ordine_interno: 'T3', numero_fir: 'AAAAA000003AA', peso_stimato: 2800, peso_effettivo: 3080 };
const doppio = [
  { id_ordine: 'ET4', numero_ordine_interno: 'T4', numero_fir: 'AAAAA000004AA', peso_stimato: 2000, peso_effettivo: 1800 },
  { id_ordine: 'ET4', numero_ordine_interno: 'T4', numero_fir: 'AAAAA000004AA', peso_stimato: 2000, peso_effettivo: 1800 },
];
const senzaStimato = { id_ordine: 'ET5', numero_ordine_interno: '', numero_fir: 'AAAAA000005AA', peso_stimato: null, peso_effettivo: 2500 };
const tutte = [...ripartito, sotto, oltre, alLimite, ...doppio, senzaStimato];
const c = controlliPortaleAci(tutte);
verifica('lo stimato sotto i 1.500 kg si segnala', c.sotto_minimo.length === 1 && c.sotto_minimo[0] === sotto, JSON.stringify(c.sotto_minimo.map(r => r.id_ordine)));
verifica('l\'effettivo oltre il 110% del ticket si segnala, col massimo ammesso', c.oltre_soglia.length === 1 && c.oltre_soglia[0].riga === oltre && c.oltre_soglia[0].massimo_kg === 3080 && c.oltre_soglia[0].eccesso_perc === 10.7, JSON.stringify(c.oltre_soglia.map(o => [o.riga.id_ordine, o.massimo_kg, o.eccesso_perc])));
verifica('esattamente al 110% non e\' oltre', !c.oltre_soglia.some(o => o.riga === alLimite));
verifica('lo stesso formulario sullo stesso ordine e\' un doppio', c.doppi.length === 1 && c.doppi[0].numero_fir === 'AAAAA000004AA' && c.doppi[0].ordine === 'ET4', JSON.stringify(c.doppi.map(d => d.numero_fir)));
verifica('il formulario ripartito su due ordini non e\' un doppio', !c.doppi.some(d => d.numero_fir === 'RGYTR022620TW'));
verifica('senza stimato nessuna soglia: un dato che manca non e\' zero', !c.sotto_minimo.includes(senzaStimato) && !c.oltre_soglia.some(o => o.riga === senzaStimato));
verifica('otto righe, sei formulari: il ripartito e il doppio contano una volta', tutte.length === 8 && contaFormulari(tutte) === 6, String(contaFormulari(tutte)));
verifica('il segno della riga dice che cosa non torna', /sotto i 1\.500 kg/.test(problemiDellaRiga(sotto, c.doppi).join()) && /oltre il 110%/.test(problemiDellaRiga(oltre, c.doppi).join())
  && /ripetuto sullo stesso ordine/.test(problemiDellaRiga(doppio[1], c.doppi).join()) && problemiDellaRiga(ripartito[0], c.doppi).length === 0);

console.log('LA PAGINA');
const pagina = leggi('src/pages/PrimarieAci.jsx');
const colonne = (pagina.match(/const DETAIL_COLUMNS = \[([\s\S]*?)\n\];/) || [])[1] || '';
for (const k of ['numero_ordine_interno', 'numero_fir', 'peso_stimato', 'peso_effettivo']) {
  verifica(`il dettaglio ha la colonna ${k}`, new RegExp(`key: '${k}'`).test(colonne));
}
const chiavi = [...colonne.matchAll(/key: '([a-z_]+)'/g)].map(m => m[1]);
const i = chiavi.indexOf('numero_ordine_interno');
verifica('il ticket e lo stimato stanno accanto al peso effettivo', i >= 0 && chiavi[i + 1] === 'peso_stimato' && chiavi[i + 2] === 'peso_effettivo', JSON.stringify(chiavi));
verifica('i formulari si contano per numero, accanto agli ordini', /import \{ contaFormulariConNumero \} from '@\/lib\/formulari'/.test(pagina)
  && /contaFormulariConNumero\(contati\)/.test(pagina) && /contaFormulariConNumero\(v\.righe\)/.test(pagina));
verifica('nessuna colonna «Record»: si dice che cosa si conta', !/>Record</.test(pagina) && />Ordini</.test(pagina) && />Formulari</.test(pagina));
verifica('la pagina usa i controlli del portale sui terminati contati', /controlliPortaleAci\(contati\)/.test(pagina) && /problemiDellaRiga\(r, controlli\.doppi\)/.test(pagina));

// GLI ORDINI SENZA FORMULARIO NON SONO FORMULARI (revisione del 13/10/2026).
// Con il filtro «cancellato» la pagina diceva «6 formulari» per i 6 ordini
// cancellati dell'archivio dell'11/10, che un formulario non l'hanno:
// contaFormulari conta per uno ogni riga senza numero. In Terminati ACI si
// contano solo le righe col numero, e senza nessuno si scrive «—».
console.log('GLI ORDINI SENZA FORMULARIO');
const cancellati = Array.from({ length: 6 }, (_, k) => ({ id_ordine: `ETC${k}`, stato: 'cancellato', numero_fir: k % 2 ? '' : null, peso_effettivo: null }));
verifica('sei ordini cancellati senza formulario: nessun formulario', contaFormulariConNumero(cancellati) === 0, String(contaFormulariConNumero(cancellati)));
verifica('e la regola di sempre li contava per sei (per questo non si usa qui)', contaFormulari(cancellati) === 6);
verifica('le righe col numero si contano come prima: otto righe, sei formulari', contaFormulariConNumero(tutte) === 6);
verifica('insieme: contano solo quelli col numero', contaFormulariConNumero([...tutte, ...cancellati]) === 6);
verifica('le copie delle funzioni e delle pagine contano allo stesso modo',
  formulariFunzioni.contaFormulariConNumero([...tutte, ...cancellati]) === 6 && formulariFunzioni.contaFormulariConNumero(cancellati) === 0);
// Il «—» della pagina, preso dal sorgente e fatto girare.
const testo = (pagina.match(/const testoFormulari = (\(n\) => \(n > 0 \? formatIntero\(n\) : '—'\));/) || [])[1];
const testoFormulari = testo ? new Function('formatIntero', `return ${testo};`)((n) => String(n)) : null;
verifica('senza formulari la pagina scrive «—», non zero', testoFormulari && testoFormulari(0) === '—' && testoFormulari(6) === '6', String(testo));
verifica('anche la card degli ordini e il totale', /totalFormulari > 0 \?/.test(pagina) && /'formulari: —'/.test(pagina) && /\{testoFormulari\(totalFormulari\)\}/.test(pagina)
  && !/formatIntero\(contaFormulari/.test(pagina) && !/\bcontaFormulari\(/.test(pagina));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
