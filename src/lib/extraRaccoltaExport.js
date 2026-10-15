// Esportazione Excel e PDF per Extra Raccolta — formato amministrazione.
//
// I DUE FILE SI VESTONO E DICONO LA DATA DEI DATI (chiusura dell'audit,
// 11/10/2026). L'Excel usciva da SheetJS senza fascia ne' piede, e il PDF era
// una griglia scritta a mano, senza intestazioni in negativo ne' numero di
// pagina. Ora l'Excel passa dal corredo comune (fogliProfessionali.js) con le
// stesse righe di prima, cella per cella, e il PDF da esportaSezioniPdf, come la
// passiva: tutti e due col blocco di testa - canale, mese per fine trasporto,
// fino a che giorno arrivano le schede, generato il ... da ....
//
// IL SURPLUS SULLE TARIFFE HA LA SUA RIGA ANCHE QUI (13/10/2026). Il Fuel
// Surcharge del consorzio Ecotyre, +5 €/t dal 01/10/2026 al 31/12/2026, vale
// anche sull'extra raccolta: SMOCO lo fattura a Ecotyre con una riga a parte,
// sulle stesse tonnellate degli interventi fatturati nel mese. Fino a oggi i due
// file ricevevano i soli prezzi e riportavano gli importi standard, e la pagina
// lo diceva accanto ai pulsanti; l'utente, il 13/10/2026 sera, ha accettato la
// proposta: la riga del Fuel Surcharge anche nei file Excel e PDF dell'elenco.
// - Nel riepilogo, dopo i sovracosti e prima del Totale imponibile, una riga
//   per surplus e per mese: il nome, l'importo da Ecotyre, e «t × €/t» col mese,
//   gli interventi fatturati, l'origine e il periodo. Il centesimo e' quello del
//   mese, come in fattura (surplusDelMese di extraRaccoltaCalc.js, arrotondato
//   una volta sui chili del mese), non la somma delle quote dei singoli
//   interventi; il Totale imponibile e' standard + surplus, cioe' la fattura.
// - I costi li vede solo l'amministratore (opzioni.isAdmin, e senza si nega):
//   l'analisi per produttore, coi costi e il margine, esce solo per lui. Prima
//   del 13/10 l'analisi usciva a chiunque premesse il pulsante, mentre nella
//   pagina costi e margine li vede solo l'amministratore.
// - Senza surplus il file dell'amministratore e' quello di prima, cella per cella.
//
// LE DECISIONI DELL'UTENTE DEL 13/10/2026 SERA, testuali: «per l'extra raccolta
// noi fatturiamo al consorzio solo le primarie con eventuali surplus [...]; le
// eventuali secondarie di extra raccolta saranno trattate come normali trasporti
// di secondaria», e «il fuel surcharge non riguarda i produttori ma i
// trasportatori ovvero i raccoglitori, su questo non ci devono essere
// confusioni». Quindi:
// - il TOTALE QUANTITA' del riepilogo conta solo i chili fatturati a Ecotyre, le
//   primarie col peso effettivo; le secondarie stanno in una riga a parte,
//   «Trasporti di secondaria (non si fatturano a Ecotyre)». Prima il totale le
//   sommava, e tre righe sotto il surplus valeva su meno chili di quelli scritti;
// - il surplus non sta piu' nell'analisi per produttore, che e' lo standard: ha
//   un blocco suo, «Fuel Surcharge ai raccoglitori» (il nome del surplus e chi
//   lo riceve), una riga per raccoglitore con le tonnellate, il ricavo da
//   Ecotyre e, solo all'amministratore, il costo e il margine. Il conto del mese
//   col surplus (costi, ricavi, margine: standard, surplus, totale) chiude il
//   file dell'amministratore.
import { cifreItaliane } from '@/lib/formatoSoldi';
import { documentoDa, nuovaCartella, foglioDaRighe, scaricaCartella, FORMATI } from '@/lib/fogliProfessionali';
import { giornoRoma } from '@/lib/giornoItaliano';
import { calcExtraRaccolta, totaleRiga, aggregaPerProduttore, prezzoAttivoExtra, avvisoPesoMancante, surplusDelMese, titoloSurplus, aiChiSurplus, testoInterventiSenzaPrezzo } from '@/lib/extraRaccoltaCalc';
import { baseSurplus, dettaglioSurplus, nomiSurplusDistinti } from '@/lib/surplusVista';
import { testoEuroT } from '@/lib/surplus';

// Il prezzo in colonna e' quello con cui la riga si fattura: il prezzo scritto
// sull'intervento o, se manca, la tariffa della tabella o la base dell'anno.
// Scritto zero, il report diceva un prezzo e la fattura un altro.
//
// IL CONTESTO E' QUELLO DELLA PAGINA (chiusura dell'audit, 11/10/2026). Il file
// chiamava prezzoAttivoExtra, totaleRiga e aggregaPerProduttore senza le tariffe
// che la pagina ha letto, e conosceva solo il prezzo scritto e la base dell'anno:
// con la Tariffa EXTRA_RACCOLTA a un valore diverso dalla base, o dal 2027, il
// file diceva un prezzo e la pagina e la fattura un altro. Ora la pagina passa
// il suo contesto (contestoPrezzi di extraRaccoltaCalc.js); senza, restano i
// due gradini che non hanno bisogno di letture.
const prezzoRiga = (r, contesto) => prezzoAttivoExtra(r, contesto).valore;

const MESI_UPPER = {
  'Gennaio': 'GENNAIO', 'Febbraio': 'FEBBRAIO', 'Marzo': 'MARZO',
  'Aprile': 'APRILE', 'Maggio': 'MAGGIO', 'Giugno': 'GIUGNO',
  'Luglio': 'LUGLIO', 'Agosto': 'AGOSTO', 'Settembre': 'SETTEMBRE',
  'Ottobre': 'OTTOBRE', 'Novembre': 'NOVEMBRE', 'Dicembre': 'DICEMBRE'
};

const r2 = (n) => Math.round(n * 100) / 100;

// Il mese di una riga del surplus, 'aaaa-mm', a parole: «Ottobre 2026».
const NOMI_MESI = Object.keys(MESI_UPPER);
const nomeDelMese = (mese) => `${NOMI_MESI[Number(String(mese).slice(5, 7)) - 1] || ''} ${String(mese).slice(0, 4)}`.trim();

// Le voci dell'analisi per produttore, nell'ordine delle colonne.
const VOCI_ANALISI = ['costi_aggiuntivi', 'raccolta', 'stoccaggio', 'trattamento', 'pulizia', 'trasporto', 'sovracosto_raccoglitore', 'sovracosto_impianto', 'costo_totale', 'ricavi', 'margine'];

// La forma della riga del surplus nel foglio, la stessa della passiva
// (passivaAmministrazioneExcel.js): fondo indaco chiaro, testo indaco scuro in
// corsivo, barra indaco a sinistra. Indaco e non ambra o rosso, che qui vogliono
// dire «c'e' un problema»: il surplus non lo e'.
const SURPLUS = 'FF6366F1';
const SURPLUS_CHIARO = 'FFEEF2FF';
const SURPLUS_SCURO = 'FF3730A3';

// Chi riceve il surplus, dalla sua prestazione (aiChiSurplus e titoloSurplus
// di extraRaccoltaCalc.js, che usa anche la nota della pagina).
const CHI = { RACCOLTA: 'RACCOGLITORE', TRATTAMENTO: 'IMPIANTO', CONFERIMENTO_STOCCAGGIO: 'STOCCAGGIO', TRASPORTO_SECONDARIA: 'TRASPORTATORE' };
const prestazioneDi = (v) => String((v && v.prestazione) || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
const haParte = (x) => x !== null && x !== undefined;
const tonnellate = (kg) => cifreItaliane((Number(kg) || 0) / 1000, 2, 3);

/**
 * LE RIGHE DEL SURPLUS IN FATTURA, dal conto del mese (surplusDelMese): una per
 * mese e per surplus con l'importo da Ecotyre, gia' al centesimo del mese:
 * { mese, nome, nome_surplus, euro_t, kg, importo, dettaglio, descrizione }.
 * Due surplus con lo stesso nome nello stesso mese (un importo che cambia a
 * meta' mese) si distinguono con nomiSurplusDistinti.
 */
function righeDellaFattura(conto) {
  const mesi = [...new Set(conto.attivo.map(v => v.mese))];
  const nomi = new Map();
  for (const m of mesi) {
    const delMese = conto.attivo.filter(v => v.mese === m);
    nomiSurplusDistinti(delMese).forEach((n, i) => nomi.set(delMese[i], n));
  }
  // La descrizione dice su quali interventi vale: quelli fatturati del mese, gli
  // stessi chili del TOTALE QUANTITA' (dal 13/10/2026 sera, solo i fatturati).
  return conto.attivo.map(v => {
    const dettaglio = dettaglioSurplus(v);
    const quali = v.interventi === 1 ? "dell'intervento fatturato" : `dei ${cifreItaliane(v.interventi, 0, 0)} interventi fatturati`;
    return {
      mese: v.mese, nome: nomi.get(v) || v.nome, nome_surplus: v.nome, euro_t: v.euro_t, kg: v.kg, importo: v.importo, dettaglio,
      descrizione: `Surplus di ${nomeDelMese(v.mese).toLowerCase()}: ${baseSurplus(v.kg, v.euro_t)}, sulle stesse tonnellate ${quali}${dettaglio ? ` · ${dettaglio}` : ''}`,
    };
  });
}

/**
 * IL SURPLUS A CHI VA (13/10/2026): un blocco per surplus («Fuel Surcharge ai
 * raccoglitori»), con un gruppo per mese (e per importo, se cambia a meta'
 * mese) e una riga per fornitore che lo riceve - il raccoglitore, mai il
 * produttore. Dalle righe per_fornitore di surplusDelMese.
 *
 * -> [{ titolo, chi, prestazione, gruppi: [{ intestazione, righe: [{ fornitore,
 *       kg, costo, ricavo, margine, nota }], totale: { etichetta, kg, costo,
 *       ricavo, margine }, nota }], totale: { etichetta, kg, costo, ricavo, margine } | null }]
 *
 * - Il ricavo di una riga e' la parte da Ecotyre sui chili di quel fornitore;
 *   quello del gruppo e' la riga in fattura del mese (arrotondata una volta sul
 *   mese): se le righe fanno un centesimo diverso lo dice la nota.
 * - Il costo e il margine ci sono solo per l'amministratore (conCosti); chi non
 *   lo e' non vede nemmeno un surplus pagato soltanto ai fornitori. Un
 *   fornitore interno (SMOCO) non lo riceve: costo zero, e la nota lo dice.
 * - Le tonnellate sono quelle su cui il fornitore lo riceve; per chi non e'
 *   amministratore, quelle su cui lo paga Ecotyre.
 */
function surplusAChi(conto, conCosti) {
  const fattura = new Map(conto.attivo.map(v => [`${v.mese}|${v.chiave}`, v]));
  const righe = (conto.per_fornitore || []).filter(v => conCosti || (haParte(v.euro_t_attiva) && v.kg_attivo > 0));
  const blocchi = new Map();
  for (const v of righe) {
    const prestazione = prestazioneDi(v);
    const kb = `${String(v.nome || '').trim().toLowerCase()}|${prestazione}`;
    if (!blocchi.has(kb)) blocchi.set(kb, { nome: v.nome, prestazione, gruppi: new Map() });
    const b = blocchi.get(kb);
    const kgr = `${v.mese}|${v.chiave}`;
    if (!b.gruppi.has(kgr)) b.gruppi.set(kgr, { mese: v.mese, chiave: v.chiave, voce: v, righe: [] });
    b.gruppi.get(kgr).righe.push(v);
  }
  const ordineBlocchi = [...blocchi.values()].sort((x, y) => String(x.nome).localeCompare(String(y.nome), 'it') || x.prestazione.localeCompare(y.prestazione));
  return ordineBlocchi.map(b => {
    const aiChi = aiChiSurplus(b.prestazione);
    const gruppi = [...b.gruppi.values()].sort((x, y) => x.mese.localeCompare(y.mese) || String(x.voce.dal || '').localeCompare(String(y.voce.dal || '')));
    // Due importi dello stesso surplus nello stesso mese: «Fuel Surcharge a 5,00 €/t».
    const distinti = new Map();
    for (const m of [...new Set(gruppi.map(g => g.mese))]) {
      const delMese = gruppi.filter(g => g.mese === m);
      if (delMese.length > 1) nomiSurplusDistinti(delMese.map(g => g.voce)).forEach((n, i) => distinti.set(delMese[i], n));
    }
    const fatti = gruppi.map(g => {
      const v = g.voce;
      const attiva = haParte(v.euro_t_attiva);
      const passiva = haParte(v.euro_t_passiva);
      const nomeMese = nomeDelMese(g.mese);
      const quale = distinti.get(g);
      const euroT = [attiva ? `${testoEuroT(v.euro_t_attiva)} da Ecotyre` : '', conCosti && passiva ? `${testoEuroT(v.euro_t_passiva)} ${aiChi}` : ''].filter(Boolean).join(', ');
      // L'intestazione in due pezzi: il mese (e quale importo) e come vale -
      // origine, periodo, €/t. Nel foglio stanno in una cella, nel PDF il secondo
      // va nella colonna delle note, dove c'e' posto per andare a capo.
      const quando = `${nomeMese}${quale ? ` · ${quale}` : ''}`;
      const come = [dettaglioSurplus(v), euroT].filter(Boolean).join(' · ');
      const intestazione = [quando, come].filter(Boolean).join(' · ');
      const righeGruppo = g.righe.map(x => {
        const kg = conCosti && haParte(x.costo) && x.kg_passivo > 0 ? x.kg_passivo : x.kg_attivo;
        const costo = conCosti ? x.costo : undefined;
        const margine = conCosti && (haParte(x.ricavo) || haParte(x.costo)) ? r2((x.ricavo || 0) - (x.costo || 0)) : null;
        const nota = !conCosti ? '' : [
          x.interno ? `interno, non si paga${x.ricavo ? ': il surplus da Ecotyre su queste tonnellate resta a SMOCO' : ''}` : '',
          x.sul_movimento && x.sul_movimento.length ? `fattura anche per ${x.sul_movimento.join(', ')}` : '',
          haParte(x.costo) && haParte(x.ricavo) && x.kg_attivo !== x.kg_passivo ? `da Ecotyre su ${tonnellate(x.kg_attivo)} t: le secondarie non si fatturano` : '',
        ].filter(Boolean).join(' · ');
        return { fornitore: x.fornitore || '(senza trasportatore)', kg, costo, ricavo: x.ricavo, margine, nota };
      }).sort((x, y) => (y.kg - x.kg) || x.fornitore.localeCompare(y.fornitore, 'it'));
      const somma = (campo) => {
        const conValore = righeGruppo.filter(x => haParte(x[campo]));
        return conValore.length ? r2(conValore.reduce((s, x) => s + x[campo], 0)) : null;
      };
      const inFattura = attiva ? (fattura.get(`${g.mese}|${g.chiave}`) || { importo: null }).importo : null;
      const ricavoRighe = somma('ricavo');
      const costo = conCosti ? somma('costo') : undefined;
      const totale = {
        etichetta: `Totale ${quale ? `${quale}, ` : ''}${nomeMese.toLowerCase()}`,
        kg: righeGruppo.reduce((s, x) => s + (Number(x.kg) || 0), 0),
        costo,
        ricavo: inFattura,
        margine: conCosti && (haParte(inFattura) || haParte(costo)) ? r2((inFattura || 0) - (costo || 0)) : null,
      };
      const nota = haParte(inFattura) && haParte(ricavoRighe) && Math.abs(inFattura - ricavoRighe) > 0.004
        ? `Il ricavo da Ecotyre si arrotonda una volta sul mese, come in fattura: le righe fanno ${cifreItaliane(ricavoRighe, 2, 2)} €, la riga in fattura ${cifreItaliane(inFattura, 2, 2)} €.`
        : '';
      return { intestazione, quando, come, righe: righeGruppo, totale, nota };
    });
    const totale = fatti.length > 1 ? (() => {
      const somma = (campo) => { const c = fatti.filter(g => haParte(g.totale[campo])); return c.length ? r2(c.reduce((s, g) => s + g.totale[campo], 0)) : null; };
      const costo = conCosti ? somma('costo') : undefined;
      const ricavo = somma('ricavo');
      return {
        etichetta: `TOTALE ${String(b.nome).toUpperCase()}`,
        kg: fatti.reduce((s, g) => s + g.totale.kg, 0),
        costo, ricavo,
        margine: conCosti && (haParte(ricavo) || haParte(costo)) ? r2((ricavo || 0) - (costo || 0)) : null,
      };
    })() : null;
    return { titolo: titoloSurplus(b.nome, b.prestazione), chi: CHI[b.prestazione] || 'RACCOGLITORE', prestazione: b.prestazione, gruppi: fatti, totale };
  });
}

/**
 * L'ANALISI PER PRODUTTORE, la stessa nell'Excel e nel PDF: le righe dei
 * produttori e il TOTALE, SOLO LO STANDARD. Il surplus non e' del produttore
 * (decisione dell'utente del 13/10/2026): sta nel blocco «... ai raccoglitori»
 * e nel conto del mese. Il totale somma i valori dei produttori non
 * arrotondati, come prima.
 */
function analisiPerProduttore(dati) {
  const tot = Object.fromEntries(VOCI_ANALISI.map(k => [k, 0]));
  let senzaPrezzo = 0;
  // UN MARGINE FATTO DA UN RICAVO CHE MANCA NON E' UN MARGINE (revisione del
  // 15/10/2026 sul difetto 18 della prova del cambio d'anno). A gennaio 2027 un
  // intervento senza prezzo (0,6 t, base 2026 chiusa) e uno a 210 €/t: la pagina
  // diceva «—», l'Excel e il PDF per l'amministratore «TOTALE ... -113,50» e
  // «Margine % complessivo -77,21%». Il margine del produttore che ha un
  // intervento da fatturare senza prezzo, quello del TOTALE e la percentuale
  // sono «—», e la frase dice perche' (la stessa della pagina,
  // testoInterventiSenzaPrezzo). Costi e ricavi restano scritti.
  const margineDi = (n, valore) => (n > 0 ? '—' : r2(valore));
  const produttori = Object.entries(dati.per_produttore).map(([p, v]) => {
    for (const k of VOCI_ANALISI) tot[k] += v[k];
    const suoi = Number(v.senza_prezzo) || 0;
    senzaPrezzo += suoi;
    return [p, ...VOCI_ANALISI.map(k => (k === 'margine' ? margineDi(suoi, v[k]) : r2(v[k])))];
  });
  return {
    produttori,
    totale: ['TOTALE', ...VOCI_ANALISI.map(k => (k === 'margine' ? margineDi(senzaPrezzo, tot[k]) : r2(tot[k])))],
    costi: r2(tot.costo_totale),
    ricavi: r2(tot.ricavi),
    margine_perc: senzaPrezzo ? null : tot.ricavi !== 0 ? r2((tot.margine / tot.ricavi) * 100) : 0,
    senza_prezzo: senzaPrezzo,
    testo_senza_prezzo: testoInterventiSenzaPrezzo(senzaPrezzo),
  };
}

// La percentuale del margine in una cella: «—» quando non si calcola.
const percentualeMargine = (perc) => (perc === null || perc === undefined ? '—' : `${cifreItaliane(perc, 2, 2)}%`);
// La riga che dice perche' il margine e' «—», sotto l'analisi e il conto del mese.
const rigaMargineMancante = (analisi) => `Margine «—»: ${analisi.testo_senza_prezzo}.`;

/**
 * IL CONTO DEL MESE COL SURPLUS, per l'amministratore: costi, ricavi e margine,
 * standard, surplus e totale. I costi standard sono quelli dell'analisi per
 * produttore, il surplus ai fornitori quello della passiva; i ricavi standard
 * piu' il surplus da Ecotyre fanno il Totale imponibile. Senza surplus non c'e'.
 */
function contoDelMese(dati, analisi) {
  const costi = { standard: analisi.costi, surplus: dati.totale_surplus_costo, totale: r2(analisi.costi + dati.totale_surplus_costo) };
  const ricavi = { standard: dati.totale_standard, surplus: dati.totale_surplus, totale: dati.totale_imponibile };
  // con un intervento da fatturare senza prezzo il margine standard e quello
  // totale sono «—» (15/10/2026); quello del surplus si calcola, i suoi €/t ci sono
  const manca = analisi.senza_prezzo > 0;
  const margine = { standard: manca ? '—' : r2(ricavi.standard - costi.standard), surplus: r2(ricavi.surplus - costi.surplus), totale: manca ? '—' : r2(ricavi.totale - costi.totale) };
  return {
    righe: [['Costi', costi], ['Ricavi', ricavi], ['Margine', margine]].map(([voce, v]) => [voce, v.standard, v.surplus, v.totale]),
    margine_perc: manca ? null : ricavi.totale !== 0 ? r2((margine.totale / ricavi.totale) * 100) : 0,
  };
}

// La data nella cella e' il GIORNO ITALIANO, scritto come mezzanotte UTC: Excel
// mostra quel giorno qualunque sia il fuso del computer. Con l'istante nudo un
// trasporto finito alle 23:30 UTC del 30 giugno, in Italia il 1° luglio, usciva
// al 30 giugno (11/10/2026, la stessa regola di esportaTabella.js).
function toDate(v) {
  const g = giornoRoma(v);
  return g ? new Date(`${g}T00:00:00.000Z`) : null;
}

// Numeri all'italiana nel PDF: punto per le migliaia, virgola per i decimali.
// Un peso che manca resta «—», non 0.
const kgPdf = (v) => (v === null || v === undefined ? '—' : cifreItaliane(v, 0, 0));

/**
 * I NUMERI DEL FILE, CALCOLATI UNA VOLTA PER EXCEL E PDF (chiusura dell'audit,
 * 11/10/2026).
 *
 * Il «Totale imponibile» sommava i sovracosti del ricavo di TUTTI gli
 * interventi, anche di quelli che la fattura non conta: un terminato senza peso
 * effettivo e una secondaria restano fuori dalla fattura per intero, sovracosti
 * compresi. Un intervento da 2.000 kg a 202 €/t con 50 € di sovracosto e una
 * scheda vecchia senza peso con altri 50 €: il file diceva 504,00 di imponibile
 * e 454,00 di ricavi nell'analisi per produttore, la fattura 454,00. Ora i
 * sovracosti si sommano solo per chi entra in fattura (calcExtraRaccolta(r).fatturato)
 * e il totale imponibile e' la somma dei ricavi, gli stessi della fattura e
 * dell'analisi per produttore. Chi ha il peso che manca si elenca, con la frase
 * della fattura, e i suoi chili si scrivono «—», non 0.
 *
 * IL SURPLUS (13/10/2026). Col contesto della pagina arrivano anche i surplus
 * dell'extra raccolta. Il ricavo che si somma qui e' lo standard
 * (ricavo_standard), e il surplus si aggiunge col centesimo del mese
 * (surplusDelMese), una riga per mese e per surplus, come in fattura: sommando
 * le quote dei singoli interventi il Fuel Surcharge di ottobre farebbe 22,34
 * invece dei 22,33 della fattura.
 *
 * SOLO I CHILI FATTURATI NEL TOTALE (decisione dell'utente del 13/10/2026 sera).
 * totale_kg sono i chili che si fatturano a Ecotyre, le primarie col peso
 * effettivo; le secondarie col peso stanno in secondarie_kg e secondarie_n.
 *
 * Torna { righe: [{ record, kg, prezzo, totale }], totale_kg, secondarie_kg,
 * secondarie_n, sovracosto_raccolta, sovracosto_trasporto, sovracosto_trattamento,
 * surplus: [{ mese, nome, euro_t, kg, importo, descrizione }], totale_standard,
 * totale_surplus, totale_imponibile, totale_surplus_costo, senza_peso,
 * per_produttore, conto_surplus } (conto_surplus: il conto di surplusDelMese,
 * da cui escono i blocchi «... ai raccoglitori» secondo chi esporta).
 */
export function datiExportExtra(records, contesto) {
  const elenco = records || [];
  const righe = [];
  const senzaPeso = [];
  let totKg = 0, kgSecondarie = 0, nSecondarie = 0, sovraRaccolta = 0, sovraTrasporto = 0, sovraTrattamento = 0, imponibile = 0;
  for (const r of elenco) {
    const c = calcExtraRaccolta(r, contesto);
    if (c.fatturato) {
      totKg += c.kg;
      sovraRaccolta += r2(Number(r.sovracosto_raccolta || 0));
      sovraTrasporto += r2(Number(r.sovracosto_trasporto || 0));
      sovraTrattamento += r2(Number(r.sovracosto_trattamento || 0));
      imponibile += c.ricavo_standard;
    } else if (!c.senza_peso) {
      // con il peso e fuori dalla fattura: una secondaria
      kgSecondarie += c.kg;
      nSecondarie++;
    }
    if (c.senza_peso) senzaPeso.push({ numero_fir: r.numero_fir || r.id_ordine || '', avviso: avvisoPesoMancante(r) });
    righe.push({ record: r, kg: c.senza_peso ? null : c.kg, prezzo: prezzoRiga(r, contesto), totale: totaleRiga(r, contesto) });
  }
  const conto = surplusDelMese(elenco, contesto);
  const fattura = righeDellaFattura(conto);
  const totaleStandard = r2(imponibile);
  const totaleSurplus = r2(fattura.reduce((s, v) => s + v.importo, 0));
  return {
    righe,
    totale_kg: totKg,
    secondarie_kg: kgSecondarie,
    secondarie_n: nSecondarie,
    sovracosto_raccolta: r2(sovraRaccolta),
    sovracosto_trasporto: r2(sovraTrasporto),
    sovracosto_trattamento: r2(sovraTrattamento),
    surplus: fattura,
    totale_standard: totaleStandard,
    totale_surplus: totaleSurplus,
    totale_imponibile: totaleSurplus ? r2(totaleStandard + totaleSurplus) : totaleStandard,
    totale_surplus_costo: conto.totale_passivo,
    senza_peso: senzaPeso,
    // lo standard, qualunque contesto: il surplus non e' del produttore
    per_produttore: aggregaPerProduttore(elenco, contesto),
    conto_surplus: conto,
  };
}

const TITOLO_SENZA_PESO = 'DA SISTEMARE: interventi terminati senza peso effettivo, fuori dalla fattura e dal totale imponibile';
const ETICHETTA_SECONDARIE = 'Trasporti di secondaria (non si fatturano a Ecotyre)';
const testoSecondarie = (n) => (n === 1
  ? "un trasferimento da stoccaggio, pagato come trasporto di secondaria: i suoi chili non sono nel TOTALE QUANTITA'"
  : `${cifreItaliane(n, 0, 0)} trasferimenti da stoccaggio, pagati come trasporti di secondaria: i loro chili non sono nel TOTALE QUANTITA'`);

// IL PERIODO DEL DOCUMENTO (prova del cambio d'anno, 15/10/2026): «Dicembre
// 2026», o «Tutti 2026» per l'anno intero; senza anno (la pagina con l'anno su
// «Tutti» e interventi di piu' anni, annoDelDocumento in extraRaccoltaCalc.js)
// «Tutti gli anni», mai l'anno di oggi al posto di quello dei movimenti.
export const periodoDelDocumento = (mese, anno) => {
  const m = String(mese || 'Tutti');
  if (anno !== null && anno !== undefined && anno !== '') return `${m} ${anno}`;
  return m.toLowerCase() === 'tutti' ? 'Tutti gli anni' : `${m}, tutti gli anni`;
};

// Il blocco di testa dei due file: canale, mese per fine trasporto, fino a che
// giorno arrivano le schede dell'extra raccolta. stato: quello gia' letto (le prove).
function documentoExtra(mese, anno, stato, comeDocumento = true) {
  const opzioni = {
    titolo: `Fatturazione extra raccolta — ${periodoDelDocumento(mese, anno)}`,
    canale: 'EXTRA_RACCOLTA', periodo: periodoDelDocumento(mese, anno), entita: ['ExtraRaccolta'],
    ...(stato !== undefined ? { stato } : {}),
  };
  return comeDocumento ? documentoDa(opzioni) : opzioni;
}

// Le colonne del blocco del surplus: per l'amministratore anche costo, margine e note.
const colonneSurplus = (b, conCosti) => (conCosti
  ? [b.chi, 'TONNELLATE', `COSTO ${aiChiSurplus(b.prestazione).toUpperCase()} (Euro)`, 'RICAVO DA ECOTYRE (Euro)', 'MARGINE (Euro)', 'NOTE']
  : [b.chi, 'TONNELLATE', 'RICAVO DA ECOTYRE (Euro)']);
// Le celle di una riga del blocco, nell'ordine delle colonne.
const celleSurplus = (nome, x, conCosti) => (conCosti
  ? [nome, x.kg / 1000, x.costo, x.ricavo, x.margine, x.nota || null]
  : [nome, x.kg / 1000, x.ricavo]);

export async function exportExtraRaccoltaExcel(records, mese, anno, contesto, opzioni = {}) {
  const doc = await documentoExtra(mese, anno, opzioni.stato);
  const sheetName = periodoDelDocumento(MESI_UPPER[mese] || String(mese).toUpperCase(), anno).toUpperCase();
  const dati = datiExportExtra(records, contesto);
  const conCosti = opzioni.isAdmin === true;
  const wsData = [];
  // I formati riga per riga, dove non bastano quelli delle aree (13/10/2026).
  const formatiRiga = {};
  const stili = {};
  const testate = [0];

  // === Area 1: righe intervento ===
  wsData.push([
    'Nr. FIR', 'PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO',
    'DATA INIZIO TRASPORTO', 'DATA FINE TRASPORTO',
    'CER', 'TIPOLOGIA TRASPORTO', "QUANTITA' (kg)", 'PREZZO (Euro/ton)', 'TOTALE (Euro)'
  ]);

  for (const x of dati.righe) {
    const r = x.record;
    wsData.push([
      r.numero_fir || '',
      r.produttore || '',
      r.trasportatore || '',
      r.destinazione || '',
      toDate(r.trasporto_iniziato_il) || '',
      toDate(r.trasporto_finito_il) || '',
      r.cer || '160103',
      r.tipologia_trasporto || '',
      // Un peso che manca non e' zero: «—», come nella pagina.
      x.kg === null ? '—' : x.kg,
      x.prezzo,
      x.totale,
    ]);
  }

  // === Area 2: riepilogo ===
  wsData.push([]);
  const iRiepilogo = wsData.length;
  // Solo i chili fatturati a Ecotyre; le secondarie nella riga sotto, a parte.
  wsData.push(["TOTALE QUANTITA' (kg)", dati.totale_kg]);
  if (dati.secondarie_n) {
    formatiRiga[wsData.length] = { 1: FORMATI.kg };
    wsData.push([ETICHETTA_SECONDARIE, dati.secondarie_kg, testoSecondarie(dati.secondarie_n)]);
  }
  wsData.push(['Sovracosto Raccolta', dati.sovracosto_raccolta]);
  wsData.push(['Sovracosto Trasporto', dati.sovracosto_trasporto]);
  wsData.push(['Sovracosto Trattamento', dati.sovracosto_trattamento]);
  // Il surplus da Ecotyre (13/10/2026): una riga per mese e per surplus, prima
  // del Totale imponibile che la comprende. La descrizione sta nella terza
  // colonna, che nel riepilogo e' vuota.
  const iSurplus = [];
  for (const s of dati.surplus) { iSurplus.push(wsData.length); wsData.push([s.nome, s.importo, s.descrizione]); }
  wsData.push(['Totale imponibile', dati.totale_imponibile]);
  if (dati.senza_peso.length) {
    wsData.push([]);
    stili[wsData.length] = 'avviso';
    wsData.push([TITOLO_SENZA_PESO]);
    for (const s of dati.senza_peso) { stili[wsData.length] = 'avviso'; wsData.push([s.numero_fir, s.avviso]); }
  }
  const fineRiepilogo = wsData.length;

  // === Area 2b: il surplus a chi va (13/10/2026) ===
  // Un blocco per surplus, «Fuel Surcharge ai raccoglitori»: il titolo, le
  // colonne, e per ogni mese l'intestazione (periodo, origine e €/t), una riga
  // per fornitore nella veste del surplus e il totale del mese, che e' la riga
  // in fattura. Il costo e il margine solo all'amministratore.
  const iSurplusAChi = [];
  for (const b of surplusAChi(dati.conto_surplus, conCosti)) {
    wsData.push([]);
    stili[wsData.length] = 'gruppo';
    wsData.push([b.titolo.toUpperCase()]);
    const formati = conCosti ? { 1: FORMATI.tonnellateFini, 2: FORMATI.euro, 3: FORMATI.euro, 4: FORMATI.euro } : { 1: FORMATI.tonnellateFini, 2: FORMATI.euro };
    testate.push(wsData.length);
    formatiRiga[wsData.length] = formati;
    wsData.push(colonneSurplus(b, conCosti));
    for (const g of b.gruppi) {
      stili[wsData.length] = 'nota';
      wsData.push([g.intestazione]);
      for (const x of g.righe) { iSurplusAChi.push(wsData.length); formatiRiga[wsData.length] = formati; wsData.push(celleSurplus(x.fornitore, x, conCosti)); }
      formatiRiga[wsData.length] = formati;
      wsData.push(celleSurplus(g.totale.etichetta, g.totale, conCosti));
      if (g.nota) { stili[wsData.length] = 'nota'; wsData.push([g.nota]); }
    }
    if (b.totale) { formatiRiga[wsData.length] = formati; wsData.push(celleSurplus(b.totale.etichetta, b.totale, conCosti)); }
  }

  // === Area 3: analisi margine per produttore ===
  // La voce «trasporto» e' il costo a viaggio degli interventi (campo
  // costo_trasporto_viaggio, nato il 03/10/2026): sta fra le voci di costo e non
  // nel riepilogo qui sopra, che somma i sovracosti del ricavo e finisce nel
  // totale imponibile. Si somma tale e quale, come la pulizia e i costi
  // aggiuntivi, perche' e' un importo fisso per intervento e non un prezzo a
  // tonnellata; senza questa colonna le voci non facevano piu' il costo totale,
  // che il trasporto lo comprende. Per una secondaria, dal 13/10/2026, e' la
  // tariffa della tratta nel contratto del vettore.
  // Le due voci «sovracosto raccoglitore» e «sovracosto impianto» (campi
  // sovracosto_pagato_raccoglitore e sovracosto_pagato_impianto, nati il
  // 03/10/2026 con la precisazione dell'utente) stanno qui per lo stesso motivo:
  // sono soldi che SMOCO PAGA, al raccoglitore per i costi imprevisti della
  // raccolta o all'impianto per quelli del trattamento, e il costo totale li
  // comprende. Si sommano tali e quali, come la pulizia e il trasporto, perche'
  // sono importi fissi per intervento e non prezzi a tonnellata. Nel riepilogo
  // dell'Area 2 non ci vanno mai: quello somma i tre sovracosti del RICAVO e
  // finisce nel totale imponibile della fatturazione attiva, e un costo che
  // paghiamo noi lo gonfierebbe.
  // L'analisi ha i costi e il margine: solo all'amministratore (13/10/2026). E'
  // lo standard: il surplus ha il suo blocco qui sopra e il conto del mese qui
  // sotto.
  let iAnalisi = Infinity;
  if (conCosti) {
    wsData.push([]);
    iAnalisi = wsData.length;
    testate.push(iAnalisi);
    wsData.push(['PRODUTTORE', 'costi aggiuntivi', 'raccolta', 'stoccaggio', 'trattamento', 'pulizia', 'trasporto', 'sovracosto raccoglitore', 'sovracosto impianto', 'costo totale', 'ricavi', 'margine']);
    const analisi = analisiPerProduttore(dati);
    for (const r of analisi.produttori) wsData.push(r);
    wsData.push(analisi.totale);
    let perc = analisi.margine_perc;
    // Il conto del mese col surplus (13/10/2026): standard, surplus e totale.
    if (dati.surplus.length || dati.totale_surplus_costo) {
      const conto = contoDelMese(dati, analisi);
      const euro3 = { 1: FORMATI.euro, 2: FORMATI.euro, 3: FORMATI.euro };
      wsData.push([]);
      testate.push(wsData.length);
      formatiRiga[wsData.length] = euro3;
      wsData.push(['CONTO DEL MESE', 'STANDARD', 'SURPLUS', 'TOTALE']);
      for (const r of conto.righe) { formatiRiga[wsData.length] = euro3; wsData.push(r); }
      perc = conto.margine_perc;
    }
    wsData.push([]);
    stili[wsData.length] = 'gruppo';
    wsData.push(['Margine % complessivo', percentualeMargine(perc)]);
    // il perche' del «—» (15/10/2026)
    if (analisi.senza_prezzo) wsData.push([rigaMargineMancante(analisi)]);
  }

  // I formati, area per area: negli interventi chili, prezzo a tonnellata e
  // importo; nel riepilogo i chili del totale e gli euro dei sovracosti; nell'analisi
  // tutti euro. Prima i formati si deducevano dai titoli della prima tabella e
  // valevano per tutto il foglio: nell'analisi il «sovracosto impianto» usciva
  // coi chili interi (12,50 € si leggeva 13). Le righe con formati loro (le
  // secondarie, il surplus a chi va, il conto del mese) li dicono in formatiRiga.
  const formati = (c, riga, i) => {
    if (formatiRiga[i]) return formatiRiga[i][c] || null;
    if (i < iRiepilogo) return { 8: FORMATI.kg, 9: FORMATI.prezzoLibero, 10: FORMATI.euro }[c] || null;
    if (i < fineRiepilogo) return c === 1 ? (/\(kg\)/.test(String(riga[0])) ? FORMATI.kg : FORMATI.euro) : null;
    if (i < iAnalisi) return null;
    return c >= 1 ? FORMATI.euro : null;
  };
  const { wb } = await nuovaCartella();
  const ws = foglioDaRighe(wb, sheetName, {
    doc, righe: wsData, testate, formati, stili,
    larghezze: [24, 30, 28, 28, 14, 14, 14, 18, 14, 14, 14, 14],
  });
  // Le righe del surplus si vestono dopo: foglioDaRighe scrive una riga del
  // foglio per ogni riga dell'elenco, sotto il blocco di testa.
  const testa = ws.rowCount - wsData.length;
  const quante = Math.max(1, ...wsData.map(r => r.length));
  for (const i of iSurplus) vestiRigaSurplus(ws.getRow(testa + i + 1), quante);
  for (const i of iSurplusAChi) vestiRigaSurplus(ws.getRow(testa + i + 1), wsData[i].length);
  return scaricaCartella(wb, `SMOCO-Fatturazione EXTRA RACCOLTA ${periodoDelDocumento(mese, anno)}.xlsx`);
}

/** La riga del surplus nel foglio: fondo indaco chiaro, testo indaco scuro in corsivo, barra a sinistra. */
function vestiRigaSurplus(riga, quante) {
  for (let c = 1; c <= quante; c++) {
    const cella = riga.getCell(c);
    cella.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SURPLUS_CHIARO } };
    cella.font = { ...(cella.font || {}), italic: true, color: { argb: SURPLUS_SCURO } };
  }
  const prima = riga.getCell(1);
  prima.border = { ...(prima.border || {}), left: { style: 'thick', color: { argb: SURPLUS } } };
}


export async function exportExtraRaccoltaPDF(records, mese, anno, contesto, opzioni = {}) {
  const dati = datiExportExtra(records, contesto);
  // Le stesse aree dell'Excel, con la veste del PDF della passiva: il riepilogo
  // nei riquadri in alto, gli interventi, il surplus a chi va, l'analisi per
  // produttore e il conto del mese e, in coda, le schede senza peso da sistemare.
  // Il surplus (13/10/2026): nei riquadri, prima del Totale imponibile, il suo
  // importo da Ecotyre; sotto gli interventi un blocco per surplus, «Fuel
  // Surcharge ai raccoglitori», una riga per raccoglitore e il totale di ogni
  // mese, che e' la riga in fattura. L'analisi per produttore e' lo standard, e
  // con il conto del mese esce solo all'amministratore.
  const conCosti = opzioni.isAdmin === true;
  const analisi = analisiPerProduttore(dati);
  const conSurplus = !!(dati.surplus.length || dati.totale_surplus_costo);
  const sezioneAnalisi = () => ({
    titolo: 'ANALISI MARGINE PER PRODUTTORE',
    colonne: [
      { titolo: 'PRODUTTORE', tipo: 'testo', peso: 2 },
      ...['costi agg.', 'raccolta', 'stoccaggio', 'trattamento', 'pulizia', 'trasporto', 'sovr. raccogl.', 'sovr. impianto', 'costo tot.', 'ricavi', 'margine'].map(t => ({ titolo: t, tipo: 'euro', peso: 1 })),
    ],
    righe: [
      ...analisi.produttori.map(celle => ({ celle })),
      { stile: 'totale', celle: analisi.totale },
      // col surplus la percentuale sta nel conto del mese, che lo comprende
      ...(conSurplus ? [] : [{ stile: 'gruppo', celle: ['Margine % complessivo', ...VOCI_ANALISI.map(() => null).slice(1), percentualeMargine(analisi.margine_perc)] }]),
      // il perche' del «—» (15/10/2026)
      ...(analisi.senza_prezzo ? [{ celle: [rigaMargineMancante(analisi), ...VOCI_ANALISI.map(() => null)] }] : []),
    ],
  });
  const sezioneConto = () => {
    const conto = contoDelMese(dati, analisi);
    return {
      titolo: 'CONTO DEL MESE COL SURPLUS',
      colonne: [{ titolo: 'VOCE', tipo: 'testo', peso: 2 }, { titolo: 'STANDARD', tipo: 'euro', peso: 1 }, { titolo: 'SURPLUS', tipo: 'euro', peso: 1 }, { titolo: 'TOTALE', tipo: 'euro', peso: 1 }],
      righe: [
        ...conto.righe.map(celle => ({ celle })),
        { stile: 'gruppo', celle: ['Margine % complessivo', null, null, percentualeMargine(conto.margine_perc)] },
        ...(analisi.senza_prezzo ? [{ celle: [rigaMargineMancante(analisi), null, null, null] }] : []),
      ],
    };
  };
  // Un riquadro solo per il surplus, col totale: le righe (piu' mesi, un importo
  // che cambia a meta' mese, piu' surplus) stanno nei blocchi qui sotto. Il
  // riquadro dice il nome se e' uno e ci sta (l'etichetta non va a capo, e un
  // nome lungo finirebbe sopra il riquadro accanto).
  const nomiSurplus = [...new Set(dati.surplus.map(s => s.nome_surplus))];
  const etichettaSurplus = nomiSurplus.length === 1 && `Surplus · ${nomiSurplus[0]}`.length <= 32 ? `Surplus · ${nomiSurplus[0]}` : 'Surplus sulle tariffe';
  const sezioniSurplus = surplusAChi(dati.conto_surplus, conCosti).map(b => {
    const titoli = colonneSurplus(b, conCosti);
    const tipi = conCosti ? ['testo', 't', 'euro', 'euro', 'euro', 'testo'] : ['testo', 't', 'euro'];
    const pesi = conCosti ? [2.2, 0.9, 1.1, 1.1, 0.9, 2.4] : [3, 1, 1.2];
    const vuote = titoli.map(() => null).slice(1);
    return {
      titolo: b.titolo.toUpperCase(),
      colonne: titoli.map((t, i) => ({ titolo: t, tipo: tipi[i], peso: pesi[i] })),
      righe: [
        ...b.gruppi.flatMap(g => [
          { stile: 'gruppo', celle: conCosti ? [g.quando, null, null, null, null, g.come] : [g.intestazione, ...vuote] },
          ...g.righe.map(x => ({ celle: celleSurplus(x.fornitore, x, conCosti) })),
          { stile: 'totale', celle: celleSurplus(g.totale.etichetta, g.totale, conCosti) },
          ...(g.nota ? [{ celle: [g.nota, ...vuote] }] : []),
        ]),
        ...(b.totale ? [{ stile: 'totale', celle: celleSurplus(b.totale.etichetta, b.totale, conCosti) }] : []),
      ],
    };
  });

  const { esportaSezioniPdf } = await import('@/lib/esportaTabella');
  const n = dati.righe.length;
  await esportaSezioniPdf({
    nomeFile: `SMOCO-Fatturazione EXTRA RACCOLTA ${periodoDelDocumento(mese, anno)}`,
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE  ·  EXTRA RACCOLTA',
    titolo: `Fatturazione extra raccolta — ${periodoDelDocumento(mese, anno)}`,
    sottotitolo: `${n} ${n === 1 ? 'intervento' : 'interventi'}${dati.secondarie_n ? `, di cui ${dati.secondarie_n === 1 ? 'un trasporto' : `${dati.secondarie_n} trasporti`} di secondaria (non si fatturano a Ecotyre)` : ''}`,
    documento: documentoExtra(mese, anno, opzioni.stato, false),
    riepilogo: [
      { etichetta: "Totale quantita' (kg)", valore: kgPdf(dati.totale_kg) },
      ...(dati.secondarie_n ? [{ etichetta: 'Secondarie, non fatturate (kg)', valore: kgPdf(dati.secondarie_kg) }] : []),
      { etichetta: 'Sovracosto raccolta', valore: dati.sovracosto_raccolta, tipo: 'euro' },
      { etichetta: 'Sovracosto trasporto', valore: dati.sovracosto_trasporto, tipo: 'euro' },
      { etichetta: 'Sovracosto trattamento', valore: dati.sovracosto_trattamento, tipo: 'euro' },
      ...(dati.surplus.length ? [{ etichetta: etichettaSurplus, valore: dati.totale_surplus, tipo: 'euro' }] : []),
      { etichetta: 'Totale imponibile', valore: dati.totale_imponibile, tipo: 'euro' },
    ],
    sezioni: [
      {
        titolo: 'INTERVENTI',
        // Il prezzo tiene da due a quattro decimali, come l'Excel (prezzoLibero):
        // col tipo 'euro' un prezzo al chilo da 0,202 usciva «0,20 €» e il PDF e
        // l'Excel dello stesso mese dicevano due prezzi (revisione delle
        // migliorie, 11/10/2026).
        colonne: [
          { titolo: 'Nr. FIR', tipo: 'testo', peso: 1.2 }, { titolo: 'PRODUTTORE', tipo: 'testo', peso: 1.8 }, { titolo: 'TRASPORTATORE', tipo: 'testo', peso: 1.6 },
          { titolo: 'DESTINATARIO', tipo: 'testo', peso: 1.6 }, { titolo: 'DATA INIZIO TRASPORTO', tipo: 'data', peso: 0.9 }, { titolo: 'DATA FINE TRASPORTO', tipo: 'data', peso: 0.9 },
          { titolo: 'CER', tipo: 'testo', peso: 0.6 }, { titolo: 'TIPOLOGIA TRASPORTO', tipo: 'testo', peso: 1.1 }, { titolo: "QUANTITA' (kg)", tipo: 'kg', peso: 0.8 },
          { titolo: 'PREZZO (Euro/ton)', tipo: 'prezzoLibero', peso: 0.8 }, { titolo: 'TOTALE (Euro)', tipo: 'euro', peso: 0.9 },
        ],
        righe: dati.righe.map(x => {
          const r = x.record;
          // Un peso che manca non e' zero: «—», come nella pagina e nell'Excel.
          return { celle: [r.numero_fir || '', r.produttore || '', r.trasportatore || '', r.destinazione || '', r.trasporto_iniziato_il || null, r.trasporto_finito_il || null, r.cer || '160103', r.tipologia_trasporto || '', x.kg === null ? '—' : x.kg, x.prezzo, x.totale] };
        }),
      },
      ...sezioniSurplus,
      ...(conCosti ? [sezioneAnalisi()] : []),
      ...(conCosti && conSurplus ? [sezioneConto()] : []),
    ],
    note: dati.senza_peso.map(x => x.avviso),
    titoloNote: TITOLO_SENZA_PESO,
  });
}
