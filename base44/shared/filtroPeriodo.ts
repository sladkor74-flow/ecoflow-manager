// Filtro periodo condiviso per fatturazione attiva e anteprima Ecotyre.
// Regola: stato="terminato" + trasporto_finito_il cade in anno/mese.
// Non usa mai i campi mese, anno o ordine_chiuso_il dei record per stabilire il periodo.
// Stessa regola gia' applicata da calcolaPassiva (non modificata).

const MESI_MAP = {
  'gennaio': 0, 'febbraio': 1, 'marzo': 2, 'aprile': 3, 'maggio': 4, 'giugno': 5,
  'luglio': 6, 'agosto': 7, 'settembre': 8, 'ottobre': 9, 'novembre': 10, 'dicembre': 11
};

// Converte il nome italiano del mese nell'indice 0-11.
// Gestisce anche un numero da 1 a 12 (1 = Gennaio). Restituisce -1 se non riconosciuto.
export function meseToIndice(mese) {
  if (typeof mese === 'number') {
    if (mese >= 1 && mese <= 12) return mese - 1;
    return -1;
  }
  const m = String(mese || '').toLowerCase().trim();
  if (MESI_MAP[m] !== undefined) return MESI_MAP[m];
  const n = Number(m);
  if (!isNaN(n) && n >= 1 && n <= 12) return n - 1;
  return -1;
}

// Restituisce i soli record che soddisfano entrambe le condizioni:
// - stato (minuscolo, trim) === "terminato"
// - trasporto_finito_il valorizzato, interpretabile come data, cade in anno/mese
// Scarta i record senza trasporto_finito_il.
export function filtraPeriodo(records, anno, mese) {
  const annoNum = Number(anno);
  const meseNum = meseToIndice(mese);
  if (meseNum < 0 || isNaN(annoNum)) return [];
  return (records || []).filter(r => {
    const stato = String(r.stato || '').toLowerCase().trim();
    if (stato !== 'terminato') return false;
    const d = r.trasporto_finito_il;
    if (!d) return false;
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return false;
    if (dt.getFullYear() !== annoNum) return false;
    if (dt.getMonth() !== meseNum) return false;
    return true;
  });
}