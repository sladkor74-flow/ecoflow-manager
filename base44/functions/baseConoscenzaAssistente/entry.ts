import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { BASE_CONOSCENZA, FONTI_UFFICIALI, VERIFICATO_IL } from "../../shared/baseConoscenza.ts";

// Voci verificate della base di conoscenza, per mostrarle nella pagina Assistente:
// il frontend non puo' importare i file condivisi del backend.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({ voci: BASE_CONOSCENZA, verificato_il: VERIFICATO_IL, fonti_ufficiali: FONTI_UFFICIALI });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
