// LA SEDE OPERATIVA DI UN PUNTO DI RACCOLTA, CONTROLLATA CONTRO QUELLO CHE SI
// LEGGE IN RETE.
//
// Sul formulario deve comparire sempre la SEDE OPERATIVA del produttore - l'unita'
// locale della visura camerale o del RENTRI - non la sede legale. Il file del
// portale porta tutt'e due (sede_legale del cliente e indirizzo_pdr del punto di
// raccolta), ma non garantisce che il secondo sia aggiornato: il 06/10/2026
// EUROGOMME SRL di Lavello (PZ) risultava in «Corso Vittorio Emanuele 138», che
// e' una vecchia sede legale, mentre l'officina vera sta sulla S.S. 93 al km
// 56,400, in zona PALS. Il formulario preparato con quell'indirizzo e' sbagliato.
//
// Perche' serve guardare fuori. Quel record non ha niente che non torni: la
// coordinata e' perfino ROOFTOP, cioe' l'indirizzo esiste e si geocodifica con
// precisione - solo che e' l'indirizzo sbagliato. E il portale e' coerente con se
// stesso: su 368 punti di raccolta con ordini assegnati, l'indirizzo dell'ordine
// e quello dell'anagrafica coincidono sempre. Nessun controllo interno puo'
// accorgersene: l'unica strada e' confrontare con la realta' fuori.
//
// Come si tiene a bada una ricerca in rete. Quello che torna dalla rete e' una
// PROPOSTA, mai un dato: senza una fonte con un indirizzo internet vero l'esito
// e' «non trovato», qualunque cosa abbia risposto il modello; l'indirizzo
// confermato lo sceglie l'amministratore; e non si scrive MAI sull'entita' Pdr,
// che il caricamento successivo riscrive da zero (importPdrFile fa delete +
// import: una correzione messa li' sparirebbe col prossimo file del portale).
//
// Specchio per il browser in src/lib/sediOperative.js (prove/specchi.mjs).

// Le abbreviazioni degli indirizzi italiani, sciolte PRIMA di togliere i punti:
// «V.le Berlinguer, 34» e «Viale Berlinguer 34» sono lo stesso posto, ma se si
// togliessero prima i punti «V.LE» diventerebbe VLE e «J.KENNEDY» JKENNEDY, che
// non somiglia piu' a «J. Kennedy».
const ABBREVIAZIONI = [
  [/\bV\.?LE\b/g, 'VIALE'],
  [/\bV\.?CO\b/g, 'VICOLO'],
  [/\bC\.?SO\b/g, 'CORSO'],
  [/\bC\.?(TR?)?DA\b/g, 'CONTRADA'],
  [/\bP\.?ZZ?A\b|\bPIAZZ\b/g, 'PIAZZA'],
  [/\bSTR\.?(ADA)?\b/g, 'STRADA'],
  [/\bPROV\.?(LE|INC)?\b|\bPROVINCIALE\b/g, 'PROVINCIALE'],
  [/\bNAZ\.?(LE)?\b|\bNAZIONALE\b/g, 'NAZIONALE'],
  [/\bS\.?\s?S\.?(?=\s|$)|\bSTATALE\b/g, ' SS '],
  [/\bS\.?\s?P\.?(?=\s*\d)/g, ' SP '],
  [/\bLOC\.?(ALITA)?\b/g, 'LOCALITA'],
  [/\bFRAZ\.?(IONE)?\b/g, 'FRAZIONE'],
  [/\bZ\.?\s?I\.?(?=\s|$)/g, ' ZONA INDUSTRIALE '],
  [/\bKM\.?T?\b/g, 'KM'],
  [/\bF\.?\s?LLI\b/g, 'FRATELLI'],
  [/\bC\s?\/\s?DA\b/g, 'CONTRADA'],
  [/\bIND\.?(LE)?\b|\bINDUSTR\b/g, 'INDUSTRIALE'],
  [/\bANG\.?(OLO)?\b|\bAN\.(?=\s)/g, 'ANGOLO'],
];

// Parole che in un indirizzo non distinguono niente: due indirizzi non si
// somigliano perche' sono tutt'e due in una «via».
const GENERICHE = new Set(['VIA', 'VIALE', 'VICOLO', 'CORSO', 'CONTRADA', 'STRADA', 'PIAZZA', 'LOCALITA', 'FRAZIONE', 'SNC', 'S', 'N']);

/** Un indirizzo ridotto alla sua forma confrontabile: maiuscolo, senza punteggiatura, con le abbreviazioni sciolte. */
export function normalizzaIndirizzo(v) {
  let s = String(v == null ? '' : v).toUpperCase();
  s = s.replace(/[À-Å]/g, 'A').replace(/[È-Ë]/g, 'E').replace(/[Ì-Ï]/g, 'I').replace(/[Ò-Ö]/g, 'O').replace(/[Ù-Ü]/g, 'U');
  s = s.replace(/['`‘’]/g, ' ');
  for (const [cerca, sostituisci] of ABBREVIAZIONI) s = s.replace(cerca, sostituisci);
  s = s.replace(/[^A-Z0-9/]+/g, ' ');
  // «km 56,400» e «km 56400» sono lo stesso punto della statale: tolta la
  // punteggiatura restano due numeri attaccati, che si riuniscono.
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/\bKM (\d+) (\d{3})\b/g, 'KM $1$2');
  return s;
}

/** Le parole che distinguono un indirizzo da un altro. */
export function paroleIndirizzo(v) {
  return normalizzaIndirizzo(v).split(' ').filter(p => p && !GENERICHE.has(p));
}

/** Il numero civico scritto in fondo, se c'e': «VIA ROMA 111» -> «111», «VIA X SNC» -> «SNC». */
export function numeroCivico(v) {
  const parole = normalizzaIndirizzo(v).split(' ').filter(Boolean);
  for (let i = parole.length - 1; i >= 0; i--) {
    const p = parole[i];
    if (p === 'SNC') return 'SNC';
    if (/^[0-9]+(\/[0-9A-Z]+)?$/.test(p)) return p;
  }
  return '';
}

const soloCifre = (v) => String(v || '').replace(/[^0-9]/g, '');

// Due civici sono compatibili se uno e' contenuto nell'altro: 8 e 8/10 sono la
// stessa officina, 138 e 56400 no.
function civiciCompatibili(a, b) {
  if (!a || !b) return true;
  if (a === b) return true;
  if (a === 'SNC' || b === 'SNC') return true;
  const ca = soloCifre(a.split('/')[0]);
  const cb = soloCifre(b.split('/')[0]);
  return !!ca && ca === cb;
}

// Distanza di una lettera fra due parole: serve a non prendere per due strade
// diverse «Pinnella» e «Pinella», che sono la stessa contrada scritta a orecchio.
function aUnaLettera(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, differenze = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++differenze > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return differenze + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Due parole di un indirizzo sono la stessa parola?
 * Le insegne e gli stradari italiani abbreviano tutto: «M. Buonarroti» e
 * «Michelangelo Buonarroti», «f.Turati» e «Filippo Turati», «Zona Ind.» e «Zona
 * Industriale». Prendere per diverso quello che e' lo stesso posto riempie
 * l'elenco di allarmi finti, e gli allarmi finti fanno smettere di guardare.
 */
export function parolaUguale(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  // un'iniziale puntata: M. sta per Michelangelo
  if (a.length === 1 || b.length === 1) return a[0] === b[0];
  // un'abbreviazione: ANG per ANGOLO, IND per INDUSTRIALE
  if (a.startsWith(b) || b.startsWith(a)) return true;
  // una lettera di differenza, ma solo su parole lunghe: VIA ROMA e VIA ROSA no
  if (Math.min(a.length, b.length) >= 5 && aUnaLettera(a, b)) return true;
  return false;
}

/**
 * Due indirizzi a confronto: 'coincide' | 'incerto' | 'diverso'.
 * 'incerto' vuol dire che la via e' la stessa ma qualcosa non torna (il civico,
 * una parola in piu'): va guardato da un occhio umano, non scartato.
 */
export function confrontaIndirizzi(portale, trovato) {
  const a = normalizzaIndirizzo(portale);
  const b = normalizzaIndirizzo(trovato);
  if (!a || !b) return 'incerto';
  if (a === b) return 'coincide';
  if (a.includes(b) || b.includes(a)) return 'coincide';

  const pa = paroleIndirizzo(portale).filter(p => !/^[0-9]/.test(p));
  const pb = paroleIndirizzo(trovato).filter(p => !/^[0-9]/.test(p));
  if (!pa.length || !pb.length) return 'incerto';
  const comuni = pa.filter(p => pb.some(q => parolaUguale(p, q)));
  if (!comuni.length) return 'diverso';

  const tutteDiUno = comuni.length === pa.length || comuni.length === pb.length;
  if (tutteDiUno) return civiciCompatibili(numeroCivico(portale), numeroCivico(trovato)) ? 'coincide' : 'incerto';
  // Qualche parola in comune ma non tutte: meta' strada, la guarda una persona.
  return comuni.length * 2 >= Math.min(pa.length, pb.length) ? 'incerto' : 'diverso';
}

/** Comune uguale, a meno di maiuscole, accenti e punteggiatura. */
export function stessoComune(a, b) {
  const na = normalizzaIndirizzo(a);
  const nb = normalizzaIndirizzo(b);
  if (!na || !nb) return true;
  return na === nb;
}

/** Una fonte vale solo se e' un indirizzo internet vero. */
export function fontiValide(fonti) {
  return (Array.isArray(fonti) ? fonti : [])
    .map(f => String(f == null ? '' : (typeof f === 'object' ? (f.url || f.fonte || '') : f)).trim())
    .filter(f => /^https?:\/\/[^\s]+\.[^\s]+/i.test(f))
    .filter((f, i, tutte) => tutte.indexOf(f) === i)
    .slice(0, 6);
}

/**
 * L'esito di una verifica, a partire da quello che ha risposto la ricerca.
 * Qui si fa l'unica cosa che conta davvero: senza una fonte vera non si scrive
 * nessun indirizzo, e l'esito e' «non trovato». Un modello che risponde senza
 * citare niente non e' una fonte: e' un'opinione.
 */
export function esitoVerifica({ portale = {}, risposta = {} }) {
  const fonti = fontiValide(risposta.fonti);
  const indirizzoTrovato = String(risposta.indirizzo || '').trim();
  const comuneTrovato = String(risposta.comune || '').trim();
  const base = {
    indirizzo_trovato: '', cap_trovato: '', comune_trovato: '', provincia_trovato: '',
    altre_sedi: String(risposta.altre_sedi || '').slice(0, 1000),
    fonti, spiegazione: String(risposta.spiegazione || '').slice(0, 1000),
    citazione: String(risposta.citazione || '').slice(0, 500),
    ricerche_fatte: String(risposta.ricerche_fatte || '').slice(0, 500),
  };
  if (!indirizzoTrovato || !fonti.length) {
    return {
      ...base,
      esito: 'non_trovato',
      confidenza: 'bassa',
      spiegazione: base.spiegazione || (indirizzoTrovato && !fonti.length
        ? 'La ricerca ha proposto un indirizzo senza citare una fonte consultabile: non si tiene.'
        : 'La ricerca non ha trovato una sede operativa di questo soggetto.'),
    };
  }

  const confidenzaDetta = ['alta', 'media', 'bassa'].includes(String(risposta.confidenza)) ? String(risposta.confidenza) : 'media';
  // Una fonte sola non fa una certezza.
  let confidenza = fonti.length === 1 && confidenzaDetta === 'alta' ? 'media' : confidenzaDetta;
  // L'ECO. Il rischio di una ricerca a cui si e' dato gia' l'indirizzo e' che lo
  // ripeta: «confermo quello che mi hai detto». Quando l'indirizzo trovato e'
  // identico a quello che gli abbiamo passato e non c'e' la riga della fonte in
  // cui l'ha letto, la conferma vale poco e lo si dice.
  const eco = !base.citazione && confrontaIndirizzi(portale.indirizzo, indirizzoTrovato) === 'coincide';
  if (eco) confidenza = 'bassa';

  const trovato = {
    ...base,
    indirizzo_trovato: indirizzoTrovato.slice(0, 300),
    cap_trovato: String(risposta.cap || '').trim().slice(0, 10),
    comune_trovato: comuneTrovato.slice(0, 120),
    provincia_trovato: String(risposta.provincia || '').trim().toUpperCase().slice(0, 2),
    confidenza,
    spiegazione: eco
      ? (base.spiegazione + ' (La ricerca ripete l\'indirizzo che le abbiamo dato senza mostrare la riga in cui l\'ha letto: la conferma vale poco.)').trim()
      : base.spiegazione,
  };

  if (comuneTrovato && !stessoComune(portale.comune, comuneTrovato)) {
    return { ...trovato, esito: 'diverso' };
  }
  return { ...trovato, esito: confrontaIndirizzi(portale.indirizzo, indirizzoTrovato) };
}

/**
 * CHI E' IL SOGGETTO DI UN PUNTO DI RACCOLTA.
 *
 * Il caricamento del file cancella tutti i punti di raccolta e li riscrive: gli
 * id della piattaforma cambiano, e l'unica chiave che sopravvive e' id_pdr, il
 * numero del portale. Ma id_pdr dice QUALE POSTO, non CHI: un gommista che
 * chiude e si re-iscrive prende un id_pdr nuovo, e niente vieta che un numero
 * torni un giorno su un altro soggetto. Negli stessi dati del 06/10/2026 ci sono
 * 181 partite IVA con piu' di un punto e 33 che cambiano anche ragione sociale
 * (LONGO FRANCESCO & FIGLI SNC a Lamezia, id 308, e Longo Pneumatici Snc a
 * Catanzaro, id 39180).
 *
 * Percio' una verifica vale finche' il punto e' dello stesso soggetto: la
 * partita IVA se c'e', altrimenti ragione sociale e comune. Un controllo vecchio
 * attaccato a un soggetto nuovo manderebbe sul formulario l'indirizzo di
 * qualcun altro, ed e' il modo piu' silenzioso di sbagliare.
 */
export function chiaveSoggetto(r) {
  if (!r) return '';
  // «IT 01234567 891» e «01234567891» sono la stessa partita IVA; «Eurogomme
  // S.r.l.» e «EUROGOMME SRL» lo stesso nome. Qui si toglie tutto cio' che non e'
  // una lettera o una cifra, spazi compresi: per dire se due scritte parlano
  // dello stesso soggetto non serve altro.
  const piva = String(r.partita_iva || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^IT/, '');
  if (piva.length >= 8) return 'PIVA:' + piva;
  const nome = normalizzaSoggetto(r.ragione_sociale || r.descrizione_pdr);
  const comune = normalizzaSoggetto(r.comune_pdr || r.comune_portale || r.comune);
  return nome ? 'NOME:' + nome + '|' + comune : '';
}

/**
 * TUTTE le chiavi con cui si puo' riconoscere un soggetto, non solo la migliore.
 * Serve a ritrovarlo fra fonti che portano dati diversi: l'anagrafica dei punti
 * di raccolta ha la partita IVA, un ordine assegnato no, ma tutt'e due hanno
 * nome e comune. Si usa per RITROVARE (una decisione presa altrove), mai per
 * decidere se due record sono la stessa azienda: li' vale chiaveSoggetto, che
 * sulla partita IVA non transige.
 */
export function chiaviSoggetto(r) {
  if (!r) return [];
  const chiavi = [];
  const piva = String(r.partita_iva || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^IT/, '');
  if (piva.length >= 8) chiavi.push('PIVA:' + piva);
  const nome = normalizzaSoggetto(r.ragione_sociale || r.descrizione_pdr);
  const comune = normalizzaSoggetto(r.comune_pdr || r.comune_portale || r.comune);
  if (nome) chiavi.push('NOME:' + nome + '|' + comune);
  return chiavi;
}

/**
 * L'ultima sede DECISA di ogni soggetto, da qualunque punto di raccolta venga.
 * Quando un gommista si re-iscrive, il portale gli da' un id_pdr nuovo e il
 * punto risulta mai controllato: senza questo, la sede che avevi gia' deciso non
 * la ritroverebbe nessuno finche' non si rifa' il controllo.
 */
export function indicePerSoggetto(verifiche) {
  const per = new Map();
  for (const v of verifiche || []) {
    if (!v || (v.stato !== 'corretto' && v.stato !== 'confermato_portale')) continue;
    for (const k of chiaviSoggetto(v)) {
      const gia = per.get(k);
      if (!gia || giorno(v.deciso_il || v.verificato_il) > giorno(gia.deciso_il || gia.verificato_il)) per.set(k, v);
    }
  }
  return per;
}

/** Un nome ridotto a lettere e cifre: «Eurogomme S.r.l.» -> EUROGOMMESRL. */
export function normalizzaSoggetto(v) {
  return String(v == null ? '' : v).toUpperCase()
    .replace(/[À-Å]/g, 'A').replace(/[È-Ë]/g, 'E').replace(/[Ì-Ï]/g, 'I').replace(/[Ò-Ö]/g, 'O').replace(/[Ù-Ü]/g, 'U')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * La verifica vale ancora per questo punto di raccolta?
 * Quando non si riesce a dire chi sia il soggetto (niente partita IVA e niente
 * nome) non si invalida niente: si sa di non sapere, e un dubbio non e' una prova.
 */
export function verificaApplicabile(verifica, pdrRecord) {
  if (!verifica) return { vale: false, motivo: 'mai controllato' };
  if (!pdrRecord) return { vale: true, motivo: '' };
  const a = chiaveSoggetto(verifica);
  const b = chiaveSoggetto(pdrRecord);
  if (!a || !b || a === b) return { vale: true, motivo: '' };
  return { vale: false, motivo: 'il punto di raccolta e\' passato a un altro soggetto dopo l\'ultimo controllo' };
}

/**
 * La sede gia' decisa per lo STESSO soggetto su un altro punto di raccolta: serve
 * quando un gommista si re-iscrive e il portale gli da' un numero nuovo. Non si
 * applica da sola - e' un altro luogo, e potrebbe essere un'altra officina - ma
 * si scrive accanto al controllo nuovo, cosi' chi decide sa che era gia' stato
 * deciso una volta.
 */
export function decisioneDiAltroPunto(pdrRecord, verifiche) {
  const chiave = chiaveSoggetto(pdrRecord);
  if (!chiave || !pdrRecord) return null;
  let migliore = null;
  for (const v of verifiche || []) {
    if (!v || Number(v.id_pdr) === Number(pdrRecord.id_pdr)) continue;
    if (v.stato !== 'corretto' && v.stato !== 'confermato_portale') continue;
    if (chiaveSoggetto(v) !== chiave) continue;
    if (!migliore || giorno(v.deciso_il || v.verificato_il) > giorno(migliore.deciso_il || migliore.verificato_il)) migliore = v;
  }
  return migliore;
}

const giorno = (v) => String(v == null ? '' : v).slice(0, 10);

function giorniFra(da, a) {
  const d1 = Date.parse(giorno(da) + 'T00:00:00Z');
  const d2 = Date.parse(giorno(a) + 'T00:00:00Z');
  if (isNaN(d1) || isNaN(d2)) return Infinity;
  return Math.round((d2 - d1) / 86400000);
}

/** L'ultima verifica di ogni punto di raccolta (quella non superata, o la piu' recente). */
export function ultimaVerificaPerPdr(verifiche) {
  const per = new Map();
  for (const v of verifiche || []) {
    if (v == null || v.id_pdr == null) continue;
    const k = Number(v.id_pdr);
    const prec = per.get(k);
    if (!prec) { per.set(k, v); continue; }
    if (giorno(v.verificato_il) >= giorno(prec.verificato_il)) per.set(k, v);
  }
  return per;
}

/**
 * CHI SI CONTROLLA, E PERCHE' NON TUTTI. I punti di raccolta sono piu' di
 * tremila, ma il formulario si prepara solo per quelli che hanno un ritiro:
 * nell'anno in corso sono poche centinaia. Si controllano quelli, e di quelli
 * solo chi non e' mai stato controllato, chi ha cambiato indirizzo a portale dopo
 * l'ultimo controllo, e chi e' stato controllato troppo tempo fa.
 *
 * @returns [{ pdr, motivo }] in ordine di urgenza, al massimo `limite`.
 */
export function daVerificare({ pdr = [], idPdrConOrdini = [], verifiche = [], oggi = '', giorniValidita = 180, limite = 25, soloMaiVisti = false }) {
  const serve = new Set((idPdrConOrdini || []).map(Number).filter(n => !isNaN(n)));
  const ultime = ultimaVerificaPerPdr(verifiche);
  const scelti = [];
  for (const p of pdr) {
    if (p == null || p.id_pdr == null) continue;
    if (!serve.has(Number(p.id_pdr))) continue;
    // Un punto di raccolta sospeso non riceve ritiri: non ci si fa un formulario.
    if (String(p.sospeso || '').trim()) continue;
    const u = ultime.get(Number(p.id_pdr));
    if (!u) { scelti.push({ pdr: p, motivo: 'mai controllato', priorita: 0 }); continue; }
    // Un punto che adesso e' di un altro soggetto va ricontrollato subito: il
    // controllo vecchio parla di un'altra azienda.
    const applicabile = verificaApplicabile(u, p);
    if (!applicabile.vale) { scelti.push({ pdr: p, motivo: applicabile.motivo, priorita: 0 }); continue; }
    if (soloMaiVisti) continue;
    if (normalizzaIndirizzo(u.indirizzo_portale) !== normalizzaIndirizzo(p.indirizzo_pdr)) {
      scelti.push({ pdr: p, motivo: 'a portale l\'indirizzo e\' cambiato dopo l\'ultimo controllo', priorita: 1 });
      continue;
    }
    if (giorniFra(u.verificato_il, oggi) > giorniValidita) {
      scelti.push({ pdr: p, motivo: `controllato piu' di ${giorniValidita} giorni fa`, priorita: 2 });
    }
  }
  scelti.sort((a, b) => a.priorita - b.priorita || String(a.pdr.ragione_sociale || '').localeCompare(String(b.pdr.ragione_sociale || '')));
  return scelti.slice(0, Math.max(0, Number(limite) || 0)).map(({ pdr: p, motivo }) => ({ pdr: p, motivo }));
}

/**
 * LA DECISIONE GIA' PRESA NON SI BUTTA VIA. Se l'amministratore aveva gia' detto
 * quale indirizzo va sul formulario e da allora non e' cambiato niente - ne' il
 * portale ne' quello che si trova in rete - la decisione si riporta sulla
 * verifica nuova. Se invece qualcosa e' cambiato, torna da decidere, con scritto
 * il perche': una decisione presa su dati diversi non vale piu'.
 */
export function riportaDecisione(nuova, precedente) {
  const vuota = { stato: 'da_decidere', indirizzo_per_formulario: '', cap_per_formulario: '', comune_per_formulario: '', provincia_per_formulario: '', deciso_il: '', deciso_da: '', nota: '' };
  if (!precedente || !['confermato_portale', 'corretto', 'ignorato'].includes(String(precedente.stato))) return vuota;
  const portaleUguale = normalizzaIndirizzo(precedente.indirizzo_portale) === normalizzaIndirizzo(nuova.indirizzo_portale);
  const reteUguale = normalizzaIndirizzo(precedente.indirizzo_trovato) === normalizzaIndirizzo(nuova.indirizzo_trovato);
  if (portaleUguale && reteUguale) {
    return {
      stato: precedente.stato,
      indirizzo_per_formulario: precedente.indirizzo_per_formulario || '',
      cap_per_formulario: precedente.cap_per_formulario || '',
      comune_per_formulario: precedente.comune_per_formulario || '',
      provincia_per_formulario: precedente.provincia_per_formulario || '',
      deciso_il: precedente.deciso_il || '',
      deciso_da: precedente.deciso_da || '',
      nota: precedente.nota || '',
    };
  }
  const motivo = !portaleUguale
    ? 'A portale l\'indirizzo e\' cambiato dopo la decisione precedente: va deciso di nuovo.'
    : 'In rete adesso risulta un indirizzo diverso da quello su cui era stata presa la decisione: va deciso di nuovo.';
  return { ...vuota, nota: motivo };
}

/** L'indirizzo che va scritto sul formulario, con il motivo di quella scelta. */
export function indirizzoPerFormulario(pdrRecord, verifica) {
  const portale = {
    indirizzo: String((pdrRecord && pdrRecord.indirizzo_pdr) || ''),
    cap: String((pdrRecord && pdrRecord.cap_pdr) || ''),
    comune: String((pdrRecord && pdrRecord.comune_pdr) || ''),
    provincia: String((pdrRecord && pdrRecord.provincia_pdr) || ''),
    origine: 'portale',
    nota: 'Indirizzo del punto di raccolta come lo riporta il portale.',
  };
  if (!verifica) return portale;
  // Se il punto e' passato a un altro soggetto, il controllo precedente non vale
  // piu': l'indirizzo confermato era di qualcun altro.
  const applicabile = verificaApplicabile(verifica, pdrRecord);
  if (!applicabile.vale) {
    return { ...portale, origine: 'portale_soggetto_cambiato', nota: `Il controllo precedente era intestato a ${verifica.ragione_sociale || 'un altro soggetto'}: non vale piu' per questo punto, che va ricontrollato.` };
  }
  if (verifica.stato === 'corretto' && String(verifica.indirizzo_per_formulario || '').trim()) {
    return {
      indirizzo: verifica.indirizzo_per_formulario,
      cap: verifica.cap_per_formulario || '',
      comune: verifica.comune_per_formulario || '',
      provincia: verifica.provincia_per_formulario || '',
      origine: 'confermato',
      nota: `Sede operativa confermata il ${giorno(verifica.deciso_il) || giorno(verifica.verificato_il)}${verifica.deciso_da ? ' da ' + verifica.deciso_da : ''}.`,
    };
  }
  if (verifica.stato === 'confermato_portale') {
    return { ...portale, origine: 'portale_confermato', nota: `Indirizzo del portale, controllato e confermato il ${giorno(verifica.deciso_il) || giorno(verifica.verificato_il)}.` };
  }
  if (verifica.esito === 'diverso' || verifica.esito === 'incerto') {
    return { ...portale, origine: 'portale_da_controllare', nota: 'Attenzione: in rete risulta una sede operativa diversa, e nessuno ha ancora deciso quale vale.' };
  }
  return portale;
}
