// Prova dei target degli impianti (base44/shared/targetImpianti.ts): la lettura
// con il ripiego per i contratti, e i target delle righe di Giacenze letti da
// Target & Status (27/09/2026). npm run prove
import { impiantiTargetDellAnno, targetRigaGiacenze, testoTargetDaPortare } from '../base44/shared/targetImpianti.ts';
import * as modulo from '../base44/shared/targetImpianti.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

verifica('il confronto fra i due target non c\'e\' piu\'', !('divergenzeTargetImpianti' in modulo) && !('testoDivergenza' in modulo) && !('TOLLERANZA_TARGET_KG' in modulo), Object.keys(modulo).join(', '));

// Un record vale un anno (26/09/2026): senza anno vale il 2026. I record degli
// anni chiusi restano attivi, e il target puo' cambiare da un anno all'altro.
const dueAnni = [
  { nome_impianto: 'Tecnogum', target: 2295000, stato: 'attivo' },
  { nome_impianto: 'Tecnogum', target: 2500000, stato: 'attivo', anno: 2027 },
];

// Il target che vale in un anno (contratti): quello dell'anno, o il piu' recente prima.
const tDi = (anno) => { const r = impiantiTargetDellAnno([...dueAnni, { nome_impianto: 'TECNOGUM SRL', target: 1, stato: 'non_attivo', anno: 2028 }], anno).get('tecnogum'); return r ? r.target : null; };
verifica('il target del 2026 e\' il record senza anno', tDi(2026) === 2295000, String(tDi(2026)));
verifica('il target del 2027 e\' il record del 2027', tDi(2027) === 2500000, String(tDi(2027)));
verifica('per il 2028, ancora senza record, vale l\'ultimo anno scritto (e non un record non attivo)', tDi(2028) === 2500000, String(tDi(2028)));
verifica('per un anno prima di tutti i record non c\'e\' target', tDi(2025) === null, String(tDi(2025)));
const stessoAnno = impiantiTargetDellAnno([
  { nome_impianto: 'Irigom', target: 1, anno: 2027, updated_date: '2027-01-02T10:00:00' },
  { nome_impianto: 'IRIGOM SRL', target: 2, anno: 2027, updated_date: '2027-02-02T10:00:00' },
], 2027);
verifica('due record dello stesso anno: vale il piu\' recente', stessoAnno.get('irigom').target === 2, JSON.stringify([...stessoAnno.entries()]));

// I target delle righe di Giacenze (27/09/2026): da Target & Status, di
// esattamente quell'anno; il vecchio campo di Giacenze solo finche' manca.
console.log('GIACENZE LEGGE DA TARGET & STATUS');
const impianti = [
  { nome_impianto: 'IRIGOM SRL', target: 4445000, stato: 'attivo' },
  { nome_impianto: 'Tecnogum', target: 2500000, stato: 'attivo', anno: 2027 },
  { nome_impianto: 'Gatim', target: 950000, stato: 'non_attivo', anno: 2026 },
];
const raccoglitori = [
  { raccoglitore: 'Alfa', impianto: 'Irigom S.r.l.', anno: 2026, target_tonnellate: 1200.5 },
  { raccoglitore: 'Beta', impianto: 'IRIGOM SRL', anno: 2026, target_tonnellate: 2199.5 },
  { raccoglitore: 'Alfa', impianto: 'Irigom', anno: 2027, target_tonnellate: 99 },
  { raccoglitore: 'Gamma', impianto: 'NAPPI SUD SRL', anno: 2026, target_tonnellate: 2295 },
];
const riga = (sito, td, anno, giacenzaSito = null, extra = {}) => targetRigaGiacenze({ sito, td, anno, giacenzaSito, impiantiTarget: impianti, raccoglitori, ...extra });

const irigom = riga('Irigom S.r.l.', 'imp', 2026, { target_totale_t: 1, target_primarie_t: 1 });
verifica('impianto: il target e\' quello di Target & Status, in tonnellate (il record senza anno vale il 2026)', irigom.target_totale_t === 4445 && !irigom.da_portare.totale && irigom.record?.nome_impianto === 'IRIGOM SRL', JSON.stringify(irigom));
verifica('primarie: la somma dei raccoglitori legati al sito in quell\'anno, e il vecchio campo non conta', irigom.target_primarie_t === 3400 && !irigom.da_portare.primarie, JSON.stringify(irigom));

const tec26 = riga('TECNOGUM SRL', 'imp', 2026);
verifica('nessun ripiego su un altro anno: Tecnogum ha solo il 2027, nel 2026 non ha target', tec26.target_totale_t === 0 && tec26.record === null && !tec26.da_portare.totale, JSON.stringify(tec26));
verifica('Tecnogum nel 2027 ha il suo', riga('TECNOGUM SRL', 'imp', 2027).target_totale_t === 2500);
verifica('Irigom nel 2027 non ha record: niente target (e le primarie del 2027 sono le sue)', riga('Irigom', 'imp', 2027).target_totale_t === 0 && riga('Irigom', 'imp', 2027).target_primarie_t === 99);

const gatim = riga('Gatim', 'imp', 2026, { target_totale_t: 950, target_primarie_t: 950 });
verifica('transizione: senza record attivo si usa il target scritto in Giacenze, e lo si dice', gatim.target_totale_t === 950 && gatim.da_portare.totale && gatim.record === null, JSON.stringify(gatim));
verifica('transizione: primarie senza raccoglitori, vale il vecchio campo e lo si dice', gatim.target_primarie_t === 950 && gatim.da_portare.primarie, JSON.stringify(gatim));

const nappi = riga('NAPPI SUD SRL', 'stoc', 2026, { target_totale_t: 5, target_primarie_t: 1 }, { primarieQui: true });
verifica('stoccaggio senza riga di impianto: nessun target totale, le primarie si', nappi.target_totale_t === 0 && nappi.target_primarie_t === 2295 && !nappi.da_portare.totale && !nappi.da_portare.primarie, JSON.stringify(nappi));
const irigomStoc = riga('Irigom S.r.l.', 'stoc', 2026, { target_primarie_t: 250 }, { primarieQui: false });
verifica('doppio ruolo: le primarie vanno su una riga sola, e il vecchio campo della riga dello stoccaggio non torna in gioco', irigomStoc.target_primarie_t === 0 && !irigomStoc.da_portare.primarie, JSON.stringify(irigomStoc));
const zero = targetRigaGiacenze({ sito: 'T.R.S. Srl', td: 'imp', anno: 2026, giacenzaSito: { target_totale_t: 2295 }, impiantiTarget: [{ nome_impianto: 'T.R.S. SRL', target: 0, stato: 'attivo', anno: 2026 }] });
verifica('un record attivo con target zero non cancella il target di Giacenze: si usa quello e lo si dice', zero.target_totale_t === 2295 && zero.da_portare.totale && !zero.da_portare.spento && zero.record?.nome_impianto === 'T.R.S. SRL', JSON.stringify(zero));
const vuoto = targetRigaGiacenze({ sito: 'T.R.S. Srl', td: 'imp', anno: 2026, giacenzaSito: {}, impiantiTarget: [{ nome_impianto: 'T.R.S. SRL', stato: 'attivo', anno: 2026 }] });
verifica('target zero e niente in Giacenze: nessun target e nessun avviso da portare', vuoto.target_totale_t === 0 && !vuoto.da_portare.totale, JSON.stringify(vuoto));
verifica('impianto spento in Target & Status con target in Giacenze: lo si dice', gatim.da_portare.spento === true && riga('Mai visto', 'imp', 2026, { target_totale_t: 5 }).da_portare.spento === false && /riattivalo/.test(testoTargetDaPortare('spento')));
verifica('un sito senza nome non ha target', riga('', 'imp', 2026).target_totale_t === 0 && riga('', 'imp', 2026).target_primarie_t === 0);
verifica('il testo dell\'anomalia dice dove portarlo', /Target & Status/.test(testoTargetDaPortare('totale')) && /ancora scritto in Giacenze/.test(testoTargetDaPortare('totale')) && /raccoglitori/.test(testoTargetDaPortare('primarie')));

// DUE SITUAZIONI DIVERSE, DUE AVVISI DIVERSI (04/10/2026).
//
// Il target delle primarie di un sito e' la somma dei target dei raccoglitori
// LEGATI a quel sito, cioe' delle righe che hanno scritto l'impianto. L'avviso
// diceva sempre «scrivi i target dei raccoglitori in Target & Status», anche
// quando quei target c'erano tutti - undicimilacinquecentocinquanta tonnellate,
// per raccoglitore e per regione - e mancava solo il collegamento all'impianto.
// L'utente e' andato a cercare un dato che aveva gia' scritto.
// UN SITO CON DUE RUOLI PUO' AVERE DUE TARGET DIVERSI (04/10/2026).
//
// T-Cycle ha il capannone e il piazzale, e in Giacenze sono due righe: l'utente
// vuole 1.050 t sull'impianto e 250 sul piazzale. Finche' il ruolo non si poteva
// scrivere, le due righe del target avevano lo stesso nome del sito e si
// sommavano tutte sulla riga dell'impianto: 1.300 di qua e zero di la'.
console.log('IL TARGET DI UN SITO CON DUE RUOLI');
{
  const dueRuoli = [
    { raccoglitore: 'Logistica', impianto: 'T-CYCLE INDUSTRIES SRL', ruolo: 'impianto', anno: 2026, target_tonnellate: 1050 },
    { raccoglitore: 'C.L. Service', impianto: 'T-Cycle Industries Srl', ruolo: 'stoccaggio', anno: 2026, target_tonnellate: 250 },
  ];
  const r = (td, extra = {}) => targetRigaGiacenze({ sito: 'T-CYCLE INDUSTRIES SRL', td, anno: 2026, impiantiTarget: [], raccoglitori: dueRuoli, ...extra });
  verifica('l\'impianto prende le sue 1.050 t', r('imp').target_primarie_t === 1050, JSON.stringify(r('imp')));
  verifica('e il piazzale le sue 250', r('stoc', { primarieQui: false }).target_primarie_t === 250, JSON.stringify(r('stoc', { primarieQui: false })));
  verifica('insieme fanno 1.300, e nessuna riga le conta tutte e due',
    r('imp').target_primarie_t + r('stoc', { primarieQui: false }).target_primarie_t === 1300);
  // Se di quel sito esistesse una riga sola, quella prende tutto: un target non
  // puo' restare senza casa.
  verifica('con una riga sola si prende tutto', r('imp', { soloRuolo: true }).target_primarie_t === 1300,
    JSON.stringify(r('imp', { soloRuolo: true })));
  // E le righe senza ruolo - quasi tutte - vanno dove andavano prima.
  const misto = [...dueRuoli, { raccoglitore: 'Altro', impianto: 'T-CYCLE INDUSTRIES SRL', anno: 2026, target_tonnellate: 100 }];
  verifica('una riga senza ruolo resta sull\'impianto',
    targetRigaGiacenze({ sito: 'T-CYCLE INDUSTRIES SRL', td: 'imp', anno: 2026, raccoglitori: misto }).target_primarie_t === 1150
    && targetRigaGiacenze({ sito: 'T-CYCLE INDUSTRIES SRL', td: 'stoc', anno: 2026, raccoglitori: misto, primarieQui: false }).target_primarie_t === 250);
  verifica('e se l\'impianto non c\'e\', va sul piazzale',
    targetRigaGiacenze({ sito: 'T-CYCLE INDUSTRIES SRL', td: 'stoc', anno: 2026, raccoglitori: misto, primarieQui: true, soloRuolo: true }).target_primarie_t === 1400);
}

console.log('QUALE DELLE DUE COSE MANCA');
{
  // Gatim: raccoglitori dell'anno ce ne sono (Alfa, Beta, Gamma), ma nessuno
  // porta il nome di Gatim.
  verifica('se i target ci sono ma nessuno e\' legato al sito, lo dice',
    gatim.da_portare.primarie === true && gatim.da_portare.primarie_senza_impianto === true,
    JSON.stringify(gatim.da_portare));
  // Un anno in cui di target dei raccoglitori non ce n'e' nemmeno uno.
  const vuoto = targetRigaGiacenze({
    sito: 'Gatim', td: 'imp', anno: 2026, giacenzaSito: { target_primarie_t: 950 },
    impiantiTarget: impianti, raccoglitori: [],
  });
  verifica('se non ce n\'e\' nessuno, e\' un altro avviso',
    vuoto.da_portare.primarie === true && vuoto.da_portare.primarie_senza_impianto === false,
    JSON.stringify(vuoto.da_portare));
  verifica('e un sito che il collegamento ce l\'ha non ha nessuno dei due avvisi',
    irigom.da_portare.primarie === false && irigom.da_portare.primarie_senza_impianto === false);
  verifica('i due testi dicono due cose diverse, e quello nuovo nomina l\'impianto da scrivere',
    /nessuno e' legato a questo sito/.test(testoTargetDaPortare('primarie_senza_impianto'))
    && /scrivi l'impianto/.test(testoTargetDaPortare('primarie_senza_impianto'))
    && /non c'e' nessun target dei raccoglitori/.test(testoTargetDaPortare('primarie')),
    testoTargetDaPortare('primarie_senza_impianto'));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
