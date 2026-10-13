// IL SURPLUS SULLE TARIFFE NELLA PASSIVA (13/10/2026).
//
// Richiesta dell'utente del 12/10/2026: accanto alle tariffe un surplus in €/t,
// con le sue date, e nella passiva «una riga con l'importo standard ed una per il
// surplus (sempre riferito alle stesse tonnellate raccolte o trattate nel mese)».
// Il primo caso e' il Fuel Surcharge del consorzio Ecotyre: +5 €/t a tutti i
// raccoglitori dal 01/10/2026 al 31/12/2026, su rete, ACI ed extra raccolta,
// ognuno con la sua riga e mai sommati.
//
// Si prova calcolaPassivaMese (base44/shared/passivaCalcolo.ts):
// 1. un mese costruito: le righe standard non cambiano; la riga del surplus sta
//    sui soli chili del periodo, letto sul giorno italiano della fine del
//    trasporto; il subraccoglitore lo porta al principale; l'interno non ha la
//    riga e i suoi chili stanno a parte; totale_euro = standard + surplus; la
//    quadratura e' la stessa; un surplus ACI non tocca la rete; nell'extra
//    raccolta la raccolta non si paga sulle secondarie; il trasporto delle
//    secondarie solo sui chili del suo canale; un elenco che nomina chi non ha
//    righe si dice, senza diventare un'anomalia;
// 2. le funzioni che chiamano il calcolo leggono SurplusTariffa (calcolaPassiva,
//    congelaPassivaMese, reportConferimenti), sul banco con l'SDK finto;
// 3. sui dati veri (copia in ../dati-veri, se c'e'): senza surplus ogni mese del
//    2026 e' quello di prima (l'impronta dei totali e' del codice di prima del
//    surplus, sulla copia dell'11/10/2026), e con un Fuel Surcharge simulato su
//    settembre la rete paga 4.332,80 € a nove raccoglitori e l'ACI 69,95 €.
//
// node prove/passivaSurplus.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { calcolaPassivaMese } from '../base44/shared/passivaCalcolo.ts';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
// Una sezione che si ferma con un errore (il calcolo di prima non ha i campi del
// surplus) conta come fallita e si va avanti con la prossima.
const sezione = async (titolo, corpo) => {
  console.log(titolo);
  try { await corpo(); } catch (e) { ko++; console.log(`  FALLITA: ${titolo}: si ferma con un errore (${e && e.message})`); }
};
const archivi = (x) => ({ primarieRete: [], primarieAci: [], secondarieAll: [], extraRaccoltaAll: [], tariffeAll: [], fornitoriAll: [], ...x });
// La passiva senza i campi del surplus, e con totale_euro riportato allo
// standard: e' quello che deve restare uguale a senza surplus.
const senzaSurplus = (p) => {
  const c = JSON.parse(J(p));
  delete c.surplus_del_mese;
  if (c.totali) { delete c.totali.standard; delete c.totali.surplus; }
  for (const b of ['raccoglitori', 'impianti_stoccaggi', 'trasporti_secondaria']) {
    for (const f of c[b] || []) { f.totale_euro = f.totale_standard; delete f.totale_standard; delete f.surplus; delete f.totale_surplus; }
    c[b] = (c[b] || []).sort((a, b2) => String(a.fornitore).localeCompare(String(b2.fornitore)));
  }
  if (c.totali && p.totali && p.totali.standard) {
    c.totali.raccoglitori = p.totali.standard.raccoglitori;
    c.totali.impianti_stoccaggi = p.totali.standard.impianti_stoccaggi;
    c.totali.trasporti_secondaria = p.totali.standard.trasporti_secondaria;
    c.totali.totale_complessivo = p.totali.standard.totale;
  }
  return J(c);
};

const FORNITORI = [
  { id: 'f-gt', ragione_sociale: 'GREEN TYRE PROJECT SRL', stato: 'attivo' },
  { id: 'f-to', ragione_sociale: 'TORRES GIOVANNI', fattura_tramite_nome: 'GREEN TYRE PROJECT SRL', stato: 'attivo' },
  { id: 'f-em', ragione_sociale: 'EMMESSE SRLS', stato: 'attivo' },
  { id: 'f-sm', ragione_sociale: 'SMOCO S.R.L.', interno: true, stato: 'attivo' },
  { id: 'f-ga', ragione_sociale: 'GATIM S.R.L.', stato: 'attivo' },
  { id: 'f-ns', ragione_sociale: 'NAPPI SUD SRL', stato: 'attivo' },
  { id: 'f-tr', ragione_sociale: 'TRANSAR SRL', stato: 'attivo' },
];
const tariffa = (id, fornitore, prestazione, valore, extra = {}) => ({ id, direzione: 'PASSIVA', prestazione, tipologia: 'RETE', fornitore_nome: fornitore, unita_misura: '€/t', valore, stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', ...extra });
const TARIFFE = [
  tariffa('t-gt', 'GREEN TYRE PROJECT SRL', 'RACCOLTA', 90),
  tariffa('t-em', 'EMMESSE SRLS', 'RACCOLTA', 72),
  tariffa('t-ga', 'GATIM S.R.L.', 'TRATTAMENTO', 95),
  tariffa('t-gt-aci', 'GREEN TYRE PROJECT SRL', 'RACCOLTA', 225, { tipologia: 'ACI' }),
  tariffa('t-ga-aci', 'GATIM S.R.L.', 'TRATTAMENTO', 95, { tipologia: 'ACI' }),
  tariffa('t-tr', 'TRANSAR SRL', 'TRASPORTO_SECONDARIA', 400, { tipologia: 'TUTTE', unita_misura: '€/viaggio', produttore: 'NAPPI SUD SRL', destinatario: 'GATIM S.R.L.' }),
];
const primaria = (id, trasportatore, kg, quando, extra = {}) => ({
  id, stato: 'terminato', id_ordine: 'ET' + id, numero_fir: 'RGYTR' + id, trasportatore, provincia: 'NA', regione: 'Campania',
  destinazione: 'GATIM S.R.L.', tipo_destinazione: 'imp', classe: 'P', peso_effettivo: kg, automezzo: 'AB' + id,
  ordine_immesso_il: '2026-09-01T08:00:00.000Z', trasporto_iniziato_il: quando, trasporto_finito_il: quando, ...extra,
});
// Settembre: il surplus comincia il 15. a e' prima, b e c dopo (c e' del
// subraccoglitore, che fattura tramite GREEN TYRE), d e' di SMOCO (interno), e
// finisce alle 23:00 del 30/09 (21:00Z: settembre), f alle 00:30 del 01/10
// (22:30Z del 30/09: ottobre, fuori dal mese).
const PRIMARIE = [
  primaria('a', 'GREEN TYRE PROJECT SRL', 10000, '2026-09-10T08:00:00.000Z'),
  primaria('b', 'GREEN TYRE PROJECT SRL', 5000, '2026-09-20T08:00:00.000Z'),
  primaria('c', 'TORRES GIOVANNI', 3003, '2026-09-25T08:00:00.000Z'),
  primaria('d', 'SMOCO S.R.L.', 4000, '2026-09-22T08:00:00.000Z'),
  primaria('e', 'EMMESSE SRLS', 2000, '2026-09-30T21:00:00.000Z'),
  primaria('f', 'EMMESSE SRLS', 1000, '2026-09-30T22:30:00.000Z'),
];
const surplus = (id, tipologia, extra = {}) => ({
  id, gruppo: 'fs', nome: 'Fuel Surcharge', origine: 'CONSORZIO', riferimento: 'comunicazione Ecotyre', tipologia, prestazione: 'RACCOLTA',
  a_chi: 'tutti', euro_t_passiva: 5, euro_t_attiva: 5, data_inizio_validita: '2026-09-15', data_fine_validita: '2026-12-31', stato: 'attivo',
  created_date: '2026-10-13T08:00:00.000Z', ...extra,
});
const FS = [surplus('fs-rete', 'RETE'), surplus('fs-aci', 'ACI', { euro_t_passiva: 7 }), surplus('fs-extra', 'EXTRA_RACCOLTA')];
const BASE = archivi({ primarieRete: PRIMARIE, tariffeAll: TARIFFE, fornitoriAll: FORNITORI });

await sezione('1. UN MESE COSTRUITO: LE RIGHE STANDARD NON CAMBIANO, LA RIGA DEL SURPLUS SI AGGIUNGE', async () => {
  const senza = calcolaPassivaMese(BASE, 2026, 8, 'Settembre', 'RETE');
  const vuoto = calcolaPassivaMese({ ...BASE, surplusAll: [] }, 2026, 8, 'Settembre', 'RETE');
  const con = calcolaPassivaMese({ ...BASE, surplusAll: FS }, 2026, 8, 'Settembre', 'RETE');
  verifica('senza surplus i campi nuovi ci sono e sono vuoti', senza.surplus_del_mese.length === 0 && senza.totali.surplus.totale === 0
    && senza.raccoglitori.every(f => f.totale_surplus === 0 && f.surplus.length === 0 && f.totale_standard === f.totale_euro), J(senza.totali));
  verifica("surplusAll vuoto e' come non passarlo", J(senza) === J(vuoto));
  verifica('con il surplus, righe standard, tonnellate e quadratura identiche a senza', senzaSurplus(con) === senzaSurplus(senza), senzaSurplus(con).slice(0, 300));
  verifica('la quadratura e\' la stessa: le tonnellate non si contano due volte', J(con.quadratura) === J(senza.quadratura) && con.quadratura.coincidente === true, J(con.quadratura));

  const gt = con.raccoglitori.find(f => f.fornitore === 'GREEN TYRE PROJECT SRL');
  const v = gt && gt.surplus[0];
  verifica('GREEN TYRE: una riga del surplus, sui soli chili dal 15 (5.000 suoi + 3.003 del subraccoglitore)', gt && gt.surplus.length === 1 && v.tonnellate === 8.003, J(gt && gt.surplus));
  verifica('8,003 t x 5,00 = 40,015: 40,02, il centesimo di Excel', v && v.importo === 40.02, J(v));
  verifica('la riga porta nome, origine a parole, €/t, periodo ed etichetta', v && v.nome === 'Fuel Surcharge' && v.origine === 'consorzio Ecotyre' && v.euro_t === 5
    && v.dal === '2026-09-15' && v.al === '2026-12-31' && v.surplus_id === 'fs-rete' && v.prestazione === 'RACCOLTA'
    && v.etichetta === 'Fuel Surcharge (consorzio Ecotyre), dal 15/09/2026 al 31/12/2026', J(v));
  verifica('le tonnellate del fornitore restano quelle delle righe (18,003), senza il surplus', gt && gt.totale_tonnellate === 18.003, String(gt && gt.totale_tonnellate));
  verifica('totale_euro = standard + surplus (1.620,27 + 40,02 = 1.660,29)', gt && gt.totale_standard === 1620.27 && gt.totale_surplus === 40.02 && gt.totale_euro === 1660.29, J(gt && [gt.totale_standard, gt.totale_surplus, gt.totale_euro]));

  const em = con.raccoglitori.find(f => f.fornitore === 'EMMESSE SRLS');
  verifica("EMMESSE: il trasporto finito alle 23:00 italiane del 30/09 e' di settembre e prende il surplus; quello delle 00:30 del 01/10 no (e' di ottobre)",
    em && em.surplus.length === 1 && em.surplus[0].tonnellate === 2 && em.surplus[0].importo === 10, J(em && em.surplus));
  const sm = con.raccoglitori.find(f => f.fornitore === 'SMOCO S.R.L.');
  verifica('SMOCO e\' interno: nessuna riga del surplus, totale zero', sm && sm.interno && sm.surplus.length === 0 && sm.totale_euro === 0, J(sm));

  const sdm = con.surplus_del_mese;
  verifica('surplus_del_mese: un solo surplus, quello della rete (l\'ACI non tocca la rete)', sdm.length === 1 && sdm[0].surplus_id === 'fs-rete', J(sdm.map(s => s.surplus_id)));
  const s0 = sdm[0] || {};
  verifica('pagato: 10,003 t a 2 raccoglitori, 50,02 €', s0.tonnellate_pagate === 10.003 && s0.importo === 50.02 && s0.fornitori.length === 2, J(s0));
  verifica('i chili dell\'interno stanno a parte: SMOCO 4 t', s0.tonnellate_interni === 4 && J(s0.interni) === J([{ fornitore: 'SMOCO S.R.L.', tonnellate: 4 }]), J(s0.interni));
  verifica('la nota dice tutto all\'italiana', /^Fuel Surcharge \(consorzio Ecotyre\), dal 15\/09\/2026 al 31\/12\/2026: \+5,00 €\/t a tutti i raccoglitori, sulle stesse tonnellate del mese\. Rete, settembre 2026: 10,003 t a 2 raccoglitori, 50,02 €\. SMOCO S\.R\.L\. \(interno\) 4,00 t: non si paga\.$/.test(s0.nota || ''), s0.nota);
  verifica('totali: le chiavi di sempre comprendono il surplus, standard e surplus le scompongono',
    con.totali.raccoglitori === round2(senza.totali.raccoglitori + 50.02) && con.totali.standard.raccoglitori === senza.totali.raccoglitori
    && con.totali.surplus.raccoglitori === 50.02 && con.totali.surplus.totale === 50.02
    && con.totali.totale_complessivo === round2(senza.totali.totale_complessivo + 50.02) && con.totali.standard.totale === senza.totali.totale_complessivo, J(con.totali));
  verifica('nessuna anomalia nuova', J(con.anomalie) === J(senza.anomalie), J(con.anomalie));
  verifica('il trattamento di GATIM non prende un surplus di raccolta', con.impianti_stoccaggi.every(f => f.surplus.length === 0 && f.totale_surplus === 0));

  const ott = calcolaPassivaMese({ ...BASE, surplusAll: FS }, 2026, 9, 'Ottobre', 'RETE');
  const emO = ott.raccoglitori.find(f => f.fornitore === 'EMMESSE SRLS');
  verifica('a ottobre il trasporto delle 00:30 del 01/10 prende il suo surplus: 1 t, 5,00 €', emO && emO.surplus.length === 1 && emO.surplus[0].importo === 5, J(emO && emO.surplus));
  const ago = calcolaPassivaMese({ ...BASE, primarieRete: PRIMARIE.map(r => ({ ...r, trasporto_finito_il: r.trasporto_finito_il.replace('2026-09-', '2026-08-') })), surplusAll: FS }, 2026, 7, 'Agosto', 'RETE');
  verifica('ad agosto il surplus non c\'e\': niente righe, niente surplus_del_mese', ago.surplus_del_mese.length === 0 && ago.totali.surplus.totale === 0, J(ago.totali.surplus));
  const finitoAl = calcolaPassivaMese({ ...BASE, surplusAll: [surplus('fs-rete', 'RETE', { data_fine_validita: '2026-09-30' })] }, 2026, 8, 'Settembre', 'RETE');
  verifica('la fine validita\' vale per tutto il 30/09 italiano (estremi compresi)', finitoAl.raccoglitori.find(f => f.fornitore === 'EMMESSE SRLS').surplus.length === 1);
  const spento = calcolaPassivaMese({ ...BASE, surplusAll: [surplus('fs-rete', 'RETE', { stato: 'non_attivo' })] }, 2026, 8, 'Settembre', 'RETE');
  verifica('un surplus disattivato non vale mai', spento.surplus_del_mese.length === 0 && spento.totali.surplus.totale === 0);
  const soloAttivo = calcolaPassivaMese({ ...BASE, surplusAll: [surplus('fs-rete', 'RETE', { euro_t_passiva: null })] }, 2026, 8, 'Settembre', 'RETE');
  verifica('un surplus solo attivo (nessun importo ai fornitori) non tocca la passiva', soloAttivo.surplus_del_mese.length === 0 && soloAttivo.totali.surplus.totale === 0);
  const doppio = calcolaPassivaMese({ ...BASE, surplusAll: [...FS, surplus('acc-1', 'RETE', { nome: 'Accordo Emmesse', origine: 'ACCORDO_COMMERCIALE', a_chi: 'elenco', fornitori_json: J([{ id: 'f-em', nome: 'EMMESSE SRLS' }]), euro_t_passiva: 2, euro_t_attiva: null })] }, 2026, 8, 'Settembre', 'RETE');
  const emD = doppio.raccoglitori.find(f => f.fornitore === 'EMMESSE SRLS');
  verifica('due surplus diversi si pagano tutti e due, ognuno con la sua riga (in ordine di nome)', emD && J(emD.surplus.map(s => [s.nome, s.importo])) === J([['Accordo Emmesse', 4], ['Fuel Surcharge', 10]]) && emD.totale_surplus === 14, J(emD && emD.surplus));
});

await sezione('2. CHI LO RICEVE: ELENCO, SUBRACCOGLITORE, ELENCO SBAGLIATO', async () => {
  const soloTorres = surplus('fs-to', 'RETE', { a_chi: 'elenco', fornitori_json: J([{ id: 'f-to', nome: 'TORRES GIOVANNI' }]) });
  const p = calcolaPassivaMese({ ...BASE, surplusAll: [soloTorres] }, 2026, 8, 'Settembre', 'RETE');
  const gt = p.raccoglitori.find(f => f.fornitore === 'GREEN TYRE PROJECT SRL');
  verifica('un elenco che nomina il subraccoglitore: il surplus va al principale che fattura, sulle sole tonnellate del sub (3,003 t, 15,02 €)',
    gt && gt.surplus.length === 1 && gt.surplus[0].tonnellate === 3.003 && gt.surplus[0].importo === 15.02, J(gt && gt.surplus));
  verifica('e agli altri niente', p.raccoglitori.filter(f => f.surplus.length).length === 1);
  const perNome = surplus('fs-ga', 'RETE', { a_chi: 'elenco', fornitori_json: J([{ nome: 'Emmesse' }, { nome: 'GATIM' }]) });
  const q = calcolaPassivaMese({ ...BASE, surplusAll: [perNome] }, 2026, 8, 'Settembre', 'RETE');
  verifica('per nome normalizzato: «Emmesse» e\' EMMESSE SRLS', (q.raccoglitori.find(f => f.fornitore === 'EMMESSE SRLS') || {}).totale_surplus === 10);
  const s0 = q.surplus_del_mese[0] || {};
  verifica('GATIM nell\'elenco non ha raccolte: si dice in senza_righe e nella nota', J(s0.senza_righe) === J(['GATIM']) && /Nell'elenco c'è GATIM, che in questo mese non ha righe di raccolta in questo canale/.test(s0.nota || ''), J(s0));
  verifica('ed e\' un\'informazione, non un\'anomalia', J(q.anomalie) === J(calcolaPassivaMese(BASE, 2026, 8, 'Settembre', 'RETE').anomalie));
});

await sezione('3. ACI, IMPIANTI, TRASPORTI ED EXTRA RACCOLTA: OGNI CANALE IL SUO', async () => {
  const aciRec = primaria('x', 'GREEN TYRE PROJECT SRL', 2000, '2026-09-20T08:00:00.000Z', { classe: '9', prodotto: '.class9' });
  const p = calcolaPassivaMese({ ...BASE, primarieAci: [aciRec], surplusAll: FS }, 2026, 8, 'Settembre', 'ACI');
  const gt = p.raccoglitori.find(f => f.fornitore === 'GREEN TYRE PROJECT SRL');
  verifica('nell\'ACI vale il surplus dell\'ACI (7 €/t): 2 t, 14,00 €', gt && gt.surplus.length === 1 && gt.surplus[0].surplus_id === 'fs-aci' && gt.surplus[0].importo === 14, J(gt && gt.surplus));
  const rete = calcolaPassivaMese({ ...BASE, primarieAci: [aciRec], surplusAll: FS }, 2026, 8, 'Settembre', 'RETE');
  verifica('e la rete non vede ne\' i chili ACI ne\' il surplus ACI', rete.surplus_del_mese.every(s => s.surplus_id === 'fs-rete') && rete.totali.surplus.totale === 50.02, J(rete.totali.surplus));

  // trattamento a GATIM, solo a lui (elenco): su tutto quello che gli arriva
  const tratt = surplus('tr-ga', 'RETE', { nome: 'Accordo Gatim', origine: 'ACCORDO_COMMERCIALE', prestazione: 'TRATTAMENTO', a_chi: 'elenco', fornitori_json: J([{ id: 'f-ga', nome: 'GATIM S.R.L.' }]), euro_t_passiva: 3, euro_t_attiva: null });
  const pt = calcolaPassivaMese({ ...BASE, surplusAll: [tratt] }, 2026, 8, 'Settembre', 'RETE');
  const ga = pt.impianti_stoccaggi.find(f => f.fornitore === 'GATIM S.R.L.');
  verifica('il surplus di trattamento a GATIM su tutto il conferito dal 15 (5.000 + 3.003 + 4.000 + 2.000 = 14,003 t a 3 €/t = 42,01)',
    ga && ga.surplus.length === 1 && ga.surplus[0].tonnellate === 14.003 && ga.surplus[0].importo === 42.01 && pt.totali.surplus.impianti_stoccaggi === 42.01, J(ga && ga.surplus));
  verifica('e i raccoglitori non lo prendono', pt.raccoglitori.every(f => f.surplus.length === 0));

  // trasporto delle secondarie: un viaggio misto rete+ACI, a tonnellata ogni canale le sue
  const sec = (id, kg, aci, g) => ({ id, stato: 'terminato', id_ordine: id, numero_fir: 'S' + id, stoccaggio: 'NAPPI SUD SRL', trasportatore: 'TRANSAR SRL', destinazione: 'GATIM S.R.L.', tipo_destinazione: 'imp',
    classe: aci ? '9' : 'P', prodotto: aci ? '.class9' : '', peso_effettivo: kg, automezzo: 'AA111AA', ordine_immesso_il: '2026-09-01T00:00:00.000Z', trasporto_iniziato_il: `2026-09-${g}T08:00:00.000Z`, trasporto_finito_il: `2026-09-${g}T08:00:00.000Z` });
  const secondarie = [sec('A', 10000, false, '16'), sec('B', 8000, false, '18'), sec('C', 3000, true, '18')];
  const trasp = (tip) => surplus('ts-' + tip, tip, { nome: 'Fuel Surcharge', prestazione: 'TRASPORTO_SECONDARIA', euro_t_passiva: 2, euro_t_attiva: null });
  const tR = calcolaPassivaMese({ ...BASE, primarieRete: [], secondarieAll: secondarie, surplusAll: [trasp('RETE'), trasp('ACI')] }, 2026, 8, 'Settembre', 'RETE');
  const tA = calcolaPassivaMese({ ...BASE, primarieRete: [], secondarieAll: secondarie, surplusAll: [trasp('RETE'), trasp('ACI')] }, 2026, 8, 'Settembre', 'ACI');
  const trR = tR.trasporti_secondaria.find(f => f.fornitore === 'TRANSAR SRL');
  const trA = tA.trasporti_secondaria.find(f => f.fornitore === 'TRANSAR SRL');
  verifica('trasporto delle secondarie, rete: le sole 18 t di rete, anche sul viaggio misto (36,00 €)', trR && trR.surplus.length === 1 && trR.surplus[0].tonnellate === 18 && trR.surplus[0].importo === 36, J(trR && trR.surplus));
  verifica('e l\'ACI le sue 3 t (6,00 €): i canali non si sommano', trA && trA.surplus.length === 1 && trA.surplus[0].tonnellate === 3 && trA.surplus[0].importo === 6, J(trA && trA.surplus));
  verifica('le righe della tratta restano quelle (a viaggio, la quota del misto)', senzaSurplus(tR) === senzaSurplus(calcolaPassivaMese({ ...BASE, primarieRete: [], secondarieAll: secondarie }, 2026, 8, 'Settembre', 'RETE')));

  // extra raccolta: la raccolta solo sugli interventi primari
  const iv = (id, tipo, kg, extra = {}) => ({ id, stato: 'terminato', id_ordine: id, numero_fir: 'FX' + id, tipo_movimento: tipo, trasportatore: 'EMMESSE SRLS', provincia: 'CS', destinazione: 'GATIM S.R.L.', tipo_destinazione: 'imp', classe: 'P',
    peso_effettivo: kg, costo_raccolta_t: tipo === 'primaria' ? 80 : 0, costo_trattamento_t: 95, ordine_immesso_il: '2026-09-01T00:00:00.000Z', trasporto_iniziato_il: '2026-09-20T08:00:00.000Z', trasporto_finito_il: '2026-09-20T08:00:00.000Z', ...extra });
  const ex = calcolaPassivaMese(archivi({ extraRaccoltaAll: [iv('1', 'primaria', 2000), iv('2', 'secondaria', 3000, { stoccaggio: 'NAPPI SUD SRL', costo_trasporto_viaggio: 300 })], fornitoriAll: FORNITORI, surplusAll: FS }), 2026, 8, 'Settembre', 'EXTRA_RACCOLTA');
  const emX = ex.raccoglitori.find(f => f.fornitore === 'EMMESSE SRLS');
  verifica('extra raccolta: il surplus di raccolta sulle sole 2 t dell\'intervento primario, non sulla secondaria (10,00 €)', emX && emX.surplus.length === 1 && emX.surplus[0].tonnellate === 2 && emX.surplus[0].importo === 10 && emX.surplus[0].surplus_id === 'fs-extra', J(emX && emX.surplus));
  verifica('e niente al trasporto della secondaria (il surplus e\' di raccolta)', ex.trasporti_secondaria.every(f => f.surplus.length === 0));
  const exSm = calcolaPassivaMese(archivi({ extraRaccoltaAll: [iv('3', 'primaria', 460, { trasportatore: 'SMOCO S.R.L.', costo_raccolta_t: 0 })], fornitoriAll: FORNITORI, surplusAll: FS }), 2026, 8, 'Settembre', 'EXTRA_RACCOLTA');
  verifica('un intervento raccolto da SMOCO: niente riga, 0,46 t fra gli interni', exSm.surplus_del_mese[0] && exSm.surplus_del_mese[0].tonnellate_interni === 0.46 && exSm.surplus_del_mese[0].importo === 0, J(exSm.surplus_del_mese));
  const exVuoto = calcolaPassivaMese(archivi({ fornitoriAll: FORNITORI, surplusAll: FS }), 2026, 8, 'Settembre', 'EXTRA_RACCOLTA');
  verifica('in un mese senza interventi il surplus in corso si dice lo stesso, a zero', exVuoto.surplus_del_mese.length === 1 && /Extra raccolta, settembre 2026: nessuna tonnellata da pagare\./.test(exVuoto.surplus_del_mese[0].nota), J(exVuoto.surplus_del_mese));
});

await sezione('4. LE FUNZIONI CHE CHIAMANO IL CALCOLO LEGGONO SurplusTariffa', async () => {
  const DB = { PrimariaRete: PRIMARIE, Tariffa: TARIFFE, Fornitore: FORNITORI, SurplusTariffa: FS, Secondaria: [], PrimariaAci: [], ExtraRaccolta: [] };
  const calc = await caricaFunzione('calcolaPassiva');
  const r = await chiama(calc, { db: DB, corpo: { anno: 2026, mese: 'Settembre', tipologia: 'RETE' } });
  verifica('calcolaPassiva: il Fuel Surcharge c\'e\' (50,02 €)', r.stato === 200 && r.j.totali && r.j.totali.surplus.totale === 50.02 && r.j.surplus_del_mese.length === 1, `${r.stato} ${J(r.j.totali)}`);
  const senzaArchivio = await chiama(calc, { db: { ...DB, SurplusTariffa: [] }, corpo: { anno: 2026, mese: 'Settembre', tipologia: 'RETE' } });
  verifica('e senza surplus in archivio i numeri sono quelli di prima', senzaArchivio.j.totali.surplus.totale === 0 && senzaArchivio.j.totali.totale_complessivo === r.j.totali.standard.totale);

  const congela = await caricaFunzione('congelaPassivaMese');
  const c = await chiama(congela, { db: DB, corpo: { anno: 2026, mese: 9, canale: 'RETE' } });
  const scritto = c.db.ChiusuraPassivaMese && c.db.ChiusuraPassivaMese[0];
  const json = scritto && JSON.parse(scritto.passiva_json || 'null');
  verifica('congelaPassivaMese: il totale congelato comprende il surplus (standard + 50,02)', c.stato === 200 && scritto && scritto.totale_euro === round2(senzaArchivio.j.totali.totale_complessivo + 50.02), `${c.stato} ${J(c.j).slice(0, 300)}`);
  verifica('e il conto congelato porta le righe del surplus, per il confronto dei consuntivi', json && json.surplus_del_mese.length === 1 && json.raccoglitori.some(f => f.totale_surplus === 40.02), J(json && json.surplus_del_mese));
  verifica('il riepilogo dice standard e surplus', c.j.riepilogo && c.j.riepilogo.totale_surplus === 50.02 && c.j.riepilogo.totale_standard === r.j.totali.standard.totale && c.j.riepilogo.surplus.length === 1, J(c.j.riepilogo));

  const secondarie = [
    { id: 's1', stato: 'terminato', id_ordine: 's1', numero_fir: 'SS1', stoccaggio: 'NAPPI SUD SRL', trasportatore: 'TRANSAR SRL', destinazione: 'GATIM S.R.L.', tipo_destinazione: 'imp', classe: 'P', peso_effettivo: 10000, automezzo: 'AA111AA',
      ordine_immesso_il: '2026-09-01T00:00:00.000Z', trasporto_iniziato_il: '2026-09-16T08:00:00.000Z', trasporto_finito_il: '2026-09-16T08:00:00.000Z' },
  ];
  const trasp = surplus('ts-rete', 'RETE', { prestazione: 'TRASPORTO_SECONDARIA', euro_t_passiva: 2, euro_t_attiva: null });
  const rep = await caricaFunzione('reportConferimenti');
  const q = await chiama(rep, { db: { ...DB, Secondaria: secondarie, SurplusTariffa: [...FS, trasp] }, corpo: { anno: 2026, mese: 9, canale: 'RETE', tipo: 'secondaria', con_passiva: true } });
  const qd = q.j.quadratura || {};
  verifica('reportConferimenti: la quadratura delle tratte resta sui chili e sull\'importo delle tratte (400,00)', q.stato === 200 && qd.disponibile === true && qd.quadra === true && qd.importo_passiva === 400, `${q.stato} ${J(qd).slice(0, 300)}`);
  verifica('e il surplus del trasporto delle secondarie si dice a parte (10 t, 20,00 €)', J((qd.surplus_del_mese || []).map(s => [s.nome, s.tonnellate, s.importo])) === J([['Fuel Surcharge', 10, 20]]), J(qd.surplus_del_mese));
});

await sezione('5. SUI DATI VERI', async () => {
  const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
  const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
  const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
  if (!copie.length) {
    console.log(`  Nessuna copia dei dati veri in ${CARTELLA}: questa parte si salta.`);
  } else {
    const copia = copie[copie.length - 1];
    const A = JSON.parse(gunzipSync(readFileSync(CARTELLA + copia)).toString('utf8')).archivi;
    // Gli archivi come li leggono le funzioni: tariffe passive, fornitori attivi.
    const veri = {
      primarieRete: A.PrimariaRete || [], primarieAci: A.PrimariaAci || [], secondarieAll: A.Secondaria || [], extraRaccoltaAll: A.ExtraRaccolta || [],
      tariffeAll: (A.Tariffa || []).filter(t => String(t.direzione || 'PASSIVA') === 'PASSIVA'),
      fornitoriAll: (A.Fornitore || []).filter(x => x.stato === 'attivo'),
    };
    const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    // L'IMPRONTA DI PRIMA: i totali della passiva di ogni mese del 2026 (raccoglitori,
    // impianti e stoccaggi, trasporti, totale, tonnellate della quadratura, quanti
    // fornitori, quante anomalie), calcolati col codice di prima del surplus sulla
    // copia dell'11/10/2026. Con un'altra copia questa parte si salta: i numeri sono
    // quelli di quella copia.
    const IMPRONTA = {
      'treadrider-dati-veri-2026-10-11.json.gz': {
        RETE: '49733.56/73699.23/2351.92/125784.71/851.29/18/0 55936.68/70261.73/4073.9/130272.31/915.48/19/0 46793.42/68558.33/4207.14/119558.89/868.47/19/0 52965.2/73697.25/3511.4/130173.85/932.55/20/0 60021.66/77652.91/2999.1/140673.67/1053.85/19/0 66313.16/91807.14/3784.8/161905.1/1126.08/21/0 63256.84/87636.52/4032/154925.36/1122.24/18/0 28123.66/40421.52/2035.4/70580.58/506.52/19/0 65351.38/87888.4/3572.96/156812.74/1120.24/19/0 18033.52/27335.99/2731.76/48101.27/321.83/15/0 0/0/0/0/0/0/0 0/0/0/0/0/0/0',
        ACI: '0/3041.4/500/3541.4/20.64/5/0 0/66/0/66/6.6/2/0 196.88/1470.04/64.2/1731.12/22.28/8/0 738/2366.7/0/3104.7/8.2/3/0 1431.1/2180.95/0/3612.05/21.17/9/1 1579.96/2063.98/120.6/3764.54/23.96/9/0 1026.4/1936.5/54.6/3017.5/19.32/10/0 345.92/721.36/199.2/1266.48/6.8/6/0 1509.38/2873.89/49.2/4432.47/18.89/9/0 0/0/0/0/0/0/0 0/0/0/0/0/0/0 0/0/0/0/0/0/0',
        EXTRA_RACCOLTA: '0/0/0/0/0/0/0 0/0/0/0/0/0/0 0/0/0/0/0/0/0 36/42/0/78/0.4/2/0 0/0/0/0/0/0/0 0/0/0/0/0/0/0 0/41.4/0/41.4/0.46/2/0 0/0/0/0/0/0/0 0/0/0/0/0/0/0 0/0/0/0/0/0/0 0/0/0/0/0/0/0 0/0/0/0/0/0/0',
      },
    }[copia];
    const impronta = (p) => [p.totali.raccoglitori, p.totali.impianti_stoccaggi, p.totali.trasporti_secondaria, p.totali.totale_complessivo, p.quadratura.tonnellate_totali,
      p.raccoglitori.length + p.impianti_stoccaggi.length + p.trasporti_secondaria.length, p.anomalie.length].join('/');
    for (const canale of ['RETE', 'ACI', 'EXTRA_RACCOLTA']) {
      const mesi = [];
      let vuoti = true;
      for (let m = 0; m < 12; m++) {
        const p = calcolaPassivaMese({ ...veri, surplusAll: [] }, 2026, m, MESI[m], canale);
        mesi.push(impronta(p));
        if (p.surplus_del_mese.length || p.totali.surplus.totale !== 0 || p.totali.standard.totale !== p.totali.totale_complessivo) vuoti = false;
      }
      verifica(`${canale}: senza surplus, ogni mese del 2026 senza righe di surplus e con lo standard uguale al totale`, vuoti);
      if (IMPRONTA) verifica(`${canale}: senza surplus, i totali di ogni mese del 2026 sono quelli di prima del surplus`, mesi.join(' ') === IMPRONTA[canale], `\n    oggi:  ${mesi.join(' ')}\n    prima: ${IMPRONTA[canale]}`);
    }
    if (!IMPRONTA) console.log(`  La copia ${copia} non e' quella dell'impronta (11/10/2026): il confronto coi totali di prima si salta.`);

    // Il Fuel Surcharge simulato su settembre: le tonnellate di settembre come
    // esempio di un mese di ottobre (il progetto del 12/10/2026, § 7).
    const fsSettembre = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(tip => surplus('fs-' + tip, tip, { data_inizio_validita: '2026-09-01', data_fine_validita: '2026-09-30' }));
    const conFs = (canale, m = 8, s = fsSettembre) => calcolaPassivaMese({ ...veri, surplusAll: s }, 2026, m, MESI[m], canale);
    const senzaFs = (canale, m = 8) => calcolaPassivaMese(veri, 2026, m, MESI[m], canale);
    if (copia === 'treadrider-dati-veri-2026-10-11.json.gz') {
      const rete = conFs('RETE');
      const reteSenza = senzaFs('RETE');
      verifica('settembre, rete: Fuel Surcharge 4.332,80 € ai raccoglitori', rete.totali.surplus.raccoglitori === 4332.8 && rete.totali.surplus.totale === 4332.8, J(rete.totali.surplus));
      verifica('settembre, rete: raccoglitori 69.684,18 €, totale 161.145,54 €, standard 156.812,74 € come prima',
        rete.totali.raccoglitori === 69684.18 && rete.totali.totale_complessivo === 161145.54 && rete.totali.standard.totale === 156812.74 && reteSenza.totali.totale_complessivo === 156812.74, J(rete.totali));
      const NOVE = [['GREEN TYRE PROJECT SRL', 255.78, 1278.9], ['Nappi Sud Srl A Socio Unico', 187.6, 938], ['LOGISTICA & PNEUMATICI SRL', 124.8, 624], ['Ecorecuperi Srl', 101.63, 508.15],
        ['GATIM S.R.L.', 63.02, 315.1], ['EMMESSE SRLS', 59.15, 295.75], ['PNEUSERVICE CONVERSANO SRL', 49.96, 249.8], ['ECOLOGICAL SYSTEMS SRL', 22.48, 112.4], ['C.L. SERVICE S.R.L.', 2.14, 10.7]];
      const s0 = rete.surplus_del_mese[0] || {};
      verifica('i nove raccoglitori del progetto, uno per uno', J(s0.fornitori.map(f => [f.fornitore, f.tonnellate, f.importo])) === J(NOVE), J(s0.fornitori));
      verifica('866,56 t pagate; SMOCO 253,68 t interne, non pagate', s0.tonnellate_pagate === 866.56 && s0.tonnellate_interni === 253.68 && J(s0.interni.map(f => f.fornitore)) === J(['SMOCO S.R.L.']), J([s0.tonnellate_pagate, s0.tonnellate_interni, s0.interni]));
      verifica('ogni raccoglitore: la sua riga del surplus, sulle sue tonnellate', rete.raccoglitori.filter(f => !f.interno).every(f => f.surplus.length === 1 && f.surplus[0].tonnellate === f.totale_tonnellate));
      verifica('righe standard, tonnellate e quadratura identiche a senza surplus', senzaSurplus(rete) === senzaSurplus(reteSenza));
      const aci = conFs('ACI');
      verifica('settembre, ACI: 69,95 € (EMMESSE 12,35 t 61,75 €, Nappi Sud 1,64 t 8,20 €), SMOCO 4,90 t non pagate',
        aci.totali.surplus.totale === 69.95 && J(aci.surplus_del_mese[0].fornitori.map(f => [f.fornitore, f.tonnellate, f.importo])) === J([['EMMESSE SRLS', 12.35, 61.75], ['Nappi Sud Srl A Socio Unico', 1.64, 8.2]])
        && aci.surplus_del_mese[0].tonnellate_interni === 4.9 && aci.totali.totale_complessivo === 4502.42, J(aci.totali));
      verifica('ACI: righe standard identiche', senzaSurplus(aci) === senzaSurplus(senzaFs('ACI')));
      const extra = conFs('EXTRA_RACCOLTA');
      verifica('settembre, extra raccolta: nessun intervento, 0', extra.totali.surplus.totale === 0 && extra.surplus_del_mese.length === 1 && extra.surplus_del_mese[0].importo === 0);
      const luglio = conFs('EXTRA_RACCOLTA', 6, ['EXTRA_RACCOLTA'].map(tip => surplus('fs-' + tip, tip, { data_inizio_validita: '2026-07-01', data_fine_validita: '2026-07-31' })));
      verifica('luglio, extra raccolta: l\'intervento di SMOCO (0,46 t) e\' interno, il surplus non si paga', luglio.totali.surplus.totale === 0 && luglio.surplus_del_mese[0].tonnellate_interni === 0.46, J(luglio.surplus_del_mese));

      // Il Fuel Surcharge vero (01/10-31/12): a settembre non c'e', a ottobre (dati
      // fino all'11/10 mattina) la rete paga 1.183,25 € su 236,65 t esterne.
      const vero = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(tip => surplus('fs-' + tip, tip, { data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31' }));
      verifica('il Fuel Surcharge vero non tocca settembre', conFs('RETE', 8, vero).totali.surplus.totale === 0 && conFs('RETE', 8, vero).surplus_del_mese.length === 0);
      const ottobre = conFs('RETE', 9, vero);
      verifica('ottobre fin qui, rete: 236,65 t esterne, 1.183,25 €; SMOCO 85,18 t', ottobre.totali.surplus.totale === 1183.25 && ottobre.surplus_del_mese[0].tonnellate_pagate === 236.65 && ottobre.surplus_del_mese[0].tonnellate_interni === 85.18,
        J([ottobre.totali.surplus, ottobre.surplus_del_mese[0] && ottobre.surplus_del_mese[0].tonnellate_pagate, ottobre.surplus_del_mese[0] && ottobre.surplus_del_mese[0].tonnellate_interni]));
    } else {
      console.log(`  La copia ${copia} non e' quella dell'11/10/2026: i numeri del caso vero (4.332,80 e 69,95) si saltano.`);
    }
  }
});

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
