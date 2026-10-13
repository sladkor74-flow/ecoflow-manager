// ECOTYNA E LA CLASSE DELL'ALBO CONTRO IL TARGET (revisione del 13/10/2026).
//
// Lo strumento qualifica_fornitori di EcoTyna chiamava statoRequisito sui
// documenti salvati, senza il controllo della classe che il modulo Qualifica
// Fornitori fa prima (applicaControlloClasse, base44/shared/classeAlbo.ts): per
// un'iscrizione in classe F con un target da 3.200 t EcoTyna diceva «valido» e
// il modulo «non conforme». Si controlla:
//   1. che lo strumento dica non conforme, col motivo, dove la classe non copre
//      il target, e valido dove lo copre o il soggetto non ha target;
//   2. che dica lo stesso stato della funzione vera del modulo
//      (qualificaFornitori, sul banco con l'SDK finto), sugli stessi archivi;
//   3. che le letture in piu' siano due per domanda, non una per soggetto;
//   4. che se i target non si leggono lo dica, invece di tacere il controllo.
// node prove/ecotynaQualificaClasse.mjs
import { STRUMENTI } from '../base44/shared/strumentiAssistente.ts';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (v) => String(JSON.stringify(v)).slice(0, 600);

const ALBO = 'Iscrizione Albo Nazionale Gestori Ambientali';
const conLettura = (categorie) => JSON.stringify({ lettura: { leggibile: true, tipo_documento: 'Provvedimento di iscrizione all\'Albo Nazionale Gestori Ambientali', categorie_albo: categorie } });
const doc = (id, nome, chiave, categorie) => ({
  id, soggetto_nome: nome, soggetto_chiave: chiave, tipo_documento_id: 't-albo', tipo_documento_nome: ALBO, stato: 'attivo',
  analisi_stato: 'completata', analisi_json: conLettura(categorie), problemi_json: '[]', data_emissione: '2025-03-16', data_scadenza: '2029-03-16',
});
const CATALOGO = [{ id: 't-albo', nome: ALBO, obbligatorio: true, preavviso_giorni: 60, tipo_scadenza: 'da_documento', attivo: true, si_applica_a: 'raccolta' }];
const DOCUMENTI = [
  doc('d1', 'GREEN TYRE PROJECT SRL', 'green tyre project', ['Categoria 4 classe F']),   // 3.200 t su una F: non conforme
  doc('d2', 'EMMESSE SRL', 'emmesse', ['Categoria 4 classe E']),                          // 2.000 t su una E: valido
  doc('d3', 'IMPIANTO SRL', 'impianto', ['Categoria 4 classe F']),                         // nessun target: valido
];
const TARGET = [
  { id: 'tr1', anno: 2026, raccoglitore: 'Green Tyre Project', target_tonnellate: 3200 },
  { id: 'tr2', anno: 2026, raccoglitore: 'Emmesse', target_tonnellate: 2000 },
];

// Un archivio finto che conta le letture per archivio, e che puo' rompersi.
function archivio(db, { guasti = [] } = {}) {
  const letture = {};
  const conta = (e) => { letture[e] = (letture[e] || 0) + 1; if (guasti.includes(e)) throw new Error('lettura di ' + e + ' non riuscita'); };
  const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
  const entities = new Proxy({}, { get: (_t, nome) => {
    const e = String(nome);
    return {
      filter: async (f, _o, n = 5000, s = 0) => { conta(e); return (db[e] || []).filter(r => uguale(r, f)).slice(s, s + n); },
      list: async (_o, n = 5000, s = 0) => { conta(e); return (db[e] || []).slice(s, s + n); },
    };
  } });
  return { base44: { asServiceRole: { entities } }, letture };
}
const qualifica = STRUMENTI.find(s => s.nome === 'qualifica_fornitori');
const esegui = (db, opzioni) => { const a = archivio(db, opzioni); return qualifica.esegui(a.base44, { anno: 2026 }).then(r => ({ r, letture: a.letture })); };
const soggetto = (r, nome) => r.dati.soggetti.righe.find(s => s.soggetto === nome) || {};

console.log('1. LA CLASSE CONTRO IL TARGET, NELLO STRUMENTO');
const DB = { TipoDocumentoQualifica: CATALOGO, DocumentoQualifica: DOCUMENTI, TargetRaccoglitore: TARGET, TargetMensile: [] };
const { r, letture } = await esegui(DB);
{
  const gt = soggetto(r, 'GREEN TYRE PROJECT SRL');
  verifica('classe F con 3.200 t di target: non conforme, non valido', gt.non_conformi === 1 && gt.validi === 0, J(gt));
  const det = (gt.dettaglio || [])[0] || {};
  verifica('...e il motivo e\' quello della scheda: il target supera il limite della classe F', det.stato === 'non_conforme' && (det.motivi || []).some(m => /supera il limite della classe F/.test(m) && /3\.200/.test(m)), J(det));
  const em = soggetto(r, 'EMMESSE SRL');
  verifica('classe E con 2.000 t: valido', em.validi === 1 && em.non_conformi === 0, J(em));
  const imp = soggetto(r, 'IMPIANTO SRL');
  verifica('chi non ha target non ha il controllo della classe: valido', imp.validi === 1 && imp.non_conformi === 0, J(imp));
  verifica('la nota dice che la classe si confronta col target', /La classe dell'iscrizione all'Albo si confronta col target PFU dell'anno, come nel modulo/.test(r.dati.nota || ''), J(r.dati.nota));
  verifica('con i target letti nessun avviso di controllo non eseguito', !r.dati.controllo_classe_non_eseguito);
}

console.log('2. LO STESSO STATO DEL MODULO QUALIFICA FORNITORI');
{
  // Il modulo prende i raccoglitori dai movimenti dell'anno: un terminato per
  // ciascuno dei due raccoglitori con target, e l'impianto come destinazione.
  const mov = (id, trasp, giorno) => ({ id, id_ordine: 'ET' + id, numero_fir: 'FIR' + id, stato: 'terminato', trasportatore: trasp, destinazione: 'IMPIANTO SRL', tipo_destinazione: 'tratt', peso_effettivo: 1000, trasporto_finito_il: giorno + 'T10:00:00Z' });
  const dbModulo = { ...DB, PrimariaRete: [mov('m1', 'GREEN TYRE PROJECT SRL', '2026-05-05'), mov('m2', 'EMMESSE SRL', '2026-05-06')] };
  const funzione = await caricaFunzione('qualificaFornitori');
  const esito = await chiama(funzione, { db: JSON.parse(JSON.stringify(dbModulo)), corpo: { anno: 2026 } });
  const statoModulo = (chiave) => {
    const s = ((esito.j && esito.j.soggetti) || []).find(x => x.chiave === chiave);
    const q = s && (s.requisiti || []).find(x => x.tipo_id === 't-albo');
    return q && q.stato;
  };
  verifica('il modulo risponde', esito.stato === 200 && Array.isArray(esito.j && esito.j.soggetti), J(esito.j).slice(0, 300));
  const gt = soggetto(r, 'GREEN TYRE PROJECT SRL');
  verifica('Green Tyre: il modulo dice non conforme, e ora anche EcoTyna', statoModulo('green tyre project') === 'non_conforme' && gt.non_conformi === 1, J({ modulo: statoModulo('green tyre project'), ecotyna: gt }));
  verifica('Emmesse: valido per tutti e due', statoModulo('emmesse') === 'valido' && soggetto(r, 'EMMESSE SRL').validi === 1, J({ modulo: statoModulo('emmesse') }));
}

console.log('3. NESSUNA LETTURA PER SOGGETTO');
{
  verifica('i target si leggono una volta ciascuno', letture.TargetRaccoglitore === 1 && letture.TargetMensile === 1, J(letture));
  const tanti = { ...DB, DocumentoQualifica: Array.from({ length: 40 }, (_, i) => doc('x' + i, `RACCOGLITORE ${i} SRL`, `raccoglitore ${i}`, ['Categoria 4 classe F'])), TargetRaccoglitore: Array.from({ length: 40 }, (_, i) => ({ id: 't' + i, anno: 2026, raccoglitore: `Raccoglitore ${i}`, target_tonnellate: 3500 })) };
  const molti = await esegui(tanti);
  const totale = (l) => Object.values(l).reduce((s, n) => s + n, 0);
  verifica('quaranta soggetti: le stesse letture di tre', totale(molti.letture) === totale(letture), J({ tre: letture, quaranta: molti.letture }));
  verifica('...e tutti e quaranta non conformi', molti.r.dati.soggetti.righe.length === 40 && molti.r.dati.soggetti.righe.every(s => s.non_conformi === 1), J(molti.r.dati.soggetti.righe.slice(0, 2)));
}

console.log('4. TARGET NON LETTI: SI DICE');
{
  const rotto = await esegui(DB, { guasti: ['TargetRaccoglitore'] });
  verifica('lo strumento risponde lo stesso', rotto.r && rotto.r.dati && rotto.r.dati.soggetti.righe.length === 3);
  verifica('e dice che il controllo della classe non e\' stato fatto', /la classe dell'iscrizione all'Albo non e' stata confrontata col target/.test(rotto.r.dati.controllo_classe_non_eseguito || ''), J(rotto.r.dati.controllo_classe_non_eseguito));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
