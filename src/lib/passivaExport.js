
// L'export della fatturazione passiva: un file per canale (rete, ACI, extra
// raccolta non si sommano mai), in Excel e in PDF, con i blocchi del modello
// dell'amministrazione ("[FORMAT] - Fatturazione passiva Ecotyre"): raccoglitori,
// impianti e stoccaggi, trasporto delle secondarie. Per ogni fornitore una riga col
// totale e, sotto, il dettaglio con l'ambito, le tonnellate, il prezzo e l'importo.
// I numeri sono quelli a video: l'export non ricalcola niente. La struttura si
// costruisce in un punto solo (sezioniPassiva): Excel e PDF dicono le stesse cose.
//
// IL FOGLIO SI VESTE E DICE LA DATA DEI DATI (chiusura dell'audit, 11/10/2026).
// L'Excel usciva da SheetJS, senza fascia ne' piede, e nessuno dei due file
// diceva fino a che giorno arrivavano le primarie e le secondarie da cui nasce
// il conto. Ora l'Excel passa dal corredo comune (fogliProfessionali.js) con le
// stesse righe di prima, cella per cella, sotto il blocco di testa del
// documento; il PDF prende lo stesso blocco da esportaTabella.js.
import { documentoDa, nuovaCartella, foglioDaRighe, scaricaCartella } from '@/lib/fogliProfessionali';

const NOMI = { RETE: 'RETE', ACI: 'ACI', EXTRA_RACCOLTA: 'EXTRA RACCOLTA' };
const NOMI_TITOLO = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
const EER = 160103;
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
const unita = (um) => String(um || '').replace('/', '\\');
// tonnellate scritte dentro un testo: virgola italiana, stessi decimali delle colonne
const tTesto = (v) => r3(v).toFixed(3).replace(/0$/, '').replace('.', ',');   // due decimali, tre se i chili non sono tondi

// Da dove viene il prezzo di una riga di raccolta: destinazione, provincia o classe
const ambitoRaccolta = (r) => [r.provincia !== '—' && r.provincia, r.destinazione !== '—' && `verso ${r.destinazione}`, r.classe !== '—' && `classe ${r.classe}`].filter(Boolean).join(' · ') || 'tutte';
// Il viaggio misto (rete e ACI sullo stesso camion) in poche parole: la nota
// completa della pagina nel PDF si taglierebbe alla terza riga. A viaggio
// l'importo e' la quota dei chili di questo canale (regola dell'utente del
// 22/09/2026), quindi "nr. di viaggi" per "COSTO" non fa il totale: la nota dice
// quanti viaggi si pagano davvero.
const numeroIt = (v) => r2(v).toFixed(2).replace('.', ',');
const euroIt = (v) => { const [i, d] = r2(v).toFixed(2).split('.'); return `${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`; };
// Se l'altro canale non ha una tariffa per la tratta, la sua quota dei misti non
// la paga nessuno (altro_canale_da_pagare): la nota breve lo dice, con l'importo
// calcolato a questa tariffa (revisione del 22/09/2026).
function notaSecondaria(r, tipologia) {
  const daPagare = r.altro_canale_da_pagare;
  if (!(r.viaggi_misti > 0) || !(r.nota_informativa || daPagare)) return r.note || null;
  const altro = tipologia === 'ACI' ? 'la rete' : "l'ACI";
  const misti = `${r.viaggi_misti} ${r.viaggi_misti === 1 ? 'misto' : 'misti'} con ${altro}`;
  const breve = r.unita_misura === '€/viaggio'
    ? `${r.viaggi_interi || 0} ${r.viaggi_interi === 1 ? 'intero' : 'interi'} + ${misti}, ${r.viaggi_misti === 1 ? 'diviso' : 'divisi'} per peso: ${numeroIt(r.viaggi_quota)} viaggi pagati`
    : `di cui ${misti}: ogni canale paga i suoi chili`;
  if (!daPagare) return breve;
  const quali = `${daPagare.viaggi_misti} ${daPagare.viaggi_misti === 1 ? 'misto' : 'misti'}`;
  return `${breve}; quota ${daPagare.canale} di ${quali} senza tariffa ${daPagare.canale} o TUTTE: ${euroIt(daPagare.importo)} € da pagare`;
}

const ambitoImpianto = (r) => [r.prestazione === 'CONFERIMENTO_STOCCAGGIO' ? 'Stoccaggio' : r.prestazione === 'TRATTAMENTO' ? 'Trattamento' : r.prestazione, r.classe !== '—' && `classe ${r.classe}`, r.provenienza && r.provenienza !== '—' && `da ${r.provenienza}`].filter(Boolean).join(' · ');

// IL SURPLUS SULLE TARIFFE (13/10/2026). Richiesta dell'utente del 12/10/2026:
// «una riga con l'importo standard ed una per il surplus (sempre riferito alle
// stesse tonnellate raccolte o trattate nel mese)». Sotto le righe del fornitore
// c'e' la riga del surplus («Fuel Surcharge (consorzio Ecotyre), dal 01/10/2026
// al 31/12/2026»), col prezzo a tonnellata e l'importo del calcolo. Le sue
// tonnellate si scrivono fra parentesi e come TESTO, non come numero: sono le
// stesse del mese, e chi fa una somma sulla colonna non le deve prendere due
// volte. La riga del fornitore dice il totale (standard piu' surplus, quello che
// gli si deve) e nella nota come si compone; sotto il «Totale complessivo» del
// blocco, che lo comprende, una riga «di cui».
/** Le tonnellate dentro un testo, all'italiana con le migliaia: «1.120,24». */
const tIt = (v) => { const [i, d] = tTesto(v).split(','); return `${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`; };
const NOTA_SURPLUS = 'surplus sulle stesse tonnellate del mese: non si sommano una seconda volta';
// LA TARIFFA DEL MESE CHE MANCA (13/10/2026). Il surplus si paga lo stesso
// (risposta dell'utente), e il calcolo lo dice sulla riga del surplus (avviso)
// e sull'anomalia della tariffa che manca (avviso_surplus), mai dentro la
// descrizione, che e' la chiave con cui la stessa anomalia si dice una volta
// sola. Il file lo scrive accanto: in testa alla nota della riga del surplus,
// e dopo la descrizione dell'anomalia, nell'Excel e nelle note del PDF.
const notaSurplus = (s) => (s && s.avviso ? `${s.avviso} ${NOTA_SURPLUS.charAt(0).toUpperCase()}${NOTA_SURPLUS.slice(1)}` : NOTA_SURPLUS);
/** Un'anomalia a parole nel file: la descrizione e, se c'e', l'avviso del surplus. */
export const anomaliaNelFile = (a) => (a && a.avviso_surplus ? `${a.descrizione}. ${a.avviso_surplus}` : a.descrizione);
/** Il nome del surplus nei «di cui»: quello vero se nel mese ce n'e' uno solo. */
export function nomeDelSurplus(result) {
  const nomi = [...new Set(((result && result.surplus_del_mese) || []).map(s => String((s && s.nome) || '').trim()).filter(Boolean))];
  return nomi.length === 1 ? nomi[0] : 'surplus';
}
/** La nota della riga del fornitore quando ha un surplus: come si compone il suo totale. */
const notaGruppo = (f, nome) => (Number(f.totale_surplus) > 0
  ? `standard ${euroIt(f.totale_standard)} € + ${nome} ${euroIt(f.totale_surplus)} €`
  : null);

/**
 * Le tre sezioni del report: [{ tipo, titolo, colonne, righe: [{ celle, stile }] }].
 * stile: 'gruppo' per la riga del fornitore, 'totale' per il totale della sezione.
 */
export function sezioniPassiva(result) {
  const nomeSurplus = nomeDelSurplus(result);
  const surplusTot = (result.totali && result.totali.surplus) || {};
  const blocco = (titolo, colonnaPrezzo, fornitori, ambito, totale, surplusBlocco) => {
    const righe = [];
    for (const f of fornitori || []) {
      righe.push({ stile: 'gruppo', celle: [f.fornitore, r3(f.totale_tonnellate), null, null, EER, r2(f.totale_euro), f.interno ? 'interno, non fatturato' : notaGruppo(f, nomeSurplus)] });
      for (const r of f.righe || []) {
        const conferenti = (r.di_cui || []).map(d => `${d.fornitore} ${tTesto(d.tonnellate)} t`).join('; ');
        righe.push({ celle: [`   ${ambito(r)}`, r3(r.tonnellate), r.tariffa_valore || 0, unita(r.unita_misura), null, r2(r.importo), [r.note, conferenti && `di cui conferito da: ${conferenti}`].filter(Boolean).join(' — ') || null] });
      }
      for (const s of f.surplus || []) {
        righe.push({ celle: [`   ${s.etichetta || s.nome}`, `(${tIt(s.tonnellate)})`, Number(s.euro_t) || 0, '€\\t', null, r2(s.importo), notaSurplus(s)] });
      }
      for (const d of f.di_cui || []) righe.push({ celle: [`   di cui ${d.fornitore}`, r3(d.tonnellate), null, null, null, null, 'subraccoglitore, fatturato dal principale'] });
    }
    righe.push({ stile: 'totale', celle: ['Totale complessivo', r3((fornitori || []).reduce((s, f) => s + (f.totale_tonnellate || 0), 0)), null, null, null, r2(totale), null] });
    if (Number(surplusBlocco) > 0) righe.push({ celle: [`   di cui ${nomeSurplus}`, null, null, null, null, r2(surplusBlocco), 'compreso nel totale qui sopra'] });
    return {
      tipo: 'blocco', titolo,
      colonne: [
        { titolo, tipo: 'testo', peso: 3.2 }, { titolo: 'Totale [t]', tipo: 't', peso: 0.9 }, { titolo: colonnaPrezzo, tipo: 'euro', peso: 1 }, { titolo: 'Unità', tipo: 'testo', peso: 0.7 },
        { titolo: 'EER', tipo: 'testo', peso: 0.7 }, { titolo: 'TOTALE [€]', tipo: 'euro', peso: 1.1 }, { titolo: 'Note', tipo: 'testo', peso: 3.2 },
      ],
      righe,
    };
  };

  const secondarie = [];
  for (const f of result.trasporti_secondaria || []) {
    for (const r of f.righe || []) {
      secondarie.push({ celle: [r.stoccaggio, r.trasportatore || f.fornitore, r.destinazione, r3(r.tonnellate), unita(r.unita_misura), r.tariffa_valore || 0, r.viaggi || 0, r2(r.importo), f.fornitore, notaSecondaria(r, result.tipologia)] });
    }
    // il surplus del trasporto delle secondarie, sotto le tratte del trasportatore
    for (const s of f.surplus || []) {
      secondarie.push({ celle: [`   ${s.etichetta || s.nome}`, f.fornitore, null, `(${tIt(s.tonnellate)})`, '€\\t', Number(s.euro_t) || 0, null, r2(s.importo), f.fornitore, NOTA_SURPLUS] });
    }
  }
  secondarie.push({ stile: 'totale', celle: ['Totale complessivo', null, null, r3((result.trasporti_secondaria || []).reduce((s, f) => s + (f.totale_tonnellate || 0), 0)), null, null, null, r2(result.totali.trasporti_secondaria), null, null] });
  if (Number(surplusTot.trasporti_secondaria) > 0) secondarie.push({ celle: [`   di cui ${nomeSurplus}`, null, null, null, null, null, null, r2(surplusTot.trasporti_secondaria), null, 'compreso nel totale qui sopra'] });

  return [
    blocco('RACCOGLITORI', 'Costo di Raccolta', result.raccoglitori, ambitoRaccolta, result.totali.raccoglitori, surplusTot.raccoglitori),
    blocco('IMPIANTI \\ STOCCAGGI', 'Costo', result.impianti_stoccaggi, ambitoImpianto, result.totali.impianti_stoccaggi, surplusTot.impianti_stoccaggi),
    {
      tipo: 'secondarie', titolo: 'TRASPORTO DELLE SECONDARIE',
      colonne: [
        { titolo: 'PRODUTTORE', tipo: 'testo', peso: 1.6 }, { titolo: 'TRASPORTATORE', tipo: 'testo', peso: 1.7 }, { titolo: 'DESTINATARIO', tipo: 'testo', peso: 1.5 }, { titolo: 'PESO [t]', tipo: 't', peso: 0.8 },
        { titolo: "UNITA' DI MISURA", tipo: 'testo', peso: 0.8 }, { titolo: 'COSTO', tipo: 'euro', peso: 0.8 }, { titolo: 'nr. di viaggi', tipo: 'intero', peso: 0.7 }, { titolo: 'TOTALE [€]', tipo: 'euro', peso: 1 },
        { titolo: 'Fatturato da', tipo: 'testo', peso: 1.6 }, { titolo: 'Note', tipo: 'testo', peso: 2.2 },
      ],
      righe: secondarie,
    },
  ];
}

// Per ogni riga del foglio, in che blocco sta: decide quale colonna e' in tonnellate e quale in euro
const FORMATI = {
  testa: { 6: '#,##0.00' },
  blocco: { 1: '#,##0.00#', 2: '#,##0.00', 5: '#,##0.00' },
  secondarie: { 3: '#,##0.00#', 5: '#,##0.00', 6: '#,##0', 7: '#,##0.00' },
};

/**
 * Le righe del foglio Excel, dalle stesse sezioni del PDF. tipi[i] dice il
 * blocco della riga i; stili[i], se si passa, come si veste: 'testata' per le
 * intestazioni dei blocchi, 'gruppo' per il fornitore, 'totale', 'avviso'.
 */
export function righePassiva(result, tipi = [], stili = []) {
  const aoa = [];
  let tipo = 'testa';
  const riga = (r, stile = null) => { tipi.push(tipo); stili.push(stile); aoa.push(r); };
  riga([NOMI[result.tipologia] || result.tipologia, `${result.mese} ${result.anno}`, null, null, null, 'TOTALE', r2(result.totali.totale_complessivo)], 'totale');
  // Il surplus del canale, compreso nel totale qui sopra (13/10/2026).
  const surplus = Number(result.totali && result.totali.surplus && result.totali.surplus.totale) || 0;
  if (surplus > 0) riga([null, null, null, null, null, `di cui ${nomeDelSurplus(result)}`, r2(surplus)]);
  riga([]);
  for (const s of sezioniPassiva(result)) {
    tipo = s.tipo;
    riga(s.colonne.map(c => c.titolo), 'testata');
    for (const r of s.righe) riga(r.celle, r.stile || null);
    riga([]);
  }
  tipo = 'testa';
  if ((result.anomalie || []).length) {
    riga(['ANOMALIE DA GUARDARE PRIMA DI PAGARE'], 'avviso');
    for (const a of result.anomalie) riga([anomaliaNelFile(a), a.tonnellate ? r3(a.tonnellate) : null], 'avviso');
  }
  return aoa;
}

const nomeFile = (result, estensione) => `Fatturazione_passiva_${result.tipologia}_${result.mese}_${result.anno}${estensione ? `.${estensione}` : ''}`;

// Gli archivi da cui nasce il conto di un canale: le primarie del canale e le
// secondarie (il trasporto); l'extra raccolta le sole sue schede.
const ARCHIVI_PASSIVA = { RETE: ['PrimariaRete', 'Secondaria'], ACI: ['PrimariaAci', 'Secondaria'], EXTRA_RACCOLTA: ['ExtraRaccolta'] };

/** Il blocco di testa del documento di un canale (canale, mese per fine trasporto, dati fino al). */
function documentoPassiva(result, stato) {
  return {
    canale: result.tipologia, periodo: `${result.mese} ${result.anno}`,
    entita: ARCHIVI_PASSIVA[result.tipologia] || [],
    ...(stato !== undefined ? { stato } : {}),
  };
}

/** L'Excel della passiva di un canale. opzioni.stato: lo stato dei dati gia' letto (le prove). */
export async function exportFatturazionePassiva(result, opzioni = {}) {
  const doc = await documentoDa({
    titolo: `Fatturazione passiva ${NOMI_TITOLO[result.tipologia] || result.tipologia} — ${result.mese} ${result.anno}`,
    sottotitolo: 'Costi verso i fornitori, per prestazione',
    ...documentoPassiva(result, opzioni.stato),
  });
  const tipi = [];
  const stili = [];
  const righe = righePassiva(result, tipi, stili);
  const { wb } = await nuovaCartella();
  foglioDaRighe(wb, NOMI[result.tipologia] || 'Passiva', {
    doc, righe,
    testate: stili.map((s, i) => (s === 'testata' ? i : -1)).filter(i => i >= 0),
    stili: Object.fromEntries(stili.map((s, i) => [i, s]).filter(([, s]) => s)),
    // il formato lo decide il blocco della riga, come prima: tonnellate, euro, viaggi
    formati: (c, _r, i) => (FORMATI[tipi[i]] || {})[c] || null,
    larghezze: [46, 26, 24, 12, 16, 14, 14, 14, 28, 60],
  });
  return scaricaCartella(wb, nomeFile(result, 'xlsx'));
}

// Lo stesso report in PDF: stesse sezioni, stesse righe, stessi totali
export async function exportFatturazionePassivaPdf(result, opzioni = {}) {
  const { esportaSezioniPdf } = await import('@/lib/esportaTabella');
  await esportaSezioniPdf({
    documento: documentoPassiva(result, opzioni.stato),
    nomeFile: nomeFile(result),
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE  ·  FATTURAZIONE PASSIVA',
    titolo: `Fatturazione passiva ${NOMI_TITOLO[result.tipologia] || result.tipologia} — ${result.mese} ${result.anno}`,
    sottotitolo: 'Costi verso i fornitori, per prestazione',
    riepilogo: [
      { etichetta: 'Raccoglitori', valore: r2(result.totali.raccoglitori), tipo: 'euro' },
      { etichetta: 'Impianti e stoccaggi', valore: r2(result.totali.impianti_stoccaggi), tipo: 'euro' },
      { etichetta: 'Trasporto delle secondarie', valore: r2(result.totali.trasporti_secondaria), tipo: 'euro' },
      { etichetta: `Totale ${NOMI_TITOLO[result.tipologia] || ''}`, valore: r2(result.totali.totale_complessivo), tipo: 'euro' },
      // il surplus, compreso nel totale accanto (13/10/2026)
      ...(Number(result.totali.surplus && result.totali.surplus.totale) > 0
        ? [{ etichetta: `di cui ${nomeDelSurplus(result)}`, valore: r2(result.totali.surplus.totale), tipo: 'euro' }]
        : []),
    ],
    sezioni: sezioniPassiva(result),
    note: (result.anomalie || []).map(anomaliaNelFile),
  });
  return nomeFile(result, 'pdf');
}
