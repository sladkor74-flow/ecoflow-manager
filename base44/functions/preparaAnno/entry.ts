import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { utenteCorrente, rispostaSolaLettura } from "../../shared/permessi.ts";
import { annoChiuso, annoCorrenteRoma } from "../../shared/annoTarget.ts";
import { listaAnno, pianoCopiaTariffe, tariffeDaConfermare, confermaTariffa } from "../../shared/inizializzazioneAnno.ts";
import { traccia, utenteDellaRichiesta, unisciTracce } from "../../shared/traccia.ts";
import { etichettaDi, annoDi, unitaDelCampo, campoRiservato, testoDelValore, registraModifiche } from "../../shared/campiTracciati.ts";

// L'ANNO NUOVO: CHE COSA GLI MANCA PER COMINCIARE, E QUELLO CHE SI PUO' FARE
// DA QUI.
//
// Il contratto con Ecotyre e con tutti i fornitori e' annuale senza tacito
// rinnovo: il 31 dicembre scade tutto. Le tariffe sono la voce che morde per
// prima, perche' dal 1° gennaio una riga senza tariffa vale zero euro e nasce
// in errore, sulla attiva come sulla passiva - e nessuno le copiava.
//
// Azioni:
//   'verifica' (per difetto)  la lista di controllo: chiunque puo' guardarla.
//   'copia_tariffe'           duplica nell'anno nuovo le tariffe che scadono,
//                             col prezzo dell'anno prima e la nota «da
//                             confermare». Solo l'amministratore, mai su un anno
//                             gia' chiuso, e non sovrascrive niente: si puo'
//                             ripetere e completa quello che manca.
//   'conferma_tariffe'        (10/10/2026) toglie la nota «da confermare» alle
//                             tariffe copiate di una direzione, dopo che
//                             l'amministratore le ha controllate sul contratto,
//                             e lascia scritto chi e quando. Prima la lista
//                             chiedeva di confermarle e non c'era un modo per
//                             farlo: si cancellava la nota a mano, tariffa per
//                             tariffa.
//
// La regola di che cosa serve a un anno sta tutta in
// shared/inizializzazioneAnno.ts, con le sue prove: qui si leggono gli archivi
// e si scrive.
//
// LE TARIFFE COPIATE ENTRANO NELLO STORICO DELLE MODIFICHE (11/10/2026): ogni
// tariffa creata dalla copia ha la sua riga in ModificaDato (prezzo, unita',
// date), con chi ha premuto il pulsante e «copia dal <anno prima>». Cosi' alla
// domanda «chi ha messo il prezzo del 2027» c'e' una risposta anche quando la
// risposta e' «la copia, e nessuno l'ha ancora corretto». La risposta porta
// traccia: { scritta, righe, motivo? }.
//
// ANCHE LA CONFERMA ENTRA NELLO STORICO (decisioni dell'utente del 13/10/2026,
// gruppo B). La conferma tocca solo la nota, che non e' un campo tracciato, e
// fino a quel giorno non lasciava nessuna riga: «chi ha confermato il prezzo
// del 2027, e quando» lo diceva solo la nota della tariffa. Ora ogni tariffa
// confermata ha la sua riga (righeConferma): il prezzo, uguale prima e dopo,
// chi ha premuto, quando e «confermato il valore copiato dall'anno prima».
//
// Corpo: { anno, azione, direzione, simula }

// Il motivo delle righe della conferma, uguale per tutte: e' quello che si
// legge nello storico e che EcoTyna trova.
const MOTIVO_CONFERMA = "confermato il valore copiato dall'anno prima";

/**
 * LE RIGHE DELLO STORICO DI UNA CONFERMA (decisioni dell'utente del 13/10/2026,
 * gruppo B). Confermare una tariffa copiata toglie la nota «da confermare» e
 * non cambia nessun campo tracciato: il motore dello storico, che registra solo
 * i campi che cambiano, non scriveva niente, e alla domanda «chi ha confermato
 * il prezzo del 2027, e quando» rispondeva soltanto la nota della tariffa. Qui
 * una riga per ogni valore confermato: il prezzo, uguale prima e dopo (non e'
 * cambiato: e' stato controllato), chi, quando, da dove e il motivo
 * MOTIVO_CONFERMA. Riservata come una modifica della stessa tariffa: il prezzo
 * di un fornitore lo vede solo l'amministratore.
 */
function righeConferma(confermate, { utente = '', origine = '', il = '', anno = 0 } = {}) {
  return (confermate || []).map((t) => {
    const valore = testoDelValore(t.valore);
    const annoTariffa = annoDi('Tariffa', t);
    return {
      entita: 'Tariffa', record_id: String(t.id || ''), etichetta: etichettaDi('Tariffa', t), campo: 'valore',
      ...(valore !== null ? { prima: valore, dopo: valore } : {}),
      unita: unitaDelCampo('Tariffa', 'valore', t), operazione: 'update', utente, il, origine,
      motivo: `${MOTIVO_CONFERMA} (${Number(anno) - 1}), sul contratto ${anno}`,
      riservato: !!campoRiservato('Tariffa', 'valore', t),
      ...(annoTariffa ? { anno: annoTariffa } : {}),
    };
  });
}

export default async function (req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const { user, puoScrivere, errore } = await utenteCorrente(base44);
    if (errore) return errore;

    const body = await req.json().catch(() => ({}));
    const anno = Number(body.anno) || annoCorrenteRoma() + 1;
    const azione = ['copia_tariffe', 'conferma_tariffe'].includes(body.azione) ? body.azione : 'verifica';
    const simula = !!body.simula;
    if (azione !== 'verifica' && !puoScrivere) return rispostaSolaLettura();
    // Un anno gia' passato non si prepara: si e' gia' vissuto, e riaprirlo
    // vorrebbe dire scrivere tariffe su fatture gia' fatte.
    if (azione !== 'verifica' && annoChiuso(anno)) {
      return Response.json({ error: `Il ${anno} e' un anno chiuso: non si prepara.` }, { status: 400 });
    }

    const svc = base44.asServiceRole.entities;
    const comeScrive = { utente: utenteDellaRichiesta(user), origine: 'Nuovo anno, tariffe' };
    const [tariffe, giacenzeSito, targetRaccoglitori, commesse, contrattiFornitore, rilevazioni] = await Promise.all([
      fetchAll(svc.Tariffa),
      fetchAll(svc.GiacenzaSito),
      // I target annui dei raccoglitori: e' quello che la copia d'anno scrive.
      // Prima si leggeva ImpiantoTarget, che non ha mai avuto una riga.
      fetchAll(svc.TargetRaccoglitore),
      fetchAll(svc.CommessaEcotyre),
      fetchAll(svc.ContrattoFornitore),
      fetchAll(svc.GiacenzaStoccaggio),
    ]);

    // I piazzali da fotografare: quelli che l'anagrafica delle giacenze dichiara
    // stoccaggi, piu' quelli che una rilevazione ha gia' visto. Chi non e' piu'
    // contrattualizzato svuota lo stesso la giacenza dell'anno prima, quindi non
    // si esclude (regola dell'utente, 23/09/2026).
    const norm = normalizzaRagioneSociale;
    const piazzali = [...new Set([
      ...giacenzeSito.filter(g => String(g.tipo_destinazione || '').toLowerCase().startsWith('stoc')).map(g => norm(g.sito)),
      ...rilevazioni.map(r => norm(r.sito)),
    ].filter(Boolean))];

    const lista = () => listaAnno({
      anno,
      tariffe,
      giacenzeSito,
      targetRaccoglitori,
      commesse,
      contrattiFornitore,
      rilevazioni: rilevazioni.map(r => ({ ...r, sito: norm(r.sito) })),
      piazzali,
      oggi: oggiRoma(),
    });

    if (azione === 'verifica') {
      return Response.json({ ...lista(), puo_scrivere: !!puoScrivere, utente: user && user.email ? user.email : '' });
    }

    // --- La conferma delle tariffe copiate ---
    if (azione === 'conferma_tariffe') {
      const dir = String(body.direzione || '').toUpperCase();
      if (!['ATTIVA', 'PASSIVA'].includes(dir)) return Response.json({ error: 'Direzione obbligatoria: ATTIVA o PASSIVA.' }, { status: 400 });
      const daConf = tariffeDaConfermare(tariffe, anno, dir);
      if (simula) return Response.json({ simulazione: true, anno, direzione: dir, quante: daConf.length });
      const confermate = [], nonConfermate = [], tracceConferma = [], confermateIntere = [];
      for (const t of daConf) {
        try {
          const scritta = await traccia(svc, 'Tariffa', t.id, confermaTariffa(t, { il: oggiRoma(), da: user && user.email ? user.email : '', anno }), { ...comeScrive, motivo: `confermata sul contratto ${anno}` });
          tracceConferma.push(scritta.traccia);
          confermate.push({ id: t.id, chi: t.fornitore_nome || t.cliente || '', valore: t.valore });
          confermateIntere.push(t);
        } catch (e) {
          nonConfermate.push({ chi: t.fornitore_nome || t.cliente || '', motivo: e && e.message ? e.message : String(e) });
        }
      }
      // Una riga dello storico per ogni valore confermato, scritte tutte insieme
      // (registraModifiche va a blocchi di cento: il limite di richieste). Solo
      // quelle confermate davvero; se il registro non si scrive le tariffe restano
      // confermate, e la risposta lo dice (traccia.scritta false).
      tracceConferma.push(await registraModifiche(svc, righeConferma(confermateIntere, {
        utente: comeScrive.utente, origine: comeScrive.origine, il: new Date().toISOString(), anno,
      })));
      const tariffeDopo = await fetchAll(svc.Tariffa);
      const dopo = listaAnno({
        anno, tariffe: tariffeDopo, giacenzeSito, targetRaccoglitori, commesse, contrattiFornitore,
        rilevazioni: rilevazioni.map(r => ({ ...r, sito: norm(r.sito) })), piazzali, oggi: oggiRoma(),
      });
      return Response.json({ ...dopo, confermate: confermate.length, non_confermate: nonConfermate, direzione: dir, traccia: unisciTracce(tracceConferma), puo_scrivere: true });
    }

    // --- La copia delle tariffe ---
    // Passa dagli stessi controlli dei conflitti di chi salva a mano
    // (pianoCopiaTariffe, 11/10/2026): una copia che si sovrappone a una tariffa
    // gia' scritta per l'anno nuovo non si crea, e si dice con quale si scontra.
    const direzioni = ['ATTIVA', 'PASSIVA'].filter(d => !body.direzione || String(body.direzione).toUpperCase() === d);
    const piano = pianoCopiaTariffe(tariffe, anno, direzioni);
    const daFare = piano.da_creare;
    const chi = (t) => t.fornitore_nome || t.cliente || '';
    // Le copie scartate tornano con quanto serve a riconoscerle nella finestra di
    // conferma e nel messaggio finale (NuovoAnno.jsx, 11/10/2026): chi, quale
    // tipologia e prestazione, il prezzo dell'anno prima e il motivo.
    const scartate = piano.scartate.map(x => ({
      direzione: x.direzione, chi: chi(x.tariffa), tipologia: x.tariffa.tipologia || '', prestazione: x.tariffa.prestazione || '',
      valore: x.tariffa.valore, unita_misura: x.tariffa.unita_misura || '', motivo: x.motivo,
    }));
    if (simula) {
      return Response.json({
        simulazione: true,
        anno,
        quante: daFare.length,
        per_direzione: Object.fromEntries(direzioni.map(d => [d, daFare.filter(x => x.direzione === d).length])),
        esempi: daFare.slice(0, 10).map(x => ({
          direzione: x.direzione, tipologia: x.tariffa.tipologia || '', prestazione: x.tariffa.prestazione || '',
          chi: chi(x.tariffa), regione: x.tariffa.regione || '',
          valore: x.tariffa.valore, unita_misura: x.tariffa.unita_misura || '',
        })),
        scartate,
      });
    }

    const creati = [];
    const falliti = [];
    const tracce = [];
    for (const x of daFare) {
      try {
        const { record: r, traccia: t } = await traccia(svc, 'Tariffa', null, x.copia, { ...comeScrive, motivo: `copia dal ${anno - 1}, da confermare sul contratto ${anno}` });
        tracce.push(t);
        creati.push({ id: r && r.id, direzione: x.direzione, chi: chi(x.tariffa), valore: x.tariffa.valore });
      } catch (e) {
        falliti.push({ direzione: x.direzione, chi: chi(x.tariffa), motivo: e && e.message ? e.message : String(e) });
      }
    }
    // Si rilegge: la lista che torna deve essere quella di DOPO la copia, non
    // quella di prima con un conteggio appiccicato sopra.
    const tariffeDopo = await fetchAll(svc.Tariffa);
    const dopo = listaAnno({
      anno, tariffe: tariffeDopo, giacenzeSito, targetRaccoglitori, commesse, contrattiFornitore,
      rilevazioni: rilevazioni.map(r => ({ ...r, sito: norm(r.sito) })), piazzali, oggi: oggiRoma(),
    });
    // Le copie non create perche' si scontravano con una tariffa gia' scritta:
    // tornano a chi ha premuto il pulsante, con il motivo.
    return Response.json({ ...dopo, creati: creati.length, falliti, scartate, dettaglio_creati: creati, traccia: unisciTracce(tracce), puo_scrivere: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
