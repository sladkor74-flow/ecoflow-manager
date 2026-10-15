// Prova del cruscotto (base44/shared/cruscotto.ts): l'elenco unico delle cose da
// gestire, l'arretrato, i caricamenti, i mesi della fatturazione. In fondo le
// dichiarazioni riconosciute a portale (base44/shared/agganciaDichiarazioni.ts),
// da cui dipendono la quadratura e i mesi "caricati". Dalle decisioni
// dell'utente del 13/10/2026 anche la voce del surplus dell'anno prima finito
// (vociSurplusFiniti: il Fuel Surcharge del 2026, dal 01/01/2027). npm run prove
import { cruscotto, etaArretrato, statoMesiAttiva, nomeRegola } from '../base44/shared/cruscotto.ts';
import * as C from '../base44/shared/cruscotto.ts';
import { statoCaricamenti as statoDeiMotori } from '../base44/shared/reportSettimanali.ts';
import { caricamentiPortale, allineaDalPortale, confrontaConIlPortale, canaliDaScrivere } from '../base44/shared/agganciaDichiarazioni.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const OGGI = '2026-09-20';
const ADESSO = Date.UTC(2026, 8, 20, 18, 0, 0);

console.log('ARRETRATO');
const eta = etaArretrato([
  { id_ordine: 'A', ordine_immesso_il: '2026-09-10T00:00:00Z', peso_stimato: 1000 },
  { id_ordine: 'B', ordine_immesso_il: '2026-08-10T00:00:00Z', peso_stimato: 2000 },
  { id_ordine: 'C', ordine_immesso_il: '2025-09-23T22:00:00Z', peso_stimato: 3000, ragione_sociale: 'Vecchio Srl' },
  { id_ordine: 'D', ordine_immesso_il: null },
], OGGI);
verifica('fasce di eta\' e il piu\' vecchio sul giorno italiano (22:00Z del 23/9 = 24/9)', eta.totale === 4 && eta.entro_30 === 1 && eta.da_31_a_60 === 1 && eta.oltre_60 === 1 && eta.kg_oltre_60 === 3000 && eta.senza_data === 1 && eta.piu_vecchio.id_ordine === 'C' && eta.piu_vecchio.immesso_il === '2025-09-24' && eta.piu_vecchio.giorni === 361, JSON.stringify(eta));

console.log('CARICAMENTI');
const logs = [
  { tipo_file: 'primarie', esito: 'successo', created_date: '2026-09-18T08:00:00', nome_file: 'PRIMARIE.xlsx', utente: 'Antonio' },
  { tipo_file: 'primarie', esito: 'successo', created_date: '2026-09-11T08:00:00' },
  { tipo_file: 'terziarie', esito: 'successo', created_date: '2026-08-26T08:00:00' },
  { tipo_file: 'secondarie', esito: 'in_corso', created_date: '2026-09-20T09:00:00', utente: 'Antonio' },     // nove ore fa: interrotto
  { tipo_file: 'secondarie', esito: 'successo', created_date: '2026-09-18T08:00:00' },
  { tipo_file: 'pdr', esito: 'in_corso', created_date: '2026-09-20T17:55:00' },                                // cinque minuti fa: in corso davvero
  { tipo_file: 'pdr', esito: 'errore', created_date: '2026-09-19T08:00:00' },
];
// Dalla chiusura dell'audit (11/10/2026) la dashboard usa la regola dei motori:
// freschezzaArchivi (cruscotto.ts) su statoDelRegistro (registroCaricamenti.ts).
// Le verifiche di prima restano: la regola nuova le soddisfa tutte.
const freschezza = (registro, tipi) => (C.freschezzaArchivi ? C.freschezzaArchivi(registro, OGGI, ADESSO, tipi) : C.statoCaricamenti(registro, OGGI, ADESSO, tipi));
const c = freschezza(logs, ['primarie', 'secondarie', 'terziarie', 'pdr']);
verifica('l\'ultimo riuscito per tipo, coi giorni', c.archivi[0].il === '2026-09-18' && c.archivi[0].giorni_fa === 2 && c.archivi[2].giorni_fa === 25 && c.archivi[3].il === null);
verifica('interrotto solo chi e\' fermo da oltre dieci minuti', c.interrotti.length === 1 && c.interrotti[0].tipo_file === 'secondarie');
const rifatto = freschezza([{ tipo_file: 'secondarie', esito: 'successo', created_date: '2026-09-20T10:00:00' }, ...logs], ['secondarie']);
verifica('un caricamento interrotto alle 9 e rifatto alle 10 non e\' piu\' un problema', rifatto.interrotti.length === 0, JSON.stringify(rifatto.interrotti));
const nonRifatto = freschezza([{ tipo_file: 'secondarie', esito: 'successo', created_date: '2026-09-20T08:00:00' }, ...logs], ['secondarie']);
verifica('se l\'ultimo riuscito e\' di PRIMA dell\'interruzione, il problema resta', nonRifatto.interrotti.length === 1);
// Un caricamento fallito dopo lo svuotamento resta "in_corso" (importEcotyreFile,
// importaBlocco); un file sbagliato caricato dopo si chiude in "errore" a dati
// intatti, e non deve nascondere l'archivio rimasto vuoto.
const fallito = freschezza([
  { tipo_file: 'secondarie', esito: 'errore', created_date: '2026-09-20T12:00:00', messaggio: 'Formato file non valido' },
  { tipo_file: 'secondarie', esito: 'in_corso', created_date: '2026-09-20T11:00:00', messaggio: 'Caricamento non riuscito: nessuna riga scritta dopo lo svuotamento dell\'archivio' },
  { tipo_file: 'secondarie', esito: 'successo', created_date: '2026-09-18T08:00:00' },
], ['secondarie']);
verifica('fallito dopo lo svuotamento e poi un file rifiutato: resta da ricaricare', fallito.interrotti.length === 1 && (fallito.interrotti[0].data || fallito.interrotti[0].il) === '2026-09-20', JSON.stringify(fallito.interrotti));
verifica('e si dice «non riuscito», non «interrotto»: la riga lo dichiara da se\'', fallito.interrotti.length === 1 && fallito.interrotti[0].avviso && fallito.interrotti[0].avviso.stato === 'non_riuscito', JSON.stringify(fallito.interrotti));

console.log('UNA REGOLA SOLA FRA DASHBOARD E MOTORI (chiusura dell\'audit, 11/10/2026)');
{
  // Il caso di chiusura/target-caricamenti.mjs: il successo del 05/10 e una
  // riscrittura delle primarie finita «parziale» il 09/10 (righe non scritte).
  // I motori rinviavano («va ripetuto»); la dashboard diceva «5 giorni fa» e
  // nessun avviso.
  const registro = [
    { id: 'u1', tipo_file: 'primarie', esito: 'successo', modalita: 'sostituzione', created_date: '2026-10-05T08:00:00.000', updated_date: '2026-10-05T08:05:00.000', nome_file: 'primarie_05.xlsx' },
    { id: 'u2', tipo_file: 'primarie', esito: 'parziale', modalita: 'sostituzione', created_date: '2026-10-09T08:00:00.000', updated_date: '2026-10-09T08:06:00.000', nome_file: 'primarie_09.xlsx', messaggio: '4800 righe importate, 200 righe non scritte' },
    ...['secondarie', 'terziarie', 'ordini_non_dichiarati', 'dichiarazioni_trattamento', 'pdr'].map((t, i) => ({ id: 'x' + i, tipo_file: t, esito: 'successo', created_date: '2026-10-09T07:00:00.000' })),
  ];
  const tipiFile = ['primarie', 'secondarie', 'terziarie', 'ordini_non_dichiarati', 'dichiarazioni_trattamento', 'pdr'];
  const r = cruscotto({ oggi: '2026-10-11', anno: 2026, adessoMs: Date.parse('2026-10-11T08:00:00Z'), tipiFile, uploadLogs: registro, alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], richiesteEct: [] });
  const vCar = r.da_gestire.filter(v => v.area === 'Caricamento dati');
  const nonRiuscito = vCar.find(v => /^Caricamento non riuscito: ricarica il file/.test(v.titolo));
  verifica('una riscrittura finita parziale compare come «Caricamento non riuscito: ricarica il file»', nonRiuscito && nonRiuscito.gravita === 'critico' && /Primarie e assegnati/.test(nonRiuscito.titolo) && /09\/10\/2026/.test(nonRiuscito.dettaglio), JSON.stringify(vCar));
  const prim = r.caricamenti.archivi.find(a => a.tipo_file === 'primarie');
  verifica('la freschezza e\' quella dell\'ultimo caricamento riuscito, col suo stato accanto', prim.il === '2026-10-05' && prim.stato === 'non_riuscito', JSON.stringify(prim));
  // Lo stesso registro letto dai motori, come lo leggono loro.
  const finto = { asServiceRole: { entities: { UploadLog: { filter: async (f, _s, lim) => registro.filter(l => (f.tipo_file && f.tipo_file.$in ? f.tipo_file.$in.includes(l.tipo_file) : l.tipo_file === f.tipo_file)).sort((a, b) => b.created_date.localeCompare(a.created_date)).slice(0, lim || 1e9) } } } };
  const motori = await statoDeiMotori(finto, tipiFile);
  verifica('dashboard e motori dicono la stessa cosa: lo stesso caricamento, lo stesso esito',
    JSON.stringify((r.caricamenti.in_corso || r.caricamenti.interrotti || []).map(a => [a.id, a.tipo_file, a.esito || null])) === JSON.stringify(motori.in_corso.map(a => [a.id, a.tipo_file, a.esito || null])) && motori.in_corso.length === 1,
    JSON.stringify({ dashboard: r.caricamenti.in_corso, motori: motori.in_corso }).slice(0, 300));
  verifica('e lo stesso ultimo riuscito', tipiFile.every(t => ((r.caricamenti.archivi.find(a => a.tipo_file === t) || {}).il || null) === ((motori.ultimi[t] || {}).data || null)));
  // Il nome dell'archivio si legge come a video, non come chiave interna.
  const vuoto = cruscotto({ oggi: '2026-10-11', anno: 2026, adessoMs: Date.parse('2026-10-11T08:00:00Z'), tipiFile: ['ordini_non_dichiarati'], uploadLogs: [], alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], richiesteEct: [] });
  verifica('«Mai caricato: Ordini non dichiarati», non «ordini_non_dichiarati»', vuoto.da_gestire.some(v => v.titolo === 'Mai caricato: Ordini non dichiarati') && !vuoto.da_gestire.some(v => /ordini_non_dichiarati/.test(v.titolo)), vuoto.da_gestire.map(v => v.titolo).join(' | '));
  // Un collega che sta caricando adesso non e' un guasto: si dice, da sapere.
  const adesso = cruscotto({ oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: ['pdr'], uploadLogs: logs, alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], richiesteEct: [] });
  verifica('un caricamento in corso da cinque minuti: «Archivio in caricamento», da sapere', adesso.da_gestire.some(v => v.gravita === 'info' && v.titolo === 'Archivio in caricamento: Punti di raccolta'), adesso.da_gestire.map(v => v.gravita + ':' + v.titolo).join(' | '));
  // Un «parziale» che non ha riscritto l'archivio (aggiunta, righe scartate) e'
  // un caricamento riuscito per i motori: lo e' anche per la dashboard.
  const aggiunta = freschezza([{ tipo_file: 'pdr', esito: 'parziale', modalita: 'aggiunta', created_date: '2026-09-19T08:00:00' }], ['pdr']);
  verifica('un parziale in aggiunta conta come caricato', aggiunta.archivi[0].il === '2026-09-19' && aggiunta.interrotti.length === 0, JSON.stringify(aggiunta.archivi[0]));
}

console.log('DATI FINO AL (chiusura dell\'audit, 11/10/2026)');
{
  const base = { oggi: '2026-10-11', anno: 2026, adessoMs: Date.parse('2026-10-11T08:00:00Z'), alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], richiesteEct: [] };
  const caricatoIeri = (t) => ({ tipo_file: t, esito: 'successo', created_date: '2026-10-10T07:00:00', nome_file: t + '.xlsx' });
  const tipiFile = ['primarie', 'terziarie', 'ordini_non_dichiarati'];
  const uploadLogs = tipiFile.map(caricatoIeri);
  // Un file delle primarie caricato ieri ma scaricato dal portale piu' di tre
  // settimane fa (dalla revisione dell'11/10/2026 la soglia e' sullo scarto fra
  // caricamento e «fino al», oltre tre settimane: qui 25 giorni).
  const vecchio = cruscotto({ ...base, tipiFile, uploadLogs, finoAl: {
    primarie: { fino_al: '2026-09-15', cosa: 'ultima fine trasporto dei terminati' },
    terziarie: { fino_al: '2026-07-19', cosa: 'ultima fine trasporto dei terminati' },
    ordini_non_dichiarati: { fino_al: '2026-10-10', cosa: 'giorno della fotografia' },
  } });
  const vPrim = vecchio.da_gestire.find(v => /^Primarie e assegnati: dati fino al 15\/09\/2026/.test(v.titolo));
  verifica('primarie caricate ieri con dentro i dati fino al 15/09: la voce gialla si misura su «dati fino al»', vPrim && vPrim.gravita === 'attenzione' && /Caricato il 10\/10\/2026/.test(vPrim.dettaglio) && /25 giorni prima del caricamento, 26 giorni fa/.test(vPrim.dettaglio), vecchio.da_gestire.map(v => `${v.titolo} [${v.dettaglio}]`).join(' | '));
  verifica('le terziarie, che non arrivano tutti i giorni, no: l\'ultima del 19/07 non fa un file vecchio', !vecchio.da_gestire.some(v => /^Terziarie/.test(v.titolo)), vecchio.da_gestire.map(v => v.titolo).join(' | '));
  const ter = vecchio.caricamenti.archivi.find(a => a.tipo_file === 'terziarie');
  verifica('ma il «fino al» delle terziarie si mostra lo stesso, accanto al caricamento', ter && ter.fino_al === '2026-07-19' && ter.il === '2026-10-10' && ter.misurata_su === 'caricamento' && ter.vecchio === false, JSON.stringify(ter));
  const nd = vecchio.caricamenti.archivi.find(a => a.tipo_file === 'ordini_non_dichiarati');
  verifica('la fotografia di ieri e\' fresca', nd && nd.fino_al === '2026-10-10' && nd.vecchio === false, JSON.stringify(nd));
  // Una data nel futuro (un errore nel file) non fa sembrare fresco un file vecchio.
  const futuro = cruscotto({ ...base, tipiFile: ['primarie'], uploadLogs: [{ tipo_file: 'primarie', esito: 'successo', created_date: '2026-09-20T07:00:00' }], finoAl: { primarie: { fino_al: '2026-12-01', cosa: 'x' } } });
  verifica('un «fino al» nel futuro non nasconde un caricamento di tre settimane fa', futuro.da_gestire.some(v => /^Primarie e assegnati: dati di 21 giorni fa/.test(v.titolo)), futuro.da_gestire.map(v => v.titolo).join(' | '));
  // Senza «fino al» (lettura non riuscita) la freschezza resta quella del caricamento.
  const senza = cruscotto({ ...base, tipiFile: ['primarie'], uploadLogs: [caricatoIeri('primarie')] });
  verifica('senza «fino al» nessuna voce su un file caricato ieri', !senza.da_gestire.some(v => v.area === 'Caricamento dati'), senza.da_gestire.map(v => v.titolo).join(' | '));
}

console.log('NATALE E FERRAGOSTO NON SONO UN FILE VECCHIO (revisione della chiusura, 11/10/2026)');
{
  // Nel file vero (PRIMARIE.xlsx del 09/10/2026) fra i terminati SMOCO non c'e'
  // nessuna fine trasporto dal 22/12/2025 all'08/01/2026 (17 giorni) e dal 07/08
  // al 18/08/2026 (11 giorni). Un file caricato la mattina stessa, completo,
  // faceva dire «dati fino al 22/12/2025 ... fermi a quel giorno».
  const primarie = (oggi, caricato, finoAl) => cruscotto({
    oggi, anno: Number(oggi.slice(0, 4)), adessoMs: Date.parse(oggi + 'T08:00:00Z'), tipiFile: ['primarie'],
    uploadLogs: [{ id: 'u1', tipo_file: 'primarie', esito: 'successo', modalita: 'sostituzione', created_date: caricato + 'T06:30:00', nome_file: 'PRIMARIE.xlsx' }],
    finoAl: { primarie: { fino_al: finoAl, cosa: 'ultima fine trasporto dei terminati', perche: '' } },
    alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], richiesteEct: [],
  });
  const vociCaricamento = (r) => r.da_gestire.filter(v => v.area === 'Caricamento dati');
  for (const [oggi, finoAl, quando] of [['2026-01-05', '2025-12-22', 'il 05/01, dopo Natale'], ['2026-01-08', '2025-12-22', "l'08/01, l'ultimo giorno del buco"], ['2026-08-18', '2026-08-07', 'il 18/08, dopo Ferragosto']]) {
    const r = primarie(oggi, oggi, finoAl);
    verifica(`file caricato ${quando} con i dati fino al ${finoAl.split('-').reverse().join('/')}: nessuna voce`, vociCaricamento(r).length === 0, vociCaricamento(r).map(v => v.titolo).join(' | '));
    const a = r.caricamenti.archivi[0];
    verifica(`e nella tabella non e' «fermo»: si misura sul caricamento (${quando})`, a.vecchio === false && a.misurata_su === 'caricamento' && a.fino_al === finoAl, JSON.stringify(a));
  }
  // La soglia: tre settimane esatte di scarto si tengono, un giorno di piu' no.
  const tre = primarie('2026-10-11', '2026-10-11', '2026-09-20');
  verifica('21 giorni fra il «fino al» e il caricamento: ancora nessuna voce', vociCaricamento(tre).length === 0, vociCaricamento(tre).map(v => v.titolo).join(' | '));
  const oltre = primarie('2026-10-11', '2026-10-11', '2026-09-19');
  verifica('22 giorni: la voce «dati fino al»', vociCaricamento(oltre).some(v => /^Primarie e assegnati: dati fino al 19\/09\/2026/.test(v.titolo) && /22 giorni prima del caricamento/.test(v.dettaglio)), vociCaricamento(oltre).map(v => `${v.titolo} [${v.dettaglio}]`).join(' | '));
  verifica('la soglia e\' scritta, e piu\' larga del buco di Natale', C.GIORNI_SCARTO_FINO_AL === 21);
  // Un file fresco l'08/01 e mai ricaricato: dopo dieci giorni lo dice l'altra
  // voce, sul caricamento, non il «fino al» di Natale.
  const fermo = primarie('2026-01-20', '2026-01-08', '2025-12-22');
  const vf = vociCaricamento(fermo);
  verifica('caricato l\'08/01 e fermo al 20/01: «dati di 12 giorni fa», non «fino al 22/12»', vf.length === 1 && /^Primarie e assegnati: dati di 12 giorni fa/.test(vf[0].titolo) && /fino al 22\/12\/2025/.test(vf[0].dettaglio), vf.map(v => `${v.titolo} [${v.dettaglio}]`).join(' | '));
  verifica('e nella tabella «fermo da 12 giorni»', fermo.caricamenti.archivi[0].vecchio === true && fermo.caricamenti.archivi[0].eta_giorni === 12, JSON.stringify(fermo.caricamenti.archivi[0]));
}

console.log('MESI DELLA FATTURAZIONE ATTIVA');
const docs = [
  ...['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => ({ tipo: 'ATTIVA', anno: 2026, mese: 'Gennaio', tipologia: t, stato: 'chiusa' })),
  ...['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => ({ tipo: 'ATTIVA', anno: 2026, mese: 'Luglio', tipologia: t, stato: 'elaborata' })),
  { tipo: 'ATTIVA', anno: 2026, mese: 'Marzo', tipologia: 'RETE', stato: 'approvata', superato: true },
];
const mesi = statoMesiAttiva(docs, [{ anno: 2026, mese: 'Luglio', superata: false }, { anno: 2026, mese: 'Gennaio', superata: true }], 2026, OGGI);
verifica('si guardano i mesi finiti: da gennaio ad agosto, settembre e\' in corso', mesi.length === 8 && mesi[7].mese === 'Agosto');
verifica('gennaio chiuso, luglio elaborato con prefattura, marzo superato = da elaborare', mesi[0].chiuso && mesi[6].elaborato && mesi[6].prefattura && !mesi[2].elaborato && mesi[0].prefattura === false);

// Ogni canale ha il suo documento: un mese non e' elaborato ne' chiuso perche' lo e' un altro canale.
const perCanale = (mese, stati) => Object.entries(stati).map(([tipologia, stato]) => ({ tipo: 'ATTIVA', anno: 2026, mese, tipologia, stato }));
const docsCanali = [
  ...perCanale('Febbraio', { RETE: 'elaborata' }),                                        // ACI ed extra mancanti
  ...perCanale('Aprile', { RETE: 'chiusa', ACI: 'chiusa' }),                              // extra mancante
  ...perCanale('Maggio', { RETE: 'chiusa', ACI: 'chiusa', EXTRA_RACCOLTA: 'approvata' }), // extra aperta
  ...perCanale('Giugno', { RETE: 'approvata', ACI: 'chiusa', EXTRA_RACCOLTA: 'chiusa' }), // rete aperta
];
const mc = statoMesiAttiva(docsCanali, [], 2026, OGGI);
verifica('rete elaborata e ACI mancante: elaborato, con i canali mancanti detti per nome', mc[1].elaborato && JSON.stringify(mc[1].canali_mancanti) === '["ACI","EXTRA_RACCOLTA"]' && mc[1].canali.RETE.stato === 'elaborata' && !mc[1].chiuso, JSON.stringify(mc[1]));
verifica('rete e ACI chiuse, extra mancante: il mese NON e\' chiuso', !mc[3].chiuso && JSON.stringify(mc[3].canali_mancanti) === '["EXTRA_RACCOLTA"]', JSON.stringify(mc[3]));
verifica('rete e ACI chiuse, extra approvata: non chiuso, niente canali mancanti', !mc[4].chiuso && mc[4].canali_mancanti.length === 0 && mc[4].canali.RETE.chiuso && !mc[4].canali.EXTRA_RACCOLTA.chiuso);
const rc = cruscotto({ oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: [], alertAperti: [], uploadLogs: [], assegnatiRete: [], assegnatiAci: [], documenti: docsCanali, prefatture: [], riepilogoQualifica: null, richiesteEct: [] });
const fatt = rc.da_gestire.filter(v => v.area === 'Fatturazione attiva');
const vMancante = fatt.find(v => /con un canale non elaborato/.test(v.titolo));
verifica('voce "mesi con un canale non elaborato": febbraio (ACI, extra) e aprile (extra)', vMancante && vMancante.titolo.startsWith('2 ') && /Febbraio: ACI, Extra raccolta/.test(vMancante.dettaglio) && /Aprile: Extra raccolta/.test(vMancante.dettaglio), fatt.map(v => `${v.titolo} [${v.dettaglio}]`).join(' | '));
// La prefattura del portale copre solo rete e ACI: la chiede solo un mese in cui
// uno dei due e' elaborato e non chiuso. Maggio (rete e ACI chiuse, extra aperta)
// e aprile (rete e ACI chiuse) no; febbraio (rete aperta) e giugno (rete approvata) si'.
const vPref = fatt.find(v => /Prefattura/.test(v.titolo));
verifica('prefattura chiesta solo per febbraio e giugno, non per aprile e maggio', vPref && /Febbraio/.test(vPref.titolo) && /Giugno/.test(vPref.titolo) && !/Aprile|Maggio/.test(vPref.titolo), vPref && vPref.titolo);

// Le richieste del consorzio si leggono col loro esito salvato: lo ricalcola sui
// terminati ogni caricamento delle primarie (importaBlocco, ritiri_ect).
const rEct = cruscotto({ oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: [], alertAperti: [], uploadLogs: [], assegnatiRete: [], assegnatiAci: [], documenti: MESI8(), prefatture: MESI8().map(d => ({ anno: 2026, mese: d.mese })), riepilogoQualifica: null,
  richiesteEct: [{ esito: 'da_confermare', scadenza: '2026-09-11', evasione_rilevata_il: '2026-09-10' }, { scadenza: '2026-09-11' }, { scadenza: '2026-09-11', evaso_il: '2026-09-09' }] });
const vEct = rEct.da_gestire.filter(v => v.area === 'Richieste ECT');
// Dal 29/09/2026 una richiesta coi suoi ordini tutti terminati si chiude da sola:
// la voce non dice piu' "aspettano la tua spunta" ma "aspettano la risposta al
// consorzio", che e' la cosa che resta davvero da fare. Le tre righe qui sopra: una
// vecchia 'da_confermare', una aperta e scaduta, una con la data di evasione dal
// foglio del consorzio (che adesso vale evasa).
verifica('ECT: chi e\' stato ritirato non e\' oltre il termine, e resta da rispondere al consorzio',
  vEct.length === 2 && vEct.some(v => v.gravita === 'critico' && v.titolo.startsWith('1 '))
  && vEct.some(v => v.gravita === 'info' && v.titolo.startsWith('2 ') && /risposta al consorzio/.test(v.titolo)),
  vEct.map(v => v.titolo).join(' | '));
// Una richiesta gia' spuntata non torna a chiedere una risposta.
const rEctSpuntata = cruscotto({ oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: [], alertAperti: [], uploadLogs: [], assegnatiRete: [], assegnatiAci: [], documenti: MESI8(), prefatture: MESI8().map(d => ({ anno: 2026, mese: d.mese })), riepilogoQualifica: null,
  richiesteEct: [{ esito: 'evasa', evasione_rilevata_il: '2026-09-10', evasione_confermata: true }] });
verifica('e una gia\' spuntata non chiede piu\' niente', rEctSpuntata.da_gestire.filter(v => v.area === 'Richieste ECT').length === 0);

// Le sedi operative: quando il controllo in rete trova un indirizzo diverso da
// quello dell'anagrafica, il formulario si prepara su un dato di cui non ci si
// fida finche' qualcuno non decide. Le decise e le superate non si contano.
const rSedi = cruscotto({ oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: [], alertAperti: [], uploadLogs: [], assegnatiRete: [], assegnatiAci: [], documenti: MESI8(), prefatture: MESI8().map(d => ({ anno: 2026, mese: d.mese })), riepilogoQualifica: null, richiesteEct: [],
  verificheSedi: [
    { id_pdr: 1, ragione_sociale: 'EUROGOMME SRL', esito: 'diverso', stato: 'da_decidere' },
    { id_pdr: 2, ragione_sociale: 'ALTRA GOMME', esito: 'incerto', stato: 'da_decidere' },
    { id_pdr: 3, ragione_sociale: 'DECISA SRL', esito: 'diverso', stato: 'corretto' },
    { id_pdr: 4, ragione_sociale: 'VECCHIA SRL', esito: 'diverso', stato: 'da_decidere', superata: true },
    { id_pdr: 5, ragione_sociale: 'OK SRL', esito: 'coincide', stato: 'da_decidere' },
  ] });
const vSedi = rSedi.da_gestire.filter(v => v.area === 'Punti di raccolta');
verifica('le sedi da decidere arrivano nel cruscotto, e solo quelle',
  vSedi.length === 1 && /^2 sedi operative da decidere/.test(vSedi[0].titolo) && /EUROGOMME SRL/.test(vSedi[0].dettaglio) && !/DECISA|VECCHIA|OK SRL/.test(vSedi[0].dettaglio),
  JSON.stringify(vSedi));
verifica('e portano alla scheda giusta', vSedi.length === 1 && vSedi[0].link === '/pdr?scheda=sedi');
const rSediOk = cruscotto({ oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: [], alertAperti: [], uploadLogs: [], assegnatiRete: [], assegnatiAci: [], documenti: MESI8(), prefatture: MESI8().map(d => ({ anno: 2026, mese: d.mese })), riepilogoQualifica: null, richiesteEct: [], verificheSedi: [{ id_pdr: 5, esito: 'coincide', stato: 'da_decidere' }] });
verifica('se le sedi coincidono il cruscotto non dice niente', rSediOk.da_gestire.filter(v => v.area === 'Punti di raccolta').length === 0);

verifica('i codici delle regole si leggono come parole, le sigle restano maiuscole', nomeRegola('REGOLA_RITARDO_SLA') === 'Ritardo SLA' && nomeRegola('REGOLA_MIX_CLASSI_CONSORZIALE') === 'Mix classi consorziale' && nomeRegola('Conferimento fuori rotta') === 'Conferimento fuori rotta');

console.log('ELENCO UNICO');
const r = cruscotto({
  oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: ['primarie', 'secondarie', 'terziarie', 'pdr'],
  alertAperti: [{ severita: 'critico', regola_nome: 'Ritardo SLA' }, { severita: 'warning', regola_nome: 'Ritardo SLA' }, { severita: 'info', regola_nome: 'Mix classi' }],
  uploadLogs: logs, assegnatiRete: [{ id_ordine: 'C', ordine_immesso_il: '2025-09-23T22:00:00Z', ragione_sociale: 'Vecchio Srl' }], assegnatiAci: [],
  documenti: docs, prefatture: [{ anno: 2026, mese: 'Luglio' }],
  riepilogoQualifica: { scaduti: 2, non_conformi: 0, in_scadenza: 3, soggetti_critici: [{ nome: 'Alfa Srl' }], anomalie_catalogo: 1, anomalie_catalogo_testo: 'Patenti degli autisti' },
  // Dal 27/09/2026 il target dell'impianto sta solo in Target & Status: due numeri
  // diversi nei vecchi archivi non sono piu' una voce del cruscotto.
  giacenzeSito: [{ sito: 'TECNOGUM SRL', anno: 2026, tipo_destinazione: 'imp', target_totale_t: 2305 }], impiantiTarget: [{ nome_impianto: 'tecnogum', target: 2300000, stato: 'attivo' }],
  richiesteEct: [{ esito: 'aperta', scadenza: '2026-09-11' }, { esito: 'aperta', scadenza: '2026-10-15' }, { esito: 'da_confermare' }, { esito: 'evasa', scadenza: '2026-01-01' }],
});
const titoli = r.da_gestire.map(v => `${v.gravita}:${v.area}`);
verifica('prima i critici', r.da_gestire[0].gravita === 'critico' && r.da_gestire.findIndex(v => v.gravita === 'info') > r.da_gestire.findIndex(v => v.gravita === 'attenzione'), titoli.join(' | '));
verifica('alert critici, caricamento interrotto, qualifica scaduta, ECT oltre il termine', ['Alert', 'Caricamento dati', 'Qualifica fornitori', 'Richieste ECT'].every(a => r.da_gestire.some(v => v.gravita === 'critico' && v.area === a)), titoli.join(' | '));
verifica('nessuna voce sul target divergente: il target si scrive in un posto solo', !r.da_gestire.some(v => v.area === 'Target' || /Target divergente/.test(v.titolo)), titoli.join(' | '));
verifica('dati vecchi (terziarie 25 giorni), mai caricato (pdr), arretrato oltre 60, mesi da elaborare', r.da_gestire.some(v => /[Tt]erziarie: dati di 25 giorni/.test(v.titolo)) && r.da_gestire.some(v => /Mai caricato: (pdr|Punti di raccolta)/.test(v.titolo)) && r.da_gestire.some(v => /Rete: 1 ordini aperti da oltre 60/.test(v.titolo)) && r.da_gestire.some(v => /6 mesi finiti non ancora elaborati/.test(v.titolo)), r.da_gestire.map(v => v.titolo).join(' | '));
verifica('un documento del catalogo intestato a chi non ce, sulla dashboard', r.da_gestire.some(v => v.area === 'Qualifica fornitori' && v.gravita === 'critico' && /non verr. mai chiesto/.test(v.titolo) && v.dettaglio === 'Patenti degli autisti'), r.da_gestire.filter(v => v.area === 'Qualifica fornitori').map(v => v.titolo).join(' | '));
verifica('ogni voce porta dove si risolve', r.da_gestire.every(v => v.link && v.link.startsWith('/')));
verifica('una sola richiesta ECT oltre il termine (quella evasa e quella futura no)', r.da_gestire.find(v => v.area === 'Richieste ECT' && v.gravita === 'critico').titolo.startsWith('1 '));
const pulito = cruscotto({ oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: ['primarie'], alertAperti: [], uploadLogs: [logs[0]], assegnatiRete: [], assegnatiAci: [], documenti: MESI8(), prefatture: MESI8().map(d => ({ anno: 2026, mese: d.mese })), riepilogoQualifica: null, richiesteEct: [] });
verifica('tutto a posto: elenco vuoto', pulito.da_gestire.length === 0, pulito.da_gestire.map(v => v.titolo).join(' | '));

console.log('DATE OBBLIGATORIE (regola del 22/09/2026)');
// Il motore degli alert apre un alert per modulo e canale con quanti ordini
// terminati hanno date obbligatorie mancanti o incoerenti: il cruscotto li legge
// da li', senza rileggere le primarie, e ne fa una voce ciascuno col collegamento.
const alertDate = [
  { severita: 'critico', modulo: 'primarie_rete', canale: 'rete', regola_id: 'date_obbligatorie_rete', regola_nome: 'Ordini terminati con date obbligatorie mancanti o incoerenti', quanti: 3, senza_fine: 1, titolo: 'x' },
  { severita: 'warning', modulo: 'secondarie', canale: 'ACI', regola_id: 'date_obbligatorie_ACI', regola_nome: 'Ordini terminati con date obbligatorie mancanti o incoerenti', quanti: 1, senza_fine: 0, titolo: 'x' },
  { severita: 'warning', modulo: 'extra_raccolta', canale: 'extra', regola_id: 'date_obbligatorie_extra', regola_nome: 'Ordini terminati con date obbligatorie mancanti o incoerenti', titolo: 'Extra raccolta: ordini con date da sistemare' },
  { severita: 'warning', modulo: 'primarie_rete', regola_id: 'r1', regola_nome: 'Ritardo SLA' },
];
const rd = cruscotto({ oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: [], alertAperti: alertDate, uploadLogs: [], assegnatiRete: [], assegnatiAci: [], documenti: MESI8(), prefatture: MESI8().map(d => ({ anno: 2026, mese: d.mese })), riepilogoQualifica: null, richiesteEct: [] });
const vDate = rd.da_gestire.filter(v => v.area === 'Date obbligatorie');
const vRete = vDate.find(v => v.link === '/primarie-rete');
const vSec = vDate.find(v => v.link === '/secondarie');
const vExtra = vDate.find(v => v.link === '/extra-raccolta');
verifica('una voce per modulo e canale, col collegamento al modulo', vDate.length === 3 && vRete && vSec && vExtra, vDate.map(v => `${v.titolo} -> ${v.link}`).join(' | '));
verifica('rete: critica, 3 ordini, dice il senza fine trasporto', vRete.gravita === 'critico' && /^Primarie rete: 3 ordini terminati con date obbligatorie/.test(vRete.titolo) && /Di cui 1 senza fine trasporto/.test(vRete.dettaglio), JSON.stringify(vRete));
verifica('secondarie ACI: da guardare, col canale nel titolo', vSec.gravita === 'attenzione' && /^Secondarie · ACI: 1 ordine terminato/.test(vSec.titolo), JSON.stringify(vSec));
verifica('un alert senza conteggi si dice col suo titolo; l\'extra si corregge nella scheda', vExtra.titolo === 'Extra raccolta: ordini con date da sistemare' && /nella scheda/.test(vExtra.dettaglio), JSON.stringify(vExtra));
const vAlert = rd.da_gestire.filter(v => v.area === 'Alert');
verifica('la voce generica degli alert non li conta due volte: resta il ritardo SLA', vAlert.length === 1 && vAlert[0].titolo === 'Un alert aperto' && /Ritardo SLA \(1\)/.test(vAlert[0].dettaglio) && rd.alert.totale === 4, vAlert.map(v => `${v.titolo} [${v.dettaglio}]`).join(' | '));

console.log('DICHIARAZIONI RICONOSCIUTE A PORTALE');
// Rete e ACI caricate lo stesso giorno, a mezzanotte italiana (22:00Z del giorno prima)
const righePortale = [
  { data_dichiarazione: '2026-06-10T00:00:00Z', destinazione: 'GATIM SRL', prodotto: 'G1 - pneumatici', peso_associato_kg: 71710, granulo_kg: 100 },
  { data_dichiarazione: '2026-06-09T22:00:00Z', destinazione: 'GATIM SRL', prodotto: '.class9 PFU Autodemolizione', peso_associato_kg: 7770 },
];
const cRete = caricamentiPortale(righePortale, 2026, 'RETE').get('GATIM SRL');
const cAci = caricamentiPortale(righePortale, 2026, 'ACI').get('GATIM SRL');
verifica('caricamenti separati per canale, sul giorno italiano', cRete.length === 1 && cRete[0].kg === 71710 && cAci.length === 1 && cAci[0].kg === 7770 && cAci[0].data === '2026-06-10', JSON.stringify({ cRete, cAci }));
const svcFinto = (scritte) => ({ DichiarazioneSito: { update: async (id, campi) => { scritte.push({ id, ...campi }); } } });
let scritte = [];
let esito = await allineaDalPortale(svcFinto(scritte), 2026, righePortale, [
  { id: 'r5', sito: 'Gatim Srl', canale: 'RETE', mese: 'Maggio', quantita_kg: 71710 },
  { id: 'a5', sito: 'Gatim Srl', canale: 'ACI', mese: 'Maggio', quantita_kg: 7770 },
]);
// L'ACI SI RICONOSCE MA NON SI SCRIVE (regola dell'utente, 02/10/2026).
//
// Il confronto con il portale resta su tutti e due i canali, perche' serve a
// DIRE quali mesi il portale conosce. La scrittura no: fra i campi che si
// salvano ci sono i materiali, e sull'ACI quelli li trascrive l'amministratore
// dalle dichiarazioni cartacee che gli impianti mandano via email - «non c'e'
// altro modo che sia io ad inserirli manualmente». Riscriverli coi numeri del
// portale sarebbe una perdita, non un doppione.
verifica("maggio: la rete si scrive, l'ACI si riconosce e si lascia stare",
  esito.aggiornate.length === 1 && esito.aggiornate[0].canale === 'RETE'
  && esito.arretrato.length === 0 && esito.non_trovate.length === 0
  && scritte.length === 1 && scritte[0].caricata_il === '2026-06-10', JSON.stringify(esito));

// L'ACI si dichiara per provenienza: Gatim aprile, primaria 8.200 e secondaria
// 14.340, caricate lo stesso giorno (22.540 kg). La riga del report che e'
// arrivata da uno stoccaggio porta la destinazione secondaria.
const aprileAci = [
  { data_dichiarazione: '2026-05-12T08:00:00Z', destinazione: 'GATIM SRL', prodotto: '.class9 PFU Autodemolizione', peso_associato_kg: 8200, granulo_kg: 8000 },
  { data_dichiarazione: '2026-05-12T08:00:00Z', destinazione: 'NAPPI SUD SRL', destinazione_secondaria: 'GATIM SRL', prodotto: '.class9 PFU Autodemolizione', peso_associato_kg: 14340, granulo_kg: 14000 },
];
const nostreAprile = () => [
  { id: 'ap', sito: 'Gatim Srl', canale: 'ACI', provenienza: 'primaria', mese: 'Aprile', quantita_kg: 8200 },
  { id: 'as', sito: 'Gatim Srl', canale: 'ACI', provenienza: 'secondaria', mese: 'Aprile', quantita_kg: 14340 },
];
scritte = [];
esito = await allineaDalPortale(svcFinto(scritte), 2026, aprileAci, nostreAprile());
verifica('ACI per provenienza: riconosciute senza arretrato, e nessuna riscritta',
  esito.aggiornate.length === 0 && esito.non_trovate.length === 0 && esito.arretrato.length === 0
  && scritte.length === 0, JSON.stringify({ esito, scritte }));
// Se il portale non distingue come noi (tutto senza destinazione secondaria), il
// mese si riconosce sommando le due provenienze, e i materiali si dividono in
// proporzione ai chili.
scritte = [];
esito = await allineaDalPortale(svcFinto(scritte), 2026, aprileAci.map(r => ({ ...r, destinazione: 'GATIM SRL', destinazione_secondaria: '' })), nostreAprile());
const ap = scritte.find(s => s.id === 'ap'), as = scritte.find(s => s.id === 'as');
verifica('ACI classificata diversamente dal portale: si riconosce, e i materiali restano quelli scritti a mano',
  esito.aggiornate.length === 0 && esito.arretrato.length === 0 && scritte.length === 0, JSON.stringify({ esito, scritte }));
// E se un domani si volesse l'ACI, lo si deve chiedere per nome: allora si
// riconosce sulla somma del mese e i materiali si dividono in proporzione ai
// chili, che e' il comportamento costruito il 29/09/2026 e che resta li'.
scritte = [];
esito = await allineaDalPortale(svcFinto(scritte), 2026, aprileAci.map(r => ({ ...r, destinazione: 'GATIM SRL', destinazione_secondaria: '' })), nostreAprile(), ['RETE', 'ACI']);
{
  const ap = scritte.find(s => s.id === 'ap'), as = scritte.find(s => s.id === 'as');
  verifica("chiedendolo per nome, l'ACI si allinea come prima",
    esito.aggiornate.length === 2 && ap && as && ap.caricata_il === '2026-05-12'
    && ap.granulo_kg + as.granulo_kg === 22000 && ap.granulo_kg === Math.round(22000 * 8200 / 22540),
    JSON.stringify({ esito, scritte }));
}

// === UNA DICHIARAZIONE CHE IL PORTALE HA E IL GESTIONALE NO ===
//
// Il 01/10/2026 l'utente ha dichiarato a portale il quantitativo di agosto
// raccolto da Green Tyre Project e il gestionale non se n'e' accorto: senza una
// nostra riga mensile con lo stesso peso non c'era niente da agganciare, e quel
// caricamento finiva fra "l'arretrato dell'anno prima" - una motivazione falsa -
// che la pagina non mostrava affatto. Ora si guarda di che mese sono gli ordini
// che il caricamento chiude.
console.log('UNA DICHIARAZIONE CHE IL PORTALE HA E IL GESTIONALE NO');
const gtp = [
  { data_dichiarazione: '2026-10-01T08:00:00Z', fine_trasporto: '2026-08-12T10:00:00Z', destinazione: 'GREEN TYRE PROJECT SRL', prodotto: 'G1 - pneumatici', peso_associato_kg: 18400, granulo_kg: 15000 },
  { data_dichiarazione: '2026-10-01T08:00:00Z', fine_trasporto: '2026-08-27T10:00:00Z', destinazione: 'GREEN TYRE PROJECT SRL', prodotto: 'G1 - pneumatici', peso_associato_kg: 6200, granulo_kg: 5000 },
];
{
  const e = confrontaConIlPortale(gtp, 2026, []);
  verifica('non e\' piu\' arretrato: e\' una dichiarazione da inserire', e.arretrato.length === 0 && e.da_inserire.length === 1, JSON.stringify(e));
  const v = e.da_inserire[0];
  verifica('col sito, il canale, i chili e il giorno del caricamento', v.sito === 'GREEN TYRE PROJECT SRL' && v.canale === 'RETE'
    && v.kg === 24600 && v.quanti === 1 && v.caricamenti[0].data === '2026-10-01', JSON.stringify(v));
  verifica('e DI CHE MESE sono gli ordini che chiude: agosto, tutti', v.mesi.length === 1 && v.mesi[0].mese === '2026-08' && v.mesi[0].kg === 24600, JSON.stringify(v.mesi));
  verifica('dicendo perche\' non si e\' trovato', /nessuna dichiarazione di rete di questo impianto/.test(v.motivo), v.motivo);
}
{
  // Con la nostra riga di agosto giusta si aggancia e non resta niente da inserire.
  const e = confrontaConIlPortale(gtp, 2026, [{ id: 'g8', sito: 'Green Tyre Project srl', canale: 'RETE', mese: 'Agosto', quantita_kg: 24600 }]);
  verifica('con la nostra riga di agosto si aggancia', e.trovati.length === 1 && e.da_inserire.length === 0 && e.arretrato.length === 0
    && e.trovati[0].caricata_il === '2026-10-01' && e.trovati[0].materiali.granulo_kg === 20000, JSON.stringify(e));
}
{
  // Un caricamento che chiude ordini dell'anno prima e' arretrato per davvero.
  const vecchio = gtp.map(r => ({ ...r, fine_trasporto: '2025-11-20T10:00:00Z' }));
  const e = confrontaConIlPortale(vecchio, 2026, []);
  verifica('l\'arretrato vero resta arretrato', e.da_inserire.length === 0 && e.arretrato.length === 1
    && /ordini degli anni precedenti/.test(e.arretrato[0].motivo), JSON.stringify(e.arretrato));
}
{
  // Un caricamento di un impianto che ha altre dichiarazioni ma nessuna con
  // quel peso: anche quello e' da inserire, non arretrato.
  const e = confrontaConIlPortale(gtp, 2026, [{ id: 'g7', sito: 'Green Tyre Project srl', canale: 'RETE', mese: 'Luglio', quantita_kg: 9000 }]);
  verifica('nessun nostro mese con quel peso: da inserire, non arretrato', e.da_inserire.length === 1 && e.arretrato.length === 0
    && /nessun nostro mese ha questo peso/.test(e.da_inserire[0].motivo), JSON.stringify(e.da_inserire));
  verifica('e il nostro luglio resta fra i mesi non trovati a portale', e.non_trovate.length === 1 && e.non_trovate[0].mese === 'Luglio', JSON.stringify(e.non_trovate));
}
{
  // I mesi degli ordini chiusi si tengono anche unendo i caricamenti dello
  // stesso giorno (ACI, dove le provenienze si sommano).
  const c = caricamentiPortale(gtp, 2026, 'RETE').get('GREEN TYRE PROJECT SRL');
  verifica('un caricamento porta i mesi dei suoi ordini e la provenienza', c.length === 1 && c[0].mesi.length === 1
    && c[0].mesi[0].mese === '2026-08' && c[0].provenienze.join() === 'primaria', JSON.stringify(c));
}

function MESI8() { return ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto'].map(m => ({ tipo: 'ATTIVA', anno: 2026, mese: m, stato: 'chiusa' })); }

// CHI NON DICE NIENTE ALLINEA SOLO LA RETE.
//
// La libreria lo faceva gia', ma la funzione allineaDichiarazioni ribaltava quel
// valore - rete E ACI - e il caricamento dei dati la chiama senza dire niente
// (src/lib/importGrandeFile.js, passo 'allineaDichiarazioni'). Cosi' ogni
// caricamento riscriveva l'ACI coi numeri del portale e cancellava i materiali
// trascritti a mano dalle dichiarazioni cartacee. Trovato dall'audit del
// 03/10/2026, da due revisori per conto loro.
// LA DICHIARAZIONE DI DICEMBRE SI CARICA A GENNAIO.
//
// Difetto alta dell'audit del 03/10/2026. L'anno di una riga del report si
// prendeva dal giorno del CARICAMENTO: chiedendo il 2026 la riga del 07/01/2027
// veniva scartata, e chiedendo il 2027 non trovava nessuna nostra riga, perche'
// le nostre dichiarazioni di dicembre sono dell'anno 2026. Non si agganciava in
// nessuno dei due anni e dicembre restava «da dichiarare» per sempre, senza un
// avviso da nessuna parte. Il periodo di un movimento e' la fine del trasporto
// (regola 1), e vale anche qui.
console.log('LA DICHIARAZIONE DI DICEMBRE CARICATA A GENNAIO');
const dicembre = [
  { data_dichiarazione: '2027-01-07T09:00:00Z', fine_trasporto: '2026-12-18T00:00:00Z', destinazione: 'GREEN TYRE PROJECT SRL', prodotto: 'G1 - pneumatici', peso_associato_kg: 80000 },
];
const cDic = caricamentiPortale(dicembre, 2026, 'RETE').get('GREEN TYRE PROJECT SRL');
verifica('il caricamento di gennaio sta nell\'anno degli ordini che chiude',
  !!cDic && cDic.length === 1 && cDic[0].kg === 80000, JSON.stringify(cDic));
verifica('ma il giorno resta quello vero del caricamento, che e\' la data da scrivere',
  !!cDic && !!cDic[0] && cDic[0].data === '2027-01-07', JSON.stringify(cDic));
// Nel 2027 la stessa riga si vede ancora - il caricamento e' di gennaio 2027 -
// ma li' e' arretrato, perche' per il 2027 chiude ordini dell'anno prima: e'
// esattamente quello che deve dire, invece di cercare un mese del 2027 che non
// esiste.
verifica('nel 2027 la stessa riga c\'e\', ma come arretrato',
  confrontaConIlPortale(dicembre, 2027, []).arretrato.length === 1
  && confrontaConIlPortale(dicembre, 2027, []).da_inserire.length === 0,
  JSON.stringify(confrontaConIlPortale(dicembre, 2027, [])));
scritte = [];
esito = await allineaDalPortale(svcFinto(scritte), 2026, dicembre, [
  { id: 'dic', sito: 'Green Tyre Project Srl', canale: 'RETE', mese: 'Dicembre', quantita_kg: 80000 },
]);
verifica('cosi\' dicembre si aggancia, e si segna caricata il 07/01/2027',
  esito.aggiornate.length === 1 && scritte.length === 1 && scritte[0].id === 'dic' && scritte[0].caricata_il === '2027-01-07',
  JSON.stringify({ esito, scritte }));
verifica('e non resta ne\' fra le non trovate ne\' fra l\'arretrato',
  esito.non_trovate.length === 0 && esito.arretrato.length === 0, JSON.stringify(esito));
// Senza fine trasporto l'unica data e' quella del caricamento, e si usa quella.
verifica('una riga senza fine trasporto resta nell\'anno in cui e\' stata caricata',
  caricamentiPortale([{ data_dichiarazione: '2026-06-10T00:00:00Z', destinazione: 'GATIM SRL', prodotto: 'G1', peso_associato_kg: 1000 }], 2026, 'RETE').size === 1
  && caricamentiPortale([{ data_dichiarazione: '2026-06-10T00:00:00Z', destinazione: 'GATIM SRL', prodotto: 'G1', peso_associato_kg: 1000 }], 2027, 'RETE').size === 0);

console.log('CANALI CHE SI SCRIVONO');
verifica('senza indicazione si scrive solo la rete',
  canaliDaScrivere(undefined).join() === 'RETE' && canaliDaScrivere(null).join() === 'RETE' && canaliDaScrivere([]).join() === 'RETE');
verifica("l'ACI si scrive solo chiedendolo per nome",
  canaliDaScrivere(['ACI']).join() === 'ACI' && canaliDaScrivere(['RETE', 'ACI']).join() === 'RETE,ACI');
verifica('un canale che non esiste non apre la scrittura a niente',
  canaliDaScrivere(['EXTRA_RACCOLTA']).join() === 'RETE' && canaliDaScrivere(['ACI', 'EXTRA_RACCOLTA']).join() === 'ACI');
verifica('un valore che non e\' un elenco vale come niente detto',
  canaliDaScrivere('ACI').join() === 'RETE' && canaliDaScrivere({ ACI: true }).join() === 'RETE');

console.log('L ANNO NUOVO COMPARE DUE MESI PRIMA, E NON PRIMA');
{
  // Il contratto e' annuale senza tacito rinnovo: dal 1° gennaio una riga
  // senza tariffa vale zero euro. La scheda che lo dice esiste, ma una scheda
  // che nessuno apre non serve: da due mesi prima la cosa compare qui, dove si
  // guarda ogni mattina. Un avviso che sta li' tutto l'anno invece e' arredamento.
  const base = { oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: [], alertAperti: [], uploadLogs: [],
    assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], riepilogoQualifica: null, richiesteEct: [] };
  const an = (p) => ({ anno: 2027, mancanti: 2, parziali: 1, giorni_al_primo_gennaio: 40, avvicinandosi: true,
    voci: [{ titolo: 'Tariffe verso Ecotyre', stato: 'manca' }, { titolo: 'Contratto Ecotyre', stato: 'manca' }, { titolo: 'Target e siti', stato: 'pronto' }], ...p });
  const vociDi = (annoNuovo) => cruscotto({ ...base, annoNuovo }).da_gestire.filter(v => v.area === 'Nuovo anno');
  const v = vociDi(an({}))[0];
  verifica('a quaranta giorni la voce c e', !!v, 'nessuna voce');
  verifica('e dice che cosa manca e che cosa va confermato', v && /2 cose mancano, 1 e da confermare/.test(v.titolo.replace('è','e')), v && v.titolo);
  verifica('con i giorni che restano e le voci aperte', v && /40 giorni al 1° gennaio/.test(v.dettaglio) && /Tariffe verso Ecotyre/.test(v.dettaglio) && !/Target e siti/.test(v.dettaglio), v && v.dettaglio);
  verifica('e porta dritto alla scheda, sull\'anno giusto', v && v.link === '/target-status?tab=nuovo-anno&anno=2026', v && v.link);
  verifica('prima della finestra non si dice niente', vociDi(an({ avvicinandosi: false })).length === 0);
  verifica('senza l anno nuovo nemmeno', cruscotto(base).da_gestire.filter(x => x.area === 'Nuovo anno').length === 0);
  // A gennaio con qualcosa ancora mancante non e' piu' un promemoria: e' un guaio.
  const gen = vociDi(an({ giorni_al_primo_gennaio: -9 }))[0];
  verifica('ad anno cominciato con qualcosa che manca diventa critico', gen && gen.gravita === 'critico', gen && gen.gravita);
  verifica('e lo dice con le parole giuste', gen && /gia' cominciato/.test(gen.dettaglio), gen && gen.dettaglio);
  verifica('se manca solo una conferma resta un avviso, non un guaio',
    (vociDi(an({ giorni_al_primo_gennaio: -9, mancanti: 0 }))[0] || {}).gravita === 'attenzione');
}
console.log('I MESI DELL\'ATTIVA A GENNAIO E FEBBRAIO (chiusura dell\'audit, 11/10/2026)');
{
  // L'ultimo mese finito si contava sull'anno in corso: il 15/01/2027 l'elenco
  // era vuoto, il 10/02/2027 c'era solo gennaio. Dicembre 2026, e un novembre
  // ancora aperto, sparivano dalla dashboard proprio quando vanno chiusi.
  const chiusi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre']
    .flatMap(m => ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => ({ tipo: 'ATTIVA', anno: 2026, mese: m, tipologia: t, stato: 'chiusa' })));
  const novembre = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => ({ tipo: 'ATTIVA', anno: 2026, mese: 'Novembre', tipologia: t, stato: 'elaborata' }));
  const docs2026 = [...chiusi, ...novembre];
  const gen = statoMesiAttiva(docs2026, [], 2027, '2027-01-15');
  verifica('il 15/01/2027 ci sono novembre e dicembre 2026, non ancora chiusi', gen.map(m => m.etichetta || m.mese).join(',') === 'Novembre 2026,Dicembre 2026', gen.map(m => m.etichetta || m.mese).join(','));
  verifica('ciascuno col suo anno', gen.length === 2 && gen.every(m => m.anno === 2026) && gen[1].elaborato === false && gen[0].elaborato === true && gen[0].chiuso === false, JSON.stringify(gen.map(m => [m.anno, m.mese, m.elaborato, m.chiuso])));
  const feb = statoMesiAttiva([...docs2026, ...['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => ({ tipo: 'ATTIVA', anno: 2027, mese: 'Gennaio', tipologia: t, stato: 'elaborata' }))], [], 2027, '2027-02-10');
  // Con mesi di due anni ogni mese porta il suo anno (prova del cambio d'anno,
  // 15/10/2026, difetto 37): prima gennaio 2027 era «Gennaio».
  verifica('il 10/02/2027: novembre e dicembre 2026, e gennaio 2027', feb.map(m => m.etichetta || m.mese).join(',') === 'Novembre 2026,Dicembre 2026,Gennaio 2027', feb.map(m => m.etichetta || m.mese).join(','));
  // DA MARZO SPARIVANO DI NUOVO (revisione della chiusura, 11/10/2026): la
  // correzione valeva solo per gennaio e febbraio, e un dicembre mai elaborato
  // non diventa a posto perche' e' cominciato marzo. Restano finche' non si chiudono.
  const mar = statoMesiAttiva(docs2026, [], 2027, '2027-03-10');
  verifica('il 10/03/2027 novembre e dicembre 2026, mai chiusi, ci sono ancora', mar.map(m => m.etichetta || m.mese).join(',') === 'Novembre 2026,Dicembre 2026,Gennaio 2027,Febbraio 2027', mar.map(m => m.etichetta || m.mese).join(','));
  const ott = statoMesiAttiva(docs2026, [], 2027, '2027-10-11');
  verifica('e anche a ottobre 2027, finche\' qualcuno non li chiude', ott.slice(0, 2).map(m => m.etichetta).join(',') === 'Novembre 2026,Dicembre 2026' && ott.length === 2 + 9, ott.map(m => m.etichetta || m.mese).join(','));
  const tuttiChiusi = [...chiusi, ...['Novembre', 'Dicembre'].flatMap(m => ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => ({ tipo: 'ATTIVA', anno: 2026, mese: m, tipologia: t, stato: 'chiusa' })))];
  const marChiuso = statoMesiAttiva(tuttiChiusi, [], 2027, '2027-03-10');
  verifica('chiusi tutti, del 2026 non resta niente da dire', marChiuso.map(m => m.etichetta || m.mese).join(',') === 'Gennaio,Febbraio', marChiuso.map(m => m.etichetta || m.mese).join(','));
  // L'anno prima senza documenti: i mesi fatturati prima che il gestionale
  // esistesse non si sono mai elaborati qui, e non c'e' niente da chiudere.
  // E' il caso di oggi: dal 2026 si guarda anche il 2025.
  const oggi2026 = statoMesiAttiva(chiusi, [], 2026, '2026-10-11');
  verifica('un anno prima senza documenti non si guarda: oggi solo i mesi del 2026', oggi2026.every(m => m.anno === 2026) && oggi2026.length === 9, oggi2026.map(m => m.etichetta || m.mese).join(','));
  // Si parte dal primo mese dell'anno prima con un documento.
  const daGiugno = ['Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre'].flatMap(m => ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => ({ tipo: 'ATTIVA', anno: 2025, mese: m, tipologia: t, stato: 'chiusa' })));
  const dalPrimo = statoMesiAttiva([...daGiugno, ...chiusi], [], 2026, '2026-10-11');
  verifica('un anno prima cominciato a giugno: si dice solo dicembre, non gennaio-maggio', dalPrimo.filter(m => m.anno === 2025).map(m => m.etichetta).join(',') === 'Dicembre 2025', dalPrimo.map(m => m.etichetta || m.mese).join(','));
  const visto2026 = statoMesiAttiva(docs2026, [], 2026, '2027-01-15');
  verifica('chi guarda il 2026 a gennaio 2027 vede i suoi dodici mesi, come prima', visto2026.length === 12 && visto2026.every(m => (m.etichetta || m.mese) === m.mese), visto2026.map(m => m.etichetta || m.mese).join(','));
  verifica('i documenti da leggere: per l\'anno in corso anche quelli dell\'anno prima, in qualunque mese',
    C.anniMesiAttiva && JSON.stringify(C.anniMesiAttiva(2027, '2027-01-15')) === '[2026,2027]' && JSON.stringify(C.anniMesiAttiva(2027, '2027-02-28')) === '[2026,2027]'
    && JSON.stringify(C.anniMesiAttiva(2027, '2027-03-01')) === '[2026,2027]' && JSON.stringify(C.anniMesiAttiva(2026, '2027-01-15')) === '[2026]' && JSON.stringify(C.anniMesiAttiva(2026, '2026-10-11')) === '[2025,2026]');
  // Le prefatture dell'anno prima portano le righe del portale: si leggono solo
  // se un suo documento puo' ancora chiederle (elaborato e non chiuso).
  verifica('le prefatture dell\'anno prima servono con un suo documento aperto', C.servonoPrefattureAnnoPrima && C.servonoPrefattureAnnoPrima(docs2026, 2027, '2027-03-10') === true);
  verifica('e non servono con tutto chiuso, senza documenti, o guardando un anno passato',
    C.servonoPrefattureAnnoPrima && C.servonoPrefattureAnnoPrima(tuttiChiusi, 2027, '2027-03-10') === false && C.servonoPrefattureAnnoPrima([], 2027, '2027-03-10') === false
    && C.servonoPrefattureAnnoPrima(docs2026, 2026, '2027-03-10') === false);
  // Il caso dello scenario della revisione, sulla dashboard intera: il 01/03/2027.
  const r1m = cruscotto({ oggi: '2027-03-01', anno: 2027, adessoMs: Date.parse('2027-03-01T08:00:00Z'), tipiFile: [], uploadLogs: [], alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [...docs2026, ...['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => ({ tipo: 'ATTIVA', anno: 2027, mese: 'Gennaio', tipologia: t, stato: 'elaborata' }))], prefatture: [], richiesteEct: [] });
  const v1m = r1m.da_gestire.find(v => /non ancora elaborat/.test(v.titolo));
  verifica('il 01/03/2027 la dashboard dice ancora «Dicembre 2026» da elaborare', r1m.mesi_attiva.map(m => m.etichetta).join(',') === 'Novembre 2026,Dicembre 2026,Gennaio 2027,Febbraio 2027' && v1m && /Dicembre 2026/.test(v1m.dettaglio), r1m.da_gestire.map(v => `${v.titolo} [${v.dettaglio}]`).join(' | '));
  const p1m = r1m.da_gestire.find(v => /Prefattura Ecotyre non caricata/.test(v.titolo));
  verifica('e la prefattura di novembre 2026 ancora da caricare', p1m && /Novembre 2026/.test(p1m.titolo), p1m && p1m.titolo);
  const r = cruscotto({ oggi: '2027-01-15', anno: 2027, adessoMs: Date.parse('2027-01-15T08:00:00Z'), tipiFile: [], uploadLogs: [], alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: docs2026, prefatture: [], richiesteEct: [] });
  const vMesi = r.da_gestire.find(v => /mese finito non ancora elaborato/.test(v.titolo));
  verifica('e la dashboard lo dice: «Dicembre 2026» da elaborare', vMesi && vMesi.dettaglio === 'Dicembre 2026', r.da_gestire.map(v => `${v.titolo} [${v.dettaglio}]`).join(' | '));
  const vPref = r.da_gestire.find(v => /Prefattura Ecotyre non caricata/.test(v.titolo));
  verifica('con la prefattura di novembre 2026 ancora da caricare', vPref && /Novembre 2026/.test(vPref.titolo), vPref && vPref.titolo);
}

console.log('IL DOPPIONE DICE QUELLO CHE FANNO I DUE MODULI (revisione della chiusura, 11/10/2026)');
{
  // Dall'11/10/2026 Giacenze e Dichiarazioni leggono le dichiarazioni con
  // leggiDichiarazioni e di due gemelle contano la prima. La voce diceva ancora
  // che il riepilogo ne teneva una e le giacenze le sommavano.
  const fotografiaGiorno = { giorno: '2026-10-11', scostamenti: [], doppioni: [{ sito: 'Irigom', mese: 'Marzo', canale: 'RETE', kg_in_piu: 370000 }] };
  const r = cruscotto({ oggi: '2026-10-11', anno: 2026, adessoMs: Date.parse('2026-10-11T08:00:00Z'), tipiFile: [], uploadLogs: [], alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], richiesteEct: [], fotografiaGiorno });
  const v = r.da_gestire.find(x => x.area === 'Dichiarazioni');
  verifica('la voce dice che i due moduli contano la prima riga', v && /Giacenze e Dichiarazioni contano la prima riga e ignorano le altre/.test(v.dettaglio) && /370\.000 kg di troppo, nelle righe ignorate/.test(v.dettaglio), v && v.dettaglio);
  verifica('e non dice piu\' che le giacenze le sommano', v && !/le sommano/.test(v.dettaglio) && !/di troppo nelle giacenze/.test(v.dettaglio), v && v.dettaglio);
}

console.log('IL SURPLUS DELL\'ANNO PRIMA E\' FINITO (decisioni dell\'utente del 13/10/2026)');
{
  // Il Fuel Surcharge del consorzio vale dal 01/10/2026 al 31/12/2026, un record
  // per canale. I contratti sono annuali: non si copia da solo nel 2027, e se il
  // consorzio lo rinnova la dashboard lo deve ricordare dal 01/01/2027, finche'
  // non e' riscritto con lo stesso nome.
  const J = (x) => JSON.stringify(x);
  const vsf = typeof C.vociSurplusFiniti === 'function' ? C.vociSurplusFiniti : () => [{ manca: 'vociSurplusFiniti' }];
  const fuel = (tipologia, p = {}) => ({ id: `fs-${tipologia}`, gruppo: 'fs', nome: 'Fuel Surcharge', origine: 'CONSORZIO', riferimento: 'comunicazione del consorzio', tipologia, prestazione: 'RACCOLTA', a_chi: 'tutti',
    euro_t_passiva: 5, euro_t_attiva: 5, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo', ...p });
  const FUEL = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(c => fuel(c));
  verifica('nel 2026, mentre vale e il 31/12, niente', vsf(FUEL, '2026-10-13').length === 0 && vsf(FUEL, '2026-12-31').length === 0, J(vsf(FUEL, '2026-12-31')));
  const v = vsf(FUEL, '2027-01-01');
  verifica('il 01/01/2027 una voce sola per i tre canali, col titolo che dice nome, anno e fine', v.length === 1 && v[0].titolo === 'Fuel Surcharge del 2026: finito il 31/12/2026', J(v));
  verifica('il dettaglio: chi, quando, su quali canali, e che cosa fare se il consorzio lo rinnova', String((v[0] || {}).dettaglio || '').startsWith('Fuel Surcharge (consorzio Ecotyre), dal 01/10/2026 al 31/12/2026, valeva su rete, ACI ed extra raccolta. Nel 2027 non c\'è: se il consorzio lo rinnova, va riscritto con le date nuove nella linguetta «Surplus» delle tariffe.'), v[0] && v[0].dettaglio);
  verifica('porta alla linguetta dei surplus, nella sezione della fatturazione, come informazione', v[0] && v[0].link === '/fatturazione?tab=tariffe&sezione=surplus' && v[0].sezione === 'fatturazione' && v[0].gravita === 'info' && v[0].area === 'Surplus sulle tariffe' && v[0].chiave === 'surplus-finito:fuel surcharge|2026', J(v[0]));
  verifica('nessun importo nella voce: l\'elenco lo vede chiunque', v.length === 1 && !!v[0].dettaglio && !/€|5,00|\b5\b/.test(`${v[0].titolo} ${v[0].dettaglio}`), v[0] && v[0].dettaglio);
  verifica('resta finche\' non e\' riscritto: a giugno 2027 c\'e\' ancora', vsf(FUEL, '2027-06-15').length === 1);
  const rinnovato = [...FUEL, fuel('RETE', { id: 'fs27', nome: 'FUEL SURCHARGE', data_inizio_validita: '2027-01-01', data_fine_validita: '2027-03-31' })];
  verifica('riscritto per il 2027 con lo stesso nome (maiuscole e spazi non contano), anche su un canale solo: sparisce', vsf(rinnovato, '2027-01-10').length === 0, J(vsf(rinnovato, '2027-01-10')));
  const inArrivo = [...FUEL, fuel('ACI', { id: 'fs27b', data_inizio_validita: '2027-04-01', data_fine_validita: '2027-06-30' })];
  verifica('anche se nel 2027 comincia piu\' tardi: e\' scritto, e la voce non serve', vsf(inArrivo, '2027-01-10').length === 0);
  const altroNome = [...FUEL, fuel('RETE', { id: 'x27', nome: 'Contributo straordinario', data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31' })];
  verifica('un surplus del 2027 con un altro nome non lo sostituisce', vsf(altroNome, '2027-01-10').length === 1);
  const disattivatoNel27 = [...FUEL, fuel('RETE', { id: 'fs27c', data_inizio_validita: '2027-01-01', data_fine_validita: '2027-03-31', stato: 'non_attivo' })];
  verifica('uno del 2027 disattivato non conta come riscritto', vsf(disattivatoNel27, '2027-01-10').length === 1);
  verifica('quelli disattivati del 2026 non si ricordano', vsf(FUEL.map(s => ({ ...s, stato: 'non_attivo' })), '2027-01-10').length === 0);
  verifica('il 2028 non ricorda il surplus del 2026', vsf(FUEL, '2028-01-10').length === 0);
  // Un accordo commerciale pagato solo da SMOCO e' un costo riservato in ogni
  // campo (campoRiservato): il suo nome non finisce nell'elenco di tutti.
  const accordo = fuel('RETE', { id: 'acc', nome: 'Accordo Gatim', origine: 'ACCORDO_COMMERCIALE', euro_t_attiva: null, data_inizio_validita: '2026-07-01', data_fine_validita: '2026-09-30' });
  verifica('un accordo pagato solo da SMOCO non si dice a tutti', vsf([accordo], '2027-01-10').length === 0);
  const accordoAttivo = vsf([{ ...accordo, euro_t_attiva: 2 }], '2027-01-10');
  verifica('un accordo con l\'importo da Ecotyre si ricorda, con le sue parole', accordoAttivo.length === 1 && /Accordo Gatim \(accordo commerciale\), dal 01\/07\/2026 al 30\/09\/2026, valeva su rete\./.test(String(accordoAttivo[0].dettaglio || '')) && /se l'accordo si rinnova/.test(String(accordoAttivo[0].dettaglio || '')), J(accordoAttivo));
  verifica('due canali si dicono «rete e ACI»', (vsf(FUEL.slice(0, 2), '2027-01-10')[0] || {}).dettaglio?.includes('valeva su rete e ACI.'), J(vsf(FUEL.slice(0, 2), '2027-01-10')));
  verifica('senza surplus o senza giorno, niente', vsf(null, '2027-01-10').length === 0 && vsf(FUEL, '').length === 0);
  // Nella dashboard intera: c'e' coi surplus letti, non c'e' senza.
  const base = { oggi: '2027-01-04', anno: 2027, adessoMs: Date.parse('2027-01-04T08:00:00Z'), tipiFile: [], uploadLogs: [], alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], richiesteEct: [] };
  const conS = cruscotto({ ...base, surplus: FUEL }).da_gestire.find(x => x.area === 'Surplus sulle tariffe');
  verifica('in «Da gestire» il 04/01/2027, nella sezione della fatturazione', !!conS && conS.sezione === 'fatturazione' && conS.titolo === 'Fuel Surcharge del 2026: finito il 31/12/2026', J(conS));
  verifica('senza i surplus letti la voce non c\'e\'', !cruscotto(base).da_gestire.some(x => x.area === 'Surplus sulle tariffe'));
}

// LA FUNZIONE DELLA DASHBOARD E LE DUE VOCI DEL 13-14/10/2026 (chiusura del giro,
// 14/10/2026). cruscottoOperativo non leggeva SurplusTariffa e non passava i
// surplus: il promemoria del Fuel Surcharge finito non sarebbe uscito mai. E i
// target annui dei raccoglitori che non fanno il contratto (le 100 t di ottobre in
// Puglia scritte solo nel target di SMOCO, richiesta dell'utente del 14/10/2026)
// li diceva solo la scheda dei raccoglitori. Qui la regola e poi la funzione vera
// sul banco, chiamata da chi non e' amministratore.
const { caricaFunzione, chiama } = await import('./dati/bancoFunzioni.mjs');
const funzioneCruscotto = await caricaFunzione('cruscottoOperativo');
const OraVera = Date;
const alle = async (iso, f) => {
  const ms = OraVera.parse(iso);
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try { return await f(); } finally { globalThis.Date = OraVera; }
};
const J2 = (x) => JSON.stringify(x);
const REGIONI_2026 = [{ regione: 'Campania', province: 'Tutte', target_t: 4400 }, { regione: 'Puglia', province: 'BA,BR,TA,LE', target_t: 2500 }, { regione: 'Basilicata', target_t: 500 }, { regione: 'Calabria', target_t: 1650 }, { regione: 'Sicilia', target_t: 2500 }];
const COMMESSA_2026 = { id: 'c26', anno: 2026, target_annuo_t: 11550, regioni_json: JSON.stringify(REGIONI_2026), updated_date: '2026-03-01T10:00:00.000000' };
// I target annui dell'11/10/2026 per regione: Campania 4.400,38 e Calabria
// 1.649,62 sono arrotondamenti, sotto mezza tonnellata.
const TR = (id, raccoglitore, regione, t) => ({ id, anno: 2026, raccoglitore, regione, target_tonnellate: t });
const TARGET_11_10 = [TR('a', 'Ecorecuperi Srl', 'Campania', 2391.38), TR('b', 'Nappi Sud Srl A Socio Unico', 'Campania', 2009), TR('c', 'PNEUSERVICE CONVERSANO SRL', 'Puglia', 650), TR('d', 'SMOCO S.r.l.', 'Puglia', 1850),
  TR('e', 'ECOLOGICAL SYSTEMS SRL', 'Basilicata', 300), TR('f', 'SMOCO S.r.l.', 'Basilicata', 200), TR('g', 'GATIM S.R.L.', 'Calabria', 949.62), TR('h', 'SMOCO S.r.l.', 'Calabria', 700), TR('i', 'GREEN TYRE PROJECT SRL', 'Sicilia', 2500)];
const CON_PUGLIA = TARGET_11_10.map(t => (t.id === 'd' ? { ...t, target_tonnellate: 1950 } : t));

console.log('I RACCOGLITORI CHE NON FANNO IL CONTRATTO (14/10/2026)');
{
  const vcr = typeof C.vociContrattoRaccoglitori === 'function' ? C.vociContrattoRaccoglitori : () => [{ manca: 'vociContrattoRaccoglitori' }];
  verifica('coi target dell\'11/10/2026 nessuna voce: sotto mezza tonnellata e\' un arrotondamento', vcr([COMMESSA_2026], TARGET_11_10, 2026).length === 0, J2(vcr([COMMESSA_2026], TARGET_11_10, 2026)));
  const v = vcr([COMMESSA_2026], CON_PUGLIA, 2026);
  verifica('SMOCO in Puglia a 1.950 t: una voce, che dice regione, quanto e il verso', v.length === 1 && v[0].titolo === 'I raccoglitori della Puglia hanno 100,00 t più del contratto 2026', J2(v));
  verifica('il dettaglio: i due numeri, la differenza e che cosa fare', v[0] && String(v[0].dettaglio).startsWith('Puglia: raccoglitori 2.600,00 t, contratto 2.500,00 t (+100,00 t). Se è una variazione del consorzio, va registrata nel contratto')
    && /la dashboard, l'atteso alla data, l'Andamento ed EcoTyna dicono il contratto di prima/.test(v[0].dettaglio), v[0] && v[0].dettaglio);
  verifica('porta alla scheda dei raccoglitori dell\'anno, nella sezione della rete, con la sua chiave', v[0] && v[0].link === '/target-status?tab=raccoglitori&anno=2026' && v[0].sezione === 'rete' && v[0].area === 'Target raccoglitori'
    && v[0].gravita === 'attenzione' && v[0].chiave === 'contratto-raccoglitori:2026' && J2(v[0].misure) === '[100]', J2(v[0]));
  const registrata = { ...COMMESSA_2026, target_annuo_t: 11650, regioni_json: JSON.stringify(REGIONI_2026.map(r => (r.regione === 'Puglia' ? { ...r, target_t: 2600 } : r))) };
  verifica('registrata la variazione nel contratto, la voce sparisce', vcr([registrata], CON_PUGLIA, 2026).length === 0);
  const due = vcr([COMMESSA_2026], [...CON_PUGLIA.filter(t => t.id !== 'i'), TR('i', 'GREEN TYRE PROJECT SRL', 'Sicilia', 2300)], 2026);
  verifica('due regioni, una in piu\' e una in meno: una voce sola che le dice tutte e due', due.length === 1 && due[0].titolo === 'In 2 regioni i target dei raccoglitori non fanno il contratto 2026'
    && /Puglia: raccoglitori 2\.600,00 t, contratto 2\.500,00 t \(\+100,00 t\) · Sicilia: raccoglitori 2\.300,00 t, contratto 2\.500,00 t \(-200,00 t\)\./.test(due[0].dettaglio), J2(due));
  const senza = vcr([COMMESSA_2026], [...CON_PUGLIA, { id: 'z', anno: 2026, raccoglitore: 'ALFA', regione: '', target_tonnellate: 30 }], 2026);
  verifica('un target senza regione non si conta, e la voce lo dice', senza.length === 1 && /Un target annuo senza regione non è contato/.test(senza[0].dettaglio), J2(senza));
  verifica('senza contratto dell\'anno, senza riparto per regione o di un altro anno: niente', vcr([], CON_PUGLIA, 2026).length === 0 && vcr([{ ...COMMESSA_2026, regioni_json: '[]' }], CON_PUGLIA, 2026).length === 0
    && vcr([COMMESSA_2026], CON_PUGLIA.map(t => ({ ...t, anno: 2027 })), 2026).length === 0);
  verifica('fra due contratti dello stesso anno vale il modificato per ultimo, come in Target & Status', vcr([registrata, { ...COMMESSA_2026, updated_date: '2026-01-01T00:00:00.000000' }].map((c, i) => (i === 0 ? { ...c, updated_date: '2026-10-14T10:00:00.000000' } : c)), CON_PUGLIA, 2026).length === 0);
  const base = { oggi: '2026-10-14', anno: 2026, adessoMs: Date.parse('2026-10-14T08:00:00Z'), tipiFile: [], uploadLogs: [], alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], richiesteEct: [] };
  verifica('nella dashboard intera c\'e\' coi contratti e i target letti, e non c\'e\' senza', cruscotto({ ...base, commesse: [COMMESSA_2026], targetRaccoglitori: CON_PUGLIA }).da_gestire.some(x => x.chiave === 'contratto-raccoglitori:2026')
    && !cruscotto(base).da_gestire.some(x => x.chiave === 'contratto-raccoglitori:2026'));
}

console.log('LA FUNZIONE DELLA DASHBOARD PASSA SURPLUS, CONTRATTI E TARGET (chiusura del giro, 14/10/2026)');
{
  const fuel = (tipologia) => ({ id: `fs-${tipologia}`, gruppo: 'fs', nome: 'Fuel Surcharge', origine: 'CONSORZIO', riferimento: 'comunicazione del consorzio', tipologia, prestazione: 'RACCOLTA', a_chi: 'tutti',
    euro_t_passiva: 5, euro_t_attiva: 5, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo' });
  const accordo = { ...fuel('RETE'), id: 'acc', gruppo: 'acc', nome: 'Accordo riservato Gatim', origine: 'ACCORDO_COMMERCIALE', riferimento: 'lettera Gatim', euro_t_passiva: 3.21, euro_t_attiva: null };
  const db = { SurplusTariffa: [...['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(fuel), accordo], CommessaEcotyre: [COMMESSA_2026], TargetRaccoglitore: CON_PUGLIA };
  const gen = await alle('2027-01-04T08:00:00.000Z', () => chiama(funzioneCruscotto, { db, ruolo: 'user', corpo: { anno: 2027 } }));
  const voci = (gen.j && gen.j.da_gestire) || [];
  verifica('il 04/01/2027 la funzione risponde a chi non e\' amministratore', gen.stato === 200 && Array.isArray(gen.j.da_gestire), J2([gen.stato, gen.j && gen.j.error]));
  verifica('e il promemoria del Fuel Surcharge c\'e\': la funzione legge i surplus e li passa', voci.some(x => x.titolo === 'Fuel Surcharge del 2026: finito il 31/12/2026'), J2(voci.map(x => x.titolo)));
  const tutto = J2(gen.j);
  verifica('nella risposta nessun costo e nessun accordo pagato solo da SMOCO', !/euro_t_passiva|3,21|3\.21|Accordo riservato|lettera Gatim/.test(tutto), tutto.slice(0, 300));
  verifica('la funzione legge i surplus una volta, interi, e non scrive niente', gen.scritte.length === 0);
  const ott = await alle('2026-10-14T08:00:00.000Z', () => chiama(funzioneCruscotto, { db, ruolo: 'user', corpo: { anno: 2026 } }));
  const vc = ((ott.j && ott.j.da_gestire) || []).find(x => x.chiave === 'contratto-raccoglitori:2026');
  verifica('il 14/10/2026, con SMOCO in Puglia a 1.950 t, la dashboard dice che i raccoglitori non fanno il contratto', !!vc && vc.titolo === 'I raccoglitori della Puglia hanno 100,00 t più del contratto 2026', J2([ott.stato, ott.j && ott.j.error, vc]));
  const pari = await alle('2026-10-14T08:00:00.000Z', () => chiama(funzioneCruscotto, { db: { ...db, TargetRaccoglitore: TARGET_11_10 }, ruolo: 'user', corpo: { anno: 2026 } }));
  verifica('coi target dell\'11/10/2026 la voce non c\'e\'', pari.stato === 200 && !((pari.j && pari.j.da_gestire) || []).some(x => x.chiave === 'contratto-raccoglitori:2026'));
}

// GLI ERRORI DEL SITO (migliorie del 14/10/2026). Le pagine annotano i loro
// errori in ErroreSito (src/lib/registroErrori.js, prove/registroErrori.mjs);
// la dashboard dell'amministratore li dice in «Da gestire»: quanti non visti da
// ieri e i piu' frequenti. A chi non e' amministratore niente, e la funzione non
// legge nemmeno il registro.
console.log('GLI ERRORI DEL SITO IN «DA GESTIRE» (14/10/2026)');
{
  const ves = typeof C.vociErroriSito === 'function' ? C.vociErroriSito : () => [{ manca: 'vociErroriSito' }];
  const err = (id, giorno, altro = {}) => ({ id, giorno, tipo: 'server', messaggio: 'Request failed with status code 500', pagina: '/giacenze', coinvolto_tipo: 'funzione', coinvolto: 'calcolaGiacenze',
    volte: 2, visto: false, created_by: 'anna@smoco.it', ...altro, impronta: altro.impronta || `server|funzione|${altro.coinvolto ?? 'calcolaGiacenze'}|${altro.pagina || '/giacenze'}|${altro.messaggio || 'Request failed with status code 500'}` });
  const ERRORI = [
    err('a', '2026-10-14', { volte: 3 }),
    err('b', '2026-10-13', { created_by: 'luca@smoco.it' }),
    err('c', '2026-10-13', { tipo: 'rete', messaggio: 'Network Error', pagina: '/assegnati', coinvolto: 'Assegnato.filter', coinvolto_tipo: 'archivio', volte: 1 }),
    err('d', '2026-10-12', { messaggio: 'vecchio', volte: 9 }),
    err('e', '2026-10-14', { messaggio: 'gia visto', volte: 7, visto: true }),
  ];
  const v = ves(ERRORI, '2026-10-14');
  verifica('una voce sola: gli errori non visti da ieri (6), contati con le loro volte', v.length === 1 && v[0].titolo === '6 errori del sito da ieri', J2(v));
  verifica('il dettaglio: i piu\' frequenti, con chiamata, pagina e volte, e quanti utenti', v[0] && v[0].dettaglio === 'I più frequenti: «Request failed with status code 500» (calcolaGiacenze) in /giacenze, 5 volte · «Network Error» (Assegnato.filter) in /assegnati, 1 volta. Li hanno incontrati 2 utenti. Si guardano in Alert & Controllo, nella scheda «Errori del sito», e lì si segnano visti.', v[0] && v[0].dettaglio);
  verifica('porta alla scheda degli errori, sezione dati, attenzione (c\'e\' un errore del server), con chiave e misure', v[0] && v[0].link === '/alert-engine?tab=errori' && v[0].sezione === 'dati' && v[0].area === 'Errori del sito'
    && v[0].gravita === 'attenzione' && v[0].chiave === 'errori-sito' && J2(v[0].misure) === '[6]' && v[0].elementi.length === 2, J2(v[0]));
  const soloRete = ves([ERRORI[2]], '2026-10-14');
  verifica('un errore di rete solo: un\'informazione, «È questo», un utente', soloRete.length === 1 && soloRete[0].gravita === 'info' && soloRete[0].titolo === 'Un errore del sito da ieri'
    && soloRete[0].dettaglio.startsWith('È questo: «Network Error» (Assegnato.filter) in /assegnati, 1 volta. Lo ha incontrato un utente.'), J2(soloRete));
  verifica('niente voce: nessun errore, solo errori vecchi o gia\' visti, o registro non letto (null)', ves([], '2026-10-14').length === 0 && ves([ERRORI[3], ERRORI[4]], '2026-10-14').length === 0 && ves(null, '2026-10-14').length === 0);
  const tanti = Array.from({ length: C.LIMITE_ERRORI_CRUSCOTTO }, (_, i) => err('t' + i, '2026-10-14', { volte: 1, coinvolto: 'f' + (i % 5) }));
  verifica('oltre il limite della lettura il titolo dice «almeno»', ves(tanti, '2026-10-14')[0].titolo === `Almeno ${C.LIMITE_ERRORI_CRUSCOTTO} errori del sito da ieri`, ves(tanti, '2026-10-14')[0].titolo);
  verifica('il 1° del mese «da ieri» guarda l\'ultimo del mese prima', ves([err('m', '2026-09-30')], '2026-10-01').length === 1);
  // Revisione del 15/10/2026.
  // «Almeno» solo se le righe lette sono tutte da ieri: con dentro una riga piu'
  // vecchia, quelle da ieri (che vengono prima) sono arrivate tutte.
  const pienaConVecchie = [...Array.from({ length: 10 }, (_, i) => err('o' + i, '2026-10-14', { volte: 1 })), ...Array.from({ length: C.LIMITE_ERRORI_CRUSCOTTO - 10 }, (_, i) => err('s' + i, '2026-09-20', { volte: 1 }))];
  verifica('lettura piena ma con righe vecchie dentro: il conto da ieri e\' esatto, senza «almeno»', ves(pienaConVecchie, '2026-10-14')[0].titolo === '10 errori del sito da ieri', ves(pienaConVecchie, '2026-10-14')[0].titolo);
  // Gli elementi sono nomi da leggere, non la chiave interna del registro: la
  // voce nascosta che torna li mostra nell'etichetta.
  verifica('gli elementi della voce: il messaggio fra «», la chiamata e la pagina', J2(v[0] && v[0].elementi) === J2(['«Request failed with status code 500» (calcolaGiacenze) in /giacenze', '«Network Error» (Assegnato.filter) in /assegnati']), J2(v[0] && v[0].elementi));
  const A = await import('../src/lib/avvisiNascosti.js');
  const nascosta = A.nascondi(ves([ERRORI[1]], '2026-10-13')[0], '2026-10-13', { giorni: 7 });
  const nuovoGenere = err('n', '2026-10-15', { tipo: 'richiesta', messaggio: 'Entity ConsuntivoFornitore with id [codice] not found', pagina: '/verifiche-fornitori', coinvolto_tipo: 'archivio', coinvolto: 'ConsuntivoFornitore.filter', volte: 1, impronta: 'richiesta|archivio|ConsuntivoFornitore.filter|/verifiche-fornitori|Entity ConsuntivoFornitore with id [codice] not found' });
  const etichetta = A.testoTornata(A.percheTorna(nascosta, ves([ERRORI[1], nuovoGenere], '2026-10-15')[0], '2026-10-15'));
  verifica('nascosta e tornata per un errore di un altro genere: l\'etichetta si legge, senza la chiave interna', etichetta === 'tornata: c\'è un nome nuovo, «Entity ConsuntivoFornitore with id [codice] not found» (ConsuntivoFornitore.filter) in /verifiche-fornitori'
    && !/\|/.test(etichetta), etichetta);
  const lungo = ves([err('l', '2026-10-14', { messaggio: 'parola '.repeat(40).trim() })], '2026-10-14')[0];
  verifica('un messaggio lungo nell\'elemento si accorcia (nel dettaglio resta intero)', lungo.elementi[0].length < 130 && lungo.elementi[0].includes('…') && lungo.dettaglio.includes('parola '.repeat(40).trim()), lungo.elementi[0]);
  // Gli utenti si contano per created_by_id: la lettura dell'amministratore non
  // restituisce created_by (sulla copia dei dati veri dell'11/10/2026, 31.923
  // righe con created_by_id e nessuna con created_by).
  const comeDallaLettura = ERRORI.map(({ created_by, ...r }) => ({ ...r, created_by_id: created_by === 'luca@smoco.it' ? 'u-luca' : 'u-anna' }));
  const vId = ves(comeDallaLettura, '2026-10-14');
  verifica('righe senza email, con created_by_id: la voce dice lo stesso quanti utenti', vId[0] && vId[0].dettaglio.includes('Li hanno incontrati 2 utenti.'), vId[0] && vId[0].dettaglio);
  const base = { oggi: '2026-10-14', anno: 2026, adessoMs: Date.parse('2026-10-14T08:00:00Z'), tipiFile: [], uploadLogs: [], alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], richiesteEct: [] };
  const voceDash = cruscotto({ ...base, erroriSito: ERRORI }).da_gestire.find(x => x.chiave === 'errori-sito');
  verifica('nella dashboard intera c\'e\', senza EcoTyna (non legge quel registro), e non c\'e\' senza le righe', !!voceDash && voceDash.ecotyna === false && voceDash.sezione === 'dati'
    && !cruscotto(base).da_gestire.some(x => x.chiave === 'errori-sito'), J2(voceDash));

  // La funzione vera sul banco: legge il registro solo per l'amministratore.
  // Le righe come le restituisce la piattaforma: created_by_id, senza email.
  const db = { ErroreSito: comeDallaLettura };
  const comeAdmin = await alle('2026-10-14T08:00:00.000Z', () => chiama(funzioneCruscotto, { db, ruolo: 'admin', corpo: { anno: 2026 } }));
  const vAdmin = ((comeAdmin.j && comeAdmin.j.da_gestire) || []).find(x => x.chiave === 'errori-sito');
  verifica('all\'amministratore la funzione porta la voce, con quanti utenti (per created_by_id)', comeAdmin.stato === 200 && !!vAdmin && vAdmin.titolo === '6 errori del sito da ieri'
    && vAdmin.dettaglio.includes('Li hanno incontrati 2 utenti.'), J2([comeAdmin.stato, comeAdmin.j && comeAdmin.j.error, vAdmin]));
  const comeUtente = await alle('2026-10-14T08:00:00.000Z', () => chiama(funzioneCruscotto, { db, ruolo: 'user', corpo: { anno: 2026 } }));
  verifica('a chi non e\' amministratore niente: ne\' la voce ne\' un messaggio o un\'email del registro nella risposta', comeUtente.stato === 200 && !((comeUtente.j && comeUtente.j.da_gestire) || []).some(x => x.chiave === 'errori-sito')
    && !/anna@smoco|u-anna|u-luca|calcolaGiacenze|Network Error|errori del sito/.test(J2(comeUtente.j)), J2(comeUtente.j).slice(0, 200));
  verifica('e la funzione non scrive niente', comeAdmin.scritte.length === 0 && comeUtente.scritte.length === 0);
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../base44/functions/cruscottoOperativo/entry.ts', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('una lettura sola, filtrata sui non visti e limitata, e solo per l\'amministratore', (src.match(/ErroreSito\./g) || []).length === 1
    && /eAmministratore\(user\)\s*\?\s*svc\.ErroreSito\.filter\(\{ visto: false \}, '-created_date', LIMITE_ERRORI_CRUSCOTTO\)\.catch\(\(\) => null\)\s*:\s*Promise\.resolve\(null\)/.test(src));
}

// IL PROMEMORIA DELLA COPIA DI SICUREZZA (migliorie del 14/10/2026, agganciato
// alla chiusura del 15/10/2026). La regola (base44/shared/promemoriaCopia.ts,
// prove/copiaSicurezza.mjs) c'era, ma nessuno la chiamava: Caricamento Dati
// prometteva «dopo sette giorni la dashboard te lo ricorda» e la dashboard
// taceva. Qui l'elenco intero e la funzione vera: la voce c'e' per
// l'amministratore, dopo sette giorni o senza nessuna copia; a chi non lo e'
// niente, e la funzione non legge nemmeno il registro.
console.log('IL PROMEMORIA DELLA COPIA DI SICUREZZA IN «DA GESTIRE» (chiusura del 15/10/2026)');
{
  const base = { oggi: '2026-10-14', anno: 2026, adessoMs: Date.parse('2026-10-14T08:00:00Z'), tipiFile: [], uploadLogs: [], alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], richiesteEct: [] };
  const copia = (giorno, altro = {}) => ({ id: 'cs-' + giorno, giorno, il: `${giorno}T17:30:00.000Z`, created_date: `${giorno}T17:30:01.000000`, utente: 'Mario Rossi', nome_file: `treadrider-copia-${giorno}.json.gz`, archivi: 71, righe: 32145, kb: 3700, non_letti: 0, archivi_non_letti: '', attesi_mancanti: '', ...altro });
  const vocePer = (dati) => cruscotto({ ...base, ...dati }).da_gestire.find(x => x.chiave === 'copia-sicurezza');
  const otto = vocePer({ copieSicurezza: [copia('2026-10-06')], amministratore: true });
  verifica('all\'amministratore, con l\'ultima copia di otto giorni fa, la voce c\'e\': informazione, sezione dati, porta alla sezione della copia, senza EcoTyna',
    !!otto && otto.titolo === 'L\'ultima copia di sicurezza è del 06/10/2026: scaricane una' && otto.gravita === 'info' && otto.sezione === 'dati'
    && otto.link === '/caricamento-dati#copia-sicurezza' && otto.ecotyna === false && otto.area === 'Copia di sicurezza', J2(otto));
  verifica('con una copia di sei giorni fa niente', !vocePer({ copieSicurezza: [copia('2026-10-08')], amministratore: true }));
  const mai = vocePer({ copieSicurezza: [], amministratore: true });
  verifica('mai fatta: lo dice, come attenzione', !!mai && mai.titolo === 'Non è mai stata scaricata una copia di sicurezza: scaricane una' && mai.gravita === 'attenzione', J2(mai));
  verifica('registro non letto (null) o non passato: nessuna voce, non e\' «mai»', !vocePer({ copieSicurezza: null, amministratore: true }) && !vocePer({ amministratore: true }));
  verifica('a chi non e\' amministratore niente, nemmeno con le righe', !vocePer({ copieSicurezza: [copia('2026-09-01')], amministratore: false }) && !vocePer({ copieSicurezza: [] }));
  const incompleta = vocePer({ copieSicurezza: [copia('2026-10-13', { non_letti: 1, archivi_non_letti: 'Omologa' })], amministratore: true });
  verifica('l\'ultima copia incompleta: la voce dice quale archivio manca', !!incompleta && /senza un archivio/.test(incompleta.titolo) && /\(Omologa\)/.test(incompleta.dettaglio), J2(incompleta));

  // La funzione vera sul banco.
  const comeAdmin = await alle('2026-10-14T08:00:00.000Z', () => chiama(funzioneCruscotto, { db: { CopiaSicurezza: [copia('2026-10-06')] }, ruolo: 'admin', corpo: { anno: 2026 } }));
  const vAdmin = ((comeAdmin.j && comeAdmin.j.da_gestire) || []).find(x => x.chiave === 'copia-sicurezza');
  verifica('all\'amministratore la funzione porta il promemoria dell\'ultima copia', comeAdmin.stato === 200 && !!vAdmin && vAdmin.titolo === 'L\'ultima copia di sicurezza è del 06/10/2026: scaricane una', J2([comeAdmin.stato, comeAdmin.j && comeAdmin.j.error, vAdmin]));
  verifica('e della riga non manda chi l\'ha fatta ne\' il nome del file', !/Mario Rossi|treadrider-copia-/.test(J2(comeAdmin.j)));
  const recente = await alle('2026-10-14T08:00:00.000Z', () => chiama(funzioneCruscotto, { db: { CopiaSicurezza: [copia('2026-10-12')] }, ruolo: 'admin', corpo: { anno: 2026 } }));
  verifica('con una copia di due giorni fa la funzione non lo dice', recente.stato === 200 && !((recente.j && recente.j.da_gestire) || []).some(x => x.chiave === 'copia-sicurezza'));
  const maiAdmin = await alle('2026-10-14T08:00:00.000Z', () => chiama(funzioneCruscotto, { db: {}, ruolo: 'admin', corpo: { anno: 2026 } }));
  verifica('senza nessuna copia nel registro la funzione dice «mai»', ((maiAdmin.j && maiAdmin.j.da_gestire) || []).some(x => x.chiave === 'copia-sicurezza' && /mai stata scaricata/.test(x.titolo)));
  const comeUtente = await alle('2026-10-14T08:00:00.000Z', () => chiama(funzioneCruscotto, { db: { CopiaSicurezza: [copia('2026-09-01')] }, ruolo: 'user', corpo: { anno: 2026 } }));
  verifica('a chi non e\' amministratore niente: ne\' la voce ne\' la copia nominata', comeUtente.stato === 200 && !((comeUtente.j && comeUtente.j.da_gestire) || []).some(x => x.chiave === 'copia-sicurezza')
    && !/copia di sicurezza|01\/09\/2026/i.test(J2(comeUtente.j)), J2(comeUtente.j).slice(0, 200));
  verifica('e la funzione non scrive niente', comeAdmin.scritte.length === 0 && comeUtente.scritte.length === 0);
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../base44/functions/cruscottoOperativo/entry.ts', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('una lettura sola, di una riga, la piu\' recente, e solo per l\'amministratore', (src.match(/CopiaSicurezza\./g) || []).length === 1
    && /eAmministratore\(user\)\s*\?\s*svc\.CopiaSicurezza\.list\('-created_date', 1\)\.catch\(\(\) => null\)\s*:\s*Promise\.resolve\(null\)/.test(src)
    && /amministratore: eAmministratore\(user\),/.test(src));
}

// LA PROVA DEL CAMBIO D'ANNO (15/10/2026). Due difetti di «Da gestire»:
//  - 37: il 10/02/2027 i mesi dell'attiva da elaborare erano «Ottobre 2026,
//    Novembre 2026, Dicembre 2026, Gennaio» (statoMesiAttiva);
//  - 2: dal 1° gennaio le richieste del consorzio di dicembre ancora aperte, o
//    evase e non ancora risposte, sparivano (cruscottoOperativo leggeva solo le
//    richieste dell'anno di oggi).
console.log('IL CAMBIO D\'ANNO IN «DA GESTIRE» (15/10/2026)');
{
  const finoA = (n) => ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'].slice(0, n);
  const docsAttiva = finoA(9).flatMap(m => ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => ({ tipo: 'ATTIVA', anno: 2026, mese: m, tipologia: t, stato: 'elaborata' })));
  const vuoto = { tipiFile: [], uploadLogs: [], alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: docsAttiva, prefatture: finoA(9).map(m => ({ anno: 2026, mese: m })), richiesteEct: [] };
  const daElaborare = (oggi, anno) => {
    const r = cruscotto({ ...vuoto, oggi, anno, adessoMs: Date.parse(`${oggi}T08:00:00Z`) });
    const v = r.da_gestire.find(x => x.chiave === 'attiva:da-elaborare');
    return { voce: v ? `${v.titolo}: ${v.dettaglio}` : '', mesi: r.mesi_attiva.filter(m => !m.elaborato).map(m => m.etichetta).join(', ') };
  };
  const feb = daElaborare('2027-02-10', 2027);
  verifica('10/02/2027: «Ottobre 2026, Novembre 2026, Dicembre 2026, Gennaio 2027», ognuno col suo anno', feb.voce === '4 mesi finiti non ancora elaborati: Ottobre 2026, Novembre 2026, Dicembre 2026, Gennaio 2027' && feb.mesi === 'Ottobre 2026, Novembre 2026, Dicembre 2026, Gennaio 2027', J2(feb));
  const dic = daElaborare('2026-12-28', 2026);
  verifica('28/12/2026, mesi tutti del 2026: senza anno, come prima', dic.voce === '2 mesi finiti non ancora elaborati: Ottobre, Novembre', J2(dic));
  const gen = daElaborare('2027-01-05', 2027);
  verifica('05/01/2027, mesi tutti del 2026 guardando il 2027: col loro anno, come prima', gen.voce === '3 mesi finiti non ancora elaborati: Ottobre 2026, Novembre 2026, Dicembre 2026', J2(gen));

  // Le richieste del consorzio di dicembre, sulla funzione vera: una aperta col
  // termine del 30/12/2026, una evasa il 22/12 e non ancora risposta; e due che
  // non devono contare, una evasa e risposta e una annullata.
  const RICHIESTE = [
    { id: 'ect1', anno: 2026, pdr_nome: 'GOMMISTA ALFA', id_ordine: 'ET26990001', mail_inviata_il: '2026-12-14', scadenza: '2026-12-30', esito: 'aperta' },
    { id: 'ect2', anno: 2026, pdr_nome: 'GOMMISTA BETA', id_ordine: 'ET26990002', mail_inviata_il: '2026-12-15', scadenza: '2026-12-31', esito: 'evasa', evasione_rilevata_il: '2026-12-22' },
    { id: 'ect3', anno: 2026, pdr_nome: 'GOMMISTA GAMMA', id_ordine: 'ET26990003', mail_inviata_il: '2026-11-15', scadenza: '2026-11-30', esito: 'evasa', evasione_rilevata_il: '2026-11-22', evasione_confermata: true },
    { id: 'ect4', anno: 2026, pdr_nome: 'GOMMISTA DELTA', mail_inviata_il: '2026-11-15', scadenza: '2026-11-30', esito: 'annullata', motivo_annullamento: 'cancellato per mancanza di pfu' },
  ];
  const vociEct = async (iso, anno) => {
    const r = await alle(iso, () => chiama(funzioneCruscotto, { db: { RichiestaEct: RICHIESTE }, ruolo: 'user', corpo: anno ? { anno } : {} }));
    return { stato: r.stato, voci: ((r.j && r.j.da_gestire) || []).filter(v => v.area === 'Richieste ECT').map(v => `${v.gravita}: ${v.titolo}`) };
  };
  const ATTESE = ['critico: 1 richieste del consorzio oltre il termine', 'info: 1 richieste si sono chiuse da sole e aspettano la risposta al consorzio'];
  const ultimo = await vociEct('2026-12-31T22:30:00.000Z');
  verifica('31/12/2026 alle 23:30: le due voci, come prima', ultimo.stato === 200 && J2(ultimo.voci) === J2(ATTESE), J2(ultimo));
  const primo = await vociEct('2026-12-31T23:30:00.000Z');
  verifica('01/01/2027 alle 00:30: le richieste di dicembre restano in «Da gestire»', primo.stato === 200 && J2(primo.voci) === J2(ATTESE), J2(primo));
  const due = await vociEct('2027-01-02T09:00:00.000Z', 2027);
  verifica('02/01/2027: restano, e quella evasa e risposta o annullata non conta', due.stato === 200 && J2(due.voci) === J2(ATTESE), J2(due));
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../base44/functions/cruscottoOperativo/entry.ts', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('una lettura sola delle richieste, senza filtro sull\'anno, filtrata con richiesteDaSeguire', (src.match(/RichiestaEct/g) || []).length === 1
    && /fetchAll\(svc\.RichiestaEct\)\.then\(tutte => richiesteDaSeguire\(tutte, anno\)\)/.test(src));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
