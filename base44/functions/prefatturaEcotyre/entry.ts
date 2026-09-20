import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';
import { fetchAll } from "../../shared/fetchAll.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { giornoRoma } from "../../shared/giornoItaliano.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { calcolaRigheAttiva } from "../../shared/attivaCalcolo.ts";
import { leggiTabellePrefattura, confrontaPrefattura, comeOrdine, comeNumero } from "../../shared/prefattura.ts";

// La prefattura del portale Ecotyre: si carica (Excel o PDF), si tiene per il
// mese, e si confronta con le righe che il gestionale calcola sui dati di oggi.
//
// azione 'carica'    (solo admin): { anno, mese, file_uri, nome_file } -> legge, salva, confronta
// azione 'confronta' (tutti):      { anno, mese } -> confronto con la prefattura valida del mese
//
// Una nuova prefattura dello stesso mese non cancella la precedente: la segna
// superata, col motivo. Il confronto si rifa' a ogni apertura, perche' i dati
// del gestionale cambiano a ogni importazione.
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

const SCHEMA_PDF = {
  type: 'object',
  properties: {
    righe: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id_ordine: { type: 'string' }, numero_fir: { type: 'string' },
          kg: { type: 'number' }, importo: { type: 'number' }, prezzo: { type: 'number' }, servizio: { type: 'string' },
        },
        required: ['id_ordine'],
      },
    },
    totale_kg: { type: 'number' },
    totale_euro: { type: 'number' },
    note: { type: 'string' },
  },
  required: ['righe'],
};
const PROMPT_PDF = [
  'Questo documento e\' una prefattura del consorzio Ecotyre verso un raccoglitore di pneumatici fuori uso.',
  'Estrai TUTTE le righe di dettaglio, una per ordine, senza saltarne e senza riassumere:',
  '- id_ordine: il codice dell\'ordine (due-quattro lettere e almeno sei cifre, per esempio ET26084363);',
  '- numero_fir: il numero del formulario, se c\'e\';',
  '- kg: il peso in chilogrammi (se il documento lo da\' in tonnellate, moltiplica per 1000);',
  '- importo: l\'importo in euro della riga; prezzo: il prezzo unitario in euro a tonnellata, se c\'e\';',
  '- servizio: la descrizione del servizio della riga, se c\'e\'.',
  'In totale_kg e totale_euro riporta i totali complessivi STAMPATI sul documento, se ci sono; non calcolarli tu.',
  'I numeri sono all\'italiana: il punto separa le migliaia, la virgola i decimali. Restituisci numeri, non testo.',
  'Non inventare niente: se un valore non c\'e\', lascialo vuoto.',
].join('\n');

function comeOggetto(v) {
  if (v && typeof v === 'object') return v;
  const s = String(v || '');
  const inizio = s.indexOf('{'), fine = s.lastIndexOf('}');
  if (inizio < 0 || fine <= inizio) throw new Error('La lettura del PDF non ha restituito un elenco leggibile.');
  return JSON.parse(s.slice(inizio, fine + 1));
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { azione = 'confronta', anno, mese, file_uri, nome_file } = await req.json().catch(() => ({}));
    const annoNum = Number(anno);
    if (!annoNum || !MESI.includes(mese)) return Response.json({ error: 'Anno e mese obbligatori' }, { status: 400 });

    const svc = base44.asServiceRole.entities;
    const core = base44.asServiceRole.integrations.Core;

    if (azione === 'carica') {
      if (user.role !== 'admin') return rispostaSolaLettura();
      if (!file_uri) return Response.json({ error: 'file_uri obbligatorio' }, { status: 400 });
      const nome = String(nome_file || '');
      const formato = /\.pdf$/i.test(nome) ? 'pdf' : /\.(xlsx|xlsm|xls|csv)$/i.test(nome) ? 'excel' : '';
      if (!formato) return Response.json({ error: 'La prefattura si carica in Excel (.xlsx, .xls, .csv) o in PDF.' }, { status: 400 });

      const { signed_url } = await core.CreateFileSignedUrl({ file_uri, expires_in: 900 });
      let righe = [], note = [], totKg = null, totEuro = null;
      if (formato === 'excel') {
        const risposta = await fetch(signed_url);
        if (!risposta.ok) return Response.json({ error: 'Il file non si riesce a leggere: ' + risposta.status }, { status: 400 });
        const wb = XLSX.read(new Uint8Array(await risposta.arrayBuffer()), { type: 'array' });
        const tabelle = wb.SheetNames.map(n => ({ nome: n, celle: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }) }));
        ({ righe, note } = leggiTabellePrefattura(tabelle));
      } else {
        const letto = comeOggetto(await core.InvokeLLM({ prompt: PROMPT_PDF, file_urls: [signed_url], response_json_schema: SCHEMA_PDF }));
        righe = (letto.righe || []).map(r => ({
          id_ordine: comeOrdine(r.id_ordine), numero_fir: String(r.numero_fir || '').toUpperCase().trim(),
          kg: comeNumero(r.kg) === null ? null : Math.round(comeNumero(r.kg)), importo: comeNumero(r.importo), prezzo: comeNumero(r.prezzo),
          servizio: String(r.servizio || ''), foglio: 'PDF',
        })).filter(r => r.id_ordine);
        totKg = comeNumero(letto.totale_kg); totEuro = comeNumero(letto.totale_euro);
        note.push('PDF letto dall\'agente: la lettura va guardata. Quando c\'e\', l\'Excel del portale e\' piu\' affidabile.');
        // la lettura e' completa solo se le righe sommano i totali stampati
        const sKg = righe.reduce((s, r) => s + (r.kg || 0), 0), sEuro = righe.reduce((s, r) => s + (r.importo || 0), 0);
        if (totKg && Math.abs(sKg - totKg) > 1) note.push(`ATTENZIONE: le righe lette sommano ${Math.round(sKg)} kg, il documento ne stampa ${Math.round(totKg)}: la lettura e' incompleta, il confronto ordine per ordine non e' affidabile.`);
        if (totEuro && Math.abs(sEuro - totEuro) > 0.05) note.push(`ATTENZIONE: le righe lette sommano ${sEuro.toFixed(2)} euro, il documento ne stampa ${totEuro.toFixed(2)}: la lettura e' incompleta.`);
        if (letto.note) note.push(String(letto.note));
      }
      if (!righe.length) return Response.json({ error: 'Nel file non ho trovato righe con un ID ordine: non sembra una prefattura. ' + note.join(' ') }, { status: 400 });

      const adesso = new Date().toISOString();
      const precedenti = (await svc.PrefatturaEcotyre.filter({ anno: annoNum, mese })).filter(p => !p.superata);
      await svc.PrefatturaEcotyre.create({
        anno: annoNum, mese, nome_file: nome, formato, righe,
        totale_kg_stampato: totKg ?? undefined, totale_euro_stampato: totEuro ?? undefined,
        note_lettura: note.join('\n'), caricata_il: adesso, caricata_da: user.full_name || user.email || '',
      });
      for (const p of precedenti) {
        await svc.PrefatturaEcotyre.update(p.id, { superata: true, motivo_superata: `Sostituita il ${adesso.slice(0, 10)} dal file "${nome}" (${righe.length} righe), caricato da ${user.full_name || user.email}.` });
      }
      // Il file serviva solo a essere letto: le righe sono salvate.
      for (const n of ['DeleteFile', 'DeletePrivateFile', 'RemoveFile']) {
        if (typeof core[n] !== 'function') continue;
        try { await core[n]({ file_uri }); break; } catch (_e) { /* resta nell'archivio privato */ }
      }
    } else if (azione !== 'confronta') {
      return Response.json({ error: 'Azione non riconosciuta' }, { status: 400 });
    }

    const valide = (await svc.PrefatturaEcotyre.filter({ anno: annoNum, mese })).filter(p => !p.superata)
      .sort((a, b) => String(b.caricata_il || '').localeCompare(String(a.caricata_il || '')));
    const prefattura = valide[0] || null;
    if (!prefattura) return Response.json({ prefattura: null, confronto: null });

    const [reteAll, aciAll, extraAll, fornitori, tariffe] = await Promise.all([
      fetchAll(svc.PrimariaRete), fetchAll(svc.PrimariaAci), fetchAll(svc.ExtraRaccolta),
      fetchAll(svc.Fornitore), svc.Tariffa.filter({ direzione: 'ATTIVA' }),
    ]);
    const { righe } = calcolaRigheAttiva({ reteAll, aciAll, extraAll, fornitori, tariffe, anno: annoNum, mese });

    // Dove sta, nel gestionale, un ordine che il mese non ha
    const altrove = new Map();
    const segna = (lista, canaleDi) => {
      for (const o of lista) {
        const id = comeOrdine(o.id_ordine);
        if (!id) continue;
        const stato = String(o.stato || '').toLowerCase().trim();
        const gia = altrove.get(id);
        if (gia && gia.stato === 'terminato' && stato !== 'terminato') continue;
        altrove.set(id, { canale: canaleDi(o), stato, giorno: giornoRoma(o.trasporto_finito_il) });
      }
    };
    segna(reteAll, (o) => (eAci(o) ? 'ACI' : 'RETE'));
    segna(aciAll, () => 'ACI');
    segna(extraAll, () => 'EXTRA_RACCOLTA');

    const { righe: _righe, ...meta } = prefattura;
    return Response.json({
      prefattura: { ...meta, numero_righe: (prefattura.righe || []).length },
      confronto: confrontaPrefattura(prefattura.righe || [], righe, altrove),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
