import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sortTariffe, resolveTariffa, calcolaTotale } from "../../shared/ecotyreTariffe.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { filtraPeriodo } from "../../shared/filtroPeriodo.ts";

// Calcola il riepilogo del totale dovuto da Ecotyre per un dato anno/mese,
// basandosi sulle tariffe attive (Tariffa direzione=ATTIVA) e sul volume
// di raccolte effettuate (PrimariaRete, PrimariaAci, ExtraRaccolta).
// Stessa logica di elaboraFatturazioneAttiva (filtraPeriodo + resolveTariffa):
// anteprima e documento non possono divergere.
// Non crea documenti: calcolo in tempo reale a scopo di consultazione.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { anno, mese } = await req.json();
    if (!anno || !mese) return Response.json({ error: 'Anno e mese obbligatori' }, { status: 400 });

    const annoNum = Number(anno);

    // Load operational data WITHOUT month filter, then apply filtraPeriodo
    const [reteAll, aciAll, extraAll] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.PrimariaRete),
      fetchAll(base44.asServiceRole.entities.PrimariaAci),
      fetchAll(base44.asServiceRole.entities.ExtraRaccolta),
    ]);
    const rete = filtraPeriodo(reteAll, annoNum, mese);
    const aci = filtraPeriodo(aciAll, annoNum, mese);
    const extraRaccolta = filtraPeriodo(extraAll, annoNum, mese);

    // Load attiva tariffe
    const tariffe = await base44.asServiceRole.entities.Tariffa.filter({ direzione: 'ATTIVA', stato: 'attivo' });
    const tariffeSorted = sortTariffe(tariffe);

    const anomalieMap = new Map();
    function addAnomalia(tipologia, regione, classe, eer, quantitaKg) {
      const key = `${tipologia}|${regione || ''}|${classe || ''}|${eer || ''}`;
      const tonn = quantitaKg / 1000;
      if (anomalieMap.has(key)) {
        anomalieMap.get(key).tonnellate += tonn;
      } else {
        anomalieMap.set(key, { tipologia, regione: regione || '', classe: classe || '', eer_codice: eer || '', tonnellate: tonn });
      }
    }

    function elaboraBlocco(records, tipologia, useRegione) {
      let kg = 0, totale = 0, ordini = 0;
      const byRegione = {};
      const tariffeDistinte = new Map(); // key: valore|um -> { valore, um, ambiti: Set }
      let missingKg = 0, missingCount = 0;
      for (const r of records) {
        const peso = r.peso_effettivo || 0;
        if (peso === 0) continue;
        const regione = useRegione ? (r.regione || 'N/D') : 'N/D';
        const dataRiferimento = r.trasporto_finito_il;
        const tariffa = resolveTariffa(tariffeSorted, tipologia, r.classe, useRegione ? (r.regione || '') : '', r.cer, dataRiferimento);
        const tot = Math.round(calcolaTotale(peso, tariffa) * 100) / 100;
        kg += peso;
        totale += tot;
        ordini++;
        if (!byRegione[regione]) byRegione[regione] = { regione, kg: 0, totale: 0, ordini: 0 };
        byRegione[regione].kg += peso;
        byRegione[regione].totale += tot;
        byRegione[regione].ordini++;
        if (!tariffa) {
          addAnomalia(tipologia, useRegione ? (r.regione || '') : '', r.classe, r.cer, peso);
          missingKg += peso;
          missingCount++;
        } else {
          const tk = `${tariffa.valore}|${tariffa.unita_misura}`;
          if (!tariffeDistinte.has(tk)) tariffeDistinte.set(tk, { valore: tariffa.valore, unita_misura: tariffa.unita_misura, ambiti: new Set() });
          if (useRegione && r.regione) tariffeDistinte.get(tk).ambiti.add(r.regione);
          else if (!useRegione && r.classe) tariffeDistinte.get(tk).ambiti.add(r.classe);
        }
      }
      // badge
      let badge;
      if (missingCount > 0) {
        badge = { tipo: 'mancante', tonnellate_mancanti: Math.round((missingKg / 1000) * 100) / 100, count_mancanti: missingCount };
      } else if (tariffeDistinte.size > 1) {
        badge = { tipo: 'variabile', valori: Array.from(tariffeDistinte.values()).map(v => ({ valore: v.valore, unita_misura: v.unita_misura, ambiti: Array.from(v.ambiti) })) };
      } else if (tariffeDistinte.size === 1) {
        const v = Array.from(tariffeDistinte.values())[0];
        badge = { tipo: 'uniforme', valore: v.valore, unita_misura: v.unita_misura };
      } else {
        badge = { tipo: 'vuoto' };
      }
      return { kg, totale, ordini, by_regione: Object.values(byRegione).sort((a, b) => b.totale - a.totale), badge };
    }

    const reteRes = elaboraBlocco(rete, 'RETE', false);
    const aciRes = elaboraBlocco(aci, 'ACI', true);
    const extraRes = elaboraBlocco(extraRaccolta, 'EXTRA_RACCOLTA', true);

    const totaleGenerale = reteRes.totale + aciRes.totale + extraRes.totale;
    const totaleKg = reteRes.kg + aciRes.kg + extraRes.kg;

    const anomalie = Array.from(anomalieMap.values()).map(a => ({
      ...a,
      tonnellate: Math.round(a.tonnellate * 100) / 100,
    }));

    return Response.json({
      periodo: { anno: annoNum, mese },
      totale_generale: Math.round(totaleGenerale * 100) / 100,
      totale_kg: totaleKg,
      totale_ton: Math.round((totaleKg / 1000) * 100) / 100,
      totale_ordini: reteRes.ordini + aciRes.ordini + extraRes.ordini,
      anomalie,
      tipologie: [
        { tipologia: 'RETE', label: 'Rete', volume_kg: reteRes.kg, volume_ton: Math.round((reteRes.kg / 1000) * 100) / 100, totale: Math.round(reteRes.totale * 100) / 100, ordini: reteRes.ordini, badge: reteRes.badge, by_regione: reteRes.by_regione },
        { tipologia: 'ACI', label: 'ACI', volume_kg: aciRes.kg, volume_ton: Math.round((aciRes.kg / 1000) * 100) / 100, totale: Math.round(aciRes.totale * 100) / 100, ordini: aciRes.ordini, badge: aciRes.badge, by_regione: aciRes.by_regione },
        { tipologia: 'EXTRA_RACCOLTA', label: 'Extra Raccolta', volume_kg: extraRes.kg, volume_ton: Math.round((extraRes.kg / 1000) * 100) / 100, totale: Math.round(extraRes.totale * 100) / 100, ordini: extraRes.ordini, badge: extraRes.badge, by_regione: extraRes.by_regione },
      ],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}