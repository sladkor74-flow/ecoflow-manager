import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { soloAmministratore } from "../../shared/permessi.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { registraModifiche, notaTraccia } from "../../shared/campiTracciati.ts";
import { utenteDellaRichiesta } from "../../shared/traccia.ts";
import { pianoMesiChiusiFuori, patchChiusoFuori, rigaStoricoChiusoFuori, PRIMO_MESE_DEL_GESTIONALE } from "../../shared/chiusuraMese.ts";

// I MESI FATTURATI PRIMA DEL GESTIONALE SI SEGNANO CHIUSI (giro K8, 12/10/2026).
//
// La chiusura del mese elencava gennaio-agosto 2026 fra i mesi ancora aperti,
// tutti con «manca la chiusura dell'attiva»: l'attiva di quei mesi e' stata
// elaborata a posteriori il 18/09 e il 06/10/2026, ma le fatture si sono fatte
// fuori, perche' il gestionale e' nato a fine estate. Decisione dell'utente
// dell'11/10/2026: «si chiudili nel gestionale come se fossero già stati
// fatti». Le regole stanno in base44/shared/chiusuraMese.ts
// (pianoMesiChiusiFuori): qui si legge, si risponde col piano e, solo con la
// conferma, si scrive.
//
// Che cosa scrive: i documenti ATTIVA non superati dei mesi scelti, canale per
// canale, nello stato «chiusa» che leggono gia' Fatturazione attiva, dashboard,
// «Da gestire», chiusura del mese ed EcoTyna, con data_chiusura, chi l'ha
// registrato e la nota «chiuso fuori dal gestionale»; e una riga per documento
// nello storico delle modifiche (ModificaDato). Mai il giorno ne' il numero
// della fattura: non si sanno. Nessun documento nuovo: un canale senza
// documento resta com'e', e il piano lo dice. Si torna indietro col «Riapri»
// della Fatturazione attiva, che lascia la sua riga nelle note.
//
// Solo l'amministratore, anche per il piano (dice stati e righe dei documenti,
// mai importi). Solo i mesi prima di settembre 2026, il primo chiuso nel
// gestionale: un mese da li' in poi fa rifiutare tutta la richiesta, e non si
// scrive niente. Si puo' ripetere: un documento gia' chiuso non si tocca.
//
// Payload: { mesi: [{ anno, mese }], conferma? } - mese col nome o col numero.
// Senza conferma: true risponde il piano e non scrive. Risponde { ok, simulato,
// oggi, mesi, rifiutati, documenti, sintesi } e, dopo la scrittura, scritti e
// traccia ({ scritta, righe, motivo? }, con nota_traccia se il registro non si e'
// scritto: i documenti restano chiusi lo stesso).

// Del documento si rimanda solo come si riconosce: mai il totale.
const leggero = (d) => ({ id: d.id || null, anno: d.anno, mese: d.mese, canale: d.tipologia || null, stato_prima: d.stato });

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const { user, errore } = await soloAmministratore(base44);
    if (errore) return errore;
    const corpo = await req.json().catch(() => ({}));
    const mesi = corpo && Array.isArray(corpo.mesi) ? corpo.mesi : [];
    if (!mesi.length) return Response.json({ error: 'Indica i mesi da segnare come già chiusi.' }, { status: 400 });
    const conferma = !!corpo && corpo.conferma === true;
    const oggi = oggiRoma();
    const svc = base44.asServiceRole.entities;

    // Le letture della chiusura del mese, e solo quelle che servono a dire se
    // il mese dopo resta aperto: i documenti dell'attiva, i congelamenti (mese
    // e canale, mai il totale), l'extra raccolta (stato, fine trasporto, tipo e
    // peso, mai prezzi).
    const [documenti, chiusure, movimentiExtra] = await Promise.all([
      fetchAll(svc.DocumentoFatturazione, { tipo: 'ATTIVA' }),
      fetchAll(svc.ChiusuraPassivaMese).then(rr => rr.map(r => ({ anno: r.anno, mese: r.mese, canale: r.canale }))),
      fetchAll(svc.ExtraRaccolta).then(rr => rr.map(r => ({ stato: r.stato, trasporto_finito_il: r.trasporto_finito_il, tipo_movimento: r.tipo_movimento, peso_effettivo: r.peso_effettivo }))),
    ]);
    const piano = pianoMesiChiusiFuori({ mesi, oggi, documenti, chiusure, movimentiExtra });
    const risposta = {
      ok: true, simulato: !conferma, oggi,
      primo_mese_del_gestionale: PRIMO_MESE_DEL_GESTIONALE.etichetta,
      mesi: piano.mesi, rifiutati: piano.rifiutati,
      documenti: piano.documenti_da_chiudere.map(leggero),
      sintesi: piano.sintesi,
    };
    if (!conferma) return Response.json(risposta);
    // Con la conferma, una richiesta con un mese che non si segna non scrive
    // niente: meglio rifarla giusta che lasciarla a meta'.
    if (piano.rifiutati.length) {
      return Response.json({ ...risposta, ok: false, error: piano.rifiutati.map(r => r.perche).join(' ') }, { status: 400 });
    }

    const utente = utenteDellaRichiesta(user);
    const quando = new Date().toISOString();
    const scritti = [];
    let fermato = null;
    for (const d of piano.documenti_da_chiudere) {
      try {
        await svc.DocumentoFatturazione.update(d.id, patchChiusoFuori(d, { utente, quando, giorno: oggi }));
        scritti.push(d);
      } catch (e) {
        fermato = e && e.message ? e.message : String(e);
        break;
      }
    }
    // Lo storico registra quelli scritti davvero, anche se ci si e' fermati a
    // meta': sono chiusi, e lo deve sapere.
    const traccia = await registraModifiche(svc, scritti.map(d => rigaStoricoChiusoFuori(d, { utente, il: quando })));
    const nota = notaTraccia(traccia);
    const fatto = { ...risposta, simulato: false, scritti: scritti.length, documenti: scritti.map(leggero), traccia, ...(nota ? { nota_traccia: nota } : {}) };
    if (fermato) {
      return Response.json({ ...fatto, ok: false, error: `Mi sono fermato dopo ${scritti.length} di ${piano.documenti_da_chiudere.length} documenti: ${fermato}. Quelli segnati restano chiusi; rilancia per gli altri.` }, { status: 500 });
    }
    return Response.json(fatto);
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
