// Omologhe dei produttori.
//
// L'omologa e' il documento che un punto di raccolta consegna quando si programma
// il ritiro: dice che cosa conferisce e vale un anno. Due fogli ne parlano e non
// sempre dicono la stessa cosa:
//
//   - l'elenco delle omologhe, tenuto da noi, con inizio e fine validita';
//   - il registro di carico e scarico dell'impianto, dove alla riga del carico
//     l'operatore scrive "OMOLOGA OK" quando ha visto il documento.
//
// Questo file mette in fila i due elenchi e dice dove non si somigliano. Dove non
// si somigliano nessuno decide al posto dell'operatore: la verifica si fa in
// ufficio, con i documenti in mano, e la decisione resta sua.

const FORME = /\b(srls|srl|spa|sas|snc|sc|ss|soc|societa|cooperativa|coperativa|unipersonale|ditta|di|del|della|dei|e|c)\b/g;

/**
 * Nome ridotto all'osso: minuscolo, senza punteggiatura e senza forma societaria.
 *
 * I punti separano le parole, altrimenti "Pneus.point" diventerebbe una parola
 * sola; pero' le sigle puntate vanno ricomposte, se no "FERRARA S.R.L." resta
 * "ferrara s r l" e non somiglia piu' a "Ferrara srl". Percio' le sequenze di
 * lettere singole si riuniscono: "s r l" torna "srl", "v g" torna "vg".
 */
export function chiaveProduttore(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b(?:[a-z] )+[a-z]\b/g, (m) => m.replace(/ /g, ''))
    .replace(FORME, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distanza di edit con tetto: oltre il tetto non interessa quanto siano lontane. */
export function distanza(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prec = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let min = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prec[j] + 1, cur[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur[j] = v;
      if (v < min) min = v;
    }
    if (min > max) return max + 1;
    prec = cur;
  }
  return prec[b.length];
}

/**
 * Quanto due nomi ridotti si somigliano, da 0 a 1.
 *
 * Prudente per scelta: un abbinamento sbagliato fa sparire una divergenza vera e
 * nessuno se ne accorge, mentre un abbinamento mancato finisce sotto gli occhi
 * dell'operatore, che lo sistema in un momento. Meglio il secondo.
 */
export function somiglianza(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const parole = (s) => s.split(' ').filter(x => x.length > 2);
  const pa = parole(a), pb = parole(b);
  // Uno contiene l'altro per intero: "il gommista" dentro "il gommista di nicoli fabio".
  if ((a.includes(b) || b.includes(a)) && Math.min(pa.length, pb.length) >= 2) return 0.95;
  // Stessa frase con un errore di battitura: "pnuematici" per "pneumatici".
  const lungo = Math.max(a.length, b.length);
  if (lungo >= 10 && distanza(a, b, 2) <= 2) return 0.92;
  // Parole in comune, contando come comuni anche quelle scritte male.
  const ta = new Set(pa), tb = new Set(pb);
  let comuni = 0;
  for (const t of ta) {
    if (tb.has(t)) { comuni++; continue; }
    for (const u of tb) if (t.length >= 5 && Math.abs(t.length - u.length) <= 2 && distanza(t, u, 2) <= 2) { comuni += 0.9; break; }
  }
  // Una parola sola in comune non basta mai: "pneumatici" ce l'hanno quasi tutti.
  if (comuni < 2) return 0;
  return comuni / Math.min(ta.size, tb.size);
}

export const SOGLIA_ABBINAMENTO = 0.9;

/**
 * Abbina i produttori dei due fogli, i piu' somiglianti per primi.
 * Restituisce { abbinati, soloElenco, soloRegistro }.
 */
export function abbina(elenco, registro) {
  const coppie = [];
  elenco.forEach((e, i) => {
    registro.forEach((x, j) => {
      if (e.chiave === x.chiave) { coppie.push({ i, j, punteggio: 1 }); return; }
      const s = somiglianza(e.chiave, x.chiave);
      if (s >= SOGLIA_ABBINAMENTO) coppie.push({ i, j, punteggio: s });
    });
  });
  coppie.sort((a, b) => b.punteggio - a.punteggio);
  const presiE = new Set(), presiX = new Set(), abbinati = [];
  for (const c of coppie) {
    if (presiE.has(c.i) || presiX.has(c.j)) continue;
    presiE.add(c.i); presiX.add(c.j);
    abbinati.push({ elenco: elenco[c.i], registro: registro[c.j], punteggio: c.punteggio });
  }
  return {
    abbinati,
    soloElenco: elenco.filter((_e, i) => !presiE.has(i)),
    soloRegistro: registro.filter((_x, j) => !presiX.has(j)),
  };
}

// Fra la data del documento e il primo ritiro in cui l'impianto lo annota passano
// di solito pochi giorni: sotto questa soglia non e' una divergenza.
export const TOLLERANZA_GIORNI = 7;

// Oltre questa distanza prima dell'inizio, l'annotazione e' del documento dell'anno prima.
export const GIORNI_DOCUMENTO_PRECEDENTE = 330;

const giorniFra = (a, b) => Math.round(
  Math.abs(new Date(a + 'T00:00:00Z').getTime() - new Date(b + 'T00:00:00Z').getTime()) / 86400000,
);

/** La stessa data un anno dopo; il 29 febbraio diventa 28. */
export function unAnnoDopo(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const giorno = m[2] === '02' && m[3] === '29' ? '28' : m[3];
  return `${Number(m[1]) + 1}-${m[2]}-${giorno}`;
}

/**
 * Scadenza da cui si conta il tempo che resta.
 *
 * Il documento si recepisce una volta, al primo ritiro, e da li' parte l'anno di
 * validita': i ritiri successivi non devono riportare l'annotazione. Se l'elenco
 * e il registro fissano l'inizio in giorni diversi vale il piu' vecchio, perche'
 * e' da quel giorno che il documento era in mano: la scadenza e' la piu' prudente.
 */
export function scadenzaEffettiva(omologaA, dataRegistro, omologaDa) {
  // Un'annotazione di quasi un anno prima dell'inizio riguarda il documento
  // precedente, non quello rinnovato: non accorcia la nuova validita'.
  const vecchia = omologaDa && dataRegistro && giorniFra(dataRegistro, omologaDa) > GIORNI_DOCUMENTO_PRECEDENTE && dataRegistro < omologaDa;
  const daRegistro = dataRegistro && !vecchia ? unAnnoDopo(dataRegistro) : null;
  if (omologaA && daRegistro) return omologaA < daRegistro ? omologaA : daRegistro;
  return omologaA || daRegistro || null;
}

/**
 * Che cosa non torna fra i due fogli per questo produttore.
 *
 * Chi e' nell'elenco e all'impianto non ha ancora portato nulla -- o ha portato
 * solo prima che l'omologa iniziasse -- non e' una divergenza: l'annotazione
 * arrivera' con il primo ritiro. Per l'ACI il controllo non si fa: il registro
 * dell'impianto le omologhe ACI non le annota mai (verificato il 17/09/2026 su
 * tutte e dieci), e segnalarle sarebbe solo rumore.
 */
export function divergenza({ canale, nellElenco, annotato, carichi, ultimoCarico, punteggio, dataElenco, dataRegistro }) {
  if (nellElenco && !annotato) {
    if (canale === 'ACI') return 'nessuna';
    const dopoInizio = !dataElenco || !ultimoCarico || ultimoCarico >= dataElenco;
    return carichi > 0 && dopoInizio ? 'solo_elenco' : 'nessuna';
  }
  if (!nellElenco && annotato) return 'solo_registro';
  if (punteggio !== undefined && punteggio < 1) return 'nome_diverso';
  if (dataElenco && dataRegistro && giorniFra(dataElenco, dataRegistro) > TOLLERANZA_GIORNI) return 'data_diversa';
  return 'nessuna';
}

// Quanto pesa ciascuna divergenza: prima quelle che possono farci mancare un
// documento, poi quelle di forma.
export const PESO_DIVERGENZA = {
  solo_registro: 1,
  solo_elenco: 2,
  data_diversa: 3,
  nome_diverso: 4,
  nessuna: 9,
};

/** Giorni che mancano alla scadenza; negativo se e' gia' passata. */
export function giorniAllaScadenza(omologaA, oggi) {
  if (!omologaA) return null;
  const fine = new Date(String(omologaA).slice(0, 10) + 'T00:00:00Z').getTime();
  const adesso = new Date(String(oggi || new Date().toISOString()).slice(0, 10) + 'T00:00:00Z').getTime();
  if (Number.isNaN(fine) || Number.isNaN(adesso)) return null;
  return Math.round((fine - adesso) / 86400000);
}

// Il colore si scalda man mano che la scadenza si avvicina. Non e' un alert:
// e' un documento che si richiede al produttore quando si programma la raccolta.
export const FASCE_SCADENZA = [
  { chiave: 'scaduta', fino: -1, etichetta: 'Scaduta' },
  { chiave: 'critica', fino: 15, etichetta: 'Scade entro 15 giorni' },
  { chiave: 'vicina', fino: 30, etichetta: 'Scade entro un mese' },
  { chiave: 'avviso', fino: 60, etichetta: 'Scade entro due mesi' },
  { chiave: 'lontana', fino: 90, etichetta: 'Scade entro tre mesi' },
  { chiave: 'valida', fino: Infinity, etichetta: 'Valida' },
];

export function fasciaScadenza(giorni) {
  if (giorni === null || giorni === undefined) return 'senza_data';
  for (const f of FASCE_SCADENZA) if (giorni <= f.fino) return f.chiave;
  return 'valida';
}
