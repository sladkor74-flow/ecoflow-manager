import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { fetchAll } from "../../shared/fetchAll.ts";
import {
  caricaMovimenti, oggiRoma, aggiungiGiorni, statoCaricamenti, GIORNI_CONSERVAZIONE,
} from "../../shared/reportSettimanali.ts";
import { ricontrollaVerifiche, conRitentativi } from "../../shared/esitoVerifica.ts";
import { caricaGestionale, rifaiQuadratura, TIPI_CARICAMENTO } from "../../shared/quadraturaFirDati.ts";

// Dopo un caricamento di primarie o secondarie (lo lancia Caricamento Dati a
// caricamento concluso) riconfronta con i nuovi dati tutto quello che il modulo
// Verifiche ha calcolato prima:
//   - le verifiche dei report settimanali, dichiarazioni di "nessuna
//     movimentazione" comprese: si rifa' il confronto sulle righe gia' lette e si
//     riscrive solo cio' che cambia (l'alert della dichiarazione si apre o si
//     chiude di conseguenza);
//   - le quadrature FIR delle stesse settimane, sulle righe lette dalla stampa.
// Il nome e' rimasto quello di quando riconfrontava le sole dichiarazioni: e' il
// nome con cui la chiama Caricamento Dati.
//
// Le quadrature piu' vecchie dei quaranta giorni delle verifiche non si rifanno
// qui (una lettura dei loro testi per ciascuna): si rifanno quando si apre la
// loro settimana, e lo storico non ne mostra un esito salvato.
//
// Se un archivio dei movimenti si sta ancora riscrivendo (o e' rimasto a meta')
// non si tocca niente: un confronto su un archivio a meta' darebbe esiti falsi.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole.entities;
    const caricamenti = await statoCaricamenti(base44, TIPI_CARICAMENTO);
    if (caricamenti.in_corso.length) {
      return Response.json({ ok: true, rinviato: true, caricamenti_in_corso: caricamenti.in_corso });
    }

    const oggi = oggiRoma();
    const scaduta = (v) => !!v.scade_il && String(v.scade_il).slice(0, 10) <= oggi;
    const verifiche = (await fetchAll(svc.VerificaReport, { stato: 'completata' })).filter(v => !scaduta(v));
    const dal = aggiungiGiorni(oggi, -GIORNI_CONSERVAZIONE);
    const quadrature = (await fetchAll(svc.QuadraturaFir, { stato: 'completata' }))
      .filter(q => q.righe_json && String(q.data_fine || '').slice(0, 10) >= dal);
    if (!verifiche.length && !quadrature.length) {
      return Response.json({ ok: true, controllate: 0, aggiornate: 0, quadrature: 0, quadrature_aggiornate: 0 });
    }

    const { movimenti, archivi } = await caricaMovimenti(base44);
    const esiti = await ricontrollaVerifiche(base44, verifiche, movimenti, { scrivi: true, riprova: conRitentativi });

    let quadratureAggiornate = 0;
    const errori = esiti.filter(r => r.errore).map(r => ({ verifica: r.id, errore: r.errore }));
    for (const q of quadrature) {
      try {
        // Gli archivi sono gia' in memoria: ogni settimana si conta li', senza rileggerli.
        const gestionale = await caricaGestionale(base44, { inizio: q.data_inizio, fine: q.data_fine }, null, { archivi, caricamenti });
        const r = await conRitentativi(() => rifaiQuadratura(base44, q, gestionale, { scrivi: true }));
        if (r && r.salvato) quadratureAggiornate++;
      } catch (e) {
        errori.push({ quadratura: q.id, errore: e && e.message ? e.message : String(e) });
      }
    }

    return Response.json({
      ok: true,
      controllate: esiti.length,
      aggiornate: esiti.filter(r => r.salvato).length,
      quadrature: quadrature.length,
      quadrature_aggiornate: quadratureAggiornate,
      errori,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
