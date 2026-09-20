import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { computeProvinceMatrixData, computeRaccoglitoriMixData, computeSlaMetrics } from "../../shared/primarieReteAnalytics.ts";
import { conferimentiSospetti } from "../../shared/rotteConferimenti.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";

// Il controllo delle rotte non nasce da una RegolaAlert configurata: e' un
// controllo di coerenza della commessa. Ha pero' bisogno di un identificativo
// suo, e deve essere lo stesso nella chiave, nell'alert salvato e nella
// chiusura, altrimenti l'alert si ricrea a ogni giro e non si chiude mai.
const REGOLA_ROTTA = 'rotta_conferimento';
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { canaleDi } from "../../shared/canaleSecondaria.ts";
import { aggregaTargetMensili, targetDelPortale } from "../../shared/targetRaccoglitori.ts";
import { formatoTonnellate } from "../../shared/formato.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";

// Motore di controllo: scansiona i record di un modulo e genera Alert per le regole violate.
// Payload: { modulo }
//
// - Si controllano solo i dati dell'anno in corso e, per le primarie, i soli
//   formulari terminati: un ordine cancellato non ha pesi ne' destinazione.
// - Un alert gia' aperto per lo stesso record e la stessa regola non si ricrea.
// - Gli alert aperti delle regole del modulo la cui condizione non c'e' piu' (o
//   doppioni dello stesso alert) vengono chiusi come risolti, con una nota: non si
//   cancella nulla. Le chiusure si fermano a un tempo massimo e riprendono al giro
//   successivo.

const TEMPO_MASSIMO_MS = 40000;
const MESI_ANNO = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

// Giorno della data del portale: quelle salvate a mezzanotte italiana (22 o 23 UTC)
// si riportano al giorno giusto.
function giorno(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const italiana = (d.getUTCHours() === 22 || d.getUTCHours() === 23) && !d.getUTCMinutes() && !d.getUTCSeconds();
  return italiana ? new Date(d.getTime() + 3 * 3600000) : d;
}

function daControllare(record, modulo, anno) {
  if (modulo === 'assegnati') return true;
  if (modulo === 'primarie_rete' || modulo === 'primarie_aci') {
    if (String(record.stato || '').toLowerCase().trim() !== 'terminato') return false;
    const d = giorno(record.trasporto_finito_il);
    return !!d && d.getUTCFullYear() === anno;
  }
  // Anche per le secondarie e le terziarie contano solo i movimenti terminati,
  // e il periodo lo da' la fine del trasporto: un ordine annullato ha ancora
  // destinazione e peso in archivio, e finiva nel denominatore delle rotte.
  if (String(record.stato || '').toLowerCase().trim() !== 'terminato') return false;
  const d = giorno(record.trasporto_finito_il);
  return !!d && d.getUTCFullYear() === anno;
}

export default async function(req) {
  const inizio = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();

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

    // Record da validare: anno in corso, per le primarie solo i terminati.
    const anno = new Date().getUTCFullYear();
    const tutti = await fetchAll(base44.asServiceRole.entities[entityName]);
    const records = tutti.filter(r => daControllare(r, modulo, anno));

    // Tutti gli alert aperti del modulo, pagina per pagina: senza, il controllo dei
    // doppioni vedeva solo i primi e a ogni caricamento li ricreava.
    const existingAlerts = await fetchAll(base44.asServiceRole.entities.Alert, { modulo, stato: 'aperto' }, 'created_date');
    const existingKeys = new Set(existingAlerts.map(a => `${a.record_id}|||${a.regola_id}`));
    // Condizioni presenti oggi nei dati: gli alert aperti fuori da questo insieme si chiudono.
    const attuali = new Set();

    const newAlerts = [];

    for (const record of records) {
      for (const regola of regole) {
        const violazione = checkRegola(record, regola, entityName);
        if (violazione) {
          const key = `${record.id_ordine}|||${regola.id}`;
          attuali.add(key);
          if (existingKeys.has(key)) continue; // skip duplicati
          existingKeys.add(key);
          // Le regole si valutano su un formulario alla volta, quindi i canali non
          // si sommano mai; ma su una secondaria va detto di quale canale e',
          // perche' rete e autodemolizione si guardano separatamente.
          const canale = entityName === 'Secondaria' ? canaleDi(record) : null;
          newAlerts.push({
            titolo: canale === 'ACI' ? `${violazione.titolo} · ACI` : violazione.titolo,
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

    // --- Controlli aggregati ---
    // Le rotte si controllano su tutti i moduli: vale per le primarie come per
    // le secondarie, dove l'origine e' lo stoccaggio che produce il viaggio.
    // Gli altri controlli aggregati riguardano solo le primarie di rete.
    if (modulo === 'primarie_rete') {
      // Target dell'anno in corso, sommati per raccoglitore, regione e mese.
      const targets = aggregaTargetMensili(await base44.asServiceRole.entities.TargetMensile.filter({ anno: Number(oggiRoma().slice(0, 4)) }, '-created_date', 5000));
      newAlerts.push(...checkAggregateRules(records, regole, existingKeys, targets, attuali));
    } else if (modulo === 'secondarie') {
      // Le secondarie di rete e quelle ACI stanno nello stesso archivio: contarle
      // insieme farebbe un denominatore che non esiste in nessun altro modulo, e
      // una rotta ACI vera finirebbe segnalata come errore perche' annegata fra
      // i viaggi di rete.
      newAlerts.push(...soloRotte(records.filter(r => !eAci(r)), existingKeys, attuali, entityName, modulo, 'rete'));
      newAlerts.push(...soloRotte(records.filter(eAci), existingKeys, attuali, entityName, modulo, 'ACI'));
    } else {
      newAlerts.push(...soloRotte(records, existingKeys, attuali, entityName, modulo));
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

    // Chiusura degli alert superati e dei doppioni, solo per le regole di questo
    // motore: gli alert creati da altri controlli restano come sono.
    // La regola delle rotte non sta fra le RegolaAlert configurate, ma i suoi
    // alert devono chiudersi come gli altri quando il formulario viene corretto.
    const idRegole = new Set([...regole.map(r => r.id), REGOLA_ROTTA, REGOLA_ROTTA + '_rete', REGOLA_ROTTA + '_ACI']);
    const visti = new Set();
    const daChiudere = [];
    for (const a of existingAlerts) {
      if (!idRegole.has(a.regola_id)) continue;
      const key = `${a.record_id}|||${a.regola_id}`;
      if (!attuali.has(key)) {
        daChiudere.push({ id: a.id, stato: 'risolto', risolto_note: `Chiuso automaticamente il ${new Date().toISOString().slice(0, 10)}: condizione non presente nei dati ${anno}` });
      } else if (visti.has(key)) {
        daChiudere.push({ id: a.id, stato: 'risolto', risolto_note: `Chiuso automaticamente il ${new Date().toISOString().slice(0, 10)}: doppione di un alert ancora aperto` });
      } else {
        visti.add(key);
      }
    }
    let chiusi = 0;
    for (let i = 0; i < daChiudere.length && Date.now() - inizio < TEMPO_MASSIMO_MS; i += CHUNK) {
      const blocco = daChiudere.slice(i, i + CHUNK);
      try {
        await base44.asServiceRole.entities.Alert.bulkUpdate(blocco);
        chiusi += blocco.length;
      } catch (e) { /* ripreso al giro successivo */ }
    }

    return Response.json({
      modulo,
      anno,
      record_scansionati: records.length,
      regole_valutate: regole.length,
      alerts_creati: creati,
      alerts_chiusi: chiusi,
      alerts_da_chiudere: daChiudere.length - chiusi,
      alerts_totali_aperti: existingAlerts.length + creati - chiusi,
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

    const matchOrigine = normalizzaRagioneSociale(valOrigine) === normalizzaRagioneSociale(expectedOrigine);

    if (!matchOrigine) return null; // regola non applicabile a questo record

    const ammesse = (config.destinazioni_ammesse || []).map(d => normalizzaRagioneSociale(d));
    const destOk = ammesse.some(d => normalizzaRagioneSociale(valDest) === d);

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

    const valOrigine = normalizzaRagioneSociale(record[config.campo_origine || 'stoccaggio']);
    const valDest = normalizzaRagioneSociale(record[config.campo_destinazione || 'destinazione']);
    const origOk = normalizzaRagioneSociale(config.origine_ammessa);
    const destOk = normalizzaRagioneSociale(config.destinazione_ammessa);

    if (valOrigine !== origOk || valDest !== destOk) {
      return {
        titolo: regola.messaggio_alert || `Tratta non conforme per classe ${expectedClasse}`,
        descrizione: `Record ${record.id_ordine || ''}: classe ${valClasse} con origine "${valOrigine}" e destinazione "${valDest}". Combinazione ammessa: origine="${config.origine_ammessa}", destinazione="${config.destinazione_ammessa}".`,
      };
    }
  }

  if (tipo === 'tratte_autorizzate_classe') {
    // config: { classe, campo_origine, campo_destinazione, combinazioni_ammesse: [{origine, destinazione}] }
    // Per i record della classe specificata, la coppia (origine, destinazione) deve essere una delle combinazioni ammesse.
    const valClasse = String(record[config.campo_classe || 'classe'] || '').trim().toUpperCase();
    // Supporta classe singola (config.classe) o multipla (config.classi array); se nessuna specificata, applica a tutti
    const classiAmmesse = Array.isArray(config.classi) && config.classi.length > 0
      ? config.classi.map(c => String(c).trim().toUpperCase())
      : (config.classe ? [String(config.classe).trim().toUpperCase()] : []);
    if (classiAmmesse.length > 0 && !classiAmmesse.includes(valClasse)) return null;
    const expectedClasse = classiAmmesse.length > 0 ? classiAmmesse.join('/') : 'qualsiasi';

    const rawOrigine = String(record[config.campo_origine || 'stoccaggio'] || '').trim();
    const rawDest = String(record[config.campo_destinazione || 'destinazione'] || '').trim();
    const valOrigine = normalizzaRagioneSociale(rawOrigine);
    const valDest = normalizzaRagioneSociale(rawDest);

    const ammesse = (config.combinazioni_ammesse || []).map(c => ({
      origine: normalizzaRagioneSociale(c.origine),
      destinazione: normalizzaRagioneSociale(c.destinazione),
    }));

    const matchOk = ammesse.some(c => valOrigine === c.origine && valDest === c.destinazione);

    if (!matchOk) {
      const combinazioniTxt = (config.combinazioni_ammesse || []).map(c => `${c.origine} → ${c.destinazione}`).join('; ');
      const labelOrigine = config.campo_origine || 'stoccaggio';
      return {
        titolo: regola.messaggio_alert || `Tratta non autorizzata per classe ${expectedClasse}`,
        descrizione: `Record ${record.id_ordine || ''}: classe ${valClasse} con ${labelOrigine} "${rawOrigine}" e destinazione "${rawDest}". Combinazioni ammesse: ${combinazioniTxt}.`,
      };
    }
  }

  if (tipo === 'anomalia_peso') {
    // config: { soglia_zero: true }
    // Conta solo il peso effettivo: il peso stimato del portale non e' un riferimento
    // attendibile e non si usa in nessuna valutazione (soglia_deviazione ignorata).
    const pesoEff = record.peso_effettivo;
    const quantitaRit = record.quantita_ritirata;

    if (config.soglia_zero !== false && quantitaRit > 0 && (!pesoEff || pesoEff === 0)) {
      return {
        titolo: regola.messaggio_alert || `Peso effettivo mancante per ${record.id_ordine}`,
        descrizione: `Record ${record.id_ordine}: quantità ritirata ${quantitaRit} ma peso effettivo = 0 o mancante.`,
      };
    }
  }

  return null;
}

// I soli controlli di rotta, per i moduli che non hanno gli altri aggregati.
function soloRotte(records, existingKeys, attuali, archivio, modulo, canale = '') {
  return checkAggregateRules(records, [], existingKeys, [], attuali, archivio, modulo, canale);
}

// --- Controlli aggregati per primarie_rete ---
function checkAggregateRules(records, regole, existingKeys, targets = [], attuali = new Set(), archivio = 'PrimariaRete', modulo = 'primarie_rete', canale = '') {
  const alerts = [];

  // Formulari chiusi su una destinazione dove quell'origine non va mai.
  //
  // Non serve una regola scritta in configurazione: e' un controllo di coerenza
  // della commessa, non una soglia da tarare. Un raccoglitore conferisce dove ha
  // il proprio impianto o dove ha l'accordo di stoccare, e quando un formulario
  // si chiude sulla destinazione sbagliata il movimento finisce su un impianto
  // che non l'ha mai visto: da li' sbagliano giacenze, dichiarazioni e
  // fatturazione.
  for (const sospetto of conferimentiSospetti(records, archivio)) {
    const record_id = sospetto.numero_fir || sospetto.id_ordine || '';
    const key = `${record_id}|||${REGOLA_ROTTA}${canale ? '_' + canale : ''}`;
    attuali.add(key);
    if (existingKeys.has(key)) continue;
    alerts.push({
      titolo: `Conferimento fuori rotta${canale ? ' (' + canale + ')' : ''}: ${sospetto.origine} a ${sospetto.destinazione}`,
      descrizione: `${sospetto.testo} Formulario ${sospetto.numero_fir || '(senza numero)'}`
        + (sospetto.id_ordine ? `, ordine ${sospetto.id_ordine}` : '')
        + `, del ${sospetto.giorno}, ${sospetto.kg} kg.`,
      severita: 'warning',
      modulo,
      entity_type: archivio,
      record_id,
      regola_id: REGOLA_ROTTA + (canale ? '_' + canale : ''),
      regola_nome: 'Conferimento fuori rotta',
      stato: 'aperto',
    });
    existingKeys.add(key);
  }

  // Regole province inattive (2 mesi consecutivi a zero)
  const regoleProvince = regole.filter(r => r.tipo_regola === 'province_inattive');
  if (regoleProvince.length > 0) {
    const matrix = computeProvinceMatrixData(records);
    for (const prov of matrix.province_with_zeros) {
      for (const regola of regoleProvince) {
        const key = `${prov.provincia}|||${regola.id}`;
        attuali.add(key);
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
        attuali.add(key);
        if (existingKeys.has(key)) continue;
        const devDetails = racc.deviazioni_significative.map(d =>
          `${d.classe}: ${d.attuale.toFixed(1)}% vs target ${d.target}% (Δ${d.deviazione > 0 ? '+' : ''}${d.deviazione.toFixed(1)}%)`
        ).join('; ');
        alerts.push({
          titolo: regola.messaggio_alert || `Mix classi non conforme: ${racc.raccoglitore}`,
          descrizione: `Raccoglitore "${racc.raccoglitore}": deviazione significativa dal mix classi consorziale. ${devDetails}. Totale raccolto: ${formatoTonnellate(racc.totale_peso)} t.`,
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
    // Solo RETE terminati dell'anno dei target, nel mese della fine trasporto.
    const annoTarget = Number(targets[0]?.anno) || Number(oggiRoma().slice(0, 4));
    const oggi = new Date();
    const raccoltoByKey = {};
    for (const r of records) {
      if (String(r.stato || '').toLowerCase().trim() !== 'terminato' || !r.trasporto_finito_il) continue;
      const fine = new Date(r.trasporto_finito_il);
      if (isNaN(fine.getTime()) || fine.getUTCFullYear() !== annoTarget) continue;
      const racc = (r.trasportatore || 'N/D').trim();
      const regione = r.regione || 'Altro';
      const mese = MESI_ANNO[fine.getUTCMonth()];
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
      // Solo mesi conclusi: il mese in corso lo segue il controllo dei target con la proiezione.
      const indiceMese = MESI_ANNO.indexOf(mese);
      if (indiceMese < 0 || (annoTarget === oggi.getUTCFullYear() && indiceMese >= oggi.getUTCMonth()) || annoTarget > oggi.getUTCFullYear()) continue;
      const nomiRegione = targets.filter(x => (x.regione || '').trim() === regione && (x.mese || '').trim() === mese).map(x => (x.raccoglitore || '').trim());
      const raccolto = Object.entries(raccoltoByKey)
        .filter(([k]) => { const [r, reg, m] = k.split('|||'); return reg === regione && m === mese && targetDelPortale(nomiRegione, r) === racc; })
        .reduce((s, [, v]) => s + v, 0);
      const delta = raccolto - targetVal;
      const pctDelta = (delta / targetVal) * 100;
      const soglia = regoleScostamento[0]?.config?.soglia_pct || -15;
      if (pctDelta < soglia) {
        for (const regola of regoleScostamento) {
          // Stessa chiave degli alert salvati (record_id|||regola): prima non coincideva
          // e l'alert si ricreava a ogni giro.
          const alertKey = `${racc}|${regione}|${mese}|||${regola.id}`;
          attuali.add(alertKey);
          if (existingKeys.has(alertKey)) continue;
          alerts.push({
            titolo: regola.messaggio_alert || `Scostamento target grave: ${racc} - ${regione} - ${mese}`,
            descrizione: `Raccoglitore "${racc}" (${regione}, ${mese}): target ${formatoTonnellate(targetVal)} t, raccolto ${formatoTonnellate(raccolto)} t, Δ ${formatoTonnellate(delta)} ton (${pctDelta.toFixed(1)}%). Soglia: ${soglia}%.`,
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
          attuali.add(key);
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