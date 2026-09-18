import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { intervalloSettimana } from "../../shared/reportSettimanali.ts";
import { caricaGestionale } from "../../shared/quadraturaFirDati.ts";
import { FLUSSI, ORDINE_FLUSSI } from "../../shared/quadraturaFir.ts";
import { leggiJson } from "../../shared/testoLungo.ts";

// Quello che serve alla sezione Quadratura FIR del modulo Verifiche:
// la quadratura della settimana scelta con il suo esito, i numeri che il
// gestionale ha in quella settimana e l'elenco delle settimane gia' fatte.
//
// I numeri del gestionale si mostrano anche prima di caricare il file, cosi' si
// sa subito cosa aspettarsi dalla stampa.
//
// Payload: { anno, settimana, con_esito }

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

    const q = (trovate || [])[0] || null;
    let esito = null;
    if (q && con_esito !== false && q.esito_json) {
      try {
        esito = await leggiJson(base44, 'QuadraturaFir', q, 'esito_json', null);
      } catch (e) {
        esito = null;
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
      gestionale: totali,
      storico: (storico || []).map(r => ({
        id: r.id, settimana: r.settimana, stato: r.stato, conformita: r.conformita,
        incongruenti: r.incongruenti, congruenti: r.congruenti, file_nome: r.file_nome,
        verificata_il: r.verificata_il, lettura_verificata: r.lettura_verificata,
      })),
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
