import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { formattaPesi } from "../../shared/formatoExcel.ts";
import * as XLSX from 'npm:xlsx@0.18.5';
import { computeRaccoltoData, MESI } from "../../shared/raccoltoCalculator.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { righeAndamento } from "../../shared/andamentoTarget.ts";

// Esporta i dati di Status & Target in un file Excel (3 fogli: Raccoglitori, Regioni, Impianti;
// un quarto, Date da sistemare, quando qualche terminato di rete ne ha).
//
// IL FILE DICE GLI STESSI NUMERI DELLA PAGINA (chiusura dell'audit, 11/10/2026).
// Il foglio Raccoglitori si costruisce dalle stesse righe dell'Andamento
// (righeAndamento, shared/andamentoTarget.ts). Prima scorreva solo il raccolto e
// cercava il target per nome esatto: i target senza raccolto nell'anno (il 2
// gennaio quasi tutti) e quelli scritti abbreviati non c'erano, e con 1.800 t di
// target il file ne mostrava 1.000. Il foglio Impianti ha solo le primarie RETE
// ricevute: le colonne del target mensile per impianto (ImpiantoTarget, che
// nessuno ha mai scritto) erano sempre zero con un delta che sembrava un avanzo.
// Payload: { anno? } (l'anno scelto in Target & Status; senza, quello in corso)
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

    // 2. I target dell'anno da Target & Status, tutti (prima a una pagina sola),
    //    come li legge la pagina
    const [mensili, annui] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.TargetMensile, { anno }),
      fetchAll(base44.asServiceRole.entities.TargetRaccoglitore, { anno }),
    ]);

    // 3. Foglio Raccoglitori: le righe dell'Andamento, anche quelle col target e
    //    senza raccolto. Il residuo e' target annuo meno raccolto (negativo:
    //    target superato), il delta del mese target meno raccolto. Le tonnellate
    //    restano al chilo e le formatta formattaPesi, che riconosce le colonne
    //    da «(t)» nell'intestazione: con «[t]» non le riconosceva, e il file
    //    usciva coi decimali grezzi.
    const t3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
    const raccoglitoriRows = [["Regione", "Raccoglitore", "Target annuo (t)", "Raccolto RETE (t)", "Residuo dell'anno (t)",
      ...MESI.flatMap(m => [`${m} target (t)`, `${m} raccolto (t)`, `${m} Δ (t)`])]];
    for (const r of righeAndamento({ mensili, annui, raccolto: raccolto.by_raccoglitore })) {
      const row = [r.regione, r.raccoglitore, t3(r.targetAnnuo), t3(r.raccoltoTotale), t3(r.leftover)];
      for (const m of r.mesi) row.push(t3(m.target), t3(m.raccolto), t3(m.delta));
      raccoglitoriRows.push(row);
    }

    // 4. Foglio Regioni
    const regioniRows = [["Regione", "Raccolto RETE (t)", ...MESI.map(m => `${m} (t)`)]];
    for (const r of raccolto.by_regione) {
      const row = [r.regione, t3(r.totale)];
      for (const m of MESI) row.push(t3(r.mesi[m]));
      regioniRows.push(row);
    }

    // 5. Foglio Impianti: le primarie RETE ricevute, mese per mese. Non e' il
    //    «Conferito RETE» delle Giacenze, che somma anche le secondarie in
    //    arrivo, e il target dell'impianto si confronta li'.
    const impiantiRows = [["Impianto", "Primarie RETE ricevute (t)", ...MESI.map(m => `${m} (t)`)]];
    for (const i of raccolto.by_impianto) {
      const row = [i.impianto, t3(i.totale)];
      for (const m of MESI) row.push(t3(i.mesi[m]));
      impiantiRows.push(row);
    }

    // 6. Genera workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, XLSX.utils.aoa_to_sheet(raccoglitoriRows)), "Raccoglitori");
    XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, XLSX.utils.aoa_to_sheet(regioniRows)), "Regioni");
    XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, XLSX.utils.aoa_to_sheet(impiantiRows)), "Impianti");

    // 7. Le date da sistemare (regola dell'utente, 22/09/2026): immissione, inizio
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
      filename: `Status_Target_${anno}_${oggiRoma()}.xlsx`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}