// LE RIGHE DEL QUADRO DELLA COMMESSA (migliorie dell'11/10/2026): le cifre, i
// mesi e le regioni della rete come le mostrano le sezioni e come le scrive il
// PDF. Stanno qui, in un file senza componenti, perche' pagina e PDF dicano le
// stesse parole e gli stessi numeri, e perche' la prova li legga senza
// impacchettare i grafici (prove/dashboardPagina.mjs).
import { t, tSegno, pct, intero, giorno, giornoMese, avantiIndietro, segnoScarto, coloreScarto, qualificatoriTarget, MESI_BREVI } from '@/components/dashboard/formato';

export const senzaTarget = (rete) => !rete || rete.target_t === null || rete.target_t === undefined;

// LE VARIAZIONI DEL CONSORZIO A PAROLE (giro del 14/10/2026). Il quadro porta
// quelle che il contratto comprende (quadro.rete.variazioni, quadroCommessa.ts):
// target, mesi, regioni e atteso le hanno gia' dentro, e la sezione diceva solo
// 11.650 t. All'utente, il 14/10: «come variano gli altri moduli e sezioni di
// conseguenza considerando che il target è passato a 11.650 t nell'anno 2026?».
const variazioniDi = (rete) => (senzaTarget(rete) ? [] : (rete.variazioni || []).filter(v => v && Number.isFinite(Number(v.t))));
const sommaVariazioni = (vv) => Math.round(vv.reduce((s, v) => s + Number(v.t), 0) * 1000) / 1000;
const voceVariazione = (v) => {
  const perche = [String(v.motivo || '').trim(), v.comunicata_il ? `comunicata il ${giorno(v.comunicata_il)}` : ''].filter(Boolean).join(', ');
  return `${String(v.mese || '').toLowerCase()}, ${v.regione} ${tSegno(v.t)}${perche ? ` (${perche})` : ''}`;
};

/**
 * La frase del perche' del target: «Il contratto 2026 comprende una variazione
 * del consorzio: ottobre, Puglia +100,00 t (assegnazione del consorzio di
 * ottobre, comunicata il 14/10/2026). Senza, il target sarebbe 11.550,00 t. [...]».
 * Stringa vuota se il contratto non ne comprende: allora niente cambia.
 */
export function fraseVariazioni(rete, anno = null) {
  const vv = variazioniDi(rete);
  if (!vv.length) return '';
  const somma = sommaVariazioni(vv);
  const contratto = anno ? `Il contratto ${anno}` : 'Il contratto';
  const testa = vv.length === 1
    ? `${contratto} comprende una variazione del consorzio: `
    : `${contratto} comprende ${vv.length} variazioni del consorzio, in tutto ${tSegno(somma)}: `;
  return `${testa}${vv.map(voceVariazione).join('; ')}. Senza, il target sarebbe ${t(Number(rete.target_t) - somma)}. Nell'atteso ${vv.length === 1 ? 'conta intera' : 'ognuna conta intera'} nel suo mese e nella sua regione: le altre regioni non cambiano. Si registrano nella scheda Commessa Ecotyre di Target & Status.`;
}

/** La riga breve sotto il target: «compresa la variazione del consorzio di ottobre in Puglia (+100,00 t)». */
export function sottoVariazioni(rete) {
  const vv = variazioniDi(rete);
  if (!vv.length) return '';
  if (vv.length === 1) return `compresa la variazione del consorzio di ${String(vv[0].mese || '').toLowerCase()} in ${vv[0].regione} (${tSegno(vv[0].t)})`;
  return `comprese ${vv.length} variazioni del consorzio (${tSegno(sommaVariazioni(vv))})`;
}

/** Le cifre della rete, con il perche' dove serve. Esportate per la prova e per il PDF. */
export function cifreRete(rete, { annoInCorso } = {}) {
  if (!rete) return [];
  const a = rete.atteso;
  const q = qualificatoriTarget(rete);
  const residuo = rete.residuo_t;
  const manca = (v) => v === null || v === undefined;
  // Le variazioni del consorzio: sotto il numero in breve (va anche nel PDF), nel
  // perche' a parole intere (giro del 14/10/2026). Senza variazioni, come prima.
  const sv = sottoVariazioni(rete);
  const cifre = [
    {
      etichetta: 'Target annuo del contratto', valore: t(rete.target_t),
      sotto: [q || 'il contratto Ecotyre in Target & Status', sv].filter(Boolean).join(', '),
      ...(sv ? { perche: fraseVariazioni(rete) } : {}),
    },
    { etichetta: 'Raccolto', valore: t(rete.raccolto_t), sotto: `${intero(rete.ritiri)} ${rete.ritiri === 1 ? 'ritiro' : 'ritiri'} (ordini distinti)` },
    { etichetta: 'Fatto dell\'anno', valore: senzaTarget(rete) ? '—' : pct(rete.pct_target), sotto: senzaTarget(rete) ? 'senza target non si misura' : 'del target annuo' },
    {
      etichetta: a ? `Atteso al ${giornoMese(a.giorno)}` : 'Atteso',
      valore: a ? t(a.atteso_t) : '—',
      sotto: a ? `${pct(a.pct_atteso)} del target, col profilo del contratto` : senzaTarget(rete) ? 'senza contratto non c\'è' : 'nessun ritiro dell\'anno ancora terminato',
    },
    { etichetta: 'Scarto sull\'atteso', valore: a ? `${segnoScarto(a.scarto_t)} ${avantiIndietro(a.scarto_t)}` : '—', tono: a ? coloreScarto(a.scarto_t) : '' },
    {
      etichetta: 'Residuo dell\'anno',
      valore: manca(residuo) ? '—' : residuo < 0 ? `target superato di ${t(-residuo)}` : t(residuo),
      sotto: manca(residuo) ? '' : 'quanto manca al target annuo',
    },
    {
      etichetta: rete.proiezione && rete.proiezione.finale ? 'Raccolto finale' : 'Proiezione a fine anno',
      valore: rete.proiezione ? t(rete.proiezione.t) : '—',
      sotto: rete.proiezione ? `${pct(rete.proiezione.pct_target)} del target` : rete.proiezione_perche,
      perche: rete.proiezione && !rete.proiezione.finale
        ? 'Se il resto dell\'anno va come finora rispetto al profilo del contratto: raccolto diviso la quota del profilo coperta dai dati. Si dà quando i dati coprono almeno gennaio e febbraio interi: prima, pochi giorni moltiplicati per l\'anno non vogliono dire niente.'
        : null,
    },
  ];
  if (annoInCorso) {
    cifre.push({
      etichetta: 'Ritmo che serve',
      valore: rete.ritmo ? `${t(rete.ritmo.servono_t_mese)} al mese` : '—',
      sotto: rete.ritmo
        ? `il ${pct(rete.ritmo.pct_ritmo)} del ritmo del contratto (${t(rete.ritmo.contratto_t_mese)} al mese)`
        : !manca(residuo) && residuo <= 0 ? 'il target è raggiunto' : 'si misura col target e coi dati dell\'anno',
      perche: rete.ritmo ? 'Quello che manca al target diviso i mesi che restano dopo il giorno dei dati, contro quello che il profilo del contratto prevede per gli stessi mesi.' : null,
    });
  }
  return cifre;
}

export function righeTesseraRete(rete) {
  if (!rete) return [];
  const q = qualificatoriTarget(rete);
  const senzaTarget = rete.target_t === null || rete.target_t === undefined;
  const riga1 = senzaTarget
    ? `${t(rete.raccolto_t)} raccolte · ${q}`
    : `${t(rete.raccolto_t)} su ${t(rete.target_t)}${q ? ` (${q})` : ''}`;
  const a = rete.atteso;
  const riga2 = a
    ? { testo: `atteso al ${giornoMese(a.giorno)}: ${pct(a.pct_atteso)} · ${segnoScarto(a.scarto_t)} ${avantiIndietro(a.scarto_t)}`, classe: `font-medium ${coloreScarto(a.scarto_t)}` }
    : senzaTarget ? null : { testo: 'atteso: —' };
  return [{ testo: riga1 }, riga2];
}

const aMeta = (m) => m.coperto > 0 && m.coperto < 1;

/** Le righe del grafico e della tabella, dai mesi del quadro. */
export function righeMesi(mesi) {
  let cumPrima = 0;
  return (mesi || []).map((m, i) => {
    const conTarget = m.target_t !== null && m.target_t !== undefined;
    // il target fino al giorno dei dati: l'atteso nel mese a meta', il mese intero negli altri
    const targetAlGiorno = !conTarget ? null : aMeta(m) ? m.atteso_t : m.target_t;
    const targetCum = !conTarget ? null : aMeta(m) ? cumPrima + (m.atteso_t || 0) : m.target_cum_t;
    if (conTarget) cumPrima = m.target_cum_t;
    const scarto = m.futuro || m.raccolto_t === null || targetAlGiorno === null ? null : m.raccolto_t - targetAlGiorno;
    return {
      nome: MESI_BREVI[i], mese: m.mese, aMeta: aMeta(m), futuro: m.futuro,
      target: targetAlGiorno, targetMese: conTarget ? m.target_t : null, budget: m.budget_t,
      raccolto: m.raccolto_t, scarto, targetCum, raccoltoCum: m.raccolto_cum_t,
    };
  });
}

/** Le righe della tabella, con la riga di chi e' fuori dal contratto e il totale (solo rete). */
export function righeRegioni(rete) {
  const righe = (rete?.regioni || []).map(r => ({ ...r }));
  const fuori = rete?.fuori_contratto;
  if (fuori && fuori.raccolto_t > 0) {
    righe.push({ regione: 'Fuori dalle regioni del contratto', fuori: true, target_t: null, atteso_t: null, raccolto_t: fuori.raccolto_t, scarto_t: null, pct_atteso: null, dettaglio: (fuori.regioni || []).map(r => r.regione).join(', ') });
  }
  return righe;
}
