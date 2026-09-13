import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import {
  individuaSoggetti, valutaSoggetto, eventiDaSegnalare, oggiRoma, giorniTra, RIPETIZIONE_GIORNI, salvaRiepilogo,
} from "../../shared/qualificaFornitori.ts";

// Controllo giornaliero della qualifica fornitori e promemoria via email.
//
// Payload: { anno?, invia_email?: true, forza?: false }
//
// Ricalcola lo stato dei documenti, individua cosa segnalare e invia un'unica
// email riepilogativa agli amministratori del gestionale. La piattaforma consente
// di scrivere solo agli utenti registrati: il promemoria arriva quindi a chi deve
// poi chiedere i documenti ai fornitori, non ai fornitori stessi.
//
// Per non ripetere ogni giorno la stessa segnalazione, ogni evento inviato viene
// registrato. Una soglia di scadenza, per esempio "mancano 30 giorni", si segnala
// una volta sola; un problema aperto, come un documento mancante, torna ogni
// settimana finche' non viene risolto. Con "forza" si invia comunque il quadro
// completo: e' il comando manuale del modulo.

const ETICHETTA = {
  scaduto: 'SCADUTO',
  non_conforme: 'NON CONFORME',
  in_scadenza: 'IN SCADENZA',
  mancante: 'MANCANTE',
  da_verificare: 'DA VERIFICARE',
};

const ORDINE = { scaduto: 0, non_conforme: 1, in_scadenza: 2, mancante: 3, da_verificare: 4 };

const it = (d) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '');

function rigaEvento(e) {
  if (e.stato === 'scaduto') return `${ETICHETTA.scaduto}: ${e.tipo}, scaduto il ${it(e.scadenza)}`;
  if (e.stato === 'in_scadenza') {
    const quando = e.giorni === 0 ? 'scade oggi' : `scade il ${it(e.scadenza)}, tra ${e.giorni} giorni`;
    return `${ETICHETTA.in_scadenza}: ${e.tipo}, ${quando}`;
  }
  return `${ETICHETTA[e.stato] || e.stato}: ${e.tipo}`;
}

function componiEmail(anno, oggi, eventi, riepilogo, completo) {
  const righe = [];
  righe.push(`Qualifica fornitori ${anno}, situazione al ${it(oggi)}`);
  righe.push('');

  if (eventi.length === 0) {
    righe.push('Non ci sono documenti da richiedere o da rinnovare.');
  } else {
    righe.push(completo ? 'DOCUMENTI DA GESTIRE' : 'NOVITA\' DA GESTIRE');
    const perSoggetto = new Map();
    for (const e of eventi) {
      if (!perSoggetto.has(e.soggetto)) perSoggetto.set(e.soggetto, []);
      perSoggetto.get(e.soggetto).push(e);
    }
    const soggetti = [...perSoggetto.entries()].sort((a, b) => {
      const pa = Math.min(...a[1].map(e => ORDINE[e.stato] ?? 9));
      const pb = Math.min(...b[1].map(e => ORDINE[e.stato] ?? 9));
      return pa - pb || a[0].localeCompare(b[0], 'it');
    });
    for (const [nome, lista] of soggetti) {
      righe.push('');
      righe.push(nome.toUpperCase());
      lista.sort((a, b) => (ORDINE[a.stato] ?? 9) - (ORDINE[b.stato] ?? 9) || (a.giorni ?? 9999) - (b.giorni ?? 9999));
      for (const e of lista) {
        righe.push('  - ' + rigaEvento(e));
        for (const p of (e.problemi || []).slice(0, 4)) righe.push('      ' + p.messaggio);
        if (e.richiesta) righe.push('      Testo proposto per il fornitore: ' + e.richiesta);
      }
    }
  }

  righe.push('');
  righe.push('QUADRO GENERALE');
  righe.push(`  Soggetti da qualificare: ${riepilogo.soggetti}`);
  righe.push(`  Qualificati: ${riepilogo.qualificati}`);
  righe.push(`  Da completare: ${riepilogo.da_completare}`);
  righe.push(`  Con documenti scaduti o non conformi: ${riepilogo.critici}`);
  righe.push(`  Documenti mancanti ${riepilogo.mancanti}, in scadenza ${riepilogo.in_scadenza}, scaduti ${riepilogo.scaduti}, non conformi ${riepilogo.non_conformi}`);
  righe.push('');
  righe.push('Per caricare i documenti apri il modulo Qualifica Fornitori del gestionale.');
  return righe.join('\n');
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const anno = Number(body.anno) || new Date().getFullYear();
    const inviaEmail = body.invia_email !== false;
    const forza = body.forza === true;
    if (forza && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: richiesto ruolo admin' }, { status: 403 });
    }

    const oggi = oggiRoma();
    const svc = base44.asServiceRole.entities;

    const [{ soggetti }, catalogo, documenti, avvisi] = await Promise.all([
      individuaSoggetti(base44, anno),
      fetchAll(svc.TipoDocumentoQualifica),
      fetchAll(svc.DocumentoQualifica, { stato: 'attivo' }),
      fetchAll(svc.AvvisoQualifica, { anno }),
    ]);

    const valutati = soggetti.map(s => valutaSoggetto(s, catalogo, documenti, oggi));
    // Il riepilogo alimenta il contatore del menu: si aggiorna sempre, anche
    // quando non c'e' nulla da inviare.
    const alert = await salvaRiepilogo(base44, anno, valutati);
    const requisiti = valutati.flatMap(s => s.requisiti);
    const riepilogo = {
      soggetti: valutati.length,
      qualificati: valutati.filter(s => s.stato === 'qualificato' || s.stato === 'in_scadenza').length,
      da_completare: valutati.filter(s => s.stato === 'da_completare').length,
      critici: valutati.filter(s => s.stato === 'critico').length,
      mancanti: requisiti.filter(r => r.stato === 'mancante').length,
      in_scadenza: requisiti.filter(r => r.stato === 'in_scadenza').length,
      scaduti: requisiti.filter(r => r.stato === 'scaduto').length,
      non_conformi: requisiti.filter(r => r.stato === 'non_conforme').length,
    };

    const eventi = eventiDaSegnalare(valutati);
    const registro = new Map(avvisi.map(a => [a.chiave_evento, a]));
    const daInviare = forza ? eventi : eventi.filter(e => {
      const a = registro.get(e.chiave);
      if (!a) return true;
      if (!e.ripetibile) return false;
      const ultimo = String(a.ultimo_invio || '').slice(0, 10);
      return !ultimo || giorniTra(ultimo, oggi) >= RIPETIZIONE_GIORNI;
    });

    const esito = { anno, oggi, riepilogo, alert_aperti: alert.alert_aperti, eventi: eventi.length, da_inviare: daInviare.length, inviata: false, destinatari: [] };
    if (!inviaEmail || daInviare.length === 0) return Response.json(esito);

    // Destinatari: gli amministratori del gestionale. Se l'elenco utenti non e'
    // leggibile si ripiega su chi ha avviato il controllo.
    let destinatari = [];
    try {
      const utenti = await svc.User.list();
      destinatari = utenti.filter(u => u.role === 'admin' && u.email).map(u => u.email);
    } catch (_e) { /* si usa il ripiego sotto */ }
    if (destinatari.length === 0 && user.email) destinatari = [user.email];
    destinatari = [...new Set(destinatari)];
    if (destinatari.length === 0) return Response.json({ ...esito, error: 'Nessun destinatario disponibile' }, { status: 400 });

    const conta = (stato) => daInviare.filter(e => e.stato === stato).length;
    const parti = [];
    if (conta('scaduto')) parti.push(conta('scaduto') + ' scaduti');
    if (conta('non_conforme')) parti.push(conta('non_conforme') + ' non conformi');
    if (conta('in_scadenza')) parti.push(conta('in_scadenza') + ' in scadenza');
    if (conta('mancante')) parti.push(conta('mancante') + ' mancanti');
    if (conta('da_verificare')) parti.push(conta('da_verificare') + ' da verificare');
    const oggetto = `Qualifica fornitori ${anno}: ${parti.join(', ')}`;
    const testo = componiEmail(anno, oggi, daInviare, riepilogo, forza);

    for (const to of destinatari) {
      await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: oggetto, body: testo, from_name: 'Gestionale PFU - Qualifica fornitori' });
    }

    // Si registra solo cio' che e' stato effettivamente inviato.
    const adesso = new Date().toISOString();
    for (const e of daInviare) {
      const a = registro.get(e.chiave);
      if (a) {
        await svc.AvvisoQualifica.update(a.id, { ultimo_invio: adesso, invii: (a.invii || 1) + 1 });
      } else {
        await svc.AvvisoQualifica.create({ anno, chiave_evento: e.chiave, descrizione: `${e.soggetto} - ${rigaEvento(e)}`, ultimo_invio: adesso, invii: 1 });
      }
    }

    return Response.json({ ...esito, inviata: true, destinatari, oggetto });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
