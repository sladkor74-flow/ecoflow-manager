import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Gestisce le operazioni di scrittura su entità anagrafiche (Tariffa, Fornitore, FornitoreSecondaria, Servizio).
// Solo l'amministratore può eseguire creazione/modifica/cancellazione.
// Payload: { entita, operazione, id?, dati? }
// - entita: "Tariffa" | "Fornitore" | "FornitoreSecondaria" | "Servizio"
// - operazione: "create" | "update" | "delete"
// - id: richiesto per update e delete
// - dati: oggetto con i campi da creare/aggiornare
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: "Forbidden: solo l'amministratore può modificare tariffe e anagrafiche" }, { status: 403 });

    const { entita, operazione, id, dati } = await req.json();

    const ENTITA_AMMESSE = ['Tariffa', 'Fornitore', 'FornitoreSecondaria', 'Servizio'];
    const OPERAZIONI_AMMESSE = ['create', 'update', 'delete'];

    if (!ENTITA_AMMESSE.includes(entita)) {
      return Response.json({ error: 'Entità non ammessa. Valori validi: ' + ENTITA_AMMESSE.join(', ') }, { status: 400 });
    }
    if (!OPERAZIONI_AMMESSE.includes(operazione)) {
      return Response.json({ error: 'Operazione non ammessa. Valori validi: ' + OPERAZIONI_AMMESSE.join(', ') }, { status: 400 });
    }
    if ((operazione === 'update' || operazione === 'delete') && !id) {
      return Response.json({ error: 'ID obbligatorio per update e delete' }, { status: 400 });
    }

    let result;
    if (operazione === 'create') {
      result = await base44.asServiceRole.entities[entita].create(dati || {});
    } else if (operazione === 'update') {
      result = await base44.asServiceRole.entities[entita].update(id, dati || {});
    } else if (operazione === 'delete') {
      await base44.asServiceRole.entities[entita].delete(id);
      result = { id, deleted: true };
    }

    return Response.json({ result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}