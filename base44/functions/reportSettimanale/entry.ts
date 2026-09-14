import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { calcolaReportSettimanale } from "../../shared/reportSettimanale.ts";

// Report settimanale della raccolta primaria RETE per il mese scelto. Si calcola
// ogni volta dai dati del gestionale, quindi segue da solo i caricamenti delle
// primarie e le modifiche dei target.
//
// Payload: { anno?, mese? (1-12) }; predefiniti anno e mese correnti (ora italiana).

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
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
    const ultimo = caricamenti.find(c => c.esito !== 'errore');
    return Response.json({
      ...report,
      oggi,
      ultimo_caricamento: ultimo ? { il: ultimo.created_date, file: ultimo.nome_file || '' } : null,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
