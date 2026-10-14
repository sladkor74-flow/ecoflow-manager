import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { surplusPerChiLegge } from "../../shared/surplusVisibile.ts";

// I SURPLUS SULLE TARIFFE PER CHI LI CHIEDE (decisione del 13/10/2026).
//
// SurplusTariffa lo legge solo l'amministratore: c'e' dentro quanto SMOCO paga
// in piu' ai fornitori, un costo. Questa funzione, di sola lettura, e' la strada
// per le pagine che servono anche a chi non e' amministratore (l'Extra
// Raccolta): all'amministratore restituisce tutti i record, com'e' scritto
// l'archivio; agli altri la sola parte attiva, cioe' quanto SMOCO fattura in
// piu' a Ecotyre, dei soli surplus che Ecotyre paga. Le regole stanno in
// base44/shared/surplusVisibile.ts; nel browser si chiama da
// src/lib/leggiSurplus.js.
//
// Si legge tutto l'archivio, una lettura, senza filtro sullo stato: come per le
// tariffe il disattivato lo toglie il calcolo (surplusNonDisattivati). Chi e'
// amministratore lo decide il server, non la pagina: una pagina che lo sa in
// ritardo non riceve mai la parte dei fornitori per sbaglio, e quella
// dell'amministratore non resta senza.
//
// Payload: nessuno. Risposta: { ok: true, parte: 'tutto' | 'attiva', surplus }.
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const amministratore = user.role === 'admin';

    const tutti = await fetchAll(base44.asServiceRole.entities.SurplusTariffa, null, '-created_date');

    return Response.json({
      ok: true,
      parte: amministratore ? 'tutto' : 'attiva',
      surplus: surplusPerChiLegge(tutti, amministratore),
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
