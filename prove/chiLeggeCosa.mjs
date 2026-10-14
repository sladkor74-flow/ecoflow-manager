// CHI LEGGE COSA: CONTRATTI, MODELLI E SURPLUS (decisioni del 13/10/2026).
//
// L'utente il 13/10/2026 sera ha lasciato le decisioni del gruppo B «alla tua
// professionalita'». Fra queste:
// - ContrattoFornitore e ModelloContratto si leggono solo dall'amministratore,
//   come si scrivono: un contratto porta i prezzi dei fornitori (valori_json,
//   importi_json) e tutti e due portano dei file_uri, che sono la chiave del
//   documento per chiunque sia collegato;
// - SurplusTariffa si legge solo dall'amministratore: euro_t_passiva e' un
//   costo, e un accordo pagato solo da SMOCO e' tutto un costo. A chi non e'
//   amministratore la parte attiva (quanto SMOCO fattura in piu' a Ecotyre)
//   arriva dalla funzione di sola lettura leggiSurplus
//   (base44/shared/surplusVisibile.ts, src/lib/leggiSurplus.js).
//
// Chiudere la lettura di un archivio ha un rischio che non si vede: una pagina
// che lo legge ancora dal browser, aperta da chi non e' amministratore, riceve un
// elenco vuoto e dice «nessun surplus» senza un errore. Per questo la prova
// guarda anche chi legge: nessuna pagina li legge direttamente, se non quelle
// del solo amministratore, e nessuna funzione li legge coi permessi di chi
// chiede. E monta la pagina Extra Raccolta di chi non e' amministratore con
// l'archivio chiuso.
//
// Sezioni:
// 1. le regole dei tre archivi;
// 2. nessuna pagina legge contratti e modelli dal browser;
// 3. SurplusTariffa lo leggono dal browser solo le pagine dell'amministratore;
//    l'Extra Raccolta, che serve a tutti, passa da leggiSurplus;
// 4. nessuna funzione li legge coi permessi di chi chiede;
// 5. la parte attiva: che cosa arriva a chi non e' amministratore;
// 6. la funzione leggiSurplus sul banco;
// 7. la libreria delle pagine;
// 8. la pagina Extra Raccolta con l'archivio chiuso, amministratore o no;
// 9. sui dati veri (copia in ../dati-veri, se c'e'): con la sola parte attiva
//    la fattura a Ecotyre e la pagina dicono gli stessi numeri, ogni mese del
//    2026, su tutti e tre i canali;
// 10. lo storico delle modifiche (ModificaDato), che di ogni surplus tiene una
//    copia campo per campo: a chi non e' amministratore le sole righe che non
//    sono costi (revisione del 14/10/2026).
//
// node prove/chiLeggeCosa.mjs
import { existsSync, readdirSync, readFileSync, statSync, mkdtempSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const radice = qui('../');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
// Una sezione che si ferma con un errore (il codice di prima non ha la funzione o
// il modulo) conta come fallita e si va avanti con la prossima.
const sezione = async (titolo, corpo) => {
  console.log(titolo);
  try { await corpo(); } catch (e) { ko++; console.log(`  FALLITA: ${titolo}: si ferma con un errore (${e && e.message})`); }
};
// I fine-riga si normalizzano: su Windows il checkout scrive CRLF.
const sorgente = (p) => readFileSync(join(radice, p), 'utf8').replace(/\r/g, '');
const ENTITA = (nome) => JSON.parse(sorgente(`base44/entities/${nome}.jsonc`).split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n'));
// Il codice senza le righe di commento: una lettura citata in un commento non e' una lettura.
const codice = (t) => t.split('\n').map(r => (/^\s*(\/\/|\*|\/\*)/.test(r) ? '' : r)).join('\n');
const fileSotto = (d, re = /\.(js|jsx|ts)$/) => {
  const out = [];
  const visita = (x) => {
    for (const n of readdirSync(join(radice, x))) {
      const p = `${x}/${n}`;
      if (statSync(join(radice, p)).isDirectory()) { if (n !== 'node_modules') visita(p); } else if (re.test(n)) out.push(p);
    }
  };
  visita(d);
  return out;
};
const soloAdmin = (regola) => !!regola && typeof regola === 'object' && !!regola.user_condition && regola.user_condition.role === 'admin' && Object.keys(regola).length === 1;

const ARCHIVI = ['ContrattoFornitore', 'ModelloContratto', 'SurplusTariffa'];

await sezione('1. I TRE ARCHIVI LI LEGGE SOLO L\'AMMINISTRATORE, COME LI SCRIVE', async () => {
  for (const nome of ARCHIVI) {
    const rls = ENTITA(nome).rls || {};
    verifica(`${nome}: la lettura e' dell'amministratore`, soloAdmin(rls.read), J(rls.read));
    verifica(`${nome}: e la scrittura resta sua`, ['create', 'update', 'delete'].every(k => soloAdmin(rls[k])), J(rls));
  }
  // Il perche' sta scritto accanto alla regola: una lettura chiusa senza motivo
  // la riapre il primo che non trova un dato.
  for (const nome of ARCHIVI) {
    verifica(`${nome}: il file dice perche' e da dove legge chi non e' amministratore`, /13\/10\/2026/.test(sorgente(`base44/entities/${nome}.jsonc`)) && /prove\/chiLeggeCosa\.mjs/.test(sorgente(`base44/entities/${nome}.jsonc`)));
  }
});

// Le letture dirette di un archivio in un sorgente: .X.list/filter/get/subscribe(,
// fetchAllClient(qualcosa.X, e entities['X'].
const lettureDirette = (t, nome) => {
  const c = codice(t);
  const trovate = [];
  const righe = c.split('\n');
  const re = [
    new RegExp(`\\.\\s*${nome}\\s*\\.\\s*(?:list|filter|get|subscribe)\\s*\\(`),
    new RegExp(`\\b(?:fetchAllClient|fetchAll|leggiArchivio)\\s*\\(\\s*[\\w.]*\\.${nome}\\b`),
    new RegExp(`entities\\s*\\[\\s*['"\`]${nome}['"\`]\\s*\\]`),
  ];
  righe.forEach((r, i) => { if (re.some(x => x.test(r))) trovate.push(`${i + 1}: ${r.trim().slice(0, 140)}`); });
  return trovate;
};

const SRC = fileSotto('src');

await sezione('2. NESSUNA PAGINA LEGGE CONTRATTI E MODELLI DAL BROWSER', async () => {
  for (const nome of ['ContrattoFornitore', 'ModelloContratto']) {
    const lettori = SRC.flatMap(p => lettureDirette(sorgente(p), nome).map(x => `${p}:${x}`));
    verifica(`${nome}: nessuna lettura dal browser`, lettori.length === 0, '\n    ' + lettori.join('\n    '));
    // Il nome fra virgolette serve solo ad aprire il file (apriFile): un nome
    // passato a un lettore generico (entities[nome]) sarebbe una lettura che le
    // regole qui sopra non vedono.
    const citati = SRC.flatMap(p => codice(sorgente(p)).split('\n').map((r, i) => ({ p, i, r })))
      .filter(x => new RegExp(`['"\`]${nome}['"\`]`).test(x.r) && !new RegExp(`linkFile\\(\\s*'${nome}'`).test(x.r));
    verifica(`${nome}: il nome fra virgolette solo per aprire il file`, citati.length === 0, '\n    ' + citati.map(x => `${x.p}:${x.i + 1}: ${x.r.trim().slice(0, 140)}`).join('\n    '));
  }
  // La scheda Contratti legge dalla funzione, che manda i valori e i prezzi al
  // solo amministratore.
  const anno = sorgente('src/components/qualifica/ContrattiAnno.jsx');
  verifica('la scheda Contratti legge dalla funzione contrattiAnno', /functions\.invoke\('contrattiAnno'/.test(anno));
  const situazione = sorgente('base44/shared/contrattiDellAnno.ts');
  verifica('e la funzione manda i valori dei contratti al solo amministratore', /\.\.\.\(admin \? \{ valori: oggettoDa\(contratto\.valori_json\) \} : \{\}\)/.test(situazione));
});

await sezione('3. SurplusTariffa DAL BROWSER: SOLO LE PAGINE DELL\'AMMINISTRATORE', async () => {
  // Le pagine che lo leggono direttamente, col perche' possono: sono schede che
  // la Fatturazione disegna solo all'amministratore.
  const AMMESSI = {
    'src/components/fatturazione/TariffeUnificate.jsx': 'la scheda Tariffe & Anagrafiche',
    'src/components/fatturazione/PassivaModulo.jsx': 'la scheda Passiva',
  };
  const lettori = SRC.filter(p => lettureDirette(sorgente(p), 'SurplusTariffa').length > 0);
  const fuori = lettori.filter(p => !AMMESSI[p]);
  verifica('le pagine che leggono SurplusTariffa dal browser sono solo quelle dell\'amministratore', fuori.length === 0,
    '\n    ' + fuori.map(p => `${p}: ${lettureDirette(sorgente(p), 'SurplusTariffa').join(' | ')}`).join('\n    '));
  for (const p of Object.keys(AMMESSI)) verifica(`l'eccezione ${p} serve ancora`, lettori.includes(p));
  const fatt = sorgente('src/pages/Fatturazione.jsx');
  verifica('Tariffe & Anagrafiche si disegna solo all\'amministratore', /\{isAdmin && <TabsContent value="tariffe"[^\n]*<TariffeUnificate/.test(fatt));
  const passiva = fatt.indexOf('{isAdmin && <TabsContent value="passiva"');
  const fine = passiva >= 0 ? fatt.indexOf('</TabsContent>}', passiva) : -1;
  const blocco = passiva >= 0 && fine > passiva ? fatt.slice(passiva, fine) : '';
  verifica('la Passiva (PassivaModulo) si disegna solo all\'amministratore', (fatt.match(/<PassivaModulo\b/g) || []).length === (blocco.match(/<PassivaModulo\b/g) || []).length && /<PassivaModulo\b/.test(blocco));
  for (const p of Object.keys(AMMESSI)) {
    const nome = p.split('/').pop().replace('.jsx', '');
    const chi = SRC.filter(x => x !== p && new RegExp(`import\\s+${nome}\\s+from`).test(sorgente(x)));
    verifica(`${nome} lo usa solo la Fatturazione`, J(chi) === J(['src/pages/Fatturazione.jsx']), J(chi));
  }
  // L'Extra Raccolta la apre anche chi non e' amministratore: chiede alla funzione.
  const extra = sorgente('src/pages/ExtraRaccolta.jsx');
  verifica('l\'Extra Raccolta legge i surplus da leggiSurplus (src/lib/leggiSurplus.js)',
    /import \{ leggiSurplus \} from '@\/lib\/leggiSurplus';/.test(extra) && /await leggiSurplus\(\)/.test(codice(extra)));
  const lib = sorgente('src/lib/leggiSurplus.js');
  verifica('la libreria chiede alla funzione e non legge l\'archivio', /functions\.invoke\('leggiSurplus'/.test(lib) && lettureDirette(lib, 'SurplusTariffa').length === 0);
});

await sezione('4. NESSUNA FUNZIONE LI LEGGE COI PERMESSI DI CHI CHIEDE', async () => {
  // Una funzione che li leggesse con base44.entities, chiesta da chi non e'
  // amministratore, riceverebbe un elenco vuoto: un contratto «mancante», un
  // surplus che non c'e'. Ogni file delle funzioni che li nomina deve leggere
  // gli archivi solo con asServiceRole (svc = base44.asServiceRole.entities).
  const FILE = [...fileSotto('base44/functions'), ...fileSotto('base44/shared')];
  const lettori = FILE.filter(p => ARCHIVI.some(n => new RegExp(`\\.${n}\\b`).test(codice(sorgente(p)))));
  verifica('li leggono le funzioni di sempre, e leggiSurplus', lettori.includes('base44/functions/contrattiAnno/entry.ts')
    && lettori.includes('base44/functions/salvaContrattoFornitore/entry.ts') && lettori.includes('base44/functions/leggiSurplus/entry.ts')
    && lettori.includes('base44/shared/strumentiAssistente.ts'), J(lettori));
  const conUtente = lettori.filter(p => /(?<!asServiceRole)\.entities\b/.test(codice(sorgente(p))));
  verifica('nessuno legge un archivio coi permessi di chi chiede', conUtente.length === 0, J(conUtente));
  const svcStrani = lettori.flatMap(p => [...codice(sorgente(p)).matchAll(/\b(?:const|let|var)\s+svc\s*=\s*([^;\n]+)/g)]
    .filter(m => !/asServiceRole\.entities\s*$/.test(m[1].trim())).map(m => `${p}: ${m[0]}`));
  verifica('e ogni svc e\' l\'archivio con asServiceRole', svcStrani.length === 0, J(svcStrani));
});

// ─── I surplus della prova ───
const surplus = (id, tipologia, altro = {}) => ({
  id, gruppo: 'g-fs', nome: 'Fuel Surcharge', origine: 'CONSORZIO', riferimento: 'comunicazione Ecotyre', tipologia, prestazione: 'RACCOLTA',
  a_chi: 'tutti', fornitori_json: '', euro_t_passiva: 5, euro_t_attiva: 5,
  data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo',
  note: 'nota della comunicazione', created_by: 'amministratore@smoco', created_date: '2026-10-13T20:00:00.000Z', ...altro,
});
const FS = [surplus('fs-rete', 'RETE'), surplus('fs-aci', 'ACI'), surplus('fs-extra', 'EXTRA_RACCOLTA')];
// Un accordo pagato solo da SMOCO a Gatim: tutto un costo, nome e fornitore compresi.
const ACCORDO = surplus('acc', 'EXTRA_RACCOLTA', { gruppo: 'g-acc', nome: 'Accordo riservato Gatim', origine: 'ACCORDO_COMMERCIALE', riferimento: 'lettera riservata',
  prestazione: 'TRATTAMENTO', a_chi: 'elenco', fornitori_json: J([{ id: 'F-GAT', nome: 'GATIM S.R.L.' }]), euro_t_passiva: 3, euro_t_attiva: null, note: 'sconto concordato' });
// Un surplus «solo questi» che Ecotyre paga: l'elenco serve all'attiva.
const ELENCO = surplus('el', 'EXTRA_RACCOLTA', { gruppo: 'g-el', nome: 'Surplus Gatim', origine: 'ACCORDO_COMMERCIALE', prestazione: 'TRATTAMENTO',
  a_chi: 'elenco', fornitori_json: J([{ id: 'F-GAT', nome: 'GATIM S.R.L.' }]), euro_t_passiva: 2, euro_t_attiva: 2.5 });
// Uno disattivato: arriva a tutti, e il calcolo lo toglie.
const SPENTO = surplus('spento', 'EXTRA_RACCOLTA', { nome: 'Vecchio surplus', stato: 'non_attivo', euro_t_passiva: 9, euro_t_attiva: 9 });
// Uno sul trasporto delle secondarie con un importo attivo scritto per sbaglio:
// a Ecotyre le secondarie non si fatturano.
const SECONDARIE = surplus('sec', 'RETE', { nome: 'Trasporto secondarie', prestazione: 'TRASPORTO_SECONDARIA', euro_t_passiva: 4, euro_t_attiva: 4 });
// «tutti» con un elenco rimasto scritto da prima.
const TUTTI_CON_ELENCO = surplus('te', 'ACI', { fornitori_json: J([{ id: 'F-X', nome: 'FORNITORE DI PRIMA' }]) });
const ARCHIVIO = [...FS, ACCORDO, ELENCO, SPENTO, SECONDARIE, TUTTI_CON_ELENCO];

await sezione('5. LA PARTE ATTIVA: CHE COSA ARRIVA A CHI NON E\' AMMINISTRATORE', async () => {
  const V = await import('../base44/shared/surplusVisibile.ts');
  const admin = V.surplusPerChiLegge(ARCHIVIO, true);
  verifica('all\'amministratore tutto l\'archivio, com\'e\' scritto', J(admin) === J(ARCHIVIO));
  const altri = V.surplusPerChiLegge(ARCHIVIO, false);
  const testo = J(altri);
  verifica('agli altri i soli surplus che Ecotyre paga', J(altri.map(s => s.id)) === J(['fs-rete', 'fs-aci', 'fs-extra', 'el', 'spento', 'te']), J(altri.map(s => s.id)));
  verifica('nessun importo ai fornitori, da nessuna parte', !testo.includes('euro_t_passiva') && altri.every(s => !('euro_t_passiva' in s)));
  verifica('l\'accordo solo passivo non si nomina nemmeno: ne\' nome, ne\' riferimento, ne\' note', !testo.includes('Accordo riservato') && !testo.includes('lettera riservata') && !testo.includes('sconto concordato'));
  verifica('niente riferimento, note, gruppo e campi della piattaforma (created_by e\' un indirizzo)', altri.every(s => Object.keys(s).every(k => [...V.CAMPI_PARTE_ATTIVA, 'fornitori_json'].includes(k))) && !testo.includes('amministratore@smoco') && !testo.includes('comunicazione Ecotyre'), testo.slice(0, 300));
  const el = altri.find(s => s.id === 'el');
  verifica('un surplus «solo questi» che Ecotyre paga porta il suo elenco: senza, la pagina non saprebbe su quali tonnellate', !!el && el.fornitori_json === ELENCO.fornitori_json && el.euro_t_attiva === 2.5);
  const te = altri.find(s => s.id === 'te');
  verifica('con «tutti» un elenco rimasto scritto non si manda', !!te && !('fornitori_json' in te));
  verifica('il trasporto delle secondarie non ha una parte attiva', !altri.some(s => s.id === 'sec'));
  verifica('il disattivato arriva, con lo stato: lo toglie il calcolo, per tutti', altri.some(s => s.id === 'spento' && s.stato === 'non_attivo'));
  const fs = altri.find(s => s.id === 'fs-extra');
  verifica('il Fuel Surcharge: nome, origine, canale, prestazione, a chi, +5 da Ecotyre, date e stato',
    J(fs) === J({ id: 'fs-extra', nome: 'Fuel Surcharge', origine: 'CONSORZIO', tipologia: 'EXTRA_RACCOLTA', prestazione: 'RACCOLTA', a_chi: 'tutti', euro_t_attiva: 5, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo' }), J(fs));
  // Un importo che non e' un surplus (zero, negativo, vuoto, testo) non fa una parte attiva.
  const strani = [0, -5, '', null, undefined, 'cinque'].map((v, i) => surplus('x' + i, 'RETE', { euro_t_attiva: v }));
  verifica('zero, negativo, vuoto o testo: niente parte attiva', V.surplusPerChiLegge(strani, false).length === 0);
  verifica('un importo scritto come testo si manda come numero', V.surplusPerChiLegge([surplus('t', 'RETE', { euro_t_attiva: '5' })], false)[0]?.euro_t_attiva === 5);
  verifica('senza dire chi chiede si nega: la sola parte attiva', J(V.surplusPerChiLegge(ARCHIVIO)) === J(altri) && J(V.surplusPerChiLegge(ARCHIVIO, 'true')) === J(altri) && J(V.surplusPerChiLegge(ARCHIVIO, 1)) === J(altri));
  verifica('un archivio vuoto o mancante e\' un elenco vuoto', J(V.surplusPerChiLegge(null, false)) === '[]' && J(V.surplusPerChiLegge([null], true)) === '[]');
});

await sezione('6. LA FUNZIONE leggiSurplus SUL BANCO', async () => {
  const { caricaFunzione, chiama } = await import('./dati/bancoFunzioni.mjs');
  const modulo = await caricaFunzione('leggiSurplus');
  const admin = await chiama(modulo, { db: { SurplusTariffa: ARCHIVIO }, ruolo: 'admin' });
  verifica('all\'amministratore: 200, tutto l\'archivio', admin.stato === 200 && admin.j.ok === true && admin.j.parte === 'tutto' && admin.j.surplus.length === ARCHIVIO.length
    && admin.j.surplus.some(s => s.id === 'acc' && s.euro_t_passiva === 3), J([admin.stato, admin.j.parte, admin.j.surplus && admin.j.surplus.length]));
  const user = await chiama(modulo, { db: { SurplusTariffa: ARCHIVIO }, ruolo: 'user' });
  const V = await import('../base44/shared/surplusVisibile.ts');
  verifica('agli altri: 200, la sola parte attiva', user.stato === 200 && user.j.parte === 'attiva'
    && J([...user.j.surplus].sort((a, b) => a.id.localeCompare(b.id))) === J(V.surplusPerChiLegge(ARCHIVIO, false).sort((a, b) => a.id.localeCompare(b.id))), J(user.j));
  verifica('e nella risposta niente costi e niente accordo', !J(user.j).includes('euro_t_passiva') && !J(user.j).includes('Accordo riservato'));
  verifica('non scrive niente', admin.scritte.length === 0 && user.scritte.length === 0, J([admin.scritte, user.scritte]));
  const vuoto = await chiama(modulo, { db: {}, ruolo: 'user' });
  verifica('senza surplus: 200 e un elenco vuoto, non un errore', vuoto.stato === 200 && J(vuoto.j.surplus) === '[]', J(vuoto.j));
  const f = codice(sorgente('base44/functions/leggiSurplus/entry.ts'));
  verifica('chi non e\' collegato: 401', /if \(!user\) return Response\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);/.test(f));
  verifica('legge tutto l\'archivio con asServiceRole, una volta, senza filtro sullo stato', (f.match(/SurplusTariffa/g) || []).length === 1
    && /fetchAll\(base44\.asServiceRole\.entities\.SurplusTariffa, null, '-created_date'\)/.test(f) && !/stato:/.test(f));
  verifica('chi e\' amministratore lo dice il server (user.role), non la richiesta', /const amministratore = user\.role === 'admin';/.test(f) && !/req\.json/.test(f));
  verifica('non scrive: nessuna create, update o delete', !/\.(create|update|delete|bulkCreate|bulkUpdate)\s*\(/.test(f));
});

const { caricaPagina, clienteFinto, aspetta, trova, testo } = await import('./dati/paginaFinta.mjs');

await sezione('7. LA LIBRERIA DELLE PAGINE: src/lib/leggiSurplus.js', async () => {
  const { modulo } = await caricaPagina('lib/leggiSurplus');
  const V = await import('../base44/shared/surplusVisibile.ts');
  const c = clienteFinto({ funzioni: { leggiSurplus: async () => ({ ok: true, parte: 'attiva', surplus: V.surplusPerChiLegge(ARCHIVIO, false) }) } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const s = await modulo.leggiSurplus();
  verifica('restituisce l\'elenco della funzione', Array.isArray(s) && s.length === 6, J(s));
  verifica('con una chiamata sola alla funzione, e nessuna lettura dell\'archivio', c.funzioniChiamate('leggiSurplus').length === 1 && c.letture('SurplusTariffa').length === 0);
  const muta = clienteFinto({});
  globalThis.__CLIENTE_FINTO = muta.cliente;
  let errore = null;
  try { await modulo.leggiSurplus(); } catch (e) { errore = e; }
  verifica('una risposta senza elenco e\' un errore, non «nessun surplus»', !!errore && /non si sono potuti leggere/.test(errore.message), String(errore && errore.message));
  const rotta = clienteFinto({ funzioni: { leggiSurplus: async () => { throw new Error('limite di richieste'); } } });
  globalThis.__CLIENTE_FINTO = rotta.cliente;
  errore = null;
  try { await modulo.leggiSurplus(); } catch (e) { errore = e; }
  verifica('e una funzione che non risponde arriva alla pagina come errore', !!errore);
});

// ─── La pagina Extra Raccolta, montata senza browser (prove/dati/paginaFinta.mjs) ───
const FORNITORI = [
  { id: 'F-EMM', ragione_sociale: 'EMMESSE SRLS', stato: 'attivo', ruolo_raccolta: true },
  { id: 'F-SMO', ragione_sociale: 'SMOCO S.R.L.', stato: 'attivo', interno: true, ruolo_raccolta: true },
  { id: 'F-GAT', ragione_sociale: 'GATIM S.R.L.', stato: 'attivo', ruolo_trattamento: true },
];
const iv = (id, altro = {}) => ({
  id, stato: 'terminato', tipo_movimento: 'primaria', id_ordine: 'ER-' + id, numero_fir: 'FIR ' + id,
  produttore: 'COMUNE DI PROVA', trasportatore: 'EMMESSE SRLS', destinazione: 'GATIM S.R.L.', tipo_destinazione: 'imp',
  provincia: 'NA', classe: 'P', cer: '160103',
  ordine_immesso_il: '2026-09-20T08:00:00.000Z', trasporto_iniziato_il: '2026-09-28T08:00:00.000Z', trasporto_finito_il: '2026-10-05T08:00:00.000Z',
  peso_effettivo: 1001, prezzo_attivo_t: 202, costo_raccolta_t: 72, costo_trattamento_t: 90, ...altro,
});
const INTERVENTI = [iv('A'), iv('C', { trasportatore: 'SMOCO S.R.L.', peso_effettivo: 460, costo_raccolta_t: 0, trasporto_finito_il: '2026-10-07T08:00:00.000Z' })];
const IMPORT_PERMESSI = "import { usePermessi } from '@/lib/permessi';";
const IMPORT_FILE = "import { exportExtraRaccoltaExcel, exportExtraRaccoltaPDF } from '@/lib/extraRaccoltaExport';";
const cartella = mkdtempSync(join(tmpdir(), 'chi-legge-'));

await sezione('8. L\'EXTRA RACCOLTA CON L\'ARCHIVIO CHIUSO: CHI NON E\' AMMINISTRATORE VEDE IL FUEL SURCHARGE', async () => {
  const V = await import('../base44/shared/surplusVisibile.ts');
  const { calcolaRigheAttiva } = await import('../base44/shared/attivaCalcolo.ts');
  const { euro } = await import('../src/lib/formatoSoldi.js');
  const pagina = sorgente('src/pages/ExtraRaccolta.jsx');
  verifica('la copia della pagina si fa come la prova si aspetta', pagina.includes(IMPORT_PERMESSI) && pagina.includes(IMPORT_FILE));
  // La fattura di ottobre: il Fuel Surcharge dell'extra raccolta, da Ecotyre.
  const f = calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll: INTERVENTI, fornitori: FORNITORI, tariffe: [], anno: 2026, mese: 'Ottobre', surplus: ARCHIVIO });
  const rigaFS = f.righe.EXTRA_RACCOLTA.find(r => r.surplus_id === 'fs-extra');
  const inFattura = rigaFS ? euro(rigaFS.totale) : '?';
  const monta = async (admin) => {
    const copia = join(cartella, `ExtraRaccolta-${admin ? 'admin' : 'utente'}.jsx`);
    writeFileSync(copia, pagina.replace(IMPORT_PERMESSI, `const usePermessi = () => ({ isAdmin: ${admin}, soloLettura: ${!admin} });`)
      .replace(IMPORT_FILE, 'const exportExtraRaccoltaExcel = async () => {};\nconst exportExtraRaccoltaPDF = async () => {};'));
    const p = await caricaPagina('pages/ExtraRaccolta', { file: copia });
    // L'archivio chiuso come lo chiude la piattaforma: a chi non e' amministratore
    // la lettura diretta restituisce un elenco vuoto, senza errore. La funzione
    // risponde con le regole vere (surplusVisibile.ts).
    const c = clienteFinto({
      archivi: { ExtraRaccolta: INTERVENTI, Tariffa: [], Fornitore: FORNITORI, SurplusTariffa: admin ? ARCHIVIO : [] },
      funzioni: { leggiSurplus: async () => ({ ok: true, parte: admin ? 'tutto' : 'attiva', surplus: V.surplusPerChiLegge(ARCHIVIO, admin) }) },
    });
    globalThis.__CLIENTE_FINTO = c.cliente;
    const r = p.monta(p.Componente, {});
    await aspetta(60);
    const scegli = async (i, v) => { trova(r.albero, el => el.type && el.type.__finto === 'Select')[i].props.onValueChange(v); await aspetta(20); };
    await scegli(0, '2026');
    await scegli(1, 'Ottobre');
    const fasce = trova(r.albero, el => el.type && el.type.name === 'FasciaSurplus');
    return { c, r, fasce, testi: fasce.map(x => testo(x.type(x.props))) };
  };
  const u = await monta(false);
  verifica('la pagina si monta senza errori', u.r.errori.length === 0, String(u.r.errori[0] || ''));
  verifica('i surplus li chiede alla funzione, una volta, e l\'archivio non lo legge', u.c.funzioniChiamate('leggiSurplus').length === 1 && u.c.letture('SurplusTariffa').length === 0,
    J([u.c.funzioniChiamate('leggiSurplus').length, u.c.letture('SurplusTariffa')]));
  verifica('chi non e\' amministratore vede la fascia del Fuel Surcharge, non «nessun surplus»', u.fasce.some(x => x.props.p && x.props.p.nome === 'Fuel Surcharge'), J(u.fasce.map(x => x.props.p && x.props.p.nome)));
  const fsU = u.testi.find(t => t.startsWith('Fuel Surcharge')) || '';
  verifica(`con la parte da Ecotyre: +5,00 €/t, ${inFattura} in fattura, come la fattura`, fsU.includes('+5,00 €/t') && fsU.includes(`${inFattura} in fattura`) && !!rigaFS, fsU);
  verifica('e niente dei fornitori: ne\' l\'accordo solo passivo, ne\' la passiva', !u.testi.some(t => t.includes('Accordo riservato')) && !u.testi.some(t => t.includes('in passiva')), J(u.testi));
  const a = await monta(true);
  const fsA = a.testi.find(t => t.startsWith('Fuel Surcharge')) || '';
  verifica('all\'amministratore la stessa fascia, con la parte ai raccoglitori', fsA.includes(`${inFattura} in fattura`) && fsA.includes('raccoglitori +5,00 €/t') && fsA.includes('in passiva'), fsA);
  verifica('e anche lui passa dalla funzione: chi e\' amministratore lo decide il server', a.c.funzioniChiamate('leggiSurplus').length === 1 && a.c.letture('SurplusTariffa').length === 0);
});

await sezione('9. SUI DATI VERI: CON LA SOLA PARTE ATTIVA LA FATTURA E LA PAGINA DICONO GLI STESSI NUMERI', async () => {
  const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
  const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
  if (!copie.length) { console.log(`  Nessuna copia dei dati veri in ${CARTELLA}: sezione saltata.`); return; }
  const copia = copie[copie.length - 1];
  const D = JSON.parse(gunzipSync(readFileSync(CARTELLA + copia)).toString('utf8'));
  const A = D.archivi;
  const V = await import('../base44/shared/surplusVisibile.ts');
  const { calcolaRigheAttiva } = await import('../base44/shared/attivaCalcolo.ts');
  const calc = await import('../src/lib/extraRaccoltaCalc.js');
  const { giornoRoma } = await import('../src/lib/giornoItaliano.js');
  const { caricaLibPagine } = await import('./dati/libPagine.mjs');
  const subfornitori = await caricaLibPagine('lib/subfornitori');
  const fornitori = A.Fornitore || [];
  const tariffeAttive = (A.Tariffa || []).filter(t => t.direzione === 'ATTIVA');
  // Un Fuel Surcharge simulato su tutto il 2026 sui tre canali, e su ogni canale
  // un accordo solo passivo e un surplus «solo questi» che Ecotyre paga, sugli
  // impianti e i raccoglitori veri: ogni mese con formulari ha qualcosa da contare.
  const impianto = fornitori.find(f => f.ruolo_trattamento && f.stato === 'attivo') || fornitori[0] || {};
  const raccoglitore = fornitori.find(f => f.ruolo_raccolta && f.stato === 'attivo' && !f.interno) || fornitori[0] || {};
  const anno = { data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' };
  const archivio = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].flatMap(c => [
    surplus(`fs-${c}`, c, anno),
    surplus(`acc-${c}`, c, { ...anno, nome: 'Accordo riservato', origine: 'ACCORDO_COMMERCIALE', a_chi: 'elenco', fornitori_json: J([{ id: raccoglitore.id, nome: raccoglitore.ragione_sociale }]), euro_t_passiva: 3, euro_t_attiva: null }),
    surplus(`el-${c}`, c, { ...anno, nome: 'Surplus impianto', origine: 'ACCORDO_COMMERCIALE', prestazione: 'TRATTAMENTO', a_chi: 'elenco', fornitori_json: J([{ id: impianto.id, nome: impianto.ragione_sociale }]), euro_t_passiva: 2, euro_t_attiva: 2.5 }),
  ]);
  const parte = V.surplusPerChiLegge(archivio, false);
  const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const numerici = (x) => (x || []).map(s => ({ surplus_id: s.surplus_id, euro_t: s.euro_t, kg: s.kg, totale: s.totale, ordini: s.ordini }));
  let uguali = true, conSurplus = 0, paginaMesi = 0;
  const righe = [];
  for (let m = 0; m < 12; m++) {
    const dati = { reteAll: A.PrimariaRete || [], aciAll: A.PrimariaAci || [], extraAll: A.ExtraRaccolta || [], fornitori, tariffe: tariffeAttive, anno: 2026, mese: MESI[m] };
    const tutto = calcolaRigheAttiva({ ...dati, surplus: archivio });
    const attiva = calcolaRigheAttiva({ ...dati, surplus: parte });
    for (const c of ['RETE', 'ACI', 'EXTRA_RACCOLTA']) {
      const stesse = J(tutto.righe[c]) === J(attiva.righe[c]) && J(numerici(tutto.surplus_del_mese[c])) === J(numerici(attiva.surplus_del_mese[c]));
      if (!stesse) { uguali = false; console.log(`    ${MESI[m]} ${c}: le righe della fattura cambiano con la sola parte attiva`); }
      conSurplus += tutto.surplus_del_mese[c].length;
      if (tutto.surplus_del_mese[c].length) righe.push(`${MESI[m]} ${c} ${tutto.surplus_del_mese[c].map(s => `${s.surplus_id} ${s.totale}`).join(', ')}`);
    }
    const delMese = (A.ExtraRaccolta || []).filter(r => String(r.stato || '').toLowerCase().trim() === 'terminato' && giornoRoma(r.trasporto_finito_il).slice(0, 7) === `2026-${String(m + 1).padStart(2, '0')}`);
    const pt = calc.totaliExtraRaccolta(delMese, calc.contestoPrezzi(tariffeAttive, fornitori, archivio, subfornitori));
    const pa = calc.totaliExtraRaccolta(delMese, calc.contestoPrezzi(tariffeAttive, fornitori, parte, subfornitori));
    // La pagina di chi non e' amministratore dice i ricavi e la parte da Ecotyre:
    // con la sola parte attiva devono essere quelli dell'amministratore, e quelli
    // della fattura.
    const ricavoFattura = Math.round((tutto.righe.EXTRA_RACCOLTA.reduce((s, r) => s + (Number(r.totale) || 0), 0) + Number.EPSILON) * 100) / 100;
    if (pt.ricavi !== pa.ricavi || pt.surplus.totale_attivo !== pa.surplus.totale_attivo || pa.ricavi !== ricavoFattura) { uguali = false; console.log(`    ${MESI[m]} extra raccolta: pagina ${pt.ricavi}/${pa.ricavi}, fattura ${ricavoFattura}`); }
    if (delMese.length) { paginaMesi++; righe.push(`${MESI[m]} extra raccolta in pagina ${pa.ricavi} (surplus ${pa.surplus.totale_attivo})`); }
  }
  verifica('ogni mese del 2026, sui tre canali, la fattura e la pagina dell\'extra raccolta non cambiano con la sola parte attiva', uguali);
  verifica('e il surplus ha davvero fatto righe da confrontare, anche nella pagina dell\'extra raccolta', conSurplus > 0 && paginaMesi > 0, `${conSurplus} righe, ${paginaMesi} mesi`);
  console.log(`  Copia ${copia}: ${conSurplus} righe di surplus della fattura e ${paginaMesi} mesi dell'extra raccolta confrontati`);
  for (const x of righe) console.log(`    ${x}`);
});

// ─── Lo storico delle modifiche (revisione del 14/10/2026) ───
// La regola di lettura di un archivio come la applica la piattaforma, nelle
// forme che questo progetto usa: true, user_condition sul ruolo, $or e $and,
// i campi della piattaforma (created_by_id di chi chiede) senza prefisso e un
// campo nostro col prefisso data. (risposta dell'assistenza del 02/10/2026, in
// AGENTS.md). Una forma che la prova non sa leggere la ferma: meglio una prova
// rossa che una regola letta a meta'.
const CAMPI_PIATTAFORMA = ['id', 'created_by_id', 'created_by', 'created_date', 'updated_date'];
const passaLaRegola = (regola, riga, utente) => {
  if (regola === true) return true;
  if (!regola || typeof regola !== 'object' || Array.isArray(regola)) throw new Error(`regola che la prova non sa leggere: ${J(regola)}`);
  const valore = (x) => (x === '{{user.id}}' ? utente.id : x === '{{user.email}}' ? utente.email : x);
  return Object.entries(regola).every(([k, v]) => {
    if (k === '$or') return Array.isArray(v) && v.some(x => passaLaRegola(x, riga, utente));
    if (k === '$and') return Array.isArray(v) && v.every(x => passaLaRegola(x, riga, utente));
    if (k === 'user_condition') return Object.entries(v || {}).every(([c, x]) => utente[c] === x);
    if (v !== null && typeof v === 'object') throw new Error(`operatore che la prova non sa leggere: ${k} ${J(v)}`);
    if (k.startsWith('data.')) return riga[k.slice(5)] === valore(v);
    if (CAMPI_PIATTAFORMA.includes(k)) return riga[k] === valore(v);
    throw new Error(`condizione su un campo nostro senza il prefisso data.: ${k}`);
  });
};

await sezione('10. LO STORICO DELLE MODIFICHE NON RACCONTA UN COSTO A CHI NON E\' AMMINISTRATORE', async () => {
  // Lo storico (ModificaDato) tiene una copia campo per campo di ogni surplus
  // scritto. Chiudere SurplusTariffa e lasciare lo storico aperto a tutti
  // lasciava a chiunque fosse collegato euro_t_passiva e tutto un accordo
  // pagato solo da SMOCO: nome, riferimento, elenco dei fornitori (rilievo della
  // revisione del 14/10/2026). Le righe dei costi nascono con riservato vero:
  // l'archivio le deve dare al solo amministratore, e le altre a tutti, perche'
  // la riga Storico gliele mostra.
  const rls = ENTITA('ModificaDato').rls || {};
  const rami = (rls.read && rls.read.$or) || [];
  verifica('la lettura: l\'amministratore tutto, gli altri le righe con riservato falso (campo nostro, col prefisso data.)',
    rami.length === 2 && rami.some(soloAdmin) && rami.some(x => J(x) === J({ 'data.riservato': false })) && Object.keys(rls.read).length === 1, J(rls.read));
  verifica('e la scrittura resta com\'era: crea l\'amministratore, nessuno modifica o cancella', soloAdmin(rls.create)
    && ['update', 'delete'].every(k => rls[k] && rls[k].user_condition && rls[k].user_condition.role === 'nessuno' && Object.keys(rls[k]).length === 1), J(rls));
  verifica('il file dice perche\', con la data e la prova', /14\/10\/2026/.test(sorgente('base44/entities/ModificaDato.jsonc')) && /prove\/chiLeggeCosa\.mjs/.test(sorgente('base44/entities/ModificaDato.jsonc')));

  // Le scritture vere della scheda dei surplus (gestisciAnagrafiche sul banco),
  // una dopo l'altra sullo stesso archivio: un accordo solo passivo creato,
  // modificato e cancellato, e il Fuel Surcharge, che Ecotyre paga.
  const { caricaFunzione, chiama } = await import('./dati/bancoFunzioni.mjs');
  const modulo = await caricaFunzione('gestisciAnagrafiche');
  let db = { SurplusTariffa: [], Tariffa: [], Fornitore: FORNITORI, ModificaDato: [] };
  const scrivi = async (corpo) => {
    const r = await chiama(modulo, { ruolo: 'admin', db, corpo: { entita: 'SurplusTariffa', motivo: 'prova', ...corpo } });
    db = r.db;
    return r;
  };
  const periodo = { data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31' };
  const nato = await scrivi({ operazione: 'create', dati: { nome: 'Accordo riservato Gatim', origine: 'ACCORDO_COMMERCIALE', riferimento: 'lettera riservata', tipologie: ['RETE'],
    prestazione: 'RACCOLTA', a_chi: 'elenco', fornitori_json: [{ id: 'F-GAT', nome: 'GATIM S.R.L.' }], euro_t_passiva: 7, euro_t_attiva: null, ...periodo } });
  const idAccordo = nato.j && nato.j.result && nato.j.result[0] && nato.j.result[0].id;
  const cambiato = await scrivi({ operazione: 'update', id: idAccordo, dati: { euro_t_passiva: 8 } });
  const tolto = await scrivi({ operazione: 'delete', id: idAccordo });
  const fs = await scrivi({ operazione: 'create', dati: { nome: 'Fuel Surcharge', origine: 'CONSORZIO', tipologie: ['ACI'], prestazione: 'RACCOLTA', a_chi: 'tutti', euro_t_passiva: 5, euro_t_attiva: 5, ...periodo } });
  const idFS = fs.j && fs.j.result && fs.j.result[0] && fs.j.result[0].id;
  const righe = db.ModificaDato || [];
  const dellAccordo = righe.filter(r => r.record_id === idAccordo);
  verifica('le scritture vere lasciano le loro righe: l\'accordo nato, modificato e cancellato, e il Fuel Surcharge',
    [nato, cambiato, tolto, fs].every(r => r.stato === 200) && !!idAccordo && !!idFS
    && ['create', 'update', 'delete'].every(op => dellAccordo.some(r => r.operazione === op)) && righe.some(r => r.record_id === idFS),
    J([nato, cambiato, tolto, fs].map(r => [r.stato, r.j && r.j.error])));
  verifica('ogni riga dice se e\' un costo: riservato vero o falso, mai vuoto', righe.length > 0 && righe.every(r => typeof r.riservato === 'boolean'), J(righe.map(r => r.riservato)));

  const AMMINISTRATORE = { role: 'admin', id: 'u-admin', email: 'amministratore@prova' };
  const UTENTE = { role: 'user', id: 'u-user', email: 'utente@prova' };
  const vede = (utente) => righe.filter(r => passaLaRegola(rls.read, r, utente));
  verifica('all\'amministratore lo storico intero', vede(AMMINISTRATORE).length === righe.length, `${vede(AMMINISTRATORE).length} di ${righe.length}`);
  const visibili = vede(UTENTE);
  const t = J(visibili);
  verifica('a chi non e\' amministratore nessun importo ai fornitori', !visibili.some(r => r.campo === 'euro_t_passiva'),
    J(visibili.filter(r => r.campo === 'euro_t_passiva').map(r => [r.etichetta, r.prima, r.dopo])));
  verifica('ne\' l\'accordo solo passivo: nome, riferimento, fornitori, nemmeno quando si modifica o si cancella',
    !visibili.some(r => r.record_id === idAccordo) && !t.includes('Accordo riservato') && !t.includes('GATIM') && !t.includes('lettera riservata'),
    `${visibili.filter(r => r.record_id === idAccordo).length} righe dell'accordo`);
  verifica('la parte da Ecotyre del Fuel Surcharge resta nello storico di tutti, come prima',
    visibili.some(r => r.record_id === idFS && r.campo === 'euro_t_attiva' && r.dopo === '5') && visibili.some(r => r.record_id === idFS && r.campo === 'nome'), t.slice(0, 300));
  verifica('chi non e\' amministratore riceve proprio le righe che la riga Storico gli mostrava: a video non cambia niente',
    J(visibili) === J(righe.filter(r => !r.riservato)));
  verifica('la riga Storico nasconde ancora i costi a chi non e\' amministratore (se la regola un giorno si riaprisse)',
    /const visibili = \(righe \|\| \[\]\)\.filter\(r => isAdmin \|\| !r\.riservato\);/.test(sorgente('src/components/shared/StoricoModifiche.jsx')));

  // Chi scrive lo storico scrive riservato sempre vero o falso, per ogni
  // archivio tracciato, nelle funzioni e nelle pagine: una riga senza il campo
  // la regola la darebbe al solo amministratore (dalla parte sicura), ma alla
  // riga Storico degli altri mancherebbe una modifica che non e' un costo.
  const vuote = [];
  for (const [dove, m] of [['shared', await import('../base44/shared/campiTracciati.ts')], ['src/lib', await import('../src/lib/campiTracciati.js')]]) {
    for (const entita of Object.keys(m.CAMPI_TRACCIATI)) {
      const pieno = Object.fromEntries(Object.keys(m.CAMPI_TRACCIATI[entita]).map(c => [c, '1']));
      const casi = [
        ['create', { prima: null, dopo: pieno }], ['update', { prima: {}, dopo: pieno }], ['delete', { prima: pieno, dopo: null }], ['create', { prima: null, dopo: {} }],
      ];
      for (const [operazione, x] of casi) {
        for (const r of m.righeDiModifica(entita, { record_id: 'r1', ...x, operazione })) if (typeof r.riservato !== 'boolean') vuote.push(`${dove} ${entita} ${operazione} ${r.campo}`);
      }
    }
  }
  verifica('le funzioni e le pagine scrivono riservato vero o falso per ogni archivio tracciato', vuote.length === 0, J(vuote.slice(0, 5)));
  const chiusiFuori = sorgente('base44/shared/chiusuraMese.ts');
  const preparaAnno = sorgente('base44/functions/preparaAnno/entry.ts');
  verifica('e cosi\' le due righe scritte a mano (i mesi chiusi fuori, la conferma della copia d\'anno)',
    /motivo: NOTA_CHIUSO_FUORI, riservato: false,/.test(chiusiFuori) && /riservato: !!campoRiservato\('Tariffa', 'valore', t\),/.test(preparaAnno));
});

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
