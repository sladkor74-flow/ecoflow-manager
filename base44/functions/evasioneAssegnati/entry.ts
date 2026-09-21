import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { raccoglitoriAttivi, situazioneCanali, MESI } from "../../shared/evasioneAssegnati.ts";
import { targetMensiliAnno, targetRaccoglitoreMese } from "../../shared/targetRaccoglitori.ts";
import { oggiRoma } from "../../shared/reportSettimanali.ts";
import { caricaDati, cancellaVecchi, eseguiControlli, indiceSicurezza, ultimoCaricamentoPrimarie } from "../../shared/evasioneAssegnatiDati.ts";
import { leggiJson } from "../../shared/testoLungo.ts";

// Situazione dell'evasione degli assegnati per un mese.
//
// Payload: { anno, mese }
// Per ogni raccoglitore: target del mese, raccolto per canale (rete, ACI, extra
// raccolta), richieste ACI ed extra ancora aperte, lista caricata e ultimo
// controllo con i suoi alert. Se nel frattempo sono state caricate primarie piu'
// recenti e il controllo non e' ancora partito, lo esegue prima di rispondere.
// Con un caricamento delle primarie aperto non lo esegue e lo dice in
// caricamento_aperto ({ interrotto, messaggio }, altrimenti null).

const CAMPI_CONTROLLO = [
  'id', 'eseguito_il', 'primarie_caricate_il', 'dati_al', 'richieste', 'evase', 'evase_da_altri', 'aperte', 'prioritarie_aperte', 'arretrate_aperte',
  'fuori_ordine', 'trascurate', 'fuori_lista', 'non_piu_presenti', 'annullate', 'riassegnate', 'raccolto_kg', 'target_kg', 'proiezione_kg',
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
      targetMensiliAnno(base44, anno),
      ultimoCaricamentoPrimarie(base44),
    ]);
    const listeMese = liste.filter(l => Number(l.mese) === mese);

    // Controlli rimasti indietro rispetto all'ultimo caricamento delle primarie
    // o a un target cambiato in Target & Status.
    await eseguiControlli(base44, { liste: listeMese, dati, forza: false });

    const oggi = oggiRoma();

    // Chi non ha formulari terminati nell'anno non raccoglie: i suoi ordini
    // assegnati sul portale finiscono nelle liste di altri e si segnalano a parte.
    const attiviAnno = new Set(dati.terminati.filter(t => t.fine && t.fine.slice(0, 4) === String(anno)).map(t => t.chiaveTrasp));
    const idsInListe = new Set();
    for (const l of listeMese) for (const r of await leggiJson(base44, 'ListaAssegnati', l, 'righe_json')) idsInListe.add(r.id_ordine);
    const senzaRaccolta = [];
    const raccoglitori = raccoglitoriAttivi(dati.terminati, dati.assegnati, dati.anagrafica, anno).filter(r => {
      if (attiviAnno.has(r.chiave) || listeMese.some(l => l.raccoglitore_chiave === r.chiave)) return true;
      const suoi = dati.assegnati.filter(a => a.chiaveTrasp === r.chiave);
      if (suoi.length) {
        senzaRaccolta.push({
          nome: r.nome,
          assegnati: suoi.filter(a => a.canale === 'rete').length,
          aci: suoi.filter(a => a.canale === 'aci').length,
          in_liste: suoi.filter(a => idsInListe.has(a.id_ordine)).length,
        });
      }
      return false;
    });
    for (const l of listeMese) {
      if (!raccoglitori.some(r => r.chiave === l.raccoglitore_chiave)) raccoglitori.push({ chiave: l.raccoglitore_chiave, nome: l.raccoglitore_nome });
    }

    const righe = [];
    for (const r of raccoglitori) {
      // Target del mese da Target & Status, sommando le regioni.
      const target = targetRaccoglitoreMese(targetAnno, r.nome, MESI[mese - 1]);
      // Canali sempre separati: target e lista riguardano la sola rete.
      const { canali, alert: alertCanali } = situazioneCanali({ chiave: r.chiave, anno, mese, oggi, terminati: dati.terminati, assegnati: dati.assegnati });
      // Gli ordini degli anni precedenti hanno priorita' assoluta: se sul portale
      // sono assegnati a questo raccoglitore ma non stanno in nessuna lista del
      // mese, nessuno ha avuto l'indicazione di evaderli.
      if (listeMese.length) {
        const arretrati = dati.assegnati.filter(a => a.canale === 'rete' && a.chiaveTrasp === r.chiave && a.immesso && a.immesso < `${anno}-01-01` && !idsInListe.has(a.id_ordine));
        if (arretrati.length) {
          const n = arretrati.length;
          const elenco = arretrati.slice(0, 4).map(a => `${a.id_ordine} del ${a.immesso.split('-').reverse().join('/')}${a.provincia ? ` (${a.provincia})` : ''}`).join(', ') + (n > 4 ? ` e altri ${n - 4}` : '');
          alertCanali.push({ gravita: 'media', tipo: 'arretrati_senza_lista', messaggio: `${n === 1 ? 'Un ordine immesso' : `${n} ordini immessi`} prima del ${anno} e assegnat${n === 1 ? 'o' : 'i'} sul portale a questo raccoglitore non ${n === 1 ? "e'" : 'sono'} in nessuna lista caricata, pur avendo priorita' assoluta: ${elenco}.` });
        }
      }
      const assegnatiOra = dati.assegnati.filter(a => a.canale === 'rete' && a.chiaveTrasp === r.chiave).length;
      const lista = listeMese.find(l => l.raccoglitore_chiave === r.chiave) || null;
      let controllo = null;
      if (lista) {
        const ultimi = await svc.ControlloEvasione.filter({ lista_id: lista.id }, '-eseguito_il', 1);
        if (ultimi.length) {
          controllo = Object.fromEntries(CAMPI_CONTROLLO.map(k => [k, ultimi[0][k]]));
          controllo.alert = await leggiJson(base44, 'ControlloEvasione', ultimi[0], 'alert_json');
        }
      }
      righe.push({
        chiave: r.chiave,
        nome: r.nome,
        target_kg: target && target.target_kg > 0 ? target.target_kg : null,
        target_regioni: target ? target.regioni : [],
        non_raccoglie: !!(target && target.non_raccoglie),
        raccolto_kg: canali.rete.kg,
        assegnati_ora: assegnatiOra,
        canali,
        alert_canali: alertCanali,
        lista: lista ? {
          id: lista.id, file_nomi: lista.file_nomi, caricata_il: lista.caricata_il, inviata_il: lista.inviata_il, richieste: lista.richieste, prioritarie: lista.prioritarie,
          avvisi: await leggiJson(base44, 'ListaAssegnati', lista, 'avvisi_json'),
        } : null,
        controllo,
      });
    }
    // Prima chi ha una lista, poi chi ha richieste aperte in qualche canale, poi gli altri.
    const haAperte = (x) => Number(!x.non_raccoglie && (x.assegnati_ora > 0 || x.canali.aci.aperte.length > 0 || x.canali.extra.aperte.length > 0));
    righe.sort((a, b) => (Number(!!b.lista) - Number(!!a.lista)) || (haAperte(b) - haAperte(a)) || a.nome.localeCompare(b.nome, 'it'));

    // Regola 2: con un caricamento delle primarie aperto, interrotto o concluso
    // durante la lettura, eseguiControlli non ha ricontrollato niente e raccolto,
    // canali e alert dei canali qui sopra vengono da un archivio che si stava
    // riscrivendo. La pagina lo deve dire, e lo sa solo da qui: prima il rinvio
    // restava muto e quei numeri sembravano validi.
    return Response.json({
      anno, mese, primarie_caricate_il: primarieIl, raccoglitori: righe, senza_raccolta: senzaRaccolta,
      caricamento_aperto: dati.caricamento_aperto,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
