// Prova dell'ANDAMENTO DELLA RACCOLTA per raccoglitore e per zona
// (base44/shared/andamentoRaccoglitori.ts).
//
// Richiesta dell'utente (29/09/2026): la fotografia istantanea dell'andamento
// mensile, che si aggiorna da sola a ogni caricamento, e l'andamento per zone di
// competenza, con le zone DICHIARATE (non dedotte) perche' solo un perimetro
// scritto permette di dire «ha raccolto fuori zona».
//
// Le regole controllate qui: solo RETE (una classe 9 nell'archivio della rete e'
// ACI e non si conta), il periodo e' la FINE del trasporto, lo scarto si calcola
// solo dove un target c'e', e senza zona dichiarata non si inventa nessun fuori zona.
// npm run prove
import { andamentoRaccoglitori, andamentoPerZona, zonePerRaccoglitore, provinceDiZona, proponiZona } from '../base44/shared/andamentoRaccoglitori.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);

const g = (giorno) => `${giorno}T09:00:00Z`;
const rit = (id, campi = {}) => ({
  id_ordine: id, numero_fir: 'FIR' + id, stato: 'terminato',
  trasportatore: 'C.L. SERVICE S.R.L.', provincia: 'SA', peso_effettivo: 5000,
  classe: 'P - fino a 35 kg', prodotto: '.class1',
  ordine_immesso_il: g('2026-01-10'), trasporto_iniziato_il: g('2026-02-09'),
  trasporto_finito_il: g('2026-02-10'), ordine_chiuso_il: g('2026-03-05'), ...campi,
});

console.log('LE PROVINCE DI UNA ZONA, SCRITTE COME VIENE');
verifica('separate come si vuole', J(provinceDiZona({ province: 'SA, NA;CE  ba' })) === J(['SA', 'NA', 'CE', 'BA']), J(provinceDiZona({ province: 'SA, NA;CE  ba' })));
verifica('quello che non e\' una sigla si scarta', J(provinceDiZona({ province: 'SA, Salerno, X' })) === J(['SA']), J(provinceDiZona({ province: 'SA, Salerno, X' })));
verifica('una zona vuota e\' vuota', J(provinceDiZona({})) === J([]) && J(provinceDiZona(null)) === J([]));
const zone = zonePerRaccoglitore([
  { raccoglitore: 'C.L. Service S.r.l.', anno: 2026, province: 'SA, NA' },
  { raccoglitore: 'C.L. SERVICE SRL', anno: 2026, province: 'CE' },
  { raccoglitore: 'C.L. Service S.r.l.', anno: 2025, province: 'BA' },
], 2026);
verifica('due righe dello stesso raccoglitore si uniscono, non si sovrascrivono',
  J([...zone.values()][0].province) === J(['SA', 'NA', 'CE']), J([...zone.values()][0]));
verifica('e l\'anno sbagliato resta fuori', ![...zone.values()][0].province.includes('BA'));

console.log('L\'ANDAMENTO MESE PER MESE');
const a = andamentoRaccoglitori([
  rit('ET1', { trasporto_finito_il: g('2026-02-10'), peso_effettivo: 5000 }),
  rit('ET2', { trasporto_finito_il: g('2026-02-20'), peso_effettivo: 3000 }),
  rit('ET3', { trasporto_finito_il: g('2026-05-05'), peso_effettivo: 7000 }),
], { anno: 2026 });
verifica('un raccoglitore solo', a.righe.length === 1 && a.righe[0].nome === 'C.L. SERVICE S.R.L.', J(a.righe.map(r => r.nome)));
verifica('febbraio somma i suoi due ritiri', a.righe[0].mesi[1].kg === 8000 && a.righe[0].mesi[1].ritiri === 2, J(a.righe[0].mesi[1]));
verifica('maggio ha il suo', a.righe[0].mesi[4].kg === 7000, J(a.righe[0].mesi[4]));
verifica('i mesi vuoti sono zero, non mancanti', a.righe[0].mesi.length === 12 && a.righe[0].mesi[0].kg === 0);
verifica('il totale dell\'anno torna', a.righe[0].kg === 15000 && a.totale_kg === 15000);
verifica('e i totali di colonna pure', a.totali_mese[1] === 8000 && a.totali_mese[4] === 7000
  && a.totali_mese.reduce((s, v) => s + v, 0) === 15000, J(a.totali_mese));

console.log('IL PERIODO E\' LA FINE DEL TRASPORTO, MAI LA CHIUSURA A PORTALE (regola 1)');
// Finito il 28 febbraio, chiuso a portale il 5 marzo: e' di febbraio.
const aCavallo = andamentoRaccoglitori([rit('ET9', { trasporto_finito_il: g('2026-02-28'), ordine_chiuso_il: g('2026-03-05') })], { anno: 2026 });
verifica('vale il mese in cui il camion ha finito', aCavallo.righe[0].mesi[1].kg === 5000 && aCavallo.righe[0].mesi[2].kg === 0, J(aCavallo.righe[0].mesi.map(m => m.kg)));
verifica('un terminato senza fine trasporto non sta in nessun mese',
  andamentoRaccoglitori([rit('ET8', { trasporto_finito_il: null })], { anno: 2026 }).righe.length === 0);
verifica('e un non terminato nemmeno',
  andamentoRaccoglitori([rit('ET7', { stato: 'assegnato' })], { anno: 2026 }).righe.length === 0);

console.log('SOLO RETE: UNA CLASSE 9 NELL\'ARCHIVIO DELLA RETE E\' ACI (regola 3)');
const conAci = andamentoRaccoglitori([
  rit('ET1', { peso_effettivo: 5000 }),
  rit('ET2', { peso_effettivo: 9000, classe: 'PFU Autodemolizione', prodotto: '.class9' }),
], { anno: 2026 });
verifica('i chili dell\'ACI non entrano nella raccolta di rete', conAci.totale_kg === 5000, String(conAci.totale_kg));

console.log('IL TARGET, DOVE C\'E\'');
const conTarget = andamentoRaccoglitori([
  rit('ET1', { trasporto_finito_il: g('2026-02-10'), peso_effettivo: 8000 }),
], { anno: 2026, targetPerMese: (chiave, i, nome) => (i === 1 && nome === 'C.L. SERVICE S.R.L.' ? 10000 : null) });
verifica('lo scarto si calcola dove il target c\'e\'', conTarget.righe[0].mesi[1].scarto_kg === -2000
  && conTarget.righe[0].mesi[1].copertura === 80, J(conTarget.righe[0].mesi[1]));
verifica('e dove non c\'e\' resta nullo, invece di inventare un giudizio',
  conTarget.righe[0].mesi[0].scarto_kg === null && conTarget.righe[0].mesi[0].copertura === null, J(conTarget.righe[0].mesi[0]));
verifica('il target dell\'anno e\' la somma dei mesi che ne hanno uno',
  conTarget.righe[0].target_anno_kg === 10000 && conTarget.righe[0].scarto_anno_kg === -2000, J([conTarget.righe[0].target_anno_kg, conTarget.righe[0].scarto_anno_kg]));
verifica('senza nessun target l\'anno non ha uno scarto', a.righe[0].target_anno_kg === null && a.righe[0].scarto_anno_kg === null);

console.log('LE ZONE: DICHIARATE, NON DEDOTTE');
const movimenti = [
  rit('ET1', { provincia: 'SA', peso_effettivo: 10000 }),
  rit('ET2', { provincia: 'NA', peso_effettivo: 6000 }),
  rit('ET3', { provincia: 'FG', peso_effettivo: 4000 }),
  rit('ET4', { provincia: 'BA', trasportatore: 'EMMESSE SRL', peso_effettivo: 9000 }),
];
const senzaZone = andamentoRaccoglitori(movimenti, { anno: 2026 });
verifica('senza zona dichiarata non si dice nessun fuori zona', senzaZone.righe.every(r => r.zona_dichiarata === false && r.fuori_zona.length === 0));
verifica('ma si dice CHI non ha una zona scritta', senzaZone.con_zona === 0 && senzaZone.senza_zona.length === 2, J(senzaZone.senza_zona));
verifica('e dove ha raccolto si vede lo stesso', J(senzaZone.righe[0].province.map(p => p.provincia)) === J(['SA', 'NA', 'FG']), J(senzaZone.righe[0].province));

const conZone = andamentoRaccoglitori(movimenti, {
  anno: 2026,
  zone: [{ raccoglitore: 'C.L. SERVICE S.R.L.', anno: 2026, province: 'SA, NA' }],
});
const cl = conZone.righe.find(r => r.chiave.includes('service'));
verifica('con la zona scritta, la provincia fuori perimetro si dice', cl.zona_dichiarata === true
  && J(cl.fuori_zona.map(p => p.provincia)) === J(['FG']) && cl.fuori_zona_kg === 4000, J(cl.fuori_zona));
verifica('e quelle di competenza no', !cl.fuori_zona.some(p => p.provincia === 'SA' || p.provincia === 'NA'));
verifica('chi non ha la zona resta senza giudizio', conZone.righe.find(r => r.nome === 'EMMESSE SRL').fuori_zona.length === 0);

console.log('L\'ANDAMENTO PER ZONA: CHI HA RACCOLTO DOVE');
const zoneVista = andamentoPerZona(conZone);
verifica('una provincia per riga, ordinate per peso', zoneVista[0].provincia === 'SA' && zoneVista[0].kg === 10000, J(zoneVista.map(z => [z.provincia, z.kg])));
verifica('la regione si deduce dalla provincia', zoneVista[0].regione === 'Campania', zoneVista[0].regione);
verifica('dentro ogni provincia c\'e\' chi ci ha raccolto', zoneVista[0].raccoglitori.length === 1
  && zoneVista[0].raccoglitori[0].di_sua_competenza === true, J(zoneVista[0].raccoglitori));
const fg = zoneVista.find(z => z.provincia === 'FG');
verifica('e la riga dice se quel raccoglitore li e\' di competenza', fg.raccoglitori[0].di_sua_competenza === false
  && fg.fuori_zona_kg === 4000, J(fg));
const ba = zoneVista.find(z => z.provincia === 'BA');
verifica('per chi non ha zona il giudizio e\' nullo, non falso', ba.raccoglitori[0].di_sua_competenza === null
  && ba.fuori_zona_kg === 0, J(ba));

console.log('LA ZONA PROPOSTA: UN PUNTO DI PARTENZA, NON UNA ZONA');
const proposta = proponiZona(senzaZone.righe[0]);
verifica('propone le province dove ha davvero raccolto', J(proposta.province) === J(['SA', 'NA', 'FG']), J(proposta));
const conBriciola = andamentoRaccoglitori([...movimenti, rit('ET5', { provincia: 'RM', peso_effettivo: 400 })], { anno: 2026 });
const propostaConBriciola = proponiZona(conBriciola.righe.find(r => r.chiave.includes('service')));
verifica('un ritiro isolato non diventa una zona di competenza', !propostaConBriciola.province.includes('RM')
  && propostaConBriciola.scartate.some(s => s.provincia === 'RM' && s.kg === 400), J(propostaConBriciola));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
