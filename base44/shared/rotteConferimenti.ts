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
// Due criteri, e il primo e' piu' forte del secondo.
//
// Chi ha un sito proprio conferisce in primaria solo li'. Nappi Sud raccoglie
// dai punti di raccolta e porta al piazzale di Nappi Sud, e a nessun altro:
// verso Irigom e Tecnogum ci va con le secondarie, dove non e' piu' un
// raccoglitore ma il produttore del rifiuto che parte dal suo piazzale. Una
// primaria di Nappi Sud verso Tecnogum non esistera' mai, e va segnalata anche
// se fossero cento viaggi: non e' una rotta rara, e' una rotta impossibile.
// Lo stesso vale per Green Tyre Project e per Gatim.
//
// Chi invece non ha un sito proprio stocca presso terzi, e puo' avere piu' di
// una rotta buona: C.L. Service stocca sia a Nappi Sud sia a T-Cycle. Per
// costoro vale il secondo criterio, statistico: una destinazione che raccoglie
// meno del 5% dei suoi viaggi E meno di cinque viaggi in tutto e' sospetta.
// Servono tutte e due le condizioni, altrimenti chi fa pochi viaggi in assoluto
// verrebbe segnalato sempre.
//
// Nelle primarie l'origine e' il raccoglitore (chi ritira e porta), nelle
// secondarie e' lo stoccaggio, che per quel viaggio e' il produttore: Nappi Sud,
// che raccoglie con un target suo, quando spedisce a Irigom o a Tecnogum non e'
// piu' un raccoglitore ma il produttore del rifiuto che parte dal suo piazzale.
//
// Le rotte si leggono sui terminati con la fine trasporto nell'anno. Un
// terminato a cui manca una data obbligatoria (immissione, inizio o fine
// trasporto: regola dell'utente del 22/09/2026) si dice: chi non ha la fine
// resta fuori dalle rotte e lo dice chi le mostra (controlloRotte); un
// conferimento sospetto a cui manca l'immissione o l'inizio lo porta scritto.

import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { giornoRoma } from "./giornoItaliano.ts";
import { eAci } from "./canaleSecondaria.ts";
import { dateDaSistemare, testoDate } from "./movimenti.ts";

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
  const primaria = archivio !== 'Secondaria' && archivio !== 'Terziaria';
  return [...per.values()].map(o => {
    const ko = normalizzaRagioneSociale(o.origine);
    // Ha un sito proprio se fra le sue destinazioni c'e' se stessa.
    const haSitoProprio = primaria && [...o.destinazioni.keys()].includes(ko);
    return {
      origine: o.origine,
      ruolo: RUOLO_ORIGINE[archivio] || 'origine',
      sito_proprio: haSitoProprio ? o.origine : '',
      totale_viaggi: o.totale_viaggi,
      totale_kg: Math.round(o.totale_kg),
      destinazioni: [...o.destinazioni.entries()]
        .map(([kd, d]) => ({
          destinazione: d.destinazione,
          viaggi: d.viaggi,
          kg: Math.round(d.kg),
          quota: o.totale_viaggi ? d.viaggi / o.totale_viaggi : 0,
          // Con un sito proprio, qualunque altra destinazione e' un errore, a
          // prescindere da quanti viaggi siano. Senza, vale la soglia.
          sospetta: haSitoProprio
            ? kd !== ko
            : o.destinazioni.size > 1 && d.viaggi < VIAGGI_SOSPETTI && (d.viaggi / o.totale_viaggi) < QUOTA_SOSPETTA,
          impossibile: haSitoProprio && kd !== ko,
          righe: d.righe,
        }))
        .sort((a, b) => b.viaggi - a.viaggi),
    };
  }).sort((a, b) => b.totale_viaggi - a.totale_viaggi);
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
      const testo = d.impossibile
        ? `${o.origine} raccoglie in primaria e conferisce al proprio sito, ${o.sito_proprio}: una primaria verso ${d.destinazione} non esiste. Verso gli altri impianti ci va con le secondarie, dove e' il produttore e non il raccoglitore. Questo formulario e' chiuso sulla destinazione sbagliata.`
        : `${o.origine} ha conferito a ${d.destinazione} ${d.viaggi === 1 ? 'una volta sola' : d.viaggi + ' volte'} su ${o.totale_viaggi} viaggi dell'anno`
            + (abituale ? `, mentre di norma conferisce a ${abituale.destinazione}` : '')
            + '. Controlla come e\' stato chiuso il formulario.';
      for (const r of d.righe) {
        fuori.push({
          archivio,
          origine: o.origine,
          ruolo: o.ruolo,
          destinazione: d.destinazione,
          destinazione_abituale: abituale ? abituale.destinazione : '',
          sito_proprio: o.sito_proprio || '',
          impossibile: !!d.impossibile,
          numero_fir: r.numero_fir || '',
          id_ordine: r.id_ordine || '',
          giorno: giornoRoma(r.trasporto_finito_il),
          kg: Math.round(Number(r.peso_effettivo) || 0),
          viaggi_su_questa_destinazione: d.viaggi,
          viaggi_totali_origine: o.totale_viaggi,
          testo,
          // le date obbligatorie che mancano o non tornano, solo se ce ne sono
          ...(dateDaSistemare(r) ? { date_da_sistemare: testoDate(r) } : {}),
        });
      }
    }
  }
  return fuori.sort((a, b) => String(a.giorno).localeCompare(String(b.giorno)));
}

/**
 * Chi conferisce su piu' di una destinazione con una tariffa sola.
 *
 * Il contratto puo' prevedere un prezzo per destinazione: Emmesse prende 72
 * euro la tonnellata se scarica a Gatim e 90 se scarica a Irigom. Con una sola
 * tariffa generica il gestionale paga tutto allo stesso prezzo e nessuno se ne
 * accorge - e' successo, 4 viaggi su Gatim pagati 90 invece di 72. Chi ha una
 * destinazione sola non ha il problema; chi ne ha due e una tariffa sola va
 * guardato, perche' o il contratto e' uniforme o manca un prezzo.
 *
 * @param {array} righe     i movimenti dell'anno di un archivio
 * @param {string} archivio nome dell'archivio
 * @param {array} tariffe   le tariffe attive della prestazione che interessa
 * @param {string} tipologia RETE, ACI o EXTRA_RACCOLTA
 */
export function tariffeDaVerificare(righe, archivio, tariffe, tipologia) {
  const k = (v) => normalizzaRagioneSociale(v);
  const attive = (tariffe || []).filter(t => String(t.stato || 'attivo') === 'attivo'
    && (!t.tipologia || t.tipologia === tipologia || t.tipologia === 'TUTTE'));
  const fuori = [];
  for (const o of rotte(righe, archivio)) {
    if (o.destinazioni.length < 2) continue;
    const sue = attive.filter(t => k(t.fornitore_nome) === k(o.origine));
    if (!sue.length) continue; // senza nessuna tariffa se ne occupa gia' l'anomalia della fatturazione
    const perDestinazione = sue.filter(t => t.destinazione);
    const generica = sue.find(t => !t.destinazione);
    const scoperte = o.destinazioni.filter(d => !perDestinazione.some(t => k(t.destinazione) === k(d.destinazione)));
    if (!scoperte.length) continue;
    fuori.push({
      origine: o.origine,
      tipologia,
      destinazioni: o.destinazioni.map(d => ({
        destinazione: d.destinazione,
        viaggi: d.viaggi,
        kg: d.kg,
        tariffa: (perDestinazione.find(t => k(t.destinazione) === k(d.destinazione)) || {}).valore ?? null,
      })),
      tariffa_generica: generica ? generica.valore : null,
      unita_misura: (generica || perDestinazione[0] || {}).unita_misura || '',
      destinazioni_senza_tariffa_propria: scoperte.map(d => d.destinazione),
      kg_in_gioco: scoperte.reduce((s, d) => s + d.kg, 0),
      testo: `${o.origine} conferisce su ${o.destinazioni.length} destinazioni `
        + `(${o.destinazioni.map(d => `${d.destinazione} ${d.viaggi} viaggi`).join(', ')}) `
        + (perDestinazione.length
          ? `ma per ${scoperte.map(d => d.destinazione).join(' e ')} non c'e' una tariffa propria: si paga la generica di ${generica ? generica.valore : '?'}.`
          : `e si paga tutto alla stessa tariffa, ${generica ? generica.valore : '?'}. `)
        + ` Controlla il contratto: se il prezzo cambia con la destinazione, la tariffa va inserita per ciascuna.`,
    });
  }
  return fuori.sort((a, b) => b.kg_in_gioco - a.kg_in_gioco);
}

/**
 * Quanto ciascun impianto riceve in secondaria da un dato stoccaggio, in quota.
 * Serve a dividere fra gli impianti quello che allo stoccaggio appartiene una
 * volta sola: il suo target di raccolta.
 *
 * Il target esiste solo per la rete, e allora anche le quote si misurano sulle
 * sole secondarie di rete: una secondaria ACI verso uno dei due impianti
 * sposterebbe la divisione di un target che l'ACI non ha. Si scarta qui, oltre
 * che in chi chiama (la predittivita' e il controllo delle rotte), cosi' la
 * regola non dipende da chi si ricorda di filtrare.
 */
export function quoteDaStoccaggio(secondarie, stoccaggio) {
  const k = normalizzaRagioneSociale(stoccaggio);
  const per = new Map();
  let totale = 0;
  for (const r of secondarie || []) {
    if (eAci(r)) continue;
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
