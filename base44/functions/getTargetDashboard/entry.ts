import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { filtraMovimenti } from "../../shared/movimenti.ts";

// Raccolta per regione con i target mensili. I canali restano separati: il
// raggiungimento del target si calcola solo sulla RETE, ACI si mostra a parte.
// Solo terminati, nel periodo della fine trasporto dell'anno richiesto.
// Payload: { mese, anno } — default mese corrente.
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mese = body.mese || '';
    const anno = body.anno || Number(oggiRoma().slice(0, 4));

    // Anno e mese del giorno italiano della fine trasporto: letti in UTC, i
    // ritiri del primo del mese salvati a mezzanotte italiana finivano nel mese
    // prima e spostavano le percentuali di regione.
    const meseIdx = MESI.indexOf(mese);
    const nelPeriodo = (righe) => filtraMovimenti(righe, { anno: Number(anno), ...(meseIdx >= 0 ? { mese: meseIdx } : {}) });

    const [reteTutte, aciTutte, targets] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.PrimariaRete, { stato: 'terminato' }),
      fetchAll(base44.asServiceRole.entities.PrimariaAci, { stato: 'terminato' }),
      base44.asServiceRole.entities.TargetMensile.filter(mese ? { mese, anno: Number(anno) } : { anno: Number(anno) }, '-created_date', 10000),
    ]);

    const rete = nelPeriodo(reteTutte);
    const aci = nelPeriodo(aciTutte);

    // Aggrega per regione
    const regioniMap = {};

    const addRegion = (nome) => {
      if (!nome) return null;
      if (!regioniMap[nome]) regioniMap[nome] = { regione: nome, rete_kg: 0, aci_kg: 0, target: 0, raccolto_target: 0 };
      return regioniMap[nome];
    };

    for (const r of rete) {
      const reg = addRegion(r.regione);
      if (reg) reg.rete_kg += Number(r.peso_effettivo || 0);
    }
    for (const a of aci) {
      const reg = addRegion(a.regione);
      if (reg) reg.aci_kg += Number(a.peso_effettivo || 0);
    }
    for (const t of targets) {
      const reg = addRegion(t.regione);
      if (reg) {
        reg.target += t.non_raccoglie ? 0 : Number(t.target || 0);
        reg.raccolto_target += Number(t.raccolto || 0);
      }
    }

    const regioni = Object.values(regioniMap).map((r) => ({
      ...r,
      target_t: r.target,
      raccolto_t: r.raccolto_target,
      raggiungimento: r.target > 0 ? (r.rete_kg / 1000 / r.target * 100) : 0,
    })).sort((a, b) => b.rete_kg - a.rete_kg);

    const totals = {
      rete_kg: regioni.reduce((s, r) => s + r.rete_kg, 0),
      aci_kg: regioni.reduce((s, r) => s + r.aci_kg, 0),
      target_t: regioni.reduce((s, r) => s + r.target_t, 0),
      raccolto_t: regioni.reduce((s, r) => s + r.raccolto_t, 0),
    };
    totals.raggiungimento = totals.target_t > 0 ? (totals.rete_kg / 1000 / totals.target_t * 100) : 0;

    return Response.json({ regioni, totals, mese, anno });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}