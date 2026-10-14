// ECOTYNA CERCA NEL MODULO GIUSTO (richiesta dell'utente del 14/10/2026).
//
// Parole dell'utente: «oggi ho provato a chiederle circa gli ordini aperti in
// una determinata provincia e lei mi ha risposto erroneamente perche' pescava
// tra le 'richieste ect' e non tra gli assegnati». Gli ordini aperti stanno negli
// Assegnati (Rete, o ACI per i demolitori), i chiusi nei Terminati (Rete, ACI,
// Extra Raccolta), le secondarie e le terziarie nei loro moduli, il fatturato di
// un fornitore nella passiva; le Richieste ECT sono solo le richieste arrivate
// via email. Nessuno strumento leggeva gli Assegnati, e il pianificatore prendeva
// il nome che somigliava di piu': «richieste» -> richieste_ect.
//
// Il pianificatore vero e' un modello e non e' deterministico: questa prova
// controlla quello che lo e'.
//   1. la mappa delle domande fra le REGOLE del pianificatore (istruzioniPiano);
//   2. il catalogo: ogni voce della mappa ha uno strumento capace, coi filtri
//      giusti (provincia, PDR, periodo, stato, canale) e l'etichetta in chat;
//   3. la BATTERIA: domande scritte come le scrive l'utente, errori di battitura
//      compresi; per ognuna la guardia dopo il pianificatore (correggiPiano)
//      porta allo strumento giusto coi filtri giusti partendo dal piano
//      sbagliato, lascia stare il piano giusto, e il testo che arriva al
//      pianificatore porta la regola della mappa; piu' le domande che la guardia
//      NON deve toccare;
//   4. gli strumenti sui dati veri dell'11/10/2026 (se la copia c'e'), contro i
//      moduli: Terminati Rete (matrice per provincia, campo PDR), Secondarie
//      (computeSecondarieMatrix), Terziarie (la pagina montata);
//   5. gli Assegnati come la pagina (computeAssegnatiMatrix), su un archivio
//      costruito e, se c'e', su quello ricavato dal file PRIMARIE.xlsx di
//      ECOTYRE (sola lettura): gli aperti di Siracusa sono quelli della pagina;
//   6. il perche' della guardia arriva a «Dove ho guardato»;
//   7. la revisione del 14/10/2026: la guardia non toglie gli ordini chiusi
//      scelti bene, non legge una provincia dentro il nome di un raccoglitore,
//      non impone un canale negato, aggiunto o che e' un comune (Aci
//      Sant'Antonio), non riempie un piano vuoto su una domanda di procedura e
//      legge gli intervalli di mesi; un comune che non si riconosce non fa zero.
// Controprova: col codice di prima la domanda su Siracusa finisce sulle
// Richieste ECT (sezione 3) e gli strumenti degli ordini non ci sono; col codice
// della prima consegna (prima della revisione) falliscono le verifiche della 7.
// node prove/ecotynaModuliGiusti.mjs
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';
import { caricaPagina, clienteFinto, aspetta, trova } from './dati/paginaFinta.mjs';

const R = new URL('../base44/shared/', import.meta.url).href;
const P = await import(R + 'pianoAssistente.ts');
const S = await import(R + 'strumentiAssistente.ts');
const { provinciaChiesta } = await import(R + 'province.ts');
const { computeProvinceMatrixData } = await import(R + 'primarieReteAnalytics.ts');
const { SHEET_MAP } = await import(R + 'excelSchemas.ts');
const { archivioPrimaria, recordAssegnato, dataPrimaria, DATE_PRIMARIE } = await import(R + 'primarie.ts');
const { etaArretrato } = await import(R + 'cruscotto.ts');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + String(extra).slice(0, 700)); } };
const J = (v) => String(JSON.stringify(v)).slice(0, 600);
const OGGI = '2026-10-14';
const catalogo = S.catalogoStrumenti();
const strumento = (nome) => S.STRUMENTI.find(s => s.nome === nome);
const CHIAVE = P.CHIAVE_SCELTA || '__scelta_corretta';
const senzaR = (s) => String(s || '').replace(/\r/g, '');

console.log('1. LA MAPPA FRA LE REGOLE DEL PIANIFICATORE');
const istruzioni = (domanda) => senzaR(P.istruzioniPiano(catalogo, domanda, OGGI));
{
  const righe = istruzioni('quanti ordini aperti ci sono a Siracusa?').split('\n');
  const regole = righe.slice(righe.indexOf('Regole:') + 1, righe.indexOf('Strumenti disponibili:'));
  const regola = (re) => regole.find(r => re.test(r)) || '';
  verifica('la mappa e\' esportata e ogni sua riga e\' fra le regole', Array.isArray(P.MAPPA_DOMANDE) && P.MAPPA_DOMANDE.length >= 6 && P.MAPPA_DOMANDE.every(m => regole.includes(m)), J(P.MAPPA_DOMANDE));
  verifica('ordini APERTI -> ordini_aperti, gli Assegnati, RETE e ACI per i demolitori',
    /ORDINI APERTI.*ordini_aperti.*Assegnati.*RETE.*ACI.*demolitori.*autodemoli/.test(regola(/ORDINI APERTI/)), regola(/ORDINI APERTI/));
  verifica('ordini CHIUSI -> ordini_chiusi, i Terminati, sul giorno di fine trasporto, col PDR',
    /ORDINI CHIUSI.*se e quando.*ultimo ritiro di un PDR.*ordini_chiusi.*Terminati Rete.*Terminati ACI.*Extra Raccolta.*fine trasporto.*pdr/.test(regola(/ORDINI CHIUSI/)), regola(/ORDINI CHIUSI/));
  verifica('secondarie e terziarie aperte o chiuse ai loro strumenti, la predittivita\' resta la sua',
    /SECONDARIE e TERZIARIE.*aperte o chiuse.*secondarie e terziarie.*proiezione_secondarie/.test(regola(/SECONDARIE e TERZIARIE/)), regola(/SECONDARIE/));
  verifica('il fatturato di un fornitore -> fatturazione PASSIVA col fornitore, Ecotyre -> ATTIVA',
    /FATTURATO.*fatturazione con tipo PASSIVA e fornitore.*riservato.*fatturazione con tipo ATTIVA/.test(regola(/FATTURATO/)), regola(/FATTURATO/));
  const ect = regola(/RICHIESTE ECT/);
  verifica('le Richieste ECT SOLO per le richieste via email, MAI per ordini aperti o chiusi',
    /richieste_ect SOLO se la domanda parla di richieste arrivate via email/.test(ect) && /MAI per «ordini aperti», «ordini chiusi», «richieste aperte» o «richieste chiuse»/.test(ect), ect);
  verifica('la regola del contratto resta la prima a nominare contratto_ecotyre (pianoContrattoEcotyre)',
    regole.findIndex(r => r.includes('contratto_ecotyre')) < regole.findIndex(r => r.startsWith('- DOVE SI CERCA')), '');
  verifica('la domanda arriva in fondo, dopo il catalogo', righe[righe.length - 1] === 'quanti ordini aperti ci sono a Siracusa?');
}

console.log('2. IL CATALOGO HA UNO STRUMENTO CAPACE PER OGNI VOCE DELLA MAPPA');
{
  const ha = (nome, parametri, moduli = []) => {
    const s = catalogo.find(x => x.nome === nome);
    verifica(`${nome} c'e', coi filtri ${parametri.join(', ')}`, !!s && parametri.every(k => s.parametri && k in s.parametri), J(s && Object.keys(s.parametri)));
    if (moduli.length) verifica(`${nome} legge ${moduli.join(', ')}`, !!s && moduli.every(m => s.moduli.includes(m)), J(s && s.moduli));
  };
  ha('ordini_aperti', ['canale', 'provincia', 'comune', 'pdr', 'raccoglitore', 'regione', 'classe', 'da_almeno_giorni'], ['Assegnati Rete', 'Assegnati ACI']);
  ha('ordini_chiusi', ['canale', 'anno', 'mese', 'mesi', 'provincia', 'comune', 'pdr', 'raccoglitore', 'destinazione'], ['Terminati Rete', 'Terminati ACI', 'Extra Raccolta']);
  ha('secondarie', ['stato', 'canale', 'destinazione', 'origine', 'trasportatore', 'anno', 'mese', 'mesi'], ['Secondarie']);
  ha('terziarie', ['stato', 'destinazione', 'origine', 'trasportatore', 'anno', 'mese', 'mesi'], ['Terziarie']);
  ha('fatturazione', ['tipo', 'fornitore', 'mese', 'mesi', 'tipologia'], ['Fatturazione']);
  ha('cerca_movimento', ['testo'], ['Assegnati Rete', 'Assegnati ACI']);
  const ect = catalogo.find(x => x.nome === 'richieste_ect');
  verifica('richieste_ect dice di essere SOLO le richieste via email e rimanda agli ordini', !!ect && /SOLO le Richieste ECT/.test(ect.descrizione) && /VIA EMAIL/.test(ect.descrizione) && /ordini_aperti/.test(ect.descrizione) && /ordini_chiusi/.test(ect.descrizione), ect && ect.descrizione);
  const aperti = catalogo.find(x => x.nome === 'ordini_aperti');
  verifica('ordini_aperti non prende anno ne\' mese: il periodo del piano non deve togliere gli aperti di prima', !!aperti && !('anno' in aperti.parametri) && !('mese' in aperti.parametri) && !('mesi' in aperti.parametri));
  const schema = P.SCHEMA_PIANO.properties.strumenti.items.properties.parametri.properties;
  verifica('il pianificatore puo\' scrivere pdr, comune, trasportatore, classe e da_almeno_giorni', ['pdr', 'comune', 'trasportatore', 'classe', 'da_almeno_giorni'].every(k => k in schema), J(Object.keys(schema)));
  const chat = senzaR(readFileSync(new URL('../src/components/assistente/ChatAssistente.jsx', import.meta.url), 'utf8'));
  const etichette = (chat.match(/const ETICHETTE_STRUMENTO = \{([\s\S]*?)\n\};/) || ['', ''])[1];
  for (const n of ['ordini_aperti', 'ordini_chiusi', 'secondarie', 'terziarie']) verifica(`in chat ${n} ha la sua etichetta`, new RegExp(`\\b${n}: '`).test(etichette));
}

console.log('3. LA BATTERIA: LA GUARDIA E IL TESTO DEL PIANIFICATORE PORTANO AL MODULO GIUSTO');
// Il piano sbagliato di default e' quello del caso vero: le Richieste ECT.
const ECT = [{ nome: 'richieste_ect', parametri: { anno: 2026, stato: 'aperta' } }];
const MESI3 = ['Luglio', 'Agosto', 'Settembre'];
const BATTERIA = [
  // ordini aperti, rete
  { q: 'quanti ordini aperti ci sono a Siracusa?', a: 'ordini_aperti', p: { canale: 'RETE', provincia: 'SR' } },
  { q: 'quanti ordini ci sono aperti sulla provincia di Siracusa', a: 'ordini_aperti', p: { canale: 'RETE', provincia: 'SR' } },
  { q: 'quanti ordni apetri ci sono a siracusa', a: 'ordini_aperti', p: { canale: 'RETE', provincia: 'SR' } },
  { q: 'ordini aperti in provincia di Bari', a: 'ordini_aperti', p: { canale: 'RETE', provincia: 'BA' } },
  { q: 'richieste aperte a Cosenza', a: 'ordini_aperti', p: { canale: 'RETE', provincia: 'CS' } },
  { q: 'quante richieste da ritirare ci sono a Napoli?', a: 'ordini_aperti', p: { canale: 'RETE', provincia: 'NA' } },
  { q: 'quali ordini sono ancora in attesa a Lecce?', a: 'ordini_aperti', p: { canale: 'RETE', provincia: 'LE' } },
  { q: 'ordini aperti da piu di 60 giorni a Taranto', a: 'ordini_aperti', p: { canale: 'RETE', provincia: 'TA' } },
  { q: 'il PDR 42872 ha ordini aperti?', a: 'ordini_aperti', p: { canale: 'RETE', pdr: '42872' } },
  { q: 'quanti ordini non sono ancora stati ritirati a Salerno?', a: 'ordini_aperti', p: { canale: 'RETE', provincia: 'SA' } },
  { q: "com'e' l'arretrato degli ordini in Calabria?", a: 'ordini_aperti', p: { canale: 'RETE' }, sbagliato: [{ nome: 'panoramica_commessa', parametri: {} }] },
  { q: 'quanti ordini aperti ha Emmesse?', a: 'ordini_aperti', p: { canale: 'RETE', raccoglitore: 'Emmesse' }, sbagliato: [{ nome: 'raccolto', parametri: { raccoglitore: 'Emmesse', canale: 'RETE' } }] },
  // ordini aperti, demolitori (ACI)
  { q: 'ordini aperti degli autodemolitori in provincia di Bari', a: 'ordini_aperti', p: { canale: 'ACI', provincia: 'BA' } },
  { q: 'quanti demolitori aspettano il ritiro a Catania?', a: 'ordini_aperti', p: { canale: 'ACI', provincia: 'CT' } },
  { q: 'richieste aci aperte a Reggio Calabria', a: 'ordini_aperti', p: { canale: 'ACI', provincia: 'RC' } },
  { q: "quanti ordini aperti ha l'autodemolizione di Avellino", a: 'ordini_aperti', p: { canale: 'ACI', provincia: 'AV' }, sbagliato: [{ nome: 'ordini_aperti', parametri: { canale: 'RETE', provincia: 'Avellino' } }] },
  // ordini chiusi
  { q: "quando è stato chiuso l'ultimo ritiro del PDR 42872?", a: 'ordini_chiusi', p: { canale: 'RETE', pdr: '42872' } },
  { q: 'quante richieste chiuse a Cosenza da luglio a settembre?', a: 'ordini_chiusi', p: { canale: 'RETE', provincia: 'CS', mesi: MESI3 } },
  { q: 'quanti ritiri abbiamo fatto a Potenza ad agosto?', a: 'ordini_chiusi', p: { canale: 'RETE', provincia: 'PZ', mese: 'Agosto' } },
  { q: 'ordini terminati a Napoli a settembre', a: 'ordini_chiusi', p: { canale: 'RETE', provincia: 'NA', mese: 'Settembre' } },
  { q: 'il pdr 315 è stato ritirato?', a: 'ordini_chiusi', p: { canale: 'RETE', pdr: '315' } },
  { q: "quante richieste evase in provincia di Bari quest'anno?", a: 'ordini_chiusi', p: { canale: 'RETE', provincia: 'BA' } },
  { q: 'ordini chiusi degli autodemolitori a Salerno a luglio', a: 'ordini_chiusi', p: { canale: 'ACI', provincia: 'SA', mese: 'Luglio' } },
  { q: 'quanti ordini ha chiuso Emmesse a settembre?', a: 'ordini_chiusi', p: { canale: 'RETE', mese: 'Settembre' }, sbagliato: [{ nome: 'punti_di_raccolta', parametri: { cerca: 'Emmesse' } }] },
  { q: "l'ultimo ritiro del pdr 42872 quando e stato fatto", a: 'ordini_chiusi', p: { canale: 'RETE', pdr: '42872' } },
  { q: 'ordini chisui tra luglio e settembre a cosenza', a: 'ordini_chiusi', p: { canale: 'RETE', provincia: 'CS', mesi: MESI3 } },
  // aperti e chiusi insieme: due strumenti
  { q: 'quanti ordini aperti e quanti chiusi a Siracusa?', a: ['ordini_aperti', 'ordini_chiusi'], p: { canale: 'RETE', provincia: 'SR' } },
  // secondarie e terziarie
  { q: 'secondarie aperte verso Irigom', a: 'secondarie', p: { stato: 'aperte', destinazione: 'irigom' } },
  { q: 'quante secondarie chiuse verso Gatim a settembre?', a: 'secondarie', p: { stato: 'chiuse', destinazione: 'gatim', mese: 'Settembre' } },
  { q: 'secondarie da Nappi Sud ad agosto', a: 'secondarie', p: { origine: 'nappi sud', mese: 'Agosto' }, sbagliato: [{ nome: 'raccolto', parametri: { canale: 'RETE' } }] },
  { q: 'terziarie di settembre', a: 'terziarie', p: { mese: 'Settembre' } },
  { q: 'quante terziarie sono partite da Irigom a luglio?', a: 'terziarie', p: { origine: 'irigom', mese: 'Luglio' } },
  { q: 'secondarie aci aperte', a: 'secondarie', p: { stato: 'aperte', canale: 'ACI' } },
  { q: 'terzirie aperte', a: 'terziarie', p: { stato: 'aperte' } },
  // fatturato
  { q: 'quanto ha fatturato Emmesse da giugno a settembre?', a: 'fatturazione', p: { tipo: 'PASSIVA', fornitore: 'emmesse', mesi: ['Giugno', ...MESI3] }, sbagliato: [{ nome: 'raccolto', parametri: { raccoglitore: 'Emmesse', canale: 'RETE' } }] },
  { q: 'fatturato di Green Tyre ad agosto', a: 'fatturazione', p: { tipo: 'PASSIVA', fornitore: 'green tyre', mese: 'Agosto' }, sbagliato: [{ nome: 'tariffe', parametri: { fornitore: 'Green Tyre' } }] },
  { q: 'quanto abbiamo pagato a Nappi Sud a settembre?', a: 'fatturazione', p: { tipo: 'PASSIVA', fornitore: 'nappi sud', mese: 'Settembre' }, sbagliato: [{ nome: 'panoramica_commessa', parametri: {} }] },
  { q: 'quanto abbiamo fatturato a Ecotyre ad agosto?', a: 'fatturazione', p: { tipo: 'ATTIVA', mese: 'Agosto' } },
  { q: 'quanto ci spetta da ecotyre per settembre', a: 'fatturazione', p: { tipo: 'ATTIVA', mese: 'Settembre' }, sbagliato: [{ nome: 'ordini_chiusi', parametri: { canale: 'RETE' } }] },
  { q: 'quanto ha fatturato Emmesse ad agosto?', a: 'fatturazione', p: { tipo: 'PASSIVA', fornitore: 'emmesse', mese: 'Agosto' }, sbagliato: [{ nome: 'fatturazione', parametri: { tipo: 'ATTIVA' } }] },
  // le Richieste ECT, quelle vere: arrivate via email
  { q: 'quante richieste ci sono arrivate via mail questa settimana?', a: 'richieste_ect', p: {}, sbagliato: [{ nome: 'ordini_aperti', parametri: { canale: 'RETE' } }] },
  { q: 'richieste ECT scadute', a: 'richieste_ect', p: {}, sbagliato: [{ nome: 'ordini_aperti', parametri: { canale: 'RETE' } }] },
  { q: 'ci sono richieste nuove nella posta?', a: 'richieste_ect', p: {}, sbagliato: [{ nome: 'panoramica_commessa', parametri: {} }] },
  { q: 'quante richieste di ritiro ci ha mandato il consorzio per email a ottobre?', a: 'richieste_ect', p: {}, sbagliato: [{ nome: 'ordini_chiusi', parametri: { canale: 'RETE' } }] },
  // il contratto (il primo caso del 14/10/2026) e un ID ordine
  { q: "Qual è oggi il target annuo 2026 del contratto Ecotyre sulla rete, e com'è messa la Puglia rispetto all'atteso?", a: 'contratto_ecotyre', p: { regione: 'Puglia' }, sbagliato: [{ nome: 'target_raccoglitori', parametri: { anno: 2026 } }] },
  { q: "l'ordine ET26165067 è stato chiuso?", a: 'cerca_movimento', p: { testo: 'ET26165067' } },
  // La revisione del 14/10/2026. Ordini fatti, gestiti, serviti: chiusi, anche
  // sopra un ordini_aperti scelto dal pianificatore.
  { q: 'quanti ordini ha fatto Emmesse a settembre?', a: 'ordini_chiusi', p: { canale: 'RETE', mese: 'Settembre' } },
  { q: 'quanti ordini ha fatto Emmesse a settembre?', a: 'ordini_chiusi', p: { canale: 'RETE', mese: 'Settembre', raccoglitore: 'Emmesse' }, sbagliato: [{ nome: 'ordini_aperti', parametri: { canale: 'RETE', raccoglitore: 'Emmesse' } }] },
  { q: 'quanti ordini abbiamo fatto a Cosenza ad agosto?', a: 'ordini_chiusi', p: { canale: 'RETE', provincia: 'CS', mese: 'Agosto' } },
  { q: 'quante richieste abbiamo servito in provincia di Bari nel 2025?', a: 'ordini_chiusi', p: { canale: 'RETE', provincia: 'BA' } },
  { q: "quanti ordini ha gestito Green Tyre quest'anno?", a: 'ordini_chiusi', p: { canale: 'RETE', raccoglitore: 'Green Tyre' }, sbagliato: [{ nome: 'raccolto', parametri: { canale: 'RETE', raccoglitore: 'Green Tyre' } }] },
  // Ordini con un periodo e senza «aperti» ne' «chiusi»: chiusi.
  { q: 'quanti ordini a Siracusa a settembre?', a: 'ordini_chiusi', p: { canale: 'RETE', provincia: 'SR', mese: 'Settembre' } },
  // Una sigla dentro il nome di un raccoglitore non e' una provincia; Aci Sant'Antonio e' un comune.
  { q: "Quanti ritiri ha fatto CL Service quest'anno?", a: 'ordini_chiusi', p: { canale: 'RETE', raccoglitore: 'CL Service' }, assenti: ['provincia'], sbagliato: [{ nome: 'raccolto', parametri: { canale: 'RETE', raccoglitore: 'CL Service' } }] },
  { q: "Quanti ritiri abbiamo fatto ad Aci Sant'Antonio quest'anno?", a: 'ordini_chiusi', p: { canale: 'RETE', comune: "Aci Sant'Antonio" }, sbagliato: [{ nome: 'raccolto', parametri: { canale: 'RETE', comune: "Aci Sant'Antonio" } }] },
  { q: 'ordini aperti ACI BA', a: 'ordini_aperti', p: { canale: 'ACI', provincia: 'BA' } },
  // I mesi di un intervallo scritto in tutti i modi.
  { q: 'quante richieste chiuse a Cosenza luglio-settembre?', a: 'ordini_chiusi', p: { canale: 'RETE', provincia: 'CS', mesi: MESI3 } },
  { q: 'ordini chiusi a Cosenza dal 1 luglio al 30 settembre', a: 'ordini_chiusi', p: { canale: 'RETE', provincia: 'CS', mesi: MESI3 } },
  { q: 'quanti ordini chiusi a Cosenza da luglio a oggi?', a: 'ordini_chiusi', p: { canale: 'RETE', provincia: 'CS', mesi: [...MESI3, 'Ottobre'] } },
  { q: 'quanto ha fatturato Emmesse da luglio a oggi?', a: 'fatturazione', p: { tipo: 'PASSIVA', fornitore: 'emmesse', mesi: [...MESI3, 'Ottobre'] }, sbagliato: [{ nome: 'raccolto', parametri: { raccoglitore: 'Emmesse', canale: 'RETE' } }] },
];
const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const stessoValore = (k, v, atteso) => {
  if (k === 'provincia') return (provinciaChiesta(v) || {}).sigla === atteso;
  if (Array.isArray(atteso)) return Array.isArray(v) && v.length === atteso.length && v.every((x, i) => norm(x) === norm(atteso[i]));
  return norm(v) === norm(atteso);
};
const conParametri = (s, p, assenti = []) => Object.entries(p).every(([k, v]) => stessoValore(k, s.parametri[k], v)) && assenti.every(k => s.parametri[k] === undefined);
verifica(`almeno 40 domande nella batteria (${BATTERIA.length})`, BATTERIA.length >= 40);
let corrette = 0;
for (const b of BATTERIA) {
  const attesi = [].concat(b.a);
  const sbagliato = { strumenti: b.sbagliato || ECT, canali: ['RETE'], periodo: { anno: 2026 } };
  const scelti = P.strumentiDalPiano(sbagliato, catalogo, OGGI, b.q);
  const nomi = [...new Set(scelti.map(s => s.nome))];
  const giusti = attesi.every(n => scelti.some(s => s.nome === n && conParametri(s, b.p, b.assenti)));
  const soloGiusti = nomi.every(n => attesi.includes(n));
  if (giusti && soloGiusti) corrette++;
  verifica(`«${b.q}»: dal piano sbagliato (${(b.sbagliato || ECT).map(x => x.nome).join(', ')}) a ${attesi.join(' e ')} coi filtri ${J(b.p)}`, giusti && soloGiusti, J(scelti.map(s => [s.nome, s.parametri])));
  const conNota = scelti.filter(s => attesi.includes(s.nome)).every(s => /scelto al posto|aggiunto|il canale e'|la domanda chiede/.test(String(s.parametri[CHIAVE] || '')));
  verifica(`«${b.q}»: lo strumento messo dalla guardia porta il perche' per «Dove ho guardato»`, conNota, J(scelti.map(s => s.parametri[CHIAVE])));
  // Il piano giusto resta com'e': la guardia corregge, non ripianifica.
  const giusto = { strumenti: attesi.map(n => ({ nome: n, parametri: { ...b.p } })), periodo: { anno: 2026 } };
  const ancora = P.strumentiDalPiano(giusto, catalogo, OGGI, b.q);
  verifica(`«${b.q}»: il piano giusto non si tocca`, !ancora.correzioni && attesi.every(n => ancora.some(s => s.nome === n && conParametri(s, b.p, b.assenti))) && ancora.every(s => attesi.includes(s.nome)), J([ancora.correzioni, ancora.map(s => [s.nome, s.parametri])]));
  // E il pianificatore riceve la regola della mappa per quello strumento.
  const testo = istruzioni(b.q);
  const regolaDi = {
    ordini_aperti: /ORDINI APERTI[^\n]*ordini_aperti/, ordini_chiusi: /ORDINI CHIUSI[^\n]*ordini_chiusi/, secondarie: /SECONDARIE e TERZIARIE[^\n]*secondarie e terziarie/,
    terziarie: /SECONDARIE e TERZIARIE[^\n]*secondarie e terziarie/, fatturazione: /FATTURATO[^\n]*fatturazione con tipo/, richieste_ect: /RICHIESTE ECT: richieste_ect SOLO/,
    contratto_ecotyre: /Contratto, target annuo e atteso: contratto_ecotyre/, cerca_movimento: /un ID ordine o un formulario: cerca_movimento/,
  };
  verifica(`«${b.q}»: il testo del pianificatore porta la regola di ${attesi.join(' e ')}`, attesi.every(n => regolaDi[n].test(testo)) && testo.endsWith(b.q));
}
console.log(`  ${corrette} domande su ${BATTERIA.length} arrivano al modulo giusto dal piano sbagliato`);
// Il caso vero, a parte, perche' la controprova lo dice per nome.
{
  const siracusa = P.strumentiDalPiano({ strumenti: ECT }, catalogo, OGGI, 'Quanti ordini ci sono aperti sulla provincia di Siracusa?');
  verifica('IL CASO VERO: la domanda su Siracusa non finisce sulle Richieste ECT', !siracusa.some(s => s.nome === 'richieste_ect') && siracusa[0] && siracusa[0].nome === 'ordini_aperti', J(siracusa.map(s => s.nome)));
}

console.log('   LE DOMANDE CHE LA GUARDIA NON DEVE TOCCARE');
{
  const FERME = [
    { q: 'quanti alert aperti ci sono?', s: [{ nome: 'alert_aperti', parametri: {} }] },
    { q: 'quanto resta da dichiarare a Irigom?', s: [{ nome: 'riepilogo_dichiarazioni', parametri: { sito: 'Irigom' } }] },
    { q: 'che obblighi ha il produttore sul formulario?', s: [] },
    { q: 'quante richieste ECT sono scadute?', s: [{ nome: 'richieste_ect', parametri: { stato: 'scaduta' } }] },
    { q: 'come va la proiezione delle secondarie verso Irigom?', s: [{ nome: 'proiezione_secondarie', parametri: {} }] },
    { q: 'quanto abbiamo raccolto a Bari ad agosto?', s: [{ nome: 'raccolto', parametri: { canale: 'RETE', provincia: 'Bari', mese: 'Agosto' } }] },
    { q: 'qual è la tariffa di raccolta di Emmesse?', s: [{ nome: 'tariffe', parametri: { fornitore: 'Emmesse', prestazione: 'RACCOLTA' } }] },
    { q: 'chi è sotto target questo mese?', s: [{ nome: 'target_raccoglitori', parametri: {} }] },
    { q: 'quanti punti di raccolta abbiamo in provincia di Bari?', s: [{ nome: 'punti_di_raccolta', parametri: { provincia: 'Bari' } }] },
    { q: 'secondarie di settembre nel report mensile', s: [{ nome: 'report_mensile', parametri: { pivot: 'secondarieRete', mese: 'Settembre' } }] },
    { q: "che differenza c'è tra un ordine eseguito e uno terminato?", s: [] },
    { q: 'quanti formulari abbiamo chiuso nella settimana 38?', s: [{ nome: 'settimana_formulari', parametri: { settimana: 38 } }] },
    { q: 'ordini cancellati a Bari a settembre', s: [{ nome: 'cerca_movimento', parametri: { testo: 'Bari' } }] },
    { q: 'quanto abbiamo raccolto in tutto quest\'anno?', s: [{ nome: 'raccolto', parametri: {} }] },
    { q: "Come stiamo con il contratto in Campania rispetto all'atteso a oggi?", s: [{ nome: 'contratto_ecotyre', parametri: { regione: 'Campania' } }] },
  ];
  for (const f of FERME) {
    const scelti = P.strumentiDalPiano({ strumenti: f.s, periodo: { anno: 2026 } }, catalogo, OGGI, f.q);
    verifica(`«${f.q}»: la guardia non cambia il piano`, !scelti.correzioni && JSON.stringify([...new Set(scelti.map(s => s.nome))]) === JSON.stringify(f.s.map(s => s.nome)), J([scelti.correzioni, scelti.map(s => s.nome)]));
  }
  // Un piano non riuscito resta non riuscito: chi chiama ripiega sul riepilogo e lo dice.
  verifica('un piano non riuscito (null) resta senza strumenti', P.strumentiDalPiano(null, catalogo, OGGI, 'quanti ordini aperti ci sono a Siracusa?').length === 0);
}

// ─── gli strumenti sui dati veri ───
// La copia dell'11/10/2026, fuori dal repository (un'altra cartella con DATI_VERI, come prove/datiVeri.mjs).
const COPIA = process.env.DATI_VERI
  ? `${process.env.DATI_VERI.replace(/[\\/]+$/, '')}/treadrider-dati-veri-2026-10-11.json.gz`
  : new URL('../../dati-veri/treadrider-dati-veri-2026-10-11.json.gz', import.meta.url);
const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => (v === null ? (r[k] == null || r[k] === '') : r[k] === v));
const sdk = (archivi) => ({ asServiceRole: { entities: new Proxy({}, { get: (_t, n) => ({
  filter: async (f, _o, lim = 5000, skip = 0) => (archivi[n] || []).filter(r => uguale(r, f)).slice(skip, skip + lim).map(r => ({ ...r })),
  list: async (_o, lim = 5000, skip = 0) => (archivi[n] || []).slice(skip, skip + lim).map(r => ({ ...r })),
}) }) } });
const esegui = async (nome, p, base44) => { const s = strumento(nome); return s ? s.esegui(base44, p, null) : null; };

console.log('4. GLI STRUMENTI SUI DATI VERI, CONTRO I MODULI');
// Gli archivi veri, se ci sono: li usa anche la sezione 7.
let VERI = null;
if (!existsSync(COPIA)) {
  console.log('  (copia dei dati veri assente: sezione saltata)');
} else {
  const DATI = JSON.parse(gunzipSync(readFileSync(COPIA)).toString('utf8'));
  const A = DATI.archivi;
  VERI = A;
  const b44 = sdk(A);
  // La matrice per provincia dei Terminati Rete (computeProvinceMatrixData).
  const matrice = computeProvinceMatrixData(A.PrimariaRete, 9);
  const cs = matrice.province.find(x => x.provincia === 'CS');
  const csLugSet = cs ? MESI3.reduce((s, m) => s + cs.mesi[m], 0) : null;
  const chiusiCs = await esegui('ordini_chiusi', { canale: 'RETE', anno: 2026, provincia: 'Cosenza', mesi: MESI3 }, b44);
  verifica('le richieste chiuse a Cosenza da luglio a settembre sono quelle della matrice dei Terminati Rete', !!chiusiCs && chiusiCs.dati.ordini === csLugSet && csLugSet > 0, J([chiusiCs && chiusiCs.dati.ordini, csLugSet]));
  const racc = await esegui('raccolto', { canale: 'RETE', anno: 2026, provincia: 'Cosenza', mesi: MESI3 }, b44);
  verifica('...con formulari e tonnellate del raccolto sulle stesse righe', !!chiusiCs && chiusiCs.dati.formulari === racc.dati.formulari && chiusiCs.dati.tonnellate === racc.dati.tonnellate, J([chiusiCs && [chiusiCs.dati.formulari, chiusiCs.dati.tonnellate], [racc.dati.formulari, racc.dati.tonnellate]]));
  verifica('...mese per mese', !!chiusiCs && chiusiCs.dati.per === 'mese' && MESI3.every(m => (chiusiCs.dati.dettaglio.righe.find(x => x.nome === m) || {}).ordini === cs.mesi[m]), J(chiusiCs && chiusiCs.dati.dettaglio));
  console.log(`  Cosenza, rete, luglio-settembre 2026: ${csLugSet} ordini chiusi (${chiusiCs && chiusiCs.dati.tonnellate} t)`);

  // Il PDR 42872: due ordini finiti lo stesso 07/10/2026.
  const pdr = await esegui('ordini_chiusi', { canale: 'RETE', anno: 2026, pdr: '42872' }, b44);
  const u = pdr && pdr.dati.ultimo_ritiro_nel_periodo;
  verifica('l\'ultimo ritiro del PDR 42872: 07/10/2026, due ordini', !!u && u.fine_trasporto === '2026-10-07' && u.ordini === 2 && ['ET26165067', 'ET26165079'].every(id => u.id_ordine.includes(id)), J(u));
  verifica('...e dice di quale punto si parla', !!pdr && pdr.dati.pdr_riconosciuto && pdr.dati.pdr_riconosciuto[0].pdr === 42872 && /LAVELLO/.test(pdr.dati.pdr_riconosciuto[0].nome), J(pdr && pdr.dati.pdr_riconosciuto));
  // La regola del PDR e' quella del campo dei Terminati Rete, ordine per ordine.
  const { modulo: cercaPdr } = await caricaPagina('components/shared/CercaPdr');
  const terminati = A.PrimariaRete.filter(r => r.stato === 'terminato');
  const domandePdr = ['42872', 'PDR 42872', '315', 'eurogomme lavello', 'mastria', 'pneus', 'gomme service', 'abruzzo gomme'];
  for (const testo of domandePdr) {
    const pagina = terminati.filter(r => cercaPdr.corrispondePdr(r, testo)).map(r => r.id).sort().join(',');
    const nostro = S.pdrChiesto ? terminati.filter(r => S.delPdr(r, S.pdrChiesto(testo))).map(r => r.id).sort().join(',') : 'assente';
    verifica(`il PDR «${testo}» prende gli stessi ordini del campo PDR dei Terminati Rete`, pagina === nostro && pagina.length > 0, `${pagina.split(',').length} contro ${nostro.split(',').length}`);
  }
  // Un PDR che quest'anno non ha ritiri: l'ultimo, di qualunque anno.
  const ultimoPer = new Map();
  for (const r of terminati) {
    const g = String(r.trasporto_finito_il || '').slice(0, 10);
    if (r.id_pdr != null && g && (!ultimoPer.has(r.id_pdr) || g > ultimoPer.get(r.id_pdr))) ultimoPer.set(r.id_pdr, g);
  }
  const [vecchio, giorno] = [...ultimoPer.entries()].find(([, g]) => g < '2026-01-01' && g >= '2025-06-01') || [];
  if (vecchio != null) {
    const v = await esegui('ordini_chiusi', { canale: 'RETE', anno: 2026, pdr: String(vecchio) }, b44);
    verifica(`un PDR senza ritiri nel 2026 (${vecchio}): zero nell'anno e l'ultimo ritiro in archivio, il ${giorno}`, !!v && v.dati.ordini === 0 && v.dati.ultimo_ritiro_in_archivio && v.dati.ultimo_ritiro_in_archivio.fine_trasporto === giorno, J(v && v.dati.ultimo_ritiro_in_archivio));
  }
  const ignoto = await esegui('ordini_chiusi', { canale: 'RETE', anno: 2026, pdr: '999999' }, b44);
  verifica('un PDR che non c\'e\' non fa zero: numero non calcolabile, e lo dice', !!ignoto && ignoto.dati.ordini === null && /non risulta fra gli ordini terminati/.test(ignoto.dati.avviso_pdr || '') && !!ignoto.dati.numero_non_calcolabile, J(ignoto && ignoto.dati));
  // Il raccolto di un PDR: le stesse righe degli ordini chiusi.
  const raccPdr = await esegui('raccolto', { canale: 'RETE', anno: 2026, pdr: '42872' }, b44);
  verifica('il raccolto del PDR 42872 e\' quello dei suoi ordini chiusi', !!raccPdr && !!pdr && raccPdr.dati.tonnellate === pdr.dati.tonnellate && raccPdr.dati.formulari === pdr.dati.formulari && raccPdr.dati.tonnellate > 0, J([raccPdr && raccPdr.dati.tonnellate, pdr && pdr.dati.tonnellate]));
  const raccIgnoto = await esegui('raccolto', { canale: 'RETE', anno: 2026, pdr: '999999' }, b44);
  verifica('...e un PDR che non c\'e\' non fa zero tonnellate', !!raccIgnoto && raccIgnoto.dati.tonnellate === null && !!raccIgnoto.dati.avviso_pdr && !!raccIgnoto.dati.numero_non_calcolabile, J(raccIgnoto && raccIgnoto.dati));

  // Le secondarie verso Irigom di settembre, contro la funzione della pagina.
  const fSec = await caricaFunzione('computeSecondarieMatrix');
  const pagina = await chiama(fSec, { db: { Secondaria: A.Secondaria }, corpo: { filters: { canale: ['Rete'], destinazione: ['Irigom S.r.l.'], mese: ['Settembre'], anno: ['2026'] } } });
  const kpi = (pagina.j.canali || []).find(c => c.canale === 'Rete') || {};
  const sec = await esegui('secondarie', { canale: 'RETE', stato: 'chiuse', destinazione: 'Irigom', anno: 2026, mese: 'Settembre' }, b44);
  const rete = sec && (sec.dati.canali || [])[0];
  verifica('le secondarie chiuse verso Irigom a settembre sono quelle della pagina Secondarie', !!rete && rete.chiuse.ordini === kpi.ordini && rete.chiuse.tonnellate === Math.round(kpi.peso_kg) / 1000 && kpi.ordini > 0, J([rete && rete.chiuse, kpi]));
  const tutte = await esegui('secondarie', { anno: 2026, mese: 'Settembre' }, b44);
  verifica('senza canale, rete e ACI escono separate e non sommate', !!tutte && tutte.dati.canali.map(c => c.canale).join(',') === 'RETE,ACI' && tutte.dati.ordini === undefined, J(tutte && tutte.dati.canali.map(c => c.canale)));
  const paginaTutte = await chiama(fSec, { db: { Secondaria: A.Secondaria }, corpo: { filters: { mese: ['Settembre'], anno: ['2026'] } } });
  for (const c of tutte ? tutte.dati.canali : []) {
    const k = (paginaTutte.j.canali || []).find(x => x.canale === (c.canale === 'RETE' ? 'Rete' : 'ACI')) || { ordini: 0 };
    verifica(`le secondarie ${c.canale} di settembre sono quelle della pagina`, c.chiuse.ordini === k.ordini, J([c.chiuse.ordini, k.ordini]));
  }
  // Le terziarie di agosto, contro la pagina Terziarie montata.
  const { Componente, monta } = await caricaPagina('pages/Terziarie');
  const cliente = clienteFinto({ archivi: { Terziaria: A.Terziaria } });
  globalThis.__CLIENTE_FINTO = cliente.cliente;
  const montata = monta(Componente, {});
  await aspetta();
  const multi = (breve) => trova(montata.albero, el => el.type && el.type.__finto === 'MultiSelect' && el.props.breve === breve)[0];
  multi('Mesi').props.onChange(['Agosto']);
  await aspetta();
  multi('Anni').props.onChange(['2026']);
  await aspetta();
  const uscite = trova(montata.albero, el => el.type && el.type.__finto === 'UscitePerImpianto')[0];
  const contati = uscite ? uscite.props.records.length : null;
  const ter = await esegui('terziarie', { stato: 'chiuse', anno: 2026, mese: 'Agosto' }, b44);
  verifica('le terziarie di agosto sono quelle della pagina Terziarie', !!ter && ter.dati.chiuse.ordini === contati && contati > 0, J([ter && ter.dati.chiuse.ordini, contati]));
  const terSet = await esegui('terziarie', { anno: 2026, mese: 'Settembre' }, b44);
  verifica('le terziarie di settembre: zero, e l\'ultima fine trasporto in archivio dice fin dove arrivano i dati', !!terSet && terSet.dati.chiuse.ordini === 0 && terSet.dati.chiuse.ultima_fine_trasporto_in_archivio && terSet.dati.chiuse.ultima_fine_trasporto_in_archivio < '2026-09-01', J(terSet && terSet.dati.chiuse));
  console.log(`  secondarie rete verso Irigom, settembre 2026: ${kpi.ordini}; terziarie di agosto 2026: ${contati}`);
  // Gli aperti dell'extra raccolta: le schede «assegnato» della pagina.
  const extra = await esegui('ordini_aperti', { canale: 'EXTRA_RACCOLTA' }, b44);
  const extraPagina = A.ExtraRaccolta.filter(r => String(r.stato || '').toLowerCase().trim() === 'assegnato').length;
  verifica('gli aperti dell\'extra raccolta sono le schede «assegnato» della pagina', !!extra && extra.dati.ordini === extraPagina && extraPagina > 0, J([extra && extra.dati.ordini, extraPagina]));
  verifica('...e senza stimato il peso stimato e\' vuoto, non zero', !!extra && extra.dati.peso_stimato_t === null && /vuoto, non zero/.test(extra.dati.senza_peso_stimato || ''), J(extra && [extra.dati.peso_stimato_t, extra.dati.senza_peso_stimato]));
}

console.log('5. GLI ASSEGNATI COME LA PAGINA');
const fAss = await caricaFunzione('computeAssegnatiMatrix');
const confronta = async (nome, archivi, province) => {
  const b44 = sdk(archivi);
  for (const [entita, canale] of [['Assegnato', 'RETE'], ['AssegnatoAci', 'ACI']]) {
    const pagina = await chiama(fAss, { db: { [entita]: archivi[entita] || [] }, corpo: { entity: entita, filters: {} } });
    const tutto = await esegui('ordini_aperti', { canale }, b44);
    verifica(`${nome}, ${canale}: gli aperti sono quelli della pagina`, !!tutto && tutto.dati.ordini === pagina.j.kpi.total_orders, J([tutto && tutto.dati.ordini, pagina.j.kpi.total_orders]));
    verifica(`${nome}, ${canale}: l'eta' dell'arretrato e' quella della pagina`, !!tutto && tutto.dati.da_quanto_aspettano.oltre_60_giorni === pagina.j.kpi.eta.oltre_60 && tutto.dati.da_quanto_aspettano.entro_30_giorni === pagina.j.kpi.eta.entro_30, J([tutto && tutto.dati.da_quanto_aspettano, pagina.j.kpi.eta]));
    for (const pr of province) {
      const sigla = provinciaChiesta(pr).sigla;
      const conFiltro = await chiama(fAss, { db: { [entita]: archivi[entita] || [] }, corpo: { entity: entita, filters: { provincia: [sigla] } } });
      const nostro = await esegui('ordini_aperti', { canale, provincia: pr }, b44);
      const inClassifica = (pagina.j.provinceRanking.find(x => x.provincia === sigla) || { ordini: 0 }).ordini;
      verifica(`${nome}, ${canale}, «${pr}»: gli aperti sono quelli della pagina col filtro e della classifica delle province`, !!nostro && nostro.dati.ordini === conFiltro.j.kpi.total_orders && nostro.dati.ordini === inClassifica, J([nostro && nostro.dati.ordini, conFiltro.j.kpi.total_orders, inClassifica]));
    }
  }
};
{
  // Un archivio costruito: sigle scritte come capita, ordini vecchi e nuovi, un
  // ACI sotto il minimo, un «eseguito» nel limbo.
  const ass = (id, provincia, giorno, campi = {}) => ({ id: 'a' + id, id_ordine: 'ET26' + String(id).padStart(6, '0'), stato: 'assegnato', provincia, ordine_immesso_il: giorno + 'T08:00:00Z', peso_stimato: 1200, trasportatore: 'EMMESSE SRLS', id_pdr: 100 + id, punto_di_raccolta: 'GOMMISTA ' + id, ragione_sociale: 'GOMMISTA ' + id, comune: 'Comune ' + id, classe: 'P', ...campi });
  const archivi = {
    Assegnato: [ass(1, 'SR', '2026-10-10'), ass(2, 'sr ', '2026-07-01'), ass(3, 'SR', '2025-12-20'), ass(4, 'BA', '2026-09-01'), ass(5, 'CS', '2026-08-15', { trasportatore: 'GREEN TYRE PROJECT SRL' }), ass(6, '', '2026-10-01')],
    AssegnatoAci: [ass(7, 'BA', '2026-10-01', { classe: 'PFU Autodemolizione', peso_stimato: 1400 }), ass(8, 'BA', '2026-06-01', { classe: 'PFU Autodemolizione', peso_stimato: 3000 })],
    PrimariaRete: [{ id: 'e1', id_ordine: 'ET26999001', stato: 'eseguito', provincia: 'SR', trasporto_finito_il: '2026-10-09T10:00:00Z', peso_effettivo: 2000, punto_di_raccolta: 'GOMMISTA LIMBO', id_pdr: 900 },
      { id: 't1', id_ordine: 'ET26999002', stato: 'terminato', provincia: 'PZ', trasporto_finito_il: '2026-10-07T10:00:00Z', peso_effettivo: 2500, id_pdr: 42872, punto_di_raccolta: 'EUROGOMME SRL - LAVELLO', trasportatore: 'SMOCO S.R.L.', numero_fir: 'F1' }],
  };
  await confronta('archivio costruito', archivi, ['Siracusa', 'BA', 'Cosenza', 'Lecce']);
  const b44 = sdk(archivi);
  const sr = await esegui('ordini_aperti', { canale: 'RETE', provincia: 'Siracusa' }, b44);
  verifica('Siracusa: tre aperti, dal piu\' vecchio, e il nome riconosciuto', !!sr && sr.dati.ordini === 3 && sr.dati.ordini_elenco.righe[0].id_ordine === 'ET26000003' && /Siracusa \(SR\)/.test(sr.dati.provincia_riconosciuta || ''), J(sr && sr.dati));
  verifica('...e l\'«eseguito» di Siracusa detto a parte, col suo ID, mai sommato', !!sr && sr.dati.eseguiti_nel_limbo && sr.dati.eseguiti_nel_limbo.ordini === 1 && sr.dati.eseguiti_nel_limbo.id_ordine[0].id_ordine === 'ET26999001', J(sr && sr.dati.eseguiti_nel_limbo));
  const vecchi = await esegui('ordini_aperti', { canale: 'RETE', provincia: 'SR', da_almeno_giorni: 60 }, b44);
  verifica('da almeno 60 giorni: due, e dice quanti sono senza il filtro', !!vecchi && vecchi.dati.ordini === 2 && /senza questo filtro sono 3/.test(vecchi.dati.filtro_attesa || ''), J(vecchi && [vecchi.dati.ordini, vecchi.dati.filtro_attesa]));
  const aci = await esegui('ordini_aperti', { canale: 'ACI', provincia: 'Bari' }, b44);
  verifica('ACI a Bari: due aperti, uno con lo stimato sotto i 1.500 kg segnalato', !!aci && aci.dati.ordini === 2 && aci.dati.stimato_sotto_1500_kg && aci.dati.stimato_sotto_1500_kg.ordini === 1, J(aci && aci.dati.stimato_sotto_1500_kg));
  const racc = await esegui('ordini_aperti', { canale: 'RETE', raccoglitore: 'Green Tyre' }, b44);
  verifica('il raccoglitore scritto a meta\' si riconosce', !!racc && racc.dati.ordini === 1 && /GREEN TYRE/.test(racc.dati.raccoglitore_riconosciuto || ''), J(racc && racc.dati));
  const ignota = await esegui('ordini_aperti', { canale: 'RETE', provincia: 'Siracua' }, b44);
  verifica('una provincia che non si riconosce non fa zero', !!ignota && ignota.dati.ordini === null && !!ignota.dati.numero_non_calcolabile, J(ignota && ignota.dati));
  const lecce = await esegui('ordini_aperti', { canale: 'RETE', provincia: 'Lecce' }, b44);
  verifica('una provincia senza aperti: zero vero, detto', !!lecce && lecce.dati.ordini === 0 && /Nessun ordine aperto nella provincia di Lecce \(LE\)/.test(lecce.dati.nessun_ordine || ''), J(lecce && lecce.dati));
  const senzaAperti = await esegui('ordini_aperti', { canale: 'RETE', pdr: '42872' }, b44);
  verifica('un PDR senza aperti: zero, e il suo ultimo ritiro chiuso', !!senzaAperti && senzaAperti.dati.ordini === 0 && senzaAperti.dati.pdr_senza_ordini_aperti && senzaAperti.dati.pdr_senza_ordini_aperti.ultimo_ritiro_chiuso === '2026-10-07', J(senzaAperti && senzaAperti.dati));
  const inventato = await esegui('ordini_aperti', { canale: 'RETE', pdr: '777777' }, b44);
  verifica('un PDR che non c\'e\' ne\' fra gli aperti ne\' fra i chiusi non fa zero', !!inventato && inventato.dati.ordini === null && /non risulta fra gli ordini del canale RETE/.test(inventato.dati.avviso || ''), J(inventato && inventato.dati));
  verifica('l\'eta\' viene da etaArretrato del cruscotto', !!sr && sr.dati.da_quanto_aspettano.il_piu_vecchio.id_ordine === etaArretrato(archivi.Assegnato.filter(r => String(r.provincia).toUpperCase().trim() === 'SR'), S.oggiRoma()).piu_vecchio.id_ordine);
}
{
  // Il file vero delle primarie (ECOTYRE\PRIMARIE.xlsx, sola lettura), se c'e':
  // gli Assegnati come li scrive il caricamento, e la pagina.
  const FILE = 'C:/Users/HOME/Desktop/ECOTYRE/PRIMARIE.xlsx';
  if (!existsSync(FILE)) {
    console.log('  (file PRIMARIE.xlsx assente: confronto sul file vero saltato)');
  } else {
    const XLSX = createRequire(import.meta.url)('xlsx');
    const foglio = XLSX.read(readFileSync(FILE), { cellDates: true });
    const righe = XLSX.utils.sheet_to_json(foglio.Sheets[foglio.SheetNames[0]], { defval: null });
    const colonne = SHEET_MAP.primarie.columns;
    const archivi = { Assegnato: [], AssegnatoAci: [] };
    righe.forEach((riga, i) => {
      const r = { id: 'x' + i };
      for (const [col, campo] of Object.entries(colonne)) if (riga[col] !== undefined) r[campo] = DATE_PRIMARIE.has(campo) ? dataPrimaria(riga[col]) : riga[col];
      const dove = archivioPrimaria(r);
      if (archivi[dove]) archivi[dove].push({ id: r.id, ...recordAssegnato(r) });
    });
    console.log(`  PRIMARIE.xlsx: ${righe.length} righe, ${archivi.Assegnato.length} assegnati rete e ${archivi.AssegnatoAci.length} ACI`);
    await confronta('file PRIMARIE.xlsx', archivi, ['Siracusa', 'Bari', 'Cosenza', 'Napoli', 'Salerno']);
    const sr = await esegui('ordini_aperti', { canale: 'RETE', provincia: 'Siracusa' }, sdk(archivi));
    console.log(`  ordini aperti a Siracusa (rete) nel file: ${sr && sr.dati.ordini}`);
  }
}

console.log('6. IL PERCHE\' DELLA GUARDIA ARRIVA A «DOVE HO GUARDATO»');
{
  const scelti = P.strumentiDalPiano({ strumenti: ECT }, catalogo, OGGI, 'quanti ordini aperti ci sono a Siracusa?');
  const b44 = sdk({ Assegnato: [{ id: 'a1', id_ordine: 'ET1', stato: 'assegnato', provincia: 'SR', ordine_immesso_il: '2026-10-01T08:00:00Z' }] });
  const r = await S.eseguiStrumento(b44, scelti[0].nome, scelti[0].parametri, null);
  verifica('lo strumento riceve i parametri senza la chiave della guardia', !!r && r.parametri && !(CHIAVE in r.parametri) && r.parametri.provincia === 'Siracusa', J(r && r.parametri));
  verifica('il periodo che la chat mostra dice al posto di che cosa e perche\'', !!r && /scelto al posto delle Richieste ECT: la domanda parla di ordini, non di richieste arrivate via email/.test(r.periodo || ''), J(r && r.periodo));
  verifica('il risultato porta la scelta per il modello', !!r && /al posto delle Richieste ECT/.test(r.scelta_dello_strumento || ''));
  const testo = P.testoDati([r]);
  verifica('e il blocco dei dati per la risposta la dice', /SCELTA DELLO STRUMENTO: scelto al posto delle Richieste ECT/.test(testo), testo.slice(0, 400));
  const entry = senzaR(readFileSync(new URL('../base44/functions/chiediAssistente/entry.ts', import.meta.url), 'utf8'));
  verifica('chiediAssistente salva il periodo in «Dove ho guardato» (strumenti_json)', /strumenti_json: risultati\.length \? JSON\.stringify\(\{ strumenti: risultati\.map\(r => \(\{ strumento: r\.strumento, parametri: r\.parametri, fonte: r\.fonte, periodo: r\.periodo/.test(entry));
  verifica('la regola della risposta sugli ordini c\'e\' (3-octodecies)', /3-octodecies\. Gli ordini: gli APERTI li dice ordini_aperti/.test(entry) && /eseguiti_nel_limbo/.test(entry));
  const chat = senzaR(readFileSync(new URL('../src/components/assistente/ChatAssistente.jsx', import.meta.url), 'utf8'));
  verifica('la chat mostra il periodo accanto al nome dello strumento', /\{ETICHETTE_STRUMENTO\[s\.strumento\] \|\| s\.strumento\}/.test(chat) && /\$\{s\.periodo \? ` — \$\{s\.periodo\}` : ''\}/.test(chat));
}

// ─── la revisione del 14/10/2026 ───
// I rilievi del revisore sulla guardia e sul comune, con i suoi casi: la guardia
// corregge gli errori EVIDENTI della mappa e nient'altro.
console.log('7. LA REVISIONE: QUELLO CHE LA GUARDIA NON DEVE FARE');
// Col codice di prima uno strumento puo' mancare: allora non si esegue niente e la verifica fallisce.
const esegui7 = async (b, nome, p) => { const r = await S.eseguiStrumento(b, nome, p || {}, null); return r && !r.dati ? { ...r, dati: {} } : r; };
const sulVero = async (nome, p) => (VERI && nome ? esegui7(sdk(VERI), nome, p) : null);
const primo = (xs) => xs[0] || { nome: '', parametri: {} };
const temaDi = (q) => (P.temaDellaDomanda ? P.temaDellaDomanda(q, OGGI) : {});
const ordiniDi = (r) => (r && r.dati ? r.dati.ordini : undefined);
{
  // 7.1 Gli ordini chiusi scelti bene dal pianificatore restano chiusi, anche
  // senza la parola «chiusi»: fatti, gestiti, serviti, o in un periodo.
  const CHIUSI = [
    { q: 'quanti ordini ha fatto Emmesse a settembre?', p: { canale: 'RETE', anno: 2026, mese: 'Settembre', raccoglitore: 'Emmesse' }, n: 15 },
    { q: 'quanti ordini abbiamo fatto a Cosenza ad agosto?', p: { canale: 'RETE', anno: 2026, mese: 'Agosto', provincia: 'CS' }, n: 10 },
    { q: 'quante richieste abbiamo servito in provincia di Bari nel 2025?', p: { canale: 'RETE', anno: 2025, provincia: 'BA' }, n: 210 },
    { q: "quanti ordini ha gestito Green Tyre quest'anno?", p: { canale: 'RETE', anno: 2026, raccoglitore: 'Green Tyre' }, n: 876 },
    { q: 'quanti ordini a Siracusa a settembre?', p: { canale: 'RETE', anno: 2026, mese: 'Settembre', provincia: 'SR' } },
  ];
  for (const c of CHIUSI) {
    const piano = { periodo: { anno: c.p.anno, ...(c.p.mese ? { mese: c.p.mese } : {}) }, canali: ['RETE'], strumenti: [{ nome: 'ordini_chiusi', parametri: c.p }] };
    const scelti = P.strumentiDalPiano(piano, catalogo, OGGI, c.q);
    verifica(`«${c.q}»: ordini_chiusi scelto dal pianificatore resta, senza correzioni`, !scelti.correzioni && scelti.length === 1 && scelti[0].nome === 'ordini_chiusi' && !(CHIAVE in scelti[0].parametri), J([scelti.correzioni, scelti.map(s => [s.nome, s.parametri])]));
    if (VERI && c.n !== undefined) {
      const r = await sulVero(primo(scelti).nome, primo(scelti).parametri);
      verifica(`«${c.q}»: sui dati veri ${c.n} ordini chiusi, come il piano del pianificatore`, ordiniDi(r) === c.n, J(r && r.dati && [r.dati.ordini, r.dati.soggetto_riconosciuto]));
    }
  }
  // E la domanda senza periodo resta degli aperti, scelti dal pianificatore o no.
  const ap = P.strumentiDalPiano({ strumenti: [{ nome: 'ordini_aperti', parametri: { canale: 'RETE', provincia: 'SR' } }] }, catalogo, OGGI, 'quanti ordini ci sono a Siracusa?');
  verifica('«quanti ordini ci sono a Siracusa?»: ordini_aperti scelto dal pianificatore resta', !ap.correzioni && ap.length === 1 && ap[0].nome === 'ordini_aperti', J(ap.map(s => s.nome)));
  // Ma «aperti» detto a parole vale sopra un ordini_chiusi del pianificatore.
  const detto = P.strumentiDalPiano({ strumenti: [{ nome: 'ordini_chiusi', parametri: { canale: 'RETE', provincia: 'SR' } }] }, catalogo, OGGI, 'quanti ordini aperti ci sono a Siracusa?');
  verifica('«quanti ordini aperti ci sono a Siracusa?»: ordini_chiusi diventa ordini_aperti', detto.length === 1 && detto[0].nome === 'ordini_aperti' && /scelto al posto degli ordini chiusi/.test(detto[0].parametri[CHIAVE] || ''), J(detto.map(s => [s.nome, s.parametri])));
}
{
  // 7.2 Una sigla dentro il nome di un raccoglitore non e' una provincia.
  const tema = (q) => temaDi(q);
  for (const q of ["Quanti ritiri ha fatto CL Service quest'anno?", 'ordini aperti di BS Ecoservizi', 'quanti ordini ha chiuso GOMME CL a settembre?']) {
    verifica(`«${q}»: nessuna provincia letta nella domanda`, tema(q).provincia === '', J(tema(q).provincia));
  }
  for (const [q, sigla] of [['quanti ordini aperti a SR?', 'SR'], ['ordini aperti ACI BA', 'BA'], ['Ordini aperti SR', 'SR'], ['SR: ordini aperti', 'SR'], ['ordini aperti in provincia di CS e basta', 'CS']]) {
    verifica(`«${q}»: la sigla da sola resta la provincia ${sigla}`, tema(q).provincia === sigla, J(tema(q).provincia));
  }
  const q = "Quanti ritiri ha fatto CL Service quest'anno?";
  const piano = { periodo: { anno: 2026 }, canali: ['RETE'], strumenti: [{ nome: 'ordini_chiusi', parametri: { canale: 'RETE', anno: 2026, raccoglitore: 'CL Service' } }] };
  const scelti = P.strumentiDalPiano(piano, catalogo, OGGI, q);
  verifica(`«${q}»: la guardia non aggiunge una provincia al raccoglitore`, scelti.length === 1 && scelti[0].parametri.provincia === undefined && !scelti.correzioni, J(scelti.map(s => s.parametri)));
  // La seconda rete: il nome della provincia dentro il nome scritto dal piano.
  const bari = P.strumentiDalPiano({ periodo: { anno: 2026 }, strumenti: [{ nome: 'ordini_chiusi', parametri: { canale: 'RETE', raccoglitore: 'Ecologia Bari' } }] }, catalogo, OGGI, 'quanti ordini ha fatto Ecologia Bari a settembre?');
  verifica('«Ecologia Bari»: la provincia che e\' una parola del raccoglitore non si aggiunge', bari.length === 1 && bari[0].parametri.provincia === undefined && bari[0].parametri.mese === 'Settembre', J(bari.map(s => s.parametri)));
  const pz = P.strumentiDalPiano({ periodo: { anno: 2026 }, strumenti: [{ nome: 'ordini_chiusi', parametri: { canale: 'RETE', raccoglitore: 'Emmesse' } }] }, catalogo, OGGI, 'quanti ordini ha fatto Emmesse a Potenza?');
  verifica('...ma una provincia scritta a parte si aggiunge, e si dice', pz.length === 1 && pz[0].parametri.provincia === 'Potenza' && /filtr[oi] pres[oi] dalla domanda: provincia Potenza/.test(pz[0].parametri[CHIAVE] || ''), J(pz.map(s => s.parametri)));
  if (VERI) {
    const a = await sulVero('ordini_chiusi', piano.strumenti[0].parametri);
    const b = await sulVero(primo(scelti).nome, primo(scelti).parametri);
    verifica('sui dati veri: 82 ordini chiusi di C.L. SERVICE, prima e dopo la guardia', ordiniDi(a) === 82 && ordiniDi(b) === 82, J([ordiniDi(a), ordiniDi(b)]));
  }
}
{
  // 7.3 Il canale: solo uno, detto in positivo e da solo, sopra un piano con un
  // canale diverso. Negato, aggiunto o il comune di Aci Sant'Antonio non contano.
  const CANALE = [
    { q: "Quanto abbiamo raccolto quest'anno, extra raccolta esclusa?", piano: { periodo: { anno: 2026 }, canali: ['RETE', 'ACI'], strumenti: [{ nome: 'raccolto', parametri: { anno: 2026 } }] }, atteso: ['RETE', 'ACI'] },
    { q: "Quanto abbiamo raccolto in tutto quest'anno, ACI compresa?", piano: { periodo: { anno: 2026 }, canali: ['RETE', 'ACI', 'EXTRA_RACCOLTA'], strumenti: [{ nome: 'raccolto', parametri: { anno: 2026 } }] }, atteso: ['RETE', 'ACI', 'EXTRA_RACCOLTA'] },
    { q: 'Quanti ordini aperti ci sono a Bari, esclusi i demolitori?', piano: { canali: ['RETE'], strumenti: [{ nome: 'ordini_aperti', parametri: { canale: 'RETE', provincia: 'BA' } }] }, atteso: ['RETE'] },
    { q: 'Quanti ordini aperti ci sono a Siracusa, compresi quelli dei demolitori?', piano: { canali: ['RETE', 'ACI'], strumenti: [{ nome: 'ordini_aperti', parametri: { canale: 'RETE', provincia: 'SR' } }, { nome: 'ordini_aperti', parametri: { canale: 'ACI', provincia: 'SR' } }] }, atteso: ['RETE', 'ACI'] },
    { q: "Quanto abbiamo raccolto quest'anno senza l'extra raccolta?", piano: { periodo: { anno: 2026 }, canali: ['RETE', 'ACI'], strumenti: [{ nome: 'raccolto', parametri: { anno: 2026 } }] }, atteso: ['RETE', 'ACI'] },
    { q: "Quanti ritiri abbiamo fatto ad Aci Sant'Antonio quest'anno?", piano: { periodo: { anno: 2026 }, canali: ['RETE'], strumenti: [{ nome: 'ordini_chiusi', parametri: { canale: 'RETE', anno: 2026, comune: "Aci Sant'Antonio" } }] }, atteso: ['RETE'] },
    { q: 'quanti ordini aperti ad Aci Catena?', piano: { canali: ['RETE'], strumenti: [{ nome: 'ordini_aperti', parametri: { canale: 'RETE', comune: 'Aci Catena' } }] }, atteso: ['RETE'] },
    // Il gemello: un piano RETE+ACI su una domanda dei soli demolitori non si
    // raddoppia in due chiamate ACI.
    { q: 'ordini aperti dei demolitori a Siracusa', piano: { canali: ['RETE', 'ACI'], strumenti: [{ nome: 'ordini_aperti', parametri: { canale: 'RETE', provincia: 'SR' } }, { nome: 'ordini_aperti', parametri: { canale: 'ACI', provincia: 'SR' } }] }, atteso: ['RETE', 'ACI'] },
    // E i casi che la guardia deve ancora correggere.
    { q: 'ordini aperti degli autodemolitori in provincia di Bari', piano: { canali: ['RETE'], strumenti: [{ nome: 'ordini_aperti', parametri: { canale: 'RETE', provincia: 'BA' } }] }, atteso: ['ACI'] },
    { q: 'ordini aperti degli autodemolitori in provincia di Bari', piano: { strumenti: [{ nome: 'ordini_aperti', parametri: { provincia: 'BA' } }] }, atteso: ['ACI'] },
    { q: 'ordini aperti da oltre 60 giorni dei demolitori a Bari', piano: { canali: ['RETE'], strumenti: [{ nome: 'ordini_aperti', parametri: { canale: 'RETE', provincia: 'BA' } }] }, atteso: ['ACI'] },
    // Lo stesso strumento due volte, uno sul canale e uno senza: una chiamata sola.
    { q: 'ordini aperti dei demolitori a Siracusa', piano: { strumenti: [{ nome: 'ordini_aperti', parametri: { canale: 'ACI', provincia: 'SR' } }, { nome: 'ordini_aperti', parametri: { provincia: 'SR' } }] }, atteso: ['ACI'] },
  ];
  for (const c of CANALE) {
    const scelti = P.strumentiDalPiano(c.piano, catalogo, OGGI, c.q);
    const canali = scelti.map(s => s.parametri.canale);
    verifica(`«${c.q}» col piano ${J(c.piano.canali || c.piano.strumenti.map(s => s.parametri.canale || '-'))}: canali ${J(c.atteso)}`, J([...canali].sort()) === J([...c.atteso].sort()), J(canali));
  }
  verifica('«Aci Sant\'Antonio» e «Aci Catena» sono comuni, non il canale ACI', temaDi("ritiri ad Aci Sant'Antonio").canale === '' && temaDi('aperti ad Aci Catena').canale === '' && temaDi('richieste aci aperte a Catania').canale === 'ACI');
  verifica('«extra raccolta esclusa» e «esclusi i demolitori» sono canali esclusi', J(temaDi("raccolto quest'anno, extra raccolta esclusa").canali_esclusi) === J(['EXTRA_RACCOLTA']) && J(temaDi('aperti a Bari, esclusi i demolitori').canali_esclusi) === J(['ACI']));
  if (VERI) {
    const p = { canale: 'RETE', anno: 2026, comune: "Aci Sant'Antonio" };
    const scelti = P.strumentiDalPiano({ periodo: { anno: 2026 }, canali: ['RETE'], strumenti: [{ nome: 'ordini_chiusi', parametri: p }] }, catalogo, OGGI, "Quanti ritiri abbiamo fatto ad Aci Sant'Antonio quest'anno?");
    const r = await sulVero(primo(scelti).nome, primo(scelti).parametri);
    verifica('sui dati veri: ad Aci Sant\'Antonio 2 ordini chiusi della rete, col comune riconosciuto', ordiniDi(r) === 2 && r.dati.canale === 'RETE' && /ACI SANT/i.test(r.dati.comune_riconosciuto || ''), J(r && [r.dati.ordini, r.dati.canale, r.dati.comune_riconosciuto]));
  }
}
{
  // 7.4 Un comune che non si riconosce non fa zero: ordini chiusi, raccolto e aperti.
  if (VERI) {
    const giusto = await sulVero('ordini_chiusi', { canale: 'RETE', anno: 2026, comune: 'Lavello' });
    const refuso = await sulVero('ordini_chiusi', { canale: 'RETE', anno: 2026, comune: 'Lavelo' });
    verifica('ordini chiusi a Lavello: 6, col comune riconosciuto', ordiniDi(giusto) === 6 && /LAVELLO/i.test(giusto.dati.comune_riconosciuto || ''), J(giusto && [giusto.dati.ordini, giusto.dati.comune_riconosciuto]));
    verifica('«Lavelo»: numero non calcolabile, e propone LAVELLO', ordiniDi(refuso) === null && !!refuso.dati.numero_non_calcolabile && /non risulta fra gli ordini terminati/.test(refuso.dati.avviso_comune || '') && /forse [^)]*LAVELLO/i.test(refuso.dati.avviso_comune || ''), J(refuso && refuso.dati.avviso_comune));
    const racc = await sulVero('raccolto', { canale: 'RETE', anno: 2026, comune: 'Lavelo' });
    verifica('...e il raccolto di «Lavelo» non fa zero tonnellate', !!racc && racc.dati.tonnellate === null && !!racc.dati.numero_non_calcolabile && !!racc.dati.avviso_comune, J(racc && racc.dati));
    const raccOk = await sulVero('raccolto', { canale: 'RETE', anno: 2026, comune: 'Lavello' });
    verifica('...mentre a Lavello il raccolto e\' quello dei suoi ordini chiusi', !!raccOk && raccOk.dati.tonnellate === giusto.dati.tonnellate && raccOk.dati.tonnellate > 0, J([raccOk && raccOk.dati.tonnellate, giusto && giusto.dati.tonnellate]));
  }
  const X = {
    Assegnato: [{ id: 'a1', id_ordine: 'ET26000001', stato: 'assegnato', provincia: 'PZ', comune: 'LAVELLO', ordine_immesso_il: '2026-10-01T08:00:00Z', peso_stimato: 1000 }],
    PrimariaRete: [{ id: 't1', id_ordine: 'ET26000002', stato: 'terminato', provincia: 'PZ', comune: 'MELFI', trasporto_finito_il: '2026-09-01T08:00:00Z', peso_effettivo: 1000, numero_fir: 'F1' }],
  };
  const b44 = sdk(X);
  const lavelo = await esegui7(b44, 'ordini_aperti', { canale: 'RETE', comune: 'Lavelo' });
  verifica('ordini aperti a «Lavelo»: non calcolabile, propone LAVELLO, niente «lo zero e\' vero»', ordiniDi(lavelo) === null && !!lavelo.dati.numero_non_calcolabile && /forse LAVELLO/.test(lavelo.dati.avviso || '') && !lavelo.dati.nessun_ordine, J(lavelo && lavelo.dati.avviso));
  const lavello = await esegui7(b44, 'ordini_aperti', { canale: 'RETE', comune: 'lavello' });
  verifica('ordini aperti a Lavello: uno', ordiniDi(lavello) === 1 && lavello.dati.comune_riconosciuto === 'LAVELLO', J(lavello && lavello.dati.ordini));
  const melfi = await esegui7(b44, 'ordini_aperti', { canale: 'RETE', comune: 'Melfi' });
  verifica('ordini aperti a Melfi, che ha solo ordini chiusi: zero vero, detto col nome del portale', ordiniDi(melfi) === 0 && /nel comune di MELFI .*lo zero e' vero/.test(melfi.dati.nessun_ordine || ''), J(melfi && melfi.dati));
}
{
  // 7.5 Il piano vuoto su una domanda di procedura resta vuoto.
  const PROCEDURA = [
    'Entro quanti giorni va chiuso un ordine a portale?',
    'Quando va chiuso il formulario dopo il ritiro?',
    'Quali documenti servono per ritirare i PFU da un demolitore?',
    'Quante copie del formulario restano al produttore dopo il ritiro?',
    'Quale classe va indicata nella richiesta di ritiro di un autodemolitore?',
  ];
  for (const q of PROCEDURA) {
    const conNorma = P.strumentiDalPiano({ strumenti: [], serve_normativa: true }, catalogo, OGGI, q);
    const senza = P.strumentiDalPiano({ strumenti: [] }, catalogo, OGGI, q);
    verifica(`«${q}»: il piano vuoto resta vuoto (con la norma dichiarata e senza)`, conNorma.length === 0 && senza.length === 0, J([conNorma.map(s => s.nome), senza.map(s => s.nome)]));
  }
  // Il piano vuoto su una domanda di dati, con la norma esclusa, si riempie: e lo dice.
  const vuoto = P.strumentiDalPiano({ strumenti: [], serve_normativa: false }, catalogo, OGGI, 'quanti ordini aperti ci sono a Siracusa?');
  verifica('piano vuoto su «quanti ordini aperti ci sono a Siracusa?»: ordini_aperti aggiunto', vuoto.length === 1 && vuoto[0].nome === 'ordini_aperti' && /^aggiunto/.test(vuoto[0].parametri[CHIAVE] || ''), J(vuoto.map(s => [s.nome, s.parametri])));
  const testo = P.testoDati([{ strumento: 'ordini_aperti', parametri: {}, fonte: 'x', periodo: 'y', dati_al: OGGI, dati: {}, scelta_dello_strumento: vuoto[0] && vuoto[0].parametri[CHIAVE] }]);
  verifica('...e al modello si dice che, se la domanda e\' di procedura, i numeri non servono', /Il piano era vuoto/.test(testo) && !/Questo e' il modulo giusto/.test(testo), testo.slice(0, 400));
}
{
  // 7.6 I mesi di un intervallo, in tutti i modi in cui si scrivono.
  const MESI4 = [...MESI3, 'Ottobre'];
  const casi = [
    ['quante richieste chiuse a Cosenza luglio-settembre?', MESI3],
    ['ordini chiusi a Cosenza dal 1 luglio al 30 settembre', MESI3],
    ["ordini chiusi dall'1 luglio al 30 settembre", MESI3],
    ['quanti ordini chiusi a Cosenza da luglio a oggi?', MESI4],
    ['ordini chiusi da luglio in poi', MESI4],
    ['ordini chiusi da luglio 2026 a oggi', MESI4],
    ['ordini chiusi a luglio e settembre', ['Luglio', 'Settembre']],
    ['ordini chiusi tra luglio e settembre', MESI3],
    ['ordini chiusi da luglio 2025 a oggi', []],
  ];
  for (const [q, attesi] of casi) {
    const m = temaDi(q).mesi;
    verifica(`«${q}»: i mesi sono ${attesi.join(', ') || 'nessuno'}`, J(m) === J(attesi), J(m));
  }
  const s = P.strumentiDalPiano({ periodo: { anno: 2026 }, canali: ['RETE'], strumenti: [{ nome: 'ordini_chiusi', parametri: { canale: 'RETE', provincia: 'CS' } }] }, catalogo, OGGI, 'quanti ordini chiusi a Cosenza da luglio a oggi?')[0] || { nome: '', parametri: {} };
  verifica('i mesi presi dalla domanda si dicono in «Dove ho guardato»', J(s.parametri.mesi) === J(MESI4) && /filtro preso dalla domanda: mesi Luglio, Agosto, Settembre, Ottobre/.test(s.parametri[CHIAVE] || ''), J(s.parametri));
  if (VERI) {
    const matrice = computeProvinceMatrixData(VERI.PrimariaRete, 9);
    const cs = matrice.province.find(x => x.provincia === 'CS');
    const somma = (mm) => mm.reduce((t, x) => t + (cs.mesi[x] || 0), 0);
    const r3 = await sulVero('ordini_chiusi', { canale: 'RETE', anno: 2026, provincia: 'CS', mesi: temaDi('quante richieste chiuse a Cosenza luglio-settembre?').mesi });
    const r4 = await sulVero(s.nome, s.parametri);
    verifica('sui dati veri: Cosenza luglio-settembre 46 ordini chiusi, come la matrice dei Terminati Rete', ordiniDi(r3) === somma(MESI3) && ordiniDi(r3) === 46, J([ordiniDi(r3), somma(MESI3)]));
    verifica('sui dati veri: Cosenza da luglio a oggi 50, come la matrice', ordiniDi(r4) === somma(MESI4) && ordiniDi(r4) === 50, J([ordiniDi(r4), somma(MESI4)]));
  }
}

console.log('\nNota: il pianificatore vero e\' un modello e non si prova qui; si provano il testo che riceve, il catalogo, la guardia che corregge il suo piano e gli strumenti.');
console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
