import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { campiTempiRaccolta } from "../../shared/dataEnrichment.ts";
import { eTerminato } from "../../shared/movimenti.ts";
import { statoCaricamenti } from "../../shared/reportSettimanali.ts";

// Riallinea i tempi di raccolta salvati sulle primarie di rete - nr_giorni,
// scadenza_ordine e raccolta_nei_tempi - con la regola del caricamento
// (campiTempiRaccolta in dataEnrichment.ts): dall'immissione alla FINE DEL
// TRASPORTO, sul giorno italiano. Nessuna pagina la lancia: la usa
// l'amministratore per rimettere in ordine un archivio caricato prima della
// correzione, senza ricaricare il file.
//
// Prima misurava fino alla chiusura a portale, contava la scadenza con setDate
// sull'istante di immissione (col cambio dell'ora legale cadeva il giorno prima)
// e scriveva solo i campi vuoti: i valori sbagliati restavano. Ora riscrive ogni
// record dove il valore salvato non e' quello giusto, e dove non si misura (senza
// fine trasporto, senza immissione, fine prima dell'immissione) svuota invece di
// lasciare il vecchio.
//
// Pagina SLA, tabella e alert non leggono questi campi, li ricalcolano: la
// migrazione serve a chi legge l'archivio cosi' com'e' (esportazioni, assistente).
//
// Risposte: 409 se un caricamento delle primarie e' aperto o rimasto a meta' (su
// un archivio a meta' si scriverebbe mezzo lavoro); 500 con i primi errori se
// qualche blocco non si scrive; 200 solo quando ha scritto tutto.
const BLOCCO = 100;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // Riscrive le primarie: solo l'amministratore.
    if (user.role !== 'admin') return rispostaSolaLettura();

    const caricamenti = await statoCaricamenti(base44, ['primarie', 'primarie_rete']);
    if (caricamenti.in_corso.length) {
      const c = caricamenti.in_corso[0];
      return Response.json({
        error: `Il caricamento ${c.tipo_file}${c.nome_file ? ` (${c.nome_file})` : ''} ${c.interrotto ? 'si è interrotto: ricaricare il file' : 'è ancora aperto: attendere che finisca'}, poi rilanciare il riallineamento.`,
        caricamenti_in_corso: caricamenti.in_corso,
      }, { status: 409 });
    }

    const records = await fetchAll(base44.asServiceRole.entities.PrimariaRete);

    // Si confronta sul valore, non sulla scrittura: una scadenza salvata a
    // mezzanotte o a mezzogiorno dello stesso giorno e' la stessa scadenza.
    const stesso = (salvato, giusto) => (salvato == null || salvato === '' ? null : salvato) === giusto;
    const stessoGiorno = (salvato, giusto) => (salvato ? String(salvato).slice(0, 10) : null) === (giusto ? giusto.slice(0, 10) : null);
    const daAggiornare = [];
    let terminatiSenzaMisura = 0;
    for (const r of records) {
      const campi = campiTempiRaccolta(r);
      if (eTerminato(r) && campi.nr_giorni == null) terminatiSenzaMisura++;
      const salvatoGiorni = r.nr_giorni == null || r.nr_giorni === '' ? null : Number(r.nr_giorni);
      if (salvatoGiorni === campi.nr_giorni && stesso(r.raccolta_nei_tempi, campi.raccolta_nei_tempi) && stessoGiorno(r.scadenza_ordine, campi.scadenza_ordine)) continue;
      daAggiornare.push({ id: r.id, ...campi });
    }

    let aggiornati = 0;
    const errori = [];
    for (let i = 0; i < daAggiornare.length; i += BLOCCO) {
      const blocco = daAggiornare.slice(i, i + BLOCCO);
      try {
        await base44.asServiceRole.entities.PrimariaRete.bulkUpdate(blocco);
        aggiornati += blocco.length;
      } catch (e) {
        errori.push(`record ${i + 1}-${i + blocco.length}: ${e && e.message ? e.message : String(e)}`);
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const esito = {
      record_letti: records.length,
      da_aggiornare: daAggiornare.length,
      aggiornati,
      // i ritiri fatti che restano senza tempi: da correggere a portale, non qui
      terminati_senza_misura: terminatiSenzaMisura,
    };
    if (errori.length) {
      return Response.json({ ...esito, error: `${errori.length} blocchi non scritti: ${errori.slice(0, 3).join('; ')}` }, { status: 500 });
    }
    return Response.json(esito);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
