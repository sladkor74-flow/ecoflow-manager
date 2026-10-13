// IL SURPLUS SULLE TARIFFE NELL'EXTRA RACCOLTA (13/10/2026).
//
// Richiesta dell'utente del 12/10/2026: accanto alle tariffe un surplus in €/t,
// con le sue date, e in attiva come in passiva «una riga con l'importo standard
// ed una per il surplus (sempre riferito alle stesse tonnellate raccolte o
// trattate nel mese)». Il Fuel Surcharge del consorzio Ecotyre, +5 €/t dal
// 01/10/2026 al 31/12/2026, vale anche sull'extra raccolta, con la sua riga e mai
// sommato a rete e ACI.
//
// La pagina Extra Raccolta lavora per intervento, la fattura e la passiva per
// mese: il surplus si arrotonda una volta sul mese (per canale in attiva, per
// fornitore in passiva), e la somma delle quote dei singoli interventi puo'
// scostarsi di un centesimo. Qui si prova che:
// 1. la quota di un intervento segue le regole dei due calcoli (giorno italiano
//    della fine del trasporto, secondarie, interno, subraccoglitore, peso);
// 2. sugli interventi di un mese la pagina dice il RICAVO della fattura
//    (calcolaRigheAttiva) e il COSTO della passiva (calcolaPassivaMese), al
//    centesimo, anche quando le quote sommate fanno un centesimo in piu';
// 3. il blocco dell'extra raccolta del foglio della passiva ha una riga di
//    surplus per raccoglitore, quella della passiva, e le righe degli interventi
//    di prima;
// 4. gli altri surplus (trattamento con la seconda prestazione, trasporto delle
//    secondarie, un elenco per id attraverso il subraccoglitore) tornano uguali;
// 5. la pagina lo dice: riquadri, fascia del surplus col centesimo del mese,
//    costi solo all'amministratore, una lettura sola dei surplus; e dal
//    13/10/2026 sera i pulsanti dei file Excel e PDF passano il contesto coi
//    surplus e i permessi (la riga del Fuel Surcharge nei file, risposta 4
//    dell'utente: la prova dei file e' prove/extraRaccoltaExport.mjs);
// 6. la scheda dell'intervento mostra la quota e dice che fa fede il mese;
// 7. senza surplus niente cambia;
// 8. sui dati veri (copia in ../dati-veri, se c'e'): pagina, fattura e passiva
//    dicono gli stessi numeri ogni mese del 2026, con e senza un surplus, e il
//    Totale imponibile dei file e' quello della fattura.
//
// node prove/extraRaccoltaSurplus.mjs
import { existsSync, readdirSync, readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcolaRigheAttiva } from '../base44/shared/attivaCalcolo.ts';
import { calcolaPassivaMese } from '../base44/shared/passivaCalcolo.ts';
import * as calc from '../src/lib/extraRaccoltaCalc.js';
import { giornoRoma } from '../src/lib/giornoItaliano.js';
import { caricaLibPagine } from './dati/libPagine.mjs';
import { caricaPagina, clienteFinto, aspetta, trova, testo } from './dati/paginaFinta.mjs';

const subfornitori = await caricaLibPagine('lib/subfornitori');
const { bloccoExtraRaccolta } = await caricaLibPagine('lib/extraRaccoltaAmministrazione');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
// Una sezione che si ferma con un errore (il codice di prima non ha le funzioni
// del surplus) conta come fallita e si va avanti con la prossima.
const sezione = async (titolo, corpo) => {
  console.log(titolo);
  try { await corpo(); } catch (e) { ko++; console.log(`  FALLITA: ${titolo}: si ferma con un errore (${e && e.message})`); }
};
const r2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const somma = (righe, campo) => r2((righe || []).reduce((s, r) => s + (Number(r[campo]) || 0), 0));

// ─── Il mese costruito: ottobre 2026 ───
const FORNITORI = [
  { id: 'F-EMM', ragione_sociale: 'EMMESSE SRLS', stato: 'attivo', ruolo_raccolta: true },
  { id: 'F-SMO', ragione_sociale: 'SMOCO S.R.L.', stato: 'attivo', interno: true, ruolo_raccolta: true },
  { id: 'F-GTP', ragione_sociale: 'GREEN TYRE PROJECT SRL', stato: 'attivo', ruolo_raccolta: true, ruolo_trattamento: true },
  { id: 'F-TOR', ragione_sociale: 'TORRES GIOVANNI', stato: 'attivo', fattura_tramite_nome: 'GREEN TYRE PROJECT SRL', ruolo_raccolta: true },
  { id: 'F-GAT', ragione_sociale: 'GATIM S.R.L.', stato: 'attivo', ruolo_trattamento: true },
  { id: 'F-NAP', ragione_sociale: 'NAPPI SUD SRL', stato: 'attivo', ruolo_stoccaggio: true },
];
const surplus = (id, tipologia, altro = {}) => ({
  id, gruppo: 'g-fs', nome: 'Fuel Surcharge', origine: 'CONSORZIO', riferimento: 'comunicazione Ecotyre', tipologia, prestazione: 'RACCOLTA',
  a_chi: 'tutti', fornitori_json: '', euro_t_passiva: 5, euro_t_attiva: 5,
  data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo', ...altro,
});
// Il Fuel Surcharge sui tre canali, e un surplus disattivato che non deve valere mai.
const FS = [surplus('fs-rete', 'RETE'), surplus('fs-aci', 'ACI'), surplus('fs-extra', 'EXTRA_RACCOLTA'),
  surplus('fs-spento', 'EXTRA_RACCOLTA', { nome: 'Vecchio accordo', stato: 'non_attivo', euro_t_passiva: 9, euro_t_attiva: 9 })];

const iv = (id, altro = {}) => ({
  id, stato: 'terminato', tipo_movimento: 'primaria', id_ordine: 'ER-' + id, numero_fir: 'FIR ' + id,
  produttore: 'COMUNE DI PROVA', trasportatore: 'EMMESSE SRLS', destinazione: 'GATIM S.R.L.', tipo_destinazione: 'imp',
  provincia: 'NA', classe: 'P', cer: '160103',
  ordine_immesso_il: '2026-09-20T08:00:00.000Z', trasporto_iniziato_il: '2026-09-28T08:00:00.000Z', trasporto_finito_il: '2026-10-05T08:00:00.000Z',
  peso_effettivo: 1000, prezzo_attivo_t: 202, costo_raccolta_t: 72, costo_trattamento_t: 90,
  ...altro,
});
const A = iv('A', { peso_effettivo: 1001 });
const B = iv('B', { peso_effettivo: 1001, trasporto_finito_il: '2026-10-20T08:00:00.000Z' });
const C = iv('C', { trasportatore: 'SMOCO S.R.L.', peso_effettivo: 460, costo_raccolta_t: 0, trasporto_finito_il: '2026-10-07T08:00:00.000Z' });
const D = iv('D', { trasportatore: 'TORRES GIOVANNI', destinazione: 'GREEN TYRE PROJECT SRL', peso_effettivo: 803, costo_raccolta_t: 85, costo_trattamento_t: 100, trasporto_finito_il: '2026-10-09T08:00:00.000Z' });
// 22:30Z del 30/09 e' l'1/10 alle 00:30 in Italia: e' ottobre e prende il surplus
const E = iv('E', { peso_effettivo: 1200, trasporto_finito_il: '2026-09-30T22:30:00.000Z' });
// 21:00Z del 30/09 e' il 30/09 alle 23:00 in Italia: settembre, niente surplus
const F = iv('F', { peso_effettivo: 999, trasporto_finito_il: '2026-09-30T21:00:00.000Z' });
// una secondaria: non si fattura a Ecotyre e non e' una raccolta
const G = iv('G', { tipo_movimento: 'secondaria', stoccaggio: 'NAPPI SUD SRL', produttore: 'NAPPI SUD SRL', peso_effettivo: 2000, prezzo_attivo_t: 0,
  costo_raccolta_t: 0, costo_trasporto_viaggio: 150, trasporto_finito_il: '2026-10-12T08:00:00.000Z' });
// un terminato senza peso: niente surplus
const H = iv('H', { peso_effettivo: 0, trasporto_finito_il: '2026-10-14T08:00:00.000Z' });
// una richiesta ancora aperta
const I = iv('I', { stato: 'assegnato', trasporto_iniziato_il: null, trasporto_finito_il: null, peso_effettivo: 0 });
const TUTTI = [A, B, C, D, E, F, G, H, I];
const ottobre = (elenco) => elenco.filter(r => String(r.stato).toLowerCase() === 'terminato' && giornoRoma(r.trasporto_finito_il).startsWith('2026-10'));

const contestoCon = (s = FS, fornitori = FORNITORI) => calc.contestoPrezzi([], fornitori, s, subfornitori);
const fattura = (s = FS, extraAll = TUTTI, mese = 'Ottobre') => calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll, fornitori: FORNITORI, tariffe: [], anno: 2026, mese, surplus: s });
const passiva = (s = FS, extraAll = TUTTI, m = 9, mese = 'Ottobre') => calcolaPassivaMese({ primarieRete: [], primarieAci: [], secondarieAll: [], extraRaccoltaAll: extraAll, tariffeAll: [], fornitoriAll: FORNITORI, surplusAll: s }, 2026, m, mese, 'EXTRA_RACCOLTA');

await sezione('1. LA QUOTA DI UN INTERVENTO SEGUE LE REGOLE DELLA FATTURA E DELLA PASSIVA', async () => {
  const c = contestoCon();
  const a = calc.calcExtraRaccolta(A, c);
  verifica('A: +5,01 da Ecotyre e +5,01 a EMMESSE sui suoi 1.001 kg', a.surplus_ricavo === 5.01 && a.surplus_costo === 5.01
    && a.surplus_attivo.length === 1 && a.surplus_passivo.length === 1 && a.surplus_passivo[0].fornitore === 'EMMESSE SRLS', J([a.surplus_ricavo, a.surplus_costo, a.surplus_passivo]));
  verifica('A: ricavo e costo comprendono la quota, lo standard resta quello di prima', a.ricavo_standard === 202.2 && a.ricavo === 207.21
    && a.costo_standard === 162.16 && a.costo_totale === 167.17 && a.margine === 40.04, J([a.ricavo_standard, a.ricavo, a.costo_standard, a.costo_totale, a.margine]));
  const cc = calc.calcExtraRaccolta(C, c);
  verifica('C, raccolto da SMOCO: Ecotyre paga +2,30, a SMOCO niente (interno), e la voce lo dice', cc.surplus_ricavo === 2.3 && cc.surplus_costo === 0
    && cc.surplus_passivo.length === 1 && cc.surplus_passivo[0].interno === true && cc.surplus_passivo[0].importo === 0, J(cc.surplus_passivo));
  const d = calc.calcExtraRaccolta(D, c);
  verifica('D, del subraccoglitore TORRES: il surplus va a GREEN TYRE, che fattura per lui (4,02 su 803 kg)', d.surplus_passivo.length === 1
    && d.surplus_passivo[0].fornitore === 'GREEN TYRE PROJECT SRL' && d.surplus_costo === 4.02 && d.surplus_ricavo === 4.02, J(d.surplus_passivo));
  verifica('E, finito alle 22:30Z del 30/09 (l\'1/10 in Italia): prende il surplus', calc.calcExtraRaccolta(E, c).surplus_ricavo === 6);
  verifica('F, finito alle 21:00Z del 30/09 (il 30/09 in Italia): niente', calc.calcExtraRaccolta(F, c).surplus_attivo.length === 0 && calc.calcExtraRaccolta(F, c).surplus_passivo.length === 0);
  const g = calc.calcExtraRaccolta(G, c);
  verifica('G, secondaria: niente da Ecotyre e niente di raccolta', g.surplus_attivo.length === 0 && g.surplus_passivo.length === 0 && g.ricavo === 0, J([g.surplus_attivo, g.surplus_passivo]));
  const h = calc.calcExtraRaccolta(H, c);
  verifica('H, senza peso: niente surplus, come in fattura e in passiva', h.surplus_attivo.length === 0 && h.surplus_passivo.length === 0);
  verifica('il surplus disattivato e quelli di rete e ACI non contano', a.surplus_attivo.every(v => v.surplus_id === 'fs-extra') && a.surplus_passivo.every(v => v.surplus_id === 'fs-extra'));
});

await sezione('2. SUGLI INTERVENTI DI UN MESE LA PAGINA DICE IL RICAVO DELLA FATTURA', async () => {
  const t = calc.totaliExtraRaccolta(ottobre(TUTTI), contestoCon());
  const f = fattura();
  const righe = f.righe.EXTRA_RACCOLTA;
  const rigaSurplus = righe.filter(r => r.surplus_id);
  verifica('la fattura ha la riga del Fuel Surcharge: 22,33 € sui 4.465 kg del mese', rigaSurplus.length === 1 && rigaSurplus[0].totale === 22.33 && rigaSurplus[0].kg_riferimento === 4465, J(rigaSurplus));
  verifica('ricavi della pagina = totale della fattura, al centesimo (924,26)', t.ricavi === somma(righe, 'totale') && t.ricavi === 924.26, J([t.ricavi, somma(righe, 'totale')]));
  verifica('standard 901,93 e surplus 22,33, come le righe della fattura', t.ricavi_standard === 901.93 && t.surplus.totale_attivo === 22.33
    && t.ricavi_standard === somma(righe.filter(r => !r.surplus_id), 'totale'), J([t.ricavi_standard, t.surplus.totale_attivo]));
  verifica('le quote sommate fanno 22,34: un centesimo in piu\', che la pagina deve dire', t.surplus.quote_attivo === 22.34, String(t.surplus.quote_attivo));
  verifica('le tonnellate raccolte sono quelle di prima (senza la secondaria)', t.kg_raccolti === 1001 + 1001 + 460 + 803 + 1200 + 0, String(t.kg_raccolti));
});

await sezione('3. SUGLI INTERVENTI DI UN MESE LA PAGINA DICE IL COSTO DELLA PASSIVA', async () => {
  const t = calc.totaliExtraRaccolta(ottobre(TUTTI), contestoCon());
  const p = passiva();
  verifica('costi della pagina = totale della passiva, al centesimo (1.058,71)', t.costi === p.totali.totale_complessivo && t.costi === 1058.71, J([t.costi, p.totali]));
  verifica('standard 1.038,68 e surplus 20,03, come la passiva', t.costi_standard === p.totali.standard.totale && t.surplus.totale_passivo === p.totali.surplus.totale
    && t.surplus.totale_passivo === 20.03, J([t.costi_standard, t.surplus.totale_passivo, p.totali.standard, p.totali.surplus]));
  verifica('per fornitore: EMMESSE 16,01 su 3,202 t, GREEN TYRE 4,02 su 0,803 t, come le righe della passiva',
    J(t.surplus.passivo.map(v => [v.fornitore, v.kg, v.importo])) === J([['EMMESSE SRLS', 3202, 16.01], ['GREEN TYRE PROJECT SRL', 803, 4.02]])
    && J(p.raccoglitori.filter(x => x.surplus.length).map(x => [x.fornitore, x.surplus[0].tonnellate, x.surplus[0].importo]).sort()) === J([['EMMESSE SRLS', 3.202, 16.01], ['GREEN TYRE PROJECT SRL', 0.803, 4.02]]),
    J([t.surplus.passivo.map(v => [v.fornitore, v.kg, v.importo]), p.raccoglitori.map(x => [x.fornitore, x.surplus])]));
  verifica('SMOCO interno: 460 kg che il surplus non lo ricevono, come in passiva', J(t.surplus.interni.map(v => [v.fornitore, v.kg])) === J([['SMOCO S.R.L.', 460]])
    && (p.surplus_del_mese[0] || {}).tonnellate_interni === 0.46, J(t.surplus.interni));
  verifica('le quote sommate fanno 20,04: anche qui il centesimo e\' del mese', t.surplus.quote_passivo === 20.04, String(t.surplus.quote_passivo));
  verifica('il margine e\' ricavi meno costi (924,26 - 1.058,71)', t.margine === r2(924.26 - 1058.71), String(t.margine));
});

await sezione('4. IL FOGLIO DELL\'AMMINISTRAZIONE: UNA RIGA DI SURPLUS PER RACCOGLITORE', async () => {
  const senza = bloccoExtraRaccolta(TUTTI, 2026, 'Ottobre');
  const con = bloccoExtraRaccolta(TUTTI, 2026, 'Ottobre', contestoCon());
  const p = passiva();
  verifica('le righe degli interventi sono quelle di prima, una per una', J(con.righe) === J(senza.righe));
  verifica('tonnellate del blocco senza il surplus', con.totale_t === senza.totale_t && con.totale_kg === senza.totale_kg);
  verifica('senza contesto: nessuna riga di surplus e il totale e\' lo standard', senza.surplus.length === 0 && senza.totale_euro === senza.totale_standard && senza.totale_surplus === 0);
  verifica('due righe di surplus, le stesse della passiva (EMMESSE 16,01, GREEN TYRE 4,02)',
    J(con.surplus.map(s => [s.fornitore, s.nome, s.euro_t, s.tonnellate, s.importo])) === J([['EMMESSE SRLS', 'Fuel Surcharge', 5, 3.202, 16.01], ['GREEN TYRE PROJECT SRL', 'Fuel Surcharge', 5, 0.803, 4.02]]), J(con.surplus));
  verifica('la nota dice chi lo ha deciso, il periodo e che le tonnellate sono le stesse', /consorzio Ecotyre, dal 01\/10\/2026 al 31\/12\/2026: sulle stesse tonnellate dei 3 interventi del mese/.test(con.surplus[0].note), con.surplus[0].note);
  verifica('SMOCO interno detto a parte, 0,46 t', J(con.surplus_interni.map(s => [s.fornitore, s.tonnellate])) === J([['SMOCO S.R.L.', 0.46]]) && /non si paga/.test(con.surplus_interni[0].nota), J(con.surplus_interni));
  verifica('totale del blocco = standard + surplus = totale della passiva (1.058,71)', con.totale_standard === senza.totale_standard && con.totale_surplus === 20.03
    && con.totale_euro === r2(con.totale_standard + 20.03) && con.totale_euro === p.totali.totale_complessivo, J([con.totale_standard, con.totale_surplus, con.totale_euro, p.totali.totale_complessivo]));
});

await sezione('5. GLI ALTRI SURPLUS: TRATTAMENTO, TRASPORTO DELLE SECONDARIE, UN ELENCO PER ID', async () => {
  // J finisce in uno stoccaggio con anche un costo di trattamento: la seconda
  // prestazione si paga allo stesso sito, e un surplus di trattamento pure.
  const Jst = iv('J', { destinazione: 'NAPPI SUD SRL', tipo_destinazione: 'stoc', costo_stoccaggio_t: 16, costo_trattamento_t: 90, peso_effettivo: 1500, trasporto_finito_il: '2026-10-15T08:00:00.000Z' });
  const elenco = [...TUTTI, Jst];
  const ALTRI = [...FS,
    surplus('tr', 'EXTRA_RACCOLTA', { nome: 'Accordo trattamento', origine: 'ACCORDO_COMMERCIALE', prestazione: 'TRATTAMENTO', euro_t_passiva: 3, euro_t_attiva: null }),
    surplus('ts', 'EXTRA_RACCOLTA', { nome: 'Accordo trasporti', origine: 'ACCORDO_COMMERCIALE', prestazione: 'TRASPORTO_SECONDARIA', euro_t_passiva: 2, euro_t_attiva: null }),
    surplus('el', 'EXTRA_RACCOLTA', { nome: 'Accordo Green Tyre', origine: 'ACCORDO_COMMERCIALE', a_chi: 'elenco', fornitori_json: J([{ id: 'F-GTP', nome: '' }]), euro_t_passiva: 4, euro_t_attiva: 4 }),
  ];
  const t = calc.totaliExtraRaccolta(ottobre(elenco), contestoCon(ALTRI));
  const p = passiva(ALTRI, elenco);
  const f = fattura(ALTRI, elenco);
  verifica('costi della pagina = passiva, con tutti i surplus', t.costi === p.totali.totale_complessivo && t.surplus.totale_passivo === p.totali.surplus.totale, J([t.costi, t.surplus.totale_passivo, p.totali]));
  verifica('ricavi della pagina = fattura', t.ricavi === somma(f.righe.EXTRA_RACCOLTA, 'totale') && t.surplus.totale_attivo === somma(f.righe.EXTRA_RACCOLTA.filter(r => r.surplus_id), 'totale'),
    J([t.ricavi, somma(f.righe.EXTRA_RACCOLTA, 'totale')]));
  const nappi = t.surplus.passivo.find(v => v.surplus_id === 'tr' && v.fornitore === 'NAPPI SUD SRL');
  verifica('trattamento a NAPPI sulla seconda prestazione dello stoccaggio: 1,5 t a 3 €/t, 4,50', nappi && nappi.importo === 4.5, J(nappi));
  const gatim = t.surplus.passivo.find(v => v.surplus_id === 'tr' && v.fornitore === 'GATIM S.R.L.');
  verifica('trattamento a GATIM anche sulla secondaria: 5,662 t, 16,99', gatim && gatim.kg === 5662 && gatim.importo === 16.99, J(gatim));
  const trasp = t.surplus.passivo.find(v => v.surplus_id === 'ts');
  verifica('trasporto delle secondarie a EMMESSE sulla secondaria G: 2 t a 2 €/t, 4,00', trasp && trasp.fornitore === 'EMMESSE SRLS' && trasp.importo === 4, J(trasp));
  const el = t.surplus.attivo.find(v => v.surplus_id === 'el');
  verifica('l\'elenco per id di GREEN TYRE vale sul subraccoglitore TORRES, in attiva e in passiva (3,21)', el && el.importo === 3.21
    && t.surplus.passivo.some(v => v.surplus_id === 'el' && v.fornitore === 'GREEN TYRE PROJECT SRL' && v.importo === 3.21)
    && f.righe.EXTRA_RACCOLTA.some(r => r.surplus_id === 'el' && r.totale === 3.21), J([el, t.surplus.passivo.filter(v => v.surplus_id === 'el')]));
  verifica('un surplus solo passivo non fa righe in fattura', !f.righe.EXTRA_RACCOLTA.some(r => r.surplus_id === 'tr' || r.surplus_id === 'ts') && !t.surplus.attivo.some(v => v.surplus_id === 'tr' || v.surplus_id === 'ts'));
});

// La pagina montata davvero, senza browser (prove/dati/paginaFinta.mjs), con i
// permessi sostituiti nella copia del sorgente: amministratore o no.
const IMPORT_PERMESSI = "import { usePermessi } from '@/lib/permessi';";
// I file Excel e PDF dell'elenco (13/10/2026): nella copia le due esportazioni
// registrano con che cosa la pagina le chiama, invece di scrivere un file.
const IMPORT_FILE = "import { exportExtraRaccoltaExcel, exportExtraRaccoltaPDF } from '@/lib/extraRaccoltaExport';";
const FILE_FINTI = 'const exportExtraRaccoltaExcel = async (...a) => { globalThis.__FILE_CHIESTI.push([\'excel\', ...a]); };\n'
  + 'const exportExtraRaccoltaPDF = async (...a) => { globalThis.__FILE_CHIESTI.push([\'pdf\', ...a]); };';
globalThis.__FILE_CHIESTI = [];
const { datiExportExtra } = await caricaLibPagine('lib/extraRaccoltaExport');
const SORGENTE_PAGINA = readFileSync(fileURLToPath(new URL('../src/pages/ExtraRaccolta.jsx', import.meta.url)), 'utf8').replace(/\r/g, '');
const cartella = mkdtempSync(join(tmpdir(), 'extra-surplus-'));
async function montaPagina({ admin = true, archivi = {}, rompiSurplus = false } = {}) {
  const copia = join(cartella, `ExtraRaccolta-${admin ? 'admin' : 'utente'}.jsx`);
  writeFileSync(copia, SORGENTE_PAGINA.replace(IMPORT_PERMESSI, `const usePermessi = () => ({ isAdmin: ${admin}, soloLettura: ${!admin} });`).replace(IMPORT_FILE, FILE_FINTI));
  const p = await caricaPagina('pages/ExtraRaccolta', { file: copia });
  const c = clienteFinto({ archivi: { ExtraRaccolta: TUTTI, Tariffa: [], Fornitore: FORNITORI, SurplusTariffa: FS, ...archivi } });
  globalThis.__CLIENTE_FINTO = rompiSurplus
    ? { ...c.cliente, entities: new Proxy({}, { get: (_t, n) => (n === 'SurplusTariffa' ? { list: async () => { throw new Error('lettura non riuscita'); }, filter: async () => { throw new Error('lettura non riuscita'); } } : c.cliente.entities[n]) }) }
    : c.cliente;
  const r = p.monta(p.Componente, {});
  await aspetta(60);
  // anno e mese dai due primi filtri della pagina
  const scegli = async (i, v) => { trova(r.albero, el => el.type && el.type.__finto === 'Select')[i].props.onValueChange(v); await aspetta(20); };
  return { p, c, r, scegli };
}
const riquadro = (r, titolo) => trova(r.albero, el => el.type === 'div' && /border rounded-lg p-3 bg-card/.test(el.props.className || '') && testo(el).startsWith(titolo))[0];
const fasce = (r) => trova(r.albero, el => el.type && el.type.name === 'FasciaSurplus');
// Preme un pulsante dei file e restituisce con che cosa la pagina ha chiamato l'esportazione.
const premi = async (r, scritta) => {
  globalThis.__FILE_CHIESTI = [];
  const b = trova(r.albero, el => el.props && typeof el.props.onClick === 'function' && testo(el).includes(scritta))[0];
  if (!b) return null;
  b.props.onClick();
  await aspetta(20);
  return globalThis.__FILE_CHIESTI[0] || null;
};

await sezione('6. LA PAGINA LO DICE: RIQUADRI, FASCIA, CENTESIMO DEL MESE', async () => {
  verifica('la pagina prende i permessi da usePermessi, come la copia si aspetta', SORGENTE_PAGINA.includes(IMPORT_PERMESSI));
  verifica('e le esportazioni da extraRaccoltaExport.js, come la copia si aspetta', SORGENTE_PAGINA.includes(IMPORT_FILE));
  const { c, r, scegli } = await montaPagina({ admin: true });
  verifica('la pagina si monta senza errori', r.errori.length === 0, String(r.errori[0] || ''));
  const letture = c.letture('SurplusTariffa');
  verifica('i surplus si leggono una volta, tutti, senza filtro sullo stato', letture.length === 1 && letture[0].metodo === 'list', J(letture));
  verifica('i fornitori una volta, tutti', c.letture('Fornitore').length === 1 && c.letture('Fornitore')[0].metodo === 'list', J(c.letture('Fornitore')));
  await scegli(0, '2026');
  await scegli(1, 'Ottobre');
  const ricavi = testo(riquadro(r, 'Ricavi'));
  const costi = testo(riquadro(r, 'Costi'));
  verifica('Ricavi di ottobre: € 924,26, standard € 901,93 · surplus € 22,33 (la fattura)', ricavi.includes('€ 924,26') && ricavi.includes('standard € 901,93 · surplus € 22,33'), ricavi);
  verifica('Costi di ottobre: € 1.058,71, standard € 1.038,68 · surplus € 20,03 (la passiva)', costi.includes('€ 1.058,71') && costi.includes('standard € 1.038,68 · surplus € 20,03'), costi);
  const fs = fasce(r);
  verifica('una fascia, quella del Fuel Surcharge', fs.length === 1 && fs[0].props.p.nome === 'Fuel Surcharge', J(fs.map(x => x.props.p && x.props.p.nome)));
  const fascia = fs[0] && fs[0].type ? testo(fs[0].type(fs[0].props)) : '';
  verifica('la fascia dice il surplus a tonnellata e quanto fa in fattura e in passiva', fascia.includes('consorzio Ecotyre') && fascia.includes('+5,00 €/t')
    && fascia.includes('€ 22,33') && fascia.includes('€ 20,03'), fascia);
  verifica('e che il centesimo che fa fede e\' quello del mese, con le quote che fanno un centesimo in piu\'', fascia.includes('il centesimo che fa fede è quello del mese')
    && fascia.includes('le quote nella tabella fanno € 22,34 in fattura e € 20,04 in passiva'), fascia);
  verifica('e chi lo riceve e chi no', fascia.includes('EMMESSE SRLS 3,202 t, € 16,01') && fascia.includes('SMOCO S.R.L. è interno'), fascia);
  // I FILE HANNO LA RIGA DEL SURPLUS (13/10/2026). Fino a oggi ricevevano il
  // contesto dei soli prezzi e la pagina diceva «I file riportano gli importi
  // standard». Ora i pulsanti passano il contesto della pagina, coi surplus, e i
  // permessi: il Totale imponibile del file e' il Ricavi del riquadro.
  verifica('accanto ai file c\'e\' scritto che il surplus ha la sua riga, e non piu\' che hanno gli importi standard',
    testo(r.albero).includes('Nei file il surplus ha la sua riga prima del totale imponibile, col centesimo del mese come in fattura, e una riga sua nell\'analisi per produttore.')
    && !testo(r.albero).includes('I file riportano gli importi standard'), '');
  for (const [scritta, quale] of [['Esporta Excel', 'excel'], ['Esporta PDF', 'pdf']]) {
    const chiesto = await premi(r, scritta);
    const [tipo, interventi, mese, anno, contestoFile, opzioni] = chiesto || [];
    verifica(`«${scritta}»: la pagina chiama il file di ottobre 2026 coi terminati del mese`, tipo === quale && mese === 'Ottobre' && String(anno) === '2026'
      && J((interventi || []).map(x => x.id).sort()) === J(ottobre(TUTTI).map(x => x.id).sort()), J([tipo, mese, anno, (interventi || []).map(x => x.id)]));
    verifica(`«${scritta}»: col contesto della pagina, che ha il Fuel Surcharge dell'extra raccolta`, !!contestoFile && J((contestoFile.surplus || []).map(s => s.id)) === J(['fs-extra']), J(contestoFile && contestoFile.surplus));
    verifica(`«${scritta}»: e coi permessi dell'amministratore`, J(opzioni) === J({ isAdmin: true }), J(opzioni));
    const dati = contestoFile ? datiExportExtra(interventi, contestoFile) : {};
    verifica(`«${scritta}»: il Totale imponibile del file e' il Ricavi del riquadro (924,26), con la riga del Fuel Surcharge da 22,33`,
      dati.totale_imponibile === 924.26 && ricavi.includes('€ 924,26') && J((dati.surplus || []).map(s => [s.nome, s.importo])) === J([['Fuel Surcharge', 22.33]]), J([dati.totale_imponibile, dati.surplus]));
  }
  // un filtro che non e' il periodo: la fascia lo dice
  await scegli(3, 'EMMESSE SRLS');
  const filtrata = fasce(r)[0] ? testo(fasce(r)[0].type(fasce(r)[0].props)) : '';
  verifica('con un filtro sul trasportatore la fascia dice che il conto e\' sui soli interventi mostrati', filtrata.includes('il conto è sui soli interventi mostrati'), filtrata);
});

await sezione('6b. CHI NON E\' AMMINISTRATORE NON VEDE LA PARTE DEI FORNITORI', async () => {
  const conAccordo = [...FS, surplus('tr', 'EXTRA_RACCOLTA', { nome: 'Accordo trattamento', prestazione: 'TRATTAMENTO', euro_t_passiva: 3, euro_t_attiva: null })];
  const { r, scegli } = await montaPagina({ admin: false, archivi: { SurplusTariffa: conAccordo } });
  await scegli(0, '2026');
  await scegli(1, 'Ottobre');
  const costi = testo(riquadro(r, 'Costi'));
  verifica('il riquadro Costi non scompone il surplus', !costi.includes('surplus'), costi);
  const fs = fasce(r);
  verifica('una fascia sola: il surplus solo ai fornitori non si mostra', fs.length === 1 && fs[0].props.p.nome === 'Fuel Surcharge', J(fs.map(x => x.props.p && x.props.p.nome)));
  const fascia = fs[0] ? testo(fs[0].type(fs[0].props)) : '';
  verifica('la fascia dice la parte da Ecotyre e non quella dei fornitori', fascia.includes('€ 22,33') && !fascia.includes('€ 20,03') && !fascia.includes('in passiva') && !fascia.includes('interno'), fascia);
  // I file (13/10/2026): la riga del surplus si', l'analisi coi costi no.
  verifica('accanto ai file la nota non parla dell\'analisi per produttore', testo(r.albero).includes('Nei file il surplus ha la sua riga prima del totale imponibile, col centesimo del mese come in fattura.')
    && !testo(r.albero).includes('analisi per produttore'), '');
  for (const scritta of ['Esporta Excel', 'Esporta PDF']) {
    const chiesto = await premi(r, scritta);
    verifica(`«${scritta}»: la pagina dice al file che chi esporta non e' amministratore`, !!chiesto && J(chiesto[5]) === J({ isAdmin: false }), J(chiesto && chiesto[5]));
  }
});

await sezione('6c. SE I SURPLUS NON SI LEGGONO, LA PAGINA LO DICE', async () => {
  const { r } = await montaPagina({ admin: true, rompiSurplus: true });
  verifica('l\'avviso c\'e\'', testo(r.albero).includes('I surplus sulle tariffe (come il Fuel Surcharge) non si sono potuti leggere'));
  verifica('e nessuna fascia', fasce(r).length === 0);
});

await sezione('7. LA SCHEDA DELL\'INTERVENTO MOSTRA LA QUOTA E DICE CHE FA FEDE IL MESE', async () => {
  const f = await caricaPagina('components/fatturazione/ExtraRaccoltaForm');
  const cl = clienteFinto({ archivi: { Fornitore: FORNITORI, Tariffa: [], ExtraRaccolta: TUTTI } });
  globalThis.__CLIENTE_FINTO = cl.cliente;
  const scheda = async (initial) => {
    const r = f.monta(f.Componente, { open: true, initial, contesto: contestoCon(), interventi: TUTTI, onSave: () => {}, onCancel: () => {} });
    await aspetta(40);
    return { r, t: testo(r.albero) };
  };
  const a = await scheda(A);
  verifica('si monta senza errori', a.r.errori.length === 0, String(a.r.errori[0] || ''));
  verifica('A: la riga da Ecotyre, +5,00 €/t, € 5,01 su 1,001 t', a.t.includes('Fuel Surcharge') && a.t.includes('+5,00 €/t') && a.t.includes('da Ecotyre') && a.t.includes('€ 5,01 su 1,001 t'), a.t.slice(0, 400));
  verifica('A: la riga al raccoglitore EMMESSE SRLS', a.t.includes('al raccoglitore') && a.t.includes('EMMESSE SRLS: € 5,01'), '');
  verifica('A: il riepilogo dice di cui surplus e che il centesimo e\' del mese', a.t.includes('di cui surplus € 5,01') && a.t.includes('il centesimo che fa fede è quello del mese'));
  const cs = await scheda(C);
  verifica('C, SMOCO: al raccoglitore niente, e perche\'', cs.t.includes('al raccoglitore: niente, SMOCO S.R.L. è interno'), '');
  const e = await scheda(E);
  verifica('E, finito alle 22:30Z del 30/09: nella scheda vale (l\'1/10 in Italia)', e.t.includes('€ 6,00 su 1,20 t'), '');
  const i = await scheda(I);
  verifica('I, ancora senza fine trasporto: dice quando varrebbe', i.t.includes('Se il trasporto finisce fra il 01/10/2026 e il 31/12/2026 vale anche Fuel Surcharge'), '');
});

await sezione('8. SENZA SURPLUS NIENTE CAMBIA', async () => {
  for (const r of TUTTI) {
    const vecchio = calc.calcExtraRaccolta(r);
    const vuoto = calc.calcExtraRaccolta(r, calc.contestoPrezzi([], FORNITORI, [], subfornitori));
    const soloRete = calc.calcExtraRaccolta(r, calc.contestoPrezzi([], FORNITORI, [FS[0], FS[1]], subfornitori));
    for (const [nome, x] of [['senza contesto', vecchio], ['senza surplus', vuoto], ['col surplus della rete e dell\'ACI', soloRete]]) {
      verifica(`${r.id}, ${nome}: ricavo e costo sono lo standard, nessuna quota`, x.ricavo === x.ricavo_standard && x.costo_totale === x.costo_standard
        && !x.surplus_attivo.length && !x.surplus_passivo.length && x.surplus_ricavo === 0 && x.surplus_costo === 0, J(x));
    }
  }
  const t = calc.totaliExtraRaccolta(ottobre(TUTTI), calc.contestoPrezzi([], FORNITORI, [], subfornitori));
  verifica('i totali senza surplus sono quelli della fattura e della passiva senza surplus', t.ricavi === somma(fattura([]).righe.EXTRA_RACCOLTA, 'totale') && t.costi === passiva([]).totali.totale_complessivo,
    J([t.ricavi, t.costi]));
  verifica('e non hanno conti del surplus', t.surplus.attivo.length === 0 && t.surplus.passivo.length === 0 && t.surplus.per_surplus.length === 0);
});

await sezione('9. SUI DATI VERI: PAGINA, FATTURA E PASSIVA OGNI MESE DEL 2026', async () => {
  const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
  const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
  const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
  if (!copie.length) { console.log(`  Nessuna copia dei dati veri in ${CARTELLA}: sezione saltata.`); return; }
  const copia = copie[copie.length - 1];
  const D = JSON.parse(gunzipSync(readFileSync(CARTELLA + copia)).toString('utf8'));
  const Aa = D.archivi;
  const interventi = Aa.ExtraRaccolta || [];
  const fornitori = Aa.Fornitore || [];
  const tariffeAttive = (Aa.Tariffa || []).filter(t => t.direzione === 'ATTIVA');
  const tariffePassive = (Aa.Tariffa || []).filter(t => String(t.direzione || 'PASSIVA') === 'PASSIVA');
  const veri = (Aa.SurplusTariffa || []);
  console.log(`  Copia ${copia}: ${interventi.length} interventi, ${veri.length} surplus in archivio`);
  const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  // Un Fuel Surcharge simulato su tutto il 2026, per avere un surplus in ogni mese
  // con interventi; e quello vero, dall'1/10.
  const simulato = [surplus('sim', 'EXTRA_RACCOLTA', { data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' })];
  const vero = [surplus('vero', 'EXTRA_RACCOLTA')];
  const righe = [];
  for (const [nome, s] of [['senza surplus', veri], ['Fuel Surcharge simulato su tutto il 2026', simulato], ['Fuel Surcharge vero, dall\'1/10', vero]]) {
    let tutti = true;
    let file = true;
    const numeri = [];
    for (let m = 0; m < 12; m++) {
      const delMese = interventi.filter(r => String(r.stato || '').toLowerCase().trim() === 'terminato' && giornoRoma(r.trasporto_finito_il).slice(0, 7) === `2026-${String(m + 1).padStart(2, '0')}`);
      const contestoMese = calc.contestoPrezzi(tariffeAttive, fornitori, s, subfornitori);
      const t = calc.totaliExtraRaccolta(delMese, contestoMese);
      // il Totale imponibile dei file Excel e PDF dell'elenco (13/10/2026): la fattura del mese
      const imponibileFile = datiExportExtra(delMese, contestoMese).totale_imponibile;
      const f = calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll: interventi, fornitori, tariffe: tariffeAttive, anno: 2026, mese: MESI[m], surplus: s });
      const p = calcolaPassivaMese({ primarieRete: [], primarieAci: [], secondarieAll: [], extraRaccoltaAll: interventi, tariffeAll: tariffePassive, fornitoriAll: fornitori.filter(x => x.stato === 'attivo'), surplusAll: s }, 2026, m, MESI[m], 'EXTRA_RACCOLTA');
      const ricavoFattura = somma(f.righe.EXTRA_RACCOLTA, 'totale');
      const uguale = t.ricavi === ricavoFattura && t.costi === p.totali.totale_complessivo && t.surplus.totale_passivo === p.totali.surplus.totale;
      if (!uguale) { tutti = false; console.log(`    ${MESI[m]}: pagina ${t.ricavi}/${t.costi}, fattura ${ricavoFattura}, passiva ${p.totali.totale_complessivo}`); }
      if (imponibileFile !== ricavoFattura) { file = false; console.log(`    ${MESI[m]}: file ${imponibileFile}, fattura ${ricavoFattura}`); }
      if (delMese.length) numeri.push(`${MESI[m]} ricavi ${t.ricavi} (surplus ${t.surplus.totale_attivo}), costi ${t.costi} (surplus ${t.surplus.totale_passivo})`);
    }
    verifica(`${nome}: ogni mese la pagina dice il ricavo della fattura e il costo della passiva`, tutti);
    verifica(`${nome}: ogni mese il Totale imponibile dei file e' la fattura`, file);
    righe.push(`  ${nome}: ${numeri.join('; ') || 'nessun intervento'}`);
    if (copia === 'treadrider-dati-veri-2026-10-11.json.gz' && nome.startsWith('Fuel Surcharge simulato')) {
      verifica('aprile: GREEN TYRE 0,40 t, +2,00 da Ecotyre e +2,00 a GREEN TYRE; luglio: SMOCO 0,46 t, +2,30 da Ecotyre e niente pagato',
        numeri.join('; ') === 'Aprile ricavi 82.8 (surplus 2), costi 80 (surplus 2); Luglio ricavi 95.22 (surplus 2.3), costi 41.4 (surplus 0)', numeri.join('; '));
    }
    if (copia === 'treadrider-dati-veri-2026-10-11.json.gz' && nome === 'senza surplus') {
      verifica('senza surplus i numeri di oggi: aprile 80,80/78,00, luglio 92,92/41,40', numeri.join('; ') === 'Aprile ricavi 80.8 (surplus 0), costi 78 (surplus 0); Luglio ricavi 92.92 (surplus 0), costi 41.4 (surplus 0)', numeri.join('; '));
    }
  }
  for (const x of righe) console.log(x);
});

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
