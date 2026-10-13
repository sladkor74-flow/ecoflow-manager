// TERMINATI RETE: UNA LETTURA SOLA, I FILTRI IN MEMORIA, E LA RICERCA PER PDR
// (segnalazione alta A14 del 20/09, corretta il 12/10/2026, e richiesta
// dell'utente del 12/10/2026: «nei terminati rete serve un campo ricerca per pdr»).
//
// Ogni filtro della pagina - anche il giorno, il trasportatore o la
// destinazione, che nessun riquadro guarda - rileggeva l'archivio delle primarie
// (10.487 righe l'11/10/2026) e richiamava le quattro funzioni dei riquadri:
// sette richieste a ogni clic, sul limite al minuto che vale per tutta l'app.
// Qui la pagina vera gira con un client finto (prove/dati/paginaFinta.mjs) che
// conta le richieste, e si controlla che a video ci siano gli stessi ordini di
// prima: filtri, avvisi e conteggi seguono le regole di sempre (giorno italiano
// della fine trasporto, i terminati senza fine fuori dai periodi, l'ID cercato
// in tutto l'archivio).
//
// Un caricamento delle primarie si rilegge una volta (revisione del
// 13/10/2026): con la sequenza vera di importaBlocco, la riga vecchia chiusa in
// errore, quella nuova in_corso, la chiusura e la nota a ricalcoli finiti, la
// pagina rileggeva tre volte l'archivio e le quattro funzioni. Alla nota pero'
// si rileggono gli alert, e solo quelli: li scrive runAlertEngine, lanciato
// dal workflow sullo stesso aggiornamento che chiude il caricamento, e alla
// chiusura il contatore risponde ancora con quelli di prima (rilievo della
// revisione di G7, script terminati_alert_dopo_caricamento.mjs).
//
// La ricerca per punto di raccolta: il codice PDR (uguale, non contenuto) o il
// nome come lo scrive il portale, punto di raccolta o ragione sociale, senza che
// maiuscole, spazi, accenti e punteggiatura contino; dentro i filtri, come in
// Assegnati Rete, col conteggio dei trovati e di quanti ne ha in tutto
// l'archivio, e cercando si apre il dettaglio degli ordini. Nessuna richiesta.
import { caricaPagina, clienteFinto, aspetta, trova, testo } from './dati/paginaFinta.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Otto ordini che toccano i casi delle regole.
const ARCHIVIO = [
  { id: 'a1', id_ordine: 'ET26000101', stato: 'terminato', regione: 'Campania', trasportatore: 'NAPPI SUD SRL', destinazione: 'IRIGOM SRL',
    ordine_immesso_il: '2026-09-01T08:00:00', trasporto_iniziato_il: '2026-09-10T07:00:00', trasporto_finito_il: '2026-09-10T09:00:00',
    id_pdr: 315, punto_di_raccolta: 'MASTRIA GOMME SRL - VIALE PIO X', ragione_sociale: 'MASTRIA GOMME SRL', comune: 'Napoli', provincia: 'NA' },
  { id: 'a2', id_ordine: 'ET26000102', stato: 'terminato', regione: 'Campania', trasportatore: 'NAPPI SUD SRL', destinazione: 'GATIM SRL',
    ordine_immesso_il: '2026-07-20T08:00:00', trasporto_iniziato_il: '2026-08-05T07:00:00', trasporto_finito_il: '2026-08-05T09:00:00',
    id_pdr: 317, punto_di_raccolta: 'MASTRIA GOMME SRL - VIALE EUROPA', ragione_sociale: 'MASTRIA GOMME SRL', comune: 'Napoli', provincia: 'NA' },
  { id: 'a3', id_ordine: 'ET25000999', stato: 'terminato', regione: 'Basilicata', trasportatore: 'EMMESSE SRL', destinazione: 'IRIGOM SRL',
    ordine_immesso_il: '2025-12-01T08:00:00', trasporto_iniziato_il: '2025-12-20T07:00:00', trasporto_finito_il: '2025-12-20T09:00:00',
    id_pdr: 223, punto_di_raccolta: 'Eurogomme di Greco Giuseppe - Nemoli', ragione_sociale: 'Eurogomme di Greco Giuseppe', comune: 'Nemoli', provincia: 'PZ' },
  // terminato senza fine trasporto: nessun periodo, si segnala
  { id: 'a4', id_ordine: 'ET26000104', stato: 'terminato', regione: 'Campania', trasportatore: 'NAPPI SUD SRL', destinazione: 'IRIGOM SRL',
    ordine_immesso_il: '2026-09-01T08:00:00', trasporto_iniziato_il: '2026-09-11T07:00:00', trasporto_finito_il: null,
    id_pdr: 315, punto_di_raccolta: 'MASTRIA GOMME SRL - VIALE PIO X', ragione_sociale: 'MASTRIA GOMME SRL', comune: 'Napoli', provincia: 'NA' },
  { id: 'a5', id_ordine: 'ET26000105', stato: 'cancellato', regione: 'Puglia', trasportatore: '', destinazione: '',
    ordine_immesso_il: '2026-09-15T08:00:00', trasporto_iniziato_il: null, trasporto_finito_il: null,
    id_pdr: 42872, punto_di_raccolta: 'EUROGOMME SRL - LAVELLO', ragione_sociale: 'EUROGOMME SRL', comune: 'Lavello', provincia: 'PZ' },
  // fine trasporto alle 23:30 UTC del 30/09: in Italia e' gia' il 1° ottobre
  { id: 'a6', id_ordine: 'ET26000106', stato: 'terminato', regione: 'Campania', trasportatore: 'EMMESSE SRL', destinazione: 'GATIM SRL',
    ordine_immesso_il: '2026-09-20T08:00:00', trasporto_iniziato_il: '2026-09-30T20:00:00Z', trasporto_finito_il: '2026-09-30T23:30:00Z',
    id_pdr: 1315, punto_di_raccolta: 'PNEUS 2000 S.r.l.', ragione_sociale: 'PNEUS 2000 S.r.l.', comune: 'Salerno', provincia: 'SA' },
  // eseguito a portale: non terminato, si colloca con l'immissione
  { id: 'a7', id_ordine: 'ET26000107', stato: 'eseguito', regione: 'Campania', trasportatore: 'NAPPI SUD SRL', destinazione: 'IRIGOM SRL',
    ordine_immesso_il: '2026-09-20T08:00:00', trasporto_iniziato_il: '2026-09-25T07:00:00', trasporto_finito_il: '2026-09-25T09:00:00',
    id_pdr: 315, punto_di_raccolta: 'MASTRIA GOMME SRL - VIALE PIO X', ragione_sociale: 'MASTRIA GOMME SRL', comune: 'Napoli', provincia: 'NA' },
  { id: 'a8', id_ordine: 'ET26000108', stato: 'terminato', regione: 'Calabria', trasportatore: 'EMMESSE SRL', destinazione: 'IRIGOM SRL',
    ordine_immesso_il: '2026-09-02T08:00:00', trasporto_iniziato_il: '2026-09-12T07:00:00', trasporto_finito_il: '2026-09-12T09:00:00',
    id_pdr: 323, punto_di_raccolta: 'PNEUMATICI SANTA LUCIA - CITTÀ DI CASTELLO', ragione_sociale: "GOMME DELL'ÀNGELO SAS", comune: 'Lamezia Terme', provincia: 'CZ' },
];

// Gli alert aperti sul server: li cambia il motore, a caricamento chiuso.
let alertAperti = 2;
const FUNZIONI = {
  computeProvinceMatrix: async () => ({ righe: [] }),
  computeRaccoglitoriMix: async () => ({ raccoglitori: [] }),
  computeSlaMetrics: async () => ({ trasportatori: [] }),
  getAlerts: async () => ({ total: alertAperti }),
};

const { Componente, monta } = await caricaPagina('pages/PrimarieRete', { reali: ['@/components/shared/CercaIdOrdine', '@/components/shared/CercaPdr'] });
const c = clienteFinto({ funzioni: FUNZIONI, archivi: { PrimariaRete: ARCHIVIO } });
globalThis.__CLIENTE_FINTO = c.cliente;
const r = monta(Componente, {});
await aspetta();

const ids = (righe) => (righe || []).map(x => x.id).sort().join(',');
const uno = (nome, cond) => trova(r.albero, el => el.type && (el.type.__finto === nome || el.type.name === nome) && (!cond || cond(el)))[0];
const tabella = () => uno('PrimarieReteTable');
const mostrati = () => ids(tabella()?.props.records);
const avvisoDate = () => ids(uno('AvvisoDateDaSistemare')?.props.righe);
const multi = (breve) => uno('MultiSelect', el => el.props.breve === breve);
const etichettaDettaglio = () => testo(trova(r.albero, el => el.type && el.type.__finto === 'TabsTrigger' && el.props.value === 'dettaglio')[0]);
const cercaPdr = () => uno('CercaPdr');
const cercaId = () => uno('CercaIdOrdine');
const tabs = () => uno('Tabs');
// Le richieste partite da un'azione: si azzera il registro prima di farla.
const richieste = async (azione) => {
  c.azzera();
  await azione();
  await aspetta();
  return {
    letture: c.letture('PrimariaRete').length,
    funzioni: c.funzioniChiamate().map(x => x.nome).sort(),
    iscrizioni: c.chiamate.filter(x => x.tipo === 'iscrizione').length,
    mix: c.funzioniChiamate('computeRaccoglitoriMix').map(x => x.payload),
    sla: c.funzioniChiamate('computeSlaMetrics').map(x => x.payload),
  };
};
const scegli = (breve, valori) => () => multi(breve).props.onChange(valori);

console.log("ALL'APERTURA: L'ARCHIVIO UNA VOLTA E I QUATTRO RIQUADRI");
{
  verifica('la pagina si monta senza errori', r.errori.length === 0, String(r.errori[0] || ''));
  verifica('una lettura delle primarie', c.letture('PrimariaRete').length === 1, String(c.letture('PrimariaRete').length));
  verifica('le quattro funzioni dei riquadri', ['computeProvinceMatrix', 'computeRaccoglitoriMix', 'computeSlaMetrics', 'getAlerts'].every(n => c.funzioniChiamate(n).length === 1),
    JSON.stringify(c.funzioniChiamate().map(x => x.nome)));
  verifica("e un'iscrizione sola ai caricamenti", c.iscritti.length === 1, String(c.iscritti.length));
  verifica('a video tutto l\'archivio', mostrati() === 'a1,a2,a3,a4,a5,a6,a7,a8', mostrati());
  verifica('la scheda dice le righe', /Dettaglio Ordini \(8 righe\)/.test(etichettaDettaglio()), etichettaDettaglio());
  verifica('i filtri offrono i valori dell\'archivio', JSON.stringify(multi('Trasportatori').props.options) === '["EMMESSE SRL","NAPPI SUD SRL"]'
    && JSON.stringify(multi('Anni').props.options) === '["2026","2025"]', JSON.stringify([multi('Trasportatori').props.options, multi('Anni').props.options]));
  verifica('gli eseguiti si contano su tutto l\'archivio', uno('AvvisoEseguiti')?.props.righe.length === 8);
}

console.log('I FILTRI CHE NESSUN RIQUADRO GUARDA NON RILEGGONO NIENTE');
{
  let q = await richieste(scegli('Trasportatori', ['EMMESSE SRL']));
  verifica('trasportatore: nessuna lettura, nessuna funzione', q.letture === 0 && q.funzioni.length === 0, JSON.stringify(q));
  verifica('e a video i suoi ordini', mostrati() === 'a3,a6,a8', mostrati());
  q = await richieste(scegli('Destinazioni', ['IRIGOM SRL']));
  verifica('destinazione: nessuna richiesta', q.letture === 0 && q.funzioni.length === 0, JSON.stringify(q));
  verifica('trasportatore e destinazione insieme', mostrati() === 'a3,a8', mostrati());
  q = await richieste(() => trova(r.albero, el => el.type === 'input' && el.props.type === 'date')[0].props.onChange({ target: { value: '2026-09-12' } }));
  verifica('giorno: nessuna richiesta', q.letture === 0 && q.funzioni.length === 0, JSON.stringify(q));
  verifica('il giorno della fine trasporto', mostrati() === 'a8', mostrati());
  q = await richieste(() => { trova(r.albero, el => el.type === 'input' && el.props.type === 'date')[0].props.onChange({ target: { value: '' } }); multi('Trasportatori').props.onChange([]); multi('Destinazioni').props.onChange([]); });
  verifica('tolti i filtri, ancora nessuna richiesta', q.letture === 0 && q.funzioni.length === 0, JSON.stringify(q));
  q = await richieste(() => trova(r.albero, el => el.type === 'input' && el.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } }));
  verifica('«Solo date da sistemare»: nessuna richiesta', q.letture === 0 && q.funzioni.length === 0, JSON.stringify(q));
  verifica('e mostra il terminato senza fine trasporto', mostrati() === 'a4', mostrati());
  await richieste(() => trova(r.albero, el => el.type === 'input' && el.props.type === 'checkbox')[0].props.onChange({ target: { checked: false } }));
  verifica('nessuna iscrizione rifatta', c.iscritti.length === 1, String(c.iscritti.length));
}

console.log('IL MESE, L\'ANNO E LA REGIONE RICHIAMANO SOLO CHI LI GUARDA');
{
  let q = await richieste(scegli('Mesi', ['Settembre']));
  verifica('mese: solo il mix, con i filtri del mix', q.letture === 0 && JSON.stringify(q.funzioni) === '["computeRaccoglitoriMix"]'
    && JSON.stringify(q.mix[0]) === '{"filters":{"regione":[],"stato":[],"mese":["Settembre"],"anno":[]}}', JSON.stringify(q));
  // a6 finisce alle 23:30 UTC del 30/09: in Italia e' ottobre. a4 non ha periodo. a7 (eseguito) va con l'immissione.
  verifica('settembre col giorno italiano della fine trasporto', mostrati() === 'a1,a5,a7,a8', mostrati());
  verifica('l\'avviso delle date guarda anche chi non ha periodo', avvisoDate() === 'a1,a4,a5,a7,a8', avvisoDate());
  q = await richieste(scegli('Anni', ['2026']));
  verifica('anno solo: mix e tempi di quell\'anno', q.letture === 0 && JSON.stringify(q.funzioni) === '["computeRaccoglitoriMix","computeSlaMetrics"]'
    && JSON.stringify(q.sla[0]) === '{"anno":2026}', JSON.stringify(q));
  q = await richieste(scegli('Regioni', ['Campania']));
  verifica('regione: solo il mix', q.letture === 0 && JSON.stringify(q.funzioni) === '["computeRaccoglitoriMix"]', JSON.stringify(q));
  verifica('settembre 2026 in Campania', mostrati() === 'a1,a7', mostrati());
  q = await richieste(() => trova(r.albero, el => el.type === 'button' && /Reset/.test(testo(el)))[0].props.onClick());
  verifica('reset: mix e tempi tornano senza filtri, archivio non riletto', q.letture === 0 && JSON.stringify(q.funzioni) === '["computeRaccoglitoriMix","computeSlaMetrics"]'
    && JSON.stringify(q.sla[0]) === '{}', JSON.stringify(q));
  verifica('e a video di nuovo tutto', mostrati() === 'a1,a2,a3,a4,a5,a6,a7,a8', mostrati());
}

console.log('UN CARICAMENTO DELLE PRIMARIE RILEGGE TUTTO, UNA VOLTA');
{
  let q = await richieste(() => c.emetti('UploadLog', { type: 'update', data: { tipo_file: 'primarie', esito: 'in_corso' } }));
  verifica('mentre si carica, niente', q.letture === 0 && q.funzioni.length === 0, JSON.stringify(q));
  q = await richieste(() => c.emetti('UploadLog', { type: 'update', data: { tipo_file: 'primarie', esito: 'successo' } }));
  verifica('concluso: l\'archivio una volta e i quattro riquadri', q.letture === 1 && q.funzioni.length === 4, JSON.stringify(q));
  q = await richieste(() => c.emetti('UploadLog', { type: 'create', data: { tipo_file: 'secondarie', esito: 'successo' } }));
  verifica('un caricamento delle secondarie non c\'entra', q.letture === 0 && q.funzioni.length === 0, JSON.stringify(q));

  // La sequenza vera di importaBlocco (revisione del 13/10/2026): la riga del
  // tentativo di prima chiusa in errore mentre si apre quella nuova, la nuova
  // in_corso, la sua chiusura e la nota a ricalcoli finiti. Rileggeva tre volte,
  // con l'archivio cambiato una volta sola.
  const riga = { id: 'u9', tipo_file: 'primarie', nome_file: 'primarie.xlsx', utente: 'admin', modalita: 'sostituzione' };
  const sequenza = [
    ['la riga vecchia chiusa in errore, mentre il caricamento nuovo si apre', { type: 'update', data: { id: 'u8', tipo_file: 'primarie', esito: 'errore', modalita: 'sostituzione', messaggio: "Caricamento interrotto: avviato da admin e mai concluso. L'archivio poteva essere incompleto; e' stato ricaricato dopo." } }],
    ['la riga nuova in_corso', { type: 'create', data: { ...riga, esito: 'in_corso', messaggio: 'Caricamento in corso: archivio in riscrittura.' } }],
    ['la chiusura con successo', { type: 'update', data: { ...riga, esito: 'successo', messaggio: '10487 righe importate' } }],
    ['la nota dei moduli aggiornati, con l\'archivio invariato', { type: 'update', data: { ...riga, esito: 'successo', messaggio: '10487 righe importate | moduli collegati aggiornati' } }],
  ];
  // Il contatore degli alert a video, passo per passo. Il motore li scrive dopo
  // la chiusura: alla chiusura il server risponde ancora 2, alla nota 7.
  const badge = () => uno('AlertBadge')?.props.count ?? 0;
  alertAperti = 2;
  const perPasso = [];
  const alertAVideo = [];
  for (const [i, [, evento]] of sequenza.entries()) {
    if (i === 3) alertAperti = 7; // il motore ha finito mentre il browser faceva i ricalcoli
    perPasso.push(await richieste(() => c.emetti('UploadLog', evento)));
    alertAVideo.push(badge());
  }
  verifica('la riga vecchia chiusa in errore non rilegge', perPasso[0].letture === 0 && perPasso[0].funzioni.length === 0, JSON.stringify(perPasso[0]));
  verifica('la chiusura rilegge l\'archivio una volta e i quattro riquadri', perPasso[2].letture === 1 && perPasso[2].funzioni.length === 4, JSON.stringify(perPasso[2]));
  verifica('la nota: solo gli alert, nessuna pagina dell\'archivio', perPasso[3].letture === 0 && JSON.stringify(perPasso[3].funzioni) === '["getAlerts"]', JSON.stringify(perPasso[3]));
  verifica('un caricamento, una rilettura dell\'archivio, e gli alert una volta in piu\'', perPasso.reduce((s, x) => s + x.letture, 0) === 1 && perPasso.reduce((s, x) => s + x.funzioni.length, 0) === 5,
    sequenza.map(([nome], i) => `${nome}: ${perPasso[i].letture} letture, ${perPasso[i].funzioni.length} funzioni`).join(' · '));
  verifica('il contatore degli alert: quello di prima alla chiusura, quello del motore alla nota', alertAVideo[2] === 2 && alertAVideo[3] === 7, JSON.stringify(alertAVideo));
  // la stessa nota sentita due volte non rilegge niente
  q = await richieste(() => c.emetti('UploadLog', sequenza[3][1]));
  verifica('la nota ripetuta: niente', q.letture === 0 && q.funzioni.length === 0, JSON.stringify(q));
  // pagina aperta a ricalcoli in corso: la prima cosa che sente e' la nota
  alertAperti = 8;
  q = await richieste(() => c.emetti('UploadLog', { type: 'update', data: { id: 'u9b', tipo_file: 'primarie', esito: 'successo', modalita: 'sostituzione', messaggio: '10487 righe importate | moduli collegati aggiornati' } }));
  verifica('una nota sentita senza la chiusura: ancora solo gli alert', q.letture === 0 && JSON.stringify(q.funzioni) === '["getAlerts"]' && badge() === 8, `${JSON.stringify(q)} ${badge()}`);
  // gli alert che non rispondono alla nota si dicono, e «Riprova» richiama solo loro
  alertAperti = null;
  FUNZIONI.getAlerts = async () => { if (alertAperti === null) throw new Error('non risponde'); return { total: alertAperti }; };
  const erroreVero = console.error;
  console.error = () => {}; // la pagina scrive l'errore in console: qui e' voluto
  q = await richieste(() => c.emetti('UploadLog', { type: 'update', data: { id: 'u9c', tipo_file: 'primarie', esito: 'successo', modalita: 'sostituzione', messaggio: 'ok | moduli collegati aggiornati' } }));
  console.error = erroreVero;
  const avvisoNonCaricati = () => testo(trova(r.albero, el => el.type === 'span' && /^Non (si è caricato|si sono caricati)/.test(testo(el)))[0]);
  verifica('alla nota gli alert non rispondono: lo si dice', /gli alert aperti/.test(avvisoNonCaricati()) && !/matrice/.test(avvisoNonCaricati()), avvisoNonCaricati());
  alertAperti = 3;
  q = await richieste(() => trova(r.albero, el => el.type === 'button' && testo(el) === 'Riprova')[0]?.props.onClick());
  verifica('«Riprova»: solo gli alert, senza la matrice per provincia', q.letture === 0 && JSON.stringify(q.funzioni) === '["getAlerts"]' && badge() === 3 && avvisoNonCaricati() === '',
    `${JSON.stringify(q)} ${badge()} «${avvisoNonCaricati()}»`);
  alertAperti = 2;
  // un parziale ha riscritto l'archivio: si rilegge; un rifiuto a dati intatti no
  q = await richieste(async () => {
    c.emetti('UploadLog', { type: 'create', data: { id: 'u10', tipo_file: 'primarie', esito: 'in_corso' } }); await aspetta();
    c.emetti('UploadLog', { type: 'update', data: { id: 'u10', tipo_file: 'primarie', esito: 'parziale', messaggio: '3 righe non scritte' } });
  });
  verifica('una riscrittura parziale rilegge una volta', q.letture === 1 && q.funzioni.length === 4, JSON.stringify(q));
  q = await richieste(() => c.emetti('UploadLog', { type: 'create', data: { id: 'u11', tipo_file: 'primarie', esito: 'errore', messaggio: 'Il file ha meno ordini di quelli in archivio' } }));
  verifica('un rifiuto a dati intatti no', q.letture === 0 && q.funzioni.length === 0, JSON.stringify(q));
  verifica('e l\'iscrizione resta una', c.iscritti.length === 1, String(c.iscritti.length));
}

console.log('LA RICERCA PER ID ORDINE RESTA COM\'ERA');
{
  await richieste(scegli('Mesi', ['Agosto']));
  const q = await richieste(() => cercaId().props.onChange('et 2600010'));
  verifica('nessuna richiesta', q.letture === 0 && q.funzioni.length === 0, JSON.stringify(q));
  verifica('cerca in tutto l\'archivio, senza i filtri', mostrati() === 'a1,a2,a4,a5,a6,a7,a8', mostrati());
  verifica('e conta i trovati', cercaId().props.trovati === 7, String(cercaId().props.trovati));
  await richieste(() => { cercaId().props.onChange(''); multi('Mesi').props.onChange([]); });
}

const pdr = cercaPdr();
console.log('LA RICERCA PER PUNTO DI RACCOLTA');
verifica('il campo c\'e\', accanto a quello per ID', !!pdr && !!cercaId());
if (pdr) {
  // si parte da un'altra scheda: cercando si apre il dettaglio
  await richieste(() => tabs().props.onValueChange('mix'));
  let q = await richieste(() => cercaPdr().props.onChange('315'));
  verifica('nessuna richiesta', q.letture === 0 && q.funzioni.length === 0, JSON.stringify(q));
  verifica('il codice vale uguale: 315, non 1315', mostrati() === 'a1,a4,a7', mostrati());
  verifica('cercando si apre il dettaglio degli ordini', tabs().props.value === 'dettaglio', tabs().props.value);
  verifica('conta i trovati, in tutto l\'archivio senza filtri', cercaPdr().props.trovati === 3 && cercaPdr().props.conFiltri === false && cercaPdr().props.inArchivio === null,
    JSON.stringify([cercaPdr().props.trovati, cercaPdr().props.conFiltri, cercaPdr().props.inArchivio]));
  verifica('e dice il punto, con quanti ordini', JSON.stringify(cercaPdr().props.punti.map(p => [p.id_pdr, p.ordini])) === '[[315,3]]', JSON.stringify(cercaPdr().props.punti));
  verifica('la scheda dice le righe trovate', /Dettaglio Ordini \(3 righe\)/.test(etichettaDettaglio()), etichettaDettaglio());

  await richieste(() => cercaPdr().props.onChange('PDR 315'));
  verifica('«PDR 315» e\' lo stesso codice', mostrati() === 'a1,a4,a7', mostrati());
  await richieste(() => cercaPdr().props.onChange('mastria gomme'));
  verifica('per nome: tutti e due i punti della ditta', mostrati() === 'a1,a2,a4,a7', mostrati());
  verifica('due punti, il piu\' usato prima', JSON.stringify(cercaPdr().props.punti.map(p => [p.id_pdr, p.ordini])) === '[[315,3],[317,1]]', JSON.stringify(cercaPdr().props.punti));
  await richieste(() => cercaPdr().props.onChange('  MastriaGomme '));
  verifica('maiuscole e spazi non contano', mostrati() === 'a1,a2,a4,a7', mostrati());
  await richieste(() => cercaPdr().props.onChange('eurogomme nemoli'));
  verifica('le parole in qualunque punto del nome', mostrati() === 'a3', mostrati());
  await richieste(() => cercaPdr().props.onChange('EUROGOMME'));
  verifica('anche la ragione sociale del produttore', mostrati() === 'a3,a5', mostrati());
  await richieste(() => cercaPdr().props.onChange('s.r.l.'));
  verifica('la punteggiatura non conta: s.r.l. trova SRL', mostrati() === 'a1,a2,a4,a5,a6,a7', mostrati());
  await richieste(() => cercaPdr().props.onChange('citta angelo'));
  verifica('gli accenti non contano', mostrati() === 'a8', mostrati());
  await richieste(() => cercaPdr().props.onChange('viale pio x europa'));
  verifica('una parola a cavallo fra punto e ditta non vale', mostrati() === '', mostrati());

  q = await richieste(async () => { cercaPdr().props.onChange('mastria'); await aspetta(); multi('Mesi').props.onChange(['Settembre']); });
  verifica('dentro i filtri, come in Assegnati Rete, e senza richieste per il PDR', mostrati() === 'a1,a7' && q.letture === 0
    && JSON.stringify(q.funzioni) === '["computeRaccoglitoriMix"]', `${mostrati()} ${JSON.stringify(q)}`);
  verifica('e il conteggio dice anche quanti ne ha in tutto l\'archivio', cercaPdr().props.trovati === 2 && cercaPdr().props.conFiltri === true && cercaPdr().props.inArchivio === 4,
    JSON.stringify([cercaPdr().props.trovati, cercaPdr().props.conFiltri, cercaPdr().props.inArchivio]));
  await richieste(() => trova(r.albero, el => el.type === 'input' && el.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } }));
  verifica('con «Solo date da sistemare»: i suoi ordini con le date da sistemare', mostrati() === 'a4', mostrati());
  await richieste(() => trova(r.albero, el => el.type === 'input' && el.props.type === 'checkbox')[0].props.onChange({ target: { checked: false } }));

  await richieste(() => cercaId().props.onChange('ET2600010'));
  verifica('con un ID cercato vale l\'archivio intero, e tutte e due le ricerche', mostrati() === 'a1,a2,a4,a7', mostrati());
  verifica('l\'ID conta i suoi, il PDR quelli insieme all\'ID', cercaId().props.trovati === 7 && cercaPdr().props.trovati === 4 && cercaPdr().props.conIdOrdine === true,
    JSON.stringify([cercaId().props.trovati, cercaPdr().props.trovati, cercaPdr().props.conIdOrdine]));
  await richieste(() => { cercaId().props.onChange(''); cercaPdr().props.onChange(' . '); });
  verifica('solo punteggiatura: nessuna ricerca, i filtri di prima', mostrati() === 'a1,a5,a7,a8' && cercaPdr().props.trovati === 4, mostrati());
  await richieste(() => { cercaPdr().props.onChange(''); trova(r.albero, el => el.type === 'button' && /Reset/.test(testo(el)))[0].props.onClick(); });
  verifica('vuota, torna l\'elenco di sempre', mostrati() === 'a1,a2,a3,a4,a5,a6,a7,a8', mostrati());
}

console.log('IL CAMPO, DA SOLO: CONTEGGIO, PUNTI E TELEFONO');
{
  const mod = await caricaPagina('components/shared/CercaPdr');
  const { corrispondePdr, codicePdrCercato, puntiDiRaccolta } = mod.modulo;
  verifica('il codice: un numero solo, anche con PDR davanti', codicePdrCercato('315') === 315 && codicePdrCercato(' pdr 0315 ') === 315 && codicePdrCercato('315 gomme') === null);
  verifica('un ordine senza codice non risponde a un codice', corrispondePdr({ id_pdr: null, punto_di_raccolta: '315' }, '315') === false);
  verifica('il testo vuoto non toglie niente', corrispondePdr({ id_pdr: 1 }, '') === true && corrispondePdr({ id_pdr: 1 }, '   ') === true);
  const punti = puntiDiRaccolta(ARCHIVIO.filter(x => /MASTRIA/.test(x.ragione_sociale)));
  const montato = mod.monta(mod.Componente, { value: 'mastria', onChange: (v) => { montato.scelto = v; }, trovati: 4, punti, conFiltri: true, inArchivio: 9 });
  const t = testo(montato.albero);
  verifica('dice i trovati e quanti in tutto l\'archivio', t.includes('4 ordini trovati con i filtri scelti') && t.includes("9 ordini in tutto l'archivio"), t);
  const pulsanti = trova(montato.albero, el => el.type === 'button' && /Solo gli ordini di questo punto/.test(el.props.title || ''));
  verifica('con piu\' punti, ciascuno si sceglie col suo codice', pulsanti.length === 2);
  pulsanti[1]?.props.onClick();
  verifica('il clic cerca il codice di quel punto', montato.scelto === '317', String(montato.scelto));
  const campo = trova(montato.albero, 'input')[0];
  const contenitore = trova(montato.albero, el => el.type === 'div' && /relative/.test(el.props.className || ''))[0];
  verifica('a 375 px il campo prende tutta la riga, i punti vanno a capo e i nomi lunghi si tagliano',
    /\bw-full\b/.test(contenitore?.props.className || '') && /\bsm:w-80\b/.test(contenitore?.props.className || '')
    && trova(montato.albero, el => el.type === 'div' && /flex-wrap/.test(el.props.className || '') && /min-w-0/.test(el.props.className || '')).length === 1
    && trova(montato.albero, el => el.type === 'span' && /\btruncate\b/.test(el.props.className || '')).length === 2, campo?.props.placeholder);
  const zero = mod.monta(mod.Componente, { value: '999', onChange: () => {}, trovati: 0, punti: [] });
  verifica('nessun trovato si dice', testo(zero.albero).includes("Nessun ordine trovato in tutto l'archivio"), testo(zero.albero));
  const inLettura = mod.monta(mod.Componente, { value: '315', onChange: () => {}, trovati: null, punti: [] });
  verifica('mentre l\'archivio si legge non si dice zero', !/trovat/.test(testo(inLettura.albero)), testo(inLettura.albero));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
