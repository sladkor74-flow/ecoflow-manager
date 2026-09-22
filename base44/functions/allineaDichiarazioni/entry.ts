import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { allineaDalPortale } from "../../shared/agganciaDichiarazioni.ts";

// Riconosce nelle nostre dichiarazioni mensili quelle gia' caricate a portale.
//
// Il report delle dichiarazioni di trattamento dice, per ogni caricamento, il
// giorno e i materiali che ne sono usciti. I pesi coincidono al chilo con le
// nostre righe mensili: da li' si capisce quale mese e' stato caricato e quando,
// e non c'e' piu' bisogno di segnarlo a mano impianto per impianto.
//
// Gira da solo dopo ogni caricamento del report; questa funzione serve per
// rifarlo su richiesta.
//
// Payload: { anno }
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo l\'amministratore puo\' allineare le dichiarazioni' }, { status: 403 });

    const { anno } = await req.json().catch(() => ({}));
    if (!anno) return Response.json({ error: 'Anno obbligatorio' }, { status: 400 });

    const esito = await allineaDalPortale(base44.asServiceRole.entities, Number(anno));
    return Response.json({ ok: true, ...esito });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
