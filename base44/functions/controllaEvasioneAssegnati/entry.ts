import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { caricaDati, cancellaVecchi, eseguiControlli, indiceSicurezza } from "../../shared/evasioneAssegnatiDati.ts";

// Controlla l'evasione di tutte le liste di assegnati presenti.
//
// Payload: { forza?, raccoglitore_chiave?, anno?, mese? }
// Parte da sola dopo ogni caricamento delle primarie, anche parziale: ogni
// caricamento che riscrive l'archivio aggiorna tutte le liste. Una lista gia'
// controllata su quel caricamento, con lo stesso target e dopo le liste del suo
// mese, viene saltata, a meno di "forza" (il pulsante "Controlla ora").
// anno e mese limitano il controllo alle liste di quel mese: servono dopo
// l'eliminazione di una lista, che non lascia traccia ma cambia lo stato delle
// richieste passate a lei nelle liste degli altri raccoglitori.
//
// Risposte: 200 solo quando ha controllato tutto quello che doveva; 409, con il
// caricamento nominato, quando le primarie si stanno caricando o il caricamento
// si e' interrotto (su un archivio a meta' non si ricontrolla: chi chiama non
// deve scambiare il rinvio per un aggiornamento); 500 con i primi errori.

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    await cancellaVecchi(base44, { finoAIndice: indiceSicurezza() });

    let liste = await fetchAll(base44.asServiceRole.entities.ListaAssegnati);
    if (body.raccoglitore_chiave) liste = liste.filter(l => l.raccoglitore_chiave === body.raccoglitore_chiave);
    if (Number(body.anno) && Number(body.mese)) liste = liste.filter(l => Number(l.anno) === Number(body.anno) && Number(l.mese) === Number(body.mese));
    if (liste.length === 0) return Response.json({ controlli: 0, liste: 0 });

    const dati = await caricaDati(base44);
    if (dati.caricamento_aperto) {
      return Response.json({ error: dati.caricamento_aperto.messaggio, rinviato: true }, { status: 409 });
    }
    const eseguiti = await eseguiControlli(base44, { liste, dati, forza: body.forza === true });
    return Response.json({ controlli: eseguiti.length, liste: liste.length });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
