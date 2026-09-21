import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import {
  caricaMovimenti, soggettiDellaSettimana, oggiRoma, statoCaricamenti, caricamentiDuranteLettura, descriviCaricamento, senzaFinePerCanale,
} from "../../shared/reportSettimanali.ts";
import { eliminaCampo } from "../../shared/testoLungo.ts";
import { ricontrollaVerifiche } from "../../shared/esitoVerifica.ts";
import { eAmministratore } from "../../shared/permessi.ts";

// Situazione dei report settimanali per una settimana.
//
// Payload: { anno, settimana }
// Restituisce gli impianti e gli stoccaggi attivi nell'anno, gli ingressi e le
// uscite che il gestionale registra per ciascuno nella settimana, canale per
// canale, e l'eventuale verifica gia' fatta sul loro report.
//
// Prima di tutto elimina le verifiche arrivate al quarantesimo giorno: il
// controllo giornaliero lo fa gia', ma ripeterlo qui garantisce che una verifica
// scaduta non ricompaia anche se quel controllo non fosse partito.
//
// Poi riconfronta ogni verifica della settimana con i movimenti di adesso, che
// qui si leggono comunque: un report verificato prima che si caricassero le
// primarie della sua settimana restava "parziale" con formulari "non trovati"
// anche a caricamento fatto, mentre accanto le colonne degli ingressi li
// contavano gia'. Se l'esito cambia lo salva l'amministratore; chi consulta lo
// vede aggiornato lo stesso. Mentre un archivio dei movimenti si sta riscrivendo
// resta l'ultimo esito salvato, e la risposta dice perche'.

// I campi della verifica che servono all'elenco. Ingressi, uscite e pesi
// complessivi del record non ci sono: sommavano i canali, e l'elenco li ha
// canale per canale dai movimenti della settimana.
const CAMPI_RIEPILOGO = [
  'id', 'soggetto_chiave', 'soggetto_nome', 'anno', 'settimana', 'data_inizio', 'data_fine', 'file_nome', 'file_tipo', 'nota',
  'stato', 'avviata_il', 'errore', 'righe_report', 'conformi', 'con_discrepanze', 'non_trovate', 'duplicate',
  'assenti_nel_report', 'uscite_verificate', 'righe_escluse', 'conformita', 'anomalie', 'osservazioni', 'rettifiche',
  'verificata_il', 'scade_il', 'created_date',
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // Tutti leggono l'elenco delle verifiche e i loro esiti rifatti sui dati di
    // adesso; la manutenzione (cancellare le scadute e le sostituite, salvare un
    // esito cambiato) la fa solo l'amministratore, perche' scrive.
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

    // Lo stato dei caricamenti si legge prima e dopo gli archivi: letto insieme
    // agli archivi, un caricamento partito mentre li si leggeva non si vedeva, e
    // gli esiti si riscrivevano su un archivio a meta'.
    const primaDegliArchivi = await statoCaricamenti(base44);
    const dati = await caricaMovimenti(base44);
    const durante = caricamentiDuranteLettura(primaDegliArchivi, await statoCaricamenti(base44))
      .map(a => ({ ...a, descrizione: descriviCaricamento(a) }));
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

    // Ogni verifica completata si riconfronta con i movimenti di adesso: report
    // veri e dichiarazioni di nessuna movimentazione.
    const ricalcolo = { rinviato: durante, aggiornate: 0, solo_a_video: 0, errori: [] };
    if (!durante.length) {
      const esiti = await ricontrollaVerifiche(base44, [...perChiave.values()], dati.movimenti, { scrivi: puoScrivere });
      for (const r of esiti) {
        if (r.errore) { ricalcolo.errori.push({ soggetto_chiave: r.soggetto_chiave, errore: r.errore }); continue; }
        if (!r.cambiato) continue;
        const v = perChiave.get(r.soggetto_chiave);
        perChiave.set(r.soggetto_chiave, { ...v, ...r.campi, esito_ricalcolato: r.salvato ? 'salvato' : 'solo_a_video' });
        if (r.salvato) ricalcolo.aggiornate++; else ricalcolo.solo_a_video++;
      }
    }

    const riepilogo = (v) => ({ ...Object.fromEntries(CAMPI_RIEPILOGO.map(k => [k, v[k]])), esito_ricalcolato: v.esito_ricalcolato || null });
    const elenco = righe.map(r => {
      const v = perChiave.get(r.chiave);
      perChiave.delete(r.chiave);
      return { ...r, verifica: v ? riepilogo(v) : null };
    });
    for (const v of perChiave.values()) {
      elenco.push({ chiave: v.soggetto_chiave, nome: v.soggetto_nome, ruoli: [], canali: [], movimentato: false, verifica: riepilogo(v) });
    }

    // I terminati senza fine trasporto non stanno in nessuna settimana: si dicono
    // per canale, cosi' un loro formulario "non presente" nel report si spiega.
    return Response.json({
      anno, settimana, inizio, fine, oggi, soggetti: elenco, cancellate, ricalcolo,
      senza_fine: senzaFinePerCanale(dati.senza_fine),
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
