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
// Tutto il modulo, non i nomi: col codice di prima (controprova) un nome che non
// c'e' fa fallire le verifiche, non fermare la prova.
import * as segnapostiPagina from '../src/lib/segnapostiContratto.js';
import * as segnapostiFunzione from '../base44/shared/segnapostiContratto.ts';

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

// ─── decisioni dell'utente del 13/10/2026 ───

// RACCOLTA E STOCCAGGIO ACI, UN CONTRATTO SOLO. Decisione dell'utente del
// 13/10/2026: chi nell'ACI raccoglie e stocca (Nappi Sud; Ecorecuperi negli anni in
// cui lo fa) ha un contratto ACI «raccolta e stoccaggio» coi due prezzi
// (CORRISPETTIVO_RACCOLTA e CORRISPETTIVO_STOCCAGGIO), come il contratto vero di
// Nappi Sud 2026 (quello di Ecorecuperi del 2024 ha un prezzo solo,
// «Trasporto+Stoccaggio»); il modello e' quello ACI della raccolta e stoccaggio;
// gli attesi contano un contratto. Lo stoccaggio ACI a parte e' «non dovuto: sta
// nel contratto di raccolta e stoccaggio». Prima erano due contratti.
console.log('RACCOLTA E STOCCAGGIO ACI: UN CONTRATTO SOLO, COI DUE PREZZI');
const segnaposti = (...s) => JSON.stringify(s.map(x => ({ segnaposto: x })));
const dbRS = base({
  PrimariaRete: [mov('NAPPI SUD SRL', 'NAPPI SUD SRL', 'stoc', g)],                                   // rete: raccoglie e stocca
  PrimariaAci: [mov('NAPPI SUD SRL', 'IRIGOM SRL', 'imp', g), mov('EMMESSE SRLS', 'NAPPI SUD SRL', 'stoc', g)], // ACI: raccoglie e stocca
  Fornitore: [{ id: 'f-nappi', ragione_sociale: 'NAPPI SUD SRL', piva: '02556750657' }],
  Tariffa: [
    tariffa('NAPPI SUD SRL', 'RACCOLTA', 'RETE', 58, `${A}-01-01`, `${A}-12-31`),
    tariffa('NAPPI SUD SRL', 'CONFERIMENTO_STOCCAGGIO', 'RETE', 15, `${A}-01-01`, `${A}-12-31`),
    tariffa('NAPPI SUD SRL', 'RACCOLTA', 'ACI', 92, `${A}-01-01`, `${A}-12-31`),
    tariffa('NAPPI SUD SRL', 'CONFERIMENTO_STOCCAGGIO', 'ACI', 16, `${A}-01-01`, `${A}-12-31`),
    tariffa('NAPPI SUD SRL', 'CONFERIMENTO_STOCCAGGIO', 'ACI', 14, `${A - 1}-01-01`, `${A - 1}-12-31`),
  ],
  ModelloContratto: [
    { id: 'mod-r-aci', nome: 'Raccolta ACI', tipo_contratto: 'raccolta', canale: 'ACI', stato: 'attivo', punti_json: segnaposti('FORNITORE_RAGIONE_SOCIALE', 'CORRISPETTIVO_RACCOLTA'), created_date: `${A}-10-02` },
    { id: 'mod-rs-aci', nome: 'Raccolta e stoccaggio ACI', tipo_contratto: 'raccolta', canale: 'ACI', stato: 'attivo', punti_json: segnaposti('FORNITORE_RAGIONE_SOCIALE', 'CORRISPETTIVO_RACCOLTA', 'CORRISPETTIVO_STOCCAGGIO'), created_date: `${A}-10-01` },
    { id: 'mod-r-rete', nome: 'Raccolta rete', tipo_contratto: 'raccolta', canale: 'RETE', stato: 'attivo', punti_json: segnaposti('CORRISPETTIVO_RACCOLTA', 'CORRISPETTIVO_STOCCAGGIO') },
  ],
});
const cRS = await chiama(modulo, { db: dbRS, corpo: { anno: A } });
const rsA = riga(cRS.j, 'nappi sud', 'raccolta', 'ACI');
const ssA = riga(cRS.j, 'nappi sud', 'stoccaggio', 'ACI');
verifica('Nappi Sud, raccolta ACI: e\' il contratto di raccolta e stoccaggio, col modello ACI che ha il prezzo dello stoccaggio', rsA?.raccolta_e_stoccaggio === true && rsA.modello_id === 'mod-rs-aci',
  JSON.stringify(rsA && [rsA.raccolta_e_stoccaggio, rsA.modello_id]));
verifica('...coi due prezzi, dalle tariffe ACI dell\'anno: raccolta 92, stoccaggio 16 (non il 14 dell\'anno prima)', rsA?.proposta?.valori?.CORRISPETTIVO_RACCOLTA === 92 && rsA.proposta.valori.CORRISPETTIVO_STOCCAGGIO === 16
  && rsA.proposta.fonti.CORRISPETTIVO_STOCCAGGIO === 'tariffa', JSON.stringify(rsA?.proposta?.valori));
verifica('...e le tariffe dicono di quale prezzo sono', (rsA?.proposta?.tariffe || []).some(t => t.servizio === 'stoccaggio' && t.valore === 16) && (rsA?.proposta?.tariffe || []).some(t => t.servizio === 'raccolta' && t.valore === 92)
  && (rsA?.proposta?.tariffe_anno_prima || []).some(t => t.servizio === 'stoccaggio' && t.valore === 14), JSON.stringify(rsA?.proposta?.tariffe));
verifica('Nappi Sud, stoccaggio ACI: non dovuto, sta nel contratto di raccolta e stoccaggio, senza proposta', ssA?.non_dovuto === true && ssA.stato === 'non_dovuto' && !ssA.proposta
  && /sta nel contratto di raccolta e stoccaggio/.test(ssA.motivo_non_dovuto || ''), JSON.stringify(ssA));
verifica('sulla rete i contratti restano due, raccolta e stoccaggio: la decisione e\' dell\'ACI', !!riga(cRS.j, 'nappi sud', 'raccolta', 'RETE') && riga(cRS.j, 'nappi sud', 'raccolta', 'RETE').raccolta_e_stoccaggio === false
  && riga(cRS.j, 'nappi sud', 'stoccaggio', 'RETE')?.non_dovuto === false && riga(cRS.j, 'nappi sud', 'stoccaggio', 'RETE')?.proposta?.valori?.CORRISPETTIVO_STOCCAGGIO === 15);
verifica('chi sull\'ACI raccoglie e basta (EMMESSE) ha il modello della sola raccolta ACI', riga(cRS.j, 'emmesse', 'raccolta', 'ACI')?.raccolta_e_stoccaggio === false
  && riga(cRS.j, 'emmesse', 'raccolta', 'ACI')?.modello_id === 'mod-r-aci' && !('CORRISPETTIVO_STOCCAGGIO' in (riga(cRS.j, 'emmesse', 'raccolta', 'ACI')?.proposta?.valori || {})));
// Nappi Sud: raccolta rete, stoccaggio rete, raccolta e stoccaggio ACI (3); EMMESSE
// raccolta ACI; IRIGOM trattamento ACI: cinque. Prima erano sei.
verifica('i contratti attesi contano un contratto solo per la raccolta e stoccaggio ACI (5, non 6)', cRS.j.totali?.attesi === 5, JSON.stringify(cRS.j.totali));
verifica('la funzione dice quale modello e\' di raccolta e stoccaggio', (cRS.j.modelli || []).find(m => m.id === 'mod-rs-aci')?.raccolta_e_stoccaggio === true
  && (cRS.j.modelli || []).find(m => m.id === 'mod-r-aci')?.raccolta_e_stoccaggio === false && (cRS.j.modelli || []).find(m => m.id === 'mod-r-rete')?.raccolta_e_stoccaggio === false);
const senzaStocc = await chiama(modulo, { db: { ...dbRS, Tariffa: dbRS.Tariffa.filter(t => !(t.prestazione === 'CONFERIMENTO_STOCCAGGIO' && t.tipologia === 'ACI')) }, corpo: { anno: A } });
verifica('senza tariffa dello stoccaggio ACI: il prezzo dello stoccaggio resta da scrivere, e l\'avviso dice di quale prezzo parla',
  riga(senzaStocc.j, 'nappi sud', 'raccolta', 'ACI')?.proposta?.valori?.CORRISPETTIVO_STOCCAGGIO === undefined
  && (riga(senzaStocc.j, 'nappi sud', 'raccolta', 'ACI')?.proposta?.avvisi || []).some(a => /^Per lo stoccaggio, in anagrafica non c'è una tariffa passiva ACI valida nel/.test(a)),
  JSON.stringify(riga(senzaStocc.j, 'nappi sud', 'raccolta', 'ACI')?.proposta?.avvisi));
// Un contratto di stoccaggio ACI gia' fatto a parte per l'anno resta: le righe tornano due.
const conStoccAParte = await chiama(modulo, { db: { ...dbRS, ContrattoFornitore: [{ id: 'k-st', anno: A, soggetto_chiave: 'nappi sud', soggetto_nome: 'NAPPI SUD SRL', tipo_contratto: 'stoccaggio', canale: 'ACI', stato: 'controfirmato' }] }, corpo: { anno: A } });
verifica('con un contratto di stoccaggio ACI gia\' fatto a parte i contratti restano due, e si contano tutti e due',
  riga(conStoccAParte.j, 'nappi sud', 'stoccaggio', 'ACI')?.stato === 'controfirmato' && riga(conStoccAParte.j, 'nappi sud', 'raccolta', 'ACI')?.raccolta_e_stoccaggio === false
  && conStoccAParte.j.totali.attesi === 6, JSON.stringify(conStoccAParte.j.totali));
// Chi l'anno prima raccoglieva e stoccava sull'ACI e quest'anno solo raccoglie:
// niente contratto unico, lo stoccaggio resta da decidere.
const smesso = await situazione(base({
  PrimariaAci: [mov('NAPPI SUD SRL', 'IRIGOM SRL', 'imp', `${A}-03-10`), mov('EMMESSE SRLS', 'NAPPI SUD SRL', 'stoc', `${A - 1}-06-10`)],
}), A, `${A}-10-13`);
verifica('chi quest\'anno sull\'ACI raccoglie soltanto non ha il contratto unico: lo stoccaggio dell\'anno prima resta da decidere',
  riga(smesso, 'nappi sud', 'raccolta', 'ACI')?.raccolta_e_stoccaggio === false && riga(smesso, 'nappi sud', 'stoccaggio', 'ACI')?.da_decidere === true
  && riga(smesso, 'nappi sud', 'stoccaggio', 'ACI')?.non_dovuto === false);
// Tutti e due solo l'anno prima: un contratto unico da decidere, contato una volta.
const fermo = await situazione(base({
  PrimariaAci: [mov('NAPPI SUD SRL', 'IRIGOM SRL', 'imp', `${A - 1}-03-10`), mov('EMMESSE SRLS', 'NAPPI SUD SRL', 'stoc', `${A - 1}-06-10`)],
}), A, `${A}-10-13`);
verifica('fermo da un anno su tutte e due: un contratto unico da decidere, contato una volta sola',
  riga(fermo, 'nappi sud', 'raccolta', 'ACI')?.raccolta_e_stoccaggio === true && riga(fermo, 'nappi sud', 'raccolta', 'ACI')?.da_decidere === true
  && riga(fermo, 'nappi sud', 'stoccaggio', 'ACI')?.non_dovuto === true && riga(fermo, 'nappi sud', 'stoccaggio', 'ACI')?.da_decidere === false
  && fermo.da_decidere === 3, JSON.stringify([fermo.da_decidere, soggetto(fermo, 'nappi sud')?.contratti?.map(c => `${c.tipo}/${c.canale}/${c.da_decidere}`)]));
// A gennaio: tutte e due nell'ultimo trimestre dell'anno prima, un contratto atteso.
const gennaioRS = await situazione(base({
  PrimariaAci: [mov('NAPPI SUD SRL', 'IRIGOM SRL', 'imp', `${A}-11-10`), mov('EMMESSE SRLS', 'NAPPI SUD SRL', 'stoc', `${A}-12-02`)],
}), B, `${B}-01-08`);
verifica('l\'08/01: raccolta e stoccaggio ACI dell\'ultimo trimestre, un contratto unico atteso',
  riga(gennaioRS, 'nappi sud', 'raccolta', 'ACI')?.raccolta_e_stoccaggio === true && riga(gennaioRS, 'nappi sud', 'raccolta', 'ACI')?.da_decidere === false
  && riga(gennaioRS, 'nappi sud', 'stoccaggio', 'ACI')?.non_dovuto === true);
for (const [nome, f] of [['funzione', valoriDelContratto], ['pagina', valoriDelContrattoPagina]]) {
  const v = f({ anno: A, tipo: 'raccolta', canale: 'ACI', tariffe: [tariffa('X', 'RACCOLTA', 'ACI', 92, `${A}-01-01`, `${A}-12-31`)],
    stoccaggio: { tariffe: [tariffa('X', 'CONFERIMENTO_STOCCAGGIO', 'ACI', 16, `${A}-01-01`, `${A}-12-31`), tariffa('X', 'CONFERIMENTO_STOCCAGGIO', 'ACI', 18, `${A}-07-01`, `${A}-12-31`)] } });
  verifica(`${nome}: due prezzi di stoccaggio nell'anno non si scelgono a caso, e l'avviso lo dice per lo stoccaggio`, v.valori.CORRISPETTIVO_RACCOLTA === 92 && v.valori.CORRISPETTIVO_STOCCAGGIO === undefined
    && v.avvisi.some(a => /^Per lo stoccaggio, più prezzi nell'anno: 16,00 €\/t; 18,00 €\/t \(dal 01\/07\//.test(a)), JSON.stringify(v));
  const solo = f({ anno: A, tipo: 'raccolta', canale: 'ACI', tariffe: [] });
  verifica(`${nome}: senza lo stoccaggio gli avvisi della raccolta restano quelli di sempre`, solo.avvisi.some(a => /^In anagrafica non c'è una tariffa passiva ACI valida nel/.test(a)) && !solo.avvisi.some(a => /^Per la raccolta/.test(a)));
}
// La scheda: il contratto unico ha il suo nome, e il modello si sceglie fra quelli giusti.
verifica('la scheda chiama «Raccolta e stoccaggio ACI» il contratto unico e sceglie il modello col prezzo dello stoccaggio',
  /const nomeContratto = \(r\) => \(r\.raccolta_e_stoccaggio \? `Raccolta e stoccaggio \$\{nomeCanale\(r\.canale\)\}`/.test(pagina)
  && /eModelloRaccoltaEStoccaggio\(m\) === !!r\.raccolta_e_stoccaggio/.test(pagina) && /modelli\.filter\(m => modelloAdatto\(m, riga\)\)/.test(pagina));
const sezioneModelli = readFileSync(new URL('../src/components/qualifica/ModelliContratti.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
verifica('«Modelli dei contratti» ha la riga «Raccolta e stoccaggio ACI», e non salva un format nella riga sbagliata',
  /\{ tipo: 'raccolta', canale: 'ACI', stoccaggio: true \}/.test(sezioneModelli) && /stoccaggio && !conPrezzoStoccaggio\(punti\)/.test(sezioneModelli) && /!stoccaggio && conPrezzoStoccaggio\(punti\)/.test(sezioneModelli));

// ─── revisione del 14/10/2026 ───

// COM'E' FATTO UN CONTRATTO GIA' FATTO LO DICE IL CONTRATTO. Due rilievi con la
// stessa causa: per una raccolta ACI che aveva gia' il suo contratto, «raccolta
// e stoccaggio» veniva dai movimenti dell'anno.
// - Il contratto 2027 di Nappi Sud coi due prezzi, firmato a dicembre: il
//   15/04/2027, senza ancora un viaggio ACI del 2027 (nel 2026 l'ACI di Nappi Sud
//   non ha viaggiato a gennaio, febbraio e aprile), tornava «sola raccolta», lo
//   stoccaggio ACI diventava «da decidere» a parte e la pagina, riaprendolo,
//   proponeva il modello senza il prezzo dello stoccaggio;
// - un contratto di sola raccolta ACI firmato prima che il fornitore
//   cominciasse a stoccare sull'ACI (Ecorecuperi, «negli anni in cui lo fa»): lo
//   stoccaggio ACI diventava «non dovuto», nessun contratto lo copriva e i conti
//   dicevano tutto fatto.
console.log('IL CONTRATTO GIA\' FATTO DICE SE E\' DI RACCOLTA E STOCCAGGIO');
const modR = { id: 'mod-r-aci', nome: 'Raccolta ACI', tipo_contratto: 'raccolta', canale: 'ACI', stato: 'attivo', punti_json: segnaposti('FORNITORE_RAGIONE_SOCIALE', 'CORRISPETTIVO_RACCOLTA') };
const modRS = { id: 'mod-rs-aci', nome: 'Raccolta e stoccaggio ACI', tipo_contratto: 'raccolta', canale: 'ACI', stato: 'attivo', punti_json: segnaposti('FORNITORE_RAGIONE_SOCIALE', 'CORRISPETTIVO_RACCOLTA', 'CORRISPETTIVO_STOCCAGGIO') };
const modS = { id: 'mod-s-aci', nome: 'Stoccaggio ACI', tipo_contratto: 'stoccaggio', canale: 'ACI', stato: 'attivo', punti_json: segnaposti('FORNITORE_RAGIONE_SOCIALE', 'CORRISPETTIVO_STOCCAGGIO') };
// La scelta del modello della scheda, presa dal sorgente: modelloAdatto e la
// scelta iniziale di ProceduraContratto (il modello del contratto, se e' fra
// quelli adatti; altrimenti quello della riga; altrimenti il primo).
const defAdatto = (pagina.match(/const modelloAdatto = \(m, r\) => [\s\S]*?;\n/) || [''])[0];
const modelloAdatto = new Function('eModelloRaccoltaEStoccaggio', defAdatto + 'return modelloAdatto;')(segnapostiPagina.eModelloRaccoltaEStoccaggio);
verifica('la scelta iniziale della scheda e\' quella che la prova rifa\'', /useState\(\(riga\.contratto && riga\.contratto\.modello_id && modelliBuoni\.some\(m => m\.id === riga\.contratto\.modello_id\) && riga\.contratto\.modello_id\)\s*\|\| riga\.modello_id \|\| \(modelliBuoni\[0\] && modelliBuoni\[0\]\.id\) \|\| ''\)/.test(pagina));
const sceltaDellaScheda = (j, r) => {
  const buoni = (j.modelli || []).filter(m => modelloAdatto(m, r));
  const scelto = (r.contratto && r.contratto.modello_id && buoni.some(m => m.id === r.contratto.modello_id) && r.contratto.modello_id) || r.modello_id || (buoni[0] && buoni[0].id) || '';
  return { buoni: buoni.map(m => m.id).sort(), scelto };
};

// 1. Il contratto coi due prezzi, firmato, e un'ACI che non ha ancora viaggiato
//    nell'anno: nel A l'ACI di Nappi Sud a settembre (raccolta e stoccaggio).
const dbFermoAci = (contratti, modelli = [modR, modRS, modS]) => base({
  PrimariaAci: [mov('NAPPI SUD SRL', 'IRIGOM SRL', 'imp', `${A}-09-10`), mov('EMMESSE SRLS', 'NAPPI SUD SRL', 'stoc', `${A}-09-12`)],
  Fornitore: [{ id: 'f-nappi', ragione_sociale: 'NAPPI SUD SRL', piva: '02556750657' }],
  ContrattoFornitore: contratti, ModelloContratto: modelli,
});
const unicoNappi = { id: 'k-nappi-aci', anno: B, soggetto_chiave: 'nappi sud', soggetto_nome: 'NAPPI SUD SRL', tipo_contratto: 'raccolta', canale: 'ACI', stato: 'controfirmato',
  controfirmato_il: `${A}-12-20`, modello_id: 'mod-rs-aci', valori_json: JSON.stringify({ CORRISPETTIVO_RACCOLTA: 92, CORRISPETTIVO_STOCCAGGIO: 16 }), data_inizio: `${B}-01-02`, data_fine: `${B}-12-31` };
for (const [quando, oggiC] of [['a dicembre', `${A}-12-15`], ['il 15/04, senza ancora un viaggio ACI dell\'anno', `${B}-04-15`]]) {
  const j = await situazione(dbFermoAci([unicoNappi]), B, oggiC);
  const r = riga(j, 'nappi sud', 'raccolta', 'ACI');
  const s = riga(j, 'nappi sud', 'stoccaggio', 'ACI');
  verifica(`contratto ${B} di Nappi Sud coi due prezzi, firmato, guardato ${quando}: resta di raccolta e stoccaggio, col suo modello`,
    r?.stato === 'controfirmato' && r.raccolta_e_stoccaggio === true && r.modello_id === 'mod-rs-aci' && r.si_puo_unire_lo_stoccaggio === false, JSON.stringify(r && [r.stato, r.raccolta_e_stoccaggio, r.modello_id, r.si_puo_unire_lo_stoccaggio]));
  verifica(`...e lo stoccaggio ACI sta dentro: non dovuto, non da decidere (${quando})`, s?.non_dovuto === true && s.da_decidere === false
    && !(j.soggetti || []).some(x => x.contratti.some(c => c.da_decidere && x.chiave === 'nappi sud' && c.tipo === 'stoccaggio')), JSON.stringify(s && [s.stato, s.non_dovuto, s.da_decidere]));
  const sc = sceltaDellaScheda(j, r || {});
  verifica(`...e la scheda, riaprendolo, propone il suo modello coi due prezzi (${quando})`, sc.scelto === 'mod-rs-aci' && sc.buoni.join() === 'mod-rs-aci', JSON.stringify(sc));
  verifica(`...con la proposta dei due prezzi (${quando})`, r?.proposta && 'CORRISPETTIVO_STOCCAGGIO' in valoriDiPartenza(r).valori && valoriDiPartenza(r).valori.CORRISPETTIVO_STOCCAGGIO === 16,
    JSON.stringify(r && valoriDiPartenza(r)));
}

// 2. Il modello del contratto e' stato poi sostituito da un format nuovo, e nei
//    valori salvati il prezzo dello stoccaggio non c'e' (era vuoto). Lo dice il
//    modello, e la funzione deve leggere anche i modelli sostituiti. Funzione
//    intera, nell'anno in corso: la raccolta ACI c'e' quest'anno, lo stoccaggio
//    ACI solo l'anno prima (i movimenti da soli non direbbero «un contratto solo»).
const modRSVecchio = { ...modRS, id: 'mod-rs-vecchio', stato: 'sostituito' };
const dbSostituito = base({
  PrimariaAci: [mov('NAPPI SUD SRL', 'IRIGOM SRL', 'imp', `${A}-03-10`), mov('EMMESSE SRLS', 'NAPPI SUD SRL', 'stoc', `${A - 1}-06-12`)],
  Fornitore: [{ id: 'f-nappi', ragione_sociale: 'NAPPI SUD SRL' }],
  ModelloContratto: [modR, { ...modRS, created_date: `${A}-06-01` }, modRSVecchio, modS],
  ContrattoFornitore: [{ ...unicoNappi, id: 'k-sost', anno: A, modello_id: 'mod-rs-vecchio', valori_json: JSON.stringify({ CORRISPETTIVO_RACCOLTA: 92 }) }],
});
const cSost = await chiama(modulo, { db: dbSostituito, corpo: { anno: A } });
const rSost = riga(cSost.j, 'nappi sud', 'raccolta', 'ACI');
verifica('un contratto fatto col modello coi due prezzi poi sostituito resta di raccolta e stoccaggio (la funzione legge anche i modelli sostituiti)',
  rSost?.raccolta_e_stoccaggio === true && riga(cSost.j, 'nappi sud', 'stoccaggio', 'ACI')?.non_dovuto === true,
  JSON.stringify([rSost?.raccolta_e_stoccaggio, riga(cSost.j, 'nappi sud', 'stoccaggio', 'ACI')?.stato]));
verifica('...ma da proporre e da scegliere restano solo i modelli attivi', !(cSost.j.modelli || []).some(m => m.id === 'mod-rs-vecchio') && rSost?.modello_id === 'mod-rs-aci'
  && sceltaDellaScheda(cSost.j, rSost || {}).scelto === 'mod-rs-aci', JSON.stringify([(cSost.j.modelli || []).map(m => m.id), rSost?.modello_id]));

// 3. Il contratto di sola raccolta ACI firmato a febbraio, e lo stoccaggio ACI
//    che comincia a settembre: il caso del revisore (Ecorecuperi). Funzione intera.
const dbEco = (contratti) => base({
  PrimariaAci: [mov('ECORECUPERI SRL', 'IRIGOM SRL', 'imp', `${A}-02-10`), mov('EMMESSE SRLS', 'ECORECUPERI SRL', 'stoc', `${A}-09-10`)],
  Fornitore: [{ id: 'f-eco', ragione_sociale: 'ECORECUPERI SRL', piva: '00377110945' }],
  Tariffa: [
    tariffa('ECORECUPERI SRL', 'RACCOLTA', 'ACI', 105, `${A}-01-01`, `${A}-12-31`),
    tariffa('ECORECUPERI SRL', 'CONFERIMENTO_STOCCAGGIO', 'ACI', 12, `${A}-09-01`, `${A}-12-31`),
  ],
  ModelloContratto: [modR, modRS, modS],
  ContrattoFornitore: contratti,
});
const soloRaccolta = { id: 'k-eco', anno: A, soggetto_chiave: 'ecorecuperi', soggetto_nome: 'ECORECUPERI SRL', tipo_contratto: 'raccolta', canale: 'ACI', stato: 'controfirmato',
  controfirmato_il: `${A}-02-01`, modello_id: 'mod-r-aci', valori_json: JSON.stringify({ CORRISPETTIVO_RACCOLTA: 105 }), data_inizio: `${A}-02-01`, data_fine: `${A}-12-31` };
const cEco = await chiama(modulo, { db: dbEco([soloRaccolta]), corpo: { anno: A } });
const rEco = riga(cEco.j, 'ecorecuperi', 'raccolta', 'ACI');
const sEco = riga(cEco.j, 'ecorecuperi', 'stoccaggio', 'ACI');
verifica('contratto di sola raccolta ACI firmato, e poi lo stoccaggio ACI: la raccolta resta di sola raccolta', rEco?.stato === 'controfirmato' && rEco.raccolta_e_stoccaggio === false
  && rEco.modello_id === 'mod-r-aci', JSON.stringify(rEco && [rEco.stato, rEco.raccolta_e_stoccaggio, rEco.modello_id]));
verifica('...e lo stoccaggio ACI e\' un contratto da fare: mancante, atteso, contato (4 attesi, 3 da fare)', sEco?.stato === 'mancante' && sEco.non_dovuto === false && sEco.da_decidere === false
  && cEco.j.totali.attesi === 4 && cEco.j.totali.da_fare === 3, JSON.stringify([sEco && [sEco.stato, sEco.non_dovuto, sEco.motivo_non_dovuto], cEco.j.totali]));
verifica('...la raccolta si puo\' rigenerare coi due prezzi: la scheda offre tutti e due i modelli e parte da quello del contratto',
  rEco?.si_puo_unire_lo_stoccaggio === true && JSON.stringify(sceltaDellaScheda(cEco.j, rEco || {})) === JSON.stringify({ buoni: ['mod-r-aci', 'mod-rs-aci'], scelto: 'mod-r-aci' }),
  JSON.stringify([rEco?.si_puo_unire_lo_stoccaggio, sceltaDellaScheda(cEco.j, rEco || {})]));
verifica('...con il prezzo dello stoccaggio ACI pronto (12) e gli avvisi sulle due righe', rEco?.proposta?.valori?.CORRISPETTIVO_STOCCAGGIO === 12
  && (rEco.proposta.avvisi || []).some(a => /^Il contratto di raccolta ACI fatto è di sola raccolta.*rigeneralo col modello della raccolta e stoccaggio/.test(a))
  && (sEco?.proposta?.avvisi || []).some(a => /^Il contratto di raccolta ACI di questo fornitore è di sola raccolta: lo stoccaggio ACI non ce l'ha/.test(a)),
  JSON.stringify([rEco?.proposta?.valori, rEco?.proposta?.avvisi, sEco?.proposta?.avvisi]));
// Rigenerato col modello della raccolta e stoccaggio: un contratto solo.
const cEco2 = await chiama(modulo, { db: dbEco([{ ...soloRaccolta, stato: 'generato', modello_id: 'mod-rs-aci', valori_json: JSON.stringify({ CORRISPETTIVO_RACCOLTA: 105, CORRISPETTIVO_STOCCAGGIO: 12 }) }]), corpo: { anno: A } });
verifica('rigenerato col modello coi due prezzi: un contratto solo, lo stoccaggio ACI sta dentro (3 attesi)',
  riga(cEco2.j, 'ecorecuperi', 'raccolta', 'ACI')?.raccolta_e_stoccaggio === true && riga(cEco2.j, 'ecorecuperi', 'raccolta', 'ACI')?.si_puo_unire_lo_stoccaggio === false
  && riga(cEco2.j, 'ecorecuperi', 'stoccaggio', 'ACI')?.non_dovuto === true && cEco2.j.totali.attesi === 3, JSON.stringify(cEco2.j.totali));
// Rigenerato ancora col modello della sola raccolta: i valori della proposta
// portano il prezzo dello stoccaggio, ma il modello no. Decide il modello.
const cEco3 = await chiama(modulo, { db: dbEco([{ ...soloRaccolta, valori_json: JSON.stringify({ CORRISPETTIVO_RACCOLTA: 105, CORRISPETTIVO_STOCCAGGIO: 12 }) }]), corpo: { anno: A } });
verifica('un contratto col modello della sola raccolta resta di sola raccolta anche se fra i valori salvati c\'e\' il prezzo dello stoccaggio',
  riga(cEco3.j, 'ecorecuperi', 'raccolta', 'ACI')?.raccolta_e_stoccaggio === false && riga(cEco3.j, 'ecorecuperi', 'stoccaggio', 'ACI')?.stato === 'mancante', JSON.stringify(cEco3.j.totali));
// Il contratto coi due prezzi e anche uno di stoccaggio ACI a parte: quello a
// parte c'e', resta suo e si conta.
const cEco4 = await chiama(modulo, { db: dbEco([{ ...soloRaccolta, modello_id: 'mod-rs-aci' },
  { id: 'k-eco-st', anno: A, soggetto_chiave: 'ecorecuperi', soggetto_nome: 'ECORECUPERI SRL', tipo_contratto: 'stoccaggio', canale: 'ACI', stato: 'generato', modello_id: 'mod-s-aci' }]), corpo: { anno: A } });
verifica('con anche un contratto di stoccaggio ACI a parte, quello resta suo e si conta', riga(cEco4.j, 'ecorecuperi', 'stoccaggio', 'ACI')?.stato === 'generato'
  && riga(cEco4.j, 'ecorecuperi', 'stoccaggio', 'ACI')?.non_dovuto === false && cEco4.j.totali.attesi === 4, JSON.stringify(cEco4.j.totali));

// 4. La regola, nei due specchi.
for (const [nome, mod] of [['funzione', segnapostiFunzione], ['pagina', segnapostiPagina]]) {
  const f = mod.eContrattoRaccoltaEStoccaggio;
  const c = (extra) => ({ tipo_contratto: 'raccolta', canale: 'ACI', ...extra });
  verifica(`${nome}: eContrattoRaccoltaEStoccaggio, decide il modello del contratto; senza modello i valori salvati`, typeof f === 'function'
    && f(c({ valori_json: '{}' }), modRS) === true && f(c({ valori_json: JSON.stringify({ CORRISPETTIVO_STOCCAGGIO: 16 }) }), modR) === false
    && f(c({ valori_json: JSON.stringify({ CORRISPETTIVO_RACCOLTA: 92, CORRISPETTIVO_STOCCAGGIO: 16 }) })) === true && f(c({ valori: { CORRISPETTIVO_STOCCAGGIO_2: '' } })) === true
    && f(c({ valori_json: JSON.stringify({ CORRISPETTIVO_RACCOLTA: 92 }) })) === false && f(c({ valori_json: 'non e\' json' })) === false
    && f({ tipo_contratto: 'raccolta', canale: 'RETE', valori_json: JSON.stringify({ CORRISPETTIVO_STOCCAGGIO: 15 }) }) === false
    && f({ tipo_contratto: 'stoccaggio', canale: 'ACI', valori_json: JSON.stringify({ CORRISPETTIVO_STOCCAGGIO: 15 }) }) === false && f(null) === false);
}

// 5. La scheda: il nome del file lo dice il modello scelto, e la riga che si puo'
//    unire ha la sua spiegazione.
verifica('la scheda: il file si chiama «Raccolta e stoccaggio ACI» quando il modello scelto ha i due prezzi',
  /const nomeFile = eModelloRaccoltaEStoccaggio\(modello\) \? nomeBase\.replace/.test(pagina), (pagina.match(/const nomeFile = [^\n]*/) || [''])[0]);
verifica('la scheda: la raccolta di sola raccolta che si puo\' unire allo stoccaggio lo spiega', /\{riga\.si_puo_unire_lo_stoccaggio && \(/.test(pagina));

// IL CONTRATTO DI ECORECUPERI DEL 2024 HA UN PREZZO SOLO (revisione del
// 14/10/2026). I commenti dicevano che i contratti veri di Nappi Sud 2026 ed
// Ecorecuperi 2024 hanno i due prezzi: quello di Ecorecuperi ha «Prezzo
// Trasporto+Stoccaggio» 105,00, uno solo. Caricato nella riga «Raccolta e
// stoccaggio ACI» si rifiuta, giustamente, ma il messaggio chiedeva di
// aggiungere un prezzo che nel documento non c'e'.
console.log('IL CONTRATTO DI ECORECUPERI DEL 2024 HA UN PREZZO SOLO');
const sorgente = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r/g, '');
const dueEco = new RegExp(['Nappi Sud 2026 ed', 'Ecorecuperi 2024'].join(String.raw`\s*(?:\/\/\s*)?`));
const conDueEco = ['../base44/shared/segnapostiContratto.ts', '../src/lib/segnapostiContratto.js', '../base44/shared/contrattiDellAnno.ts'].filter(p => dueEco.test(sorgente(p)));
verifica('nessun commento dice piu\' che Ecorecuperi 2024 ha i due prezzi', conDueEco.length === 0, conDueEco.join(', '));
verifica('«Modelli dei contratti»: a un format col prezzo solo dice che serve un format coi due prezzi, non di aggiungere un prezzo che non c\'e\'',
  /Se il format ha un prezzo solo per raccolta e stoccaggio insieme \(come quello di Ecorecuperi del 2024\), non è questo modello: serve un format coi due prezzi/.test(sezioneModelli));
const CARTELLA_CONTRATTI = 'C:/Users/HOME/Desktop/ECOTYRE/ECOTYRE - repository/2026/CONTRATTI SUBFORNITORI/';
const NAPPI_ACI = 'NAPPI SUD/2026/Contratto ACI 2026 - Nappi Sud - Raccolta e stoccaggio - (dal 1 aprile 2026).docx';
const ECO_ACI = 'ECORECUPERI/2024/Ecorecuperi_ACI 2024 Raccolta&stoccaggio.docx';
if (!existsSync(CARTELLA_CONTRATTI + NAPPI_ACI) || !existsSync(CARTELLA_CONTRATTI + ECO_ACI)) {
  console.log('  i format veri non ci sono su questo computer, salto');
} else {
  const { leggiFormat, proponiPunti } = await import('../src/lib/modelliContratto.js');
  const comeFile = (u8) => ({ name: 'format.docx', arrayBuffer: async () => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) });
  const prezziDel = async (file) => {
    const p = proponiPunti(await leggiFormat(comeFile(new Uint8Array(readFileSync(CARTELLA_CONTRATTI + file)))), { tipo: 'raccolta', oggi: `${A}-10-14` });
    return p.punti.filter(x => x.tipo === 'prezzo' && (x.attivo || x.gia_segnaposto)).map(x => `${x.segnaposto}=${x.originale}`).sort();
  };
  // la regola di «Modelli dei contratti» (conPrezzoStoccaggio)
  const conStoccaggio = (prezzi) => prezzi.some(x => x.split('=')[0].replace(/_\d+$/, '') === 'CORRISPETTIVO_STOCCAGGIO');
  const nappiPrezzi = await prezziDel(NAPPI_ACI);
  const ecoPrezzi = await prezziDel(ECO_ACI);
  verifica('format veri: il contratto ACI 2026 di Nappi Sud ha i due prezzi (raccolta 92,00 e 82,00, stoccaggio 16,00) e va nella riga «Raccolta e stoccaggio ACI»',
    nappiPrezzi.join() === 'CORRISPETTIVO_RACCOLTA=92,00,CORRISPETTIVO_RACCOLTA_2=82,00,CORRISPETTIVO_STOCCAGGIO=16,00' && conStoccaggio(nappiPrezzi), nappiPrezzi.join('; '));
  verifica('format veri: quello di Ecorecuperi del 2024 ha un prezzo solo (105,00, trasporto e stoccaggio insieme) e in quella riga non va',
    ecoPrezzi.join() === 'CORRISPETTIVO_RACCOLTA=105,00' && !conStoccaggio(ecoPrezzi), ecoPrezzi.join('; '));
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
  // Dal 13/10/2026 la raccolta e lo stoccaggio ACI di Nappi Sud sono un contratto
  // solo: un atteso in meno a ottobre e a dicembre (33 -> 32), un «da decidere»
  // in meno a gennaio (21 -> 20) e ad aprile (32 -> 31).
  verifica('dati veri, 08/01/2027: chi ha lavorato a ottobre e\' atteso (13 attesi, non 3)', vGen.totali.attesi === 13 && vGen.da_decidere === 20, `${JSON.stringify(vGen.totali)} ${vGen.da_decidere}`);
  verifica('dati veri, 15/12/2026: 32 attesi (33 prima del contratto unico di Nappi Sud), nessuno da decidere', vDic.totali.attesi === 32 && vDic.da_decidere === 0, JSON.stringify(vDic.totali));
  verifica('dati veri, 02/04/2027: come prima (3 attesi)', vApr.totali.attesi === 3 && vApr.da_decidere === 31, `${JSON.stringify(vApr.totali)} ${vApr.da_decidere}`);
  verifica('dati veri, ottobre 2026: 32 attesi (33 prima), 19 da decidere', vOtt.totali.attesi === 32 && vOtt.da_decidere === 19, JSON.stringify(vOtt.totali));
  const nappi = (j, tipo, canale) => ((j.soggetti.find(s => /nappi sud/i.test(s.nome)) || {}).contratti || []).find(c => c.tipo === tipo && c.canale === canale);
  verifica('dati veri, ottobre 2026: Nappi Sud ha la raccolta e stoccaggio ACI col prezzo dello stoccaggio (16), e lo stoccaggio ACI non dovuto',
    nappi(vOtt, 'raccolta', 'ACI')?.raccolta_e_stoccaggio === true && nappi(vOtt, 'raccolta', 'ACI')?.proposta?.valori?.CORRISPETTIVO_STOCCAGGIO === 16
    && nappi(vOtt, 'stoccaggio', 'ACI')?.non_dovuto === true && nappi(vOtt, 'raccolta', 'RETE')?.raccolta_e_stoccaggio === false && nappi(vOtt, 'stoccaggio', 'RETE')?.non_dovuto === false,
    JSON.stringify(['raccolta', 'stoccaggio'].flatMap(t => ['RETE', 'ACI'].map(c => [t, c, nappi(vOtt, t, c)?.raccolta_e_stoccaggio, nappi(vOtt, t, c)?.non_dovuto]))));
  const unite = (j) => j.soggetti.filter(s => s.contratti.some(c => c.raccolta_e_stoccaggio)).map(s => s.nome);
  verifica('dati veri: nel 2026 e nel 2027 il contratto unico ce l\'ha solo Nappi Sud (Ecorecuperi nel 2026 sull\'ACI non raccoglie ne\' stocca)',
    unite(vOtt).length === 1 && /nappi/i.test(unite(vOtt)[0]) && unite(vDic).length === 1, JSON.stringify([unite(vOtt), unite(vDic)]));
  // Revisione del 14/10/2026, il caso del revisore: il contratto 2027 di Nappi Sud
  // coi due prezzi generato a dicembre e controfirmato. Il 15/04/2027 Nappi Sud
  // non ha ancora un viaggio ACI del 2027: prima il contratto si spezzava (lo
  // stoccaggio ACI da decidere a parte, 34 da decidere), ora resta uno (33).
  const chiaveNappi = (vOtt.soggetti.find(s => /nappi sud/i.test(s.nome)) || {}).chiave;
  const unico2027 = { id: 'k-nappi-aci-2027', anno: 2027, soggetto_chiave: chiaveNappi, soggetto_nome: 'NAPPI SUD SRL', tipo_contratto: 'raccolta', canale: 'ACI', stato: 'controfirmato',
    modello_id: 'mod-rs-aci', valori_json: JSON.stringify({ CORRISPETTIVO_RACCOLTA: 92, CORRISPETTIVO_STOCCAGGIO: 16 }), data_inizio: '2027-01-02', data_fine: '2027-12-31' };
  const vNappi = { ...V, QualificaInclusione: [], ContrattoFornitore: [unico2027], ModelloContratto: [modR, modRS] };
  for (const oggiC of ['2026-12-15', '2027-04-15']) {
    const j = await situazione(vNappi, 2027, oggiC);
    console.log(`  2027 col contratto unico di Nappi Sud firmato, guardati il ${oggiC.split('-').reverse().join('/')}: ${JSON.stringify(j.totali)}, da decidere ${j.da_decidere}`);
    const r = nappi(j, 'raccolta', 'ACI');
    verifica(`dati veri, il ${oggiC.split('-').reverse().join('/')}: il contratto 2027 di Nappi Sud coi due prezzi resta uno, e la scheda ripropone il suo modello`,
      r?.raccolta_e_stoccaggio === true && r.modello_id === 'mod-rs-aci' && nappi(j, 'stoccaggio', 'ACI')?.non_dovuto === true && sceltaDellaScheda(j, r).scelto === 'mod-rs-aci'
      && j.da_decidere === (oggiC === '2027-04-15' ? 33 : 0), JSON.stringify([r && [r.raccolta_e_stoccaggio, r.modello_id], nappi(j, 'stoccaggio', 'ACI')?.stato, j.da_decidere]));
  }

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
  // 31 e non piu' 32 (13/10/2026): lo stoccaggio ACI di Nappi Sud sta nel suo
  // contratto di raccolta e stoccaggio, che porta le copie di tutti e due i prezzi.
  verifica('dati veri: dopo la copia nessun contratto 2027 propone il prezzo del 2026 (erano 23), e le copie sono fra i riferimenti di 31', copie.length === 58 && conPrezzoCopiato === 0 && conAvviso === 31, `${copie.length} ${conPrezzoCopiato} ${conAvviso}`);
  const rsCop = riga(vCop, 'nappi sud', 'raccolta', 'ACI');
  verifica('dati veri: la raccolta e stoccaggio ACI 2027 di Nappi Sud ha fra i riferimenti le copie della raccolta e dello stoccaggio, senza prezzo proposto',
    (rsCop?.proposta?.tariffe_copiate || []).some(t => t.servizio === 'stoccaggio') && (rsCop?.proposta?.tariffe_copiate || []).some(t => t.servizio === 'raccolta')
    && rsCop.proposta.valori.CORRISPETTIVO_STOCCAGGIO === undefined && rsCop.proposta.avvisi.some(a => /^Per lo stoccaggio, tariffa .* copiata dal 2026/.test(a)), JSON.stringify(rsCop?.proposta?.tariffe_copiate));

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
