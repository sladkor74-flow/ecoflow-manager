import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { leggiRegistro } from "../../shared/registroCaricamenti.ts";
import { datiFinoAl, finoAlPerTipo } from "../../shared/statoArchivi.ts";
import { freschezzaArchivi } from "../../shared/cruscotto.ts";
import { leggiFotografia } from "../../shared/indicatoriGiorno.ts";
import { meseDaChiudere, chiusuraDelMese, mesiAncoraAperti, FILE_DEL_MESE, PRIMO_MESE_DEL_GESTIONALE } from "../../shared/chiusuraMese.ts";

// LA CHIUSURA DEL MESE, PASSO PASSO (migliorie dell'11/10/2026).
//
// Per l'ultimo mese finito (o per quello chiesto) dice, passo per passo, che
// cosa e' fatto, che cosa manca, perche' serve e dove si rimedia: dati del mese,
// terminati, dichiarazioni, attiva e passiva canale per canale, quadrature FIR.
// E l'elenco dei mesi prima ancora aperti, anche dell'anno prima, che si aprono
// uno per volta chiedendo { anno, mese }. Le regole stanno in
// base44/shared/chiusuraMese.ts.
//
// POCHE LETTURE, E SOLO DI CIO' CHE I MODULI SCRIVONO GIA'. E' un'altra
// richiesta della dashboard, fatta quando si apre il pannello, e il limite di
// richieste vale per tutta l'app: si leggono archivi piccoli (documenti e
// registro delle esportazioni dell'attiva, prefattura del mese, congelamenti,
// consuntivi, quadrature, dichiarazioni dell'anno, pratica di Irigom, l'ultima
// fotografia del guardiano, gli alert aperti, il registro dei caricamenti,
// l'extra raccolta) e dei grandi solo le poche righe in stato
// «eseguito» e quelle che dicono fin dove arrivano le primarie (datiFinoAl).
// Niente conti rifatti: le primarie non si rileggono.
//
// I DOCUMENTI DELL'ATTIVA SI LEGGONO TUTTI (revisione delle migliorie,
// 11/10/2026): sono tre al mese, e il primo dice da quando il gestionale
// fattura. Un mese di prima, come dicembre 2025, non ha passi di attiva e
// passiva da chiedere. L'EXTRA RACCOLTA SI LEGGE (sette righe l'11/10/2026,
// solo stato, date e peso): un documento elaborato senza righe prima che
// arrivassero i movimenti del mese non e' «non serve».
//
// NESSUN IMPORTO ESCE DI QUI. Il pannello lo vede chiunque sia collegato, e i
// costi dei fornitori sono dell'amministratore (11/10/2026): dei congelamenti
// e dei consuntivi si passano alle regole solo stato e date, mai totale_euro o
// importo_consuntivo; delle prefatture solo il fatto che ci sono, senza righe.
//
// I MESI DI PRIMA DEL GESTIONALE (giro K8, 12/10/2026). Fra i mesi ancora
// aperti, quelli di prima di settembre 2026 portano prima_del_gestionale: si
// sono fatturati fuori, e il pannello offre all'amministratore di segnarli
// chiusi (la funzione segnaMesiChiusiFuori, che scrive; questa resta di sola
// lettura). Il primo mese chiuso nel gestionale arriva come etichetta
// (primo_mese_del_gestionale), perche' le pagine non scrivono anni.
//
// Payload: { anno?, mese? } - mese col nome ('Settembre') o col numero (9).
// Risponde { oggi, mese, passi, conteggio, sintesi, mesi_aperti,
// primo_mese_del_gestionale, letture_non_riuscite }.

// Gli archivi dei movimenti che possono avere ordini «eseguito» a portale.
const CON_ESEGUITI = { primarieRete: 'PrimariaRete', primarieAci: 'PrimariaAci', secondarie: 'Secondaria' };

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const oggi = oggiRoma();
    const scelta = meseDaChiudere({ oggi, anno: body && body.anno, mese: body && body.mese });
    if (scelta.errore) return Response.json({ error: scelta.errore }, { status: 400 });
    if (!scelta.periodo) return Response.json({ oggi, mese: null, perche: scelta.perche, passi: [], conteggio: null, sintesi: scelta.perche, mesi_aperti: [], primo_mese_del_gestionale: PRIMO_MESE_DEL_GESTIONALE.etichetta, letture_non_riuscite: [] });
    const periodo = scelta.periodo;
    const ultimo = scelta.ultimo;
    const svc = base44.asServiceRole.entities;

    // Ogni lettura per conto suo: una che cade non porta giu' le altre, e il
    // passo che ne dipende dice «non so» invece di un verde falso.
    const nonLette = [];
    const leggi = async (nome, fn, difetto) => {
      try { return await fn(); } catch { nonLette.push(nome); return difetto; }
    };
    const [documenti, chiusure, esportazioni, prefatture, consuntivi, quadrature, dichiarazioni, pratiche, foto, alert, eseguiti, logs, finoAl, movimentiExtra] = await Promise.all([
      leggi('documenti', () => fetchAll(svc.DocumentoFatturazione, { tipo: 'ATTIVA' }), []),
      // Dei congelamenti bastano mese, canale e quando: il conto e il totale
      // sono costi, e restano dove sono.
      leggi('chiusure', () => fetchAll(svc.ChiusuraPassivaMese).then(rr => rr.map(r => ({ anno: r.anno, mese: r.mese, canale: r.canale, congelato_il: r.congelato_il, congelato_da: r.congelato_da }))), []),
      leggi('esportazioni', () => fetchAll(svc.EsportazioneFatturazione, { anno: periodo.anno, mese: periodo.mese }), []),
      // Della prefattura non servono le righe del portale: solo che ci sia.
      leggi('prefatture', () => svc.PrefatturaEcotyre.filter({ anno: periodo.anno, mese: periodo.mese }).then(rr => (rr || []).map(r => ({ anno: r.anno, mese: r.mese, superata: r.superata, caricata_il: r.caricata_il, nome_file: r.nome_file }))), []),
      leggi('consuntivi', () => fetchAll(svc.ConsuntivoFornitore).then(rr => rr.map(r => ({ fornitore: r.fornitore, ruolo: r.ruolo, anno: r.anno, mese: r.mese, canale: r.canale, quadra: r.quadra, confrontato_il: r.confrontato_il }))), []),
      leggi('quadrature', () => fetchAll(svc.QuadraturaFir).then(rr => rr.map(r => ({ anno: r.anno, settimana: r.settimana, stato: r.stato, errore: r.errore, per_canale: r.per_canale, verificata_il: r.verificata_il, avviata_il: r.avviata_il, created_date: r.created_date }))), []),
      leggi('dichiarazioni', () => fetchAll(svc.DichiarazioneSito, { anno: periodo.anno }), []),
      leggi('pratiche', () => svc.PraticaIrigom.filter({ anno: periodo.anno, mese: periodo.mese }).then(rr => (rr || []).map(r => ({ anno: r.anno, mese: r.mese, stato: r.stato, versione: r.versione }))), []),
      // L'ultima fotografia del guardiano notturno: una riga sola.
      leggi('fotografia', () => svc.IndicatoreGiorno.list('-giorno', 1).then(rr => leggiFotografia((rr || [])[0] || null)), null),
      leggi('alert', () => fetchAll(svc.Alert, { stato: 'aperto' }), []),
      leggi('eseguiti', async () => Object.fromEntries(await Promise.all(Object.entries(CON_ESEGUITI)
        .map(async ([k, entita]) => [k, await fetchAll(svc[entita], { stato: 'eseguito' })]))), {}),
      // Il registro dei caricamenti, come lo leggono i motori: una lettura sola.
      leggi('registro', () => leggiRegistro(svc.UploadLog, FILE_DEL_MESE).then(perTipo => [...perTipo.values()].flat()), []),
      // Fin dove arrivano le primarie: poche righe ordinate, mai l'archivio intero.
      leggi('fino_al', () => datiFinoAl(svc, ['PrimariaRete', 'PrimariaAci']), []),
      // Dell'extra raccolta bastano stato, fine trasporto, tipo di movimento e
      // peso: prezzi e sovracosti restano dove sono. Si legge tutta, come la
      // legge l'attiva: lo stato «terminato» lo decide filtraPeriodo, che non
      // guarda maiuscole e spazi (revisione, 12/10/2026).
      leggi('movimenti_extra', () => fetchAll(svc.ExtraRaccolta)
        .then(rr => rr.map(r => ({ stato: r.stato, trasporto_finito_il: r.trasporto_finito_il, tipo_movimento: r.tipo_movimento, peso_effettivo: r.peso_effettivo }))), null),
    ]);

    const chiusura = chiusuraDelMese({
      periodo, oggi,
      freschezza: freschezzaArchivi(logs, oggi, Date.now(), FILE_DEL_MESE, finoAlPerTipo(finoAl)),
      alert, eseguiti, fotografia: foto, dichiarazioni, pratiche,
      documenti, prefatture, esportazioni, chiusure, consuntivi, quadrature,
      movimenti_extra: movimentiExtra,
      chiaveDi: normalizzaRagioneSociale,
      non_letti: nonLette,
    });
    return Response.json({
      oggi,
      ...chiusura,
      // I mesi prima dell'ultimo finito ancora aperti: si guardano dall'ultimo
      // finito dell'anno scelto, anche quando si e' chiesto un mese preciso.
      // Congelamenti non letti: null, non un elenco vuoto, cosi' l'elenco dei mesi
      // aperti non dice «manca il congelamento» di mesi che magari sono congelati.
      mesi_aperti: nonLette.includes('documenti') ? [] : mesiAncoraAperti({ ultimo, documenti, chiusure: nonLette.includes('chiusure') ? null : chiusure, movimentiExtra }),
      primo_mese_del_gestionale: PRIMO_MESE_DEL_GESTIONALE.etichetta,
      letture_non_riuscite: nonLette,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
