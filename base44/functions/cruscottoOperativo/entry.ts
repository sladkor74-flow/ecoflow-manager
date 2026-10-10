import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { cruscotto } from "../../shared/cruscotto.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { listaAnno } from "../../shared/inizializzazioneAnno.ts";
import { leggiFotografia } from "../../shared/indicatoriGiorno.ts";

// Il cruscotto della dashboard: l'elenco unico delle cose da gestire, l'arretrato
// per canale, la freschezza dei dati, gli alert aperti, lo stato dei mesi della
// fatturazione attiva. Legge solo archivi piccoli, quindi si puo' chiamare a ogni
// apertura della dashboard. Il calcolo sta in base44/shared/cruscotto.ts.
// Payload: { anno? }
const TIPI_FILE = ['primarie', 'secondarie', 'terziarie', 'ordini_non_dichiarati', 'dichiarazioni_trattamento', 'pdr'];

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const oggi = oggiRoma();
    const anno = Number(body.anno) || Number(oggi.slice(0, 4));

    const svc = base44.asServiceRole.entities;
    const [alertAperti, uploadLogs, assegnatiRete, assegnatiAci, documenti, prefatture, riepiloghi, richiesteEct, verificheSedi,
      tariffe, giacenzeSito, impiantiTarget, commesse, contrattiFornitore, rilevazioni, ultimaFoto] = await Promise.all([
      fetchAll(svc.Alert, { stato: 'aperto' }),
      svc.UploadLog.list('-created_date', 200),
      fetchAll(svc.Assegnato),
      fetchAll(svc.AssegnatoAci),
      svc.DocumentoFatturazione.filter({ tipo: 'ATTIVA', anno }),
      svc.PrefatturaEcotyre.filter({ anno }).catch(() => []),
      svc.RiepilogoQualifica.filter({ anno }, '-created_date', 1).catch(() => []),
      fetchAll(svc.RichiestaEct, { anno }).catch(() => []),
      // I controlli delle sedi operative: poche centinaia di righe, una per
      // punto di raccolta con ordini. Serve sapere quante aspettano una decisione.
      fetchAll(svc.VerificaSedePdr, { superata: false }).catch(() => []),
      // Che cosa manca all'anno dopo per cominciare. Sono sei archivi piccoli -
      // tariffe, siti, target, commesse, contratti, rilevazioni: qualche
      // centinaio di righe in tutto, meno di quanto questa funzione legge gia' -
      // e la regola decide da se' se valga la pena dirlo (listaAnno).
      fetchAll(svc.Tariffa).catch(() => []),
      fetchAll(svc.GiacenzaSito).catch(() => []),
      fetchAll(svc.ImpiantoTarget).catch(() => []),
      fetchAll(svc.CommessaEcotyre).catch(() => []),
      fetchAll(svc.ContrattoFornitore).catch(() => []),
      fetchAll(svc.GiacenzaStoccaggio).catch(() => []),
      // L'ultima fotografia del guardiano notturno: una riga sola.
      svc.IndicatoreGiorno.list('-giorno', 1).catch(() => []),
    ]);

    return Response.json(cruscotto({
      oggi, anno, adessoMs: Date.now(), tipiFile: TIPI_FILE,
      alertAperti, uploadLogs, assegnatiRete, assegnatiAci, documenti,
      // delle prefatture bastano mese e stato: le righe non servono qui
      prefatture: (prefatture || []).map(p => ({ anno: p.anno, mese: p.mese, superata: p.superata })),
      riepilogoQualifica: riepiloghi[0] || null, richiesteEct, verificheSedi,
      fotografiaGiorno: leggiFotografia((ultimaFoto || [])[0] || null),
      annoNuovo: listaAnno({
        anno: anno + 1, tariffe, giacenzeSito, impiantiTarget, commesse, contrattiFornitore,
        rilevazioni: (rilevazioni || []).map(r => ({ ...r, sito: normalizzaRagioneSociale(r.sito) })),
        piazzali: [...new Set([
          ...(giacenzeSito || []).filter(g => String(g.tipo_destinazione || '').toLowerCase().startsWith('stoc')).map(g => normalizzaRagioneSociale(g.sito)),
          ...(rilevazioni || []).map(r => normalizzaRagioneSociale(r.sito)),
        ].filter(Boolean))],
        oggi,
      }),
    }));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
