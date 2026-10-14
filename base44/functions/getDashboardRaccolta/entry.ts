import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { PROV_TO_REGION, riepilogoDateVista } from "../../shared/raccoltoCalculator.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { periodoMovimento, giornoMovimento } from "../../shared/movimenti.ts";
import { commessaDellAnno } from "../../shared/annoTarget.ts";
import { targetAnnuoDellAnno, regioniDellAnno, attesoAllaData, attesoDellaRegione, giornoDeiDati } from "../../shared/attesoContratto.ts";
import { formatoTonnellate } from "../../shared/formato.ts";
import { quadroCommessa } from "../../shared/quadroCommessa.ts";

// Restituisce aggregati raccolta per la Dashboard filtrati per mese/anno.
// Payload: { mese?, anno? } — mese è il nome del mese (es. "Agosto"), anno è numerico.
//
// IL QUADRO DELLA COMMESSA (migliorie dell'11/10/2026). Con un anno solo la
// risposta porta anche `quadro`: la pagina e' il quadro della commessa Ecotyre di
// quell'anno, a sezioni per canale (base44/shared/quadroCommessa.ts). Si calcola
// sugli stessi elenchi gia' letti, piu' i target dei raccoglitori dell'anno (due
// pagine piccole) e, per un anno passato, i documenti e le prefatture dell'attiva
// di quell'anno: l'anno in corso ha i suoi mesi dal cruscotto. I campi di prima
// restano identici, perche' li leggono le prove e controllaInvarianti
// (prove/dashboardRaccoltaQuadro.mjs li confronta col codice di prima). Con piu'
// anni il quadro e' null: una commessa e' annuale, e due contratti sommati non
// sono il contratto di nessuno.
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // Supporto filtri multi-selezione: mese e anno possono essere array o singoli valori
    const meseRaw = body.mese || [];
    const mesi = Array.isArray(meseRaw)
      ? meseRaw.filter(m => m && m !== 'Tutti i mesi')
      : (meseRaw && meseRaw !== 'Tutti i mesi' ? [meseRaw] : []);

    const annoRaw = body.anno || [];
    const anni = Array.isArray(annoRaw)
      ? annoRaw.map(Number).filter(a => !isNaN(a) && a > 0)
      : (annoRaw ? [Number(annoRaw)].filter(a => !isNaN(a) && a > 0) : []);
    // Senza anno, l'anno in corso in Italia, come getDashboardStats: prima un anno
    // assente o vuoto arrivava qui come elenco vuoto, cioe' nessun filtro, e i KPI
    // sommavano la raccolta di tutti gli anni contro un target zero mentre i
    // conteggi della stessa pagina parlavano dell'anno in corso.
    if (!anni.length) anni.push(Number(oggiRoma().slice(0, 4)));

    // Le letture del quadro partono insieme alle altre: un anno solo, e le
    // pagine sono piccole. Una che non riesce lascia fuori la sua parte, col
    // perche', e il resto della risposta vive.
    const unAnno = anni.length === 1 ? anni[0] : null;
    const annoPassato = unAnno !== null && unAnno < Number(oggiRoma().slice(0, 4));
    const svc = base44.asServiceRole.entities;
    const lettureQuadro = unAnno === null ? Promise.resolve(null) : Promise.all([
      fetchAll(svc.TargetMensile, { anno: unAnno }).catch(() => null),
      fetchAll(svc.TargetRaccoglitore, { anno: unAnno }).catch(() => null),
      annoPassato ? fetchAll(svc.DocumentoFatturazione, { tipo: 'ATTIVA', anno: unAnno }).catch(() => null) : Promise.resolve(null),
      annoPassato ? svc.PrefatturaEcotyre.filter({ anno: unAnno }).catch(() => null) : Promise.resolve(null),
    ]);

    const [rete, aci] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.PrimariaRete, { stato: 'terminato' }),
      fetchAll(base44.asServiceRole.entities.PrimariaAci, { stato: 'terminato' })
    ]);

    const getRegione = (r) => r.regione || PROV_TO_REGION[(r.provincia || '').toUpperCase().trim()] || 'Altro';
    const sumTon = (arr) => arr.reduce((s, r) => s + (r.peso_effettivo || 0), 0) / 1000;

    // Come in tutto il gestionale il periodo e' quello della fine trasporto, non i
    // campi mese e anno del record, e il giorno e' quello italiano per tutti e tre
    // i canali: rete e ACI si leggevano in UTC mentre l'extra correggeva la
    // mezzanotte italiana, e un ritiro del 1 ottobre finiva a settembre nella rete
    // e a ottobre nell'extra. Senza fine trasporto un movimento non ha periodo.
    const getAnno = (r) => { const p = periodoMovimento(r); return p ? p.anno : 0; };
    const getMese = (r) => { const p = periodoMovimento(r); return p ? p.mese : ''; };

    const reteAnno = rete.filter(r => anni.includes(getAnno(r)));
    const aciAnno = aci.filter(r => anni.includes(getAnno(r)));
    // Un terminato senza fine trasporto non ha periodo: resta fuori da ogni conto
    // e si dice quanti sono, canale per canale, invece di perderli in silenzio.
    // Non si ripiega sulla chiusura ne' sull'immissione.
    const senzaFine = (arr) => arr.filter(r => !periodoMovimento(r)).length;
    const reteMese = mesi.length > 0 ? reteAnno.filter(r => mesi.includes(getMese(r))) : reteAnno;
    const aciMese = mesi.length > 0 ? aciAnno.filter(r => mesi.includes(getMese(r))) : aciAnno;

    // RETE, ACI ed EXTRA RACCOLTA sono canali indipendenti: nessun totale che li
    // sommi e il target del contratto si confronta solo con la RETE.
    const raccolta_rete = sumTon(reteMese);
    const raccolta_aci = sumTon(aciMese);
    const raccolto_rete_anno = sumTon(reteAnno);
    const raccolto_aci_anno = sumTon(aciAnno);

    // IL TARGET DEL CONTRATTO, COME IN TARGET & STATUS (chiusura dell'audit,
    // 11/10/2026). Il contratto dell'anno e' il modificato per ultimo
    // (commessaDellAnno): qui si prendeva il creato per ultimo, fra i primi 50.
    // Target annuo e riparto per regione vengono da li' (attesoContratto.ts); le
    // costanti del 2025 e del 2026 solo come ripiego dichiarato. Un anno senza
    // contratto non ha target: niente «0%» e niente 11.550 t nel grafico, ma
    // null e un avviso, come Target & Status.
    const commesseLette = await fetchAll(base44.asServiceRole.entities.CommessaEcotyre).catch(() => null);
    const commesse = commesseLette || [];
    const contratti = anni.map(a => ({ anno: a, commessa: commessaDellAnno(commesse, a) }));
    const targetAnni = contratti.map(({ anno: a, commessa }) => ({ anno: a, ...targetAnnuoDellAnno(commessa, a) }));
    const target = targetAnni.some(x => x.t === null) ? null : targetAnni.reduce((s, x) => s + x.t, 0);
    const raggiungimento_pct = target ? (raccolto_rete_anno / target) * 100 : null;
    const avvisi_target = [];
    if (commesseLette === null) avvisi_target.push(`Il contratto Ecotyre non si è potuto leggere: il target è quello di ripiego, dove c'è.`);
    for (const x of targetAnni) {
      if (x.t === null) avvisi_target.push(`Il contratto Ecotyre del ${x.anno} non è inserito in Target & Status: il target RETE e l'atteso non si calcolano.`);
      else if (x.fonte === 'ripiego') avvisi_target.push(`Il contratto Ecotyre del ${x.anno} non ha il target annuo in Target & Status: si usano le ${formatoTonnellate(x.t)} t scritte nel gestionale come ripiego.`);
      if (x.da_confermare) avvisi_target.push(`Il contratto Ecotyre del ${x.anno} è copiato dall'anno prima e va confermato in Target & Status.`);
    }

    // L'ATTESO ALLA DATA: «76,4%» da solo non dice se si e' in linea. Si conta
    // sui giorni coperti dai dati - l'ultima fine trasporto della rete, mai oltre
    // oggi - e col profilo mensile del contratto, come l'Andamento per regione di
    // Target & Status e il controllo dei target mensili (attesoContratto.ts).
    const giornoDati = giornoDeiDati(rete.reduce((m, r) => { const g = giornoMovimento(r); return g > m ? g : m; }, ''), oggiRoma());
    const attesi = contratti.map(({ anno: a, commessa }) => attesoAllaData(commessa, a, giornoDati));
    const attesoAnno = target === null || attesi.some(x => x.atteso_t === null) ? null : attesi.reduce((s, x) => s + x.atteso_t, 0);
    const atteso = attesoAnno === null ? null : {
      giorno: giornoDati,
      atteso_t: attesoAnno,
      pct: target ? (attesoAnno / target) * 100 : null,
      // positivo: avanti sull'atteso; negativo: indietro
      scarto_t: raccolto_rete_anno - attesoAnno,
    };

    // Previsione ACI del contratto ACI Ecotyre (indicativa) e canale Extra Raccolta.
    const previsioneAciDi = (a) => {
      const c = commessaDellAnno(commesse, a);
      try { return (c ? JSON.parse(c.target_prezzo_regioni_json || '[]') : []).reduce((s, r) => s + (Number(r.target_t) || 0), 0); } catch { return 0; }
    };
    const previsione_aci = anni.reduce((s, a) => s + previsioneAciDi(a), 0);
    // L'extra raccolta: la raccolta dal produttore, non i trasferimenti in
    // secondaria che stanno nello stesso archivio e riporterebbero lo stesso peso
    // una seconda volta.
    const extraTutti = (await fetchAll(base44.asServiceRole.entities.ExtraRaccolta, { stato: 'terminato' }))
      .filter(r => String(r.tipo_movimento || 'primaria').toLowerCase().trim() !== 'secondaria')
      .map(r => ({ r, p: periodoMovimento(r) }));
    const extra = extraTutti.filter(({ p }) => p && anni.includes(p.anno));
    const raccolta_extra = extra.filter(({ p }) => mesi.length === 0 || mesi.includes(p.mese)).reduce((s, { r }) => s + (Number(r.peso_effettivo) || 0), 0) / 1000;
    const raccolto_extra_anno = extra.reduce((s, { r }) => s + (Number(r.peso_effettivo) || 0), 0) / 1000;

    // Raccolta RETE vs ACI per regione (mese+anno selezionati)
    const regioniMap = {};
    for (const r of reteMese) {
      const reg = getRegione(r);
      if (!regioniMap[reg]) regioniMap[reg] = { regione: reg, rete: 0, aci: 0 };
      regioniMap[reg].rete += (r.peso_effettivo || 0) / 1000;
    }
    for (const r of aciMese) {
      const reg = getRegione(r);
      if (!regioniMap[reg]) regioniMap[reg] = { regione: reg, rete: 0, aci: 0 };
      regioniMap[reg].aci += (r.peso_effettivo || 0) / 1000;
    }

    // Target vs Raccolto per regione (solo Rete, anno selezionato, tutti i mesi).
    // Il contratto per regione dell'anno, sommato sugli anni scelti; il riparto
    // scritto nel codice vale solo per il 2026, l'anno da cui viene: prima valeva
    // per ogni anno, e il 2027 senza contratto mostrava 11.550 t nel grafico e
    // «su 0 t» nel numero sopra. Se un anno scelto non ha il riparto, il grafico
    // mostra il solo raccolto, con il target null. Accanto, l'atteso alla data di
    // ogni regione, con il profilo del contratto dell'anno.
    const raccoltoRegRete = {};
    for (const r of reteAnno) {
      const reg = getRegione(r);
      raccoltoRegRete[reg] = (raccoltoRegRete[reg] || 0) + (r.peso_effettivo || 0) / 1000;
    }
    const regioniAnni = contratti.map(({ anno: a, commessa }) => ({ anno: a, commessa, ...regioniDellAnno(commessa, a) }));
    const conRiparto = regioniAnni.every(x => x.righe.length > 0);
    for (const x of regioniAnni) {
      if (!x.righe.length && targetAnni.some(t => t.anno === x.anno && t.t !== null)) avvisi_target.push(`Il contratto Ecotyre del ${x.anno} non ha il riparto per regione: il grafico mostra il solo raccolto.`);
    }
    const perRegione = new Map();
    if (conRiparto) {
      for (const x of regioniAnni) {
        for (const r of x.righe) {
          const v = perRegione.get(r.regione) || { target: 0, atteso: 0 };
          // L'ATTESO DI UNA REGIONE E' SUO (variazioni del contratto, 14/10/2026):
          // attesoDellaRegione mette le variazioni in vigore della regione intere
          // nel loro mese, e quelle delle altre regioni non la toccano. Col target
          // della regione per la quota nazionale, le 100 t di ottobre in Puglia
          // spostavano un pezzo di atteso anche su Campania e Sicilia.
          const a = attesoDellaRegione(x.commessa, x.anno, giornoDati, r.regione).atteso_t;
          v.target += r.target_t;
          v.atteso = v.atteso === null || a === null ? null : v.atteso + a;
          perRegione.set(r.regione, v);
        }
      }
    }
    const target_vs_raccolto = conRiparto
      ? [...perRegione].map(([reg, v]) => ({ regione: reg, target: v.target, atteso: v.atteso, raccolto: raccoltoRegRete[reg] || 0 }))
      : Object.entries(raccoltoRegRete).sort((a, b) => b[1] - a[1]).map(([reg, t]) => ({ regione: reg, target: null, atteso: null, raccolto: t }));

    // IL QUADRO DELLA COMMESSA dell'anno scelto (quadroCommessa.ts). Il giorno
    // dei dati e' quello dell'atteso: l'ultima fine trasporto della rete, mai oltre
    // oggi.
    let quadro = null;
    let quadro_perche = '';
    if (unAnno === null) {
      quadro_perche = 'Il quadro della commessa si guarda un anno alla volta.';
    } else {
      const [mensili, annui, documenti, prefatture] = await lettureQuadro;
      const kpiAnno = { raccolto_rete_anno, raccolto_aci_anno, raccolto_extra_anno, previsione_aci, target, raggiungimento_pct, atteso,
        target_ripiego: targetAnni.filter(x => x.fonte === 'ripiego').map(x => x.anno), target_da_confermare: targetAnni.filter(x => x.da_confermare).map(x => x.anno) };
      quadro = quadroCommessa({
        anno: unAnno, oggi: oggiRoma(), giornoDati, commessa: contratti[0].commessa, kpi: kpiAnno, fonteTarget: targetAnni[0].fonte,
        rete, reteAnno, aciAnno, extraAnno: extra,
        targetVsRaccolto: target_vs_raccolto, conRiparto, raccoltoPerRegione: raccoltoRegRete,
        mensili: mensili || [], annui: annui || [], senzaFine: senzaFine(rete),
        documenti: documenti || null, prefatture: (prefatture || []).map(p => ({ anno: p.anno, mese: p.mese, superata: p.superata })),
      });
      if (mensili === null || annui === null) quadro.rete.raccoglitori_perche = "I target dei raccoglitori non si sono potuti leggere: la classifica non c'è.";
      if (mensili === null || annui === null) quadro.rete.raccoglitori = null;
      if (annoPassato && documenti === null) quadro.mesi_attiva = null;
    }

    return Response.json({
      // target e raggiungimento_pct sono null quando un anno scelto non ha
      // contratto (si mostra «—», mai 0); atteso e' null quando manca il target o
      // non c'e' nessun dato. target_ripiego e target_da_confermare dicono gli anni
      // il cui target non e' quello confermato del contratto.
      kpi: {
        raccolta_rete, raccolta_aci, raccolta_extra, raccolto_rete_anno, raccolto_aci_anno, raccolto_extra_anno, previsione_aci, target, raggiungimento_pct, atteso,
        target_ripiego: targetAnni.filter(x => x.fonte === 'ripiego').map(x => x.anno),
        target_da_confermare: targetAnni.filter(x => x.da_confermare).map(x => x.anno),
      },
      avvisi_target,
      // In ordine di rete e poi di ACI: ordinare sulla somma dei due canali era
      // gia' un totale che li mescolava.
      per_regione: Object.values(regioniMap).sort((a, b) => (b.rete - a.rete) || (b.aci - a.aci)),
      target_vs_raccolto,
      anni,
      // terminati esclusi perche' senza fine trasporto, di qualunque anno: per canale, mai sommati
      senza_fine_trasporto: { rete: senzaFine(rete), aci: senzaFine(aci), extra: extraTutti.filter(({ p }) => !p).length },
      // Le date da sistemare, un canale per volta (regola dell'utente, 22/09/2026:
      // immissione, inizio e fine trasporto sono obbligatorie in ogni formulario
      // terminato): i senza fine trasporto qui sopra, e i terminati del periodo
      // scelto - lo stesso della raccolta del mese - con un'altra data che manca o
      // non torna. Quelli sono contati nei numeri, ma vanno corretti.
      date_da_sistemare: {
        rete: riepilogoDateVista(rete, reteMese, 5),
        aci: riepilogoDateVista(aci, aciMese, 5),
        extra: riepilogoDateVista(extraTutti.map(({ r }) => r), extra.filter(({ p }) => mesi.length === 0 || mesi.includes(p.mese)).map(({ r }) => r), 5),
      },
      quadro,
      ...(quadro_perche ? { quadro_perche } : {}),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}