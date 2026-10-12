// Prova del CRUSCOTTO PER LA DASHBOARD NUOVA (migliorie dell'11/10/2026,
// base44/shared/cruscotto.ts).
//
// 1. Gli impianti dalla fotografia della notte (quadroImpianti): la cifra «Da
//    dichiarare» e' la colonna «Da dichiarare» delle Dichiarazioni sommata, canale
//    per canale e mai fra canali: senza la rete non dovuta per accordo (le «—»),
//    senza le giacenze sotto zero (le rosse, che stanno a parte).
// 2. Gli avvisi dei target dei raccoglitori: una voce per mese, fuori dalla voce
//    generica degli alert (il pannello in fondo alla pagina non c'e' piu').
// 3. Ogni voce ha la sua chiave e la sua sezione, e le chiavi non si ripetono:
//    con la chiave la pagina ricorda una voce nascosta.
// 4. I presidi della notte (presidi.ts) entrano nell'elenco: una causa, una voce.
// Revisione delle migliorie (11/10/2026): la quadratura e' quella di
// Dichiarazioni Impianti (impianti e stoccaggi della rete con una giacenza a
// portale, l'ACI degli stoccaggi a parte), non i soli impianti; la voce dei target
// dice la soglia vera dell'alert aperto (90%, non 70%) e porta i nomi.
// 5. L'ultimo giro della revisione (12/10/2026): se il controllo delle identita'
//    di oggi si ferma prima di scrivere, cruscottoOperativo dice quelle della
//    riga prima, e la rotta di ieri non sparisce per un giorno.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import * as C from '../base44/shared/cruscotto.ts';
import { fotografiaDelGiorno, leggiFotografia } from '../base44/shared/indicatoriGiorno.ts';
import { vociPresidi } from '../base44/shared/presidi.ts';
import { verificaInvarianti, VOCI_INVARIANTI } from '../base44/shared/invarianti.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const OGGI = '2026-10-11';
const ADESSO = Date.parse('2026-10-11T08:00:00Z');
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto'];
const documenti = MESI.flatMap(m => ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => ({ tipo: 'ATTIVA', anno: 2026, mese: m, tipologia: t, stato: 'chiusa' })));
const base = (altro = {}) => ({
  oggi: OGGI, adessoMs: ADESSO, anno: 2026, tipiFile: ['primarie'],
  alertAperti: [], uploadLogs: [{ tipo_file: 'primarie', esito: 'successo', created_date: '2026-10-10T08:00:00' }],
  assegnatiRete: [], assegnatiAci: [], documenti: [...documenti, ...['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => ({ tipo: 'ATTIVA', anno: 2026, mese: 'Settembre', tipologia: t, stato: 'chiusa' }))],
  prefatture: [...MESI, 'Settembre'].map(m => ({ anno: 2026, mese: m })), riepilogoQualifica: null, richiesteEct: [],
  ...altro,
});

console.log('1. GLI IMPIANTI DALLA FOTOGRAFIA DELLA NOTTE');
// I siti come li calcola riepilogoDichiarazioni: due impianti, uno con la rete
// non dovuta per accordo, uno con la giacenza ACI sotto zero, e uno stoccaggio.
const flusso = (canale, resta_t, extra = {}) => ({ canale, resta_t, uscito_t: 1, ...extra });
const gc = (canale, giacenza_t, extra = {}) => ({ canale, giacenza_t, entrato_t: 10, dichiarato_caricato_t: 5, ...extra });
const SITI = [
  { sito: 'Irigom S.r.l.', chiave: 'irigom', canale: 'RETE', tipo_destinazione: 'imp', giacenza_portale_t: 652.84, giacenza_calcolata_t: 652.84, scarto_t: 0, quadra: true,
    giacenze_canale: [gc('RETE', 652.84), gc('ACI', 1.2), gc('EXTRA_RACCOLTA', 0)],
    // la rete in due flussi (diretto e dagli stoccaggi): la colonna li mostra tutti e due
    flussi: [flusso('RETE', 600.5), flusso('RETE', 52.34), flusso('ACI', 1.2), flusso('EXTRA_RACCOLTA', 0)] },
  { sito: 'Gatim', chiave: 'gatim', canale: 'RETE', tipo_destinazione: 'imp', giacenza_portale_t: 260.42, giacenza_calcolata_t: 261.62, scarto_t: 1.2, quadra: false,
    giacenze_canale: [gc('RETE', 261.62), gc('ACI', -3.5), gc('EXTRA_RACCOLTA', 0.4)],
    flussi: [flusso('RETE', 261.62), flusso('ACI', 0), flusso('EXTRA_RACCOLTA', 0.4)] },
  { sito: 'TECNOGUM SRL', chiave: 'tecnogum', canale: 'RETE', tipo_destinazione: 'imp', giacenza_portale_t: null, giacenza_calcolata_t: 1833.43, scarto_t: null, quadra: null, dichiara_rete: false,
    giacenze_canale: [gc('RETE', null, { non_dovuta: true }), gc('ACI', 0)],
    flussi: [flusso('RETE', 1833.43, { non_dovuta: true }), flusso('ACI', 0)] },
  { sito: 'T.R.S. SRL', chiave: 'trs', canale: 'RETE', tipo_destinazione: 'imp', giacenza_portale_t: 0, giacenza_calcolata_t: 0, scarto_t: 0, quadra: true,
    giacenze_canale: [gc('RETE', 0)], flussi: [flusso('RETE', 0)] },
  // Gli stoccaggi puri, una riga per canale come le scrive riepilogoDichiarazioni:
  // la rete entra nella quadratura come nella pagina, l'ACI sta a parte.
  { sito: 'NAPPI SUD SRL', chiave: 'nappi sud|RETE', canale: 'RETE', tipo_destinazione: 'stoc', giacenza_portale_t: 25.88, giacenza_calcolata_t: 25.88, scarto_t: 0, quadra: true, giacenze_canale: [], flussi: [] },
  { sito: 'NAPPI SUD SRL', chiave: 'nappi sud|ACI', canale: 'ACI', tipo_destinazione: 'stoc', giacenza_portale_t: 3.1, giacenza_calcolata_t: 3.1, scarto_t: 0, quadra: true, giacenze_canale: [], flussi: [] },
  { sito: 'DEPOSITO NORD SRL', chiave: 'deposito nord|RETE', canale: 'RETE', tipo_destinazione: 'stoc', giacenza_portale_t: 10, giacenza_calcolata_t: 12.5, scarto_t: 2.5, quadra: false, giacenze_canale: [], flussi: [] },
];
// I conteggi della pagina Dichiarazioni Impianti, come li fa riepilogoDichiarazioni
// (totali.siti_che_quadrano / siti_da_quadrare, aci_che_quadrano / aci_da_quadrare).
const confrontabili = SITI.filter(x => x.giacenza_portale_t !== null && x.giacenza_portale_t !== undefined);
const PAGINA = {
  rete: { che: confrontabili.filter(x => x.canale === 'RETE' && x.quadra === true).length, da: confrontabili.filter(x => x.canale === 'RETE' && x.quadra === false).length },
  aci: { che: confrontabili.filter(x => x.canale === 'ACI' && x.quadra === true).length, da: confrontabili.filter(x => x.canale === 'ACI' && x.quadra === false).length },
};
// La colonna «Da dichiarare» come la scrive Riepilogo.jsx, riga per riga: «—» per
// la rete non dovuta, la giacenza in rosso se e' sotto zero, il resto se e'
// sopra zero. La cifra della dashboard e' la somma di quello che la colonna
// mostra come resto.
const colonna = (siti, canale) => {
  let kg = 0;
  for (const s of siti.filter(x => x.tipo_destinazione !== 'stoc')) {
    for (const f of s.flussi.filter(x => x.canale === canale)) {
      if (f.non_dovuta || (f.canale === 'RETE' && s.dichiara_rete === false)) continue;
      const g = (s.giacenze_canale || []).find(x => x.canale === f.canale);
      if (g && g.giacenza_t < 0) continue;
      if (f.resta_t > 0) kg += Math.round(f.resta_t * 1000);
    }
  }
  return kg / 1000;
};
const riga = fotografiaDelGiorno(SITI, { giorno: OGGI, anno: 2026, doppioni: [] });
const fg = leggiFotografia({ ...riga, updated_date: '2026-10-11T03:00:00.000' });
const imp = C.quadroImpianti(fg, { archivi: [] }, OGGI, '2026-10-11T03:00:00.000');
verifica('la fotografia c\'e\' ed e\' di stanotte', imp.stato === 'fresca' && imp.giorno === OGGI && imp.eta_giorni === 0, J(imp));
verifica('quadratura come la pagina Dichiarazioni: «Rete: quadratura con il portale 3 su 5»', imp.quadrano === PAGINA.rete.che && imp.con_confronto === PAGINA.rete.che + PAGINA.rete.da && imp.quadrano === 3 && imp.con_confronto === 5, J([imp.quadrano, imp.con_confronto, PAGINA]));
verifica('dentro: gli impianti con un confronto e gli stoccaggi della rete; non Tecnogum (senza portale), non l\'ACI', J(imp.scostamenti.map(s => [s.sito, s.stoccaggio])) === J([['DEPOSITO NORD SRL', true], ['Gatim', false]]), J(imp.scostamenti));
verifica('chi non quadra coi suoi numeri: calcolata, portale, scarto', J(imp.scostamenti[1]) === J({ sito: 'Gatim', scarto_t: 1.2, calcolata_t: 261.62, portale_t: 260.42, stoccaggio: false }), J(imp.scostamenti[1]));
verifica('l\'ACI degli stoccaggi a parte, come la pagina: 1 su 1, mai nella rete', J(imp.aci_stoccaggi) === J({ con_confronto: PAGINA.aci.che + PAGINA.aci.da, quadrano: PAGINA.aci.che }) && imp.aci_stoccaggi.quadrano === 1, J(imp.aci_stoccaggi));
for (const c of ['RETE', 'ACI', 'EXTRA_RACCOLTA']) {
  verifica(`${c}: la cifra e' la colonna «Da dichiarare» sommata`, imp.da_dichiarare[c].t === colonna(SITI, c), `${imp.da_dichiarare[c].t} / ${colonna(SITI, c)}`);
}
verifica('rete: Irigom e Gatim, 914,46 t; le 1.833,43 t di Tecnogum (non dovute) no', imp.da_dichiarare.RETE.t === 914.46 && imp.da_dichiarare.RETE.impianti === 2, J(imp.da_dichiarare));
verifica('ACI: solo Irigom; la giacenza sotto zero di Gatim sta a parte, mai nella cifra', imp.da_dichiarare.ACI.t === 1.2 && J(imp.sotto_zero) === J([{ sito: 'Gatim', canale: 'ACI', giacenza_t: -3.5 }]), J([imp.da_dichiarare.ACI, imp.sotto_zero]));
verifica('nessun totale fra i canali', !Object.keys(imp).some(k => /totale/i.test(k)) && Object.keys(imp.da_dichiarare).length === 3 && !('totale' in imp.da_dichiarare), J(Object.keys(imp)));
verifica('nessun euro', !/euro|costo|ricavo|prezzo|margine/i.test(J(imp)));
const senza = C.quadroImpianti(null, { archivi: [] }, OGGI);
verifica('senza fotografia: tutto null, col perche\'', senza.stato === 'assente' && senza.da_dichiarare === null && senza.con_confronto === null && senza.quadrano === null && /non ha ancora scritto/.test(senza.perche), J(senza));
const vecchia = C.quadroImpianti({ ...fg, giorno: '2026-10-07' }, { archivi: [] }, OGGI);
verifica('una fotografia di quattro giorni fa: null, e si dice di quando e\'', vecchia.stato === 'vecchia' && vecchia.da_dichiarare === null && /07\/10\/2026/.test(vecchia.perche), J(vecchia));
// Un file caricato dopo la fotografia: i numeri di adesso sono gia' altri.
const archivi = [
  { tipo_file: 'primarie', nome: 'Primarie e assegnati', il: '2026-10-11', concluso_il: '2026-10-11T09:30:00.000Z' },
  { tipo_file: 'terziarie', nome: 'Terziarie', il: '2026-10-10', concluso_il: '2026-10-10T15:00:00.000Z' },
  { tipo_file: 'pdr', nome: 'Punti di raccolta', il: '2026-10-11', concluso_il: '2026-10-11T09:40:00.000Z' },
];
const dopo = C.quadroImpianti(fg, { archivi }, OGGI, '2026-10-11T03:00:00.000');
verifica('le primarie caricate alle 11:30 dopo la notte si dicono, le terziarie di ieri no, i punti di raccolta non contano', J(dopo.caricati_dopo.map(a => a.tipo_file)) === J(['primarie']), J(dopo.caricati_dopo));
const cr = C.cruscotto(base({ fotografiaGiorno: fg, fotografiaScrittaIl: '2026-10-11T03:00:00.000' }));
verifica('il cruscotto porta gli impianti nella risposta', cr.impianti && cr.impianti.stato === 'fresca' && cr.impianti.da_dichiarare.RETE.t === 914.46, J(cr.impianti));

console.log('2. I TARGET DEI RACCOGLITORI: UNA VOCE PER MESE');
const alertTarget = (racc, regione, mese, anno, severita, nonRaggiunto) => ({
  severita, modulo: 'primarie_rete', entity_type: 'TargetMensile', record_id: `${racc}|${regione}|${mese}|${anno}`, stato: 'aperto',
  titolo: `${nonRaggiunto ? 'Target non raggiunto' : 'Target a rischio'}: ${racc} — ${regione} (${mese} ${anno})`,
});
const conTarget = C.cruscotto(base({ alertAperti: [
  alertTarget('ALFA SRL', 'Campania', 'Settembre', 2026, 'critico', true),
  alertTarget('BETA SRL', 'Puglia', 'Settembre', 2026, 'warning', false),
  alertTarget('GAMMA SRL', 'Sicilia', 'Agosto', 2026, 'warning', true),
  { severita: 'warning', modulo: 'primarie_rete', regola_id: 'r1', regola_nome: 'Ritardo SLA' },
] }));
const vTarget = conTarget.da_gestire.filter(v => v.area === 'Target raccoglitori');
const set = vTarget.find(v => v.chiave === 'target:Settembre|2026');
const ago = vTarget.find(v => v.chiave === 'target:Agosto|2026');
verifica('due voci, una per mese', vTarget.length === 2 && set && ago, J(vTarget));
verifica('settembre: critica, due raccoglitori, uno non raggiunto e uno a rischio, coi nomi', set && set.gravita === 'critico' && set.titolo === '2 raccoglitori sotto il target di Settembre 2026'
  && /^1 non raggiunto, 1 a rischio \(proiezione di fine mese sotto il 90% del target\): ALFA SRL, BETA SRL\./.test(set.dettaglio), J(set));
// checkTargetAlerts apre sotto il 70% e tiene aperto fino al 90%: un alert aperto
// all'82% e' «a rischio», e la voce non puo' dire «sotto il 70%».
verifica('«a rischio» dice la soglia dell\'alert aperto, il 90%, mai «sotto il 70%»', set && !/70%/.test(set.dettaglio), set && set.dettaglio);
verifica('porta all\'Andamento di Target & Status, sull\'anno giusto, nella sezione della rete', set && set.link === '/target-status?tab=andamento&anno=2026' && set.sezione === 'rete', J(set));
verifica('agosto: da guardare, al singolare', ago && ago.gravita === 'attenzione' && ago.titolo === 'Un raccoglitore sotto il target di Agosto 2026', J(ago));
const vAlert = conTarget.da_gestire.filter(v => v.area === 'Alert');
verifica('la voce generica degli alert non li conta: resta il ritardo SLA', vAlert.length === 1 && vAlert[0].titolo === '1 alert aperti' && vAlert[0].dettaglio === 'Ritardo SLA (1)', J(vAlert));
verifica('il conto degli alert li conta tutti', conTarget.alert.totale === 4 && conTarget.alert.critici === 1, J(conTarget.alert));
verifica('nascosta, torna se sale il conto (misure) o se c\'e\' un nome nuovo (elementi, con la regione); la firma non ha i nomi', set && J(set.misure) === J([1, 1]) && set.firma === 'Settembre|2026' && J(set.elementi) === J(['ALFA SRL (Campania)', 'BETA SRL (Puglia)']), set && J(set.elementi));

console.log('3. OGNI VOCE HA LA SUA CHIAVE E LA SUA SEZIONE');
const logs = [
  { tipo_file: 'primarie', esito: 'successo', created_date: '2026-09-29T08:00:00', nome_file: 'PRIMARIE.xlsx' },
  { tipo_file: 'secondarie', esito: 'in_corso', created_date: '2026-10-11T07:00:00' },
  { tipo_file: 'secondarie', esito: 'successo', created_date: '2026-10-05T08:00:00' },
];
const tante = (oggi, adesso) => C.cruscotto(base({
  oggi, adessoMs: adesso, tipiFile: ['primarie', 'secondarie', 'terziarie', 'pdr'], uploadLogs: logs,
  alertAperti: [
    { severita: 'critico', regola_nome: 'Ritardo SLA' },
    { severita: 'critico', modulo: 'primarie_rete', canale: 'rete', regola_id: 'date_obbligatorie_rete', quanti: 3, senza_fine: 1 },
    { severita: 'warning', modulo: 'primarie_aci', canale: 'ACI', regola_id: 'date_obbligatorie_ACI', quanti: 1 },
    { severita: 'warning', modulo: 'extra_raccolta', canale: 'extra', regola_id: 'date_obbligatorie_extra', quanti: 1 },
    { severita: 'warning', modulo: 'secondarie', canale: 'rete', regola_id: 'date_obbligatorie_sec', quanti: 2 },
    alertTarget('ALFA SRL', 'Campania', 'Settembre', 2026, 'critico', true),
  ],
  assegnatiRete: [{ id_ordine: 'R1', ordine_immesso_il: '2026-06-01T08:00:00Z' }], assegnatiAci: [{ id_ordine: 'A1', ordine_immesso_il: '2026-06-01T08:00:00Z' }],
  documenti: [], prefatture: [],
  riepilogoQualifica: { scaduti: 1, non_conformi: 0, in_scadenza: 2, anomalie_catalogo: 1 },
  richiesteEct: [{ esito: 'aperta', scadenza: '2026-09-11' }, { esito: 'da_confermare' }],
  verificheSedi: [{ esito: 'diverso', ragione_sociale: 'Rossi' }],
  fotografiaGiorno: { ...fg, giorno: '2026-10-05', scostamenti: [{ sito: 'Gatim', scarto_t: 1.2 }], nota: 'Un impianto si scosta.', doppioni: [{ sito: 'Gatim', mese: 'Luglio', canale: 'RETE', quante: 2, kg_in_piu: 1000 }] },
  annoNuovo: { avvicinandosi: true, anno: 2027, giorni_al_primo_gennaio: 40, mancanti: 2, parziali: 0, voci: [] },
}));
const t1 = tante(OGGI, ADESSO);
const chiavi = t1.da_gestire.map(v => v.chiave);
verifica('ogni voce ha chiave e sezione', t1.da_gestire.length >= 15 && t1.da_gestire.every(v => v.chiave && C.SEZIONI_DASHBOARD.includes(v.sezione)), J(t1.da_gestire.map(v => [v.area, v.chiave, v.sezione])));
verifica('le voci non si ripetono: chiavi tutte diverse', new Set(chiavi).size === chiavi.length, J(chiavi));
verifica('e nemmeno i titoli', new Set(t1.da_gestire.map(v => `${v.area}|${v.titolo}`)).size === t1.da_gestire.length);
const sez = (k) => (t1.da_gestire.find(v => v.chiave === k) || {}).sezione;
verifica('le date per modulo: rete, ACI, extra raccolta, secondarie negli impianti', sez('date:primarie_rete:rete') === 'rete' && sez('date:primarie_aci:ACI') === 'aci' && sez('date:extra_raccolta:extra') === 'extra' && sez('date:secondarie:rete') === 'impianti', J(t1.da_gestire.filter(v => v.area === 'Date obbligatorie').map(v => [v.chiave, v.sezione])));
verifica('l\'arretrato per canale', sez('arretrato:RETE') === 'rete' && sez('arretrato:ACI') === 'aci');
verifica('caricamenti e guardiano nei dati, quadratura e doppioni negli impianti, l\'attiva in fatturazione', sez('caricamento:primarie:vecchio') === 'dati' && sez('lavoro:riepilogoDichiarazioni') === 'dati' && sez('giacenze:scostamenti') === 'impianti' && sez('dichiarazioni:doppioni') === 'impianti' && sez('attiva:da-elaborare') === 'fatturazione', J(t1.da_gestire.map(v => [v.chiave, v.sezione])));
// Il giorno dopo i numeri che crescono da soli sono cresciuti: la chiave resta,
// e le voci che li hanno scrivono misure vuote, cosi' nascoste non tornano.
const t2 = tante('2026-10-12', ADESSO + 86400000);
const vecchio = (r) => r.da_gestire.find(v => v.chiave === 'caricamento:primarie:vecchio');
verifica('«Primarie: dati di 12 giorni fa» e il giorno dopo «13»: stessa chiave, stessa firma, nessuna misura', vecchio(t1) && vecchio(t2) && /12 giorni fa/.test(vecchio(t1).titolo) && /13 giorni fa/.test(vecchio(t2).titolo)
  && vecchio(t1).firma === vecchio(t2).firma && J(vecchio(t1).misure) === '[]', J([vecchio(t1), vecchio(t2)]));
const guard = (r) => r.da_gestire.find(v => v.chiave === 'lavoro:riepilogoDichiarazioni');
verifica('«Il controllo notturno non gira da 6 giorni» e poi 7: stessa chiave e firma, nessuna misura', guard(t1) && guard(t2) && guard(t1).firma === guard(t2).firma && J(guard(t2).misure) === '[]' && /da 7 giorni/.test(guard(t2).titolo), J([guard(t1), guard(t2)]));
const arr = (r) => r.da_gestire.find(v => v.chiave === 'arretrato:RETE');
verifica('l\'arretrato: il piu\' vecchio invecchia, la misura resta il conto oltre i 60 giorni', arr(t1) && J(arr(t1).misure) === J([1]) && J(arr(t2).misure) === J([1]) && arr(t1).firma === arr(t2).firma);
verifica('le chiavi del primo giorno sono quelle del secondo', J(t1.da_gestire.map(v => v.chiave).sort()) === J(t2.da_gestire.map(v => v.chiave).sort()), J([t1.da_gestire.map(v => v.chiave), t2.da_gestire.map(v => v.chiave)]));
verifica('EcoTyna si offre dove ha i dati, non per i lavori della notte ne\' per l\'anno nuovo', C.siChiedeAEcotyna(t1.da_gestire.find(v => v.area === 'Alert')) && !C.siChiedeAEcotyna(guard(t1)) && !C.siChiedeAEcotyna(t1.da_gestire.find(v => v.area === 'Nuovo anno')));
verifica('e la voce lo porta scritto, per la pagina', t1.da_gestire.find(v => v.area === 'Alert').ecotyna === true && guard(t1).ecotyna === false && t1.da_gestire.every(v => typeof v.ecotyna === 'boolean'));

console.log('4. I PRESIDI DELLA NOTTE NELL\'ELENCO');
// Il controllo delle qualifiche (feriali alle 7:30): riuscito giovedi' 8, fallito venerdi' 9 e lunedi' 12.
const ADESSO12 = Date.parse('2026-10-12T08:00:00Z');
const esecuzioni = [
  { id: 'e1', lavoro: 'controlloQualifiche', ultima_partenza: '2026-10-12T05:30:00.000Z', ultima_riuscita: '2026-10-08T05:30:00.000Z', ultimo_esito: 'fallito', errore: 'Rate limit exceeded', fallimenti_di_fila: 2, created_date: '2026-09-01T00:00:00.000' },
  // Il guardiano (riepilogoDichiarazioni alle 5): fallito da tre notti.
  { id: 'e2', lavoro: 'riepilogoDichiarazioni', ultima_partenza: '2026-10-12T03:00:00.000Z', ultima_riuscita: '2026-10-08T03:00:00.000Z', ultimo_esito: 'fallito', errore: 'database non raggiungibile', fallimenti_di_fila: 4, created_date: '2026-09-01T00:00:00.000' },
];
const fgVecchia = { ...fg, giorno: '2026-10-08' };
const presidi = vociPresidi({ esecuzioni, indicatore: fgVecchia, oggi: '2026-10-12', adessoMs: ADESSO12 });
verifica('i presidi di G2 dicono i due lavori', presidi.some(p => p.chiave === 'lavoro:controlloQualifiche') && presidi.some(p => p.chiave === 'lavoro:riepilogoDichiarazioni'), J(presidi));
const cp = C.cruscotto(base({ oggi: '2026-10-12', adessoMs: ADESSO12, fotografiaGiorno: fgVecchia, presidi }));
const delGuardiano = cp.da_gestire.filter(v => v.chiave === 'lavoro:riepilogoDichiarazioni' || /controllo notturno/i.test(v.titolo) || /guardiano/i.test(v.titolo));
verifica('una causa, una voce: il guardiano lo dice il presidio, che sa l\'errore', delGuardiano.length === 1 && delGuardiano[0].origine === 'presidi' && /database non raggiungibile/.test(delGuardiano[0].dettaglio), J(delGuardiano));
const qual = cp.da_gestire.find(v => v.chiave === 'lavoro:controlloQualifiche');
verifica('il presidio: origine, sezione dei dati, e nessuna misura (i giorni crescono da soli)', qual && qual.origine === 'presidi' && qual.sezione === 'dati' && J(qual.misure) === '[]' && qual.firma === 'lavoro:controlloQualifiche', J(qual));
verifica('un\'identita\' rotta va negli impianti', C.unisciPresidi([], [{ area: 'Giacenze', gravita: 'critico', titolo: 'Un\'identità fra moduli si è rotta: Giacenze 1,00 t, Dichiarazioni 3,00 t', dettaglio: 'x', link: '/giacenze', chiave: 'invariante:giacenze_uguali' }])[0].sezione === 'impianti');
const senzaPresidi = C.cruscotto(base({ oggi: '2026-10-12', adessoMs: ADESSO12, fotografiaGiorno: fgVecchia }));
verifica('senza presidi (il giorno della pubblicazione) la voce del cruscotto resta', senzaPresidi.da_gestire.filter(v => v.chiave === 'lavoro:riepilogoDichiarazioni' && v.area === 'Manutenzione' && !v.origine).length === 1, J(senzaPresidi.da_gestire));
verifica('due voci con la stessa chiave non si confondono', J(C.unisciPresidi([{ area: 'X', titolo: 'a', chiave: 'k' }, { area: 'X', titolo: 'b', chiave: 'k' }], []).map(v => v.chiave)) === J(['k', 'k#2']));

console.log('5. LE IDENTITA\' DELLA NOTTE PRIMA, SE IL CONTROLLO DI OGGI NON LE HA SCRITTE');
{
  // cruscottoOperativo vero, impacchettato con un archivio in memoria che ordina
  // come la piattaforma (list e filter col loro ordinamento e il limite) e tiene
  // il conto delle letture. Il caso (revisione delle migliorie, 11/10/2026): il
  // 12/10 la riga «Da dichiarare» di Irigom e' rotta; il 13/10 il guardiano scrive
  // la fotografia, ma controllaInvarianti si ferma prima di scrivere le identita'
  // (un errore, un tempo scaduto). La dashboard leggeva solo l'ultima fotografia,
  // senza identita', e la rotta spariva per un giorno: il battito del controllo
  // parla solo dalla seconda notte.
  const SDK = `
const ordina = (righe, sort) => { const campo = String(sort || 'id').replace(/^[-+]/, ''); const giu = String(sort || '').startsWith('-');
  return [...righe].sort((a, b) => { const c = String(a[campo] ?? '').localeCompare(String(b[campo] ?? '')); return giu ? -c : c; }); };
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in)) ? v.$in.includes(r[k]) : r[k] === v);
const tab = (n) => globalThis.__CQ_DB[n] || [];
const entita = (nome) => ({
  list: async (sort, lim = 1e9, salta = 0) => { globalThis.__CQ_LETTE.push({ nome, sort, lim }); return ordina(tab(nome), sort).slice(salta, salta + lim).map(r => ({ ...r })); },
  filter: async (f, sort, lim = 1e9, salta = 0) => { globalThis.__CQ_LETTE.push({ nome, sort, lim }); return ordina(tab(nome).filter(r => soddisfa(r, f)), sort).slice(salta, salta + lim).map(r => ({ ...r })); },
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova@prova' }) }, asServiceRole: { entities }, entities };
}`;
  const pacchetto = await build({
    entryPoints: [fileURLToPath(new URL('../base44/functions/cruscottoOperativo/entry.ts', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK, loader: 'js' }));
    } }],
  });
  const cruscottoOperativo = (await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'))).default;
  const OraVera = Date;
  const ADESSO13 = OraVera.parse('2026-10-13T08:00:00Z');
  const apri = async (righe) => {
    globalThis.__CQ_DB = { IndicatoreGiorno: righe };
    globalThis.__CQ_LETTE = [];
    globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ADESSO13); } static now() { return ADESSO13; } };
    try {
      const r = await cruscottoOperativo({ json: async () => ({}) });
      return { stato: r.status, j: await r.json(), lette: globalThis.__CQ_LETTE.filter(l => l.nome === 'IndicatoreGiorno') };
    } finally { globalThis.Date = OraVera; }
  };
  const identita = (r) => ((r.j && r.j.da_gestire) || []).filter(v => String(v.chiave || '').startsWith('invariante:'));
  const irigom = (resta_t) => ({ siti: [{ sito: 'IRIGOM SRL', chiave: 'irigom', tipo_destinazione: 'imp',
    giacenze_canale: [{ canale: 'RETE', giacenza_t: 652.84 }], flussi: [{ canale: 'RETE', provenienza: '', resta_t, uscito_oltre_kg: resta_t ? 0 : 652840 }] }], stoccaggi: [], doppioni: [] });
  const esitoDel = (giorno, resta_t) => JSON.stringify(verificaInvarianti({ dichiarazioni: irigom(resta_t) }, { voci: [VOCI_INVARIANTI[1]], giorno, anno: 2026, il: giorno + 'T03:00:40.000Z' }));
  const foto = (giorno, extra = {}) => ({ id: 'ig-' + giorno, giorno, anno: 2026, esito: 'in_linea', nota: '', siti_json: '[]', totali_json: '{}', scostamenti_json: '[]', doppioni_json: '[]', updated_date: giorno + 'T03:00:05.000', ...extra });

  // In ordine sparso: la lettura chiede le piu' recenti per giorno.
  const r = await apri([foto('2026-10-11', { invarianti_json: esitoDel('2026-10-11', 652.84) }), foto('2026-10-13'), foto('2026-10-12', { invarianti_json: esitoDel('2026-10-12', 0) })]);
  const id = identita(r);
  verifica('il 13/10 il controllo non ha scritto: la rotta del 12/10 resta, rossa, coi due numeri e il giorno del controllo', r.stato === 200 && id.length === 1 && id[0].gravita === 'critico'
    && id[0].titolo === "Un'identità fra moduli si è rotta: Da dichiarare 0,00 t, Giacenza del canale 652,84 t" && id[0].dettaglio.endsWith('Controllo del 12/10/2026.'), J(r.stato === 200 ? id : r.j));
  verifica('il resto della fotografia resta quello di oggi', r.j.impianti && r.j.impianti.giorno === '2026-10-13', J(r.j.impianti));
  verifica('le fotografie: una lettura sola, le ultime due per giorno', r.lette.length === 1 && r.lette[0].sort === '-giorno' && r.lette[0].lim === 2, J(r.lette));
  // Oggi le identita' ci sono, a posto: quelle di ieri non contano piu'.
  const r2 = await apri([foto('2026-10-12', { invarianti_json: esitoDel('2026-10-12', 0) }), foto('2026-10-13', { invarianti_json: esitoDel('2026-10-13', 652.84) })]);
  verifica('se il controllo di oggi ha scritto, valgono le sue: a posto, nessuna voce', r2.stato === 200 && identita(r2).length === 0, J(identita(r2)));
  // Si guarda una riga sola indietro: due notti senza identita' le dice il battito.
  const r3 = await apri([foto('2026-10-11', { invarianti_json: esitoDel('2026-10-11', 0) }), foto('2026-10-12'), foto('2026-10-13')]);
  verifica('due notti senza identita\': niente dalla terza riga (lo dice il battito del controllo)', r3.stato === 200 && identita(r3).length === 0, J(identita(r3)));
  const r4 = await apri([foto('2026-10-13', { invarianti_json: esitoDel('2026-10-13', 0) })]);
  verifica('una riga sola, con le sue identita\': la voce di oggi', r4.stato === 200 && identita(r4).length === 1 && identita(r4)[0].dettaglio.endsWith('Controllo del 13/10/2026.'), J(identita(r4)));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
