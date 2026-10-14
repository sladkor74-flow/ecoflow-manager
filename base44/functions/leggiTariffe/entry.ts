import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { tariffePerChiLegge } from "../../shared/tariffeVisibili.ts";

// LE TARIFFE PER CHI LE CHIEDE (decisione del 14/10/2026).
//
// Tariffa la legge solo l'amministratore: le tariffe passive sono i prezzi dei
// fornitori, un costo. Questa funzione, di sola lettura, e' la strada per le
// pagine che servono anche a chi non e' amministratore (l'Extra Raccolta):
// all'amministratore restituisce tutte le tariffe, com'e' scritto l'archivio;
// agli altri le sole attive, quello che SMOCO fattura a Ecotyre, coi campi che
// servono a sceglierle e applicarle. Le regole stanno in
// base44/shared/tariffeVisibili.ts; nel browser si chiama da
// src/lib/leggiTariffe.js. E' la stessa strada di leggiSurplus (13/10/2026).
//
// Si legge tutto l'archivio, una lettura (65 tariffe l'11/10/2026), senza filtro
// sullo stato: il disattivato lo toglie il calcolo (tariffeAttiveValide), come
// prima nella pagina. L'ordine e' per data di creazione, la piu' recente prima,
// come le leggeva la pagina: fra due tariffe ugualmente specifiche decide quello.
// Chi e' amministratore lo decide il server, non la pagina: una pagina che lo sa
// in ritardo non riceve mai i prezzi dei fornitori per sbaglio, e quella
// dell'amministratore non resta senza.
//
// Payload: nessuno. Risposta: { ok: true, parte: 'tutto' | 'attiva', tariffe }.
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const amministratore = user.role === 'admin';

    const tutte = await fetchAll(base44.asServiceRole.entities.Tariffa, null, '-created_date');

    return Response.json({
      ok: true,
      parte: amministratore ? 'tutto' : 'attiva',
      tariffe: tariffePerChiLegge(tutte, amministratore),
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
