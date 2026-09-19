import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { istante, momentoRilevazione } from "../../shared/giacenzaStoccaggi.ts";

// Calcola la situazione delle giacenze di impianti e stoccaggi per l'anno richiesto.
//
// DUE ASSI TEMPORALI:
// - GIACENZA (stock): calcolata su tutto lo storico, senza filtro d'anno
// - CONFERITO e TARGET (flusso): calcolati sull'anno richiesto
//
// Fonti dati:
//   OrdineNonDichiarato  -> giacenza a portale (impianti), ordini da dichiarare, arretrato per anno, in_attesa_dichiarazione (stoccaggi)
//   GiacenzaStoccaggio   -> giacenza a portale degli stoccaggi (rilevazione manuale del saldo reale portale)
//   DichiarazioneTrattamento -> dichiarato e derivati (filtrato per anno di data_chiusura dell'ordine)
//   PrimariaRete/Aci, ExtraRaccolta, Secondaria, Terziaria -> movimentazione (stato terminato, trasporto_finito_il nell'anno)
//   GiacenzaSito -> target e tipologia trattamento
//
// RUOLO DEDOTTO DALL'ORDINE PRIMARIO:
//   I report OrdineNonDichiarato e DichiarazioneTrattamento non contengono Tipo_Destinazione,
//   ma ordine_primaria corrisponde a id_ordine di PrimariaRete/Aci. Si costruisce una mappa
//   id_ordine -> tipo_destinazione e la si usa per attribuire il ruolo.
//
//   Regola di attribuzione (per OrdineNonDichiarato e DichiarazioneTrattamento):
//   - se destinazione_secondaria e' valorizzato: attribuisci a destinazione_secondaria con ruolo "imp"
//   - altrimenti attribuisci a destinazione, con ruolo dalla mappa ordini
//   - se l'ordine non ha riscontro nella mappa: ruolo "imp" + anomalia
//
// NOTA: i campi giacenza_fisica_t e divergenza_t sono stati rimossi perche' non attendibili.
// La giacenza fisica veniva calcolata come bilancio dei movimenti meno il dichiarato, ma i
// due insiemi coprono periodi diversi: PrimariaRete e PrimariaAci contengono ordini terminati
// a partire da gennaio 2024, mentre DichiarazioneTrattamento comprende dichiarazioni riferite
// a ordini chiusi gia' dal 2023. Il bilancio sottraeva dichiarazioni relative a materiale mai
// conteggiato in ingresso, con uno squilibrio complessivo di circa settemila tonnellate.
// La giacenza attendibile e' quella a portale, che il portale stesso calcola ordine per ordine.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { anno } = await req.json();
    if (!anno) return Response.json({ error: 'Anno obbligatorio' }, { status: 400 });
    const annoNum = Number(anno);

    const norm = normalizzaRagioneSociale;
    // Tonnellate arrotondate ai kg: la terza cifra decimale non si perde.
    const r2 = (v) => Math.round(v * 1000) / 1000;
    const tdNorm = (v) => String(v || '').toLowerCase().trim();

    // Carica tutte le sorgenti dati in parallelo
    const [nonDichiarati, dichiarazioni, reteAll, aciAll, extraAll, secAll, terzAll, giacenzeSito, giacenzeStoccaggio] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.OrdineNonDichiarato),
      fetchAll(base44.asServiceRole.entities.DichiarazioneTrattamento),
      fetchAll(base44.asServiceRole.entities.PrimariaRete),
      fetchAll(base44.asServiceRole.entities.PrimariaAci),
      fetchAll(base44.asServiceRole.entities.ExtraRaccolta),
      fetchAll(base44.asServiceRole.entities.Secondaria),
      fetchAll(base44.asServiceRole.entities.Terziaria),
      fetchAll(base44.asServiceRole.entities.GiacenzaSito, { anno: annoNum }),
      fetchAll(base44.asServiceRole.entities.GiacenzaStoccaggio),
    ]);

    // --- Classi dei PFU, come nel portale: P, M, G1, G2 e ACI (autodemolizione) ---
    // Il prodotto arriva come "P - fino a 35 kg", ".class1" o "PFU Autodemolizione".
    const CLASSI = ['P', 'M', 'G1', 'G2', 'ACI'];
    function classeDa(...valori) {
      const t = valori.map(v => String(v || '')).join(' ').toUpperCase();
      if (/AUTODEMOL|\bACI\b|CLASS ?9/.test(t)) return 'ACI';
      if (/CLASS ?3|\bG ?1\b/.test(t)) return 'G1';
      if (/CLASS ?4|\bG ?2\b/.test(t)) return 'G2';
      if (/CLASS ?2|(^|[^A-Z0-9])M([^A-Z0-9]|$)/.test(t)) return 'M';
      if (/CLASS ?1|(^|[^A-Z0-9])P([^A-Z0-9]|$)/.test(t)) return 'P';
      return 'ND';
    }
    const classiVuote = () => ({ P: 0, M: 0, G1: 0, G2: 0, ACI: 0, ND: 0 });
    // Istante di un movimento per il portale: la chiusura dell'ordine, altrimenti la fine trasporto.
    // istante e momentoRilevazione stanno in shared/giacenzaStoccaggi.ts: la
    // regola della fotografia del portale e' una sola, e la usa anche la
    // Predittivita' delle secondarie.

    // --- Filtri temporali per movimentazione ---
    function isTerminato(r) { return String(r.stato || '').trim().toLowerCase() === 'terminato'; }
    function inYear(dateField) {
      if (!dateField) return false;
      const d = new Date(dateField);
      return !isNaN(d.getTime()) && d.getFullYear() === annoNum;
    }

    // === 0a. NOMI DEI SITI DA MOSTRARE ===
    // La chiave di aggregazione e' la ragione sociale normalizzata: tutta
    // minuscola, senza punteggiatura e senza forma societaria. Va benissimo per
    // riconoscere lo stesso sito scritto in modi diversi, ma a video e' illeggibile
    // e finora compariva ogni volta che il sito non aveva un target da cui pescare
    // il nome. Si raccoglie quindi, per ogni chiave, la forma piu' completa fra
    // quelle presenti nelle sorgenti, che e' di norma quella del portale.
    const nomiSito = new Map();
    const nomiVisti = new Set();
    function registraNome(raw) {
      const s = String(raw || '').replace(/\s+/g, ' ').trim();
      if (!s || nomiVisti.has(s)) return;
      nomiVisti.add(s);
      const ns = norm(s);
      if (!ns) return;
      const attuale = nomiSito.get(ns);
      if (!attuale || s.length > attuale.length) nomiSito.set(ns, s);
    }
    for (const r of nonDichiarati) { registraNome(r.destinazione); registraNome(r.destinazione_secondaria); }
    for (const r of dichiarazioni) { registraNome(r.destinazione); registraNome(r.destinazione_secondaria); }
    for (const r of reteAll) registraNome(r.destinazione);
    for (const r of aciAll) registraNome(r.destinazione);
    for (const r of extraAll) registraNome(r.destinazione);
    for (const r of secAll) { registraNome(r.destinazione); registraNome(r.stoccaggio); }
    for (const r of terzAll) { registraNome(r.unita_locale_origine); registraNome(r.ragione_sociale); }
    for (const g of giacenzeSito) registraNome(g.sito);
    for (const r of giacenzeStoccaggio) registraNome(r.sito);

    // === 0. MAPPA ORDINE -> TIPO_DESTINAZIONE (da PrimariaRete + PrimariaAci) ===
    const ordineTipoMap = new Map(); // id_ordine -> tipo_destinazione normalizzato
    for (const r of [...reteAll, ...aciAll]) {
      const id = String(r.id_ordine || '').trim();
      const td = tdNorm(r.tipo_destinazione);
      if (id && td) ordineTipoMap.set(id, td);
    }

    // --- Funzione attribuzione: restituisce { sito, td, anomalia } ---
    function attribuisci(r) {
      const sec = String(r.destinazione_secondaria || '').trim();
      if (sec) return { sito: sec, td: 'imp', anomalia: false };
      const dest = String(r.destinazione || '').trim();
      const ordineId = String(r.ordine_primaria || '').trim();
      const td = ordineTipoMap.get(ordineId);
      if (td) return { sito: dest, td, anomalia: false };
      return { sito: dest, td: 'imp', anomalia: true };
    }

    // === 1. GIACENZA A PORTALE (OrdineNonDichiarato, tutto lo storico, per ns|td) ===
    // Per IMP: il peso non dichiarato e' la giacenza a portale dell'impianto.
    // Per STOC: il peso non dichiarato NON e' giacenza dello stoccaggio (e' materiale partito verso
    //   un impianto, in attesa che l'impianto ricevente presenti la dichiarazione). Viene raccolto
    //   in inAttesaMap; la giacenza reale dello stoccaggio viene dalla rilevazione manuale (sezione 1b).
    const giacPortaleMap = new Map();   // ns|imp -> t
    const ordiniMap = new Map();        // ns|td -> count
    const arretratoAnniMap = new Map(); // ns|td -> { anno: t }
    const inAttesaMap = new Map();      // ns -> t (peso non dichiarato attribuito a stoccaggi)
    const ordiniSenzaRiscontro = new Set();

    const classiImpiantoMap = new Map(); // ns|imp -> kg per classe degli ordini non dichiarati
    let nonDichiaratiAggiornatiAl = 0;
    for (const r of nonDichiarati) {
      const creato = istante(r.created_date);
      if (creato && creato > nonDichiaratiAggiornatiAl) nonDichiaratiAggiornatiAl = creato;
      const { sito, td, anomalia } = attribuisci(r);
      const ns = norm(sito);
      if (!ns) continue;
      const key = ns + '|' + td;
      if (anomalia) ordiniSenzaRiscontro.add(r.ordine_primaria);
      const kg = Number(r.peso_non_dichiarato_kg) || 0;
      const t = kg / 1000;
      if (td === 'stoc') {
        inAttesaMap.set(ns, (inAttesaMap.get(ns) || 0) + t);
      } else {
        giacPortaleMap.set(key, (giacPortaleMap.get(key) || 0) + t);
        if (!classiImpiantoMap.has(key)) classiImpiantoMap.set(key, classiVuote());
        classiImpiantoMap.get(key)[classeDa(r.prodotto)] += kg;
      }
      ordiniMap.set(key, (ordiniMap.get(key) || 0) + 1);

      // Arretrato per anno di data_chiusura
      let annoChiusura = null;
      if (r.data_chiusura) {
        const d = new Date(r.data_chiusura);
        if (!isNaN(d.getTime())) annoChiusura = d.getFullYear();
      }
      if (annoChiusura !== null) {
        if (!arretratoAnniMap.has(key)) arretratoAnniMap.set(key, {});
        const perAnno = arretratoAnniMap.get(key);
        perAnno[annoChiusura] = (perAnno[annoChiusura] || 0) + t;
      }
    }

    // === 1b. RILEVAZIONI GIACENZA STOCCAGGIO (saldo reale portale, per stoccaggi) ===
    // Per ogni stoccaggio, tiene il record con data_rilevazione piu' recente.
    const stocRilevMap = new Map(); // ns -> { record, dataStr, dataMs }
    for (const r of giacenzeStoccaggio) {
      const ns = norm(r.sito);
      if (!ns) continue;
      const dataStr = r.data_rilevazione ? String(r.data_rilevazione).slice(0, 10) : null;
      const dataMs = dataStr ? new Date(dataStr).getTime() : 0;
      const existing = stocRilevMap.get(ns);
      if (!existing || dataMs > existing.dataMs) {
        stocRilevMap.set(ns, { record: r, dataStr, dataMs });
      }
    }

    // === 1c. MOVIMENTI DEGLI STOCCAGGI DOPO LA RILEVAZIONE ===
    // La rilevazione fotografa il saldo del portale in un istante; da allora il
    // portale lo aggiorna a ogni ordine chiuso. Per avere la giacenza di oggi, per
    // classe, si aggiungono gli ingressi chiusi dopo la rilevazione e si tolgono
    // le uscite (secondarie) partite dallo stoccaggio. Verificato su Nappi Sud il
    // 16/09/2026: rilevazione del 13/09 piu' 10 ingressi meno 2 uscite coincide con
    // il portale al chilogrammo, classe per classe.
    const tipoStoc = (r) => tdNorm(r.tipo_destinazione) === 'stoc';
    const eSecondariaExtra = (r) => String(r.tipo_movimento || '').toLowerCase().trim() === 'secondaria';
    let datiAggiornatiAl = 0;
    const movStoc = new Map(); // ns -> { dopo, ingressi, uscite }
    for (const [ns, rilev] of stocRilevMap) {
      const dopo = momentoRilevazione(rilev.record);
      const m = { dopo, ingressi: classiVuote(), uscite: classiVuote(), nIngressi: 0, nUscite: 0 };
      movStoc.set(ns, m);
    }
    const contaMovimento = (r, ns, verso) => {
      const m = movStoc.get(ns);
      if (!m) return;
      const t = istante(r.trasporto_finito_il || r.ordine_chiuso_il);
      if (!t || t <= m.dopo) return;
      const kg = Number(r.peso_effettivo) || 0;
      m[verso][classeDa(r.classe, r.prodotto)] += kg;
      if (verso === 'ingressi') m.nIngressi++; else m.nUscite++;
    };
    for (const r of [...reteAll, ...aciAll, ...extraAll, ...secAll]) {
      const t = istante(r.trasporto_finito_il || r.ordine_chiuso_il);
      if (isTerminato(r) && t && t > datiAggiornatiAl && t <= Date.now()) datiAggiornatiAl = t;
    }
    for (const r of [...reteAll, ...aciAll, ...extraAll.filter(x => !eSecondariaExtra(x))]) {
      if (isTerminato(r) && tipoStoc(r)) contaMovimento(r, norm(r.destinazione), 'ingressi');
    }
    for (const r of secAll) {
      if (!isTerminato(r)) continue;
      if (tipoStoc(r)) contaMovimento(r, norm(r.destinazione), 'ingressi');
      contaMovimento(r, norm(r.stoccaggio), 'uscite');
    }
    for (const r of extraAll.filter(eSecondariaExtra)) {
      if (isTerminato(r)) contaMovimento(r, norm(r.stoccaggio), 'uscite');
    }

    // === 2. DICHIARATO (DichiarazioneTrattamento, per ns|td) ===
    const dichiaratoMap = new Map();   // ns|td -> t (anno corrente)
    const derivatiMap = new Map();     // ns|td -> { granulo, fibre, metallo, cippato, ciabattato } (anno corrente)

    for (const d of dichiarazioni) {
      const { sito, td } = attribuisci(d);
      const ns = norm(sito);
      if (!ns) continue;
      const key = ns + '|' + td;
      const kg = Number(d.peso_associato_kg) || 0;
      const t = kg / 1000;

      // Anno di competenza = anno di chiusura dell'ordine, non di presentazione della dichiarazione
      if (inYear(d.data_chiusura)) {
        dichiaratoMap.set(key, (dichiaratoMap.get(key) || 0) + t);
        if (!derivatiMap.has(key)) derivatiMap.set(key, { granulo: 0, fibre: 0, metallo: 0, cippato: 0, ciabattato: 0 });
        const der = derivatiMap.get(key);
        der.granulo += (Number(d.granulo_kg) || 0) / 1000;
        der.fibre += (Number(d.fibre_kg) || 0) / 1000;
        der.metallo += (Number(d.metallo_kg) || 0) / 1000;
        der.cippato += (Number(d.cippato_kg) || 0) / 1000;
        der.ciabattato += (Number(d.ciabattato_kg) || 0) / 1000;
      }
    }

    // === 3. MOVIMENTAZIONE ANNO CORRENTE (per conferito, stato terminato + trasporto_finito_il nell'anno) ===
    // RETE, ACI ed EXTRA RACCOLTA sono canali indipendenti: il conferito di ciascuno
    // resta separato e il target Ecotyre del sito si misura solo sulla RETE.
    const conferitoPer = (records) => {
      const mappa = new Map(); // ns|td -> t
      for (const r of records) {
        if (!isTerminato(r) || !inYear(r.trasporto_finito_il)) continue;
        const nd = norm(r.destinazione);
        const td = tdNorm(r.tipo_destinazione);
        if (!nd || !td) continue;
        const k = nd + '|' + td;
        mappa.set(k, (mappa.get(k) || 0) + (Number(r.peso_effettivo) || 0) / 1000);
      }
      return mappa;
    };
    const confPrimMap = conferitoPer(reteAll);
    const confAciMap = conferitoPer(aciAll);
    const confExtraMap = conferitoPer(extraAll);

    // Le secondarie di rete e quelle ACI viaggiano nello stesso archivio e si
    // distinguono dalla classe. Vanno tenute separate: la colonna "Conferito
    // RETE" sommava anche le secondarie ACI, e su un impianto che riceve
    // entrambe il numero era piu' alto del vero.
    const secInMap = new Map();     // ns -> t di rete in ingresso
    const secOutMap = new Map();    // ns -> t di rete in uscita
    const secAciInMap = new Map();  // ns -> t ACI in ingresso
    const secAciOutMap = new Map(); // ns -> t ACI in uscita
    for (const r of secAll) {
      if (!isTerminato(r) || !inYear(r.trasporto_finito_il)) continue;
      const t = (Number(r.peso_effettivo) || 0) / 1000;
      const aci = eAci(r);
      const nd = norm(r.destinazione);
      if (nd) {
        const m = aci ? secAciInMap : secInMap;
        m.set(nd, (m.get(nd) || 0) + t);
      }
      const ns = norm(r.stoccaggio);
      if (ns) {
        const m = aci ? secAciOutMap : secOutMap;
        m.set(ns, (m.get(ns) || 0) + t);
      }
    }

    const terzMap = new Map(); // ns -> t
    for (const r of terzAll) {
      if (!isTerminato(r) || !inYear(r.trasporto_finito_il)) continue;
      const no = norm(r.unita_locale_origine || r.ragione_sociale);
      if (!no) continue;
      terzMap.set(no, (terzMap.get(no) || 0) + (Number(r.peso_effettivo) || 0) / 1000);
    }

    // === 3b. GIACENZASITO (serve per risolvere il td delle terziarie) ===
    const giacMap = new Map(); // ns|td -> record
    for (const g of giacenzeSito) {
      giacMap.set(norm(g.sito) + '|' + tdNorm(g.tipo_destinazione), g);
    }
    const giacMapKeys = new Set(giacMap.keys());

    // === 5. UNIONE DEI SITI (tutte le chiavi sono ns|td) ===
    const rowKeys = new Set();

    for (const k of giacMapKeys) rowKeys.add(k);
    for (const k of giacPortaleMap.keys()) rowKeys.add(k);
    for (const ns of stocRilevMap.keys()) rowKeys.add(ns + '|stoc');
    for (const k of dichiaratoMap.keys()) rowKeys.add(k);
    for (const k of confPrimMap.keys()) rowKeys.add(k);
    // Per le mappe per-ns dell'anno corrente (secInMap, secOutMap, terzMap): risolvi il td
    function resolveTds(ns) {
      const tds = [...giacMapKeys].filter(k => k.startsWith(ns + '|')).map(k => k.split('|')[1]);
      return tds.length > 0 ? tds : ['imp'];
    }
    for (const ns of secInMap.keys()) {
      for (const td of resolveTds(ns)) rowKeys.add(ns + '|' + td);
    }
    for (const ns of secOutMap.keys()) {
      // secondarie_out riguarda lo stoccaggio
      const tds = resolveTds(ns);
      if (tds.includes('stoc')) rowKeys.add(ns + '|stoc');
      else rowKeys.add(ns + '|stoc');
    }
    for (const ns of terzMap.keys()) {
      for (const td of resolveTds(ns)) rowKeys.add(ns + '|' + td);
    }

    // === 6. COSTRUZIONE RIGHE ===
    const righe = [];
    const anomalie = [];
    const sitiSenzaTarget = new Set();

    // Anomalie: ordini senza riscontro nella mappa
    for (const ord of ordiniSenzaRiscontro) {
      anomalie.push({ tipo: 'ordine_senza_riscontro', ordine: ord });
    }

    for (const key of rowKeys) {
      const [ns, td] = key.split('|');
      const g = giacMap.get(key);

      // Il nome scelto nel target ha la precedenza: e' una decisione esplicita.
      // Solo in sua assenza si usa la forma del portale, e la chiave normalizzata
      // resta l'ultima spiaggia.
      let sitoNome = g?.sito || nomiSito.get(ns) || ns;

      const ordini_da_dichiarare = ordiniMap.get(key) || 0;
      const arretrato_per_anno = arretratoAnniMap.get(key) || {};

      // Giacenza a portale: per impianti dagli ordini non dichiarati, per stoccaggi dalla rilevazione manuale
      let giacenza_portale_t;
      let giacenza_rete_t = null;
      let giacenza_aci_t = null;
      let data_rilevazione = null;
      let rilevazione_obsoleta = null;
      let in_attesa_dichiarazione_t = 0;
      let senzaRilevazione = false;
      let giacenza_classi_kg = null;
      let rilevazione_classi_kg = null;
      let dopo_rilevazione = null;
      let aggiornata_al = null;

      if (td === 'stoc') {
        // in_attesa_dichiarazione_t: materiale gia' partito dallo stoccaggio verso un impianto,
        // che il portale continua ad attribuire allo stoccaggio finche' l'impianto ricevente non
        // presenta la dichiarazione. Non e' giacenza dello stoccaggio, ma arretrato di dichiarazione
        // a carico del destinatario.
        in_attesa_dichiarazione_t = inAttesaMap.get(ns) || 0;

        const rilev = stocRilevMap.get(ns);
        if (rilev) {
          rilevazione_classi_kg = {
            P: Number(rilev.record.class1_kg) || 0, M: Number(rilev.record.class2_kg) || 0, G1: Number(rilev.record.class3_kg) || 0,
            G2: Number(rilev.record.class4_kg) || 0, ACI: Number(rilev.record.class9_kg) || 0, ND: 0,
          };
          const mov = movStoc.get(ns);
          giacenza_classi_kg = Object.fromEntries(Object.keys(rilevazione_classi_kg).map(c => [c, rilevazione_classi_kg[c] + mov.ingressi[c] - mov.uscite[c]]));
          dopo_rilevazione = {
            dal: new Date(mov.dopo).toISOString(),
            ingressi: mov.nIngressi, ingressi_kg: CLASSI.concat('ND').reduce((s, c) => s + mov.ingressi[c], 0), ingressi_classi_kg: mov.ingressi,
            uscite: mov.nUscite, uscite_kg: CLASSI.concat('ND').reduce((s, c) => s + mov.uscite[c], 0), uscite_classi_kg: mov.uscite,
          };
          aggiornata_al = datiAggiornatiAl ? new Date(datiAggiornatiAl).toISOString() : null;
          const kgTot = Object.values(giacenza_classi_kg).reduce((s, v) => s + v, 0);
          giacenza_portale_t = kgTot / 1000;
          giacenza_rete_t = (kgTot - giacenza_classi_kg.ACI) / 1000;
          giacenza_aci_t = giacenza_classi_kg.ACI / 1000;
          data_rilevazione = rilev.dataStr;
          for (const c of CLASSI) {
            if (giacenza_classi_kg[c] < 0) anomalie.push({ tipo: 'giacenza_negativa', sito: nomiSito.get(ns) || ns, classe: c, kg: giacenza_classi_kg[c] });
          }
          const trentaGiorniFa = Date.now() - 30 * 24 * 60 * 60 * 1000;
          rilevazione_obsoleta = rilev.dataMs < trentaGiorniFa;
        } else {
          giacenza_portale_t = 0;
          // L'anomalia si segnala solo se la riga sopravvive al filtro di
          // attivita' piu' sotto: non ha senso lamentare una rilevazione mancante
          // per un sito che nell'anno non e' nemmeno operativo.
          senzaRilevazione = true;
        }
      } else {
        giacenza_portale_t = giacPortaleMap.get(key) || 0;
        giacenza_classi_kg = classiImpiantoMap.get(key) || classiVuote();
        aggiornata_al = nonDichiaratiAggiornatiAl ? new Date(nonDichiaratiAggiornatiAl).toISOString() : null;
      }

      const dichiarato_t = dichiaratoMap.get(key) || 0;
      const der = derivatiMap.get(key) || { granulo: 0, fibre: 0, metallo: 0, cippato: 0, ciabattato: 0 };

      const conferito_primarie_t = confPrimMap.get(key) || 0;
      const conferito_aci_t = confAciMap.get(key) || 0;
      const conferito_extra_t = confExtraMap.get(key) || 0;

      // Una secondaria va da uno stoccaggio a un impianto: l'ingresso riguarda
      // l'impianto che riceve, l'uscita lo stoccaggio che spedisce. I flussi sono
      // indicizzati per sito e non per ruolo, quindi attribuirli senza distinguere
      // faceva contare lo stesso viaggio due volte su chi, come Irigom, e' insieme
      // impianto e stoccaggio. Le terziarie, uscite verso le cementerie, partono
      // sempre da un impianto.
      const secondarie_in_t = td === 'imp' ? (secInMap.get(ns) || 0) : 0;
      const secondarie_out_t = td === 'stoc' ? (secOutMap.get(ns) || 0) : 0;
      // Le secondarie ACI restano a parte: non entrano nel conferito di rete.
      const secondarie_aci_in_t = td === 'imp' ? (secAciInMap.get(ns) || 0) : 0;
      const secondarie_aci_out_t = td === 'stoc' ? (secAciOutMap.get(ns) || 0) : 0;
      const secondarie_nette_t = secondarie_in_t - secondarie_out_t;
      const terziarie_t = td === 'imp' ? (terzMap.get(ns) || 0) : 0;

      // Conferito e' cio' che il sito ha ricevuto. Le uscite non sono
      // conferimenti: sommarle agli ingressi contava ogni secondaria due volte.
      const conferito_t = conferito_primarie_t + secondarie_in_t;

      const target_primarie_t = g?.target_primarie_t || 0;
      const target_totale_t = g?.target_totale_t || 0;
      const giacenza_riferimento_t = g?.giacenza_riferimento_t || 0;
      const tipologia_trattamento = g?.tipologia_trattamento || '';

      // Il target Ecotyre e' un target di raccolta, quindi si misura sulle
      // primarie. Le secondarie sono materiale gia' raccolto che si sposta da uno
      // stoccaggio a un impianto: metterle al numeratore farebbe contare due volte
      // lo stesso pneumatico, una all'atto della raccolta e una al trasferimento.
      const residuo_t = target_totale_t > 0 ? target_totale_t - conferito_primarie_t : null;
      const percentuale_target = target_totale_t > 0 ? (conferito_primarie_t / target_totale_t) * 100 : null;

      // Un impianto senza target compare solo se nell'anno ha davvero qualcosa:
      // giacenza, arretrato di dichiarazione o movimentazione. Un impianto non
      // piu' contrattualizzato esce cosi' da solo dall'anno in corso, senza
      // bisogno di elenchi di esclusione da tenere aggiornati, e rientra da solo
      // se torna operativo.
      //
      // Gli stoccaggi seguono un'altra regola e non vengono mai nascosti: per loro
      // una rilevazione a zero non e' assenza di dati ma un'informazione, vuol dire
      // piazzale verificato e vuoto. Uno stoccaggio che non deve comparire va tolto
      // dall'elenco delle unita' locali, non dedotto dai numeri.
      // Le terziarie non contano: sono uscite di materiale gia' trasformato verso
      // le cementerie e non dicono nulla sulla giacenza di PFU. Un impianto uscito
      // dal contratto continua per qualche mese a spedire cio' che aveva in
      // piazzale, e quelle spedizioni lo tenevano in tabella con tutte le colonne
      // a zero.
      const haAttivita = giacenza_portale_t > 0 || in_attesa_dichiarazione_t > 0
        || ordini_da_dichiarare > 0 || dichiarato_t > 0 || conferito_t > 0 || conferito_aci_t > 0 || conferito_extra_t > 0;
      if (!g && td === 'imp' && !haAttivita) continue;

      if (senzaRilevazione) anomalie.push({ tipo: 'stoccaggio_senza_rilevazione', sito: sitoNome });

      righe.push({
        sito: sitoNome,
        tipo_destinazione: td,
        giacenza_portale_t: r2(giacenza_portale_t),
        giacenza_rete_t: giacenza_rete_t !== null ? r2(giacenza_rete_t) : null,
        giacenza_aci_t: giacenza_aci_t !== null ? r2(giacenza_aci_t) : null,
        giacenza_classi_kg: giacenza_classi_kg ? Object.fromEntries(Object.entries(giacenza_classi_kg).map(([c, v]) => [c, Math.round(v)])) : null,
        rilevazione_classi_kg,
        dopo_rilevazione,
        aggiornata_al,
        data_rilevazione,
        rilevazione_obsoleta,
        in_attesa_dichiarazione_t: r2(in_attesa_dichiarazione_t),
        ordini_da_dichiarare,
        arretrato_per_anno,
        dichiarato_t: r2(dichiarato_t),
        granulo_t: r2(der.granulo),
        fibre_t: r2(der.fibre),
        metallo_t: r2(der.metallo),
        cippato_t: r2(der.cippato),
        ciabattato_t: r2(der.ciabattato),
        conferito_primarie_t: r2(conferito_primarie_t),
        conferito_aci_t: r2(conferito_aci_t),
        conferito_extra_t: r2(conferito_extra_t),
        secondarie_in_t: r2(secondarie_in_t),
        secondarie_out_t: r2(secondarie_out_t),
        secondarie_nette_t: r2(secondarie_nette_t),
        secondarie_aci_in_t: r2(secondarie_aci_in_t),
        secondarie_aci_out_t: r2(secondarie_aci_out_t),
        terziarie_t: r2(terziarie_t),
        conferito_t: r2(conferito_t),
        target_primarie_t: r2(target_primarie_t),
        target_totale_t: r2(target_totale_t),
        giacenza_riferimento_t: r2(giacenza_riferimento_t),
        tipologia_trattamento,
        residuo_t: residuo_t !== null ? r2(residuo_t) : null,
        percentuale_target: percentuale_target !== null ? r2(percentuale_target) : null,
      });

      // --- Anomalie ---
      // Il target riguarda i soli impianti. Uno stoccaggio puo' legittimamente
      // esserne privo: quello di Irigom, per esempio, serve unicamente per gli
      // ACI, che un target non ce l'hanno.
      if (!g && td === 'imp') {
        sitiSenzaTarget.add(sitoNome + ' (Impianto)');
      }
      const sommaDerivati = der.granulo + der.fibre + der.metallo + der.cippato + der.ciabattato;
      if (dichiarato_t > 0 && Math.abs(sommaDerivati - dichiarato_t) > 0.001) {
        anomalie.push({
          tipo: 'coerenza_derivati',
          sito: sitoNome,
          dichiarato_t: r2(dichiarato_t),
          somma_derivati_t: r2(sommaDerivati),
          differenza_t: r2(dichiarato_t - sommaDerivati)
        });
      }
      if (g && target_totale_t > 0 && giacenza_portale_t > target_totale_t) {
        anomalie.push({
          tipo: 'giacenza_sopra_target',
          sito: sitoNome,
          giacenza_portale_t: r2(giacenza_portale_t),
          target_totale_t: r2(target_totale_t)
        });
      }
    }

    for (const s of sitiSenzaTarget) {
      anomalie.push({ tipo: 'sito_senza_target', sito: s, anno: annoNum });
    }

    righe.sort((a, b) => b.giacenza_portale_t - a.giacenza_portale_t);

    // === 7. TOTALI ===
    const numCols = [
      'giacenza_portale_t', 'in_attesa_dichiarazione_t',
      'dichiarato_t', 'granulo_t', 'fibre_t', 'metallo_t', 'cippato_t', 'ciabattato_t',
      'conferito_primarie_t', 'conferito_aci_t', 'conferito_extra_t', 'secondarie_in_t', 'secondarie_out_t', 'secondarie_nette_t', 'terziarie_t',
      'conferito_t', 'target_primarie_t', 'target_totale_t', 'giacenza_riferimento_t'
    ];
    const totali = {};
    for (const c of numCols) totali[c] = r2(righe.reduce((s, r) => s + (r[c] || 0), 0));
    totali.giacenza_classi_kg = classiVuote();
    for (const r of righe) for (const [c, v] of Object.entries(r.giacenza_classi_kg || {})) totali.giacenza_classi_kg[c] += v;
    totali.ordini_da_dichiarare = righe.reduce((s, r) => s + (r.ordini_da_dichiarare || 0), 0);

    return Response.json({ anno: annoNum, righe, totali, anomalie });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}