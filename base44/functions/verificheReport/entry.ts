import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { caricaMovimenti, soggettiDellaSettimana, oggiRoma } from "../../shared/reportSettimanali.ts";
import { eliminaCampo } from "../../shared/testoLungo.ts";
import { eDichiarazione, ricontrollaDichiarazioni } from "../../shared/esitoVerifica.ts";
import { eAmministratore } from "../../shared/permessi.ts";

// Situazione dei report settimanali per una settimana.
//
// Payload: { anno, settimana }
// Restituisce gli impianti e gli stoccaggi attivi nell'anno, gli ingressi e le
// uscite che il gestionale registra per ciascuno nella settimana e l'eventuale
// verifica gia' fatta sul loro report.
//
// Prima di tutto elimina le verifiche arrivate al quarantesimo giorno: il
// controllo giornaliero lo fa gia', ma ripeterlo qui garantisce che una verifica
// scaduta non ricompaia anche se quel controllo non fosse partito.

const CAMPI_RIEPILOGO = [
  'id', 'soggetto_chiave', 'soggetto_nome', 'anno', 'settimana', 'data_inizio', 'data_fine', 'file_nome', 'file_tipo', 'nota',
  'stato', 'avviata_il', 'errore', 'righe_report', 'conformi', 'con_discrepanze', 'non_trovate', 'duplicate',
  'assenti_nel_report', 'ingressi_gestionale', 'peso_ingressi_kg', 'uscite_gestionale', 'peso_uscite_kg', 'uscite_verificate',
  'peso_report_kg', 'righe_escluse', 'conformita', 'anomalie', 'osservazioni', 'rettifiche', 'verificata_il', 'scade_il', 'created_date',
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // Tutti leggono l'elenco delle verifiche; la manutenzione (cancellare le
    // scadute e le sostituite, riconfrontare le dichiarazioni) la fa solo
    // l'amministratore, perche' scrive.
    const puoScrivere = eAmministratore(user);

    const body = await req.json().catch(() => ({}));
    const anno = Number(body.anno);
    const settimana = Number(body.settimana);
    if (!anno || !settimana) return Response.json({ error: 'anno e settimana sono obbligatori' }, { status: 400 });

    const svc = base44.asServiceRole.entities;
    const oggi = oggiRoma();

    const tutte = await fetchAll(svc.VerificaReport);
    let cancellate = 0;
    for (const v of tutte) {
      if (puoScrivere && v.scade_il && String(v.scade_il).slice(0, 10) <= oggi) {
        await eliminaCampo(base44, 'VerificaReport', v.id);
        await svc.VerificaReport.delete(v.id);
        cancellate++;
      }
    }

    const dati = await caricaMovimenti(base44);
    const { inizio, fine, righe } = soggettiDellaSettimana(dati, anno, settimana);

    const dellaSettimana = tutte
      .filter(v => Number(v.anno) === anno && Number(v.settimana) === settimana && !(v.scade_il && String(v.scade_il).slice(0, 10) <= oggi))
      .sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || '')));

    // Un report puo' arrivare anche da un soggetto che nella settimana non ha
    // movimenti: la verifica resta visibile e va comunque letta.
    const perChiave = new Map();
    for (const v of dellaSettimana) {
      if (!perChiave.has(v.soggetto_chiave)) { perChiave.set(v.soggetto_chiave, v); continue; }
      if (!puoScrivere) continue;
      // Verifica sostituita che il browser non e' riuscito a cancellare: non serve piu'.
      try {
        await eliminaCampo(base44, 'VerificaReport', v.id);
        await svc.VerificaReport.delete(v.id);
        cancellate++;
      } catch (_e) { /* si riprova alla prossima apertura */ }
    }

    // Le dichiarazioni di nessuna movimentazione si riconfrontano con i dati di adesso:
    // un caricamento successivo puo' averle smentite (o confermate).
    const dichiarazioni = [...perChiave.values()].filter(eDichiarazione);
    if (puoScrivere && dichiarazioni.length && await ricontrollaDichiarazioni(base44, dichiarazioni, dati.movimenti)) {
      for (const v of dichiarazioni) perChiave.set(v.soggetto_chiave, await svc.VerificaReport.get(v.id));
    }

    const elenco = righe.map(r => {
      const v = perChiave.get(r.chiave);
      perChiave.delete(r.chiave);
      return { ...r, verifica: v ? Object.fromEntries(CAMPI_RIEPILOGO.map(k => [k, v[k]])) : null };
    });
    for (const v of perChiave.values()) {
      elenco.push({ chiave: v.soggetto_chiave, nome: v.soggetto_nome, ruoli: [], ingressi: 0, kg_ingressi: 0, uscite: 0, kg_uscite: 0, verifica: Object.fromEntries(CAMPI_RIEPILOGO.map(k => [k, v[k]])) });
    }

    return Response.json({ anno, settimana, inizio, fine, oggi, soggetti: elenco, cancellate });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
