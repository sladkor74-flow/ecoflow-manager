// IL GUARDIANO NOTTURNO, E LA MEMORIA DEI NUMERI.
//
// Due cose che vivono nella stessa riga, scritta una volta per notte
// (entita' IndicatoreGiorno):
//
// - IL GUARDIANO. La quadratura di tutti gli impianti si rifa' ogni notte e la
//   mattina c'e' una riga sola: «tutto in linea» oppure «Gatim si scosta di
//   1,2 t». Fino al 10/10/2026 un numero che non tornava lo scopriva l'utente
//   aprendo una pagina, o non lo scopriva nessuno: il 09/10 abbiamo passato
//   mezz'ora a capire perche' la somma dei mesi di T-Cycle diceva 532,68 t e la
//   colonna 352,94. Meglio che se ne accorga il gestionale prima del consorzio.
//
// - LA MEMORIA. Il gestionale risponde benissimo a «com'e' adesso» e non sa
//   rispondere a «com'era a giugno»: ogni numero si ricalcola sul presente.
//   Qui resta, giorno per giorno, e da li' nasce una curva invece di una
//   tabella. Il valore di questa cosa e' il tempo che accumula: comincia a
//   scrivere molto prima di quando servira' leggerla.
//
// La regola sta qui, pura: chi scrive (riepilogoDichiarazioni con registra) le
// passa i siti gia' calcolati e non ricalcola niente per conto suo. Un terzo
// posto che rifa' la quadratura darebbe una terza risposta.
import { TOLLERANZA_QUADRATURA_T } from "./dichiarazioniImpianti.ts";
import { formatoTonnellate } from "./formato.ts";

const num = (v) => (Number(v) || 0);
const t3 = (v) => Math.round(num(v) * 1000) / 1000;
// Le tonnellate si scrivono come ovunque nel gestionale: due decimali, tre se
// i chili non sono tondi. Il formato sta in un posto solo (shared/formato.ts):
// scriverne un secondo qui voleva dire un «1,200 t» dove tutto il resto dice
// «1,20 t», e l'ho scoperto da una prova.
const tt = (v) => formatoTonnellate(t3(v));

/** Il canale di una riga dei flussi, senza la provenienza. */
const canaleDi = (f) => String((f && f.canale) || 'RETE');

/**
 * Il canale di una voce della fotografia, per la quadratura col portale: un
 * impianto e' della rete (il portale tiene la giacenza degli impianti solo per
 * la rete); una riga di stoccaggio ha il canale in fondo alla chiave, come la
 * scrive riepilogoDichiarazioni («nappi sud|RETE»). E' la regola di
 * canaleDelSito in shared/cruscotto.ts, che conta le stesse righe.
 */
export const canaleDellaVoce = (v) => (v && v.ruolo === 'stoc'
  ? ((String(v.chiave || '').match(/\|(RETE|ACI)$/) || [])[1] || null)
  : 'RETE');

/**
 * I MESI ANCORA APERTI DI UN CANALE, dal piu' vecchio (12/10/2026).
 *
 * La chiusura del mese (shared/chiusuraMese.ts, passoDichiarazioni) li legge se
 * ci sono: senza, su ACI ed extra raccolta dava per tutto il mese dopo un arrivo
 * un rosso falso - un conferimento arrivato dopo il mese che si chiude sembrava
 * una dichiarazione mancata. Sono il conto mese per mese della pagina
 * Dichiarazioni, gia' fatto: il «Da dichiarare» di ogni mese della riga, e in
 * testa la casella dall'anno prima, come la tratta la pagina («dall'anno prima»,
 * il carico piu' vecchio, che il portale aggancia per primo). L'ACI dice la
 * provenienza, perche' li' ogni dichiarazione e' della sua. Un mese che non ha
 * niente da dichiarare non si scrive: la riga del giorno deve restare piccola.
 * Una riga dei flussi senza i dodici mesi non dice quali sono aperti: null, non
 * un elenco vuoto, che vorrebbe dire «niente da dichiarare».
 */
export function mesiAperti(flussi) {
  const elenco = [];
  for (const f of flussi || []) {
    if (!f || f.non_dovuta) continue;
    if (!Array.isArray(f.mesi)) return null;
    const prov = canaleDi(f) === 'ACI' && f.provenienza ? { provenienza: f.provenienza } : {};
    const prima = f.dall_anno_prima;
    if (prima && num(prima.da_dichiarare_kg) > 0) elenco.push({ ordine: -1, voce: { mese: "dall'anno prima", da_dichiarare_t: t3(num(prima.da_dichiarare_kg) / 1000) } });
    f.mesi.forEach((m, i) => {
      if (m && num(m.da_dichiarare_kg) > 0) elenco.push({ ordine: i, voce: { mese: m.mese, ...prov, da_dichiarare_t: t3(num(m.da_dichiarare_kg) / 1000) } });
    });
  }
  // Dal piu' vecchio: la casella, poi i mesi; a parita' di mese l'ordine delle
  // righe, primaria prima della secondaria (sort e' stabile).
  return elenco.sort((a, b) => a.ordine - b.ordine).map(x => x.voce);
}

/**
 * I NUMERI DI UN SITO IN UN GIORNO.
 *
 * Solo quello che si vuole poter rileggere fra sei mesi: la giacenza, il
 * confronto col portale e quanto e' passato di li'. Un canale per volta, mai
 * sommati fra loro (regola 3).
 */
export function vociSito(sito) {
  const canali = {};
  for (const g of (sito && sito.giacenze_canale) || []) {
    // LA RETE NON DOVUTA NON E' UNA GIACENZA (10/10/2026). Chi la rete non la
    // dichiara per accordo - oggi Tecnogum - ha giacenza «—», non 1.833,43 t: il
    // primo giorno dello storico quel numero era il 53% del totale della rete, e
    // la curva sarebbe nata falsata. Il null resta null (t3 lo farebbe zero, e uno
    // zero direbbe «impianto vuoto»), e il materiale arrivato si tiene a parte.
    canali[g.canale] = g.non_dovuta
      ? { giacenza_t: null, non_dovuta: true, entrato_t: t3(g.entrato_t), dichiarato_t: t3(g.dichiarato_caricato_t) }
      : { giacenza_t: t3(g.giacenza_t), entrato_t: t3(g.entrato_t), dichiarato_t: t3(g.dichiarato_caricato_t) };
  }
  for (const f of (sito && sito.flussi) || []) {
    // Il resto di un flusso non dovuto non e' da dichiarare: non entra.
    if (f && f.non_dovuta) continue;
    const c = canaleDi(f);
    if (!canali[c]) canali[c] = { giacenza_t: 0, entrato_t: 0, dichiarato_t: 0 };
    canali[c].resta_t = t3(num(canali[c].resta_t) + num(f.resta_t));
    canali[c].uscito_t = t3(num(canali[c].uscito_t) + num(f.uscito_t));
  }
  // I mesi ancora aperti, canale per canale (mesiAperti): solo dove le righe
  // portano i dodici mesi, cioe' sempre nel riepilogo vero.
  for (const c of Object.keys(canali)) {
    if (!('resta_t' in canali[c])) continue;
    const aperti = mesiAperti(((sito && sito.flussi) || []).filter(f => f && canaleDi(f) === c));
    if (aperti) canali[c].mesi_aperti = aperti;
  }
  return {
    sito: (sito && sito.sito) || '',
    chiave: (sito && sito.chiave) || '',
    ruolo: (sito && sito.tipo_destinazione) === 'stoc' ? 'stoc' : 'imp',
    // La rete e' l'unico canale che il portale tiene per gli impianti: il
    // confronto esiste solo li', e dove non c'e' si scrive null invece di zero.
    giacenza_portale_t: sito && sito.giacenza_portale_t === null ? null : t3(sito && sito.giacenza_portale_t),
    giacenza_calcolata_t: sito && sito.giacenza_calcolata_t === null ? null : t3(sito && sito.giacenza_calcolata_t),
    scarto_t: sito && (sito.scarto_t === null || sito.scarto_t === undefined) ? null : t3(sito.scarto_t),
    quadra: sito && sito.quadra === undefined ? null : (sito ? sito.quadra : null),
    dichiara_rete: !(sito && sito.dichiara_rete === false),
    canali,
  };
}

/**
 * CHI NON QUADRA.
 *
 * Solo chi ha un confronto col portale: un impianto senza fotografia non si
 * scosta da niente, e chiamarlo «da guardare» sarebbe un avviso che non si puo'
 * chiudere. La tolleranza e' quella della quadratura, una sola per tutto il
 * gestionale (TOLLERANZA_QUADRATURA_T). Uno stoccaggio lo dice
 * (`stoccaggio: true`), come lo dice il quadro della dashboard.
 */
export function scostamenti(siti) {
  return (siti || [])
    .filter(s => s && s.quadra === false && s.scarto_t !== null && s.scarto_t !== undefined
      && Math.abs(num(s.scarto_t)) > TOLLERANZA_QUADRATURA_T)
    .map(s => ({
      sito: s.sito || '',
      chiave: s.chiave || '',
      scarto_t: t3(s.scarto_t),
      calcolata_t: t3(s.giacenza_calcolata_t),
      portale_t: t3(s.giacenza_portale_t),
      ...(s.ruolo === 'stoc' ? { stoccaggio: true } : {}),
    }))
    .sort((a, b) => Math.abs(b.scarto_t) - Math.abs(a.scarto_t));
}

/**
 * «Un impianto», «uno stoccaggio», «2 impianti e uno stoccaggio»: chi si
 * scosta, col nome giusto. Uno scostamento senza il segno dello stoccaggio e'
 * un impianto, come nelle fotografie scritte prima del 12/10/2026.
 */
export function chiSiScosta(fuori) {
  const stoc = (fuori || []).filter(x => x && (x.stoccaggio === true || /\|(RETE|ACI)$/.test(String(x.chiave || '')))).length;
  const imp = (fuori || []).length - stoc;
  const impianti = imp === 1 ? 'un impianto' : `${imp} impianti`;
  const stoccaggi = stoc === 1 ? 'uno stoccaggio' : `${stoc} stoccaggi`;
  const testo = imp && stoc ? `${impianti} e ${stoccaggi}` : stoc ? stoccaggi : impianti;
  return { imp, stoc, testo, uno: imp + stoc === 1 };
}

/** I totali del giorno, canale per canale: mai un totale di tutti e tre. */
export function totaliGiorno(siti) {
  const per = {};
  for (const s of siti || []) {
    for (const [canale, v] of Object.entries((s && s.canali) || {})) {
      if (!per[canale]) per[canale] = { giacenza_t: 0, entrato_t: 0, dichiarato_t: 0 };
      // Il materiale di un canale non dovuto si conta a parte: e' arrivato davvero,
      // ma non e' giacenza da dichiarare, e sommarlo all'entrato senza dirlo
      // romperebbe il conto apertura + entrato - dichiarato del totale.
      if (v.non_dovuta) {
        per[canale].entrato_non_dovuto_t = t3(num(per[canale].entrato_non_dovuto_t) + num(v.entrato_t));
        continue;
      }
      per[canale].giacenza_t = t3(per[canale].giacenza_t + num(v.giacenza_t));
      per[canale].entrato_t = t3(per[canale].entrato_t + num(v.entrato_t));
      per[canale].dichiarato_t = t3(per[canale].dichiarato_t + num(v.dichiarato_t));
    }
  }
  return per;
}

/**
 * LA RIGA DEI DOPPIONI, quando ce ne sono.
 *
 * Un doppione non e' uno scostamento e non si mescola con quelli: li' il
 * portale e noi diciamo numeri diversi, qui siamo noi a dire due cose. E va
 * detto come doppione, perche' altrove si presenta travestito - nel confronto
 * col portale la gemella finisce fra «i mesi che il portale non conosce», che
 * manda a cercare un problema dove non e'.
 */
export function notaDoppioni(doppioni) {
  const d = doppioni || [];
  if (!d.length) return '';
  const primi = d.slice(0, 2).map(x => `${x.sito} ${x.mese} ${x.canale === 'ACI' ? `ACI ${x.provenienza || ''}`.trim() : x.canale === 'RETE' ? 'rete' : x.canale} (${x.quante})`);
  const altri = d.length - primi.length;
  return `${d.length === 1 ? 'Una dichiarazione è doppia' : `${d.length} dichiarazioni sono doppie`}: `
    + primi.join(', ') + (altri > 0 ? ` e altre ${altri}` : '') + '.';
}

/**
 * L'ESITO IN UNA RIGA, come si legge la mattina.
 *
 * Non «3 anomalie»: i nomi e i numeri, perche' chi legge sappia subito se e'
 * roba sua. Oltre tre si contano gli altri, altrimenti la riga non e' piu' una
 * riga.
 */
export function notaDelGiorno(fuori, quantiConfronto, doppioni, stoccaggiConfronto = 0) {
  const dopp = notaDoppioni(doppioni);
  if (!fuori || !fuori.length) {
    // Gli stoccaggi della rete col confronto a portale (Nappi Sud) si contano con
    // gli impianti, come nella pagina e nella dashboard («6 su 6»): e si dice.
    const chi = stoccaggiConfronto ? 'gli impianti e gli stoccaggi della rete' : 'gli impianti';
    const base = quantiConfronto
      ? `Tutti ${chi} con un confronto a portale quadrano (${quantiConfronto}).`
      : 'Nessun impianto ha un confronto col portale: niente da quadrare.';
    return dopp ? `${base} ${dopp}` : base;
  }
  const quali = chiSiScosta(fuori);
  // Il nome di uno stoccaggio porta il ruolo, se nella riga ci sono anche impianti.
  const stoc = (x) => x.stoccaggio === true || /\|(RETE|ACI)$/.test(String(x.chiave || ''));
  const primi = fuori.slice(0, 3).map(x => `${x.sito}${quali.imp && stoc(x) ? ' (stoccaggio)' : ''} ${x.scarto_t > 0 ? '+' : ''}${tt(x.scarto_t)} t`);
  const altri = fuori.length - primi.length;
  const soggetto = quali.testo.charAt(0).toUpperCase() + quali.testo.slice(1);
  const base = `${soggetto} ${quali.uno ? 'si scosta' : 'si scostano'} dal portale: `
    + primi.join(', ') + (altri > 0 ? ` e altri ${altri}` : '') + '.';
  return dopp ? `${base} ${dopp}` : base;
}

/**
 * LA FOTOGRAFIA DEL GIORNO, pronta da scrivere.
 * `siti` sono quelli di riepilogoDichiarazioni, gia' calcolati.
 */
export function fotografiaDelGiorno(siti, { giorno, anno, doppioni } = {}) {
  const voci = (siti || []).map(vociSito);
  // IL CONFRONTO COL PORTALE E' DELLA RETE, IMPIANTI E STOCCAGGI (12/10/2026).
  // Fino a questo giorno qui entravano i soli impianti: la pagina Dichiarazioni
  // e la dashboard dicevano la quadratura su impianti E stoccaggi della rete (6
  // su 6, con Nappi Sud), il guardiano su 5, e uno stoccaggio della rete che non
  // quadrava lo diceva la sezione Impianti della dashboard e «Da gestire» no. Ora
  // le righe sono le stesse della pagina: gli impianti, e gli stoccaggi con il
  // loro canale di rete (canaleDellaVoce). L'ACI degli stoccaggi resta fuori dal
  // verdetto, come nella dashboard, dove sta a parte.
  const conConfronto = voci.filter(v => canaleDellaVoce(v) === 'RETE' && v.giacenza_portale_t !== null);
  const fuori = scostamenti(conConfronto);
  const dopp = doppioni || [];
  return {
    giorno,
    anno: Number(anno),
    // Un doppione fa «da guardare» quanto uno scostamento: finche' c'e', i
    // numeri dipendono da quale modulo si guarda, e questo e' peggio di un
    // numero fuori di mezza tonnellata, perche' non si vede da nessuna parte.
    esito: (fuori.length || dopp.length) ? 'da_guardare' : 'in_linea',
    nota: notaDelGiorno(fuori, conConfronto.length, dopp, conConfronto.filter(v => v.ruolo === 'stoc').length),
    siti_json: JSON.stringify(voci),
    totali_json: JSON.stringify(totaliGiorno(voci)),
    scostamenti_json: JSON.stringify(fuori),
    doppioni_json: JSON.stringify(dopp),
  };
}

/** Rilegge una riga scritta: i JSON tornano oggetti, e un JSON rotto non rompe la pagina. */
export function leggiFotografia(r) {
  const apri = (s, difetto) => { try { return s ? JSON.parse(s) : difetto; } catch { return difetto; } };
  if (!r) return null;
  return {
    giorno: r.giorno || '',
    anno: Number(r.anno) || null,
    esito: r.esito || 'in_linea',
    nota: r.nota || '',
    siti: apri(r.siti_json, []),
    totali: apri(r.totali_json, {}),
    scostamenti: apri(r.scostamenti_json, []),
    doppioni: apri(r.doppioni_json, []),
    // LE IDENTITA' FRA MODULI (11/10/2026): le scrive controllaInvarianti, il passo
    // del guardiano che viene dopo la fotografia, nella stessa riga. La fotografia
    // non le tocca (fotografiaDelGiorno non ha quel campo, e riscrivere la riga lo
    // lascia com'e'); una riga che non le ha ancora dice null, non «tutto in linea».
    invarianti: apri(r.invarianti_json, null),
  };
}

/** Quanti giorni fa e' stata scritta: una fotografia vecchia non e' di stanotte. */
export function giorniFa(giorno, oggi) {
  const a = String(giorno || '').slice(0, 10), b = String(oggi || '').slice(0, 10);
  if (!a || !b) return null;
  const da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const al = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((al - da) / 86400000);
}
