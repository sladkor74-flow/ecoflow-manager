// Che cosa legge la predittivita' delle secondarie, e come lo prepara per il
// motore (predittivita.ts). Un punto solo, usato dalla Dashboard, dal
// suggerimento del mercoledi', dalla proiezione e dagli assistenti: prima ogni
// funzione leggeva a modo suo, e tutte leggevano gli archivi interi.
//
// Si legge solo quello che serve (26/09/2026): gli archivi conservano ormai
// anche gli anni passati (storicoConservato.ts), e rileggerli a ogni apertura
// costava richieste al limite della piattaforma per niente. Servono:
// - i movimenti terminati dell'anno, per fine trasporto;
// - quelli delle ultime settimane, anche a cavallo d'anno, per il ritmo reale;
// - quelli dopo l'ancora di ogni piazzale, per la sua giacenza (l'ancora e' il
//   31/12 dell'anno prima, quindi dentro la stessa finestra);
// - i terminati senza fine trasporto, che non hanno anno e si segnalano sempre.
// La fine trasporto e' salvata in UTC: si legge da un giorno prima, e il giorno
// italiano lo decide poi il codice.
//
// La configurazione vale un anno (26/09/2026): impianti e stoccaggi seguiti
// hanno il loro anno (un record senza anno vale per il 2026, l'anno in cui la
// predittivita' e' nata), i target dei raccoglitori sono gia' per anno.
import { fetchAll } from "./fetchAll.ts";
import { giornoRoma } from "./giornoItaliano.ts";
import { normalizzaRagioneSociale as chiave } from "./normalizzaRagioneSociale.ts";
import { canaleMovimento, eTerminato } from "./movimenti.ts";
import { fineProgrammazione, avvisoFineProgrammazione } from "./fineProgrammazione.ts";
import { regolePredittivita } from "./regolePredittivita.ts";
import { ancoraDellAnno, momentoRilevazione, kgReteDiRilevazione } from "./giacenzaStoccaggi.ts";
import { statoCaricamenti, caricamentiDuranteLettura, descriviCaricamento } from "./reportSettimanali.ts";
import { giacenzaPiazzale, piuGiorni } from "./predittivita.ts";

/** L'anno a cui vale un record di configurazione: il suo, o il 2026 se non lo dice. */
export const annoDelRecord = (r) => Number((r && r.anno) || 2026);

const ruoloDi = (f) => f.ruolo || (String(f.tipo || '').toLowerCase().trim() === 'stoccaggio' ? 'stoccaggio' : 'raccoglitore');
const eStoccaggio = (f) => ['stoccaggio', 'doppio_ruolo'].includes(ruoloDi(f));

// Lo stato dei caricamenti che toccano gli archivi letti: un caricamento aperto
// o concluso mentre si leggeva vuol dire numeri forse a meta'.
const TIPI_LETTI = ['primarie', 'primarie_rete', 'secondarie'];

/**
 * Legge e prepara i dati della predittivita' dell'anno.
 *
 * @param {object} base44  il client con il limite di richieste (conLimiteRichieste)
 * @param {object} o       { anno, oggi }
 * @returns {Promise<{ ingresso, configurazione, programmati, avvisi, lettura, caricamento_in_corso }>}
 *   ingresso: l'argomento di calcolaPredittivita
 */
export async function leggiDatiPredittivita(base44, { anno, oggi }) {
  const e = base44.asServiceRole.entities;
  const annoN = Number(anno);
  const regole = regolePredittivita(annoN);
  const avvisi = [];

  // La finestra dei movimenti: dal 1 gennaio, o da prima se il ritmo lo chiede.
  const inizioAnno = `${annoN}-01-01`;
  const inizioRitmo = piuGiorni(oggi, -7 * (regole.settimane_ritmo + 2));
  const dal = piuGiorni(inizioRitmo < inizioAnno ? inizioRitmo : inizioAnno, -1);
  const filtroFinestra = { stato: 'terminato', trasporto_finito_il: { $gte: `${dal}T00:00:00` } };
  const filtroSenzaFine = { stato: 'terminato', trasporto_finito_il: null };

  const prima = await statoCaricamenti(base44, TIPI_LETTI).catch(() => null);
  const [impiantiTutti, fornitoriTutti, targetRaccoglitori, primarie, secondarie, primarieSenzaFine, secondarieSenzaFine, rilevazioni, programmati] = await Promise.all([
    e.ImpiantoTargetSecondaria.filter({ stato: 'attivo' }),
    e.FornitoreSecondaria.filter({ stato: 'attivo' }),
    e.TargetRaccoglitore.filter({ anno: annoN }),
    fetchAll(e.PrimariaRete, filtroFinestra),
    fetchAll(e.Secondaria, filtroFinestra),
    // Senza fine trasporto: se la piattaforma non capisse il filtro, si tengono
    // comunque solo quelli davvero senza la data.
    fetchAll(e.PrimariaRete, filtroSenzaFine).then(rs => rs.filter(r => !giornoRoma(r.trasporto_finito_il))).catch(() => null),
    fetchAll(e.Secondaria, filtroSenzaFine).then(rs => rs.filter(r => !giornoRoma(r.trasporto_finito_il))).catch(() => null),
    fetchAll(e.GiacenzaStoccaggio),
    e.PianificazioneSettimanale.filter({ anno: annoN }, 'data_inizio', 2000).catch(() => []),
  ]);
  const dopo = await statoCaricamenti(base44, TIPI_LETTI).catch(() => null);
  let caricamentoInCorso = null;
  if (!prima || !dopo) caricamentoInCorso = "Lo stato dei caricamenti non si e' potuto leggere: non si sa se primarie e secondarie sono complete.";
  else {
    const durante = caricamentiDuranteLettura(prima, dopo);
    if (durante.length) caricamentoInCorso = durante.map(descriviCaricamento).join('; ');
  }

  const rete = (r, archivio) => eTerminato(r) && canaleMovimento(r, archivio) === 'RETE';
  const primarieRete = primarie.filter(r => rete(r, 'PrimariaRete'));
  const secondarieRete = secondarie.filter(r => rete(r, 'Secondaria'));

  // --- gli impianti seguiti dell'anno ---
  const impiantiAnno = impiantiTutti.filter(i => annoDelRecord(i) === annoN);
  const fine = fineProgrammazione(annoN);
  if (!fine.definita) avvisi.push({ tipo: 'fine_non_definita', testo: avvisoFineProgrammazione(annoN) });
  const impianti = [];
  const perId = new Map();
  for (const i of impiantiAnno) {
    const k = chiave(i.nome_impianto);
    if (!k) continue;
    perId.set(i.id, k);
    // una data di fine di un altro anno non vale: vale quella dell'anno
    let fineImp = String(i.data_fine || '').slice(0, 10);
    if (fineImp && fineImp.slice(0, 4) !== String(annoN)) {
      avvisi.push({ tipo: 'fine_di_un_altro_anno', impianto: i.nome_impianto, testo: `${i.nome_impianto} ha come fine della programmazione il ${fineImp.split('-').reverse().join('/')}, che non e' del ${annoN}: si usa il ${fine.data.split('-').reverse().join('/')}. Correggila in Target & Status.` });
      fineImp = '';
    }
    impianti.push({ chiave: k, nome: i.nome_impianto, target_kg: Number(i.target) || 0, fine: fineImp || fine.data, id: i.id });
  }
  const chiaviImpianti = new Set(impianti.map(i => i.chiave));

  // --- i target dei raccoglitori, per sito ---
  // Un target scritto per un impianto o uno stoccaggio vale li'. Uno senza sito
  // si divide fra i siti seguiti in proporzione a quanto il raccoglitore ci ha
  // portato quest'anno, come per lo stoccaggio che alimenta piu' impianti.
  const fornitoriAnno = fornitoriTutti.filter(f => annoDelRecord(f) === annoN);
  const chiaviStoccaggiConfig = new Set(fornitoriAnno.filter(eStoccaggio).map(f => chiave(f.nome)).filter(Boolean));
  const sitoSeguito = (k) => chiaviImpianti.has(k) || chiaviStoccaggiConfig.has(k);
  const raccoglitori = [];
  for (const t of targetRaccoglitori) {
    const R = chiave(t.raccoglitore);
    const kg = (Number(t.target_tonnellate) || 0) * 1000;
    if (!R || !(kg > 0)) continue;
    const sito = chiave(t.impianto);
    if (sito) { raccoglitori.push({ chiave: R, nome: t.raccoglitore, sito, target_kg: kg }); continue; }
    const perSito = new Map();
    for (const r of primarieRete) {
      const g = giornoRoma(r.trasporto_finito_il);
      if (!g || g.slice(0, 4) !== String(annoN) || chiave(r.trasportatore) !== R) continue;
      const X = chiave(r.destinazione);
      if (sitoSeguito(X)) perSito.set(X, (perSito.get(X) || 0) + (Number(r.peso_effettivo) || 0));
    }
    const totale = [...perSito.values()].reduce((a, b) => a + b, 0);
    if (!totale) continue;
    for (const [X, v] of perSito) raccoglitori.push({ chiave: R, nome: t.raccoglitore, sito: X, target_kg: Math.round(kg * v / totale), diviso: true });
  }

  // --- gli stoccaggi: configurati, o che spediscono a un impianto seguito ---
  const stoccaggi = new Map();
  const stoccaggio = (k, nome) => {
    if (!stoccaggi.has(k)) stoccaggi.set(k, { chiave: k, nome, plafond_kg: null, destinazioni: [] });
    return stoccaggi.get(k);
  };
  for (const f of fornitoriAnno) {
    if (!eStoccaggio(f)) continue;
    const k = chiave(f.nome);
    if (!k) continue;
    const s = stoccaggio(k, f.nome);
    if (Number(f.plafond_stoccaggio_kg) > 0) s.plafond_kg = Math.max(s.plafond_kg || 0, Number(f.plafond_stoccaggio_kg));
    const I = perId.get(f.impianto_id) || chiave(f.impianto_nome);
    if (I && chiaviImpianti.has(I) && !s.destinazioni.some(x => x.impianto === I)) s.destinazioni.push({ impianto: I, priorita: Number(f.priorita) || null });
  }
  for (const r of secondarieRete) {
    const g = giornoRoma(r.trasporto_finito_il);
    const S = chiave(r.stoccaggio), I = chiave(r.destinazione);
    if (!g || g.slice(0, 4) !== String(annoN) || !S || S === I || !chiaviImpianti.has(I)) continue;
    stoccaggio(S, r.stoccaggio);
  }

  // --- la giacenza di ogni piazzale: l'ancora dell'anno piu' i movimenti dopo ---
  const perSitoLetture = new Map();
  for (const r of rilevazioni) {
    const k = chiave(r.sito);
    if (!k) continue;
    if (!perSitoLetture.has(k)) perSitoLetture.set(k, []);
    perSitoLetture.get(k).push(r);
  }
  for (const s of stoccaggi.values()) {
    const ancora = ancoraDellAnno(perSitoLetture.get(s.chiave) || [], annoN);
    const del = ancora ? momentoRilevazione(ancora) : '';
    if (!ancora || del < dal) {
      s.giacenza_kg = null;
      if (!ancora) avvisi.push({ tipo: 'ancora_mancante', stoccaggio: s.nome, testo: `${s.nome} non ha la rilevazione al 31/12/${annoN - 1} ne' una lettura del ${annoN}: senza l'ancora la giacenza del piazzale non si calcola. Va inserita in Giacenze, scheda Stoccaggi.` });
      continue;
    }
    s.giacenza_da = del;
    s.giacenza_kg = giacenzaPiazzale({ chiaveStoccaggio: s.chiave, partenzaKg: kgReteDiRilevazione(ancora), partenzaDel: del, primarie: primarieRete, secondarie: secondarieRete, chiave });
  }

  return {
    ingresso: {
      anno: annoN, oggi, chiave, regole, fine: fine.data,
      impianti, raccoglitori, stoccaggi: [...stoccaggi.values()],
      primarie: primarieRete, secondarie: secondarieRete,
    },
    configurazione: { impianti: impiantiAnno, fornitori: fornitoriAnno, target_raccoglitori: targetRaccoglitori },
    programmati: programmati || [],
    senza_fine: primarieSenzaFine === null || secondarieSenzaFine === null ? null : { primarie: primarieSenzaFine.filter(r => rete(r, 'PrimariaRete')), secondarie: secondarieSenzaFine.filter(r => rete(r, 'Secondaria')) },
    avvisi,
    lettura: { dal, primarie: primarie.length, secondarie: secondarie.length },
    caricamento_in_corso: caricamentoInCorso,
  };
}
