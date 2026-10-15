// IL RIEPILOGO DELLA SETTIMANA PER LA DIREZIONE, IN PDF (14/10/2026).
//
// Fra le cose da creare che l'utente ha approvato il 14/10/2026 («per me ok
// sulle cose da sistemare, sulla velocità e su quanto da creare, procedi pure»):
// «un riepilogo settimanale per la direzione, il lunedi', in PDF o per email:
// target e scarti per regione, alert critici, dichiarazioni da fare, fatture
// del mese». Qui gli argomenti di esportaSezioniPdf (src/lib/esportaTabella.js,
// il corredo comune dei documenti che escono: fascia SMOCO, riquadri,
// intestazioni ripetute, «Generato il ... da ...», «Pagina x di N»). Il pulsante
// sta nella dashboard (src/components/dashboard/RiepilogoSettimanale.jsx) e
// questo modulo, con jspdf, si scarica solo al clic.
//
// LE REGOLE DEL PDF:
// - I numeri sono quelli che la dashboard ha gia' letto: il quadro dell'anno
//   (getDashboardRaccolta), il cruscotto (cruscottoOperativo) e, per
//   l'amministratore, il margine (calcolaMargine). Le parole e le cifre della
//   rete sono quelle della pagina (righeQuadro.js e formato.js): il PDF e la
//   dashboard dicono lo stesso numero con la stessa scrittura. L'unica lettura
//   in piu' e' il raccolto della settimana (funzione riepilogoSettimana), al clic.
// - La settimana e' da lunedi' a domenica sul giorno italiano di fine
//   trasporto, mai la chiusura a portale. Un giorno che i dati non coprono
//   ancora (dopo il giorno dei dati, o dopo oggi) e' «—», non zero.
// - Rete, ACI ed extra raccolta hanno ciascuno le sue tabelle: nessuna riga,
//   colonna o riquadro li somma.
// - Una parte che non si e' potuta leggere lo dice nella sua sezione, col
//   perche': mai uno zero al posto di un numero che non c'e'.
// - Costi e margine solo nella copia dell'amministratore: a chi non lo e' la
//   sezione non c'e' e le voci del margine non entrano, anche se arrivassero.
// - Niente email: il PDF si scarica e lo manda chi lo ha fatto.
// - Ogni testo e' scritto coi caratteri che il PDF ha (perIlPdf) e nessuna
//   cella perde la coda oltre le tre righe (sezionePerIlPdf): revisione del
//   15/10/2026.
import { t, tSegno, pct, intero, giorno, giornoMese, NOMI_CANALE } from '@/components/dashboard/formato';
import { cifreRete, righeMesi, righeRegioni, fraseVariazioni, senzaTarget } from '@/components/dashboard/righeQuadro';

const CANALI = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const vuoto = (v) => v === null || v === undefined || v === '' || !Number.isFinite(Number(v));
// Nelle tabelle il PDF scrive i numeri col formato della colonna; un valore che manca e' «—».
const n = (v) => (vuoto(v) ? '—' : Number(v));
const r3 = (v) => Math.round(Number(v) * 1000) / 1000;
const minuscolo = (s) => String(s || '').toLowerCase();

/** «al 05/10/2026», ma «all'08/10/2026» e «all'11/10/2026»: si legge «otto», «undici». */
export const alGiorno = (g) => (/^(08|11)$/.test(String(g || '').slice(8, 10)) ? `all'${giorno(g)}` : `al ${giorno(g)}`);
/** «dal 05/10/2026», ma «dall'08/10/2026». */
export const dalGiorno = (g) => (/^(08|11)$/.test(String(g || '').slice(8, 10)) ? `dall'${giorno(g)}` : `dal ${giorno(g)}`);

// ─── I CARATTERI CHE IL PDF SA SCRIVERE (revisione del 15/10/2026) ───
// I caratteri standard del PDF (Helvetica) hanno la codifica WinAnsi: l'ASCII,
// le lettere accentate del Latin-1 e pochi segni (€ « » – — ’ •). Una stringa
// con un solo carattere fuori, jspdf la scrive tutta in due byte per lettera e
// la cella esce illeggibile: era il meno tipografico (U+2212) di tSegno, in
// «Non quadra: … −37,773 t» e nelle variazioni del consorzio «in meno» («(−100,00 t)»).
// Ogni testo del riepilogo passa da qui: il meno diventa il trattino, come nei
// numeri dei PDF; i segni che il corredo comune cambia gia' (frecce, «…», ≤ ≥)
// si cambiano allo stesso modo, perche' la riga si misuri com'e' scritta; una
// lettera che la codifica non ha perde l'accento (ș -> s), e un segno che resta
// fuori diventa «?», non la cella intera.
const WIN_ANSI_ALTI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const scrivibile = (c) => { const k = c.charCodeAt(0); return c.length === 1 && ((k >= 0x20 && k <= 0x7e) || (k >= 0xa0 && k <= 0xff) || WIN_ANSI_ALTI.includes(c)); };
const SIMILI = { 'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D', 'ı': 'i', 'ħ': 'h', 'Ħ': 'H' };
export function perIlPdf(testo) {
  return String(testo ?? '')
    .replace(/[\u2212\u2010-\u2012]/g, '-')
    .replace(/[▲▼]\s*/g, '')
    .replace(/[→➜➔]/g, '>').replace(/←/g, '<').replace(/…/g, '...').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/⋮/g, ':')
    .replace(/[\t\r\n\u2028\u2029\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[^\x20-\x7e]/gu, (c) => {
      if (scrivibile(c)) return c;
      const base = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (base && [...base].every(scrivibile)) return base;
      return SIMILI[c] || '?';
    });
}

// ─── NESSUNA CELLA PERDE LA CODA (revisione del 15/10/2026) ───
// esportaSezioniPdf tiene di una cella le prime tre righe e lascia cadere il
// resto senza un segno. Prima si spezzavano a 200 caratteri solo il dettaglio di
// «Da gestire» e l'elenco degli ID: il titolo di una voce lunga (la prefattura
// coi dodici mesi dell'anno prima, a gennaio) e «Caricati dopo la notte» coi
// cinque archivi del lunedi' mattina perdevano la coda, mentre la dashboard li
// scrive interi. Ora ogni cella di testo si misura con le larghezze dei
// caratteri del PDF e, se va oltre tre righe, continua nelle righe sotto della
// stessa tabella. Le larghezze sono quelle di jspdf (millesimi di em), il
// maggiore fra il tondo e il grassetto: la stima non va mai sotto il vero, e
// la prova (prove/riepilogoSettimanale.mjs) la confronta col jspdf vero.
const PAGINA_UTILE_MM = 297 - 2 * 10; // A4 orizzontale meno i margini di esportaSezioniPdf
const CORPO_CELLA_PT = 7.4;
const MM_PER_PT = 25.4 / 72;
const RIGHE_PER_CELLA = 3;
const LARGHEZZE_ASCII = '28,33,47,55,55,89,72,24,33,33,39,58,28,33,28,28,55,55,55,55,55,55,55,55,55,55,33,33,58,58,58,61,101,72,72,72,72,66,61,78,72,28,55,72,61,83,72,78,66,78,72,66,61,72,66,94,66,66,61,33,28,33,58,55,33,55,61,55,61,55,33,61,61,28,28,55,28,89,61,61,61,61,39,55,33,61,55,78,55,55,50,39,28,39,58'.split(',').map(x => Number(x) * 10);
const LARGHEZZE_ALTRE = { '—': 1000, '–': 550, '«': 550, '»': 550, '·': 280, '€': 560, '’': 280, '‘': 280, '“': 500, '”': 500, '•': 350, '°': 400, '×': 560 };
const larghezzaCarattere = (c) => {
  const k = c.charCodeAt(0);
  if (k >= 32 && k <= 126) return LARGHEZZE_ASCII[k - 32];
  if (LARGHEZZE_ALTRE[c]) return LARGHEZZE_ALTRE[c];
  const base = c.normalize('NFD')[0];
  const kb = base.charCodeAt(0);
  return base !== c && kb >= 32 && kb <= 126 ? LARGHEZZE_ASCII[kb - 32] : 1010;
};
const larghezzaMm = (s) => { let somma = 0; for (const c of s) somma += larghezzaCarattere(c); return (somma * CORPO_CELLA_PT * MM_PER_PT) / 1000; };

/**
 * Le righe in cui il PDF manda a capo `testo` in una colonna larga `larghezza`
 * mm (gia' tolti i 3 mm di margine della cella), stimate per eccesso: a capo fra
 * due parole, e a lettere una parola piu' larga della colonna, come jspdf.
 * -> [{ testo, aMeta }] (aMeta: la riga dopo continua la stessa parola)
 */
export function righeDelTesto(testo, larghezza) {
  const max = larghezza * 0.98;
  const righe = [];
  let riga = null, larga = 0;
  const spazio = larghezzaMm(' ');
  for (const parola of String(testo).split(' ')) {
    const lp = larghezzaMm(parola);
    if (riga !== null && larga + spazio + lp <= max) { riga += ` ${parola}`; larga += spazio + lp; continue; }
    if (riga === null && lp <= max) { riga = parola; larga = lp; continue; }
    if (riga !== null) righe.push({ testo: riga, aMeta: false });
    let resto = parola;
    while (larghezzaMm(resto) > max) {
      let k = 1;
      while (k < resto.length - 1 && larghezzaMm(resto.slice(0, k + 1)) <= max) k++;
      righe.push({ testo: resto.slice(0, k), aMeta: true });
      resto = resto.slice(k);
    }
    riga = resto; larga = larghezzaMm(resto);
  }
  righe.push({ testo: riga === null ? '' : riga, aMeta: false });
  return righe;
}

/** Un testo in pezzi di tre righe al massimo: uno per riga della tabella. */
export function pezziDellaCella(testo, larghezza) {
  const righe = righeDelTesto(testo, larghezza);
  const pezzi = [];
  for (let i = 0; i < righe.length; i += RIGHE_PER_CELLA) {
    pezzi.push(righe.slice(i, i + RIGHE_PER_CELLA).reduce((s, r, j, tutte) => s + r.testo + (j < tutte.length - 1 ? (r.aMeta ? '' : ' ') : ''), ''));
  }
  return pezzi;
}

/** Le colonne della sezione in mm, come le divide esportaSezioniPdf, meno i 3 mm della cella. */
const larghezzeColonne = (colonne) => {
  const totale = colonne.reduce((s, c) => s + (c.peso || 1), 0);
  return colonne.map(c => (PAGINA_UTILE_MM * (c.peso || 1)) / totale - 3);
};

/**
 * La sezione pronta per il PDF: testi scrivibili, e una riga con una cella
 * oltre le tre righe continua nelle righe sotto (le altre celle vuote, lo
 * stesso stile), invece di perdere la coda.
 */
function sezionePerIlPdf(s) {
  const colonne = s.colonne.map(c => ({ ...c, titolo: perIlPdf(c.titolo) }));
  const larghezze = larghezzeColonne(colonne);
  const righe = s.righe.flatMap(r => {
    const pezzi = r.celle.map((v, i) => (typeof v === 'string' && v ? pezziDellaCella(perIlPdf(v), larghezze[i]) : [v]));
    const quante = Math.max(1, ...pezzi.map(p => p.length));
    return Array.from({ length: quante }, (_, k) => ({ ...r, celle: pezzi.map(p => (k < p.length ? p[k] : '')) }));
  });
  return { ...s, titolo: perIlPdf(s.titolo), colonne, righe };
}

/** Una sezione che non ha potuto leggere i suoi numeri: una riga sola, che lo dice. */
const nonLetta = (titolo, testo) => ({ titolo, colonne: [{ titolo: 'Non disponibile', peso: 1 }], righe: [{ celle: [testo] }] });

const GRAVITA = { critico: 'Critica', attenzione: 'Attenzione', info: 'Da sapere' };

/**
 * Gli argomenti del PDF. settimana: quella di settimanaDaRiepilogare
 * (RiepilogoSettimanale.jsx); lettura: { dati, errore } della funzione
 * riepilogoSettimana; quadro, cruscotto, voci, mesiAttiva, notaAttiva,
 * annoInCorso, margine: quello che la dashboard ha a video, con gli errori delle
 * sue letture; utente: chi genera il file (per il piede); isAdmin: la copia
 * dell'amministratore, con costi e margine.
 * -> { nomeFile, titolo, sottotitolo, riepilogo, sezioni, note, titoloNote, documento }
 */
export function argomentiRiepilogoPdf({
  settimana, lettura = null, oggi = '',
  quadro = null, erroreQuadro = '', cruscotto = null, erroreCruscotto = '',
  voci = [], mesiAttiva = null, notaAttiva = '', annoInCorso = true,
  margine = null, erroreMargine = '', isAdmin = false, utente = '',
}) {
  if (!settimana || !settimana.dal) return null;
  const { dal, al } = settimana;
  const anno = quadro ? quadro.anno : Number(String(oggi || al).slice(0, 4));
  const giornoDati = quadro && quadro.giorno_dati ? quadro.giorno_dati : '';
  const sett = lettura && lettura.dati ? lettura.dati : null;
  const erroreSett = lettura && lettura.errore ? lettura.errore : (!sett ? 'la lettura non è arrivata' : '');
  const giorniSettimana = settimana.giorni || [];
  const aCavallo = dal.slice(0, 4) !== al.slice(0, 4);

  // I GIORNI CHE I DATI COPRONO. Rete e ACI arrivano con lo stesso file delle
  // primarie: fino al giorno dei dati della dashboard (l'ultima fine trasporto
  // della rete, mai oltre oggi). L'extra raccolta ha il suo modulo: fino a oggi.
  // Un giorno non coperto e' «—»: zero direbbe che non si e' raccolto niente.
  const coperto = (canale, g) => g <= oggi && (canale === 'EXTRA_RACCOLTA' || !giornoDati || g <= giornoDati);
  const settimanaIntera = (canale) => giorniSettimana.every(x => coperto(canale, x.giorno));
  const nessunGiorno = (canale) => !giorniSettimana.some(x => coperto(canale, x.giorno));
  const dati = { RETE: sett && sett.rete, ACI: sett && sett.aci, EXTRA_RACCOLTA: sett && sett.extra };
  const motivoCanale = (c) => (!sett ? erroreSett : dati[c] && dati[c].letto === false ? (dati[c].errore || 'l\'archivio non si è potuto leggere') : '');
  /** Il totale della settimana di un canale, o null se non si sa. */
  const totale = (c) => (motivoCanale(c) || nessunGiorno(c) || !dati[c] ? null : dati[c]);
  const delGiorno = (c, g) => {
    if (motivoCanale(c) || !dati[c] || !coperto(c, g)) return null;
    return (dati[c].giorni || []).find(x => x.giorno === g) || { giorno: g, t: 0, ritiri: 0 };
  };
  const finoA = (c) => {
    const ultimo = [...giorniSettimana].reverse().find(x => coperto(c, x.giorno));
    return ultimo ? ultimo.giorno : '';
  };
  const etichettaSettimana = (c) => (settimanaIntera(c) || nessunGiorno(c) ? 'Settimana' : `Settimana, fino ${alGiorno(finoA(c))}`);

  const sezioni = [];
  const note = [];
  const titoloRete = `Rete — la settimana ${dalGiorno(dal)} ${alGiorno(al)}`;

  // ─── RETE ───
  if (motivoCanale('RETE')) {
    sezioni.push(nonLetta(titoloRete, `Il raccolto della settimana non si è potuto leggere: ${motivoCanale('RETE')}. Gli altri numeri del riepilogo sono quelli della dashboard.`));
  } else {
    const tot = totale('RETE');
    sezioni.push({
      titolo: titoloRete,
      colonne: [{ titolo: 'Giorno', peso: 2.2 }, { titolo: 'Raccolto (t)', tipo: 't' }, { titolo: 'Ritiri', tipo: 'intero' }],
      righe: [
        ...giorniSettimana.map(x => {
          const d = delGiorno('RETE', x.giorno);
          return { celle: [`${x.nome} ${giorno(x.giorno)}`, d ? n(d.t) : '—', d ? n(d.ritiri) : '—'] };
        }),
        { stile: 'totale', celle: [etichettaSettimana('RETE'), tot ? n(tot.t) : '—', tot ? n(tot.ritiri) : '—'] },
      ],
    });
    const racc = tot && Array.isArray(tot.raccoglitori) ? tot.raccoglitori.filter(r => r.t > 0 || r.ritiri > 0) : [];
    sezioni.push({
      titolo: 'Rete — chi ha raccolto nella settimana',
      colonne: [{ titolo: 'Raccoglitore (come sul formulario)', peso: 3.2 }, { titolo: 'Regioni', peso: 2.4 }, { titolo: 'Raccolto (t)', tipo: 't' }, { titolo: 'Ritiri', tipo: 'intero' }],
      righe: !tot ? [{ celle: [`Nessun giorno della settimana nei dati: i dati arrivano ${alGiorno(giornoDati)}.`, '', '—', '—'] }]
        : [
          ...racc.map(r => ({ celle: [r.raccoglitore, (r.regioni || []).join(', '), n(r.t), n(r.ritiri)] })),
          { stile: 'totale', celle: ['Totale rete della settimana', '', n(tot.t), n(tot.ritiri)] },
        ],
    });
  }

  const rete = quadro ? quadro.rete : null;
  if (!rete) {
    const perche = erroreQuadro ? `Il quadro della commessa non si è caricato: ${erroreQuadro}.` : 'Il quadro della commessa non è arrivato.';
    sezioni.push(nonLetta(`Rete — il contratto Ecotyre ${anno}`, `${perche} Target, atteso, scarti per regione e raccoglitori non si possono scrivere.`));
  } else {
    const a = rete.atteso;
    const giornoMisura = quadro.giorno_misura !== undefined ? quadro.giorno_misura : giornoDati;
    // le frecce dello scarto restano a video: il carattere del PDF non le ha, e
    // la parola («avanti di», «indietro di») dice gia' il verso
    sezioni.push({
      titolo: `Rete — il contratto Ecotyre ${anno}`,
      colonne: [{ titolo: 'Voce', peso: 2 }, { titolo: 'Valore', peso: 2 }, { titolo: 'Nota', peso: 4 }],
      righe: cifreRete(rete, { annoInCorso }).map(c => ({ celle: [c.etichetta, String(c.valore).replace(/[▲▼]\s*/g, ''), c.sotto || ''] })),
    });

    // IL MESE DELLA SETTIMANA: i mesi dell'anno scelto che la settimana tocca.
    const mesiSett = [...new Set(giorniSettimana.filter(x => Number(x.giorno.slice(0, 4)) === Number(anno)).map(x => Number(x.giorno.slice(5, 7)) - 1))];
    const tuttiMesi = righeMesi(rete.mesi);
    if (mesiSett.length && tuttiMesi.length) {
      sezioni.push({
        titolo: mesiSett.length > 1 ? 'Rete — i mesi della settimana' : 'Rete — il mese della settimana',
        colonne: [{ titolo: 'Mese', peso: 2 }, { titolo: 'Target del profilo (t)', tipo: 't' }, { titolo: 'Target fino ai dati (t)', tipo: 't' }, { titolo: 'Raccolto (t)', tipo: 't' },
          { titolo: 'Scarto del mese (t)', tipo: 't' }, { titolo: 'Raccolto progressivo (t)', tipo: 't' }],
        righe: mesiSett.map(i => tuttiMesi[i]).filter(Boolean).map(r => ({
          celle: [r.aMeta ? `${r.mese} ${anno} (${alGiorno(giornoMisura).replace(/\/\d{4}$/, '')})` : `${r.mese} ${anno}`, n(r.targetMese), n(r.target), n(r.raccolto), n(r.scarto), n(r.raccoltoCum)],
        })),
      });
    }

    // LE REGIONI: l'anno come la tabella della dashboard, e accanto la settimana.
    // La regione della settimana e' quella della dashboard (regioneDellaDashboard,
    // la stessa del riparto); una regione della settimana fuori dal contratto va
    // nella riga «Fuori dalle regioni del contratto», come nell'anno.
    const settRegioni = !motivoCanale('RETE') && totale('RETE') ? (totale('RETE').regioni || []) : null;
    const righeAnno = righeRegioni(rete);
    const nomi = new Set(righeAnno.filter(r => !r.fuori).map(r => minuscolo(r.regione)));
    const fuoriSett = settRegioni ? settRegioni.filter(r => !nomi.has(minuscolo(r.regione))) : [];
    if (fuoriSett.some(r => r.t > 0) && !righeAnno.some(r => r.fuori)) {
      // senza riparto nel contratto le righe sono le regioni con un raccolto
      // dell'anno, e una della settimana che non c'e' non e' «fuori dal contratto»
      const conRiparto = righeAnno.some(r => !vuoto(r.target_t));
      righeAnno.push({ regione: conRiparto ? 'Fuori dalle regioni del contratto' : 'Altre regioni della settimana', fuori: true, target_t: null, atteso_t: null, raccolto_t: conRiparto && rete.fuori_contratto ? rete.fuori_contratto.raccolto_t : null, scarto_t: null, pct_atteso: null });
    }
    const dellaSettimana = (r) => {
      if (!settRegioni) return '—';
      if (r.fuori) return n(r3(fuoriSett.reduce((s, x) => s + x.t, 0)));
      const x = settRegioni.find(y => minuscolo(y.regione) === minuscolo(r.regione));
      return n(x ? x.t : 0);
    };
    const totRete = totale('RETE');
    sezioni.push({
      titolo: `Rete — regioni: target, scarto e la settimana`,
      colonne: [{ titolo: 'Regione', peso: 2.4 }, { titolo: 'Target (t)', tipo: 't' }, { titolo: giornoMisura ? `Atteso ${alGiorno(giornoMisura).replace(/\/\d{4}$/, '')} (t)` : 'Atteso (t)', tipo: 't' },
        { titolo: `Raccolto ${anno} (t)`, tipo: 't' }, { titolo: 'Scarto (t)', tipo: 't' }, { titolo: "% dell'atteso", tipo: 'percentuale' }, { titolo: 'Raccolto della settimana (t)', tipo: 't' }],
      righe: [
        ...righeAnno.map(r => ({ celle: [r.regione, n(r.target_t), n(r.atteso_t), n(r.raccolto_t), n(r.scarto_t), n(r.pct_atteso), dellaSettimana(r)] })),
        { stile: 'totale', celle: ['Totale rete', n(rete.target_t), n(a ? a.atteso_t : null), n(rete.raccolto_t), n(a ? a.scarto_t : null), n(a && a.atteso_t ? (rete.raccolto_t / a.atteso_t) * 100 : null), totRete && !motivoCanale('RETE') ? n(totRete.t) : '—'] },
      ],
    });

    const colonneRaccoglitori = [
      { titolo: 'Raccoglitore', peso: 3 }, { titolo: 'Regione', peso: 1.5 },
      { titolo: 'Target ad oggi (t)', tipo: 't' }, { titolo: 'Raccolto (t)', tipo: 't' }, { titolo: 'Scarto (t)', tipo: 't' }, { titolo: '%', tipo: 'percentuale' },
    ];
    const rigaRaccoglitore = (r) => ({ celle: [r.raccoglitore, r.regione, n(r.target_ad_oggi_t), n(r.raccolto_t), n(r.scarto_t), n(r.pct)] });
    const sulTarget = giornoMisura ? ` sul loro target ${alGiorno(giornoMisura).replace(/\/\d{4}$/, '')}` : ' sul loro target';
    if (rete.raccoglitori) {
      sezioni.push({ titolo: `Rete — raccoglitori più indietro${sulTarget}`, colonne: colonneRaccoglitori, righe: (rete.raccoglitori.indietro || []).map(rigaRaccoglitore) });
      sezioni.push({ titolo: `Rete — raccoglitori più avanti${sulTarget}`, colonne: colonneRaccoglitori, righe: (rete.raccoglitori.avanti || []).map(rigaRaccoglitore) });
    } else {
      sezioni.push(nonLetta('Rete — raccoglitori sul loro target', rete.raccoglitori_perche || 'La classifica dei raccoglitori non c\'è.'));
    }
  }

  // ─── ACI ED EXTRA RACCOLTA: OGNUNO A SE' ───
  const rigaSettimana = (c, parola) => {
    if (motivoCanale(c)) return { celle: ['Raccolto della settimana', '—', `non letto: ${motivoCanale(c)}`] };
    const tot = totale(c);
    if (!tot) return { celle: ['Raccolto della settimana', '—', `nessun giorno della settimana nei dati, che arrivano ${alGiorno(giornoDati)}`] };
    const parziale = !settimanaIntera(c) ? `, fino ${alGiorno(finoA(c))}` : '';
    return { celle: ['Raccolto della settimana', t(tot.t), `${intero(tot.ritiri)} ${tot.ritiri === 1 ? parola[0] : parola[1]}${parziale}`] };
  };
  const meseDelCanale = (mesi) => [...new Set(giorniSettimana.filter(x => Number(x.giorno.slice(0, 4)) === Number(anno)).map(x => Number(x.giorno.slice(5, 7)) - 1))]
    .map(i => (mesi || [])[i]).filter(Boolean)
    .map(m => ({ celle: [`Raccolto di ${minuscolo(m.mese)} ${anno}`, m.futuro ? '—' : t(m.raccolto_t), m.coperto > 0 && m.coperto < 1 ? 'il mese fin qui' : ''] }));
  const aci = quadro ? quadro.aci : null;
  sezioni.push({
    titolo: `ACI — autodemolitori (un canale a sé, non si somma alla rete)`,
    colonne: [{ titolo: 'Voce', peso: 2.4 }, { titolo: 'Valore', peso: 1.6 }, { titolo: 'Nota', peso: 4 }],
    righe: [
      rigaSettimana('ACI', ['ritiro', 'ritiri']),
      ...(aci ? [
        ...meseDelCanale(aci.mesi),
        { celle: [`Raccolto del ${anno}`, t(aci.raccolto_t), `${intero(aci.ritiri)} ${aci.ritiri === 1 ? 'ritiro' : 'ritiri'}`] },
        // Il contratto dell'anno copiato dall'anno prima e non ancora confermato
        // (quadro.aci.da_confermare, prova del cambio d'anno del 15/10/2026): la
        // previsione e' quella dell'anno prima, e il PDF lo dice come la dashboard.
        { celle: ['Previsione indicativa del contratto ACI', t(aci.previsione_t), [
          aci.previsione_t ? `${pct(aci.pct_previsione)} della previsione: non è un obiettivo` : 'nessuna previsione nel contratto ACI',
          aci.da_confermare ? `previsione copiata dal ${Number(anno) - 1}, da confermare` : '',
        ].filter(Boolean).join('; ')] },
      ] : [{ celle: [`Raccolto del ${anno}`, '—', erroreQuadro ? `il quadro non si è caricato: ${erroreQuadro}` : 'il quadro non è arrivato'] }]),
    ],
  });
  const extra = quadro ? quadro.extra : null;
  sezioni.push({
    titolo: `Extra raccolta (sempre a parte)`,
    colonne: [{ titolo: 'Voce', peso: 2.4 }, { titolo: 'Valore', peso: 1.6 }, { titolo: 'Nota', peso: 4 }],
    righe: [
      rigaSettimana('EXTRA_RACCOLTA', ['intervento', 'interventi']),
      ...(extra ? [
        ...meseDelCanale(extra.mesi),
        { celle: [`Raccolto del ${anno}`, t(extra.raccolto_t), `${intero(extra.interventi)} ${extra.interventi === 1 ? 'intervento' : 'interventi'}`] },
        { celle: ['Ultimo intervento terminato', extra.ultimo_giorno ? giorno(extra.ultimo_giorno) : '—', extra.ultimo_giorno ? 'per fine trasporto' : `nessun intervento del ${anno}`] },
      ] : [{ celle: [`Raccolto del ${anno}`, '—', erroreQuadro ? `il quadro non si è caricato: ${erroreQuadro}` : 'il quadro non è arrivato'] }]),
    ],
  });

  // ─── IMPIANTI: DALLA FOTOGRAFIA DELLA NOTTE ───
  const imp = cruscotto ? cruscotto.impianti : null;
  const titoloImpianti = imp && imp.giorno ? `Impianti — quadratura e da dichiarare (controllo della notte del ${giorno(imp.giorno)})` : 'Impianti — quadratura e da dichiarare';
  if (!annoInCorso) {
    sezioni.push(nonLetta(titoloImpianti, `La quadratura di ogni notte è sull'anno in corso: per il ${anno} si guarda Giacenze, scegliendo l'anno.`));
  } else if (!cruscotto) {
    sezioni.push(nonLetta(titoloImpianti, `Il controllo della notte non si è potuto leggere${erroreCruscotto ? `: ${erroreCruscotto}` : ''}. Quadratura e da dichiarare: —.`));
  } else if (!imp || imp.stato !== 'fresca') {
    sezioni.push(nonLetta(titoloImpianti, `${!imp || imp.stato === 'assente' ? 'Il controllo della notte non c\'è.' : `Il controllo della notte è del ${giorno(imp.giorno)}.`} ${(imp && imp.perche) || ''} Quadratura e da dichiarare: —. I numeri di adesso sono in Giacenze e Dichiarazioni Impianti.`.replace(/\s+/g, ' ').trim()));
  } else {
    const ac = imp.aci_stoccaggi;
    const righe = [
      { celle: ['Rete: quadratura con il portale', `${intero(imp.quadrano)} su ${intero(imp.con_confronto)}`, (imp.scostamenti || []).length ? `${intero(imp.scostamenti.length)} da verificare, qui sotto` : 'tutti in linea'] },
      ...(ac && ac.con_confronto > 0 ? [{ celle: ['ACI negli stoccaggi, a parte: quadratura con il portale', `${intero(ac.quadrano)} su ${intero(ac.con_confronto)}`, 'mai sommata alla rete'] }] : []),
      ...CANALI.map(c => {
        const d = imp.da_dichiarare && imp.da_dichiarare[c];
        return { celle: [`Da dichiarare · ${NOMI_CANALE[c]}`, t(d ? d.t : null), d ? (d.impianti ? `su ${intero(d.impianti)} ${d.impianti === 1 ? 'impianto' : 'impianti'}` : 'niente da dichiarare') : 'non nel controllo della notte'] };
      }),
      ...(imp.scostamenti || []).map(s => ({ celle: [`Non quadra: ${s.sito}${s.stoccaggio ? ' (stoccaggio)' : ''}`, tSegno(s.scarto_t), `calcolata ${t(s.calcolata_t)}, portale ${t(s.portale_t)}`] })),
      ...(imp.sotto_zero || []).map(s => ({ celle: [`Giacenza sotto zero: ${s.sito}, ${NOMI_CANALE[s.canale] || s.canale}`, t(s.giacenza_t), 'da correggere: non entra nella cifra da dichiarare'] })),
    ];
    // un archivio per riga: il lunedi' mattina si caricano tutti e cinque, e in
    // una cella sola l'ultimo nome non ci stava (revisione del 15/10/2026)
    (imp.caricati_dopo || []).forEach((x, i) => righe.push({ celle: [i === 0 ? 'Caricati dopo la notte' : '', `${x.nome} (${giornoMese(x.il)})`, i === 0 ? 'i numeri di adesso sono in Giacenze e Dichiarazioni Impianti' : ''] }));
    sezioni.push({ titolo: titoloImpianti, colonne: [{ titolo: 'Voce', peso: 3.2 }, { titolo: 'Valore', peso: 1.6 }, { titolo: 'Nota', peso: 3.6 }], righe });
  }

  // ─── DA GESTIRE ───
  // L'elenco unico della dashboard nel momento del PDF, comprese le voci che chi
  // guarda ha nascosto a video (nascondere e' una comodita' sua, la direzione le
  // deve vedere). Le voci del margine sono dell'amministratore.
  const tutteLeVoci = (voci || []).filter(v => v && v.titolo && (isAdmin || !/^(margine|passiva):/.test(String(v.chiave || ''))));
  if (!cruscotto && erroreCruscotto) {
    sezioni.push(nonLetta('Da gestire', `L'elenco «Da gestire» non si è potuto leggere: ${erroreCruscotto}.`));
  } else {
    // il titolo e la frase interi: se vanno oltre tre righe, continuano nelle
    // righe sotto (sezionePerIlPdf)
    const righe = tutteLeVoci.map(v => ({ celle: [GRAVITA[v.gravita] || v.gravita || '', v.area || '', String(v.titolo).trim(), String(v.dettaglio || '').trim()] }));
    sezioni.push({
      titolo: `Da gestire — ${tutteLeVoci.length === 1 ? 'una voce' : `${intero(tutteLeVoci.length)} voci`}, le critiche per prime${tutteLeVoci.some(v => v.gravita === 'critico') ? '' : ' (nessuna critica)'}`,
      colonne: [{ titolo: 'Gravità', peso: 1.1 }, { titolo: 'Area', peso: 1.7 }, { titolo: 'Voce', peso: 3.4 }, { titolo: 'Che cosa dice', peso: 6 }],
      righe: righe.length ? righe : [{ celle: ['', '', 'Niente da gestire', ''] }],
    });
    // GLI ORDINI RIMASTI «ESEGUITO»: tutti gli ID, non solo i primi dieci della voce.
    const eseguiti = tutteLeVoci.find(v => v.chiave === 'eseguiti');
    if (eseguiti && Array.isArray(eseguiti.elementi) && eseguiti.elementi.length) {
      sezioni.push({
        titolo: `Ordini rimasti «eseguito» a portale: ${intero(eseguiti.elementi.length)} ID`,
        colonne: [{ titolo: 'ID ordine (o FIR): a portale va premuto Chiudi, altrimenti non entrano in nessun conto', peso: 1 }],
        righe: [{ celle: [eseguiti.elementi.join(', ')] }],
      });
    }
  }

  // ─── FATTURAZIONE ATTIVA ───
  const titoloFatt = `Fatturazione attiva verso Ecotyre ${anno} — mesi per canale`;
  const statoDi = (c) => (!c || !c.elaborato ? 'da elaborare' : c.chiuso ? 'chiusa' : 'elaborata');
  if (!Array.isArray(mesiAttiva)) {
    const perche = annoInCorso ? (erroreCruscotto ? `: ${erroreCruscotto}` : '') : (erroreQuadro ? `: ${erroreQuadro}` : '');
    sezioni.push(nonLetta(titoloFatt, `I documenti della fatturazione del ${anno} non si sono potuti leggere${perche}.`));
  } else {
    const righe = mesiAttiva.map(m => ({ celle: [m.etichetta || m.mese, ...CANALI.map(c => (m.canali ? statoDi(m.canali[c]) : m.stato)), m.prefattura ? 'caricata' : 'non caricata'] }));
    // il mese in corso non si fattura ancora: lo si dice, invece di tacerlo
    if (annoInCorso && Number(String(oggi).slice(0, 4)) === Number(anno)) {
      const mese = MESI[Number(String(oggi).slice(5, 7)) - 1];
      righe.push({ celle: [`${mese} ${anno}, in corso`, ...CANALI.map(() => 'in corso'), '—'] });
    }
    sezioni.push({
      titolo: titoloFatt,
      colonne: [{ titolo: 'Mese', peso: 1.8 }, ...CANALI.map(c => ({ titolo: NOMI_CANALE[c] })), { titolo: 'Prefattura del portale' }],
      righe: righe.length ? righe : [{ celle: [notaAttiva || `Nessun mese finito da fatturare nel ${anno}.`, '', '', '', ''] }],
    });
    if (notaAttiva) note.push(`Fatturazione attiva: ${notaAttiva}`);
  }

  // ─── L'ECONOMIA: SOLO NELLA COPIA DELL'AMMINISTRATORE ───
  if (isAdmin) {
    const titoloEco = `Economia della commessa ${anno} (riservata all'amministratore: tre commesse, tre margini, non si sommano)`;
    if (erroreMargine) sezioni.push(nonLetta(titoloEco, `Il margine non si è potuto calcolare: ${erroreMargine}.`));
    else if (!margine || !Array.isArray(margine.canali)) sezioni.push(nonLetta(titoloEco, 'Il margine non è arrivato.'));
    else {
      const mesiSett = [...new Set(giorniSettimana.filter(x => Number(x.giorno.slice(0, 4)) === Number(anno)).map(x => MESI[Number(x.giorno.slice(5, 7)) - 1]))];
      // UN MARGINE CON PREZZI MANCANTI E' «—», COL PERCHE' (prova del cambio
      // d'anno, 15/10/2026). Il 15/01/2027, senza le tariffe 2027, la rete usciva
      // [0, 0, 0, —] e l'extra raccolta con un margine di -113,50 € fatto da un
      // ricavo che mancava. Il calcolo mette margine, % ed €/t a null quando
      // mancano dei prezzi e scrive la frase (testo_prezzi_mancanti): qui la
      // nota la riporta, con ricavo e costo detti parziali, e le righe con una
      // tariffa copiata e da confermare (testo_da_confermare).
      const nota = (x) => [
        x.testo_prezzi_mancanti ? `${x.testo_prezzi_mancanti}; ricavo e costo parziali` : '',
        x.testo_da_confermare || '',
      ].filter(Boolean).join('; ');
      const riga = (c, periodo, x) => ({ celle: [NOMI_CANALE[c.canale] || c.canale, periodo, n(x.ricavo), n(x.costo), n(x.margine), n(x.margine_pct), n(x.tonnellate), n(x.margine_t), nota(x)] });
      const righe = [];
      for (const c of margine.canali) {
        if (c.anno) righe.push(riga(c, `${anno}, fino a oggi`, c.anno));
        for (const m of (c.mesi || []).filter(x => mesiSett.includes(x.mese))) righe.push(riga(c, `${m.mese} ${anno}`, m));
      }
      sezioni.push({
        titolo: titoloEco,
        colonne: [{ titolo: 'Canale', peso: 1.4 }, { titolo: 'Periodo', peso: 1.6 }, { titolo: 'Ricavo', tipo: 'euro' }, { titolo: 'Costo', tipo: 'euro' }, { titolo: 'Margine', tipo: 'euro' },
          { titolo: '% del ricavo', tipo: 'percentuale' }, { titolo: 'Tonnellate', tipo: 't' }, { titolo: 'Margine per t', tipo: 'euro' }, { titolo: 'Nota', peso: 2.6 }],
        righe,
      });
    }
  }

  // ─── I RIQUADRI IN TESTA ───
  const a = rete ? rete.atteso : null;
  const tileSettimana = (c, nome) => ({ etichetta: `${nome}: raccolto della settimana`, valore: totale(c) ? t(totale(c).t) : '—' });
  const riepilogo = [
    tileSettimana('RETE', 'Rete'),
    { etichetta: `Rete: raccolto del ${anno}`, valore: rete ? t(rete.raccolto_t) : '—' },
    { etichetta: a ? `Rete: scarto sull'atteso ${alGiorno(a.giorno).replace(/\/\d{4}$/, '')}` : "Rete: scarto sull'atteso", valore: a ? `${a.scarto_t >= 0 ? '+' : '-'}${t(Math.abs(a.scarto_t))}` : '—' },
    tileSettimana('ACI', 'ACI'),
    tileSettimana('EXTRA_RACCOLTA', 'Extra raccolta'),
  ];

  // ─── COME SI LEGGONO ───
  const parziale = giornoDati && !settimanaIntera('RETE') && !nessunGiorno('RETE');
  note.unshift(
    `La settimana va da lunedì a domenica, ${dalGiorno(dal)} ${alGiorno(al)}: ogni movimento conta nel giorno italiano di fine trasporto, mai nel giorno della chiusura a portale.`,
    ...(parziale ? [`I dati delle primarie arrivano ${alGiorno(giornoDati)}: i giorni dopo sono scritti «—», non zero, e il totale della settimana è fino a quel giorno.`] : []),
    ...(!giornoDati ? ['Il giorno fino a cui arrivano i dati non si sa (il quadro della commessa non si è caricato): un giorno a zero può essere un giorno non ancora caricato.'] : []),
    ...(aCavallo ? [`La settimana è a cavallo fra il ${dal.slice(0, 4)} e il ${al.slice(0, 4)}: i numeri della settimana comprendono tutti i suoi giorni, quelli dell'anno sono del ${anno}.`] : []),
    'Rete, ACI ed extra raccolta sono canali indipendenti: nessuna tabella e nessun riquadro li somma.',
    ...(rete ? [`Target: il contratto Ecotyre del ${anno} in Target & Status${senzaTarget(rete) ? ', che non ha un target: i numeri che ne dipendono sono «—»' : ''}. Atteso: il target ripartito col profilo mensile del contratto, ${a && a.fine_anno ? `per l'anno intero: il ${anno} è chiuso` : 'fino al giorno dei dati'}; ogni regione col suo.`] : []),
    ...(rete && fraseVariazioni(rete, anno) ? [fraseVariazioni(rete, anno)] : []),
    'Regioni: la regione del formulario, o quella della sua provincia, come nella dashboard. Raccoglitori della settimana: il trasportatore scritto sul formulario; la classifica sul target usa i nomi dei target in Target & Status.',
    'Impianti: dal controllo della notte; «da dichiarare» è la colonna «Da dichiarare» delle Dichiarazioni Impianti, sommata canale per canale.',
    'Da gestire: l\'elenco della dashboard nel momento in cui il PDF è stato fatto, comprese le voci nascoste a video.',
    ...(isAdmin ? ['Economia: riservata all\'amministratore. Il ricavo è quello della fatturazione attiva verso Ecotyre, il costo quello della passiva dei fornitori; ogni canale ha il suo margine.'] : []),
    'Un valore che manca è scritto «—», mai zero. Il PDF si scarica e si manda a mano: il gestionale non manda email.',
  );

  // Il blocco di testa del corredo comune, senza chiedere niente al server: chi
  // genera e fino a quando arrivano i dati li sa gia' la dashboard.
  const primarie = cruscotto && cruscotto.caricamenti ? (cruscotto.caricamenti.archivi || []).find(x => x.tipo_file === 'primarie') : null;
  const stato = giornoDati
    ? { letto: true, utente: perIlPdf(utente), archivi: [{ archivio: 'primarie', dati_fino_al: giornoDati, caricato_il: primarie && primarie.il ? primarie.il : '' }] }
    : { letto: false, utente: perIlPdf(utente) };
  stato.caricamenti_aperti = cruscotto && cruscotto.caricamenti ? (cruscotto.caricamenti.in_corso || []).map(x => ({ titolo: perIlPdf((x.avviso && x.avviso.titolo) || 'Caricamento non concluso') })) : [];

  // Ogni testo esce scrivibile, e nessuna cella oltre le tre righe (sezionePerIlPdf).
  const nomeGiorno = (g) => giorno(g).replace(/\//g, '-');
  return {
    nomeFile: `Riepilogo settimana ${settimana.numero || ''} ${settimana.anno_settimana || ''} - dal ${nomeGiorno(dal)} al ${nomeGiorno(al)}${isAdmin ? ' - con economia (riservato)' : ''}`.replace(/\s+/g, ' '),
    titolo: `Riepilogo della settimana ${settimana.numero || ''} del ${settimana.anno_settimana || anno}`.replace(/\s+/g, ' '),
    sottotitolo: `Da lunedì ${giorno(dal)} a domenica ${giorno(al)}`,
    riepilogo: riepilogo.map(r => ({ ...r, etichetta: perIlPdf(r.etichetta), valore: typeof r.valore === 'string' ? perIlPdf(r.valore) : r.valore })),
    sezioni: sezioni.map(sezionePerIlPdf),
    note: note.map(perIlPdf),
    titoloNote: 'Come si leggono questi numeri',
    documento: { periodo: perIlPdf(`${dalGiorno(dal)} ${alGiorno(al)}`), stato },
  };
}
