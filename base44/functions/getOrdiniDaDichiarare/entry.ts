import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { giornoRoma, annoRoma, oggiRoma } from "../../shared/giornoItaliano.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";

// Restituisce l'elenco paginato degli ordini in attesa di dichiarazione (OrdineNonDichiarato).
// Payload: { sito, provincia, anno, ricerca, limite, offset } - tutti opzionali.
// Richiede solo utente autenticato.
//
// Tutto per FINE DEL TRASPORTO, sul giorno italiano: l'anno, l'ordinamento e i
// giorni di attesa. La data di chiusura dell'ordine a portale si mostra soltanto
// e non decide nulla (regola dell'utente, 21/09/2026). Il file e' della rete: una
// riga ACI, se mai ci fosse, resta fuori, perche' i canali non si mescolano.
//
// Filtri:
//   sito     -> destinazione_secondaria se valorizzata, altrimenti destinazione (normalizzaRagioneSociale)
//   provincia-> confronto in maiuscolo e con trim
//   anno     -> anno della fine trasporto (accetta ancora anno_chiusura dalle pagine vecchie)
//   ricerca  -> corrispondenza parziale case-insensitive su numero_fir e ordine_primaria
//
// Restituisce: righe (paginate), totale_righe, totale_kg, siti_distinti, province_distinte, anni_distinti.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { sito, provincia, ricerca, limite, offset } = body;
    const anno = body.anno ?? body.anno_chiusura;

    const norm = normalizzaRagioneSociale;
    const limiteNum = Math.min(Number(limite) || 100, 1000);
    const offsetNum = Math.max(Number(offset) || 0, 0);

    const all = (await fetchAll(base44.asServiceRole.entities.OrdineNonDichiarato)).filter(r => !eAci({ prodotto: r.prodotto }));

    const sitoNorm = sito ? norm(sito) : null;
    const provUpper = provincia ? String(provincia).trim().toUpperCase() : null;
    const annoNum = anno ? Number(anno) : null;
    const ricercaLower = ricerca ? String(ricerca).trim().toLowerCase() : null;

    function sitoDiRiga(r) {
      const sec = String(r.destinazione_secondaria || '').trim();
      if (sec) return sec;
      return String(r.destinazione || '').trim();
    }

    const filtrate = [];
    const sitiSet = new Set();
    const provinceSet = new Set();
    const anniSet = new Set();
    const oggi = oggiRoma();
    const giorniFra = (da, a) => Math.round((Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) - Date.UTC(+da.slice(0, 4), +da.slice(5, 7) - 1, +da.slice(8, 10))) / 86400000);

    for (const r of all) {
      // Valori distinti per i filtri, su tutti i record
      const s = sitoDiRiga(r);
      if (s) sitiSet.add(s);
      const prov = String(r.provincia || '').trim().toUpperCase();
      if (prov) provinceSet.add(prov);
      const annoFine = annoRoma(r.fine_trasporto);
      if (annoFine !== null) anniSet.add(annoFine);

      if (sitoNorm && norm(s) !== sitoNorm) continue;
      if (provUpper && prov !== provUpper) continue;
      if (annoNum !== null && annoFine !== annoNum) continue;
      if (ricercaLower) {
        const fir = String(r.numero_fir || '').toLowerCase();
        const ord = String(r.ordine_primaria || '').toLowerCase();
        if (!fir.includes(ricercaLower) && !ord.includes(ricercaLower)) continue;
      }
      filtrate.push(r);
    }

    // Dal carico arrivato da piu' tempo; quelli senza fine trasporto in fondo.
    filtrate.sort((a, b) => (giornoRoma(a.fine_trasporto) || '9999').localeCompare(giornoRoma(b.fine_trasporto) || '9999'));

    const totale_righe = filtrate.length;
    const totale_kg = filtrate.reduce((s, r) => s + (Number(r.peso_non_dichiarato_kg) || 0), 0);
    const pagina = filtrate.slice(offsetNum, offsetNum + limiteNum);

    const righe = pagina.map(r => {
      const fine = giornoRoma(r.fine_trasporto);
      return {
        ordine_primaria: r.ordine_primaria || '',
        numero_fir: r.numero_fir || '',
        fine_trasporto: fine || null,
        // Solo da mostrare: non decide nulla.
        data_chiusura: r.data_chiusura || null,
        punto_di_raccolta: r.punto_di_raccolta || '',
        comune: r.comune || '',
        provincia: r.provincia || '',
        prodotto: r.prodotto || '',
        cer: r.cer || '',
        peso_non_dichiarato_kg: Number(r.peso_non_dichiarato_kg) || 0,
        destinazione: r.destinazione || '',
        destinazione_secondaria: r.destinazione_secondaria || '',
        trasportatore: r.trasportatore || '',
        // Da quanti giorni il carico e' arrivato e aspetta la dichiarazione.
        giorni_attesa: fine ? giorniFra(fine, oggi) : null,
      };
    });

    return Response.json({
      righe,
      totale_righe,
      totale_kg: Math.round(totale_kg * 100) / 100,
      siti_distinti: [...sitiSet].sort(),
      province_distinte: [...provinceSet].sort(),
      anni_distinti: [...anniSet].sort((a, b) => a - b),
      limite: limiteNum,
      offset: offsetNum
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
