import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { datiFinoAl, ARCHIVI_FINO_AL } from "../../shared/statoArchivi.ts";
import { leggiRegistro, statoDelRegistro, avvisoCaricamento } from "../../shared/registroCaricamenti.ts";

// FINO A CHE GIORNO ARRIVANO I DATI DI UN DOCUMENTO CHE ESCE (chiusura
// dell'audit, 11/10/2026).
//
// Un foglio mandato il 10 con i dati al 7 non lo diceva: nessun file del
// gestionale scriveva fino a che giorno arrivano i dati, e i PDF dicevano solo
// «Esportato il ...». Il «fino al» lo sapevano la dashboard e EcoTyna
// (statoArchivi.ts); qui lo chiede il modulo di esportazione stesso, nel
// momento in cui produce il file, per i soli archivi che quel file legge: la
// passiva di rete le primarie di rete e le secondarie, il report dell'extra
// raccolta le sue schede. La data di un archivio che il file non legge
// direbbe una cosa falsa.
//
// E' una lettura leggera, come quella della dashboard: per ogni archivio poche
// righe ordinate (datiFinoAl), e il registro dei caricamenti con una lettura
// sola (leggiRegistro), giudicato con la regola dei motori (statoDelRegistro).
// Da li' vengono il giorno dell'ultimo caricamento riuscito di ogni file e i
// caricamenti ancora aperti o non riusciti, che il documento deve dichiarare:
// un file prodotto mentre le primarie si riscrivono puo' avere i numeri a meta'.
//
// La lettura la puo' chiedere chiunque esporti (chi consulta esporta, regola dei
// permessi): risponde solo date e nomi di file, nessun numero della commessa.
// Payload: { entita?: ['PrimariaRete', ...] } - senza, tutti gli archivi.
// Risponde { generato_il, utente, archivi: [...], caricamenti_aperti: [...] }.

// Il tipo di file del Caricamento Dati che riscrive ciascun archivio, per il
// giorno del caricamento. Le primarie di rete e ACI arrivano con lo stesso file.
const TIPI_DEL_FILE = {
  primarie: ['primarie', 'primarie_rete', 'primarie_aci'],
  secondarie: ['secondarie'],
  terziarie: ['terziarie'],
  extra_raccolta: ['extra_raccolta'],
  ordini_non_dichiarati: ['ordini_non_dichiarati'],
  dichiarazioni_trattamento: ['dichiarazioni_trattamento'],
};
const NOTI = new Set(ARCHIVI_FINO_AL.map(a => a.entita));

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    // Solo gli archivi che il gestionale conosce: un nome sconosciuto si scarta
    // invece di diventare una lettura di un archivio qualsiasi.
    const chieste = Array.isArray(body && body.entita) ? body.entita.map(String).filter(e => NOTI.has(e)) : null;
    if (chieste && !chieste.length) return Response.json({ error: 'Nessun archivio riconosciuto fra quelli chiesti.' }, { status: 400 });

    const svc = base44.asServiceRole.entities;
    const voci = await datiFinoAl(svc, chieste);
    const tipiFile = [...new Set(voci.map(v => v.tipo_file).filter(t => TIPI_DEL_FILE[t]))];
    const tipi = [...new Set(tipiFile.flatMap(t => TIPI_DEL_FILE[t]))];
    // Il registro e' un di piu': se non si legge, il documento dice il «fino
    // al» senza il giorno del caricamento, non rinuncia a tutto.
    let stato = { ultimi: {}, in_corso: [] };
    let registroLetto = true;
    if (tipi.length) {
      try { stato = statoDelRegistro(await leggiRegistro(svc.UploadLog, tipi), tipi); } catch (_e) { registroLetto = false; }
    }
    // Il giorno dell'ultimo caricamento riuscito del file: il piu' recente fra i
    // tipi che riscrivono l'archivio.
    const caricatoIl = (tipoFile) => (TIPI_DEL_FILE[tipoFile] || [])
      .map(t => stato.ultimi[t] && stato.ultimi[t].data).filter(Boolean).sort().pop() || null;

    return Response.json({
      generato_il: new Date().toISOString(),
      utente: (user.full_name || user.email || '').trim(),
      registro_letto: registroLetto,
      archivi: voci.map(v => ({ ...v, caricato_il: caricatoIl(v.tipo_file) })),
      caricamenti_aperti: (stato.in_corso || []).map(a => ({ tipo_file: a.tipo_file, data: a.data, ...avvisoCaricamento(a) })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
