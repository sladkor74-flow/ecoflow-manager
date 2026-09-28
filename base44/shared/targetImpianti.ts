// Il target annuo di un impianto si scrive in un posto solo, Target & Status
// (ImpiantoTargetSecondaria.target, chili), anno per anno; Giacenze e la
// predittivita' lo leggono da li' (decisione dell'utente, 27/09/2026). Il vecchio
// confronto fra il target di Giacenze e quello di Target & Status non serve piu'.
//
// Un record di ImpiantoTargetSecondaria vale un anno (il suo campo anno; senza
// anno vale il 2026, la regola di annoDelRecord in regolePredittivita.ts): i
// record degli anni chiusi restano attivi, perche' niente si cancella. Il target
// di esattamente un anno si legge con targetImpiantoDellAnno (annoTarget.ts);
// qui resta la lettura con il ripiego sugli anni prima, per chi prepara i
// contratti di un anno non ancora scritto.
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { annoDelRecord } from "./regolePredittivita.ts";
import { targetImpiantoDellAnno, targetPrimarieDelSito, recordDellAnno } from "./annoTarget.ts";

const attivo = (imp) => imp && (!imp.stato || imp.stato === 'attivo');

/**
 * Il record di Target & Status che vale per ogni impianto in un anno, per nome
 * normalizzato: quello dell'anno, o se manca il piu' recente degli anni prima
 * (un contratto nuovo parte dal target dell'ultimo anno scritto). Mai quello di
 * un anno dopo. Fra due record dello stesso anno vale il piu' recente. L'anno da
 * cui viene il record lo dice annoDelRecord(record).
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

/**
 * I due target di una riga di Giacenze (tonnellate), letti da Target & Status:
 * - target_totale_t, solo per gli impianti: il target dell'impianto di
 *   esattamente quell'anno (ImpiantoTargetSecondaria, chili, con
 *   targetImpiantoDellAnno);
 * - target_primarie_t: la somma dei target dei raccoglitori di quell'anno legati
 *   al sito (TargetRaccoglitore.impianto, con targetPrimarieDelSito). I
 *   raccoglitori non dicono se portano all'impianto o allo stoccaggio: la somma va
 *   su una riga sola del sito (primarieQui), di norma quella dell'impianto, perche'
 *   il totale non la conti due volte.
 *
 * Transizione (27/09/2026): finche' un numero e' scritto solo nel vecchio campo di
 * Giacenze (GiacenzaSito.target_totale_t / target_primarie_t) si usa quello, e
 * da_portare lo dice, per chiedere di portarlo in Target & Status. Per le
 * primarie il vecchio campo vale solo se il sito, in Target & Status, non ne ha.
 *
 * da_portare.spento: il target e' in Giacenze perche' l'impianto, in Target &
 * Status, per quell'anno c'e' ma non e' attivo.
 *
 * @returns {{ target_totale_t: number, target_primarie_t: number, da_portare: { totale: boolean, primarie: boolean, spento: boolean }, record: object|null }}
 */
export function targetRigaGiacenze({ sito, td, anno, giacenzaSito = null, impiantiTarget = [], raccoglitori = [], primarieQui = td === 'imp', chiave = normalizzaRagioneSociale }) {
  const da_portare = { totale: false, primarie: false, spento: false };
  let target_totale_t = 0;
  let record = null;
  if (td === 'imp') {
    const t = targetImpiantoDellAnno(impiantiTarget, sito, anno, chiave);
    if (t) record = t.record;
    // un record attivo con target zero o vuoto non cancella il target scritto in
    // Giacenze (28/09/2026): finche' in Target & Status non c'e' un numero vale il vecchio
    if (t && t.kg > 0) target_totale_t = t.kg / 1000;
    else if (Number(giacenzaSito?.target_totale_t) > 0) {
      target_totale_t = Number(giacenzaSito.target_totale_t);
      da_portare.totale = true;
      // l'impianto c'e' in Target & Status per quell'anno, ma e' spento: va riacceso a mano
      const k = chiave(sito);
      da_portare.spento = !t && !!k && recordDellAnno(impiantiTarget, anno).some(r => chiave(r.nome_impianto) === k);
    }
  }
  let target_primarie_t = 0;
  const somma = targetPrimarieDelSito(raccoglitori, sito, anno, chiave);
  if (somma > 0) target_primarie_t = primarieQui ? somma : 0;
  else if (Number(giacenzaSito?.target_primarie_t) > 0) { target_primarie_t = Number(giacenzaSito.target_primarie_t); da_portare.primarie = true; }
  return { target_totale_t, target_primarie_t, da_portare, record };
}

/** Il testo dell'anomalia di un target ancora scritto solo in Giacenze. */
export const testoTargetDaPortare = (cosa = 'totale') => (cosa === 'primarie'
  ? "target delle primarie ancora scritto in Giacenze: scrivi i target dei raccoglitori in Target & Status"
  : cosa === 'spento'
    ? "target ancora scritto in Giacenze: in Target & Status l'impianto c'e' ma non e' attivo, riattivalo a mano e scrivi li' il target"
    : "target ancora scritto in Giacenze: portalo in Target & Status");
