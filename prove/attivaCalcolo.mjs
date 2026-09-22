// Prova del calcolo della fatturazione attiva (base44/shared/attivaCalcolo.ts)
// con dati di esempio: periodo sul giorno italiano, tariffa chiusa valida fino
// all'ultimo giorno, extra raccolta al prezzo dell'intervento, riconciliazione.
// Si lancia con: npm run prove
import { readFileSync } from 'node:fs';
import { calcolaRigheAttiva, riconciliaAttiva, documentoValido } from '../base44/shared/attivaCalcolo.ts';
import { TARIFFA_BASE_EXTRA_RACCOLTA, tariffaBaseExtraRaccolta } from '../base44/shared/ecotyreTariffe.ts';
import { TARIFFA_BASE_EXTRA_RACCOLTA as BASE_PAGINA, prezzoAttivoExtra as prezzoAttivoPagina } from '../src/lib/extraRaccoltaCalc.js';

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
// Regola dell'utente del 22/09/2026: senza un prezzo scritto vale la tariffa
// base Ecotyre, quella della tabella se c'e', altrimenti 202 €/t nel 2026.
const x4 = x.find(r => r.ordine === 'EX4');
verifica('extra x4 a prezzo zero: tariffa base dalla tabella, 0,3 t x 202 = 60,60, verificata', x4.totale === 60.6 && x4.tariffa_valore === 202 && x4.tariffa_id === 't-extra' && x4.stato_validazione === 'verificato' && /Tariffa base Ecotyre 2026: 202/.test(x4.note), JSON.stringify(x4));
verifica('extra x4: con la base niente anomalia "prezzo zero"', !g.anomalie.some(a => a.tipo === 'prezzo_zero'), JSON.stringify(g.anomalie.filter(a => a.tipo === 'prezzo_zero')));
verifica('secondaria esclusa segnalata', g.extra_secondarie_escluse === 1 && g.anomalie.some(a => a.tipo === 'informazione'));

console.log('TARIFFA BASE EXTRA RACCOLTA');
// senza la EXTRA_RACCOLTA in tabella: la costante dell'anno
const senzaTabella = tariffe.filter(t => t.tipologia !== 'EXTRA_RACCOLTA');
const gb = calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll, fornitori, tariffe: senzaTabella, anno: 2026, mese: 'Giugno' });
const x4b = gb.righe.EXTRA_RACCOLTA.find(r => r.ordine === 'EX4');
verifica('senza tabella: 202 €/t della base 2026, e la riga dice da dove viene', x4b.totale === 60.6 && x4b.tariffa_valore === 202 && x4b.tariffa_id === 'base-2026' && x4b.stato_validazione === 'verificato' && x4b.note === 'Tariffa base Ecotyre 2026: 202 €/t (sull\'intervento il prezzo non e\' scritto)', JSON.stringify(x4b));
verifica('senza tabella: il prezzo scritto vince sulla base (x1 a 350)', gb.righe.EXTRA_RACCOLTA.find(r => r.ordine === 'EX1').tariffa_valore === 350 && !gb.anomalie.some(a => a.tipo === 'prezzo_zero'));
// un anno senza base e senza tabella: la riga e' un errore, e l'anomalia resta
const extra2027 = [{ ...base, id: 'y1', id_ordine: 'EY1', numero_fir: 'FY1', classe: 'A', peso_effettivo: 500, ordine_immesso_il: '2027-03-01T00:00:00.000Z', trasporto_iniziato_il: '2027-03-02T00:00:00.000Z', trasporto_finito_il: '2027-03-02T00:00:00.000Z', prezzo_attivo_t: 0 }];
const g27 = calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll: extra2027, fornitori, tariffe: senzaTabella, anno: 2027, mese: 'Marzo' });
verifica('2027 senza base: riga in errore a zero e anomalia "prezzo zero"', g27.righe.EXTRA_RACCOLTA[0].stato_validazione === 'errore' && g27.righe.EXTRA_RACCOLTA[0].totale === 0 && g27.anomalie.some(a => a.tipo === 'prezzo_zero' && /2027/.test(a.descrizione)), JSON.stringify(g27));
// la copia per il browser (modulo Extra Raccolta) dice lo stesso numero
verifica('base uguale nel gestionale e nella pagina Extra Raccolta', JSON.stringify(TARIFFA_BASE_EXTRA_RACCOLTA) === JSON.stringify(BASE_PAGINA) && tariffaBaseExtraRaccolta(2026) === 202 && tariffaBaseExtraRaccolta(2027) === null, JSON.stringify([TARIFFA_BASE_EXTRA_RACCOLTA, BASE_PAGINA]));
verifica('la pagina Extra Raccolta usa la base dove la fattura la usa', prezzoAttivoPagina(extraAll[3]).valore === 202 && prezzoAttivoPagina(extraAll[3]).base === true && prezzoAttivoPagina(extraAll[0]).valore === 350 && prezzoAttivoPagina({ ...extraAll[3], tipo_movimento: 'secondaria' }).valore === 0);
const sorgenteSeed = readFileSync(new URL('../base44/functions/seedTariffeAttive2026/entry.ts', import.meta.url), 'utf8');
verifica('la semina delle tariffe attive 2026 usa la stessa base', /tipologia: 'EXTRA_RACCOLTA', valore: TARIFFA_BASE_EXTRA_RACCOLTA\[2026\]/.test(sorgenteSeed));
// nella fattura entrano solo i terminati: un assegnato con la fine trasporto no
const conAssegnato = calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll: [...extraAll, { ...extraAll[1], id: 'x9', id_ordine: 'EX9', stato: 'assegnato' }], fornitori, tariffe, anno: 2026, mese: 'Giugno' });
verifica('extra assegnato: fuori dalla fattura anche con la fine trasporto nel mese', !conAssegnato.righe.EXTRA_RACCOLTA.some(r => r.ordine === 'EX9'));

console.log('DATE OBBLIGATORIE');
// Regola dell'utente del 22/09/2026: immissione, inizio e fine trasporto sono
// obbligatorie. Un terminato senza fine resta fuori dal mese ma si dice, per
// canale; uno del mese con altre date mancanti o fuori ordine si dice.
const conDate = (r) => ({ ...r, ordine_immesso_il: '2026-06-01T00:00:00.000Z', trasporto_iniziato_il: r.trasporto_finito_il });
const reteD = [
  conDate({ ...base, id: 'd1', id_ordine: 'ET31', numero_fir: 'FD1', classe: 'A', peso_effettivo: 1000, trasporto_finito_il: '2026-06-10T00:00:00.000Z' }),
  // terminato senza fine trasporto, immesso a giugno: potrebbe essere di giugno
  { ...base, id: 'd2', id_ordine: 'ET32', numero_fir: 'FD2', classe: 'A', peso_effettivo: 1200, ordine_immesso_il: '2026-06-05T00:00:00.000Z', trasporto_iniziato_il: '2026-06-06T00:00:00.000Z' },
  // del mese, ma senza inizio trasporto
  { ...base, id: 'd3', id_ordine: 'ET33', numero_fir: 'FD3', classe: 'A', peso_effettivo: 800, ordine_immesso_il: '2026-06-02T00:00:00.000Z', trasporto_finito_il: '2026-06-12T00:00:00.000Z' },
  // del mese, con la fine prima dell'inizio
  { ...base, id: 'd4', id_ordine: 'ET34', numero_fir: 'FD4', classe: 'A', peso_effettivo: 900, ordine_immesso_il: '2026-06-02T00:00:00.000Z', trasporto_iniziato_il: '2026-06-15T00:00:00.000Z', trasporto_finito_il: '2026-06-14T00:00:00.000Z' },
  // un assegnato senza fine non e' un terminato: niente
  { ...base, id: 'd5', id_ordine: 'ET35', stato: 'assegnato', peso_effettivo: 0, ordine_immesso_il: '2026-06-05T00:00:00.000Z' },
];
const aciD = [conDate({ ...base, id: 'd6', id_ordine: 'EA31', numero_fir: 'FAD1', classe: 'C', regione: 'Campania', peso_effettivo: 2000, trasporto_finito_il: '2026-06-11T00:00:00.000Z' })];
const gd = calcolaRigheAttiva({ reteAll: reteD, aciAll: aciD, extraAll: [], fornitori, tariffe, anno: 2026, mese: 'Giugno' });
const sfR = gd.anomalie.find(a => a.tipo === 'date_senza_fine' && a.tipologia === 'RETE');
verifica('senza fine trasporto: fuori dalla fattura del mese', !gd.righe.RETE.some(r => r.ordine === 'ET32') && gd.righe.RETE.length === 3, JSON.stringify(gd.righe.RETE.map(r => r.ordine)));
verifica('senza fine trasporto: anomalia di rete con quanti e quali', !!sfR && sfR.quanti === 1 && sfR.ordini[0].ordine === 'ET32' && /ET32/.test(sfR.descrizione) && /fine trasporto/.test(sfR.descrizione) && sfR.tonnellate === 1.2, JSON.stringify(sfR));
const dsR = gd.anomalie.find(a => a.tipo === 'date_da_sistemare' && a.tipologia === 'RETE');
verifica('del mese con le date da sistemare: restano in fattura e si dicono', !!dsR && dsR.quanti === 2 && /ET33.*inizio trasporto/.test(dsR.descrizione) && /ET34.*fine trasporto prima dell'inizio/.test(dsR.descrizione) && gd.righe.RETE.some(r => r.ordine === 'ET33'), JSON.stringify(dsR));
verifica('canali separati: l\'ACI in ordine non ha anomalie di date, e nessuna voce somma i canali', !gd.anomalie.some(a => String(a.tipo).startsWith('date_') && a.tipologia === 'ACI') && gd.anomalie.filter(a => String(a.tipo).startsWith('date_')).every(a => a.tipologia === 'RETE'));
const md = calcolaRigheAttiva({ reteAll: reteD, aciAll: aciD, extraAll: [], fornitori, tariffe, anno: 2026, mese: 'Maggio' });
verifica('immesso a giugno: a maggio non puo\' cadere, e non si segnala', !md.anomalie.some(a => a.tipo === 'date_senza_fine'));
const ld = calcolaRigheAttiva({ reteAll: reteD, aciAll: aciD, extraAll: [], fornitori, tariffe, anno: 2026, mese: 'Luglio' });
verifica('a luglio potrebbe ancora cadere: si segnala anche li\'', ld.anomalie.some(a => a.tipo === 'date_senza_fine' && a.tipologia === 'RETE' && a.quanti === 1));

// A cavallo d'anno (revisione del 22/09/2026): immesso il 20/12/2025, iniziato il
// 28/12, senza fine trasporto. Prima si segnalava solo a dicembre 2025 e mai nel
// 2026, dove quasi certamente e' finito. Ora si segnala anche nei mesi del 2026
// fino a quello in cui cadono i 60 giorni dopo l'inizio trasporto (26/02/2026).
const aCavallo = [
  { ...base, id: 'c1', id_ordine: 'ET41', numero_fir: 'FC1', classe: 'A', peso_effettivo: 1500, ordine_immesso_il: '2025-12-20T09:00:00.000Z', trasporto_iniziato_il: '2025-12-28T09:00:00.000Z' },
  // immesso a ottobre 2025 senza inizio: 60 giorni dopo e' il 9 dicembre, a gennaio non cade piu'
  { ...base, id: 'c2', id_ordine: 'ET42', numero_fir: 'FC2', classe: 'A', peso_effettivo: 700, ordine_immesso_il: '2025-10-10T09:00:00.000Z' },
  // immesso nel 2024: nel 2026 non si ripete
  { ...base, id: 'c3', id_ordine: 'ET43', numero_fir: 'FC3', classe: 'A', peso_effettivo: 900, ordine_immesso_il: '2024-12-20T09:00:00.000Z' },
];
const senzaFineDi = (anno, mese) => calcolaRigheAttiva({ reteAll: aCavallo, aciAll: [], extraAll: [], fornitori, tariffe, anno, mese }).anomalie.find(a => a.tipo === 'date_senza_fine' && a.tipologia === 'RETE');
const dic25 = senzaFineDi(2025, 'Dicembre'), gen26 = senzaFineDi(2026, 'Gennaio'), feb26 = senzaFineDi(2026, 'Febbraio'), mar26 = senzaFineDi(2026, 'Marzo');
verifica('dicembre 2025: si segnalano quello di dicembre e quello di ottobre', !!dic25 && dic25.quanti === 2 && dic25.ordini.some(o => o.ordine === 'ET41') && dic25.ordini.some(o => o.ordine === 'ET42'), JSON.stringify(dic25 && dic25.ordini));
verifica('gennaio e febbraio 2026: si segnala quello immesso a dicembre, e il testo dice quando', !!gen26 && gen26.quanti === 1 && gen26.ordini[0].ordine === 'ET41' && /immesso il 20\/12\/2025: manca la data di fine trasporto/.test(gen26.descrizione) && /gennaio 2026/.test(gen26.descrizione)
  && !!feb26 && feb26.quanti === 1 && feb26.ordini[0].ordine === 'ET41', JSON.stringify([gen26, feb26]));
verifica('marzo 2026: oltre i 60 giorni non si ripete; quello di ottobre e quello del 2024 mai nel 2026', !mar26 && !gen26.ordini.some(o => o.ordine === 'ET42' || o.ordine === 'ET43'), JSON.stringify(mar26));
verifica('...e resta fuori dalla fattura di ogni mese', ['Dicembre', 'Gennaio'].every((m, i) => calcolaRigheAttiva({ reteAll: aCavallo, aciAll: [], extraAll: [], fornitori, tariffe, anno: 2025 + i, mese: m }).righe.RETE.length === 0));

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
