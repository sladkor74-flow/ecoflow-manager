import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { PIVOT_DEFS, calcolaPivot } from "../../shared/reportMensile.ts";

// Calcola le pivot del modulo Report Mensile.
//
// Payload: { anno, mese, pivot: ['raccolta', 'impianti', ...] }
// Si calcolano solo le pivot richieste: ogni entita' viene riletta per intero e
// PrimariaRete da sola supera i diecimila record, quindi caricare tutto a ogni
// apertura del modulo costerebbe senza motivo.

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { anno, mese, pivot } = await req.json();
    if (!anno) return Response.json({ error: 'Anno obbligatorio' }, { status: 400 });

    const chiavi = Array.isArray(pivot) && pivot.length ? pivot : Object.keys(PIVOT_DEFS);
    const sconosciute = chiavi.filter(k => !PIVOT_DEFS[k]);
    if (sconosciute.length) {
      return Response.json({ error: 'Pivot sconosciute: ' + sconosciute.join(', ') }, { status: 400 });
    }
    if (chiavi.some(k => PIVOT_DEFS[k].periodo === 'mese') && !mese) {
      return Response.json({ error: 'Mese obbligatorio per le pivot mensili' }, { status: 400 });
    }

    const entita = [...new Set(chiavi.map(k => PIVOT_DEFS[k].entita))];
    const caricate = {};
    await Promise.all(entita.map(async (e) => {
      caricate[e] = await fetchAll(base44.asServiceRole.entities[e]);
    }));

    const pivots = {};
    for (const k of chiavi) {
      pivots[k] = calcolaPivot(k, caricate[PIVOT_DEFS[k].entita], anno, mese);
    }

    return Response.json({ anno: Number(anno), mese, pivots });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
