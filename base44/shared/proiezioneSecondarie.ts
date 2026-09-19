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
// Rete e ACI restano separati: le secondarie ACI non consumano il target di rete
// e non entrano in questo conto.
//
// Specchio nel frontend: src/lib/proiezioneSecondarie.js.

export const KG_PER_VIAGGIO = 13500;

export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/** I mesi da quello indicato fino a quello della data obiettivo, compresi. */
export function mesiDaProiettare(daMese, dataFine) {
  const ultimo = dataFine ? Number(String(dataFine).slice(5, 7)) - 1 : 11;
  const out = [];
  for (let m = daMese; m <= Math.max(daMese, ultimo); m++) out.push({ indice: m, nome: MESI[m] });
  return out;
}

const arrotonda = (n) => Math.round((Number(n) || 0) * 100) / 100;
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
 *   stoccaggi  [{ nome, giacenza_kg, ingressi_per_mese }] chi lo alimenta
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
  const stoccaggi = (dati.stoccaggi || []).map(s => ({
    nome: s.nome,
    giacenza_kg: s.giacenza_kg == null ? null : Number(s.giacenza_kg) || 0,
    giacenza_nota: s.giacenza_nota || '',
    nota: s.giacenza_nota || '',
    media_ingressi_kg: mediaMensile(s.ingressi_per_mese || {}, meseCorrente),
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
    const ingressiMese = stoccaggi.reduce((s, x) => s + x.media_ingressi_kg, 0);
    let viaggiDisponibili = null;
    let viaggiFattibili = viaggiNecessari;
    if (!condivisa) {
      disponibileKg += ingressiMese;
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
    avvisi.push(`Il piano non arriva al target: a fine anno resterebbero ${arrotonda(scoperto / 1000)} t da conferire, cioe' ${Math.ceil(viaggiDa(scoperto))} viaggi in piu' di quelli previsti.`);
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

/** I viaggi che servono ogni mese su tutti gli impianti, come la riga 27 del foglio. */
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
      });
    }
  }

  const mesiMax = proiezioni.reduce((n, p) => Math.max(n, (p.mesi || []).length), 0);
  const registro = [];

  for (let i = 0; i < mesiMax; i++) {
    for (const pz of piazzali.values()) if (!pz.ignoto) pz.saldo_kg += pz.ingressi_kg;

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
        ignoto: suoi.length === 0 || noti.length < suoi.length,
      });
    }

    // tre giri di distribuzione proporzionale al bisogno che resta
    for (let giro = 0; giro < 3; giro++) {
      for (const pz of piazzali.values()) {
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
          uscito += quota;
        }
        pz.saldo_kg = Math.max(0, pz.saldo_kg - uscito);
      }
    }

    for (const r of richieste) {
      const disponibileSuo = r.noti.reduce((s, k) => s + piazzali.get(k).saldo_kg, 0) + r.avuto_kg;
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
        saldo_fine_mese_kg: pz.ignoto ? null : Math.round(pz.saldo_kg),
        prelievi: richieste.filter(r => r.noti.includes(chiave(pz.nome)) && r.avuto_kg > 0)
          .map(r => ({ impianto: r.impianto, kg: Math.round(r.avuto_kg) })),
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
