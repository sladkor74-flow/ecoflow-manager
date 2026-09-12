import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

// Elabora la fatturazione attiva per un dato anno/mese:
// Genera 3 documenti (RETE, ACI, EXTRA_RACCOLTA) con righe automatiche
// dai dati operativi del gestionale. Cliente/committente: sempre ECOTYRE.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: richiesto ruolo admin' }, { status: 403 });

    const { anno, mese } = await req.json();
    if (!anno || !mese) return Response.json({ error: 'Anno e mese obbligatori' }, { status: 400 });

    const annoNum = Number(anno);

    // Check for existing closed documents
    const existing = await base44.asServiceRole.entities.DocumentoFatturazione.filter({
      tipo: 'ATTIVA', anno: annoNum, mese
    });
    const closedDocs = existing.filter(d => d.stato === 'chiusa');
    if (closedDocs.length > 0) {
      return Response.json({ error: 'Periodo già chiuso. Impossibile rielaborare.' }, { status: 400 });
    }

    // Load operational data: RETE + ACI from Primarie, EXTRA from ExtraRaccolta (manuale)
    const [rete, aci, extraRaccolta] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.PrimariaRete, { mese }),
      fetchAll(base44.asServiceRole.entities.PrimariaAci, { mese }),
      fetchAll(base44.asServiceRole.entities.ExtraRaccolta, { mese }),
    ]);

    // Load attiva tariffe (per eventuali override custom)
    const tariffe = await base44.asServiceRole.entities.Tariffa.filter({ direzione: 'ATTIVA', stato: 'attivo' });

    const tariffeSorted = [...tariffe].map(t => ({
      ...t,
      specificity: (t.classe_materiale ? 1 : 0) + (t.eer_codice ? 1 : 0) + (t.regione ? 1 : 0),
    })).sort((a, b) => b.specificity - a.specificity);

    function normText(v) { return String(v || '').trim().toUpperCase(); }
    function findTariffa(tipologia, cliente, classe, regione, eer, dataRiferimento) {
      const dt = dataRiferimento ? new Date(dataRiferimento).getTime() : null;
      for (const t of tariffeSorted) {
        if (t.tipologia !== tipologia) continue;
        if (t.cliente && normText(t.cliente) !== normText(cliente)) continue;
        if (t.classe_materiale && t.classe_materiale !== classe) continue;
        if (t.regione && t.regione !== regione) continue;
        if (t.eer_codice && t.eer_codice !== eer) continue;
        if (dt !== null) {
          if (t.data_inizio_validita && new Date(t.data_inizio_validita).getTime() > dt) continue;
          if (t.data_fine_validita && new Date(t.data_fine_validita).getTime() < dt) continue;
        }
        return t;
      }
      return null;
    }

    // Cerca tariffa nella tabella Tariffa (nessun valore predefinito)
    function resolveTariffa(tipologia, classe, regione, eer, dataRiferimento) {
      return findTariffa(tipologia, 'ECOTYRE', classe, regione, eer, dataRiferimento);
    }

    function calcolaTotale(quantitaKg, tariffa) {
      if (!tariffa) return 0;
      const u = tariffa.unita_misura;
      if (u === '€/kg') return quantitaKg * tariffa.valore;
      if (u === '€/ton' || u === '€/t') return (quantitaKg / 1000) * tariffa.valore;
      if (u === '€/viaggio' || u === '€/vg' || u === '€/mese') return tariffa.valore;
      return quantitaKg * tariffa.valore;
    }

    function fattoreConv(tariffa) {
      if (!tariffa) return 1000;
      const u = tariffa.unita_misura;
      return (u === '€/ton' || u === '€/t') ? 1000 : 1;
    }

    const anomalieMap = new Map();
    function addAnomalia(tipologia, regione, classe, eer, quantitaKg) {
      const key = `${tipologia}|${regione || ''}|${classe || ''}|${eer || ''}`;
      const tonn = quantitaKg / 1000;
      if (anomalieMap.has(key)) {
        anomalieMap.get(key).tonnellate += tonn;
      } else {
        let desc = `Nessuna tariffa attiva ECOTYRE per tipologia ${tipologia}`;
        if (regione) desc += `, regione ${regione}`;
        if (classe) desc += `, classe ${classe}`;
        if (eer) desc += `, EER ${eer}`;
        anomalieMap.set(key, { tipologia, regione: regione || '', classe: classe || '', eer_codice: eer || '', tonnellate: tonn, descrizione: desc });
      }
    }

    // --- ELABORAZIONE RETE ---
    const righeRete = [];
    for (const r of rete) {
      const quantitaKg = r.peso_effettivo || 0;
      if (quantitaKg === 0) continue;
      const cliente = 'ECOTYRE';
      const dataRiferimento = r.trasporto_finito_il || r.ordine_chiuso_il || null;
      const tariffa = resolveTariffa('RETE', r.classe, '', r.cer, dataRiferimento);
      if (!tariffa) addAnomalia('RETE', r.regione, r.classe, r.cer, quantitaKg);
      const totale = calcolaTotale(quantitaKg, tariffa);
      righeRete.push({
        tipologia: 'RETE', tipo: 'ATTIVA',
        regione: r.regione || '', fatturante: cliente,
        ordine: r.id_ordine || '',
        data_fine_trasporto: r.trasporto_finito_il || r.ordine_chiuso_il || null,
        numero_fir: r.numero_fir || '',
        classe: r.classe || '', eer_codice: r.cer || '',
        quantita: quantitaKg, unita_quantita: 'kg',
        tariffa_id: tariffa?.id || '', tariffa_valore: tariffa?.valore || 0,
        unita_misura: tariffa?.unita_misura || '€/t',
        unita_prezzo: tariffa?.unita_misura || '€/t',
        fattore_conversione: fattoreConv(tariffa),
        totale: Math.round(totale * 100) / 100,
        origine_dato: 'TERMINATI_RETE', origine_record_id: r.id,
        sospesa: false, motivo_sospensione: '',
        stato_validazione: 'verificato',
        anno: annoNum, mese,
      });
    }

    // --- ELABORAZIONE ACI --- (cliente ECOTYRE, tariffa per regione)
    const righeAci = [];
    for (const r of aci) {
      const quantitaKg = r.peso_effettivo || 0;
      if (quantitaKg === 0) continue;
      const regione = r.regione || '';
      const cliente = 'ECOTYRE';
      const dataRiferimento = r.trasporto_finito_il || r.ordine_chiuso_il || null;
      const tariffa = resolveTariffa('ACI', r.classe, regione, r.cer, dataRiferimento);
      if (!tariffa) addAnomalia('ACI', regione, r.classe, r.cer, quantitaKg);
      const totale = calcolaTotale(quantitaKg, tariffa);
      righeAci.push({
        tipologia: 'ACI', tipo: 'ATTIVA',
        regione, fatturante: cliente,
        ticket_n: r.numero_ordine_interno || '',
        ordine: r.id_ordine || '',
        data_fine_trasporto: r.trasporto_finito_il || r.ordine_chiuso_il || null,
        numero_fir: r.numero_fir || '',
        classe: r.classe || '', eer_codice: r.cer || '',
        quantita: quantitaKg, unita_quantita: 'kg',
        tariffa_id: tariffa?.id || '', tariffa_valore: tariffa?.valore || 0,
        unita_misura: tariffa?.unita_misura || '€/t',
        unita_prezzo: tariffa?.unita_misura || '€/t',
        fattore_conversione: fattoreConv(tariffa),
        totale: Math.round(totale * 100) / 100,
        origine_dato: 'ACI', origine_record_id: r.id,
        sospesa: false, motivo_sospensione: '',
        stato_validazione: 'verificato',
        anno: annoNum, mese,
      });
    }

    // --- ELABORAZIONE EXTRA RACCOLTA --- (dati manuali da ExtraRaccolta, tariffa 202 €/t)
    const righeExtra = [];
    for (const r of extraRaccolta) {
      const quantitaKg = r.peso_effettivo || 0;
      if (quantitaKg === 0) continue;
      const cliente = 'ECOTYRE';
      const dataRiferimento = r.trasporto_finito_il || r.ordine_chiuso_il || null;
      const tariffa = resolveTariffa('EXTRA_RACCOLTA', r.classe, r.regione || '', r.cer, dataRiferimento);
      if (!tariffa) addAnomalia('EXTRA_RACCOLTA', r.regione, r.classe, r.cer, quantitaKg);
      const totale = calcolaTotale(quantitaKg, tariffa);
      righeExtra.push({
        tipologia: 'EXTRA_RACCOLTA', tipo: 'ATTIVA',
        regione: r.regione || '', fatturante: cliente,
        ordine: r.id_ordine || '',
        data_fine_trasporto: r.trasporto_finito_il || r.ordine_chiuso_il || null,
        numero_fir: r.numero_fir || '',
        classe: r.classe || '', eer_codice: r.cer || '',
        quantita: quantitaKg, unita_quantita: 'kg',
        tariffa_id: tariffa?.id || '', tariffa_valore: tariffa?.valore || 0,
        unita_misura: tariffa?.unita_misura || '€/t',
        unita_prezzo: tariffa?.unita_misura || '€/t',
        fattore_conversione: fattoreConv(tariffa),
        totale: Math.round(totale * 100) / 100,
        origine_dato: 'EXTRA_RACCOLTA', origine_record_id: r.id,
        sospesa: false, motivo_sospensione: '',
        stato_validazione: 'verificato',
        anno: annoNum, mese,
      });
    }

    // Delete existing documents and righe
    for (const doc of existing) {
      await base44.asServiceRole.entities.VoceFatturazione.deleteMany({ documento_id: doc.id });
      await base44.asServiceRole.entities.DocumentoFatturazione.delete(doc.id);
    }

    // Create documents
    const meseIdx = MESI.indexOf(mese);
    const dataInizio = new Date(annoNum, meseIdx, 1).toISOString().split('T')[0];
    const dataFine = new Date(annoNum, meseIdx + 1, 0).toISOString().split('T')[0];

    const tipologie = [
      { tipo: 'RETE', righe: righeRete },
      { tipo: 'ACI', righe: righeAci },
      { tipo: 'EXTRA_RACCOLTA', righe: righeExtra },
    ];

    const docs = [];
    for (const { tipo, righe } of tipologie) {
      const totaleNonSospese = righe.reduce((s, r) => s + r.totale, 0);

      const doc = await base44.asServiceRole.entities.DocumentoFatturazione.create({
        tipo: 'ATTIVA', tipologia: tipo, anno: annoNum, mese,
        data_inizio: dataInizio, data_fine: dataFine,
        stato: 'elaborata',
        totale: Math.round(totaleNonSospese * 100) / 100,
        numero_voci: righe.length,
        voci_errore: 0, voci_sospese: 0,
        data_elaborazione: new Date().toISOString(),
        cliente: 'ECOTYRE',
      });

      const righeWithDoc = righe.map(r => ({ ...r, documento_id: doc.id }));
      for (let i = 0; i < righeWithDoc.length; i += 100) {
        await base44.asServiceRole.entities.VoceFatturazione.bulkCreate(righeWithDoc.slice(i, i + 100));
      }

      docs.push({ tipologia: tipo, documento_id: doc.id, totale: doc.totale, voci: righe.length, errori: 0, sospese: 0 });
    }

    const anomalie = Array.from(anomalieMap.values());
    return Response.json({ documenti: docs, anomalie });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}