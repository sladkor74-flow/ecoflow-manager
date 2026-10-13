// LA CLASSE DELL'ALBO CONTRO IL TARGET DEL RACCOGLITORE (base44/shared/
// classeAlbo.ts), segnalazione alta A66 del 20/09, corretta il 12/10/2026.
//
// La classe si leggeva solo nelle forme brevi: «Categoria 4: raccolta e
// trasporto ... - classe E» e «categoria 4 e 5 classe F» davano null, e con la
// classe non letta il controllo si saltava senza dirlo (un target di 3.200 t su
// una classe F passava). Qui: le forme vere prese dai provvedimenti e dalle
// visure dei fornitori, le letture che non si devono inventare, e l'avviso
// «controllo classe/target non eseguito» quando per un raccoglitore con target
// la classe non si legge da nessun documento. npm run prove
import * as C from '../base44/shared/classeAlbo.ts';
import { statoRequisito, leggiProblemi } from '../base44/shared/qualificaFornitori.ts';

// Il modulo si prende intero: col codice di prima la prova arriva in fondo e
// dice quali letture mancano, invece di fermarsi all'import.
const { classeCategoria4, applicaControlloClasse } = C;
const letturaClasseCategoria4 = C.letturaClasseCategoria4 || (() => ({ classe: null, lette: [] }));
const classeDaQuantita = C.classeDaQuantita || (() => null);

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('LE FORME CHE SI LEGGONO');
// Dall'archivio CONTRATTI SUBFORNITORI del 2026 (provvedimenti, visure, nomi dei
// file) e dalle due forme della segnalazione.
const FORME = [
  ['Categoria 4 classe E', 'E'],
  ['Categoria 4: raccolta e trasporto di rifiuti speciali non pericolosi - classe E', 'E'],
  ['categoria 4 e 5 classe F', 'F'],
  ['CATEGORIE 4 E 5 CLASSE F', 'F'],
  ['categoria 4 in classe D', 'D'],
  ['cat. 4 classe E fino al 16/03/2029, cat. 5 classe E fino al 20/11/2029', 'E'],
  ['Categoria 1 classe D; Categoria 4 classe F', 'F'],
  ['Categoria 4 (EER 16 01 03) classe E', 'E'],
  ['Categoria 4 dalla classe F alla classe E', 'E'],
  ['4 - F', 'F'],
  ['Cat. 4-F', 'F'],
  ['4F', 'F'],
  ['CAT.4F', 'F'],
  ['Cat. 4_E', 'E'],
  ['categoria 4B e 5C', 'B'],
  ['categorie 1-A, 4-A e 5-B', 'A'],
  ['categorie 1C, 4A, 5C, 6D, 8C', 'A'],
  // il provvedimento vero: la categoria scritta per esteso, la classe come quantita'
  ['Categoria: Raccolta e trasporto di rifiuti speciali non pericolosi\nClasse: quantità annua complessivamente trattata inferiore a 3.000 t.', 'F'],
  ['Categoria: Raccolta e trasporto di rifiuti speciali non pericolosi - Classe: quantità annua complessivamente trattata superiore o uguale a 6.000 t. e inferiore a 15.000 t.', 'D'],
  [['Categoria 4 - Raccolta e trasporto di rifiuti speciali non pericolosi', 'Classe F - quantità annua complessivamente trattata inferiore a 3.000 t'], 'F'],
  ['Categoria 4 classe A (quantità superiore o uguale a 200.000 t)', 'A'],
  // La variazione di classe vera (revisione del 13/10/2026): GREEN TYRE
  // PROJECT/2026/DOC/PA14396 Cat. 4_E.pdf, prot. 19235/2026 del 18/02/2026, col
  // pdftotext. Vale la classe nuova, la E, anche con la quantita' fra parentesi.
  [['Categoria 4 ord (Raccolta e trasporto di rifiuti speciali non pericolosi)', 'da Classe: F (quantità annua complessivamente trattata inferiore a 3.000 t.)', 'a Classe: E (quantità annua complessivamente trattata superiore o uguale a 3.000 t. e inferiore a 6.000 t.)'], 'E'],
  ['Categoria 4 ord (Raccolta e trasporto di rifiuti speciali non pericolosi) da Classe: F (quantità annua complessivamente trattata inferiore a 3.000 t.) a Classe: E (quantità annua complessivamente trattata superiore o uguale a 3.000 t. e inferiore a 6.000 t.)', 'E'],
  ['Categoria 4 ord (Raccolta e trasporto di rifiuti speciali non pericolosi)\nda Classe: F (quantità annua complessivamente trattata inferiore a 3.000 t.)\na Classe: E (quantità annua complessivamente trattata superiore o uguale a 3.000 t. e inferiore a 6.000 t.)', 'E'],
  ['Categoria 4 ord da Classe: F a Classe: E', 'E'],
];
for (const [forma, attesa] of FORME) {
  const letta = classeCategoria4(forma);
  verifica(`«${String(forma).replace(/\n/g, ' ').slice(0, 70)}» e' la ${attesa}`, letta === attesa, String(letta));
}

console.log('LE LETTURE CHE NON SI INVENTANO');
const NULLE = [
  'CATEGORIE 4 E 5',                     // la E e' la congiunzione
  'categorie 1, 4, 5, 8, 9, 10B',        // la B e' della 10
  'Albo categorie 1, 2 bis, 4 e 5',
  'categoria 4, categoria 5 classe C',   // la C e' della 5
  'CAT.4 PZ00090',
  'D.M. 120/2014 classe E',
  'Categoria 5: raccolta e trasporto di rifiuti speciali pericolosi - classe E',
  'Categoria 8 classe F',
  'CATEGORIA 4 E CATEGORIA 5 CLASSE F',  // la E e' la congiunzione, la F della 5 (13/10/2026)
  'categoria 4 e categoria 5 classe F',
  '',
];
for (const forma of NULLE) verifica(`«${forma}» non dice la classe della 4`, classeCategoria4(forma) === null, String(classeCategoria4(forma)));
const contrasto = letturaClasseCategoria4('Categoria 4 classe C; 4 - D');
verifica('due classi diverse per la 4: nessuna classe, e si sa quali', contrasto.classe === null && contrasto.lette.join() === 'C,D', JSON.stringify(contrasto));
verifica('la quantita\' dice la classe dal limite superiore', classeDaQuantita('inferiore a 3.000 t.') === 'F' && classeDaQuantita('superiore o uguale a 3.000 t. e inferiore a 6.000 t.') === 'E' && classeDaQuantita('superiore o uguale a 200.000 t.') === 'A' && classeDaQuantita('inferiore a 4.000 t.') === null);

console.log('IL CONFRONTO COL TARGET');
const ALBO = 'Iscrizione Albo Nazionale Gestori Ambientali';
const racc = { chiave: 'racc', ruoli: ['raccolta'] };
const impianto = { chiave: 'imp', ruoli: ['trattamento'] };
const docAlbo = (campi) => ({ id: 'a1', soggetto_chiave: 'racc', tipo_documento_id: 't-albo', tipo_documento_nome: ALBO, stato: 'attivo', analisi_stato: 'completata', problemi_json: '[]', ...campi });
const conLettura = (lettura) => JSON.stringify({ lettura: { leggibile: true, tipo_documento: 'Provvedimento di iscrizione all\'Albo Nazionale Gestori Ambientali', ...lettura } });
const problemiDi = (doc) => leggiProblemi(doc);
{
  // lo scenario della segnalazione
  const [d] = applicaControlloClasse([docAlbo({ analisi_json: conLettura({ categorie_albo: ['Categoria 4: raccolta e trasporto di rifiuti speciali non pericolosi - classe F'] }) })], [racc], [{ raccoglitore: 'racc', target_tonnellate: 3200 }], [], 2026);
  const p = problemiDi(d);
  verifica('3.200 t su una classe F scritta per esteso: bloccante', p.length === 1 && p[0].gravita === 'bloccante' && /3\.200,00 t/.test(p[0].messaggio) && /classe F/.test(p[0].messaggio), JSON.stringify(p));
}
{
  const [d] = applicaControlloClasse([docAlbo({ analisi_json: conLettura({ categorie_albo: ['Categoria: Raccolta e trasporto di rifiuti speciali non pericolosi - Classe: quantità annua complessivamente trattata inferiore a 3.000 t.'] }) })], [racc], [{ raccoglitore: 'racc', target_tonnellate: 2700 }], [], 2026);
  const p = problemiDi(d);
  verifica('2.700 t su una classe F scritta come quantita\': attenzione (90% del limite)', p.length === 1 && p[0].gravita === 'attenzione' && /90%/.test(p[0].messaggio), JSON.stringify(p));
}
{
  const [d] = applicaControlloClasse([docAlbo({ analisi_json: conLettura({ categorie_albo: ['Categoria 4'] }) })], [racc], [{ raccoglitore: 'racc', target_tonnellate: 2300 }], [], 2026);
  const p = problemiDi(d);
  verifica('classe non scritta, target 2.300 t: «controllo classe/target non eseguito»', p.length === 1 && p[0].gravita === 'attenzione' && /^Controllo classe\/target non eseguito/.test(p[0].messaggio), JSON.stringify(p));
  const m = p[0] ? p[0].messaggio : '';
  verifica('l\'avviso dice che cosa si e\' letto, il target e cosa fare', /letto: «Categoria 4»/.test(m) && /2\.300,00 t/.test(m) && /rianalizza/.test(m), m);
  const stato = statoRequisito({ nome: ALBO, tipo_scadenza: 'da_documento', preavviso_giorni: 90 }, { ...d, data_emissione: '2025-01-21', data_scadenza: '2030-01-21' }, '2026-10-12');
  verifica('l\'avviso non cambia lo stato del documento (resta valido): i conti del modulo non si muovono', stato.stato === 'valido' && stato.problemi.some(x => /non eseguito/.test(x.messaggio)), stato.stato);
}
{
  // due mesi diversi (lo stesso mese scritto due volte vale una, sotto)
  const [d] = applicaControlloClasse([docAlbo({})], [racc], [], [{ raccoglitore: 'racc', mese: 'Gennaio', anno: 2026, target: 100 }, { raccoglitore: 'racc', mese: 'Febbraio', anno: 2026, target: 150 }], 2026);
  const p = problemiDi(d);
  verifica('documento mai letto: l\'avviso lo dice, col target dei mesi', p.length === 1 && /non è ancora stato letto/.test(p[0].messaggio) && /250,00 t/.test(p[0].messaggio), JSON.stringify(p));
}
{
  const [d] = applicaControlloClasse([docAlbo({ analisi_json: conLettura({ categorie_albo: ['Categoria 4 classe C', '4 - D'] }) })], [racc], [{ raccoglitore: 'racc', target_tonnellate: 900 }], [], 2026);
  verifica('classi in contrasto: l\'avviso le nomina', /classi diverse per la categoria 4 \(C e D\)/.test(problemiDi(d)[0] && problemiDi(d)[0].messaggio), JSON.stringify(problemiDi(d)));
}
{
  const fermi = applicaControlloClasse([docAlbo({ analisi_json: conLettura({ categorie_albo: ['Categoria 4'] }) })], [racc], [{ raccoglitore: 'racc', target_tonnellate: 0 }], [], 2026);
  verifica('senza target non c\'e\' niente da confrontare: nessun avviso', problemiDi(fermi[0]).length === 0);
  const durc = { id: 'd1', soggetto_chiave: 'racc', tipo_documento_nome: 'DURC', problemi_json: '[]', analisi_json: JSON.stringify({ lettura: { tipo_documento: 'DURC' } }) };
  const [dDurc] = applicaControlloClasse([durc], [racc], [{ raccoglitore: 'racc', target_tonnellate: 2300 }], [], 2026);
  verifica('un DURC non porta l\'avviso della classe', problemiDi(dDurc).length === 0);
  const visura = { id: 'v1', soggetto_chiave: 'racc', tipo_documento_nome: 'Visura camerale', problemi_json: '[]', analisi_json: JSON.stringify({ lettura: { tipo_documento: 'Visura camerale', categorie_albo: ['cat. 4 classe E fino al 16/03/2029'] } }) };
  const [dAlbo, dVisura] = applicaControlloClasse([docAlbo({ analisi_json: conLettura({ categorie_albo: ['Categoria 4'] }) }), visura], [racc], [{ raccoglitore: 'racc', target_tonnellate: 2300 }], [], 2026);
  verifica('se la classe si legge da un altro documento il controllo e\' eseguito: niente avviso', problemiDi(dAlbo).length === 0 && problemiDi(dVisura).length === 0, JSON.stringify([problemiDi(dAlbo), problemiDi(dVisura)]));
  const imp = { ...docAlbo({ analisi_json: conLettura({ categorie_albo: ['Categoria 4'] }) }), soggetto_chiave: 'imp' };
  const [dImp] = applicaControlloClasse([imp], [racc, impianto], [{ raccoglitore: 'imp', target_tonnellate: 2300 }], [], 2026);
  verifica('chi non raccoglie resta fuori dal controllo', problemiDi(dImp).length === 0);
  const salvato = docAlbo({ analisi_json: conLettura({ categorie_albo: ['Categoria 4'] }) });
  applicaControlloClasse([salvato], [racc], [{ raccoglitore: 'racc', target_tonnellate: 2300 }], [], 2026);
  verifica('il documento salvato non si tocca', salvato.problemi_json === '[]');
}

console.log('LA VARIAZIONE DI CLASSE CONTRO IL TARGET (revisione del 13/10/2026)');
{
  // Il provvedimento della variazione da F a E di Green Tyre, copiato riga per
  // riga in categorie_albo come chiede il prompt: si leggeva la F, e con 3.200 t
  // il provvedimento stesso chiedeva la variazione con un bloccante.
  const variazione = FORME.find(([f]) => Array.isArray(f) && /da Classe: F/.test(f[1]))[0];
  const gt = { ...docAlbo({ analisi_json: conLettura({ categorie_albo: variazione }) }), soggetto_chiave: 'green tyre project' };
  const soggetti = [{ chiave: 'green tyre project', ruoli: ['raccolta'] }];
  const [d3200] = applicaControlloClasse([gt], soggetti, [{ raccoglitore: 'Green Tyre Project', target_tonnellate: 3200 }], [], 2026);
  verifica('3.200 t sulla variazione a classe E: nessun bloccante', problemiDi(d3200).length === 0, JSON.stringify(problemiDi(d3200)));
  const [d2550] = applicaControlloClasse([gt], soggetti, [{ raccoglitore: 'Green Tyre Project', target_tonnellate: 2550 }], [], 2026);
  verifica('2.550 t sulla variazione a classe E: nessuna attenzione dell\'85% della F', problemiDi(d2550).length === 0, JSON.stringify(problemiDi(d2550)));
  const [d5200] = applicaControlloClasse([gt], soggetti, [{ raccoglitore: 'Green Tyre Project', target_tonnellate: 5200 }], [], 2026);
  verifica('5.200 t: l\'attenzione e\' quella della classe E, la nuova', problemiDi(d5200).length === 1 && /classe E/.test(problemiDi(d5200)[0].messaggio) && /87%/.test(problemiDi(d5200)[0].messaggio), JSON.stringify(problemiDi(d5200)));
}

console.log('IL TARGET MENSILE SCRITTO DUE VOLTE VALE UNA (revisione del 13/10/2026)');
{
  // Target & Status, l'Andamento, gli avvisi ed EcoTyna prendono l'ultimo
  // modificato (targetMensiliValidi); la classe dell'Albo sommava i due.
  const targetAnnuoSoggetto = C.targetAnnuoSoggetto;
  const riga = (mese, target, il, extra = {}) => ({ raccoglitore: 'Racc', regione: 'Puglia', impianto: 'Irigom', ruolo: 'raccolta', mese, anno: 2026, target, updated_date: il, ...extra });
  const mensili = [
    riga('Gennaio', 2000, '2026-01-05T09:00:00Z'),
    riga('Febbraio', 1400, '2026-02-02T09:00:00Z'),
    riga('Gennaio', 1000, '2026-01-20T09:00:00Z'),  // la correzione di gennaio
  ];
  verifica('gennaio scritto due volte vale l\'ultimo: 1.000 + 1.400 = 2.400 t, non 4.400', targetAnnuoSoggetto('racc', [], mensili) === 2400, String(targetAnnuoSoggetto('racc', [], mensili)));
  const altroImpianto = [...mensili, riga('Gennaio', 300, '2026-01-21T09:00:00Z', { impianto: 'Tecnogum' })];
  verifica('lo stesso mese verso un altro impianto e\' un altro target e si somma', targetAnnuoSoggetto('racc', [], altroImpianto) === 2700, String(targetAnnuoSoggetto('racc', [], altroImpianto)));
  const albo = docAlbo({ analisi_json: conLettura({ categorie_albo: ['Categoria 4 classe F'] }) });
  const [d] = applicaControlloClasse([albo], [racc], [], mensili, 2026);
  verifica('classe F con 2.400 t veri: nessun bloccante della variazione (con la somma erano 4.400 t)', problemiDi(d).length === 0, JSON.stringify(problemiDi(d)));
}

console.log('IL REN NON E\' L\'ALBO GESTORI (revisione del 13/10/2026)');
{
  // La voce del catalogo proposto dal 21/09 e la lettura di un'iscrizione REN:
  // nessuna categoria, nessuna classe. L'avviso della classe non letta va solo
  // sul documento dell'Albo gestori ambientali.
  const REN = "Iscrizione all'Albo autotrasportatori conto terzi (REN)";
  const LETTO_REN = "Iscrizione all'Albo nazionale delle persone fisiche e giuridiche che esercitano l'autotrasporto di cose per conto di terzi";
  const target = [{ raccoglitore: 'racc', target_tonnellate: 2300 }];
  const albo = docAlbo({ analisi_json: conLettura({ categorie_albo: ['Categoria 4'] }) });
  const ren = { id: 'ren', soggetto_chiave: 'racc', tipo_documento_nome: REN, problemi_json: '[]', analisi_json: JSON.stringify({ lettura: { tipo_documento: LETTO_REN, categorie_albo: [] } }) };
  const [dAlbo, dRen] = applicaControlloClasse([albo, ren], [racc], target, [], 2026);
  verifica('con l\'Albo e il REN l\'avviso va solo sull\'Albo', problemiDi(dAlbo).length === 1 && /non eseguito/.test(problemiDi(dAlbo)[0].messaggio) && problemiDi(dRen).length === 0, JSON.stringify([problemiDi(dAlbo), problemiDi(dRen)]));
  const [soloRen] = applicaControlloClasse([ren], [racc], target, [], 2026);
  verifica('il REN da solo non porta l\'avviso della classe', problemiDi(soloRen).length === 0, JSON.stringify(problemiDi(soloRen)));
  const [renMaiLetto] = applicaControlloClasse([{ ...ren, analisi_json: null }], [racc], target, [], 2026);
  verifica('nemmeno il REN mai letto', problemiDi(renMaiLetto).length === 0, JSON.stringify(problemiDi(renMaiLetto)));
  // Un nome generico si giudica da cio' che il file e': un provvedimento
  // dell'Albo gestori resta tale anche nella casella senza «gestori».
  const generico = { ...docAlbo({ analisi_json: conLettura({ categorie_albo: ['Categoria 4'] }) }), tipo_documento_nome: "Iscrizione all'Albo" };
  const [dGenerico] = applicaControlloClasse([generico], [racc], target, [], 2026);
  verifica('casella generica con dentro l\'Albo gestori: l\'avviso resta', problemiDi(dGenerico).length === 1 && /non eseguito/.test(problemiDi(dGenerico)[0].messaggio), JSON.stringify(problemiDi(dGenerico)));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
