// La pratica mensile delle dichiarazioni di Irigom: le regole, senza pagina.
//
// Le dichiarazioni di Irigom le prepariamo noi. Ogni mese, dal registro di
// carico e scarico dell'impianto, si ricavano:
//   - i formulari del ferro (EER 19.12.02) che sono della nostra commessa e con
//     che quota;
//   - gli allegati VII della nave con cui e' uscito il ciabattato (EER 19.12.04),
//     e quindi quante terziarie aprire a portale;
//   - i DDT del CSS-C, che viaggia con documento di trasporto perche' ha cessato
//     la qualifica di rifiuto;
//   - quanto dichiarare, e come ripartirlo, senza superare i 38.000 kg per
//     dichiarazione che il portale accetta.
//
// Le regole vengono dalle dichiarazioni di agosto 2026, rifatte da capo da un
// secondo agente con le sole regole scritte: 525 valori su 525 tornano. Il caso
// di prova e' in prove/praticaIrigom.mjs.
//
// Canali: la rete e l'extra raccolta restano separate. L'extra raccolta si
// attacca all'ultima terziaria (stesso allegato VII) ma si scrive in una tabella
// sua e si dichiara a parte.

export const MAX_PER_DICHIARAZIONE_KG = 38000;
export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const intero = (n) => Math.round(Number(n) || 0);
const alleDecine = (n) => Math.floor(n / 10) * 10;
const somma = (righe, campo) => righe.reduce((s, r) => s + (Number(r[campo]) || 0), 0);
// Il punto delle migliaia a mano: toLocaleString non lo mette sui numeri di quattro cifre.
const mig = (v) => String(intero(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ---------------------------------------------------------------------------
// Il ferro

/**
 * La quota ECOTYRE scritta nella nota di un formulario del ferro, in kg.
 *
 * Irigom annota a mano, nel commento della cella, come si divide un formulario
 * fra i consorzi: "ECP:10,72 ECT:6,62 LM: 10,62" (Ecopneus, Ecotyre, libero
 * mercato), in tonnellate. Le forme viste nel 2026: "ECT: 6,62", "ECT 2,66",
 * "ect: 6,6", "FECT:12.64", "ECT: 11,68 TON" e anche il numero prima della
 * sigla, "27,5 ECP 1,06 ECT". Si cerca prima il numero dopo ECT, poi quello prima.
 */
export function quotaEct(nota) {
  const t = String(nota || '');
  const dopo = /ECT\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i.exec(t);
  const prima = dopo ? null : /(\d+(?:[.,]\d+)?)\s*(?:TON|T)?\s*ECT\b/i.exec(t);
  const m = dopo || prima;
  if (!m) return null;
  const tonnellate = Number(m[1].replace(',', '.'));
  return Number.isFinite(tonnellate) ? Math.round(tonnellate * 1000) : null;
}

/**
 * Quali formulari del ferro del mese sono nostri e con che quota.
 *
 * - Quelli con destinatario MMF non entrano mai, nemmeno se arancioni: sono
 *   metalli puliti o sporchi di un altro giro.
 * - Cella arancione (FFC000): tutto il peso.
 * - Altrimenti conta la nota: se c'e' una quota ECT entra quella, qualunque sia
 *   il colore (nel 2026 il rosa dei parziali e' cambiato tre volte).
 * - Tutto il resto e' di altri: verde Ecopneus, note senza ECT.
 *
 * @param {array} righe [{ riga, data, trasportatore, destinatario, formulario, kg, colore, nota }]
 */
export function formulariFerro(righe) {
  const esiti = (righe || []).map(r => {
    const kg = intero(r.kg);
    const base = { ...r, kg };
    if (/^\s*mmf\s*$/i.test(r.destinatario || '')) return { ...base, quota_kg: 0, esito: 'escluso', motivo: 'destinatario MMF: non e\' della commessa' };
    if (String(r.colore || '').toUpperCase().slice(-6) === 'FFC000') return { ...base, quota_kg: kg, esito: 'intero', motivo: 'cella arancione: tutto il formulario' };
    const q = quotaEct(r.nota);
    if (q !== null && q > 0) return { ...base, quota_kg: Math.min(q, kg), esito: 'quota', motivo: `quota ECT nella nota: ${mig(q)} kg` };
    return { ...base, quota_kg: 0, esito: 'escluso', motivo: r.nota ? 'la nota non ha una quota ECT' : 'di un altro consorzio' };
  });
  const nostri = esiti.filter(r => r.quota_kg > 0);
  return {
    esiti,
    tabella: nostri,
    peso_kg: somma(nostri, 'kg'),
    quota_kg: somma(nostri, 'quota_kg'),
  };
}

// ---------------------------------------------------------------------------
// Gli allegati VII e le terziarie

const gruppoTrasporto = (a) => (/smoco/i.test(a.trasportatore || '') ? 0 : /transar/i.test(a.trasportatore || '') ? 1 : 2);

/** Prima SMOCO, poi TRANSAR, poi gli altri; dentro ogni gruppo per numero. */
export function ordinaAllegati(allegati) {
  return [...(allegati || [])].sort((a, b) => gruppoTrasporto(a) - gruppoTrasporto(b) || (Number(a.numero) || 0) - (Number(b.numero) || 0));
}

/**
 * Gli allegati VII da dichiarare: il gruppo piu' corto, nell'ordine di priorita',
 * che arriva almeno al ciabattato uscito nel mese (extra raccolta compresa).
 * Tante terziarie quanti allegati scelti.
 */
export function scegliAllegati(allegati, cippatoKg) {
  const ordinati = ordinaAllegati(allegati);
  const scelti = [];
  let coperto = 0;
  for (const a of ordinati) {
    if (coperto >= cippatoKg) break;
    scelti.push(a);
    coperto += intero(a.kg);
  }
  return { ordinati, scelti, coperto_kg: coperto, basta: coperto >= intero(cippatoKg) };
}

/**
 * Ripartisce il ferro su un gruppo di dichiarazioni: a ciascuna la stessa quota,
 * alle decine, e all'ultima il resto. Se una supera i 38.000 kg, l'eccedenza va
 * alle altre finche' c'e' posto, sempre a decine.
 *
 * @param {array} posti [{ base_kg }] il materiale di ciascuna (ciabattato o CSS-C)
 */
export function ripartisciFerro(posti, ferroKg, max = MAX_PER_DICHIARAZIONE_KG) {
  const n = posti.length;
  const ferro = posti.map(() => 0);
  if (!n || ferroKg <= 0) return { ferro, avanza_kg: Math.max(0, intero(ferroKg)) };
  const quota = alleDecine(ferroKg / n);
  for (let i = 0; i < n; i++) ferro[i] = i < n - 1 ? quota : intero(ferroKg) - quota * (n - 1);
  // Chi sfora cede l'eccedenza, e l'eccedenza si divide in parti uguali, a
  // decine, fra chi ha ancora posto: messa tutta su una riga, a luglio 2026 ne
  // sarebbe uscita una col 74% di ferro, e nel foglio nessuna ha mai passato il 40%.
  let eccedenza = 0;
  for (let i = 0; i < n; i++) {
    const posto = max - intero(posti[i].base_kg);
    if (ferro[i] > posto) { eccedenza += ferro[i] - Math.max(0, posto); ferro[i] = Math.max(0, posto); }
  }
  const posto = (i) => max - intero(posti[i].base_kg) - ferro[i];
  for (let giro = 0; giro < 100 && eccedenza > 0; giro++) {
    const conPosto = posti.map((_, i) => i).filter(i => posto(i) > 0);
    if (!conPosto.length) break;
    const parte = Math.max(10, alleDecine(eccedenza / conPosto.length));
    for (const i of conPosto) {
      const metto = Math.min(parte, posto(i), eccedenza);
      ferro[i] += metto;
      eccedenza -= metto;
      if (eccedenza <= 0) break;
    }
  }
  return { ferro, avanza_kg: eccedenza };
}

// ---------------------------------------------------------------------------
// L'extra raccolta

/**
 * Divide i PFU di extra raccolta fra ciabattato e ferro. La ripartizione la da'
 * l'impianto; se non c'e', si propone quella dell'ultima volta (agosto 2026:
 * 460 kg = 340 + 120, cioe' il 26% di ferro), alle decine, e resta correggibile.
 */
export function dividiExtra(pfuKg, quotaFerro = 120 / 460) {
  const pfu = intero(pfuKg);
  const ferro = Math.round((pfu * quotaFerro) / 10) * 10;
  return { pfu_kg: pfu, cippato_kg: pfu - ferro, ferro_kg: ferro };
}

// ---------------------------------------------------------------------------
// Il mese

/**
 * Compone la pratica del mese.
 *
 * @param {object} p
 * @param {object} p.riga            riga del mese dal foglio Cons. (uscite e giacenze)
 * @param {array}  p.ferro           formulari del ferro del mese (tutti, anche non nostri)
 * @param {array}  p.allegati        allegati VII del mese
 * @param {array}  p.ddt             DDT di CSS-C nostri del mese [{ ddt, data, kg }]
 * @param {number} p.portaleFineMeseKg giacenza di rete a portale a fine mese (per fine trasporto)
 * @param {string} p.lettura         'giacenza' (regola del 19/09/2026) oppure 'uscite'
 * @param {object} p.extra           { formulari: [...], cippato_kg, ferro_kg } oppure null
 * @param {number} p.extraInGiacenzaKg extra raccolta arrivata a Irigom entro fine mese e non ancora lavorata
 * @param {array}  p.terziarie       numeri TER aperti a portale, se gia' ci sono
 */
export function componiMese({ riga, ferro = [], allegati = [], ddt = [], portaleFineMeseKg = null, lettura = 'giacenza', extra = null, extraInGiacenzaKg = 0, terziarie = [] }) {
  const avvisi = [];
  const blocchi = [];
  const V = intero(riga && riga.uscite_cippato_kg);
  const X = intero(riga && riga.uscite_ferro_kg);
  const Y = intero(riga && riga.uscite_cssc_kg);
  // Quanto deve restare a portale dopo la dichiarazione del mese, regola
  // dell'utente del 22/09/2026: la somma delle celle AD e AE della riga del mese
  // nel foglio Cons. AD e' la giacenza TOTALE di gomma (cippato AA + SACI AB +
  // PFU interi AC), AE quella dei metalli ferrosi (19.12.02): insieme sono quello
  // che resta in impianto dei PFU ricevuti, ancora da trattare o da far uscire.
  // Il CSS-C in giacenza (Z) non c'e': una volta prodotto non e' piu' rifiuto.
  // Torna al chilo con luglio (381.860 + 25.140) e agosto (144.780 + 0) 2026.
  const gomma = riga && riga.giacenza_totale_kg !== undefined && riga.giacenza_totale_kg !== null
    ? intero(riga.giacenza_totale_kg)
    : intero(riga && riga.giacenza_cippato_kg) + intero(riga && riga.giacenza_saci_kg) + intero(riga && riga.giacenza_intero_kg);
  const restaRegistroKg = gomma + intero(riga && riga.giacenza_ferro_kg);
  // La giacenza del registro comprende anche l'extra raccolta arrivata e non
  // ancora lavorata, che il portale di rete non conosce: a portale deve restare la
  // sola parte di rete. A luglio 2026 non la si era tolta, e 460 kg di extra sono
  // rimasti a portale come rete.
  const restaKg = Math.max(0, restaRegistroKg - intero(extraInGiacenzaKg));
  const extraPfu = extra ? intero(extra.cippato_kg) + intero(extra.ferro_kg) : 0;
  const extraCipp = extra ? intero(extra.cippato_kg) : 0;
  const extraFerro = extra ? intero(extra.ferro_kg) : 0;

  // Un mese ancora tutto a zero nel registro non e' compilato: non si dichiara.
  const vuoto = !V && !X && !Y && !restaRegistroKg && !(ddt || []).length;
  if (vuoto) blocchi.push('Il mese non e\' ancora compilato nel registro: giacenze, uscite e DDT sono tutti a zero. Finche\' e\' cosi\' non si dichiara nulla e i PFU restano in giacenza.');

  // Il ferro dei formulari: deve fare la colonna X del foglio Cons.
  const ff = formulariFerro(ferro);
  if (ff.quota_kg !== X) avvisi.push(`I formulari del ferro danno ${mig(ff.quota_kg)} kg di quota nostra, il foglio Cons. ne segna ${mig(X)}: il registro va controllato prima di dichiarare.`);

  // Le due letture di quanto dichiarare.
  const uscite = { totale_kg: V + X + Y, rete_kg: V + X + Y - extraPfu };
  const giacenza = portaleFineMeseKg === null || portaleFineMeseKg === undefined ? null
    : { portale_kg: intero(portaleFineMeseKg), resta_kg: restaKg, extra_in_giacenza_kg: intero(extraInGiacenzaKg), rete_kg: intero(portaleFineMeseKg) - restaKg };
  const scarto = giacenza ? giacenza.rete_kg - uscite.rete_kg : null;
  const usata = lettura === 'uscite' || !giacenza ? 'uscite' : 'giacenza';
  if (lettura === 'giacenza' && !giacenza) avvisi.push('Manca la giacenza a portale di fine mese: uso le uscite del registro.');
  const reteKg = usata === 'giacenza' ? giacenza.rete_kg : uscite.rete_kg;

  // Il ferro e' la parte che si aggiusta: CSS-C e ciabattato sono fatti documentati.
  const ferroTotale = reteKg + extraPfu - V - Y;
  if (ferroTotale < 0) blocchi.push(`Con questa lettura il ferro verrebbe negativo (${mig(ferroTotale)} kg): ciabattato e CSS-C usciti superano gia' quanto dichiarare. Controlla la giacenza a portale e la riga del mese.`);
  if (ferroTotale > X) avvisi.push(`Il ferro da dichiarare (${mig(ferroTotale)} kg) supera quello uscito nel mese secondo il registro (${mig(X)} kg): la dichiarazione EER 19.12.02 resta di ${mig(X)} kg, la differenza la porta il portale.`);

  // Gli allegati VII: quanti ne servono a coprire il ciabattato.
  const scelta = scegliAllegati(allegati, V);
  if (V > 0 && !scelta.basta) blocchi.push(`Gli allegati VII del mese coprono ${mig(scelta.coperto_kg)} kg, meno del ciabattato uscito (${mig(V)} kg): mancano allegati nel registro.`);
  const n = scelta.scelti.length;

  // Le righe da dichiarare: prima i DDT di CSS-C (spezzati se oltre il limite),
  // poi le terziarie, una per allegato scelto.
  const righeCssc = [];
  for (const d of ddt || []) {
    const kg = intero(d.kg);
    const parti = Math.max(1, Math.ceil(kg / MAX_PER_DICHIARAZIONE_KG));
    let resto = kg;
    for (let i = 0; i < parti; i++) {
      const quota = Math.min(MAX_PER_DICHIARAZIONE_KG, resto);
      righeCssc.push({ tipo: 'cssc', ddt: d.ddt, data: d.data, parte: parti > 1 ? `${i + 1} di ${parti}` : '', base_kg: quota, cssc_kg: quota });
      resto -= quota;
    }
  }
  const righeTer = scelta.scelti.map((a, i) => ({
    tipo: 'terziaria', allegato: a.numero, trasportatore: a.trasportatore, destinatario: a.destinatario, data: a.data,
    peso_allegato_kg: intero(a.kg),
    base_kg: i < n - 1 ? intero(a.kg) : V - somma(scelta.scelti.slice(0, n - 1), 'kg'),
  }));
  righeTer.forEach(r => { r.cippato_kg = r.base_kg; });

  const posti = [...righeCssc, ...righeTer];
  const { ferro: quote, avanza_kg: avanza } = ripartisciFerro(posti, Math.max(0, ferroTotale));
  posti.forEach((r, i) => { r.ferro_kg = quote[i]; r.totale_kg = r.base_kg + r.ferro_kg; });
  // Il ferro che non entra nelle dichiarazioni del mese non si carica da solo: le
  // uscite di metalli non vanno a portale senza un DDT o un allegato VII. Resta in
  // giacenza e rientra con la nave dopo, come a gennaio, marzo e aprile 2026:
  // dichiarazioni di soli metalli non ce ne sono mai state.
  const soloFerro = [];
  if (avanza > 0) {
    avvisi.push(righeTer.length
      ? `Restano ${mig(avanza)} kg di ferro che non entrano nelle terziarie senza superare ${mig(MAX_PER_DICHIARAZIONE_KG)} kg: servirebbe un altro allegato VII; altrimenti restano in giacenza per la nave dopo.`
      : `Restano ${mig(avanza)} kg di ferro che non entrano nei DDT di CSS-C: senza una nave non si caricano, restano in giacenza e si dichiarano con la prossima.`);
  }
  if (!posti.length && ferroTotale > 0) avvisi.push('Nel mese sono usciti solo metalli: a portale non si carica nulla e la quantita\' resta in giacenza fino alla nave dopo.');

  // L'extra raccolta si attacca all'ultima terziaria e si scrive a parte.
  let rigaExtra = null;
  if (extra && extraPfu > 0) {
    const ultima = righeTer[righeTer.length - 1] || null;
    if (!ultima) avvisi.push('C\'e\' extra raccolta da dichiarare ma nessuna terziaria a cui attaccarla: resta per il mese dopo.');
    else if (ultima.cippato_kg < extraCipp || ultima.ferro_kg < extraFerro) blocchi.push('L\'ultima terziaria e\' troppo piccola per contenere l\'extra raccolta: controlla la ripartizione.');
    else {
      ultima.cippato_kg -= extraCipp;
      ultima.ferro_kg -= extraFerro;
      ultima.totale_kg = ultima.cippato_kg + ultima.ferro_kg;
      rigaExtra = { allegato: ultima.allegato, trasportatore: ultima.trasportatore, destinatario: ultima.destinatario, data: ultima.data, peso_allegato_kg: ultima.peso_allegato_kg, cippato_kg: extraCipp, ferro_kg: extraFerro, totale_kg: extraPfu, formulari: extra.formulari || [] };
    }
  }

  // I numeri TER, in ordine crescente, vanno agli allegati nell'ordine di scelta.
  const ter = [...new Set((terziarie || []).map(t => String(t).trim().toUpperCase()).filter(Boolean))].sort();
  righeTer.forEach((r, i) => { r.terziaria = ter[i] || ''; });
  if (rigaExtra && righeTer.length) rigaExtra.terziaria = righeTer[righeTer.length - 1].terziaria;
  if (ter.length && ter.length !== righeTer.length) avvisi.push(`Servono ${righeTer.length} terziarie e ne sono state indicate ${ter.length}.`);

  for (const r of [...righeCssc, ...righeTer]) {
    r.residuo_kg = MAX_PER_DICHIARAZIONE_KG - r.totale_kg;
    if (r.totale_kg > MAX_PER_DICHIARAZIONE_KG) blocchi.push(`Una dichiarazione supera ${mig(MAX_PER_DICHIARAZIONE_KG)} kg (${mig(r.totale_kg)}).`);
  }

  const cssc = { righe: righeCssc, cssc_kg: somma(righeCssc, 'cssc_kg'), ferro_kg: somma(righeCssc, 'ferro_kg'), totale_kg: somma(righeCssc, 'totale_kg') };
  if (cssc.cssc_kg !== Y) avvisi.push(`I DDT di CSS-C del mese fanno ${mig(cssc.cssc_kg)} kg, il foglio Cons. ne segna ${mig(Y)}.`);
  const terz = {
    righe: righeTer,
    peso_allegati_kg: somma(righeTer, 'peso_allegato_kg'),
    cippato_kg: somma(righeTer, 'cippato_kg'),
    ferro_kg: somma(righeTer, 'ferro_kg'),
    totale_kg: somma(righeTer, 'totale_kg'),
  };
  const reteDichiarata = cssc.totale_kg + terz.totale_kg + somma(soloFerro, 'totale_kg');
  return {
    vuoto,
    letture: { uscite, giacenza, scarto_kg: scarto, usata },
    rete_kg: reteDichiarata,
    extra_kg: rigaExtra ? rigaExtra.totale_kg : 0,
    ferro: { ...ff, dichiarato_kg: ff.quota_kg },
    allegati: { ordinati: scelta.ordinati, scelti: scelta.scelti, coperto_kg: scelta.coperto_kg },
    terziarie_da_aprire: righeTer.length,
    // Usciti solo metalli ferrosi, nessuna gomma e nessun CSS-C: il mese si segna
    // "solo metalli ferrosi" e a portale non si carica nulla.
    solo_metalli: !posti.length && X > 0,
    cssc,
    terziarie: terz,
    solo_ferro: soloFerro,
    extra: rigaExtra,
    // I materiali per la dichiarazione nel gestionale, della sola rete.
    materiali: {
      cippato_kg: terz.cippato_kg,
      metalli_kg: cssc.ferro_kg + terz.ferro_kg + somma(soloFerro, 'ferro_kg'),
      cssc_kg: cssc.cssc_kg,
    },
    avvisi,
    blocchi,
  };
}

export { mig as migliaia };
