import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { filtraMovimenti } from "../../shared/movimenti.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";

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
    if (!anni.length) anni.push(Number(oggiRoma().slice(0, 4)));

    // Terminati nel periodo della fine trasporto, sul giorno italiano: letto in
    // UTC un formulario finito il 1 agosto a mezzanotte italiana contava a luglio
    // e i conteggi non tornavano con il Report Mensile.
    const nelPeriodo = (righe) => filtraMovimenti(righe, { anno: anni, mese: mesi });

    const [assegnati, assegnatiAci, rete, aci, sec, terz, alerts] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.Assegnato),
      fetchAll(base44.asServiceRole.entities.AssegnatoAci),
      fetchAll(base44.asServiceRole.entities.PrimariaRete, { stato: 'terminato' }),
      fetchAll(base44.asServiceRole.entities.PrimariaAci, { stato: 'terminato' }),
      fetchAll(base44.asServiceRole.entities.Secondaria),
      fetchAll(base44.asServiceRole.entities.Terziaria),
      fetchAll(base44.asServiceRole.entities.Alert, { stato: 'aperto' }),
    ]);
    const secNelPeriodo = nelPeriodo(sec);

    return Response.json({
      anni, mesi,
      counts: {
        assegnati: assegnati.length,
        assegnati_aci: assegnatiAci.length,
        primarie_rete: nelPeriodo(rete).length,
        primarie_aci: nelPeriodo(aci).length,
        // Le secondarie di rete e quelle dell'autodemolizione si contano a parte:
        // stanno nello stesso archivio ma sono canali indipendenti.
        secondarie: secNelPeriodo.filter(r => !eAci(r)).length,
        secondarie_aci: secNelPeriodo.filter(r => eAci(r)).length,
        terziarie: nelPeriodo(terz).length,
      },
      alert_count: alerts.length,
      alert_critici: alerts.filter(a => a.severita === 'critico').length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
