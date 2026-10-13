// LA STORIA DI UNA RIGA DEL RIEPILOGO DELLE DICHIARAZIONI (12/10/2026).
//
// Il fatto vero. L'utente apre il riepilogo di T-CYCLE INDUSTRIES SRL e non
// capisce due cose: a marzo si sono dichiarati come usciti su nave 146.860 kg,
// cioe' gennaio e febbraio, «ma risulta nulla in giacenza»; e a marzo
// «risultano 20.620 kg che mancano dai conteggi». Pensava che quei 20.620 kg
// fossero la parte dei conferimenti finita nello STOCCAGGIO di T-Cycle, che fino
// a maggio ha ricevuto i PFU in due modi. Non e' cosi', e lo dice il report del
// portale ordine per ordine: la dichiarazione caricata il 03/04 ha agganciato
// gennaio 87.740 + febbraio 36.420 + 22.700 di marzo, quella del 26/06 i 20.620
// rimasti di marzo + aprile + maggio + 77.600 di giugno. I 20.620 kg sono la
// parte di marzo, arrivata in IMPIANTO, che la dichiarazione di marzo non ha
// coperto; lo stoccaggio (249,06 t) non e' mai entrato nella riga dell'impianto:
// e' ripartito tutto verso Tecnogum.
//
// Le parole dell'utente: «rendi visibile il quadro della situazione anche a chi,
// diversamente da me, vede per la prima volta questo gestionale e deve
// comprenderne la storia, le movimentazioni e i perche' sottesi». Qui ci sono le
// regole che scrivono quel quadro dai numeri, mai a mano:
// - la GIACENZA A FINE MESE: tutto quello che e' entrato (la casella dall'anno
//   prima compresa) meno quello che le dichiarazioni caricate hanno coperto,
//   nella colonna in cui la pagina mette la dichiarazione. L'ultimo mese e' la
//   giacenza di oggi, il «Da dichiarare» della riga e il numero delle Giacenze
//   (per l'ACI, che ha due righe, le righe insieme: il canale si chiude sul
//   canale, giacenzaAFineMeseDelCanale, revisione del 13/10/2026);
// - gli AGGANCI di ogni dichiarazione caricata, letti dal report del portale:
//   quali mesi ha coperto e per quanto, e chi ha coperto ogni mese;
// - il RACCONTO della riga, poche frasi in italiano piano.
//
// Sono righe informative: non entrano nel conferito, nel «Caricato», nel «Da
// dichiarare» ne' nei totali, e non cambiano nessun numero dei conti. Le chiama
// riepilogoDichiarazioni, che ha gia' in mano tutto: qui non si legge niente.
import { MESI } from "./dichiarazioniImpianti.ts";
import { formatoTonnellate } from "./formato.ts";
import { allineaAllaGiacenza, chiudiFraIFlussi } from "./usciteDichiarate.ts";

const kgInt = (v) => Math.round(Number(v) || 0);
const t = (kg) => `${formatoTonnellate(kgInt(kg) / 1000)} t`;
const meseDetto = (i) => String(MESI[i] || '').toLowerCase();
const giornoIt = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '');
// «il 03/04/2026», ma «l'11/03/2026», «l'8/...», «l'1/...»: come si dice.
const ilGiorno = (g) => {
  const d = Number(String(g || '').slice(8, 10));
  return `${[1, 8, 11].includes(d) ? "l'" : 'il '}${giornoIt(g)}`;
};
const elenco = (xs) => {
  const v = (xs || []).filter(Boolean);
  if (v.length <= 1) return v[0] || '';
  return `${v.slice(0, -1).join(', ')} e ${v[v.length - 1]}`;
};
// Il punto in fondo, ma uno solo: «da Irigom S.r.l.» non prende un secondo punto.
const chiudi = (frase) => (/\.$/.test(frase) ? frase : `${frase}.`);
const giorniDetti = (gs) => (gs.length === 1 ? ilGiorno(gs[0]) : `in ${gs.length === 2 ? 'due' : gs.length} volte, ${elenco(gs.map(ilGiorno))}`);
const giornoInNumero = (g) => Date.UTC(+String(g).slice(0, 4), +String(g).slice(5, 7) - 1, +String(g).slice(8, 10));
const distanzaGiorni = (a, b) => Math.round(Math.abs(giornoInNumero(a) - giornoInNumero(b)) / 86400000);

/**
 * QUANTO RESTA ALLA FINE DI OGNI MESE.
 *
 * `partenzaKg` e' la casella dall'anno prima (l'apertura netta), `conferito` e
 * `caricato` i dodici mesi della riga: il caricato sta nella colonna in cui la
 * pagina mette la dichiarazione (per un R1 il mese della nave). Dopo
 * `ultimoMese` (il mese di oggi, per l'anno in corso) non c'e' ancora una fine
 * mese: null, non zero.
 */
export function giacenzaAFineMese({ partenzaKg = 0, conferito = [], caricato = [], ultimoMese = 11 } = {}) {
  let g = kgInt(partenzaKg);
  return MESI.map((_, i) => {
    g += kgInt(conferito[i]) - kgInt(caricato[i]);
    return i <= ultimoMese ? g : null;
  });
}

/**
 * LA GIACENZA A FINE MESE DI UN CANALE CON PIU' RIGHE (revisione del 13/10/2026).
 *
 * L'ACI di un impianto ha due righe, primaria e secondaria, e il «Da
 * dichiarare» di ognuna si chiude sul canale (chiudiFraIFlussi): se la
 * dichiarazione di una riga supera quello che su quella riga e' arrivato,
 * l'eccesso esce dal carico piu' vecchio dell'altra. La giacenza a fine mese,
 * contata riga per riga, questo non lo sapeva. Gatim ACI d'aprile scritta 10.000
 * kg in primaria e 12.540 in secondaria invece di 8.200 e 14.340 (lo stesso
 * totale): la colonna diceva 0 su tutte e due le righe, la riga nuova -1.800 e
 * +1.800 fino a ottobre, e il perche' del numero «A fine aprile: -1,80 t in
 * giacenza».
 *
 * Ora ogni fine mese si chiude sul canale con la stessa regola del «Da
 * dichiarare», sui conti fino a quel mese: per ogni riga allineaAllaGiacenza
 * come la fa riepilogoDichiarazioni su una riga senza report (ACI ed extra
 * raccolta), poi chiudiFraIFlussi. Nessuna riga va sotto zero finche' non ci va
 * il canale; il canale non cambia di un chilo (la chiusura sposta, non toglie);
 * l'ultimo mese, dove i conti fino a quel mese sono tutti i conti, torna al
 * chilo col «Da dichiarare» della riga. Una giacenza del canale sotto zero
 * resta sotto zero, sulla riga che l'ha fatta: e' un errore da correggere e si
 * dice. Con una riga sola e' giacenzaAFineMese, numero per numero.
 *
 * @param righe  [{ partenzaKg, conferito: kg[12], caricato: kg[12] }], nell'ordine delle righe
 * @returns {{ fine: (kg|null)[12][], spostato: kg[12][] }} per ogni riga la
 *   giacenza a fine mese (null dopo `ultimoMese`) e quanto la chiusura sul canale
 *   le ha aggiunto (+, l'eccesso delle sue dichiarazioni uscito da un'altra riga)
 *   o tolto (-, un suo carico uscito con la dichiarazione di un'altra riga).
 */
export function giacenzaAFineMeseDelCanale(righe, { ultimoMese = 11 } = {}) {
  const elenco = righe || [];
  const grezze = elenco.map(r => giacenzaAFineMese({ ...r, ultimoMese: 11 }));
  const fine = grezze.map(g => g.map((x, i) => (i <= ultimoMese ? x : null)));
  const spostato = grezze.map(() => MESI.map(() => 0));
  if (elenco.length < 2) return { fine, spostato };
  for (let p = 0; p <= Math.min(ultimoMese, 11); p++) {
    const allineati = elenco.map((r, k) => {
      const conferito = MESI.map((_, i) => (i <= p ? kgInt(r.conferito && r.conferito[i]) : 0));
      const caricato = MESI.map((_, i) => (i <= p ? kgInt(r.caricato && r.caricato[i]) : 0));
      return allineaAllaGiacenza(conferito, conferito.map((c, i) => Math.min(c, caricato[i])), grezze[k][p], { conferito: kgInt(r.partenzaKg), uscito: 0 });
    });
    chiudiFraIFlussi(allineati).forEach((a, k) => {
      // Quello che resta, meno quello che nemmeno le altre righe hanno assorbito.
      const v = a.resta.reduce((s, x) => s + x, 0) + a.prima.resta - a.non_allocato_kg;
      spostato[k][p] = v - grezze[k][p];
      fine[k][p] = v;
    });
  }
  return { fine, spostato };
}

/**
 * LA COPERTURA DI UNA COLONNA NEL FORMATO DI `copre` (revisione del 13/10/2026).
 *
 * `copre` era copertureDelCaricamento, un giorno solo: per la dichiarazione di
 * febbraio di Irigom, presa dal portale in due giorni, diceva 174.400 kg nella
 * tendina della casella, nel dialogo e nella scheda Impianti, mentre la «i»
 * diceva 721.660. Ora viene dallo stesso abbinamento di `dichiarazione_copre`
 * (abbinaCaricamenti): la stessa dichiarazione ha una copertura sola. Il formato
 * resta quello di prima - «dall'anno prima» in testa ai mesi, `giorno` l'ultimo
 * giorno del caricamento - con in piu' `giorni`, tutti.
 */
export function copreDellaColonna(c) {
  if (!c || !Array.isArray(c.giorni) || !c.giorni.length) return null;
  const prima = kgInt(c.prima_kg);
  return {
    giorno: c.giorni[c.giorni.length - 1],
    giorni: [...c.giorni],
    kg: kgInt(c.kg),
    prima_kg: prima,
    mesi: [
      ...(prima > 0 ? [{ mese: "dall'anno prima", kg: prima }] : []),
      ...(c.mesi || []).map(x => ({ mese: x.mese, kg: kgInt(x.kg) })),
    ],
  };
}

// Il sottoinsieme piu' piccolo (e piu' vicino di giorni) che fa `quanto` entro la
// tolleranza. Sono pochi caricamenti per volta: si provano tutti.
function sottoinsieme(candidati, quanto, tolleranzaKg) {
  let migliore = null;
  const n = Math.min(candidati.length, 10);
  for (let m = 1; m < (1 << n); m++) {
    const scelti = candidati.filter((_, i) => m & (1 << i));
    const somma = scelti.reduce((s, c) => s + c.kg, 0);
    if (Math.abs(somma - quanto) > tolleranzaKg) continue;
    const lontananza = scelti.reduce((s, c) => s + c.distanza, 0);
    if (!migliore || scelti.length < migliore.scelti.length || (scelti.length === migliore.scelti.length && lontananza < migliore.lontananza)) {
      migliore = { scelti, lontananza };
    }
  }
  return migliore ? migliore.scelti : null;
}

/**
 * QUALE CARICAMENTO DEL REPORT E' QUALE NOSTRA DICHIARAZIONE.
 *
 * Il report del portale ha una riga per ordine col giorno del caricamento: i
 * caricamenti di un impianto (raccoglitoreUscite) sono per giorno. Una nostra
 * dichiarazione si riconosce dal giorno del caricamento (caricata_il), e quando
 * il peso di quel giorno non basta si cercano i giorni accanto, entro tre: la
 * dichiarazione di febbraio di Irigom (721.660 kg, caricata il 12/03/2026) il
 * portale l'ha presa in due giorni, 547.260 kg l'11/03 e 174.400 il 12/03.
 * copertureDelCaricamento, che guarda un giorno solo, ne vedeva un quarto.
 * Senza nessun riscontro si tace: meglio dire «il report non la conosce
 * ancora» che raccontare un aggancio inventato. Due nostre dichiarazioni
 * caricate lo stesso giorno condividono il caricamento: si dicono insieme.
 *
 * @param caricamenti  [{ giorno, kg, mesi: kg[12], prima_kg }] (uscite.per(ns).caricamenti)
 * @param dichiarazioni [{ idx, giorno, kg }]: i mesi della riga con un caricato
 * @returns {{ per: Map<idx, { giorni, kg, prima_kg, mesi, parziale, insieme }>, usati: Set<giorno> }}
 */
export function abbinaCaricamenti(caricamenti, dichiarazioni, { tolleranzaKg = 2, giorniVicini = 3 } = {}) {
  const tutti = (caricamenti || []).filter(c => c && c.giorno).map(c => ({ ...c, kg: kgInt(c.kg) }));
  const usati = new Set();
  const gruppi = new Map(); // giorno -> [{ idx, kg }]
  const senzaGiorno = [];
  for (const d of dichiarazioni || []) {
    if (!(kgInt(d.kg) > 0)) continue;
    if (!d.giorno) { senzaGiorno.push(d); continue; }
    if (!gruppi.has(d.giorno)) gruppi.set(d.giorno, []);
    gruppi.get(d.giorno).push({ idx: d.idx, kg: kgInt(d.kg) });
  }
  const per = new Map();
  const assegna = (ds, scelti, quanto) => {
    for (const c of scelti) usati.add(c.giorno);
    const kg = scelti.reduce((s, c) => s + c.kg, 0);
    const copertura = {
      giorni: [...new Set(scelti.map(c => c.giorno))].sort(),
      kg,
      prima_kg: scelti.reduce((s, c) => s + kgInt(c.prima_kg), 0),
      mesi: MESI.map((_, i) => scelti.reduce((s, c) => s + kgInt(c.mesi && c.mesi[i]), 0)),
      // Il report aggancia un peso diverso da quello caricato: si dice quanto.
      parziale: Math.abs(kg - quanto) > tolleranzaKg,
      insieme: ds.length > 1 ? ds.map(x => x.idx) : null,
    };
    for (const d of ds) per.set(d.idx, copertura);
  };
  for (const [giorno, ds] of [...gruppi.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const quanto = ds.reduce((s, d) => s + d.kg, 0);
    const liberi = tutti.filter(c => !usati.has(c.giorno));
    const stesso = liberi.filter(c => c.giorno === giorno);
    const sommaStesso = stesso.reduce((s, c) => s + c.kg, 0);
    if (stesso.length && Math.abs(sommaStesso - quanto) <= tolleranzaKg) { assegna(ds, stesso, quanto); continue; }
    const vicini = liberi
      .filter(c => c.giorno !== giorno && distanzaGiorni(c.giorno, giorno) <= giorniVicini)
      .map(c => ({ ...c, distanza: distanzaGiorni(c.giorno, giorno) }))
      .sort((a, b) => a.distanza - b.distanza || a.giorno.localeCompare(b.giorno));
    const aggiunti = sottoinsieme(vicini, quanto - sommaStesso, tolleranzaKg);
    if (aggiunti) { assegna(ds, [...stesso, ...aggiunti], quanto); continue; }
    if (stesso.length) { assegna(ds, stesso, quanto); continue; }
    // Il ripiego di sempre: un solo caricamento, di qualunque giorno, con lo
    // stesso peso al chilo.
    const pari = liberi.filter(c => Math.abs(c.kg - quanto) <= tolleranzaKg);
    if (pari.length === 1) assegna(ds, pari, quanto);
  }
  for (const d of senzaGiorno) {
    const pari = tutti.filter(c => !usati.has(c.giorno) && Math.abs(c.kg - kgInt(d.kg)) <= tolleranzaKg);
    if (pari.length === 1) assegna([{ idx: d.idx, kg: kgInt(d.kg) }], pari, kgInt(d.kg));
  }
  return { per, usati };
}

/**
 * GLI AGGANCI DI UNA RIGA, nei due versi.
 *
 * - `delMese[i]`: la dichiarazione che sta nella colonna i, che cosa ha coperto
 *   («146,86 t = gennaio 87,74 + febbraio 36,42 + marzo 22,70»), o null;
 * - `copertoDa[i]`: chi ha coperto gli arrivi del mese i, dal caricamento piu'
 *   vecchio (la nota «20,62 t di marzo coperte dalla dichiarazione di giugno»);
 *   un caricamento del portale che qui non e' una dichiarazione ha mese null;
 * - `altri`: i caricamenti del report di quest'anno che non sono nostre
 *   dichiarazioni (sul T-Cycle del 2026 quello del 09/01, 320,57 t, tutto su
 *   carichi degli anni prima).
 *
 * Solo dove il report c'e', cioe' sulla rete: per ACI ed extra raccolta il
 * portale non pubblica agganci, e chi chiama non la usa.
 */
export function agganciDellaRiga({ caricamenti = [], dichiarazioni = [], anno, lettaIl = '' } = {}) {
  const { per, usati } = abbinaCaricamenti(caricamenti, dichiarazioni);
  const delMese = MESI.map((_, i) => {
    const c = per.get(i);
    if (!c) return null;
    return {
      giorni: c.giorni, kg: c.kg, prima_kg: c.prima_kg, parziale: c.parziale,
      ...(c.insieme ? { insieme: c.insieme.map(x => MESI[x]) } : {}),
      mesi: c.mesi.map((kg, j) => ({ mese: MESI[j], kg })).filter(x => x.kg > 0),
    };
  });
  // Chi ha coperto che cosa, dal caricamento piu' vecchio.
  const nomeDi = new Map(); // giorno -> nome della dichiarazione (o delle due)
  for (const [idx, c] of per) for (const g of c.giorni) nomeDi.set(g, c.insieme ? c.insieme.map(x => MESI[x]).join(' e ') : MESI[idx]);
  const delAnno = (caricamenti || []).filter(c => c && c.giorno && String(c.giorno).startsWith(String(anno)));
  const copertoDa = MESI.map(() => []);
  const primaDa = [];
  // Una dichiarazione presa in due giorni conta una volta, con tutti e due.
  const perDichiarazione = new Map(); // nome|i -> voce
  for (const c of [...(caricamenti || [])].filter(c => c && c.giorno).sort((a, b) => a.giorno.localeCompare(b.giorno))) {
    const nome = nomeDi.get(c.giorno) || null;
    const voce = (dove, kg, chiave) => {
      if (!(kg > 0)) return;
      const k = nome ? `${nome}|${chiave}` : null;
      if (k && perDichiarazione.has(k)) { const v = perDichiarazione.get(k); v.kg += kg; v.giorni.push(c.giorno); return; }
      const v = { mese: nome, giorni: [c.giorno], kg };
      if (k) perDichiarazione.set(k, v);
      dove.push(v);
    };
    (c.mesi || []).forEach((kg, i) => voce(copertoDa[i], kgInt(kg), i));
    // La casella dall'anno prima esce solo coi caricamenti dopo la lettura del 31/12.
    if (!lettaIl || c.giorno > lettaIl) voce(primaDa, kgInt(c.prima_kg), 'prima');
  }
  const altri = delAnno.filter(c => !usati.has(c.giorno)).map(c => ({
    giorno: c.giorno, kg: kgInt(c.kg), prima_kg: kgInt(c.prima_kg),
    anno_kg: (c.mesi || []).reduce((s, x) => s + kgInt(x), 0),
  }));
  return { delMese, copertoDa, primaDa, altri };
}

/** Il nome del canale in una frase: «della rete», «ACI in secondaria». */
const canaleInFrase = (canale, provenienza) => (canale === 'ACI'
  ? `ACI${provenienza ? ` in ${provenienza}` : ''}`
  : canale === 'EXTRA_RACCOLTA' ? "dell'extra raccolta" : 'della rete');
/** Il canale intero, senza provenienza: «dell'ACI», «per l'ACI». */
const nomeDelCanale = (canale) => (canale === 'ACI' ? "dell'ACI" : canale === 'EXTRA_RACCOLTA' ? "dell'extra raccolta" : 'della rete');
const ilCanale = (canale) => (canale === 'ACI' ? "l'ACI" : canale === 'EXTRA_RACCOLTA' ? "l'extra raccolta" : 'la rete');

/**
 * LE RIGHE DELLO STOCCAGGIO DELLO STESSO SITO, e dove si dichiara.
 *
 * Per chi nell'anno ha avuto, sullo stesso canale, il ruolo di impianto e quello
 * di stoccaggio (T-Cycle sulla rete fino a maggio 2026): quanto e' entrato in
 * stoccaggio mese per mese, tal quale, e verso chi e' ripartito in secondaria.
 * La frase dice chi lo dichiara: l'impianto che riceve la secondaria, nella sua
 * riga, nel mese in cui arriva; e se quell'impianto la rete non ce la dichiara
 * (Tecnogum, per accordo) che cosa ne dice il portale, col numero del file degli
 * ordini non dichiarati (In attesa di dichiarazione delle Giacenze).
 *
 * QUEL FILE E' DI OGGI (revisione del 13/10/2026). Il numero in attesa del file
 * non distingue l'anno dei carichi: sul riepilogo del 2025 la storia di T-Cycle
 * diceva che il portale «attribuisce ancora 181,299 t allo stoccaggio», e sono
 * tutti carichi del 2026. Per un anno che non e' quello in corso l'attesa si
 * conta solo sui carichi di quell'anno, in Giacenze e Dichiarazioni insieme
 * (nellAttesaDellAnno, shared/giacenzaPortale.ts; seconda revisione del
 * 13/10/2026), e chi chiama lo dice con `annoCarichi`: la frase dice di che
 * anno sono i carichi, perche' il file e' di un altro anno. Senza `inAttesaT`
 * (null) la frase sul portale non si scrive e `in_attesa_t` resta null, non
 * zero: non e' «niente in attesa», e' un numero che non c'e'.
 */
export function stoccaggioDelSito({ sito, canale, entrato = [], uscito = [], verso = [], inPiazzaleT = null, inAttesaT = null, annoCarichi = null, fotoIl = '' } = {}) {
  const entratoKg = MESI.map((_, i) => kgInt(entrato[i]));
  const uscitoKg = MESI.map((_, i) => kgInt(uscito[i]));
  const totEntrato = entratoKg.reduce((s, x) => s + x, 0);
  const totUscito = uscitoKg.reduce((s, x) => s + x, 0);
  if (!totEntrato && !totUscito) return null;
  const destinazioni = (verso || []).filter(v => v && kgInt(v.kg) > 0).map(v => ({
    impianto: v.impianto, chiave: v.chiave || '', kg: kgInt(v.kg), dichiara: v.dichiara !== false,
    mesi_kg: MESI.map((_, i) => kgInt(v.mesi_kg && v.mesi_kg[i])),
  }));
  const frasi = [];
  const chi = destinazioni.filter(d => d.dichiara).map(d => d.impianto);
  const nonDichiarano = destinazioni.filter(d => !d.dichiara).map(d => d.impianto);
  frasi.push(`Lo stoccaggio non si dichiara qui: i PFU vi entrano tal quali e ripartono in secondaria, e li dichiara l'impianto che li riceve, nella sua riga, nel mese in cui arrivano${chi.length ? ` (${elenco(chi)})` : ''}.`);
  const conAttesa = inAttesaT !== null && inAttesaT !== undefined;
  // Su un anno che non e' quello in corso il numero e' dei soli carichi di
  // quell'anno, e la frase lo dice (seconda revisione del 13/10/2026).
  const diCarichi = annoCarichi ? ` di carichi del ${annoCarichi}` : '';
  if (canale === 'RETE' && nonDichiarano.length) {
    const attesa = Number(inAttesaT) || 0;
    const perAccordo = `${elenco(nonDichiarano)} sulla rete non ci ${nonDichiarano.length === 1 ? 'dichiara' : 'dichiarano'}, per accordo`;
    frasi.push(!conAttesa
      ? `${perAccordo}: quanto il portale tiene ancora in attesa sullo stoccaggio lo dice il file degli ordini non dichiarati, che è di oggi, nelle Giacenze dell'anno in corso.`
      : `${perAccordo}: ${attesa > 0
        ? `per questo il portale${fotoIl ? `, nel file degli ordini non dichiarati del ${giornoIt(fotoIl)},` : ''} attribuisce ancora ${formatoTonnellate(attesa)} t${diCarichi} allo stoccaggio di ${sito}, in attesa di una dichiarazione (la colonna «In attesa di dichiarazione» delle Giacenze).`
        : `il portale${fotoIl ? `, nel file del ${giornoIt(fotoIl)},` : ''} non attribuisce allo stoccaggio niente${annoCarichi ? ` dei carichi del ${annoCarichi}` : ''} in attesa di dichiarazione.`}`);
  } else if (canale === 'RETE' && conAttesa && (Number(inAttesaT) || 0) > 0) {
    frasi.push(`Il portale${fotoIl ? `, nel file degli ordini non dichiarati del ${giornoIt(fotoIl)},` : ''} attribuisce ancora ${formatoTonnellate(inAttesaT)} t${diCarichi} allo stoccaggio: aspetta che le dichiarino gli impianti che le hanno ricevute.`);
  }
  if (inPiazzaleT !== null && inPiazzaleT !== undefined) {
    frasi.push(Number(inPiazzaleT) > 0
      ? `In piazzale, secondo la rilevazione del portale aggiornata coi movimenti, ci sono ${formatoTonnellate(inPiazzaleT)} t.`
      : 'In piazzale, secondo la rilevazione del portale aggiornata coi movimenti, non resta niente.');
  }
  return {
    canale,
    entrato_kg: entratoKg,
    uscito_kg: uscitoKg,
    entrato_t: totEntrato / 1000,
    uscito_t: totUscito / 1000,
    verso: destinazioni,
    in_piazzale_t: inPiazzaleT === undefined ? null : inPiazzaleT,
    in_attesa_t: canale === 'RETE' && conAttesa ? (Number(inAttesaT) || 0) : null,
    foto_il: fotoIl || '',
    frasi,
  };
}

/**
 * COME FINISCE UNO SPOSTAMENTO FRA LE RIGHE DI UN CANALE (revisione finale del
 * 13/10/2026).
 *
 * `m` e' il mese in cui la chiusura sul canale non sposta piu' niente su una
 * riga, `precedente` il mese prima, che spostava ancora
 * (giacenzaAFineMeseDelCanale). Il perche' si diceva dalla giacenza della riga
 * e basta: sulla riga che cedeva i suoi carichi, giacenza 0 voleva dire «su
 * questa riga non resta niente da cui toglierlo». Gatim ACI con la dichiarazione
 * d'aprile scritta 1.800 kg sulla provenienza sbagliata, e la secondaria che a
 * settembre dichiara le sue 12,82 t arrivate piu' le 1,80 t d'aprile: a fine
 * settembre la secondaria ha 0, e lo spostamento finisce perche' gli arrivi
 * della primaria lo riassorbono, non perche' alla secondaria manchi qualcosa.
 * La primaria diceva «i carichi della secondaria tornano nella sua giacenza», la
 * secondaria «non resta niente da cui toglierlo»: due perche' dello stesso fatto,
 * e nessuno dei due vero.
 *
 * Ora il perche' lo decide la riga che era in eccesso, per tutte e due:
 * - se a fine mese e' ancora sotto zero, le altre righe non hanno piu' carichi
 *   da cui toglierlo, il canale va sotto zero ed e' un errore ('senza_carichi');
 * - se no, l'hanno riassorbito i suoi arrivi ('riassorbito').
 * Sulla riga in eccesso e' la sua giacenza; sulla riga che cedeva e' la giacenza
 * del canale meno la sua (`giacenza_canale_fine_kg`, che riepilogoDichiarazioni
 * mette sul mese dove serve). Senza quel numero, la riga che cedeva lo sa solo
 * se le resta qualcosa (allora l'altra non e' in eccesso, se no la chiusura
 * toglierebbe ancora): altrimenti il perche' non si dice (null).
 *
 * E quanto delle tonnellate che tornano alla riga che cedeva l'ha dichiarato lei
 * nello stesso mese: la sua giacenza prima della chiusura scende di quanto le
 * dichiarazioni del mese superano i suoi arrivi del mese (`oltre_kg`), e le
 * tonnellate che tornano sono i suoi carichi piu' vecchi, i primi che una
 * dichiarazione copre. Sulla riga in eccesso lo stesso conto si fa sulla giacenza
 * delle altre righe, e serve il numero del canale.
 *
 * La stessa regola, scritta uguale, fa il tocco in src/lib/storiaRiepilogo.js
 * (comeFinisceLoSpostamento): la prova spostamentoCheRientra.mjs le confronta.
 *
 * @returns null se il mese non chiude uno spostamento; se no
 *   { kg, cedeva, perche: 'riassorbito'|'senza_carichi'|null, oltre_kg, dichiarato_kg }
 *   kg             quanto si spostava a fine del mese prima
 *   cedeva         true se la riga era quella che cedeva i suoi carichi
 *   oltre_kg       di quanto le dichiarazioni del mese della riga che cedeva
 *                  superano i suoi arrivi del mese (null se non si sa)
 *   dichiarato_kg  di quei `kg`, quanti li ha dichiarati lei nel mese (null se
 *                  non si sa); il resto torna nella sua giacenza
 */
export function comeFinisceLoSpostamento(m, precedente) {
  const eNumero = (v) => typeof v === 'number' && Number.isFinite(v);
  const prima = kgInt(precedente && precedente.spostato_dal_canale_kg);
  if (!m || !prima || kgInt(m.spostato_dal_canale_kg)) return null;
  if (!eNumero(m.giacenza_fine_kg) || !eNumero(precedente.giacenza_fine_kg)) return null;
  const kg = Math.abs(prima);
  const cedeva = prima < 0;
  const g = kgInt(m.giacenza_fine_kg);
  const gPrima = kgInt(precedente.giacenza_fine_kg);
  const conCanale = eNumero(m.giacenza_canale_fine_kg) && eNumero(precedente.giacenza_canale_fine_kg);
  // La giacenza delle altre righe del canale, a fine mese e a fine del mese prima.
  const altre = conCanale ? kgInt(m.giacenza_canale_fine_kg) - g : null;
  const altrePrima = conCanale ? kgInt(precedente.giacenza_canale_fine_kg) - gPrima : null;
  // La riga che cedeva: prima della chiusura aveva la sua giacenza piu' i kg
  // spostati, ora (non sposta piu') ha la sua giacenza.
  const oltre = cedeva ? gPrima + kg - g : conCanale ? altrePrima + kg - altre : null;
  const perche = !cedeva ? (g >= 0 ? 'riassorbito' : 'senza_carichi')
    : conCanale ? (altre < 0 ? 'senza_carichi' : 'riassorbito')
      : g > 0 ? 'riassorbito' : null;
  return { kg, cedeva, perche, oltre_kg: oltre, dichiarato_kg: oltre === null ? null : Math.min(kg, Math.max(0, oltre)) };
}

/**
 * IL RACCONTO DI UNA RIGA, scritto dai numeri.
 *
 * Poche frasi, nell'ordine in cui le cose sono successe: da quando l'impianto
 * riceve, se ha avuto anche lo stoccaggio e fino a quando e dove e' ripartito,
 * ogni dichiarazione caricata col giorno, quanto ha coperto e di quali mesi, che
 * cosa e' rimasto in giacenza dopo e perche', che cosa resta oggi. Dove una
 * regola conta (il portale aggancia dal mese piu' vecchio, lo stoccaggio non si
 * dichiara qui, l'ACI non si aggancia) una frase la spiega a chi non la conosce.
 *
 * `riga` e' quello che riepilogoDichiarazioni ha gia' calcolato: i dodici mesi
 * (conferito, caricato, resta, dichiarazione), la casella dall'anno prima, la
 * giacenza a fine mese, gli agganci (agganciDellaRiga, solo sulla rete col
 * report) e lo stoccaggio dello stesso sito (stoccaggioDelSito), se c'e'.
 *
 * Un canale con piu' righe (l'ACI: primaria e secondaria; revisione del
 * 13/10/2026): `righe_del_canale` dice quante sono e `giacenza_canale_kg` il
 * numero del canale, quello delle Giacenze. Le Giacenze hanno un numero solo
 * per l'ACI di un impianto, la somma delle righe: la riga non dice piu' di
 * essere «lo stesso numero delle Giacenze», dice che lo fanno le righe insieme,
 * e quanto. E se la chiusura sul canale ha spostato una parte della giacenza
 * fra le righe (`mesi[i].spostato_dal_canale_kg`) lo dice, perche' il numero
 * della riga non e' piu' entrato meno caricato: da quando a quando, e se lo
 * spostamento finisce prima dell'ultimo mese perche' finisce (seconda revisione
 * del 13/10/2026). `altre_provenienze` sono le provenienze delle altre righe del
 * canale, per chiamarle per nome («gli arrivi della primaria»). Il perche' della
 * fine e' lo stesso su tutte le righe del canale: lo decide la riga che era in
 * eccesso, e sulla riga che cedeva lo dice `mesi[i].giacenza_canale_fine_kg`, la
 * giacenza del canale a fine mese (comeFinisceLoSpostamento, revisione finale
 * del 13/10/2026).
 */
export function raccontoDellaRiga(riga) {
  const r = riga || {};
  const anno = Number(r.anno) || '';
  const sito = r.sito || '';
  const mesi = r.mesi || [];
  const conferito = MESI.map((_, i) => kgInt(mesi[i] && mesi[i].conferito_kg));
  const caricato = MESI.map((_, i) => kgInt(mesi[i] && mesi[i].caricato_kg));
  const resta = MESI.map((_, i) => kgInt(mesi[i] && mesi[i].resta_kg));
  const fine = r.giacenza_fine_mese || [];
  const ultimo = Number.isInteger(r.ultimo_mese) ? r.ultimo_mese : 11;
  const prima = r.dall_anno_prima || null;
  const partenza = prima ? kgInt(prima.conferito_kg) : 0;
  const agganci = r.agganci || null;
  const stoc = r.stoccaggio || null;
  const R1 = r.operazione === 'R1';
  const frasi = [];
  const primoArrivo = conferito.findIndex(x => x > 0);
  let ultimoArrivo = -1;
  conferito.forEach((x, i) => { if (x > 0) ultimoArrivo = i; });
  const totConf = conferito.reduce((s, x) => s + x, 0);
  const detto = canaleInFrase(r.canale, r.provenienza);
  const nRighe = Math.max(1, Math.round(Number(r.righe_del_canale) || 1));
  const canaleKg = typeof r.giacenza_canale_kg === 'number' && Number.isFinite(r.giacenza_canale_kg) ? kgInt(r.giacenza_canale_kg) : null;
  const altraRiga = nRighe === 2 ? "dell'altra riga" : 'di un\'altra riga';

  // 1. Da dove parte l'anno e da quando arriva.
  if (partenza > 0) {
    frasi.push(`Il ${anno} è partito con ${t(partenza)} dall'anno prima: quello che al ${giornoIt(prima.al) || `31/12/${anno - 1}`} restava da dichiarare${kgInt(prima.dichiarato_dopo_kg) > 0 ? ` (lette ${t(prima.letta_kg)}, meno ${t(prima.dichiarato_dopo_kg)} del ${anno - 1} dichiarate dopo quella lettura)` : ''}.`);
  }
  if (primoArrivo >= 0) {
    const daStoccaggi = mesi.reduce((s, m) => s + ((m && m.da_stoccaggi) || []).reduce((x, y) => x + kgInt(y.kg), 0), 0);
    const nomiStoccaggi = [...new Set(mesi.flatMap(m => ((m && m.da_stoccaggi) || []).map(y => y.stoccaggio)))];
    const secondaria = daStoccaggi <= 0 ? '' : daStoccaggi >= totConf ? `, tutte in secondaria da ${elenco(nomiStoccaggi)}` : `, di cui ${t(daStoccaggi)} in secondaria da ${elenco(nomiStoccaggi)}`;
    frasi.push(chiudi(`Nel ${anno} ${sito} riceve${stoc ? ' in impianto' : ''} PFU ${detto} da ${meseDetto(primoArrivo)}: ${t(totConf)}${ultimoArrivo > primoArrivo ? ` fino a ${meseDetto(ultimoArrivo)}` : ''}${secondaria}`));
  } else if (!partenza) {
    frasi.push(`Nel ${anno} ${sito} non ha ricevuto PFU ${detto}.`);
  }

  // 2. La rete non dovuta per accordo: non c'e' una giacenza da raccontare.
  if (r.non_dovuta) {
    frasi.push(`Per accordo ${sito} non ci dichiara la rete: il trattamento non è a nostro carico e il portale non tiene per noi una giacenza di rete. Quello che arriva si vede nella riga del conferito; da dichiarare non resta niente.`);
    return frasi;
  }

  // 3. Lo stoccaggio dello stesso sito, sullo stesso canale.
  if (stoc) {
    const e = stoc.entrato_kg || [];
    const sp = e.findIndex(x => x > 0);
    let su = -1;
    e.forEach((x, i) => { if (x > 0) su = i; });
    const tratta = R1 ? 'per il trattamento e le uscite su nave' : 'per il trattamento';
    if (sp >= 0 && ultimoArrivo >= 0) {
      const quando = su < ultimoArrivo
        ? `${sp > 0 ? `Da ${meseDetto(sp)} a ${meseDetto(su)}` : `Fino a ${meseDetto(su)}`} ${sito} ha ricevuto i PFU in due modi`
        : `${sp > 0 ? `Da ${meseDetto(sp)}` : "Dall'inizio dell'anno"} ${sito} riceve i PFU in due modi`;
      frasi.push(`${quando}: in impianto, ${tratta}, e in stoccaggio, tal quali, per mandarli a un altro impianto${su < ultimoArrivo ? `; da ${meseDetto(su + 1)} solo in impianto` : ''}.`);
    }
    const dest = stoc.verso || [];
    const versoDetto = dest.length === 1 ? dest[0].impianto : elenco(dest.map(d => `${d.impianto} (${t(d.kg)})`));
    const tot = kgInt(stoc.entrato_t * 1000);
    const usc = kgInt(stoc.uscito_t * 1000);
    frasi.push(`Lo stoccaggio, ${t(tot)}, ${usc >= tot && usc > 0 ? `è ripartito tutto in secondaria verso ${versoDetto}` : usc > 0 ? `è ripartito per ${t(usc)} in secondaria verso ${versoDetto}` : 'non è ancora ripartito'}: non entra in questa riga e qui non si dichiara, perché lo dichiara l'impianto che lo riceve, nel mese in cui arriva.`);
    // La prima frase dello stoccaggio e' la regola, appena detta: qui le altre.
    for (const f of (stoc.frasi || []).slice(1)) frasi.push(f);
  }

  // 4. Le dichiarazioni caricate, nell'ordine in cui sono arrivate a portale.
  const conReport = !!agganci;
  const delMese = agganci ? agganci.delMese || [] : [];
  const copertoDa = agganci ? agganci.copertoDa || [] : [];
  const caricate = MESI.map((_, i) => i).filter(i => caricato[i] > 0);
  const giornoDi = (i) => {
    const c = delMese[i];
    if (c && c.giorni && c.giorni.length) return c.giorni[c.giorni.length - 1];
    return String((mesi[i] && mesi[i].dichiarazione && mesi[i].dichiarazione.caricata_il) || '').slice(0, 10);
  };
  const ordine = [...caricate].sort((a, b) => (giornoDi(a) || '9999').localeCompare(giornoDi(b) || '9999') || a - b);
  let regolaDetta = false;
  // Quanto di ogni mese di arrivo i caricamenti del report hanno coperto fin li'.
  const coperto = MESI.map(() => 0);
  let primaCoperta = 0;
  const giaDette = new Set();
  const perche = R1 ? 'non ancora uscite su nave' : 'non ancora dichiarate';
  // Le dichiarazioni che coprono esattamente il loro mese si dicono insieme.
  const suoMese = [];
  const diceSuoMese = () => {
    if (!suoMese.length) return;
    const nomi = elenco(suoMese.map(meseDetto));
    const gg = [...new Set(suoMese.map(giornoDi).filter(Boolean))].sort();
    const quando = gg.length > 1 ? ` (caricate fra ${ilGiorno(gg[0])} e ${ilGiorno(gg[gg.length - 1])})` : gg.length ? ` (${suoMese.length > 1 ? 'caricate' : 'caricata'} ${ilGiorno(gg[0])})` : '';
    frasi.push(suoMese.length === 1
      ? `La dichiarazione di ${nomi} ha coperto tutto il suo mese${quando}.`
      : `Le dichiarazioni di ${nomi} hanno coperto ciascuna tutto il suo mese${quando}.`);
    suoMese.length = 0;
  };
  for (const i of ordine) {
    if (giaDette.has(i)) continue;
    const c = delMese[i];
    const g = giornoDi(i);
    const q = caricato[i];
    if (c) {
      for (const j of c.insieme ? c.insieme.map(n => MESI.indexOf(n)) : [i]) giaDette.add(j);
      const soloSuo = !c.insieme && !c.parziale && !c.prima_kg && c.mesi.length === 1 && c.mesi[0].mese === MESI[i] && c.mesi[0].kg === conferito[i] && !coperto[i];
      if (soloSuo) {
        suoMese.push(i);
        coperto[i] += c.mesi[0].kg;
        continue;
      }
      diceSuoMese();
      // Ogni pezzo si dice col suo numero e, quando e' l'unico, senza ripeterlo:
      // «ha coperto 262,72 t, tutte di febbraio», non «262,72 t: 262,72 t di febbraio».
      const parti = [];
      const soli = [];
      if (c.prima_kg > 0) {
        const tutta = partenza > 0 && primaCoperta === 0 && c.prima_kg === partenza;
        parti.push(tutta ? `la giacenza dall'anno prima (${t(c.prima_kg)})` : `${t(c.prima_kg)} arrivate negli anni prima`);
        soli.push(tutta ? "tutta la giacenza dall'anno prima" : 'tutte arrivate negli anni prima');
      }
      let piuVecchi = c.prima_kg > 0;
      for (const x of c.mesi) {
        const j = MESI.indexOf(x.mese);
        if (j < i) piuVecchi = true;
        if (x.kg === conferito[j] && !coperto[j]) { parti.push(meseDetto(j)); soli.push(`tutto ${meseDetto(j)}`); }
        else if (coperto[j] > 0 && coperto[j] + x.kg === conferito[j]) { parti.push(`le ${t(x.kg)} rimaste di ${meseDetto(j)}`); soli.push(`quelle rimaste di ${meseDetto(j)}`); }
        else { parti.push(`${t(x.kg)} di ${meseDetto(j)}`); soli.push(`tutte di ${meseDetto(j)}`); }
      }
      const chi = c.insieme ? `Le dichiarazioni di ${elenco(c.insieme.map(n => n.toLowerCase()))}, caricate insieme ${giorniDetti(c.giorni)}, hanno coperto` : `La dichiarazione di ${meseDetto(i)}, caricata ${giorniDetti(c.giorni)}, ha coperto`;
      const regola = piuVecchi && !regolaDetta ? ", perché il portale copre sempre prima i carichi più vecchi ancora aperti" : '';
      if (regola) regolaDetta = true;
      const quanto = c.parziale ? ` (delle ${t(q)} caricate il report del portale ne aggancia ${t(c.kg)})` : '';
      frasi.push(`${chi} ${t(c.kg)}${parti.length === 1 ? `, ${soli[0]}` : `: ${elenco(parti)}`}${regola}${quanto}.`);
      for (const x of c.mesi) coperto[MESI.indexOf(x.mese)] += x.kg;
      primaCoperta += c.prima_kg;
    } else if (conReport) {
      diceSuoMese();
      giaDette.add(i);
      frasi.push(`La dichiarazione di ${meseDetto(i)}${g ? `, caricata ${ilGiorno(g)},` : ''} vale ${t(q)}: il report del portale non la conosce ancora, e il gestionale la toglie dai carichi più vecchi ancora in giacenza, come farà il portale.`);
      continue;
    } else {
      giaDette.add(i);
      if (q === conferito[i]) { suoMese.push(i); continue; }
      diceSuoMese();
      frasi.push(`La dichiarazione di ${meseDetto(i)}${g ? `, caricata ${ilGiorno(g)},` : ''} vale ${t(q)}, contro ${t(conferito[i])} arrivate nel mese.`);
      continue;
    }
    // Che cosa e' rimasto dopo, e perche'.
    const gf = fine[i];
    if (gf === null || gf === undefined) continue;
    if (gf <= 0) { frasi.push(`A fine ${meseDetto(i)} in giacenza non restava niente.`); continue; }
    // La composizione si dice solo se torna al chilo con la giacenza a fine mese:
    // se il portale ha caricamenti che qui non sono dichiarazioni, si dice il numero.
    const rimasti = MESI.map((_, j) => (j <= i ? conferito[j] - coperto[j] : 0));
    const restoPrima = Math.max(0, partenza - primaCoperta);
    const torna = rimasti.every(x => x >= 0) && rimasti.reduce((s, x) => s + x, 0) + restoPrima === gf;
    if (!torna) { frasi.push(`A fine ${meseDetto(i)} in giacenza restavano ${t(gf)}.`); continue; }
    const pezzi = [...(restoPrima > 0 ? [`${t(restoPrima)} dall'anno prima`] : []), ...rimasti.map((x, j) => (x > 0 ? `${t(x)} di ${meseDetto(j)}` : '')).filter(Boolean)];
    // Chi le ha coperte poi: la dichiarazione dopo, se e' una sola.
    const dopo = new Set();
    let ancoraOggi = false;
    rimasti.forEach((x, j) => {
      if (!(x > 0)) return;
      for (const v of copertoDa[j] || []) if (v.mese && v.giorni.some(d => d > g)) dopo.add(v.mese.toLowerCase());
      if (resta[j] > 0) ancoraOggi = true;
    });
    const dalle = dopo.size === 1 ? 'dalla dichiarazione' : 'dalle dichiarazioni';
    const poi = dopo.size && !ancoraOggi ? `, coperte poi ${dalle} di ${elenco([...dopo])}`
      : dopo.size ? `, coperte in parte ${dalle} di ${elenco([...dopo])}` : '';
    frasi.push(`Sono rimaste in giacenza ${pezzi.length === 1 ? pezzi[0] : `${t(gf)}: ${elenco(pezzi)}`}, ${perche}${poi}.`);
  }
  diceSuoMese();

  // I mesi di soli metalli e quelli non dovuti: non sono dichiarazioni mancate.
  const motivo = (m) => (m && m.dichiarazione && m.dichiarazione.motivo_assenza) || '';
  const metalli = MESI.map((_, i) => i).filter(i => motivo(mesi[i]) === 'solo_metalli');
  if (metalli.length) {
    frasi.push(`${elenco(metalli.map(meseDetto)).replace(/^./, x => x.toUpperCase())} ${metalli.length === 1 ? 'è un mese' : 'sono mesi'} di soli metalli ferrosi: a portale non si carica nulla, il ferro si dichiara al consorzio via email e la gomma arrivata resta in giacenza fino alla dichiarazione dopo.`);
  }
  const nonDovuti = MESI.map((_, i) => i).filter(i => motivo(mesi[i]) === 'non_dovuta');
  if (nonDovuti.length) {
    frasi.push(`${elenco(nonDovuti.map(meseDetto)).replace(/^./, x => x.toUpperCase())} ${nonDovuti.length === 1 ? 'è segnato' : 'sono segnati'} «non dovuta»: quello che è arrivato non si deve a nessuno.`);
  }

  // La chiusura sul canale (revisione del 13/10/2026): quando una dichiarazione
  // di questa riga supera quello che vi era arrivato, o una dell'altra riga
  // porta via un carico di questa, la giacenza a fine mese non e' piu' entrato
  // meno caricato, e si dice perche'.
  //
  // SI DICE PER QUANTO DURA, E COME FINISCE (seconda revisione del 13/10/2026).
  // Qui si diceva solo il primo mese, e come un fatto: «a fine aprile 1,80 t di
  // questa riga risultano uscite con la dichiarazione dell'altra riga». Ma lo
  // spostamento dura finche' la riga in eccesso non riceve arrivi suoi: Gatim
  // ACI con la dichiarazione d'aprile scritta 1.800 kg sulla provenienza
  // sbagliata e settembre non ancora caricato, lo spostamento va da aprile ad
  // agosto e a settembre gli arrivi della primaria lo riassorbono. La colonna
  // «Da dichiarare» toglie allora l'eccesso dal settembre della primaria, e la
  // secondaria conta ancora le sue 1,80 t d'aprile: due frasi dopo, il racconto
  // diceva «oggi restano 1,80 t di aprile» delle stesse tonnellate «uscite».
  // Ora ogni tratto ha il suo periodo, e se finisce prima dell'ultimo mese si
  // dice perche'.
  const spostati = MESI.map((_, i) => (i <= ultimo ? kgInt(mesi[i] && mesi[i].spostato_dal_canale_kg) : 0));
  const tratti = [];
  spostati.forEach((kg, i) => {
    if (!kg) return;
    const ultimoTratto = tratti[tratti.length - 1];
    if (ultimoTratto && ultimoTratto.a === i - 1 && Math.sign(kg) === ultimoTratto.segno) { ultimoTratto.a = i; ultimoTratto.kg.push(Math.abs(kg)); }
    else tratti.push({ da: i, a: i, segno: Math.sign(kg), kg: [Math.abs(kg)] });
  });
  // Le altre righe del canale per nome, se e' una: «la secondaria».
  const altre = (Array.isArray(r.altre_provenienze) ? r.altre_provenienze : []).filter(Boolean);
  const altraNome = nRighe === 2 && altre.length === 1 ? String(altre[0]).toLowerCase() : '';
  const dellAltra = `${altraRiga} ${nomeDelCanale(r.canale)}${altraNome ? ` (la ${altraNome})` : ''}`;
  const arriviAltra = altraNome ? `gli arrivi della ${altraNome}` : `gli arrivi ${nRighe === 2 ? "dell'altra riga" : 'delle altre righe'}`;
  const insieme = 'le righe di un canale si chiudono insieme, come la colonna «Da dichiarare» e le Giacenze';
  for (const tr of tratti) {
    const finisce = tr.a < ultimo;
    const quanto = tr.kg.every(x => x === tr.kg[0]) ? t(tr.kg[0]) : `fino a ${t(Math.max(...tr.kg))}`;
    const quando = tr.da === tr.a ? `A fine ${meseDetto(tr.a)}` : finisce ? `Da fine ${meseDetto(tr.da)} a fine ${meseDetto(tr.a)}` : `Da fine ${meseDetto(tr.da)}`;
    if (tr.segno > 0) {
      frasi.push(finisce
        ? `${quando} le dichiarazioni di questa riga avevano coperto ${quanto} più di quello che vi era arrivato, e l'eccesso si toglieva dai carichi più vecchi ${dellAltra}: ${insieme}.`
        : `${quando} le dichiarazioni di questa riga hanno coperto ${quanto} più di quello che vi era arrivato, e l'eccesso si toglie dai carichi più vecchi ${dellAltra}: ${insieme}.`);
    } else {
      frasi.push(finisce
        ? `${quando} la giacenza di questa riga contava ${quanto} in meno: le dichiarazioni ${dellAltra} avevano coperto più di quello che vi era arrivato, e l'eccesso si toglieva dai carichi più vecchi di questa riga, perché ${insieme}.`
        : `${quando} la giacenza di questa riga conta ${quanto} in meno: le dichiarazioni ${dellAltra} hanno coperto più di quello che vi era arrivato, e l'eccesso si toglie dai carichi più vecchi di questa riga, perché ${insieme}.`);
    }
    // Come finisce: il mese dopo lo spostamento e' zero. Il perche' lo decide la
    // riga che era in eccesso, lo stesso su tutte e due le righe, e se la riga
    // che cedeva ha dichiarato lei nello stesso mese le tonnellate che le
    // tornano si dice (comeFinisceLoSpostamento, revisione finale del 13/10/2026:
    // la secondaria di Gatim, a 0 perche' a settembre le aveva dichiarate, diceva
    // «non resta niente da cui toglierlo» mentre la primaria diceva che gli
    // arrivi lo riassorbivano).
    const e = tr.a + 1;
    if (!finisce || spostati[e] !== 0) continue;
    const fn = comeFinisceLoSpostamento(
      { spostato_dal_canale_kg: 0, giacenza_fine_kg: fine[e], giacenza_canale_fine_kg: mesi[e] && mesi[e].giacenza_canale_fine_kg },
      { spostato_dal_canale_kg: spostati[tr.a], giacenza_fine_kg: fine[tr.a], giacenza_canale_fine_kg: mesi[tr.a] && mesi[tr.a].giacenza_canale_fine_kg },
    );
    if (!fn) continue;
    const mese = meseDetto(e);
    const quanti = t(fn.kg);
    const dichiarate = fn.dichiarato_kg;
    const superaDi = fn.oltre_kg !== null ? `supera di ${t(fn.oltre_kg)} quello che vi è arrivato nel mese` : '';
    const laAltra = altraNome ? `la ${altraNome}` : "l'altra riga";
    const allaAltra = altraNome ? `alla ${altraNome}` : "all'altra riga";
    const dellaAltra = altraNome ? `della ${altraNome}` : "dell'altra riga";
    if (!fn.cedeva) {
      if (fn.perche === 'riassorbito') {
        const dove = dichiarate === null ? `, e le ${quanti} tornano ${allaAltra}`
          : dichiarate === fn.kg ? `, e le ${quanti} tornano ${allaAltra}, che a ${mese} le ha dichiarate`
            : dichiarate > 0 ? `, e le ${quanti} tornano ${allaAltra}: ${t(dichiarate)} le ha dichiarate a ${mese}, ${t(fn.kg - dichiarate)} tornano nella sua giacenza`
              : `, e le ${quanti} tornano nella giacenza ${dellaAltra}`;
        frasi.push(`Da ${mese} gli arrivi di questa riga lo riassorbono: l'eccesso esce dai suoi carichi arrivati dopo, come nella colonna «Da dichiarare»${dove}.`);
      } else {
        frasi.push(`Da ${mese} ${laAltra} non ha più carichi da cui toglierlo${dichiarate === fn.kg ? `, perché a ${mese} ha dichiarato le sue ${quanti}` : ''}: la giacenza di questa riga va sotto zero, ed è un errore da correggere.`);
      }
    } else if (fn.perche === 'riassorbito') {
      frasi.push(dichiarate === fn.kg
        ? `Da ${mese} ${arriviAltra} lo riassorbono, e le ${quanti} tornano a questa riga, che a ${mese} le ha dichiarate: la sua dichiarazione di ${mese} ${superaDi}.`
        : dichiarate > 0
          ? `Da ${mese} ${arriviAltra} lo riassorbono, e le ${quanti} tornano a questa riga: ${t(dichiarate)} le copre la sua dichiarazione di ${mese}, che ${superaDi}, e ${t(fn.kg - dichiarate)} tornano nella sua giacenza.`
          : `Da ${mese} ${arriviAltra} lo riassorbono, e le ${quanti} tornano nella giacenza di questa riga.`);
    } else if (fn.perche === 'senza_carichi') {
      frasi.push(`Da ${mese} su questa riga non resta niente da cui toglierlo${dichiarate === fn.kg ? `, perché a ${mese} ha dichiarato le sue ${quanti}` : ''}: la giacenza ${dellaAltra} va sotto zero, ed è un errore da correggere.`);
    } else {
      // Senza il numero del canale non si sa chi l'ha chiuso: si dice il fatto.
      frasi.push(dichiarate === fn.kg
        ? `Da ${mese} lo spostamento finisce, e le ${quanti} tornano a questa riga, che a ${mese} le ha dichiarate: la sua dichiarazione di ${mese} ${superaDi}.`
        : `Da ${mese} la chiusura sul canale non toglie più niente da questa riga.`);
    }
  }

  // 5. I caricamenti del portale che qui non sono dichiarazioni dell'anno.
  const altri = agganci ? agganci.altri || [] : [];
  if (altri.length) {
    const kgAltri = altri.reduce((s, c) => s + c.kg, 0);
    const kgAnno = altri.reduce((s, c) => s + c.anno_kg, 0);
    const dettiAltri = altri.length <= 4 ? ` (${elenco(altri.map(c => `${ilGiorno(c.giorno)} ${t(c.kg)}`))})` : ` (${altri.length}, per ${t(kgAltri)}, fra ${ilGiorno(altri[0].giorno)} e ${ilGiorno(altri[altri.length - 1].giorno)})`;
    frasi.push(`Nel report del portale ${altri.length === 1 ? "c'è anche un caricamento" : "ci sono anche dei caricamenti"} del ${anno} che qui non ${altri.length === 1 ? 'è' : 'sono'} fra le dichiarazioni${dettiAltri}: ${kgAnno > 0
      ? `${t(kgAnno)} riguardano carichi di quest'anno, e qui c'è una dichiarazione da registrare.`
      : `${altri.length === 1 ? 'copre carichi arrivati' : 'coprono carichi arrivati'} prima del ${anno} e non ${altri.length === 1 ? 'tocca' : 'toccano'} i mesi di quest'anno.`}`);
  }

  // 6. Oggi.
  const restoPrimaOggi = prima ? kgInt(prima.resta_kg) : 0;
  const restaOggi = resta.reduce((s, x) => s + x, 0) + restoPrimaOggi;
  if (restaOggi <= 0) {
    // Su una riga di un canale che ne ha piu' d'una, lo zero e' della riga: il
    // numero delle Giacenze e' delle righe insieme (revisione del 13/10/2026).
    frasi.push(nRighe > 1 && canaleKg !== null && canaleKg > 0
      ? `Oggi su questa riga non resta niente da dichiarare: le ${t(canaleKg)} che le Giacenze dicono per ${ilCanale(r.canale)} sono ${nRighe === 2 ? "dell'altra riga" : 'delle altre righe'}.`
      : 'Oggi non resta niente da dichiarare.');
  } else {
    const pezzi = restoPrimaOggi > 0 ? [`${t(restoPrimaOggi)} dall'anno prima`] : [];
    let i = 0;
    while (i < 12) {
      if (!(resta[i] > 0)) { i++; continue; }
      if (resta[i] < conferito[i]) { pezzi.push(`${t(resta[i])} di ${meseDetto(i)}`); i++; continue; }
      // I mesi interi di fila si dicono insieme: «quello che e' arrivato da luglio a ottobre».
      let j = i;
      while (j + 1 < 12 && resta[j + 1] > 0 && resta[j + 1] === conferito[j + 1]) j++;
      const kg = resta.slice(i, j + 1).reduce((s, x) => s + x, 0);
      pezzi.push(j > i ? `quello che è arrivato da ${meseDetto(i)} a ${meseDetto(j)} (${t(kg)})` : `tutto ${meseDetto(i)} (${t(kg)})`);
      i = j + 1;
    }
    const stimato = mesi.some(m => m && m.uscito_stimato) || (prima && prima.uscito_stimato);
    const gUltimo = fine[ultimo];
    // Le Giacenze hanno un numero per impianto e canale: lo si cita come «lo
    // stesso numero» solo se la riga e' l'unica del suo canale. Con piu' righe
    // (l'ACI, primaria e secondaria) il numero delle Giacenze e' delle righe
    // insieme, e la frase lo dice col suo valore (revisione del 13/10/2026: la
    // primaria diceva 12,35 t «delle Giacenze», la secondaria 12,82, e le
    // Giacenze dicono 25,17 t per Gatim ACI).
    const coda = gUltimo !== restaOggi ? ''
      : nRighe > 1
        ? `. È la giacenza a fine ${meseDetto(ultimo)} di questa riga, lo stesso numero della colonna «Da dichiarare»${canaleKg !== null ? `; le Giacenze hanno un numero solo per ${ilCanale(r.canale)}, le ${nRighe === 2 ? 'due' : nRighe} righe insieme: ${t(canaleKg)}` : ''}`
        : `. È la giacenza a fine ${meseDetto(ultimo)}, lo stesso numero della colonna «Da dichiarare» e delle Giacenze`;
    frasi.push(`Oggi restano da dichiarare ${t(restaOggi)}: ${elenco(pezzi)}${coda}.${stimato ? " Una parte l'ha ripartita il gestionale: il report del portale non ha ancora l'ultima dichiarazione." : ''}`);
  }

  // 7. Le regole che contano, per chi non le conosce.
  if (r.canale === 'RETE' && !conReport && caricate.length) {
    frasi.push('Il report del portale non ha ancora agganci per questo impianto: ogni dichiarazione si toglie dai carichi più vecchi ancora in giacenza, come farà il portale.');
  }
  if (r.canale === 'ACI') frasi.push(`Sull'ACI il portale non pubblica agganci: ogni dichiarazione vale per il suo mese e per la sua provenienza${r.provenienza ? ` (qui la ${r.provenienza})` : ''}.`);
  if (r.canale === 'EXTRA_RACCOLTA') frasi.push("L'extra raccolta a portale non si gestisce: ogni campagna si dichiara col suo mese.");
  return frasi;
}
