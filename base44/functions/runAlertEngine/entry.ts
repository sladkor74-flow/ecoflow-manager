import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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

  return null;
}