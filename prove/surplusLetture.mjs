// LA GUARDIA DELLE LETTURE DEL SURPLUS (il surplus sulle tariffe, 13/10/2026).
//
// Il surplus sulle tariffe (il Fuel Surcharge del consorzio Ecotyre: +5 €/t dal
// 01/10/2026 al 31/12/2026 su rete, ACI ed extra raccolta) sta in un archivio a
// parte, SurplusTariffa, e non sulla Tariffa. E' stata una scelta (progetto del
// 12/10/2026, strada C): con il surplus dentro Tariffa un filtro dimenticato
// avrebbe fatto diventare 5 €/t il prezzo della rete senza che nessuno se ne
// accorgesse. Il prezzo della scelta e' l'opposto: chi chiama un calcolo senza
// leggere SurplusTariffa ottiene i numeri di prima, senza la riga del surplus e
// senza un errore. L'argomento del surplus e' facoltativo apposta, perche' i
// chiamanti non si rompessero durante il passaggio: proprio per questo nessuno
// se ne accorgerebbe.
//
// Questa prova e' la difesa. Cerca in base44/functions, base44/shared e src
// ogni chiamata dei quattro calcoli che fanno i numeri del surplus:
//   calcolaPassivaMese  (la passiva del mese, base44/shared/passivaCalcolo.ts)
//   calcolaRigheAttiva  (le righe della fattura a Ecotyre, base44/shared/attivaCalcolo.ts)
//   calcolaMargineAnno  (il margine, base44/shared/margine.ts)
//   contestoPrezzi      (i prezzi dell'extra raccolta in pagina, src/lib/extraRaccoltaCalc.js)
// e pretende, per ognuna, che la chiamata PASSI il surplus e che il surplus
// passato VENGA da una lettura di SurplusTariffa: nello stesso file, o da chi
// chiama la funzione che lo riceve come parametro (risalendo i chiamanti, anche
// fra file diversi e nei componenti, <Componente surplus={...} />).
//
// In piu':
//   - i quattro calcoli lo accettano (un parametro o un campo dei dati col surplus);
//   - nessuno li usa per vie traverse (un alias d'importazione si segue, un
//     riferimento senza chiamata - const f = calcolaPassivaMese - no: la guardia
//     non vedrebbe dove arriva);
//   - un surplus vuoto scritto a mano (surplusAll: []) non vale come passato;
//   - SurplusTariffa non si legge con un filtro sullo stato: come per le tariffe
//     si legge tutto e il disattivato si toglie in memoria (surplusValeIl).
//
// I file si leggono senza i \r di Windows, con i commenti tolti e con i testi
// fra virgolette mascherati: una chiamata citata in un commento o in un messaggio
// non e' una chiamata. La guardia prova anche se stessa su sorgenti costruiti
// (sezione 1), cosi' una sua svista non diventa un verde finto.
//
// Se la prova trova un lettore dimenticato, la correzione e' nel lettore (leggere
// SurplusTariffa tutto, come le tariffe, e passarlo al calcolo), non qui.
//
// node prove/surplusLetture.mjs            l'albero di lavoro
// node prove/surplusLetture.mjs <cartella> un'altra copia del repository (la controprova)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = process.argv[2] ? resolve(process.argv[2]) : join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// I quattro calcoli e il file dove stanno.
const CALCOLI = {
  calcolaPassivaMese: 'base44/shared/passivaCalcolo.ts',
  calcolaRigheAttiva: 'base44/shared/attivaCalcolo.ts',
  calcolaMargineAnno: 'base44/shared/margine.ts',
  contestoPrezzi: 'src/lib/extraRaccoltaCalc.js',
};

// Le chiamate senza surplus, una per una e col motivo. Due elenchi, come in
// prove/scrittureTracciate.mjs, e la differenza conta:
// - PER NATURA: chiamate che il surplus non lo devono portare;
// - DA PORTARE: chiamate che lo dovrebbero portare e non lo portano ancora, per
//   una scelta scritta nel codice e detta a video. Sono un debito: chi lo salda
//   toglie la voce da qui.
// Un'eccezione che non serve piu' fa fallire la prova: rimasta li', coprirebbe la
// prossima chiamata senza surplus nello stesso punto.
const SENZA_SURPLUS = [
  {
    file: 'src/lib/extraRaccoltaCalc.js', nome: 'contestoPrezzi', riga: /\bCONTESTO_VUOTO\s*=\s*contestoPrezzi\s*\(/, debito: false,
    motivo: "il contesto vuoto di chi non ha letto niente: senza tariffe e senza surplus restano i due gradini del prezzo che non hanno bisogno di letture (il prezzo scritto e la base dell'anno)",
  },
  {
    file: 'src/pages/ExtraRaccolta.jsx', nome: 'contestoPrezzi', riga: /\bcontestoFile\s*=\s*useMemo\s*\(\s*\(\)\s*=>\s*contestoPrezzi\s*\(/, debito: true,
    motivo: "i file Excel e PDF dell'elenco degli interventi (src/lib/extraRaccoltaExport.js) non hanno ancora la riga del surplus: ricevono i soli prezzi, cosi' i loro totali restano quelli delle loro righe, e accanto ai pulsanti la pagina dice che i file riportano gli importi standard e che il surplus sta nella fattura attiva e nella passiva del mese (13/10/2026). Si toglie da qui quando extraRaccoltaExport.js scrive la riga del surplus",
  },
];

const PAROLE = new Set(['return', 'typeof', 'case', 'in', 'of', 'void', 'delete', 'throw', 'new', 'instanceof', 'yield', 'await', 'else', 'do']);
const RISERVATE = new Set([...PAROLE, 'null', 'undefined', 'true', 'false', 'async', 'function', 'const', 'let', 'var', 'this', 'if', 'for', 'while', 'switch', 'try', 'catch', 'finally', 'import', 'export', 'from', 'default', 'class', 'extends', 'super', 'Math', 'Number', 'String', 'Object', 'Array', 'JSON', 'Date', 'Promise', 'Boolean', 'Set', 'Map']);

/**
 * Il sorgente in due versioni con le stesse posizioni: `codice` senza i commenti
 * (i testi restano), `struttura` senza commenti e con il contenuto di testi,
 * template ed espressioni regolari sostituito da spazi (restano i delimitatori e
 * le espressioni dentro ${...}). Gli a capo restano dove sono, per i numeri di riga.
 * Un testo o un'espressione regolare non va oltre la riga: nel testo libero del
 * JSX un apostrofo non si porta via il resto del file.
 */
function maschera(t) {
  const n = t.length;
  const cod = t.split(''), str = t.split('');
  const vuota = (a, i) => { if (a[i] !== '\n') a[i] = ' '; };
  const pila = [];
  let prec = '', precPrec = '', parola = '';
  const segna = (c) => { precPrec = prec; prec = c; };
  let i = 0;
  while (i < n) {
    const ch = t[i];
    const cima = pila[pila.length - 1];
    if (cima && cima.tipo === 'tpl') {
      if (ch === '\\') { vuota(str, i); if (i + 1 < n) vuota(str, i + 1); i += 2; continue; }
      if (ch === '`') { pila.pop(); segna(')'); parola = ''; i++; continue; }
      if (ch === '$' && t[i + 1] === '{') { pila.push({ tipo: 'expr', graffe: 0 }); segna('{'); parola = ''; i += 2; continue; }
      vuota(str, i); i++; continue;
    }
    if (ch === '/' && t[i + 1] === '/') { while (i < n && t[i] !== '\n') { vuota(cod, i); vuota(str, i); i++; } continue; }
    if (ch === '/' && t[i + 1] === '*') {
      const f = t.indexOf('*/', i + 2);
      const fine = f < 0 ? n : f + 2;
      while (i < fine) { vuota(cod, i); vuota(str, i); i++; }
      continue;
    }
    if (ch === '"' || ch === "'") {
      i++;
      while (i < n && t[i] !== ch && t[i] !== '\n') {
        if (t[i] === '\\' && i + 1 < n && t[i + 1] !== '\n') { vuota(str, i); i++; }
        vuota(str, i); i++;
      }
      if (t[i] === ch) i++;
      segna(')'); parola = ''; continue;
    }
    if (ch === '`') { pila.push({ tipo: 'tpl' }); i++; continue; }
    if (ch === '/') {
      const regex = prec === '' || /[(,=:[!&|?{};+\-*%~^]/.test(prec) || (prec === '>' && precPrec === '=') || (/[\w$]/.test(prec) && PAROLE.has(parola));
      if (regex) {
        i++;
        let classe = false;
        while (i < n && t[i] !== '\n') {
          if (t[i] === '\\') { vuota(str, i); i++; if (i < n && t[i] !== '\n') { vuota(str, i); i++; } continue; }
          if (t[i] === '[') classe = true;
          else if (t[i] === ']') classe = false;
          else if (t[i] === '/' && !classe) break;
          vuota(str, i); i++;
        }
        if (t[i] === '/') i++;
        while (i < n && /[a-z]/i.test(t[i])) i++;
        segna(')'); parola = ''; continue;
      }
      segna('/'); parola = ''; i++; continue;
    }
    if (/[\w$]/.test(ch)) {
      let j = i;
      while (j < n && /[\w$]/.test(t[j])) j++;
      parola = /^[A-Za-z_$]/.test(ch) ? t.slice(i, j) : '';
      segna(t[j - 1]); i = j; continue;
    }
    if (ch === '{') { if (cima && cima.tipo === 'expr') cima.graffe++; segna('{'); parola = ''; i++; continue; }
    if (ch === '}') {
      if (cima && cima.tipo === 'expr') {
        if (cima.graffe === 0) { pila.pop(); i++; continue; }
        cima.graffe--;
      }
      segna('}'); parola = ''; i++; continue;
    }
    if (/\s/.test(ch)) { i++; continue; }
    segna(ch); parola = ''; i++;
  }
  return { codice: cod.join(''), struttura: str.join('') };
}

/** La parentesi (tonda, quadra o graffa) che chiude quella in posizione i; -1 se manca. */
function chiusura(s, i) {
  let d = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '(' || c === '[' || c === '{') d++;
    else if (c === ')' || c === ']' || c === '}') { d--; if (d === 0) return j; }
  }
  return -1;
}

/** Dove finisce un'espressione che comincia in k: un ; o una virgola a profondita' zero, o la parentesi di chi la contiene. */
function fineEspressione(s, k) {
  let d = 0;
  for (let j = k; j < s.length; j++) {
    const c = s[j];
    if (c === '(' || c === '[' || c === '{') d++;
    else if (c === ')' || c === ']' || c === '}') { if (d === 0) return j; d--; }
    else if (d === 0 && (c === ';' || c === ',')) return j;
    else if (d === 0 && c === '\n') {
      const resto = s.slice(j + 1).match(/^\s*(\S)/);
      const prima = s.slice(k, j).trimEnd().slice(-1);
      if (!(resto && /[.?:&|+\-*/=]/.test(resto[1])) && !/[=(,?:&|+\-*/[{]/.test(prima)) return j;
    }
  }
  return s.length;
}

/** Dove comincia l'espressione che finisce in k (esclusa): un ; o una virgola a profondita' zero, o la parentesi aperta di chi la contiene. */
function inizioEspressione(s, k) {
  let d = 0;
  for (let j = k - 1; j >= 0; j--) {
    const c = s[j];
    if (c === ')' || c === ']' || c === '}') d++;
    else if (c === '(' || c === '[' || c === '{') { if (d === 0) return j + 1; d--; }
    else if (d === 0 && (c === ';' || c === ',')) return j + 1;
  }
  return 0;
}

/** Le funzioni con un nome: function X(...), const X = (...) =>, const X = function(...), const X = y =>. */
function funzioniDi(s) {
  const out = [];
  // Il tipo restituito dei file .ts (function f(a: T): R { ... }, (a): R => ...)
  // si salta: il corpo comincia alla prima graffa, o dopo la freccia.
  const dopoIlTipo = (k) => {
    while (/\s/.test(s[k] || '')) k++;
    if (s[k] !== ':') return k;
    const graffa = s.indexOf('{', k), freccia = s.indexOf('=>', k);
    if (freccia >= 0 && (graffa < 0 || freccia < graffa) && !/[;\n]/.test(s.slice(k, freccia))) return freccia;
    return graffa < 0 ? k : graffa;
  };
  const corpo = (k) => {
    k = dopoIlTipo(k);
    if (s.startsWith('=>', k)) k += 2;
    while (/\s/.test(s[k] || '')) k++;
    if (s[k] === '{') return chiusura(s, k);
    return fineEspressione(s, k);
  };
  for (const m of s.matchAll(/\b(export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g)) {
    const ap = m.index + m[0].length - 1;
    const ch = chiusura(s, ap);
    if (ch < 0) continue;
    out.push({ nome: m[2], params: s.slice(ap + 1, ch), inizio: m.index, fine: corpo(ch + 1), esportata: !!m[1], predefinita: /default/.test(m[1] || '') });
  }
  for (const m of s.matchAll(/\b(export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(function\s*\*?\s*[\w$]*\s*)?\(/g)) {
    const ap = m.index + m[0].length - 1;
    const ch = chiusura(s, ap);
    if (ch < 0) continue;
    const k = dopoIlTipo(ch + 1);
    if (!m[3] && !s.startsWith('=>', k)) continue;
    out.push({ nome: m[2], params: s.slice(ap + 1, ch), inizio: m.index, fine: corpo(k), esportata: !!m[1], predefinita: false });
  }
  for (const m of s.matchAll(/\b(export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/g)) {
    out.push({ nome: m[2], params: m[3], inizio: m.index, fine: corpo(m.index + m[0].length), esportata: !!m[1], predefinita: false });
  }
  for (const m of s.matchAll(/\bexport\s+default\s+([A-Za-z_$][\w$]*)\s*;?\s*$/gm)) {
    for (const f of out) if (f.nome === m[1]) f.predefinita = true;
  }
  return out;
}

/** Le importazioni di un file: [{ da, locale, importato }] ('default' e '*' per le due forme senza graffe). */
function importazioniDi(codice) {
  const out = [];
  for (const m of codice.matchAll(/\bimport\s+([^'"`;]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const clausola = m[1].trim();
    const da = m[2];
    const graffe = clausola.match(/\{([\s\S]*)\}/);
    const fuori = clausola.replace(/\{[\s\S]*\}/, '').replace(/,/g, ' ').trim();
    const ns = fuori.match(/\*\s*as\s+([A-Za-z_$][\w$]*)/);
    if (ns) out.push({ da, locale: ns[1], importato: '*' });
    else if (/^[A-Za-z_$][\w$]*$/.test(fuori)) out.push({ da, locale: fuori, importato: 'default' });
    if (graffe) {
      for (const pezzo of graffe[1].split(',')) {
        const x = pezzo.trim().match(/^(?:type\s+)?([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
        if (x) out.push({ da, locale: x[2] || x[1], importato: x[1] });
      }
    }
  }
  return out;
}

const baseDi = (p) => {
  const parti = String(p).replace(/\\/g, '/').split('/');
  let b = parti.pop().replace(/\.(m?[jt]sx?|cjs)$/, '');
  if (b === 'index' && parti.length) b = parti.pop();
  return b;
};

const rigaDi = (s, pos) => { let r = 1; for (let i = 0; i < pos && i < s.length; i++) if (s[i] === '\n') r++; return r; };
const testoRiga = (testo, riga) => (testo.split('\n')[riga - 1] || '').trim().slice(0, 160);

/** Gli argomenti di primo livello di una chiamata, gia' mascherati. */
function argomentiDi(args) {
  const out = [];
  let d = 0, da = 0;
  for (let j = 0; j < args.length; j++) {
    const c = args[j];
    if (c === '(' || c === '[' || c === '{') d++;
    else if (c === ')' || c === ']' || c === '}') d--;
    else if (c === ',' && d === 0) { out.push(args.slice(da, j).trim()); da = j + 1; }
  }
  const ultimo = args.slice(da).trim();
  if (ultimo) out.push(ultimo);
  return out;
}

const PARLA_DI_SURPLUS = /\bsurplus\w*/i;
// Il valore di un surplus vuoto scritto a mano: [], null, undefined, {}.
const VALORE_VUOTO = /^\s*(?:\[\s*\]|null|undefined|\{\s*\}|false|0)?\s*$/;
// Un surplus vuoto scritto a mano: surplusAll: [], surplus = null, surplus={[]}.
const SURPLUS_VUOTO = /\bsurplus\w*\s*[:=]\s*\{?\s*(?:\[\s*\]|null|undefined|\{\s*\})\s*\}?\s*(?:[,)}\n]|$)/i;

/**
 * Prepara l'analisi di un insieme di sorgenti ({ percorso: testo }).
 * Tutto quello che segue lavora su questo, cosi' la guardia si prova anche su
 * sorgenti costruiti (sezione 1).
 */
function analizza(sorgenti) {
  const F = new Map();
  for (const [p, testo] of Object.entries(sorgenti)) {
    const t = String(testo).replace(/\r/g, '');
    const { codice, struttura } = maschera(t);
    F.set(p, { p, testo: t, codice, struttura, funzioni: funzioniDi(struttura), importazioni: importazioniDi(codice) });
  }

  // Legge SurplusTariffa: l'archivio passato a chi legge (fetchAll(svc.SurplusTariffa),
  // fetchAllClient(base44.entities.SurplusTariffa, ...)) o letto direttamente
  // (.SurplusTariffa.list / .filter / .get), o entities['SurplusTariffa'].
  const legge = (f) => /\.\s*SurplusTariffa\b\s*(?:\.\s*(?:list|filter|get)\s*\(|[,)])/.test(f.struttura)
    || /\[\s*['"`]SurplusTariffa['"`]\s*\]/.test(f.codice);

  // I nomi con cui un file chiama una funzione definita in `daFile`: il suo nome
  // nel file stesso, il nome locale (anche con alias) in chi la importa da li',
  // NS.nome con import * as NS.
  const nomiLocali = (f, nome, daFile, predefinita) => {
    const nomi = [];
    if (f.p === daFile) nomi.push(nome);
    for (const imp of f.importazioni) {
      if (baseDi(imp.da) !== baseDi(daFile)) continue;
      if (imp.importato === nome || (predefinita && imp.importato === 'default')) nomi.push(imp.locale);
      if (imp.importato === '*') nomi.push(`${imp.locale}.${nome}`);
    }
    return [...new Set(nomi)];
  };
  const esc = (x) => x.replace(/[.$]/g, (c) => '\\' + c);

  /** Le chiamate di una funzione in tutti i file: [{ file, pos, args, jsx }]. */
  const chiamate = (nome, daFile, predefinita = false) => {
    const out = [];
    for (const f of F.values()) {
      for (const locale of nomiLocali(f, nome, daFile, predefinita)) {
        const s = f.struttura;
        // ...calcolaMargineAnno(...) e' una chiamata (lo spread), x.nome(...) no
        for (const m of s.matchAll(new RegExp(`(?<![\\w$])(?<!(?:^|[^.])\\.)${esc(locale)}\\s*\\(`, 'g'))) {
          const prima = s.slice(Math.max(0, m.index - 30), m.index);
          if (/\bfunction\s*\*?\s*$/.test(prima)) continue;
          const ap = m.index + m[0].length - 1;
          const ch = chiusura(s, ap);
          if (ch < 0) continue;
          // un metodo definito con lo stesso nome (nome(...) { ... }) non e' una chiamata
          const dopo = s.slice(ch + 1).match(/^\s*(\S)/);
          if (dopo && dopo[1] === '{' && /(^|[\n;{}])\s*$/.test(prima)) continue;
          // posNome: dove sta il nome stesso (in P.nome(...) dopo «P.»)
          const posNome = locale.endsWith(nome) ? m.index + locale.length - nome.length : m.index;
          out.push({ file: f.p, pos: m.index, posNome, args: s.slice(ap + 1, ch), jsx: false });
        }
        if (!locale.includes('.')) {
          for (const m of s.matchAll(new RegExp(`<${esc(locale)}(?![\\w$])`, 'g'))) {
            let d = 0, j = m.index + m[0].length;
            for (; j < s.length; j++) {
              const c = s[j];
              if (c === '{' || c === '(' || c === '[') d++;
              else if (c === '}' || c === ')' || c === ']') d--;
              else if (c === '>' && d === 0) break;
            }
            out.push({ file: f.p, pos: m.index, args: s.slice(m.index + m[0].length, j), jsx: true });
          }
        }
      }
    }
    return out;
  };

  /** Le funzioni con un nome che contengono la posizione, dalla piu' interna. */
  const racchiudenti = (f, pos) => f.funzioni.filter(x => x.inizio < pos && pos < x.fine).sort((a, b) => (a.fine - a.inizio) - (b.fine - b.inizio));

  const identificatori = (testo) => [...String(testo).matchAll(/(?<![\w$])(?<!(?:^|[^.])\.)([A-Za-z_$][\w$]*)/g)].map(m => m[1]).filter(x => !RISERVATE.has(x));

  /**
   * Da che cosa nasce una variabile del file, prima della posizione: il testo
   * dell'inizializzazione (const x = ...). Le due forme in cui le pagine e le
   * funzioni leggono gli archivi si seguono anche quando il nome non dice
   * «surplus»: lo stato di una pagina (const [x, setX] = useState(...), e allora
   * contano le righe dove si chiama setX, cioe' la lettura) e la lettura in
   * parallelo (const [a, b, x] = await Promise.all([..., ..., lettura]), e allora
   * conta la lettura nella stessa posizione).
   */
  const definizioneLocale = (f, nome, pos, profondita = 0) => {
    const s = f.struttura;
    let trovata = null;
    if (profondita > 3) return null;
    for (const m of s.matchAll(new RegExp(`\\b(?:const|let|var)\\s+${esc(nome)}\\s*=`, 'g'))) {
      if (m.index > pos) break;
      const k = m.index + m[0].length;
      trovata = s.slice(k, fineEspressione(s, k));
    }
    if (trovata !== null) return trovata;
    for (const m of s.matchAll(/\b(?:const|let|var)\s*\[([^\]]*)\]\s*=\s*/g)) {
      if (m.index > pos) break;
      const nomi = m[1].split(',').map(x => x.trim().replace(/^\.\.\./, '').replace(/\s*=[\s\S]*$/, ''));
      const indice = nomi.indexOf(nome);
      if (indice < 0) continue;
      const k = m.index + m[0].length;
      const init = s.slice(k, fineEspressione(s, k));
      const setter = nomi[1];
      if (/^\s*(?:React\.)?useState\s*\(/.test(init) && indice === 0 && setter) {
        // Solo quello che finisce nello stato: l'argomento di setX(...) (seguito
        // fino alla sua lettura se e' una variabile) o la lettura di cui setX e'
        // il .then. Le righe intorno no: una lettura di SurplusTariffa vicina
        // alla lettura delle tariffe farebbe sembrare «col surplus» le tariffe.
        const pezzi = [];
        for (const x of s.matchAll(new RegExp(`(?<![\\w$.])${esc(setter)}(?![\\w$])`, 'g'))) {
          const dopo = s.slice(x.index + setter.length);
          if (/^\s*\(/.test(dopo)) {
            const ap = x.index + setter.length + dopo.indexOf('(');
            const arg = s.slice(ap + 1, Math.max(ap + 1, chiusura(s, ap))).trim();
            const def = /^[A-Za-z_$][\w$]*$/.test(arg) ? definizioneLocale(f, arg, x.index, profondita + 1) : null;
            pezzi.push(def !== null ? def : arg);
          } else if (/\.then\s*\(\s*$/.test(s.slice(Math.max(0, x.index - 40), x.index))) {
            const ap = s.lastIndexOf('(', x.index);
            pezzi.push(s.slice(inizioEspressione(s, ap), x.index));
          }
        }
        trovata = pezzi.join('\n');
      } else {
        const parallela = init.match(/Promise\.all\s*\(\s*\[/);
        if (parallela) {
          const ap = init.indexOf('[', parallela.index);
          const ch = chiusura(init, ap);
          trovata = ch > 0 ? (argomentiDi(init.slice(ap + 1, ch))[indice] || '') : init;
        } else {
          trovata = init;
        }
      }
    }
    return trovata;
  };

  /**
   * Da dove arriva il surplus di una chiamata (o di un componente).
   * -> { ok, perche }
   */
  const alimentata = (file, pos, args, visti = new Set()) => {
    const f = F.get(file);
    const argomenti = argomentiDi(args);
    if (SURPLUS_VUOTO.test(args)) return { ok: false, perche: 'passa un surplus vuoto scritto a mano' };
    // 1. Che cosa porta il surplus: le espressioni della chiamata che ne parlano
    //    (il valore di surplusAll: ..., l'argomento col surplus), non gli altri
    //    dati; oppure un argomento che e' una variabile del file costruita col
    //    surplus (const archivi = { ..., surplusAll }, lo stato di una pagina, una
    //    lettura in parallelo).
    let passato = [];
    for (const a of argomenti) {
      if (a.startsWith('{')) passato.push(...campiDi(a).filter(x => PARLA_DI_SURPLUS.test(x.chiave) || PARLA_DI_SURPLUS.test(x.valore)).map(x => x.valore));
      else if (PARLA_DI_SURPLUS.test(a)) passato.push(a);
    }
    if (!passato.length) {
      for (const a of argomenti.map(x => x.replace(/^\.\.\./, ''))) {
        if (!/^[A-Za-z_$][\w$]*$/.test(a)) continue;
        const def = definizioneLocale(f, a, pos);
        if (def && PARLA_DI_SURPLUS.test(def)) {
          if (SURPLUS_VUOTO.test(def)) return { ok: false, perche: `passa ${a}, costruito con un surplus vuoto scritto a mano` };
          passato = [a];
          break;
        }
      }
    }
    const porta = passato.length > 0;
    const dirette = new Set(passato.flatMap(p => identificatori(p)));
    // 2. un file che legge SurplusTariffa e lo passa. Ma se il surplus passato e'
    //    il parametro di una funzione che contiene la chiamata, la lettura nel
    //    file non basta: conta chi chiama quella funzione (punto 3).
    const daParametro = porta && racchiudenti(f, pos).some(E => identificatori(E.params).some(x => dirette.has(x)));
    if (porta && legge(f) && !daParametro) return { ok: true, perche: 'legge SurplusTariffa' };
    // 3. altrimenti lo deve ricevere: da un parametro di una funzione che lo
    //    contiene, e allora tutti quelli che la chiamano lo devono passare (e
    //    averlo letto, o ricevuto a loro volta).
    const radici = new Set();
    if (porta) {
      for (const x of dirette) {
        radici.add(x);
        const def = definizioneLocale(f, x, pos);
        if (def) for (const y of identificatori(def)) radici.add(y);
      }
    } else {
      for (const a of argomenti) if (/^(\.\.\.)?[A-Za-z_$][\w$]*$/.test(a)) radici.add(a.replace(/^\.\.\./, ''));
    }
    for (const E of racchiudenti(f, pos)) {
      const parametri = identificatori(E.params);
      if (!parametri.some(x => radici.has(x))) continue;
      const chiave = `${file}#${E.nome}`;
      if (visti.has(chiave)) return { ok: false, perche: `giro chiuso su ${E.nome}` };
      const chi = chiamate(E.nome, file, E.predefinita).filter(c => !(c.file === file && c.pos >= E.inizio && c.pos < E.fine));
      if (!chi.length) return { ok: false, perche: `lo aspetta da un parametro di ${E.nome}, ma nessuno chiama ${E.nome}` };
      const contratto = contrattoDi(E, f.struttura);
      for (const c of chi) {
        const e = verificaChiamata(c, contratto, new Set([...visti, chiave]));
        if (!e.ok) return { ok: false, perche: `lo aspetta da ${E.nome}, ma ${c.file}:${rigaDi(F.get(c.file).struttura, c.pos)} ${e.perche}` };
      }
      return { ok: true, perche: `lo riceve da chi chiama ${E.nome} (${[...new Set(chi.map(c => `${c.file}:${rigaDi(F.get(c.file).struttura, c.pos)}`))].join(', ')})` };
    }
    return { ok: false, perche: porta ? 'passa un surplus che non legge da SurplusTariffa e non riceve da nessuno' : 'non passa il surplus' };
  };

  /**
   * Come una funzione riceve il surplus, letto dalla sua definizione:
   * - { tipo: 'campi', posizione, campi }: un oggetto di dati, e il surplus e'
   *   uno dei suoi campi ({ ..., surplusAll = [] }, oppure dati.surplusAll nel corpo);
   * - { tipo: 'posizione', posizione }: un argomento a se' (contestoPrezzi(t, f, surplus)).
   * null se dalla definizione non si capisce.
   */
  const contrattoDi = (funz, struttura) => {
    const params = argomentiDi(funz.params);
    const corpo = struttura.slice(funz.inizio, funz.fine);
    for (let i = 0; i < params.length; i++) {
      const p = params[i];
      if (p.startsWith('{')) {
        const campi = campiDi(p).map(c => c.chiave).filter(c => PARLA_DI_SURPLUS.test(c));
        if (campi.length) return { tipo: 'campi', posizione: i, campi };
        continue;
      }
      // senza il valore predefinito e senza il tipo dei .ts (dati?: Dati = {})
      const nome = p.replace(/^\.\.\./, '').replace(/\s*=[\s\S]*$/, '').replace(/\??\s*:[\s\S]*$/, '').trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(nome)) continue;
      if (PARLA_DI_SURPLUS.test(nome)) return { tipo: 'posizione', posizione: i };
      const campi = [...new Set([...corpo.matchAll(new RegExp(`(?<![\\w$.])${esc(nome)}\\s*\\.\\s*(surplus\\w*)`, 'gi'))].map(m => m[1]))];
      if (campi.length) return { tipo: 'campi', posizione: i, campi };
    }
    return null;
  };

  /**
   * Una chiamata (o un <Componente ... />) passa il surplus come la funzione lo
   * riceve, e il surplus che passa e' letto? Con il contratto si guarda
   * l'argomento giusto e il campo giusto: calcolaPassivaMese legge surplusAll, e
   * un { surplus: x } li' si perderebbe in silenzio. Senza contratto, il controllo
   * largo di alimentata.
   */
  const verificaChiamata = (c, contratto, visti = new Set()) => {
    const f = F.get(c.file);
    if (!contratto) return alimentata(c.file, c.pos, c.args, visti);
    const nomeCampi = () => (contratto.campi || []).join(' o ');
    let campi;
    if (c.jsx) {
      if (contratto.tipo !== 'campi' || contratto.posizione !== 0) return alimentata(c.file, c.pos, c.args, visti);
      campi = attributiDi(c.args);
    } else {
      const argomenti = argomentiDi(c.args);
      const a = argomenti[contratto.posizione];
      if (contratto.tipo === 'posizione') {
        if (a === undefined) return { ok: false, perche: `non passa il surplus (manca l'argomento ${contratto.posizione + 1})` };
        if (VALORE_VUOTO.test(a)) return { ok: false, perche: 'passa un surplus vuoto scritto a mano' };
        return alimentata(c.file, c.pos, a, visti);
      }
      if (a === undefined) return { ok: false, perche: `non passa il surplus (il campo ${nomeCampi()})` };
      let oggetto = a;
      if (/^[A-Za-z_$][\w$]*$/.test(a)) {
        const def = definizioneLocale(f, a, c.pos);
        if (def === null || !def.trim().startsWith('{')) return alimentata(c.file, c.pos, a, visti);
        oggetto = def.trim();
      }
      if (!oggetto.startsWith('{')) return alimentata(c.file, c.pos, a, visti);
      campi = campiDi(oggetto);
      // uno spread (...archivi) porta i campi della sua variabile
      for (const s of campi.filter(x => x.spread)) {
        const def = /^[A-Za-z_$][\w$]*$/.test(s.valore) ? definizioneLocale(f, s.valore, c.pos) : null;
        if (def && def.trim().startsWith('{')) campi.push(...campiDi(def.trim()));
      }
    }
    const giusto = campi.find(x => !x.spread && contratto.campi.includes(x.chiave));
    if (!giusto) {
      const spread = campi.find(x => x.spread);
      if (spread) return alimentata(c.file, c.pos, spread.valore, visti);
      const altro = campi.find(x => !x.spread && PARLA_DI_SURPLUS.test(x.chiave));
      return { ok: false, perche: altro ? `passa il surplus come ${altro.chiave}, ma la funzione lo legge da ${nomeCampi()}: si perde` : `non passa il surplus (il campo ${nomeCampi()})` };
    }
    if (VALORE_VUOTO.test(giusto.valore)) return { ok: false, perche: 'passa un surplus vuoto scritto a mano' };
    return alimentata(c.file, c.pos, giusto.valore, visti);
  };

  return { F, legge, chiamate, alimentata, contrattoDi, verificaChiamata };
}

/** I campi di primo livello di un oggetto scritto ({ a, b: x, ...c }): [{ chiave, valore, spread }]. */
function campiDi(oggetto) {
  const o = oggetto.trim();
  const ch = chiusura(o, 0);
  const dentro = o.slice(1, ch > 0 ? ch : o.length);
  return argomentiDi(dentro).map(seg => {
    if (seg.startsWith('...')) return { chiave: '', valore: seg.slice(3).trim(), spread: true };
    const m = seg.match(/^([A-Za-z_$][\w$]*)\s*(?::\s*([\s\S]*)|=\s*[\s\S]*)?$/);
    if (!m) return { chiave: '', valore: seg, spread: false };
    return { chiave: m[1], valore: (m[2] !== undefined ? m[2] : m[1]).trim(), spread: false };
  });
}

/** Gli attributi di un <Componente ... />: nome={valore} e {...spread}, come campi. */
function attributiDi(testo) {
  const out = [];
  for (let j = 0; j < testo.length; j++) {
    const m = testo.slice(j).match(/^([A-Za-z_$][\w$-]*)\s*=\s*([{'"`])/);
    if (m) {
      const ap = j + m[0].length - 1;
      if (m[2] === '{') {
        const ch = chiusura(testo, ap);
        out.push({ chiave: m[1], valore: testo.slice(ap + 1, ch > 0 ? ch : testo.length).trim(), spread: false });
        j = ch > 0 ? ch : testo.length;
      } else {
        out.push({ chiave: m[1], valore: "''", spread: false });
        j = testo.indexOf(m[2], ap + 1);
        if (j < 0) break;
      }
      continue;
    }
    if (testo[j] === '{') {
      const ch = chiusura(testo, j);
      const dentro = testo.slice(j + 1, ch > 0 ? ch : testo.length).trim();
      if (dentro.startsWith('...')) out.push({ chiave: '', valore: dentro.slice(3).trim(), spread: true });
      j = ch > 0 ? ch : testo.length;
      continue;
    }
    const nome = testo.slice(j).match(/^[A-Za-z_$][\w$-]*/);
    if (nome && (j === 0 || /\s/.test(testo[j - 1]))) { out.push({ chiave: nome[0], valore: 'true', spread: false }); j += nome[0].length - 1; }
  }
  return out;
}

/** Il controllo intero su un insieme di sorgenti: [{ voce, ok, dove, perche }]. */
function guardia(sorgenti, calcoli = CALCOLI, eccezioni = SENZA_SURPLUS) {
  const A = analizza(sorgenti);
  const esiti = [];
  const usate = new Set();
  for (const [nome, daFile] of Object.entries(calcoli)) {
    const def = A.F.get(daFile);
    const funz = def && def.funzioni.find(x => x.nome === nome && x.esportata);
    esiti.push({ voce: 'definizione', nome, ok: !!funz, dove: daFile, perche: funz ? 'c\'e\'' : `${nome} non e' piu' in ${daFile}: la guardia non saprebbe che cosa cercare` });
    if (!funz) continue;
    const contratto = A.contrattoDi(funz, def.struttura);
    esiti.push({ voce: 'accetta', nome, ok: !!contratto, dove: `${daFile}:${rigaDi(def.struttura, funz.inizio)}`, perche: `${nome} non riceve il surplus: ne' un parametro, ne' un campo dei dati che legge` });

    const tutte = A.chiamate(nome, daFile);
    const esaminate = new Set(tutte.filter(c => !c.jsx).map(c => `${c.file}:${c.posNome}`));
    esiti.push({ voce: 'vede', nome, ok: tutte.some(c => c.file !== daFile), dove: daFile, perche: `nessuna chiamata di ${nome} fuori da ${daFile}: la guardia non vede niente, o il calcolo non lo usa piu' nessuno` });
    for (const c of tutte) {
      const f = A.F.get(c.file);
      const riga = rigaDi(f.struttura, c.pos);
      const e = contratto ? A.verificaChiamata(c, contratto) : { ok: false, perche: `${nome} non riceve il surplus` };
      // L'eccezione copre solo una chiamata senza surplus: se il surplus ora
      // arriva, l'eccezione non serve piu' e lo si dice.
      const ecc = !e.ok && eccezioni.find(x => x.file === c.file && x.nome === nome && x.riga.test(testoRiga(f.testo, riga)));
      if (ecc) { usate.add(ecc); esiti.push({ voce: 'chiamata', nome, ok: true, dove: `${c.file}:${riga}`, perche: `${ecc.debito ? 'senza surplus, da portare' : 'senza surplus per natura'}: ${ecc.motivo}` }); continue; }
      esiti.push({ voce: 'chiamata', nome, ok: e.ok, dove: `${c.file}:${riga}`, perche: e.perche, testo: testoRiga(f.testo, riga) });
    }

    // Un riferimento che non e' ne' la definizione, ne' un'importazione, ne' una
    // chiamata: la funzione passa per una variabile e la guardia non la segue.
    for (const f of A.F.values()) {
      const s = f.struttura;
      const importi = [...f.codice.matchAll(/\bimport\b[^;]*?\bfrom\s*['"][^'"]+['"]|\bexport\s*\{[^}]*\}/g)].map(m => [m.index, m.index + m[0].length]);
      for (const m of s.matchAll(new RegExp(`(?<![\\w$])${nome}(?![\\w$])`, 'g'))) {
        if (importi.some(([a, b]) => m.index >= a && m.index < b)) continue;
        const dopo = s.slice(m.index + nome.length);
        const prima = s.slice(Math.max(0, m.index - 30), m.index);
        if (/\bfunction\s*\*?\s*$/.test(prima)) continue;
        if (/^\s*\(/.test(dopo)) {
          // Una chiamata che la guardia non ha esaminato: il calcolo arriva da
          // un'importazione che non e' quella del suo file (una riesportazione,
          // una copia), e il surplus li' non lo controlla nessuno.
          if (!esaminate.has(`${f.p}:${m.index}`)) {
            const riga = rigaDi(s, m.index);
            esiti.push({ voce: 'sconosciuta', nome, ok: false, dove: `${f.p}:${riga}`, perche: `una chiamata di ${nome} che non viene da ${daFile} (${testoRiga(f.testo, riga)}): la guardia non sa che cosa chiama` });
          }
          continue;
        }
        if (/\b(?:const|let|var)\s+$/.test(prima) && /^\s*=/.test(dopo)) continue;
        if (/^\s*:/.test(dopo) && /[{,]\s*$/.test(prima)) continue; // una chiave che si chiama cosi'
        const riga = rigaDi(s, m.index);
        esiti.push({ voce: 'indiretta', nome, ok: false, dove: `${f.p}:${riga}`, perche: `${nome} usato senza chiamarlo (${testoRiga(f.testo, riga)}): la guardia non vede dove arriva il surplus` });
      }
      // Una chiamata che nel codice c'e' e che la maschera ha coperto. Se sta in
      // un testo fra virgolette aperto e chiuso sulla stessa riga e' un testo (un
      // messaggio che la cita); altrimenti e' un punto che la guardia non sa
      // leggere - un apostrofo nel testo libero del JSX, per esempio - e una
      // chiamata vera li' passerebbe senza controllo.
      for (const m of f.codice.matchAll(new RegExp(`(?<![\\w$])${nome}\\s*\\(`, 'g'))) {
        if (s.slice(m.index, m.index + nome.length) === nome) continue;
        if (dentroUnTesto(f.codice, m.index)) continue;
        const riga = rigaDi(s, m.index);
        esiti.push({ voce: 'illeggibile', nome, ok: false, dove: `${f.p}:${riga}`, perche: `la guardia non sa leggere questo punto (${testoRiga(f.testo, riga)}): se e' un testo, scrivilo senza la parentesi` });
      }
    }
  }
  for (const e of eccezioni) {
    esiti.push({ voce: 'eccezione', nome: e.nome, ok: usate.has(e), dove: e.file, perche: `l'eccezione di ${e.file} per ${e.nome} non serve piu': va tolta da SENZA_SURPLUS` });
  }
  // SurplusTariffa si legge tutto: un filtro sullo stato perde i record con lo
  // stato vuoto, che valgono (la regola delle tariffe, AGENTS.md «Quando una
  // tariffa vale»), e il surplus sparisce senza dirlo.
  for (const f of A.F.values()) {
    const c = f.codice;
    for (const m of c.matchAll(/\bSurplusTariffa\s*(?:\.\s*(?:filter|list)\s*\(|,)\s*\{[^}]*\bstato\b/g)) {
      const riga = rigaDi(c, m.index);
      esiti.push({ voce: 'filtro', nome: 'SurplusTariffa', ok: false, dove: `${f.p}:${riga}`, perche: `legge SurplusTariffa con un filtro sullo stato (${testoRiga(f.testo, riga)}): si legge tutto, e il disattivato si toglie in memoria` });
    }
  }
  return esiti;
}

/** Vero se la posizione sta dentro un testo fra virgolette che si apre e si chiude sulla sua riga. */
function dentroUnTesto(codice, pos) {
  const inizio = codice.lastIndexOf('\n', pos - 1) + 1;
  const fine = codice.indexOf('\n', pos);
  const riga = codice.slice(inizio, fine < 0 ? codice.length : fine);
  const col = pos - inizio;
  let aperta = null;
  for (let i = 0; i < riga.length; i++) {
    const c = riga[i];
    if (aperta) {
      if (c === '\\') { i++; continue; }
      if (c === aperta) { if (i > col) return true; aperta = null; }
    } else if (i >= col) {
      return false;
    } else if (c === '"' || c === "'" || c === '`') {
      aperta = c;
    }
  }
  return false;
}

const falliti = (esiti) => esiti.filter(e => !e.ok);
const trova = (esiti, voce, dove) => esiti.find(e => e.voce === voce && e.dove.startsWith(dove));

// ---------------------------------------------------------------------------
console.log('1. LA GUARDIA SI PROVA DA SOLA, SU SORGENTI COSTRUITI');
{
  // Sui sorgenti costruiti vale solo l'eccezione del contesto vuoto: le altre
  // parlano di file veri, che qui non ci sono.
  const guardiaFinta = (s) => guardia(s, CALCOLI, SENZA_SURPLUS.filter(e => e.file === 'src/lib/extraRaccoltaCalc.js'));
  const passiva = 'export function calcolaPassivaMese({ primarieRete, tariffeAll, surplusAll = [] }, anno, m, mese, canale) { return { surplusAll }; }\n';
  const attiva = 'export function calcolaRigheAttiva({ reteAll, tariffe, anno, mese, surplus = null }) { return surplus; }\n';
  const margine = [
    'import { calcolaRigheAttiva } from "./attivaCalcolo.ts";',
    'import { calcolaPassivaMese } from "./passivaCalcolo.ts";',
    'export function calcolaMargineAnno(dati, anno, finoAlMese = 11) {',
    '  const surplusAll = dati.surplusAll || [];',
    '  const passiva = { primarieRete: dati.reteAll, tariffeAll: dati.tariffe, surplusAll };',
    '  for (let m = 0; m <= finoAlMese; m++) {',
    '    const a = calcolaRigheAttiva({ reteAll: dati.reteAll, tariffe: dati.tariffe, anno, mese: m, surplus: surplusAll });',
    '    const p = calcolaPassivaMese(passiva, anno, m, "x", "RETE");',
    '  }',
    '}',
  ].join('\n');
  const extra = 'export function contestoPrezzi(tariffeAttive = [], fornitori = [], surplus = []) { return { surplus }; }\nconst CONTESTO_VUOTO = contestoPrezzi();\n';
  const base = {
    'base44/shared/passivaCalcolo.ts': passiva,
    'base44/shared/attivaCalcolo.ts': attiva,
    'base44/shared/margine.ts': margine,
    'src/lib/extraRaccoltaCalc.js': extra,
    'base44/functions/calcolaMargine/entry.ts': [
      'import { calcolaMargineAnno } from "../../shared/margine.ts";',
      'Deno.serve(async (req) => {',
      '  const [reteAll, tariffe, surplusAll] = await Promise.all([fetchAll(svc.PrimariaRete), fetchAll(svc.Tariffa), fetchAll(svc.SurplusTariffa)]);',
      '  // calcolaPassivaMese(senza surplus) in un commento non e\' una chiamata',
      '  const msg = "calcolaRigheAttiva(x) citato in un testo";',
      '  return Response.json({ anno: 2026, ...calcolaMargineAnno({ reteAll, tariffe, surplusAll }, 2026, 11) });',
      '});',
    ].join('\n'),
    'base44/functions/calcolaPassiva/entry.ts': [
      'import { calcolaPassivaMese } from "../../shared/passivaCalcolo.ts";',
      'const [primarieRete, tariffeAll, surplusAll] = await Promise.all([fetchAll(svc.PrimariaRete), fetchAll(svc.Tariffa), fetchAll(svc.SurplusTariffa)]);',
      'const x = calcolaPassivaMese({ primarieRete, tariffeAll, surplusAll }, 2026, 9, "Ottobre", "RETE");',
    ].join('\n'),
    'base44/functions/fattura/entry.ts': [
      'import { calcolaRigheAttiva } from "../../shared/attivaCalcolo.ts";',
      'const [reteAll, tariffe, surplus] = await Promise.all([fetchAll(svc.PrimariaRete), fetchAll(svc.Tariffa), base44.asServiceRole.entities.SurplusTariffa.list()]);',
      'const r = calcolaRigheAttiva({ reteAll, tariffe, anno: 2026, mese: "Ottobre", surplus });',
    ].join('\n'),
    'src/pages/Extra.jsx': [
      "import { contestoPrezzi } from '@/lib/extraRaccoltaCalc';",
      'export default function Extra() {',
      "  const t = <p>L'intervento e' di Gatim / o di Emmesse</p>;",
      '  const [surplus, setSurplus] = useState([]);',
      '  useEffect(() => { fetchAllClient(base44.entities.SurplusTariffa).then(setSurplus); }, []);',
      '  const contesto = useMemo(() => contestoPrezzi(tariffe, fornitori, surplus), [tariffe, fornitori, surplus]);',
      '  return <Scheda contesto={contesto} />;',
      '}',
    ].join('\n'),
  };
  const sano = guardiaFinta(base);
  verifica('l\'albero costruito, giusto, e\' tutto verde', falliti(sano).length === 0, JSON.stringify(falliti(sano)));
  verifica('vede le chiamate dei quattro calcoli (2 + 2 + 1 + 2, l\'eccezione compresa)', sano.filter(e => e.voce === 'chiamata').length === 7, String(sano.filter(e => e.voce === 'chiamata').length));
  verifica('il margine lo riceve da chi chiama calcolaMargineAnno', /lo riceve da chi chiama calcolaMargineAnno/.test((trova(sano, 'chiamata', 'base44/shared/margine.ts:7') || {}).perche || ''), JSON.stringify(trova(sano, 'chiamata', 'base44/shared/margine.ts:7')));
  verifica('anche la passiva del margine, passata con una variabile costruita col surplus', (trova(sano, 'chiamata', 'base44/shared/margine.ts:8') || {}).ok === true, JSON.stringify(trova(sano, 'chiamata', 'base44/shared/margine.ts:8')));
  verifica('una chiamata in un commento o in un testo non conta', !sano.some(e => e.dove === 'base44/functions/calcolaMargine/entry.ts:4' || e.dove === 'base44/functions/calcolaMargine/entry.ts:5'));

  // Il lettore dimenticato: la chiamata senza surplus.
  const dimenticato = guardiaFinta({ ...base, 'base44/functions/calcolaPassiva/entry.ts': base['base44/functions/calcolaPassiva/entry.ts'].replace(', surplusAll }, 2026', ' }, 2026') });
  verifica('una chiamata senza il surplus fa fallire', (trova(dimenticato, 'chiamata', 'base44/functions/calcolaPassiva/entry.ts:3') || {}).ok === false && falliti(dimenticato).length === 1, JSON.stringify(falliti(dimenticato)));
  // Il surplus passato e mai letto.
  const maiLetto = guardiaFinta({ ...base, 'base44/functions/fattura/entry.ts': base['base44/functions/fattura/entry.ts'].replace('base44.asServiceRole.entities.SurplusTariffa.list()', 'Promise.resolve([])') });
  verifica('un surplus passato e mai letto fa fallire', (trova(maiLetto, 'chiamata', 'base44/functions/fattura/entry.ts:3') || {}).ok === false, JSON.stringify(falliti(maiLetto)));
  // Il surplus vuoto scritto a mano.
  const vuoto = guardiaFinta({ ...base, 'base44/functions/calcolaPassiva/entry.ts': base['base44/functions/calcolaPassiva/entry.ts'].replace(', surplusAll }, 2026', ', surplusAll: [] }, 2026') });
  verifica('surplusAll: [] non vale come passato', /vuoto/.test((trova(vuoto, 'chiamata', 'base44/functions/calcolaPassiva/entry.ts:3') || {}).perche || ''), JSON.stringify(falliti(vuoto)));
  // Il campo sbagliato: calcolaPassivaMese legge surplusAll, e { surplus } li' si perde.
  const campo = guardiaFinta({ ...base, 'base44/functions/calcolaPassiva/entry.ts': base['base44/functions/calcolaPassiva/entry.ts'].replace(', surplusAll }, 2026', ', surplus: surplusAll }, 2026') });
  verifica('il surplus passato col nome di un altro calcolo fa fallire', /si perde/.test((trova(campo, 'chiamata', 'base44/functions/calcolaPassiva/entry.ts:3') || {}).perche || ''), JSON.stringify(falliti(campo)));
  // Una pagina che lo tiene nel suo stato con un altro nome, e la trappola
  // della lettura vicina: le tariffe lette accanto al surplus non sono il surplus.
  const pagina = (corpo) => ({
    ...base,
    'src/pages/Extra.jsx': [
      "import { contestoPrezzi } from '@/lib/extraRaccoltaCalc';",
      'export default function Extra() {',
      '  const [tariffe, setTariffe] = useState([]);',
      '  const [maggiorazioni, setMaggiorazioni] = useState([]);',
      '  useEffect(() => {',
      '    fetchAllClient(base44.entities.SurplusTariffa).then(setMaggiorazioni); fetchAllClient(base44.entities.Tariffa, { direzione: "ATTIVA" }).then(setTariffe);',
      '  }, []);',
      corpo,
      '}',
    ].join('\n'),
  });
  const stato = guardiaFinta(pagina('  const contesto = useMemo(() => contestoPrezzi(tariffe, fornitori, maggiorazioni), [tariffe, maggiorazioni]);'));
  verifica('lo stato della pagina letto da SurplusTariffa si riconosce anche con un altro nome', (trova(stato, 'chiamata', 'src/pages/Extra.jsx:8') || {}).ok === true, JSON.stringify(trova(stato, 'chiamata', 'src/pages/Extra.jsx:8')));
  const trappola = guardiaFinta(pagina('  const contesto = useMemo(() => contestoPrezzi(tariffe, maggiorazioni), [tariffe, maggiorazioni]);'));
  verifica('il surplus nel posto sbagliato, o le tariffe lette accanto, non bastano', (trova(trappola, 'chiamata', 'src/pages/Extra.jsx:8') || {}).ok === false, JSON.stringify(trova(trappola, 'chiamata', 'src/pages/Extra.jsx:8')));
  const vuotoPos = guardiaFinta(pagina('  const contesto = contestoPrezzi(tariffe, fornitori, []);'));
  verifica('contestoPrezzi(t, f, []) non vale come passato', /vuoto/.test((trova(vuotoPos, 'chiamata', 'src/pages/Extra.jsx:8') || {}).perche || ''), JSON.stringify(trova(vuotoPos, 'chiamata', 'src/pages/Extra.jsx:8')));
  // La lettura in parallelo: conta la posizione.
  const parallela = (args) => guardiaFinta({
    ...base,
    'src/pages/Extra.jsx': [
      "import { contestoPrezzi } from '@/lib/extraRaccoltaCalc';",
      'export async function prepara() {',
      '  const [tariffe, fornitori, extra] = await Promise.all([fetchAllClient(base44.entities.Tariffa), fetchAllClient(base44.entities.Fornitore), fetchAllClient(base44.entities.SurplusTariffa)]);',
      `  return contestoPrezzi(${args});`,
      '}',
    ].join('\n'),
  });
  verifica('la lettura in parallelo si segue per posizione', (trova(parallela('tariffe, fornitori, extra'), 'chiamata', 'src/pages/Extra.jsx:4') || {}).ok === true);
  verifica('e una variabile della stessa lettura ma di un altro archivio non e\' il surplus', (trova(parallela('tariffe, fornitori, fornitori'), 'chiamata', 'src/pages/Extra.jsx:4') || {}).ok === false);
  // Un modulo condiviso coi tipi del .ts, che lo riceve e lo passa.
  const tipi = (chiamante) => guardiaFinta({
    ...base,
    'base44/shared/contoAnno.ts': 'import { calcolaRigheAttiva } from "./attivaCalcolo.ts";\nexport function contoAnno(dati: any, anno: number): number {\n  return calcolaRigheAttiva({ reteAll: dati.reteAll, tariffe: dati.tariffe, anno, mese: 0, surplus: dati.surplusAll });\n}\n',
    'base44/functions/conto/entry.ts': `import { contoAnno } from "../../shared/contoAnno.ts";\nconst surplusAll = await fetchAll(svc.SurplusTariffa);\nconst x = ${chiamante};\n`,
  });
  verifica('coi tipi del .ts, il surplus ricevuto da chi lo legge e\' verde', (trova(tipi('contoAnno({ reteAll, tariffe, surplusAll }, 2026)'), 'chiamata', 'base44/shared/contoAnno.ts:3') || {}).ok === true, JSON.stringify(trova(tipi('contoAnno({ reteAll, tariffe, surplusAll }, 2026)'), 'chiamata', 'base44/shared/contoAnno.ts:3')));
  verifica('e se il chiamante non glielo passa fallisce', (trova(tipi('contoAnno({ reteAll, tariffe }, 2026)'), 'chiamata', 'base44/shared/contoAnno.ts:3') || {}).ok === false);
  // Il file legge SurplusTariffa, ma la chiamata passa il parametro di una sua
  // funzione: conta chi chiama quella funzione, non la lettura del file.
  const parametro = (chiamante) => guardiaFinta({
    ...base,
    'base44/functions/conto/entry.ts': [
      'import { calcolaRigheAttiva } from "../../shared/attivaCalcolo.ts";',
      'const tutti = await fetchAll(svc.SurplusTariffa);',
      'function righeDelMese(mese, surplusDelMese) {',
      '  return calcolaRigheAttiva({ reteAll, tariffe, anno: 2026, mese, surplus: surplusDelMese });',
      '}',
      `const x = ${chiamante};`,
    ].join('\n'),
  });
  verifica('il parametro passato da chi ha letto e\' verde', (trova(parametro('righeDelMese("Ottobre", tutti)'), 'chiamata', 'base44/functions/conto/entry.ts:4') || {}).ok === true, JSON.stringify(trova(parametro('righeDelMese("Ottobre", tutti)'), 'chiamata', 'base44/functions/conto/entry.ts:4')));
  verifica('il parametro mai passato fallisce anche se il file legge SurplusTariffa', (trova(parametro('righeDelMese("Ottobre")'), 'chiamata', 'base44/functions/conto/entry.ts:4') || {}).ok === false, JSON.stringify(trova(parametro('righeDelMese("Ottobre")'), 'chiamata', 'base44/functions/conto/entry.ts:4')));
  verifica('e il contratto si legge anche coi tipi: il campo dev\'essere surplusAll', /si perde/.test((trova(tipi('contoAnno({ reteAll, tariffe, surplus: surplusAll }, 2026)'), 'chiamata', 'base44/shared/contoAnno.ts:3') || {}).perche || ''), JSON.stringify(trova(tipi('contoAnno({ reteAll, tariffe, surplus: surplusAll }, 2026)'), 'chiamata', 'base44/shared/contoAnno.ts:3')));
  // Uno dei chiamanti del margine se lo dimentica: la catena lo dice.
  const catena = guardiaFinta({ ...base, 'base44/functions/calcolaMargine/entry.ts': base['base44/functions/calcolaMargine/entry.ts'].replace('{ reteAll, tariffe, surplusAll }', '{ reteAll, tariffe }') });
  verifica('il margine senza chi gli passa il surplus fa fallire anche le due chiamate di dentro', ['base44/shared/margine.ts:7', 'base44/shared/margine.ts:8', 'base44/functions/calcolaMargine/entry.ts:6'].every(d => (trova(catena, 'chiamata', d) || {}).ok === false), JSON.stringify(falliti(catena)));
  // Un alias d'importazione si segue.
  const alias = guardiaFinta({ ...base, 'base44/functions/altro/entry.ts': 'import { calcolaPassivaMese as conto } from "../../shared/passivaCalcolo.ts";\nconst t = await fetchAll(svc.Tariffa);\nconst x = conto({ tariffeAll: t }, 2026, 9, "Ottobre", "RETE");\n' });
  verifica('una chiamata con un alias si vede e fallisce', (trova(alias, 'chiamata', 'base44/functions/altro/entry.ts:3') || {}).ok === false, JSON.stringify(falliti(alias)));
  // Anche con import * as.
  const ns = guardiaFinta({ ...base, 'base44/functions/altro/entry.ts': 'import * as P from "../../shared/passivaCalcolo.ts";\nconst x = P.calcolaPassivaMese({ tariffeAll: t }, 2026, 9, "Ottobre", "RETE");\n' });
  verifica('una chiamata con import * as si vede e fallisce', (trova(ns, 'chiamata', 'base44/functions/altro/entry.ts:2') || {}).ok === false, JSON.stringify(falliti(ns)));
  // Un riferimento senza chiamata.
  const indiretta = guardiaFinta({ ...base, 'base44/functions/altro/entry.ts': 'import { calcolaRigheAttiva } from "../../shared/attivaCalcolo.ts";\nconst f = calcolaRigheAttiva;\n' });
  verifica('un riferimento senza chiamata fa fallire', (trova(indiretta, 'indiretta', 'base44/functions/altro/entry.ts:2') || {}).ok === false, JSON.stringify(falliti(indiretta)));
  // Una chiamata che arriva da una riesportazione: la guardia non la segue, e lo dice.
  const riesportata = guardiaFinta({
    ...base,
    'base44/shared/calcoli.ts': 'export { calcolaPassivaMese } from "./passivaCalcolo.ts";\n',
    'base44/functions/altro/entry.ts': 'import { calcolaPassivaMese } from "../../shared/calcoli.ts";\nconst s = await fetchAll(svc.SurplusTariffa);\nconst x = calcolaPassivaMese({ tariffeAll: t, surplusAll: s }, 2026, 9, "Ottobre", "RETE");\n',
  });
  verifica('una chiamata importata da un altro modulo non passa senza controllo', (trova(riesportata, 'sconosciuta', 'base44/functions/altro/entry.ts:3') || {}).ok === false, JSON.stringify(falliti(riesportata)));
  // Il componente che riceve il surplus dalla pagina: <Scheda surplus={...} />.
  const componenti = {
    ...base,
    'src/pages/Extra.jsx': base['src/pages/Extra.jsx'].replace('<Scheda contesto={contesto} />', '<Scheda surplus={surplus} />'),
    'src/components/Scheda.jsx': "import { contestoPrezzi } from '@/lib/extraRaccoltaCalc';\nexport default function Scheda({ tariffe, surplus }) {\n  const c = contestoPrezzi(tariffe, [], surplus);\n  return null;\n}\n",
  };
  componenti['src/pages/Extra.jsx'] = "import Scheda from '@/components/Scheda';\n" + componenti['src/pages/Extra.jsx'];
  const g1 = guardiaFinta(componenti);
  verifica('un componente che riceve il surplus da una pagina che lo legge e\' verde', (trova(g1, 'chiamata', 'src/components/Scheda.jsx:3') || {}).ok === true, JSON.stringify(trova(g1, 'chiamata', 'src/components/Scheda.jsx:3')));
  const g2 = guardiaFinta({ ...componenti, 'src/pages/Extra.jsx': componenti['src/pages/Extra.jsx'].replace('<Scheda surplus={surplus} />', '<Scheda tariffe={tariffe} />') });
  verifica('lo stesso componente, se la pagina non gli passa il surplus, fallisce', (trova(g2, 'chiamata', 'src/components/Scheda.jsx:3') || {}).ok === false, JSON.stringify(trova(g2, 'chiamata', 'src/components/Scheda.jsx:3')));
  // Una chiamata che la maschera copre (l'apostrofo del testo libero del JSX)
  // non passa in silenzio.
  const coperta = guardiaFinta({
    ...base,
    'src/pages/Altra.jsx': [
      "import { contestoPrezzi } from '@/lib/extraRaccoltaCalc';",
      'export default function Altra() {',
      "  return <p>l'anno {contestoPrezzi(tariffe, fornitori).tariffe.length}</p>;",
      '}',
    ].join('\n'),
  });
  verifica('una chiamata che la guardia non sa leggere fa fallire', (trova(coperta, 'illeggibile', 'src/pages/Altra.jsx:3') || {}).ok === false, JSON.stringify(falliti(coperta)));
  // Il calcolo che non accetta il surplus.
  const nonAccetta = guardiaFinta({ ...base, 'src/lib/extraRaccoltaCalc.js': 'export function contestoPrezzi(tariffeAttive = [], fornitori = []) { return {}; }\nconst CONTESTO_VUOTO = contestoPrezzi();\n' });
  verifica('un calcolo che non riceve il surplus fa fallire', (trova(nonAccetta, 'accetta', 'src/lib/extraRaccoltaCalc.js') || {}).ok === false);
  // L'eccezione che non serve piu'.
  const senzaVuoto = guardiaFinta({ ...base, 'src/lib/extraRaccoltaCalc.js': extra.replace('const CONTESTO_VUOTO = contestoPrezzi();\n', '') });
  verifica('un\'eccezione che non serve piu\' fa fallire', (trova(senzaVuoto, 'eccezione', 'src/lib/extraRaccoltaCalc.js') || {}).ok === false);
  // Il filtro sullo stato.
  const filtro = guardiaFinta({ ...base, 'base44/functions/fattura/entry.ts': base['base44/functions/fattura/entry.ts'].replace('SurplusTariffa.list()', "SurplusTariffa.filter({ stato: 'attivo' })") });
  verifica('SurplusTariffa letto con { stato: \'attivo\' } fa fallire', (trova(filtro, 'filtro', 'base44/functions/fattura/entry.ts') || {}).ok === false, JSON.stringify(falliti(filtro)));
  const filtro2 = guardiaFinta({ ...base, 'base44/functions/calcolaPassiva/entry.ts': base['base44/functions/calcolaPassiva/entry.ts'].replace('fetchAll(svc.SurplusTariffa)', "fetchAll(svc.SurplusTariffa, { stato: 'attivo' })") });
  verifica('anche passato a chi legge con il filtro', (trova(filtro2, 'filtro', 'base44/functions/calcolaPassiva/entry.ts') || {}).ok === false, JSON.stringify(falliti(filtro2)));
  // La maschera: i testi del JSX con l'apostrofo e le espressioni regolari non
  // si portano via le righe dopo.
  const m = maschera("const a = /['\"]/g; const b = 'x // y'; // z\nconst c = `t ${f('q')} u`; <p>l'anno</p>\nconst d = calcolaPassivaMese(x);\n").struttura;
  verifica('la maschera tiene il codice e copre testi, commenti ed espressioni regolari', /const d = calcolaPassivaMese\(x\);/.test(m) && !/x \/\/ y/.test(m) && !/\/\/ z/.test(m) && /\$\{f\(' '\)\}/.test(m), JSON.stringify(m));
}

// ---------------------------------------------------------------------------
console.log('2. IL REPOSITORY: OGNI CALCOLO DEL SURPLUS RICEVE IL SURPLUS LETTO');
const sorgenti = {};
const visita = (d) => {
  const assoluta = join(radice, d);
  if (!existsSync(assoluta)) return;
  for (const n of readdirSync(assoluta)) {
    const p = `${d}/${n}`;
    if (statSync(join(radice, p)).isDirectory()) { if (n !== 'node_modules') visita(p); } else if (/\.(js|jsx|ts|tsx|mjs)$/.test(n)) sorgenti[p] = readFileSync(join(radice, p), 'utf8');
  }
};
visita('base44/functions'); visita('base44/shared'); visita('src');
verifica('i sorgenti ci sono', Object.keys(sorgenti).length > 100, `${Object.keys(sorgenti).length} file in ${radice}`);

const esiti = guardia(sorgenti);
for (const e of esiti.filter(x => x.voce === 'chiamata')) console.log(`  ${e.ok ? 'ok' : 'NO'}  ${e.dove}  ${e.nome}: ${e.perche}`);
for (const e of esiti) verifica(`${e.voce} ${e.nome} ${e.dove}`, e.ok, e.perche + (e.testo ? `\n      ${e.testo}` : ''));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
