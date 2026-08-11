import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Registra un'esportazione di fatturazione e aggiorna lo stato dei documenti
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tipologia, anno, mese, documento_ids, nome_file, direzione = 'ATTIVA' } = await req.json();

    await base44.asServiceRole.entities.EsportazioneFatturazione.create({
      tipologia, direzione,
      anno: Number(anno), mese,
      documento_ids: documento_ids || [],
      nome_file,
      data_esportazione: new Date().toISOString(),
      utente: user.full_name || user.email || '',
      stato: 'completata',
    });

    // Update documents to esportata
    for (const docId of (documento_ids || [])) {
      try {
        await base44.asServiceRole.entities.DocumentoFatturazione.update(docId, {
          stato: 'esportata',
          data_esportazione: new Date().toISOString(),
        });
      } catch (e) { /* skip */ }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}