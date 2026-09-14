import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { PROV_TO_REGION, MESI } from "../../shared/raccoltoCalculator.ts";
import { fetchAll } from "../../shared/fetchAll.ts";

// Restituisce aggregati raccolta per la Dashboard filtrati per mese/anno.
// Payload: { mese?, anno? } — mese è il nome del mese (es. "Agosto"), anno è numerico.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // Supporto filtri multi-selezione: mese e anno possono essere array o singoli valori
    const meseRaw = body.mese || [];
    const mesi = Array.isArray(meseRaw)
      ? meseRaw.filter(m => m && m !== 'Tutti i mesi')
      : (meseRaw && meseRaw !== 'Tutti i mesi' ? [meseRaw] : []);

    const annoRaw = body.anno || [];
    const anni = Array.isArray(annoRaw)
      ? annoRaw.map(Number).filter(a => !isNaN(a))
      : (annoRaw ? [Number(annoRaw)] : [new Date().getFullYear()]);

    const [rete, aci] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.PrimariaRete, { stato: 'terminato' }),
      fetchAll(base44.asServiceRole.entities.PrimariaAci, { stato: 'terminato' })
    ]);

    const getRegione = (r) => r.regione || PROV_TO_REGION[(r.provincia || '').toUpperCase().trim()] || 'Altro';
    const sumTon = (arr) => arr.reduce((s, r) => s + (r.peso_effettivo || 0), 0) / 1000;

    // Come in tutto il gestionale il periodo e' quello della fine trasporto, non i
    // campi mese e anno del record.
    const fine = (r) => { const d = r.trasporto_finito_il ? new Date(r.trasporto_finito_il) : null; return d && !isNaN(d.getTime()) ? d : null; };
    const getAnno = (r) => { const d = fine(r); return d ? d.getUTCFullYear() : 0; };
    const getMese = (r) => { const d = fine(r); return d ? MESI[d.getUTCMonth()] : ''; };

    const reteAnno = anni.length > 0 ? rete.filter(r => anni.includes(getAnno(r))) : rete;
    const aciAnno = anni.length > 0 ? aci.filter(r => anni.includes(getAnno(r))) : aci;
    const reteMese = mesi.length > 0 ? reteAnno.filter(r => mesi.includes(getMese(r))) : reteAnno;
    const aciMese = mesi.length > 0 ? aciAnno.filter(r => mesi.includes(getMese(r))) : aciAnno;

    const raccolta_rete = sumTon(reteMese);
    const raccolta_aci = sumTon(aciMese);
    const totale_raccolto = sumTon([...reteAnno, ...aciAnno]);

    // Target annuo della commessa da Target & Status; i valori fissi solo se manca.
    const TARGET_ANNUO = { 2025: 11200, 2026: 11550 };
    const commesse = await base44.asServiceRole.entities.CommessaEcotyre.list('-created_date', 50).catch(() => []);
    const targetDi = (a) => { const c = commesse.find(x => Number(x.anno) === a); return c && Number(c.target_annuo_t) > 0 ? Number(c.target_annuo_t) : (TARGET_ANNUO[a] || 0); };
    const target = anni.reduce((s, a) => s + targetDi(a), 0);
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
    // Contratto per regione da Target & Status, sommato sugli anni scelti; i valori
    // fissi solo per un anno senza commessa inserita.
    const RISERVA_REGIONI = {
      'Campania': 4400, 'Puglia': 2500, 'Basilicata': 500, 'Calabria': 1650, 'Sicilia': 2500
    };
    const TARGET_REGIONI = {};
    for (const a of anni) {
      const c = commesse.find(x => Number(x.anno) === a);
      let regioni = [];
      try { regioni = c ? JSON.parse(c.regioni_json || '[]') : []; } catch { regioni = []; }
      const fonte = regioni.length ? Object.fromEntries(regioni.map(r => [r.regione, Number(r.target_t) || 0])) : RISERVA_REGIONI;
      for (const [reg, t] of Object.entries(fonte)) TARGET_REGIONI[reg] = (TARGET_REGIONI[reg] || 0) + t;
    }
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