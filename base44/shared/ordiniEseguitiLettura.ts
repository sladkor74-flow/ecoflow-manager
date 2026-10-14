// LA LETTURA DEGLI ORDINI RIMASTI «ESEGUITO», PER LE FUNZIONI (14/10/2026).
//
// La regola sta in ordiniEseguiti.ts, con lo specchio per le pagine; la lettura
// sta qui, a parte, perche' le pagine non leggono archivi per nome
// (prove/tariffeRiservate.mjs) e perche' cosi' la regola resta senza client.
// La usano l'esito del caricamento delle primarie (importaBlocco, azione
// registra), quello di secondarie e terziarie (importEcotyreFile) e la dashboard
// (cruscottoOperativo).
import { fetchAll } from "./fetchAll.ts";
import { ARCHIVI_CON_ESEGUITI, FILTRO_ESEGUITI } from "./ordiniEseguiti.ts";

/**
 * Una lettura filtrata per stato per archivio, in parallelo: poche righe, di
 * solito nessuna, e mai una lettura per riga o per soggetto. Un archivio che non
 * risponde vale null, cioe' «non letto» (ordiniEseguiti lo mette in non_letti),
 * mai un elenco vuoto.
 * @param {object} entities base44.asServiceRole.entities
 * @param {string[]} nomi gli archivi da leggere (predefiniti: tutti e quattro)
 */
export async function leggiEseguiti(entities, nomi = ARCHIVI_CON_ESEGUITI) {
  const coppie = await Promise.all(nomi.map(async (n) => {
    try {
      const righe = await fetchAll(entities[n], FILTRO_ESEGUITI);
      return [n, Array.isArray(righe) ? righe : null];
    } catch (_e) {
      return [n, null];
    }
  }));
  return Object.fromEntries(coppie);
}
