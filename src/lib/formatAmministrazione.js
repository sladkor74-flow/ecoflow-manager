// IL «FORMAT AMMINISTRAZIONE»: i fogli come li vuole l'amministrazione.
//
// QUI C'E' SOLO LA TABELLA, senza Excel ne' PDF: cosi' le prove la possono
// caricare senza tirarsi dietro xlsx e tutto il resto. Chi scrive i file e'
// src/lib/formatAmministrazioneExport.js.
//
// Richiesta dell'utente, 03/10/2026: «fai in modo che vengano generati dal nostro
// gestionale IN AGGIUNTA, ripeto, in aggiunta a quanto c'e' gia'... chiama
// l'esportazione sia excel che pdf "format amministrazione" e riproducili
// esattamente come loro richiedono... tutto cio' che c'e' poiche' funziona lo
// lasciamo com'e'».
//
// Quindi questo file non tocca niente: src/lib/fatturazioneExport.js resta dov'e'
// e continua a produrre i suoi report. Qui ci sono SOLO i due fogli in piu',
// ricalcati su quelli veri dell'amministrazione:
//   attiva\01-SMOCO-Fatturazione RETE 2026.xlsx, foglio del mese
//   attiva\02-SMOCO-Fatturazione ACI 2026.xlsx,  foglio del mese
//
// LE DIFFERENZE COL REPORT CHE GIA' ESISTE, che sono il motivo per cui questo
// file esiste:
//   RETE  il prezzo e' in euro al CHILO (0,202) e non a tonnellata, e in fondo
//         c'e' la REGIONE del ritiro, che nel report attuale non c'e';
//   ACI   non c'e' la colonna del ticket, e sopra la tabella c'e' una riga di
//         intestazione «SMOCO | ACI | MESE ANNO». La colonna Note resta VUOTA:
//         «la scrivo io a mano» (utente, 03/10/2026), perche' dice se la
//         dichiarazione e' stata ricevuta e inviata al consorzio, e una frase
//         sbagliata su una fattura non la scrive il gestionale.
//
// IL RISCONTRO E' SETTEMBRE 2026, che l'utente ha verificato: la rete fa 380
// ordini, 1.120.240 kg e 226.288,48 euro; l'ACI 6 ordini, 18.890 kg e 4.410,10
// euro. prove/formatAmministrazione.mjs tiene quei numeri.

const tipoServizio = (r) => (r.servizio_ecotyre === 'TRASP' ? 'Trasp.' : 'Trasp.+Tratt.');
const giorno = (v) => (v ? new Date(v).toLocaleDateString('it-IT') : '');
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/** Il prezzo al chilo da quello a tonnellata: 202 €/t sono 0,202 €/kg. */
export const euroAlChilo = (euroTonnellata) => Math.round((Number(euroTonnellata) || 0) / 1000 * 100000) / 100000;

/**
 * La tabella del mese nel formato dell'amministrazione.
 * Torna { titolo, intestazione, colonne, righe, totale_kg, totale_euro, iKg, iTotale }.
 * Le righe sospese restano fuori, come nel report che gia' c'e'.
 */
export function tabellaAmministrazione(tipologia, righe, anno, mese) {
  const periodo = `${anno} ${String(mese || '').toUpperCase()}`;
  const valide = (righe || []).filter(r => !r.sospesa);
  const totaleKg = valide.reduce((s, r) => s + (Number(r.quantita) || 0), 0);
  const totaleEuro = r2(valide.reduce((s, r) => s + (Number(r.totale) || 0), 0));

  if (tipologia === 'ACI') {
    return {
      foglio: `${String(mese || '').toUpperCase()} ${anno}`,
      // La riga sopra la tabella, come nel file dell'amministrazione.
      intestazione: ['SMOCO', '', 'ACI', '', '', '', '', `${String(mese || '').toUpperCase()} ${anno}`],
      iKg: 8, iTotale: 10,
      totale_kg: totaleKg, totale_euro: totaleEuro,
      colonne: [
        { titolo: 'Regione', tipo: 'testo', peso: 0.9 },
        { titolo: 'Fatturante', tipo: 'testo', peso: 0.9 },
        { titolo: 'Periodo', tipo: 'testo', peso: 0.9 },
        { titolo: 'Tipo', tipo: 'testo', peso: 0.9 },
        { titolo: 'Ordine', tipo: 'testo', peso: 1 },
        { titolo: 'Data fine trasporto', tipo: 'testo', peso: 1 },
        { titolo: 'Numero FIR', tipo: 'testo', peso: 1.2 },
        { titolo: 'Classe', tipo: 'testo', peso: 1.1 },
        { titolo: 'Quantità (kg)', tipo: 'kg', peso: 0.8 },
        { titolo: 'Prezzo Unitario (Euro/TON)', tipo: 'euro', peso: 1.1 },
        { titolo: 'Prezzo Totale', tipo: 'euro', peso: 0.9 },
        { titolo: 'Note', tipo: 'testo', peso: 1.6 },
      ],
      righe: valide.map(r => [
        r.regione || '', r.fatturante || 'SMOCO Srl', `${anno} ${mese}`, tipoServizio(r),
        r.ordine || '', giorno(r.data_fine_trasporto), r.numero_fir || '', r.classe || '',
        Number(r.quantita) || 0, Number(r.tariffa_valore) || 0, r2(r.totale),
        // Vuota di proposito: la scrive l'amministrazione a mano.
        '',
      ]),
    };
  }

  // RETE. Il prezzo si scrive al CHILO, come nel foglio dell'amministrazione, e
  // l'ultima colonna e' la regione del ritiro.
  return {
    foglio: `${String(mese || '').toUpperCase()} ${anno}`,
    intestazione: null,
    iKg: 6, iTotale: 8,
    totale_kg: totaleKg, totale_euro: totaleEuro,
    colonne: [
      { titolo: 'Periodo', tipo: 'testo', peso: 1 },
      { titolo: 'Tipo', tipo: 'testo', peso: 0.9 },
      { titolo: 'Ordine', tipo: 'testo', peso: 1.1 },
      { titolo: 'Data fine trasporto', tipo: 'testo', peso: 1.1 },
      { titolo: 'Numero FIR', tipo: 'testo', peso: 1.3 },
      { titolo: 'Classe', tipo: 'testo', peso: 0.7 },
      { titolo: 'Quantità (kg)', tipo: 'kg', peso: 0.9 },
      { titolo: 'Prezzo Unitario (Euro/Kg)', tipo: 'euro', peso: 1.2 },
      { titolo: 'Prezzo Totale', tipo: 'euro', peso: 1 },
      { titolo: 'Regione', tipo: 'testo', peso: 1 },
    ],
    righe: valide.map(r => [
      periodo, tipoServizio(r), r.ordine || '', giorno(r.data_fine_trasporto),
      r.numero_fir || '', r.classe || '', Number(r.quantita) || 0,
      euroAlChilo(r.tariffa_valore), r2(r.totale), r.regione || '',
    ]),
  };
}

export const nomeFileAmministrazione = (tipologia, anno, mese, estensione) =>
  `Format_amministrazione_${tipologia}_${mese}_${anno}.${estensione}`;
