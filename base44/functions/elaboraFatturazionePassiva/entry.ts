import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

// Elabora la fatturazione passiva per un dato anno/mese:
// 1. Recupera dati operativi (PrimariaRete, Secondaria, Terziaria) per il mese
// 2. Identifica fornitore (trasportatore / impianto) e servizio (trasporto / trattamento)
// 3. Lookup tariffa per fornitore + servizio + classe + EER
// 4. Calcola Totale = Quantità × Tariffa
// 5. Aggrega voci per fornitore + servizio + classe + EER
// 6. Crea DocumentoFatturazione + VoceFatturazione
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { anno, mese, tipo_fatturazione = 'completa' } = await req.json();
    if (!anno || !mese) return Response.json({ error: 'Anno e mese obbligatori' }, { status: 400 });

    const annoNum = Number(anno);

    // Check for existing closed period
    const existing = await base44.asServiceRole.entities.DocumentoFatturazione.filter({
      tipo: 'PASSIVA', anno: annoNum, mese
    });
    if (existing.length > 0 && existing[0].stato === 'chiusa') {
      return Response.json({ error: 'Periodo già chiuso. Impossibile rielaborare.' }, { status: 400 });
    }

    // Load operational data
    const [rete, secondarie, terziarie] = await Promise.all([
      base44.asServiceRole.entities.PrimariaRete.filter({ mese }),
      base44.asServiceRole.entities.Secondaria.filter({ mese }),
      base44.asServiceRole.entities.Terziaria.filter({ mese }),
    ]);

    // Load configuration
    const [fornitori, tariffe, servizi] = await Promise.all([
      base44.asServiceRole.entities.Fornitore.filter({ stato: 'attivo' }),
      base44.asServiceRole.entities.Tariffa.filter({ stato: 'attivo' }),
      base44.asServiceRole.entities.Servizio.filter({ stato: 'attivo' }),
    ]);

    // Build lookup maps
    const fornitoreByNome = new Map();
    for (const f of fornitori) {
      fornitoreByNome.set(f.ragione_sociale.trim().toUpperCase(), f);
    }

    const servizioByNome = new Map();
    for (const s of servizi) {
      servizioByNome.set(s.nome.trim().toUpperCase(), s);
    }

    // Sort tariffe by specificity (most specific first)
    const tariffeSorted = [...tariffe].map(t => ({
      ...t,
      specificity: (t.classe_materiale ? 1 : 0) + (t.eer_codice ? 1 : 0),
    })).sort((a, b) => b.specificity - a.specificity);

    function findTariffa(fornitoreId, servizioId, classe, eer) {
      for (const t of tariffeSorted) {
        if (t.fornitore_id !== fornitoreId) continue;
        if (t.servizio_id !== servizioId) continue;
        if (t.classe_materiale && t.classe_materiale !== classe) continue;
        if (t.eer_codice && t.eer_codice !== eer) continue;
        return t;
      }
      return null;
    }

    // Auto-create fornitore for unknown names
    async function getOrCreateFornitore(nome, tipo) {
      if (!nome) return null;
      const key = nome.trim().toUpperCase();
      if (fornitoreByNome.has(key)) return fornitoreByNome.get(key);
      try {
        const newF = await base44.asServiceRole.entities.Fornitore.create({
          ragione_sociale: nome.trim(), tipo, stato: 'attivo',
        });
        fornitoreByNome.set(key, newF);
        return newF;
      } catch (e) { return null; }
    }

    // Generate voci (aggregated by fornitore + servizio + classe + eer)
    const vociMap = new Map();

    function addVoce(fornitore, servizio, classe, eer, quantita, origine, recordId, descrizione) {
      if (!fornitore || !servizio) return;
      const qta = Number(quantita) || 0;
      if (qta === 0) return;

      const key = `${fornitore.id}|${servizio.id}|${classe || ''}|${eer || ''}`;
      if (!vociMap.has(key)) {
        const tariffa = findTariffa(fornitore.id, servizio.id, classe, eer);
        vociMap.set(key, {
          fornitore_id: fornitore.id,
          fornitore_nome: fornitore.ragione_sociale,
          servizio_id: servizio.id,
          servizio_nome: servizio.nome,
          eer_codice: eer || '',
          classe: classe || '',
          descrizione: descrizione || `${servizio.nome} ${classe || ''}`.trim(),
          quantita: 0,
          unita_misura: tariffa?.unita_misura || '€/t',
          tariffa_id: tariffa?.id || '',
          tariffa_valore: tariffa?.valore || 0,
          totale: 0,
          origine_dato: origine,
          record_ids: [],
          record_count: 0,
          anno: annoNum, mese,
          has_tariffa: !!tariffa,
        });
      }

      const v = vociMap.get(key);
      v.quantita += qta;
      v.record_count += 1;
      if (v.record_ids.length < 50) v.record_ids.push(recordId);
      v.totale = v.quantita * v.tariffa_valore;
    }

    const svcTrasporto = servizioByNome.get('TRASPORTO');
    const svcTrattamento = servizioByNome.get('TRATTAMENTO');

    // Servizi separati per quota impianto/stoccaggio (T-CYCLE doppio ruolo)
    // Cerca servizi con "IMPIANTO" o "STOCCAGGIO" nel nome per la fatturazione trattamento primarie
    const svcImpiantoQuota = Array.from(servizi.values()).find(s =>
      s.nome.toUpperCase().includes('IMPIANTO') && s.nome.toUpperCase().includes('CONFERIMENTO')
    );
    const svcStoccaggioQuota = Array.from(servizi.values()).find(s =>
      s.nome.toUpperCase().includes('STOCCAGGIO') && s.nome.toUpperCase().includes('CONFERIMENTO')
    );

    // Carica FornitoreSecondaria per identificare impianti/doppio_ruolo come destinazioni fatturabili
    const fornitoriSecondaria = await base44.asServiceRole.entities.FornitoreSecondaria.filter({ stato: 'attivo' });
    const destImpiantoNorms = new Set();
    for (const fs of fornitoriSecondaria) {
      const ruolo = fs.ruolo || '';
      if (ruolo === 'impianto' || ruolo === 'doppio_ruolo') {
        destImpiantoNorms.add(fs.nome.trim().toUpperCase());
      }
    }

    const includeTrasporti = tipo_fatturazione === 'completa' || tipo_fatturazione === 'trasporti';
    const includeTrattamenti = tipo_fatturazione === 'completa' || tipo_fatturazione === 'trattamenti';

    // Process TERMINATI RETE (trasporto)
    if (includeTrasporti) {
      for (const r of rete) {
        const f = await getOrCreateFornitore(r.trasportatore, 'trasportatore');
        addVoce(f, svcTrasporto, r.classe, r.cer, (r.peso_effettivo || 0) / 1000, 'TERMINATI_RETE', r.id,
          `Trasporto ${r.classe || ''} - ${r.comune || ''} (${r.provincia || ''})`.trim());
      }
      // Process SECONDARIE (trasporto)
      for (const r of secondarie) {
        const f = await getOrCreateFornitore(r.trasportatore, 'trasportatore');
        addVoce(f, svcTrasporto, r.classe, r.cer, (r.peso_effettivo || 0) / 1000, 'SECONDARIE', r.id,
          `Trasporto secondaria ${r.classe || ''} - ${r.stoccaggio || ''} → ${r.destinazione || ''}`.trim());
      }
    }

    // Process PRIMARIE destinate a impianti/doppio_ruolo (trattamento split imp/stoc)
    // Per T-CYCLE doppio ruolo: primarie con destinazione=T-CYCLE generano trattamento
    // con servizio "Conferimento impianto" (tipo_destinazione=imp) o "Conferimento stoccaggio" (stoc)
    if (includeTrattamenti) {
      for (const r of rete) {
        const destKey = (r.destinazione || '').trim().toUpperCase();
        if (!destKey || !destImpiantoNorms.has(destKey)) continue;
        const tipoDest = String(r.tipo_destinazione || '').toLowerCase().trim();
        const isStoc = tipoDest === 'stoc';
        const svcQuota = isStoc ? svcStoccaggioQuota : svcImpiantoQuota;
        if (!svcQuota) continue; // salta se servizio non configurato
        const f = await getOrCreateFornitore(r.destinazione, 'impianto');
        addVoce(f, svcQuota, r.classe, r.cer, (r.peso_effettivo || 0) / 1000, 'TERMINATI_RETE', r.id,
          `Conferimento ${isStoc ? 'stoccaggio' : 'impianto'} ${r.classe || ''} - ${r.destinazione || ''}`.trim());
      }
    }

    // Process TERZIARIE (trasporto PICKERS + trattamento PLANTS)
    for (const r of terziarie) {
      const qta = (r.peso_effettivo || 0) / 1000;
      if (includeTrasporti) {
        const f = await getOrCreateFornitore(r.trasportatore, 'trasportatore');
        addVoce(f, svcTrasporto, '', r.cer, qta, 'PICKERS', r.id,
          `Trasporto terziaria - ${r.unita_locale_origine || ''} → ${r.destinazione || ''}`.trim());
      }
      if (includeTrattamenti) {
        const f = await getOrCreateFornitore(r.ragione_sociale, 'impianto');
        addVoce(f, svcTrattamento, '', r.cer, qta, 'PLANTS', r.id,
          `Trattamento - ${r.ragione_sociale || ''}`.trim());
      }
    }

    // Convert to array and set validation status
    const voci = Array.from(vociMap.values()).map(v => ({
      ...v,
      record_ids: v.record_ids,
      stato_validazione: !v.has_tariffa ? 'errore' : (v.tariffa_valore === 0 ? 'da_controllare' : 'verificato'),
      totale: Math.round(v.totale * 100) / 100,
    }));

    // Delete existing document and voci if reprocessing
    if (existing.length > 0) {
      const oldDocId = existing[0].id;
      await base44.asServiceRole.entities.VoceFatturazione.deleteMany({ documento_id: oldDocId });
      await base44.asServiceRole.entities.DocumentoFatturazione.delete(oldDocId);
    }

    // Compute period dates
    const meseIdx = MESI.indexOf(mese);
    const dataInizio = new Date(annoNum, meseIdx, 1).toISOString().split('T')[0];
    const dataFine = new Date(annoNum, meseIdx + 1, 0).toISOString().split('T')[0];

    // Create document
    const totale = voci.reduce((s, v) => s + v.totale, 0);
    const fornitoriSet = new Set(voci.map(v => v.fornitore_id));

    const doc = await base44.asServiceRole.entities.DocumentoFatturazione.create({
      tipo: 'PASSIVA', anno: annoNum, mese,
      data_inizio: dataInizio, data_fine: dataFine,
      stato: 'elaborata',
      totale: Math.round(totale * 100) / 100,
      numero_fornitori: fornitoriSet.size,
      numero_voci: voci.length,
      voci_errore: voci.filter(v => v.stato_validazione === 'errore').length,
      data_elaborazione: new Date().toISOString(),
    });

    // Bulk create voci
    const vociWithDoc = voci.map(v => ({ ...v, documento_id: doc.id, tipo: 'PASSIVA' }));
    for (let i = 0; i < vociWithDoc.length; i += 100) {
      await base44.asServiceRole.entities.VoceFatturazione.bulkCreate(vociWithDoc.slice(i, i + 100));
    }

    return Response.json({
      documento_id: doc.id,
      totale: doc.totale,
      fornitori: fornitoriSet.size,
      voci: voci.length,
      voci_errore: voci.filter(v => v.stato_validazione === 'errore').length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}