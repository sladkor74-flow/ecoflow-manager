// LA BOCCA CHE SEGUE LA VOCE.
//
// Finche' EcoTyna parlava, la bocca si apriva a caso (un numero sorteggiato ogni
// 110 millesimi) e in piu' quel numero non arrivava nemmeno al disegno: nessuno
// passava `intensita` all'avatar, quindi la bocca stava ferma, socchiusa, per
// tutta la risposta. Sembrava un fermo immagine che parla.
//
// Qui la bocca si muove sulle sillabe vere. L'italiano lo permette come pochi:
// si scrive come si pronuncia, quindi dalle lettere si sa gia' che forma prende
// la bocca. Le forme che l'occhio distingue sono poche - i "visemi" - e bastano:
//
//   A E I O U  le cinque vocali, che sono l'apertura
//   M          le labbra che si chiudono: m, b, p (si VEDE, e se manca si nota)
//   F          il labbro sotto i denti: f, v
//   C          tutte le altre consonanti, bocca appena aperta
//   riposo     il silenzio delle pause
//
// Due scelte che rendono il risultato credibile:
//
// 1) Un gruppo di consonanti fa UN solo movimento, non uno per lettera. Nel
//    parlato lo "scr" di "scrivere" e' un gesto unico; un movimento per lettera
//    darebbe quel tremolio da marionetta. Del gruppo si tiene la lettera che si
//    vede: se c'e' una labiale vince lei, perche' le labbra chiuse sono la cosa
//    piu' evidente di tutta la faccia.
//
// 2) La traccia e' un orario, non una coda. Ogni forma sa a che millesimo
//    comincia, cosi' la voce vera puo' rimetterla in riga: la sintesi del
//    browser avvisa quando attacca una parola nuova (onboundary) e in quel
//    momento si sa dove dovrebbe essere la bocca e dove e'. La differenza si
//    corregge in un colpo, quindi la bocca non accumula ritardo nemmeno su una
//    risposta lunga, e non importa se la voce scelta legge piu' piano o piu'
//    svelto del previsto.
//
// Questo file non disegna niente e non sa niente del browser: riceve testo,
// torna un orario di forme. Il disegno sta in src/components/assistente/EcoTyna.jsx,
// la voce in src/lib/voce.js, le prove in prove/visemi.mjs.

/** La bocca ferma, chiusa: le pause e il silenzio. */
export const RIPOSO = 'riposo';

// Le vocali, anche accentate: l'accento cambia il suono, non la forma della bocca.
const VOCALI = {
  a: 'A', 'à': 'A', 'á': 'A',
  e: 'E', 'è': 'E', 'é': 'E',
  i: 'I', 'ì': 'I', 'í': 'I',
  o: 'O', 'ò': 'O', 'ó': 'O',
  u: 'U', 'ù': 'U', 'ú': 'U',
};

const LABIALI = 'mbp';        // le labbra si chiudono
const DENTELABIALI = 'fv';    // il labbro sotto i denti
const CONSONANTI = 'bcdfghjklmnpqrstvwxyz';
const CIFRE = '0123456789';
const PAUSA_LUNGA = '.!?…\n';
const PAUSA_BREVE = ',;:';

/**
 * Quanto dura ogni forma, in millesimi, a velocita' di lettura normale.
 * Misure sul parlato italiano corrente: circa cinque sillabe e mezzo al secondo,
 * cioe' 180 millesimi per sillaba, che si dividono tra la consonante e la vocale.
 */
export const DURATE = {
  vocale: 115,
  dittongo: 85,        // due vocali attaccate si accorciano a vicenda: "ciao"
  consonante: 55,
  consonanteInPiu: 15, // ogni lettera in piu' del gruppo allunga un po'
  consonanteMax: 95,
  labiale: 70,
  dentelabiale: 70,
  pausaBreve: 150,
  pausaLunga: 280,
  cifra: 170,          // una cifra si legge come una parola: "sette", "trenta"
};

/** Quanto e' aperta la bocca su una forma, da 0 a 1. Serve a chi vuole un numero solo. */
export function apertura(visema) {
  switch (visema) {
    case 'A': return 1;
    case 'O': return 0.8;
    case 'U': return 0.55;
    case 'E': return 0.5;
    case 'C': return 0.35;
    case 'I': return 0.3;
    case 'F': return 0.12;
    case 'M': return 0;
    default: return 0.02;
  }
}

const cifraSeguita = (basso, i) =>
  (basso[i] === '.' || basso[i] === ',') && CIFRE.includes(basso[i + 1] || '');

/**
 * L'orario delle forme di un testo.
 *
 * Torna { fotogrammi, durata }: ogni fotogramma e' { v, da, a, i }, cioe' la
 * forma, il millesimo in cui comincia, quello in cui finisce, e la posizione nel
 * testo della lettera che la produce - serve per rimettere la bocca in riga
 * quando la voce vera annuncia a che parola e' arrivata.
 *
 * `velocita` e' quella passata alla sintesi (rate): 2 vuol dire il doppio piu'
 * svelta, quindi forme lunghe la meta'.
 */
export function traccia(testo, { velocita = 1 } = {}) {
  const s = String(testo || '');
  const basso = s.toLowerCase();
  const v = Number(velocita) > 0 ? Number(velocita) : 1;
  const fotogrammi = [];
  let t = 0;

  const aggiungi = (forma, durata, posizione) => {
    const d = Math.max(20, Math.round(durata / v));
    fotogrammi.push({ v: forma, da: t, a: t + d, i: posizione });
    t += d;
  };

  let i = 0;
  while (i < s.length) {
    const c = basso[i];

    if (VOCALI[c]) {
      const dopo = !!VOCALI[basso[i + 1]];
      const ultimo = fotogrammi[fotogrammi.length - 1];
      const prima = !!ultimo && 'AEIOU'.includes(ultimo.v) && ultimo.a === t;
      aggiungi(VOCALI[c], dopo || prima ? DURATE.dittongo : DURATE.vocale, i);
      i++;
      continue;
    }

    // Un numero si pronuncia a parole: due movimenti per cifra, con la vocale
    // che cambia, altrimenti "38.000" diventa un battito meccanico. Il punto e
    // la virgola in mezzo alle cifre sono separatori, non pause: su "38.000" la
    // bocca non si deve fermare.
    if (CIFRE.includes(c)) {
      const giro = ['A', 'E', 'O', 'I'];
      let n = 0;
      while (i < s.length && (CIFRE.includes(basso[i]) || cifraSeguita(basso, i))) {
        if (CIFRE.includes(basso[i])) {
          aggiungi('C', DURATE.consonante, i);
          aggiungi(giro[n % giro.length], DURATE.cifra - DURATE.consonante, i);
          n++;
        }
        i++;
      }
      continue;
    }

    if (CONSONANTI.includes(c)) {
      const inizio = i;
      let forma = 'C';
      let quante = 0;
      while (i < s.length && CONSONANTI.includes(basso[i])) {
        const d = basso[i];
        if (LABIALI.includes(d)) forma = 'M';
        else if (DENTELABIALI.includes(d) && forma !== 'M') forma = 'F';
        quante++;
        i++;
      }
      const durata = forma === 'M' ? DURATE.labiale
        : forma === 'F' ? DURATE.dentelabiale
          : Math.min(DURATE.consonante + (quante - 1) * DURATE.consonanteInPiu, DURATE.consonanteMax);
      aggiungi(forma, durata, inizio);
      continue;
    }

    if (PAUSA_LUNGA.includes(c)) { aggiungi(RIPOSO, DURATE.pausaLunga, i); i++; continue; }
    if (PAUSA_BREVE.includes(c)) { aggiungi(RIPOSO, DURATE.pausaBreve, i); i++; continue; }

    i++; // spazi e segni che non si pronunciano: la bocca tira avanti
  }

  return { fotogrammi, durata: t };
}

/** La forma della bocca al millesimo `ms`. Fuori dalla traccia: riposo. */
export function visemaA(tr, ms) {
  const f = tr && tr.fotogrammi;
  if (!f || !f.length || !(ms >= 0) || ms >= tr.durata) return RIPOSO;
  let basso = 0, alto = f.length - 1;
  while (basso < alto) {
    const mezzo = (basso + alto) >> 1;
    if (f[mezzo].a <= ms) basso = mezzo + 1; else alto = mezzo;
  }
  return f[basso].da <= ms ? f[basso].v : RIPOSO;
}

/**
 * A che millesimo la traccia dice la lettera in posizione `carattere`. E' il
 * "dove dovrebbe essere la bocca" con cui si corregge il ritardo quando la voce
 * vera annuncia la parola che attacca.
 */
export function istanteDelCarattere(tr, carattere) {
  const f = tr && tr.fotogrammi;
  if (!f || !f.length) return 0;
  const cerca = Number(carattere) > 0 ? Number(carattere) : 0;
  if (f[f.length - 1].i < cerca) return f[f.length - 1].da;
  let basso = 0, alto = f.length - 1;
  while (basso < alto) {
    const mezzo = (basso + alto) >> 1;
    if (f[mezzo].i < cerca) basso = mezzo + 1; else alto = mezzo;
  }
  return f[basso].da;
}
