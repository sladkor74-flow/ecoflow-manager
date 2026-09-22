// Prova della quadratura FIR (base44/shared/quadraturaFirDati.ts) sulle date
// obbligatorie dei formulari: immissione, inizio e fine trasporto (regola
// dell'utente del 22/09/2026). I terminati senza fine trasporto non stanno in
// nessuna settimana e si dicono; quelli della settimana senza immissione o
// inizio, o con date incoerenti, si contano e si dicono, canale per canale.
// npm run prove
import { readFileSync } from 'node:fs';
import { caricaGestionale, confrontaSettimana, osservazioniDate, formulariConDate } from '../base44/shared/quadraturaFirDati.ts';
import { normalizzaLettura } from '../base44/shared/quadraturaFir.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const primaria = (id, fir, kg, campi = {}) => ({
  id, id_ordine: id, numero_fir: fir, stato: 'terminato', peso_effettivo: kg, destinazione: 'GATIM SRL', trasportatore: 'EMMESSE SRL',
  ordine_immesso_il: '2026-09-01T08:00:00Z', trasporto_iniziato_il: '2026-09-08T06:00:00Z', trasporto_finito_il: '2026-09-08T10:00:00Z', ...campi,
});
const archivi = {
  PrimariaRete: [
    primaria('ET1', 'RGYTR000001AA', 3000),
    primaria('ET2', 'RGYTR000002AA', 2000, { trasporto_iniziato_il: null }),
    primaria('ET3', 'RGYTR000003AA', 1500, { trasporto_finito_il: null, trasporto_iniziato_il: null }),
  ],
  Secondaria: [], PrimariaAci: [], ExtraRaccolta: [],
};
const caricamenti = { ultimi: {}, in_corso: [] };
const periodo = { anno: 2026, settimana: 37, inizio: '2026-09-07', fine: '2026-09-13' };
const g = await caricaGestionale({ asServiceRole: { entities: {} } }, periodo, null, { archivi, caricamenti });

console.log('I NUMERI DEL GESTIONALE');
const rete = g.rete_primarie;
verifica('la settimana conta i due formulari con la fine trasporto', rete.totale.n === 2 && rete.totale.kg === 5000, JSON.stringify(rete.totale));
verifica('senza inizio trasporto: contato, e fra le date da sistemare', rete.date_da_sistemare.length === 1 && rete.date_da_sistemare[0].ordine === 'ET2' && rete.date_da_sistemare[0].date === 'manca la data di inizio trasporto', JSON.stringify(rete.date_da_sistemare));
verifica('senza fine trasporto: non contato, e dice tutte le date che mancano', rete.senza_fine.n === 1 && rete.senza_fine.esempi[0].date === 'mancano le date di inizio trasporto e fine trasporto', JSON.stringify(rete.senza_fine));

console.log('IL CONFRONTO');
const lettura = normalizzaLettura({ settimana: 37, tabelle: [
  { titolo: 'RACCOLTA RETE SETT. 37', fonte: 'WINSINFO', righe: [{ impianto: 'GATIM SRL', trasportatore: 'EMMESSE SRL', conteggio: 2, kg: 5000 }], totale_conteggio: 2, totale_kg: 5000 },
  { titolo: 'RACCOLTA RETE SETT. 37', fonte: 'portale Ecotyre', righe: [{ impianto: 'GATIM SRL', trasportatore: 'EMMESSE SRL', conteggio: 2, kg: 5000 }], totale_conteggio: 2, totale_kg: 5000 },
] });
const esito = confrontaSettimana(lettura, g, periodo);
const c = esito.per_canale.find(x => x.canale === 'RETE');
verifica('le tre fonti quadrano: la conformita\' resta piena, ma il canale dice il formulario da sistemare', c.conformita === 'piena' && c.date_da_sistemare === 1, JSON.stringify(c));
verifica('il flusso porta i formulari con le date da sistemare', esito.flussi[0].date_da_sistemare.length === 1, JSON.stringify(esito.flussi[0].date_da_sistemare));
verifica('le osservazioni dicono il senza fine (data obbligatoria) e il senza inizio, col canale', esito.osservazioni.some(o => /Raccolta rete · RETE/.test(o) && /senza data di fine trasporto/.test(o) && /obbligatoria e va inserita/.test(o))
  && esito.osservazioni.some(o => /Raccolta rete · RETE: un formulario della settimana/.test(o) && /ET2: manca la data di inizio trasporto/.test(o)), esito.osservazioni.join(' | '));
// Senza niente da sistemare il flusso non porta il campo: l'esito salvato non cambia.
const pulito = await caricaGestionale({ asServiceRole: { entities: {} } }, periodo, null, { archivi: { ...archivi, PrimariaRete: [primaria('ET1', 'RGYTR000001AA', 3000)] }, caricamenti });
const esitoPulito = confrontaSettimana(lettura, pulito, periodo);
verifica('tutto a posto: niente campo date nel flusso ne\' nel canale', !('date_da_sistemare' in esitoPulito.flussi[0]) && !('date_da_sistemare' in esitoPulito.per_canale[0]), JSON.stringify(esitoPulito.per_canale));

console.log('I FORMULARI RIPARTITI SU PIU\' ORDINI');
// Sette ordini su quattro formulari, tutti senza inizio trasporto: le voci sono
// quattro, una per formulario, e il testo non dice "e altri" (22/09/2026). Prima
// diceva 4 formulari con 5 esempi (lo stesso FIR ripetuto) e "e altri 2".
const ripartiti = [
  ['ET10', 'RGYTR000010AA', 1000], ['ET11', 'RGYTR000010AA', 900],
  ['ET12', 'RGYTR000011AA', 800], ['ET13', 'RGYTR000011AA', 700],
  ['ET14', 'RGYTR000012AA', 600], ['ET15', 'RGYTR000012AA', 500],
  ['ET16', 'RGYTR000013AA', 400],
].map(([id, fir, kg]) => primaria(id, fir, kg, { trasporto_iniziato_il: null }));
const gr = await caricaGestionale({ asServiceRole: { entities: {} } }, periodo, null, { archivi: { ...archivi, PrimariaRete: ripartiti }, caricamenti });
const dr = gr.rete_primarie.date_da_sistemare;
verifica('quattro voci per quattro formulari, gli ordini uniti e i chili sommati', dr.length === 4 && dr[0].ordine === 'ET10 + ET11' && dr[0].kg === 1900 && dr[3].ordine === 'ET16', JSON.stringify(dr));
const oss = osservazioniDate(gr).find(o => /formulari della settimana/.test(o)) || '';
verifica('l\'osservazione: 4 formulari, 4 esempi, nessun "e altri"', /: 4 formulari della settimana/.test(oss) && (oss.match(/FIR RGYTR/g) || []).length === 4 && !/e altri/.test(oss) && /ordini ET10 \+ ET11: manca la data di inizio trasporto/.test(oss), oss);
const esitoRip = confrontaSettimana(lettura, gr, periodo);
verifica('il canale conta 4 formulari da sistemare, come le voci del flusso', esitoRip.per_canale[0].date_da_sistemare === 4 && esitoRip.flussi[0].date_da_sistemare.length === 4, JSON.stringify(esitoRip.per_canale[0]));
// Sette formulari, di cui due ripartiti: 5 esempi e "e altri 2", sui formulari.
const sette = [...ripartiti, ...['RGYTR000014AA', 'RGYTR000015AA', 'RGYTR000016AA'].map((fir, i) => primaria('ET2' + i, fir, 300, { trasporto_iniziato_il: null }))];
const g7 = await caricaGestionale({ asServiceRole: { entities: {} } }, periodo, null, { archivi: { ...archivi, PrimariaRete: sette }, caricamenti });
const oss7 = osservazioniDate(g7).find(o => /formulari della settimana/.test(o)) || '';
verifica('sette formulari su dieci ordini: 5 esempi e "e altri 2"', /: 7 formulari della settimana/.test(oss7) && (oss7.match(/FIR RGYTR/g) || []).length === 5 && /e altri 2\)/.test(oss7), oss7);
// Un formulario senza fine trasporto chiuso su due ordini: un esempio, non due.
const gsf = await caricaGestionale({ asServiceRole: { entities: {} } }, periodo, null, { archivi: { ...archivi, PrimariaRete: [
  primaria('ET30', 'RGYTR000030AA', 1000, { trasporto_finito_il: null }), primaria('ET31', 'RGYTR000030AA', 800, { trasporto_finito_il: null }),
] }, caricamenti });
verifica('senza fine su due ordini: 1 formulario e 1 esempio con entrambi gli ordini', gsf.rete_primarie.senza_fine.n === 1 && gsf.rete_primarie.senza_fine.esempi.length === 1 && gsf.rete_primarie.senza_fine.esempi[0].ordine === 'ET30 + ET31', JSON.stringify(gsf.rete_primarie.senza_fine));
// Date diverse sulle quote: si dicono ordine per ordine.
const diverse = formulariConDate([{ fir: 'F1', ordine: 'A', date: 'manca la data di inizio trasporto' }, { fir: 'f1', ordine: 'B', date: 'manca la data di immissione' }, { fir: '', ordine: 'C', date: 'x' }, { fir: '', ordine: 'D', date: 'y' }]);
verifica('quote con date diverse: una voce, le date ordine per ordine; i senza numero restano separati', diverse.length === 3 && diverse[0].date === 'manca la data di inizio trasporto (A) · manca la data di immissione (B)' && diverse[0].ordine === 'A + B', JSON.stringify(diverse));
verifica('una lista gia\' raggruppata resta uguale', JSON.stringify(formulariConDate(dr)) === JSON.stringify(dr));

console.log('I SENZA FINE TRASPORTO LETTI DALL\'ARCHIVIO');
// Senza gli archivi gia' in memoria la quadratura li rilegge da sola. L'archivio
// finto risponde al filtro per intervallo, e al filtro su un valore preciso solo
// per quel valore: chiedendo il campo uguale a null - come si faceva - un record
// con la data a stringa vuota o illeggibile restava fuori, mentre gli elenchi
// delle primarie lo mostravano. L'insieme e' uno solo: terminato e senza un
// giorno di fine trasporto leggibile.
const righeArchivio = [
  primaria('ET40', 'RGYTR000040AA', 2200),
  primaria('ET41', 'RGYTR000041AA', 1100, { trasporto_finito_il: null }),
  primaria('ET42', 'RGYTR000042AA', 900, { trasporto_finito_il: '' }),
  primaria('ET43', 'RGYTR000043AA', 700, { trasporto_finito_il: 'data non letta' }),
  primaria('ET44', 'RGYTR000044AA', 600, { stato: 'annullato', trasporto_finito_il: null }),
];
const nellIntervallo = (r, f) => {
  const v = r.trasporto_finito_il;
  if (f.$gte != null && !(v && String(v) >= f.$gte)) return false;
  if (f.$lte != null && !(v && String(v) <= f.$lte)) return false;
  return true;
};
const archivioFinto = (righe) => ({
  list: async (_o, lim = 1e9, salta = 0) => righe.slice(salta, salta + lim),
  filter: async (filtro, _o, lim = 1e9, salta = 0) => {
    const f = (filtro || {}).trasporto_finito_il;
    const sel = f && typeof f === 'object' ? righe.filter(r => nellIntervallo(r, f)) : righe.filter(r => (r.trasporto_finito_il ?? null) === (f ?? null));
    return sel.slice(salta, salta + lim);
  },
});
const clienteFinto = { asServiceRole: { entities: Object.fromEntries(
  ['PrimariaRete', 'PrimariaAci', 'Secondaria', 'ExtraRaccolta'].map(n => [n, archivioFinto(n === 'PrimariaRete' ? righeArchivio : [])]),
) } };
const gArch = await caricaGestionale(clienteFinto, periodo, null, { caricamenti });
verifica('la settimana conta solo il formulario con la fine trasporto', gArch.rete_primarie.totale.n === 1 && gArch.rete_primarie.totale.kg === 2200, JSON.stringify(gArch.rete_primarie.totale));
verifica('senza fine trasporto: anche la data a stringa vuota e quella illeggibile, l\'annullato no', gArch.rete_primarie.senza_fine.n === 3
  && gArch.rete_primarie.senza_fine.esempi.every(x => x.date === 'manca la data di fine trasporto'), JSON.stringify(gArch.rete_primarie.senza_fine));

// La stessa regola nella copia delle pagine (src/lib/quadraturaFir.js), che la
// ripassa sugli esiti salvati prima. La libreria importa gli alias @: qui si
// sostituiscono.
const sorgente = readFileSync(new URL('../src/lib/quadraturaFir.js', import.meta.url), 'utf8')
  .replace("import { formatKg, formatTonnellate } from '@/lib/utils';", 'const formatKg = (x) => String(x); const formatTonnellate = (x) => String(x);');
const pagine = await import('data:text/javascript;base64,' + Buffer.from(sorgente).toString('base64'));
const quote = ripartiti.map(r => ({ fir: r.numero_fir, ordine: r.id_ordine, kg: r.peso_effettivo, date: 'manca la data di inizio trasporto' }));
verifica('pagine e backend raggruppano allo stesso modo', JSON.stringify(pagine.formulariConDate(quote)) === JSON.stringify(formulariConDate(quote))
  && JSON.stringify(pagine.formulariConDate([{ fir: 'F1', ordine: 'A', date: 'a' }, { fir: 'F1', ordine: 'B', date: 'b' }])) === JSON.stringify(formulariConDate([{ fir: 'F1', ordine: 'A', date: 'a' }, { fir: 'F1', ordine: 'B', date: 'b' }])));
verifica('le pagine descrivono il formulario ripartito con "ordini"', pagine.descriviConDate({ fir: 'F1', ordine: 'A + B', date: 'x' }) === 'FIR F1, ordini A + B: x');

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
