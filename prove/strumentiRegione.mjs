// Prova della REGIONE DI UN RITIRO IN ECOTYNA (chiusura dell'audit, 11/10/2026).
//
// EcoTyna (e il Report Mensile) leggevano per primo il campo «Regioni» del file
// del portale, che non si ricalcola mai; il raccolto, la dashboard, gli avvisi e
// le giacenze leggono la provincia. Lo stesso ritiro poteva cosi' stare in una
// regione per EcoTyna e in un'altra per la Dashboard. Ora c'e' una regola sola,
// regioneDi (base44/shared/regioneMovimento.ts): la provincia, poi la regione,
// e il campo del file solo se non c'e' altro.
// npm run prove
import { readFileSync } from 'node:fs';
import { regioneDi } from '../base44/shared/regioneMovimento.ts';
import { STRUMENTI } from '../base44/shared/strumentiAssistente.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('LA REGOLA');
verifica('prima la provincia', regioneDi({ provincia: 'na', regione: 'Puglia', regioni: 'PUGLIA' }) === 'Campania');
verifica('poi la regione', regioneDi({ provincia: '', regione: 'Basilicata', regioni: 'Calabria' }) === 'Basilicata');
verifica('il campo del file solo se non c\'e\' altro', regioneDi({ regioni: '  Sicilia ' }) === 'Sicilia');
verifica('niente: stringa vuota, non una regione inventata', regioneDi({}) === '' && regioneDi(null) === '');

console.log('ECOTYNA LA USA PER RAGGRUPPARE E PER FILTRARE');
const g = (giorno) => `${giorno}T08:00:00Z`;
const riga = (id, provincia, regioni, kg) => ({
  id, id_ordine: id, numero_fir: 'FIR' + id, stato: 'terminato', trasportatore: 'RACC SRL', destinazione: 'ALFA SRL',
  provincia, regione: '', regioni, peso_effettivo: kg, prodotto: 'P - fino a 35 kg', classe: 'P',
  ordine_immesso_il: g('2026-05-01'), trasporto_iniziato_il: g('2026-05-02'), trasporto_finito_il: g('2026-05-02'),
});
const ARCHIVI = {
  PrimariaRete: [
    riga('A', 'NA', 'PUGLIA', 1000),     // il file dice Puglia, la provincia Campania
    riga('B', 'BA', 'Puglia', 2000),
    riga('C', '', 'Basilicata', 3000),   // senza provincia: vale il campo del file
  ],
};
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
const finto = { asServiceRole: { entities: new Proxy({}, { get: (_t, nome) => ({
  list: async (_o, lim = 1e9, skip = 0) => (ARCHIVI[nome] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => (ARCHIVI[nome] || []).filter(r => soddisfa(r, f)).slice(skip, skip + lim),
}) }) } };
const raccolto = STRUMENTI.find(s => s.nome === 'raccolto');
const perRegione = (await raccolto.esegui(finto, { canale: 'RETE', anno: 2026, raggruppa: 'regione' })).dati.dettaglio.righe;
const t = (nome) => (perRegione.find(x => x.nome === nome) || {}).tonnellate;
verifica('il ritiro di Napoli sta in Campania, non in PUGLIA', t('Campania') === 1 && t('PUGLIA') === undefined, JSON.stringify(perRegione));
verifica('Bari in Puglia, e il ritiro senza provincia in Basilicata', t('Puglia') === 2 && t('Basilicata') === 3, JSON.stringify(perRegione));
const puglia = (await raccolto.esegui(finto, { canale: 'RETE', anno: 2026, regione: 'Puglia' })).dati;
verifica('filtrando per Puglia resta solo Bari', puglia.tonnellate === 2, String(puglia.tonnellate));
const campania = (await raccolto.esegui(finto, { canale: 'RETE', anno: 2026, regione: 'campania', raggruppa: 'regione' })).dati;
verifica('e filtrare e raggruppare dicono la stessa regione', campania.tonnellate === 1 && campania.dettaglio.righe.length === 1 && campania.dettaglio.righe[0].nome === 'Campania', JSON.stringify(campania.dettaglio));

console.log('NESSUNO LEGGE PER PRIMO IL CAMPO DEL FILE');
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');
for (const p of ['base44/shared/strumentiAssistente.ts', 'base44/shared/reportMensile.ts']) {
  verifica(`${p}: niente «r.regioni ||»`, !/r\.regioni\s*\|\|/.test(sorgente(p)));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
