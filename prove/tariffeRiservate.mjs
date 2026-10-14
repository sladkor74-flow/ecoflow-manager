// LE TARIFFE PASSIVE DAVVERO RISERVATE (decisione del 14/10/2026).
//
// Il 14/10/2026 l'utente ha detto «per me ok sulle cose da sistemare» sulle
// migliorie proposte quel giorno. Fra queste: Tariffa si leggeva da chiunque
// fosse collegato (rls.read true). Il gestionale mostrava le tariffe PASSIVE, i
// prezzi dei fornitori, al solo amministratore, ma dal browser, con gli
// strumenti dello sviluppatore, chiunque leggeva l'archivio intero: costi e
// margine sono solo dell'amministratore. Ora Tariffa la legge solo lui, come
// SurplusTariffa dal 13/10/2026 (prove/chiLeggeCosa.mjs), e a chi non e'
// amministratore le sole tariffe ATTIVE arrivano dalla funzione di sola lettura
// leggiTariffe (base44/shared/tariffeVisibili.ts, src/lib/leggiTariffe.js).
//
// Chiudere la lettura ha un rischio che non si vede: una pagina che legge
// ancora l'archivio dal browser, aperta da chi non e' amministratore, riceve un
// elenco vuoto senza un errore. Nell'Extra Raccolta vuol dire la sola base
// dell'anno al posto della tariffa della tabella: ricavi diversi dalla fattura,
// in silenzio. Per questo la prova guarda chi legge, fa girare la funzione con
// l'archivio chiuso davvero, monta la pagina vera e confronta i numeri sui dati
// veri.
//
// Sezioni:
// 1. la regola dell'archivio: legge e scrive solo l'amministratore, col perche';
// 2. le pagine: dal browser leggono Tariffa solo le schede dell'amministratore,
//    l'Extra Raccolta chiede a leggiTariffe, la scheda dell'intervento si monta
//    solo per l'amministratore e riceve le passive dalla pagina;
// 3. le funzioni: ogni lettore di Tariffa legge con asServiceRole (inventario);
// 4. la parte attiva: che cosa arriva a chi non e' amministratore;
// 5. la funzione leggiTariffe sul banco (prove/dati/bancoFunzioni.mjs);
// 6. con l'archivio chiuso davvero: un SDK che applica a chi chiede la regola di
//    lettura dell'entita', e a asServiceRole no; leggiTariffe e il riepilogo
//    dell'attiva chiesti da un utente semplice;
// 7. la libreria delle pagine src/lib/leggiTariffe.js;
// 8. la pagina Extra Raccolta vera con l'archivio chiuso: chi non e'
//    amministratore ha i ricavi della fattura, l'amministratore anche i
//    contratti dei trasporti e la scheda; una lettura che cade si dice;
// 9. lo storico delle modifiche delle tariffe passive: riservato, e la regola di
//    ModificaDato lo da' al solo amministratore;
// 10. sui dati veri (copia in ../dati-veri, se c'e'): le tariffe della pagina e
//    i numeri dell'Extra Raccolta e della fattura sono gli stessi di prima, ogni
//    mese del 2026, sui tre canali.
//
// node prove/tariffeRiservate.mjs
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
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
// I fine-riga si normalizzano: su Windows il checkout puo' scrivere CRLF.
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
// Le letture dirette di Tariffa in un sorgente: .Tariffa.list/filter/get/subscribe(,
// fetchAllClient(qualcosa.Tariffa e entities['Tariffa'].
const lettureDirette = (t, nome = 'Tariffa') => {
  const re = [
    new RegExp(`\\.\\s*${nome}\\s*\\.\\s*(?:list|filter|get|subscribe)\\s*\\(`),
    new RegExp(`\\b(?:fetchAllClient|fetchAll|leggiArchivio|perPagina)\\s*\\(\\s*[\\w.]*\\.${nome}\\b`),
    new RegExp(`entities\\s*\\[\\s*['"\`]${nome}['"\`]\\s*\\]`),
  ];
  return codice(t).split('\n').map((r, i) => ({ r, i })).filter(x => re.some(y => y.test(x.r))).map(x => `${x.i + 1}: ${x.r.trim().slice(0, 140)}`);
};

// ─── L'archivio della prova ───
const tariffa = (id, altro) => ({
  id, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31',
  created_by: 'amministratore@smoco', created_by_id: 'u-admin', created_date: '2026-01-02T08:00:00.000Z', updated_date: '2026-01-02T08:00:00.000Z', is_sample: false, ...altro,
});
const LOG = 'Logistica Srl A Socio Unico';
const ARCHIVIO = [
  // le attive: quello che SMOCO fattura a Ecotyre
  tariffa('ta-extra', { direzione: 'ATTIVA', cliente: 'ECOTYRE', tipologia: 'EXTRA_RACCOLTA', valore: 210, note: 'nota interna sulla trattativa', created_date: '2026-01-05T08:00:00.000Z' }),
  tariffa('ta-rete', { direzione: 'ATTIVA', cliente: 'ECOTYRE', tipologia: 'RETE', valore: 202, regione: '', classe_materiale: '' }),
  tariffa('ta-aci', { direzione: 'ATTIVA', cliente: 'ECOTYRE', tipologia: 'ACI', valore: 240, regione: 'Campania', servizio_ecotyre: 'TRASP_TRATT', fornitore_nome: null }),
  // le passive: i prezzi dei fornitori
  tariffa('tp-emm', { direzione: 'PASSIVA', fornitore_id: 'F-EMM', fornitore_nome: 'EMMESSE SRLS', tipologia: 'EXTRA_RACCOLTA', prestazione: 'RACCOLTA', valore: 72, note: 'sconto riservato' }),
  tariffa('tp-log', { direzione: 'PASSIVA', fornitore_id: 'F-LOG', fornitore_nome: LOG, tipologia: 'TUTTE', prestazione: 'TRASPORTO_SECONDARIA', produttore: 'NAPPI SUD SRL', destinatario: 'TECNOGUM SRL', valore: 30 }),
  tariffa('tp-grt', { direzione: 'PASSIVA', fornitore_id: 'F-GRT', fornitore_nome: 'GREEN TYRE PROJECT', tipologia: 'ACI', prestazione: 'RACCOLTA', valore: 225, comprensiva_trattamento: true }),
  // senza direzione: scritta prima che il campo esistesse, e' passiva
  tariffa('tp-vecchia', { fornitore_id: 'F-GAT', fornitore_nome: 'GATIM S.R.L.', tipologia: 'RETE', prestazione: 'TRATTAMENTO', valore: 95 }),
];
const PASSIVE = ['tp-emm', 'tp-log', 'tp-grt', 'tp-vecchia'];
const ATTIVE = ['ta-extra', 'ta-rete', 'ta-aci'];

await sezione('1. TARIFFA LA LEGGE SOLO L\'AMMINISTRATORE, COME LA SCRIVE', async () => {
  const rls = ENTITA('Tariffa').rls || {};
  verifica('la lettura e\' dell\'amministratore', soloAdmin(rls.read), J(rls.read));
  verifica('e la scrittura resta sua', ['create', 'update', 'delete'].every(k => soloAdmin(rls[k])), J(rls));
  // Il perche' sta scritto accanto alla regola: una lettura chiusa senza motivo
  // la riapre il primo che non trova un dato.
  const f = sorgente('base44/entities/Tariffa.jsonc');
  verifica('il file dice perche\', con la data, la funzione per chi non e\' amministratore e la prova',
    /14\/10\/2026/.test(f) && /leggiTariffe/.test(f) && /prove\/tariffeRiservate\.mjs/.test(f));
});

const SRC = fileSotto('src');

await sezione('2. LE PAGINE: TARIFFA DAL BROWSER SOLO NELLE SCHEDE DELL\'AMMINISTRATORE', async () => {
  // Le pagine che la leggono direttamente, col perche' possono: sono schede che
  // la Fatturazione disegna solo all'amministratore.
  const AMMESSI = {
    'src/components/fatturazione/TariffeUnificate.jsx': 'la scheda Tariffe & Anagrafiche',
    'src/components/fatturazione/PassivaModulo.jsx': 'la scheda Passiva',
  };
  const lettori = SRC.filter(p => lettureDirette(sorgente(p)).length > 0);
  const fuori = lettori.filter(p => !AMMESSI[p]);
  verifica('le pagine che leggono Tariffa dal browser sono solo quelle dell\'amministratore', fuori.length === 0,
    '\n    ' + fuori.map(p => `${p}: ${lettureDirette(sorgente(p)).join(' | ')}`).join('\n    '));
  for (const p of Object.keys(AMMESSI)) verifica(`l'eccezione ${p} (${AMMESSI[p]}) serve ancora`, lettori.includes(p));
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
  // Un lettore generico (entities[nome]) non deve ricevere 'Tariffa': nelle
  // pagine c'e' l'elenco degli assegnati, con due archivi suoi, e dal 14/10/2026
  // la copia di sicurezza (src/lib/copiaSicurezza.js), che legge per nome TUTTI
  // gli archivi, Tariffa compresa, perche' e' una copia di tutto. E' del solo
  // amministratore, che Tariffa la legge comunque (sezione 1): la libreria chiede
  // al server chi e' collegato prima di qualunque lettura, e Caricamento Dati la
  // disegna solo a lui. Le due guardie si verificano qui, con le loro
  // controprove: senza, la copia sarebbe un lettore come gli altri (chiusura del
  // 15/10/2026).
  const COPIA = 'src/lib/copiaSicurezza.js';
  const generici = SRC.filter(p => /entities\s*\[\s*[A-Za-z_$]/.test(codice(sorgente(p))));
  verifica('le sole letture per nome nelle pagine sono quella degli assegnati, che non legge Tariffa, e la copia di sicurezza dell\'amministratore', J(generici) === J([COPIA, 'src/pages/Assegnati.jsx'])
    && /entity = 'Assegnato'/.test(sorgente('src/pages/Assegnati.jsx')) && /entity="AssegnatoAci"/.test(sorgente('src/pages/AssegnatiAci.jsx')), J(generici));
  const RUOLO = /if \(!io \|\| io\.role !== 'admin'\) throw errore\('non_amministratore'[^\n]*\n/;
  const guardiaLibreria = (t) => { const c = codice(t); const r = c.search(RUOLO); return r >= 0 && c.indexOf('client.entities') > r; };
  const guardiaPagina = (t) => /\{isAdmin && <CopiaSicurezza\b/.test(codice(t)) && (codice(t).match(/<CopiaSicurezza\b/g) || []).length === 1;
  const libCopia = sorgente(COPIA), carCopia = sorgente('src/pages/CaricamentoDati.jsx');
  verifica('la copia di sicurezza legge Tariffa solo dopo aver chiesto al server se chi e\' collegato e\' l\'amministratore', /'Tariffa'/.test(libCopia) && guardiaLibreria(libCopia));
  verifica('e Caricamento Dati la disegna solo all\'amministratore', guardiaPagina(carCopia) && J(SRC.filter(p => /from '@\/lib\/copiaSicurezza'/.test(sorgente(p)))) === J(['src/components/caricamento/CopiaSicurezza.jsx'])
    && J(SRC.filter(p => /from '@\/components\/caricamento\/CopiaSicurezza'/.test(sorgente(p)))) === J(['src/pages/CaricamentoDati.jsx']));
  verifica('controprova: senza il controllo del ruolo, o con la sezione disegnata a tutti, le guardie cadono',
    !guardiaLibreria(libCopia.replace(RUOLO, '')) && !guardiaPagina(carCopia.replace(/\{isAdmin && <CopiaSicurezza\b/, '{<CopiaSicurezza')));

  // L'Extra Raccolta la apre anche chi non e' amministratore: chiede alla funzione.
  const extra = sorgente('src/pages/ExtraRaccolta.jsx');
  verifica('l\'Extra Raccolta legge le tariffe da leggiTariffe (src/lib/leggiTariffe.js), una volta',
    /import \{ leggiTariffe \} from '@\/lib\/leggiTariffe';/.test(extra) && (codice(extra).match(/await leggiTariffe\(\)/g) || []).length === 1);
  verifica('e i prezzi dei fornitori li prende solo se il server dice che chi chiede e\' l\'amministratore', /if \(parte === 'tutto'\) \{\n\s*setTariffeTrasporti\(/.test(extra));
  const lib = sorgente('src/lib/leggiTariffe.js');
  verifica('la libreria chiede alla funzione e non legge l\'archivio', /functions\.invoke\('leggiTariffe'/.test(lib) && lettureDirette(lib).length === 0);
  // La scheda dell'intervento propone i costi con le passive: la apre e la monta
  // solo l'amministratore, e le riceve dalla pagina.
  const scheda = sorgente('src/components/fatturazione/ExtraRaccoltaForm.jsx');
  verifica('la scheda dell\'intervento non legge Tariffa: le passive le riceve dalla pagina', lettureDirette(scheda).length === 0 && /tariffePassive = \[\]/.test(scheda));
  verifica('e la pagina la monta solo per l\'amministratore', /\{isAdmin && \(\n\s*<ExtraRaccoltaForm\b/.test(extra) && (extra.match(/<ExtraRaccoltaForm\b/g) || []).length === 1);
  const chiScheda = SRC.filter(x => /import\s+ExtraRaccoltaForm\s+from/.test(sorgente(x)));
  verifica('la scheda la usa solo l\'Extra Raccolta', J(chiScheda) === J(['src/pages/ExtraRaccolta.jsx']), J(chiScheda));
  for (const k of ['Aggiungi intervento', 'title="Modifica"', 'title="Duplica"']) {
    const i = extra.indexOf(k);
    const prima = i >= 0 ? extra.lastIndexOf('{isAdmin', i) : -1;
    verifica(`e la apre solo lui: «${k}» sta sotto isAdmin`, i > 0 && prima > 0 && extra.slice(prima, i).split('\n').length < 6, String(i));
  }
});

await sezione('3. LE FUNZIONI: OGNI LETTORE DI TARIFFA LEGGE CON asServiceRole', async () => {
  // Una funzione che leggesse Tariffa coi permessi di chi chiede (base44.entities),
  // chiesta da chi non e' amministratore, riceverebbe un elenco vuoto: una riga
  // senza tariffa, un prezzo a zero. Ogni file delle funzioni che la legge deve
  // leggere gli archivi solo con asServiceRole: svc = base44.asServiceRole.entities,
  // o un nome che vale base44.asServiceRole (migraTariffePrestazione: b).
  const FILE = [...fileSotto('base44/functions'), ...fileSotto('base44/shared')];
  const lettori = FILE.filter(p => /\.Tariffa\b/.test(codice(sorgente(p))) || lettureDirette(sorgente(p)).length > 0).sort();
  console.log(`  ${lettori.length} file delle funzioni leggono Tariffa:\n    ${lettori.join('\n    ')}`);
  const NOTI = ['calcolaMargine', 'calcolaPassiva', 'congelaPassivaMese', 'contrattiAnno', 'controlloRotte', 'cruscottoOperativo', 'elaboraConsuntivo',
    'elaboraFatturazioneAttiva', 'gestisciAnagrafiche', 'getRiepilogoEcotyre', 'prefatturaEcotyre', 'preparaAnno', 'reportConferimenti', 'leggiTariffe']
    .map(n => `base44/functions/${n}/entry.ts`).concat(['base44/shared/strumentiAssistente.ts']);
  verifica('ci sono i lettori di sempre, e leggiTariffe', NOTI.every(p => lettori.includes(p)), J(NOTI.filter(p => !lettori.includes(p))));
  const conUtente = lettori.filter(p => {
    const c = codice(sorgente(p));
    const alias = [...c.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*base44\.asServiceRole\s*;/g)].map(m => m[1]);
    const senzaAlias = alias.reduce((t, a) => t.replace(new RegExp(`\\b${a}\\.entities\\b`, 'g'), 'base44.asServiceRole.entities'), c);
    return /(?<!asServiceRole)\.entities\b/.test(senzaAlias);
  });
  verifica('nessuno legge un archivio coi permessi di chi chiede', conUtente.length === 0, J(conUtente));
  const svcStrani = lettori.flatMap(p => [...codice(sorgente(p)).matchAll(/\b(?:const|let|var)\s+svc\s*=\s*([^;\n]+)/g)]
    .filter(m => !/asServiceRole\.entities\s*$/.test(m[1].trim())).map(m => `${p}: ${m[0]}`));
  verifica('e ogni svc e\' l\'archivio con asServiceRole', svcStrani.length === 0, J(svcStrani));
  // leggiTariffe: una lettura, tutto l'archivio, con asServiceRole, e niente scritture.
  const f = codice(sorgente('base44/functions/leggiTariffe/entry.ts'));
  verifica('leggiTariffe legge tutto l\'archivio con asServiceRole, una volta, senza filtro sullo stato, per data di creazione', (f.match(/\bTariffa\b/g) || []).length === 1
    && /fetchAll\(base44\.asServiceRole\.entities\.Tariffa, null, '-created_date'\)/.test(f) && !/stato:/.test(f));
  verifica('chi e\' amministratore lo dice il server (user.role), non la richiesta', /const amministratore = user\.role === 'admin';/.test(f) && !/req\.json/.test(f));
  verifica('chi non e\' collegato: 401', /if \(!user\) return Response\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);/.test(f));
  verifica('non scrive: nessuna create, update o delete', !/\.(create|update|delete|bulkCreate|bulkUpdate|deleteMany)\s*\(/.test(f));
  verifica('e passa dal limite di richieste, come le altre', /conLimiteRichieste\(createClientFromRequest\(req\)\)/.test(f));
});

await sezione('4. LA PARTE ATTIVA: CHE COSA ARRIVA A CHI NON E\' AMMINISTRATORE', async () => {
  const V = await import('../base44/shared/tariffeVisibili.ts');
  const admin = V.tariffePerChiLegge(ARCHIVIO, true);
  verifica('all\'amministratore tutto l\'archivio, com\'e\' scritto', J(admin) === J(ARCHIVIO));
  const altri = V.tariffePerChiLegge(ARCHIVIO, false);
  const testo = J(altri);
  verifica('agli altri le sole tariffe attive, nell\'ordine in cui arrivano', J(altri.map(t => t.id)) === J(ATTIVE), J(altri.map(t => t.id)));
  verifica('nessuna passiva, nemmeno quella senza direzione', !altri.some(t => PASSIVE.includes(t.id)) && !testo.includes('EMMESSE') && !testo.includes('GATIM') && !testo.includes('Logistica'));
  verifica('nessun prezzo dei fornitori: 72, 30, 225 e 95 non ci sono', !/"valore":(72|30|225|95)\b/.test(testo), testo.slice(0, 300));
  verifica('niente note, ne\' i campi delle passive, ne\' quelli della piattaforma (created_by e\' un indirizzo)',
    altri.every(t => Object.keys(t).every(k => V.CAMPI_TARIFFA_ATTIVA.includes(k))) && !testo.includes('nota interna') && !testo.includes('amministratore@smoco')
    && !testo.includes('fornitore_') && !testo.includes('prestazione') && !testo.includes('created_'), testo.slice(0, 300));
  const extra = altri.find(t => t.id === 'ta-extra');
  verifica('la tariffa dell\'extra raccolta: direzione, cliente, canale, unita\', valore, date e stato',
    J(extra) === J({ id: 'ta-extra', direzione: 'ATTIVA', cliente: 'ECOTYRE', tipologia: 'EXTRA_RACCOLTA', unita_misura: '€/t', valore: 210, data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', stato: 'attivo' }), J(extra));
  const aci = altri.find(t => t.id === 'ta-aci');
  verifica('e quella dell\'ACI porta la regione e la dicitura del servizio, con cui si sceglie', !!aci && aci.regione === 'Campania' && aci.servizio_ecotyre === 'TRASP_TRATT' && !('fornitore_nome' in aci), J(aci));
  verifica('la direzione si legge senza badare a maiuscole e spazi; una disattivata arriva, con lo stato (la toglie il calcolo)',
    J(V.tariffePerChiLegge([tariffa('x', { direzione: ' attiva ', valore: 1, stato: 'non_attivo' })], false).map(t => [t.id, t.stato])) === J([['x', 'non_attivo']]));
  verifica('senza dire chi chiede si nega: le sole attive', J(V.tariffePerChiLegge(ARCHIVIO)) === J(altri) && J(V.tariffePerChiLegge(ARCHIVIO, 'true')) === J(altri) && J(V.tariffePerChiLegge(ARCHIVIO, 1)) === J(altri));
  verifica('un archivio vuoto o mancante e\' un elenco vuoto', J(V.tariffePerChiLegge(null, false)) === '[]' && J(V.tariffePerChiLegge([null], true)) === '[]');
  // La parte attiva basta alla fattura: con le sole attive, coi soli campi
  // mandati, le righe dell'attiva sono le stesse, anche con classe, regione,
  // codice EER e dicitura del servizio.
  const { calcolaRigheAttiva } = await import('../base44/shared/attivaCalcolo.ts');
  const specifiche = [
    ...ARCHIVIO,
    tariffa('ta-extra-g', { direzione: 'ATTIVA', cliente: 'ECOTYRE', tipologia: 'EXTRA_RACCOLTA', valore: 230, classe_materiale: 'G1', eer_codice: '160103', regione: 'Campania' }),
    tariffa('ta-rete-tr', { direzione: 'ATTIVA', cliente: 'ECOTYRE', tipologia: 'RETE', valore: 150, servizio_ecotyre: 'TRASP' }),
  ];
  const mov = (id, altro) => ({ id, stato: 'terminato', id_ordine: id, numero_fir: 'FIR ' + id, produttore: 'P', trasportatore: 'EMMESSE SRLS', destinazione: 'GATIM S.R.L.', provincia: 'NA', regione: 'Campania',
    classe: 'P', cer: '160103', peso_effettivo: 1000, ordine_immesso_il: '2026-10-01T08:00:00.000Z', trasporto_iniziato_il: '2026-10-02T08:00:00.000Z', trasporto_finito_il: '2026-10-02T08:00:00.000Z', ...altro });
  const dati = {
    reteAll: [mov('R1', {}), mov('R2', { classe: 'G1' })], aciAll: [mov('A1', {})], extraAll: [mov('E1', { classe: 'G1', tipo_movimento: 'primaria', prezzo_attivo_t: 0 }), mov('E2', { tipo_movimento: 'primaria', prezzo_attivo_t: 0 })],
    fornitori: [{ id: 'F-GAT', ragione_sociale: 'GATIM S.R.L.', stato: 'attivo', ruolo_trattamento: true }], anno: 2026, mese: 'Ottobre', surplus: [],
  };
  const tutto = calcolaRigheAttiva({ ...dati, tariffe: specifiche.filter(t => t.direzione === 'ATTIVA') });
  const parte = calcolaRigheAttiva({ ...dati, tariffe: V.tariffePerChiLegge(specifiche, false) });
  verifica('con la sola parte attiva le righe della fattura sono le stesse, sui tre canali', J(tutto.righe) === J(parte.righe) && J(tutto.anomalie) === J(parte.anomalie)
    && tutto.righe.EXTRA_RACCOLTA.some(r => r.tariffa_valore === 230), J([tutto.righe.EXTRA_RACCOLTA.map(r => r.tariffa_valore), parte.righe.EXTRA_RACCOLTA.map(r => r.tariffa_valore)]));
});

await sezione('5. LA FUNZIONE leggiTariffe SUL BANCO', async () => {
  const { caricaFunzione, chiama } = await import('./dati/bancoFunzioni.mjs');
  const V = await import('../base44/shared/tariffeVisibili.ts');
  const modulo = await caricaFunzione('leggiTariffe');
  const admin = await chiama(modulo, { db: { Tariffa: ARCHIVIO }, ruolo: 'admin' });
  verifica('all\'amministratore: 200, tutto l\'archivio, coi prezzi dei fornitori', admin.stato === 200 && admin.j.ok === true && admin.j.parte === 'tutto' && admin.j.tariffe.length === ARCHIVIO.length
    && admin.j.tariffe.some(t => t.id === 'tp-emm' && t.valore === 72), J([admin.stato, admin.j.parte, admin.j.tariffe && admin.j.tariffe.length]));
  verifica('per data di creazione, la piu\' recente prima, come le leggeva la pagina', admin.j.tariffe && admin.j.tariffe[0].id === 'ta-extra', J(admin.j.tariffe && admin.j.tariffe.map(t => t.id)));
  const user = await chiama(modulo, { db: { Tariffa: ARCHIVIO }, ruolo: 'user' });
  verifica('agli altri: 200, le sole attive', user.stato === 200 && user.j.parte === 'attiva'
    && J([...user.j.tariffe].sort((a, b) => a.id.localeCompare(b.id))) === J(V.tariffePerChiLegge(ARCHIVIO, false).sort((a, b) => a.id.localeCompare(b.id))), J(user.j));
  verifica('e nella risposta niente passive, niente prezzi dei fornitori, niente note', !J(user.j).includes('PASSIVA') && !J(user.j).includes('EMMESSE') && !J(user.j).includes('sconto riservato') && !J(user.j).includes('nota interna'));
  verifica('non scrive niente', admin.scritte.length === 0 && user.scritte.length === 0, J([admin.scritte, user.scritte]));
  const vuoto = await chiama(modulo, { db: {}, ruolo: 'user' });
  verifica('senza tariffe: 200 e un elenco vuoto, non un errore', vuoto.stato === 200 && J(vuoto.j.tariffe) === '[]', J(vuoto.j));
});

// ─── Un SDK con l'archivio chiuso davvero ───
// La regola di lettura dell'entita' (il suo .jsonc) applicata a chi chiede, riga
// per riga, nelle forme che il progetto usa: true, user_condition sul ruolo, $or
// e $and, i campi della piattaforma senza prefisso e i nostri col prefisso data.
// (risposta dell'assistenza del 02/10/2026). asServiceRole legge tutto, come
// sulla piattaforma. Ogni lettura si registra: chi, che cosa, con che permessi.
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
globalThis.__PASSA = (nome, riga) => passaLaRegola((ENTITA(nome).rls || {}).read, riga, globalThis.__UTENTE);
const SDK_CON_REGOLE = `
const tabella = (nome) => (globalThis.__DB[nome] = globalThis.__DB[nome] || []);
const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
const visibili = (nome, servizio) => tabella(nome).filter(r => servizio || globalThis.__PASSA(nome, r));
const entita = (nome, servizio) => ({
  list: async (_o, q = 5000, s = 0) => { globalThis.__LETTURE.push({ nome, servizio }); return visibili(nome, servizio).slice(s, s + q).map(r => ({ ...r })); },
  filter: async (f, _o, q = 5000, s = 0) => { globalThis.__LETTURE.push({ nome, servizio }); return visibili(nome, servizio).filter(r => uguale(r, f)).slice(s, s + q).map(r => ({ ...r })); },
  get: async (id) => { globalThis.__LETTURE.push({ nome, servizio }); const r = visibili(nome, servizio).find(x => x.id === id); if (!r) throw new Error('non trovato ' + id); return { ...r }; },
  create: async (r) => { globalThis.__SCRITTE.push({ op: 'create', nome, servizio }); return { id: 'nuovo', ...r }; },
  update: async (id, r) => { globalThis.__SCRITTE.push({ op: 'update', nome, servizio }); return { id, ...r }; },
  delete: async (id) => { globalThis.__SCRITTE.push({ op: 'delete', nome, servizio }); return {}; },
});
const archivi = (servizio) => new Proxy({}, { get: (_t, nome) => entita(String(nome), servizio) });
export function createClientFromRequest() {
  return {
    auth: { me: async () => globalThis.__UTENTE },
    entities: archivi(false),
    asServiceRole: { entities: archivi(true), functions: { invoke: async () => ({ data: {} }) } },
    functions: { invoke: async () => ({ data: {} }) },
  };
}`;
async function caricaConRegole(nome) {
  const pacchetto = await build({
    entryPoints: [join(radice, `base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-con-regole', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-con-regole' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-con-regole' }, () => ({ contents: SDK_CON_REGOLE, loader: 'js' }));
    } }],
  });
  return import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
}
const AMMINISTRATORE = { role: 'admin', id: 'u-admin', email: 'amministratore@prova' };
const UTENTE = { role: 'user', id: 'u-user', email: 'utente@prova' };
async function chiamaCome(modulo, utente, db, corpo = {}) {
  globalThis.__DB = JSON.parse(JSON.stringify(db));
  globalThis.__LETTURE = [];
  globalThis.__SCRITTE = [];
  globalThis.__UTENTE = utente;
  const r = await modulo.default({ json: async () => corpo });
  return { stato: r.status, j: await r.json(), letture: globalThis.__LETTURE, scritte: globalThis.__SCRITTE };
}

// ─── L'extra raccolta della prova: ottobre 2026 ───
const FORNITORI = [
  { id: 'F-EMM', ragione_sociale: 'EMMESSE SRLS', stato: 'attivo', ruolo_raccolta: true },
  { id: 'F-SMO', ragione_sociale: 'SMOCO S.R.L.', stato: 'attivo', interno: true, ruolo_raccolta: true },
  { id: 'F-GAT', ragione_sociale: 'GATIM S.R.L.', stato: 'attivo', ruolo_trattamento: true },
  { id: 'F-LOG', ragione_sociale: LOG, stato: 'attivo', ruolo_raccolta: true },
  { id: 'F-NAP', ragione_sociale: 'NAPPI SUD SRL', stato: 'attivo', ruolo_stoccaggio: true },
  { id: 'F-TEC', ragione_sociale: 'TECNOGUM SRL', stato: 'attivo', ruolo_trattamento: true },
];
const iv = (id, altro = {}) => ({
  id, stato: 'terminato', tipo_movimento: 'primaria', id_ordine: 'ER-' + id, numero_fir: 'FIR ' + id,
  produttore: 'COMUNE DI PROVA', trasportatore: 'EMMESSE SRLS', destinazione: 'GATIM S.R.L.', tipo_destinazione: 'imp',
  provincia: 'NA', classe: 'P', cer: '160103',
  ordine_immesso_il: '2026-10-01T08:00:00.000Z', trasporto_iniziato_il: '2026-10-05T08:00:00.000Z', trasporto_finito_il: '2026-10-05T08:00:00.000Z',
  peso_effettivo: 1000, prezzo_attivo_t: 0, costo_raccolta_t: 72, costo_trattamento_t: 90, ...altro,
});
// A: senza prezzo scritto, il prezzo e' quello della tabella (210 €/t), non la
// base dell'anno (202). S: una secondaria col contratto della tratta (20 t x 30).
const INTERVENTI = [
  iv('A'),
  iv('S', { tipo_movimento: 'secondaria', stoccaggio: 'NAPPI SUD SRL', produttore: 'NAPPI SUD SRL', trasportatore: LOG, destinazione: 'TECNOGUM SRL', peso_effettivo: 20000, costo_raccolta_t: 0, costo_trattamento_t: 0, costo_trasporto_viaggio: 0 }),
];

await sezione('6. CON L\'ARCHIVIO CHIUSO DAVVERO: CHI NON E\' AMMINISTRATORE CHIEDE ALLE FUNZIONI', async () => {
  const leggi = await caricaConRegole('leggiTariffe');
  // La regola chiude davvero: chi non e' amministratore, leggendo da se', non
  // riceve niente, senza un errore. E' quello che una pagina ricevera'.
  const sdk = await import('data:text/javascript;base64,' + Buffer.from(SDK_CON_REGOLE).toString('base64'));
  globalThis.__DB = { Tariffa: JSON.parse(J(ARCHIVIO)) }; globalThis.__LETTURE = []; globalThis.__UTENTE = UTENTE;
  const diretta = await sdk.createClientFromRequest().entities.Tariffa.list();
  globalThis.__UTENTE = AMMINISTRATORE;
  const direttaAdmin = await sdk.createClientFromRequest().entities.Tariffa.list();
  verifica('con la regola di Tariffa, chi non e\' amministratore leggendo da se\' riceve un elenco vuoto, senza errore; l\'amministratore tutto',
    J(diretta) === '[]' && direttaAdmin.length === ARCHIVIO.length, J([diretta.length, direttaAdmin.length]));
  const u = await chiamaCome(leggi, UTENTE, { Tariffa: ARCHIVIO });
  verifica('leggiTariffe chiesta da un utente semplice: le tre tariffe attive', u.stato === 200 && u.j.parte === 'attiva' && J(u.j.tariffe.map(t => t.id)) === J(ATTIVE), J(u.j));
  verifica('lette coi permessi del servizio, una volta', u.letture.length === 1 && u.letture[0].nome === 'Tariffa' && u.letture[0].servizio === true, J(u.letture));
  const a = await chiamaCome(leggi, AMMINISTRATORE, { Tariffa: ARCHIVIO });
  verifica('e dall\'amministratore: tutto', a.stato === 200 && a.j.parte === 'tutto' && a.j.tariffe.length === ARCHIVIO.length, J([a.stato, a.j.parte]));
  // Il riepilogo dell'attiva, che la Fatturazione chiede per chiunque: con
  // l'archivio chiuso il prezzo resta quello della tabella.
  const rie = await caricaConRegole('getRiepilogoEcotyre');
  const db = { ExtraRaccolta: INTERVENTI, Tariffa: ARCHIVIO, Fornitore: FORNITORI, PrimariaRete: [], PrimariaAci: [], DocumentoFatturazione: [], SurplusTariffa: [] };
  const r = await chiamaCome(rie, UTENTE, db, { anno: 2026, mese: 'Ottobre' });
  const extra = ((r.j && r.j.tipologie) || []).find(t => t.tipologia === 'EXTRA_RACCOLTA') || {};
  verifica('il riepilogo dell\'attiva chiesto da un utente semplice: l\'extra raccolta a 210 €/t, 210,00 €, come la tabella', r.stato === 200 && extra.totale === 210, J([r.stato, extra.totale, r.j && r.j.error]));
  verifica('e Tariffa la legge coi permessi del servizio', r.letture.filter(l => l.nome === 'Tariffa').every(l => l.servizio === true) && r.letture.some(l => l.nome === 'Tariffa'), J(r.letture));
});

const { caricaPagina, clienteFinto, aspetta, trova, testo } = await import('./dati/paginaFinta.mjs');

await sezione('7. LA LIBRERIA DELLE PAGINE: src/lib/leggiTariffe.js', async () => {
  const { modulo } = await caricaPagina('lib/leggiTariffe');
  const V = await import('../base44/shared/tariffeVisibili.ts');
  const c = clienteFinto({ archivi: { Tariffa: [] }, funzioni: { leggiTariffe: async () => ({ ok: true, parte: 'attiva', tariffe: V.tariffePerChiLegge(ARCHIVIO, false) }) } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const t = await modulo.leggiTariffe();
  verifica('restituisce chi chiede e l\'elenco della funzione', t && t.parte === 'attiva' && Array.isArray(t.tariffe) && t.tariffe.length === 3, J(t));
  verifica('con una chiamata sola alla funzione, e nessuna lettura dell\'archivio', c.funzioniChiamate('leggiTariffe').length === 1 && c.letture('Tariffa').length === 0);
  const prova = async (risposta) => {
    globalThis.__CLIENTE_FINTO = clienteFinto({ funzioni: risposta ? { leggiTariffe: risposta } : {} }).cliente;
    try { await modulo.leggiTariffe(); return null; } catch (e) { return e; }
  };
  const muta = await prova(null);
  verifica('una risposta senza elenco e\' un errore, non «nessuna tariffa»', !!muta && /non si sono potute leggere/.test(muta.message), String(muta && muta.message));
  verifica('anche una risposta che non dice chi chiede', !!(await prova(async () => ({ ok: true, tariffe: [] }))));
  verifica('e una funzione che non risponde arriva alla pagina come errore', !!(await prova(async () => { throw new Error('limite di richieste'); })));
});

// ─── La pagina Extra Raccolta, montata senza browser (prove/dati/paginaFinta.mjs) ───
const IMPORT_PERMESSI = "import { usePermessi } from '@/lib/permessi';";
const IMPORT_FILE = "import { exportExtraRaccoltaExcel, exportExtraRaccoltaPDF } from '@/lib/extraRaccoltaExport';";
const cartella = mkdtempSync(join(tmpdir(), 'tariffe-riservate-'));
// La cartella delle copie delle pagine si toglie alla fine, anche se la prova
// cade a meta' (l'evento exit arriva anche dopo un errore non preso): prima
// ne restava una nella cartella temporanea a ogni giro (chiusura del 15/10/2026).
const togliCartella = () => rmSync(cartella, { recursive: true, force: true });
process.on('exit', togliCartella);
const riquadro = (r, titolo) => trova(r.albero, el => el.type === 'div' && /border rounded-lg p-3 bg-card/.test(el.props.className || '') && testo(el).startsWith(titolo))[0];

await sezione('8. L\'EXTRA RACCOLTA CON L\'ARCHIVIO CHIUSO: I RICAVI DELLA FATTURA PER TUTTI, I COSTI SOLO ALL\'AMMINISTRATORE', async () => {
  const V = await import('../base44/shared/tariffeVisibili.ts');
  const { calcolaRigheAttiva } = await import('../base44/shared/attivaCalcolo.ts');
  const { euro } = await import('../src/lib/formatoSoldi.js');
  const pagina = sorgente('src/pages/ExtraRaccolta.jsx');
  verifica('la copia della pagina si fa come la prova si aspetta', pagina.includes(IMPORT_PERMESSI) && pagina.includes(IMPORT_FILE));
  // La fattura di ottobre, che il server calcola con asServiceRole: 210,00.
  const fattura = calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll: INTERVENTI, fornitori: FORNITORI, tariffe: ARCHIVIO.filter(t => t.direzione === 'ATTIVA'), anno: 2026, mese: 'Ottobre', surplus: [] });
  const inFattura = euro(fattura.righe.EXTRA_RACCOLTA.reduce((s, r) => s + r.totale, 0));
  const monta = async (admin, { rompi = false, appesa = false } = {}) => {
    const copia = join(cartella, `ExtraRaccolta-${admin ? 'admin' : 'utente'}.jsx`);
    writeFileSync(copia, pagina.replace(IMPORT_PERMESSI, `const usePermessi = () => ({ isAdmin: ${admin}, soloLettura: ${!admin} });`)
      .replace(IMPORT_FILE, 'const exportExtraRaccoltaExcel = async () => {};\nconst exportExtraRaccoltaPDF = async () => {};'));
    const p = await caricaPagina('pages/ExtraRaccolta', { file: copia });
    // L'archivio chiuso come lo chiude la piattaforma: a chi non e' amministratore
    // la lettura diretta restituisce un elenco vuoto, senza errore. La funzione
    // risponde con le regole vere (tariffeVisibili.ts).
    const risposte = [];
    // Mentre la funzione delle tariffe risponde, le altre letture devono essere
    // gia' partite: qui si guarda chi e' gia' stato chiesto.
    const insieme = [];
    const c = clienteFinto({
      archivi: { ExtraRaccolta: INTERVENTI, Tariffa: admin ? ARCHIVIO : [], Fornitore: FORNITORI, SurplusTariffa: [] },
      funzioni: {
        leggiSurplus: async () => ({ ok: true, parte: admin ? 'tutto' : 'attiva', surplus: [] }),
        leggiTariffe: async () => {
          await aspetta(5);
          insieme.push({ surplus: c.funzioniChiamate('leggiSurplus').length, fornitori: c.letture('Fornitore').length });
          if (appesa) await new Promise(() => {});
          if (rompi) throw new Error('limite di richieste');
          const x = { ok: true, parte: admin ? 'tutto' : 'attiva', tariffe: V.tariffePerChiLegge(ARCHIVIO, admin) };
          risposte.push(x);
          return x;
        },
      },
    });
    globalThis.__CLIENTE_FINTO = c.cliente;
    const r = p.monta(p.Componente, {});
    await aspetta(60);
    const scegli = async (i, v) => { trova(r.albero, el => el.type && el.type.__finto === 'Select')[i].props.onValueChange(v); await aspetta(20); };
    await scegli(0, '2026');
    await scegli(1, 'Ottobre');
    return { c, r, risposte, insieme, t: testo(r.albero), schede: trova(r.albero, 'ExtraRaccoltaForm') };
  };
  const u = await monta(false);
  verifica('la pagina di chi non e\' amministratore si monta senza errori', u.r.errori.length === 0, String(u.r.errori[0] || ''));
  verifica('le tariffe le chiede alla funzione, una volta, e l\'archivio non lo legge', u.c.funzioniChiamate('leggiTariffe').length === 1 && u.c.letture('Tariffa').length === 0,
    J([u.c.funzioniChiamate('leggiTariffe').length, u.c.letture('Tariffa')]));
  const ricaviU = testo(riquadro(u.r, 'Ricavi'));
  verifica(`i ricavi sono quelli della fattura, con la tariffa della tabella: ${inFattura} (210 €/t, non la base di 202)`, inFattura === '€ 210,00' && ricaviU.includes(inFattura), `${ricaviU} / fattura ${inFattura}`);
  verifica('nessun avviso di tariffe non lette', !u.t.includes('non si sono potuti leggere'), '');
  // Le tariffe ora vengono da una funzione, come i surplus: una dopo l'altra la
  // pagina aspettava la somma dei tempi. Partono insieme ai fornitori e ai surplus.
  verifica('le tariffe, i fornitori e i surplus si chiedono insieme, non uno dopo l\'altro', J(u.insieme) === J([{ surplus: 1, fornitori: 1 }]), J(u.insieme));
  verifica('la scheda dell\'intervento non c\'e\': non si monta, e non riceve prezzi dei fornitori', u.schede.length === 0);
  verifica('e nella risposta che ha ricevuto non c\'e\' niente dei fornitori', u.risposte.length === 1 && !J(u.risposte).includes('PASSIVA') && !J(u.risposte).includes('EMMESSE') && !J(u.risposte).includes('sconto riservato'));
  verifica('i costi non si vedono', !riquadro(u.r, 'Costi'));

  const a = await monta(true);
  verifica('la pagina dell\'amministratore si monta senza errori', a.r.errori.length === 0, String(a.r.errori[0] || ''));
  verifica('anche lui passa dalla funzione, una volta, e l\'archivio non lo legge: chi e\' amministratore lo decide il server',
    a.c.funzioniChiamate('leggiTariffe').length === 1 && a.c.letture('Tariffa').length === 0, J([a.c.funzioniChiamate('leggiTariffe').length, a.c.letture('Tariffa')]));
  verifica(`gli stessi ricavi: ${inFattura}`, testo(riquadro(a.r, 'Ricavi')).includes(inFattura), testo(riquadro(a.r, 'Ricavi')));
  // Costi: A 72 + 90 a tonnellata su 1 t, S 20 t x 30 €/t col contratto della tratta.
  const costi = testo(riquadro(a.r, 'Costi'));
  verifica('i costi coi contratti dei trasporti delle secondarie: 162,00 + 600,00 = € 762,00', costi.includes('€ 762,00'), costi);
  verifica('la scheda c\'e\', una', a.schede.length === 1);
  const s = a.schede[0] ? a.schede[0].props : {};
  verifica('e riceve le passive dell\'extra raccolta, tutte e solo quelle', J((s.tariffePassive || []).map(t => t.id)) === J(['tp-emm']), J(s.tariffePassive));
  verifica('e il contesto coi contratti dei trasporti', !!s.contesto && J((s.contesto.trasporti || []).map(t => t.id)) === J(['tp-log']), J(s.contesto && s.contesto.trasporti));

  // Una lettura che cade si dice: un elenco vuoto non e' «nessuna tariffa».
  const ur = await monta(false, { rompi: true });
  verifica('se leggiTariffe non risponde, la pagina di chi non e\' amministratore lo dice', ur.t.includes('non si sono potuti leggere: i ricavi degli interventi senza prezzo scritto usano solo la base'), '');
  const ar = await monta(true, { rompi: true });
  verifica('e quella dell\'amministratore dice anche dei contratti dei trasporti', ar.t.includes('I contratti dei trasporti non si sono potuti leggere'), '');
  verifica('e la scheda riceve null, non un elenco vuoto', ar.schede[0] && ar.schede[0].props.tariffePassive === null, J(ar.schede[0] && ar.schede[0].props.tariffePassive));
  const inLettura = await monta(true, { appesa: true });
  verifica('finche\' la funzione non ha risposto la scheda riceve undefined: nessuna tariffa, e nessun avviso di lettura caduta',
    inLettura.schede[0] && inLettura.schede[0].props.tariffePassive === undefined && !inLettura.t.includes('non si sono potuti leggere'), J(inLettura.schede[0] && Object.keys(inLettura.schede[0].props)));

  // La scheda: propone il costo con le passive che riceve, e se non le ha lo dice.
  const f = await caricaPagina('components/fatturazione/ExtraRaccoltaForm');
  const scheda = async (tariffePassive) => {
    const c = clienteFinto({ archivi: { Fornitore: FORNITORI, Tariffa: [], ExtraRaccolta: [] } });
    globalThis.__CLIENTE_FINTO = c.cliente;
    const r = f.monta(f.Componente, { open: true, initial: iv('N', { stato: 'assegnato', trasportatore: '', costo_raccolta_t: 0, costo_trattamento_t: 0 }), contesto: s.contesto, interventi: [], tariffePassive, onSave: () => {}, onCancel: () => {} });
    await aspetta(40);
    const combo = trova(r.albero, el => el.type && el.type.name === 'ComboSelect' && Array.isArray(el.props.options) && el.props.options.some(o => (o && o.value ? o.value : o) === 'EMMESSE SRLS'))[0];
    if (combo) { combo.props.onChange('EMMESSE SRLS'); await aspetta(20); }
    return { c, r, t: testo(r.albero), combo };
  };
  const conTariffe = await scheda([ARCHIVIO.find(t => t.id === 'tp-emm')]);
  verifica('la scheda si monta senza errori e non legge Tariffa', conTariffe.r.errori.length === 0 && conTariffe.c.letture('Tariffa').length === 0, String(conTariffe.r.errori[0] || J(conTariffe.c.letture('Tariffa'))));
  verifica('scelto il raccoglitore, propone il suo costo dalla tariffa ricevuta', !!conTariffe.combo && conTariffe.t.includes('dalla tariffa di extra raccolta del fornitore'), conTariffe.combo ? '' : 'trasportatore non trovato');
  const senza = await scheda(null);
  verifica('senza le passive lo dice, e non propone niente', senza.t.includes('non si sono potute leggere: il modulo non propone i costi') && !senza.t.includes('dalla tariffa di extra raccolta del fornitore'), '');
  const attesa = await scheda(undefined);
  verifica('mentre la pagina le legge non dice che la lettura e\' caduta', attesa.r.errori.length === 0 && !attesa.t.includes('non si sono potute leggere'), '');
});

await sezione('9. LO STORICO DELLE MODIFICHE DELLE TARIFFE PASSIVE E\' DELL\'AMMINISTRATORE', async () => {
  // Lo storico (ModificaDato) tiene una copia campo per campo di ogni tariffa
  // scritta: le righe di una passiva nascono riservate (campoRiservato), e la
  // regola di lettura di ModificaDato le da' al solo amministratore (revisione
  // del 14/10/2026, prove/chiLeggeCosa.mjs sezione 10). Qui le scritture vere
  // della scheda delle tariffe (gestisciAnagrafiche sul banco).
  const { caricaFunzione, chiama } = await import('./dati/bancoFunzioni.mjs');
  const modulo = await caricaFunzione('gestisciAnagrafiche');
  let db = { Tariffa: [], Fornitore: FORNITORI, ModificaDato: [], SurplusTariffa: [] };
  const scrivi = async (corpo) => {
    const r = await chiama(modulo, { ruolo: 'admin', db, corpo: { entita: 'Tariffa', motivo: 'prova', ...corpo } });
    db = r.db;
    return r;
  };
  const periodo = { data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', stato: 'attivo' };
  const nata = await scrivi({ operazione: 'create', dati: { fornitore_id: 'F-EMM', fornitore_nome: 'EMMESSE SRLS', direzione: 'PASSIVA', tipologia: 'EXTRA_RACCOLTA', prestazione: 'RACCOLTA', unita_misura: '€/t', valore: 72, note: 'sconto riservato', ...periodo } });
  const idPassiva = nata.j && nata.j.result && nata.j.result.id;
  const cambiata = await scrivi({ operazione: 'update', id: idPassiva, dati: { valore: 75 } });
  const tolta = await scrivi({ operazione: 'delete', id: idPassiva });
  const attiva = await scrivi({ operazione: 'create', dati: { cliente: 'ECOTYRE', direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', unita_misura: '€/t', valore: 210, ...periodo } });
  const idAttiva = attiva.j && attiva.j.result && attiva.j.result.id;
  const righe = db.ModificaDato || [];
  const dellaPassiva = righe.filter(r => r.record_id === idPassiva);
  verifica('le scritture vere lasciano le loro righe: la passiva nata, cambiata e tolta, e l\'attiva', [nata, cambiata, tolta, attiva].every(r => r.stato === 200) && !!idPassiva && !!idAttiva
    && ['create', 'update', 'delete'].every(op => dellaPassiva.some(r => r.operazione === op)) && righe.some(r => r.record_id === idAttiva), J([nata, cambiata, tolta, attiva].map(r => [r.stato, r.j && r.j.error])));
  verifica('ogni riga della passiva e\' riservata, ogni riga dell\'attiva no', dellaPassiva.length > 0 && dellaPassiva.every(r => r.riservato === true)
    && righe.filter(r => r.record_id === idAttiva).every(r => r.riservato === false), J(righe.map(r => [r.record_id, r.campo, r.riservato])));
  const rls = ENTITA('ModificaDato').rls || {};
  const vede = (utente) => righe.filter(r => passaLaRegola(rls.read, r, utente));
  verifica('all\'amministratore lo storico intero', vede(AMMINISTRATORE).length === righe.length, `${vede(AMMINISTRATORE).length} di ${righe.length}`);
  const visibili = vede(UTENTE);
  const t = J(visibili);
  verifica('a chi non e\' amministratore nessuna riga della passiva: ne\' il prezzo, ne\' il fornitore, nemmeno quando cambia o si toglie',
    !visibili.some(r => r.record_id === idPassiva) && !t.includes('EMMESSE') && !/"(prima|dopo)":"7[25]"/.test(t), `${visibili.filter(r => r.record_id === idPassiva).length} righe della passiva`);
  verifica('e le righe dell\'attiva le vede, come prima', visibili.some(r => r.record_id === idAttiva && r.campo === 'valore' && r.dopo === '210'), t.slice(0, 300));
  verifica('la riga Storico nasconde ancora i costi a chi non e\' amministratore (se la regola un giorno si riaprisse)',
    /const visibili = \(righe \|\| \[\]\)\.filter\(r => isAdmin \|\| !r\.riservato\);/.test(sorgente('src/components/shared/StoricoModifiche.jsx')));
});

await sezione('10. SUI DATI VERI: LE TARIFFE DELLA PAGINA E I NUMERI SONO QUELLI DI PRIMA', async () => {
  const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
  const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
  if (!copie.length) { console.log(`  Nessuna copia dei dati veri in ${CARTELLA}: sezione saltata.`); return; }
  const copia = copie[copie.length - 1];
  const D = JSON.parse(gunzipSync(readFileSync(CARTELLA + copia)).toString('utf8'));
  const A = D.archivi;
  const V = await import('../base44/shared/tariffeVisibili.ts');
  const { calcolaRigheAttiva } = await import('../base44/shared/attivaCalcolo.ts');
  const { fetchAll } = await import('../base44/shared/fetchAll.ts');
  const calc = await import('../src/lib/extraRaccoltaCalc.js');
  const { giornoRoma } = await import('../src/lib/giornoItaliano.js');
  const { caricaLibPagine } = await import('./dati/libPagine.mjs');
  const subfornitori = await caricaLibPagine('lib/subfornitori');
  const fornitori = A.Fornitore || [];
  const archivio = A.Tariffa || [];
  // Come le leggeva la pagina prima, dal browser, e come le legge ora la
  // funzione (fetchAll con lo stesso ordinamento della pagina).
  const daArchivio = { list: async () => archivio.map(r => ({ ...r })), filter: async (f) => archivio.filter(r => Object.entries(f).every(([k, v]) => r[k] === v)).map(r => ({ ...r })) };
  const ordinate = await fetchAll(daArchivio, null, '-created_date');
  const prima = {
    attive: await fetchAll(daArchivio, { direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA' }, '-created_date'),
    trasporti: await fetchAll(daArchivio, { prestazione: 'TRASPORTO_SECONDARIA' }, '-created_date'),
    passiveExtra: await fetchAll(daArchivio, { direzione: 'PASSIVA', tipologia: 'EXTRA_RACCOLTA' }, '-created_date'),
  };
  // I filtri della pagina sulla risposta di leggiTariffe.
  const dellaPagina = (tariffe, parte) => ({
    attive: tariffe.filter(t => t.direzione === 'ATTIVA' && t.tipologia === 'EXTRA_RACCOLTA'),
    trasporti: parte === 'tutto' ? tariffe.filter(t => t.prestazione === 'TRASPORTO_SECONDARIA') : null,
    passiveExtra: parte === 'tutto' ? tariffe.filter(t => t.direzione === 'PASSIVA' && t.tipologia === 'EXTRA_RACCOLTA') : null,
  });
  const admin = dellaPagina(V.tariffePerChiLegge(ordinate, true), 'tutto');
  const utente = dellaPagina(V.tariffePerChiLegge(ordinate, false), 'attiva');
  const chiavi = (l) => J((l || []).map(t => [t.id, t.valore, t.unita_misura, t.data_inizio_validita, t.data_fine_validita, t.stato]));
  verifica('l\'amministratore riceve le stesse tariffe di prima, nello stesso ordine: attive, contratti dei trasporti e passive della scheda',
    J(admin.attive) === J(prima.attive) && J(admin.trasporti) === J(prima.trasporti) && J(admin.passiveExtra) === J(prima.passiveExtra));
  verifica('chi non e\' amministratore le stesse attive dell\'extra raccolta, nello stesso ordine', chiavi(utente.attive) === chiavi(prima.attive) && utente.attive.length === prima.attive.length, chiavi(utente.attive));
  verifica('e niente dei fornitori, da nessuna parte', utente.trasporti === null && utente.passiveExtra === null && !V.tariffePerChiLegge(ordinate, false).some(t => t.direzione !== 'ATTIVA'));
  const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  let uguali = true, mesiConInterventi = 0;
  const righe = [];
  for (let m = 0; m < 12; m++) {
    const dati = { reteAll: A.PrimariaRete || [], aciAll: A.PrimariaAci || [], extraAll: A.ExtraRaccolta || [], fornitori, anno: 2026, mese: MESI[m], surplus: [] };
    // La fattura, che il server fa con asServiceRole, e la stessa con la sola
    // parte attiva che riceve chi non e' amministratore: i tre canali.
    const fattura = calcolaRigheAttiva({ ...dati, tariffe: archivio.filter(t => t.direzione === 'ATTIVA') });
    const conParte = calcolaRigheAttiva({ ...dati, tariffe: V.tariffePerChiLegge(ordinate, false) });
    for (const c of ['RETE', 'ACI', 'EXTRA_RACCOLTA']) {
      if (J(fattura.righe[c]) !== J(conParte.righe[c])) { uguali = false; console.log(`    ${MESI[m]} ${c}: le righe della fattura cambiano con la sola parte attiva`); }
    }
    // La pagina dell'extra raccolta: prima (lettura diretta) e ora, per
    // l'amministratore e per gli altri; i ricavi devono essere quelli della fattura.
    const delMese = (A.ExtraRaccolta || []).filter(r => String(r.stato || '').toLowerCase().trim() === 'terminato' && giornoRoma(r.trasporto_finito_il).slice(0, 7) === `2026-${String(m + 1).padStart(2, '0')}`);
    const contesto = (x, trasporti) => calc.conViaggi(calc.contestoPrezzi(x, fornitori, [], subfornitori, trasporti), A.ExtraRaccolta || []);
    const pPrima = calc.totaliExtraRaccolta(delMese, contesto(prima.attive, prima.trasporti));
    const pAdmin = calc.totaliExtraRaccolta(delMese, contesto(admin.attive, admin.trasporti));
    const pUtente = calc.totaliExtraRaccolta(delMese, contesto(utente.attive, null));
    const ricavoFattura = Math.round((fattura.righe.EXTRA_RACCOLTA.reduce((s, r) => s + (Number(r.totale) || 0), 0) + Number.EPSILON) * 100) / 100;
    if (J(pPrima) !== J(pAdmin) || pUtente.ricavi !== pPrima.ricavi || pUtente.ricavi !== ricavoFattura) {
      uguali = false;
      console.log(`    ${MESI[m]} extra raccolta: prima ${pPrima.ricavi}/${pPrima.costi}, amministratore ${pAdmin.ricavi}/${pAdmin.costi}, altri ${pUtente.ricavi}, fattura ${ricavoFattura}`);
    }
    if (delMese.length) { mesiConInterventi++; righe.push(`${MESI[m]}: ${delMese.length} interventi, ricavi ${pUtente.ricavi}, costi ${pAdmin.costi} (fattura ${ricavoFattura})`); }
  }
  verifica('ogni mese del 2026: la fattura sui tre canali e la pagina dell\'extra raccolta, amministratore o no, dicono i numeri di prima', uguali);
  verifica('e l\'extra raccolta ha davvero dei mesi da confrontare', mesiConInterventi > 0, String(mesiConInterventi));
  console.log(`  Copia ${copia}: ${archivio.length} tariffe (${utente.attive.length} attive dell'extra raccolta), ${mesiConInterventi} mesi dell'extra raccolta confrontati`);
  for (const x of righe) console.log(`    ${x}`);
});

togliCartella();
verifica('la cartella temporanea delle copie delle pagine non resta', !existsSync(cartella), cartella);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
