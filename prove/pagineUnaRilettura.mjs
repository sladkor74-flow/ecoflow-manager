// LE PAGINE CHE SI AGGIORNANO DA SOLE: UNA RILETTURA PER CARICAMENTO
// (revisione del 13/10/2026, giro sui rilievi della revisione di G7).
//
// Terminati ACI, Assegnati (rete e ACI), Secondarie, PDR e Terziarie si
// iscrivevano al registro dei caricamenti e rileggevano a ogni evento che non
// fosse «in_corso». Un caricamento pero' e' una sequenza: importaBlocco chiude
// in «errore» la riga rimasta aperta da un tentativo di prima, apre la sua
// «in_corso», la chiude «successo» e a ricalcoli finiti ci attacca la nota
// «moduli collegati aggiornati». Erano tre riletture per un archivio cambiato
// una volta; le terziarie non guardavano nemmeno il tipo, e rileggevano tutto a
// ogni caricamento di qualunque archivio. Ora passano tutte dalla regola comune
// (src/lib/ascoltoCaricamenti.js): si rilegge alla chiusura, una volta, e solo
// per i propri tipi. Chi mostra anche quello che i ricalcoli scrivono dopo (gli
// alert delle secondarie) alla nota rilegge solo quello.
//
// Regola 2, ogni caricamento aggiorna tutti i moduli: per ogni pagina si
// controlla anche che la chiusura rilegga tutto quello che la pagina mostra.
// Assegnati non rileggeva il dettaglio degli ordini: ora si'.
//
// L'ultima a passare di qui (revisione del 13/10/2026) e' la predittivita'
// delle secondarie: un calcolo alla chiusura, dopo la sua attesa di 4 secondi.
//
// Le pagine vere girano con il client finto di prove/dati/paginaFinta.mjs, che
// conta le richieste.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { caricaPagina, clienteFinto, aspetta, trova, testo, orologioFinto } from './dati/paginaFinta.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// === le sequenze vere del registro ===
const NOTA = 'moduli collegati aggiornati';
let progressivo = 0;
// Un caricamento fatto da importaBlocco (o da importEcotyreFile, che chiude la
// riga vecchia allo stesso modo): la riga vecchia ha la modalita' «sostituzione»
// che apriCaricamento le ha scritto. conNota: i ricalcoli finiti (solo primarie e
// secondarie ne hanno).
function sequenza(tipo, { conNota = true } = {}) {
  const vecchia = `${tipo}-v${++progressivo}`;
  const nuova = `${tipo}-n${progressivo}`;
  const riga = { id: nuova, tipo_file: tipo, nome_file: `${tipo}.xlsx`, utente: 'admin', modalita: 'sostituzione' };
  const passi = [
    ['riga vecchia chiusa in errore', { type: 'update', data: { id: vecchia, tipo_file: tipo, esito: 'errore', modalita: 'sostituzione',
      messaggio: "Caricamento interrotto: avviato da admin e mai concluso. L'archivio poteva essere incompleto; e' stato ricaricato dopo." } }],
    ['riga nuova in_corso', { type: 'create', data: { ...riga, esito: 'in_corso', messaggio: 'Caricamento in corso: archivio in riscrittura.' } }],
    ['chiusura', { type: 'update', data: { ...riga, esito: 'successo', messaggio: '1000 righe importate' } }],
  ];
  if (conNota) passi.push(['nota', { type: 'update', data: { ...riga, esito: 'successo', messaggio: `1000 righe importate | ${NOTA}` } }]);
  return passi;
}

// Monta una pagina e restituisce chi conta le richieste di ogni evento.
async function monta(percorso, { funzioni = {}, archivi = {}, props = {}, reali = [] } = {}) {
  const p = await caricaPagina(percorso, { reali });
  const c = clienteFinto({ funzioni, archivi });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const r = p.monta(p.Componente, props);
  await aspetta(60);
  // Le richieste partite da un'azione: letture per archivio e funzioni per nome.
  const richieste = async (azione) => {
    c.azzera();
    await azione();
    await aspetta(60);
    const letture = {};
    for (const x of c.letture()) letture[x.nome] = (letture[x.nome] || 0) + 1;
    return { letture, funzioni: c.funzioniChiamate().map(x => x.nome).sort() };
  };
  // Le richieste di ogni passo di una sequenza.
  const perPasso = async (passi) => {
    const esiti = [];
    for (const [, evento] of passi) esiti.push(await richieste(() => c.emetti('UploadLog', evento)));
    return esiti;
  };
  return { r, c, richieste, perPasso };
}
const quante = (q, archivio) => q.letture[archivio] || 0;
const descrivi = (passi, esiti) => passi.map(([nome], i) => `${nome}: ${JSON.stringify(esiti[i])}`).join(' · ');
const iscrizioni = (c) => c.iscritti.filter(x => x.nome === 'UploadLog' && x.attiva).length;

console.log('TERMINATI ACI: L\'ARCHIVIO UNA VOLTA, ALLA CHIUSURA');
{
  const archivio = [{ id: 'a1', id_ordine: 'ET1', stato: 'terminato', destinazione: 'GATIM SRL', trasporto_finito_il: '2026-09-10T09:00:00', peso_effettivo: 1500 }];
  const { r, c, richieste, perPasso } = await monta('pages/PrimarieAci', { archivi: { PrimariaAci: archivio }, reali: ['@/components/shared/CercaIdOrdine'] });
  verifica('la pagina si monta senza errori, con una lettura e un\'iscrizione', r.errori.length === 0 && c.letture('PrimariaAci').length === 1 && iscrizioni(c) === 1,
    `${String(r.errori[0] || '')} ${c.letture('PrimariaAci').length} ${iscrizioni(c)}`);
  const passi = sequenza('primarie');
  const q = await perPasso(passi);
  verifica('caricamento delle primarie: riga vecchia, apertura, chiusura, nota = 0, 0, 1, 0 letture', JSON.stringify(q.map(x => quante(x, 'PrimariaAci'))) === '[0,0,1,0]', descrivi(passi, q));
  verifica('e nessuna funzione', q.every(x => x.funzioni.length === 0), descrivi(passi, q));
  const sec = await perPasso(sequenza('secondarie'));
  verifica('un caricamento delle secondarie non c\'entra', sec.every(x => Object.keys(x.letture).length === 0), JSON.stringify(sec));
  const vecchio = await richieste(() => c.emetti('UploadLog', { type: 'create', data: { id: 'aci1', tipo_file: 'primarie_aci', esito: 'successo', messaggio: 'ok' } }));
  verifica('il tipo di una volta, primarie_aci, rilegge ancora', quante(vecchio, 'PrimariaAci') === 1, JSON.stringify(vecchio));
  const rifiuto = await richieste(() => c.emetti('UploadLog', { type: 'create', data: { id: 'rif1', tipo_file: 'primarie', esito: 'errore', messaggio: 'Il file ha meno ordini di quelli in archivio' } }));
  verifica('un rifiuto a dati intatti no', Object.keys(rifiuto.letture).length === 0, JSON.stringify(rifiuto));
  const parz = await perPasso([['in_corso', { type: 'create', data: { id: 'pz1', tipo_file: 'primarie', esito: 'in_corso', modalita: 'sostituzione' } }],
    ['parziale', { type: 'update', data: { id: 'pz1', tipo_file: 'primarie', esito: 'parziale', modalita: 'sostituzione', messaggio: '3 righe non scritte' } }]]);
  verifica('un parziale ha riscritto l\'archivio: una lettura', JSON.stringify(parz.map(x => quante(x, 'PrimariaAci'))) === '[0,1]', JSON.stringify(parz));
  verifica('l\'iscrizione resta una', iscrizioni(c) === 1, String(iscrizioni(c)));
  r.smonta();
}

console.log('ASSEGNATI: LA MATRICE UNA VOLTA, E ANCHE IL DETTAGLIO (REGOLA 2)');
{
  let righe = [{ id: 'g1', id_ordine: 'ET10', stato: 'assegnato', ordine_immesso_il: '2026-09-01T08:00:00', anno: 2026, mese: 'Settembre', peso_stimato: 1000 }];
  const archivi = { Assegnato: righe };
  const { r, c, richieste, perPasso } = await monta('pages/Assegnati', {
    funzioni: { computeAssegnatiMatrix: async () => ({ kpi: {}, matrix: {}, filterOptions: {} }) },
    archivi, reali: ['@/components/shared/CercaIdOrdine'],
  });
  const tabs = () => trova(r.albero, el => el.type && el.type.__finto === 'Tabs' && (el.props.value === 'matrix' || el.props.value === 'detail' || el.props.value === 'ranking'))[0];
  const tabella = () => trova(r.albero, el => el.type && el.type.__finto === 'AssegnatiTable')[0];
  verifica('la pagina si monta senza errori: la matrice, nessuna lettura degli ordini, un\'iscrizione', r.errori.length === 0
    && c.funzioniChiamate('computeAssegnatiMatrix').length === 1 && c.letture('Assegnato').length === 0 && iscrizioni(c) === 1,
    `${String(r.errori[0] || '')} ${iscrizioni(c)}`);
  // nella matrice: la chiusura richiama la matrice, una volta
  let passi = sequenza('primarie');
  let q = await perPasso(passi);
  verifica('nella matrice: riga vecchia, apertura, chiusura, nota = 0, 0, 1, 0 matrici', JSON.stringify(q.map(x => x.funzioni.length)) === '[0,0,1,0]', descrivi(passi, q));
  // si apre il dettaglio: gli ordini si leggono
  q = await richieste(() => tabs().props.onValueChange('detail'));
  verifica('aperto il dettaglio, gli ordini si leggono una volta', quante(q, 'Assegnato') === 1 && tabella()?.props.records.length === 1, JSON.stringify(q));
  // un caricamento con il dettaglio a video: matrice e ordini, alla chiusura
  archivi.Assegnato = righe = [...righe, { id: 'g2', id_ordine: 'ET11', stato: 'assegnato', ordine_immesso_il: '2026-09-02T08:00:00', anno: 2026, mese: 'Settembre', peso_stimato: 800 }];
  passi = sequenza('primarie');
  q = await perPasso(passi);
  verifica('col dettaglio a video la chiusura rilegge la matrice e gli ordini, una volta', JSON.stringify(q.map(x => [x.funzioni.length, quante(x, 'Assegnato')])) === '[[0,0],[0,0],[1,1],[0,0]]',
    descrivi(passi, q));
  verifica('e il dettaglio mostra gli ordini nuovi', tabella()?.props.records.length === 2, String(tabella()?.props.records.length));
  // si torna alla matrice: un caricamento fa dimenticare gli ordini, che si rileggono riaprendo il dettaglio
  await richieste(() => tabs().props.onValueChange('matrix'));
  archivi.Assegnato = righe = [...righe, { id: 'g3', id_ordine: 'ET12', stato: 'assegnato', ordine_immesso_il: '2026-09-03T08:00:00', anno: 2026, mese: 'Settembre', peso_stimato: 900 }];
  passi = sequenza('primarie');
  q = await perPasso(passi);
  verifica('nella matrice la chiusura non legge gli ordini', q.every(x => quante(x, 'Assegnato') === 0) && q[2].funzioni.length === 1, descrivi(passi, q));
  q = await richieste(() => tabs().props.onValueChange('detail'));
  verifica('riaperto il dettaglio, gli ordini nuovi', quante(q, 'Assegnato') === 1 && tabella()?.props.records.length === 3, `${JSON.stringify(q)} ${tabella()?.props.records.length}`);
  q = await richieste(() => tabs().props.onValueChange('matrix'));
  q = await richieste(() => tabs().props.onValueChange('detail'));
  verifica('senza caricamenti nel mezzo il dettaglio non si rilegge', quante(q, 'Assegnato') === 0, JSON.stringify(q));
  // i filtri non rifanno l'iscrizione
  const anni = trova(r.albero, el => el.type && el.type.__finto === 'MultiSelect' && el.props.breve === 'Anni')[0];
  await richieste(() => anni.props.onChange(['2026']));
  verifica('cambiando un filtro l\'iscrizione resta una', c.chiamate.filter(x => x.tipo === 'iscrizione').length === 0 && iscrizioni(c) === 1, String(iscrizioni(c)));
  q = await perPasso(sequenza('secondarie'));
  verifica('un caricamento delle secondarie non c\'entra', q.every(x => x.funzioni.length === 0 && Object.keys(x.letture).length === 0), JSON.stringify(q));
  verifica('nessun errore', r.errori.length === 0, String(r.errori[0] || ''));
  r.smonta();
}

// UNA LETTURA FALLITA NON RIPARTE DA SOLA (revisione del 13/10/2026, script del
// revisore R5 assegnati_dettaglio_in_errore.mjs). L'effetto che legge il
// dettaglio scattava quando gli ordini non c'erano e nessuna lettura era in
// corso: lo stato che lascia una lettura fallita. Con un errore che persiste
// erano 51 letture su 51 errori, e a video «Nessun ordine assegnato trovato».
// Ora l'errore si dice, la lettura si riprova a mano, e un caricamento delle
// primarie vale come un nuovo tentativo.
console.log('ASSEGNATI: UNA LETTURA FALLITA SI DICE E SI RIPROVA A MANO');
{
  let fallisce = true;
  let tentativi = 0;
  const righe = [{ id: 'g1', id_ordine: 'ET10', stato: 'assegnato', ordine_immesso_il: '2026-09-01T08:00:00', anno: 2026, mese: 'Settembre', peso_stimato: 1000 }];
  // l'archivio che non risponde: ogni lettura di Assegnato fallisce finche' fallisce e' vero
  const archivi = new Proxy({}, { get: (_t, n) => {
    if (n !== 'Assegnato') return undefined;
    tentativi++;
    // oltre 60 tentativi l'archivio risponde comunque: col codice di prima la
    // prova finisce (con 61 letture) invece di girare per sempre
    if (fallisce && tentativi <= 60) throw new Error('Request failed with status code 500');
    return righe;
  } });
  const erroreVero = console.error; console.error = () => {};
  try {
    const { r, c, richieste, perPasso } = await monta('pages/Assegnati', {
      funzioni: { computeAssegnatiMatrix: async () => ({ kpi: {}, matrix: {}, filterOptions: {} }) },
      archivi, reali: ['@/components/shared/CercaIdOrdine'],
    });
    const tabs = () => trova(r.albero, el => el.type && el.type.__finto === 'Tabs' && ['matrix', 'detail'].includes(el.props.value))[0];
    const tabella = () => trova(r.albero, el => el.type && el.type.__finto === 'AssegnatiTable')[0];
    const avviso = () => trova(r.albero, el => el.type === 'span' && /Gli ordini non si sono (ri)?letti/.test(testo(el)))[0];
    const riprova = () => trova(r.albero, el => el.type === 'button' && /Riprova/.test(testo(el)))[0];
    let q = await richieste(async () => { tabs().props.onValueChange('detail'); await aspetta(200); });
    verifica('aperto il dettaglio con l\'archivio che non risponde: una lettura sola (erano 51 in 200 giri)', quante(q, 'Assegnato') === 1 && tentativi === 1, `${JSON.stringify(q)} tentativi ${tentativi}`);
    verifica('la pagina dice che gli ordini non si sono letti, col motivo', !!avviso() && /Request failed with status code 500/.test(testo(avviso())), avviso() ? testo(avviso()) : 'nessun avviso');
    verifica('e non mostra la tabella, che direbbe «Nessun ordine assegnato trovato»', !tabella(), 'la tabella c\'e\'');
    q = await richieste(async () => { tabs().props.onValueChange('matrix'); await aspetta(20); tabs().props.onValueChange('detail'); await aspetta(100); });
    verifica('tornando al dettaglio la lettura non riparte da sola', quante(q, 'Assegnato') === 0, JSON.stringify(q));
    q = await richieste(async () => { riprova().props.onClick(); await aspetta(100); });
    verifica('«Riprova» rilegge una volta, e se fallisce ancora lo dice ancora', quante(q, 'Assegnato') === 1 && !!avviso() && !tabella(), `${JSON.stringify(q)} ${!!avviso()}`);
    fallisce = false;
    q = await richieste(async () => { riprova().props.onClick(); await aspetta(100); });
    verifica('quando l\'archivio risponde, «Riprova» porta gli ordini e l\'avviso se ne va', quante(q, 'Assegnato') === 1 && !avviso() && tabella()?.props.records.length === 1, `${JSON.stringify(q)} ${!!avviso()} ${tabella()?.props.records?.length}`);
    // una rilettura che fallisce col dettaglio a video: gli ordini di prima
    // restano, e l'avviso dice che sono della lettura di prima
    fallisce = true;
    let passi = sequenza('primarie');
    q = await perPasso(passi);
    verifica('col dettaglio a video una rilettura fallita: una lettura sola, e la tabella resta con gli ordini di prima',
      JSON.stringify(q.map(x => quante(x, 'Assegnato'))) === '[0,0,1,0]' && tabella()?.props.records.length === 1, descrivi(passi, q));
    verifica('e l\'avviso dice che non si sono riletti e che sono quelli di prima', !!avviso() && /Gli ordini non si sono riletti \(Request failed with status code 500\): quelli a video sono della lettura di prima\./.test(testo(avviso())),
      avviso() ? testo(avviso()) : 'nessun avviso');
    // un caricamento chiuso vale come un nuovo tentativo, anche dopo un errore
    await richieste(async () => { tabs().props.onValueChange('matrix'); await aspetta(20); });
    passi = sequenza('primarie');
    q = await perPasso(passi);
    verifica('nella matrice un caricamento fa dimenticare gli ordini, senza leggerli', q.every(x => quante(x, 'Assegnato') === 0), descrivi(passi, q));
    q = await richieste(async () => { tabs().props.onValueChange('detail'); await aspetta(200); });
    verifica('riaperto il dettaglio con l\'archivio che non risponde: ancora una lettura sola', quante(q, 'Assegnato') === 1 && !!avviso(), JSON.stringify(q));
    fallisce = false;
    passi = sequenza('primarie');
    q = await perPasso(passi);
    verifica('col dettaglio a video, la chiusura di un caricamento rilegge e porta gli ordini', JSON.stringify(q.map(x => quante(x, 'Assegnato'))) === '[0,0,1,0]' && !avviso() && tabella()?.props.records.length === 1,
      descrivi(passi, q));
    verifica('nessun errore della pagina', r.errori.length === 0, String(r.errori[0] || ''));
    r.smonta();
  } finally {
    console.error = erroreVero;
  }
}

console.log('SECONDARIE: TUTTO ALLA CHIUSURA, GLI ALERT ALLA NOTA');
{
  let alertAperti = 2;
  const archivio = [{ id: 's1', id_ordine: 'ET20', stato: 'terminato', canale: 'RETE', stoccaggio: 'NAPPI SUD', destinazione: 'IRIGOM SRL', trasporto_finito_il: '2026-09-10T09:00:00', peso_effettivo: 20000 }];
  const { r, c, richieste, perPasso } = await monta('pages/Secondarie', {
    funzioni: {
      computeSecondarieMatrix: async () => ({ kpi: {}, matrix: {}, filterOptions: {} }),
      getAlerts: async () => ({ total: alertAperti }),
    },
    archivi: { Secondaria: archivio },
  });
  const badge = () => trova(r.albero, el => el.type && el.type.__finto === 'AlertBadge')[0]?.props.count ?? 0;
  const vista = () => trova(r.albero, el => el.type && el.type.__finto === 'Tabs' && ['matrix', 'detail', 'report'].includes(el.props.value))[0];
  verifica('la pagina si monta senza errori: matrice, alert e un\'iscrizione', r.errori.length === 0 && c.funzioniChiamate('computeSecondarieMatrix').length === 1
    && c.funzioniChiamate('getAlerts').length === 1 && iscrizioni(c) === 1 && badge() === 2, `${String(r.errori[0] || '')} ${iscrizioni(c)} ${badge()}`);
  await richieste(() => vista().props.onValueChange('detail'));
  const passi = sequenza('secondarie');
  const q = [];
  for (const [i, [, evento]] of passi.entries()) {
    if (i === 3) alertAperti = 7; // il motore ha scritto mentre il browser faceva i ricalcoli
    q.push(await richieste(() => c.emetti('UploadLog', evento)));
    q[i].badge = badge();
  }
  const sintesi = q.map(x => `${x.funzioni.join('+') || '-'}/${quante(x, 'Secondaria')}`);
  verifica('riga vecchia e apertura: niente', sintesi[0] === '-/0' && sintesi[1] === '-/0', sintesi.join(' · '));
  verifica('la chiusura: matrice, dettaglio e alert, una volta', sintesi[2] === 'computeSecondarieMatrix+getAlerts/1', sintesi.join(' · '));
  verifica('la nota: solo gli alert', sintesi[3] === 'getAlerts/0', sintesi.join(' · '));
  verifica('il contatore: quello di prima alla chiusura, quello del motore alla nota', q[2].badge === 2 && q[3].badge === 7, `${q[2].badge} ${q[3].badge}`);
  const pri = await perPasso(sequenza('primarie'));
  verifica('un caricamento delle primarie non c\'entra', pri.every(x => x.funzioni.length === 0 && Object.keys(x.letture).length === 0), JSON.stringify(pri));
  verifica('l\'iscrizione resta una, e nessun errore', iscrizioni(c) === 1 && r.errori.length === 0, `${iscrizioni(c)} ${String(r.errori[0] || '')}`);
  r.smonta();
}

// IL CONTATORE DEGLI ALERT CHE NON SI E' LETTO DICE «—», MAI 0 (chiusura del
// giro, 14/10/2026, come Terminati Rete dal 13/10/2026). Prima una risposta senza
// il conteggio diventava 0 e il segno spariva, e una lettura caduta lasciava a
// video il numero di prima.
console.log('SECONDARIE: GLI ALERT NON LETTI DICONO «—»');
{
  let risposta = { total: 4 };
  const archivio = [{ id: 's1', id_ordine: 'ET20', stato: 'terminato', canale: 'RETE', stoccaggio: 'NAPPI SUD', destinazione: 'IRIGOM SRL', trasporto_finito_il: '2026-09-10T09:00:00', peso_effettivo: 20000 }];
  const erroreVero = console.error; console.error = () => {};
  try {
    const { r, c, richieste } = await monta('pages/Secondarie', {
      funzioni: {
        computeSecondarieMatrix: async () => ({ kpi: {}, matrix: {}, filterOptions: {} }),
        getAlerts: async () => { if (risposta === 'cade') throw new Error('non risponde'); return risposta; },
      },
      archivi: { Secondaria: archivio },
    });
    const badge = () => trova(r.albero, el => el.type && el.type.__finto === 'AlertBadge')[0]?.props.count ?? null;
    const nonLetti = () => testo(trova(r.albero, el => el.type && el.type.__finto === 'Link' && /Alert aperti/.test(testo(el)))[0]).replace(/\s+/g, ' ').trim();
    verifica('con la risposta: il segno col numero, e nessun «—»', badge() === 4 && nonLetti() === '', `${badge()} ${nonLetti()}`);
    // la nota dei moduli aggiornati rilegge solo gli alert
    const nota = () => c.emetti('UploadLog', sequenza('secondarie')[3][1]);
    risposta = 'cade';
    await richieste(nota);
    verifica('una lettura che cade: niente segno col numero di prima, e il contatore dice «—»', badge() === null && nonLetti() === 'Alert aperti: — (non letti)', `${badge()} «${nonLetti()}»`);
    risposta = { by_modulo: {} };
    await richieste(nota);
    verifica('una risposta senza il conteggio: «—», non 0', badge() === null && nonLetti() === 'Alert aperti: — (non letti)', `${badge()} «${nonLetti()}»`);
    risposta = { total: 0 };
    await richieste(nota);
    verifica('zero alert letti: nessun segno e nessun «—»', badge() === null && nonLetti() === '', `${badge()} «${nonLetti()}»`);
    verifica('nessun errore della pagina', r.errori.length === 0, String(r.errori[0] || ''));
    r.smonta();
  } finally {
    console.error = erroreVero;
  }
}

console.log('PDR: UNA LETTURA PER CARICAMENTO, ANCHE QUANDO L\'ANAGRAFICA RESTA A META\'');
{
  const archivio = [{ id: 'p1', id_pdr: 315, ragione_sociale: 'MASTRIA GOMME SRL', provincia: 'NA' }];
  const { r, c, richieste, perPasso } = await monta('pages/Pdr', { archivi: { Pdr: archivio } });
  verifica('la pagina si monta senza errori, con una lettura e un\'iscrizione', r.errori.length === 0 && c.letture('Pdr').length === 1 && iscrizioni(c) === 1,
    `${String(r.errori[0] || '')} ${c.letture('Pdr').length} ${iscrizioni(c)}`);
  const evento = (id, campi) => () => c.emetti('UploadLog', { type: 'create', data: { id, tipo_file: 'pdr', nome_file: 'pdr.xlsx', ...campi } });
  let q = await richieste(evento('d1', { esito: 'successo', modalita: 'sostituzione', messaggio: '3000 PDR importati su 3000 totali' }));
  verifica('un caricamento riuscito: una lettura', quante(q, 'Pdr') === 1, JSON.stringify(q));
  q = await richieste(evento('d2', { esito: 'errore', messaggio: 'Il file ha meno PDR di quelli in archivio' }));
  verifica('un file rifiutato a dati intatti: nessuna lettura', quante(q, 'Pdr') === 0, JSON.stringify(q));
  q = await richieste(evento('d3', { esito: 'errore', messaggio: "Sostituzione non riuscita: 12 PDR su 3000 del file non sono entrati. Ripristinata l'anagrafica di prima (2990 PDR): ricarica il file." }));
  verifica('una sostituzione non riuscita con l\'anagrafica ripristinata: nessuna lettura', quante(q, 'Pdr') === 0, JSON.stringify(q));
  q = await richieste(evento('d4', { esito: 'errore', modalita: 'sostituzione', messaggio: "Sostituzione non riuscita: 12 PDR su 3000 del file non sono entrati; anche il ripristino dell'anagrafica di prima si e' fermato a 2500 PDR su 2990. L'anagrafica e' incompleta: ricarica il file." }));
  verifica('una sostituzione che lascia l\'anagrafica a meta\': si rilegge (regola 2)', quante(q, 'Pdr') === 1, JSON.stringify(q));
  q = await richieste(evento('d5', { esito: 'parziale', modalita: 'aggiunta', messaggio: '2900 PDR importati su 3000 totali' }));
  verifica('un\'aggiunta parziale: una lettura', quante(q, 'Pdr') === 1, JSON.stringify(q));
  const pri = await perPasso(sequenza('primarie'));
  verifica('un caricamento delle primarie non c\'entra', pri.every(x => quante(x, 'Pdr') === 0), JSON.stringify(pri));
  verifica('l\'iscrizione resta una, e nessun errore', iscrizioni(c) === 1 && r.errori.length === 0, `${iscrizioni(c)} ${String(r.errori[0] || '')}`);
  r.smonta();
}

console.log('TERZIARIE: SOLO I CARICAMENTI DELLE TERZIARIE, UNA VOLTA');
{
  const archivio = [{ id: 't1', id_ordine: 'ET30', stato: 'terminato', unita_locale_origine: 'IRIGOM SRL', destinazione: 'CEMENTERIA', trasporto_finito_il: '2026-09-10T09:00:00', peso_effettivo: 30000 }];
  const { r, c, perPasso, richieste } = await monta('pages/Terziarie', { archivi: { Terziaria: archivio } });
  verifica('la pagina si monta senza errori, con una lettura e un\'iscrizione', r.errori.length === 0 && c.letture('Terziaria').length === 1 && iscrizioni(c) === 1,
    `${String(r.errori[0] || '')} ${c.letture('Terziaria').length} ${iscrizioni(c)}`);
  let passi = sequenza('primarie');
  let q = await perPasso(passi);
  verifica('un caricamento delle primarie non rilegge le terziarie (erano tre letture)', q.every(x => quante(x, 'Terziaria') === 0), descrivi(passi, q));
  passi = sequenza('secondarie');
  q = await perPasso(passi);
  verifica('nemmeno uno delle secondarie', q.every(x => quante(x, 'Terziaria') === 0), descrivi(passi, q));
  passi = sequenza('terziarie', { conNota: false });
  q = await perPasso(passi);
  verifica('un caricamento delle terziarie: riga vecchia, apertura, chiusura = 0, 0, 1 letture', JSON.stringify(q.map(x => quante(x, 'Terziaria'))) === '[0,0,1]', descrivi(passi, q));
  // un filtro rilegge (com'era), ma non rifa' l'iscrizione
  const filtro = trova(r.albero, el => el.type && el.type.__finto === 'MultiSelect')[0];
  q = await richieste(() => filtro.props.onChange([filtro.props.options?.[0] || 'IRIGOM SRL']));
  verifica('cambiando un filtro l\'iscrizione resta una', c.chiamate.filter(x => x.tipo === 'iscrizione').length === 0 && iscrizioni(c) === 1, String(iscrizioni(c)));
  passi = sequenza('terziarie', { conNota: false });
  q = await perPasso(passi);
  verifica('e il caricamento dopo il filtro rilegge ancora una volta', JSON.stringify(q.map(x => quante(x, 'Terziaria'))) === '[0,0,1]', descrivi(passi, q));
  verifica('nessun errore', r.errori.length === 0, String(r.errori[0] || ''));
  r.smonta();
}

// LA PREDITTIVITA' DELLE SECONDARIE (revisione del 13/10/2026, rilievo della
// revisione di R5). Era l'ultima pagina iscritta al registro con la regola
// vecchia: ogni evento non «in_corso» di primarie o secondarie faceva ripartire
// il calcolo dell'anno intero dopo 4 secondi. Per un caricamento erano due o tre
// calcoli: alla riga vecchia chiusa in errore, alla chiusura e alla nota, che
// arriva una ventina di secondi dopo; e un file rifiutato a dati intatti
// ricalcolava lo stesso. Ora passa dalla regola comune: un calcolo alla
// chiusura, dopo l'attesa che c'era. Il calcolo legge archivi, giacenze e
// configurazione, non quello che i ricalcoli del caricamento scrivono dopo:
// alla nota non serve niente.
//
// La pagina chiede chi e' collegato (usePermessi, dal contesto
// dell'autenticazione, che la pagina finta non ha): si monta una copia del
// sorgente vero in cui solo quella riga e' sostituita, cosi' l'iscrizione al
// registro e il calcolo sono quelli della pagina.
console.log('PREDITTIVITA\' DELLE SECONDARIE: UN RICALCOLO PER CARICAMENTO, ALLA CHIUSURA');
{
  const IMPORT_PERMESSI = "import { usePermessi } from '@/lib/permessi';";
  const sorgente = readFileSync(fileURLToPath(new URL('../src/pages/PredittivitaSecondarie.jsx', import.meta.url)), 'utf8').replace(/\r/g, '');
  verifica('la pagina prende i permessi da usePermessi, come la copia si aspetta', sorgente.includes(IMPORT_PERMESSI));
  const cartella = mkdtempSync(join(tmpdir(), 'predittivita-'));
  const copia = join(cartella, 'PredittivitaSecondarie.jsx');
  writeFileSync(copia, sorgente.replace(IMPORT_PERMESSI, "const usePermessi = () => ({ isAdmin: true, soloLettura: false });"));
  const orologio = orologioFinto().installa();
  const ATTESA = 4000;
  try {
    const p = await caricaPagina('pages/PredittivitaSecondarie', { file: copia });
    const c = clienteFinto({ funzioni: {
      calcolaPianificazioneSecondaria: async (corpo) => ({ anno: corpo.anno, impianti: [], programma: [], stoccaggi: [], settimane: [], avvisi: [] }),
    } });
    globalThis.__CLIENTE_FINTO = c.cliente;
    // La pagina esportata decide solo se portare alla configurazione: il lavoro
    // lo fa il componente che restituisce, che si monta lui.
    const esterna = p.monta(p.Componente, {});
    const Interna = esterna.albero && esterna.albero.type;
    const r = p.monta(Interna, {});
    await aspetta(60);
    const calcoli = () => c.funzioniChiamate('calcolaPianificazioneSecondaria').length;
    const aperti = () => (trova(r.albero, el => el.type && el.type.name === 'Avvisi')[0]?.props.aperti || []);
    verifica('la pagina si monta senza errori: un calcolo e un\'iscrizione', typeof Interna === 'function' && Interna.name === 'Predittivita' && r.errori.length === 0
      && calcoli() === 1 && iscrizioni(c) === 1, `${Interna && Interna.name} ${String(r.errori[0] || '')} ${calcoli()} ${iscrizioni(c)}`);
    // Un evento, poi passa l'attesa: quanti calcoli sono partiti.
    const dopoAttesa = async (evento) => {
      c.azzera();
      c.emetti('UploadLog', evento);
      await aspetta(20);
      await orologio.avanza(ATTESA + 1000);
      await aspetta(40);
      return calcoli();
    };
    const perPassoAttesa = async (passi) => { const q = []; for (const [, evento] of passi) q.push(await dopoAttesa(evento)); return q; };
    let passi = sequenza('primarie');
    let q = await perPassoAttesa(passi);
    verifica('caricamento delle primarie: riga vecchia, apertura, chiusura, nota = 0, 0, 1, 0 calcoli (erano 1, 0, 1, 1)', JSON.stringify(q) === '[0,0,1,0]',
      passi.map(([nome], i) => `${nome}: ${q[i]}`).join(' · '));
    passi = sequenza('secondarie');
    q = await perPassoAttesa(passi);
    verifica('caricamento delle secondarie: 0, 0, 1, 0', JSON.stringify(q) === '[0,0,1,0]', passi.map(([nome], i) => `${nome}: ${q[i]}`).join(' · '));
    q = await dopoAttesa({ type: 'create', data: { id: 'pr1', tipo_file: 'primarie_rete', esito: 'successo', messaggio: 'ok' } });
    verifica('il tipo di una volta, primarie_rete, ricalcola ancora', q === 1, String(q));
    // l'avviso del caricamento aperto: entra all'apertura, esce a qualunque esito
    q = await dopoAttesa({ type: 'create', data: { id: 'r1', tipo_file: 'secondarie', esito: 'in_corso', utente: 'admin' } });
    verifica('un caricamento aperto: nessun calcolo, e la pagina lo mostra', q === 0 && JSON.stringify(aperti()) === '[{"tipo_file":"secondarie","utente":"admin"}]', `${q} ${JSON.stringify(aperti())}`);
    q = await dopoAttesa({ type: 'update', data: { id: 'r1', tipo_file: 'secondarie', esito: 'errore', utente: 'admin', messaggio: 'Il file ha meno righe di quelle in archivio' } });
    verifica('rifiutato a dati intatti: nessun calcolo (prima uno), e l\'avviso se ne va', q === 0 && aperti().length === 0, `${q} ${JSON.stringify(aperti())}`);
    await dopoAttesa({ type: 'create', data: { id: 'r2', tipo_file: 'primarie', esito: 'in_corso', utente: 'admin' } });
    q = await dopoAttesa({ type: 'update', data: { id: 'r2', tipo_file: 'primarie', esito: 'errore', modalita: 'sostituzione',
      messaggio: "Caricamento interrotto: avviato da admin e mai concluso. L'archivio poteva essere incompleto; e' stato ricaricato dopo." } });
    verifica('la riga aperta che un caricamento nuovo chiude: nessun calcolo, lo fa la chiusura del nuovo, e l\'avviso se ne va', q === 0 && aperti().length === 0, `${q} ${JSON.stringify(aperti())}`);
    q = await dopoAttesa({ type: 'update', data: { id: 'r3', tipo_file: 'secondarie', esito: 'parziale', messaggio: '3 righe non scritte' } });
    verifica('un parziale ha riscritto l\'archivio: un calcolo', q === 1, String(q));
    // due caricamenti chiusi a un secondo l'uno dall'altro: un calcolo solo, come prima
    c.azzera();
    c.emetti('UploadLog', { type: 'update', data: { id: 'r4', tipo_file: 'primarie', esito: 'successo', messaggio: 'ok' } });
    await aspetta(20);
    await orologio.avanza(1000);
    c.emetti('UploadLog', { type: 'update', data: { id: 'r5', tipo_file: 'secondarie', esito: 'successo', messaggio: 'ok' } });
    await aspetta(20);
    await orologio.avanza(ATTESA - 500);
    verifica('prima che passi l\'attesa dall\'ultima chiusura non parte niente', calcoli() === 0, String(calcoli()));
    await orologio.avanza(1000);
    await aspetta(40);
    verifica('poi un calcolo solo per i due caricamenti', calcoli() === 1, String(calcoli()));
    const altri = [await dopoAttesa({ type: 'create', data: { id: 't1', tipo_file: 'terziarie', esito: 'successo', messaggio: 'ok' } }),
      await dopoAttesa({ type: 'create', data: { id: 'd1', tipo_file: 'pdr', esito: 'successo', messaggio: 'ok' } })];
    verifica('terziarie e PDR non c\'entrano', JSON.stringify(altri) === '[0,0]', JSON.stringify(altri));
    verifica('l\'iscrizione resta una, e nessun errore', iscrizioni(c) === 1 && r.errori.length === 0 && esterna.errori.length === 0, `${iscrizioni(c)} ${String(r.errori[0] || '')}`);
    r.smonta();
    verifica('smontata, l\'iscrizione si chiude', iscrizioni(c) === 0, String(iscrizioni(c)));
  } finally {
    orologio.ripristina();
    rmSync(cartella, { recursive: true, force: true });
  }
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
