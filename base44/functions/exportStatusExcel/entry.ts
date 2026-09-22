import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { formattaPesi } from "../../shared/formatoExcel.ts";
import * as XLSX from 'npm:xlsx@0.18.5';
import { computeRaccoltoData, MESI } from "../../shared/raccoltoCalculator.ts";
import { aggregaTargetMensili, aggregaTargetAnnui } from "../../shared/targetRaccoglitori.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";

// Esporta i dati di Status & Target in un file Excel (3 fogli: Raccoglitori, Regioni, Impianti;
// un quarto, Date da sistemare, quando qualche terminato di rete ne ha).
// Payload: { anno? }
// Ritorna: { file_base64, filename }
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const anno = Number(body.anno) || Number(oggiRoma().slice(0, 4));

    // 1. Calcola raccolto dell'anno
    // Target contro il solo canale RETE. Le date da sistemare si vogliono tutte:
    // vanno in un foglio del file.
    const raccolto = await computeRaccoltoData(base44, { anno: [anno], canale: 'rete' }, { esempiDate: Infinity });

    // 2. Leggi target dell'anno da Target & Status
    const targets = aggregaTargetMensili(await base44.asServiceRole.entities.TargetMensile.filter({ anno }, '-created_date', 10000));
    const annui = aggregaTargetAnnui(await base44.asServiceRole.entities.TargetRaccoglitore.filter({ anno }, '-created_date', 5000));
    const impiantoTargets = await base44.asServiceRole.entities.ImpiantoTarget.list('-created_date', 10000);

    // 3. Mappe target, per nome normalizzato e regione
    const targetMap = {};
    const targetAnnuoMap = {};
    for (const t of targets) {
      const key = `${normalizzaRagioneSociale(t.raccoglitore)}|||${t.regione}`;
      targetMap[`${key}|${t.mese}`] = t.target || 0;
    }
    for (const a of annui) targetAnnuoMap[`${normalizzaRagioneSociale(a.raccoglitore)}|||${a.regione}`] = a.target_tonnellate;
    const impiantoTargetMap = {};
    for (const t of impiantoTargets) {
      impiantoTargetMap[`${t.impianto}|${t.mese}`] = t.target || 0;
    }

    // 4. Foglio Raccoglitori
    const raccoglitoriRows = [["Regione", "Raccoglitore", "Target Annuo [t]", "Raccolto Totale [t]", "Leftover [t]",
      ...MESI.flatMap(m => [`${m} T`, `${m} R`, `${m} Δ`])]];

    for (const r of raccolto.by_raccoglitore) {
      const key = `${normalizzaRagioneSociale(r.raccoglitore)}|||${r.regione}`;
      const targetAnnuo = targetAnnuoMap[key] || 0;
      const leftover = targetAnnuo - r.totale;
      const row = [r.regione, r.raccoglitore, targetAnnuo, +r.totale.toFixed(2), +leftover.toFixed(2)];
      for (const m of MESI) {
        const t = targetMap[`${key}|${m}`] || 0;
        const rac = r.mesi[m] || 0;
        row.push(t, +rac.toFixed(2), +(t - rac).toFixed(2));
      }
      raccoglitoriRows.push(row);
    }

    // 5. Foglio Regioni
    const regioniRows = [["Regione", "Raccolto Totale [t]", ...MESI.map(m => `${m} [t]`)]];
    for (const r of raccolto.by_regione) {
      const row = [r.regione, +r.totale.toFixed(2)];
      for (const m of MESI) row.push(+(r.mesi[m] || 0).toFixed(2));
      regioniRows.push(row);
    }

    // 6. Foglio Impianti
    const impiantiRows = [["Impianto", "Raccolto Totale [t]", ...MESI.flatMap(m => [`${m} Target`, `${m} Raccolto`, `${m} Δ`])]];
    for (const i of raccolto.by_impianto) {
      const row = [i.impianto, +i.totale.toFixed(2)];
      for (const m of MESI) {
        const t = impiantoTargetMap[`${i.impianto}|${m}`] || 0;
        const rac = i.mesi[m] || 0;
        row.push(t, +rac.toFixed(2), +(t - rac).toFixed(2));
      }
      impiantiRows.push(row);
    }

    // 7. Genera workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, XLSX.utils.aoa_to_sheet(raccoglitoriRows)), "Raccoglitori");
    XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, XLSX.utils.aoa_to_sheet(regioniRows)), "Regioni");
    XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, XLSX.utils.aoa_to_sheet(impiantiRows)), "Impianti");

    // 8. Le date da sistemare (regola dell'utente, 22/09/2026): immissione, inizio
    // e fine trasporto sono obbligatorie in ogni formulario terminato. Chi non ha
    // la fine trasporto e' fuori dal raccolto di questo file, di qualunque anno
    // sia; gli altri ci sono, nel mese della fine trasporto, ma vanno corretti a
    // portale lo stesso. Il foglio c'e' solo se ce n'e' almeno uno.
    const daSistemare = raccolto.date_da_sistemare;
    if (daSistemare && daSistemare.totale > 0) {
      const giornoIt = (g) => (g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : '');
      const righeDate = [
        [`Rete: ${daSistemare.totale} ordini terminati con date da sistemare (${daSistemare.testo})`],
        [],
        ['Regione', 'Raccoglitore', 'ID Ordine', 'Numero FIR', 'Fine trasporto', 'Date da sistemare', 'Nel raccolto'],
        ...daSistemare.esempi.map(e => [
          e.regione, e.trasportatore, e.id_ordine, e.numero_fir, giornoIt(e.fine_trasporto), e.testo,
          e.fine_trasporto ? 'Sì, nel mese della fine trasporto' : 'No: senza fine trasporto non ha un mese',
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(righeDate), "Date da sistemare");
    }

    const xlsxBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    return Response.json({
      file_base64: xlsxBase64,
      // il giorno italiano: fra mezzanotte e le due quello UTC e' ancora ieri
      filename: `Status_Target_${oggiRoma()}.xlsx`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}