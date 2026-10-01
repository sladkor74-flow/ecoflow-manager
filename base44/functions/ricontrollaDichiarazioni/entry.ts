import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import {
  caricaMovimenti, oggiRoma, aggiungiGiorni, statoCaricamenti, caricamentiDuranteLettura, descriviCaricamento, GIORNI_CONSERVAZIONE,
} from "../../shared/reportSettimanali.ts";
import { ricontrollaVerifiche, conRitentativi, piuRecentiPerSoggetto, daRiconfrontare } from "../../shared/esitoVerifica.ts";
import { caricaGestionale, rifaiQuadratura, TIPI_CARICAMENTO } from "../../shared/quadraturaFirDati.ts";
import { precaricaParti } from "../../shared/testoLungo.ts";
import { eAlleggerito } from "../../shared/conservazione.ts";
import { livelloDi, puoCaricare } from "../../shared/livelli.ts";

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
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // CHI PUO' RISCRIVERE LE VERIFICHE E LE QUADRATURE (02/10/2026).
    //
    // Questa funzione passava scrivi: true fisso, e in cima c'era solo il
    // controllo del login: qualunque utente collegato, anche di sola lettura,
    // poteva far riscrivere gli esiti delle verifiche settimanali, gli alert e
    // le quadrature FIR - e l'elenco dei giorni, che arriva dal corpo della
    // richiesta, decideva anche QUALI settimane riscrivere.
    //
    // Che fosse una dimenticanza e non una scelta lo dicono le altre due
    // funzioni che chiamano le STESSE funzioni condivise: verificheReport e
    // quadraturaFir passano entrambe scrivi: eAmministratore(user). Due su tre
    // lo facevano, la terza no.
    //
    // Qui pero' non si pretende l'amministratore: il riconfronto dopo un
    // caricamento e' legittimo per chi quel caricamento lo fa, e le primarie le
    // carica anche l'operatore base (regola 2: ogni caricamento aggiorna tutto).
    // Il permesso giusto e' quello: chi puo' caricare puo' far riconfrontare,
    // chi consulta vede il risultato a schermo e non lo salva.
    const puoScrivere = puoCaricare(await livelloDi(base44, user), 'primarie');

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
    const verifiche = piuRecentiPerSoggetto(await fetchAll(svc.VerificaReport))
      // anche le verifiche rinviate durante un caricamento, con le righe gia' lette:
      // e' qui, a caricamento finito, che si completano.
      // Una verifica alleggerita non ha piu' le righe del report: il confronto non
      // si puo' rifare, e daRiconfrontare la lascia gia' fuori. Si dice lo stesso,
      // perche' e' il motivo per cui da un certo giorno in poi non si aggiorna piu'.
      .filter(v => daRiconfrontare(v) && !eAlleggerito(v));
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

    const esiti = await ricontrollaVerifiche(base44, verifiche, movimenti, { scrivi: puoScrivere, riprova: conRitentativi });

    let quadratureAggiornate = 0;
    const errori = esiti.filter(r => r.errore).map(r => ({ verifica: r.id, errore: r.errore }));
    // i testi salvati delle quadrature, in blocco (vedi precaricaParti)
    await precaricaParti(base44, 'QuadraturaFir', quadrature, ['righe_json', 'lettura_json', 'esito_json']);
    for (const q of quadrature) {
      try {
        // Gli archivi sono gia' in memoria: ogni settimana si conta li', senza rileggerli.
        const gestionale = await caricaGestionale(base44, { inizio: q.data_inizio, fine: q.data_fine }, null, { archivi, caricamenti: dopo });
        const r = await conRitentativi(() => rifaiQuadratura(base44, q, gestionale, { scrivi: puoScrivere }));
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
