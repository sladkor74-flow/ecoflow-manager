// Il margine della commessa: ricavo (fatturazione attiva) meno costo
// (fatturazione passiva), mese per mese e canale per canale.
//
// Non ha regole sue: il ricavo sono le righe di attivaCalcolo.ts, il costo e'
// calcolaPassivaMese di passivaCalcolo.ts, cioe' gli stessi numeri, al centesimo,
// che si vedono nelle due fatturazioni. Rete, ACI ed extra raccolta sono tre
// commesse: tre margini, mai un totale che li somma.
//
// Avvertenza di lettura: il costo di un mese comprende stoccaggio, trattamento e
// trasporto delle secondarie di QUEL mese, che possono riguardare tonnellate
// raccolte prima. Il margine del singolo mese oscilla per questo; quello
// dell'anno e' il numero che conta.
//
// Un viaggio di secondaria che porta rete e ACI insieme, a prezzo per viaggio,
// pesa su tutti e due i margini, ciascuno per la sua quota dei chili (regola
// dell'utente del 22/09/2026, quoteViaggioMisto in passivaCalcolo.ts): prima
// pesava tutto sulla rete.
//
// Un terminato senza fine trasporto non entra in nessun mese, quindi nemmeno nel
// margine: si dice per canale, una volta per l'anno (senza_fine_trasporto), e
// non fra le anomalie di ogni mese, dove lo stesso ordine si conterebbe dodici
// volte. Sono quelli che la passiva segnala in almeno un mese dell'anno, compresi
// gli immessi a fine dell'anno prima (anomaliaSenzaFineAnno).
import { calcolaRigheAttiva, eRigaACorpo, TIPOLOGIE_ATTIVA } from "./attivaCalcolo.ts";
import { calcolaPassivaMese, movimentiDateDelCanale } from "./passivaCalcolo.ts";
import { anomaliaSenzaFineAnno } from "./filtroPeriodo.ts";

export const MESI_MARGINE = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const r3 = (v) => Math.round((v + Number.EPSILON) * 1000) / 1000;

function chiudi(x) {
  const margine = r2(x.ricavo - x.costo);
  return {
    ...x,
    tonnellate: r3(x.tonnellate), ricavo: r2(x.ricavo), costo: r2(x.costo),
    costo_raccolta: r2(x.costo_raccolta), costo_impianti: r2(x.costo_impianti), costo_trasporti: r2(x.costo_trasporti),
    margine,
    margine_pct: x.ricavo ? Math.round((margine / x.ricavo) * 1000) / 10 : null,
    ricavo_t: x.tonnellate ? r2(x.ricavo / x.tonnellate) : null,
    costo_t: x.tonnellate ? r2(x.costo / x.tonnellate) : null,
    margine_t: x.tonnellate ? r2(margine / x.tonnellate) : null,
  };
}

/**
 * dati: { reteAll, aciAll, extraAll, secondarieAll, fornitori, tariffe } letti una volta sola.
 * finoAlMese: indice 0-11 dell'ultimo mese da calcolare.
 */
export function calcolaMargineAnno(dati, anno, finoAlMese = 11) {
  const annoNum = Number(anno);
  const tariffeAttive = (dati.tariffe || []).filter(t => t.direzione === 'ATTIVA');
  const passiva = {
    primarieRete: dati.reteAll, primarieAci: dati.aciAll, secondarieAll: dati.secondarieAll, extraRaccoltaAll: dati.extraAll,
    tariffeAll: (dati.tariffe || []).filter(t => t.direzione === 'PASSIVA'),
    fornitoriAll: (dati.fornitori || []).filter(f => f.stato === 'attivo'),
  };
  const canali = Object.fromEntries(TIPOLOGIE_ATTIVA.map(c => [c, { canale: c, mesi: [], senza_fine_trasporto: null }]));

  for (let m = 0; m <= Math.min(11, finoAlMese); m++) {
    const mese = MESI_MARGINE[m];
    const attiva = calcolaRigheAttiva({ reteAll: dati.reteAll, aciAll: dati.aciAll, extraAll: dati.extraAll, fornitori: dati.fornitori, tariffe: tariffeAttive, anno: annoNum, mese });
    for (const canale of TIPOLOGIE_ATTIVA) {
      const righe = attiva.righe[canale];
      const costo = calcolaPassivaMese(passiva, annoNum, m, mese, canale);
      canali[canale].mesi.push(chiudi({
        mese,
        tonnellate: righe.filter(r => !eRigaACorpo(r)).reduce((s, r) => s + r.quantita, 0) / 1000,
        ordini: righe.filter(r => !eRigaACorpo(r)).length,
        ricavo: righe.reduce((s, r) => s + r.totale, 0),
        costo: costo.totali.totale_complessivo,
        costo_raccolta: costo.totali.raccoglitori,
        costo_impianti: costo.totali.impianti_stoccaggi,
        costo_trasporti: costo.totali.trasporti_secondaria,
        // un ricavo o un costo calcolato con un prezzo mancante e' un margine falso: si dice
        righe_senza_prezzo: righe.filter(r => r.stato_validazione === 'errore').length,
        // senza i terminati senza fine trasporto, che si dicono una volta per l'anno
        anomalie_passiva: (costo.anomalie || []).filter(a => a.tipo !== 'date_senza_fine').length,
      }));
    }
  }

  // I terminati senza fine trasporto dell'anno fin qui, ciascuno una volta: gli
  // stessi ordini che la passiva segnala mese per mese, primarie e secondarie del
  // canale (il suo elenco comprende quello dell'attiva). Prima si prendevano
  // quelli dell'ultimo mese calcolato, che bastava finche' un senza fine si
  // segnalava solo nell'anno di immissione. Dal 22/09/2026 un ordine immesso a
  // dicembre dell'anno prima si segnala solo nei primi mesi, e l'ultimo mese
  // calcolato (per esempio settembre) non lo vedrebbe.
  for (const canale of TIPOLOGIE_ATTIVA) {
    const s = anomaliaSenzaFineAnno(movimentiDateDelCanale(passiva, canale), annoNum, Math.min(11, finoAlMese), canale);
    canali[canale].senza_fine_trasporto = s ? { quanti: s.quanti, tonnellate: r3(s.kg / 1000), descrizione: s.descrizione } : null;
  }

  for (const canale of TIPOLOGIE_ATTIVA) {
    const somma = (campo) => canali[canale].mesi.reduce((s, x) => s + (x[campo] || 0), 0);
    canali[canale].anno = chiudi({
      mese: 'Anno',
      tonnellate: somma('tonnellate'), ordini: somma('ordini'), ricavo: somma('ricavo'), costo: somma('costo'),
      costo_raccolta: somma('costo_raccolta'), costo_impianti: somma('costo_impianti'), costo_trasporti: somma('costo_trasporti'),
      righe_senza_prezzo: somma('righe_senza_prezzo'), anomalie_passiva: somma('anomalie_passiva'),
    });
  }
  return { anno: annoNum, canali: TIPOLOGIE_ATTIVA.map(c => canali[c]) };
}
