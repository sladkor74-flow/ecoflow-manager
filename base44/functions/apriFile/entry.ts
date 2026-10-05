import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { controllaRichiesta, SECONDI_LINK, MOTIVO_SENZA_FILE } from "../../shared/fileRiservato.ts";

// L'UNICA STRADA PER APRIRE UN FILE CARICATO DAL GESTIONALE.
//
// Prima il browser firmava da solo: chiedeva CreateFileSignedUrl col file_uri che
// si era letto dal record. L'assistenza della piattaforma il 05/10/2026 ha
// spiegato che quella firma non e' controllata - «Signing isn't checked against
// that user, or against the RLS of the record that holds the reference» - e che
// non esiste nessuna impostazione per riservarla alle funzioni. Quindi il file_uri
// al browser non si manda piu', e chi vuole aprire un documento lo chiede qui.
//
// Payload: { entita, id }. Niente indirizzi e niente file_uri: il riferimento lo
// trova il server leggendo il record, come vuole la regola della scansione del
// 02/10/2026 (il server non va dove gli si dice di andare).
//
// Risposta: { ok: true, url, nome, scade_fra }. L'url vale 300 secondi: si chiede
// nel momento in cui si preme il pulsante, e intanto muore da solo.

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const entita = String(body.entita || '');
    const id = String(body.id || '');

    const { def, errore, stato } = controllaRichiesta({ entita, id, file_uri: body.file_uri, file_url: body.file_url, user });
    if (errore) return Response.json({ error: errore, ...(stato === 403 ? { riservato: true } : {}) }, { status: stato });

    // Il record si legge con asServiceRole perche' l'archivio dei documenti di
    // qualifica non e' piu' leggibile dal browser: il permesso l'ha deciso
    // controllaRichiesta, qui si legge soltanto.
    const record = await base44.asServiceRole.entities[entita].get(id).catch(() => null);
    if (!record) return Response.json({ error: 'Il record non esiste piu\'.' }, { status: 404 });
    const uri = String(record[def.campo] || '').trim();
    if (!uri) return Response.json({ error: MOTIVO_SENZA_FILE, senza_file: true }, { status: 404 });

    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: SECONDI_LINK });
    const url = String(signed_url || '').trim();
    if (!url) return Response.json({ error: 'La piattaforma non ha restituito un indirizzo per questo file.' }, { status: 502 });

    return Response.json({ ok: true, url, nome: String(def.nome(record) || '').trim(), scade_fra: SECONDI_LINK });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
