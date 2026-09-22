import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  intervalloSettimana, statoCaricamenti, caricamentiDuranteLettura, descriviCaricamento,
} from "../../shared/reportSettimanali.ts";
import { caricaGestionale, rifaiQuadratura, sintesiPerCanale, contaDistinti, TIPI_CARICAMENTO } from "../../shared/quadraturaFirDati.ts";
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
// Lo stato dei caricamenti si legge prima e dopo gli archivi: letto una volta
// sola, un caricamento partito o finito mentre si leggevano non si vedeva, e
// l'esito si rifaceva su un archivio a meta'.
//
// Payload: { anno, settimana, con_esito }

// L'istante di una data del server, che puo' arrivare senza la Z finale.
const istante = (v) => {
  if (!v) return 0;
  const s = String(v);
  const t = new Date(s.includes('T') && !/(Z|[+-]\d{2}:?\d{2})$/i.test(s) ? s + 'Z' : s).getTime();
  return isNaN(t) ? 0 : t;
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { anno, settimana, con_esito } = await req.json();
    if (!anno || !settimana) return Response.json({ error: 'Anno e settimana obbligatori' }, { status: 400 });

    const svc = base44.asServiceRole.entities;
    const intervallo = intervalloSettimana(Number(anno), Number(settimana));

    const primaDegliArchivi = await statoCaricamenti(base44, TIPI_CARICAMENTO);
    const [trovate, storico, gestionale] = await Promise.all([
      svc.QuadraturaFir.filter({ anno: Number(anno), settimana: Number(settimana) }, '-created_date', 5),
      svc.QuadraturaFir.filter({ anno: Number(anno) }, '-settimana', 60),
      caricaGestionale(base44, intervallo, null, { caricamenti: primaDegliArchivi }),
    ]);
    const dopo = await statoCaricamenti(base44, TIPI_CARICAMENTO);
    const durante = caricamentiDuranteLettura(primaDegliArchivi, dopo)
      .map(a => ({ ...a, descrizione: descriviCaricamento(a) }));

    let q = (trovate || [])[0] || null;
    let esito = null;
    // come e' andato il riconfronto: rifatto, cambiato, salvato, oppure perche' no
    const ricalcolo = { rifatto: false, cambiato: false, salvato: false, eseguito_il: null, motivo: '' };
    const rinvio = (elenco) => `Caricamento ${elenco.map(a => a.descrizione || descriviCaricamento(a)).join('; ')}. L'esito è quello dell'ultimo confronto e si rifà da solo a caricamento finito.`;
    if (q && con_esito !== false) {
      let rifatta = null;
      if (durante.length) {
        ricalcolo.motivo = rinvio(durante);
      } else {
        try {
          rifatta = await rifaiQuadratura(base44, q, gestionale, { scrivi: eAmministratore(user) });
        } catch (e) {
          ricalcolo.motivo = 'Il confronto non si è potuto rifare con i movimenti di adesso (' + (e && e.message ? e.message : String(e)) + '): è quello salvato.';
        }
      }
      if (rifatta && rifatta.esito) {
        esito = rifatta.esito;
        Object.assign(ricalcolo, { rifatto: true, cambiato: rifatta.cambiato, salvato: rifatta.salvato, eseguito_il: rifatta.eseguito_il });
        q = { ...q, per_canale: rifatta.per_canale, lettura_verificata: rifatta.lettura_verificata, verificata_il: rifatta.verificata_il };
      } else if (rifatta && rifatta.rinviato) {
        ricalcolo.motivo = rinvio(rifatta.rinviato);
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
        senza_fine: dati.senza_fine,
        // Immissione, inizio e fine trasporto sono obbligatorie (22/09/2026): i
        // formulari della settimana a cui manca l'immissione o l'inizio, o con
        // date incoerenti, si dicono anche prima di caricare la stampa.
        date_da_sistemare: { n: contaDistinti(dati.date_da_sistemare || []), esempi: (dati.date_da_sistemare || []).slice(0, 5).map(x => ({ fir: x.fir, ordine: x.ordine, date: x.date })) },
      };
    }

    // Lo storico mostra l'esito salvato canale per canale solo se e' ancora
    // buono, cioe' confermato dopo l'ultimo caricamento riuscito: il riconfronto
    // che segue ogni caricamento lo rifa' (o ne conferma la data) per le
    // settimane recenti, l'apertura della settimana per le altre. Un esito
    // anteriore a un caricamento e' di un gestionale che non c'e' piu': quella
    // settimana si mostra senza colore, e l'esito vero si vede aprendola.
    // Conta la fine del caricamento, non l'inizio: un confronto fatto mentre il
    // caricamento scriveva e' successivo al suo inizio, ma l'archivio era a meta'.
    // Un esito salvato senza verificata_il non e' stato confermato (stampa
    // caricata durante un caricamento) e non si colora.
    const ultimoCaricamento = Math.max(0, ...Object.values(dopo.ultimi || {}).map(u => istante(u.concluso_il || u.creato_il)));
    const esitoValido = (r) => r.stato === 'completata' && Array.isArray(r.per_canale) && r.per_canale.length > 0
      && !!r.verificata_il && istante(r.verificata_il) >= ultimoCaricamento;
    // La settimana aperta ha l'esito appena rifatto, salvato o no.
    const perCanaleStorico = (r) => (q && r.id === q.id && ricalcolo.rifatto ? q.per_canale : esitoValido(r) ? r.per_canale : null);

    return Response.json({
      anno: Number(anno),
      settimana: Number(settimana),
      intervallo,
      quadratura: q,
      esito,
      // La conformita' e' per canale: rete, ACI ed extra raccolta non hanno un verdetto comune.
      per_canale: esito ? (esito.per_canale || sintesiPerCanale(esito)) : null,
      ricalcolo,
      caricamenti_in_corso: durante,
      gestionale: totali,
      storico: (storico || []).map(r => ({
        id: r.id, settimana: r.settimana, stato: r.stato, file_nome: r.file_nome, verificata_il: r.verificata_il,
        per_canale: perCanaleStorico(r),
      })),
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
