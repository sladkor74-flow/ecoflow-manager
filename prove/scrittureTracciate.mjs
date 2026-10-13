// CHI SCRIVE UN NUMERO CHE FA I CONTI PASSA DALLO STORICO (11/10/2026).
//
// Lo storico delle modifiche (ModificaDato) serve solo se nessuno ci passa
// accanto: una pagina che scrive un target o un prezzo direttamente
// sull'archivio lascia di nuovo un cambio senza chi, quando e da quanto - il
// buco che c'era fino al 10/10/2026, quando una voce della passiva e' passata
// da 300 a 90 €/t senza lasciare traccia. Qui si cerca in tutto il sorgente
// (pagine, funzioni, moduli condivisi) ogni create, update, delete, bulkCreate
// o deleteMany sugli archivi tracciati (ENTITA_TRACCIATE di
// shared/campiTracciati.ts), anche quando l'archivio passa da una variabile
// (const archivio = () => base44.entities.X) o da entities[nome]. Ognuna deve
// stare nell'involucro (src/lib/scriviConTraccia.js, shared/traccia.ts e il
// motore in campiTracciati) o in un file dell'elenco qui sotto, col suo motivo.
//
// Due elenchi, e la differenza conta:
// - FUORI_PER_NATURA: i caricamenti dei file (il loro storico e' UploadLog), le
//   sistemazioni una tantum e i semi. La copia dell'anno nuovo di Target &
//   Status (copiaAnnoTarget) ci stava con un motivo falso («la conferma passa
//   dallo storico»: la conferma scrive solo la nota e non lascia righe); dalla
//   revisione delle migliorie dell'11/10/2026 passa dallo storico.
// - DA_PORTARE: scritture a mano che dovrebbero passare dallo storico e non
//   passano ancora, perche' stanno in file fuori dal giro dell'11/10/2026.
//   Sono un debito scritto: chi le porta sull'involucro le toglie da qui.
// Un file in un elenco che non scrive piu' gli archivi tracciati fa fallire la
// prova: un'eccezione che non serve piu' non deve restare a coprire la prossima.
//
// In piu': nessuno modifica o cancella una riga di ModificaDato (un registro che
// si corregge non e' un registro), le regole RLS dell'entita' lo dicono, e ogni
// pagina che scrive con l'involucro dice anche quando la traccia non riesce.
//
// node prove/scrittureTracciate.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENTITA_TRACCIATE } from '../base44/shared/campiTracciati.ts';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const INVOLUCRO = ['base44/shared/campiTracciati.ts', 'src/lib/campiTracciati.js', 'base44/shared/traccia.ts', 'src/lib/scriviConTraccia.js'];

const FUORI_PER_NATURA = {
  'base44/functions/importaBlocco/entry.ts': 'caricamento dei file del portale: lo storico e\' UploadLog',
  'base44/functions/importEcotyreFile/entry.ts': 'caricamento dei file del portale: lo storico e\' UploadLog',
  'base44/shared/agganciaDichiarazioni.ts': 'segna «caricata a portale» dal report delle dichiarazioni appena caricato: e\' il caricamento a dirlo',
  'base44/functions/portaTargetInTargetStatus/entry.ts': 'sistemazione una tantum del 27/09/2026 (target da Giacenze a Target & Status), con simulazione e conferma',
  'base44/functions/migraRegioni/entry.ts': 'sistemazione una tantum delle regioni',
  'base44/functions/migraTargetRaccoglitoriRegionali/entry.ts': 'sistemazione una tantum dei target regionali',
  'base44/functions/migraTariffePrestazione/entry.ts': 'sistemazione una tantum delle prestazioni delle tariffe',
  'base44/functions/migraTCycleImpianto/entry.ts': 'sistemazione una tantum di T-Cycle',
  'base44/functions/seedGiacenze2026/entry.ts': 'seme del 2026',
  'base44/functions/seedTargetMensile/entry.ts': 'seme del 2026',
  'base44/functions/seedTariffe2026/entry.ts': 'seme del 2026',
  'base44/functions/seedTariffeAttive2026/entry.ts': 'seme del 2026',
};

// chiusuraAnno, ripulisciDichiarazioni e PassivaModulo sono passati
// sull'involucro l'11/10/2026, subito dopo il giro dello storico.
const DA_PORTARE = {
  // Resta qui per scelta: una volta l'anno scrive centinaia di target uno per
  // uno, e con l'involucro ogni scrittura diventerebbe tre richieste (rilettura,
  // scrittura, registro) contro il limite al minuto di tutta l'app, senza
  // ritentativi. Ogni cella ha gia' il suo storico_json con chi, quando, da
  // quale file e il valore di prima. Da portare con una scrittura del registro
  // a blocchi.
  'src/components/target-status/ImportaReportGenerale.jsx': 'porta i target dei raccoglitori dal Report Generale (ha il suo storico_json, non lo storico delle modifiche)',
};

const SCRITTURE = '(?:create|update|delete|bulkCreate|bulkUpdate|bulkDelete|deleteMany|updateMany)';
const ENT = `(?:${ENTITA_TRACCIATE.join('|')})`;

const file = [];
const visita = (d) => {
  for (const n of readdirSync(join(radice, d))) {
    const p = `${d}/${n}`;
    if (statSync(join(radice, p)).isDirectory()) { if (n !== 'node_modules') visita(p); } else if (/\.(js|jsx|ts)$/.test(n)) file.push(p);
  }
};
visita('src'); visita('base44/functions'); visita('base44/shared');

// I file si leggono senza i ritorni a capo di Windows e senza le righe di
// commento: una scrittura citata in un commento non e' una scrittura.
const leggi = (p) => readFileSync(join(radice, p), 'utf8').replace(/\r/g, '');
const righeDi = (t) => t.split('\n').map((r, i) => ({ r, n: i + 1 })).filter(x => !/^\s*(\/\/|\*|\/\*)/.test(x.r));

/** Le scritture dirette sugli archivi tracciati in un sorgente: [{ riga, testo }]. */
function scrittureDirette(testo) {
  const trovate = [];
  const righe = righeDi(testo);
  const cerca = (re) => { for (const x of righe) if (re.test(x.r)) trovate.push({ riga: x.n, testo: x.r.trim().slice(0, 150) }); };
  cerca(new RegExp(`\\b${ENT}\\s*\\.\\s*${SCRITTURE}\\s*\\(`));
  cerca(new RegExp(`entities\\s*\\[[^\\]]+\\]\\s*\\.\\s*${SCRITTURE}\\s*\\(`));
  // L'archivio messo in una variabile: const archivio = () => base44.entities.X
  const alias = new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:\\(\\)\\s*=>\\s*)?[\\w.]*\\.${ENT}\\b\\s*;?\\s*$`, 'gm');
  let m;
  while ((m = alias.exec(testo))) cerca(new RegExp(`\\b${m[1]}\\s*(?:\\(\\))?\\s*\\.\\s*${SCRITTURE}\\s*\\(`));
  // L'archivio passato a una funzione che scrive: creaTutti(e.TargetMensile, ...).
  // Le letture (fetchAll e simili) vanno bene.
  const LETTURE = new Set(['fetchAll', 'fetchAllClient', 'leggiArchivio', 'leggiRegistro']);
  for (const x of righe) {
    const re = new RegExp(`(\\w+)\\s*\\(\\s*[\\w.]*\\.${ENT}\\b\\s*[,)]`, 'g');
    let y;
    while ((y = re.exec(x.r))) if (!LETTURE.has(y[1])) trovate.push({ riga: x.n, testo: x.r.trim().slice(0, 150) });
  }
  return trovate;
}

console.log('NESSUNO SCRIVE UN NUMERO CHE FA I CONTI FUORI DALLO STORICO');
const fuori = [];
const conScritture = new Set();
for (const p of file) {
  if (INVOLUCRO.includes(p)) continue;
  const s = scrittureDirette(leggi(p));
  if (!s.length) continue;
  conScritture.add(p);
  if (FUORI_PER_NATURA[p] || DA_PORTARE[p]) continue;
  for (const x of s) fuori.push(`${p}:${x.riga}: ${x.testo}`);
}
verifica('ogni scrittura degli archivi tracciati passa dall\'involucro o e\' in un elenco col suo motivo', fuori.length === 0, '\n    ' + fuori.join('\n    '));
for (const p of [...Object.keys(FUORI_PER_NATURA), ...Object.keys(DA_PORTARE)]) {
  verifica(`l'eccezione ${p} serve ancora (scrive un archivio tracciato)`, conScritture.has(p));
}
// SurplusTariffa dal 13/10/2026: il surplus sulle tariffe (il Fuel Surcharge)
// cambia attiva, passiva e margine come un prezzo, e chi lo scrive fuori
// dall'involucro deve far fallire questa prova come per le tariffe.
verifica('gli archivi tracciati sono quelli dei numeri che fanno i conti',
  ['ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile', 'GiacenzaSito', 'Tariffa', 'SurplusTariffa', 'CommessaEcotyre', 'DichiarazioneSito', 'ExtraRaccolta', 'VocePassivaAmministrazione'].every(e => ENTITA_TRACCIATE.includes(e)), ENTITA_TRACCIATE.join(','));

console.log('LE PAGINE E LE FUNZIONI CHE DOVEVANO PASSARE DALLO STORICO CI PASSANO');
const DEVONO = {
  'src/components/target-status/ConfigurazioneImpianti.jsx': ['scriviConTraccia(', 'eliminaConTraccia(', '<StoricoModifiche'],
  'src/components/target-status/TargetRaccoglitoriGrid.jsx': ['scriviConTraccia(', '<StoricoModifiche'],
  'src/components/target-status/CommessaEcotyreForm.jsx': ['scriviConTraccia(', '<StoricoModifiche'],
  'src/components/giacenze/TargetManager.jsx': ['scriviConTraccia(', 'eliminaConTraccia(', '<StoricoModifiche'],
  'src/components/dichiarazioni/DialogoMese.jsx': ['scriviConTraccia(', '<StoricoModifiche'],
  'src/components/dichiarazioni/PraticaIrigom.jsx': ['scriviConTraccia('],
  'src/pages/ExtraRaccolta.jsx': ['scriviConTraccia(', 'eliminaConTraccia('],
  'src/components/fatturazione/ExtraRaccoltaForm.jsx': ['<StoricoModifiche'],
  'src/components/fatturazione/VociPassivaDialog.jsx': ['scriviConTraccia(', 'eliminaConTraccia(', 'creaMoltiConTraccia(', 'eliminaMoltiConTraccia(', '<StoricoModifiche'],
  'src/components/fatturazione/TariffeForm.jsx': ['notaTraccia(', '<StoricoModifiche', 'motivo: motivo.trim()'],
  'base44/functions/gestisciAnagrafiche/entry.ts': ['traccia(svc,', 'eliminaConTraccia(svc,', 'traccia: unisciTracce(tracce)'],
  'base44/functions/preparaAnno/entry.ts': ["traccia(svc, 'Tariffa', null, x.copia,", 'traccia: unisciTracce(tracce)'],
  'base44/functions/copiaAnnoTarget/entry.ts': ["creaConTraccia(e, 'ImpiantoTargetSecondaria', piano.impianti,", "creaConTraccia(e, 'TargetRaccoglitore',", "creaConTraccia(e, 'TargetMensile',",
    "traccia(e, 'CommessaEcotyre', null, piano.commessa,", "creaConTraccia(e, 'GiacenzaSito',", 'risposta.traccia = unisciTracce(tracce)'],
};
for (const [p, attesi] of Object.entries(DEVONO)) {
  const t = leggi(p);
  for (const a of attesi) verifica(`${p} usa ${a}`, t.includes(a));
}
// Chi scrive con l'involucro dice anche quando la traccia non riesce: il dato
// salvato senza storico non deve passare in silenzio.
for (const p of file.filter(f => f.startsWith('src/') && !INVOLUCRO.includes(f))) {
  const t = leggi(p);
  if (!/from '@\/lib\/scriviConTraccia'/.test(t) || !/(scriviConTraccia|eliminaConTraccia|creaMoltiConTraccia|eliminaMoltiConTraccia)\(/.test(t)) continue;
  verifica(`${p} dice quando la traccia non riesce (avvisoTraccia o notaTraccia)`, /avvisoTraccia\(|notaTraccia\(/.test(t));
}

console.log('IL REGISTRO SI AGGIUNGE E NON SI TOCCA');
const toccano = [];
for (const p of file) {
  for (const x of righeDi(leggi(p))) if (/\bModificaDato\s*\.\s*(update|delete|deleteMany|bulkUpdate|updateMany|bulkDelete)\s*\(/.test(x.r)) toccano.push(`${p}:${x.n}`);
}
verifica('nessuno modifica o cancella una riga dello storico', toccano.length === 0, toccano.join(', '));
const entita = JSON.parse(leggi('base44/entities/ModificaDato.jsonc').split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n'));
const rls = entita.rls || {};
verifica('crearla e\' dell\'amministratore', rls.create && rls.create.user_condition && rls.create.user_condition.role === 'admin', JSON.stringify(rls.create));
verifica('modificarla e cancellarla non e\' di nessuno', ['update', 'delete'].every(k => rls[k] && rls[k].user_condition && !['admin', 'user'].includes(rls[k].user_condition.role)), JSON.stringify(rls));
verifica('si legge come gli archivi che racconta', rls.read === true);
const campi = Object.keys(entita.properties || {});
verifica('ha i campi dello storico', ['entita', 'record_id', 'etichetta', 'campo', 'prima', 'dopo', 'utente', 'il', 'origine', 'motivo', 'operazione', 'riservato'].every(c => campi.includes(c)), campi.join(','));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
