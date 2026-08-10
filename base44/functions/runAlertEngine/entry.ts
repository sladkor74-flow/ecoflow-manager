import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { computeProvinceMatrixData, computeRaccoglitoriMixData, computeSlaMetrics } from "../../shared/primarieReteAnalytics.ts";

// Motore di controllo: scansiona i record di un modulo e genera Alert per le regole violate.
// Payload: { modulo, record_ids?, solo_aperti?: boolean }
// Se record_ids non fornito, scansiona tutti i record del modulo.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { modulo } = body;

    const ENTITY_MAP = {
      secondarie: 'Secondaria',
      primarie_rete: 'PrimariaRete',
      primarie_aci: 'PrimariaAci',
      terziarie: 'Terziaria',
      assegnati: 'Assegnato',
    };

    if (!ENTITY_MAP[modulo]) {
      return Response.json({ error: 'modulo non valido' }, { status: 400 });
    }
    const entityName = ENTITY_MAP[modulo];

    // Carica regole attive per il modulo
    const regole = await base44.asServiceRole.entities.RegolaAlert.filter({ modulo, attiva: true });
    if (!regole || regole.length === 0) {
      return Response.json({ modulo, alerts_creati: 0, messaggio: 'Nessuna regola attiva per questo modulo' });
    }

    // Carica record da validare
    const records = await base44.asServiceRole.entities[entityName].list('-created_date', 10000);

    // Carica alert aperti esistenti per evitare duplicati
    const existingAlerts = await base44.asServiceRole.entities.Alert.filter({
      modulo, stato: 'aperto'
    });
    const existingKeys = new Set(existingAlerts.map(a => `${a.record_id}|||${a.regola_id}`));

    const newAlerts = [];

    for (const record of records) {
      for (const regola of regole) {
        const violazione = checkRegola(record, regola, entityName);
        if (violazione) {
          const key = `${record.id_ordine}|||${regola.id}`;
          if (existingKeys.has(key)) continue; // skip duplicati
          newAlerts.push({
            titolo: violazione.titolo,
            descrizione: violazione.descrizione,
            severita: regola.severita || 'warning',
            modulo,
            entity_type: entityName,
            record_id: record.id_ordine || '',
            regola_id: regola.id,
            regola_nome: regola.nome,
            stato: 'aperto',
          });
        }
      }
    }

    // --- Controlli aggregati per primarie_rete (province inattive + mix classi) ---
    if (modulo === 'primarie_rete') {
      const targets = await base44.asServiceRole.entities.TargetMensile.list('-created_date', 5000);
      const aggregateAlerts = checkAggregateRules(records, regole, existingKeys, targets);
      newAlerts.push(...aggregateAlerts);
    }

    // Bulk create alerts (chunk di 100)
    let creati = 0;
    const CHUNK = 100;
    for (let i = 0; i < newAlerts.length; i += CHUNK) {
      const chunk = newAlerts.slice(i, i + CHUNK);
      try {
        await base44.asServiceRole.entities.Alert.bulkCreate(chunk);
        creati += chunk.length;
      } catch (e) { /* skip */ }
    }

    return Response.json({
      modulo,
      record_scansionati: records.length,
      regole_valutate: regole.length,
      alerts_creati: creati,
      alerts_totali_aperti: existingAlerts.length + creati,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// --- Motore di validazione regole ---
function checkRegola(record, regola, entityName) {
  const config = regola.config || {};
  const tipo = regola.tipo_regola;

  if (tipo === 'tratta_autorizzata') {
    // config: { campo_origine, valore_origine, campo_destinazione, destinazioni_ammesse: [], case_sensitive? }
    const valOrigine = String(record[config.campo_origine || 'stoccaggio'] || '').trim();
    const valDest = String(record[config.campo_destinazione || 'destinazione'] || '').trim();
    const expectedOrigine = String(config.valore_origine || '').trim();

    const matchOrigine = config.case_sensitive
      ? valOrigine === expectedOrigine
      : valOrigine.toLowerCase() === expectedOrigine.toLowerCase();

    if (!matchOrigine) return null; // regola non applicabile a questo record

    const ammesse = (config.destinazioni_ammesse || []).map(d => String(d).trim().toLowerCase());
    const destOk = ammesse.some(d => valDest.toLowerCase() === d);

    if (!destOk) {
      return {
        titolo: regola.messaggio_alert || `Destinazione non autorizzata per ${expectedOrigine}`,
        descrizione: `Record ${record.id_ordine || ''}: origine "${valOrigine}" con destinazione non ammessa "${valDest}". Destinazioni ammesse: ${(config.destinazioni_ammesse || []).join(', ')}.`,
      };
    }
  }

  if (tipo === 'tratta_combinazione') {
    // config: { campo_classe, valore_classe, campo_origine, origine_ammessa, campo_destinazione, destinazione_ammessa }
    const valClasse = String(record[config.campo_classe || 'classe'] || '').trim().toUpperCase();
    const expectedClasse = String(config.valore_classe || '').trim().toUpperCase();
    if (valClasse !== expectedClasse) return null;

    const valOrigine = String(record[config.campo_origine || 'stoccaggio'] || '').trim().toLowerCase();
    const valDest = String(record[config.campo_destinazione || 'destinazione'] || '').trim().toLowerCase();
    const origOk = String(config.origine_ammessa || '').trim().toLowerCase();
    const destOk = String(config.destinazione_ammessa || '').trim().toLowerCase();

    if (valOrigine !== origOk || valDest !== destOk) {
      return {
        titolo: regola.messaggio_alert || `Tratta non conforme per classe ${expectedClasse}`,
        descrizione: `Record ${record.id_ordine || ''}: classe ${valClasse} con origine "${valOrigine}" e destinazione "${valDest}". Combinazione ammessa: origine="${config.origine_ammessa}", destinazione="${config.destinazione_ammessa}".`,
      };
    }
  }

  if (tipo === 'anomalia_peso') {
    // config: { soglia_zero: true, soglia_deviazione: 0.5 }
    const pesoEff = record.peso_effettivo;
    const pesoStim = record.peso_stimato;
    const quantitaRit = record.quantita_ritirata;
    const sogliaDev = (config.soglia_deviazione != null ? config.soglia_deviazione : 0.5);

    if (config.soglia_zero !== false && quantitaRit > 0 && (!pesoEff || pesoEff === 0)) {
      return {
        titolo: regola.messaggio_alert || `Peso effettivo mancante per ${record.id_ordine}`,
        descrizione: `Record ${record.id_ordine}: quantità ritirata ${quantitaRit} ma peso effettivo = 0 o mancante.`,
      };
    }
    if (pesoEff && pesoStim && pesoStim > 0) {
      const deviazione = Math.abs(pesoEff - pesoStim) / pesoStim;
      if (deviazione > sogliaDev) {
        return {
          titolo: regola.messaggio_alert || `Anomalia peso per ${record.id_ordine}`,
          descrizione: `Record ${record.id_ordine}: peso effettivo ${pesoEff} kg vs stimato ${pesoStim} kg (deviazione ${(deviazione * 100).toFixed(1)}%, soglia ${(sogliaDev * 100).toFixed(0)}%).`,
        };
      }
    }
  }

  return null;
}

// --- Controlli aggregati per primarie_rete ---
function checkAggregateRules(records, regole, existingKeys, targets = []) {
  const alerts = [];

  // Regole province inattive (2 mesi consecutivi a zero)
  const regoleProvince = regole.filter(r => r.tipo_regola === 'province_inattive');
  if (regoleProvince.length > 0) {
    const matrix = computeProvinceMatrixData(records);
    for (const prov of matrix.province_with_zeros) {
      for (const regola of regoleProvince) {
        const key = `${prov.provincia}|||${regola.id}`;
        if (existingKeys.has(key)) continue;
        const zeroPair = prov.last_zero_pair;
        alerts.push({
          titolo: regola.messaggio_alert || `Provincia inattiva: ${prov.provincia}`,
          descrizione: `Provincia ${prov.provincia} (${prov.regione}): 2 mesi consecutivi con 0 raccolte (${zeroPair?.start} - ${zeroPair?.end}). Pianificare raccolte nel terzo mese per rispettare i requisiti consorziali.`,
          severita: regola.severita || 'warning',
          modulo: 'primarie_rete',
          entity_type: 'PrimariaRete',
          record_id: prov.provincia,
          regola_id: regola.id,
          regola_nome: regola.nome,
          stato: 'aperto',
        });
        existingKeys.add(key);
      }
    }
  }

  // Regole mix classi deviazione
  const regoleMix = regole.filter(r => r.tipo_regola === 'mix_classi_deviazione');
  if (regoleMix.length > 0) {
    const mix = computeRaccoglitoriMixData(records);
    for (const racc of mix.raccoglitori_con_deviazione) {
      for (const regola of regoleMix) {
        const key = `${racc.raccoglitore}|||${regola.id}`;
        if (existingKeys.has(key)) continue;
        const devDetails = racc.deviazioni_significative.map(d =>
          `${d.classe}: ${d.attuale.toFixed(1)}% vs target ${d.target}% (Δ${d.deviazione > 0 ? '+' : ''}${d.deviazione.toFixed(1)}%)`
        ).join('; ');
        alerts.push({
          titolo: regola.messaggio_alert || `Mix classi non conforme: ${racc.raccoglitore}`,
          descrizione: `Raccoglitore "${racc.raccoglitore}": deviazione significativa dal mix classi consorziale. ${devDetails}. Totale raccolto: ${racc.totale_peso.toFixed(1)} ton.`,
          severita: regola.severita || 'warning',
          modulo: 'primarie_rete',
          entity_type: 'PrimariaRete',
          record_id: racc.raccoglitore,
          regola_id: regola.id,
          regola_nome: regola.nome,
          stato: 'aperto',
        });
        existingKeys.add(key);
      }
    }
  }

  // Regole scostamento target grave (Delta < soglia_pct, default -15%)
  const regoleScostamento = regole.filter(r => r.tipo_regola === 'scostamento_target');
  if (regoleScostamento.length > 0 && targets && targets.length > 0) {
    const raccoltoByKey = {};
    for (const r of records) {
      const racc = (r.trasportatore || 'N/D').trim();
      const regione = r.regione || 'Altro';
      const mese = r.mese || 'N/D';
      const peso = (r.peso_effettivo || 0) / 1000;
      const key = `${racc}|||${regione}|||${mese}`;
      raccoltoByKey[key] = (raccoltoByKey[key] || 0) + peso;
    }
    for (const target of targets) {
      const racc = (target.raccoglitore || '').trim();
      const regione = (target.regione || '').trim();
      const mese = (target.mese || '').trim();
      const targetVal = target.target || 0;
      if (targetVal <= 0) continue;
      const key = `${racc}|||${regione}|||${mese}`;
      const raccolto = raccoltoByKey[key] || 0;
      const delta = raccolto - targetVal;
      const pctDelta = (delta / targetVal) * 100;
      const soglia = regoleScostamento[0]?.config?.soglia_pct || -15;
      if (pctDelta < soglia) {
        for (const regola of regoleScostamento) {
          const alertKey = `${racc}|||${regione}|||${mese}|||${regola.id}`;
          if (existingKeys.has(alertKey)) continue;
          alerts.push({
            titolo: regola.messaggio_alert || `Scostamento target grave: ${racc} - ${regione} - ${mese}`,
            descrizione: `Raccoglitore "${racc}" (${regione}, ${mese}): target ${targetVal} ton, raccolto ${raccolto.toFixed(1)} ton, Δ ${delta.toFixed(1)} ton (${pctDelta.toFixed(1)}%). Soglia: ${soglia}%.`,
            severita: regola.severita || 'critico',
            modulo: 'primarie_rete',
            entity_type: 'PrimariaRete',
            record_id: `${racc}|${regione}|${mese}`,
            regola_id: regola.id,
            regola_nome: regola.nome,
            stato: 'aperto',
          });
          existingKeys.add(alertKey);
        }
      }
    }
  }

  // Regole ritardo SLA critico (Nr Giorni medio > 12 o % fuori tempo > 20%)
  const regoleSla = regole.filter(r => r.tipo_regola === 'ritardo_sla');
  if (regoleSla.length > 0) {
    const sla = computeSlaMetrics(records);
    for (const t of sla.trasportatori) {
      if (t.has_sla_critical) {
        for (const regola of regoleSla) {
          const key = `${t.trasportatore}|||${regola.id}`;
          if (existingKeys.has(key)) continue;
          alerts.push({
            titolo: regola.messaggio_alert || `Ritardo SLA critico: ${t.trasportatore}`,
            descrizione: `Trasportatore "${t.trasportatore}": Nr Giorni medio ${t.nr_giorni_medio.toFixed(1)} gg, % fuori tempo ${t.pct_dopo_scadenza.toFixed(1)}%. Soglie: > 12 gg medio o > 20% fuori tempo.`,
            severita: regola.severita || 'warning',
            modulo: 'primarie_rete',
            entity_type: 'PrimariaRete',
            record_id: t.trasportatore,
            regola_id: regola.id,
            regola_nome: regola.nome,
            stato: 'aperto',
          });
          existingKeys.add(key);
        }
      }
    }
  }

  return alerts;
}