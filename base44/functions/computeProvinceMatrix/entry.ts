import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { computeProvinceMatrixData } from "../../shared/primarieReteAnalytics.ts";
import { fetchAll } from "../../shared/fetchAll.ts";

// Calcola la matrice mensile dei FIR raccolti per Regione/Provincia.
// Evidenzia province con 2 mesi consecutivi a zero (alert warning).
//
// LE PROVINCE DEL CONTRATTO ANCHE SENZA RITIRI (segnalazione alta del 20/09,
// portata sul sito dalla revisione del 13/10/2026). La regola sta in
// computeProvinceMatrixData (opzioni.commesse), ma qui la matrice si chiamava
// senza i contratti: una provincia del contratto mai servita non compariva e non
// poteva avere i suoi due mesi a zero. I contratti si leggono insieme ai ritiri,
// una lettura in piu' per la pagina e non per provincia. Se non si riescono a
// leggere la matrice resta quella dei soli movimenti e la risposta lo dice
// (contratto_letto: false), invece di far finta che il contratto non abbia
// province.
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [records, commesse] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.PrimariaRete),
      fetchAll(base44.asServiceRole.entities.CommessaEcotyre).catch(() => null),
    ]);
    const result = computeProvinceMatrixData(records, null, commesse ? { commesse } : {});

    return Response.json({ ...result, contratto_letto: commesse !== null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
