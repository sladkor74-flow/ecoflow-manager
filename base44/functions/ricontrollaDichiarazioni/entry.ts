import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { fetchAll } from "../../shared/fetchAll.ts";
import {
  caricaMovimenti, oggiRoma, aggiungiGiorni, statoCaricamenti, caricamentiDuranteLettura, descriviCaricamento, GIORNI_CONSERVAZIONE,
} from "../../shared/reportSettimanali.ts";
import { ricontrollaVerifiche, conRitentativi, piuRecentiPerSoggetto } from "../../shared/esitoVerifica.ts";
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
// loro settimana, e lo storico mostra il loro esito solo se e' stato confermato
// dopo l'ultimo caricamento.
//
// Di ogni soggetto e settimana si riconfronta solo la verifica piu' recente: le
// altre sono sostituite, e una dichiarazione sostituita dal report riapriva
// l'alert di un impianto che il report l'aveva mandato.
//
// La risposta dice a chi chiama (dopoCaricamento, in importGrandeFile.js) se il
// lavoro e' fatto, con lo stato HTTP:
//   - 200 solo quando tutto e' stato riconfrontato;
//   - 409 quando si rinvia perche' un archivio dei movimenti si sta riscrivendo,
//     o si e' riscritto mentre lo si leggeva: un confronto su un archivio a meta'
//     darebbe esiti falsi, e non si scrive niente. Il messaggio nomina il
//     caricamento;
//   - 500 quando qualcosa non e' riuscito, con i primi errori.
// Un 200 con dentro "rinviato" o degli errori veniva preso per un aggiornamento
// riuscito, e sotto il caricamento compariva "Aggiornati" anche se non si era
// aggiornato niente.
//
// durata_ms dice quanto ha impiegato: la funzione legge tutti gli archivi e poi
// due o tre testi lunghi per ogni verifica e quadratura, e va tenuta d'occhio
// perche' non superi il tempo massimo di una funzione.

const PRIMI_ERRORI = 5;

export default async function(req) {
  const avvio = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const rinvio = (caricamenti) => Response.json({
      error: `Riconfronto delle verifiche settimanali rinviato. Caricamento ${caricamenti.map(descriviCaricamento).join('; ')}. `
        + 'Si rifà da solo al prossimo caricamento concluso e all\'apertura della settimana.',
      rinviato: true,
      caricamenti,
      durata_ms: Date.now() - avvio,
    }, { status: 409 });

    const svc = base44.asServiceRole.entities;
    const primaDegliArchivi = await statoCaricamenti(base44, TIPI_CARICAMENTO);
    if (primaDegliArchivi.in_corso.length) return rinvio(primaDegliArchivi.in_corso);

    const oggi = oggiRoma();
    const scaduta = (v) => !!v.scade_il && String(v.scade_il).slice(0, 10) <= oggi;
    const verifiche = piuRecentiPerSoggetto(await fetchAll(svc.VerificaReport))
      .filter(v => v.stato === 'completata' && !scaduta(v));
    const dal = aggiungiGiorni(oggi, -GIORNI_CONSERVAZIONE);
    // Una scheda di extra raccolta scritta o corretta in ritardo porta i giorni di
    // fine trasporto toccati: si rifanno anche le quadrature, di qualunque eta',
    // delle settimane che li contengono.
    const corpo = await req.json().catch(() => ({}));
    const giorni = Array.isArray(corpo && corpo.giorni) ? corpo.giorni.map(g => String(g).slice(0, 10)).filter(g => /^\d{4}-\d{2}-\d{2}$/.test(g)) : [];
    const contiene = (q) => giorni.some(g => g >= String(q.data_inizio || '').slice(0, 10) && g <= String(q.data_fine || '').slice(0, 10));
    const quadrature = (await fetchAll(svc.QuadraturaFir, { stato: 'completata' }))
      .filter(q => q.righe_json && (String(q.data_fine || '').slice(0, 10) >= dal || contiene(q)));
    if (!verifiche.length && !quadrature.length) {
      return Response.json({ ok: true, controllate: 0, aggiornate: 0, quadrature: 0, quadrature_aggiornate: 0, durata_ms: Date.now() - avvio });
    }

    const { movimenti, archivi } = await caricaMovimenti(base44);
    // Lo stato si rilegge dopo gli archivi: un caricamento partito o concluso
    // mentre li si leggeva li ha lasciati a meta', e con una lettura sola, fatta
    // prima, non si vedeva.
    const dopo = await statoCaricamenti(base44, TIPI_CARICAMENTO);
    const durante = caricamentiDuranteLettura(primaDegliArchivi, dopo);
    if (durante.length) return rinvio(durante);

    const esiti = await ricontrollaVerifiche(base44, verifiche, movimenti, { scrivi: true, riprova: conRitentativi });

    let quadratureAggiornate = 0;
    const errori = esiti.filter(r => r.errore).map(r => ({ verifica: r.id, errore: r.errore }));
    for (const q of quadrature) {
      try {
        // Gli archivi sono gia' in memoria: ogni settimana si conta li', senza rileggerli.
        const gestionale = await caricaGestionale(base44, { inizio: q.data_inizio, fine: q.data_fine }, null, { archivi, caricamenti: dopo });
        const r = await conRitentativi(() => rifaiQuadratura(base44, q, gestionale, { scrivi: true }));
        if (r && r.salvato) quadratureAggiornate++;
      } catch (e) {
        errori.push({ quadratura: q.id, errore: e && e.message ? e.message : String(e) });
      }
    }

    const riepilogo = {
      controllate: esiti.length,
      aggiornate: esiti.filter(r => r.salvato).length,
      quadrature: quadrature.length,
      quadrature_aggiornate: quadratureAggiornate,
      durata_ms: Date.now() - avvio,
    };
    console.log(`ricontrollaDichiarazioni: ${riepilogo.controllate} verifiche e ${riepilogo.quadrature} quadrature in ${riepilogo.durata_ms} ms, ${errori.length} errori`);

    if (errori.length) {
      const primi = errori.slice(0, PRIMI_ERRORI).map(e => `${e.verifica ? 'verifica ' + e.verifica : 'quadratura ' + e.quadratura}: ${e.errore}`);
      return Response.json({
        error: `Riconfronto non riuscito per ${errori.length === 1 ? 'una verifica o quadratura' : `${errori.length} verifiche o quadrature`}: ${primi.join('; ')}${errori.length > primi.length ? `; e altri ${errori.length - primi.length}` : ''}.`,
        ...riepilogo,
        errori,
      }, { status: 500 });
    }
    return Response.json({ ok: true, ...riepilogo });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error), durata_ms: Date.now() - avvio }, { status: 500 });
  }
}
