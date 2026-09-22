// Modulo condiviso per il calcolo del raccolto PFU aggregato dalle primarie.
import { fetchAll } from "./fetchAll.ts";
import { annoRoma, meseRoma } from "./giornoItaliano.ts";
import { DATE_OBBLIGATORIE, dateMancanti, dateIncoerenti, dateDaSistemare, testoDate, eTerminato, giornoMovimento } from "./movimenti.ts";

export const PROV_TO_REGION: Record<string, string> = {
  // Valle d'Aosta
  'AO': "Valle d'Aosta",
  // Piemonte
  'AL': 'Piemonte', 'AT': 'Piemonte', 'BI': 'Piemonte', 'CN': 'Piemonte', 'NO': 'Piemonte',
  'TO': 'Piemonte', 'VB': 'Piemonte', 'VC': 'Piemonte',
  // Lombardia
  'BG': 'Lombardia', 'BS': 'Lombardia', 'CO': 'Lombardia', 'CR': 'Lombardia', 'LC': 'Lombardia',
  'LO': 'Lombardia', 'MN': 'Lombardia', 'MI': 'Lombardia', 'MB': 'Lombardia', 'PV': 'Lombardia',
  'SO': 'Lombardia', 'VA': 'Lombardia',
  // Trentino-Alto Adige
  'BZ': 'Trentino-Alto Adige', 'TN': 'Trentino-Alto Adige',
  // Veneto
  'BL': 'Veneto', 'PD': 'Veneto', 'RO': 'Veneto', 'TV': 'Veneto', 'VE': 'Veneto', 'VR': 'Veneto', 'VI': 'Veneto',
  // Friuli-Venezia Giulia
  'GO': 'Friuli-Venezia Giulia', 'PN': 'Friuli-Venezia Giulia', 'TS': 'Friuli-Venezia Giulia', 'UD': 'Friuli-Venezia Giulia',
  // Liguria
  'GE': 'Liguria', 'IM': 'Liguria', 'SP': 'Liguria', 'SV': 'Liguria',
  // Emilia-Romagna
  'BO': 'Emilia-Romagna', 'FE': 'Emilia-Romagna', 'FC': 'Emilia-Romagna', 'MO': 'Emilia-Romagna',
  'PR': 'Emilia-Romagna', 'PC': 'Emilia-Romagna', 'RA': 'Emilia-Romagna', 'RE': 'Emilia-Romagna', 'RN': 'Emilia-Romagna',
  // Toscana
  'AR': 'Toscana', 'FI': 'Toscana', 'GR': 'Toscana', 'LI': 'Toscana', 'LU': 'Toscana',
  'MS': 'Toscana', 'PI': 'Toscana', 'PT': 'Toscana', 'PO': 'Toscana', 'SI': 'Toscana',
  // Umbria
  'PG': 'Umbria', 'TR': 'Umbria',
  // Marche
  'AN': 'Marche', 'AP': 'Marche', 'FM': 'Marche', 'MC': 'Marche', 'PU': 'Marche',
  // Lazio
  'FR': 'Lazio', 'LT': 'Lazio', 'RI': 'Lazio', 'RM': 'Lazio', 'VT': 'Lazio',
  // Abruzzo
  'CH': 'Abruzzo', 'AQ': 'Abruzzo', 'PE': 'Abruzzo', 'TE': 'Abruzzo',
  // Molise
  'CB': 'Molise', 'IS': 'Molise',
  // Campania
  'AV': 'Campania', 'BN': 'Campania', 'CE': 'Campania', 'NA': 'Campania', 'SA': 'Campania',
  // Puglia
  'BT': 'Puglia', 'BA': 'Puglia', 'BR': 'Puglia', 'FG': 'Puglia', 'LE': 'Puglia', 'TA': 'Puglia',
  // Basilicata
  'MT': 'Basilicata', 'PZ': 'Basilicata',
  // Calabria
  'CS': 'Calabria', 'CZ': 'Calabria', 'KR': 'Calabria', 'RC': 'Calabria', 'VV': 'Calabria',
  // Sicilia
  'AG': 'Sicilia', 'CL': 'Sicilia', 'CT': 'Sicilia', 'EN': 'Sicilia', 'ME': 'Sicilia',
  'PA': 'Sicilia', 'RG': 'Sicilia', 'SR': 'Sicilia', 'TP': 'Sicilia',
  // Sardegna
  'CA': 'Sardegna', 'NU': 'Sardegna', 'OR': 'Sardegna', 'SS': 'Sardegna', 'SU': 'Sardegna', 'VS': 'Sardegna',
};

export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

// --- Le date da sistemare dei terminati ---
//
// Immissione, inizio e fine trasporto sono obbligatorie in ogni formulario, e
// dove mancano o non tornano si segnala: in ogni modulo dove ci sono ordini
// terminati, non solo nei report settimanali (regola dell'utente, 22/09/2026).
// La regola sta in movimenti.ts (dateMancanti, dateIncoerenti, testoDate): qui
// si contano soltanto i casi, perche' ogni conto dica quanti sono e quali.
// Stanno qui e non in dataEnrichment.ts perche' questo modulo non importa
// nessun altro modulo dei conti, e lo leggono tutti senza giri circolari.
//
// Un canale per volta: chi conta passa i movimenti del canale che guarda e, se
// ne guarda piu' d'uno, chiama una volta per canale. Rete, ACI ed extra raccolta
// non si sommano mai, nemmeno in questo conteggio.

const intero = (n: number) => Number(n || 0).toLocaleString('it-IT');

/**
 * Il riepilogo delle date da sistemare fra i movimenti passati:
 * { totale, senza_fine_trasporto, mancanti: { immissione, 'inizio trasporto',
 * 'fine trasporto' }, incoerenti, esempi, testo }. Un ordine a cui mancano due
 * date conta una volta nel totale e una in ciascuna voce di mancanti; testo e'
 * il dettaglio a parole ("3 senza fine trasporto, 1 con date incoerenti").
 * Gli ordini non terminati non si giudicano (dateDaSistemare).
 */
export function riepilogoDate(records, maxEsempi = 10) {
  const mancanti: Record<string, number> = Object.fromEntries(DATE_OBBLIGATORIE.map(d => [d.nome, 0]));
  const nomeFine = (DATE_OBBLIGATORIE.find(d => d.campo === 'trasporto_finito_il') || { nome: 'fine trasporto' }).nome;
  let totale = 0;
  let incoerenti = 0;
  const esempi = [];
  for (const r of records || []) {
    if (!dateDaSistemare(r)) continue;
    totale++;
    for (const nome of dateMancanti(r)) mancanti[nome] = (mancanti[nome] || 0) + 1;
    if (dateIncoerenti(r).length) incoerenti++;
    if (esempi.length < maxEsempi) {
      esempi.push({
        id_ordine: r.id_ordine || '',
        numero_fir: r.numero_fir || '',
        trasportatore: String(r.trasportatore || '').trim(),
        regione: r.regione || PROV_TO_REGION[String(r.provincia || '').toUpperCase().trim()] || '',
        stoccaggio: r.stoccaggio || r.unita_locale_origine || r.produttore || '',
        destinazione: r.destinazione || '',
        fine_trasporto: giornoMovimento(r),
        testo: testoDate(r),
      });
    }
  }
  const parti = DATE_OBBLIGATORIE.filter(d => mancanti[d.nome] > 0).map(d => `${intero(mancanti[d.nome])} senza ${d.nome}`);
  if (incoerenti) parti.push(`${intero(incoerenti)} con date incoerenti`);
  return { totale, senza_fine_trasporto: mancanti[nomeFine] || 0, mancanti, incoerenti, esempi, testo: parti.join(', ') };
}

/**
 * Le date da sistemare di una vista. tutti: i movimenti che la vista potrebbe
 * mostrare, prima dei filtri di periodo; contati: quelli che conta nel suo
 * periodo. Un terminato senza fine trasporto non ha periodo e nessun filtro di
 * periodo lo prende: si prende fra tutti, di qualunque anno, ed e' escluso dai
 * conti. Gli altri si prendono fra i contati: sono nei numeri, nel mese della
 * loro fine trasporto, ma hanno un'altra data che manca o non torna.
 */
export function riepilogoDateVista(tutti, contati, maxEsempi = 10) {
  const senzaFine = (tutti || []).filter(r => eTerminato(r) && !giornoMovimento(r));
  return riepilogoDate([...senzaFine, ...(contati || []).filter(r => giornoMovimento(r))], maxEsempi);
}

// RETE, ACI ed EXTRA RACCOLTA sono canali indipendenti: non si sommano mai e i
// target (raccoglitori, regioni, contratto, impianti) si confrontano solo con la
// RETE. filters.canale sceglie il canale: 'rete' (predefinito) oppure 'aci'.
// opzioni.esempiDate: quanti ordini con le date da sistemare elencare (10; chi
// li scrive in un file li vuole tutti).
export async function computeRaccoltoData(base44, filters: any = {}, opzioni: any = {}) {
  const canale = String(filters.canale || 'rete').toLowerCase() === 'aci' ? 'aci' : 'rete';
  const [rete, aci] = await Promise.all([
    canale === 'rete' ? fetchAll(base44.asServiceRole.entities.PrimariaRete) : Promise.resolve([]),
    canale === 'aci' ? fetchAll(base44.asServiceRole.entities.PrimariaAci) : Promise.resolve([]),
  ]);

  // Come in tutto il gestionale: solo i terminati, nel mese della fine trasporto
  // letta sul giorno italiano. Una data che non si legge non fa periodo, come
  // una data che manca.
  const archivio = canale === 'aci' ? aci : rete;
  const all = archivio.filter((p: any) => eTerminato(p) && giornoMovimento(p));

  // Normalize filters to arrays
  const toArray = (v: any) => Array.isArray(v) ? v : (v != null ? [v] : []);
  const fAnno = toArray(filters.anno).map(Number);
  const fMese = toArray(filters.mese);
  const fRegione = toArray(filters.regione);
  const fRaccoglitore = toArray(filters.raccoglitore);
  const fImpianto = toArray(filters.impianto);

  // Filter options from ALL records
  const filterOptions = {
    anni: [...new Set(all.map((p: any) => {
      return annoRoma(p.trasporto_finito_il);
    }).filter(Boolean))].sort((a: any, b: any) => b - a),
    mesi: MESI,
    regioni: [...new Set(all.map((p: any) => PROV_TO_REGION[(p.provincia || '').toUpperCase().trim()] || 'Altro').filter(Boolean))].sort(),
    raccoglitori: [...new Set(all.map((p: any) => (p.trasportatore || '').trim()).filter(Boolean))].sort(),
    impianti: [...new Set(all.map((p: any) => (p.destinazione || '').trim()).filter(Boolean))].sort(),
  };

  // Filter records
  const filtered = all.filter((p: any) => {
    const raccoglitore = (p.trasportatore || 'N/D').trim();
    const regione = PROV_TO_REGION[(p.provincia || '').toUpperCase().trim()] || 'Altro';
    const meseIdx = meseRoma(p.trasporto_finito_il);
    const mese = meseIdx >= 0 ? MESI[meseIdx] : 'N/D';
    const anno = annoRoma(p.trasporto_finito_il);
    const impianto = (p.destinazione || 'N/D').trim();

    if (fAnno.length > 0 && !fAnno.includes(anno)) return false;
    if (fMese.length > 0 && !fMese.includes(mese)) return false;
    if (fRegione.length > 0 && !fRegione.includes(regione)) return false;
    if (fRaccoglitore.length > 0 && !fRaccoglitore.includes(raccoglitore)) return false;
    if (fImpianto.length > 0 && !fImpianto.includes(impianto)) return false;
    return true;
  });

  const byRaccoglitore: Record<string, any> = {};
  const byRaccoglitoreImpianto: Record<string, any> = {};
  const byRegione: Record<string, any> = {};
  const byImpianto: Record<string, any> = {};
  let totale = 0;

  for (const p of filtered) {
    const raccoglitore = (p.trasportatore || 'N/D').trim();
    const regione = PROV_TO_REGION[(p.provincia || '').toUpperCase().trim()] || 'Altro';
    const meseIdx = meseRoma(p.trasporto_finito_il);
    const mese = meseIdx >= 0 ? MESI[meseIdx] : 'N/D';
    const peso = (p.peso_effettivo || 0) / 1000; // kg -> ton

    const rKey = `${raccoglitore}|||${regione}`;
    if (!byRaccoglitore[rKey]) {
      byRaccoglitore[rKey] = { raccoglitore, regione, totale: 0, mesi: {} };
      for (const m of MESI) byRaccoglitore[rKey].mesi[m] = 0;
    }
    byRaccoglitore[rKey].totale += peso;
    if (mese !== 'N/D') byRaccoglitore[rKey].mesi[mese] += peso;

    // Raccoglitore, regione e impianto di destinazione: la vista Report Generale.
    const destinazione = (p.destinazione || 'N/D').trim();
    const riKey = `${rKey}|||${destinazione}`;
    if (!byRaccoglitoreImpianto[riKey]) {
      byRaccoglitoreImpianto[riKey] = { raccoglitore, regione, impianto: destinazione, totale: 0, mesi: {} };
      for (const m of MESI) byRaccoglitoreImpianto[riKey].mesi[m] = 0;
    }
    byRaccoglitoreImpianto[riKey].totale += peso;
    if (mese !== 'N/D') byRaccoglitoreImpianto[riKey].mesi[mese] += peso;

    if (!byRegione[regione]) {
      byRegione[regione] = { regione, totale: 0, mesi: {} };
      for (const m of MESI) byRegione[regione].mesi[m] = 0;
    }
    byRegione[regione].totale += peso;
    if (mese !== 'N/D') byRegione[regione].mesi[mese] += peso;

    const impianto = (p.destinazione || 'N/D').trim();
    if (!byImpianto[impianto]) {
      byImpianto[impianto] = { impianto, totale: 0, mesi: {} };
      for (const m of MESI) byImpianto[impianto].mesi[m] = 0;
    }
    byImpianto[impianto].totale += peso;
    if (mese !== 'N/D') byImpianto[impianto].mesi[mese] += peso;

    totale += peso;
  }

  // Le date da sistemare del canale (regola del 22/09/2026): i terminati senza
  // fine trasporto, di qualunque anno e fuori dal raccolto, e quelli contati qui
  // con un'altra data che manca o non torna. Solo i filtri che non sono di
  // periodo valgono anche per i primi: un periodo non l'hanno.
  const passaNonPeriodo = (p: any) => {
    const regione = PROV_TO_REGION[(p.provincia || '').toUpperCase().trim()] || 'Altro';
    if (fRegione.length > 0 && !fRegione.includes(regione)) return false;
    if (fRaccoglitore.length > 0 && !fRaccoglitore.includes((p.trasportatore || 'N/D').trim())) return false;
    if (fImpianto.length > 0 && !fImpianto.includes((p.destinazione || 'N/D').trim())) return false;
    return true;
  };
  const date_da_sistemare = riepilogoDateVista(archivio.filter(passaNonPeriodo), filtered, opzioni.esempiDate ?? 10);

  return {
    canale,
    date_da_sistemare,
    totale_raccolto: totale,
    by_raccoglitore: Object.values(byRaccoglitore),
    by_raccoglitore_impianto: Object.values(byRaccoglitoreImpianto),
    by_regione: Object.values(byRegione),
    by_impianto: Object.values(byImpianto),
    filterOptions,
  };
}