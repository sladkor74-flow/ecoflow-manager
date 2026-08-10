import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Calcola le giacenze di impianto in tempo reale:
//   Ingressi = PrimariaRete + PrimariaAci + Secondaria (dove l'impianto è Destinazione)
//   Uscite   = Terziaria (dove l'impianto è Unita_Locale_Origine) + Secondaria (dove l'impianto è Stoccaggio/origine)
//   Giacenza = Ingressi - Uscite
// Payload: { filters?: { impianto?, mese?, anno? } }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const filters = body.filters || {};

    const [rete, aci, sec, terz] = await Promise.all([
      base44.asServiceRole.entities.PrimariaRete.list('-created_date', 10000),
      base44.asServiceRole.entities.PrimariaAci.list('-created_date', 10000),
      base44.asServiceRole.entities.Secondaria.list('-created_date', 10000),
      base44.asServiceRole.entities.Terziaria.list('-created_date', 10000),
    ]);

    const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
    function getMese(r) {
      if (r.mese) return r.mese;
      const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
      if (!d) return null;
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? null : MESI[dt.getMonth()];
    }
    function getAnno(r) {
      if (r.anno != null) return r.anno;
      const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
      if (!d) return null;
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? null : dt.getFullYear();
    }

    // --- INPUT (ingressi in impianto) ---
    const inputs = {}; // impianto -> { totale, mesi: {mese -> ton} }
    function addInput(impianto, pesoKg, r) {
      if (!impianto) return;
      const imp = impianto.trim();
      if (!imp) return;
      if (filters.impianto && imp !== filters.impianto) return;
      if (filters.mese && getMese(r) !== filters.mese) return;
      if (filters.anno && getAnno(r) !== parseInt(filters.anno)) return;
      if (!inputs[imp]) inputs[imp] = { impianto: imp, totale: 0, spedizioni: 0 };
      const ton = (pesoKg || 0) / 1000;
      inputs[imp].totale += ton;
      inputs[imp].spedizioni += 1;
    }
    for (const r of rete) addInput(r.destinazione, r.peso_effettivo, r);
    for (const r of aci) addInput(r.destinazione, r.peso_effettivo, r);
    for (const r of sec) addInput(r.destinazione, r.peso_effettivo, r);

    // --- OUTPUT (uscite dall'impianto) ---
    const outputs = {}; // impianto -> { totale, spedizioni }
    function addOutput(impianto, pesoKg, r) {
      if (!impianto) return;
      const imp = impianto.trim();
      if (!imp) return;
      if (filters.impianto && imp !== filters.impianto) return;
      if (filters.mese && getMese(r) !== filters.mese) return;
      if (filters.anno && getAnno(r) !== parseInt(filters.anno)) return;
      if (!outputs[imp]) outputs[imp] = { impianto: imp, totale: 0, spedizioni: 0 };
      const ton = (pesoKg || 0) / 1000;
      outputs[imp].totale += ton;
      outputs[imp].spedizioni += 1;
    }
    // Terziarie: l'impianto di origine è unita_locale_origine
    for (const r of terz) addOutput(r.unita_locale_origine, r.peso_effettivo, r);
    // Secondarie in uscita: l'impianto di origine è lo stoccaggio
    for (const r of sec) addOutput(r.stoccaggio, r.peso_effettivo, r);

    // --- GIACENZE ---
    const allImpianti = new Set([...Object.keys(inputs), ...Object.keys(outputs)]);
    const giacenze = [...allImpianti].map((imp) => {
      const ing = inputs[imp]?.totale || 0;
      const out = outputs[imp]?.totale || 0;
      const ingSped = inputs[imp]?.spedizioni || 0;
      const outSped = outputs[imp]?.spedizioni || 0;
      return {
        impianto: imp,
        ingressi_t: +ing.toFixed(2),
        uscite_t: +out.toFixed(2),
        giacenza_t: +(ing - out).toFixed(2),
        spedizioni_ingresso: ingSped,
        spedizioni_uscita: outSped,
      };
    }).sort((a, b) => b.giacenza_t - a.giacenza_t);

    return Response.json({ giacenze });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}