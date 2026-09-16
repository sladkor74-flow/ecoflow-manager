// Lettura dei due fogli delle omologhe, nel browser.
//
// I file restano sul computer di chi li carica: al gestionale arrivano solo le
// righe che servono, poche centinaia. Il registro dell'impianto pesa qualche
// megabyte e ha piu' di cinquemila righe, percio' si legge senza formule e senza
// testo formattato, altrimenti la pagina si blocca.
//
// Specchio di base44/shared/omologhe.ts per le parti che servono anche qui.

import { testo, daData, apriFoglio as apri, griglia } from '@/lib/foglioExcel';

// Il documento si recepisce una volta, al primo ritiro, e da lì parte l'anno di
// validità: i ritiri successivi non riportano l'annotazione e va bene così.
export const SPIEGA_DIVERGENZA = {
  solo_registro: "L'impianto ha annotato l'omologa nel registro, ma il produttore non è nel nostro elenco: il documento va messo in elenco. La scadenza è contata dalla prima annotazione.",
  solo_elenco: "Il produttore è nel nostro elenco e ha già conferito all'impianto, ma nel registro l'omologa non risulta mai annotata: va controllato che il documento sia stato recepito al primo ritiro.",
  data_diversa: "L'elenco e il registro fissano l'inizio dell'omologa a più di una settimana di distanza. L'anno di validità si conta dalla data più vecchia, quindi la scadenza mostrata è la più prudente.",
  nome_diverso: 'Lo stesso produttore risulta scritto in due modi diversi nei due fogli: va confermato che sia la stessa azienda.',
  nessuna: 'I due fogli dicono la stessa cosa.',
};

export const NOME_DIVERGENZA = {
  solo_registro: 'Non in elenco',
  solo_elenco: 'Conferito senza annotazione',
  data_diversa: 'Date lontane',
  nome_diverso: 'Nome diverso',
  nessuna: 'Nessuna',
};

export const PESO_DIVERGENZA = { solo_registro: 1, solo_elenco: 2, data_diversa: 3, nome_diverso: 4, nessuna: 9 };

export const STATI = {
  da_verificare: { nome: 'Da verificare', classe: 'bg-amber-50 text-amber-800 border-amber-200' },
  recepita: { nome: 'Recepita', classe: 'bg-green-50 text-green-800 border-green-200' },
  in_sospeso: { nome: 'In sospeso', classe: 'bg-slate-100 text-slate-700 border-slate-300' },
  annullata: { nome: 'Annullata', classe: 'bg-red-50 text-red-700 border-red-200' },
};

/** Giorni che mancano alla scadenza; negativo se è già passata. */
export function giorniAllaScadenza(omologaA, oggi) {
  if (!omologaA) return null;
  const fine = new Date(String(omologaA).slice(0, 10) + 'T00:00:00Z').getTime();
  const adesso = new Date(String(oggi || new Date().toISOString()).slice(0, 10) + 'T00:00:00Z').getTime();
  if (Number.isNaN(fine) || Number.isNaN(adesso)) return null;
  return Math.round((fine - adesso) / 86400000);
}

// Il colore si scalda man mano che la scadenza si avvicina: non è un alert, è
// un promemoria per quando si programma la raccolta da quel punto.
export const FASCE = {
  scaduta: { etichetta: 'Scaduta', riga: 'bg-red-100', testo: 'text-red-900 font-semibold', punto: 'bg-red-600' },
  critica: { etichetta: 'Scade entro 15 giorni', riga: 'bg-red-50', testo: 'text-red-800 font-medium', punto: 'bg-red-500' },
  vicina: { etichetta: 'Scade entro un mese', riga: 'bg-orange-50', testo: 'text-orange-800', punto: 'bg-orange-500' },
  avviso: { etichetta: 'Scade entro due mesi', riga: 'bg-amber-50', testo: 'text-amber-800', punto: 'bg-amber-400' },
  lontana: { etichetta: 'Scade entro tre mesi', riga: '', testo: 'text-yellow-700', punto: 'bg-yellow-300' },
  valida: { etichetta: 'Valida', riga: '', testo: 'text-muted-foreground', punto: 'bg-green-500' },
  senza_data: { etichetta: 'Senza data', riga: '', testo: 'text-muted-foreground', punto: 'bg-slate-300' },
};

export function fasciaScadenza(giorni) {
  if (giorni === null || giorni === undefined) return 'senza_data';
  if (giorni < 0) return 'scaduta';
  if (giorni <= 15) return 'critica';
  if (giorni <= 30) return 'vicina';
  if (giorni <= 60) return 'avviso';
  if (giorni <= 90) return 'lontana';
  return 'valida';
}

// === lettura dei file ===

/**
 * Elenco delle omologhe: due tabelle nello stesso foglio, i produttori ACI e
 * quelli della rete. Le intestazioni si cercano invece di contare le righe, cosi'
 * il foglio puo' crescere senza rompere la lettura.
 */
export async function leggiElencoOmologhe(file) {
  const { XLSX, ws, nome } = await apri(file, /omologh/i);
  const ymd = daData(XLSX);
  const g = griglia(XLSX, ws);
  const cella = (r, c) => (g[r] && g[r][c] !== undefined ? g[r][c] : null);

  const trova = (re) => {
    for (let r = 0; r < g.length; r++) {
      for (let c = 0; c < (g[r] || []).length; c++) {
        if (re.test(testo(cella(r, c)))) return { r, c };
      }
    }
    return null;
  };

  const capoAci = trova(/produttore\s*aci/i);
  const capoRete = trova(/produttore\s*rete/i);
  if (!capoAci && !capoRete) throw new Error(`Nel foglio «${nome}» non trovo le intestazioni "Produttore ACI" o "Produttore RETE".`);

  const righe = [];
  const quantitativi = new Map();

  // Righe sciolte tipo "6.850 ton QUANTITATIVO MAX ANNUO", con il sito nella colonna accanto.
  for (let r = 0; r < g.length; r++) {
    for (let c = 1; c < (g[r] || []).length; c++) {
      if (/quantitativo\s*max/i.test(testo(cella(r, c))) && testo(cella(r, c - 1))) {
        quantitativi.set(testo(cella(r, c - 1)).toLowerCase(), testo(cella(r, c)));
      }
    }
  }

  const leggiBlocco = (capo, canale, fino) => {
    if (!capo) return;
    const c = capo.c;
    let vuote = 0;
    for (let r = capo.r + 2; r < (fino === undefined ? g.length : fino); r++) {
      const nomeProd = testo(cella(r, c));
      if (!nomeProd) { if (++vuote >= 8) break; continue; }
      if (/produttore|quantitativo/i.test(nomeProd)) continue;
      vuote = 0;
      const base = { nome: nomeProd, canale, tipologia: testo(cella(r, c - 1)) };
      if (canale === 'ACI') {
        righe.push({
          ...base,
          n_autorizzazione: testo(cella(r, c + 1)),
          aut_da: ymd(cella(r, c + 2)), aut_a: ymd(cella(r, c + 3)),
          rdp_da: ymd(cella(r, c + 5)), rdp_a: ymd(cella(r, c + 6)),
          om_da: ymd(cella(r, c + 8)), om_a: ymd(cella(r, c + 9)),
          esito: cella(r, c + 11) === true || /^(si|sì|vero|true|ok)$/i.test(testo(cella(r, c + 11))),
          quantitativo: quantitativi.get(nomeProd.toLowerCase()) || '',
        });
      } else {
        righe.push({
          ...base,
          om_da: ymd(cella(r, c + 1)), om_a: ymd(cella(r, c + 2)),
          esito: cella(r, c + 5) === true || /^(si|sì|vero|true|ok)$/i.test(testo(cella(r, c + 5))),
        });
      }
    }
  };

  leggiBlocco(capoAci, 'ACI', capoRete ? capoRete.r : undefined);
  leggiBlocco(capoRete, 'RETE');

  if (!righe.length) throw new Error(`Nel foglio «${nome}» non ho trovato nessun produttore.`);
  return righe;
}

/**
 * Registro di carico e scarico.
 *
 * Il documento si recepisce una volta sola, al primo ritiro: da li' parte l'anno
 * di validita', e i ritiri successivi dallo stesso produttore non riportano piu'
 * l'annotazione senza che questo sia un problema. Percio' di ogni produttore
 * contano la prima riga segnata "OMOLOGA OK" e, a parte, tutti i suoi carichi:
 * servono a distinguere chi ha conferito senza che l'omologa sia mai stata
 * annotata da chi all'impianto non ha ancora portato nulla.
 *
 * Restituisce { annotati, conferitori }.
 */
export async function leggiRegistroOmologhe(file) {
  const { XLSX, ws, nome } = await apri(file, /dettagli/i);
  const ymd = daData(XLSX);
  const g = griglia(XLSX, ws);
  const cella = (r, c) => (g[r] && g[r][c] !== undefined ? g[r][c] : null);

  let capo = -1, colProd = -1, colTipo = -1, colData = -1, colFir = -1;
  for (let r = 0; r < Math.min(g.length, 20); r++) {
    const riga = (g[r] || []).map(v => testo(v).toUpperCase());
    const p = riga.findIndex(v => v === 'PRODUTTORE');
    const t = riga.findIndex(v => /TIPOLOGIA/.test(v));
    if (p >= 0 && t >= 0) {
      capo = r; colProd = p; colTipo = t;
      colData = riga.findIndex(v => v === 'DATA');
      colFir = riga.findIndex(v => /^NR\.?\s*FIR/.test(v));
      break;
    }
  }
  if (capo < 0) throw new Error(`Nel foglio «${nome}» non trovo le colonne "PRODUTTORE" e "TIPOLOGIA DI RIFIUTO".`);

  const perProduttore = new Map();
  const carichi = new Map();
  for (let r = capo + 1; r < g.length; r++) {
    const prod = testo(cella(r, colProd));
    if (!prod) continue;
    const data = colData >= 0 ? ymd(cella(r, colData)) : null;
    const chiave = prod.toLowerCase();

    // I numeri di formulario collegano il produttore al suo PDR in modo esatto,
    // senza passare dal nome. Ne bastano alcuni per produttore.
    const fir = colFir >= 0 ? testo(cella(r, colFir)).toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
    const c = carichi.get(chiave);
    if (!c) carichi.set(chiave, { nome: prod, carichi: 1, primo: data, ultimo: data, fir: fir ? [fir] : [] });
    else {
      c.carichi++;
      if (data && (!c.primo || data < c.primo)) c.primo = data;
      if (data && (!c.ultimo || data > c.ultimo)) c.ultimo = data;
      if (fir && c.fir.length < 30 && !c.fir.includes(fir)) c.fir.push(fir);
    }

    const tipo = testo(cella(r, colTipo));
    if (!/omologa/i.test(tipo)) continue;
    const gia = perProduttore.get(chiave);
    if (!gia) {
      perProduttore.set(chiave, { nome: prod, data, riga: r + 1, volte: 1, nota: tipo, fir: colFir >= 0 ? testo(cella(r, colFir)) : '' });
    } else {
      gia.volte++;
      if (data && (!gia.data || data < gia.data)) { gia.data = data; gia.riga = r + 1; }
    }
  }

  const annotati = [...perProduttore.values()];
  if (!annotati.length) throw new Error(`Nel foglio «${nome}» non ho trovato righe con l'annotazione dell'omologa.`);
  return { annotati, conferitori: [...carichi.values()] };
}
