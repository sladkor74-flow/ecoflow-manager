// GLI ORDINI DI UN ANNO PASSATO DICONO DI QUALI CARICHI SONO, OVUNQUE SI
// SCRIVONO (chiusura del giro del 14/10/2026).
//
// Il gruppo delle Giacenze ha cambiato il numero: su un anno PASSATO gli
// «Ordini da dichiarare» sono i carichi di quell'anno ancora da dichiarare oggi,
// perche' il file degli ordini non dichiarati del portale e' di oggi
// (calcolaGiacenze, totali.ordini_dei_carichi_del; prove/ordiniAnniPassati.mjs).
// La colonna della Situazione e l'elenco lo dicevano; la casella in testa, il PDF
// e il foglio Excel della Situazione, il foglio dell'elenco ed EcoTyna
// scrivevano «Ordini da dichiarare» e basta, accanto a un numero che non e' piu'
// tutto il file. Ora lo dicono tutti con le stesse parole.
//
// La trappola: l'anno si legge da ordini_dei_carichi_del, mai dall'anno
// dell'attesa (in_attesa_dei_carichi_del). Sull'anno dopo l'attesa e' dei
// carichi di quell'anno, ma gli ordini degli impianti sono tutto il file di
// oggi: «dei carichi del 2027» sopra tutto il file sarebbe falso. Ogni sezione
// prova i tre anni: passato, in corso (com'era) e dopo (com'era).
//
// node prove/ordiniAnniPassatiEtichette.mjs
import { caricaLibPagine } from './dati/libPagine.mjs';
import { caricaPagina, testo } from './dati/paginaFinta.mjs';
import { STRUMENTI } from '../base44/shared/strumentiAssistente.ts';
import { testoDati } from '../base44/shared/pianoAssistente.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const sezione = async (titolo, corpo) => {
  console.log(titolo);
  try { await corpo(); } catch (e) { ko++; console.log(`  FALLITA: ${titolo}: si ferma con un errore (${e && e.message})`); }
};

const ETICHETTA_25 = 'dei carichi del 2025 ancora da dichiarare oggi';
// I totali come li scrive calcolaGiacenze: sul passato c'e' ordini_dei_carichi_del,
// sull'anno dopo solo l'anno dell'attesa, sull'anno in corso nessuno dei due.
const base = { giacenza_portale_t: 10, giacenza_aci_t: 0, giacenza_extra_t: 0, in_attesa_dichiarazione_t: 4, dichiarato_t: 1, conferito_primarie_t: 5, conferito_aci_t: 0, conferito_extra_t: 0, target_totale_t: 0, ordini_da_dichiarare: 2 };
const TOTALI = {
  passato: { ...base, in_attesa_dei_carichi_del: 2025, ordini_dei_carichi_del: 2025 },
  inCorso: { ...base, in_attesa_dei_carichi_del: null },
  dopo: { ...base, in_attesa_dei_carichi_del: 2027, ordini_da_dichiarare: 866 },
};
const riga = { sito: 'NAPPI SUD SRL', tipo_destinazione: 'stoc', giacenza_portale_t: 10, giacenza_rete_t: 10, giacenza_classi_kg: { P: 1, M: 2, G1: 3, G2: 4, ACI: 0 }, in_attesa_dichiarazione_t: 4, ordini_da_dichiarare: 2, dichiarato_t: 1, data_rilevazione: '2026-01-01', aggiornata_al: '2026-10-11' };
const daAnno = { passato: 2025, inCorso: 2026, dopo: 2027 };

await sezione('1. La casella «Ordini da dichiarare» in testa alle Giacenze', async () => {
  const p = await caricaPagina('components/giacenze/GiacenzeKpi');
  const casella = (totali) => {
    const r = p.monta(p.Componente, { totali });
    const t = testo(r.albero);
    r.smonta();
    return (t.match(/Ordini da dichiarare.*?(?=Dichiarato nell'anno)/) || [''])[0];
  };
  const c25 = casella(TOTALI.passato), c26 = casella(TOTALI.inCorso), c27 = casella(TOTALI.dopo);
  verifica('il 2025: «Ordini da dichiarare 2 dei carichi del 2025 ancora da dichiarare oggi»', c25 === `Ordini da dichiarare2 ${ETICHETTA_25}` || c25 === `Ordini da dichiarare2${ETICHETTA_25}`, J(c25));
  verifica("l'anno in corso com'era", c26 === 'Ordini da dichiarare2 ' || c26 === 'Ordini da dichiarare2', J(c26));
  verifica("l'anno dopo com'era: niente «dei carichi del 2027» accanto a tutto il file", !/carichi del/.test(c27) && /866/.test(c27), J(c27));
});

await sezione('2. Il PDF della Situazione', async () => {
  const pdf = await caricaLibPagine('lib/giacenzePdf');
  const colonna = (chiave) => (pdf.situazionePdf(daAnno[chiave], [riga], TOTALI[chiave]).sezioni[0].colonne.find(c => /^Ordini da dich/.test(c.titolo)) || {}).titolo;
  verifica('il 2025: la colonna lo dice', colonna('passato') === `Ordini da dich., ${ETICHETTA_25}`, J(colonna('passato')));
  verifica("l'anno in corso com'era", colonna('inCorso') === 'Ordini da dich.', J(colonna('inCorso')));
  verifica("l'anno dopo com'era", colonna('dopo') === 'Ordini da dich.', J(colonna('dopo')));
});

await sezione('3. Il foglio Excel delle Giacenze: la Situazione e l\'elenco «Da dichiarare»', async () => {
  const FOGLI = {};
  globalThis.__FOGLI_ETICHETTE = FOGLI;
  const xl = await caricaLibPagine('lib/giacenzeExportAll', [
    ["import { documentoDa, nuovaCartella, foglioDaRighe, scaricaCartella, FORMATI } from '@/lib/fogliProfessionali';",
      'const documentoDa = async () => ({}); const nuovaCartella = async () => ({ wb: {} }); const foglioDaRighe = (_wb, nome, o) => { globalThis.__FOGLI_ETICHETTE[nome] = o; }; const scaricaCartella = (_wb, nome) => nome; const FORMATI = {};'],
    ["import { testoFormulario, testoCollocato } from '@/lib/giacenzeDaDichiarareExport';", "const testoFormulario = () => ''; const testoCollocato = () => '';"],
    ["import { INTESTAZIONE_DATE, righeExcelDate } from '@/components/giacenze/DateDaSistemare';", "const INTESTAZIONE_DATE = ['Data']; const righeExcelDate = () => [];"],
  ]);
  const elenco = { righe: [{ ordine_primaria: 'A1', fine_trasporto: '2025-12-30', peso_non_dichiarato_kg: 1000 }], totale_kg: 1000 };
  const fogli = async (chiave) => {
    await xl.exportGiacenzeAllExcel({ righe: [riga], totali: TOTALI[chiave] }, elenco, daAnno[chiave]);
    return { sit: FOGLI.Situazione.righe, dd: FOGLI['Da dichiarare'] };
  };
  const f25 = await fogli('passato');
  const iA = f25.sit[0].findIndex(h => /^In attesa/.test(h));
  verifica('il 2025: l\'intestazione degli ordini lo dice, subito dopo l\'attesa, e la riga ha i suoi 2', f25.sit[0][iA + 1] === `Ordini da dichiarare, ${ETICHETTA_25}` && f25.sit[1][iA + 1] === 2, J(f25.sit[0]));
  const nota = f25.dd.righe.at(-1);
  verifica('il 2025: sotto l\'elenco «Da dichiarare» una nota dice di quali carichi e\' (stile nota, dopo una riga vuota)',
    /^Carichi del 2025 ancora da dichiarare oggi: il file degli ordini non dichiarati del portale è di oggi/.test(String(nota && nota[0])) && f25.dd.righe.at(-2).length === 0 && f25.dd.stili[f25.dd.righe.length - 1] === 'nota', J([f25.dd.righe.slice(-3), f25.dd.stili]));
  for (const chiave of ['inCorso', 'dopo']) {
    const f = await fogli(chiave);
    verifica(`il ${daAnno[chiave]}: l'intestazione di sempre e nessuna nota sotto l'elenco`, f.sit[0][iA + 1] === 'Ordini da dichiarare' && f.dd.righe.length === 3 && f.dd.righe.at(-1)[0] === 'TOTALE' && !f.dd.stili, J([f.sit[0][iA + 1], f.dd.righe.length]));
  }
});

await sezione('4. Il foglio dell\'elenco «Da dichiarare» (il pulsante Excel della scheda)', async () => {
  const scritti = [];
  globalThis.__XLSX_ETICHETTE = {
    utils: {
      book_new: () => ({ fogli: [] }),
      aoa_to_sheet: (aoa) => ({ aoa }),
      book_append_sheet: (wb, ws, nome) => { wb.fogli.push({ nome, aoa: ws.aoa }); },
    },
    writeFile: (wb, nome) => { scritti.push({ nome, aoa: wb.fogli[0].aoa }); },
  };
  const lib = await caricaLibPagine('lib/giacenzeDaDichiarareExport', [["const XLSX = await import('xlsx');", 'const XLSX = globalThis.__XLSX_ETICHETTE;']]);
  const righe = [{ ordine_primaria: 'A1', fine_trasporto: '2025-12-30', peso_non_dichiarato_kg: 1000 }];
  await lib.exportDaDichiarareExcel(righe, 1, 1000, { carichi_del: 2025 });
  await lib.exportDaDichiarareExcel(righe, 1, 1000, { carichi_del: null });
  await lib.exportDaDichiarareExcel(righe, 1, 1000);
  const [p, oggiNull, oggi] = scritti;
  verifica('il 2025: in testa la riga che lo dice, poi una vuota, poi le intestazioni', /^Carichi del 2025 ancora da dichiarare oggi: /.test(String(p && p.aoa[0][0])) && p.aoa[1].length === 0 && p.aoa[2][0] === 'Ordine', J(p && p.aoa.slice(0, 3)));
  verifica('il 2025: il nome del file lo dice', /^ordini_da_dichiarare_carichi_del_2025_\d{4}-\d{2}-\d{2}\.xlsx$/.test(String(p && p.nome)), p && p.nome);
  verifica("l'anno in corso (null, o senza opzioni) com'era: le intestazioni in prima riga e il nome di sempre",
    [oggiNull, oggi].every(x => x && x.aoa[0][0] === 'Ordine' && /^ordini_da_dichiarare_\d{4}-\d{2}-\d{2}\.xlsx$/.test(x.nome)), J([oggiNull && oggiNull.nome, oggi && oggi.nome]));
});

await sezione('5. EcoTyna: lo strumento delle giacenze', async () => {
  const strumento = STRUMENTI.find(s => s.nome === 'giacenze');
  const dati = async (chiave) => {
    const sdk = { functions: { invoke: async (nome) => (nome === 'calcolaGiacenze' ? { data: { righe: [{ ...riga }], totali: { ...TOTALI[chiave] } } } : { data: {} }) }, asServiceRole: { entities: {} }, entities: {} };
    return (await strumento.esegui(sdk, { anno: daAnno[chiave] })).dati;
  };
  const d25 = await dati('passato');
  verifica('il 2025: i totali della rete dicono di quali carichi sono gli ordini', d25.totali.rete.ordini_da_dichiarare === 2 && d25.totali.rete.ordini_dei_carichi_del === 2025 && /arrivati nel 2025 che oggi sono ancora da dichiarare/.test(d25.totali.rete.ordini_quali || ''), J(d25.totali.rete));
  for (const chiave of ['inCorso', 'dopo']) {
    const d = await dati(chiave);
    verifica(`il ${daAnno[chiave]}: com'era, senza l'anno dei carichi`, !('ordini_dei_carichi_del' in d.totali.rete) && !('ordini_quali' in d.totali.rete), J(d.totali.rete));
  }
  // Un campo nei totali, non per riga: il blocco cresce di poco (punto 24 di AGENTS.md).
  const conCampo = testoDati([{ strumento: 'giacenze', parametri: { anno: 2025 }, fonte: 'Giacenze', periodo: 'anno 2025', dati_al: '2026-10-14', dati: d25 }]);
  verifica('il blocco per EcoTyna cresce di una frase sola (meno di 200 caratteri)', conCampo.length - testoDati([{ strumento: 'giacenze', parametri: { anno: 2025 }, fonte: 'Giacenze', periodo: 'anno 2025', dati_al: '2026-10-14', dati: { ...d25, totali: { ...d25.totali, rete: Object.fromEntries(Object.entries(d25.totali.rete).filter(([k]) => !/^ordini_(dei|quali)/.test(k))) } } }]).length < 200, String(conCampo.length));
});

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
