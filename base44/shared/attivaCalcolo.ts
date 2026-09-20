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
//   ricavo della pagina e quello della fattura devono essere lo stesso numero;
// - le secondarie di extra raccolta non si fatturano: il ricavo sta sulla
//   raccolta, il trasferimento dallo stoccaggio all'impianto e' un costo;
// - una riga senza prezzo non e' "verificata": e' un errore da risolvere.
import { filtraPeriodo } from "./filtroPeriodo.ts";
import { sortTariffe, resolveTariffa, calcolaTotale, fattoreConv } from "./ecotyreTariffe.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { PROV_TO_REGION } from "./raccoltoCalculator.ts";

export const TIPOLOGIE_ATTIVA = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];
export const UNITA_A_CORPO = '€ a corpo';

const SOVRACOSTI = [
  ['sovracosto_raccolta', 'Sovracosto raccolta'],
  ['sovracosto_trasporto', 'Sovracosto trasporto'],
  ['sovracosto_trattamento', 'Sovracosto trattamento'],
];

const r2 = (v) => Math.round(v * 100) / 100;

// Regione del ritiro: se il record non la riporta si ricava dalla provincia.
// La tariffa continua a usare la regione del record.
const regioneRitiro = (r) => r.regione || PROV_TO_REGION[String(r.provincia || '').toUpperCase().trim()] || '';

// Le tariffe che valgono per almeno un periodo: una tariffa rinegoziata resta
// buona per i mesi prima del cambio (decide la finestra di validita', non lo stato).
export const tariffeAttiveValide = (tariffe) => (tariffe || []).filter(t => t.stato === 'attivo' || !!t.data_fine_validita);

export const eSecondariaExtra = (r) => String(r.tipo_movimento || '').toLowerCase().trim() === 'secondaria';

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

  const fornitoreMap = new Map();
  for (const f of fornitori || []) {
    const key = normalizzaRagioneSociale(f.ragione_sociale);
    if (key) fornitoreMap.set(key, f);
  }
  // TRASP se l'impianto di destinazione ha il trattamento fatturato da Ecotyre
  const tipoServizioDi = (r) => {
    if (!r.destinazione) return 'TRASP_TRATT';
    const f = fornitoreMap.get(normalizzaRagioneSociale(r.destinazione));
    return f && f.trattamento_fatturato_da_ecotyre === true ? 'TRASP' : 'TRASP_TRATT';
  };

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

  const comune = (r, tipologia, tipoServizio, origine) => ({
    tipologia, tipo: 'ATTIVA',
    servizio_ecotyre: tipoServizio,
    fatturante: 'ECOTYRE',
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
    return {
      ...comune(r, tipologia, tipoServizio, origine), ...altro,
      regione: regioneRiga,
      quantita: kg, unita_quantita: 'kg',
      tariffa_id: tariffa?.id || '', tariffa_valore: tariffa?.valore || 0,
      unita_misura: tariffa?.unita_misura || '€/t',
      unita_prezzo: tariffa?.unita_misura || '€/t',
      fattore_conversione: fattoreConv(tariffa),
      totale: r2(calcolaTotale(kg, tariffa)),
      stato_validazione: tariffa ? 'verificato' : 'errore',
      note: tariffa ? '' : 'Nessuna tariffa attiva applicabile: riga a zero euro',
    };
  };

  const righe = { RETE: [], ACI: [], EXTRA_RACCOLTA: [] };

  for (const r of rete) {
    if (!(r.peso_effettivo > 0)) continue;
    righe.RETE.push(daTariffa(r, 'RETE', 'TERMINATI_RETE', '', regioneRitiro(r)));
  }
  for (const r of aci) {
    if (!(r.peso_effettivo > 0)) continue;
    righe.ACI.push(daTariffa(r, 'ACI', 'ACI', r.regione || '', r.regione || '', { ticket_n: r.numero_ordine_interno || '' }));
  }

  for (const r of extra) {
    const kg = r.peso_effettivo || 0;
    if (kg === 0) continue;
    const tipoServizio = tipoServizioDi(r);
    const prezzo = Number(r.prezzo_attivo_t || 0);
    const base = comune(r, 'EXTRA_RACCOLTA', tipoServizio, 'EXTRA_RACCOLTA');
    const regione = regioneRitiro(r);
    let nota = 'Prezzo scritto sull\'intervento';
    let stato = 'verificato';
    if (prezzo === 0) {
      // Un intervento a zero puo' essere voluto; se pero' il contratto un prezzo
      // lo prevede, il campo e' rimasto vuoto per dimenticanza.
      const daContratto = resolveTariffa(tariffeSorted, 'EXTRA_RACCOLTA', r.classe, r.regione || '', r.cer, r.trasporto_finito_il, tipoServizio);
      stato = 'da_controllare';
      nota = 'Prezzo attivo a zero sull\'intervento';
      const desc = daContratto && Number(daContratto.valore) > 0
        ? `Extra raccolta ${r.id_ordine || r.numero_fir || ''}: sull'intervento il prezzo attivo e' zero, ma la tariffa Ecotyre prevede ${daContratto.valore} ${daContratto.unita_misura}. Se va fatturato, scrivilo sull'intervento.`
        : `Extra raccolta ${r.id_ordine || r.numero_fir || ''}: prezzo attivo a zero sull'intervento.`;
      anomalieMap.set(`extra0|${r.id}`, { tipo: 'prezzo_zero', tipologia: 'EXTRA_RACCOLTA', regione, classe: r.classe || '', eer_codice: r.cer || '', servizio_ecotyre: tipoServizio, tonnellate: kg / 1000, descrizione: desc });
    }
    righe.EXTRA_RACCOLTA.push({
      ...base, regione,
      quantita: kg, unita_quantita: 'kg',
      tariffa_id: 'intervento', tariffa_valore: prezzo,
      unita_misura: '€/t', unita_prezzo: '€/t', fattore_conversione: 1000,
      totale: r2((kg / 1000) * prezzo),
      stato_validazione: stato, note: nota,
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
  if (extraSecondarieEscluse > 0) {
    anomalie.push({
      tipo: 'informazione', tipologia: 'EXTRA_RACCOLTA', regione: '', classe: '', eer_codice: '', servizio_ecotyre: '', tonnellate: 0,
      descrizione: `${extraSecondarieEscluse} ${extraSecondarieEscluse === 1 ? 'secondaria di extra raccolta non fatturata' : 'secondarie di extra raccolta non fatturate'} a Ecotyre: il ricavo sta sulla raccolta.`,
    });
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
