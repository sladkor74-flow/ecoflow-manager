// Prova del TRASPORTO DELL'EXTRA RACCOLTA NEL FOGLIO DELL'AMMINISTRAZIONE
// (revisione finale della chiusura dell'audit, 11/10/2026).
//
// Il blocco degli interventi di extra raccolta ha gia' dentro il trasporto a
// viaggio di ciascuno (colonna TRASPORTO), e la passiva mette lo stesso viaggio
// fra i trasporti. Il totale del canale nel foglio li sommava: il PDF scriveva in
// testa 786,74 su una tabella che chiude a 636,74, e l'Excel salvava 786,74 nella
// cella in cima. Ora il totale del canale e' quello del blocco, uguale alla
// passiva. npm run prove
import { fileURLToPath, pathToFileURL } from 'node:url';

const R = (p) => pathToFileURL(fileURLToPath(new URL('../' + p, import.meta.url))).href;
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const { calcolaPassivaMese } = await import(R('base44/shared/passivaCalcolo.ts'));
const { caricaLibPagine } = await import(R('prove/dati/libPagine.mjs'));
const { foglioPassiva } = await caricaLibPagine('lib/passivaAmministrazione');
const { modelloAmministrazione } = await caricaLibPagine('lib/modelloPassivaAmministrazione');
const { bloccoExtraRaccolta } = await caricaLibPagine('lib/extraRaccoltaAmministrazione');
const { cartellaPassivaUnFoglio } = await caricaLibPagine('lib/passivaAmministrazioneExcel');
const ExcelJS = (await import(R('node_modules/exceljs/dist/es5/index.js'))).default;

const archivi = (x) => ({ primarieRete: [], primarieAci: [], secondarieAll: [], extraRaccoltaAll: [], tariffeAll: [], fornitoriAll: [], ...x });
const intervento = (id, kg, viaggio) => ({ id, stato: 'terminato', id_ordine: id, numero_fir: 'F' + id, tipo_movimento: 'primaria',
  trasporto_finito_il: '2026-09-10T08:00:00.000Z', trasporto_iniziato_il: '2026-09-10T08:00:00.000Z', ordine_immesso_il: '2026-09-01T00:00:00.000Z',
  trasportatore: 'EMMESSE SRLS', provincia: 'CS', destinazione: 'GATIM S.R.L.', tipo_destinazione: 'imp', classe: 'P',
  peso_effettivo: kg, costo_raccolta_t: 90, costo_trattamento_t: 95, costo_trasporto_viaggio: viaggio });
const fornitori = [{ ragione_sociale: 'EMMESSE SRLS' }, { ragione_sociale: 'GATIM S.R.L.' }];

const conti = async (righe) => {
  const p = calcolaPassivaMese(archivi({ extraRaccoltaAll: righe, fornitoriAll: fornitori }), 2026, 8, 'Settembre', 'EXTRA_RACCOLTA');
  const extra = bloccoExtraRaccolta(righe, 2026, 'Settembre');
  const f = foglioPassiva(modelloAmministrazione(2026), p, 'EXTRA_RACCOLTA', 'Settembre', 2026, [], extra);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await cartellaPassivaUnFoglio([f]));
  let testa = null;
  wb.worksheets[0].eachRow((row) => row.eachCell((c) => { if (!testa && c.value && typeof c.value === 'object' && c.value.formula && c.col === 5) testa = c.value; }));
  return { passiva: p.totali.totale_complessivo, blocco: extra.totale_euro, foglio: f.totale_euro, excel: testa && testa.result };
};

console.log("UN INTERVENTO CON IL TRASPORTO A VIAGGIO");
{
  const x = await conti([intervento('X1', 2631, 150)]);
  verifica('passiva 636,74 (raccolta + trattamento + viaggio)', x.passiva === 636.74, JSON.stringify(x));
  verifica('il totale del canale nel foglio e\' quello del blocco, non piu\' 786,74', x.foglio === x.blocco && x.foglio === x.passiva, JSON.stringify(x));
  verifica('e cosi\' il risultato salvato nella cella in cima all\'Excel', x.excel === x.passiva, JSON.stringify(x));
}
console.log('DUE INTERVENTI, UNO SENZA TRASPORTO');
{
  const x = await conti([intervento('X2', 2631, 150), intervento('X3', 1000, 0)]);
  verifica('passiva, blocco, foglio ed Excel dicono lo stesso numero', x.passiva === x.blocco && x.blocco === x.foglio && x.foglio === x.excel, JSON.stringify(x));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
