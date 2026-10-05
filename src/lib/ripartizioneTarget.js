// Specchio di base44/shared/ripartizioneTarget.ts per le pagine: la regola della
// ripartizione del target e' una sola e deve restare identica nei due posti
// (prove/specchi.mjs la controlla). Si modifica l'originale e si ricopia qui.
/** Tonnellate arrotondate al chilo. */
const t3 = (v) => Math.round(v * 1000) / 1000;

/**
 * Chili divisi in proporzione ai pesi col metodo del resto piu' grande: la somma
 * delle parti fa esattamente il totale, senza chili persi per arrotondamento. A
 * pari resto decide la chiave, cosi' lo stesso dato calcolato due volte da' lo
 * stesso risultato.
 * @param pesi coppie [chiave, peso]
 * @returns coppie [chiave, chili]
 */
export function quotePerResto(kgTotali, pesi) {
  const somma = pesi.reduce((s, [, p]) => s + p, 0);
  if (!(somma > 0) || !(kgTotali > 0)) return [];
  const parti = pesi.map(([k, p]) => {
    const esatto = (kgTotali * p) / somma;
    const giu = Math.floor(esatto);
    return { k, kg: giu, resto: esatto - giu };
  });
  let restano = kgTotali - parti.reduce((s, p) => s + p.kg, 0);
  const ordine = [...parti].sort((a, b) => (b.resto - a.resto) || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
  for (let i = 0; restano > 0; i = (i + 1) % ordine.length, restano--) ordine[i].kg++;
  return parti.filter(p => p.kg > 0).map(p => [p.k, p.kg]);
}

/**
 * Un target ripartito secondo la regola qui sopra.
 *
 * @param target tonnellate da ripartire
 * @param scritto Map chiave -> tonnellate decise a mano: vincono, e dove c'e' una
 *   riga scritta un ammanco resta un ammanco, perche' e' stato promesso
 * @param arrivato Map chiave -> tonnellate davvero arrivate nel periodo
 * @param riferimento la chiave dove va quello che non e' arrivato; '' se non si sa
 * @returns Map chiave -> { target, stimato } (stimato: e' una previsione, non un
 *   impegno). La somma dei target fa esattamente il target di partenza, al chilo.
 */
export function ripartisciQuota({ target = 0, scritto = new Map(), arrivato = new Map(), riferimento = '' }) {
  const out = new Map();
  const voce = (k) => {
    if (!out.has(k)) out.set(k, { target: 0, stimato: false });
    return out.get(k);
  };
  let scrittoTot = 0;
  for (const [k, t] of scritto) {
    if (!(Number(t) > 0)) continue;
    voce(k).target = t3(Number(t));
    scrittoTot += Number(t);
  }
  const libero = t3(Number(target) - scrittoTot);
  if (libero <= 0) return out;

  // il materiale arrivato che il target scritto non copre gia'
  const residuo = new Map();
  for (const [k, t] of arrivato) {
    const r = t3(Math.max(0, Number(t) - (Number(scritto.get(k)) || 0)));
    if (r > 0) residuo.set(k, r);
  }
  const totale = t3([...residuo.values()].reduce((s, v) => s + v, 0));
  if (totale >= libero) {
    for (const [k, kg] of quotePerResto(Math.round(libero * 1000), [...residuo].map(([k, v]) => [k, Math.round(v * 1000)]))) {
      voce(k).target = t3(voce(k).target + kg / 1000);
    }
    return out;
  }
  for (const [k, v] of residuo) voce(k).target = t3(voce(k).target + v);
  const resto = t3(libero - totale);
  if (resto > 0) {
    const v = voce(riferimento);
    v.target = t3(v.target + resto);
    v.stimato = true;
  }
  return out;
}

/**
 * Le quote riportate a sommare esattamente un totale. Serve quando le quote
 * vengono da piu' ripartizioni messe insieme (i dodici mesi piu' il resto
 * dell'anno): se i target mensili scritti non sommano il target annuo, le parti
 * non lo sommerebbero, e il totale della colonna non tornerebbe.
 * @param quote Map chiave -> { target, stimato }
 */
export function normalizzaQuote(quote, totale) {
  const somma = t3([...quote.values()].reduce((s, v) => s + v.target, 0));
  if (somma <= 0 || Math.abs(somma - totale) < 0.0005) return quote;
  const kg = quotePerResto(Math.round(totale * 1000), [...quote].map(([k, v]) => [k, Math.round(v.target * 1000)]));
  const out = new Map();
  for (const [k, v] of kg) out.set(k, { target: v / 1000, stimato: quote.get(k).stimato });
  return out;
}
