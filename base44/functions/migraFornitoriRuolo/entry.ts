import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';

// Migrazione automatica: mappa il campo deprecato `tipo` al nuovo `ruolo`.
// - tipo=stoccaggio -> ruolo=stoccaggio
// - tipo=primaria_diretta -> ruolo=raccoglitore (default)
// - impianti noti (IRIGOM, TECNOGUM) -> ruolo=impianto
// - T-CYCLE -> ruolo=doppio_ruolo
// Aggiorna i record in chunked 100+200ms. Campo `tipo` mantenuto per retrocompatibilita'.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const b = base44.asServiceRole;

    const fornitori = await b.entities.FornitoreSecondaria.list('-created_date', 1000);

    const updates = [];
    let giaMigrati = 0;

    for (const f of fornitori) {
      // Salta se ruolo gia' impostato
      if (f.ruolo) { giaMigrati++; continue; }

      const norm = normalizzaRagioneSociale(f.nome);
      let ruolo;

      if (norm === 't-cycle') {
        ruolo = 'doppio_ruolo';
      } else if (norm === 'irigom' || norm === 'tecnogum') {
        ruolo = 'impianto';
      } else if (String(f.tipo || '').toLowerCase() === 'stoccaggio') {
        ruolo = 'stoccaggio';
      } else {
        ruolo = 'raccoglitore';
      }

      updates.push({ id: f.id, ruolo });
    }

    for (let i = 0; i < updates.length; i += 100) {
      await b.entities.FornitoreSecondaria.bulkUpdate(updates.slice(i, i + 100));
      await new Promise(r => setTimeout(r, 200));
    }

    return Response.json({
      totali: fornitori.length,
      gia_migrati: giaMigrati,
      migrati: updates.length,
      dettaglio: updates.map(u => {
        const f = fornitori.find(x => x.id === u.id);
        return { nome: f?.nome, vecchio_tipo: f?.tipo, nuovo_ruolo: u.ruolo };
      }),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}