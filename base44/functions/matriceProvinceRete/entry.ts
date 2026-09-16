import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { fetchAll } from "../../shared/fetchAll.ts";

// Raccolta della RETE per provincia e mese: peso effettivo e numero di ritiri.
//
// Riprende le due tabelle che stavano nel foglio "TERMINATI RETE" del file Excel,
// prendendo pero' i dati dal gestionale. Solo il canale RETE: ACI ed extra
// raccolta restano separati, come sempre.
//
// Il mese e' quello di fine trasporto, la stessa data con cui il gestionale
// misura tutto il resto; si contano i soli ordini terminati e il peso e' quello
// effettivo, mai lo stimato.
//
// Payload: { anno }   Risposta: { anno, anni, mesi, righe, totali }

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const giorno = (v) => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s) ? s : null;
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const record = await fetchAll(base44.asServiceRole.entities.PrimariaRete);

    const anni = new Set();
    for (const r of record) {
      const d = giorno(r.trasporto_finito_il);
      if (d && String(r.stato || '').toLowerCase().trim() === 'terminato') anni.add(Number(d.slice(0, 4)));
    }
    const anno = Number(body.anno) || Math.max(...anni, new Date().getFullYear());

    const province = new Map();
    for (const r of record) {
      if (String(r.stato || '').toLowerCase().trim() !== 'terminato') continue;
      const d = giorno(r.trasporto_finito_il);
      if (!d || Number(d.slice(0, 4)) !== anno) continue;
      const sigla = String(r.provincia || r.sigla || '').toUpperCase().trim();
      if (!sigla) continue;
      if (!province.has(sigla)) {
        province.set(sigla, { provincia: sigla, regione: String(r.regione || '').trim(), kg: MESI.map(() => 0), ritiri: MESI.map(() => 0) });
      }
      const riga = province.get(sigla);
      if (!riga.regione && r.regione) riga.regione = String(r.regione).trim();
      const mese = Number(d.slice(5, 7)) - 1;
      riga.kg[mese] += Math.round(Number(r.peso_effettivo) || 0);
      riga.ritiri[mese] += 1;
    }

    const righe = [...province.values()]
      .map(r => ({ ...r, kg_totale: r.kg.reduce((t, v) => t + v, 0), ritiri_totale: r.ritiri.reduce((t, v) => t + v, 0) }))
      .sort((a, b) => a.regione.localeCompare(b.regione, 'it') || a.provincia.localeCompare(b.provincia, 'it'));

    const totali = {
      kg: MESI.map((_, i) => righe.reduce((t, r) => t + r.kg[i], 0)),
      ritiri: MESI.map((_, i) => righe.reduce((t, r) => t + r.ritiri[i], 0)),
      kg_totale: righe.reduce((t, r) => t + r.kg_totale, 0),
      ritiri_totale: righe.reduce((t, r) => t + r.ritiri_totale, 0),
    };

    return Response.json({ anno, anni: [...anni].sort((a, b) => b - a), mesi: MESI, righe, totali });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
