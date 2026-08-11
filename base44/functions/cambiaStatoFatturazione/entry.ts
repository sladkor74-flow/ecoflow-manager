import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Cambia lo stato di un documento di fatturazione:
// azione: 'verifica' | 'approva' | 'chiudi' | 'riapri'
// Flusso: elaborata → verificata → approvata → chiusa
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { documento_id, azione } = await req.json();
    if (!documento_id || !azione) return Response.json({ error: 'documento_id e azione obbligatori' }, { status: 400 });

    const doc = await base44.asServiceRole.entities.DocumentoFatturazione.get(documento_id);

    if (azione === 'verifica') {
      const voci = await base44.asServiceRole.entities.VoceFatturazione.filter({ documento_id });
      const errori = voci.filter(v => v.stato_validazione === 'errore').length;
      const newState = errori > 0 ? 'elaborata' : 'verificata';
      await base44.asServiceRole.entities.DocumentoFatturazione.update(documento_id, {
        stato: newState, data_verifica: new Date().toISOString(), voci_errore: errori,
      });
      return Response.json({ stato: newState, errori });
    }

    if (azione === 'approva') {
      if (doc.stato !== 'verificata') return Response.json({ error: 'Verificare prima di approvare' }, { status: 400 });
      await base44.asServiceRole.entities.DocumentoFatturazione.update(documento_id, {
        stato: 'approvata', data_approvazione: new Date().toISOString(),
      });
      return Response.json({ stato: 'approvata' });
    }

    if (azione === 'chiudi') {
      if (doc.stato !== 'approvata') return Response.json({ error: 'Approvare prima di chiudere' }, { status: 400 });
      await base44.asServiceRole.entities.DocumentoFatturazione.update(documento_id, {
        stato: 'chiusa', data_chiusura: new Date().toISOString(),
      });
      return Response.json({ stato: 'chiusa' });
    }

    if (azione === 'riapri') {
      await base44.asServiceRole.entities.DocumentoFatturazione.update(documento_id, {
        stato: 'elaborata', data_chiusura: null, data_approvazione: null, data_verifica: null,
      });
      return Response.json({ stato: 'elaborata' });
    }

    return Response.json({ error: 'Azione non riconosciuta' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}