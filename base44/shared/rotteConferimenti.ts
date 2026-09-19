// Chi conferisce dove: le rotte della commessa, e gli errori di chiusura.
//
// Ogni movimento va da un'origine a una destinazione, e le coppie non sono
// libere: un raccoglitore conferisce dove ha il proprio impianto o dove ha
// l'accordo di stoccare, e da li' non si sposta. Green Tyre Project conferisce a
// Green Tyre Project; Nappi Sud raccoglie e stocca a Nappi Sud; Ecorecuperi
// porta a Tecnogum. Quando un formulario si chiude con la destinazione sbagliata
// il movimento finisce su un impianto che non l'ha mai visto, e da li' in poi
// sbagliano le giacenze, le dichiarazioni e la fatturazione.
//
// Le rotte non si scrivono a mano: si leggono dalla storia dell'anno. Quello che
// un'origine fa quasi sempre e' la sua rotta; quello che fa una volta sola,
// contro centinaia di viaggi, e' quasi sempre un errore di chiusura. Chi ha due
// rotte vere - C.L. Service, che stocca sia a Nappi Sud sia a T-Cycle - le ha
// entrambe consistenti, e non viene segnalato.
//
// Il criterio, per ogni origine: una destinazione che raccoglie meno del 5% dei
// suoi viaggi E meno di cinque viaggi in tutto e' sospetta. Servono tutte e due
// le condizioni, altrimenti chi fa pochi viaggi in assoluto verrebbe segnalato
// sempre.
//
// Nelle primarie l'origine e' il raccoglitore (chi ritira e porta), nelle
// secondarie e' lo stoccaggio, che per quel viaggio e' il produttore: Nappi Sud,
// che raccoglie con un target suo, quando spedisce a Irigom o a Tecnogum non e'
// piu' un raccoglitore ma il produttore del rifiuto che parte dal suo piazzale.

import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { giornoRoma } from "./giornoItaliano.ts";

export const QUOTA_SOSPETTA = 0.05;
export const VIAGGI_SOSPETTI = 5;

/** Da dove parte un movimento, secondo l'archivio in cui si trova. */
export function origineDi(riga, archivio) {
  if (archivio === 'Secondaria') return riga.stoccaggio || '';
  if (archivio === 'Terziaria') return riga.unita_locale_origine || riga.ragione_sociale || '';
  return riga.trasportatore || '';
}

export const RUOLO_ORIGINE = {
  PrimariaRete: 'raccoglitore',
  PrimariaAci: 'raccoglitore',
  ExtraRaccolta: 'raccoglitore',
  Secondaria: 'stoccaggio che produce',
  Terziaria: 'impianto di partenza',
};

/**
 * Le rotte di un archivio, con le destinazioni di ciascuna origine ordinate per
 * numero di viaggi. `sospetta` e' vera dove la destinazione e' marginale.
 */
export function rotte(righe, archivio) {
  const per = new Map();
  for (const r of righe || []) {
    const origine = String(origineDi(r, archivio) || '').trim();
    const destinazione = String(r.destinazione || '').trim();
    if (!origine || !destinazione) continue;
    const ko = normalizzaRagioneSociale(origine);
    if (!per.has(ko)) per.set(ko, { origine, totale_viaggi: 0, totale_kg: 0, destinazioni: new Map() });
    const o = per.get(ko);
    o.totale_viaggi++;
    o.totale_kg += Number(r.peso_effettivo) || 0;
    const kd = normalizzaRagioneSociale(destinazione);
    if (!o.destinazioni.has(kd)) o.destinazioni.set(kd, { destinazione, viaggi: 0, kg: 0, righe: [] });
    const d = o.destinazioni.get(kd);
    d.viaggi++;
    d.kg += Number(r.peso_effettivo) || 0;
    d.righe.push(r);
  }
  return [...per.values()].map(o => ({
    origine: o.origine,
    ruolo: RUOLO_ORIGINE[archivio] || 'origine',
    totale_viaggi: o.totale_viaggi,
    totale_kg: Math.round(o.totale_kg),
    destinazioni: [...o.destinazioni.values()]
      .map(d => ({
        destinazione: d.destinazione,
        viaggi: d.viaggi,
        kg: Math.round(d.kg),
        quota: o.totale_viaggi ? d.viaggi / o.totale_viaggi : 0,
        sospetta: o.destinazioni.size > 1 && d.viaggi < VIAGGI_SOSPETTI && (d.viaggi / o.totale_viaggi) < QUOTA_SOSPETTA,
        righe: d.righe,
      }))
      .sort((a, b) => b.viaggi - a.viaggi),
  })).sort((a, b) => b.totale_viaggi - a.totale_viaggi);
}

/**
 * I movimenti che sembrano chiusi sulla destinazione sbagliata: uno o due viaggi
 * verso un impianto dove quell'origine non va mai.
 */
export function conferimentiSospetti(righe, archivio) {
  const fuori = [];
  for (const o of rotte(righe, archivio)) {
    const abituale = o.destinazioni.find(d => !d.sospetta);
    for (const d of o.destinazioni) {
      if (!d.sospetta) continue;
      for (const r of d.righe) {
        fuori.push({
          archivio,
          origine: o.origine,
          ruolo: o.ruolo,
          destinazione: d.destinazione,
          destinazione_abituale: abituale ? abituale.destinazione : '',
          numero_fir: r.numero_fir || '',
          id_ordine: r.id_ordine || '',
          giorno: giornoRoma(r.trasporto_finito_il),
          kg: Math.round(Number(r.peso_effettivo) || 0),
          viaggi_su_questa_destinazione: d.viaggi,
          viaggi_totali_origine: o.totale_viaggi,
          testo: `${o.origine} ha conferito a ${d.destinazione} ${d.viaggi === 1 ? 'una volta sola' : d.viaggi + ' volte'} su ${o.totale_viaggi} viaggi dell'anno`
            + (abituale ? `, mentre di norma conferisce a ${abituale.destinazione}` : '')
            + '. Controlla come e\' stato chiuso il formulario.',
        });
      }
    }
  }
  return fuori.sort((a, b) => String(a.giorno).localeCompare(String(b.giorno)));
}

/**
 * Quanto ciascun impianto riceve in secondaria da un dato stoccaggio, in quota.
 * Serve a dividere fra gli impianti quello che allo stoccaggio appartiene una
 * volta sola: il suo target di raccolta.
 */
export function quoteDaStoccaggio(secondarie, stoccaggio) {
  const k = normalizzaRagioneSociale(stoccaggio);
  const per = new Map();
  let totale = 0;
  for (const r of secondarie || []) {
    if (normalizzaRagioneSociale(r.stoccaggio) !== k) continue;
    const dest = String(r.destinazione || '').trim();
    if (!dest) continue;
    const kg = Number(r.peso_effettivo) || 0;
    const kd = normalizzaRagioneSociale(dest);
    if (!per.has(kd)) per.set(kd, { impianto: dest, kg: 0, viaggi: 0 });
    per.get(kd).kg += kg;
    per.get(kd).viaggi++;
    totale += kg;
  }
  return {
    stoccaggio,
    totale_kg: Math.round(totale),
    impianti: [...per.values()].map(x => ({
      impianto: x.impianto,
      kg: Math.round(x.kg),
      viaggi: x.viaggi,
      quota: totale > 0 ? x.kg / totale : 0,
    })).sort((a, b) => b.kg - a.kg),
  };
}
