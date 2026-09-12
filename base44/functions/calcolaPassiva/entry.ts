import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from '../../shared/fetchAll.ts';
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';
import { getRegioneFromProvincia } from '../../shared/regioneMap.ts';

const MESI_MAP = {
  'gennaio': 0, 'febbraio': 1, 'marzo': 2, 'aprile': 3, 'maggio': 4, 'giugno': 5,
  'luglio': 6, 'agosto': 7, 'settembre': 8, 'ottobre': 9, 'novembre': 10, 'dicembre': 11
};

// ─── Helpers ───
function norm(s) { return String(s || '').trim().toUpperCase(); }
function isEmpty(s) { return !s || String(s).trim() === ''; }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function round3(n) { return Math.round((n + Number.EPSILON) * 1000) / 1000; }

function tariffaValidaPerData(t, dataIso) {
  if (!dataIso) return false;
  const dt = new Date(dataIso);
  if (isNaN(dt.getTime())) return false;
  const dtOnly = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  if (t.data_inizio_validita) {
    const di = new Date(t.data_inizio_validita);
    if (!isNaN(di.getTime()) && new Date(di.getFullYear(), di.getMonth(), di.getDate()).getTime() > dtOnly) return false;
  }
  if (t.data_fine_validita) {
    const df = new Date(t.data_fine_validita);
    if (!isNaN(df.getTime()) && new Date(df.getFullYear(), df.getMonth(), df.getDate()).getTime() < dtOnly) return false;
  }
  return true;
}

function isAciRow(r) {
  const c = String(r.classe || '').toLowerCase();
  if (c.includes('autodemolizione')) return true;
  const p = String(r.prodotto || '').toLowerCase();
  return p.includes('autodemolizione');
}

function getRegione(r) {
  return norm(r.regione || r.regioni) || getRegioneFromProvincia(r.provincia) || '';
}

function sortPerClasse(arr) {
  // piu' specifico (classe_materiale valorizzata) per primo
  return arr.sort((a, b) => (isEmpty(b.classe_materiale) ? 0 : 1) - (isEmpty(a.classe_materiale) ? 0 : 1));
}

// ─── Ricerca tariffe ───

// RACCOLTA: gerarchia destinazione > provincia > regione > generica
function findTariffaRaccolta(tariffe, trasKey, provincia, regione, destinazione, classe, dataIso) {
  const cls = norm(classe);
  const candidates = tariffe.filter(t =>
    t.prestazione === 'RACCOLTA' &&
    normalizzaRagioneSociale(t.fornitore_nome) === trasKey &&
    tariffaValidaPerData(t, dataIso) &&
    (isEmpty(t.classe_materiale) || norm(t.classe_materiale) === cls)
  );
  sortPerClasse(candidates);
  // a) destinazione
  if (!isEmpty(destinazione)) {
    const m = candidates.find(t => norm(t.destinazione) === destinazione);
    if (m) return m;
  }
  // b) provincia (senza destinazione)
  if (!isEmpty(provincia)) {
    const m = candidates.find(t => norm(t.provincia) === provincia && isEmpty(t.destinazione));
    if (m) return m;
  }
  // c) regione (senza provincia e destinazione)
  if (!isEmpty(regione)) {
    const m = candidates.find(t => norm(t.regione) === regione && isEmpty(t.provincia) && isEmpty(t.destinazione));
    if (m) return m;
  }
  // d) generica
  const m = candidates.find(t => isEmpty(t.destinazione) && isEmpty(t.provincia) && isEmpty(t.regione));
  return m || null;
}

// IMPIANTI: fornitore=destinazione, prestazione, classe; per "extra" prova EXTRA_RACCOLTA poi RETE
function findTariffaImpianto(tariffe, destKey, prestazione, classe, provenienza, tipologia, dataIso) {
  const cls = norm(classe);
  const tipologie = provenienza === 'extra' ? ['EXTRA_RACCOLTA', 'RETE'] : [tipologia];
  for (const tip of tipologie) {
    const candidates = tariffe.filter(t =>
      t.prestazione === prestazione &&
      normalizzaRagioneSociale(t.fornitore_nome) === destKey &&
      t.tipologia === tip &&
      tariffaValidaPerData(t, dataIso) &&
      (isEmpty(t.classe_materiale) || norm(t.classe_materiale) === cls)
    );
    sortPerClasse(candidates);
    if (candidates.length > 0) return candidates[0];
  }
  return null;
}

// TRASPORTO_SECONDARIA: fornitore=trasportatore, produttore=stoccaggio, destinatario=destinazione; prima TUTTE poi tipologia
function findTariffaSecondaria(tariffe, trasKey, produttore, destinatario, tipologia, dataIso) {
  const prodKey = normalizzaRagioneSociale(produttore);
  const destKey = normalizzaRagioneSociale(destinatario);
  for (const tip of ['TUTTE', tipologia]) {
    const candidates = tariffe.filter(t =>
      t.prestazione === 'TRASPORTO_SECONDARIA' &&
      normalizzaRagioneSociale(t.fornitore_nome) === trasKey &&
      t.tipologia === tip &&
      tariffaValidaPerData(t, dataIso) &&
      normalizzaRagioneSociale(t.produttore) === prodKey &&
      normalizzaRagioneSociale(t.destinatario) === destKey
    );
    if (candidates.length > 0) return candidates[0];
  }
  return null;
}

// ─── Calcolo importo ───
function calcImporto(um, valore, peso_kg, viaggi) {
  if (!um) return 0;
  if (um === '€/t') return (peso_kg / 1000) * valore;
  if (um === '€/kg') return peso_kg * valore;
  if (um === '€/viaggio') return viaggi * valore;
  if (um === '€/mese') return valore;
  return 0;
}

// ─── Main ───
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: richiesto ruolo admin' }, { status: 403 });

    const { anno, mese, tipologia } = await req.json();
    if (!anno || !mese || !tipologia) return Response.json({ error: 'Anno, mese e tipologia obbligatori' }, { status: 400 });
    if (!['RETE', 'ACI', 'EXTRA_RACCOLTA'].includes(tipologia)) return Response.json({ error: 'Tipologia non valida (RETE, ACI, EXTRA_RACCOLTA)' }, { status: 400 });

    const annoNum = Number(anno);
    const meseNorm = String(mese).toLowerCase().trim();
    const meseNum = MESI_MAP[meseNorm] !== undefined ? MESI_MAP[meseNorm] : (!isNaN(Number(meseNorm)) ? Number(meseNorm) - 1 : -1);
    if (meseNum < 0) return Response.json({ error: 'Mese non riconosciuto' }, { status: 400 });

    // ─── Caricamento dati ───
    const [primarieRete, primarieAci, secondarieAll, extraRaccoltaAll, tariffeAll, fornitoriAll] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.PrimariaRete),
      fetchAll(base44.asServiceRole.entities.PrimariaAci),
      fetchAll(base44.asServiceRole.entities.Secondaria),
      fetchAll(base44.asServiceRole.entities.ExtraRaccolta),
      fetchAll(base44.asServiceRole.entities.Tariffa, { direzione: 'PASSIVA', stato: 'attivo' }),
      fetchAll(base44.asServiceRole.entities.Fornitore, { stato: 'attivo' }),
    ]);

    // Fornitore lookup per flag interno
    const fornitoreByNorm = new Map();
    for (const f of fornitoriAll) {
      fornitoreByNorm.set(normalizzaRagioneSociale(f.ragione_sociale), f);
    }
    function isInterno(nome) {
      const f = fornitoreByNorm.get(normalizzaRagioneSociale(nome));
      return !!(f && f.interno === true);
    }

    // Tariffe con prestazione vuota → anomalia
    const anomalie = [];
    for (const t of tariffeAll) {
      if (isEmpty(t.prestazione)) {
        anomalie.push({
          descrizione: `Tariffa senza prestazione assegnata (ID ${t.id}) — fornitore: ${t.fornitore_nome || '—'}`,
          fornitore: t.fornitore_nome || '—',
          prestazione: '(vuota)',
          classe: t.classe_materiale || '—',
          ambito: '—',
          tonnellate: 0,
        });
      }
    }
    const tariffe = tariffeAll.filter(t => !isEmpty(t.prestazione));

    // ─── Filtro comune ───
    function filterRecords(records) {
      return records.filter(r => {
        const stato = String(r.stato || '').toLowerCase().trim();
        if (stato !== 'terminato') return false;
        const d = r.trasporto_finito_il;
        if (!d) return false;
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return false;
        if (dt.getFullYear() !== annoNum) return false;
        if (dt.getMonth() !== meseNum) return false;
        return true;
      });
    }

    const primarieReteF = filterRecords(primarieRete);
    const primarieAciF = filterRecords(primarieAci);
    const secondarieF = filterRecords(secondarieAll);
    const extraRaccoltaF = filterRecords(extraRaccoltaAll);

    const secondarieAci = secondarieF.filter(isAciRow);
    const secondarieNonAci = secondarieF.filter(r => !isAciRow(r));

    // Sorgenti per tipologia
    let raccoglitoriSource = [];
    let impiantiRecords = []; // array di {record, provenienza}
    let secondarieForBlock = [];

    if (tipologia === 'RETE') {
      raccoglitoriSource = primarieReteF;
      impiantiRecords = [
        ...primarieReteF.map(r => ({ r, provenienza: 'primaria' })),
        ...secondarieNonAci.map(r => ({ r, provenienza: 'secondaria' })),
        ...extraRaccoltaF.map(r => ({ r, provenienza: 'extra' })),
      ];
      secondarieForBlock = secondarieF;
    } else if (tipologia === 'ACI') {
      raccoglitoriSource = primarieAciF;
      impiantiRecords = [
        ...primarieAciF.map(r => ({ r, provenienza: 'primaria' })),
        ...secondarieAci.map(r => ({ r, provenienza: 'secondaria' })),
      ];
      secondarieForBlock = secondarieF;
    } else {
      raccoglitoriSource = extraRaccoltaF;
      impiantiRecords = extraRaccoltaF.map(r => ({ r, provenienza: 'extra' }));
      secondarieForBlock = [];
    }

    // ─── BLOCCO 1: RACCOGLITORI (RACCOLTA) ───
    const tonnellateTotali = raccoglitoriSource.reduce((s, r) => s + Number(r.peso_effettivo || 0), 0) / 1000;

    const raccPerGroup = new Map();   // €/t, €/kg: (trasKey|provincia|destinazione|tariffa)
    const raccPerTras = new Map();     // €/viaggio, €/mese: trasKey

    for (const r of raccoglitoriSource) {
      const trasportatore = String(r.trasportatore || '').trim();
      if (!trasportatore) continue;
      const trasKey = normalizzaRagioneSociale(trasportatore);
      const provincia = norm(r.provincia);
      const destinazione = norm(r.destinazione);
      const regione = getRegione(r);
      const classe = String(r.classe || '').trim();
      const dataIso = r.trasporto_finito_il;
      const peso = Number(r.peso_effettivo || 0);
      const dataFine = dataIso ? dataIso.slice(0, 10) : '';
      const automezzo = String(r.automezzo || '').trim();
      const viaggioKey = `${dataFine}|${automezzo}`;
      const interno = isInterno(trasportatore);

      const tariffa = findTariffaRaccolta(tariffe, trasKey, provincia, regione, destinazione, classe, dataIso);
      const tk = tariffa ? tariffa.id : '__NESSUNA__';
      const um = tariffa ? tariffa.unita_misura : '';

      if (!tariffa && !interno) {
        anomalie.push({
          descrizione: `Raccoglitore senza tariffa RACCOLTA: ${trasportatore}`,
          fornitore: trasportatore,
          prestazione: 'RACCOLTA',
          classe: classe || '—',
          ambito: `Prov: ${provincia || '—'}, Dest: ${r.destinazione || '—'}`,
          tonnellate: round3(peso / 1000),
        });
      }

      if (um === '€/viaggio' || um === '€/mese') {
        if (!raccPerTras.has(trasKey)) {
          raccPerTras.set(trasKey, {
            trasportatore, trasKey, interno,
            peso_kg: 0, viaggiSet: new Set(), perTariffa: new Map(),
          });
        }
        const g = raccPerTras.get(trasKey);
        g.peso_kg += peso;
        g.viaggiSet.add(viaggioKey);
        if (!g.perTariffa.has(tk)) g.perTariffa.set(tk, { tariffa, viaggiSet: new Set(), peso_kg: 0 });
        const pt = g.perTariffa.get(tk);
        pt.viaggiSet.add(viaggioKey);
        pt.peso_kg += peso;
      } else {
        const key = `${trasKey}|${provincia}|${destinazione}|${tk}`;
        if (!raccPerGroup.has(key)) {
          raccPerGroup.set(key, {
            trasportatore, trasKey, provincia, destinazione, interno,
            tariffa, peso_kg: 0, viaggiSet: new Set(), classi_set: new Set(),
          });
        }
        const g = raccPerGroup.get(key);
        g.peso_kg += peso;
        g.viaggiSet.add(viaggioKey);
        if (classe) g.classi_set.add(classe);
      }
    }

    // Righe raccoglitori
    const raccoglitoriRows = [];
    // €/t, €/kg
    for (const g of raccPerGroup.values()) {
      const tonnellate = g.peso_kg / 1000;
      const um = g.tariffa ? g.tariffa.unita_misura : '';
      const valore = g.tariffa ? g.tariffa.valore : 0;
      let importo = 0;
      if (g.tariffa && !g.interno) importo = calcImporto(um, valore, g.peso_kg, g.viaggiSet.size);
      raccoglitoriRows.push({
        fornitore: g.trasportatore, fornitore_norm: g.trasKey, interno: g.interno,
        riga: {
          provincia: g.provincia || '—', destinazione: g.destinazione || '—',
          classe: Array.from(g.classi_set).join(', ') || '—',
          tonnellate: round3(tonnellate), viaggi: g.viaggiSet.size,
          tariffa_valore: valore, unita_misura: um,
          importo: round2(importo),
          note: g.interno ? 'interno, non fatturato' : (!g.tariffa ? 'senza tariffa' : ''),
        },
      });
    }
    // €/viaggio, €/mese
    for (const g of raccPerTras.values()) {
      const tonnellate = g.peso_kg / 1000;
      const viaggi = g.viaggiSet.size;
      let importo = 0, um = '', valore = 0;
      for (const pt of g.perTariffa.values()) {
        if (!pt.tariffa || g.interno) continue;
        importo += calcImporto(pt.tariffa.unita_misura, pt.tariffa.valore, pt.peso_kg, pt.viaggiSet.size);
        um = pt.tariffa.unita_misura; valore = pt.tariffa.valore;
      }
      raccoglitoriRows.push({
        fornitore: g.trasportatore, fornitore_norm: g.trasKey, interno: g.interno,
        riga: {
          provincia: '—', destinazione: '—', classe: '—',
          tonnellate: round3(tonnellate), viaggi,
          tariffa_valore: valore, unita_misura: um,
          importo: round2(importo),
          note: g.interno ? 'interno, non fatturato' : '',
        },
      });
    }

    // Raggruppa per fornitore
    const raccByForn = new Map();
    for (const row of raccoglitoriRows) {
      if (!raccByForn.has(row.fornitore_norm)) {
        raccByForn.set(row.fornitore_norm, {
          fornitore: row.fornitore, interno: row.interno,
          righe: [], totale_tonnellate: 0, totale_euro: 0,
        });
      }
      const f = raccByForn.get(row.fornitore_norm);
      f.righe.push(row.riga);
      f.totale_tonnellate += row.riga.tonnellate;
      f.totale_euro += row.riga.importo;
    }
    const raccoglitori = Array.from(raccByForn.values()).map(f => ({
      ...f, totale_tonnellate: round3(f.totale_tonnellate), totale_euro: round2(f.totale_euro),
    })).sort((a, b) => b.totale_euro - a.totale_euro);

    const tonnellateRaccoglitori = raccoglitori.reduce((s, f) => s + f.totale_tonnellate, 0);

    // ─── BLOCCO 2: IMPIANTI E STOCCAGGI (TRATTAMENTO, CONFERIMENTO_STOCCAGGIO) ───
    const impPerGroup = new Map();  // €/t, €/kg: (destKey|prestazione|classe|provenienza|tariffa)
    const impPerDest = new Map();   // €/viaggio, €/mese: (destKey|tariffa)

    for (const { r, provenienza } of impiantiRecords) {
      const tipoDest = String(r.tipo_destinazione || '').toLowerCase().trim();
      const prestazione = tipoDest === 'imp' ? 'TRATTAMENTO' : tipoDest === 'stoc' ? 'CONFERIMENTO_STOCCAGGIO' : '';
      if (!prestazione) {
        // Anomalia: tipo_destinazione assente o diverso
        anomalie.push({
          descrizione: `Record con tipo_destinazione non valido ("${tipoDest || 'assente'}") — fornitore: ${r.destinazione || '—'}`,
          fornitore: r.destinazione || '—',
          prestazione: '(non calcolato)',
          classe: String(r.classe || '—'),
          ambito: `Prov: ${norm(r.provincia) || '—'}, Dest: ${r.destinazione || '—'}`,
          tonnellate: round3(Number(r.peso_effettivo || 0) / 1000),
        });
        continue;
      }
      const destinazione = String(r.destinazione || '').trim();
      if (!destinazione) continue;
      const destKey = normalizzaRagioneSociale(destinazione);
      const classe = String(r.classe || '').trim();
      const dataIso = r.trasporto_finito_il;
      const peso = Number(r.peso_effettivo || 0);
      const dataFine = dataIso ? dataIso.slice(0, 10) : '';
      const automezzo = String(r.automezzo || '').trim();
      const viaggioKey = `${dataFine}|${automezzo}`;
      const interno = isInterno(destinazione);

      const tariffa = findTariffaImpianto(tariffe, destKey, prestazione, classe, provenienza, tipologia, dataIso);
      const tk = tariffa ? tariffa.id : '__NESSUNA__';
      const um = tariffa ? tariffa.unita_misura : '';

      if (!tariffa && !interno) {
        anomalie.push({
          descrizione: `Impianto/stoccaggio senza tariffa ${prestazione}: ${destinazione}`,
          fornitore: destinazione,
          prestazione,
          classe: classe || '—',
          ambito: `Prov: ${provenienza}`,
          tonnellate: round3(peso / 1000),
        });
      }

      if (um === '€/viaggio' || um === '€/mese') {
        const dkey = `${destKey}|${tk}`;
        if (!impPerDest.has(dkey)) {
          impPerDest.set(dkey, {
            destinazione, destKey, interno, tariffa,
            peso_kg: 0, viaggiSet: new Set(),
          });
        }
        const g = impPerDest.get(dkey);
        g.peso_kg += peso;
        g.viaggiSet.add(viaggioKey);
      } else {
        const key = `${destKey}|${prestazione}|${classe}|${provenienza}|${tk}`;
        if (!impPerGroup.has(key)) {
          impPerGroup.set(key, {
            destinazione, destKey, prestazione, classe, provenienza, interno,
            tariffa, peso_kg: 0, viaggiSet: new Set(),
          });
        }
        const g = impPerGroup.get(key);
        g.peso_kg += peso;
        g.viaggiSet.add(viaggioKey);
      }
    }

    const impiantiRows = [];
    for (const g of impPerGroup.values()) {
      const tonnellate = g.peso_kg / 1000;
      const um = g.tariffa ? g.tariffa.unita_misura : '';
      const valore = g.tariffa ? g.tariffa.valore : 0;
      let importo = 0;
      if (g.tariffa && !g.interno) importo = calcImporto(um, valore, g.peso_kg, g.viaggiSet.size);
      impiantiRows.push({
        fornitore: g.destinazione, fornitore_norm: g.destKey, interno: g.interno,
        riga: {
          prestazione: g.prestazione, classe: g.classe || '—', provenienza: g.provenienza,
          tonnellate: round3(tonnellate), viaggi: g.viaggiSet.size,
          tariffa_valore: valore, unita_misura: um,
          importo: round2(importo),
          note: g.interno ? 'interno, non fatturato' : (!g.tariffa ? 'senza tariffa' : ''),
        },
      });
    }
    for (const g of impPerDest.values()) {
      const tonnellate = g.peso_kg / 1000;
      const um = g.tariffa ? g.tariffa.unita_misura : '';
      const valore = g.tariffa ? g.tariffa.valore : 0;
      let importo = 0;
      if (g.tariffa && !g.interno) importo = calcImporto(um, valore, g.peso_kg, g.viaggiSet.size);
      impiantiRows.push({
        fornitore: g.destinazione, fornitore_norm: g.destKey, interno: g.interno,
        riga: {
          prestazione: g.tariffa ? g.tariffa.prestazione : '—',
          classe: '—', provenienza: '—',
          tonnellate: round3(tonnellate), viaggi: g.viaggiSet.size,
          tariffa_valore: valore, unita_misura: um,
          importo: round2(importo),
          note: g.interno ? 'interno, non fatturato' : (!g.tariffa ? 'senza tariffa' : ''),
        },
      });
    }

    const impByForn = new Map();
    for (const row of impiantiRows) {
      if (!impByForn.has(row.fornitore_norm)) {
        impByForn.set(row.fornitore_norm, {
          fornitore: row.fornitore, interno: row.interno,
          righe: [], totale_tonnellate: 0, totale_euro: 0,
        });
      }
      const f = impByForn.get(row.fornitore_norm);
      f.righe.push(row.riga);
      f.totale_tonnellate += row.riga.tonnellate;
      f.totale_euro += row.riga.importo;
    }
    const impianti_stoccaggi = Array.from(impByForn.values()).map(f => ({
      ...f, totale_tonnellate: round3(f.totale_tonnellate), totale_euro: round2(f.totale_euro),
    })).sort((a, b) => b.totale_euro - a.totale_euro);

    // ─── BLOCCO 3: TRASPORTO SECONDARIE (TRASPORTO_SECONDARIA) ───
    // Raggruppa per tratta: stoccaggio (produttore), trasportatore, destinazione (destinatario)
    const tratte = new Map();
    for (const r of secondarieForBlock) {
      const stoccaggio = String(r.stoccaggio || '').trim();
      const trasportatore = String(r.trasportatore || '').trim();
      const destinazione = String(r.destinazione || '').trim();
      if (!stoccaggio || !trasportatore || !destinazione) continue;
      const trasKey = normalizzaRagioneSociale(trasportatore);
      const key = `${normalizzaRagioneSociale(stoccaggio)}|${trasKey}|${normalizzaRagioneSociale(destinazione)}`;
      if (!tratte.has(key)) {
        tratte.set(key, { stoccaggio, trasportatore, trasKey, destinazione, records: [] });
      }
      tratte.get(key).records.push(r);
    }

    const trasportiRows = [];
    for (const tratta of tratte.values()) {
      const interno = isInterno(tratta.trasportatore);
      // Sub-raggruppa per tariffa (validita' per record)
      const perTariffa = new Map();
      for (const r of tratta.records) {
        const tariffa = findTariffaSecondaria(tariffe, tratta.trasKey, tratta.stoccaggio, tratta.destinazione, tipologia, r.trasporto_finito_il);
        const tk = tariffa ? tariffa.id : '__NESSUNA__';
        if (!perTariffa.has(tk)) perTariffa.set(tk, { tariffa, records: [], viaggiSet: new Set() });
        const pt = perTariffa.get(tk);
        pt.records.push(r);
        const dataFine = r.trasporto_finito_il ? r.trasporto_finito_il.slice(0, 10) : '';
        const automezzo = String(r.automezzo || '').trim();
        pt.viaggiSet.add(`${dataFine}|${automezzo}`);
      }

      for (const pt of perTariffa.values()) {
        const nonAciRecs = pt.records.filter(r => !isAciRow(r));
        const aciRecs = pt.records.filter(r => isAciRow(r));
        const tonnellateRete = nonAciRecs.reduce((s, r) => s + Number(r.peso_effettivo || 0), 0) / 1000;
        const tonnellateAci = aciRecs.reduce((s, r) => s + Number(r.peso_effettivo || 0), 0) / 1000;
        const viaggi = pt.viaggiSet.size;
        const viaggioMisto = nonAciRecs.length > 0 && aciRecs.length > 0;
        const um = pt.tariffa ? pt.tariffa.unita_misura : '';
        const valore = pt.tariffa ? pt.tariffa.valore : 0;

        if (!pt.tariffa && !interno) {
          anomalie.push({
            descrizione: `Tratta secondaria senza tariffa TRASPORTO_SECONDARIA: ${tratta.stoccaggio} → ${tratta.destinazione} (trasportatore: ${tratta.trasportatore})`,
            fornitore: tratta.trasportatore,
            prestazione: 'TRASPORTO_SECONDARIA',
            classe: '—',
            ambito: `${tratta.stoccaggio} → ${tratta.destinazione}`,
            tonnellate: round3(tonnellateRete + tonnellateAci),
          });
          continue;
        }

        // Anomalia: viaggio misto con tariffa a viaggio
        if (viaggioMisto && um === '€/viaggio') {
          anomalie.push({
            descrizione: `Tratta con viaggio misto (RETE+ACI) e tariffa €/viaggio: ${tratta.stoccaggio} → ${tratta.destinazione} (trasportatore: ${tratta.trasportatore})`,
            fornitore: tratta.trasportatore,
            prestazione: 'TRASPORTO_SECONDARIA',
            classe: '—',
            ambito: `${tratta.stoccaggio} → ${tratta.destinazione}`,
            tonnellate: round3(tonnellateRete + tonnellateAci),
          });
        }

        let importo = 0;
        let note = '';
        if (interno) {
          importo = 0;
          note = 'interno, non fatturato';
        } else if (um === '€/viaggio') {
          // Una sola volta sulla tratta: RETE se ha non-ACI, altrimenti ACI
          if (tipologia === 'RETE') {
            if (nonAciRecs.length > 0) importo = viaggi * valore;
            else { importo = 0; note = 'nessuna riga RETE'; }
          } else { // ACI
            if (nonAciRecs.length > 0) { importo = 0; note = 'viaggio fatturato nel canale RETE'; }
            else importo = viaggi * valore;
          }
        } else if (um === '€/t' || um === '€/kg') {
          // Per canale: RETE usa tonnellate non-ACI, ACI usa tonnellate ACI
          const pesoCanale = tipologia === 'RETE' ? tonnellateRete * 1000 : tonnellateAci * 1000;
          importo = calcImporto(um, valore, pesoCanale, viaggi);
        } else if (um === '€/mese') {
          if (pt.records.length > 0) importo = valore;
        }

        trasportiRows.push({
          fornitore: tratta.trasportatore, fornitore_norm: tratta.trasKey, interno,
          riga: {
            stoccaggio: tratta.stoccaggio, destinazione: tratta.destinazione,
            tonnellate_rete: round3(tonnellateRete), tonnellate_aci: round3(tonnellateAci),
            viaggi, tariffa_valore: valore, unita_misura: um,
            importo: round2(importo), viaggio_misto: viaggioMisto, note,
          },
        });
      }
    }

    const trasByForn = new Map();
    for (const row of trasportiRows) {
      if (!trasByForn.has(row.fornitore_norm)) {
        trasByForn.set(row.fornitore_norm, {
          fornitore: row.fornitore, interno: row.interno,
          righe: [], totale_tonnellate: 0, totale_euro: 0,
        });
      }
      const f = trasByForn.get(row.fornitore_norm);
      f.righe.push(row.riga);
      f.totale_tonnellate += row.riga.tonnellate_rete + row.riga.tonnellate_aci;
      f.totale_euro += row.riga.importo;
    }
    const trasporti_secondaria = Array.from(trasByForn.values()).map(f => ({
      ...f, totale_tonnellate: round3(f.totale_tonnellate), totale_euro: round2(f.totale_euro),
    })).sort((a, b) => b.totale_euro - a.totale_euro);

    // ─── TOTALI ───
    const totaleRaccoglitori = raccoglitori.reduce((s, f) => s + f.totale_euro, 0);
    const totaleImpianti = impianti_stoccaggi.reduce((s, f) => s + f.totale_euro, 0);
    const totaleSecondaria = trasporti_secondaria.reduce((s, f) => s + f.totale_euro, 0);

    // ─── QUADRATURA ───
    const coincidente = Math.abs(tonnellateTotali - tonnellateRaccoglitori) < 0.001;

    return Response.json({
      anno: annoNum,
      mese,
      tipologia,
      raccoglitori,
      impianti_stoccaggi,
      trasporti_secondaria,
      totali: {
        raccoglitori: round2(totaleRaccoglitori),
        impianti_stoccaggi: round2(totaleImpianti),
        trasporti_secondaria: round2(totaleSecondaria),
        totale_complessivo: round2(totaleRaccoglitori + totaleImpianti + totaleSecondaria),
      },
      anomalie,
      quadratura: {
        tonnellate_totali: round3(tonnellateTotali),
        tonnellate_raccoglitori: round3(tonnellateRaccoglitori),
        coincidente,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}