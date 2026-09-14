// Report settimanale della raccolta primaria RETE: per raccoglitore e regione il
// target del mese, il raccolto di ogni settimana del mese, il residuo del mese,
// il totale raccolto nell'anno e il residuo del target annuo.
//
// Le regole sono quelle del foglio TERMINATI RETE del file di gestione:
// - solo formulari terminati del canale RETE, per data di fine trasporto;
// - settimane da lunedi' a domenica, la prima e' quella che contiene il 1 gennaio;
//   una settimana a cavallo di due mesi conta nel mese solo per i suoi giorni;
// - il raccolto va al raccoglitore del target con lo stesso nome, oppure con un
//   nome abbreviato, nella regione del punto di raccolta; se in quella regione non
//   ha target ma ne ha in una sola altra regione, va su quella riga e si indica
//   come raccolto fuori regione (come Nappi in Basilicata nel file).
//
// Le tonnellate si arrotondano ai kg.

import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { PROV_TO_REGION, MESI } from "./raccoltoCalculator.ts";

const t3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
const GIORNO = 86400000;

/** Numero della settimana: lunedi'-domenica, settimana 1 = quella del 1 gennaio. */
export function numeroSettimana(data) {
  const anno = data.getUTCFullYear();
  const inizio = Date.UTC(anno, 0, 1);
  const lunediPrimo = (new Date(inizio).getUTCDay() + 6) % 7; // lunedi' = 0
  const giornoAnno = Math.floor((Date.UTC(anno, data.getUTCMonth(), data.getUTCDate()) - inizio) / GIORNO);
  return Math.floor((giornoAnno + lunediPrimo) / 7) + 1;
}

/** Settimane del mese (1-12) con i giorni che cadono nel mese. */
export function settimaneDelMese(anno, mese) {
  const giorni = new Date(Date.UTC(anno, mese, 0)).getUTCDate();
  const out = [];
  for (let g = 1; g <= giorni; g++) {
    const d = new Date(Date.UTC(anno, mese - 1, g));
    const n = numeroSettimana(d);
    const giorno = d.toISOString().slice(0, 10);
    const ultima = out[out.length - 1];
    if (ultima && ultima.numero === n) ultima.al = giorno;
    else out.push({ numero: n, dal: giorno, al: giorno });
  }
  return out;
}

// Giorno di calendario della fine trasporto: le date del portale sono a mezzanotte
// UTC; quelle salvate a mezzanotte italiana (22 o 23 UTC) si riportano al giorno giusto.
function giornoFine(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const italiana = (d.getUTCHours() === 22 || d.getUTCHours() === 23) && !d.getUTCMinutes() && !d.getUTCSeconds();
  return italiana ? new Date(d.getTime() + 3 * 3600000) : d;
}

function stessoNome(nomeTarget, nomePortale) {
  const a = normalizzaRagioneSociale(nomeTarget || '');
  const b = normalizzaRagioneSociale(nomePortale || '');
  if (!a || !b) return false;
  if (a === b) return true;
  const paroleB = new Set(b.split(' '));
  const paroleA = a.split(' ').filter(p => p.length > 2);
  return paroleA.length > 0 && paroleA.every(p => paroleB.has(p));
}

/**
 * rete: PrimariaRete; mensili: TargetMensile dell'anno; annui: TargetRaccoglitore
 * dell'anno; mese 1-12.
 */
export function calcolaReportSettimanale({ rete = [], mensili = [], annui = [], anno, mese }) {
  const nomeMese = MESI[mese - 1];
  const settimane = settimaneDelMese(anno, mese);
  const indiceSettimana = new Map(settimane.map((s, i) => [s.numero, i]));
  const righe = new Map();
  const riga = (regione, nome) => {
    const k = `${regione || ''}|${normalizzaRagioneSociale(nome || '')}`;
    if (!righe.has(k)) {
      righe.set(k, {
        regione: regione || '', raccoglitore: String(nome || '').trim(), con_target: false, non_raccoglie: false,
        target_mese: 0, annuo: 0, settimane: settimane.map(() => 0), raccolto_mese: 0, totale_anno: 0, impianti: new Map(), fuori_regione: new Map(),
      });
    }
    return righe.get(k);
  };

  for (const a of annui) {
    const r = riga(a.regione, a.raccoglitore);
    r.annuo += Number(a.target_tonnellate) || 0;
    r.con_target = true;
  }
  for (const t of mensili) {
    const r = riga(t.regione, t.raccoglitore);
    r.con_target = true;
    if (t.mese !== nomeMese) continue;
    if (t.non_raccoglie) r.non_raccoglie = true;
    else r.target_mese += Number(t.target) || 0;
  }

  // Ogni nome del portale va a una sola riga: prima il nome uguale, poi l'abbreviazione.
  const conTarget = [...righe.values()];
  const assegnazioni = new Map();
  const rigaDelRecord = (regione, trasportatore) => {
    const k = `${regione}|${trasportatore}`;
    if (assegnazioni.has(k)) return assegnazioni.get(k);
    const b = normalizzaRagioneSociale(trasportatore);
    const altrove = () => {
      const stesse = conTarget.filter(r => r.regione !== regione && normalizzaRagioneSociale(r.raccoglitore) === b);
      const candidate = stesse.length ? stesse : conTarget.filter(r => r.regione !== regione && stessoNome(r.raccoglitore, trasportatore));
      return candidate.length === 1 ? candidate[0] : null;
    };
    const trovata = conTarget.find(r => r.regione === regione && normalizzaRagioneSociale(r.raccoglitore) === b)
      || conTarget.find(r => r.regione === regione && stessoNome(r.raccoglitore, trasportatore))
      || altrove()
      || riga(regione, trasportatore);
    assegnazioni.set(k, trovata);
    return trovata;
  };

  let ultimaFine = null;
  for (const p of rete) {
    if (String(p.stato || '').toLowerCase().trim() !== 'terminato') continue;
    const d = giornoFine(p.trasporto_finito_il);
    if (!d || d.getUTCFullYear() !== anno) continue;
    const peso = (Number(p.peso_effettivo) || 0) / 1000;
    const regione = PROV_TO_REGION[String(p.provincia || '').toUpperCase().trim()] || 'Altro';
    const r = rigaDelRecord(regione, String(p.trasportatore || 'N/D').trim());
    r.totale_anno += peso;
    if (r.regione !== regione) r.fuori_regione.set(regione, (r.fuori_regione.get(regione) || 0) + peso);
    if (!ultimaFine || d > ultimaFine) ultimaFine = d;
    if (d.getUTCMonth() !== mese - 1) continue;
    r.raccolto_mese += peso;
    const i = indiceSettimana.get(numeroSettimana(d));
    if (i !== undefined) r.settimane[i] += peso;
    const imp = String(p.destinazione || 'N/D').trim();
    r.impianti.set(imp, (r.impianti.get(imp) || 0) + peso);
  }

  const elenco = [...righe.values()]
    .filter(r => r.annuo > 0 || r.target_mese > 0 || r.non_raccoglie || r.totale_anno > 0)
    .map(r => ({
      regione: r.regione,
      raccoglitore: r.raccoglitore,
      senza_target: !r.con_target,
      non_raccoglie: r.non_raccoglie,
      target_mese: t3(r.target_mese),
      settimane: r.settimane.map(t3),
      raccolto_mese: t3(r.raccolto_mese),
      residuo_mese: t3(r.target_mese - r.raccolto_mese),
      annuo: t3(r.annuo),
      totale_anno: t3(r.totale_anno),
      residuo_anno: t3(r.annuo - r.totale_anno),
      impianti: [...r.impianti.entries()].map(([impianto, t]) => ({ impianto, t: t3(t) })).sort((a, b) => b.t - a.t),
      fuori_regione: [...r.fuori_regione.entries()].map(([regione, t]) => ({ regione, t: t3(t) })),
    }))
    .sort((a, b) => a.regione.localeCompare(b.regione, 'it') || a.raccoglitore.localeCompare(b.raccoglitore, 'it'));

  return { anno, mese, nome_mese: nomeMese, settimane, righe: elenco, dati_fino_al: ultimaFine ? ultimaFine.toISOString().slice(0, 10) : null };
}
