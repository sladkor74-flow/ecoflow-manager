import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Recupera il dettaglio di un documento di fatturazione:
// - Per documento_id o per anno+mese
// - Raggruppa le voci per fornitore
// - Restituisce documento + fornitori (con voci) + totale
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { documento_id, anno, mese } = await req.json();

    let doc;
    if (documento_id) {
      doc = await base44.asServiceRole.entities.DocumentoFatturazione.get(documento_id);
    } else if (anno && mese) {
      const docs = await base44.asServiceRole.entities.DocumentoFatturazione.filter({
        tipo: 'PASSIVA', anno: Number(anno), mese
      });
      doc = docs[0];
    }

    if (!doc) {
      return Response.json({ documento: null, fornitori: [], totale: 0 });
    }

    const voci = await base44.asServiceRole.entities.VoceFatturazione.filter({
      documento_id: doc.id
    }, 'fornitore_nome', 1000);

    // Group by fornitore
    const byForn = {};
    for (const v of voci) {
      const key = v.fornitore_nome || 'N/D';
      if (!byForn[key]) {
        byForn[key] = { fornitore_id: v.fornitore_id, fornitore_nome: v.fornitore_nome, voci: [], totale: 0 };
      }
      byForn[key].voci.push(v);
      byForn[key].totale += v.totale;
    }

    const fornitori = Object.values(byForn).sort((a, b) => b.totale - a.totale);

    return Response.json({ documento: doc, fornitori, totale: doc.totale || 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}