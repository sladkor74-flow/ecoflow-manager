// Prova della lettura del registro di carico e scarico per le omologhe
// (leggiRegistroOmologhe, src/lib/omologhe.js), dall'audit del 20/09/2026, alta
// A15, corretta il 12/10/2026.
//
// Il criterio dell'utente e' «OMOLOGA OK»: il documento si recepisce una volta,
// al primo ritiro, e quella riga lo annota. La lettura accettava ogni cella che
// contenesse la parola «omologa», e un «OMOLOGA DA RIFARE» o un «IN ATTESA
// OMOLOGA» avrebbero fatto risultare recepita un'omologa che non lo e'.
// Sul registro vero del 09/10/2026 le annotazioni sono tutte OK: il difetto e'
// latente, e questa prova lo tiene chiuso. npm run prove
import * as XLSX from 'xlsx';
import { caricaLibPagine } from './dati/libPagine.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const { leggiRegistroOmologhe } = await caricaLibPagine('lib/omologhe');

// Un registro finto col foglio «Dettaglio», come quello di Irigom.
const righe = [
  ['REGISTRO DI CARICO E SCARICO'],
  ['DATA', 'NR. FIR', 'PRODUTTORE', 'TIPOLOGIA DI RIFIUTO', 'KG'],
  ['05/01/2026', 'RGYTR000001AA', 'GOMME ROSSI SRL', 'OMOLOGA OK', 2500],
  ['06/01/2026', 'RGYTR000002AA', 'PNEUS BIANCHI SRL', 'OMOLOGA OK(R12)', 1800],
  ['07/01/2026', 'RGYTR000003AA', 'VERDI GOMME SNC', 'OMOLOGA DA RIFARE', 2000],
  ['08/01/2026', 'RGYTR000004AA', 'NERI PNEUMATICI', 'IN ATTESA OMOLOGA', 1500],
  ['09/01/2026', 'RGYTR000005AA', 'GIALLI SRL', 'omologa  ok', 1200],
  ['10/01/2026', 'RGYTR000006AA', 'GOMME ROSSI SRL', '', 2600],
];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(righe), 'Dettaglio');
const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
const file = { name: 'registro di prova.xlsx', arrayBuffer: async () => buffer };

const { annotati, conferitori } = await leggiRegistroOmologhe(file);
const nomi = annotati.map(a => a.nome).sort();
verifica('valgono «OMOLOGA OK», anche con la nota del recupero o scritto in minuscolo',
  JSON.stringify(nomi) === JSON.stringify(['GIALLI SRL', 'GOMME ROSSI SRL', 'PNEUS BIANCHI SRL']), JSON.stringify(nomi));
verifica('«OMOLOGA DA RIFARE» e «IN ATTESA OMOLOGA» non sono omologhe recepite',
  !nomi.includes('VERDI GOMME SNC') && !nomi.includes('NERI PNEUMATICI'));
verifica('ma i loro carichi restano fra i conferitori: chi ha conferito senza omologa si vede',
  conferitori.some(c => c.nome === 'VERDI GOMME SNC') && conferitori.some(c => c.nome === 'NERI PNEUMATICI'), JSON.stringify(conferitori.map(c => c.nome)));
verifica('il produttore che ha l\'OK al primo ritiro conta i ritiri dopo senza annotazione',
  conferitori.find(c => c.nome === 'GOMME ROSSI SRL')?.carichi === 2);

// «OGGI» E' IL GIORNO ITALIANO (prova del cambio d'anno del 15/10/2026, difetto
// 30). Le omologhe e le dichiarazioni RENTRI prendevano il giorno UTC: fra
// mezzanotte e l'una italiane (le due d'estate) era ancora ieri. All'01/01/2027
// alle 00:30 l'omologa del 31/12/2026 risultava a 0 giorni, «scade oggi», fuori
// dal filtro e dal riquadro delle scadute, il badge dove si programma il ritiro
// diceva lo stesso, e il file si chiamava Dichiarazioni_RENTRI_2026-12-31.xlsx.
console.log('«OGGI» E\' IL GIORNO ITALIANO');
{
  const { caricaPagina, clienteFinto, aspetta, trova } = await import('./dati/paginaFinta.mjs');
  const { readFileSync } = await import('node:fs');
  const OraVera = Date;
  const ferma = (iso) => { const ms = OraVera.parse(iso); globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } }; };
  const riparti = () => { globalThis.Date = OraVera; };
  const alle = async (iso, f) => { ferma(iso); try { return await f(); } finally { riparti(); } };
  const NOTTE = '2026-12-31T23:30:00.000Z';      // 01/01/2027 alle 00:30 italiane
  const SERA = '2026-12-31T22:30:00.000Z';       // 31/12/2026 alle 23:30 italiane
  const MATTINA = '2027-01-01T09:00:00.000Z';    // 01/01/2027 alle 10:00 italiane

  // Le due librerie gemelle, senza «oggi»: il giorno italiano.
  const L = (await caricaPagina('lib/omologhe')).modulo;
  const S = await import('../base44/shared/omologhe.ts');
  for (const [nome, M] of [['src/lib/omologhe.js', L], ['base44/shared/omologhe.ts', S]]) {
    const notte = await alle(NOTTE, () => M.giorniAllaScadenza('2026-12-31'));
    verifica(`${nome}: l'01/01/2027 alle 00:30 l'omologa del 31/12/2026 e' scaduta da un giorno`, notte === -1 && M.fasciaScadenza(notte) === 'scaduta', String(notte));
    const sera = await alle(SERA, () => M.giorniAllaScadenza('2026-12-31'));
    verifica(`${nome}: il 31/12/2026 alle 23:30 scade oggi`, sera === 0 && M.fasciaScadenza(sera) === 'critica', String(sera));
    const mattina = await alle(MATTINA, () => M.giorniAllaScadenza('2026-12-31'));
    verifica(`${nome}: alle 10:00 dell'01/01/2027 come alle 00:30`, mattina === -1, String(mattina));
    verifica(`${nome}: un «oggi» passato da chi chiama vale com'e'`, M.giorniAllaScadenza('2026-12-31', '2026-12-30') === 1);
  }

  // Il badge delle omologhe dove si programma il ritiro.
  const I = (await caricaPagina('lib/omologheIndice')).modulo;
  const indice = { perPdr: new Map([['P1', { produttore: 'GOMME ROSSI SRL', omologa_a: '2026-12-31' }]]), perCliente: new Map() };
  const badge = await alle(NOTTE, () => I.omologaDelPunto(indice, 'P1'));
  verifica('il badge del punto di raccolta, l\'01/01/2027 alle 00:30: scaduta', badge.giorni === -1 && badge.fascia === 'scaduta', JSON.stringify({ giorni: badge.giorni, fascia: badge.fascia }));
  const badgeSera = await alle(SERA, () => I.omologaDelPunto(indice, 'P1'));
  verifica('e il 31/12/2026 alle 23:30 «scade oggi»', badgeSera.giorni === 0 && badgeSera.fascia === 'critica', JSON.stringify({ giorni: badgeSera.giorni, fascia: badgeSera.fascia }));

  // La pagina delle omologhe, montata: il riquadro delle scadute. I permessi
  // passano dall'accesso vero, che nella prova non c'e': una copia della pagina,
  // in una cartella temporanea, li ha gia' decisi (come prove/chiLeggeCosa.mjs).
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const IMPORT_PERMESSI = "import { usePermessi } from '@/lib/permessi';";
  const sorgentePagina = readFileSync(new URL('../src/pages/Omologhe.jsx', import.meta.url), 'utf8');
  verifica('la copia della pagina si fa come la prova si aspetta', sorgentePagina.includes(IMPORT_PERMESSI));
  const cartella = mkdtempSync(join(tmpdir(), 'omologhe-oggi-'));
  let P;
  try {
    const copia = join(cartella, 'Omologhe.jsx');
    writeFileSync(copia, sorgentePagina.replace(IMPORT_PERMESSI, 'const usePermessi = () => ({ user: { role: \'admin\' }, isAdmin: true, soloLettura: false });'));
    P = await caricaPagina('pages/Omologhe', { file: copia });
  } finally { rmSync(cartella, { recursive: true, force: true }); }
  const OMOLOGHE = [
    { id: 'o1', produttore: 'GOMME ROSSI SRL', canale: 'RETE', stato: 'recepita', omologa_da: '2026-01-01', omologa_a: '2026-12-31', tipo_divergenza: 'nessuna' },
    { id: 'o2', produttore: 'PNEUS BIANCHI SRL', canale: 'RETE', stato: 'recepita', omologa_da: '2026-06-01', omologa_a: '2027-05-31', tipo_divergenza: 'nessuna' },
  ];
  const scadute = async (iso) => alle(iso, async () => {
    globalThis.__CLIENTE_FINTO = clienteFinto({ archivi: { Omologa: OMOLOGHE } }).cliente;
    const r = P.monta(P.Componente, {});
    await aspetta(60);
    const q = trova(r.albero, el => el && el.props && el.props.titolo === 'Scadute')[0];
    return q ? String(q.props.valore) : null;
  });
  verifica('la pagina delle omologhe, l\'01/01/2027 alle 00:30: una scaduta nel riquadro', await scadute(NOTTE) === '1');
  verifica('il 31/12/2026 alle 23:30 nessuna', await scadute(SERA) === '0');

  // Le dichiarazioni RENTRI: il default del controllo e il nome del file.
  const R = (await caricaPagina('lib/dichiarazioniRentri')).modulo;
  // Alle 00:30 italiane del 16/09/2026 il FIR digitale e' gia' obbligatorio.
  const d = { fir_cartaceo: true, fir_digitale: false, nota: 'iscrizione obbligatoria, 10 o piu dipendenti' };
  const obbligato = async (iso) => alle(iso, () => R.controlliDichiarazione(d, []).some(c => c.tipo === 'obbligato_cartaceo'));
  verifica('il controllo del FIR digitale, il 16/09/2026 alle 00:30 italiane: gia\' obbligatorio', await obbligato('2026-09-15T22:30:00.000Z') === true);
  verifica('e il 15/09/2026 alle 23:30 italiane non ancora', await obbligato('2026-09-15T21:30:00.000Z') === false);
  const pagina = readFileSync(new URL('../src/pages/DichiarazioniRentri.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  const omologhe = readFileSync(new URL('../src/pages/Omologhe.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('le due pagine non prendono piu\' il giorno UTC', !/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/.test(pagina) && !/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/.test(omologhe));
  verifica('il file delle dichiarazioni RENTRI si chiama col giorno italiano', /Dichiarazioni_RENTRI_\$\{oggiRoma\(\)\}\.xlsx/.test(pagina));
  const { oggiRoma } = await import('../base44/shared/giornoItaliano.ts');
  verifica('che l\'01/01/2027 alle 00:30 e\' il 2027-01-01', await alle(NOTTE, () => `Dichiarazioni_RENTRI_${oggiRoma()}.xlsx`) === 'Dichiarazioni_RENTRI_2027-01-01.xlsx');
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
