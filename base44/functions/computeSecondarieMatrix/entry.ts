import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { annoOrdine, giornoOrdine, eTerminato, periodoMovimento, settimanaIso } from "../../shared/movimenti.ts";
import { MESI } from "../../shared/raccoltoCalculator.ts";
import { getRegioneFromProvincia } from "../../shared/dataEnrichment.ts";
import { matchesFilter, matchesFilterString, matchesFilterLower } from "../../shared/multiFilter.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { canaleDi } from "../../shared/canaleSecondaria.ts";

// Calcola le matrici di aggregazione dei trasporti secondari per tratta.
// Payload: { filters: { canale?, stoccaggio?, destinazione?, mese?, settimana?, classe?, trasportatore?, anno? } }
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

    // Mese e settimana dalla fine del trasporto, sul giorno italiano: mai i campi
    // mese e settimane salvati sul record, che possono venire da importazioni
    // vecchie, quando il riferimento era la chiusura a portale. Un ordine che il
    // trasporto non l'ha ancora fatto (assegnato, cancellato), e che si vede solo
    // filtrando per stato, si colloca all'immissione come negli elenchi. Un
    // terminato senza fine trasporto non ha un periodo: si esclude e si segnala.
    const periodi = new Map();
    const periodoDi = (r) => {
      if (periodi.has(r)) return periodi.get(r);
      let p = null;
      const pm = periodoMovimento(r);
      if (pm) p = { mese: pm.mese, settimana: pm.settimana };
      else if (!eTerminato(r)) {
        const g = giornoOrdine(r);
        p = g ? { mese: MESI[Number(g.slice(5, 7)) - 1], settimana: settimanaIso(g) } : { mese: 'N/D', settimana: 'N/D' };
      }
      periodi.set(r, p);
      return p;
    };
    const canaleRiga = (r) => (canaleDi(r) === 'ACI' ? 'ACI' : 'Rete');

    // Applica filtri (supporto multi-selezione via array)
    const filtrati = all.filter(r => {
      const p = periodoDi(r);
      if (!matchesFilter(canaleRiga(r), filters.canale)) return false;
      if (!matchesFilter((r.stoccaggio || '').trim(), filters.stoccaggio)) return false;
      if (!matchesFilter((r.destinazione || '').trim(), filters.destinazione)) return false;
      if (!matchesFilter(p ? p.mese : 'N/D', filters.mese)) return false;
      if (!matchesFilterString(p ? p.settimana : 'N/D', filters.settimana)) return false;
      if (!matchesFilter(r.classe, filters.classe)) return false;
      if (!matchesFilter((r.trasportatore || '').trim(), filters.trasportatore)) return false;
      if (!matchesFilter((r.provincia || '').trim(), filters.provincia)) return false;
      if (filters.regione != null && (!Array.isArray(filters.regione) ? filters.regione : filters.regione.length > 0)) {
        const reg = r.regione || getRegioneFromProvincia(r.provincia);
        if (!matchesFilter((reg || '').trim(), filters.regione)) return false;
      }
      if (!matchesFilterLower(r.stato, filters.stato)) return false;
      if (filters.data) {
        if (giornoOrdine(r) !== filters.data) return false;
      }
      if (filters.anno != null && (!Array.isArray(filters.anno) ? filters.anno : filters.anno.length > 0)) {
        const anno = annoOrdine(r);
        if (!matchesFilterString(anno, filters.anno)) return false;
      }
      return true;
    });

    // KPI
    // I conteggi e la matrice parlano di trasporti fatti: senza un filtro sullo stato
    // contano solo i terminati. Prima entravano anche i cancellati, e il numero dei
    // trasporti secondari non tornava con nessun altro modulo.
    const conStato = Array.isArray(filters.stato) ? filters.stato.length > 0 : !!filters.stato;
    const scelti = conStato ? filtrati : filtrati.filter(eTerminato);
    const senzaFineTrasporto = scelti.filter(r => periodoDi(r) === null);
    const filtered = scelti.filter(r => periodoDi(r) !== null);

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

    // Matrice dettagliata per tratta -> mese -> classe
    const matrix: Record<string, any> = {};
    for (const r of filtered) {
      const origine = (r.stoccaggio || 'N/D').trim();
      const dest = (r.destinazione || 'N/D').trim();
      const canale = canaleRiga(r);
      const trattaKey = `${canale} | ${origine} -> ${dest}`;
      const { mese, settimana } = periodoDi(r);
      const classe = r.classe || 'N/D';

      if (!matrix[trattaKey]) matrix[trattaKey] = { canale, origine, destinazione: dest, mesi: {}, classi: {}, settimane: {} };
      const m = matrix[trattaKey];
      if (!m.mesi[mese]) m.mesi[mese] = { ordini: 0, peso_kg: 0, quantita: 0 };
      m.mesi[mese].ordini++;
      m.mesi[mese].peso_kg += (r.peso_effettivo || 0);
      m.mesi[mese].quantita += (r.quantita_ritirata || 0);

      if (!m.classi[classe]) m.classi[classe] = { ordini: 0, peso_kg: 0, quantita: 0 };
      m.classi[classe].ordini++;
      m.classi[classe].peso_kg += (r.peso_effettivo || 0);
      m.classi[classe].quantita += (r.quantita_ritirata || 0);

      const settKey = String(settimana);
      if (!m.settimane[settKey]) m.settimane[settKey] = { ordini: 0, peso_kg: 0, quantita: 0 };
      m.settimane[settKey].ordini++;
      m.settimane[settKey].peso_kg += (r.peso_effettivo || 0);
      m.settimane[settKey].quantita += (r.quantita_ritirata || 0);
    }
    // I mesi in ordine di calendario, non nell'ordine in cui arrivano i record.
    const ordineMese = (a: string, b: string) => (MESI.indexOf(a) + 1 || 99) - (MESI.indexOf(b) + 1 || 99);
    for (const m of Object.values(matrix)) {
      m.mesi = Object.fromEntries(Object.entries(m.mesi).sort(([a], [b]) => ordineMese(a, b)));
    }

    // Un KPI per canale. Il totale unico si restituisce solo quando la vista ha
    // un canale solo: con rete e ACI insieme i campi restano vuoti e i numeri
    // stanno in "canali".
    const canali = ['Rete', 'ACI'].filter(c => perCanale.has(c)).map(c => {
      const x = perCanale.get(c);
      return { canale: c, ordini: x.ordini, peso_kg: x.peso_kg, quantita: x.quantita, tratte: x.tratte.size };
    });
    const unico = canali.length === 1 ? canali[0] : null;
    const kpi = {
      canale: unico ? unico.canale : null,
      canali_separati: canali.length > 1,
      total_orders: unico ? unico.ordini : canali.length ? null : 0,
      total_ton: unico ? unico.peso_kg / 1000 : canali.length ? null : 0,
      total_quantita: unico ? unico.quantita : canali.length ? null : 0,
      tratte: unico ? unico.tratte : canali.length ? null : 0,
      // Terminati senza fine trasporto: fuori dai conti, ma si dicono.
      senza_fine_trasporto: senzaFineTrasporto.length,
    };

    // Opzioni filtri
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
      anni: [...new Set(all.map(r => {
        return annoOrdine(r);
      }).filter(Boolean))].sort((a: any, b: any) => b - a),
    };

    return Response.json({
      kpi,
      byMese: Object.values(byMese).sort((a: any, b: any) => a.canale.localeCompare(b.canale) || ordineMese(a.mese, b.mese)),
      byClasse: Object.values(byClasse),
      byTratta: Object.values(byTratta).sort((a: any, b: any) => b.peso_kg - a.peso_kg),
      matrix: Object.values(matrix),
      canali,
      senza_fine_trasporto: senzaFineTrasporto.slice(0, 50).map(r => ({ id_ordine: r.id_ordine || '', numero_fir: r.numero_fir || '', stoccaggio: r.stoccaggio || '', destinazione: r.destinazione || '', canale: canaleRiga(r) })),
      filterOptions,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
