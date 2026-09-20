import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { cancellaFile, daAlleggerire } from "../../shared/fileArchivio.ts";
import { oggiRoma } from "../../shared/qualificaFornitori.ts";

// Alleggerisce l'archivio della qualifica: toglie il file ai documenti
// sostituiti da abbastanza tempo.
//
// Il record NON si cancella: sintesi, scadenza, problemi e il motivo della
// sostituzione restano, perche' sono la storia del fornitore. Se ne va solo il
// file, che e' gia' stato rimpiazzato da uno piu' recente e che comunque esiste
// nella cartella dei contratti sul computer dell'azienda.
//
// Non e' automatico apposta: cancellare file e' una decisione, la prende
// l'amministratore guardando prima l'elenco.
//
// Payload: { anni?: 3, solo_elenco?: true, massimo?: 200 }

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();

    const body = await req.json().catch(() => ({}));
    const anni = Math.max(1, Math.min(10, Number(body.anni) || 3));
    const soloElenco = body.solo_elenco !== false;
    const massimo = Math.max(1, Math.min(500, Number(body.massimo) || 200));
    const svc = base44.asServiceRole.entities;

    const documenti = await fetchAll(svc.DocumentoQualifica, { stato: 'sostituito' });
    const candidati = daAlleggerire(documenti, { anni, adessoMs: Date.now() });

    if (soloElenco) {
      return Response.json({
        anni, quanti: candidati.length,
        sostituiti_in_tutto: documenti.length,
        con_file: documenti.filter(d => d.file_uri).length,
        elenco: candidati.slice(0, 50),
      });
    }

    const oggi = oggiRoma();
    const esiti = [];
    let tolti = 0;
    let nonSupportata = null;
    for (const c of candidati.slice(0, massimo)) {
      const doc = documenti.find(d => d.id === c.id);
      if (!doc) continue;
      const esito = await cancellaFile(base44, doc.file_uri);
      // Se la piattaforma non sa cancellare, ci si ferma subito invece di
      // svuotare il campo su decine di documenti lasciando i file dove sono.
      if (!esito.riuscita) { nonSupportata = esito.come; break; }
      const nota = [String(doc.note || '').trim(),
        `File rimosso il ${oggi}: documento sostituito da oltre ${c.anni} ${c.anni === 1 ? 'anno' : 'anni'}. Il file originale resta nella cartella dei contratti.`]
        .filter(Boolean).join('\n');
      await svc.DocumentoQualifica.update(doc.id, { file_uri: '', note: nota });
      tolti++;
      esiti.push({ soggetto: doc.soggetto_nome, documento: doc.tipo_documento_nome, file: doc.file_nome, anni: c.anni });
    }

    return Response.json({
      anni, quanti: candidati.length, alleggeriti: tolti,
      restano: Math.max(0, candidati.length - tolti),
      non_supportata: nonSupportata,
      esiti: esiti.slice(0, 50),
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
