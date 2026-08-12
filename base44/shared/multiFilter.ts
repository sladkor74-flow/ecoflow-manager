// Helper per filtri multi-selezione: gestisce sia valori singoli (string) che array.
// Ritorna true se il filtro è vuoto/null o se il valore del record è incluso nel filtro.
export function matchesFilter(recordValue: any, filterValue: any): boolean {
  if (filterValue == null || filterValue === '' || filterValue === false) return true;
  if (Array.isArray(filterValue)) {
    if (filterValue.length === 0) return true;
    return filterValue.includes(recordValue);
  }
  return recordValue === filterValue;
}

// Versione con conversione a String per confronti flessibili (es. settimane numeriche)
export function matchesFilterString(recordValue: any, filterValue: any): boolean {
  if (filterValue == null || filterValue === '' || filterValue === false) return true;
  const rv = String(recordValue);
  if (Array.isArray(filterValue)) {
    if (filterValue.length === 0) return true;
    return filterValue.map(String).includes(rv);
  }
  return rv === String(filterValue);
}

// Versione case-insensitive per confronti su stati normalizzati
export function matchesFilterLower(recordValue: any, filterValue: any): boolean {
  if (filterValue == null || filterValue === '' || filterValue === false) return true;
  const rv = String(recordValue || '').toLowerCase().trim();
  if (Array.isArray(filterValue)) {
    if (filterValue.length === 0) return true;
    return filterValue.map(v => String(v).toLowerCase().trim()).includes(rv);
  }
  return rv === String(filterValue).toLowerCase().trim();
}