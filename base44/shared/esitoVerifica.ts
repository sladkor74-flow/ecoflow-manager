// Salvataggio dell'esito di una verifica di report settimanale e alert sulle
// dichiarazioni di "nessuna movimentazione".
//
// Un impianto a volte non manda il report e scrive nell'email che nella settimana
// non ci sono state movimentazioni. La dichiarazione si registra come una verifica
// senza righe: se nel gestionale risultano formulari, la dichiarazione e' smentita
// e si apre un alert. L'alert si chiude da solo quando i dati la confermano o
// quando arriva il report vero.

import { verificaReport, CATEGORIE_MOVIMENTO } from "./reportSettimanali.ts";
import { valoreCampo } from "./testoLungo.ts";
import { formatoKg } from "./formato.ts";

export const REGOLA_DICHIARAZIONE = 'verifica_nessuna_movimentazione';

export const eDichiarazione = (v) => v && v.file_tipo === 'dichiarazione';

const chiaveAlert = (v) => `${v.anno}-S${String(v.settimana).padStart(2, '0')}-${v.soggetto_chiave}`;
const it = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');

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

/** Scrive esito e riepilogo sulla verifica, poi aggiorna l'alert della dichiarazione. */
export async function salvaEsito(base44, verifica, esito, conRitentativi = (fn) => fn()) {
  const id = verifica.id;
  await conRitentativi(async () => base44.asServiceRole.entities.VerificaReport.update(id, {
    stato: 'completata',
    esito_json: await valoreCampo(base44, 'VerificaReport', id, 'esito_json', JSON.stringify({
      esiti: esito.esiti, assenti: esito.assenti, escluse: esito.escluse, quadratura: esito.quadratura,
    })),
    ...esito.riepilogo,
    verificata_il: new Date().toISOString(),
    errore: '',
  }));
  await conRitentativi(() => aggiornaAlertDichiarazione(base44, verifica, esito));
}

async function aggiornaAlertDichiarazione(base44, verifica, esito) {
  const Alert = base44.asServiceRole.entities.Alert;
  const record_id = chiaveAlert(verifica);
  const aperti = await Alert.filter({ regola_id: REGOLA_DICHIARAZIONE, record_id, stato: 'aperto' }, 'id', 100);
  const oggi = new Date().toISOString().slice(0, 10);
  const smentita = eDichiarazione(verifica) && esito.riepilogo.conformita !== 'piena';

  if (!smentita) {
    const nota = eDichiarazione(verifica)
      ? `Chiuso automaticamente il ${oggi}: nel gestionale non risultano movimentazioni, la dichiarazione e' confermata`
      : `Chiuso automaticamente il ${oggi}: e' arrivato il report dell'impianto, la verifica prosegue sul report`;
    for (const a of aperti) await Alert.update(a.id, { stato: 'risolto', risolto_note: nota });
    return;
  }

  const righe = esito.quadratura
    .filter(q => q.formulari_gestionale > 0)
    .map(q => `${q.nome}: ${q.formulari_gestionale} ${q.formulari_gestionale === 1 ? 'formulario' : 'formulari'}, ${formatoKg(q.kg_gestionale)} kg`);
  const totale = esito.quadratura.reduce((t, q) => ({ n: t.n + q.formulari_gestionale, kg: t.kg + q.kg_gestionale }), { n: 0, kg: 0 });
  const dati = {
    titolo: `${verifica.soggetto_nome}: dichiarata nessuna movimentazione nella settimana ${verifica.settimana}, ma risultano ${totale.n} formulari`,
    descrizione: [
      `L'impianto ha comunicato che dal ${it(String(verifica.data_inizio))} al ${it(String(verifica.data_fine))} non ci sono state movimentazioni${verifica.nota ? ` (${verifica.nota})` : ''}.`,
      `Nel gestionale risultano ${totale.n} formulari per ${formatoKg(totale.kg)} kg:`,
      ...righe.map(r => `- ${r}`),
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
 * Ripete il confronto delle dichiarazioni di nessuna movimentazione con i dati
 * attuali: un caricamento successivo puo' portare formulari della settimana.
 * Si scrive solo se l'esito cambia.
 */
export async function ricontrollaDichiarazioni(base44, dichiarazioni, movimenti, conRitentativi = (fn) => fn()) {
  let aggiornate = 0;
  for (const v of dichiarazioni) {
    if (!eDichiarazione(v) || v.stato !== 'completata') continue;
    const esito = calcolaEsito(v, [], movimenti);
    const r = esito.riepilogo;
    const invariata = r.conformita === v.conformita && r.anomalie === v.anomalie
      && r.ingressi_gestionale === v.ingressi_gestionale && r.uscite_gestionale === v.uscite_gestionale
      && r.peso_ingressi_kg === v.peso_ingressi_kg && r.peso_uscite_kg === v.peso_uscite_kg;
    if (invariata) continue;
    await salvaEsito(base44, v, esito, conRitentativi);
    aggiornate++;
  }
  return aggiornate;
}

export { CATEGORIE_MOVIMENTO };
