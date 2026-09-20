import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { calcolaRigheAttiva, eRigaACorpo, TIPOLOGIE_ATTIVA } from "../../shared/attivaCalcolo.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const r2 = (v) => Math.round(v * 100) / 100;

// Elabora la fatturazione attiva per un dato anno/mese:
// genera 3 documenti (RETE, ACI, EXTRA_RACCOLTA), mai sommati fra loro, con le
// righe calcolate da base44/shared/attivaCalcolo.ts - le stesse dell'anteprima.
// Cliente/committente: sempre ECOTYRE.
//
// La sostituzione e' in due tempi: prima si scrive il documento nuovo come
// bozza, poi lo si promuove, e solo alla fine si ritira il vecchio. Un'interruzione
// a meta' lascia il mese com'era, non vuoto. Un documento gia' approvato o
// esportato non si cancella: resta nello storico come superato, col motivo.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
    const { anno, mese } = await req.json();
    if (!anno || !mese) return Response.json({ error: 'Anno e mese obbligatori' }, { status: 400 });
    const meseIdx = MESI.indexOf(mese);
    if (meseIdx < 0) return Response.json({ error: `Mese non riconosciuto: ${mese}` }, { status: 400 });

    const annoNum = Number(anno);
    const Doc = base44.asServiceRole.entities.DocumentoFatturazione;
    const Voce = base44.asServiceRole.entities.VoceFatturazione;

    const existing = await Doc.filter({ tipo: 'ATTIVA', anno: annoNum, mese });
    if (existing.some(d => d.stato === 'chiusa' && !d.superato)) {
      return Response.json({ error: 'Periodo già chiuso. Impossibile rielaborare.' }, { status: 400 });
    }

    const [reteAll, aciAll, extraAll, fornitori, tariffe] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.PrimariaRete),
      fetchAll(base44.asServiceRole.entities.PrimariaAci),
      fetchAll(base44.asServiceRole.entities.ExtraRaccolta),
      fetchAll(base44.asServiceRole.entities.Fornitore),
      base44.asServiceRole.entities.Tariffa.filter({ direzione: 'ATTIVA' }),
    ]);
    const { righe, anomalie, extra_secondarie_escluse } = calcolaRigheAttiva({ reteAll, aciAll, extraAll, fornitori, tariffe, anno: annoNum, mese });

    // Bozze rimaste da un'elaborazione interrotta: non sono mai state valide.
    for (const d of existing.filter(d => d.stato === 'bozza')) {
      await Voce.deleteMany({ documento_id: d.id });
      await Doc.delete(d.id);
    }
    const precedenti = existing.filter(d => d.stato !== 'bozza' && !d.superato);

    // La data e' un giorno di calendario: si scrive senza passare dal fuso del server.
    const pad = (n) => String(n).padStart(2, '0');
    const dataInizio = `${annoNum}-${pad(meseIdx + 1)}-01`;
    const dataFine = `${annoNum}-${pad(meseIdx + 1)}-${pad(new Date(Date.UTC(annoNum, meseIdx + 1, 0)).getUTCDate())}`;
    const adesso = new Date().toISOString();

    const docs = [];
    const ripartizionePerTipologia = {};
    for (const tipo of TIPOLOGIE_ATTIVA) {
      const lista = righe[tipo];
      const errori = lista.filter(r => r.stato_validazione === 'errore').length;
      const totale = r2(lista.reduce((s, r) => s + r.totale, 0));
      const rip = { TRASP: { ordini: 0, kg: 0, totale: 0 }, TRASP_TRATT: { ordini: 0, kg: 0, totale: 0 } };
      for (const r of lista) {
        const x = rip[r.servizio_ecotyre];
        if (!x) continue;
        if (!eRigaACorpo(r)) { x.ordini++; x.kg += r.quantita; }
        x.totale += r.totale;
      }
      ripartizionePerTipologia[tipo] = rip;

      const doc = await Doc.create({
        tipo: 'ATTIVA', tipologia: tipo, anno: annoNum, mese,
        data_inizio: dataInizio, data_fine: dataFine,
        stato: 'bozza',
        totale, numero_voci: lista.length,
        voci_errore: errori, voci_sospese: 0,
        data_elaborazione: adesso,
        cliente: 'ECOTYRE',
      });
      const conDoc = lista.map(r => ({ ...r, documento_id: doc.id }));
      for (let i = 0; i < conDoc.length; i += 100) await Voce.bulkCreate(conDoc.slice(i, i + 100));
      docs.push({ tipologia: tipo, documento_id: doc.id, totale, voci: lista.length, errori, sospese: 0 });
    }

    // Tutte le righe sono scritte: i nuovi documenti diventano validi...
    for (const d of docs) await Doc.update(d.documento_id, { stato: 'elaborata' });
    // ...e i precedenti si ritirano. Una bozza di lavoro si sostituisce; cio' che
    // era gia' stato approvato o esportato resta nello storico, col motivo.
    const superati = [];
    for (const d of precedenti) {
      if (['approvata', 'esportata'].includes(d.stato)) {
        const nuovo = docs.find(x => x.tipologia === d.tipologia);
        await Doc.update(d.id, {
          superato: true,
          motivo_superato: `Rielaborato il ${adesso.slice(0, 10)} da ${user.full_name || user.email}: il documento era ${d.stato} con totale ${Number(d.totale || 0).toFixed(2)} €, il nuovo calcolo dà ${Number(nuovo?.totale || 0).toFixed(2)} €.`,
        });
        superati.push({ tipologia: d.tipologia, stato: d.stato, totale: d.totale });
      } else {
        await Voce.deleteMany({ documento_id: d.id });
        await Doc.delete(d.id);
      }
    }

    const chiudi = (x) => ({ ordini: x.ordini, kg: Math.round(x.kg), ton: r2(x.kg / 1000), totale: r2(x.totale) });
    return Response.json({
      documenti: docs,
      anomalie,
      superati,
      extra_secondarie_escluse,
      // Per canale, come tutto il resto: i tre canali non si sommano.
      ripartizione_servizio_per_tipologia: Object.fromEntries(TIPOLOGIE_ATTIVA.map(t => [t, { TRASP: chiudi(ripartizionePerTipologia[t].TRASP), TRASP_TRATT: chiudi(ripartizionePerTipologia[t].TRASP_TRATT) }])),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
