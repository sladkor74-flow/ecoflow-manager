import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { fetchAll } from "../../shared/fetchAll.ts";
import { caricaMovimenti, oggiRoma } from "../../shared/reportSettimanali.ts";
import { eDichiarazione, ricontrollaDichiarazioni } from "../../shared/esitoVerifica.ts";

// Dopo un caricamento di primarie o secondarie riconfronta con i nuovi dati le
// dichiarazioni di "nessuna movimentazione" ancora in archivio: se ora risultano
// formulari si apre l'alert, se non risultano piu' si chiude.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const oggi = oggiRoma();
    const dichiarazioni = (await fetchAll(base44.asServiceRole.entities.VerificaReport, { file_tipo: 'dichiarazione' }))
      .filter(v => eDichiarazione(v) && !(v.scade_il && String(v.scade_il).slice(0, 10) <= oggi));
    if (!dichiarazioni.length) return Response.json({ ok: true, controllate: 0, aggiornate: 0 });

    const { movimenti } = await caricaMovimenti(base44);
    const aggiornate = await ricontrollaDichiarazioni(base44, dichiarazioni, movimenti);
    return Response.json({ ok: true, controllate: dichiarazioni.length, aggiornate });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
