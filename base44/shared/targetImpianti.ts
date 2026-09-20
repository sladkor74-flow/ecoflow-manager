// Il target annuo di un impianto sta scritto in due posti, ed e' giusto cosi'
// (direzione, 20/09/2026): in Giacenze (GiacenzaSito.target_totale_t, tonnellate)
// serve a valutare la giacenza; in Target & Status (ImpiantoTargetSecondaria.target,
// chili) guida la programmazione delle secondarie. Valutano cose diverse, ma il
// numero deve essere lo stesso: se i due divergono va detto SEMPRE, in tutte e due
// le schermate e fra gli alert. Qui c'e' l'unico confronto, usato da tutti.
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";

export const TOLLERANZA_TARGET_KG = 1000;

/** [{ impianto, giacenze_t, target_status_t, differenza_t }] per gli impianti i cui due target non coincidono. */
export function divergenzeTargetImpianti(giacenzeSito, impiantiTarget, anno) {
  const annoNum = Number(anno);
  const perSito = new Map();
  for (const g of giacenzeSito || []) {
    if (Number(g.anno) !== annoNum || String(g.tipo_destinazione || 'imp') !== 'imp') continue;
    if (Number(g.target_totale_t) > 0) perSito.set(normalizzaRagioneSociale(g.sito), g);
  }
  const fuori = [];
  for (const imp of impiantiTarget || []) {
    if (imp.stato && imp.stato !== 'attivo') continue;
    const g = perSito.get(normalizzaRagioneSociale(imp.nome_impianto));
    if (!g) continue;
    const giacenzeKg = Math.round(Number(g.target_totale_t) * 1000);
    const statusKg = Math.round(Number(imp.target) || 0);
    if (Math.abs(giacenzeKg - statusKg) < TOLLERANZA_TARGET_KG) continue;
    fuori.push({ impianto: g.sito || imp.nome_impianto, giacenze_t: giacenzeKg / 1000, target_status_t: statusKg / 1000, differenza_t: Math.round(giacenzeKg - statusKg) / 1000 });
  }
  return fuori;
}

export const testoDivergenza = (d) => `Il target di ${d.impianto} non coincide fra i moduli: in Giacenze vale ${d.giacenze_t} t, in Target & Status ${d.target_status_t} t (differenza ${d.differenza_t} t). I due numeri devono essere uguali: correggi quello sbagliato.`;
