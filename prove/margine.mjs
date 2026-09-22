// Prova del margine (base44/shared/margine.ts): ricavo meno costo, per canale,
// con gli stessi calcoli delle due fatturazioni. Si lancia con: npm run prove
import { calcolaMargineAnno } from '../base44/shared/margine.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const base = { stato: 'terminato', cer: '160103', classe: 'A' };
const dati = {
  reteAll: [
    { ...base, id: '1', id_ordine: 'ET1', numero_fir: 'F1', peso_effettivo: 10000, trasporto_finito_il: '2026-02-10T00:00:00Z', trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', provincia: 'BA', tipo_destinazione: 'imp', automezzo: 'AA111AA' },
    { ...base, id: '2', id_ordine: 'ET2', numero_fir: 'F2', peso_effettivo: 5000, trasporto_finito_il: '2026-03-05T00:00:00Z', trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', provincia: 'BA', tipo_destinazione: 'imp', automezzo: 'AA111AA' },
  ],
  aciAll: [
    { ...base, id: '3', id_ordine: 'EA1', numero_fir: 'FA1', classe: 'C', regione: 'Puglia', peso_effettivo: 2000, peso_stimato: 2000, trasporto_finito_il: '2026-02-12T00:00:00Z', trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', provincia: 'BA', tipo_destinazione: 'imp', automezzo: 'AA111AA' },
  ],
  extraAll: [], secondarieAll: [],
  fornitori: [{ ragione_sociale: 'ALFA SRL', stato: 'attivo' }, { ragione_sociale: 'BETA IMPIANTI', stato: 'attivo' }],
  tariffe: [
    { id: 'a1', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo' },
    { id: 'a2', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: 'Puglia', valore: 240, unita_misura: '€/t', stato: 'attivo' },
    { id: 'p1', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Alfa s.r.l.', tipologia: 'RETE', valore: 60, unita_misura: '€/t' },
    { id: 'p2', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'TRATTAMENTO', fornitore_nome: 'Beta Impianti', tipologia: 'RETE', valore: 80, unita_misura: '€/t' },
    { id: 'p3', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Alfa s.r.l.', tipologia: 'ACI', valore: 90, unita_misura: '€/t' },
  ],
};
const m = calcolaMargineAnno(dati, 2026, 2);
const rete = m.canali.find(c => c.canale === 'RETE'), aci = m.canali.find(c => c.canale === 'ACI'), extra = m.canali.find(c => c.canale === 'EXTRA_RACCOLTA');
verifica('tre canali, tre mesi ciascuno', m.canali.length === 3 && rete.mesi.length === 3);
verifica('rete febbraio: 10 t, ricavo 2020, costo 600 + 800, margine 620', rete.mesi[1].ricavo === 2020 && rete.mesi[1].costo === 1400 && rete.mesi[1].margine === 620 && rete.mesi[1].costo_raccolta === 600 && rete.mesi[1].costo_impianti === 800, JSON.stringify(rete.mesi[1]));
verifica('rete anno: 15 t, ricavo 3030, costo 2100, margine 930 = 30,7%', rete.anno.tonnellate === 15 && rete.anno.ricavo === 3030 && rete.anno.costo === 2100 && rete.anno.margine === 930 && rete.anno.margine_pct === 30.7 && rete.anno.margine_t === 62, JSON.stringify(rete.anno));
verifica('aci: il canale ha il suo margine, separato (480 - 180 = 300)', aci.anno.ricavo === 480 && aci.anno.costo_raccolta === 180 && aci.anno.tonnellate === 2, JSON.stringify(aci.anno));
verifica('aci: il trattamento senza tariffa e\' un\'anomalia che si vede accanto al mese', aci.mesi[1].anomalie_passiva > 0);
verifica('extra vuota: zeri e percentuale assente, non NaN', extra.anno.ricavo === 0 && extra.anno.margine_pct === null && extra.anno.margine_t === null);
verifica('nessun totale che somma i canali', !('totale' in m) && !('totale_generale' in m));

// Un viaggio di secondaria con rete e ACI, a prezzo per viaggio: pesa su tutti e
// due i margini, ciascuno per la sua quota dei chili (regola del 22/09/2026).
// Prima pesava tutto sulla rete e l'ACI aveva un margine piu' alto del vero.
const sec = (id, kg, aci) => ({ stato: 'terminato', cer: '160103', id, id_ordine: 'S' + id, numero_fir: 'FS' + id, peso_effettivo: kg,
  ordine_immesso_il: '2026-02-20T00:00:00Z', trasporto_iniziato_il: '2026-02-20T00:00:00Z', trasporto_finito_il: '2026-02-20T00:00:00Z',
  stoccaggio: 'NAPPI SUD', trasportatore: 'GAMMA TRASPORTI', destinazione: 'IRIGOM', tipo_destinazione: 'imp', automezzo: 'AA111AA',
  ...(aci ? { classe: 'C', codice_prodotto: '.class9' } : { classe: 'A' }) });
const conMisto = {
  ...dati,
  secondarieAll: [sec('s1', 6000, false), sec('s2', 4000, true)],
  fornitori: [...dati.fornitori, { ragione_sociale: 'GAMMA TRASPORTI', stato: 'attivo' }],
  tariffe: [...dati.tariffe, { id: 'ps', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'TRASPORTO_SECONDARIA', fornitore_nome: 'Gamma Trasporti', produttore: 'Nappi Sud', destinatario: 'Irigom', tipologia: 'TUTTE', valore: 500, unita_misura: '€/viaggio' }],
};
const mm = calcolaMargineAnno(conMisto, 2026, 2);
const reteM = mm.canali.find(c => c.canale === 'RETE'), aciM = mm.canali.find(c => c.canale === 'ACI');
verifica('viaggio misto da 500 euro: 300 sul margine della rete e 200 su quello dell\'ACI', reteM.mesi[1].costo_trasporti === 300 && aciM.mesi[1].costo_trasporti === 200 && reteM.mesi[1].costo_trasporti + aciM.mesi[1].costo_trasporti === 500, `${reteM.mesi[1].costo_trasporti} + ${aciM.mesi[1].costo_trasporti}`);

// Un terminato senza fine trasporto non e' in nessun mese, quindi nemmeno nel
// margine: si dice una volta per l'anno, per canale, e non in ogni mese.
const conSenzaFine = { ...dati, reteAll: [...dati.reteAll, { ...dati.reteAll[0], id: '9', id_ordine: 'ET9', numero_fir: 'F9', ordine_immesso_il: '2026-01-15T00:00:00Z', trasporto_finito_il: null }] };
const ms = calcolaMargineAnno(conSenzaFine, 2026, 2);
const reteS = ms.canali.find(c => c.canale === 'RETE');
verifica('senza fine trasporto: fuori dal margine, detto una volta sulla rete', reteS.anno.ricavo === 3030 && reteS.senza_fine_trasporto && reteS.senza_fine_trasporto.quanti === 1 && reteS.senza_fine_trasporto.tonnellate === 10
  && !ms.canali.find(c => c.canale === 'ACI').senza_fine_trasporto, JSON.stringify(reteS.senza_fine_trasporto));
verifica('...e non conta fra le anomalie di ogni mese', reteS.mesi.every((x, i) => x.anomalie_passiva === rete.mesi[i].anomalie_passiva), JSON.stringify([reteS.mesi.map(x => x.anomalie_passiva), rete.mesi.map(x => x.anomalie_passiva)]));

// Immesso il 20/12/2025 e senza fine trasporto: la passiva lo segnala nei primi
// mesi del 2026 (revisione del 22/09/2026). Il margine dell'anno lo dice anche
// quando l'ultimo mese calcolato e' settembre, dove non si segnala piu'.
const conDicembre = { ...dati, reteAll: [...dati.reteAll, { ...dati.reteAll[0], id: '10', id_ordine: 'ET10', numero_fir: 'F10', peso_effettivo: 3000, ordine_immesso_il: '2025-12-20T00:00:00Z', trasporto_iniziato_il: '2025-12-28T00:00:00Z', trasporto_finito_il: null }] };
const md = calcolaMargineAnno(conDicembre, 2026, 8).canali.find(c => c.canale === 'RETE');
verifica('immesso a dicembre dell\'anno prima: nel margine 2026 fino a settembre, una volta', md.senza_fine_trasporto && md.senza_fine_trasporto.quanti === 1 && md.senza_fine_trasporto.tonnellate === 3 && /ET10/.test(md.senza_fine_trasporto.descrizione) && /fino a settembre/.test(md.senza_fine_trasporto.descrizione), JSON.stringify(md.senza_fine_trasporto));
const md27 = calcolaMargineAnno(conDicembre, 2027, 11).canali.find(c => c.canale === 'RETE');
verifica('...e non nel 2027', md27.senza_fine_trasporto === null, JSON.stringify(md27.senza_fine_trasporto));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
