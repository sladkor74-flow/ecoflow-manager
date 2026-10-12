// LE VOCI DI «DA GESTIRE» NELLA PAGINA (migliorie dell'11/10/2026).
//
// Quasi tutte arrivano fatte da cruscottoOperativo (cruscotto.ts), con chiave,
// sezione e il permesso di chiedere a EcoTyna. Qui si aggiungono, solo per
// l'amministratore, quelle del margine (righe senza tariffa, anomalie in
// passiva), che la pagina chiede a parte e dopo; si mettono in fila con le
// altre e si contano per sezione. Funzioni pure e senza import: le prova
// prove/dashboardPagina.mjs.

const NOMI_CANALE = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
const GRAVITA = { critico: 0, attenzione: 1, info: 2 };

/**
 * Le voci del margine dell'anno scelto. Il titolo dice l'anno: il margine segue
 * l'anno in testa alla pagina, mentre il resto dell'elenco e' di oggi, e «Rete,
 * Settembre» senza anno guardando il 2025 si leggerebbe come il settembre di
 * adesso. A chi non e' amministratore niente: il margine non si chiede nemmeno.
 */
export function vociDalMargine(margine, isAdmin) {
  if (!isAdmin || !margine || !Array.isArray(margine.canali)) return [];
  const anno = margine.anno || '';
  const voci = [];
  for (const c of margine.canali) {
    const nome = NOMI_CANALE[c.canale] || c.canale;
    for (const m of c.mesi || []) {
      if (m.righe_senza_prezzo > 0) {
        voci.push({
          area: 'Fatturazione attiva', gravita: 'critico',
          titolo: `${nome}, ${m.mese} ${anno}: ${m.righe_senza_prezzo} ${m.righe_senza_prezzo === 1 ? 'riga' : 'righe'} senza tariffa`,
          dettaglio: 'Fatturate a zero euro finché la tariffa manca.', link: '/fatturazione',
          chiave: `margine:${c.canale}:${anno}:${m.mese}:senza-tariffa`, sezione: 'fatturazione', ecotyna: true,
        });
      }
      if (m.anomalie_passiva > 0) {
        voci.push({
          area: 'Fatturazione passiva', gravita: 'attenzione',
          titolo: `${nome}, ${m.mese} ${anno}: ${m.anomalie_passiva} ${m.anomalie_passiva === 1 ? 'anomalia' : 'anomalie'} in passiva`,
          dettaglio: 'Il dettaglio è nella fatturazione passiva del mese.', link: '/fatturazione',
          chiave: `passiva:${c.canale}:${anno}:${m.mese}`, sezione: 'economia', ecotyna: true,
        });
      }
    }
  }
  return voci;
}

/**
 * L'elenco unico: le voci del cruscotto e quelle del margine, per gravita' e
 * area, una volta sola ciascuna. Una chiave vista due volte (una risposta
 * ripetuta, una voce del margine uguale a una del cruscotto) tiene la prima:
 * l'elenco non dice mai due volte la stessa cosa, e la memoria delle nascoste
 * non confonde due voci con la stessa chiave.
 */
export function unisciVoci(...gruppi) {
  const viste = new Set();
  const tutte = [];
  for (const v of gruppi.flat()) {
    if (!v || !v.titolo) continue;
    const k = v.chiave || `${v.area}|${v.titolo}`;
    if (viste.has(k)) continue;
    viste.add(k);
    tutte.push({ ...v, chiave: k });
  }
  return tutte.sort((a, b) => (GRAVITA[a.gravita] ?? 3) - (GRAVITA[b.gravita] ?? 3) || String(a.area).localeCompare(String(b.area), 'it'));
}

/** Quante voci (visibili e nascoste) riguardano una sezione: il segno «2 da gestire». */
export const contaPerSezione = (voci, sezione) => (voci || []).filter(v => v && v.sezione === sezione).length;

// I CONTROLLI AUTOMATICI (revisione delle migliorie, 11/10/2026).
//
// «Controlli automatici», in fondo alla pagina, riassume le voci che dicono come
// stanno i lavori pianificati e le identita' fra moduli: i presidi (origine
// 'presidi': un lavoro che non riesce, un'identita' rotta) e la voce del
// cruscotto sul guardiano fermo (area Manutenzione), che c'e' quando il presidio
// non ha ancora la riga del suo lavoro, come il giorno della pubblicazione. Due
// difetti di prima:
// - si contavano solo i presidi: col guardiano fermo da quattro giorni la pagina
//   diceva insieme «non gira da 4 giorni» e «tutti regolari»;
// - il segno portava a Da gestire filtrato sulla sezione «dati», ma un'identita'
//   rotta sta negli impianti: «1 da gestire», e la lista filtrata vuota. La voce
//   critica non si vedeva.
// Ora il segno porta a un filtro suo, FILTRO_CONTROLLI, che mostra queste voci
// dovunque stiano, e il conto le chiama col loro nome.
export const FILTRO_CONTROLLI = 'controlli';
export const eControlloAutomatico = (v) => !!v && (v.origine === 'presidi' || v.area === 'Manutenzione');
/** Le voci dei controlli automatici: quante, quante identita' rotte, quanti lavori, quante critiche. */
export function riassuntoControlli(voci) {
  const c = (voci || []).filter(eControlloAutomatico);
  const identita = c.filter(v => String(v.chiave || '').startsWith('invariante:')).length;
  return { quante: c.length, identita, lavori: c.length - identita, critiche: c.filter(v => v.gravita === 'critico').length };
}
/** Se una voce passa il filtro del pannello: una sezione, o i controlli automatici. */
export const passaFiltro = (v, filtro) => !filtro || (filtro === FILTRO_CONTROLLI ? eControlloAutomatico(v) : !!v && v.sezione === filtro);
