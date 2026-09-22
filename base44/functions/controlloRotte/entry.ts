import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { rotte, conferimentiSospetti, quoteDaStoccaggio, tariffeDaVerificare } from "../../shared/rotteConferimenti.ts";
import { annoRoma, oggiRoma } from "../../shared/giornoItaliano.ts";
import { riepilogoDate } from "../../shared/reportSettimanali.ts";

// Chi conferisce dove, e i formulari che sembrano chiusi sulla destinazione
// sbagliata.
//
// Le rotte si leggono dalla storia dell'anno, archivio per archivio, tenendo i
// canali separati: le secondarie di rete e quelle ACI hanno rotte diverse e non
// vanno confrontate fra loro.
//
// Di ogni flusso si dicono anche i terminati con le date obbligatorie da
// sistemare (immissione, inizio e fine trasporto: regola dell'utente del
// 22/09/2026), di qualunque anno: chi non ha la fine trasporto non ha un anno e
// resta fuori dalle rotte, e senza dirlo il conto dei viaggi sembrava completo.
//
// Payload: { anno }

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const anno = Number(body.anno) || Number(oggiRoma().slice(0, 4));
    const svc = base44.asServiceRole.entities;

    const terminato = (r) => String(r.stato || '').toLowerCase().trim() === 'terminato';
    const dellAnno = (r) => terminato(r) && annoRoma(r.trasporto_finito_il) === anno;

    const [tariffe, rete, aciPrim, secondarie, extra, terziarie] = await Promise.all([
      fetchAll(svc.Tariffa, { stato: 'attivo' }),
      fetchAll(svc.PrimariaRete, { stato: 'terminato' }),
      fetchAll(svc.PrimariaAci, { stato: 'terminato' }),
      fetchAll(svc.Secondaria, { stato: 'terminato' }),
      fetchAll(svc.ExtraRaccolta, { stato: 'terminato' }),
      fetchAll(svc.Terziaria, { stato: 'terminato' }),
    ]);

    const secAnno = secondarie.filter(dellAnno);
    const raccoltaExtra = (r) => String(r.tipo_movimento || 'primaria').toLowerCase().trim() !== 'secondaria';
    // "tutti": i terminati del flusso di qualunque anno, per le date obbligatorie.
    const flussi = [
      { chiave: 'primarie_rete', nome: 'Primarie di rete', archivio: 'PrimariaRete', righe: rete.filter(dellAnno), tutti: rete },
      { chiave: 'primarie_aci', nome: 'Primarie ACI', archivio: 'PrimariaAci', righe: aciPrim.filter(dellAnno), tutti: aciPrim },
      { chiave: 'secondarie_rete', nome: 'Secondarie di rete', archivio: 'Secondaria', righe: secAnno.filter(r => !eAci(r)), tutti: secondarie.filter(r => !eAci(r)) },
      { chiave: 'secondarie_aci', nome: 'Secondarie ACI', archivio: 'Secondaria', righe: secAnno.filter(eAci), tutti: secondarie.filter(eAci) },
      { chiave: 'extra_raccolta', nome: 'Extra raccolta', archivio: 'ExtraRaccolta', righe: extra.filter(dellAnno).filter(raccoltaExtra), tutti: extra.filter(raccoltaExtra) },
      { chiave: 'terziarie', nome: 'Terziarie', archivio: 'Terziaria', righe: terziarie.filter(dellAnno), tutti: terziarie },
    ];

    const senzaRighe = (d) => ({ ...d, righe: undefined });
    const risultato = flussi.map(f => ({
      flusso: f.chiave,
      nome: f.nome,
      movimenti: f.righe.length,
      rotte: rotte(f.righe, f.archivio).map(o => ({ ...o, destinazioni: o.destinazioni.map(senzaRighe) })),
      sospetti: conferimentiSospetti(f.righe, f.archivio),
      // { ordini, senza_fine, esempi: [{ id_ordine, numero_fir, date }] } oppure null
      date_da_sistemare: riepilogoDate(f.tutti, 10),
    }));

    // Gli stoccaggi che alimentano piu' di un impianto: quello che gli
    // appartiene una volta sola - il target di raccolta - si divide fra gli
    // impianti in proporzione alle secondarie che ciascuno riceve.
    const secRete = secAnno.filter(r => !eAci(r));
    const nomiStoccaggio = [...new Set(secRete.map(r => String(r.stoccaggio || '').trim()).filter(Boolean))];
    const condivisi = nomiStoccaggio
      .map(nome => quoteDaStoccaggio(secRete, nome))
      .filter(q => q.impianti.length > 1);

    return Response.json({
      anno,
      flussi: risultato,
      sospetti_per_flusso: risultato.map(f => ({ flusso: f.nome, quanti: f.sospetti.length })),
      stoccaggi_condivisi: condivisi,
      // Chi conferisce su piu' destinazioni senza un prezzo per ciascuna: il
      // contratto potrebbe prevederlo, e allora si sta pagando male.
      tariffe_da_verificare: [
        ...tariffeDaVerificare(rete.filter(dellAnno), 'PrimariaRete', tariffe.filter(t => t.prestazione === 'RACCOLTA'), 'RETE'),
        ...tariffeDaVerificare(aciPrim.filter(dellAnno), 'PrimariaAci', tariffe.filter(t => t.prestazione === 'RACCOLTA'), 'ACI'),
      ],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
