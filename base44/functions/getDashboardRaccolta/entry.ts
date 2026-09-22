import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { PROV_TO_REGION, riepilogoDateVista } from "../../shared/raccoltoCalculator.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { periodoMovimento } from "../../shared/movimenti.ts";

// Restituisce aggregati raccolta per la Dashboard filtrati per mese/anno.
// Payload: { mese?, anno? } — mese è il nome del mese (es. "Agosto"), anno è numerico.
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
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
      ? annoRaw.map(Number).filter(a => !isNaN(a) && a > 0)
      : (annoRaw ? [Number(annoRaw)].filter(a => !isNaN(a) && a > 0) : []);
    // Senza anno, l'anno in corso in Italia, come getDashboardStats: prima un anno
    // assente o vuoto arrivava qui come elenco vuoto, cioe' nessun filtro, e i KPI
    // sommavano la raccolta di tutti gli anni contro un target zero mentre i
    // conteggi della stessa pagina parlavano dell'anno in corso.
    if (!anni.length) anni.push(Number(oggiRoma().slice(0, 4)));

    const [rete, aci] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.PrimariaRete, { stato: 'terminato' }),
      fetchAll(base44.asServiceRole.entities.PrimariaAci, { stato: 'terminato' })
    ]);

    const getRegione = (r) => r.regione || PROV_TO_REGION[(r.provincia || '').toUpperCase().trim()] || 'Altro';
    const sumTon = (arr) => arr.reduce((s, r) => s + (r.peso_effettivo || 0), 0) / 1000;

    // Come in tutto il gestionale il periodo e' quello della fine trasporto, non i
    // campi mese e anno del record, e il giorno e' quello italiano per tutti e tre
    // i canali: rete e ACI si leggevano in UTC mentre l'extra correggeva la
    // mezzanotte italiana, e un ritiro del 1 ottobre finiva a settembre nella rete
    // e a ottobre nell'extra. Senza fine trasporto un movimento non ha periodo.
    const getAnno = (r) => { const p = periodoMovimento(r); return p ? p.anno : 0; };
    const getMese = (r) => { const p = periodoMovimento(r); return p ? p.mese : ''; };

    const reteAnno = rete.filter(r => anni.includes(getAnno(r)));
    const aciAnno = aci.filter(r => anni.includes(getAnno(r)));
    // Un terminato senza fine trasporto non ha periodo: resta fuori da ogni conto
    // e si dice quanti sono, canale per canale, invece di perderli in silenzio.
    // Non si ripiega sulla chiusura ne' sull'immissione.
    const senzaFine = (arr) => arr.filter(r => !periodoMovimento(r)).length;
    const reteMese = mesi.length > 0 ? reteAnno.filter(r => mesi.includes(getMese(r))) : reteAnno;
    const aciMese = mesi.length > 0 ? aciAnno.filter(r => mesi.includes(getMese(r))) : aciAnno;

    // RETE, ACI ed EXTRA RACCOLTA sono canali indipendenti: nessun totale che li
    // sommi e il target del contratto si confronta solo con la RETE.
    const raccolta_rete = sumTon(reteMese);
    const raccolta_aci = sumTon(aciMese);
    const raccolto_rete_anno = sumTon(reteAnno);
    const raccolto_aci_anno = sumTon(aciAnno);

    // Target annuo della commessa da Target & Status; i valori fissi solo se manca.
    const TARGET_ANNUO = { 2025: 11200, 2026: 11550 };
    const commesse = await base44.asServiceRole.entities.CommessaEcotyre.list('-created_date', 50).catch(() => []);
    const targetDi = (a) => { const c = commesse.find(x => Number(x.anno) === a); return c && Number(c.target_annuo_t) > 0 ? Number(c.target_annuo_t) : (TARGET_ANNUO[a] || 0); };
    const target = anni.reduce((s, a) => s + targetDi(a), 0);
    const raggiungimento_pct = target > 0 ? (raccolto_rete_anno / target) * 100 : 0;

    // Previsione ACI del contratto ACI Ecotyre (indicativa) e canale Extra Raccolta.
    const previsioneAciDi = (a) => {
      const c = commesse.find(x => Number(x.anno) === a);
      try { return (c ? JSON.parse(c.target_prezzo_regioni_json || '[]') : []).reduce((s, r) => s + (Number(r.target_t) || 0), 0); } catch { return 0; }
    };
    const previsione_aci = anni.reduce((s, a) => s + previsioneAciDi(a), 0);
    // L'extra raccolta: la raccolta dal produttore, non i trasferimenti in
    // secondaria che stanno nello stesso archivio e riporterebbero lo stesso peso
    // una seconda volta.
    const extraTutti = (await fetchAll(base44.asServiceRole.entities.ExtraRaccolta, { stato: 'terminato' }))
      .filter(r => String(r.tipo_movimento || 'primaria').toLowerCase().trim() !== 'secondaria')
      .map(r => ({ r, p: periodoMovimento(r) }));
    const extra = extraTutti.filter(({ p }) => p && anni.includes(p.anno));
    const raccolta_extra = extra.filter(({ p }) => mesi.length === 0 || mesi.includes(p.mese)).reduce((s, { r }) => s + (Number(r.peso_effettivo) || 0), 0) / 1000;
    const raccolto_extra_anno = extra.reduce((s, { r }) => s + (Number(r.peso_effettivo) || 0), 0) / 1000;

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
      kpi: { raccolta_rete, raccolta_aci, raccolta_extra, raccolto_rete_anno, raccolto_aci_anno, raccolto_extra_anno, previsione_aci, target, raggiungimento_pct },
      // In ordine di rete e poi di ACI: ordinare sulla somma dei due canali era
      // gia' un totale che li mescolava.
      per_regione: Object.values(regioniMap).sort((a, b) => (b.rete - a.rete) || (b.aci - a.aci)),
      target_vs_raccolto,
      anni,
      // terminati esclusi perche' senza fine trasporto, di qualunque anno: per canale, mai sommati
      senza_fine_trasporto: { rete: senzaFine(rete), aci: senzaFine(aci), extra: extraTutti.filter(({ p }) => !p).length },
      // Le date da sistemare, un canale per volta (regola dell'utente, 22/09/2026:
      // immissione, inizio e fine trasporto sono obbligatorie in ogni formulario
      // terminato): i senza fine trasporto qui sopra, e i terminati del periodo
      // scelto - lo stesso della raccolta del mese - con un'altra data che manca o
      // non torna. Quelli sono contati nei numeri, ma vanno corretti.
      date_da_sistemare: {
        rete: riepilogoDateVista(rete, reteMese, 5),
        aci: riepilogoDateVista(aci, aciMese, 5),
        extra: riepilogoDateVista(extraTutti.map(({ r }) => r), extra.filter(({ p }) => mesi.length === 0 || mesi.includes(p.mese)).map(({ r }) => r), 5),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}