import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from '../../shared/fetchAll.ts';
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';
import { getRegioneFromProvincia } from '../../shared/regioneMap.ts';
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { mappaFatturazione, fatturaA } from "../../shared/subfornitori.ts";
import { giornoRoma, annoRoma, meseRoma } from "../../shared/giornoItaliano.ts";

const MESI_MAP = {
  'gennaio': 0, 'febbraio': 1, 'marzo': 2, 'aprile': 3, 'maggio': 4, 'giugno': 5,
  'luglio': 6, 'agosto': 7, 'settembre': 8, 'ottobre': 9, 'novembre': 10, 'dicembre': 11
};

// ─── Helpers ───
function norm(s) { return String(s || '').trim().toUpperCase(); }
function isEmpty(s) { return !s || String(s).trim() === ''; }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function round3(n) { return Math.round((n + Number.EPSILON) * 1000) / 1000; }

// Il giorno di una data e' quello italiano, non quello del fuso del server:
// un trasporto finito alle 23 del 31 agosto e' di agosto, non di settembre.
function tariffaValidaPerData(t, dataIso) {
  const giorno = giornoRoma(dataIso);
  if (!giorno) return false;
  const inizio = String(t.data_inizio_validita || '').slice(0, 10);
  if (inizio && inizio > giorno) return false;
  const fine = String(t.data_fine_validita || '').slice(0, 10);
  if (fine && fine < giorno) return false;
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

// Nell'extra raccolta il prezzo non viene da una tariffa di contratto: sta
// scritto sull'intervento, riga per riga, perche' ogni intervento fa storia a
// se' - un ritiro straordinario puo' avere il suo prezzo di raccolta, di
// stoccaggio, di trattamento, piu' la pulizia e gli oneri. Il modulo Extra
// Raccolta somma quei campi, e la fatturazione passiva deve arrivare allo stesso
// numero: prima applicava le tariffe della rete e il 14 aprile perdeva per
// strada 36,00 euro di raccolta su 400 kg.
const CAMPO_COSTO = {
  RACCOLTA: 'costo_raccolta_t',
  TRATTAMENTO: 'costo_trattamento_t',
  CONFERIMENTO_STOCCAGGIO: 'costo_stoccaggio_t',
};
function tariffaDallIntervento(record, prestazione) {
  const valore = Number(record[CAMPO_COSTO[prestazione]] || 0);
  return {
    // il valore entra nella chiave: due interventi dello stesso fornitore
    // possono avere prezzi diversi e non vanno fusi in una riga sola
    id: `intervento|${prestazione}|${valore}`,
    prestazione,
    unita_misura: '€/t',
    valore,
    criterio: 'intervento',
    da_intervento: true,
  };
}

// ─── Ricerca tariffe ───

// RACCOLTA: gerarchia destinazione > provincia > regione > generica
function findTariffaRaccolta(tariffe, trasKey, provincia, regione, destinazione, classe, tipologia, dataIso) {
  const cls = norm(classe);
  // Per EXTRA_RACCOLTA: prima EXTRA_RACCOLTA, poi ricaduta su RETE; per RETE/ACI: corrispondenza esatta
  const tipologie = tipologia === 'EXTRA_RACCOLTA' ? ['EXTRA_RACCOLTA', 'RETE'] : [tipologia];
  for (const tip of tipologie) {
    const candidates = tariffe.filter(t =>
      t.prestazione === 'RACCOLTA' &&
      normalizzaRagioneSociale(t.fornitore_nome) === trasKey &&
      t.tipologia === tip &&
      tariffaValidaPerData(t, dataIso) &&
      (isEmpty(t.classe_materiale) || norm(t.classe_materiale) === cls)
    );
    sortPerClasse(candidates);
    // Il criterio con cui si e' scelto resta attaccato alla tariffa: serve a
    // vedere a colpo d'occhio, in fatturazione, quando un contratto prevede un
    // prezzo per destinazione e si sta invece applicando quello generico. Le
    // tariffe di Emmesse - 72 euro a Gatim, 90 a Irigom - sono nate cosi'.
    const con = (m, criterio) => (m ? { ...m, criterio } : null);
    // a) destinazione
    if (!isEmpty(destinazione)) {
      const m = candidates.find(t => norm(t.destinazione) === destinazione);
      if (m) return con(m, 'destinazione');
    }
    // b) provincia (senza destinazione)
    if (!isEmpty(provincia)) {
      const m = candidates.find(t => norm(t.provincia) === provincia && isEmpty(t.destinazione));
      if (m) return con(m, 'provincia');
    }
    // c) regione (senza provincia e destinazione)
    if (!isEmpty(regione)) {
      const m = candidates.find(t => norm(t.regione) === regione && isEmpty(t.provincia) && isEmpty(t.destinazione));
      if (m) return con(m, 'regione');
    }
    // d) generica
    const m = candidates.find(t => isEmpty(t.destinazione) && isEmpty(t.provincia) && isEmpty(t.regione));
    if (m) return con(m, 'generica');
  }
  return null;
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

// ─── Subraccoglitori: il "di cui" da mostrare accanto al fornitore che fattura ───
function segnaDiCui(mappa, nome, peso, viaggioKey) {
  if (!mappa.has(nome)) mappa.set(nome, { peso_kg: 0, viaggiSet: new Set() });
  const d = mappa.get(nome);
  d.peso_kg += peso;
  d.viaggiSet.add(viaggioKey);
}

function elencoDiCui(mappa) {
  if (!mappa || mappa.size === 0) return [];
  return [...mappa.entries()].map(([fornitore, d]) => ({
    fornitore, tonnellate: round3(d.peso_kg / 1000), viaggi: d.viaggiSet.size,
  }));
}

// ─── Calcolo importo ───
function calcImporto(um, valore, peso_kg, viaggi) {
  if (!um) return 0;
  if (um === '€/t') return (peso_kg / 1000) * valore;
  if (um === '€/kg') return peso_kg * valore;
  if (um === '€/viaggio') return viaggi * valore;
  return 0;
}

// ─── Main ───
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
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

    // Il prezzo unico e una tariffa di trattamento per lo stesso fornitore e lo
    // stesso canale non possono convivere: si pagherebbe due volte lo stesso
    // trattamento. Meglio dirlo prima che dopo.
    for (const t of tariffe.filter(x => x.prestazione === 'RACCOLTA' && x.comprensiva_trattamento === true)) {
      const doppia = tariffe.find(x => x.prestazione === 'TRATTAMENTO'
        && normalizzaRagioneSociale(x.fornitore_nome) === normalizzaRagioneSociale(t.fornitore_nome)
        && x.tipologia === t.tipologia);
      if (!doppia) continue;
      anomalie.push({
        descrizione: `${t.fornitore_nome || '—'}: la raccolta ${t.tipologia} e' a prezzo unico comprensivo del trattamento, ma esiste anche una tariffa di trattamento (${doppia.valore} ${doppia.unita_misura}). Il trattamento non viene fatturato a parte: se invece va pagato, togli il prezzo unico dalla raccolta.`,
        fornitore: t.fornitore_nome || '—',
        prestazione: 'RACCOLTA / TRATTAMENTO',
        classe: doppia.classe_materiale || '—',
        ambito: `Canale ${t.tipologia}`,
        tonnellate: 0,
      });
    }

    // ─── Filtro comune ───
    // Il mese di competenza e' quello in cui e' finito il trasporto, letto sul
    // giorno italiano.
    function filterRecords(records) {
      return records.filter(r => {
        const stato = String(r.stato || '').toLowerCase().trim();
        if (stato !== 'terminato') return false;
        if (annoRoma(r.trasporto_finito_il) !== annoNum) return false;
        if (meseRoma(r.trasporto_finito_il) !== meseNum) return false;
        return true;
      });
    }

    // Chi fattura per chi: un subraccoglitore raccoglie col proprio nome ma le sue
    // tonnellate le fattura il fornitore principale, con la tariffa del principale.
    const perFattura = mappaFatturazione(fornitoriAll);

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
      // L'extra raccolta NON entra qui. Prima ci entrava, e cosi' lo stesso
      // carico si pagava due volte: il trattamento compariva una volta nella
      // scheda Rete e una seconda, identico, nella scheda Extra Raccolta.
      // L'extra raccolta e' un canale a se', e si fattura solo nella sua scheda.
      impiantiRecords = [
        ...primarieReteF.map(r => ({ r, provenienza: 'primaria' })),
        ...secondarieNonAci.map(r => ({ r, provenienza: 'secondaria' })),
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

    // ─── FORMULARI RIPETUTI ───
    // Un formulario che compare due volte nello stesso mese si paga due volte:
    // la raccolta a chi ha raccolto, lo stoccaggio o il trattamento a chi lo
    // riceve. Nel 2026 le 2.827 primarie di rete non hanno un solo numero
    // ripetuto, quindi una ripetizione non e' la normalita' dell'archivio: e'
    // qualcosa da guardare prima di pagare. Il gestionale la segnala e basta -
    // quale delle due righe sia quella buona lo decide chi conosce il ritiro.
    const perFir = new Map();
    const firVisti = new Set();
    const raccogliFir = (rec) => {
      if (!rec || !rec.id || firVisti.has(rec.id)) return;
      firVisti.add(rec.id);
      const fir = String(rec.numero_fir || '').trim();
      if (!fir) return;
      if (!perFir.has(fir)) perFir.set(fir, []);
      perFir.get(fir).push(rec);
    };
    for (const rec of raccoglitoriSource) raccogliFir(rec);
    for (const { r: rec } of impiantiRecords) raccogliFir(rec);
    for (const [fir, righe] of perFir) {
      if (righe.length < 2) continue;
      const kg = righe.reduce((s, x) => s + Number(x.peso_effettivo || 0), 0);
      const pesi = righe.map(x => `${Math.round(Number(x.peso_effettivo || 0))} kg`).join(' + ');
      anomalie.push({
        descrizione: `Formulario ${fir} presente ${righe.length} volte nel mese (${pesi}): se e' lo stesso ritiro caricato piu' volte, raccolta, stoccaggio e trattamento si pagano due volte. ID ordine ${righe[0].codice_import || '—'}, ${righe[0].trasportatore || '—'} → ${righe[0].destinazione || '—'}.`,
        fornitore: righe[0].trasportatore || '—',
        prestazione: 'FORMULARIO RIPETUTO',
        classe: String(righe[0].classe || '—'),
        ambito: `FIR ${fir}`,
        tonnellate: round3(kg / 1000),
      });
    }

    // ─── BLOCCO 1: RACCOGLITORI (RACCOLTA) ───
    const tonnellateTotali = raccoglitoriSource.reduce((s, r) => s + Number(r.peso_effettivo || 0), 0) / 1000;

    const raccPerGroup = new Map();   // €/t, €/kg: (trasKey|provincia|destinazione|tariffa)
    const raccPerTras = new Map();     // €/viaggio: trasKey

    for (const r of raccoglitoriSource) {
      const raccoglitore = String(r.trasportatore || '').trim();
      if (!raccoglitore) continue;
      const fatt = fatturaA(perFattura, raccoglitore);
      const trasportatore = fatt.nome;
      const trasKey = fatt.chiave;
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

      const tariffa = tipologia === 'EXTRA_RACCOLTA'
        ? tariffaDallIntervento(r, 'RACCOLTA')
        : findTariffaRaccolta(tariffe, trasKey, provincia, regione, destinazione, classe, tipologia, dataIso);
      const tk = tariffa ? tariffa.id : '__NESSUNA__';
      const um = tariffa ? tariffa.unita_misura : '';

      // Un intervento a zero puo' essere giusto (SMOCO raccoglie da se'), ma se
      // il contratto un prezzo lo prevede, il campo e' rimasto vuoto per
      // dimenticanza e la raccolta finirebbe non pagata.
      if (tipologia === 'EXTRA_RACCOLTA' && !interno && tariffa.valore === 0) {
        const daContratto = findTariffaRaccolta(tariffe, trasKey, provincia, regione, destinazione, classe, tipologia, dataIso);
        if (daContratto && Number(daContratto.valore) > 0) {
          anomalie.push({
            descrizione: `Extra raccolta: sull'intervento il costo di raccolta e' zero, ma per ${trasportatore} il contratto prevede ${daContratto.valore} ${daContratto.unita_misura}. Se va pagato, scrivilo sull'intervento.`,
            fornitore: trasportatore,
            prestazione: 'RACCOLTA',
            classe: classe || '—',
            ambito: `FIR ${r.numero_fir || '—'}`,
            tonnellate: round3(peso / 1000),
          });
        }
      }

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

      if (um === '€/viaggio') {
        if (!raccPerTras.has(trasKey)) {
          raccPerTras.set(trasKey, {
            trasportatore, trasKey, interno,
            peso_kg: 0, viaggiSet: new Set(), perTariffa: new Map(), diCui: new Map(),
          });
        }
        const g = raccPerTras.get(trasKey);
        g.peso_kg += peso;
        g.viaggiSet.add(viaggioKey);
        if (fatt.subfornitore) segnaDiCui(g.diCui, fatt.subfornitore, peso, viaggioKey);
        if (!g.perTariffa.has(tk)) g.perTariffa.set(tk, { tariffa, viaggiSet: new Set(), peso_kg: 0 });
        const pt = g.perTariffa.get(tk);
        pt.viaggiSet.add(viaggioKey);
        pt.peso_kg += peso;
      } else {
        const key = `${trasKey}|${provincia}|${destinazione}|${tk}`;
        if (!raccPerGroup.has(key)) {
          raccPerGroup.set(key, {
            trasportatore, trasKey, provincia, destinazione, interno,
            tariffa, peso_kg: 0, viaggiSet: new Set(), classi_set: new Set(), diCui: new Map(),
          });
        }
        const g = raccPerGroup.get(key);
        g.peso_kg += peso;
        g.viaggiSet.add(viaggioKey);
        if (classe) g.classi_set.add(classe);
        if (fatt.subfornitore) segnaDiCui(g.diCui, fatt.subfornitore, peso, viaggioKey);
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
        fornitore: g.trasportatore, fornitore_norm: g.trasKey, interno: g.interno, di_cui: elencoDiCui(g.diCui),
        riga: {
          provincia: g.provincia || '—', destinazione: g.destinazione || '—',
          classe: Array.from(g.classi_set).join(', ') || '—',
          tonnellate: round3(tonnellate), viaggi: g.viaggiSet.size,
          tariffa_valore: valore, unita_misura: um,
          // Con che criterio e' stata scelta: destinazione, provincia, regione o
          // generica. Si vede subito quando un contratto prevede un prezzo per
          // destinazione e si sta applicando invece quello generico.
          tariffa_criterio: g.tariffa ? (g.tariffa.criterio || 'generica') : '',
          importo: round2(importo),
          note: g.interno ? 'interno, non fatturato' : (!g.tariffa ? 'senza tariffa' : ''),
        },
      });
    }
    // €/viaggio
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
        fornitore: g.trasportatore, fornitore_norm: g.trasKey, interno: g.interno, di_cui: elencoDiCui(g.diCui),
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
          righe: [], totale_tonnellate: 0, totale_euro: 0, diCui: new Map(),
        });
      }
      const f = raccByForn.get(row.fornitore_norm);
      f.righe.push(row.riga);
      f.totale_tonnellate += row.riga.tonnellate;
      f.totale_euro += row.riga.importo;
      for (const d of (row.di_cui || [])) {
        const prima = f.diCui.get(d.fornitore) || { peso_kg: 0, viaggi: 0 };
        f.diCui.set(d.fornitore, { peso_kg: prima.peso_kg + d.tonnellate * 1000, viaggi: prima.viaggi + d.viaggi });
      }
    }
    const raccoglitori = Array.from(raccByForn.values()).map(f => ({
      fornitore: f.fornitore, interno: f.interno, righe: f.righe,
      totale_tonnellate: round3(f.totale_tonnellate), totale_euro: round2(f.totale_euro),
      // Le tonnellate dei subraccoglitori sono comprese nel totale: si mostrano
      // per sapere quanto ha portato ciascuno, non per fatturarle a lui.
      di_cui: [...f.diCui.entries()].map(([fornitore, v]) => ({ fornitore, tonnellate: round3(v.peso_kg / 1000), viaggi: v.viaggi }))
        .sort((a, b) => b.tonnellate - a.tonnellate),
    })).sort((a, b) => b.totale_euro - a.totale_euro);

    const tonnellateRaccoglitori = raccoglitori.reduce((s, f) => s + f.totale_tonnellate, 0);

    // ─── BLOCCO 2: IMPIANTI E STOCCAGGI (TRATTAMENTO, CONFERIMENTO_STOCCAGGIO) ───
    const impPerGroup = new Map();  // €/t, €/kg: (destKey|prestazione|classe|provenienza|tariffa)
    const impPerDest = new Map();   // €/viaggio: (destKey|tariffa)

    // Stoccaggio e trattamento si pagano su TUTTO cio' che arriva al sito, non
    // solo su cio' che il titolare del sito ha raccolto: su Nappi Sud conferiscono
    // anche altri raccoglitori e lo stoccaggio si paga anche sul loro conferito,
    // su Gatim conferisce anche Emmesse e il suo quantitativo si somma a quello
    // trattato da Gatim. Il "di cui" qui sotto tiene visibile chi ha portato cosa.
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

      // Chi ha materialmente portato il carico: il raccoglitore per le primarie
      // e per l'extra raccolta, lo stoccaggio di partenza per le secondarie.
      const conferente = (provenienza === 'secondaria'
        ? String(r.stoccaggio || '').trim()
        : String(r.trasportatore || '').trim()) || '—';

      // Prezzo unico: una tariffa di raccolta puo' comprendere anche il
      // trattamento. Nel 2026 capita solo con Green Tyre Project sull'ACI, a 225
      // euro la tonnellata: si paga una volta sola, sul conferito, senza scindere
      // la raccolta dal trattamento. Vale solo quando chi ha raccolto e chi
      // tratta sono lo stesso fornitore in fattura.
      const fattConf = fatturaA(perFattura, conferente);
      const tarRacc = prestazione === 'TRATTAMENTO' && fattConf.chiave === destKey
        ? findTariffaRaccolta(tariffe, destKey, norm(r.provincia), getRegione(r), norm(destinazione), classe, tipologia, dataIso)
        : null;
      const compresoNellaRaccolta = !!(tarRacc && tarRacc.comprensiva_trattamento === true);

      const tariffa = compresoNellaRaccolta
        ? null
        : provenienza === 'extra'
          ? tariffaDallIntervento(r, prestazione)
          : findTariffaImpianto(tariffe, destKey, prestazione, classe, provenienza, tipologia, dataIso);

      // Stesso discorso per chi tratta o stocca un intervento di extra raccolta:
      // se il campo e' vuoto ma il contratto un prezzo lo prevede, si segnala.
      if (provenienza === 'extra' && !interno && tariffa && tariffa.valore === 0) {
        const daContratto = findTariffaImpianto(tariffe, destKey, prestazione, classe, provenienza, tipologia, dataIso);
        if (daContratto && Number(daContratto.valore) > 0) {
          anomalie.push({
            descrizione: `Extra raccolta: sull'intervento il costo di ${prestazione === 'TRATTAMENTO' ? 'trattamento' : 'stoccaggio'} e' zero, ma per ${destinazione} il contratto prevede ${daContratto.valore} ${daContratto.unita_misura}. Se va pagato, scrivilo sull'intervento.`,
            fornitore: destinazione,
            prestazione,
            classe: classe || '—',
            ambito: `FIR ${r.numero_fir || '—'}`,
            tonnellate: round3(peso / 1000),
          });
        }
      }
      const tk = compresoNellaRaccolta ? '__COMPRESO__' : (tariffa ? tariffa.id : '__NESSUNA__');
      const um = tariffa ? tariffa.unita_misura : '';

      if (!tariffa && !interno && !compresoNellaRaccolta) {
        anomalie.push({
          descrizione: `Impianto/stoccaggio senza tariffa ${prestazione}: ${destinazione}`,
          fornitore: destinazione,
          prestazione,
          classe: classe || '—',
          ambito: `Prov: ${provenienza}`,
          tonnellate: round3(peso / 1000),
        });
      }

      if (um === '€/viaggio') {
        const dkey = `${destKey}|${tk}`;
        if (!impPerDest.has(dkey)) {
          impPerDest.set(dkey, {
            destinazione, destKey, interno, tariffa, compresoNellaRaccolta,
            peso_kg: 0, viaggiSet: new Set(), diCui: new Map(),
          });
        }
        const g = impPerDest.get(dkey);
        g.peso_kg += peso;
        g.viaggiSet.add(viaggioKey);
        segnaDiCui(g.diCui, conferente, peso, viaggioKey);
      } else {
        const key = `${destKey}|${prestazione}|${classe}|${provenienza}|${tk}`;
        if (!impPerGroup.has(key)) {
          impPerGroup.set(key, {
            destinazione, destKey, prestazione, classe, provenienza, interno,
            tariffa, compresoNellaRaccolta, peso_kg: 0, viaggiSet: new Set(), diCui: new Map(),
          });
        }
        const g = impPerGroup.get(key);
        g.peso_kg += peso;
        g.viaggiSet.add(viaggioKey);
        segnaDiCui(g.diCui, conferente, peso, viaggioKey);
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
          compreso_nella_raccolta: !!g.compresoNellaRaccolta,
          di_cui: elencoDiCui(g.diCui),
          note: g.interno ? 'interno, non fatturato'
            : g.compresoNellaRaccolta ? 'compreso nel prezzo unico della raccolta'
            : (!g.tariffa ? 'senza tariffa' : ''),
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
          compreso_nella_raccolta: !!g.compresoNellaRaccolta,
          di_cui: elencoDiCui(g.diCui),
          note: g.interno ? 'interno, non fatturato'
            : g.compresoNellaRaccolta ? 'compreso nel prezzo unico della raccolta'
            : (!g.tariffa ? 'senza tariffa' : ''),
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

    // La pulizia e gli oneri aggiuntivi di un intervento sono importi fissi che
    // non appartengono a un fornitore: il modulo Extra Raccolta li somma nel
    // costo dell'intervento, qui non si possono mettere in fattura a nessuno. Si
    // dichiarano, cosi' il totale della passiva non sembra sbagliato a chi
    // confronta i due moduli.
    if (tipologia === 'EXTRA_RACCOLTA') {
      // Un intervento marcato come secondaria e' un trasferimento da uno
      // stoccaggio a un impianto, non una raccolta: finirebbe fra i raccoglitori
      // col nome del trasportatore e col costo di raccolta dell'intervento.
      // Finche' l'extra raccolta non avra' un campo per il costo del trasporto,
      // il gestionale lo dice invece di far finta di niente.
      for (const rec of extraRaccoltaF) {
        if (String(rec.tipo_movimento || 'primaria').toLowerCase().trim() !== 'secondaria') continue;
        anomalie.push({
          descrizione: `Extra raccolta: l'intervento ${rec.numero_fir || '—'} e' un trasferimento da ${rec.stoccaggio || '—'} a ${rec.destinazione || '—'}, ma viene conteggiato come raccolta di ${rec.trasportatore || '—'}. Il trasporto di una secondaria di extra raccolta va verificato a mano.`,
          fornitore: rec.trasportatore || '—',
          prestazione: 'TRASPORTO_SECONDARIA',
          classe: String(rec.classe || '—'),
          ambito: `FIR ${rec.numero_fir || '—'}`,
          tonnellate: round3(Number(rec.peso_effettivo || 0) / 1000),
        });
      }
      for (const rec of extraRaccoltaF) {
        const fissi = Number(rec.costo_pulizia || 0) + Number(rec.costi_aggiuntivi || 0);
        if (fissi <= 0) continue;
        anomalie.push({
          descrizione: `Extra raccolta: l'intervento ${rec.numero_fir || '—'} ha ${round2(fissi)} euro di oneri fissi (pulizia e costi aggiuntivi) che il modulo Extra Raccolta conta nel costo ma qui non sono attribuiti a nessun fornitore. ${rec.note_costi || ''}`.trim(),
          fornitore: rec.destinazione || '—',
          prestazione: 'ONERI INTERVENTO',
          classe: String(rec.classe || '—'),
          ambito: `FIR ${rec.numero_fir || '—'}`,
          tonnellate: 0,
        });
      }
    }

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
        }

        // Un viaggio di secondaria puo' portare formulari di rete e formulari
        // ACI insieme. L'importo e' gia' diviso fra i due canali qui sopra, ma
        // le tonnellate no: finivano tutte in entrambe le viste, e il totale del
        // trasportatore sommava rete e ACI - proprio la commistione che non deve
        // mai esserci. La riga porta le tonnellate del canale che si sta
        // guardando; quelle dell'altro restano accanto, dichiarate, perche'
        // spiegano perche' un viaggio misto si paga tutto di qua.
        const tonnellateCanale = tipologia === 'ACI' ? tonnellateAci : tonnellateRete;
        const tonnellateAltro = tipologia === 'ACI' ? tonnellateRete : tonnellateAci;

        // Una tratta che in questo canale non ha ne' tonnellate ne' importo e'
        // di un altro canale: non ha niente da fare in questa tabella.
        if (round3(tonnellateCanale) === 0 && round2(importo) === 0) continue;

        trasportiRows.push({
          fornitore: tratta.trasportatore, fornitore_norm: tratta.trasKey, interno,
          riga: {
            stoccaggio: tratta.stoccaggio, destinazione: tratta.destinazione,
            tonnellate: round3(tonnellateCanale),
            tonnellate_altro_canale: round3(tonnellateAltro),
            canale_altro: tipologia === 'ACI' ? 'RETE' : 'ACI',
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
      f.totale_tonnellate += row.riga.tonnellate;
      f.totale_euro += row.riga.importo;
    }
    const trasporti_secondaria = Array.from(trasByForn.values()).map(f => ({
      ...f, totale_tonnellate: round3(f.totale_tonnellate), totale_euro: round2(f.totale_euro),
    })).sort((a, b) => b.totale_euro - a.totale_euro);

    // Una stessa anomalia puo' nascere da piu' righe uguali: si dice una volta
    // sola, altrimenti l'elenco sembra piu' grave di quello che e'.
    const anomalieViste = new Set();
    const anomalieUniche = anomalie.filter(a => {
      const k = `${a.descrizione}|${a.fornitore}|${a.prestazione}|${a.classe}|${a.ambito}`;
      if (anomalieViste.has(k)) return false;
      anomalieViste.add(k);
      return true;
    });

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
      anomalie: anomalieUniche,
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