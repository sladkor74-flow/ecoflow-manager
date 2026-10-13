// IL MESSAGGIO DOPO «ESEGUI» NEL MOTORE DEGLI ALERT (revisione del 13/10/2026).
//
// Dal 12/10/2026 (A54) il motore (runAlertEngine) controlla l'anno in corso e
// quello prima, ma la pagina scriveva solo «su N record del <anno> controllati»:
// vero, e muto sull'anno prima, che a gennaio pesa piu' di quello nuovo. Ora il
// messaggio dice anche quanti record dell'anno prima sono serviti
// (record_per_anno) e a che cosa: tenere aggiornati e chiudere i suoi alert, e
// fino a febbraio aprirne di nuovi. Gli alert che il motore non controlla piu'
// restano aperti, e si dice quanti (alerts_anni_non_controllati): si chiudono a
// mano. I numeri hanno il punto delle migliaia (prima «3104»).
//
// LE REGOLE DI TRATTA SULL'ANNO PRIMA (revisione del 13/10/2026). Il messaggio
// diceva che l'anno prima apriva alert nuovi «(tranne le tratte)». Dal
// 13/10/2026 il motore applica all'anno prima le regole di tratta scritte prima
// del 01/01 (scrittaPrimaDellAnno in runAlertEngine): il viaggio del 30/12
// registrato il 04/01 ha il suo alert di tratta, e il messaggio diceva il
// contrario. Quelle create o cambiate quest'anno invece l'anno prima non lo
// misurano affatto: non aprono, non riscrivono e non chiudono. Per questo la
// riserva sta in fondo a tutto quello che l'anno prima fa, anche quando non
// apre alert nuovi: «(non con le regole di tratta create o cambiate nel
// <anno>)». E i loro alert rimasti aperti non sono «di un periodo non piu'
// controllato» (il 2026 a gennaio 2027 e' controllato: e' la regola che non lo
// misura). La risposta li conta insieme agli alert di un anno passato e a
// quelli delle province su mesi che la matrice non guarda piu', senza
// distinguerli: il messaggio dice quello che hanno in comune, cioe' che il
// gestionale non li controlla piu' da solo.
//
// Sta qui e non nella pagina perche' le prove la leggono in node
// (prove/alertEsecuzioneMessaggio.mjs): la pagina, caricata, chiede il browser.
import { formatNumber } from '@/lib/utils';

// Un conteggio all'italiana, col punto delle migliaia: «3.104».
const conteggio = (v) => formatNumber(Number(v) || 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const NOME_CANALE = { rete: 'rete', ACI: 'ACI', extra: 'extra raccolta' };

/** Il testo da mostrare con la risposta di runAlertEngine (d). */
export function messaggioEsecuzione(d) {
  // Restano da scrivere aggiornamenti o chiusure fermati dal tempo massimo:
  // si riprendono ripetendo il controllo.
  const restano = [
    d.alerts_da_aggiornare > 0 && `${conteggio(d.alerts_da_aggiornare)} alert da aggiornare`,
    d.alerts_da_chiudere > 0 && `${conteggio(d.alerts_da_chiudere)} alert da chiudere`,
  ].filter(Boolean);
  // I terminati senza fine trasporto restano fuori dal controllo: si dicono,
  // canale per canale (rete e ACI non si sommano).
  const senzaFine = (d.terminati_senza_fine_trasporto || []).filter(g => g.quanti > 0).map(g =>
    `${g.canale ? `${g.canale === 'ACI' ? 'ACI' : 'Rete'}: ` : ''}${g.quanti === 1 ? '1 terminato' : `${conteggio(g.quanti)} terminati`} senza fine trasporto${g.esempi?.length ? ` (es. ${g.esempi.join(', ')})` : ''}`);
  // Le date obbligatorie mancanti o incoerenti, canale per canale: l'elenco sta nell'alert.
  const date = (d.date_obbligatorie || []).filter(g => g.ordini > 0).map(g =>
    `${g.canale ? `${NOME_CANALE[g.canale] || g.canale}: ` : ''}${g.ordini === 1 ? '1 ordine' : `${conteggio(g.ordini)} ordini`}${g.senza_fine ? `, di cui ${conteggio(g.senza_fine)} senza fine trasporto` : ''}`);
  // Gli anni prima di quello in corso che il motore ha controllato, dal piu' recente.
  const perAnno = d.record_per_anno || {};
  const nuovi = new Set((d.anni_alert_nuovi || []).map(Number));
  const anniPrima = Object.keys(perAnno).map(Number).filter(a => Number.isFinite(a) && a !== Number(d.anno)).sort((x, y) => y - x);
  // Le regole di tratta create o cambiate nell'anno in corso non misurano l'anno prima.
  const tratte = ` (non con le regole di tratta create o cambiate ${d.anno ? `nel ${d.anno}` : "quest'anno"})`;
  const prima = anniPrima.map(a => `${conteggio(perAnno[a])} del ${a} per tenere aggiornati e chiudere i suoi alert`
    + (nuovi.has(a) ? ' e, fino a febbraio, per aprirne di nuovi' : '') + tratte);
  const fuori = Number(d.alerts_anni_non_controllati) || 0;
  return `${conteggio(d.alerts_creati)} alert creati, ${conteggio(d.alerts_aggiornati)} aggiornati e ${conteggio(d.alerts_chiusi)} chiusi perché superati o doppi, su ${conteggio(d.record_scansionati)} record ${d.anno ? `del ${d.anno} ` : ''}controllati`
    + (prima.length ? `, e ${prima.join(', e ')}` : '') + '.'
    + (fuori ? (fuori === 1
      ? ' 1 alert che il gestionale non controlla più da solo resta aperto: si chiude a mano.'
      : ` ${conteggio(fuori)} alert che il gestionale non controlla più da solo restano aperti: si chiudono a mano.`) : '')
    + (restano.length ? ` Restano ${restano.join(' e ')}: esegui di nuovo il controllo.` : '')
    + (senzaFine.length ? ` Esclusi dalle regole dell'anno perché senza fine trasporto, di qualunque anno: ${senzaFine.join('; ')}.` : '')
    + (date.length ? ` Terminati con date obbligatorie mancanti o incoerenti, di qualunque anno: ${date.join('; ')}. L'elenco è nell'alert; le date vanno inserite o corrette.` : '');
}
