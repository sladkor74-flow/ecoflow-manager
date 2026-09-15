import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { PROV_TO_REGION } from "../../shared/raccoltoCalculator.ts";

// Archivio d'origine di ogni voce, per ricavare la regione del ritiro quando la voce
// non l'ha salvata (es. extra raccolta inserita con la sola provincia).
const ORIGINI = { TERMINATI_RETE: 'PrimariaRete', ACI: 'PrimariaAci', EXTRA_RACCOLTA: 'ExtraRaccolta' };

// Recupera il dettaglio della fatturazione attiva per un periodo:
// Restituisce i 3 documenti (RETE, ACI, EXTRA_RACCOLTA) con le relative righe
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { anno, mese } = await req.json();

    const docs = await base44.asServiceRole.entities.DocumentoFatturazione.filter({
      tipo: 'ATTIVA', anno: Number(anno), mese
    });

    const result = {};
    for (const tipologia of ['RETE', 'ACI', 'EXTRA_RACCOLTA']) {
      const doc = docs.find(d => d.tipologia === tipologia);
      if (!doc) {
        result[tipologia] = { documento: null, righe: [], totale: 0 };
        continue;
      }
      const righe = await base44.asServiceRole.entities.VoceFatturazione.filter({
        documento_id: doc.id
      }, 'fatturante', 5000);
      // Solo per la visualizzazione: la voce salvata e il suo importo non cambiano.
      for (const r of righe) {
        if (r.regione || !r.origine_record_id || !ORIGINI[r.origine_dato]) continue;
        const origine = await base44.asServiceRole.entities[ORIGINI[r.origine_dato]].get(r.origine_record_id).catch(() => null);
        if (origine) r.regione = origine.regione || PROV_TO_REGION[String(origine.provincia || '').toUpperCase().trim()] || '';
      }
      result[tipologia] = { documento: doc, righe, totale: doc.totale || 0 };
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}