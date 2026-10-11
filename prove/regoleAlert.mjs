// Prova dei TIPI DI REGOLA ALERT: TRE LISTE, UNA RISPOSTA (chiusura dell'audit,
// 11/10/2026).
//
// I tipi di regola si leggono in tre posti: il menu della pagina Alert Engine
// (src/pages/AlertEngine.jsx, TIPI_REGOLA), l'elenco dell'archivio
// (base44/entities/RegolaAlert.jsonc, tipo_regola.enum) e il motore
// (base44/functions/runAlertEngine/entry.ts: checkRegola e i controlli
// aggregati). Fino all'11/10/2026 il menu e l'archivio offrivano campo
// obbligatorio, range valori, SLA tempi, congruenza peso e custom, che il motore
// non tratta: una regola di quei tipi risultava attiva e non apriva mai niente,
// senza un errore. tratta_combinazione era nel menu e nel motore ma non
// nell'archivio, che poteva respingerne il salvataggio; tratte_autorizzate_classe
// nell'archivio e nel motore ma non nel menu. Qui le tre liste devono coincidere.
// npm run prove
import { readFileSync } from 'node:fs';

const leggi = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const ordinati = (s) => [...s].sort().join(', ');

// il menu della pagina
const pagina = leggi('src/pages/AlertEngine.jsx');
const blocco = pagina.slice(pagina.indexOf('const TIPI_REGOLA = ['), pagina.indexOf('];', pagina.indexOf('const TIPI_REGOLA = [')));
const menu = new Set([...blocco.matchAll(/value: '([a-z_]+)'/g)].map(m => m[1]));

// l'elenco dell'archivio
const entita = JSON.parse(leggi('base44/entities/RegolaAlert.jsonc'));
const archivio = new Set(entita.properties.tipo_regola.enum);

// il motore: i tipi che checkRegola confronta e quelli dei controlli aggregati
const motoreTesto = leggi('base44/functions/runAlertEngine/entry.ts');
const motore = new Set([
  ...[...motoreTesto.matchAll(/\btipo === '([a-z_]+)'/g)].map(m => m[1]),
  ...[...motoreTesto.matchAll(/r\.tipo_regola === '([a-z_]+)'/g)].map(m => m[1]),
]);

console.log('LE TRE LISTE DEI TIPI DI REGOLA');
verifica('il motore valuta almeno i tipi di sempre', ['tratta_autorizzata', 'tratta_combinazione', 'tratte_autorizzate_classe', 'anomalia_peso', 'province_inattive', 'mix_classi_deviazione', 'scostamento_target', 'ritardo_sla'].every(t => motore.has(t)), ordinati(motore));
verifica('il menu offre solo i tipi che il motore valuta, e tutti', ordinati(menu) === ordinati(motore), `\n    menu:   ${ordinati(menu)}\n    motore: ${ordinati(motore)}`);
verifica("l'archivio accetta solo i tipi che il motore valuta, e tutti", ordinati(archivio) === ordinati(motore), `\n    archivio: ${ordinati(archivio)}\n    motore:   ${ordinati(motore)}`);
verifica('una regola gia\' salvata con un tipo che il motore non valuta si dice in pagina', /TIPI_VALUTATI\.has\(r\.tipo_regola\)/.test(pagina) && /non valutata dal motore/.test(pagina));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
