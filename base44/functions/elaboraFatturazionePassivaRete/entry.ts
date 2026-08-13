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

    // Recupera tariffe PASSIVA RETE attive
    const tariffe = await base44.asServiceRole.entities.Tariffa.filter({
      direzione: 'PASSIVA', tipologia: 'RETE', stato: 'attivo',
    });

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

    // Raggruppa per {trasportatore normalizzato, regione}
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
    }

    // Trova tariffa matching per gruppo
    function findTariffa(trasKey, regione) {
      // Match esatto su regione
      for (const t of tariffe) {
        const tKey = normalizzaRagioneSociale(t.fornitore_nome);
        if (tKey !== trasKey) continue;
        const tReg = (t.regione || '').trim().toUpperCase();
        if (tReg && tReg === regione.toUpperCase()) return t;
      }
      // Match senza regione (tariffa generica per fornitore)
      for (const t of tariffe) {
        const tKey = normalizzaRagioneSociale(t.fornitore_nome);
        if (tKey !== trasKey) continue;
        if (!t.regione || !t.regione.trim()) return t;
      }
      return null;
    }

    const dettaglio = [];
    let totale_complessivo = 0;

    for (const g of gruppi.values()) {
      const tariffa = findTariffa(g.trasKey, g.regione);
      const totale_t = g.totale_peso_kg / 1000;
      const num_viaggi = g.viaggiSet.size;
      const eer = Array.from(g.eer_set).join(', ');
      const classi = Array.from(g.classi_set).join(', ');

      let totale_euro = 0;
      let tariffa_valore = 0;
      let unita_misura = '';
      let has_tariffa = false;

      if (tariffa) {
        has_tariffa = true;
        tariffa_valore = tariffa.valore;
        unita_misura = tariffa.unita_misura;
        const um = (tariffa.unita_misura || '').toLowerCase();
        if (um.includes('viaggio') || um.includes('vg')) {
          totale_euro = num_viaggi * tariffa.valore;
        } else {
          // €/t o €/ton o €/kg
          totale_euro = um.includes('kg') ? g.totale_peso_kg * tariffa.valore : totale_t * tariffa.valore;
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