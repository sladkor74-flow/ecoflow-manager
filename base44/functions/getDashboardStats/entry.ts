import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { MESI } from "../../shared/raccoltoCalculator.ts";

// Conteggi per la Dashboard nel periodo scelto con i filtri (anno e mesi), come i
// grafici: formulari terminati per data di fine trasporto, canali separati.
// Gli assegnati sono gli ordini da evadere oggi e non dipendono dal periodo.
// Payload: { anno?: number[], mese?: string[] }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const comeElenco = (v) => (Array.isArray(v) ? v : (v ? [v] : []));
    const anni = comeElenco(body.anno).map(Number).filter(a => !isNaN(a) && a > 0);
    const mesi = comeElenco(body.mese).filter(m => m && m !== 'Tutti i mesi');
    if (!anni.length) anni.push(new Date().getUTCFullYear());

    const nelPeriodo = (r) => {
      if (String(r.stato || '').toLowerCase().trim() !== 'terminato') return false;
      const d = r.trasporto_finito_il ? new Date(r.trasporto_finito_il) : null;
      if (!d || isNaN(d.getTime())) return false;
      return anni.includes(d.getUTCFullYear()) && (!mesi.length || mesi.includes(MESI[d.getUTCMonth()]));
    };

    const [assegnati, assegnatiAci, rete, aci, sec, terz, alerts] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.Assegnato),
      fetchAll(base44.asServiceRole.entities.AssegnatoAci),
      fetchAll(base44.asServiceRole.entities.PrimariaRete, { stato: 'terminato' }),
      fetchAll(base44.asServiceRole.entities.PrimariaAci, { stato: 'terminato' }),
      fetchAll(base44.asServiceRole.entities.Secondaria),
      fetchAll(base44.asServiceRole.entities.Terziaria),
      fetchAll(base44.asServiceRole.entities.Alert, { stato: 'aperto' }),
    ]);

    return Response.json({
      anni, mesi,
      counts: {
        assegnati: assegnati.length,
        assegnati_aci: assegnatiAci.length,
        primarie_rete: rete.filter(nelPeriodo).length,
        primarie_aci: aci.filter(nelPeriodo).length,
        // Le secondarie di rete e quelle dell'autodemolizione si contano a parte:
        // stanno nello stesso archivio ma sono canali indipendenti.
        secondarie: sec.filter(r => nelPeriodo(r) && !eAci(r)).length,
        secondarie_aci: sec.filter(r => nelPeriodo(r) && eAci(r)).length,
        terziarie: terz.filter(nelPeriodo).length,
      },
      alert_count: alerts.length,
      alert_critici: alerts.filter(a => a.severita === 'critico').length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
