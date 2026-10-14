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
//
// I CHILI SONO IL PESO EFFETTIVO, E BASTA (chiusura dell'audit, 11/10/2026).
// Qui si ripiegava sulla quantita' ritirata, come nella pagina: un terminato
// senza peso effettivo usciva nel foglio con un peso che la passiva non conta e
// la fattura non fattura. Ora la riga resta - i suoi importi fissi si pagano
// lo stesso, come nella passiva - ma senza chili, con la nota che lo dice, e
// l'intervento torna anche nell'elenco `senza_peso`: va sistemato, non stimato.
//
// IL SURPLUS SULLE TARIFFE (13/10/2026). Il Fuel Surcharge del consorzio, +5 €/t
// ai raccoglitori dal 01/10/2026 al 31/12/2026, vale anche qui. Non e' un costo
// dell'intervento: e' una riga per raccoglitore in fondo al blocco, sulle stesse
// tonnellate degli interventi del mese, come la riga del surplus sotto ogni
// fornitore della rete e dell'ACI («Fuel Surcharge · EMMESSE SRLS · t · 5,00 ·
// €»). Il conto e' quello della passiva - per fornitore che fattura e per
// surplus, arrotondato una volta sul mese - e lo fa surplusDelMese di
// extraRaccoltaCalc.js, la stessa funzione dei totali della pagina. Le righe
// degli interventi restano quelle di prima (il loro totale e' lo standard),
// le tonnellate del surplus non si sommano a nessun totale di tonnellate, e il
// totale in euro del blocco comprende il surplus: e' quello che si paga.
//
// LE SECONDARIE SONO TRASPORTI DI SECONDARIA (decisione dell'utente del
// 13/10/2026): «le eventuali secondarie di extra raccolta saranno trattate come
// normali trasporti di secondaria con il loro €\t oppure €\viaggio a seconda del
// tragitto e dei contratti». E' l'eccezione alla regola dei prezzi scritti: il
// trasporto di una secondaria la passiva lo paga con la tariffa della tratta nel
// contratto del vettore, e il prezzo scritto sull'intervento vale solo senza
// contratto (trasportoIntervento di extraRaccoltaCalc.js). Qui la colonna
// TRASPORTO porta quello che si paga per il viaggio - un intervento e' un
// viaggio, quindi a tonnellata e' t x €/t - e la nota dice da dove viene; la
// raccolta di una secondaria e' zero, perche' un trasferimento non e' una
// raccolta. Cosi' la formula della riga nel foglio (=ROUND per costo + viaggio
// + oneri) rifa' l'importo della passiva. Il contesto deve portare i contratti
// dei trasporti (il quinto argomento di contestoPrezzi): senza, una secondaria
// resta col prezzo scritto e la nota dice che il contratto non e' stato letto.
//
// LO STESSO VIAGGIO SI PAGA UNA VOLTA (revisione del 14/10/2026): a viaggio, le
// secondarie dello stesso camion, giorno, tratta e vettore pagano il viaggio una
// volta, diviso per peso, come in passiva. Il blocco raggruppa i viaggi dagli
// interventi del mese che ha gia' (conViaggi): la colonna TRASPORTO di ognuno
// porta la sua quota e la nota dice con chi divide il viaggio.

import { giornoRoma } from '@/lib/giornoItaliano';
import { calcExtraRaccolta, avvisoPesoMancante, surplusDelMese, conViaggi } from '@/lib/extraRaccoltaCalc';
import { cifreItaliane } from '@/lib/formatoSoldi';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const n2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const n3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
const testo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const chiave = (v) => testo(v).toLowerCase();
/** Un importo come si scrive in una nota: 1.234,00 €. */
const euroIt = (v) => `${(Number(v) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

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
 * Torna { righe, totale_kg, totale_t, totale_standard, surplus, surplus_interni,
 * totale_surplus, totale_euro, senza_costi, senza_peso, senza_data }.
 * `senza_costi` sono gli interventi chiusi su cui nessun costo e' stato scritto:
 * la passiva non pagherebbe niente, e un intervento gratis e' quasi sempre una
 * dimenticanza. Si dicono, non si inventano i prezzi.
 *
 * `contesto` (13/10/2026) e' quello di contestoPrezzi(tariffe, fornitori,
 * surplus, subfornitori) di extraRaccoltaCalc.js, con i record di SurplusTariffa
 * letti tutti, l'anagrafica intera dei fornitori e il modulo
 * src/lib/subfornitori.js: senza, il blocco e' quello di prima (nessuna riga di
 * surplus, totale_euro uguale allo standard). Con un surplus nel mese:
 * - `surplus`: una riga per fornitore e per surplus, [{ fornitore, nome, origine,
 *   prestazione, euro_t, kg, tonnellate, importo, dal, al, etichetta, note }];
 * - `surplus_interni`: i chili di un fornitore interno, che il surplus non lo
 *   riceve (SMOCO), per dirlo nelle note;
 * - `totale_standard` la somma delle righe degli interventi, `totale_surplus`
 *   quella delle righe del surplus, `totale_euro` le due insieme;
 * - `totale_kg` e `totale_t` restano le tonnellate degli interventi.
 */
export function bloccoExtraRaccolta(interventi, anno, mese, contesto = null) {
  const { dentro, senza_data } = interventiDelMese(interventi, anno, mese);
  // I viaggi delle secondarie del mese, come li raggruppa la passiva: senza
  // contesto i numeri restano quelli di prima (nessun contratto dei trasporti).
  const ctx = conViaggi(contesto || undefined, dentro);
  const righe = dentro.map(r => {
    const c = calcExtraRaccolta(r, ctx);
    const secondaria = chiave(r.tipo_movimento) === 'secondaria';
    // una secondaria non e' una raccolta (13/10/2026): il suo costo di raccolta
    // e' zero, come in passiva, anche se sull'intervento ce n'e' uno scritto
    const raccoltaScritta = Number(r.costo_raccolta_t) || 0;
    const raccolta = secondaria ? 0 : raccoltaScritta;
    const stoccaggio = Number(r.costo_stoccaggio_t) || 0;
    const trattamento = Number(r.costo_trattamento_t) || 0;
    // LA COLONNA SOVRACOSTO del foglio dell'amministrazione: tutti gli importi
    // fissi che si pagano su questo intervento. Due hanno un padrone - il
    // raccoglitore e l'impianto, come ha precisato l'utente il 03/10/2026 - e la
    // passiva li fattura a loro; la pulizia e i costi aggiuntivi, scritti sugli
    // interventi di prima, un padrone non ce l'hanno e restano dichiarati.
    // Nel foglio stanno in una colonna sola, com'e' nel loro file, e la nota dice
    // a chi vanno: su una fattura serve sapere chi incassa quel sovracosto.
    const sovraRaccoglitore = n2(Number(r.sovracosto_pagato_raccoglitore || 0));
    const sovraImpianto = n2(Number(r.sovracosto_pagato_impianto || 0));
    const senzaPadrone = n2(Number(r.costo_pulizia || 0) + Number(r.costi_aggiuntivi || 0));
    const oneri = n2(sovraRaccoglitore + sovraImpianto + senzaPadrone);
    // Il trasporto si paga A VIAGGIO: e' un importo fisso, non un prezzo a
    // tonnellata. Nel foglio dell'amministrazione e' la colonna «PREZZO
    // (Euro/viaggio)», che fino al 03/10/2026 nel gestionale non aveva un campo.
    // Per una secondaria (13/10/2026) e' quello che il contratto della tratta fa
    // pagare per questo viaggio, anche quando la tariffa e' a tonnellata.
    const tr = c.trasporto;
    const trasporto = n2(tr.importo);
    const notaTrasporto = !secondaria ? ''
      : tr.interno ? ''
        : tr.origine === 'contratto'
          ? `trasporto dal contratto di ${tr.fornitore} per la tratta ${testo(r.stoccaggio) || '—'} → ${testo(r.destinazione) || '—'}: ${cifreItaliane(tr.valore, 2, 4)} ${tr.unita_misura}${tr.unita_misura === '€/viaggio' ? '' : `, ${euroIt(tr.importo)} per il viaggio`}${tr.viaggio ? `; stesso viaggio di ${tr.viaggio.altri.join(', ')} (${tr.viaggio.targa ? `camion ${tr.viaggio.targa}` : 'senza targa'}, ${String(tr.viaggio.giorno || '').split('-').reverse().join('/')}): il viaggio si paga una volta, diviso per peso, qui ${cifreItaliane(tr.viaggio.kg / 1000, 2, 3)} t delle ${cifreItaliane(tr.viaggio.kg_viaggio / 1000, 2, 3)}: ${euroIt(tr.importo)}` : ''}${tr.scritto > 0 ? `; i ${euroIt(tr.scritto)} scritti sull'intervento non si pagano` : ''}`
          : tr.non_letto ? "contratto della tratta non letto: trasporto col prezzo scritto sull'intervento"
            : tr.origine === 'intervento' ? "tratta senza contratto: trasporto col prezzo scritto sull'intervento" : '';
    return {
      numero_fir: testo(r.numero_fir) || '—',
      ordine: testo(r.id_ordine) || testo(r.numero_ordine_interno) || '—',
      produttore: produttoreDi(r),
      trasportatore: testo(r.trasportatore) || '—',
      destinatario: testo(r.destinazione) || '—',
      inizio: giornoRoma(r.trasporto_iniziato_il) || '',
      fine: giornoRoma(r.trasporto_finito_il) || '',
      cer: testo(r.cer) || '',
      kg: c.senza_peso ? null : Math.round(c.kg),
      tonnellate: n3(c.tonnellate),
      senza_peso: c.senza_peso,
      raccolta_t: raccolta,
      stoccaggio_t: stoccaggio,
      trattamento_t: trattamento,
      trasporto_viaggio: trasporto,
      oneri,
      sovracosto_raccoglitore: sovraRaccoglitore,
      sovracosto_impianto: sovraImpianto,
      sovracosto_senza_padrone: senzaPadrone,
      // Il totale e' quello del modulo, non un conto rifatto qui: lo standard
      // dell'intervento, perche' il surplus ha la sua riga in fondo al blocco.
      totale: n2(c.costo_standard),
      secondaria,
      note: [
        // A chi va il sovracosto, prima di tutto il resto: e' la cosa che serve
        // a chi deve fatturarlo.
        c.senza_peso ? "PESO EFFETTIVO MANCANTE: i costi a tonnellata valgono zero finché non si scrive sull'intervento" : '',
        notaTrasporto,
        secondaria && raccoltaScritta ? `i ${cifreItaliane(raccoltaScritta, 2, 4)} €/t di raccolta scritti sull'intervento non si pagano: una secondaria non è una raccolta` : '',
        sovraRaccoglitore ? `sovracosto ${euroIt(sovraRaccoglitore)} al ${secondaria ? 'trasportatore' : 'raccoglitore'}` : '',
        sovraImpianto ? `sovracosto ${euroIt(sovraImpianto)} all'impianto` : '',
        senzaPadrone ? `${euroIt(senzaPadrone)} di pulizia e costi aggiuntivi, che non si fatturano a nessuno` : '',
        testo(r.note_costi),
        testo(r.tipologia_trasporto),
      ].filter(Boolean).join(' · '),
      senza_costi: raccolta === 0 && stoccaggio === 0 && trattamento === 0 && oneri === 0 && trasporto === 0,
    };
  });
  // Le righe del surplus: una per fornitore e per surplus, col centesimo del mese.
  const conto = surplusDelMese(dentro, ctx);
  const surplus = conto.passivo.map(v => {
    const chi = [v.origine, v.dal && v.al ? `dal ${v.dal.split('-').reverse().join('/')} al ${v.al.split('-').reverse().join('/')}` : ''].filter(Boolean).join(', ');
    return {
      fornitore: v.fornitore,
      surplus_id: v.surplus_id,
      nome: v.nome,
      origine: v.origine,
      riferimento: v.riferimento,
      prestazione: v.prestazione,
      euro_t: v.euro_t,
      kg: Math.round(v.kg),
      tonnellate: n3(v.kg / 1000),
      importo: v.importo,
      dal: v.dal,
      al: v.al,
      etichetta: v.etichetta,
      interventi: v.interventi,
      note: `${chi ? `${chi}: ` : ''}sulle stesse tonnellate ${v.interventi === 1 ? "dell'intervento" : `dei ${v.interventi} interventi`} del mese, già nelle righe qui sopra`,
    };
  });
  const surplusInterni = conto.interni.map(v => ({
    fornitore: v.fornitore, nome: v.nome, kg: Math.round(v.kg), tonnellate: n3(v.kg / 1000),
    nota: `${v.nome}: ${v.fornitore} è interno, sulle sue ${cifreItaliane(v.kg / 1000, 2, 3)} t non si paga`,
  }));
  const totaleStandard = n2(righe.reduce((s, r) => s + r.totale, 0));
  const totaleSurplus = n2(surplus.reduce((s, v) => s + v.importo, 0));
  return {
    righe,
    totale_kg: righe.reduce((s, r) => s + (r.kg || 0), 0),
    totale_t: n3(righe.reduce((s, r) => s + r.tonnellate, 0)),
    totale_standard: totaleStandard,
    surplus,
    surplus_interni: surplusInterni,
    totale_surplus: totaleSurplus,
    // quello che si paga: gli interventi e il surplus
    totale_euro: n2(totaleStandard + totaleSurplus),
    senza_costi: righe.filter(r => r.senza_costi && r.kg > 0),
    // I terminati del mese senza peso effettivo: nel foglio ci sono, senza chili,
    // e qui si elencano con la frase che dicono anche fattura e pagina.
    senza_peso: dentro.filter(r => calcExtraRaccolta(r).senza_peso).map(r => ({
      numero_fir: testo(r.numero_fir) || '—',
      ordine: testo(r.id_ordine) || '—',
      produttore: produttoreDi(r),
      kg: null,
      avviso: avvisoPesoMancante(r),
    })),
    // I terminati senza fine trasporto: non stanno in nessun mese, e vanno
    // sistemati prima di fatturare.
    senza_data: senza_data.map(r => ({
      numero_fir: testo(r.numero_fir) || '—',
      ordine: testo(r.id_ordine) || '—',
      produttore: produttoreDi(r),
      kg: Number(r.peso_effettivo) > 0 ? Math.round(Number(r.peso_effettivo)) : null,
    })),
  };
}

// Le intestazioni e le larghezze delle colonne non stanno qui: sono
// impaginazione, e ogni formato (Excel e PDF) ha le sue. Qui ci sono solo i dati.
