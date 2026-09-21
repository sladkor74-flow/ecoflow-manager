// Salvataggio dell'esito di una verifica di report settimanale, riconfronto con i
// dati di adesso e alert sulle dichiarazioni di "nessuna movimentazione".
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

import { verificaReport, CATEGORIE_MOVIMENTO } from "./reportSettimanali.ts";
import { valoreCampo, leggiCampo } from "./testoLungo.ts";
import { formatoKg } from "./formato.ts";
import { oggiRoma } from "./giornoItaliano.ts";

export const REGOLA_DICHIARAZIONE = 'verifica_nessuna_movimentazione';

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

/** Esito della verifica: confronto con i movimenti e campi da salvare. */
export function calcolaEsito(verifica, righe, movimenti) {
  const esito = verificaReport(righe, movimenti, {
    chiave: verifica.soggetto_chiave,
    nome: verifica.soggetto_nome,
    inizio: String(verifica.data_inizio).slice(0, 10),
    fine: String(verifica.data_fine).slice(0, 10),
  });
  return esito;
}

// Il testo dell'esito cosi' come si salva: serve anche a capire se un nuovo
// confronto cambia qualcosa rispetto a quello salvato.
const testoEsito = (esito) => JSON.stringify({
  esiti: esito.esiti, assenti: esito.assenti, escluse: esito.escluse, quadratura: esito.quadratura,
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
  return verificata_il;
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
  const elenco = tutti.slice(0, 30).map(a => `- ${a.fir}${a.ordine ? ` (ordine ${a.ordine})` : ''}, ${formatoKg(a.kg)} kg del ${it(String(a.fine))}`);
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
 *
 * Si scrive solo se l'esito cambia, e solo con scrivi: chi guarda la settimana
 * senza essere amministratore vede l'esito rifatto ma non lo salva.
 *
 * Restituisce, per ogni verifica riconfrontata, { id, soggetto_chiave, cambiato,
 * salvato, campi } (i campi del riepilogo di adesso) oppure { id, errore }.
 */
export async function ricontrollaVerifiche(base44, verifiche, movimenti, { scrivi = true, riprova = conRitentativi } = {}) {
  const risultati = [];
  for (const v of verifiche) {
    if (!v || v.stato !== 'completata') continue;
    const dichiarazione = eDichiarazione(v);
    if (!dichiarazione && !v.righe_report_json) continue;
    try {
      const righe = dichiarazione ? [] : JSON.parse((await riprova(() => leggiCampo(base44, 'VerificaReport', v, 'righe_report_json'))) || '[]');
      const esito = calcolaEsito(v, righe, movimenti);
      // Un esito salvato che non si ricompone (parti doppie o mancanti) non e'
      // un errore della verifica: si riscrive, e valoreCampo cancella tutte le
      // parti del campo prima di rifarle. Lanciato, lasciava la verifica fra gli
      // errori a ogni riconfronto, senza ripararsi mai.
      let prima = '';
      try { prima = await riprova(() => leggiCampo(base44, 'VerificaReport', v, 'esito_json')); } catch { /* si riscrive */ }
      const firma = (lista) => (Array.isArray(lista) ? lista.map(c => `${c.canale}:${c.conformita}:${c.anomalie}:${c.assenti}`).join('|') : '');
      const cambiato = testoEsito(esito) !== prima || esito.riepilogo.conformita !== v.conformita
        || firma(esito.riepilogo.per_canale) !== firma(v.per_canale);
      const campi = { ...esito.riepilogo, stato: 'completata' };
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
