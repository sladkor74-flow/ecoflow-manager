// EVASIONE DEGLI ASSEGNATI: UN ANNO LETTO, I MESI SFOGLIATI IN MEMORIA
// (segnalazione alta A3 del 20/09, corretta il 12/10/2026).
//
// La pagina Verifiche > Evasione assegnati chiamava evasioneAssegnati a ogni
// mese che si guardava, e ogni chiamata rileggeva per intero sei archivi
// (primarie di rete e ACI, assegnati di rete e ACI, extra raccolta, fornitori),
// i target, le liste e un controllo per lista: sfogliare quattro mesi erano
// quattro letture di tutto, sul limite di richieste al minuto che vale per
// tutta l'app. Ora la funzione con { anno, anno_intero: true } legge una volta
// e risponde per i dodici mesi, e la pagina sfoglia i mesi in memoria.
//
// Che cosa si prova:
// 1. la funzione vera (banco con SDK finto, prove/dati/bancoFunzioni.mjs): per
//    ogni mese, la risposta dell'anno intero e' quella del mese chiesto da solo,
//    che e' il calcolo di prima; gli archivi si leggono una volta per l'anno e i
//    controlli in blocco, non uno per lista; una lista che non si riesce a
//    ricontrollare non toglie la vista dell'anno e si dice;
// 2. la pagina vera (prove/dati/paginaFinta.mjs), servita dalla funzione vera:
//    una chiamata per anno, nessuna a ogni mese, le righe a video uguali al
//    calcolo del mese; una rilettura quando l'anno e' vecchio e dopo
//    «Controlla ora»;
// 3. un caricamento delle primarie chiuso mentre la pagina e' aperta (revisione
//    del 13/10/2026): la pagina lo dice e rilegge alla nota dei moduli
//    aggiornati, non alla chiusura, quando controllaEvasioneAssegnati lavora.
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';
import { caricaPagina, clienteFinto, aspetta, trova, testo, orologioFinto } from './dati/paginaFinta.mjs';
import { normalizzaRagioneSociale } from '../base44/shared/normalizzaRagioneSociale.ts';
import { VERSIONE_REGOLE } from '../base44/shared/evasioneAssegnati.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// === l'orologio: il 12/10/2026 alle 12 italiane ===
const VeraData = Date;
let adesso = VeraData.parse('2026-10-12T10:00:00Z');
class DataFinta extends VeraData {
  constructor(...a) { if (a.length === 0) super(adesso); else super(...a); }
  static now() { return adesso; }
}
globalThis.Date = DataFinta;

// === le letture, contate sull'archivio finto ===
// Il banco non conta le letture: ogni operazione pero' passa una volta da
// globalThis.__DB[entita], e le scritture sono registrate a parte. Si avvolge
// l'archivio che chiama() vi mette. Il banco non ordina nemmeno: i controlli
// si tengono dal piu' recente, come li restituisce la piattaforma con
// '-eseguito_il', e quelli nuovi vanno in testa. rompi: l'entita' su cui ogni
// scrittura fallisce.
let passaggi = {};
let rompi = null;
let interno;
Object.defineProperty(globalThis, '__DB', {
  configurable: true,
  get() { return interno; },
  set(v) {
    interno = new Proxy(v, {
      get(t, k) {
        if (typeof k !== 'string') return t[k];
        passaggi[k] = (passaggi[k] || 0) + 1;
        const tab = t[k];
        if (k !== 'ControlloEvasione' || !Array.isArray(tab)) return tab;
        return new Proxy(tab, { get(a, m) {
          if (m === 'push') return (...x) => { if (rompi === k) throw new Error('scrittura rifiutata'); return a.unshift(...x); };
          return a[m];
        } });
      },
    });
  },
});
const letture = (r, entita) => (passaggi[entita] || 0) - r.scritte.filter(s => s.entita === entita).length;

// === l'archivio ===
const NAPPI = 'NAPPI SUD SRL', EMMESSE = 'EMMESSE SRL';
const kN = normalizzaRagioneSociale(NAPPI), kE = normalizzaRagioneSociale(EMMESSE);
let n = 0;
const primaria = (trasportatore, fine, extra = {}) => {
  n++;
  const giorno = fine ? fine.slice(0, 10) : '2026-09-01';
  return {
    id: 'p' + n, id_ordine: extra.id_ordine || `ET26${String(n).padStart(6, '0')}`, stato: 'terminato', trasportatore,
    ordine_immesso_il: `${giorno}T06:00:00`, trasporto_iniziato_il: `${giorno}T07:00:00`, trasporto_finito_il: fine ? `${fine}T09:00:00` : null,
    peso_effettivo: 1000 + n * 10, classe: 'P', id_pdr: 300 + n, punto_di_raccolta: 'PDR ' + n, ragione_sociale: 'GOMMISTA ' + n,
    comune: 'Napoli', provincia: 'NA', regione: 'Campania', ...extra,
  };
};
const rete = [
  ...['01-15', '02-10', '03-12', '04-09', '05-14', '06-11', '07-16', '08-06', '09-08', '09-22', '10-05'].map(g => primaria(NAPPI, `2026-${g}`)),
  primaria(NAPPI, '2026-09-10', { id_ordine: 'ET26000901' }),
  primaria(EMMESSE, '2026-08-12', { id_ordine: 'ET26000801' }),
  primaria(EMMESSE, '2026-09-18'),
  primaria(NAPPI, null, { id_ordine: 'ET26000777' }),
  primaria(NAPPI, '2026-09-25', { ordine_immesso_il: null }),
  primaria('VECCHIO SRL', '2025-11-20'),
  { ...primaria(EMMESSE, null), stato: 'cancellato', id_ordine: 'ET26000555' },
];
const DB = {
  UploadLog: [{ id: 'u1', tipo_file: 'primarie', esito: 'successo', created_date: '2026-10-10T08:00:00' }],
  Fornitore: [{ id: 'f1', ragione_sociale: NAPPI }, { id: 'f2', ragione_sociale: EMMESSE }],
  PrimariaRete: rete,
  PrimariaAci: [primaria(NAPPI, '2026-09-15', { id_ordine: 'ET26ACI001' })],
  Assegnato: [
    { id: 'a1', id_ordine: 'ET26000900', trasportatore: NAPPI, ordine_immesso_il: '2026-09-20T08:00:00', provincia: 'NA', regione: 'Campania', classe: 'P' },
    { id: 'a2', id_ordine: 'ET25000800', trasportatore: NAPPI, ordine_immesso_il: '2025-11-03T08:00:00', provincia: 'SA', regione: 'Campania', classe: 'P' },
    { id: 'a3', id_ordine: 'ET26000950', trasportatore: 'GOMME FERME SRL', ordine_immesso_il: '2026-09-01T08:00:00', provincia: 'NA', regione: 'Campania' },
  ],
  AssegnatoAci: [{ id: 'aa1', id_ordine: 'ET26ACI099', trasportatore: EMMESSE, ordine_immesso_il: '2026-09-28T08:00:00', provincia: 'NA' }],
  ExtraRaccolta: [
    { id: 'x1', id_ordine: 'EX26001', stato: 'assegnato', trasportatore: NAPPI, ordine_immesso_il: '2026-10-01T08:00:00', tipo_movimento: 'primaria' },
    { id: 'x2', id_ordine: 'EX26002', stato: 'terminato', trasportatore: EMMESSE, ordine_immesso_il: '2026-09-01T08:00:00',
      trasporto_iniziato_il: '2026-09-03T07:00:00', trasporto_finito_il: '2026-09-03T09:00:00', peso_effettivo: 2500, tipo_movimento: 'primaria' },
  ],
  TargetMensile: [
    { id: 't1', anno: 2026, mese: 'Settembre', raccoglitore: NAPPI, regione: 'Campania', impianto: 'IRIGOM SRL', target: 40 },
    { id: 't2', anno: 2026, mese: 'Ottobre', raccoglitore: NAPPI, regione: 'Campania', impianto: 'IRIGOM SRL', target: 45 },
    { id: 't3', anno: 2026, mese: 'Agosto', raccoglitore: EMMESSE, regione: 'Campania', impianto: 'GATIM SRL', target: 20 },
  ],
  ListaAssegnati: [
    { id: 'L9', anno: 2026, mese: 9, raccoglitore_chiave: kN, raccoglitore_nome: NAPPI, file_nomi: 'nappi settembre.xlsx', caricata_il: '2026-09-02T08:00:00.000Z', inviata_il: '2026-09-01',
      richieste: 2, prioritarie: 1, avvisi_json: '["Una riga senza ID"]',
      righe_json: JSON.stringify([{ posizione: 1, id_ordine: 'ET26000901', prioritaria: true }, { posizione: 2, id_ordine: 'ET26000900', prioritaria: false }]) },
    { id: 'L8', anno: 2026, mese: 8, raccoglitore_chiave: kE, raccoglitore_nome: EMMESSE, file_nomi: 'emmesse agosto.xlsx', caricata_il: '2026-08-03T08:00:00.000Z', inviata_il: '2026-08-03',
      richieste: 1, prioritarie: 0, avvisi_json: '[]', righe_json: JSON.stringify([{ posizione: 1, id_ordine: 'ET26000801', prioritaria: false }]) },
    { id: 'L6', anno: 2026, mese: 6, raccoglitore_chiave: kN, raccoglitore_nome: NAPPI, file_nomi: 'nappi giugno.xlsx', caricata_il: '2026-06-02T08:00:00.000Z', inviata_il: '2026-06-01',
      richieste: 5, prioritarie: 0, avvisi_json: '', righe_json: '', alleggerito_il: '2026-08-15', storia: 'Lista di giugno: 5 richieste, 4 evase.' },
    { id: 'L10', anno: 2026, mese: 10, raccoglitore_chiave: kN, raccoglitore_nome: NAPPI, file_nomi: 'nappi ottobre.xlsx', caricata_il: '2026-10-02T08:00:00.000Z', inviata_il: '2026-10-01',
      richieste: 1, prioritarie: 0, avvisi_json: '[]', righe_json: JSON.stringify([{ posizione: 1, id_ordine: 'ET26000900', prioritaria: false }]) },
  ],
  // Dal piu' recente: come li ordina la piattaforma con '-eseguito_il'.
  ControlloEvasione: [
    { id: 'C8', lista_id: 'L8', raccoglitore_chiave: kE, raccoglitore_nome: EMMESSE, anno: 2026, mese: 8, eseguito_il: '2026-10-11T08:00:00.000Z', primarie_caricate_il: '2026-10-10T08:00:00',
      richieste: 1, evase: 1, aperte: 0, raccolto_kg: 1130, target_kg: 20000, proiezione_kg: 1130, evadibili_ritmo: 0, alert_alti: 1, alert_totali: 1,
      alert_json: JSON.stringify([{ gravita: 'alta', tipo: 'sotto_target', messaggio: 'Raccolto molto sotto il target' }]), esito_json: JSON.stringify({ regole: VERSIONE_REGOLE }) },
    { id: 'C9', lista_id: 'L9', raccoglitore_chiave: kN, raccoglitore_nome: NAPPI, anno: 2026, mese: 9, eseguito_il: '2026-09-20T10:00:00.000Z', primarie_caricate_il: '2026-09-19T08:00:00',
      richieste: 2, evase: 0, aperte: 2, raccolto_kg: 0, target_kg: 40000, proiezione_kg: 0, alert_alti: 0, alert_totali: 0, alert_json: '[]', esito_json: JSON.stringify({ regole: VERSIONE_REGOLE }) },
    { id: 'C6', lista_id: 'L6', raccoglitore_chiave: kN, raccoglitore_nome: NAPPI, anno: 2026, mese: 6, eseguito_il: '2026-07-01T10:00:00.000Z', primarie_caricate_il: '2026-06-30T08:00:00',
      richieste: 5, evase: 4, aperte: 1, alert_alti: 2, alert_totali: 3, alert_json: '', esito_json: '', alleggerito_il: '2026-08-15', storia: 'Controllo di giugno: 2 alte, 1 media.' },
  ],
};

const modulo = await caricaFunzione('evasioneAssegnati');
const pulito = (x) => JSON.parse(JSON.stringify(x).replace(/-nuovo-\d+/g, '-nuovo-N'));
const stesso = (a, b) => JSON.stringify(pulito(a)) === JSON.stringify(pulito(b));
const chiamaConta = async (corpo, ruolo = 'user') => { passaggi = {}; const r = await chiama(modulo, { db: DB, ruolo, corpo }); return { ...r, passaggi: { ...passaggi }, letture: (e) => letture(r, e) }; };

console.log('LA FUNZIONE: OGNI MESE DELL\'ANNO E\' IL MESE CHIESTO DA SOLO');
const perMese = {};
let lettureMesi = { PrimariaRete: 0, ControlloEvasione: 0 };
for (let m = 1; m <= 12; m++) {
  const r = await chiamaConta({ anno: 2026, mese: m });
  if (r.stato !== 200) { verifica(`il mese ${m} da solo risponde`, false, JSON.stringify(r.j)); continue; }
  perMese[m] = r.j;
  lettureMesi.PrimariaRete += r.letture('PrimariaRete');
  lettureMesi.ControlloEvasione += r.letture('ControlloEvasione');
}
const anno = await chiamaConta({ anno: 2026, anno_intero: true });
verifica('l\'anno intero risponde', anno.stato === 200 && !!anno.j.mesi, JSON.stringify(anno.j).slice(0, 200));
{
  const mesi = anno.j.mesi || {};
  verifica('con i dodici mesi', Object.keys(mesi).length === 12, Object.keys(mesi).join(','));
  for (let m = 1; m <= 12; m++) {
    const a = mesi[m] || mesi[String(m)];
    const s = perMese[m];
    verifica(`${m}/2026: stessi raccoglitori, numeri, liste, controlli e alert`, !!a && !!s && stesso(a.raccoglitori, s.raccoglitori) && stesso(a.senza_raccolta, s.senza_raccolta),
      a && s ? JSON.stringify(pulito(a.raccoglitori)).slice(0, 300) + ' <> ' + JSON.stringify(pulito(s.raccoglitori)).slice(0, 300) : 'manca');
  }
  verifica('e le stesse intestazioni', anno.j.primarie_caricate_il === perMese[9]?.primarie_caricate_il && anno.j.caricamento_aperto === perMese[9]?.caricamento_aperto && anno.j.anno === 2026,
    JSON.stringify([anno.j.primarie_caricate_il, anno.j.caricamento_aperto]));
  // che cosa c'e' davvero nei mesi: altrimenti la prova confronterebbe due vuoti
  const set = (mesi[9] || {}).raccoglitori || [];
  const nappi = set.find(r => r.chiave === kN);
  verifica('settembre ha la lista di Nappi, ricontrollata sulle primarie nuove', !!nappi && nappi.lista?.id === 'L9' && nappi.controllo && nappi.controllo.id !== 'C9'
    && nappi.controllo.primarie_caricate_il === '2026-10-10T08:00:00' && nappi.target_kg === 40000, JSON.stringify(nappi?.controllo));
  verifica('con gli avvisi della lista e l\'alert dell\'arretrato del 2025', JSON.stringify(nappi?.lista?.avvisi) === '["Una riga senza ID"]'
    && (nappi?.alert_canali || []).some(a => a.tipo === 'arretrati_senza_lista' && a.messaggio.includes('ET25000800')));
  const ago = ((mesi[8] || {}).raccoglitori || []).find(r => r.chiave === kE);
  verifica('agosto: il controllo gia\' buono resta quello, con i suoi alert', ago?.controllo?.id === 'C8' && ago?.controllo?.alert?.length === 1, JSON.stringify(ago?.controllo));
  const giu = ((mesi[6] || {}).raccoglitori || []).find(r => r.chiave === kN);
  verifica('giugno: lista e controllo alleggeriti, coi contatori e la storia', giu?.lista?.alleggerito_il === '2026-08-15' && giu?.controllo?.id === 'C6' && giu?.controllo?.alert_alti === 2,
    JSON.stringify(giu?.controllo));
  const ott = ((mesi[10] || {}).raccoglitori || []).find(r => r.chiave === kN);
  verifica('ottobre: la lista mai controllata ha il suo primo controllo', !!ott?.controllo && /nuovo/.test(ott.controllo.id), JSON.stringify(ott?.controllo));
  verifica('chi ha assegnati e nessuna raccolta nell\'anno si dice a parte', JSON.stringify((mesi[9] || {}).senza_raccolta) === JSON.stringify([{ nome: 'GOMME FERME SRL', assegnati: 1, aci: 0, in_liste: 0 }]),
    JSON.stringify((mesi[9] || {}).senza_raccolta));
  verifica('ACI ed extra raccolta restano a parte', (nappi?.canali?.aci?.evasi === 1) && (nappi?.canali?.extra?.aperte?.length === 1), JSON.stringify(nappi?.canali?.aci));
}

console.log('LA FUNZIONE: GLI ARCHIVI UNA VOLTA PER L\'ANNO, I CONTROLLI IN BLOCCO');
{
  const uno = await chiamaConta({ anno: 2026, mese: 9 });
  verifica('l\'anno legge le primarie quanto un mese solo', anno.letture('PrimariaRete') === uno.letture('PrimariaRete') && anno.letture('PrimariaRete') >= 1,
    `${anno.letture('PrimariaRete')} contro ${uno.letture('PrimariaRete')}`);
  verifica('e dodici mesi uno per uno le leggevano dodici volte', lettureMesi.PrimariaRete === 12 * uno.letture('PrimariaRete'), String(lettureMesi.PrimariaRete));
  for (const e of ['PrimariaAci', 'Assegnato', 'AssegnatoAci', 'ExtraRaccolta', 'Fornitore', 'TargetMensile']) {
    verifica(`${e}: una lettura per l'anno`, anno.letture(e) === uno.letture(e), `${anno.letture(e)} contro ${uno.letture(e)}`);
  }
  verifica('i controlli: una lettura in piu\' per l\'anno, non una per lista', anno.letture('ControlloEvasione') <= uno.letture('ControlloEvasione') + 1
    && anno.letture('ControlloEvasione') < lettureMesi.ControlloEvasione, `anno ${anno.letture('ControlloEvasione')}, mese ${uno.letture('ControlloEvasione')}, dodici mesi ${lettureMesi.ControlloEvasione}`);
  const nuovi = anno.scritte.filter(s => s.op === 'create' && s.entita === 'ControlloEvasione');
  verifica('ricontrolla le liste di tutto l\'anno che ne hanno bisogno, una volta', nuovi.length === 2 && nuovi.map(s => s.dati.lista_id).sort().join(',') === 'L10,L9',
    nuovi.map(s => s.dati.lista_id).join(','));
  const utente = anno.scritte.filter(s => s.entita === 'ListaAssegnati' || (s.entita === 'ControlloEvasione' && s.op !== 'create' && s.op !== 'update'));
  verifica('chi consulta non alleggerisce niente', utente.length === 0, JSON.stringify(utente));
  const admin = await chiamaConta({ anno: 2026, anno_intero: true }, 'admin');
  verifica('l\'amministratore si', admin.stato === 200 && admin.scritte.some(s => s.entita === 'ListaAssegnati' && s.op === 'update'), JSON.stringify(admin.scritte.map(s => `${s.op} ${s.entita}`)));
  const vuoto = await chiamaConta({ anno: 2026 });
  verifica('senza mese e senza anno intero resta un errore', vuoto.stato === 400, String(vuoto.stato));
}

console.log('UNA LISTA CHE NON SI RIESCE A RICONTROLLARE NON TOGLIE LA VISTA DELL\'ANNO');
{
  rompi = 'ControlloEvasione';
  const a = await chiamaConta({ anno: 2026, anno_intero: true });
  const m = await chiamaConta({ anno: 2026, mese: 9 });
  rompi = null;
  verifica('l\'anno risponde e lo dice', a.stato === 200 && /Controllo non riuscito su 2 liste/.test(a.j.controlli_non_riusciti || ''), `${a.stato} ${a.j.controlli_non_riusciti || a.j.error}`);
  const nappi = ((a.j.mesi || {})[9] || {}).raccoglitori?.find(r => r.chiave === kN);
  verifica('e la lista mostra l\'ultimo controllo riuscito', nappi?.controllo?.id === 'C9', JSON.stringify(nappi?.controllo?.id));
  verifica('il mese solo resta un errore, com\'era', m.stato === 500, String(m.stato));
}

console.log('LA PAGINA: UNA CHIAMATA PER ANNO, I MESI IN MEMORIA');
{
  const p = await caricaPagina('components/verifiche/EvasioneAssegnati');
  const c = clienteFinto({
    funzioni: {
      evasioneAssegnati: async (corpo) => {
        const r = await chiama(modulo, { db: DB, ruolo: 'user', corpo });
        if (r.stato !== 200) throw Object.assign(new Error(r.j.error), { status: r.stato });
        return r.j;
      },
      controllaEvasioneAssegnati: async () => ({ controlli: 0, liste: 4 }),
    },
  });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const r = p.monta(p.Componente, { isAdmin: true });
  await aspetta(60);
  const chiamate = () => c.funzioniChiamate('evasioneAssegnati').map(x => x.payload);
  const titolo = () => testo(trova(r.albero, el => el.type === 'div' && /font-heading font-semibold text-lg/.test(el.props.className || ''))[0]);
  const pulsante = (t) => trova(r.albero, el => el.type && el.type.__finto === 'Button' && el.props.title === t)[0];
  const vai = async (t, volte = 1) => { for (let i = 0; i < volte; i++) { pulsante(t).props.onClick(); await aspetta(60); } };
  // Le righe a video: tutti i raccoglitori, compresi quelli nascosti sotto «Mostra».
  const righeAVideo = async () => {
    const mostra = trova(r.albero, el => el.type === 'button' && /^Mostra \d+ raccoglitori/.test(testo(el)))[0];
    if (mostra) { mostra.props.onClick(); await aspetta(); }
    const righe = trova(r.albero, el => el.type && el.type.name === 'RigaRaccoglitore').map(el => el.props.riga);
    const nascondi = trova(r.albero, el => el.type === 'button' && /^Nascondi/.test(testo(el)))[0];
    if (nascondi) { nascondi.props.onClick(); await aspetta(); }
    return righe;
  };
  const uguali = async (m) => {
    const aVideo = (await righeAVideo()).map(pulito).sort((x, y) => x.chiave.localeCompare(y.chiave));
    const attese = pulito(perMese[m].raccoglitori).sort((x, y) => x.chiave.localeCompare(y.chiave));
    return JSON.stringify(aVideo) === JSON.stringify(attese) && aVideo.length > 0;
  };

  verifica('la pagina si monta senza errori', r.errori.length === 0, String(r.errori[0] || ''));
  verifica('all\'apertura una chiamata, per l\'anno intero', JSON.stringify(chiamate()) === '[{"anno":2026,"anno_intero":true}]', JSON.stringify(chiamate()));
  verifica('e si vede ottobre 2026', titolo() === 'Ottobre 2026', titolo());
  verifica('ottobre a video: le righe del calcolo del mese', await uguali(10));
  c.azzera();
  await vai('Mese precedente');
  verifica('settembre senza chiamare niente', chiamate().length === 0 && titolo() === 'Settembre 2026', `${JSON.stringify(chiamate())} ${titolo()}`);
  verifica('settembre a video: le righe del calcolo del mese', await uguali(9));
  verifica('con gli alert del mese', testo(r.albero).includes('Alert del mese') && testo(r.albero).includes('ET25000800'));
  await vai('Mese precedente');
  verifica('agosto: le sue righe, nessuna chiamata', chiamate().length === 0 && await uguali(8));
  await vai('Mese precedente', 2);
  verifica('giugno: lista alleggerita coi suoi numeri, nessuna chiamata', chiamate().length === 0 && await uguali(6));
  const testoGiugno = testo(r.albero);
  verifica('e i contatori della lista', testoGiugno.includes('Giugno 2026') && testoGiugno.includes('liste caricate'), testoGiugno.slice(0, 200));

  console.log('LA PAGINA: UN ALTRO ANNO E\' UN\'ALTRA CHIAMATA, GLI ANNI LETTI RESTANO');
  await vai('Mese successivo', 6);
  verifica('dicembre 2026 ancora in memoria', chiamate().length === 0 && titolo() === 'Dicembre 2026', `${JSON.stringify(chiamate())} ${titolo()}`);
  await vai('Mese successivo');
  verifica('gennaio 2027: una chiamata per il 2027', JSON.stringify(chiamate()) === '[{"anno":2027,"anno_intero":true}]' && titolo() === 'Gennaio 2027', `${JSON.stringify(chiamate())} ${titolo()}`);
  await vai('Mese precedente');
  verifica('tornando al 2026, niente', chiamate().length === 1, JSON.stringify(chiamate()));

  console.log('LA PAGINA: SI RILEGGE QUANDO SERVE');
  adesso += 6 * 60 * 1000;
  c.azzera();
  await vai('Mese precedente');
  verifica('un anno letto da piu\' di cinque minuti si rilegge in silenzio, una volta', JSON.stringify(chiamate()) === '[{"anno":2026,"anno_intero":true}]', JSON.stringify(chiamate()));
  verifica('e il mese resta a video', await uguali(11));
  await vai('Mese precedente');
  verifica('poi niente', chiamate().length === 1, JSON.stringify(chiamate()));
  c.azzera();
  trova(r.albero, el => el.type && el.type.__finto === 'Button' && /Controlla ora/.test(testo(el)))[0].props.onClick();
  await aspetta(60);
  verifica('«Controlla ora»: il ricontrollo e una rilettura dell\'anno', c.funzioniChiamate('controllaEvasioneAssegnati').length === 1 && JSON.stringify(chiamate()) === '[{"anno":2026,"anno_intero":true}]',
    JSON.stringify(c.funzioniChiamate().map(x => x.nome)));
  c.azzera();
  await vai('Mese successivo', 3);
  verifica('e gli altri anni si dimenticano: il 2027 si rilegge', JSON.stringify(chiamate()) === '[{"anno":2027,"anno_intero":true}]', JSON.stringify(chiamate()));
  r.smonta();
}

console.log('LA PAGINA DICE LE LISTE CHE NON SI SONO RICONTROLLATE');
{
  const p = await caricaPagina('components/verifiche/EvasioneAssegnati');
  const c = clienteFinto({ funzioni: { evasioneAssegnati: async () => ({ ...anno.j, controlli_non_riusciti: 'Controllo non riuscito su 1 lista: NAPPI SUD SRL 9/2026: scrittura rifiutata' }) } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const r = p.monta(p.Componente, { isAdmin: false });
  await aspetta(60);
  const t = testo(r.albero);
  verifica('l\'avviso c\'e\', con la lista e che cosa si vede', t.includes('Controllo non riuscito su 1 lista: NAPPI SUD SRL 9/2026') && t.includes("mostrano l'ultimo controllo riuscito"), t.slice(0, 400));
  verifica('e i mesi si vedono lo stesso', trova(r.albero, el => el.type && el.type.name === 'RigaRaccoglitore').length > 0);
  r.smonta();
}

// UN CARICAMENTO DELLE PRIMARIE CHIUSO MENTRE LA PAGINA E' APERTA (revisione del
// 13/10/2026). Lo chiude un'altra scheda o un altro utente: settembre di Nappi
// passa da 1.000 a 4.000 kg. Senza iscrizione, per cinque minuti cambiando mese
// si vedevano i 1.000 kg, e niente lo diceva. La pagina rilegge alla nota
// «moduli collegati aggiornati», cioe' a ricalcoli finiti, e non alla chiusura:
// li' parte controllaEvasioneAssegnati, e una rilettura insieme rifarebbe i
// controlli delle liste due volte. Gli eventi sono quelli che scrive
// importaBlocco, nell'ordine.
console.log('LA PAGINA: UN CARICAMENTO DELLE PRIMARIE LA AGGIORNA A RICALCOLI FINITI');
{
  adesso = VeraData.parse('2026-10-12T10:00:00Z');
  let primarieDel = '2026-10-12T07:00:00';
  let raccoltoKg = 1000;
  const vuoto = { evasi: 0, kg: 0, aperte: [], senza_fine: [], date_da_sistemare: [] };
  const riga = () => ({ chiave: kN, nome: NAPPI, target_kg: null, target_regioni: [], non_raccoglie: false, raccolto_kg: raccoltoKg, assegnati_ora: 1,
    canali: { rete: { ...vuoto, evasi: 1, kg: raccoltoKg }, aci: vuoto, extra: vuoto }, alert_canali: [], lista: null, controllo: null });
  const c = clienteFinto({ funzioni: { evasioneAssegnati: async (corpo) => ({
    anno: corpo.anno, anno_intero: true, primarie_caricate_il: primarieDel, caricamento_aperto: null, controlli_non_riusciti: null,
    mesi: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, { raccoglitori: [riga()], senza_raccolta: [] }])),
  }) } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const p = await caricaPagina('components/verifiche/EvasioneAssegnati');
  const r = p.monta(p.Componente, { isAdmin: false });
  await aspetta(60);
  const chiamate = () => c.funzioniChiamate('evasioneAssegnati').map(x => x.payload);
  const pulsante = (t) => trova(r.albero, el => el.type && el.type.__finto === 'Button' && el.props.title === t)[0];
  const vai = async (t, volte = 1) => { for (let i = 0; i < volte; i++) { pulsante(t).props.onClick(); await aspetta(60); } };
  const titolo = () => testo(trova(r.albero, el => el.type === 'div' && /font-heading font-semibold text-lg/.test(el.props.className || ''))[0]);
  const sotto = () => testo(trova(r.albero, el => el.type === 'div' && /text-xs text-muted-foreground/.test(el.props.className || ''))[0]);
  const kgAVideo = () => trova(r.albero, el => el.type && el.type.name === 'RigaRaccoglitore').map(el => el.props.riga.raccolto_kg).join(',');
  const avviso = () => { const t = testo(r.albero); const i = t.indexOf('Dopo la lettura di questa pagina'); return i < 0 ? '' : t.slice(i, i + 140); };
  const oraIt = (v) => new VeraData(v).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const emetti = async (evento) => { c.azzera(); c.emetti('UploadLog', evento); await aspetta(60); return chiamate(); };

  verifica('l\'iscrizione ai caricamenti e\' una', c.iscritti.filter(x => x.nome === 'UploadLog').length === 1, String(c.iscritti.length));
  // si legge anche il 2027, per vedere che dopo il caricamento si dimentica
  await vai('Mese successivo', 3);
  await vai('Mese precedente', 2);
  verifica('si parte da novembre 2026, con il 2026 e il 2027 letti', titolo() === 'Novembre 2026' && chiamate().length === 2 && kgAVideo() === '1000', `${titolo()} ${JSON.stringify(chiamate())}`);

  adesso += 60 * 1000;
  const riga9 = { id: 'u9', tipo_file: 'primarie', nome_file: 'primarie.xlsx', utente: 'admin', modalita: 'sostituzione' };
  let q = await emetti({ type: 'update', data: { id: 'u8', tipo_file: 'primarie', esito: 'errore', modalita: 'sostituzione', messaggio: "Caricamento interrotto: avviato da admin e mai concluso. L'archivio poteva essere incompleto; e' stato ricaricato dopo." } });
  verifica('la riga vecchia chiusa in errore: niente', q.length === 0 && avviso() === '', `${JSON.stringify(q)} ${avviso()}`);
  q = await emetti({ type: 'create', data: { ...riga9, esito: 'in_corso', messaggio: 'Caricamento in corso: archivio in riscrittura.' } });
  verifica('il caricamento si apre: nessuna chiamata, e si dice che i numeri sono di prima', q.length === 0 && /è partito un caricamento delle primarie/.test(avviso()), `${JSON.stringify(q)} «${avviso()}»`);
  // sul server l'archivio e' riscritto
  primarieDel = '2026-10-12T10:01:00'; raccoltoKg = 4000;
  q = await emetti({ type: 'update', data: { ...riga9, esito: 'successo', messaggio: '10487 righe importate' } });
  verifica('si chiude: nessuna chiamata, perche\' ora tocca a controllaEvasioneAssegnati', q.length === 0, JSON.stringify(q));
  verifica('e si dice che le primarie sono state ricaricate', /le primarie sono state ricaricate/.test(avviso()) && kgAVideo() === '1000', `«${avviso()}» ${kgAVideo()}`);
  adesso += 2 * 60 * 1000;
  c.azzera();
  await vai('Mese precedente');
  verifica('cambiando mese a ricalcoli in corso non si rilegge, e l\'avviso resta', titolo() === 'Ottobre 2026' && chiamate().length === 0 && kgAVideo() === '1000' && avviso() !== '',
    `${titolo()} ${JSON.stringify(chiamate())} ${kgAVideo()}`);
  await vai('Mese precedente');
  q = await emetti({ type: 'update', data: { ...riga9, esito: 'successo', messaggio: '10487 righe importate | moduli collegati aggiornati' } });
  verifica('a ricalcoli finiti si rilegge l\'anno davanti, una volta', JSON.stringify(q) === '[{"anno":2026,"anno_intero":true}]', JSON.stringify(q));
  verifica('settembre con i numeri nuovi e la data nuova delle primarie', titolo() === 'Settembre 2026' && kgAVideo() === '4000' && sotto() === `primarie del ${oraIt('2026-10-12T10:01:00Z')}`,
    `${titolo()} ${kgAVideo()} «${sotto()}»`);
  verifica('e l\'avviso se ne va', avviso() === '', avviso());
  q = await emetti({ type: 'update', data: { ...riga9, esito: 'successo', messaggio: '10487 righe importate | moduli collegati aggiornati' } });
  verifica('la stessa nota sentita due volte non rilegge', q.length === 0, JSON.stringify(q));
  q = await emetti({ type: 'update', data: { id: 's1', tipo_file: 'secondarie', esito: 'successo', messaggio: 'ok | moduli collegati aggiornati' } });
  verifica('la nota delle secondarie non c\'entra', q.length === 0, JSON.stringify(q));
  c.azzera();
  await vai('Mese successivo', 4);
  verifica('il 2027 letto prima del caricamento si e\' dimenticato: si rilegge', titolo() === 'Gennaio 2027' && JSON.stringify(chiamate()) === '[{"anno":2027,"anno_intero":true}]',
    `${titolo()} ${JSON.stringify(chiamate())}`);
  // Una riscrittura parziale non avra' la nota: i ricalcoli non partono. Non si
  // rilegge pero' subito (revisione del 13/10/2026): l'evento arriva insieme a
  // tutte le pagine aperte. L'anno diventa vecchio e lo si dice; si rilegge
  // cambiando mese.
  adesso += 60 * 1000;
  await emetti({ type: 'create', data: { id: 'u10', tipo_file: 'primarie', esito: 'in_corso' } });
  raccoltoKg = 3500;
  adesso += 60 * 1000;
  q = await emetti({ type: 'update', data: { id: 'u10', tipo_file: 'primarie', esito: 'parziale', messaggio: '3 righe non scritte' } });
  verifica('un parziale non si rilegge subito: lo si dice', q.length === 0 && kgAVideo() === '4000' && /si è chiuso parziale/.test(avviso()), `${JSON.stringify(q)} ${kgAVideo()} «${avviso()}»`);
  c.azzera();
  await vai('Mese precedente');
  verifica('e si rilegge al primo cambio di mese, una volta', titolo() === 'Dicembre 2026' && JSON.stringify(chiamate()) === '[{"anno":2026,"anno_intero":true}]' && kgAVideo() === '3500' && avviso() === '',
    `${titolo()} ${JSON.stringify(chiamate())} ${kgAVideo()} «${avviso()}»`);
  verifica('nessun errore', r.errori.length === 0, String(r.errori[0] || ''));
  r.smonta();
}

// LA NOTA CHE NON ARRIVA (revisione del 13/10/2026, rilievo sulla revisione di
// G7, script evasione_nota_che_non_arriva.mjs). dopoCaricamento scrive la nota
// solo se riescono tutti e cinque i ricalcoli: con verifiche e qualifica
// ferme (l'ultimo caricamento delle secondarie finito parziale) o con la scheda
// chiusa, la nota non c'e', anche se l'evasione e' stata ricontrollata. La
// pagina restava ai numeri di prima per sempre, con un avviso che diceva «si
// aggiornano da soli». Ora: per tre minuti si aspetta la nota e l'avviso dice
// fino a quando; poi l'anno e' vecchio, l'avviso lo dice, e si rilegge al primo
// cambio di mese o con «Rileggi ora». Allo scadere non parte niente da solo.
console.log('LA PAGINA: SE LA NOTA NON ARRIVA, LO DICE E SI RILEGGE AL PRIMO GESTO');
{
  const orologio = orologioFinto().installa();
  adesso = VeraData.parse('2026-10-12T10:00:00Z');
  let primarieDel = '2026-10-12T07:00:00';
  let raccoltoKg = 1000;
  const vuoto = { evasi: 0, kg: 0, aperte: [], senza_fine: [], date_da_sistemare: [] };
  const riga = () => ({ chiave: kN, nome: NAPPI, target_kg: null, target_regioni: [], non_raccoglie: false, raccolto_kg: raccoltoKg, assegnati_ora: 1,
    canali: { rete: { ...vuoto, evasi: 1, kg: raccoltoKg }, aci: vuoto, extra: vuoto }, alert_canali: [], lista: null, controllo: null });
  const c = clienteFinto({ funzioni: { evasioneAssegnati: async (corpo) => ({
    anno: corpo.anno, anno_intero: true, primarie_caricate_il: primarieDel, caricamento_aperto: null, controlli_non_riusciti: null,
    mesi: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, { raccoglitori: [riga()], senza_raccolta: [] }])),
  }) } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const p = await caricaPagina('components/verifiche/EvasioneAssegnati');
  const r = p.monta(p.Componente, { isAdmin: false });
  await aspetta(60);
  const chiamate = () => c.funzioniChiamate('evasioneAssegnati').map(x => x.payload);
  const pulsante = (t) => trova(r.albero, el => el.type && el.type.__finto === 'Button' && el.props.title === t)[0];
  const vai = async (t) => { pulsante(t).props.onClick(); await aspetta(60); };
  const rileggiOra = () => trova(r.albero, el => el.type && el.type.__finto === 'Button' && /Rileggi ora/.test(testo(el)))[0];
  const kgAVideo = () => trova(r.albero, el => el.type && el.type.name === 'RigaRaccoglitore').map(el => el.props.riga.raccolto_kg).join(',');
  const avviso = () => { const t = testo(r.albero); const i = t.indexOf('Dopo la lettura di questa pagina'); return i < 0 ? '' : t.slice(i, i + 400); };
  const passa = async (ms) => { adesso += ms; await orologio.avanza(ms); await aspetta(60); };
  const emetti = async (evento) => { c.azzera(); c.emetti('UploadLog', evento); await aspetta(60); return chiamate(); };
  const u9 = { id: 'u9', tipo_file: 'primarie', nome_file: 'primarie.xlsx', utente: 'admin', modalita: 'sostituzione' };

  // 12:01 italiane: il caricamento si apre e si chiude, e il server passa a 4.000 kg
  await passa(60 * 1000);
  await emetti({ type: 'create', data: { ...u9, esito: 'in_corso', messaggio: 'Caricamento in corso: archivio in riscrittura.' } });
  primarieDel = '2026-10-12T10:01:00'; raccoltoKg = 4000;
  let q = await emetti({ type: 'update', data: { ...u9, esito: 'successo', messaggio: '10487 righe del file entrate in archivio' } });
  verifica('alla chiusura nessuna chiamata, e l\'avviso dice fino a quando si aspettano i ricalcoli', q.length === 0
    && /alle 12:01/.test(avviso()) && /se alle 12:04 non è successo, si rileggono cambiando mese o con «Rileggi ora»/.test(avviso()), `${JSON.stringify(q)} «${avviso()}»`);
  verifica('e non promette che si aggiornano da soli', !/si aggiornano da soli/.test(avviso()), avviso());
  verifica('durante l\'attesa «Rileggi ora» non c\'e\'', !rileggiOra());
  // 12:03: i ricalcoli sono finiti, ma la nota non c'e'
  await passa(2 * 60 * 1000);
  c.azzera();
  await vai('Mese precedente');
  verifica('12:03, cambiando mese durante l\'attesa: niente, lavora ancora controllaEvasioneAssegnati', chiamate().length === 0 && kgAVideo() === '1000', `${JSON.stringify(chiamate())} ${kgAVideo()}`);
  // 12:04 passate: l'attesa e' finita. La pagina si ridisegna e lo dice, senza chiamare niente.
  await passa(70 * 1000);
  verifica('allo scadere non parte nessuna chiamata', chiamate().length === 0, JSON.stringify(chiamate()));
  verifica('l\'avviso cambia: i ricalcoli non risultano finiti, si rileggono cambiando mese o con «Rileggi ora»',
    /i ricalcoli del caricamento non risultano finiti/.test(avviso()) && /si rileggono cambiando mese o con «Rileggi ora»/.test(avviso()) && !!rileggiOra(), `«${avviso()}»`);
  // mezz'ora dopo, senza toccare niente: ancora nessuna chiamata, e l'avviso dice la verita'
  await passa(30 * 60 * 1000);
  verifica('12:34, senza toccare niente: nessuna chiamata, e l\'avviso non promette niente', chiamate().length === 0 && kgAVideo() === '1000'
    && !/da sola|da soli/.test(avviso()), `${JSON.stringify(chiamate())} «${avviso()}»`);
  c.azzera();
  rileggiOra()?.props.onClick();
  await aspetta(60);
  verifica('«Rileggi ora»: una chiamata per l\'anno davanti, e i numeri nuovi', JSON.stringify(chiamate()) === '[{"anno":2026,"anno_intero":true}]' && kgAVideo() === '4000', `${JSON.stringify(chiamate())} ${kgAVideo()}`);
  verifica('e l\'avviso se ne va', avviso() === '', avviso());
  c.azzera();
  await vai('Mese precedente');
  verifica('poi cambiando mese niente: l\'anno e\' nuovo', chiamate().length === 0, JSON.stringify(chiamate()));
  // la nota che arriva tardi (i ricalcoli rifatti da chi apre i caricamenti) rilegge lo stesso, una volta
  q = await emetti({ type: 'update', data: { ...u9, esito: 'successo', messaggio: '10487 righe del file entrate in archivio | moduli collegati aggiornati' } });
  verifica('una nota arrivata tardi rilegge, una volta', JSON.stringify(q) === '[{"anno":2026,"anno_intero":true}]', JSON.stringify(q));

  // Lo stesso, cambiando mese invece di premere: e la rete dei cinque minuti
  // non scatta mentre si aspetta la nota.
  await passa(60 * 1000);
  await emetti({ type: 'create', data: { id: 'u11', tipo_file: 'primarie', esito: 'in_corso' } });
  raccoltoKg = 5000;
  await passa(4 * 60 * 1000 + 30 * 1000); // la lettura dell'anno ha piu' di cinque minuti
  await emetti({ type: 'update', data: { id: 'u11', tipo_file: 'primarie', esito: 'successo', messaggio: 'ok' } });
  await passa(40 * 1000);
  c.azzera();
  await vai('Mese successivo');
  verifica('anno letto da piu\' di cinque minuti, ma si aspetta la nota: niente', chiamate().length === 0 && kgAVideo() === '4000', `${JSON.stringify(chiamate())} ${kgAVideo()}`);
  await passa(3 * 60 * 1000);
  await vai('Mese successivo');
  verifica('attesa finita: il primo cambio di mese rilegge, una volta', JSON.stringify(chiamate()) === '[{"anno":2026,"anno_intero":true}]' && kgAVideo() === '5000' && avviso() === '',
    `${JSON.stringify(chiamate())} ${kgAVideo()} «${avviso()}»`);

  // Un caricamento aperto e poi rifiutato prima di toccare l'archivio
  // (importEcotyreFile chiude la riga in errore, senza modalita'): i numeri a
  // video valgono ancora, e l'avviso se ne va.
  await passa(60 * 1000);
  await emetti({ type: 'create', data: { id: 'u12', tipo_file: 'primarie', esito: 'in_corso' } });
  verifica('aperto: l\'avviso c\'e\'', /è partito un caricamento delle primarie/.test(avviso()) && !rileggiOra(), avviso());
  q = await emetti({ type: 'update', data: { id: 'u12', tipo_file: 'primarie', esito: 'errore', messaggio: 'Timeout (fase: lettura del file)' } });
  verifica('rifiutato a dati intatti: nessuna chiamata e niente avviso', q.length === 0 && avviso() === '', `${JSON.stringify(q)} «${avviso()}»`);
  verifica('nessun errore', r.errori.length === 0, String(r.errori[0] || ''));
  r.smonta();
  orologio.ripristina();
}

// LA NOTA ARRIVA MA LA RILETTURA NON RIESCE (revisione del 13/10/2026, rilievo
// della revisione di R5, script evasione_nota_lettura_fallita.mjs). Alla nota
// rileggono insieme tutte le pagine aperte, e lo stesso aggiornamento del
// registro fa ripartire il motore degli alert: la rilettura puo' fallire (un
// 500, o il limite di richieste che non passa). Prima l'avviso prometteva
// ancora «La pagina li rilegge da sola quando il caricamento segna finiti i suoi
// ricalcoli», che non sarebbe piu' successo; fino alle 12:04 il cambio di mese
// non rileggeva e «Rileggi ora» non c'era; dopo l'avviso diceva che i ricalcoli
// «non risultano finiti», ed erano finiti. Ora la nota segna i ricalcoli finiti:
// mentre la rilettura e' in volo l'avviso lo dice, se non riesce l'anno e'
// vecchio subito e si rilegge al cambio di mese o con «Rileggi ora».
console.log('LA PAGINA: LA NOTA ARRIVA MA LA RILETTURA NON RIESCE');
{
  const orologio = orologioFinto().installa();
  adesso = VeraData.parse('2026-10-12T10:00:00Z');
  let raccoltoKg = 1000;
  // come risponde il server: 'ok', o 'sospesa' (la risposta arriva, o fallisce,
  // quando la prova la lascia andare)
  let modo = 'ok';
  let lascia = null;
  const vuoto = { evasi: 0, kg: 0, aperte: [], senza_fine: [], date_da_sistemare: [] };
  const riga = () => ({ chiave: kN, nome: NAPPI, target_kg: null, target_regioni: [], non_raccoglie: false, raccolto_kg: raccoltoKg, assegnati_ora: 1,
    canali: { rete: { ...vuoto, evasi: 1, kg: raccoltoKg }, aci: vuoto, extra: vuoto }, alert_canali: [], lista: null, controllo: null });
  const guasto = () => { const e = new Error('Rate limit exceeded'); e.status = 429; return e; };
  const c = clienteFinto({ funzioni: { evasioneAssegnati: async (corpo) => {
    if (modo === 'sospesa') await new Promise((ok, ko) => { lascia = { ok, ko }; });
    return { anno: corpo.anno, anno_intero: true, primarie_caricate_il: '2026-10-12T10:01:00', caricamento_aperto: null, controlli_non_riusciti: null,
      mesi: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, { raccoglitori: [riga()], senza_raccolta: [] }])) };
  } } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const p = await caricaPagina('components/verifiche/EvasioneAssegnati');
  const r = p.monta(p.Componente, { isAdmin: false });
  await aspetta(60);
  const chiamate = () => c.funzioniChiamate('evasioneAssegnati').map(x => x.payload);
  const vai = async (t) => { trova(r.albero, el => el.type && el.type.__finto === 'Button' && el.props.title === t)[0].props.onClick(); await aspetta(60); };
  const rileggiOra = () => trova(r.albero, el => el.type && el.type.__finto === 'Button' && /Rileggi ora/.test(testo(el)))[0];
  const kgAVideo = () => trova(r.albero, el => el.type && el.type.name === 'RigaRaccoglitore').map(el => el.props.riga.raccolto_kg).join(',');
  // il testo dell'avviso, senza il pulsante che gli sta accanto
  const avviso = () => testo(trova(r.albero, el => el.type === 'span' && /min-w-0 flex-1/.test(el.props.className || ''))[0]);
  const passa = async (ms) => { adesso += ms; await orologio.avanza(ms); await aspetta(60); };
  const emetti = async (evento) => { c.azzera(); c.emetti('UploadLog', evento); await aspetta(60); return chiamate(); };
  const promette = (t) => /da sola|da soli|La pagina li rilegge/.test(t);

  // 12:01: il caricamento si apre e si chiude, e sul server Nappi passa a 4.000 kg
  const u9 = { id: 'u9', tipo_file: 'primarie', nome_file: 'primarie.xlsx', utente: 'admin', modalita: 'sostituzione' };
  await passa(60 * 1000);
  await emetti({ type: 'create', data: { ...u9, esito: 'in_corso', messaggio: 'Caricamento in corso: archivio in riscrittura.' } });
  raccoltoKg = 4000;
  await emetti({ type: 'update', data: { ...u9, esito: 'successo', messaggio: '10487 righe del file entrate in archivio' } });
  // 12:01:20 la nota: la rilettura parte e resta in volo
  await passa(20 * 1000);
  modo = 'sospesa';
  const q = await emetti({ type: 'update', data: { ...u9, esito: 'successo', messaggio: '10487 righe del file entrate in archivio | moduli collegati aggiornati' } });
  modo = 'ok';
  verifica('alla nota parte una rilettura dell\'anno davanti', JSON.stringify(q) === '[{"anno":2026,"anno_intero":true}]', JSON.stringify(q));
  verifica('mentre e\' in volo l\'avviso dice che i ricalcoli sono finiti e che la pagina sta rileggendo, senza altre promesse',
    /\(alle 12:01\) e i ricalcoli sono finiti: la pagina sta rileggendo i numeri, e intanto quelli qui sotto sono di prima\./.test(avviso()) && !/La pagina li rilegge da sola/.test(avviso())
    && kgAVideo() === '1000', `«${avviso()}» ${kgAVideo()}`);
  verifica('e «Rileggi ora» c\'e\' ma e\' fermo, per non partire due volte', !!rileggiOra() && rileggiOra().props.disabled === true, String(rileggiOra()?.props.disabled));
  c.azzera();
  await vai('Mese precedente');
  verifica('cambiando mese con la rilettura in volo non ne parte un\'altra', chiamate().length === 0, JSON.stringify(chiamate()));
  // la risposta: il limite di richieste che non passa
  lascia.ko(guasto());
  await aspetta(60);
  verifica('la rilettura non riesce: l\'avviso dice che i ricalcoli sono finiti e la rilettura no, e come si rilegge',
    /\(alle 12:01\): i ricalcoli sono finiti ma la rilettura non è riuscita, e i numeri qui sotto sono quelli di prima\. Si rileggono cambiando mese o con «Rileggi ora»\./.test(avviso())
    && !promette(avviso()) && kgAVideo() === '1000', `«${avviso()}» ${kgAVideo()}`);
  verifica('e «Rileggi ora» ora si puo\' premere', !!rileggiOra() && !rileggiOra().props.disabled, String(rileggiOra()?.props.disabled));
  c.azzera();
  rileggiOra()?.props.onClick();
  await aspetta(60);
  verifica('«Rileggi ora»: una chiamata, i numeri nuovi, e l\'avviso se ne va', JSON.stringify(chiamate()) === '[{"anno":2026,"anno_intero":true}]' && kgAVideo() === '4000' && avviso() === '',
    `${JSON.stringify(chiamate())} ${kgAVideo()} «${avviso()}»`);
  verifica('nessun errore', r.errori.length === 0, String(r.errori[0] || ''));
  r.smonta();
  orologio.ripristina();
}
{
  const orologio = orologioFinto().installa();
  adesso = VeraData.parse('2026-10-12T10:00:00Z');
  let raccoltoKg = 1000;
  let modo = 'ok';
  const vuoto = { evasi: 0, kg: 0, aperte: [], senza_fine: [], date_da_sistemare: [] };
  const riga = () => ({ chiave: kN, nome: NAPPI, target_kg: null, target_regioni: [], non_raccoglie: false, raccolto_kg: raccoltoKg, assegnati_ora: 1,
    canali: { rete: { ...vuoto, evasi: 1, kg: raccoltoKg }, aci: vuoto, extra: vuoto }, alert_canali: [], lista: null, controllo: null });
  const c = clienteFinto({ funzioni: { evasioneAssegnati: async (corpo) => {
    if (modo === 'guasto') { const e = new Error('Rate limit exceeded'); e.status = 429; throw e; }
    return { anno: corpo.anno, anno_intero: true, primarie_caricate_il: '2026-10-12T10:01:00', caricamento_aperto: null, controlli_non_riusciti: null,
      mesi: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, { raccoglitori: [riga()], senza_raccolta: [] }])) };
  } } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const p = await caricaPagina('components/verifiche/EvasioneAssegnati');
  const r = p.monta(p.Componente, { isAdmin: false });
  await aspetta(60);
  const chiamate = () => c.funzioniChiamate('evasioneAssegnati').map(x => x.payload);
  const vai = async (t) => { trova(r.albero, el => el.type && el.type.__finto === 'Button' && el.props.title === t)[0].props.onClick(); await aspetta(60); };
  const rileggiOra = () => trova(r.albero, el => el.type && el.type.__finto === 'Button' && /Rileggi ora/.test(testo(el)))[0];
  const kgAVideo = () => trova(r.albero, el => el.type && el.type.name === 'RigaRaccoglitore').map(el => el.props.riga.raccolto_kg).join(',');
  // il testo dell'avviso, senza il pulsante che gli sta accanto
  const avviso = () => testo(trova(r.albero, el => el.type === 'span' && /min-w-0 flex-1/.test(el.props.className || ''))[0]);
  const passa = async (ms) => { adesso += ms; await orologio.avanza(ms); await aspetta(60); };
  const emetti = async (evento) => { c.azzera(); c.emetti('UploadLog', evento); await aspetta(60); return chiamate(); };
  const promette = (t) => /da sola|da soli|La pagina li rilegge/.test(t);
  const NON_RIUSCITA = /\(alle 12:01\): i ricalcoli sono finiti ma la rilettura non è riuscita, e i numeri qui sotto sono quelli di prima\. Si rileggono cambiando mese o con «Rileggi ora»\./;
  const u9 = { id: 'u9', tipo_file: 'primarie', nome_file: 'primarie.xlsx', utente: 'admin', modalita: 'sostituzione' };
  const nota = (riga) => ({ type: 'update', data: { ...riga, esito: 'successo', messaggio: '10487 righe del file entrate in archivio | moduli collegati aggiornati' } });

  // 12:01 la chiusura, 12:01:20 la nota, e la rilettura non riesce
  await passa(60 * 1000);
  await emetti({ type: 'create', data: { ...u9, esito: 'in_corso', messaggio: 'Caricamento in corso: archivio in riscrittura.' } });
  raccoltoKg = 4000;
  await emetti({ type: 'update', data: { ...u9, esito: 'successo', messaggio: '10487 righe del file entrate in archivio' } });
  await passa(20 * 1000);
  modo = 'guasto';
  let q = await emetti(nota(u9));
  modo = 'ok';
  verifica('alla nota una rilettura, che non riesce', q.length === 1 && kgAVideo() === '1000', `${JSON.stringify(q)} ${kgAVideo()}`);
  verifica('l\'avviso dice che i ricalcoli sono finiti e la rilettura no, e come si rilegge', NON_RIUSCITA.test(avviso()), `«${avviso()}»`);
  verifica('e non promette piu\' una rilettura da sola', !promette(avviso()), `«${avviso()}»`);
  verifica('«Rileggi ora» c\'e\' subito, e si puo\' premere', !!rileggiOra() && !rileggiOra().props.disabled, String(rileggiOra()?.props.disabled));
  // 12:02:30, prima della fine dell'attesa: cambiando mese si rilegge
  await passa(70 * 1000);
  c.azzera();
  await vai('Mese precedente');
  verifica('12:02:30, cambiando mese: una chiamata e i numeri nuovi', JSON.stringify(chiamate()) === '[{"anno":2026,"anno_intero":true}]' && kgAVideo() === '4000',
    `${JSON.stringify(chiamate())} ${kgAVideo()}`);
  verifica('e l\'avviso se ne va', avviso() === '' && !rileggiOra(), `«${avviso()}»`);
  // 12:05, passata l'attesa: niente cambia, e niente parte
  await passa(150 * 1000);
  verifica('12:05: nessuna chiamata e nessun avviso, mai «non risultano finiti»', chiamate().length === 1 && avviso() === '' && !/non risultano finiti/.test(testo(r.albero)),
    `${JSON.stringify(chiamate())} «${avviso()}»`);

  // Lo stesso caricamento, ma chi guarda non tocca niente fino a dopo l'attesa:
  // l'avviso resta quello giusto, niente parte da solo, e «Rileggi ora» rilegge.
  await passa(60 * 1000); // 12:06
  const u10 = { ...u9, id: 'u10' };
  await emetti({ type: 'create', data: { ...u10, esito: 'in_corso' } });
  raccoltoKg = 4500;
  await emetti({ type: 'update', data: { ...u10, esito: 'successo', messaggio: 'ok' } });
  await passa(20 * 1000);
  modo = 'guasto';
  q = await emetti(nota(u10));
  modo = 'ok';
  await passa(5 * 60 * 1000); // le 12:11, ben oltre l'attesa di tre minuti
  verifica('passata l\'attesa senza toccare niente: nessuna chiamata, e l\'avviso dice ancora che la rilettura non e\' riuscita',
    q.length === 1 && chiamate().length === 1 && kgAVideo() === '4000' && /\(alle 12:06\): i ricalcoli sono finiti ma la rilettura non è riuscita/.test(avviso())
    && !/non risultano finiti/.test(avviso()) && !promette(avviso()), `${JSON.stringify(q)} ${JSON.stringify(chiamate())} «${avviso()}»`);
  c.azzera();
  rileggiOra()?.props.onClick();
  await aspetta(60);
  verifica('«Rileggi ora»: una chiamata, i numeri nuovi, e l\'avviso se ne va', JSON.stringify(chiamate()) === '[{"anno":2026,"anno_intero":true}]' && kgAVideo() === '4500' && avviso() === '',
    `${JSON.stringify(chiamate())} ${kgAVideo()} «${avviso()}»`);

  // La nota di un'altra riga, arrivata tardi mentre si aspetta quella del
  // caricamento chiuso: i ricalcoli di questo non sono finiti, e se la sua
  // rilettura non riesce si continua ad aspettare la nota giusta.
  await passa(60 * 1000); // 12:12
  const u11 = { ...u9, id: 'u11' };
  await emetti({ type: 'create', data: { ...u11, esito: 'in_corso' } });
  raccoltoKg = 5000;
  await emetti({ type: 'update', data: { ...u11, esito: 'successo', messaggio: 'ok' } });
  await passa(20 * 1000);
  modo = 'guasto';
  q = await emetti(nota({ ...u9, id: 'u8' }));
  modo = 'ok';
  verifica('la nota di un\'altra riga rilegge (non riesce) ma non segna finiti i ricalcoli di questo caricamento',
    q.length === 1 && /La pagina li rilegge da sola quando il caricamento segna finiti i suoi ricalcoli/.test(avviso()) && !rileggiOra(), `${JSON.stringify(q)} «${avviso()}»`);
  q = await emetti(nota(u11));
  verifica('la nota giusta rilegge, e l\'avviso se ne va', q.length === 1 && kgAVideo() === '5000' && avviso() === '', `${JSON.stringify(q)} ${kgAVideo()} «${avviso()}»`);

  // La chiusura che l'iscrizione non ha sentito (un evento perso): la riga si
  // e' vista aperta, poi arriva la sua nota. La nota viene solo dopo una
  // chiusura riuscita e a ricalcoli finiti: se la rilettura non riesce l'avviso
  // lo dice, e non resta «non ancora chiuso».
  await passa(60 * 1000); // 12:13:40
  const u12 = { ...u9, id: 'u12' };
  await emetti({ type: 'create', data: { ...u12, esito: 'in_corso' } });
  verifica('la riga aperta: l\'avviso dice che il caricamento non e\' ancora chiuso', /\(alle 12:13\), non ancora chiuso/.test(avviso()), `«${avviso()}»`);
  raccoltoKg = 5500;
  await passa(20 * 1000);
  modo = 'guasto';
  q = await emetti(nota(u12));
  modo = 'ok';
  verifica('chiusura persa, la nota della riga aperta: i ricalcoli sono finiti e la rilettura non e\' riuscita, non «non ancora chiuso»',
    q.length === 1 && /\(alle 12:13\): i ricalcoli sono finiti ma la rilettura non è riuscita/.test(avviso()) && !/non ancora chiuso/.test(avviso())
    && !!rileggiOra() && !rileggiOra().props.disabled && kgAVideo() === '5000', `${JSON.stringify(q)} ${kgAVideo()} «${avviso()}»`);
  c.azzera();
  await vai('Mese precedente');
  verifica('e cambiando mese si rilegge: una chiamata, i numeri nuovi, l\'avviso se ne va', JSON.stringify(chiamate()) === '[{"anno":2026,"anno_intero":true}]' && kgAVideo() === '5500' && avviso() === '',
    `${JSON.stringify(chiamate())} ${kgAVideo()} «${avviso()}»`);
  verifica('nessun errore', r.errori.length === 0, String(r.errori[0] || ''));
  r.smonta();
  orologio.ripristina();
}

// UN PARZIALE CON DUE PAGINE APERTE (revisione del 13/10/2026, rilievo sulla
// revisione di G7, script evasione_parziale_due_pagine.mjs). La rilettura
// immediata sul parziale partiva nello stesso istante su tutte le pagine
// aperte, e ognuna ricontrollava da se' la stessa lista: due letture pesanti e
// due controlli nuovi. Il server finto fa quello che fa eseguiControlli: se
// l'ultimo controllo della lista e' piu' vecchio delle primarie ne crea uno.
console.log('LA PAGINA: UN PARZIALE NON FA PARTIRE LE PAGINE APERTE INSIEME');
{
  adesso = VeraData.parse('2026-10-12T10:00:00Z');
  let primarieDel = '2026-10-12T07:00:00';
  const controlli = [{ lista_id: 'L1', primarie_caricate_il: '2026-10-12T07:00:00' }];
  const vuoto = { evasi: 0, kg: 0, aperte: [], senza_fine: [], date_da_sistemare: [] };
  const riga = { chiave: kN, nome: NAPPI, target_kg: null, target_regioni: [], non_raccoglie: false, raccolto_kg: 1000, assegnati_ora: 1,
    canali: { rete: { ...vuoto, evasi: 1, kg: 1000 }, aci: vuoto, extra: vuoto }, alert_canali: [], lista: null, controllo: null };
  const c = clienteFinto({ funzioni: {
    evasioneAssegnati: async (corpo) => {
      const ultimo = controlli.at(-1);
      await aspetta(10);
      if (ultimo.primarie_caricate_il < primarieDel) controlli.push({ lista_id: 'L1', primarie_caricate_il: primarieDel });
      return { anno: corpo.anno, anno_intero: true, primarie_caricate_il: primarieDel, caricamento_aperto: null, controlli_non_riusciti: null,
        mesi: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, { raccoglitori: [riga], senza_raccolta: [] }])) };
    },
    controllaEvasioneAssegnati: async () => ({ controlli: 1, liste: 1 }),
  } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const p = await caricaPagina('components/verifiche/EvasioneAssegnati');
  const a = p.monta(p.Componente, { isAdmin: true });
  const b = p.monta(p.Componente, { isAdmin: false });
  await aspetta(80);
  const primaDelCaricamento = controlli.length;
  adesso += 60 * 1000;
  c.azzera();
  c.emetti('UploadLog', { type: 'create', data: { id: 'u10', tipo_file: 'primarie', esito: 'in_corso' } });
  await aspetta(20);
  primarieDel = '2026-10-12T10:01:00';
  adesso += 30 * 1000;
  c.emetti('UploadLog', { type: 'update', data: { id: 'u10', tipo_file: 'primarie', esito: 'parziale', messaggio: '3 righe non scritte' } });
  await aspetta(80);
  const avvisoDi = (r) => { const t = testo(r.albero); const i = t.indexOf('Dopo la lettura di questa pagina'); return i < 0 ? '' : t.slice(i, i + 300); };
  const rileggiDi = (r) => trova(r.albero, el => el.type && el.type.__finto === 'Button' && /Rileggi ora/.test(testo(el)))[0];
  verifica('al parziale nessuna pagina rilegge, e nessun controllo nuovo', c.funzioniChiamate('evasioneAssegnati').length === 0 && controlli.length === primaDelCaricamento,
    `${c.funzioniChiamate('evasioneAssegnati').length} letture, ${controlli.length - primaDelCaricamento} controlli`);
  verifica('tutte e due lo dicono, e offrono «Rileggi ora»', /si è chiuso parziale/.test(avvisoDi(a)) && /si è chiuso parziale/.test(avvisoDi(b)) && !!rileggiDi(a) && !!rileggiDi(b), avvisoDi(b));
  // chi guarda la pagina A cambia mese: una lettura, un controllo; la B resta com'e'
  c.azzera();
  trova(a.albero, el => el.type && el.type.__finto === 'Button' && el.props.title === 'Mese precedente')[0].props.onClick();
  await aspetta(80);
  verifica('il cambio di mese di una persona: una lettura e un controllo nuovo', c.funzioniChiamate('evasioneAssegnati').length === 1 && controlli.length === primaDelCaricamento + 1,
    `${c.funzioniChiamate('evasioneAssegnati').length} letture, ${controlli.length - primaDelCaricamento} controlli`);
  verifica('la pagina A non ha piu\' l\'avviso, la B si', avvisoDi(a) === '' && /si è chiuso parziale/.test(avvisoDi(b)), `«${avvisoDi(a)}» «${avvisoDi(b)}»`);
  // «Controlla ora» sulla B (amministratore o no, qui la A): ricontrollo e rilettura
  c.azzera();
  trova(a.albero, el => el.type && el.type.__finto === 'Button' && /Controlla ora/.test(testo(el)))[0].props.onClick();
  await aspetta(80);
  verifica('«Controlla ora» rilegge l\'anno, come sempre', c.funzioniChiamate('controllaEvasioneAssegnati').length === 1 && c.funzioniChiamate('evasioneAssegnati').length === 1,
    JSON.stringify(c.funzioniChiamate().map(x => x.nome)));
  verifica('nessun errore', a.errori.length === 0 && b.errori.length === 0, String(a.errori[0] || b.errori[0] || ''));
  a.smonta(); b.smonta();
}

// LE SCHEDE DI EXTRA RACCOLTA (revisione del 13/10/2026, lasciato fuori dal
// giro di prima). Un salvataggio nel modulo Extra Raccolta scrive una riga
// «extra_raccolta» gia' riuscita, senza nota. La pagina non la ascoltava: con
// l'anno in memoria il canale Extra restava quello di prima fino alla rete dei
// cinque minuti. Ora l'anno diventa vecchio, si dice, e si rilegge al primo
// cambio di mese o con «Rileggi ora»; non da solo, perche' un salvataggio dopo
// l'altro farebbe rileggere tutte le pagine aperte a ogni scheda.
console.log('LA PAGINA: LE SCHEDE DI EXTRA RACCOLTA SALVATE DOPO LA LETTURA');
{
  adesso = VeraData.parse('2026-10-12T10:00:00Z');
  let extraKg = 0;
  const vuoto = { evasi: 0, kg: 0, aperte: [], senza_fine: [], date_da_sistemare: [] };
  const riga = () => ({ chiave: kN, nome: NAPPI, target_kg: null, target_regioni: [], non_raccoglie: false, raccolto_kg: 1000, assegnati_ora: 1,
    canali: { rete: { ...vuoto, evasi: 1, kg: 1000 }, aci: vuoto, extra: { ...vuoto, evasi: extraKg ? 1 : 0, kg: extraKg } }, alert_canali: [], lista: null, controllo: null });
  const c = clienteFinto({ funzioni: { evasioneAssegnati: async (corpo) => ({
    anno: corpo.anno, anno_intero: true, primarie_caricate_il: '2026-10-12T07:00:00', caricamento_aperto: null, controlli_non_riusciti: null,
    mesi: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, { raccoglitori: [riga()], senza_raccolta: [] }])),
  }) } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const p = await caricaPagina('components/verifiche/EvasioneAssegnati');
  const r = p.monta(p.Componente, { isAdmin: false });
  await aspetta(60);
  const chiamate = () => c.funzioniChiamate('evasioneAssegnati').map(x => x.payload);
  const vai = async (t) => { trova(r.albero, el => el.type && el.type.__finto === 'Button' && el.props.title === t)[0].props.onClick(); await aspetta(60); };
  const rileggiOra = () => trova(r.albero, el => el.type && el.type.__finto === 'Button' && /Rileggi ora/.test(testo(el)))[0];
  const extraAVideo = () => trova(r.albero, el => el.type && el.type.name === 'RigaRaccoglitore').map(el => el.props.riga.canali.extra.kg).join(',');
  const avviso = () => { const t = testo(r.albero); const i = t.indexOf('Dopo la lettura di questa pagina'); return i < 0 ? '' : t.slice(i, i + 300); };
  const emetti = async (evento) => { c.azzera(); c.emetti('UploadLog', evento); await aspetta(60); return chiamate(); };
  const scheda = (id) => ({ type: 'create', data: { id, tipo_file: 'extra_raccolta', nome_file: 'Schede di extra raccolta', esito: 'successo', messaggio: 'Schede modificate con fine trasporto dal 2026-09-10 al 2026-09-10' } });

  adesso += 60 * 1000;
  extraKg = 12000;
  let q = await emetti(scheda('x1'));
  verifica('una scheda salvata: nessuna chiamata, e lo si dice', q.length === 0 && extraAVideo() === '0'
    && /sono state salvate schede di extra raccolta \(alle 12:01\): il canale Extra qui sotto è quello di prima e si rilegge cambiando mese o con «Rileggi ora»/.test(avviso()) && !!rileggiOra(),
    `${JSON.stringify(q)} ${extraAVideo()} «${avviso()}»`);
  adesso += 60 * 1000;
  c.azzera();
  await vai('Mese precedente');
  verifica('il primo cambio di mese rilegge l\'anno, una volta, col canale Extra nuovo', JSON.stringify(chiamate()) === '[{"anno":2026,"anno_intero":true}]' && extraAVideo() === '12000' && avviso() === '',
    `${JSON.stringify(chiamate())} ${extraAVideo()} «${avviso()}»`);
  c.azzera();
  await vai('Mese precedente');
  verifica('il cambio di mese dopo: niente', chiamate().length === 0, JSON.stringify(chiamate()));
  adesso += 60 * 1000;
  extraKg = 15000;
  await emetti(scheda('x2'));
  c.azzera();
  rileggiOra()?.props.onClick();
  await aspetta(60);
  verifica('oppure «Rileggi ora»', JSON.stringify(chiamate()) === '[{"anno":2026,"anno_intero":true}]' && extraAVideo() === '15000' && avviso() === '', `${JSON.stringify(chiamate())} ${extraAVideo()}`);
  // durante l'attesa della nota di un caricamento delle primarie, la scheda non
  // anticipa la rilettura: la nota rilegge tutto
  adesso += 60 * 1000;
  await emetti({ type: 'create', data: { id: 'u20', tipo_file: 'primarie', esito: 'in_corso', modalita: 'sostituzione' } });
  await emetti({ type: 'update', data: { id: 'u20', tipo_file: 'primarie', esito: 'successo', modalita: 'sostituzione', messaggio: 'ok' } });
  adesso += 30 * 1000;
  extraKg = 16000;
  await emetti(scheda('x3'));
  c.azzera();
  await vai('Mese successivo');
  verifica('scheda salvata mentre si aspetta la nota: cambiando mese niente, e niente «Rileggi ora»', chiamate().length === 0 && !rileggiOra() && /le primarie sono state ricaricate/.test(avviso()),
    `${JSON.stringify(chiamate())} «${avviso()}»`);
  q = await emetti({ type: 'update', data: { id: 'u20', tipo_file: 'primarie', esito: 'successo', modalita: 'sostituzione', messaggio: 'ok | moduli collegati aggiornati' } });
  verifica('la nota rilegge tutto, una volta', JSON.stringify(q) === '[{"anno":2026,"anno_intero":true}]' && extraAVideo() === '16000' && avviso() === '', `${JSON.stringify(q)} ${extraAVideo()} «${avviso()}»`);
  verifica('nessun errore', r.errori.length === 0, String(r.errori[0] || ''));
  r.smonta();
}

globalThis.Date = VeraData;
console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
