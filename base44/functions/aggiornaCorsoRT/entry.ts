import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { oggiRoma } from "../../shared/qualificaFornitori.ts";
import { vociApprovate } from "../../shared/baseConoscenza.ts";
import {
  areeDelTesto, testoDellaScheda, ultimeModifichePerArea, daRicontrollare,
  conoscenzaPerAree, istruzioniAggiornamento, aggiornamentiPuliti, storicoConNoteSuperate, SCHEMA_AGGIORNAMENTI,
} from "../../shared/aggiornamentoCorso.ts";

// Tiene aggiornato il corso RT alle norme vigenti, senza che nessuno debba
// ricordarselo.
//
// Gira ogni ora dal workflow pianificato e ricontrolla poche schede per volta:
// quelle mai confrontate con la base di conoscenza verificata e quelle di un'area
// in cui la base di conoscenza e' cambiata dopo l'ultimo controllo (per esempio
// perche' e' stato approvato un aggiornamento trovato dal controllo mensile). Quando
// non c'e' nulla da ricontrollare non chiama il modello e non consuma nulla.
//
// Payload: { quante?: number } (massimo 5; di norma 2)

const comeOggetto = (v) => {
  if (v && typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch { return {}; }
};
const elenco = (v) => { try { const x = JSON.parse(v || '[]'); return Array.isArray(x) ? x : []; } catch { return []; } };

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
    const body = await req.json().catch(() => ({}));
    const quante = Math.min(5, Math.max(1, Number(body.quante) || 2));
    const ent = base44.asServiceRole.entities.MaterialeCorso;
    const oggi = oggiRoma();

    const approvate = await vociApprovate(base44);
    const ultime = ultimeModifichePerArea(approvate);

    const campi = ['modulo', 'categoria', 'tipo', 'anno_materiale', 'parte', 'parti_totali', 'ordine', 'sintesi', 'concetti_json',
      'riferimenti_json', 'da_verificare_json', 'parole_chiave', 'aree', 'aggiornata_il', 'aggiornamenti_json', 'storico_aggiornamenti_json'];
    const schede = [];
    for (let skip = 0; skip < 20000; skip += 1000) {
      const pagina = await ent.filter({ stato: 'elaborato' }, 'id', 1000, skip, campi);
      schede.push(...pagina);
      if (pagina.length < 1000) break;
    }

    // Prima le schede che gia' segnalavano punti forse superati, poi le altre.
    const candidate = schede
      .map(s => ({ s, aree: Array.isArray(s.aree) && s.aree.length ? s.aree : areeDelTesto(testoDellaScheda(s)) }))
      .filter(({ s, aree }) => daRicontrollare(s, aree, ultime))
      .sort((a, b) => (elenco(b.s.da_verificare_json).length > 0) - (elenco(a.s.da_verificare_json).length > 0) || (a.s.ordine || 0) - (b.s.ordine || 0));

    const esiti = [];
    for (const { s, aree } of candidate.slice(0, quante)) {
      try {
        const conoscenza = conoscenzaPerAree(approvate, aree);
        const prompt = [
          "Stai tenendo aggiornato il materiale di un corso per responsabile tecnico gestione rifiuti (Albo nazionale gestori ambientali).",
          `Scheda: ${s.categoria} — ${s.modulo}, parte ${s.parte} di ${s.parti_totali || '?'} (${s.tipo === 'videolezione' ? 'videolezione' : 'dispensa'}${s.anno_materiale ? ` del ${s.anno_materiale}` : ''}).`,
          '',
          istruzioniAggiornamento(oggi, conoscenza),
          '',
          'MATERIALE DEL CORSO',
          `Sintesi: ${s.sintesi || ''}`,
          `Concetti: ${elenco(s.concetti_json).join('; ')}`,
          `Norme citate: ${elenco(s.riferimenti_json).map(r => [r.norma, r.articolo, r.tema].filter(Boolean).join(' ')).join('; ')}`,
          `Punti gia' segnalati come forse superati: ${elenco(s.da_verificare_json).join('; ') || 'nessuno'}`,
        ].join('\n');
        const esito = comeOggetto(await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: SCHEMA_AGGIORNAMENTI }));
        const aggiornamenti = aggiornamentiPuliti(esito, oggi, conoscenza);
        await ent.update(s.id, {
          aree,
          aggiornamenti_json: JSON.stringify(aggiornamenti),
          storico_aggiornamenti_json: storicoConNoteSuperate(s.storico_aggiornamenti_json, s.aggiornamenti_json, aggiornamenti,
            `superate dal controllo del ${oggi} con la base di conoscenza aggiornata`),
          aggiornata_il: new Date().toISOString(),
        });
        esiti.push({ modulo: s.modulo, parte: s.parte, aggiornamenti: aggiornamenti.length });
      } catch (e) {
        // Una scheda che non si riesce a controllare non deve tornare in testa ogni ora
        // e bloccare le altre: si segna la data e si ritenta al prossimo cambiamento
        // della base di conoscenza, tenendo gli aggiornamenti che aveva.
        await ent.update(s.id, { aree, aggiornata_il: new Date().toISOString() }).catch(() => {});
        esiti.push({ modulo: s.modulo, parte: s.parte, errore: e && e.message ? e.message : String(e) });
      }
    }

    return Response.json({
      da_ricontrollare: candidate.length,
      controllate: esiti.filter(e => !e.errore).length,
      con_aggiornamenti: esiti.filter(e => e.aggiornamenti > 0).length,
      ultime_modifiche: ultime,
      esiti,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
