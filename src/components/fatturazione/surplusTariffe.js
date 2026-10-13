// IL SURPLUS SULLE TARIFFE NELLA PAGINA (13/10/2026).
//
// Richiesta dell'utente del 12/10/2026: accanto alle tariffe che si danno ai
// fornitori un eventuale surplus, sempre in €/t, con le sue date di inizio e
// fine validita', quando il consorzio o un accordo commerciale lo indicano (il
// primo e' il Fuel Surcharge del consorzio Ecotyre, +5 €/t da ottobre a
// dicembre 2026 su rete, ACI ed extra raccolta); «ordinato, elegante e
// professionale nonche' semplice a colpo d'occhio».
//
// Qui stanno le parti della pagina che non disegnano niente: le schede (i
// record dello stesso surplus sui diversi canali insieme), le tariffe che un
// surplus tocca, la frase che dice che cosa succede prima di salvare, i
// controlli del modulo campo per campo e la richiesta per gestisciAnagrafiche.
// Le regole (quando vale, a chi, i controlli, i conflitti) sono quelle di
// src/lib/surplus.js, specchio di base44/shared/surplus.ts: le stesse del
// calcolo e del salvataggio, cosi' la pagina non dice una cosa e il server
// un'altra. Funzioni pure, import relativi: le prova prove/surplusPagina.mjs.
import {
  CANALI_SURPLUS, PRESTAZIONI_SURPLUS, NOMI_ORIGINE, NOMI_CANALE, DESTINATARI,
  testoEuroT, euroTDi, fornitoriDelSurplus, statoSurplus, controlliSurplus, conflittiSurplus,
  etichettaSurplus, giornoPrimaDi, mesiDelSurplus,
} from '../../lib/surplus.js';
import { oggiRoma } from '../../lib/giornoItaliano.js';
import { normalizzaRagioneSociale } from '../../lib/normalizzaRagioneSocialeClient.js';

/** L'ordine delle schede: prima quello che vale oggi, poi quello che arriva, poi il passato. */
export const ORDINE_STATO = ['in_corso', 'in_arrivo', 'concluso', 'disattivato'];
export const NOMI_STATO = { in_corso: 'In corso', in_arrivo: 'In arrivo', concluso: 'Concluso', disattivato: 'Disattivato' };
/** Il destinatario al singolare, per la frase: «ogni raccoglitore riceve». */
export const DESTINATARIO = { RACCOLTA: 'raccoglitore', TRATTAMENTO: 'impianto', CONFERIMENTO_STOCCAGGIO: 'stoccaggio', TRASPORTO_SECONDARIA: 'trasportatore delle secondarie' };
/** Le tonnellate di ogni prestazione: «sulle tonnellate raccolte nel mese». */
export const TONNELLATE_DI = { RACCOLTA: 'raccolte', TRATTAMENTO: 'trattate', CONFERIMENTO_STOCCAGGIO: 'conferite allo stoccaggio', TRASPORTO_SECONDARIA: 'trasportate' };
/** Le prestazioni come si scelgono nel modulo. */
export const NOMI_PRESTAZIONE_MODULO = { RACCOLTA: 'Raccolta', TRATTAMENTO: 'Trattamento', CONFERIMENTO_STOCCAGGIO: 'Stoccaggio', TRASPORTO_SECONDARIA: 'Trasporto secondarie' };
/** Il ruolo dell'anagrafica che fa di un fornitore un destinatario della prestazione. */
export const RUOLO_DELLA_PRESTAZIONE = { RACCOLTA: 'ruolo_raccolta', TRATTAMENTO: 'ruolo_trattamento', CONFERIMENTO_STOCCAGGIO: 'ruolo_stoccaggio', TRASPORTO_SECONDARIA: 'ruolo_trasporto_secondaria' };
// La prestazione nel conteggio delle tariffe: «22 di raccolta».
const TARIFFE_DI = { RACCOLTA: 'di raccolta', TRATTAMENTO: 'di trattamento', CONFERIMENTO_STOCCAGGIO: 'di stoccaggio', TRASPORTO_SECONDARIA: 'di trasporto' };
// Il canale dopo una preposizione: «sulla rete», «sull'ACI».
const SUL_CANALE = { RETE: 'sulla Rete', ACI: "sull'ACI", EXTRA_RACCOLTA: "sull'Extra raccolta" };

const codice = (v) => String(v || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
const ordineCanale = (c) => { const i = CANALI_SURPLUS.indexOf(codice(c)); return i < 0 ? 9 : i; };
const giorno10 = (v) => { const g = String(v || '').trim().slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(g) ? g : ''; };

/** Un giorno 'aaaa-mm-gg' all'italiana: 01/10/2026; vuoto se non e' un giorno. */
export const dataIt = (v) => { const g = giorno10(v); return g ? g.split('-').reverse().join('/') : ''; };
/** Solo giorno e mese: 01/10, per le pastiglie strette. */
export const dataBreve = (v) => { const g = giorno10(v); return g ? `${g.slice(8, 10)}/${g.slice(5, 7)}` : ''; };
/** Un importo in piu': «+5,00 €/t»; vuoto se non c'e'. */
export const piuEuroT = (v) => { const t = testoEuroT(v); return t ? `+${t}` : ''; };

/** Un elenco a parole: «Rete, ACI ed Extra raccolta». */
export function elencoItaliano(parole) {
  const p = (parole || []).filter(Boolean);
  if (p.length <= 1) return p.join('');
  const ultima = p[p.length - 1];
  return `${p.slice(0, -1).join(', ')} ${/^[eE]/.test(ultima) ? 'ed' : 'e'} ${ultima}`;
}
/** I canali a parole, nell'ordine Rete, ACI, Extra raccolta. */
export const canaliAParole = (canali) => elencoItaliano([...new Set((canali || []).map(codice))].sort((a, b) => ordineCanale(a) - ordineCanale(b)).map(c => NOMI_CANALE[c] || c));

const giorniFra = (da, a) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${da}T12:00:00Z`)) / 86400000);

/**
 * Dove sta oggi nel periodo di un surplus, per la barra della scheda:
 * { pct (0-100, quanto del periodo e' passato), giorni (alla fine, se in corso;
 * all'inizio, se in arrivo; null altrimenti) }.
 */
export function avanzamento(dal, al, oggi) {
  const d = giorno10(dal), a = giorno10(al), o = giorno10(oggi) || oggiRoma();
  if (!d || !a || a < d) return { pct: null, giorni: null };
  if (o < d) return { pct: 0, giorni: giorniFra(o, d) };
  if (o > a) return { pct: 100, giorni: null };
  const durata = giorniFra(d, a) + 1;
  return { pct: Math.round(((giorniFra(d, o) + 1) / durata) * 1000) / 10, giorni: giorniFra(o, a) };
}

/**
 * Le schede della pagina: i record dello stesso surplus (lo stesso gruppo) su
 * tutti i canali insieme, perche' l'utente pensa «il Fuel Surcharge», non tre
 * righe; un record senza gruppo e' una scheda da solo. Lo stato della scheda e'
 * il piu' vivo dei suoi canali (in corso se almeno un canale lo e'). Ordinate:
 * in corso, in arrivo, concluse, disattivate; dentro, per data di inizio e
 * nome.
 */
export function schedeSurplus(surplusAll, oggi) {
  const giorno = giorno10(oggi) || oggiRoma();
  const perGruppo = new Map();
  for (const s of surplusAll || []) {
    if (!s) continue;
    const chiave = String(s.gruppo || '').trim() || `id:${s.id}`;
    if (!perGruppo.has(chiave)) perGruppo.set(chiave, []);
    perGruppo.get(chiave).push(s);
  }
  const schede = [];
  for (const [chiave, records] of perGruppo) {
    records.sort((a, b) => ordineCanale(a.tipologia) - ordineCanale(b.tipologia) || String(a.data_inizio_validita || '').localeCompare(String(b.data_inizio_validita || '')));
    const primo = records[0];
    const canali = records.map(r => ({
      canale: codice(r.tipologia), id: r.id, record: r, stato: statoSurplus(r, giorno),
      passiva: euroTDi(r, 'PASSIVA'), attiva: euroTDi(r, 'ATTIVA'),
      dal: giorno10(r.data_inizio_validita), al: giorno10(r.data_fine_validita),
    }));
    const stati = canali.map(c => c.stato);
    const tutti = (f) => new Set(canali.map(f)).size <= 1;
    const dal = canali.map(c => c.dal).filter(Boolean).sort()[0] || '';
    const al = canali.map(c => c.al).filter(Boolean).sort().pop() || '';
    schede.push({
      chiave,
      gruppo: String(primo.gruppo || '').trim(),
      records,
      canali,
      nome: String(primo.nome || '').trim() || 'Surplus',
      origine: codice(primo.origine),
      origine_testo: NOMI_ORIGINE[codice(primo.origine)] || '',
      riferimento: String(primo.riferimento || '').trim(),
      note: String(primo.note || '').trim(),
      prestazione: codice(primo.prestazione),
      a_chi: String(primo.a_chi || 'tutti').trim().toLowerCase() === 'elenco' ? 'elenco' : 'tutti',
      fornitori: fornitoriDelSurplus(primo),
      stato: ORDINE_STATO.find(x => stati.includes(x)) || 'disattivato',
      importiUguali: tutti(c => `${c.passiva}|${c.attiva}`),
      dateUguali: tutti(c => `${c.dal}|${c.al}`),
      passiva: canali[0].passiva,
      attiva: canali[0].attiva,
      dal,
      al,
    });
  }
  return schede.sort((a, b) => ORDINE_STATO.indexOf(a.stato) - ORDINE_STATO.indexOf(b.stato)
    || (a.stato === 'concluso' ? b.dal.localeCompare(a.dal) : a.dal.localeCompare(b.dal))
    || a.nome.localeCompare(b.nome, 'it'));
}

/** La chiave della scheda di una voce della colonna (surplusDellaTariffa): il gruppo, o l'id. */
export const chiaveDellaVoce = (v) => (String((v && v.gruppo) || '').trim() || `id:${v && v.id}`);

/**
 * Quante tariffe tocca oggi ogni surplus, per la fascia in cima alle tariffe:
 * Map chiave della scheda -> { totale, passive, attive, prestazioni: { RACCOLTA: n } }.
 * perTariffa e' la colonna gia' calcolata (Map id -> surplusDellaTariffa): la
 * fascia conta le stesse tariffe che la colonna segna, non un conto suo.
 * Si contano solo le tariffe che la tabella mostra senza «Mostra archiviate».
 */
export function tariffeDelleSchede(tariffe, perTariffa, archiviata = () => false) {
  const conti = new Map();
  for (const t of tariffe || []) {
    if (!t || archiviata(t)) continue;
    const col = perTariffa && perTariffa.get(t.id);
    if (!col) continue;
    const attiva = codice(t.direzione) === 'ATTIVA';
    for (const v of [...(col.oggi || []), ...(col.in_arrivo || [])]) {
      const k = chiaveDellaVoce(v);
      if (!conti.has(k)) conti.set(k, { totale: 0, passive: 0, attive: 0, prestazioni: {}, ids: new Set() });
      const c = conti.get(k);
      if (c.ids.has(t.id)) continue;
      c.ids.add(t.id);
      c.totale++;
      if (attiva) c.attive++;
      else { c.passive++; const p = codice(t.prestazione); c.prestazioni[p] = (c.prestazioni[p] || 0) + 1; }
    }
  }
  return conti;
}

/** «29 tariffe interessate (22 di raccolta, 7 attive)»; vuoto se nessuna. */
export function testoTariffe(conto) {
  if (!conto || !conto.totale) return '';
  const parti = Object.entries(conto.prestazioni || {}).sort((a, b) => PRESTAZIONI_SURPLUS.indexOf(a[0]) - PRESTAZIONI_SURPLUS.indexOf(b[0]))
    .map(([p, n]) => `${n} ${TARIFFE_DI[p] || 'passive'}`);
  if (conto.attive) parti.push(`${conto.attive} ${conto.attive === 1 ? 'attiva' : 'attive'}`);
  const testa = `${conto.totale} ${conto.totale === 1 ? 'tariffa interessata' : 'tariffe interessate'}`;
  return parti.length > 1 ? `${testa} (${parti.join(', ')})` : testa;
}

/** Vero se la colonna di una tariffa ha qualcosa: un surplus di oggi o uno in arrivo. */
export const haSurplus = (col) => !!col && ((col.oggi || []).length > 0 || (col.in_arrivo || []).length > 0);

/**
 * La fascia breve in cima alle tariffe quando nessun surplus e' in corso o in
 * arrivo (il surplus sulle tariffe, 13/10/2026). Dopo la pubblicazione l'utente
 * non ha trovato la sezione dei surplus: la fascia c'era solo con un surplus in
 * corso, e senza surplus della sezione restava la linguetta «Surplus» accanto a
 * «Tariffe». Ora la fascia c'e' sempre, appena i surplus sono letti, e dice da
 * dove si scrivono.
 * -> null se un surplus e' in corso o in arrivo (allora c'e' la fascia piena);
 *    altrimenti { testo }: «nessuno scritto», o «nessuno in corso o in arrivo»
 *    se ci sono solo surplus conclusi o disattivati.
 */
export function fasciaVuota(schede) {
  const tutte = (schede || []).filter(Boolean);
  if (tutte.some(s => s.stato === 'in_corso' || s.stato === 'in_arrivo')) return null;
  return { testo: tutte.length ? 'nessuno in corso o in arrivo' : 'nessuno scritto' };
}

/** Le linguette di Tariffe & Anagrafiche, nell'ordine in cui stanno a video. */
export const SEZIONI_TARIFFE = ['tariffe', 'surplus', 'ruoli'];

/**
 * La linguetta di Tariffe & Anagrafiche da un collegamento:
 * /fatturazione?tab=tariffe&sezione=surplus apre i surplus (13/10/2026), per
 * chi arriva dalla dashboard, da EcoTyna o dalla prefattura. Come in
 * src/lib/collegamenti.js, un valore che non si capisce si ignora (null): la
 * scheda si apre sulle tariffe, come sempre.
 */
export function sezioneDelCollegamento(search) {
  const s = String(new URLSearchParams(search || '').get('sezione') || '').trim().toLowerCase();
  return SEZIONI_TARIFFE.includes(s) ? s : null;
}

/**
 * Gli importi di una scheda a parole, per la fascia: «+5,00 €/t ai raccoglitori
 * e da Ecotyre». A chi non e' amministratore si dice solo la parte da Ecotyre,
 * e gli importi sono «diversi per canale» solo se e' quella a cambiare: prima
 * la fascia restava senza importo appena la parte ai fornitori cambiava da un
 * canale all'altro (revisione del 13/10/2026).
 */
export function importiAParole(scheda, { conCosti = true } = {}) {
  if (!scheda) return '';
  const a = DESTINATARI[scheda.prestazione] || 'fornitori';
  const uguali = (conCosti || !Array.isArray(scheda.canali)) ? scheda.importiUguali : new Set(scheda.canali.map(c => c.attiva)).size <= 1;
  if (!uguali) return 'importi diversi per canale';
  const p = conCosti ? scheda.passiva : null;
  const e = scheda.attiva;
  if (p !== null && e !== null && p === e) return `${piuEuroT(p)} ai ${a} e da Ecotyre`;
  return [p !== null ? `${piuEuroT(p)} ai ${a}` : '', e !== null ? `${piuEuroT(e)} da Ecotyre` : ''].filter(Boolean).join(', ');
}

// Il periodo a parole: «dal 01/11/2026 al 31/12/2026», «fino al 31/12/2026».
function periodoAParole(dal, al) {
  const d = dataIt(dal), a = dataIt(al);
  if (d && a) return `dal ${d} al ${a}`;
  if (d) return `dal ${d}`;
  return a ? `fino al ${a}` : '';
}
// I canali dopo una preposizione: «sulla Rete», «su ACI ed Extra raccolta».
const sulCanali = (canali) => (canali.length === 1 ? (SUL_CANALE[canali[0]] || `su ${canaliAParole(canali)}`) : `su ${canaliAParole(canali)}`);
const conMaiuscola = (t) => `${t.charAt(0).toUpperCase()}${t.slice(1)}`;

/**
 * La scheda come la dice la fascia in cima alle tariffe: solo i canali vivi
 * oggi (in corso o in arrivo), ognuno col suo periodo; un canale gia' concluso
 * non si nomina, e se i canali vivi finiscono (o cominciano) in giorni diversi
 * la fascia lo dice canale per canale. Importi e periodo vengono dagli stessi
 * canali.
 *
 * Revisione del 13/10/2026: la fascia prendeva canali e «fino al» da tutta la
 * scheda. Il caso e' la regola 7 del progetto fatta su un canale solo: il Fuel
 * Surcharge sale a 6 €/t sulla sola rete dal 01/11, la rete del +5 si chiude al
 * 31/10, ACI ed extra raccolta restano al 31/12 nello stesso gruppo. La fascia
 * diceva «Rete, ACI ed Extra raccolta · fino al 31/12/2026» per il +5 e, sotto,
 * «Rete · fino al 31/12/2026» per il +6: a colpo d'occhio la rete prendeva 5 + 6
 * €/t a novembre e dicembre, mentre la colonna della stessa tariffa diceva il
 * giusto (solo +6). Ora dice «Rete fino al 31/10/2026, ACI ed Extra raccolta
 * fino al 31/12/2026», e dal 01/11 «ACI ed Extra raccolta · fino al 31/12/2026».
 * -> null se nessun canale e' vivo; altrimenti { ...scheda, canali (i vivi),
 *    importiUguali, passiva, attiva, dal, al, etichetta, dove: [testi] }
 *    etichetta: «In corso», «Dal 01/11/2026», o «In arrivo» se i canali
 *    cominciano in giorni diversi.
 */
export function schedaNellaFascia(scheda) {
  const vivi = ((scheda && scheda.canali) || []).filter(c => c.stato === 'in_corso' || c.stato === 'in_arrivo');
  if (!vivi.length) return null;
  // Chi e' in corso si dice con la fine; chi e' in arrivo con l'inizio e la fine.
  const periodi = new Map();
  for (const c of vivi) {
    const k = c.stato === 'in_corso' ? `in_corso||${c.al}` : `in_arrivo|${c.dal}|${c.al}`;
    if (!periodi.has(k)) periodi.set(k, { stato: c.stato, dal: c.dal, al: c.al, canali: [] });
    periodi.get(k).canali.push(c.canale);
  }
  const gruppi = [...periodi.values()];
  const dal = vivi.map(c => c.dal).filter(Boolean).sort()[0] || '';
  const al = vivi.map(c => c.al).filter(Boolean).sort().pop() || '';
  const etichetta = vivi.some(c => c.stato === 'in_corso')
    ? 'In corso'
    : (gruppi.length === 1 && dal ? `Dal ${dataIt(dal)}` : 'In arrivo');
  const dove = gruppi.length === 1
    ? [canaliAParole(gruppi[0].canali), gruppi[0].al ? `fino al ${dataIt(gruppi[0].al)}` : '']
    : [gruppi.map(g => [canaliAParole(g.canali), g.stato === 'in_corso' ? (g.al ? `fino al ${dataIt(g.al)}` : '') : periodoAParole(g.dal, g.al)].filter(Boolean).join(' ')).join(', ')];
  return {
    ...scheda,
    canali: vivi,
    importiUguali: new Set(vivi.map(c => `${c.passiva}|${c.attiva}`)).size <= 1,
    passiva: vivi[0].passiva,
    attiva: vivi[0].attiva,
    dal,
    al,
    etichetta,
    dove: dove.filter(Boolean),
  };
}

// === Il modulo ===

/** Un importo scritto nel modulo: vuoto -> null, «5,00» e «5.00» -> 5; un testo che non e' un numero resta testo (lo ferma controlliSurplus dicendolo). */
export function leggiImporto(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : String(v);
  const t = String(v).trim().replace(/\s|€\/t|€/g, '');
  if (!t) return null;
  const n = Number(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(',', '.'));
  return Number.isFinite(n) ? n : String(v).trim();
}
/** Un importo da mettere nel campo del modulo: 5 -> «5,00». */
const importoNelCampo = (v) => (v === null || v === undefined ? '' : testoEuroT(v).replace(' €/t', ''));

const IMPORTI_VUOTI = () => Object.fromEntries(CANALI_SURPLUS.map(c => [c, { passiva: '', attiva: '' }]));

/** Il modulo vuoto: niente e' scelto per conto dell'utente, tranne «tutti» e la raccolta. */
export function bozzaVuota() {
  return {
    nome: '', origine: '', riferimento: '', note: '',
    canali: [], prestazione: 'RACCOLTA', a_chi: 'tutti', fornitori: [],
    passiva: '', attiva: '', uguale: true, perCanale: false, importi: IMPORTI_VUOTI(),
    dal: '', al: '',
  };
}

/**
 * La comunicazione del consorzio Ecotyre del 2026, il caso vero: +5 €/t a tutti
 * i raccoglitori dal 01/10 al 31/12, su rete, ACI ed extra raccolta. E' l'unico
 * anno scritto nel codice della pagina: le date degli anni dopo le decide il
 * consorzio, e la scorciatoia le propone senza indovinarle (bozzaFuelSurcharge).
 */
export const FUEL_SURCHARGE_CONSORZIO = { anno: 2026, dal: '10-01', al: '12-31', euro_t: '5,00' };

// Il nome come lo confronta conflittiSurplus (chiaveNome di src/lib/surplus.js,
// che non si esporta): senza accenti, minuscolo, solo lettere e cifre.
const chiaveNome = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const annoDi = (g) => Number(String(g || '').slice(0, 4));

// Lo stesso giorno e mese in un altro anno; il 29/02 in un anno che non lo ha
// diventa il 28/02.
function nellAnno(giorno, anno) {
  const g = `${anno}-${String(giorno).slice(5, 10)}`;
  const d = new Date(`${g}T12:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === g ? g : `${anno}-02-28`;
}

// Gli importi di un record come li scrive il campo del modulo.
const importiNelCampo = (s) => ({ passiva: importoNelCampo(euroTDi(s, 'PASSIVA')), attiva: importoNelCampo(euroTDi(s, 'ATTIVA')) });
const chiaveImporti = (i) => `${(i && i.passiva) || ''}|${(i && i.attiva) || ''}`;

/**
 * L'ultimo Fuel Surcharge del consorzio scritto fino all'anno dato: i record con
 * lo stesso nome (normalizzato) e origine consorzio, non disattivati, dell'anno
 * piu' recente che ne ha. -> null, o { anno, dal, al (il periodo di tutti i suoi
 * canali), canali, importi: { canale: { passiva, attiva } } (di ogni canale
 * quelli del suo record che comincia per ultimo, gia' scritti come nel campo),
 * uguali (tutti i canali con gli stessi importi), cambiati (un canale ha
 * cambiato importo durante l'anno), passiva, attiva (quelli del primo canale) }.
 *
 * Revisione del 13/10/2026: gli importi erano quelli del canale che comincia
 * per ultimo, messi su tutti. Col caso della regola 7 del progetto (la sola
 * rete a 6 €/t dal 01/11/2026, ACI ed extra raccolta a 5 fino al 31/12) la
 * proposta del 2027 dava 6 anche ad ACI ed extra raccolta: salvata com'era,
 * 1 €/t in piu' pagato e fatturato su due canali. Ora ogni canale tiene i suoi.
 */
export function ultimoFuelSurcharge(surplusAll, finoAllAnno) {
  const fuel = (surplusAll || []).filter(s => s && chiaveNome(s.nome) === 'fuel surcharge' && codice(s.origine) === 'CONSORZIO'
    && String(s.stato || 'attivo') !== 'non_attivo' && giorno10(s.data_inizio_validita) && annoDi(s.data_inizio_validita) <= finoAllAnno);
  if (!fuel.length) return null;
  const anno = Math.max(...fuel.map(s => annoDi(s.data_inizio_validita)));
  const suoi = fuel.filter(s => annoDi(s.data_inizio_validita) === anno)
    .sort((a, b) => giorno10(a.data_inizio_validita).localeCompare(giorno10(b.data_inizio_validita)) || ordineCanale(a.tipologia) - ordineCanale(b.tipologia));
  const fini = suoi.map(s => giorno10(s.data_fine_validita)).filter(g => g && annoDi(g) === anno).sort();
  const canali = [...new Set(suoi.map(s => codice(s.tipologia)).filter(c => CANALI_SURPLUS.includes(c)))].sort((a, b) => ordineCanale(a) - ordineCanale(b));
  const importi = {};
  let cambiati = false;
  for (const c of canali) {
    const delCanale = suoi.filter(s => codice(s.tipologia) === c);
    importi[c] = importiNelCampo(delCanale[delCanale.length - 1]);
    if (new Set(delCanale.map(s => chiaveImporti(importiNelCampo(s)))).size > 1) cambiati = true;
  }
  const primo = canali.length ? importi[canali[0]] : importiNelCampo(suoi[suoi.length - 1]);
  return {
    anno,
    dal: giorno10(suoi[0].data_inizio_validita),
    al: fini.length ? fini[fini.length - 1] : `${anno}-12-31`,
    canali,
    importi,
    uguali: new Set(canali.map(c => chiaveImporti(importi[c]))).size <= 1,
    cambiati,
    passiva: primo.passiva,
    attiva: primo.attiva,
  };
}

/**
 * Gli importi a parole, canale per canale, raggruppati: «Rete 6,00 €/t, ACI ed
 * Extra raccolta 5,00 €/t»; se la parte ai raccoglitori e quella da Ecotyre
 * sono diverse le dice tutte e due.
 */
function importiDeiCanaliAParole(canali, importi) {
  const gruppi = new Map();
  for (const c of canali) {
    const k = chiaveImporti(importi[c]);
    if (!gruppi.has(k)) gruppi.set(k, { ...importi[c], canali: [] });
    gruppi.get(k).canali.push(c);
  }
  return [...gruppi.values()].map(g => {
    const quanto = g.passiva === g.attiva
      ? (g.passiva ? `${g.passiva} €/t` : 'senza importo')
      : [g.passiva ? `${g.passiva} €/t ai raccoglitori` : '', g.attiva ? `${g.attiva} €/t da Ecotyre` : ''].filter(Boolean).join(' e ');
    return `${canaliAParole(g.canali)} ${quanto}`;
  }).join(', ');
}

/**
 * La scorciatoia «Fuel Surcharge del consorzio»: il modulo compilato come il
 * Fuel Surcharge del consorzio Ecotyre (a tutti i raccoglitori, su rete, ACI ed
 * extra raccolta), con le date dell'anno di oggi, sul giorno italiano.
 *
 * Vale anche negli anni dopo, con le date da confermare ogni anno (risposta
 * dell'utente del 13/10/2026): i contratti sono annuali, e il Fuel Surcharge
 * non si copia da solo nell'anno nuovo. Le date proposte:
 * - nel 2026 quelle della comunicazione (FUEL_SURCHARGE_CONSORZIO);
 * - negli anni dopo quelle dell'ultimo Fuel Surcharge del consorzio scritto,
 *   spostate all'anno di oggi, coi suoi canali e i suoi importi canale per
 *   canale: se i canali hanno importi diversi, o un canale li ha cambiati
 *   durante l'anno, il modulo si apre con gli importi per canale e la nota li
 *   dice uno per uno (revisione del 13/10/2026);
 * - se non ce n'e' nessuno, l'anno intero.
 * Sempre da confermare: bozza.proposta { dal, al, testo } lo dice nel modulo
 * finche' Dal e Al restano quelli proposti.
 */
export function bozzaFuelSurcharge(oggi, surplusAll = []) {
  const anno = annoDi(giorno10(oggi) || oggiRoma());
  const F = FUEL_SURCHARGE_CONSORZIO;
  const base = {
    ...bozzaVuota(),
    nome: 'Fuel Surcharge', origine: 'CONSORZIO',
    canali: [...CANALI_SURPLUS], prestazione: 'RACCOLTA', a_chi: 'tutti',
    passiva: F.euro_t, attiva: F.euro_t, uguale: true,
  };
  const conProposta = (bozza, testo) => ({ ...bozza, proposta: { dal: bozza.dal, al: bozza.al, testo } });
  if (anno === F.anno) {
    const dal = `${anno}-${F.dal}`, al = `${anno}-${F.al}`;
    return conProposta({ ...base, dal, al },
      `Dal ${dataIt(dal)} al ${dataIt(al)}, come la comunicazione del consorzio per il ${anno}: confrontale con la comunicazione prima di salvare.`);
  }
  const prima = ultimoFuelSurcharge(surplusAll, anno);
  if (!prima) {
    const dal = `${anno}-01-01`, al = `${anno}-12-31`;
    return conProposta({ ...base, dal, al },
      `Tutto il ${anno}, dal ${dataIt(dal)} al ${dataIt(al)}: il consorzio decide il periodo ogni anno. Scrivi le date e gli importi della sua comunicazione.`);
  }
  const dal = nellAnno(prima.dal, anno), al = nellAnno(prima.al, anno);
  const passiva = prima.passiva || '';
  const attiva = prima.attiva || '';
  const canali = prima.canali.length ? prima.canali : base.canali;
  const importi = IMPORTI_VUOTI();
  for (const c of canali) importi[c] = { passiva: (prima.importi[c] || {}).passiva || '', attiva: (prima.importi[c] || {}).attiva || '' };
  const bozza = { ...base, dal, al, canali, passiva, attiva, uguale: !!passiva && passiva === attiva, perCanale: !prima.uguali, importi };
  if (prima.anno === anno) {
    return conProposta(bozza, `Dal ${dataIt(dal)} al ${dataIt(al)}: sono le date del Fuel Surcharge già scritto per il ${anno}. Se il consorzio ne ha comunicato un altro, scrivi le sue date.`);
  }
  const conImporti = prima.uguali && !prima.cambiati
    ? 'con i suoi importi'
    : `con l'ultimo importo di ogni canale: ${importiDeiCanaliAParole(canali, importi)}`;
  return conProposta(bozza,
    `Dal ${dataIt(dal)} al ${dataIt(al)}: sono le date del Fuel Surcharge del ${prima.anno} spostate al ${anno}, ${conImporti}. Il consorzio decide date e importi ogni anno: confrontali con la sua comunicazione prima di salvare.`);
}

// Il canale con l'articolo: «della Rete», «dell'ACI».
const DEL_CANALE = { RETE: 'della Rete', ACI: "dell'ACI", EXTRA_RACCOLTA: "dell'Extra raccolta" };

/**
 * L'avviso del modulo quando i canali di una scheda hanno date diverse: quali
 * sono, e di quale canale sono le date nei campi Dal e Al (revisione del
 * 13/10/2026: i campi mostrano quelle del primo canale, e senza dirlo
 * sembravano le date di tutto il surplus).
 * «Le date cambiano da canale a canale: Rete dal 01/10/2026 al 31/10/2026, ACI
 * ed Extra raccolta dal 01/10/2026 al 31/12/2026. Nei campi vedi quelle della
 * Rete: se le modifichi, valgono per tutti i canali; se non le tocchi, ogni
 * canale tiene le sue.»
 */
export function testoDateDiverse(scheda) {
  const canali = (scheda && scheda.canali) || [];
  if (!canali.length) return '';
  const perPeriodo = new Map();
  for (const c of canali) { const k = `${c.dal}|${c.al}`; if (!perPeriodo.has(k)) perPeriodo.set(k, { dal: c.dal, al: c.al, canali: [] }); perPeriodo.get(k).canali.push(c.canale); }
  const elenco = [...perPeriodo.values()].map(p => [canaliAParole(p.canali), periodoAParole(p.dal, p.al)].filter(Boolean).join(' ')).join(', ');
  const primo = codice(canali[0].canale);
  return `Le date cambiano da canale a canale: ${elenco}. Nei campi vedi quelle ${DEL_CANALE[primo] || `del canale ${NOMI_CANALE[primo] || primo}`}: se le modifichi, valgono per tutti i canali; se non le tocchi, ogni canale tiene le sue.`;
}

/** Il modulo di una scheda che si modifica: i valori di oggi del surplus. */
export function bozzaDaScheda(scheda) {
  const b = bozzaVuota();
  if (!scheda) return b;
  const importi = IMPORTI_VUOTI();
  for (const c of scheda.canali) importi[c.canale] = { passiva: importoNelCampo(c.passiva), attiva: importoNelCampo(c.attiva) };
  const primo = scheda.canali[0] || {};
  return {
    ...b,
    nome: String((scheda.records[0] || {}).nome || '').trim(),
    origine: scheda.origine, riferimento: scheda.riferimento, note: scheda.note,
    canali: scheda.canali.map(c => c.canale),
    prestazione: scheda.prestazione || 'RACCOLTA',
    a_chi: scheda.a_chi,
    fornitori: scheda.fornitori.map(f => ({ id: f.id, nome: f.nome })),
    passiva: importoNelCampo(primo.passiva),
    attiva: importoNelCampo(primo.attiva),
    uguale: primo.passiva !== null && primo.passiva === primo.attiva,
    perCanale: !scheda.importiUguali,
    importi,
    dal: primo.dal || '', al: primo.al || '',
  };
}

// Gli importi che il modulo chiede per un canale, gia' letti: { passiva, attiva }.
// Il trasporto delle secondarie non ha la parte attiva (a Ecotyre non si fattura).
function importiChiesti(bozza, canale) {
  const secondarie = codice(bozza.prestazione) === 'TRASPORTO_SECONDARIA';
  if (bozza.perCanale) {
    const v = (bozza.importi && bozza.importi[canale]) || {};
    return { passiva: leggiImporto(v.passiva), attiva: secondarie ? null : leggiImporto(v.attiva) };
  }
  const passiva = leggiImporto(bozza.passiva);
  return { passiva, attiva: secondarie ? null : (bozza.uguale ? passiva : leggiImporto(bozza.attiva)) };
}

// L'elenco dei fornitori come lo scrive l'archivio: JSON [{ id, nome }], vuoto con «tutti».
const elencoScritto = (bozza) => (bozza.a_chi === 'elenco' && (bozza.fornitori || []).length
  ? JSON.stringify(bozza.fornitori.map(f => ({ id: String(f.id || ''), nome: String(f.nome || '') })))
  : '');
const chiaveElenco = (bozza) => (bozza.a_chi === 'elenco'
  ? (bozza.fornitori || []).map(f => f.id || normalizzaRagioneSociale(f.nome)).sort().join(',') : '');

// I campi comuni a tutti i canali, come li scrive l'archivio.
function comuniDellaBozza(bozza) {
  return {
    nome: String(bozza.nome || '').trim(),
    origine: codice(bozza.origine),
    riferimento: String(bozza.riferimento || '').trim(),
    note: String(bozza.note || '').trim(),
    prestazione: codice(bozza.prestazione),
    a_chi: bozza.a_chi === 'elenco' ? 'elenco' : 'tutti',
    fornitori_json: elencoScritto(bozza),
    data_inizio_validita: giorno10(bozza.dal) || String(bozza.dal || '').trim(),
    data_fine_validita: giorno10(bozza.al) || String(bozza.al || '').trim(),
  };
}

/**
 * Che cosa si scrive: la richiesta per gestisciAnagrafiche e, per i controlli
 * della pagina, i record come saranno dopo, canale per canale (gli stessi che
 * il server controlla). scheda e' quella che si modifica (null per un surplus
 * nuovo); iniziale e' il modulo com'era all'apertura: in una modifica si manda
 * solo cio' che e' cambiato, cosi' un canale che ha date o importi suoi non li
 * perde perche' il modulo ne mostra uno solo. Un salvataggio fermato a meta' si
 * finisce come modifica del gruppo che il server ha rimandato: i canali che
 * mancano si creano, quelli gia' scritti restano.
 * -> { richiesta, cambi: [{ canale, id, prima, dopo }], nulla }
 */
export function pianoDelSalvataggio(bozza, { scheda = null, iniziale = null, motivo = '' } = {}) {
  const canali = [...new Set((bozza.canali || []).map(codice))].sort((a, b) => ordineCanale(a) - ordineCanale(b));
  const comuni = comuniDellaBozza(bozza);
  const desiderati = Object.fromEntries(canali.map(c => [c, importiChiesti(bozza, c)]));
  const tuttiUguali = new Set(canali.map(c => `${desiderati[c].passiva}|${desiderati[c].attiva}`)).size <= 1;
  const importiNelPayload = (perChi) => (tuttiUguali && canali.length
    ? { euro_t_passiva: desiderati[canali[0]].passiva, euro_t_attiva: desiderati[canali[0]].attiva }
    : { importi_per_canale: Object.fromEntries(perChi.map(c => [c, { euro_t_passiva: desiderati[c].passiva, euro_t_attiva: desiderati[c].attiva }])) });
  const testaMotivo = String(motivo || '').trim();

  if (!scheda) {
    const dati = { ...comuni, tipologie: canali, ...importiNelPayload(canali) };
    if (!dati.note) delete dati.note;
    const richiesta = { entita: 'SurplusTariffa', operazione: 'create', dati, motivo: testaMotivo };
    const cambi = canali.map(c => {
      const dopo = { stato: 'attivo', ...comuni, tipologia: c, euro_t_passiva: desiderati[c].passiva, euro_t_attiva: desiderati[c].attiva };
      return { canale: c, id: null, prima: null, dopo };
    });
    return { richiesta, cambi, nulla: false };
  }

  // Una modifica: solo i campi cambiati rispetto al modulo di partenza.
  const partenza = comuniDellaBozza(iniziale || bozzaDaScheda(scheda));
  const patch = {};
  for (const k of ['nome', 'origine', 'riferimento', 'note', 'prestazione', 'data_inizio_validita', 'data_fine_validita']) {
    if (comuni[k] !== partenza[k]) patch[k] = comuni[k];
  }
  // A chi e l'elenco vanno insieme: «tutti» con un elenco, o «solo questi»
  // senza, il server lo rifiuta.
  if (comuni.a_chi !== partenza.a_chi || chiaveElenco(bozza) !== chiaveElenco(iniziale || bozzaDaScheda(scheda))) {
    patch.a_chi = comuni.a_chi;
    patch.fornitori_json = comuni.fornitori_json;
  }
  const esistenti = new Map(scheda.canali.map(c => [c.canale, c]));
  const nuovi = canali.filter(c => !esistenti.has(c));
  const tolti = [...esistenti.keys()].filter(c => !canali.includes(c));
  const importiCambiati = nuovi.length > 0 || canali.some(c => {
    const e = esistenti.get(c);
    return e && (e.passiva !== desiderati[c].passiva || e.attiva !== desiderati[c].attiva);
  });
  const dati = { ...patch };
  if (importiCambiati) Object.assign(dati, importiNelPayload(canali));
  if (nuovi.length || tolti.length) dati.tipologie = canali;
  const conGruppo = !!scheda.gruppo;
  const richiesta = conGruppo
    ? { entita: 'SurplusTariffa', operazione: 'update', gruppo: scheda.gruppo, dati, motivo: testaMotivo }
    : { entita: 'SurplusTariffa', operazione: 'update', id: scheda.canali[0] && scheda.canali[0].id, dati, motivo: testaMotivo };
  const modello = scheda.records[0] || {};
  const cambi = [];
  for (const c of canali) {
    const imp = importiCambiati ? { euro_t_passiva: desiderati[c].passiva, euro_t_attiva: desiderati[c].attiva } : {};
    const e = esistenti.get(c);
    if (e) cambi.push({ canale: c, id: e.id, prima: e.record, dopo: { ...e.record, ...patch, ...imp } });
    else cambi.push({ canale: c, id: null, prima: null, dopo: { stato: 'attivo', a_chi: 'tutti', ...modello, id: undefined, ...patch, tipologia: c, gruppo: scheda.gruppo, ...imp } });
  }
  for (const c of tolti) { const e = esistenti.get(c); cambi.push({ canale: c, id: e.id, prima: e.record, dopo: null }); }
  return { richiesta, cambi, nulla: !Object.keys(dati).length };
}

/**
 * I controlli del modulo, campo per campo, con le stesse regole del server
 * (controlliSurplus e conflittiSurplus, canale per canale): cosi' l'errore si
 * legge sotto il campo che lo causa prima di salvare, non dopo.
 * -> { perCampo: { campo: [{ gravita, messaggio }] }, errori, conflitti, chiusure, avvisi }
 * I campi sono quelli del modulo: nome, origine, canali, prestazione, a_chi,
 * passiva, attiva, dal, al.
 */
export const CAMPO_DEL_MODULO = {
  nome: 'nome', origine: 'origine', riferimento: 'riferimento', tipologia: 'canali', prestazione: 'prestazione',
  a_chi: 'a_chi', fornitori_json: 'a_chi', euro_t_passiva: 'passiva', euro_t_attiva: 'attiva',
  data_inizio_validita: 'dal', data_fine_validita: 'al', gruppo: 'canali', stato: 'nome',
};
export function esitiDelModulo(bozza, cambi, surplusAll) {
  const perCampo = {};
  const visti = new Set();
  const metti = (campo, gravita, messaggio) => {
    const k = `${campo}|${messaggio}`;
    if (visti.has(k)) return;
    visti.add(k);
    (perCampo[campo] = perCampo[campo] || []).push({ gravita, messaggio });
  };
  // Le frasi dei conflitti e degli avvisi, canale per canale; la stessa frase su
  // piu' canali si dice una volta, e i canali si scrivono davanti solo se non
  // sono tutti quelli scelti (come frasiPerCanale del server).
  const perFrase = { conflitti: new Map(), avvisi: new Map() };
  const aggiungi = (dove, canale, frase) => { if (!perFrase[dove].has(frase)) perFrase[dove].set(frase, []); perFrase[dove].get(frase).push(canale); };
  const scelti = new Set((cambi || []).filter(x => x.dopo).map(x => x.canale));
  const frasi = (dove) => [...perFrase[dove].entries()].map(([f, canali]) => (canali.length < scelti.size ? `${canaliAParole(canali)}: ${f}` : conMaiuscola(f)));
  // Le chiusure nominano sempre il canale del surplus che si chiude, e dicono
  // quali canali dello stesso surplus restano com'erano (revisione del
  // 13/10/2026): col Fuel Surcharge a 6 €/t sulla sola rete dal 01/11 il modulo
  // diceva «Fuel Surcharge (consorzio Ecotyre), dal 01/10/2026 al 31/12/2026 si
  // chiude il 31/10/2026», e si leggeva che si chiudeva tutto il Fuel, mentre
  // ACI ed extra raccolta restano al 31/12.
  const chiusure = new Map();
  const nelSalvataggio = new Set((cambi || []).map(x => x.id).filter(Boolean));
  // Senza canali non c'e' un record da controllare: si controlla lo stesso il
  // resto del modulo, come se fosse la rete, per non tacere gli altri campi.
  if (!(cambi || []).some(x => x.dopo)) {
    metti('canali', 'errore', 'Scegli almeno un canale: Rete, ACI o Extra raccolta. Ogni canale avrà la sua riga.');
    const { passiva, attiva } = importiChiesti(bozza, 'RETE');
    const finto = { stato: 'attivo', ...comuniDellaBozza(bozza), tipologia: 'RETE', euro_t_passiva: passiva, euro_t_attiva: attiva };
    for (const e of controlliSurplus(finto)) if (e.campo !== 'tipologia') metti(CAMPO_DEL_MODULO[e.campo] || 'nome', e.gravita, e.messaggio);
  }
  for (const { canale, id, dopo } of cambi || []) {
    if (!dopo) continue;
    for (const e of controlliSurplus(dopo)) metti(CAMPO_DEL_MODULO[e.campo] || 'nome', e.gravita, e.messaggio);
    if (String(dopo.stato || 'attivo') === 'non_attivo') continue;
    const esito = conflittiSurplus(dopo, surplusAll || [], id);
    for (const t of esito.conflitti) {
      aggiungi('conflitti', canale, `c'è già lo stesso surplus negli stessi giorni, ${etichettaSurplus(t)}: si pagherebbe due volte. Cambia le date, o modifica quello che c'è.`);
    }
    for (const t of esito.chiudibili) {
      const giorno = giornoPrimaDi(dopo.data_inizio_validita);
      const k = `${etichettaSurplus(t)}|${giorno}`;
      if (!chiusure.has(k)) chiusure.set(k, { etichetta: etichettaSurplus(t), giorno, canali: [], ids: new Set(), gruppi: new Set() });
      const c = chiusure.get(k);
      if (!c.canali.includes(codice(t.tipologia))) c.canali.push(codice(t.tipologia));
      c.ids.add(t.id);
      if (String(t.gruppo || '').trim()) c.gruppi.add(String(t.gruppo).trim());
    }
    for (const a of esito.avvisi) aggiungi('avvisi', canale, a.messaggio);
  }
  const conflitti = frasi('conflitti');
  for (const m of conflitti) metti('nome', 'errore', m);
  const chiusi = new Set([...chiusure.values()].flatMap(c => [...c.ids]));
  const testiChiusure = [...chiusure.values()].map(c => {
    const canali = [...c.canali].sort((a, b) => ordineCanale(a) - ordineCanale(b));
    // Gli altri canali dello stesso surplus che vivono dopo quel giorno e che
    // questo salvataggio non tocca: restano come sono.
    const restano = [...new Set((surplusAll || []).filter(s => s && c.gruppi.has(String(s.gruppo || '').trim())
      && !chiusi.has(s.id) && !nelSalvataggio.has(s.id) && statoSurplus(s, c.giorno) !== 'disattivato'
      && (!giorno10(s.data_fine_validita) || giorno10(s.data_fine_validita) > c.giorno))
      .map(s => codice(s.tipologia)).filter(x => !canali.includes(x)))];
    const frase = `${c.etichetta}, ${sulCanali(canali)} si chiude il ${dataIt(c.giorno)}, il giorno prima di questo: fino a quel giorno resta valido com'è.`;
    return restano.length ? `${frase} ${conMaiuscola(sulCanali(restano))} resta com'è.` : frase;
  });
  const errori = Object.values(perCampo).flat().filter(e => e.gravita === 'errore').length;
  return { perCampo, errori, conflitti, chiusure: testiChiusure, avvisi: frasi('avvisi') };
}

/**
 * Vero se il salvataggio puo' toccare un mese gia' passato o in corso: solo
 * allora si chiede prima l'anteprima al server, che dice se uno di quei mesi e'
 * gia' fatturato o congelato (un mese dopo quello di oggi non puo' essere
 * chiuso). Un surplus scritto prima del suo periodo non costa richieste in piu'.
 */
export function toccaMesiPassati(cambi, oggi) {
  const mese = (giorno10(oggi) || oggiRoma()).slice(0, 7);
  return (cambi || []).some(({ prima, dopo }) => [prima, dopo].some(s => s && String(s.stato || 'attivo') !== 'non_attivo'
    && mesiDelSurplus(s).some(m => `${m.anno}-${String(m.mese).padStart(2, '0')}` <= mese)));
}

/**
 * Scrive passando da gestisciAnagrafiche, l'unica strada: solo l'amministratore,
 * ogni record con la sua traccia nello storico delle modifiche. Con anteprima
 * chiede prima che cosa cambierebbe nei mesi gia' chiusi: se ce n'e' uno, non
 * scrive e lo rimanda per la conferma. invoke e' base44.functions.invoke.
 * -> { stato: 'da_confermare', mesi } | { stato: 'fatto', data }; un errore della funzione si lancia.
 */
export async function scriviSurplus(invoke, richieste, { anteprima = false } = {}) {
  const elenco = Array.isArray(richieste) ? richieste : [richieste];
  if (anteprima) {
    const mesi = [];
    for (const r of elenco) {
      const prova = await invoke('gestisciAnagrafiche', { ...r, anteprima: true });
      for (const m of (prova && prova.data && prova.data.mesi_chiusi) || []) mesi.push(m);
    }
    if (mesi.length) return { stato: 'da_confermare', mesi };
  }
  const risposte = [];
  for (const r of elenco) {
    const res = await invoke('gestisciAnagrafiche', r);
    risposte.push((res && res.data) || {});
  }
  return { stato: 'fatto', data: risposte.length === 1 ? risposte[0] : unisciRisposte(risposte) };
}
function unisciRisposte(risposte) {
  const tracce = risposte.map(r => r.traccia).filter(Boolean);
  const fallita = tracce.find(t => t.scritta === false);
  return {
    result: risposte.flatMap(r => r.result || []),
    avvisi: risposte.flatMap(r => r.avvisi || []),
    surplus_chiusi: risposte.flatMap(r => r.surplus_chiusi || []),
    mesi_chiusi: risposte.flatMap(r => r.mesi_chiusi || []),
    traccia: fallita || tracce[0] || null,
  };
}

/** L'errore di gestisciAnagrafiche letto dal corpo della risposta (AGENTS.md: mai «Request failed with status code 409»). */
export function erroreDellaRisposta(e) {
  const d = (e && ((e.response && e.response.data) || e.data)) || {};
  return {
    stato: (e && e.response && e.response.status) || null,
    testo: d.error || (e && e.message) || 'Salvataggio non riuscito.',
    errori: Array.isArray(d.errori) ? d.errori : [],
    conflitto: d.conflitto || null,
    gruppo: d.gruppo || '',
    fatti: Array.isArray(d.fatti) ? d.fatti : [],
  };
}

/**
 * La chiusura del periodo di una scheda a un giorno: lo accorcia, mai lo
 * allunga (come per le tariffe, revisione del 13/10/2026). Si accorciano solo i
 * canali che finiscono dopo quel giorno; se sono tutti, una richiesta col
 * gruppo, altrimenti una per canale, cosi' un canale chiuso prima non si
 * riallunga.
 * -> { errore } | { richieste, cambi }
 */
export function chiusuraDelPeriodo(scheda, giorno, motivo = '') {
  const g = giorno10(giorno);
  if (!scheda) return { errore: 'Non trovo il surplus.' };
  if (!g) return { errore: 'Scrivi la data di fine validità.' };
  const vivi = scheda.canali.filter(c => c.stato !== 'disattivato');
  const daAccorciare = vivi.filter(c => !c.al || c.al > g);
  if (!daAccorciare.length) return { errore: `Il surplus vale già fino al ${dataIt(scheda.al)}: chiudere il periodo lo accorcia, non lo allunga. Per cambiare le date usa «Modifica».` };
  const prima = daAccorciare.find(c => c.dal && c.dal > g);
  if (prima) return { errore: `${NOMI_CANALE[prima.canale] || prima.canale}: il surplus comincia il ${dataIt(prima.dal)}, e la fine non può venire prima. Per toglierlo da quel canale usa «Modifica».` };
  const testoMotivo = String(motivo || '').trim() || 'periodo chiuso dalla scheda dei surplus';
  const dati = { data_fine_validita: g };
  const tutti = daAccorciare.length === scheda.canali.length && !!scheda.gruppo;
  const richieste = tutti
    ? [{ entita: 'SurplusTariffa', operazione: 'update', gruppo: scheda.gruppo, dati, motivo: testoMotivo }]
    : daAccorciare.map(c => ({ entita: 'SurplusTariffa', operazione: 'update', id: c.id, dati, motivo: testoMotivo }));
  return { richieste, cambi: daAccorciare.map(c => ({ canale: c.canale, id: c.id, prima: c.record, dopo: { ...c.record, ...dati } })) };
}

/** L'eliminazione di una scheda: tutti i canali col gruppo, o il record da solo. */
export function eliminazioneDellaScheda(scheda, motivo = '') {
  const testoMotivo = String(motivo || '').trim() || 'eliminato dalla scheda dei surplus';
  const richiesta = scheda.gruppo
    ? { entita: 'SurplusTariffa', operazione: 'delete', gruppo: scheda.gruppo, motivo: testoMotivo }
    : { entita: 'SurplusTariffa', operazione: 'delete', id: scheda.canali[0] && scheda.canali[0].id, motivo: testoMotivo };
  return { richiesta, cambi: scheda.canali.map(c => ({ canale: c.canale, id: c.id, prima: c.record, dopo: null })) };
}

/**
 * La frase che dice che cosa succede, sotto il modulo, prima di salvare:
 * «Dal 01/10/2026 al 31/12/2026, su Rete, ACI ed Extra raccolta, ogni
 * raccoglitore riceve 5,00 €/t in più sulle tonnellate raccolte nel mese, e
 * SMOCO fattura a Ecotyre 5,00 €/t in più sulle stesse tonnellate. Ogni canale
 * ha la sua riga.» Con importi diversi fra i canali una frase per importo. Il
 * surplus delle tonnellate di SMOCO, che e' interna, resta a SMOCO (domanda D2
 * del progetto, realizzata con la proposta): si dice.
 *
 * cambi sono quelli di pianoDelSalvataggio: le date di ogni canale sono quelle
 * che si salveranno. In una modifica un canale con date sue le tiene finche'
 * Dal e Al non si toccano, e allora la frase le dice canale per canale
 * (revisione del 13/10/2026): prendeva il periodo del primo canale per tutti, e
 * della rete chiusa al 31/10 diceva «Dal 01/10/2026 al 31/10/2026, su Rete, ACI
 * ed Extra raccolta», mentre ACI ed extra raccolta finiscono il 31/12.
 */
export function fraseDelSurplus(bozza, cambi = null) {
  const b = bozza || bozzaVuota();
  const canali = [...new Set((b.canali || []).map(codice))].filter(c => CANALI_SURPLUS.includes(c)).sort((x, y) => ordineCanale(x) - ordineCanale(y));
  if (!canali.length) return 'Scegli almeno un canale: la frase dirà che cosa succede.';
  const prestazione = codice(b.prestazione);
  const salvati = new Map((cambi || []).filter(x => x && x.dopo).map(x => [codice(x.canale), x.dopo]));
  const periodi = Object.fromEntries(canali.map(c => {
    const d = salvati.get(c);
    return [c, d ? { dal: d.data_inizio_validita, al: d.data_fine_validita } : { dal: b.dal, al: b.al }];
  }));
  const chiavePeriodo = (c) => `${dataIt(periodi[c].dal)}|${dataIt(periodi[c].al)}`;
  const periodoUnico = new Set(canali.map(chiavePeriodo)).size <= 1;
  const dal = dataIt(periodi[canali[0]].dal), al = dataIt(periodi[canali[0]].al);
  const quando = dal && al ? `Dal ${dal} al ${al}` : dal ? `Dal ${dal}` : 'Nel periodo che scriverai';
  // Con periodi diversi: «sulla Rete dal 01/10/2026 al 31/10/2026 e su ACI ed
  // Extra raccolta dal 01/10/2026 al 31/12/2026».
  const doveConPeriodi = (suoi) => {
    const perPeriodo = new Map();
    for (const c of suoi) { const k = chiavePeriodo(c); if (!perPeriodo.has(k)) perPeriodo.set(k, []); perPeriodo.get(k).push(c); }
    return elencoItaliano([...perPeriodo.values()].map(cc => [sulCanali(cc), periodoAParole(periodi[cc[0]].dal, periodi[cc[0]].al)].filter(Boolean).join(' ')));
  };
  const nomi = (b.fornitori || []).map(f => String(f.nome || '').trim()).filter(Boolean);
  const elenco = b.a_chi === 'elenco';
  const chi = elenco
    ? (nomi.length && nomi.length <= 3 ? elencoItaliano(nomi) : nomi.length ? `i ${nomi.length} fornitori scelti` : 'i fornitori scelti')
    : `ogni ${DESTINATARIO[prestazione] || 'fornitore'}`;
  const riceve = elenco && nomi.length !== 1 ? 'ricevono' : 'riceve';
  const tonnellate = TONNELLATE_DI[prestazione] || 'del mese';
  const perImporto = new Map();
  for (const c of canali) {
    const { passiva, attiva } = importiChiesti(b, c);
    const k = `${passiva}|${attiva}`;
    if (!perImporto.has(k)) perImporto.set(k, { passiva, attiva, canali: [] });
    perImporto.get(k).canali.push(c);
  }
  const numero = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  // Una parte per importo: «su Rete ed Extra raccolta ogni raccoglitore riceve...»
  const parti = [...perImporto.values()].map(({ passiva, attiva, canali: suoi }) => {
    const dove = periodoUnico ? sulCanali(suoi) : doveConPeriodi(suoi);
    const p = numero(passiva) ? `${chi} ${riceve} ${testoEuroT(passiva)} in più sulle tonnellate ${tonnellate} nel mese` : '';
    const a = numero(attiva) ? `SMOCO fattura a Ecotyre ${testoEuroT(attiva)} in più ${p ? 'sulle stesse tonnellate' : `sulle tonnellate ${tonnellate} nel mese`}` : '';
    if (p && a) return { dove, cosa: `${p}, e ${a}` };
    if (p) return { dove, cosa: `${p}, e a Ecotyre non si fattura niente in più` };
    if (a) return { dove, cosa: `${a}, e ai fornitori non si paga niente in più` };
    return { dove, cosa: 'manca l\'importo: scrivi quanto si paga ai fornitori, quanto si fattura a Ecotyre, o tutti e due' };
  });
  const frasi = [periodoUnico
    ? (parti.length === 1
      ? `${quando}, ${parti[0].dove}, ${parti[0].cosa}.`
      : `${quando}: ${parti.map(x => `${x.dove} ${x.cosa}`).join('; ')}.`)
    : (parti.length === 1
      ? `${conMaiuscola(parti[0].dove)}: ${parti[0].cosa}.`
      : `${conMaiuscola(parti.map(x => `${x.dove} ${x.cosa}`).join('; '))}.`)];
  const passivo = [...perImporto.values()].some(x => numero(x.passiva));
  const attivo = [...perImporto.values()].some(x => numero(x.attiva));
  if (passivo && !elenco && prestazione === 'RACCOLTA') {
    frasi.push(attivo
      ? 'SMOCO, che è interna, non lo riceve: sulle tonnellate che raccoglie lei il surplus da Ecotyre resta a SMOCO.'
      : 'SMOCO, che è interna, non lo riceve: a se stessi non si fattura.');
  }
  frasi.push(canali.length > 1 ? 'Ogni canale ha la sua riga, e i canali non si sommano.' : 'Il surplus ha la sua riga, sotto quella della tariffa.');
  return frasi.join(' ');
}

/**
 * Il resoconto di un salvataggio riuscito: [frasi]. Vuoto se non c'e' niente
 * da leggere oltre al «salvato» (allora il modulo si chiude da solo).
 */
export function resocontoDelSalvataggio(data, notaStorico = '') {
  const d = data || {};
  const righe = [];
  for (const c of d.surplus_chiusi || []) {
    righe.push(`${c.nome || 'Il surplus di prima'} sul canale ${NOMI_CANALE[codice(c.tipologia)] || c.tipologia} ora vale fino al ${dataIt(c.data_fine_validita)}: dal giorno dopo vale quello nuovo.`);
  }
  for (const a of d.avvisi || []) righe.push(a);
  if (notaStorico) righe.push(notaStorico);
  return [...new Set(righe)];
}
