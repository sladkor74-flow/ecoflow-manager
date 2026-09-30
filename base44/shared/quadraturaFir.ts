// Quadratura settimanale dei formulari.
//
// Ogni settimana SMOCO stampa il conteggio e la somma dei FIR da due fonti
// indipendenti: WINSINFO, il programma con cui si gestiscono i trasporti, e il
// portale Ecotyre. Le due stampe sono pivot con la stessa forma - impianto di
// destinazione, poi trasportatore, poi numero di formulari e chilogrammi - e si
// confrontano fra loro e con il gestionale, che e' la terza fonte.
//
// Il gestionale legge i suoi numeri come il modulo Report Mensile: stato
// terminato e fine trasporto dentro la settimana ISO, lunedi'-domenica. Il peso
// e' sempre quello effettivo.
//
// I canali restano separati: raccolta rete, ACI ed extra raccolta si confrontano
// ognuno per conto suo e non esiste un totale che li somma. Un solo numero per
// tutti e tre non vorrebbe dire niente, perche' hanno contratti, tariffe e
// obiettivi diversi.
//
// Specchio nel frontend: src/lib/quadraturaFir.js.

import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { formatoKg } from "./formato.ts";

export const FONTI = [
  { chiave: 'winsinfo', nome: 'WINSINFO' },
  { chiave: 'ecotyre', nome: 'portale Ecotyre' },
  { chiave: 'gestionale', nome: 'gestionale' },
];

export const NOME_FONTE = { winsinfo: 'WINSINFO', ecotyre: 'portale Ecotyre', gestionale: 'gestionale' };

// I QUATTRO flussi della quadratura, nell'ordine in cui vanno letti e mostrati.
// "entita" e' il nome dell'entita' del gestionale da cui si prendono i movimenti.
// Le secondarie di rete e quelle ACI stanno nello stesso archivio, come nel file
// del portale, e si dividono per classe: vedi shared/canaleSecondaria.ts.
//
// SONO QUATTRO, NON SEI. Regola dell'utente (30/09/2026, testuale): "le verifiche
// sono solo di questo tipo che ti elenco, sempre in riferimento alla specifica
// settimana, solo negli stati terminati: a) primarie rete b) primarie aci
// c) secondarie rete d) secondarie aci". L'extra raccolta non si quadra con
// WINSINFO, e finche' e' stata in questa tabella il modulo apriva un flusso di
// extra raccolta ogni volta che il gestionale ne aveva un movimento nella
// settimana, anche quando nella stampa quella sezione non esisteva: l'utente se
// la ritrovava nell'esito e non capiva di che cosa gli si stesse parlando.
export const FLUSSI = {
  rete_primarie: { titolo: 'Raccolta rete', canale: 'RETE', entita: 'PrimariaRete', nota_file: 'primarie rete' },
  rete_secondarie: { titolo: 'Secondarie rete', canale: 'RETE', entita: 'Secondaria', nota_file: 'secondarie' },
  aci_primarie: { titolo: 'Raccolta ACI', canale: 'ACI', entita: 'PrimariaAci', nota_file: 'primarie ACI' },
  aci_secondarie: { titolo: 'Secondarie ACI', canale: 'ACI', entita: 'Secondaria', nota_file: 'secondarie' },
};

export const ORDINE_FLUSSI = ['rete_primarie', 'rete_secondarie', 'aci_primarie', 'aci_secondarie'];

/** Vero se la chiave e' uno dei quattro flussi della quadratura. */
export const eFlusso = (k) => Object.prototype.hasOwnProperty.call(FLUSSI, String(k || ''));

/**
 * IL FLUSSO DAL TITOLO: UNA PROPOSTA, NON UNA SENTENZA.
 *
 * Le intestazioni non le scrive l'utente, le riceve (parole sue, 30/09/2026:
 * "non le faccio io, a me tocca riceverle e controllarle"), quindi indovinare
 * dal testo e' una scommessa che prima o poi si perde. Qui si fa la proposta
 * migliore possibile e la pagina la fa confermare: chi decide e' l'utente.
 *
 * Due cose sono cambiate il 30/09/2026, dopo la settimana 39.
 *
 * 1. LA SECONDARIETA' SI DECIDE PRIMA DEL CANALE. Prima il canale veniva letto
 *    per primo e "WINSINFO ECT SEC-ACI" - le secondarie ACI - finiva fra le
 *    PRIMARIE ACI, dove si scontrava con la tabella delle primarie ACI vere.
 * 2. SI RICONOSCE "SEC". Il vocabolario cercava "SECOND": "WIN SEC" e "PORTALE
 *    ECT SEC" non erano niente, e le secondarie di rete restavano fuori dal
 *    confronto senza che nessuno lo dicesse.
 */
export function flussoDaTitolo(titolo) {
  const t = String(titolo || '').toUpperCase();
  // "SEC" da solo o seguito da un trattino ("SEC-ACI"), oppure "SECONDARI*".
  // \bSEC\b non prende "SECONDARIE", che non ha confine di parola dopo SEC.
  // L'extra raccolta esce subito, prima di tutto: "EXTRA RACCOLTA" contiene la
  // parola RACCOLTA e senza questa riga finirebbe fra le primarie di rete, che e'
  // peggio che non capirla (i canali non si mescolano mai, regola 3).
  if (fuoriPerimetro(t)) return null;
  const secondarie = /\bSECOND|\bSEC\b|\bSEC[-\s]/.test(t);
  const aci = /\bACI\b|AUTODEMOLIZ/.test(t);
  if (aci) return secondarie ? 'aci_secondarie' : 'aci_primarie';
  if (secondarie) return 'rete_secondarie';
  if (/RACCOLTA|PRIMARI|\bRETE\b/.test(t)) return 'rete_primarie';
  return null;
}

/**
 * Il flusso da due campi espliciti invece che dal titolo: e' quello che si
 * chiede all'agente che trascrive la scansione, perche' "di che canale e'" e
 * "primarie o secondarie" sono due domande a cui si risponde guardando la
 * pagina, mentre "come si chiama il flusso" e' un indovinello sul testo.
 */
export function flussoDaCanaleTipo(canale, tipo) {
  const c = String(canale || '').toUpperCase().trim();
  const t = String(tipo || '').toLowerCase().trim();
  const sec = t.startsWith('second');
  const pri = t.startsWith('primari');
  if (!sec && !pri) return null;
  if (c === 'ACI') return sec ? 'aci_secondarie' : 'aci_primarie';
  if (c === 'RETE') return sec ? 'rete_secondarie' : 'rete_primarie';
  return null;
}

/**
 * Vero se il titolo dice "extra raccolta", che nella quadratura non c'entra.
 * Non e' un titolo incomprensibile: e' fuori perimetro, e va detto cosi'.
 */
export const fuoriPerimetro = (titolo) => /EXTRA/.test(String(titolo || '').toUpperCase());

/**
 * La fonte dal titolo, quando la tabella non la porta scritta a parte.
 *
 * Nella stampa che l'utente riceve il titolo E' l'etichetta della fonte: "WIN
 * SINFO", "PORTALE ECOTYRE", "WINSINFO ECT SEC-ACI", "GESTIONALE ECT ACI".
 * WINSINFO si guarda per primo, perche' "WINSINFO ECT SEC-ACI" contiene anche
 * "ECT" e altrimenti passerebbe per il portale.
 *
 * ATTENZIONE ALLA PAROLA "GESTIONALE". Sulla stampa NON vuol dire questo
 * gestionale: vuol dire il file Excel di chi manda il foglio (Gestione Ecotyre
 * 2026), dove i dati del portale Ecotyre sono gia' riportati. Precisato
 * dall'utente il 30/09/2026. Percio' "GESTIONALE ECT ACI" e "PORTALE ECT SEC"
 * sono la stessa fonte: il portale. Le fonti restano tre - WINSINFO, il portale
 * e questo gestionale - e la terza non compare mai fra le intestazioni della
 * stampa, perche' la calcoliamo noi.
 */
export function fonteDaTitolo(titolo) {
  const t = String(titolo || '').toUpperCase();
  if (/WIN\s*SINFO|\bWINS/.test(t)) return 'winsinfo';
  if (/PORTALE|ECOTYRE|\bECT\b|GESTIONALE/.test(t)) return 'ecotyre';
  return null;
}

/**
 * Il numero di settimana scritto nel titolo: "SETT. 37", "SETTIMANA 37",
 * "Nr. Settimana 39" e anche "W 39", che e' come sta scritto nel riquadro giallo
 * sotto ogni blocco della stampa che l'utente riceve.
 *
 * La settimana la sceglie l'utente caricando la stampa nella settimana giusta:
 * questa serve solo al controllo che conta, cioe' accorgersi quando il file dice
 * una settimana DIVERSA da quella aperta, perche' allora i numeri non sono
 * confrontabili. Senza riconoscere "W 39" quel controllo non scattava mai.
 */
export function settimanaDaTitolo(titolo) {
  const m = String(titolo || '').match(/SETT[.\s]*(?:IMANA)?[.\s]*(\d{1,2})\b/i)
    || String(titolo || '').match(/\bW\.?\s*(\d{1,2})\b/i)
    || String(titolo || '').match(/\bS(?:ETT)?\.?\s*(\d{1,2})\b/i);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= 53 ? n : null;
}

// === abbinamento dei nomi ===
//
// Le etichette di una pivot stampata arrivano tagliate dalla larghezza della
// colonna ("GREEN TYRE PROJ", "PNEUSERVICE CO"), e le due fonti scrivono la
// stessa societa' in modo diverso ("GATIM SRL" e "Gatim", "IRIGOM S.R.L." e
// "Irigom S.r.l."). Si normalizza la ragione sociale e si accetta il nome
// troncato quando e' l'inizio di uno che conosciamo.

const MIN_PREFISSO = 6;

function punteggio(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1000;
  const corto = a.length <= b.length ? a : b;
  const lungo = a.length <= b.length ? b : a;
  let i = 0;
  while (i < corto.length && corto[i] === lungo[i]) i++;
  // Nome intero seguito da altre parole: "trs" dentro "trs tyres recycling".
  if (i === corto.length && i >= 3 && /[\s\-&]/.test(lungo[i])) return i;
  // Etichetta tagliata, anche a meta' di una lettera: "pneuservice cc".
  if (i >= MIN_PREFISSO && corto.length - i <= 1) return i;
  return 0;
}

/**
 * Riconosce i nomi di impianti e trasportatori fra le fonti.
 *
 * Si registrano per primi i nomi del gestionale, che sono quelli buoni: le
 * etichette del file si abbinano a quelli e, se non trovano nessuno, diventano
 * a loro volta un nome nuovo, cosi' le due tabelle del file si riconoscono fra
 * loro anche quando il movimento nel gestionale non c'e' ancora.
 */
export function creaRisolutore() {
  const canonici = new Map(); // chiave normalizzata -> nome da mostrare
  const cache = new Map();

  const registra = (nome) => {
    const k = normalizzaRagioneSociale(nome);
    if (!k) return '';
    if (!canonici.has(k)) canonici.set(k, String(nome).trim());
    return k;
  };

  const risolvi = (nome) => {
    const originale = String(nome || '').trim();
    if (!originale) return { chiave: '', nome: '', modo: 'vuoto', ambiguo: false };
    if (cache.has(originale)) return cache.get(originale);
    const k = normalizzaRagioneSociale(originale);
    let esito;
    if (canonici.has(k)) {
      esito = { chiave: k, nome: canonici.get(k), modo: 'esatto', ambiguo: false };
    } else {
      let migliore = 0, scelta = '', pari = 0;
      for (const c of canonici.keys()) {
        const p = punteggio(k, c);
        if (p > migliore) { migliore = p; scelta = c; pari = 1; } else if (p > 0 && p === migliore) pari++;
      }
      esito = migliore > 0
        ? { chiave: scelta, nome: canonici.get(scelta), modo: 'troncato', ambiguo: pari > 1, letto: originale }
        : { chiave: registra(originale), nome: originale, modo: 'nuovo', ambiguo: false };
    }
    cache.set(originale, esito);
    return esito;
  };

  return { registra, risolvi, canonici };
}

// === lettura del file ===

const numero = (v) => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v ?? '').replace(/\s/g, '');
  if (!s) return 0;
  // "273.170" sono chilogrammi, non 273 virgola 17: il punto separa le migliaia.
  const pulito = /,\d{1,3}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\./g, '').replace(',', '.');
  const n = Number(pulito);
  return isFinite(n) ? n : 0;
};

const testo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

// Sotto i 200 kg di media per formulario i pesi sono in tonnellate: un carico di
// PFU non pesa duecento chili. Si riportano in chilogrammi e lo si scrive.
const MEDIA_MINIMA_KG = 200;

/**
 * Rimette le righe sotto il gruppo giusto usando i subtotali stampati.
 *
 * In una pivot compatta l'impianto e il trasportatore stanno nella stessa
 * colonna, e la riga dell'impianto porta gia' il proprio subtotale: leggendo una
 * scansione e' facile attribuire un trasportatore all'impianto sbagliato, o
 * scambiare per un trasportatore la riga di un impianto che ha un solo vettore.
 *
 * I subtotali pero' sono una traccia: le righe di un gruppo, in ordine, devono
 * sommare esattamente il suo subtotale. Si ripercorre l'elenco cercando
 * l'assegnazione che soddisfa tutti i gruppi, saltando le righe che coincidono
 * con un subtotale - quelle sono righe di gruppo trascritte per errore. Se una
 * soluzione non c'e', non si inventa niente e si restituisce null.
 */
export function ricostruisciGruppi(righe, subtotali) {
  if (!subtotali || !subtotali.length || !righe || !righe.length) return null;
  const eSubtotale = (f) => subtotali.some(s => s.n === f.n && Math.abs(s.kg - f.kg) <= 1);
  let passi = 0;

  const cerca = (i, k, acc, presi, out) => {
    if (passi++ > 50000) return null;
    const s = subtotali[k];
    if (!s) {
      // Tutti i gruppi chiusi: quello che resta puo' essere solo riga di gruppo.
      for (let j = i; j < righe.length; j++) if (!eSubtotale(righe[j])) return null;
      return out;
    }
    if (presi.length && acc.n === s.n && Math.abs(acc.kg - s.kg) <= 1) {
      const r = cerca(i, k + 1, { n: 0, kg: 0 }, [], out.concat(presi.map(f => ({ ...f, impianto: s.impianto }))));
      if (r) return r;
    }
    if (i >= righe.length) return null;
    const f = righe[i];
    if (acc.n + f.n <= s.n && acc.kg + f.kg <= s.kg + 1) {
      const r = cerca(i + 1, k, { n: acc.n + f.n, kg: acc.kg + f.kg }, presi.concat([f]), out);
      if (r) return r;
    }
    if (eSubtotale(f)) {
      const r = cerca(i + 1, k, acc, presi, out);
      if (r) return r;
    }
    return null;
  };

  const esito = cerca(0, 0, { n: 0, kg: 0 }, [], []);
  return esito && esito.length ? esito : null;
}

/**
 * Normalizza quello che e' stato letto dal file e lo verifica con i totali che
 * il file stesso stampa: se la somma delle righe non fa il totale, la
 * trascrizione non e' affidabile e va guardata.
 */
export function normalizzaLettura(letto) {
  const problemi = [];
  const tabelle = [];
  let settimanaFile = Number(letto && letto.settimana) || null;
  const annoFile = Number(letto && letto.anno) || null;

  for (const t of (letto && Array.isArray(letto.tabelle) ? letto.tabelle : [])) {
    const titolo = testo(t.titolo);
    // La fonte scritta a parte vale piu' del titolo; senza quella si legge il
    // titolo, che nella stampa ricevuta E' l'etichetta della fonte.
    const fonteScritta = /wins/i.test(String(t.fonte)) ? 'winsinfo' : /ecotyre|portale/i.test(String(t.fonte)) ? 'ecotyre' : null;
    const fonte = fonteScritta || fonteDaTitolo(titolo);
    // IL FLUSSO SCELTO DALL'UTENTE VINCE SU QUALUNQUE INDOVINELLO SUL TESTO.
    // Sotto di lui viene quello che l'agente ha LETTO sulla pagina (canale e
    // tipo, due domande semplici), e solo per ultimo la proposta dal titolo.
    const scelto = eFlusso(t.flusso) ? String(t.flusso) : null;
    const letto = flussoDaCanaleTipo(t.canale, t.tipo);
    const righe = (Array.isArray(t.righe) ? t.righe : [])
      .map(r => ({ impianto: testo(r.impianto), trasportatore: testo(r.trasportatore), n: Math.round(numero(r.conteggio)), kg: numero(r.kg) }))
      .filter(r => r.impianto && (r.n > 0 || r.kg > 0));
    if (!righe.length) continue;

    const proposto = letto || flussoDaTitolo(titolo);
    const flusso = scelto || proposto;
    if (!settimanaFile) settimanaFile = settimanaDaTitolo(titolo);

    const somma = righe.reduce((s, r) => ({ n: s.n + r.n, kg: s.kg + r.kg }), { n: 0, kg: 0 });
    const stampato = {
      n: Math.round(numero(t.totale_conteggio)),
      kg: numero(t.totale_kg),
    };

    // Pesi in tonnellate: si scalano righe e totale insieme, cosi' il controllo regge.
    let unita = 'kg';
    if (somma.n > 0 && somma.kg > 0 && somma.kg / somma.n < MEDIA_MINIMA_KG) {
      unita = 't';
      for (const r of righe) r.kg = Math.round(r.kg * 1000);
      somma.kg = righe.reduce((s, r) => s + r.kg, 0);
      if (stampato.kg) stampato.kg = Math.round(stampato.kg * 1000);
    }

    const subtotali = (Array.isArray(t.subtotali) ? t.subtotali : [])
      .map(s => ({ impianto: testo(s.impianto), n: Math.round(numero(s.conteggio)), kg: unita === 't' ? Math.round(numero(s.kg) * 1000) : numero(s.kg) }))
      .filter(s => s.impianto);

    let quadraConteggio = !stampato.n || stampato.n === somma.n;
    let quadraPeso = !stampato.kg || Math.abs(stampato.kg - somma.kg) <= 1;
    let ricostruita = false;

    // Se le righe non fanno il totale stampato si prova a rimetterle sotto il
    // gruppo giusto con i subtotali: una scansione fitta si legge male, ma i
    // numeri sulla pagina bastano a rimettere le cose a posto.
    if (!quadraConteggio || !quadraPeso) {
      const rifatte = ricostruisciGruppi(righe, subtotali);
      const nuovaSomma = rifatte ? rifatte.reduce((s, r) => ({ n: s.n + r.n, kg: s.kg + r.kg }), { n: 0, kg: 0 }) : null;
      if (nuovaSomma && (!stampato.n || nuovaSomma.n === stampato.n) && (!stampato.kg || Math.abs(nuovaSomma.kg - stampato.kg) <= 1)) {
        righe.length = 0;
        righe.push(...rifatte);
        somma.n = nuovaSomma.n;
        somma.kg = nuovaSomma.kg;
        quadraConteggio = true;
        quadraPeso = true;
        ricostruita = true;
        problemi.push(`${titolo || 'tabella senza titolo'} · ${NOME_FONTE[fonte] || 'fonte non indicata'}: la prima trascrizione non tornava con i totali stampati, e le righe sono state riassegnate agli impianti usando i subtotali del file. Ora quadra, ma un'occhiata all'originale non guasta.`);
      } else {
        problemi.push(`${titolo || 'tabella senza titolo'} · ${NOME_FONTE[fonte] || 'fonte non indicata'}: le righe lette fanno ${somma.n} formulari e ${formatoKg(somma.kg)} kg, il totale stampato sul file ${stampato.n} e ${formatoKg(stampato.kg)} kg. La trascrizione va controllata sull'originale.`);
      }
    }
    if (!fonte) problemi.push(`${titolo || 'tabella senza titolo'}: non si capisce se la tabella è di WINSINFO o del portale. Scegli la fonte accanto alla tabella.`);
    if (!flusso) {
      problemi.push(fuoriPerimetro(titolo)
        ? `"${titolo}": l'extra raccolta non fa parte della quadratura FIR, che confronta primarie e secondarie di rete e di ACI. La tabella è rimasta fuori dal confronto.`
        : `"${titolo || 'tabella senza titolo'}": non si capisce a quale dei quattro flussi appartiene (primarie rete, secondarie rete, primarie ACI, secondarie ACI). Scegli il flusso accanto alla tabella.`);
    }

    tabelle.push({
      titolo, fonte, flusso, proposto, flusso_scelto: !!scelto, righe, somma, stampato, unita, ricostruita, subtotali,
      // quadra_totali riguarda il totale complessivo, quadra anche i subtotali di gruppo
      quadra_totali: quadraConteggio && quadraPeso,
      quadra: quadraConteggio && quadraPeso,
    });
  }

  // I subtotali di gruppo sono un secondo controllo: impianto per impianto.
  for (const t of tabelle) {
    for (const s of t.subtotali) {
      const righe = t.righe.filter(r => normalizzaRagioneSociale(r.impianto) === normalizzaRagioneSociale(s.impianto));
      if (!righe.length) continue;
      const somma = righe.reduce((a, r) => ({ n: a.n + r.n, kg: a.kg + r.kg }), { n: 0, kg: 0 });
      if ((s.n && s.n !== somma.n) || (s.kg && Math.abs(s.kg - somma.kg) > 1)) {
        t.quadra = false;
        problemi.push(`${t.titolo} · ${NOME_FONTE[t.fonte] || 'fonte non indicata'} · ${s.impianto}: il subtotale stampato è ${s.n} formulari e ${formatoKg(s.kg)} kg, le righe lette ne fanno ${somma.n} e ${formatoKg(somma.kg)}.`);
      }
    }
  }

  // DUE TABELLE SULLO STESSO FLUSSO E SULLA STESSA FONTE NON SI SCELGONO: SI DICONO.
  //
  // Fino al 30/09/2026 il confronto prendeva la prima con un find() e la seconda
  // spariva senza una riga. Nella settimana 39 e' successo davvero: "WINSINFO ECT
  // SEC-ACI" e "WINSINFO ECT ACI" finivano tutte e due su aci_primarie, le
  // secondarie ACI venivano confrontate con le primarie ACI del gestionale - uno
  // scostamento inventato - e le primarie ACI vere non venivano confrontate
  // affatto. Sommarle non e' una via d'uscita: due tabelle possono essere due
  // pezzi dello stesso flusso oppure la stessa cosa contata due volte, e
  // indovinare quale delle due vuol dire scrivere un numero a caso.
  const perChiave = new Map();
  for (const t of tabelle) {
    if (!t.flusso || !t.fonte) continue;
    const k = `${t.flusso}|${t.fonte}`;
    if (!perChiave.has(k)) perChiave.set(k, []);
    perChiave.get(k).push(t);
  }
  for (const [k, gruppo] of perChiave) {
    if (gruppo.length < 2) continue;
    const [flusso, fonte] = k.split('|');
    for (const t of gruppo) t.doppia = true;
    const nomi = gruppo.map(t => `"${t.titolo || 'senza titolo'}"`).join(', ');
    problemi.push(`${FLUSSI[flusso].titolo} · ${NOME_FONTE[fonte]}: ci sono ${gruppo.length} tabelle assegnate allo stesso flusso e alla stessa fonte (${nomi}). Il confronto di questo flusso non si fa: correggi il flusso di ciascuna accanto alla tabella, perché tenerne una sola o sommarle darebbe un numero sbagliato senza dirlo.`);
  }

  // TRE COSE DIVERSE, TRE ESITI DIVERSI.
  //
  // "verificata" era un flag solo, e valeva "le somme tornano E si e' capita la
  // fonte E si e' capito il flusso". La pagina, vedendolo falso, scriveva sempre
  // la stessa frase: "la somma delle righe lette non torna con i totali stampati
  // sul file: controlla la trascrizione sull'originale". Nella settimana 39 le
  // somme tornavano tutte al chilo e il motivo vero era un titolo non
  // riconosciuto: al'utente si dava la colpa di una trascrizione sbagliata che
  // era invece esatta. Adesso i tre esiti viaggiano separati e ognuno ha la sua
  // frase.
  const totaliQuadrano = tabelle.length > 0 && tabelle.every(t => t.quadra);
  const fontiRiconosciute = tabelle.length > 0 && tabelle.every(t => t.fonte);
  const flussiRiconosciuti = tabelle.length > 0 && tabelle.every(t => t.flusso && !t.doppia);

  return {
    settimana_indicata: settimanaFile,
    anno_indicato: annoFile,
    tabelle,
    problemi,
    note: testo(letto && letto.note),
    totali_quadrano: totaliQuadrano,
    fonti_riconosciute: fontiRiconosciute,
    flussi_riconosciuti: flussiRiconosciuti,
    verificata: totaliQuadrano && fontiRiconosciute && flussiRiconosciuti,
  };
}

// === confronto ===

const zero = () => ({ n: 0, kg: 0 });
const uguali = (a, b) => !!a && !!b && a.n === b.n && Math.abs(a.kg - b.kg) <= 1;
const dataIt = (d) => (d ? `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}/${String(d).slice(0, 4)}` : '');

const MAX_ELENCO = 12;

/** "1 formulario", "24 formulari" */
const fir = (n) => `${n} ${Math.abs(n) === 1 ? 'formulario' : 'formulari'}`;

/** "FIR PHHY001953QZ (ordine ET26141886), 3.240 kg del 14/09/2026" */
function descriviFormulario(f) {
  const testa = f.fir ? (f.ordine ? `FIR ${f.fir} (ordine ${f.ordine})` : `FIR ${f.fir}`)
    : (f.ordine ? `ordine ${f.ordine}, senza numero di formulario` : 'formulario senza numero');
  return `${testa}, ${formatoKg(f.kg)} kg${f.data ? ' del ' + dataIt(f.data) : ''}`;
}

/** Un elenco di formulari, troncato quando sono troppi per stare in una frase. */
function elencoFormulari(elenco) {
  const primi = elenco.slice(0, MAX_ELENCO).map(descriviFormulario).join('; ');
  return elenco.length > MAX_ELENCO ? `${primi}; e altri ${elenco.length - MAX_ELENCO}` : primi;
}

/** Uno o due formulari che spiegano esattamente lo scostamento, se ci sono. */
function formulariCheSpiegano(elenco, dn, dk) {
  const n = Math.abs(dn), kg = Math.abs(dk);
  if (!elenco || !elenco.length || n === 0 || n > 2) return null;
  if (n === 1) {
    const f = elenco.find(x => Math.abs(x.kg - kg) <= 1);
    return f ? [f] : null;
  }
  for (let i = 0; i < elenco.length; i++) {
    for (let j = i + 1; j < elenco.length; j++) {
      if (Math.abs(elenco[i].kg + elenco[j].kg - kg) <= 1) return [elenco[i], elenco[j]];
    }
  }
  return null;
}

function descriviScostamento(nomeA, a, rispettoA, b) {
  const dn = a.n - b.n, dk = Math.round(a.kg - b.kg);
  const pezzi = [];
  if (dn) pezzi.push(`${fir(Math.abs(dn))} in ${dn > 0 ? 'più' : 'meno'}`);
  if (dk) pezzi.push(`${formatoKg(Math.abs(dk))} kg in ${dk > 0 ? 'più' : 'meno'}`);
  return `${nomeA} ha ${pezzi.join(' e ')} rispetto ${rispettoA}: ${fir(a.n)} e ${formatoKg(a.kg)} kg contro ${b.n} e ${formatoKg(b.kg)}.`;
}

/**
 * Perche' le fonti non danno lo stesso numero, usando quello che il gestionale
 * sa: formulari con la fine trasporto appena fuori dalla settimana, ordini
 * annullati, pesate mancanti. Se nessuna spiegazione regge si elencano i
 * formulari della cella, che e' quello che serve per controllare a mano.
 */
function motivi(cella, dati, attese, flusso) {
  const out = [];
  const g = cella.gestionale, w = cella.winsinfo, e = cella.ecotyre;
  const attesoW = attese.includes('winsinfo'), attesoE = attese.includes('ecotyre'), attesoG = attese.includes('gestionale');
  const miei = (elenco) => (elenco || []).filter(x => x.cella === cella.chiave);

  // Con il gestionale a zero per tutta la settimana la spiegazione e' una sola,
  // scritta nella nota del flusso: non si ripete cella per cella.
  if (attesoG && flusso && flusso.gestionale_vuoto && !g) {
    out.push('Nel gestionale non c\'è nessun movimento di questo flusso in tutta la settimana: vedi la nota sopra la tabella.');
    if (w && e && !uguali(w, e)) out.push(descriviScostamento('WINSINFO', w, 'al portale', e));
    return out;
  }

  // Chi concorda con chi dice subito su quale fonte guardare.
  if (w && e && g) {
    if (uguali(w, e) && !uguali(g, e)) out.push('WINSINFO e il portale danno lo stesso numero: è il gestionale che non è allineato.');
    else if (uguali(w, g) && !uguali(e, g)) out.push('WINSINFO e il gestionale danno lo stesso numero: la riga da controllare è quella del portale, che è stata estratta in un altro momento.');
    else if (uguali(e, g) && !uguali(w, g)) out.push('Il portale e il gestionale danno lo stesso numero, e il gestionale viene dal portale: la riga da controllare è quella di WINSINFO.');
  }

  if (attesoW && attesoE) {
    if (w && e && !uguali(w, e)) {
      out.push(descriviScostamento('WINSINFO', w, 'al portale', e));
      const dn = w.n - e.n, dk = w.kg - e.kg;
      if (!dn && dk) out.push('Il numero di formulari coincide: la differenza sta tutta nella pesata di uno dei formulari della cella.');
      const annullati = miei(dati.annullati);
      const spiega = formulariCheSpiegano(annullati, dn, dk);
      if (spiega) out.push(`Coincide con ${spiega.length === 1 ? 'un ordine annullato' : 'ordini annullati'}: ${elencoFormulari(spiega)}${spiega[0].motivo ? ' — motivo: ' + spiega[0].motivo : ''}. WINSINFO lo conta ancora.`);
    }
    if (w && !e) out.push('Il carico non risulta a portale: o l\'ordine non è stato chiuso, o il formulario non è stato inserito nel portale.');
    if (e && !w) out.push('Il carico non risulta in WINSINFO: manca la registrazione del trasporto nel programma.');
  }

  if (attesoG) {
    const rif = e || w;
    if (g && rif && !uguali(g, rif)) {
      // Se il gestionale coincide con WINSINFO lo scostamento e' lo stesso di sopra: non si ripete.
      if (!(w && e && uguali(w, g))) out.push(descriviScostamento('Il gestionale', g, e ? 'al portale' : 'a WINSINFO', rif));
      const dn = g.n - rif.n, dk = g.kg - rif.kg;
      const vicini = miei(dati.vicini);
      const spiega = formulariCheSpiegano(vicini, dn, dk);
      if (spiega) {
        out.push(`Coincide con ${spiega.length === 1 ? 'il formulario' : 'i formulari'} ${elencoFormulari(spiega)}: la fine trasporto cade fuori dalla settimana, quindi le due fonti lo contano in settimane diverse.`);
      } else if (vicini.length && vicini.length <= 3) {
        out.push(`A cavallo della settimana, nella stessa cella, ${vicini.length === 1 ? 'c\'è un formulario' : 'ci sono ' + vicini.length + ' formulari'}: ${elencoFormulari(vicini)}.`);
      }
      const senzaPeso = miei(dati.senza_peso);
      if (senzaPeso.length) out.push(`Nel gestionale ${senzaPeso.length === 1 ? 'c\'è un formulario terminato senza peso effettivo' : 'ci sono formulari terminati senza peso effettivo'}: ${elencoFormulari(senzaPeso)}.`);
    }
    if (!g && (w || e)) {
      out.push('Nel gestionale questo trasporto non risulta: o il file delle movimentazioni non è ancora stato caricato, o a portale la fine trasporto cade in un\'altra settimana.');
    }
    if (g && !w && !e) {
      out.push('Il movimento è nel gestionale ma non compare nel file: la pivot è stata costruita prima che il carico fosse registrato, oppure nel file la tabella di questo flusso non c\'è.');
    }
  }

  if (g && g.formulari && g.formulari.length && out.length && !out.some(t => /FIR |ordine /.test(t))) {
    out.push(`Formulari nel gestionale per questa cella: ${elencoFormulari(g.formulari)}.`);
  }
  return out;
}

/**
 * Il verdetto di una cella rispetto alle fonti che dovrebbero contenerla.
 * Una cella che manca del tutto in una fonte e' uno scostamento come un altro:
 * quello che conta e' che i tre numeri coincidano.
 */
function verdetto(cella, attese) {
  const presenti = attese.filter(f => cella[f]);
  const mancanti = attese.filter(f => !cella[f]);
  if (!presenti.length) return 'vuota';
  if (presenti.length === 1 && presenti[0] === 'gestionale') return 'solo_gestionale';
  if (mancanti.length === 1 && mancanti[0] === 'gestionale') return 'solo_report';
  if (mancanti.length) return 'scostamento';
  const rif = cella[presenti[0]];
  return presenti.every(f => uguali(cella[f], rif)) ? 'congruente' : 'scostamento';
}

export const NOME_VERDETTO = {
  congruente: 'Congruente',
  scostamento: 'Scostamento',
  solo_report: 'Manca nel gestionale',
  solo_gestionale: 'Manca nel file',
  vuota: 'Senza dati',
};

/**
 * Confronta le tabelle lette con i movimenti del gestionale, flusso per flusso.
 *
 * @param {object} lettura    esito di normalizzaLettura
 * @param {object} gestionale per flusso: { celle, vicini, annullati, senza_peso, date_da_sistemare, totale, ultimo_caricamento }
 * @param {object} periodo    { anno, settimana, inizio, fine }
 *
 * Ogni flusso porta i formulari della settimana registrati senza una data
 * obbligatoria o con date incoerenti (date_da_sistemare): immissione, inizio e
 * fine trasporto sono obbligatorie (regola dell'utente del 22/09/2026). Non
 * cambiano il verdetto delle tre fonti, ma si dicono nel flusso e nel canale.
 */
export function confronta(lettura, gestionale, periodo) {
  const flussi = [];
  const osservazioni = [];

  const nelFileChiavi = [...new Set(lettura.tabelle.map(t => t.flusso).filter(Boolean))];
  const nelGestionaleChiavi = ORDINE_FLUSSI.filter(f => gestionale[f] && gestionale[f].totale && gestionale[f].totale.n > 0);
  const chiavi = ORDINE_FLUSSI.filter(f => nelFileChiavi.includes(f) || nelGestionaleChiavi.includes(f));

  for (const chiave of chiavi) {
    const def = FLUSSI[chiave];
    // Una tabella per fonte, o nessuna: con due non si sceglie (vedi
    // normalizzaLettura), perche' scegliere vuol dire buttarne una in silenzio.
    const delFlusso = (fonte) => lettura.tabelle.filter(t => t.flusso === chiave && t.fonte === fonte);
    const doppie = [];
    const unaSola = (fonte) => {
      const trovate = delFlusso(fonte);
      if (trovate.length === 1) return trovate[0];
      if (trovate.length > 1) doppie.push({ fonte, quante: trovate.length });
      return null;
    };
    const tab = { winsinfo: unaSola('winsinfo'), ecotyre: unaSola('ecotyre') };
    const dati = gestionale[chiave] || {};
    const confrontabile = !!def.entita;
    const nelFile = !!(tab.winsinfo || tab.ecotyre);

    const attese = [];
    if (tab.winsinfo) attese.push('winsinfo');
    if (tab.ecotyre) attese.push('ecotyre');
    if (confrontabile) attese.push('gestionale');

    // I nomi del gestionale sono il riferimento: si registrano per primi. Impianti
    // e trasportatori hanno due elenchi separati, perche' la stessa societa' puo'
    // essere l'uno e l'altro e va mostrata con il nome del ruolo che ha.
    const risImpianti = creaRisolutore();
    const risVettori = creaRisolutore();
    for (const c of (dati.celle || [])) { risImpianti.registra(c.impianto); risVettori.registra(c.trasportatore); }

    const celle = new Map();
    const chiaveCella = (impianto, trasportatore) => {
      const i = risImpianti.risolvi(impianto), t = risVettori.risolvi(trasportatore);
      return { k: i.chiave + '|' + t.chiave, i, t };
    };
    const tocca = (impianto, trasportatore) => {
      const { k, i, t } = chiaveCella(impianto, trasportatore);
      if (!celle.has(k)) {
        celle.set(k, {
          chiave: k, impianto: i.nome, trasportatore: t.nome,
          winsinfo: null, ecotyre: null, gestionale: null, nomi: {},
          ambiguo: !!(i.ambiguo || t.ambiguo), nuovo: i.modo === 'nuovo' || t.modo === 'nuovo',
        });
      }
      return celle.get(k);
    };

    for (const c of (dati.celle || [])) {
      const cella = tocca(c.impianto, c.trasportatore);
      cella.gestionale = { n: c.n, kg: c.kg, formulari: c.formulari || [] };
    }
    for (const fonte of ['ecotyre', 'winsinfo']) {
      for (const r of (tab[fonte] ? tab[fonte].righe : [])) {
        const cella = tocca(r.impianto, r.trasportatore);
        const gia = cella[fonte];
        cella[fonte] = gia ? { n: gia.n + r.n, kg: gia.kg + r.kg } : { n: r.n, kg: r.kg };
        cella.nomi[fonte] = `${r.impianto} · ${r.trasportatore}`;
      }
    }

    // I formulari di contorno si legano alla cella con lo stesso abbinamento dei nomi.
    const legati = {};
    for (const nome of ['vicini', 'annullati', 'senza_peso']) {
      legati[nome] = (dati[nome] || []).map(f => ({ ...f, cella: chiaveCella(f.impianto, f.trasportatore).k }));
    }

    const statoFlusso = { gestionale_vuoto: confrontabile && (!dati.totale || dati.totale.n === 0) };
    const elenco = [...celle.values()].map(c => {
      const cella = { ...c, verdetto: verdetto(c, attese) };
      cella.motivi = cella.verdetto === 'congruente' ? [] : motivi(cella, legati, attese, statoFlusso);
      if (cella.verdetto === 'congruente' && (c.ambiguo || c.nuovo)) {
        cella.osservazione = c.ambiguo
          ? 'Il nome scritto sul file somiglia a più di un soggetto del gestionale: l\'abbinamento è da confermare.'
          : 'In questa settimana il gestionale non ha movimenti di questo soggetto con questo nome.';
      }
      return cella;
    });
    elenco.sort((a, b) => (a.impianto || '').localeCompare(b.impianto || '', 'it') || (a.trasportatore || '').localeCompare(b.trasportatore || '', 'it'));

    const totali = {
      winsinfo: tab.winsinfo ? { ...tab.winsinfo.somma } : null,
      ecotyre: tab.ecotyre ? { ...tab.ecotyre.somma } : null,
      gestionale: confrontabile ? (dati.totale || zero()) : null,
    };

    const note = [];
    if (!confrontabile) {
      note.push('Il gestionale non registra questo flusso: il confronto si limita a WINSINFO e al portale.');
    } else if (!nelFile && !doppie.length) {
      // Con le doppie le tabelle ci sono eccome: e' che non si sa quale sia questo
      // flusso, e lo dice la nota apposta. Dire "non c'e' nessuna tabella" sarebbe falso.
      note.push(`Nel file non c'è nessuna tabella di questo flusso, mentre il gestionale ha ${fir(totali.gestionale.n)} per ${formatoKg(totali.gestionale.kg)} kg nella settimana.`);
    } else if (totali.gestionale.n === 0) {
      note.push(`Nel gestionale non risulta nessun movimento di questo flusso nella settimana: o il file delle ${def.nota_file} non è ancora stato caricato, o a portale quei formulari cadono in un'altra settimana.`);
    }
    if (confrontabile && nelFile && dati.ultimo_caricamento && dati.ultimo_caricamento.data && dati.ultimo_caricamento.data < periodo.fine) {
      note.push(`L'ultimo caricamento delle ${def.nota_file} è del ${dataIt(dati.ultimo_caricamento.data)}, prima della fine della settimana (${dataIt(periodo.fine)}): nel gestionale i movimenti successivi non ci sono ancora.`);
    }
    const mancanti = [];
    if (nelFile && !tab.winsinfo) mancanti.push('WINSINFO');
    if (nelFile && !tab.ecotyre) mancanti.push('portale Ecotyre');
    for (const m of mancanti) note.push(`Nel file manca la tabella di ${m} per questo flusso: senza le due fonti il confronto è incompleto.`);
    for (const d of doppie) note.push(`Nel file ci sono ${d.quante} tabelle di ${NOME_FONTE[d.fonte]} assegnate a questo flusso. Finché non se ne indica una sola il confronto non si fa: tenerne una a caso darebbe un numero sbagliato senza dirlo. Correggi il flusso accanto alle tabelle.`);

    const conDate = confrontabile ? (dati.date_da_sistemare || []) : [];
    flussi.push({
      chiave, titolo: def.titolo, canale: def.canale, confrontabile, nel_file: nelFile,
      // Un flusso che la stampa non copre non e' un flusso "da sistemare": le sue
      // celle non sono scostamenti, sono righe che nessuno ha ancora confrontato.
      // Contarle fra gli incongruenti faceva dire "N righe da sistemare" a un
      // canale il cui unico problema era una tabella non riconosciuta.
      fuori_stampa: confrontabile && !nelFile,
      fonti: attese, totali, celle: elenco, note, tabelle_mancanti: mancanti,
      // solo se ce ne sono: un esito salvato a posto resta identico e non si riscrive
      ...(conDate.length ? { date_da_sistemare: conDate } : {}),
      quadra: {
        winsinfo_ecotyre: totali.winsinfo && totali.ecotyre ? uguali(totali.winsinfo, totali.ecotyre) : null,
        ecotyre_gestionale: totali.ecotyre && totali.gestionale ? uguali(totali.ecotyre, totali.gestionale) : null,
        winsinfo_gestionale: totali.winsinfo && totali.gestionale ? uguali(totali.winsinfo, totali.gestionale) : null,
      },
    });
  }

  const settimanaDiscorde = !!(lettura.settimana_indicata && periodo.settimana && lettura.settimana_indicata !== periodo.settimana);
  if (settimanaDiscorde) {
    osservazioni.push(`Sul file è scritta la settimana ${lettura.settimana_indicata}, la verifica è sulla ${periodo.settimana}: scegli la settimana giusta e ripeti il confronto, perché così i numeri non sono confrontabili.`);
  }
  // Se sul file la settimana non c'e' non si dice niente: la sceglie l'utente
  // caricando la stampa nella settimana giusta, ed e' lui la fonte di quel dato
  // (parole sue, 30/09/2026: "anche se il numero della settimana non c'è nel
  // foglio che mi arriva poco importa, sarò io a caricartelo nella settimana
  // giusta"). Resta il controllo che conta: se il file DICE una settimana diversa
  // da quella aperta, i numeri non sono confrontabili e si avvisa.
  // LE TABELLE SENZA FLUSSO PORTANO I LORO NUMERI CON SÉ.
  //
  // Prima sparivano con un filter(Boolean) e restava solo "non si capisce a quale
  // flusso si riferisce". Intanto il flusso corrispondente diceva "Manca nel
  // file": due affermazioni opposte sugli stessi formulari, e l'utente in mezzo.
  // Adesso si dice che cosa si è letto, quanto fa, e che aspetta solo di essere
  // assegnato.
  for (const t of lettura.tabelle.filter(x => !x.flusso)) {
    osservazioni.push(`«${t.titolo || 'tabella senza titolo'}»${t.fonte ? ' · ' + NOME_FONTE[t.fonte] : ''}: ${fir(t.somma.n)} per ${formatoKg(t.somma.kg)} kg letti${t.quadra ? ' e quadranti con i totali stampati' : ''}, ma non ancora attribuiti a nessuno dei quattro flussi. Scegli il flusso accanto alla tabella: finché resta così questi formulari non entrano in nessun confronto.`);
  }
  for (const p of lettura.problemi) osservazioni.push(p);

  return {
    flussi, osservazioni, lettura_verificata: !!lettura.verificata,
    // I tre esiti separati viaggiano nell'esito salvato: la pagina deve poter dire
    // il motivo VERO per cui la lettura non e' confermata, invece di accusare
    // sempre la trascrizione.
    totali_quadrano: lettura.totali_quadrano !== false,
    fonti_riconosciute: lettura.fonti_riconosciute !== false,
    flussi_riconosciuti: lettura.flussi_riconosciuti !== false,
    settimana_discorde: settimanaDiscorde, periodo,
  };
}

/** I numeri di testa: quante celle quadrano, quante no, quante vanno guardate. */
export function sintesi(esito) {
  let celle = 0, congruenti = 0, incongruenti = 0, nonConfrontabili = 0, tabelleMancanti = 0;
  let fuoriStampa = 0, flussiFuoriStampa = 0;
  let osservazioni = (esito.osservazioni || []).length;
  for (const f of esito.flussi || []) {
    if (!f.confrontabile) nonConfrontabili++;
    tabelleMancanti += (f.tabelle_mancanti || []).length;
    if (f.fuori_stampa) flussiFuoriStampa++;
    for (const c of f.celle) {
      celle++;
      if (c.verdetto === 'congruente') { congruenti++; if (c.osservazione) osservazioni++; }
      // Le righe di un flusso che la stampa non copre non sono scostamenti: non
      // si sa ancora niente di loro, e chiamarle "da sistemare" e' un'accusa.
      else if (f.fuori_stampa) fuoriStampa++;
      else incongruenti++;
    }
  }
  // La quadratura e' piena solo se le tre fonti coincidono su tutto, la
  // trascrizione e' confermata dai totali stampati, la settimana e' quella
  // giusta e nel file non manca nessuna delle due tabelle attese.
  const piena = incongruenti === 0 && fuoriStampa === 0 && esito.lettura_verificata && !esito.settimana_discorde && tabelleMancanti === 0;
  return {
    celle, congruenti, incongruenti, osservazioni, non_confrontabili: nonConfrontabili,
    // le righe che la stampa non copre, dette a parte: non sono scostamenti
    ...(fuoriStampa ? { fuori_stampa: fuoriStampa, flussi_fuori_stampa: flussiFuoriStampa } : {}),
    conformita: piena ? 'piena' : 'parziale',
  };
}
