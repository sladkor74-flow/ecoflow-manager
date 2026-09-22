import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { emailQualifica } from "../../shared/emailQualifica.ts";
import {
  individuaSoggetti, valutaSoggetto, eventiDaSegnalare, oggiRoma, giorniTra, RIPETIZIONE_GIORNI, salvaRiepilogo,
  anomalieCatalogo,
} from "../../shared/qualificaFornitori.ts";
import { applicaControlloClasse } from "../../shared/classeAlbo.ts";

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

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const anno = Number(body.anno) || Number(oggiRoma().slice(0, 4));
    const forza = body.forza === true;
    // Il promemoria arriva agli amministratori e li impegna: lo puo' far partire
    // solo un amministratore. Il lavoro programmato gira con quel ruolo. Chi
    // consulta soltanto puo' comunque chiedere il ricalcolo, senza invio.
    if (user.role !== 'admin' && (body.invia_email !== false || forza)) {
      return Response.json({ error: 'Solo un amministratore puo inviare il promemoria.' }, { status: 403 });
    }
    const inviaEmail = body.invia_email !== false;

    const oggi = oggiRoma();
    const svc = base44.asServiceRole.entities;

    const [{ soggetti, soggetti_da_date }, catalogo, documentiSalvati, avvisi, targetAnnui, targetMensili] = await Promise.all([
      individuaSoggetti(base44, anno),
      fetchAll(svc.TipoDocumentoQualifica),
      fetchAll(svc.DocumentoQualifica, { stato: 'attivo' }),
      fetchAll(svc.AvvisoQualifica, { anno }),
      fetchAll(svc.TargetRaccoglitore, { anno }),
      fetchAll(svc.TargetMensile, { anno }),
    ]);

    // La classe dell'iscrizione all'Albo si confronta con i target in vigore.
    const documenti = applicaControlloClasse(documentiSalvati, soggetti, targetAnnui, targetMensili, anno);
    const valutati = soggetti.map(s => valutaSoggetto(s, catalogo, documenti, oggi));
    const anomalie = anomalieCatalogo(catalogo, soggetti, anno);
    // Il riepilogo alimenta il contatore del menu: si aggiorna sempre, anche
    // quando non c'e' nulla da inviare.
    const alert = await salvaRiepilogo(base44, anno, valutati, anomalie);
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

    const erroriCatalogo = anomalie.filter(a => a.gravita === 'errore');
    // Chi compare solo in terminati senza fine trasporto non e' fra i soggetti, ma
    // si dice anche qui (regola dell'utente del 22/09/2026).
    const esito = { anno, oggi, riepilogo, alert_aperti: alert.alert_aperti, eventi: eventi.length, da_inviare: daInviare.length, anomalie, soggetti_da_date: soggetti_da_date || [], inviata: false, destinatari: [] };
    // Un documento intestato a un fornitore inesistente va detto anche quando non
    // c'e' nessun'altra novita': altrimenti non lo scopre nessuno.
    if (!inviaEmail || (daInviare.length === 0 && erroriCatalogo.length === 0)) return Response.json(esito);

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

    // Il promemoria e' un documento ordinato, diviso per urgenza: in HTML, perche'
    // il testo semplice la posta lo appiattisce e centoventi righe diventano un muro.
    const { oggetto, html } = emailQualifica({
      anno, oggi, eventi: daInviare, riepilogo, anomalie, completo: forza,
      indirizzo: body.indirizzo_modulo || '',
    });

    for (const to of destinatari) {
      await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: oggetto, body: html, from_name: 'Gestionale PFU - Qualifica fornitori' });
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
