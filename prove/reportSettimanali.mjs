// Prova della verifica dei report settimanali (base44/shared/reportSettimanali.ts)
// sulle date obbligatorie dei formulari: immissione, inizio e fine trasporto
// (regola dell'utente del 22/09/2026). Un formulario registrato a cui ne manca
// una, o con date incoerenti, e' un'anomalia del suo canale; senza fine
// trasporto resta fuori dalla quadratura ma si segnala.
//
// E sulla data con cui una riga del report si colloca, che e' sempre la FINE del
// trasporto, per tutti i canali e per ingressi e uscite (regola 1): un file con
// una colonna di data sola la porta li', qualunque intestazione abbia, e con
// l'inizio trasporto si confronta soltanto se il file ha davvero due colonne
// distinte. Nasce dal report di Nappi Sud del 28/09/2026, dove la colonna "data
// carico" delle uscite veniva letta come inizio trasporto e la verifica usciva
// piena di anomalie su date che nel report non c'erano. npm run prove
import { readFileSync } from 'node:fs';
import { caricaMovimenti, verificaReport, conformitaPerCanale, canaleDelVerdetto, normalizzaRigheReport, riparaColonneData, riparaDateRighe, colonneDateDellaLettura, riepilogoVociDate, datePerCanale, messaggiDate } from '../base44/shared/reportSettimanali.ts';
import { ricontrollaVerifiche } from '../base44/shared/esitoVerifica.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Un archivio finto: fetchAll legge con list/filter a pagine.
const archivio = (righe) => ({ list: async () => righe, filter: async () => righe });
const base44 = (dati) => ({ asServiceRole: { entities: {
  PrimariaRete: archivio(dati.rete || []), PrimariaAci: archivio(dati.aci || []), Secondaria: archivio(dati.secondarie || []),
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
const rd = riepilogoVociDate(dati.archivi.PrimariaRete);
verifica('riepilogoVociDate sulle righe grezze: 4 ordini, 1 senza fine, con le date che mancano', rd && rd.ordini === 4 && rd.senza_fine === 1 && rd.esempi[0].date === 'manca la data di fine trasporto', JSON.stringify(rd));
verifica('niente da sistemare: null', riepilogoVociDate([primaria('X', 'F', 1)]) === null);
// lo stesso ordine con due formulari: un ordine solo, con le date di tutte e due
const rdDoppio = riepilogoVociDate([
  primaria('ET7', 'RGYTR000007AA', 1000, { trasporto_finito_il: null }),
  primaria('ET7', 'RGYTR000008AA', 500, { trasporto_iniziato_il: null }),
]);
verifica('due righe dello stesso ordine sono un ordine solo, non due', rdDoppio.ordini === 1 && rdDoppio.senza_fine === 1 && rdDoppio.esempi[0].righe === 2
  && rdDoppio.esempi[0].date === 'manca la data di fine trasporto; manca la data di inizio trasporto', JSON.stringify(rdDoppio));
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

console.log("LA DATA SOLA DI UN REPORT E' LA FINE TRASPORTO");
// Incidente del report di Nappi Sud (28/09/2026). La tabella degli ingressi ha
// "Data ingresso", letta come fine trasporto, e quella delle uscite - le
// secondarie - solo "Data carico": per chi manda il report "carico" e' quello che
// entra nel registro, ma l'agente la classificava come INIZIO trasporto. Da li'
// uscivano anomalie su date che nel report non ci sono - un inizio trasporto
// "diverso" e una fine trasporto "assente" - e il canale delle uscite risultava
// parziale senza motivo, mentre gli ingressi erano a posto.

// Le colonne del file: una data sola e' sempre la data del movimento.
const soloInizio = riparaColonneData({ fir: 0, peso: 4, data_inizio: 1, data_fine: -1, data: -1 });
verifica('una colonna di data sola, indicata come inizio, diventa la data del movimento', soloInizio.col.data === 1 && soloInizio.col.data_inizio === -1 && /fine del trasporto/.test(soloInizio.nota), JSON.stringify(soloInizio));
const stessaColonna = riparaColonneData({ data_inizio: 2, data_fine: 2, data: -1 });
verifica('la stessa colonna indicata come inizio e come fine resta una data generica, e si dice', stessaColonna.col.data === 2 && stessaColonna.col.data_inizio === -1 && stessaColonna.col.data_fine === -1 && /data sola/.test(stessaColonna.nota), JSON.stringify(stessaColonna));
const dueColonne = riparaColonneData({ data_inizio: 2, data_fine: 3, data: -1 });
verifica('due colonne di data distinte non si toccano: il file distingue davvero', dueColonne.col.data_inizio === 2 && dueColonne.col.data_fine === 3 && dueColonne.col.data === -1 && !dueColonne.nota, JSON.stringify(dueColonne));
const inizioEGenerica = riparaColonneData({ data_inizio: 2, data_fine: -1, data: 2 });
verifica('inizio e data generica sulla stessa colonna: resta la generica', inizioEGenerica.col.data === 2 && inizioEGenerica.col.data_inizio === -1, JSON.stringify(inizioEGenerica));

// Le righe: se la data e' arrivata solo nella casella dell'inizio (per esempio da
// un PDF trascritto dall'agente), vale come data del movimento e si dice quante sono.
const soloCarico = normalizzaRigheReport([
  { n: 2, fir: 'RGYTR000021AA', peso: 12000, data_inizio: '10/09/2026' },
  { n: 3, fir: 'RGYTR000022AA', peso: 13000, data_inizio: '16/09/2026' },
], 'kg');
verifica('la data arrivata come inizio diventa la data del movimento, e le righe si contano', soloCarico.date_da_inizio === 2
  && soloCarico.righe.every(r => r.data && !r.inizio), JSON.stringify(soloCarico.righe.map(r => ({ inizio: r.inizio, fine: r.fine, data: r.data }))));
const dueDate = normalizzaRigheReport([{ n: 2, fir: 'RGYTR000021AA', peso: 12000, data_inizio: '09/09/2026', data_fine: '10/09/2026' }], 'kg');
verifica('con due date sulla riga l\'inizio resta l\'inizio', dueDate.date_da_inizio === 0 && dueDate.righe[0].inizio === '2026-09-09' && dueDate.righe[0].fine === '2026-09-10', JSON.stringify(dueDate.righe));

// La verifica di un report di uscite: le secondarie che partono dal piazzale.
const STOCCAGGIO = 'NAPPI SUD SRL';
const secondaria = (id, fir, kg, campi = {}) => ({
  id, id_ordine: id, numero_fir: fir, stato: 'terminato', peso_effettivo: kg, stoccaggio: STOCCAGGIO, destinazione: 'IRIGOM SRL',
  trasportatore: 'TRANSAR SRL', ordine_immesso_il: '2026-09-07T08:00:00Z',
  trasporto_iniziato_il: '2026-09-08T06:00:00Z', trasporto_finito_il: '2026-09-10T09:00:00Z', ...campi,
});
const uscite = await caricaMovimenti(base44({ secondarie: [
  secondaria('SEC1', 'RGYTR000021AA', 12000),
  // il report e' cumulativo del mese: questa riga e' della settimana dopo
  secondaria('SEC2', 'RGYTR000022AA', 13000, { trasporto_iniziato_il: '2026-09-15T06:00:00Z', trasporto_finito_il: '2026-09-16T09:00:00Z' }),
] }));
const settimana37 = { chiave: 'nappi sud', nome: STOCCAGGIO, inizio: '2026-09-07', fine: '2026-09-13', senzaFine: uscite.senza_fine };
const esitoUscite = verificaReport(soloCarico.righe, uscite.movimenti, settimana37);
const u2 = esitoUscite.esiti.find(e => e.n === 2);
const discrepanzeUscite = esitoUscite.esiti.flatMap(e => e.discrepanze || []);
verifica('l\'uscita con la sola "data carico" e\' conforme: quella data vale come fine trasporto', u2 && u2.esito === 'conforme' && !u2.anomalia
  && u2.tipo === 'uscita' && u2.categoria === 'secondaria-uscita-rete', JSON.stringify(u2 && { esito: u2.esito, discrepanze: u2.discrepanze }));
verifica('nessuna anomalia su un inizio trasporto che nel report non c\'e\'', !discrepanzeUscite.some(d => /inizio trasporto diversa/i.test(d.messaggio)), JSON.stringify(discrepanzeUscite));
verifica('nessuna "fine trasporto assente" su un report che la data la scrive', !discrepanzeUscite.some(d => /fine trasporto assente/i.test(d.messaggio)), JSON.stringify(discrepanzeUscite));
verifica('la riga della settimana dopo si esclude, non diventa un\'anomalia', esitoUscite.escluse.length === 1 && esitoUscite.escluse[0].n === 3
  && /settimana 38/.test(esitoUscite.escluse[0].motivo) && esitoUscite.escluse[0].data === '2026-09-16', JSON.stringify(esitoUscite.escluse));
const qUscite = esitoUscite.quadratura.find(x => x.chiave === 'secondaria-uscita-rete');
verifica('la quadratura delle uscite torna: un formulario, i suoi chili', qUscite.formulari_report === 1 && qUscite.formulari_gestionale === 1
  && qUscite.kg_report === 12000 && qUscite.kg_gestionale === 12000, JSON.stringify(qUscite));
const reteUscite = esitoUscite.riepilogo.per_canale.find(c => c.canale === 'rete');
verifica('il canale delle uscite esce pieno: niente "parziale" senza motivo', reteUscite && reteUscite.conformita === 'piena' && reteUscite.anomalie === 0,
  JSON.stringify(esitoUscite.riepilogo.per_canale));

// Con due colonne di data il controllo sull'inizio trasporto resta: e' la
// certezza della colonna che lo rende possibile.
const { righe: righeDue } = normalizzaRigheReport([{ n: 2, fir: 'RGYTR000021AA', peso: 12000, data_inizio: '09/09/2026', data_fine: '10/09/2026' }], 'kg');
const esitoDue = verificaReport(righeDue, uscite.movimenti, settimana37);
verifica('con due colonne un inizio trasporto diverso si segnala ancora', esitoDue.esiti[0].discrepanze.some(d => d.campo === 'inizio'
  && /report 09\/09\/2026, gestionale 08\/09\/2026/.test(d.messaggio)), JSON.stringify(esitoDue.esiti[0].discrepanze));

// La data che manca al formulario registrato si chiede all'impianto, ma la data
// del report si suggerisce solo per la colonna giusta: suggerire la fine
// trasporto nel campo dell'inizio farebbe scrivere a portale un dato sbagliato.
const senzaInizio = await caricaMovimenti(base44({ secondarie: [secondaria('SEC3', 'RGYTR000023AA', 9000, { trasporto_iniziato_il: null })] }));
const settimana37bis = { ...settimana37, senzaFine: senzaInizio.senza_fine };
const { righe: righeSola } = normalizzaRigheReport([{ n: 2, fir: 'RGYTR000023AA', peso: 9000, data_inizio: '10/09/2026' }], 'kg');
const dSola = (verificaReport(righeSola, senzaInizio.movimenti, settimana37bis).esiti[0].discrepanze || []).find(d => d.campo === 'date');
verifica('manca l\'inizio trasporto: si chiede di inserirlo senza suggerire la data del report, che e\' la fine',
  dSola && dSola.messaggio === "Formulario registrato senza data di inizio trasporto: la data e' obbligatoria e va inserita", JSON.stringify(dSola));
const { righe: righeDueSenza } = normalizzaRigheReport([{ n: 2, fir: 'RGYTR000023AA', peso: 9000, data_inizio: '09/09/2026', data_fine: '10/09/2026' }], 'kg');
const dDue = (verificaReport(righeDueSenza, senzaInizio.movimenti, settimana37bis).esiti[0].discrepanze || []).find(d => d.campo === 'date');
verifica('con due colonne la data del report si suggerisce: quella e\' davvero l\'inizio trasporto',
  dDue && /\(nel report: 09\/09\/2026\)$/.test(dDue.messaggio), JSON.stringify(dDue));


// Un report con due colonne di data in cui la fine trasporto manca su una riga:
// la riga non porta la data del movimento, quindi la sua data di inizio non si
// confronta con niente. Si chiede la data che manca e basta: confrontare l'inizio
// di una riga senza fine vorrebbe dire di nuovo inventare un'anomalia.
const uscite2 = await caricaMovimenti(base44({ secondarie: [
  secondaria('SEC1', 'RGYTR000021AA', 12000),
  secondaria('SEC4', 'RGYTR000024AA', 10000, { trasporto_iniziato_il: '2026-09-09T06:00:00Z', trasporto_finito_il: '2026-09-11T09:00:00Z' }),
] }));
const mezzaData = normalizzaRigheReport([
  { n: 2, fir: 'RGYTR000021AA', peso: 12000, data_inizio: '08/09/2026', data_fine: '10/09/2026' },
  { n: 3, fir: 'RGYTR000024AA', peso: 10000, data_inizio: '07/09/2026' },
], 'kg');
verifica('la tabella ha la fine trasporto: la riga senza resta senza data, l\'inizio resta l\'inizio', mezzaData.date_da_inizio === 0
  && mezzaData.righe[1].inizio === '2026-09-07' && !mezzaData.righe[1].data && !mezzaData.righe[1].fine, JSON.stringify(mezzaData.righe[1]));
const esitoMezza = verificaReport(mezzaData.righe, uscite2.movimenti, { ...settimana37, senzaFine: uscite2.senza_fine });
const m3 = esitoMezza.esiti.find(e => e.n === 3);
verifica('si chiede la fine trasporto che manca nel report', m3.discrepanze.some(d => d.campo === 'fine' && d.messaggio === 'Data di fine trasporto assente nel report'), JSON.stringify(m3.discrepanze));
verifica('e non si confronta l\'inizio di una riga senza la data del movimento', !m3.discrepanze.some(d => d.campo === 'inizio'), JSON.stringify(m3.discrepanze));

// Le righe di una verifica salvata prima di questa correzione sono salvate con la
// data nella casella dell'inizio: la regola vale anche per loro, cosi' la verifica
// si rimette a posto da sola al primo riconfronto dopo un caricamento (regola 2),
// senza che nessuno debba ricaricare il file. E si guarda foglio per foglio: nel
// report di Nappi Sud il foglio degli ingressi aveva la data giusta e solo quello
// delle uscite no.
const salvate = [
  { n: 2, foglio: 'INGRESSI', fir: 'RGYTR000030AA', firN: 'RGYTR000030AA', ordine: '', kg: 5000, inizio: '2026-09-09', fine: '2026-09-10', data: null,
    produttore: '', codice_pdr: '', destinatario: '', trasportatore: '', intermediario: '', classe: null, classe_testo: '', targa: '' },
  { n: 2, foglio: 'USCITE', fir: 'RGYTR000021AA', firN: 'RGYTR000021AA', ordine: '', kg: 12000, inizio: '2026-09-10', fine: null, data: null,
    produttore: '', codice_pdr: '', destinatario: '', trasportatore: '', intermediario: '', classe: null, classe_testo: '', targa: '' },
];
const riparate = riparaDateRighe(salvate);
verifica('solo il foglio con la data sola si ripara, e le righe salvate non si toccano', riparate.date_da_inizio === 1
  && riparate.righe[0].inizio === '2026-09-09' && riparate.righe[0].fine === '2026-09-10'
  && riparate.righe[1].data === '2026-09-10' && !riparate.righe[1].inizio
  && salvate[1].inizio === '2026-09-10' && !salvate[1].data, JSON.stringify(riparate.righe.map(r => ({ foglio: r.foglio, inizio: r.inizio, fine: r.fine, data: r.data }))));
const esitoSalvate = verificaReport(salvate, uscite.movimenti, settimana37);
const uSalvata = esitoSalvate.esiti.find(e => e.foglio === 'USCITE');
verifica('il riconfronto di una verifica salvata non ripete l\'anomalia sulla data', uSalvata && uSalvata.esito === 'conforme'
  && !(uSalvata.discrepanze || []).length, JSON.stringify(uSalvata && uSalvata.discrepanze));

// ---------------------------------------------------------------------------
console.log('A DECIDERE E\' LA COLONNA, NON IL FOGLIO');
// Due difetti trovati in revisione. Il primo: un file con DUE colonne di data vere
// e la casella dell'arrivo vuota su tutte le righe del foglio. Guardando le righe,
// nessuna portava la fine, quindi la PARTENZA diventava la data del movimento: da
// li' l'anomalia "Data diversa dalla fine trasporto" su una data che il report non
// dichiara come fine, e una riga che poteva finire fra le escluse di un'altra
// settimana. Con le colonne in mano non succede.
const arrivoVuoto = [
  { n: 2, foglio: '', fir: 'RGYTR000021AA', firN: 'RGYTR000021AA', ordine: '', kg: 12000, inizio: '2026-09-08', fine: null, data: null,
    produttore: '', codice_pdr: '', destinatario: '', trasportatore: '', intermediario: '', classe: null, classe_testo: '', targa: '' },
];
const colonneDueVere = { '': { inizio: true, fine: true, generica: false } };
verifica('due colonne di data e l\'arrivo vuoto: la partenza NON diventa la data del movimento',
  riparaDateRighe(arrivoVuoto, { colonne: colonneDueVere }).date_da_inizio === 0
  && riparaDateRighe(arrivoVuoto, { colonne: colonneDueVere }).righe[0].inizio === '2026-09-08',
  JSON.stringify(riparaDateRighe(arrivoVuoto, { colonne: colonneDueVere }).righe[0]));
verifica('e senza le colonne si sarebbe riparata: e\' il difetto che le colonne chiudono',
  riparaDateRighe(arrivoVuoto).date_da_inizio === 1);
const esitoArrivoVuoto = verificaReport(arrivoVuoto, uscite.movimenti, { ...settimana37, lettura: { modo: 'excel', colonne: { fir: 'N. FIR', data_inizio: 'Data partenza', data_fine: 'Data arrivo' } } });
const dArrivo = (esitoArrivoVuoto.esiti[0].discrepanze || []);
verifica('si chiede la fine trasporto che manca, invece di inventare una data diversa',
  dArrivo.some(d => d.campo === 'fine' && d.messaggio === 'Data di fine trasporto assente nel report')
  && !dArrivo.some(d => /diversa dalla fine trasporto/i.test(d.messaggio)), JSON.stringify(dArrivo));

// Il secondo: ingressi e uscite nella STESSA tabella. Guardando le righe, bastava
// un ingresso con la data d'arrivo per zittire la riparazione su tutte le uscite,
// che restavano senza data - e in un PDF, che fogli non ha, era sempre cosi'.
const insieme = [
  { n: 2, foglio: '', fir: 'RGYTR000030AA', firN: 'RGYTR000030AA', ordine: '', kg: 5000, inizio: null, fine: null, data: '2026-09-10',
    produttore: '', codice_pdr: '', destinatario: '', trasportatore: '', intermediario: '', classe: null, classe_testo: '', targa: '' },
  { n: 3, foglio: '', fir: 'RGYTR000021AA', firN: 'RGYTR000021AA', ordine: '', kg: 12000, inizio: '2026-09-10', fine: null, data: null,
    produttore: '', codice_pdr: '', destinatario: '', trasportatore: '', intermediario: '', classe: null, classe_testo: '', targa: '' },
];
verifica('senza le colonne una riga con la data zittisce le altre (il difetto)', riparaDateRighe(insieme).date_da_inizio === 0);
verifica('con la colonna della data sola, la riga dell\'uscita ritrova la sua data',
  riparaDateRighe(insieme, { colonne: { '': { inizio: true, fine: false, generica: false } } }).date_da_inizio === 1);

// Le colonne si leggono dalla lettura salvata: al riconfronto il file non si
// rilegge, ma la lettura dice che colonne aveva.
const unFoglio = colonneDateDellaLettura({ modo: 'excel', colonne: { fir: 'FIR', data_inizio: 'Data carico' } })[''];
verifica('dalla lettura di un Excel con un foglio solo', unFoglio.inizio === true && unFoglio.fine === false && unFoglio.generica === false && unFoglio.inizio_condivisa === false, JSON.stringify(unFoglio));
const dueFogli = colonneDateDellaLettura({ modo: 'excel', fogli: [{ foglio: 'INGRESSI', colonne: { data_fine: 'Data ingresso' } }, { foglio: 'USCITE', colonne: { data_inizio: 'Data carico' } }] });
verifica('dalla lettura di un Excel con due fogli, uno per uno', dueFogli.INGRESSI.fine === true && dueFogli.INGRESSI.inizio === false
  && dueFogli.USCITE.inizio === true && dueFogli.USCITE.fine === false, JSON.stringify(dueFogli));
verifica('da un PDF trascritto non si sa niente: decidono le righe', colonneDateDellaLettura({ modo: 'pdf', unita: 'kg' }) === null
  && colonneDateDellaLettura(null) === null);
const esitoSalvataConLettura = verificaReport(salvate, uscite.movimenti, {
  ...settimana37,
  lettura: { modo: 'excel', fogli: [{ foglio: 'INGRESSI', colonne: { data_fine: 'Data ingresso' } }, { foglio: 'USCITE', colonne: { data_inizio: 'Data carico' } }] },
});
verifica('una verifica salvata si rimette a posto con le colonne del suo file',
  esitoSalvataConLettura.esiti.find(e => e.foglio === 'USCITE').esito === 'conforme', JSON.stringify(esitoSalvataConLettura.esiti.map(e => [e.foglio, e.esito])));

// IL CASO VERO DI NAPPI SUD, trovato a video il 29/09/2026 sulla verifica della
// settimana 39. Il report ha UNA sola colonna, intestata "DATA", e l'agente
// l'aveva indicata sia come data_inizio sia come data generica: le righe salvate
// portano la stessa data in tutte e due le caselle. La data del movimento c'era,
// quindi la settimana si tagliava bene, ma l'inizio veniva preso per buono e
// confrontato, e uscivano tre anomalie inventate:
//   "Data inizio trasporto diversa: report 21/09/2026, gestionale 19/09/2026"
// su una data che il report non dichiara affatto come inizio trasporto.
const unaColonnaSola = [
  { n: 2, foglio: '', fir: 'RGYTR000021AA', firN: 'RGYTR000021AA', ordine: '', kg: 12000, inizio: '2026-09-10', fine: null, data: '2026-09-10',
    produttore: '', codice_pdr: '', destinatario: '', trasportatore: '', intermediario: '', classe: null, classe_testo: '', targa: '' },
];
const letturaUnaColonna = { modo: 'excel', colonne: { fir: 'NUM. DI FORMULARIO', data_inizio: 'DATA', data: 'DATA' } };
const colUnaColonna = colonneDateDellaLettura(letturaUnaColonna);
verifica('la lettura dice che inizio e data del movimento sono la stessa colonna',
  colUnaColonna[''].inizio_condivisa === true, JSON.stringify(colUnaColonna));
const ripUna = riparaDateRighe(unaColonnaSola, { colonne: colUnaColonna });
verifica('quell\'inizio si toglie: e\' la stessa data letta due volte',
  ripUna.inizio_tolto === 1 && ripUna.righe[0].inizio === null && ripUna.righe[0].data === '2026-09-10', JSON.stringify(ripUna.righe[0]));
verifica('e le righe salvate non si toccano', unaColonnaSola[0].inizio === '2026-09-10');
const esitoUnaColonna = verificaReport(unaColonnaSola, uscite.movimenti, { ...settimana37, lettura: letturaUnaColonna });
const dUna = esitoUnaColonna.esiti[0].discrepanze || [];
verifica('niente piu\' "Data inizio trasporto diversa" su una data che il report non dichiara',
  !dUna.some(d => /inizio trasporto diversa/i.test(d.messaggio)), JSON.stringify(dUna));
verifica('e la riga resta conforme, con la sua data al posto giusto',
  esitoUnaColonna.esiti[0].esito === 'conforme', JSON.stringify(esitoUnaColonna.esiti[0].discrepanze));
verifica('la lettura diversa si dice', /letta due volte/.test(esitoUnaColonna.nota_date), esitoUnaColonna.nota_date);
// Senza sapere le colonne (un PDF trascritto) la stessa cosa si riconosce dalla
// riga: inizio uguale alla data del movimento non e' un inizio trasporto.
const senzaColonne = riparaDateRighe(unaColonnaSola);
verifica('e si riconosce anche senza le colonne, dalla riga', senzaColonne.inizio_tolto === 1 && senzaColonne.righe[0].inizio === null, JSON.stringify(senzaColonne.righe[0]));
// Con due colonne vere e date diverse il controllo sull'inizio resta: e' un
// confronto che serve, e non va spento per prudenza.
verifica('con due colonne e date diverse l\'inizio si confronta ancora',
  esitoDue.esiti[0].discrepanze.some(d => d.campo === 'inizio'), JSON.stringify(esitoDue.esiti[0].discrepanze));

// E la lettura diversa non resta nascosta: in un riconfronto il file non si
// rilegge, quindi la nota della lettura non si riscrive. Questa e' l'unica che lo dice.
verifica('il confronto dice quante date ha letto dalla casella dell\'inizio',
  esitoSalvataConLettura.date_da_inizio === 1 && /letta come data del movimento/.test(esitoSalvataConLettura.nota_date), esitoSalvataConLettura.nota_date);
verifica('e con le date al posto giusto non dice niente', esitoDue.date_da_inizio === 0 && esitoDue.nota_date === '');

// La function che legge il file: la riparazione delle colonne non e' piu' sua, e
// la guida all'agente dice da che parte sta la data. Sono le due cose da cui
// nasceva il difetto (elaboraReportSettimanale/entry.ts): se qualcuno rimettesse
// una riparazione locale, o riscrivesse "di carico" sotto data_inizio, la stessa
// cosa ricapiterebbe al primo report nuovo.
const sorgenteFunzione = readFileSync(new URL('../base44/functions/elaboraReportSettimanale/entry.ts', import.meta.url), 'utf8');
verifica('la function ripara le colonne delle date con la regola condivisa', /riparaColonneData\(/.test(sorgenteFunzione) && !/col\.data_inizio = -1/.test(sorgenteFunzione));
const guidaFine = sorgenteFunzione.match(/'data_fine:[^\n]*/);
const guidaInizio = sorgenteFunzione.match(/'data_inizio:[^\n]*/);
verifica('la guida dice che la data di carico e di ingresso e\' la fine del trasporto', guidaFine && /di carico/.test(guidaFine[0]) && /si conclude|fine del trasporto/.test(guidaFine[0]), guidaFine && guidaFine[0]);
verifica('la guida chiede l\'inizio trasporto solo con due colonne di data', guidaInizio && /SOLO se il file ha due colonne di data/.test(guidaInizio[0]) && !/di carico\./.test(guidaInizio[0]), guidaInizio && guidaInizio[0]);
console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
