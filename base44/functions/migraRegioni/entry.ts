import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';
import { getRegioneFromProvincia } from '../../shared/regioneMap.ts';
import { fetchAll } from "../../shared/fetchAll.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";

// Migrazione one-shot: deriva la regione di pertinenza per raccoglitori, stoccaggi e impianti.
// 1. Elimina i record TargetRaccoglitore ridondanti con regione tra parentesi nel nome (es. "SMOCO S.R.L. (PUGLIA)").
// 2. Raccoglitori: deriva regione da PrimariaRete (regione piu' frequente per trasportatore) solo dove regione e' null.
// 3. Stoccaggi: deriva regione da Secondaria (provincia piu' frequente per stoccaggio -> mappata a regione).
// 4. Impianti: mappatura manuale nota (TECNOGUM, IRIGOM, T-CYCLE = Campania; GREEN TYRE = Sicilia).
// Idempotente: i raccoglitori con regione gia' impostata (split Smoco) vengono preservati.
const IMPIANTI_REGIONE_MANUALE: Record<string, string> = {
  'tecnogum': 'Campania',
  'irigom': 'Campania',
  't-cycle': 'Campania',
  'green tyre project': 'Sicilia',
};

function mostFrequent(counts: Record<string, number>): string | null {
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
    const b = base44.asServiceRole;

    // === 1. Elimina raccoglitori ridondanti con regione tra parentesi nel nome ===
    const raccoglitori = await b.entities.TargetRaccoglitore.list('-created_date', 1000);
    const daEliminare = raccoglitori.filter(r => r.raccoglitore && r.raccoglitore.includes('('));
    for (const r of daEliminare) {
      await b.entities.TargetRaccoglitore.delete(r.id);
    }

    // === 2. Deriva regione raccoglitori da PrimariaRete (solo dove regione e' null) ===
    const primarie = await fetchAll(b.entities.PrimariaRete);
    const regioneCountsByTrasport: Record<string, Record<string, number>> = {};
    for (const p of primarie) {
      if (!p.trasportatore || !p.regione) continue;
      const norm = normalizzaRagioneSociale(p.trasportatore);
      if (!norm) continue;
      if (!regioneCountsByTrasport[norm]) regioneCountsByTrasport[norm] = {};
      regioneCountsByTrasport[norm][p.regione] = (regioneCountsByTrasport[norm][p.regione] || 0) + 1;
    }

    const raccRimasti = raccoglitori.filter(r => !daEliminare.find(e => e.id === r.id));
    const raccUpdates = [];
    for (const r of raccRimasti) {
      if (r.regione) continue; // preserva split Smoco e record gia' impostati
      const norm = normalizzaRagioneSociale(r.raccoglitore);
      const counts = regioneCountsByTrasport[norm];
      if (!counts) continue;
      const regione = mostFrequent(counts);
      if (regione) raccUpdates.push({ id: r.id, regione });
    }

    // === 3. Deriva regione stoccaggi da Secondaria (provincia -> regione) ===
    const secondarie = await fetchAll(b.entities.Secondaria);
    const provCountsByStoc: Record<string, Record<string, number>> = {};
    for (const s of secondarie) {
      if (!s.stoccaggio || !s.provincia) continue;
      const norm = normalizzaRagioneSociale(s.stoccaggio);
      if (!norm) continue;
      if (!provCountsByStoc[norm]) provCountsByStoc[norm] = {};
      provCountsByStoc[norm][s.provincia] = (provCountsByStoc[norm][s.provincia] || 0) + 1;
    }

    const fornitori = await b.entities.FornitoreSecondaria.list('-created_date', 1000);
    const stoccaggi = fornitori.filter(f => f.ruolo === 'stoccaggio' || f.ruolo === 'doppio_ruolo' || (!f.ruolo && String(f.tipo || '').toLowerCase() === 'stoccaggio'));
    const stocUpdates = [];
    for (const f of stoccaggi) {
      const norm = normalizzaRagioneSociale(f.nome);
      const counts = provCountsByStoc[norm];
      if (!counts) continue;
      const provincia = mostFrequent(counts);
      if (!provincia) continue;
      const regione = getRegioneFromProvincia(provincia);
      if (regione) stocUpdates.push({ id: f.id, regione });
    }

    // === 4. Impianti: mappatura manuale nota ===
    const impianti = await b.entities.ImpiantoTargetSecondaria.list('-created_date', 500);
    const impUpdates = [];
    for (const imp of impianti) {
      const norm = normalizzaRagioneSociale(imp.nome_impianto);
      const regione = IMPIANTI_REGIONE_MANUALE[norm];
      if (regione) impUpdates.push({ id: imp.id, regione });
    }

    // === Persistenza chunked ===
    for (let i = 0; i < raccUpdates.length; i += 100) {
      await b.entities.TargetRaccoglitore.bulkUpdate(raccUpdates.slice(i, i + 100));
      await new Promise(r => setTimeout(r, 200));
    }
    for (let i = 0; i < stocUpdates.length; i += 100) {
      await b.entities.FornitoreSecondaria.bulkUpdate(stocUpdates.slice(i, i + 100));
      await new Promise(r => setTimeout(r, 200));
    }
    for (let i = 0; i < impUpdates.length; i += 100) {
      await b.entities.ImpiantoTargetSecondaria.bulkUpdate(impUpdates.slice(i, i + 100));
      await new Promise(r => setTimeout(r, 200));
    }

    return Response.json({
      eliminati: daEliminare.length,
      raccoglitori_aggiornati: raccUpdates.length,
      stoccaggi_aggiornati: stocUpdates.length,
      impianti_aggiornati: impUpdates.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}