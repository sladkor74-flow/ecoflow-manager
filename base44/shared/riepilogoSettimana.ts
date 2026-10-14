// IL RACCOLTO DI UNA SETTIMANA, PER IL RIEPILOGO DELLA DIREZIONE (14/10/2026).
//
// L'utente il 14/10/2026 ha approvato «quanto da creare», e fra le cose da
// creare c'era «un riepilogo settimanale per la direzione, il lunedi', in PDF o
// per email: target e scarti per regione, alert critici, dichiarazioni da fare,
// fatture del mese». Il PDF si fa dalla dashboard coi numeri che la dashboard ha
// gia' letto (src/lib/riepilogoSettimanale.js). Uno solo non c'e': il raccolto
// della settimana. Il quadro della commessa conta per mese, e rileggere le
// primarie intere per sapere una settimana costerebbe quanto il quadro.
//
// Qui il conto di quella settimana, sulle sole righe che la settimana ha: la
// funzione riepilogoSettimana le chiede all'archivio con un filtro sulla fine
// trasporto (una pagina per canale, un centinaio di righe di rete), e il taglio
// vero lo fa il giorno italiano. Le regole sono quelle della dashboard
// (getDashboardRaccolta), perche' la settimana e l'anno del PDF dicano numeri
// che tornano fra loro:
// - terminati, nel giorno italiano di trasporto_finito_il (periodoMovimento),
//   mai la chiusura a portale;
// - il peso effettivo; i ritiri sono ordini distinti (chiaveOrdine), come il
//   quadro;
// - la regione della dashboard (regioneDellaDashboard), quella della tabella
//   delle regioni del contratto;
// - dell'extra raccolta la raccolta dal produttore, non i trasferimenti in
//   secondaria che stanno nello stesso archivio.
// RETE, ACI ed EXTRA RACCOLTA restano separati: nessun campo li somma. Nessun
// euro: la funzione la chiama chiunque, e i costi sono dell'amministratore.
// Solo server, nessuno specchio: la pagina riceve i numeri fatti.
import { periodoMovimento, eTerminato, chiaveOrdine } from "./movimenti.ts";
import { regioneDellaDashboard } from "./contrattoRete.ts";

export const NOMI_GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

const t3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
const GIORNO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'AAAA-MM-GG' spostato di n giorni sul calendario, senza passare da nessun fuso. */
export function piuGiorni(g, n) {
  const m = GIORNO.exec(String(g || ''));
  if (!m) return '';
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n)).toISOString().slice(0, 10);
}

/** Vero se 'AAAA-MM-GG' e' una data vera ed e' un lunedi'. */
export function eLunedi(g) {
  const m = GIORNO.exec(String(g || ''));
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === g && d.getUTCDay() === 1;
}

/**
 * Il filtro per chiedere all'archivio le righe della settimana. L'archivio
 * confronta istanti UTC, il gestionale ragiona sul giorno italiano: la
 * mezzanotte italiana del lunedi' e' ancora domenica in UTC (22:00Z d'estate),
 * quindi si chiede un giorno in piu' davanti, come la quadratura FIR
 * (quadraturaFirDati.ts), e il taglio vero lo fa raccoltoDellaSettimana.
 */
export function filtroSettimana(dal) {
  return { stato: 'terminato', trasporto_finito_il: { $gte: `${piuGiorni(dal, -1)}T00:00:00`, $lte: `${piuGiorni(dal, 6)}T23:59:59.999Z` } };
}

/** Il conto di un canale: tonnellate, ritiri, giorno per giorno e, se chiesti, regioni e raccoglitori. */
function contoDelCanale(righe, giorni, { perRegione = false, perRaccoglitore = false } = {}) {
  const perGiorno = new Map(giorni.map(g => [g, { kg: 0, ordini: new Set() }]));
  const regioni = new Map();
  const raccoglitori = new Map();
  const ordini = new Set();
  let kg = 0;
  righe.forEach((r, i) => {
    const p = periodoMovimento(r);
    const g = p ? perGiorno.get(p.giorno) : null;
    if (!g) return;
    const peso = Number(r.peso_effettivo) || 0;
    const chiave = chiaveOrdine(r, i);
    kg += peso;
    ordini.add(chiave);
    g.kg += peso;
    g.ordini.add(chiave);
    if (perRegione) {
      const reg = regioneDellaDashboard(r);
      const x = regioni.get(reg) || { kg: 0, ordini: new Set() };
      x.kg += peso; x.ordini.add(chiave);
      regioni.set(reg, x);
    }
    if (perRaccoglitore) {
      const nome = String(r.trasportatore || '').trim() || 'N/D';
      const x = raccoglitori.get(nome) || { kg: 0, ordini: new Set(), regioni: new Set() };
      x.kg += peso; x.ordini.add(chiave); x.regioni.add(regioneDellaDashboard(r));
      raccoglitori.set(nome, x);
    }
  });
  return {
    t: t3(kg / 1000),
    ritiri: ordini.size,
    giorni: giorni.map(g => ({ giorno: g, t: t3(perGiorno.get(g).kg / 1000), ritiri: perGiorno.get(g).ordini.size })),
    ...(perRegione ? {
      regioni: [...regioni].map(([regione, x]) => ({ regione, t: t3(x.kg / 1000), ritiri: x.ordini.size }))
        .sort((a, b) => b.t - a.t || a.regione.localeCompare(b.regione, 'it')),
    } : {}),
    ...(perRaccoglitore ? {
      raccoglitori: [...raccoglitori].map(([raccoglitore, x]) => ({ raccoglitore, regioni: [...x.regioni].sort((a, b) => a.localeCompare(b, 'it')), t: t3(x.kg / 1000), ritiri: x.ordini.size }))
        .sort((a, b) => b.t - a.t || a.raccoglitore.localeCompare(b.raccoglitore, 'it')),
    } : {}),
  };
}

/**
 * Il raccolto della settimana che comincia il lunedi' `dal`, canale per canale.
 * rete, aci, extra: le righe lette (anche di qualche ora fuori dalla settimana:
 * il taglio si fa qui); null se la lettura non e' riuscita, e il canale lo dice
 * con { letto: false } invece di scrivere zero. oggi: il giorno italiano; i
 * giorni dopo oggi sono futuri.
 * -> { dal, al, oggi, giorni: [{ giorno, nome, futuro }], rete, aci, extra }
 */
export function raccoltoDellaSettimana({ dal, oggi, rete = null, aci = null, extra = null }) {
  const tutti = NOMI_GIORNI.map((_, i) => piuGiorni(dal, i));
  const al = tutti[6];
  // Si contano i giorni fino a oggi: una fine trasporto dopo oggi e' un dato da
  // correggere, non un ritiro della settimana in corso. Cosi' il totale e' la
  // somma dei giorni che il PDF scrive, e la dashboard non la conta (il giorno
  // dei dati non va mai oltre oggi, giornoDeiDati di attesoContratto.ts).
  const giorni = tutti.filter(g => g <= oggi);
  const soloTerminati = (rr) => (rr || []).filter(eTerminato);
  const canale = (rr, opzioni) => (rr === null ? { letto: false } : { letto: true, ...contoDelCanale(soloTerminati(rr), giorni, opzioni) });
  // la raccolta dal produttore: i trasferimenti in secondaria riporterebbero lo
  // stesso peso una seconda volta (la regola di getDashboardRaccolta)
  const dalProduttore = extra === null ? null : extra.filter(r => String(r.tipo_movimento || 'primaria').toLowerCase().trim() !== 'secondaria');
  return {
    dal, al, oggi,
    giorni: tutti.map((g, i) => ({ giorno: g, nome: NOMI_GIORNI[i], futuro: g > oggi })),
    rete: canale(rete, { perRegione: true, perRaccoglitore: true }),
    aci: canale(aci),
    extra: canale(dalProduttore),
  };
}
