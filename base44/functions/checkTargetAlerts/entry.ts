import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { PROV_TO_REGION, MESI } from "../../shared/raccoltoCalculator.ts";
import { aggregaTargetMensili, targetDelPortale } from "../../shared/targetRaccoglitori.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { eAmministratore } from "../../shared/permessi.ts";

// Controlla i target mensili di raccolta e genera alert per target non raggiunti o a rischio.
// Payload: { mese?, anno?, crea_alerts?: boolean }
// - Default: mese/anno corrente, crea_alerts=true
// - Per mese passato: alert critico se raccolto < target
// - Per mese corrente: alert warning se proiezione fine mese < 90% del target
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    // "oggi" e' il giorno italiano: fra le 22 e le 24 UTC dell'ultimo del mese il
    // server e' ancora nel mese prima.
    const oggi = oggiRoma();
    const meseCorrenteIdx = Number(oggi.slice(5, 7)) - 1;
    const meseCorrente = MESI[meseCorrenteIdx];
    const annoCorrente = Number(oggi.slice(0, 4));
    const mese = body.mese || meseCorrente;
    const anno = Number(body.anno || annoCorrente);
    // Gli alert li scrive solo l'amministratore: agli altri la funzione risponde con i soli numeri.
    const creaAlerts = body.crea_alerts !== false && eAmministratore(user);

    // Carica target mensili per il periodo
    // Un raccoglitore puo' avere piu' righe, una per impianto: si sommano.
    const targets = aggregaTargetMensili(await base44.asServiceRole.entities.TargetMensile.filter(
      { mese, anno }, '-created_date', 5000
    ));

    if (!targets || targets.length === 0) {
      return Response.json({
        mese, anno,
        messaggio: 'Nessun target mensile configurato per questo periodo',
        at_risk: [], missed: [], ok_count: 0, alerts_creati: 0
      });
    }

    // Raccolto del solo canale RETE: i target dei raccoglitori non riguardano ACI
    // ed Extra Raccolta. Solo i terminati, nel mese della fine trasporto.
    const meseIdx = MESI.indexOf(mese);
    const nelPeriodo = (r) => {
      if (String(r.stato || '').toLowerCase().trim() !== 'terminato' || !r.trasporto_finito_il) return false;
      const d = new Date(r.trasporto_finito_il);
      return !isNaN(d.getTime()) && d.getUTCFullYear() === anno && d.getUTCMonth() === meseIdx;
    };
    const rete = (await fetchAll(base44.asServiceRole.entities.PrimariaRete, { stato: 'terminato' })).filter(nelPeriodo);

    const raccoltoByKey = {};
    const addRaccolto = (r) => {
      const racc = (r.trasportatore || 'N/D').trim();
      const regione = r.regione || PROV_TO_REGION[(r.provincia || '').toUpperCase().trim()] || 'Altro';
      const peso = Number(r.peso_effettivo || 0) / 1000; // kg -> ton
      const key = `${racc}|||${regione}`;
      if (!raccoltoByKey[key]) raccoltoByKey[key] = { raccoglitore: racc, regione, raccolto: 0 };
      raccoltoByKey[key].raccolto += peso;
    };
    rete.forEach(addRaccolto);

    // Determina se stiamo valutando il mese corrente o un mese passato
    const isMeseCorrente = (mese === meseCorrente && anno === annoCorrente);
    const giornoDelMese = Number(oggi.slice(8, 10));
    const giorniInMese = new Date(Date.UTC(anno, meseCorrenteIdx + 1, 0)).getUTCDate();
    const fattoreTemporale = isMeseCorrente && giornoDelMese > 0 ? (giornoDelMese / giorniInMese) : 1;

    const missed = [];
    const atRisk = [];
    let okCount = 0;

    for (const t of targets) {
      const racc = (t.raccoglitore || 'N/D').trim();
      const regione = (t.regione || '').trim();
      const targetVal = Number(t.target || 0);
      if (targetVal <= 0) continue;

      // Il nome del target e quello del portale possono essere scritti diversamente:
      // ogni riga di raccolto va a un solo target, prima per nome uguale.
      const nomiRegione = targets.filter(x => (x.regione || '').trim() === regione).map(x => (x.raccoglitore || 'N/D').trim());
      const raccolto = Object.values(raccoltoByKey)
        .filter(x => x.regione === regione && targetDelPortale(nomiRegione, x.raccoglitore) === racc)
        .reduce((s, x) => s + x.raccolto, 0);
      const pctRaggiungimento = (raccolto / targetVal) * 100;
      const delta = raccolto - targetVal;

      // Proiezione fine mese (solo per mese corrente)
      const proiezione = isMeseCorrente && fattoreTemporale > 0
        ? raccolto / fattoreTemporale
        : raccolto;
      const pctProiezione = (proiezione / targetVal) * 100;

      const item = {
        raccoglitore: racc,
        regione,
        mese,
        anno,
        target: Math.round(targetVal * 1000) / 1000,
        raccolto: Math.round(raccolto * 1000) / 1000,
        delta: Math.round(delta * 1000) / 1000,
        pct_raggiungimento: +pctRaggiungimento.toFixed(1),
        proiezione: Math.round(proiezione * 1000) / 1000,
        pct_proiezione: +pctProiezione.toFixed(1),
        is_mese_corrente: isMeseCorrente,
        giorno_del_mese: isMeseCorrente ? giornoDelMese : null,
        giorni_in_mese: isMeseCorrente ? giorniInMese : null,
      };

      if (!isMeseCorrente) {
        // Mese passato: target definitivamente non raggiunto
        if (raccolto < targetVal) {
          missed.push(item);
        } else {
          okCount++;
        }
      } else {
        // Mese corrente: valuta proiezione fine mese
        if (pctProiezione < 90) {
          atRisk.push(item);
        } else {
          okCount++;
        }
      }
    }

    // Crea alert per target non raggiunti (mese passato) o a rischio (mese corrente)
    let alertsCreati = 0;
    const alertsToCreate = [...missed, ...atRisk.filter(a => a.pct_proiezione < 70)];

    if (creaAlerts && alertsToCreate.length > 0) {
      // Tutti gli alert aperti, non solo la prima pagina: altrimenti si ricreano.
      const existingAlerts = await fetchAll(base44.asServiceRole.entities.Alert, {
        modulo: 'primarie_rete', stato: 'aperto'
      });
      const existingKeys = new Set(existingAlerts.map(a => a.record_id));

      const newAlerts = [];
      for (const item of alertsToCreate) {
        const recordId = `${item.raccoglitore}|${item.regione}|${item.mese}|${item.anno}`;
        if (existingKeys.has(recordId)) continue;

        const isMissed = !item.is_mese_corrente;
        const titolo = isMissed
          ? `Target non raggiunto: ${item.raccoglitore} — ${item.regione} (${item.mese} ${item.anno})`
          : `Target a rischio: ${item.raccoglitore} — ${item.regione} (${item.mese} ${item.anno})`;
        const descrizione = isMissed
          ? `Il raccoglitore "${item.raccoglitore}" in ${item.regione} non ha raggiunto il target mensile di ${item.target} ton per ${item.mese} ${item.anno}. Raccolto effettivo: ${item.raccolto} ton (Δ ${item.delta} ton, ${item.pct_raggiungimento}% del target).`
          : `Il raccoglitore "${item.raccoglitore}" in ${item.regione} è a rischio di non raggiungere il target di ${item.target} ton per ${item.mese} ${item.anno}. Raccolto attuale: ${item.raccolto} ton al giorno ${item.giorno_del_mese}/${item.giorni_in_mese}, proiezione fine mese: ${item.proiezione} ton (${item.pct_proiezione}% del target).`;

        newAlerts.push({
          titolo,
          descrizione,
          severita: (isMissed ? item.pct_raggiungimento : item.pct_proiezione) < 50 ? 'critico' : 'warning',
          modulo: 'primarie_rete',
          entity_type: 'TargetMensile',
          record_id: recordId,
          stato: 'aperto',
        });
      }

      const CHUNK = 100;
      for (let i = 0; i < newAlerts.length; i += CHUNK) {
        const chunk = newAlerts.slice(i, i + CHUNK);
        try {
          await base44.asServiceRole.entities.Alert.bulkCreate(chunk);
          alertsCreati += chunk.length;
        } catch (e) { /* skip */ }
      }
    }

    return Response.json({
      mese,
      anno,
      is_mese_corrente: isMeseCorrente,
      totale_target: targets.length,
      missed: missed.sort((a, b) => a.pct_raggiungimento - b.pct_raggiungimento),
      at_risk: atRisk.sort((a, b) => a.pct_proiezione - b.pct_proiezione),
      ok_count: okCount,
      alerts_creati: alertsCreati,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}