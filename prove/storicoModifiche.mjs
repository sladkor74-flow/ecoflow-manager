// LO STORICO DELLE MODIFICHE AI NUMERI CHE FANNO I CONTI (11/10/2026).
//
// Prima la piattaforma conservava solo updated_date: di un target, di
// un'apertura o di una tariffa non si sapeva chi l'avesse cambiata, quando, da
// quale valore e perche'. Il 10/10/2026 una voce della passiva e' passata da 300
// a 90 €/t e lo ricordava solo la memoria di una sessione. Qui si prova che:
//   1. la regola (shared/campiTracciati.ts) registra solo i campi tracciati che
//      cambiano davvero: niente righe finte per un JSON riscritto uguale o per
//      un costo vuoto salvato a zero, ma un'apertura vuota che diventa 0 si'
//      (un valore mancante non e' zero);
//   2. il motore rilegge, scrive e registra; se il registro non si scrive il
//      dato resta e la risposta lo dice;
//   3. l'involucro delle pagine (src/lib/scriviConTraccia.js) mette chi scrive;
//   4. la pagina racconta le modifiche all'italiana (src/lib/storicoModifiche.js);
//   5. gestisciAnagrafiche e preparaAnno, le funzioni vere, lasciano le righe
//      (la voce 300 -> 90 del 10/10 avrebbe la sua);
//   6. lo strumento storico_modifiche di EcoTyna risponde a «chi ha cambiato il
//      target di Irigom» e tiene i costi all'amministratore.
//   8. il surplus sulle tariffe (13/10/2026, il Fuel Surcharge) si traccia come
//      un prezzo: l'importo ai fornitori riservato, quello da Ecotyre no, i
//      fornitori dell'elenco per nome e senza contare l'ordine.
//   9. i recapiti del fornitore che leggono i contratti (cellulare, pec,
//      referente; decisioni dell'utente del 13/10/2026) si tracciano; lo
//      stato e gli altri campi del fornitore no, e non costano letture.
//
// Revisione delle migliorie (11/10/2026), i rilievi dei revisori:
//   - un impianto cancellato: EcoTyna diceva in «kg» un target gia' in
//     tonnellate (1.050 kg per 1.050 t);
//   - il criterio di una voce della passiva riscritto con le chiavi in un altro
//     ordine (8 voci vere di Irigom) e le tabelle vuote di una commessa nuova
//     lasciavano righe di modifiche mai avvenute;
//   - la ripartizione per classe compariva come frazione (0,3 per il 30%) e
//     EcoTyna sentiva dire che i numeri delle tabelle erano tutti tonnellate;
//   - la copia dell'anno nuovo di Target & Status (copiaAnnoTarget) non lasciava
//     nessuna riga, ne' alla copia ne' alla conferma.
//
// Le code lasciate dalla verifica di quei rilievi (stesso giro):
//   - la finestra della copia in Target & Status diceva solo «Fatto.» anche
//     quando il registro non si era scritto (sezione 7);
//   - dopo la conferma, che non lascia righe, la nota a EcoTyna diceva ancora
//     al presente che i valori copiati erano «da confermare»;
//   - una riga di tabella nuova o tolta senza nessun valore (le cinque regioni
//     vuote di una commessa nuova fatta dalla scheda) si diceva come JSON
//     grezzo, a video e a EcoTyna.
//
// Dal 14/10/2026 anche le conferme di Target & Status lasciano la riga
// (registraConferma, la regola righeDiConferma): la sezione 6 prova che EcoTyna
// la riceve e che la nota non la smentisce. Le pagine vere che confermano sono
// in prove/confermeNelloStorico.mjs.
//
// node prove/storicoModifiche.mjs
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { caricaLibPagine } from './dati/libPagine.mjs';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';
import {
  modificheDelRecord, righeDiModifica, etichettaDi, campoRiservato, unitaDelCampo, differenzeJson,
  scriviTracciato, eliminaTracciato, creaTracciati, eliminaTracciati, notaTraccia, toccaCampiTracciati,
} from '../base44/shared/campiTracciati.ts';
import { traccia, eliminaConTraccia, utenteDellaRichiesta, registraConferma } from '../base44/shared/traccia.ts';
import { STRUMENTI, catalogoStrumenti, eseguiStrumento } from '../base44/shared/strumentiAssistente.ts';
import { campoTracciato } from '../base44/shared/campiTracciati.ts';
import { annoCorrenteRoma } from '../base44/shared/annoTarget.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (v) => JSON.stringify(v);
// Le cinque regioni come le salva la scheda di una commessa nuova
// (CommessaEcotyreForm, statoDaRecord(null)): i nomi, nessun valore.
const REGIONI = ['Campania', 'Puglia', 'Basilicata', 'Calabria', 'Sicilia'];
const REGIONI_VUOTE = J(REGIONI.map(r => ({ regione: r, province: '', target_t: null })));
const senzaJson = (diff) => (diff || []).every(d => Object.values(d).every(v => !String(v).includes('{')));

// Un archivio in memoria: conta le letture, e il registro puo' rifiutare.
function archivioFinto(dati = {}, { registroRotto = false } = {}) {
  const db = JSON.parse(J(dati));
  const conti = { get: 0, update: 0, create: 0, delete: 0, bulkCreate: 0 };
  let n = 0;
  const tab = (e) => (db[e] = db[e] || []);
  const ent = (e) => ({
    get: async (id) => { conti.get++; const r = tab(e).find(x => x.id === id); if (!r) throw new Error('non trovato ' + id); return { ...r }; },
    update: async (id, p) => { conti.update++; const t = tab(e); const i = t.findIndex(x => x.id === id); t[i] = { ...t[i], ...p }; return { ...t[i] }; },
    create: async (r) => {
      if (e === 'ModificaDato' && registroRotto) throw new Error('Rate limit exceeded');
      conti.create++; const nuovo = { id: `${e}-${++n}`, ...r }; tab(e).push(nuovo); return { ...nuovo };
    },
    bulkCreate: async (rr) => {
      if (e === 'ModificaDato' && registroRotto) throw new Error('Rate limit exceeded');
      conti.bulkCreate++; return rr.map(r => { const nuovo = { id: `${e}-${++n}`, ...r }; tab(e).push(nuovo); return { ...nuovo }; });
    },
    delete: async (id) => { conti.delete++; const t = tab(e); const i = t.findIndex(x => x.id === id); if (i < 0) throw new Error('non trovato ' + id); t.splice(i, 1); return {}; },
    filter: async (f) => tab(e).filter(r => Object.entries(f || {}).every(([k, v]) => r[k] === v)).map(r => ({ ...r })),
    list: async () => tab(e).map(r => ({ ...r })),
  });
  const archivi = new Proxy({}, { get: (_t, nome) => ent(String(nome)) });
  return { archivi, db, conti };
}

console.log('1. LA REGOLA: SI REGISTRA SOLO QUELLO CHE CAMBIA');
{
  const prima = { id: 'i1', nome_impianto: 'IRIGOM S.R.L.', anno: 2026, target: 1050000, stato: 'attivo' };
  const m = modificheDelRecord('ImpiantoTargetSecondaria', { prima, dopo: { ...prima, target: 1200000 }, patch: { target: 1200000 } });
  verifica('il target che cambia fa una riga, col prima e il dopo', m.length === 1 && m[0].campo === 'target' && m[0].prima === '1050000' && m[0].dopo === '1200000' && m[0].unita === 'kg', J(m));
  verifica('lo stesso target riscritto non fa righe', modificheDelRecord('ImpiantoTargetSecondaria', { prima, dopo: prima, patch: { target: 1050000 } }).length === 0);
  verifica("un campo che non conta (segue la nota) non fa righe", modificheDelRecord('ImpiantoTargetSecondaria', { prima, dopo: { ...prima, note: 'x' }, patch: { note: 'x' } }).length === 0);
  verifica('e non chiede nemmeno una lettura', !toccaCampiTracciati('ImpiantoTargetSecondaria', { note: 'x' }) && toccaCampiTracciati('ImpiantoTargetSecondaria', { target: 1 }));
  verifica("lo stato scritto 'attivo' su un record senza stato non e' una modifica",
    modificheDelRecord('ImpiantoTargetSecondaria', { prima: { id: 'i1' }, dopo: { id: 'i1', stato: 'attivo' }, patch: { stato: 'attivo' } }).length === 0);

  // La commessa riscrive tutte le tabelle a ogni salvataggio: conta il contenuto.
  const c = { id: 'c1', anno: 2026, target_mensile_json: '[900, 950]' };
  verifica('una tabella della commessa riscritta uguale (spazi diversi) non e\' una modifica',
    modificheDelRecord('CommessaEcotyre', { prima: c, dopo: { ...c, target_mensile_json: '[900,950]' }, patch: { target_mensile_json: '[900,950]' } }).length === 0);

  // Extra raccolta: il modulo salva a zero i costi vuoti, e zero vuol dire vuoto.
  const er = { id: 'e1', costo_raccolta_t: null, prezzo_attivo_t: undefined };
  verifica('un costo vuoto salvato a zero sull\'extra raccolta non fa righe',
    modificheDelRecord('ExtraRaccolta', { prima: er, dopo: { ...er, costo_raccolta_t: 0, prezzo_attivo_t: 0 }, patch: { costo_raccolta_t: 0, prezzo_attivo_t: 0 } }).length === 0);
  // Ma un'apertura vuota che diventa zero e' un dato nuovo: un valore che manca non e' zero.
  const ap = modificheDelRecord('GiacenzaSito', { prima: { id: 'g1' }, dopo: { id: 'g1', giacenza_riferimento_t: 0 }, patch: { giacenza_riferimento_t: 0 } });
  verifica('un\'apertura vuota che diventa 0 si registra, col prima vuoto', ap.length === 1 && ap[0].prima === null && ap[0].dopo === '0', J(ap));

  const nuovo = modificheDelRecord('Tariffa', { dopo: { valore: 90, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01' }, operazione: 'create' });
  verifica('una creazione registra i campi con un valore, non i valori di default (stato attivo)', nuovo.map(x => x.campo).sort().join(',') === 'data_inizio_validita,unita_misura,valore', J(nuovo));
  const mese = modificheDelRecord('TargetMensile', { dopo: { raccoglitore: 'X', mese: 'Luglio', target: 50, non_raccoglie: false }, operazione: 'create' });
  verifica('un target mensile nato a 50 t: una riga, senza «non raccoglie: no»', mese.length === 1 && mese[0].campo === 'target' && mese[0].dopo === '50', J(mese));
  const vuota = modificheDelRecord('TargetMensile', { dopo: { raccoglitore: 'X', mese: 'Luglio' }, operazione: 'create' });
  verifica('un record che nasce senza valori tracciati lascia comunque una riga', vuota.length === 1 && vuota[0].campo === '', J(vuota));
  const via = modificheDelRecord('GiacenzaSito', { prima: { id: 'g1', sito: 'IRIGOM', giacenza_riferimento_t: 1234.5 }, operazione: 'delete' });
  verifica('una cancellazione dice che cosa c\'era', via.some(x => x.campo === 'giacenza_riferimento_t' && x.prima === '1234.5' && x.dopo === null), J(via));

  verifica('una tariffa passiva e\' un costo riservato', campoRiservato('Tariffa', 'valore', { direzione: 'PASSIVA' }) && campoRiservato('Tariffa', 'valore', {}));
  verifica('una tariffa attiva no', !campoRiservato('Tariffa', 'valore', { direzione: 'ATTIVA' }));
  verifica('sull\'extra raccolta i costi si, il prezzo a Ecotyre no', campoRiservato('ExtraRaccolta', 'costo_raccolta_t', {}) && !campoRiservato('ExtraRaccolta', 'prezzo_attivo_t', {}));
  verifica('le voci della passiva sono tutte riservate', campoRiservato('VocePassivaAmministrazione', 'prezzo', {}) && campoRiservato('VocePassivaAmministrazione', 'attiva', {}));
  verifica('l\'unita\' del prezzo viene dalla tariffa e dalla voce', unitaDelCampo('Tariffa', 'valore', { unita_misura: '€/viaggio' }) === '€/viaggio' && unitaDelCampo('VocePassivaAmministrazione', 'prezzo', { unita_misura: 'euro_viaggio' }) === '€/viaggio' && unitaDelCampo('VocePassivaAmministrazione', 'prezzo', {}) === '€/t');
  verifica('l\'etichetta dice di chi e di che anno', etichettaDi('ImpiantoTargetSecondaria', prima) === 'IRIGOM S.R.L. · 2026' && etichettaDi('CommessaEcotyre', c) === 'Commessa Ecotyre 2026', etichettaDi('ImpiantoTargetSecondaria', prima));

  const mesi = differenzeJson(J([1, 2, 3, 4, 5, 900, 7, 8, 9, 10, 11, 12]), J([1, 2, 3, 4, 5, 950, 7, 8, 9, 10, 11, 12]));
  verifica('nei dodici mesi della commessa si dice il mese', mesi.length === 1 && mesi[0].voce === 'giugno' && mesi[0].prima === 900 && mesi[0].dopo === 950, J(mesi));
  const reg = differenzeJson(J([{ regione: 'Campania', target_t: 4000 }, { regione: 'Puglia', target_t: 2000 }]), J([{ regione: 'Campania', target_t: 4200 }, { regione: 'Puglia', target_t: 2000 }]));
  verifica('nelle regioni si dice la regione', reg.length === 1 && reg[0].voce === 'Campania, target t' && reg[0].dopo === 4200, J(reg));

  // Il criterio di una voce della passiva riscritto dalla pagina con le chiavi
  // in un altro ordine (criterioDaForm mette la provenienza prima delle classi):
  // e' lo stesso criterio. Sui dati veri dell'11/10 erano 8 voci di Irigom.
  const voce = { id: 'v1', anno: 2026, soggetto: 'Irigom S.r.l.', voce: 'classi P+M', prezzo: 90, criterio_json: '{"classi":["P","M"],"provenienza":"primaria"}' };
  const patchVoce = { prezzo: 95, criterio_json: '{"provenienza":"primaria","classi":["P","M"]}' };
  const mv = modificheDelRecord('VocePassivaAmministrazione', { prima: voce, dopo: { ...voce, ...patchVoce }, patch: patchVoce });
  verifica('un criterio riscritto con le chiavi in un altro ordine non e\' una modifica: resta solo il prezzo', mv.length === 1 && mv[0].campo === 'prezzo', J(mv));
  const altroCriterio = { criterio_json: '{"provenienza":"primaria","classi":["P"]}' };
  verifica('ma un criterio cambiato davvero si registra', modificheDelRecord('VocePassivaAmministrazione', { prima: voce, dopo: { ...voce, ...altroCriterio }, patch: altroCriterio }).length === 1);

  // Una tabella senza nessun valore e' un campo vuoto; lo zero no.
  const dodici = (v) => J(Array(12).fill(v));
  const nuovaCommessa = modificheDelRecord('CommessaEcotyre', { dopo: { anno: 2027, target_annuo_t: 11550, target_mensile_json: dodici(null), budget_aci_json: dodici(null), regioni_json: '[]' }, operazione: 'create' });
  verifica('una commessa nuova con le tabelle ancora vuote registra solo quello che ha', nuovaCommessa.length === 1 && nuovaCommessa[0].campo === 'target_annuo_t', J(nuovaCommessa));
  verifica('dodici mesi vuoti al posto di una tabella vuota non sono una modifica',
    modificheDelRecord('CommessaEcotyre', { prima: { id: 'c1', target_mensile_json: '[]' }, dopo: { id: 'c1', target_mensile_json: dodici(null) }, patch: { target_mensile_json: dodici(null) } }).length === 0);
  verifica('una tabella svuotata si registra',
    modificheDelRecord('CommessaEcotyre', { prima: { id: 'c1', budget_aci_json: dodici(15) }, dopo: { id: 'c1', budget_aci_json: dodici(null) }, patch: { budget_aci_json: dodici(null) } }).length === 1);
  verifica('dodici zeri non sono dodici vuoti',
    modificheDelRecord('CommessaEcotyre', { prima: { id: 'c1', budget_aci_json: dodici(null) }, dopo: { id: 'c1', budget_aci_json: dodici(0) }, patch: { budget_aci_json: dodici(0) } }).length === 1);

  // Le tabelle della commessa con l'unita' dei loro numeri, come nella scheda.
  const spec = (campo) => campoTracciato('CommessaEcotyre', campo);
  const classi = differenzeJson(J([{ classe: 'P', descrizione: 'Auto, moto', peso: '<35', percentuale: 0.3 }]), J([{ classe: 'P', descrizione: 'Auto, moto', peso: '<35', percentuale: 0.35 }]), spec('classi_json'));
  verifica('la ripartizione per classe in percentuale (0,35 si dice 35 %)', classi.length === 1 && classi[0].voce === 'P, percentuale' && classi[0].prima === 30 && classi[0].dopo === 35 && classi[0].unita === '%', J(classi));
  const prezzi = differenzeJson(J([{ regione: 'Campania', target_t: 400, prezzo: 120 }]), J([{ regione: 'Campania', target_t: 400, prezzo: 125 }]), spec('target_prezzo_regioni_json'));
  verifica('il prezzo della previsione ACI in €/t', prezzi.length === 1 && prezzi[0].voce === 'Campania, prezzo' && prezzi[0].dopo === 125 && prezzi[0].unita === '€/t', J(prezzi));
  const regT = differenzeJson(J([{ regione: 'Campania', target_t: 4000 }]), J([{ regione: 'Campania', target_t: 4200 }]), spec('regioni_json'));
  verifica('il target per regione in tonnellate', regT.length === 1 && regT[0].voce === 'Campania, target' && regT[0].unita === 't', J(regT));
  const budget = differenzeJson(dodici(15), J([15, 15, 15, 15, 15, 20, 15, 15, 15, 15, 15, 15]), spec('budget_aci_json'));
  verifica('i dodici mesi in tonnellate', budget.length === 1 && budget[0].voce === 'giugno' && budget[0].unita === 't', J(budget));
  const rigaNuova = differenzeJson(null, J([{ classe: 'G1', descrizione: 'Agricole', peso: '>155', percentuale: 0.04 }]), spec('classi_json'));
  verifica('una riga nuova si dice cella per cella, la percentuale gia\' per cento',
    rigaNuova.some(d => d.voce === 'G1, percentuale' && d.prima === null && d.dopo === 4 && d.unita === '%') && !rigaNuova.some(d => /\{/.test(String(d.dopo))), J(rigaNuova));

  // Una riga nuova o tolta senza nessun valore si dice per nome: prima finiva
  // come JSON intero. Quello che si registra non cambia.
  const nuoveVuote = differenzeJson(null, REGIONI_VUOTE, spec('regioni_json'));
  verifica('una riga nuova senza valori si dice per nome, senza il suo JSON',
    nuoveVuote.length === 5 && nuoveVuote.every((d, i) => d.voce === REGIONI[i] && d.riga === 'aggiunta' && d.valori === 'nessuno') && senzaJson(nuoveVuote), J(nuoveVuote));
  const tolta = differenzeJson(J([{ regione: 'Campania', target_t: 3000 }, { regione: 'Molise', province: '', target_t: null }]), J([{ regione: 'Campania', target_t: 3200 }]), spec('regioni_json'));
  verifica('una riga tolta senza valori per nome, accanto alla cella che cambia',
    tolta.length === 2 && tolta.some(d => d.voce === 'Campania, target' && d.prima === 3000 && d.dopo === 3200 && d.unita === 't')
    && tolta.some(d => d.voce === 'Molise' && d.riga === 'tolta' && d.valori === 'nessuno') && senzaJson(tolta), J(tolta));
  const nataVuota = modificheDelRecord('CommessaEcotyre', { dopo: { anno: 2027, target_annuo_t: 11550, regioni_json: REGIONI_VUOTE }, operazione: 'create' });
  verifica('e si registra come prima: le regioni con i nomi sono una riga dello storico', nataVuota.map(x => x.campo).join(',') === 'target_annuo_t,regioni_json', J(nataVuota));

  const righe = righeDiModifica('Tariffa', { record_id: 't1', prima: { id: 't1', valore: 300, direzione: 'PASSIVA', fornitore_nome: 'EMMESSE', data_inizio_validita: '2026-01-01' }, dopo: { valore: 90 }, patch: { valore: 90 } }, { utente: 'Mario', origine: 'Tariffe', motivo: 'rinegoziato', il: '2026-10-10T08:00:00.000Z' });
  verifica('la riga ha tutto: chi, quando, da dove, perche\', l\'anno e il segno dei costi', righe.length === 1 && righe[0].utente === 'Mario' && righe[0].motivo === 'rinegoziato' && righe[0].origine === 'Tariffe'
    && righe[0].anno === 2026 && righe[0].riservato === true && righe[0].prima === '300' && righe[0].dopo === '90' && righe[0].unita === '€' && righe[0].operazione === 'update', J(righe));
}

console.log('2. IL MOTORE: RILEGGE, SCRIVE, REGISTRA; E SE IL REGISTRO NON C\'E\' LO DICE');
{
  const base = { ImpiantoTargetSecondaria: [{ id: 'i1', nome_impianto: 'IRIGOM S.R.L.', anno: 2026, target: 1050000 }] };
  const a = archivioFinto(base);
  const esito = await scriviTracciato(a.archivi, 'ImpiantoTargetSecondaria', 'i1', { target: 1200000 }, { utente: 'Mario', origine: 'prova' });
  verifica('il dato e\' scritto', a.db.ImpiantoTargetSecondaria[0].target === 1200000);
  verifica('il prima viene dall\'archivio (una lettura)', a.conti.get === 1);
  verifica('e il registro ha la riga', (a.db.ModificaDato || []).length === 1 && a.db.ModificaDato[0].prima === '1050000' && a.db.ModificaDato[0].utente === 'Mario', J(a.db.ModificaDato));
  verifica('la risposta lo dice', esito.traccia.scritta === true && esito.traccia.righe === 1 && notaTraccia(esito) === null, J(esito.traccia));

  const b = archivioFinto(base);
  await scriviTracciato(b.archivi, 'ImpiantoTargetSecondaria', 'i1', { note: 'copiato' }, {});
  verifica('una scrittura senza campi tracciati non legge e non registra', b.conti.get === 0 && !(b.db.ModificaDato || []).length);

  const rotto = archivioFinto(base, { registroRotto: true });
  const e2 = await scriviTracciato(rotto.archivi, 'ImpiantoTargetSecondaria', 'i1', { target: 900000 }, {});
  verifica('se il registro non si scrive il dato resta', rotto.db.ImpiantoTargetSecondaria[0].target === 900000);
  verifica('e la risposta lo dice, col motivo', e2.traccia.scritta === false && /Rate limit/.test(e2.traccia.motivo) && /non è finita nello storico/.test(notaTraccia(e2)), J(e2.traccia));

  const c = archivioFinto(base);
  const tolto = await eliminaTracciato(c.archivi, 'ImpiantoTargetSecondaria', 'i1', { utente: 'Mario' });
  verifica('una cancellazione registra che cosa c\'era', !c.db.ImpiantoTargetSecondaria.length && c.db.ModificaDato.some(r => r.operazione === 'delete' && r.campo === 'target' && r.prima === '1050000'), J(c.db.ModificaDato));
  verifica('e restituisce il record di prima', tolto.record && tolto.record.target === 1050000);

  const d = archivioFinto({});
  let riprove = 0;
  const molte = Array.from({ length: 120 }, (_, i) => ({ anno: 2027, canale: 'RETE', blocco: 'raccoglitori', soggetto: `S${i}`, prezzo: 68 }));
  const creati = await creaTracciati(d.archivi, 'VocePassivaAmministrazione', molte, { utente: 'Mario', riprova: (fn) => { riprove++; return fn(); } });
  verifica('il modello della passiva si crea a blocchi di cinquanta, ognuno riprovabile', d.db.VocePassivaAmministrazione.length === 120 && riprove === 3, String(riprove));
  verifica('e il registro si scrive a blocchi di cento, una riga per campo', d.db.ModificaDato.length === 120 * 2 && creati.traccia.righe === 240, String(d.db.ModificaDato.length));

  // Uno per uno: chi ha bisogno dell'id di ogni record (gli impianti della
  // copia d'anno) li crea con create, e il registro resta una scrittura sola.
  const u = archivioFinto({});
  const imp = await creaTracciati(u.archivi, 'ImpiantoTargetSecondaria', [{ nome_impianto: 'A', anno: 2027, target: 1000 }, { nome_impianto: 'B', anno: 2027, target: 2000 }], { unoPerUno: true });
  verifica('uno per uno: un create per record, con il suo id, e il registro a blocchi', u.conti.create === 2 && u.conti.bulkCreate === 1 && imp.record.every(r => /^ImpiantoTargetSecondaria-/.test(r.id)) && u.db.ModificaDato.length === 4, J(u.conti));

  // Una creazione a blocchi che si ferma a meta': i record creati ci sono
  // davvero, e lo storico lo deve sapere.
  const h = archivioFinto({});
  let blocchi = 0;
  const conGuasto = new Proxy({}, { get: (_t, nome) => (nome === 'TargetMensile'
    ? { bulkCreate: async (rr) => { if (++blocchi === 2) throw new Error('Rate limit exceeded'); return h.archivi.TargetMensile.bulkCreate(rr); } }
    : h.archivi[nome]) });
  const ottanta = Array.from({ length: 80 }, (_, i) => ({ raccoglitore: `R${i}`, mese: 'Gennaio', anno: 2027, target: 10 }));
  let fermata = false;
  try { await creaTracciati(conGuasto, 'TargetMensile', ottanta, { motivo: 'copia' }); } catch { fermata = true; }
  verifica('una creazione a blocchi che si ferma a meta\' lancia', fermata);
  verifica('ma registra i record creati davvero', h.db.TargetMensile.length === 50 && (h.db.ModificaDato || []).length === 50, String((h.db.ModificaDato || []).length));
  verifica('con l\'id dei record creati', d.db.ModificaDato.every(r => /^VocePassivaAmministrazione-/.test(r.record_id)));

  const e = archivioFinto({ VocePassivaAmministrazione: [{ id: 'v1', soggetto: 'A', prezzo: 300 }, { id: 'v2', soggetto: 'B', prezzo: 90 }] });
  const viaUna = { ...e.db.VocePassivaAmministrazione[0] };
  const fantasma = { id: 'v9', soggetto: 'Z', prezzo: 1 };
  let lanciato = false;
  try { await eliminaTracciati(e.archivi, 'VocePassivaAmministrazione', [viaUna, fantasma], { utente: 'Mario' }); } catch { lanciato = true; }
  verifica('una cancellazione a gruppi che si ferma a meta\' lancia', lanciato);
  verifica('ma registra quelle fatte', e.db.ModificaDato.some(r => r.record_id === 'v1' && r.campo === 'prezzo' && r.prima === '300') && !e.db.ModificaDato.some(r => r.record_id === 'v9'), J(e.db.ModificaDato));

  const f = archivioFinto(base);
  const lato = await traccia(f.archivi, 'ImpiantoTargetSecondaria', 'i1', { target: 1 }, { utente: utenteDellaRichiesta({ full_name: 'Anna Bianchi', email: 'a@b' }), origine: 'funzione' });
  verifica('lato funzioni: stesso motore, chi scrive dal nome dell\'utente', lato.traccia.righe === 1 && f.db.ModificaDato[0].utente === 'Anna Bianchi' && f.db.ModificaDato[0].origine === 'funzione');
  await eliminaConTraccia(f.archivi, 'ImpiantoTargetSecondaria', 'i1', {});
  verifica('e la cancellazione', f.db.ModificaDato.some(r => r.operazione === 'delete'));
}

console.log('3. L\'INVOLUCRO DELLE PAGINE METTE CHI SCRIVE');
{
  const a = archivioFinto({ GiacenzaSito: [{ id: 'g1', sito: 'IRIGOM S.R.L.', anno: 2026, giacenza_riferimento_t: 100 }] });
  let chiamateMe = 0;
  globalThis.__clienteFinto = { entities: a.archivi, auth: { me: async () => { chiamateMe++; return { full_name: 'Mario Rossi', email: 'm@r' }; } } };
  const lib = await caricaLibPagine('lib/scriviConTraccia', [["import { base44 } from '@/api/base44Client';", 'const base44 = globalThis.__clienteFinto;']]);
  const e1 = await lib.scriviConTraccia('GiacenzaSito', 'g1', { giacenza_riferimento_t: 120 }, { origine: 'Giacenze', motivo: 'rilettura del 31/12' });
  await lib.scriviConTraccia('GiacenzaSito', 'g1', { giacenza_riferimento_t: 130 }, { origine: 'Giacenze' });
  verifica('scrive e traccia, con il nome di chi e\' collegato', a.db.GiacenzaSito[0].giacenza_riferimento_t === 130 && a.db.ModificaDato.length === 2 && a.db.ModificaDato[0].utente === 'Mario Rossi' && a.db.ModificaDato[0].motivo === 'rilettura del 31/12', J(a.db.ModificaDato));
  verifica('chi scrive si chiede una volta sola', chiamateMe === 1, String(chiamateMe));
  verifica('tutto bene: niente da dire', lib.avvisoTraccia(e1) === null);
  verifica('il messaggio quando la traccia manca', J(lib.avvisoTraccia({ traccia: { scritta: false, motivo: 'x' } })).includes('fuori dallo storico'));
  verifica('e anche sulla traccia rimandata da una funzione', !!lib.avvisoTraccia(null, { scritta: false, motivo: 'y' }));
}

console.log('4. A VIDEO, ALL\'ITALIANA');
{
  const { testoModifica, quandoIt, scrittureDelloStorico } = await caricaLibPagine('lib/storicoModifiche');
  const t1 = testoModifica({ entita: 'ImpiantoTargetSecondaria', campo: 'target', unita: 'kg', prima: '1050000', dopo: '1200000', operazione: 'update' });
  verifica('il target dell\'impianto in tonnellate, come nella pagina', t1 === 'target di rete: 1.050,00 t → 1.200,00 t', t1);
  const t2 = testoModifica({ entita: 'Tariffa', campo: 'valore', unita: '€/t', prima: '300', dopo: '90', operazione: 'update' });
  verifica('la voce del 10/10: 300 -> 90 €/t', t2 === 'prezzo: 300,00 €/t → 90,00 €/t', t2);
  const t3 = testoModifica({ entita: 'GiacenzaSito', campo: 'giacenza_riferimento_t', unita: 't', dopo: '0', operazione: 'update' });
  verifica('un valore che mancava si scrive «—», non zero', t3 === 'giacenza di apertura (rete): — → 0,00 t', t3);
  const t4 = testoModifica({ entita: 'DichiarazioneSito', campo: 'quantita_kg', unita: 'kg', prima: '13640', dopo: '13650', operazione: 'update' });
  verifica('i chili interi col punto', t4 === 'quantità dichiarata: 13.640 kg → 13.650 kg', t4);
  const t5 = testoModifica({ entita: 'CommessaEcotyre', campo: 'target_mensile_json', unita: 'json', prima: J([0, 0, 0, 0, 0, 900.5, 0, 0, 0, 0, 0, 0]), dopo: J([0, 0, 0, 0, 0, 950, 0, 0, 0, 0, 0, 0]), operazione: 'update' });
  verifica('nella commessa il mese che cambia, in tonnellate', t5 === 'target mensile rivisto: giugno 900,50 t → 950,00 t', t5);
  const t7 = testoModifica({ entita: 'CommessaEcotyre', campo: 'classi_json', unita: 'json', prima: J([{ classe: 'P', percentuale: 0.3 }]), dopo: J([{ classe: 'P', percentuale: 0.35 }]), operazione: 'update' });
  verifica('la ripartizione per classe in percentuale, come nella scheda', t7 === 'ripartizione per classe: P, percentuale 30% → 35%', t7);
  const t8 = testoModifica({ entita: 'CommessaEcotyre', campo: 'target_prezzo_regioni_json', unita: 'json', prima: J([{ regione: 'Campania', target_t: 400, prezzo: 120 }]), dopo: J([{ regione: 'Campania', target_t: 400, prezzo: 125 }]), operazione: 'update' });
  verifica('il prezzo della previsione ACI in €/t', t8 === 'previsione ACI per regione: Campania, prezzo 120,00 €/t → 125,00 €/t', t8);
  const t9 = testoModifica({ entita: 'CommessaEcotyre', campo: 'regioni_json', unita: 'json', dopo: REGIONI_VUOTE, operazione: 'create' });
  verifica('una commessa nuova dalla scheda: le regioni ancora vuote per nome, senza JSON',
    t9 === 'target per regione: righe Campania, Puglia, Basilicata, Calabria e Sicilia aggiunte, ancora senza valori', t9);
  const t10 = testoModifica({ entita: 'CommessaEcotyre', campo: 'regioni_json', unita: 'json', prima: J([{ regione: 'Campania', target_t: 3000 }, { regione: 'Molise', province: '', target_t: null }]), dopo: J([{ regione: 'Campania', target_t: 3200 }]), operazione: 'update' });
  verifica('una regione vuota tolta, accanto al target che cambia', t10 === 'target per regione: Campania, target 3.000,00 t → 3.200,00 t; riga Molise tolta, non aveva valori', t10);
  const t6 = testoModifica({ entita: 'ImpiantoTargetSecondaria', campo: 'data_fine', unita: 'giorno', prima: '2026-12-18', dopo: '2026-12-11', operazione: 'update' });
  verifica('i giorni gg/mm/aaaa', t6 === 'fine della programmazione: 18/12/2026 → 11/12/2026', t6);
  verifica('l\'ora e\' quella di Roma', quandoIt('2026-10-11T12:32:00.000Z') === '11/10/2026 14:32', quandoIt('2026-10-11T12:32:00.000Z'));
  const s = scrittureDelloStorico([
    { entita: 'ImpiantoTargetSecondaria', record_id: 'i1', campo: 'target', unita: 'kg', prima: '1', dopo: '2', operazione: 'update', il: '2026-10-11T08:00:00.000Z', utente: 'Mario', motivo: 'revisione' },
    { entita: 'ImpiantoTargetSecondaria', record_id: 'i1', campo: 'stato', unita: 'testo', prima: 'attivo', dopo: 'non_attivo', operazione: 'update', il: '2026-10-11T08:00:00.000Z', utente: 'Mario', motivo: 'revisione' },
    { entita: 'ImpiantoTargetSecondaria', record_id: 'i1', campo: 'target', unita: 'kg', dopo: '1', operazione: 'create', il: '2026-10-01T08:00:00.000Z', utente: 'Anna' },
  ]);
  verifica('una riga per scrittura, la piu\' recente prima', s.length === 2 && s[0].voci.length === 2 && s[0].utente === 'Mario' && s[1].azione === 'Inserito' && s[0].voci[1] === 'stato: attivo → non attivo', J(s));
}

console.log('5. LE FUNZIONI VERE LASCIANO LE RIGHE');
{
  const ga = await caricaFunzione('gestisciAnagrafiche');
  const DB = {
    Fornitore: [{ id: 'fE', ragione_sociale: 'EMMESSE SRL', stato: 'attivo' }],
    Tariffa: [{ id: 't1', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_id: 'fE', fornitore_nome: 'EMMESSE SRL', unita_misura: '€/t', valore: 300, stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' }],
  };
  const r = await chiama(ga, { db: DB, corpo: { entita: 'Tariffa', operazione: 'update', id: 't1', dati: { valore: 90 }, motivo: 'accordo di ottobre' } });
  const reg = (r.db.ModificaDato || []);
  verifica('la tariffa 300 -> 90 lascia la sua riga', r.stato === 200 && reg.length === 1 && reg[0].campo === 'valore' && reg[0].prima === '300' && reg[0].dopo === '90' && reg[0].unita === '€/t', J(reg));
  verifica('con chi, il motivo e il segno dei costi', reg[0] && reg[0].utente === 'prova@prova' && reg[0].motivo === 'accordo di ottobre' && reg[0].riservato === true, J(reg[0]));
  verifica('e la risposta porta la traccia', r.j.traccia && r.j.traccia.scritta === true && r.j.traccia.righe === 1, J(r.j.traccia));

  // Un prezzo senza data di fine si chiude da se' quando ne arriva uno nuovo
  // (gestisciAnagrafiche, caso d): anche la chiusura e' una modifica.
  const aperta = { ...DB, Tariffa: [{ ...DB.Tariffa[0], data_fine_validita: undefined }] };
  const nuova = await chiama(ga, { db: aperta, corpo: { entita: 'Tariffa', operazione: 'create', dati: { direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_id: 'fE', fornitore_nome: 'EMMESSE SRL', unita_misura: '€/t', valore: 95, stato: 'attivo', data_inizio_validita: '2026-11-01' } } });
  const reg2 = nuova.db.ModificaDato || [];
  const chiusura = reg2.find(x => x.record_id === 't1');
  verifica('un prezzo nuovo che chiude il vecchio: la chiusura ha la sua riga e il suo motivo',
    nuova.stato === 200 && chiusura && chiusura.campo === 'data_fine_validita' && !('prima' in chiusura) && chiusura.dopo === '2026-10-31' && /chiusa dal prezzo nuovo che vale dal 01\/11\/2026/.test(chiusura.motivo), J(reg2));
  verifica('e la tariffa nuova le sue', reg2.some(x => x.operazione === 'create' && x.campo === 'valore' && x.dopo === '95'), J(reg2));

  const forn = await chiama(ga, { db: DB, corpo: { entita: 'Fornitore', operazione: 'update', id: 'fE', dati: { stato: 'non_attivo' } } });
  verifica('lo stato di un fornitore non si traccia: nessuna riga', forn.stato === 200 && !(forn.db.ModificaDato || []).length);

  const via = await chiama(ga, { db: DB, corpo: { entita: 'Tariffa', operazione: 'delete', id: 't1' } });
  verifica('una tariffa cancellata dice che cosa c\'era', via.stato === 200 && (via.db.ModificaDato || []).some(x => x.operazione === 'delete' && x.campo === 'valore' && x.prima === '300'), J(via.db.ModificaDato));

  const pa = await caricaFunzione('preparaAnno');
  const copia = await chiama(pa, { db: { Tariffa: DB.Tariffa }, corpo: { anno: 2027, azione: 'copia_tariffe' } });
  const reg3 = copia.db.ModificaDato || [];
  verifica('la copia delle tariffe nell\'anno nuovo lascia le sue righe', copia.stato === 200 && copia.j.creati === 1 && reg3.some(x => x.operazione === 'create' && x.campo === 'valore' && x.dopo === '300' && x.anno === 2027), J({ j: copia.j.creati, reg3 }));
  verifica('col motivo della copia', reg3.length > 0 && reg3.every(x => /copia dal 2026/.test(x.motivo)), J(reg3.map(x => x.motivo)));
  verifica('e la risposta porta la traccia', copia.j.traccia && copia.j.traccia.scritta === true, J(copia.j.traccia));

  // La copia dell'anno nuovo di Target & Status passa dallo storico: prima
  // restava fuori con un motivo falso («la conferma passa dallo storico», ma la
  // conferma scrive solo la nota e non lascia righe).
  const ca = await caricaFunzione('copiaAnnoTarget');
  const nuovo = annoCorrenteRoma() + 1;
  const vecchio = nuovo - 1;
  const annoPrima = {
    ImpiantoTargetSecondaria: [{ id: 'iI', nome_impianto: 'IRIGOM S.R.L.', anno: vecchio, target: 1050000, stato: 'attivo' }],
    FornitoreSecondaria: [{ id: 'fN', nome: 'Nappi Sud', impianto_id: 'iI', impianto_nome: 'IRIGOM S.R.L.', ruolo: 'stoccaggio', anno: vecchio, stato: 'attivo' }],
    TargetRaccoglitore: [{ id: 'r1', raccoglitore: 'C.L. Service', impianto: 'IRIGOM S.R.L.', anno: vecchio, target_tonnellate: 300 }],
    TargetMensile: [{ id: 'm1', raccoglitore: 'C.L. Service', impianto: 'IRIGOM S.R.L.', mese: 'Gennaio', anno: vecchio, target: 25 }],
    CommessaEcotyre: [{ id: 'c1', anno: vecchio, target_annuo_t: 11550, budget_aci_json: J(Array(12).fill(15)) }],
    GiacenzaSito: [{ id: 's1', sito: 'IRIGOM S.R.L.', tipo_destinazione: 'imp', anno: vecchio }],
  };
  const cp = await chiama(ca, { db: annoPrima, corpo: { anno: nuovo } });
  const reg4 = cp.db.ModificaDato || [];
  const entitaCopiate = new Set(reg4.map(x => x.entita));
  verifica('la copia dell\'anno lascia le righe di ogni archivio tracciato che copia', cp.stato === 200
    && ['ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile', 'CommessaEcotyre', 'GiacenzaSito'].every(x => entitaCopiate.has(x)) && !entitaCopiate.has('FornitoreSecondaria'), J({ stato: cp.stato, j: cp.j, entita: [...entitaCopiate] }));
  verifica('inserite, dell\'anno nuovo, con chi ha copiato e il motivo della copia', reg4.length > 0 && reg4.every(x => x.operazione === 'create' && x.anno === nuovo && x.utente === 'prova@prova'
    && x.motivo === `copia dal ${vecchio}, da confermare` && /copia dell'anno/.test(x.origine)), J(reg4.slice(0, 3)));
  verifica('il target dell\'impianto copiato col suo valore', reg4.some(x => x.entita === 'ImpiantoTargetSecondaria' && x.campo === 'target' && x.dopo === '1050000' && x.record_id), J(reg4.filter(x => x.entita === 'ImpiantoTargetSecondaria')));
  const impNuovo = (cp.db.ImpiantoTargetSecondaria || []).find(x => x.anno === nuovo);
  const colNuovo = (cp.db.FornitoreSecondaria || []).find(x => x.anno === nuovo);
  verifica('gli impianti nascono uno per uno e i collegamenti puntano a loro', impNuovo && colNuovo && colNuovo.impianto_id === impNuovo.id
    && cp.scritte.filter(s => s.entita === 'ImpiantoTargetSecondaria' && s.op === 'create').length === 1, J({ impNuovo, colNuovo }));
  verifica('e la risposta porta la traccia della copia', cp.j.traccia && cp.j.traccia.scritta === true && cp.j.traccia.righe === reg4.length, J(cp.j.traccia));
  const ancora = await chiama(ca, { db: cp.db, corpo: { anno: nuovo } });
  verifica('ripetuta non copia niente e non scrive niente nello storico', ancora.stato === 200 && !ancora.scritte.length && ancora.j.traccia && ancora.j.traccia.righe === 0, J(ancora.j));
}

console.log('6. ECOTYNA: CHI HA CAMBIATO IL TARGET DI IRIGOM');
{
  verifica('lo strumento e\' nel catalogo', catalogoStrumenti().some(s => s.nome === 'storico_modifiche') && STRUMENTI.some(s => s.nome === 'storico_modifiche'));
  const reg = [
    { id: 'm1', entita: 'ImpiantoTargetSecondaria', record_id: 'i1', etichetta: 'IRIGOM S.R.L. · 2026', campo: 'target', unita: 'kg', prima: '1050000', dopo: '1200000', operazione: 'update', utente: 'Mario Rossi', il: '2026-10-11T08:00:00.000Z', motivo: 'revisione', anno: 2026, riservato: false },
    { id: 'm2', entita: 'Tariffa', record_id: 't1', etichetta: 'EMMESSE SRL · RACCOLTA · RETE', campo: 'valore', unita: '€/t', prima: '300', dopo: '90', operazione: 'update', utente: 'Mario Rossi', il: '2026-10-10T08:00:00.000Z', anno: 2026, riservato: true },
    { id: 'm3', entita: 'ImpiantoTargetSecondaria', record_id: 'i2', etichetta: 'GATIM SRL · 2026', campo: 'target', unita: 'kg', prima: '1', dopo: '2', operazione: 'update', utente: 'Anna', il: '2026-10-09T08:00:00.000Z', anno: 2026, riservato: false },
  ];
  const finto = { asServiceRole: { entities: archivioFinto({ ModificaDato: reg }).archivi } };
  const r = await eseguiStrumento(finto, 'storico_modifiche', { soggetto: 'Irigom', cosa: 'target' }, { amministratore: false });
  const righe = r.dati && r.dati.modifiche && r.dati.modifiche.righe;
  verifica('trova la modifica del target di Irigom e solo quella', Array.isArray(righe) && righe.length === 1 && righe[0].chi === 'Mario Rossi' && righe[0].quando === '11/10/2026 10:00', J(r));
  verifica('in tonnellate, come la pagina', righe && righe[0].prima === 1050 && righe[0].dopo === 1200 && righe[0].unita === 't', J(righe && righe[0]));
  verifica('e dice che lo storico comincia a ottobre 2026', /ottobre 2026/.test(r.dati.nota) && /non vuol dire/.test(r.dati.nota));
  const op = await eseguiStrumento(finto, 'storico_modifiche', { cosa: 'prezzo' }, { amministratore: false });
  verifica('il prezzo di un fornitore non si dice a chi non e\' amministratore', op.dati.modifiche.righe.length === 0 && op.dati.riservate_non_dette === 1 && /riservati all'amministratore/.test(op.dati.nota_riservate), J(op.dati));
  const senza = await eseguiStrumento(finto, 'storico_modifiche', { cosa: 'prezzo' }, null);
  verifica('e senza contesto si nega', senza.dati.modifiche.righe.length === 0);
  const ad = await eseguiStrumento(finto, 'storico_modifiche', { cosa: 'prezzo', soggetto: 'Emmesse' }, { amministratore: true });
  verifica('all\'amministratore si', ad.dati.modifiche.righe.length === 1 && ad.dati.modifiche.righe[0].prima === 300 && ad.dati.modifiche.righe[0].dopo === 90, J(ad.dati));
  const chi = await eseguiStrumento(finto, 'storico_modifiche', { chi: 'anna' }, { amministratore: true });
  verifica('si filtra anche per chi ha scritto', chi.dati.modifiche.righe.length === 1 && /GATIM/.test(chi.dati.modifiche.righe[0].cosa), J(chi.dati));

  // I mesi chiusi fuori dal gestionale (revisione del 13/10/2026): la riga che
  // scrive segnaMesiChiusiFuori, una per mese e canale, si dice col nome
  // dell'archivio a parole e si trova chiedendo della chiusura.
  const { rigaStoricoChiusoFuori } = await import('../base44/shared/chiusuraMese.ts');
  const chiusa = { id: 'mc1', ...rigaStoricoChiusoFuori({ id: 'd1', tipo: 'ATTIVA', anno: 2026, mese: 'Gennaio', tipologia: 'RETE', stato: 'elaborata' }, { utente: 'Amministratore', il: '2026-10-13T10:00:00.000Z' }) };
  const conChiusa = { asServiceRole: { entities: archivioFinto({ ModificaDato: [...reg, chiusa] }).archivi } };
  const mesi = await eseguiStrumento(conChiusa, 'storico_modifiche', { cosa: 'chiusura' }, { amministratore: true });
  const rm = mesi.dati.modifiche.righe;
  verifica('«chi ha chiuso i mesi?»: la riga del mese chiuso, e solo quella', rm.length === 1 && rm[0].chi === 'Amministratore' && rm[0].dopo === 'chiusa', J(rm));
  verifica('...col nome dell\'archivio a parole, non quello interno', rm[0] && rm[0].archivio === 'documento della fatturazione attiva', J(rm[0] && rm[0].archivio));
  for (const cosa of ['chiusi', 'fatturazione']) {
    const x = await eseguiStrumento(conChiusa, 'storico_modifiche', { cosa }, { amministratore: true });
    verifica(`anche chiedendo «${cosa}»`, x.dati.modifiche.righe.length === 1 && x.dati.modifiche.righe[0].archivio === 'documento della fatturazione attiva', J(x.dati.modifiche.righe));
  }
  verifica('e la nota dice che lo storico registra anche i mesi chiusi fuori', /mesi della fatturazione attiva segnati come chiusi fuori dal gestionale/.test(mesi.dati.nota), mesi.dati.nota);

  // Un impianto cancellato: il «dopo» e' vuoto, e l'unita' non deve tornare
  // quella dei chili mentre il numero e' gia' in tonnellate.
  const via = archivioFinto({ ImpiantoTargetSecondaria: [{ id: 'i1', nome_impianto: 'IRIGOM S.R.L.', anno: 2026, target: 1050000, totale_capacity_kg: 1300000, stato: 'attivo' }] });
  await eliminaTracciato(via.archivi, 'ImpiantoTargetSecondaria', 'i1', { utente: 'Mario Rossi', il: '2026-10-11T08:00:00.000Z' });
  const cancellato = await eseguiStrumento({ asServiceRole: { entities: via.archivi } }, 'storico_modifiche', { soggetto: 'Irigom', cosa: 'target' }, { amministratore: true });
  const rc = cancellato.dati.modifiche.righe;
  const tg = rc.find(x => x.campo === 'target di rete');
  const cap = rc.find(x => x.campo === 'capacità totale');
  verifica('un impianto cancellato: il target di prima in tonnellate (1.050 t, non 1.050 kg)', tg && tg.operazione === 'eliminato' && tg.prima === 1050 && tg.dopo === null && tg.unita === 't', J(tg));
  verifica('e la capacita\' (1.300 t)', cap && cap.prima === 1300 && cap.unita === 't', J(cap));

  // Le tabelle della commessa: ogni differenza con la sua unita', e la nota
  // non chiama piu' tonnellate i prezzi e le percentuali.
  const regC = [
    { id: 'k1', entita: 'CommessaEcotyre', record_id: 'c1', etichetta: 'Commessa Ecotyre 2026', campo: 'classi_json', unita: 'json', prima: J([{ classe: 'P', percentuale: 0.3 }]), dopo: J([{ classe: 'P', percentuale: 0.35 }]), operazione: 'update', utente: 'Mario', il: '2026-10-11T08:00:00.000Z', anno: 2026, riservato: false },
    { id: 'k2', entita: 'CommessaEcotyre', record_id: 'c1', etichetta: 'Commessa Ecotyre 2026', campo: 'target_prezzo_regioni_json', unita: 'json', prima: J([{ regione: 'Campania', target_t: 400, prezzo: 120 }]), dopo: J([{ regione: 'Campania', target_t: 400, prezzo: 125 }]), operazione: 'update', utente: 'Mario', il: '2026-10-11T08:00:00.000Z', anno: 2026, riservato: false },
  ];
  const com = await eseguiStrumento({ asServiceRole: { entities: archivioFinto({ ModificaDato: regC }).archivi } }, 'storico_modifiche', { cosa: 'commessa' }, { amministratore: true });
  const dc = com.dati.modifiche.righe.flatMap(x => x.differenze || []);
  verifica('EcoTyna: la ripartizione per classe in percentuale', dc.some(d => d.voce === 'P, percentuale' && d.prima === 30 && d.dopo === 35 && d.unita === '%'), J(dc));
  verifica('EcoTyna: il prezzo della previsione ACI in €/t', dc.some(d => d.voce === 'Campania, prezzo' && d.prima === 120 && d.unita === '€/t'), J(dc));
  verifica('e la nota distingue tonnellate, prezzi e percentuali', !/i numeri sono tonnellate/.test(com.dati.nota) && /€\/t il prezzo/.test(com.dati.nota) && /% la ripartizione per classe/.test(com.dati.nota), com.dati.nota);

  // Una commessa nuova salvata dalla scheda con le regioni ancora vuote:
  // EcoTyna sente i nomi delle regioni, non il loro JSON.
  const regV = righeDiModifica('CommessaEcotyre', { record_id: 'c9', dopo: { anno: 2027, target_annuo_t: 11550, regioni_json: REGIONI_VUOTE }, operazione: 'create' }, { utente: 'Mario', il: '2026-10-12T08:00:00.000Z' })
    .map((x, i) => ({ id: `v${i}`, ...x }));
  const vuote = await eseguiStrumento({ asServiceRole: { entities: archivioFinto({ ModificaDato: regV }).archivi } }, 'storico_modifiche', { cosa: 'commessa' }, { amministratore: true });
  const dv = vuote.dati.modifiche.righe.flatMap(x => x.differenze || []);
  verifica('EcoTyna: le regioni nuove ancora vuote per nome, senza JSON', dv.length === 5 && dv.every((d, i) => d.voce === REGIONI[i] && d.riga === 'aggiunta' && d.valori === 'nessuno') && senzaJson(dv), J(dv));
  verifica('e la nota dice come si leggono', /aggiunta o tolta senza nessun valore ha solo il nome/.test(vuote.dati.nota), vuote.dati.nota);

  // Dopo la copia, l'impianto si conferma in Target & Status. Fino al
  // 14/10/2026 la conferma scriveva solo la nota e non lasciava righe; ora
  // lascia anche la riga della conferma (registraConferma), e la nota a EcoTyna
  // lo dice senza smentirla. La sola nota resta senza righe: non e' un campo
  // tracciato. Ne' la nota deve dire al presente «da confermare» di un valore
  // che puo' essere gia' confermato.
  const ca = await caricaFunzione('copiaAnnoTarget');
  const nuovo = annoCorrenteRoma() + 1;
  const cp = await chiama(ca, { db: { ImpiantoTargetSecondaria: [{ id: 'iI', nome_impianto: 'IRIGOM S.R.L.', anno: nuovo - 1, target: 1050000, stato: 'attivo' }] }, corpo: { anno: nuovo } });
  const imp = (cp.db.ImpiantoTargetSecondaria || []).find(x => x.anno === nuovo);
  const copiate = (cp.db.ModificaDato || []).length;
  const dopoCopia = archivioFinto({ ImpiantoTargetSecondaria: [imp], ModificaDato: cp.db.ModificaDato || [] });
  const soloNota = await scriviTracciato(dopoCopia.archivi, 'ImpiantoTargetSecondaria', imp.id, { note: '' }, { utente: 'Mario Rossi', origine: 'Target & Status' });
  verifica('la nota da sola non lascia righe: non e\' un campo tracciato', copiate > 0 && soloNota.traccia.righe === 0 && dopoCopia.db.ModificaDato.length === copiate, J({ copiate, traccia: soloNota.traccia }));
  const conf = await registraConferma(dopoCopia.archivi, [{ entita: 'ImpiantoTargetSecondaria', record: { ...imp, note: '' } }], { utente: 'Mario Rossi', origine: 'Target & Status' });
  verifica('la conferma lascia la sua riga', conf.scritta === true && conf.righe === 1 && dopoCopia.db.ModificaDato.length === copiate + 1, J({ copiate, conf }));
  const st = await eseguiStrumento({ asServiceRole: { entities: dopoCopia.archivi } }, 'storico_modifiche', { soggetto: 'Irigom', cosa: 'target', anno: nuovo }, { amministratore: true });
  verifica('EcoTyna riceve le righe della copia col loro motivo', st.dati.modifiche.righe.some(x => x.campo === 'target di rete' && x.dopo === 1050 && /copia dal \d{4}, da confermare/.test(x.motivo)), J(st.dati.modifiche));
  verifica('e la riga della conferma: chi, il target confermato in tonnellate e il motivo', st.dati.modifiche.righe.some(x => x.campo === 'target di rete' && x.operazione === 'modificato' && x.prima === 1050 && x.dopo === 1050 && x.unita === 't'
    && x.chi === 'Mario Rossi' && x.motivo === `confermato il valore copiato dall'anno prima (${nuovo - 1}), sul contratto ${nuovo}`), J(st.dati.modifiche));
  verifica('la nota dice che le conferme di Target & Status lasciano la riga, senza smentirla, e non dice i valori ancora da confermare',
    !/sono valori dell'anno prima, da confermare/.test(st.dati.nota) && !/non lasciano righe qui/.test(st.dati.nota) && /confermati in Target & Status/.test(st.dati.nota)
    && /Anche la conferma di un valore copiato lascia la sua riga/.test(st.dati.nota)
    && /non si sa se un valore copiato e' stato confermato dopo/.test(st.dati.nota) && /tariffe preparate per l'anno/.test(st.dati.nota), st.dati.nota);

  // Le tariffe confermate con «Prepara l'anno» lasciano invece la loro riga
  // (preparaAnno, decisioni dell'utente del 13/10/2026): EcoTyna riceve la riga
  // della conferma e una nota che la dice, non la frase che la smentisce
  // (revisione del 14/10/2026: la nota diceva ancora «la conferma invece non
  // lascia righe qui»).
  const paConf = await caricaFunzione('preparaAnno');
  const tarCopiata = { id: 'tC', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'Ecotyre Scrl', valore: 202, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: `${nuovo}-01-01`, data_fine_validita: `${nuovo}-12-31`, note: `copiato dal ${nuovo - 1}, da confermare` };
  const confT = await chiama(paConf, { db: { Tariffa: [tarCopiata] }, corpo: { anno: nuovo, azione: 'conferma_tariffe', direzione: 'ATTIVA' } });
  const regT = confT.db.ModificaDato || [];
  verifica('la conferma di una tariffa in «Prepara l\'anno» lascia la sua riga', regT.length === 1 && /^confermato il valore copiato dall'anno prima/.test(regT[0].motivo), J(regT));
  const stT = await eseguiStrumento({ asServiceRole: { entities: archivioFinto({ ModificaDato: regT }).archivi } }, 'storico_modifiche', { cosa: 'tariffe' }, { amministratore: true });
  verifica('EcoTyna riceve la riga della conferma col suo motivo', stT.dati.modifiche.righe.some(x => /^confermato il valore copiato dall'anno prima/.test(x.motivo)), J(stT.dati.modifiche));
  verifica('e la nota dice che la conferma delle tariffe lascia la riga, senza smentirla',
    !/la conferma invece non lascia righe/.test(stT.dati.nota) && /Anche la conferma di un valore copiato lascia la sua riga/.test(stT.dati.nota)
    && /le tariffe confermate con «Prepara l'anno»/.test(stT.dati.nota) && /confermato il valore copiato dall'anno prima/.test(stT.dati.nota), stT.dati.nota);
}

console.log('7. LA FINESTRA DELLA COPIA DICE SE LO STORICO NON SI E\' SCRITTO');
{
  // La copia dell'anno risponde con traccia { scritta, righe, motivo? }: se il
  // registro non si scrive, la finestra di Target & Status lo deve dire accanto
  // a «Fatto.», come NuovoAnno e le tariffe. Si disegna la finestra vera con
  // React lato server; la finestra di sistema (Radix) si sostituisce con
  // contenitori semplici, perche' lato server non disegna niente, e l'accesso
  // (AuthContext, che appena caricato legge l'indirizzo del browser) con uno
  // finto.
  const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
  const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
  const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(existsSync) || base; };
  const FINTI = {
    client: 'export const base44 = { functions: { invoke: async () => ({ data: {} }) }, entities: {}, auth: { me: async () => ({}) } };',
    dialog: `import React from 'react';
      const box = (tag) => ({ children }) => React.createElement(tag, null, children);
      export const Dialog = ({ children }) => React.createElement(React.Fragment, null, children);
      export const DialogContent = box('div'); export const DialogHeader = box('div'); export const DialogFooter = box('div');
      export const DialogTitle = box('h2'); export const DialogDescription = box('p');`,
    accesso: 'export const useAuth = () => ({ user: null, isLoadingAuth: false }); export const AuthProvider = ({ children }) => children;',
  };
  const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { DialogoAzione } from ${JSON.stringify(qui('../src/components/target-status/ConfigurazioneImpianti.jsx'))};
export const disegna = (props) => renderToStaticMarkup(React.createElement(DialogoAzione, { anno: 2027, onChiudi() {}, onConferma() {}, ...props }));
`;
  let disegna = null;
  try {
    const pacchetto = await build({
      stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
      bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
      loader: { '.jsx': 'jsx', '.js': 'jsx' },
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'finti', setup(b) {
        b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'finto' }));
        b.onResolve({ filter: /^@\/components\/ui\/dialog$/ }, () => ({ path: 'dialog', namespace: 'finto' }));
        b.onResolve({ filter: /^@\/lib\/AuthContext$/ }, () => ({ path: 'accesso', namespace: 'finto' }));
        b.onLoad({ filter: /.*/, namespace: 'finto' }, (args) => ({ contents: FINTI[args.path], loader: 'js', resolveDir: qui('.') }));
        b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) }));
      } }],
    });
    ({ disegna } = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64')));
  } catch (e) { verifica('la finestra si impacchetta e si carica', false, String(e && e.message).slice(0, 400)); }
  if (disegna) {
    const rotta = disegna({ azione: { tipo: 'copia', fase: 'fatto', errore: null, dati: { conteggi: { impianti: 16 }, traccia: { scritta: false, righe: 329, motivo: 'Rate limit exceeded' } } } });
    verifica('copia fatta e registro non scritto: la finestra lo dice, col motivo',
      rotta.includes('Fatto.') && rotta.includes('non è finita nello storico delle modifiche: Rate limit exceeded'), rotta.slice(0, 600));
    const buona = disegna({ azione: { tipo: 'copia', fase: 'fatto', errore: null, dati: { conteggi: { impianti: 16 }, traccia: { scritta: true, righe: 329 } } } });
    verifica('registro scritto: solo «Fatto.»', buona.includes('Fatto.') && !buona.includes('storico delle modifiche'), buona.slice(0, 600));
    const prova = disegna({ azione: { tipo: 'copia', fase: 'conferma', errore: null, dati: { conteggi: { impianti: 16 } } } });
    verifica('e prima di confermare non dice niente dello storico', prova.includes('Se confermi, copio') && !prova.includes('storico delle modifiche'), prova.slice(0, 600));
  }
}

console.log('8. IL SURPLUS SULLE TARIFFE SI TRACCIA COME UN PREZZO (13/10/2026)');
{
  // Il Fuel Surcharge del consorzio Ecotyre (+5 €/t dal 01/10 al 31/12/2026)
  // cambia attiva, passiva e margine come una tariffa: chi lo scrive, lo cambia
  // o lo chiude deve lasciare la riga. L'importo ai fornitori e' un costo e lo
  // vede solo l'amministratore; quello da Ecotyre no.
  const fuel = {
    nome: 'Fuel Surcharge', origine: 'CONSORZIO', tipologia: 'RETE', prestazione: 'RACCOLTA', a_chi: 'tutti',
    euro_t_passiva: 5, euro_t_attiva: 5, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo', gruppo: 'g1',
  };
  const nato = modificheDelRecord('SurplusTariffa', { dopo: fuel, operazione: 'create' });
  verifica('un surplus nuovo registra nome, canale, prestazione, i due importi e le date, non i valori di default (tutti, attivo)',
    nato.map(m => m.campo).sort().join(',') === 'data_fine_validita,data_inizio_validita,euro_t_attiva,euro_t_passiva,nome,prestazione,tipologia', J(nato));
  const pas = nato.find(m => m.campo === 'euro_t_passiva');
  const att = nato.find(m => m.campo === 'euro_t_attiva');
  verifica('il surplus ai fornitori e\' un costo riservato, in €/t', pas && pas.riservato === true && pas.unita === '€/t' && pas.dopo === '5', J(pas));
  verifica('quello da Ecotyre no', att && att.riservato === false && att.unita === '€/t', J(att));
  verifica('e il campo lo dice anche da solo', campoRiservato('SurplusTariffa', 'euro_t_passiva', fuel) && !campoRiservato('SurplusTariffa', 'euro_t_attiva', fuel) && !campoRiservato('SurplusTariffa', 'nome', fuel));

  const righe = righeDiModifica('SurplusTariffa', { record_id: 's1', prima: fuel, dopo: { euro_t_attiva: 7 }, patch: { euro_t_attiva: 7 } }, { utente: 'Mario', origine: 'Tariffe & Anagrafiche', il: '2026-10-13T08:00:00.000Z' });
  verifica('l\'etichetta dice nome, canale, prestazione e inizio; l\'anno e\' quello dell\'inizio',
    righe.length === 1 && righe[0].etichetta === 'Fuel Surcharge · RETE · RACCOLTA · dal 01/10/2026' && righe[0].anno === 2026 && righe[0].prima === '5' && righe[0].dopo === '7' && righe[0].riservato === false, J(righe));
  verifica('l\'extra raccolta si legge senza trattino basso', etichettaDi('SurplusTariffa', { ...fuel, tipologia: 'EXTRA_RACCOLTA' }) === 'Fuel Surcharge · EXTRA RACCOLTA · RACCOLTA · dal 01/10/2026');

  // Un valore che mancava non e' zero: un surplus solo passivo che diventa
  // anche attivo ha il «prima» vuoto.
  const soloPassivo = { ...fuel, euro_t_attiva: null };
  const diventa = modificheDelRecord('SurplusTariffa', { prima: soloPassivo, dopo: { ...soloPassivo, euro_t_attiva: 5 }, patch: { euro_t_attiva: 5 } });
  verifica('da Ecotyre: da vuoto a 5 €/t, col prima vuoto', diventa.length === 1 && diventa[0].prima === null && diventa[0].dopo === '5', J(diventa));
  verifica('«tutti» scritto su un record che non l\'aveva non e\' una modifica',
    modificheDelRecord('SurplusTariffa', { prima: { id: 's1', nome: 'X' }, dopo: { id: 's1', nome: 'X', a_chi: 'tutti' }, patch: { a_chi: 'tutti' } }).length === 0);
  const chiuso = modificheDelRecord('SurplusTariffa', { prima: fuel, dopo: { ...fuel, data_fine_validita: '2026-11-30' }, patch: { data_fine_validita: '2026-11-30' } });
  verifica('chiudere il periodo prima si registra', chiuso.length === 1 && chiuso[0].campo === 'data_fine_validita' && chiuso[0].unita === 'giorno', J(chiuso));

  // L'elenco dei fornitori: conta chi c'e', non l'ordine, e si dice per nome.
  const gatim = { id: 'f1', nome: 'GATIM S.R.L.' };
  const emmesse = { id: 'f2', nome: 'EMMESSE SRLS' };
  const elenco = { ...fuel, a_chi: 'elenco', fornitori_json: J([gatim, emmesse]) };
  verifica('gli stessi fornitori in un altro ordine non sono una modifica',
    modificheDelRecord('SurplusTariffa', { prima: elenco, dopo: { ...elenco, fornitori_json: J([emmesse, gatim]) }, patch: { fornitori_json: J([emmesse, gatim]) } }).length === 0);
  const aggiunto = modificheDelRecord('SurplusTariffa', { prima: { ...elenco, fornitori_json: J([gatim]) }, dopo: elenco, patch: { fornitori_json: elenco.fornitori_json } });
  verifica('un fornitore aggiunto si registra', aggiunto.length === 1 && aggiunto[0].campo === 'fornitori_json' && aggiunto[0].unita === 'json', J(aggiunto));
  const diff = differenzeJson(J([gatim]), J([gatim, emmesse]), campoTracciato('SurplusTariffa', 'fornitori_json'));
  verifica('e la differenza si dice coi nomi, senza l\'id dell\'anagrafica',
    diff.length === 1 && diff[0].prima === 'GATIM S.R.L.' && diff[0].dopo === 'GATIM S.R.L., EMMESSE SRLS' && !J(diff).includes('f2'), J(diff));
  verifica('l\'elenco svuotato dice «—» dopo', J(differenzeJson(J([gatim]), '[]', campoTracciato('SurplusTariffa', 'fornitori_json'))) === J([{ voce: '', prima: 'GATIM S.R.L.', dopo: null }]));

  const { testoModifica } = await caricaLibPagine('lib/storicoModifiche');
  const t1 = testoModifica({ entita: 'SurplusTariffa', campo: 'euro_t_passiva', unita: '€/t', prima: '5', dopo: '7', operazione: 'update' });
  verifica('a video: il surplus ai fornitori in €/t, all\'italiana', t1 === 'surplus ai fornitori: 5,00 €/t → 7,00 €/t', t1);
  const t2 = testoModifica({ entita: 'SurplusTariffa', campo: 'fornitori_json', unita: 'json', prima: J([gatim]), dopo: J([gatim, emmesse]), operazione: 'update' });
  verifica('a video: l\'elenco di prima e quello di dopo', t2 === "fornitori dell'elenco: GATIM S.R.L. → GATIM S.R.L., EMMESSE SRLS", t2);
  const t3 = testoModifica({ entita: 'SurplusTariffa', campo: 'data_fine_validita', unita: 'giorno', prima: '2026-12-31', dopo: '2026-11-30', operazione: 'update' });
  verifica('a video: le date gg/mm/aaaa', t3 === 'valido fino al: 31/12/2026 → 30/11/2026', t3);

  // Il motore: la creazione dalla funzione (gestisciAnagrafiche) lascia le righe.
  const a = archivioFinto({});
  const esito = await traccia(a.archivi, 'SurplusTariffa', null, fuel, { utente: 'Mario', origine: 'Tariffe & Anagrafiche' });
  verifica('la creazione scrive il surplus e lo storico, col costo riservato',
    a.db.SurplusTariffa.length === 1 && esito.traccia.scritta === true && esito.traccia.righe === 7
    && a.db.ModificaDato.some(r => r.campo === 'euro_t_passiva' && r.riservato === true && r.entita === 'SurplusTariffa')
    && a.db.ModificaDato.every(r => r.record_id === a.db.SurplusTariffa[0].id), J(a.db.ModificaDato));

  // Revisione del 13/10/2026: un surplus senza importo da Ecotyre (un accordo
  // commerciale con un fornitore, pagato solo da SMOCO) e' tutto un costo dei
  // fornitori, come una tariffa passiva. Prima era riservato solo l'importo ai
  // fornitori, e chi non e' amministratore leggeva in pagina e in EcoTyna nome,
  // fornitore, prestazione e periodo dell'accordo: 7 righe su 8.
  const accordo = {
    nome: 'Accordo Gatim', origine: 'ACCORDO_COMMERCIALE', tipologia: 'RETE', prestazione: 'RACCOLTA', a_chi: 'elenco',
    fornitori_json: J([gatim]), euro_t_passiva: 2, euro_t_attiva: null,
    data_inizio_validita: '2026-10-15', data_fine_validita: '2026-12-31', stato: 'attivo',
  };
  const opz = { utente: 'Mario', origine: 'Tariffe & Anagrafiche', il: '2026-10-13T08:00:00.000Z' };
  const righeAccordo = righeDiModifica('SurplusTariffa', { record_id: 's2', dopo: accordo, operazione: 'create' }, opz);
  verifica('un surplus solo passivo e\' riservato in ogni riga, come una tariffa passiva',
    righeAccordo.length === 8 && righeAccordo.every(r => r.riservato === true), J(righeAccordo.map(r => [r.campo, r.riservato])));
  verifica('e il campo lo dice anche da solo, con l\'importo da Ecotyre vuoto, zero o illeggibile',
    ['', null, undefined, 0, 'cinque'].every(v => campoRiservato('SurplusTariffa', 'nome', { ...accordo, euro_t_attiva: v }))
    && !campoRiservato('SurplusTariffa', 'nome', { ...accordo, euro_t_attiva: 2 }) && !campoRiservato('SurplusTariffa', 'nome', { ...accordo, euro_t_attiva: '2' }));
  verifica('cancellarlo lascia righe riservate',
    righeDiModifica('SurplusTariffa', { record_id: 's2', prima: accordo, operazione: 'delete' }, opz).every(r => r.riservato === true));
  const accorciato = righeDiModifica('SurplusTariffa', { record_id: 's2', prima: accordo, dopo: { ...accordo, data_fine_validita: '2026-11-30' }, patch: { data_fine_validita: '2026-11-30' } }, opz);
  verifica('anche una data cambiata', accorciato.length === 1 && accorciato[0].riservato === true, J(accorciato));
  const spento = righeDiModifica('SurplusTariffa', { record_id: 's1', prima: fuel, dopo: { ...fuel, euro_t_attiva: null }, patch: { euro_t_attiva: null } }, opz);
  verifica('il Fuel Surcharge che perde l\'importo da Ecotyre diventa riservato', spento.length === 1 && spento[0].riservato === true, J(spento));
  const fuelChiuso = righeDiModifica('SurplusTariffa', { record_id: 's1', prima: fuel, dopo: { ...fuel, data_fine_validita: '2026-11-30' }, patch: { data_fine_validita: '2026-11-30' } }, opz);
  verifica('il Fuel Surcharge, che ha la parte attiva, resta visibile', fuelChiuso.length === 1 && fuelChiuso[0].riservato === false, J(fuelChiuso));
  const soloDefault = modificheDelRecord('SurplusTariffa', { dopo: { stato: 'attivo', a_chi: 'tutti' }, operazione: 'create' });
  verifica('la riga senza campi di un surplus senza importo da Ecotyre e\' riservata', soloDefault.length === 1 && soloDefault[0].campo === '' && soloDefault[0].riservato === true, J(soloDefault));
  const vistaAccordo = { asServiceRole: { entities: archivioFinto({ ModificaDato: righeAccordo.map((r, i) => ({ id: `acc${i}`, ...r })) }).archivi } };
  const ecoAccordo = await eseguiStrumento(vistaAccordo, 'storico_modifiche', {}, { amministratore: false });
  verifica('EcoTyna a chi non e\' amministratore non dice niente dell\'accordo, e dice che ci sono righe riservate',
    ecoAccordo.dati.modifiche.righe.length === 0 && ecoAccordo.dati.riservate_non_dette === 8, J(ecoAccordo.dati));
  const ecoAdmin = await eseguiStrumento(vistaAccordo, 'storico_modifiche', {}, { amministratore: true });
  verifica('all\'amministratore tutte e otto', ecoAdmin.dati.modifiche.righe.length === 8, J(ecoAdmin.dati && ecoAdmin.dati.modifiche && ecoAdmin.dati.modifiche.righe.length));
}

console.log('9. I RECAPITI DEL FORNITORE CHE LEGGONO I CONTRATTI (13/10/2026)');
{
  // Il cellulare (FORNITORE_TEL_2), la pec (FORNITORE_EMAIL_2) e il referente
  // (FORNITORE_REFERENTE) arrivano nei contratti dall'anagrafica: chi li ha
  // cambiati, quando e da quale valore si deve sapere. Non sono costi.
  const emmesse = { id: 'fE', ragione_sociale: 'EMMESSE SRL', stato: 'attivo', cellulare: '333 1234567', pec: 'emmesse@pec.it' };
  const cambia = modificheDelRecord('Fornitore', { prima: emmesse, dopo: { ...emmesse, cellulare: '333 7654321', referente: 'Mario Rossi' }, patch: { cellulare: '333 7654321', referente: 'Mario Rossi' } });
  verifica('il cellulare che cambia e il referente che arriva: due righe, col prima vuoto per il referente',
    J(cambia.map(m => [m.campo, m.prima, m.dopo, m.unita, m.riservato])) === J([['cellulare', '333 1234567', '333 7654321', 'testo', false], ['referente', null, 'Mario Rossi', 'testo', false]]), J(cambia));
  verifica('la pec riscritta uguale, con gli spazi, non e\' una modifica',
    modificheDelRecord('Fornitore', { prima: emmesse, dopo: { ...emmesse, pec: ' emmesse@pec.it ' }, patch: { pec: ' emmesse@pec.it ' } }).length === 0);
  const tolta = modificheDelRecord('Fornitore', { prima: emmesse, dopo: { ...emmesse, pec: null }, patch: { pec: null } });
  verifica('una pec tolta si registra, col dopo vuoto', tolta.length === 1 && tolta[0].prima === 'emmesse@pec.it' && tolta[0].dopo === null, J(tolta));
  verifica('lo stato, il nome e i ruoli non si tracciano, e non chiedono letture',
    !toccaCampiTracciati('Fornitore', { stato: 'non_attivo', ragione_sociale: 'X', ruolo_raccolta: true }) && toccaCampiTracciati('Fornitore', { cellulare: '1' })
    && modificheDelRecord('Fornitore', { prima: emmesse, dopo: { ...emmesse, stato: 'non_attivo' }, patch: { stato: 'non_attivo' } }).length === 0);
  verifica('un fornitore nuovo coi recapiti: le righe dei recapiti', J(modificheDelRecord('Fornitore', { dopo: emmesse, operazione: 'create' }).map(m => m.campo).sort()) === J(['cellulare', 'pec']));
  const righe = righeDiModifica('Fornitore', { record_id: 'fE', prima: emmesse, dopo: { cellulare: '333 7654321' }, patch: { cellulare: '333 7654321' } }, { utente: 'Mario', origine: 'Tariffe & Anagrafiche', il: '2026-10-13T20:00:00.000Z' });
  verifica('l\'etichetta e\' la ragione sociale, senza anno, e la riga non e\' riservata',
    righe.length === 1 && righe[0].etichetta === 'EMMESSE SRL' && !('anno' in righe[0]) && righe[0].riservato === false && righe[0].entita === 'Fornitore', J(righe));
  verifica('i nomi a video', ['cellulare', 'pec', 'referente'].every(c => (campoTracciato('Fornitore', c) || {}).nome === c));

  // Il motore: una modifica dello stato non legge; una dei recapiti legge una volta e registra.
  const a = archivioFinto({ Fornitore: [emmesse] });
  await traccia(a.archivi, 'Fornitore', 'fE', { stato: 'non_attivo' }, { utente: 'Mario' });
  verifica('lo stato si scrive senza lettura e senza righe', a.conti.get === 0 && a.conti.update === 1 && !(a.db.ModificaDato || []).length, J(a.conti));
  const esito = await traccia(a.archivi, 'Fornitore', 'fE', { referente: 'Mario Rossi' }, { utente: 'Mario', origine: 'Tariffe & Anagrafiche' });
  verifica('il referente: una lettura, una riga, la traccia scritta', a.conti.get === 1 && esito.traccia.scritta === true && esito.traccia.righe === 1
    && J((a.db.ModificaDato || []).map(x => [x.campo, x.dopo])) === J([['referente', 'Mario Rossi']]), J({ conti: a.conti, reg: a.db.ModificaDato }));
  // Cancellare un fornitore lascia la riga di che cosa c'era.
  const b = archivioFinto({ Fornitore: [emmesse] });
  await eliminaConTraccia(b.archivi, 'Fornitore', 'fE', { utente: 'Mario' });
  verifica('un fornitore eliminato lascia i suoi recapiti nello storico',
    J((b.db.ModificaDato || []).map(r => [r.operazione, r.campo, r.prima]).sort()) === J([['delete', 'cellulare', '333 1234567'], ['delete', 'pec', 'emmesse@pec.it']]), J(b.db.ModificaDato));

  // La funzione vera: la scheda dei fornitori scrive con gestisciAnagrafiche.
  const ga = await caricaFunzione('gestisciAnagrafiche');
  const r = await chiama(ga, { db: { Fornitore: [emmesse] }, corpo: { entita: 'Fornitore', operazione: 'update', id: 'fE', dati: { pec: 'nuova@pec.it', referente: 'Anna Bianchi' } } });
  const reg = r.db.ModificaDato || [];
  verifica('gestisciAnagrafiche: due righe, con chi e da dove, e la traccia nella risposta',
    r.stato === 200 && J(reg.map(x => x.campo).sort()) === J(['pec', 'referente']) && reg.every(x => x.utente === 'prova@prova' && x.origine === 'Tariffe & Anagrafiche' && x.etichetta === 'EMMESSE SRL')
    && r.j.traccia && r.j.traccia.scritta === true && r.j.traccia.righe === 2, J({ reg, t: r.j.traccia }));

  const { testoModifica } = await caricaLibPagine('lib/storicoModifiche');
  const t1 = testoModifica({ entita: 'Fornitore', campo: 'cellulare', unita: 'testo', prima: '333 1234567', dopo: '333 7654321', operazione: 'update' });
  verifica('a video: il cellulare di prima e quello di dopo', t1 === 'cellulare: 333 1234567 → 333 7654321', t1);
  const t2 = testoModifica({ entita: 'Fornitore', campo: 'referente', unita: 'testo', dopo: 'Mario Rossi', operazione: 'update' });
  verifica('a video: il referente che mancava', t2 === 'referente: — → Mario Rossi', t2);

  // EcoTyna (chiusura del giro, 14/10/2026): l'archivio a parole e le domande che
  // lo trovano. Senza il nome diceva «Fornitore», e «chi ha cambiato il
  // cellulare?» non trovava niente.
  const finto = { asServiceRole: { entities: archivioFinto({ ModificaDato: reg.map((x, i) => ({ id: `rf${i}`, ...x })) }).archivi } };
  const chiedi = async (cosa) => (await eseguiStrumento(finto, 'storico_modifiche', { cosa }, { amministratore: false })).dati;
  const perRecapiti = await chiedi('recapiti per i contratti');
  verifica('EcoTyna dice l\'archivio a parole, non «Fornitore»', perRecapiti.modifiche.righe.length === 2 && perRecapiti.modifiche.righe.every(x => x.archivio === 'anagrafica dei fornitori (recapiti per i contratti)'), J(perRecapiti.modifiche));
  const trovate = await Promise.all(['cellulare', 'referente', 'anagrafica dei fornitori', 'contratti'].map(chiedi));
  verifica('e le trova chiedendo del cellulare, del referente, dell\'anagrafica o dei contratti', trovate.every(d => d.modifiche.righe.some(x => x.archivio === 'anagrafica dei fornitori (recapiti per i contratti)')), J(trovate.map(d => d.modifiche.righe.length)));
  verifica('la nota dice che lo storico registra i recapiti dei fornitori', /i recapiti dei fornitori per i contratti: cellulare, pec, referente/.test(perRecapiti.nota), perRecapiti.nota);
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
