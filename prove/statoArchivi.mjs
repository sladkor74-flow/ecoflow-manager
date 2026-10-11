// «DATI FINO AL» IN DASHBOARD (chiusura dell'audit, 11/10/2026).
//
// Il giorno del caricamento non dice fino a dove arrivano i dati: un file
// caricato il 9 puo' fermarsi al 6. Lo sapeva solo EcoTyna; ora la regola sta
// in base44/shared/statoArchivi.ts (datiFinoAl, finoAlPerTipo) e la dashboard
// la mostra accanto al giorno del caricamento. Qui si prova:
// - che datiFinoAl dica le stesse date di EcoTyna sugli stessi archivi;
// - che nel report delle dichiarazioni contino solo le righe SMOCO (nostraRiga);
// - che la dashboard legga poche righe ordinate per archivio, mai l'archivio
//   intero (il limite di richieste vale per tutta l'app);
// - che la funzione della dashboard legga il registro come i motori e passi il
//   «fino al» al cruscotto.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const R = new URL('../base44/shared/', import.meta.url).href;
const SA = await import(R + 'statoArchivi.ts').catch(() => ({}));
const { STRUMENTI } = await import(R + 'strumentiAssistente.ts');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const ARCHIVI = {
  UploadLog: [{ id: 'u1', tipo_file: 'primarie', created_date: '2026-10-09T08:00:00', nome_file: 'primarie.xlsx', righe_importate: 120, esito: 'successo' }],
  PrimariaRete: [
    { id: 'p1', stato: 'terminato', trasporto_finito_il: '2026-10-05T00:00:00.000Z' },
    { id: 'p2', stato: 'terminato', trasporto_finito_il: '2026-10-06T23:30:00.000Z' },   // a Roma e' gia' il 7
    { id: 'p3', stato: 'eseguito', trasporto_finito_il: '2026-10-08T10:00:00.000Z' },    // non terminato: non conta
    { id: 'p4', stato: 'terminato' },                                                    // senza fine trasporto
  ],
  PrimariaAci: [{ id: 'a1', stato: 'terminato', trasporto_finito_il: '2026-09-30T00:00:00.000Z' }],
  Secondaria: [],
  Terziaria: [{ id: 't1', stato: 'terminato', trasporto_finito_il: '2026-07-19T08:00:00.000Z' }],
  ExtraRaccolta: [{ id: 'e1', stato: 'terminato', trasporto_finito_il: '2026-10-01T08:00:00.000Z' }],
  // created_date in UTC senza la Z: alle 22:30 UTC del 9 a Roma e' il 10.
  OrdineNonDichiarato: [{ id: 'o1', created_date: '2026-10-09T22:30:00' }, { id: 'o2', created_date: '2026-10-02T06:00:00' }],
  // Una dichiarazione di Baucina piu' recente delle nostre non sposta la data.
  DichiarazioneTrattamento: [
    { id: 'd1', data_dichiarazione: '2026-10-03', partner_operativo: 'SMOCO SRL' },
    { id: 'd2', data_dichiarazione: '2026-10-08', partner_operativo: 'BAUCINA RECYCLING TYRES SRL' },
    { id: 'd3', data_dichiarazione: '2026-09-20' },
  ],
  Assegnato: [{ id: 'as1', ordine_immesso_il: '2026-10-08T09:00:00Z' }],
  AssegnatoAci: [],
};
const ordina = (righe, sort) => {
  const campo = String(sort || 'id').replace(/^[-+]/, '');
  const giu = String(sort || '').startsWith('-');
  return [...righe].sort((a, b) => {
    const x = a[campo], y = b[campo];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return giu ? String(y).localeCompare(String(x)) : String(x).localeCompare(String(y));
  });
};
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v));
const letture = [];
const finto = {
  asServiceRole: {
    entities: new Proxy({}, {
      get: (_t, nome) => ({
        list: async (sort, lim = 1e9, skip = 0) => { letture.push({ nome, lim }); return ordina(ARCHIVI[nome] || [], sort).slice(skip, skip + lim); },
        filter: async (f, sort, lim = 1e9, skip = 0) => { letture.push({ nome, lim }); return ordina((ARCHIVI[nome] || []).filter(r => soddisfa(r, f)), sort).slice(skip, skip + lim); },
      }),
    }),
  },
};

console.log('FINO A CHE GIORNO ARRIVANO I DATI');
{
  verifica('il modulo condiviso esiste', typeof SA.datiFinoAl === 'function' && typeof SA.finoAlPerTipo === 'function');
  const voci = SA.datiFinoAl ? await SA.datiFinoAl(finto.asServiceRole.entities) : [];
  const di = (a) => (voci.find(v => v.archivio === a) || {}).dati_fino_al;
  verifica('primarie di rete: l\'ultima fine trasporto dei terminati, sul giorno italiano', di('primarie di rete') === '2026-10-07', di('primarie di rete'));
  verifica('fotografia dei non dichiarati: created_date senza la Z letto in UTC (22:30 del 9 = 10 a Roma)', di('ordini non dichiarati (fotografia del portale)') === '2026-10-10', di('ordini non dichiarati (fotografia del portale)'));
  verifica('report delle dichiarazioni: solo le righe SMOCO (Baucina dell\'08/10 non conta)', di('report delle dichiarazioni di trattamento') === '2026-10-03', di('report delle dichiarazioni di trattamento'));
  const sec = voci.find(v => v.archivio === 'secondarie') || {};
  verifica('un archivio vuoto si dice vuoto, non zero', sec.dati_fino_al === null && sec.vuoto === true, JSON.stringify(sec));

  // Le stesse date di EcoTyna, archivio per archivio: la regola e' stata copiata
  // da li' e le due devono dire la stessa cosa finche' EcoTyna non usa questa.
  // Con la Z sulla fotografia: EcoTyna legge created_date senza rimetterla, e
  // senza Z il giorno dipende dal fuso della macchina (sul server e' UTC, e
  // torna; qui no). Il resto e' uguale.
  const senzaZ = ARCHIVI.OrdineNonDichiarato;
  ARCHIVI.OrdineNonDichiarato = senzaZ.map(r => ({ ...r, created_date: r.created_date + 'Z' }));
  const eco = (await STRUMENTI.find(s => s.nome === 'caricamenti').esegui(finto)).dati.dati_fino_al;
  const conZ = SA.datiFinoAl ? await SA.datiFinoAl(finto.asServiceRole.entities) : [];
  ARCHIVI.OrdineNonDichiarato = senzaZ;
  const nostre = Object.fromEntries(conZ.map(v => [v.archivio, v.dati_fino_al]));
  const loro = Object.fromEntries(eco.map(v => [v.archivio, v.dati_fino_al]));
  verifica('le stesse date che dice EcoTyna, sugli stessi archivi', JSON.stringify(Object.keys(nostre).sort()) === JSON.stringify(Object.keys(loro).sort())
    && Object.keys(loro).every(k => loro[k] === nostre[k]), JSON.stringify({ nostre, loro }));

  const perTipo = SA.finoAlPerTipo ? SA.finoAlPerTipo(voci) : {};
  verifica('per il file delle primarie vale il giorno piu\' avanti fra rete e ACI, non l\'ultimo ordine assegnato (08/10)', perTipo.primarie && perTipo.primarie.fino_al === '2026-10-07', JSON.stringify(perTipo.primarie));
  verifica('le terziarie: il 19/07', perTipo.terziarie && perTipo.terziarie.fino_al === '2026-07-19', JSON.stringify(perTipo.terziarie));
  verifica('secondarie vuote: nessuna data, col perche\'', perTipo.secondarie && perTipo.secondarie.fino_al === null && /nessuna riga/.test(perTipo.secondarie.perche), JSON.stringify(perTipo.secondarie));
  // Il report con solo righe di altri partner: la data non si sa, e lo si dice.
  const soloAltri = SA.finoAlPerTipo ? SA.finoAlPerTipo([{ tipo_file: 'dichiarazioni_trattamento', dati_fino_al: null, nessuna_riga_nostra: true, avviso: 'nessuna del partner operativo SMOCO', cosa: 'x' }]) : {};
  verifica('un report senza righe SMOCO non e\' vuoto: si dice perche\' la data manca', soloAltri.dichiarazioni_trattamento && soloAltri.dichiarazioni_trattamento.fino_al === null && /SMOCO/.test(soloAltri.dichiarazioni_trattamento.perche), JSON.stringify(soloAltri));
}

console.log('LA DASHBOARD LEGGE POCO');
{
  letture.length = 0;
  const voci = SA.datiFinoAl ? await SA.datiFinoAl(finto.asServiceRole.entities, SA.ARCHIVI_DEL_CRUSCOTTO) : [];
  const nomi = [...new Set(letture.map(l => l.nome))].sort();
  verifica('solo gli archivi del riquadro: niente assegnati, niente extra raccolta', JSON.stringify(nomi) === JSON.stringify(['DichiarazioneTrattamento', 'OrdineNonDichiarato', 'PrimariaAci', 'PrimariaRete', 'Secondaria', 'Terziaria']), JSON.stringify(nomi));
  verifica('una lettura per archivio, di cinque righe (cinquanta per il report, che va a pagine)', letture.length === 6 && letture.every(l => l.lim === (l.nome === 'DichiarazioneTrattamento' ? 50 : 5)), JSON.stringify(letture));
  verifica('e le voci sono quelle', voci.length === 6);
  // L'elenco del primo giorno del riquadro: la primaria di rete la piu' avanti.
  const pt = SA.finoAlPerTipo ? SA.finoAlPerTipo(voci) : {};
  verifica('Primarie e assegnati: il giorno della rete (07/10), non quello dell\'ACI (30/09)', pt.primarie && pt.primarie.fino_al === '2026-10-07', JSON.stringify(pt.primarie));
}

console.log('LA FUNZIONE DELLA DASHBOARD');
{
  const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in)) ? v.$in.includes(r[k]) : r[k] === v);
const entita = (nome) => ({
  list: async (s, lim) => { globalThis.__LETTURE.push({ nome, lim, modo: 'list' }); return (globalThis.__ARCHIVI[nome] || []).slice(0, lim || 1e9); },
  filter: async (f, s, lim) => { globalThis.__LETTURE.push({ nome, lim, modo: 'filter', f: JSON.stringify(f) }); return (globalThis.__ARCHIVI[nome] || []).filter(r => soddisfa(r, f)).slice(0, lim || 1e9); },
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'user', email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;
  const pacchetto = await build({
    entryPoints: [fileURLToPath(new URL('../base44/functions/cruscottoOperativo/entry.ts', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    } }],
  });
  const f = (await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'))).default;
  globalThis.__LETTURE = [];
  globalThis.__ARCHIVI = {
    ...ARCHIVI,
    // Una riscrittura delle primarie finita parziale, dopo il successo.
    UploadLog: [
      { id: 'u2', tipo_file: 'primarie', esito: 'parziale', modalita: 'sostituzione', created_date: '2026-10-09T08:00:00', nome_file: 'primarie_09.xlsx' },
      { id: 'u1', tipo_file: 'primarie', esito: 'successo', modalita: 'sostituzione', created_date: '2026-10-05T08:00:00', nome_file: 'primarie_05.xlsx' },
    ],
  };
  const r = await f({ json: async () => ({}) });
  const j = await r.json();
  const registro = globalThis.__LETTURE.filter(l => l.nome === 'UploadLog');
  verifica('il registro si legge come lo leggono i motori: per tipo di file, poche righe, non le ultime duecento di tutto', registro.length === 1 && registro[0].modo === 'filter' && /\$in/.test(registro[0].f), JSON.stringify(registro));
  const prim = ((j.caricamenti && j.caricamenti.archivi) || []).find(a => a.tipo_file === 'primarie') || {};
  verifica('le primarie: caricate il 05/10, dati fino al 07/10, e la riscrittura del 09/10 non riuscita', prim.il === '2026-10-05' && prim.fino_al === '2026-10-07' && prim.stato === 'non_riuscito', JSON.stringify(prim));
  verifica('e la voce rossa in testa', (j.da_gestire || []).some(v => v.gravita === 'critico' && /^Caricamento non riuscito: ricarica il file \(Primarie e assegnati\)/.test(v.titolo)), (j.da_gestire || []).map(v => v.titolo).join(' | '));
  const nomiFinoAl = globalThis.__LETTURE.filter(l => ['PrimariaRete', 'PrimariaAci', 'Secondaria', 'Terziaria', 'OrdineNonDichiarato', 'DichiarazioneTrattamento'].includes(l.nome));
  verifica('il «fino al» con letture di poche righe', nomiFinoAl.length === 6 && nomiFinoAl.every(l => l.lim <= 50), JSON.stringify(nomiFinoAl));

  // I MESI DELL'ANNO PRIMA ANCORA APERTI (revisione della chiusura,
  // 11/10/2026): restano finche' non si chiudono, in qualunque mese. I
  // documenti dell'anno prima si leggono sempre (sono pochi); le prefatture,
  // che portano le righe del portale, solo se un suo documento e' ancora aperto.
  const annoOggi = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric' }).format(new Date()));
  const chiusiPrima = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre'].flatMap(m => ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => ({ tipo: 'ATTIVA', anno: annoOggi - 1, mese: m, tipologia: t, stato: 'chiusa' })));
  const dicembreAperto = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => ({ tipo: 'ATTIVA', anno: annoOggi - 1, mese: 'Dicembre', tipologia: t, stato: 'elaborata' }));
  const conDocumenti = async (documenti) => {
    globalThis.__LETTURE = [];
    globalThis.__ARCHIVI = { ...ARCHIVI, UploadLog: [], DocumentoFatturazione: documenti, PrefatturaEcotyre: [{ anno: annoOggi - 1, mese: 'Dicembre', superata: false }] };
    const j = await (await f({ json: async () => ({}) })).json();
    const anniLetti = (nome) => globalThis.__LETTURE.filter(l => l.nome === nome).map(l => JSON.parse(l.f || '{}').anno).sort();
    return { j, documenti: anniLetti('DocumentoFatturazione'), prefatture: anniLetti('PrefatturaEcotyre') };
  };
  const aperto = await conDocumenti([...chiusiPrima, ...dicembreAperto]);
  verifica('i documenti dell\'attiva: anno in corso e anno prima, in qualunque mese', JSON.stringify(aperto.documenti) === JSON.stringify([annoOggi - 1, annoOggi]), JSON.stringify(aperto.documenti));
  verifica('con dicembre dell\'anno prima elaborato e non chiuso si leggono anche le sue prefatture', JSON.stringify(aperto.prefatture) === JSON.stringify([annoOggi - 1, annoOggi]), JSON.stringify(aperto.prefatture));
  verifica('e dicembre resta in griglia, con la sua prefattura', (aperto.j.mesi_attiva || []).some(m => m.anno === annoOggi - 1 && m.mese === 'Dicembre' && m.prefattura === true), JSON.stringify((aperto.j.mesi_attiva || []).filter(m => m.anno !== annoOggi)));
  const chiuso = await conDocumenti([...chiusiPrima, ...dicembreAperto.map(d => ({ ...d, stato: 'chiusa' }))]);
  verifica('con l\'anno prima tutto chiuso le sue prefatture non si leggono', JSON.stringify(chiuso.prefatture) === JSON.stringify([annoOggi]), JSON.stringify(chiuso.prefatture));
  verifica('e dell\'anno prima non resta niente in griglia', !(chiuso.j.mesi_attiva || []).some(m => m.anno !== annoOggi), JSON.stringify((chiuso.j.mesi_attiva || []).filter(m => m.anno !== annoOggi)));
}

console.log('OGNI CONTO E OGNI PAGINA GUARDANO GLI ARCHIVI CHE LEGGONO (revisione della chiusura, 11/10/2026)');
{
  const RC = await import(R + 'registroCaricamenti.ts');
  const primarie = ['primarie', 'primarie_rete', 'primarie_aci'];
  verifica('attiva: solo le primarie', JSON.stringify(RC.TIPI_ATTIVA) === JSON.stringify(primarie), JSON.stringify(RC.TIPI_ATTIVA));
  verifica('passiva, margine e consuntivi: primarie e secondarie', JSON.stringify(RC.TIPI_PASSIVA) === JSON.stringify([...primarie, 'secondarie']), JSON.stringify(RC.TIPI_PASSIVA));
  verifica('prefattura: primarie e terziarie', JSON.stringify(RC.TIPI_PREFATTURA) === JSON.stringify([...primarie, 'terziarie']), JSON.stringify(RC.TIPI_PREFATTURA));
  verifica('chiusura dell\'anno: tutti i movimenti', JSON.stringify(RC.TIPI_CHIUSURA) === JSON.stringify([...primarie, 'secondarie', 'terziarie']), JSON.stringify(RC.TIPI_CHIUSURA));
  verifica('il rinvio delle funzioni prende i tipi da li\'', SA.TIPI_RINVIO && SA.TIPI_RINVIO.attiva === RC.TIPI_ATTIVA && SA.TIPI_RINVIO.passiva === RC.TIPI_PASSIVA && SA.TIPI_RINVIO.prefattura === RC.TIPI_PREFATTURA && SA.TIPI_RINVIO.chiusura === RC.TIPI_CHIUSURA && SA.TIPI_RINVIO.fotografia === RC.TIPI_GIACENZE);
  const { readFileSync } = await import('node:fs');
  const testo = (p) => readFileSync(fileURLToPath(new URL('../' + p, import.meta.url)), 'utf8').replace(/\r/g, '');
  for (const [funzione, chiave] of [['congelaPassivaMese', 'passiva'], ['elaboraFatturazioneAttiva', 'attiva'], ['chiusuraAnno', 'chiusura'], ['prefatturaEcotyre', 'prefattura']]) {
    verifica(`${funzione} passa i suoi tipi (TIPI_RINVIO.${chiave})`, new RegExp(`controlloCaricamenti\\(base44, [^\\n]*TIPI_RINVIO\\.${chiave}\\b`).test(testo(`base44/functions/${funzione}/entry.ts`)));
  }
  // L'avviso sopra i totali delle pagine della fatturazione e dei consuntivi.
  for (const [pagina, tipi] of [
    ['src/components/fatturazione/AttivaDashboard.jsx', 'TIPI_ATTIVA'],
    ['src/components/fatturazione/PassivaModulo.jsx', 'TIPI_PASSIVA'],
    ['src/components/fatturazione/MargineCommessa.jsx', 'TIPI_PASSIVA'],
    ['src/components/verifiche-fornitori/Consuntivi.jsx', 'TIPI_PASSIVA'],
  ]) {
    const src = testo(pagina);
    verifica(`${pagina.split('/').pop()}: l'avviso dei caricamenti con ${tipi}`, new RegExp(`<AvvisoCaricamenti tipi=\\{(?:tipiDeiCanali\\()?${tipi}\\b`).test(src) && new RegExp(`import \\{ ${tipi}(?:, tipiDeiCanali)? \\} from '@/lib/registroCaricamenti'`).test(src));
  }
  // Il solo canale dell'extra raccolta non legge archivi caricati da file (revisione finale, 11/10/2026).
  {
    verifica("tipiDeiCanali: il solo canale dell'extra raccolta non aspetta nessun caricamento", JSON.stringify(RC.tipiDeiCanali(RC.TIPI_PASSIVA, ['EXTRA_RACCOLTA'])) === '[]');
    verifica('con la rete, con piu\' canali o senza canale (tutti) i tipi restano quelli del conto', RC.tipiDeiCanali(RC.TIPI_PASSIVA, ['RETE']) === RC.TIPI_PASSIVA && RC.tipiDeiCanali(RC.TIPI_ATTIVA, ['EXTRA_RACCOLTA', 'ACI']) === RC.TIPI_ATTIVA && RC.tipiDeiCanali(RC.TIPI_ATTIVA, []) === RC.TIPI_ATTIVA);
    verifica('PassivaModulo passa all\'avviso i tipi del suo canale', /<AvvisoCaricamenti tipi=\{tipiDeiCanali\(TIPI_PASSIVA, \[tipologia\]\)\}/.test(testo('src/components/fatturazione/PassivaModulo.jsx')));
  }
}

console.log("L'AVVISO SOPRA I TOTALI DI GIACENZE E DICHIARAZIONI");
{
  // La regola delle pagine e' lo specchio di quella delle funzioni
  // (src/lib/registroCaricamenti.js): lo stesso corpo, e lo stesso risultato.
  const { readFileSync, existsSync } = await import('node:fs');
  const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
  const corpo = (p) => {
    const righe = readFileSync(file(p), 'utf8').replace(/\r\n/g, '\n').split('\n');
    let i = 0;
    while (i < righe.length && (righe[i].startsWith('//') || righe[i].trim() === '')) i++;
    return righe.slice(i).filter(r => !/^import .* from /.test(r)).join('\n').trim();
  };
  const esiste = existsSync(file('src/lib/registroCaricamenti.js')) && existsSync(file('base44/shared/registroCaricamenti.ts'));
  verifica('lo specchio per le pagine esiste ed e\' uguale all\'originale', esiste && corpo('base44/shared/registroCaricamenti.ts') === corpo('src/lib/registroCaricamenti.js'));
  if (esiste) {
    const pacchetto = await build({
      entryPoints: [file('src/lib/registroCaricamenti.js')],
      bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
      alias: { '@/lib/giornoItaliano': file('src/lib/giornoItaliano.js') },
    });
    const specchio = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
    const originale = await import(R + 'registroCaricamenti.ts');
    const registro = [
      { id: 'u2', tipo_file: 'primarie', esito: 'parziale', modalita: 'sostituzione', created_date: '2026-10-09T08:00:00', nome_file: 'primarie_09.xlsx' },
      { id: 'u1', tipo_file: 'primarie', esito: 'successo', modalita: 'sostituzione', created_date: '2026-10-05T08:00:00' },
      { id: 'u3', tipo_file: 'ordini_non_dichiarati', esito: 'in_corso', modalita: 'sostituzione', created_date: '2026-10-11T07:58:00' },
    ];
    const adesso = Date.parse('2026-10-11T08:00:00Z');
    const a = specchio.statoDelRegistro(registro, specchio.TIPI_GIACENZE, adesso);
    const b = originale.statoDelRegistro(registro, originale.TIPI_GIACENZE, adesso);
    verifica('la pagina e la dashboard giudicano lo stesso registro allo stesso modo', JSON.stringify(a) === JSON.stringify(b) && a.in_corso.length === 2, JSON.stringify(a.in_corso));
    const avvisi = a.in_corso.map(specchio.avvisoCaricamento);
    verifica('«caricamento non riuscito» per la riscrittura parziale, «archivio in caricamento» per chi carica adesso',
      avvisi.some(x => x.stato === 'non_riuscito' && x.titolo === 'Caricamento non riuscito: ricarica il file (Primarie e assegnati)')
      && avvisi.some(x => x.stato === 'in_corso' && x.titolo === 'Archivio in caricamento: Ordini non dichiarati'), JSON.stringify(avvisi.map(x => x.titolo)));
  }
  const pagina = (p) => (existsSync(file(p)) ? readFileSync(file(p), 'utf8').replace(/\r/g, '') : '');
  const componente = pagina('src/components/shared/AvvisoCaricamenti.jsx');
  verifica('il componente usa la regola condivisa, non una sua', /from '@\/lib\/registroCaricamenti'/.test(componente) && /statoDelRegistro\(/.test(componente) && /avvisoCaricamento/.test(componente));
  const giacenze = pagina('src/pages/Giacenze.jsx');
  verifica('Giacenze: l\'avviso sta sopra i totali', /<AvvisoCaricamenti aggiorna=\{data\} \/>\s*<GiacenzeKpi/.test(giacenze));
  const dichiarazioni = pagina('src/pages/DichiarazioniImpianti.jsx');
  verifica('Dichiarazioni Impianti: l\'avviso sta sopra i totali', /<AvvisoCaricamenti aggiorna=\{dati\} \/>\s*<div className="grid gap-3/.test(dichiarazioni));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
