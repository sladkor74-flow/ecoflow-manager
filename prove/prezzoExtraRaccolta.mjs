// IL PREZZO ATTIVO DELL'EXTRA RACCOLTA E' UNO SOLO: FATTURA, PAGINA, SCHEDA
// (chiusura dell'audit, 11/10/2026).
//
// Il fatto. Su un intervento senza prezzo scritto la fattura applicava tre
// gradini - il prezzo scritto, la Tariffa ATTIVA EXTRA_RACCOLTA valida, la base
// dell'anno - e la pagina Extra Raccolta, la scheda e il blocco del foglio solo
// due: il prezzo scritto e una copia della base dei 202 euro, che esiste solo per
// il 2026. La tariffa dell'extra raccolta resta aperta per scelta, quindi:
//   - nel 2027 la fattura diceva 202 €/t con l'avviso «prezzo del 2026» e la
//     pagina 0 €/t, con la scheda che chiedeva di scrivere un prezzo;
//   - nel 2026, con la tabella a 210, la fattura 525,00 e la pagina 505,00 sullo
//     stesso intervento da 2,5 t.
// Adesso il prezzo lo sceglie prezzoAttivoExtra di ecotyreTariffe.ts, che ha lo
// specchio src/lib/ecotyreTariffe.js, e la pagina lo usa con le tariffe che legge
// una volta. Qui si confrontano i due lati sugli stessi interventi. npm run prove
import { readFileSync } from 'node:fs';
import { calcolaRigheAttiva } from '../base44/shared/attivaCalcolo.ts';
import * as pagina from '../src/lib/extraRaccoltaCalc.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');

// Senza la funzione nuova la pagina non sa leggere le tariffe: la prova lo dice
// invece di cadere.
const contestoPrezzi = pagina.contestoPrezzi || (() => undefined);
const ricavoPagina = (r, tariffe = [], fornitori = []) => pagina.calcExtraRaccolta(r, contestoPrezzi(tariffe, fornitori));
const ricavoFattura = (r, tariffe, anno, mese, fornitori = []) => {
  const g = calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll: [r], fornitori, tariffe, anno, mese });
  const righe = g.righe.EXTRA_RACCOLTA;
  return { totale: Math.round(righe.reduce((s, x) => s + x.totale, 0) * 100) / 100, righe, anomalie: g.anomalie };
};

// L'intervento di soldi1: 2.500 kg, nessun prezzo scritto.
const intervento = (giorno, o = {}) => ({
  id: 'E' + giorno, stato: 'terminato', id_ordine: 'E' + giorno, numero_fir: 'FE' + giorno, tipo_movimento: 'primaria',
  peso_effettivo: 2500, prezzo_attivo_t: 0, cer: '160103', classe: 'P', regione: 'Calabria',
  ordine_immesso_il: `${giorno}T00:00:00.000Z`, trasporto_iniziato_il: `${giorno}T00:00:00.000Z`, trasporto_finito_il: `${giorno}T00:00:00.000Z`,
  ...o,
});
const extra = (o) => ({ id: 't-extra', direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01', ...o });

console.log('LO SPECCHIO C E ED E IDENTICO');
{
  const corpo = (p) => {
    const righe = sorgente(p).split('\n');
    let i = 0;
    while (i < righe.length && (righe[i].startsWith('//') || righe[i].trim() === '')) i++;
    return righe.slice(i).filter(r => !/^import .* from /.test(r)).join('\n').trim();
  };
  let identici = false;
  try { identici = corpo('base44/shared/ecotyreTariffe.ts') === corpo('src/lib/ecotyreTariffe.js'); } catch { identici = false; }
  verifica('src/lib/ecotyreTariffe.js e lo specchio di base44/shared/ecotyreTariffe.ts', identici);
  const calc = sorgente('src/lib/extraRaccoltaCalc.js');
  verifica('la pagina non ha piu una sua copia della base dei 202 euro',
    !/TARIFFA_BASE_EXTRA_RACCOLTA\s*=\s*\{/.test(calc) && calc.includes("from './ecotyreTariffe.js'"));
  verifica('e il prezzo lo sceglie la funzione della fattura',
    /prezzoAttivoExtra as prezzoAttivoComune/.test(calc));
}

console.log('IL CASO DELLA CHIUSURA: 2027 E UNA TARIFFA DIVERSA DA 202');
{
  // La tariffa del 2026 chiusa al 31/12 (la chiude da sola la tariffa nuova,
  // scritta dalle anagrafiche) e quella del 2027 a 210 euro.
  const tariffe = [extra({ data_fine_validita: '2026-12-31' }), extra({ id: 't-extra-27', valore: 210, data_inizio_validita: '2027-01-01' })];
  const r = intervento('2027-02-10');
  const f = ricavoFattura(r, tariffe, 2027, 'Febbraio');
  const p = ricavoPagina(r, tariffe);
  verifica('la fattura applica i 210 euro del 2027: 525,00', f.totale === 525 && f.righe[0].tariffa_valore === 210, JSON.stringify(f.righe.map(x => [x.tariffa_valore, x.totale])));
  verifica('e la pagina dice lo stesso ricavo, con lo stesso prezzo', p.ricavo === 525 && p.prezzo_attivo === 210, JSON.stringify([p.ricavo, p.prezzo_attivo]));
  verifica('nessuno dei due parla di un altro anno', !f.anomalie.some(a => a.tipo === 'prezzo_altro_anno') && p.prezzo && p.prezzo.altro_anno === false);
}

console.log('NEL 2027 CON LA SOLA TARIFFA DEL 2026 RIMASTA APERTA');
{
  const r = intervento('2027-02-10');
  const f = ricavoFattura(r, [extra()], 2027, 'Febbraio');
  const p = ricavoPagina(r, [extra()]);
  verifica('fattura 505,00 con l avviso del prezzo di un altro anno',
    f.totale === 505 && f.anomalie.some(a => a.tipo === 'prezzo_altro_anno'), JSON.stringify([f.totale, f.anomalie.map(a => a.tipo)]));
  verifica('pagina 505,00, non zero', p.ricavo === 505, String(p.ricavo));
  verifica('e la pagina porta lo stesso avviso, con le stesse parole della riga di fattura',
    p.prezzo && p.prezzo.altro_anno === true && p.prezzo.nota === f.righe[0].note && /e' il prezzo del 2026, non del 2027/.test(p.prezzo.nota),
    JSON.stringify([p.prezzo && p.prezzo.nota, f.righe[0].note]));
}

console.log('NEL 2026 CON LA TABELLA A 210');
{
  const r = intervento('2026-09-10');
  const tariffe = [extra({ valore: 210 })];
  const f = ricavoFattura(r, tariffe, 2026, 'Settembre');
  const p = ricavoPagina(r, tariffe);
  verifica('fattura 525,00 e pagina 525,00 (prima la pagina diceva 505,00)', f.totale === 525 && p.ricavo === 525, JSON.stringify([f.totale, p.ricavo]));
  // Senza le tariffe lette la pagina sa solo la base dell'anno: il prezzo
  // scritto e i 202 del 2026, come prima.
  verifica('senza tariffe resta la base del 2026', pagina.calcExtraRaccolta(r).ricavo === 505);
}

console.log('UN ANNO SENZA TABELLA E SENZA BASE');
{
  const r = intervento('2027-02-10');
  const f = ricavoFattura(r, [], 2027, 'Febbraio');
  const p = ricavoPagina(r, []);
  verifica('fattura a zero, in errore, con l anomalia', f.totale === 0 && f.righe[0].stato_validazione === 'errore' && f.anomalie.some(a => a.tipo === 'prezzo_zero'));
  verifica('e la pagina a zero, senza origine', p.ricavo === 0 && p.prezzo && p.prezzo.origine === '', JSON.stringify(p.prezzo && p.prezzo.origine));
}

console.log('IL PREZZO SCRITTO VINCE, E I SOVRACOSTI SONO GLI STESSI');
{
  const r = intervento('2026-06-15', { peso_effettivo: 460, prezzo_attivo_t: 350, sovracosto_raccolta: 120, sovracosto_trattamento: 45.5 });
  const f = ricavoFattura(r, [extra()], 2026, 'Giugno');
  const p = ricavoPagina(r, [extra()]);
  verifica('0,46 t x 350 + 120 + 45,50 = 326,50 da tutt e due le parti', f.totale === 326.5 && p.ricavo === 326.5, JSON.stringify([f.totale, p.ricavo]));
}

console.log('LA SECONDARIA NON SI FATTURA, NEMMENO IN PAGINA');
{
  const r = intervento('2026-06-20', { tipo_movimento: 'secondaria', stoccaggio: 'NAPPI SUD', prezzo_attivo_t: 202, sovracosto_raccolta: 50 });
  const f = ricavoFattura(r, [extra()], 2026, 'Giugno');
  const p = ricavoPagina(r, [extra()]);
  verifica('la fattura non la ha', f.righe.length === 0 && f.totale === 0);
  verifica('e la pagina non le da un ricavo, e dice che non e fatturata', p.ricavo === 0 && p.fatturato === false, JSON.stringify([p.ricavo, p.fatturato]));
}

console.log('LA DICITURA SCEGLIE LA TARIFFA ANCHE IN PAGINA');
{
  // Una tariffa dell'extra raccolta legata a «Trasp.» e una per tutte: verso
  // Tecnogum, che ha la spunta, vale la prima; verso Irigom la seconda.
  const tariffe = [extra(), extra({ id: 't-trasp', valore: 150, servizio_ecotyre: 'TRASP' })];
  const fornitori = [{ ragione_sociale: 'TECNOGUM SRL', trattamento_fatturato_da_ecotyre: true }, { ragione_sociale: 'IRIGOM SRL' }];
  const aTecnogum = intervento('2026-06-15', { destinazione: 'Tecnogum' });
  const aIrigom = intervento('2026-06-16', { destinazione: 'Irigom s.r.l.' });
  const fT = ricavoFattura(aTecnogum, tariffe, 2026, 'Giugno', fornitori);
  const fI = ricavoFattura(aIrigom, tariffe, 2026, 'Giugno', fornitori);
  verifica('fattura: 150 verso Tecnogum, 202 verso Irigom', fT.righe[0].tariffa_valore === 150 && fI.righe[0].tariffa_valore === 202);
  verifica('pagina: gli stessi due prezzi', ricavoPagina(aTecnogum, tariffe, fornitori).prezzo_attivo === 150 && ricavoPagina(aIrigom, tariffe, fornitori).prezzo_attivo === 202,
    JSON.stringify([ricavoPagina(aTecnogum, tariffe, fornitori).prezzo_attivo, ricavoPagina(aIrigom, tariffe, fornitori).prezzo_attivo]));
}

console.log('LA PAGINA E LA SCHEDA LEGGONO LE TARIFFE E LE USANO');
{
  const p = sorgente('src/pages/ExtraRaccolta.jsx');
  verifica('la pagina legge le tariffe attive dell extra raccolta',
    p.includes("base44.entities.Tariffa.filter({ direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA' }"));
  verifica('e calcola ogni intervento con quelle', /calcExtraRaccolta\(r, contesto\)/.test(p) && !/calcExtraRaccolta\(r\)/.test(p));
  verifica('e le passa alla scheda', /<ExtraRaccoltaForm[\s\S]*?contesto=\{contesto\}/.test(p));
  const s = sorgente('src/components/fatturazione/ExtraRaccoltaForm.jsx');
  verifica('la scheda non ha piu la sola base dell anno', !/tariffaBaseExtraRaccolta/.test(s));
  verifica('e il suo avviso viene dalla stessa funzione', /prezzoAttivoExtra\(\{ \.\.\.f, prezzo_attivo_t: 0 \}, contesto/.test(s) && /calcExtraRaccolta\(form, contesto\)/.test(s));
  verifica('il prezzo di un altro anno si dice ma non si scrive sulla scheda', /p\.base && !p\.altro_anno/.test(s) && /senzaScritto\.altro_anno/.test(s));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
