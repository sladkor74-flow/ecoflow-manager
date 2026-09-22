// Quante secondarie restano da portare, da qui alla fine dell'anno.
//
// E' il ragionamento della tabella L12:Y27 del foglio "Giacenze impianti e
// stoccaggi", messo nel gestionale e alimentato dai dati veri invece che a mano.
//
// Per ogni impianto di destinazione:
//   residuo = target totale dell'impianto - quello che gli e' già arrivato
// e il residuo si copre, mese per mese, con due flussi che non vanno confusi:
//   - il conferito in primaria, che arriva all'impianto direttamente dai
//     raccoglitori e non costa un viaggio di secondaria;
//   - il conferito in secondaria, che parte dagli stoccaggi, e quello sì si
//     misura in viaggi: 13,5 tonnellate di media per viaggio.
// Il residuo si trascina di mese in mese finche' arriva a zero: se a dicembre
// resta scoperto, il target non si raggiunge col piano scritto.
//
// L'altra meta' del ragionamento e' la disponibilita': un viaggio si puo' fare
// solo se allo stoccaggio c'e' materiale. Per ogni stoccaggio che alimenta
// l'impianto si guarda quanto c'e' adesso e quanto ne arrivera' ogni mese, e si
// confronta con i viaggi che servono. Chiedere venti viaggi a uno stoccaggio che
// ne ha materiale per dodici e' un piano che non sta in piedi.
//
// Solo rete (regola dell'utente, 22/09/2026): la predittivita' delle secondarie
// non considera ne' l'ACI ne' l'extra raccolta. La proiezione non filtra: chi
// chiama passa gia' conferiti, giacenze e ingressi della sola rete
// (functions/proiezioneSecondarie), e i totali di questo file sommano impianti
// e mesi, mai canali. Il gia' arrivato (giaArrivatoDiRete, in fondo) il canale
// lo riguarda da se', perche' lo usano tre funzioni e non deve dipendere da chi
// si ricorda di filtrare.
//
// Specchio nel frontend: src/lib/proiezioneSecondarie.js (le pagine non lo
// importano: resta allineato perche' e' la stessa regola).
import { eTerminato, periodoMovimento, canaleMovimento, dateDaSistemare, testoDate } from "./movimenti.ts";
import { formatoKg, formatoTonnellate } from "./formato.ts";

export const KG_PER_VIAGGIO = 13500;

export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/** I mesi da quello indicato fino a quello della data obiettivo, compresi. */
export function mesiDaProiettare(daMese, dataFine) {
  const ultimo = dataFine ? Number(String(dataFine).slice(5, 7)) - 1 : 11;
  const out = [];
  for (let m = daMese; m <= Math.max(daMese, ultimo); m++) out.push({ indice: m, nome: MESI[m] });
  return out;
}

// Le tonnellate nei testi con la virgola e due decimali (tre se i kg non sono
// tondi): prima si scriveva il numero arrotondato cosi' com'era, "12.35 t".
const tonnellate = (kg) => formatoTonnellate((Number(kg) || 0) / 1000);
const viaggiDa = (kg) => (Number(kg) || 0) / KG_PER_VIAGGIO;

/**
 * La media mensile di un flusso sugli ultimi mesi conclusi: serve a prevedere
 * quanto arrivera' ancora, senza chiedere all'utente di scriverlo a mano.
 * Si contano solo i mesi conclusi, e un mese a zero conta: se un raccoglitore
 * ha smesso, la media deve scendere.
 */
export function mediaMensile(perMese, finoAMeseEscluso, quantiMesi = 3) {
  const primo = Math.max(0, finoAMeseEscluso - quantiMesi);
  let somma = 0, n = 0;
  for (let m = primo; m < finoAMeseEscluso; m++) { somma += Number(perMese[m] || 0); n++; }
  return n ? somma / n : 0;
}

/**
 * La proiezione di un impianto.
 *
 * @param {object} impianto  { nome, target_kg, data_fine }
 * @param {object} dati
 *   conferito_primaria_per_mese  kg arrivati in primaria, indicizzati per mese
 *   conferito_secondaria_per_mese kg arrivati in secondaria di rete
 *   stoccaggi  [{ nome, giacenza_kg, ingressi_per_mese, prelievi_propri_per_mese }] chi lo alimenta
 * @param {object} opzioni { meseCorrente, ipotesi: { [mese]: { primaria_kg, viaggi } } }
 */
export function proiettaImpianto(impianto, dati, opzioni) {
  const meseCorrente = opzioni && opzioni.meseCorrente != null ? opzioni.meseCorrente : 0;
  const ipotesi = (opzioni && opzioni.ipotesi) || {};
  const condivisa = !!(opzioni && opzioni.disponibilitaCondivisa);
  const primPerMese = dati.conferito_primaria_per_mese || {};
  const secPerMese = dati.conferito_secondaria_per_mese || {};

  const conferitoPrimaria = Object.values(primPerMese).reduce((s, v) => s + (Number(v) || 0), 0);
  const conferitoSecondaria = Object.values(secPerMese).reduce((s, v) => s + (Number(v) || 0), 0);
  const conferito = conferitoPrimaria + conferitoSecondaria;
  const target = Number(impianto.target_kg) || 0;

  const mesi = mesiDaProiettare(meseCorrente, impianto.data_fine);
  // La previsione di primaria di ciascun mese: quella scritta a mano se c'e',
  // altrimenti la media degli ultimi tre mesi conclusi.
  const mediaPrimaria = mediaMensile(primPerMese, meseCorrente);

  // Gli stoccaggi che alimentano l'impianto: quanto hanno adesso e quanto arriva.
  // Uno stoccaggio di cui non si conosce la giacenza non vale zero: non si sa, ed
  // e' un'altra cosa. Contarlo come vuoto faceva scrivere "ne mancano N viaggi"
  // su un piazzale che nessuno ha ancora rilevato.
  // I prelievi propri sono quello che l'impianto dello stesso soggetto si porta
  // via ogni mese dal suo piazzale (T-Cycle dal piazzale di T-Cycle): non e'
  // materiale per gli altri impianti, e va tolto da quello che arriva
  // (22/09/2026). Senza, la disponibilita' di Tecnogum dal piazzale di T-Cycle
  // comprendeva anche quello che T-Cycle trasborda a se stesso.
  const stoccaggi = (dati.stoccaggi || []).map(s => ({
    nome: s.nome,
    giacenza_kg: s.giacenza_kg == null ? null : Number(s.giacenza_kg) || 0,
    giacenza_nota: s.giacenza_nota || '',
    nota: s.giacenza_nota || '',
    media_ingressi_kg: mediaMensile(s.ingressi_per_mese || {}, meseCorrente),
    ingressi_per_mese: s.ingressi_per_mese || {},
    media_prelievi_propri_kg: mediaMensile(s.prelievi_propri_per_mese || {}, meseCorrente),
    prelievi_propri_per_mese: s.prelievi_propri_per_mese || {},
  }));
  const senzaRilevazione = stoccaggi.filter(s => s.giacenza_kg == null);
  let disponibileKg = stoccaggi.reduce((s, x) => s + (x.giacenza_kg || 0), 0);

  let residuo = target - conferito;
  const righe = [];
  for (const m of mesi) {
    const ip = ipotesi[m.nome] || ipotesi[m.indice] || {};
    // Nel mese da cui si parte una parte della primaria e' gia' arrivata, ed e'
    // gia' dentro "conferito": contarla anche qui come attesa la farebbe valere
    // due volte, e i viaggi che servono risulterebbero meno di quelli veri.
    // Si mette quindi solo la parte che manca ad arrivare.
    const giaArrivata = m.indice === meseCorrente ? (Number((dati.conferito_primaria_per_mese || {})[m.indice]) || 0) : 0;
    const attesa = ip.primaria_kg != null ? Number(ip.primaria_kg) : mediaPrimaria;
    const primaria = Math.max(0, attesa - giaArrivata);
    // Quanti viaggi servono: quello che resta dopo la primaria, spalmato sui mesi
    // che restano, a 13,5 t per viaggio.
    const mesiRimanenti = mesi.length - righe.length;
    const dopoPrimaria = residuo - primaria;
    const viaggiNecessari = ip.viaggi != null ? Number(ip.viaggi)
      : Math.max(0, Math.ceil(viaggiDa(dopoPrimaria / Math.max(1, mesiRimanenti))));
    const secondarieKg = viaggiNecessari * KG_PER_VIAGGIO;

    // Disponibilita': quello che c'e' negli stoccaggi piu' quello che ci arriva
    // nel mese, meno quello che questo piano porta via. Quando gli impianti si
    // proiettano insieme questo conto non si fa qui: un piazzale condiviso ha un
    // saldo solo, e lo distribuisce proiettaInsieme.
    // (gli ingressi al netto dei prelievi propri, vedi sopra)
    const ingressiMese = stoccaggi.reduce((s, x) => s + x.media_ingressi_kg - x.media_prelievi_propri_kg, 0);
    let viaggiDisponibili = null;
    let viaggiFattibili = viaggiNecessari;
    if (!condivisa) {
      disponibileKg = Math.max(0, disponibileKg + ingressiMese);
      viaggiDisponibili = Math.floor(viaggiDa(disponibileKg));
      viaggiFattibili = Math.min(viaggiNecessari, Math.max(0, viaggiDisponibili));
      disponibileKg = Math.max(0, disponibileKg - viaggiFattibili * KG_PER_VIAGGIO);
    }

    residuo = residuo - primaria - secondarieKg;
    righe.push({
      mese: m.nome,
      primaria_kg: Math.round(primaria),
      primaria_da_ipotesi: ip.primaria_kg != null,
      viaggi: viaggiNecessari,
      viaggi_da_ipotesi: ip.viaggi != null,
      secondarie_kg: secondarieKg,
      residuo_kg: Math.round(residuo),
      viaggi_disponibili: viaggiDisponibili,
      viaggi_mancanti: condivisa ? null : Math.max(0, viaggiNecessari - viaggiFattibili),
      ingressi_stoccaggi_kg: Math.round(ingressiMese),
    });
  }

  const viaggiTotali = righe.reduce((s, r) => s + r.viaggi, 0);
  const scoperto = righe.length ? righe[righe.length - 1].residuo_kg : target - conferito;
  const avvisi = [];
  if (scoperto > KG_PER_VIAGGIO / 2) {
    avvisi.push(`Il piano non arriva al target: a fine anno resterebbero ${tonnellate(scoperto)} t da conferire, cioe' ${Math.ceil(viaggiDa(scoperto))} viaggi in piu' di quelli previsti.`);
  }
  // Con uno stoccaggio non rilevato la disponibilita' e' una stima per difetto:
  // si dice, invece di dare per mancante un materiale che forse c'e'.
  if (senzaRilevazione.length) {
    avvisi.push(`Di ${senzaRilevazione.map(s => s.nome).join(', ')} non c'e' una rilevazione del portale: la giacenza disponibile qui sotto e' calcolata senza, quindi per difetto.`);
  }
  // "Mancano quattro viaggi" si puo' dire solo se si sa quanto c'e': senza
  // nemmeno uno stoccaggio registrato, o con uno non rilevato, il numero non si
  // conosce e dirlo mancante sarebbe un allarme inventato. I due avvisi insieme
  // si contraddicevano, su T-Cycle si leggevano tutti e due.
  const disponibilitaIgnota = !stoccaggi.length || senzaRilevazione.length > 0;
  const mancanti = disponibilitaIgnota || condivisa ? [] : righe.filter(r => r.viaggi_mancanti > 0);
  if (mancanti.length) {
    avvisi.push(`Negli stoccaggi non c'e' materiale per tutti i viaggi previsti: ${mancanti.map(r => `${r.mese} ne mancano ${r.viaggi_mancanti}`).join(', ')}.`);
  }
  if (!stoccaggi.length) {
    avvisi.push('Nessuno stoccaggio registrato come fonte di questo impianto: la disponibilita\' non si puo\' calcolare.');
  }

  return {
    impianto: impianto.nome,
    target_kg: target,
    conferito_kg: Math.round(conferito),
    conferito_primaria_kg: Math.round(conferitoPrimaria),
    conferito_secondaria_kg: Math.round(conferitoSecondaria),
    residuo_kg: Math.round(target - conferito),
    media_primaria_mensile_kg: Math.round(mediaPrimaria),
    stoccaggi,
    mesi: righe,
    viaggi_totali: viaggiTotali,
    scoperto_kg: Math.round(scoperto),
    avvisi,
  };
}

/**
 * La proiezione di tutti gli impianti insieme, con i piazzali in comune.
 *
 * Da Nappi Sud escono secondarie sia per Irigom sia per Tecnogum, e la giacenza
 * di quel piazzale e' una sola: pianificare i due impianti ciascuno per conto
 * suo vuol dire promettere due volte lo stesso materiale. Qui i bisogni si
 * calcolano impianto per impianto - quanto manca al target, mese per mese - e
 * poi, mese per mese, si distribuisce quello che i piazzali hanno davvero.
 *
 * Il criterio della distribuzione e' il bisogno: chi ha piu' residuo da coprire
 * prende di piu'. Si fanno tre giri, perche' chi chiede meno della sua quota
 * lascia il resto a chi ne ha ancora bisogno.
 *
 * @param {array} elenco  [{ impianto, dati, opzioni }] gli impianti da proiettare
 * @param {object} opzioni { meseCorrente }
 */
export function proiettaInsieme(elenco, opzioni = {}) {
  const chiave = (n) => String(n || '').toLowerCase().trim();
  const meseDaCui = opzioni && opzioni.meseCorrente != null ? opzioni.meseCorrente : 0;

  const proiezioni = (elenco || []).map(x => proiettaImpianto(
    x.impianto, x.dati, { ...opzioni, ...(x.opzioni || {}), disponibilitaCondivisa: true },
  ));

  // Un piazzale per nome, non uno per impianto che ci attinge.
  const piazzali = new Map();
  for (const p of proiezioni) {
    for (const st of (p.stoccaggi || [])) {
      const k = chiave(st.nome);
      if (piazzali.has(k)) continue;
      piazzali.set(k, {
        nome: st.nome,
        ignoto: st.giacenza_kg == null,
        saldo_kg: Number(st.giacenza_kg) || 0,
        ingressi_kg: Number(st.media_ingressi_kg) || 0,
        giacenza_iniziale_kg: Number(st.giacenza_kg) || 0,
        // Nel mese da cui si parte una parte degli ingressi e' gia' arrivata, ed
        // e' gia' dentro la giacenza rilevata: aggiungerla di nuovo la conterebbe
        // due volte. Si aggiunge solo quello che manca ad arrivare.
        gia_arrivato_kg: Number((st.ingressi_per_mese || {})[meseDaCui]) || 0,
        // quello che l'impianto dello stesso soggetto se ne porta via ogni mese
        // (vedi proiettaImpianto), con la stessa regola per il mese in corso
        prelievi_kg: Number(st.media_prelievi_propri_kg) || 0,
        gia_prelevato_kg: Number((st.prelievi_propri_per_mese || {})[meseDaCui]) || 0,
        prelevati_mese_kg: 0,
        quanti_la_usano: 0,
      });
    }
  }

  // Quanti impianti attingono a ciascun piazzale: serve a servirli nell'ordine
  // giusto, dal piu' vincolato al meno.
  for (const p of proiezioni) {
    for (const st of (p.stoccaggi || [])) {
      const pz = piazzali.get(chiave(st.nome));
      if (pz) pz.quanti_la_usano++;
    }
  }

  const mesiMax = proiezioni.reduce((n, p) => Math.max(n, (p.mesi || []).length), 0);
  const registro = [];

  for (let i = 0; i < mesiMax; i++) {
    for (const pz of piazzali.values()) {
      if (pz.ignoto) continue;
      const attesi = i === 0 ? Math.max(0, pz.ingressi_kg - pz.gia_arrivato_kg) : pz.ingressi_kg;
      // I trasbordi all'impianto dello stesso soggetto escono prima che gli altri
      // prelevino: quel materiale e' suo, e agli altri resta quello che avanza.
      const prelevati = i === 0 ? Math.max(0, pz.prelievi_kg - pz.gia_prelevato_kg) : pz.prelievi_kg;
      pz.prelevati_mese_kg = prelevati;
      pz.saldo_kg = Math.max(0, pz.saldo_kg + attesi - prelevati);
    }

    // chi chiede che cosa, questo mese
    const richieste = [];
    for (const p of proiezioni) {
      const riga = (p.mesi || [])[i];
      if (!riga) continue;
      const suoi = (p.stoccaggi || []).map(st => chiave(st.nome)).filter(k => piazzali.has(k));
      const noti = suoi.filter(k => !piazzali.get(k).ignoto);
      richieste.push({
        impianto: p.impianto, riga, suoi, noti,
        serve_kg: (Number(riga.viaggi) || 0) * KG_PER_VIAGGIO,
        avuto_kg: 0,
        // quanto ha preso da ciascun piazzale, non solo in tutto: senza questo
        // il registro scriveva lo stesso prelievo sotto due piazzali diversi.
        preso_da: {},
        ignoto: suoi.length === 0 || noti.length < suoi.length,
      });
    }

    // tre giri di distribuzione proporzionale al bisogno che resta
    // Gli esclusivi prima, i condivisi dopo: chi ha un piazzale suo lo consuma
    // per primo e non toglie a chi sul condiviso non ha alternative. Altrimenti
    // l'ordine dei record decideva chi resta a secco.
    const inOrdine = [...piazzali.values()].sort((a, b) => a.quanti_la_usano - b.quanti_la_usano);
    for (let giro = 0; giro < 3; giro++) {
      for (const pz of inOrdine) {
        if (pz.ignoto || pz.saldo_kg <= 0) continue;
        const k = chiave(pz.nome);
        const suoi = richieste.filter(r => r.noti.includes(k) && r.serve_kg - r.avuto_kg > 0);
        if (!suoi.length) continue;
        const bisogno = suoi.reduce((s, r) => s + (r.serve_kg - r.avuto_kg), 0);
        if (bisogno <= 0) continue;
        let uscito = 0;
        for (const r of suoi) {
          const resta = r.serve_kg - r.avuto_kg;
          const quota = Math.min(resta, Math.floor(pz.saldo_kg * (resta / bisogno)));
          if (quota <= 0) continue;
          r.avuto_kg += quota;
          r.preso_da[k] = (r.preso_da[k] || 0) + quota;
          uscito += quota;
        }
        pz.saldo_kg = Math.max(0, pz.saldo_kg - uscito);
      }
    }

    // L'avanzo di un piazzale condiviso non e' tutto di chi lo guarda: se ne
    // conta la parte che gli spetterebbe, in proporzione a quanto gli manca.
    const bisognoResiduo = (r) => Math.max(0, r.serve_kg - r.avuto_kg);
    for (const r of richieste) {
      const disponibileSuo = r.noti.reduce((s, k) => {
        const pz = piazzali.get(k);
        if (pz.quanti_la_usano <= 1) return s + pz.saldo_kg;
        const concorrenti = richieste.filter(x => x.noti.includes(k));
        const totale = concorrenti.reduce((n, x) => n + bisognoResiduo(x), 0);
        const quota = totale > 0 ? bisognoResiduo(r) / totale : 1 / Math.max(1, concorrenti.length);
        return s + pz.saldo_kg * quota;
      }, 0) + r.avuto_kg;
      const fattibili = Math.floor(r.avuto_kg / KG_PER_VIAGGIO);
      r.riga.viaggi_disponibili = r.ignoto ? null : Math.floor(viaggiDa(disponibileSuo));
      r.riga.viaggi_mancanti = r.ignoto ? null : Math.max(0, (Number(r.riga.viaggi) || 0) - fattibili);
      r.riga.kg_dagli_stoccaggi = Math.round(r.avuto_kg);
    }

    registro.push({
      mese: (proiezioni.find(p => (p.mesi || [])[i]) || { mesi: [] }).mesi[i].mese,
      piazzali: [...piazzali.values()].map(pz => ({
        nome: pz.nome,
        ignoto: pz.ignoto,
        ingressi_kg: pz.ignoto ? null : Math.round(pz.ingressi_kg),
        prelievi_propri_kg: pz.ignoto ? null : Math.round(pz.prelevati_mese_kg),
        saldo_fine_mese_kg: pz.ignoto ? null : Math.round(pz.saldo_kg),
        prelievi: richieste.filter(r => (r.preso_da[chiave(pz.nome)] || 0) > 0)
          .map(r => ({ impianto: r.impianto, kg: Math.round(r.preso_da[chiave(pz.nome)]) })),
      })),
    });
  }

  // gli avvisi sui viaggi mancanti si rifanno adesso, con i numeri veri
  for (const p of proiezioni) {
    const mancanti = (p.mesi || []).filter(m => m.viaggi_mancanti > 0);
    if (mancanti.length) {
      p.avvisi = [...(p.avvisi || []), `Negli stoccaggi non c'e' materiale per tutti i viaggi previsti: ${mancanti.map(m => `${m.mese} ne mancano ${m.viaggi_mancanti}`).join(', ')}. Il conto tiene conto anche di quello che gli altri impianti prendono dagli stessi piazzali.`];
    }
  }

  const condivisi = [...piazzali.values()].filter(pz => proiezioni.filter(p => (p.stoccaggi || []).some(st => chiave(st.nome) === chiave(pz.nome))).length > 1);
  for (const pz of condivisi) {
    const chi = proiezioni.filter(p => (p.stoccaggi || []).some(st => chiave(st.nome) === chiave(pz.nome))).map(p => p.impianto);
    for (const p of proiezioni) {
      if (!chi.includes(p.impianto)) continue;
      p.avvisi = [...(p.avvisi || []), `${pz.nome} alimenta anche ${chi.filter(n => n !== p.impianto).join(' e ')}: la sua giacenza e' una sola e i piani sono calcolati insieme.`];
    }
  }

  return { impianti: proiezioni, piazzali_condivisi: condivisi.map(pz => pz.nome), registro_piazzali: registro };
}

/** I viaggi che servono ogni mese su tutti gli impianti, come la riga 27 del foglio. */
export function viaggiPerMese(proiezioni) {
  const per = new Map();
  for (const p of proiezioni) {
    for (const r of p.mesi) {
      if (!per.has(r.mese)) per.set(r.mese, { mese: r.mese, viaggi: 0, per_impianto: [] });
      const x = per.get(r.mese);
      x.viaggi += r.viaggi;
      x.per_impianto.push({ impianto: p.impianto, viaggi: r.viaggi });
    }
  }
  return [...per.values()];
}

// ---------------------------------------------------------------------------
// Il gia' arrivato di rete di un impianto seguito: un conto solo.
//
// Regola dell'utente del 22/09/2026: le primarie scaricate nel piazzale di un
// impianto seguito (tipo_destinazione 'stoc', per esempio lo stoccaggio di
// Irigom) «si contano perché la predittività delle secondarie si basa sul
// residuo totale che diminuisce anche con le primarie». Fino a quel giorno i
// conti erano tre e non coincidevano: la Proiezione le contava, la Dashboard
// (calcolaPianificazioneSecondaria) teneva solo le primarie scaricate
// all'impianto, e il suggerimento del lunedi' aveva un conto suo, che contava
// anche le secondarie dal piazzale dell'impianto all'impianto stesso. Adesso
// Dashboard, Proiezione, suggerimento del lunedi' e agente leggono tutti questo:
//
//   gia' arrivato = primarie di rete terminate arrivate all'impianto
//                 + primarie di rete terminate scaricate nel suo piazzale (stesso
//                   soggetto), al netto di quello che dal piazzale riparte in
//                   secondaria per ALTRI impianti
//                 + secondarie di rete terminate arrivate all'impianto da ALTRI
//                   stoccaggi;
//   residuo       = target - gia' arrivato, lo stesso numero ovunque.
//
// Le secondarie dal piazzale dell'impianto all'impianto stesso non si contano
// mai: quei PFU si sono gia' contati quando sono arrivati al sito in primaria, e
// contarli di nuovo al trasbordo li farebbe valere due volte. Si contano a parte
// (da_se_stesso) e si dice quante sono.
//
// Il piazzale conta al netto (correzione del 22/09/2026, da far confermare
// all'utente): quello che dal piazzale di T-Cycle parte per Tecnogum non lo
// tratta T-Cycle, e Tecnogum lo conta gia' fra le sue secondarie da altri
// stoccaggi. Tenuto anche nel gia' arrivato di T-Cycle, gli stessi PFU
// abbassavano due residui, e quello di T-Cycle usciva piu' piccolo del vero: il
// suo target di 1.050.000 kg e' la quota dell'impianto, mentre il plafond di
// 250.000 kg del piazzale (migraTCycleImpianto) e' proprio quello che si spedisce
// agli altri. Si toglie sul giorno della fine trasporto della secondaria, e al
// massimo quanto nell'anno e' entrato nel piazzale fino a quel giorno: una
// partenza da una giacenza di prima non era nel gia' arrivato dell'anno e non si
// toglie (lo dice una nota).
//
// Solo rete, solo terminati, e l'anno e' quello della fine trasporto sul giorno
// italiano (periodoMovimento): mai la chiusura a portale. Un terminato senza
// fine trasporto non si colloca e resta fuori, e lo segnala
// dateDaSistemareDiRete qui sotto.
// ---------------------------------------------------------------------------

const tipoPiazzale = (r) => String((r && r.tipo_destinazione) || '').toLowerCase().trim() === 'stoc';
const pesoDi = (r) => Number(r && r.peso_effettivo) || 0;
const piu = (mappa, k, kg) => { mappa[k] = (mappa[k] || 0) + kg; };

/**
 * Il gia' arrivato di rete di ogni impianto seguito, nell'anno.
 *
 * @param {Iterable<string>} impianti  le chiavi (ragione sociale normalizzata) degli impianti seguiti
 * @param {array} primarie    le primarie; si tengono da se' le terminate di rete
 * @param {array} secondarie  le secondarie; idem
 * @param {number} anno       l'anno della fine trasporto
 * @param {function} chiave   la normalizzazione della ragione sociale (normalizzaRagioneSociale)
 * @returns {Map} chiave dell'impianto -> {
 *   primaria_kg            primarie contate: all'impianto + piazzale al netto
 *   primaria_impianto_kg   scaricate all'impianto
 *   primaria_piazzale_kg   scaricate nel piazzale, tutte
 *   piazzale_ripartito_kg  di quelle, ripartite per altri impianti e tolte
 *   primaria_piazzale_netta_kg  primaria_piazzale_kg - piazzale_ripartito_kg
 *   ripartito_non_tolto_kg partenze dal piazzale che non trovavano primarie
 *                          dell'anno da cui togliersi (giacenza di prima)
 *   secondaria_kg, totale_kg (il gia' arrivato), arrivato_al_sito_kg (tutto
 *   quello che e' arrivato al sito, ripartito compreso: per la capacita')
 *   primaria_per_mese, secondaria_per_mese   (indice del mese 0-11 -> kg; la
 *                primaria e' gia' al netto del ripartito, sul mese della partenza)
 *   movimenti   [{ flusso: 'primaria'|'secondaria'|'ripartita', piazzale, da, a,
 *                giorno, mese_idx, kg, record }]; le ripartite hanno i kg in
 *                negativo, cosi' la somma dei movimenti e' il gia' arrivato
 *   da_se_stesso { viaggi, kg }   le secondarie dal proprio piazzale, lasciate fuori
 *   verso_altri  { chiave destinazione -> { viaggi, kg, seguito } }  le secondarie
 *                partite dal suo piazzale verso un altro impianto; seguito se e'
 *                un impianto della predittivita', che le conta nel suo gia' arrivato
 * }
 */
export function giaArrivatoDiRete(impianti, primarie, secondarie, anno, chiave) {
  const out = new Map();
  // entrate e uscite del piazzale di ciascun impianto, per il netto
  const piazzale = new Map();
  for (const k of impianti || []) {
    if (!k || out.has(k)) continue;
    out.set(k, {
      chiave: k,
      primaria_kg: 0, primaria_impianto_kg: 0, primaria_piazzale_kg: 0,
      piazzale_ripartito_kg: 0, primaria_piazzale_netta_kg: 0, ripartito_non_tolto_kg: 0,
      secondaria_kg: 0, totale_kg: 0, arrivato_al_sito_kg: 0,
      primaria_per_mese: {}, secondaria_per_mese: {},
      movimenti: [],
      da_se_stesso: { viaggi: 0, kg: 0 },
      verso_altri: {},
    });
    piazzale.set(k, []);
  }
  const anno_ = Number(anno);

  for (const r of primarie || []) {
    if (!eTerminato(r) || canaleMovimento(r, 'PrimariaRete') !== 'RETE') continue;
    const dest = chiave(r.destinazione);
    const x = out.get(dest);
    if (!x) continue;
    const p = periodoMovimento(r);
    if (!p || p.anno !== anno_) continue;
    const kg = pesoDi(r);
    const nelPiazzale = tipoPiazzale(r);
    x.primaria_kg += kg;
    if (nelPiazzale) {
      x.primaria_piazzale_kg += kg;
      piazzale.get(dest).push({ giorno: p.giorno, entra: kg });
    } else x.primaria_impianto_kg += kg;
    piu(x.primaria_per_mese, p.mese_idx, kg);
    x.movimenti.push({ flusso: 'primaria', piazzale: nelPiazzale, da: chiave(r.trasportatore), a: dest, giorno: p.giorno, mese_idx: p.mese_idx, kg, record: r });
  }

  for (const r of secondarie || []) {
    if (!eTerminato(r) || canaleMovimento(r, 'Secondaria') !== 'RETE') continue;
    const p = periodoMovimento(r);
    if (!p || p.anno !== anno_) continue;
    const dest = chiave(r.destinazione);
    const orig = chiave(r.stoccaggio);
    const kg = pesoDi(r);
    // partita dal piazzale di un impianto seguito verso un altro impianto,
    // seguito o no: non resta a lui (vedi sopra, il piazzale al netto)
    const partenza = orig && dest && orig !== dest ? out.get(orig) : null;
    if (partenza) {
      if (!partenza.verso_altri[dest]) partenza.verso_altri[dest] = { viaggi: 0, kg: 0, seguito: out.has(dest) };
      partenza.verso_altri[dest].viaggi++;
      partenza.verso_altri[dest].kg += kg;
      piazzale.get(orig).push({ giorno: p.giorno, esce: kg, mese_idx: p.mese_idx, dest, record: r });
    }
    const x = out.get(dest);
    if (!x) continue;
    if (orig && orig === dest) { x.da_se_stesso.viaggi++; x.da_se_stesso.kg += kg; continue; }
    x.secondaria_kg += kg;
    piu(x.secondaria_per_mese, p.mese_idx, kg);
    x.movimenti.push({ flusso: 'secondaria', piazzale: tipoPiazzale(r), da: orig, a: dest, giorno: p.giorno, mese_idx: p.mese_idx, kg, record: r });
  }

  for (const x of out.values()) {
    // Il netto del piazzale, in ordine di giorno: nello stesso giorno prima le
    // entrate. Ogni partenza toglie al massimo quello che nell'anno e' entrato
    // nel piazzale e non e' ancora ripartito.
    const eventi = piazzale.get(x.chiave).sort((a, b) => (a.giorno < b.giorno ? -1 : a.giorno > b.giorno ? 1 : (a.esce ? 1 : 0) - (b.esce ? 1 : 0)));
    let dentro = 0;
    for (const e of eventi) {
      if (!e.esce) { dentro += e.entra; continue; }
      const tolto = Math.min(e.esce, dentro);
      dentro -= tolto;
      x.ripartito_non_tolto_kg += e.esce - tolto;
      if (tolto <= 0) continue;
      x.piazzale_ripartito_kg += tolto;
      piu(x.primaria_per_mese, e.mese_idx, -tolto);
      x.movimenti.push({ flusso: 'ripartita', piazzale: true, da: x.chiave, a: e.dest, giorno: e.giorno, mese_idx: e.mese_idx, kg: -tolto, record: e.record });
    }
    x.primaria_impianto_kg = Math.round(x.primaria_impianto_kg);
    x.primaria_piazzale_kg = Math.round(x.primaria_piazzale_kg);
    x.piazzale_ripartito_kg = Math.round(x.piazzale_ripartito_kg);
    x.ripartito_non_tolto_kg = Math.round(x.ripartito_non_tolto_kg);
    x.primaria_piazzale_netta_kg = x.primaria_piazzale_kg - x.piazzale_ripartito_kg;
    x.primaria_kg = x.primaria_impianto_kg + x.primaria_piazzale_netta_kg;
    x.secondaria_kg = Math.round(x.secondaria_kg);
    x.totale_kg = x.primaria_kg + x.secondaria_kg;
    x.arrivato_al_sito_kg = x.totale_kg + x.piazzale_ripartito_kg;
    x.da_se_stesso.kg = Math.round(x.da_se_stesso.kg);
    for (const v of Object.values(x.verso_altri)) v.kg = Math.round(v.kg);
  }
  return out;
}

/** Il residuo di rete di un impianto: target meno gia' arrivato, anche sotto zero se il target e' superato. */
export const residuoDiRete = (target, arrivato) => Math.round((Number(target) || 0) - ((arrivato && arrivato.totale_kg) || 0));

/**
 * Le note sul gia' arrivato di un impianto: le secondarie dal suo piazzale a se
 * stesso lasciate fuori, quelle partite dal suo piazzale verso altri impianti
 * (e' il caso di T-Cycle, il cui piazzale alimenta Tecnogum) e come il piazzale
 * conta al netto di quello che riparte. Dicono come e' fatto il conto, perche'
 * chi legge i residui di due impianti sappia che quei PFU stanno in uno solo.
 *
 * @param {object} x      un elemento di giaArrivatoDiRete
 * @param {function} nomeDi  chiave -> nome da mostrare
 * @param {number} anno
 */
export function noteGiaArrivato(x, nomeDi, anno) {
  if (!x) return [];
  const nome = (k) => (nomeDi ? nomeDi(k) : k) || k;
  const note = [];
  if (x.da_se_stesso.viaggi) {
    const n = x.da_se_stesso.viaggi;
    note.push(`${n} ${n === 1 ? 'secondaria' : 'secondarie'} di rete dal piazzale di ${nome(x.chiave)} all'impianto stesso (${tonnellate(x.da_se_stesso.kg)} t) non ${n === 1 ? 'è contata' : 'sono contate'} nel già arrivato: quei PFU si contano quando arrivano al sito in primaria, e contarli anche al trasbordo li farebbe valere due volte.`);
  }
  const uscite = Object.entries(x.verso_altri || {});
  for (const [dest, v] of uscite) {
    note.push(`Dal piazzale di ${nome(x.chiave)} sono partite nel ${anno} ${tonnellate(v.kg)} t di secondarie di rete per ${nome(dest)} (${v.viaggi} ${v.viaggi === 1 ? 'viaggio' : 'viaggi'})${v.seguito ? ', che le conta nel suo già arrivato' : ''}.`);
  }
  if (x.piazzale_ripartito_kg) {
    const altroSeguito = uscite.some(([, v]) => v.seguito);
    note.push(`Il piazzale conta per ${nome(x.chiave)} al netto di quello che riparte per altri impianti: delle ${tonnellate(x.primaria_piazzale_kg)} t di primarie di rete scaricate nel piazzale se ne tolgono ${tonnellate(x.piazzale_ripartito_kg)} t, e nel già arrivato ne restano ${tonnellate(x.primaria_piazzale_netta_kg)} t. Quello che riparte non lo tratta ${nome(x.chiave)}${altroSeguito ? ', e l\'impianto seguito che lo riceve lo conta già: tenuto anche qui, gli stessi PFU abbasserebbero due residui' : ''}.`);
  }
  if (x.ripartito_non_tolto_kg) {
    note.push(`${tonnellate(x.ripartito_non_tolto_kg)} t partite dal piazzale di ${nome(x.chiave)} non si tolgono dal già arrivato: nel ${anno}, fino al giorno della partenza, nel piazzale non erano entrate abbastanza primarie di rete da cui toglierle. Vengono da una giacenza di prima, oppure le primarie arrivate non sono segnate come scaricate nel piazzale: in quel caso va corretto il formulario.`);
  }
  return note;
}

/**
 * I siti che la predittivita' guarda: gli impianti seguiti e gli stoccaggi che
 * li alimentano, cioe' quelli registrati come stoccaggio (o doppio ruolo) di un
 * impianto seguito e quelli da cui nell'anno e' partita una secondaria di rete
 * verso uno di loro. Serve a dire di quali formulari si controllano le date:
 * gli stessi per la Dashboard, la Proiezione e il suggerimento del lunedi'.
 *
 * @param {array} impianti  ImpiantoTargetSecondaria attivi ({ id, nome_impianto })
 * @param {array} fornitori FornitoreSecondaria attivi
 * @returns {{ impianti: Set, stoccaggi: Set, tutti: Set }}
 */
export function sitiDellaPredittivita(impianti, fornitori, secondarie, anno, chiave) {
  const imp = new Set();
  const ids = new Set();
  for (const i of impianti || []) {
    const k = chiave(i && i.nome_impianto);
    if (k) imp.add(k);
    if (i && i.id) ids.add(i.id);
  }
  const stoccaggi = new Set();
  for (const f of fornitori || []) {
    const suo = (f.impianto_id && ids.has(f.impianto_id)) || imp.has(chiave(f.impianto_nome));
    if (!suo) continue;
    const ruolo = f.ruolo || (String(f.tipo || '').toLowerCase().trim() === 'stoccaggio' ? 'stoccaggio' : 'raccoglitore');
    const k = chiave(f.nome);
    if (k && (ruolo === 'stoccaggio' || ruolo === 'doppio_ruolo')) stoccaggi.add(k);
  }
  const anno_ = Number(anno);
  for (const r of secondarie || []) {
    if (!eTerminato(r) || canaleMovimento(r, 'Secondaria') !== 'RETE') continue;
    const p = periodoMovimento(r);
    if (!p || p.anno !== anno_ || !imp.has(chiave(r.destinazione))) continue;
    const o = chiave(r.stoccaggio);
    if (o) stoccaggi.add(o);
  }
  return { impianti: imp, stoccaggi, tutti: new Set([...imp, ...stoccaggi]) };
}

/**
 * I terminati di rete con le date obbligatorie da sistemare, fra quelli che la
 * predittivita' legge. Regola dell'utente del 22/09/2026: «le date immissione,
 * inizio e fine trasporto sono obbligatorie nei formulari, se non ci sono vanno
 * segnalate e questo vale sempre dove ci sono ordini terminati». Prima qui si
 * contavano solo i senza fine trasporto.
 *
 * Si guardano le primarie arrivate ai siti della predittivita' e le secondarie
 * che ne partono o ci arrivano: quelle con la fine trasporto nell'anno e quelle
 * senza fine trasporto di qualunque anno, che non si possono collocare. Chi ha
 * la fine trasporto resta nei conti, sul suo giorno, e si segnala; chi non l'ha
 * resta fuori da tutti i conti e si segnala lo stesso, dicendo quali date
 * mancano. Le regole sono quelle di movimenti.ts (dateDaSistemare, testoDate).
 *
 * @param {Set|array} siti  le chiavi dei siti (sitiDellaPredittivita().tutti)
 * @returns {{ primarie: array, secondarie: array, senza_fine: { primarie, secondarie }, avviso: string }}
 *   ogni elemento: { id_ordine, testo, fuori_dai_conti }
 */
export function dateDaSistemareDiRete(primarie, secondarie, siti, anno, chiave) {
  const dentro = siti instanceof Set ? siti : new Set(siti || []);
  const anno_ = Number(anno);
  const esito = { primarie: [], secondarie: [], senza_fine: { primarie: 0, secondarie: 0 }, avviso: '' };
  const guarda = (r, flusso) => {
    if (!dateDaSistemare(r)) return;
    const p = periodoMovimento(r);
    if (p && p.anno !== anno_) return;
    esito[flusso].push({ id_ordine: String(r.id_ordine || r.numero_fir || ''), testo: testoDate(r), fuori_dai_conti: !p });
    if (!p) esito.senza_fine[flusso]++;
  };
  for (const r of primarie || []) {
    if (!eTerminato(r) || canaleMovimento(r, 'PrimariaRete') !== 'RETE') continue;
    if (dentro.has(chiave(r.destinazione))) guarda(r, 'primarie');
  }
  for (const r of secondarie || []) {
    if (!eTerminato(r) || canaleMovimento(r, 'Secondaria') !== 'RETE') continue;
    if (dentro.has(chiave(r.destinazione)) || dentro.has(chiave(r.stoccaggio))) guarda(r, 'secondarie');
  }
  esito.avviso = avvisoDate(esito, anno_);
  return esito;
}

/**
 * Le date da sistemare come le restituiscono le funzioni: i conteggi e i primi
 * ordini di ciascun flusso, non l'elenco intero, che con un archivio vecchio
 * senza la data di inizio trasporto poteva fare migliaia di righe.
 */
export function riassuntoDate(esito, quanti = 50) {
  const e = esito || { primarie: [], secondarie: [], senza_fine: { primarie: 0, secondarie: 0 } };
  return {
    primarie: e.primarie.length,
    secondarie: e.secondarie.length,
    senza_fine_trasporto: e.senza_fine,
    ordini: { primarie: e.primarie.slice(0, quanti), secondarie: e.secondarie.slice(0, quanti) },
  };
}

// Quanti ordini mostrare per ogni tipo di date da sistemare: gli altri si contano.
const MOSTRA_ORDINI = 5;
// "manca la data di fine trasporto, 2 ordini (A, B); fine trasporto prima dell'inizio, 1 ordine (C)"
function descriviDate(elenco) {
  const gruppi = new Map();
  for (const x of elenco) {
    if (!gruppi.has(x.testo)) gruppi.set(x.testo, []);
    gruppi.get(x.testo).push(x.id_ordine || 'senza numero');
  }
  return [...gruppi.entries()].map(([testo, ordini]) => {
    const mostrati = ordini.slice(0, MOSTRA_ORDINI).join(', ');
    const altri = ordini.length > MOSTRA_ORDINI ? ` e altri ${formatoKg(ordini.length - MOSTRA_ORDINI)}` : '';
    return `${testo}, ${formatoKg(ordini.length)} ${ordini.length === 1 ? 'ordine' : 'ordini'} (${mostrati}${altri})`;
  }).join('; ');
}

function avvisoDate(e, anno) {
  const np = e.primarie.length, ns = e.secondarie.length;
  if (!np && !ns) return '';
  const parti = [];
  if (np) parti.push(`Primarie (${formatoKg(np)}): ${descriviDate(e.primarie)}.`);
  if (ns) parti.push(`Secondarie (${formatoKg(ns)}): ${descriviDate(e.secondarie)}.`);
  let testo = `Formulari di rete terminati con le date obbligatorie da sistemare (immissione, inizio e fine trasporto), verso gli impianti seguiti e i loro stoccaggi: quelli del ${anno} e quelli senza fine trasporto di qualunque anno. ${parti.join(' ')}`;
  const sf = e.senza_fine.primarie + e.senza_fine.secondarie;
  if (sf) testo += ` Quelli senza fine trasporto (primarie: ${formatoKg(e.senza_fine.primarie)}, secondarie: ${formatoKg(e.senza_fine.secondarie)}) restano fuori dal già arrivato, dalle settimane e dalle giacenze degli stoccaggi finché un nuovo caricamento non porta la data.`;
  if (sf < np + ns) testo += ' Gli altri sono contati sul giorno della loro fine trasporto.';
  return testo;
}
