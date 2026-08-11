import { useState, useMemo } from 'react';

// Hook riusabile per ordinamento tabelle con un clic.
// Restituisce i record ordinati + stato (sortKey, sortDir) + toggleSort.
export function useTableSort(records, defaultKey = null, defaultDir = 'asc') {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);

  const sorted = useMemo(() => {
    if (!sortKey) return records;
    const arr = [...records].sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      // Campi data (stringhe ISO o Date)
      if (typeof av === 'string' && /^\d{4}-\d{2}-\d{2}/.test(av) && /^\d{4}-\d{2}-\d{2}/.test(bv)) {
        const da = new Date(av), db = new Date(bv);
        if (!isNaN(da) && !isNaN(db)) return da - db;
      }
      return String(av).localeCompare(String(bv), 'it');
    });
    return sortDir === 'desc' ? arr.reverse() : arr;
  }, [records, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return { sorted, sortKey, sortDir, toggleSort };
}