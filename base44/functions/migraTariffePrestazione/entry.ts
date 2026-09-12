import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';
import { fetchAll } from '../../shared/fetchAll.ts';

// Migrazione tariffe e fornitori al modello a prestazione uniforme.
// - Fornitori: imposta i booleani ruolo_* in base al campo tipo e ai doppio_ruolo di FornitoreSecondaria.
// - Tariffe: imposta prestazione in base a servizio_nome; normalizza unita_misura (€/ton->€/t, €/vg->€/viaggio).
// Payload: { simula: true } per il riepilogo senza scritture.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const b = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const simula = body?.simula === true;

    // === 1. FORNITORI ===
    const fornitori = await fetchAll(b.entities.Fornitore);
    const fornitoriSecondarie = await fetchAll(b.entities.FornitoreSecondaria);

    // Set di nomi normalizzati con ruolo doppio_ruolo
    const doppiRuoli = new Set();
    for (const fs of fornitoriSecondarie) {
      if (fs.ruolo === 'doppio_ruolo') {
        doppiRuoli.add(normalizzaRagioneSociale(fs.nome));
      }
    }

    const fornitoriUpdates = [];
    for (const f of fornitori) {
      const update = {};
      const tipo = String(f.tipo || '').toLowerCase().trim();
      if (tipo === 'trasportatore' && !f.ruolo_raccolta) update.ruolo_raccolta = true;
      else if (tipo === 'impianto' && !f.ruolo_trattamento) update.ruolo_trattamento = true;
      else if (tipo === 'stoccaggio' && !f.ruolo_stoccaggio) update.ruolo_stoccaggio = true;

      // Doppio ruolo da FornitoreSecondaria
      const norm = normalizzaRagioneSociale(f.ragione_sociale);
      if (doppiRuoli.has(norm)) {
        if (!f.ruolo_trattamento) update.ruolo_trattamento = true;
        if (!f.ruolo_stoccaggio) update.ruolo_stoccaggio = true;
      }

      if (Object.keys(update).length > 0) {
        fornitoriUpdates.push({ id: f.id, ...update });
      }
    }

    // === 2. TARIFFE ===
    const tariffe = await fetchAll(b.entities.Tariffa);
    const tariffeUpdates = [];
    const senzaPrestazione = [];
    const conteggioPrestazioni = { RACCOLTA: 0, TRASPORTO_SECONDARIA: 0, TRATTAMENTO: 0, CONFERIMENTO_STOCCAGGIO: 0 };

    for (const t of tariffe) {
      const sn = String(t.servizio_nome || '').toUpperCase().trim();
      const direzione = String(t.direzione || '').toUpperCase().trim();
      const tipologia = String(t.tipologia || '').toUpperCase().trim();
      let prestazione = '';

      if (direzione === 'PASSIVA' && tipologia === 'RETE' && sn.includes('TRASPORTO RETE')) {
        prestazione = 'RACCOLTA';
      } else if (sn.includes('TRASPORTO') && sn.includes('SECONDARIA')) {
        prestazione = 'TRASPORTO_SECONDARIA';
      } else if (sn.includes('TRATTAMENTO')) {
        prestazione = 'TRATTAMENTO';
      } else if (sn.includes('STOCCAGGIO')) {
        prestazione = 'CONFERIMENTO_STOCCAGGIO';
      } else if (sn.includes('TRASPORTO')) {
        prestazione = 'RACCOLTA';
      }

      // Normalizza unita_misura
      let unita = t.unita_misura;
      let unitaChanged = false;
      if (unita === '€/ton') { unita = '€/t'; unitaChanged = true; }
      else if (unita === '€/vg') { unita = '€/viaggio'; unitaChanged = true; }

      const update = { id: t.id };
      if (prestazione && t.prestazione !== prestazione) {
        update.prestazione = prestazione;
        conteggioPrestazioni[prestazione]++;
      }
      if (unitaChanged) {
        update.unita_misura = unita;
      }
      if (Object.keys(update).length > 1) {
        tariffeUpdates.push(update);
      }
      if (!prestazione) {
        senzaPrestazione.push({ id: t.id, fornitore_nome: t.fornitore_nome, servizio_nome: t.servizio_nome });
      }
    }

    if (simula) {
      return Response.json({
        simula: true,
        fornitori_totali: fornitori.length,
        fornitori_da_aggiornare: fornitoriUpdates.length,
        tariffe_totali: tariffe.length,
        tariffe_aggiornate: conteggioPrestazioni,
        tariffe_senza_prestazione: senzaPrestazione,
      });
    }

    // Esegui scritture in chunk
    for (let i = 0; i < fornitoriUpdates.length; i += 100) {
      await b.entities.Fornitore.bulkUpdate(fornitoriUpdates.slice(i, i + 100));
      await new Promise(r => setTimeout(r, 200));
    }
    for (let i = 0; i < tariffeUpdates.length; i += 100) {
      await b.entities.Tariffa.bulkUpdate(tariffeUpdates.slice(i, i + 100));
      await new Promise(r => setTimeout(r, 200));
    }

    return Response.json({
      simula: false,
      fornitori_aggiornati: fornitoriUpdates.length,
      tariffe_aggiornate: conteggioPrestazioni,
      tariffe_senza_prestazione: senzaPrestazione,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}