// Prova dei CONTRATTI DELL'ANNO PER CANALE (base44/functions/contrattiAnno e
// base44/shared/contrattiDellAnno.ts, giro K3 delle segnalazioni del 20/09,
// corretto il 12/10/2026).
//
// Tre difetti veri sul codice dell'11/10/2026:
// - A69: i contratti si facevano solo sulla rete (const canale = 'RETE'). Decisione
//   dell'utente dell'11/10/2026: «si deve generare tutti i contratti sia rete che
//   aci come raccolta, trattamento e stoccaggio». Ora una riga per canale, ricavata
//   dai movimenti, col suo modello e i suoi valori: rete e ACI mai sommati. Il
//   prezzo dalla tariffa passiva di quel canale valida nell'anno, la quantita' dal
//   target (che e' della rete): sull'ACI resta da scrivere, mai zero;
// - A70: l'anno prima si guardava solo se l'anno chiesto non aveva nessun
//   soggetto. Un'inclusione manuale nel 2027 bastava a far sparire tutti gli altri,
//   e con loro i contratti 2027 gia' generati. Ora l'unione: soggetti dell'anno,
//   dell'anno prima finche' l'anno chiesto non e' finito, e chi ha un contratto;
// - A68 (= A89): la funzione non mandava i valori del contratto dell'anno, e
//   riaprendolo la pagina ripartiva da quelli dell'anno prima. Ora li manda (solo
//   all'amministratore: dentro ci sono i prezzi) e la pagina parte da quelli.
// Qui la funzione intera, con l'archivio finto di prove/dati/bancoFunzioni.mjs.
//
// Revisione del 13/10/2026, quattro rilievi:
// - A70 a gennaio: dal 1° gennaio l'anno chiesto e' quello in corso, e tutti i
//   fornitori dell'anno prima senza ancora un viaggio diventavano «da decidere»
//   (sui dati veri, guardati l'08/01/2027: 3 contratti attesi invece di 33). Ora
//   dal 1° gennaio al 31 marzo chi ha lavorato nell'ultimo trimestre dell'anno
//   prima, per quella prestazione e su quel canale, e' atteso;
// - le tariffe copiate da «Prepara l'anno» (daConfermare) diventavano il prezzo
//   proposto del contratto nuovo, cioe' il prezzo dell'anno prima: ora sono un
//   riferimento con l'avviso, e i target copiati portano lo stesso avviso;
// - CONTRIBUTO_NON_CONCORRENZA, un prezzo che non comincia per CORRISPETTIVO_,
//   passava dal contratto dell'anno prima a quello nuovo.
//
// Revisione della revisione, sempre del 13/10/2026 (gruppo R3a):
// - il prezzo unico (Green Tyre ACI) e' un fatto di struttura: la raccolta lo
//   dice anche quando le tariffe dell'anno sono solo copie o mancano, perche' il
//   trattamento continua a dire «sta nel contratto di raccolta»;
// - una copia di «Prepara l'anno» riscritta a mano col prezzo nuovo (72 al posto
//   del 70 del 2026) e non ancora confermata e' il prezzo dell'anno: si propone,
//   con l'avviso «scritta per il … ma ancora segnata da confermare», e non e'
//   piu' detta «copiata dal 2026»;
// - il cellulare, la pec e il referente (FORNITORE_TEL_2, FORNITORE_EMAIL_2,
//   FORNITORE_REFERENTE) vengono dal contratto dell'anno prima o dall'anagrafica
//   quando ci sono, mai inventati, e lo stesso recapito non si scrive due volte.
// node prove/contrattiCanali.mjs
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';
import { valoriDiPartenza, valoriDelContratto as valoriDelContrattoPagina } from '../src/lib/segnapostiContratto.js';
import { valoriDelContratto } from '../base44/shared/segnapostiContratto.ts';
import { situazioneContratti } from '../base44/shared/contrattiDellAnno.ts';
import { individuaSoggetti } from '../base44/shared/qualificaFornitori.ts';
import { copiaTariffa, pianoCopiaTariffe } from '../base44/shared/inizializzazioneAnno.ts';
import { conNotaCopia, notaCopia } from '../base44/shared/annoTarget.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const modulo = await caricaFunzione('contrattiAnno');
const annoOggi = Number(new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }).slice(0, 4));

let n = 0;
const mov = (trasportatore, destinazione, td, g) => ({
  id: 'm' + (++n), id_ordine: 'O' + n, stato: 'terminato', classe: 'P', provincia: 'BA', trasportatore, destinazione, tipo_destinazione: td,
  peso_effettivo: 10000, ordine_immesso_il: g + 'T08:00:00Z', trasporto_iniziato_il: g + 'T08:00:00Z', trasporto_finito_il: g + 'T10:00:00Z',
  // chiuso a gennaio dell'anno dopo: conta la fine trasporto (regola 1)
  ordine_chiuso_il: `${Number(g.slice(0, 4)) + 1}-01-15T10:00:00Z`,
});
const tariffa = (fornitore_nome, prestazione, tipologia, valore, da, a, extra = {}) => ({
  id: 't' + (++n), fornitore_nome, direzione: 'PASSIVA', prestazione, tipologia, valore, unita_misura: '€/t',
  data_inizio_validita: da, data_fine_validita: a, stato: 'attivo', ...extra,
});
const base = (extra) => ({
  PrimariaRete: [], PrimariaAci: [], ExtraRaccolta: [], Secondaria: [], Fornitore: [], QualificaInclusione: [],
  ContrattoFornitore: [], ModelloContratto: [], ImpiantoTargetSecondaria: [], TargetRaccoglitore: [], Tariffa: [], ...extra,
});
const soggetto = (j, chiave) => (j.soggetti || []).find(s => s.chiave === chiave);
const riga = (j, chiave, tipo, canale) => (soggetto(j, chiave)?.contratti || []).find(c => c.tipo === tipo && c.canale === canale);

const A = annoOggi; // l'anno in corso: le regole dell'anno prima dipendono da oggi
console.log(`A69 - RETE E ACI, DUE CONTRATTI DISTINTI (anno ${A})`);
const g = `${A}-03-10`;
const db69 = base({
  PrimariaRete: [mov('GATIM S.R.L.', 'IRIGOM SRL', 'imp', g), mov('NAPPI SUD SRL', 'NAPPI SUD SRL', 'stoc', g)],
  PrimariaAci: [mov('GATIM S.R.L.', 'TECNOGUM SRL', 'imp', g), mov('EMMESSE SRLS', 'NAPPI SUD SRL', 'stoc', g)],
  Fornitore: [
    { id: 'f-gatim', ragione_sociale: 'GATIM S.R.L.', piva: '02015210798', indirizzo: 'Z.I. Papa Benedetto XVI c.14', cap: '88046', comune: 'Lamezia Terme', provincia: 'CZ' },
    { id: 'f-tecno', ragione_sociale: 'TECNOGUM SRL', trattamento_fatturato_da_ecotyre: true },
  ],
  TargetRaccoglitore: [{ id: 'tr1', raccoglitore: 'GATIM S.R.L.', regione: 'Calabria', target_tonnellate: 300, anno: A }],
  Tariffa: [
    tariffa('GATIM S.R.L.', 'RACCOLTA', 'RETE', 70, `${A}-01-02`, `${A}-12-31`),
    tariffa('GATIM S.R.L.', 'RACCOLTA', 'ACI', 90, `${A}-01-02`, `${A}-12-31`),
    tariffa('GATIM S.R.L.', 'RACCOLTA', 'RETE', 65, `${A - 1}-01-02`, `${A - 1}-12-31`),
    tariffa('GATIM S.R.L.', 'RACCOLTA', 'ACI', 999, `${A}-01-02`, `${A}-12-31`, { stato: 'non_attivo' }),
    tariffa('TECNOGUM SRL', 'TRATTAMENTO', 'ACI', 95, `${A}-01-02`, `${A}-12-31`),
  ],
  ModelloContratto: [
    { id: 'mod-r-rete', nome: 'Raccolta rete', tipo_contratto: 'raccolta', canale: 'RETE', stato: 'attivo', file_uri: 'privato://modello-rete' },
    { id: 'mod-r-aci', nome: 'Raccolta ACI', tipo_contratto: 'raccolta', canale: 'ACI', stato: 'attivo', file_uri: 'privato://modello-aci' },
  ],
});
const c69 = await chiama(modulo, { db: db69, corpo: { anno: A } });
verifica('la funzione risponde', c69.stato === 200, JSON.stringify(c69.j).slice(0, 300));
const rr = riga(c69.j, 'gatim', 'raccolta', 'RETE');
const ra = riga(c69.j, 'gatim', 'raccolta', 'ACI');
verifica('GATIM raccoglie su rete e ACI: due contratti di raccolta', !!rr && !!ra, JSON.stringify(soggetto(c69.j, 'gatim')?.contratti?.map(c => c.tipo + '/' + c.canale)));
verifica('ognuno col modello del suo canale', rr?.modello_id === 'mod-r-rete' && ra?.modello_id === 'mod-r-aci', `${rr?.modello_id} ${ra?.modello_id}`);
verifica('il prezzo dalla tariffa passiva del suo canale e dell\'anno (70 rete, 90 ACI; non la disattivata, non quella dell\'anno prima)',
  rr?.proposta?.valori?.CORRISPETTIVO_RACCOLTA === 70 && ra?.proposta?.valori?.CORRISPETTIVO_RACCOLTA === 90,
  `${rr?.proposta?.valori?.CORRISPETTIVO_RACCOLTA} ${ra?.proposta?.valori?.CORRISPETTIVO_RACCOLTA}`);
verifica('la tariffa dell\'anno prima e\' solo un riferimento', (rr?.proposta?.tariffe_anno_prima || []).some(t => t.valore === 65), JSON.stringify(rr?.proposta?.tariffe_anno_prima));
verifica('la quantita\' della rete dal target (300 t)', rr?.proposta?.valori?.TARGET_TON === 300 && rr?.target_t === 300, JSON.stringify(rr?.proposta?.valori));
verifica('sull\'ACI il target non c\'e\': la quantita\' resta da scrivere, mai zero', ra?.target_t === null && ra?.proposta?.valori?.TARGET_TON === undefined
  && (ra?.proposta?.avvisi || []).some(a => /ACI.*target/i.test(a)), JSON.stringify(ra?.proposta));
verifica('i dati del fornitore dall\'anagrafica', rr?.proposta?.valori?.FORNITORE_PIVA === '02015210798' && /Lamezia Terme \(CZ\)/.test(rr?.proposta?.valori?.FORNITORE_SEDE_LEGALE || ''));
verifica('le date di validita\' 02/01-31/12 dell\'anno', rr?.proposta?.valori?.DATA_INIZIO === `${A}-01-02` && rr?.proposta?.valori?.DATA_FINE === `${A}-12-31`);
verifica('trattamento ACI per l\'impianto che riceve ACI (TECNOGUM), col prezzo ACI', riga(c69.j, 'tecnogum', 'trattamento', 'ACI')?.proposta?.valori?.CORRISPETTIVO_TRATTAMENTO === 95,
  JSON.stringify(riga(c69.j, 'tecnogum', 'trattamento', 'ACI')?.proposta?.valori));
verifica('stoccaggio rete e stoccaggio ACI per il piazzale che stocca tutti e due', !!riga(c69.j, 'nappi sud', 'stoccaggio', 'RETE') && !!riga(c69.j, 'nappi sud', 'stoccaggio', 'ACI'));
verifica('raccolta ACI per chi raccoglie solo ACI, senza una raccolta di rete', !!riga(c69.j, 'emmesse', 'raccolta', 'ACI') && !riga(c69.j, 'emmesse', 'raccolta', 'RETE'));
verifica('mai un contratto di extra raccolta', (c69.j.soggetti || []).every(s => s.contratti.every(c => c.canale === 'RETE' || c.canale === 'ACI')));
// GATIM raccolta rete e ACI, IRIGOM trattamento rete, NAPPI SUD raccolta rete e
// stoccaggio rete e ACI, TECNOGUM trattamento ACI, EMMESSE raccolta ACI: otto.
const conti69 = (c69.j.soggetti || []).flatMap(s => s.contratti).filter(c => !c.da_decidere && !c.non_dovuto).length;
verifica('i contratti attesi contano ogni canale a parte', c69.j.totali?.attesi === conti69 && conti69 === 8, `${JSON.stringify(c69.j.totali)} righe ${conti69}`);

console.log('I PREZZI SOLO ALL\'AMMINISTRATORE, IL FILE A NESSUNO');
const c69u = await chiama(modulo, { db: { ...db69, ContrattoFornitore: [{ id: 'k1', anno: A, soggetto_chiave: 'gatim', soggetto_nome: 'GATIM S.R.L.', tipo_contratto: 'raccolta', canale: 'ACI', stato: 'generato', file_uri: 'privato://contratto', valori_json: JSON.stringify({ CORRISPETTIVO_RACCOLTA: 90 }) }] }, ruolo: 'user', corpo: { anno: A } });
const ru = riga(c69u.j, 'gatim', 'raccolta', 'ACI');
verifica('chi non e\' amministratore vede lo stato, non i valori ne\' la proposta', ru?.stato === 'generato' && !ru?.proposta && ru?.contratto && ru.contratto.valori === undefined, JSON.stringify(ru));
verifica('il riferimento al file non esce dalla funzione', !JSON.stringify(c69u.j).includes('privato://'), JSON.stringify(c69u.j).match(/.{60}privato:\/\/.{20}/)?.[0]);

console.log('NON DOVUTI E DA DECIDERE');
const cNd = await chiama(modulo, { db: { ...db69, PrimariaRete: [...db69.PrimariaRete, mov('GATIM S.R.L.', 'TECNOGUM SRL', 'imp', g)] }, corpo: { anno: A } });
const tnd = riga(cNd.j, 'tecnogum', 'trattamento', 'RETE');
verifica('Tecnogum, trattamento di rete: lo paga Ecotyre, non e\' un contratto di SMOCO e non si conta',
  tnd?.non_dovuto === true && /Ecotyre/.test(tnd?.motivo_non_dovuto || '') && cNd.j.totali.attesi === c69.j.totali.attesi, `${JSON.stringify(tnd)} ${JSON.stringify(cNd.j.totali)}`);
const cDd = await chiama(modulo, { db: { ...db69, PrimariaRete: [...db69.PrimariaRete, mov('BS ECOSERVIZI SRL', 'IRIGOM SRL', 'imp', `${A - 1}-05-10`)] }, corpo: { anno: A } });
const dd = riga(cDd.j, 'bs ecoservizi', 'raccolta', 'RETE');
verifica(`nell'anno in corso chi ha lavorato solo nel ${A - 1} c'e', da decidere, e non si conta`, dd?.da_decidere === true && cDd.j.da_decidere >= 1 && cDd.j.totali.attesi === c69.j.totali.attesi,
  `${JSON.stringify(dd)} ${JSON.stringify(cDd.j.totali)}`);

console.log(`A70 - L'ANNO NUOVO (${A + 1}) NON PERDE NESSUNO`);
const B = A + 1;
const db70 = base({
  PrimariaRete: [mov('GATIM S.R.L.', 'IRIGOM SRL', 'imp', `${A}-06-10`), mov('ECOLOGICAL SYSTEMS SRL', 'IRIGOM SRL', 'imp', `${A}-06-11`)],
  PrimariaAci: [mov('EMMESSE SRLS', 'GATIM S.R.L.', 'imp', `${A}-06-12`)],
  // un'inclusione manuale nell'anno nuovo: prima bastava a far sparire tutti gli altri
  QualificaInclusione: [{ id: 'q1', anno: B, azione: 'includi', soggetto_chiave: 'pneuservice conversano', soggetto_nome: 'PNEUSERVICE CONVERSANO SRL', ruoli: 'raccolta' }],
  ContrattoFornitore: [
    // gia' generato per l'anno nuovo, prima spariva dalla tabella
    { id: 'k-gatim', anno: B, soggetto_chiave: 'gatim', soggetto_nome: 'GATIM S.R.L.', tipo_contratto: 'raccolta', canale: 'RETE', stato: 'generato', file_uri: 'privato://x',
      valori_json: JSON.stringify({ CORRISPETTIVO_RACCOLTA: 72, TARGET_TON: 320, DATA_INIZIO: `${B}-01-02`, PAGAMENTO: 'sessanta giorni' }) },
    { id: 'k-gatim-prima', anno: A, soggetto_chiave: 'gatim', soggetto_nome: 'GATIM S.R.L.', tipo_contratto: 'raccolta', canale: 'RETE', stato: 'controfirmato',
      valori_json: JSON.stringify({ CORRISPETTIVO_RACCOLTA: 70, TARGET_TON: 300, DATA_INIZIO: `${A}-01-02`, PAGAMENTO: 'sessanta giorni', FORNITORE_RAPPRESENTANTE: 'Azzarito Domenico' }) },
    // un contratto dell'anno nuovo di chi non ha movimenti
    { id: 'k-trs', anno: B, soggetto_chiave: 't r s', soggetto_nome: 'T.R.S. SRL', tipo_contratto: 'trattamento', canale: 'ACI', stato: 'inviato', inviato_il: `${A}-12-20` },
  ],
});
const c70 = await chiama(modulo, { db: db70, corpo: { anno: B } });
verifica('la funzione risponde', c70.stato === 200, JSON.stringify(c70.j).slice(0, 300));
const chiavi = (c70.j.soggetti || []).map(s => s.chiave);
verifica('c\'e\' chi e\' incluso a mano nell\'anno nuovo', chiavi.includes('pneuservice conversano'), chiavi.join(', '));
verifica(`ci sono i fornitori del ${A}, anche con un\'inclusione nel ${B}`, chiavi.includes('gatim') && chiavi.includes('ecological systems') && chiavi.includes('emmesse'), chiavi.join(', '));
verifica('c\'e\' chi ha gia\' un contratto dell\'anno nuovo, anche senza movimenti', chiavi.includes('t r s') && riga(c70.j, 't r s', 'trattamento', 'ACI')?.stato === 'inviato', chiavi.join(', '));
verifica(`per un anno che non e' cominciato i fornitori del ${A} sono attesi, non da decidere`, c70.j.anno_prima_atteso === true && !(c70.j.soggetti || []).some(s => s.contratti.some(c => c.da_decidere)));
verifica('la raccolta ACI di EMMESSE resta ACI anche nell\'anno nuovo', !!riga(c70.j, 'emmesse', 'raccolta', 'ACI') && !riga(c70.j, 'emmesse', 'raccolta', 'RETE'));

console.log('A68 - RIAPRENDO UN CONTRATTO SI RIPARTE DAI SUOI VALORI');
const k = riga(c70.j, 'gatim', 'raccolta', 'RETE');
verifica('il contratto dell\'anno arriva coi suoi valori (amministratore)', k?.contratto?.valori?.CORRISPETTIVO_RACCOLTA === 72 && k?.contratto?.valori?.TARGET_TON === 320, JSON.stringify(k?.contratto));
verifica('il precedente e\' quello dell\'anno prima', k?.precedente?.anno === A && k?.precedente?.valori?.CORRISPETTIVO_RACCOLTA === 70, JSON.stringify(k?.precedente));
const partenza = valoriDiPartenza(k || {});
verifica('la pagina parte dai valori salvati (72), non da quelli dell\'anno prima (70)', partenza.da === 'contratto' && partenza.valori.CORRISPETTIVO_RACCOLTA === 72 && partenza.valori.TARGET_TON === 320, JSON.stringify(partenza));
verifica('dalla proposta solo i punti che il contratto salvato non ha', partenza.valori.FORNITORE_RAPPRESENTANTE === 'Azzarito Domenico' && partenza.valori.DATA_INIZIO === `${B}-01-02`, JSON.stringify(partenza.valori));
const nuovo = valoriDiPartenza(riga(c70.j, 'ecological systems', 'raccolta', 'RETE') || {});
verifica('un contratto mai generato parte dalla proposta', nuovo.da === 'proposta' && nuovo.valori.DATA_INIZIO === `${B}-01-02`, JSON.stringify(nuovo));
verifica('nella proposta dell\'anno nuovo i prezzi dell\'anno prima non diventano valori', nuovo.valori.CORRISPETTIVO_RACCOLTA === undefined, JSON.stringify(nuovo.valori));

// ─── revisione del 13/10/2026 ───

// La situazione come la fa la funzione, ma con il giorno di oggi scelto dalla
// prova: la regola dell'anno prima dipende proprio da quello.
const situazione = async (db, anno, oggi) => {
  const ent = (nome) => ({
    list: async (_o, q = 5000, s = 0) => (db[nome] || []).slice(s, s + q),
    filter: async (f, _o, q = 5000, s = 0) => (db[nome] || []).filter(r => Object.entries(f || {}).every(([k, v]) => r[k] === v)).slice(s, s + q),
  });
  const finto = { asServiceRole: { entities: new Proxy({}, { get: (_t, nome) => ent(String(nome)) }) } };
  const delAnno = await individuaSoggetti(finto, anno);
  const prima = await individuaSoggetti(finto, anno - 1);
  return situazioneContratti({
    anno, oggi, admin: true, soggettiAnno: delAnno.soggetti, esclusiAnno: delAnno.esclusi, soggettiPrima: prima.soggetti,
    archivi: { rete: db.PrimariaRete || [], aci: db.PrimariaAci || [], extra: db.ExtraRaccolta || [], sec: db.Secondaria || [] },
    contratti: db.ContrattoFornitore || [], modelli: db.ModelloContratto || [], fornitori: db.Fornitore || [],
    targetRaccoglitori: db.TargetRaccoglitore || [], impiantiTarget: db.ImpiantoTargetSecondaria || [], tariffe: db.Tariffa || [],
  });
};

console.log(`A70 A GENNAIO - I CONTRATTI DEL ${B} GUARDATI DA GENNAIO A MARZO`);
const movOra = (trasportatore, destinazione, td, istante, extra = {}) => ({ ...mov(trasportatore, destinazione, td, istante.slice(0, 10)), trasporto_finito_il: istante, ...extra });
const dbGen = base({
  PrimariaRete: [
    mov('ALFA SRL', 'IRIGOM SRL', 'imp', `${A}-11-20`),          // ultimo trimestre
    mov('BETA SRL', 'IRIGOM SRL', 'imp', `${A}-05-10`),          // solo prima dell'ultimo trimestre
    // 30/09 alle 22:30 UTC e' il 1° ottobre in Italia: conta il giorno italiano
    movOra('EPSILON SRL', 'IRIGOM SRL', 'imp', `${A}-09-30T22:30:00Z`),
    mov('GAMMA SRL', 'IRIGOM SRL', 'imp', `${A}-11-05`),         // rete nell'ultimo trimestre...
    mov('OMEGA SRL', 'IRIGOM SRL', 'imp', `${A - 1}-11-15`),     // ultimo trimestre di due anni prima
    mov('ZETA SRL', 'IRIGOM SRL', 'imp', `${B}-01-05`),          // il primo viaggio di gennaio
  ],
  PrimariaAci: [
    mov('GAMMA SRL', 'TECNOGUM SRL', 'imp', `${A}-03-10`),       // ...ACI solo a marzo
    mov('ETA SRL', 'NAPPI SUD SRL', 'stoc', `${A}-12-02`),       // ACI nell'ultimo trimestre
  ],
  // il vettore di una secondaria ACI di dicembre: il trasporto e' un contratto solo, registrato RETE
  Secondaria: [{ ...mov('TRASPORTI RAPIDI SRL', 'IRIGOM SRL', 'imp', `${A}-12-10`), stoccaggio: 'NAPPI SUD SRL', classe: 'PFU Autodemolizione' }],
});
const gen = await situazione(dbGen, B, `${B}-01-08`);
const rg = (j, k, tipo, canale) => riga(j, k, tipo, canale);
verifica('l\'08/01 la situazione dice che vale l\'ultimo trimestre', gen.anno_prima_ultimo_trimestre === true && gen.anno_prima_atteso === false, JSON.stringify({ a: gen.anno_prima_atteso, u: gen.anno_prima_ultimo_trimestre }));
verifica(`l'08/01 chi ha raccolto nell'ultimo trimestre del ${A} e' atteso, non da decidere`,
  rg(gen, 'alfa', 'raccolta', 'RETE')?.da_decidere === false && rg(gen, 'alfa', 'raccolta', 'RETE')?.da_ultimo_trimestre === true, JSON.stringify(rg(gen, 'alfa', 'raccolta', 'RETE')));
verifica('vale il giorno italiano: il 30/09 alle 22:30 UTC e\' il 1° ottobre', rg(gen, 'epsilon', 'raccolta', 'RETE')?.da_decidere === false, JSON.stringify(rg(gen, 'epsilon', 'raccolta', 'RETE')));
verifica(`chi ha lavorato nel ${A} solo prima dell'ultimo trimestre resta da decidere`, rg(gen, 'beta', 'raccolta', 'RETE')?.da_decidere === true, JSON.stringify(rg(gen, 'beta', 'raccolta', 'RETE')));
verifica('si guarda prestazione e canale: GAMMA e\' atteso sulla rete (novembre), da decidere sull\'ACI (solo marzo)',
  rg(gen, 'gamma', 'raccolta', 'RETE')?.da_decidere === false && rg(gen, 'gamma', 'raccolta', 'ACI')?.da_decidere === true,
  `${JSON.stringify(rg(gen, 'gamma', 'raccolta', 'RETE'))} ${JSON.stringify(rg(gen, 'gamma', 'raccolta', 'ACI'))}`);
verifica('l\'ACI dell\'ultimo trimestre e\' attesa: raccolta ACI di ETA e stoccaggio ACI di NAPPI SUD',
  rg(gen, 'eta', 'raccolta', 'ACI')?.da_decidere === false && rg(gen, 'nappi sud', 'stoccaggio', 'ACI')?.da_decidere === false);
verifica('il trattamento segue chi ha ricevuto nell\'ultimo trimestre: IRIGOM atteso, TECNOGUM ACI (solo marzo) da decidere',
  rg(gen, 'irigom', 'trattamento', 'RETE')?.da_decidere === false && rg(gen, 'tecnogum', 'trattamento', 'ACI')?.da_decidere === true);
verifica('il vettore di una secondaria ACI di dicembre ha il suo contratto di trasporto atteso', rg(gen, 'trasporti rapidi', 'trasporto_secondaria', 'RETE')?.da_decidere === false,
  JSON.stringify(soggetto(gen, 'trasporti rapidi')?.contratti));
verifica('chi ha gia\' viaggiato a gennaio e\' atteso per i movimenti dell\'anno', rg(gen, 'zeta', 'raccolta', 'RETE')?.evidenza === 'anno' && rg(gen, 'zeta', 'raccolta', 'RETE')?.da_decidere === false);
verifica(`chi ha lavorato solo nel ${A - 1} non c'e' nemmeno`, !soggetto(gen, 'omega'));
const fineMarzo = await situazione(dbGen, B, `${B}-03-31`);
verifica('il 31/03 vale ancora', rg(fineMarzo, 'alfa', 'raccolta', 'RETE')?.da_decidere === false && fineMarzo.totali.attesi === gen.totali.attesi, `${JSON.stringify(fineMarzo.totali)} ${JSON.stringify(gen.totali)}`);
const aprile = await situazione(dbGen, B, `${B}-04-01`);
verifica('dal 1° aprile chi non ha ne\' movimenti dell\'anno ne\' un contratto torna da decidere',
  aprile.anno_prima_ultimo_trimestre === false && rg(aprile, 'alfa', 'raccolta', 'RETE')?.da_decidere === true && rg(aprile, 'eta', 'raccolta', 'ACI')?.da_decidere === true
  && rg(aprile, 'zeta', 'raccolta', 'RETE')?.da_decidere === false && aprile.totali.attesi < gen.totali.attesi, `${JSON.stringify(aprile.totali)} ${JSON.stringify(gen.totali)}`);
const dicembre = await situazione(dbGen, B, `${A}-12-15`);
verifica(`a dicembre, per il ${B} che non e' cominciato, sono attesi tutti quelli del ${A} (anche BETA)`,
  dicembre.anno_prima_atteso === true && dicembre.da_decidere === 0 && rg(dicembre, 'beta', 'raccolta', 'RETE')?.da_decidere === false);
const ottobre = await situazione(dbGen, A, `${A}-10-12`);
verifica(`a ottobre del ${A} l'ultimo trimestre del ${A - 1} non conta: OMEGA resta da decidere`,
  ottobre.anno_prima_ultimo_trimestre === false && rg(ottobre, 'omega', 'raccolta', 'RETE')?.da_decidere === true, JSON.stringify(rg(ottobre, 'omega', 'raccolta', 'RETE')));

console.log('LE TARIFFE COPIATE DA «PREPARA L\'ANNO» NON SONO IL PREZZO DEL CONTRATTO');
const t26r = tariffa('GATIM S.R.L.', 'RACCOLTA', 'RETE', 70, `${A}-01-02`, `${A}-12-31`);
const dbCopie = base({
  PrimariaRete: [mov('GATIM S.R.L.', 'IRIGOM SRL', 'imp', `${A}-06-10`), mov('T-CYCLE INDUSTRIES SRL', 'T-CYCLE INDUSTRIES SRL', 'imp', `${A}-06-10`)],
  PrimariaAci: [mov('GATIM S.R.L.', 'TECNOGUM SRL', 'imp', `${A}-06-10`)],
  Fornitore: [{ id: 'f-gatim', ragione_sociale: 'GATIM S.R.L.' }],
  Tariffa: [
    t26r,
    // la copia che fa «Prepara l'anno» (preparaAnno, azione copia_tariffe): prezzo del A, nota «da confermare»
    { id: 'copia-r', ...copiaTariffa(t26r, B) },
    // l'ACI del B scritta e confermata a mano: quella vale
    tariffa('GATIM S.R.L.', 'RACCOLTA', 'ACI', 95, `${B}-01-02`, `${B}-12-31`),
    tariffa('TECNOGUM SRL', 'TRATTAMENTO', 'ACI', 95, `${B}-01-02`, `${B}-12-31`, { note: conNotaCopia('', B) }),
  ],
  // target copiati: TargetRaccoglitore segna la copia nello storico, l'impianto nelle note
  TargetRaccoglitore: [{ id: 'trc', raccoglitore: 'GATIM S.R.L.', regione: 'Calabria', target_tonnellate: 300, anno: B, storico_json: JSON.stringify([{ il: `${A}-12-01T09:00:00Z`, da: 'admin', nota: notaCopia(B), prima: null }]) }],
  ImpiantoTargetSecondaria: [{ id: 'itc', nome_impianto: 'T-CYCLE INDUSTRIES SRL', target: 1050000, anno: B, stato: 'attivo', note: conNotaCopia('', B) }],
});
const cCop = await chiama(modulo, { db: dbCopie, corpo: { anno: B } });
const copR = riga(cCop.j, 'gatim', 'raccolta', 'RETE');
const copA = riga(cCop.j, 'gatim', 'raccolta', 'ACI');
const copT = riga(cCop.j, 'tecnogum', 'trattamento', 'ACI');
const copI = riga(cCop.j, 't-cycle', 'trattamento', 'RETE');
verifica(`la copia del prezzo ${A} non e' il prezzo proposto del ${B}`, copR?.proposta && copR.proposta.valori.CORRISPETTIVO_RACCOLTA === undefined && (copR.proposta.tariffe || []).length === 0, JSON.stringify(copR?.proposta?.valori));
verifica('compare fra i riferimenti, con l\'avviso', (copR?.proposta?.tariffe_copiate || []).some(t => t.valore === 70)
  && (copR?.proposta?.avvisi || []).some(a => a.includes(`copiata dal ${A} con «Prepara l'anno», da confermare: il prezzo lo decide il contratto`)), JSON.stringify(copR?.proposta?.avvisi));
verifica('e l\'avviso non dice che una tariffa non c\'e\'', !(copR?.proposta?.avvisi || []).some(a => /^In anagrafica non c'è una tariffa/.test(a)), JSON.stringify(copR?.proposta?.avvisi));
verifica('una tariffa confermata del nuovo anno resta il prezzo proposto (ACI 95)', copA?.proposta?.valori?.CORRISPETTIVO_RACCOLTA === 95 && copA.proposta.fonti.CORRISPETTIVO_RACCOLTA === 'tariffa', JSON.stringify(copA?.proposta));
verifica('anche nel trattamento: la copia di Tecnogum non diventa il prezzo', copT?.proposta && copT.proposta.valori.CORRISPETTIVO_TRATTAMENTO === undefined && copT.proposta.valori.CORRISPETTIVO_P === undefined
  && (copT.proposta.tariffe_copiate || []).length === 1, JSON.stringify(copT?.proposta));
verifica('il target copiato si propone con l\'avviso e la sua fonte', copR?.proposta?.valori?.TARGET_TON === 300 && copR.proposta.fonti.TARGET_TON === 'target_copiato' && copR.target_copiato === true
  && (copR.proposta.avvisi || []).some(a => a.includes(`copiato dal ${A} con «Prepara l'anno», da confermare: la quantità la decide il contratto`)), JSON.stringify(copR?.proposta));
verifica('anche quello dell\'impianto (note di Target & Status)', copI?.proposta?.valori?.QUOTA_TON === 1050 && copI.target_copiato === true
  && (copI.proposta.avvisi || []).some(a => /copiato dal .* la quantità la decide il contratto/.test(a)), JSON.stringify(copI?.proposta));
verifica('un target scritto a mano non porta l\'avviso', (() => {
  const v = valoriDelContratto({ anno: B, tipo: 'raccolta', canale: 'RETE', target: { t: 300, anno: B } });
  return v.fonti.TARGET_TON === 'target' && !v.avvisi.some(a => /copiato/.test(a));
})());

console.log('I PREZZI DELL\'ANNO PRIMA NON PASSANO, COMUNQUE SI CHIAMINO');
for (const [nome, f] of [['funzione', valoriDelContratto], ['pagina', valoriDelContrattoPagina]]) {
  const p = f({ anno: B, tipo: 'raccolta', canale: 'RETE', tariffe: [],
    precedente: { anno: A, data_inizio: `${A}-01-02`, valori: { CORRISPETTIVO_RACCOLTA: 70, CONTRIBUTO_NON_CONCORRENZA: 5, TARGET_TON_2: 40, FORNITORE_RAPPRESENTANTE: 'Azzarito Domenico', PAGAMENTO: 'sessanta giorni' } } });
  verifica(`${nome}: CONTRIBUTO_NON_CONCORRENZA (un prezzo) non passa dal contratto dell'anno prima`, p.valori.CONTRIBUTO_NON_CONCORRENZA === undefined && p.valori.CORRISPETTIVO_RACCOLTA === undefined, JSON.stringify(p.valori));
  verifica(`${nome}: nemmeno una seconda quantita' (TARGET_TON_2)`, p.valori.TARGET_TON_2 === undefined, JSON.stringify(p.valori));
  verifica(`${nome}: il rappresentante e il pagamento si', dall'anno prima`, p.valori.FORNITORE_RAPPRESENTANTE === 'Azzarito Domenico' && p.valori.PAGAMENTO === 'sessanta giorni' && p.fonti.PAGAMENTO === 'precedente');
}

// ─── revisione della revisione del 13/10/2026 (R3a) ───

console.log('IL PREZZO UNICO SI DICE SULLA RACCOLTA ANCHE SENZA TARIFFE CONFERMATE');
const AVV_UNICO = /prezzo unico che comprende il trattamento/;
const tGreen = tariffa('GREEN TYRE PROJECT SRL', 'RACCOLTA', 'ACI', 225, `${A}-01-02`, `${A}-12-31`, { comprensiva_trattamento: true });
const dbUnico = (tariffe) => base({
  // Green Tyre raccoglie sull'ACI e tratta quello che raccoglie: un contratto solo
  PrimariaAci: [mov('GREEN TYRE PROJECT SRL', 'GREEN TYRE PROJECT SRL', 'imp', `${A}-06-10`)],
  Fornitore: [{ id: 'f-green', ragione_sociale: 'GREEN TYRE PROJECT SRL' }],
  Tariffa: tariffe,
});
const green = (j, tipo) => ((j.soggetti || []).find(s => /GREEN TYRE/.test(s.nome))?.contratti || []).find(c => c.tipo === tipo && c.canale === 'ACI');
for (const [caso, tariffe, annoC, oggiC] of [
  [`con la tariffa del ${A} confermata`, [tGreen], A, `${A}-10-13`],
  [`con la copia di «Prepara l'anno» nel ${B}`, [tGreen, { id: 'copia-g', ...copiaTariffa(tGreen, B) }], B, `${A}-12-15`],
  [`senza nessuna tariffa del ${B}`, [tGreen], B, `${A}-12-15`],
]) {
  const j = await situazione(dbUnico(tariffe), annoC, oggiC);
  const tr = green(j, 'trattamento');
  const rc = green(j, 'raccolta');
  const quanti = (rc?.proposta?.avvisi || []).filter(a => AVV_UNICO.test(a)).length;
  verifica(`${caso}: il trattamento sta nella raccolta, e la raccolta dice il prezzo unico (una volta sola)`,
    tr?.non_dovuto === true && /prezzo unico/.test(tr?.motivo_non_dovuto || '') && quanti === 1, `${JSON.stringify(tr?.motivo_non_dovuto)} ${JSON.stringify(rc?.proposta?.avvisi)}`);
}
for (const [nome, f] of [['funzione', valoriDelContratto], ['pagina', valoriDelContrattoPagina]]) {
  const r = f({ anno: B, tipo: 'raccolta', canale: 'ACI', prezzoUnico: true });
  const s = f({ anno: B, tipo: 'stoccaggio', canale: 'ACI', prezzoUnico: true });
  verifica(`${nome}: l'avviso del prezzo unico sta sulla raccolta, non sullo stoccaggio`, r.avvisi.some(a => AVV_UNICO.test(a)) && !s.avvisi.some(a => AVV_UNICO.test(a)), JSON.stringify([r.avvisi, s.avvisi]));
}

console.log('UNA COPIA RISCRITTA COL PREZZO NUOVO E\' IL PREZZO DELL\'ANNO, ANCORA DA CONFERMARE');
// La finestra delle tariffe salva { valore, note } e la nota della copia resta.
const copia72 = { id: 'copia-72', ...copiaTariffa(t26r, B), valore: 72 };
const cMano = await chiama(modulo, { db: { ...dbCopie, Tariffa: [t26r, copia72] }, corpo: { anno: B } });
const mano = riga(cMano.j, 'gatim', 'raccolta', 'RETE');
verifica(`la copia portata a 72 si propone (nel ${A} c'era 70), con la sua fonte`, mano?.proposta?.valori?.CORRISPETTIVO_RACCOLTA === 72 && mano.proposta.fonti.CORRISPETTIVO_RACCOLTA === 'tariffa_da_confermare',
  JSON.stringify(mano?.proposta?.valori));
verifica('l\'avviso dice che e\' scritta per l\'anno e va confermata, non che e\' copiata', (mano?.proposta?.avvisi || []).some(a => a.includes(`72,00 €/t scritta per il ${B} ma ancora segnata da confermare: confermala in «Prepara l'anno»`))
  && !(mano?.proposta?.avvisi || []).some(a => /72,00 €\/t.*copiata dal/.test(a)), JSON.stringify(mano?.proposta?.avvisi));
verifica('e non dice che il prezzo va scritto a mano', !(mano?.proposta?.avvisi || []).some(a => /il prezzo va scritto a mano/.test(a)), JSON.stringify(mano?.proposta?.avvisi));
verifica(`fra le tariffe dell'anno, segnata da confermare; il 70 del ${A} resta il riferimento`, (mano?.proposta?.tariffe || []).some(t => t.valore === 72 && t.da_confermare === true)
  && (mano?.proposta?.tariffe_copiate || []).length === 0 && (mano?.proposta?.tariffe_anno_prima || []).map(t => t.valore).join() === '70', JSON.stringify(mano?.proposta));
// Le copie che portano ancora il prezzo dell'anno prima restano riferimenti,
// anche se la riga del A e' stata disattivata dopo la copia, o se la copia ha
// cambiato zona ma non prezzo.
// La scheda: la fonte nuova ha la sua etichetta accanto al campo, e fra le
// tariffe dell'anno la riscritta si legge «ancora da confermare» (sorgente senza \r).
const pagina = readFileSync(new URL('../src/components/qualifica/ContrattiAnno.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
const fontiPagina = (pagina.match(/const FONTI = \{[\s\S]*?\n\};/) || [''])[0];
verifica('la scheda ha l\'etichetta della fonte «tariffa_da_confermare»', /\btariffa_da_confermare:\s*'[^']*da confermare[^']*'/.test(fontiPagina), fontiPagina);
verifica('la scheda scrive «ancora da confermare» accanto alla tariffa riscritta', /const tariffeTesto = [^\n]*t\.da_confermare \? ', ancora da confermare'/.test(pagina));
const t26off = { ...t26r, id: 't26off', stato: 'non_attivo' };
const cOff = await chiama(modulo, { db: { ...dbCopie, Tariffa: [t26off, { id: 'copia-off', ...copiaTariffa(t26r, B) }] }, corpo: { anno: B } });
const off = riga(cOff.j, 'gatim', 'raccolta', 'RETE');
verifica(`la copia di una tariffa del ${A} disattivata dopo la copia resta una copia`, off?.proposta && off.proposta.valori.CORRISPETTIVO_RACCOLTA === undefined && (off.proposta.tariffe_copiate || []).length === 1, JSON.stringify(off?.proposta));
const cZona = await chiama(modulo, { db: { ...dbCopie, Tariffa: [t26r, { id: 'copia-zona', ...copiaTariffa(t26r, B), regione: 'Basilicata' }] }, corpo: { anno: B } });
const zona = riga(cZona.j, 'gatim', 'raccolta', 'RETE');
verifica('una copia con un\'altra zona ma il prezzo dell\'anno prima resta una copia', zona?.proposta && zona.proposta.valori.CORRISPETTIVO_RACCOLTA === undefined && (zona.proposta.tariffe_copiate || []).length === 1, JSON.stringify(zona?.proposta));

console.log('IL CELLULARE, LA PEC E IL REFERENTE: DALL\'ANNO PRIMA O DALL\'ANAGRAFICA, MAI INVENTATI');
const recapitiPrima = { FORNITORE_TEL: '099 111222', FORNITORE_TEL_2: '333 4445566', FORNITORE_EMAIL: 'info@logistica.example', FORNITORE_EMAIL_2: 'logistica@pec.example',
  FORNITORE_REFERENTE: 'sig. Alberto Pingaro', FORNITORE_ISCRIZIONE: 'SA/012345' };
for (const [nome, f] of [['funzione', valoriDelContratto], ['pagina', valoriDelContrattoPagina]]) {
  const daPrima = f({ anno: B, tipo: 'trasporto_secondaria', canale: 'RETE', fornitore: { ragione_sociale: 'LOGISTICA SRL' }, precedente: { anno: A, valori: recapitiPrima } });
  verifica(`${nome}: dal contratto dell'anno prima il secondo telefono, la pec, il referente e l'iscrizione`,
    ['FORNITORE_TEL_2', 'FORNITORE_EMAIL_2', 'FORNITORE_REFERENTE', 'FORNITORE_ISCRIZIONE'].every(k => daPrima.valori[k] === recapitiPrima[k] && daPrima.fonti[k] === 'precedente'), JSON.stringify(daPrima));
  const daAnagrafica = f({ anno: B, tipo: 'trasporto_secondaria', canale: 'RETE',
    fornitore: { ragione_sociale: 'LOGISTICA SRL', telefono: '089 765432', cellulare: '347 1234567', email: 'info@logistica.example', pec: 'logistica@pec.example', referente: 'Alberto Pingaro' } });
  verifica(`${nome}: dall'anagrafica il cellulare, la pec e il referente, quando ci sono`,
    daAnagrafica.valori.FORNITORE_TEL_2 === '347 1234567' && daAnagrafica.valori.FORNITORE_EMAIL_2 === 'logistica@pec.example' && daAnagrafica.valori.FORNITORE_REFERENTE === 'Alberto Pingaro'
    && ['FORNITORE_TEL_2', 'FORNITORE_EMAIL_2', 'FORNITORE_REFERENTE'].every(k => daAnagrafica.fonti[k] === 'anagrafica'), JSON.stringify(daAnagrafica));
  const niente = f({ anno: B, tipo: 'trasporto_secondaria', canale: 'RETE', fornitore: { ragione_sociale: 'LOGISTICA SRL', telefono: '089 765432', email: 'info@logistica.example' } });
  verifica(`${nome}: senza anno prima e senza quei campi in anagrafica restano da scrivere (il telefono non diventa il cellulare)`,
    niente.valori.FORNITORE_TEL === '089 765432' && ['FORNITORE_TEL_2', 'FORNITORE_EMAIL_2', 'FORNITORE_REFERENTE'].every(k => niente.valori[k] === undefined), JSON.stringify(niente.valori));
  // L'anagrafica ha come telefono il cellulare e come email la pec che il
  // contratto dell'anno prima aveva al secondo posto: non si scrivono due volte.
  const doppi = f({ anno: B, tipo: 'trasporto_secondaria', canale: 'RETE', precedente: { anno: A, valori: recapitiPrima },
    fornitore: { ragione_sociale: 'LOGISTICA SRL', telefono: '333/4445566', email: 'Logistica@PEC.example' } });
  verifica(`${nome}: un recapito dell'anagrafica che l'anno prima stava in un altro punto non si ripete`,
    doppi.valori.FORNITORE_TEL === '099 111222' && doppi.valori.FORNITORE_TEL_2 === '333 4445566' && doppi.valori.FORNITORE_EMAIL === 'info@logistica.example'
    && doppi.valori.FORNITORE_EMAIL_2 === 'logistica@pec.example', JSON.stringify(doppi.valori));
}

// I DATI VERI DELL'11/10/2026, se la copia c'e' (memoria «dati-veri»): i due casi
// del revisore. Fuori dal repository, quindi senza la copia si salta.
const COPIA = new URL('../../dati-veri/treadrider-dati-veri-2026-10-11.json.gz', import.meta.url);
if (!existsSync(COPIA)) {
  console.log('DATI VERI: la copia dell\'11/10/2026 non c\'e\', salto');
} else {
  console.log('DATI VERI DELL\'11/10/2026');
  const V = JSON.parse(gunzipSync(readFileSync(COPIA)).toString('utf8')).archivi;
  // due viaggi finti del 05/01/2027, come nel caso del revisore
  const gennaio = [
    { id: 'g1', stato: 'terminato', trasportatore: 'GATIM S.R.L.', destinazione: 'Irigom S.r.l.', tipo_destinazione: 'Imp', classe: 'P', trasporto_finito_il: '2027-01-05T10:00:00Z' },
    { id: 'g2', stato: 'terminato', trasportatore: 'PNEUSERVICE CONVERSANO SRL', destinazione: 'Irigom S.r.l.', tipo_destinazione: 'Imp', classe: 'P', trasporto_finito_il: '2027-01-05T10:00:00Z' },
  ];
  const dbV = { ...V, PrimariaRete: [...V.PrimariaRete, ...gennaio], QualificaInclusione: [], ContrattoFornitore: [], ModelloContratto: [] };
  const vDic = await situazione(dbV, 2027, '2026-12-15');
  const vGen = await situazione(dbV, 2027, '2027-01-08');
  const vApr = await situazione(dbV, 2027, '2027-04-02');
  const vOtt = await situazione(dbV, 2026, '2026-10-12');
  console.log(`  2027 guardati il 15/12/2026: ${JSON.stringify(vDic.totali)}, da decidere ${vDic.da_decidere}`);
  console.log(`  2027 guardati l'08/01/2027: ${JSON.stringify(vGen.totali)}, da decidere ${vGen.da_decidere}`);
  console.log(`  2027 guardati il 02/04/2027: ${JSON.stringify(vApr.totali)}, da decidere ${vApr.da_decidere}`);
  console.log(`  2026 guardati il 12/10/2026: ${JSON.stringify(vOtt.totali)}, da decidere ${vOtt.da_decidere}`);
  // La copia arriva all'11/10/2026: dell'ultimo trimestre ci sono undici giorni, e
  // gli attesi di gennaio sono quelli che hanno lavorato in quei giorni (13). Prima
  // della revisione erano 3, cioe' solo chi aveva gia' viaggiato a gennaio.
  verifica('dati veri, 08/01/2027: chi ha lavorato a ottobre e\' atteso (13 attesi, non 3)', vGen.totali.attesi === 13 && vGen.da_decidere === 21, JSON.stringify(vGen.totali));
  verifica('dati veri, 15/12/2026: invariato (33 attesi, nessuno da decidere)', vDic.totali.attesi === 33 && vDic.da_decidere === 0, JSON.stringify(vDic.totali));
  verifica('dati veri, 02/04/2027: come prima (3 attesi)', vApr.totali.attesi === 3, JSON.stringify(vApr.totali));
  verifica('dati veri, ottobre 2026: invariato (33 attesi, 19 da decidere)', vOtt.totali.attesi === 33 && vOtt.da_decidere === 19, JSON.stringify(vOtt.totali));

  // «Prepara l'anno» sulle 65 tariffe vere: nessun contratto 2027 propone un prezzo copiato.
  const piano = pianoCopiaTariffe(V.Tariffa, 2027, ['PASSIVA']);
  const copie = piano.da_creare.map((x, i) => ({ id: 'copia' + i, ...x.copia }));
  const vCop = await situazione({ ...V, Tariffa: [...V.Tariffa, ...copie], QualificaInclusione: [] }, 2027, '2026-12-15');
  let conPrezzoCopiato = 0, conAvviso = 0;
  for (const s of vCop.soggetti) for (const c of s.contratti) {
    if (!c.proposta) continue;
    if (Object.keys(c.proposta.valori).some(k => /^CORRISPETTIVO_/.test(k))) conPrezzoCopiato++;
    if ((c.proposta.tariffe_copiate || []).length && c.proposta.avvisi.some(a => /da confermare: il prezzo lo decide il contratto/.test(a))) conAvviso++;
  }
  console.log(`  dopo «Prepara l'anno» (${copie.length} copie): ${conPrezzoCopiato} contratti 2027 con un prezzo proposto, ${conAvviso} con le copie fra i riferimenti`);
  verifica('dati veri: dopo la copia nessun contratto 2027 propone il prezzo del 2026 (erano 23), e le copie sono fra i riferimenti di 32', copie.length === 58 && conPrezzoCopiato === 0 && conAvviso === 32, `${copie.length} ${conPrezzoCopiato} ${conAvviso}`);

  // R3a: il prezzo unico di Green Tyre ACI si dice sulla raccolta con la copia e senza.
  const senzaUnico = (j) => {
    const fuori = [];
    for (const s of j.soggetti) for (const t of s.contratti.filter(c => c.tipo === 'trattamento' && /prezzo unico/.test(c.motivo_non_dovuto || ''))) {
      const r = s.contratti.find(c => c.tipo === 'raccolta' && c.canale === t.canale);
      if (!(r?.proposta?.avvisi || []).some(a => AVV_UNICO.test(a))) fuori.push(`${s.nome} ${t.canale}`);
    }
    return fuori;
  };
  const unicoTratt = (j) => j.soggetti.flatMap(s => s.contratti.filter(c => c.tipo === 'trattamento' && /prezzo unico/.test(c.motivo_non_dovuto || ''))).length;
  console.log(`  prezzo unico: ${unicoTratt(vDic)} trattamenti compresi nella raccolta senza le copie, ${unicoTratt(vCop)} con le copie`);
  verifica('dati veri: la raccolta ACI di Green Tyre dice il prezzo unico, con la copia e senza (prima mancava in tutti e due)',
    unicoTratt(vDic) === 1 && unicoTratt(vCop) === 1 && senzaUnico(vDic).length === 0 && senzaUnico(vCop).length === 0, JSON.stringify([senzaUnico(vDic), senzaUnico(vCop)]));

  // R3a: il caso del revisore, la copia della raccolta di rete di GATIM portata da 70 a 72.
  const copieMano = copie.map(t => (/gatim/i.test(t.fornitore_nome || '') && t.prestazione === 'RACCOLTA' && t.tipologia === 'RETE' ? { ...t, valore: 72 } : t));
  const vMano = await situazione({ ...V, Tariffa: [...V.Tariffa, ...copieMano], QualificaInclusione: [] }, 2027, '2026-12-15');
  const gr = riga(vMano, 'gatim', 'raccolta', 'RETE');
  let proposti = 0;
  for (const s of vMano.soggetti) for (const c of s.contratti) if (c.proposta && Object.keys(c.proposta.valori).some(k => /^CORRISPETTIVO_/.test(k))) proposti++;
  console.log(`  GATIM rete 2027 con la copia a 72: proposto ${gr?.proposta?.valori?.CORRISPETTIVO_RACCOLTA} (${gr?.proposta?.fonti?.CORRISPETTIVO_RACCOLTA}); contratti 2027 con un prezzo proposto: ${proposti}`);
  verifica('dati veri: la copia di GATIM corretta a 72 si propone, da confermare, e non e\' detta copiata dal 2026; le altre copie restano riferimenti',
    gr?.proposta?.valori?.CORRISPETTIVO_RACCOLTA === 72 && gr.proposta.fonti.CORRISPETTIVO_RACCOLTA === 'tariffa_da_confermare'
    && !(gr.proposta.avvisi || []).some(a => /72,00 €\/t.*copiata dal 2026/.test(a)) && (gr.proposta.avvisi || []).some(a => /72,00 €\/t \(in Calabria\) scritta per il 2027 ma ancora segnata da confermare/.test(a))
    && proposti === 1, `${proposti} ${JSON.stringify(gr?.proposta?.avvisi)}`);
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
