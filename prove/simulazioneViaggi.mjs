// La simulazione dei viaggi della predittivita' (base44/shared/simulazioneViaggi.ts),
// su una risposta costruita a mano: Nappi Sud alimenta Tecnogum (priorita') e
// Irigom, 12 settimane alla fine, 13 t a viaggio, materiale per 36 viaggi.
import { simulaViaggi, percorsiDaSimulare, scelteDellaProposta, scelteDelProgramma, scelteAlmenoUno, chiavePercorso } from '../base44/shared/simulazioneViaggi.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = JSON.stringify;

const orizzonte = { dal: '2026-09-26', al: '2026-12-18', giorni: 84, settimane: 12 };
const risposta = {
  kg_per_viaggio: 13000, sola_lettura: false,
  impianti: [
    { chiave: 'tecnogum', nome: 'Tecnogum', target_kg: 2295000, gia_arrivato_kg: 1758000, residuo_kg: 537000, fine: '2026-12-18', orizzonte,
      primaria_attesa: { target: 129000, ritmo: 231000 },
      da_stoccaggi: [{ stoccaggio: 'nappi sud', nome: 'Nappi Sud', viaggi_settimana: { target: 2.6, ritmo: 2 } }] },
    { chiave: 'irigom', nome: 'Irigom', target_kg: 4445000, gia_arrivato_kg: 3162000, residuo_kg: 1283000, fine: '2026-12-18', orizzonte,
      primaria_attesa: { target: 848000, ritmo: 848000 },
      da_stoccaggi: [{ stoccaggio: 'nappi sud', nome: 'Nappi Sud', viaggi_settimana: { target: 0.3, ritmo: 0.9 } }] },
  ],
  stoccaggi: [{ chiave: 'nappi sud', nome: 'Nappi Sud', disponibile: { target: 468000, ritmo: 468000 }, viaggi_prossima_settimana: { possibili: 3, programmati: 3 } }],
  programma: [
    { stoccaggio: 'Nappi Sud', impianto: 'Tecnogum', chiave_impianto: 'tecnogum', viaggi: 3, fissato: null },
    { stoccaggio: 'Nappi Sud', impianto: 'Irigom', chiave_impianto: 'irigom', viaggi: 0, fissato: null },
  ],
};
const T = chiavePercorso('Nappi Sud', 'tecnogum'), I = chiavePercorso('Nappi Sud', 'irigom');

console.log('I PERCORSI E LE SCELTE PRONTE');
verifica('i percorsi del programma, con la media e i programmati', J(percorsiDaSimulare(risposta).map(p => [p.chiave, p.media, p.programmati])) === J([[T, 2.6, 3], [I, 0.3, 0]]));
verifica('la proposta: la media a un decimale', J(scelteDellaProposta(risposta)) === J({ [T]: 2.6, [I]: 0.3 }));
verifica('il programma ripetuto', J(scelteDelProgramma(risposta)) === J({ [T]: 3, [I]: 0 }));
verifica('almeno uno a Irigom, tolto a Tecnogum per restare nei 3 possibili', J(scelteAlmenoUno(risposta)) === J({ [T]: 2, [I]: 1 }));
const corretto = { ...risposta, programma: risposta.programma.map(r => r.impianto === 'Irigom' ? { ...r, fissato: { viaggi: 2 } } : r) };
verifica('vale il programma fissato, se c\'e\'', scelteDelProgramma(corretto)[I] === 2);

console.log('COSA SUCCEDE');
// 2 + 1: Tecnogum riceve 24 viaggi = 312 t, sul target 129 + 312 = 441 < 537: mancano 96 t;
// al ritmo 231 + 312 = 543: raggiunge. Irigom 12 viaggi = 156 t: 848 + 156 = 1.004, mancano 279 t.
const s21 = simulaViaggi(risposta, { [T]: 2, [I]: 1 });
const tg = s21.impianti.find(i => i.chiave === 'tecnogum'), ir = s21.impianti.find(i => i.chiave === 'irigom');
verifica('Tecnogum sul target: mancano 96 t', tg.scenari.target.differenza_kg === -96000 && tg.scenari.target.raggiunge === false && tg.scenari.target.quando === null, J(tg.scenari.target));
verifica('Tecnogum al ritmo: ci arriva, con la data', tg.scenari.ritmo.differenza_kg === 6000 && tg.scenari.ritmo.raggiunge === true && tg.scenari.ritmo.quando > '2026-12-01' && tg.scenari.ritmo.quando <= '2026-12-18', J(tg.scenari.ritmo));
verifica('Irigom: mancano 279 t', ir.scenari.target.differenza_kg === -279000 && ir.secondarie_kg === 156000 && ir.viaggi_totali === 12, J(ir));
verifica('Nappi Sud ce la fa: 36 viaggi', s21.stoccaggi[0].basta === true && s21.stoccaggi[0].viaggi_chiesti === 36 && s21.stoccaggi[0].avanza_kg === 0, J(s21.stoccaggi));

// 3 + 1: 48 viaggi chiesti, 36 possibili: si dividono in proporzione (3/4)
const s31 = simulaViaggi(risposta, { [T]: 3, [I]: 1 });
verifica('troppi viaggi: lo dice, e divide in proporzione', s31.stoccaggi[0].basta === false && s31.stoccaggi[0].mancano_kg === 156000 && s31.impianti[0].limitato === true && Math.abs(s31.impianti[0].viaggi_settimana - 2.25) < 1e-9 && Math.abs(s31.impianti[1].viaggi_settimana - 0.75) < 1e-9, J(s31));
verifica('mezzo viaggio di troppo e\' un arrotondamento', simulaViaggi(risposta, { [T]: 2.6, [I]: 0.4 }).stoccaggi[0].basta === true);
verifica('numeri non validi valgono zero', simulaViaggi(risposta, { [T]: -2, [I]: 'x' }).impianti.every(i => i.viaggi_settimana === 0));

const fatto = { ...risposta, impianti: risposta.impianti.map(i => i.chiave === 'tecnogum' ? { ...i, residuo_kg: -5000 } : i) };
verifica('target gia\' superato', simulaViaggi(fatto, { [T]: 0 }).impianti[0].scenari.target.quando === 'gia');
const finito = { ...risposta, impianti: risposta.impianti.map(i => ({ ...i, orizzonte: { ...orizzonte, giorni: 0, settimane: 0 } })) };
verifica('programmazione finita: nessun viaggio conta', simulaViaggi(finito, { [T]: 5, [I]: 5 }).impianti.every(i => i.secondarie_kg === 0));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
