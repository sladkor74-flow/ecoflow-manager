// Prova del calcolo della fatturazione attiva (base44/shared/attivaCalcolo.ts)
// con dati di esempio: periodo sul giorno italiano, tariffa chiusa valida fino
// all'ultimo giorno, extra raccolta al prezzo dell'intervento, riconciliazione.
// Si lancia con: npm run prove
import { calcolaRigheAttiva, riconciliaAttiva, documentoValido } from '../base44/shared/attivaCalcolo.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const tariffe = [
  { id: 't-rete', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01' },
  // tariffa ACI rinegoziata: 700 fino al 30 giugno, 750 dal 1 luglio
  { id: 't-aci-1', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: 'Campania', valore: 700, unita_misura: '€/t', stato: 'non_attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-06-30' },
  { id: 't-aci-2', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: 'Campania', valore: 750, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-07-01' },
  { id: 't-extra', direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo' },
  { id: 't-vecchia-spenta', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', classe_materiale: 'ZZ', valore: 1, unita_misura: '€/t', stato: 'non_attivo' },
];
const fornitori = [{ ragione_sociale: 'IRIGOM SRL', trattamento_fatturato_da_ecotyre: true }, { ragione_sociale: 'TECNOGUM SRL' }];
const base = { stato: 'terminato', cer: '160103' };
const reteAll = [
  { ...base, id: 'r1', id_ordine: 'ET1', numero_fir: 'F1', classe: 'A', peso_effettivo: 1000, trasporto_finito_il: '2026-06-30T00:00:00.000Z', destinazione: 'Irigom s.r.l.', provincia: 'NA' },
  // fine trasporto il 30 giugno alle 23:30 italiane = 21:30Z: e' ancora giugno
  { ...base, id: 'r2', id_ordine: 'ET2', numero_fir: 'F2', classe: 'A', peso_effettivo: 2500, trasporto_finito_il: '2026-06-30T21:30:00.000Z', destinazione: 'Tecnogum', regione: 'Puglia' },
  // mezzanotte italiana del 1 luglio = 22:00Z del 30 giugno: e' luglio
  { ...base, id: 'r3', id_ordine: 'ET3', numero_fir: 'F3', classe: 'A', peso_effettivo: 9999, trasporto_finito_il: '2026-06-30T22:00:00.000Z', destinazione: 'Tecnogum' },
  { ...base, id: 'r4', id_ordine: 'ET4', numero_fir: 'F4', classe: 'A', peso_effettivo: 500, trasporto_finito_il: '2026-06-10T00:00:00.000Z', stato: 'cancellato' },
  { ...base, id: 'r5', id_ordine: 'ET5', numero_fir: 'F5', classe: 'A', peso_effettivo: 0, trasporto_finito_il: '2026-06-10T00:00:00.000Z' },
];
const aciAll = [
  // ultimo giorno della tariffa vecchia, con l'ora vera: deve prendere 700, non restare senza prezzo
  { ...base, id: 'a1', id_ordine: 'EA1', numero_fir: 'FA1', classe: 'C', regione: 'Campania', peso_effettivo: 2000, trasporto_finito_il: '2026-06-30T10:00:00.000Z', numero_ordine_interno: '162399-21' },
  { ...base, id: 'a2', id_ordine: 'EA2', numero_fir: 'FA2', classe: 'C', regione: 'Molise', peso_effettivo: 1500, trasporto_finito_il: '2026-06-12T00:00:00.000Z' },
];
const extraAll = [
  { ...base, id: 'x1', id_ordine: 'EX1', numero_fir: 'FX1', classe: 'A', peso_effettivo: 460, trasporto_finito_il: '2026-06-15T00:00:00.000Z', prezzo_attivo_t: 350, sovracosto_raccolta: 120, sovracosto_trasporto: 0, sovracosto_trattamento: 45.5, provincia: 'BA' },
  { ...base, id: 'x2', id_ordine: 'EX2', numero_fir: 'FX2', classe: 'A', peso_effettivo: 400, trasporto_finito_il: '2026-06-16T00:00:00.000Z', prezzo_attivo_t: 202 },
  { ...base, id: 'x3', id_ordine: 'EX3', numero_fir: 'FX3', classe: 'A', peso_effettivo: 400, trasporto_finito_il: '2026-06-20T00:00:00.000Z', prezzo_attivo_t: 202, tipo_movimento: 'secondaria', stoccaggio: 'NAPPI SUD' },
  { ...base, id: 'x4', id_ordine: 'EX4', numero_fir: 'FX4', classe: 'A', peso_effettivo: 300, trasporto_finito_il: '2026-06-21T00:00:00.000Z', prezzo_attivo_t: 0 },
];

const g = calcolaRigheAttiva({ reteAll, aciAll, extraAll, fornitori, tariffe, anno: 2026, mese: 'Giugno' });
console.log('GIUGNO');
verifica('rete: 2 righe (no cancellato, no peso zero, no 1 luglio italiano)', g.righe.RETE.length === 2, JSON.stringify(g.righe.RETE.map(r => r.ordine)));
verifica('rete r1: 1 t x 202 = 202', g.righe.RETE[0].totale === 202 && g.righe.RETE[0].servizio_ecotyre === 'TRASP' && g.righe.RETE[0].regione === 'Campania');
verifica('rete r2: 2,5 t x 202 = 505', g.righe.RETE[1].totale === 505 && g.righe.RETE[1].servizio_ecotyre === 'TRASP_TRATT');
const a1 = g.righe.ACI.find(r => r.ordine === 'EA1'), a2 = g.righe.ACI.find(r => r.ordine === 'EA2');
verifica('aci a1: ultimo giorno della tariffa chiusa, 2 t x 700 = 1400', a1.totale === 1400 && a1.tariffa_id === 't-aci-1' && a1.ticket_n === '162399-21', JSON.stringify(a1));
verifica('aci a2: Molise senza tariffa = errore, non verificato', a2.totale === 0 && a2.stato_validazione === 'errore');
verifica('anomalia senza tariffa', g.anomalie.some(a => a.tipo === 'senza_tariffa' && a.tipologia === 'ACI' && a.regione === 'Molise' && a.tonnellate === 1.5));
const x = g.righe.EXTRA_RACCOLTA;
verifica('extra: 3 interventi + 2 sovracosti = 5 righe, secondaria esclusa', x.length === 5 && !x.some(r => r.ordine === 'EX3'), String(x.length));
const x1 = x.filter(r => r.ordine === 'EX1');
verifica('extra x1: 0,46 t x 350 = 161 + 120 + 45,5', x1.length === 3 && x1[0].totale === 161 && x1[1].totale === 120 && x1[2].totale === 45.5 && x1[1].quantita === 0 && x1[1].descrizione === 'Sovracosto raccolta');
verifica('extra x1: stesso ricavo della pagina Extra Raccolta (326,50)', Math.abs(x1.reduce((s, r) => s + r.totale, 0) - 326.5) < 0.001);
verifica('extra x2: 0,4 t x 202 = 80,80', x.find(r => r.ordine === 'EX2').totale === 80.8);
verifica('extra x4 a prezzo zero: da controllare + anomalia col prezzo di contratto', x.find(r => r.ordine === 'EX4').stato_validazione === 'da_controllare' && g.anomalie.some(a => a.tipo === 'prezzo_zero' && /202/.test(a.descrizione)));
verifica('secondaria esclusa segnalata', g.extra_secondarie_escluse === 1 && g.anomalie.some(a => a.tipo === 'informazione'));

const l = calcolaRigheAttiva({ reteAll, aciAll, extraAll, fornitori, tariffe, anno: 2026, mese: 'Luglio' });
console.log('LUGLIO');
verifica('rete r3 (22:00Z del 30/6) sta a luglio', l.righe.RETE.length === 1 && l.righe.RETE[0].ordine === 'ET3');

console.log('RICONCILIAZIONE');
const salvate = g.righe.RETE.map(r => ({ ...r }));
verifica('documento appena elaborato: allineato', riconciliaAttiva(g.righe.RETE, salvate).allineato === true);
// arriva dopo un movimento del 29 giugno, uno cambia peso, uno sparisce
const dopo = calcolaRigheAttiva({
  reteAll: [...reteAll.filter(r => r.id !== 'r1').map(r => r.id === 'r2' ? { ...r, id: 'nuovo-id', peso_effettivo: 2600 } : r),
    { ...base, id: 'r9', id_ordine: 'ET9', numero_fir: 'F9', classe: 'A', peso_effettivo: 3000, trasporto_finito_il: '2026-06-29T00:00:00.000Z', destinazione: 'Tecnogum' }],
  aciAll, extraAll, fornitori, tariffe, anno: 2026, mese: 'Giugno',
});
const ric = riconciliaAttiva(dopo.righe.RETE, salvate);
verifica('1 nuovo, 1 cambiato (anche con id del record diverso), 1 sparito', ric.nuovi.length === 1 && ric.cambiati.length === 1 && ric.spariti.length === 1 && !ric.allineato, JSON.stringify(ric));
verifica('delta kg = +3000 +100 -1000 = 2100; delta euro = 606 + 20,2 - 202 = 424,2', ric.delta_kg === 2100 && ric.delta_euro === 424.2, ric.delta_kg + ' ' + ric.delta_euro);
const ricX = riconciliaAttiva(x, x.map(r => ({ ...r })));
verifica('extra con sovracosti: allineato (le righe a corpo hanno la loro chiave)', ricX.allineato);

console.log('DOCUMENTO VALIDO');
const docs = [
  { id: 'd1', tipologia: 'RETE', stato: 'approvata', superato: true, data_elaborazione: '2026-09-01' },
  { id: 'd2', tipologia: 'RETE', stato: 'bozza', data_elaborazione: '2026-09-20' },
  { id: 'd3', tipologia: 'RETE', stato: 'elaborata', data_elaborazione: '2026-09-10' },
  { id: 'd4', tipologia: 'RETE', stato: 'elaborata', data_elaborazione: '2026-09-15' },
];
verifica('sceglie il piu\' recente non superato e non bozza', documentoValido(docs, 'RETE').id === 'd4' && documentoValido(docs, 'ACI') === null);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
