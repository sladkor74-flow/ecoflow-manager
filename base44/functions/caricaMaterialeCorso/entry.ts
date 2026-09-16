import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { rispostaSolaLettura } from "../../shared/permessi.ts";

// Materiale del corso RT: caricamento delle parti di testo e stato dell'elaborazione.
//
// Payload:
//   { azione: 'carica', parti: [{ chiave, tipo, categoria, modulo, fonte_file, anno_materiale, parte, parti_totali, ordine, testo }] }
//     solo amministratori; le parti gia' presenti (stessa chiave) non si ricaricano.
//   { azione: 'stato' } conteggi per categoria e modulo, per tutti gli utenti.

const TIPI = ['dispensa', 'videolezione'];
const MAX_TESTO = 12000;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const ent = base44.asServiceRole.entities.MaterialeCorso;

    const tutte = async (campi) => {
      const out = [];
      for (let skip = 0; skip < 50000; skip += 1000) {
        const pagina = await ent.list('ordine', 1000, skip, campi);
        out.push(...pagina);
        if (pagina.length < 1000) break;
      }
      return out;
    };

    if (body.azione === 'carica') {
      if (user.role !== 'admin') return rispostaSolaLettura();
      const parti = (Array.isArray(body.parti) ? body.parti : []).filter(p => p && p.chiave && p.fonte_file && p.testo);
      if (!parti.length || parti.length > 50) return Response.json({ error: 'Invia da 1 a 50 parti per volta' }, { status: 400 });
      const presenti = new Set((await tutte(['chiave'])).map(p => p.chiave));
      const nuove = parti
        .filter(p => !presenti.has(String(p.chiave)))
        .map(p => ({
          chiave: String(p.chiave),
          tipo: TIPI.includes(p.tipo) ? p.tipo : 'dispensa',
          categoria: String(p.categoria || ''),
          modulo: String(p.modulo || ''),
          fonte_file: String(p.fonte_file),
          anno_materiale: Number(p.anno_materiale) || null,
          parte: Number(p.parte) || 1,
          parti_totali: Number(p.parti_totali) || null,
          ordine: Number(p.ordine) || 0,
          testo: String(p.testo).slice(0, MAX_TESTO),
          stato: 'da_elaborare',
          tentativi: 0,
        }));
      if (nuove.length) await ent.bulkCreate(nuove);
      return Response.json({ caricate: nuove.length, gia_presenti: parti.length - nuove.length });
    }

    // Stato: conteggi per categoria e modulo.
    const parti = await tutte(['categoria', 'modulo', 'fonte_file', 'tipo', 'stato', 'elaborato_il', 'ordine']);
    const moduli = new Map();
    let ultima = null;
    for (const p of parti) {
      const k = `${p.categoria}|${p.fonte_file}`;
      if (!moduli.has(k)) moduli.set(k, { categoria: p.categoria, modulo: p.modulo, fonte_file: p.fonte_file, tipo: p.tipo, ordine: p.ordine, totale: 0, elaborate: 0, errori: 0 });
      const m = moduli.get(k);
      m.totale++;
      if (p.stato === 'elaborato') m.elaborate++;
      if (p.stato === 'errore') m.errori++;
      if (p.elaborato_il && (!ultima || p.elaborato_il > ultima)) ultima = p.elaborato_il;
    }
    const elenco = [...moduli.values()].sort((a, b) => a.ordine - b.ordine);
    return Response.json({
      totale: parti.length,
      elaborate: parti.filter(p => p.stato === 'elaborato').length,
      errori: parti.filter(p => p.stato === 'errore').length,
      ultima_elaborazione: ultima,
      moduli: elenco,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
