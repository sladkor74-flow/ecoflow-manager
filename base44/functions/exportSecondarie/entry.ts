import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { giornoOrdine, periodoMovimento, settimanaIso, eTerminato, dateDaSistemare, testoDate, MESI_MOVIMENTI as MESI } from "../../shared/movimenti.ts";
import { giornoRoma, oggiRoma } from "../../shared/giornoItaliano.ts";
import { getRegioneFromProvincia } from "../../shared/dataEnrichment.ts";
import { formattaPesi } from "../../shared/formatoExcel.ts";
import * as XLSX from 'npm:xlsx@0.18.5';
import { matchesFilter, matchesFilterString, matchesFilterLower } from "../../shared/multiFilter.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { canaleDi } from "../../shared/canaleSecondaria.ts";

// Esporta i dati Secondarie (dettaglio o matrice per tratta) in Excel.
// Payload: { filters: {...}, mode: 'detail' | 'matrix' }
//
// Rete e ACI sono canali indipendenti: il filtro del modulo vale anche qui, e
// nessuna riga di sintesi somma mai i due canali - la tratta e la classe sono per
// canale e la colonna Canale c'e' sempre.
//
// La data che conta e' la fine del trasporto, sul giorno italiano: e' la prima
// colonna di date del dettaglio, e mese e settimana si leggono da li'
// (movimenti.ts), non dai campi salvati sul record. La chiusura a portale resta
// in fondo, solo come informazione.
//
// Immissione, inizio e fine trasporto sono obbligatorie in ogni formulario
// terminato (regola dell'utente, 22/09/2026): il dettaglio ha la colonna "Date da
// sistemare" (testoDate di movimenti.ts), la sintesi un foglio con i trasporti da
// correggere, e il filtro "date da sistemare" della pagina vale anche qui.

// Il giorno italiano come 'GG/MM/AAAA'. toLocaleDateString sul server (UTC)
// scriveva il giorno prima per le date salvate a mezzanotte italiana.
const dataIt = (v) => { const g = giornoRoma(v); return g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : ''; };

const SENZA_FINE = 'MANCA FINE TRASPORTO';

// Il periodo di una secondaria, con la stessa regola di computeSecondarieMatrix:
// un terminato si colloca solo sulla fine del trasporto (giorno italiano); un
// ordine non terminato, che non e' un movimento, all'immissione; un terminato
// senza fine trasporto non ha periodo (null). meseOrdine e giornoOrdine per lui
// ripiegavano sull'immissione: entrava nelle sintesi del mese di immissione
// mentre la matrice a video lo escludeva, e il file non tornava con lo schermo.
function periodoDi(r) {
  const pm = periodoMovimento(r);
  if (pm) return { giorno: pm.giorno, anno: pm.anno, mese: pm.mese, settimana: pm.settimana };
  if (eTerminato(r)) return null;
  const g = giornoOrdine(r);
  return g
    ? { giorno: g, anno: Number(g.slice(0, 4)), mese: MESI[Number(g.slice(5, 7)) - 1], settimana: settimanaIso(g) }
    : { giorno: '', anno: null, mese: 'N/D', settimana: 'N/D' };
}

const canaleRiga = (r) => (canaleDi(r) === 'ACI' ? 'ACI' : 'Rete');

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const filters = body.filters || {};
    const mode = body.mode || 'detail';

    const all = await fetchAll(base44.asServiceRole.entities.Secondaria);
    const periodi = new Map(all.map(r => [r, periodoDi(r)]));

    // Gli stessi filtri della pagina (Secondarie.jsx e computeSecondarieMatrix):
    // prima provincia, regione, stato e giorno si perdevano, e il file diceva
    // un'altra cosa rispetto allo schermo. Quelli di periodo leggono periodoDi e
    // non prendono mai un terminato senza fine trasporto.
    const passaAltri = (r) => {
      if (!matchesFilter(canaleRiga(r), filters.canale)) return false;
      if (!matchesFilter((r.stoccaggio || '').trim(), filters.stoccaggio)) return false;
      if (!matchesFilter((r.destinazione || '').trim(), filters.destinazione)) return false;
      if (!matchesFilter(r.classe, filters.classe)) return false;
      if (!matchesFilter((r.trasportatore || '').trim(), filters.trasportatore)) return false;
      if (!matchesFilter((r.provincia || '').trim(), filters.provincia)) return false;
      if (filters.regione != null && (!Array.isArray(filters.regione) ? filters.regione : filters.regione.length > 0)) {
        const reg = r.regione || getRegioneFromProvincia(r.provincia);
        if (!matchesFilter((reg || '').trim(), filters.regione)) return false;
      }
      if (!matchesFilterLower(r.stato, filters.stato)) return false;
      if (filters.date_da_sistemare && !dateDaSistemare(r)) return false;
      return true;
    };
    const conAnno = filters.anno != null && (!Array.isArray(filters.anno) ? !!filters.anno : filters.anno.length > 0);
    const passaPeriodo = (r) => {
      const p = periodi.get(r);
      if (!matchesFilter(p ? p.mese : 'N/D', filters.mese)) return false;
      if (!matchesFilterString(p ? p.settimana : 'N/D', filters.settimana)) return false;
      if (filters.data && (!p || p.giorno !== filters.data)) return false;
      if (conAnno && (!p || p.anno == null || !matchesFilterString(p.anno, filters.anno))) return false;
      return true;
    };
    // Con il filtro "date da sistemare" il dettaglio tiene anche i terminati senza
    // fine trasporto quando un filtro di periodo e' attivo, come la pagina: sono
    // proprio quelli da correggere, e un periodo non l'hanno.
    const filtered = all.filter(r => passaAltri(r) && (passaPeriodo(r) || (filters.date_da_sistemare && periodi.get(r) === null)));

    const wb = XLSX.utils.book_new();
    // Righe e terminati senza fine trasporto si contano per canale, mai insieme.
    const perCanale = (righe) => {
      const n: Record<string, number> = {};
      for (const r of righe) n[canaleRiga(r)] = (n[canaleRiga(r)] || 0) + 1;
      return n;
    };
    let senzaFineTrasporto: any[] = [];
    let daSistemare: any[] = [];
    let contati = filtered;

    if (mode === 'matrix') {
      // Le sintesi parlano di trasporti fatti: senza un filtro sullo stato contano
      // solo i terminati, come la matrice a video. Prima entravano anche i
      // cancellati. Un terminato senza fine trasporto non ha un mese: resta fuori
      // dalle sintesi e ha un foglio suo, come l'avviso sotto i KPI della pagina,
      // che lo conta anche quando si guarda un mese.
      const conStato = Array.isArray(filters.stato) ? filters.stato.length > 0 : !!filters.stato;
      const scelti = all.filter(r => passaAltri(r) && (conStato || eTerminato(r)));
      senzaFineTrasporto = scelti.filter(r => periodi.get(r) === null);
      const fatti = scelti.filter(r => periodi.get(r) !== null && passaPeriodo(r));
      contati = fatti;

      // Foglio: sintesi per tratta. Le tonnellate si ricavano dai kg alla fine,
      // non sommando frazioni riga per riga.
      const trattaMap: Record<string, any> = {};
      for (const r of fatti) {
        const origine = (r.stoccaggio || 'N/D').trim();
        const dest = (r.destinazione || 'N/D').trim();
        const canale = canaleRiga(r);
        const key = `${canale}|${origine}|${dest}`;
        if (!trattaMap[key]) trattaMap[key] = { 'Canale': canale, 'Stoccaggio Origine': origine, 'Impianto Destinazione': dest, 'N. Ordini': 0, 'Peso (kg)': 0, 'Peso (t)': 0, 'Quantità': 0, 'Trasportatore': r.trasportatore || '', 'Partner Operativo': r.partner_operativo || '' };
        trattaMap[key]['N. Ordini']++;
        trattaMap[key]['Peso (kg)'] += (r.peso_effettivo || 0);
        trattaMap[key]['Quantità'] += (r.quantita_ritirata || 0);
      }
      const tratte = Object.values(trattaMap).map(x => ({ ...x, 'Peso (t)': x['Peso (kg)'] / 1000 }));
      const wsTratte = XLSX.utils.json_to_sheet(tratte);
      XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, wsTratte), 'Sintesi per Tratta');

      // Foglio: sintesi per classe, per canale. La chiave era la sola classe e il
      // canale quello del primo record: una classe presente su rete e ACI finiva
      // sommata in una riga sola.
      const classeMap: Record<string, any> = {};
      for (const r of fatti) {
        const c = r.classe || 'N/D';
        const canale = canaleRiga(r);
        const key = `${canale}|${c}`;
        if (!classeMap[key]) classeMap[key] = { 'Canale': canale, 'Classe PFU': c, 'N. Ordini': 0, 'Peso (kg)': 0, 'Peso (t)': 0, 'Quantità': 0 };
        classeMap[key]['N. Ordini']++;
        classeMap[key]['Peso (kg)'] += (r.peso_effettivo || 0);
        classeMap[key]['Quantità'] += (r.quantita_ritirata || 0);
      }
      const classi = Object.values(classeMap).map(x => ({ ...x, 'Peso (t)': x['Peso (kg)'] / 1000 }));
      const wsClassi = XLSX.utils.json_to_sheet(classi);
      XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, wsClassi), 'Sintesi per Classe');

      // Il foglio dei trasporti da correggere: i terminati senza fine trasporto,
      // fuori dalle sintesi, e quelli nelle sintesi con un'altra data che manca o
      // non torna (regola del 22/09/2026). Si chiamava "Senza fine trasporto" e
      // aveva solo i primi. Canale per canale, rete prima.
      daSistemare = [...senzaFineTrasporto, ...fatti.filter(dateDaSistemare)]
        .sort((a, b) => canaleRiga(b).localeCompare(canaleRiga(a)));
      if (daSistemare.length > 0) {
        const wsDate = XLSX.utils.json_to_sheet(daSistemare.map(r => {
          const senza = periodi.get(r) === null;
          return {
            'Canale': canaleRiga(r),
            'ID Ordine': r.id_ordine,
            'Stato': r.stato,
            'Numero FIR': r.numero_fir,
            'Stoccaggio Origine': r.stoccaggio,
            'Destinazione': r.destinazione,
            'Classe PFU': r.classe,
            'Peso Effettivo (kg)': r.peso_effettivo,
            'Ordine Immesso': dataIt(r.ordine_immesso_il),
            'Trasporto Iniziato': dataIt(r.trasporto_iniziato_il),
            'Trasporto Finito': dataIt(r.trasporto_finito_il),
            'Date da sistemare': testoDate(r),
            'Nota': senza
              ? 'Senza fine trasporto non ha un mese: escluso dalle sintesi. Va corretto nel file del portale e ricaricato.'
              : 'Nelle sintesi, nel mese della fine trasporto. Va corretto nel file del portale e ricaricato.',
          };
        }));
        XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, wsDate), 'Date da sistemare');
      }
    } else {
      // Nel dettaglio un terminato senza fine trasporto c'e' (se nessun filtro
      // di periodo e' attivo), marcato, e si conta nella risposta. L'ordine e'
      // quello della tabella a video: prima le righe senza un giorno, che vanno
      // corrette, poi dal giorno piu' recente.
      senzaFineTrasporto = filtered.filter(r => periodi.get(r) === null);
      daSistemare = filtered.filter(dateDaSistemare);
      const giornoDi = (r) => periodi.get(r)?.giorno || '';
      const ordinati = [...filtered].sort((a, b) => {
        const ga = giornoDi(a), gb = giornoDi(b);
        if (!ga || !gb) return (ga ? 1 : 0) - (gb ? 1 : 0);
        return gb.localeCompare(ga);
      });
      const rows = ordinati.map(r => {
        const p = periodi.get(r);
        return {
          'ID Ordine': r.id_ordine,
          'Stato': r.stato,
          'Trasporto Finito': dataIt(r.trasporto_finito_il),
          'Ordine Immesso': dataIt(r.ordine_immesso_il),
          'Stoccaggio Origine': r.stoccaggio,
          'Destinazione': r.destinazione,
          'Tipo Destinazione': r.tipo_destinazione,
          'Comune': r.comune,
          'Provincia': r.provincia,
          'Canale': canaleRiga(r),
          'Classe PFU': r.classe,
          'CER': r.cer,
          'Quantità Ritirata': r.quantita_ritirata,
          'Peso Stimato (kg)': r.peso_stimato,
          'Peso Effettivo (kg)': r.peso_effettivo,
          'Peso (t)': (r.peso_effettivo || 0) / 1000,
          // Un terminato senza fine trasporto non ha mese ne' settimana: si
          // scrive, invece di collocarlo all'immissione.
          'Mese': p ? (p.mese === 'N/D' ? '' : p.mese) : SENZA_FINE,
          'Settimana': p && typeof p.settimana === 'number' ? p.settimana : '',
          'Trasportatore': r.trasportatore,
          'Partner Operativo': r.partner_operativo,
          'Fatturato Trasporto': r.fatturato_trasporto,
          'Fatturato Riciclo': r.fatturato_riciclo,
          'Numero FIR': r.numero_fir,
          // quale data obbligatoria manca o non torna; vuota se sono a posto
          'Date da sistemare': testoDate(r),
          // solo informazione: non decide mese, settimana ne' filtri
          'Ordine Chiuso': dataIt(r.ordine_chiuso_il),
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws), 'Dettaglio Secondarie');
    }

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    // Il nome porta il giorno italiano (fra mezzanotte e le due il giorno UTC e'
    // ancora ieri) e il canale, quando il file ne contiene uno solo.
    const canaliFiltro = Array.isArray(filters.canale) ? filters.canale : filters.canale ? [filters.canale] : [];
    const nomeCanale = canaliFiltro.length === 1 ? `_${String(canaliFiltro[0]).toLowerCase()}` : '';
    return Response.json({
      file_base64: buf,
      filename: `secondarie_${mode}${nomeCanale}_${oggiRoma()}.xlsx`,
      righe_per_canale: perCanale(contati),
      senza_fine_trasporto_per_canale: perCanale(senzaFineTrasporto),
      date_da_sistemare_per_canale: perCanale(daSistemare),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
