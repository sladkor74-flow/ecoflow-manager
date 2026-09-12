import { base44 } from '@/api/base44Client';

// Importazione dei report di grandi dimensioni del portale Ecotyre.
//
// Il report delle dichiarazioni di trattamento supera i 4 MB e contiene oltre un
// milione di celle: letto dentro una function esaurisce la memoria disponibile e
// il processo viene terminato dalla piattaforma. Qui il file viene letto nel
// browser, dove la memoria non e' un vincolo, e al backend arrivano solo blocchi
// di poche centinaia di righe gia' estratte.
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

function messaggioErrore(e) {
  const dati = e && e.response && e.response.data;
  if (dati && dati.error) return dati.fase ? `${dati.error} (fase: ${dati.fase})` : dati.error;
  return e && e.message ? e.message : String(e);
}

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

// Quanti record contiene ora l'archivio. Restituisce null se nemmeno il conteggio
// riesce: in quel caso non si sa se il blocco sia passato e conviene ritentare,
// perche' il controllo finale segnalera' comunque ogni scostamento.
async function chiediConteggio(tipoFile, atteso, minimo) {
  try {
    const res = await base44.functions.invoke('importaBlocco', {
      azione: 'conta', tipo_file: tipoFile, atteso, minimo,
    });
    const dati = res.data || res;
    return typeof dati.conteggio === 'number' ? dati.conteggio : null;
  } catch (e) {
    return null;
  }
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
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();

  // cellDates disattivato: le date arrivano come seriali Excel e vengono convertite
  // dal backend, evitando di costruire un oggetto Date per ogni cella.
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  if (!wb.SheetNames.length) throw new Error('Il file non contiene alcun foglio.');

  // I report del portale hanno un unico foglio; in caso di piu' fogli si prende
  // quello con piu' colonne nella prima riga, che e' quello dei dati.
  let nomeFoglio = wb.SheetNames[0];
  let intestazioni = leggiIntestazioni(XLSX, wb.Sheets[nomeFoglio]);
  for (const sn of wb.SheetNames.slice(1)) {
    const h = leggiIntestazioni(XLSX, wb.Sheets[sn]);
    if (h.length > intestazioni.length) { nomeFoglio = sn; intestazioni = h; }
  }

  avvisa({ fase: 'estrazione delle righe' });
  const righe = XLSX.utils.sheet_to_json(wb.Sheets[nomeFoglio], { raw: true });
  const totaleRighe = righe.length;
  if (totaleRighe === 0) throw new Error('Il foglio non contiene righe di dati.');

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
      const stato = e && e.response && e.response.status;
      if (stato === 400 || stato === 403 || stato === 409) throw e;
      if (tentativo >= ATTESE_RITENTATIVO.length) throw e;
      avvisa({ fase: 'nuovo tentativo di preparazione' });
    }
    await pausa(ATTESE_RITENTATIVO[Math.min(tentativo, ATTESE_RITENTATIVO.length - 1)]);
  }
  const avvisoCalo = datiPrep && datiPrep.avviso_calo ? datiPrep.avviso_calo : null;
  const righeArchivioPrima = datiPrep ? datiPrep.righe_archivio_prima : undefined;

  // === Scrittura dei blocchi ===
  const totaleBlocchi = Math.ceil(totaleRighe / RIGHE_PER_BLOCCO);
  let totaleScritte = 0;
  let totaleFallite = 0;
  let ultimoErrore = null;
  let blocchiRitentati = 0;

  for (let blocco = 0; blocco < totaleBlocchi; blocco++) {
    const fetta = righe.slice(blocco * RIGHE_PER_BLOCCO, (blocco + 1) * RIGHE_PER_BLOCCO);
    const atteso = totaleScritte + fetta.length;
    let scritto = false;

    for (let tentativo = 0; tentativo <= ATTESE_RITENTATIVO.length && !scritto; tentativo++) {
      if (tentativo > 0) {
        avvisa({
          fase: 'ritentativo', blocco: blocco + 1, totaleBlocchi,
          tentativo, righeScritte: totaleScritte, totaleRighe,
        });
        await pausa(ATTESE_RITENTATIVO[tentativo - 1]);

        // La scrittura potrebbe essere arrivata comunque: in quel caso ripeterla
        // creerebbe duplicati. Il conteggio dell'archivio scioglie il dubbio.
        const conteggio = await chiediConteggio(tipoFile, atteso, totaleScritte);
        if (conteggio !== null && conteggio > totaleScritte) {
          totaleScritte = conteggio;
          scritto = true;
          blocchiRitentati++;
          break;
        }
      }

      try {
        const res = await base44.functions.invoke('importaBlocco', {
          azione: 'scrivi',
          tipo_file: tipoFile,
          righe: fetta,
          blocco,
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
        ultimoErrore = messaggioErrore(e);
      }
    }

    if (!scritto) totaleFallite += fetta.length;

    avvisa({
      fase: 'scrittura',
      blocco: blocco + 1,
      totaleBlocchi,
      righeScritte: totaleScritte,
      totaleRighe,
    });
  }

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

// Tipi che usano la lettura nel browser invece dell'import lato server.
export const TIPI_LETTURA_BROWSER = ['dichiarazioni_trattamento', 'ordini_non_dichiarati'];
