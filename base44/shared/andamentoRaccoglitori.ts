// L'ANDAMENTO DELLA RACCOLTA DI UN RACCOGLITORE, MESE PER MESE E PER ZONA.
//
// Richiesta dell'utente (29/09/2026): «serve una fotografia istantanea
// dell'andamento della loro raccolta mensile man mano che il gestionale viene
// aggiornato caricando il file delle primarie», e «l'andamento generale per zone di
// competenza».
//
// SI CALCOLA, NON SI CONSERVA. I numeri vengono ogni volta dall'archivio delle
// primarie: cosi' la fotografia e' sempre quella di adesso e si aggiorna da sola a
// ogni caricamento (regola 2), senza un archivio parallelo che puo' restare
// indietro. E' anche il motivo per cui questo file non tocca le liste degli
// assegnati, che invece si cancellano da sole dopo due mesi: l'andamento sopravvive
// perche' non e' mai stato salvato.
//
// SOLO RETE. Il target Ecotyre e' un target di raccolta della rete: ACI ed extra
// raccolta hanno i loro conti e non si sommano mai a questo (regola 3). Chi vuole
// sapere quanto ACI ha fatto un raccoglitore lo legge nel suo modulo.
//
// IL PERIODO E' LA FINE DEL TRASPORTO (regola 1): un ritiro conta nel mese in cui
// il camion ha finito, non in quello in cui il portale ha chiuso l'ordine.
//
// LA ZONA DI COMPETENZA E' DICHIARATA, non dedotta (decisione dell'utente,
// 29/09/2026): per ogni raccoglitore e per ogni anno si scrivono le province che gli
// competono. Serve a poter dire «ha raccolto a Foggia, che non e' nella sua zona»,
// che senza un perimetro scritto non si puo' dire. Finche' la zona non e' scritta il
// modulo non inventa nulla: mostra dove ha raccolto e lo dice.
import { eTerminato, giornoMovimento, canaleMovimento, MESI_MOVIMENTI } from "./movimenti.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { getRegioneFromProvincia } from "./regioneMap.ts";

const kg = (v) => Math.round(Number(v) || 0);
const pulisci = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const sigla = (v) => pulisci(v).toUpperCase().slice(0, 2);

/** Le province scritte su una riga di zona: "SA, NA;CE" -> ['SA','NA','CE']. */
export function provinceDiZona(zona) {
  const testo = String((zona && zona.province) || '');
  return [...new Set(testo.toUpperCase().split(/[^A-Z]+/).filter(p => p.length === 2))];
}

/**
 * Le zone dichiarate di un anno, per chiave del raccoglitore.
 * @returns {Map<string, { nome, province: string[], note }>}
 */
export function zonePerRaccoglitore(zone, anno) {
  const out = new Map();
  for (const z of zone || []) {
    if (Number(z.anno) !== Number(anno)) continue;
    const chiave = normalizzaRagioneSociale(z.raccoglitore || '');
    if (!chiave) continue;
    const province = provinceDiZona(z);
    const prima = out.get(chiave);
    // Piu' righe per lo stesso raccoglitore si uniscono: la zona e' l'unione delle
    // province, non l'ultima riga scritta.
    if (prima) prima.province = [...new Set([...prima.province, ...province])];
    else out.set(chiave, { nome: pulisci(z.raccoglitore), province, note: pulisci(z.note) });
  }
  return out;
}

/**
 * L'ANDAMENTO DI UN ANNO, raccoglitore per raccoglitore.
 *
 * Per ciascuno: i chili raccolti mese per mese, il target del mese quando c'e', lo
 * scarto, e dove ha raccolto (province). Se la sua zona e' dichiarata, le province
 * fuori zona si dicono a parte, coi loro chili: e' l'unica cosa che un perimetro
 * scritto permette di affermare.
 *
 * `targetPerMese(chiave, meseIdx, nome)` e' una funzione che chi chiama passa: qui
 * non si legge nessun archivio, cosi' questo file resta puro e provabile. Il nome
 * arriva insieme alla chiave perche' i target di Target & Status sono scritti a
 * mano, spesso abbreviati, e si riconoscono per contenuto e non per chiave.
 */
export function andamentoRaccoglitori(primarieRete, {
  anno,
  zone = [],
  targetPerMese = () => null,
  nomi = new Map(),
} = {}) {
  const annoNum = Number(anno);
  const zonaDi = zonePerRaccoglitore(zone, annoNum);
  const perRacc = new Map();

  for (const r of primarieRete || []) {
    if (!eTerminato(r)) continue;
    // Una primaria di classe 9 e' ACI anche se sta nell'archivio della rete
    // (decisione dell'utente, 28/09/2026): qui si guarda solo la rete.
    if (canaleMovimento(r, 'PrimariaRete') !== 'RETE') continue;
    const giorno = giornoMovimento(r);
    if (!giorno || giorno.slice(0, 4) !== String(annoNum)) continue;
    const nome = pulisci(r.trasportatore);
    const chiave = normalizzaRagioneSociale(nome);
    if (!chiave) continue;
    if (!perRacc.has(chiave)) {
      perRacc.set(chiave, {
        chiave,
        nome: pulisci(nomi.get(chiave)) || nome,
        mesi: MESI_MOVIMENTI.map(() => ({ kg: 0, ritiri: 0 })),
        province: new Map(),
        kg: 0,
        ritiri: 0,
      });
    }
    const racc = perRacc.get(chiave);
    const meseIdx = Number(giorno.slice(5, 7)) - 1;
    const peso = kg(r.peso_effettivo);
    racc.mesi[meseIdx].kg += peso;
    racc.mesi[meseIdx].ritiri += 1;
    racc.kg += peso;
    racc.ritiri += 1;
    const prov = sigla(r.provincia);
    if (prov) {
      if (!racc.province.has(prov)) racc.province.set(prov, { provincia: prov, regione: getRegioneFromProvincia(prov) || '', kg: 0, ritiri: 0 });
      const p = racc.province.get(prov);
      p.kg += peso;
      p.ritiri += 1;
    }
  }

  const righe = [...perRacc.values()].map(racc => {
    const zona = zonaDi.get(racc.chiave) || null;
    const province = [...racc.province.values()].sort((a, b) => b.kg - a.kg);
    // "La zona e' dichiarata?" e' una domanda da si' o no: un null qui si
    // trascinerebbe fino a video, dove un "forse" non vuol dire niente.
    const dichiarata = !!zona && zona.province.length > 0;
    const fuoriZona = dichiarata ? province.filter(p => !zona.province.includes(p.provincia)) : [];
    const mesi = racc.mesi.map((m, i) => {
      const target = targetPerMese(racc.chiave, i, racc.nome);
      const targetKg = target === null || target === undefined ? null : kg(target);
      return {
        mese: MESI_MOVIMENTI[i],
        kg: m.kg,
        ritiri: m.ritiri,
        target_kg: targetKg,
        // Lo scarto c'e' solo dove c'e' un target: senza, un "−1.200 kg" sarebbe
        // un giudizio inventato su un mese per cui nessuno ha chiesto niente.
        scarto_kg: targetKg === null ? null : m.kg - targetKg,
        copertura: targetKg ? Math.round((m.kg / targetKg) * 1000) / 10 : null,
      };
    });
    const targetAnno = mesi.reduce((s, m) => (m.target_kg === null ? s : s + m.target_kg), 0);
    const conTarget = mesi.some(m => m.target_kg !== null);
    return {
      chiave: racc.chiave,
      nome: racc.nome,
      mesi,
      kg: racc.kg,
      ritiri: racc.ritiri,
      target_anno_kg: conTarget ? targetAnno : null,
      scarto_anno_kg: conTarget ? racc.kg - targetAnno : null,
      copertura_anno: conTarget && targetAnno ? Math.round((racc.kg / targetAnno) * 1000) / 10 : null,
      province,
      zona_dichiarata: dichiarata,
      zona_province: zona ? zona.province : [],
      fuori_zona: fuoriZona,
      fuori_zona_kg: fuoriZona.reduce((s, p) => s + p.kg, 0),
    };
  }).sort((a, b) => b.kg - a.kg);

  return {
    anno: annoNum,
    mesi: MESI_MOVIMENTI,
    righe,
    totale_kg: righe.reduce((s, r) => s + r.kg, 0),
    totali_mese: MESI_MOVIMENTI.map((_, i) => righe.reduce((s, r) => s + r.mesi[i].kg, 0)),
    // Quanti raccoglitori hanno una zona scritta: finche' non ce l'hanno, il modulo
    // non puo' dire niente sul fuori zona, e va detto invece di tacere.
    con_zona: righe.filter(r => r.zona_dichiarata).length,
    senza_zona: righe.filter(r => !r.zona_dichiarata).map(r => r.nome),
  };
}

/**
 * L'ANDAMENTO PER ZONA: le province, con dentro chi ci ha raccolto.
 *
 * E' l'altra faccia della stessa fotografia, quella che l'utente chiama «andamento
 * generale per zone di competenza»: non quanto ha fatto un raccoglitore, ma quanto
 * e' uscito da una provincia e per mano di chi. Un raccoglitore che compare in una
 * provincia che non gli compete si vede subito, perche' la riga lo dice.
 */
export function andamentoPerZona(andamento) {
  const perProvincia = new Map();
  for (const r of andamento.righe) {
    for (const p of r.province) {
      if (!perProvincia.has(p.provincia)) {
        perProvincia.set(p.provincia, {
          provincia: p.provincia, regione: p.regione, kg: 0, ritiri: 0,
          raccoglitori: [], fuori_zona_kg: 0,
        });
      }
      const z = perProvincia.get(p.provincia);
      const suo = r.zona_dichiarata ? r.zona_province.includes(p.provincia) : null;
      z.kg += p.kg;
      z.ritiri += p.ritiri;
      if (suo === false) z.fuori_zona_kg += p.kg;
      z.raccoglitori.push({ nome: r.nome, chiave: r.chiave, kg: p.kg, ritiri: p.ritiri, di_sua_competenza: suo });
    }
  }
  const zone = [...perProvincia.values()].sort((a, b) => b.kg - a.kg);
  for (const z of zone) z.raccoglitori.sort((a, b) => b.kg - a.kg);
  return zone;
}

/**
 * Le province da PROPORRE come zona di un raccoglitore, prese da dove ha
 * effettivamente raccolto nell'anno. E' un punto di partenza da correggere, mai una
 * zona: dedurre il perimetro da dove uno ha lavorato renderebbe impossibile, per
 * costruzione, accorgersi che ha lavorato fuori perimetro.
 *
 * `soglia_kg` tiene fuori il ritiro isolato: una provincia con quattro quintali in
 * un anno non e' una zona di competenza, e proporla la farebbe diventare tale.
 */
export function proponiZona(riga, { soglia_kg = 1000 } = {}) {
  return {
    raccoglitore: riga.nome,
    province: riga.province.filter(p => p.kg >= soglia_kg).map(p => p.provincia),
    scartate: riga.province.filter(p => p.kg < soglia_kg).map(p => ({ provincia: p.provincia, kg: p.kg })),
  };
}
