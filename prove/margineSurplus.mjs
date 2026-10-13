// IL SURPLUS SULLE TARIFFE NEL MARGINE (13/10/2026).
//
// Il Fuel Surcharge del consorzio Ecotyre (+5 €/t dal 01/10/2026 al 31/12/2026)
// SMOCO lo fattura a Ecotyre su tutte le tonnellate del canale e lo paga ai
// raccoglitori esterni. Sulle tonnellate che raccoglie SMOCO stessa (interno) il
// surplus si incassa e non si paga a nessuno: il margine sale di 5 €/t su quelle.
// Un surplus incassato e pagato sulle stesse tonnellate non cambia il margine; lo
// cambiano gli interni, importi diversi fra attiva e passiva, un surplus solo
// passivo o solo attivo, e ciascuna ragione si dice.
//
// Qui si prova base44/shared/margine.ts e la funzione calcolaMargine:
//   1. un mese costruito: ricavo e costo comprendono il surplus, il margine sale
//      delle sole tonnellate dell'interno, ordini e tonnellate non cambiano;
//   2. importi uguali e nessun interno: scarto zero; solo passivo: il margine
//      scende di quanto si paga; solo attivo e importi diversi (gli €/t ai
//      fornitori si leggono dal record: l'attiva non li porta);
//   3. l'anno somma i mesi; la funzione legge SurplusTariffa e lo passa;
//   4. sui dati veri dell'11/10/2026, settembre simulato: +1.268,40 € sulla rete
//      (253,68 t raccolte da SMOCO x 5 €/t), +24,50 € sull'ACI, niente
//      sull'extra raccolta; senza surplus i margini di oggi.
//
// node prove/margineSurplus.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { calcolaMargineAnno } from '../base44/shared/margine.ts';
import { calcolaRigheAttiva } from '../base44/shared/attivaCalcolo.ts';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const leggi = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r/g, '');
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

const base = { stato: 'terminato', cer: '160103', classe: 'A', provincia: 'BA', tipo_destinazione: 'imp', destinazione: 'BETA IMPIANTI' };
const mov = (id, trasportatore, kg, quando, altro = {}) => ({ ...base, id, id_ordine: 'ET' + id, numero_fir: 'F' + id, trasportatore, peso_effettivo: kg, trasporto_finito_il: quando, automezzo: 'AA' + id, ...altro });
const dati = {
  reteAll: [mov('1', 'ALFA SRL', 10000, '2026-10-05T08:00:00.000Z'), mov('2', 'SMOCO S.R.L.', 2000, '2026-10-06T08:00:00.000Z')],
  aciAll: [], extraAll: [], secondarieAll: [],
  fornitori: [
    { id: 'f-alfa', ragione_sociale: 'ALFA SRL', stato: 'attivo' },
    { id: 'f-smoco', ragione_sociale: 'SMOCO S.R.L.', stato: 'attivo', interno: true },
    { id: 'f-beta', ragione_sociale: 'BETA IMPIANTI', stato: 'attivo' },
  ],
  tariffe: [
    { id: 'a1', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo' },
    { id: 'p1', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Alfa s.r.l.', tipologia: 'RETE', valore: 60, unita_misura: '€/t' },
    { id: 'p2', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'TRATTAMENTO', fornitore_nome: 'Beta Impianti', tipologia: 'RETE', valore: 80, unita_misura: '€/t' },
  ],
};
const fs = (tipologia, altro = {}) => ({
  id: 'fs-' + tipologia, gruppo: 'g-fs', nome: 'Fuel Surcharge', origine: 'CONSORZIO', tipologia, prestazione: 'RACCOLTA', a_chi: 'tutti',
  euro_t_passiva: 5, euro_t_attiva: 5, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo', ...altro,
});
const ottobre = (d) => d.canali.find(c => c.canale === 'RETE').mesi[9];

console.log('1. IL MARGINE SALE DELLE SOLE TONNELLATE DI SMOCO');
const senza = calcolaMargineAnno(dati, 2026, 9);
const con = calcolaMargineAnno({ ...dati, surplusAll: [fs('RETE')] }, 2026, 9);
const m0 = ottobre(senza), m1 = ottobre(con);
verifica('senza surplus: 12 t, ricavo 2.424, costo 600 + 960, margine 864', m0.tonnellate === 12 && m0.ricavo === 2424 && m0.costo === 1560 && m0.margine === 864 && m0.ordini === 2, JSON.stringify(m0));
verifica('col surplus: il ricavo prende 12 t x 5 = 60, il costo 10 t x 5 = 50 (ALFA; SMOCO e\' interno)', m1.ricavo === 2484 && m1.costo === 1610 && m1.ricavo_surplus === 60 && m1.costo_surplus === 50, JSON.stringify({ r: m1.ricavo, c: m1.costo, rs: m1.ricavo_surplus, cs: m1.costo_surplus }));
verifica('il margine sale di 10 = 2 t di SMOCO x 5 €/t', m1.margine === 874 && m1.surplus_netto === 10 && m1.margine - m0.margine === 10 && m1.tonnellate_surplus_interni === 2, JSON.stringify({ m: m1.margine, n: m1.surplus_netto, t: m1.tonnellate_surplus_interni }));
verifica('ordini e tonnellate non cambiano: la riga del surplus non e\' un ordine', m1.ordini === m0.ordini && m1.tonnellate === m0.tonnellate);
const v = (m1.surplus || [])[0] || {};
verifica('il surplus del mese, detto: incassato, pagato, resta, e perche\'', (m1.surplus || []).length === 1 && v.incassato === 60 && v.pagato === 50 && v.resta === 10 && v.tonnellate_interni === 2 && v.euro_t_attiva === 5 && v.euro_t_passiva === 5
  && v.testo === 'Fuel Surcharge: incassato 60,00 € · pagato 50,00 € · resta 10,00 € · sulle 2,00 t raccolte da SMOCO S.R.L., interno, si incassa e non si paga a nessuno', JSON.stringify(v));
verifica('senza surplus i campi nuovi sono a zero e la lista vuota', m0.ricavo_surplus === 0 && m0.costo_surplus === 0 && m0.surplus_netto === 0 && m0.tonnellate_surplus_interni === 0 && Array.isArray(m0.surplus) && m0.surplus.length === 0);
verifica('l\'ACI non prende il surplus della rete', con.canali.find(c => c.canale === 'ACI').mesi[9].ricavo_surplus === 0);

console.log('2. IMPORTI UGUALI E NESSUN INTERNO: SCARTO ZERO; LE ALTRE RAGIONI');
const soloAlfa = { ...dati, reteAll: [dati.reteAll[0]] };
const a0 = ottobre(calcolaMargineAnno(soloAlfa, 2026, 9)), a1 = ottobre(calcolaMargineAnno({ ...soloAlfa, surplusAll: [fs('RETE')] }, 2026, 9));
verifica('incassato e pagato sulle stesse tonnellate: il margine non cambia', a1.margine === a0.margine && a1.surplus_netto === 0 && a1.ricavo_surplus === 50 && a1.costo_surplus === 50 && a1.surplus[0].perche.length === 0, JSON.stringify(a1.surplus));
const p1 = ottobre(calcolaMargineAnno({ ...soloAlfa, surplusAll: [fs('RETE', { euro_t_attiva: null })] }, 2026, 9));
verifica('solo passivo: il margine scende di quanto si paga (-50)', p1.margine === a0.margine - 50 && p1.surplus_netto === -50 && p1.surplus[0].perche.includes('solo ai fornitori: Ecotyre non lo paga'), JSON.stringify(p1.surplus));
const s1 = ottobre(calcolaMargineAnno({ ...soloAlfa, surplusAll: [fs('RETE', { euro_t_passiva: null })] }, 2026, 9));
verifica('solo attivo: il margine sale di quanto si incassa (+50)', s1.margine === a0.margine + 50 && s1.surplus[0].perche.includes('solo da Ecotyre: ai fornitori non si paga'), JSON.stringify(s1.surplus));
const d1 = ottobre(calcolaMargineAnno({ ...soloAlfa, surplusAll: [fs('RETE', { euro_t_passiva: 4 })] }, 2026, 9));
verifica('importi diversi: 5 da Ecotyre e 4 ai fornitori, +10', d1.margine === a0.margine + 10 && d1.surplus[0].perche.includes('importi diversi: 5,00 €/t da Ecotyre, 4,00 €/t ai fornitori'), JSON.stringify(d1.surplus));
// Il calcolo dell'attiva non porta piu' quanto si paga ai fornitori (revisione del
// 13/10/2026: il riepilogo, che legge chiunque sia collegato, lo passava): il
// margine lo legge dal record del surplus, e gli importi diversi si vedono lo stesso.
const attivaD = calcolaRigheAttiva({ ...soloAlfa, anno: 2026, mese: 'Ottobre', surplus: [fs('RETE', { euro_t_passiva: 4 })] });
verifica('i 4,00 €/t ai fornitori il margine li legge dal record, non dall\'attiva', !('euro_t_passiva' in ((attivaD.surplus_del_mese.RETE || [])[0] || { euro_t_passiva: 1 })) && d1.surplus[0].euro_t_passiva === 4 && d1.surplus[0].euro_t_attiva === 5, JSON.stringify({ attiva: attivaD.surplus_del_mese.RETE, margine: d1.surplus[0] }));

console.log('3. L\'ANNO E LA FUNZIONE');
const anno = con.canali.find(c => c.canale === 'RETE').anno;
verifica('l\'anno somma i mesi del surplus', anno.ricavo_surplus === 60 && anno.costo_surplus === 50 && anno.surplus_netto === 10 && anno.tonnellate_surplus_interni === 2
  && (anno.surplus || []).length === 1 && anno.surplus[0].resta === 10 && anno.surplus[0].mesi.join() === 'Ottobre', JSON.stringify(anno.surplus));
verifica('senza surplus: identico a non passarlo', JSON.stringify(calcolaMargineAnno({ ...dati, surplusAll: [] }, 2026, 9)) === JSON.stringify(senza));
const src = leggi('../base44/functions/calcolaMargine/entry.ts');
verifica('calcolaMargine legge SurplusTariffa, tutto, e lo passa al calcolo', /fetchAll\(svc\.SurplusTariffa\)/.test(src) && /calcolaMargineAnno\(\{[^}]*surplusAll[^}]*\}/.test(src));
const fn = await caricaFunzione('calcolaMargine');
const F = await chiama(fn, { db: { PrimariaRete: dati.reteAll, PrimariaAci: [], ExtraRaccolta: [], Secondaria: [], Fornitore: dati.fornitori, Tariffa: dati.tariffe, SurplusTariffa: [fs('RETE')] }, ruolo: 'admin', corpo: { anno: 2026 } });
const fOtt = F.j.canali?.find(c => c.canale === 'RETE')?.mesi?.[9];
verifica('la funzione: il surplus arriva nel margine di ottobre', F.stato === 200 && fOtt?.surplus_netto === 10 && fOtt?.margine === 874, JSON.stringify(F.j).slice(0, 300));
const U = await chiama(fn, { db: {}, ruolo: 'user', corpo: { anno: 2026 } });
verifica('la funzione: costi e margini solo all\'amministratore', U.stato !== 200 && !U.j.canali);

console.log('4. SUI DATI VERI: SETTEMBRE 2026 COL FUEL SURCHARGE');
const CARTELLA = process.env.DATI_VERI || fileURLToPath(new URL('../../dati-veri/', import.meta.url));
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) console.log('  copia dei dati veri assente: parte saltata');
else {
  const A = JSON.parse(gunzipSync(readFileSync(join(CARTELLA, copie[copie.length - 1]))).toString('utf8')).archivi;
  const veri = { reteAll: A.PrimariaRete, aciAll: A.PrimariaAci, extraAll: A.ExtraRaccolta, secondarieAll: A.Secondaria, fornitori: A.Fornitore, tariffe: A.Tariffa };
  // settembre come esempio di un mese del Fuel Surcharge: lo si fa partire il 01/09
  const FUEL_SET = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(c => fs(c, { data_inizio_validita: '2026-09-01' }));
  const v0 = calcolaMargineAnno(veri, 2026, 8), v1 = calcolaMargineAnno({ ...veri, surplusAll: FUEL_SET }, 2026, 8);
  const set = (d, c) => d.canali.find(x => x.canale === c).mesi[8];
  const [r0, r1, c0, c1, e0, e1] = [set(v0, 'RETE'), set(v1, 'RETE'), set(v0, 'ACI'), set(v1, 'ACI'), set(v0, 'EXTRA_RACCOLTA'), set(v1, 'EXTRA_RACCOLTA')];
  verifica('senza surplus: i margini di oggi (rete 69.475,74; ACI -22,37)', r0.margine === 69475.74 && r0.ricavo === 226288.48 && r0.costo === 156812.74 && c0.margine === -22.37, JSON.stringify({ r: r0.margine, c: c0.margine }));
  verifica('rete: incassati 5.601,20, pagati 4.332,80, margine +1.268,40', r1.ricavo_surplus === 5601.2 && r1.costo_surplus === 4332.8 && r1.surplus_netto === 1268.4 && r2(r1.margine - r0.margine) === 1268.4, JSON.stringify({ rs: r1.ricavo_surplus, cs: r1.costo_surplus, d: r2(r1.margine - r0.margine) }));
  verifica('...che sono le 253,68 t raccolte da SMOCO x 5 €/t', r1.tonnellate_surplus_interni === 253.68 && r2(253.68 * 5) === 1268.4 && /253,68 t raccolte da SMOCO/.test(r1.surplus[0]?.testo || ''), JSON.stringify(r1.surplus));
  verifica('ACI: 94,45 incassati, 69,95 pagati, margine +24,50 (4,90 t di SMOCO)', c1.ricavo_surplus === 94.45 && c1.costo_surplus === 69.95 && r2(c1.margine - c0.margine) === 24.5 && c1.tonnellate_surplus_interni === 4.9, JSON.stringify({ rs: c1.ricavo_surplus, cs: c1.costo_surplus, d: r2(c1.margine - c0.margine) }));
  verifica('extra raccolta: nessun intervento a settembre, niente', e1.surplus_netto === 0 && e1.margine === e0.margine);
  verifica('ordini e tonnellate di settembre non cambiano', r1.ordini === r0.ordini && r1.tonnellate === r0.tonnellate && c1.ordini === c0.ordini && c1.tonnellate === c0.tonnellate && r1.ordini === 380);
  let primaUguali = true;
  for (const c of ['RETE', 'ACI', 'EXTRA_RACCOLTA']) for (let m = 0; m < 8; m++) {
    const x0 = v0.canali.find(x => x.canale === c).mesi[m], x1 = v1.canali.find(x => x.canale === c).mesi[m];
    if (JSON.stringify(x0) !== JSON.stringify(x1)) primaUguali = false;
  }
  verifica('i mesi prima del surplus sono identici', primaUguali);
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
