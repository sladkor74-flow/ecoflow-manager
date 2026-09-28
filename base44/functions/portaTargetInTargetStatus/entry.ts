import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { soloAmministratore } from "../../shared/permessi.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { annoChiuso, recordDellAnno, targetImpiantoDellAnno } from "../../shared/annoTarget.ts";

// Il passaggio del target degli impianti dalle Giacenze a Target & Status
// (27/09/2026). Il target di un impianto si scrive solo in Target & Status
// (ImpiantoTargetSecondaria) e le Giacenze lo leggono da li'. Prima si scriveva
// anche nelle Giacenze (GiacenzaSito.target_totale_t), e alcuni impianti ce
// l'hanno solo li': Green Tyre Project, T.R.S., Gatim, che hanno un target ma
// non ricevono secondarie da programmare.
//
// Per ogni impianto delle Giacenze di quell'anno con un target (> 0) e senza un
// record di Target & Status dello stesso anno, crea il record con quel target
// (in kg) e con segue_predittivita falso: la Predittivita' non comincia a
// seguirlo per questo. Non tocca le Giacenze e non cancella niente.
//
// Un impianto che ha gia' il record attivo dell'anno ma con target zero o vuoto
// (28/09/2026) riceve il target di Giacenze sullo stesso record, e la
// predittivita' spenta: prima restava senza target e la funzione lo taceva. La
// predittivita' non lo seguiva gia' (segue solo chi ha un target), e cosi' resta.
// Un impianto spento dell'anno non si riaccende: si dice di farlo a mano.
//
// Corpo: { anno, simula }. Con simula:true dice solo che cosa creerebbe. Solo
// l'amministratore, mai su un anno chiuso. Si puo' ripetere.

const tonnellate = (t) => Math.round((Number(t) || 0) * 1000) / 1000;

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const { errore } = await soloAmministratore(base44);
    if (errore) return errore;

    const corpo = await req.json().catch(() => ({}));
    const anno = Number(corpo && corpo.anno);
    const simula = !!(corpo && corpo.simula);
    if (!Number.isInteger(anno) || anno < 2000 || anno > 2100) {
      return Response.json({ error: "Indica l'anno." }, { status: 400 });
    }
    if (annoChiuso(anno)) {
      return Response.json({ error: `Il ${anno} è chiuso: si può solo consultare, non si scrive niente.`, anno_chiuso: true }, { status: 400 });
    }
    const e = base44.asServiceRole.entities;
    const [siti, impianti] = await Promise.all([
      fetchAll(e.GiacenzaSito, { anno }),
      fetchAll(e.ImpiantoTargetSecondaria),
    ]);
    const chiave = normalizzaRagioneSociale;
    // un impianto spento di quell'anno non si riaccende da qui: lo decide l'amministratore
    const chiaviDellAnno = new Set(recordDellAnno(impianti, anno).map(r => chiave(r.nome_impianto)));

    const creati = [];
    const aggiornati = [];
    const saltati = [];
    const visti = new Set();
    for (const s of siti) {
      if (s.tipo_destinazione !== 'imp' || !(Number(s.target_totale_t) > 0)) continue;
      const k = chiave(s.sito);
      if (!k || visti.has(k)) continue;
      visti.add(k);
      const kg = Math.round(Number(s.target_totale_t) * 1000);
      const t = targetImpiantoDellAnno(impianti, s.sito, anno, chiave);
      if (t && t.kg > 0) continue;
      if (t) {
        aggiornati.push({ id: t.record.id, sito: t.record.nome_impianto || s.sito, target: kg });
        continue;
      }
      if (chiaviDellAnno.has(k)) {
        saltati.push({ sito: s.sito, target_t: tonnellate(s.target_totale_t), motivo: `in Target & Status l'impianto del ${anno} c'è ma non è attivo, e da qui non si riaccende: se quest'anno lavora, riattivalo a mano qui sotto e scrivi il suo target. Intanto Giacenze usa il target scritto lì.` });
        continue;
      }
      creati.push({ nome_impianto: s.sito, target: kg, anno, stato: 'attivo', segue_predittivita: false });
    }

    if (!simula) {
      for (const r of creati) await e.ImpiantoTargetSecondaria.create(r);
      for (const r of aggiornati) await e.ImpiantoTargetSecondaria.update(r.id, { target: r.target, segue_predittivita: false });
    }

    return Response.json({
      ok: true, anno, simulato: simula,
      creati: creati.map(r => ({ sito: r.nome_impianto, target_kg: r.target, target_t: tonnellate(r.target / 1000) })),
      aggiornati: aggiornati.map(r => ({ sito: r.sito, target_kg: r.target, target_t: tonnellate(r.target / 1000) })),
      saltati,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
