// Prova della verifica dei report settimanali (base44/shared/reportSettimanali.ts)
// sulle date obbligatorie dei formulari: immissione, inizio e fine trasporto
// (regola dell'utente del 22/09/2026). Un formulario registrato a cui ne manca
// una, o con date incoerenti, e' un'anomalia del suo canale; senza fine
// trasporto resta fuori dalla quadratura ma si segnala. npm run prove
import { readFileSync } from 'node:fs';
import { caricaMovimenti, verificaReport, conformitaPerCanale, canaleDelVerdetto, normalizzaRigheReport, riepilogoDate, datePerCanale, messaggiDate } from '../base44/shared/reportSettimanali.ts';
import { ricontrollaVerifiche } from '../base44/shared/esitoVerifica.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Un archivio finto: fetchAll legge con list/filter a pagine.
const archivio = (righe) => ({ list: async () => righe, filter: async () => righe });
const base44 = (dati) => ({ asServiceRole: { entities: {
  PrimariaRete: archivio(dati.rete || []), PrimariaAci: archivio(dati.aci || []), Secondaria: archivio([]),
  ExtraRaccolta: archivio(dati.extra || []), Fornitore: archivio([]),
} } });

const IMPIANTO = 'GATIM SRL';
const primaria = (id, fir, kg, campi = {}) => ({
  id, id_ordine: id, numero_fir: fir, stato: 'terminato', peso_effettivo: kg, destinazione: IMPIANTO, trasportatore: 'EMMESSE SRL',
  ordine_immesso_il: '2026-09-01T08:00:00Z', trasporto_iniziato_il: '2026-09-08T06:00:00Z', trasporto_finito_il: '2026-09-08T10:00:00Z', ...campi,
});

const dati = await caricaMovimenti(base44({
  rete: [
    primaria('ET1', 'RGYTR000001AA', 3000),                                               // a posto
    primaria('ET2', 'RGYTR000002AA', 2000, { trasporto_iniziato_il: null }),                // manca l'inizio
    primaria('ET3', 'RGYTR000003AA', 1500, { trasporto_finito_il: null }),                  // manca la fine
    primaria('ET4', 'RGYTR000004AA', 1800, { trasporto_iniziato_il: '2026-09-09T06:00:00Z' }), // fine prima dell'inizio
    primaria('ET5', 'RGYTR000005AA', 2500, { ordine_immesso_il: null }),                    // assente nel report, manca l'immissione
    primaria('ET6', 'RGYTR000006AA', 900, { stato: 'cancellato', trasporto_finito_il: null }), // non terminato: non si giudica
  ],
}));

console.log('I TERMINATI CON LE DATE DA SISTEMARE');
verifica('quattro ordini terminati da sistemare, il cancellato no', dati.date_da_sistemare.length === 4 && !dati.date_da_sistemare.some(v => v.id_ordine === 'ET6'), JSON.stringify(dati.date_da_sistemare.map(v => v.id_ordine)));
const gruppi = datePerCanale(dati.date_da_sistemare);
verifica('per canale e archivio: rete primaria, 4 ordini di cui 1 senza fine, il senza fine per primo', gruppi.length === 1 && gruppi[0].canale === 'rete' && gruppi[0].n === 4 && gruppi[0].senza_fine === 1 && gruppi[0].esempi[0].ordine === 'ET3', JSON.stringify(gruppi));
const rd = riepilogoDate(dati.archivi.PrimariaRete);
verifica('riepilogoDate sulle righe grezze: 4 ordini, 1 senza fine, con le date che mancano', rd && rd.ordini === 4 && rd.senza_fine === 1 && rd.esempi[0].date === 'manca la data di fine trasporto', JSON.stringify(rd));
verifica('niente da sistemare: null', riepilogoDate([primaria('X', 'F', 1)]) === null);
verifica('un formulario ripartito dice su quale ordine', messaggiDate([{ ordine: 'A', mancanti: ['inizio trasporto'], incoerenti: [] }, { ordine: 'B', mancanti: [], incoerenti: ['fine trasporto prima dell\'inizio'] }])[0].startsWith('Ordine A: Formulario registrato senza data di inizio trasporto'));

console.log('LA VERIFICA DEL REPORT');
const { righe } = normalizzaRigheReport([
  { n: 2, fir: 'RGYTR000001AA', peso: 3000, data_fine: '08/09/2026' },
  { n: 3, fir: 'RGYTR000002AA', peso: 2000, data_fine: '08/09/2026' },
  { n: 4, fir: 'RGYTR000003AA', peso: 1500, data_fine: '08/09/2026' },
  { n: 5, fir: 'RGYTR000004AA', peso: 1800, data_fine: '08/09/2026' },
], 'kg');
const esito = verificaReport(righe, dati.movimenti, { chiave: 'gatim', nome: IMPIANTO, inizio: '2026-09-07', fine: '2026-09-13', senzaFine: dati.senza_fine });
const riga = (n) => esito.esiti.find(e => e.n === n);
verifica('la riga a posto e\' conforme', riga(2).esito === 'conforme' && !riga(2).anomalia);
verifica('manca l\'inizio: anomalia con le parole dell\'utente', riga(3).anomalia && riga(3).discrepanze.some(d => d.campo === 'date' && d.gravita === 'anomalia' && d.messaggio === "Formulario registrato senza data di inizio trasporto: la data e' obbligatoria e va inserita"), JSON.stringify(riga(3).discrepanze));
verifica('manca la fine: anomalia, non rettifica', riga(4).anomalia && riga(4).senza_fine_trasporto && riga(4).discrepanze.length === 1 && riga(4).discrepanze[0].gravita === 'anomalia'
  && riga(4).discrepanze[0].messaggio === "Formulario registrato senza data di fine trasporto: la data e' obbligatoria e va inserita (nel report: 08/09/2026)" && riga(4).categoria === 'primaria-ingresso-rete', JSON.stringify(riga(4)));
verifica('date incoerenti: anomalia', riga(5).anomalia && riga(5).discrepanze.some(d => d.campo === 'date' && /incoerenti \(fine trasporto prima dell'inizio\)/.test(d.messaggio)), JSON.stringify(riga(5).discrepanze));
const q = esito.quadratura.find(x => x.chiave === 'primaria-ingresso-rete');
verifica('la riga senza fine resta fuori dalla quadratura; l\'assente ET5 manca nel report', q.formulari_report === 3 && q.formulari_gestionale === 4 && q.kg_report === 6800, JSON.stringify(q));
verifica('l\'assente dice la data che manca', esito.assenti.length === 1 && esito.assenti[0].ordine === 'ET5' && /senza data di immissione/.test(esito.assenti[0].date_testo), JSON.stringify(esito.assenti));
const rete = esito.riepilogo.per_canale.find(c => c.canale === 'rete');
verifica('il verdetto della rete conta le tre righe e l\'assente: parziale, 4 anomalie', rete.conformita === 'parziale' && rete.anomalie === 4 && esito.riepilogo.anomalie === 4, JSON.stringify(esito.riepilogo.per_canale));
verifica('date_da_sistemare nel riepilogo: tre righe e un assente, nessuna rettifica', esito.riepilogo.date_da_sistemare === 4 && esito.riepilogo.rettifiche === 0, JSON.stringify(esito.riepilogo));

console.log('UN FORMULARIO SENZA FINE CHE NEL GESTIONALE VA ALTROVE');
// La riga col formulario di un terminato rete senza fine trasporto, chiuso su
// un'altra destinazione: nel gestionale non riguarda l'impianto, ma la data
// obbligatoria che manca pesa lo stesso sul verdetto della rete (22/09/2026).
// Prima restava fuori da tutti i canali e il PDF diceva "pienamente conforme".
const altrove = await caricaMovimenti(base44({
  rete: [
    primaria('EA1', 'RGYTR000011AA', 3000),
    primaria('EA2', 'RGYTR000012AA', 1200, { trasporto_finito_il: null, destinazione: 'ALTRO SRL' }),
  ],
}));
const { righe: righeAltrove } = normalizzaRigheReport([
  { n: 2, fir: 'RGYTR000011AA', peso: 3000, data_fine: '08/09/2026' },
  { n: 3, fir: 'RGYTR000012AA', peso: 1200, data_fine: '08/09/2026' },
], 'kg');
const esitoAltrove = verificaReport(righeAltrove, altrove.movimenti, { chiave: 'gatim', nome: IMPIANTO, inizio: '2026-09-07', fine: '2026-09-13', senzaFine: altrove.senza_fine });
const r3 = esitoAltrove.esiti.find(e => e.n === 3);
verifica('la riga resta fra i non registrati per l\'impianto, con la data che manca e la destinazione diversa', r3.categoria === 'non_registrati' && r3.anomalia && r3.senza_fine_trasporto
  && r3.discrepanze.some(d => d.campo === 'date' && d.gravita === 'anomalia') && r3.discrepanze.some(d => d.campo === 'destinatario' && /non riguarda GATIM SRL: va da .* a ALTRO SRL/.test(d.messaggio)), JSON.stringify(r3));
verifica('canaleDelVerdetto: il canale del formulario, anche fuori dalle movimentazioni', canaleDelVerdetto(r3) === 'rete' && canaleDelVerdetto(esitoAltrove.esiti.find(e => e.n === 2)) === 'rete'
  && canaleDelVerdetto({ categoria: 'non_registrati', esito: 'non_trovata', gestionale: null }) === '', JSON.stringify(r3.gestionale));
const reteAltrove = esitoAltrove.riepilogo.per_canale.find(c => c.canale === 'rete');
verifica('il verdetto della rete conta la data che manca: parziale, 1 anomalia', esitoAltrove.riepilogo.per_canale.length === 1 && reteAltrove.conformita === 'parziale' && reteAltrove.anomalie === 1, JSON.stringify(esitoAltrove.riepilogo.per_canale));
verifica('la riga non entra nella quadratura, nemmeno fra i non registrati', esitoAltrove.quadratura.find(x => x.chiave === 'non_registrati').formulari_report === 0
  && esitoAltrove.quadratura.find(x => x.chiave === 'primaria-ingresso-rete').formulari_report === 1, JSON.stringify(esitoAltrove.quadratura.filter(x => x.formulari_report || x.formulari_gestionale)));

// Lo specchio delle pagine (src/lib/verifiche.js) da' lo stesso verdetto e non
// dice "tutto a posto". La libreria importa gli alias @: qui si sostituiscono.
const sorgenteVerifiche = readFileSync(new URL('../src/lib/verifiche.js', import.meta.url), 'utf8')
  .replace("import { formatTonnellate, formatKg, formatIntero, dataServer } from '@/lib/utils';",
    'const formatTonnellate = (x) => String(x); const formatKg = (x) => String(x); const formatIntero = (x) => String(x); const dataServer = (x) => x;');
const specchio = await import('data:text/javascript;base64,' + Buffer.from(sorgenteVerifiche).toString('base64'));
const pcSpecchio = specchio.conformitaPerCanale(esitoAltrove);
verifica('specchio: stesso verdetto per canale', JSON.stringify(pcSpecchio) === JSON.stringify(esitoAltrove.riepilogo.per_canale), JSON.stringify(pcSpecchio));
const sintesiAltrove = specchio.sintesiVerifica({ file_tipo: 'excel' }, esitoAltrove);
verifica('specchio: la sintesi non e\' "piena" e conta la data obbligatoria', !sintesiAltrove.piena && sintesiAltrove.conDate.length === 1 && !sintesiAltrove.senzaCanale.length, JSON.stringify({ piena: sintesiAltrove.piena, perCanale: sintesiAltrove.perCanale }));
// Un formulario di un altro impianto con le date a posto resta senza canale, ma
// il "tutto a posto" lo esclude lo stesso: il PDF non puo' dire "nessuna azione".
const esitoAltroImpianto = { ...esitoAltrove, esiti: [esitoAltrove.esiti.find(e => e.n === 2), { n: 4, tipo: null, tipo_presunto: 'ingresso', categoria: 'non_registrati', esito: 'discrepanze', anomalia: true,
  report: { kg: 500 }, gestionale: { canale: 'rete', fir: 'X' }, discrepanze: [{ campo: 'destinatario', gravita: 'anomalia', messaggio: 'Nel gestionale questo formulario non riguarda GATIM SRL: va da A a B' }] }] };
const sintesiAltroImpianto = specchio.sintesiVerifica({ file_tipo: 'excel' }, esitoAltroImpianto);
verifica('specchio: la riga di un altro impianto, senza canale, toglie la conformita\' piena', !sintesiAltroImpianto.piena && sintesiAltroImpianto.senzaCanale.length === 1
  && sintesiAltroImpianto.perCanale.every(c => c.conformita === 'piena'), JSON.stringify({ piena: sintesiAltroImpianto.piena, perCanale: sintesiAltroImpianto.perCanale }));

console.log('LE VERIFICHE SALVATE PRIMA');
// Una verifica salvata prima del 22/09/2026 aveva la riga senza fine come
// rettifica, senza anomalia: conta lo stesso nel verdetto finche' non si riscrive.
const vecchia = { quadratura: [{ chiave: 'primaria-ingresso-rete', formulari_report: 1, formulari_gestionale: 1, kg_report: 3000, kg_gestionale: 3000 }],
  esiti: [{ categoria: 'primaria-ingresso-rete', anomalia: false, senza_fine_trasporto: true }, { categoria: 'primaria-ingresso-rete', anomalia: false }], assenti: [] };
const pc = conformitaPerCanale(vecchia);
verifica('la riga salvata come rettifica pesa sul verdetto', pc.length === 1 && pc[0].conformita === 'parziale' && pc[0].anomalie === 1, JSON.stringify(pc));
// Movimenti a posto: nessun campo date sul movimento, quindi l'esito salvato non cambia.
verifica('un movimento a posto non porta il campo date', !('date' in dati.movimenti.find(m => m.ordine === 'ET1')));

// Regola 2: la verifica salvata con la riga senza fine come rettifica si
// riscrive da sola al primo riconfronto, perche' l'esito di adesso e' diverso.
const scritte = [];
const finto = { asServiceRole: { entities: {
  VerificaReport: { update: async (id, campi) => { scritte.push({ id, ...campi }); } },
  ContenutoEsteso: { filter: async () => [], delete: async () => {}, deleteMany: async () => ({ deleted: 0 }), bulkCreate: async () => {} },
  Alert: { filter: async () => [], update: async () => {}, create: async () => {} },
} } };
const esitoVecchio = {
  ...esito,
  esiti: esito.esiti.map(e => (e.senza_fine_trasporto ? { ...e, anomalia: false, discrepanze: [{ campo: 'fine', gravita: 'rettifica', messaggio: 'Formulario registrato ma terminato senza data di fine trasporto: da correggere sul portale e ricaricare' }] } : e)),
};
const testo = (x) => JSON.stringify({ esiti: x.esiti, assenti: x.assenti, escluse: x.escluse, quadratura: x.quadratura });
const salvata = {
  id: 'v1', stato: 'completata', file_tipo: 'excel', soggetto_chiave: 'gatim', soggetto_nome: IMPIANTO, anno: 2026, settimana: 37,
  data_inizio: '2026-09-07', data_fine: '2026-09-13', righe_report_json: JSON.stringify(righe), esito_json: testo(esitoVecchio),
  conformita: 'parziale', per_canale: [{ canale: 'rete', nome: 'Rete', conformita: 'parziale', anomalie: 3, assenti: 1 }],
};
const [r1] = await ricontrollaVerifiche(finto, [salvata], dati.movimenti, { scrivi: true, riprova: (fn) => fn() });
verifica('il riconfronto vede il cambio e riscrive la verifica', r1 && r1.cambiato && r1.salvato && scritte.length === 1 && scritte[0].anomalie === 4 && scritte[0].date_da_sistemare === 4, JSON.stringify({ r1, scritte }));
scritte.length = 0;
const [r2] = await ricontrollaVerifiche(finto, [{ ...salvata, esito_json: testo(esito), per_canale: esito.riepilogo.per_canale }], dati.movimenti, { scrivi: true, riprova: (fn) => fn() });
verifica('gia\' riscritta: niente da scrivere', r2 && !r2.cambiato && scritte.length === 0, JSON.stringify(r2));
// La verifica del formulario che va altrove, salvata con la rete "piena": il
// verdetto di adesso e' parziale, e il riconfronto la riscrive da solo.
scritte.length = 0;
const salvataAltrove = { ...salvata, id: 'v2', righe_report_json: JSON.stringify(righeAltrove), esito_json: testo(esitoAltrove), conformita: 'parziale',
  per_canale: [{ canale: 'rete', nome: 'Rete', conformita: 'piena', anomalie: 0, assenti: 0 }] };
const [r3v] = await ricontrollaVerifiche(finto, [salvataAltrove], altrove.movimenti, { scrivi: true, riprova: (fn) => fn() });
verifica('il verdetto di rete salvato pieno si riscrive parziale', r3v && r3v.cambiato && scritte.length === 1 && scritte[0].per_canale[0].conformita === 'parziale', JSON.stringify({ r3v, scritte: scritte.map(s => s.per_canale) }));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
