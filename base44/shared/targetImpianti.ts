// Il target annuo di un impianto sta scritto in due posti, ed e' giusto cosi'
// (direzione, 20/09/2026): in Giacenze (GiacenzaSito.target_totale_t, tonnellate)
// serve a valutare la giacenza; in Target & Status (ImpiantoTargetSecondaria.target,
// chili) guida la programmazione delle secondarie. Valutano cose diverse, ma il
// numero deve essere lo stesso: se i due divergono va detto SEMPRE, in tutte e due
// le schermate e fra gli alert. Qui c'e' l'unico confronto, usato da tutti.
//
// Dal 26/09/2026 un record di ImpiantoTargetSecondaria vale un anno (il suo
// campo anno; senza anno vale il 2026, la regola di annoDelRecord in
// regolePredittivita.ts): i record degli anni chiusi restano attivi, perche' niente si
// cancella. Il confronto di un anno guarda quindi solo i record di quell'anno,
// altrimenti il target del 2026 divergerebbe per sempre dalla giacenza del 2027.
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { annoDelRecord } from "./regolePredittivita.ts";

export const TOLLERANZA_TARGET_KG = 1000;

const attivo = (imp) => imp && (!imp.stato || imp.stato === 'attivo');

/** [{ impianto, giacenze_t, target_status_t, differenza_t }] per gli impianti i cui due target dell'anno non coincidono. */
export function divergenzeTargetImpianti(giacenzeSito, impiantiTarget, anno) {
  const annoNum = Number(anno);
  const perSito = new Map();
  for (const g of giacenzeSito || []) {
    if (Number(g.anno) !== annoNum || String(g.tipo_destinazione || 'imp') !== 'imp') continue;
    if (Number(g.target_totale_t) > 0) perSito.set(normalizzaRagioneSociale(g.sito), g);
  }
  const fuori = [];
  for (const imp of impiantiTarget || []) {
    if (!attivo(imp) || annoDelRecord(imp) !== annoNum) continue;
    const g = perSito.get(normalizzaRagioneSociale(imp.nome_impianto));
    if (!g) continue;
    const giacenzeKg = Math.round(Number(g.target_totale_t) * 1000);
    const statusKg = Math.round(Number(imp.target) || 0);
    if (Math.abs(giacenzeKg - statusKg) < TOLLERANZA_TARGET_KG) continue;
    fuori.push({ impianto: g.sito || imp.nome_impianto, giacenze_t: giacenzeKg / 1000, target_status_t: statusKg / 1000, differenza_t: Math.round(giacenzeKg - statusKg) / 1000 });
  }
  return fuori;
}

/**
 * Il record di Target & Status che vale per ogni impianto in un anno, per nome
 * normalizzato: quello dell'anno, o se manca il piu' recente degli anni prima
 * (un contratto nuovo parte dal target dell'ultimo anno scritto). Mai quello di
 * un anno dopo. Fra due record dello stesso anno vale il piu' recente.
 * @returns {Map<string, object>}
 */
export function impiantiTargetDellAnno(impiantiTarget, anno) {
  const annoNum = Number(anno);
  const recente = (r) => String((r && (r.updated_date || r.created_date)) || '');
  const out = new Map();
  for (const imp of impiantiTarget || []) {
    if (!attivo(imp) || annoDelRecord(imp) > annoNum) continue;
    const k = normalizzaRagioneSociale(imp.nome_impianto);
    if (!k) continue;
    const prima = out.get(k);
    if (!prima || annoDelRecord(imp) > annoDelRecord(prima)
      || (annoDelRecord(imp) === annoDelRecord(prima) && recente(imp) > recente(prima))) out.set(k, imp);
  }
  return out;
}

export const testoDivergenza = (d) => `Il target di ${d.impianto} non coincide fra i moduli: in Giacenze vale ${d.giacenze_t} t, in Target & Status ${d.target_status_t} t (differenza ${d.differenza_t} t). I due numeri devono essere uguali: correggi quello sbagliato.`;
