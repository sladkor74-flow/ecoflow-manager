// Salvataggio dell'esito di una verifica di report settimanale, riconfronto con i
// dati di adesso e alert sulle dichiarazioni di "nessuna movimentazione".
//
// E l'alert dei formulari da registrare. Una verifica che trova nel report un
// formulario di una settimana precedente che nel gestionale non risulta ha
// trovato la cosa piu' grave che ci sia: il report della sua settimana non lo
// conteneva, quindi nessuno l'ha mai visto, e il termine per registrarlo - dieci
// giorni dalla partenza, domeniche escluse - sta scadendo. Scritto in fondo a una
// scheda che si apre una volta non serve a niente: va negli Alert del modulo
// Verifiche, e si chiude da solo quando il formulario risulta registrato.
//
// Un impianto a volte non manda il report e scrive nell'email che nella settimana
// non ci sono state movimentazioni. La dichiarazione si registra come una verifica
// senza righe: se nel gestionale risultano formulari, la dichiarazione e' smentita
// e si apre un alert. L'alert si chiude da solo quando i dati la confermano o
// quando arriva il report vero.
//
// Un esito non si calcola una volta per tutte: il report di un impianto verificato
// prima che si caricassero le primarie della sua settimana risultava "formulario
// non presente nel gestionale" anche dopo il caricamento, finche' qualcuno non
// ripeteva la verifica a mano. ricontrollaVerifiche rifa' il confronto sulle righe
// gia' lette, dopo ogni caricamento e all'apertura della settimana.
//
// Vale anche per le regole che cambiano. Il 22/09/2026 un formulario registrato
// senza una data obbligatoria (immissione, inizio o fine trasporto) e' diventato
// un'anomalia del suo canale invece di una rettifica a nostra cura: le verifiche
// salvate prima hanno un esito diverso da quello di adesso, e il confronto dei
// testi (testoEsito) le riscrive da solo al primo riconfronto, senza toccare
// quelle a cui non manca niente.

import { verificaReport, senzaFineDei, CATEGORIE_MOVIMENTO } from "./reportSettimanali.ts";
import { statoTermine, testoScadenza, GIORNI_TERMINE_REGISTRAZIONE } from "./termineRegistrazione.ts";
import { valoreCampo, leggiCampo, precaricaParti } from "./testoLungo.ts";
import { formatoKg } from "./formato.ts";
import { oggiRoma } from "./giornoItaliano.ts";

export const REGOLA_DICHIARAZIONE = 'verifica_nessuna_movimentazione';
export const REGOLA_ARRETRATI = 'verifica_formulari_da_registrare';

export const eDichiarazione = (v) => v && v.file_tipo === 'dichiarazione';

const chiaveAlert = (v) => `${v.anno}-S${String(v.settimana).padStart(2, '0')}-${v.soggetto_chiave}`;
const it = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');

// Piu' verifiche riscritte una dopo l'altra possono incontrare il limite di
// richieste della piattaforma: si riprova dopo una pausa crescente.
const ATTESE_RITENTATIVO = [5000, 12000, 25000];
export async function conRitentativi(fn) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const messaggio = String(e && e.message ? e.message : e);
      if (!/rate limit|too many requests|429/i.test(messaggio) || i >= ATTESE_RITENTATIVO.length) throw e;
      await new Promise(r => setTimeout(r, ATTESE_RITENTATIVO[i]));
    }
  }
}

/**
 * Esito della verifica: confronto con i movimenti e campi da salvare.
 * senzaFine sono i terminati senza fine trasporto (caricaMovimenti): se non si
 * passano, valgono quelli letti insieme ai movimenti.
 */
export function calcolaEsito(verifica, righe, movimenti, senzaFine = senzaFineDei(movimenti), lettura = null) {
  const esito = verificaReport(righe, movimenti, {
    chiave: verifica.soggetto_chiave,
    nome: verifica.soggetto_nome,
    inizio: String(verifica.data_inizio).slice(0, 10),
    fine: String(verifica.data_fine).slice(0, 10),
    senzaFine,
    // La lettura salvata dice quali colonne di data aveva il file: al riconfronto
    // il file non si rilegge, e senza le colonne la data di una riga si
    // indovinerebbe dalle righe stesse (vedi riparaDateRighe).
    lettura,
  });
  return esito;
}

/**
 * Una verifica da riconfrontare: completata, oppure rimasta senza esito con le
 * righe del report gia' lette - il confronto rinviato perche' un archivio si
 * stava riscrivendo, o non riuscito dopo la lettura. Il riconfronto dopo il
 * caricamento e all'apertura della settimana la completa senza rileggere il file.
 */
// Una verifica ALLEGGERITA non si riconfronta mai piu': non ha piu' le righe del
// report, e non e' solo che il confronto non si puo' rifare. Una dichiarazione di
// nessuna movimentazione non ha righe per definizione, quindi senza questa
// esclusione si riconfronterebbe eccome, e salvaEsito le riscriverebbe l'esito per
// intero: il dettaglio che si era appena tolto tornerebbe in archivio, sopra un
// record che resta segnato come alleggerito.
export const daRiconfrontare = (v) => !!v && !v.alleggerito_il && (v.stato === 'completata'
  || (v.stato === 'errore' && (eDichiarazione(v) || !!v.righe_report_json)));

// Il testo dell'esito cosi' come si salva: serve anche a capire se un nuovo
// confronto cambia qualcosa rispetto a quello salvato.
// nota_date entra nell'esito salvato: e' una lettura che cambia il significato di
// una data, e va scritta dove la scheda la legge. Ci sta anche perche' cambiandola
// l'esito risulta cambiato e si risalva, invece di restare la nota di ieri.
const testoEsito = (esito) => JSON.stringify({
  esiti: esito.esiti, assenti: esito.assenti, escluse: esito.escluse, quadratura: esito.quadratura,
  ...(esito.nota_date ? { nota_date: esito.nota_date, date_da_inizio: esito.date_da_inizio } : {}),
});

/**
 * Scrive esito e riepilogo sulla verifica, poi aggiorna l'alert della dichiarazione.
 *
 * Ingressi, uscite e pesi complessivi non si scrivono piu': sommavano rete, ACI
 * ed extra raccolta in un numero solo. Formulari e chili stanno nella quadratura
 * dell'esito, per movimentazione e canale, e da li' li leggono pagina e PDF.
 */
export async function salvaEsito(base44, verifica, esito, riprova = (fn) => fn()) {
  const id = verifica.id;
  const verificata_il = new Date().toISOString();
  await riprova(async () => base44.asServiceRole.entities.VerificaReport.update(id, {
    stato: 'completata',
    esito_json: await valoreCampo(base44, 'VerificaReport', id, 'esito_json', testoEsito(esito)),
    ...esito.riepilogo,
    verificata_il,
    errore: '',
  }));
  await riprova(() => aggiornaAlertDichiarazione(base44, verifica, esito));
  await riprova(() => aggiornaAlertArretrati(base44, verifica, esito));
  return verificata_il;
}

/**
 * I formulari che la verifica ha trovato nel report e che nel gestionale non
 * risultano, quando non c'e' piu' tempo da perdere: quelli di una settimana
 * precedente - il report della loro settimana non li conteneva, quindi nessuno
 * li ha mai visti - e quelli il cui termine di registrazione e' scaduto o sta
 * per scadere, qualunque settimana sia.
 *
 * Il termine e' di dieci giorni dalla partenza, domeniche escluse
 * (termineRegistrazione.ts). statoTermine si calcola qui e non si salva: dipende
 * da che giorno e' oggi.
 */
export function arretratiDaSegnalare(esito, oggi) {
  return (esito.esiti || []).filter(e => e && e.esito === 'non_trovata'
    && (e.fuori_settimana || (e.termine && e.termine.scadenza && (statoTermine(e.termine.scadenza, oggi) || {}).stato !== 'nei_termini')));
}

/**
 * L'alert dei formulari da registrare. Un elenco in fondo a una scheda non
 * basta: la verifica si apre una volta e poi non la guarda piu' nessuno, mentre
 * il termine scade. Questo finisce negli Alert del modulo Verifiche, dove si
 * guarda ogni giorno, e si chiude da solo quando i formulari risultano
 * registrati e la verifica si riconfronta (regola 2).
 */
async function aggiornaAlertArretrati(base44, verifica, esito) {
  const Alert = base44.asServiceRole.entities.Alert;
  const record_id = chiaveAlert(verifica);
  const aperti = await Alert.filter({ regola_id: REGOLA_ARRETRATI, record_id, stato: 'aperto' }, 'id', 100);
  const giorno = oggiRoma();
  const righe = arretratiDaSegnalare(esito, giorno);
  const oggi = it(giorno);

  if (!righe.length) {
    for (const a of aperti) await Alert.update(a.id, { stato: 'risolto', risolto_note: `Chiuso automaticamente il ${oggi}: nella verifica non restano formulari da registrare` });
    return;
  }

  const stato = (e) => (e.termine ? (statoTermine(e.termine.scadenza, giorno) || {}).stato : '');
  const scaduti = righe.filter(e => stato(e) === 'scaduto');
  const settimane = [...new Set(righe.filter(e => e.fuori_settimana && e.fuori_settimana.arretrata).map(e => e.fuori_settimana.settimana))].sort((x, y) => x - y);
  const dallArrivo = righe.some(e => e.termine && e.termine.partenza_da === 'report_arrivo');
  const quanti = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;

  const elenco = righe.slice(0, 30).map(e => {
    const r = e.report || {};
    const giornoRiga = (e.termine && e.termine.partenza) || r.fine || r.data || '';
    const dove = e.fuori_settimana ? `, settimana ${e.fuori_settimana.settimana}` : `, settimana ${verifica.settimana}`;
    // La scadenza e non "scaduto da N giorni": questo testo resta scritto
    // nell'alert e verrebbe riletto fra una settimana.
    const t = e.termine ? `. ${testoScadenza(e.termine.scadenza)}${stato(e) === 'scaduto' ? ', superato' : ''}` : '';
    return `- ${r.fir || 'riga senza formulario'}${r.ordine ? ` (ordine ${r.ordine})` : ''}, ${formatoKg(r.kg || 0)} kg del ${it(String(giornoRiga))}${dove}${t}`;
  });
  if (righe.length > elenco.length) elenco.push(`- e altri ${righe.length - elenco.length}`);

  const dati = {
    titolo: scaduti.length
      ? `${verifica.soggetto_nome}: ${quanti(scaduti.length, 'formulario', 'formulari')} oltre il termine di registrazione, comparsi nel report della settimana ${verifica.settimana}`
      : `${verifica.soggetto_nome}: ${quanti(righe.length, 'formulario', 'formulari')} da registrare, dal report della settimana ${verifica.settimana}`,
    descrizione: [
      settimane.length
        ? `Nel report della settimana ${verifica.settimana} compaiono carichi di ${settimane.length === 1 ? `una settimana precedente (la ${settimane[0]})` : `settimane precedenti (${settimane.join(', ')})`} che nel gestionale non risultano: il report di quella settimana non li conteneva, quindi la sua verifica non li ha mai visti.`
        : `Nel report della settimana ${verifica.settimana} ci sono formulari che nel gestionale non risultano e il cui termine di registrazione e' scaduto o sta per scadere.`,
      'Da caricare a portale e da segnalare all\'ufficio registrazioni:',
      ...elenco,
      `Il termine per la registrazione e' di ${GIORNI_TERMINE_REGISTRAZIONE} giorni dalla data di partenza, domeniche escluse.`,
      ...(dallArrivo ? ['Per alcune righe il report non porta la data di partenza: il termine e\' contato dalla data di arrivo del carico, quindi quello vero scade prima.'] : []),
    ].join('\n'),
    severita: scaduti.length || settimane.length ? 'critico' : 'warning',
    modulo: 'verifiche',
    entity_type: 'VerificaReport',
    record_id,
    regola_id: REGOLA_ARRETRATI,
    regola_nome: 'Formulari del report non registrati, con il termine di registrazione a rischio',
    stato: 'aperto',
    quanti: righe.length,
  };
  if (aperti.length) {
    await Alert.update(aperti[0].id, dati);
    for (const a of aperti.slice(1)) await Alert.update(a.id, { stato: 'risolto', risolto_note: `Chiuso automaticamente il ${oggi}: doppione` });
  } else {
    await Alert.create(dati);
  }
}

async function aggiornaAlertDichiarazione(base44, verifica, esito) {
  const Alert = base44.asServiceRole.entities.Alert;
  const record_id = chiaveAlert(verifica);
  const aperti = await Alert.filter({ regola_id: REGOLA_DICHIARAZIONE, record_id, stato: 'aperto' }, 'id', 100);
  const oggi = it(oggiRoma());
  const smentita = eDichiarazione(verifica) && esito.riepilogo.conformita !== 'piena';

  if (!smentita) {
    const nota = eDichiarazione(verifica)
      ? `Chiuso automaticamente il ${oggi}: nel gestionale non risultano movimentazioni, la dichiarazione e' confermata`
      : `Chiuso automaticamente il ${oggi}: e' arrivato il report dell'impianto, la verifica prosegue sul report`;
    for (const a of aperti) await Alert.update(a.id, { stato: 'risolto', risolto_note: nota });
    return;
  }

  // Formulari e chili si dicono per movimentazione e canale, mai in un totale:
  // "5 formulari" con dentro tre di rete e due ACI e' un conteggio che somma i canali.
  const righe = esito.quadratura
    .filter(q => q.formulari_gestionale > 0)
    .map(q => `${q.nome}: ${q.formulari_gestionale} ${q.formulari_gestionale === 1 ? 'formulario' : 'formulari'}, ${formatoKg(q.kg_gestionale)} kg`);
  const tutti = esito.assenti || [];
  // Un formulario registrato senza una data obbligatoria lo dice accanto (22/09/2026).
  const elenco = tutti.slice(0, 30).map(a => `- ${a.fir}${a.ordine ? ` (ordine ${a.ordine})` : ''}, ${formatoKg(a.kg)} kg del ${it(String(a.fine))}${a.date_testo ? `. ${a.date_testo}` : ''}`);
  if (tutti.length > elenco.length) elenco.push(`- e altri ${tutti.length - elenco.length}`);
  const dati = {
    titolo: `${verifica.soggetto_nome}: dichiarata nessuna movimentazione nella settimana ${verifica.settimana}, ma risultano formulari registrati`,
    descrizione: [
      `L'impianto ha comunicato che dal ${it(String(verifica.data_inizio))} al ${it(String(verifica.data_fine))} non ci sono state movimentazioni${verifica.nota ? ` (${verifica.nota})` : ''}.`,
      'Nel gestionale risultano, per movimentazione e canale:',
      ...righe.map(r => `- ${r}`),
      ...(elenco.length ? ['Formulari registrati:', ...elenco] : []),
      'Chiedere all\'impianto il report della settimana o una rettifica della comunicazione.',
    ].join('\n'),
    severita: 'critico',
    modulo: 'verifiche',
    entity_type: 'VerificaReport',
    record_id,
    regola_id: REGOLA_DICHIARAZIONE,
    regola_nome: 'Dichiarazione di nessuna movimentazione smentita dai dati',
    stato: 'aperto',
  };
  if (aperti.length) {
    await Alert.update(aperti[0].id, dati);
    for (const a of aperti.slice(1)) await Alert.update(a.id, { stato: 'risolto', risolto_note: `Chiuso automaticamente il ${oggi}: doppione` });
  } else {
    await Alert.create(dati);
  }
}

/**
 * Rifa' il confronto delle verifiche completate con i movimenti di adesso: le
 * dichiarazioni di nessuna movimentazione e i report veri, sulle righe gia'
 * lette dal file (righe_report_json), senza rileggere niente e senza agente.
 * Completa anche quelle rimaste senza esito con le righe gia' lette
 * (daRiconfrontare), come un confronto rinviato durante un caricamento.
 *
 * Si scrive solo se l'esito cambia, e solo con scrivi: chi guarda la settimana
 * senza essere amministratore vede l'esito rifatto ma non lo salva.
 *
 * senzaFine: i terminati senza fine trasporto; se non si passano, quelli letti
 * da caricaMovimenti insieme ai movimenti.
 *
 * Restituisce, per ogni verifica riconfrontata, { id, soggetto_chiave, cambiato,
 * salvato, campi } (i campi del riepilogo di adesso) oppure { id, errore }.
 */
export async function ricontrollaVerifiche(base44, verifiche, movimenti, { scrivi = true, riprova = conRitentativi, senzaFine = senzaFineDei(movimenti) } = {}) {
  const risultati = [];
  // Le righe e gli esiti salvati di tutte le verifiche, in blocco: una lettura
  // per verifica e per campo pesava sul limite di richieste della piattaforma.
  // Anche lettura_json: dice quali colonne di data aveva il file, e senza quelle la
  // data di una riga si indovina. Non costa una richiesta in piu' - precaricaParti
  // chiede i campi insieme, a gruppi di venti record.
  await precaricaParti(base44, 'VerificaReport', verifiche.filter(daRiconfrontare), ['righe_report_json', 'esito_json', 'lettura_json']);
  for (const v of verifiche) {
    if (!daRiconfrontare(v)) continue;
    const dichiarazione = eDichiarazione(v);
    if (!dichiarazione && !v.righe_report_json) continue;
    try {
      const righe = dichiarazione ? [] : JSON.parse((await riprova(() => leggiCampo(base44, 'VerificaReport', v, 'righe_report_json'))) || '[]');
      let lettura = null;
      // Una lettura che non si ricompone non ferma il riconfronto: si torna a
      // decidere dalle righe, che e' quello che si faceva prima.
      try { if (v.lettura_json) lettura = JSON.parse((await riprova(() => leggiCampo(base44, 'VerificaReport', v, 'lettura_json'))) || 'null'); } catch { /* decidono le righe */ }
      const esito = calcolaEsito(v, righe, movimenti, senzaFine, lettura);
      // Un esito salvato che non si ricompone (parti doppie o mancanti) non e'
      // un errore della verifica: si riscrive, e valoreCampo cancella tutte le
      // parti del campo prima di rifarle. Lanciato, lasciava la verifica fra gli
      // errori a ogni riconfronto, senza ripararsi mai.
      let prima = '';
      try { prima = await riprova(() => leggiCampo(base44, 'VerificaReport', v, 'esito_json')); } catch { /* si riscrive */ }
      const firma = (lista) => (Array.isArray(lista) ? lista.map(c => `${c.canale}:${c.conformita}:${c.anomalie}:${c.assenti}`).join('|') : '');
      // Una verifica senza esito si salva comunque: e' li' che si completa.
      const cambiato = v.stato !== 'completata' || testoEsito(esito) !== prima || esito.riepilogo.conformita !== v.conformita
        || firma(esito.riepilogo.per_canale) !== firma(v.per_canale);
      const campi = { ...esito.riepilogo, stato: 'completata', errore: '' };
      let salvato = false;
      if (cambiato && scrivi) {
        campi.verificata_il = await salvaEsito(base44, v, esito, riprova);
        salvato = true;
      }
      risultati.push({ id: v.id, soggetto_chiave: v.soggetto_chiave, cambiato, salvato, campi });
    } catch (e) {
      risultati.push({ id: v.id, soggetto_chiave: v.soggetto_chiave, errore: e && e.message ? e.message : String(e) });
    }
  }
  return risultati;
}

/**
 * Di ogni soggetto e settimana la verifica piu' recente (per created_date): le
 * altre sono state sostituite da un report o da una dichiarazione successivi e
 * restano solo finche' un amministratore non apre la settimana. Riconfrontate,
 * una dichiarazione ormai sostituita dal report riapriva l'alert "dichiarata
 * nessuna movimentazione", e che restasse aperto dipendeva dall'ordine di arrivo.
 */
export function piuRecentiPerSoggetto(verifiche) {
  const perChiave = new Map();
  for (const v of verifiche || []) {
    const k = `${v.anno}-${v.settimana}-${v.soggetto_chiave}`;
    const gia = perChiave.get(k);
    if (!gia || String(v.created_date || '') > String(gia.created_date || '')) perChiave.set(k, v);
  }
  return [...perChiave.values()];
}

export { CATEGORIE_MOVIMENTO };
