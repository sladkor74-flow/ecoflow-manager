import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { individuaSoggetti } from "../../shared/qualificaFornitori.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { nuovaCache, chiaveLettura } from "../../shared/cacheLetture.ts";
import { situazioneContratti } from "../../shared/contrattiDellAnno.ts";

// La situazione contrattuale di un anno: chi va contrattualizzato, per quale
// prestazione, su quale canale, e a che punto e' ciascun contratto.
//
// I soggetti sono gli stessi della qualifica documentale (individuaSoggetti),
// con il ruolo e il canale che hanno nei movimenti: chi raccoglie sulla rete
// vuole un contratto di raccolta di rete, chi raccoglie anche sull'ACI ne vuole
// un secondo, distinto, col suo modello e i suoi valori. Chi sull'ACI raccoglie e
// stocca ne ha uno solo, di raccolta e stoccaggio coi due prezzi (decisione
// dell'utente del 13/10/2026). Le regole stanno in
// base44/shared/contrattiDellAnno.ts (giro K3 delle segnalazioni del 20/09,
// corretto il 12/10/2026): qui solo le letture.
//
// L'elenco e' l'unione dei soggetti dell'anno, di quelli dell'anno prima finche'
// l'anno chiesto non e' finito, e di chi ha gia' un contratto dell'anno. Prima
// l'anno prima si guardava solo se l'anno chiesto non aveva nessuno: un'inclusione
// manuale o i primi viaggi di gennaio bastavano a far sparire i contratti gia'
// generati per tutti gli altri.
//
// I valori dei contratti, le tariffe e le proposte hanno dentro dei prezzi: vanno
// solo all'amministratore. Il file_uri non va a nessuno: si apre da apriFile.
//
// Payload: { anno }

// Le letture dello stesso archivio si fanno una volta sola: individuaSoggetti
// legge le primarie e le secondarie per l'anno chiesto, poi per quello prima, e
// qui servono di nuovo per i canali. Senza la cache sarebbero tre letture di
// decine di migliaia di righe contro il limite al minuto di tutta l'app.
function conLettureCondivise(base44) {
  const cache = nuovaCache();
  const svc = base44.asServiceRole.entities;
  // Solo list e filter passano dalla cache; ogni altro metodo va all'archivio
  // vero, cosi' se individuaSoggetti un giorno legge in un altro modo non si rompe.
  const entita = new Proxy({}, {
    get: (_t, nome) => {
      const archivio = svc[nome];
      const inCache = {
        list: (...args) => cache.leggi(chiaveLettura(`${String(nome)}|list|${JSON.stringify(args)}`), () => archivio.list(...args)),
        filter: (filtro, ...resto) => cache.leggi(chiaveLettura(`${String(nome)}|filter|${JSON.stringify(resto)}`, filtro), () => archivio.filter(filtro, ...resto)),
      };
      return new Proxy({}, {
        get: (_x, metodo) => (Object.prototype.hasOwnProperty.call(inCache, metodo) ? inCache[metodo]
          : (typeof archivio[metodo] === 'function' ? archivio[metodo].bind(archivio) : archivio[metodo])),
      });
    },
  });
  return { asServiceRole: { entities: entita } };
}

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const admin = user.role === 'admin';

    const { anno } = await req.json();
    const annoNum = Number(anno) || new Date().getUTCFullYear();
    const oggi = oggiRoma();
    const condivise = conLettureCondivise(base44);
    const svc = condivise.asServiceRole.entities;
    const conAnnoPrima = oggi <= `${annoNum}-12-31`;

    // individuaSoggetti restituisce { soggetti, esclusi }: chi e' escluso dalla
    // qualifica e' fuori anche dai contratti, e chi e' escluso per l'anno chiesto
    // non rientra dall'anno prima.
    const delAnno = await individuaSoggetti(condivise, annoNum);
    const dellAnnoPrima = conAnnoPrima ? await individuaSoggetti(condivise, annoNum - 1) : { soggetti: [] };

    const [rete, aci, extra, sec, contratti, modelli, fornitori, targetRaccoglitori, impiantiTarget, tariffe] = await Promise.all([
      fetchAll(svc.PrimariaRete),
      fetchAll(svc.PrimariaAci),
      fetchAll(svc.ExtraRaccolta),
      fetchAll(svc.Secondaria),
      fetchAll(base44.asServiceRole.entities.ContrattoFornitore),
      // Tutti i modelli, anche i sostituiti: un contratto fatto col modello della
      // raccolta e stoccaggio resta coi due prezzi anche dopo che quel format e'
      // stato sostituito (revisione del 14/10/2026). Da proporre e da mostrare
      // restano solo gli attivi: li sceglie situazioneContratti.
      fetchAll(base44.asServiceRole.entities.ModelloContratto),
      fetchAll(svc.Fornitore),
      base44.asServiceRole.entities.TargetRaccoglitore.filter({ anno: annoNum }, 'raccoglitore', 1000),
      fetchAll(base44.asServiceRole.entities.ImpiantoTargetSecondaria, { stato: 'attivo' }),
      fetchAll(base44.asServiceRole.entities.Tariffa),
    ]);

    return Response.json(situazioneContratti({
      anno: annoNum, oggi, admin,
      soggettiAnno: delAnno.soggetti || [], esclusiAnno: delAnno.esclusi || [],
      soggettiPrima: dellAnnoPrima.soggetti || [],
      archivi: { rete, aci, extra, sec },
      contratti, modelli, fornitori, targetRaccoglitori, impiantiTarget, tariffe,
    }));
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
