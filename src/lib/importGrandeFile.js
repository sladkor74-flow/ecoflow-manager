import { base44 } from '@/api/base44Client';
import { eAci } from '@/lib/canaleSecondaria';
import { oggiRoma } from '@/lib/giornoItaliano';
import { testoTerminatiSenzaFine, testoOrdiniDateDaSistemare } from '@/lib/richiesteEct';
import { dataServer } from '@/lib/utils';

// Importazione dei report di grandi dimensioni del portale Ecotyre.
//
// Il report delle dichiarazioni di trattamento supera i 4 MB e contiene oltre un
// milione di celle: letto dentro una function esaurisce la memoria disponibile e
// il processo viene terminato dalla piattaforma. Qui il file viene letto nel
// browser, dove la memoria non e' un vincolo, e al backend arrivano solo blocchi
// di poche centinaia di righe gia' estratte.
//
// Lo stesso vale per il file delle primarie: importato tutto in una sola function
// puo' superare il tempo massimo concesso e venire interrotto dopo aver svuotato
// l'archivio, lasciandolo a meta'.
//
// La connessione al database ha un'attesa massima di venti secondi e ogni tanto
// la supera. Il ritentativo sta qui e non nella function: il browser non ha un
// tempo massimo di esecuzione, la function si'. Ogni blocco corrisponde a una
// sola scrittura, quindi o le righe entrano tutte o non ne entra nessuna: prima
// di ritentare si chiede al backend quanti record contiene l'archivio, cosi' un
// blocco arrivato a destinazione nonostante l'errore di rete non viene riscritto.
//
// La mappatura delle colonne resta sul backend, nella function importaBlocco, che
// usa SHEET_MAP come unica fonte: qui le righe si spediscono cosi' come lette.

const RIGHE_PER_BLOCCO = 200;
const ATTESE_RITENTATIVO = [2000, 5000, 10000, 20000];

const pausa = (ms) => new Promise(r => setTimeout(r, ms));

// Il client restituisce gli errori con stato e dati della risposta; le versioni
// precedenti li tenevano in response.
const statoErrore = (e) => (e && (e.status || (e.response && e.response.status))) || undefined;
const datiErrore = (e) => (e && (e.data || (e.response && e.response.data))) || null;

function messaggioErrore(e) {
  const dati = datiErrore(e);
  if (dati && dati.error) return dati.fase ? `${dati.error} (fase: ${dati.fase})` : dati.error;
  return e && e.message ? e.message : String(e);
}

// File rifiutato o caricamento bloccato: non si ritenta, la risposta va mostrata.
const nonRitentabile = (e) => [400, 401, 403, 409].includes(statoErrore(e));

// Legge la sola prima riga del foglio senza materializzare tutte le righe.
function leggiIntestazioni(XLSX, ws) {
  if (!ws || !ws['!ref']) return [];
  const range = XLSX.utils.decode_range(ws['!ref']);
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
    headers.push(cell && cell.v != null ? String(cell.v) : '');
  }
  return headers;
}

// Legge il file: i report del portale hanno un unico foglio; in caso di piu' fogli
// si prende quello con piu' colonne nella prima riga, che e' quello dei dati.
async function leggiFile(file) {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  // cellDates disattivato: le date arrivano come seriali Excel e vengono convertite
  // dal backend, evitando di costruire un oggetto Date per ogni cella.
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  if (!wb.SheetNames.length) throw new Error('Il file non contiene alcun foglio.');
  let nomeFoglio = wb.SheetNames[0];
  let intestazioni = leggiIntestazioni(XLSX, wb.Sheets[nomeFoglio]);
  for (const sn of wb.SheetNames.slice(1)) {
    const h = leggiIntestazioni(XLSX, wb.Sheets[sn]);
    if (h.length > intestazioni.length) { nomeFoglio = sn; intestazioni = h; }
  }
  const righe = XLSX.utils.sheet_to_json(wb.Sheets[nomeFoglio], { raw: true });
  if (righe.length === 0) throw new Error('Il foglio non contiene righe di dati.');
  return { nomeFoglio, intestazioni, righe };
}

// Chiama la function ritentando gli errori di rete, non i rifiuti.
async function invocaConRitentativi(parametri, avvisa, faseRitentativo) {
  for (let tentativo = 0; ; tentativo++) {
    try {
      const res = await base44.functions.invoke('importaBlocco', parametri);
      return res.data || res;
    } catch (e) {
      if (nonRitentabile(e) || tentativo >= ATTESE_RITENTATIVO.length) throw e;
      avvisa({ fase: faseRitentativo });
      await pausa(ATTESE_RITENTATIVO[tentativo]);
    }
  }
}

// Quanti record contiene ora l'archivio. Restituisce null se nemmeno il conteggio
// riesce: in quel caso non si sa se il blocco sia passato e conviene ritentare,
// perche' il controllo finale segnalera' comunque ogni scostamento.
async function chiediConteggio(tipoFile, atteso, minimo, entita) {
  try {
    const res = await base44.functions.invoke('importaBlocco', {
      azione: 'conta', tipo_file: tipoFile, atteso, minimo, entita,
    });
    const dati = res.data || res;
    return typeof dati.conteggio === 'number' ? dati.conteggio : null;
  } catch (e) {
    return null;
  }
}

// Scrive le righe a blocchi con ritentativo e verifica del conteggio.
// avanzamento: { bloccoIniziale, totaleBlocchi, righeIniziali, totaleRighe, archivio }
async function scriviBlocchi({ tipoFile, entita, righe, avvisa, avanzamento }) {
  const totaleBlocchi = Math.ceil(righe.length / RIGHE_PER_BLOCCO);
  let totaleScritte = 0;
  let totaleFallite = 0;
  let ultimoErrore = null;
  let blocchiRitentati = 0;
  const stato = (fase, blocco, extra = {}) => avvisa({
    fase,
    archivio: avanzamento.archivio,
    blocco: avanzamento.bloccoIniziale + blocco,
    totaleBlocchi: avanzamento.totaleBlocchi,
    righeScritte: avanzamento.righeIniziali + totaleScritte,
    totaleRighe: avanzamento.totaleRighe,
    ...extra,
  });

  for (let blocco = 0; blocco < totaleBlocchi; blocco++) {
    const fetta = righe.slice(blocco * RIGHE_PER_BLOCCO, (blocco + 1) * RIGHE_PER_BLOCCO);
    const atteso = totaleScritte + fetta.length;
    let scritto = false;

    for (let tentativo = 0; tentativo <= ATTESE_RITENTATIVO.length && !scritto; tentativo++) {
      if (tentativo > 0) {
        stato('ritentativo', blocco + 1, { tentativo });
        await pausa(ATTESE_RITENTATIVO[tentativo - 1]);

        // La scrittura potrebbe essere arrivata comunque: in quel caso ripeterla
        // creerebbe duplicati. Il conteggio dell'archivio scioglie il dubbio.
        const conteggio = await chiediConteggio(tipoFile, atteso, totaleScritte, entita);
        if (conteggio !== null && conteggio > totaleScritte) {
          totaleScritte = conteggio;
          scritto = true;
          blocchiRitentati++;
          break;
        }
      }

      try {
        const res = await base44.functions.invoke('importaBlocco', {
          azione: 'scrivi', tipo_file: tipoFile, entita, righe: fetta, blocco,
        });
        const dati = res.data || res;
        if (dati.scritte > 0) {
          totaleScritte += dati.scritte;
          scritto = true;
          if (tentativo > 0) blocchiRitentati++;
        } else if (dati.ultimo_errore) {
          ultimoErrore = dati.ultimo_errore;
        }
      } catch (e) {
        // Un blocco rifiutato (per esempio righe di un altro archivio) non si ritenta.
        if (nonRitentabile(e)) throw e;
        ultimoErrore = messaggioErrore(e);
      }
    }

    if (!scritto) totaleFallite += fetta.length;
    stato('scrittura', blocco + 1);
  }

  return { totaleScritte, totaleFallite, ultimoErrore, blocchiRitentati, totaleBlocchi };
}

/**
 * Legge il file nel browser e lo invia al backend a blocchi.
 *
 * @param {File}     file               il file scelto dall'utente
 * @param {string}   tipoFile           chiave del tipo, es. dichiarazioni_trattamento
 * @param {function} onProgress         riceve { fase, blocco, totaleBlocchi, righeScritte, totaleRighe, tentativo }
 * @param {boolean}  confermaForzatura  prosegue nonostante il controllo anti-regressione
 * @returns {Promise<object>}           riepilogo finale
 */
export async function importaGrandeFile({ file, tipoFile, onProgress, confermaForzatura = false }) {
  const avvisa = (dati) => { if (onProgress) onProgress(dati); };

  avvisa({ fase: 'lettura del file nel browser' });
  const { nomeFoglio, intestazioni, righe } = await leggiFile(file);
  const totaleRighe = righe.length;

  // === Preparazione: firma del file, anti-regressione, svuotamento archivio ===
  // Un errore qui viene propagato come eccezione: il file e' da rifiutare e la
  // risposta porta con se' l'indicazione che nulla e' stato toccato.
  avvisa({ fase: 'verifica del file' });
  let datiPrep = null;
  for (let tentativo = 0; ; tentativo++) {
    try {
      const prep = await base44.functions.invoke('importaBlocco', {
        azione: 'prepara',
        tipo_file: tipoFile,
        nome_file: file.name,
        intestazioni,
        totale_righe: totaleRighe,
        conferma_forzatura: confermaForzatura || undefined,
      });
      datiPrep = prep.data || prep;
      // Lo svuotamento e' l'operazione piu' lunga dell'intera importazione ed e'
      // quella che piu' facilmente supera l'attesa massima del database. Si
      // procede solo dopo aver verificato che l'archivio sia davvero vuoto:
      // record superstiti diventerebbero duplicati invisibili.
      const rimasti = await chiediConteggio(tipoFile, 0, 0);
      if (rimasti === 0) break;
      if (tentativo >= ATTESE_RITENTATIVO.length) {
        throw new Error(`Svuotamento dell'archivio incompleto: restano ${rimasti} record. Riprova il caricamento.`);
      }
    } catch (e) {
      // Un file rifiutato o bloccato dal controllo anti-regressione non si
      // ritenta: la risposta va mostrata all'utente cosi' com'e'.
      if (nonRitentabile(e)) throw e;
      if (tentativo >= ATTESE_RITENTATIVO.length) throw e;
      avvisa({ fase: 'nuovo tentativo di preparazione' });
    }
    await pausa(ATTESE_RITENTATIVO[Math.min(tentativo, ATTESE_RITENTATIVO.length - 1)]);
  }
  const avvisoCalo = datiPrep && datiPrep.avviso_calo ? datiPrep.avviso_calo : null;
  const righeArchivioPrima = datiPrep ? datiPrep.righe_archivio_prima : undefined;

  // === Scrittura dei blocchi ===
  const { totaleScritte, totaleFallite, ultimoErrore, blocchiRitentati, totaleBlocchi } = await scriviBlocchi({
    tipoFile, righe, avvisa,
    avanzamento: { bloccoIniziale: 0, totaleBlocchi: Math.ceil(totaleRighe / RIGHE_PER_BLOCCO), righeIniziali: 0, totaleRighe },
  });

  // === Verifica finale: quante righe contiene davvero l'archivio ===
  avvisa({ fase: "verifica dell'archivio" });
  const conteggioFinale = await chiediConteggio(tipoFile, totaleScritte, totaleRighe);
  const disallineamento =
    conteggioFinale !== null && conteggioFinale !== totaleRighe
      ? { archivio: conteggioFinale, file: totaleRighe }
      : null;

  const esito = totaleFallite === 0 && !disallineamento
    ? 'successo'
    : (totaleScritte > 0 ? 'parziale' : 'errore');

  await base44.functions.invoke('importaBlocco', {
    azione: 'registra',
    tipo_file: tipoFile,
    nome_file: file.name,
    righe_importate: totaleScritte,
    righe_fallite: totaleFallite,
    ultimo_errore: ultimoErrore,
    conteggio_finale: conteggioFinale,
    righe_archivio_prima: righeArchivioPrima,
    conferma_forzatura: confermaForzatura || undefined,
  });

  // === Le dichiarazioni caricate a portale si riconoscono da sole ===
  // Dal report appena caricato si capisce quali nostre dichiarazioni mensili sono
  // state caricate e quando: senza questo passo restavano "non caricate" finche'
  // qualcuno non premeva "Allinea dal portale", e la quadratura con il portale
  // restava alta di un mese gia' dichiarato. Se non riesce il caricamento resta
  // buono: lo si dice, e il pulsante in Dichiarazioni Impianti lo rifa'.
  let allineamento = null;
  if (tipoFile === 'dichiarazioni_trattamento' && totaleScritte > 0) {
    avvisa({ fase: 'riconoscimento delle dichiarazioni caricate a portale' });
    try {
      const res = await base44.functions.invoke('importaBlocco', { azione: 'allinea', tipo_file: tipoFile });
      allineamento = (res.data || res).allineamento || null;
    } catch (e) {
      allineamento = { errore: messaggioErrore(e) };
    }
  }

  return {
    tipo_file: tipoFile,
    foglio: nomeFoglio,
    righe_lette: totaleRighe,
    righe_importate: totaleScritte,
    righe_fallite: totaleFallite,
    blocchi: totaleBlocchi,
    blocchi_ritentati: blocchiRitentati,
    conteggio_finale: conteggioFinale,
    avviso_calo: avvisoCalo,
    avviso_disallineamento: disallineamento,
    ultimo_errore: ultimoErrore,
    allineamento,
    esito,
  };
}

// === Primarie ===
// Suddivisione in archivi: specchio di archivioPrimaria (base44/shared/primarie.ts),
// che il backend riapplica a ogni blocco e che rifiuta i blocchi non coerenti.
const ARCHIVI_PRIMARIE = [
  { entita: 'PrimariaRete', nome: 'Primarie RETE', chiave: 'primarie_rete' },
  { entita: 'PrimariaAci', nome: 'Primarie ACI', chiave: 'primarie_aci' },
  { entita: 'Assegnato', nome: 'Assegnati RETE', chiave: 'assegnati' },
  { entita: 'AssegnatoAci', nome: 'Assegnati ACI', chiave: 'assegnati_aci' },
];

function classeDalProdotto(prodotto) {
  if (!prodotto) return null;
  const s = String(prodotto).trim();
  if (s.toLowerCase().includes('autodemolizione')) return 'PFU Autodemolizione';
  const idx = s.indexOf(' -');
  if (idx > 0 && s.substring(0, idx).trim()) return s.substring(0, idx).trim();
  const m = s.match(/^([A-Z0-9]{1,3})\s*-/i);
  return m ? m[1].toUpperCase() : null;
}

function archivioRiga(riga) {
  const classeFile = riga.Classe != null && riga.Classe !== '' ? String(riga.Classe).trim() : '';
  const c = (classeFile || classeDalProdotto(riga.Prodotto) || '').toLowerCase();
  // stessa regola di tutto il gestionale: vedi base44/shared/primarie.ts
  const aci = eAci({ classe: c, prodotto: riga.Prodotto, codice_prodotto: riga.Codice_Prodotto });
  const assegnato = String(riga.Stato || '').toLowerCase().trim() === 'assegnato';
  if (assegnato) return aci ? 'AssegnatoAci' : 'Assegnato';
  return aci ? 'PrimariaAci' : 'PrimariaRete';
}

/**
 * Importa il file unico delle primarie: controllo degli ordini rispetto all'archivio,
 * poi ogni archivio (rete, ACI, assegnati) viene svuotato e riscritto a blocchi.
 * Se il caricamento si interrompe basta ricaricare lo stesso file.
 */
export async function importaPrimarie({ file, onProgress, confermaForzatura = false }) {
  const tipoFile = 'primarie';
  const inizio = Date.now();
  const avvisa = (dati) => { if (onProgress) onProgress(dati); };

  avvisa({ fase: 'lettura del file nel browser' });
  const letto = await leggiFile(file);
  const righe = letto.righe
    .filter(r => r.ID != null && String(r.ID).trim() !== '')
    .map(r => ({ ...r, ID: String(r.ID).trim() }));
  const totaleRighe = righe.length;
  if (totaleRighe === 0) throw new Error('Il file non contiene ordini.');

  const perArchivio = Object.fromEntries(ARCHIVI_PRIMARIE.map(a => [a.entita, []]));
  let terminati = 0;
  let ultimaFine = null;
  for (const r of righe) {
    perArchivio[archivioRiga(r)].push(r);
    if (String(r.Stato || '').toLowerCase().trim() === 'terminato') terminati++;
    if (typeof r.Trasporto_finito_il === 'number' && (ultimaFine === null || r.Trasporto_finito_il > ultimaFine)) ultimaFine = r.Trasporto_finito_il;
  }

  // === Verifica: firma, terminati, ordini in archivio assenti dal file. Nulla viene cancellato. ===
  avvisa({ fase: 'verifica del file e confronto con gli ordini in archivio' });
  const prep = await invocaConRitentativi({
    azione: 'prepara',
    tipo_file: tipoFile,
    nome_file: file.name,
    intestazioni: letto.intestazioni,
    totale_righe: totaleRighe,
    ids: righe.map(r => r.ID),
    terminati,
    ultima_fine_trasporto: ultimaFine,
    conferma_forzatura: confermaForzatura || undefined,
  }, avvisa, 'nuovo tentativo di verifica');

  const totaleBlocchi = ARCHIVI_PRIMARIE.reduce((s, a) => s + Math.ceil(perArchivio[a.entita].length / RIGHE_PER_BLOCCO), 0);
  const archivi = {};
  let bloccoIniziale = 0;
  let righeIniziali = 0;
  let ultimoErrore = null;
  let blocchiRitentati = 0;

  for (const a of ARCHIVI_PRIMARIE) {
    const righeArchivio = perArchivio[a.entita];

    // === Svuotamento dell'archivio, verificato prima di scrivere ===
    avvisa({ fase: `svuotamento dell'archivio ${a.nome}`, archivio: a.nome });
    for (let tentativo = 0; ; tentativo++) {
      try {
        await base44.functions.invoke('importaBlocco', { azione: 'svuota', tipo_file: tipoFile, entita: a.entita });
      } catch (e) {
        if (nonRitentabile(e)) throw e;
      }
      const rimasti = await chiediConteggio(tipoFile, 0, 0, a.entita);
      if (rimasti === 0) break;
      if (tentativo >= ATTESE_RITENTATIVO.length) {
        throw Object.assign(new Error(`Svuotamento dell'archivio ${a.nome} incompleto${rimasti !== null ? `: restano ${rimasti} record` : ''}. Ricarica il file.`), { data: { dati_intatti: false } });
      }
      avvisa({ fase: `nuovo tentativo di svuotamento dell'archivio ${a.nome}`, archivio: a.nome });
      await pausa(ATTESE_RITENTATIVO[tentativo]);
    }

    // === Scrittura a blocchi ===
    const esito = await scriviBlocchi({
      tipoFile, entita: a.entita, righe: righeArchivio, avvisa,
      avanzamento: { bloccoIniziale, totaleBlocchi, righeIniziali, totaleRighe, archivio: a.nome },
    });
    bloccoIniziale += esito.totaleBlocchi;
    righeIniziali += righeArchivio.length;
    if (esito.ultimoErrore) ultimoErrore = esito.ultimoErrore;
    blocchiRitentati += esito.blocchiRitentati;

    avvisa({ fase: `verifica dell'archivio ${a.nome}`, archivio: a.nome });
    const conteggio = await chiediConteggio(tipoFile, righeArchivio.length, esito.totaleScritte, a.entita);
    archivi[a.entita] = { attese: righeArchivio.length, scritte: esito.totaleScritte, fallite: esito.totaleFallite, archivio: conteggio };
  }

  const durata = Math.round((Date.now() - inizio) / 1000);
  const fallite = Object.values(archivi).reduce((s, x) => s + x.fallite, 0);
  const disallineati = ARCHIVI_PRIMARIE.filter(a => archivi[a.entita].archivio !== null && archivi[a.entita].archivio !== archivi[a.entita].attese);
  const scritteRete = archivi.PrimariaRete.scritte + archivi.PrimariaAci.scritte;
  const esito = fallite === 0 && disallineati.length === 0 ? 'successo' : (scritteRete > 0 ? 'parziale' : 'errore');

  await invocaConRitentativi({
    azione: 'registra', tipo_file: tipoFile, nome_file: file.name, archivi,
    ultimo_errore: ultimoErrore, righe_archivio_prima: prep.righe_archivio_prima,
    durata_secondi: durata, conferma_forzatura: confermaForzatura || undefined,
  }, avvisa, 'nuovo tentativo di registrazione');

  const archivioTotale = Object.values(archivi).reduce((s, x) => s + (x.archivio ?? x.scritte), 0);
  return {
    tipo_file: tipoFile,
    foglio: letto.nomeFoglio,
    righe_lette: totaleRighe,
    righe_importate: scritteRete,
    righe_fallite: fallite,
    primarie_rete_importati: archivi.PrimariaRete.scritte,
    primarie_aci_importati: archivi.PrimariaAci.scritte,
    assegnati_importati: archivi.Assegnato.scritte,
    assegnati_aci_importati: archivi.AssegnatoAci.scritte,
    blocchi: totaleBlocchi,
    blocchi_ritentati: blocchiRitentati,
    avviso_date: prep.avviso_date || null,
    avviso_disallineamento: disallineati.length ? { archivio: archivioTotale, file: totaleRighe } : null,
    ultimo_errore: ultimoErrore,
    forzato: !!confermaForzatura,
    durata_secondi: durata,
    esito,
  };
}

// Tipi che usano la lettura nel browser invece dell'import lato server.
export const TIPI_LETTURA_BROWSER = ['dichiarazioni_trattamento', 'ordini_non_dichiarati'];

// === Dopo un caricamento ===
// Regola dell'utente (21/09/2026): ogni caricamento aggiorna tutto. Qui c'e'
// l'elenco unico di cio' che si ricalcola dopo ciascun tipo di dato, usato da
// tutti i punti da cui i dati entrano: Caricamento Dati, la pagina Secondarie e
// le schede dell'Extra Raccolta. Prima ognuno lanciava la sua parte - o niente -
// e il resto restava fermo al caricamento precedente.
//
// Non stanno qui gli alert, che partono dal registro dei caricamenti a
// caricamento concluso (workflow AlertEngineAutoRun), e l'allineamento delle
// dichiarazioni mensili, che fa parte di importaGrandeFile perche' il suo esito
// si mostra subito. I moduli che calcolano all'apertura (giacenze, dichiarazioni,
// fatturazione) non hanno niente da ricalcolare.
//
// Le terziarie non compaiono: nessuno dei ricalcoli le legge (i soggetti della
// qualifica vengono da primarie, secondarie ed extra raccolta).
//
// Le verifiche dei report e le quadrature FIR le riconfronta ricontrollaDichiarazioni
// anche dopo una scheda di extra raccolta: tutte le verifiche concluse e le
// quadrature delle ultime settimane, scrivendo solo cio' che cambia. Per l'extra
// raccolta c'era un secondo giro che rifaceva le stesse verifiche con
// elaboraReportSettimanale ed elaboraQuadraturaFir, in parallelo e sugli stessi
// record: al primo errore metteva in "errore" una verifica conclusa, e una
// quadratura senza righe salvate diventava "La lettura del file non e' riuscita".
const RICALCOLI = {
  primarie: ['evasioneAssegnati', 'ritiriEct', 'verifiche', 'qualifica', 'predittivita'],
  secondarie: ['verifiche', 'qualifica', 'predittivita'],
  extra_raccolta: ['verifiche', 'qualifica'],
};

const NOMI_RICALCOLI = {
  evasioneAssegnati: 'evasione delle liste di assegnati',
  ritiriEct: 'ritiri delle richieste del consorzio',
  verifiche: 'verifiche dei report e quadrature FIR (anche nessuna movimentazione)',
  qualifica: 'qualifica fornitori',
  predittivita: 'piano delle secondarie di rete e suggerimento della settimana',
  alertExtra: "alert delle date obbligatorie dell'extra raccolta",
};

// Gli archivi che i ricalcoli leggono, per tipo di caricamento: l'extra raccolta
// non ha un caricamento da file.
const TIPI_LETTI_DAI_RICALCOLI = ['primarie', 'secondarie'];
const FINESTRA_IN_CORSO_MS = 10 * 60 * 1000;

// Un ricalcolo che parte mentre primarie o secondarie si stanno riscrivendo -
// oppure dopo un caricamento interrotto, che le ha lasciate a meta' - salva esiti
// letti su un archivio a meta' (regola 2). Non si parte, e si dice quale
// caricamento lo impedisce. ricontrollaDichiarazioni lo controlla anche per conto
// suo (risponde 409); qui vale per tutti i ricalcoli, qualifica compresa. Se il
// registro non si riesce a leggere si prosegue: meglio un ricalcolo in piu' che
// uno perso, e il controllo lato server resta.
//
// Un caricamento fallito dopo lo svuotamento lascia la sua riga "in_corso", col
// messaggio che comincia con NON_RIUSCITO (importEcotyreFile, importaBlocco); in
// "errore" si chiude solo chi fallisce prima di svuotare, a dati intatti. Percio'
// le righe in errore si saltano: un file sbagliato caricato dopo non deve
// nascondere l'archivio rimasto vuoto.
const NON_RIUSCITO = 'Caricamento non riuscito';
async function caricamentoAperto() {
  try {
    for (const tipo of TIPI_LETTI_DAI_RICALCOLI) {
      const righe = await base44.entities.UploadLog.filter({ tipo_file: tipo }, '-created_date', 10);
      const ultimo = (righe || []).find(r => r.esito !== 'errore');
      if (!ultimo || ultimo.esito !== 'in_corso') continue;
      const inizio = dataServer(ultimo.created_date);
      const chi = ultimo.utente ? ` di ${ultimo.utente}` : '';
      const file = ultimo.nome_file && ultimo.nome_file !== 'N/D' ? ` (${ultimo.nome_file})` : '';
      if (String(ultimo.messaggio || '').startsWith(NON_RIUSCITO)) {
        return `rinviato: il caricamento ${tipo}${chi}${file} non e' riuscito e l'archivio puo' essere vuoto o incompleto; ricarica il file`;
      }
      if (inizio && Date.now() - inizio.getTime() > FINESTRA_IN_CORSO_MS) {
        return `rinviato: il caricamento ${tipo}${chi}${file} e' rimasto interrotto e l'archivio puo' essere incompleto; ricarica il file`;
      }
      return `rinviato: caricamento ${tipo}${chi}${file} in corso; si rifa' quando finisce`;
    }
  } catch (e) {
    return null;
  }
  return null;
}

// I primi errori di un elenco, per la riga sotto il caricamento.
function testoErrori(errori) {
  const primi = errori.slice(0, 3).map(x => (typeof x === 'string' ? x : (x && (x.errore || x.error)) || JSON.stringify(x)));
  return primi.join('; ') + (errori.length > primi.length ? ` (e altri ${errori.length - primi.length})` : '');
}

// Contratto con le funzioni dei ricalcoli: riuscito vuol dire risposta 200, e
// basta. Un 409 (caricamento aperto) o un 500 (con i primi errori) arrivano come
// eccezione. Una risposta 2xx diversa da 200, o un 200 che dice "rinviato" o porta
// errori - come rispondeva ricontrollaDichiarazioni prima - non e' un ricalcolo
// fatto e non si mostra in verde. Restituisce il motivo, o null se e' riuscito.
function problemaRisposta(res) {
  const stato = res && typeof res.status === 'number' ? res.status : null;
  if (stato !== null && stato !== 200) return `risposta ${stato} invece di 200`;
  const dati = (res && res.data !== undefined ? res.data : res) || {};
  if (dati.rinviato) {
    const aperti = Array.isArray(dati.caricamenti_in_corso) ? dati.caricamenti_in_corso : [];
    return aperti.length
      ? `rinviato: caricamento ${aperti.map(c => `${c.tipo_file}${c.utente ? ` di ${c.utente}` : ''}`).join(', ')} in corso`
      : 'rinviato: caricamento in corso';
  }
  if (Array.isArray(dati.errori) && dati.errori.length) return `${dati.errori.length} non riusciti: ${testoErrori(dati.errori)}`;
  if (dati.error) return String(dati.error);
  return null;
}

// Cio' che un ricalcolo riuscito deve comunque far sapere, o null. I ritiri delle
// richieste del consorzio dicono quali richieste restano aperte su un ordine
// terminato senza fine trasporto: non si contano come ritirate (regola 1), ma
// sollecitarle sarebbe sbagliato. E quali sono evase da ordini con un'altra data
// obbligatoria da sistemare (regola dell'utente del 22/09/2026).
function avvisoRisposta(res) {
  const dati = (res && res.data !== undefined ? res.data : res) || {};
  const lista = (campo) => (Array.isArray(dati[campo]) ? dati[campo] : []);
  return [testoTerminatiSenzaFine(lista('terminati_senza_fine')), testoOrdiniDateDaSistemare(lista('ordini_con_date_da_sistemare'))].filter(Boolean).join(' ') || null;
}

// Il messaggio di un ricalcolo rifiutato: quello della funzione, o i suoi primi errori.
function messaggioRicalcolo(e) {
  const dati = datiErrore(e);
  if (dati && !dati.error && Array.isArray(dati.errori) && dati.errori.length) return testoErrori(dati.errori);
  return messaggioErrore(e);
}

/**
 * Lancia i ricalcoli che dipendono da un tipo di dato appena caricato o scritto.
 * Non blocca chi chiama: restituisce una promessa con l'esito di ciascun
 * ricalcolo, { nome, ok, errore }, nell'ordine dell'elenco, da mostrare a chi ha
 * caricato. Un ricalcolo non riuscito si dice per nome, non si perde.
 *
 * I ricalcoli si fanno uno alla volta: ognuno rilegge archivi interi, e nello
 * stesso momento il workflow degli alert lancia i suoi. In parallelo la
 * piattaforma rifiuta le richieste troppo ravvicinate, e gli errori che ne
 * nascevano risultavano "Non aggiornati".
 *
 * @param {string} tipoFile  primarie, secondarie, extra_raccolta, ...
 * @param {object} opzioni   { giorni: giorni italiani di fine trasporto toccati (extra raccolta) }
 */
export async function dopoCaricamento(tipoFile, { giorni = [] } = {}) {
  const elenco = RICALCOLI[tipoFile] || [];
  if (!elenco.length) return [];
  const giorniValidi = [...new Set(giorni.filter(Boolean))];
  // La qualifica si rifa' sull'anno dei dati toccati; per un file, l'anno in corso.
  const anni = [...new Set(giorniValidi.map(g => Number(g.slice(0, 4))))];
  if (!anni.length) anni.push(Number(oggiRoma().slice(0, 4)));

  const aperto = await caricamentoAperto();
  if (aperto) return elenco.map(k => ({ nome: NOMI_RICALCOLI[k], ok: false, errore: aperto }));

  // Le schede di extra raccolta non passano da un file: la modifica si scrive nel
  // registro dei caricamenti come le altre, cosi' lo storico delle quadrature e
  // delle verifiche sa che gli esiti di prima vanno rifatti (regola 2). La stessa
  // riga avvia il motore degli alert (AlertEngineAutoRun, dal 22/09/2026), che
  // rivaluta le date obbligatorie dell'extra raccolta.
  let registrata = false;
  if (tipoFile === 'extra_raccolta' && giorniValidi.length) {
    try {
      const utente = await base44.auth.me().catch(() => null);
      const ordinati = [...giorniValidi].sort();
      await base44.entities.UploadLog.create({
        tipo_file: 'extra_raccolta', nome_file: 'Schede di extra raccolta', esito: 'successo',
        righe_importate: ordinati.length, utente: (utente && (utente.full_name || utente.email)) || '',
        messaggio: `Schede modificate con fine trasporto dal ${ordinati[0]} al ${ordinati[ordinati.length - 1]}`,
      });
      registrata = true;
    } catch (e) { /* il ricalcolo parte lo stesso */ }
  }

  const compiti = {
    evasioneAssegnati: () => base44.functions.invoke('controllaEvasioneAssegnati', {}),
    ritiriEct: () => base44.functions.invoke('importaBlocco', { azione: 'ritiri_ect', tipo_file: 'primarie' }),
    // Con i giorni toccati si rifanno anche le quadrature piu' vecchie di quelle settimane.
    verifiche: () => base44.functions.invoke('ricontrollaDichiarazioni', { giorni: giorniValidi }),
    // un anno alla volta anche qui, per la stessa ragione
    qualifica: async () => {
      const risposte = [];
      for (const anno of anni) risposte.push(await base44.functions.invoke('qualificaFornitori', { anno }));
      return risposte;
    },
    // Il piano settimanale e il suggerimento del lunedi' sono esiti salvati: si
    // rifanno dopo ogni caricamento di primarie e secondarie, uno dopo l'altro.
    predittivita: async () => {
      const piano = await base44.functions.invoke('calcolaPianificazioneSecondaria', {});
      const dati = (piano && piano.data) || {};
      if (dati.piano_salvato === false) throw new Error(dati.caricamento_in_corso ? `piano non salvato: ${dati.caricamento_in_corso}` : 'piano non salvato');
      return [piano, await base44.functions.invoke('analisiSettimanalePredittiva', {})];
    },
    // Una scheda senza fine trasporto la riga del registro non la scrive, e se
    // la scrittura non riesce il workflow non parte: senza, l'alert delle date
    // obbligatorie dell'extra raccolta restava vecchio proprio per chi la data non
    // ce l'ha (22/09/2026). In quei casi il motore si lancia da qui, una volta.
    alertExtra: () => base44.functions.invoke('runAlertEngine', { modulo: 'extra_raccolta' }),
  };
  const daFare = tipoFile === 'extra_raccolta' && !registrata ? [...elenco, 'alertExtra'] : elenco;
  const esiti = [];
  for (const k of daFare) {
    try {
      const risposte = [].concat(await compiti[k]());
      const problema = risposte.map(problemaRisposta).find(Boolean);
      const avviso = risposte.map(avvisoRisposta).find(Boolean);
      esiti.push(problema ? { nome: NOMI_RICALCOLI[k], ok: false, errore: problema } : { nome: NOMI_RICALCOLI[k], ok: true, ...(avviso ? { avviso } : {}) });
    } catch (e) {
      esiti.push({ nome: NOMI_RICALCOLI[k], ok: false, errore: messaggioRicalcolo(e) });
    }
  }
  return esiti;
}

/** Una riga da mostrare sotto il caricamento: cosa si e' aggiornato e cosa no. */
export function testoRicalcoli(esiti) {
  if (!esiti) return null;
  if (esiti.in_corso) return { classe: 'text-muted-foreground', testo: 'Aggiornamento dei moduli collegati in corso…' };
  if (!esiti.length) return null;
  const falliti = esiti.filter(e => !e.ok);
  // gli avvisi dei ricalcoli riusciti, in coda: si leggono anche quando e' tutto aggiornato
  const avvisi = esiti.filter(e => e.ok && e.avviso).map(e => ` ${e.avviso}`).join('');
  if (!falliti.length) return { classe: avvisi ? 'text-amber-700' : 'text-green-700', testo: `Aggiornati: ${esiti.map(e => e.nome).join(', ')}.${avvisi}` };
  // Lo stesso motivo per tutti (un caricamento aperto) si dice una volta sola.
  const motivi = [...new Set(falliti.map(e => e.errore))];
  const riusciti = esiti.filter(e => e.ok).map(e => e.nome);
  const testo = motivi.length === 1 && falliti.length > 1
    ? `Non aggiornati: ${falliti.map(e => e.nome).join(', ')} (${motivi[0]}).`
    : `Non aggiornati: ${falliti.map(e => `${e.nome} (${e.errore})`).join('; ')}.`;
  return {
    classe: 'text-amber-700',
    testo: `${testo}${riusciti.length ? ` Aggiornati: ${riusciti.join(', ')}.` : ''} Si rifanno al prossimo caricamento o dal modulo.${avvisi}`,
  };
}
