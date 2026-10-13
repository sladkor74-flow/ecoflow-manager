import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { calcolaRigheAttiva, riconciliaAttiva, documentoValido, eRigaACorpo, eRigaSurplus, TIPOLOGIE_ATTIVA } from "../../shared/attivaCalcolo.ts";

const ETICHETTE = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra Raccolta' };
const r2 = (v) => Math.round(v * 100) / 100;
// Gli euro di una frase, all'italiana.
const euroIt = (v) => {
  const n = r2(Number(v) || 0);
  const [intero, dec] = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '-' : '') + intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
};

// Riepilogo del dovuto da Ecotyre per un dato anno/mese, calcolato sui dati di
// oggi con le stesse righe che "Elabora Mese" salverebbe (base44/shared/
// attivaCalcolo.ts): anteprima e documento non possono divergere.
// Non crea documenti. Rete, ACI ed extra raccolta sono tre commesse: ogni
// numero e' per canale, non esiste un totale che le somma.
//
// Se il mese ha gia' un documento, lo confronta con i dati di oggi
// (riconciliazione): i movimenti arrivati dopo l'elaborazione si vedono qui.
//
// IL SURPLUS SULLE TARIFFE (13/10/2026). Il totale del canale e' quello che si
// fattura e comprende la riga del surplus (il Fuel Surcharge del consorzio);
// accanto ci sono lo standard (totale_standard) e le righe del surplus
// (surplus), perche' la pagina dica la fattura com'e': riga standard, riga del
// surplus, totale. La riga del surplus non e' un ordine e non ha una regione:
// non entra nei chili, negli ordini, nelle regioni, nella ripartizione per
// dicitura ne' nei prezzi del canale (la rete, che ha un prezzo solo, sarebbe
// diventata «prezzi variabili» per colpa del surplus).
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { anno, mese } = await req.json();
    if (!anno || !mese) return Response.json({ error: 'Anno e mese obbligatori' }, { status: 400 });
    const annoNum = Number(anno);

    const [reteAll, aciAll, extraAll, fornitori, tariffe, documenti, surplus] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.PrimariaRete),
      fetchAll(base44.asServiceRole.entities.PrimariaAci),
      fetchAll(base44.asServiceRole.entities.ExtraRaccolta),
      fetchAll(base44.asServiceRole.entities.Fornitore),
      // Tutte le pagine, come il documento e l'assistente: con la pagina di
      // default del backend anteprima e documento potevano dire importi diversi.
      fetchAll(base44.asServiceRole.entities.Tariffa, { direzione: 'ATTIVA' }),
      base44.asServiceRole.entities.DocumentoFatturazione.filter({ tipo: 'ATTIVA', anno: annoNum, mese }),
      // tutti i surplus: il disattivato si toglie nel calcolo, come per le tariffe
      fetchAll(base44.asServiceRole.entities.SurplusTariffa),
    ]);
    const { righe, anomalie, extra_secondarie_escluse, surplus_del_mese } = calcolaRigheAttiva({ reteAll, aciAll, extraAll, fornitori, tariffe, anno: annoNum, mese, surplus });

    const tipologie = [];
    for (const tipologia of TIPOLOGIE_ATTIVA) {
      const lista = righe[tipologia];
      let kg = 0, totale = 0, totaleSurplus = 0, ordini = 0, missingKg = 0, missingCount = 0;
      const byRegione = {};
      const prezzi = new Map();
      const rip = { TRASP: { ordini: 0, kg: 0, totale: 0 }, TRASP_TRATT: { ordini: 0, kg: 0, totale: 0 } };
      for (const r of lista) {
        totale += r.totale;
        // la riga del surplus: nel totale del canale, e da nessun'altra parte
        if (eRigaSurplus(r)) { totaleSurplus += r.totale; continue; }
        const corpo = eRigaACorpo(r);
        const regione = r.regione || 'N/D';
        if (!byRegione[regione]) byRegione[regione] = { regione, kg: 0, totale: 0, ordini: 0 };
        byRegione[regione].totale += r.totale;
        const x = rip[r.servizio_ecotyre];
        if (x) x.totale += r.totale;
        if (corpo) continue;
        kg += r.quantita; ordini++;
        byRegione[regione].kg += r.quantita; byRegione[regione].ordini++;
        if (x) { x.ordini++; x.kg += r.quantita; }
        if (r.stato_validazione === 'errore') { missingKg += r.quantita; missingCount++; continue; }
        const tk = `${r.tariffa_valore}|${r.unita_misura}`;
        if (!prezzi.has(tk)) prezzi.set(tk, { valore: r.tariffa_valore, unita_misura: r.unita_misura, ambiti: new Set() });
        const ambito = tipologia === 'RETE' ? r.classe : r.regione;
        if (ambito) prezzi.get(tk).ambiti.add(ambito);
      }
      let badge;
      if (missingCount > 0) badge = { tipo: 'mancante', tonnellate_mancanti: r2(missingKg / 1000), count_mancanti: missingCount };
      else if (prezzi.size > 1) badge = { tipo: 'variabile', valori: Array.from(prezzi.values()).map(v => ({ valore: v.valore, unita_misura: v.unita_misura, ambiti: Array.from(v.ambiti) })) };
      else if (prezzi.size === 1) { const v = Array.from(prezzi.values())[0]; badge = { tipo: 'uniforme', valore: v.valore, unita_misura: v.unita_misura }; }
      else badge = { tipo: 'vuoto' };

      // Le righe del surplus del canale, come le dice la fattura: nome, origine,
      // periodo, tonnellate del mese, €/t, importo. Gli ordini su cui vale
      // (ordini_ids) servono al confronto con la prefattura, non alla pagina.
      // SOLO I CAMPI DELL'ATTIVA, ELENCATI UNO PER UNO (revisione del
      // 13/10/2026): il riepilogo risponde a chiunque sia collegato, e quanto
      // SMOCO paga ai fornitori e' un costo, che vede solo l'amministratore. Un
      // campo nuovo del calcolo non arriva qui finche' non lo si aggiunge.
      const surplusCanale = (surplus_del_mese[tipologia] || []).map(s => ({
        surplus_id: s.surplus_id, gruppo: s.gruppo, nome: s.nome, origine: s.origine, riferimento: s.riferimento,
        prestazione: s.prestazione, euro_t: s.euro_t, kg: s.kg, ton: s.ton, ordini: s.ordini, totale: s.totale, dal: s.dal, al: s.al,
      }));

      // Il documento salvato contro i dati di oggi
      const doc = documentoValido(documenti, tipologia);
      let riconciliazione = null;
      if (doc) {
        const voci = await base44.asServiceRole.entities.VoceFatturazione.filter({ documento_id: doc.id }, 'ordine', 5000);
        riconciliazione = {
          documento_id: doc.id, stato: doc.stato,
          data_elaborazione: doc.data_elaborazione || null,
          totale_documento: doc.totale || 0,
          ...riconciliaAttiva(lista, voci),
        };
        // UN SURPLUS SU UN MESE GIA' CHIUSO (13/10/2026). Se il consorzio
        // comunica un surplus per un mese gia' fatturato, la differenza e' vera
        // ma non e' un errore del documento: va fatturata a parte. Il gestionale
        // lo dice e non riapre niente da solo.
        const delSurplus = (elenco) => (elenco || []).filter(x => x.surplus);
        const nomi = [...new Set([...delSurplus(riconciliazione.nuovi), ...delSurplus(riconciliazione.cambiati), ...delSurplus(riconciliazione.spariti)].map(x => x.descrizione))];
        if (doc.stato === 'chiusa' && nomi.length) {
          const euro = r2(
            delSurplus(riconciliazione.nuovi).reduce((s, x) => s + (Number(x.totale) || 0), 0)
            + delSurplus(riconciliazione.cambiati).reduce((s, x) => s + (Number(x.totale_oggi) || 0) - (Number(x.totale_documento) || 0), 0)
            - delSurplus(riconciliazione.spariti).reduce((s, x) => s + (Number(x.totale) || 0), 0));
          const quali = nomi.join(' e ');
          riconciliazione.surplus_a_parte = {
            euro,
            testo: `Il documento di ${String(mese).toLowerCase()} ${annoNum} è chiuso: ${euro >= 0
              ? `${quali}, ${euroIt(euro)} € in più, va fatturato a parte`
              : `${quali}, ${euroIt(-euro)} € fatturati in più, va stornato a parte`}. Il documento non si riapre da solo.`,
          };
        }
      }

      const chiudi = (v) => ({ ordini: v.ordini, kg: Math.round(v.kg), ton: r2(v.kg / 1000), totale: r2(v.totale) });
      tipologie.push({
        tipologia, label: ETICHETTE[tipologia],
        volume_kg: kg, volume_ton: r2(kg / 1000), totale: r2(totale), ordini,
        totale_standard: r2(totale - totaleSurplus), totale_surplus: r2(totaleSurplus),
        surplus: surplusCanale,
        badge,
        by_regione: Object.values(byRegione).map(v => ({ ...v, totale: r2(v.totale) })).sort((a, b) => b.totale - a.totale),
        ripartizione_servizio: { TRASP: chiudi(rip.TRASP), TRASP_TRATT: chiudi(rip.TRASP_TRATT) },
        riconciliazione,
      });
    }

    return Response.json({
      periodo: { anno: annoNum, mese },
      anomalie,
      extra_secondarie_escluse,
      tipologie,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
