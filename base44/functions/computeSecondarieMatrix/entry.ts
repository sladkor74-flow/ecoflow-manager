import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { giornoOrdine, eTerminato, periodoMovimento, settimanaIso, dateDaSistemare, MESI_MOVIMENTI as MESI } from "../../shared/movimenti.ts";
import { getRegioneFromProvincia } from "../../shared/dataEnrichment.ts";
import { riepilogoDateVista } from "../../shared/raccoltoCalculator.ts";
import { matchesFilter, matchesFilterString, matchesFilterLower } from "../../shared/multiFilter.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { canaleDi } from "../../shared/canaleSecondaria.ts";

// Calcola le matrici di aggregazione dei trasporti secondari per tratta.
// Payload: { filters: { canale?, stoccaggio?, destinazione?, mese?, settimana?, classe?, trasportatore?, anno?, date_da_sistemare? } }
//
// Rete e ACI sono canali indipendenti e nello stesso archivio. Ogni numero esce
// per canale: i KPI, i mesi, le classi, le tratte. Un totale unico c'e' solo
// quando la vista contiene un canale solo; con tutti e due il KPI principale
// sommava 141 viaggi di rete e 13 ACI in "154 viaggi" (2026).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const filters = body.filters || {};

    const all = await fetchAll(base44.asServiceRole.entities.Secondaria);

    // Giorno, anno, mese e settimana dalla fine del trasporto, sul giorno
    // italiano: mai i campi mese e settimane salvati sul record, che possono
    // venire da importazioni vecchie, quando il riferimento era la chiusura a
    // portale. Un ordine che il trasporto non l'ha ancora fatto (assegnato,
    // cancellato), e che si vede solo filtrando per stato, non e' un movimento e
    // si colloca all'immissione come negli elenchi. Un terminato senza fine
    // trasporto non ha un periodo (null): nessun filtro di periodo lo prende,
    // resta fuori dai conti e si segnala. Anche anno e giorno passano di qui:
    // annoOrdine e giornoOrdine, per lui, ripiegavano sull'immissione.
    // La stessa regola sta in exportSecondarie e nella pagina Secondarie.jsx:
    // schermo e file devono dire gli stessi numeri.
    const periodi = new Map();
    const periodoDi = (r) => {
      if (periodi.has(r)) return periodi.get(r);
      let p = null;
      const pm = periodoMovimento(r);
      if (pm) p = { giorno: pm.giorno, anno: pm.anno, mese: pm.mese, settimana: pm.settimana };
      else if (!eTerminato(r)) {
        const g = giornoOrdine(r);
        p = g
          ? { giorno: g, anno: Number(g.slice(0, 4)), mese: MESI[Number(g.slice(5, 7)) - 1], settimana: settimanaIso(g) }
          : { giorno: '', anno: null, mese: 'N/D', settimana: 'N/D' };
      }
      periodi.set(r, p);
      return p;
    };
    const canaleRiga = (r) => (canaleDi(r) === 'ACI' ? 'ACI' : 'Rete');

    // I filtri si dividono in due: quelli di periodo leggono periodoDi, gli altri
    // il record. Servono separati per segnalare i terminati senza fine trasporto
    // anche quando si guarda un mese: nessun filtro di periodo li prenderebbe, e
    // con un mese scelto il conteggio restava sempre a zero.
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
      // Il filtro "date da sistemare" della pagina (regola dell'utente,
      // 22/09/2026): solo i terminati con una data obbligatoria che manca o non
      // torna. Non e' un filtro di periodo: i senza fine trasporto li prende.
      if (filters.date_da_sistemare && !dateDaSistemare(r)) return false;
      return true;
    };
    const conAnno = filters.anno != null && (!Array.isArray(filters.anno) ? !!filters.anno : filters.anno.length > 0);
    const passaPeriodo = (r) => {
      const p = periodoDi(r);
      if (!matchesFilter(p ? p.mese : 'N/D', filters.mese)) return false;
      if (!matchesFilterString(p ? p.settimana : 'N/D', filters.settimana)) return false;
      if (filters.data && (!p || p.giorno !== filters.data)) return false;
      if (conAnno && (!p || p.anno == null || !matchesFilterString(p.anno, filters.anno))) return false;
      return true;
    };

    // KPI
    // I conteggi e la matrice parlano di trasporti fatti: senza un filtro sullo stato
    // contano solo i terminati. Prima entravano anche i cancellati, e il numero dei
    // trasporti secondari non tornava con nessun altro modulo.
    const conStato = Array.isArray(filters.stato) ? filters.stato.length > 0 : !!filters.stato;
    const scelti = all.filter(r => passaAltri(r) && (conStato || eTerminato(r)));
    const senzaFineTrasporto = scelti.filter(r => periodoDi(r) === null);
    const filtered = scelti.filter(r => periodoDi(r) !== null && passaPeriodo(r));

    const perCanale = new Map(); // canale -> { ordini, peso_kg, quantita, tratte }
    const byMese: Record<string, any> = {};
    const byClasse: Record<string, any> = {};
    const byTratta: Record<string, any> = {};

    for (const r of filtered) {
      const peso = r.peso_effettivo || 0;
      const quant = r.quantita_ritirata || 0;
      // La tratta, il mese e la classe sono per canale: una riga non somma mai
      // rete e autodemolizione.
      const canale = canaleRiga(r);
      const origine = (r.stoccaggio || 'N/D').trim();
      const dest = (r.destinazione || 'N/D').trim();
      const trattaKey = `${canale} | ${origine} -> ${dest}`;

      if (!perCanale.has(canale)) perCanale.set(canale, { canale, ordini: 0, peso_kg: 0, quantita: 0, tratte: new Set() });
      const c = perCanale.get(canale);
      c.ordini++;
      c.peso_kg += peso;
      c.quantita += quant;
      c.tratte.add(trattaKey);

      const mese = periodoDi(r).mese;
      const meseKey = `${canale}|${mese}`;
      if (!byMese[meseKey]) byMese[meseKey] = { canale, mese, ordini: 0, peso_kg: 0, quantita: 0 };
      byMese[meseKey].ordini++;
      byMese[meseKey].peso_kg += peso;
      byMese[meseKey].quantita += quant;

      const classe = r.classe || 'N/D';
      const classeKey = `${canale}|${classe}`;
      if (!byClasse[classeKey]) byClasse[classeKey] = { canale, classe, ordini: 0, peso_kg: 0, quantita: 0 };
      byClasse[classeKey].ordini++;
      byClasse[classeKey].peso_kg += peso;
      byClasse[classeKey].quantita += quant;

      if (!byTratta[trattaKey]) {
        byTratta[trattaKey] = { canale, origine, destinazione: dest, ordini: 0, peso_kg: 0, quantita: 0, trasportatore: r.trasportatore || '', partner: r.partner_operativo || '' };
      }
      byTratta[trattaKey].ordini++;
      byTratta[trattaKey].peso_kg += peso;
      byTratta[trattaKey].quantita += quant;
    }

    // Matrice dettagliata per tratta -> mese -> classe. Le classi di un mese
    // stanno dentro quel mese: erano accumulate sull'intera tratta, e aprendo
    // "Agosto" si vedevano le classi di tutti i mesi, con ordini e tonnellate
    // maggiori del mese stesso. m.classi resta come sintesi della tratta.
    const matrix: Record<string, any> = {};
    const aggiungi = (acc: Record<string, any>, chiave: string, r: any) => {
      if (!acc[chiave]) acc[chiave] = { ordini: 0, peso_kg: 0, quantita: 0 };
      acc[chiave].ordini++;
      acc[chiave].peso_kg += (r.peso_effettivo || 0);
      acc[chiave].quantita += (r.quantita_ritirata || 0);
      return acc[chiave];
    };
    for (const r of filtered) {
      const origine = (r.stoccaggio || 'N/D').trim();
      const dest = (r.destinazione || 'N/D').trim();
      const canale = canaleRiga(r);
      const trattaKey = `${canale} | ${origine} -> ${dest}`;
      const { mese, settimana } = periodoDi(r);
      const classe = r.classe || 'N/D';

      if (!matrix[trattaKey]) matrix[trattaKey] = { canale, origine, destinazione: dest, mesi: {}, classi: {}, settimane: {} };
      const m = matrix[trattaKey];
      const delMese = aggiungi(m.mesi, mese, r);
      if (!delMese.classi) delMese.classi = {};
      aggiungi(delMese.classi, classe, r);
      aggiungi(m.classi, classe, r);
      aggiungi(m.settimane, String(settimana), r);
    }
    // I mesi in ordine di calendario, non nell'ordine in cui arrivano i record;
    // le classi in ordine alfabetico, cosi' due mesi si leggono uno sotto l'altro.
    const ordineMese = (a: string, b: string) => (MESI.indexOf(a) + 1 || 99) - (MESI.indexOf(b) + 1 || 99);
    const perNome = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b, 'it')));
    for (const m of Object.values(matrix)) {
      m.mesi = Object.fromEntries(Object.entries(m.mesi).sort(([a], [b]) => ordineMese(a, b)));
      for (const x of Object.values(m.mesi) as any[]) x.classi = perNome(x.classi);
      m.classi = perNome(m.classi);
    }

    // Un KPI per canale. Il totale unico si restituisce solo quando la vista ha
    // un canale solo: con rete e ACI insieme i campi restano vuoti e i numeri
    // stanno in "canali".
    const canali = ['Rete', 'ACI'].filter(c => perCanale.has(c)).map(c => {
      const x = perCanale.get(c);
      return { canale: c, ordini: x.ordini, peso_kg: x.peso_kg, quantita: x.quantita, tratte: x.tratte.size };
    });
    const unico = canali.length === 1 ? canali[0] : null;
    // Terminati senza fine trasporto: fuori dai conti, ma si dicono, e anche loro
    // per canale. Il numero unico resta solo quando riguardano un canale solo:
    // con rete e ACI insieme sarebbe un conteggio che somma le due commesse.
    const senzaFinePerCanale: Record<string, number> = {};
    for (const r of senzaFineTrasporto) {
      const c = canaleRiga(r);
      senzaFinePerCanale[c] = (senzaFinePerCanale[c] || 0) + 1;
    }
    const canaliSenzaFine = Object.keys(senzaFinePerCanale);
    // Le date da sistemare (regola dell'utente, 22/09/2026: immissione, inizio e
    // fine trasporto sono obbligatorie in ogni formulario terminato), un canale
    // per volta e solo per chi ne ha: i senza fine trasporto qui sopra, fuori dai
    // conti, e i trasporti contati nella vista con un'altra data che manca o non
    // torna, che nei conti ci sono.
    const dateDaSistemarePerCanale: Record<string, any> = {};
    for (const c of ['Rete', 'ACI']) {
      const delCanale = (righe) => righe.filter(r => canaleRiga(r) === c);
      const riep = riepilogoDateVista(delCanale(senzaFineTrasporto), delCanale(filtered), 50);
      if (riep.totale > 0) dateDaSistemarePerCanale[c] = riep;
    }
    const kpi = {
      canale: unico ? unico.canale : null,
      canali_separati: canali.length > 1,
      total_orders: unico ? unico.ordini : canali.length ? null : 0,
      total_ton: unico ? unico.peso_kg / 1000 : canali.length ? null : 0,
      total_quantita: unico ? unico.quantita : canali.length ? null : 0,
      tratte: unico ? unico.tratte : canali.length ? null : 0,
      senza_fine_trasporto: canaliSenzaFine.length > 1 ? null : senzaFineTrasporto.length,
      senza_fine_trasporto_per_canale: senzaFinePerCanale,
      date_da_sistemare_per_canale: dateDaSistemarePerCanale,
    };

    // Opzioni filtri. Anni, mesi e settimane vengono da periodoDi, come i filtri
    // che li confrontano.
    const filterOptions = {
      stoccaggi: [...new Set(all.map(r => (r.stoccaggio || '').trim()).filter(Boolean))].sort(),
      destinazioni: [...new Set(all.map(r => (r.destinazione || '').trim()).filter(Boolean))].sort(),
      mesi: MESI.filter(m => all.some(r => periodoDi(r)?.mese === m)),
      settimane: [...new Set(all.map(r => periodoDi(r)?.settimana).filter((s: any) => typeof s === 'number'))].sort((a: any, b: any) => a - b),
      classi: [...new Set(all.map(r => r.classe).filter(Boolean))].sort(),
      trasportatori: [...new Set(all.map(r => (r.trasportatore || '').trim()).filter(Boolean))].sort(),
      province: [...new Set(all.map(r => (r.provincia || '').trim()).filter(Boolean))].sort(),
      regioni: [...new Set(all.map(r => (r.regione || getRegioneFromProvincia(r.provincia) || '').trim()).filter(Boolean))].sort(),
      stati: [...new Set(all.map(r => (r.stato || '').trim()).filter(Boolean))].sort(),
      canali: ['Rete', 'ACI'].filter(c => all.some(r => canaleRiga(r) === c)),
      anni: [...new Set(all.map(r => periodoDi(r)?.anno).filter(Boolean))].sort((a: any, b: any) => b - a),
    };

    return Response.json({
      kpi,
      byMese: Object.values(byMese).sort((a: any, b: any) => a.canale.localeCompare(b.canale) || ordineMese(a.mese, b.mese)),
      byClasse: Object.values(byClasse).sort((a: any, b: any) => a.canale.localeCompare(b.canale) || a.classe.localeCompare(b.classe, 'it')),
      byTratta: Object.values(byTratta).sort((a: any, b: any) => b.peso_kg - a.peso_kg),
      matrix: Object.values(matrix),
      canali,
      // I primi 50, raggruppati per canale: la pagina li elenca sotto l'avviso.
      senza_fine_trasporto: [...senzaFineTrasporto]
        .sort((a, b) => canaleRiga(b).localeCompare(canaleRiga(a)) || String(a.id_ordine || '').localeCompare(String(b.id_ordine || '')))
        .slice(0, 50)
        .map(r => ({ id_ordine: r.id_ordine || '', numero_fir: r.numero_fir || '', stoccaggio: r.stoccaggio || '', destinazione: r.destinazione || '', canale: canaleRiga(r) })),
      filterOptions,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
