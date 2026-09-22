import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";

// Seed idempotente di GiacenzaSito e DichiarazioneSito per l'anno 2026.
// Payload { simula: true } (default): restituisce il riepilogo senza scrivere.
// Payload { simula: false }: inserisce i record mancanti.
// Richiede ruolo admin.
const GIACENZE_2026 = [
  { sito: 'GREEN TYRE PROJECT SRL', tipo_destinazione: 'imp', target_primarie_t: 2500, target_totale_t: 2500, giacenza_iniziale_t: 0, tipologia_trattamento: 'EoW' },
  { sito: 'Irigom S.r.l.', tipo_destinazione: 'imp', target_primarie_t: 3400, target_totale_t: 4445, giacenza_iniziale_t: 385.36, tipologia_trattamento: 'Frantumazione/R1' },
  { sito: 'NAPPI SUD SRL', tipo_destinazione: 'stoc', target_primarie_t: 2295, target_totale_t: 0, giacenza_iniziale_t: 34.96, tipologia_trattamento: 'n.a.' },
  { sito: 'T.R.S.  SRL', tipo_destinazione: 'imp', target_primarie_t: 300, target_totale_t: 300, giacenza_iniziale_t: 0, tipologia_trattamento: 'EoW' },
  { sito: 'T-CYCLE INDUSTRIES SRL', tipo_destinazione: 'imp', target_primarie_t: 1050, target_totale_t: 1050, giacenza_iniziale_t: 0, tipologia_trattamento: 'Frantumazione/R1' },
  { sito: 'T-CYCLE INDUSTRIES SRL', tipo_destinazione: 'stoc', target_primarie_t: 250, target_totale_t: 0, giacenza_iniziale_t: 0, tipologia_trattamento: 'n.a.' },
  { sito: 'Gatim', tipo_destinazione: 'imp', target_primarie_t: 950, target_totale_t: 950, giacenza_iniziale_t: 0, tipologia_trattamento: 'EoW' },
  { sito: 'TECNOGUM SRL', tipo_destinazione: 'imp', target_primarie_t: 800, target_totale_t: 2295, giacenza_iniziale_t: 0, tipologia_trattamento: 'n.a.' },
];

const DICHIARAZIONI_2026 = [
  { sito: 'Gatim', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Gennaio', quantita_kg: 78430, caricata_inviata: true },
  { sito: 'Gatim', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Febbraio', quantita_kg: 74240, caricata_inviata: true },
  { sito: 'Gatim', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Marzo', quantita_kg: 66550, caricata_inviata: true },
  { sito: 'Gatim', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Aprile', quantita_kg: 74470, caricata_inviata: true },
  { sito: 'Gatim', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Maggio', quantita_kg: 71710, caricata_inviata: true },
  { sito: 'Gatim', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Giugno', quantita_kg: 112240, caricata_inviata: false },
  { sito: 'Gatim', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Settembre', quantita_kg: 17940, caricata_inviata: false },
  { sito: 'Gatim', operazione: 'R3', canale: 'ACI', provenienza: 'primaria', mese: 'Aprile', quantita_kg: 8200, caricata_inviata: true },
  { sito: 'Gatim', operazione: 'R3', canale: 'ACI', provenienza: 'primaria', mese: 'Maggio', quantita_kg: 7770, caricata_inviata: true },
  { sito: 'Gatim', operazione: 'R3', canale: 'ACI', provenienza: 'primaria', mese: 'Giugno', quantita_kg: 11340, caricata_inviata: true },
  { sito: 'Gatim', operazione: 'R3', canale: 'ACI', provenienza: 'secondaria', mese: 'Gennaio', quantita_kg: 27000, caricata_inviata: true },
  { sito: 'Gatim', operazione: 'R3', canale: 'ACI', provenienza: 'secondaria', mese: 'Marzo', quantita_kg: 9820, caricata_inviata: true },
  { sito: 'Gatim', operazione: 'R3', canale: 'ACI', provenienza: 'secondaria', mese: 'Aprile', quantita_kg: 14340, caricata_inviata: true },
  { sito: 'Gatim', operazione: 'R3', canale: 'ACI', provenienza: 'secondaria', mese: 'Maggio', quantita_kg: 11900, caricata_inviata: true },
  { sito: 'T.R.S.  SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Gennaio', quantita_kg: 29500, caricata_inviata: true },
  { sito: 'T.R.S.  SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Febbraio', quantita_kg: 25580, caricata_inviata: true },
  { sito: 'T.R.S.  SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Marzo', quantita_kg: 18700, caricata_inviata: true },
  { sito: 'T.R.S.  SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Aprile', quantita_kg: 18960, caricata_inviata: true },
  { sito: 'T.R.S.  SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Maggio', quantita_kg: 29920, caricata_inviata: true },
  { sito: 'T.R.S.  SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Giugno', quantita_kg: 31600, caricata_inviata: true },
  { sito: 'T.R.S.  SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Luglio', quantita_kg: 40940, caricata_inviata: true },
  { sito: 'T.R.S.  SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Agosto', quantita_kg: 9500, caricata_inviata: false },
  { sito: 'T.R.S.  SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Settembre', quantita_kg: 12680, caricata_inviata: false },
  { sito: 'T.R.S.  SRL', operazione: 'R3', canale: 'ACI', provenienza: 'secondaria', mese: 'Luglio', quantita_kg: 13640, caricata_inviata: true },
  { sito: 'GREEN TYRE PROJECT SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Gennaio', quantita_kg: 178860, caricata_inviata: true },
  { sito: 'GREEN TYRE PROJECT SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Febbraio', quantita_kg: 185300, caricata_inviata: true },
  { sito: 'GREEN TYRE PROJECT SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Marzo', quantita_kg: 147460, caricata_inviata: true },
  { sito: 'GREEN TYRE PROJECT SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Aprile', quantita_kg: 194420, caricata_inviata: true },
  { sito: 'GREEN TYRE PROJECT SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Maggio', quantita_kg: 244340, caricata_inviata: true },
  { sito: 'GREEN TYRE PROJECT SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Giugno', quantita_kg: 248220, caricata_inviata: true },
  { sito: 'GREEN TYRE PROJECT SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Luglio', quantita_kg: 256140, caricata_inviata: false },
  { sito: 'GREEN TYRE PROJECT SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Agosto', quantita_kg: 94700, caricata_inviata: false },
  { sito: 'GREEN TYRE PROJECT SRL', operazione: 'R3', canale: 'RETE', provenienza: '', mese: 'Settembre', quantita_kg: 105740, caricata_inviata: false },
  { sito: 'GREEN TYRE PROJECT SRL', operazione: 'R3', canale: 'ACI', provenienza: '', mese: 'Maggio', quantita_kg: 2680, caricata_inviata: true },
  { sito: 'GREEN TYRE PROJECT SRL', operazione: 'R3', canale: 'ACI', provenienza: '', mese: 'Luglio', quantita_kg: 2640, caricata_inviata: true },
  { sito: 'TECNOGUM SRL', operazione: 'R3', canale: 'ACI', provenienza: 'secondaria', mese: 'Marzo', quantita_kg: 2140, caricata_inviata: true },
  { sito: 'TECNOGUM SRL', operazione: 'R3', canale: 'ACI', provenienza: 'secondaria', mese: 'Giugno', quantita_kg: 7480, caricata_inviata: true },
  { sito: 'TECNOGUM SRL', operazione: 'R3', canale: 'ACI', provenienza: 'secondaria', mese: 'Luglio', quantita_kg: 1820, caricata_inviata: true },
  { sito: 'TECNOGUM SRL', operazione: 'R3', canale: 'ACI', provenienza: 'secondaria', mese: 'Agosto', quantita_kg: 6640, caricata_inviata: false },
  { sito: 'T-CYCLE INDUSTRIES SRL', operazione: 'R1', canale: 'RETE', provenienza: '', mese: 'Marzo', quantita_kg: 146860, caricata_inviata: true },
  { sito: 'T-CYCLE INDUSTRIES SRL', operazione: 'R1', canale: 'RETE', provenienza: '', mese: 'Giugno', quantita_kg: 195780, caricata_inviata: true },
  { sito: 'Irigom S.r.l.', operazione: 'R1', canale: 'RETE', provenienza: '', mese: 'Gennaio', quantita_kg: 67180, caricata_inviata: true },
  { sito: 'Irigom S.r.l.', operazione: 'R1', canale: 'RETE', provenienza: '', mese: 'Febbraio', quantita_kg: 721660, caricata_inviata: true },
  { sito: 'Irigom S.r.l.', operazione: 'R1', canale: 'RETE', provenienza: '', mese: 'Marzo', quantita_kg: 262720, caricata_inviata: true },
  { sito: 'Irigom S.r.l.', operazione: 'R1', canale: 'RETE', provenienza: '', mese: 'Maggio', quantita_kg: 744170, caricata_inviata: true },
  { sito: 'Irigom S.r.l.', operazione: 'R1', canale: 'RETE', provenienza: '', mese: 'Giugno', quantita_kg: 544610, caricata_inviata: true },
  { sito: 'Irigom S.r.l.', operazione: 'R3', canale: 'EXTRA_RACCOLTA', provenienza: '', mese: 'Aprile', quantita_kg: 400, caricata_inviata: true },
  { sito: 'Irigom S.r.l.', operazione: 'R3', canale: 'EXTRA_RACCOLTA', provenienza: '', mese: 'Luglio', quantita_kg: 460, caricata_inviata: false },
];

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
    const { simula = true } = await req.json();
    const norm = normalizzaRagioneSociale;
    const tdNorm = (v) => String(v || '').toLowerCase().trim();

    const [existingGiac, existingDich] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.GiacenzaSito, { anno: 2026 }),
      fetchAll(base44.asServiceRole.entities.DichiarazioneSito, { anno: 2026 }),
    ]);

    const giacKeys = new Set(existingGiac.map(g => norm(g.sito) + '|' + tdNorm(g.tipo_destinazione)));
    const dichKeys = new Set(existingDich.map(d => norm(d.sito) + '|' + d.operazione + '|' + d.canale + '|' + (d.provenienza || '') + '|' + d.mese));

    const giacToCreate = GIACENZE_2026.filter(g => !giacKeys.has(norm(g.sito) + '|' + g.tipo_destinazione));
    const dichToCreate = DICHIARAZIONI_2026.filter(d => !dichKeys.has(norm(d.sito) + '|' + d.operazione + '|' + d.canale + '|' + (d.provenienza || '') + '|' + d.mese));

    const summary = {
      giacenze_da_creare: giacToCreate.length,
      giacenze_gia_presenti: GIACENZE_2026.length - giacToCreate.length,
      dichiarazioni_da_creare: dichToCreate.length,
      dichiarazioni_gia_presenti: DICHIARAZIONI_2026.length - dichToCreate.length,
    };

    if (simula) {
      return Response.json({ simula: true, ...summary });
    }

    for (let i = 0; i < giacToCreate.length; i += 50) {
      await base44.asServiceRole.entities.GiacenzaSito.bulkCreate(giacToCreate.slice(i, i + 50).map(g => ({ ...g, anno: 2026 })));
    }
    for (let i = 0; i < dichToCreate.length; i += 50) {
      await base44.asServiceRole.entities.DichiarazioneSito.bulkCreate(dichToCreate.slice(i, i + 50).map(d => ({ ...d, anno: 2026 })));
    }

    return Response.json({ simula: false, ...summary, creati: { giacenze: giacToCreate.length, dichiarazioni: dichToCreate.length } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}