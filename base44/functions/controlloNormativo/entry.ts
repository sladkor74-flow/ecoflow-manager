import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { AREE_NORMATIVE, BASE_CONOSCENZA, FONTI_UFFICIALI, vociApprovate } from "../../shared/baseConoscenza.ts";
import { oggiRoma } from "../../shared/qualificaFornitori.ts";

// Controllo periodico delle novita' normative sulla base di conoscenza.
//
// Per ogni area normativa chiede al modello di cercare sulle fonti ufficiali
// leggi, decreti, proroghe, FAQ o delibere successive alla verifica di ciascuna
// voce. Le novita' diventano proposte da approvare nell'Assistente: la base di
// conoscenza non cambia mai da sola. Se ci sono proposte, gli amministratori
// ricevono un'email.
//
// Payload: { manuale?: boolean }. Il controllo pianificato gira una volta al mese;
// quello manuale e' riservato agli amministratori.

const NOMI_AREE = {
  pfu: 'PFU e DM 182/2019',
  tua: 'D.Lgs. 152/2006 (registro, formulari, autorizzazioni, sanzioni)',
  albo: 'Albo nazionale gestori ambientali e responsabile tecnico',
  rentri: 'RENTRI e FIR digitale',
  documenti: 'validita\' dei documenti di qualifica dei fornitori',
};

const SCHEMA = {
  type: 'object',
  properties: {
    novita: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          voce_id: { type: 'string' },
          titolo: { type: 'string' },
          descrizione: { type: 'string' },
          testo_proposto: { type: 'string' },
          fonte: { type: 'string' },
          url: { type: 'string' },
          data_norma: { type: 'string' },
        },
      },
    },
    fonti_consultate: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
  },
};

const comeOggetto = (v) => {
  if (v && typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch { return {}; }
};

export default async function(req) {
  let base44 = null;
  let controlloId = null;
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const manuale = body.manuale === true;
    if (manuale && user.role !== 'admin') return Response.json({ error: 'Forbidden: richiesto ruolo admin' }, { status: 403 });

    const svc = base44.asServiceRole.entities;
    const oggi = oggiRoma();

    // Il controllo pianificato non si ripete nello stesso mese.
    if (!manuale) {
      const recenti = await svc.ControlloNormativo.list('-created_date', 5).catch(() => []);
      if (recenti.some(c => String(c.eseguito_il || '').slice(0, 7) === oggi.slice(0, 7) && c.esito !== 'errore')) {
        return Response.json({ ok: true, saltato: 'Controllo del mese gia\' eseguito' });
      }
    }

    const controllo = await svc.ControlloNormativo.create({ eseguito_il: new Date().toISOString(), avviato_da: manuale ? 'manuale' : 'pianificato', esito: 'in_corso', proposte: 0 });
    controlloId = controllo.id;

    const approvate = await vociApprovate(base44);
    const sostituzioni = new Map(approvate.filter(v => v.tipo === 'aggiornamento_normativo' && v.voce_id).map(v => [v.voce_id, v]));
    const inAttesa = await svc.ConoscenzaAssistente.filter({ stato: 'proposta' }, '-created_date', 300).catch(() => []);
    const core = base44.asServiceRole.integrations.Core;

    const dettagli = [];
    let proposte = 0;
    for (const area of AREE_NORMATIVE) {
      const voci = BASE_CONOSCENZA.filter(v => v.area === area).map(v => {
        const s = sostituzioni.get(v.id);
        return { id: v.id, titolo: v.titolo, testo: s ? s.testo : v.testo, verificato_il: s ? (s.verificato_il || v.verificato_il) : v.verificato_il, fonti: v.fonti };
      });
      const extra = approvate.filter(v => v.area === area && !(v.tipo === 'aggiornamento_normativo' && v.voce_id));
      try {
        const esito = comeOggetto(await core.InvokeLLM({
          prompt: [
            `Oggi e' il ${oggi}. Sei un esperto di normativa ambientale italiana sui rifiuti e fai l'aggiornamento periodico della base di conoscenza di un'azienda che raccoglie pneumatici fuori uso (EER 16 01 03) per il sistema collettivo Ecotyre.`,
            `Area: ${NOMI_AREE[area] || area}.`,
            `Cerca sulle fonti ufficiali (${FONTI_UFFICIALI.join('; ')}) e sulle principali riviste di settore se, dopo la data di verifica di ciascuna voce, sono intervenute novita': leggi, decreti, proroghe, conversioni in legge, decreti direttoriali, FAQ, delibere dell'Albo, circolari o sentenze rilevanti. Considera anche le date citate nelle voci che nel frattempo sono passate e hanno cambiato la situazione.`,
            'Riporta solo novita\' certe e documentate con la fonte, non ipotesi o proposte non approvate (queste al massimo nelle note). Per ogni novita\' indica la voce da aggiornare (voce_id, oppure vuoto se serve una voce nuova), una descrizione breve della novita\' e il testo aggiornato completo della voce, nello stesso stile. Se non trovi nulla restituisci un elenco vuoto.',
            '',
            'Voci attuali:',
            ...voci.map(v => `- ${v.id} (verificata il ${v.verificato_il}; fonti: ${v.fonti.join('; ')}): ${v.titolo}. ${v.testo}`),
            ...extra.map(v => `- (voce del gestionale) ${v.titolo}: ${v.testo}`),
          ].join('\n'),
          add_context_from_internet: true,
          response_json_schema: SCHEMA,
        }));
        const novita = (Array.isArray(esito.novita) ? esito.novita : []).filter(n => n && n.descrizione && n.testo_proposto).slice(0, 5);
        const create = [];
        for (const n of novita) {
          const voce = BASE_CONOSCENZA.find(v => v.id === n.voce_id && v.area === area);
          if (voce && inAttesa.some(p => p.voce_id === voce.id)) continue;
          const nuova = await svc.ConoscenzaAssistente.create({
            tipo: 'aggiornamento_normativo',
            stato: 'proposta',
            attiva: true,
            area,
            titolo: String(n.titolo || (voce ? voce.titolo : 'Novita\' normativa')).slice(0, 200),
            testo: String(n.testo_proposto),
            voce_id: voce ? voce.id : '',
            testo_precedente: voce ? (sostituzioni.get(voce.id)?.testo || voce.testo) : '',
            motivazione: String(n.descrizione) + (n.data_norma ? ` (${n.data_norma})` : ''),
            fonti_json: JSON.stringify([n.fonte, n.url].filter(Boolean)),
            verificato_il: oggi,
            origine: 'controllo_mensile',
            controllo_id: controlloId,
          });
          inAttesa.push(nuova);
          create.push(nuova.titolo);
          proposte++;
        }
        dettagli.push({ area, novita: create, fonti_consultate: (esito.fonti_consultate || []).slice(0, 10), note: String(esito.note || '').slice(0, 1000) });
      } catch (e) {
        dettagli.push({ area, errore: e && e.message ? e.message : String(e) });
      }
    }

    const errori = dettagli.filter(d => d.errore).length;
    const sintesi = proposte
      ? `${proposte} aggiornamenti da approvare: ${dettagli.flatMap(d => d.novita || []).join('; ')}`
      : errori === dettagli.length ? 'Il controllo non e\' riuscito su nessuna area.' : `Nessuna novita' trovata${errori ? ` (${errori} aree non controllate per errore)` : ''}.`;
    await svc.ControlloNormativo.update(controlloId, {
      esito: errori === dettagli.length ? 'errore' : proposte ? 'novita' : 'nessuna_novita',
      proposte,
      sintesi,
      dettagli_json: JSON.stringify(dettagli),
    });

    if (proposte > 0) {
      try {
        const utenti = await svc.User.list();
        const destinatari = [...new Set(utenti.filter(u => u.role === 'admin' && u.email).map(u => u.email))];
        const testo = [
          `Il controllo normativo del ${oggi} ha trovato ${proposte} possibili aggiornamenti della base di conoscenza:`,
          '',
          ...dettagli.flatMap(d => (d.novita || []).map(t => `- ${NOMI_AREE[d.area] || d.area}: ${t}`)),
          '',
          'Nessuna modifica e\' stata applicata. Per leggerle e decidere apri il gestionale, sezione Assistente, scheda Base di conoscenza.',
        ].join('\n');
        for (const to of destinatari) {
          await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: `Assistente: ${proposte} aggiornamenti normativi da approvare`, body: testo, from_name: 'Gestionale PFU - Assistente' });
        }
      } catch (_e) { /* l'email e' un promemoria: le proposte restano comunque nel gestionale */ }
    }

    return Response.json({ ok: true, controllo_id: controlloId, proposte, sintesi });
  } catch (error) {
    const messaggio = error && error.message ? error.message : String(error);
    if (base44 && controlloId) {
      try { await base44.asServiceRole.entities.ControlloNormativo.update(controlloId, { esito: 'errore', errore: messaggio }); } catch (_e) { /* resta il messaggio principale */ }
    }
    return Response.json({ error: messaggio }, { status: 500 });
  }
}
