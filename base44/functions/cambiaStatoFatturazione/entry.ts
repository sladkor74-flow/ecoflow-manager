import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { oggiRoma, giornoRoma } from "../../shared/giornoItaliano.ts";

// Cambia lo stato di un documento di fatturazione:
// azione: 'verifica' | 'approva' | 'chiudi' | 'riapri'
// Flusso: elaborata → verificata → approvata → (esportata) → chiusa
//
// Ogni azione parte solo dagli stati da cui ha senso. Prima 'verifica' non
// guardava lo stato di partenza: su un documento chiuso lo riportava a
// "verificata", e da li' il mese si poteva rielaborare senza che restasse
// scritto da nessuna parte. Un periodo chiuso si riapre solo con 'riapri', e
// la riapertura lascia la sua riga nelle note del documento: chi, quando, da
// che stato.
//
// 'chiudi' non e' un passaggio interno: un mese attivo si chiude quando
// l'amministrazione conferma che la fattura al cliente e' stata emessa ed e'
// andata a buon fine. La conferma (giorno, numero se c'e') si scrive sul
// documento: payload { conferma: { data, numero? } }.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
    const { documento_id, azione, conferma } = await req.json();
    if (!documento_id || !azione) return Response.json({ error: 'documento_id e azione obbligatori' }, { status: 400 });

    const doc = await base44.asServiceRole.entities.DocumentoFatturazione.get(documento_id);
    if (!doc) return Response.json({ error: 'Documento non trovato' }, { status: 404 });
    if (doc.superato) return Response.json({ error: 'Il documento è superato: resta nello storico e non cambia più stato.' }, { status: 400 });
    const rifiuta = (attesi) => Response.json({
      error: `Il documento è in stato "${doc.stato}": questa azione vale solo da ${attesi.map(s => `"${s}"`).join(' o ')}.${doc.stato === 'chiusa' ? ' Un periodo chiuso va prima riaperto.' : ''}`,
      stato: doc.stato,
    }, { status: 400 });

    if (azione === 'verifica') {
      if (!['elaborata', 'verificata'].includes(doc.stato)) return rifiuta(['elaborata', 'verificata']);
      const voci = await base44.asServiceRole.entities.VoceFatturazione.filter({ documento_id });
      const errori = voci.filter(v => v.stato_validazione === 'errore').length;
      const newState = errori > 0 ? 'elaborata' : 'verificata';
      await base44.asServiceRole.entities.DocumentoFatturazione.update(documento_id, {
        stato: newState, data_verifica: new Date().toISOString(), voci_errore: errori,
      });
      return Response.json({ stato: newState, errori });
    }

    if (azione === 'approva') {
      if (doc.stato !== 'verificata') return rifiuta(['verificata']);
      await base44.asServiceRole.entities.DocumentoFatturazione.update(documento_id, {
        stato: 'approvata', data_approvazione: new Date().toISOString(),
      });
      return Response.json({ stato: 'approvata' });
    }

    if (azione === 'chiudi') {
      // anche un documento gia' esportato si chiude: l'esportazione viene dopo l'approvazione
      if (!['approvata', 'esportata'].includes(doc.stato)) return rifiuta(['approvata', 'esportata']);
      const giorno = String((conferma && conferma.data) || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno)) {
        return Response.json({ error: "Per chiudere il periodo serve il giorno in cui l'amministrazione ha confermato la fatturazione al cliente." }, { status: 400 });
      }
      if (giorno > oggiRoma()) return Response.json({ error: 'La conferma della fatturazione non può avere una data futura.' }, { status: 400 });
      await base44.asServiceRole.entities.DocumentoFatturazione.update(documento_id, {
        stato: 'chiusa', data_chiusura: new Date().toISOString(),
        fattura_confermata_il: giorno,
        fattura_numero: String((conferma && conferma.numero) || '').trim(),
        fattura_confermata_da: user.full_name || user.email || '',
      });
      return Response.json({ stato: 'chiusa' });
    }

    if (azione === 'riapri') {
      if (doc.stato === 'elaborata') return Response.json({ stato: 'elaborata' });
      // I giorni della nota sono quelli italiani: tagliare l'istante UTC, dopo la
      // mezzanotte italiana, scriveva il giorno prima.
      const fattura = doc.fattura_confermata_il ? ` Fatturazione confermata il ${doc.fattura_confermata_il}${doc.fattura_numero ? `, fattura ${doc.fattura_numero}` : ''}.` : '';
      const chiusoIl = doc.data_chiusura ? giornoRoma(doc.data_chiusura) : null;
      const traccia = `Riaperto il ${oggiRoma()} da ${user.full_name || user.email}: era "${doc.stato}"${chiusoIl ? ` dal ${chiusoIl}` : ''}.${fattura}`;
      await base44.asServiceRole.entities.DocumentoFatturazione.update(documento_id, {
        stato: 'elaborata', data_chiusura: null, data_approvazione: null, data_verifica: null,
        // la conferma valeva per il documento chiuso: resta scritta nella nota qui sotto
        fattura_confermata_il: null, fattura_numero: '', fattura_confermata_da: '',
        note: [doc.note, traccia].filter(Boolean).join('\n'),
      });
      return Response.json({ stato: 'elaborata' });
    }

    return Response.json({ error: 'Azione non riconosciuta' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}