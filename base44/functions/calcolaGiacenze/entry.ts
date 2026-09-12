import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";

// Calcola la situazione delle giacenze di impianti e stoccaggi per l'anno richiesto.
//
// DUE ASSI TEMPORALI:
// - GIACENZA (stock): calcolata su tutto lo storico, senza filtro d'anno
// - CONFERITO e TARGET (flusso): calcolati sull'anno richiesto
//
// Fonti dati:
//   OrdineNonDichiarato  -> giacenza a portale (impianti), ordini da dichiarare, arretrato per anno, in_attesa_dichiarazione (stoccaggi)
//   GiacenzaStoccaggio   -> giacenza a portale degli stoccaggi (rilevazione manuale del saldo reale portale)
//   DichiarazioneTrattamento -> dichiarato e derivati (filtrato per anno di data_chiusura dell'ordine)
//   PrimariaRete/Aci, ExtraRaccolta, Secondaria, Terziaria -> movimentazione (stato terminato, trasporto_finito_il nell'anno)
//   GiacenzaSito -> target e tipologia trattamento
//
// RUOLO DEDOTTO DALL'ORDINE PRIMARIO:
//   I report OrdineNonDichiarato e DichiarazioneTrattamento non contengono Tipo_Destinazione,
//   ma ordine_primaria corrisponde a id_ordine di PrimariaRete/Aci. Si costruisce una mappa
//   id_ordine -> tipo_destinazione e la si usa per attribuire il ruolo.
//
//   Regola di attribuzione (per OrdineNonDichiarato e DichiarazioneTrattamento):
//   - se destinazione_secondaria e' valorizzato: attribuisci a destinazione_secondaria con ruolo "imp"
//   - altrimenti attribuisci a destinazione, con ruolo dalla mappa ordini
//   - se l'ordine non ha riscontro nella mappa: ruolo "imp" + anomalia
//
// NOTA: i campi giacenza_fisica_t e divergenza_t sono stati rimossi perche' non attendibili.
// La giacenza fisica veniva calcolata come bilancio dei movimenti meno il dichiarato, ma i
// due insiemi coprono periodi diversi: PrimariaRete e PrimariaAci contengono ordini terminati
// a partire da gennaio 2024, mentre DichiarazioneTrattamento comprende dichiarazioni riferite
// a ordini chiusi gia' dal 2023. Il bilancio sottraeva dichiarazioni relative a materiale mai
// conteggiato in ingresso, con uno squilibrio complessivo di circa settemila tonnellate.
// La giacenza attendibile e' quella a portale, che il portale stesso calcola ordine per ordine.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { anno } = await req.json();
    if (!anno) return Response.json({ error: 'Anno obbligatorio' }, { status: 400 });
    const annoNum = Number(anno);

    const norm = normalizzaRagioneSociale;
    const r2 = (v) => Math.round(v * 100) / 100;
    const tdNorm = (v) => String(v || '').toLowerCase().trim();

    // Carica tutte le sorgenti dati in parallelo
    const [nonDichiarati, dichiarazioni, reteAll, aciAll, extraAll, secAll, terzAll, giacenzeSito, giacenzeStoccaggio] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.OrdineNonDichiarato),
      fetchAll(base44.asServiceRole.entities.DichiarazioneTrattamento),
      fetchAll(base44.asServiceRole.entities.PrimariaRete),
      fetchAll(base44.asServiceRole.entities.PrimariaAci),
      fetchAll(base44.asServiceRole.entities.ExtraRaccolta),
      fetchAll(base44.asServiceRole.entities.Secondaria),
      fetchAll(base44.asServiceRole.entities.Terziaria),
      fetchAll(base44.asServiceRole.entities.GiacenzaSito, { anno: annoNum }),
      fetchAll(base44.asServiceRole.entities.GiacenzaStoccaggio),
    ]);

    // --- Filtri temporali per movimentazione ---
    function isTerminato(r) { return String(r.stato || '').trim().toLowerCase() === 'terminato'; }
    function inYear(dateField) {
      if (!dateField) return false;
      const d = new Date(dateField);
      return !isNaN(d.getTime()) && d.getFullYear() === annoNum;
    }

    // === 0. MAPPA ORDINE -> TIPO_DESTINAZIONE (da PrimariaRete + PrimariaAci) ===
    const ordineTipoMap = new Map(); // id_ordine -> tipo_destinazione normalizzato
    for (const r of [...reteAll, ...aciAll]) {
      const id = String(r.id_ordine || '').trim();
      const td = tdNorm(r.tipo_destinazione);
      if (id && td) ordineTipoMap.set(id, td);
    }

    // --- Funzione attribuzione: restituisce { sito, td, anomalia } ---
    function attribuisci(r) {
      const sec = String(r.destinazione_secondaria || '').trim();
      if (sec) return { sito: sec, td: 'imp', anomalia: false };
      const dest = String(r.destinazione || '').trim();
      const ordineId = String(r.ordine_primaria || '').trim();
      const td = ordineTipoMap.get(ordineId);
      if (td) return { sito: dest, td, anomalia: false };
      return { sito: dest, td: 'imp', anomalia: true };
    }

    // === 1. GIACENZA A PORTALE (OrdineNonDichiarato, tutto lo storico, per ns|td) ===
    // Per IMP: il peso non dichiarato e' la giacenza a portale dell'impianto.
    // Per STOC: il peso non dichiarato NON e' giacenza dello stoccaggio (e' materiale partito verso
    //   un impianto, in attesa che l'impianto ricevente presenti la dichiarazione). Viene raccolto
    //   in inAttesaMap; la giacenza reale dello stoccaggio viene dalla rilevazione manuale (sezione 1b).
    const giacPortaleMap = new Map();   // ns|imp -> t
    const ordiniMap = new Map();        // ns|td -> count
    const arretratoAnniMap = new Map(); // ns|td -> { anno: t }
    const inAttesaMap = new Map();      // ns -> t (peso non dichiarato attribuito a stoccaggi)
    const ordiniSenzaRiscontro = new Set();

    for (const r of nonDichiarati) {
      const { sito, td, anomalia } = attribuisci(r);
      const ns = norm(sito);
      if (!ns) continue;
      const key = ns + '|' + td;
      if (anomalia) ordiniSenzaRiscontro.add(r.ordine_primaria);
      const kg = Number(r.peso_non_dichiarato_kg) || 0;
      const t = kg / 1000;
      if (td === 'stoc') {
        inAttesaMap.set(ns, (inAttesaMap.get(ns) || 0) + t);
      } else {
        giacPortaleMap.set(key, (giacPortaleMap.get(key) || 0) + t);
      }
      ordiniMap.set(key, (ordiniMap.get(key) || 0) + 1);

      // Arretrato per anno di data_chiusura
      let annoChiusura = null;
      if (r.data_chiusura) {
        const d = new Date(r.data_chiusura);
        if (!isNaN(d.getTime())) annoChiusura = d.getFullYear();
      }
      if (annoChiusura !== null) {
        if (!arretratoAnniMap.has(key)) arretratoAnniMap.set(key, {});
        const perAnno = arretratoAnniMap.get(key);
        perAnno[annoChiusura] = (perAnno[annoChiusura] || 0) + t;
      }
    }

    // === 1b. RILEVAZIONI GIACENZA STOCCAGGIO (saldo reale portale, per stoccaggi) ===
    // Per ogni stoccaggio, tiene il record con data_rilevazione piu' recente.
    const stocRilevMap = new Map(); // ns -> { record, dataStr, dataMs }
    for (const r of giacenzeStoccaggio) {
      const ns = norm(r.sito);
      if (!ns) continue;
      const dataStr = r.data_rilevazione ? String(r.data_rilevazione).slice(0, 10) : null;
      const dataMs = dataStr ? new Date(dataStr).getTime() : 0;
      const existing = stocRilevMap.get(ns);
      if (!existing || dataMs > existing.dataMs) {
        stocRilevMap.set(ns, { record: r, dataStr, dataMs });
      }
    }

    // === 2. DICHIARATO (DichiarazioneTrattamento, per ns|td) ===
    const dichiaratoMap = new Map();   // ns|td -> t (anno corrente)
    const derivatiMap = new Map();     // ns|td -> { granulo, fibre, metallo, cippato, ciabattato } (anno corrente)

    for (const d of dichiarazioni) {
      const { sito, td } = attribuisci(d);
      const ns = norm(sito);
      if (!ns) continue;
      const key = ns + '|' + td;
      const kg = Number(d.peso_associato_kg) || 0;
      const t = kg / 1000;

      // Anno di competenza = anno di chiusura dell'ordine, non di presentazione della dichiarazione
      if (inYear(d.data_chiusura)) {
        dichiaratoMap.set(key, (dichiaratoMap.get(key) || 0) + t);
        if (!derivatiMap.has(key)) derivatiMap.set(key, { granulo: 0, fibre: 0, metallo: 0, cippato: 0, ciabattato: 0 });
        const der = derivatiMap.get(key);
        der.granulo += (Number(d.granulo_kg) || 0) / 1000;
        der.fibre += (Number(d.fibre_kg) || 0) / 1000;
        der.metallo += (Number(d.metallo_kg) || 0) / 1000;
        der.cippato += (Number(d.cippato_kg) || 0) / 1000;
        der.ciabattato += (Number(d.ciabattato_kg) || 0) / 1000;
      }
    }

    // === 3. MOVIMENTAZIONE ANNO CORRENTE (per conferito, stato terminato + trasporto_finito_il nell'anno) ===
    const confPrimMap = new Map(); // ns|td -> t
    for (const r of [...reteAll, ...aciAll, ...extraAll]) {
      if (!isTerminato(r) || !inYear(r.trasporto_finito_il)) continue;
      const nd = norm(r.destinazione);
      const td = tdNorm(r.tipo_destinazione);
      if (!nd || !td) continue;
      const k = nd + '|' + td;
      confPrimMap.set(k, (confPrimMap.get(k) || 0) + (Number(r.peso_effettivo) || 0) / 1000);
    }

    const secInMap = new Map(); // ns -> t
    for (const r of secAll) {
      if (!isTerminato(r) || !inYear(r.trasporto_finito_il)) continue;
      const nd = norm(r.destinazione);
      if (!nd) continue;
      secInMap.set(nd, (secInMap.get(nd) || 0) + (Number(r.peso_effettivo) || 0) / 1000);
    }

    const secOutMap = new Map(); // ns -> t
    for (const r of secAll) {
      if (!isTerminato(r) || !inYear(r.trasporto_finito_il)) continue;
      const ns = norm(r.stoccaggio);
      if (!ns) continue;
      secOutMap.set(ns, (secOutMap.get(ns) || 0) + (Number(r.peso_effettivo) || 0) / 1000);
    }

    const terzMap = new Map(); // ns -> t
    for (const r of terzAll) {
      if (!isTerminato(r) || !inYear(r.trasporto_finito_il)) continue;
      const no = norm(r.unita_locale_origine || r.ragione_sociale);
      if (!no) continue;
      terzMap.set(no, (terzMap.get(no) || 0) + (Number(r.peso_effettivo) || 0) / 1000);
    }

    // === 3b. GIACENZASITO (serve per risolvere il td delle terziarie) ===
    const giacMap = new Map(); // ns|td -> record
    for (const g of giacenzeSito) {
      giacMap.set(norm(g.sito) + '|' + tdNorm(g.tipo_destinazione), g);
    }
    const giacMapKeys = new Set(giacMap.keys());

    // === 5. UNIONE DEI SITI (tutte le chiavi sono ns|td) ===
    const rowKeys = new Set();

    for (const k of giacMapKeys) rowKeys.add(k);
    for (const k of giacPortaleMap.keys()) rowKeys.add(k);
    for (const ns of stocRilevMap.keys()) rowKeys.add(ns + '|stoc');
    for (const k of dichiaratoMap.keys()) rowKeys.add(k);
    for (const k of confPrimMap.keys()) rowKeys.add(k);
    // Per le mappe per-ns dell'anno corrente (secInMap, secOutMap, terzMap): risolvi il td
    function resolveTds(ns) {
      const tds = [...giacMapKeys].filter(k => k.startsWith(ns + '|')).map(k => k.split('|')[1]);
      return tds.length > 0 ? tds : ['imp'];
    }
    for (const ns of secInMap.keys()) {
      for (const td of resolveTds(ns)) rowKeys.add(ns + '|' + td);
    }
    for (const ns of secOutMap.keys()) {
      // secondarie_out riguarda lo stoccaggio
      const tds = resolveTds(ns);
      if (tds.includes('stoc')) rowKeys.add(ns + '|stoc');
      else rowKeys.add(ns + '|stoc');
    }
    for (const ns of terzMap.keys()) {
      for (const td of resolveTds(ns)) rowKeys.add(ns + '|' + td);
    }

    // === 6. COSTRUZIONE RIGHE ===
    const righe = [];
    const anomalie = [];
    const sitiSenzaTarget = new Set();

    // Anomalie: ordini senza riscontro nella mappa
    for (const ord of ordiniSenzaRiscontro) {
      anomalie.push({ tipo: 'ordine_senza_riscontro', ordine: ord });
    }

    for (const key of rowKeys) {
      const [ns, td] = key.split('|');
      const g = giacMap.get(key);

      let sitoNome = g?.sito || ns;

      const ordini_da_dichiarare = ordiniMap.get(key) || 0;
      const arretrato_per_anno = arretratoAnniMap.get(key) || {};

      // Giacenza a portale: per impianti dagli ordini non dichiarati, per stoccaggi dalla rilevazione manuale
      let giacenza_portale_t;
      let giacenza_rete_t = null;
      let giacenza_aci_t = null;
      let data_rilevazione = null;
      let rilevazione_obsoleta = null;
      let in_attesa_dichiarazione_t = 0;

      if (td === 'stoc') {
        // in_attesa_dichiarazione_t: materiale gia' partito dallo stoccaggio verso un impianto,
        // che il portale continua ad attribuire allo stoccaggio finche' l'impianto ricevente non
        // presenta la dichiarazione. Non e' giacenza dello stoccaggio, ma arretrato di dichiarazione
        // a carico del destinatario.
        in_attesa_dichiarazione_t = inAttesaMap.get(ns) || 0;

        const rilev = stocRilevMap.get(ns);
        if (rilev) {
          const c1 = Number(rilev.record.class1_kg) || 0;
          const c2 = Number(rilev.record.class2_kg) || 0;
          const c3 = Number(rilev.record.class3_kg) || 0;
          const c4 = Number(rilev.record.class4_kg) || 0;
          const c9 = Number(rilev.record.class9_kg) || 0;
          giacenza_portale_t = (c1 + c2 + c3 + c4 + c9) / 1000;
          giacenza_rete_t = (c1 + c2 + c3 + c4) / 1000;
          giacenza_aci_t = c9 / 1000;
          data_rilevazione = rilev.dataStr;
          const trentaGiorniFa = Date.now() - 30 * 24 * 60 * 60 * 1000;
          rilevazione_obsoleta = rilev.dataMs < trentaGiorniFa;
        } else {
          giacenza_portale_t = 0;
          anomalie.push({ tipo: 'stoccaggio_senza_rilevazione', sito: sitoNome });
        }
      } else {
        giacenza_portale_t = giacPortaleMap.get(key) || 0;
      }

      const dichiarato_t = dichiaratoMap.get(key) || 0;
      const der = derivatiMap.get(key) || { granulo: 0, fibre: 0, metallo: 0, cippato: 0, ciabattato: 0 };

      const conferito_primarie_t = confPrimMap.get(key) || 0;
      const secondarie_in_t = secInMap.get(ns) || 0;
      const secondarie_out_t = secOutMap.get(ns) || 0;
      const secondarie_nette_t = secondarie_in_t - secondarie_out_t;
      const terziarie_t = terzMap.get(ns) || 0;

      const conferito_t = conferito_primarie_t + secondarie_in_t + secondarie_out_t;

      const target_primarie_t = g?.target_primarie_t || 0;
      const target_totale_t = g?.target_totale_t || 0;
      const giacenza_riferimento_t = g?.giacenza_riferimento_t || 0;
      const tipologia_trattamento = g?.tipologia_trattamento || '';

      const residuo_t = target_totale_t > 0 ? target_totale_t - conferito_t : null;
      const percentuale_target = target_totale_t > 0 ? (conferito_t / target_totale_t) * 100 : null;

      righe.push({
        sito: sitoNome,
        tipo_destinazione: td,
        giacenza_portale_t: r2(giacenza_portale_t),
        giacenza_rete_t: giacenza_rete_t !== null ? r2(giacenza_rete_t) : null,
        giacenza_aci_t: giacenza_aci_t !== null ? r2(giacenza_aci_t) : null,
        data_rilevazione,
        rilevazione_obsoleta,
        in_attesa_dichiarazione_t: r2(in_attesa_dichiarazione_t),
        ordini_da_dichiarare,
        arretrato_per_anno,
        dichiarato_t: r2(dichiarato_t),
        granulo_t: r2(der.granulo),
        fibre_t: r2(der.fibre),
        metallo_t: r2(der.metallo),
        cippato_t: r2(der.cippato),
        ciabattato_t: r2(der.ciabattato),
        conferito_primarie_t: r2(conferito_primarie_t),
        secondarie_in_t: r2(secondarie_in_t),
        secondarie_out_t: r2(secondarie_out_t),
        secondarie_nette_t: r2(secondarie_nette_t),
        terziarie_t: r2(terziarie_t),
        conferito_t: r2(conferito_t),
        target_primarie_t: r2(target_primarie_t),
        target_totale_t: r2(target_totale_t),
        giacenza_riferimento_t: r2(giacenza_riferimento_t),
        tipologia_trattamento,
        residuo_t: residuo_t !== null ? r2(residuo_t) : null,
        percentuale_target: percentuale_target !== null ? r2(percentuale_target) : null,
      });

      // --- Anomalie ---
      if (!g) {
        sitiSenzaTarget.add(sitoNome + ' (' + (td === 'imp' ? 'Impianto' : 'Stoccaggio') + ')');
      }
      const sommaDerivati = der.granulo + der.fibre + der.metallo + der.cippato + der.ciabattato;
      if (dichiarato_t > 0 && Math.abs(sommaDerivati - dichiarato_t) > 0.001) {
        anomalie.push({
          tipo: 'coerenza_derivati',
          sito: sitoNome,
          dichiarato_t: r2(dichiarato_t),
          somma_derivati_t: r2(sommaDerivati),
          differenza_t: r2(dichiarato_t - sommaDerivati)
        });
      }
      if (g && target_totale_t > 0 && giacenza_portale_t > target_totale_t) {
        anomalie.push({
          tipo: 'giacenza_sopra_target',
          sito: sitoNome,
          giacenza_portale_t: r2(giacenza_portale_t),
          target_totale_t: r2(target_totale_t)
        });
      }
    }

    for (const s of sitiSenzaTarget) {
      anomalie.push({ tipo: 'sito_senza_target', sito: s, anno: annoNum });
    }

    righe.sort((a, b) => b.giacenza_portale_t - a.giacenza_portale_t);

    // === 7. TOTALI ===
    const numCols = [
      'giacenza_portale_t', 'in_attesa_dichiarazione_t',
      'dichiarato_t', 'granulo_t', 'fibre_t', 'metallo_t', 'cippato_t', 'ciabattato_t',
      'conferito_primarie_t', 'secondarie_in_t', 'secondarie_out_t', 'secondarie_nette_t', 'terziarie_t',
      'conferito_t', 'target_primarie_t', 'target_totale_t', 'giacenza_riferimento_t'
    ];
    const totali = {};
    for (const c of numCols) totali[c] = r2(righe.reduce((s, r) => s + (r[c] || 0), 0));
    totali.ordini_da_dichiarare = righe.reduce((s, r) => s + (r.ordini_da_dichiarare || 0), 0);

    return Response.json({ anno: annoNum, righe, totali, anomalie });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}