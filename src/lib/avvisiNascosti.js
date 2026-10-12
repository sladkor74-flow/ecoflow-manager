// GLI AVVISI A SCOMPARSA DELLA DASHBOARD (migliorie dell'11/10/2026).
//
// Chiesto dall'utente: «permetti gli alert a scomparsa». Ogni voce di «Da
// gestire» si nasconde per oggi o per sette giorni, e torna da sola quando ha
// qualcosa di nuovo da dire: se diventa piu' grave, se un suo numero sale, se
// cambia (un impianto, un mese, un nome nuovo) o quando il tempo scade. Le
// critiche si nascondono solo per oggi, e restano nel conteggio del pannello:
// una critica non sparisce mai in silenzio.
//
// UNA VOCE CHE MIGLIORA NON TORNA. Se il numero scende la voce resta nascosta,
// e il numero nuovo si legge aprendo l'elenco delle nascoste. Tornare per un
// miglioramento insegnerebbe a ignorare il pannello: e' la regola di AGENTS.md
// «un avviso non grida al lupo», applicata al ritorno.
//
// Si ricorda nel browser (localStorage), per utente, e non in un archivio:
// - solo l'amministratore scrive negli archivi, e gli altri resterebbero senza
//   avvisi a scomparsa o con un'eccezione alla regola dei permessi;
// - il limite di richieste e' per tutta l'app: una lettura a ogni apertura e una
//   scrittura a ogni «nascondi», per una comodita' di chi guarda, non valgono;
// - perderla non fa danni: sul telefono una voce nascosta sul computer si vede,
//   al massimo per sette giorni. Nascondere e' una comodita', non una decisione:
//   la decisione («ignora» un alert) resta nella pagina Alert, nell'archivio.
//
// Funzioni pure e senza import, cosi' la prova le carica con node
// (prove/avvisiNascosti.mjs). I giorni sono quelli italiani 'aaaa-mm-gg' e li
// passa chi chiama (oggiRoma): qui non si legge l'orologio.

export const GIORNI_NASCOSTA = 7;
export const GRADO = { info: 0, attenzione: 1, critico: 2 };
export const MASSIMO_NASCOSTE = 200;
const VERSIONE = 1;

// Le date dentro un testo: 11/10/2026, 2026-10-11, 11/10 e le ore 05:30. Non
// dicono che cosa e' la voce, dicono quando: «Controllo del 10/10/2026» cambia
// ogni notte senza che cambi niente.
const DATE = /\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{1,2}:\d{2}\b/g;
// Un numero all'italiana: 1.234,56 · 12 · 0,5. Il segno non conta: «Gatim
// -1,20 t» che diventa «-1,50 t» e' uno scarto che cresce, e si confronta la
// grandezza.
const NUMERO = /\d+(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;

/** Il testo senza date e con i numeri al posto di #: «Rete: # ordini aperti da oltre # giorni». */
export function scheletro(testo) {
  return String(testo || '')
    .replace(DATE, '')
    .replace(NUMERO, '#')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:)])/g, '$1')
    .trim();
}

/** Chi e' la voce, al di la' dei numeri: voce.chiave, se c'e'; altrimenti area|link|scheletro del titolo. */
export function chiaveVoce(voce) {
  if (voce && voce.chiave) return String(voce.chiave);
  return `${(voce && voce.area) || ''}|${(voce && voce.link) || ''}|${scheletro(voce && voce.titolo)}`;
}

/** Il contenuto che, se cambia, la fa tornare: voce.firma, se c'e'; altrimenti lo scheletro del dettaglio. */
export function firmaVoce(voce) {
  if (voce && voce.firma !== undefined && voce.firma !== null) return String(voce.firma);
  return scheletro(voce && voce.dettaglio);
}

/** Un numero scritto all'italiana come numero: «1.234,56» vale 1234.56. */
export function numeroItaliano(testo) {
  const s = String(testo || '').replace(/\s/g, '').replace(/^[+-]/, '');
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s);
  return Number.isFinite(n) ? n : null;
}

/**
 * I nomi che la voce elenca (voce.elementi: i raccoglitori sotto il target del
 * mese), o null se la voce non li dice. Revisione delle migliorie, 11/10/2026:
 * nascosta la voce «1 a rischio: ALFA SRL», il giorno dopo «1 a rischio: BETA
 * SRL» restava nascosta fino a sette giorni, perche' il conto era lo stesso. Un
 * nome nuovo la fa tornare; uno che esce no, perche' la voce migliora.
 */
export function elementiVoce(voce) {
  return voce && Array.isArray(voce.elementi) ? [...new Set(voce.elementi.map(String))] : null;
}

/** I numeri del titolo, senza le date: voce.misure, se c'e'. */
export function misureVoce(voce) {
  if (voce && Array.isArray(voce.misure)) return voce.misure.map(Number);
  const testo = String((voce && voce.titolo) || '').replace(DATE, ' ');
  return (testo.match(NUMERO) || []).map(numeroItaliano).filter(n => n !== null);
}

const piuGiorni = (giorno, n) => {
  const [a, m, g] = String(giorno).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, g + n)).toISOString().slice(0, 10);
};

/** Fino a che giorno resta nascosta: le critiche solo oggi, le altre oggi piu' i giorni chiesti. */
export function scadenza(gravita, oggi, giorni = GIORNI_NASCOSTA) {
  if (gravita === 'critico') return oggi;
  const n = Math.max(0, Math.floor(Number(giorni) || 0));
  return n ? piuGiorni(oggi, n) : oggi;
}

/**
 * La riga da ricordare: { chiave, firma, misure, elementi?, gravita, titolo, il, fino_al }.
 * giorni: 0 o niente = per oggi; 7 = per sette giorni (non per le critiche).
 */
export function nascondi(voce, oggi, { giorni = 0 } = {}) {
  const elementi = elementiVoce(voce);
  return {
    chiave: chiaveVoce(voce),
    firma: firmaVoce(voce),
    misure: misureVoce(voce),
    ...(elementi ? { elementi } : {}),
    gravita: (voce && voce.gravita) || 'info',
    titolo: (voce && voce.titolo) || '',
    il: oggi,
    fino_al: scadenza(voce && voce.gravita, oggi, giorni),
  };
}

/**
 * Perche' una voce nascosta torna: null se resta nascosta, altrimenti
 * { motivo, da, a } o { motivo, nuovi }. motivo: 'scaduta', 'piu_grave',
 * 'cambiata', 'numero_salito', 'nome_nuovo'.
 */
export function percheTorna(riga, voce, oggi) {
  if (!riga) return { motivo: 'cambiata' };
  if (!riga.fino_al || oggi > riga.fino_al) return { motivo: 'scaduta' };
  const prima = GRADO[riga.gravita] ?? 0;
  const ora = GRADO[voce && voce.gravita] ?? 0;
  if (ora > prima) return { motivo: 'piu_grave', da: riga.gravita, a: voce.gravita };
  if (firmaVoce(voce) !== String(riga.firma ?? '')) return { motivo: 'cambiata' };
  const m = misureVoce(voce);
  const r = Array.isArray(riga.misure) ? riga.misure : [];
  if (m.length !== r.length) return { motivo: 'cambiata' };
  for (let i = 0; i < m.length; i++) {
    if (Math.abs(m[i]) > Math.abs(Number(r[i]))) return { motivo: 'numero_salito', da: r[i], a: m[i] };
  }
  // Un nome che prima non c'era. Una riga ricordata senza nomi non si confronta.
  const el = elementiVoce(voce);
  if (el && Array.isArray(riga.elementi)) {
    const prima = new Set(riga.elementi.map(String));
    const nuovi = el.filter(x => !prima.has(x));
    if (nuovi.length) return { motivo: 'nome_nuovo', nuovi };
  }
  return null;
}

// Un numero dell'etichetta, all'italiana: 1.234,5.
const italiano = (n) => {
  const v = Math.abs(Number(n));
  if (!Number.isFinite(v)) return '—';
  const [intera, dec] = String(Math.round(v * 1000) / 1000).split('.');
  return intera.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? ',' + dec : '');
};

/** La frase dell'etichetta di una voce tornata. */
export function testoTornata(t) {
  if (!t || t.motivo === 'scaduta') return '';
  if (t.motivo === 'piu_grave') return t.a === 'critico' ? 'tornata: è diventata critica' : 'tornata: è diventata più grave';
  if (t.motivo === 'numero_salito') return `tornata: il numero è salito da ${italiano(t.da)} a ${italiano(t.a)}`;
  if (t.motivo === 'nome_nuovo' && Array.isArray(t.nuovi) && t.nuovi.length) {
    return `tornata: ${t.nuovi.length === 1 ? 'c\'è un nome nuovo' : `ci sono ${t.nuovi.length} nomi nuovi`}, ${t.nuovi.slice(0, 3).join(', ')}${t.nuovi.length > 3 ? ' e altri' : ''}`;
  }
  return 'tornata: è cambiata';
}

/**
 * Smista le voci fra visibili e nascoste. righe: quelle ricordate.
 * { visibili: [{ voce, tornata }], nascoste: [{ voce, riga }], memoria }
 * memoria sono le righe da tenere: chi torna perde la sua; una riga la cui voce
 * non c'e' piu' resta fino al suo fino_al (se la stessa cosa ricompare identica
 * il giorno dopo, e' la stessa cosa gia' vista), poi se ne va. Oltre
 * MASSIMO_NASCOSTE si tengono le piu' recenti.
 */
export function smista(voci, righe, oggi) {
  const perChiave = new Map();
  for (const r of Array.isArray(righe) ? righe : []) {
    if (!r || !r.chiave) continue;
    const prima = perChiave.get(r.chiave);
    if (!prima || String(r.il || '') >= String(prima.il || '')) perChiave.set(r.chiave, r);
  }
  const visibili = [];
  const nascoste = [];
  const usate = new Set();
  for (const voce of voci || []) {
    const k = chiaveVoce(voce);
    const riga = perChiave.get(k);
    if (!riga) { visibili.push({ voce, tornata: null }); continue; }
    usate.add(k);
    const t = percheTorna(riga, voce, oggi);
    if (t) { visibili.push({ voce, tornata: t }); perChiave.delete(k); continue; }
    nascoste.push({ voce, riga });
  }
  const memoria = [...perChiave.values()]
    .filter(r => usate.has(r.chiave) || (r.fino_al && oggi <= r.fino_al))
    .sort((a, b) => String(b.il || '').localeCompare(String(a.il || '')))
    .slice(0, MASSIMO_NASCOSTE);
  return { visibili, nascoste, memoria };
}

/** La memoria vuota: niente nascosto, nessun pannello ricordato. */
export const memoriaVuota = () => ({ v: VERSIONE, nascoste: [], aperte: {} });

/** La chiave del browser per un utente: una per persona, come eco_voce_attiva. */
export const chiaveMemoria = (utente) => `eco_dashboard_${(utente && (utente.id || utente.email)) || 'anonimo'}`;

/**
 * La memoria dell'utente. Una finestra privata di Safari o un browser che blocca
 * i dati del sito lanciano a ogni accesso: allora tutto aperto e niente nascosto,
 * senza errori. Un JSON rotto o di un'altra versione vale come vuoto.
 */
export function leggiMemoria(utente) {
  try {
    const testo = globalThis.localStorage.getItem(chiaveMemoria(utente));
    if (!testo) return memoriaVuota();
    const m = JSON.parse(testo);
    if (!m || m.v !== VERSIONE) return memoriaVuota();
    return {
      v: VERSIONE,
      nascoste: Array.isArray(m.nascoste) ? m.nascoste.filter(r => r && r.chiave) : [],
      aperte: m.aperte && typeof m.aperte === 'object' ? m.aperte : {},
    };
  } catch {
    return memoriaVuota();
  }
}

/** Scrive la memoria dell'utente; se il browser non lo permette, pazienza. */
export function scriviMemoria(utente, memoria) {
  try {
    const m = memoria || memoriaVuota();
    globalThis.localStorage.setItem(chiaveMemoria(utente), JSON.stringify({
      v: VERSIONE,
      nascoste: (Array.isArray(m.nascoste) ? m.nascoste : []).slice(0, MASSIMO_NASCOSTE),
      aperte: m.aperte && typeof m.aperte === 'object' ? m.aperte : {},
    }));
    return true;
  } catch {
    return false;
  }
}
