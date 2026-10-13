import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { eTerminato, periodoMovimento } from "../../shared/movimenti.ts";
import { riepilogoDateVista } from "../../shared/raccoltoCalculator.ts";
import { provinceDelContratto } from "../../shared/primarieReteAnalytics.ts";
import { commessaDellAnno } from "../../shared/annoTarget.ts";

// Raccolta della RETE per provincia e mese: peso effettivo e numero di ritiri.
//
// Riprende le due tabelle che stavano nel foglio "TERMINATI RETE" del file Excel,
// prendendo pero' i dati dal gestionale. Solo il canale RETE: ACI ed extra
// raccolta restano separati, come sempre.
//
// Il mese e' quello di fine trasporto, la stessa data con cui il gestionale
// misura tutto il resto; si contano i soli ordini terminati e il peso e' quello
// effettivo, mai lo stimato.
//
// LE PROVINCE DEL CONTRATTO ANCHE SENZA RITIRI (revisione del 13/10/2026). Le
// righe nascevano solo dai movimenti: una provincia del contratto dell'anno mai
// servita non compariva, e non poteva avere i suoi mesi di fila senza ritiri,
// lo stesso difetto che la matrice delle Primarie ha avuto fino al 12/10. Ora i
// contratti si leggono insieme ai ritiri (una lettura in piu' per la pagina, non
// per provincia) e le province del contratto dell'anno mostrato
// (provinceDelContratto) entrano con kg e ritiri a zero. Ogni riga dice se e'
// del contratto (del_contratto) e se nell'anno non ha ritiri (senza_ritiri). Se
// i contratti non si leggono la matrice resta quella dei soli movimenti e la
// risposta lo dice (contratto_letto: false), invece di far finta che il
// contratto non abbia province.
//
// Payload: { anno }   Risposta: { anno, anni, mesi, righe, totali, senza_fine_trasporto, senza_provincia, date_da_sistemare, contratto_letto }

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

// Anno e mese vengono dal giorno italiano della fine trasporto (periodoMovimento):
// tagliare la stringa UTC metteva un ritiro del 1 settembre a mezzanotte
// italiana (31/08 22:00Z) nella colonna di agosto.

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const [record, commesse] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.PrimariaRete),
      fetchAll(base44.asServiceRole.entities.CommessaEcotyre).catch(() => null),
    ]);

    const anni = new Set();
    for (const r of record) {
      const p = eTerminato(r) ? periodoMovimento(r) : null;
      if (p) anni.add(p.anno);
    }
    const anno = Number(body.anno) || Math.max(...anni, Number(oggiRoma().slice(0, 4)));

    const province = new Map();
    // Chi resta fuori dalla matrice si conta, invece di sparire: un terminato
    // senza fine trasporto non ha un mese (non si ripiega su chiusura o
    // immissione), un ritiro senza provincia non ha una riga.
    let senzaFineTrasporto = 0;
    const senzaProvincia = { ritiri: 0, kg: 0 };
    // i ritiri dell'anno, con o senza provincia, per le date da sistemare
    const dellAnno = [];
    for (const r of record) {
      if (!eTerminato(r)) continue;
      const p = periodoMovimento(r);
      if (!p) { senzaFineTrasporto++; continue; }
      if (p.anno !== anno) continue;
      dellAnno.push(r);
      const sigla = String(r.provincia || r.sigla || '').toUpperCase().trim();
      if (!sigla) { senzaProvincia.ritiri++; senzaProvincia.kg += Math.round(Number(r.peso_effettivo) || 0); continue; }
      if (!province.has(sigla)) {
        province.set(sigla, { provincia: sigla, regione: String(r.regione || '').trim(), kg: MESI.map(() => 0), ritiri: MESI.map(() => 0) });
      }
      const riga = province.get(sigla);
      if (!riga.regione && r.regione) riga.regione = String(r.regione).trim();
      riga.kg[p.mese_idx] += Math.round(Number(r.peso_effettivo) || 0);
      riga.ritiri[p.mese_idx] += 1;
    }

    // Le province del contratto dell'anno senza un ritiro, a zero (13/10/2026).
    const delContratto = commesse ? provinceDelContratto(commessaDellAnno(commesse, anno), anno) : [];
    for (const { provincia, regione } of delContratto) {
      if (province.has(provincia)) continue;
      province.set(provincia, { provincia, regione, kg: MESI.map(() => 0), ritiri: MESI.map(() => 0) });
    }
    const inContratto = new Set(delContratto.map(p => p.provincia));

    const righe = [...province.values()]
      .map(r => {
        const ritiriTotale = r.ritiri.reduce((t, v) => t + v, 0);
        return { ...r, kg_totale: r.kg.reduce((t, v) => t + v, 0), ritiri_totale: ritiriTotale, del_contratto: inContratto.has(r.provincia), senza_ritiri: ritiriTotale === 0 };
      })
      .sort((a, b) => a.regione.localeCompare(b.regione, 'it') || a.provincia.localeCompare(b.provincia, 'it'));

    const totali = {
      kg: MESI.map((_, i) => righe.reduce((t, r) => t + r.kg[i], 0)),
      ritiri: MESI.map((_, i) => righe.reduce((t, r) => t + r.ritiri[i], 0)),
      kg_totale: righe.reduce((t, r) => t + r.kg_totale, 0),
      ritiri_totale: righe.reduce((t, r) => t + r.ritiri_totale, 0),
    };

    // senza_fine_trasporto: terminati di rete di qualunque anno, esclusi da ogni mese.
    // date_da_sistemare (regola dell'utente, 22/09/2026: immissione, inizio e fine
    // trasporto sono obbligatorie in ogni formulario terminato): quei terminati
    // senza fine trasporto e i ritiri dell'anno con un'altra data che manca o non
    // torna, che nella matrice ci sono, nel mese della fine trasporto.
    return Response.json({
      anno, anni: [...anni].sort((a, b) => b - a), mesi: MESI, righe, totali,
      senza_fine_trasporto: senzaFineTrasporto, senza_provincia: senzaProvincia,
      date_da_sistemare: riepilogoDateVista(record, dellAnno),
      contratto_letto: commesse !== null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
