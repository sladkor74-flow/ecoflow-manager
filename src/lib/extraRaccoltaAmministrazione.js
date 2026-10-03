// L'EXTRA RACCOLTA NEL «FORMAT AMMINISTRAZIONE».
//
// Richiesta dell'utente, 03/10/2026: «nella fatturazione passiva tutto cio' che
// riguarda l'extra raccolta deve rientrare solo quando in quel determinato mese
// effettivamente sono stati chiusi quei movimenti e le info vanno riprese dal
// modulo 'extra raccolta', compresi i prezzi (raccolta, trattamento, eventuali
// sovraccosti, ecc...)».
//
// Quindi questo blocco non somiglia agli altri due del foglio. Gli altri hanno un
// modello fisso di voci e prezzi; qui no, e per un motivo: OGNI INTERVENTO FA
// STORIA A SE'. Un ritiro straordinario ha il suo costo di raccolta, il suo
// stoccaggio, il suo trattamento e i suoi oneri, scritti a mano sull'intervento
// prima di passarlo a terminato. Non c'e' un tariffario da cui leggerli e non ci
// deve essere: la passiva paga quello che sta scritto li'.
//
// QUANDO UN INTERVENTO ENTRA NEL MESE: quando e' TERMINATO e la sua FINE
// TRASPORTO cade in quel mese, col giorno italiano. E' la prima regola assoluta
// del gestionale - la competenza e' la fine trasporto, mai la chiusura a portale
// - e qui vale due volte, perche' l'extra raccolta a portale non esiste.
//
// IL COSTO E' QUELLO CHE DICE IL MODULO, al centesimo: si usa calcExtraRaccolta
// (src/lib/extraRaccoltaCalc.js), la stessa funzione che fa i numeri nella pagina
// dell'extra raccolta. Due conti diversi sullo stesso intervento sarebbero due
// numeri diversi in due pagine, ed e' il genere di cosa che fa perdere fiducia
// nel gestionale.
//
// I TRE «SOVRACOSTO» DELL'INTERVENTO NON STANNO QUI. Sovracosto raccolta,
// trasporto e trattamento sono importi che si aggiungono a quello che si fattura
// a Ecotyre: stanno nel ricavo, non nel costo (base44/shared/attivaCalcolo.ts li
// elenca fra le voci attive). Gli oneri che si PAGANO sono la pulizia e i costi
// aggiuntivi, e sono quelli che il foglio mette nella colonna degli oneri fissi.
// Se un domani un sovracosto va anche pagato, serve dirlo: non si indovina.

import { giornoRoma } from '@/lib/giornoItaliano';
import { calcExtraRaccolta } from '@/lib/extraRaccoltaCalc';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const n2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const n3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
const testo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const chiave = (v) => testo(v).toLowerCase();

/** Il mese in numero, dal nome come lo scrive il gestionale. */
export const indiceMese = (mese) => MESI.findIndex(m => chiave(m) === chiave(mese)) + 1;

/** Il prefisso aaaa-mm del mese, per confrontarlo col giorno italiano di una data. */
export function prefissoMese(anno, mese) {
  const i = indiceMese(mese);
  return anno && i > 0 ? `${anno}-${String(i).padStart(2, '0')}` : '';
}

const eTerminato = (r) => chiave(r && r.stato) === 'terminato';

/**
 * Gli interventi che appartengono al mese: terminati, con la fine trasporto in
 * quel mese letta sul fuso italiano.
 *
 * Un terminato SENZA fine trasporto non sta in nessun mese e non si indovina:
 * torna nell'elenco `senza_data`, perche' va sistemato e non perso.
 */
export function interventiDelMese(interventi, anno, mese) {
  const prefisso = prefissoMese(anno, mese);
  const dentro = [];
  const senzaData = [];
  for (const r of interventi || []) {
    if (!eTerminato(r)) continue;
    const fine = giornoRoma(r.trasporto_finito_il);
    if (!fine) { senzaData.push(r); continue; }
    if (prefisso && fine.slice(0, 7) === prefisso) dentro.push(r);
  }
  // Nell'ordine in cui si leggono: per giorno di fine trasporto.
  dentro.sort((a, b) => String(giornoRoma(a.trasporto_finito_il)).localeCompare(String(giornoRoma(b.trasporto_finito_il))));
  return { dentro, senza_data: senzaData };
}

/** Chi ha prodotto il rifiuto: per una secondaria e' lo stoccaggio di partenza. */
export function produttoreDi(r) {
  const secondaria = chiave(r && r.tipo_movimento) === 'secondaria';
  if (secondaria) return testo(r.stoccaggio) || testo(r.produttore) || '—';
  return testo(r.produttore) || testo(r.ragione_sociale) || testo(r.punto_di_raccolta) || '—';
}

/**
 * IL BLOCCO DELL'EXTRA RACCOLTA: una riga per intervento chiuso nel mese, con i
 * suoi prezzi e il suo totale.
 *
 * Torna { righe, totale_kg, totale_t, totale_euro, senza_costi, senza_data }.
 * `senza_costi` sono gli interventi chiusi su cui nessun costo e' stato scritto:
 * la passiva non pagherebbe niente, e un intervento gratis e' quasi sempre una
 * dimenticanza. Si dicono, non si inventano i prezzi.
 */
export function bloccoExtraRaccolta(interventi, anno, mese) {
  const { dentro, senza_data } = interventiDelMese(interventi, anno, mese);
  const righe = dentro.map(r => {
    const c = calcExtraRaccolta(r);
    const raccolta = Number(r.costo_raccolta_t) || 0;
    const stoccaggio = Number(r.costo_stoccaggio_t) || 0;
    const trattamento = Number(r.costo_trattamento_t) || 0;
    const oneri = n2(Number(r.costo_pulizia || 0) + Number(r.costi_aggiuntivi || 0));
    // Il trasporto si paga A VIAGGIO: e' un importo fisso, non un prezzo a
    // tonnellata. Nel foglio dell'amministrazione e' la colonna «PREZZO
    // (Euro/viaggio)», che fino al 03/10/2026 nel gestionale non aveva un campo.
    const trasporto = n2(Number(r.costo_trasporto_viaggio || 0));
    return {
      numero_fir: testo(r.numero_fir) || '—',
      ordine: testo(r.id_ordine) || testo(r.numero_ordine_interno) || '—',
      produttore: produttoreDi(r),
      trasportatore: testo(r.trasportatore) || '—',
      destinatario: testo(r.destinazione) || '—',
      inizio: giornoRoma(r.trasporto_iniziato_il) || '',
      fine: giornoRoma(r.trasporto_finito_il) || '',
      cer: testo(r.cer) || '',
      kg: Math.round(Number(r.peso_effettivo || r.quantita_ritirata || 0)),
      tonnellate: n3(c.tonnellate),
      raccolta_t: raccolta,
      stoccaggio_t: stoccaggio,
      trattamento_t: trattamento,
      trasporto_viaggio: trasporto,
      oneri,
      // Il totale e' quello del modulo, non un conto rifatto qui.
      totale: n2(c.costo_totale),
      secondaria: chiave(r.tipo_movimento) === 'secondaria',
      note: [testo(r.note_costi), testo(r.tipologia_trasporto)].filter(Boolean).join(' · '),
      senza_costi: raccolta === 0 && stoccaggio === 0 && trattamento === 0 && oneri === 0 && trasporto === 0,
    };
  });
  return {
    righe,
    totale_kg: righe.reduce((s, r) => s + r.kg, 0),
    totale_t: n3(righe.reduce((s, r) => s + r.tonnellate, 0)),
    totale_euro: n2(righe.reduce((s, r) => s + r.totale, 0)),
    senza_costi: righe.filter(r => r.senza_costi && r.kg > 0),
    // I terminati senza fine trasporto: non stanno in nessun mese, e vanno
    // sistemati prima di fatturare.
    senza_data: senza_data.map(r => ({
      numero_fir: testo(r.numero_fir) || '—',
      ordine: testo(r.id_ordine) || '—',
      produttore: produttoreDi(r),
      kg: Math.round(Number(r.peso_effettivo || r.quantita_ritirata || 0)),
    })),
  };
}

// Le intestazioni e le larghezze delle colonne non stanno qui: sono
// impaginazione, e ogni formato (Excel e PDF) ha le sue. Qui ci sono solo i dati.
