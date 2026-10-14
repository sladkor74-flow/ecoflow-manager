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
//    Dalla decisione del 13/10/2026 e' un errore: la riga e' a zero euro, il
//    documento ACI non si verifica finche' la provincia non si corregge, e
//    l'anteprima lo mette in rosso, a parte, non fra gli avvisi in ambra.
// npm run prove
import * as attivaCalcolo from '../base44/shared/attivaCalcolo.ts';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';
import { caricaPagina, clienteFinto, aspetta, trova, testo } from './dati/paginaFinta.mjs';
import { resolveTariffa, sortTariffe } from '../base44/shared/ecotyreTariffe.ts';
import { resolveTariffa as resolvePagina, sortTariffe as sortPagina } from '../src/lib/ecotyreTariffe.js';
import { formulariDoppi } from '../base44/shared/formulari.ts';
import { readFileSync } from 'node:fs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = JSON.stringify;
const { calcolaRigheAttiva } = attivaCalcolo;
const NOTA_ACI_SENZA_REGIONE = attivaCalcolo.NOTA_ACI_SENZA_REGIONE || '';
const cambiaStato = await caricaFunzione('cambiaStatoFatturazione');

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
  // SENZA REGIONE NE' PROVINCIA E' UN ERRORE (decisione del 13/10/2026). Prima
  // la riga prendeva la tariffa generica (230 €/t), era «verificata» e l'avviso
  // usciva in ambra: il documento si verificava con un prezzo che poteva non
  // essere il suo. Ora la riga e' a zero euro, in errore, e il documento non si
  // verifica finche' la provincia non si corregge.
  const aci = [
    { ...base, id: 'w1', id_ordine: 'ET5', numero_fir: 'F5', peso_effettivo: 2000, provincia: '', regione: '' },
    { ...base, id: 'w2', id_ordine: 'ET6', numero_fir: 'F6', peso_effettivo: 1500, provincia: 'ZZ' },
    { ...base, id: 'w3', id_ordine: 'ET7', numero_fir: 'F7', peso_effettivo: 1000, provincia: 'BA' },
  ];
  const { righe, anomalie } = calcola(aci);
  const a = anomalie.filter(x => x.tipo === 'regione_mancante');
  verifica('un ACI senza regione ne\' provincia si segnala, una voce per il canale', a.length === 1 && a[0].tipologia === 'ACI' && a[0].quanti === 2 && a[0].tonnellate === 3.5, J(a));
  verifica('ed e\' un errore, non un avviso', a[0]?.gravita === 'errore', J(a[0]));
  verifica('la frase dice i ritiri, lo zero e che il documento non si verifica', /2 ritiri del mese senza provincia né regione \(ET5, ET6\)/.test(a[0]?.descrizione || '')
    && /questi ritiri restano a zero euro, in errore/.test(a[0]?.descrizione || '') && /Il documento ACI non si verifica finché non correggi la provincia nel caricamento\./.test(a[0]?.descrizione || '')
    && !/preso la tariffa ACI senza regione/.test(a[0]?.descrizione || ''), a[0]?.descrizione);
  const senza = righe.ACI.filter(r => ['ET5', 'ET6'].includes(r.ordine));
  verifica('le due righe restano nel mese, coi loro chili', senza.length === 2 && senza.reduce((s, r) => s + r.quantita, 0) === 3500, J(senza.map(r => r.quantita)));
  verifica('ma non prendono la tariffa generica: zero euro, nessuna tariffa, in errore', senza.every(r => r.totale === 0 && r.tariffa_valore === 0 && r.tariffa_id === '' && r.stato_validazione === 'errore'),
    J(senza.map(r => [r.tariffa_id, r.tariffa_valore, r.totale, r.stato_validazione])));
  verifica('e la nota della riga dice perche\'', senza.every(r => r.note === NOTA_ACI_SENZA_REGIONE) && /senza provincia né regione/.test(NOTA_ACI_SENZA_REGIONE), J(senza.map(r => r.note)));
  const ba = righe.ACI.find(r => r.ordine === 'ET7');
  verifica('il ritiro con la provincia resta verificato, al prezzo della Puglia', ba && ba.stato_validazione === 'verificato' && ba.tariffa_id === 't-aci-pug' && ba.totale === 240, J(ba));
  verifica('nessuna voce «senza tariffa»: quello che manca e\' la provincia, non la tariffa', !anomalie.some(x => x.tipo === 'senza_tariffa'), J(anomalie.map(x => x.tipo)));
  // senza tariffa generica e' lo stesso: e la voce «senza tariffa» non c'e' neanche qui
  const soloRegionali = tariffe.filter(t => t.id !== 't-aci-gen');
  const b = calcola(aci, [], [], soloRegionali);
  verifica('senza tariffa generica: le stesse righe in errore, e nessuna voce «senza tariffa»', b.anomalie.some(x => x.tipo === 'regione_mancante' && x.gravita === 'errore')
    && !b.anomalie.some(x => x.tipo === 'senza_tariffa') && b.righe.ACI.filter(r => r.stato_validazione === 'errore').length === 2, J(b.anomalie.map(x => x.descrizione)));
  // un ritiro solo: la frase al singolare
  const uno = calcola([aci[0]]).anomalie.find(x => x.tipo === 'regione_mancante') || {};
  verifica('un ritiro solo: «il ritiro resta a zero euro»', /ACI: un ritiro del mese senza provincia né regione \(ET5\)/.test(uno.descrizione || '') && /il ritiro resta a zero euro, in errore/.test(uno.descrizione || ''), uno.descrizione);
  // il surplus non dipende dalla regione: i chili della riga in errore li conta come prima
  const fuel = [{ id: 's-fuel', gruppo: 'g-fs', nome: 'Fuel Surcharge', origine: 'CONSORZIO', tipologia: 'ACI', prestazione: 'RACCOLTA', a_chi: 'tutti', euro_t_attiva: 5, euro_t_passiva: 5, data_inizio_validita: '2026-07-01', data_fine_validita: '2026-12-31', stato: 'attivo' }];
  const conSurplus = calcolaRigheAttiva({ reteAll: [], aciAll: aci, extraAll: [], fornitori: [], tariffe, anno: 2026, mese: 'Luglio', surplus: fuel });
  const s = conSurplus.surplus_del_mese.ACI[0];
  verifica('il surplus conta anche i chili dei ritiri in errore (4,50 t)', s && s.kg === 4500 && s.totale === 22.5, J(conSurplus.surplus_del_mese));
}
{
  // IL DOCUMENTO NON SI VERIFICA: cambiaStatoFatturazione, la funzione vera, con
  // le righe che il calcolo salverebbe. Con una riga ACI senza provincia il
  // documento resta «elaborata»; corretta la provincia, si verifica.
  const statoDopoVerifica = async (aciAll) => {
    const { righe } = calcolaRigheAttiva({ reteAll: [], aciAll, extraAll: [], fornitori: [], tariffe, anno: 2026, mese: 'Luglio' });
    const voci = righe.ACI.map((r, k) => ({ ...r, id: `v${k}`, documento_id: 'doc-aci' }));
    const { j } = await chiama(cambiaStato, { db: { DocumentoFatturazione: [{ id: 'doc-aci', tipo: 'ATTIVA', tipologia: 'ACI', anno: 2026, mese: 'Luglio', stato: 'elaborata' }], VoceFatturazione: voci }, corpo: { documento_id: 'doc-aci', azione: 'verifica' } });
    return j;
  };
  const senzaProvincia = await statoDopoVerifica([{ ...base, id: 'q1', id_ordine: 'ET8', numero_fir: 'F8', peso_effettivo: 2000, provincia: '', regione: '' }, { ...base, id: 'q2', id_ordine: 'ET9', numero_fir: 'F9', peso_effettivo: 1000, provincia: 'BA' }]);
  verifica('con un ACI senza provincia il documento resta «elaborata», con una riga in errore', senzaProvincia.stato === 'elaborata' && senzaProvincia.errori === 1, J(senzaProvincia));
  const corretto = await statoDopoVerifica([{ ...base, id: 'q1', id_ordine: 'ET8', numero_fir: 'F8', peso_effettivo: 2000, provincia: 'NA' }, { ...base, id: 'q2', id_ordine: 'ET9', numero_fir: 'F9', peso_effettivo: 1000, provincia: 'BA' }]);
  verifica('corretta la provincia, il documento si verifica', corretto.stato === 'verificata' && corretto.errori === 0, J(corretto));
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

console.log('3. NELL\'ANTEPRIMA: L\'ERRORE IN ROSSO E A PARTE, IL FORMULARIO RIPETUTO IN AMBRA');
{
  // RiepilogoEcotyre.jsx: le anomalie fuori da DA_GUARDARE escono in grigio, come
  // un'informazione. Il formulario ripetuto e' da decidere: ambra (revisione del
  // 13/10/2026). L'ACI senza regione ne' provincia, dalla decisione del
  // 13/10/2026, e' un errore: sta nel riquadro rosso di quello che tiene fermo il
  // documento, non fra gli avvisi. La pagina gira davvero (paginaFinta), con le
  // anomalie che il calcolo vero produce.
  const src = readFileSync(new URL('../src/components/fatturazione/RiepilogoEcotyre.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  const elenco = /const DA_GUARDARE = \[([^\]]*)\]/.exec(src);
  verifica('formulario_ripetuto e\' fra le anomalie da guardare (ambra)', !!elenco && elenco[1].includes("'formulario_ripetuto'") && /DA_GUARDARE\.includes\(a\.tipo\)/.test(src), elenco ? elenco[1] : 'manca l\'elenco');
  verifica('regione_mancante non e\' piu\' un avviso in ambra', !!elenco && !elenco[1].includes("'regione_mancante'"), elenco ? elenco[1] : '');

  const { anomalie } = calcola([
    { ...base, id: 'p1', id_ordine: 'ET5', numero_fir: 'F5', peso_effettivo: 2000, provincia: '', regione: '' },
    { ...base, id: 'p2', id_ordine: 'ET26091175', numero_fir: 'RGYTR022620TW', peso_effettivo: 1960, provincia: 'BA' },
    { ...base, id: 'p3', id_ordine: 'ET26091175', numero_fir: 'RGYTR022620TW', peso_effettivo: 1960, provincia: 'BA' },
  ]);
  const p = await caricaPagina('components/fatturazione/RiepilogoEcotyre');
  const cl = clienteFinto({ funzioni: { getRiepilogoEcotyre: async () => ({ periodo: { anno: 2026, mese: 'Luglio' }, anomalie, tipologie: [] }) } });
  globalThis.__CLIENTE_FINTO = cl.cliente;
  const r = p.monta(p.Componente, { periodo: { anno: 2026, mese: 'Luglio' } });
  await aspetta(60);
  const rossi = trova(r.albero, el => el.type === 'div' && /border-destructive\/40/.test(el.props.className || ''));
  const daCorreggere = rossi.find(el => /Da correggere/.test(testo(el)));
  const regione = anomalie.find(a => a.tipo === 'regione_mancante');
  const ripetuto = anomalie.find(a => a.tipo === 'formulario_ripetuto');
  verifica('la pagina si monta senza errori', r.errori.length === 0, String(r.errori[0] || ''));
  verifica('l\'ACI senza provincia sta nel riquadro rosso «Da correggere», col suo testo', !!daCorreggere && testo(daCorreggere).includes(regione.descrizione)
    && /il documento del canale non si verifica finché restano/.test(testo(daCorreggere)), daCorreggere ? testo(daCorreggere) : J(rossi.map(testo)));
  const ambra = trova(r.albero, el => el.type === 'div' && /text-amber-800/.test(el.props.className || ''));
  verifica('e non fra gli avvisi in ambra', !ambra.some(el => testo(el).includes(regione.descrizione)), J(ambra.map(testo)));
  verifica('il formulario ripetuto resta in ambra, fuori dal rosso', ambra.some(el => testo(el).includes(ripetuto.descrizione)) && !testo(daCorreggere || '').includes(ripetuto.descrizione), J(ambra.map(testo)));
  r.smonta();
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
