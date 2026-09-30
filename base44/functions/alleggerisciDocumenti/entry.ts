import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { leggiJson } from "../../shared/testoLungo.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { cancellaFile, sostituisciFileArretrati, supportoCancellazione, segnalaFileNonRimossi } from "../../shared/fileArchivio.ts";
import {
  GIORNI_CONSERVAZIONE, daAlleggerire, togliIlDettaglio,
  storiaVerifica, storiaQuadratura, storiaConsuntivo,
} from "../../shared/conservazione.ts";
import { alleggerisciVecchi, alleggerisciControlliSuperati, indiceSicurezza } from "../../shared/evasioneAssegnatiDati.ts";

// ALLEGGERISCE I DOCUMENTI DEI FORNITORI: toglie il dettaglio, lascia la storia.
//
// Richiesta dell'utente (29/09/2026): i documenti caricati devono sparire dopo i
// quaranta giorni per non appesantire il dominio, ma il contenuto - la storia
// scritta - deve restare per poterne fruire in futuro.
//
// Prima di oggi questa funzione si chiamava pulisciVerificheReport e CANCELLAVA
// le verifiche dei report settimanali per intero: se ne andava anche la storia.
// Adesso di ogni documento restano il record, i suoi numeri di sintesi e una
// storia scritta in italiano; se ne vanno le righe lette e il confronto riga per
// riga, che sono il grosso del peso.
//
// Tre archivi si contano a GIORNI dal caricamento (verifiche dei report
// settimanali, quadrature FIR, consuntivi). Liste degli assegnati e controlli
// dell'evasione no: quelli si contano a MESI, perche' il controllo dell'evasione
// lavora ancora sulle liste del mese in corso e di quello prima, e una lista di
// fine mese alleggerita al quarantesimo giorno sparirebbe mentre e' ancora in
// uso. La loro regola e' una sola ed e' in alleggerisciVecchi.
//
// Si prova anche a cancellare i file rimasti nell'archivio privato: un PDF o
// un'immagine si cancellano gia' subito dopo la lettura, ma se quella
// cancellazione non riesce il file resta, e adesso il suo identificativo e'
// scritto sul record proprio per poterci riprovare.
//
// Payload: { giorni?: 40, massimo?: 60, solo_elenco?: false }
// Gira ogni notte dal workflow AlleggerimentoDocumenti, come amministratore.

const ARCHIVI = [
  { entita: 'VerificaReport', nome: 'verifiche dei report settimanali', campoEsito: 'esito_json', storia: storiaVerifica },
  { entita: 'QuadraturaFir', nome: 'quadrature FIR', campoEsito: 'esito_json', storia: storiaQuadratura },
  { entita: 'ConsuntivoFornitore', nome: 'consuntivi dei fornitori', campoEsito: 'esito_json', storia: storiaConsuntivo },
];

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();

    const body = await req.json().catch(() => ({}));
    const giorni = Math.max(1, Math.min(3650, Number(body.giorni) || GIORNI_CONSERVAZIONE));
    // Un tetto per giro: la piattaforma conta 429 richieste al minuto per tutta
    // l'app, e qui ogni documento ne costa quattro. Quello che avanza si fa la
    // notte dopo, e quanto avanza si dice.
    const massimo = Math.max(1, Math.min(300, Number(body.massimo) || 60));
    const soloElenco = body.solo_elenco === true;
    const svc = base44.asServiceRole.entities;
    const oggi = oggiRoma();
    const adessoMs = Date.now();

    // Si guarda subito se la piattaforma sappia cancellare un file: e' la domanda
    // a cui nessuno aveva risposta, e la risposta non deve restare dentro questa
    // risposta HTTP, che nessuno legge (il lavoro e' pianificato).
    const supporto = supportoCancellazione(base44);
    const esito = { oggi, giorni, supporto_cancellazione: supporto, alleggeriti: 0, restano: 0, archivi: [], file: { cancellati: 0, bloccati: 0, non_riusciti: [] }, senza_data: [] };
    let restanti = massimo;
    // Appena la piattaforma rifiuta l'operazione si smette di chiamarla: verificato
    // il 30/09/2026, le funzioni ci sono ma rispondono "Method Not Allowed", e
    // tre richieste a vuoto per ogni documento sono richieste rubate al limite al
    // minuto di tutta l'app. L'alleggerimento del TESTO va avanti comunque: e' li'
    // che sta il peso, e il file e' un extra che non dipende da noi.
    let negataFile = false;

    for (const a of ARCHIVI) {
      const tutti = await fetchAll(svc[a.entita]);
      const { scelti, senza_data } = daAlleggerire(tutti, { entita: a.entita, giorni, adessoMs });
      if (senza_data.length) esito.senza_data.push({ entita: a.entita, quanti: senza_data.length });
      const fatti = [];
      for (const s of scelti) {
        if (restanti <= 0 || soloElenco) break;
        const record = tutti.find(r => r.id === s.id);
        if (!record) continue;
        // L'esito si legge PRIMA di svuotare: la storia si scrive da li'. Se non
        // si ricompone (parti perse) si scrive lo stesso quello che si sa dai
        // campi del record: una storia povera e' meglio di nessuna storia.
        // Un documento RIPRESO (svuotato ma non marcato, perche' il giro di prima
        // si e' interrotto) ha gia' la sua storia: non si rilegge niente e non si
        // riscrive niente, si finisce solo il lavoro.
        let letto = null;
        if (!s.ripreso && s.campi.includes(a.campoEsito)) {
          try { letto = await leggiJson(base44, a.entita, record, a.campoEsito, null); } catch (_e) { letto = null; }
        }
        await togliIlDettaglio(base44, a.entita, record, a.storia(record, letto), oggi);
        // Il file rimasto nell'archivio privato: si riprova a toglierlo, e se la
        // piattaforma non lo consente lo si scrive invece di crederlo fatto.
        if (s.file_uri) {
          if (negataFile) esito.file.bloccati++;
          else {
            const tolto = await cancellaFile(base44, s.file_uri);
            if (tolto.riuscita) { await svc[a.entita].update(record.id, { file_uri: '' }); esito.file.cancellati++; }
            else {
              esito.file.non_riusciti.push({ entita: a.entita, id: record.id, motivo: tolto.come, negata: !!tolto.negata });
              esito.file.bloccati++;
              if (tolto.negata) negataFile = true;
            }
          }
        }
        fatti.push({ id: record.id, giorni: s.giorni, senza_esito: !letto, ripreso: !!s.ripreso });
        esito.alleggeriti++;
        restanti--;
      }
      esito.restano += Math.max(0, scelti.length - fatti.length);
      esito.archivi.push({ entita: a.entita, nome: a.nome, da_alleggerire: scelti.length, alleggeriti: fatti.length, in_tutto: tutti.length });
    }

    // Liste degli assegnati e controlli dell'evasione: a mesi, non a giorni.
    if (!soloElenco) {
      const evasione = await alleggerisciVecchi(base44, { finoAIndice: indiceSicurezza(), massimo: Math.max(0, restanti) });
      esito.alleggeriti += evasione.alleggeriti;
      esito.restano += evasione.restano || 0;
      restanti -= evasione.alleggeriti;
      esito.archivi.push({
        entita: 'ListaAssegnati e ControlloEvasione', nome: 'liste degli assegnati e controlli dell\'evasione',
        da_alleggerire: evasione.alleggeriti, alleggeriti: evasione.alleggeriti, a_mesi: true,
      });

      // I controlli superati: di ogni lista resta per esteso solo l'ultimo. Non
      // c'entra coi quaranta giorni, ma e' la voce che pesa di piu' in archivio.
      const superati = await alleggerisciControlliSuperati(base44, { massimo: Math.max(0, restanti) });
      esito.alleggeriti += superati.alleggeriti;
      esito.restano += superati.restano;
      esito.archivi.push({
        entita: 'ControlloEvasione', nome: 'controlli dell\'evasione superati da uno piu\' recente',
        da_alleggerire: superati.alleggeriti + superati.restano, alleggeriti: superati.alleggeriti, superati: true,
      });
    }

    // L'ARRETRATO DEI FILE DEL CARICAMENTO DATI. Il file di un caricamento viene
    // sostituito da quello dopo (regola dell'utente, 29/09/2026), ma solo quando
    // quel tipo di dato si ricarica: ci sono tipi che si caricano una volta al
    // mese o meno, e i file di prima resterebbero li' ad aspettare. Qui si
    // rimedia, tenendo per ogni tipo il file del caricamento riuscito piu'
    // recente. I record del registro non si toccano: e' il controllo
    // anti-regressione e la storia dei caricamenti.
    if (!soloElenco) {
      try {
        esito.file_caricamenti = await sostituisciFileArretrati(base44, { oggi, massimo: 40 });
        esito.file.cancellati += esito.file_caricamenti.tolti;
        esito.file.bloccati += esito.file_caricamenti.restano;
        if (esito.file_caricamenti.non_riusciti.length) esito.file.non_riusciti.push(...esito.file_caricamenti.non_riusciti);
      } catch (e) {
        esito.file_caricamenti = { errore: e && e.message ? e.message : String(e) };
      }
    }

    // L'esito dei file finisce in un ALERT, che e' l'unico posto dove
    // l'amministratore lo vede senza chiedere niente a nessuno. Si chiude da solo
    // quando i file tornano a cancellarsi.
    if (!soloElenco) {
      try {
        esito.segnalazione = await segnalaFileNonRimossi(base44, { supporto, nonRiusciti: esito.file.non_riusciti, bloccati: esito.file.bloccati, oggi });
      } catch (e) {
        esito.segnalazione = { errore: e && e.message ? e.message : String(e) };
      }
    }

    return Response.json(esito);
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
