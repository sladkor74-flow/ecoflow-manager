// LA PASSIVA, IL FOGLIO DELL'AMMINISTRAZIONE E IL FOGLIO EXCEL DICONO LO STESSO
// CENTESIMO, E LA STESSA RIGA (chiusura dell'audit, 11/10/2026).
//
// 1. Extra raccolta (5.3): ogni intervento si paga per conto suo, arrotondato
//    al centesimo; la passiva sommava i chili del gruppo e arrotondava una volta.
// 2. Rete (1.17): la passiva arrotonda per provincia e destinazione, il foglio
//    per voce. Quale delle due sia la grana della fattura del fornitore il file
//    di settembre non lo dice (pesi a 10 kg e prezzi interi: tornano tutte e
//    due), quindi il foglio avvisa anche di un centesimo, e dice che e'
//    l'arrotondamento.
// 3. Viaggio misto a viaggio (5.17): la quota del canale si arrotonda una volta
//    per tratta, il foglio Excel scrive in G la quota intera e in H
//    =ROUND(F*G;2), e al primo ricalcolo di Excel il numero non cambia.
// 4. Le voci (assegnazione): una riga va sotto la voce la cui tariffa e' quella
//    che la passiva ha scelto davvero, non sotto la prima che la riconosce.
//
// Dalla revisione dei soldi (chiusura dell'audit, 11/10/2026):
// 1. la passiva si confronta anche con la pagina (calcExtraRaccolta) e col
//    blocco del foglio, che arrotondavano la somma dei costi e non ogni costo
//    (2.661,61 contro 2.661,59); e il foglio Excel ricalcolato fa lo stesso
//    centesimo, a tappeto su chili e prezzi;
// 3. la riga ACI di un viaggio misto, al mezzo centesimo, Excel ricalcolando
//    faceva un centesimo in piu' (328,13 contro 328,12): ora in G ci sono i
//    viaggi pagati, e la prova e' a tappeto come quella della revisione.
//
// node prove/passivaGrana.mjs
import { createRequire } from 'node:module';
import { calcolaPassivaMese, importoTrattaAViaggio } from '../base44/shared/passivaCalcolo.ts';
import { arrotondaAlCentesimo } from '../base44/shared/ecotyreTariffe.ts';
import { calcExtraRaccolta } from '../src/lib/extraRaccoltaCalc.js';
import { caricaLibPagine } from './dati/libPagine.mjs';

const { foglioPassiva, viaggiPagatiTrasporto } = await caricaLibPagine('lib/passivaAmministrazione');
const { modelloAmministrazione } = await caricaLibPagine('lib/modelloPassivaAmministrazione');
const { cartellaPassivaUnFoglio, formulaTotaleTrasporto, formulaTotaleExtra } = await caricaLibPagine('lib/passivaAmministrazioneExcel');
const { bloccoExtraRaccolta } = await caricaLibPagine('lib/extraRaccoltaAmministrazione');
const ExcelJS = createRequire(import.meta.url)('exceljs');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const archivi = (x) => ({ primarieRete: [], primarieAci: [], secondarieAll: [], extraRaccoltaAll: [], tariffeAll: [], fornitoriAll: [], ...x });

// EXCEL CHE RICALCOLA. =ROUND(x;2) di Excel: il numero a 15 cifre significative,
// poi il mezzo centesimo lontano da zero (lo stesso modello della revisione,
// misti_excel.mjs). E una formula del foglio si valuta cosi': i riferimenti alle
// celle diventano i valori scritti, ROUND diventa questo.
const excelRound2 = (x) => {
  const s = Number(Number(x).toPrecision(15));
  const [i, d] = Math.abs(s).toFixed(12).split('.');
  let cent = BigInt(i) * 100n + BigInt(d.slice(0, 2));
  if (Number(d[2]) >= 5) cent += 1n;
  return Math.sign(s) * Number(cent) / 100;
};
const compilate = new Map();
const valutaFormula = (formula, celle) => {
  if (!compilate.has(formula)) {
    const espressione = formula.replace(/ROUND\(/g, 'R(').replace(/\b([A-Z]{1,2}\d+)\b/g, (_m, r) => `v(c, '${r}')`);
    compilate.set(formula, Function('R', 'v', 'c', `return ${espressione};`));
  }
  const v = (c, r) => { if (!(r in c)) throw new Error(`cella ${r} non data`); return Number(c[r]) || 0; };
  return compilate.get(formula)(excelRound2, v, celle);
};
const alCentesimo = (v) => Math.round(v * 100) / 100;

console.log("1. EXTRA RACCOLTA: UN INTERVENTO, UN CENTESIMO");
{
  // L'esempio dell'audit: quattro interventi di Emmesse verso Gatim, raccolta 90
  // e trattamento 95. A 95 euro i chili danno mezzi centesimi: 2.631 kg sono
  // 249,945 euro.
  const kg = [2216, 2631, 4387, 5153];
  const iv = (i, peso) => ({
    id: 'X' + i, stato: 'terminato', id_ordine: 'X' + i, numero_fir: 'FX' + i, tipo_movimento: 'primaria',
    trasporto_finito_il: '2026-09-10T00:00:00.000Z', ordine_immesso_il: '2026-09-01T00:00:00.000Z', trasporto_iniziato_il: '2026-09-10T00:00:00.000Z',
    trasportatore: 'EMMESSE SRLS', provincia: 'CS', destinazione: 'GATIM S.R.L.', tipo_destinazione: 'imp', classe: 'P',
    peso_effettivo: peso, costo_raccolta_t: 90, costo_trattamento_t: 95,
  });
  const p = calcolaPassivaMese(archivi({ extraRaccoltaAll: kg.map((k, i) => iv(i, k)), fornitoriAll: [{ ragione_sociale: 'EMMESSE SRLS' }, { ragione_sociale: 'GATIM S.R.L.' }] }), 2026, 8, 'Settembre', 'EXTRA_RACCOLTA');
  // il conto a mano, in centesimi interi: chili per prezzo diviso dieci, mezzo
  // centesimo per eccesso
  const centesimi = (prezzo) => kg.reduce((s, k) => s + Math.round(k * prezzo / 10), 0);
  const racc = p.raccoglitori.find(f => /EMMESSE/.test(f.fornitore));
  const imp = p.impianti_stoccaggi.find(f => /GATIM/.test(f.fornitore));
  verifica('la raccolta: 199,44 + 236,79 + 394,83 + 463,77 = 1.294,83', racc && racc.totale_euro === centesimi(90) / 100 && racc.totale_euro === 1294.83, JSON.stringify(racc && racc.righe));
  verifica("il trattamento intervento per intervento: 210,52 + 249,95 + 416,77 + 489,54 = 1.366,78 (per gruppo era 1.366,77)",
    imp && imp.totale_euro === centesimi(95) / 100 && imp.totale_euro === 1366.78, JSON.stringify(imp && imp.righe));
  verifica('il mese: 2.661,61', p.totali.totale_complessivo === 2661.61, String(p.totali.totale_complessivo));
  // una riga sola per fornitore resta: il dettaglio non si moltiplica
  verifica('una riga per fornitore, con tutti i chili', racc && racc.righe.length === 1 && racc.righe[0].tonnellate === 14.387 && imp.righe.length === 1, JSON.stringify(racc && racc.righe));
  // e con pesi a 10 kg, come sono quelli veri del 2026, non cambia niente
  const tondi = calcolaPassivaMese(archivi({ extraRaccoltaAll: [2210, 2630, 4380, 5150].map((k, i) => iv(i, k)), fornitoriAll: [] }), 2026, 8, 'Settembre', 'EXTRA_RACCOLTA');
  verifica('con pesi a 10 kg il conto e\' quello di sempre (14,37 t x 185 = 2.658,45)', tondi.totali.totale_complessivo === 2658.45, String(tondi.totali.totale_complessivo));

  // PASSIVA, PAGINA E FOGLIO DICONO LO STESSO CENTESIMO (revisione dei soldi,
  // 11/10/2026). La pagina e il blocco del foglio arrotondavano per intervento
  // la SOMMA dei costi: 2,631 t x 185 = 486,73, dove la passiva paga 236,79 +
  // 249,95 = 486,74. Sull'esempio dell'audit 2.661,59 contro 2.661,61; con la
  // raccolta a 85, 2.589,66 contro 2.589,68 (e la passiva stessa sbagliava un
  // mezzo centesimo: 2,631 t x 85 = 223,635 fa 223,64, non 223,63).
  for (const [racc, atteso] of [[90, 2661.61], [85, 2589.69]]) {
    const ivs = kg.map((k, i) => ({ ...iv(i, k), costo_raccolta_t: racc }));
    const pp = calcolaPassivaMese(archivi({ extraRaccoltaAll: ivs, fornitoriAll: [{ ragione_sociale: 'EMMESSE SRLS' }, { ragione_sociale: 'GATIM S.R.L.' }] }), 2026, 8, 'Settembre', 'EXTRA_RACCOLTA');
    const pagina = alCentesimo(ivs.reduce((s, r) => s + calcExtraRaccolta(r).costo_totale, 0));
    const blocco = bloccoExtraRaccolta(ivs, 2026, 'Settembre');
    const aMano = alCentesimo(kg.reduce((s, k) => s + Math.round(k * racc / 10) + Math.round(k * 95 / 10), 0) / 100);
    verifica(`raccolta a ${racc}: passiva, pagina e foglio ${atteso} (il conto a mano, centesimo per centesimo)`,
      pp.totali.totale_complessivo === atteso && pagina === atteso && blocco.totale_euro === atteso && aMano === atteso,
      JSON.stringify({ passiva: pp.totali.totale_complessivo, pagina, foglio: blocco.totale_euro, aMano }));
    // e il foglio Excel, ricalcolato riga per riga, rifa' il totale del blocco
    const lettere = { t: 'J', raccolta: 'K', stoccaggio: 'L', trattamento: 'M', viaggio: 'N', oneri: 'O' };
    const ricalcolo = alCentesimo(blocco.righe.reduce((s, x) => s + valutaFormula(formulaTotaleExtra(7, lettere),
      { J7: x.tonnellate, K7: x.raccolta_t, L7: x.stoccaggio_t, M7: x.trattamento_t, N7: x.trasporto_viaggio, O7: x.oneri }), 0));
    verifica(`raccolta a ${racc}: il foglio Excel ricalcolato dice ${atteso}`, ricalcolo === atteso, String(ricalcolo));
  }

  // A TAPPETO: ogni costo di un intervento, per chili da 100 a 30.000 e per
  // prezzi interi e con i decimali, al centesimo come lo fa il conto a mano
  // (mezzo centesimo per eccesso), come lo rifa' Excel, e la pagina come la passiva.
  let casi = 0;
  const diversi = [];
  for (let k = 100; k <= 30000; k += 7) {
    for (const prezzo of [72, 85, 90, 95, 100, 105, 110, 125, 135, 185, 72.5, 95.35]) {
      casi++;
      const passiva = arrotondaAlCentesimo((k / 1000) * prezzo);
      const veroCent = Math.round(Math.round(k * prezzo * 100) / 1000) / 100; // k x prezzo in millesimi di centesimo, interi
      const excel = excelRound2((k / 1000) * prezzo);
      if (passiva !== veroCent || passiva !== excel) diversi.push({ k, prezzo, passiva, veroCent, excel });
    }
  }
  verifica(`a tappeto, ${casi} costi: passiva = conto a mano = Excel`, diversi.length === 0, JSON.stringify(diversi.slice(0, 3)));
  let diversiPagina = 0;
  for (let k = 101; k <= 30000; k += 389) {
    for (const [r, t] of [[85, 95], [90, 95], [72, 105], [90.5, 0]]) {
      const x = { ...iv(0, k), costo_raccolta_t: r, costo_trattamento_t: t };
      const pp = calcolaPassivaMese(archivi({ extraRaccoltaAll: [x] }), 2026, 8, 'Settembre', 'EXTRA_RACCOLTA');
      if (pp.totali.totale_complessivo !== calcExtraRaccolta(x).costo_totale) diversiPagina++;
    }
  }
  verifica('a tappeto, intervento per intervento: la pagina dice il centesimo della passiva', diversiPagina === 0, String(diversiPagina));
}

console.log('2. RETE: ANCHE UN CENTESIMO DI DIFFERENZA SI DICE');
{
  const fornitori = [{ ragione_sociale: 'LOGISTICA & PNEUMATICI SRL' }, { ragione_sociale: 'NAPPI SUD SRL' }, { ragione_sociale: 'T-CYCLE INDUSTRIES SRL' }];
  const tariffe = [{ id: 'na', direzione: 'PASSIVA', prestazione: 'RACCOLTA', tipologia: 'RETE', fornitore_nome: 'LOGISTICA & PNEUMATICI SRL', unita_misura: '€/t', valore: 68, provincia: 'NA', stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' }];
  const pr = (id, kg, dest, g) => ({ id, stato: 'terminato', id_ordine: id, numero_fir: 'F' + id, trasportatore: 'LOGISTICA & PNEUMATICI SRL', provincia: 'NA', regione: 'Campania', destinazione: dest, tipo_destinazione: 'stoc', classe: 'P', peso_effettivo: kg, automezzo: 'XX' + id,
    trasporto_finito_il: `2026-09-${g}T00:00:00.000Z`, ordine_immesso_il: '2026-09-01T00:00:00.000Z', trasporto_iniziato_il: `2026-09-${g}T00:00:00.000Z` });
  const p = calcolaPassivaMese(archivi({ primarieRete: [pr('1', 1003, 'NAPPI SUD SRL', '03'), pr('2', 1003, 'T-CYCLE INDUSTRIES SRL', '04')], tariffeAll: tariffe, fornitoriAll: fornitori }), 2026, 8, 'Settembre', 'RETE');
  const f = foglioPassiva(modelloAmministrazione(2026), p, 'RETE', 'Settembre', 2026, tariffe, null);
  const napoli = f.raccoglitori.righe.find(r => r.tipo === 'voce' && r.voce === 'Campania - NAPOLI');
  const lp = p.raccoglitori.find(x => /LOGISTICA/.test(x.fornitore));
  verifica('la passiva: 68,20 + 68,20 = 136,40', lp && lp.totale_euro === 136.4, JSON.stringify(lp && lp.righe));
  verifica('il foglio, sulla voce: 2,006 t x 68 = 136,41', napoli && napoli.totale === 136.41, JSON.stringify(napoli));
  verifica("e lo dice, come centesimo di arrotondamento (prima: «oltre 0,01» e il centesimo esatto passava muto)",
    napoli && /136,40/.test(napoli.note || '') && /centesimo di arrotondamento/.test(napoli.note || ''), JSON.stringify(napoli && napoli.note));
  // a pesi tondi niente da dire
  const p2 = calcolaPassivaMese(archivi({ primarieRete: [pr('1', 1000, 'NAPPI SUD SRL', '03'), pr('2', 1010, 'T-CYCLE INDUSTRIES SRL', '04')], tariffeAll: tariffe, fornitoriAll: fornitori }), 2026, 8, 'Settembre', 'RETE');
  const n2 = foglioPassiva(modelloAmministrazione(2026), p2, 'RETE', 'Settembre', 2026, tariffe, null).raccoglitori.righe.find(r => r.tipo === 'voce' && r.voce === 'Campania - NAPOLI');
  verifica('con pesi a 10 kg nessun avviso: 2,01 t x 68 = 136,68 da tutte e due le parti', n2 && n2.totale === 136.68 && !/fatturazione passiva/.test(n2.note || ''), JSON.stringify(n2));
}

console.log('3. VIAGGIO MISTO: IL FOGLIO EXCEL RIFA\' L\'IMPORTO DELLA PASSIVA');
{
  const fornitori = [{ ragione_sociale: 'TRANSAR SRL' }, { ragione_sociale: 'NAPPI SUD SRL' }, { ragione_sociale: 'Irigom S.r.l.' }];
  const tariffe = [{ id: 'tr', direzione: 'PASSIVA', prestazione: 'TRASPORTO_SECONDARIA', tipologia: 'TUTTE', fornitore_nome: 'TRANSAR SRL', unita_misura: '€/viaggio', valore: 400, produttore: 'NAPPI SUD SRL', destinatario: 'Irigom S.r.l.', stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' }];
  const sec = (id, kg, aci, giorno) => ({ id, stato: 'terminato', id_ordine: id, numero_fir: 'S' + id, stoccaggio: 'NAPPI SUD SRL', trasportatore: 'TRANSAR SRL', destinazione: 'Irigom S.r.l.', tipo_destinazione: 'imp',
    classe: aci ? '9' : 'P', prodotto: aci ? 'class9' : '', peso_effettivo: kg, automezzo: 'AA111AA', trasporto_finito_il: `2026-09-${giorno}T00:00:00.000Z`, ordine_immesso_il: '2026-09-01T00:00:00.000Z', trasporto_iniziato_il: `2026-09-${giorno}T00:00:00.000Z` });
  // un viaggio di sola rete (10.000 kg) e uno misto: 10.000 kg di rete e 3.000 di ACI
  const secondarie = [sec('A', 10000, false, '05'), sec('B', 10000, false, '07'), sec('C', 3000, true, '07')];
  const importi = {};
  for (const canale of ['RETE', 'ACI']) {
    const p = calcolaPassivaMese(archivi({ secondarieAll: secondarie, tariffeAll: tariffe, fornitoriAll: fornitori }), 2026, 8, 'Settembre', canale);
    const riga = p.trasporti_secondaria.flatMap(g => g.righe || [])[0];
    importi[canale] = riga ? riga.importo : null;
    const f = foglioPassiva([], p, canale, 'Settembre', 2026, tariffe, null);
    const bytes = await cartellaPassivaUnFoglio([f]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes);
    const ws = wb.worksheets[0];
    let r = 0;
    for (let i = 1; i <= ws.rowCount; i++) if (String(ws.getCell(i, 2).value || '') === 'TRANSAR SRL') { r = i; break; }
    const F = Number(ws.getCell(r, 6).value), G = Number(ws.getCell(r, 7).value);
    const H = ws.getCell(r, 8).value || {};
    const ricalcolo = Math.round(F * G * 100) / 100;
    verifica(`${canale}: in G la quota intera, non arrotondata a due decimali`, r > 0 && Math.abs(G * 100 - Math.round(G * 100)) > 1e-6, `riga ${r}, G = ${G}`);
    verifica(`${canale}: in H =ROUND(F*G;2)`, H.formula === `ROUND(F${r}*G${r},2)`, JSON.stringify(H));
    verifica(`${canale}: Excel che ricalcola dice l'importo della passiva (${importi[canale]})`, ricalcolo === importi[canale] && H.result === importi[canale], `F x G = ${ricalcolo}, passiva ${importi[canale]}`);
  }
  verifica('la rete paga 400 + 400 x 10/13 = 707,69 (prima, ricalcolando, 708,00)', importi.RETE === 707.69, String(importi.RETE));
  verifica("l'ACI paga il resto del misto: 92,31 (prima 92,00)", importi.ACI === 92.31, String(importi.ACI));
  verifica('i due canali fanno i due viaggi veri: 800,00', Math.round((importi.RETE + importi.ACI) * 100) === 80000, String(importi.RETE + importi.ACI));

  // AL MEZZO CENTESIMO, SULLA RIGA ACI (revisione dei soldi, 11/10/2026). 300
  // €/viaggio, un viaggio di sola ACI e uno misto con 14.500 kg di rete e 1.500
  // di ACI: la passiva paga all'ACI 328,12 (600 - 271,88), e con la quota dei
  // chili in G (1,09375) Excel ricalcolando faceva 328,13, cioe' 600,01 per due
  // viaggi da 300. In G ora ci sono i viaggi pagati, importo diviso prezzo.
  const tariffe300 = [{ ...tariffe[0], valore: 300 }];
  const misto = [sec('A', 12000, true, '05'), sec('B', 14500, false, '07'), sec('C', 1500, true, '07')];
  const excel = {};
  for (const canale of ['RETE', 'ACI']) {
    const p = calcolaPassivaMese(archivi({ secondarieAll: misto, tariffeAll: tariffe300, fornitoriAll: fornitori }), 2026, 8, 'Settembre', canale);
    const riga = p.trasporti_secondaria.flatMap(g => g.righe || [])[0];
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await cartellaPassivaUnFoglio([foglioPassiva([], p, canale, 'Settembre', 2026, tariffe300, null)]));
    const ws = wb.worksheets[0];
    let r = 0;
    for (let i = 1; i <= ws.rowCount; i++) if (String(ws.getCell(i, 2).value || '') === 'TRANSAR SRL') { r = i; break; }
    const H = ws.getCell(r, 8).value || {};
    excel[canale] = alCentesimo(valutaFormula(H.formula, { [`F${r}`]: ws.getCell(r, 6).value, [`G${r}`]: ws.getCell(r, 7).value }));
    verifica(`${canale}, mezzo centesimo: Excel ricalcolando dice l'importo della passiva (${riga.importo})`, excel[canale] === riga.importo, `Excel ${excel[canale]}`);
  }
  verifica('rete 271,88 + ACI 328,12 ricalcolati da Excel fanno i due viaggi veri: 600,00 (prima 600,01)',
    excel.RETE === 271.88 && excel.ACI === 328.12 && Math.round((excel.RETE + excel.ACI) * 100) === 60000, JSON.stringify(excel));

  // A TAPPETO, come misti_excel.mjs della revisione: prezzi da 250 a 600
  // €/viaggio, la rete da 500 a 29.500 kg ogni 10, quattro pesi ACI, 0, 1 o 2
  // viaggi interi. Per ciascuna riga, rete e ACI, la colonna G e la formula sono
  // quelle che il foglio scrive davvero (viaggiPagatiTrasporto, formulaTotaleTrasporto).
  let casi = 0;
  const diversi = [];
  for (const v of [250, 300, 350, 380, 400, 420, 450, 480, 500, 550, 600]) {
    for (let kgR = 500; kgR <= 29500; kgR += 10) {
      for (const kgA of [kgR % 7000 + 1000, 30000 - kgR, 3000, 1530]) {
        if (kgA <= 0) continue;
        for (const interi of [0, 1, 2]) {
          casi++;
          const misti = [{ kgRete: kgR, kgAci: kgA, nRete: 1, nAci: 1 }];
          for (const aci of [false, true]) {
            const conto = importoTrattaAViaggio(v, interi, misti, aci);
            const G = viaggiPagatiTrasporto({ unita_misura: '€/viaggio', tariffa_valore: v, importo: conto.importo, viaggi_quota_esatta: conto.quota_esatta });
            const H = valutaFormula(formulaTotaleTrasporto({ unita_misura: 'euro_viaggio' }, 9), { F9: v, G9: G });
            if (alCentesimo(H) !== conto.importo) diversi.push({ v, kgR, kgA, interi, aci, passiva: conto.importo, excel: H });
          }
        }
      }
    }
  }
  verifica(`a tappeto, ${casi} tratte e due righe ciascuna: Excel ricalcolato = passiva (prima 661 righe ACI e 12 di rete di un centesimo)`,
    diversi.length === 0, JSON.stringify(diversi.slice(0, 3)));
}

console.log('4. LA RIGA VA SOTTO LA VOCE DELLA SUA TARIFFA');
{
  // Le due voci di Logistica del modello: «Campania - NAPOLI» (provincia NA, 68)
  // viene prima, in ordine di stampa, di «conferiti c/o Nappi Sud»
  // (destinazione, 71). La passiva paga 71 una raccolta da NA scaricata a Nappi Sud.
  const fornitori = [{ ragione_sociale: 'LOGISTICA & PNEUMATICI SRL' }, { ragione_sociale: 'NAPPI SUD SRL' }, { ragione_sociale: 'T-CYCLE INDUSTRIES SRL' }];
  const base = { direzione: 'PASSIVA', prestazione: 'RACCOLTA', tipologia: 'RETE', fornitore_nome: 'LOGISTICA & PNEUMATICI SRL', unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' };
  const tariffe = [{ ...base, id: 'na', valore: 68, provincia: 'NA' }, { ...base, id: 'ns', valore: 71, destinazione: 'NAPPI SUD SRL' }];
  const pr = (id, kg, dest, g) => ({ id, stato: 'terminato', id_ordine: id, numero_fir: 'F' + id, trasportatore: 'LOGISTICA & PNEUMATICI SRL', provincia: 'NA', regione: 'Campania', destinazione: dest, tipo_destinazione: 'stoc', classe: 'P', peso_effettivo: kg, automezzo: 'XX' + id,
    trasporto_finito_il: `2026-09-${g}T00:00:00.000Z`, ordine_immesso_il: '2026-09-01T00:00:00.000Z', trasporto_iniziato_il: `2026-09-${g}T00:00:00.000Z` });
  const voceDi = (f, quale) => f.raccoglitori.righe.find(r => r.tipo === 'voce' && /LOGISTICA/i.test(r.soggetto) && r.voce === quale);
  const NS = 'Campania - conferiti c\\o Nappi Sud';

  const p1 = calcolaPassivaMese(archivi({ primarieRete: [pr('1', 10000, 'NAPPI SUD SRL', '03')], tariffeAll: tariffe, fornitoriAll: fornitori }), 2026, 8, 'Settembre', 'RETE');
  const r1 = p1.raccoglitori.find(x => /LOGISTICA/.test(x.fornitore)).righe[0];
  verifica('la passiva sceglie la tariffa per destinazione e la scrive sulla riga', r1.tariffa_id === 'ns' && r1.tariffa_criterio === 'destinazione' && r1.importo === 710, JSON.stringify(r1));
  const f1 = foglioPassiva(modelloAmministrazione(2026), p1, 'RETE', 'Settembre', 2026, tariffe, null);
  verifica('solo Nappi Sud: 10 t x 71 sotto «conferiti c/o Nappi Sud»', voceDi(f1, NS) && voceDi(f1, NS).tonnellate === 10 && voceDi(f1, NS).prezzo === 71 && voceDi(f1, NS).totale === 710, JSON.stringify(voceDi(f1, NS)));
  verifica('e NAPOLI resta a zero, col suo 68', voceDi(f1, 'Campania - NAPOLI').tonnellate === 0 && voceDi(f1, 'Campania - NAPOLI').prezzo === 68, JSON.stringify(voceDi(f1, 'Campania - NAPOLI')));

  const p2 = calcolaPassivaMese(archivi({ primarieRete: [pr('1', 10000, 'NAPPI SUD SRL', '03'), pr('2', 5000, 'T-CYCLE INDUSTRIES SRL', '04')], tariffeAll: tariffe, fornitoriAll: fornitori }), 2026, 8, 'Settembre', 'RETE');
  const f2 = foglioPassiva(modelloAmministrazione(2026), p2, 'RETE', 'Settembre', 2026, tariffe, null);
  verifica('con T-Cycle: NAPOLI 5 t x 68 = 340 (prima: 15 t a prezzo «vari»)', voceDi(f2, 'Campania - NAPOLI').tonnellate === 5 && voceDi(f2, 'Campania - NAPOLI').prezzo === 68 && voceDi(f2, 'Campania - NAPOLI').totale === 340, JSON.stringify(voceDi(f2, 'Campania - NAPOLI')));
  verifica('e Nappi Sud 10 t x 71 = 710', voceDi(f2, NS).tonnellate === 10 && voceDi(f2, NS).totale === 710, JSON.stringify(voceDi(f2, NS)));
  const lp = p2.raccoglitori.find(x => /LOGISTICA/.test(x.fornitore));
  const sogg = f2.raccoglitori.righe.find(r => r.tipo === 'soggetto' && /LOGISTICA/i.test(r.soggetto));
  verifica('il totale del soggetto e\' quello della passiva: 1.050', lp.totale_euro === 1050 && sogg && sogg.totale === 1050, JSON.stringify(sogg));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
