// IL QUADRO DELLA COMMESSA IN PDF (migliorie dell'11/10/2026).
//
// Gli argomenti di esportaSezioniPdf (src/lib/esportaTabella.js, il corredo
// comune: fascia SMOCO, riquadri di riepilogo, intestazioni ripetute, piede con
// data e pagina), fatti coi dati gia' a video: nessuna lettura in piu'. Lo
// chiama EsportaPdf al clic.
//
// - I canali non si sommano nemmeno qui: rete, ACI ed extra raccolta hanno
//   ciascuno le sue tabelle, e nessuna riga o riquadro li mette insieme.
// - Un valore che manca esce «—», mai 0 ne' una cella vuota.
// - L'economia (ricavi, costi, margine) esce solo se l'amministratore spunta
//   «con l'economia», spenta in partenza: il quadro si manda fuori, i costi dei
//   fornitori sono dell'amministratore.
// - «Da gestire» non c'e': e' il lavoro di casa, non il quadro della commessa.
import { t, pct, giorno, giornoMese, NOMI_CANALE } from '@/components/dashboard/formato';
import { cifreRete, righeMesi, righeRegioni } from '@/components/dashboard/righeQuadro';

// Il PDF scrive i numeri col suo formato; un valore che manca e' «—».
const n = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : Number(v));
const CANALI = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];

const colonneRaccoglitori = [
  { titolo: 'Raccoglitore', peso: 3 }, { titolo: 'Regione', peso: 1.5 },
  { titolo: 'Target ad oggi', tipo: 't' }, { titolo: 'Raccolto', tipo: 't' }, { titolo: 'Scarto', tipo: 't' }, { titolo: '%', tipo: 'percentuale' },
];
const rigaRaccoglitore = (r) => ({ celle: [r.raccoglitore, r.regione, n(r.target_ad_oggi_t), n(r.raccolto_t), n(r.scarto_t), n(r.pct)] });
const sezioneMesi = (titolo, mesi, etichetta = 'Raccolto') => ({
  titolo,
  colonne: [{ titolo: 'Mese', peso: 2 }, { titolo: etichetta, tipo: 't' }],
  righe: (mesi || []).map(m => ({ celle: [m.mese, m.futuro ? '—' : n(m.raccolto_t)] })),
});

/**
 * { quadro, impianti, annoInCorso, mesiAttiva, margine, conEconomia, isAdmin }
 * -> { nomeFile, titolo, sottotitolo, riepilogo, sezioni, note, titoloNote }
 */
export function argomentiQuadroPdf({ quadro, impianti = null, annoInCorso = false, mesiAttiva = null, margine = null, conEconomia = false, isAdmin = false }) {
  if (!quadro) return null;
  const anno = quadro.anno;
  const rete = quadro.rete;
  const aci = quadro.aci;
  const extra = quadro.extra;
  const giornoDati = quadro.giorno_dati;
  const nomeGiorno = giornoDati ? giorno(giornoDati).replace(/\//g, '-') : 'nessun dato';
  // Il giorno delle etichette dell'atteso: per un anno chiuso il 31/12, non il
  // giorno dei dati dell'anno dopo (revisione delle migliorie, 11/10/2026).
  const giornoMisura = quadro.giorno_misura !== undefined ? quadro.giorno_misura : giornoDati;
  const a = rete.atteso;

  const sezioni = [];
  sezioni.push({
    titolo: `Rete — il contratto Ecotyre ${anno}`,
    colonne: [{ titolo: 'Voce', peso: 2 }, { titolo: 'Valore', peso: 2 }, { titolo: 'Nota', peso: 4 }],
    // le frecce dello scarto restano a video: il carattere del PDF non le ha, e la
    // parola («avanti di», «indietro di») dice gia' il verso
    righe: cifreRete(rete, { annoInCorso }).map(c => ({ celle: [c.etichetta, String(c.valore).replace(/[▲▼]s*/g, ''), c.sotto || ''] })),
  });
  sezioni.push({
    titolo: 'Rete — mese per mese',
    colonne: [{ titolo: 'Mese', peso: 1.6 }, { titolo: 'Target del profilo', tipo: 't' }, { titolo: 'Budget SMOCO', tipo: 't' }, { titolo: 'Raccolto', tipo: 't' },
      { titolo: 'Scarto del mese', tipo: 't' }, { titolo: 'Target progressivo', tipo: 't' }, { titolo: 'Raccolto progressivo', tipo: 't' }],
    righe: righeMesi(rete.mesi).map(r => ({ celle: [r.aMeta ? `${r.mese} (al ${giornoMese(giornoMisura)})` : r.mese, n(r.targetMese), n(r.budget), n(r.raccolto), n(r.scarto), n(r.targetCum), n(r.raccoltoCum)] })),
  });
  sezioni.push({
    titolo: 'Rete — regioni',
    colonne: [{ titolo: 'Regione', peso: 2.4 }, { titolo: 'Target', tipo: 't' }, { titolo: giornoMisura ? `Atteso al ${giornoMese(giornoMisura)}` : 'Atteso', tipo: 't' },
      { titolo: 'Raccolto', tipo: 't' }, { titolo: 'Scarto', tipo: 't' }, { titolo: "% dell'atteso", tipo: 'percentuale' }],
    righe: [
      ...righeRegioni(rete).map(r => ({ celle: [r.regione, n(r.target_t), n(r.atteso_t), n(r.raccolto_t), n(r.scarto_t), n(r.pct_atteso)] })),
      { stile: 'totale', celle: ['Totale rete', n(rete.target_t), n(a ? a.atteso_t : null), n(rete.raccolto_t), n(a ? a.scarto_t : null), n(a && a.atteso_t ? (rete.raccolto_t / a.atteso_t) * 100 : null)] },
    ],
  });
  if (rete.raccoglitori) {
    sezioni.push({ titolo: 'Rete — raccoglitori più indietro sul loro target', colonne: colonneRaccoglitori, righe: (rete.raccoglitori.indietro || []).map(rigaRaccoglitore) });
    sezioni.push({ titolo: 'Rete — raccoglitori più avanti', colonne: colonneRaccoglitori, righe: (rete.raccoglitori.avanti || []).map(rigaRaccoglitore) });
  }
  sezioni.push({
    titolo: `ACI — autodemolitori ${anno} (un canale a sé, non si somma alla rete)`,
    colonne: [{ titolo: 'Regione', peso: 2.4 }, { titolo: 'Previsione indicativa', tipo: 't' }, { titolo: 'Raccolto', tipo: 't' }, { titolo: '%', tipo: 'percentuale' }],
    righe: [
      ...(aci.regioni || []).map(r => ({ celle: [r.regione, n(r.previsione_t), n(r.raccolto_t), n(r.pct)] })),
      { stile: 'totale', celle: ['Totale ACI', n(aci.previsione_t), n(aci.raccolto_t), n(aci.pct_previsione)] },
    ],
  });
  sezioni.push(sezioneMesi('ACI — mese per mese', aci.mesi));
  sezioni.push(sezioneMesi(`Extra raccolta ${anno} — mese per mese (sempre a parte)`, extra.mesi, 'Tonnellate'));
  if (annoInCorso && impianti && impianti.stato === 'fresca') {
    sezioni.push({
      titolo: `Impianti — da dichiarare per canale (controllo della notte del ${giorno(impianti.giorno)})`,
      colonne: [{ titolo: 'Canale', peso: 2 }, { titolo: 'Da dichiarare', tipo: 't' }, { titolo: 'Impianti', tipo: 'intero' }],
      righe: CANALI.map(c => {
        const d = impianti.da_dichiarare && impianti.da_dichiarare[c];
        return { celle: [NOMI_CANALE[c], n(d ? d.t : null), n(d ? d.impianti : null)] };
      }),
    });
    if ((impianti.scostamenti || []).length) {
      sezioni.push({
        titolo: 'Rete — non quadrano col portale',
        colonne: [{ titolo: 'Impianto o stoccaggio', peso: 3 }, { titolo: 'Calcolata', tipo: 't' }, { titolo: 'Portale', tipo: 't' }, { titolo: 'Scarto', tipo: 't' }],
        righe: impianti.scostamenti.map(s => ({ celle: [s.stoccaggio ? `${s.sito} (stoccaggio)` : s.sito, n(s.calcolata_t), n(s.portale_t), n(s.scarto_t)] })),
      });
    }
  }
  // Un anno passato si guarda dal primo mese con un documento (revisione delle
  // migliorie, 11/10/2026): il 2025, fatturato prima del gestionale, usciva con
  // dodici righe «da elaborare». Quello che resta fuori lo dice la nota.
  const notaAttiva = !annoInCorso && quadro.mesi_attiva_nota ? quadro.mesi_attiva_nota : '';
  if (Array.isArray(mesiAttiva) && mesiAttiva.length) {
    const stato = (c) => (!c || !c.elaborato ? 'da elaborare' : c.chiuso ? 'chiusa' : 'elaborata');
    sezioni.push({
      titolo: `Fatturazione attiva verso Ecotyre ${anno} — mesi per canale`,
      colonne: [{ titolo: 'Mese', peso: 1.6 }, ...CANALI.map(c => ({ titolo: NOMI_CANALE[c] })), { titolo: 'Prefattura' }],
      righe: mesiAttiva.map(m => ({ celle: [m.etichetta || m.mese, ...CANALI.map(c => (m.canali ? stato(m.canali[c]) : m.stato)), m.prefattura ? 'caricata' : 'non caricata'] })),
    });
  }
  // L'ECONOMIA: solo se chi esporta e' l'amministratore e la chiede.
  if (conEconomia && isAdmin && margine && Array.isArray(margine.canali)) {
    sezioni.push({
      titolo: `Economia della commessa ${anno} (riservato: tre commesse, tre margini, non si sommano)`,
      colonne: [{ titolo: 'Canale', peso: 1.6 }, { titolo: 'Ricavo', tipo: 'euro' }, { titolo: 'Costo', tipo: 'euro' }, { titolo: 'Margine', tipo: 'euro' },
        { titolo: '% del ricavo', tipo: 'percentuale' }, { titolo: 'Tonnellate', tipo: 't' }, { titolo: 'Ricavo per t', tipo: 'euro' }, { titolo: 'Costo per t', tipo: 'euro' }],
      righe: margine.canali.map(c => ({ celle: [NOMI_CANALE[c.canale] || c.canale, n(c.anno.ricavo), n(c.anno.costo), n(c.anno.margine), n(c.anno.margine_pct), n(c.anno.tonnellate), n(c.anno.ricavo_t), n(c.anno.costo_t)] })),
    });
  }

  const riepilogo = [
    { etichetta: 'Rete: raccolto', valore: t(rete.raccolto_t) },
    { etichetta: 'Rete: del target annuo', valore: rete.target_t === null || rete.target_t === undefined ? '—' : pct(rete.pct_target) },
    { etichetta: giornoDati && a ? `Rete: scarto sull'atteso al ${giornoMese(a.giorno)}` : "Rete: scarto sull'atteso", valore: a ? `${a.scarto_t >= 0 ? '+' : '-'}${t(Math.abs(a.scarto_t))}` : '—' },
    { etichetta: 'ACI: raccolto', valore: t(aci.raccolto_t) },
    { etichetta: 'Extra raccolta: raccolto', valore: t(extra.raccolto_t) },
  ];
  if (annoInCorso && impianti && impianti.stato === 'fresca') {
    // la stessa etichetta e lo stesso numero di Dichiarazioni Impianti
    riepilogo.push({ etichetta: 'Rete: quadratura con il portale', valore: `${impianti.quadrano} su ${impianti.con_confronto}` });
    const ac = impianti.aci_stoccaggi;
    if (ac && ac.con_confronto > 0) riepilogo.push({ etichetta: 'ACI negli stoccaggi, a parte: quadratura con il portale', valore: `${ac.quadrano} su ${ac.con_confronto}` });
  }

  const note = [
    `Periodo di ogni movimento: il giorno italiano di fine trasporto, mai la chiusura a portale. Dati fino al ${giorno(giornoDati)}.`,
    'Rete, ACI ed extra raccolta sono canali indipendenti: nessuna tabella li somma.',
    `Target: il contratto Ecotyre del ${anno} in Target & Status. Atteso: il target ripartito col profilo mensile del contratto, riportato all'annuo, ${a && a.fine_anno ? `per l'anno intero: il ${anno} è chiuso, e l'atteso al 31/12 è il target.` : 'fino al giorno dei dati.'}`,
    'Proiezione a fine anno: raccolto diviso la quota del profilo coperta dai dati; si dà quando i dati coprono gennaio e febbraio interi.',
    "Raccoglitori: il target ad oggi è la somma dei target mensili, il mese dei dati in proporzione ai giorni coperti; i target copiati dall'anno prima e non confermati restano fuori.",
    "ACI: la previsione del contratto ACI è indicativa, non un obiettivo. Extra raccolta: i trasferimenti in secondaria dello stesso archivio non contano.",
    'Un valore che manca è scritto «—», mai zero.',
  ];
  if (annoInCorso && impianti && impianti.stato === 'fresca') {
    note.push("Impianti: «da dichiarare» è la colonna «Da dichiarare» delle Dichiarazioni Impianti, sommata impianto per impianto e canale per canale, dal controllo della notte; la rete non dovuta per accordo e le giacenze sotto zero non entrano.");
    note.push('Quadratura con il portale: come in Dichiarazioni Impianti, gli impianti e gli stoccaggi della rete che hanno una giacenza a portale; l\'ACI degli stoccaggi a parte.');
  }
  if (notaAttiva) note.push(`Fatturazione attiva: ${notaAttiva}`);

  return {
    nomeFile: `Quadro commessa Ecotyre ${anno} - dati al ${nomeGiorno}`,
    titolo: `Commessa Ecotyre ${anno} — SMOCO Srl, partner operativo`,
    sottotitolo: `Dati fino al ${giorno(giornoDati)} · periodo per fine trasporto · canali separati, mai sommati`,
    riepilogo,
    sezioni,
    note,
    titoloNote: 'Come si leggono questi numeri',
  };
}
