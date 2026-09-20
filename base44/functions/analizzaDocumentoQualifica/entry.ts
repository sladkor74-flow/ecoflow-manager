import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { analizzaDocumento } from "../../shared/analisiDocumento.ts";

// Analizza un documento di qualifica: e' quello che parte quando se ne carica uno.
// Il lavoro vero sta in shared/analisiDocumento.ts, perche' lo fa anche il
// presidio automatico che ogni giorno recupera i documenti rimasti indietro: un
// documento si controlla allo stesso modo comunque lo si guardi.
//
// Payload: { documento_id, contesto: { nome, piva, codice_fiscale } }

export default async function(req) {
  let base44 = null;
  let documentoId = null;
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
    const body = await req.json();
    documentoId = body.documento_id;
    const contesto = body.contesto || {};
    if (!documentoId) return Response.json({ error: 'documento_id obbligatorio' }, { status: 400 });

    const svc = base44.asServiceRole.entities;
    const doc = await svc.DocumentoQualifica.get(documentoId);
    if (!doc) return Response.json({ error: 'Documento non trovato' }, { status: 404 });
    const tipo = await svc.TipoDocumentoQualifica.get(doc.tipo_documento_id);
    if (!tipo) return Response.json({ error: 'Tipo di documento non trovato nel catalogo' }, { status: 404 });
    if (!doc.file_uri) return Response.json({ error: 'Il documento non ha un file allegato' }, { status: 400 });

    await svc.DocumentoQualifica.update(documentoId, {
      analisi_stato: 'in_corso', analisi_avviata_il: new Date().toISOString(), errore_analisi: '',
    });

    const esito = await analizzaDocumento(base44, { doc, tipo, contesto });
    return Response.json({ ok: true, ...esito });
  } catch (error) {
    const messaggio = error && error.message ? error.message : String(error);
    if (base44 && documentoId) {
      try {
        await base44.asServiceRole.entities.DocumentoQualifica.update(documentoId, { analisi_stato: 'errore', errore_analisi: messaggio });
      } catch (_e) { /* il messaggio d'errore principale resta quello da restituire */ }
    }
    return Response.json({ error: messaggio }, { status: 500 });
  }
}
