import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { filtraPeriodo } from "../../shared/filtroPeriodo.ts";
import { sortTariffe, resolveTariffa, calcolaTotale, fattoreConv } from "../../shared/ecotyreTariffe.ts";

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

// Elabora la fatturazione attiva per un dato anno/mese:
// Genera 3 documenti (RETE, ACI, EXTRA_RACCOLTA) con righe automatiche
// dai dati operativi del gestionale. Cliente/committente: sempre ECOTYRE.
// Periodo determinato da filtraPeriodo (stato terminato + trasporto_finito_il in anno/mese).
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

    // Load operational data WITHOUT month filter, then apply filtraPeriodo
    const [reteAll, aciAll, extraAll] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.PrimariaRete),
      fetchAll(base44.asServiceRole.entities.PrimariaAci),
      fetchAll(base44.asServiceRole.entities.ExtraRaccolta),
    ]);
    const rete = filtraPeriodo(reteAll, annoNum, mese);
    const aci = filtraPeriodo(aciAll, annoNum, mese);
    const extraRaccolta = filtraPeriodo(extraAll, annoNum, mese);

    // Load attiva tariffe
    const tariffe = await base44.asServiceRole.entities.Tariffa.filter({ direzione: 'ATTIVA', stato: 'attivo' });
    const tariffeSorted = sortTariffe(tariffe);

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
      const dataRiferimento = r.trasporto_finito_il;
      const tariffa = resolveTariffa(tariffeSorted, 'RETE', r.classe, '', r.cer, dataRiferimento);
      if (!tariffa) addAnomalia('RETE', r.regione, r.classe, r.cer, quantitaKg);
      const totale = calcolaTotale(quantitaKg, tariffa);
      righeRete.push({
        tipologia: 'RETE', tipo: 'ATTIVA',
        regione: r.regione || '', fatturante: 'ECOTYRE',
        ordine: r.id_ordine || '',
        data_fine_trasporto: r.trasporto_finito_il || null,
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
      const dataRiferimento = r.trasporto_finito_il;
      const tariffa = resolveTariffa(tariffeSorted, 'ACI', r.classe, regione, r.cer, dataRiferimento);
      if (!tariffa) addAnomalia('ACI', regione, r.classe, r.cer, quantitaKg);
      const totale = calcolaTotale(quantitaKg, tariffa);
      righeAci.push({
        tipologia: 'ACI', tipo: 'ATTIVA',
        regione, fatturante: 'ECOTYRE',
        ticket_n: r.numero_ordine_interno || '',
        ordine: r.id_ordine || '',
        data_fine_trasporto: r.trasporto_finito_il || null,
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

    // --- ELABORAZIONE EXTRA RACCOLTA --- (dati manuali da ExtraRaccolta)
    const righeExtra = [];
    for (const r of extraRaccolta) {
      const quantitaKg = r.peso_effettivo || 0;
      if (quantitaKg === 0) continue;
      const dataRiferimento = r.trasporto_finito_il;
      const tariffa = resolveTariffa(tariffeSorted, 'EXTRA_RACCOLTA', r.classe, r.regione || '', r.cer, dataRiferimento);
      if (!tariffa) addAnomalia('EXTRA_RACCOLTA', r.regione, r.classe, r.cer, quantitaKg);
      const totale = calcolaTotale(quantitaKg, tariffa);
      righeExtra.push({
        tipologia: 'EXTRA_RACCOLTA', tipo: 'ATTIVA',
        regione: r.regione || '', fatturante: 'ECOTYRE',
        ordine: r.id_ordine || '',
        data_fine_trasporto: r.trasporto_finito_il || null,
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

    const anomalie = Array.from(anomalieMap.values()).map(a => ({
      ...a,
      tonnellate: Math.round(a.tonnellate * 100) / 100,
    }));
    return Response.json({ documenti: docs, anomalie });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}