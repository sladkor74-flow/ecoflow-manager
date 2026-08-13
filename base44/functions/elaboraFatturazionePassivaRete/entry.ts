import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';

// Elabora la fatturazione passiva PUNTO A) - compensi ai raccoglitori per raccolta RETE.
// Logica esclusiva per fornitore: €/t (su peso) oppure €/Viaggio (su viaggi univoci).
// Input: { mese, anno, fornitoreId? }
// Output: { dettaglio: [{trasportatore, regione, totale_t, num_viaggi, tariffa_valore, unita_misura, totale_euro, eer, ...}], totale_complessivo }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { anno, mese, fornitoreId } = await req.json();
    if (!anno || !mese) return Response.json({ error: 'Anno e mese obbligatori' }, { status: 400 });

    const annoNum = Number(anno);

    // Mappa nomi mesi italiani -> numero mese (0-11)
    const MESI_MAP = {
      'gennaio': 0, 'febbraio': 1, 'marzo': 2, 'aprile': 3, 'maggio': 4, 'giugno': 5,
      'luglio': 6, 'agosto': 7, 'settembre': 8, 'ottobre': 9, 'novembre': 10, 'dicembre': 11
    };
    const meseNorm = String(mese).toLowerCase().trim();
    const meseNum = MESI_MAP[meseNorm] !== undefined
      ? MESI_MAP[meseNorm]
      : (!isNaN(Number(meseNorm)) ? Number(meseNorm) - 1 : -1);

    // Recupera tariffe PASSIVA RETE attive (tutte le date di validità, il match è per record)
    const tariffe = await base44.asServiceRole.entities.Tariffa.filter({
      direzione: 'PASSIVA', tipologia: 'RETE', stato: 'attivo',
    });

    // Helper: verifica se una tariffa è valida per una data di fine trasporto
    function tariffaValidaPerData(tariffa, dataIso) {
      if (!dataIso) return false;
      const dt = new Date(dataIso);
      if (isNaN(dt.getTime())) return false;
      const dtOnly = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
      if (tariffa.data_inizio_validita) {
        const di = new Date(tariffa.data_inizio_validita);
        if (!isNaN(di.getTime()) && new Date(di.getFullYear(), di.getMonth(), di.getDate()).getTime() > dtOnly) return false;
      }
      if (tariffa.data_fine_validita) {
        const df = new Date(tariffa.data_fine_validita);
        if (!isNaN(df.getTime()) && new Date(df.getFullYear(), df.getMonth(), df.getDate()).getTime() < dtOnly) return false;
      }
      return true;
    }

    // Recupera TUTTI i record PrimariaRete paginando (list() default si ferma a 5000)
    const rete = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.PrimariaRete.list('-created_date', 1000, offset);
      rete.push(...batch);
      hasMore = batch.length === 1000;
      offset += 1000;
    }

    // Filtro rigoroso: stato 'terminato' (case-insensitive) + trasporto_finito_il in anno/mese target
    const reteAnno = rete.filter(r => {
      const stato = String(r.stato || '').toLowerCase().trim();
      if (stato !== 'terminato') return false;
      const d = r.trasporto_finito_il;
      if (!d) return false;
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return false;
      if (dt.getFullYear() !== annoNum) return false;
      if (meseNum !== -1 && dt.getMonth() !== meseNum) return false;
      return true;
    });

    // Se specificato un fornitore, recupera il suo nome e filtra
    let fornitoreNomeFilter = '';
    if (fornitoreId) {
      const fornitori = await base44.asServiceRole.entities.Fornitore.filter({ stato: 'attivo' });
      const f = fornitori.find(x => x.id === fornitoreId);
      if (f) fornitoreNomeFilter = normalizzaRagioneSociale(f.ragione_sociale);
    }

    // Raggruppa per {trasportatore normalizzato, regione} — ogni record tiene traccia della propria data
    const gruppi = new Map();
    for (const r of reteAnno) {
      const trasportatore = (r.trasportatore || '').trim();
      if (!trasportatore) continue;
      const trasKey = normalizzaRagioneSociale(trasportatore);
      if (fornitoreNomeFilter && trasKey !== fornitoreNomeFilter) continue;

      const regione = (r.regione || r.regioni || '').trim() || 'NON SPECIFICATA';
      const key = `${trasKey}|${regione.toUpperCase()}`;

      if (!gruppi.has(key)) {
        gruppi.set(key, {
          trasportatore,
          trasKey,
          regione,
          totale_peso_kg: 0,
          viaggiSet: new Set(),
          eer_set: new Set(),
          classi_set: new Set(),
          record_ids: [],
          // Per il calcolo con tariffe variabili nel tempo: accumula per (tariffa, data)
          perTariffa: new Map(), // key tariffa -> {peso_kg, viaggiSet}
        });
      }
      const g = gruppi.get(key);
      g.totale_peso_kg += Number(r.peso_effettivo || 0);

      // Conta viaggi univoci: gruppi {data_trasporto_finito (giorno), automezzo}
      const dataFine = r.trasporto_finito_il ? r.trasporto_finito_il.slice(0, 10) : '';
      const automezzo = (r.automezzo || '').trim();
      const viaggioKey = `${dataFine}|${automezzo}` || r.id_ordine;
      g.viaggiSet.add(viaggioKey);

      if (r.cer) g.eer_set.add(r.cer);
      if (r.classe) g.classi_set.add(r.classe);
      if (g.record_ids.length < 50) g.record_ids.push(r.id_ordine || r.id);

      // Trova la tariffa valida per la data di questo specifico record
      const tariffaRecord = findTariffaPerData(g.trasKey, g.regione, r.trasporto_finito_il);
      const tk = tariffaRecord ? tariffaRecord.id : '__NESSUNA__';
      if (!g.perTariffa.has(tk)) {
        g.perTariffa.set(tk, { peso_kg: 0, viaggiSet: new Set(), tariffa: tariffaRecord });
      }
      const pt = g.perTariffa.get(tk);
      pt.peso_kg += Number(r.peso_effettivo || 0);
      pt.viaggiSet.add(viaggioKey);
    }

    // Trova tariffa matching per (trasportatore, regione, data) applicando validità temporale
    function findTariffaPerData(trasKey, regione, dataIso) {
      // Match esatto su regione con validità temporale
      for (const t of tariffe) {
        const tKey = normalizzaRagioneSociale(t.fornitore_nome);
        if (tKey !== trasKey) continue;
        const tReg = (t.regione || '').trim().toUpperCase();
        if (tReg && tReg === regione.toUpperCase() && tariffaValidaPerData(t, dataIso)) return t;
      }
      // Match senza regione (tariffa generica per fornitore) con validità temporale
      for (const t of tariffe) {
        const tKey = normalizzaRagioneSociale(t.fornitore_nome);
        if (tKey !== trasKey) continue;
        if (!t.regione || !t.regione.trim()) if (tariffaValidaPerData(t, dataIso)) return t;
      }
      return null;
    }

    const dettaglio = [];
    let totale_complessivo = 0;

    for (const g of gruppi.values()) {
      const totale_t = g.totale_peso_kg / 1000;
      const num_viaggi = g.viaggiSet.size;
      const eer = Array.from(g.eer_set).join(', ');
      const classi = Array.from(g.classi_set).join(', ');

      let totale_euro = 0;
      let tariffa_valore = 0;
      let unita_misura = '';
      let has_tariffa = false;
      let tariffe_multiple = g.perTariffa.size > 1;

      // Se tutte le tariffe coincidono (o una sola), usa quella per il riepilogo
      const tariffeUsate = Array.from(g.perTariffa.values()).filter(pt => pt.tariffa);
      if (tariffeUsate.length > 0) {
        has_tariffa = true;
        // Per il riepilogo mostriamo la prima tariffa (o unica) usata
        const prima = tariffeUsate[0].tariffa;
        tariffa_valore = prima.valore;
        unita_misura = prima.unita_misura;

        // Calcola il totale sommando per ogni tariffa valida trovata
        for (const pt of g.perTariffa.values()) {
          if (!pt.tariffa) continue; // record senza tariffa -> 0
          const um = (pt.tariffa.unita_misura || '').toLowerCase();
          const pt_t = pt.peso_kg / 1000;
          const pt_viaggi = pt.viaggiSet.size;
          if (um.includes('viaggio') || um.includes('vg')) {
            totale_euro += pt_viaggi * pt.tariffa.valore;
          } else {
            totale_euro += um.includes('kg') ? pt.peso_kg * pt.tariffa.valore : pt_t * pt.tariffa.valore;
          }
        }
      }

      totale_euro = Math.round(totale_euro * 100) / 100;
      totale_complessivo += totale_euro;

      dettaglio.push({
        trasportatore: g.trasportatore,
        regione: g.regione,
        totale_t: Math.round(totale_t * 1000) / 1000,
        num_viaggi,
        tariffa_valore,
        unita_misura,
        eer,
        classi,
        totale_euro,
        has_tariffa,
        tariffe_multiple,
        record_ids: g.record_ids,
      });
    }

    // Ordina per totale_euro decrescente
    dettaglio.sort((a, b) => b.totale_euro - a.totale_euro);

    return Response.json({
      dettaglio,
      totale_complessivo: Math.round(totale_complessivo * 100) / 100,
      mese,
      anno: annoNum,
      fornitore_id: fornitoreId || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}