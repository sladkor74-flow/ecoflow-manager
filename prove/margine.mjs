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

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
