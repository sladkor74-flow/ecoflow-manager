import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { eAmministratore } from "../../shared/permessi.ts";
import { predittivitaDellAnno, annoInCorso } from "../../shared/predittivitaRisposta.ts";

// La proiezione delle secondarie a fine programmazione, per chi la chiama
// ancora con questo nome (lo strumento proiezione_secondarie di EcoTyna).
//
// Dal 26/09/2026 non ha piu' un conto suo: e' la stessa risposta di
// calcolaPianificazioneSecondaria, dal motore unico (base44/shared/predittivita.ts).
// Prima la proiezione divideva il residuo per mesi interi e la Dashboard
// ripartiva il plafond degli stoccaggi: per lo stesso impianto uscivano 97 viaggi
// da una parte e 54 dall'altra. Ora le proiezioni sono due affiancate - sul
// target dei raccoglitori e sul ritmo reale - con la prudente su cui si
// programma, e sono le stesse ovunque.
//
// Corpo: { anno? }  l'anno in corso se manca; un anno chiuso si guarda com'era
// al 31 dicembre, in sola lettura. Non scrive niente.

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const letto = await req.json().catch(() => ({}));
    const body = letto && typeof letto === 'object' ? letto : {};
    const annoCorrente = annoInCorso();
    let anno = annoCorrente;
    if (body.anno !== undefined && body.anno !== null && body.anno !== '') {
      anno = Number(body.anno);
      if (!Number.isInteger(anno) || anno < 2000) return Response.json({ error: `"${body.anno}" non e' un anno valido.` }, { status: 400 });
      if (anno > annoCorrente) return Response.json({ error: `Il ${anno} non e' ancora cominciato: si puo' guardare l'anno in corso (${annoCorrente}) o un anno chiuso.` }, { status: 400 });
    }
    const { risposta } = await predittivitaDellAnno(base44, { anno, puoFissare: eAmministratore(user) });
    return Response.json(risposta);
  } catch (error) {
    return Response.json({ error: `Il calcolo della predittivita' non e' riuscito: ${error && error.message ? error.message : String(error)}` }, { status: 500 });
  }
}
