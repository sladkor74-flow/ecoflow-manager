import { base44 } from '@/api/base44Client';

// Importazione dei report di grandi dimensioni del portale Ecotyre.
//
// Il report delle dichiarazioni di trattamento supera i 4 MB e contiene oltre un
// milione di celle: letto dentro una function esaurisce la memoria disponibile e
// il processo viene terminato dalla piattaforma. Qui il file viene letto nel
// browser, dove la memoria non e' un vincolo, e al backend arrivano solo blocchi
// di poche centinaia di righe gia' estratte.
//
// La mappatura delle colonne resta sul backend, nella function importaBlocco, che
// usa SHEET_MAP come unica fonte: qui le righe si spediscono cosi' come lette.

const RIGHE_PER_BLOCCO = 300;

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

/**
 * Legge il file nel browser e lo invia al backend a blocchi.
 *
 * @param {File}     file               il file scelto dall'utente
 * @param {string}   tipoFile           chiave del tipo, es. dichiarazioni_trattamento
 * @param {function} onProgress         riceve { fase, blocco, totaleBlocchi, righeScritte, totaleRighe }
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

  const totaleBlocchi = Math.ceil(totaleRighe / RIGHE_PER_BLOCCO);
  let totaleScritte = 0;
  let totaleFallite = 0;
  let avvisoCalo = null;
  let esitoFinale = null;

  for (let blocco = 0; blocco < totaleBlocchi; blocco++) {
    const inizio = blocco * RIGHE_PER_BLOCCO;
    const fetta = righe.slice(inizio, inizio + RIGHE_PER_BLOCCO);

    const payload = {
      tipo_file: tipoFile,
      nome_file: file.name,
      righe: fetta,
      blocco,
      totale_blocchi: totaleBlocchi,
      totale_righe: totaleRighe,
    };
    if (blocco === 0) {
      payload.intestazioni = intestazioni;
      if (confermaForzatura) payload.conferma_forzatura = true;
    }
    if (blocco === totaleBlocchi - 1) {
      payload.totale_scritte = totaleScritte;
      payload.totale_fallite = totaleFallite;
    }

    const res = await base44.functions.invoke('importaBlocco', payload);
    const dati = res.data || res;

    totaleScritte += dati.scritte || 0;
    totaleFallite += dati.fallite || 0;
    if (dati.avviso_calo) avvisoCalo = dati.avviso_calo;
    if (dati.esito) esitoFinale = dati.esito;

    avvisa({
      fase: 'scrittura',
      blocco: blocco + 1,
      totaleBlocchi,
      righeScritte: totaleScritte,
      totaleRighe,
    });
  }

  return {
    tipo_file: tipoFile,
    foglio: nomeFoglio,
    righe_lette: totaleRighe,
    righe_importate: totaleScritte,
    righe_fallite: totaleFallite,
    blocchi: totaleBlocchi,
    avviso_calo: avvisoCalo,
    esito: esitoFinale || (totaleFallite === 0 ? 'successo' : 'parziale'),
  };
}

// Tipi che usano la lettura nel browser invece dell'import lato server.
export const TIPI_LETTURA_BROWSER = ['dichiarazioni_trattamento', 'ordini_non_dichiarati'];
