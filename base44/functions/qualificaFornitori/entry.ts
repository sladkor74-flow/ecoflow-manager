import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { individuaSoggetti, valutaSoggetto, oggiRoma, salvaRiepilogo } from "../../shared/qualificaFornitori.ts";

// Situazione della qualifica fornitori per un anno.
//
// Payload: { anno, soggetti? }
// Senza "soggetti" individua gli attori dell'anno dalle movimentazioni, che e'
// l'operazione costosa perche' rilegge tutti gli archivi. Con "soggetti", cioe'
// l'elenco gia' ottenuto in precedenza, rivaluta solo i documenti: e' la strada
// usata dopo un caricamento o una correzione, che cosi' si aggiorna in un attimo.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const anno = Number(body.anno) || new Date().getFullYear();
    const oggi = oggiRoma();

    let soggetti = Array.isArray(body.soggetti) ? body.soggetti : null;
    let esclusi = Array.isArray(body.esclusi) ? body.esclusi : [];
    if (!soggetti) {
      const esito = await individuaSoggetti(base44, anno);
      soggetti = esito.soggetti;
      esclusi = esito.esclusi;
    }

    const [catalogo, documenti] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.TipoDocumentoQualifica),
      fetchAll(base44.asServiceRole.entities.DocumentoQualifica, { stato: 'attivo' }),
    ]);

    const valutati = soggetti.map(s => valutaSoggetto(s, catalogo, documenti, oggi));
    const alert = await salvaRiepilogo(base44, anno, valutati);

    const conta = (fn) => valutati.filter(fn).length;
    const requisiti = valutati.flatMap(s => s.requisiti);
    const riepilogo = {
      soggetti: valutati.length,
      qualificati: conta(s => s.stato === 'qualificato' || s.stato === 'in_scadenza'),
      da_completare: conta(s => s.stato === 'da_completare'),
      critici: conta(s => s.stato === 'critico'),
      documenti_mancanti: requisiti.filter(r => r.stato === 'mancante').length,
      in_scadenza: requisiti.filter(r => r.stato === 'in_scadenza').length,
      scaduti: requisiti.filter(r => r.stato === 'scaduto').length,
      non_conformi: requisiti.filter(r => r.stato === 'non_conforme').length,
      da_verificare: requisiti.filter(r => r.stato === 'da_verificare').length,
      catalogo_vuoto: catalogo.filter(t => t.attivo !== false).length === 0,
      alert_aperti: alert.alert_aperti,
      soggetti_con_alert: alert.soggetti_con_alert,
    };

    return Response.json({ anno, oggi, riepilogo, soggetti: valutati, esclusi, catalogo });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
