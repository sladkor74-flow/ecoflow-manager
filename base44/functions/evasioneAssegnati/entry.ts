import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { raccoglitoriAttivi, trovaTarget, situazioneCanali, MESI } from "../../shared/evasioneAssegnati.ts";
import { oggiRoma } from "../../shared/reportSettimanali.ts";
import { caricaDati, cancellaVecchi, eseguiControlli, indiceSicurezza, ultimoCaricamentoPrimarie } from "../../shared/evasioneAssegnatiDati.ts";

// Situazione dell'evasione degli assegnati per un mese.
//
// Payload: { anno, mese }
// Per ogni raccoglitore: target del mese, raccolto per canale (rete, ACI, extra
// raccolta), richieste ACI ed extra ancora aperte, lista caricata e ultimo
// controllo con i suoi alert. Se nel frattempo sono state caricate primarie piu'
// recenti e il controllo non e' ancora partito, lo esegue prima di rispondere.

const CAMPI_CONTROLLO = [
  'id', 'eseguito_il', 'primarie_caricate_il', 'dati_al', 'richieste', 'evase', 'evase_da_altri', 'aperte', 'prioritarie_aperte',
  'fuori_ordine', 'trascurate', 'fuori_lista', 'non_piu_presenti', 'riassegnate', 'raccolto_kg', 'target_kg', 'proiezione_kg',
  'evadibili_ritmo', 'evadibili_target', 'alert_alti', 'alert_totali',
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const anno = Number(body.anno), mese = Number(body.mese);
    if (!anno || !mese) return Response.json({ error: 'anno e mese sono obbligatori' }, { status: 400 });

    const svc = base44.asServiceRole.entities;
    await cancellaVecchi(base44, { finoAIndice: indiceSicurezza() });

    const [dati, liste, targetAnno, primarieIl] = await Promise.all([
      caricaDati(base44),
      fetchAll(svc.ListaAssegnati, { anno }),
      fetchAll(svc.TargetRaccoglitorePrimaria, { anno }),
      ultimoCaricamentoPrimarie(base44),
    ]);
    const listeMese = liste.filter(l => Number(l.mese) === mese);

    // Controlli rimasti indietro rispetto all'ultimo caricamento delle primarie.
    await eseguiControlli(base44, { liste: listeMese, dati, forza: false });

    const oggi = oggiRoma();
    const targetsMese = targetAnno.filter(t => t.mese === MESI[mese - 1]);
    const raccoglitori = raccoglitoriAttivi(dati.terminati, dati.assegnati, dati.anagrafica, anno);
    for (const l of listeMese) {
      if (!raccoglitori.some(r => r.chiave === l.raccoglitore_chiave)) raccoglitori.push({ chiave: l.raccoglitore_chiave, nome: l.raccoglitore_nome });
    }

    const righe = [];
    for (const r of raccoglitori) {
      const target = trovaTarget(targetsMese, r.nome);
      // Il nome con cui il raccoglitore compare nei target degli altri mesi: un
      // nuovo target va salvato con quello, per non creare un doppione.
      const altroMese = trovaTarget(targetAnno, r.nome);
      // Canali sempre separati: target e lista riguardano la sola rete.
      const { canali, alert: alertCanali } = situazioneCanali({ chiave: r.chiave, anno, mese, oggi, terminati: dati.terminati, assegnati: dati.assegnati });
      const assegnatiOra = dati.assegnati.filter(a => a.canale === 'rete' && a.chiaveTrasp === r.chiave).length;
      const lista = listeMese.find(l => l.raccoglitore_chiave === r.chiave) || null;
      let controllo = null;
      if (lista) {
        const ultimi = await svc.ControlloEvasione.filter({ lista_id: lista.id }, '-eseguito_il', 1);
        if (ultimi.length) {
          controllo = Object.fromEntries(CAMPI_CONTROLLO.map(k => [k, ultimi[0][k]]));
          controllo.alert = JSON.parse(ultimi[0].alert_json || '[]');
        }
      }
      righe.push({
        chiave: r.chiave,
        nome: r.nome,
        target_kg: target ? Number(target.target_kg) || 0 : null,
        target_id: target ? target.id : null,
        target_nome: target ? target.raccoglitore : (altroMese ? altroMese.raccoglitore : r.nome),
        raccolto_kg: canali.rete.kg,
        assegnati_ora: assegnatiOra,
        canali,
        alert_canali: alertCanali,
        lista: lista ? {
          id: lista.id, file_nomi: lista.file_nomi, caricata_il: lista.caricata_il, richieste: lista.richieste, prioritarie: lista.prioritarie,
          avvisi: JSON.parse(lista.avvisi_json || '[]'),
        } : null,
        controllo,
      });
    }
    // Prima chi ha una lista, poi chi ha richieste aperte in qualche canale, poi gli altri.
    const haAperte = (x) => Number(x.assegnati_ora > 0 || x.canali.aci.aperte.length > 0 || x.canali.extra.aperte.length > 0);
    righe.sort((a, b) => (Number(!!b.lista) - Number(!!a.lista)) || (haAperte(b) - haAperte(a)) || a.nome.localeCompare(b.nome, 'it'));

    return Response.json({ anno, mese, primarie_caricate_il: primarieIl, raccoglitori: righe });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
