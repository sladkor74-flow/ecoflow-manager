// Assistente del gestionale: riconoscimento del tipo di domanda e riepilogo dei
// dati della commessa da passare al modello.
//
// Il riepilogo e' testo compatto e contiene solo dati dell'anno in corso, con le
// stesse regole del resto del gestionale: raccolto dai formulari terminati per
// data di fine trasporto, target da Target & Status.

import { fetchAll } from "./fetchAll.ts";
import { computeRaccoltoData, MESI } from "./raccoltoCalculator.ts";
// stessoRaccoglitore e targetDelPortale: l'abbinatore unico fra il nome del
// target e quello del portale (andamentoTarget.ts). Qui ce n'era una copia
// propria, con un altro nome (chiusura dell'audit, 11/10/2026).
import { aggregaTargetMensili, aggregaTargetAnnui, stessoRaccoglitore, targetDelPortale, targetMensiliValidi } from "./targetRaccoglitori.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { formatoTonnellate } from "./formato.ts";
import { giornoRoma, annoRoma } from "./giornoItaliano.ts";
import { eTerminato, giornoMovimento } from "./movimenti.ts";
import { contaFormulari } from "./formulari.ts";
import { commessaDellAnno } from "./annoTarget.ts";
import { targetAnnuoDellAnno, regioniDellAnno, attesoAllaData, attesoDellaRegione, giornoDeiDati } from "./attesoContratto.ts";
import { datiFinoAl } from "./statoArchivi.ts";

const PAROLE_DATI = [
  'target', 'raccolt', 'raccoglitor', 'giacenz', 'plafond', 'tonnellat', 'campania', 'puglia', 'basilicata',
  'calabria', 'sicilia', 'provinc', 'lista', 'liste', 'assegnat', 'evas', 'evader', 'ritir', 'fornitor',
  'qualifica', 'fattur', 'alert', 'andamento', 'contratto', 'commessa', 'destinazion', 'impiant', 'stoccagg',
  'secondari', 'terziari', 'extra raccolta', 'quanto abbiamo', 'quanti', 'quante', 'come stiamo', 'come va',
  'situazione', 'questo mese', 'mese scorso', 'settimana', 'oggi', 'in ritardo', 'scadut', 'in scadenza',
  'smoco', 'pneuservice', 'nappi', 'ecorecuperi', 'emmesse', 'gatim', 'irigom', 'tecnogum', 't-cycle', 'trs',
  'omologh', 'dichiaraz', 'scad', 'pdr', 'punto di raccolta', 'punti di raccolta', 'produttor', 'client',
  'tariff', 'viagg', 'caricat', 'caricament', 'ultimo file', 'quanto dobbiamo', 'paghiam', 'pagare', 'incassi',
  'green tyre', 'ielapi', 'silvano', 'torres', 'logistica', 'ecological', 'barone', 'minervini', 'rpn',
];

const PAROLE_NORMA = [
  'norma', 'legge', 'decreto', 'd.lgs', 'dlgs', 'd.m.', ' dm ', 'articolo', 'art.', 'obblig', 'sanzion', 'multa',
  'fir', 'formulari', 'rentri', 'albo', 'iscrizion', 'autorizzazion', 'registro', 'responsabile tecnico', ' rt ',
  'quiz', 'esame', 'idoneit', 'eer', 'cer', 'adr', 'deposito temporaneo', 'microraccolta', 'vidimaz', 'cassazion',
  'circolare', 'ministero', 'mase', 'dm 182', '152', 'consorzi', 'dipendenti', 'visura', 'durc', 'antimafia',
  'categoria', 'classe', 'garanzi', 'posso', 'devo', 'e\' obbligatorio', 'è obbligatorio', 'serve', 'bisogna',
  'si puo', 'si può', 'e\' consentito', 'è consentito', 'digitale', 'trasporto', 'rifiut',
];

/** Che cosa serve per rispondere: dati del gestionale, ricerca sulle norme o entrambi. */
export function analizzaDomanda(testo) {
  const t = ' ' + String(testo || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
  const dati = PAROLE_DATI.some(p => t.includes(p));
  const norma = PAROLE_NORMA.some(p => t.includes(p));
  // Nel dubbio si cerca sulle fonti: e' la strada che evita risposte sbagliate.
  return { dati, norma: norma || !dati, ambito: dati && norma ? 'mista' : dati ? 'operativa' : 'normativa' };
}

// Tonnellate con due decimali, tre se i kg non sono tondi; le percentuali a una cifra.
const t1 = (v) => formatoTonnellate(v);
const p1 = (v) => (Math.round((Number(v) || 0) * 10) / 10).toLocaleString('it-IT');
const leggiLista = (json) => { try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

async function provaA(fn, ripiego, cosa = '', guasti = null) {
  try { return await fn(); } catch (e) {
    // UNA LETTURA CHE NON RIESCE VA DETTA. Prima l'eccezione veniva inghiottita e
    // il ripiego era null: con il raccolto a null il riepilogo scriveva "raccolto
    // 0,00 t (0%)" per ogni regione e per ogni raccoglitore, e il modello leggeva
    // zeri legittimi e annunciava che non avevamo raccolto niente.
    if (cosa && guasti) guasti.push(`${cosa}: ${e && e.message ? e.message : e}`);
    return ripiego;
  }
}

/**
 * I terminati senza fine trasporto, di qualunque periodo: non stanno in nessun
 * mese e ogni conto li scarta, percio' si contano a parte per dirli. Prima si
 * contavano solo quelli immessi nell'anno chiesto, e sparivano proprio i casi
 * dubbi - un ordine immesso a fine dicembre e finito a gennaio, un ordine senza
 * nemmeno l'immissione - mentre Dashboard e Report Mensile li contano tutti.
 * Si dividono per anno di immissione, l'unica data che hanno (mai la chiusura a
 * portale); chi non ha nemmeno quella ha anno null. Lo usano il riepilogo qui
 * sotto e gli strumenti di EcoTyna, cosi' i due testi dicono lo stesso numero.
 * Restituisce { esclusi, per_anno: [{ anno, righe }] }, anni dal piu' recente e
 * in fondo chi non ha l'immissione.
 */
export function terminatiSenzaFine(righe) {
  const esclusi = (righe || []).filter(r => eTerminato(r) && !giornoMovimento(r));
  const perAnno = new Map();
  for (const r of esclusi) {
    const a = annoRoma(r.ordine_immesso_il);
    if (!perAnno.has(a)) perAnno.set(a, []);
    perAnno.get(a).push(r);
  }
  const per_anno = [...perAnno.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : b - a))
    .map(([anno, xs]) => ({ anno, righe: xs }));
  return { esclusi, per_anno };
}

/**
 * Riepilogo testuale della situazione della commessa nell'anno di "oggi"
 * (formato AAAA-MM-GG, ora italiana).
 */
export async function situazioneGestionale(base44, oggi) {
  const anno = Number(oggi.slice(0, 4));
  const meseIdx = Number(oggi.slice(5, 7)) - 1;
  const mese = MESI[meseIdx];
  const svc = base44.asServiceRole.entities;

  // Le letture che non riescono: si raccolgono e si dicono in cima, perche' un
  // riepilogo pieno di zeri senza spiegazione si legge come un dato.
  const guasti = [];
  const [raccolto, raccoltoAci, extra, reteSenzaData, aciSenzaData, mensili, annui, commesse, controlli, alert, riepilogoQualifica, giacenze, finoAlRete] = await Promise.all([
    provaA(() => computeRaccoltoData(base44, { anno: [anno], canale: 'rete' }), null, 'il raccolto della rete', guasti),
    provaA(() => computeRaccoltoData(base44, { anno: [anno], canale: 'aci' }), null, 'il raccolto ACI', guasti),
    provaA(() => fetchAll(svc.ExtraRaccolta, { stato: 'terminato' }), [], "l'extra raccolta", guasti),
    // Il raccolto scarta i terminati senza fine trasporto: si chiedono a parte,
    // con un filtro sul campo vuoto, per poterli dire. null se l'archivio non
    // accetta il filtro: allora il conteggio non c'e', che non vuol dire zero.
    provaA(() => fetchAll(svc.PrimariaRete, { trasporto_finito_il: null }), null, 'i terminati di rete senza fine trasporto', guasti),
    provaA(() => fetchAll(svc.PrimariaAci, { trasporto_finito_il: null }), null, 'i terminati ACI senza fine trasporto', guasti),
    provaA(() => fetchAll(svc.TargetMensile, { anno }), [], 'i target mensili', guasti),
    provaA(() => fetchAll(svc.TargetRaccoglitore, { anno }), [], 'i target dei raccoglitori', guasti),
    // Tutti i contratti dell'anno, non i primi restituiti: fra piu' contratti
    // dello stesso anno vale il modificato per ultimo (commessaDellAnno, qui sotto).
    provaA(() => fetchAll(svc.CommessaEcotyre, { anno }), [], 'il contratto Ecotyre', guasti),
    provaA(() => fetchAll(svc.ControlloEvasione, { anno, mese: meseIdx + 1 }), [], "i controlli dell'evasione", guasti),
    // Tutti gli alert aperti, non i primi duecento: il riepilogo diceva "200"
    // mentre lo strumento alert_aperti ne contava 54 o 340, e i due numeri non
    // coincidevano mai per il motivo sbagliato.
    provaA(() => fetchAll(svc.Alert, { stato: 'aperto' }), [], 'gli alert aperti', guasti),
    provaA(() => svc.RiepilogoQualifica.filter({ anno }, '-created_date', 1), [], 'il riepilogo della qualifica', guasti),
    provaA(async () => (await base44.functions.invoke('calcolaGiacenze', { anno })).data, null, 'le giacenze', guasti),
    // Fin dove arrivano i dati della rete: l'ultima fine trasporto di un
    // terminato, con la stessa lettura breve di Target & Status e della dashboard
    // (datiFinoAl di statoArchivi.ts). '' se l'archivio non ha terminati; una
    // lettura non riuscita va fra i guasti, e allora l'atteso non si dice.
    provaA(async () => {
      const [v] = await datiFinoAl(svc, ['PrimariaRete']);
      if (!v || v.lettura_non_riuscita) throw new Error('lettura non riuscita');
      return v.dati_fino_al || '';
    }, null, 'fin dove arrivano i dati della rete', guasti),
  ]);

  // Una lettura non riuscita non e' un archivio vuoto: senza questa distinzione
  // il riepilogo affermava "il contratto non e' stato inserito in Target & Status"
  // quando invece la lettura era andata storta, e il modello lo ripeteva.
  const nonLetto = (cosa) => guasti.some(g => g.startsWith(cosa + ':'));
  const righe = [
    `DATI DEL GESTIONALE al ${oggi} (anno ${anno}, mese in corso ${mese}). Raccolto = formulari terminati, per data di fine trasporto, in tonnellate.`,
    'RETE, ACI ed EXTRA RACCOLTA sono canali indipendenti: non vanno mai sommati e tutti i target (contratto, regioni, raccoglitori, impianti) riguardano solo la RETE. L\'ACI ha solo una previsione indicativa del suo contratto.',
  ];

  // --- Contratto e regioni ---
  // IL CONTRATTO DELL'ANNO E L'ATTESO ALLA DATA, COME LA DASHBOARD E TARGET &
  // STATUS (chiusura dell'audit, 11/10/2026). Qui si prendeva il primo contratto
  // restituito (commesse[0]) e la quota attesa si contava sul giorno di
  // calendario: con due contratti dello stesso anno EcoTyna poteva leggere un
  // target diverso da quello della Dashboard (11.000 t contro 11.550), e con i
  // dati fermi al 7 e oggi l'11 diceva un atteso di quattro giorni di raccolta
  // piu' alto (80,8% contro 79,7%). Ora il contratto e' il modificato per ultimo
  // (commessaDellAnno), target annuo e riparto per regione vengono da li' con lo
  // stesso ripiego dichiarato della Dashboard (targetAnnuoDellAnno,
  // regioniDellAnno), e l'atteso si conta sui giorni coperti dai dati, fino
  // all'ultima fine trasporto della rete e mai oltre oggi (attesoAllaData e
  // giornoDeiDati di attesoContratto.ts). Una regola sola, gli stessi numeri.
  const commessa = commessaDellAnno(commesse, anno);
  const giornoDati = finoAlRete ? giornoDeiDati(finoAlRete, oggi) : '';
  const ilGiorno = (g) => `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}`;
  const perRegione = new Map((raccolto?.by_regione || []).map(r => [String(r.regione).toLowerCase(), r]));
  if (commessa) {
    const contratto = targetAnnuoDellAnno(commessa, anno);
    const { quota } = attesoAllaData(commessa, anno, giornoDati);
    // Senza il giorno dei dati l'atteso non si inventa: si dice perche' manca.
    const quotaTesto = quota === null
      ? (finoAlRete === null
        ? "quota attesa non calcolabile: non si e' potuto leggere fin dove arrivano i dati della rete"
        : 'quota attesa non calcolabile: nessun ritiro RETE terminato con la fine trasporto')
      : `quota attesa a oggi ${p1(quota * 100)}% del target, contata sui giorni coperti dai dati (fino al ${ilGiorno(giornoDati)}, l'ultima fine trasporto di un ritiro RETE terminato) e sul profilo mensile del contratto, come la Dashboard e Target & Status`;
    const targetTesto = contratto.t === null
      ? 'target annuo non inserito nel contratto'
      : `target annuo ${t1(contratto.t)} t${contratto.fonte === 'ripiego' ? " (il contratto non ha il target annuo: e' quello scritto nel gestionale come ripiego, come nella Dashboard)" : ''}`;
    righe.push(`Contratto Ecotyre ${anno}, canale RETE: ${targetTesto}; ${quotaTesto}.${contratto.da_confermare ? " Il contratto e' copiato dall'anno prima e va confermato in Target & Status." : ''}`);
    const regioni = regioniDellAnno(commessa, anno);
    if (regioni.fonte === 'ripiego') righe.push(`  Il contratto non ha il riparto per regione: quello qui sotto e' il riparto del ${anno} scritto nel gestionale come ripiego, come nella Dashboard.`);
    for (const r of regioni.righe) {
      const racc = perRegione.get(String(r.regione).toLowerCase());
      const contrattoRegione = r.target_t;
      const fatto = racc ? racc.totale : null;
      const senzaRaccolto = !raccolto;
      // L'atteso della regione con le sue variazioni soltanto, come la Dashboard e
      // l'Andamento (attesoDellaRegione, variazioni del contratto del 14/10/2026).
      const attesoRegione = attesoDellaRegione(commessa, anno, giornoDati, r.regione).atteso_t;
      righe.push(`- ${r.regione}: contratto ${t1(contrattoRegione)} t, raccolto ${senzaRaccolto ? 'n/d (lettura non riuscita)' : `${t1(fatto)} t (${contrattoRegione ? p1(fatto / contrattoRegione * 100) : '-'}%)`}, atteso a oggi ${attesoRegione === null ? 'n/d' : `${t1(attesoRegione)} t`}, mese in corso ${senzaRaccolto ? 'n/d' : `${t1(racc?.mesi?.[mese])} t`}.`);
    }
  } else {
    // Senza contratto la Dashboard mostra il ripiego scritto nel gestionale, dove
    // c'e' (2025 e 2026): EcoTyna lo dice come tale, non come contratto.
    const ripiego = targetAnnuoDellAnno(null, anno);
    const testoRipiego = ripiego.t === null ? '' : ` La Dashboard mostra come ripiego il target di ${t1(ripiego.t)} t scritto nel gestionale: non e' il contratto.`;
    righe.push((nonLetto('il contratto Ecotyre')
      ? 'Contratto Ecotyre dell\'anno: LETTURA NON RIUSCITA. Non si sa se sia inserito: non dire che manca.'
      : 'Contratto Ecotyre dell\'anno non inserito in Target & Status.') + testoRipiego);
  }
  if (raccolto) {
    righe.push(`Raccolto RETE ${anno}: ${t1(raccolto.totale_raccolto)} t. Per mese: ${MESI.slice(0, meseIdx + 1).map(m => `${m} ${t1((raccolto.by_regione || []).reduce((s, r) => s + (r.mesi?.[m] || 0), 0))}`).join(', ')}.`);
  }
  if (raccoltoAci) {
    const previsione = commessa ? leggiLista(commessa.target_prezzo_regioni_json) : [];
    const perRegAci = new Map((raccoltoAci.by_regione || []).map(r => [String(r.regione).toLowerCase(), r]));
    const dettaglio = previsione.length
      ? previsione.map(p => `${p.regione} ${t1(perRegAci.get(String(p.regione).toLowerCase())?.totale)} su ${t1(p.target_t)} t a ${p1(p.prezzo)} euro/t`).join('; ')
      : (raccoltoAci.by_regione || []).map(r => `${r.regione} ${t1(r.totale)} t`).join('; ');
    righe.push(`Canale ACI ${anno} (indipendente, previsione indicativa del contratto ACI Ecotyre): raccolto ${t1(raccoltoAci.totale_raccolto)} t. Per regione, raccolto su previsione: ${dettaglio || 'nessun dato'}.`);
  }
  if (extra.length) {
    const delAnno = extra.map(r => ({ r, g: giornoRoma(r.trasporto_finito_il) })).filter(x => x.g && Number(x.g.slice(0, 4)) === anno);
    const peso = (xs) => xs.reduce((s, x) => s + (Number(x.r.peso_effettivo) || 0), 0) / 1000;
    // La raccolta dal produttore e i trasferimenti successivi stanno nello stesso
    // archivio: sommandoli, lo stesso materiale si conta due volte.
    const primarie = delAnno.filter(x => String(x.r.tipo_movimento || 'primaria').toLowerCase().trim() !== 'secondaria');
    const trasferimenti = delAnno.filter(x => String(x.r.tipo_movimento || '').toLowerCase().trim() === 'secondaria');
    righe.push(`Canale EXTRA RACCOLTA ${anno} (indipendente, senza target): terminati ${primarie.length} interventi di raccolta, ${t1(peso(primarie))} t; nel mese in corso ${t1(peso(primarie.filter(x => Number(x.g.slice(5, 7)) - 1 === meseIdx)))} t.`);
    if (trasferimenti.length) {
      righe.push(`  di cui gia' raccolti e poi trasferiti da uno stoccaggio a un impianto: ${trasferimenti.length} viaggi, ${t1(peso(trasferimenti))} t. Non si sommano alla raccolta: e' lo stesso materiale che si sposta.`);
    }
  }

  // I terminati senza fine trasporto non stanno in nessun mese: il raccolto qui
  // sopra li esclude, e va detto, altrimenti sembra completo. Si contano tutti,
  // di qualunque periodo, divisi per anno di immissione (terminatiSenzaFine).
  const esclusi = [
    ['RETE', reteSenzaData && terminatiSenzaFine(reteSenzaData)],
    ['ACI', aciSenzaData && terminatiSenzaFine(aciSenzaData)],
    ['EXTRA RACCOLTA', terminatiSenzaFine(extra.filter(r => String(r.tipo_movimento || 'primaria').toLowerCase().trim() !== 'secondaria'))],
  ].filter(([, x]) => x && x.esclusi.length);
  if (esclusi.length) {
    const nf = (xs) => { const n = contaFormulari(xs); return `${n} ${n === 1 ? 'formulario' : 'formulari'}`; };
    const perAnno = (x) => x.per_anno.map(g => `${g.anno === null ? 'senza data di immissione' : `immessi nel ${g.anno}`} ${contaFormulari(g.righe)}`).join(', ');
    righe.push(`Terminati senza data di fine trasporto, di qualunque periodo, esclusi dal raccolto qui sopra perche' non si sa in che mese cadono, un canale per volta: ${esclusi.map(([c, x]) => `${c} ${nf(x.esclusi)}, ${t1(x.esclusi.reduce((s, r) => s + (Number(r.peso_effettivo) || 0), 0) / 1000)} t (${perAnno(x)})`).join('; ')}. La data e' obbligatoria e va inserita: si correggono nel file del portale e si ricaricano (l'extra raccolta nella sua scheda).`);
  }

  // Le date obbligatorie dei formulari - immissione, inizio e fine trasporto,
  // regola dell'utente del 22/09/2026 - si dicono tutte, per modulo e canale e di
  // qualunque anno, non solo la fine trasporto. Si leggono dagli alert del motore,
  // che le rivaluta a ogni caricamento su tutti i terminati: rileggere qui ogni
  // archivio per intero costerebbe quanto un ricalcolo. Anche l'extra raccolta,
  // dal 22/09/2026: ogni scheda salvata avvia il motore.
  const date = alert.filter(a => String(a.regola_id || '').startsWith('date_obbligatorie'));
  if (date.length) {
    const canale = { rete: 'RETE', ACI: 'ACI', extra: 'EXTRA RACCOLTA' };
    const modulo = { primarie_rete: 'primarie', primarie_aci: 'primarie', secondarie: 'secondarie', terziarie: 'terziarie', extra_raccolta: 'raccolte e trasferimenti' };
    righe.push(`Ordini terminati con date obbligatorie (immissione, inizio e fine trasporto) mancanti o incoerenti, di qualunque anno, per modulo e canale e mai sommati: ${date.map(a => {
      const dove = `${a.canale ? `${canale[a.canale] || a.canale} ` : ''}${modulo[a.modulo] || a.modulo}`;
      const n = Number(a.quanti);
      return Number.isFinite(n) && n > 0
        ? `${dove} ${n} ${n === 1 ? 'ordine' : 'ordini'}${Number(a.senza_fine) ? ` (di cui ${a.senza_fine} senza fine trasporto)` : ''}`
        : `${dove}: ${a.titolo}`;
    }).join('; ')}. Sono obbligatorie: vanno inserite o corrette. L'elenco degli ordini e' negli alert (strumento alert_aperti).`);
  }

  // --- Raccoglitori: target contro raccolto ---
  const annuiAgg = aggregaTargetAnnui(annui);
  const mensiliAgg = aggregaTargetMensili(mensili);
  const nomi = new Map();
  for (const r of [...annuiAgg, ...mensiliAgg]) {
    const k = normalizzaRagioneSociale(r.raccoglitore);
    if (k && !nomi.has(k)) nomi.set(k, r.raccoglitore);
  }
  // Il target del mese si somma sui target mensili che valgono: del target
  // scritto due volte (stesso raccoglitore, regione, impianto, ruolo e mese)
  // l'ultimo modificato, come Andamento, avvisi e dashboard
  // (targetMensiliValidi). Da aggregaTargetMensili passava solo l'elenco dei
  // nomi, e con 80 t e poi 50 t EcoTyna diceva 130 dove gli altri dicevano 50
  // (revisione del 13/10/2026).
  const mensiliValidi = targetMensiliValidi(mensili);
  if (nomi.size) {
    righe.push(`Raccoglitori, solo RETE (target annuo | raccolto da inizio anno | target ${mese} | raccolto ${mese}):`);
    for (const [k, nome] of [...nomi.entries()].sort((a, b) => a[1].localeCompare(b[1], 'it'))) {
      const annuo = annuiAgg.filter(r => normalizzaRagioneSociale(r.raccoglitore) === k).reduce((s, r) => s + r.target_tonnellate, 0);
      const delMese = mensiliValidi.filter(r => normalizzaRagioneSociale(r.raccoglitore) === k && r.mese === mese);
      const targetMese = delMese.filter(r => !r.non_raccoglie).reduce((s, r) => s + (Number(r.target) || 0), 0);
      const nonRaccoglie = delMese.length > 0 && delMese.every(r => r.non_raccoglie);
      const tuttiNomi = [...nomi.values()];
      const suoi = (raccolto?.by_raccoglitore || []).filter(r => stessoRaccoglitore(nome, r.raccoglitore) && targetDelPortale(tuttiNomi, r.raccoglitore) === nome);
      const ytd = suoi.reduce((s, r) => s + r.totale, 0);
      const meseFatto = suoi.reduce((s, r) => s + (r.mesi?.[mese] || 0), 0);
      const regioni = [...new Set(annui.filter(r => normalizzaRagioneSociale(r.raccoglitore) === k).map(r => r.regione).filter(Boolean))];
      righe.push(`- ${nome}${regioni.length ? ' (' + regioni.join(', ') + ')' : ''}: ${t1(annuo)} | ${raccolto ? t1(ytd) : 'n/d'} | ${nonRaccoglie ? 'non raccoglie' : t1(targetMese)} | ${raccolto ? t1(meseFatto) : 'n/d'}`);
    }
  } else {
    righe.push(nonLetto('i target dei raccoglitori')
      ? 'Target dei raccoglitori: LETTURA NON RIUSCITA. Non si sa se siano inseriti: non dire che mancano.'
      : 'Target dei raccoglitori non inseriti in Target & Status per l\'anno.');
  }

  // --- Evasione degli assegnati del mese ---
  if (controlli.length) {
    const ultimi = new Map();
    for (const c of controlli) {
      const u = ultimi.get(c.raccoglitore_chiave);
      if (!u || String(c.eseguito_il) > String(u.eseguito_il)) ultimi.set(c.raccoglitore_chiave, c);
    }
    righe.push(`Evasione delle liste di ${mese} (richieste | evase | aperte | arretrate aperte | prioritarie aperte | trascurate | alert alti):`);
    for (const c of ultimi.values()) {
      righe.push(`- ${c.raccoglitore_nome}: ${c.richieste ?? '-'} | ${c.evase ?? '-'} | ${c.aperte ?? '-'} | ${c.arretrate_aperte ?? 0} | ${c.prioritarie_aperte ?? 0} | ${c.trascurate ?? 0} | ${c.alert_alti ?? 0} (dati al ${String(c.dati_al || c.eseguito_il || '').slice(0, 10)})`);
    }
  }

  // --- Giacenze ---
  // Una colonna per canale, come le calcola il modulo Giacenze: la rete (impianti:
  // fotografia del portale aggiornata ai caricamenti; stoccaggi: rilevazione delle
  // classi 1-4 piu' i movimenti finiti dopo), l'ACI degli stoccaggi (classe 9) e
  // l'extra raccolta in piazzale, che a portale non c'e'. Con una colonna sola lo
  // stoccaggio di Irigom mostrava la classe 9 dentro la giacenza e poi di nuovo
  // "ACI a parte". Il trattino vuol dire non calcolata o non pertinente, non
  // zero, e va scritto nel testo: il modello non legge i commenti del codice, e
  // un "-" lo puo' prendere per zero. Un impianto senza il file degli ordini non
  // dichiarati ha una giacenza a zero che non e' un dato: anche li' il trattino.
  // Dal 03/10/2026 anche gli impianti hanno la giacenza ACI e quella di extra
  // raccolta (apertura + arrivato - dichiarato, come nel modulo Dichiarazioni):
  // l'intestazione che le diceva «non pertinenti» accanto a un valore stampato
  // era superata, e l'ha tolta la chiusura dell'audit (11/10/2026).
  if (giacenze && Array.isArray(giacenze.righe) && giacenze.righe.length) {
    const tc = (v) => (v === null || v === undefined ? '-' : t1(v));
    const stoc = (g) => g.tipo_destinazione === 'stoc';
    const senzaFile = (g) => !stoc(g) && !(g.fotografia && g.fotografia.del);
    righe.push('Impianti e stoccaggi, un canale per colonna e mai sommati (giacenza RETE | giacenza ACI | giacenza EXTRA RACCOLTA, che in uno stoccaggio e\' quella in piazzale e in un impianto quella arrivata e non ancora dichiarata | target RETE | primarie RETE nell\'anno | % del target RETE, cioe\' primarie sul target, quanto del target di raccolta e\' stato raccolto | residuo RETE, cioe\' target meno TUTTO quello che e\' arrivato, primarie piu\' secondarie in ingresso, perche\' il target di un impianto comprende gia\' le secondarie dai piazzali: percentuale e residuo rispondono a due domande diverse e non sono l\'uno il complemento dell\'altra | conferito ACI nell\'anno | conferito extra raccolta nell\'anno). In un impianto la giacenza ACI e quella di extra raccolta sono apertura + arrivato - dichiarato e caricato, come nel modulo Dichiarazioni. Il trattino vuol dire non calcolata o non pertinente, MAI zero: la giacenza RETE e ACI di uno stoccaggio senza rilevazione del portale, la giacenza RETE di un impianto senza il file degli ordini non dichiarati o di un impianto che per accordo non ci dichiara la rete (non calcolata); l\'extra raccolta di uno stoccaggio che nell\'anno non ne ha movimentata (non pertinente).');
    for (const g of giacenze.righe.slice(0, 25)) {
      righe.push(`- ${g.sito} (${stoc(g) ? 'stoccaggio' : 'impianto'}): ${senzaFile(g) ? '-' : tc(g.giacenza_rete_t)} | ${tc(g.giacenza_aci_t)} | ${tc(g.giacenza_extra_t)} | ${g.target_totale_t ? t1(g.target_totale_t) : '-'} | ${t1(g.conferito_primarie_t)} | ${g.percentuale_target !== null && g.percentuale_target !== undefined ? p1(g.percentuale_target) + '%' : '-'} | ${g.residuo_t !== null && g.residuo_t !== undefined ? t1(g.residuo_t) : '-'} | ${t1(g.conferito_aci_t)} | ${t1(g.conferito_extra_t)}`);
    }
    const tot = giacenze.totali || {};
    // Chi non ha il dato resta fuori dai totali: lo si dice, canale per canale,
    // altrimenti il totale sembra completo. Uno stoccaggio senza rilevazione
    // manca sia alla rete sia all'ACI.
    const senzaRilevazione = giacenze.righe.filter(g => stoc(g) && (g.giacenza_rete_t === null || g.giacenza_rete_t === undefined)).map(g => g.sito);
    const impiantiSenzaFile = giacenze.righe.filter(senzaFile).map(g => g.sito);
    const fuoriRete = [
      ...(impiantiSenzaFile.length ? [`impianti senza il file degli ordini non dichiarati: ${impiantiSenzaFile.join(', ')}`] : []),
      ...(senzaRilevazione.length ? [`stoccaggi senza rilevazione: ${senzaRilevazione.join(', ')}`] : []),
    ];
    const fuoriAci = senzaRilevazione.length ? ` (esclusi gli stoccaggi senza rilevazione: ${senzaRilevazione.join(', ')})` : '';
    // ACI ED EXTRA RACCOLTA, IMPIANTI E STOCCAGGI DIVISI (chiusura dell'audit,
    // 11/10/2026). Qui si scriveva «ACI negli stoccaggi» col totale del modulo,
    // che dal 03/10 comprende anche gli impianti: un impianto con 7 t ACI non
    // dichiarate e un piazzale con 3 t di classe 9 davano «ACI negli stoccaggi
    // 10 t», mentre lo strumento giacenze diceva 3. Si rifanno sulle righe, come
    // fa lo strumento, cosi' i due testi dicono gli stessi numeri.
    const sommaT = (xs, campo) => Math.round(xs.reduce((s, g) => s + (Number(g[campo]) || 0), 0) * 1000) / 1000;
    const impR = giacenze.righe.filter(g => !stoc(g));
    const stocR = giacenze.righe.filter(stoc);
    righe.push(`Giacenze per canale, tre totali distinti: RETE ${t1(tot.giacenza_portale_t)} t${fuoriRete.length ? ` (esclusi ${fuoriRete.join('; ')})` : ''}; ACI: impianti ${t1(sommaT(impR, 'giacenza_aci_t'))} t, stoccaggi ${t1(sommaT(stocR, 'giacenza_aci_t'))} t${fuoriAci}; EXTRA RACCOLTA: impianti ${t1(sommaT(impR, 'giacenza_extra_t'))} t (arrivata e non ancora dichiarata), stoccaggi ${t1(sommaT(stocR, 'giacenza_extra_t'))} t (in piazzale). Impianti e stoccaggi dello stesso canale sono due numeri: dilli tutti e due.`);
    // Il confronto col target lo fa calcolaGiacenze sulla sola giacenza di rete.
    const sopra = (giacenze.anomalie || []).filter(a => a.tipo === 'giacenza_sopra_target');
    if (sopra.length) righe.push(`Siti con giacenza RETE sopra il target: ${sopra.map(a => a.sito).join(', ')}.`);
    // I target si scrivono solo in Target & Status (27/09/2026): uno ancora
    // scritto nel vecchio campo di Giacenze vale finche' non lo si porta li'.
    const daPortare = [...new Set((giacenze.anomalie || []).filter(a => a.tipo === 'target_da_portare').map(a => a.sito))];
    if (daPortare.length) righe.push(`Target ancora scritti in Giacenze, da portare in Target & Status (scheda Impianti e stoccaggi); intanto valgono quelli: ${daPortare.join(', ')}.`);
  }

  // --- Alert e qualifica ---
  if (alert.length) {
    const critici = alert.filter(a => a.severita === 'critico');
    righe.push(`Alert aperti: ${alert.length}, di cui critici ${critici.length}. Principali: ${[...critici, ...alert.filter(a => a.severita !== 'critico')].slice(0, 8).map(a => a.titolo).join('; ')}.`);
  }
  const rq = riepilogoQualifica[0];
  if (rq) {
    righe.push(`Qualifica fornitori ${anno}: ${rq.alert_aperti ?? 0} alert su ${rq.soggetti_con_alert ?? 0} soggetti; documenti scaduti ${rq.scaduti ?? 0}, non conformi ${rq.non_conformi ?? 0}, mancanti ${rq.mancanti ?? 0}, in scadenza ${rq.in_scadenza ?? 0}, da verificare ${rq.da_verificare ?? 0}.`);
  }

  // I guasti in CIMA, non in fondo: se una lettura non e' riuscita, tutto quello
  // che segue va letto sapendolo, e un avviso in coda arriva troppo tardi.
  if (guasti.length) {
    righe.unshift(`ATTENZIONE, LETTURE NON RIUSCITE: ${guasti.join('; ')}. I numeri che dipendono da queste letture NON ci sono: dove sotto trovi "n/d" o uno zero non e' un dato, e' un dato mancante. Dillo nella risposta e non ricavare niente da quei numeri.`, '');
  }
  return righe.join('\n');
}
