import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { andamentoRaccoglitori, andamentoPerZona, proponiZona } from "../../shared/andamentoRaccoglitori.ts";
import { targetMensiliAnno, targetRaccoglitoreMese, recordDelRaccoglitore } from "../../shared/targetRaccoglitori.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { MESI_MOVIMENTI } from "../../shared/movimenti.ts";

// L'andamento della raccolta di rete, raccoglitore per raccoglitore e zona per
// zona (richiesta dell'utente, 29/09/2026).
//
// SI CALCOLA OGNI VOLTA dall'archivio delle primarie: la fotografia e' sempre
// quella di adesso e si aggiorna da sola a ogni caricamento (regola 2), senza un
// archivio parallelo che puo' restare indietro. Il conto sta tutto in
// shared/andamentoRaccoglitori.ts; qui si leggono gli archivi e si risponde.
//
// Tre letture: le primarie di rete, i target mensili di Target & Status (la fonte
// unica dei target) e le zone dichiarate. Le zone possono non esserci: allora si
// mostra dove ciascuno ha raccolto e non si dice niente sul fuori zona.
//
// Risposte: 200 con { andamento, zone, proposte }; 401 a chi non e' entrato.

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const anno = Number(body.anno) || Number(String(new Date().toISOString()).slice(0, 4));
    const svc = base44.asServiceRole.entities;
    // Gli spazi, non la lettera «s» (audit del 10/10/2026): /s+/ trasformava «Emmesse
    // Srl» in «Emme e Srl» nell'avviso dei target ambigui, e fondeva nomi diversi
    // solo per una s.
    const pulisciNome = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

    const [primarieRete, zoneTutte, fornitori] = await Promise.all([
      fetchAll(svc.PrimariaRete),
      fetchAll(svc.ZonaRaccoglitore),
      fetchAll(svc.Fornitore, { stato: 'attivo' }),
    ]);
    // I target mensili vengono da Target & Status, che e' la fonte unica: qui non
    // si legge nessun altro target, altrimenti nascerebbe un secondo numero.
    const targetMensili = await targetMensiliAnno(base44, anno).catch(() => []);

    // Il nome per esteso viene dall'anagrafica quando c'e': sul portale lo stesso
    // soggetto compare scritto in modi diversi.
    const nomi = new Map();
    for (const f of fornitori) {
      const k = normalizzaRagioneSociale(f.ragione_sociale || '');
      if (k && !nomi.has(k)) nomi.set(k, f.ragione_sociale);
    }

    // CHI HA UN TARGET DEVE COMPARIRE anche se non ha raccolto niente: in un modulo
    // che serve a vedere chi sta rispettando il target, chi e' fermo a zero e'
    // l'unico che non deve sparire.
    const conTargetScritto = [...new Set((targetMensili || []).map(t => String(t.raccoglitore || '').trim()).filter(Boolean))]
      .map(nome => ({ nome }));

    // Un target scritto con un nome ABBREVIATO si riconosce per contenuto, e puo'
    // quindi valere per piu' soggetti del portale: allora lo stesso target
    // risulterebbe assegnato per intero a ciascuno, e la somma dei target mostrati
    // sarebbe il doppio di quelli scritti.
    //
    // L'IDENTITA' DI UN TARGET E' IL NOME SOTTO CUI E' SCRITTO, non il suo valore:
    // la prima stesura usava regione|mese|tonnellate, e due target DIVERSI con lo
    // stesso valore nella stessa regione collidevano, facendo gridare al lupo su
    // nomi che non c'entrano niente l'uno con l'altro (sui dati veri: "emmesse e
    // gatim", che non sono l'uno l'abbreviazione dell'altro).
    const consumiPerNomeTarget = new Map();

    const conTarget = andamentoRaccoglitori(primarieRete, {
      anno,
      zone: zoneTutte,
      nomi,
      conTarget: conTargetScritto,
      // Il target di Target & Status e' scritto col nome del raccoglitore, spesso
      // abbreviato: targetRaccoglitoreMese lo riconosce per contenuto, quindi
      // serve il nome e non la chiave normalizzata. Un raccoglitore segnato
      // "non raccoglie" in quel mese non ha un target: null, non zero, altrimenti
      // risulterebbe inadempiente per un mese in cui non doveva raccogliere.
      targetPerMese: (_chiave, meseIdx, nome) => {
        if (!nome) return null;
        const mese = MESI_MOVIMENTI[meseIdx];
        const t = targetRaccoglitoreMese(targetMensili, nome, mese);
        if (!t || t.non_raccoglie) return null;
        // Quali righe di Target & Status hanno alimentato questo raccoglitore: si
        // guarda il NOME sotto cui sono scritte, che e' la loro identita'.
        for (const rec of recordDelRaccoglitore(targetMensili.filter(x => x.mese === mese), nome)) {
          const nomeTarget = pulisciNome(rec.raccoglitore);
          if (!nomeTarget) continue;
          if (!consumiPerNomeTarget.has(nomeTarget)) consumiPerNomeTarget.set(nomeTarget, new Set());
          consumiPerNomeTarget.get(nomeTarget).add(nome);
        }
        return t.target_kg;
      },
    });

    // Ambiguo solo quando lo STESSO nome di target ha alimentato piu' soggetti
    // diversi del portale: quello e' il caso in cui i chili si contano due volte.
    const targetAmbigui = [...consumiPerNomeTarget.entries()]
      .filter(([, chi]) => chi.size > 1)
      .map(([nomeTarget, chi]) => ({ target: nomeTarget, raccoglitori: [...chi] }));

    return Response.json({
      andamento: conTarget,
      zone: andamentoPerZona(conTarget),
      // Per chi una zona non ce l'ha, le province da cui partire: si propongono,
      // non si applicano. Una zona dedotta non permetterebbe mai di dire «ha
      // raccolto fuori zona», che e' proprio la cosa che serve.
      proposte: conTarget.righe.filter(r => !r.zona_dichiarata).map(r => proponiZona(r)),
      zone_scritte: zoneTutte.filter(z => Number(z.anno) === anno).length,
      // Lo stesso target valso per piu' soggetti: i numeri di quelle righe non sono
      // affidabili, e tacerlo li farebbe leggere come buoni.
      target_ambigui: targetAmbigui,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
