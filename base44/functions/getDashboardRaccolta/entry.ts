import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { riepilogoDateVista } from "../../shared/raccoltoCalculator.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { periodoMovimento } from "../../shared/movimenti.ts";
import { contrattoReteDegliAnni, regioneDellaDashboard } from "../../shared/contrattoRete.ts";
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
//
// IL CONTRATTO DELLA RETE E' UNA REGOLA SOLA (migliorie del 14/10/2026). Target,
// raccolto, atteso alla data, regioni del contratto e avvisi del target li conta
// contrattoReteDegliAnni (base44/shared/contrattoRete.ts), lo stesso conto che
// EcoTyna fa per un anno (contrattoDellaRete): prima qui c'era la regola e la' una
// sua copia, tenuta allineata da una prova. La risposta e' identica a prima, al
// carattere (prove/dashboardContrattoUnaRegola.mjs), e le letture sono le stesse.
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
    // conteggi della stessa pagina parlavano dell'anno in corso. Il giorno
    // italiano si prende una volta, e vale per tutta la risposta.
    const oggi = oggiRoma();
    if (!anni.length) anni.push(Number(oggi.slice(0, 4)));

    // Le letture del quadro partono insieme alle altre: un anno solo, e le
    // pagine sono piccole. Una che non riesce lascia fuori la sua parte, col
    // perche', e il resto della risposta vive.
    const unAnno = anni.length === 1 ? anni[0] : null;
    const annoPassato = unAnno !== null && unAnno < Number(oggi.slice(0, 4));
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
    const raccolto_aci_anno = sumTon(aciAnno);

    // IL CONTRATTO DELLA RETE (contrattoRete.ts): il contratto dell'anno, il
    // modificato per ultimo; target annuo e riparto per regione, col ripiego del
    // 2025-2026 detto come tale; raccolto, percentuale, atteso alla data sul
    // giorno dei dati (l'ultima fine trasporto della rete, mai oltre oggi), le
    // regioni col loro atteso e gli avvisi del target. Un anno senza contratto
    // non ha target: null e un avviso, mai «0%». Le primarie dell'anno sono
    // quelle scelte qui sopra, le stesse dei mesi e del quadro.
    const commesseLette = await fetchAll(base44.asServiceRole.entities.CommessaEcotyre).catch(() => null);
    const contratto = contrattoReteDegliAnni({ commesse: commesseLette, anni, rete, reteAnno, oggi });
    const { raccolto_rete_anno, target, raggiungimento_pct, atteso, target_ripiego, target_da_confermare } = contratto.kpi;
    const avvisi_target = contratto.avvisi_target;
    const giornoDati = contratto.giorno_dati;

    // Previsione ACI del contratto ACI Ecotyre (indicativa), dagli stessi
    // contratti dell'anno, e canale Extra Raccolta.
    const previsioneAciDi = (c) => {
      try { return (c ? JSON.parse(c.target_prezzo_regioni_json || '[]') : []).reduce((s, r) => s + (Number(r.target_t) || 0), 0); } catch { return 0; }
    };
    const previsione_aci = contratto.contratti.reduce((s, x) => s + previsioneAciDi(x.commessa), 0);
    // L'extra raccolta: la raccolta dal produttore, non i trasferimenti in
    // secondaria che stanno nello stesso archivio e riporterebbero lo stesso peso
    // una seconda volta.
    const extraTutti = (await fetchAll(base44.asServiceRole.entities.ExtraRaccolta, { stato: 'terminato' }))
      .filter(r => String(r.tipo_movimento || 'primaria').toLowerCase().trim() !== 'secondaria')
      .map(r => ({ r, p: periodoMovimento(r) }));
    const extra = extraTutti.filter(({ p }) => p && anni.includes(p.anno));
    const raccolta_extra = extra.filter(({ p }) => mesi.length === 0 || mesi.includes(p.mese)).reduce((s, { r }) => s + (Number(r.peso_effettivo) || 0), 0) / 1000;
    const raccolto_extra_anno = extra.reduce((s, { r }) => s + (Number(r.peso_effettivo) || 0), 0) / 1000;

    // Raccolta RETE vs ACI per regione (mese+anno selezionati), con la regione
    // della dashboard: il campo regione, poi la provincia, poi «Altro».
    const regioniMap = {};
    for (const r of reteMese) {
      const reg = regioneDellaDashboard(r);
      if (!regioniMap[reg]) regioniMap[reg] = { regione: reg, rete: 0, aci: 0 };
      regioniMap[reg].rete += (r.peso_effettivo || 0) / 1000;
    }
    for (const r of aciMese) {
      const reg = regioneDellaDashboard(r);
      if (!regioniMap[reg]) regioniMap[reg] = { regione: reg, rete: 0, aci: 0 };
      regioniMap[reg].aci += (r.peso_effettivo || 0) / 1000;
    }

    // Target vs Raccolto per regione (solo Rete, anni selezionati, tutti i mesi):
    // il contratto per regione, l'atteso alla data e il raccolto di ognuna, dal
    // conto del contratto qui sopra. Senza il riparto di un anno scelto il
    // grafico mostra il solo raccolto, col target null.
    const target_vs_raccolto = contratto.target_vs_raccolto;
    const conRiparto = contratto.con_riparto;
    const raccoltoRegRete = contratto.raccolto_per_regione;

    // IL QUADRO DELLA COMMESSA dell'anno scelto (quadroCommessa.ts). Il giorno
    // dei dati e' quello dell'atteso: l'ultima fine trasporto della rete, mai oltre
    // oggi.
    let quadro = null;
    let quadro_perche = '';
    if (unAnno === null) {
      quadro_perche = 'Il quadro della commessa si guarda un anno alla volta.';
    } else {
      const [mensili, annui, documenti, prefatture] = await lettureQuadro;
      const kpiAnno = { raccolto_rete_anno, raccolto_aci_anno, raccolto_extra_anno, previsione_aci, target, raggiungimento_pct, atteso, target_ripiego, target_da_confermare };
      const delAnno = contratto.contratti[0];
      quadro = quadroCommessa({
        anno: unAnno, oggi, giornoDati, commessa: delAnno.commessa, kpi: kpiAnno, fonteTarget: delAnno.target.fonte,
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
        target_ripiego, target_da_confermare,
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