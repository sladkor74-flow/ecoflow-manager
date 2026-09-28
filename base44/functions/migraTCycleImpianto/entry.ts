import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';
import { soloAmministratore } from "../../shared/permessi.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { annoChiuso, recordDellAnno } from "../../shared/annoTarget.ts";

// Migrazione one-shot: crea il record T-CYCLE in ImpiantoTargetSecondaria
// (quota impianto 1.050.000 kg, totale capacita' 1.300.000 kg) se non esiste gia'.
// Il plafond stoccaggio (250.000 kg) resta sul FornitoreSecondaria T-CYCLE (doppio_ruolo).
// Idempotente: se il record esiste gia', aggiorna solo i valori mancanti.
//
// Dal 27/09/2026 vale per un anno preciso: corpo { anno } obbligatorio, mai su un
// anno chiuso. Gli impianti si leggono interi e si tengono per anno con
// annoDelRecord (un record senza anno vale il 2026), e il record nuovo porta
// l'anno. I numeri sono quelli del contratto 2026: per gli altri anni il record
// nasce dalla copia dell'anno prima (copiaAnnoTarget), non da qui.
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const { errore } = await soloAmministratore(base44);
    if (errore) return errore;

    const corpo = await req.json().catch(() => ({}));
    const anno = Number(corpo && corpo.anno);
    if (!Number.isInteger(anno) || anno < 2000 || anno > 2100) {
      return Response.json({ error: "Indica l'anno (per esempio { anno: 2026 })." }, { status: 400 });
    }
    if (annoChiuso(anno)) {
      return Response.json({ error: `Il ${anno} e' chiuso: si puo' solo consultare.`, anno_chiuso: true }, { status: 400 });
    }
    const b = base44.asServiceRole;

    const impianti = recordDellAnno(await fetchAll(b.entities.ImpiantoTargetSecondaria), anno);
    const esistente = impianti.find(i => normalizzaRagioneSociale(i.nome_impianto) === 't-cycle');

    if (esistente) {
      const patch = {};
      if (!esistente.target || esistente.target === 0) patch.target = 1050000;
      if (!esistente.totale_capacity_kg || esistente.totale_capacity_kg === 0) patch.totale_capacity_kg = 1300000;
      if (Object.keys(patch).length > 0) {
        await b.entities.ImpiantoTargetSecondaria.update(esistente.id, patch);
      }
      return Response.json({ anno, esiste: true, id: esistente.id, patch_aggiornata: patch });
    }

    const created = await b.entities.ImpiantoTargetSecondaria.create({
      nome_impianto: 'T-CYCLE INDUSTRIES SRL',
      target: 1050000,
      totale_capacity_kg: 1300000,
      stato: 'attivo',
      anno,
    });

    return Response.json({ anno, esiste: false, creato: true, id: created.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
