import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { eAmministratore, rispostaSolaLettura } from "../../shared/permessi.ts";
import { TIPI_GIACENZE } from "../../shared/registroCaricamenti.ts";
import { controlloCaricamenti } from "../../shared/statoArchivi.ts";
import { VOCI_INVARIANTI, FONTI, fontiDelleVoci, verificaInvarianti, unisciInvarianti, leggiInvarianti, riportaRotte, eRotta, motiviNonVerificate, anniDaControllare, unisciAnni } from "../../shared/invarianti.ts";
import { conBattito, messaggioErrore } from "../../shared/battito.ts";

// IL CONTROLLO DELLE IDENTITA' FRA MODULI (chiusura dell'audit, 11/10/2026).
//
// Il passo del guardiano notturno che viene dopo la fotografia del giorno
// (base44/workflows/GuardianoNotturno.jsonc): chiede i numeri alle funzioni vere
// dei moduli - calcolaGiacenze, riepilogoDichiarazioni, getDashboardRaccolta, come
// lo strumento delle giacenze di EcoTyna - e li confronta col catalogo di
// shared/invarianti.ts. L'esito va nella riga di oggi di IndicatoreGiorno
// (invarianti_json), e la dashboard dice un'identita' rotta coi due numeri e i
// due moduli (shared/presidi.ts).
//
// Tre prudenze, le stesse della fotografia:
// - scrive solo l'amministratore (il lavoro notturno gira come lui); agli altri la
//   funzione risponde «sola lettura» senza chiedere niente a nessuno, perche' le
//   tre funzioni che chiama rileggono tutti gli archivi dei movimenti;
// - nessun anno negli argomenti: vale quello in corso, cosi' il 1° gennaio passa
//   da se'; e a gennaio e febbraio anche l'anno prima, che si sta ancora
//   chiudendo (15/10/2026, prova generale del cambio d'anno, difetto 27: dal
//   01/01/2027 un'identita' rotta del 2026 spariva mentre i due moduli dicevano
//   ancora due numeri diversi). La fotografia resta una per giorno, coi casi dei
//   due anni insieme, e ogni caso dice il suo anno (anniDaControllare,
//   unisciAnni in shared/invarianti.ts);
// - con un caricamento in corso, interrotto o non riuscito di un archivio che
//   quei moduli leggono (TIPI_GIACENZE) non si confronta niente: due moduli letti
//   su un archivio a meta' direbbero numeri diversi che non lo sono. Risponde 409
//   «rinviato» col motivo, prima e dopo aver chiesto i numeri.
// La riga di oggi la scrive la fotografia: se non c'e' (il guardiano e' stato
// rinviato o non e' riuscito) qui non se ne crea una mezza, che la dashboard
// leggerebbe come una fotografia di stanotte senza numeri. Lo si dice, e il
// battito di questo lavoro risulta non riuscito.
//
// Payload: { voci?: [id] } per controllare solo alcune voci (un passo del
// workflow per gruppo, se un giorno i tempi lo chiederanno); l'esito si unisce a
// quello gia' scritto oggi.

// Quante fotografie dei giorni prima si guardano per sapere com'era una voce che
// stanotte non si e' potuta verificare (revisione delle migliorie, 11/10/2026):
// un mese. Una rotta piu' vecchia arriva lo stesso, perche' ogni notte che non la
// riverifica la riporta nella sua riga; e se il controllo non scrive da piu' di
// un mese, lo dice gia' il suo battito.
const GIORNI_INDIETRO = 31;

async function controlla(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!eAmministratore(user)) return rispostaSolaLettura();
    const corpo = await req.json().catch(() => ({}));
    const oggi = oggiRoma();
    const anno = Number(oggi.slice(0, 4));
    const chieste = Array.isArray(corpo.voci) && corpo.voci.length ? VOCI_INVARIANTI.filter(v => corpo.voci.includes(v.id)) : VOCI_INVARIANTI;
    if (!chieste.length) return Response.json({ error: `Nessuna voce del catalogo si chiama ${corpo.voci.join(', ')}.` }, { status: 400 });

    const controllo = await controlloCaricamenti(base44, "il controllo delle identità fra moduli", TIPI_GIACENZE,
      (motivo) => ({ invarianti: { scritte: false, rinviate: true, motivo } }));
    if (controllo.rinvio) return controllo.rinvio;

    const svc = base44.asServiceRole.entities;
    const righe = (await svc.IndicatoreGiorno.filter({ giorno: oggi })) || [];
    if (!righe.length) {
      return Response.json({
        giorno: oggi, anno,
        invarianti: { scritte: false, motivo: `la fotografia del giorno (${oggi.split('-').reverse().join('/')}) non c'è: il guardiano notturno non l'ha scritta, e le identità si scrivono nella sua riga` },
      });
    }

    // I numeri dalle funzioni vere, tutte insieme: una che non risponde non ferma
    // le altre, e le voci che ne avevano bisogno restano non verificate col motivo.
    // A gennaio e febbraio gli anni sono due: le stesse fonti, per ciascuno.
    const fonti = fontiDelleVoci(chieste);
    const anni = anniDaControllare(oggi);
    const chiamate = anni.flatMap(a => fonti.map(f => ({ a, f })));
    const risposte = await Promise.allSettled(chiamate.map(({ a, f }) => base44.functions.invoke(FONTI[f].funzione, FONTI[f].corpo(a))));
    const perAnno = new Map(anni.map(a => [a, { dati: {}, errori: {} }]));
    chiamate.forEach(({ a, f }, i) => {
      const { dati, errori } = perAnno.get(a);
      const r = risposte[i];
      if (r.status !== 'fulfilled') { errori[f] = messaggioErrore(r.reason); return; }
      const d = r.value && r.value.data !== undefined ? r.value.data : r.value;
      if (d && typeof d === 'object' && !d.error) dati[f] = d;
      else errori[f] = (d && d.error) || 'risposta vuota';
    });

    const rinvio = await controllo.dopo();
    if (rinvio) return rinvio;

    const il = new Date().toISOString();
    const nuovo = unisciAnni(anni.map(a => ({
      anno: a,
      esito: verificaInvarianti(perAnno.get(a).dati, { errori: perAnno.get(a).errori, voci: chieste, giorno: oggi, anno: a, il }),
    })));
    const giaScritto = leggiInvarianti(righe[0].invarianti_json);
    let esito = unisciInvarianti(giaScritto, nuovo);
    // UNA ROTTA NON SPARISCE PERCHE' STANOTTE NON SI E' POTUTA RIVERIFICARE
    // (revisione delle migliorie, 11/10/2026): per le voci non verificate si
    // guarda com'erano all'ultima verifica (riportaRotte, invarianti.ts). Si
    // legge solo quando serve, cioe' quando una fonte non ha risposto: le righe
    // dei giorni prima dello stesso anno, poche e piccole.
    // La prima da guardare e' l'esito gia' scritto oggi, da un controllo di
    // qualche ora fa: rilanciato lo stesso giorno con una fonte muta, il
    // controllo perdeva la rotta trovata alle 5 (riportaRotte la accetta perche'
    // il suo istante viene prima di questo).
    if (esito.voci.some(v => !v.verificata)) {
      const prima = await svc.IndicatoreGiorno.filter({ anno }, '-giorno', GIORNI_INDIETRO).catch(() => []);
      const deiGiorniPrima = (prima || []).filter(r => r && r.giorno && r.giorno < oggi).map(r => leggiInvarianti(r.invarianti_json));
      esito = riportaRotte(esito, [giaScritto, ...deiGiorniPrima].filter(Boolean));
    }
    const nonVerificate = esito.voci.filter(v => !v.verificata);
    const riassunto = {
      esito: esito.esito,
      nota: esito.nota,
      rotte: esito.voci.filter(eRotta).map(v => ({ id: v.id, moduli: v.moduli, a: v.a, b: v.b, dettaglio: v.dettaglio, ...(v.verificata ? {} : { rotta_il: v.rotta_il, non_riverificata: true }) })),
      non_verificate: nonVerificate.length,
      // Diventa l'errore del battito, e la dashboard lo mostra: in italiano, coi
      // nomi dei moduli e delle voci, non con gli identificativi.
      motivi: motiviNonVerificate(nonVerificate),
    };
    try {
      await svc.IndicatoreGiorno.update(righe[0].id, { invarianti_json: JSON.stringify(esito) });
    } catch (e) {
      return Response.json({ giorno: oggi, anno, invarianti: { ...riassunto, scritte: false, motivo: `l'esito non si è potuto scrivere: ${messaggioErrore(e)}` }, voci: esito.voci });
    }
    return Response.json({ giorno: oggi, anno, invarianti: { ...riassunto, scritte: true }, voci: esito.voci });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}

// IL BATTITO (11/10/2026): ogni giro lascia il suo esito in EsecuzioneLavoro
// (shared/battito.ts), anche quando non riesce; la risposta resta quella di sopra.
export default async function(req) {
  return conBattito(() => conLimiteRichieste(createClientFromRequest(req)), 'controllaInvarianti', () => controlla(req), req);
}
