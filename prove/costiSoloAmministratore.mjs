// Costi e margine li vede solo l'amministratore (regola del progetto). Il
// 13/10/2026 la chiusura del giro del surplus ha trovato due pagine che li
// mostravano a tutti: la Fatturazione (scheda Passiva e Storico, che sono i
// documenti della passiva coi loro importi) e l'Extra Raccolta (riquadri Costi e
// Margine, colonne Costo totale e Margine). Il server della passiva rispondeva
// gia' 403 a chi non e' amministratore; le pagine no.
// Si lancia con: node prove/costiSoloAmministratore.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const sorgente = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('1. FATTURAZIONE: CHI NON E\' AMMINISTRATORE VEDE LA SOLA ATTIVA');
{
  const f = sorgente('src/pages/Fatturazione.jsx');
  const riga = (f.match(/const schedeDi = \(isAdmin\) => (.*);/) || [])[1];
  const schedeDi = riga ? new Function('isAdmin', 'return ' + riga) : null;
  verifica('le schede di chi non e\' amministratore: solo l\'Attiva', schedeDi && JSON.stringify(schedeDi(false)) === JSON.stringify(['attiva']), riga);
  verifica('quelle dell\'amministratore restano tutte', schedeDi && JSON.stringify(schedeDi(true)) === JSON.stringify(['passiva', 'attiva', 'margine', 'fornitori', 'tariffe', 'storico']));
  verifica('la linguetta Passiva solo all\'amministratore', /\{isAdmin && <TabsTrigger value="passiva">/.test(f) && !/^\s*<TabsTrigger value="passiva">/m.test(f));
  verifica('la linguetta Storico solo all\'amministratore', /\{isAdmin && <TabsTrigger value="storico">/.test(f) && !/^\s*<TabsTrigger value="storico">/m.test(f));
  verifica('il contenuto della Passiva solo all\'amministratore', /\{isAdmin && <TabsContent value="passiva"/.test(f));
  verifica('il contenuto dello Storico solo all\'amministratore', /\{isAdmin && <TabsContent value="storico"/.test(f));
  verifica('una scheda che non e\' sua porta chi non e\' amministratore sull\'Attiva', /if \(user && !schedeDi\(isAdmin\)\.includes\(tab\)\) setTab\(schedeDi\(isAdmin\)\[0\]\)/.test(f));
}

console.log('2. EXTRA RACCOLTA: COSTI E MARGINE SOLO ALL\'AMMINISTRATORE');
{
  const e = sorgente('src/pages/ExtraRaccolta.jsx');
  const i = e.indexOf('>Costi</div>');
  const prima = e.lastIndexOf('{isAdmin && (<>', i);
  const chiude = e.indexOf('</>)}', i);
  const margine = e.indexOf('>Margine</div>');
  verifica('i riquadri Costi e Margine stanno dentro un blocco dell\'amministratore', i > 0 && prima > 0 && prima < i && margine > i && chiude > margine && e.slice(prima, i).split('</div>').length < 30);
  verifica('le colonne Costo totale e Margine solo all\'amministratore', /\{isAdmin && <th[^>]*>Costo totale<\/th>\}/.test(e) && /\{isAdmin && <th[^>]*>Margine<\/th>\}/.test(e));
  verifica('le celle del costo e del margine solo all\'amministratore', /\{isAdmin && <td[^>]*>\s*\{soldi\(c\.costo_totale\)\}/.test(e) && /\{isAdmin && <td className=\{`[^`]*`\}>\s*\{soldi\(c\.margine\)\}/.test(e));
  const th = (e.match(/<th /g) || []).length;
  verifica('nessun\'altra colonna dice costi o margine', !/<th[^>]*>(Costo|Costi|Margine)[^<]*<\/th>/.test(e.replace(/\{isAdmin && <th[^>]*>[^<]*<\/th>\}/g, '')), String(th));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
