import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { fetchAll } from '../../shared/fetchAll.ts';
import { rispostaSolaLettura } from "../../shared/permessi.ts";

// Gestisce le operazioni di scrittura su entità anagrafiche (Tariffa, Fornitore, FornitoreSecondaria, Servizio).
// Solo l'amministratore può eseguire creazione/modifica/cancellazione.
// Per Tariffa (create/update) applica validazione server-side:
//   - campi obbligatori, chiave di unicità, sovrapposizione periodi, auto-chiusura rinegoziazione.
// Payload: { entita, operazione, id?, dati? }
function norm(v) {
  return String(v || '').trim().toUpperCase();
}

// Due tipologie sono in conflitto se uguali, o una è TUTTE e l'altra RETE/ACI
function tipologiaMatch(t1, t2) {
  const a = norm(t1);
  const b = norm(t2);
  if (a === b) return true;
  if (a === 'TUTTE' && (b === 'RETE' || b === 'ACI')) return true;
  if (b === 'TUTTE' && (a === 'RETE' || a === 'ACI')) return true;
  return false;
}

// Due chiavi tariffa coincidono (tutti i campi testuali + tipologia con TUTTE)
function chiaveMatch(t1, t2) {
  const campi = ['fornitore_id', 'direzione', 'prestazione', 'classe_materiale', 'provincia', 'regione', 'destinazione', 'produttore', 'destinatario'];
  for (const c of campi) {
    if (norm(t1[c]) !== norm(t2[c])) return false;
  }
  return tipologiaMatch(t1.tipologia, t2.tipologia);
}

// Chiave per tariffe attive: cliente, tipologia, classe_materiale, regione, eer_codice
function chiaveMatchAttiva(t1, t2) {
  const campi = ['cliente', 'tipologia', 'classe_materiale', 'regione', 'eer_codice', 'servizio_ecotyre'];
  for (const c of campi) {
    if (norm(t1[c]) !== norm(t2[c])) return false;
  }
  return true;
}

// Due periodi si sovrappongono (fine assente = periodo aperto = infinito)
function periodiSovrapposti(inizio1, fine1, inizio2, fine2) {
  const i1 = inizio1 ? new Date(inizio1).getTime() : 0;
  const f1 = fine1 ? new Date(fine1).getTime() : Infinity;
  const i2 = inizio2 ? new Date(inizio2).getTime() : 0;
  const f2 = fine2 ? new Date(fine2).getTime() : Infinity;
  return i1 <= f2 && i2 <= f1;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
    const { entita, operazione, id, dati } = await req.json();

    const ENTITA_AMMESSE = ['Tariffa', 'Fornitore', 'FornitoreSecondaria', 'Servizio'];
    const OPERAZIONI_AMMESSE = ['create', 'update', 'delete'];

    if (!ENTITA_AMMESSE.includes(entita)) {
      return Response.json({ error: 'Entità non ammessa. Valori validi: ' + ENTITA_AMMESSE.join(', ') }, { status: 400 });
    }
    if (!OPERAZIONI_AMMESSE.includes(operazione)) {
      return Response.json({ error: 'Operazione non ammessa. Valori validi: ' + OPERAZIONI_AMMESSE.join(', ') }, { status: 400 });
    }
    if ((operazione === 'update' || operazione === 'delete') && !id) {
      return Response.json({ error: 'ID obbligatorio per update e delete' }, { status: 400 });
    }

    // === VALIDAZIONE TARIFFA (create e update) ===
    let tariffeChiuse = [];
    if (entita === 'Tariffa' && (operazione === 'create' || operazione === 'update')) {
      let effettivi = dati || {};

      // Per update, fondi il record esistente con i nuovi dati
      if (operazione === 'update') {
        const esistente = await base44.asServiceRole.entities.Tariffa.get(id);
        effettivi = { ...esistente, ...dati };
      }

      // a) Campi obbligatori (valore zero ammesso) - distinti per direzione
      const isAttiva = norm(effettivi.direzione) === 'ATTIVA';
      const campiObbligatori = isAttiva
        ? ['cliente', 'direzione', 'tipologia', 'unita_misura', 'valore']
        : ['fornitore_id', 'direzione', 'tipologia', 'prestazione', 'unita_misura', 'valore'];
      const mancanti = campiObbligatori.filter(c => {
        const v = effettivi[c];
        if (c === 'valore') return v === undefined || v === null;
        return v === undefined || v === null || String(v).trim() === '';
      });
      if (mancanti.length > 0) {
        return Response.json({ error: 'Campi obbligatori mancanti', mancanti }, { status: 400 });
      }

      // ATTIVA non ammette prestazione
      if (isAttiva && effettivi.prestazione && String(effettivi.prestazione).trim() !== '') {
        return Response.json({ error: 'Il campo prestazione non si applica alla fatturazione attiva.' }, { status: 400 });
      }

      // servizio_ecotyre si applica solo alla fatturazione attiva
      if (!isAttiva && effettivi.servizio_ecotyre && String(effettivi.servizio_ecotyre).trim() !== '') {
        return Response.json({ error: 'Il campo servizio_ecotyre si applica solo alla fatturazione attiva.' }, { status: 400 });
      }

      // Il prezzo unico che comprende il trattamento riguarda solo la raccolta
      // passiva: altrove non avrebbe significato.
      if (effettivi.comprensiva_trattamento === true && (isAttiva || norm(effettivi.prestazione) !== 'RACCOLTA')) {
        return Response.json({ error: 'Il prezzo unico comprensivo del trattamento si applica solo alle tariffe passive di raccolta.' }, { status: 400 });
      }

      // f) Data fine precedente a data inizio
      const inizio = effettivi.data_inizio_validita;
      const fine = effettivi.data_fine_validita;
      if (inizio && fine && new Date(fine) < new Date(inizio)) {
        return Response.json({ error: 'La data di fine validità precede la data di inizio' }, { status: 400 });
      }

      // TUTTE ammessa solo per TRASPORTO_SECONDARIA
      if (norm(effettivi.tipologia) === 'TUTTE' && norm(effettivi.prestazione) !== 'TRASPORTO_SECONDARIA') {
        return Response.json({ error: 'La tipologia TUTTE è ammessa solo per il trasporto delle secondarie.' }, { status: 400 });
      }

      // b-e) Verifica conflitti (chiave distinta per direzione)
      const esistenti = isAttiva
        ? await fetchAll(base44.asServiceRole.entities.Tariffa, { direzione: 'ATTIVA' })
        : await fetchAll(base44.asServiceRole.entities.Tariffa, { fornitore_id: effettivi.fornitore_id });
      const conflitti = [];
      const chiudibili = [];
      for (const t of esistenti) {
        if (operazione === 'update' && t.id === id) continue;
        if (norm(t.stato) !== 'ATTIVO') continue;
        const chiaveOk = isAttiva ? chiaveMatchAttiva(effettivi, t) : chiaveMatch(effettivi, t);
        if (!chiaveOk) continue;
        if (!periodiSovrapposti(inizio, fine, t.data_inizio_validita, t.data_fine_validita)) continue;
        // Caso d: chiudibile se senza data fine, nuova inizio > esistente inizio
        const tFine = t.data_fine_validita;
        const tInizio = t.data_inizio_validita;
        if (!tFine && inizio && new Date(inizio) > new Date(tInizio || 0)) {
          chiudibili.push(t);
        } else {
          conflitti.push(t);
        }
      }

      if (conflitti.length > 0) {
        const c = conflitti[0];
        const periodo = `${c.data_inizio_validita || 'n.d.'} → ${c.data_fine_validita || 'aperto'}`;
        const desc = isAttiva
          ? `cliente: ${c.cliente}, tipologia: ${c.tipologia}, regione: ${c.regione || 'tutte'}`
          : `${c.fornitore_nome} (prestazione: ${c.prestazione})`;
        return Response.json({
          error: `Conflitto con tariffa esistente per ${desc}, periodo: ${periodo}. Modifica la chiave o le date di validità.`,
          conflitto: { id: c.id, fornitore_nome: c.fornitore_nome, prestazione: c.prestazione, cliente: c.cliente, tipologia: c.tipologia, regione: c.regione, periodo }
        }, { status: 409 });
      }

      // d) Chiudi le tariffe chiudibili (rinegoziazione prezzo)
      for (const t of chiudibili) {
        const fineChiusura = new Date(inizio);
        fineChiusura.setDate(fineChiusura.getDate() - 1);
        await base44.asServiceRole.entities.Tariffa.update(t.id, {
          data_fine_validita: fineChiusura.toISOString().slice(0, 10),
          stato: 'non_attivo',
        });
        tariffeChiuse.push({ id: t.id, fornitore_nome: t.fornitore_nome });
      }
    }

    let result;
    if (operazione === 'create') {
      result = await base44.asServiceRole.entities[entita].create(dati || {});
    } else if (operazione === 'update') {
      result = await base44.asServiceRole.entities[entita].update(id, dati || {});
    } else if (operazione === 'delete') {
      await base44.asServiceRole.entities[entita].delete(id);
      result = { id, deleted: true };
    }

    const response = { result };
    if (tariffeChiuse.length > 0) {
      response.tariffe_chiuse = tariffeChiuse;
    }
    return Response.json(response);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}