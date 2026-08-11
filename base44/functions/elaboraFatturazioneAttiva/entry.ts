import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

// Elabora la fatturazione attiva per un dato anno/mese:
// Genera 3 documenti (RETE, ACI, EXTRA_RACCOLTA) con righe automatiche
// dai dati operativi del gestionale.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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

    // Load operational data
    const [rete, aci, terziarie] = await Promise.all([
      base44.asServiceRole.entities.PrimariaRete.filter({ mese }),
      base44.asServiceRole.entities.PrimariaAci.filter({ mese }),
      base44.asServiceRole.entities.Terziaria.filter({ mese }),
    ]);

    // Load attiva tariffe
    const tariffe = await base44.asServiceRole.entities.Tariffa.filter({ direzione: 'ATTIVA', stato: 'attivo' });

    // Sort by specificity (most specific first)
    const tariffeSorted = [...tariffe].map(t => ({
      ...t,
      specificity: (t.classe_materiale ? 1 : 0) + (t.eer_codice ? 1 : 0) + (t.regione ? 1 : 0),
    })).sort((a, b) => b.specificity - a.specificity);

    function findTariffa(tipologia, cliente, classe, regione, eer) {
      for (const t of tariffeSorted) {
        if (t.tipologia !== tipologia) continue;
        if (t.cliente && t.cliente !== cliente) continue;
        if (t.classe_materiale && t.classe_materiale !== classe) continue;
        if (t.regione && t.regione !== regione) continue;
        if (t.eer_codice && t.eer_codice !== eer) continue;
        return t;
      }
      return null;
    }

    // Calculate total with unit conversion
    function calcolaTotale(quantitaKg, tariffa) {
      if (!tariffa) return 0;
      const u = tariffa.unita_misura;
      if (u === '€/kg') return quantitaKg * tariffa.valore;
      if (u === '€/ton' || u === '€/t') return (quantitaKg / 1000) * tariffa.valore;
      if (u === '€/viaggio' || u === '€/vg' || u === '€/mese') return tariffa.valore;
      return quantitaKg * tariffa.valore;
    }

    function fattoreConv(tariffa) {
      if (!tariffa) return 1;
      const u = tariffa.unita_misura;
      return (u === '€/ton' || u === '€/t') ? 1000 : 1;
    }

    // --- ELABORAZIONE RETE ---
    const righeRete = [];
    for (const r of rete) {
      const quantitaKg = r.peso_effettivo || 0;
      if (quantitaKg === 0) continue;
      const cliente = 'ECOTYRE';
      const tariffa = findTariffa('RETE', cliente, r.classe, '', r.cer);
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
        unita_misura: tariffa?.unita_misura || '€/kg',
        unita_prezzo: tariffa?.unita_misura || '€/kg',
        fattore_conversione: fattoreConv(tariffa),
        totale: Math.round(totale * 100) / 100,
        origine_dato: 'TERMINATI_RETE', origine_record_id: r.id,
        sospesa: !tariffa, motivo_sospensione: !tariffa ? 'Tariffa non trovata' : '',
        stato_validazione: !tariffa ? 'errore' : 'verificato',
        anno: annoNum, mese,
      });
    }

    // --- ELABORAZIONE ACI ---
    const righeAci = [];
    for (const r of aci) {
      const quantitaKg = r.peso_effettivo || 0;
      if (quantitaKg === 0) continue;
      const regione = r.regione || '';
      const cliente = 'ACI';
      const tariffa = findTariffa('ACI', cliente, r.classe, regione, r.cer);
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
        unita_misura: tariffa?.unita_misura || '€/kg',
        unita_prezzo: tariffa?.unita_misura || '€/kg',
        fattore_conversione: fattoreConv(tariffa),
        totale: Math.round(totale * 100) / 100,
        origine_dato: 'ACI', origine_record_id: r.id,
        sospesa: !tariffa, motivo_sospensione: !tariffa ? 'Tariffa non trovata' : '',
        stato_validazione: !tariffa ? 'errore' : 'verificato',
        anno: annoNum, mese,
      });
    }

    // --- ELABORAZIONE EXTRA RACCOLTA ---
    const righeExtra = [];
    for (const r of terziarie) {
      const quantitaKg = r.peso_effettivo || 0;
      if (quantitaKg === 0) continue;
      const cliente = 'ECOTYRE';
      const tariffa = findTariffa('EXTRA_RACCOLTA', cliente, '', '', r.cer);
      const totale = calcolaTotale(quantitaKg, tariffa);
      righeExtra.push({
        tipologia: 'EXTRA_RACCOLTA', tipo: 'ATTIVA',
        regione: r.regione || '', fatturante: cliente,
        ordine: r.id_ordine || '',
        data_fine_trasporto: r.trasporto_finito_il || r.ordine_chiuso_il || null,
        numero_fir: r.numero_fir || '',
        eer_codice: r.cer || '',
        quantita: quantitaKg, unita_quantita: 'kg',
        tariffa_id: tariffa?.id || '', tariffa_valore: tariffa?.valore || 0,
        unita_misura: tariffa?.unita_misura || '€/kg',
        unita_prezzo: tariffa?.unita_misura || '€/kg',
        fattore_conversione: fattoreConv(tariffa),
        totale: Math.round(totale * 100) / 100,
        origine_dato: 'TERZIARIE', origine_record_id: r.id,
        sospesa: !tariffa, motivo_sospensione: !tariffa ? 'Tariffa non trovata' : '',
        stato_validazione: !tariffa ? 'errore' : 'verificato',
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
      const totaleNonSospese = righe.filter(r => !r.sospesa).reduce((s, r) => s + r.totale, 0);
      const errori = righe.filter(r => r.stato_validazione === 'errore').length;
      const sospese = righe.filter(r => r.sospesa).length;

      const doc = await base44.asServiceRole.entities.DocumentoFatturazione.create({
        tipo: 'ATTIVA', tipologia: tipo, anno: annoNum, mese,
        data_inizio: dataInizio, data_fine: dataFine,
        stato: 'elaborata',
        totale: Math.round(totaleNonSospese * 100) / 100,
        numero_voci: righe.length,
        voci_errore: errori, voci_sospese: sospese,
        data_elaborazione: new Date().toISOString(),
        cliente: righe[0]?.fatturante || '',
      });

      const righeWithDoc = righe.map(r => ({ ...r, documento_id: doc.id }));
      for (let i = 0; i < righeWithDoc.length; i += 100) {
        await base44.asServiceRole.entities.VoceFatturazione.bulkCreate(righeWithDoc.slice(i, i + 100));
      }

      docs.push({ tipologia: tipo, documento_id: doc.id, totale: doc.totale, voci: righe.length, errori, sospese });
    }

    return Response.json({ documenti: docs });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}