// LO STIMATO ACI SOTTO I 1.500 KG NEGLI ASSEGNATI (decisione del 13/10/2026).
//
// Parole dell'utente: «nessun aci può avere uno stimato inferiore a 1.500 kg, se
// negli assegnati del portale è indicato così limitati a segnalarlo e
// provvederemo a farlo modificare al consorzio». Fino a oggi lo segnalavano solo
// i Terminati ACI, cioe' a ritiro fatto: negli Assegnati ACI, dove l'ordine e'
// ancora da evadere e si puo' far correggere, non si vedeva. Ora la pagina
// Assegnati, nella vista ACI, ha un riquadro col conto e un segno per ogni riga,
// con la stessa regola dei Terminati ACI (src/lib/controlliPortaleAci.js). Il
// caso vero: ET26084363, stimato 1.400 kg.
//
// La pagina gira davvero, con il client finto che conta le richieste
// (prove/dati/paginaFinta.mjs).
import { caricaPagina, clienteFinto, aspetta, trova, testo } from './dati/paginaFinta.mjs';
import { caricaLibPagine } from './dati/libPagine.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = JSON.stringify;

const controlli = await caricaLibPagine('lib/controlliPortaleAci');

console.log('LA REGOLA E\' UNA SOLA');
{
  const { controlliPortaleAci, problemiDellaRiga, stimatoSottoMinimo, MINIMO_ACI_KG } = controlli;
  verifica('la regola dello stimato e\' esportata, e il minimo e\' 1.500 kg', typeof stimatoSottoMinimo === 'function' && MINIMO_ACI_KG === 1500);
  const righe = [
    { id: 'a', id_ordine: 'ET26084363', peso_stimato: 1400 },
    { id: 'b', id_ordine: 'ET2', peso_stimato: 1500 },
    { id: 'c', id_ordine: 'ET3', peso_stimato: null },
    { id: 'd', id_ordine: 'ET4', peso_stimato: 0 },
    { id: 'e', id_ordine: 'ET5', peso_stimato: '1499' },
  ];
  verifica('sotto il minimo: 1.400 e 1.499; 1.500 no, senza stimato no (un dato che manca non e\' zero)',
    J(righe.filter(r => stimatoSottoMinimo && stimatoSottoMinimo(r)).map(r => r.id)) === J(['a', 'e'])
    && J(controlliPortaleAci(righe).sotto_minimo.map(r => r.id)) === J(['a', 'e']), J(controlliPortaleAci(righe).sotto_minimo.map(r => r.id)));
  verifica('la frase della riga scrive i chili all\'italiana: «stimato 1.400 kg»', /^stimato 1\.400 kg, sotto i 1\.500 kg ammessi per una richiesta ACI$/.test(problemiDellaRiga(righe[0])[0] || ''), problemiDellaRiga(righe[0])[0]);
  verifica('e cosi\' l\'effettivo oltre il 110% e il massimo', /effettivo 3\.100 kg oltre il 110% dello stimato del ticket \(massimo 3\.080 kg\)/.test(problemiDellaRiga({ peso_stimato: 2800, peso_effettivo: 3100 }).join()), problemiDellaRiga({ peso_stimato: 2800, peso_effettivo: 3100 }).join());
}

// Monta la pagina Assegnati: entity 'AssegnatoAci' e' la vista ACI (src/pages/AssegnatiAci.jsx).
async function monta(entity, archivio) {
  const p = await caricaPagina('pages/Assegnati', { reali: ['@/components/shared/CercaIdOrdine'] });
  const c = clienteFinto({ funzioni: { computeAssegnatiMatrix: async () => ({ kpi: {}, matrix: {}, filterOptions: {} }) }, archivi: { [entity]: archivio } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const r = p.monta(p.Componente, { entity });
  await aspetta(60);
  const riquadro = () => trova(r.albero, el => el.type === 'div' && /border-amber-300/.test(el.props.className || ''))[0];
  const tabs = () => trova(r.albero, el => el.type && el.type.__finto === 'Tabs' && ['matrix', 'detail'].includes(el.props.value))[0];
  const tabella = () => trova(r.albero, el => el.type && el.type.__finto === 'AssegnatiTable')[0];
  return { r, c, riquadro, tabs, tabella };
}

const ordine = (id, id_ordine, stimato, campi = {}) => ({
  id, id_ordine, stato: 'assegnato', classe: 'PFU Autodemolizione', ordine_immesso_il: '2026-10-01T08:00:00', anno: 2026, mese: 'Ottobre',
  numero_ordine_interno: `T-${id}`, ragione_sociale: `AUTODEMOLIZIONE ${id.toUpperCase()}`, peso_stimato: stimato, ...campi,
});
const ARCHIVIO = [
  ordine('a1', 'ET26084363', 1400, { numero_ordine_interno: '160001-01', ragione_sociale: 'AUTODEMOLIZIONI ROSSI SRL' }),
  ordine('a2', 'ET26100001', 2000),
  ordine('a3', 'ET26100002', null),
  ordine('a4', 'ET26100003', 1500),
];

console.log('LA VISTA ACI: IL RIQUADRO SUBITO, SOPRA LA MATRICE');
{
  const { r, c, riquadro, tabs, tabella } = await monta('AssegnatoAci', ARCHIVIO);
  verifica('la pagina si monta senza errori: la matrice e una lettura degli ordini', r.errori.length === 0
    && c.funzioniChiamate('computeAssegnatiMatrix').length === 1 && c.letture('AssegnatoAci').length === 1, `${String(r.errori[0] || '')} ${c.letture('AssegnatoAci').length}`);
  const t = riquadro() ? testo(riquadro()) : '';
  verifica('il riquadro dice il conto e chi deve correggere', /^Un ordine con lo stimato sotto i 1\.500 kg ammessi: da far correggere al consorzio\./.test(t), t);
  verifica('e dice l\'ordine, il ticket, il punto di raccolta e lo stimato all\'italiana', /ET26084363 \(ticket 160001-01, AUTODEMOLIZIONI ROSSI SRL, stimato 1\.400 kg\)/.test(t), t);
  verifica('l\'ordine senza stimato e quello a 1.500 kg non ci sono', !/ET26100002|ET26100003|ET26100001/.test(t), t);
  // il segno delle righe: lo passa alla tabella, per ogni ordine fuori regola
  c.azzera();
  tabs().props.onValueChange('detail');
  await aspetta(60);
  verifica('aperto il dettaglio gli ordini non si rileggono: ci sono gia\'', c.letture('AssegnatoAci').length === 0, String(c.letture('AssegnatoAci').length));
  const segni = tabella()?.props.segni;
  verifica('la tabella riceve il segno della riga ET26084363, con la frase', segni instanceof Map && segni.size === 1
    && /^stimato 1\.400 kg, sotto i 1\.500 kg ammessi per una richiesta ACI$/.test((segni.get('a1') || [])[0] || ''), segni ? J([...segni]) : 'nessun segno');
  // l'ID nel riquadro porta all'ordine
  const pulsante = trova(riquadro(), el => el.type === 'button' && testo(el) === 'ET26084363')[0];
  pulsante.props.onClick();
  await aspetta(60);
  const cerca = trova(r.albero, el => typeof el.type === 'function' && el.props && 'trovati' in el.props && 'onChange' in el.props)[0];
  verifica('l\'ID nel riquadro cerca l\'ordine nel dettaglio', cerca?.props.value === 'ET26084363' && tabs().props.value === 'detail' && J(tabella()?.props.records.map(x => x.id)) === J(['a1']),
    `${cerca?.props.value} ${tabs().props.value} ${J(tabella()?.props.records.map(x => x.id))}`);
  // un caricamento con la matrice a video rilegge gli ordini: il riquadro deve restare vero
  cerca.props.onChange('');
  await aspetta(20);
  tabs().props.onValueChange('matrix');
  await aspetta(20);
  c.azzera();
  c.emetti('UploadLog', { type: 'update', data: { id: 'u1', tipo_file: 'primarie', esito: 'successo', modalita: 'sostituzione', messaggio: 'ok' } });
  await aspetta(60);
  verifica('nella vista ACI la chiusura di un caricamento rilegge gli ordini anche con la matrice a video', c.letture('AssegnatoAci').length === 1 && c.funzioniChiamate('computeAssegnatiMatrix').length === 1,
    `${c.letture('AssegnatoAci').length} ${c.funzioniChiamate('computeAssegnatiMatrix').length}`);
  verifica('nessun errore', r.errori.length === 0, String(r.errori[0] || ''));
  r.smonta();
}

console.log('CON I FILTRI, E CON PIU\' ORDINI');
{
  // Gli ordini del 2025 lo sono anche nell'immissione: dal 16/10/2026 (difetto 9)
  // la pagina legge l'anno dall'immissione, non dal campo anno salvato, e con
  // l'immissione del modello (01/10/2026) sarebbero del 2026.
  const molti = [...ARCHIVIO, ...Array.from({ length: 6 }, (_, k) => ordine(`b${k}`, `ET2610100${k}`, 1000 + k * 10, { anno: 2025, mese: 'Ottobre', ordine_immesso_il: '2025-10-01T08:00:00' }))];
  const { r, riquadro } = await monta('AssegnatoAci', molti);
  const t = riquadro() ? testo(riquadro()) : '';
  verifica('sette ordini: il conto, i primi cinque e «e altri 2»', /^7 ordini con lo stimato sotto i 1\.500 kg ammessi/.test(t) && / e altri 2\./.test(t), t);
  const anni = trova(r.albero, el => el.type && el.type.__finto === 'MultiSelect' && el.props.breve === 'Anni')[0];
  anni.props.onChange(['2026']);
  await aspetta(60);
  const t2 = riquadro() ? testo(riquadro()) : '';
  verifica('col filtro sull\'anno conta solo gli ordini dei filtri, e lo dice', /^Un ordine con lo stimato sotto i 1\.500 kg ammessi: da far correggere al consorzio \(con i filtri attivi\)\./.test(t2), t2);
  r.smonta();
}

// IL SEGNO SULLE RIGHE (chiusura del giro, 14/10/2026). La pagina passava gia' i
// segni alla tabella, ma AssegnatiTable li ignorava: l'ordine sotto il minimo si
// vedeva solo nel riquadro. Ora la riga si colora e l'ID porta il triangolo col
// perche' nel title, come nei Terminati ACI.
console.log('LA TABELLA DISEGNA IL SEGNO SULLA RIGA');
{
  const t = await caricaPagina('components/assegnati/AssegnatiTable');
  globalThis.__CLIENTE_FINTO = clienteFinto({ archivi: {} }).cliente;
  const righe = [ordine('a1', 'ET26084363', 1400), ordine('a2', 'ET26100001', 2000)];
  const segni = new Map([['a1', ['stimato 1.400 kg, sotto i 1.500 kg ammessi per una richiesta ACI']]]);
  const r = t.monta(t.Componente, { records: righe, loading: false, segni });
  await aspetta(30);
  const righeTabella = trova(r.albero, el => el.type === 'tr' && /border-t/.test(el.props.className || ''));
  const segnate = righeTabella.filter(el => /bg-red-50/.test(el.props.className || ''));
  verifica('la riga dell\'ordine sotto il minimo e\' colorata, l\'altra no', righeTabella.length === 2 && segnate.length === 1 && /ET26084363/.test(testo(segnate[0])), `${righeTabella.length} ${segnate.length}`);
  const triangolo = trova(r.albero, el => el.type === 'span' && /^Controlli del portale: /.test(el.props.title || ''))[0];
  verifica('l\'ID porta il segno, col perche\' nel title e per chi legge lo schermo', !!triangolo && triangolo.props.title === 'Controlli del portale: stimato 1.400 kg, sotto i 1.500 kg ammessi per una richiesta ACI'
    && triangolo.props['aria-label'] === triangolo.props.title, triangolo ? triangolo.props.title : 'nessun segno');
  const senza = t.monta(t.Componente, { records: righe, loading: false });
  await aspetta(30);
  verifica('senza segni la tabella e\' quella di prima', trova(senza.albero, el => el.type === 'tr' && /bg-red-50/.test(el.props.className || '')).length === 0
    && !trova(senza.albero, el => el.type === 'span' && /^Controlli del portale/.test(el.props.title || '')).length);
  verifica('nessun errore della tabella', r.errori.length === 0 && senza.errori.length === 0, String(r.errori[0] || senza.errori[0] || ''));
  r.smonta(); senza.smonta();
}

console.log('LA VISTA RETE NON C\'ENTRA');
{
  // Negli assegnati della rete la regola dei 1.500 kg non vale, e gli ordini si
  // leggono solo aprendo il dettaglio, come prima.
  const rete = [{ ...ordine('r1', 'ET26200001', 800), classe: 'A' }];
  const { r, c, riquadro, tabs, tabella } = await monta('Assegnato', rete);
  verifica('aperta la rete: nessuna lettura degli ordini e nessun riquadro', c.letture('Assegnato').length === 0 && !riquadro(), `${c.letture('Assegnato').length} ${!!riquadro()}`);
  tabs().props.onValueChange('detail');
  await aspetta(60);
  verifica('aperto il dettaglio: una lettura, nessun riquadro e nessun segno', c.letture('Assegnato').length === 1 && !riquadro() && tabella()?.props.segni?.size === 0,
    `${c.letture('Assegnato').length} ${!!riquadro()} ${tabella()?.props.segni?.size}`);
  r.smonta();
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
