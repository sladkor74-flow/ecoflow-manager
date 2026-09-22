import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { BASE_CONOSCENZA, FONTI_UFFICIALI, VERIFICATO_IL, scartaSuperate } from "../../shared/baseConoscenza.ts";

// Voci verificate della base di conoscenza, per mostrarle nella pagina Assistente:
// il frontend non puo' importare i file condivisi del backend.
//
// Quando la apre un amministratore, prima mette da parte cio' che e' superato da
// qualcosa di piu' recente (per esempio dopo una voce riscritta nel codice), con il
// motivo nello storico: cosi' la pagina mostra subito la situazione attuale.
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const messeDaParte = user.role === 'admin' ? await scartaSuperate(base44).catch(() => null) : null;
    return Response.json({ voci: BASE_CONOSCENZA, verificato_il: VERIFICATO_IL, fonti_ufficiali: FONTI_UFFICIALI, messe_da_parte: messeDaParte });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
