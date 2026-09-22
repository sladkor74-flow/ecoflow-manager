import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { individuaSoggetti, valutaSoggetto, oggiRoma, salvaRiepilogo, anomalieCatalogo } from "../../shared/qualificaFornitori.ts";
import { applicaControlloClasse } from "../../shared/classeAlbo.ts";
import { daAnalizzare } from "../../shared/analisiDocumento.ts";

// Situazione della qualifica fornitori per un anno.
//
// Payload: { anno, soggetti?, esclusi?, soggetti_da_date? }
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
    const anno = Number(body.anno) || Number(oggiRoma().slice(0, 4));
    const oggi = oggiRoma();

    let soggetti = Array.isArray(body.soggetti) ? body.soggetti : null;
    let esclusi = Array.isArray(body.esclusi) ? body.esclusi : [];
    // Chi compare nell'anno solo in terminati senza fine trasporto (22/09/2026):
    // come gli esclusi, la pagina lo rimanda indietro nell'aggiornamento rapido.
    let soggettiDaDate = Array.isArray(body.soggetti_da_date) ? body.soggetti_da_date : [];
    if (!soggetti) {
      const esito = await individuaSoggetti(base44, anno);
      soggetti = esito.soggetti;
      esclusi = esito.esclusi;
      soggettiDaDate = esito.soggetti_da_date || [];
    }

    const [catalogo, documentiSalvati, targetAnnui, targetMensili] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.TipoDocumentoQualifica),
      fetchAll(base44.asServiceRole.entities.DocumentoQualifica, { stato: 'attivo' }),
      fetchAll(base44.asServiceRole.entities.TargetRaccoglitore, { anno }),
      fetchAll(base44.asServiceRole.entities.TargetMensile, { anno }),
    ]);
    // La classe dell'iscrizione all'Albo si confronta con i target in vigore.
    const documenti = applicaControlloClasse(documentiSalvati, soggetti, targetAnnui, targetMensili, anno);

    const valutati = soggetti.map(s => valutaSoggetto(s, catalogo, documenti, oggi));
    // Voci del catalogo intestate a un fornitore che quest'anno non c'e': senza
    // questo controllo resterebbero mute e sembrerebbe tutto a posto.
    const anomalie = anomalieCatalogo(catalogo, soggetti, anno);
    // Documenti che l agente non ha mai letto, o che conviene rileggere: si
    // conta qui perche gli archivi sono gia in mano, senza una chiamata in piu.
    const daLeggere = daAnalizzare(documentiSalvati, catalogo, { adessoMs: Date.now(), massimo: 0 });
    const alert = await salvaRiepilogo(base44, anno, valutati, anomalie);

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
      anomalie_catalogo: anomalie.filter(a => a.gravita === 'errore').length,
      da_leggere: daLeggere.length,
      mai_letti: daLeggere.filter(d => d.motivo === 'mai_letto').length,
    };

    return Response.json({ anno, oggi, riepilogo, soggetti: valutati, esclusi, soggetti_da_date: soggettiDaDate, catalogo, anomalie, da_leggere: daLeggere.slice(0, 40) });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
