// Modulo condiviso per il calcolo del raccolto PFU aggregato dalle primarie.

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

export async function computeRaccoltoData(base44) {
  const [rete, aci] = await Promise.all([
    base44.asServiceRole.entities.PrimariaRete.list('-created_date', 10000),
    base44.asServiceRole.entities.PrimariaAci.list('-created_date', 10000)
  ]);

  const all = [...rete, ...aci];

  const byRaccoglitore: Record<string, any> = {};
  const byRegione: Record<string, any> = {};
  const byImpianto: Record<string, any> = {};
  let totale = 0;

  for (const p of all) {
    const raccoglitore = (p.trasportatore || 'N/D').trim();
    const regione = PROV_TO_REGION[(p.provincia || '').toUpperCase().trim()] || 'Altro';
    const dataChiusura = p.ordine_chiuso_il ? new Date(p.ordine_chiuso_il)
      : p.trasporto_finito_il ? new Date(p.trasporto_finito_il) : null;
    const meseIdx = dataChiusura ? dataChiusura.getMonth() : -1;
    const mese = meseIdx >= 0 ? MESI[meseIdx] : 'N/D';
    const peso = (p.peso_effettivo || 0) / 1000; // kg -> ton

    const rKey = `${raccoglitore}|||${regione}`;
    if (!byRaccoglitore[rKey]) {
      byRaccoglitore[rKey] = { raccoglitore, regione, totale: 0, mesi: {} };
      for (const m of MESI) byRaccoglitore[rKey].mesi[m] = 0;
    }
    byRaccoglitore[rKey].totale += peso;
    if (mese !== 'N/D') byRaccoglitore[rKey].mesi[mese] += peso;

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

  return {
    totale_raccolto: totale,
    by_raccoglitore: Object.values(byRaccoglitore),
    by_regione: Object.values(byRegione),
    by_impianto: Object.values(byImpianto)
  };
}