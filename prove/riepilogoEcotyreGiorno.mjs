// IL GIORNO DEL RIEPILOGO DELL'ATTIVA E' QUELLO ITALIANO (13/10/2026).
//
// RiepilogoEcotyre.jsx scriveva le date con String(v).slice(0, 10): i primi
// dieci caratteri di un istante UTC. La data di elaborazione del documento e'
// un toISOString, e la fine del trasporto arriva dal portale come mezzanotte
// italiana, cioe' le 22:00 o le 23:00 UTC del giorno prima. Un documento
// elaborato alle 00:30 del 1° ottobre diceva «il documento del 30/09/2026», e
// un ritiro finito il 1° settembre, arrivato dopo l'elaborazione, compariva fra
// le differenze col 31/08/2026: nel mese prima, quello che la regola 1 esclude.
// Ora il giorno e' quello di giornoRoma (src/lib/giornoItaliano.js).
//
// Il riquadro della riconciliazione gira davvero (prove/dati/paginaFinta.mjs).
import { readFileSync } from 'node:fs';
import { caricaPagina, aspetta, trova, testo } from './dati/paginaFinta.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const p = await caricaPagina('components/fatturazione/RiepilogoEcotyre');
const { Riconciliazione } = p.modulo;

console.log('IL DOCUMENTO DEL GIORNO ITALIANO');
{
  // elaborato alle 00:30 italiane del 1° ottobre 2026 (ora legale: UTC+2)
  const t = { label: 'Rete', riconciliazione: { allineato: true, data_elaborazione: '2026-09-30T22:30:00.000Z' } };
  const r = p.monta(Riconciliazione, { t });
  await aspetta(5);
  const frase = testo(r.albero);
  verifica('elaborato alle 00:30 del 1° ottobre: «il documento del 01/10/2026»', /il documento del 01\/10\/2026 coincide con i dati di oggi/.test(frase), frase);
  verifica('e non del 30/09', !/30\/09\/2026/.test(frase), frase);
  r.smonta();
}
{
  // d'inverno (ora solare: UTC+1) la stessa regola: 23:15 UTC del 31/12 e' il 1° gennaio
  const t = { label: 'ACI', riconciliazione: { allineato: true, data_elaborazione: '2026-12-31T23:15:00.000Z' } };
  const r = p.monta(Riconciliazione, { t });
  await aspetta(5);
  verifica('d\'inverno: 23:15 UTC del 31/12/2026 e\' il 01/01/2027', /il documento del 01\/01\/2027/.test(testo(r.albero)), testo(r.albero));
  r.smonta();
}
{
  // a meta' giornata non cambia niente
  const t = { label: 'Rete', riconciliazione: { allineato: true, data_elaborazione: '2026-10-05T10:00:00.000Z' } };
  const r = p.monta(Riconciliazione, { t });
  await aspetta(5);
  verifica('a meta\' giornata il giorno e\' lo stesso: 05/10/2026', /il documento del 05\/10\/2026/.test(testo(r.albero)), testo(r.albero));
  r.smonta();
}
{
  // senza la data si scrive «—», non una data inventata
  const t = { label: 'Rete', riconciliazione: { allineato: true, data_elaborazione: null } };
  const r = p.monta(Riconciliazione, { t });
  await aspetta(5);
  verifica('senza data di elaborazione: «—»', /il documento del — coincide/.test(testo(r.albero)), testo(r.albero));
  r.smonta();
}

console.log('LA FINE DEL TRASPORTO DEI MOVIMENTI ARRIVATI DOPO');
{
  const t = {
    label: 'Rete',
    riconciliazione: {
      allineato: false, stato: 'elaborata', data_elaborazione: '2026-09-30T22:30:00.000Z',
      // mezzanotte italiana del 1° settembre: nel file del portale 22:00 UTC del 31/08
      nuovi: [{ ordine: 'ET26090001', numero_fir: 'RGYTR030001AA', descrizione: '', data_fine_trasporto: '2026-08-31T22:00:00.000Z', kg: 2000, totale: 404 },
        { ordine: 'ET26090002', numero_fir: 'RGYTR030002AA', descrizione: '', data_fine_trasporto: null, kg: 1000, totale: 202 }],
      cambiati: [], spariti: [], delta_kg: 3000, delta_euro: 606,
    },
  };
  const r = p.monta(Riconciliazione, { t });
  await aspetta(5);
  verifica('il titolo dice il documento del 01/10/2026', /il documento del 01\/10\/2026 non coincide più/.test(testo(r.albero)), testo(r.albero));
  // si apre il dettaglio, come farebbe chi legge
  const pulsante = trova(r.albero, 'button')[0];
  pulsante.props.onClick();
  await aspetta(5);
  const righe = trova(r.albero, el => el.type === 'tr' && el.key !== null && el.key !== undefined);
  const celle = righe.map(tr => trova(tr, 'td').map(td => testo(td)));
  const prima = celle.find(c => c[0] === 'ET26090001') || [];
  const seconda = celle.find(c => c[0] === 'ET26090002') || [];
  verifica('il ritiro di mezzanotte italiana del 1° settembre e\' del 01/09/2026, non del 31/08', prima[2] === '01/09/2026', JSON.stringify(celle));
  verifica('una fine trasporto che manca si scrive «—»', seconda[2] === '—', JSON.stringify(celle));
  verifica('nessun errore', r.errori.length === 0, String(r.errori[0] || ''));
  r.smonta();
}

console.log('NEL SORGENTE NESSUN TAGLIO DELLA DATA');
{
  // il taglio dei primi dieci caratteri non deve tornare: il giorno si prende da giornoRoma
  const src = readFileSync(new URL('../src/components/fatturazione/RiepilogoEcotyre.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('la pagina usa giornoRoma', /import \{ giornoRoma \} from '@\/lib\/giornoItaliano'/.test(src) && /giornoRoma\(v\)/.test(src));
  verifica('e non taglia piu\' le date con slice(0, 10)', !/\.slice\(0, 10\)/.test(src));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
