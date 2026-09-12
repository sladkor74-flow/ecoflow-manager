import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";

// Seed idempotente dei record GiacenzaStoccaggio (rilevazione manuale del saldo reale portale).
// Payload { simula: true } (default): restituisce il riepilogo senza scrivere.
// Payload { simula: false }: inserisce i record mancanti.
// Idempotente rispetto alla coppia sito + data_rilevazione.
// Richiede ruolo admin.

const DATA_RILEVAZIONE = '2026-09-13';

// sito, id unita', descrizione, comune, provincia, class1, class2, class3, class4, class9 (kg)
const RILEVAZIONI = [
  { sito: 'Nappi Sud Srl A Socio Unico', id_unita_stoccaggio: 30041, descrizione_unita: 'Stoc/NAPPI SUD SRL', comune: 'Battipaglia', provincia: 'SA', class1_kg: 19739, class2_kg: 19449, class3_kg: 350, class4_kg: 0, class9_kg: 0 },
  { sito: 'PRT SRL', id_unita_stoccaggio: 30045, descrizione_unita: 'Stoc/PRT SRL', comune: 'Sarno', provincia: 'SA', class1_kg: 0, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 0 },
  { sito: 'Irigom S.r.l.', id_unita_stoccaggio: 38386, descrizione_unita: 'Stoc/Irigom S.r.l.', comune: 'Massafra', provincia: 'TA', class1_kg: 0, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 10060 },
  { sito: 'T-CYCLE INDUSTRIES SRL', id_unita_stoccaggio: 38490, descrizione_unita: 'Stoc/T-CYCLE INDUSTRIES SRL', comune: 'Teverola', provincia: 'CE', class1_kg: 0, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 0 },
  { sito: 'GATIM S.R.L.', id_unita_stoccaggio: 38492, descrizione_unita: 'Stoc/GATIM S.R.L.', comune: 'Lamezia Terme', provincia: 'CZ', class1_kg: 0, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 0 },
  { sito: 'GREEN TYRE PROJECT SRL', id_unita_stoccaggio: 38496, descrizione_unita: 'Stoc/GREEN TYRE PROJECT SRL', comune: 'Prizzi', provincia: 'PA', class1_kg: 0, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 0 },
];

export default async function(req) {
  const base44 = createClientFromRequest(req);

  const me = await base44.auth.me();
  if (!me || me.role !== 'admin') {
    return Response.json({ error: "Solo gli amministratori possono eseguire questa operazione" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const simula = body.simula !== false;

  // Carica tutti i record esistenti
  const esistenti = await fetchAll(base44.asServiceRole.entities.GiacenzaStoccaggio);

  // Idempotenza rispetto a sito normalizzato + data_rilevazione
  const chiaviEsistenti = new Set(
    esistenti.map(r => `${normalizzaRagioneSociale(r.sito)}|${String(r.data_rilevazione || '').slice(0, 10)}`)
  );

  const daCreare = [];
  const ignorati = [];
  const errori = [];

  for (const r of RILEVAZIONI) {
    const chiave = `${normalizzaRagioneSociale(r.sito)}|${DATA_RILEVAZIONE}`;
    if (chiaviEsistenti.has(chiave)) {
      ignorati.push({ sito: r.sito, data_rilevazione: DATA_RILEVAZIONE, motivo: 'gia presente' });
    } else {
      daCreare.push({ ...r, data_rilevazione: DATA_RILEVAZIONE });
    }
  }

  let creati = 0;
  if (!simula && daCreare.length > 0) {
    for (const rec of daCreare) {
      try {
        await base44.asServiceRole.entities.GiacenzaStoccaggio.create(rec);
        creati++;
      } catch (e) {
        errori.push({ sito: rec.sito, errore: e.message || String(e) });
      }
    }
  }

  return Response.json({
    data_rilevazione: DATA_RILEVAZIONE,
    simula,
    totali_in_seed: RILEVAZIONI.length,
    da_creare: daCreare.length,
    creati: simula ? 0 : creati,
    ignorati: ignorati.length,
    errori: errori.length,
    dettaglio_da_creare: daCreare,
    dettaglio_ignorati: ignorati,
    dettaglio_errori: errori
  });
}