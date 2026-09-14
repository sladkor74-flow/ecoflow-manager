import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { oggiRoma } from "../../shared/qualificaFornitori.ts";

// Elaborazione in background del materiale del corso RT: a ogni giro poche parti
// diventano schede di studio per l'Assistente. Gira ogni ora dal workflow
// pianificato, cosi' il lavoro e il consumo sono distribuiti nel tempo.
//
// Payload: { quante?: number } (massimo 5 per giro; di norma 3).
// Dopo l'elaborazione nel gestionale resta solo la scheda, non il testo originale.

const SCHEMA = {
  type: 'object',
  properties: {
    sintesi: { type: 'string' },
    concetti: { type: 'array', items: { type: 'string' } },
    riferimenti: { type: 'array', items: { type: 'object', properties: { norma: { type: 'string' }, articolo: { type: 'string' }, tema: { type: 'string' } } } },
    da_verificare: { type: 'array', items: { type: 'string' } },
    domande: { type: 'array', items: { type: 'object', properties: { domanda: { type: 'string' }, risposta: { type: 'string' } } } },
    parole_chiave: { type: 'array', items: { type: 'string' } },
  },
};

const comeOggetto = (v) => {
  if (v && typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch { return {}; }
};
const testi = (v, max, lung) => (Array.isArray(v) ? v : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, max).map(x => x.slice(0, lung));

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const quante = Math.min(5, Math.max(1, Number(body.quante) || 3));
    const ent = base44.asServiceRole.entities.MaterialeCorso;
    const oggi = oggiRoma();

    const daFare = await ent.filter({ stato: 'da_elaborare' }, 'ordine', quante);
    const esiti = [];
    for (const p of daFare) {
      try {
        const prompt = [
          'Stai studiando il materiale di un corso di preparazione all\'esame di responsabile tecnico gestione rifiuti (Albo nazionale gestori ambientali).',
          `Oggi e' il ${oggi}. Il materiale e' ${p.anno_materiale ? `del ${p.anno_materiale}` : 'di alcuni anni fa'}: alcune norme citate potrebbero essere state modificate o abrogate (per esempio SISTRI, registri e formulari cartacei sostituiti dal RENTRI, requisiti dell'Albo aggiornati dalle delibere successive).`,
          `Corso: ${p.categoria}. Modulo: ${p.modulo}. Parte ${p.parte} di ${p.parti_totali || '?'} (${p.tipo === 'videolezione' ? 'trascrizione automatica di una videolezione, con possibili errori di trascrizione' : 'dispensa'}).`,
          '',
          'Prepara una scheda di studio in italiano basata solo sul testo qui sotto:',
          '- sintesi: 5-10 frasi chiare con i contenuti essenziali;',
          '- concetti: fino a 8 concetti chiave, obblighi o adempimenti, uno per voce;',
          '- riferimenti: le norme citate nel testo (norma, articolo, tema); non aggiungere norme che il testo non cita;',
          '- da_verificare: i punti che per la data del materiale potrebbero non essere piu\' in vigore, spiegando brevemente perche\'; lista vuota se non ce ne sono;',
          '- domande: fino a 3 domande di ripasso in stile esame con la risposta;',
          '- parole_chiave: 10-20 parole o sigle utili a ritrovare la scheda (es. formulario, FIR, deposito temporaneo, categoria 4, ADR).',
          'Se il testo e\' solo un indice, un frontespizio o non ha contenuti utili, scrivilo nella sintesi e lascia vuoti gli altri campi.',
          '',
          'TESTO',
          p.testo,
        ].join('\n');
        const esito = comeOggetto(await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: SCHEMA }));
        const riferimenti = (Array.isArray(esito.riferimenti) ? esito.riferimenti : [])
          .filter(r => r && r.norma)
          .slice(0, 15)
          .map(r => ({ norma: String(r.norma).slice(0, 160), articolo: String(r.articolo || '').slice(0, 80), tema: String(r.tema || '').slice(0, 160) }));
        const domande = (Array.isArray(esito.domande) ? esito.domande : [])
          .filter(d => d && d.domanda && d.risposta)
          .slice(0, 3)
          .map(d => ({ domanda: String(d.domanda).slice(0, 400), risposta: String(d.risposta).slice(0, 800) }));
        await ent.update(p.id, {
          stato: 'elaborato',
          sintesi: String(esito.sintesi || '').slice(0, 3000),
          concetti_json: JSON.stringify(testi(esito.concetti, 8, 300)),
          riferimenti_json: JSON.stringify(riferimenti),
          da_verificare_json: JSON.stringify(testi(esito.da_verificare, 8, 400)),
          domande_json: JSON.stringify(domande),
          parole_chiave: testi(esito.parole_chiave, 20, 60).join(', '),
          elaborato_il: new Date().toISOString(),
          tentativi: (p.tentativi || 0) + 1,
          errore: '',
          // Il testo serve solo per preparare la scheda: poi si toglie per non occupare
          // spazio. L'originale resta sul PC e la chiave impedisce di ricaricarlo due volte.
          testo: '',
        });
        esiti.push({ chiave: p.chiave, esito: 'elaborato' });
      } catch (e) {
        const tentativi = (p.tentativi || 0) + 1;
        const messaggio = e && e.message ? e.message : String(e);
        // Dopo tre tentativi la parte resta in errore e non blocca le successive.
        await ent.update(p.id, { tentativi, errore: messaggio.slice(0, 500), stato: tentativi >= 3 ? 'errore' : 'da_elaborare', ordine: (p.ordine || 0) + 1000 }).catch(() => {});
        esiti.push({ chiave: p.chiave, esito: 'errore', errore: messaggio });
      }
    }
    return Response.json({ elaborate: esiti.filter(x => x.esito === 'elaborato').length, esiti });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
