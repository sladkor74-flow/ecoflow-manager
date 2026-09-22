import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from '../../shared/fetchAll.ts';
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { TARIFFA_BASE_EXTRA_RACCOLTA } from "../../shared/ecotyreTariffe.ts";

const DATA_INIZIO = '2026-01-01';
const NOTE = 'Inserita da seedTariffeAttive2026';

interface TariffaAttivaSeed {
  tipologia: string;
  valore: number;
  regione?: string;
}

const TARIFFE: TariffaAttivaSeed[] = [
  { tipologia: 'RETE', valore: 202 },
  // La base dell'extra raccolta e' una sola: quella che la fatturazione attiva
  // applica agli interventi senza prezzo quando la tabella non la ha (22/09/2026).
  { tipologia: 'EXTRA_RACCOLTA', valore: TARIFFA_BASE_EXTRA_RACCOLTA[2026] },
  { tipologia: 'ACI', valore: 240, regione: 'Puglia' },
  { tipologia: 'ACI', valore: 240, regione: 'Campania' },
  { tipologia: 'ACI', valore: 230, regione: 'Basilicata' },
  { tipologia: 'ACI', valore: 230, regione: 'Sicilia' },
  { tipologia: 'ACI', valore: 230, regione: 'Calabria' },
  { tipologia: 'ACI', valore: 230 }, // regione vuota = ripiego
];

function norm(v: any): string {
  return String(v || '').trim().toUpperCase();
}

function tariffaAttivaKey(t: any): string {
  return [
    norm(t.cliente),
    norm(t.tipologia),
    norm(t.classe_materiale),
    norm(t.regione),
    norm(t.eer_codice),
  ].join('|');
}

export default async function(req: any) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
    const { simula } = await req.json().catch(() => ({}));

    // Carica tariffe attive esistenti
    const tariffeAll = await fetchAll(base44.asServiceRole.entities.Tariffa, { direzione: 'ATTIVA' });

    // Chiavi tariffe attive esistenti con stato attivo e periodo sovrapposto al 2026-01-01
    const dataInizio = new Date(DATA_INIZIO);
    const existingKeys = new Set<string>();
    for (const t of tariffeAll) {
      if (norm(t.stato) !== 'ATTIVO') continue;
      if (t.data_fine_validita) {
        const df = new Date(t.data_fine_validita);
        if (df < dataInizio) continue; // chiusa prima del 2026, non confligge
      }
      existingKeys.add(tariffaAttivaKey(t));
    }

    const result = {
      tariffe_create: [] as any[],
      tariffe_ignorate: [] as any[],
      errori: [] as string[],
    };

    for (const t of TARIFFE) {
      const key = tariffaAttivaKey({ cliente: 'ECOTYRE', ...t });

      if (existingKeys.has(key)) {
        result.tariffe_ignorate.push({
          cliente: 'ECOTYRE',
          tipologia: t.tipologia,
          regione: t.regione || '',
          valore: t.valore,
          unita_misura: '€/t',
        });
        continue;
      }

      if (!simula) {
        const data: any = {
          cliente: 'ECOTYRE',
          direzione: 'ATTIVA',
          tipologia: t.tipologia,
          unita_misura: '€/t',
          valore: t.valore,
          data_inizio_validita: DATA_INIZIO,
          stato: 'attivo',
          note: NOTE,
        };
        if (t.regione) data.regione = t.regione;

        await base44.asServiceRole.entities.Tariffa.create(data);
        existingKeys.add(key); // previene duplicati intra-run
      }

      result.tariffe_create.push({
        cliente: 'ECOTYRE',
        tipologia: t.tipologia,
        regione: t.regione || '',
        valore: t.valore,
        unita_misura: '€/t',
      });
    }

    return Response.json({
      simula: !!simula,
      tariffe_create: result.tariffe_create,
      tariffe_ignorate: result.tariffe_ignorate,
      errori: result.errori,
      totali: {
        tariffe_create: result.tariffe_create.length,
        tariffe_ignorate: result.tariffe_ignorate.length,
        errori: result.errori.length,
      },
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}