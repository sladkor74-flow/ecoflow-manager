// Le sezioni PDF delle schede di Giacenze (06/10/2026).
//
// Una funzione per scheda: costruisce gli argomenti di esportaSezioniPdf con i
// dati che la scheda ha a video in quel momento. I numeri sono GREZZI - la
// formattazione la fa il `tipo` della colonna - e le tonnellate si passano in
// tonnellate, con tipo 't', mai in euro: un valore di riepilogo senza `tipo`
// verrebbe scritto in euro (esportaTabella.js).
//
// Rete, ACI ed extra raccolta restano colonne separate e non si sommano mai.

const ruolo = (r) => (r.tipo_destinazione === 'imp' ? 'Impianto' : 'Stoccaggio');
const comune = (anno, titolo) => ({
  nomeFile: `giacenze-${titolo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${anno}`,
  intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE',
  titolo: `Giacenze · ${titolo}`,
  sottotitolo: `Anno ${anno}`,
});

/** Scheda Situazione: giacenza a portale, per classe, e che cosa resta da dichiarare. */
export function situazionePdf(anno, righe, totali) {
  return {
    ...comune(anno, 'Situazione'),
    riepilogo: [
      { etichetta: 'Giacenza rete a portale', valore: totali.giacenza_portale_t, tipo: 't' },
      { etichetta: 'Giacenza ACI', valore: totali.giacenza_aci_t, tipo: 't' },
      { etichetta: 'In attesa di dichiarazione', valore: totali.in_attesa_dichiarazione_t, tipo: 't' },
      { etichetta: 'Dichiarato nell’anno', valore: totali.dichiarato_t, tipo: 't' },
    ],
    sezioni: [{
      titolo: 'Siti',
      colonne: [
        { titolo: 'Sito', tipo: 'testo', peso: 2 },
        { titolo: 'Ruolo', tipo: 'testo', peso: 0.9 },
        { titolo: 'Giacenza rete', tipo: 't', peso: 1 },
        { titolo: 'P (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'M (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'G1 (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'G2 (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'ACI (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'In attesa dich.', tipo: 't', peso: 1 },
        { titolo: 'Ordini da dich.', tipo: 'intero', peso: 0.8 },
        { titolo: 'Dichiarato', tipo: 't', peso: 1 },
      ],
      righe: righe.map(r => ({
        celle: [
          r.sito, ruolo(r), r.giacenza_portale_t,
          (r.giacenza_classi_kg || {}).P, (r.giacenza_classi_kg || {}).M,
          (r.giacenza_classi_kg || {}).G1, (r.giacenza_classi_kg || {}).G2, (r.giacenza_classi_kg || {}).ACI,
          r.in_attesa_dichiarazione_t, r.ordini_da_dichiarare, r.dichiarato_t,
        ],
      })),
    }],
    note: ['La giacenza di un impianto e’ la fotografia del portale; quella di un piazzale e’ l’ancora dell’anno piu’ tutti i movimenti finiti dopo. Rete, ACI ed extra raccolta non si sommano mai.'],
  };
}

/** Scheda Derivati: che cosa e' uscito dal trattamento. */
export function derivatiPdf(anno, righe, totali) {
  return {
    ...comune(anno, 'Derivati'),
    riepilogo: [
      { etichetta: 'Dichiarato', valore: totali.dichiarato_t, tipo: 't' },
      { etichetta: 'Granulo', valore: totali.granulo_t, tipo: 't' },
      { etichetta: 'Fibre', valore: totali.fibre_t, tipo: 't' },
      { etichetta: 'Metallo', valore: totali.metallo_t, tipo: 't' },
    ],
    sezioni: [{
      titolo: 'Derivati per sito',
      colonne: [
        { titolo: 'Sito', tipo: 'testo', peso: 2 },
        { titolo: 'Ruolo', tipo: 'testo', peso: 0.9 },
        { titolo: 'Dichiarato', tipo: 't', peso: 1 },
        { titolo: 'Granulo', tipo: 't', peso: 1 },
        { titolo: 'Fibre', tipo: 't', peso: 1 },
        { titolo: 'Metallo', tipo: 't', peso: 1 },
        { titolo: 'Ciabattato', tipo: 't', peso: 1 },
        { titolo: 'Cippato', tipo: 't', peso: 1 },
      ],
      righe: righe.filter(r => r.dichiarato_t > 0).map(r => ({
        celle: [r.sito, ruolo(r), r.dichiarato_t, r.granulo_t, r.fibre_t, r.metallo_t, r.ciabattato_t, r.cippato_t],
      })),
    }],
  };
}

/** Scheda Target: target, conferito, residuo e copertura. */
export function targetPdf(anno, righe, totali) {
  return {
    ...comune(anno, 'Target'),
    riepilogo: [
      { etichetta: 'Target primarie', valore: totali.target_primarie_t, tipo: 't' },
      { etichetta: 'Target totale', valore: totali.target_totale_t, tipo: 't' },
      { etichetta: 'Primarie RETE', valore: totali.conferito_primarie_t, tipo: 't' },
      { etichetta: 'Conferito RETE', valore: totali.conferito_t, tipo: 't' },
    ],
    sezioni: [{
      titolo: 'Target e conferito per sito',
      colonne: [
        { titolo: 'Sito', tipo: 'testo', peso: 2 },
        { titolo: 'Ruolo', tipo: 'testo', peso: 0.9 },
        { titolo: 'Target primarie', tipo: 't', peso: 1 },
        { titolo: 'Target totale', tipo: 't', peso: 1 },
        { titolo: 'Primarie RETE', tipo: 't', peso: 1 },
        { titolo: 'Secondarie', tipo: 't', peso: 1 },
        { titolo: 'Conferito RETE', tipo: 't', peso: 1 },
        { titolo: 'Residuo', tipo: 't', peso: 1 },
        { titolo: 'Copertura %', tipo: 'percentuale', peso: 0.8 },
        { titolo: 'ACI', tipo: 't', peso: 0.9 },
        { titolo: 'Extra raccolta', tipo: 't', peso: 0.9 },
      ],
      righe: righe.map(r => ({
        celle: [
          r.sito, ruolo(r), r.target_primarie_t, r.target_totale_t, r.conferito_primarie_t,
          r.secondarie_nette_t, r.conferito_t, r.residuo_t, r.percentuale_target,
          r.conferito_aci_t, r.conferito_extra_t,
        ],
      })),
    }],
    note: [
      'Residuo: target totale meno tutto quello che e’ arrivato, primarie e secondarie. Copertura: le sole primarie sul target totale.',
      'Il target delle primarie dei raccoglitori senza impianto scritto e’ ripartito mese per mese sui conferimenti.',
    ],
  };
}

/**
 * La griglia dei target dei raccoglitori di Target & Status: impianto,
 * raccoglitore, regione, i dodici target mensili e i totali. Dove l'impianto non
 * e' scritto si dice come il gestionale sta ripartendo quel target.
 */
export function targetRaccoglitoriPdf(anno, elenco, ripartizione) {
  const MESI_B = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const MESI_N = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const righe = (elenco || []).map(r => {
    const mesi = MESI_N.map(m => (r.mesi && r.mesi[m] && !r.mesi[m].non_raccoglie ? Number(r.mesi[m].target) || 0 : null));
    const somma = mesi.reduce((s, v) => s + (v || 0), 0);
    const annuo = r.annuo ? Number(r.annuo.target_tonnellate) || 0 : 0;
    const quote = r.impianto ? '' : ((ripartizione && ripartizione(r)) || []).map(q => `${q.impianto} ${q.pct}%`).join(', ');
    return {
      celle: [
        r.impianto || (quote ? `ripartito: ${quote}` : 'senza impianto'),
        r.nome, r.regione || '', annuo, ...mesi, somma, annuo ? Math.round((annuo - somma) * 1000) / 1000 : null,
      ],
    };
  });
  return {
    nomeFile: `target-raccoglitori-${anno}`,
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE',
    titolo: 'Target & Status · Target raccoglitori',
    sottotitolo: `Anno ${anno}`,
    riepilogo: [
      { etichetta: 'Righe', valore: righe.length, tipo: 'intero' },
      { etichetta: 'Target annuo totale', valore: righe.reduce((s, r) => s + (r.celle[3] || 0), 0), tipo: 't' },
    ],
    sezioni: [{
      titolo: 'Target per raccoglitore, impianto e regione',
      colonne: [
        { titolo: 'Impianto', tipo: 'testo', peso: 1.6 },
        { titolo: 'Raccoglitore', tipo: 'testo', peso: 1.6 },
        { titolo: 'Regione', tipo: 'testo', peso: 1 },
        { titolo: 'Annuo', tipo: 't', peso: 0.9 },
        ...MESI_B.map(m => ({ titolo: m, tipo: 't', peso: 0.7 })),
        { titolo: 'Somma mesi', tipo: 't', peso: 0.9 },
        { titolo: 'Da ripartire', tipo: 't', peso: 0.9 },
      ],
      righe,
    }],
    note: ['Dove l’impianto non e’ scritto, il target si ripartisce da se’ fra i siti dove quel raccoglitore ha portato le primarie dell’anno.'],
  };
}
