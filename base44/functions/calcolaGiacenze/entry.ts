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
//   OrdineNonDichiarato  -> giacenza a portale, ordini da dichiarare, arretrato per anno
//   DichiarazioneTrattamento -> dichiarato e derivati (filtrato per anno di data_dichiarazione)
//   PrimariaRete/Aci, ExtraRaccolta, Secondaria, Terziaria -> movimentazione (stato terminato, trasporto_finito_il nell'anno)
//   GiacenzaSito -> target e tipologia trattamento
//
// ATTRIBUZIONE AL SITO: destinazione_secondaria se valorizzata, altrimenti destinazione.
//   Mai destinazione_finale (cementeria estera, non il soggetto trattante).
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
    const [nonDichiarati, dichiarazioni, reteAll, aciAll, extraAll, secAll, terzAll, giacenzeSito] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.OrdineNonDichiarato),
      fetchAll(base44.asServiceRole.entities.DichiarazioneTrattamento),
      fetchAll(base44.asServiceRole.entities.PrimariaRete),
      fetchAll(base44.asServiceRole.entities.PrimariaAci),
      fetchAll(base44.asServiceRole.entities.ExtraRaccolta),
      fetchAll(base44.asServiceRole.entities.Secondaria),
      fetchAll(base44.asServiceRole.entities.Terziaria),
      fetchAll(base44.asServiceRole.entities.GiacenzaSito, { anno: annoNum }),
    ]);

    // --- Funzione attribuzione sito: destinazione_secondaria se valorizzata, else destinazione ---
    function sitoDiRiga(r) {
      const sec = String(r.destinazione_secondaria || '').trim();
      if (sec) return sec;
      return String(r.destinazione || '').trim();
    }

    // --- Filtri temporali per movimentazione ---
    function isTerminato(r) { return String(r.stato || '').trim().toLowerCase() === 'terminato'; }
    function inYear(dateField) {
      if (!dateField) return false;
      const d = new Date(dateField);
      return !isNaN(d.getTime()) && d.getFullYear() === annoNum;
    }

    // === 1. GIACENZA A PORTALE (OrdineNonDichiarato, senza filtro d'anno) ===
    const giacPortaleMap = new Map();   // normSito -> t
    const ordiniMap = new Map();        // normSito -> count
    const arretratoAnniMap = new Map(); // normSito -> { anno: t }

    for (const r of nonDichiarati) {
      const sito = sitoDiRiga(r);
      const ns = norm(sito);
      if (!ns) continue;
      const kg = Number(r.peso_non_dichiarato_kg) || 0;
      const t = kg / 1000;
      giacPortaleMap.set(ns, (giacPortaleMap.get(ns) || 0) + t);
      ordiniMap.set(ns, (ordiniMap.get(ns) || 0) + 1);

      // Arretrato per anno di data_chiusura
      let annoChiusura = null;
      if (r.data_chiusura) {
        const d = new Date(r.data_chiusura);
        if (!isNaN(d.getTime())) annoChiusura = d.getFullYear();
      }
      if (annoChiusura !== null) {
        if (!arretratoAnniMap.has(ns)) arretratoAnniMap.set(ns, {});
        const perAnno = arretratoAnniMap.get(ns);
        perAnno[annoChiusura] = (perAnno[annoChiusura] || 0) + t;
      }
    }

    // === 2. DICHIARATO (DichiarazioneTrattamento, filtrato per anno di data_dichiarazione) ===
    const dichiaratoMap = new Map();   // normSito -> t
    const derivatiMap = new Map();     // normSito -> { granulo, fibre, metallo, cippato, ciabattato }

    for (const d of dichiarazioni) {
      // Filtro: anno di data_dichiarazione
      if (!inYear(d.data_dichiarazione)) continue;
      const sito = sitoDiRiga(d);
      const ns = norm(sito);
      if (!ns) continue;
      const kg = Number(d.peso_associato_kg) || 0;
      const t = kg / 1000;
      dichiaratoMap.set(ns, (dichiaratoMap.get(ns) || 0) + t);

      if (!derivatiMap.has(ns)) derivatiMap.set(ns, { granulo: 0, fibre: 0, metallo: 0, cippato: 0, ciabattato: 0 });
      const der = derivatiMap.get(ns);
      der.granulo += (Number(d.granulo_kg) || 0) / 1000;
      der.fibre += (Number(d.fibre_kg) || 0) / 1000;
      der.metallo += (Number(d.metallo_kg) || 0) / 1000;
      der.cippato += (Number(d.cippato_kg) || 0) / 1000;
      der.ciabattato += (Number(d.ciabattato_kg) || 0) / 1000;
    }

    // === 3. MOVIMENTAZIONE (filtrata per stato terminato e trasporto_finito_il nell'anno) ===
    // conferito_primarie_t: PrimariaRete + PrimariaAci + ExtraRaccolta, per destinazione|tipo_destinazione
    const confPrimMap = new Map(); // normSito|td -> t
    for (const r of [...reteAll, ...aciAll, ...extraAll]) {
      if (!isTerminato(r) || !inYear(r.trasporto_finito_il)) continue;
      const nd = norm(r.destinazione);
      const td = tdNorm(r.tipo_destinazione);
      if (!nd || !td) continue;
      const k = nd + '|' + td;
      confPrimMap.set(k, (confPrimMap.get(k) || 0) + (Number(r.peso_effettivo) || 0) / 1000);
    }

    // secondarie_in_t: Secondaria con destinazione corrispondente al sito
    const secInMap = new Map(); // normSito -> t
    for (const r of secAll) {
      if (!isTerminato(r) || !inYear(r.trasporto_finito_il)) continue;
      const nd = norm(r.destinazione);
      if (!nd) continue;
      secInMap.set(nd, (secInMap.get(nd) || 0) + (Number(r.peso_effettivo) || 0) / 1000);
    }

    // secondarie_out_t: Secondaria con stoccaggio corrispondente al sito
    const secOutMap = new Map(); // normSito -> t
    for (const r of secAll) {
      if (!isTerminato(r) || !inYear(r.trasporto_finito_il)) continue;
      const ns = norm(r.stoccaggio);
      if (!ns) continue;
      secOutMap.set(ns, (secOutMap.get(ns) || 0) + (Number(r.peso_effettivo) || 0) / 1000);
    }

    // terziarie_t: Terziaria con unita_locale_origine, o ragione_sociale, corrispondente al sito
    const terzMap = new Map(); // normSito -> t
    for (const r of terzAll) {
      if (!isTerminato(r) || !inYear(r.trasporto_finito_il)) continue;
      const no = norm(r.unita_locale_origine || r.ragione_sociale);
      if (!no) continue;
      terzMap.set(no, (terzMap.get(no) || 0) + (Number(r.peso_effettivo) || 0) / 1000);
    }

    // === 4. GIACENZASITO: target e tipologia per sito|ruolo|anno ===
    const giacMap = new Map(); // normSito|td -> record
    for (const g of giacenzeSito) {
      giacMap.set(norm(g.sito) + '|' + tdNorm(g.tipo_destinazione), g);
    }

    // === 5. UNIONE DEI SITI ===
    const rowKeys = new Set(); // Set di "normSito|td"

    // Da GiacenzaSito
    for (const g of giacenzeSito) {
      rowKeys.add(norm(g.sito) + '|' + tdNorm(g.tipo_destinazione));
    }
    // Da OrdineNonDichiarato (senza td noto -> attribuisci a 'imp' come default)
    for (const ns of giacPortaleMap.keys()) {
      // Cerca il td dai record GiacenzaSito per questo sito
      const tdFromGiac = [...giacMap.keys()].filter(k => k.startsWith(ns + '|')).map(k => k.split('|')[1]);
      if (tdFromGiac.length > 0) {
        for (const td of tdFromGiac) rowKeys.add(ns + '|' + td);
      } else {
        rowKeys.add(ns + '|imp'); // default
      }
    }
    // Da DichiarazioneTrattamento
    for (const ns of dichiaratoMap.keys()) {
      const tdFromGiac = [...giacMap.keys()].filter(k => k.startsWith(ns + '|')).map(k => k.split('|')[1]);
      if (tdFromGiac.length > 0) {
        for (const td of tdFromGiac) rowKeys.add(ns + '|' + td);
      } else {
        rowKeys.add(ns + '|imp');
      }
    }
    // Da movimentazione (conferito_primarie ha td, le altre no)
    for (const k of confPrimMap.keys()) {
      rowKeys.add(k);
    }
    for (const ns of secInMap.keys()) {
      const tdFromGiac = [...giacMap.keys()].filter(k => k.startsWith(ns + '|')).map(k => k.split('|')[1]);
      if (tdFromGiac.length > 0) {
        for (const td of tdFromGiac) rowKeys.add(ns + '|' + td);
      } else {
        rowKeys.add(ns + '|imp');
      }
    }
    for (const ns of secOutMap.keys()) {
      const tdFromGiac = [...giacMap.keys()].filter(k => k.startsWith(ns + '|')).map(k => k.split('|')[1]);
      if (tdFromGiac.length > 0) {
        for (const td of tdFromGiac) rowKeys.add(ns + '|' + td);
      } else {
        rowKeys.add(ns + '|stoc'); // secondarie_out riguarda lo stoccaggio
      }
    }
    for (const ns of terzMap.keys()) {
      const tdFromGiac = [...giacMap.keys()].filter(k => k.startsWith(ns + '|')).map(k => k.split('|')[1]);
      if (tdFromGiac.length > 0) {
        for (const td of tdFromGiac) rowKeys.add(ns + '|' + td);
      } else {
        rowKeys.add(ns + '|imp');
      }
    }

    // === 6. COSTRUZIONE RIGHE ===
    const righe = [];
    const anomalie = [];
    const sitiSenzaTarget = new Set();

    for (const key of rowKeys) {
      const [ns, td] = key.split('|');
      const g = giacMap.get(key);

      // Recupera il nome sito originale (preferisci dal record GiacenzaSito)
      let sitoNome = g?.sito || ns;

      const giacenza_portale_t = giacPortaleMap.get(ns) || 0;
      const ordini_da_dichiarare = ordiniMap.get(ns) || 0;
      const arretrato_per_anno = arretratoAnniMap.get(ns) || {};

      const dichiarato_t = dichiaratoMap.get(ns) || 0;
      const der = derivatiMap.get(ns) || { granulo: 0, fibre: 0, metallo: 0, cippato: 0, ciabattato: 0 };

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
      // Sito senza target configurato
      if (!g) {
        sitiSenzaTarget.add(sitoNome);
      }
      // Coerenza derivati vs dichiarato
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
      // Giacenza a portale superiore al target totale
      if (g && target_totale_t > 0 && giacenza_portale_t > target_totale_t) {
        anomalie.push({
          tipo: 'giacenza_sopra_target',
          sito: sitoNome,
          giacenza_portale_t: r2(giacenza_portale_t),
          target_totale_t: r2(target_totale_t)
        });
      }
    }

    // Anomalie: siti senza target
    for (const s of sitiSenzaTarget) {
      anomalie.push({ tipo: 'sito_senza_target', sito: s, anno: annoNum });
    }

    // Ordina per giacenza_portale_t decrescente
    righe.sort((a, b) => b.giacenza_portale_t - a.giacenza_portale_t);

    // === 7. TOTALI ===
    const numCols = [
      'giacenza_portale_t', 'dichiarato_t', 'granulo_t', 'fibre_t', 'metallo_t', 'cippato_t', 'ciabattato_t',
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