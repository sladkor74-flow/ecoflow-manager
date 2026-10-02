import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { soloAmministratore } from "../../shared/permessi.ts";
import { daTogliere } from "../../shared/dichiarazioniSeminate.ts";

// TOGLIE LE DICHIARAZIONI CHE NON SONO DICHIARAZIONI.
//
// Regola dell'utente, 02/10/2026: «cio' che non e' veramente dichiarato a
// portale puoi toglierlo, non confondiamoci con cose che non esistono».
//
// Due generi di record, e solo quelli: le righe del seme del 12/09/2026, che in
// quantita' portano il quantitativo ancora DA dichiarare invece di uno
// dichiarato, e i record vuoti, che non dicono niente ma zittiscono la casella
// del mese. La regola, con tutte le guardie su cosa NON si tocca, sta in
// shared/dichiarazioniSeminate.ts.
//
// SI GUARDA PRIMA, SI CANCELLA DOPO. Payload { anno, conferma }: senza conferma
// si risponde con l'elenco e non si tocca niente, come il seme e come
// scollegaFilePubblici. Una cancellazione non si annulla, e l'elenco e' corto
// abbastanza da leggerlo.
//
// Solo l'amministratore: e' una cancellazione di dati.
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const { errore } = await soloAmministratore(base44);
    if (errore) return errore;

    const body = await req.json().catch(() => ({}));
    const anno = Number(body.anno);
    if (!Number.isInteger(anno) || anno < 2000) {
      return Response.json({ error: 'Anno non valido.' }, { status: 400 });
    }
    const svc = base44.asServiceRole.entities;
    const dichiarazioni = await fetchAll(svc.DichiarazioneSito, { anno });
    const togliere = daTogliere(dichiarazioni);

    if (body.conferma !== true) {
      return Response.json({
        anno,
        simulato: true,
        conta: togliere.length,
        esaminate: dichiarazioni.length,
        togliere,
      });
    }

    const tolte = [];
    const errori = [];
    for (const r of togliere) {
      try {
        await svc.DichiarazioneSito.delete(r.id);
        tolte.push(r);
      } catch (e) {
        errori.push(`${r.sito} ${r.mese}: ${(e && e.message) || String(e)}`);
      }
    }
    return Response.json({
      anno,
      simulato: false,
      conta: tolte.length,
      tolte,
      ...(errori.length ? { errori } : {}),
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
