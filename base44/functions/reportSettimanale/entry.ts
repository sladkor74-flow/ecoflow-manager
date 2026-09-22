import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { calcolaReportSettimanale } from "../../shared/reportSettimanale.ts";
import { giornoMovimento } from "../../shared/movimenti.ts";
import { riepilogoDate } from "../../shared/reportSettimanali.ts";

// Report settimanale della raccolta primaria RETE per il mese scelto. Si calcola
// ogni volta dai dati del gestionale, quindi segue da solo i caricamenti delle
// primarie e le modifiche dei target.
//
// Immissione, inizio e fine trasporto sono obbligatorie nei formulari (regola
// dell'utente del 22/09/2026): la risposta dice i terminati di rete a cui una
// data manca o non torna. Quelli senza fine trasporto, di qualunque periodo, non
// stanno in nessuna settimana e il report non li conta; quelli del mese a cui
// manca l'immissione o l'inizio, o con date incoerenti, sono contati ma vanno
// corretti. Il PDF li riporta in fondo e la pagina sotto l'intestazione, con le
// stesse frasi (frasiDateDaSistemare di reportSettimanaleExport.js).
//
// Payload: { anno?, mese? (1-12) }; predefiniti anno e mese correnti (ora italiana).

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
    const anno = Number(body.anno) || Number(oggi.slice(0, 4));
    const mese = Math.min(12, Math.max(1, Number(body.mese) || Number(oggi.slice(5, 7))));
    const svc = base44.asServiceRole.entities;

    const [rete, mensili, annui, caricamenti] = await Promise.all([
      fetchAll(svc.PrimariaRete, { stato: 'terminato' }),
      fetchAll(svc.TargetMensile, { anno }),
      fetchAll(svc.TargetRaccoglitore, { anno }),
      svc.UploadLog.filter({ tipo_file: 'primarie' }, '-created_date', 10).catch(() => []),
    ]);

    const report = calcolaReportSettimanale({ rete, mensili, annui, anno, mese });
    const ultimo = caricamenti.find(c => c.esito !== 'errore' && c.esito !== 'in_corso');
    const delMese = `${anno}-${String(mese).padStart(2, '0')}`;
    const senzaFine = riepilogoDate(rete.filter(r => !giornoMovimento(r)), 10);
    const nelMese = riepilogoDate(rete.filter(r => giornoMovimento(r).slice(0, 7) === delMese), 10);
    return Response.json({
      ...report,
      oggi,
      ultimo_caricamento: ultimo ? { il: ultimo.created_date, file: ultimo.nome_file || '' } : null,
      ...(senzaFine || nelMese ? { date_da_sistemare: { senza_fine: senzaFine, nel_mese: nelMese } } : {}),
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
