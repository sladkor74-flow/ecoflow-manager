import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { intervalloSettimana } from "../../shared/reportSettimanali.ts";
import { caricaGestionale, caricamentiAperti, rifaiQuadratura, sintesiPerCanale } from "../../shared/quadraturaFirDati.ts";
import { FLUSSI, ORDINE_FLUSSI } from "../../shared/quadraturaFir.ts";
import { leggiJson } from "../../shared/testoLungo.ts";
import { eAmministratore } from "../../shared/permessi.ts";

// Quello che serve alla sezione Quadratura FIR del modulo Verifiche:
// la quadratura della settimana scelta con il suo esito, i numeri che il
// gestionale ha in quella settimana e l'elenco delle settimane gia' fatte.
//
// I numeri del gestionale si mostrano anche prima di caricare il file, cosi' si
// sa subito cosa aspettarsi dalla stampa.
//
// L'esito non e' quello salvato il giorno della stampa: si rifa' qui, sulle righe
// gia' lette e con i movimenti di adesso, che per la settimana si leggono
// comunque. Salvato una volta e mai piu' ricalcolato, l'esito continuava a dire
// "portale diverso dal gestionale" su formulari caricati il giorno dopo. Se
// cambia lo salva l'amministratore (le scritture sono sue); chi consulta lo vede
// aggiornato lo stesso. Mentre un archivio si sta riscrivendo non si rifa'
// niente e resta l'ultimo esito salvato, con il motivo.
//
// Payload: { anno, settimana, con_esito }

// I campi della quadratura che il riconfronto aggiorna.
const CAMPI_SINTESI = ['congruenti', 'incongruenti', 'osservazioni', 'non_confrontabili', 'conformita'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { anno, settimana, con_esito } = await req.json();
    if (!anno || !settimana) return Response.json({ error: 'Anno e settimana obbligatori' }, { status: 400 });

    const svc = base44.asServiceRole.entities;
    const intervallo = intervalloSettimana(Number(anno), Number(settimana));

    const [trovate, storico, gestionale] = await Promise.all([
      svc.QuadraturaFir.filter({ anno: Number(anno), settimana: Number(settimana) }, '-created_date', 5),
      svc.QuadraturaFir.filter({ anno: Number(anno) }, '-settimana', 60),
      caricaGestionale(base44, intervallo),
    ]);

    let q = (trovate || [])[0] || null;
    let esito = null;
    // come e' andato il riconfronto: rifatto, cambiato, salvato, oppure perche' no
    const ricalcolo = { rifatto: false, cambiato: false, salvato: false, motivo: '' };
    if (q && con_esito !== false) {
      let rifatta = null;
      try {
        rifatta = await rifaiQuadratura(base44, q, gestionale, { scrivi: eAmministratore(user) });
      } catch (e) {
        ricalcolo.motivo = 'Il confronto non si è potuto rifare con i movimenti di adesso (' + (e && e.message ? e.message : String(e)) + '): è quello salvato.';
      }
      if (rifatta && rifatta.esito) {
        esito = rifatta.esito;
        Object.assign(ricalcolo, { rifatto: true, cambiato: rifatta.cambiato, salvato: rifatta.salvato });
        q = {
          ...q,
          ...Object.fromEntries(CAMPI_SINTESI.map(k => [k, rifatta.sintesi[k]])),
          lettura_verificata: rifatta.lettura_verificata,
          verificata_il: rifatta.verificata_il,
        };
      } else if (rifatta && rifatta.rinviato) {
        ricalcolo.motivo = 'Un caricamento non è concluso (' + rifatta.rinviato.map(a => a.tipo_file.replace(/_/g, ' ')).join(', ') + '): l\'esito è quello dell\'ultimo confronto e si rifà a caricamento finito.';
      }
      if (!esito && q.esito_json) {
        try {
          esito = await leggiJson(base44, 'QuadraturaFir', q, 'esito_json', null);
        } catch {
          esito = null;
        }
      }
    }

    // Alla sezione bastano i totali: i formulari di dettaglio stanno nell'esito.
    const totali = {};
    for (const chiave of ORDINE_FLUSSI) {
      const dati = gestionale[chiave];
      if (!dati) continue;
      totali[chiave] = {
        titolo: FLUSSI[chiave].titolo,
        canale: FLUSSI[chiave].canale,
        totale: dati.totale,
        celle: dati.celle.length,
        ultimo_caricamento: dati.ultimo_caricamento,
      };
    }

    return Response.json({
      anno: Number(anno),
      settimana: Number(settimana),
      intervallo,
      quadratura: q,
      esito,
      // La conformita' e' per canale: rete, ACI ed extra raccolta non hanno un verdetto comune.
      per_canale: esito ? (esito.per_canale || sintesiPerCanale(esito)) : null,
      ricalcolo,
      caricamenti_in_corso: caricamentiAperti(gestionale),
      gestionale: totali,
      // Dello storico non si manda la conformita' salvata: era un verdetto unico
      // per tutti i canali, e per le settimane non aperte poteva essere vecchio.
      storico: (storico || []).map(r => ({
        id: r.id, settimana: r.settimana, stato: r.stato, file_nome: r.file_nome, verificata_il: r.verificata_il,
      })),
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
