// Prova del REPORT DEI CONFERIMENTI per settimana (base44/shared/reportConferimenti.ts).
//
// Richiesta dell'utente (29/09/2026): i conferimenti di un mese ripartiti sulle
// settimane che lo coprono, con origine, destinazione, trasportatore e peso
// effettivo, i totali per ciascuno, e la quadratura con la fatturazione passiva.
//
// Qui si controllano le regole che contano:
//  - il periodo e' la FINE del trasporto, mai la chiusura a portale (regola 1);
//  - i canali non si mescolano (regola 3): un canale per volta;
//  - una settimana a cavallo di due mesi conta nel mese solo per i suoi giorni;
//  - un terminato senza fine trasporto resta fuori dal conto e si dice;
//  - la quadratura dice lo scarto e non aggiusta niente.
// npm run prove
import { reportConferimenti, quadraturaPassiva, daDoveADove, settimanaDelGiorno, etichettaSettimana } from '../base44/shared/reportConferimenti.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);

const g = (giorno) => `${giorno}T09:00:00Z`;
// Settembre 2026: il 1 e' un martedi'. Le settimane del file di gestione
// (lunedi'-domenica, settimana 1 = quella del 1 gennaio) che coprono il mese sono
// cinque, la prima e l'ultima tagliate sul mese.
const sec = (id, campi = {}) => ({
  id_ordine: id, numero_fir: 'FIR' + id, stato: 'terminato',
  stoccaggio: 'NAPPI SUD SRL', destinazione: 'IRIGOM SRL', trasportatore: 'TRANSAR SRL',
  peso_effettivo: 10000, classe: 'P - fino a 35 kg', prodotto: '.class1',
  trasporto_iniziato_il: g('2026-09-08'), trasporto_finito_il: g('2026-09-10'),
  ordine_chiuso_il: g('2026-10-05'), ...campi,
});

console.log('LE SETTIMANE CHE COPRONO IL MESE');
const base = reportConferimenti([sec('SEC1')], { anno: 2026, mese: 9, canale: 'RETE', archivio: 'Secondaria', tipo: 'secondaria' });
verifica('settembre 2026 e\' coperto da cinque settimane', base.settimane.length === 5, J(base.settimane.map(s => s.numero)));
verifica('la prima comincia il primo del mese e l\'ultima finisce l\'ultimo giorno',
  base.settimane[0].dal === '2026-09-01' && base.settimane[4].al === '2026-09-30', J([base.settimane[0], base.settimane[4]]));
verifica('l\'etichetta porta il numero E l\'intervallo, cosi\' il numero non e\' ambiguo',
  /^Settimana \d+ \(\d{2}\/\d{2}–\d{2}\/\d{2}\)$/.test(etichettaSettimana(base.settimane[1])), etichettaSettimana(base.settimane[1]));
verifica('un giorno fuori dal mese non sta in nessuna settimana', settimanaDelGiorno(base.settimane, '2026-10-02') === null);

console.log('IL PERIODO E\' LA FINE DEL TRASPORTO, MAI LA CHIUSURA A PORTALE (regola 1)');
// Questo carico e' finito il 30/09 ed e' stato chiuso a portale il 05/10: e' di
// settembre, nell'ultima settimana. Sulla chiusura sarebbe finito in ottobre.
const aCavallo = reportConferimenti([sec('SEC2', { trasporto_finito_il: g('2026-09-30'), ordine_chiuso_il: g('2026-10-05') })],
  { anno: 2026, mese: 9, canale: 'RETE', archivio: 'Secondaria', tipo: 'secondaria' });
verifica('un carico chiuso a ottobre ma finito il 30/09 e\' di settembre', aCavallo.totale_kg === 10000, String(aCavallo.totale_kg));
verifica('e sta nell\'ultima settimana del mese', aCavallo.righe[0].settimane[aCavallo.settimane[4].numero].kg === 10000, J(aCavallo.righe[0].settimane));
// Un carico del primo di ottobre non e' di settembre, nemmeno se la sua settimana
// comincia a settembre: la settimana a cavallo conta nel mese solo per i suoi giorni.
const ottobre = reportConferimenti([sec('SEC3', { trasporto_finito_il: g('2026-10-01') })],
  { anno: 2026, mese: 9, canale: 'RETE', archivio: 'Secondaria', tipo: 'secondaria' });
verifica('un carico del 1 ottobre non entra nel report di settembre', ottobre.totale_kg === 0 && ottobre.righe.length === 0, String(ottobre.totale_kg));

console.log('UN TERMINATO SENZA FINE TRASPORTO RESTA FUORI, E SI DICE');
const senzaData = reportConferimenti([sec('SEC1'), sec('SEC9', { trasporto_finito_il: null })],
  { anno: 2026, mese: 9, canale: 'RETE', archivio: 'Secondaria', tipo: 'secondaria' });
verifica('non entra nel totale', senzaData.totale_kg === 10000, String(senzaData.totale_kg));
verifica('ma si conta e si nomina', senzaData.senza_fine === 1 && senzaData.senza_fine_kg === 10000
  && senzaData.senza_fine_ordini.includes('SEC9'), J([senzaData.senza_fine, senzaData.senza_fine_ordini]));
verifica('un non terminato non c\'entra niente', reportConferimenti([sec('SEC8', { stato: 'assegnato' })],
  { anno: 2026, mese: 9, canale: 'RETE', archivio: 'Secondaria', tipo: 'secondaria' }).totale_kg === 0);

console.log('I CANALI NON SI MESCOLANO MAI (regola 3)');
// Una secondaria ACI si riconosce dalla classe (canaleSecondaria), non dall'archivio.
const aci = sec('SEC4', { classe: 'PFU Autodemolizione', prodotto: '.class9', peso_effettivo: 3000 });
const misti = [sec('SEC1'), aci];
const soloRete = reportConferimenti(misti, { anno: 2026, mese: 9, canale: 'RETE', archivio: 'Secondaria', tipo: 'secondaria' });
const soloAci = reportConferimenti(misti, { anno: 2026, mese: 9, canale: 'ACI', archivio: 'Secondaria', tipo: 'secondaria' });
verifica('la rete conta i suoi chili', soloRete.totale_kg === 10000, String(soloRete.totale_kg));
verifica('l\'ACI i suoi', soloAci.totale_kg === 3000, String(soloAci.totale_kg));
verifica('e nessuno dei due e\' la somma', soloRete.totale_kg + soloAci.totale_kg === 13000
  && soloRete.righe.every(r => r.kg !== 13000) && soloAci.righe.every(r => r.kg !== 13000));

console.log('LE RIGHE: ORIGINE, DESTINAZIONE, TRASPORTATORE E PESO');
const tante = reportConferimenti([
  sec('SEC1', { peso_effettivo: 12000, trasporto_finito_il: g('2026-09-03') }),
  sec('SEC2', { peso_effettivo: 8000, trasporto_finito_il: g('2026-09-15') }),
  sec('SEC3', { peso_effettivo: 5000, trasporto_finito_il: g('2026-09-15'), destinazione: 'GATIM S.R.L.' }),
  sec('SEC4', { peso_effettivo: 4000, trasporto_finito_il: g('2026-09-22'), trasportatore: 'EMMESSE SRL' }),
], { anno: 2026, mese: 9, canale: 'RETE', archivio: 'Secondaria', tipo: 'secondaria' });
verifica('tre tratte distinte', tante.righe.length === 3, J(tante.righe.map(r => [r.origine, r.destinazione, r.trasportatore, r.kg])));
verifica('la tratta ripetuta somma i suoi carichi', tante.righe[0].kg === 20000 && tante.righe[0].righe === 2, J(tante.righe[0]));
verifica('e li mette nelle settimane giuste', tante.righe[0].settimane[tante.settimane[0].numero].kg === 12000
  && tante.righe[0].settimane[tante.settimane[2].numero].kg === 8000, J(tante.righe[0].settimane));
verifica('il totale del mese torna', tante.totale_kg === 29000 && tante.totale_t === 29, String(tante.totale_kg));
verifica('i totali di colonna tornano settimana per settimana',
  tante.totali_settimana[tante.settimane[0].numero].kg === 12000
  && tante.totali_settimana[tante.settimane[2].numero].kg === 13000
  && tante.totali_settimana[tante.settimane[3].numero].kg === 4000, J(tante.totali_settimana));
verifica('la somma delle settimane fa il totale',
  Object.values(tante.totali_settimana).reduce((s, v) => s + v.kg, 0) === tante.totale_kg);
verifica('i conferimenti si sommano anche per impianto di destinazione',
  tante.per_destinazione.length === 2 && tante.per_destinazione[0].destinazione === 'IRIGOM SRL'
  && tante.per_destinazione[0].kg === 24000, J(tante.per_destinazione));

console.log('PRIMARIE E SECONDARIE: CAMBIA SOLO DA DOVE PARTE IL CARICO');
verifica('una secondaria parte dal piazzale', daDoveADove({ stoccaggio: 'NAPPI SUD SRL', destinazione: 'IRIGOM SRL', trasportatore: 'TRANSAR SRL' }, 'secondaria').origine === 'NAPPI SUD SRL');
verifica('una primaria parte da una provincia, non dal singolo punto di raccolta',
  daDoveADove({ provincia: 'sa', destinazione: 'IRIGOM SRL', trasportatore: 'C.L. SERVICE' }, 'primaria').origine === 'SA');
const prim = reportConferimenti([
  { id_ordine: 'ET1', stato: 'terminato', provincia: 'SA', destinazione: 'IRIGOM SRL', trasportatore: 'C.L. SERVICE', peso_effettivo: 2000, classe: 'PFU Autodemolizione', prodotto: '.class9', trasporto_finito_il: g('2026-09-10') },
], { anno: 2026, mese: 9, canale: 'ACI', archivio: '', tipo: 'primaria' });
verifica('il report delle primarie ACI sta in piedi', prim.totale_kg === 2000 && prim.righe[0].origine === 'SA', J(prim.righe[0]));

console.log('LA QUADRATURA CON LA FATTURAZIONE PASSIVA');
const passiva = {
  trasporti_secondaria: [{
    fornitore: 'TRANSAR SRL',
    righe: [
      { stoccaggio: 'NAPPI SUD SRL', destinazione: 'IRIGOM SRL', trasportatore: 'TRANSAR SRL', tonnellate: 20, importo: 1400, unita_misura: '€/t' },
      { stoccaggio: 'NAPPI SUD SRL', destinazione: 'GATIM S.R.L.', trasportatore: 'TRANSAR SRL', tonnellate: 5, importo: 350, unita_misura: '€/t' },
    ],
  }],
};
const q = quadraturaPassiva(tante, passiva);
verifica('le tratte che tornano si dicono tornate', q.disponibile === true
  && q.voci.filter(v => v.torna === true).length === 2, J(q.voci.map(v => [v.destinazione, v.kg_report, v.kg_passiva, v.torna])));
verifica('la tratta che la passiva non paga si segnala, non si nasconde',
  q.voci.some(v => v.trasportatore === 'EMMESSE SRL' && v.solo_report === true && v.kg_passiva === null), J(q.voci.find(v => v.trasportatore === 'EMMESSE SRL')));
verifica('e il verdetto complessivo dice che non quadra', q.quadra === false && q.n_difformi === 1, J([q.quadra, q.n_difformi]));
verifica('l\'importo della passiva si porta accanto, per informazione', q.importo_passiva === 1750, String(q.importo_passiva));

// Uno scarto di chili si dice, e non si aggiusta.
const passivaScarto = { trasporti_secondaria: [{ fornitore: 'TRANSAR SRL', righe: [
  { stoccaggio: 'NAPPI SUD SRL', destinazione: 'IRIGOM SRL', trasportatore: 'TRANSAR SRL', tonnellate: 19.5, importo: 1365, unita_misura: '€/t' },
] }] };
const qs = quadraturaPassiva(tante, passivaScarto);
const voceIrigom = qs.voci.find(v => v.destinazione === 'IRIGOM SRL');
verifica('lo scarto si dice col suo segno', voceIrigom.scarto_kg === 500 && voceIrigom.torna === false, J(voceIrigom));
verifica('e il totale del report non viene ritoccato per far quadrare', qs.totale_report_kg === 29000, String(qs.totale_report_kg));

// Una tratta che la passiva paga e il report non ha: e' l'altro verso dello stesso
// controllo, e va detto (di solito e' un movimento di un altro mese o di un altro canale).
const passivaInPiu = { trasporti_secondaria: [{ fornitore: 'ALTRO TRASPORTI', righe: [
  { stoccaggio: 'PRT SRL', destinazione: 'IRIGOM SRL', trasportatore: 'ALTRO TRASPORTI', tonnellate: 3, importo: 210, unita_misura: '€/t' },
] }] };
const qi = quadraturaPassiva(tante, passivaInPiu);
verifica('una tratta che sta solo nella passiva si dice', qi.voci.some(v => v.solo_passiva === true && v.origine === 'PRT SRL'), J(qi.voci.filter(v => v.solo_passiva)));

verifica('senza il conto della passiva non si inventa un verdetto',
  quadraturaPassiva(tante, null).disponibile === false);
verifica('per le primarie si dice che il confronto per tratta non ha senso, invece di farlo male',
  quadraturaPassiva(prim, passiva).solo_totale === true && quadraturaPassiva(prim, passiva).disponibile === false,
  J(quadraturaPassiva(prim, passiva)));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
