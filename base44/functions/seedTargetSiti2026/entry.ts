import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";

// Seed idempotente dei record GiacenzaSito (target e tipologia trattamento) per l'anno 2026.
// Payload { simula: true } (default): restituisce il riepilogo senza scrivere.
// Payload { simula: false }: inserisce i record mancanti.
// Richiede ruolo admin.
const ANNO = 2026;

const TARGET_2026 = [
  { sito: 'GREEN TYRE PROJECT SRL', tipo_destinazione: 'imp', target_primarie_t: 2500, target_totale_t: 2500, giacenza_riferimento_t: 0, tipologia_trattamento: 'EoW' },
  { sito: 'Irigom S.r.l.', tipo_destinazione: 'imp', target_primarie_t: 3400, target_totale_t: 4445, giacenza_riferimento_t: 385.36, tipologia_trattamento: 'Frantumazione/R1' },
  { sito: 'NAPPI SUD SRL', tipo_destinazione: 'stoc', target_primarie_t: 2295, target_totale_t: 0, giacenza_riferimento_t: 34.96, tipologia_trattamento: 'n.a.' },
  { sito: 'T.R.S.  SRL', tipo_destinazione: 'imp', target_primarie_t: 300, target_totale_t: 300, giacenza_riferimento_t: 0, tipologia_trattamento: 'EoW' },
  { sito: 'T-CYCLE INDUSTRIES SRL', tipo_destinazione: 'imp', target_primarie_t: 1050, target_totale_t: 1050, giacenza_riferimento_t: 0, tipologia_trattamento: 'Frantumazione/R1' },
  { sito: 'T-CYCLE INDUSTRIES SRL', tipo_destinazione: 'stoc', target_primarie_t: 250, target_totale_t: 0, giacenza_riferimento_t: 0, tipologia_trattamento: 'n.a.' },
  { sito: 'Gatim', tipo_destinazione: 'imp', target_primarie_t: 950, target_totale_t: 950, giacenza_riferimento_t: 0, tipologia_trattamento: 'EoW' },
  { sito: 'TECNOGUM SRL', tipo_destinazione: 'imp', target_primarie_t: 800, target_totale_t: 2295, giacenza_riferimento_t: 0, tipologia_trattamento: 'n.a.' },
];

export async function POST(req) {
  const base44 = conLimiteRichieste(createClientFromRequest(req));

  // Controllo ruolo admin
  const me = await base44.auth.me();
  if (!me || me.role !== 'admin') {
    return Response.json({ error: "Solo gli amministratori possono eseguire questa operazione" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const simula = body.simula !== false;

  // Carica i record GiacenzaSito esistenti per l'anno 2026
  const esistenti = await fetchAll(() =>
    base44.asServiceRole.entities.GiacenzaSito.filter({ anno: ANNO }, '-created_date', 500)
  );

  // Mappa chiavi normalizzate: sito|tipo_destinazione
  const chiaviEsistenti = new Set(
    esistenti.map(r => `${normalizzaRagioneSociale(r.sito)}|${r.tipo_destinazione}`)
  );

  const daCreare = [];
  const ignorati = [];
  const errori = [];

  for (const t of TARGET_2026) {
    const chiave = `${normalizzaRagioneSociale(t.sito)}|${t.tipo_destinazione}`;
    if (chiaviEsistenti.has(chiave)) {
      ignorati.push({ sito: t.sito, tipo_destinazione: t.tipo_destinazione, motivo: 'gia presente' });
    } else {
      daCreare.push({ ...t, anno: ANNO });
    }
  }

  let creati = 0;
  if (!simula && daCreare.length > 0) {
    for (const rec of daCreare) {
      try {
        await base44.asServiceRole.entities.GiacenzaSito.create(rec);
        creati++;
      } catch (e) {
        errori.push({ sito: rec.sito, tipo_destinazione: rec.tipo_destinazione, errore: e.message || String(e) });
      }
    }
  }

  return Response.json({
    anno: ANNO,
    simula,
    totali_in_seed: TARGET_2026.length,
    da_creare: daCreare.length,
    creati: simula ? 0 : creati,
    ignorati: ignorati.length,
    errori: errori.length,
    dettaglio_da_creare: daCreare,
    dettaglio_ignorati: ignorati,
    dettaglio_errori: errori
  });
}