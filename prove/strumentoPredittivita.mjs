// Lo strumento proiezione_secondarie degli assistenti: le priorita' dette a parole
// (mai il 99), i viaggi di uno stoccaggio con le correzioni a mano, e lo stato del
// programma della settimana dopo secondo il giorno e l'ora (il mercoledi' alle 8,
// il secondo giro alle 14).
const R = new URL('../base44/shared/', import.meta.url).href;
const { calcolaPredittivita, piuGiorni } = await import(R + 'predittivita.ts');
const { regolePredittivita } = await import(R + 'regolePredittivita.ts');
const { rispostaPredittivita } = await import(R + 'predittivitaRisposta.ts');
const { normalizzaRagioneSociale: chiave } = await import(R + 'normalizzaRagioneSociale.ts');
const { STRUMENTI } = await import(R + 'strumentiAssistente.ts');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// l'ora "adesso": si sposta Date
const DataVera = Date;
const fissaAdesso = (iso) => {
  const t = DataVera.parse(iso);
  globalThis.Date = class extends DataVera { constructor(...a) { super(...(a.length ? a : [t])); } static now() { return t; } };
};

let n = 0;
const alle12 = (g) => `${g}T10:00:00Z`;
const date = (g) => ({ ordine_immesso_il: alle12(g), trasporto_iniziato_il: alle12(g), trasporto_finito_il: alle12(g) });
const prim = (trasportatore, destinazione, kg, giorno) => ({ id: 'p' + (++n), id_ordine: 'P' + n, stato: 'terminato', classe: 'P', trasportatore, destinazione, tipo_destinazione: 'imp', peso_effettivo: kg, canale: 'RETE', ...date(giorno) });
const DOMENICHE = Array.from({ length: 12 }, (_, i) => piuGiorni('2026-07-05', 7 * i));

function risposta({ anno = 2026, oggi, regole = regolePredittivita(2026), priorita = null, programmati = [] }) {
  const ingresso = {
    anno, oggi, chiave, regole, fine: '2026-12-18',
    impianti: [
      { chiave: 'tecnogum', nome: 'Tecnogum', target_kg: 2295000, fine: '2026-12-18' },
      { chiave: 'irigom', nome: 'Irigom', target_kg: 4445000, fine: '2026-12-18' },
    ],
    raccoglitori: [],
    stoccaggi: [
      { chiave: 'nappi sud', nome: 'Nappi Sud', plafond_kg: null, giacenza_kg: 900000, giacenza_da: '2025-12-31', destinazioni: [{ impianto: 'tecnogum', priorita }, { impianto: 'irigom', priorita }] },
      { chiave: 't-cycle', nome: 'T-Cycle', plafond_kg: null, giacenza_kg: 100000, giacenza_da: '2025-12-31', destinazioni: [{ impianto: 'tecnogum', priorita: null }] },
    ],
    primarie: [...DOMENICHE.map(g => prim('R1', 'Nappi Sud', 60000, g)), ...DOMENICHE.map(g => prim('R2', 'T-Cycle', 10000, g))],
    secondarie: [],
  };
  const calcolo = calcolaPredittivita(ingresso);
  const dati = { ingresso, avvisi: [], caricamento_in_corso: null, senza_fine: { primarie: [], secondarie: [] }, programmati, lettura: {} };
  return rispostaPredittivita({ dati, calcolo, anno, oggi, solaLettura: false, puoFissare: true });
}
const strumento = STRUMENTI.find(s => s.nome === 'proiezione_secondarie');
const esegui = async (d) => (await strumento.esegui({ functions: { invoke: async () => ({ data: d }) } }, {})).dati;

// --- A5: priorita' 2026 (regole): prima Tecnogum, poi Irigom
fissaAdesso('2026-09-28T08:00:00Z'); // lunedi' 28/09
let d = risposta({ oggi: '2026-09-28' });
let out = await esegui(d);
const nappi = out.stoccaggi.find(s => s.stoccaggio === 'Nappi Sud');
verifica('2026: prima Tecnogum, poi Irigom', nappi.a_chi_va === 'prima Tecnogum, poi Irigom', nappi.a_chi_va);
const tec = out.impianti.find(i => i.impianto === 'Tecnogum');
verifica('niente 99 e niente numero di priorita\'', !/ordine_di_priorita|alimenta_in_ordine|"priorita":99/.test(JSON.stringify(out)), '');
verifica('T-Cycle: unico impianto', tec.dagli_stoccaggi.find(x => x.stoccaggio === 'T-Cycle').come_lo_serve === "e' l'unico impianto che lo stoccaggio alimenta");
verifica('Tecnogum ha la priorita\' su Nappi Sud', /^ha la priorita'/.test(tec.dagli_stoccaggi.find(x => x.stoccaggio === 'Nappi Sud').come_lo_serve));
const iri = out.impianti.find(i => i.impianto === 'Irigom');
verifica('Irigom dopo Tecnogum', /^dopo Tecnogum/.test(iri.dagli_stoccaggi[0].come_lo_serve), iri.dagli_stoccaggi[0].come_lo_serve);
verifica('lunedi\': si fissa mercoledi\' 30/09', /si fissa da solo mercoledi' 30\/09\/2026 alle 8/.test(out.programma_settimana_dopo.stato_del_programma));

// --- A5: anno senza regole: priorita' pari, insieme; avviso
const d27 = risposta({ oggi: '2026-09-28', regole: regolePredittivita(2027) });
const out27 = await esegui(d27);
const n27 = out27.stoccaggi.find(s => s.stoccaggio === 'Nappi Sud');
verifica('priorita\' pari: insieme', n27.a_chi_va === "Tecnogum e Irigom insieme, senza priorita'" && n27.gruppi_di_priorita.length === 1);
verifica('avviso delle regole non definite', out27.avvisi.some(a => /regole/.test(a)), JSON.stringify(out27.avvisi));
verifica('un solo avviso delle regole', out27.avvisi.filter(a => /regole/i.test(a)).length === 1, JSON.stringify(out27.avvisi));

// --- A2: correzione a mano di Nappi Sud -> Irigom a 4 viaggi
const settimana = d.prossima_settimana.dal;
const righeNappi = d.programma.filter(r => r.stoccaggio === 'Nappi Sud');
const programmati = [
  { id: 'x1', origine: 'programma', data_inizio: settimana, fornitore_nome: 'Nappi Sud', impianto_nome: 'Tecnogum', viaggi_previsti: righeNappi.find(r => r.impianto === 'Tecnogum').viaggi },
  { id: 'x2', origine: 'manuale', data_inizio: settimana, fornitore_nome: 'Nappi Sud', impianto_nome: 'Irigom', viaggi_previsti: 4 },
  { id: 'x3', origine: 'programma', data_inizio: settimana, fornitore_nome: 'T-Cycle', impianto_nome: 'Tecnogum', viaggi_previsti: 1 },
];
fissaAdesso('2026-10-01T08:00:00Z'); // giovedi'
const dF = risposta({ oggi: '2026-10-01', programmati });
const outF = await esegui(dF);
const nF = outF.stoccaggi.find(s => s.stoccaggio === 'Nappi Sud');
const atteso = righeNappi.find(r => r.impianto === 'Tecnogum').viaggi + 4;
verifica('programmati di Nappi Sud = fissati', nF.viaggi_prossima_settimana.programmati === dF.programma.filter(r => r.stoccaggio === 'Nappi Sud').reduce((t, r) => t + (r.fissato ? r.fissato.viaggi : r.viaggi), 0));
verifica('riga Irigom: vale 4', outF.programma_settimana_dopo.righe.find(r => r.impianto === 'Irigom').viaggi === 4);
verifica('stato: fissato, con correzione a mano', /^Fissato: .*corretti a mano/.test(outF.programma_settimana_dopo.stato_del_programma));

// --- A4: il mercoledi' e' passato senza fissare
const dG = risposta({ oggi: '2026-10-01' });
const outG = await esegui(dG);
verifica('giovedi\' senza programma: non riuscito, a mano', /^Non fissato: il passaggio automatico di mercoledi' 30\/09\/2026 non e' riuscito/.test(outG.programma_settimana_dopo.stato_del_programma));
fissaAdesso('2026-09-30T05:30:00Z'); // mercoledi' 7:30
let outM = await esegui(risposta({ oggi: '2026-09-30' }));
verifica('mercoledi\' prima delle 8: oggi alle 8', /oggi, mercoledi', alle 8/.test(outM.programma_settimana_dopo.stato_del_programma));
fissaAdesso('2026-09-30T09:00:00Z'); // mercoledi' 11
outM = await esegui(risposta({ oggi: '2026-09-30' }));
verifica('mercoledi\' alle 11: il passaggio delle 14', /passaggio delle 14/.test(outM.programma_settimana_dopo.stato_del_programma));
fissaAdesso('2026-09-30T14:00:00Z'); // mercoledi' 16
outM = await esegui(risposta({ oggi: '2026-09-30' }));
verifica('mercoledi\' alle 16: non riuscito', /^Non fissato/.test(outM.programma_settimana_dopo.stato_del_programma));
// programmi non letti
fissaAdesso('2026-10-01T08:00:00Z');
const dN = risposta({ oggi: '2026-10-01' });
dN.avvisi.push({ tipo: 'programmi_non_letti', grave: true, testo: 'I programmi fissati non si sono potuti leggere.' });
const outN = await esegui(dN);
verifica('programmi non letti: non si sa', /non si e' potuto leggere/.test(outN.programma_settimana_dopo.stato_del_programma));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
