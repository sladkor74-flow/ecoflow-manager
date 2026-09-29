import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { andamentoRaccoglitori, andamentoPerZona, proponiZona } from "../../shared/andamentoRaccoglitori.ts";
import { targetMensiliAnno, targetRaccoglitoreMese } from "../../shared/targetRaccoglitori.ts";
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

    const conTarget = andamentoRaccoglitori(primarieRete, {
      anno,
      zone: zoneTutte,
      nomi,
      // Il target di Target & Status e' scritto col nome del raccoglitore, spesso
      // abbreviato: targetRaccoglitoreMese lo riconosce per contenuto, quindi
      // serve il nome e non la chiave normalizzata. Un raccoglitore segnato
      // "non raccoglie" in quel mese non ha un target: null, non zero, altrimenti
      // risulterebbe inadempiente per un mese in cui non doveva raccogliere.
      targetPerMese: (_chiave, meseIdx, nome) => {
        if (!nome) return null;
        const t = targetRaccoglitoreMese(targetMensili, nome, MESI_MOVIMENTI[meseIdx]);
        return t && !t.non_raccoglie ? t.target_kg : null;
      },
    });

    return Response.json({
      andamento: conTarget,
      zone: andamentoPerZona(conTarget),
      // Per chi una zona non ce l'ha, le province da cui partire: si propongono,
      // non si applicano. Una zona dedotta non permetterebbe mai di dire «ha
      // raccolto fuori zona», che e' proprio la cosa che serve.
      proposte: conTarget.righe.filter(r => !r.zona_dichiarata).map(r => proponiZona(r)),
      zone_scritte: zoneTutte.filter(z => Number(z.anno) === anno).length,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
