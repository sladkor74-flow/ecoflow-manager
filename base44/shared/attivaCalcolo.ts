// Le righe della fatturazione attiva verso Ecotyre, calcolate in un punto solo.
// L'anteprima (getRiepilogoEcotyre) e il documento (elaboraFatturazioneAttiva)
// passano entrambi di qui: prima avevano due copie dello stesso ciclo, e una
// correzione fatta su una sola bastava a far dire due ricavi allo stesso mese.
//
// Regole:
// - periodo: stato terminato + fine trasporto sul giorno italiano (filtraPeriodo);
// - RETE e ACI: prezzo dalla tabella delle tariffe attive;
// - EXTRA RACCOLTA: prezzo e sovracosti scritti sull'intervento, gli stessi che
//   usa la pagina Extra Raccolta. Ogni intervento ha il suo preventivo, e il
//   ricavo della pagina e quello della fattura devono essere lo stesso numero.
//   Se il prezzo scritto e' zero o manca vale la tariffa base Ecotyre (regola
//   dell'utente del 22/09/2026: «sempre 202 €/t nel 2026»): quella della tabella
//   delle tariffe attive, altrimenti quella dell'anno in ecotyreTariffe.ts. Il
//   prezzo lo sceglie prezzoAttivoExtra di ecotyreTariffe.ts, che ha uno
//   specchio per le pagine: la pagina Extra Raccolta usa la stessa funzione
//   (chiusura dell'audit, 11/10/2026);
// - un terminato di extra raccolta senza peso effettivo non si fattura e si
//   segnala, con la frase di avvisoPesoMancante (11/10/2026): prima si scartava
//   in silenzio;
// - chi fattura e' SMOCO (FATTURANTE_ATTIVA): i fornitori fatturano a SMOCO, e
//   SMOCO fa a Ecotyre una fattura per canale;
// - le secondarie di extra raccolta non si fatturano: il ricavo sta sulla
//   raccolta, il trasferimento dallo stoccaggio all'impianto e' un costo;
// - una riga senza prezzo non e' "verificata": e' un errore da risolvere;
// - un terminato senza fine trasporto non entra nel mese ma si segnala, per
//   canale, e cosi' un terminato del mese con altre date mancanti o incoerenti
//   (regola dell'utente del 22/09/2026, anomalieDateFormulari);
// - lo stesso formulario ripetuto sullo stesso ordine si segnala, con la regola
//   della passiva (formulariDoppi), e la riga resta: il ricavo lo decide
//   l'amministrazione (segnalazione alta del 20/09, corretta il 12/10/2026);
// - la regione di un ritiro e' quella di regioneDi, la regola unica
//   dell'11/10/2026, e un ACI senza regione ne' provincia si segnala.
import { filtraPeriodo, meseToIndice, anomalieDateFormulari } from "./filtroPeriodo.ts";
import {
  sortTariffe, resolveTariffa, calcolaTotale, fattoreConv, prezzoAttivoExtra, tariffeAttiveValide,
  eSecondariaExtra, servizioEcotyre, FATTURANTE_ATTIVA, avvisoPesoMancante,
  unitaAttivaRiconosciuta, unitaSconosciuta,
} from "./ecotyreTariffe.ts";
import { PROV_TO_REGION } from "./raccoltoCalculator.ts";
import { disattivateNelPeriodo } from "./validitaTariffa.ts";
import { regioneDi } from "./regioneMovimento.ts";
import { chiaveFormulario, formulariDoppi } from "./formulari.ts";
import { formatoKg } from "./formato.ts";

export const TIPOLOGIE_ATTIVA = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];
export const UNITA_A_CORPO = '€ a corpo';

const SOVRACOSTI = [
  ['sovracosto_raccolta', 'Sovracosto raccolta'],
  ['sovracosto_trasporto', 'Sovracosto trasporto'],
  ['sovracosto_trattamento', 'Sovracosto trattamento'],
];

const r2 = (v) => Math.round(v * 100) / 100;
// Gli euro di un testo, all'italiana e senza dipendere dalle impostazioni del server.
const euroIt = (v) => {
  const [intero, dec] = Math.abs(r2(Number(v) || 0)).toFixed(2).split('.');
  return (v < 0 ? '-' : '') + intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
};

// LA REGIONE DEL RITIRO E' QUELLA DI regioneDi (segnalazione alta del 20/09,
// corretta il 12/10/2026). Qui si leggeva prima il campo del record, e il prezzo
// ACI cercava la tariffa con r.regione a uguaglianza esatta: un ritiro senza
// provincia con «PUGLIA» scritto nel file prendeva la tariffa generica (230 €/t)
// invece di quella della Puglia (240 €/t), senza un avviso. Ora la regione si
// legge come in tutto il resto del gestionale - prima la provincia, poi la
// regione - e si scrive col nome della regione, «Puglia», cosi' le righe di una
// regione stanno insieme nel riepilogo. Il 10/10 regione e provincia tornavano
// su tutti i ritiri: nessun numero di oggi cambia.
const REGIONI = [...new Set(Object.values(PROV_TO_REGION))];
const regioneRitiro = (r) => {
  const letta = regioneDi(r);
  return REGIONI.find(x => x.toUpperCase() === letta.toUpperCase()) || letta;
};

// Le tariffe valide, la secondaria dell'extra raccolta e il prezzo attivo
// dell'extra raccolta stanno in ecotyreTariffe.ts dall'11/10/2026, perche' la
// pagina Extra Raccolta li usa dallo specchio: qui si riesportano per chi li
// importava da questo file.
export { tariffeAttiveValide, eSecondariaExtra, prezzoAttivoExtra };

// Una riga a corpo (sovracosto) non e' un movimento: non porta chili e non si
// conta fra gli ordini.
export const eRigaACorpo = (riga) => riga.unita_misura === UNITA_A_CORPO;

export function calcolaRigheAttiva({ reteAll, aciAll, extraAll, fornitori, tariffe, anno, mese }) {
  const annoNum = Number(anno);
  const rete = filtraPeriodo(reteAll, annoNum, mese);
  const aci = filtraPeriodo(aciAll, annoNum, mese);
  const extraPeriodo = filtraPeriodo(extraAll, annoNum, mese);
  const extra = extraPeriodo.filter(r => !eSecondariaExtra(r));
  const extraSecondarieEscluse = extraPeriodo.length - extra.length;

  // LA DICITURA E' «TRASP.+TRATT.» PER REGOLA, NON PER MANCANZA DI DATI
  // (decisione dell'utente, 06/10/2026): «Trasp.» solo con la spunta esplicita
  // di un fornitore riconosciuto. La regola e il suo perche' stanno in
  // servizioEcotyre (ecotyreTariffe.ts), che la pagina Extra Raccolta usa per
  // scegliere la stessa tariffa dell'extra raccolta.
  const tipoServizioDi = servizioEcotyre(fornitori);

  const tariffeSorted = sortTariffe(tariffeAttiveValide(tariffe));

  const anomalieMap = new Map();
  const senzaTariffa = (tipologia, regione, classe, eer, servizio, kg) => {
    const key = `${tipologia}|${regione || ''}|${classe || ''}|${eer || ''}|${servizio || ''}`;
    const tonn = kg / 1000;
    if (anomalieMap.has(key)) { anomalieMap.get(key).tonnellate += tonn; return; }
    let desc = `Nessuna tariffa attiva ECOTYRE per tipologia ${tipologia}`;
    if (regione) desc += `, regione ${regione}`;
    if (classe) desc += `, classe ${classe}`;
    if (eer) desc += `, EER ${eer}`;
    desc += `, servizio ${servizio}`;
    anomalieMap.set(key, { tipo: 'senza_tariffa', tipologia, regione: regione || '', classe: classe || '', eer_codice: eer || '', servizio_ecotyre: servizio || '', tonnellate: tonn, descrizione: desc });
  };
  // La tariffa c'e' ma la sua unita' non si sa leggere: una voce per tariffa,
  // con le tonnellate di tutte le righe rimaste a zero per colpa sua.
  const unitaNonLetta = (tipologia, regione, classe, eer, servizio, kg, tariffa) => {
    const key = `unita|${tariffa.id || ''}|${tipologia}|${tariffa.unita_misura || ''}`;
    const tonn = kg / 1000;
    if (anomalieMap.has(key)) { anomalieMap.get(key).tonnellate += tonn; return; }
    anomalieMap.set(key, {
      tipo: 'unita_sconosciuta', tipologia, regione: regione || '', classe: classe || '', eer_codice: eer || '', servizio_ecotyre: servizio || '', tonnellate: tonn,
      descrizione: `Tariffa attiva ${tipologia} ${tariffa.valore} ${tariffa.unita_misura || ''}`.trimEnd() + `: ${unitaSconosciuta(tariffa.unita_misura)}.`,
    });
  };

  const comune = (r, tipologia, tipoServizio, origine) => ({
    tipologia, tipo: 'ATTIVA',
    servizio_ecotyre: tipoServizio,
    fatturante: FATTURANTE_ATTIVA,
    ordine: r.id_ordine || '',
    data_fine_trasporto: r.trasporto_finito_il || null,
    numero_fir: r.numero_fir || '',
    classe: r.classe || '', eer_codice: r.cer || '',
    origine_dato: origine, origine_record_id: r.id,
    sospesa: false, motivo_sospensione: '',
    anno: annoNum, mese,
  });

  const daTariffa = (r, tipologia, origine, regioneTariffa, regioneRiga, altro = {}) => {
    const kg = r.peso_effettivo || 0;
    const tipoServizio = tipoServizioDi(r);
    const tariffa = resolveTariffa(tariffeSorted, tipologia, r.classe, regioneTariffa, r.cer, r.trasporto_finito_il, tipoServizio);
    if (!tariffa) senzaTariffa(tipologia, regioneTariffa, r.classe, r.cer, tipoServizio, kg);
    // UN'UNITA' CHE NON SI SA LEGGERE NON E' UN PREZZO AL CHILO (chiusura
    // dell'audit, 11/10/2026): calcolaTotale ci moltiplicava i chili, mille volte
    // il dovuto e senza un avviso. Ora la riga vale zero, e' in errore e lo dice.
    const unitaIgnota = !!tariffa && !unitaAttivaRiconosciuta(tariffa.unita_misura);
    if (unitaIgnota) unitaNonLetta(tipologia, regioneTariffa, r.classe, r.cer, tipoServizio, kg, tariffa);
    return {
      ...comune(r, tipologia, tipoServizio, origine), ...altro,
      regione: regioneRiga,
      quantita: kg, unita_quantita: 'kg',
      tariffa_id: tariffa?.id || '', tariffa_valore: tariffa?.valore || 0,
      unita_misura: tariffa?.unita_misura || '€/t',
      unita_prezzo: tariffa?.unita_misura || '€/t',
      fattore_conversione: fattoreConv(tariffa),
      totale: r2(calcolaTotale(kg, tariffa)),
      stato_validazione: tariffa && !unitaIgnota ? 'verificato' : 'errore',
      note: !tariffa ? 'Nessuna tariffa attiva applicabile: riga a zero euro'
        : unitaIgnota ? unitaSconosciuta(tariffa.unita_misura) : '',
    };
  };

  const righe = { RETE: [], ACI: [], EXTRA_RACCOLTA: [] };

  for (const r of rete) {
    if (!(r.peso_effettivo > 0)) continue;
    righe.RETE.push(daTariffa(r, 'RETE', 'TERMINATI_RETE', '', regioneRitiro(r)));
  }
  // Il prezzo ACI cambia con la regione (240 €/t Campania e Puglia, 230 €/t
  // Calabria nel 2026): un ritiro senza regione ne' provincia non puo' prendere
  // quella della sua regione, e deve dirlo invece di passare con la tariffa
  // senza regione o a zero euro (12/10/2026).
  const aciSenzaRegione = [];
  for (const r of aci) {
    if (!(r.peso_effettivo > 0)) continue;
    const regione = regioneRitiro(r);
    const riga = daTariffa(r, 'ACI', 'ACI', regione, regione, { ticket_n: r.numero_ordine_interno || '' });
    if (!regione) aciSenzaRegione.push(riga);
    righe.ACI.push(riga);
  }

  for (const r of extra) {
    const kg = Number(r.peso_effettivo) > 0 ? Number(r.peso_effettivo) : 0;
    const tipoServizio = tipoServizioDi(r);
    const regione = regioneRitiro(r);
    if (!kg) {
      // Un terminato del mese senza peso effettivo non si fattura, ma non si
      // scarta piu' in silenzio (11/10/2026): si dice, con la stessa frase della
      // pagina Extra Raccolta. La quantita' ritirata non lo sostituisce.
      anomalieMap.set(`extraPeso|${r.id}`, {
        tipo: 'peso_mancante', tipologia: 'EXTRA_RACCOLTA', regione, classe: r.classe || '', eer_codice: r.cer || '', servizio_ecotyre: tipoServizio, tonnellate: 0,
        quanti: 1, ordini: [{ ordine: r.id_ordine || '', numero_fir: r.numero_fir || '' }],
        descrizione: avvisoPesoMancante(r),
      });
      continue;
    }
    const base = comune(r, 'EXTRA_RACCOLTA', tipoServizio, 'EXTRA_RACCOLTA');
    const prezzo = prezzoAttivoExtra(r, tariffeSorted, tipoServizio, annoNum);
    if (!prezzo.valore) {
      // Niente prezzo sull'intervento e nessuna base per l'anno: e' un errore,
      // come una riga di rete senza tariffa. Il 2026 una base ce l'ha.
      anomalieMap.set(`extra0|${r.id}`, {
        tipo: 'prezzo_zero', tipologia: 'EXTRA_RACCOLTA', regione, classe: r.classe || '', eer_codice: r.cer || '', servizio_ecotyre: tipoServizio, tonnellate: kg / 1000,
        descrizione: `Extra raccolta ${r.id_ordine || r.numero_fir || ''}: sull'intervento il prezzo attivo e' zero e per il ${annoNum} non c'e' una tariffa base Ecotyre (ne' nella tabella delle tariffe attive ne' fra quelle note al gestionale). Scrivi il prezzo sull'intervento o aggiungi la tariffa EXTRA_RACCOLTA.`,
      });
    }
    // Il prezzo c'e', ma viene da una tariffa di un altro anno rimasta aperta:
    // in un intervento occasionale il prezzo si concorda di volta in volta,
    // quindi non deve passare in silenzio solo perche' un numero c'era.
    if (prezzo.altro_anno) {
      anomalieMap.set(`extraAnno|${r.id}`, {
        tipo: 'prezzo_altro_anno', tipologia: 'EXTRA_RACCOLTA', regione, classe: r.classe || '', eer_codice: r.cer || '', servizio_ecotyre: tipoServizio, tonnellate: kg / 1000,
        descrizione: `Extra raccolta ${r.id_ordine || r.numero_fir || ''}: sull'intervento il prezzo non e' scritto, e quello applicato (${prezzo.valore} ${prezzo.unita}) viene dalla tariffa del ${prezzo.anno_tariffa}, rimasta aperta; l'intervento e' del ${annoNum}. Scrivi sull'intervento il prezzo concordato per questa campagna.`,
      });
    }
    // La tariffa della tabella con un'unita' che non si sa leggere: la riga
    // vale zero, e si dice come per la rete e l'ACI (11/10/2026).
    if (prezzo.unita_sconosciuta) {
      unitaNonLetta('EXTRA_RACCOLTA', regione, r.classe, r.cer, tipoServizio, kg, { id: prezzo.id, valore: prezzo.valore, unita_misura: (tariffeSorted.find(t => t.id === prezzo.id) || {}).unita_misura });
    }
    righe.EXTRA_RACCOLTA.push({
      ...base, regione,
      quantita: kg, unita_quantita: 'kg',
      tariffa_id: prezzo.id, tariffa_valore: prezzo.valore,
      unita_misura: prezzo.unita, unita_prezzo: prezzo.unita, fattore_conversione: prezzo.fattore,
      totale: r2(prezzo.totale(kg)),
      stato_validazione: prezzo.valore && !prezzo.unita_sconosciuta ? 'verificato' : 'errore', note: prezzo.nota,
    });
    for (const [campo, etichetta] of SOVRACOSTI) {
      const importo = Number(r[campo] || 0);
      if (!importo) continue;
      righe.EXTRA_RACCOLTA.push({
        ...base, regione,
        descrizione: etichetta,
        quantita: 0, unita_quantita: 'kg',
        tariffa_id: 'intervento', tariffa_valore: importo,
        unita_misura: UNITA_A_CORPO, unita_prezzo: UNITA_A_CORPO, fattore_conversione: 1,
        totale: r2(importo),
        stato_validazione: 'verificato', note: `${etichetta} scritto sull'intervento`,
      });
    }
  }

  const anomalie = Array.from(anomalieMap.values()).map(a => ({ ...a, tonnellate: r2(a.tonnellate) }));
  // IL FORMULARIO RIPETUTO SULLO STESSO ORDINE (segnalazione alta del 20/09,
  // corretta il 12/10/2026). L'attiva faceva una riga di ricavo per ogni record
  // e non guardava i doppioni: lo stesso FIR due volte su ET26091175 dava due
  // righe ACI, 940,80 euro, e nessun avviso, mentre la passiva lo stesso caso lo
  // segnala. La regola ora e' la sua, formulariDoppi di formulari.ts, cosi' i due
  // moduli dicono la stessa cosa. Lo stesso formulario su ordini diversi non e'
  // un doppione: e' la ripartizione dell'ACI. Le righe restano: quale tenere lo
  // decide l'amministrazione, il gestionale lo dice e basta. Un canale per volta:
  // rete, ACI ed extra raccolta non si mescolano nemmeno qui.
  const delMesePerCanale = { RETE: rete, ACI: aci, EXTRA_RACCOLTA: extra };
  for (const tipologia of TIPOLOGIE_ATTIVA) {
    const conNumero = delMesePerCanale[tipologia].filter(r => !!chiaveFormulario(r));
    for (const d of formulariDoppi(conNumero)) {
      const ids = new Set(d.righe.map(x => x.id));
      const euro = righe[tipologia].filter(x => ids.has(x.origine_record_id)).reduce((s, x) => s + (Number(x.totale) || 0), 0);
      const kg = d.righe.reduce((s, x) => s + (Number(x.peso_effettivo) || 0), 0);
      // un peso che manca non e' zero: si scrive «—» (revisione del 13/10/2026)
      const pesi = d.righe.map(x => (x.peso_effettivo === null || x.peso_effettivo === undefined || x.peso_effettivo === '' ? '—' : `${formatoKg(x.peso_effettivo)} kg`)).join(' + ');
      // QUANTE VOLTE CONTA DAVVERO IN FATTURA (revisione del 13/10/2026): solo le
      // copie col peso effettivo fanno una riga di ricavo, le altre si saltano
      // qui sopra (rete, ACI ed extra raccolta con la stessa condizione). Prima la
      // frase contava le copie dell'archivio: 1.960 kg + 0 kg diceva «conta 2
      // volte» su una fattura con una riga sola.
      const inFattura = d.righe.filter(x => Number(x.peso_effettivo) > 0).length;
      const senzaPeso = d.righe.length - inFattura;
      const fattura = inFattura === 0 ? 'nella fattura a Ecotyre non entra, perché nessuna copia ha il peso effettivo'
        : inFattura === 1 ? `nella fattura a Ecotyre conta una volta (${euroIt(euro)} €)`
          : `nella fattura a Ecotyre conta ${inFattura} volte (${euroIt(euro)} € in tutto)`;
      const scartate = senzaPeso === 0 || inFattura === 0 ? ''
        : senzaPeso === 1 ? ': la copia senza peso effettivo non si fattura' : `: le ${senzaPeso} copie senza peso effettivo non si fatturano`;
      anomalie.push({
        tipo: 'formulario_ripetuto', tipologia, regione: regioneRitiro(d.righe[0]), classe: d.righe[0].classe || '', eer_codice: d.righe[0].cer || '', servizio_ecotyre: '',
        tonnellate: Math.round(kg) / 1000, quanti: d.righe.length, in_fattura: inFattura,
        ordini: d.righe.map(x => ({ ordine: x.id_ordine || '', numero_fir: x.numero_fir || '' })),
        descrizione: `Formulario ${d.numero_fir} presente ${d.righe.length} volte sullo stesso ordine ${d.ordine} (${pesi}): è lo stesso ritiro caricato più volte, e ${fattura}${scartate}. Le righe restano: quale tenere lo decide l'amministrazione.`,
      });
    }
  }
  if (aciSenzaRegione.length) {
    const kg = aciSenzaRegione.reduce((s, x) => s + (Number(x.quantita) || 0), 0);
    const aZero = aciSenzaRegione.filter(x => !x.tariffa_id).length;
    const n = aciSenzaRegione.length;
    const elenco = aciSenzaRegione.slice(0, 5).map(x => x.ordine || x.numero_fir || '—').join(', ') + (n > 5 ? ` e altri ${n - 5}` : '');
    const conGenerica = n - aZero;
    const esito = aZero === n ? (n === 1 ? 'il ritiro è rimasto senza prezzo' : 'questi ritiri sono rimasti senza prezzo')
      : aZero === 0 ? `${n === 1 ? 'il ritiro ha' : 'questi ritiri hanno'} preso la tariffa ACI senza regione, che può non essere la sua`
        : `di questi ${conGenerica} ${conGenerica === 1 ? 'ha' : 'hanno'} preso la tariffa ACI senza regione e ${aZero} ${aZero === 1 ? 'è rimasto' : 'sono rimasti'} senza prezzo`;
    anomalie.push({
      tipo: 'regione_mancante', tipologia: 'ACI', regione: '', classe: '', eer_codice: '', servizio_ecotyre: '',
      tonnellate: Math.round(kg) / 1000, quanti: n,
      ordini: aciSenzaRegione.map(x => ({ ordine: x.ordine, numero_fir: x.numero_fir })),
      descrizione: `ACI: ${n === 1 ? 'un ritiro del mese' : `${n} ritiri del mese`} senza provincia né regione (${elenco}). Il prezzo ACI cambia con la regione: senza, non si può scegliere quello giusto, e ${esito}. Correggi la provincia nel caricamento.`,
    });
  }
  // UNA TARIFFA 'non_attivo' NON VALE MAI (regola unica di validitaTariffa.ts,
  // 11/10/2026). Fino a quel giorno qui valeva nella sua finestra se aveva una
  // data di fine, e nel foglio dell'amministrazione no. Se una cosi' tocca il
  // mese, si dice: il prezzo non deve sparire in silenzio.
  {
    const mm = String(meseToIndice(mese) + 1).padStart(2, '0');
    for (const t of disattivateNelPeriodo(tariffe, `${annoNum}-${mm}-01`, `${annoNum}-${mm}-31`)) {
      if (String(t.direzione || '').toUpperCase() !== 'ATTIVA' || !TIPOLOGIE_ATTIVA.includes(t.tipologia)) continue;
      anomalie.push({
        tipo: 'tariffa_disattivata', tipologia: t.tipologia, regione: t.regione || '', classe: t.classe_materiale || '', eer_codice: t.eer_codice || '', servizio_ecotyre: t.servizio_ecotyre || '', tonnellate: 0,
        descrizione: `Tariffa attiva ${t.tipologia} ${t.valore} ${t.unita_misura || ''}`.trimEnd() + ` 'non attiva' con la validita' fino al ${String(t.data_fine_validita).slice(0, 10).split('-').reverse().join('/')}: una tariffa non attiva non vale mai, nemmeno nella sua finestra. Se deve valere per questo mese, rimettila attiva dall'elenco delle tariffe.`,
      });
    }
  }
  if (extraSecondarieEscluse > 0) {
    anomalie.push({
      tipo: 'informazione', tipologia: 'EXTRA_RACCOLTA', regione: '', classe: '', eer_codice: '', servizio_ecotyre: '', tonnellate: 0,
      descrizione: `${extraSecondarieEscluse} ${extraSecondarieEscluse === 1 ? 'secondaria di extra raccolta non fatturata' : 'secondarie di extra raccolta non fatturate'} a Ecotyre: il ricavo sta sulla raccolta.`,
    });
  }
  // Le date obbligatorie dei formulari, canale per canale: i terminati senza fine
  // trasporto che potrebbero essere di questo mese (fuori dalla fattura finche'
  // la data manca) e quelli del mese con altre date mancanti o incoerenti.
  // L'extra raccolta guarda solo cio' che si fattura: le sue secondarie no.
  const meseIdx = meseToIndice(mese);
  const perCanale = { RETE: reteAll, ACI: aciAll, EXTRA_RACCOLTA: (extraAll || []).filter(r => !eSecondariaExtra(r)) };
  for (const tipologia of TIPOLOGIE_ATTIVA) {
    for (const a of anomalieDateFormulari(perCanale[tipologia], annoNum, meseIdx, tipologia)) {
      anomalie.push({
        tipo: a.tipo, tipologia, regione: '', classe: '', eer_codice: '', servizio_ecotyre: '',
        tonnellate: Math.round(a.kg) / 1000, quanti: a.quanti, ordini: a.ordini, descrizione: a.descrizione,
      });
    }
  }
  return { righe, anomalie, extra_secondarie_escluse: extraSecondarieEscluse };
}

// ─── Riconciliazione: il documento salvato contro i dati di oggi ───
// Il portale chiude gli ordini giorni dopo il trasporto: un ritiro del 30 giugno
// chiuso il 4 luglio entra negli archivi DOPO che giugno e' stato elaborato.
// Niente confrontava il documento con i dati correnti, e quei movimenti non
// venivano mai fatturati. La chiave e' ordine + formulario + descrizione: gli
// id dei record cambiano a ogni importazione e non si possono usare.
const chiaveRiga = (r) => `${String(r.ordine || '').trim()}|${String(r.numero_fir || '').trim()}|${r.descrizione || ''}`;

function perChiave(righe) {
  const m = new Map();
  for (const r of righe || []) {
    const k = chiaveRiga(r);
    const e = m.get(k) || { ordine: r.ordine || '', numero_fir: r.numero_fir || '', descrizione: r.descrizione || '', data_fine_trasporto: r.data_fine_trasporto || null, kg: 0, totale: 0 };
    e.kg += Number(r.quantita) || 0;
    e.totale += Number(r.totale) || 0;
    m.set(k, e);
  }
  return m;
}

export function riconciliaAttiva(righeVive, vociSalvate) {
  const vive = perChiave(righeVive);
  const salvate = perChiave(vociSalvate);
  const nuovi = [], spariti = [], cambiati = [];
  for (const [k, v] of vive) {
    const s = salvate.get(k);
    if (!s) { nuovi.push({ ...v, totale: r2(v.totale) }); continue; }
    if (Math.round(v.kg) !== Math.round(s.kg) || Math.abs(v.totale - s.totale) > 0.005) {
      cambiati.push({ ordine: v.ordine, numero_fir: v.numero_fir, descrizione: v.descrizione, data_fine_trasporto: v.data_fine_trasporto, kg_documento: s.kg, kg_oggi: v.kg, totale_documento: r2(s.totale), totale_oggi: r2(v.totale) });
    }
  }
  for (const [k, s] of salvate) if (!vive.has(k)) spariti.push({ ...s, totale: r2(s.totale) });
  const somma = (m, campo) => { let t = 0; for (const e of m.values()) t += e[campo]; return t; };
  const deltaKg = Math.round(somma(vive, 'kg') - somma(salvate, 'kg'));
  const deltaEuro = r2(somma(vive, 'totale') - somma(salvate, 'totale'));
  return {
    allineato: nuovi.length === 0 && spariti.length === 0 && cambiati.length === 0,
    nuovi, spariti, cambiati,
    delta_kg: deltaKg, delta_euro: deltaEuro,
  };
}

// Il documento valido di una tipologia: mai un superato, mai una bozza lasciata
// a meta' da un'elaborazione interrotta; fra piu' candidati vale il piu' recente.
export function documentoValido(docs, tipologia) {
  return (docs || [])
    .filter(d => d.tipologia === tipologia && !d.superato && d.stato !== 'bozza')
    .sort((a, b) => String(b.data_elaborazione || '').localeCompare(String(a.data_elaborazione || '')))[0] || null;
}
