import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sortTariffe, resolveTariffa, calcolaTotale } from "../../shared/ecotyreTariffe.ts";

// Calcola il riepilogo del totale dovuto da Ecotyre per un dato anno/mese,
// basandosi sulle tariffe impostate (Tariffa direzione=ATTIVA) e sul volume
// di raccolte effettuate (PrimariaRete, PrimariaAci, ExtraRaccolta).
// Non crea documenti: calcolo in tempo reale a scopo di consultazione.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { anno, mese } = await req.json();
    if (!anno || !mese) return Response.json({ error: 'Anno e mese obbligatori' }, { status: 400 });

    // Load operational data
    const [rete, aci, extraRaccolta] = await Promise.all([
      base44.asServiceRole.entities.PrimariaRete.filter({ mese }),
      base44.asServiceRole.entities.PrimariaAci.filter({ mese }),
      base44.asServiceRole.entities.ExtraRaccolta.filter({ mese }),
    ]);

    // Load attiva tariffe
    const tariffe = await base44.asServiceRole.entities.Tariffa.filter({ direzione: 'ATTIVA', stato: 'attivo' });
    const tariffeSorted = sortTariffe(tariffe);

    // --- RETE ---
    let reteKg = 0, reteTotale = 0, reteOrdini = 0;
    const reteByRegione = {};
    for (const r of rete) {
      const kg = r.peso_effettivo || 0;
      if (kg === 0) continue;
      const regione = r.regione || 'N/D';
      const tariffa = resolveTariffa(tariffeSorted, 'RETE', r.classe, '', r.cer);
      const totale = calcolaTotale(kg, tariffa);
      reteKg += kg;
      reteTotale += totale;
      reteOrdini++;
      if (!reteByRegione[regione]) reteByRegione[regione] = { regione, kg: 0, totale: 0, ordini: 0 };
      reteByRegione[regione].kg += kg;
      reteByRegione[regione].totale += totale;
      reteByRegione[regione].ordini++;
    }

    // --- ACI ---
    let aciKg = 0, aciTotale = 0, aciOrdini = 0;
    const aciByRegione = {};
    for (const r of aci) {
      const kg = r.peso_effettivo || 0;
      if (kg === 0) continue;
      const regione = r.regione || 'N/D';
      const tariffa = resolveTariffa(tariffeSorted, 'ACI', r.classe, regione, r.cer);
      const totale = calcolaTotale(kg, tariffa);
      aciKg += kg;
      aciTotale += totale;
      aciOrdini++;
      if (!aciByRegione[regione]) aciByRegione[regione] = { regione, kg: 0, totale: 0, ordini: 0, tariffa: tariffa?.valore || 0 };
      aciByRegione[regione].kg += kg;
      aciByRegione[regione].totale += totale;
      aciByRegione[regione].ordini++;
    }

    // --- EXTRA RACCOLTA ---
    let extraKg = 0, extraTotale = 0, extraOrdini = 0;
    for (const r of extraRaccolta) {
      const kg = r.peso_effettivo || 0;
      if (kg === 0) continue;
      const tariffa = resolveTariffa(tariffeSorted, 'EXTRA_RACCOLTA', r.classe, r.regione || '', r.cer);
      const totale = calcolaTotale(kg, tariffa);
      extraKg += kg;
      extraTotale += totale;
      extraOrdini++;
    }

    const totaleGenerale = reteTotale + aciTotale + extraTotale;
    const totaleKg = reteKg + aciKg + extraKg;

    return Response.json({
      periodo: { anno: Number(anno), mese },
      totale_generale: Math.round(totaleGenerale * 100) / 100,
      totale_kg: totaleKg,
      totale_ton: Math.round((totaleKg / 1000) * 100) / 100,
      totale_ordini: reteOrdini + aciOrdini + extraOrdini,
      tipologie: [
        {
          tipologia: 'RETE',
          label: 'Rete',
          volume_kg: reteKg,
          volume_ton: Math.round((reteKg / 1000) * 100) / 100,
          totale: Math.round(reteTotale * 100) / 100,
          ordini: reteOrdini,
          tariffa_default: 202,
          by_regione: Object.values(reteByRegione).sort((a, b) => b.totale - a.totale),
        },
        {
          tipologia: 'ACI',
          label: 'ACI',
          volume_kg: aciKg,
          volume_ton: Math.round((aciKg / 1000) * 100) / 100,
          totale: Math.round(aciTotale * 100) / 100,
          ordini: aciOrdini,
          tariffa_default: 'variabile',
          by_regione: Object.values(aciByRegione).sort((a, b) => b.totale - a.totale),
        },
        {
          tipologia: 'EXTRA_RACCOLTA',
          label: 'Extra Raccolta',
          volume_kg: extraKg,
          volume_ton: Math.round((extraKg / 1000) * 100) / 100,
          totale: Math.round(extraTotale * 100) / 100,
          ordini: extraOrdini,
          tariffa_default: 202,
        },
      ],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}