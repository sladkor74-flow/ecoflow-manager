import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { eTerminato, giornoMovimento, giornoElenco, annoElenco, meseElenco, dateDaSistemare, testoDate } from "../../shared/movimenti.ts";
import { formattaPesi } from "../../shared/formatoExcel.ts";
import * as XLSX from 'npm:xlsx@0.18.5';
import { matchesFilter, matchesFilterString } from "../../shared/multiFilter.ts";
import { getRegioneFromProvincia } from "../../shared/dataEnrichment.ts";
import { fetchAll } from "../../shared/fetchAll.ts";

// Esporta i dati terziarie filtrati in Excel.
// Payload: { filters: { impianto?, destinazione?, mese?, trasportatore?, materiale?, anno?, data?, date_da_sistemare? } }
//
// Giorno, mese e anno come nella pagina Terziarie.jsx (giornoElenco): la fine del
// trasporto; per un ordine non terminato, l'immissione. Un terminato senza fine
// trasporto non ha periodo: meseOrdine e annoOrdine lo mettevano nel mese di
// immissione. Nessun filtro di periodo lo prende; nel file c'e' solo senza
// filtri di periodo, marcato nella colonna Mese, e la risposta lo conta.
//
// Immissione, inizio e fine trasporto sono obbligatorie in ogni formulario
// terminato (regola dell'utente, 22/09/2026): la colonna "Date da sistemare" dice
// quale manca o non torna (testoDate di movimenti.ts), e il filtro "date da
// sistemare" della pagina vale anche qui. Con quel filtro i senza fine trasporto
// ci sono anche con un filtro di periodo attivo: sono proprio quelli da
// correggere, e un periodo non l'hanno. Schermo e file dicono le stesse righe.
const SENZA_FINE = 'MANCA FINE TRASPORTO';
const senzaFineTrasporto = (r) => eTerminato(r) && !giornoMovimento(r);

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const filters = body.filters || {};

    const records = await fetchAll(base44.asServiceRole.entities.Terziaria);

    function getMese(r) {
      return senzaFineTrasporto(r) ? SENZA_FINE : meseElenco(r);
    }
    function getMateriale(r) {
      if (r.peso_ciab_cipp) return 'CIAB/CIPP';
      if (r.ferro) return 'FERRO';
      return 'PFU SFUSO';
    }

    const pieno = (v) => v != null && (!Array.isArray(v) ? !!v : v.length > 0);
    // I filtri che non sono di periodo leggono il record, quelli di periodo
    // giornoElenco: separati come nella pagina.
    const passaAltri = (r) => {
      if (!matchesFilter((r.unita_locale_origine || '').trim(), filters.impianto)) return false;
      if (!matchesFilter((r.destinazione || '').trim(), filters.destinazione)) return false;
      if (!matchesFilter((r.trasportatore || '').trim(), filters.trasportatore)) return false;
      if (!matchesFilter(getMateriale(r), filters.materiale)) return false;
      if (pieno(filters.provincia) && !matchesFilter((r.provincia || '').trim(), filters.provincia)) return false;
      if (pieno(filters.regione)) {
        const reg = r.regione || getRegioneFromProvincia(r.provincia);
        if (!matchesFilter((reg || '').trim(), filters.regione)) return false;
      }
      if (pieno(filters.stato) && !matchesFilter((r.stato || '').trim(), filters.stato)) return false;
      if (filters.date_da_sistemare && !dateDaSistemare(r)) return false;
      return true;
    };
    const passaPeriodo = (r) => {
      if (!matchesFilter(meseElenco(r), filters.mese)) return false;
      if (filters.data && giornoElenco(r) !== filters.data) return false;
      if (pieno(filters.anno) && !matchesFilterString(annoElenco(r), filters.anno)) return false;
      return true;
    };
    const filtered = records.filter(r => passaAltri(r) && (passaPeriodo(r) || (filters.date_da_sistemare && senzaFineTrasporto(r))));

    const rows = filtered.map((r) => ({
      'ID Ordine': r.id_ordine,
      'Stato': r.stato,
      'Ordine immesso il': r.ordine_immesso_il,
      'Impianto Origine': r.unita_locale_origine,
      'Ragione Sociale': r.ragione_sociale,
      'Destinazione': r.destinazione,
      'Tipo Destinazione': r.tipo_destinazione,
      'Comune': r.comune,
      'Provincia': r.provincia,
      'CER': r.cer,
      'Quantita ritirata': r.quantita_ritirata,
      'Peso stimato (kg)': r.peso_stimato,
      'Peso effettivo (kg)': r.peso_effettivo,
      'Peso (t)': +((r.peso_effettivo || 0) / 1000).toFixed(3),
      'Materiale': getMateriale(r),
      'Mese': getMese(r),
      'Trasportatore': r.trasportatore,
      'Partner Operativo': r.partner_operativo,
      'Numero FIR': r.numero_fir,
      'Trasporto iniziato il': r.trasporto_iniziato_il,
      'Trasporto finito il': r.trasporto_finito_il,
      // quale data obbligatoria manca o non torna; vuota se sono a posto
      'Date da sistemare': testoDate(r),
      'Ordine chiuso il': r.ordine_chiuso_il,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws), 'Terziarie');

    const buf = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    return Response.json({
      file_base64: buf,
      filename: 'terziarie_export.xlsx',
      righe: rows.length,
      // le righe del file senza fine trasporto: marcate, fuori da ogni mese
      senza_fine_trasporto: filtered.filter(senzaFineTrasporto).length,
      // le righe del file con una data obbligatoria che manca o non torna
      date_da_sistemare: filtered.filter(dateDaSistemare).length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
