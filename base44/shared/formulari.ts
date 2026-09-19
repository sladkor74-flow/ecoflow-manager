// Un formulario e' un documento solo, anche quando il portale lo chiude su piu'
// ordini.
//
// Sull'ACI succede per regola, non per errore: una richiesta non si stima sotto
// i 1.500 kg e un formulario non si chiude a piu' del 10% del peso stimato del
// suo ticket (il Numero_Ordine_Interno). Quando il carico supera quella soglia,
// il peso effettivo si ripartisce su un secondo ordine, col suo ticket e il suo
// stimato. Il 9 giugno 2026 il formulario RGYTR022620TW sta su ET26091175
// (ticket 162684-15, 1.960 kg) e su ET26102183 (ticket 163142-85, 1.500 kg):
// tutti i 3.460 kg sul primo avrebbero sforato i 3.080 ammessi.
//
// Da qui due regole che valgono in tutto il gestionale:
//
//   - i PESI si sommano. Ogni quota e' peso vero e in fattura conta la somma.
//   - i FORMULARI si contano una volta sola, per numero. Chi conta i formulari
//     usa contaFormulari(), non righe.length: due quote dello stesso documento
//     contate come due formulari fanno sballare la quadratura contro la stampa
//     del portale, che quel formulario lo elenca una volta.
//
// A distinguere le quote e' il ticket: tenerlo accanto al peso effettivo e'
// quello che rende il conto leggibile invece che sospetto.

/** Il numero del formulario, normalizzato. Vuoto se non c'e'. */
export function chiaveFormulario(r) {
  return String((r && r.numero_fir) || '').trim().toUpperCase();
}

/** Il ticket dell'ordine (Numero_Ordine_Interno). */
export function ticketDi(r) {
  return String((r && r.numero_ordine_interno) || '').trim();
}

/** L'ordine a cui la quota appartiene. */
export function ordineDi(r) {
  return String((r && (r.id_ordine || r.codice_import)) || '').trim();
}

const pesoDi = (r) => Number((r && r.peso_effettivo) || 0);

/**
 * Le righe raggruppate per numero di formulario.
 * Le righe senza numero restano a se': non si possono accorpare a niente.
 */
export function raggruppaPerFormulario(righe, numero = chiaveFormulario) {
  const gruppi = new Map();
  let senzaNumero = 0;
  for (const r of righe || []) {
    const fir = String(numero(r) || '').trim().toUpperCase();
    const k = fir || `__SENZA_NUMERO_${senzaNumero++}__`;
    if (!gruppi.has(k)) gruppi.set(k, []);
    gruppi.get(k).push(r);
  }
  return gruppi;
}

/**
 * Quanti formulari distinti ci sono in un elenco di righe.
 * Una riga senza numero conta per uno: non sapendo di che documento sia, non si
 * puo' fonderla con nessuna.
 */
export function contaFormulari(righe) {
  return raggruppaPerFormulario(righe).size;
}

/**
 * I formulari il cui peso e' ripartito su piu' ordini, con le quote in chiaro.
 * Non comprende lo stesso formulario ripetuto sullo STESSO ordine: quello non e'
 * una ripartizione, e' un ritiro caricato due volte.
 */
export function formulariRipartiti(righe) {
  const out = [];
  for (const [fir, quote] of raggruppaPerFormulario(righe)) {
    if (quote.length < 2) continue;
    const ordini = new Set(quote.map(ordineDi).filter(Boolean));
    if (ordini.size < 2) continue;
    out.push({
      numero_fir: fir,
      peso_effettivo_kg: Math.round(quote.reduce((s, r) => s + pesoDi(r), 0)),
      quote: quote
        .map(r => ({
          id_ordine: ordineDi(r) || '—',
          ticket: ticketDi(r) || '—',
          peso_stimato_kg: Math.round(Number(r.peso_stimato || 0)),
          peso_effettivo_kg: Math.round(pesoDi(r)),
        }))
        .sort((a, b) => b.peso_effettivo_kg - a.peso_effettivo_kg),
    });
  }
  return out;
}

/**
 * Lo stesso formulario ripetuto sullo STESSO ordine: quello si', e' un ritiro
 * caricato due volte, e pagato due volte.
 */
export function formulariDoppi(righe) {
  const out = [];
  for (const [fir, quote] of raggruppaPerFormulario(righe)) {
    if (quote.length < 2) continue;
    const ordini = new Set(quote.map(ordineDi).filter(Boolean));
    if (ordini.size > 1) continue;
    out.push({ numero_fir: fir, ordine: [...ordini][0] || '—', righe: quote });
  }
  return out;
}

/**
 * Fonde le quote di uno stesso formulario in una riga sola, sommando i pesi.
 * Serve a chi confronta il gestionale con un elenco esterno - la stampa del
 * portale, il report settimanale di un impianto - dove il formulario compare
 * una volta col suo peso intero.
 *
 * @param righe    le righe da fondere
 * @param opzioni  { stessoGruppo(a, b) } dice quando due quote sono davvero
 *                 dello stesso documento; per difetto basta il numero.
 *                 { fondi(base, quote, kg) } costruisce la riga risultante.
 */
export function unisciQuote(righe, opzioni = {}) {
  const stessoGruppo = opzioni.stessoGruppo || (() => true);
  const numero = opzioni.numero || chiaveFormulario;
  const peso = opzioni.peso || pesoDi;
  const fondi = opzioni.fondi || ((base, quote, kg) => ({ ...base, peso_effettivo: kg, quote }));
  const out = [];
  for (const [, quote] of raggruppaPerFormulario(righe, numero)) {
    if (quote.length < 2) { out.push(quote[0]); continue; }
    // dentro lo stesso numero possono esserci quote non accorpabili (date o
    // destinazioni diverse): si raggruppano a catena sulla prima compatibile
    const blocchi = [];
    for (const q of quote) {
      const b = blocchi.find(x => stessoGruppo(x[0], q));
      if (b) b.push(q); else blocchi.push([q]);
    }
    for (const b of blocchi) {
      if (b.length < 2) { out.push(b[0]); continue; }
      out.push(fondi(b[0], b, Math.round(b.reduce((s, r) => s + peso(r), 0))));
    }
  }
  return out;
}
