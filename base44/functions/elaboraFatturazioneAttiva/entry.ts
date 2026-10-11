import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { calcolaRigheAttiva, eRigaACorpo, TIPOLOGIE_ATTIVA } from "../../shared/attivaCalcolo.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { controlloCaricamenti, TIPI_RINVIO } from "../../shared/statoArchivi.ts";
import { tipiDeiCanali } from "../../shared/registroCaricamenti.ts";

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const NOMI = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
const r2 = (v) => Math.round(v * 100) / 100;
// La nota del documento superato si legge nello Storico: all'italiana, come
// tutto quello che si vede (chiusura dell'audit, 11/10/2026). Prima diceva «con
// totale 372976.50 €» e «Rielaborato il 2026-10-11». Un totale che manca non e'
// zero: si scrive «—».
const euroIt = (v) => {
  if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) return '—';
  const n = r2(Number(v));
  const [intero, dec] = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '-' : '') + intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
};
const giornoIt = (g) => String(g || '').split('-').reverse().join('/');

// Elabora la fatturazione attiva per un dato anno/mese:
// genera un documento per canale (RETE, ACI, EXTRA_RACCOLTA), mai sommati fra
// loro, con le righe calcolate da base44/shared/attivaCalcolo.ts - le stesse
// dell'anteprima. Cliente/committente: sempre ECOTYRE.
// Payload: { anno, mese, tipologie? }
//
// Ogni canale ha il suo ciclo di vita, fino alla chiusura e alla riapertura, e
// quindi si rielabora per conto suo. Prima l'elaborazione era a mese intero: con
// la rete chiusa si rifiutava anche di rifare l'ACI a cui era appena stata
// aggiunta la tariffa, e con la rete approvata rifare l'ACI mandava la rete fra
// i superati. Con `tipologie` si rifanno solo quei canali, e si rifiuta solo se
// uno di loro e' chiuso; senza, si rifanno i canali non chiusi, e quelli chiusi
// restano come sono e si dicono nella risposta. I documenti degli altri canali
// non si toccano.
//
// La sostituzione e' in due tempi: prima si scrive il documento nuovo come
// bozza, poi lo si promuove, e solo alla fine si ritira il vecchio. Un'interruzione
// a meta' lascia il mese com'era, non vuoto. Un documento gia' approvato o
// esportato non si cancella: resta nello storico come superato, col motivo.
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
    const { anno, mese, tipologie } = await req.json();
    if (!anno || !mese) return Response.json({ error: 'Anno e mese obbligatori' }, { status: 400 });
    const meseIdx = MESI.indexOf(mese);
    if (meseIdx < 0) return Response.json({ error: `Mese non riconosciuto: ${mese}` }, { status: 400 });
    const richieste = Array.isArray(tipologie) ? [...new Set(tipologie.map(t => String(t || '').trim()).filter(Boolean))] : [];
    const ignote = richieste.filter(t => !TIPOLOGIE_ATTIVA.includes(t));
    if (ignote.length) return Response.json({ error: `Canale non riconosciuto: ${ignote.join(', ')}` }, { status: 400 });

    // NON SU UN ARCHIVIO A META' (chiusura dell'audit, 11/10/2026).
    //
    // I documenti elaborati sono quelli che si approvano, si esportano e si
    // fatturano: elaborati su un archivio a meta' avrebbero meno righe del vero,
    // e niente nel documento lo direbbe. Mentre le primarie si riscrivono, o
    // dopo un loro caricamento interrotto o finito parziale, si risponde 409
    // «rinviato» col motivo e non si scrive niente - neanche la pulizia delle
    // bozze - come gia' fanno verifiche, quadrature e alert. Solo le primarie:
    // l'attiva non legge ne' secondarie ne' terziarie, e un loro caricamento a
    // meta' non deve fermare la fatturazione del mese (TIPI_RINVIO, 11/10/2026).
    // Lo stato si legge prima e dopo aver letto gli archivi: un caricamento che
    // parte mentre si legge, con una lettura sola, non si vedrebbe
    // (controlloCaricamenti, shared/statoArchivi.ts).
    const controllo = await controlloCaricamenti(base44, `l'elaborazione della fatturazione attiva di ${mese} ${anno}`, tipiDeiCanali(TIPI_RINVIO.attiva, richieste));
    if (controllo.rinvio) return controllo.rinvio;

    const annoNum = Number(anno);
    const Doc = base44.asServiceRole.entities.DocumentoFatturazione;
    const Voce = base44.asServiceRole.entities.VoceFatturazione;

    const existing = await Doc.filter({ tipo: 'ATTIVA', anno: annoNum, mese });
    // Un documento chiuso senza canale (di prima dei documenti per canale) vale
    // per tutto il mese, come valeva allora.
    const chiusoSenzaCanale = existing.some(d => d.stato === 'chiusa' && !d.superato && !TIPOLOGIE_ATTIVA.includes(d.tipologia));
    const chiusi = TIPOLOGIE_ATTIVA.filter(t => chiusoSenzaCanale || existing.some(d => d.tipologia === t && d.stato === 'chiusa' && !d.superato));
    let daFare;
    if (richieste.length) {
      const bloccati = richieste.filter(t => chiusi.includes(t));
      if (bloccati.length) {
        return Response.json({ error: `${bloccati.map(t => NOMI[t]).join(', ')} di ${mese} ${annoNum}: il documento è chiuso e non si rielabora. Va prima riaperto.`, chiusi: bloccati }, { status: 400 });
      }
      daFare = TIPOLOGIE_ATTIVA.filter(t => richieste.includes(t));
    } else {
      daFare = TIPOLOGIE_ATTIVA.filter(t => !chiusi.includes(t));
      if (!daFare.length) return Response.json({ error: `${mese} ${annoNum}: tutti i canali sono chiusi. Per rielaborarne uno va prima riaperto.`, chiusi }, { status: 400 });
    }
    const tutti = daFare.length === TIPOLOGIE_ATTIVA.length;
    // Tocca a questa elaborazione un documento del suo canale; quelli senza
    // canale solo quando si rifanno tutti e tre.
    const tocca = (d) => (TIPOLOGIE_ATTIVA.includes(d.tipologia) ? daFare.includes(d.tipologia) : tutti);

    const [reteAll, aciAll, extraAll, fornitori, tariffe] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.PrimariaRete),
      fetchAll(base44.asServiceRole.entities.PrimariaAci),
      fetchAll(base44.asServiceRole.entities.ExtraRaccolta),
      fetchAll(base44.asServiceRole.entities.Fornitore),
      // Tutte le pagine, come l'anteprima e l'assistente: con la pagina di
      // default del backend una tariffa oltre il limite mancava solo qui.
      fetchAll(base44.asServiceRole.entities.Tariffa, { direzione: 'ATTIVA' }),
    ]);
    const calcolo = calcolaRigheAttiva({ reteAll, aciAll, extraAll, fornitori, tariffe, anno: annoNum, mese });
    const { righe } = calcolo;
    // Le anomalie dei canali che non si rifanno non riguardano questa elaborazione.
    const anomalie = calcolo.anomalie.filter(a => !a.tipologia || daFare.includes(a.tipologia));
    const extra_secondarie_escluse = daFare.includes('EXTRA_RACCOLTA') ? calcolo.extra_secondarie_escluse : 0;

    const rinvio = await controllo.dopo();
    if (rinvio) return rinvio;

    // Bozze rimaste da un'elaborazione interrotta: non sono mai state valide.
    for (const d of existing.filter(d => d.stato === 'bozza' && tocca(d))) {
      await Voce.deleteMany({ documento_id: d.id });
      await Doc.delete(d.id);
    }
    const precedenti = existing.filter(d => d.stato !== 'bozza' && !d.superato && tocca(d));
    // Un documento riaperto era gia' stato chiuso (magari fatturato): la sua nota
    // porta chi l'ha riaperto, quando, e giorno e numero della fattura emessa.
    // Non si cancella: resta nello storico come uno approvato o esportato.
    const riaperto = (d) => /Riaperto il /.test(String(d.note || ''));
    const daTenere = (d) => ['approvata', 'esportata'].includes(d.stato) || riaperto(d);

    // La data e' un giorno di calendario: si scrive senza passare dal fuso del server.
    const pad = (n) => String(n).padStart(2, '0');
    const dataInizio = `${annoNum}-${pad(meseIdx + 1)}-01`;
    const dataFine = `${annoNum}-${pad(meseIdx + 1)}-${pad(new Date(Date.UTC(annoNum, meseIdx + 1, 0)).getUTCDate())}`;
    const adesso = new Date().toISOString();

    const docs = [];
    const ripartizionePerTipologia = {};
    for (const tipo of daFare) {
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
        // la storia del canale continua nel documento nuovo
        note: (precedenti.find(p => p.tipologia === tipo) || {}).note || '',
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
      if (daTenere(d)) {
        const nuovo = docs.find(x => x.tipologia === d.tipologia);
        await Doc.update(d.id, {
          superato: true,
          // il giorno italiano: dopo la mezzanotte il giorno UTC e' ancora quello prima
          motivo_superato: `Rielaborato il ${giornoIt(oggiRoma())} da ${user.full_name || user.email}: il documento era ${d.stato}${riaperto(d) ? ' dopo una riapertura' : ''} con totale ${euroIt(d.totale)} €, il nuovo calcolo dà ${euroIt(nuovo?.totale)} €.`,
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
      rielaborati: daFare,
      // i canali chiusi restano come sono: si dice quali, invece di tacerlo
      chiusi_non_rielaborati: chiusi,
      anomalie,
      superati,
      extra_secondarie_escluse,
      // Per canale, come tutto il resto: i tre canali non si sommano.
      ripartizione_servizio_per_tipologia: Object.fromEntries(daFare.map(t => [t, { TRASP: chiudi(ripartizionePerTipologia[t].TRASP), TRASP_TRATT: chiudi(ripartizionePerTipologia[t].TRASP_TRATT) }])),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
