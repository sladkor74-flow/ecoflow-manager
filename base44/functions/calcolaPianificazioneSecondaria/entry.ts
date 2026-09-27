import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { eAmministratore, rispostaSolaLettura } from "../../shared/permessi.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { normalizzaRagioneSociale as chiave } from "../../shared/normalizzaRagioneSociale.ts";
import { lunediDi, piuGiorni } from "../../shared/predittivita.ts";
import { predittivitaDellAnno, rispostaPredittivita, fissaProgramma, annoInCorso } from "../../shared/predittivitaRisposta.ts";

// La predittivita' delle secondarie per la pagina e per l'assistente: la fonte
// unica (26/09/2026). Il conto sta tutto in base44/shared/predittivita*.ts; qui
// ci sono solo chi puo' fare che cosa e i controlli su quello che arriva.
//
// Corpo: { anno?, azione?, settimana?, righe? }
// - senza azione: la risposta di rispostaPredittivita, per l'anno in corso o per
//   l'anno chiesto. Un anno chiuso si guarda com'era al 31 dicembre, in sola
//   lettura. Aprire la pagina non scrive piu' niente: prima ogni apertura
//   dell'amministratore riscriveva il piano settimanale, e il "previsto" di una
//   settimana diventava uguale all'arrivato al primo camion.
// - azione 'fissa': l'amministratore corregge a mano i viaggi programmati di una
//   settimana, { settimana: 'AAAA-MM-GG' (lunedi'), righe: [{ stoccaggio,
//   impianto, viaggi }] }. Mai su un anno chiuso e mai su una settimana gia'
//   passata: il programmato di allora resta, per confrontarlo col fatto. Le
//   righe corrette a mano il suggerimento del mercoledi' non le tocca. Risponde
//   con la predittivita' aggiornata.

const errore = (testo, status = 400) => Response.json({ error: testo }, { status });
const it = (g) => (g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : '');

/** L'anno chiesto: quello in corso se manca; un anno che non e' ancora cominciato non si guarda. */
function annoChiesto(v, annoCorrente) {
  if (v === undefined || v === null || v === '') return { anno: annoCorrente };
  const n = Number(v);
  if (!Number.isInteger(n) || n < 2000) return { errore: `"${v}" non e' un anno valido.` };
  if (n > annoCorrente) return { errore: `Il ${n} non e' ancora cominciato: si puo' guardare l'anno in corso (${annoCorrente}) o un anno chiuso.` };
  return { anno: n };
}

/** Il lunedi' della settimana da fissare, controllato. */
function settimanaChiesta(v, anno, oggi) {
  const g = String(v || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g) || piuGiorni(g, 0) !== g) return { errore: "Manca la settimana da fissare, o non e' una data (AAAA-MM-GG)." };
  if (lunediDi(g) !== g) return { errore: `Il ${it(g)} non e' un lunedi': la settimana si indica col suo lunedi' (${it(lunediDi(g))}).` };
  if (g > `${anno}-12-31` || piuGiorni(g, 6) < `${anno}-01-01`) return { errore: `La settimana dal ${it(g)} non e' del ${anno}.` };
  if (g < lunediDi(oggi)) return { errore: `La settimana dal ${it(g)} al ${it(piuGiorni(g, 6))} e' gia' passata: il programmato di allora resta com'era, per confrontarlo col fatto.`, status: 409 };
  return { settimana: g };
}

/**
 * Le righe da fissare, controllate sui percorsi della predittivita' dell'anno
 * (stoccaggio → impianto che alimenta), con i nomi come li scrive la
 * configurazione: il programma si ritrova per nome normalizzato.
 */
function righeChieste(righe, calcolo, chi) {
  if (!Array.isArray(righe) || !righe.length) return { errore: 'Non ci sono righe da fissare: servono stoccaggio, impianto e viaggi.' };
  const nomeImpianto = new Map(calcolo.impianti.map(i => [i.chiave, i.nome]));
  const percorsi = new Map(); // stoccaggio|impianto -> { stoccaggio, impianto }
  for (const s of calcolo.stoccaggi) {
    for (const d of s.destinazioni) percorsi.set(`${s.chiave}|${d.impianto}`, { stoccaggio: s.nome, impianto: nomeImpianto.get(d.impianto) || d.impianto });
  }
  const out = [];
  const visti = new Set();
  for (const r of righe) {
    const S = chiave(r && r.stoccaggio), I = chiave(r && r.impianto);
    if (!S || !I) return { errore: 'Ogni riga deve dire lo stoccaggio e l\'impianto.' };
    const percorso = percorsi.get(`${S}|${I}`);
    if (!percorso) return { errore: `${r.stoccaggio} → ${r.impianto} non e' un percorso della predittivita' del ${calcolo.anno}: lo stoccaggio non alimenta quell'impianto, o l'impianto non e' seguito quest'anno.` };
    if (visti.has(`${S}|${I}`)) return { errore: `${percorso.stoccaggio} → ${percorso.impianto} compare due volte: scrivi i viaggi una volta sola.` };
    visti.add(`${S}|${I}`);
    const viaggi = r.viaggi === '' || r.viaggi === null || r.viaggi === undefined ? NaN : Number(r.viaggi);
    if (!Number.isInteger(viaggi) || viaggi < 0) return { errore: `I viaggi di ${percorso.stoccaggio} → ${percorso.impianto} devono essere un numero intero, da 0 in su.` };
    out.push({ ...percorso, viaggi, motivo: `Corretto a mano${chi ? ` da ${chi}` : ''} il ${it(oggiRoma())}.` });
  }
  return { righe: out };
}

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const letto = await req.json().catch(() => ({}));
    const body = letto && typeof letto === 'object' ? letto : {};
    const amministratore = eAmministratore(user);
    const annoCorrente = annoInCorso();
    const a = annoChiesto(body.anno, annoCorrente);
    if (a.errore) return errore(a.errore);
    const anno = a.anno;

    const azione = String(body.azione || '').trim();
    if (!azione) {
      const { risposta } = await predittivitaDellAnno(base44, { anno, puoFissare: amministratore });
      return Response.json(risposta);
    }
    if (azione !== 'fissa') return errore(`Azione sconosciuta: "${azione}". L'unica azione e' 'fissa', per correggere i viaggi programmati di una settimana.`);

    // --- la correzione a mano del programma ---
    if (!amministratore) return rispostaSolaLettura();
    if (anno < annoCorrente) return errore(`Il ${anno} e' chiuso: si consulta in sola lettura e il suo programma non si cambia piu'.`, 409);
    const s = settimanaChiesta(body.settimana, anno, oggiRoma());
    if (s.errore) return errore(s.errore, s.status || 400);

    const { dati, calcolo, risposta } = await predittivitaDellAnno(base44, { anno, puoFissare: true });
    const r = righeChieste(body.righe, calcolo, user.full_name || user.email || '');
    if (r.errore) return errore(r.errore);

    let esito;
    try {
      esito = await fissaProgramma(base44.asServiceRole.entities, {
        anno, settimana: s.settimana, righe: r.righe, kgPerViaggio: calcolo.kg_per_viaggio, manuale: true, esistenti: dati.programmati, impianti: dati.ingresso.impianti,
      });
    } catch (e) {
      return errore(`Il programma della settimana dal ${it(s.settimana)} non si e' salvato del tutto (${e && e.message ? e.message : e}). Ricarica la pagina per vedere quali righe sono state scritte, poi riprova.`, 500);
    }
    const fissato = { settimana: s.settimana, scritte: esito.scritte };

    // La risposta aggiornata: i numeri sono gli stessi, cambia solo il programma
    // fissato, che si rilegge (una richiesta, invece di rifare tutto il conto).
    try {
      const programmati = await base44.asServiceRole.entities.PianificazioneSettimanale.filter({ anno }, 'data_inizio', 2000);
      const nuova = rispostaPredittivita({ dati: { ...dati, programmati }, calcolo, anno, oggi: risposta.oggi, solaLettura: false, puoFissare: true });
      return Response.json({ ...nuova, fissato });
    } catch (e) {
      const avviso = { tipo: 'programma_non_riletto', testo: "Il programma e' stato salvato, ma non si e' potuto rileggere: ricarica la pagina per vederlo." };
      return Response.json({ ...risposta, avvisi: [avviso, ...risposta.avvisi], fissato });
    }
  } catch (error) {
    return Response.json({ error: `Il calcolo della predittivita' non e' riuscito: ${error && error.message ? error.message : String(error)}` }, { status: 500 });
  }
}
