// Prova dell'anno dei dati di Target & Status (base44/shared/annoTarget.ts,
// 27/09/2026): il piano della copia di un anno dal precedente, il target delle
// primarie di un sito, il target dell'impianto di esattamente quell'anno, gli
// anni chiusi. npm run prove
import { annoDelRecord, annoCorrenteRoma, annoChiuso, recordDellAnno, pianoCopiaAnno, conteggiPiano, targetPrimarieDelSito, targetImpiantoDellAnno, notaCopia, daConfermare, senzaNotaCopia, conNotaCopia } from '../base44/shared/annoTarget.ts';
import { normalizzaRagioneSociale as chiave } from '../base44/shared/normalizzaRagioneSociale.ts';
import { regolePredittivita } from '../base44/shared/regolePredittivita.ts';
import { fineProgrammazione, avvisoFineProgrammazione } from '../base44/shared/fineProgrammazione.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);

// --- l'anno di un record, gli anni chiusi
verifica('un record senza anno vale il 2026', annoDelRecord({}) === 2026 && annoDelRecord(null) === 2026 && annoDelRecord({ anno: 2027 }) === 2027 && annoDelRecord({ anno: '2025' }) === 2025);
verifica('recordDellAnno tiene quelli senza anno nel 2026', J(recordDellAnno([{ id: 1 }, { id: 2, anno: 2027 }, { id: 3, anno: 2026 }], 2026).map(r => r.id)) === '[1,3]');
const corrente = annoCorrenteRoma();
verifica('l\'anno prima e\' chiuso, quello in corso e il prossimo no', annoChiuso(corrente - 1) && !annoChiuso(corrente) && !annoChiuso(corrente + 1) && !annoChiuso(String(corrente)));
{
  const DataVera = Date;
  const istante = Date.parse('2026-12-31T23:30:00Z'); // a Roma e' gia' il 2027
  globalThis.Date = class extends DataVera { constructor(...a) { super(...(a.length ? a : [istante])); } static now() { return istante; } };
  try {
    verifica('l\'anno si conta sull\'ora italiana', annoCorrenteRoma() === 2027 && annoChiuso(2026));
  } finally { globalThis.Date = DataVera; }
}

// --- il piano della copia: il 2026 (con record senza anno) diventa il 2027
const sorgente = {
  impianti: [
    { id: 'iT', nome_impianto: 'T-CYCLE INDUSTRIES SRL', target: 1050000, totale_capacity_kg: 1300000, regione: 'Puglia', data_fine: '2026-12-18', data_inizio: '2026-01-01', stato: 'attivo', note: 'doppio ruolo' },
    { id: 'iG', nome_impianto: 'Tecnogum Srl', target: 500000, stato: 'attivo', anno: 2026 },
    { id: 'iI', nome_impianto: 'Irigom Srl', target: 800000, stato: 'attivo' },
    { id: 'iGT', nome_impianto: 'GREEN TYRE PROJECT SRL', target: 2500000, stato: 'attivo', segue_predittivita: false },
    { id: 'iX', nome_impianto: 'Impianto Spento', target: 1, stato: 'non_attivo' },
    { id: 'i25', nome_impianto: 'Vecchio 2025', target: 1, anno: 2025 },
  ],
  fornitori: [
    { id: 'fN1', nome: 'Nappi Sud', impianto_id: 'iG', impianto_nome: 'Tecnogum Srl', ruolo: 'stoccaggio', plafond_stoccaggio_kg: 400000, stato: 'attivo' },
    { id: 'fN2', nome: 'Nappi Sud', impianto_id: 'iI', impianto_nome: 'Irigom Srl', ruolo: 'stoccaggio', plafond_stoccaggio_kg: 400000, stato: 'attivo' },
    { id: 'fT', nome: 'T-Cycle', impianto_id: 'iG', impianto_nome: 'Tecnogum Srl', ruolo: 'doppio_ruolo', plafond_stoccaggio_kg: 250000, stato: 'attivo', priorita: 3 },
    { id: 'fC', nome: 'C.L. Service', impianto_id: 'iI', impianto_nome: 'Irigom Srl', ruolo: 'raccoglitore', stato: 'attivo' },
    { id: 'fO', nome: 'Orfano', impianto_id: 'nessuno', ruolo: 'stoccaggio', stato: 'attivo' },
    { id: 'fS', nome: 'Verso lo spento', impianto_id: 'iX', ruolo: 'stoccaggio', stato: 'attivo' },
    { id: 'fZ', nome: 'Spento', impianto_id: 'iI', ruolo: 'stoccaggio', stato: 'non_attivo' },
  ],
  raccoglitori: [
    { id: 'r1', raccoglitore: 'C.L. Service', impianto: 'Irigom Srl', anno: 2026, target_tonnellate: 300, attivo_dal: '2026-03-01', storico_json: J([{ il: 'x', nota: 'vecchia' }]) },
    { id: 'r2', raccoglitore: 'SMOCO S.r.l.', regione: 'Puglia', anno: 2026, target_tonnellate: 120 },
    { id: 'r3', raccoglitore: 'Altro', anno: 2025, target_tonnellate: 999 },
  ],
  mensili: [
    { id: 'm1', raccoglitore: 'C.L. Service', regione: 'Puglia', impianto: 'Irigom Srl', mese: 'Gennaio', anno: 2026, target: 25, raccolto: 20, delta: 5 },
    { id: 'm2', raccoglitore: 'C.L. Service', regione: 'Puglia', impianto: 'Irigom Srl', mese: 'Febbraio', target: 25, non_raccoglie: true },
  ],
  commessa: [{ id: 'c1', anno: 2026, target_annuo_t: 30000, regioni_json: '[]', kg_per_viaggio: 14000, fine_programmazione: '2026-12-18', storico_json: '[1]', created_date: '2026-01-01' }],
  siti: [
    { id: 's1', sito: 'TECNOGUM SRL', tipo_destinazione: 'imp', anno: 2026, dichiara_rete: false, tipologia_trattamento: 'EoW', target_totale_t: 2305, target_primarie_t: 800, giacenza_riferimento_t: 10, giacenza_riferimento_aci_t: 2, note: 'x' },
    { id: 's2', sito: 'T-CYCLE INDUSTRIES SRL', tipo_destinazione: 'stoc', anno: 2026, dichiara_rete: true },
  ],
};
const regolePrecedenti = regolePredittivita(2026);
const piano = pianoCopiaAnno({ anno: 2027, sorgente, esistenti: sorgente, regolePrecedenti, chiave, il: '2026-12-20T10:00:00Z', da: 'Admin' });

verifica('si copiano solo gli impianti attivi dell\'anno prima', J(piano.impianti.map(i => i.nome_impianto).sort()) === J(['GREEN TYRE PROJECT SRL', 'Irigom Srl', 'T-CYCLE INDUSTRIES SRL', 'Tecnogum Srl']), J(piano.impianti));
const tc = piano.impianti.find(i => /CYCLE/.test(i.nome_impianto));
verifica('l\'impianto copiato porta target, capacita\', regione, note, anno e stato attivo', tc.target === 1050000 && tc.totale_capacity_kg === 1300000 && tc.regione === 'Puglia' && tc.note === 'copiato dal 2026, da confermare · doppio ruolo' && tc.anno === 2027 && tc.stato === 'attivo', J(tc));
verifica('la data di fine (e d\'inizio) dell\'anno prima non si copia', piano.impianti.every(i => !('data_fine' in i) && !('data_inizio' in i) && !('id' in i)));
verifica('segui in predittivita\': falso resta falso, vuoto diventa vero', piano.impianti.find(i => /GREEN/.test(i.nome_impianto)).segue_predittivita === false && tc.segue_predittivita === true);
verifica('saltati: un impianto spento', piano.saltati.impianti_non_attivi === 1, J(piano.saltati));

const col = (nome, imp) => piano.collegamenti.find(c => c.nome === nome && c.impianto_chiave === imp);
verifica('i collegamenti puntano alla chiave dell\'impianto, non al vecchio id', piano.collegamenti.every(c => !('impianto_id' in c) && !('id' in c)) && !!col('Nappi Sud', 'tecnogum') && !!col('Nappi Sud', 'irigom'), J(piano.collegamenti));
verifica('priorita\' esplicita dalle regole dell\'anno prima: Nappi Sud prima Tecnogum, poi Irigom', col('Nappi Sud', 'tecnogum').priorita === 1 && col('Nappi Sud', 'irigom').priorita === 2);
verifica('la priorita\' scritta vale piu\' delle regole', col('T-Cycle', 'tecnogum').priorita === 3);
verifica('un raccoglitore non ha priorita\'', col('C.L. Service', 'irigom').priorita === null);
verifica('il collegamento porta plafond, ruolo, anno', col('Nappi Sud', 'tecnogum').plafond_stoccaggio_kg === 400000 && col('Nappi Sud', 'tecnogum').ruolo === 'stoccaggio' && col('Nappi Sud', 'tecnogum').anno === 2027 && col('Nappi Sud', 'tecnogum').stato === 'attivo');
verifica('saltati: gli orfani (impianto che non c\'e\' o spento) e quelli spenti', piano.collegamenti.length === 4 && piano.saltati.collegamenti_orfani === 2 && piano.saltati.collegamenti_non_attivi === 1, J(piano.saltati));

verifica('target dei raccoglitori: solo l\'anno prima, con l\'anno nuovo', piano.raccoglitori.length === 2 && piano.raccoglitori.every(r => r.anno === 2027) && !piano.raccoglitori.some(r => r.raccoglitore === 'Altro'));
const r1 = piano.raccoglitori.find(r => r.raccoglitore === 'C.L. Service');
const storico = JSON.parse(r1.storico_json);
verifica('lo storico riparte da una riga sola: copiato, da confermare', storico.length === 1 && storico[0].nota === 'copiato dal 2026, da confermare' && storico[0].da === 'Admin' && storico[0].il === '2026-12-20T10:00:00Z' && storico[0].prima === null && notaCopia(2027) === storico[0].nota, r1.storico_json);
verifica('il giorno d\'inizio del contratto dell\'anno prima non si copia', !('attivo_dal' in r1) && r1.target_tonnellate === 300 && r1.impianto === 'Irigom Srl');
verifica('target mensili: anche quelli senza anno (2026), senza i numeri calcolati', piano.mensili.length === 2 && piano.mensili.every(m => m.anno === 2027 && !('raccolto' in m) && !('delta' in m)) && piano.mensili.find(m => m.mese === 'Febbraio').non_raccoglie === true && piano.mensili.find(m => m.mese === 'Gennaio').target === 25, J(piano.mensili));

verifica('il contratto si copia con l\'anno nuovo e lo storico azzerato', piano.commessa && piano.commessa.anno === 2027 && piano.commessa.target_annuo_t === 30000 && !('id' in piano.commessa) && JSON.parse(piano.commessa.storico_json).length === 1, J(piano.commessa));
verifica('del contratto non si copia la fine della programmazione, si copiano i kg a viaggio', !('fine_programmazione' in piano.commessa) && piano.commessa.kg_per_viaggio === 14000);

const s1 = piano.siti.find(s => s.sito === 'TECNOGUM SRL');
verifica('i siti delle giacenze: ruolo e dichiarazioni si\', target e riferimenti no', piano.siti.length === 2 && s1.dichiara_rete === false && s1.tipologia_trattamento === 'EoW' && s1.tipo_destinazione === 'imp' && s1.anno === 2027 && !('target_totale_t' in s1) && !('target_primarie_t' in s1) && !('giacenza_riferimento_t' in s1) && !('giacenza_riferimento_aci_t' in s1), J(s1));
verifica('conteggi del piano', J(conteggiPiano(piano)) === J({ impianti: 4, collegamenti: 4, raccoglitori: 2, mensili: 2, commessa: 1, siti: 2 }), J(conteggiPiano(piano)));

verifica('ogni record copiato porta la nota da confermare', piano.impianti.every(daConfermare) && piano.collegamenti.every(daConfermare) && piano.raccoglitori.every(daConfermare) && piano.mensili.every(daConfermare) && piano.siti.every(daConfermare) && daConfermare(piano.commessa));
verifica('la nota della copia: si toglie per confermare, non si accumula anno dopo anno', senzaNotaCopia('copiato dal 2026, da confermare · doppio ruolo') === 'doppio ruolo' && senzaNotaCopia(notaCopia(2027)) === '' && conNotaCopia('copiato dal 2026, da confermare · x', 2028) === 'copiato dal 2027, da confermare · x' && !daConfermare({ note: 'x' }) && !daConfermare({ storico_json: J([{ nota: notaCopia(2027) }, { nota: 'target annuo' }]) }));

// --- ripetere la copia (interrotta a meta'): completa solo quello che manca
const copiato = (r) => ({ ...r, ...(r.raccoglitore || r.commessa ? { storico_json: J([{ nota: notaCopia(2027) }]) } : { note: notaCopia(2027) }) });
const esistenti = {
  impianti: [...sorgente.impianti, copiato({ id: 'n1', nome_impianto: 'TECNOGUM SRL', target: 600000, anno: 2027, stato: 'attivo' })],
  fornitori: [...sorgente.fornitori, copiato({ id: 'nf', nome: 'NAPPI SUD SRL', impianto_id: 'n1', impianto_nome: 'TECNOGUM SRL', ruolo: 'stoccaggio', anno: 2027, stato: 'attivo' })],
  raccoglitori: [...sorgente.raccoglitori, copiato({ raccoglitore: 'C.L. SERVICE', impianto: 'IRIGOM SRL', anno: 2027, target_tonnellate: 1 })],
  mensili: [...sorgente.mensili, copiato({ raccoglitore: 'C.L. Service', regione: 'puglia', impianto: 'Irigom', mese: 'gennaio', anno: 2027 })],
  commessa: [...sorgente.commessa, { anno: 2027 }],
  siti: [copiato({ sito: 'Tecnogum', tipo_destinazione: 'imp', anno: 2027 })],
};
const p2 = pianoCopiaAnno({ anno: 2027, sorgente, esistenti, regolePrecedenti, chiave });
verifica('ripetuta: salta l\'impianto che l\'anno ha gia\' (stesso nome, scritto diverso)', p2.impianti.length === 3 && !p2.impianti.some(i => chiave(i.nome_impianto) === 'tecnogum') && p2.saltati.impianti_esistenti === 1, J(p2.saltati));
verifica('ripetuta: salta il collegamento che c\'e\' gia\', tiene gli altri', p2.collegamenti.length === 3 && !p2.collegamenti.some(c => c.nome === 'Nappi Sud' && c.impianto_chiave === 'tecnogum') && p2.saltati.collegamenti_esistenti === 1);
verifica('ripetuta: salta raccoglitori, mesi, contratto e siti gia\' presenti', p2.raccoglitori.length === 1 && p2.mensili.length === 1 && p2.commessa === null && p2.saltati.commessa_esistente === 1 && p2.siti.length === 1 && p2.siti[0].tipo_destinazione === 'stoc', J(p2.saltati));
const tutto = { impianti: [...esistenti.impianti, ...p2.impianti], fornitori: [...esistenti.fornitori, ...p2.collegamenti.map(({ impianto_chiave, ...c }) => ({ ...c, impianto_nome: impianto_chiave }))], raccoglitori: [...esistenti.raccoglitori, ...p2.raccoglitori], mensili: [...esistenti.mensili, ...p2.mensili], commessa: esistenti.commessa, siti: [...esistenti.siti, ...p2.siti] };
const p3 = pianoCopiaAnno({ anno: 2027, sorgente, esistenti: tutto, regolePrecedenti, chiave });
verifica('una terza volta non c\'e\' piu\' niente da copiare', J(conteggiPiano(p3)) === J({ impianti: 0, collegamenti: 0, raccoglitori: 0, mensili: 0, commessa: 0, siti: 0 }), J(conteggiPiano(p3)));
verifica('un anno prima vuoto: piano vuoto', J(conteggiPiano(pianoCopiaAnno({ anno: 2030, sorgente, esistenti: {}, regolePrecedenti: {}, chiave }))) === J({ impianti: 0, collegamenti: 0, raccoglitori: 0, mensili: 0, commessa: 0, siti: 0 }));
verifica('un contratto passato da solo (non in lista) si copia lo stesso', pianoCopiaAnno({ anno: 2027, sorgente: { commessa: sorgente.commessa[0] }, esistenti: {}, chiave }).commessa?.anno === 2027);

// --- un anno gia' compilato a mano (l'anno in corso) non si inquina
{
  const aMano = {
    impianti: [...sorgente.impianti, { id: 'h1', nome_impianto: 'Tecnogum Srl', target: 1, anno: 2027, stato: 'attivo' }],
    fornitori: [...sorgente.fornitori, { id: 'hf', nome: 'Altro stoccaggio', impianto_id: 'h1', ruolo: 'stoccaggio', anno: 2027, stato: 'attivo' }],
    raccoglitori: [...sorgente.raccoglitori, { raccoglitore: 'Nuovo nome', impianto: 'Irigom', anno: 2027, target_tonnellate: 5, storico_json: J([{ nota: notaCopia(2027) }, { nota: 'target annuo' }]) }],
    mensili: [...sorgente.mensili, { raccoglitore: 'Nuovo nome', regione: 'Puglia', impianto: 'Irigom', mese: 'Gennaio', anno: 2027 }],
    commessa: sorgente.commessa,
    siti: [{ sito: 'Irigom', tipo_destinazione: 'imp', anno: 2027 }],
  };
  const pm = pianoCopiaAnno({ anno: 2027, sorgente, esistenti: aMano, regolePrecedenti, chiave });
  verifica('anno compilato a mano: niente impianti, collegamenti, raccoglitori, mesi e siti dell\'anno prima', pm.impianti.length === 0 && pm.collegamenti.length === 0 && pm.raccoglitori.length === 0 && pm.mensili.length === 0 && pm.siti.length === 0, J(conteggiPiano(pm)));
  verifica('anno compilato a mano: lo dice, categoria per categoria', pm.saltati.impianti_gia_compilati === 3 && pm.saltati.impianti_esistenti === 1 && pm.saltati.raccoglitori_gia_compilati === 2 && pm.saltati.mensili_gia_compilati === 2 && pm.saltati.siti_gia_compilati === 2 && pm.saltati.collegamenti_gia_compilati === 4, J(pm.saltati));
  verifica('anno compilato a mano: il contratto si copia se manca', pm.commessa && pm.commessa.anno === 2027);
}

// --- il target scritto solo in Giacenze l'anno prima non si perde
{
  const s2 = {
    impianti: [
      { id: 'z', nome_impianto: 'T.R.S. SRL', target: 0, stato: 'attivo', anno: 2026 },
      { id: 'sp', nome_impianto: 'Spento Srl', target: 0, stato: 'non_attivo', anno: 2026 },
      { id: 'ok', nome_impianto: 'Tecnogum', target: 500000, stato: 'attivo', anno: 2026 },
    ],
    siti: [
      { sito: 'GREEN TYRE PROJECT SRL', tipo_destinazione: 'imp', anno: 2026, target_totale_t: 2500 },
      { sito: 'T.R.S. Srl', tipo_destinazione: 'imp', anno: 2026, target_totale_t: 300.5 },
      { sito: 'Spento', tipo_destinazione: 'imp', anno: 2026, target_totale_t: 10 },
      { sito: 'Tecnogum', tipo_destinazione: 'imp', anno: 2026, target_totale_t: 999 },
      { sito: 'Uno stoccaggio', tipo_destinazione: 'stoc', anno: 2026, target_totale_t: 50 },
    ],
  };
  const pg = pianoCopiaAnno({ anno: 2027, sorgente: s2, esistenti: {}, chiave });
  const di = (re) => pg.impianti.find(i => re.test(i.nome_impianto));
  verifica('solo Giacenze: nasce l\'impianto col target di Giacenze, in kg, senza predittivita\'', di(/GREEN/)?.target === 2500000 && di(/GREEN/).segue_predittivita === false && di(/GREEN/).anno === 2027 && daConfermare(di(/GREEN/)), J(pg.impianti));
  verifica('solo Giacenze: un impianto con target zero prende quello di Giacenze', di(/T\.R\.S/)?.target === 300500 && di(/T\.R\.S/).segue_predittivita === false);
  verifica('solo Giacenze: il target di Target & Status vince, lo spento resta spento, lo stoccaggio non conta', di(/Tecnogum/)?.target === 500000 && di(/Tecnogum/).segue_predittivita === true && !di(/Spento/) && !di(/stoccaggio/) && pg.impianti.length === 3 && pg.daGiacenze === 2, J(pg));
}

// --- un collegamento senza id valido si lega per nome, come nella predittivita'
{
  const s3 = {
    impianti: [{ id: 'nuovoId', nome_impianto: 'Irigom Srl', target: 1, stato: 'attivo', anno: 2026 }],
    fornitori: [
      { nome: 'Senza id', impianto_nome: 'IRIGOM S.R.L.', ruolo: 'stoccaggio', stato: 'attivo', anno: 2026 },
      { nome: 'Id cancellato', impianto_id: 'vecchio', impianto_nome: 'Irigom', ruolo: 'stoccaggio', stato: 'attivo', anno: 2026 },
      { nome: 'Davvero orfano', impianto_id: 'vecchio', impianto_nome: 'Nessuno', ruolo: 'stoccaggio', stato: 'attivo', anno: 2026 },
    ],
  };
  const pc = pianoCopiaAnno({ anno: 2027, sorgente: s3, esistenti: {}, chiave });
  verifica('collegamento per nome: senza id o con l\'id di un impianto cancellato', pc.collegamenti.length === 2 && pc.collegamenti.every(c => c.impianto_chiave === 'irigom') && pc.saltati.collegamenti_orfani === 1, J(pc));
}

// --- target delle primarie di un sito
const racc = [
  { raccoglitore: 'A', impianto: 'Tecnogum Srl', anno: 2026, target_tonnellate: 500 },
  { raccoglitore: 'B', impianto: 'TECNOGUM S.R.L.', anno: 2026, target_tonnellate: 300.25 },
  { raccoglitore: 'C', impianto: 'Tecnogum', anno: 2027, target_tonnellate: 999 },
  { raccoglitore: 'D', impianto: 'Irigom', anno: 2026, target_tonnellate: 7 },
  { raccoglitore: 'E', anno: 2026, target_tonnellate: 11 },
];
verifica('target primarie: la somma dei raccoglitori di quel sito e di quell\'anno', targetPrimarieDelSito(racc, 'TECNOGUM SRL', 2026, chiave) === 800.25 && targetPrimarieDelSito(racc, 'Tecnogum', 2027, chiave) === 999 && targetPrimarieDelSito(racc, 'Nessuno', 2026, chiave) === 0 && targetPrimarieDelSito(racc, '', 2026, chiave) === 0);

// --- target dell'impianto di esattamente quell'anno
const imp = [
  { id: 'a', nome_impianto: 'Tecnogum', target: 2295000, stato: 'attivo' },
  { id: 'b', nome_impianto: 'TECNOGUM SRL', target: 2400000, stato: 'attivo', anno: 2027, updated_date: '2027-01-02' },
  { id: 'c', nome_impianto: 'Tecnogum Srl', target: 2500000, stato: 'attivo', anno: 2027, updated_date: '2027-02-01' },
  { id: 'd', nome_impianto: 'Tecnogum', target: 1, stato: 'non_attivo', anno: 2027, updated_date: '2027-03-01' },
  { id: 'e', nome_impianto: 'Irigom', target: 800000, stato: 'non_attivo', anno: 2026 },
];
const t26 = targetImpiantoDellAnno(imp, 'TECNOGUM S.R.L.', 2026, chiave);
verifica('un record senza anno vale il 2026', t26 && t26.kg === 2295000 && t26.record.id === 'a', J(t26));
const t27 = targetImpiantoDellAnno(imp, 'Tecnogum', 2027, chiave);
verifica('piu\' record attivi dello stesso anno: il modificato per ultimo, mai lo spento', t27 && t27.kg === 2500000 && t27.record.id === 'c', J(t27));
verifica('nessun ripiego su un altro anno', targetImpiantoDellAnno(imp, 'Tecnogum', 2028, chiave) === null && targetImpiantoDellAnno(imp, 'Tecnogum', 2025, chiave) === null);
verifica('un impianto spento non ha target', targetImpiantoDellAnno(imp, 'Irigom', 2026, chiave) === null && targetImpiantoDellAnno(imp, '', 2026, chiave) === null);

// --- la fine della programmazione e i kg a viaggio dal contratto dell'anno
verifica('fine programmazione: senza contratto come prima', J(fineProgrammazione(2026)) === J({ data: '2026-12-18', definita: true }) && J(fineProgrammazione(2027)) === J({ data: '2027-12-31', definita: false }) && avvisoFineProgrammazione(2027) !== '' && avvisoFineProgrammazione(2026) === '');
verifica('fine programmazione: il contratto dell\'anno vince', J(fineProgrammazione(2027, { anno: 2027, fine_programmazione: '2027-12-17' })) === J({ data: '2027-12-17', definita: true }) && avvisoFineProgrammazione(2027, { anno: 2027, fine_programmazione: '2027-12-17' }) === '' && fineProgrammazione(2026, { anno: 2026, fine_programmazione: '2026-12-11' }).data === '2026-12-11');
verifica('fine programmazione: una data di un altro anno o il contratto di un altro anno non contano', fineProgrammazione(2027, { anno: 2027, fine_programmazione: '2026-12-17' }).definita === false && fineProgrammazione(2027, { anno: 2026, fine_programmazione: '2027-12-17' }).definita === false && fineProgrammazione(2026, { fine_programmazione: '' }).data === '2026-12-18');
const r27 = regolePredittivita(2027, { anno: 2027, kg_per_viaggio: 14500 });
verifica('kg a viaggio: senza contratto come prima', regolePredittivita(2026).kg_per_viaggio === 13000 && regolePredittivita(2026).definite === true && regolePredittivita(2027).definite === false && regolePredittivita(2027).kg_per_viaggio === 13000);
verifica('kg a viaggio: il contratto dell\'anno vince e rende l\'anno definito', r27.kg_per_viaggio === 14500 && r27.definite === true && regolePredittivita(2026, { anno: 2026, kg_per_viaggio: 12000 }).kg_per_viaggio === 12000 && J(regolePredittivita(2026, { anno: 2026, kg_per_viaggio: 12000 }).priorita) === J(regolePredittivita(2026).priorita));
verifica('kg a viaggio: vuoto, zero o di un altro anno non contano', regolePredittivita(2026, { anno: 2026 }).kg_per_viaggio === 13000 && regolePredittivita(2027, { anno: 2027, kg_per_viaggio: 0 }).definite === false && regolePredittivita(2027, { anno: 2026, kg_per_viaggio: 9000 }).kg_per_viaggio === 13000);

console.log(`\n${ok} verifiche riuscite, ${ko} fallite`);
process.exit(ko ? 1 : 0);
