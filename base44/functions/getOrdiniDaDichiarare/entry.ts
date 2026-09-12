import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";

// Restituisce l'elenco paginato degli ordini in attesa di dichiarazione (OrdineNonDichiarato).
// Payload: { sito, provincia, anno_chiusura, ricerca, limite, offset } - tutti opzionali.
// Richiede solo utente autenticato.
//
// Filtri:
//   sito         -> destinazione_secondaria se valorizzata, altrimenti destinazione (normalizzaRagioneSociale)
//   provincia    -> confronto in maiuscolo e con trim
//   anno_chiusura-> anno della data in data_chiusura
//   ricerca      -> corrispondenza parziale case-insensitive su numero_fir e ordine_primaria
//
// Restituisce: righe (paginate), totale_righe, totale_kg, siti_distinti, province_distinte, anni_distinti.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { sito, provincia, anno_chiusura, ricerca, limite, offset } = body;

    const norm = normalizzaRagioneSociale;
    const limiteNum = Math.min(Number(limite) || 100, 1000);
    const offsetNum = Math.max(Number(offset) || 0, 0);

    // Carica tutti i record (fetchAll paginato)
    const all = await fetchAll(base44.asServiceRole.entities.OrdineNonDichiarato);

    // Filtri
    const sitoNorm = sito ? norm(sito) : null;
    const provUpper = provincia ? String(provincia).trim().toUpperCase() : null;
    const annoNum = anno_chiusura ? Number(anno_chiusura) : null;
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

    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    for (const r of all) {
      // Raccogli valori distinti per i filtri (su tutti i record)
      const s = sitoDiRiga(r);
      if (s) sitiSet.add(s);
      const prov = String(r.provincia || '').trim().toUpperCase();
      if (prov) provinceSet.add(prov);
      if (r.data_chiusura) {
        const d = new Date(r.data_chiusura);
        if (!isNaN(d.getTime())) anniSet.add(d.getFullYear());
      }

      // Applica filtro sito
      if (sitoNorm && norm(s) !== sitoNorm) continue;
      // Applica filtro provincia
      if (provUpper && prov !== provUpper) continue;
      // Applica filtro anno_chiusura
      if (annoNum !== null) {
        if (!r.data_chiusura) continue;
        const d = new Date(r.data_chiusura);
        if (isNaN(d.getTime()) || d.getFullYear() !== annoNum) continue;
      }
      // Applica filtro ricerca
      if (ricercaLower) {
        const fir = String(r.numero_fir || '').toLowerCase();
        const ord = String(r.ordine_primaria || '').toLowerCase();
        if (!fir.includes(ricercaLower) && !ord.includes(ricercaLower)) continue;
      }

      filtrate.push(r);
    }

    // Ordina per data_chiusura crescente (piu' vecchio primo); record senza data in fondo
    filtrate.sort((a, b) => {
      const da = a.data_chiusura ? new Date(a.data_chiusura).getTime() : Infinity;
      const db = b.data_chiusura ? new Date(b.data_chiusura).getTime() : Infinity;
      return da - db;
    });

    // Totali su tutte le righe filtrate
    const totale_righe = filtrate.length;
    const totale_kg = filtrate.reduce((s, r) => s + (Number(r.peso_non_dichiarato_kg) || 0), 0);

    // Paginazione
    const pagina = filtrate.slice(offsetNum, offsetNum + limiteNum);

    // Costruisci righe di risposta
    const righe = pagina.map(r => {
      let giorni_attesa = null;
      if (r.data_chiusura) {
        const d = new Date(r.data_chiusura);
        if (!isNaN(d.getTime())) {
          d.setHours(0, 0, 0, 0);
          giorni_attesa = Math.floor((oggi - d) / 86400000);
        }
      }
      return {
        ordine_primaria: r.ordine_primaria || '',
        numero_fir: r.numero_fir || '',
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
        giorni_attesa
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