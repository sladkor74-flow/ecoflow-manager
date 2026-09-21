import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { divergenzeTargetImpianti, testoDivergenza } from "../../shared/targetImpianti.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { PROV_TO_REGION, MESI } from "../../shared/raccoltoCalculator.ts";
import { aggregaTargetMensili, targetDelPortale } from "../../shared/targetRaccoglitori.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { eAmministratore } from "../../shared/permessi.ts";
import { filtraMovimenti, giornoMovimento } from "../../shared/movimenti.ts";

// Sotto questo numero di giorni coperti dai dati la proiezione di fine mese non
// si fa: con tre giorni di raccolto, o con l'ultimo caricamento fermo al 2 del
// mese, moltiplicare per dieci da' numeri che non vogliono dire niente.
const GIORNI_MINIMI_PROIEZIONE = 10;

// Un caricamento delle primarie svuota e riscrive l'archivio a blocchi, e la sua
// riga nel registro resta "in_corso" per tutto il tempo (vedi importaBlocco). Una
// riga piu' vecchia di cosi' e' un caricamento interrotto, non uno in corso.
const FINESTRA_IN_CORSO_MS = 10 * 60 * 1000;

async function caricamentoPrimarieInCorso(base44) {
  const aperti = await base44.asServiceRole.entities.UploadLog.filter({ tipo_file: 'primarie', esito: 'in_corso' }, '-created_date', 5);
  // created_date arriva in UTC senza la Z finale
  return aperti.some(l => Date.now() - new Date(String(l.created_date).replace(/(Z|[+-]\d{2}:?\d{2})?$/, 'Z')).getTime() < FINESTRA_IN_CORSO_MS);
}

// La chiave di un alert di target e' raccoglitore|regione|mese|anno: mese e anno
// si leggono dalla coda, perche' il nome del raccoglitore puo' contenere di tutto.
const chiaveAlert = (item) => `${item.raccoglitore}|${item.regione}|${item.mese}|${item.anno}`;
function periodoAlert(a) {
  const parti = String((a && a.record_id) || '').split('|');
  if (parti.length < 4) return null;
  const mese = parti[parti.length - 2];
  const anno = Number(parti[parti.length - 1]);
  return MESI.includes(mese) && anno ? { mese, anno } : null;
}

function testoAlert(item) {
  const isMissed = !item.is_mese_corrente;
  return {
    titolo: isMissed
      ? `Target non raggiunto: ${item.raccoglitore} — ${item.regione} (${item.mese} ${item.anno})`
      : `Target a rischio: ${item.raccoglitore} — ${item.regione} (${item.mese} ${item.anno})`,
    descrizione: isMissed
      ? `Il raccoglitore "${item.raccoglitore}" in ${item.regione} non ha raggiunto il target mensile di ${item.target} ton per ${item.mese} ${item.anno}. Raccolto effettivo: ${item.raccolto} ton (Δ ${item.delta} ton, ${item.pct_raggiungimento}% del target).`
      : `Il raccoglitore "${item.raccoglitore}" in ${item.regione} è a rischio di non raggiungere il target di ${item.target} ton per ${item.mese} ${item.anno}. Raccolto attuale: ${item.raccolto} ton al giorno ${item.giorno_del_mese}/${item.giorni_in_mese}, proiezione fine mese: ${item.proiezione} ton (${item.pct_proiezione}% del target).`,
    severita: (isMissed ? item.pct_raggiungimento : item.pct_proiezione) < 50 ? 'critico' : 'warning',
  };
}

// Controlla i target mensili di raccolta e genera alert per target non raggiunti o a rischio.
// Payload: { mese?, anno?, crea_alerts?: boolean }
// - Default: mese/anno corrente, crea_alerts=true
// - Per mese passato: alert critico se raccolto < target
// - Per mese corrente: alert warning se proiezione fine mese < 90% del target
//
// Ogni caricamento aggiorna tutto (regola dell'utente, 21/09/2026), anche questi
// alert: prima si aprivano e non si chiudevano piu'. Senza un mese indicato - il
// controllo giornaliero e quello che parte a fine caricamento delle primarie - si
// rivalutano anche il mese precedente e ogni mese con un alert di target ancora
// aperto, perche' un caricamento tardivo puo' averli completati. L'alert di un
// mese che non e' piu' sotto soglia si chiude come risolto, con la nota; quello
// "a rischio" di un mese ormai chiuso sotto target diventa "non raggiunto".
// La risposta resta quella del solo mese richiesto: la legge il pannello della
// dashboard.
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
    let creaAlerts = body.crea_alerts !== false && eAmministratore(user);
    // Con le primarie in riscrittura il raccolto letto adesso e' a meta': gli alert
    // si aprirebbero e si chiuderebbero sul niente. Si rimandano; a caricamento
    // concluso il controllo riparte da solo (workflow AlertEngineAutoRun).
    let rimandato = false;
    if (creaAlerts && await caricamentoPrimarieInCorso(base44)) { creaAlerts = false; rimandato = true; }

    // Le primarie terminate si leggono una volta sola, anche quando i mesi sono piu' d'uno.
    let terminate = null;
    const primarieTerminate = async () => terminate || (terminate = await fetchAll(base44.asServiceRole.entities.PrimariaRete, { stato: 'terminato' }));

    // Target e raccolto di un mese.
    const valutaMese = async (mese, anno) => {
      // Un raccoglitore puo' avere piu' righe, una per impianto: si sommano.
      const targets = aggregaTargetMensili(await base44.asServiceRole.entities.TargetMensile.filter(
        { mese, anno }, '-created_date', 5000
      )) || [];
      const isMeseCorrente = (mese === meseCorrente && anno === annoCorrente);
      const esito: any = { mese, anno, isMeseCorrente, totale_target: targets.length, missed: [], atRisk: [], okCount: 0 };
      if (targets.length === 0) return esito;

      // Raccolto del solo canale RETE: i target dei raccoglitori non riguardano ACI
      // ed Extra Raccolta. Solo i terminati, nel mese della fine trasporto.
      // Il periodo si legge come in tutto il gestionale (base44/shared/movimenti.ts).
      const rete = filtraMovimenti(await primarieTerminate(), { anno, mese });
      // Fin dove arrivano i dati: l'ultimo giorno del mese con un ritiro in archivio.
      const ultimoGiornoDati = rete.reduce((m, r) => (giornoMovimento(r) > m ? giornoMovimento(r) : m), '');

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

      const giornoDelMese = Number(oggi.slice(8, 10));
      const giorniInMese = new Date(Date.UTC(anno, MESI.indexOf(mese) + 1, 0)).getUTCDate();
      // La frazione di mese trascorsa si misura sui DATI, non sul calendario: i file
      // si caricano ogni tanto e il portale chiude gli ordini giorni dopo. Se oggi e'
      // il 20 ma l'archivio arriva al 12, il raccolto e' di dodici giorni, non di
      // venti: proiettarlo su venti dava allarmi critici che non esistevano.
      const giorniCoperti = isMeseCorrente ? Math.min(giornoDelMese, Number(ultimoGiornoDati.slice(8, 10)) || 0) : giorniInMese;
      const proiezioneAffidabile = !isMeseCorrente || giorniCoperti >= GIORNI_MINIMI_PROIEZIONE;
      const fattoreTemporale = isMeseCorrente && giorniCoperti > 0 ? (giorniCoperti / giorniInMese) : 1;

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
          giorni_coperti_dai_dati: isMeseCorrente ? giorniCoperti : null,
          proiezione_affidabile: proiezioneAffidabile,
          giorni_in_mese: isMeseCorrente ? giorniInMese : null,
        };

        if (!isMeseCorrente) {
          // Mese passato: target definitivamente non raggiunto
          if (raccolto < targetVal) esito.missed.push(item);
          else esito.okCount++;
        } else {
          // Mese corrente: valuta proiezione fine mese, ma solo se i dati coprono
          // abbastanza giorni da poterla fare
          if (proiezioneAffidabile && pctProiezione < 90) esito.atRisk.push(item);
          else esito.okCount++;
        }
      }
      return esito;
    };

    // Gli alert aperti servono solo a chi li scrive. Tutti, non solo la prima
    // pagina: altrimenti si ricreano.
    const apertiPrimarie = creaAlerts
      ? await fetchAll(base44.asServiceRole.entities.Alert, { modulo: 'primarie_rete', stato: 'aperto' })
      : [];
    const apertiTarget = apertiPrimarie.filter(a => a.entity_type === 'TargetMensile');

    // I mesi da valutare: quello richiesto e, nel controllo automatico, il mese
    // precedente e i mesi che hanno ancora un alert di target aperto.
    const mesi = new Map();
    const aggiungiMese = (m, a) => { if (MESI.includes(m) && a) mesi.set(`${m}|${a}`, { mese: m, anno: a }); };
    aggiungiMese(mese, anno);
    if (creaAlerts && !body.mese) {
      if (meseCorrenteIdx === 0) aggiungiMese(MESI[11], annoCorrente - 1);
      else aggiungiMese(MESI[meseCorrenteIdx - 1], annoCorrente);
      for (const a of apertiTarget) { const p = periodoAlert(a); if (p) aggiungiMese(p.mese, p.anno); }
    }
    const valutazioni = [];
    for (const { mese: m, anno: a } of mesi.values()) valutazioni.push(await valutaMese(m, a));
    const principale = valutazioni[0];

    if (principale.totale_target === 0 && !creaAlerts) {
      return Response.json({
        mese, anno,
        messaggio: 'Nessun target mensile configurato per questo periodo',
        at_risk: [], missed: [], ok_count: 0, alerts_creati: 0,
        alert_rimandati: rimandato || undefined,
      });
    }

    let alertsCreati = 0;
    let alertsAggiornati = 0;
    let alertsChiusi = 0;
    if (creaAlerts) {
      // Si segnalano i target non raggiunti (mese passato) e quelli a rischio
      // sotto il 70% della proiezione (mese corrente).
      const daSegnalare = valutazioni.flatMap(v => [...v.missed, ...v.atRisk.filter(a => a.pct_proiezione < 70)]);
      const perRecord = new Map(apertiPrimarie.map(a => [a.record_id, a]));

      const newAlerts = [];
      for (const item of daSegnalare) {
        const recordId = chiaveAlert(item);
        const testo = testoAlert(item);
        const gia = perRecord.get(recordId);
        if (gia) {
          // Lo stesso raccoglitore nello stesso mese, ma la situazione e' cambiata:
          // "a rischio" a mese in corso, "non raggiunto" a mese chiuso.
          if (gia.entity_type === 'TargetMensile' && gia.titolo !== testo.titolo) {
            await base44.asServiceRole.entities.Alert.update(gia.id, testo);
            alertsAggiornati++;
          }
          continue;
        }
        newAlerts.push({
          ...testo,
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

      // Un alert di un mese appena valutato che non ha piu' la sua condizione si
      // chiude: il raccolto caricato dopo ha raggiunto il target, o la proiezione
      // e' tornata sopra la soglia. Si chiude, non si cancella.
      const attuali = new Set(daSegnalare.map(chiaveAlert));
      for (const a of apertiTarget) {
        const p = periodoAlert(a);
        if (!p || !mesi.has(`${p.mese}|${p.anno}`) || attuali.has(a.record_id)) continue;
        await base44.asServiceRole.entities.Alert.update(a.id, {
          stato: 'risolto',
          risolto_note: `Chiuso automaticamente il ${oggi}: rivalutato sui dati caricati, il target di ${p.mese} ${p.anno} non risulta piu' mancato ne' a rischio`,
        });
        alertsChiusi++;
      }
    }

    // I due target dell'impianto (Giacenze e Target & Status) devono coincidere:
    // una divergenza diventa un alert critico, che si chiude da solo quando torna a posto.
    let targetDivergenti = [];
    try {
      const [siti, impiantiTarget] = await Promise.all([
        fetchAll(base44.asServiceRole.entities.GiacenzaSito),
        fetchAll(base44.asServiceRole.entities.ImpiantoTargetSecondaria),
      ]);
      targetDivergenti = divergenzeTargetImpianti(siti, impiantiTarget, annoCorrente);
      if (creaAlerts) {
        const REGOLA = 'target_impianto_divergente';
        const aperti = (await fetchAll(base44.asServiceRole.entities.Alert, { modulo: 'giacenze', stato: 'aperto' })).filter(a => a.regola_id === REGOLA);
        const attuali = new Set(targetDivergenti.map(d => `${d.impianto}|${annoCorrente}`));
        for (const d of targetDivergenti) {
          const recordId = `${d.impianto}|${annoCorrente}`;
          if (aperti.some(a => a.record_id === recordId)) continue;
          await base44.asServiceRole.entities.Alert.create({
            titolo: `Target divergente: ${d.impianto}`, descrizione: testoDivergenza(d), severita: 'critico',
            modulo: 'giacenze', entity_type: 'GiacenzaSito', record_id: recordId, regola_id: REGOLA, regola_nome: 'Target impianto uguale in Giacenze e in Target & Status', stato: 'aperto',
          });
          alertsCreati++;
        }
        for (const a of aperti) {
          if (!attuali.has(a.record_id)) await base44.asServiceRole.entities.Alert.update(a.id, { stato: 'risolto', risolto_note: `Chiuso automaticamente il ${oggi}: i due target sono tornati uguali` });
        }
      }
    } catch (_e) { /* il controllo dei target mensili non deve fallire per questo */ }

    return Response.json({
      mese,
      anno,
      messaggio: principale.totale_target === 0 ? 'Nessun target mensile configurato per questo periodo' : undefined,
      target_impianti_divergenti: targetDivergenti,
      is_mese_corrente: principale.isMeseCorrente,
      totale_target: principale.totale_target,
      missed: principale.missed.sort((a, b) => a.pct_raggiungimento - b.pct_raggiungimento),
      at_risk: principale.atRisk.sort((a, b) => a.pct_proiezione - b.pct_proiezione),
      ok_count: principale.okCount,
      alerts_creati: alertsCreati,
      alerts_aggiornati: alertsAggiornati,
      alerts_chiusi: alertsChiusi,
      mesi_rivalutati: valutazioni.slice(1).map(v => `${v.mese} ${v.anno}`),
      alert_rimandati: rimandato || undefined,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
