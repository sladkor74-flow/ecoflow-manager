import { base44 } from '@/api/base44Client';

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
  const p = String(riga.Prodotto || '').trim().toLowerCase();
  const aci = c.includes('autodemolizione') || c.includes('aci') || p.includes('autodemolizione') || p.includes('aci');
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
