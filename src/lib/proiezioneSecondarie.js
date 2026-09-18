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
// Specchio del backend: base44/shared/proiezioneSecondarie.ts.

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
  const stoccaggi = (dati.stoccaggi || []).map(s => ({
    nome: s.nome,
    giacenza_kg: Number(s.giacenza_kg) || 0,
    media_ingressi_kg: mediaMensile(s.ingressi_per_mese || {}, meseCorrente),
  }));
  let disponibileKg = stoccaggi.reduce((s, x) => s + x.giacenza_kg, 0);

  let residuo = target - conferito;
  const righe = [];
  for (const m of mesi) {
    const ip = ipotesi[m.nome] || ipotesi[m.indice] || {};
    const primaria = ip.primaria_kg != null ? Number(ip.primaria_kg) : mediaPrimaria;
    // Quanti viaggi servono: quello che resta dopo la primaria, spalmato sui mesi
    // che restano, a 13,5 t per viaggio.
    const mesiRimanenti = mesi.length - righe.length;
    const dopoPrimaria = residuo - primaria;
    const viaggiNecessari = ip.viaggi != null ? Number(ip.viaggi)
      : Math.max(0, Math.ceil(viaggiDa(dopoPrimaria / Math.max(1, mesiRimanenti))));
    const secondarieKg = viaggiNecessari * KG_PER_VIAGGIO;

    // Disponibilita': quello che c'e' negli stoccaggi piu' quello che ci arriva
    // nel mese, meno quello che questo piano porta via.
    const ingressiMese = stoccaggi.reduce((s, x) => s + x.media_ingressi_kg, 0);
    disponibileKg += ingressiMese;
    const viaggiDisponibili = Math.floor(viaggiDa(disponibileKg));
    const viaggiFattibili = Math.min(viaggiNecessari, Math.max(0, viaggiDisponibili));
    disponibileKg = Math.max(0, disponibileKg - viaggiFattibili * KG_PER_VIAGGIO);

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
      viaggi_mancanti: Math.max(0, viaggiNecessari - viaggiFattibili),
      ingressi_stoccaggi_kg: Math.round(ingressiMese),
    });
  }

  const viaggiTotali = righe.reduce((s, r) => s + r.viaggi, 0);
  const scoperto = righe.length ? righe[righe.length - 1].residuo_kg : target - conferito;
  const avvisi = [];
  if (scoperto > KG_PER_VIAGGIO / 2) {
    avvisi.push(`Il piano non arriva al target: a fine anno resterebbero ${arrotonda(scoperto / 1000)} t da conferire, cioe' ${Math.ceil(viaggiDa(scoperto))} viaggi in piu' di quelli previsti.`);
  }
  const mancanti = righe.filter(r => r.viaggi_mancanti > 0);
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
