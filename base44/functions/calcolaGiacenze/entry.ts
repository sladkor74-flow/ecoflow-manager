import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";

// Calcola le giacenze di impianti e stoccaggi per l'anno richiesto.
// Perimetro: solo canale RETE (comprende extra raccolta). ACI escluso dalla giacenza rete.
// Riconoscimento riga ACI: campo classe (o prodotto se classe assente) contiene "autodemolizione".
// Solo record con stato "terminato" e trasporto_finito_il nell'anno.
// Tutti i confronti nomi tramite normalizzaRagioneSociale.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { anno } = await req.json();
    if (!anno) return Response.json({ error: 'Anno obbligatorio' }, { status: 400 });
    const annoNum = Number(anno);

    const [reteAll, aciAll, extraAll, secAll, terzAll, giacenzeSito, dichiarazioni] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.PrimariaRete),
      fetchAll(base44.asServiceRole.entities.PrimariaAci),
      fetchAll(base44.asServiceRole.entities.ExtraRaccolta),
      fetchAll(base44.asServiceRole.entities.Secondaria),
      fetchAll(base44.asServiceRole.entities.Terziaria),
      fetchAll(base44.asServiceRole.entities.GiacenzaSito, { anno: annoNum }),
      fetchAll(base44.asServiceRole.entities.DichiarazioneSito, { anno: annoNum }),
    ]);

    const norm = normalizzaRagioneSociale;
    const r2 = (v) => Math.round(v * 100) / 100;
    const tdNorm = (v) => String(v || '').toLowerCase().trim();

    function isTerminato(r) { return String(r.stato || '').trim().toLowerCase() === 'terminato'; }
    function inYear(r) {
      if (!r.trasporto_finito_il) return false;
      const d = new Date(r.trasporto_finito_il);
      return !isNaN(d.getTime()) && d.getFullYear() === annoNum;
    }
    function isAciRow(r) {
      const cl = String(r.classe || '').toLowerCase().trim();
      if (cl) return cl.includes('autodemolizione');
      return String(r.prodotto || '').toLowerCase().trim().includes('autodemolizione');
    }

    const rete = reteAll.filter(r => isTerminato(r) && inYear(r));
    const aci = aciAll.filter(r => isTerminato(r) && inYear(r));
    const extra = extraAll.filter(r => isTerminato(r) && inYear(r));
    const sec = secAll.filter(r => isTerminato(r) && inYear(r));
    const terz = terzAll.filter(r => isTerminato(r) && inYear(r));

    const reteNonAci = rete.filter(r => !isAciRow(r));
    const secNonAci = sec.filter(r => !isAciRow(r));
    const secAci = sec.filter(r => isAciRow(r));

    // --- RETE aggregation maps ---
    const confPrimMap = new Map(); // normDest|td -> t
    for (const r of [...reteNonAci, ...extra]) {
      const nd = norm(r.destinazione); const td = tdNorm(r.tipo_destinazione);
      if (!nd || !td) continue;
      const k = nd + '|' + td;
      confPrimMap.set(k, (confPrimMap.get(k) || 0) + (r.peso_effettivo || 0) / 1000);
    }
    const secInMap = new Map(); // normDest|td -> t
    for (const r of secNonAci) {
      const nd = norm(r.destinazione); const td = tdNorm(r.tipo_destinazione);
      if (!nd || !td) continue;
      const k = nd + '|' + td;
      secInMap.set(k, (secInMap.get(k) || 0) + (r.peso_effettivo || 0) / 1000);
    }
    const secOutMap = new Map(); // normStoc -> t
    for (const r of secNonAci) {
      const ns = norm(r.stoccaggio);
      if (!ns) continue;
      secOutMap.set(ns, (secOutMap.get(ns) || 0) + (r.peso_effettivo || 0) / 1000);
    }
    const terzMap = new Map(); // normOrigine -> t
    for (const r of terz) {
      const no = norm(r.unita_locale_origine || r.ragione_sociale);
      if (!no) continue;
      terzMap.set(no, (terzMap.get(no) || 0) + (r.peso_effettivo || 0) / 1000);
    }

    // --- ACI aggregation maps ---
    const aciInPrimMap = new Map(); // normDest|td -> t
    for (const r of aci) {
      const nd = norm(r.destinazione); const td = tdNorm(r.tipo_destinazione);
      if (!nd || !td) continue;
      const k = nd + '|' + td;
      aciInPrimMap.set(k, (aciInPrimMap.get(k) || 0) + (r.peso_effettivo || 0) / 1000);
    }
    const aciInSecMap = new Map(); // normDest|td -> t
    for (const r of secAci) {
      const nd = norm(r.destinazione); const td = tdNorm(r.tipo_destinazione);
      if (!nd || !td) continue;
      const k = nd + '|' + td;
      aciInSecMap.set(k, (aciInSecMap.get(k) || 0) + (r.peso_effettivo || 0) / 1000);
    }
    const aciOutSecMap = new Map(); // normStoc -> t
    for (const r of secAci) {
      const ns = norm(r.stoccaggio);
      if (!ns) continue;
      aciOutSecMap.set(ns, (aciOutSecMap.get(ns) || 0) + (r.peso_effettivo || 0) / 1000);
    }

    // --- Dichiarazioni map ---
    const dichMap = new Map(); // normSito -> [records]
    for (const d of dichiarazioni) {
      const ns = norm(d.sito);
      if (!ns) continue;
      if (!dichMap.has(ns)) dichMap.set(ns, []);
      dichMap.get(ns).push(d);
    }

    // --- GiacenzaSito map ---
    const giacMap = new Map(); // normSito|td -> record
    for (const g of giacenzeSito) {
      giacMap.set(norm(g.sito) + '|' + tdNorm(g.tipo_destinazione), g);
    }

    // --- Build row set ---
    const rowMap = new Map();
    function addRow(sito, td) {
      const ns = norm(sito); const key = ns + '|' + td;
      if (!rowMap.has(key)) rowMap.set(key, { sito, td, normSito: ns });
    }
    for (const g of giacenzeSito) addRow(g.sito, tdNorm(g.tipo_destinazione));
    for (const r of reteNonAci) { const td = tdNorm(r.tipo_destinazione); if (r.destinazione && td) addRow(r.destinazione, td); }
    for (const r of extra) { const td = tdNorm(r.tipo_destinazione); if (r.destinazione && td) addRow(r.destinazione, td); }
    for (const r of secNonAci) { const td = tdNorm(r.tipo_destinazione); if (r.destinazione && td) addRow(r.destinazione, td); }
    for (const r of terz) { const orig = r.unita_locale_origine || r.ragione_sociale; if (orig) addRow(orig, 'imp'); }
    for (const r of aci) { const td = tdNorm(r.tipo_destinazione); if (r.destinazione && td) addRow(r.destinazione, td); }
    for (const r of secAci) { const td = tdNorm(r.tipo_destinazione); if (r.destinazione && td) addRow(r.destinazione, td); }

    // --- Calculate rows ---
    const righe = [];
    for (const [key, info] of rowMap) {
      const { sito, td, normSito } = info;
      const g = giacMap.get(key);

      const conferito_primarie_t = confPrimMap.get(key) || 0;
      const secondarie_in_t = secInMap.get(key) || 0;
      const secondarie_out_t = (td === 'stoc') ? (secOutMap.get(normSito) || 0) : 0;
      const secondarie_nette_t = secondarie_in_t - secondarie_out_t;
      const terziarie_t = (td === 'imp') ? (terzMap.get(normSito) || 0) : 0;

      const dichs = dichMap.get(normSito) || [];
      const dichInv = dichs.filter(d => d.caricata_inviata === true);
      const dichiarato_r3_t = dichInv.filter(d => d.operazione === 'R3' && (d.canale === 'RETE' || d.canale === 'EXTRA_RACCOLTA')).reduce((s, d) => s + (d.quantita_kg || 0) / 1000, 0);
      const dichiarato_r1_t = dichInv.filter(d => d.operazione === 'R1' && (d.canale === 'RETE' || d.canale === 'EXTRA_RACCOLTA')).reduce((s, d) => s + (d.quantita_kg || 0) / 1000, 0);

      let uscite_css_t = dichiarato_r1_t - terziarie_t;
      if (uscite_css_t < 0) uscite_css_t = 0;
      const css_override = g?.css_override_t || 0;
      const css_override_active = css_override > 0;
      if (css_override_active) uscite_css_t = css_override;

      const uscite_ferro_t = g?.uscite_ferro_t || 0;
      const giacenza_iniziale_t = g?.giacenza_iniziale_t || 0;
      const target_primarie_t = g?.target_primarie_t || 0;
      const target_totale_t = g?.target_totale_t || 0;

      const giacenza_attuale_t = giacenza_iniziale_t + conferito_primarie_t + secondarie_nette_t - terziarie_t - uscite_css_t - uscite_ferro_t - dichiarato_r3_t;
      const conferito_t = conferito_primarie_t + secondarie_in_t + secondarie_out_t;
      const residuo_t = target_totale_t > 0 ? target_totale_t - conferito_t : null;

      const aci_in_primarie_t = aciInPrimMap.get(key) || 0;
      const aci_in_sec_t = aciInSecMap.get(key) || 0;
      const aci_out_sec_t = (td === 'stoc') ? (aciOutSecMap.get(normSito) || 0) : 0;
      const dichAci = dichs.filter(d => d.canale === 'ACI');
      const aci_dichiarato_t = dichAci.filter(d => d.caricata_inviata === true).reduce((s, d) => s + (d.quantita_kg || 0) / 1000, 0);
      const aci_predisposto_t = dichAci.filter(d => d.caricata_inviata === false).reduce((s, d) => s + (d.quantita_kg || 0) / 1000, 0);
      const giacenza_aci_t = aci_in_primarie_t + aci_in_sec_t - aci_out_sec_t - aci_dichiarato_t;
      const divergenza_portale_t = aci_dichiarato_t + aci_predisposto_t;
      const giacenza_portale_t = giacenza_attuale_t + divergenza_portale_t;

      righe.push({
        sito, tipo_destinazione: td,
        target_primarie_t: r2(target_primarie_t), target_totale_t: r2(target_totale_t),
        giacenza_iniziale_t: r2(giacenza_iniziale_t),
        conferito_primarie_t: r2(conferito_primarie_t),
        secondarie_in_t: r2(secondarie_in_t), secondarie_out_t: r2(secondarie_out_t), secondarie_nette_t: r2(secondarie_nette_t),
        terziarie_t: r2(terziarie_t), uscite_css_t: r2(uscite_css_t), uscite_ferro_t: r2(uscite_ferro_t),
        dichiarato_r3_t: r2(dichiarato_r3_t), dichiarato_r1_t: r2(dichiarato_r1_t),
        giacenza_attuale_t: r2(giacenza_attuale_t), conferito_t: r2(conferito_t),
        residuo_t: residuo_t !== null ? r2(residuo_t) : null,
        aci_in_primarie_t: r2(aci_in_primarie_t), aci_in_sec_t: r2(aci_in_sec_t), aci_out_sec_t: r2(aci_out_sec_t),
        aci_dichiarato_t: r2(aci_dichiarato_t), aci_predisposto_t: r2(aci_predisposto_t),
        giacenza_aci_t: r2(giacenza_aci_t), divergenza_portale_t: r2(divergenza_portale_t), giacenza_portale_t: r2(giacenza_portale_t),
        tipologia_trattamento: g?.tipologia_trattamento || '', css_override_active,
      });
    }

    righe.sort((a, b) => {
      const c = a.sito.localeCompare(b.sito);
      return c !== 0 ? c : (a.tipo_destinazione === 'imp' ? -1 : 1);
    });

    // --- Totali ---
    const numCols = ['target_primarie_t','target_totale_t','giacenza_iniziale_t','conferito_primarie_t','secondarie_in_t','secondarie_out_t','secondarie_nette_t','terziarie_t','uscite_css_t','uscite_ferro_t','dichiarato_r3_t','dichiarato_r1_t','giacenza_attuale_t','conferito_t','aci_in_primarie_t','aci_in_sec_t','aci_out_sec_t','aci_dichiarato_t','aci_predisposto_t','giacenza_aci_t','divergenza_portale_t','giacenza_portale_t'];
    const totali = {};
    for (const c of numCols) totali[c] = r2(righe.reduce((s, r) => s + (r[c] || 0), 0));

    // --- Dichiarazioni mancanti ---
    const dichiarazioni_mancanti = dichiarazioni
      .filter(d => (d.quantita_kg || 0) > 0 && d.caricata_inviata === false && d.canale !== 'ACI')
      .map(d => ({ sito: d.sito, operazione: d.operazione, canale: d.canale, provenienza: d.provenienza || '', mese: d.mese, tonnellate: r2((d.quantita_kg || 0) / 1000) }));

    return Response.json({ anno: annoNum, righe, totali, dichiarazioni_mancanti });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}