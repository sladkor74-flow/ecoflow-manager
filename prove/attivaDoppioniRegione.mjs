// LA FATTURAZIONE ATTIVA: IL FORMULARIO RIPETUTO E LA REGIONE DEL PREZZO ACI
// (segnalazioni alte del 20/09, corrette il 12/10/2026).
//
// 1. Il formulario ripetuto sullo STESSO ordine (A85). calcolaRigheAttiva faceva
//    una riga di ricavo per ogni record e non guardava i doppioni: lo stesso FIR
//    due volte su ET26091175 dava due righe ACI, 940,80 euro, e nessun avviso,
//    mentre la passiva lo segnala («FORMULARIO RIPETUTO»). Ora l'attiva usa la
//    stessa regola (formulariDoppi di formulari.ts) e lo dice, senza togliere la
//    riga: il ricavo lo decide l'amministrazione. Lo stesso formulario su due
//    ordini e' invece la ripartizione dell'ACI, e non e' un doppione.
// 2. La regione del prezzo ACI (A80). La tariffa si cercava con r.regione a
//    uguaglianza esatta: un ritiro senza provincia con «PUGLIA» scritto nel file
//    prendeva la tariffa generica, 230 euro invece di 240, senza un avviso. Ora
//    la regione e' quella di regioneDi (la regola unica dell'11/10/2026), il
//    confronto e' senza maiuscole, e un ACI senza regione ne' provincia si dice.
// npm run prove
import { calcolaRigheAttiva } from '../base44/shared/attivaCalcolo.ts';
import { resolveTariffa, sortTariffe } from '../base44/shared/ecotyreTariffe.ts';
import { resolveTariffa as resolvePagina, sortTariffe as sortPagina } from '../src/lib/ecotyreTariffe.js';
import { formulariDoppi } from '../base44/shared/formulari.ts';
import { readFileSync } from 'node:fs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = JSON.stringify;

const tariffe = [
  { id: 't-rete', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01' },
  { id: 't-aci-gen', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', valore: 230, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01' },
  { id: 't-aci-pug', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: 'Puglia', valore: 240, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01' },
];
const base = { stato: 'terminato', cer: '160103', classe: 'A', ordine_immesso_il: '2026-07-01T08:00:00Z', trasporto_iniziato_il: '2026-07-09T00:00:00Z', trasporto_finito_il: '2026-07-09T00:00:00Z' };
const calcola = (aciAll, reteAll = [], extraAll = [], t = tariffe) => calcolaRigheAttiva({ reteAll, aciAll, extraAll, fornitori: [], tariffe: t, anno: 2026, mese: 'Luglio' });

console.log('1. IL FORMULARIO RIPETUTO SULLO STESSO ORDINE');
{
  const aci = [
    { ...base, id: 'x1', id_ordine: 'ET26091175', numero_fir: 'RGYTR022620TW', numero_ordine_interno: '162684-15', peso_effettivo: 1960, provincia: 'BA', regione: 'Puglia' },
    { ...base, id: 'x2', id_ordine: 'ET26091175', numero_fir: 'rgytr022620tw ', numero_ordine_interno: '162684-15', peso_effettivo: 1960, provincia: 'BA', regione: 'Puglia' },
  ];
  const { righe, anomalie } = calcola(aci);
  const doppie = righe.ACI.filter(r => r.ordine === 'ET26091175');
  verifica('le due righe restano: il ricavo lo decide l\'amministrazione', doppie.length === 2 && Math.round(doppie.reduce((s, r) => s + r.totale, 0) * 100) === 94080, J(doppie.map(r => r.totale)));
  const a = anomalie.filter(x => x.tipo === 'formulario_ripetuto');
  verifica('e il formulario ripetuto si dice, una volta', a.length === 1, J(anomalie.map(x => x.tipo)));
  const x = a[0] || {};
  verifica('con il canale, quante volte, le tonnellate e gli ordini', x.tipologia === 'ACI' && x.quanti === 2 && x.tonnellate === 3.92 && J(x.ordini) === J([{ ordine: 'ET26091175', numero_fir: 'RGYTR022620TW' }, { ordine: 'ET26091175', numero_fir: 'rgytr022620tw ' }]), J(x));
  verifica('la frase dice formulario, ordine, pesi ed euro all\'italiana', /Formulario RGYTR022620TW presente 2 volte sullo stesso ordine ET26091175 \(1\.960 kg \+ 1\.960 kg\)/.test(x.descrizione || '') && /940,80 €/.test(x.descrizione || '') && /quale tenere lo decide l'amministrazione/.test(x.descrizione || ''), x.descrizione);
  verifica('la regola e\' quella della passiva (formulariDoppi)', formulariDoppi(aci).length === 1);
}
{
  // La ripartizione dell'ACI: il 9 giugno 2026 RGYTR022620TW sta su ET26091175 e su
  // ET26102183, due ticket. Non e' un doppione.
  const aci = [
    { ...base, id: 'y1', id_ordine: 'ET26091175', numero_fir: 'RGYTR022620TW', numero_ordine_interno: '162684-15', peso_effettivo: 1960, provincia: 'BA' },
    { ...base, id: 'y2', id_ordine: 'ET26102183', numero_fir: 'RGYTR022620TW', numero_ordine_interno: '163142-85', peso_effettivo: 1500, provincia: 'BA' },
  ];
  const { righe, anomalie } = calcola(aci);
  verifica('lo stesso formulario su due ordini e\' la ripartizione: due righe, nessun avviso', righe.ACI.length === 2 && !anomalie.some(a => a.tipo === 'formulario_ripetuto'), J(anomalie));
}
{
  // Un canale per volta: lo stesso numero su rete e su ACI non e' un doppione
  // dell'attiva (i canali non si mescolano); sulla rete il doppione si dice.
  const rete = [
    { ...base, id: 'r1', id_ordine: 'ET1', numero_fir: 'F1', peso_effettivo: 1000, provincia: 'NA' },
    { ...base, id: 'r2', id_ordine: 'ET1', numero_fir: 'F1', peso_effettivo: 1000, provincia: 'NA' },
    { ...base, id: 'r3', id_ordine: 'ET3', numero_fir: 'F3', peso_effettivo: 500, provincia: 'NA' },
  ];
  const aci = [{ ...base, id: 'a3', id_ordine: 'ET3', numero_fir: 'F3', peso_effettivo: 2000, provincia: 'NA' }];
  const { righe, anomalie } = calcola(aci, rete);
  const a = anomalie.filter(x => x.tipo === 'formulario_ripetuto');
  verifica('sulla rete il doppione si dice, e i canali non si mescolano', a.length === 1 && a[0].tipologia === 'RETE' && a[0].quanti === 2 && /404,00 €/.test(a[0].descrizione), J(a));
  verifica('e il ricavo della rete resta quello delle tre righe', Math.round(righe.RETE.reduce((s, r) => s + r.totale, 0) * 100) === 50500, J(righe.RETE.map(r => r.totale)));
  // le righe di un altro mese non c'entrano
  const agosto = [{ ...rete[0], id: 'r9', trasporto_finito_il: '2026-08-02T00:00:00Z' }];
  verifica('un formulario uguale in un altro mese non fa doppione nel mese', !calcola([], [rete[0], ...agosto]).anomalie.some(x => x.tipo === 'formulario_ripetuto'));
}
{
  // QUANTE VOLTE CONTA DAVVERO (revisione del 13/10/2026): una copia senza peso
  // effettivo non fa riga di ricavo, e la frase non la deve contare. Il caso
  // della revisione: 1.960 kg + 0 kg diceva «conta 2 volte» su una riga sola.
  const copia = { ...base, id_ordine: 'ET26091175', numero_fir: 'RGYTR022620TW', provincia: 'BA' };
  {
    const { righe, anomalie } = calcola([{ ...copia, id: 'z1', peso_effettivo: 1960 }, { ...copia, id: 'z2', peso_effettivo: 0 }]);
    const a = anomalie.find(x => x.tipo === 'formulario_ripetuto') || {};
    verifica('1.960 kg + 0 kg: in fattura una riga, 470,40 €', righe.ACI.length === 1 && Math.round(righe.ACI[0].totale * 100) === 47040, J(righe.ACI.map(r => r.totale)));
    verifica('e l\'avviso c\'e\', con le copie dell\'archivio (2) e quelle in fattura (1)', a.quanti === 2 && a.in_fattura === 1, J(a));
    verifica('la frase dice «conta una volta» e non «conta 2 volte»', /conta una volta \(470,40 €\): la copia senza peso effettivo non si fattura\./.test(a.descrizione || '') && !/conta 2 volte/.test(a.descrizione || ''), a.descrizione);
    verifica('e dice ancora formulario, ordine e pesi', /Formulario RGYTR022620TW presente 2 volte sullo stesso ordine ET26091175 \(1\.960 kg \+ 0 kg\)/.test(a.descrizione || ''), a.descrizione);
  }
  {
    // tre copie, due col peso: conta 2 volte, e una copia non si fattura
    const { righe, anomalie } = calcola([{ ...copia, id: 'z1', peso_effettivo: 1960 }, { ...copia, id: 'z2', peso_effettivo: 1960 }, { ...copia, id: 'z3', peso_effettivo: 0 }]);
    const a = anomalie.find(x => x.tipo === 'formulario_ripetuto') || {};
    verifica('tre copie, due col peso: «conta 2 volte (940,80 € in tutto)», una non si fattura', righe.ACI.length === 2 && a.quanti === 3 && a.in_fattura === 2 && /conta 2 volte \(940,80 € in tutto\): la copia senza peso effettivo non si fattura\./.test(a.descrizione || ''), a.descrizione);
  }
  {
    // nessuna copia col peso: in fattura non entra, e la frase lo dice
    const { righe, anomalie } = calcola([], [{ ...copia, id: 'w1', peso_effettivo: 0, provincia: 'NA' }, { ...copia, id: 'w2', peso_effettivo: null, provincia: 'NA' }]);
    const a = anomalie.find(x => x.tipo === 'formulario_ripetuto') || {};
    verifica('nessuna copia col peso: nessuna riga e «non entra»', righe.RETE.length === 0 && a.in_fattura === 0 && /nella fattura a Ecotyre non entra, perché nessuna copia ha il peso effettivo\./.test(a.descrizione || '') && !/conta/.test(a.descrizione || ''), a.descrizione);
    verifica('un peso che manca si scrive «—», non «0 kg»', /\(0 kg \+ —\)/.test(a.descrizione || ''), a.descrizione);
  }
  {
    // le due copie col peso: la frase di prima, invariata
    const { anomalie } = calcola([{ ...copia, id: 'z1', peso_effettivo: 1960 }, { ...copia, id: 'z2', peso_effettivo: 1960 }]);
    const a = anomalie.find(x => x.tipo === 'formulario_ripetuto') || {};
    verifica('due copie col peso: «conta 2 volte (940,80 € in tutto)», senza note sulle copie', a.in_fattura === 2 && /conta 2 volte \(940,80 € in tutto\)\. Le righe restano/.test(a.descrizione || ''), a.descrizione);
  }
}

console.log('2. LA REGIONE DEL PREZZO ACI');
{
  const aci = [
    // provincia mancante: resta la regione del file, scritta in maiuscolo
    { ...base, id: 'z1', id_ordine: 'ET26099999', numero_fir: 'RGYTR099999AA', peso_effettivo: 3000, provincia: '', regione: 'PUGLIA' },
    // la provincia vince sul campo del file
    { ...base, id: 'z2', id_ordine: 'ET26099998', numero_fir: 'RGYTR099998AA', peso_effettivo: 1000, provincia: 'BA', regione: 'Campania' },
  ];
  const { righe, anomalie } = calcola(aci);
  const z1 = righe.ACI.find(r => r.ordine === 'ET26099999');
  const z2 = righe.ACI.find(r => r.ordine === 'ET26099998');
  verifica('«PUGLIA» senza provincia prende la tariffa della Puglia, 240 €/t', z1.tariffa_valore === 240 && z1.tariffa_id === 't-aci-pug' && z1.totale === 720, J(z1));
  verifica('e la riga porta il nome della regione, come le altre', z1.regione === 'Puglia', z1.regione);
  verifica('la provincia BA vale piu\' del campo del file: Puglia, 240', z2.regione === 'Puglia' && z2.tariffa_valore === 240, J(z2));
  verifica('nessun avviso di regione: la regione c\'e\'', !anomalie.some(a => a.tipo === 'regione_mancante'), J(anomalie));
}
{
  // senza regione ne' provincia: con la tariffa generica passa, ma si dice
  const aci = [
    { ...base, id: 'w1', id_ordine: 'ET5', numero_fir: 'F5', peso_effettivo: 2000, provincia: '', regione: '' },
    { ...base, id: 'w2', id_ordine: 'ET6', numero_fir: 'F6', peso_effettivo: 1500, provincia: 'ZZ' },
  ];
  const { righe, anomalie } = calcola(aci);
  const a = anomalie.filter(x => x.tipo === 'regione_mancante');
  verifica('un ACI senza regione ne\' provincia si segnala, una voce per il canale', a.length === 1 && a[0].tipologia === 'ACI' && a[0].quanti === 2 && a[0].tonnellate === 3.5, J(a));
  verifica('e dice che ha preso la tariffa senza regione', /2 ritiri del mese senza provincia né regione \(ET5, ET6\)/.test(a[0]?.descrizione || '') && /preso la tariffa ACI senza regione/.test(a[0]?.descrizione || ''), a[0]?.descrizione);
  verifica('la riga resta, al prezzo generico (lo decide l\'amministrazione)', righe.ACI.length === 2 && righe.ACI.every(r => r.tariffa_valore === 230), J(righe.ACI.map(r => r.tariffa_valore)));
  // senza tariffa generica la riga e' a zero e si dice anche questo
  const soloRegionali = tariffe.filter(t => t.id !== 't-aci-gen');
  const b = calcola(aci, [], [], soloRegionali).anomalie;
  verifica('senza tariffa generica: a zero euro, e l\'avviso lo dice', b.some(x => x.tipo === 'regione_mancante' && /sono rimasti senza prezzo/.test(x.descrizione)) && b.some(x => x.tipo === 'senza_tariffa'), J(b.map(x => x.descrizione)));
}
{
  // il confronto della regione, in tutti e due gli specchi
  for (const [nome, sort, resolve] of [['funzioni', sortTariffe, resolveTariffa], ['pagine', sortPagina, resolvePagina]]) {
    const t = sort([...tariffe, { id: 't-aci-maiu', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: ' CALABRIA ', valore: 231, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01' }]);
    verifica(`${nome}: la regione si confronta senza maiuscole`, resolve(t, 'ACI', 'A', 'puglia', '160103', '2026-07-09', '')?.id === 't-aci-pug');
    verifica(`${nome}: e senza spazi in piu' nella tariffa`, resolve(t, 'ACI', 'A', 'Calabria', '160103', '2026-07-09', '')?.id === 't-aci-maiu');
    verifica(`${nome}: un'altra regione resta un'altra regione`, resolve(t, 'ACI', 'A', 'Sicilia', '160103', '2026-07-09', '')?.id === 't-aci-gen');
    const aosta = sort([...tariffe, { id: 't-ao', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: "Valle  d'Aosta", valore: 250, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01' }]);
    verifica(`${nome}: due spazi dentro il nome valgono uno`, resolve(aosta, 'ACI', 'A', "VALLE D'AOSTA", '160103', '2026-07-09', '')?.id === 't-ao');
    verifica(`${nome}: e le lettere restano lettere (Basilicata non e' «Ba ilicata»)`, resolve(sort([...tariffe, { id: 't-bas', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: 'Basilicata', valore: 230, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01' }]), 'ACI', 'A', 'Ba ilicata', '160103', '2026-07-09', '')?.id === 't-aci-gen');
  }
}

console.log('3. NELL\'ANTEPRIMA DELLA FATTURA ESCONO IN AMBRA');
{
  // RiepilogoEcotyre.jsx: le anomalie fuori da DA_GUARDARE escono in grigio, come
  // un'informazione. Il formulario ripetuto e l'ACI senza regione sono da
  // decidere o da correggere (revisione del 13/10/2026).
  const src = readFileSync(new URL('../src/components/fatturazione/RiepilogoEcotyre.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  const elenco = /const DA_GUARDARE = \[([^\]]*)\]/.exec(src);
  for (const tipo of ['formulario_ripetuto', 'regione_mancante']) {
    verifica(`${tipo} e' fra le anomalie da guardare (ambra)`, !!elenco && elenco[1].includes(`'${tipo}'`) && /DA_GUARDARE\.includes\(a\.tipo\)/.test(src), elenco ? elenco[1] : 'manca l\'elenco');
  }
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
