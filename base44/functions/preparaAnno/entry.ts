import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { utenteCorrente, rispostaSolaLettura } from "../../shared/permessi.ts";
import { annoChiuso, annoCorrenteRoma } from "../../shared/annoTarget.ts";
import { listaAnno, tariffeDaRinnovare, copiaTariffa, tariffeDaConfermare, confermaTariffa } from "../../shared/inizializzazioneAnno.ts";

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
// Corpo: { anno, azione, direzione, simula }
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
      const confermate = [], nonConfermate = [];
      for (const t of daConf) {
        try {
          await svc.Tariffa.update(t.id, confermaTariffa(t, { il: oggiRoma(), da: user && user.email ? user.email : '', anno }));
          confermate.push({ id: t.id, chi: t.fornitore_nome || t.cliente || '', valore: t.valore });
        } catch (e) {
          nonConfermate.push({ chi: t.fornitore_nome || t.cliente || '', motivo: e && e.message ? e.message : String(e) });
        }
      }
      const tariffeDopo = await fetchAll(svc.Tariffa);
      const dopo = listaAnno({
        anno, tariffe: tariffeDopo, giacenzeSito, targetRaccoglitori, commesse, contrattiFornitore,
        rilevazioni: rilevazioni.map(r => ({ ...r, sito: norm(r.sito) })), piazzali, oggi: oggiRoma(),
      });
      return Response.json({ ...dopo, confermate: confermate.length, non_confermate: nonConfermate, direzione: dir, puo_scrivere: true });
    }

    // --- La copia delle tariffe ---
    const direzioni = ['ATTIVA', 'PASSIVA'].filter(d => !body.direzione || String(body.direzione).toUpperCase() === d);
    const daFare = direzioni.flatMap(d => tariffeDaRinnovare(tariffe, anno, d).map(t => ({ direzione: d, tariffa: t })));
    if (simula) {
      return Response.json({
        simulazione: true,
        anno,
        quante: daFare.length,
        per_direzione: Object.fromEntries(direzioni.map(d => [d, daFare.filter(x => x.direzione === d).length])),
        esempi: daFare.slice(0, 10).map(x => ({
          direzione: x.direzione, tipologia: x.tariffa.tipologia || '', prestazione: x.tariffa.prestazione || '',
          chi: x.tariffa.fornitore_nome || x.tariffa.cliente || '', regione: x.tariffa.regione || '',
          valore: x.tariffa.valore, unita_misura: x.tariffa.unita_misura || '',
        })),
      });
    }

    const creati = [];
    const falliti = [];
    for (const x of daFare) {
      try {
        const r = await svc.Tariffa.create(copiaTariffa(x.tariffa, anno));
        creati.push({ id: r && r.id, direzione: x.direzione, chi: x.tariffa.fornitore_nome || x.tariffa.cliente || '', valore: x.tariffa.valore });
      } catch (e) {
        falliti.push({ direzione: x.direzione, chi: x.tariffa.fornitore_nome || x.tariffa.cliente || '', motivo: e && e.message ? e.message : String(e) });
      }
    }
    // Si rilegge: la lista che torna deve essere quella di DOPO la copia, non
    // quella di prima con un conteggio appiccicato sopra.
    const tariffeDopo = await fetchAll(svc.Tariffa);
    const dopo = listaAnno({
      anno, tariffe: tariffeDopo, giacenzeSito, targetRaccoglitori, commesse, contrattiFornitore,
      rilevazioni: rilevazioni.map(r => ({ ...r, sito: norm(r.sito) })), piazzali, oggi: oggiRoma(),
    });
    return Response.json({ ...dopo, creati: creati.length, falliti, dettaglio_creati: creati, puo_scrivere: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
