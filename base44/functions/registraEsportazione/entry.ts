import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { rispostaSolaLettura } from "../../shared/permessi.ts";

// Registra un'esportazione di fatturazione e aggiorna lo stato dei documenti
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
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

    // Lo stato avanza a "esportata" solo da "approvata": esportare una bozza per
    // guardarla si puo', ma non fa saltare verifica e approvazione (prima bastava
    // un'esportazione per arrivare alla chiusura senza passare dai controlli).
    // La data dell'esportazione si scrive comunque.
    for (const docId of (documento_ids || [])) {
      try {
        const doc = await base44.asServiceRole.entities.DocumentoFatturazione.get(docId);
        if (!doc || doc.superato || doc.stato === 'chiusa') continue;
        await base44.asServiceRole.entities.DocumentoFatturazione.update(docId, {
          ...(doc.stato === 'approvata' ? { stato: 'esportata' } : {}),
          data_esportazione: new Date().toISOString(),
        });
      } catch (e) { /* il registro dell'esportazione e' gia' scritto */ }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}