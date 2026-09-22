// Il calcolo della fatturazione passiva di un mese e di un canale, come funzione
// pura: riceve gli archivi gia' letti e restituisce raccoglitori, impianti e
// stoccaggi, trasporti delle secondarie, anomalie e quadratura.
//
// Sta qui, e non dentro la funzione calcolaPassiva, perche' lo usano in due: la
// pagina della fatturazione passiva (un mese alla volta) e il margine (tutti i
// mesi dell'anno con una sola lettura degli archivi). Il costo che entra nel
// margine e' cosi' lo stesso numero, riga per riga, che si vede in fatturazione.
import { normalizzaRagioneSociale } from './normalizzaRagioneSociale.ts';
import { getRegioneFromProvincia } from './regioneMap.ts';
import { mappaFatturazione, fatturaA } from "./subfornitori.ts";
import { giornoRoma, annoRoma, meseRoma } from "./giornoItaliano.ts";
import { eAci } from "./canaleSecondaria.ts";
import { chiaveFormulario, raggruppaPerFormulario, ordineDi, ticketDi } from "./formulari.ts";
import { anomalieDateFormulari } from "./filtroPeriodo.ts";

const NOMI_CANALE = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };

// Regole del portale sull'ACI, dette dalla direzione il 19/09/2026: una
// richiesta non si stima sotto i 1.500 kg, e un formulario non si chiude a piu'
// del 10% del peso stimato del suo ticket.
const MINIMO_ACI_KG = 1500;
const SOGLIA_ACI = 1.1;

const MESI_MAP = {
  'gennaio': 0, 'febbraio': 1, 'marzo': 2, 'aprile': 3, 'maggio': 4, 'giugno': 5,
  'luglio': 6, 'agosto': 7, 'settembre': 8, 'ottobre': 9, 'novembre': 10, 'dicembre': 11
};

// ─── Helpers ───
function norm(s) { return String(s || '').trim().toUpperCase(); }
function isEmpty(s) { return !s || String(s).trim() === ''; }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function round3(n) { return Math.round((n + Number.EPSILON) * 1000) / 1000; }

// Il giorno di una data e' quello italiano, non quello del fuso del server:
// un trasporto finito alle 23 del 31 agosto e' di agosto, non di settembre.
function tariffaValidaPerData(t, dataIso) {
  const giorno = giornoRoma(dataIso);
  if (!giorno) return false;
  const inizio = String(t.data_inizio_validita || '').slice(0, 10);
  if (inizio && inizio > giorno) return false;
  const fine = String(t.data_fine_validita || '').slice(0, 10);
  if (fine && fine < giorno) return false;
  return true;
}

// L'ACI si riconosce con la regola condivisa (base44/shared/canaleSecondaria.ts),
// non con una copia piu' debole: quella guardava solo classe e prodotto e si
// perdeva il codice prodotto ".class9".
const isAciRow = (r) => eAci(r);

// Un viaggio e' un camion in un giorno. Il giorno e' quello italiano, come il
// periodo, e la targa si normalizza: "GC 599 nl" e "GC599NL" sono lo stesso
// mezzo, e contati due volte varrebbero due viaggi in fattura.
function chiaveViaggio(rec) {
  const giorno = giornoRoma(rec && rec.trasporto_finito_il);
  const targa = String((rec && rec.automezzo) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${giorno}|${targa}`;
}

// In maiuscolo anche quando la regione si ricava dalla provincia: la tariffa si
// confronta con norm(t.regione), e "Campania" contro "CAMPANIA" non tornava mai,
// quindi un record senza regione scritta perdeva il prezzo per regione.
function getRegione(r) {
  return norm(r.regione || r.regioni) || norm(getRegioneFromProvincia(r.provincia)) || '';
}

function sortPerClasse(arr) {
  // piu' specifico (classe_materiale valorizzata) per primo
  return arr.sort((a, b) => (isEmpty(b.classe_materiale) ? 0 : 1) - (isEmpty(a.classe_materiale) ? 0 : 1));
}

// Nell'extra raccolta il prezzo non viene da una tariffa di contratto: sta
// scritto sull'intervento, riga per riga, perche' ogni intervento fa storia a
// se' - un ritiro straordinario puo' avere il suo prezzo di raccolta, di
// stoccaggio, di trattamento, piu' la pulizia e gli oneri. Il modulo Extra
// Raccolta somma quei campi, e la fatturazione passiva deve arrivare allo stesso
// numero: prima applicava le tariffe della rete e il 14 aprile perdeva per
// strada 36,00 euro di raccolta su 400 kg.
const CAMPO_COSTO = {
  RACCOLTA: 'costo_raccolta_t',
  TRATTAMENTO: 'costo_trattamento_t',
  CONFERIMENTO_STOCCAGGIO: 'costo_stoccaggio_t',
};
function tariffaDallIntervento(record, prestazione) {
  const valore = Number(record[CAMPO_COSTO[prestazione]] || 0);
  return {
    // il valore entra nella chiave: due interventi dello stesso fornitore
    // possono avere prezzi diversi e non vanno fusi in una riga sola
    id: `intervento|${prestazione}|${valore}`,
    prestazione,
    unita_misura: '€/t',
    valore,
    criterio: 'intervento',
    da_intervento: true,
  };
}

// ─── Ricerca tariffe ───

// Ogni canale cerca solo le sue tariffe, extra raccolta compresa. Prima l'extra
// raccolta, se non trovava la sua, ripiegava su quella di RETE: regola
// dell'utente del 22/09/2026, i costi di un intervento li scrive lui a mano
// prima di passarlo a terminato, e la rete non c'entra mai. Qui per l'extra
// raccolta le due ricerche servono solo a un confronto: se sull'intervento il
// costo e' zero ma un contratto di EXTRA_RACCOLTA un prezzo lo prevede.

// RACCOLTA: gerarchia destinazione > provincia > regione > generica
function findTariffaRaccolta(tariffe, trasKey, provincia, regione, destinazione, classe, tipologia, dataIso) {
  const cls = norm(classe);
  const candidates = tariffe.filter(t =>
    t.prestazione === 'RACCOLTA' &&
    normalizzaRagioneSociale(t.fornitore_nome) === trasKey &&
    t.tipologia === tipologia &&
    tariffaValidaPerData(t, dataIso) &&
    (isEmpty(t.classe_materiale) || norm(t.classe_materiale) === cls)
  );
  sortPerClasse(candidates);
  // Il criterio con cui si e' scelto resta attaccato alla tariffa: serve a
  // vedere a colpo d'occhio, in fatturazione, quando un contratto prevede un
  // prezzo per destinazione e si sta invece applicando quello generico. Le
  // tariffe di Emmesse - 72 euro a Gatim, 90 a Irigom - sono nate cosi'.
  const con = (m, criterio) => (m ? { ...m, criterio } : null);
  // a) destinazione - confrontata come ragione sociale, altrimenti "Gatim" e
  // "GATIM S.R.L." sarebbero due destinazioni diverse e il prezzo per
  // destinazione non si aggancerebbe mai
  if (!isEmpty(destinazione)) {
    const dest = normalizzaRagioneSociale(destinazione);
    const m = candidates.find(t => normalizzaRagioneSociale(t.destinazione) === dest);
    if (m) return con(m, 'destinazione');
  }
  // b) provincia (senza destinazione)
  if (!isEmpty(provincia)) {
    const m = candidates.find(t => norm(t.provincia) === provincia && isEmpty(t.destinazione));
    if (m) return con(m, 'provincia');
  }
  // c) regione (senza provincia e destinazione)
  if (!isEmpty(regione)) {
    const m = candidates.find(t => norm(t.regione) === regione && isEmpty(t.provincia) && isEmpty(t.destinazione));
    if (m) return con(m, 'regione');
  }
  // d) generica
  const m = candidates.find(t => isEmpty(t.destinazione) && isEmpty(t.provincia) && isEmpty(t.regione));
  return con(m, 'generica');
}

// IMPIANTI: fornitore=destinazione, prestazione, classe, nel canale che si sta guardando
function findTariffaImpianto(tariffe, destKey, prestazione, classe, tipologia, dataIso) {
  const cls = norm(classe);
  const candidates = tariffe.filter(t =>
    t.prestazione === prestazione &&
    normalizzaRagioneSociale(t.fornitore_nome) === destKey &&
    t.tipologia === tipologia &&
    tariffaValidaPerData(t, dataIso) &&
    (isEmpty(t.classe_materiale) || norm(t.classe_materiale) === cls)
  );
  sortPerClasse(candidates);
  return candidates[0] || null;
}

// TRASPORTO_SECONDARIA: fornitore=trasportatore, produttore=stoccaggio, destinatario=destinazione; prima TUTTE poi tipologia
function findTariffaSecondaria(tariffe, trasKey, produttore, destinatario, tipologia, dataIso) {
  const prodKey = normalizzaRagioneSociale(produttore);
  const destKey = normalizzaRagioneSociale(destinatario);
  for (const tip of ['TUTTE', tipologia]) {
    const candidates = tariffe.filter(t =>
      t.prestazione === 'TRASPORTO_SECONDARIA' &&
      normalizzaRagioneSociale(t.fornitore_nome) === trasKey &&
      t.tipologia === tip &&
      tariffaValidaPerData(t, dataIso) &&
      normalizzaRagioneSociale(t.produttore) === prodKey &&
      normalizzaRagioneSociale(t.destinatario) === destKey
    );
    if (candidates.length > 0) return candidates[0];
  }
  return null;
}

// ─── Subraccoglitori: il "di cui" da mostrare accanto al fornitore che fattura ───
function segnaDiCui(mappa, nome, peso, viaggioKey) {
  if (!mappa.has(nome)) mappa.set(nome, { peso_kg: 0, viaggiSet: new Set() });
  const d = mappa.get(nome);
  d.peso_kg += peso;
  d.viaggiSet.add(viaggioKey);
}

function elencoDiCui(mappa) {
  if (!mappa || mappa.size === 0) return [];
  return [...mappa.entries()].map(([fornitore, d]) => ({
    fornitore, tonnellate: round3(d.peso_kg / 1000), viaggi: d.viaggiSet.size,
  }));
}
// Come elencoDiCui, ma si porta dietro quali viaggi: sommare i conteggi riga per
// riga contava due volte lo stesso camion, quando lo stesso viaggio compariva in
// due righe (per esempio due province).
function elencoDiCuiConViaggi(mappa) {
  if (!mappa || mappa.size === 0) return [];
  return [...mappa.entries()].map(([fornitore, d]) => ({
    fornitore, tonnellate: round3(d.peso_kg / 1000), viaggi: d.viaggiSet.size,
    viaggi_keys: [...d.viaggiSet],
  }));
}

// ─── Calcolo importo ───
function calcImporto(um, valore, peso_kg, viaggi) {
  if (!um) return 0;
  if (um === '€/t') return (peso_kg / 1000) * valore;
  if (um === '€/kg') return peso_kg * valore;
  if (um === '€/viaggio') return viaggi * valore;
  return 0;
}

// ─── Viaggio misto: un camion, formulari di rete e formulari ACI ───
// Un viaggio di secondaria puo' portare insieme formulari di rete e formulari
// ACI. Con un prezzo a viaggio l'importo si paga una volta sola e si divide fra
// i due canali in proporzione ai chili effettivi di ciascuno su quel viaggio
// (regola dell'utente del 22/09/2026: «fai la proporzione in base al peso»).
// Prima si pagava tutto sulla rete, e l'ACI risultava trasportato gratis.
// La quota della rete si arrotonda al centesimo e quella dell'ACI e' il resto,
// cosi' le due parti fanno sempre esattamente l'importo del viaggio; la vista
// RETE e la vista ACI la calcolano allo stesso modo, ciascuna prende la sua.
// Senza chili (pesi a zero) la proporzione si fa sul numero di formulari.
export function quoteViaggioMisto(valore, kgRete, kgAci, formulariRete = 0, formulariAci = 0) {
  const [pesoRete, pesoAci] = kgRete + kgAci > 0 ? [kgRete, kgAci] : [formulariRete, formulariAci];
  const totale = pesoRete + pesoAci;
  const quotaRete = totale > 0 ? pesoRete / totale : 1;
  const rete = round2(valore * quotaRete);
  return { RETE: rete, ACI: round2(valore - rete), quota_rete: quotaRete, quota_aci: 1 - quotaRete };
}

// Numeri scritti dentro una nota: all'italiana, tonnellate con due decimali (tre
// se i chili non sono tondi), euro con due.
const migliaiaIt = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
function tTesto(kg) {
  const t = Math.round(kg) / 1000;
  const [i, d] = t.toFixed(Math.round(kg) % 10 === 0 ? 2 : 3).split('.');
  return `${migliaiaIt(i)},${d}`;
}
function euroTesto(v) {
  const [i, d] = round2(v).toFixed(2).split('.');
  return `${migliaiaIt(i)},${d}`;
}
const numTesto = (v) => String(round2(v)).replace('.', ',');

export const MESI_PASSIVA = MESI_MAP;

/**
 * I movimenti di un canale su cui si controllano le date obbligatorie: per rete e
 * ACI le primarie e le secondarie del canale, per l'extra raccolta tutti gli
 * interventi. Lo usano la passiva di un mese e il margine dell'anno, che cosi'
 * guardano gli stessi ordini.
 */
export function movimentiDateDelCanale({ primarieRete, primarieAci, secondarieAll, extraRaccoltaAll }, tipologia) {
  if (tipologia === 'RETE') return [...(primarieRete || []), ...(secondarieAll || []).filter(r => !isAciRow(r))];
  if (tipologia === 'ACI') return [...(primarieAci || []), ...(secondarieAll || []).filter(isAciRow)];
  return extraRaccoltaAll || [];
}

/** L'indice 0-11 del mese: nome italiano oppure numero da 1 a 12. -1 se non riconosciuto. */
export function indiceMesePassiva(mese) {
  const meseNorm = String(mese).toLowerCase().trim();
  return MESI_MAP[meseNorm] !== undefined ? MESI_MAP[meseNorm] : (!isNaN(Number(meseNorm)) && meseNorm !== '' ? Number(meseNorm) - 1 : -1);
}

export function calcolaPassivaMese({ primarieRete, primarieAci, secondarieAll, extraRaccoltaAll, tariffeAll, fornitoriAll }, annoNum, meseNum, mese, tipologia) {
    // Fornitore lookup per flag interno
    const fornitoreByNorm = new Map();
    for (const f of fornitoriAll) {
      fornitoreByNorm.set(normalizzaRagioneSociale(f.ragione_sociale), f);
    }
    function isInterno(nome) {
      const f = fornitoreByNorm.get(normalizzaRagioneSociale(nome));
      return !!(f && f.interno === true);
    }

    // Tariffe con prestazione vuota → anomalia
    const anomalie = [];
    for (const t of tariffeAll) {
      if (t.stato !== 'attivo') continue;
      if (isEmpty(t.prestazione)) {
        anomalie.push({
          descrizione: `Tariffa senza prestazione assegnata (ID ${t.id}) — fornitore: ${t.fornitore_nome || '—'}`,
          fornitore: t.fornitore_nome || '—',
          prestazione: '(vuota)',
          classe: t.classe_materiale || '—',
          ambito: '—',
          tonnellate: 0,
        });
      }
    }
      // Le tariffe si leggono tutte, non solo quelle attive. Quando un prezzo
      // viene rinegoziato, la tariffa vecchia viene chiusa con una data di fine
      // e messa a non_attivo: se si leggessero solo le attive, tutti i mesi
      // prima del cambio resterebbero senza prezzo e finirebbero a zero. A
      // decidere se una tariffa vale per un movimento e' la sua finestra di
      // validita', non il suo stato. Resta fuori solo la tariffa disattivata
      // senza data di fine: quella non e' una rinegoziazione, e' una tariffa
      // che non deve valere mai.
      const valeAlmenoUnPeriodo = (t) => t.stato === 'attivo' || !!t.data_fine_validita;
    const tariffe = tariffeAll.filter(t => !isEmpty(t.prestazione) && valeAlmenoUnPeriodo(t));

    // Il prezzo unico e una tariffa di trattamento per lo stesso fornitore e lo
    // stesso canale non possono convivere: si pagherebbe due volte lo stesso
    // trattamento. Meglio dirlo prima che dopo.
    for (const t of tariffe.filter(x => x.prestazione === 'RACCOLTA' && x.comprensiva_trattamento === true && x.tipologia === tipologia)) {
      const doppia = tariffe.find(x => x.prestazione === 'TRATTAMENTO'
        && normalizzaRagioneSociale(x.fornitore_nome) === normalizzaRagioneSociale(t.fornitore_nome)
        && x.tipologia === t.tipologia);
      if (!doppia) continue;
      anomalie.push({
        descrizione: `${t.fornitore_nome || '—'}: la raccolta ${t.tipologia} e' a prezzo unico comprensivo del trattamento, ma esiste anche una tariffa di trattamento (${doppia.valore} ${doppia.unita_misura}). Il trattamento non viene fatturato a parte: se invece va pagato, togli il prezzo unico dalla raccolta.`,
        fornitore: t.fornitore_nome || '—',
        prestazione: 'RACCOLTA / TRATTAMENTO',
        classe: doppia.classe_materiale || '—',
        ambito: `Canale ${t.tipologia}`,
        tonnellate: 0,
      });
    }

    // ─── Filtro comune ───
    // Il mese di competenza e' quello in cui e' finito il trasporto, letto sul
    // giorno italiano.
    function filterRecords(records) {
      return records.filter(r => {
        const stato = String(r.stato || '').toLowerCase().trim();
        if (stato !== 'terminato') return false;
        if (annoRoma(r.trasporto_finito_il) !== annoNum) return false;
        if (meseRoma(r.trasporto_finito_il) !== meseNum) return false;
        return true;
      });
    }

    // Chi fattura per chi: un subraccoglitore raccoglie col proprio nome ma le sue
    // tonnellate le fattura il fornitore principale, con la tariffa del principale.
    const perFattura = mappaFatturazione(fornitoriAll);

    const primarieReteF = filterRecords(primarieRete);
    const primarieAciF = filterRecords(primarieAci);
    const secondarieF = filterRecords(secondarieAll);
    const extraRaccoltaF = filterRecords(extraRaccoltaAll);

    const secondarieAci = secondarieF.filter(isAciRow);
    const secondarieNonAci = secondarieF.filter(r => !isAciRow(r));

    // Sorgenti per tipologia
    let raccoglitoriSource = [];
    let impiantiRecords = []; // array di {record, provenienza}
    let secondarieForBlock = [];

    if (tipologia === 'RETE') {
      raccoglitoriSource = primarieReteF;
      // L'extra raccolta NON entra qui. Prima ci entrava, e cosi' lo stesso
      // carico si pagava due volte: il trattamento compariva una volta nella
      // scheda Rete e una seconda, identico, nella scheda Extra Raccolta.
      // L'extra raccolta e' un canale a se', e si fattura solo nella sua scheda.
      impiantiRecords = [
        ...primarieReteF.map(r => ({ r, provenienza: 'primaria' })),
        ...secondarieNonAci.map(r => ({ r, provenienza: 'secondaria' })),
      ];
      secondarieForBlock = secondarieF;
    } else if (tipologia === 'ACI') {
      raccoglitoriSource = primarieAciF;
      impiantiRecords = [
        ...primarieAciF.map(r => ({ r, provenienza: 'primaria' })),
        ...secondarieAci.map(r => ({ r, provenienza: 'secondaria' })),
      ];
      secondarieForBlock = secondarieF;
    } else {
      raccoglitoriSource = extraRaccoltaF;
      impiantiRecords = extraRaccoltaF.map(r => ({ r, provenienza: 'extra' }));
      secondarieForBlock = [];
    }

    // ─── FORMULARI RIPETUTI ───
    // Un formulario che compare due volte nello stesso mese si paga due volte:
    // la raccolta a chi ha raccolto, lo stoccaggio o il trattamento a chi lo
    // riceve. Nel 2026 le 2.827 primarie di rete non hanno un solo numero
    // ripetuto, quindi una ripetizione non e' la normalita' dell'archivio: e'
    // qualcosa da guardare prima di pagare. Il gestionale la segnala e basta -
    // quale delle due righe sia quella buona lo decide chi conosce il ritiro.
    // Lo stesso record puo' arrivare da due sorgenti (e' raccolta e insieme
    // conferimento): si guarda una volta sola. Poi il raggruppamento per
    // formulario e' quello condiviso, in base44/shared/formulari.ts, cosi' la
    // regola non viene riscritta a modo suo in ogni modulo.
    const vistiId = new Set();
    const righeDelMese = [];
    const raccogliRiga = (rec) => {
      if (!rec || !rec.id || vistiId.has(rec.id)) return;
      vistiId.add(rec.id);
      if (!chiaveFormulario(rec)) return;
      righeDelMese.push(rec);
    };
    for (const rec of raccoglitoriSource) raccogliRiga(rec);
    for (const { r: rec } of impiantiRecords) raccogliRiga(rec);
    const perFir = raggruppaPerFormulario(righeDelMese);
    // Lo stesso formulario su piu' ordini non e' un errore: nell'ACI e' il modo
    // normale di stare dentro le regole del portale. Una richiesta ACI non puo'
    // essere stimata sotto i 1.500 kg, e un formulario non puo' chiudersi a piu'
    // del 10% del peso stimato del suo ticket (il Numero_Ordine_Interno): quando
    // il carico supera quella soglia, il peso effettivo si ripartisce su un
    // secondo ordine, con il suo ticket e il suo stimato. In fattura conta solo
    // la somma dei pesi effettivi, ma la scomposizione si tiene e si mostra.
    //
    // Il 9 giugno 2026 il formulario RGYTR022620TW sta su ET26091175 (ticket
    // 162684-15, stimato 2.800, effettivo 1.960) e su ET26102183 (ticket
    // 163142-85, stimato 1.500, effettivo 1.500): tutti i 3.460 kg sul primo
    // ticket avrebbero sforato i 3.080 ammessi.
    //
    // Resta invece un'anomalia vera il formulario che compare due volte sullo
    // STESSO ordine: quello si', e' un ritiro caricato due volte, e si pagherebbe
    // due volte.
    const formulariRipartiti = [];
    for (const [fir, righe] of perFir) {
      if (righe.length < 2) continue;
      const kg = righe.reduce((s, x) => s + Number(x.peso_effettivo || 0), 0);
      const ordini = [...new Set(righe.map(ordineDi).filter(Boolean))];

      if (ordini.length > 1) {
        formulariRipartiti.push({
          numero_fir: fir,
          trasportatore: righe[0].trasportatore || '—',
          destinazione: righe[0].destinazione || '—',
          classe: String(righe[0].classe || '—'),
          tonnellate_fatturate: round3(kg / 1000),
          quote: righe.map(x => {
            const stimato = Math.round(Number(x.peso_stimato || 0));
            const effettivo = Math.round(Number(x.peso_effettivo || 0));
            const massimo = stimato ? Math.round(stimato * SOGLIA_ACI) : 0;
            return {
              id_ordine: ordineDi(x) || '—',
              ticket: ticketDi(x) || '—',
              peso_stimato_kg: stimato,
              peso_effettivo_kg: effettivo,
              massimo_ammesso_kg: massimo,
              oltre_soglia: !!(massimo && effettivo > massimo),
            };
          }).sort((a, b) => b.peso_effettivo_kg - a.peso_effettivo_kg),
        });
        continue;
      }

      const pesi = righe.map(x => `${Math.round(Number(x.peso_effettivo || 0))} kg`).join(' + ');
      anomalie.push({
        descrizione: `Formulario ${fir} presente ${righe.length} volte sullo stesso ordine ${ordini[0] || '—'} (${pesi}): e' lo stesso ritiro caricato piu' volte, e raccolta, stoccaggio e trattamento si pagano due volte. ${righe[0].trasportatore || '—'} → ${righe[0].destinazione || '—'}.`,
        fornitore: righe[0].trasportatore || '—',
        prestazione: 'FORMULARIO RIPETUTO',
        classe: String(righe[0].classe || '—'),
        ambito: `FIR ${fir}`,
        tonnellate: round3(kg / 1000),
      });
    }

    // ─── LE DUE REGOLE DEL PORTALE SULL'ACI ───
    // Si controllano qui perche' e' il peso effettivo che si paga, e un
    // formulario chiuso oltre la soglia e' un formulario da correggere prima di
    // fatturarlo.
    if (tipologia === 'ACI') {
      for (const rec of raccoglitoriSource) {
        const stimato = Number(rec.peso_stimato || 0);
        const effettivo = Number(rec.peso_effettivo || 0);
        const ticket = ticketDi(rec) || '—';
        if (stimato > 0 && effettivo > stimato * SOGLIA_ACI) {
          const eccesso = Math.round((effettivo / stimato - 1) * 1000) / 10;
          anomalie.push({
            descrizione: `Formulario ${rec.numero_fir || '—'} (ordine ${rec.id_ordine || '—'}, ticket ${ticket}) chiuso a ${Math.round(effettivo)} kg su ${Math.round(stimato)} stimati, cioe' +${eccesso}%: oltre il 10% ammesso per un ticket ACI. Il peso in eccesso va ripartito su un altro ordine.`,
            fornitore: rec.trasportatore || '—',
            prestazione: 'SOGLIA ACI',
            classe: String(rec.classe || '—'),
            ambito: `FIR ${rec.numero_fir || '—'}`,
            tonnellate: round3(effettivo / 1000),
          });
        }
        if (stimato > 0 && stimato < MINIMO_ACI_KG) {
          anomalie.push({
            descrizione: `Ordine ${rec.id_ordine || '—'} (ticket ${ticket}) stimato ${Math.round(stimato)} kg: una richiesta ACI non puo' essere stimata sotto i ${MINIMO_ACI_KG} kg.`,
            fornitore: rec.trasportatore || '—',
            prestazione: 'MINIMO ACI',
            classe: String(rec.classe || '—'),
            ambito: `FIR ${rec.numero_fir || '—'}`,
            tonnellate: round3(effettivo / 1000),
          });
        }
      }
    }

    // ─── BLOCCO 1: RACCOGLITORI (RACCOLTA) ───
    const tonnellateTotali = raccoglitoriSource.reduce((s, r) => s + Number(r.peso_effettivo || 0), 0) / 1000;

    const raccPerGroup = new Map();   // €/t, €/kg: (trasKey|provincia|destinazione|tariffa)
    const raccPerTras = new Map();     // €/viaggio: trasKey

    for (const r of raccoglitoriSource) {
      const raccoglitore = String(r.trasportatore || '').trim();
      if (!raccoglitore) {
        // Senza raccoglitore non si sa a chi pagare: il peso uscirebbe dai
        // conti senza che nessuno se ne accorga.
        anomalie.push({
          descrizione: `Formulario ${r.numero_fir || '—'} senza raccoglitore: non viene fatturato a nessuno.`,
          fornitore: '—', prestazione: 'RACCOLTA', classe: String(r.classe || '—'),
          ambito: `Dest: ${r.destinazione || '—'}`,
          tonnellate: round3(Number(r.peso_effettivo || 0) / 1000),
        });
        continue;
      }
      const fatt = fatturaA(perFattura, raccoglitore);
      const trasportatore = fatt.nome;
      const trasKey = fatt.chiave;
      const provincia = norm(r.provincia);
      const destinazione = norm(r.destinazione);
      const regione = getRegione(r);
      const classe = String(r.classe || '').trim();
      const dataIso = r.trasporto_finito_il;
      const peso = Number(r.peso_effettivo || 0);
      const viaggioKey = chiaveViaggio(r);
      const interno = isInterno(trasportatore);

      const tariffa = tipologia === 'EXTRA_RACCOLTA'
        ? tariffaDallIntervento(r, 'RACCOLTA')
        : findTariffaRaccolta(tariffe, trasKey, provincia, regione, destinazione, classe, tipologia, dataIso);
      const tk = tariffa ? tariffa.id : '__NESSUNA__';
      const um = tariffa ? tariffa.unita_misura : '';

      // Un intervento a zero puo' essere giusto (SMOCO raccoglie da se'), ma se
      // un contratto di extra raccolta un prezzo lo prevede, il campo e' rimasto
      // vuoto per dimenticanza e la raccolta finirebbe non pagata. Il contratto
      // di rete non conta: non e' il prezzo di un intervento (22/09/2026).
      if (tipologia === 'EXTRA_RACCOLTA' && !interno && tariffa.valore === 0) {
        const daContratto = findTariffaRaccolta(tariffe, trasKey, provincia, regione, destinazione, classe, 'EXTRA_RACCOLTA', dataIso);
        if (daContratto && Number(daContratto.valore) > 0) {
          anomalie.push({
            descrizione: `Extra raccolta: sull'intervento il costo di raccolta e' zero, ma per ${trasportatore} il contratto di extra raccolta prevede ${daContratto.valore} ${daContratto.unita_misura}. Se va pagato, scrivilo sull'intervento.`,
            fornitore: trasportatore,
            prestazione: 'RACCOLTA',
            classe: classe || '—',
            ambito: `FIR ${r.numero_fir || '—'}`,
            tonnellate: round3(peso / 1000),
          });
        }
      }

      if (!tariffa && !interno) {
        anomalie.push({
          descrizione: `Raccoglitore senza tariffa RACCOLTA: ${trasportatore}`,
          fornitore: trasportatore,
          prestazione: 'RACCOLTA',
          classe: classe || '—',
          ambito: `Prov: ${provincia || '—'}, Dest: ${r.destinazione || '—'}`,
          tonnellate: round3(peso / 1000),
        });
      }

      if (um === '€/viaggio') {
        if (!raccPerTras.has(trasKey)) {
          raccPerTras.set(trasKey, {
            trasportatore, trasKey, interno,
            peso_kg: 0, viaggiSet: new Set(), perTariffa: new Map(), diCui: new Map(),
          });
        }
        const g = raccPerTras.get(trasKey);
        g.peso_kg += peso;
        g.viaggiSet.add(viaggioKey);
        if (fatt.subfornitore) segnaDiCui(g.diCui, fatt.subfornitore, peso, viaggioKey);
        if (!g.perTariffa.has(tk)) g.perTariffa.set(tk, { tariffa, viaggiSet: new Set(), peso_kg: 0 });
        const pt = g.perTariffa.get(tk);
        pt.viaggiSet.add(viaggioKey);
        pt.peso_kg += peso;
      } else {
        const key = `${trasKey}|${provincia}|${destinazione}|${tk}`;
        if (!raccPerGroup.has(key)) {
          raccPerGroup.set(key, {
            trasportatore, trasKey, provincia, destinazione, interno,
            tariffa, peso_kg: 0, viaggiSet: new Set(), classi_set: new Set(), diCui: new Map(),
          });
        }
        const g = raccPerGroup.get(key);
        g.peso_kg += peso;
        g.viaggiSet.add(viaggioKey);
        if (classe) g.classi_set.add(classe);
        if (fatt.subfornitore) segnaDiCui(g.diCui, fatt.subfornitore, peso, viaggioKey);
      }
    }

    // Righe raccoglitori
    const raccoglitoriRows = [];
    // €/t, €/kg
    for (const g of raccPerGroup.values()) {
      const tonnellate = g.peso_kg / 1000;
      const um = g.tariffa ? g.tariffa.unita_misura : '';
      const valore = g.tariffa ? g.tariffa.valore : 0;
      let importo = 0;
      if (g.tariffa && !g.interno) importo = calcImporto(um, valore, g.peso_kg, g.viaggiSet.size);
      raccoglitoriRows.push({
        fornitore: g.trasportatore, fornitore_norm: g.trasKey, interno: g.interno, di_cui: elencoDiCuiConViaggi(g.diCui),
        riga: {
          provincia: g.provincia || '—', destinazione: g.destinazione || '—',
          classe: Array.from(g.classi_set).join(', ') || '—',
          tonnellate: round3(tonnellate), viaggi: g.viaggiSet.size,
          tariffa_valore: valore, unita_misura: um,
          // Con che criterio e' stata scelta: destinazione, provincia, regione o
          // generica. Si vede subito quando un contratto prevede un prezzo per
          // destinazione e si sta applicando invece quello generico.
          tariffa_criterio: g.tariffa ? (g.tariffa.criterio || 'generica') : '',
          importo: round2(importo),
          note: g.interno ? 'interno, non fatturato' : (!g.tariffa ? 'senza tariffa' : ''),
        },
      });
    }
    // €/viaggio
    for (const g of raccPerTras.values()) {
      const tonnellate = g.peso_kg / 1000;
      let importo = 0, um = '', valore = 0, viaggiFatturati = 0;
      for (const pt of g.perTariffa.values()) {
        if (!pt.tariffa || g.interno) continue;
        importo += calcImporto(pt.tariffa.unita_misura, pt.tariffa.valore, pt.peso_kg, pt.viaggiSet.size);
        viaggiFatturati += pt.viaggiSet.size;
        um = pt.tariffa.unita_misura; valore = pt.tariffa.valore;
      }
      // I viaggi a video sono quelli fatturati, altrimenti la moltiplicazione
      // mostrata non tornerebbe con l'importo. Se sono piu' dei viaggi
      // distinti, lo stesso camion dello stesso giorno e' finito sotto due
      // tariffe e si sta pagando due volte: si segnala.
      const viaggi = g.interno ? g.viaggiSet.size : (viaggiFatturati || g.viaggiSet.size);
      if (!g.interno && viaggiFatturati > g.viaggiSet.size) {
        anomalie.push({
          descrizione: `${g.trasportatore}: ${viaggiFatturati} viaggi fatturati su ${g.viaggiSet.size} viaggi distinti. Lo stesso mezzo nello stesso giorno ricade sotto due tariffe a viaggio e viene pagato due volte.`,
          fornitore: g.trasportatore,
          prestazione: 'RACCOLTA',
          classe: '—',
          ambito: 'Tariffe a viaggio',
          tonnellate: round3(tonnellate),
        });
      }
      raccoglitoriRows.push({
        fornitore: g.trasportatore, fornitore_norm: g.trasKey, interno: g.interno, di_cui: elencoDiCuiConViaggi(g.diCui),
        riga: {
          provincia: '—', destinazione: '—', classe: '—',
          tonnellate: round3(tonnellate), viaggi,
          tariffa_valore: valore, unita_misura: um,
          importo: round2(importo),
          note: g.interno ? 'interno, non fatturato' : '',
        },
      });
    }

    // Raggruppa per fornitore
    const raccByForn = new Map();
    for (const row of raccoglitoriRows) {
      if (!raccByForn.has(row.fornitore_norm)) {
        raccByForn.set(row.fornitore_norm, {
          fornitore: row.fornitore, interno: row.interno,
          righe: [], totale_tonnellate: 0, totale_euro: 0, diCui: new Map(),
        });
      }
      const f = raccByForn.get(row.fornitore_norm);
      f.righe.push(row.riga);
      f.totale_tonnellate += row.riga.tonnellate;
      f.totale_euro += row.riga.importo;
      for (const d of (row.di_cui || [])) {
        if (!f.diCui.has(d.fornitore)) f.diCui.set(d.fornitore, { peso_kg: 0, viaggiSet: new Set() });
        const acc = f.diCui.get(d.fornitore);
        acc.peso_kg += d.tonnellate * 1000;
        for (const k of (d.viaggi_keys || [])) acc.viaggiSet.add(k);
      }
    }
    const raccoglitori = Array.from(raccByForn.values()).map(f => ({
      fornitore: f.fornitore, interno: f.interno, righe: f.righe,
      totale_tonnellate: round3(f.totale_tonnellate), totale_euro: round2(f.totale_euro),
      // Le tonnellate dei subraccoglitori sono comprese nel totale: si mostrano
      // per sapere quanto ha portato ciascuno, non per fatturarle a lui.
      di_cui: [...f.diCui.entries()].map(([fornitore, v]) => ({ fornitore, tonnellate: round3(v.peso_kg / 1000), viaggi: v.viaggiSet.size }))
        .sort((a, b) => b.tonnellate - a.tonnellate),
    })).sort((a, b) => b.totale_euro - a.totale_euro);

    const tonnellateRaccoglitori = raccoglitori.reduce((s, f) => s + f.totale_tonnellate, 0);

    // ─── BLOCCO 2: IMPIANTI E STOCCAGGI (TRATTAMENTO, CONFERIMENTO_STOCCAGGIO) ───
    const impPerGroup = new Map();  // €/t, €/kg: (destKey|prestazione|classe|provenienza|tariffa)
    const impPerDest = new Map();   // €/viaggio: (destKey|tariffa)

    // Stoccaggio e trattamento si pagano su TUTTO cio' che arriva al sito, non
    // solo su cio' che il titolare del sito ha raccolto: su Nappi Sud conferiscono
    // anche altri raccoglitori e lo stoccaggio si paga anche sul loro conferito,
    // su Gatim conferisce anche Emmesse e il suo quantitativo si somma a quello
    // trattato da Gatim. Il "di cui" qui sotto tiene visibile chi ha portato cosa.
    for (const { r, provenienza } of impiantiRecords) {
      const tipoDest = String(r.tipo_destinazione || '').toLowerCase().trim();
      const prestazione = tipoDest === 'imp' ? 'TRATTAMENTO' : tipoDest === 'stoc' ? 'CONFERIMENTO_STOCCAGGIO' : '';
      if (!prestazione) {
        // Anomalia: tipo_destinazione assente o diverso
        anomalie.push({
          descrizione: `Record con tipo_destinazione non valido ("${tipoDest || 'assente'}") — fornitore: ${r.destinazione || '—'}`,
          fornitore: r.destinazione || '—',
          prestazione: '(non calcolato)',
          classe: String(r.classe || '—'),
          ambito: `Prov: ${norm(r.provincia) || '—'}, Dest: ${r.destinazione || '—'}`,
          tonnellate: round3(Number(r.peso_effettivo || 0) / 1000),
        });
        continue;
      }
      const destinazione = String(r.destinazione || '').trim();
      if (!destinazione) {
        anomalie.push({
          descrizione: `Formulario ${r.numero_fir || '—'} senza destinazione: il trattamento o lo stoccaggio non viene fatturato a nessuno.`,
          fornitore: '—', prestazione, classe: String(r.classe || '—'),
          ambito: `Raccoglitore: ${r.trasportatore || '—'}`,
          tonnellate: round3(Number(r.peso_effettivo || 0) / 1000),
        });
        continue;
      }
      const destKey = normalizzaRagioneSociale(destinazione);
      const classe = String(r.classe || '').trim();
      const dataIso = r.trasporto_finito_il;
      const peso = Number(r.peso_effettivo || 0);
      const viaggioKey = chiaveViaggio(r);
      const interno = isInterno(destinazione);

      // Chi ha materialmente portato il carico: il raccoglitore per le primarie
      // e per l'extra raccolta, lo stoccaggio di partenza per le secondarie.
      const conferente = (provenienza === 'secondaria'
        ? String(r.stoccaggio || '').trim()
        : String(r.trasportatore || '').trim()) || '—';

      // Prezzo unico: una tariffa di raccolta puo' comprendere anche il
      // trattamento. Nel 2026 capita solo con Green Tyre Project sull'ACI, a 225
      // euro la tonnellata: si paga una volta sola, sul conferito, senza scindere
      // la raccolta dal trattamento. Vale solo quando chi ha raccolto e chi
      // tratta sono lo stesso fornitore in fattura.
      const fattConf = fatturaA(perFattura, conferente);
      const tarRacc = prestazione === 'TRATTAMENTO' && provenienza !== 'extra' && fattConf.chiave === destKey
        ? findTariffaRaccolta(tariffe, destKey, norm(r.provincia), getRegione(r), norm(destinazione), classe, tipologia, dataIso)
        : null;
      const compresoNellaRaccolta = !!(tarRacc && tarRacc.comprensiva_trattamento === true);

      const tariffa = compresoNellaRaccolta
        ? null
        : provenienza === 'extra'
          ? tariffaDallIntervento(r, prestazione)
          : findTariffaImpianto(tariffe, destKey, prestazione, classe, tipologia, dataIso);

      // Stesso discorso per chi tratta o stocca un intervento di extra raccolta:
      // se il campo e' vuoto ma un contratto di extra raccolta un prezzo lo
      // prevede, si segnala. Il contratto di rete non conta (22/09/2026).
      if (provenienza === 'extra' && !interno && tariffa && tariffa.valore === 0) {
        const daContratto = findTariffaImpianto(tariffe, destKey, prestazione, classe, 'EXTRA_RACCOLTA', dataIso);
        if (daContratto && Number(daContratto.valore) > 0) {
          anomalie.push({
            descrizione: `Extra raccolta: sull'intervento il costo di ${prestazione === 'TRATTAMENTO' ? 'trattamento' : 'stoccaggio'} e' zero, ma per ${destinazione} il contratto di extra raccolta prevede ${daContratto.valore} ${daContratto.unita_misura}. Se va pagato, scrivilo sull'intervento.`,
            fornitore: destinazione,
            prestazione,
            classe: classe || '—',
            ambito: `FIR ${r.numero_fir || '—'}`,
            tonnellate: round3(peso / 1000),
          });
        }
      }
      const tk = compresoNellaRaccolta ? '__COMPRESO__' : (tariffa ? tariffa.id : '__NESSUNA__');
      const um = tariffa ? tariffa.unita_misura : '';

      if (!tariffa && !interno && !compresoNellaRaccolta) {
        anomalie.push({
          descrizione: `Impianto/stoccaggio senza tariffa ${prestazione}: ${destinazione}`,
          fornitore: destinazione,
          prestazione,
          classe: classe || '—',
          ambito: `Prov: ${provenienza}`,
          tonnellate: round3(peso / 1000),
        });
      }

      if (um === '€/viaggio') {
        const dkey = `${destKey}|${tk}`;
        if (!impPerDest.has(dkey)) {
          impPerDest.set(dkey, {
            destinazione, destKey, interno, tariffa, compresoNellaRaccolta,
            peso_kg: 0, viaggiSet: new Set(), diCui: new Map(),
          });
        }
        const g = impPerDest.get(dkey);
        g.peso_kg += peso;
        g.viaggiSet.add(viaggioKey);
        segnaDiCui(g.diCui, conferente, peso, viaggioKey);
      } else {
        const key = `${destKey}|${prestazione}|${classe}|${provenienza}|${tk}`;
        if (!impPerGroup.has(key)) {
          impPerGroup.set(key, {
            destinazione, destKey, prestazione, classe, provenienza, interno,
            tariffa, compresoNellaRaccolta, peso_kg: 0, viaggiSet: new Set(), diCui: new Map(),
          });
        }
        const g = impPerGroup.get(key);
        g.peso_kg += peso;
        g.viaggiSet.add(viaggioKey);
        segnaDiCui(g.diCui, conferente, peso, viaggioKey);
      }
    }

    const impiantiRows = [];
    for (const g of impPerGroup.values()) {
      const tonnellate = g.peso_kg / 1000;
      const um = g.tariffa ? g.tariffa.unita_misura : '';
      const valore = g.tariffa ? g.tariffa.valore : 0;
      let importo = 0;
      if (g.tariffa && !g.interno) importo = calcImporto(um, valore, g.peso_kg, g.viaggiSet.size);
      impiantiRows.push({
        fornitore: g.destinazione, fornitore_norm: g.destKey, interno: g.interno,
        riga: {
          prestazione: g.prestazione, classe: g.classe || '—', provenienza: g.provenienza,
          tonnellate: round3(tonnellate), viaggi: g.viaggiSet.size,
          tariffa_valore: valore, unita_misura: um,
          importo: round2(importo),
          compreso_nella_raccolta: !!g.compresoNellaRaccolta,
          di_cui: elencoDiCui(g.diCui),
          note: g.interno ? 'interno, non fatturato'
            : g.compresoNellaRaccolta ? 'compreso nel prezzo unico della raccolta'
            : (!g.tariffa ? 'senza tariffa' : ''),
        },
      });
    }
    for (const g of impPerDest.values()) {
      const tonnellate = g.peso_kg / 1000;
      const um = g.tariffa ? g.tariffa.unita_misura : '';
      const valore = g.tariffa ? g.tariffa.valore : 0;
      let importo = 0;
      if (g.tariffa && !g.interno) importo = calcImporto(um, valore, g.peso_kg, g.viaggiSet.size);
      impiantiRows.push({
        fornitore: g.destinazione, fornitore_norm: g.destKey, interno: g.interno,
        riga: {
          prestazione: g.tariffa ? g.tariffa.prestazione : '—',
          classe: '—', provenienza: '—',
          tonnellate: round3(tonnellate), viaggi: g.viaggiSet.size,
          tariffa_valore: valore, unita_misura: um,
          importo: round2(importo),
          compreso_nella_raccolta: !!g.compresoNellaRaccolta,
          di_cui: elencoDiCui(g.diCui),
          note: g.interno ? 'interno, non fatturato'
            : g.compresoNellaRaccolta ? 'compreso nel prezzo unico della raccolta'
            : (!g.tariffa ? 'senza tariffa' : ''),
        },
      });
    }

    const impByForn = new Map();
    for (const row of impiantiRows) {
      if (!impByForn.has(row.fornitore_norm)) {
        impByForn.set(row.fornitore_norm, {
          fornitore: row.fornitore, interno: row.interno,
          righe: [], totale_tonnellate: 0, totale_euro: 0,
        });
      }
      const f = impByForn.get(row.fornitore_norm);
      f.righe.push(row.riga);
      f.totale_tonnellate += row.riga.tonnellate;
      f.totale_euro += row.riga.importo;
    }
    const impianti_stoccaggi = Array.from(impByForn.values()).map(f => ({
      ...f, totale_tonnellate: round3(f.totale_tonnellate), totale_euro: round2(f.totale_euro),
    })).sort((a, b) => b.totale_euro - a.totale_euro);

    // La pulizia e gli oneri aggiuntivi di un intervento sono importi fissi che
    // non appartengono a un fornitore: il modulo Extra Raccolta li somma nel
    // costo dell'intervento, qui non si possono mettere in fattura a nessuno. Si
    // dichiarano, cosi' il totale della passiva non sembra sbagliato a chi
    // confronta i due moduli.
    if (tipologia === 'EXTRA_RACCOLTA') {
      // Un intervento marcato come secondaria e' un trasferimento da uno
      // stoccaggio a un impianto, non una raccolta: finirebbe fra i raccoglitori
      // col nome del trasportatore e col costo di raccolta dell'intervento.
      // Finche' l'extra raccolta non avra' un campo per il costo del trasporto,
      // il gestionale lo dice invece di far finta di niente.
      for (const rec of extraRaccoltaF) {
        if (String(rec.tipo_movimento || 'primaria').toLowerCase().trim() !== 'secondaria') continue;
        anomalie.push({
          descrizione: `Extra raccolta: l'intervento ${rec.numero_fir || '—'} e' un trasferimento da ${rec.stoccaggio || '—'} a ${rec.destinazione || '—'}, ma viene conteggiato come raccolta di ${rec.trasportatore || '—'}. Il trasporto di una secondaria di extra raccolta va verificato a mano.`,
          fornitore: rec.trasportatore || '—',
          prestazione: 'TRASPORTO_SECONDARIA',
          classe: String(rec.classe || '—'),
          ambito: `FIR ${rec.numero_fir || '—'}`,
          tonnellate: round3(Number(rec.peso_effettivo || 0) / 1000),
        });
      }
      for (const rec of extraRaccoltaF) {
        const fissi = Number(rec.costo_pulizia || 0) + Number(rec.costi_aggiuntivi || 0);
        if (fissi <= 0) continue;
        anomalie.push({
          descrizione: `Extra raccolta: l'intervento ${rec.numero_fir || '—'} ha ${round2(fissi)} euro di oneri fissi (pulizia e costi aggiuntivi) che il modulo Extra Raccolta conta nel costo ma qui non sono attribuiti a nessun fornitore. ${rec.note_costi || ''}`.trim(),
          fornitore: rec.destinazione || '—',
          prestazione: 'ONERI INTERVENTO',
          classe: String(rec.classe || '—'),
          ambito: `FIR ${rec.numero_fir || '—'}`,
          tonnellate: 0,
        });
      }
    }

    // ─── BLOCCO 3: TRASPORTO SECONDARIE (TRASPORTO_SECONDARIA) ───
    // Raggruppa per tratta: stoccaggio (produttore), trasportatore, destinazione (destinatario)
    const tratte = new Map();
    for (const r of secondarieForBlock) {
      const stoccaggio = String(r.stoccaggio || '').trim();
      const trasportatore = String(r.trasportatore || '').trim();
      const destinazione = String(r.destinazione || '').trim();
      if (!stoccaggio || !trasportatore || !destinazione) continue;
      const trasKey = normalizzaRagioneSociale(trasportatore);
      const key = `${normalizzaRagioneSociale(stoccaggio)}|${trasKey}|${normalizzaRagioneSociale(destinazione)}`;
      if (!tratte.has(key)) {
        tratte.set(key, { stoccaggio, trasportatore, trasKey, destinazione, records: [] });
      }
      tratte.get(key).records.push(r);
    }

    const trasportiRows = [];
    for (const tratta of tratte.values()) {
      // Anche qui vale la catena dei subfornitori: chi trasporta col proprio
      // nome puo' fatturare tramite il principale, come nei primi due blocchi.
      const fatt = fatturaA(perFattura, tratta.trasportatore);
      const fatturante = fatt.nome;
      const fatturanteKey = fatt.chiave;
      const interno = isInterno(fatturante);
      // Sub-raggruppa per tariffa (validita' per record)
      const perTariffa = new Map();
      for (const r of tratta.records) {
        const tariffa = findTariffaSecondaria(tariffe, fatturanteKey, tratta.stoccaggio, tratta.destinazione, tipologia, r.trasporto_finito_il);
        const tk = tariffa ? tariffa.id : '__NESSUNA__';
        if (!perTariffa.has(tk)) perTariffa.set(tk, { tariffa, records: [] });
        perTariffa.get(tk).records.push(r);
      }

      for (const pt of perTariffa.values()) {
        const aciQui = tipologia === 'ACI';
        const nomeQui = aciQui ? 'ACI' : 'rete';
        const nomeAltro = aciQui ? 'rete' : 'ACI';
        const tipAltro = aciQui ? 'RETE' : 'ACI';
        const conAltro = aciQui ? 'con la rete' : 'con l\'ACI';
        const quotaQui = aciQui ? 'la quota ACI' : 'la quota di rete';
        const quotaAltro = aciQui ? 'la quota di rete' : 'la quota ACI';

        // Ogni viaggio (un mezzo in un giorno) con i chili e i formulari di
        // ciascun canale. Un viaggio e' di questo canale se porta almeno un suo
        // formulario: intero se porta solo quelli, misto se porta anche l'altro
        // canale. Prima un viaggio misto era tutto della rete.
        const perViaggio = new Map();
        for (const rec of pt.records) {
          const k = chiaveViaggio(rec);
          // data: il giorno del viaggio, per la tariffa dell'altro canale
          if (!perViaggio.has(k)) perViaggio.set(k, { kgRete: 0, kgAci: 0, nRete: 0, nAci: 0, senzaTarga: false, data: rec.trasporto_finito_il });
          const v = perViaggio.get(k);
          const kg = Number(rec.peso_effettivo || 0);
          if (isAciRow(rec)) { v.kgAci += kg; v.nAci++; } else { v.kgRete += kg; v.nRete++; }
          if (!String(rec.automezzo || '').trim()) v.senzaTarga = true;
        }
        const kgQui = (v) => (aciQui ? v.kgAci : v.kgRete);
        const kgAltro = (v) => (aciQui ? v.kgRete : v.kgAci);
        const viaggiDelCanale = [...perViaggio.values()].filter(v => (aciQui ? v.nAci : v.nRete) > 0);
        const misti = viaggiDelCanale.filter(v => v.nRete > 0 && v.nAci > 0);
        const viaggiInteri = viaggiDelCanale.length - misti.length;
        const viaggiConFormulari = viaggiDelCanale.length;
        const viaggiTotali = perViaggio.size;
        const viaggioMisto = misti.length > 0;
        // Senza targa, fra i viaggi di questo canale: quelli di soli formulari
        // dell'altro canale non sono affar suo, e l'anomalia uscirebbe due volte.
        const senzaTarga = viaggiDelCanale.some(v => v.senzaTarga);
        const um = pt.tariffa ? pt.tariffa.unita_misura : '';
        const valore = pt.tariffa ? pt.tariffa.valore : 0;

        // Le tonnellate di questo canale: sono la base di tutto quello che
        // segue, riga e anomalie comprese. Quelle dell'altro canale si dicono
        // solo per i viaggi misti, perche' spiegano la proporzione.
        const tonnellateCanale = viaggiDelCanale.reduce((s, v) => s + kgQui(v), 0) / 1000;
        const kgQuiMisti = misti.reduce((s, v) => s + kgQui(v), 0);
        const kgAltroMisti = misti.reduce((s, v) => s + kgAltro(v), 0);

        // La tariffa dell'altro canale per un viaggio misto, alla data di quel
        // viaggio: la passiva dell'altro canale paga la sua quota solo se li' la
        // tratta ha una tariffa, sua o TUTTE. Con una tariffa a viaggio della sola
        // rete la vista RETE pagava la sua quota e diceva che il resto stava nella
        // passiva ACI, dove c'era soltanto "tratta senza tariffa": la quota ACI
        // non si pagava da nessuna parte e nessun testo diceva quanto valeva
        // (revisione del 22/09/2026). Ora la quota scoperta si dice, con l'importo,
        // in tutte e due le viste.
        const tariffaAltro = (v) => findTariffaSecondaria(tariffe, fatturanteKey, tratta.stoccaggio, tratta.destinazione, tipAltro, v.data);

        // Se in questo canale la tratta non ha portato niente, non e' affar suo:
        // niente riga e nemmeno l'anomalia, che altrimenti uscirebbe due volte,
        // una per canale, anche dove non c'entra.
        if (round3(tonnellateCanale) === 0 && viaggiConFormulari === 0) continue;

        if (!pt.tariffa && !interno) {
          // Sui viaggi misti l'altro canale paga solo la sua quota dei chili: la
          // quota di questo canale resta da pagare, e si dice quanto vale alla
          // tariffa che la tratta ha nell'altro canale.
          const quiScoperta = { n: 0, quota: 0, kg: 0, euro: 0, aViaggio: false, prezzi: new Set() };
          for (const v of misti) {
            const tA = tariffaAltro(v);
            if (!tA) continue;
            quiScoperta.n++;
            quiScoperta.kg += kgQui(v);
            if (tA.unita_misura === '€/viaggio') {
              const q = quoteViaggioMisto(tA.valore, v.kgRete, v.kgAci, v.nRete, v.nAci);
              quiScoperta.quota += aciQui ? q.quota_aci : q.quota_rete;
              quiScoperta.euro += aciQui ? q.ACI : q.RETE;
              quiScoperta.aViaggio = true;
            } else {
              quiScoperta.euro += calcImporto(tA.unita_misura, tA.valore, kgQui(v), 0);
            }
            quiScoperta.prezzi.add(`${euroTesto(tA.valore)} ${tA.unita_misura}`);
          }
          let dettaglio = '';
          if (quiScoperta.n) {
            const n = quiScoperta.n;
            const prezzo = quiScoperta.prezzi.size === 1 ? ` (${[...quiScoperta.prezzi][0]})` : '';
            const quanto = quiScoperta.aViaggio ? `${numTesto(quiScoperta.quota)} viaggi, ${tTesto(quiScoperta.kg)} t` : `${tTesto(quiScoperta.kg)} t`;
            dettaglio = `. ${n === 1 ? 'Sul viaggio misto' : `Sui ${n} viaggi misti`} ${conAltro} la passiva ${tipAltro} paga solo ${quotaAltro} dei chili: ${quotaQui} (${quanto}) resta da pagare, ${euroTesto(quiScoperta.euro)} € alla tariffa ${aciQui ? 'di rete' : 'ACI'} della tratta${prezzo}, finche' la tratta non ha una tariffa ${tipologia} o TUTTE`;
          }
          anomalie.push({
            descrizione: `Tratta secondaria senza tariffa TRASPORTO_SECONDARIA: ${tratta.stoccaggio} → ${tratta.destinazione} (trasportatore: ${tratta.trasportatore})${dettaglio}`,
            fornitore: fatturante,
            prestazione: 'TRASPORTO_SECONDARIA',
            classe: '—',
            ambito: `${tratta.stoccaggio} → ${tratta.destinazione}`,
            tonnellate: round3(tonnellateCanale),
            ...(quiScoperta.n ? {
              viaggi_misti: quiScoperta.n,
              viaggi_quota: quiScoperta.aViaggio ? round2(quiScoperta.quota) : null,
              importo_da_pagare: round2(quiScoperta.euro),
            } : {}),
          });
          continue;
        }

        // La quota dell'altro canale sui viaggi misti di cui l'altro canale non
        // ha una tariffa: la si dice nella nota, e la nota non e' piu' solo
        // un'informazione. Importo e quota sono calcolati a questa tariffa.
        const scoperta = { n: 0, quota: 0, kg: 0, euro: 0 };
        const restoMisti = (n, aViaggio) => {
          const dove = `sta nella passiva ${tipAltro}`;
          if (!scoperta.n) return `Il resto ${n === 1 ? 'del viaggio misto' : 'dei viaggi misti'} ${dove}.`;
          const coperti = n - scoperta.n;
          const quali = !coperti
            ? (n === 1 ? 'del viaggio misto' : 'dei viaggi misti')
            : (scoperta.n === 1 ? 'dell\'altro' : `degli altri ${scoperta.n}`);
          const quanto = aViaggio
            ? `${numTesto(scoperta.quota)} viaggi, ${euroTesto(scoperta.euro)} € a questa tariffa`
            : `${tTesto(scoperta.kg)} t, ${euroTesto(scoperta.euro)} € a questa tariffa`;
          const scop = `${quotaAltro} ${quali} (${quanto}) non ha una tariffa ${tipAltro} o TUTTE per la tratta e resta da pagare.`;
          return coperti
            ? `Il resto di ${coperti} ${coperti === 1 ? 'viaggio misto' : 'viaggi misti'} ${dove}; ${scop}`
            : scop.charAt(0).toUpperCase() + scop.slice(1);
        };

        // Un viaggio misto non e' piu' un'anomalia (22/09/2026): a viaggio si
        // divide in proporzione ai chili, a tonnellata ogni canale paga i suoi.
        // La nota della riga dice come, ed e' un'informazione, non un problema;
        // lo diventa solo se l'altro canale non ha una tariffa per la sua quota.
        let importo = 0;
        let note = '';
        let notaInformativa = false;
        let viaggiQuota = viaggiConFormulari;
        if (interno) {
          importo = 0;
          note = 'interno, non fatturato';
        } else if (um === '€/viaggio') {
          // I viaggi interi si pagano per intero; di ogni viaggio misto questo
          // canale paga la sua quota dei chili (quoteViaggioMisto).
          let parteMisti = 0, quotaMisti = 0;
          for (const v of misti) {
            const q = quoteViaggioMisto(valore, v.kgRete, v.kgAci, v.nRete, v.nAci);
            parteMisti += aciQui ? q.ACI : q.RETE;
            quotaMisti += aciQui ? q.quota_aci : q.quota_rete;
            if (!tariffaAltro(v)) {
              scoperta.n++;
              scoperta.kg += kgAltro(v);
              scoperta.quota += aciQui ? q.quota_rete : q.quota_aci;
              scoperta.euro += aciQui ? q.RETE : q.ACI;
            }
          }
          importo = viaggiInteri * valore + parteMisti;
          viaggiQuota = round2(viaggiInteri + quotaMisti);
          if (misti.length) {
            const n = misti.length;
            const interi = viaggiInteri
              ? `${viaggiInteri} ${viaggiInteri === 1 ? 'viaggio intero' : 'viaggi interi'} a ${euroTesto(valore)} € e `
              : `nessun viaggio di soli formulari ${nomeQui}; `;
            const stessi = n === 1 ? 'sullo stesso viaggio' : 'sugli stessi viaggi';
            note = `${interi}${n} ${n === 1 ? 'viaggio misto' : 'viaggi misti'} ${conAltro}, ${n === 1 ? 'pagato' : 'pagati'} per ${quotaQui} dei chili (${tTesto(kgQuiMisti)} t ${nomeQui} e ${tTesto(kgAltroMisti)} t ${nomeAltro} ${stessi}): ${numTesto(quotaMisti)} viaggi, ${euroTesto(parteMisti)} €. ${restoMisti(n, true)}`;
            notaInformativa = scoperta.n === 0;
          }
          if (senzaTarga && viaggiConFormulari > 0) {
            anomalie.push({
              descrizione: `Tratta a ${valore} euro a viaggio senza targa su almeno un formulario: ${tratta.stoccaggio} → ${tratta.destinazione}. Senza targa i carichi dello stesso giorno contano come un viaggio solo.`,
              fornitore: fatturante,
              prestazione: 'TRASPORTO_SECONDARIA',
              classe: '—',
              ambito: `${tratta.stoccaggio} → ${tratta.destinazione}`,
              // Le tonnellate del canale che si sta guardando: la somma di rete e
              // ACI mescolava i due canali anche nell'elenco delle anomalie.
              tonnellate: round3(tonnellateCanale),
            });
          }
        } else if (um === '€/t' || um === '€/kg') {
          // Ogni canale paga i suoi chili: anche un viaggio misto e' gia' diviso.
          importo = calcImporto(um, valore, tonnellateCanale * 1000, viaggiConFormulari);
          if (misti.length) {
            const n = misti.length;
            for (const v of misti) {
              if (tariffaAltro(v)) continue;
              scoperta.n++;
              scoperta.kg += kgAltro(v);
              scoperta.euro += calcImporto(um, valore, kgAltro(v), 0);
            }
            note = `di cui ${n} ${n === 1 ? 'viaggio misto' : 'viaggi misti'} ${conAltro}: a ${um === '€/t' ? 'tonnellata' : 'chilo'} ogni canale paga i suoi chili.${scoperta.n ? ` ${restoMisti(n, false)}` : ''}`;
            notaInformativa = scoperta.n === 0;
          }
        }

        // Le tonnellate della riga sono sempre e solo quelle del canale che si
        // sta guardando: il totale del trasportatore non somma mai rete e ACI.
        trasportiRows.push({
          fornitore: fatturante, fornitore_norm: fatturanteKey, interno,
          riga: {
            stoccaggio: tratta.stoccaggio, destinazione: tratta.destinazione,
            trasportatore: tratta.trasportatore,
            tonnellate: round3(tonnellateCanale),
            // i chili dell'altro canale sugli stessi viaggi misti: spiegano la
            // proporzione, non entrano in nessun totale
            tonnellate_altro_canale: round3(kgAltroMisti / 1000),
            canale_altro: aciQui ? 'RETE' : 'ACI',
            // I viaggi che hanno portato formulari di questo canale, interi e
            // misti. A viaggio l'importo e' viaggi_interi x tariffa piu' la quota
            // dei misti: viaggi_quota e' il numero di viaggi equivalente.
            viaggi: viaggiConFormulari,
            viaggi_interi: viaggiInteri,
            viaggi_misti: misti.length,
            viaggi_quota: viaggiQuota,
            viaggi_totali_tratta: viaggiTotali,
            tariffa_valore: valore, unita_misura: um,
            importo: round2(importo), viaggio_misto: viaggioMisto, note,
            nota_informativa: notaInformativa,
            // la quota dell'altro canale sui misti che l'altro canale non paga,
            // perche' li' la tratta non ha una tariffa: fuori da ogni totale,
            // calcolata a questa tariffa. null se l'altro canale la paga.
            altro_canale_da_pagare: scoperta.n ? {
              canale: tipAltro,
              viaggi_misti: scoperta.n,
              viaggi_quota: um === '€/viaggio' ? round2(scoperta.quota) : null,
              tonnellate: round3(scoperta.kg / 1000),
              importo: round2(scoperta.euro),
            } : null,
          },
        });
      }
    }

    const trasByForn = new Map();
    for (const row of trasportiRows) {
      if (!trasByForn.has(row.fornitore_norm)) {
        trasByForn.set(row.fornitore_norm, {
          fornitore: row.fornitore, interno: row.interno,
          righe: [], totale_tonnellate: 0, totale_euro: 0,
        });
      }
      const f = trasByForn.get(row.fornitore_norm);
      f.righe.push(row.riga);
      f.totale_tonnellate += row.riga.tonnellate;
      f.totale_euro += row.riga.importo;
    }
    const trasporti_secondaria = Array.from(trasByForn.values()).map(f => ({
      ...f, totale_tonnellate: round3(f.totale_tonnellate), totale_euro: round2(f.totale_euro),
    })).sort((a, b) => b.totale_euro - a.totale_euro);

    // ─── LE DATE OBBLIGATORIE DEI FORMULARI ───
    // Immissione, inizio e fine trasporto sono obbligatorie (regola dell'utente,
    // 22/09/2026). Un terminato senza fine trasporto non entra nel mese e non si
    // paga a nessuno finche' la data manca: si dice quanti e quali, per canale.
    // Anche un terminato del mese con un'altra data mancante o fuori ordine si
    // dice. I movimenti del canale: le primarie e le sue secondarie.
    const movimentiDelCanale = movimentiDateDelCanale({ primarieRete, primarieAci, secondarieAll, extraRaccoltaAll }, tipologia);
    for (const a of anomalieDateFormulari(movimentiDelCanale, annoNum, meseNum, tipologia)) {
      anomalie.push({
        tipo: a.tipo,
        descrizione: a.descrizione,
        fornitore: NOMI_CANALE[tipologia] || tipologia,
        prestazione: 'DATE FORMULARIO',
        classe: '—',
        ambito: `Canale ${tipologia}`,
        tonnellate: round3(a.kg / 1000),
        quanti: a.quanti,
        ordini: a.ordini,
      });
    }

    // Una stessa anomalia puo' nascere da piu' righe uguali: si dice una volta
    // sola, altrimenti l'elenco sembra piu' grave di quello che e'.
    // Due righe che sollevano la stessa anomalia diventano una riga sola, ma le
    // tonnellate si sommano: altrimenti l'anomalia dichiarerebbe il peso di un
    // formulario solo e il problema sembrerebbe piu' piccolo di quello che e'.
    const anomaliePerChiave = new Map();
    for (const a of anomalie) {
      const k = `${a.descrizione}|${a.fornitore}|${a.prestazione}|${a.classe}|${a.ambito}`;
      const prima = anomaliePerChiave.get(k);
      if (!prima) { anomaliePerChiave.set(k, { ...a, occorrenze: 1 }); continue; }
      prima.tonnellate = round3(Number(prima.tonnellate || 0) + Number(a.tonnellate || 0));
      prima.occorrenze += 1;
    }
    const anomalieUniche = [...anomaliePerChiave.values()];

    // ─── TOTALI ───
    const totaleRaccoglitori = raccoglitori.reduce((s, f) => s + f.totale_euro, 0);
    const totaleImpianti = impianti_stoccaggi.reduce((s, f) => s + f.totale_euro, 0);
    const totaleSecondaria = trasporti_secondaria.reduce((s, f) => s + f.totale_euro, 0);

    // ─── QUADRATURA ───
    const coincidente = Math.abs(tonnellateTotali - tonnellateRaccoglitori) < 0.001;

    return {
      anno: annoNum,
      mese,
      tipologia,
      raccoglitori,
      impianti_stoccaggi,
      trasporti_secondaria,
      totali: {
        raccoglitori: round2(totaleRaccoglitori),
        impianti_stoccaggi: round2(totaleImpianti),
        trasporti_secondaria: round2(totaleSecondaria),
        totale_complessivo: round2(totaleRaccoglitori + totaleImpianti + totaleSecondaria),
      },
      anomalie: anomalieUniche,
      // Un formulario il cui peso e' stato ripartito su piu' ordini: non e' un
      // problema, e' come si sta dentro le regole del portale. Si mostra per
      // chiarezza, con i ticket e i pesi di ciascun ordine.
      formulari_ripartiti: formulariRipartiti,
      quadratura: {
        tonnellate_totali: round3(tonnellateTotali),
        tonnellate_raccoglitori: round3(tonnellateRaccoglitori),
        coincidente,
      },
    };
}
