import { giornoRoma } from '@/lib/giornoItaliano';
import { documentoDa, nuovaCartella, foglioDaRighe, scaricaCartella, FORMATI } from '@/lib/fogliProfessionali';
import { testoFormulario, testoCollocato } from '@/lib/giacenzeDaDichiarareExport';
import { INTESTAZIONE_DATE, righeExcelDate } from '@/components/giacenze/DateDaSistemare';

// I formulari con le date da sistemare di una riga, a parole e per canale (mai
// sommati): "rete 3 (2 senza fine trasporto) · ACI 1".
// Le terziarie non sono un canale: hanno il loro gruppo, a parte (11/10/2026).
const NOMI_CANALE = { RETE: 'rete', ACI: 'ACI', EXTRA_RACCOLTA: 'extra raccolta', TERZIARIE: 'terziarie, a parte' };
const testoDateRiga = (r) => (r.date_da_sistemare || [])
  .map(g => `${NOMI_CANALE[g.canale] || g.canale} ${g.n}${g.senza_fine && g.senza_fine.n ? ` (${g.senza_fine.n} senza fine trasporto)` : ''}`).join(' · ');

// Il giorno italiano, scritto GG/MM/AAAA. Con toLocaleDateString un giorno
// salvato come AAAA-MM-GG (mezzanotte UTC) si leggeva nel fuso del computer, e
// fuori dall'Italia usciva il giorno prima.
function fmtData(v) {
  const g = giornoRoma(v);
  return g ? g.split('-').reverse().join('/') : '';
}

// Gli archivi che le giacenze leggono: i movimenti dei tre canali, la
// fotografia del portale e il report delle dichiarazioni.
const ARCHIVI_GIACENZE = ['PrimariaRete', 'PrimariaAci', 'Secondaria', 'Terziaria', 'ExtraRaccolta', 'OrdineNonDichiarato', 'DichiarazioneTrattamento'];

/**
 * Export complessivo: un foglio per ciascuna delle schede.
 *
 * IL FILE SI VESTE E DICE LA DATA DEI DATI (chiusura dell'audit, 11/10/2026).
 * Usciva da SheetJS, senza fascia ne' piede, e non diceva fino a che giorno
 * arrivavano i movimenti e la fotografia del portale. Ora ogni foglio passa dal
 * corredo comune (fogliProfessionali.js) con le stesse righe di prima, sotto il
 * blocco di testa: anno per fine trasporto, dati fino al di ogni archivio,
 * generato il ... da .... I canali restano in colonne loro, mai sommati, e il
 * blocco lo dice. opzioni.stato: lo stato dei dati gia' letto (le prove).
 */
export async function exportGiacenzeAllExcel(data, ordiniData, anno, opzioni = {}) {
  const doc = await documentoDa({
    titolo: `Giacenze ${anno}`,
    sottotitolo: 'rete, ACI ed extra raccolta in colonne separate, mai sommate',
    periodo: `Anno ${anno}`, entita: ARCHIVI_GIACENZE,
    ...(opzioni.stato !== undefined ? { stato: opzioni.stato } : {}),
  });
  const { wb } = await nuovaCartella();

  // --- Foglio 1: Situazione ---
  // Giacenza per classe in kg, come nel portale Ecotyre. Una colonna per canale:
  // con una sola, uno stoccaggio usciva con rete e ACI in un numero e il TOTALE
  // sommava la classe 9 degli stoccaggi alla rete degli impianti. La cella vuota
  // vuol dire non calcolata (l'ACI di un impianto, uno stoccaggio senza
  // rilevazione, un impianto senza il file degli ordini non dichiarati, la cui
  // giacenza a zero non e' un dato), non zero.
  const CLASSI = ['P', 'M', 'G1', 'G2', 'ACI'];
  // Su un anno che non e' quello in corso l'attesa conta solo i carichi di
  // quell'anno (calcolaGiacenze, revisione finale del 13/10/2026): lo dice
  // l'intestazione, come la pagina, il PDF e la Quadratura delle Dichiarazioni.
  const attesaDel = (data.totali && data.totali.in_attesa_dei_carichi_del) || null;
  const sitHeaders = ['Sito', 'Ruolo', 'Giacenza rete a portale (t)', 'Giacenza ACI (t)', 'Extra raccolta in piazzale, fuori portale (t)', ...CLASSI.map(c => `${c} (kg)`), 'Rilevazione stoccaggio', 'Dati aggiornati al', attesaDel ? `In attesa di dichiarazione, dei carichi del ${attesaDel} (t)` : 'In attesa di dichiarazione (t)', 'Ordini da dichiarare', 'Dichiarato (t)', 'Tipologia trattamento', 'Formulari con le date da sistemare'];
  const senzaFile = (r) => r.tipo_destinazione === 'imp' && !(r.fotografia && r.fotografia.del);
  const classi = (r) => CLASSI.map(c => (r.giacenza_classi_kg && !senzaFile(r) ? r.giacenza_classi_kg[c] || 0 : null));
  const vuotaSeManca = (v) => (v === null || v === undefined ? '' : v);
  const sitRows = data.righe.map(r => [
    r.sito,
    r.tipo_destinazione === 'imp' ? 'Impianto' : 'Stoccaggio',
    vuotaSeManca(senzaFile(r) ? null : r.giacenza_rete_t),
    vuotaSeManca(r.giacenza_aci_t),
    vuotaSeManca(r.giacenza_extra_t),
    ...classi(r),
    r.tipo_destinazione === 'stoc' ? fmtData(r.data_rilevazione) : '',
    fmtData(r.aggiornata_al),
    r.in_attesa_dichiarazione_t,
    r.ordini_da_dichiarare || 0,
    r.dichiarato_t,
    r.tipologia_trattamento || '',
    testoDateRiga(r),
  ]);
  // Il totale e' per canale, come le colonne: tre numeri, mai uno che li somma.
  // Anche i formulari da sistemare: un conteggio per canale, ciascuno una volta.
  const dt = data.totali.date_da_sistemare || {};
  const testoDateTotali = Object.entries(dt).filter(([, v]) => v && v.n).map(([c, v]) => `${NOMI_CANALE[c] || c} ${v.n}${v.senza_fine ? ` (${v.senza_fine} senza fine trasporto)` : ''}`).join(' · ');
  sitRows.push(['TOTALE', '', data.totali.giacenza_portale_t, data.totali.giacenza_aci_t || 0, data.totali.giacenza_extra_t || 0, ...classi(data.totali), '', '', data.totali.in_attesa_dichiarazione_t, data.totali.ordini_da_dichiarare, data.totali.dichiarato_t, '', testoDateTotali]);
  foglioDaRighe(wb, 'Situazione', {
    doc, righe: [sitHeaders, ...sitRows],
    formati: { [CLASSI.length + 8]: FORMATI.intero },
    larghezze: [28, 12, 22, 16, 24, ...CLASSI.map(() => 11), 20, 18, 24, 18, 16, 20, 40],
  });

  // --- Foglio 2: Da dichiarare ---
  // La data che conta e' la fine del trasporto, gia' sul giorno italiano, come
  // nell'export della scheda Da dichiarare: la stessa lista, le stesse colonne.
  // La chiusura a portale non decide niente e qui non serve.
  // Con le due colonne del formulario nel gestionale (22/09/2026), come l'export della scheda.
  const ddHeaders = ['Ordine', 'FIR', 'Fine trasporto', 'Punto di raccolta', 'Comune', 'Prov.', 'Prodotto', 'CER', 'Peso da dichiarare (kg)', 'Destinazione', 'Trasferito a', 'Trasportatore',
    'Formulario nel gestionale: date da sistemare', 'Collocato in un mese dal gestionale'];
  const ddRows = (ordiniData.righe || []).map(r => [
    r.ordine_primaria || '', r.numero_fir || '', r.fine_trasporto ? r.fine_trasporto.split('-').reverse().join('/') : '',
    r.punto_di_raccolta || '', r.comune || '', r.provincia || '',
    r.prodotto || '', r.cer || '', r.peso_non_dichiarato_kg || 0,
    r.destinazione || '', r.destinazione_secondaria || '', r.trasportatore || '',
    testoFormulario(r), testoCollocato(r),
  ]);
  ddRows.push(['TOTALE', '', '', '', '', '', '', '', ordiniData.totale_kg, '', '', '', '', '']);
  foglioDaRighe(wb, 'Da dichiarare', {
    doc, righe: [ddHeaders, ...ddRows],
    larghezze: [16, 16, 14, 28, 18, 6, 18, 10, 18, 24, 24, 24, 48, 36],
  });

  // --- Foglio 3: Derivati ---
  const derHeaders = ['Sito', 'Dichiarato (t)', 'Granulo (t)', 'Fibre (t)', 'Metallo (t)', 'Cippato (t)', 'Ciabattato (t)'];
  const derRows = data.righe.filter(r => r.dichiarato_t > 0).map(r => [
    r.sito, r.dichiarato_t, r.granulo_t, r.fibre_t, r.metallo_t, r.cippato_t, r.ciabattato_t,
  ]);
  derRows.push(['TOTALE', data.totali.dichiarato_t, data.totali.granulo_t, data.totali.fibre_t, data.totali.metallo_t, data.totali.cippato_t, data.totali.ciabattato_t]);
  foglioDaRighe(wb, 'Derivati', { doc, righe: [derHeaders, ...derRows], larghezze: [28, 14, 14, 14, 14, 14, 14] });

  // --- Foglio 4: Target ---
  // Target, residuo e copertura solo sul canale RETE; ACI ed Extra a parte.
  // ACI ed extra raccolta sono la raccolta, cioe' le sole primarie: un
  // trasferimento da un piazzale non e' raccolta in piu' (11/10/2026).
  const tarHeaders = ['Sito', 'Ruolo', 'Target primarie (t)', 'Target totale (t)', 'Primarie RETE (t)', 'Secondarie netto (t)', 'Secondarie in (t)', 'Secondarie out (t)', 'Terziarie (t)', 'Conferito RETE (t)', 'Residuo (t) = Target totale - Conferito RETE', 'Copertura RETE (%) = Primarie RETE / Target totale', 'ACI, solo primarie, fuori target (t)', 'Extra Raccolta, solo primarie, fuori target (t)'];
  const tarRows = data.righe.map(r => [
    r.sito,
    r.tipo_destinazione === 'imp' ? 'Impianto' : 'Stoccaggio',
    r.target_primarie_t,
    r.target_totale_t || '',
    r.conferito_primarie_t,
    r.secondarie_nette_t,
    r.secondarie_in_t,
    r.secondarie_out_t,
    r.terziarie_t,
    r.conferito_t,
    r.residuo_t != null ? r.residuo_t : '',
    r.percentuale_target != null ? r.percentuale_target : '',
    r.conferito_aci_t || 0,
    r.conferito_extra_t || 0,
  ]);
  // Come nelle righe: target totale meno tutto quello che e' arrivato (conferito_t).
  const residuoTot = data.totali.target_totale_t > 0 ? data.totali.target_totale_t - data.totali.conferito_t : '';
  const copTot = data.totali.target_totale_t > 0 ? (data.totali.conferito_primarie_t / data.totali.target_totale_t * 100) : '';
  tarRows.push(['TOTALE', '', data.totali.target_primarie_t, data.totali.target_totale_t || '', data.totali.conferito_primarie_t, data.totali.secondarie_nette_t, data.totali.secondarie_in_t, data.totali.secondarie_out_t, data.totali.terziarie_t, data.totali.conferito_t, residuoTot, copTot, data.totali.conferito_aci_t || 0, data.totali.conferito_extra_t || 0]);
  foglioDaRighe(wb, 'Target', {
    doc, righe: [tarHeaders, ...tarRows],
    // la copertura e' una percentuale con un decimale, non un peso
    formati: { 11: FORMATI.percentuale },
    larghezze: [28, 12, 16, 16, 18, 16, 14, 14, 14, 14, 14, 14, 16, 22],
  });

  // --- Foglio 5: Date da sistemare (regola dell'utente, 22/09/2026) ---
  // I formulari terminati senza tutte le date obbligatorie, per soggetto e canale,
  // uno per riga: quali sono, che cosa manca e che cosa comporta per la giacenza.
  const gruppiDate = (data.anomalie || []).filter(a => a.tipo === 'date_da_sistemare');
  if (gruppiDate.length) {
    foglioDaRighe(wb, 'Date da sistemare', {
      doc, righe: [INTESTAZIONE_DATE, ...righeExcelDate(gruppiDate)],
      larghezze: [28, 12, 14, 16, 16, 34, 12, 12, 14, 14, 18, 40, 50, 60],
    });
  }

  return scaricaCartella(wb, `giacenze_${anno}.xlsx`);
}