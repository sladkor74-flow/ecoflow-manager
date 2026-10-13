import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { raccoglitoriAttivi, situazioneCanali, MESI } from "../../shared/evasioneAssegnati.ts";
import { targetMensiliAnno, targetRaccoglitoreMese } from "../../shared/targetRaccoglitori.ts";
import { oggiRoma } from "../../shared/reportSettimanali.ts";
import { caricaDati, alleggerisciVecchi, eseguiControlli, indiceSicurezza, ultimoCaricamentoPrimarie } from "../../shared/evasioneAssegnatiDati.ts";
import { eAlleggerito } from "../../shared/conservazione.ts";
import { leggiJson, precaricaParti } from "../../shared/testoLungo.ts";

// Situazione dell'evasione degli assegnati per un mese, o per tutti i mesi di un anno.
//
// Payload: { anno, mese } oppure { anno, anno_intero: true }
// Per ogni raccoglitore: target del mese, raccolto per canale (rete, ACI, extra
// raccolta), richieste ACI ed extra ancora aperte, lista caricata e ultimo
// controllo con i suoi alert. Se nel frattempo sono state caricate primarie piu'
// recenti e il controllo non e' ancora partito, lo esegue prima di rispondere.
// Con un caricamento delle primarie aperto non lo esegue e lo dice in
// caricamento_aperto ({ interrotto, messaggio }, altrimenti null).
//
// UN ANNO IN UNA LETTURA (segnalazione alta A3 del 20/09, corretta il
// 12/10/2026). La pagina chiamava questa funzione a ogni mese che si guardava,
// e ogni chiamata rileggeva per intero sei archivi (primarie di rete e ACI,
// assegnati di rete e ACI, extra raccolta, fornitori: 10.487 primarie di rete
// l'11/10/2026, tre pagine) piu' i target, le liste e un controllo per lista:
// sfogliare quattro mesi erano quattro letture di tutto, sul limite di richieste
// al minuto che vale per tutta l'app. Con anno_intero la funzione legge gli
// archivi una volta e risponde per i dodici mesi ({ mesi: { 1: {...}, ... } }),
// e la pagina sfoglia i mesi in memoria. Il calcolo di ogni mese e' lo stesso di
// prima (situazioneDelMese qui sotto): cambia solo quante volte si legge. Gli
// ultimi controlli delle liste si leggono in blocco per anno, non uno per lista.
//
// { anno, mese } resta com'era, risposta compresa: la usa una pagina aperta
// prima della pubblicazione, finche' non si ricarica.

const CAMPI_CONTROLLO = [
  'id', 'eseguito_il', 'primarie_caricate_il', 'dati_al', 'richieste', 'evase', 'evase_da_altri', 'aperte', 'prioritarie_aperte', 'arretrate_aperte',
  'fuori_ordine', 'trascurate', 'fuori_lista', 'non_piu_presenti', 'annullate', 'riassegnate', 'raccolto_kg', 'target_kg', 'proiezione_kg',
  'evadibili_ritmo', 'evadibili_target', 'alert_alti', 'alert_totali',
  // Senza questi due la pagina non sa che al controllo e' stato tolto il
  // dettaglio, e un mese con quattro segnalazioni alte si mostrerebbe verde.
  'storia', 'alleggerito_il',
];

// L'ultimo controllo di ogni lista, letto in blocco: tutti i controlli dell'anno
// in una lettura (anno e' obbligatorio su ogni controllo, ed e' quello della sua
// lista), poi il piu' recente per lista. Prima era una lettura per lista, cioe'
// una decina per mese.
async function ultimiControlli(base44, anno, liste) {
  const ids = new Set(liste.map(l => l.id));
  const ultimo = new Map();
  for (const c of await fetchAll(base44.asServiceRole.entities.ControlloEvasione, { anno })) {
    if (!ids.has(c.lista_id)) continue;
    const p = ultimo.get(c.lista_id);
    if (!p || String(c.eseguito_il || '') > String(p.eseguito_il || '')) ultimo.set(c.lista_id, c);
  }
  // Gli alert lunghi sono divisi in parti: si leggono tutte insieme.
  await precaricaParti(base44, 'ControlloEvasione', [...ultimo.values()], ['alert_json']);
  return ultimo;
}

// La situazione di un mese: e' il calcolo che la funzione faceva per il mese
// chiesto, con gli archivi e i controlli gia' letti.
async function situazioneDelMese(base44, { anno, mese, oggi, dati, listeMese, targetAnno, attiviAnno, attivi, controlloDi }) {
  // Una lista alleggerita non ha piu' le sue righe: quali ordini conteneva non
  // si sa piu'. Trattarla come una lista vuota farebbe risultare "in nessuna
  // lista caricata" ordini che invece c'erano, e aprirebbe un alert falso su
  // ogni mese ormai archiviato.
  const listeConRighe = listeMese.filter(l => !eAlleggerito(l) && String(l.righe_json || '').trim() !== '');
  const idsInListe = new Set();
  for (const l of listeConRighe) for (const r of await leggiJson(base44, 'ListaAssegnati', l, 'righe_json')) idsInListe.add(r.id_ordine);
  const senzaRaccolta = [];
  const raccoglitori = attivi.filter(r => {
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
    if (listeConRighe.length) {
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
      const ultimo = await controlloDi(lista);
      if (ultimo) {
        controllo = Object.fromEntries(CAMPI_CONTROLLO.map(k => [k, ultimo[k]]));
        controllo.alert = await leggiJson(base44, 'ControlloEvasione', ultimo, 'alert_json');
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
        // Anche la lista ha la sua storia, quando le e' stato tolto il
        // dettaglio: senza questi due campi resterebbe scritta in archivio e
        // non la leggerebbe nessuno.
        storia: lista.storia || '', alleggerito_il: lista.alleggerito_il || '',
        avvisi: await leggiJson(base44, 'ListaAssegnati', lista, 'avvisi_json'),
      } : null,
      controllo,
    });
  }
  // Prima chi ha una lista, poi chi ha richieste aperte in qualche canale, poi gli altri.
  const haAperte = (x) => Number(!x.non_raccoglie && (x.assegnati_ora > 0 || x.canali.aci.aperte.length > 0 || x.canali.extra.aperte.length > 0));
  righe.sort((a, b) => (Number(!!b.lista) - Number(!!a.lista)) || (haAperte(b) - haAperte(a)) || a.nome.localeCompare(b.nome, 'it'));
  return { raccoglitori: righe, senza_raccolta: senzaRaccolta };
}

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const anno = Number(body.anno), mese = Number(body.mese);
    const annoIntero = body.anno_intero === true;
    if (!anno || (!annoIntero && !mese)) return Response.json({ error: 'anno e mese sono obbligatori' }, { status: 400 });
    const mesi = annoIntero ? MESI.map((_, i) => i + 1) : [mese];

    const svc = base44.asServiceRole.entities;
    // Alleggerire e' una scrittura: la fa solo chi puo' scrivere. Aprire la
    // pagina per consultarla non deve toccare l'archivio.
    if (user.role === 'admin') await alleggerisciVecchi(base44, { finoAIndice: indiceSicurezza(), massimo: 15 });

    const [dati, liste, targetAnno, primarieIl] = await Promise.all([
      caricaDati(base44),
      fetchAll(svc.ListaAssegnati, { anno }),
      targetMensiliAnno(base44, anno),
      ultimoCaricamentoPrimarie(base44),
    ]);
    const listeDeiMesi = liste.filter(l => mesi.includes(Number(l.mese)));

    // Controlli rimasti indietro rispetto all'ultimo caricamento delle primarie
    // o a un target cambiato in Target & Status. Per un anno intero sono le
    // liste di tutti i suoi mesi, come le ricontrolla da sola la fine di ogni
    // caricamento delle primarie (controllaEvasioneAssegnati). Una lista che non
    // si riesce a ricontrollare non toglie la vista dei dodici mesi: si dice, e
    // le sue liste mostrano l'ultimo controllo riuscito. Per il mese solo resta
    // com'era, un errore.
    let controlliNonRiusciti = null;
    try {
      await eseguiControlli(base44, { liste: listeDeiMesi, dati, forza: false });
    } catch (e) {
      if (!annoIntero) throw e;
      controlliNonRiusciti = e && e.message ? e.message : String(e);
    }

    const oggi = oggiRoma();

    // Chi non ha formulari terminati nell'anno non raccoglie: i suoi ordini
    // assegnati sul portale finiscono nelle liste di altri e si segnalano a parte.
    const attiviAnno = new Set(dati.terminati.filter(t => t.fine && t.fine.slice(0, 4) === String(anno)).map(t => t.chiaveTrasp));
    const attivi = raccoglitoriAttivi(dati.terminati, dati.assegnati, dati.anagrafica, anno);

    // L'ultimo controllo di ogni lista: per un anno intero in blocco; per il
    // mese solo come prima, una lettura per lista, che sono poche.
    let controlloDi;
    if (annoIntero) {
      const ultimi = await ultimiControlli(base44, anno, listeDeiMesi);
      controlloDi = async (lista) => ultimi.get(lista.id) || null;
    } else {
      controlloDi = async (lista) => (await svc.ControlloEvasione.filter({ lista_id: lista.id }, '-eseguito_il', 1))[0] || null;
    }
    // Gli avvisi lunghi delle liste, divisi in parti, tutti insieme.
    if (annoIntero) await precaricaParti(base44, 'ListaAssegnati', listeDeiMesi, ['avvisi_json']);

    const perMese = {};
    for (const m of mesi) {
      perMese[m] = await situazioneDelMese(base44, {
        anno, mese: m, oggi, dati, listeMese: listeDeiMesi.filter(l => Number(l.mese) === m), targetAnno, attiviAnno, attivi, controlloDi,
      });
    }

    // Regola 2: con un caricamento delle primarie aperto, interrotto o concluso
    // durante la lettura, eseguiControlli non ha ricontrollato niente e raccolto,
    // canali e alert dei canali qui sopra vengono da un archivio che si stava
    // riscrivendo. La pagina lo deve dire, e lo sa solo da qui: prima il rinvio
    // restava muto e quei numeri sembravano validi.
    if (!annoIntero) {
      return Response.json({
        anno, mese, primarie_caricate_il: primarieIl, raccoglitori: perMese[mese].raccoglitori, senza_raccolta: perMese[mese].senza_raccolta,
        caricamento_aperto: dati.caricamento_aperto,
      });
    }
    return Response.json({
      anno, anno_intero: true, primarie_caricate_il: primarieIl, mesi: perMese,
      caricamento_aperto: dati.caricamento_aperto, controlli_non_riusciti: controlliNonRiusciti,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
