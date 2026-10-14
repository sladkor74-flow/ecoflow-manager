import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { raccoltoDellaSettimana, filtroSettimana, eLunedi } from "../../shared/riepilogoSettimana.ts";

// IL RACCOLTO DELLA SETTIMANA PER IL RIEPILOGO DELLA DIREZIONE (14/10/2026).
//
// Il riepilogo settimanale si fa dalla dashboard, coi numeri che la dashboard
// ha gia' letto (getDashboardRaccolta, cruscottoOperativo e, per
// l'amministratore, calcolaMargine). Manca solo il raccolto della settimana: il
// quadro conta per mese. Questa e' l'unica lettura in piu', e parte solo al
// clic sul pulsante, mai all'apertura della pagina: tre letture filtrate sulla
// fine trasporto della settimana, una pagina per archivio (sulla copia dei dati
// veri dell'11/10/2026 la settimana dal 28/09 al 04/10 sono 83 righe di rete,
// una di ACI e nessuna di extra raccolta, in tre richieste; il quadro, per
// aprire la pagina, legge le 10.035 primarie di rete terminate e il resto in
// otto richieste).
// Il conto sta in base44/shared/riepilogoSettimana.ts.
//
// Un archivio che non si legge lascia il suo canale { letto: false } col
// perche': il PDF lo dice in quella sezione, mai uno zero. Risponde solo
// tonnellate e ritiri, nessun euro: la chiama chiunque consulti la dashboard.
// Payload: { dal: 'AAAA-MM-GG' } - il lunedi' della settimana, gia' cominciata.
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const dal = String((body && body.dal) || '');
    const oggi = oggiRoma();
    // Una settimana e' da lunedi' a domenica, sul giorno italiano. Un giorno che
    // non e' un lunedi', o una settimana non ancora cominciata, non si conta:
    // si direbbe zero di una settimana che non e' quella chiesta.
    if (!eLunedi(dal)) return Response.json({ error: `«${dal || 'nessun giorno'}» non è il lunedì di una settimana.` }, { status: 400 });
    if (dal > oggi) return Response.json({ error: `La settimana che comincia il ${dal.split('-').reverse().join('/')} non è ancora cominciata.` }, { status: 400 });

    const svc = base44.asServiceRole.entities;
    const filtro = filtroSettimana(dal);
    const errori = {};
    const leggi = (nome, entita) => fetchAll(entita, filtro, 'id').catch((e) => { errori[nome] = (e && e.message) || String(e); return null; });
    const [rete, aci, extra] = await Promise.all([
      leggi('rete', svc.PrimariaRete),
      leggi('aci', svc.PrimariaAci),
      leggi('extra', svc.ExtraRaccolta),
    ]);
    const conto = raccoltoDellaSettimana({ dal, oggi, rete, aci, extra });
    for (const k of Object.keys(errori)) conto[k] = { ...conto[k], errore: errori[k] };
    return Response.json({
      ...conto,
      // quante righe ha portato la lettura, per chi vuole misurarla
      righe_lette: { rete: rete ? rete.length : null, aci: aci ? aci.length : null, extra: extra ? extra.length : null },
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
