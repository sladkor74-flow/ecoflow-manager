// UN TERMINATO DI EXTRA RACCOLTA SENZA PESO EFFETTIVO SI DICE, NON SI STIMA
// (chiusura dell'audit, 11/10/2026).
//
// Il fatto. La pagina Extra Raccolta e il blocco del foglio dell'amministrazione
// usavano peso_effettivo || quantita_ritirata: un terminato senza peso effettivo
// si valutava sulla quantita' ritirata. La fattura invece lo scartava in
// silenzio e la passiva lo contava a zero chili. La regola e' un'altra: si
// valuta solo sul peso effettivo, e un valore mancante non e' zero ne' un altro
// numero. Le schede nuove non si chiudono senza peso; restano quelle di prima.
// Adesso pagina e foglio non ripiegano piu', e fattura, pagina e foglio dicono
// la stessa frase (avvisoPesoMancante di ecotyreTariffe.ts). npm run prove
import { readFileSync } from 'node:fs';
import { caricaLibPagine } from './dati/libPagine.mjs';
import { calcolaRigheAttiva } from '../base44/shared/attivaCalcolo.ts';
import { calcolaPassivaMese } from '../base44/shared/passivaCalcolo.ts';
import * as condiviso from '../base44/shared/ecotyreTariffe.ts';
import { calcExtraRaccolta } from '../src/lib/extraRaccoltaCalc.js';

const { bloccoExtraRaccolta } = await caricaLibPagine('lib/extraRaccoltaAmministrazione');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Una scheda vecchia: terminata, con la quantita' ritirata e senza peso effettivo.
const vecchia = {
  id: 'V1', stato: 'terminato', tipo_movimento: 'primaria', id_ordine: 'ER-OLD', numero_fir: 'FIR-OLD',
  produttore: 'COMUNE DI ESEMPIO', trasportatore: 'LOGISTICA & PNEUMATICI SRL', destinazione: 'Irigom S.r.l.', tipo_destinazione: 'imp',
  ordine_immesso_il: '2026-09-01T00:00:00.000Z', trasporto_iniziato_il: '2026-09-10T00:00:00.000Z', trasporto_finito_il: '2026-09-10T00:00:00.000Z',
  cer: '160103', classe: 'P', quantita_ritirata: 3000, peso_effettivo: 0,
  prezzo_attivo_t: 202, sovracosto_raccolta: 50,
  costo_raccolta_t: 90, costo_trattamento_t: 100, costo_trasporto_viaggio: 120,
};
const avviso = typeof condiviso.avvisoPesoMancante === 'function' ? condiviso.avvisoPesoMancante(vecchia) : null;

console.log('LA PAGINA NON PRENDE LA QUANTITA RITIRATA');
{
  const c = calcExtraRaccolta(vecchia);
  verifica('zero tonnellate, non 3', c.tonnellate === 0, String(c.tonnellate));
  verifica('e il peso si dice mancante: senza_peso e kg null, non zero', c.senza_peso === true && c.kg === null, JSON.stringify([c.senza_peso, c.kg]));
  verifica('niente ricavo, come in fattura: non si fattura', c.ricavo === 0 && c.fatturato === false, JSON.stringify([c.ricavo, c.fatturato]));
  verifica('i costi a tonnellata valgono zero, resta il viaggio (come in passiva)', c.costo_totale === 120, String(c.costo_totale));
  const conPeso = calcExtraRaccolta({ ...vecchia, peso_effettivo: 2000 });
  verifica('col peso effettivo si torna a contare tutto, sul peso effettivo', conPeso.tonnellate === 2 && conPeso.kg === 2000 && conPeso.ricavo === 454 && conPeso.costo_totale === 500,
    JSON.stringify([conPeso.tonnellate, conPeso.ricavo, conPeso.costo_totale]));
}

console.log('IL FOGLIO NON LO STIMA, E LO DICE');
{
  const b = bloccoExtraRaccolta([vecchia], 2026, 'Settembre');
  const riga = b.righe[0];
  verifica('la riga resta, senza chili', riga && riga.kg === null && riga.tonnellate === 0 && riga.senza_peso === true, JSON.stringify(riga && [riga.kg, riga.tonnellate]));
  verifica('con la nota che lo dice', riga && /PESO EFFETTIVO MANCANTE/.test(riga.note), riga && riga.note);
  verifica('il totale e quello del modulo: il solo viaggio', riga && riga.totale === 120 && b.totale_euro === 120 && b.totale_kg === 0, JSON.stringify([riga && riga.totale, b.totale_euro, b.totale_kg]));
  verifica('e l intervento si elenca fra quelli senza peso, con la frase comune',
    Array.isArray(b.senza_peso) && b.senza_peso.length === 1 && b.senza_peso[0].avviso === avviso, JSON.stringify(b.senza_peso));
  const senzaData = bloccoExtraRaccolta([{ ...vecchia, trasporto_finito_il: null }], 2026, 'Settembre');
  verifica('anche fra i senza data il peso non si stima', senzaData.senza_data.length === 1 && senzaData.senza_data[0].kg === null, JSON.stringify(senzaData.senza_data));
}

console.log('LA FATTURA NON LO SCARTA PIU IN SILENZIO');
{
  const g = calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll: [vecchia], fornitori: [], tariffe: [], anno: 2026, mese: 'Settembre' });
  verifica('fuori dalla fattura, sovracosti compresi', g.righe.EXTRA_RACCOLTA.length === 0);
  const a = g.anomalie.find(x => x.tipo === 'peso_mancante');
  verifica('ma con un anomalia dell extra raccolta', !!a && a.tipologia === 'EXTRA_RACCOLTA' && a.quanti === 1, JSON.stringify(g.anomalie));
  verifica('che dice la stessa frase della pagina e del foglio', !!a && !!avviso && a.descrizione === avviso, a && a.descrizione);
  verifica('e la frase nomina il formulario e dice che la quantita ritirata non vale',
    !!avviso && avviso.includes('FIR-OLD') && /quantità ritirata/.test(avviso), String(avviso));
  // Una secondaria senza peso non si segnala in fattura: in fattura non entra
  // comunque, il ricavo sta sulla raccolta.
  const sec = calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll: [{ ...vecchia, id: 'S1', tipo_movimento: 'secondaria', stoccaggio: 'NAPPI SUD SRL' }], fornitori: [], tariffe: [], anno: 2026, mese: 'Settembre' });
  verifica('una secondaria senza peso non e un anomalia della fattura', !sec.anomalie.some(x => x.tipo === 'peso_mancante'));
}

// I TRE PEZZI CHE MANCAVANO (chiusura dell'audit, 11/10/2026, revisione dei
// soldi): la passiva non lo diceva, il PDF del foglio scriveva 0 dove i chili
// mancano, e il riepilogo di Ecotyre mostrava l'anomalia in grigio, come
// un'informazione. Il foglio Excel lo prova passivaAmministrazioneExcel.mjs.
console.log('LA PASSIVA LO DICE ANCHE LEI, CON LA STESSA FRASE');
const archivi = { primarieRete: [], primarieAci: [], secondarieAll: [], extraRaccoltaAll: [vecchia], tariffeAll: [], fornitoriAll: [] };
const passiva = calcolaPassivaMese(archivi, 2026, 8, 'Settembre', 'EXTRA_RACCOLTA');
{
  const a = passiva.anomalie.filter(x => x.tipo === 'peso_mancante');
  verifica('una anomalia peso_mancante per il terminato senza peso', a.length === 1, JSON.stringify(passiva.anomalie.map(x => x.tipo || x.prestazione)));
  verifica('con la frase di fattura, pagina e foglio', a[0] && a[0].descrizione === avviso, a[0] && a[0].descrizione);
  verifica('e i numeri non cambiano: si paga il solo viaggio, come la pagina (120)', passiva.totali.totale_complessivo === 120 && calcExtraRaccolta(vecchia).costo_totale === 120, String(passiva.totali.totale_complessivo));
  const conPeso = calcolaPassivaMese({ ...archivi, extraRaccoltaAll: [{ ...vecchia, peso_effettivo: 2000 }] }, 2026, 8, 'Settembre', 'EXTRA_RACCOLTA');
  verifica('col peso effettivo l anomalia non c e', !conPeso.anomalie.some(x => x.tipo === 'peso_mancante'));
  const rete = calcolaPassivaMese({ ...archivi, primarieRete: [] }, 2026, 8, 'Settembre', 'RETE');
  verifica('e sta solo nella passiva dell extra raccolta, non nella rete', !rete.anomalie.some(x => x.tipo === 'peso_mancante'));
}

console.log('IL PDF DEL FOGLIO NON SCRIVE ZERO DOVE I CHILI MANCANO');
{
  const testi = [];
  class FintoPdf {
    constructor() { this.internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } }; }
    text(t) { testi.push(Array.isArray(t) ? t.join(' ') : String(t)); return this; }
    splitTextToSize(t) { return [String(t)]; }
    save() { return this; }
  }
  for (const m of ['addPage', 'line', 'rect', 'roundedRect', 'setDrawColor', 'setFillColor', 'setFont', 'setFontSize', 'setLineWidth', 'setTextColor']) {
    FintoPdf.prototype[m] = function () { return this; };
  }
  globalThis.__JSPDF = { jsPDF: FintoPdf };
  // passivaAmministrazione.js ha i suoi alias: si carica a parte e si passa al PDF.
  const pa = await caricaLibPagine('lib/passivaAmministrazione');
  globalThis.__PA = pa;
  const { esportaPassivaAmministrazionePdf } = await caricaLibPagine('lib/passivaAmministrazionePdf', [
    ["await import('jspdf')", 'globalThis.__JSPDF'],
    ["import { nomeFilePassiva } from '@/lib/passivaAmministrazione';", 'const { nomeFilePassiva } = globalThis.__PA;'],
  ]);
  const { foglioPassiva } = pa;
  const senzaData = { ...vecchia, id: 'V2', numero_fir: 'FIR-SENZADATA', id_ordine: 'ER-SD', trasporto_finito_il: null };
  const blocco = bloccoExtraRaccolta([vecchia, senzaData], 2026, 'Settembre');
  const foglio = foglioPassiva([], passiva, 'EXTRA_RACCOLTA', 'Settembre', 2026, [], blocco);
  let errore = '';
  try { await esportaPassivaAmministrazionePdf([foglio], { anno: 2026, mese: 'Settembre' }); } catch (e) { errore = e.message; }
  verifica('il PDF si costruisce', !errore, errore);
  const tutto = testi.join('\n');
  verifica('nella riga dell intervento il peso e «—», non «0,00»', testi.includes('—'), testi.filter(t => /^0,00$|^—$/.test(t)).join('|'));
  verifica('fra le cose da sistemare c e il terminato senza peso, con la frase della fattura',
    tutto.includes('FIR-OLD') && tutto.includes('terminato senza peso effettivo'), testi.filter(t => /FIR-OLD/.test(t)).join(' | '));
  verifica('e il terminato senza fine trasporto e senza peso dice «— kg», non «0 kg»',
    testi.some(t => /FIR-SENZADATA.*— kg/.test(t)) && !testi.some(t => /FIR-SENZADATA.* 0 kg/.test(t)), testi.filter(t => /FIR-SENZADATA/.test(t)).join(' | '));
}

console.log('IL RIEPILOGO ECOTYRE LO MOSTRA DA GUARDARE, NON COME INFORMAZIONE');
{
  const src = readFileSync(new URL('../src/components/fatturazione/RiepilogoEcotyre.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  const elenco = /const DA_GUARDARE = \[([^\]]*)\]/.exec(src);
  verifica('peso_mancante e fra le anomalie da guardare (ambra)', !!elenco && /'peso_mancante'/.test(elenco[1]) && /DA_GUARDARE\.includes\(a\.tipo\)/.test(src), elenco ? elenco[1] : 'manca l elenco');
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
