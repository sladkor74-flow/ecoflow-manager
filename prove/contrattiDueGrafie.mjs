// Prova del TARGET ABBREVIATO SCRITTO IN DUE GRAFIE (revisione finale della chiusura
// dell'audit, 11/10/2026). contrattiAnno abbina il target
// abbreviato al soggetto confrontando la GRAFIA del nome (targetDelPortale(...) ===
// nome), non il nome normalizzato. Se lo stesso target abbreviato e' scritto in due
// grafie in due regioni («PNEUSERVICE SRL» in Puglia, «Pneuservice S.r.l.» in
// Basilicata), targetDelPortale restituisce solo la prima grafia: la seconda resta
// senza soggetto e il contratto di raccolta porta 600 t invece di 700, mentre il
// commento dice «si sommano fra le regioni» e con la stessa grafia fa 700.
// L'Andamento (righeAndamento) abbina tutte e due le regioni.
// Corretto in contrattiAnno: si confronta il nome normalizzato. npm run prove
import { fileURLToPath, pathToFileURL } from 'node:url';

const R = (p) => pathToFileURL(fileURLToPath(new URL('../' + p, import.meta.url))).href;
const { caricaFunzione, chiama } = await import(R('prove/dati/bancoFunzioni.mjs'));
const { righeAndamento } = await import(R('base44/shared/andamentoTarget.ts'));

const modulo = await caricaFunzione('contrattiAnno');
let n = 0;
const prim = (trasportatore, provincia) => ({ id: 'p' + (++n), id_ordine: 'P' + n, stato: 'terminato', classe: 'P', provincia, trasportatore, destinazione: 'IRIGOM SRL', tipo_destinazione: 'imp', peso_effettivo: 10000, ordine_immesso_il: '2026-03-10T08:00:00Z', trasporto_iniziato_il: '2026-03-10T08:00:00Z', trasporto_finito_il: '2026-03-10T10:00:00Z' });
const target = (raccoglitore, regione, t) => ({ id: 't' + (++n), raccoglitore, regione, target_tonnellate: t, anno: 2026 });
const db = (targets) => ({ PrimariaRete: [prim('PNEUSERVICE CONVERSANO SRL', 'BA'), prim('PNEUSERVICE CONVERSANO SRL', 'MT')], PrimariaAci: [], ExtraRaccolta: [], Secondaria: [], Fornitore: [], QualificaInclusione: [], ContrattoFornitore: [], ModelloContratto: [], ImpiantoTargetSecondaria: [], TargetRaccoglitore: targets });
const targetRaccolta = async (targets) => {
  const { j } = await chiama(modulo, { db: db(targets), corpo: { anno: 2026 } });
  const s = (j.soggetti || []).find(x => x.chiave === 'pneuservice conversano');
  const c = s && (s.contratti || []).find(x => x.tipo === 'raccolta');
  return c ? c.target_t : undefined;
};

const stessaGrafia = await targetRaccolta([target('PNEUSERVICE SRL', 'Puglia', 600), target('PNEUSERVICE SRL', 'Basilicata', 100)]);
const dueGrafie = await targetRaccolta([target('PNEUSERVICE SRL', 'Puglia', 600), target('Pneuservice S.r.l.', 'Basilicata', 100)]);
console.log(`contratto di raccolta di PNEUSERVICE CONVERSANO: stessa grafia ${stessaGrafia} t, due grafie ${dueGrafie} t`);

// l'Andamento con gli stessi target: il raccolto di ogni regione va al target della sua regione
const righe = righeAndamento({ annui: [{ raccoglitore: 'PNEUSERVICE SRL', regione: 'Puglia', target_tonnellate: 600 }, { raccoglitore: 'Pneuservice S.r.l.', regione: 'Basilicata', target_tonnellate: 100 }],
  raccolto: [{ raccoglitore: 'PNEUSERVICE CONVERSANO SRL', regione: 'Puglia', totale: 10, mesi: { Marzo: 10 } }, { raccoglitore: 'PNEUSERVICE CONVERSANO SRL', regione: 'Basilicata', totale: 10, mesi: { Marzo: 10 } }] });
const abbinate = righe.filter(r => r.nomi.includes('PNEUSERVICE CONVERSANO SRL'));
console.log(`Andamento: righe col raccolto di PNEUSERVICE CONVERSANO ${abbinate.map(r => `${r.regione} target ${r.targetAnnuo}`).join(', ')} (totale target ${abbinate.reduce((s, r) => s + r.targetAnnuo, 0)} t)`);

const difetto = stessaGrafia === 700 && dueGrafie !== 700;
console.log(difetto ? `DIFETTO: con due grafie dello stesso target abbreviato il contratto porta ${dueGrafie} t invece di 700` : 'ok: le due grafie si sommano');
process.exit(difetto ? 1 : 0);
