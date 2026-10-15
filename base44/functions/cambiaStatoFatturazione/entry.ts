import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { oggiRoma, giornoRoma } from "../../shared/giornoItaliano.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { rigaConTariffaDaConfermare, prezzoInFrase } from "../../shared/ecotyreTariffe.ts";

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
/**
 * Le tariffe copiate e non confermate delle righe di un documento, una per
 * prezzo: [{ valore, unita_misura, anno_copia, regioni, righe }], per il
 * messaggio della verifica (15/10/2026). L'anno della copia e' quello scritto
 * nella nota della riga («copiato dal 2026»).
 */
function tariffeDaConfermareDelDocumento(voci) {
  const per = new Map();
  for (const v of voci) {
    const unita = String(v.unita_misura || '€/t');
    const k = `${Number(v.tariffa_valore)}|${unita}`;
    const anno = (String(v.note || '').match(/copiat[oa] dal (\d{4})/) || [])[1] || '';
    const t = per.get(k) || { valore: Number(v.tariffa_valore), unita_misura: unita, anno_copia: anno ? Number(anno) : null, regioni: new Set(), righe: 0 };
    t.righe++;
    if (v.regione) t.regioni.add(String(v.regione));
    per.set(k, t);
  }
  return [...per.values()].map(t => ({ ...t, regioni: [...t.regioni].sort() })).sort((a, b) => a.valore - b.valore);
}

/** Il messaggio della verifica fermata dalle tariffe da confermare: quali, e come si confermano. */
function messaggioDaConfermare(doc, quante, tariffe, errori) {
  const canale = { RETE: 'di rete', ACI: 'ACI', EXTRA_RACCOLTA: "dell'extra raccolta" }[String(doc.tipologia || '').toUpperCase()] || '';
  const anni = [...new Set(tariffe.map(t => t.anno_copia).filter(Boolean))].sort();
  const daAnno = anni.length ? `dal ${anni.join(' e dal ')}` : "dall'anno prima";
  const prezzi = tariffe.map(t => `${prezzoInFrase(t.valore)} ${t.unita_misura}${String(doc.tipologia || '').toUpperCase() === 'ACI' && t.regioni.length ? ` (${t.regioni.join(', ')})` : ''}`);
  const quali = prezzi.length === 1 ? `la tariffa a ${prezzi[0]}` : `le tariffe a ${prezzi.slice(0, -1).join(', ')} e ${prezzi[prezzi.length - 1]}`;
  const una = tariffe.length === 1;
  const anno = Number(doc.anno) || '';
  return `Il documento ${canale} non si verifica: ${quante === 1 ? 'una riga è prezzata' : `${quante} righe sono prezzate`} con ${quali}, ${una ? 'copiata' : 'copiate'} ${daAnno} con «Prepara le tariffe» e non ancora ${una ? 'confermata' : 'confermate'}. ${una ? 'Confermala' : 'Confermale'} sul contratto ${anno} in Target & Status › Nuovo anno, poi rielabora il mese.`
    .replace(/\s+/g, ' ')
    + (errori > 0 ? ` In più ${errori === 1 ? 'una riga è' : `${errori} righe sono`} senza prezzo.` : '');
}

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
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
      // Tutte le righe del documento, a pagine: filter senza limite ne legge
      // solo una parte, e una riga in errore oltre quella parte passava.
      const voci = await fetchAll(base44.asServiceRole.entities.VoceFatturazione, { documento_id });
      const errori = voci.filter(v => v.stato_validazione === 'errore').length;
      // LE RIGHE PREZZATE CON UNA TARIFFA COPIATA E NON CONFERMATA (prova
      // generale del cambio d'anno, 15/10/2026, difetto 15). D4, decisione
      // dell'utente del 15/10/2026: una riga cosi' ferma il documento come una
      // riga senza prezzo. Il 10/02/2027 gennaio si verificava «errori 0» con le
      // righe a 202 €/t copiate dal 2026 e mai confermate. Le riconosce la nota
      // che il calcolo dell'attiva scrive sulla riga (rigaConTariffaDaConfermare
      // di ecotyreTariffe.ts); il documento resta «elaborata» e la risposta dice
      // quali tariffe e come confermarle. Dopo la conferma il mese si rielabora:
      // le righe nuove non hanno piu' la nota, e la verifica passa.
      const daConfermare = voci.filter(v => v.stato_validazione !== 'errore' && rigaConTariffaDaConfermare(v));
      const newState = errori > 0 || daConfermare.length > 0 ? 'elaborata' : 'verificata';
      await base44.asServiceRole.entities.DocumentoFatturazione.update(documento_id, {
        stato: newState, data_verifica: new Date().toISOString(), voci_errore: errori,
      });
      if (daConfermare.length) {
        const tariffe = tariffeDaConfermareDelDocumento(daConfermare);
        return Response.json({
          error: messaggioDaConfermare(doc, daConfermare.length, tariffe, errori),
          stato: newState, errori, da_confermare: daConfermare.length, tariffe_da_confermare: tariffe,
        }, { status: 400 });
      }
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