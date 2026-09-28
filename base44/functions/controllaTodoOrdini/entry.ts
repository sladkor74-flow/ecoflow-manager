import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { statoCaricamenti, caricamentiDuranteLettura, descriviCaricamento } from "../../shared/reportSettimanali.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { ordiniAttivita, statoOrdini, controlloAttivita, testoControlloTodo } from "../../shared/todoOrdini.ts";

// Chiude le attivita' della to-do list il cui ordine e' stato ritirato.
//
// Sull'attivita' l'utente scrive l'ID ordine da completare; quando quell'ordine
// passa da assegnato a terminato l'attivita' e' fatta e si chiude da sola, con
// scritto perche' e quando. Le regole stanno tutte in shared/todoOrdini.ts:
// vale la FINE TRASPORTO (regola 1), un ordine cancellato non chiude niente e si
// segnala, con piu' ordini si chiude quando sono terminati tutti.
//
// IL PRIMO GIRO SU UN'ATTIVITA' NON CHIUDE MAI: scrive che cosa sta guardando e
// che cosa c'e' da attendere. Il passaggio da assegnato a terminato si deve vedere
// (parole dell'utente: "solo allora"), e le attivita' scritte prima portano un
// ordine "correlato" che di solito e' terminato da mesi: chiudendole al primo giro
// si sarebbe archiviato in blocco del lavoro mai fatto.
//
// Parte da sola dopo ogni caricamento delle primarie, come gli altri ricalcoli
// (RICALCOLI in src/lib/importGrandeFile.js: regola 2, ogni caricamento aggiorna
// tutti i moduli), e a ogni apertura della pagina To-Do List.
//
// Si leggono SOLO gli ordini scritti sulle attivita', a lotti: sono una manciata,
// e rileggere gli archivi interi a ogni apertura di pagina riempirebbe il
// limite di richieste al minuto della piattaforma. Se un ID non si trova da
// nessuna parte non si chiude niente e lo si dice (avviso_ordini): un ID scritto
// male, o un file del portale non ancora caricato, si vede invece di sparire.
//
// Il livello non si guarda, come negli altri quattro ricalcoli dopo un
// caricamento: le primarie le puo' caricare anche l'operatore base, e un
// ricalcolo che gli rispondesse 403 resterebbe rosso per sempre e si
// ritenterebbe a ogni apertura della pagina dei caricamenti. Non e' una
// modifica di chi chiama, e' il gestionale che si riallinea. Il freno sta dove
// deve stare: la pagina To-Do List lo chiama solo per l'amministratore.
//
// Risposte: 200 con { controllate, aggiornate, chiuse, da_guardare, avviso };
// 401 a chi non e' entrato nel gestionale;
// 200 con rinviato: true, senza scrivere niente, se le primarie si stanno
// caricando o un caricamento le ha lasciate a meta' (su un archivio a meta' un
// ordine risulterebbe non terminato e l'attivita' resterebbe aperta per sbaglio,
// oppure - peggio - un ordine mancante darebbe "non si trova"); 500 con gli
// errori se qualche attivita' non si e' potuta salvare, dicendo quali sono
// state toccate.

// Quanti ID ordine per richiesta: cinquanta tengono la richiesta corta, come i
// lotti della cancellazione in importaBlocco.
const LOTTO_ORDINI = 50;

// I movimenti e gli assegnati di quegli ordini soltanto. I movimenti sono le
// primarie di rete, dell'ACI e le schede di extra raccolta: si guarda lo stato di
// un ordine per volta, nessun numero passa da un canale all'altro.
async function leggiOrdini(svc, ids) {
  const movimenti = [];
  const assegnati = [];
  for (let i = 0; i < ids.length; i += LOTTO_ORDINI) {
    const lotto = { id_ordine: { $in: ids.slice(i, i + LOTTO_ORDINI) } };
    const [rete, aci, extra, assRete, assAci] = await Promise.all([
      fetchAll(svc.PrimariaRete, lotto),
      fetchAll(svc.PrimariaAci, lotto),
      fetchAll(svc.ExtraRaccolta, lotto),
      fetchAll(svc.Assegnato, lotto),
      fetchAll(svc.AssegnatoAci, lotto),
    ]);
    movimenti.push(...rete, ...aci, ...extra);
    assegnati.push(...assRete, ...assAci);
  }
  return { movimenti, assegnati };
}

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole.entities;
    const oggi = oggiRoma();
    const niente = { controllate: 0, aggiornate: 0, chiuse: [], da_guardare: [], avviso: '' };

    // Le attivita' sono poche e stanno in un archivio piccolo: si leggono tutte e
    // si tengono quelle che hanno scritto qualcosa sull'ordine da completare.
    // Anche quelle il cui testo non e' un ID ordine: non si chiudera' niente, ma
    // lo si dice, invece di lasciare l'utente ad aspettare.
    const attivita = (await fetchAll(svc.Todo))
      .filter(t => ordiniAttivita(t).length > 0 || String(t.riferimento_ordine || '').trim() !== '');
    if (!attivita.length) return Response.json(niente);
    const ids = [...new Set(attivita.flatMap(ordiniAttivita))];

    // Regola 2: su un archivio che si sta riscrivendo non si decide niente. Lo
    // stato dei caricamenti si legge prima e dopo, perche' uno che parte mentre
    // si leggono gli ordini non si vedrebbe.
    const prima = await statoCaricamenti(base44, ['primarie']);
    const { movimenti, assegnati } = await leggiOrdini(svc, ids);
    const durante = caricamentiDuranteLettura(prima, await statoCaricamenti(base44, ['primarie']));
    if (durante.length) {
      return Response.json({
        ...niente,
        rinviato: true,
        caricamenti_in_corso: durante,
        avviso: `Le attività della to-do list non sono state controllate adesso: ${durante.map(descriviCaricamento).join('; ')}. Si rifà a caricamento concluso.`,
      });
    }

    // Se la domanda per numero d'ordine non torna NIENTE mentre gli ID da cercare
    // ci sono, non e' una risposta: e' un guasto. Scrivendo comunque, su ogni
    // attivita' comparirebbe "l'ordine non si trova fra gli ordini caricati" e si
    // manderebbe l'utente a rifare un caricamento inutile. Si rinvia, come per un
    // archivio a meta'. L'altro posto che legge le primarie per numero d'ordine
    // (getOrdiniDaDichiarare) ha un ripiego che rilegge l'archivio intero: qui no,
    // perche' questo controllo parte a ogni apertura della pagina e rileggere gli
    // archivi riempirebbe il limite di richieste al minuto.
    if (ids.length && movimenti.length === 0 && assegnati.length === 0) {
      return Response.json({
        ...niente,
        rinviato: true,
        avviso: `Le attività della to-do list non sono state controllate adesso: la domanda per numero d'ordine non ha restituito nessuno dei ${ids.length} ordini indicati sulle attività. Non si decide niente su una lettura vuota: si rifà al prossimo caricamento o alla prossima apertura della pagina.`,
      });
    }

    const stato = statoOrdini(movimenti, assegnati);
    let aggiornate = 0;
    const chiuse = [];
    const daGuardare = [];
    const errori = [];
    for (const t of attivita) {
      const { esito, campi, chiusa } = controlloAttivita(t, stato, oggi);
      const cambiato = Object.keys(campi).some(k => String(t[k] ?? '') !== String(campi[k] ?? ''));
      if (cambiato) {
        try {
          await svc.Todo.update(t.id, campi);
          aggiornate++;
        } catch (e) {
          errori.push(`${t.titolo || t.id}: ${(e && e.message) || String(e)}`);
          continue;
        }
      }
      // Una chiusura si racconta solo se e' stata salvata.
      if (chiusa) chiuse.push({ id: t.id, titolo: t.titolo, ordini: esito.ids.join(', '), ritiro: esito.ultima });
      if (campi.avviso_ordini) daGuardare.push({ id: t.id, titolo: t.titolo, avviso: campi.avviso_ordini });
    }

    const risposta = {
      controllate: attivita.length,
      aggiornate,
      chiuse,
      da_guardare: daGuardare,
      avviso: testoControlloTodo(chiuse, daGuardare),
    };
    if (errori.length) return Response.json({ ...risposta, errori }, { status: 500 });
    return Response.json(risposta);
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
