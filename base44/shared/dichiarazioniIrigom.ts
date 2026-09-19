// Quanto dichiarare a portale per Irigom, e come comporre la dichiarazione.
//
// La regola, spiegata dall'amministratore: per decurtare dalle giacenze la
// quantita' giusta, si dichiara un quantitativo di PFU tale che a portale resti
// una giacenza pari alla somma del cippato e dei PFU interi che l'impianto ha in
// giacenza a fine mese - le celle AA e AC della riga del mese nel foglio Cons.
// del suo registro di carico e scarico.
//
//   da dichiarare = giacenza a portale prima della dichiarazione
//                   - (cippato in giacenza + interi in giacenza)
//
// Il quantitativo si compone di due materiali: il CSS-C uscito nel mese, che
// viaggia con DDT perche' ha cessato la qualifica di rifiuto, e i metalli
// ferrosi. Il CSS-C e' un dato di fatto - sono i DDT arancioni del registro -
// mentre il ferro e' la parte che si aggiusta per arrivare al quantitativo
// giusto, ed e' anche quella che va ripartita con le terziarie: il ferro uscito
// nel mese serve anche a loro, e alla dichiarazione va solo la sua quota.
//
// Il portale Ecotyre non accetta una dichiarazione di piu' di 38.000 kg: e' un
// limite suo, e ci si adatta. Ogni DDT di CSS-C porta quindi al massimo 13.000
// kg di ferro oltre ai suoi 25.000, e il ferro che avanza va in altre
// dichiarazioni di soli metalli, da 38.000 kg l'una finche' basta. Il numero di
// dichiarazioni non e' un problema: quello che deve tornare e' il totale.
//
// Specchio nel frontend: src/lib/dichiarazioniIrigom.js.

export const MAX_PER_DICHIARAZIONE_KG = 38000;

const arrotonda = (n) => Math.round(Number(n) || 0);

/**
 * Quanto dichiarare, dalla giacenza a portale e da quella del registro.
 *
 * @param {number} giacenzaPortaleKg  conferito non ancora dichiarato, dal portale
 * @param {number} giacenzaPfuKg      cippato + interi del mese, dal registro
 */
export function quantoDichiarare(giacenzaPortaleKg, giacenzaPfuKg) {
  const portale = arrotonda(giacenzaPortaleKg);
  const attesa = arrotonda(giacenzaPfuKg);
  return { da_dichiarare_kg: portale - attesa, giacenza_portale_kg: portale, giacenza_attesa_kg: attesa };
}

/**
 * Compone la dichiarazione del mese: per ogni DDT di CSS-C la sua quota di
 * ferro, senza sforare il limite di una dichiarazione.
 *
 * Il totale e' quello che conta per il portale; la suddivisione del ferro fra i
 * DDT e' una proposta, che si puo' correggere seguendo i formulari veri del
 * ferro uscito nel mese.
 *
 * @param {number} daDichiarareKg  quanto serve dichiarare in tutto
 * @param {array}  ddt             [{ data, ddt, kg }] le uscite di CSS-C del mese
 * @param {object} opzioni         { maxPerDichiarazione, ferroDisponibileKg }
 */
export function componiDichiarazione(daDichiarareKg, ddt, opzioni = {}) {
  const maxTot = Number(opzioni.maxPerDichiarazione) || MAX_PER_DICHIARAZIONE_KG;
  const righe = (ddt || []).map(d => ({ data: d.data, ddt: d.ddt, cssc_kg: arrotonda(d.kg), ferro_kg: 0 }));
  const cssc = righe.reduce((s, r) => s + r.cssc_kg, 0);
  const daDichiarare = arrotonda(daDichiarareKg);
  const ferroServe = daDichiarare - cssc;
  const avvisi = [];

  // Quanto ferro puo' stare nei DDT di CSS-C, rispettando il limite del portale.
  const capienza = righe.reduce((s, r) => s + Math.max(0, maxTot - r.cssc_kg), 0);
  let ferroDaMettere = Math.max(0, Math.min(ferroServe, capienza));

  // Si riempie in modo uniforme, senza superare il limite di nessuna riga.
  // Si ripassa finche' c'e' ferro da mettere e capienza dove metterlo.
  for (let giro = 0; giro < 10 && ferroDaMettere > 0; giro++) {
    const conSpazio = righe.filter(r => r.cssc_kg + r.ferro_kg < maxTot);
    if (!conSpazio.length) break;
    const quota = Math.floor(ferroDaMettere / conSpazio.length);
    if (quota <= 0) {
      // Gli ultimi chili vanno sulla prima riga che li accetta.
      for (const r of conSpazio) {
        const spazio = maxTot - r.cssc_kg - r.ferro_kg;
        const metto = Math.min(spazio, ferroDaMettere);
        r.ferro_kg += metto;
        ferroDaMettere -= metto;
        if (ferroDaMettere <= 0) break;
      }
      break;
    }
    for (const r of conSpazio) {
      const spazio = maxTot - r.cssc_kg - r.ferro_kg;
      const metto = Math.min(spazio, quota, ferroDaMettere);
      r.ferro_kg += metto;
      ferroDaMettere -= metto;
    }
  }

  for (const r of righe) { r.totale_kg = r.cssc_kg + r.ferro_kg; r.tipo = 'cssc'; }

  // Il ferro che non entra nei DDT di CSS-C va in dichiarazioni di soli metalli,
  // da 38.000 kg l'una: il portale non ne accetta di piu' e ci si adatta.
  let avanza = Math.max(0, ferroServe - righe.reduce((s, r) => s + r.ferro_kg, 0));
  let n = 0;
  while (avanza > 0 && n < 200) {
    const kg = Math.min(maxTot, avanza);
    righe.push({ data: '', ddt: '', cssc_kg: 0, ferro_kg: kg, totale_kg: kg, tipo: 'ferro' });
    avanza -= kg;
    n++;
  }

  const ferroMesso = righe.reduce((s, r) => s + r.ferro_kg, 0);
  const totale = righe.reduce((s, r) => s + r.totale_kg, 0);
  const soloFerro = righe.filter(r => r.tipo === 'ferro').length;

  if (ferroServe < 0) {
    avvisi.push(`Il CSS-C uscito nel mese, ${cssc} kg, e' piu' di quello che serve dichiarare, ${daDichiarare} kg: controlla la giacenza a portale e il mese di riferimento, perche' dichiarando tutto il CSS-C si scenderebbe sotto la giacenza attesa.`);
  }
  if (soloFerro > 0) {
    avvisi.push(`Il ferro non entra tutto nei DDT di CSS-C: servono altre ${soloFerro} ${soloFerro === 1 ? 'dichiarazione' : 'dichiarazioni'} di soli metalli, perche' il portale non accetta piu' di ${maxTot} kg per dichiarazione.`);
  }
  if (!ddt.length && daDichiarare > 0) {
    avvisi.push('Questo mese non ci sono uscite di CSS-C della nostra commessa: si dichiarano soltanto metalli.');
  }

  return {
    righe,
    cssc_kg: cssc,
    ferro_kg: ferroMesso,
    ferro_necessario_kg: Math.max(0, ferroServe),
    dichiarazioni: righe.length,
    dichiarazioni_solo_ferro: soloFerro,
    totale_kg: totale,
    da_dichiarare_kg: daDichiarare,
    differenza_kg: totale - daDichiarare,
    avvisi,
  };
}

/**
 * La quota di ferro che spetta alla dichiarazione, sul ferro uscito nel mese:
 * il resto e' delle terziarie. Serve a dire se il ferro che si sta dichiarando
 * sta dentro quello che l'impianto ha davvero fatto uscire.
 */
export function quotaFerro(ferroDichiaratoKg, ferroUscitoMeseKg) {
  const dich = arrotonda(ferroDichiaratoKg);
  const uscito = arrotonda(ferroUscitoMeseKg);
  return {
    dichiarato_kg: dich,
    uscito_kg: uscito,
    terziarie_kg: Math.max(0, uscito - dich),
    quota: uscito > 0 ? Math.round((dich / uscito) * 1000) / 10 : 0,
    eccede: dich > uscito,
  };
}
