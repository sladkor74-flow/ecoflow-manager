import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  BASE_CONOSCENZA, FONTI_UFFICIALI, VERIFICATO_IL, REGOLE_FONTI, testoConoscenza, vociApprovate,
  proponiNovita, proponiPrecisazioni, scartaSuperate,
} from "../../shared/baseConoscenza.ts";
import { analizzaDomanda, situazioneGestionale } from "../../shared/assistente.ts";
import { materialePertinente } from "../../shared/materialeCorso.ts";
import { oggiRoma } from "../../shared/qualificaFornitori.ts";

// Assistente del gestionale: risponde a dubbi normativi, a domande sui dati della
// commessa e spiega i quiz dell'esame da responsabile tecnico.
//
// Ogni risposta si appoggia alla base di conoscenza verificata (voci del codice
// piu' quelle approvate nel gestionale), cita le fonti e, per le domande sulle
// norme, controlla online che non ci siano novita'. Le novita' trovate diventano
// proposte da approvare, mai modifiche automatiche.
//
// Payload: { domanda, conversazione_id?, contesto?: { tipo: 'quiz', banca, domanda, risposte, esatta, scelta } }

const SCHEMA_RISPOSTA = {
  type: 'object',
  properties: {
    risposta: { type: 'string' },
    fonti: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titolo: { type: 'string' },
          riferimento: { type: 'string' },
          url: { type: 'string' },
          verificato_il: { type: 'string' },
        },
      },
    },
    certezza: { type: 'string', enum: ['alta', 'media', 'bassa'] },
    novita_normative: {
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
    precisazioni_utente: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['faq', 'regola_interna'] },
          area: { type: 'string', enum: ['pfu', 'tua', 'albo', 'rentri', 'documenti', 'gestionale'] },
          titolo: { type: 'string' },
          testo: { type: 'string' },
        },
      },
    },
  },
  required: ['risposta'],
};

const comeOggetto = (v) => {
  if (v && typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch { return { risposta: String(v || '') }; }
};
const taglia = (s, n) => { const t = String(s || ''); return t.length > n ? t.slice(0, n) + '…' : t; };

export default async function(req) {
  let base44 = null;
  let recordId = null;
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const domanda = String(body.domanda || '').trim();
    if (!domanda) return Response.json({ error: 'Scrivi una domanda' }, { status: 400 });
    if (domanda.length > 4000) return Response.json({ error: 'La domanda e\' troppo lunga: massimo 4.000 caratteri' }, { status: 400 });
    const contesto = body.contesto && typeof body.contesto === 'object' ? body.contesto : null;
    const quiz = contesto && contesto.tipo === 'quiz' ? contesto : null;

    const svc = base44.asServiceRole.entities;
    const conversazioneId = String(body.conversazione_id || '') || crypto.randomUUID();
    const precedenti = body.conversazione_id
      ? await svc.DomandaAssistente.filter({ conversazione_id: conversazioneId }, 'created_date', 50).catch(() => [])
      : [];

    const analisi = quiz ? { dati: false, norma: true, ambito: 'esercitazione' } : analizzaDomanda(domanda);
    const record = await svc.DomandaAssistente.create({
      conversazione_id: conversazioneId,
      titolo_conversazione: precedenti[0]?.titolo_conversazione || taglia(quiz ? 'Quiz: ' + quiz.domanda : domanda, 90),
      domanda,
      ambito: analisi.ambito,
      dati_gestionale: analisi.dati,
      ricerca_online: analisi.norma,
      contesto_json: contesto ? JSON.stringify(contesto) : '',
      stato: 'in_corso',
      valutazione: 'nessuna',
    });
    recordId = record.id;

    const oggi = oggiRoma();
    const [approvate, dati, corso] = await Promise.all([
      vociApprovate(base44),
      analisi.dati ? situazioneGestionale(base44, oggi).catch(e => `Dati del gestionale non disponibili: ${e.message || e}`) : Promise.resolve(''),
      // Schede del corso RT pertinenti: solo per le domande sulle norme e per i quiz.
      analisi.norma ? materialePertinente(base44, quiz ? `${quiz.domanda} ${(quiz.risposte || []).join(' ')}` : domanda).catch(() => ({ testo: '', fonti: [] })) : Promise.resolve({ testo: '', fonti: [] }),
    ]);

    const storia = precedenti
      .filter(p => p.stato === 'completata')
      .slice(-6)
      .map(p => `Domanda: ${taglia(p.domanda, 800)}\nRisposta: ${taglia(p.risposta, 1500)}`)
      .join('\n\n');

    const prompt = [
      'Sei EcoTyna, l\'assistente del gestionale di SMOCO Srl, azienda che raccoglie e trasporta pneumatici fuori uso (PFU, codice EER 16 01 03, rifiuti speciali non pericolosi) per il sistema collettivo Ecotyre nel Sud Italia.',
      'Conosci il lavoro di SMOCO: ritiri dai punti di raccolta della rete (soprattutto gommisti, spesso con meno di dieci dipendenti), ritiri dai demolitori del circuito ACI, conferimenti a stoccaggi e impianti incaricati, formulari cartacei e digitali, omologhe annuali e dichiarazioni RENTRI dei produttori, qualifica documentale dei fornitori, target e fatturazione verso Ecotyre.',
      'Aiuti la direzione con i dubbi sulle norme (D.Lgs. 152/2006, DM 182/2019 sui PFU, RENTRI e DM 59/2023, Albo nazionale gestori ambientali e responsabile tecnico), con le domande sui dati della commessa e con la preparazione all\'esame di responsabile tecnico gestione rifiuti. Rispondi come una consulente esperta del settore: applica la regola al caso concreto di SMOCO e distingui i soggetti (produttore, trasportatore, stoccaggio, impianto, intermediario) quando la risposta cambia.',
      '',
      `Data di oggi: ${oggi}. Utente: ${user.full_name || user.email || ''}.`,
      '',
      REGOLE_FONTI,
      '',
      'REGOLE',
      `1. Parti dalla base di conoscenza qui sotto, verificata alla data indicata voce per voce. Per le domande sulle norme controlla online sulle fonti ufficiali (${FONTI_UFFICIALI.join('; ')}) se ci sono novita' successive alla data della voce: se ne trovi una certa, applicala, dillo chiaramente nella risposta e riportala in novita_normative con voce_id della voce da aggiornare (vuoto se serve una voce nuova), data_norma (AAAA-MM-GG), fonte e testo_proposto, che deve essere il testo COMPLETO della voce aggiornata, conservando tutto cio' che resta valido. In novita_normative vanno solo norme nuove: mai riassunti, consigli, lettere o norme gia' citate nella voce.`,
      '2. Ogni affermazione normativa deve avere una fonte precisa in fonti (norma e articolo, delibera, FAQ o sentenza) con la data di verifica. Non inventare numeri di articolo, date, importi o scadenze: se non sei sicuro dillo e spiega come verificarlo.',
      '3. Per le domande sui dati usa solo i DATI DEL GESTIONALE forniti. Se un dato manca dillo e indica in quale sezione del gestionale trovarlo (Target & Status, Assegnati, Verifiche, Giacenze, Omologhe, Dichiarazioni RENTRI, Qualifica Fornitori, Fatturazione). Non inventare numeri.',
      '3-bis. Se nella domanda o nella conversazione l\'utente corregge una tua risposta o afferma una regola ("non e\' cosi\'", "da noi si fa cosi\'", "il decreto dice che..."), tienine conto subito nella risposta e riportala in precisazioni_utente: tipo regola_interna se e\' una regola dell\'azienda, faq se chiarisce come si applica una norma; testo chiaro e autosufficiente. Diventera\' una proposta da approvare. Se contrasta con una norma verificata, spiegalo con garbo citando la fonte.',
      '4. Le voci dell\'area gestionale sono regole della direzione SMOCO: applicale. Distingui sempre gli obblighi di legge dalle regole interne e dalla prassi.',
      '5. Scrivi in italiano semplice e pratico, in markdown. Prima la risposta in una o due frasi, poi i dettagli utili; elenchi solo se aiutano; niente formule di cortesia ne\' ripetizioni della domanda.',
      '6. certezza: alta se la risposta poggia su norme verificate o su dati presenti; media se richiede interpretazione; bassa se mancano elementi, e in quel caso consiglia di confermare con il consulente ambientale o con l\'ente competente.',
      '7. Per decisioni con conseguenze legali importanti ricorda di verificare il testo vigente su Normattiva.',
      '8. Le schede del CORSO RT sono materiale didattico di qualche anno fa: usale per spiegare concetti e contesto, ma prevalgono sempre la base di conoscenza verificata e le norme vigenti. Se una scheda contrasta con la norma attuale segui la norma attuale e fai notare la differenza; se la usi citala in fonti come "Corso RT" con modulo e anno del materiale.',
      ...(quiz ? [
        '',
        'ESERCITAZIONE',
        'L\'utente si sta preparando all\'esame di responsabile tecnico e chiede la spiegazione di un quiz della banca dati ufficiale dell\'Albo (pubblicata il 19/12/2025).',
        `Quiz: ${quiz.domanda}`,
        `Risposte proposte: ${(Array.isArray(quiz.risposte) ? quiz.risposte : []).map((r, i) => `${String.fromCharCode(65 + i)}) ${r}`).join(' ')}`,
        `Risposta esatta secondo la banca dati ufficiale: ${quiz.esatta}`,
        quiz.scelta ? `L'utente aveva scelto: ${quiz.scelta}` : 'L\'utente non ha risposto.',
        'Spiega perche\' la risposta esatta e\' corretta e perche\' le altre sono sbagliate, con i riferimenti normativi, e dai un modo semplice per ricordarla. Se la norma e\' cambiata dopo la pubblicazione dei quiz, segnalalo, ricordando che all\'esame vale la risposta della banca dati.',
      ] : []),
      '',
      'BASE DI CONOSCENZA',
      `Voci del codice (id: titolo): ${BASE_CONOSCENZA.map(v => `${v.id}: ${v.titolo}`).join('; ')}.`,
      testoConoscenza(approvate),
      ...(corso.testo ? ['', 'CORSO RT (schede di studio dal materiale del corso per responsabile tecnico)', corso.testo] : []),
      ...(storia ? ['', 'CONVERSAZIONE PRECEDENTE', storia] : []),
      ...(dati ? ['', dati] : []),
      '',
      'DOMANDA',
      domanda,
    ].join('\n');

    const esito = comeOggetto(await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: analisi.norma,
      response_json_schema: SCHEMA_RISPOSTA,
    }));

    const fonti = (Array.isArray(esito.fonti) ? esito.fonti : [])
      .filter(f => f && (f.titolo || f.riferimento || f.url))
      .slice(0, 12)
      .map(f => ({ titolo: taglia(f.titolo, 200), riferimento: taglia(f.riferimento, 300), url: /^https?:\/\//.test(String(f.url || '')) ? String(f.url) : '', verificato_il: taglia(f.verificato_il || VERIFICATO_IL, 20) }));
    const certezza = ['alta', 'media', 'bassa'].includes(esito.certezza) ? esito.certezza : 'media';

    const aggiornato = await svc.DomandaAssistente.update(recordId, {
      risposta: String(esito.risposta || 'Non sono riuscito a formulare una risposta: riprova riformulando la domanda.'),
      fonti_json: JSON.stringify(fonti),
      certezza,
      stato: 'completata',
      errore: '',
    });

    // Novita' normative e precisazioni dell'utente: proposte da approvare nella base
    // di conoscenza. Le novita' passano un filtro (norma nuova, data, testo completo)
    // e una proposta nuova sulla stessa voce prende il posto di quella in attesa.
    let proposte = 0;
    try {
      const novita = await proponiNovita(base44, (esito.novita_normative || []).slice(0, 3), { oggi, origine: 'domanda', approvate, collegamenti: { domanda_id: recordId } });
      const precisazioni = await proponiPrecisazioni(base44, esito.precisazioni_utente, { oggi, utente: user.full_name || user.email, domandaId: recordId });
      proposte = novita.length + precisazioni.length;
      if (proposte) await scartaSuperate(base44);
    } catch (_e) { /* la risposta resta valida anche se la proposta non si salva */ }

    return Response.json({ ok: true, record: aggiornato || { ...record, risposta: esito.risposta, fonti_json: JSON.stringify(fonti), certezza, stato: 'completata' }, proposte });
  } catch (error) {
    const messaggio = error && error.message ? error.message : String(error);
    if (base44 && recordId) {
      try { await base44.asServiceRole.entities.DomandaAssistente.update(recordId, { stato: 'errore', errore: messaggio }); } catch (_e) { /* resta il messaggio principale */ }
    }
    return Response.json({ error: messaggio, record_id: recordId }, { status: 500 });
  }
}
