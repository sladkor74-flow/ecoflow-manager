import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { eAmministratore } from "../../shared/permessi.ts";
import { reportConferimenti, quadraturaPassiva } from "../../shared/reportConferimenti.ts";
import { calcolaPassivaMese, MESI_PASSIVA } from "../../shared/passivaCalcolo.ts";
import { eSecondariaExtra } from "../../shared/attivaCalcolo.ts";

// I conferimenti di un mese ripartiti sulle settimane che lo coprono, per un
// canale e un tipo di movimento (richiesta dell'utente, 29/09/2026).
//
// Il conto sta tutto in shared/reportConferimenti.ts: qui si leggono gli archivi
// e si risponde. Un canale per volta, mai sommati (regola 3).
//
// LA QUADRATURA CON LA PASSIVA SI CHIEDE, NON SI FA SEMPRE. Il conto della
// fatturazione passiva legge SEI archivi interi: farlo a ogni apertura della
// pagina riempirebbe il limite di richieste al minuto della piattaforma. Chi vuole
// la quadratura la chiede con con_passiva, come nel modulo Fatturazione si preme
// Calcola. E la passiva e' riservata all'amministratore, perche' contiene i costi:
// a tutti gli altri il report arriva lo stesso, con i chili e senza gli euro.
//
// Risposte: 200 con { report, quadratura }; 401 a chi non e' entrato;
// 400 se mancano i parametri o non si riconoscono.

const ARCHIVI = {
  'RETE|primaria': { entita: 'PrimariaRete', archivio: '' },
  'ACI|primaria': { entita: 'PrimariaAci', archivio: '' },
  'RETE|secondaria': { entita: 'Secondaria', archivio: 'Secondaria' },
  'ACI|secondaria': { entita: 'Secondaria', archivio: 'Secondaria' },
  'EXTRA_RACCOLTA|primaria': { entita: 'ExtraRaccolta', archivio: 'ExtraRaccolta' },
  'EXTRA_RACCOLTA|secondaria': { entita: 'ExtraRaccolta', archivio: 'ExtraRaccolta' },
};

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const anno = Number(body.anno);
    const mese = Number(body.mese);
    const canale = String(body.canale || '').toUpperCase();
    const tipo = String(body.tipo || 'secondaria').toLowerCase();
    if (!anno || !mese || mese < 1 || mese > 12) return Response.json({ error: 'Anno e mese (1-12) obbligatori' }, { status: 400 });
    const scelta = ARCHIVI[`${canale}|${tipo}`];
    if (!scelta) return Response.json({ error: 'Canale o tipo non validi: canale RETE, ACI o EXTRA_RACCOLTA, tipo primaria o secondaria' }, { status: 400 });

    const svc = base44.asServiceRole.entities;
    const records = await fetchAll(svc[scelta.entita]);

    // Nell'extra raccolta primarie e secondarie stanno nello stesso archivio e si
    // distinguono dal tipo_movimento: e' la stessa regola della fatturazione.
    const filtro = scelta.entita === 'ExtraRaccolta'
      ? (tipo === 'secondaria' ? eSecondariaExtra : (r) => !eSecondariaExtra(r))
      : null;

    const report = reportConferimenti(records, { anno, mese, canale, archivio: scelta.archivio, tipo, filtro });

    let quadratura = { disponibile: false, motivo: 'Chiedi la quadratura per confrontare questi chili con la fatturazione passiva.' };
    if (body.con_passiva) {
      if (!eAmministratore(user)) {
        quadratura = { disponibile: false, motivo: 'La quadratura con la fatturazione passiva e\' riservata all\'amministratore, perche\' contiene i costi. I chili del report li vedi comunque.' };
      } else {
        const [primarieRete, primarieAci, secondarieAll, extraRaccoltaAll, tariffeAll, fornitoriAll] = await Promise.all([
          fetchAll(svc.PrimariaRete),
          fetchAll(svc.PrimariaAci),
          fetchAll(svc.Secondaria),
          fetchAll(svc.ExtraRaccolta),
          fetchAll(svc.Tariffa, { direzione: 'PASSIVA' }),
          fetchAll(svc.Fornitore, { stato: 'attivo' }),
        ]);
        const nomeMese = Object.keys(MESI_PASSIVA).find(k => MESI_PASSIVA[k] === mese - 1 && k.length > 3) || String(mese);
        const passiva = calcolaPassivaMese(
          { primarieRete, primarieAci, secondarieAll, extraRaccoltaAll, tariffeAll, fornitoriAll },
          anno, mese - 1, nomeMese, canale,
        );
        quadratura = quadraturaPassiva(report, passiva);
        quadratura.mese_passiva = nomeMese;
      }
    }

    return Response.json({ report, quadratura });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
