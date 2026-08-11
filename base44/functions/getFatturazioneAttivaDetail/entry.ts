import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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
      result[tipologia] = { documento: doc, righe, totale: doc.totale || 0 };
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}