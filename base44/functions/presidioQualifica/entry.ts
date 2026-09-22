import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { analizzaDocumento, daAnalizzare, vociApprovate } from "../../shared/analisiDocumento.ts";
import { individuaSoggetti, oggiRoma } from "../../shared/qualificaFornitori.ts";

// Presidio dei documenti di qualifica: ogni giorno recupera quelli rimasti
// indietro e li fa leggere all'agente.
//
// Serve perche' il controllo giornaliero ricalcola date e stati ma non legge i
// file: un documento caricato quando il browser si e' chiuso a meta', o la cui
// analisi e' fallita, resterebbe li' per sempre e il quadro sembrerebbe a posto.
// E' successo davvero: novantasette documenti risultavano "analizzati" senza che
// nessuno li avesse mai letti.
//
// Non rilegge tutto ogni volta, che costerebbe crediti per niente: prende al
// massimo "massimo" documenti per giro, nell'ordine in cui conviene guardarli -
// mai letti, letture fallite, letture interrotte, documenti senza scadenza,
// letture piu' vecchie di sei mesi.
//
// Payload: { massimo?: 5, anno?, solo_elenco?: false }

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();

    const body = await req.json().catch(() => ({}));
    const massimo = Math.max(1, Math.min(25, Number(body.massimo) || 5));
    const soloElenco = body.solo_elenco === true;
    const anno = Number(body.anno) || Number(oggiRoma().slice(0, 4));
    const svc = base44.asServiceRole.entities;

    const [documenti, tipi] = await Promise.all([
      fetchAll(svc.DocumentoQualifica, { stato: 'attivo' }),
      fetchAll(svc.TipoDocumentoQualifica),
    ]);

    const adessoMs = Date.now();
    const tutti = daAnalizzare(documenti, tipi, { adessoMs, massimo: 0 });
    const coda = tutti.slice(0, massimo);

    if (soloElenco) {
      return Response.json({ da_analizzare: tutti.length, per_motivo: conteggio(tutti), elenco: coda });
    }
    if (coda.length === 0) {
      return Response.json({ da_analizzare: 0, analizzati: 0, per_motivo: {}, esiti: [] });
    }

    // Il contesto del soggetto (ragione sociale, partita IVA) serve al controllo
    // dell'intestatario: si prende una volta sola per tutto il giro.
    let contesti = new Map();
    try {
      const { soggetti } = await individuaSoggetti(base44, anno);
      contesti = new Map(soggetti.map(s => [s.chiave, { nome: s.nome, piva: s.piva, codice_fiscale: s.codice_fiscale }]));
    } catch (_e) { /* senza contesto si usa il nome scritto sul documento */ }

    const approvate = await vociApprovate(base44);
    const perId = new Map(documenti.map(d => [d.id, d]));
    const perTipo = new Map(tipi.map(t => [t.id, t]));
    const esiti = [];

    for (const scelto of coda) {
      const doc = perId.get(scelto.id);
      const tipo = doc ? perTipo.get(doc.tipo_documento_id) : null;
      if (!doc || !tipo) continue;
      try {
        await svc.DocumentoQualifica.update(doc.id, {
          analisi_stato: 'in_corso', analisi_avviata_il: new Date().toISOString(), errore_analisi: '',
        });
        const esito = await analizzaDocumento(base44, {
          doc, tipo, contesto: contesti.get(doc.soggetto_chiave), conoscenza: approvate,
        });
        esiti.push({ soggetto: doc.soggetto_nome, documento: doc.tipo_documento_nome, motivo: scelto.motivo, ...esito });
      } catch (error) {
        const messaggio = error && error.message ? error.message : String(error);
        try { await svc.DocumentoQualifica.update(doc.id, { analisi_stato: 'errore', errore_analisi: messaggio }); } catch (_e) { /* si prosegue col prossimo */ }
        esiti.push({ soggetto: doc.soggetto_nome, documento: doc.tipo_documento_nome, motivo: scelto.motivo, errore: messaggio });
      }
    }

    return Response.json({
      da_analizzare: tutti.length,
      analizzati: esiti.filter(e => !e.errore).length,
      falliti: esiti.filter(e => e.errore).length,
      restano: Math.max(0, tutti.length - esiti.length),
      per_motivo: conteggio(tutti),
      conferme_tolte: esiti.filter(e => e.conferma_tolta).length,
      esiti,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}

function conteggio(elenco) {
  const c = {};
  for (const x of elenco) c[x.motivo] = (c[x.motivo] || 0) + 1;
  return c;
}
