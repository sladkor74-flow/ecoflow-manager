// IL FOGLIO DELLA PASSIVA NEL «FORMAT AMMINISTRAZIONE».
//
// Qui c'e' solo la COSTRUZIONE del foglio, senza Excel ne' PDF: le prove la
// caricano senza tirarsi dietro xlsx. Chi scrive i file e'
// src/lib/passivaAmministrazioneExport.js.
//
// Il foglio vero dell'amministrazione (passiva\Fatturazione passiva Ecotyre
// (settembre).xlsx) e' un unico foglio con tre blocchi - RETE, ACI, EXTRA
// RACCOLTA - e dentro ogni blocco tre tabelle:
//   RACCOGLITORI          chi raccoglie, con le sue voci e il suo prezzo;
//   IMPIANTI \ STOCCAGGI  chi tratta o stocca, con le sue voci;
//   TRASPORTO (secondarie) un viaggio per riga.
//
// LE VOCI SONO UN MODELLO FISSO, E SI VEDONO SEMPRE ANCHE A ZERO.
//
// Scelta dell'utente, 03/10/2026, fra le opzioni che gli avevo proposto: modello
// fisso E modificabile da lui. Il perche' si legge nel suo foglio di settembre:
// sotto LOGISTICA & PNEUMATICI ci sono quattro righe - Napoli 68, Salerno 68,
// Avellino 71, Caserta 72 - e tre di quelle sono a zero. Tenerle vuol dire che il
// foglio e' identico ogni mese e che un conferimento comparso dove prima non ce
// n'erano si vede a colpo d'occhio; generarle solo quando c'e' qualcosa vuol dire
// un foglio che cambia forma ogni mese.
//
// Le voci stanno nell'archivio VocePassivaAmministrazione, che l'utente corregge
// quando cambia un accordo. Le QUANTITA' no: quelle le mette il gestionale dai
// movimenti del mese, cioe' da quello che calcolaPassiva ha gia' calcolato.

const n2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const testo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const chiave = (v) => testo(v).toLowerCase();

/** Il totale di una riga: a tonnellata o a viaggio, come dice l'unita'. */
export function importoVoce(prezzo, unita, tonnellate, viaggi) {
  const p = Number(prezzo) || 0;
  if (unita === 'euro_viaggio') return n2(p * (Number(viaggi) || 0));
  return n2(p * (Number(tonnellate) || 0));
}

/**
 * Le voci di un blocco, ordinate come vanno stampate: prima per soggetto
 * nell'ordine dato, poi per ordine della voce, poi per nome.
 */
export function vociOrdinate(voci, canale, blocco) {
  return (voci || [])
    .filter(v => v && v.attiva !== false && v.canale === canale && v.blocco === blocco)
    .slice()
    .sort((a, b) => (Number(a.ordine) || 0) - (Number(b.ordine) || 0)
      || testo(a.soggetto).localeCompare(testo(b.soggetto), 'it')
      || testo(a.voce).localeCompare(testo(b.voce), 'it'));
}

/**
 * I chili del mese che spettano a una voce, presi dalle righe gia' calcolate.
 *
 * L'aggancio e' per SOGGETTO e, dentro il soggetto, per il criterio scritto sulla
 * voce (regione, provincia, destinazione, classi, provenienza). Senza criterio la
 * voce prende tutto quello che resta del soggetto: e' il caso dei fornitori con
 * una riga sola, che nel foglio dell'amministrazione sono la maggior parte.
 */
export function tonnellateDellaVoce(voce, righeSoggetto) {
  let criterio = null;
  try { criterio = voce.criterio_json ? JSON.parse(voce.criterio_json) : null; } catch { criterio = null; }
  const combacia = (r) => {
    if (!criterio) return true;
    if (criterio.regione && chiave(r.regione) !== chiave(criterio.regione)) return false;
    if (criterio.provincia && chiave(r.provincia) !== chiave(criterio.provincia)) return false;
    if (criterio.destinazione && chiave(r.destinazione) !== chiave(criterio.destinazione)) return false;
    if (criterio.provenienza && chiave(r.provenienza) !== chiave(criterio.provenienza)) return false;
    if (Array.isArray(criterio.classi) && criterio.classi.length) {
      const sue = testo(r.classe).split(',').map(x => chiave(x)).filter(Boolean);
      if (!criterio.classi.some(c => sue.includes(chiave(c)))) return false;
    }
    return true;
  };
  const scelte = (righeSoggetto || []).filter(combacia);
  return {
    tonnellate: Math.round(scelte.reduce((s, r) => s + (Number(r.tonnellate) || 0), 0) * 1000) / 1000,
    viaggi: scelte.reduce((s, r) => s + (Number(r.viaggi) || 0), 0),
    righe: scelte.length,
  };
}

/**
 * Un blocco del foglio: una riga per soggetto (il totale, in grassetto) e sotto
 * le sue voci, sempre tutte. Torna { righe, totale_t, totale_euro, non_previsti }.
 *
 * non_previsti sono i soggetti che nel mese hanno movimenti ma non hanno nessuna
 * voce nel modello: non si buttano via e non si inventano prezzi - si elencano,
 * perche' e' il segnale che il modello va aggiornato.
 */
export function bloccoPassiva(voci, dati, canale, blocco) {
  const scelte = vociOrdinate(voci, canale, blocco);
  const perSoggetto = new Map();
  for (const r of dati || []) {
    const k = chiave(r.soggetto);
    if (!perSoggetto.has(k)) perSoggetto.set(k, []);
    perSoggetto.get(k).push(r);
  }
  const righe = [];
  let totaleT = 0;
  let totaleEuro = 0;
  const soggettiUsati = new Set();
  const ordineSoggetti = [...new Set(scelte.map(v => testo(v.soggetto)))];
  for (const soggetto of ordineSoggetti) {
    const sue = scelte.filter(v => testo(v.soggetto) === soggetto);
    const righeSoggetto = perSoggetto.get(chiave(soggetto)) || [];
    soggettiUsati.add(chiave(soggetto));
    const dettaglio = sue.map(v => {
      const q = tonnellateDellaVoce(v, righeSoggetto);
      return {
        voce: testo(v.voce),
        tonnellate: q.tonnellate,
        viaggi: q.viaggi,
        prezzo: Number(v.prezzo) || 0,
        unita_misura: v.unita_misura || 'euro_tonnellata',
        totale: importoVoce(v.prezzo, v.unita_misura, q.tonnellate, q.viaggi),
      };
    });
    const tSoggetto = Math.round(dettaglio.reduce((s, d) => s + d.tonnellate, 0) * 1000) / 1000;
    const eSoggetto = n2(dettaglio.reduce((s, d) => s + d.totale, 0));
    righe.push({ tipo: 'soggetto', soggetto, tonnellate: tSoggetto, totale: eSoggetto });
    for (const d of dettaglio) righe.push({ tipo: 'voce', soggetto, ...d });
    totaleT += tSoggetto;
    totaleEuro += eSoggetto;
  }
  // Chi ha movimenti ma non e' nel modello: si dice, non si indovina.
  const nonPrevisti = [...perSoggetto.entries()]
    .filter(([k]) => !soggettiUsati.has(k))
    .map(([, righeS]) => ({
      soggetto: testo(righeS[0].soggetto),
      tonnellate: Math.round(righeS.reduce((s, r) => s + (Number(r.tonnellate) || 0), 0) * 1000) / 1000,
    }))
    .filter(x => x.tonnellate > 0)
    .sort((a, b) => b.tonnellate - a.tonnellate);
  return {
    righe,
    totale_t: Math.round(totaleT * 1000) / 1000,
    totale_euro: n2(totaleEuro),
    non_previsti: nonPrevisti,
  };
}

/**
 * Il foglio intero di un canale: i tre blocchi e il totale in cima, com'e' nel
 * file dell'amministrazione.
 *
 * `passiva` e' quello che restituisce calcolaPassiva: { raccoglitori,
 * impianti_stoccaggi, trasporti_secondaria }. Il trasporto non ha voci fisse -
 * le righe sono i viaggi del mese - quindi si riporta com'e'.
 */
export function foglioPassiva(voci, passiva, canale, mese) {
  const raccoglitori = bloccoPassiva(voci, (passiva && passiva.raccoglitori) || [], canale, 'raccoglitori');
  const impianti = bloccoPassiva(voci, (passiva && passiva.impianti_stoccaggi) || [], canale, 'impianti');
  const trasporti = ((passiva && passiva.trasporti_secondaria) || []).map(t => ({
    produttore: testo(t.produttore || t.stoccaggio),
    trasportatore: testo(t.trasportatore),
    destinatario: testo(t.destinatario || t.destinazione),
    tonnellate: Math.round((Number(t.tonnellate) || 0) * 1000) / 1000,
    unita_misura: t.unita_misura || '',
    prezzo: Number(t.tariffa_valore) || 0,
    viaggi: Number(t.viaggi) || 0,
    totale: n2(t.importo),
  }));
  const totaleTrasporti = n2(trasporti.reduce((s, t) => s + t.totale, 0));
  return {
    canale,
    mese,
    raccoglitori,
    impianti,
    trasporti: {
      righe: trasporti,
      totale_t: Math.round(trasporti.reduce((s, t) => s + t.tonnellate, 0) * 1000) / 1000,
      totale_euro: totaleTrasporti,
    },
    // Il numero in cima al foglio: i tre blocchi di QUESTO canale, mai di altri.
    totale_euro: n2(raccoglitori.totale_euro + impianti.totale_euro + totaleTrasporti),
  };
}

/**
 * Il modello proposto a partire da un mese gia' calcolato: un punto di partenza
 * da correggere, non una verita'. Serve a non far cominciare l'utente da un
 * foglio vuoto. Una voce per soggetto, col prezzo che il mese ha usato.
 */
export function modelloDaPassiva(passiva, canale, anno) {
  const fuori = [];
  const aggiungi = (blocco, righe) => {
    const visti = new Map();
    for (const r of righe || []) {
      const k = chiave(r.soggetto);
      if (!visti.has(k)) visti.set(k, { soggetto: testo(r.soggetto), prezzo: Number(r.tariffa_valore) || 0, unita: r.unita_misura === 'euro_viaggio' ? 'euro_viaggio' : 'euro_tonnellata' });
    }
    let i = 0;
    for (const v of visti.values()) {
      fuori.push({ anno, canale, blocco, soggetto: v.soggetto, voce: '', prezzo: v.prezzo, unita_misura: v.unita, ordine: ++i * 10, attiva: true });
    }
  };
  aggiungi('raccoglitori', (passiva && passiva.raccoglitori) || []);
  aggiungi('impianti', (passiva && passiva.impianti_stoccaggi) || []);
  return fuori;
}
