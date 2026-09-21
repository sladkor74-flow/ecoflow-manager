import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { divergenzeTargetImpianti, testoDivergenza } from "../../shared/targetImpianti.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { PROV_TO_REGION, MESI } from "../../shared/raccoltoCalculator.ts";
import { aggregaTargetMensili, targetDelPortale } from "../../shared/targetRaccoglitori.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { eAmministratore } from "../../shared/permessi.ts";
import { filtraMovimenti, giornoMovimento } from "../../shared/movimenti.ts";
import { statoCaricamenti, caricamentiDuranteLettura } from "../../shared/reportSettimanali.ts";

// Sotto questo numero di giorni coperti dai dati la proiezione di fine mese non
// si fa: con tre giorni di raccolto, o con l'ultimo caricamento fermo al 2 del
// mese, moltiplicare per dieci da' numeri che non vogliono dire niente.
const GIORNI_MINIMI_PROIEZIONE = 10;

// Un mese finito non e' ancora un mese chiuso nei dati. Il portale mette
// "terminato" giorni dopo la fine del trasporto (un ritiro del 30 giugno chiuso
// il 4 luglio), e l'ultimo caricamento puo' essere di qualche giorno prima: il
// primo del mese il raccolto del mese appena finito e' incompleto, e dirlo "non
// raggiunto" apriva un alert, spesso critico, per ogni raccoglitore sotto target,
// che si chiudeva solo coi caricamenti successivi. Un mese passato si dice
// chiuso quando fra le primarie terminate c'e' una fine trasporto di almeno
// questi giorni dopo la sua fine; fino ad allora si valuta come un mese in
// corso, con la proiezione sui giorni che i dati coprono.
const GIORNI_ASSESTAMENTO = 7;

const due = (n) => String(n).padStart(2, '0');
const piuGiorni = (g, n) => new Date(Date.UTC(+g.slice(0, 4), +g.slice(5, 7) - 1, +g.slice(8, 10) + n)).toISOString().slice(0, 10);

// Il nome del mese come lo scrivono i target ('Settembre'), anche se arriva scritto
// in un altro modo: con un nome che non si riconosce si risponde che non ci sono
// target, come prima, invece di fallire.
const nomeMese = (m) => MESI.find(x => x.toLowerCase() === String(m || '').trim().toLowerCase()) || null;

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

// Regola 1: i ritiri terminati senza fine trasporto sono esclusi dal raccolto di
// ogni mese. Chi legge un "non raggiunto" deve sapere che puo' dipendere da
// ritiri fatti ma senza data sul portale.
function testoSenzaFine(item) {
  const n = item.senza_fine_trasporto || 0;
  if (!n) return '';
  return n === 1
    ? ` Un ritiro terminato del raccoglitore in ${item.regione} non ha la fine trasporto: è escluso dal raccolto di ogni mese finché la data non viene inserita sul portale.`
    : ` ${n} ritiri terminati del raccoglitore in ${item.regione} non hanno la fine trasporto: sono esclusi dal raccolto di ogni mese finché la data non viene inserita sul portale.`;
}

function testoAlert(item) {
  const isMissed = item.mese_chiuso;
  const finito = !item.is_mese_corrente;
  return {
    titolo: isMissed
      ? `Target non raggiunto: ${item.raccoglitore} — ${item.regione} (${item.mese} ${item.anno})`
      : `Target a rischio: ${item.raccoglitore} — ${item.regione} (${item.mese} ${item.anno})`,
    descrizione: (isMissed
      ? `Il raccoglitore "${item.raccoglitore}" in ${item.regione} non ha raggiunto il target mensile di ${item.target} ton per ${item.mese} ${item.anno}. Raccolto effettivo: ${item.raccolto} ton (Δ ${item.delta} ton, ${item.pct_raggiungimento}% del target).`
      : `Il raccoglitore "${item.raccoglitore}" in ${item.regione} è a rischio di non raggiungere il target di ${item.target} ton per ${item.mese} ${item.anno}. Raccolto finora: ${item.raccolto} ton con i dati fino al giorno ${item.giorni_coperti_dai_dati}/${item.giorni_in_mese}${finito ? " (il mese e' finito, ma i ritiri degli ultimi giorni possono non essere ancora terminati a portale)" : ''}, proiezione fine mese: ${item.proiezione} ton (${item.pct_proiezione}% del target).`)
      + testoSenzaFine(item),
    severita: (isMissed ? item.pct_raggiungimento : item.pct_proiezione) < 50 ? 'critico' : 'warning',
  };
}

// Controlla i target mensili di raccolta e genera alert per target non raggiunti o a rischio.
// Payload: { mese?, anno?, crea_alerts?: boolean }
// - Default: mese/anno corrente, crea_alerts=true
// - Mese chiuso nei dati (GIORNI_ASSESTAMENTO): "non raggiunto" se raccolto < target
// - Mese in corso, o finito da poco: "a rischio" se la proiezione di fine mese e'
//   sotto il 90% del target (l'alert si apre sotto il 70%)
//
// Ogni caricamento aggiorna tutto (regola dell'utente, 21/09/2026), anche questi
// alert: prima si aprivano e non si chiudevano piu'. Senza un mese indicato - il
// controllo giornaliero e quello che parte a fine caricamento delle primarie - si
// rivalutano anche il mese precedente e ogni mese con un alert di target ancora
// aperto, perche' un caricamento tardivo puo' averli completati. Un alert aperto
// si riscrive quando cambiano titolo, descrizione o gravita'; si chiude come
// risolto, con la nota, solo quando i dati dicono davvero che il target c'e': il
// raccolto l'ha raggiunto a mese chiuso, o la proiezione affidabile e' tornata
// sopra il 90%. Con i target del mese in reimportazione, o una proiezione non
// ancora affidabile, resta com'e'. Un alert che l'amministratore ha ignorato non
// si ricrea: e' una decisione presa, come nel motore degli alert.
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
    const mese = body.mese ? nomeMese(body.mese) : meseCorrente;
    const anno = Number(body.anno || annoCorrente);
    if (!mese || !Number.isInteger(anno) || anno < 2000) {
      return Response.json({
        mese: body.mese || null, anno: body.anno || null,
        messaggio: 'Nessun target mensile configurato per questo periodo',
        at_risk: [], missed: [], ok_count: 0, alerts_creati: 0,
      });
    }
    // Gli alert li scrive solo l'amministratore: agli altri la funzione risponde con i soli numeri.
    let creaAlerts = body.crea_alerts !== false && eAmministratore(user);
    // Con le primarie in riscrittura il raccolto letto adesso e' a meta': gli alert
    // si aprirebbero e si chiuderebbero sul niente. Si rimandano; a caricamento
    // concluso il controllo riparte da solo (workflow AlertEngineAutoRun). Lo
    // stesso dopo un caricamento interrotto, che ha lasciato l'archivio a meta'
    // finche' qualcuno non ricarica il file.
    let rimandato = false;
    const statoPrima = creaAlerts ? await statoCaricamenti(base44, ['primarie']) : null;
    if (statoPrima && statoPrima.in_corso.length) { creaAlerts = false; rimandato = true; }

    // Le primarie terminate si leggono una volta sola, anche quando i mesi sono piu' d'uno.
    let terminate = null;
    // Lo stato si rilegge dopo l'archivio: un caricamento partito o concluso mentre
    // lo si leggeva lo ha lasciato a meta', e gli alert si rimandano lo stesso.
    const primarieTerminate = async () => {
      if (terminate) return terminate;
      terminate = await fetchAll(base44.asServiceRole.entities.PrimariaRete, { stato: 'terminato' });
      if (creaAlerts && statoPrima && caricamentiDuranteLettura(statoPrima, await statoCaricamenti(base44, ['primarie'])).length) { creaAlerts = false; rimandato = true; }
      return terminate;
    };
    // I terminati senza fine trasporto non hanno un mese: restano fuori dal
    // raccolto di tutti, e si contano (regola 1). Di qualunque anno, anche senza
    // immissione: attribuirli al mese di immissione sarebbe un ripiego.
    let senzaFine = null;
    const terminatiSenzaFine = async () => senzaFine || (senzaFine = (await primarieTerminate()).filter(r => !giornoMovimento(r)));
    // Raccoglitore e regione di un ritiro, per il raccolto e per i senza fine trasporto.
    const raccRegione = (r) => ({
      raccoglitore: (r.trasportatore || 'N/D').trim(),
      regione: r.regione || PROV_TO_REGION[(r.provincia || '').toUpperCase().trim()] || 'Altro',
    });
    // Fin dove arrivano i dati in tutto l'archivio: decide quando un mese finito e'
    // anche chiuso. Mai oltre oggi: una data sbagliata nel futuro chiuderebbe tutto.
    let ultimoGiornoArchivio = null;
    const fineDatiArchivio = async () => {
      if (ultimoGiornoArchivio === null) {
        ultimoGiornoArchivio = (await primarieTerminate()).reduce((m, r) => { const g = giornoMovimento(r); return g > m ? g : m; }, '');
        if (ultimoGiornoArchivio > oggi) ultimoGiornoArchivio = oggi;
      }
      return ultimoGiornoArchivio;
    };

    // Target e raccolto di un mese.
    const valutaMese = async (mese, anno) => {
      // Un raccoglitore puo' avere piu' righe, una per impianto: si sommano.
      const targets = aggregaTargetMensili(await base44.asServiceRole.entities.TargetMensile.filter(
        { mese, anno }, '-created_date', 5000
      )) || [];
      const isMeseCorrente = (mese === meseCorrente && anno === annoCorrente);
      // chiavi: i raccoglitori con un target; ok: quelli che i dati dicono a posto
      // (raggiunto a mese chiuso, o proiezione affidabile sopra il 90%)
      const esito: any = { mese, anno, isMeseCorrente, chiuso: false, totale_target: targets.length, missed: [], atRisk: [], okCount: 0, chiavi: new Set(), ok: new Set() };
      if (targets.length === 0) return esito;

      // Raccolto del solo canale RETE: i target dei raccoglitori non riguardano ACI
      // ed Extra Raccolta. Solo i terminati, nel mese della fine trasporto.
      // Il periodo si legge come in tutto il gestionale (base44/shared/movimenti.ts).
      const rete = filtraMovimenti(await primarieTerminate(), { anno, mese });
      // Fin dove arrivano i dati del mese: l'ultimo giorno con un ritiro in archivio.
      const ultimoGiornoDati = rete.reduce((m, r) => (giornoMovimento(r) > m ? giornoMovimento(r) : m), '');

      const raccoltoByKey = {};
      const addRaccolto = (r) => {
        const { raccoglitore: racc, regione } = raccRegione(r);
        const peso = Number(r.peso_effettivo || 0) / 1000; // kg -> ton
        const key = `${racc}|||${regione}`;
        if (!raccoltoByKey[key]) raccoltoByKey[key] = { raccoglitore: racc, regione, raccolto: 0 };
        raccoltoByKey[key].raccolto += peso;
      };
      rete.forEach(addRaccolto);
      const senzaFineByKey = {};
      for (const r of await terminatiSenzaFine()) {
        const { raccoglitore, regione } = raccRegione(r);
        const key = `${raccoglitore}|||${regione}`;
        if (!senzaFineByKey[key]) senzaFineByKey[key] = { raccoglitore, regione, quanti: 0 };
        senzaFineByKey[key].quanti++;
      }

      const idxMese = MESI.indexOf(mese);
      const giornoDelMese = Number(oggi.slice(8, 10));
      const giorniInMese = new Date(Date.UTC(anno, idxMese + 1, 0)).getUTCDate();
      // passato (< 0), corrente (0) o futuro (> 0) rispetto a oggi
      const posizione = (anno * 12 + idxMese) - (annoCorrente * 12 + meseCorrenteIdx);
      const fineMese = `${anno}-${due(idxMese + 1)}-${due(giorniInMese)}`;
      const chiuso = posizione < 0 && (await fineDatiArchivio()) >= piuGiorni(fineMese, GIORNI_ASSESTAMENTO);
      esito.chiuso = chiuso;
      const giorniTrascorsi = posizione < 0 ? giorniInMese : posizione === 0 ? giornoDelMese : 0;
      // La frazione di mese trascorsa si misura sui DATI, non sul calendario: i file
      // si caricano ogni tanto e il portale chiude gli ordini giorni dopo. Se oggi e'
      // il 20 ma l'archivio arriva al 12, il raccolto e' di dodici giorni, non di
      // venti: proiettarlo su venti dava allarmi critici che non esistevano.
      const giorniCoperti = chiuso ? giorniInMese : Math.min(giorniTrascorsi, Number(ultimoGiornoDati.slice(8, 10)) || 0);
      const proiezioneAffidabile = chiuso || giorniCoperti >= GIORNI_MINIMI_PROIEZIONE;
      const fattoreTemporale = !chiuso && giorniCoperti > 0 ? (giorniCoperti / giorniInMese) : 1;

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
        // i suoi ritiri terminati senza fine trasporto, con lo stesso abbinamento dei nomi
        const senzaFineTarget = Object.values(senzaFineByKey)
          .filter(x => x.regione === regione && targetDelPortale(nomiRegione, x.raccoglitore) === racc)
          .reduce((s, x) => s + x.quanti, 0);
        const pctRaggiungimento = (raccolto / targetVal) * 100;
        const delta = raccolto - targetVal;

        // Proiezione fine mese (mese non ancora chiuso nei dati)
        const proiezione = !chiuso && fattoreTemporale > 0
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
          mese_chiuso: chiuso,
          giorno_del_mese: isMeseCorrente ? giornoDelMese : null,
          giorni_coperti_dai_dati: chiuso ? null : giorniCoperti,
          proiezione_affidabile: proiezioneAffidabile,
          giorni_in_mese: chiuso ? null : giorniInMese,
          senza_fine_trasporto: senzaFineTarget,
        };
        const chiave = chiaveAlert(item);
        esito.chiavi.add(chiave);

        if (chiuso) {
          // Mese chiuso nei dati: target definitivamente non raggiunto
          if (raccolto < targetVal) esito.missed.push(item);
          else { esito.okCount++; esito.ok.add(chiave); }
        } else {
          // Mese in corso o finito da poco: valuta la proiezione di fine mese, ma
          // solo se i dati coprono abbastanza giorni da poterla fare
          if (proiezioneAffidabile && pctProiezione < 90) esito.atRisk.push(item);
          else {
            esito.okCount++;
            if (proiezioneAffidabile) esito.ok.add(chiave);
          }
        }
      }
      return esito;
    };

    // Gli alert aperti servono solo a chi li scrive. Tutti, non solo la prima
    // pagina: altrimenti si ricreano. Anche gli ignorati, per non ricrearli.
    const [apertiPrimarie, ignoratiPrimarie] = creaAlerts
      ? await Promise.all([
        fetchAll(base44.asServiceRole.entities.Alert, { modulo: 'primarie_rete', stato: 'aperto' }),
        fetchAll(base44.asServiceRole.entities.Alert, { modulo: 'primarie_rete', stato: 'ignorato' }),
      ])
      : [[], []];
    const apertiTarget = apertiPrimarie.filter(a => a.entity_type === 'TargetMensile');
    const ignorati = new Set(ignoratiPrimarie.filter(a => a.entity_type === 'TargetMensile').map(a => a.record_id));

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
      // Si segnalano i target non raggiunti (mese chiuso) e quelli a rischio sotto
      // il 70% della proiezione (mese in corso). Un alert gia' aperto resta e si
      // aggiorna finche' il raccoglitore e' a rischio per la soglia della funzione
      // (90%): chiuderlo fra il 70 e il 90 voleva dire riaprirlo al giro dopo.
      const perRecord = new Map(apertiPrimarie.map(a => [a.record_id, a]));

      const newAlerts = [];
      for (const v of valutazioni) {
        for (const item of [...v.missed, ...v.atRisk]) {
          const recordId = chiaveAlert(item);
          const testo = testoAlert(item);
          const gia = perRecord.get(recordId);
          if (gia) {
            // Lo stesso raccoglitore nello stesso mese, con i numeri di adesso:
            // raccolto, proiezione e gravita' cambiano a ogni caricamento, e il
            // titolo quando il mese si chiude ("a rischio" diventa "non raggiunto").
            if (gia.entity_type === 'TargetMensile'
              && (gia.titolo !== testo.titolo || gia.descrizione !== testo.descrizione || gia.severita !== testo.severita)) {
              await base44.asServiceRole.entities.Alert.update(gia.id, testo);
              alertsAggiornati++;
            }
            continue;
          }
          const daAprire = item.mese_chiuso || item.pct_proiezione < 70;
          if (!daAprire || ignorati.has(recordId)) continue;
          newAlerts.push({
            ...testo,
            modulo: 'primarie_rete',
            entity_type: 'TargetMensile',
            record_id: recordId,
            stato: 'aperto',
          });
        }
      }

      const CHUNK = 100;
      for (let i = 0; i < newAlerts.length; i += CHUNK) {
        const chunk = newAlerts.slice(i, i + CHUNK);
        try {
          await base44.asServiceRole.entities.Alert.bulkCreate(chunk);
          alertsCreati += chunk.length;
        } catch (e) { /* skip */ }
      }

      // Un alert di un mese appena valutato si chiude quando i dati dicono che il
      // target c'e', o che quel raccoglitore un target non ce l'ha piu'. Non si
      // chiude se il mese non ha target (si stanno reimportando: chiuderlo e poi
      // riaprirlo e' rumore) ne' se la proiezione non e' ancora affidabile. Si
      // chiude, non si cancella.
      const perMese = new Map(valutazioni.map(v => [`${v.mese}|${v.anno}`, v]));
      for (const a of apertiTarget) {
        const p = periodoAlert(a);
        const v = p && perMese.get(`${p.mese}|${p.anno}`);
        if (!v || v.totale_target === 0) continue;
        let nota = null;
        if (v.ok.has(a.record_id)) {
          nota = v.chiuso
            ? `il raccolto caricato ha raggiunto il target di ${p.mese} ${p.anno}`
            : `la proiezione di fine mese di ${p.mese} ${p.anno}, sui giorni coperti dai dati, e' tornata sopra il 90% del target`;
        } else if (!v.chiavi.has(a.record_id)) {
          nota = `il raccoglitore non ha piu' un target per ${p.mese} ${p.anno}`;
        }
        if (!nota) continue;
        await base44.asServiceRole.entities.Alert.update(a.id, {
          stato: 'risolto',
          risolto_note: `Chiuso automaticamente il ${oggi}: rivalutato sui dati caricati, ${nota}`,
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
      // false anche per un mese finito da poco: i suoi numeri sono ancora una proiezione
      dati_definitivi: principale.chiuso,
      totale_target: principale.totale_target,
      missed: principale.missed.sort((a, b) => a.pct_raggiungimento - b.pct_raggiungimento),
      at_risk: principale.atRisk.sort((a, b) => a.pct_proiezione - b.pct_proiezione),
      ok_count: principale.okCount,
      alerts_creati: alertsCreati,
      alerts_aggiornati: alertsAggiornati,
      alerts_chiusi: alertsChiusi,
      mesi_rivalutati: valutazioni.slice(1).map(v => `${v.mese} ${v.anno}`),
      alert_rimandati: rimandato || undefined,
      // primarie di rete terminate senza fine trasporto, di qualunque anno: escluse
      // dal raccolto di ogni mese (per raccoglitore, in ogni voce di missed e at_risk)
      senza_fine_trasporto: senzaFine ? senzaFine.length : undefined,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
