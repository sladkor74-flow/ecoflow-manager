// IL COSTO PASSIVO CHE LA SCHEDA DELL'EXTRA RACCOLTA PROPONE (chiusura
// dell'audit, 11/10/2026, revisione dei soldi).
//
// La scheda (ExtraRaccoltaForm.jsx) leggeva le tariffe con { stato: 'attivo' }
// e voleva lo stato scritto 'attivo': una tariffa con lo stato vuoto, che per la
// passiva vale, non si proponeva. E la validita' la confrontava come testo:
// con un orario nella fine trasporto l'ultimo giorno della tariffa si perdeva, e
// il giorno era quello UTC, non quello italiano. Ora la scelta e' una funzione
// sola (tariffaPassivaProposta di extraRaccoltaCalc.js), con tariffaValeIl come
// in fatturazione. npm run prove
import { readFileSync } from 'node:fs';
import { tariffaPassivaProposta } from '../src/lib/extraRaccoltaCalc.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const emmesse = { id: 'f-emmesse', ragione_sociale: 'EMMESSE SRLS' };
const tariffa = (p) => ({ direzione: 'PASSIVA', tipologia: 'EXTRA_RACCOLTA', prestazione: 'RACCOLTA', fornitore_id: 'f-emmesse', fornitore_nome: 'EMMESSE SRLS', unita_misura: '€/t', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-09-30', ...p });
const intervento = (p) => ({ classe: 'P', provincia: 'CS', destinazione: 'Irigom S.r.l.', trasporto_finito_il: '2026-09-15', ...p });

console.log('LO STATO VUOTO VALE, LA DISATTIVATA NO');
{
  const senzaStato = tariffa({ id: 'a', valore: 90 });
  verifica('una tariffa senza stato si propone (prima no: voleva «attivo» scritto)', tariffaPassivaProposta([senzaStato], emmesse, 'RACCOLTA', intervento(), '2026-10-11')?.valore === 90);
  verifica('una disattivata no', tariffaPassivaProposta([{ ...senzaStato, stato: 'non_attivo' }], emmesse, 'RACCOLTA', intervento(), '2026-10-11') === null);
}

console.log('IL GIORNO E\' QUELLO ITALIANO, E L\'ULTIMO CONTA');
{
  const t = tariffa({ id: 'b', valore: 90, stato: 'attivo' });
  verifica('fine trasporto il 30/09, ultimo giorno della tariffa: vale', tariffaPassivaProposta([t], emmesse, 'RACCOLTA', intervento({ trasporto_finito_il: '2026-09-30' }), '2026-10-11')?.valore === 90);
  verifica('alle 23:00 italiane del 30/09 (21:00 UTC) vale ancora (prima l\'orario la faceva scadere)',
    tariffaPassivaProposta([t], emmesse, 'RACCOLTA', intervento({ trasporto_finito_il: '2026-09-30T21:00:00.000Z' }), '2026-10-11')?.valore === 90);
  verifica('all\'1:30 italiana del 1° ottobre (23:30 UTC del 30) non vale piu\'',
    tariffaPassivaProposta([t], emmesse, 'RACCOLTA', intervento({ trasporto_finito_il: '2026-09-30T23:30:00.000Z' }), '2026-10-11') === null);
  verifica('un intervento ancora aperto guarda oggi', tariffaPassivaProposta([t], emmesse, 'RACCOLTA', intervento({ trasporto_finito_il: '' }), '2026-09-20')?.valore === 90
    && tariffaPassivaProposta([t], emmesse, 'RACCOLTA', intervento({ trasporto_finito_il: '' }), '2026-10-11') === null);
}

console.log('LA SCELTA E\' QUELLA DELLA PASSIVA');
{
  const base = { stato: 'attivo', data_fine_validita: '2026-12-31' };
  const tariffe = [tariffa({ ...base, id: 'gen', valore: 80 }), tariffa({ ...base, id: 'gatim', valore: 72, destinazione: 'GATIM S.R.L.' }), tariffa({ ...base, id: 'irigom', valore: 90, destinazione: 'Irigom S.r.l.' }),
    tariffa({ ...base, id: 'cs', valore: 85, provincia: 'CS' }), tariffa({ ...base, id: 'tratt', prestazione: 'TRATTAMENTO', fornitore_nome: 'GATIM S.R.L.', fornitore_id: 'f-gatim', valore: 95 }),
    tariffa({ ...base, id: 'rete', tipologia: 'RETE', valore: 60 })];
  verifica('a Irigom 90, la tariffa per destinazione', tariffaPassivaProposta(tariffe, emmesse, 'RACCOLTA', intervento(), '2026-10-11')?.id === 'irigom');
  verifica('a Gatim 72', tariffaPassivaProposta(tariffe, emmesse, 'RACCOLTA', intervento({ destinazione: 'Gatim' }), '2026-10-11')?.id === 'gatim');
  verifica('altrove la provincia, poi la generica', tariffaPassivaProposta(tariffe, emmesse, 'RACCOLTA', intervento({ destinazione: 'ALTRO' }), '2026-10-11')?.id === 'cs'
    && tariffaPassivaProposta(tariffe, emmesse, 'RACCOLTA', intervento({ destinazione: 'ALTRO', provincia: 'NA' }), '2026-10-11')?.id === 'gen');
  verifica('il trattamento all\'impianto, del suo fornitore', tariffaPassivaProposta(tariffe, { id: 'f-gatim', ragione_sociale: 'GATIM S.R.L.' }, 'TRATTAMENTO', intervento(), '2026-10-11')?.valore === 95);
  verifica('la rete non si usa mai al posto dell\'extra raccolta', !tariffaPassivaProposta(tariffe.filter(t => t.id === 'rete'), emmesse, 'RACCOLTA', intervento(), '2026-10-11'));
}

console.log('LA SCHEDA LA USA, E LEGGE TUTTE LE TARIFFE');
{
  const src = readFileSync(new URL('../src/components/fatturazione/ExtraRaccoltaForm.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('la scheda chiama tariffaPassivaProposta col giorno di oggi in Italia', /tariffaPassivaProposta\(tariffe, forn, prestazione, f, oggiRoma\(\)\)/.test(src));
  verifica('e legge le tariffe a pagine, senza il filtro sullo stato',
    /fetchAllClient\(base44\.entities\.Tariffa, \{ direzione: 'PASSIVA', tipologia: 'EXTRA_RACCOLTA' \}/.test(src) && !/Tariffa\.filter\(\{[^}]*stato: 'attivo'/.test(src) && !/t\.stato !== 'attivo'/.test(src));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
