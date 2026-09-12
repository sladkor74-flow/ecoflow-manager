import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { fetchAll } from '../../shared/fetchAll.ts';

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
    if (user.role !== 'admin') return Response.json({ error: "Forbidden: solo l'amministratore può modificare tariffe e anagrafiche" }, { status: 403 });

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

      // a) Campi obbligatori (valore zero ammesso)
      const campiObbligatori = ['fornitore_id', 'direzione', 'tipologia', 'prestazione', 'unita_misura', 'valore'];
      const mancanti = campiObbligatori.filter(c => {
        const v = effettivi[c];
        if (c === 'valore') return v === undefined || v === null;
        return v === undefined || v === null || String(v).trim() === '';
      });
      if (mancanti.length > 0) {
        return Response.json({ error: 'Campi obbligatori mancanti', mancanti }, { status: 400 });
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

      // b-e) Verifica conflitti
      const esistenti = await fetchAll(base44.asServiceRole.entities.Tariffa, { fornitore_id: effettivi.fornitore_id });
      const conflitti = [];
      const chiudibili = [];
      for (const t of esistenti) {
        if (operazione === 'update' && t.id === id) continue;
        if (!chiaveMatch(effettivi, t)) continue;
        if (!periodiSovrapposti(inizio, fine, t.data_inizio_validita, t.data_fine_validita)) continue;
        // Caso d: chiudibile se attivo, senza data fine, nuova inizio > esistente inizio
        const tStato = norm(t.stato);
        const tFine = t.data_fine_validita;
        const tInizio = t.data_inizio_validita;
        if (tStato === 'ATTIVO' && !tFine && inizio && new Date(inizio) > new Date(tInizio || 0)) {
          chiudibili.push(t);
        } else {
          conflitti.push(t);
        }
      }

      if (conflitti.length > 0) {
        const c = conflitti[0];
        const periodo = `${c.data_inizio_validita || 'n.d.'} → ${c.data_fine_validita || 'aperto'}`;
        return Response.json({
          error: `Conflitto con tariffa esistente per ${c.fornitore_nome} (prestazione: ${c.prestazione}, periodo: ${periodo}). Modifica la chiave o le date di validità.`,
          conflitto: { id: c.id, fornitore_nome: c.fornitore_nome, prestazione: c.prestazione, periodo }
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