// IL SURPLUS SULLE TARIFFE NELLO STORICO DI ECOTYNA (13/10/2026).
//
// Le scritture dei surplus (il Fuel Surcharge del consorzio, gli accordi
// commerciali) passano dallo storico delle modifiche come le tariffe
// (CAMPI_TRACCIATI.SurplusTariffa, prove/storicoModifiche.mjs sezione 8). Lo
// strumento storico_modifiche di EcoTyna (base44/shared/storicoModifiche.ts) le
// deve dire come dice le altre:
//   1. col nome dell'archivio a parole, «surplus sulle tariffe»: prima diceva
//      «SurplusTariffa», il nome interno, come era successo il 13/10 con
//      «DocumentoFatturazione»;
//   2. chiedendo delle tariffe, perche' il surplus e' parte del prezzo: prima
//      «chi ha cambiato le tariffe?» non trovava nessun surplus;
//   3. chiedendo del surplus, del Fuel Surcharge o del carburante, con tutti i
//      suoi campi (date, stato, elenco dei fornitori), non solo gli importi:
//      prima trovava solo le righe con «surplus» nel nome del campo;
//   4. senza dire a chi non e' amministratore quanto si paga ai fornitori, e
//      niente di un surplus solo passivo (campoRiservato);
//   5. con la nota che elenca i surplus fra le cose che lo storico registra.
//
// node prove/storicoModificheSurplus.mjs
import { righeDiModifica } from '../base44/shared/campiTracciati.ts';
import { eseguiStrumento } from '../base44/shared/strumentiAssistente.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (v) => JSON.stringify(v);

// Le righe del registro come le scrive il motore vero (righeDiModifica): il
// Fuel Surcharge della rete creato e poi accorciato, un accordo commerciale solo
// passivo, e per confronto una tariffa e un target.
const FUEL = { id: 's-rete', gruppo: 'g1', nome: 'Fuel Surcharge', origine: 'CONSORZIO', tipologia: 'RETE', prestazione: 'RACCOLTA', a_chi: 'tutti', euro_t_passiva: 5, euro_t_attiva: 5, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo' };
const ACCORDO = { id: 's-acc', gruppo: 'g2', nome: 'Premio Gatim', origine: 'ACCORDO_COMMERCIALE', tipologia: 'RETE', prestazione: 'RACCOLTA', a_chi: 'elenco', fornitori_json: J([{ id: 'f-gatim', nome: 'GATIM S.R.L.' }]), euro_t_passiva: 3, euro_t_attiva: null, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo' };
let n = 0;
const conId = (righe) => righe.map(r => ({ id: 'm' + (++n), ...r }));
const reg = [
  ...conId(righeDiModifica('SurplusTariffa', { record_id: FUEL.id, dopo: FUEL, operazione: 'create' }, { utente: 'Amministratore', il: '2026-10-13T08:00:00.000Z' })),
  ...conId(righeDiModifica('SurplusTariffa', { record_id: FUEL.id, prima: FUEL, dopo: { ...FUEL, data_fine_validita: '2026-11-30', stato: 'attivo' }, patch: { data_fine_validita: '2026-11-30' } }, { utente: 'Amministratore', il: '2026-10-14T08:00:00.000Z', motivo: 'comunicazione del consorzio' })),
  ...conId(righeDiModifica('SurplusTariffa', { record_id: ACCORDO.id, dopo: ACCORDO, operazione: 'create' }, { utente: 'Amministratore', il: '2026-10-13T09:00:00.000Z' })),
  { id: 'mt', entita: 'Tariffa', record_id: 't1', etichetta: 'EMMESSE SRL · RACCOLTA · RETE', campo: 'valore', unita: '€/t', prima: '72', dopo: '75', operazione: 'update', utente: 'Amministratore', il: '2026-10-12T08:00:00.000Z', anno: 2026, riservato: true },
  { id: 'mi', entita: 'ImpiantoTargetSecondaria', record_id: 'i1', etichetta: 'IRIGOM S.R.L. · 2026', campo: 'target', unita: 'kg', prima: '1050000', dopo: '1200000', operazione: 'update', utente: 'Amministratore', il: '2026-10-11T08:00:00.000Z', anno: 2026, riservato: false },
];
const delSurplus = reg.filter(r => r.entita === 'SurplusTariffa');
const campiFuel = new Set(delSurplus.filter(r => r.record_id === FUEL.id).map(r => r.campo));
verifica('il registro di prova: il Fuel Surcharge con nome, importi, date e stato, l\'accordo con l\'elenco',
  ['nome', 'euro_t_passiva', 'euro_t_attiva', 'data_inizio_validita', 'data_fine_validita'].every(c => campiFuel.has(c)) && delSurplus.some(r => r.record_id === ACCORDO.id && r.campo === 'fornitori_json'), J([...campiFuel]));

const archivi = { ModificaDato: { list: async () => reg.map(r => ({ ...r })), filter: async () => reg.map(r => ({ ...r })) } };
const finto = { asServiceRole: { entities: archivi } };
const chiedi = async (p, amministratore) => {
  const r = await eseguiStrumento(finto, 'storico_modifiche', p, { amministratore });
  return { r, righe: (r && r.dati && r.dati.modifiche && (r.dati.modifiche.righe || r.dati.modifiche)) || [] };
};
const soloSurplus = (righe) => righe.filter(x => x.archivio === 'surplus sulle tariffe');

console.log('1. IL NOME DELL\'ARCHIVIO A PAROLE');
{
  const { righe } = await chiedi({ cosa: 'surplus' }, true);
  verifica('le righe del surplus dicono «surplus sulle tariffe», mai «SurplusTariffa»',
    righe.length > 0 && righe.every(x => x.archivio === 'surplus sulle tariffe') && !J(righe).includes('"SurplusTariffa"'), J(righe.map(x => x.archivio)));
}

console.log('2. CHI CHIEDE DELLE TARIFFE TROVA ANCHE I SURPLUS');
{
  const { righe } = await chiedi({ cosa: 'tariffe' }, true);
  verifica('«tariffe»: la tariffa di Emmesse e tutte le righe dei due surplus, non il target',
    righe.some(x => x.archivio === 'tariffa') && soloSurplus(righe).length === delSurplus.length && !righe.some(x => /target/.test(x.archivio)), J(righe.map(x => [x.archivio, x.campo])));
}

console.log('3. CHI CHIEDE DEL SURPLUS LO TROVA TUTTO');
for (const cosa of ['surplus', 'Fuel Surcharge', 'carburante']) {
  const { righe } = await chiedi({ cosa }, true);
  verifica(`«${cosa}»: tutte le ${delSurplus.length} righe dei surplus (date, stato ed elenco compresi), e nient'altro`,
    righe.length === delSurplus.length && soloSurplus(righe).length === delSurplus.length
      && righe.some(x => x.campo === 'valido fino al' && x.operazione === 'modificato') && righe.some(x => x.campo === "fornitori dell'elenco"),
    J(righe.map(x => [x.archivio, x.campo, x.operazione])));
}

console.log('4. A CHI NON E\' AMMINISTRATORE NIENTE COSTI');
{
  const { r, righe } = await chiedi({ cosa: 'surplus' }, false);
  const testo = J(righe);
  verifica('l\'importo ai fornitori del Fuel Surcharge non si dice, quello da Ecotyre si',
    righe.some(x => x.campo === 'surplus da Ecotyre') && !righe.some(x => x.campo === 'surplus ai fornitori'), J(righe.map(x => x.campo)));
  verifica('l\'accordo solo passivo non si nomina nemmeno, e il numero delle righe taciute si dice',
    !testo.includes('Premio Gatim') && !testo.includes('GATIM') && Number(r.dati.riservate_non_dette) > 0, `${testo.slice(0, 200)} ${r.dati.riservate_non_dette}`);
}

console.log('5. LA NOTA DICE CHE LO STORICO REGISTRA I SURPLUS');
{
  const { r } = await chiedi({ cosa: 'surplus' }, true);
  verifica('la nota elenca «tariffe e surplus sulle tariffe»', /tariffe e surplus sulle tariffe/.test(String(r.dati && r.dati.nota)), String(r.dati && r.dati.nota).slice(0, 160));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
