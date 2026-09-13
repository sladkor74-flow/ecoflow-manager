import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { caricaDati, cancellaVecchi, eseguiControlli, indiceSicurezza } from "../../shared/evasioneAssegnatiDati.ts";

// Controlla l'evasione di tutte le liste di assegnati presenti.
//
// Payload: { forza?, raccoglitore_chiave? }
// Parte da sola dopo ogni caricamento delle primarie. Una lista gia' controllata
// su quel caricamento viene saltata, a meno di "forza": serve dopo aver cambiato
// il target, perche' la previsione va rifatta sui dati gia' presenti.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    await cancellaVecchi(base44, { finoAIndice: indiceSicurezza() });

    let liste = await fetchAll(base44.asServiceRole.entities.ListaAssegnati);
    if (body.raccoglitore_chiave) liste = liste.filter(l => l.raccoglitore_chiave === body.raccoglitore_chiave);
    if (liste.length === 0) return Response.json({ controlli: 0 });

    const dati = await caricaDati(base44);
    const eseguiti = await eseguiControlli(base44, { liste, dati, forza: body.forza === true });
    return Response.json({ controlli: eseguiti.length, liste: liste.length });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
