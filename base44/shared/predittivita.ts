// Il motore della predittivita' delle secondarie: un conto solo, da cui escono
// la Dashboard, il programma della settimana, la proiezione, il suggerimento
// del mercoledi' e le risposte degli assistenti (26/09/2026).
//
// Prima c'erano tre conti per la stessa domanda - "quanti viaggi servono?" -
// e davano tre risposte: la Dashboard ripartiva il plafond degli stoccaggi, la
// Proiezione a fine anno divideva per mesi interi, il suggerimento del lunedi'
// convertiva in viaggi di secondaria anche le primarie. Su Irigom si arrivava a
// 97 viaggi da una parte e 54 dall'altra.
//
// Il ragionamento, un anno alla volta, sempre dall'ancora delle giacenze al
// 31/12 dell'anno prima e sulla sola rete, per fine trasporto:
//
// 1. Per ogni impianto seguito: target, gia' arrivato (giaArrivatoDiRete, lo
//    stesso numero di sempre) e quanto manca.
// 2. Quanto arrivera' ancora in primaria fino alla fine della programmazione,
//    raccoglitore per raccoglitore, in due modi affiancati (utente,
//    26/09/2026): sul TARGET residuo del raccoglitore e sul RITMO reale delle
//    ultime settimane. Il PRUDENTE prende, flusso per flusso, il piu' basso dei
//    due (il ritmo, per un flusso che un target non ce l'ha): e' quello su cui si
//    programma, cosi' un raccoglitore che rallenta non lascia l'impianto sotto
//    target.
// 3. Quello che manca, tolta la primaria attesa, deve arrivare in secondaria.
// 4. Ogni stoccaggio ha a disposizione la giacenza di adesso (ancora +
//    movimenti) piu' quello che ci entrera', nei limiti del suo plafond, e lo
//    divide fra gli impianti che alimenta secondo la priorita': ogni settimana li
//    serve tutti, e al primo va il numero di viaggi che gli fa raggiungere il
//    target entro la fine della programmazione (Nappi Sud: prima Tecnogum, poi
//    Irigom). Se non basta, si dice a chi manca e quanto.
// 5. Il programma della prossima settimana: i viaggi, stoccaggio per impianto.
// 6. Il fatto, settimana per settimana: un viaggio e' un camion in un giorno
//    sullo stesso percorso, anche quando porta piu' formulari divisi per classe.
//
// Tutto e' in chili interi; i viaggi valgono regole.kg_per_viaggio (13 t nel
// 2026). Le date sono giorni italiani 'AAAA-MM-GG' e l'aritmetica e' in UTC,
// che non ha ora legale.
import { eTerminato, canaleMovimento } from "./movimenti.ts";
import { giornoRoma } from "./giornoItaliano.ts";
import { giaArrivatoDiRete, residuoDiRete } from "./proiezioneSecondarie.ts";

export const SCENARI = ['target', 'ritmo', 'prudente'];

// --- giorni ---
const aUtc = (g) => Date.UTC(+g.slice(0, 4), +g.slice(5, 7) - 1, +g.slice(8, 10));
export const piuGiorni = (g, n) => new Date(aUtc(g) + n * 86400000).toISOString().slice(0, 10);
/** Quanti giorni da a a b (b - a). */
export const giorniFra = (a, b) => Math.round((aUtc(b) - aUtc(a)) / 86400000);
/** Il lunedi' della settimana di un giorno. */
export const lunediDi = (g) => piuGiorni(g, -((new Date(aUtc(g)).getUTCDay() + 6) % 7));

const peso = (r) => Number(r && r.peso_effettivo) || 0;
const nelPiazzale = (r) => String((r && r.tipo_destinazione) || '').toLowerCase().trim() === 'stoc';
const giornoFine = (r) => giornoRoma(r && r.trasporto_finito_il);
const kgInt = (v) => Math.round(Number(v) || 0);
const perScenario = (f) => Object.fromEntries(SCENARI.map(s => [s, f(s)]));

/** Un viaggio fatto: un camion in un giorno, sullo stesso percorso. Senza targa vale l'ordine. */
export function chiaveViaggio(r, chiave) {
  const g = giornoFine(r);
  const mezzo = String((r && r.automezzo) || '').replace(/\s+/g, '').toUpperCase();
  return mezzo
    ? `${g}|${mezzo}|${chiave(r.stoccaggio)}|${chiave(r.destinazione)}`
    : `${g}|ORDINE:${String((r && (r.id_ordine || r.numero_fir)) || '')}`;
}

/**
 * La giacenza di rete di un piazzale adesso: la lettura da cui parte (l'ancora
 * dell'anno, puntiDiPartenza in giacenzaStoccaggi.ts) piu' i movimenti di rete
 * finiti dopo. La stessa regola del modulo Giacenze: entrano le primarie e le
 * secondarie scaricate nel piazzale, escono tutte le secondarie che ne partono.
 */
export function giacenzaPiazzale({ chiaveStoccaggio, partenzaKg, partenzaDel, primarie, secondarie, chiave }) {
  if (partenzaKg === null || partenzaKg === undefined || !partenzaDel) return null;
  let kg = Number(partenzaKg) || 0;
  for (const r of primarie || []) {
    const g = giornoFine(r);
    if (!g || g <= partenzaDel || !eTerminato(r) || canaleMovimento(r, 'PrimariaRete') !== 'RETE') continue;
    if (nelPiazzale(r) && chiave(r.destinazione) === chiaveStoccaggio) kg += peso(r);
  }
  for (const r of secondarie || []) {
    const g = giornoFine(r);
    if (!g || g <= partenzaDel || !eTerminato(r) || canaleMovimento(r, 'Secondaria') !== 'RETE') continue;
    if (chiave(r.stoccaggio) === chiaveStoccaggio) kg -= peso(r);
    else if (nelPiazzale(r) && chiave(r.destinazione) === chiaveStoccaggio) kg += peso(r);
  }
  return kgInt(kg);
}

/**
 * La predittivita' dell'anno.
 *
 * @param {object} d
 *   anno, oggi ('AAAA-MM-GG'), chiave (normalizzaRagioneSociale)
 *   regole        regolePredittivita(anno)
 *   fine          la fine della programmazione ('AAAA-MM-GG'), fineProgrammazione(anno).data
 *   impianti      [{ chiave, nome, target_kg, fine? }]  gli impianti seguiti quest'anno
 *   raccoglitori  [{ chiave, nome, sito, target_kg }]   i target di raccolta dell'anno, per sito (impianto o stoccaggio)
 *   stoccaggi     [{ chiave, nome, plafond_kg, giacenza_kg, giacenza_da, destinazioni: [{ impianto, priorita }] }]
 *   primarie, secondarie  i record: servono i terminati di rete dell'anno e delle ultime settimane
 */
export function calcolaPredittivita(d) {
  const { anno, oggi, chiave, regole } = d;
  const annoN = Number(anno);
  const kgv = Number(regole.kg_per_viaggio) || 13000;
  const primarie = (d.primarie || []).filter(r => eTerminato(r) && canaleMovimento(r, 'PrimariaRete') === 'RETE' && giornoFine(r));
  const secondarie = (d.secondarie || []).filter(r => eTerminato(r) && canaleMovimento(r, 'Secondaria') === 'RETE' && giornoFine(r));
  const nellAnno = (g) => g.slice(0, 4) === String(annoN);
  const avvisi = [];

  // Fin dove arrivano i dati: l'ultima fine trasporto caricata, non oggi. Il
  // lunedi' si registrano i formulari della settimana prima: fino ad allora i
  // numeri della settimana passata possono crescere, e si dice.
  let datiAl = '';
  for (const r of [...primarie, ...secondarie]) {
    const g = giornoFine(r);
    if (g <= oggi && g > datiAl) datiAl = g;
  }
  if (!datiAl || datiAl < `${annoN}-01-01`) datiAl = piuGiorni(`${annoN}-01-01`, -1);
  const lunediCorrente = lunediDi(oggi);
  const domenicaScorsa = piuGiorni(lunediCorrente, -1);
  const settimanaScorsaCompleta = datiAl >= domenicaScorsa;
  if (!settimanaScorsaCompleta) {
    avvisi.push({ tipo: 'dati_incompleti', testo: `I formulari caricati arrivano al ${it(datiAl)}: quelli della settimana scorsa (fino a domenica ${it(domenicaScorsa)}) potrebbero non essere ancora tutti dentro. I numeri possono crescere col prossimo caricamento.` });
  }

  // Il ritmo reale: le ultime settimane chiuse dai dati, anche a cavallo d'anno.
  const settRitmo = Number(regole.settimane_ritmo) || 12;
  const finestra = { dal: piuGiorni(datiAl, -7 * settRitmo + 1), al: datiAl, settimane: settRitmo };
  const inFinestra = (g) => g >= finestra.dal && g <= finestra.al;

  // L'orizzonte: dal giorno dopo i dati alla fine della programmazione. La
  // parte del target annuo di un raccoglitore che cade in questo tratto e' in
  // proporzione ai giorni che restano fino al 31/12: le primarie di fine
  // dicembre arrivano dopo la fine della programmazione.
  const fineDefault = d.fine || `${annoN}-12-31`;
  const orizzonte = (fine) => {
    const giorni = Math.max(0, giorniFra(datiAl, fine));
    return { dal: piuGiorni(datiAl, 1), al: fine, giorni, settimane: giorni / 7 };
  };
  const quotaDelTarget = (fine) => {
    const aFine = Math.max(0, giorniFra(datiAl, fine));
    const aDicembre = Math.max(0, giorniFra(datiAl, `${annoN}-12-31`));
    return aDicembre > 0 ? Math.min(1, aFine / aDicembre) : 0;
  };

  // --- gli impianti seguiti: un impianto senza target quest'anno non lo e' ---
  const impianti = [];
  for (const i of d.impianti || []) {
    if (!(Number(i.target_kg) > 0)) {
      avvisi.push({ tipo: 'impianto_senza_target', impianto: i.nome, testo: `${i.nome} non ha un target di rete per il ${annoN} in Target & Status: vale come non contrattualizzato quest'anno e resta fuori dalla predittivita'.` });
      continue;
    }
    impianti.push({ ...i, fine: String(i.fine || '').slice(0, 10) || fineDefault });
  }
  const chiaviImpianti = new Set(impianti.map(i => i.chiave));
  const arrivati = giaArrivatoDiRete(impianti.map(i => i.chiave), primarie, secondarie, annoN, chiave);

  // --- i flussi di primaria: raccoglitore -> sito ---
  // Al sito di un impianto conta tutto (anche il suo piazzale, come nel gia'
  // arrivato); al piazzale di uno stoccaggio conta cio' che vi e' scaricato.
  const chiaviStoccaggi = new Set((d.stoccaggi || []).map(s => s.chiave));
  const flussi = new Map(); // `${R}|${sito}|${livello}` -> flusso
  const flusso = (R, nome, sito, livello) => {
    const k = `${R}|${sito}|${livello}`;
    if (!flussi.has(k)) flussi.set(k, { raccoglitore: R, nome, sito, livello, consuntivo_kg: 0, finestra_kg: 0, target_kg: null });
    return flussi.get(k);
  };
  for (const r of primarie) {
    const g = giornoFine(r);
    const R = chiave(r.trasportatore);
    const X = chiave(r.destinazione);
    if (!R || !X) continue;
    const livelli = [];
    if (chiaviImpianti.has(X)) livelli.push('impianto');
    if (chiaviStoccaggi.has(X) && (nelPiazzale(r) || !chiaviImpianti.has(X))) livelli.push('piazzale');
    for (const liv of livelli) {
      const f = flusso(R, r.trasportatore, X, liv);
      if (nellAnno(g)) f.consuntivo_kg += peso(r);
      if (inFinestra(g)) f.finestra_kg += peso(r);
    }
  }
  // I target dell'anno: un target scritto per un sito e' di quel sito.
  for (const t of d.raccoglitori || []) {
    if (!t.chiave || !t.sito || !(Number(t.target_kg) > 0)) continue;
    const livello = chiaviImpianti.has(t.sito) ? 'impianto' : chiaviStoccaggi.has(t.sito) ? 'piazzale' : null;
    if (!livello) continue;
    const f = flusso(t.chiave, t.nome, t.sito, livello);
    f.target_kg = (f.target_kg || 0) + Number(t.target_kg);
    f.nome = t.nome || f.nome;
  }
  const attesaFlusso = (f, fine) => {
    const o = orizzonte(fine);
    const ritmo = f.finestra_kg / finestra.settimane;
    const target = f.target_kg === null ? 0 : Math.max(0, f.target_kg - f.consuntivo_kg) * quotaDelTarget(fine);
    const r = ritmo * o.settimane;
    // Il prudente: il piu' basso dei due quando il flusso ha un target; senza
    // target (Emmesse su Irigom nel 2026, dopo l'incendio di Gatim) il materiale
    // arriva lo stesso, e vale il ritmo reale.
    const prudente = f.target_kg === null ? r : Math.min(target, r);
    return { target: kgInt(target), ritmo: kgInt(r), prudente: kgInt(prudente), ritmo_settimanale_kg: kgInt(ritmo), con_target: f.target_kg !== null };
  };

  // --- gli stoccaggi: disponibile fino alla fine ---
  const stoccaggi = [];
  for (const s of d.stoccaggi || []) {
    const destinazioni = new Map(); // impianto -> priorita
    for (const x of s.destinazioni || []) {
      if (chiaviImpianti.has(x.impianto) && x.impianto !== s.chiave) destinazioni.set(x.impianto, Number(x.priorita) || null);
    }
    // chi ne ha ricevuto secondarie quest'anno lo alimenta, anche se nessuno l'ha scritto
    for (const r of secondarie) {
      if (chiave(r.stoccaggio) !== s.chiave || !nellAnno(giornoFine(r))) continue;
      const I = chiave(r.destinazione);
      if (chiaviImpianti.has(I) && I !== s.chiave && !destinazioni.has(I)) destinazioni.set(I, null);
    }
    if (!destinazioni.size) continue;
    // la priorita': quella scritta, poi quella delle regole dell'anno, poi pari
    const ordineRegole = (regole.priorita && regole.priorita[s.chiave]) || [];
    const dest = [...destinazioni.entries()].map(([I, p]) => {
      const iRegole = ordineRegole.indexOf(I);
      return { impianto: I, priorita: p || (iRegole >= 0 ? iRegole + 1 : 99) };
    }).sort((a, b) => a.priorita - b.priorita);
    const fineS = impianti.filter(i => destinazioni.has(i.chiave)).map(i => i.fine).reduce((a, b) => (b > a ? b : a), fineDefault);
    const eImpianto = chiaviImpianti.has(s.chiave);
    const entrateFlussi = [...flussi.values()].filter(f => f.sito === s.chiave && f.livello === 'piazzale').map(f => ({ ...f, attesa: attesaFlusso(f, fineS) }));
    const entrate = perScenario(sc => entrateFlussi.reduce((t, f) => t + f.attesa[sc], 0));
    // Un impianto che e' anche piazzale (T-Cycle) non ha target di raccolta
    // scritti sul piazzale: le sue entrate si stimano sul ritmo.
    if (eImpianto) { entrate.target = entrate.ritmo; entrate.prudente = entrate.ritmo; }
    const partitiVersoAltri = secondarie
      .filter(r => chiave(r.stoccaggio) === s.chiave && chiave(r.destinazione) !== s.chiave && nellAnno(giornoFine(r)))
      .reduce((t, r) => t + peso(r), 0);
    const plafond = Number(s.plafond_kg) > 0 ? Number(s.plafond_kg) : null;
    const residuoPlafond = plafond === null ? null : kgInt(plafond - partitiVersoAltri);
    const giacenza = s.giacenza_kg === null || s.giacenza_kg === undefined ? null : kgInt(s.giacenza_kg);
    if (giacenza === null) avvisi.push({ tipo: 'stoccaggio_senza_giacenza', stoccaggio: s.nome, testo: `${s.nome} non ha una lettura del piazzale da cui partire: il materiale disponibile si stima sulle sole entrate attese.` });
    const disponibile = perScenario(sc => {
      let v = Math.max(0, giacenza || 0) + entrate[sc];
      if (residuoPlafond !== null) v = Math.min(v, Math.max(0, residuoPlafond));
      return kgInt(v);
    });
    stoccaggi.push({
      chiave: s.chiave, nome: s.nome, e_impianto: eImpianto, fine: fineS,
      giacenza_kg: giacenza, giacenza_da: s.giacenza_da || null,
      entrate_attese: entrate, entrate_flussi: entrateFlussi.map(f => ({ raccoglitore: f.nome, target_kg: f.target_kg, consuntivo_kg: kgInt(f.consuntivo_kg), ritmo_settimanale_kg: f.attesa.ritmo_settimanale_kg, attesa: { target: f.attesa.target, ritmo: f.attesa.ritmo, prudente: f.attesa.prudente } })),
      plafond_kg: plafond, partiti_verso_altri_kg: kgInt(partitiVersoAltri), residuo_plafond_kg: residuoPlafond,
      disponibile, destinazioni: dest,
    });
  }

  // --- gli impianti: quanto manca, quanto arriva in primaria, quanto serve in secondaria ---
  const perImpianto = new Map();
  for (const i of impianti) {
    const arr = arrivati.get(i.chiave);
    const residuo = residuoDiRete(i.target_kg, arr);
    const fl = [...flussi.values()].filter(f => f.sito === i.chiave && f.livello === 'impianto').map(f => ({ ...f, attesa: attesaFlusso(f, i.fine) }));
    const attesa = perScenario(sc => fl.reduce((t, f) => t + f.attesa[sc], 0));
    perImpianto.set(i.chiave, {
      chiave: i.chiave, nome: i.nome, target_kg: kgInt(i.target_kg), fine: i.fine, orizzonte: orizzonte(i.fine),
      arrivato: arr, gia_arrivato_kg: arr ? arr.totale_kg : 0, residuo_kg: residuo,
      primarie: fl.map(f => ({ raccoglitore: f.nome, target_kg: f.target_kg, consuntivo_kg: kgInt(f.consuntivo_kg), ritmo_settimanale_kg: f.attesa.ritmo_settimanale_kg, attesa: { target: f.attesa.target, ritmo: f.attesa.ritmo, prudente: f.attesa.prudente } }))
        .sort((a, b) => b.consuntivo_kg - a.consuntivo_kg),
      primaria_attesa: attesa,
      fabbisogno_secondarie: perScenario(sc => Math.max(0, residuo - attesa[sc])),
      da_stoccaggi: [],
    });
  }

  // --- la ripartizione degli stoccaggi, scenario per scenario ---
  // Prima gli stoccaggi che alimentano meno impianti (un piazzale che serve un
  // impianto solo non ha scelte), poi gli altri. Dentro uno stoccaggio, per
  // gruppi di priorita': il primo gruppo prende quello che gli serve, gli altri
  // si dividono il resto in proporzione a quello che manca a ciascuno.
  const ordineStoccaggi = [...stoccaggi].sort((a, b) => a.destinazioni.length - b.destinazioni.length || a.nome.localeCompare(b.nome));
  for (const sc of SCENARI) {
    const manca = new Map([...perImpianto.values()].map(x => [x.chiave, x.fabbisogno_secondarie[sc]]));
    for (const s of ordineStoccaggi) {
      let resta = s.disponibile[sc];
      const gruppi = new Map();
      for (const x of s.destinazioni) {
        if (!gruppi.has(x.priorita)) gruppi.set(x.priorita, []);
        gruppi.get(x.priorita).push(x.impianto);
      }
      for (const [prio, gruppo] of [...gruppi.entries()].sort((a, b) => a[0] - b[0])) {
        const bisogno = gruppo.reduce((t, I) => t + (manca.get(I) || 0), 0);
        for (const I of gruppo) {
          const m = manca.get(I) || 0;
          const dato = bisogno <= resta ? m : (bisogno > 0 ? resta * m / bisogno : 0);
          const kg = kgInt(dato);
          manca.set(I, Math.max(0, m - kg));
          const imp = perImpianto.get(I);
          let rotta = imp.da_stoccaggi.find(x => x.stoccaggio === s.chiave);
          if (!rotta) { rotta = { stoccaggio: s.chiave, nome: s.nome, priorita: prio, kg: {}, viaggi_totali: {}, viaggi_settimana: {} }; imp.da_stoccaggi.push(rotta); }
          rotta.kg[sc] = kg;
          rotta.viaggi_totali[sc] = kg / kgv;
          rotta.viaggi_settimana[sc] = imp.orizzonte.settimane > 0 ? kg / kgv / imp.orizzonte.settimane : 0;
        }
        resta = Math.max(0, resta - Math.min(bisogno, resta));
      }
      s.non_assegnato = s.non_assegnato || {};
      s.non_assegnato[sc] = kgInt(resta);
    }
  }
  // Un impianto che e' anche piazzale (T-Cycle): quello che il piazzale deve
  // ancora spedire agli altri non restera' a lui, e si toglie dalla sua attesa.
  for (const s of stoccaggi) {
    if (!s.e_impianto || !perImpianto.has(s.chiave)) continue;
    const imp = perImpianto.get(s.chiave);
    for (const sc of SCENARI) {
      const via = [...perImpianto.values()].reduce((t, x) => t + ((x.da_stoccaggi.find(r => r.stoccaggio === s.chiave) || { kg: {} }).kg[sc] || 0), 0);
      imp.primaria_attesa[sc] = Math.max(0, imp.primaria_attesa[sc] - via);
      imp.fabbisogno_secondarie[sc] = Math.max(0, imp.residuo_kg - imp.primaria_attesa[sc]);
    }
  }
  for (const imp of perImpianto.values()) {
    imp.da_stoccaggi.sort((a, b) => a.priorita - b.priorita || a.nome.localeCompare(b.nome));
    imp.coperto_secondarie = perScenario(sc => imp.da_stoccaggi.reduce((t, r) => t + (r.kg[sc] || 0), 0));
    imp.mancanza_kg = perScenario(sc => Math.max(0, imp.fabbisogno_secondarie[sc] - imp.coperto_secondarie[sc]));
    imp.raggiunge = perScenario(sc => imp.mancanza_kg[sc] < kgv / 2);
    imp.target_superato = imp.residuo_kg <= 0;
    // nessuno stoccaggio lo alimenta: quello che manca puo' arrivare solo in primaria
    imp.senza_stoccaggi = imp.da_stoccaggi.length === 0;
  }

  // --- il programma della prossima settimana (scenario prudente) ---
  // Come lo fa chi programma (utente, 26/09/2026): ogni settimana lo stoccaggio
  // serve tutti gli impianti. Si guarda quanti viaggi potra' fare la prossima
  // settimana - la giacenza di adesso, piu' quello che entrera' al ritmo reale,
  // meno quello che partira' nel resto di questa settimana al passo del piano -
  // poi al primo gruppo di priorita' va la sua media arrotondata per eccesso,
  // cosi' il target si raggiunge entro la fine, e i viaggi che avanzano vanno
  // agli altri, fino alla parte che spetta loro nel conto dell'anno: di piu'
  // toglierebbe materiale al primo nelle settimane dopo.
  const prossimoLunedi = piuGiorni(lunediCorrente, 7);
  const prossimaSettimana = { dal: prossimoLunedi, al: piuGiorni(prossimoLunedi, 6) };
  const programma = [];
  for (const s of stoccaggi) {
    const righe = [];
    const primoGruppo = s.destinazioni.length ? s.destinazioni[0].priorita : null;
    for (const x of s.destinazioni) {
      const imp = perImpianto.get(x.impianto);
      if (!imp || imp.fine < prossimaSettimana.dal) continue;
      const rotta = imp.da_stoccaggi.find(r => r.stoccaggio === s.chiave);
      const media = rotta ? rotta.viaggi_settimana.prudente : 0;
      const spettanti = rotta ? rotta.viaggi_totali.prudente : 0;
      righe.push({ stoccaggio: s.nome, impianto: imp.nome, chiave_impianto: imp.chiave, priorita: x.priorita, media_settimanale: Math.round(media * 10) / 10, spettanti, viaggi: 0 });
    }
    const entrataGiorno = (s.entrate_flussi || []).reduce((t, f) => t + f.ritmo_settimanale_kg, 0) / 7;
    const uscitaGiorno = righe.reduce((t, r) => t + r.media_settimanale, 0) * kgv / 7;
    const giorniPrima = Math.max(0, giorniFra(datiAl, prossimaSettimana.dal) - 1);
    const materiale = Math.max(0, s.giacenza_kg || 0) + entrataGiorno * Math.max(0, giorniFra(datiAl, prossimaSettimana.al)) - uscitaGiorno * giorniPrima;
    let tetto = Math.floor(Math.max(0, materiale) / kgv);
    if (s.residuo_plafond_kg !== null) tetto = Math.min(tetto, Math.floor(Math.max(0, s.residuo_plafond_kg) / kgv));
    let resta = tetto;
    const gruppi = [...new Set(righe.map(r => r.priorita))].sort((a, b) => a - b);
    for (const prio of gruppi) {
      const gruppo = righe.filter(r => r.priorita === prio);
      for (const r of gruppo) {
        const voluti = prio === primoGruppo ? Math.ceil(r.media_settimanale - 1e-9) : Math.floor(r.spettanti + 1e-9);
        r.voluti = voluti;
      }
      const voluti = gruppo.reduce((t, r) => t + r.voluti, 0);
      if (voluti <= resta) { for (const r of gruppo) r.viaggi = r.voluti; resta -= voluti; continue; }
      // non basta: si danno a chi ne ha bisogno di piu', uno alla volta
      const coda = [...gruppo].sort((a, b) => b.voluti - a.voluti);
      while (resta > 0 && coda.some(r => r.viaggi < r.voluti)) {
        for (const r of coda) { if (resta > 0 && r.viaggi < r.voluti) { r.viaggi++; resta--; } }
      }
      for (const r of gruppo) if (r.viaggi < r.voluti) r.limitato = true;
    }
    for (const r of righe) {
      r.kg = r.viaggi * kgv;
      const imp = perImpianto.get(r.chiave_impianto);
      r.motivo = motivoRiga(r, imp, primoGruppo, kgv, s.nome);
      delete r.voluti;
      programma.push(r);
    }
    s.viaggi_prossima_settimana = { possibili: tetto, programmati: righe.reduce((t, r) => t + r.viaggi, 0) };
  }

  // --- il fatto, settimana per settimana e per percorso ---
  const fatto = new Map(); // lunedi|stoccaggio|impianto -> { viaggi: Set, kg }
  for (const r of secondarie) {
    const g = giornoFine(r);
    if (!nellAnno(g)) continue;
    const I = chiave(r.destinazione);
    const S = chiave(r.stoccaggio);
    if (!chiaviImpianti.has(I) || S === I) continue;
    const k = `${lunediDi(g)}|${S}|${I}`;
    if (!fatto.has(k)) fatto.set(k, { settimana: lunediDi(g), stoccaggio: S, nome_stoccaggio: r.stoccaggio, impianto: I, nome_impianto: r.destinazione, viaggi: new Set(), kg: 0 });
    const x = fatto.get(k);
    x.viaggi.add(chiaveViaggio(r, chiave));
    x.kg += peso(r);
  }
  const fattoSettimane = [...fatto.values()].map(x => ({ ...x, viaggi: x.viaggi.size, kg: kgInt(x.kg) }))
    .sort((a, b) => a.settimana.localeCompare(b.settimana) || a.nome_stoccaggio.localeCompare(b.nome_stoccaggio));

  return {
    anno: annoN, oggi, dati_al: datiAl, settimana_scorsa_completa: settimanaScorsaCompleta,
    kg_per_viaggio: kgv, finestra_ritmo: finestra, fine: fineDefault, regole_definite: !!regole.definite,
    prossima_settimana: prossimaSettimana,
    impianti: [...perImpianto.values()],
    stoccaggi,
    programma,
    fatto: fattoSettimane,
    avvisi,
  };
}

const it = (g) => (g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : '');
const tonn = (kg) => `${(Math.round(kg / 10) / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t`;

// Una riga del programma, detta a parole.
function motivoRiga(r, imp, primoGruppo, kgv, stoccaggio) {
  if (!imp) return '';
  if (imp.target_superato) return `${imp.nome} ha gia' raggiunto il target.`;
  const media = String(r.media_settimanale).replace('.', ',');
  const parti = [];
  if (r.priorita === primoGruppo) {
    if (r.media_settimanale <= 0) return `A ${imp.nome} non serve altro da ${stoccaggio}, con la primaria attesa.`;
    parti.push(`Priorita': per arrivare al target di ${imp.nome} entro il ${it(imp.fine)} servono in media ${media} viaggi a settimana`);
  } else {
    if (r.spettanti < 1) parti.push(`A ${stoccaggio} non avanza materiale per ${imp.nome}, dopo gli impianti con priorita'`);
    else parti.push(`I viaggi che ${stoccaggio} puo' fare in piu', dopo gli impianti con priorita': fino a fine programmazione gliene spettano circa ${Math.floor(r.spettanti)}`);
  }
  if (r.limitato) parti.push('limitati dal materiale che il piazzale avra\' in settimana');
  if (imp.mancanza_kg.prudente >= kgv / 2) parti.push(`a ${imp.nome} mancheranno comunque circa ${tonn(imp.mancanza_kg.prudente)}`);
  return parti.join('; ') + '.';
}
