// La predittivita' dell'anno, pronta da mostrare: lettura (predittivitaDati),
// motore (predittivita) e risposta, un percorso solo per la Dashboard, il
// suggerimento del mercoledi', la proiezione e gli assistenti.
//
// Qui sta anche il programma fissato: i viaggi della settimana dopo, stoccaggio
// per impianto, che il mercoledi' si scrivono in PianificazioneSettimanale e da
// li' non cambiano piu' (26/09/2026). Prima il "previsto" di una settimana
// diventava uguale all'arrivato al primo camion, e lo scarto era sempre zero:
// non si vedeva mai se si era in anticipo o in ritardo. Ora il programmato resta
// quello deciso, e accanto c'e' il fatto.
import { calcolaPredittivita, lunediDi, piuGiorni } from "./predittivita.ts";
import { leggiDatiPredittivita } from "./predittivitaDati.ts";
import { noteGiaArrivato, dateDaSistemareDiRete } from "./proiezioneSecondarie.ts";
import { normalizzaRagioneSociale as chiave } from "./normalizzaRagioneSociale.ts";
import { oggiRoma } from "./giornoItaliano.ts";
import { settimanaIso } from "./movimenti.ts";

/** L'anno in corso, sul giorno italiano. */
export const annoInCorso = () => Number(oggiRoma().slice(0, 4));

/** La chiave di una riga del programma: settimana, stoccaggio, impianto. */
const chiaveRiga = (settimana, stoccaggio, impianto) => `${settimana}|${chiave(stoccaggio)}|${chiave(impianto)}`;

/** Le righe del programma fissato, per settimana e percorso. Le righe del piano di prima (senza origine) non contano. */
export function programmatiPerPercorso(righe) {
  const out = new Map();
  for (const r of righe || []) {
    if (!r || !r.origine || !r.data_inizio) continue;
    const k = chiaveRiga(String(r.data_inizio).slice(0, 10), r.fornitore_nome, r.impianto_nome);
    const prima = out.get(k);
    // due righe per lo stesso percorso: vale quella corretta a mano, poi la piu' recente
    if (!prima || (r.origine === 'manuale' && prima.origine !== 'manuale')
      || (r.origine === prima.origine && String(r.updated_date || r.created_date || '') > String(prima.updated_date || prima.created_date || ''))) out.set(k, r);
  }
  return out;
}

/**
 * La predittivita' dell'anno, calcolata e preparata per la pagina.
 *
 * @param {object} base44  client con il limite di richieste
 * @param {object} o       { anno, puoFissare }
 */
export async function predittivitaDellAnno(base44, { anno, puoFissare = false } = {}) {
  const oggiVero = oggiRoma();
  const annoCorrente = Number(oggiVero.slice(0, 4));
  const annoN = Number(anno) || annoCorrente;
  // Un anno chiuso si guarda com'era al 31 dicembre, in sola lettura.
  const solaLettura = annoN < annoCorrente;
  const oggi = solaLettura ? `${annoN}-12-31` : oggiVero;
  const dati = await leggiDatiPredittivita(base44, { anno: annoN, oggi });
  const calcolo = calcolaPredittivita(dati.ingresso);
  return { dati, calcolo, risposta: rispostaPredittivita({ dati, calcolo, anno: annoN, oggi, solaLettura, puoFissare: puoFissare && !solaLettura }) };
}

/** La risposta per la pagina e gli assistenti: niente record interi, solo i numeri. */
export function rispostaPredittivita({ dati, calcolo, anno, oggi, solaLettura, puoFissare }) {
  const nomi = new Map();
  for (const i of calcolo.impianti) nomi.set(i.chiave, i.nome);
  for (const s of calcolo.stoccaggi) if (!nomi.has(s.chiave)) nomi.set(s.chiave, s.nome);
  const nomeDi = (k) => nomi.get(k) || k;

  // --- avvisi: prima quelli che dicono se i numeri sono completi ---
  const avvisi = [];
  if (dati.caricamento_in_corso) avvisi.push({ tipo: 'caricamento_in_corso', grave: true, testo: `${dati.caricamento_in_corso}. I numeri possono essere incompleti: la pagina si ricalcola da sola quando il caricamento si chiude.` });
  avvisi.push(...calcolo.avvisi, ...dati.avvisi);
  const siti = new Set([...calcolo.impianti.map(i => i.chiave), ...calcolo.stoccaggi.map(s => s.chiave)]);
  const senzaFine = dati.senza_fine || { primarie: [], secondarie: [] };
  const date = dateDaSistemareDiRete([...dati.ingresso.primarie, ...senzaFine.primarie], [...dati.ingresso.secondarie, ...senzaFine.secondarie], siti, anno, chiave);
  if (date.avviso) avvisi.push({ tipo: 'date_da_sistemare', testo: date.avviso });
  if (dati.programmati === null) avvisi.push({ tipo: 'programmi_non_letti', grave: true, testo: "Il programma già fissato non si è potuto leggere: per non sovrascriverlo, oggi non si può fissare niente. Riprova tra poco." });
  if (!calcolo.regole_definite) avvisi.push({ tipo: 'regole_non_definite', testo: `Le regole della predittività del ${anno} (viaggio medio e priorità degli stoccaggi) non sono ancora state scritte: si usano quelle predefinite, 13 t a viaggio e priorità pari. Si scrivono in Target & Status → Impianti e stoccaggi: il viaggio medio sul contratto Ecotyre dell'anno, la priorità su ogni collegamento di uno stoccaggio.` });
  if (dati.senza_fine === null) avvisi.push({ tipo: 'senza_fine_non_letti', testo: "I formulari terminati senza fine trasporto non si sono potuti leggere: se ce ne sono, non sono segnalati qui." });

  // --- il programma: quello calcolato, con accanto quello gia' fissato ---
  const fissati = programmatiPerPercorso(dati.programmati || []);
  const prossima = calcolo.prossima_settimana.dal;
  const programma = calcolo.programma.map(r => {
    const f = fissati.get(chiaveRiga(prossima, r.stoccaggio, r.impianto));
    return { ...r, fissato: f ? { viaggi: Number(f.viaggi_previsti) || 0, manuale: f.origine === 'manuale', id: f.id } : null };
  });

  // --- le settimane dell'anno: programmato e fatto, percorso per percorso ---
  const settimane = new Map();
  const riga = (settimana, stoccaggio, impianto) => {
    const k = chiaveRiga(settimana, stoccaggio, impianto);
    if (!settimane.has(k)) settimane.set(k, { settimana, stoccaggio, impianto, programmati: null, programmati_manuale: false, fatti: 0, fatti_kg: 0 });
    return settimane.get(k);
  };
  for (const f of calcolo.fatto) {
    // lo stesso percorso sempre con lo stesso nome: quello della configurazione
    const x = riga(f.settimana, nomeDi(chiave(f.nome_stoccaggio)), nomeDi(chiave(f.nome_impianto)));
    x.fatti += f.viaggi;
    x.fatti_kg += f.kg;
  }
  for (const r of fissati.values()) {
    const settimana = String(r.data_inizio).slice(0, 10);
    if (settimana > prossima) continue;
    const x = riga(settimana, nomeDi(chiave(r.fornitore_nome)), nomeDi(chiave(r.impianto_nome)));
    x.programmati = Number(r.viaggi_previsti) || 0;
    x.programmati_manuale = r.origine === 'manuale';
  }
  const elencoSettimane = [...settimane.values()]
    .map(x => ({ ...x, al: piuGiorni(x.settimana, 6), aperta: x.settimana >= lunediDi(oggi) }))
    .sort((a, b) => b.settimana.localeCompare(a.settimana) || a.stoccaggio.localeCompare(b.stoccaggio) || a.impianto.localeCompare(b.impianto));

  return {
    anno, oggi, sola_lettura: !!solaLettura, puo_fissare: !!puoFissare && dati.programmati !== null,
    dati_al: calcolo.dati_al, settimana_scorsa_completa: calcolo.settimana_scorsa_completa,
    kg_per_viaggio: calcolo.kg_per_viaggio, fine: calcolo.fine, finestra_ritmo: calcolo.finestra_ritmo,
    regole_definite: calcolo.regole_definite, prossima_settimana: calcolo.prossima_settimana,
    configurazione_vuota: calcolo.impianti.length === 0,
    impianti: calcolo.impianti.map(i => ({
      chiave: i.chiave, nome: i.nome, target_kg: i.target_kg, fine: i.fine,
      gia_arrivato_kg: i.gia_arrivato_kg, residuo_kg: i.residuo_kg, target_superato: i.target_superato, senza_stoccaggi: i.senza_stoccaggi,
      composizione: i.arrivato ? {
        primaria_impianto_kg: i.arrivato.primaria_impianto_kg, primaria_piazzale_netta_kg: i.arrivato.primaria_piazzale_netta_kg,
        piazzale_ripartito_kg: i.arrivato.piazzale_ripartito_kg, secondaria_kg: i.arrivato.secondaria_kg,
      } : null,
      note: noteGiaArrivato(i.arrivato, nomeDi, anno),
      orizzonte: i.orizzonte, primarie: i.primarie, primaria_attesa: i.primaria_attesa,
      fabbisogno_secondarie: i.fabbisogno_secondarie, da_stoccaggi: i.da_stoccaggi,
      coperto_secondarie: i.coperto_secondarie, mancanza_kg: i.mancanza_kg, raggiunge: i.raggiunge,
    })),
    stoccaggi: calcolo.stoccaggi.map(s => ({ ...s, destinazioni: s.destinazioni.map(d => ({ ...d, nome: nomeDi(d.impianto) })) })),
    programma,
    settimane: elencoSettimane,
    avvisi,
    lettura: dati.lettura,
  };
}

/**
 * Fissa i viaggi di una settimana in PianificazioneSettimanale: una riga per
 * stoccaggio e impianto. Il suggerimento del mercoledi' non tocca le righe che
 * l'amministratore ha corretto a mano; una correzione a mano le riscrive.
 *
 * @param {object} e       base44.asServiceRole.entities
 * @param {object} o       { anno, settimana ('AAAA-MM-GG', lunedi'), righe: [{ stoccaggio, impianto, viaggi, motivo? }], kgPerViaggio, manuale, esistenti,
 *                          impianti: [{ chiave, id }] per l'impianto_id, che lo schema chiede (con settimana_numero e data_inizio) }
 * @returns {Promise<{ scritte: number, lasciate: number }>}
 */
export async function fissaProgramma(e, { anno, settimana, righe, kgPerViaggio, manuale = false, esistenti = [], impianti = [] }) {
  const giaFissati = programmatiPerPercorso(esistenti);
  const idDi = new Map((impianti || []).map(i => [i.chiave, i.id]));
  let scritte = 0, lasciate = 0;
  for (const r of righe || []) {
    const prima = giaFissati.get(chiaveRiga(settimana, r.stoccaggio, r.impianto));
    if (prima && prima.origine === 'manuale' && !manuale) { lasciate++; continue; }
    const viaggi = Math.max(0, Math.round(Number(r.viaggi) || 0));
    const dati = {
      anno: Number(anno), data_inizio: settimana, data_fine: piuGiorni(settimana, 6), settimana_numero: settimanaIso(settimana),
      impianto_id: idDi.get(chiave(r.impianto)) || chiave(r.impianto),
      fornitore_nome: r.stoccaggio, impianto_nome: r.impianto,
      viaggi_previsti: viaggi, kg_previsti: viaggi * kgPerViaggio,
      origine: manuale ? 'manuale' : 'programma', modificato_manuale: !!manuale,
      stato: 'programmato', note: r.motivo || '',
    };
    if (prima) await e.PianificazioneSettimanale.update(prima.id, dati);
    else await e.PianificazioneSettimanale.create(dati);
    scritte++;
  }
  return { scritte, lasciate };
}
