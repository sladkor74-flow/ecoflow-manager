import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { PROV_TO_REGION } from "../../shared/raccoltoCalculator.ts";

// Restituisce aggregati raccolta per la Dashboard filtrati per mese/anno.
// Payload: { mese?, anno? } — mese è il nome del mese (es. "Agosto"), anno è numerico.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mese = body.mese || '';
    const anno = Number(body.anno) || new Date().getFullYear();

    const [rete, aci] = await Promise.all([
      base44.asServiceRole.entities.PrimariaRete.filter({ stato: 'terminato' }, '-created_date', 10000),
      base44.asServiceRole.entities.PrimariaAci.filter({ stato: 'terminato' }, '-created_date', 10000)
    ]);

    const getRegione = (r) => r.regione || PROV_TO_REGION[(r.provincia || '').toUpperCase().trim()] || 'Altro';
    const sumTon = (arr) => arr.reduce((s, r) => s + (r.peso_effettivo || 0), 0) / 1000;

    // Anno derivato dalla data di chiusura (colonna AI del file Primarie) se non già memorizzato
    const getAnno = (r) => {
      if (r.anno != null && !isNaN(Number(r.anno))) return Number(r.anno);
      const dataRif = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
      if (!dataRif) return 0;
      const d = new Date(dataRif);
      return isNaN(d.getTime()) ? 0 : d.getFullYear();
    };

    const reteAnno = rete.filter(r => getAnno(r) === anno);
    const aciAnno = aci.filter(r => getAnno(r) === anno);
    const reteMese = mese ? reteAnno.filter(r => r.mese === mese) : reteAnno;
    const aciMese = mese ? aciAnno.filter(r => r.mese === mese) : aciAnno;

    const raccolta_rete = sumTon(reteMese);
    const raccolta_aci = sumTon(aciMese);
    const totale_raccolto = sumTon([...reteAnno, ...aciAnno]);

    const TARGET_ANNUO = { 2025: 11200, 2026: 11550 };
    const target = TARGET_ANNUO[anno] || 0;
    const raggiungimento_pct = target > 0 ? (totale_raccolto / target) * 100 : 0;

    // Raccolta RETE vs ACI per regione (mese+anno selezionati)
    const regioniMap = {};
    for (const r of reteMese) {
      const reg = getRegione(r);
      if (!regioniMap[reg]) regioniMap[reg] = { regione: reg, rete: 0, aci: 0 };
      regioniMap[reg].rete += (r.peso_effettivo || 0) / 1000;
    }
    for (const r of aciMese) {
      const reg = getRegione(r);
      if (!regioniMap[reg]) regioniMap[reg] = { regione: reg, rete: 0, aci: 0 };
      regioniMap[reg].aci += (r.peso_effettivo || 0) / 1000;
    }

    // Target vs Raccolto per regione (solo Rete, anno selezionato, tutti i mesi)
    const TARGET_REGIONI = {
      'Campania': 4400, 'Puglia': 2500, 'Basilicata': 500, 'Calabria': 1650, 'Sicilia': 2500
    };
    const raccoltoRegRete = {};
    for (const r of reteAnno) {
      const reg = getRegione(r);
      raccoltoRegRete[reg] = (raccoltoRegRete[reg] || 0) + (r.peso_effettivo || 0) / 1000;
    }
    const target_vs_raccolto = Object.keys(TARGET_REGIONI).map(reg => ({
      regione: reg,
      target: TARGET_REGIONI[reg],
      raccolto: raccoltoRegRete[reg] || 0
    }));

    return Response.json({
      kpi: { raccolta_rete, raccolta_aci, totale_raccolto, target, raggiungimento_pct },
      per_regione: Object.values(regioniMap).sort((a, b) => (b.rete + b.aci) - (a.rete + a.aci)),
      target_vs_raccolto
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}