import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { cruscotto, anniMesiAttiva, servonoPrefattureAnnoPrima } from "../../shared/cruscotto.ts";
import { leggiRegistro } from "../../shared/registroCaricamenti.ts";
import { datiFinoAl, finoAlPerTipo, ARCHIVI_DEL_CRUSCOTTO } from "../../shared/statoArchivi.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { annoNuovoDaMostrare } from "../../shared/inizializzazioneAnno.ts";
import { leggiFotografia } from "../../shared/indicatoriGiorno.ts";

// Il cruscotto della dashboard: l'elenco unico delle cose da gestire, l'arretrato
// per canale, la freschezza dei dati, gli alert aperti, lo stato dei mesi della
// fatturazione attiva. Legge solo archivi piccoli, quindi si puo' chiamare a ogni
// apertura della dashboard. Il calcolo sta in base44/shared/cruscotto.ts.
//
// CHIUSURA DELL'AUDIT (11/10/2026), tre cose:
// - il registro dei caricamenti si legge come lo leggono i motori
//   (leggiRegistro, registroCaricamenti.ts) e si giudica con la loro regola: una
//   riscrittura finita parziale non passa piu' per un caricamento fresco;
// - «dati fino al»: per ogni file l'ultimo giorno che c'e' dentro, con una
//   lettura ordinata di pochi record per archivio (datiFinoAl, statoArchivi.ts),
//   mai l'archivio intero;
// - si leggono anche i documenti dell'attiva dell'anno prima, perche' dicembre
//   e un novembre ancora aperto si chiudono a gennaio, e un mese mai chiuso
//   resta da dire anche a marzo (anniMesiAttiva). Sono pochi documenti; le
//   prefatture di quell'anno, che portano le righe del portale, si leggono solo
//   se un suo documento e' ancora aperto (servonoPrefattureAnnoPrima).
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
    const anniAttiva = anniMesiAttiva(anno, oggi);
    const [alertAperti, uploadLogs, assegnatiRete, assegnatiAci, documenti, prefatture, riepiloghi, richiesteEct, verificheSedi,
      tariffe, giacenzeSito, targetRaccoglitori, commesse, contrattiFornitore, rilevazioni, ultimaFoto, finoAl] = await Promise.all([
      fetchAll(svc.Alert, { stato: 'aperto' }),
      // Le ultime righe di ogni file, come le leggono i motori: una lettura sola.
      leggiRegistro(svc.UploadLog, TIPI_FILE).then(perTipo => [...perTipo.values()].flat()),
      fetchAll(svc.Assegnato),
      fetchAll(svc.AssegnatoAci),
      Promise.all(anniAttiva.map(a => svc.DocumentoFatturazione.filter({ tipo: 'ATTIVA', anno: a }))).then(x => x.flat()),
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
      fetchAll(svc.TargetRaccoglitore).catch(() => []),
      fetchAll(svc.CommessaEcotyre).catch(() => []),
      fetchAll(svc.ContrattoFornitore).catch(() => []),
      fetchAll(svc.GiacenzaStoccaggio).catch(() => []),
      // L'ultima fotografia del guardiano notturno: una riga sola.
      svc.IndicatoreGiorno.list('-giorno', 1).catch(() => []),
      // Fino a che giorno arrivano i dati: poche righe per archivio. Se non si
      // riesce a leggere, la freschezza si misura sul giorno del caricamento.
      datiFinoAl(svc, ARCHIVI_DEL_CRUSCOTTO).catch(() => []),
    ]);
    // Le prefatture dell'anno prima, solo se un suo mese le puo' ancora chiedere.
    const prefattureAnnoPrima = servonoPrefattureAnnoPrima(documenti, anno, oggi)
      ? await svc.PrefatturaEcotyre.filter({ anno: anniAttiva[0] }).catch(() => [])
      : [];

    return Response.json(cruscotto({
      oggi, anno, adessoMs: Date.now(), tipiFile: TIPI_FILE,
      alertAperti, uploadLogs, assegnatiRete, assegnatiAci, documenti,
      finoAl: finoAlPerTipo(finoAl),
      // delle prefatture bastano mese e stato: le righe non servono qui
      prefatture: [...(prefatture || []), ...(prefattureAnnoPrima || [])].map(p => ({ anno: p.anno, mese: p.mese, superata: p.superata })),
      riepilogoQualifica: riepiloghi[0] || null, richiesteEct, verificheSedi,
      fotografiaGiorno: leggiFotografia((ultimaFoto || [])[0] || null),
      // Dal 1° gennaio, per due mesi, l'anno appena cominciato se gli manca qualcosa
      // (annoNuovoDaMostrare): prima si guardava sempre l'anno dopo.
      annoNuovo: annoNuovoDaMostrare({
        tariffe, giacenzeSito, targetRaccoglitori, commesse, contrattiFornitore,
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
