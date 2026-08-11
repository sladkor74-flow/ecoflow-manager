// Mappatura provincia -> regione per uso frontend
export const PROV_TO_REGION = {
  'AO': "Valle d'Aosta",
  'AL': 'Piemonte', 'AT': 'Piemonte', 'BI': 'Piemonte', 'CN': 'Piemonte', 'NO': 'Piemonte',
  'TO': 'Piemonte', 'VB': 'Piemonte', 'VC': 'Piemonte',
  'BG': 'Lombardia', 'BS': 'Lombardia', 'CO': 'Lombardia', 'CR': 'Lombardia', 'LC': 'Lombardia',
  'LO': 'Lombardia', 'MN': 'Lombardia', 'MI': 'Lombardia', 'MB': 'Lombardia', 'PV': 'Lombardia',
  'SO': 'Lombardia', 'VA': 'Lombardia',
  'BZ': 'Trentino-Alto Adige', 'TN': 'Trentino-Alto Adige',
  'BL': 'Veneto', 'PD': 'Veneto', 'RO': 'Veneto', 'TV': 'Veneto', 'VE': 'Veneto', 'VR': 'Veneto', 'VI': 'Veneto',
  'GO': 'Friuli-Venezia Giulia', 'PN': 'Friuli-Venezia Giulia', 'TS': 'Friuli-Venezia Giulia', 'UD': 'Friuli-Venezia Giulia',
  'GE': 'Liguria', 'IM': 'Liguria', 'SP': 'Liguria', 'SV': 'Liguria',
  'BO': 'Emilia-Romagna', 'FE': 'Emilia-Romagna', 'FC': 'Emilia-Romagna', 'MO': 'Emilia-Romagna',
  'PR': 'Emilia-Romagna', 'PC': 'Emilia-Romagna', 'RA': 'Emilia-Romagna', 'RE': 'Emilia-Romagna', 'RN': 'Emilia-Romagna',
  'AR': 'Toscana', 'FI': 'Toscana', 'GR': 'Toscana', 'LI': 'Toscana', 'LU': 'Toscana',
  'MS': 'Toscana', 'PI': 'Toscana', 'PT': 'Toscana', 'PO': 'Toscana', 'SI': 'Toscana',
  'PG': 'Umbria', 'TR': 'Umbria',
  'AN': 'Marche', 'AP': 'Marche', 'FM': 'Marche', 'MC': 'Marche', 'PU': 'Marche',
  'FR': 'Lazio', 'LT': 'Lazio', 'RI': 'Lazio', 'RM': 'Lazio', 'VT': 'Lazio',
  'CH': 'Abruzzo', 'AQ': 'Abruzzo', 'PE': 'Abruzzo', 'TE': 'Abruzzo',
  'CB': 'Molise', 'IS': 'Molise',
  'AV': 'Campania', 'BN': 'Campania', 'CE': 'Campania', 'NA': 'Campania', 'SA': 'Campania',
  'BT': 'Puglia', 'BA': 'Puglia', 'BR': 'Puglia', 'FG': 'Puglia', 'LE': 'Puglia', 'TA': 'Puglia',
  'MT': 'Basilicata', 'PZ': 'Basilicata',
  'CS': 'Calabria', 'CZ': 'Calabria', 'KR': 'Calabria', 'RC': 'Calabria', 'VV': 'Calabria',
  'AG': 'Sicilia', 'CL': 'Sicilia', 'CT': 'Sicilia', 'EN': 'Sicilia', 'ME': 'Sicilia',
  'PA': 'Sicilia', 'RG': 'Sicilia', 'SR': 'Sicilia', 'TP': 'Sicilia',
  'CA': 'Sardegna', 'NU': 'Sardegna', 'OR': 'Sardegna', 'SS': 'Sardegna', 'SU': 'Sardegna', 'VS': 'Sardegna',
};

export function getRegioneFromProvincia(provincia) {
  return PROV_TO_REGION[(provincia || '').toUpperCase().trim()] || '';
}