// Prova della lettura della predittivita' delle secondarie
// (base44/shared/predittivitaDati.ts, leggiDatiPredittivita) con un SDK finto
// che capisce i filtri della piattaforma ($gte, $in, null):
//   - si legge solo la finestra che serve (dal 31/12 dell'anno prima, o da
//     prima se il ritmo lo chiede), e i terminati senza fine trasporto a parte;
//   - la configurazione e' dell'anno: un record senza anno vale per il 2026;
//   - il target di un raccoglitore senza impianto si divide fra i siti seguiti
//     in proporzione a quello che ci ha portato nell'anno;
//   - la giacenza di un piazzale parte dall'ancora dell'anno, e senza ancora si
//     dice;
//   - una fine della programmazione di un altro anno non vale.
// Il motore: prove/predittivita.mjs. npm run prove
import { leggiDatiPredittivita, annoDelRecord } from '../base44/shared/predittivitaDati.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);

// --- l'SDK finto: filtri per uguaglianza, $gte, $in e null (il campo manca o e'
// vuoto); un operatore che non conosce e' un errore, cosi' la prova se ne accorge.
const corrisponde = (valore, atteso) => {
  if (atteso === null) return valore === null || valore === undefined;
  if (atteso && typeof atteso === 'object' && !Array.isArray(atteso)) {
    for (const op of Object.keys(atteso)) if (!['$gte', '$in'].includes(op)) throw new Error(`operatore sconosciuto: ${op}`);
    if ('$gte' in atteso && !(valore !== null && valore !== undefined && String(valore) >= String(atteso.$gte))) return false;
    if ('$in' in atteso && !atteso.$in.includes(valore)) return false;
    return true;
  }
  return valore === atteso;
};
function sdkFinto(archivi) {
  const letture = [];
  const entita = (nome) => ({
    filter: async (f, _ordine, quanti = 1e9, salta = 0) => {
      letture.push({ nome, filtro: f });
      return (archivi[nome] || []).filter(r => Object.entries(f || {}).every(([k, v]) => corrisponde(r[k], v))).slice(salta, salta + quanti);
    },
    list: async (_ordine, quanti = 1e9, salta = 0) => { letture.push({ nome, filtro: null }); return (archivi[nome] || []).slice(salta, salta + quanti); },
  });
  const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
  return { base44: { asServiceRole: { entities }, entities }, letture };
}

// --- gli archivi
let n = 0;
const fine = (g) => (g.length === 10 ? `${g}T10:00:00Z` : g);
const date = (g) => ({ ordine_immesso_il: fine(g), trasporto_iniziato_il: fine(g), trasporto_finito_il: fine(g) });
const prim = (trasportatore, destinazione, kg, giorno, extra = {}) => ({ id: 'p' + (++n), id_ordine: 'P' + n, stato: 'terminato', classe: 'P', trasportatore, destinazione, tipo_destinazione: 'imp', peso_effettivo: kg, ...date(giorno), ...extra });
const sec = (stoccaggio, destinazione, kg, giorno, extra = {}) => ({ id: 's' + (++n), id_ordine: 'S' + n, stato: 'terminato', classe: 'P', stoccaggio, destinazione, tipo_destinazione: 'imp', peso_effettivo: kg, ...date(giorno), ...extra });
const ARCHIVI = {
  ImpiantoTargetSecondaria: [
    { id: 'iTg', nome_impianto: 'Tecnogum Srl', target: 2295000, stato: 'attivo' },                                   // senza anno: 2026
    { id: 'iIr', nome_impianto: 'Irigom Srl', target: 4445000, anno: 2026, stato: 'attivo', data_fine: '2025-12-18' }, // fine di un altro anno
    { id: 'iTc', nome_impianto: 'T-CYCLE INDUSTRIES SRL', target: 1050000, anno: 2026, stato: 'attivo', data_fine: '2026-11-30' },
    { id: 'iGa', nome_impianto: 'Gatim', target: 900000, anno: 2025, stato: 'attivo' },
    { id: 'iIn', nome_impianto: 'Innorec', target: 500000, stato: 'sospeso' },
  ],
  FornitoreSecondaria: [
    { id: 'f1', nome: 'Nappi Sud', impianto_id: 'iTg', ruolo: 'stoccaggio', priorita: 2, stato: 'attivo' },
    { id: 'f2', nome: 'NAPPI SUD SRL', impianto_id: 'iIr', ruolo: 'stoccaggio', plafond_stoccaggio_kg: 0, anno: 2026, stato: 'attivo' },
    { id: 'f3', nome: 'T-Cycle', impianto_id: 'iTg', ruolo: 'doppio_ruolo', plafond_stoccaggio_kg: 250000, anno: 2026, stato: 'attivo' },
    { id: 'f4', nome: 'Deposito Vecchio', impianto_id: 'iGa', ruolo: 'stoccaggio', anno: 2025, stato: 'attivo' },
    { id: 'f5', nome: 'C.L. Service', impianto_nome: 'Irigom Srl', ruolo: 'raccoglitore', stato: 'attivo' },
    { id: 'f6', nome: 'Deposito Nord', impianto_nome: 'Tecnogum', tipo: 'Stoccaggio', stato: 'attivo' },        // senza ruolo: vale il tipo
    { id: 'f7', nome: 'Deposito Spento', impianto_id: 'iTg', ruolo: 'stoccaggio', stato: 'disattivo' },
    { id: 'f8', nome: 'Irigom', impianto_id: 'iIr', ruolo: 'stoccaggio', stato: 'attivo' },                    // il piazzale di Irigom, per Irigom
    { id: 'f9', nome: 'Deposito Gatim', impianto_nome: 'Gatim', ruolo: 'stoccaggio', stato: 'attivo' },         // per un impianto non seguito nel 2026
  ],
  TargetRaccoglitore: [
    { raccoglitore: 'C.L. Service', target_tonnellate: 200, anno: 2026 },                    // senza impianto: si divide
    { raccoglitore: 'Smoco', target_tonnellate: 1500, anno: 2026, impianto: 'Irigom Srl' },
    { raccoglitore: 'Emmesse', target_tonnellate: 100, anno: 2025 },
    { raccoglitore: 'Nessuno', target_tonnellate: 50, anno: 2026 },                          // senza impianto e senza consegne
    { raccoglitore: 'Zero', target_tonnellate: 0, anno: 2026, impianto: 'Irigom' },
  ],
  PrimariaRete: [
    prim('C.L. Service', 'Nappi Sud Srl', 30000, '2026-03-10', { tipo_destinazione: 'stoc' }),
    prim('C.L. Service', 'T-Cycle', 10000, '2026-04-10'),
    prim('C.L. Service', 'Altro Sito', 5000, '2026-04-11'),                                  // un sito che non si segue
    prim('C.L. Service', 'T-Cycle', 99000, '2025-12-31'),                                    // letta, ma dell'anno prima
    prim('C.L. Service', 'T-Cycle', 88000, '2025-06-10'),                                    // fuori dalla finestra: non si legge
    prim('Smoco', 'Irigom', 1000, '2025-12-31T23:30:00Z'),                                   // il 1 gennaio italiano
    prim('Smoco', 'Irigom', 7000, '2026-05-05', { classe: '9 - PFU Autodemolizione' }),      // ACI
    prim('Smoco', 'Irigom', 7000, '2026-05-05', { stato: 'assegnato' }),
    prim('Nappi Sud', 'Nappi Sud', 20000, '2026-05-05', { tipo_destinazione: 'stoc' }),
    prim('Logistica', 'T-Cycle', 50000, '2026-03-01', { tipo_destinazione: 'stoc' }),
    { id: 'pSF', id_ordine: 'PSF', stato: 'terminato', classe: 'P', trasportatore: 'Smoco', destinazione: 'Irigom', peso_effettivo: 3000, ordine_immesso_il: '2026-09-01T08:00:00Z', trasporto_iniziato_il: '2026-09-01T08:00:00Z', trasporto_finito_il: null },
  ],
  Secondaria: [
    sec('Nappi Sud', 'Tecnogum', 13000, '2026-06-01'),
    sec('T-Cycle', 'Tecnogum', 40000, '2026-06-02'),
    sec('Deposito Est', 'Irigom', 13000, '2026-07-01'),                                      // uno stoccaggio che nessuno ha registrato
    sec('Irigom', 'Irigom', 5000, '2026-07-02'),                                             // dal proprio piazzale: non e' uno stoccaggio
    sec('Nappi Sud', 'Tecnogum', 13000, '2025-05-05'),                                       // fuori dalla finestra
    sec('Nappi Sud', 'Tecnogum', 13000, '2026-09-18'),
    { id: 'sSF', id_ordine: 'SSF', stato: 'terminato', classe: 'P', stoccaggio: 'Nappi Sud', destinazione: 'Tecnogum', peso_effettivo: 13000 },
  ],
  GiacenzaStoccaggio: [
    { id: 'g1', sito: 'NAPPI SUD SRL', data_rilevazione: '2025-12-31', class1_kg: 10000, class2_kg: 5000, class9_kg: 999 },
    { id: 'g2', sito: 'Nappi Sud', data_rilevazione: '2026-09-01', class1_kg: 77777 },    // un riscontro, non il punto di partenza
    { id: 'g3', sito: 'T-Cycle', data_rilevazione: '2026-02-01', class1_kg: 20000 },       // la prima lettura dell'anno
    { id: 'g4', sito: 'Deposito Nord', data_rilevazione: '2025-06-30', class1_kg: 5000 },  // di un anno fa: non e' un'ancora
    { id: 'g5', sito: 'Irigom Srl', data_rilevazione: '2025-12-31', class1_kg: 8000 },     // il piazzale di un impianto seguito al 31/12
  ],
  PianificazioneSettimanale: [
    { id: 'w1', anno: 2026, data_inizio: '2026-09-21', fornitore_nome: 'Nappi Sud', impianto_nome: 'Tecnogum Srl', viaggi_previsti: 4, origine: 'programma' },
    { id: 'w2', anno: 2025, data_inizio: '2025-09-22', fornitore_nome: 'Nappi Sud', impianto_nome: 'Tecnogum Srl', viaggi_previsti: 3, origine: 'programma' },
  ],
  UploadLog: [],
};

console.log('SI LEGGE SOLO LA FINESTRA');
const { base44, letture } = sdkFinto(ARCHIVI);
const dati = await leggiDatiPredittivita(base44, { anno: 2026, oggi: '2026-09-23' });
const filtriDi = (nome) => letture.filter(l => l.nome === nome).map(l => l.filtro);
verifica('primarie e secondarie: i terminati dalle 12 settimane prima del 1/1 (la finestra del ritmo a inizio anno), e i terminati senza fine trasporto',
  ['PrimariaRete', 'Secondaria'].every(a => J(filtriDi(a)) === J([{ stato: 'terminato', trasporto_finito_il: { $gte: '2025-10-07T00:00:00' } }, { stato: 'terminato', trasporto_finito_il: null }])), J(letture.filter(l => ['PrimariaRete', 'Secondaria'].includes(l.nome))));
verifica('gli archivi dei movimenti non si leggono mai interi', !letture.some(l => ['PrimariaRete', 'Secondaria'].includes(l.nome) && !l.filtro));
verifica('quanti record sono arrivati', J(dati.lettura) === J({ dal: '2025-10-07', primarie: 8, secondarie: 5 }), J(dati.lettura));
const idsP = dati.ingresso.primarie.map(r => r.id_ordine);
verifica('fuori dalla finestra non arriva niente; l\'ACI e i non terminati restano fuori', !idsP.includes('P5') && !idsP.includes('P7') && !idsP.includes('P8') && idsP.includes('P6') && idsP.includes('P4') && idsP.length === 7, J(idsP));
verifica('i terminati senza fine trasporto, a parte', dati.senza_fine && dati.senza_fine.primarie.map(r => r.id_ordine).join() === 'PSF' && dati.senza_fine.secondarie.map(r => r.id_ordine).join() === 'SSF', J(dati.senza_fine));
verifica('il programma fissato dell\'anno', dati.programmati.map(r => r.id).join() === 'w1' && J(filtriDi('PianificazioneSettimanale')) === J([{ anno: 2026 }]), J(dati.programmati));
verifica('i target dei raccoglitori dell\'anno', J(filtriDi('TargetRaccoglitore')) === J([{ anno: 2026 }]));
verifica('nessun caricamento in corso', dati.caricamento_in_corso === null, String(dati.caricamento_in_corso));
// Con il ritmo a cavallo d'anno la finestra comincia prima: a meta' gennaio
// servono le 14 settimane prima di oggi.
const gennaio = sdkFinto(ARCHIVI);
await leggiDatiPredittivita(gennaio.base44, { anno: 2027, oggi: '2027-01-13' });
verifica('a gennaio si legge anche la fine dell\'anno prima', gennaio.letture.some(l => l.nome === 'PrimariaRete' && l.filtro && l.filtro.trasporto_finito_il && l.filtro.trasporto_finito_il.$gte === '2026-10-06T00:00:00'), J(gennaio.letture.filter(l => l.nome === 'PrimariaRete')));

console.log('LA CONFIGURAZIONE DELL\'ANNO');
verifica('un record senza anno vale per il 2026', annoDelRecord({}) === 2026 && annoDelRecord({ anno: 2025 }) === 2025 && annoDelRecord({ anno: '2027' }) === 2027 && annoDelRecord(null) === 2026);
const imp = (k) => dati.ingresso.impianti.find(i => i.chiave === k);
verifica('gli impianti seguiti del 2026: con e senza anno, non quelli del 2025 ne\' i sospesi', dati.ingresso.impianti.map(i => i.chiave).join() === 'tecnogum,irigom,t-cycle', J(dati.ingresso.impianti));
verifica('la giacenza al 31/12 del piazzale di un impianto (esce per prima); una prima lettura a meta\' anno non lo e\'', imp('irigom').giacenza_iniziale_kg === 8000 && imp('t-cycle').giacenza_iniziale_kg === 0 && imp('tecnogum').giacenza_iniziale_kg === 0, J(dati.ingresso.impianti));
verifica('target e fine di ciascuno', imp('tecnogum').target_kg === 2295000 && imp('tecnogum').fine === '2026-12-18' && imp('t-cycle').fine === '2026-11-30' && imp('irigom').target_kg === 4445000, J(dati.ingresso.impianti));
const fineAltroAnno = dati.avvisi.find(a => a.tipo === 'fine_di_un_altro_anno');
verifica('una fine della programmazione di un altro anno non vale, e si dice', imp('irigom').fine === '2026-12-18' && fineAltroAnno && fineAltroAnno.impianto === 'Irigom Srl' && fineAltroAnno.testo.includes('18/12/2025') && fineAltroAnno.testo.includes('si usa il 18/12/2026'), J(fineAltroAnno));
verifica('il 2026 ha la sua fine della programmazione', dati.ingresso.fine === '2026-12-18' && !dati.avvisi.some(a => a.tipo === 'fine_non_definita'));
verifica('la configurazione dell\'anno, per chi la mostra', dati.configurazione.impianti.map(i => i.id).join() === 'iTg,iIr,iTc' && !dati.configurazione.fornitori.some(f => f.id === 'f4'), J(dati.configurazione.fornitori.map(f => f.id)));
verifica('le regole dell\'anno nell\'ingresso del motore', dati.ingresso.regole.kg_per_viaggio === 13000 && dati.ingresso.anno === 2026 && dati.ingresso.oggi === '2026-09-23');
const del2025 = await leggiDatiPredittivita(sdkFinto(ARCHIVI).base44, { anno: 2025, oggi: '2025-12-31' });
verifica('il 2025 ha la sua configurazione: Gatim si', del2025.ingresso.impianti.map(i => i.chiave).join() === 'gatim', J(del2025.ingresso.impianti));
verifica('un anno senza fine della programmazione scritta usa il 31/12, e lo dice', del2025.ingresso.fine === '2025-12-31' && del2025.avvisi.some(a => a.tipo === 'fine_non_definita' && a.testo.includes('2025')), J(del2025.avvisi));

console.log('I TARGET DEI RACCOGLITORI');
const racc = (nome) => dati.ingresso.raccoglitori.filter(r => r.nome === nome);
// C.L. Service: 30 t a Nappi Sud e 10 t a T-Cycle nel 2026 (le 5 t ad Altro
// Sito non si seguono, le 99 t del 31/12/2025 sono dell'anno prima): dei 200 t
// di target 150 a Nappi Sud e 50 a T-Cycle.
const cl = racc('C.L. Service');
verifica('senza impianto: diviso in proporzione a quello che ha portato ai siti seguiti', cl.length === 2 && cl.find(r => r.sito === 'nappi sud').target_kg === 150000 && cl.find(r => r.sito === 't-cycle').target_kg === 50000 && cl.every(r => r.diviso === true && r.chiave === 'cl service'), J(cl));
verifica('con l\'impianto: tutto li\'', J(racc('Smoco')) === J([{ chiave: 'smoco', nome: 'Smoco', sito: 'irigom', target_kg: 1500000 }]), J(racc('Smoco')));
verifica('senza consegne, a zero o di un altro anno: niente', !racc('Nessuno').length && !racc('Zero').length && !racc('Emmesse').length && dati.ingresso.raccoglitori.length === 3, J(dati.ingresso.raccoglitori));

console.log('GLI STOCCAGGI');
const sto = (k) => dati.ingresso.stoccaggi.find(s => s.chiave === k);
verifica('registrati per l\'anno e quelli che hanno spedito a un impianto seguito', dati.ingresso.stoccaggi.map(s => s.chiave).sort().join() === 'deposito est,deposito nord,nappi sud,t-cycle', J(dati.ingresso.stoccaggi.map(s => s.chiave)));
verifica('le destinazioni con la priorita\' scritta, e il plafond', J(sto('nappi sud').destinazioni) === J([{ impianto: 'tecnogum', priorita: 2 }, { impianto: 'irigom', priorita: null }]) && sto('nappi sud').plafond_kg === null && sto('t-cycle').plafond_kg === 250000 && J(sto('t-cycle').destinazioni) === J([{ impianto: 'tecnogum', priorita: null }]), J([sto('nappi sud'), sto('t-cycle')]));
verifica('uno stoccaggio non registrato non ha destinazioni scritte: le trova il motore', sto('deposito est').destinazioni.length === 0 && sto('deposito est').nome === 'Deposito Est');
// Il piazzale di Irigom registrato per Irigom non alimenta nessun altro, e uno
// stoccaggio registrato per un impianto che quest'anno non si segue nemmeno: il
// motore li lascerebbe fuori, e non si chiede per loro l'ancora.
verifica('non e\' una fonte il piazzale che alimenta solo il proprio impianto, ne\' quello di un impianto non seguito', !sto('irigom') && !sto('deposito gatim') && !dati.avvisi.some(a => ['Irigom', 'Deposito Gatim'].includes(a.stoccaggio)), J(dati.avvisi.filter(a => a.tipo === 'ancora_mancante')));

console.log('LA GIACENZA DALL\'ANCORA');
// Nappi Sud: 15 t di rete al 31/12/2025 (la classe 9 e' ACI), piu' 30 t di
// C.L. Service e 20 t sue scaricate nel piazzale, meno le 13 t partite per
// Tecnogum il 01/06 e le 13 del 18/09. La lettura del 01/09 e' un riscontro.
verifica('Nappi Sud: l\'ancora al 31/12 piu\' i movimenti dopo', sto('nappi sud').giacenza_kg === 15000 + 30000 + 20000 - 13000 - 13000 && sto('nappi sud').giacenza_da === '2025-12-31', J(sto('nappi sud')));
verifica('T-Cycle: senza il 31/12, la prima lettura dell\'anno', sto('t-cycle').giacenza_kg === 20000 + 50000 - 40000 && sto('t-cycle').giacenza_da === '2026-02-01', J(sto('t-cycle')));
const ancoraMancante = dati.avvisi.filter(a => a.tipo === 'ancora_mancante');
verifica('senza ancora niente giacenza, e si dice dove inserirla', sto('deposito nord').giacenza_kg === null && sto('deposito est').giacenza_kg === null
  && ancoraMancante.map(a => a.stoccaggio).sort().join() === 'Deposito Est,Deposito Nord' && ancoraMancante[0].testo.includes('31/12/2025') && ancoraMancante[0].testo.includes('Giacenze'), J(ancoraMancante));

console.log('UN CARICAMENTO DURANTE LA LETTURA');
const conCaricamento = await leggiDatiPredittivita(sdkFinto({ ...ARCHIVI, UploadLog: [{ id: 'u1', tipo_file: 'secondarie', esito: 'in_corso', created_date: '2026-09-23T07:55:00', nome_file: 'secondarie.xlsx', utente: 'Mario' }] }).base44, { anno: 2026, oggi: '2026-09-23' });
verifica('un caricamento aperto si dice', typeof conCaricamento.caricamento_in_corso === 'string' && conCaricamento.caricamento_in_corso.includes('secondarie'), String(conCaricamento.caricamento_in_corso));
// Se la piattaforma non capisse il filtro sui senza fine trasporto, la lettura
// va avanti lo stesso e lo dice (senza_fine null): la risposta lo segnala.
const entitaVere = sdkFinto(ARCHIVI).base44.asServiceRole.entities;
const rifiutaNull = new Proxy({}, { get: (_t, nome) => {
  const e = entitaVere[nome];
  if (nome !== 'PrimariaRete') return e;
  return { ...e, filter: async (f, ...resto) => { if (f && f.trasporto_finito_il === null) throw new Error('filtro non capito'); return e.filter(f, ...resto); } };
} });
const senzaFineNonLetti = await leggiDatiPredittivita({ asServiceRole: { entities: rifiutaNull } }, { anno: 2026, oggi: '2026-09-23' });
verifica('se i senza fine trasporto non si leggono si sa, e il resto va avanti', senzaFineNonLetti.senza_fine === null && senzaFineNonLetti.ingresso.primarie.length === 7, J(senzaFineNonLetti.senza_fine));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
