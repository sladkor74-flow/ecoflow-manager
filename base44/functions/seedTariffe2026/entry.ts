import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from '../../shared/fetchAll.ts';
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';
import { rispostaSolaLettura } from "../../shared/permessi.ts";

const DATA_INIZIO = '2026-01-01';
const NOTE = 'Inserita da seedTariffe2026 sulla base dei contratti 2026';

const PREST_TO_RUOLO: Record<string, string> = {
  RACCOLTA: 'ruolo_raccolta',
  TRASPORTO_SECONDARIA: 'ruolo_trasporto_secondaria',
  TRATTAMENTO: 'ruolo_trattamento',
  CONFERIMENTO_STOCCAGGIO: 'ruolo_stoccaggio',
};

const FORNITORI_INTERNI = ['SMOCO S.R.L.'];

interface TariffaSeed {
  fornitore: string;
  prestazione: string;
  tipologia: string;
  unita_misura: string;
  valore: number;
  classe_materiale?: string;
  regione?: string;
  provincia?: string;
  destinazione?: string;
  produttore?: string;
  destinatario?: string;
}

const TARIFFE: TariffaSeed[] = [
  // ── RACCOLTA, RETE, €/t, classe vuota ──
  { fornitore: 'C.L. SERVICE S.R.L.', prestazione: 'RACCOLTA', tipologia: 'RETE', unita_misura: '€/t', valore: 71, regione: 'Campania' },
  { fornitore: 'ECOLOGICAL SYSTEMS SRL', prestazione: 'RACCOLTA', tipologia: 'RETE', unita_misura: '€/t', valore: 75, regione: 'Basilicata' },
  { fornitore: 'Ecorecuperi Srl', prestazione: 'RACCOLTA', tipologia: 'RETE', unita_misura: '€/t', valore: 72, regione: 'Campania' },
  { fornitore: 'EMMESSE SRLS', prestazione: 'RACCOLTA', tipologia: 'RETE', unita_misura: '€/t', valore: 90, regione: 'Calabria' },
  { fornitore: 'GATIM S.R.L.', prestazione: 'RACCOLTA', tipologia: 'RETE', unita_misura: '€/t', valore: 70, regione: 'Calabria' },
  { fornitore: 'GREEN TYRE PROJECT SRL', prestazione: 'RACCOLTA', tipologia: 'RETE', unita_misura: '€/t', valore: 90, regione: 'Sicilia' },
  { fornitore: 'Nappi Sud Srl A Socio Unico', prestazione: 'RACCOLTA', tipologia: 'RETE', unita_misura: '€/t', valore: 58, regione: 'Campania' },
  { fornitore: 'Nappi Sud Srl A Socio Unico', prestazione: 'RACCOLTA', tipologia: 'RETE', unita_misura: '€/t', valore: 58, regione: 'Basilicata' },
  { fornitore: 'PNEUSERVICE CONVERSANO SRL', prestazione: 'RACCOLTA', tipologia: 'RETE', unita_misura: '€/t', valore: 100, regione: 'Puglia' },
  { fornitore: 'LOGISTICA & PNEUMATICI SRL', prestazione: 'RACCOLTA', tipologia: 'RETE', unita_misura: '€/t', valore: 68, provincia: 'NA' },
  { fornitore: 'LOGISTICA & PNEUMATICI SRL', prestazione: 'RACCOLTA', tipologia: 'RETE', unita_misura: '€/t', valore: 68, provincia: 'SA' },
  { fornitore: 'LOGISTICA & PNEUMATICI SRL', prestazione: 'RACCOLTA', tipologia: 'RETE', unita_misura: '€/t', valore: 71, provincia: 'AV' },
  { fornitore: 'LOGISTICA & PNEUMATICI SRL', prestazione: 'RACCOLTA', tipologia: 'RETE', unita_misura: '€/t', valore: 72, provincia: 'CE' },
  { fornitore: 'LOGISTICA & PNEUMATICI SRL', prestazione: 'RACCOLTA', tipologia: 'RETE', unita_misura: '€/t', valore: 71, destinazione: 'NAPPI SUD SRL' },

  // ── RACCOLTA, RETE, €/viaggio, classe vuota ──
  { fornitore: 'ECO.GEA SRL', prestazione: 'RACCOLTA', tipologia: 'RETE', unita_misura: '€/viaggio', valore: 1600, regione: 'Campania' },

  // ── RACCOLTA, ACI, €/t, classe vuota ──
  { fornitore: 'NAPPI SUD SRL', prestazione: 'RACCOLTA', tipologia: 'ACI', unita_misura: '€/t', valore: 92, regione: 'Campania' },
  { fornitore: 'NAPPI SUD SRL', prestazione: 'RACCOLTA', tipologia: 'ACI', unita_misura: '€/t', valore: 82, regione: 'Basilicata' },
  { fornitore: 'GREEN TYRE PROJECT SRL', prestazione: 'RACCOLTA', tipologia: 'ACI', unita_misura: '€/t', valore: 225 },
  { fornitore: 'EMMESSE SRLS', prestazione: 'RACCOLTA', tipologia: 'ACI', unita_misura: '€/t', valore: 110 },
  { fornitore: 'GATIM S.R.L.', prestazione: 'RACCOLTA', tipologia: 'ACI', unita_misura: '€/t', valore: 90 },

  // ── TRATTAMENTO, RETE, €/t, con classe_materiale ──
  { fornitore: 'GATIM S.R.L.', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 105, classe_materiale: 'P' },
  { fornitore: 'GATIM S.R.L.', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 105, classe_materiale: 'M' },
  { fornitore: 'GATIM S.R.L.', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 105, classe_materiale: 'G1' },
  { fornitore: 'GATIM S.R.L.', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 135, classe_materiale: 'G2' },
  { fornitore: 'GREEN TYRE PROJECT SRL', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 105, classe_materiale: 'P' },
  { fornitore: 'GREEN TYRE PROJECT SRL', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 105, classe_materiale: 'M' },
  { fornitore: 'GREEN TYRE PROJECT SRL', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 105, classe_materiale: 'G1' },
  { fornitore: 'GREEN TYRE PROJECT SRL', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 300, classe_materiale: 'G2' },
  { fornitore: 'Irigom S.r.l.', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 90, classe_materiale: 'P' },
  { fornitore: 'Irigom S.r.l.', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 90, classe_materiale: 'M' },
  { fornitore: 'Irigom S.r.l.', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 120, classe_materiale: 'G1' },
  { fornitore: 'Irigom S.r.l.', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 250, classe_materiale: 'G2' },
  { fornitore: 'T-CYCLE INDUSTRIES SRL', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 70, classe_materiale: 'P' },
  { fornitore: 'T-CYCLE INDUSTRIES SRL', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 70, classe_materiale: 'M' },
  { fornitore: 'T-CYCLE INDUSTRIES SRL', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 70, classe_materiale: 'G1' },
  { fornitore: 'T-CYCLE INDUSTRIES SRL', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 160, classe_materiale: 'G2' },

  // ── TRATTAMENTO, RETE, €/t, classe vuota ──
  { fornitore: 'T.R.S. SRL', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 115 },
  { fornitore: 'TECNOGUM SRL', prestazione: 'TRATTAMENTO', tipologia: 'RETE', unita_misura: '€/t', valore: 0 },

  // ── CONFERIMENTO_STOCCAGGIO, RETE, €/t, classe vuota ──
  { fornitore: 'NAPPI SUD SRL', prestazione: 'CONFERIMENTO_STOCCAGGIO', tipologia: 'RETE', unita_misura: '€/t', valore: 16 },
  { fornitore: 'T-CYCLE INDUSTRIES SRL', prestazione: 'CONFERIMENTO_STOCCAGGIO', tipologia: 'RETE', unita_misura: '€/t', valore: 25 },

  // ── TRATTAMENTO, ACI, €/t, classe vuota ──
  { fornitore: 'TECNOGUM SRL', prestazione: 'TRATTAMENTO', tipologia: 'ACI', unita_misura: '€/t', valore: 95 },
  { fornitore: 'GATIM S.R.L.', prestazione: 'TRATTAMENTO', tipologia: 'ACI', unita_misura: '€/t', valore: 105 },
  { fornitore: 'T.R.S. SRL', prestazione: 'TRATTAMENTO', tipologia: 'ACI', unita_misura: '€/t', valore: 115 },

  // ── CONFERIMENTO_STOCCAGGIO, ACI, €/t, classe vuota ──
  { fornitore: 'Irigom S.r.l.', prestazione: 'CONFERIMENTO_STOCCAGGIO', tipologia: 'ACI', unita_misura: '€/t', valore: 10 },
  { fornitore: 'NAPPI SUD SRL', prestazione: 'CONFERIMENTO_STOCCAGGIO', tipologia: 'ACI', unita_misura: '€/t', valore: 16 },

  // ── TRASPORTO_SECONDARIA, TUTTE ──
  { fornitore: 'Logistica Srl A Socio Unico', prestazione: 'TRASPORTO_SECONDARIA', tipologia: 'TUTTE', unita_misura: '€/t', valore: 30, produttore: 'NAPPI SUD SRL', destinatario: 'TECNOGUM SRL' },
  { fornitore: 'Logistica Srl A Socio Unico', prestazione: 'TRASPORTO_SECONDARIA', tipologia: 'TUTTE', unita_misura: '€/t', valore: 34, produttore: 'NAPPI SUD SRL', destinatario: 'Irigom S.r.l.' },
  { fornitore: 'ECOSERVICE SRL - Carrara (MS)', prestazione: 'TRASPORTO_SECONDARIA', tipologia: 'TUTTE', unita_misura: '€/t', valore: 30, produttore: 'NAPPI SUD SRL', destinatario: 'TECNOGUM SRL' },
  { fornitore: 'Logistica Srl A Socio Unico', prestazione: 'TRASPORTO_SECONDARIA', tipologia: 'TUTTE', unita_misura: '€/t', valore: 29, produttore: 'T-CYCLE INDUSTRIES SRL', destinatario: 'TECNOGUM SRL' },
  { fornitore: 'TRANSAR SRL', prestazione: 'TRASPORTO_SECONDARIA', tipologia: 'TUTTE', unita_misura: '€/viaggio', valore: 400, produttore: 'NAPPI SUD SRL', destinatario: 'TECNOGUM SRL' },
  { fornitore: 'TRANSAR SRL', prestazione: 'TRASPORTO_SECONDARIA', tipologia: 'TUTTE', unita_misura: '€/viaggio', valore: 400, produttore: 'NAPPI SUD SRL', destinatario: 'Irigom S.r.l.' },
  { fornitore: 'PATERTRANS SRL', prestazione: 'TRASPORTO_SECONDARIA', tipologia: 'TUTTE', unita_misura: '€/viaggio', valore: 500, produttore: 'NAPPI SUD SRL', destinatario: 'TECNOGUM SRL' },
  { fornitore: 'TRANSAR SRL', prestazione: 'TRASPORTO_SECONDARIA', tipologia: 'TUTTE', unita_misura: '€/viaggio', valore: 300, produttore: 'T-CYCLE INDUSTRIES SRL', destinatario: 'TECNOGUM SRL' },
];

function tariffaKey(t: any, fornitoreId: string): string {
  return [
    fornitoreId || '',
    t.direzione || '',
    t.tipologia || '',
    t.prestazione || '',
    normalizzaRagioneSociale(t.classe_materiale || ''),
    normalizzaRagioneSociale(t.provincia || ''),
    normalizzaRagioneSociale(t.regione || ''),
    normalizzaRagioneSociale(t.destinazione || ''),
    normalizzaRagioneSociale(t.produttore || ''),
    normalizzaRagioneSociale(t.destinatario || ''),
  ].join('|');
}

function descriviAmbito(t: TariffaSeed): string {
  if (t.provincia) return `Prov: ${t.provincia}`;
  if (t.regione) return `Reg: ${t.regione}`;
  if (t.destinazione) return `Dest: ${t.destinazione}`;
  if (t.produttore) return `${t.produttore} → ${t.destinatario}`;
  return 'generico';
}

export default async function(req: any) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
    const { simula } = await req.json().catch(() => ({}));

    // ── Caricamento dati esistenti ──
    const [fornitoriAll, tariffeAll] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.Fornitore),
      fetchAll(base44.asServiceRole.entities.Tariffa, { direzione: 'PASSIVA' }),
    ]);

    // Lookup fornitori per nome normalizzato
    const fornitoreByNorm = new Map<string, any>();
    for (const f of fornitoriAll) {
      fornitoreByNorm.set(normalizzaRagioneSociale(f.ragione_sociale), f);
    }

    // Chiavi tariffe esistenti ancora valide (non chiuse prima del 2026-01-01)
    const dataInizio = new Date(DATA_INIZIO);
    const existingKeys = new Set<string>();
    for (const t of tariffeAll) {
      if (t.data_fine_validita) {
        const df = new Date(t.data_fine_validita);
        if (df < dataInizio) continue; // chiusa prima del 2026, non confligge
      }
      existingKeys.add(tariffaKey(t, t.fornitore_id));
    }

    const result = {
      fornitori_creati: [] as string[],
      fornitori_aggiornati: [] as string[],
      fornitori_interni: [] as string[],
      tariffe_create: [] as any[],
      tariffe_ignorate: [] as any[],
      errori: [] as string[],
    };

    // ── 1. Fornitori interni ──
    for (const nome of FORNITORI_INTERNI) {
      const norm = normalizzaRagioneSociale(nome);
      const f = fornitoreByNorm.get(norm);
      if (!f) {
        if (!simula) {
          const created = await base44.asServiceRole.entities.Fornitore.create({
            ragione_sociale: nome, stato: 'attivo', interno: true,
          });
          fornitoreByNorm.set(norm, created);
        }
        result.fornitori_creati.push(nome);
      } else if (!f.interno) {
        if (!simula) {
          await base44.asServiceRole.entities.Fornitore.update(f.id, { interno: true });
        }
        result.fornitori_aggiornati.push(`${nome} (interno)`);
      }
      result.fornitori_interni.push(nome);
    }

    // ── 2. Raccogli fornitori necessari e ruoli ──
    const fornitoriNeeded = new Map<string, { nome: string; ruoli: Set<string> }>();
    for (const t of TARIFFE) {
      const norm = normalizzaRagioneSociale(t.fornitore);
      if (!fornitoriNeeded.has(norm)) {
        fornitoriNeeded.set(norm, { nome: t.fornitore, ruoli: new Set() });
      }
      const ruolo = PREST_TO_RUOLO[t.prestazione];
      if (ruolo) fornitoriNeeded.get(norm)!.ruoli.add(ruolo);
    }

    // ── 3. Crea/aggiorna fornitori ──
    for (const [norm, info] of fornitoriNeeded) {
      const f = fornitoreByNorm.get(norm);
      if (!f) {
        const ruoliObj: Record<string, boolean> = {};
        for (const r of info.ruoli) ruoliObj[r] = true;
        if (!simula) {
          const created = await base44.asServiceRole.entities.Fornitore.create({
            ragione_sociale: info.nome, stato: 'attivo', interno: false, ...ruoliObj,
          });
          fornitoreByNorm.set(norm, created);
        }
        result.fornitori_creati.push(info.nome);
      } else {
        const updates: Record<string, boolean> = {};
        for (const r of info.ruoli) {
          if (!f[r]) updates[r] = true;
        }
        if (Object.keys(updates).length > 0) {
          if (!simula) {
            await base44.asServiceRole.entities.Fornitore.update(f.id, updates);
          }
          result.fornitori_aggiornati.push(`${info.nome} (${Object.keys(updates).join(', ')})`);
        }
      }
    }

    // ── 4. Crea tariffe ──
    for (const t of TARIFFE) {
      const norm = normalizzaRagioneSociale(t.fornitore);
      const f = fornitoreByNorm.get(norm);
      const fornitoreId = f?.id || `sim_${norm}`;
      const key = tariffaKey({ ...t, direzione: 'PASSIVA' }, fornitoreId);

      if (existingKeys.has(key)) {
        result.tariffe_ignorate.push({
          fornitore: t.fornitore,
          prestazione: t.prestazione,
          tipologia: t.tipologia,
          classe: t.classe_materiale || '',
          ambito: descriviAmbito(t),
          valore: t.valore,
          unita_misura: t.unita_misura,
        });
        continue;
      }

      if (!simula) {
        const data: any = {
          fornitore_id: fornitoreId,
          fornitore_nome: t.fornitore,
          direzione: 'PASSIVA',
          tipologia: t.tipologia,
          prestazione: t.prestazione,
          unita_misura: t.unita_misura,
          valore: t.valore,
          data_inizio_validita: DATA_INIZIO,
          stato: 'attivo',
          note: NOTE,
        };
        if (t.classe_materiale) data.classe_materiale = t.classe_materiale;
        if (t.provincia) data.provincia = t.provincia;
        if (t.regione) data.regione = t.regione;
        if (t.destinazione) data.destinazione = t.destinazione;
        if (t.produttore) data.produttore = t.produttore;
        if (t.destinatario) data.destinatario = t.destinatario;

        await base44.asServiceRole.entities.Tariffa.create(data);
        existingKeys.add(key); // previene duplicati intra-run
      }

      result.tariffe_create.push({
        fornitore: t.fornitore,
        prestazione: t.prestazione,
        tipologia: t.tipologia,
        classe: t.classe_materiale || '',
        ambito: descriviAmbito(t),
        valore: t.valore,
        unita_misura: t.unita_misura,
      });
    }

    // Riepilogo per prestazione + tipologia
    const summary: Record<string, number> = {};
    for (const t of result.tariffe_create) {
      const k = `${t.prestazione} - ${t.tipologia}`;
      summary[k] = (summary[k] || 0) + 1;
    }

    return Response.json({
      simula: !!simula,
      fornitori_creati: result.fornitori_creati,
      fornitori_aggiornati: result.fornitori_aggiornati,
      fornitori_interni: result.fornitori_interni,
      tariffe_create: result.tariffe_create,
      tariffe_create_summary: summary,
      tariffe_ignorate: result.tariffe_ignorate,
      errori: result.errori,
      totali: {
        fornitori_creati: result.fornitori_creati.length,
        fornitori_aggiornati: result.fornitori_aggiornati.length,
        fornitori_interni: result.fornitori_interni.length,
        tariffe_create: result.tariffe_create.length,
        tariffe_ignorate: result.tariffe_ignorate.length,
        errori: result.errori.length,
      },
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}