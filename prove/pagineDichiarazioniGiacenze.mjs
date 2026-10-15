// LE PAGINE DI DICHIARAZIONI E GIACENZE DICONO QUELLO CHE I CONTI FANNO
// (revisione della chiusura dell'audit, 11/10/2026).
//
// I ritocchi rimasti dopo il primo giro, uno per sezione:
// - le terziarie con le date da sistemare hanno la loro voce nel riquadro della
//   pagina Dichiarazioni: il riepilogo le mette nel gruppo TERZIARIE, e il
//   riquadro scorreva solo i tre canali, quindi sparivano (C11);
// - il riquadro dei doppioni non dice piu' «decurtate due volte», che dopo C4
//   non e' vero: i due moduli contano la prima gemella. Il testo nuovo dice
//   anche che cosa resta vero, e qui si controlla sui conti;
// - il foglio Excel degli stoccaggi scrive perche' manca la giacenza di un
//   piazzale senza letture, invece di una cella vuota;
// - il PDF dell'elenco «Da dichiarare», senza un anno scelto, prende l'anno di
//   oggi in Italia e non quello dell'orologio del dispositivo;
// - il nome del gruppo delle terziarie e' uno solo (shared/giacenzaPortale.ts);
// - l'apertura scritta di un piazzale conta solo se il piazzale non ha letture,
//   e la scheda dei siti lo dice.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { caricaLibPagine } from './dati/libPagine.mjs';
import { caricaPagina, clienteFinto, trova, aspetta } from './dati/paginaFinta.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const sorgente = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// --- Le funzioni vere, con un SDK finto: uguaglianza, $gte, $lte e $in ---
const ARCHIVI = {};
globalThis.__ARCHIVI_PAGINE_DG = ARCHIVI;
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('$in' in v) return v.$in.includes(r[k]);
    if ('$gte' in v && !(r[k] != null && String(r[k]) >= String(v.$gte))) return false;
    if ('$lte' in v && !(r[k] != null && String(r[k]) <= String(v.$lte))) return false;
    return true;
  }
  if (v === null) return r[k] === null || r[k] === undefined || r[k] === '';
  return r[k] === v;
});
const ordina = (righe) => [...righe].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const entita = (nome) => ({
  list: async (_o, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI_PAGINE_DG[nome] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI_PAGINE_DG[nome] || []).filter(r => soddisfa(r, f))).slice(skip, skip + lim),
  create: async (r) => r, update: async (_id, r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;
const funzione = async (nome) => {
  const pacchetto = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    } }],
  });
  const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  return async (corpo) => (await modulo.default({ json: async () => corpo })).json();
};
const OraVera = Date;
const conOra = async (iso, f) => {
  const ms = OraVera.parse(iso);
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try { return await f(); } finally { globalThis.Date = OraVera; }
};
let seq = 0;
const VUOTI = ['DichiarazioneTrattamento', 'Terziaria', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile',
  'GiacenzaStoccaggio', 'IndicatoreGiorno', 'PrimariaAci', 'ExtraRaccolta', 'Secondaria', 'OrdineNonDichiarato',
  'DichiarazioneSito', 'GiacenzaSito', 'PrimariaRete', 'CommessaEcotyre', 'RegistroCaricamento', 'StatoArchivio'];
const azzera = () => { for (const k of Object.keys(ARCHIVI)) delete ARCHIVI[k]; for (const v of VUOTI) ARCHIVI[v] = []; };
const con = (nome, righe) => { ARCHIVI[nome] = righe.map(r => ({ id: 'r' + String(++seq).padStart(5, '0'), ...r })); };
const g = (giorno) => `${giorno}T08:00:00Z`;
const primaria = (id, dest, kg, giorno, extra = {}) => ({
  id_ordine: id, numero_fir: 'FIR' + id, classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: dest,
  tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: kg, trasportatore: 'RACCOLTA SRL', provincia: 'NA',
  ordine_immesso_il: g(giorno), trasporto_iniziato_il: g(giorno), trasporto_finito_il: g(giorno), ordine_chiuso_il: g(giorno), ...extra,
});
const OGGI = '2026-10-11T10:00:00Z';
const ALFA = 'ALFA RECYCLING SRL';
const riepilogo = await funzione('riepilogoDichiarazioni');
const giacenze = await funzione('calcolaGiacenze');

const pagina = sorgente('src/pages/DichiarazioniImpianti.jsx');

console.log('LE TERZIARIE CON LE DATE DA SISTEMARE HANNO LA LORO VOCE NEL RIQUADRO');
{
  azzera();
  con('GiacenzaSito', [{ sito: ALFA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true }]);
  con('PrimariaRete', [primaria('ET26000001', ALFA, 12000, '2026-03-10')]);
  con('Terziaria', [{ id_ordine: 'TER1', numero_fir: 'FT1', unita_locale_origine: ALFA, ragione_sociale: ALFA, destinazione: 'CEMENTERIA SPA', stato: 'terminato', peso_effettivo: 25000, ordine_immesso_il: g('2026-06-01'), trasporto_iniziato_il: g('2026-06-02'), trasporto_finito_il: null }]);
  const D = await conOra(OGGI, () => riepilogo({ anno: 2026 }));
  const conti = D.totali.date_da_sistemare;
  verifica('il riepilogo mette la terziaria nel suo gruppo, non nella rete',
    conti.TERZIARIE && conti.TERZIARIE.n === 1 && (!conti.RETE || conti.RETE.n === 0), JSON.stringify(conti));
  // Le righe del riquadro si prendono dalla pagina e si fanno girare cosi' come
  // sono: e' la logica di DateInBreve, non una sua copia.
  const elenco = pagina.match(/^const VOCI_DATE = .*;$/m);
  const voci = pagina.match(/^ {2}const voci = VOCI_DATE\.map\(.*;$/m);
  verifica('la pagina ha la lista delle voci, con le terziarie a parte', !!elenco && !!voci && elenco[0].includes("{ chiave: 'TERZIARIE', nome: 'Terziarie, a parte' }"));
  if (elenco && voci) {
    const { CANALI } = await caricaLibPagine('lib/dichiarazioniImpianti');
    const vociDi = new Function('CANALI', 'conti', `${elenco[0]}\n${voci[0]}\nreturn voci;`);
    const v = vociDi(CANALI, conti);
    verifica("il riquadro c'e', con la voce «Terziarie, a parte» e il suo formulario", v.length === 1 && v[0].nome === 'Terziarie, a parte' && v[0].n === 1, JSON.stringify(v));
    verifica('e la partenza senza fine trasporto si dice col suo peso', v[0].partenze_senza_fine === 1 && v[0].partenze_senza_fine_kg === 25000, JSON.stringify(v[0]));
  }
}

console.log('IL RIQUADRO DEI DOPPIONI DICE QUELLO CHE SUCCEDE AI CONTI');
{
  verifica("non dice piu' «decurtate due volte», che dopo C4 non e' vero", !pagina.includes('sono decurtate due volte'));
  verifica('dice che i due moduli contano la prima, e che cosa succede se e\' la sbagliata',
    pagina.includes('Finché ci sono, Giacenze e Dichiarazioni contano\n            la prima e ignorano l&apos;altra')
    && pagina.includes('dichiarato e giacenza\n            sono sbagliati in tutti e due'));
  verifica("e che la giacenza a portale toglie tutte e due le gemelle caricate dopo l'ultimo file",
    pagina.includes('la giacenza a portale le toglie tutte e due.'));
  // Il testo si controlla sui conti: due gemelle di settembre da 5 t, caricate
  // tutte e due dopo la fotografia. La calcolata ne toglie una (12 - 5 = 7) in
  // tutti e due i moduli; la giacenza a portale tutte e due (12 - 10 = 2).
  azzera();
  con('GiacenzaSito', [{ sito: ALFA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true }]);
  con('PrimariaRete', [primaria('ET26000001', ALFA, 12000, '2026-09-10')]);
  con('OrdineNonDichiarato', [{ ordine_primaria: 'ET26000001', destinazione: ALFA, prodotto: '.class1', peso_non_dichiarato_kg: 12000, created_date: '2026-10-01T06:00:00Z', fine_trasporto: '2026-09-10' }]);
  const gemella = (caricata_il) => ({ sito: ALFA, anno: 2026, mese: 'Settembre', canale: 'RETE', provenienza: '', operazione: 'R3', quantita_kg: 5000, caricata_inviata: true, caricata_il });
  con('DichiarazioneSito', [gemella('2026-10-03'), gemella('2026-10-04')]);
  const D = await conOra(OGGI, () => riepilogo({ anno: 2026 }));
  const G = await conOra(OGGI, () => giacenze({ anno: 2026 }));
  const s = (D.siti || []).find(x => x.sito === ALFA) || {};
  const r = (G.righe || []).find(x => x.sito === ALFA && x.tipo_destinazione === 'imp') || {};
  verifica('il doppione si vede', (D.doppioni || []).length === 1, JSON.stringify(D.doppioni));
  verifica('la calcolata conta la prima: 7 t', s.giacenza_calcolata_t === 7, String(s.giacenza_calcolata_t));
  verifica("la giacenza a portale le toglie tutte e due: 2 t, in tutti e due i moduli", s.giacenza_portale_t === 2 && r.giacenza_portale_t === 2, `${s.giacenza_portale_t} / ${r.giacenza_portale_t}`);
}

console.log("IL FOGLIO DEGLI STOCCAGGI DICE PERCHE' MANCA LA GIACENZA DI UN PIAZZALE");
{
  // Il foglio lo scrive exceljs e si scarica col link del browser (11/10/2026):
  // il download si intercetta e il file vero si rilegge.
  const { resolveObjectURL } = await import('node:buffer');
  let scaricato = null;
  globalThis.document = { body: { appendChild() {} }, createElement: () => ({ click() { scaricato = resolveObjectURL(this.href); }, remove() {} }) };
  const modulo = await caricaLibPagine('lib/dichiarazioniExport', [
    ["import { INTESTAZIONE_DATE, righeExcelDate } from '@/components/giacenze/DateDaSistemare';", "const INTESTAZIONE_DATE = ['Data']; const righeExcelDate = () => [];"],
  ]);
  const PERCHE = 'Questo piazzale non ha nessuna rilevazione del portale.';
  await modulo.esportaDichiarazioni({ anno: 2026, siti: [], stoccaggi: [
    { sito: 'GAMMA SRL', anche_impianto: false, canali: [{ canale: 'RETE', entrato_t: 3, uscito_t: 0, saldo_t: 3, verso: [], in_piazzale_t: null, in_piazzale_perche: PERCHE }] },
    { sito: 'NAPPI SUD SRL', anche_impianto: false, canali: [{ canale: 'RETE', entrato_t: 5, uscito_t: 1, saldo_t: 4, verso: [], in_piazzale_t: 44 }] },
  ] }, { stato: { letto: true, archivi: [] } });
  delete globalThis.document;
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  if (scaricato) await wb.xlsx.load(Buffer.from(await scaricato.arrayBuffer()));
  const ws = wb.getWorksheet('Stoccaggi');
  // Le righe come prima (null dove la cella e' vuota), dall'intestazione della
  // tabella in giu': sopra c'e' il blocco di testa del documento.
  const tutte = [];
  for (let n = 1; ws && n <= ws.rowCount; n++) tutte.push(Array.from({ length: ws.columnCount }, (_, c) => { const v = ws.getRow(n).getCell(c + 1).value; return v === undefined || v === '' ? null : v; }));
  const righe = tutte.slice(Math.max(0, tutte.findIndex(r => r[0] === 'Stoccaggio')));
  const colonna = righe.length ? righe[0].indexOf('Perché manca la giacenza in piazzale') : -1;
  verifica("il foglio ha la colonna del perche'", colonna > 0, JSON.stringify(righe[0]));
  const gamma = righe.find(x => x[0] === 'GAMMA SRL') || [];
  const nappi = righe.find(x => x[0] === 'NAPPI SUD SRL') || [];
  verifica("il piazzale senza letture: cella vuota, e accanto il perche'", gamma[colonna - 1] === null && gamma[colonna] === PERCHE, JSON.stringify(gamma));
  verifica('il piazzale con la giacenza: il numero, e nessun perche\'', nappi[colonna - 1] === 44 && !nappi[colonna], JSON.stringify(nappi));
}

console.log("IL PDF DELL'ELENCO «DA DICHIARARE» PRENDE L'ANNO DI OGGI IN ITALIA");
{
  const t = sorgente('src/components/giacenze/DaDichiarareTable.jsx');
  // Dal 14/10/2026 fra i due c'e' l'anno dei carichi che la pagina delle Giacenze
  // passa su un anno che non e' quello in corso (prove/ordiniAnniPassati.mjs):
  // l'ultimo ripiego resta annoDiOggi.
  verifica("senza un anno scelto vale annoDiOggi, non l'orologio del dispositivo",
    t.includes('daDichiararePdf(annoChiusura || carichiDellAnno || annoDiOggi(), res.data, {') && !t.includes('new Date().getFullYear()') && t.includes("import { annoDiOggi } from '@/lib/periodoPagine';"));
}

console.log('IL NOME DEL GRUPPO DELLE TERZIARIE E\' UNO SOLO');
{
  const c = sorgente('base44/shared/chiusuraAnno.ts');
  verifica('la chiusura non ne ha una sua copia: lo prende da shared/giacenzaPortale.ts',
    // Dal 15/10/2026 la chiusura prende dallo stesso modulo anche le regole delle
    // proposte: l'import di giacenzaPortale.ts ha piu' nomi, GRUPPO_TERZIARIE fra loro.
    !/export const GRUPPO_TERZIARIE\s*=/.test(c) && /import \{[^}]*\bGRUPPO_TERZIARIE\b[^}]*\} from "\.\/giacenzaPortale\.ts";/.test(c));
  const chiusura = await import('../base44/shared/chiusuraAnno.ts');
  const portale = await import('../base44/shared/giacenzaPortale.ts');
  verifica('e chi lo prende dalla chiusura trova lo stesso valore', chiusura.GRUPPO_TERZIARIE === portale.GRUPPO_TERZIARIE && chiusura.GRUPPO_TERZIARIE === 'TERZIARIE');
}

console.log("L'APERTURA SCRITTA DI UN PIAZZALE CONTA SOLO SENZA LETTURE, E LA SCHEDA LO DICE");
{
  const t = sorgente('src/components/giacenze/TargetManager.jsx');
  verifica("l'etichetta del campo, per un piazzale, dice che vale solo senza rilevazioni",
    t.includes("form.tipo_destinazione === 'stoc' ? 'Apertura di rete (t), solo senza rilevazioni' : 'Giacenza di riferimento (t)'") && t.includes('{NOTA_APERTURA_PIAZZALE}'));
  verifica("nell'elenco un piazzale con letture mostra l'apertura dall'ancora, quella delle Giacenze",
    t.includes("s.tipo_destinazione === 'stoc' && tgt(s)?.data_rilevazione ?") && t.includes('{fmt(tgt(s).giacenza_riferimento_t)}'));
}

// LA NUOVA RILEVAZIONE PROPONE IL GIORNO ITALIANO (15/10/2026, prova generale del
// cambio d'anno, difetto 29). L'01/01/2027 alle 00:30 il modulo proponeva il
// 31/12/2026 (il giorno UTC), e la lettura del portale di quel momento,
// salvata col giorno proposto, prendeva il posto della fotografia della
// chiusura: il 2026 di Nappi Sud a 25,88 t invece di 35,88. Il modulo vero,
// montato col banco delle pagine, con l'orologio fermo.
console.log('LA NUOVA RILEVAZIONE DEI PIAZZALI PROPONE IL GIORNO ITALIANO, E AVVISA SUL 31/12 DELLA CHIUSURA');
{
  const OraVera2 = Date;
  const ferma = (iso) => { const ms = OraVera2.parse(iso); globalThis.Date = class extends OraVera2 { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } }; };
  const { Componente, monta } = await caricaPagina('components/giacenze/RilevazioneForm.jsx');
  const fotoChiusura = { id: 'f1', sito: 'NAPPI SUD SRL', data_rilevazione: '2026-12-31', class1_kg: 31400, chiusura_salvata_il: '2026-12-31T22:30:00.000Z', note: 'Chiusura 2026, fotografia del 31/12/2026 salvata da prova il 31/12/2026.' };
  const props = { open: true, onClose() {}, precompilato: { sito: 'NAPPI SUD SRL' }, sitiSuggeriti: [], unitaPerSito: new Map(), onSaved() {} };
  const giornoProposto = async (iso, archivi = {}) => {
    const c = clienteFinto({ archivi });
    globalThis.__CLIENTE_FINTO = c.cliente;
    ferma(iso);
    try {
      const r = monta(Componente, props);
      await aspetta();
      const campo = trova(r.albero, el => el.props && el.props.type === 'date')[0];
      const avviso = trova(r.albero, el => el.props && el.props['data-avviso'] === 'fotografia-chiusura').length > 0;
      return { r, campo, avviso, c };
    } finally { globalThis.Date = OraVera2; }
  };
  const mezzanotte = await giornoProposto('2026-12-31T23:30:00Z');
  verifica("l'01/01/2027 alle 00:30 italiane propone l'01/01/2027, non il 31/12/2026", mezzanotte.campo && mezzanotte.campo.props.value === '2027-01-01', mezzanotte.campo && mezzanotte.campo.props.value);
  const sera = await giornoProposto('2026-12-31T22:30:00Z');
  verifica('il 31/12/2026 alle 23:30 italiane propone il 31/12/2026', sera.campo && sera.campo.props.value === '2026-12-31', sera.campo && sera.campo.props.value);
  // Il 31/12 con la fotografia della chiusura gia' salvata: l'avviso, prima di salvare.
  const conFoto = await giornoProposto('2026-12-31T22:30:00Z', { GiacenzaStoccaggio: [fotoChiusura] });
  verifica('sul 31/12, con la fotografia della chiusura gia\' salvata, il modulo avvisa che la sostituirebbe', conFoto.avviso === true);
  verifica('e per saperlo legge una volta le rilevazioni di quel giorno', conFoto.c.letture('GiacenzaStoccaggio').length === 1 && conFoto.c.letture('GiacenzaStoccaggio')[0].filtro.data_rilevazione === '2026-12-31', JSON.stringify(conFoto.c.letture('GiacenzaStoccaggio')));
  const senzaFoto = await giornoProposto('2026-12-31T22:30:00Z', { GiacenzaStoccaggio: [{ ...fotoChiusura, chiusura_salvata_il: undefined, note: 'lettura a mano' }] });
  verifica('una rilevazione del 31/12 scritta a mano non e\' la fotografia della chiusura: niente avviso', senzaFoto.avviso === false);
  verifica('un altro giorno non legge niente', mezzanotte.c.letture('GiacenzaStoccaggio').length === 0);
  for (const x of [mezzanotte, sera, conFoto, senzaFoto]) x.r.smonta();
  delete globalThis.__CLIENTE_FINTO;
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
