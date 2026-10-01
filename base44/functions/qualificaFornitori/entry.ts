import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { individuaSoggetti, valutaSoggetto, oggiRoma, salvaRiepilogo, anomalieCatalogo, STATI_ALERT } from "../../shared/qualificaFornitori.ts";
import { applicaControlloClasse } from "../../shared/classeAlbo.ts";
import { daAnalizzare } from "../../shared/analisiDocumento.ts";
import { statoCaricamenti, descriviCaricamento } from "../../shared/reportSettimanali.ts";
import { eAmministratore } from "../../shared/permessi.ts";

// Situazione della qualifica fornitori per un anno.
//
// Payload: { anno, soggetti?, esclusi?, soggetti_da_date? }
// Senza "soggetti" individua gli attori dell'anno dalle movimentazioni, che e'
// l'operazione costosa perche' rilegge tutti gli archivi. Con "soggetti", cioe'
// l'elenco gia' ottenuto in precedenza, rivaluta solo i documenti: e' la strada
// usata dopo un caricamento o una correzione, che cosi' si aggiorna in un attimo.

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const anno = Number(body.anno) || Number(oggiRoma().slice(0, 4));
    const oggi = oggiRoma();

    // Gli attori dell'anno si individuano rileggendo primarie, secondarie ed
    // extra raccolta: se uno di quegli archivi si sta riscrivendo, o un
    // caricamento l'ha lasciato a meta', i soggetti letti adesso sarebbero
    // sbagliati e il riepilogo li salverebbe cosi'. Era l'unico dei ricalcoli
    // che non lo guardava, e scriveva su un archivio che il registro aveva
    // appena dichiarato inaffidabile: e' la regola 2 al contrario.
    //
    // Si CALCOLA lo stesso e si risponde 200, SALTANDO IL SALVATAGGIO. Le
    // altre funzioni che si rinviano rispondono 409 (analisiSettimanalePredittiva,
    // ricontrollaDichiarazioni, controllaEvasioneAssegnati); questa e'
    // diversa da tutte perche' e' l'unica che chiama anche una PAGINA, a ogni
    // apertura (QualificaFornitori.jsx, PassivaQualifica.jsx). Col 409 la
    // pagina restava una schermata d'errore finche' non si ricaricava il file -
    // la notte delle 57 righe perse - e non si apriva piu'. Il ricalcolo dopo i
    // caricamenti continua a dirsi "non aggiornato" perche' legge "rinviato".
    //
    // Chi chiama per aggiornare il RIEPILOGO SALVATO non deve insistere: il
    // riepilogo resta quello di prima, quindi la condizione "e' piu' vecchio
    // dell'ultimo caricamento" resta vera per sempre e la pagina rifarebbe il
    // calcolo completo a ogni apertura. La regola sta in qualificaDaRifare
    // (src/lib/importGrandeFile.js), dove la controllano le prove.
    //
    // Con i soggetti gia' in mano si rivalutano solo i documenti e gli archivi
    // non si toccano: li' non si rinvia niente.
    // L'ELENCO DEI SOGGETTI SI ACCETTA SOLO DA CHI PUO' SCRIVERE (02/10/2026).
    //
    // L'aggiornamento rapido rimanda indietro i soggetti gia' noti per non
    // rileggere gli archivi. Ma quell'elenco finiva dritto nel riepilogo
    // salvato, e il riepilogo lo legge la fatturazione passiva per avvisare,
    // prima di pagare, chi ha documenti scaduti o non conformi: chiamando la
    // funzione con "soggetti: []" il riepilogo usciva con zero soggetti critici
    // e zero alert, e nessuno se ne accorgeva. Bastava essere collegati.
    //
    // Non si chiude la strada - serve, ed e' quella usata dopo un caricamento o
    // una correzione - si chiude a chi non puo' scrivere: a lui i soggetti si
    // ricalcolano dagli archivi, piu' lento ma vero. Un amministratore puo' gia'
    // scrivere quello che vuole: da lui l'elenco si accetta com'e'.
    const daCorpo = Array.isArray(body.soggetti) && eAmministratore(user);

    let rinviato = null;
    if (!daCorpo) {
      const { in_corso } = await statoCaricamenti(base44);
      if (in_corso.length) rinviato = in_corso;
    }

    let soggetti = daCorpo ? body.soggetti : null;
    let esclusi = daCorpo && Array.isArray(body.esclusi) ? body.esclusi : [];
    // Chi compare nell'anno solo in terminati senza fine trasporto (22/09/2026):
    // come gli esclusi, la pagina lo rimanda indietro nell'aggiornamento rapido.
    let soggettiDaDate = daCorpo && Array.isArray(body.soggetti_da_date) ? body.soggetti_da_date : [];
    if (!soggetti) {
      const esito = await individuaSoggetti(base44, anno);
      soggetti = esito.soggetti;
      esclusi = esito.esclusi;
      soggettiDaDate = esito.soggetti_da_date || [];
    }

    const [catalogo, documentiSalvati, targetAnnui, targetMensili] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.TipoDocumentoQualifica),
      fetchAll(base44.asServiceRole.entities.DocumentoQualifica, { stato: 'attivo' }),
      fetchAll(base44.asServiceRole.entities.TargetRaccoglitore, { anno }),
      fetchAll(base44.asServiceRole.entities.TargetMensile, { anno }),
    ]);
    // La classe dell'iscrizione all'Albo si confronta con i target in vigore.
    const documenti = applicaControlloClasse(documentiSalvati, soggetti, targetAnnui, targetMensili, anno);

    const valutati = soggetti.map(s => valutaSoggetto(s, catalogo, documenti, oggi));
    // Voci del catalogo intestate a un fornitore che quest'anno non c'e': senza
    // questo controllo resterebbero mute e sembrerebbe tutto a posto.
    const anomalie = anomalieCatalogo(catalogo, soggetti, anno);
    // Documenti che l agente non ha mai letto, o che conviene rileggere: si
    // conta qui perche gli archivi sono gia in mano, senza una chiamata in piu.
    const daLeggere = daAnalizzare(documentiSalvati, catalogo, { adessoMs: Date.now(), massimo: 0 });
    // Con un caricamento aperto NON si salva: il riepilogo salvato lo leggono la
    // dashboard, il menu e la fatturazione passiva, e scriverlo su archivi a
    // meta' e' proprio cio' che la regola 2 vieta. I numeri a video si calcolano
    // lo stesso, cosi' la pagina si apre e mostra la situazione.
    const requisiti = valutati.flatMap(s => s.requisiti);
    const alert = rinviato
      ? {
        alert_aperti: requisiti.filter(r => STATI_ALERT.includes(r.stato)).length,
        soggetti_con_alert: valutati.filter(s => s.requisiti.some(r => STATI_ALERT.includes(r.stato))).length,
      }
      : await salvaRiepilogo(base44, anno, valutati, anomalie);

    const conta = (fn) => valutati.filter(fn).length;
    const riepilogo = {
      soggetti: valutati.length,
      qualificati: conta(s => s.stato === 'qualificato' || s.stato === 'in_scadenza'),
      da_completare: conta(s => s.stato === 'da_completare'),
      critici: conta(s => s.stato === 'critico'),
      documenti_mancanti: requisiti.filter(r => r.stato === 'mancante').length,
      in_scadenza: requisiti.filter(r => r.stato === 'in_scadenza').length,
      scaduti: requisiti.filter(r => r.stato === 'scaduto').length,
      non_conformi: requisiti.filter(r => r.stato === 'non_conforme').length,
      da_verificare: requisiti.filter(r => r.stato === 'da_verificare').length,
      catalogo_vuoto: catalogo.filter(t => t.attivo !== false).length === 0,
      alert_aperti: alert.alert_aperti,
      soggetti_con_alert: alert.soggetti_con_alert,
      anomalie_catalogo: anomalie.filter(a => a.gravita === 'errore').length,
      da_leggere: daLeggere.length,
      mai_letti: daLeggere.filter(d => d.motivo === 'mai_letto').length,
    };

    return Response.json({
      anno, oggi, riepilogo, soggetti: valutati, esclusi,
      soggetti_da_date: soggettiDaDate, catalogo, anomalie,
      da_leggere: daLeggere.slice(0, 40),
      // Calcolato ma non salvato: chi consulta vede la situazione, chi ricalcola
      // sa che non e' aggiornata e si rifa' al prossimo caricamento concluso.
      ...(rinviato ? {
        rinviato: true,
        riepilogo_salvato: false,
        caricamenti_in_corso: rinviato,
        avviso: `Qualifica non aggiornata: caricamento ${rinviato.map(descriviCaricamento).join('; ')}. `
          + "I numeri sono calcolati adesso ma non sono stati salvati: si rifa' da sola al prossimo caricamento concluso.",
      } : {}),
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
