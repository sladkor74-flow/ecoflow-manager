// I numeri del gestionale per la quadratura settimanale dei formulari.
//
// Si leggono come nel modulo Report Mensile: stato terminato e fine trasporto
// dentro la settimana, peso sempre effettivo. Di ogni cella - impianto di
// destinazione e trasportatore - si tiene il conteggio, il peso e l'elenco dei
// formulari con il loro ID ordine, che e' quello che serve per capire da dove
// viene uno scostamento.
//
// Oltre alla settimana si guarda una fascia di quattro giorni prima e dopo: un
// formulario che a portale cade nella settimana e nel gestionale no si spiega
// quasi sempre con una fine trasporto a cavallo del lunedi' o della domenica.

import { perPagina } from "./fetchAll.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";

export const GIORNI_FASCIA = 4;

// I flussi che il gestionale sa contare, con l'entita' da cui si leggono.
export const FLUSSI_DATI = [
  { chiave: 'rete_primarie', entita: 'PrimariaRete', movimento: null, caricamenti: ['primarie_rete', 'primarie'] },
  { chiave: 'rete_secondarie', entita: 'Secondaria', movimento: null, caricamenti: ['secondarie'] },
  { chiave: 'aci_primarie', entita: 'PrimariaAci', movimento: null, caricamenti: ['primarie_aci', 'primarie'] },
  { chiave: 'extra_primarie', entita: 'ExtraRaccolta', movimento: 'primaria', caricamenti: ['extra_raccolta'] },
  { chiave: 'extra_secondarie', entita: 'ExtraRaccolta', movimento: 'secondaria', caricamenti: ['extra_raccolta'] },
];

function utc(ymd) {
  return new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)));
}

function piuGiorni(ymd, giorni) {
  const d = utc(ymd);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

const soloData = (v) => (v ? String(v).slice(0, 10) : null);
const eTerminato = (r) => String(r.stato || '').toLowerCase().trim() === 'terminato';
const nome = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

function chiaveCella(r) {
  return normalizzaRagioneSociale(r.destinazione) + '|' + normalizzaRagioneSociale(r.trasportatore);
}

function formulario(r) {
  return {
    fir: nome(r.numero_fir),
    ordine: nome(r.id_ordine),
    kg: Math.round(Number(r.peso_effettivo) || 0),
    data: soloData(r.trasporto_finito_il),
    impianto: nome(r.destinazione),
    trasportatore: nome(r.trasportatore),
  };
}

/**
 * I movimenti del gestionale della settimana, flusso per flusso.
 *
 * @param {object} base44   client con asServiceRole
 * @param {object} periodo  { inizio, fine } giorni compresi
 * @param {array}  soloFlussi chiavi da calcolare; se vuoto, tutte
 */
export async function caricaGestionale(base44, periodo, soloFlussi = null) {
  const svc = base44.asServiceRole.entities;
  const { inizio, fine } = periodo;
  const primoFascia = piuGiorni(inizio, -GIORNI_FASCIA);
  const ultimoFascia = piuGiorni(fine, GIORNI_FASCIA);

  const flussi = FLUSSI_DATI.filter(f => !soloFlussi || soloFlussi.includes(f.chiave));
  // Un'entita' si legge una volta sola anche quando serve a due flussi (extra raccolta).
  const entita = [...new Set(flussi.map(f => f.entita))];
  const raccolta = {};
  for (const f of flussi) {
    raccolta[f.chiave] = { celle: new Map(), vicini: [], annullati: [], senza_peso: [], totale: { n: 0, kg: 0 } };
  }

  await Promise.all(entita.map(async (e) => {
    const suoi = flussi.filter(f => f.entita === e);
    await perPagina(svc[e], null, (r) => {
      const d = soloData(r.trasporto_finito_il);
      if (!d || d < primoFascia || d > ultimoFascia) return;
      const movimento = String(r.tipo_movimento || 'primaria').toLowerCase().trim();
      for (const f of suoi) {
        if (f.movimento && movimento !== f.movimento) continue;
        const dati = raccolta[f.chiave];
        const dentro = d >= inizio && d <= fine;
        const fir = formulario(r);
        if (!eTerminato(r)) {
          if (dentro) dati.annullati.push({ ...fir, motivo: nome(r.motivo_cancellazione) || nome(r.stato) });
          continue;
        }
        if (!dentro) {
          dati.vicini.push({ ...fir, giorni: d < inizio ? -1 : 1 });
          continue;
        }
        const k = chiaveCella(r);
        if (!dati.celle.has(k)) {
          dati.celle.set(k, { impianto: fir.impianto, trasportatore: fir.trasportatore, n: 0, kg: 0, formulari: [] });
        }
        const cella = dati.celle.get(k);
        cella.n++;
        cella.kg += fir.kg;
        cella.formulari.push(fir);
        dati.totale.n++;
        dati.totale.kg += fir.kg;
        if (!fir.kg) dati.senza_peso.push(fir);
      }
    });
  }));

  // L'ultimo caricamento di ogni tipo di file: spiega un gestionale non aggiornato.
  const tipi = [...new Set(flussi.flatMap(f => f.caricamenti))];
  const ultimi = {};
  await Promise.all(tipi.map(async (t) => {
    const righe = await svc.UploadLog.filter({ tipo_file: t }, '-created_date', 5);
    const buono = (righe || []).find(r => r.esito !== 'errore');
    if (buono) ultimi[t] = { data: soloData(buono.created_date), nome_file: nome(buono.nome_file) };
  }));

  const out = {};
  for (const f of flussi) {
    const dati = raccolta[f.chiave];
    const caricamenti = f.caricamenti.map(t => ultimi[t]).filter(Boolean).sort((a, b) => String(b.data).localeCompare(String(a.data)));
    out[f.chiave] = {
      celle: [...dati.celle.values()].map(c => ({ ...c, kg: Math.round(c.kg) })),
      vicini: dati.vicini,
      annullati: dati.annullati,
      senza_peso: dati.senza_peso,
      totale: { n: dati.totale.n, kg: Math.round(dati.totale.kg) },
      ultimo_caricamento: caricamenti[0] || null,
    };
  }
  return out;
}
